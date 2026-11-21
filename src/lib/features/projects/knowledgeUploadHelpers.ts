/**
 * Client-side upload validation and XHR staged progress helper for Project Knowledge Base.
 */

import type { KnowledgeDocument } from "@/types/projects";
import {
  extractUploadErrorMessage,
  UPLOAD_ABORTED_SENTINEL,
} from "@/lib/features/files/fileUploadHelpers";

export const KNOWLEDGE_MAX_FILE_BYTES = 4 * 1024 * 1024;

export const KNOWLEDGE_ALLOWED_EXTENSIONS = new Set([
  "txt",
  "md",
  "pdf",
  "docx",
  "ini",
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "java",
  "go",
  "rs",
  "json",
  "yaml",
  "yml",
  "toml",
  "sql",
  "css",
  "html",
]);

export const KNOWLEDGE_ACCEPT = Array.from(KNOWLEDGE_ALLOWED_EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(",");

export type KnowledgeFileValidationError = "TOO_LARGE" | "UNSUPPORTED_TYPE";

export interface KnowledgeUploadCallbacks {
  onProgress?: (percent: number) => void;
  onProcessing?: () => void;
  signal?: AbortSignal;
}

export function validateKnowledgeFile(file: File): KnowledgeFileValidationError | null {
  if (file.size > KNOWLEDGE_MAX_FILE_BYTES) {
    return "TOO_LARGE";
  }
  const dotIdx = file.name.lastIndexOf(".");
  const ext = dotIdx > 0 ? file.name.slice(dotIdx + 1).toLowerCase() : "";
  if (!ext || !KNOWLEDGE_ALLOWED_EXTENSIONS.has(ext)) {
    return "UNSUPPORTED_TYPE";
  }
  return null;
}

export interface SendKnowledgeUploadXhrParams {
  projectId: string;
  file: File;
  formData?: FormData;
  payloadTooLargeMessage: string;
  fallbackErrorMessage: string;
  onProgress?: (percent: number) => void;
  onProcessing?: () => void;
  signal?: AbortSignal;
}

export function sendKnowledgeUploadXhr({
  projectId,
  file,
  formData,
  payloadTooLargeMessage,
  fallbackErrorMessage,
  onProgress,
  onProcessing,
  signal,
}: SendKnowledgeUploadXhrParams): Promise<{ document?: KnowledgeDocument; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(UPLOAD_ABORTED_SENTINEL));
      return;
    }

    const body = formData ?? new FormData();
    if (!formData) {
      body.append("file", file);
    }

    const xhr = new XMLHttpRequest();
    let processingFired = false;
    const fireProcessing = () => {
      if (processingFired) return;
      processingFired = true;
      onProcessing?.();
    };

    const handleAbortSignal = () => {
      try {
        xhr.abort();
      } catch {
        // Ignore abort on already-settled XHR
      }
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", handleAbortSignal);
    };

    signal?.addEventListener("abort", handleAbortSignal, { once: true });

    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable && e.total > 0) {
        const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
        onProgress?.(pct);
        if (pct >= 100) {
          fireProcessing();
        }
      }
    };

    xhr.upload.onload = () => {
      onProgress?.(100);
      fireProcessing();
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status === 413) {
        reject(new Error(payloadTooLargeMessage));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed: unknown = JSON.parse(xhr.responseText);
          if (typeof parsed === "object" && parsed !== null) {
            const payload = parsed as {
              success?: boolean;
              error?: { message?: string } | string;
              data?: { document?: KnowledgeDocument; truncated?: boolean };
            };
            if (payload.success === false) {
              reject(new Error(extractUploadErrorMessage(xhr.responseText, fallbackErrorMessage)));
              return;
            }
            resolve({
              document: payload.data?.document,
              truncated: Boolean(payload.data?.truncated),
            });
            return;
          }
        } catch {
          reject(new Error(fallbackErrorMessage));
          return;
        }
      }

      reject(new Error(extractUploadErrorMessage(xhr.responseText, fallbackErrorMessage)));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new Error(UPLOAD_ABORTED_SENTINEL));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error(fallbackErrorMessage));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new Error(fallbackErrorMessage));
    };

    xhr.timeout = 120_000;
    xhr.open("POST", `/api/projects/${encodeURIComponent(projectId)}/knowledge`);
    xhr.send(body);
  });
}
