import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError, ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import type { ResolvedReferenceImage } from "./core/types";

const storageLogger = logger.withContext("referenceImageStorage");

export const MAX_STUDIO_REF_IMAGE_BYTES = 40 * 1024 * 1024; // 40 MB
export const MAX_STUDIO_REF_IMAGE_COUNT = 4;
export const REFERENCE_IMAGE_BUCKET = "attachments";

export const ALLOWED_REF_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedRefImageMime = (typeof ALLOWED_REF_IMAGE_MIME_TYPES)[number];

const MIME_TO_EXTENSION: Record<AllowedRefImageMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const REF_SUFFIX_REGEX =
  /^ref-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif)$/i;

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Generates an ASCII-only temporary reference image path strictly scoped to
 * `${userId}/${conversationId}/ref-<uuid>.<ext>`.
 */
export function buildReferenceImageStoragePath(
  userId: string,
  conversationId: string,
  mimeType: AllowedRefImageMime
): string {
  const ext = MIME_TO_EXTENSION[mimeType];
  return `${userId}/${conversationId}/ref-${crypto.randomUUID()}.${ext}`;
}

function isValidTempRefPath(cleanPath: string, userId: string, conversationId: string): boolean {
  if (!cleanPath || hasControlChar(cleanPath) || cleanPath.includes("\\")) {
    return false;
  }
  if (cleanPath.includes("..")) {
    return false;
  }
  const ownerPrefix = `${userId}/${conversationId}/`;
  if (!cleanPath.startsWith(ownerPrefix)) {
    return false;
  }
  const suffix = cleanPath.slice(ownerPrefix.length);
  return REF_SUFFIX_REGEX.test(suffix);
}

/**
 * Validates reference image storage paths against IDOR, path traversal,
 * and non-temporary object access.
 */
export function validateReferenceImagePaths(
  paths: readonly string[],
  userId: string,
  conversationId: string
): string[] {
  if (paths.length > MAX_STUDIO_REF_IMAGE_COUNT) {
    throw new ValidationError(`Maximum ${MAX_STUDIO_REF_IMAGE_COUNT} reference images allowed`);
  }

  const ownerPrefix = `${userId}/${conversationId}/`;
  const validated: string[] = [];

  for (const rawPath of paths) {
    if (typeof rawPath !== "string") {
      throw new ValidationError("Invalid reference image path");
    }
    const cleanPath = rawPath.trim();
    if (
      !cleanPath ||
      hasControlChar(cleanPath) ||
      cleanPath.includes("\\") ||
      cleanPath.includes("..")
    ) {
      throw new ValidationError("Invalid reference image path");
    }
    if (!cleanPath.startsWith(ownerPrefix)) {
      throw new ForbiddenError("Reference image path does not belong to this conversation");
    }
    const suffix = cleanPath.slice(ownerPrefix.length);
    if (!REF_SUFFIX_REGEX.test(suffix)) {
      throw new ValidationError("Invalid reference image path format");
    }
    validated.push(cleanPath);
  }

  return validated;
}

/**
 * Detects supported image MIME type by inspecting magic byte signatures.
 * Returns null for unrecognized or spoofed content (HTML, SVG, EXE, etc.).
 */
export function detectImageMimeFromBytes(bytes: Uint8Array): AllowedRefImageMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
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
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: GIF87a or GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
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

  return null;
}

/**
 * Downloads validated reference images from Supabase Storage, enforcing OOM-safe
 * size bounds before buffer allocation and verifying real image magic bytes.
 */
export async function downloadReferenceImagesFromStorage(
  supabase: SupabaseClient,
  validatedPaths: readonly string[]
): Promise<ResolvedReferenceImage[]> {
  const resolved: ResolvedReferenceImage[] = [];

  for (const storagePath of validatedPaths) {
    const { data, error } = await supabase.storage
      .from(REFERENCE_IMAGE_BUCKET)
      .download(storagePath);

    if (error || !data) {
      storageLogger.warn("Failed to download reference image:", { storagePath, error });
      throw new ValidationError("Reference image not found or could not be loaded");
    }

    // OOM Guard: check Blob size BEFORE allocating ArrayBuffer in serverless memory
    if (data.size <= 0 || data.size > MAX_STUDIO_REF_IMAGE_BYTES) {
      throw new ValidationError("Reference image exceeds 40MB limit or is empty");
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.byteLength <= 0 || buffer.byteLength > MAX_STUDIO_REF_IMAGE_BYTES) {
      throw new ValidationError("Reference image exceeds 40MB limit or is empty");
    }

    const detectedMime = detectImageMimeFromBytes(buffer);
    if (!detectedMime) {
      throw new ValidationError("Unsupported or invalid reference image content");
    }

    resolved.push({
      buffer,
      mimeType: detectedMime,
      sizeBytes: buffer.byteLength,
      filename: storagePath.split("/").pop(),
    });
  }

  return resolved;
}

/**
 * Fail-safe cleanup for temporary reference images in Supabase Storage.
 * Re-validates ownership prefix before removing and never throws.
 */
export async function cleanupTempReferenceImages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  paths: readonly string[]
): Promise<void> {
  if (!paths || paths.length === 0) return;

  const safePaths = paths
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => isValidTempRefPath(p, userId, conversationId));

  if (safePaths.length === 0) return;

  try {
    const { error } = await supabase.storage.from(REFERENCE_IMAGE_BUCKET).remove(safePaths);
    if (error) {
      storageLogger.warn("Failed to remove temporary reference images:", {
        count: safePaths.length,
        error: error.message,
      });
    }
  } catch (err: unknown) {
    storageLogger.warn("Exception while removing temporary reference images:", err);
  }
}
