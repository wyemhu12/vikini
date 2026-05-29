/**
 * Unified File Service — Dual Storage (Gemini Files API + Supabase Storage)
 *
 * Upload flow:
 *   1. Validate file (ext, mime, size, security, magic bytes)
 *   2. Upload to Supabase Storage (permanent)
 *   3. Upload to Gemini Files API (48h, for native Gemini processing)
 *   4. Insert DB record with both references + TTL (30 days default)
 *
 * Chat integration:
 *   - Gemini models: use gemini_file_uri (zero re-download)
 *   - Non-Gemini: use extracted_text or download from Supabase for base64
 */

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { getGenAIClient } from "@/lib/core/genaiClient";
import { logger } from "@/lib/utils/logger";
import { pickFirstEnv } from "@/lib/utils/config";
import type {
  FileRow,
  UploadFileParams,
  ListFilesParams,
  GetFileParams,
  FilesConfig,
  CleanupResult,
} from "@/types/files";
import { classifyFile as classifyFileShared, validateFile } from "./fileValidation";

const fileLogger = logger.withContext("fileService");

// ============================================
// CONFIG
// ============================================

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function getFilesConfig(): FilesConfig {
  return {
    bucket:
      pickFirstEnv(["FILES_BUCKET", "ATTACHMENTS_BUCKET", "SUPABASE_ATTACHMENTS_BUCKET"]) ||
      "vikini-files",
    maxFilesPerConversation: toInt(
      pickFirstEnv(["FILES_MAX_PER_CONV", "ATTACH_MAX_FILES_PER_CONV"]),
      30
    ),
    maxTotalBytesPerConversation: toInt(
      pickFirstEnv(["FILES_MAX_BYTES_PER_CONV", "ATTACH_MAX_TOTAL_BYTES_PER_CONV"]),
      100 * 1024 * 1024 // 100MB
    ),
    signedUrlSeconds: toInt(
      pickFirstEnv(["FILES_SIGNED_URL_SECONDS", "ATTACH_SIGNED_URL_SECONDS"]),
      5 * 60
    ),
    ttlDays: toInt(pickFirstEnv(["FILES_TTL_DAYS"]), 30),
  };
}

// ============================================
// FILE CLASSIFICATION
// ============================================

// classifyFile imported from ./fileValidation (single source of truth)
export { classifyFileShared as classifyFile };

// validateFile imported from ./fileValidation (single source of truth)

// ============================================
// QUOTA ENFORCEMENT
// ============================================

async function enforceQuotas(
  userId: string,
  conversationId: string,
  addBytes: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const cfg = getFilesConfig();

  const { data: rows, error } = await supabase
    .from("files")
    .select("id,size_bytes")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`Quota check failed: ${error.message}`);

  const alive = rows || [];
  if (alive.length + 1 > cfg.maxFilesPerConversation) {
    throw new Error("Too many files in this conversation");
  }

  const total = alive.reduce(
    (sum, r) => sum + Number((r as { size_bytes?: number })?.size_bytes || 0),
    0
  );

  // Rank-aware storage limit
  const { getConversationStorageLimit } = await import("@/lib/core/limits");
  const maxBytes = await getConversationStorageLimit(userId);

  if (total + addBytes > maxBytes) {
    throw new Error("Conversation storage quota exceeded");
  }
}

// ============================================
// GEMINI FILES API
// ============================================

/**
 * Upload file to Gemini Files API.
 * Returns { name, uri, expiresAt } or null if upload fails (non-blocking).
 */
async function uploadToGemini(
  fileBytes: Buffer,
  filename: string,
  mimeType: string
): Promise<{ name: string; uri: string; expiresAt: string } | null> {
  try {
    const ai = getGenAIClient();

    // Convert Buffer to Blob for SDK upload (use Uint8Array to satisfy TS)
    const blob = new Blob([new Uint8Array(fileBytes)], { type: mimeType });

    const uploaded = await ai.files.upload({
      file: blob,
      config: {
        mimeType,
        displayName: filename,
      },
    });

    if (!uploaded?.name || !uploaded?.uri) {
      fileLogger.warn(`Gemini upload returned incomplete data for ${filename}`);
      return null;
    }

    // Gemini auto-deletes after 48h
    const expiresAt = new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(); // 47h buffer

    fileLogger.info(`Gemini upload OK: ${filename} → ${uploaded.name}`);

    return {
      name: uploaded.name,
      uri: uploaded.uri,
      expiresAt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    fileLogger.error(`Gemini upload failed for ${filename}: ${message}`);
    return null; // Non-blocking — Supabase is the fallback
  }
}

/**
 * Re-upload a file to Gemini if its URI has expired.
 * Downloads from Supabase Storage, re-uploads to Gemini, updates DB.
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

  // Check if Gemini URI is still valid (with 1h buffer)
  if (row.gemini_file_uri && row.gemini_expires_at) {
    const expiresAt = new Date(row.gemini_expires_at).getTime();
    if (expiresAt > Date.now() + 60 * 60 * 1000) {
      return row; // Still valid
    }
  }

  // Need to re-upload: download from Supabase
  if (!row.storage_path) {
    fileLogger.warn(`Cannot refresh Gemini URI: no storage_path for file ${fileId}`);
    return row;
  }

  const cfg = getFilesConfig();
  const { data: blob, error: dlError } = await supabase.storage
    .from(row.bucket || cfg.bucket)
    .download(row.storage_path);

  if (dlError || !blob) {
    fileLogger.error(`Failed to download from Supabase for re-upload: ${dlError?.message}`);
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

// ============================================
// CORE OPERATIONS
// ============================================

/**
 * Upload a file with dual storage strategy.
 */
export async function uploadFile({
  userId,
  conversationId,
  messageId = null,
  file,
  filename,
}: UploadFileParams): Promise<{ file: FileRow; geminiReady: boolean }> {
  const supabase = getSupabaseAdmin();
  const cfg = getFilesConfig();

  // 1. Validate
  const v = await validateFile(file, filename, userId);

  // 2. Enforce quotas
  await enforceQuotas(userId, conversationId, v.sizeBytes);

  // 3. Read file bytes
  const bytes = Buffer.from(await file.arrayBuffer());

  // 4. Upload to Supabase Storage (permanent)
  const objectName = `${crypto.randomUUID()}-${v.filename}`;
  const storagePath = `${userId}/${conversationId}/${objectName}`;

  const { error: upError } = await supabase.storage.from(cfg.bucket).upload(storagePath, bytes, {
    contentType: v.mime,
    upsert: false,
  });

  if (upError) throw new Error(`Storage upload failed: ${upError.message}`);

  // 5. Upload to Gemini Files API (non-blocking, best-effort)
  const gemini = await uploadToGemini(bytes, v.filename, v.mime);

  // 6. Extract text + estimate tokens for text-kind files
  let extractedText: string | null = null;
  let tokenCount: number | null = null;
  if (v.kind === "text" || v.kind === "document") {
    try {
      const text = bytes.toString("utf8");
      if (text.length > 0 && text.length < 500_000) {
        extractedText = text;
        tokenCount = Math.ceil(text.length / 4);
      }
    } catch {
      // Non-text content — skip extraction
    }
  }

  // 7. Insert DB record
  const { data: row, error: insertError } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      message_id: messageId,
      filename: v.filename,
      mime_type: v.mime,
      size_bytes: v.sizeBytes,
      kind: v.kind,
      gemini_file_name: gemini?.name || null,
      gemini_file_uri: gemini?.uri || null,
      gemini_expires_at: gemini?.expiresAt || null,
      storage_path: storagePath,
      bucket: cfg.bucket,
      expires_at: new Date(Date.now() + cfg.ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      extracted_text: extractedText,
      text_extracted_at: extractedText ? new Date().toISOString() : null,
      token_count: tokenCount,
    })
    .select("*")
    .single();

  if (insertError) {
    // Cleanup storage on DB failure
    try {
      await supabase.storage.from(cfg.bucket).remove([storagePath]);
    } catch {
      /* ignore cleanup errors */
    }
    throw new Error(`DB insert failed: ${insertError.message}`);
  }

  fileLogger.info(`Uploaded: ${v.filename} (${v.kind}, ${v.sizeBytes}B) gemini=${!!gemini}`);

  return {
    file: row as FileRow,
    geminiReady: !!gemini,
  };
}

/**
 * List files for a conversation.
 */
export async function listFiles({ userId, conversationId }: ListFilesParams): Promise<FileRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`List files failed: ${error.message}`);
  return (data || []) as FileRow[];
}

/**
 * Get a single file by ID.
 */
export async function getFile({ userId, id }: GetFileParams): Promise<FileRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Get file failed: ${error.message}`);
  if (!data) throw new Error("File not found");
  return data as FileRow;
}

/**
 * Delete a single file (both storages + DB).
 */
export async function deleteFile({ userId, id }: GetFileParams): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const row = await getFile({ userId, id });
  const cfg = getFilesConfig();

  // Delete from Supabase Storage
  if (row.storage_path) {
    try {
      await supabase.storage.from(row.bucket || cfg.bucket).remove([row.storage_path]);
    } catch (err: unknown) {
      fileLogger.warn(
        `Storage delete failed for ${row.storage_path}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  // Delete from Gemini Files API
  if (row.gemini_file_name) {
    try {
      const ai = getGenAIClient();
      await ai.files.delete({ name: row.gemini_file_name });
    } catch (err: unknown) {
      fileLogger.warn(
        `Gemini delete failed for ${row.gemini_file_name}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  // Delete DB record
  const { error } = await supabase.from("files").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(`DB delete failed: ${error.message}`);

  return { ok: true };
}

/**
 * Delete all files in a conversation.
 */
export async function deleteFilesByConversation(
  userId: string,
  conversationId: string
): Promise<{ ok: boolean; deleted: number }> {
  const supabase = getSupabaseAdmin();
  const cfg = getFilesConfig();

  const { data: rows, error } = await supabase
    .from("files")
    .select("id,storage_path,bucket,gemini_file_name")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`List files for delete failed: ${error.message}`);

  const files = (rows || []) as Array<{
    id: string;
    storage_path?: string;
    bucket?: string;
    gemini_file_name?: string;
  }>;

  // Batch delete from Supabase Storage
  const storagePaths = files.filter((f) => f.storage_path).map((f) => f.storage_path as string);

  if (storagePaths.length > 0) {
    try {
      await supabase.storage.from(cfg.bucket).remove(storagePaths);
    } catch (err: unknown) {
      fileLogger.warn(
        `Batch storage delete failed: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  // Delete from Gemini (one by one — API doesn't support batch)
  const ai = getGenAIClient();
  for (const f of files) {
    if (f.gemini_file_name) {
      try {
        await ai.files.delete({ name: f.gemini_file_name });
      } catch {
        /* ignore */
      }
    }
  }

  // Delete DB records
  const { error: delError } = await supabase
    .from("files")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (delError) throw new Error(`DB delete failed: ${delError.message}`);

  return { ok: true, deleted: files.length };
}

/**
 * Create a signed URL for downloading/previewing a file from Supabase Storage.
 */
export async function createSignedUrl({ userId, id }: GetFileParams): Promise<{
  signedUrl: string;
  filename: string;
  mimeType: string;
}> {
  const supabase = getSupabaseAdmin();
  const row = await getFile({ userId, id });
  const cfg = getFilesConfig();

  if (!row.storage_path) throw new Error("File has no storage path");

  const { data, error } = await supabase.storage
    .from(row.bucket || cfg.bucket)
    .createSignedUrl(row.storage_path, cfg.signedUrlSeconds);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  if (!data?.signedUrl) throw new Error("Signed URL missing");

  return {
    signedUrl: data.signedUrl,
    filename: row.filename,
    mimeType: row.mime_type,
  };
}

/**
 * Download file bytes from Supabase Storage.
 */
export async function downloadFileBytes({
  userId,
  id,
}: GetFileParams): Promise<{ row: FileRow; bytes: Buffer }> {
  const supabase = getSupabaseAdmin();
  const row = await getFile({ userId, id });
  const cfg = getFilesConfig();

  if (!row.storage_path) throw new Error("File has no storage path");

  const { data, error } = await supabase.storage
    .from(row.bucket || cfg.bucket)
    .download(row.storage_path);

  if (error) throw new Error(`Download failed: ${error.message}`);
  if (!data) throw new Error("Download returned no data");

  const bytes = Buffer.from(await data.arrayBuffer());
  return { row, bytes };
}

// ============================================
// BATCH DOWNLOAD (ported from legacy batchDownloadAttachments)
// ============================================

/**
 * Download multiple files with concurrency control.
 */
export async function batchDownloadFiles({
  userId,
  rows,
  concurrency = 3,
}: {
  userId: string;
  rows: FileRow[];
  concurrency?: number;
}): Promise<Array<{ row: FileRow; bytes: Uint8Array | null }>> {
  const results: Array<{ row: FileRow; bytes: Uint8Array | null }> = [];

  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (row) => {
        try {
          const { bytes } = await downloadFileBytes({ userId, id: row.id });
          return { row, bytes: new Uint8Array(bytes) };
        } catch {
          return { row, bytes: null };
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}

// ============================================
// CLEANUP (TTL enforcement)
// ============================================

/**
 * Delete expired files (called by cron job).
 * Processes in batches of 200, up to 10 iterations.
 */
export async function cleanupExpiredFiles(): Promise<CleanupResult> {
  const supabase = getSupabaseAdmin();
  const cfg = getFilesConfig();
  let totalDeleted = 0;
  let totalErrors = 0;

  for (let i = 0; i < 10; i++) {
    const { data: rows, error } = await supabase
      .from("files")
      .select("id,storage_path,bucket,gemini_file_name")
      .lte("expires_at", new Date().toISOString())
      .limit(200);

    if (error) {
      fileLogger.error(`Cleanup query failed: ${error.message}`);
      totalErrors++;
      break;
    }

    if (!rows || rows.length === 0) break;

    const files = rows as Array<{
      id: string;
      storage_path?: string;
      bucket?: string;
      gemini_file_name?: string;
    }>;

    // Batch delete from Supabase Storage (group by bucket)
    const byBucket = new Map<string, string[]>();
    for (const f of files) {
      if (f.storage_path) {
        const bucket = f.bucket || cfg.bucket;
        if (!byBucket.has(bucket)) byBucket.set(bucket, []);
        byBucket.get(bucket)!.push(f.storage_path);
      }
    }

    for (const [bucket, paths] of byBucket) {
      try {
        await supabase.storage.from(bucket).remove(paths);
      } catch (err: unknown) {
        fileLogger.warn(
          `Cleanup storage delete failed for bucket ${bucket}: ${err instanceof Error ? err.message : "unknown"}`
        );
        totalErrors++;
      }
    }

    // Delete from Gemini
    const ai = getGenAIClient();
    for (const f of files) {
      if (f.gemini_file_name) {
        try {
          await ai.files.delete({ name: f.gemini_file_name });
        } catch {
          /* ignore — Gemini may have already auto-deleted */
        }
      }
    }

    // Delete DB records
    const ids = files.map((f) => f.id);
    const { error: delError } = await supabase.from("files").delete().in("id", ids);

    if (delError) {
      fileLogger.error(`Cleanup DB delete failed: ${delError.message}`);
      totalErrors++;
    } else {
      totalDeleted += files.length;
    }

    fileLogger.info(`Cleanup iteration ${i + 1}: deleted ${files.length} files`);

    if (files.length < 200) break; // Last batch
  }

  fileLogger.info(`Cleanup complete: deleted=${totalDeleted}, errors=${totalErrors}`);
  return { deleted: totalDeleted, errors: totalErrors };
}
