// src/lib/features/files/documentParsers.ts
/**
 * Document Parsers & Data Sanitizers
 *
 * Dedicated parser module for binary document formats:
 * - DOCX via mammoth
 * - XLSX via exceljs (clean Markdown tables per sheet)
 * - PDF via pdf-parse v2 (with page cap & strict destroy in finally)
 * - Binary corruption detection & NUL-character strip
 */

import { logger } from "@/lib/utils/logger";

const parserLogger = logger.withContext("documentParsers");

/** Maximum chars extracted from a document by default */
export const DEFAULT_MAX_CHARS = 120_000;

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CD_SIGNATURE = 0x02014b50;
const ZIP_EOCD_MIN_SIZE = 22;
const ZIP_MAX_COMMENT_SIZE = 65535;
const ZIP_CD_HEADER_SIZE = 46;
const DEFAULT_MAX_ZIP_ENTRIES = 1_000;
const DEFAULT_MAX_ZIP_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_ZIP_COMPRESSION_RATIO = 100;
const ZIP_RATIO_CHECK_THRESHOLD_BYTES = 1 * 1024 * 1024; // 1MB

export interface ZipSafetyOptions {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  maxCompressionRatio?: number;
}

export type ZipSafetyResult =
  | { safe: true; entryCount: number; totalUncompressedBytes: number }
  | { safe: false; reason: string };

/**
 * Inspects a ZIP archive's End-of-Central-Directory (EOCD) and Central Directory entries
 * before decompression to prevent Zip-Bomb DoS attacks on OOXML (.docx / .xlsx).
 */
export function validateZipArchiveSafety(
  bytes: Uint8Array,
  options?: ZipSafetyOptions
): ZipSafetyResult {
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ZIP_ENTRIES;
  const maxUncompressedBytes = options?.maxUncompressedBytes ?? DEFAULT_MAX_ZIP_UNCOMPRESSED_BYTES;
  const maxCompressionRatio = options?.maxCompressionRatio ?? DEFAULT_MAX_ZIP_COMPRESSION_RATIO;

  if (bytes.length < ZIP_EOCD_MIN_SIZE) {
    return { safe: false, reason: "Archive too small to be a valid ZIP" };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minOffset = Math.max(0, bytes.length - ZIP_EOCD_MIN_SIZE - ZIP_MAX_COMMENT_SIZE);
  let eocdOffset = -1;

  for (let offset = bytes.length - ZIP_EOCD_MIN_SIZE; offset >= minOffset; offset--) {
    if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset === -1) {
    return { safe: false, reason: "Invalid ZIP archive: missing EOCD signature" };
  }

  const declaredEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (declaredEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    return { safe: false, reason: "ZIP64 sentinel values are not permitted" };
  }

  if (declaredEntries > maxEntries) {
    return {
      safe: false,
      reason: `ZIP entry count (${declaredEntries}) exceeds limit (${maxEntries})`,
    };
  }

  if (cdOffset + cdSize > eocdOffset) {
    return { safe: false, reason: "Invalid ZIP central directory bounds" };
  }

  let offset = cdOffset;
  const cdEnd = cdOffset + cdSize;
  let entryCount = 0;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;

  while (offset < cdEnd) {
    if (offset + ZIP_CD_HEADER_SIZE > cdEnd) {
      return { safe: false, reason: "Truncated ZIP central directory entry" };
    }

    if (view.getUint32(offset, true) !== ZIP_CD_SIGNATURE) {
      return { safe: false, reason: "Invalid ZIP central directory entry signature" };
    }

    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      return { safe: false, reason: "ZIP64 entry size sentinel is not permitted" };
    }

    if (compressedSize === 0 && uncompressedSize > 0) {
      return {
        safe: false,
        reason: "Suspicious ZIP entry with zero compressed size and non-zero uncompressed size",
      };
    }

    entryCount += 1;
    if (entryCount > maxEntries) {
      return {
        safe: false,
        reason: `ZIP entry count exceeds limit (${maxEntries})`,
      };
    }

    totalCompressedBytes += compressedSize;
    totalUncompressedBytes += uncompressedSize;

    if (totalUncompressedBytes > maxUncompressedBytes) {
      return {
        safe: false,
        reason: `ZIP uncompressed size (${totalUncompressedBytes}B) exceeds limit (${maxUncompressedBytes}B)`,
      };
    }

    offset += ZIP_CD_HEADER_SIZE + nameLen + extraLen + commentLen;
    if (offset > cdEnd) {
      return { safe: false, reason: "ZIP central directory entry overruns directory size" };
    }
  }

  if (
    totalUncompressedBytes > ZIP_RATIO_CHECK_THRESHOLD_BYTES &&
    totalCompressedBytes > 0 &&
    totalUncompressedBytes / totalCompressedBytes > maxCompressionRatio
  ) {
    return {
      safe: false,
      reason: `ZIP compression ratio exceeds limit (${maxCompressionRatio}:1)`,
    };
  }

  return { safe: true, entryCount, totalUncompressedBytes };
}

/**
 * Strips PostgreSQL incompatible NUL characters (\u0000) and trims.
 */
export function stripNulCharacters(text: string | null | undefined): string {
  if (!text) return "";
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u0000/g, "").trim();
}

/**
 * Checks whether raw bytes belong to legacy OLE2 Compound Document format (.doc, .xls, .ppt).
 * Header: 0xD0, 0xCF, 0x11, 0xE0
 */
export function isOle2Binary(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

/**
 * Detects whether extracted text is corrupted binary data.
 * Checks for PK\x03\x04 (ZIP header), %PDF- (raw PDF binary),
 * or excessive control characters (> 1% in first 4KB).
 */
export function isBinaryCorruptText(text: string | null | undefined): boolean {
  if (!text || text.length === 0) return false;

  // Direct binary signatures
  if (text.startsWith("PK\x03\x04") || text.startsWith("%PDF-")) {
    return true;
  }

  // Check density of unprintable control characters in first 4KB
  const sample = text.slice(0, 4096);
  if (sample.length === 0) return false;

  let controlCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // Control characters (excluding \t, \n, \r) or Unicode replacement character
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0xfffd) {
      controlCount++;
    }
  }

  const controlRatio = controlCount / sample.length;
  return controlRatio > 0.01; // > 1% control characters
}

/**
 * Sanitizes extracted text before caching or context injection.
 * Returns null if the text is empty or corrupted binary.
 */
export function sanitizeExtractedText(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = stripNulCharacters(text);
  if (!cleaned || isBinaryCorruptText(cleaned)) {
    return null;
  }
  return cleaned;
}

/**
 * Extract clean plain text from DOCX using mammoth.
 */
export async function parseDocxWithMammoth(
  bytes: Buffer | Uint8Array,
  maxChars: number = DEFAULT_MAX_CHARS
): Promise<string | null> {
  try {
    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const safety = validateZipArchiveSafety(uint8);
    if (!safety.safe) {
      parserLogger.warn(`Rejected unsafe DOCX archive: ${safety.reason}`);
      return null;
    }

    const mammoth = await import("mammoth");
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const result = await mammoth.extractRawText({ buffer });
    const text = stripNulCharacters(result.value || "");
    if (!text || isBinaryCorruptText(text)) return null;
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    parserLogger.warn(`parseDocxWithMammoth failed: ${msg}`);
    return null;
  }
}

/**
 * Extract clean Markdown table from XLSX using exceljs.
 * Sheets are formatted as Markdown tables.
 */
export async function parseXlsxWithExcelJs(
  bytes: Buffer | Uint8Array,
  maxChars: number = DEFAULT_MAX_CHARS
): Promise<string | null> {
  try {
    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const safety = validateZipArchiveSafety(uint8);
    if (!safety.safe) {
      parserLogger.warn(`Rejected unsafe XLSX archive: ${safety.reason}`);
      return null;
    }

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = new Uint8Array(uint8).buffer;
    await workbook.xlsx.load(arrayBuffer);

    const sheetTables: string[] = [];
    let accumulatedChars = 0;

    workbook.eachSheet((worksheet) => {
      if (accumulatedChars >= maxChars) return;

      const rows: string[][] = [];
      let sheetCharEstimate = 0;
      const sheetBudget = maxChars - accumulatedChars;

      worksheet.eachRow({ includeEmpty: false }, (row) => {
        if (sheetCharEstimate >= sheetBudget) return;
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          let cellText = "";
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === "object" && "text" in cell.value) {
              cellText = String(cell.value.text || "").replace(/\|/g, "\\|");
            } else if (typeof cell.value === "object" && "result" in cell.value) {
              cellText = String(cell.value.result || "").replace(/\|/g, "\\|");
            } else {
              cellText = String(cell.value).replace(/\|/g, "\\|");
            }
          }
          const cleaned = stripNulCharacters(cellText);
          values.push(cleaned);
          sheetCharEstimate += cleaned.length + 3;
        });
        if (values.length > 0) rows.push(values);
      });

      if (rows.length > 0) {
        // Build Markdown table
        const tableLines: string[] = [`### Sheet: ${worksheet.name}`];
        const headers = rows[0];
        tableLines.push(`| ${headers.join(" | ")} |`);
        tableLines.push(`| ${headers.map(() => "---").join(" | ")} |`);

        for (let i = 1; i < rows.length; i++) {
          const rowData = rows[i];
          // Pad row to header length if necessary
          const padded = headers.map((_, idx) => rowData[idx] || "");
          tableLines.push(`| ${padded.join(" | ")} |`);
        }
        const tableText = tableLines.join("\n");
        sheetTables.push(tableText);
        accumulatedChars += tableText.length + 2;
      }
    });

    const fullText = sheetTables.join("\n\n");
    if (!fullText) return null;
    return fullText.length > maxChars ? fullText.slice(0, maxChars) : fullText;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    parserLogger.warn(`parseXlsxWithExcelJs failed: ${msg}`);
    return null;
  }
}

/**
 * Extract clean plain text from PDF using pdf-parse v2 (with page cap & destroy).
 */
export async function parsePdfSafely(
  bytes: Uint8Array,
  maxChars: number = DEFAULT_MAX_CHARS
): Promise<string | null> {
  let parser: { destroy?: () => Promise<void> } | null = null;
  try {
    const pdfParseModule = (await import("pdf-parse")) as unknown as Record<string, unknown>;
    type PDFParserInstance = {
      getText: (opts?: { first?: number }) => Promise<{ text?: string }>;
      destroy?: () => Promise<void>;
    };
    type PDFParserConstructor = new (opts: { data: Buffer }) => PDFParserInstance;

    const PDFParseClass = (pdfParseModule.PDFParse || pdfParseModule.default) as
      | PDFParserConstructor
      | undefined;
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

    if (typeof PDFParseClass === "function" && PDFParseClass.prototype?.getText) {
      const instance = new PDFParseClass({ data: buffer });
      parser = instance;
      const result = await instance.getText({ first: 200 });
      let text = stripNulCharacters(result?.text || "");
      if (text.length > maxChars) {
        text = text.slice(0, maxChars);
      }
      return text.length > 0 && !isBinaryCorruptText(text) ? text : null;
    }

    // Fallback if pdf-parse exported as callable function (v1 legacy compat)
    const legacyFn = (pdfParseModule.default || pdfParseModule) as unknown;
    if (typeof legacyFn === "function") {
      const result = await (
        legacyFn as (buf: Buffer, opts?: { max?: number }) => Promise<{ text?: string }>
      )(buffer, { max: 200 });
      let text = stripNulCharacters(result?.text || "");
      if (text.length > maxChars) {
        text = text.slice(0, maxChars);
      }
      return text.length > 0 && !isBinaryCorruptText(text) ? text : null;
    }

    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    parserLogger.warn(`parsePdfSafely failed: ${msg}`);
    return null;
  } finally {
    if (parser && typeof parser.destroy === "function") {
      try {
        await parser.destroy();
      } catch {
        /* ignore parser cleanup error */
      }
    }
  }
}

/**
 * Routes raw file bytes to appropriate parser by MIME or extension.
 */
export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
  maxChars: number = DEFAULT_MAX_CHARS
): Promise<string | null> {
  const mime = (mimeType || "").toLowerCase();
  const ext = (filename || "").toLowerCase().split(".").pop() || "";

  // Reject legacy OLE2 formats immediately (doc, xls, ppt)
  if (isOle2Binary(bytes) || ["doc", "xls", "ppt"].includes(ext)) {
    parserLogger.info(`Legacy binary format rejected for text extraction: .${ext}`);
    return null;
  }

  // 1. PDF
  if (mime === "application/pdf" || ext === "pdf") {
    return parsePdfSafely(bytes, maxChars);
  }

  // 2. DOCX
  if (
    ext === "docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseDocxWithMammoth(bytes, maxChars);
  }

  // 3. XLSX
  if (
    ext === "xlsx" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return parseXlsxWithExcelJs(bytes, maxChars);
  }

  // 4. Other text-based formats (CSV, JSON, Markdown, Code)
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const text = decoder.decode(bytes);
    return sanitizeExtractedText(text.length > maxChars ? text.slice(0, maxChars) : text);
  } catch {
    // Non UTF-8 binary file
    return null;
  }
}
