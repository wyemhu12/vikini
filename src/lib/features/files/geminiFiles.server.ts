// src/lib/features/files/geminiFiles.server.ts
/**
 * Gemini Files API Integration & Lifecycle Management
 *
 * Dedicated server-only service for uploading, polling, and refreshing
 * native Gemini multimodal file URIs.
 */

import { getGenAIClient } from "@/lib/core/genaiClient";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";
import { pickFirstEnv } from "@/lib/utils/config";
import type { FileRow } from "@/types/files";
import { isGeminiNativeMime } from "./fileValidation";

const geminiLogger = logger.withContext("geminiFiles.server");

export interface GeminiUploadResult {
  name: string;
  uri: string;
  expiresAt: string;
}

/**
 * Upload file to Gemini Files API if MIME type is natively supported.
 * Returns null for non-whitelisted types or on failure.
 */
export async function uploadToGemini(
  fileBytes: Buffer,
  filename: string,
  mimeType: string
): Promise<GeminiUploadResult | null> {
  // Guard: Only upload natively supported MIME types
  if (!isGeminiNativeMime(mimeType)) {
    geminiLogger.debug(`Skipping Gemini upload for non-native MIME: ${filename} (${mimeType})`);
    return null;
  }

  try {
    const ai = getGenAIClient();
    const blob = new Blob([new Uint8Array(fileBytes)], { type: mimeType });

    const uploaded = await ai.files.upload({
      file: blob,
      config: {
        mimeType,
        displayName: filename,
      },
    });

    if (!uploaded?.name || !uploaded?.uri) {
      geminiLogger.warn(`Gemini upload returned incomplete data for ${filename}`);
      return null;
    }

    // Gemini auto-deletes after 48h (47h safe buffer)
    const expiresAt = new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString();
    geminiLogger.info(`Gemini upload OK: ${filename} → ${uploaded.name}`);

    return {
      name: uploaded.name,
      uri: uploaded.uri,
      expiresAt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    geminiLogger.error(`Gemini upload failed for ${filename}: ${message}`);
    return null;
  }
}

/**
 * Polling helper to check if an uploaded file has transitioned to ACTIVE state.
 * Required for large videos and PDFs that require background processing.
 */
export async function waitForGeminiFileActive(
  fileName: string,
  timeoutMs: number = 15000,
  signal?: AbortSignal
): Promise<{ ready: boolean; state: string }> {
  const startTime = Date.now();
  const intervalMs = 1500;

  try {
    const ai = getGenAIClient();

    while (Date.now() - startTime < timeoutMs) {
      if (signal?.aborted) {
        return { ready: false, state: "ABORTED" };
      }

      const filesClient = ai.files as unknown as {
        get: (params: { name: string; config?: unknown }) => Promise<{ state?: string }>;
      };
      const fileInfo = await filesClient.get({
        name: fileName,
        config: signal ? { abortSignal: signal } : undefined,
      });

      const state = String(fileInfo?.state || "UNKNOWN").toUpperCase();

      if (state === "ACTIVE") {
        return { ready: true, state: "ACTIVE" };
      }

      if (state === "FAILED") {
        geminiLogger.warn(`Gemini file processing FAILED: ${fileName}`);
        return { ready: false, state: "FAILED" };
      }

      // Wait interval before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    geminiLogger.warn(`Gemini file ACTIVE polling timed out after ${timeoutMs}ms: ${fileName}`);
    return { ready: false, state: "TIMEOUT" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    geminiLogger.warn(`waitForGeminiFileActive error: ${msg}`);
    return { ready: false, state: "ERROR" };
  }
}

/**
 * Re-upload a file to Gemini if its URI has expired or is nearing expiration (<1h).
 * Downloads from Supabase Storage and updates the database record.
 */
export async function refreshGeminiUri(fileId: string, userId: string): Promise<FileRow | null> {
  const supabase = getSupabaseAdmin();

  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !file) return null;
  const row = file as FileRow;

  // Guard: If file is not native Gemini MIME, do not re-upload
  if (!isGeminiNativeMime(row.mime_type)) {
    return row;
  }

  // Check if Gemini URI is still valid (with 1h buffer)
  if (row.gemini_file_uri && row.gemini_expires_at) {
    const expiresAt = new Date(row.gemini_expires_at).getTime();
    if (expiresAt > Date.now() + 60 * 60 * 1000) {
      return row; // Still valid
    }
  }

  if (!row.storage_path) {
    geminiLogger.warn(`Cannot refresh Gemini URI: no storage_path for file ${fileId}`);
    return row;
  }

  const bucket =
    row.bucket ||
    pickFirstEnv(["FILES_BUCKET", "ATTACHMENTS_BUCKET", "SUPABASE_ATTACHMENTS_BUCKET"]) ||
    "vikini-files";

  const { data: blob, error: dlError } = await supabase.storage
    .from(bucket)
    .download(row.storage_path);

  if (dlError || !blob) {
    geminiLogger.error(`Failed to download from Supabase for Gemini refresh: ${dlError?.message}`);
    return row;
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const gemini = await uploadToGemini(bytes, row.filename, row.mime_type);

  if (gemini) {
    await supabase
      .from("files")
      .update({
        gemini_file_name: gemini.name,
        gemini_file_uri: gemini.uri,
        gemini_expires_at: gemini.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId);

    return {
      ...row,
      gemini_file_name: gemini.name,
      gemini_file_uri: gemini.uri,
      gemini_expires_at: gemini.expiresAt,
    };
  }

  return row;
}
