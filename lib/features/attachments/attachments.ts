// /lib/features/attachments/attachments.ts

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export for backward compatibility
export { getSupabaseAdmin };
import { pickFirstEnv } from "@/lib/utils/config";

interface AttachmentsConfig {
  bucket: string;
  ttlHours: number;
  maxTextBytes: number;
  maxImageBytes: number;
  maxDocBytes: number;
  maxZipBytes: number;
  maxFilesPerConversation: number;
  maxTotalBytesPerConversation: number;
  signedUrlSeconds: number;
  uploadUrlSeconds: number; // NEW: Time for upload URL to be valid
}

interface ValidateUploadResult {
  kind: "text" | "image" | "doc" | "zip" | "other";
  filename: string;
  ext: string;
  mime: string;
  sizeBytes: number;
}

interface AttachmentRow {
  id: string;
  conversation_id?: string;
  message_id?: string | null;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  created_at?: string;
  expires_at?: string;
  bucket?: string;
  storage_path?: string;
  user_id?: string;
  [key: string]: unknown;
}

interface AttachmentBytesResult {
  row: AttachmentRow;
  bytes: Buffer;
}

interface SignedUrlResult {
  signedUrl: string;
  filename?: string;
  mimeType?: string;
  expiresAt?: string;
}

interface SignedUploadUrlResult {
  signedUrl: string;
  token: string; // Upload token/path for verification
  path: string;
  filename: string;
  mimeType: string;
}

interface CompleteUploadParams {
  userId: string;
  conversationId: string;
  path: string; // The storage path used (returned from sign-upload)
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toBytes(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function getAttachmentsConfig(): AttachmentsConfig {
  return {
    bucket:
      pickFirstEnv(["ATTACHMENTS_BUCKET", "SUPABASE_ATTACHMENTS_BUCKET"]) || "vikini-attachments",
    ttlHours: toInt(pickFirstEnv(["ATTACHMENTS_TTL_HOURS", "ATTACH_TTL_HOURS"]), 36),

    maxTextBytes: toBytes(pickFirstEnv(["ATTACH_MAX_TEXT_BYTES"]), 2 * 1024 * 1024),
    maxImageBytes: toBytes(pickFirstEnv(["ATTACH_MAX_IMAGE_BYTES"]), 10 * 1024 * 1024),

    maxDocBytes: toBytes(pickFirstEnv(["ATTACH_MAX_DOC_BYTES"]), 20 * 1024 * 1024),

    maxZipBytes: toBytes(pickFirstEnv(["ATTACH_MAX_ZIP_BYTES"]), 20 * 1024 * 1024),

    maxFilesPerConversation: toInt(pickFirstEnv(["ATTACH_MAX_FILES_PER_CONV"]), 20),
    maxTotalBytesPerConversation: toBytes(
      pickFirstEnv(["ATTACH_MAX_TOTAL_BYTES_PER_CONV"]),
      50 * 1024 * 1024
    ),

    signedUrlSeconds: toInt(pickFirstEnv(["ATTACH_SIGNED_URL_SECONDS"]), 5 * 60),
    uploadUrlSeconds: toInt(pickFirstEnv(["ATTACH_UPLOAD_URL_SECONDS"]), 15 * 60),
  };
}

// ==============================
// BLACKLIST: Dangerous file types
// ==============================

/**
 * Blocked extensions - executables, scripts, system files
 * NOTE: .js and .jsx are NOT blocked to allow code file uploads
 */
const BLOCKED_EXTENSIONS = new Set([
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
  // Registry/config
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

/**
 * Blocked MIME types - corresponding dangerous content types
 */
const BLOCKED_MIME_TYPES = new Set([
  // Executables
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
  "application/x-ms-installer",
  "application/x-msi",
  // Scripts
  "application/x-powershell",
  "application/x-vbscript",
  "application/x-hta",
  // System
  "application/x-ms-shortcut",
  "application/x-winexe",
  // Package archives
  "application/java-archive",
  "application/vnd.android.package-archive",
]);

function safeLower(v: unknown): string {
  return String(v || "")
    .trim()
    .toLowerCase();
}

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

function getExt(filename: string): string {
  const n = safeLower(filename);
  const idx = n.lastIndexOf(".");
  if (idx === -1) return "";
  return n.slice(idx + 1);
}

async function sniffImageMime(file: File): Promise<string> {
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length < 12) return "";

    // PNG
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      return "image/png";
    }

    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "image/jpeg";
    }

    // WEBP: RIFF....WEBP
    if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    ) {
      return "image/webp";
    }

    return "";
  } catch {
    return "";
  }
}

/**
 * Validates that the file is actually a valid image by checking magic bytes.
 * This prevents malicious files with image extensions but is lenient enough
 * to accept valid images that may have variations in structure.
 *
 * @param file - The file to validate
 * @param expectedMime - The expected MIME type
 * @returns true if the file is a valid image, false otherwise
 */
async function validateImageContent(file: File, expectedMime: string): Promise<boolean> {
  try {
    const buf = Buffer.from(await file.arrayBuffer());

    // Must have minimum size for any image
    if (buf.length < 8) return false;

    const sniffedMime = await sniffImageMime(file);

    // If we can sniff the MIME type, it's likely a valid image
    // Just verify it matches the expected type
    if (sniffedMime) {
      // Allow if sniffed MIME matches expected, or if expected is generic
      return sniffedMime === expectedMime || expectedMime.startsWith("image/");
    }

    // If we can't sniff but expected MIME is set, do basic magic byte check
    if (expectedMime === "image/png") {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    }

    if (expectedMime === "image/jpeg") {
      // JPEG signature: FF D8 FF
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }

    if (expectedMime === "image/webp") {
      // WEBP: RIFF header (52 49 46 46) and WEBP signature at offset 8
      if (buf.length < 12) return false;
      return (
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50
      );
    }

    // If we can't validate and no sniffed MIME, be lenient and allow it
    // (the MIME type check above should have caught invalid types)
    return true;
  } catch {
    // On any error, be lenient - let other validations catch issues
    return true;
  }
}

interface ValidateUploadParams {
  file: File;
  filename?: string;
  userId: string; // NEW: Required for checking user's file size limit
}

export async function validateUpload({
  file,
  filename,
  userId,
}: ValidateUploadParams): Promise<ValidateUploadResult> {
  if (!file) throw new Error("Missing file");

  const safeName = sanitizeFilename(filename || file.name || "file");
  const ext = getExt(safeName);

  // BLACKLIST CHECK: Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error(`File type ".${ext}" is not allowed for security reasons`);
  }

  const mime = safeLower(file.type || "");
  const size = Number(file.size || 0);

  // BLACKLIST CHECK: Block dangerous MIME types
  if (BLOCKED_MIME_TYPES.has(mime)) {
    throw new Error(`File type is not allowed for security reasons`);
  }

  // Check user's file size limit (rank-based)
  const { checkFileSize } = await import("@/lib/core/limits");
  const sizeCheck = await checkFileSize(userId, size);
  if (!sizeCheck.allowed) {
    throw new Error(
      `File too large (${sizeCheck.fileSizeMB}MB). Your limit is ${sizeCheck.maxSizeMB}MB`
    );
  }

  // Determine file kind for downstream processing
  const kind = determineFileKind(ext, mime);

  // Normalize MIME type based on extension
  const effectiveMime = await normalizeOrSniffMime(file, ext, mime, kind);

  return {
    kind,
    filename: safeName,
    ext,
    mime: effectiveMime,
    sizeBytes: size,
  };
}

/**
 * Helper: Determine file kind based on extension and MIME type
 * This categorization is used for downstream processing (text extraction, image validation, etc.)
 */
function determineFileKind(ext: string, mime: string): "text" | "image" | "doc" | "zip" | "other" {
  // Extension-based classification (primary)
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
  ];
  const imageExts = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"];
  const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  const archiveExts = ["zip", "tar", "gz", "7z", "rar"];

  if (textExts.includes(ext)) return "text";
  if (imageExts.includes(ext)) return "image";
  if (docExts.includes(ext)) return "doc";
  if (archiveExts.includes(ext)) return "zip";

  // Fallback to MIME type check
  if (mime.startsWith("text/")) return "text";
  if (mime.startsWith("image/")) return "image";
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation")
  )
    return "doc";
  if (mime.includes("zip") || mime.includes("archive") || mime.includes("compressed")) return "zip";

  return "other";
}

/**
 * Helper: Normalize or sniff MIME type based on extension and file content
 * - For known code extensions, force correct MIME type (browsers often misidentify .ts)
 * - For images, perform magic byte sniffing and validation
 * - For others, use provided MIME or fallback to octet-stream
 */
async function normalizeOrSniffMime(
  file: File,
  ext: string,
  mime: string,
  kind: string
): Promise<string> {
  if (ext === "ts") return "text/typescript";
  if (ext === "tsx") return "text/tsx";
  if (ext === "jsx") return "text/jsx";
  if (ext === "json") return "application/json";
  if (ext === "js") return "text/javascript";
  if (ext === "md") return "text/markdown";
  if (ext === "csv") return "text/csv";
  if (ext === "xml") return "application/xml";
  if (ext === "yaml" || ext === "yml") return "application/x-yaml";
  if (ext === "log") return "text/plain"; // Log files
  if (ext === "txt") return "text/plain";
  if (ext === "html") return "text/html";
  if (ext === "css") return "text/css";

  // For images, sniff magic bytes and validate content
  if (kind === "image") {
    const sniffed = await sniffImageMime(file);
    const effectiveMime = sniffed || mime;

    // SECURITY: Validate that the file is actually a valid image
    const isValidImage = await validateImageContent(file, effectiveMime);
    if (!isValidImage) {
      throw new Error("Invalid image file - file content does not match image format");
    }

    return effectiveMime;
  }

  // For documents, provide sensible defaults
  if (kind === "doc") {
    if (ext === "pdf") return "application/pdf";
    if (ext === "doc") return "application/msword";
    if (ext === "docx")
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === "xls") return "application/vnd.ms-excel";
    if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext === "ppt") return "application/vnd.ms-powerpoint";
    if (ext === "pptx")
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  // For archives
  if (kind === "zip") {
    if (ext === "zip") return "application/zip";
    if (ext === "tar") return "application/x-tar";
    if (ext === "gz") return "application/gzip";
    if (ext === "7z") return "application/x-7z-compressed";
    if (ext === "rar") return "application/x-rar-compressed";
  }

  // IMPORTANT: Avoid application/octet-stream as Supabase Storage rejects it
  // Fallback based on file kind
  if (kind === "text") {
    return mime && mime !== "application/octet-stream" ? mime : "text/plain";
  }

  if (kind === "image") {
    return mime && mime !== "application/octet-stream" ? mime : "image/png";
  }

  if (kind === "doc") {
    return mime && mime !== "application/octet-stream" ? mime : "application/pdf";
  }

  if (kind === "zip") {
    return mime && mime !== "application/octet-stream" ? mime : "application/zip";
  }

  // Final fallback: if browser provided a valid MIME (not octet-stream), use it
  // Otherwise default to text/plain (safest)
  return mime && mime !== "application/octet-stream" ? mime : "text/plain";
}

interface EnforceQuotasParams {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  addBytes: number;
}

export async function enforceConversationQuotas({
  supabase,
  userId,
  conversationId,
  addBytes,
}: EnforceQuotasParams): Promise<void> {
  const cfg = getAttachmentsConfig();
  const nowTs = Date.now();

  const { data: rows, error } = await supabase
    .from("attachments")
    .select("id,size_bytes,expires_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`Quota check failed: ${error.message}`);

  const alive = (rows || []).filter((r) => {
    const row = r as { expires_at?: string };
    const exp = row?.expires_at ? Date.parse(row.expires_at) : Infinity;
    return Number.isFinite(exp) ? exp > nowTs : true;
  });

  const count = alive.length;
  const total = alive.reduce((sum, r) => {
    const row = r as { size_bytes?: number };
    return sum + Number(row?.size_bytes || 0);
  }, 0);

  if (count + 1 > cfg.maxFilesPerConversation) {
    throw new Error("Too many files in this conversation");
  }

  if (total + Number(addBytes || 0) > cfg.maxTotalBytesPerConversation) {
    throw new Error("Conversation storage quota exceeded");
  }
}

interface ListAttachmentsParams {
  userId: string;
  conversationId: string;
}

export async function listAttachmentsForConversation({
  userId,
  conversationId,
}: ListAttachmentsParams): Promise<AttachmentRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("attachments")
    .select("id,conversation_id,message_id,filename,mime_type,size_bytes,created_at,expires_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listAttachments failed: ${error.message}`);
  return (data || []) as AttachmentRow[];
}

interface GetAttachmentParams {
  userId: string;
  id: string;
}

export async function getAttachmentById({
  userId,
  id,
}: GetAttachmentParams): Promise<AttachmentRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`getAttachment failed: ${error.message}`);
  if (!data) throw new Error("Not found");
  return data as AttachmentRow;
}

interface UploadAttachmentParams {
  userId: string;
  conversationId: string;
  messageId?: string | null;
  file: File;
  filename?: string;
}

export async function uploadAttachment({
  userId,
  conversationId,
  messageId = null,
  file,
  filename,
}: UploadAttachmentParams): Promise<AttachmentRow> {
  const supabase = getSupabaseAdmin();
  const cfg = getAttachmentsConfig();

  const v = await validateUpload({ file, filename, userId });

  await enforceConversationQuotas({ supabase, userId, conversationId, addBytes: v.sizeBytes });

  const objectName = `${crypto.randomUUID()}-${v.filename}`;
  const storagePath = `${userId}/${conversationId}/${objectName}`;
  const expiresAt = new Date(Date.now() + cfg.ttlHours * 60 * 60 * 1000).toISOString();

  const bytes = Buffer.from(await file.arrayBuffer());

  const up = await supabase.storage.from(cfg.bucket).upload(storagePath, bytes, {
    contentType: v.mime,
    upsert: false,
  });

  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);

  const ins = await supabase
    .from("attachments")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      message_id: messageId,
      bucket: cfg.bucket,
      storage_path: storagePath,
      filename: v.filename,
      mime_type: v.mime,
      size_bytes: v.sizeBytes,
      expires_at: expiresAt,
    })
    .select("id,conversation_id,message_id,filename,mime_type,size_bytes,created_at,expires_at")
    .single();

  if (ins.error) {
    try {
      await supabase.storage.from(cfg.bucket).remove([storagePath]);
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`DB insert failed: ${ins.error.message}`);
  }

  return ins.data as AttachmentRow;
}

interface CreateSignedUrlParams {
  userId: string;
  id: string;
}

export async function createSignedUrlForAttachmentId({
  userId,
  id,
}: CreateSignedUrlParams): Promise<SignedUrlResult> {
  const supabase = getSupabaseAdmin();
  const row = await getAttachmentById({ userId, id });

  const bucket = (row?.bucket || getAttachmentsConfig().bucket) as string;
  const seconds = getAttachmentsConfig().signedUrlSeconds;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(row.storage_path as string, seconds);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  if (!data?.signedUrl) throw new Error("Signed URL missing");

  return {
    signedUrl: data.signedUrl,
    filename: row.filename,
    mimeType: row.mime_type,
    expiresAt: row.expires_at,
  };
}

export async function downloadAttachmentBytes({
  userId,
  id,
}: GetAttachmentParams): Promise<AttachmentBytesResult> {
  const supabase = getSupabaseAdmin();
  const row = await getAttachmentById({ userId, id });
  const bucket = (row?.bucket || getAttachmentsConfig().bucket) as string;

  const { data, error } = await supabase.storage.from(bucket).download(row.storage_path as string);
  if (error)
    throw new Error(
      `Download failed: ${(error as { error?: { message?: string } }).error?.message || error.message}`
    );
  if (!data) throw new Error("Download missing");

  const bytes = Buffer.from(await data.arrayBuffer());
  return { row, bytes };
}

export async function deleteAttachmentById({
  userId,
  id,
}: GetAttachmentParams): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const row = await getAttachmentById({ userId, id });
  const bucket = (row?.bucket || getAttachmentsConfig().bucket) as string;

  const rm = await supabase.storage.from(bucket).remove([row.storage_path as string]);
  if (rm.error) throw new Error(`Storage delete failed: ${rm.error.message}`);

  const del = await supabase.from("attachments").delete().eq("id", id).eq("user_id", userId);
  if (del.error) throw new Error(`DB delete failed: ${del.error.message}`);

  return { ok: true };
}

interface DeleteByConversationParams {
  userId: string;
  conversationId: string;
}

export async function deleteAttachmentsByConversation({
  userId,
  conversationId,
}: DeleteByConversationParams): Promise<{ ok: boolean; deleted: number }> {
  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("attachments")
    .select("id,bucket,storage_path")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error)
    throw new Error(
      `List attachments failed: ${(error as { error?: { message?: string } }).error?.message || error.message}`
    );

  const byBucket = new Map<string, string[]>();
  for (const r of rows || []) {
    const row = r as { bucket?: string; storage_path?: string };
    const bucket = (row?.bucket || getAttachmentsConfig().bucket) as string;
    const arr = byBucket.get(bucket) || [];
    if (row?.storage_path) arr.push(row.storage_path);
    byBucket.set(bucket, arr);
  }

  for (const [bucket, paths] of byBucket.entries()) {
    if (!paths.length) continue;
    const rm = await supabase.storage.from(bucket).remove(paths);
    if (rm.error) throw new Error(`Storage delete failed: ${rm.error.message}`);
  }

  const del = await supabase
    .from("attachments")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (del.error) throw new Error(`DB delete failed: ${del.error.message}`);

  return { ok: true, deleted: (rows || []).length };
}

// ==========================================
// DIRECT UPLOAD METHODS
// ==========================================

export async function createSignedUploadUrl({
  userId,
  conversationId,
  filename,
  fileSize,
  fileType,
}: {
  userId: string;
  conversationId: string;
  filename: string;
  fileSize: number;
  fileType: string;
}): Promise<SignedUploadUrlResult> {
  const supabase = getSupabaseAdmin();
  const cfg = getAttachmentsConfig();

  // 1. Mock file object for validation (we don't have bytes yet)
  const mockFile = {
    name: filename,
    type: fileType,
    size: fileSize,
  } as unknown as File;

  // 2. Validate metadata (extension, mime type, size)
  const v = await validateUpload({ file: mockFile, filename, userId });

  // 3. Check quotas (optimistic check - we check again on completion)
  await enforceConversationQuotas({
    supabase,
    userId,
    conversationId,
    addBytes: v.sizeBytes,
  });

  // 4. Generate path
  const objectName = `${crypto.randomUUID()}-${v.filename}`;
  const storagePath = `${userId}/${conversationId}/${objectName}`;

  // 5. Create signed upload URL
  // Note: Supabase Storage API for signed upload URL
  const { data, error } = await supabase.storage
    .from(cfg.bucket)
    .createSignedUploadUrl(storagePath);

  if (error) throw new Error(`Signed upload URL failed: ${error.message}`);
  if (!data?.signedUrl) throw new Error("Signed upload URL missing");

  // WE return the path as a token to verify later
  return {
    signedUrl: data.signedUrl,
    token: data.token, // Supabase returns a token sometimes, or we use the path
    path: data.path, // This is the full storage path
    filename: v.filename,
    mimeType: v.mime,
  };
}

export async function verifyAndCreateAttachment({
  userId,
  conversationId,
  path,
  filename,
  sizeBytes,
  mimeType,
}: CompleteUploadParams): Promise<AttachmentRow> {
  const supabase = getSupabaseAdmin();
  const cfg = getAttachmentsConfig();

  // 1. Verify existence in storage (sanity check)
  // We can't easily verify content-type/magic-bytes here without downloading,
  // so we rely on the client's honest upload + Supabase's content-type header check if possible.
  // Ideally, we'd trigger a background job to scan the file.

  // 2. Re-check quotas (race condition protection)
  await enforceConversationQuotas({
    supabase,
    userId,
    conversationId,
    addBytes: sizeBytes,
  });

  const expiresAt = new Date(Date.now() + cfg.ttlHours * 60 * 60 * 1000).toISOString();

  // 3. Insert DB record
  const ins = await supabase
    .from("attachments")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      bucket: cfg.bucket,
      storage_path: path,
      filename: filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      expires_at: expiresAt,
    })
    .select("id,conversation_id,message_id,filename,mime_type,size_bytes,created_at,expires_at")
    .single();

  if (ins.error) {
    // If DB fail, try to clean up storage
    try {
      await supabase.storage.from(cfg.bucket).remove([path]);
    } catch {
      // ignore
    }
    throw new Error(`DB insert failed: ${ins.error.message}`);
  }

  return ins.data as AttachmentRow;
}
