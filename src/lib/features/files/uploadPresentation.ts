/**
 * Pure presentation, sorting, optimistic merge, relative date, objectURL,
 * and validation helpers for all file & image upload surfaces.
 *
 * Leaf module: imports ONLY TypeScript types (zero runtime imports from hooks/helpers).
 */

import type { FileItem, FileUploadProgress } from "@/types/files";
import type { FileUploadError } from "./fileUploadHelpers";

const DEFAULT_CLIENT_MAX_MB = 50;
const DEFAULT_REF_IMAGE_MAX_COUNT = 4;
const DEFAULT_REF_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_PREVIEW_MAX_BYTES = 15 * 1024 * 1024;

const stableFileKeys = new WeakMap<File, string>();
const imageDataUrlCache = new WeakMap<File, Promise<string | undefined>>();
let fileKeySequence = 0;

/** Returns a stable React key for a File instance (avoids index-key flicker). */
export function getStableFileKey(file: File): string {
  const existing = stableFileKeys.get(file);
  if (existing) return existing;
  fileKeySequence += 1;
  const key = `file-${fileKeySequence}-${file.name}-${file.size}-${file.lastModified}`;
  stableFileKeys.set(file, key);
  return key;
}

/**
 * Reads a local image File into a CSP-safe `data:` URL (allowed by `img-src 'self' data: https:`).
 * Memoized per File instance via WeakMap; resolves `undefined` on oversize, read error, or non-DOM envs.
 */
export function readImagePreviewDataUrl(
  file: File,
  maxBytes = DEFAULT_PREVIEW_MAX_BYTES
): Promise<string | undefined> {
  if (file.size > maxBytes || typeof FileReader === "undefined") {
    return Promise.resolve(undefined);
  }
  const cached = imageDataUrlCache.get(file);
  if (cached) return cached;

  const promise = new Promise<string | undefined>((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : undefined;
        if (!result) imageDataUrlCache.delete(file);
        resolve(result);
      };
      reader.onerror = () => {
        imageDataUrlCache.delete(file);
        resolve(undefined);
      };
      reader.onabort = () => {
        imageDataUrlCache.delete(file);
        resolve(undefined);
      };
      reader.readAsDataURL(file);
    } catch {
      imageDataUrlCache.delete(file);
      resolve(undefined);
    }
  });
  imageDataUrlCache.set(file, promise);
  return promise;
}

/** Extracts File objects from a ClipboardEvent, giving anonymous screenshots unique names. */
export function extractPastedFiles(items: DataTransferItemList | undefined | null): File[] {
  if (!items) return [];
  const pastedFiles: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;
    const isScreenshot = file.name === "image.png" || file.name.startsWith("blob");
    pastedFiles.push(
      isScreenshot
        ? new File([file], `screenshot-${Date.now()}.${file.name.split(".").pop() || "png"}`, {
            type: file.type,
          })
        : file
    );
  }
  return pastedFiles;
}

/**
 * Asynchronously hydrates CSP-safe `data:` preview URLs for newly queued image uploads.
 * Checks `shouldApply(tempId)` before applying so cancelled/stale uploads never leak state.
 */
export function hydrateQueuedImagePreviews(
  items: readonly FileUploadProgress[],
  shouldApply: (tempId: string) => boolean,
  onPreviewReady: (tempId: string, previewUrl: string) => void
): void {
  for (const item of items) {
    if (item.kind !== "image" || item.previewUrl) continue;
    void readImagePreviewDataUrl(item.file).then((dataUrl) => {
      if (dataUrl && shouldApply(item.tempId)) {
        onPreviewReady(item.tempId, dataUrl);
      }
    });
  }
}

/** Safely creates an objectURL for browser preview (no-op in non-DOM/unsupported envs). */
export function createSafeObjectUrl(file: File): string | undefined {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return undefined;
  }
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

/** Safely revokes a `blob:` objectURL created via createSafeObjectUrl (no-op for `data:` URLs). */
export function revokeSafeObjectUrl(url: string | undefined | null): void {
  if (
    !url ||
    !url.startsWith("blob:") ||
    typeof URL === "undefined" ||
    typeof URL.revokeObjectURL !== "function"
  ) {
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore revoke errors on already-released or synthetic URLs
  }
}

function parseTimestamp(iso: string | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Sorts composer files chronologically ascending (oldest left, newest right) so newly
 * uploaded items remain stationary at their append position after SWR revalidation.
 * Preserves original order when `created_at` is missing or invalid (safe for minimal mocks).
 */
export function sortComposerFiles(files: readonly FileItem[]): FileItem[] {
  if (files.length <= 1) return [...files];
  return files
    .map((file, index) => ({
      file,
      index,
      ts: parseTimestamp(file.created_at),
    }))
    .sort((a, b) => {
      if (a.ts === null || b.ts === null) return a.index - b.index;
      if (a.ts !== b.ts) return a.ts - b.ts;
      return a.index - b.index;
    })
    .map((entry) => entry.file);
}

/**
 * Merges a newly uploaded file into SWR cache without duplicates, preserving existing order
 * and updating metadata if the file ID already exists.
 */
export function mergeUploadedFileOptimistically(
  current: readonly FileItem[] | undefined,
  uploadedFile: FileItem
): FileItem[] {
  const list = Array.isArray(current) ? current : [];
  const existingIdx = list.findIndex((f) => f.id === uploadedFile.id);
  if (existingIdx !== -1) {
    const updated = [...list];
    updated[existingIdx] = { ...updated[existingIdx], ...uploadedFile };
    return updated;
  }
  return [...list, uploadedFile];
}

/** Filters upload queue items whose completed FileItem is already present in `files`. */
export function filterVisibleUploadQueue(
  uploadQueue: readonly FileUploadProgress[],
  files: readonly FileItem[]
): FileUploadProgress[] {
  if (uploadQueue.length === 0) return [];
  const uploadedIds = new Set(files.map((f) => f.id));
  return uploadQueue.filter((item) => {
    if (item.result?.id && uploadedIds.has(item.result.id)) {
      return false;
    }
    return true;
  });
}

/** Maps a structured FileUploadError code to a bilingual localized message. */
export function formatFileUploadError(
  err: FileUploadError,
  t: (key: string) => string,
  maxSizeMb = DEFAULT_CLIENT_MAX_MB
): string {
  switch (err.code) {
    case "BLOCKED_EXTENSION":
      return t("fileUploadBlockedExt").replace("{ext}", err.ext || "");
    case "BLOCKED_MIME":
      return t("fileUploadBlockedMime");
    case "FILE_TOO_LARGE":
      return t("fileUploadTooLarge")
        .replace("{size}", String(err.sizeMB ?? maxSizeMb))
        .replace("{max}", String(maxSizeMb));
    case "CONVERSATION_INIT_FAILED":
      return err.detail || t("fileUploadInitFailed");
    case "NETWORK_ERROR":
      return t("fileUploadNetworkError");
    case "TIMEOUT":
      return t("fileUploadTimeout");
    case "UPLOAD_FAILED":
    default:
      return err.detail || t("uploadFailed");
  }
}

/** Bilingual relative date formatter for FileManagerPanel (no hardcoded English strings). */
export function formatRelativeFileDate(
  isoDate: string,
  t: (key: string) => string,
  now = Date.now()
): string {
  const then = parseTimestamp(isoDate);
  if (then === null) return t("relativeTimeJustNow");
  const diffMs = Math.max(0, now - then);
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return t("relativeTimeJustNow");
  if (diffMin < 60) return t("relativeTimeMinutesAgo").replace("{count}", String(diffMin));
  if (diffHr < 24) return t("relativeTimeHoursAgo").replace("{count}", String(diffHr));
  if (diffDay === 1) return t("relativeTimeYesterday");
  if (diffDay < 7) return t("relativeTimeDaysAgo").replace("{count}", String(diffDay));
  return new Date(then).toLocaleDateString();
}

export interface ReferenceImageValidationResult {
  accepted: File[];
  invalidTypeCount: number;
  tooLargeCount: number;
  overLimitCount: number;
}

/** Validates image files for Image Studio reference slots / templates. */
export function validateReferenceImages(
  files: readonly File[],
  currentCount: number,
  maxCount = DEFAULT_REF_IMAGE_MAX_COUNT,
  maxBytes = DEFAULT_REF_IMAGE_MAX_BYTES
): ReferenceImageValidationResult {
  const accepted: File[] = [];
  let invalidTypeCount = 0;
  let tooLargeCount = 0;
  let overLimitCount = 0;
  const remaining = Math.max(0, maxCount - currentCount);

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      invalidTypeCount += 1;
      continue;
    }
    if (file.size > maxBytes) {
      tooLargeCount += 1;
      continue;
    }
    if (accepted.length >= remaining) {
      overLimitCount += 1;
      continue;
    }
    accepted.push(file);
  }

  return { accepted, invalidTypeCount, tooLargeCount, overLimitCount };
}
