// @vitest-environment node
// src/lib/features/files/documentParsers.test.ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  stripNulCharacters,
  isOle2Binary,
  isBinaryCorruptText,
  sanitizeExtractedText,
  extractDocumentText,
  validateZipArchiveSafety,
  parseDocxWithMammoth,
  parseXlsxWithExcelJs,
} from "./documentParsers";

function buildSyntheticZip(
  entries: Array<{ compressed: number; uncompressed: number }>,
  opts?: {
    overrideDeclaredEntries?: number;
    overrideCdOffset?: number;
    overrideCdSignature?: number;
  }
): Uint8Array {
  const cdEntrySize = 46 + 1; // 1-byte filename
  const cdSize = entries.length * cdEntrySize;
  const cdOffset = 0;
  const totalSize = cdSize + 22;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  let pos = 0;
  for (const entry of entries) {
    view.setUint32(pos, opts?.overrideCdSignature ?? 0x02014b50, true);
    view.setUint32(pos + 20, entry.compressed, true);
    view.setUint32(pos + 24, entry.uncompressed, true);
    view.setUint16(pos + 28, 1, true); // nameLen = 1
    buf[pos + 46] = 0x61; // "a"
    pos += cdEntrySize;
  }

  // EOCD
  const eocdOffset = cdSize;
  view.setUint32(eocdOffset, 0x06054b50, true);
  view.setUint16(eocdOffset + 10, opts?.overrideDeclaredEntries ?? entries.length, true);
  view.setUint32(eocdOffset + 12, cdSize, true);
  view.setUint32(eocdOffset + 16, opts?.overrideCdOffset ?? cdOffset, true);
  return buf;
}

describe("documentParsers", () => {
  describe("stripNulCharacters", () => {
    it("strips NUL bytes and trims text", () => {
      const input = "Hello\u0000World\u0000 ";
      expect(stripNulCharacters(input)).toBe("HelloWorld");
    });

    it("returns empty string for null or empty input", () => {
      expect(stripNulCharacters(null)).toBe("");
      expect(stripNulCharacters("")).toBe("");
    });
  });

  describe("isOle2Binary", () => {
    it("identifies OLE2 header (D0 CF 11 E0)", () => {
      const oleHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x01]);
      expect(isOle2Binary(oleHeader)).toBe(true);
    });

    it("rejects non-OLE2 bytes", () => {
      const nonOle = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      expect(isOle2Binary(nonOle)).toBe(false);
    });
  });

  describe("isBinaryCorruptText", () => {
    it("flags ZIP/DOCX binary signature PK\\x03\\x04", () => {
      expect(isBinaryCorruptText("PK\x03\x04\x14\x00...")).toBe(true);
    });

    it("flags raw PDF binary header %PDF-", () => {
      expect(isBinaryCorruptText("%PDF-1.4\n%...\x01\x02")).toBe(true);
    });

    it("flags high unprintable control character density (>1%)", () => {
      const corrupt = "\x01\x02\x03\x04\x05\x06\x07Hello World";
      expect(isBinaryCorruptText(corrupt)).toBe(true);
    });

    it("DOES NOT flag valid CSV starting with PK", () => {
      const validCsv = "PK,Name,Score\n1,Alice,100\n2,Bob,95";
      expect(isBinaryCorruptText(validCsv)).toBe(false);
    });

    it("DOES NOT flag normal Vietnamese or English text", () => {
      const validText = "Cộng hòa Xã hội Chủ nghĩa Việt Nam - Độc lập Tự do Hạnh phúc";
      expect(isBinaryCorruptText(validText)).toBe(false);
    });
  });

  describe("sanitizeExtractedText", () => {
    it("returns null for corrupt binary text", () => {
      expect(sanitizeExtractedText("PK\x03\x04\x14\x00...")).toBeNull();
    });

    it("returns cleaned string for valid text", () => {
      expect(sanitizeExtractedText("  Valid content \u0000 here  ")).toBe("Valid content  here");
    });
  });

  describe("extractDocumentText routing", () => {
    it("immediately rejects legacy OLE2 formats (.doc, .xls, .ppt)", async () => {
      const dummyOle = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x12, 0x34]);
      const res = await extractDocumentText(dummyOle, "application/msword", "legacy.doc");
      expect(res).toBeNull();
    });

    it("extracts plain UTF-8 text for markdown or csv", async () => {
      const text = "# Heading\nSome content";
      const bytes = new TextEncoder().encode(text);
      const res = await extractDocumentText(bytes, "text/markdown", "readme.md");
      expect(res).toBe(text);
    });
  });

  describe("validateZipArchiveSafety & Zip-Bomb DoS protection (TC-W2A-09, NP-01)", () => {
    it("rejects ZIP claiming > 50MB uncompressed size before calling mammoth/exceljs", async () => {
      const bomb = buildSyntheticZip([{ compressed: 1024, uncompressed: 60 * 1024 * 1024 }]);
      const check = validateZipArchiveSafety(bomb);
      expect(check.safe).toBe(false);
      expect(await parseDocxWithMammoth(bomb)).toBeNull();
      expect(await parseXlsxWithExcelJs(bomb)).toBeNull();
    });

    it("rejects ZIP with > 1,000 entries, ZIP64 sentinels, invalid CD bounds/signature, zero-compressed or extreme ratio", () => {
      const tooMany = buildSyntheticZip([{ compressed: 10, uncompressed: 10 }], {
        overrideDeclaredEntries: 1001,
      });
      expect(validateZipArchiveSafety(tooMany).safe).toBe(false);

      const zip64 = buildSyntheticZip([{ compressed: 10, uncompressed: 0xffffffff }]);
      expect(validateZipArchiveSafety(zip64).safe).toBe(false);

      const badBounds = buildSyntheticZip([{ compressed: 10, uncompressed: 10 }], {
        overrideCdOffset: 9999,
      });
      expect(validateZipArchiveSafety(badBounds).safe).toBe(false);

      const badSig = buildSyntheticZip([{ compressed: 10, uncompressed: 10 }], {
        overrideCdSignature: 0xdeadbeef,
      });
      expect(validateZipArchiveSafety(badSig).safe).toBe(false);

      const zeroCompressed = buildSyntheticZip([{ compressed: 0, uncompressed: 5000 }]);
      expect(validateZipArchiveSafety(zeroCompressed).safe).toBe(false);

      const highRatio = buildSyntheticZip([{ compressed: 10_000, uncompressed: 2_000_000 }]);
      expect(validateZipArchiveSafety(highRatio).safe).toBe(false);
    });

    it("parses valid XLSX via ArrayBuffer without any and stops early when exceeding maxChars", async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Sales");
      sheet.addRow(["Item", "Price"]);
      for (let i = 0; i < 40; i++) {
        sheet.addRow([`Product-${i}`, `$${i * 10}`]);
      }
      const rawBuffer = await wb.xlsx.writeBuffer();
      const uint8 = new Uint8Array(rawBuffer);

      expect(validateZipArchiveSafety(uint8).safe).toBe(true);

      const full = await parseXlsxWithExcelJs(uint8, 10_000);
      expect(full).toContain("### Sheet: Sales");
      expect(full).toContain("| Item | Price |");
      expect(full).toContain("Product-0");

      const capped = await parseXlsxWithExcelJs(uint8, 80);
      expect(capped).not.toBeNull();
      expect((capped as string).length).toBeLessThanOrEqual(80);
    });
  });
});
