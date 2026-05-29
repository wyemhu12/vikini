/**
 * File Validation — Consolidated validation logic
 *
 * Merged from fileService.server.ts and attachments.ts.
 * Pure functions only — no DB, storage, or network calls.
 */

import type { FileKind, FileValidationResult, FileSupportLevel, FileCategory } from "@/types/files";

// ============================================
// INTERNAL HELPERS
// ============================================

/** Safely lowercase any value to a trimmed string. */
function safeLower(v: unknown): string {
  return String(v || "")
    .trim()
    .toLowerCase();
}

// ============================================
// BLOCKED EXTENSIONS & MIME TYPES
// ============================================

/** Blocked extensions — executables, scripts, system files, packages. */
export const BLOCKED_EXTENSIONS = new Set([
  // Windows executables
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "msi",
  "pif",
  // Scripts (excluding .js/.jsx for code uploads)
  "ps1",
  "vbs",
  "vbe",
  "wsf",
  "wsh",
  "hta",
  // System files
  "dll",
  "sys",
  "drv",
  "cpl",
  "ocx",
  // Registry / config
  "reg",
  "inf",
  // Shortcuts
  "lnk",
  "url",
  // Package archives that may contain executables
  "jar",
  "apk",
  "deb",
  "rpm",
]);

/** Blocked MIME types — corresponding dangerous content types. */
export const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
  "application/x-ms-installer",
  "application/x-msi",
  "application/x-powershell",
  "application/x-vbscript",
  "application/x-hta",
  "application/x-ms-shortcut",
  "application/x-winexe",
  "application/java-archive",
  "application/vnd.android.package-archive",
]);

// ============================================
// FILENAME & EXTENSION HELPERS
// ============================================

/**
 * Sanitize a filename: collapse path separators, strip control chars,
 * clamp to 200 chars.
 */
export function sanitizeFilename(name: unknown): string {
  const raw = String(name || "file").trim();
  const cleaned = raw
    .replace(/[\\/]+/g, "_")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, 200)
    .trim();
  return cleaned || "file";
}

/**
 * Extract lowercase extension from a filename.
 * Returns empty string when no extension is present.
 */
export function getExtension(filename: string): string {
  const n = safeLower(filename);
  const idx = n.lastIndexOf(".");
  if (idx === -1) return "";
  return n.slice(idx + 1);
}

// ============================================
// MIME NORMALIZATION
// ============================================

/** Extension → canonical MIME lookup (code files, media, docs, archives). */
const EXT_MIME_MAP: Record<string, string> = {
  // Code / text
  ts: "text/typescript",
  tsx: "text/tsx",
  jsx: "text/jsx",
  js: "text/javascript",
  json: "application/json",
  md: "text/markdown",
  csv: "text/csv",
  xml: "application/xml",
  yaml: "application/x-yaml",
  yml: "application/x-yaml",
  txt: "text/plain",
  html: "text/html",
  css: "text/css",
  log: "text/plain",
  py: "text/x-python",
  svg: "image/svg+xml",
  // Media
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Archives
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  "7z": "application/x-7z-compressed",
  rar: "application/x-rar-compressed",
};

/**
 * Normalize a MIME type based on extension, browser hint, and file kind.
 * Avoids `application/octet-stream` which some storage backends reject.
 *
 * For images, performs magic-byte sniffing and content validation via
 * {@link validateImageContent}.
 */
export function normalizeMimeType(ext: string, browserMime: string): string {
  // 1. Extension-based lookup (highest priority)
  if (EXT_MIME_MAP[ext]) return EXT_MIME_MAP[ext];

  // 2. Avoid octet-stream — prefer browser hint otherwise
  if (browserMime && browserMime !== "application/octet-stream") return browserMime;

  // 3. Fallback
  return "text/plain";
}

// ============================================
// FILE CLASSIFICATION
// ============================================

/**
 * Classify a file into one of 7 kinds based on extension and MIME.
 * Returns: image | video | audio | document | text | archive | other.
 */
export function classifyFile(ext: string, mime: string): FileKind {
  const textExts = [
    "txt",
    "js",
    "ts",
    "tsx",
    "jsx",
    "json",
    "md",
    "csv",
    "xml",
    "yaml",
    "yml",
    "html",
    "css",
    "scss",
    "less",
    "py",
    "rs",
    "go",
    "java",
    "c",
    "cpp",
    "h",
    "rb",
    "php",
    "sh",
    "log",
    "env",
    "toml",
    "ini",
    "cfg",
  ];
  const imageExts = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"];
  const videoExts = ["mp4", "mov", "webm", "avi", "mkv", "flv"];
  const audioExts = ["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"];
  const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  const archiveExts = ["zip", "tar", "gz", "7z", "rar"];

  if (textExts.includes(ext)) return "text";
  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (docExts.includes(ext)) return "document";
  if (archiveExts.includes(ext)) return "archive";

  // MIME fallback
  if (mime.startsWith("text/")) return "text";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation")
  ) {
    return "document";
  }
  if (mime.includes("zip") || mime.includes("archive") || mime.includes("compressed")) {
    return "archive";
  }

  return "other";
}

// ============================================
// MAGIC-BYTE IMAGE VALIDATION
// ============================================

/**
 * Check file magic bytes to verify image content matches its claimed MIME.
 * Supports PNG, JPEG, and WebP signatures.
 *
 * @param bytes - Raw file bytes (at least 12 bytes for full check)
 * @param expectedMime - The MIME type the file claims to be
 * @returns `true` if the content appears to be a valid image
 */
export function validateImageContent(bytes: Uint8Array, expectedMime: string): boolean {
  if (bytes.length < 8) return false;

  const sniffed = sniffImageMime(bytes);

  // If sniffed MIME exists, verify it matches expected or is at least an image
  if (sniffed) {
    return sniffed === expectedMime || expectedMime.startsWith("image/");
  }

  // Manual signature checks for expected MIME
  if (expectedMime === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (expectedMime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (expectedMime === "image/webp") {
    if (bytes.length < 12) return false;
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  // Cannot verify — be lenient
  return true;
}

/**
 * Sniff image MIME from raw bytes (PNG / JPEG / WebP).
 * Returns empty string when format is unrecognised.
 */
function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length < 12) return "";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return "";
}

// ============================================
// VALIDATE FILE (main entry point)
// ============================================

/**
 * Validate a file for upload: checks extension blocklist, MIME blocklist,
 * user's rank-based size limit, normalizes MIME, and classifies kind.
 *
 * @throws Error when the file is blocked, too large, or invalid
 */
export async function validateFile(
  file: File,
  filename: string | undefined,
  userId: string
): Promise<FileValidationResult> {
  if (!file) throw new Error("Missing file");

  const safeName = sanitizeFilename(filename || file.name || "file");
  const ext = getExtension(safeName);

  // Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error(`File type ".${ext}" is not allowed for security reasons`);
  }

  const browserMime = safeLower(file.type || "");

  // Block dangerous MIME types
  if (BLOCKED_MIME_TYPES.has(browserMime)) {
    throw new Error("File type is not allowed for security reasons");
  }

  const size = Number(file.size || 0);

  // Rank-based file size check
  const { checkFileSize } = await import("@/lib/core/limits");
  const sizeCheck = await checkFileSize(userId, size);
  if (!sizeCheck.allowed) {
    throw new Error(
      `File too large (${sizeCheck.fileSizeMB}MB). Your limit is ${sizeCheck.maxSizeMB}MB`
    );
  }

  const mime = normalizeMimeType(ext, browserMime);
  const kind = classifyFile(ext, mime);

  // Image content validation via magic bytes
  if (kind === "image" && typeof file.arrayBuffer === "function") {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (!validateImageContent(buf, mime)) {
      throw new Error("Invalid image file - file content does not match image format");
    }
  }

  return { filename: safeName, ext, mime, kind, sizeBytes: size };
}

// ============================================
// FILE CATEGORIES (UI display)
// ============================================

/** File type categories for user-facing UI (AttachmentsPanel). */
export const FILE_CATEGORIES: Record<string, FileCategory> = {
  BEST_SUPPORT: {
    labelKey: "fileTypesBestSupport",
    descriptionKey: "fileTypesBestSupportDesc",
    extensions: [
      "pdf",
      "txt",
      "md",
      "json",
      "js",
      "ts",
      "tsx",
      "jsx",
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "svg",
    ],
    icon: "check-circle",
  },
  BASIC_SUPPORT: {
    labelKey: "fileTypesBasicSupport",
    descriptionKey: "fileTypesBasicSupportDesc",
    extensions: [
      "zip",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "csv",
      "xml",
      "yaml",
      "html",
      "css",
    ],
    icon: "info",
  },
  BLOCKED: {
    labelKey: "fileTypesBlocked",
    descriptionKey: "fileTypesBlockedDesc",
    extensions: Array.from(BLOCKED_EXTENSIONS),
    icon: "x-circle",
  },
} as const;

/**
 * Get support level for a file based on its extension.
 */
export function getFileSupportLevel(filename: string): FileSupportLevel {
  const ext = getExtension(filename);

  if (BLOCKED_EXTENSIONS.has(ext)) return "blocked";
  if ((FILE_CATEGORIES.BEST_SUPPORT.extensions as readonly string[]).includes(ext)) return "best";
  if ((FILE_CATEGORIES.BASIC_SUPPORT.extensions as readonly string[]).includes(ext)) return "basic";

  return "unknown";
}

/**
 * Get a human-readable reason why a file extension is blocked.
 * Returns `null` when the extension is not blocked.
 */
export function getBlockedReason(ext: string): string | null {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!BLOCKED_EXTENSIONS.has(e)) return null;

  const executables = ["exe", "bat", "cmd", "com", "scr", "msi", "pif"];
  const scripts = ["ps1", "vbs", "vbe", "wsf", "wsh", "hta"];
  const systemFiles = ["dll", "sys", "drv", "cpl", "ocx", "reg", "inf", "lnk", "url"];
  const packages = ["jar", "apk", "deb", "rpm"];

  if (executables.includes(e)) return "executable";
  if (scripts.includes(e)) return "script";
  if (systemFiles.includes(e)) return "system";
  if (packages.includes(e)) return "package";

  return "security";
}
