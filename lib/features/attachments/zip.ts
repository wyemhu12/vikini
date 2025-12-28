// /lib/features/attachments/zip.ts
import { createInflateRaw } from "zlib";

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

function u16(buf: Buffer, off: number): number {
  return buf.readUInt16LE(off);
}

function u32(buf: Buffer, off: number): number {
  return buf.readUInt32LE(off);
}

function safeName(name: string): string {
  const s = String(name || "").replace(/\\/g, "/");
  return s.replace(/^\/+/, "").replace(/\u0000/g, "");
}

function extOf(name: string): string {
  const n = String(name || "").toLowerCase();
  const i = n.lastIndexOf(".");
  return i === -1 ? "" : n.slice(i + 1);
}

function isTextLikeExt(ext: string, name: string): boolean {
  const base = String(name || "").toLowerCase();
  if (base === "dockerfile") return true;
  if (base.endsWith(".gitignore")) return true;

  return new Set([
    "txt",
    "md",
    "markdown",
    "json",
    "js",
    "jsx",
    "ts",
    "tsx",
    "css",
    "html",
    "htm",
    "yml",
    "yaml",
    "csv",
    "tsv",
    "xml",
    "env",
    "py",
    "java",
    "go",
    "rs",
    "php",
    "rb",
    "c",
    "cc",
    "cpp",
    "h",
    "hpp",
    "sh",
    "bat",
    "ps1",
    "sql",
    "toml",
    "ini",
    "properties",
  ]).has(ext);
}

function findEOCD(buf: Buffer): number {
  // EOCD is within last 64KB + 22 bytes
  const maxBack = Math.min(buf.length, 0x10000 + 22);
  for (let i = buf.length - 22; i >= buf.length - maxBack; i--) {
    if (i < 0) break;
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  uncompSize: number;
  localOff: number;
  warning?: string;
}

interface ParseResult {
  entries: ZipEntry[];
  truncated: boolean;
  cdOffset: number;
  cdSize: number;
}

interface ParseOptions {
  maxEntries?: number;
  maxTotalUncompressed?: number;
}

function parseCentralDirectory(buf: Buffer, opts: ParseOptions = {}): ParseResult {
  const eocdOff = findEOCD(buf);
  if (eocdOff < 0) throw new Error("ZIP EOCD not found");

  const cdSize = u32(buf, eocdOff + 12);
  const cdOffset = u32(buf, eocdOff + 16);
  const totalEntries = u16(buf, eocdOff + 10);

  if (cdOffset + cdSize > buf.length) throw new Error("ZIP central directory out of range");

  const entries: ZipEntry[] = [];
  let off = cdOffset;

  const maxEntries = Number(opts.maxEntries || 2000);
  const maxTotalUncompressed = Number(opts.maxTotalUncompressed || 200 * 1024 * 1024);

  let totalUncompressed = 0;

  for (let i = 0; i < totalEntries && entries.length < maxEntries; i++) {
    if (off + 46 > buf.length) break;
    const sig = u32(buf, off);
    if (sig !== SIG_CEN) break;

    const method = u16(buf, off + 10);
    const compSize = u32(buf, off + 20);
    const uncompSize = u32(buf, off + 24);
    const nameLen = u16(buf, off + 28);
    const extraLen = u16(buf, off + 30);
    const commentLen = u16(buf, off + 32);
    const localOff = u32(buf, off + 42);

    const nameStart = off + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buf.length) break;

    const name = safeName(buf.slice(nameStart, nameEnd).toString("utf8"));

    totalUncompressed += uncompSize;
    if (totalUncompressed > maxTotalUncompressed) {
      entries.push({ name, method, compSize, uncompSize, localOff, warning: "uncompressed_limit" });
      break;
    }

    entries.push({ name, method, compSize, uncompSize, localOff });

    off = nameEnd + extraLen + commentLen;
  }

  const truncated = totalEntries > entries.length;
  return { entries, truncated, cdOffset, cdSize };
}

function localDataOffset(buf: Buffer, localOff: number): number {
  if (localOff + 30 > buf.length) throw new Error("ZIP local header out of range");
  const sig = u32(buf, localOff);
  if (sig !== SIG_LOC) throw new Error("ZIP local header signature mismatch");
  const nameLen = u16(buf, localOff + 26);
  const extraLen = u16(buf, localOff + 28);
  return localOff + 30 + nameLen + extraLen;
}

async function inflateRawToStringLimited(compBuf: Buffer, byteCap: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const infl = createInflateRaw();
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      try {
        infl.removeAllListeners();
        infl.destroy();
      } catch {
        // Ignore cleanup errors
      }
      const out = Buffer.concat(chunks).toString("utf8");
      resolve(out);
    }

    infl.on("data", (chunk: Buffer) => {
      if (done) return;
      const b = Buffer.from(chunk);
      if (total < byteCap) {
        const remain = byteCap - total;
        chunks.push(remain >= b.length ? b : b.slice(0, remain));
        total += Math.min(remain, b.length);
      }
      if (total >= byteCap) finish();
    });

    infl.on("error", (e: Error) => {
      if (done) return;
      done = true;
      reject(e);
    });

    infl.on("end", () => finish());

    infl.end(compBuf);
  });
}

interface SummarizeOptions {
  maxEntries?: number;
  maxFilesToExtract?: number;
  maxChars?: number;
  maxPerFileBytes?: number;
  maxTotalUncompressed?: number;
}

interface ZipSnippet {
  name: string;
  text: string;
  truncated: boolean;
}

interface SummarizeResult {
  text: string;
  warnings?: string[];
}

/**
 * Summarize a ZIP buffer into a prompt-safe text block.
 * - Lists entries (capped)
 * - Extracts snippets from text-like files (capped)
 * Supported compression: stored (0) and deflate (8)
 */
export async function summarizeZipBytes(bytes: Buffer, opts: SummarizeOptions = {}): Promise<SummarizeResult> {
  const maxEntries = Number(opts.maxEntries || 2000);
  const maxFilesToExtract = Number(opts.maxFilesToExtract || 30);
  const maxChars = Number(opts.maxChars || 120000);
  const maxPerFileBytes = Number(opts.maxPerFileBytes || 40000);
  const maxTotalUncompressed = Number(opts.maxTotalUncompressed || 200 * 1024 * 1024);

  const warnings: string[] = [];
  const snippets: ZipSnippet[] = [];

  if (!bytes || !Buffer.isBuffer(bytes)) {
    return { text: "ZIP: (no bytes)", warnings: ["missing_bytes"] };
  }

  let parsed: ParseResult;
  try {
    parsed = parseCentralDirectory(bytes, { maxEntries, maxTotalUncompressed });
  } catch (e) {
    const error = e as Error;
    return { text: `ZIP parse failed: ${String(error?.message || error)}`, warnings: ["zip_parse_failed"] };
  }

  const entries = parsed.entries || [];
  if (parsed.truncated) warnings.push(`too_many_entries_over_${maxEntries}`);

  let remainingChars = maxChars;
  let extracted = 0;

  for (const e of entries) {
    if (!e?.name || e.name.endsWith("/")) continue;
    if (extracted >= maxFilesToExtract) break;
    if (remainingChars <= 0) break;

    const name = e.name;
    const ext = extOf(name);
    if (!isTextLikeExt(ext, name)) continue;

    // Skip huge files based on header metadata (best-effort)
    if (Number(e.uncompSize || 0) > maxPerFileBytes * 4) continue;

    try {
      const dataOff = localDataOffset(bytes, e.localOff);
      const compEnd = dataOff + Number(e.compSize || 0);
      if (compEnd > bytes.length) {
        warnings.push("zip_data_out_of_range");
        continue;
      }
      const comp = bytes.slice(dataOff, compEnd);

      let text = "";
      if (e.method === 0) {
        // stored
        text = comp.slice(0, maxPerFileBytes).toString("utf8");
      } else if (e.method === 8) {
        // deflate
        text = await inflateRawToStringLimited(comp, maxPerFileBytes);
      } else {
        warnings.push("zip_unsupported_compression");
        continue;
      }

      text = String(text || "").replace(/\u0000/g, "");
      let truncated = false;
      if (text.length > remainingChars) {
        text = text.slice(0, Math.max(0, remainingChars));
        truncated = true;
      }
      remainingChars -= text.length;

      snippets.push({ name, text, truncated });
      extracted += 1;
    } catch {
      warnings.push("zip_extract_error");
    }
  }

  const lines: string[] = [];
  lines.push("ZIP SUMMARY");
  lines.push(`entries: ${entries.length}`);
  if (warnings.length) lines.push(`warnings: ${warnings.join(", ")}`);
  lines.push("");
  lines.push("FILE LIST:");
  const listMax = Math.min(entries.length, 500);
  for (let i = 0; i < listMax; i++) {
    const e = entries[i];
    lines.push(`- ${e.name} (${Number(e.uncompSize || 0)} bytes)`);
  }
  if (entries.length > listMax) lines.push(`- (and ${entries.length - listMax} more)`);

  if (snippets.length) {
    lines.push("");
    lines.push("EXTRACTED SNIPPETS (text-like files):");
    for (const s of snippets) {
      lines.push("");
      lines.push(`FILE: ${s.name}`);
      lines.push("```");
      lines.push(s.text);
      lines.push("```");
      if (s.truncated) lines.push("[snippet truncated by context limit]");
    }
  }

  return { text: lines.join("\n"), warnings };
}

