// /lib/features/files/fileUploadHelpers.ts
// Client-side file upload classification, validation, and error extraction helpers.

import { BLOCKED_EXTENSIONS, BLOCKED_MIME_TYPES } from "./fileValidation";
import type { FileItem, FileKind } from "@/types/files";

export const UPLOAD_ABORTED_SENTINEL = "__UPLOAD_ABORTED__";

export class StructuredUploadError extends Error {
  readonly uploadError: FileUploadError;
  readonly retryable: boolean;

  constructor(uploadError: FileUploadError, retryable = false) {
    super(uploadError.detail || uploadError.code);
    this.uploadError = uploadError;
    this.retryable = retryable;
  }
}

/** Client-side max file size (50MB). Server enforces rank-specific limits. */
export const CLIENT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const CLIENT_MAX_FILE_SIZE_MB = 50;

export type FileUploadErrorCode =
  | "BLOCKED_EXTENSION"
  | "BLOCKED_MIME"
  | "FILE_TOO_LARGE"
  | "CONVERSATION_INIT_FAILED"
  | "UPLOAD_FAILED"
  | "NETWORK_ERROR"
  | "TIMEOUT";

export interface FileUploadError {
  code: FileUploadErrorCode;
  filename?: string;
  ext?: string;
  sizeMB?: number;
  detail?: string;
}

/** File input accept attribute - all supported types */
export const FILE_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".sql",
  ".sh",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".log",
  ".zip",
  ".mp4",
  ".mov",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
].join(",");

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "avi", "mkv"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"]);
const DOC_EXTS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const ARCHIVE_EXTS = new Set(["zip", "tar", "gz", "7z", "rar"]);
const TEXT_EXTS = new Set([
  "txt",
  "md",
  "json",
  "csv",
  "xml",
  "yaml",
  "yml",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
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
  "toml",
  "ini",
  "cfg",
  "scss",
  "less",
  "sql",
  "env",
]);

/** Client-side file kind classification for immediate UI feedback */
export function classifyClientSide(ext: string, mime: string): FileKind {
  const normalizedExt = ext.toLowerCase();
  const normalizedMime = (mime || "").toLowerCase();
  if (normalizedMime.startsWith("image/") || IMAGE_EXTS.has(normalizedExt)) return "image";
  if (normalizedMime.startsWith("video/") || VIDEO_EXTS.has(normalizedExt)) return "video";
  if (normalizedMime.startsWith("audio/") || AUDIO_EXTS.has(normalizedExt)) return "audio";
  if (DOC_EXTS.has(normalizedExt)) return "document";
  if (ARCHIVE_EXTS.has(normalizedExt)) return "archive";
  if (normalizedMime.startsWith("text/") || TEXT_EXTS.has(normalizedExt)) return "text";
  return "other";
}

/** Fast-fail client validation returning a structured error code instead of hardcoded UI prose. */
export function validateFileForUpload(file: File): FileUploadError | null {
  const dotIdx = file.name.lastIndexOf(".");
  const ext = dotIdx > 0 ? file.name.slice(dotIdx + 1).toLowerCase() : "";

  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return { code: "BLOCKED_EXTENSION", filename: file.name, ext: `.${ext}` };
  }

  const lowerMime = (file.type || "").toLowerCase();
  if (lowerMime && BLOCKED_MIME_TYPES.has(lowerMime)) {
    return { code: "BLOCKED_MIME", filename: file.name };
  }

  if (file.size > CLIENT_MAX_FILE_SIZE_BYTES) {
    const sizeMB = Math.max(1, Math.round(file.size / 1024 / 1024));
    return { code: "FILE_TOO_LARGE", filename: file.name, sizeMB };
  }

  return null;
}

/**
 * Safely extracts a human-readable error message from a server JSON or text response.
 * Never produces "[object Object]" for structured `{ error: { code, message } }` payloads.
 */
export function extractUploadErrorMessage(responseText: string, fallback: string): string {
  if (!responseText || typeof responseText !== "string") return fallback;
  try {
    const body: unknown = JSON.parse(responseText);
    if (typeof body === "object" && body !== null) {
      const record = body as { error?: unknown; message?: unknown };
      if (typeof record.error === "string" && record.error.trim()) {
        return record.error.trim();
      }
      if (typeof record.error === "object" && record.error !== null) {
        const nestedMsg = (record.error as { message?: unknown }).message;
        if (typeof nestedMsg === "string" && nestedMsg.trim()) {
          return nestedMsg.trim();
        }
      }
      if (typeof record.message === "string" && record.message.trim()) {
        return record.message.trim();
      }
    }
  } catch {
    // Non-JSON response body
  }
  return fallback;
}

export interface XhrUploadParams {
  file: File;
  conversationId: string;
  activeXhrs: Set<XMLHttpRequest>;
  onProgress: (percent: number) => void;
  onSuccess: (uploadedFile: FileItem | null) => void;
}

/** Executes a single XHR upload attempt, registering the XHR for lifecycle cancellation. */
export function sendFileUploadXhr({
  file,
  conversationId,
  activeXhrs,
  onProgress,
  onSuccess,
}: XhrUploadParams): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("conversationId", conversationId);

    const xhr = new XMLHttpRequest();
    activeXhrs.add(xhr);
    const cleanup = () => activeXhrs.delete(xhr);

    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        let uploadedFile: FileItem | null = null;
        try {
          const body: unknown = JSON.parse(xhr.responseText);
          if (typeof body === "object" && body !== null) {
            const d = body as { data?: { file?: FileItem }; file?: FileItem };
            uploadedFile = d.data?.file ?? d.file ?? null;
          }
        } catch {
          // Response parsing fallback handled by SWR revalidation
        }
        onSuccess(uploadedFile);
        resolve();
      } else {
        const detail = extractUploadErrorMessage(xhr.responseText, "");
        reject(
          new StructuredUploadError(
            { code: "UPLOAD_FAILED", filename: file.name, ...(detail ? { detail } : {}) },
            false
          )
        );
      }
    };

    xhr.onabort = () => {
      cleanup();
      reject(new Error(UPLOAD_ABORTED_SENTINEL));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new StructuredUploadError({ code: "NETWORK_ERROR", filename: file.name }, true));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new StructuredUploadError({ code: "TIMEOUT", filename: file.name }, true));
    };
    xhr.timeout = 120_000;
    xhr.open("POST", "/api/files/upload");
    xhr.send(fd);
  });
}
