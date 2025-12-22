// /lib/features/attachments/attachments.js

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/core/supabase";

// Re-export for backward compatibility
export { getSupabaseAdmin };
import { pickFirstEnv } from "@/lib/utils/config";

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toBytes(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function getAttachmentsConfig() {
  return {
    bucket: pickFirstEnv(["ATTACHMENTS_BUCKET", "SUPABASE_ATTACHMENTS_BUCKET"]) || "vikini-attachments",
    ttlHours: toInt(pickFirstEnv(["ATTACHMENTS_TTL_HOURS", "ATTACH_TTL_HOURS"]), 36),

    maxTextBytes: toBytes(pickFirstEnv(["ATTACH_MAX_TEXT_BYTES"]), 2 * 1024 * 1024),
    maxImageBytes: toBytes(pickFirstEnv(["ATTACH_MAX_IMAGE_BYTES"]), 10 * 1024 * 1024),

    maxDocBytes: toBytes(pickFirstEnv(["ATTACH_MAX_DOC_BYTES"]), 20 * 1024 * 1024),

    maxFilesPerConversation: toInt(pickFirstEnv(["ATTACH_MAX_FILES_PER_CONV"]), 20),
    maxTotalBytesPerConversation: toBytes(pickFirstEnv(["ATTACH_MAX_TOTAL_BYTES_PER_CONV"]), 50 * 1024 * 1024),

    signedUrlSeconds: toInt(pickFirstEnv(["ATTACH_SIGNED_URL_SECONDS"]), 5 * 60),
  };
}

const ALLOWED_TEXT_MIMES = new Set([
  "text/plain",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "text/jsx",
  "application/json",
  "text/json",
]);

const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

const ALLOWED_DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTS = new Set([
  "txt",
  "js",
  "jsx",
  "json",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

export function sanitizeFilename(name) {
  const raw = String(name || "file").trim();
  const cleaned = raw
    .replace(/[\\\/]+/g, "_")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, 200)
    .trim();
  return cleaned || "file";
}

function getExt(filename) {
  const n = safeLower(filename);
  const idx = n.lastIndexOf(".");
  if (idx === -1) return "";
  return n.slice(idx + 1);
}

async function sniffImageMime(file) {
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

export async function validateUpload({ file, filename }) {
  const cfg = getAttachmentsConfig();
  if (!file) throw new Error("Missing file");

  const safeName = sanitizeFilename(filename || file.name || "file");
  const ext = getExt(safeName);
  if (!ALLOWED_EXTS.has(ext)) throw new Error("File type not allowed");

  const mime = safeLower(file.type || "");
  const size = Number(file.size || 0);

  const isTextExt = ["txt", "js", "jsx", "json"].includes(ext);
  const isImageExt = ["png", "jpg", "jpeg", "webp"].includes(ext);
  const isDocExt = ["pdf", "doc", "docx", "xls", "xlsx"].includes(ext);

  if (isTextExt) {
    if (size > cfg.maxTextBytes) throw new Error("Text file too large");
    if (mime && !ALLOWED_TEXT_MIMES.has(mime) && mime !== "application/octet-stream") {
      throw new Error("Text MIME not allowed");
    }
    const defaultTextMime = ext === "json" ? "application/json" : "text/plain";
    return { kind: "text", filename: safeName, ext, mime: mime || defaultTextMime, sizeBytes: size };
  }

  if (isImageExt) {
    if (size > cfg.maxImageBytes) throw new Error("Image too large");

    const sniffed = await sniffImageMime(file);
    const effectiveMime = sniffed || mime;
    if (!ALLOWED_IMAGE_MIMES.has(effectiveMime)) throw new Error("Image MIME not allowed");

    return { kind: "image", filename: safeName, ext, mime: effectiveMime, sizeBytes: size };
  }

  if (isDocExt) {
    if (size > cfg.maxDocBytes) throw new Error("Document file too large");
    if (mime && !ALLOWED_DOC_MIMES.has(mime) && mime !== "application/octet-stream") {
      throw new Error("Document MIME not allowed");
    }

    const defaultDocMime =
      ext === "pdf"
        ? "application/pdf"
        : ext === "doc"
          ? "application/msword"
          : ext === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : ext === "xls"
              ? "application/vnd.ms-excel"
              : ext === "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/octet-stream";

    return { kind: "doc", filename: safeName, ext, mime: mime || defaultDocMime, sizeBytes: size };
  }

  throw new Error("File type not allowed");
}

export async function enforceConversationQuotas({ supabase, userId, conversationId, addBytes }) {
  const cfg = getAttachmentsConfig();
  const nowTs = Date.now();

  const { data: rows, error } = await supabase
    .from("attachments")
    .select("id,size_bytes,expires_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`Quota check failed: ${error.message}`);

  const alive = (rows || []).filter((r) => {
    const exp = r?.expires_at ? Date.parse(r.expires_at) : Infinity;
    return Number.isFinite(exp) ? exp > nowTs : true;
  });

  const count = alive.length;
  const total = alive.reduce((sum, r) => sum + Number(r?.size_bytes || 0), 0);

  if (count + 1 > cfg.maxFilesPerConversation) {
    throw new Error("Too many files in this conversation");
  }

  if (total + Number(addBytes || 0) > cfg.maxTotalBytesPerConversation) {
    throw new Error("Conversation storage quota exceeded");
  }
}

export async function listAttachmentsForConversation({ userId, conversationId }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("attachments")
    .select("id,conversation_id,message_id,filename,mime_type,size_bytes,created_at,expires_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listAttachments failed: ${error.message}`);
  return data || [];
}

export async function getAttachmentById({ userId, id }) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`getAttachment failed: ${error.message}`);
  if (!data) throw new Error("Not found");
  return data;
}

export async function uploadAttachment({ userId, conversationId, messageId = null, file, filename }) {
  const supabase = getSupabaseAdmin();
  const cfg = getAttachmentsConfig();

  const v = await validateUpload({ file, filename });

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
    } catch {}
    throw new Error(`DB insert failed: ${ins.error.message}`);
  }

  return ins.data;
}

export async function createSignedUrlForAttachmentId({ userId, id }) {
  const supabase = getSupabaseAdmin();
  const row = await getAttachmentById({ userId, id });

  const bucket = row?.bucket || getAttachmentsConfig().bucket;
  const seconds = getAttachmentsConfig().signedUrlSeconds;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, seconds);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  if (!data?.signedUrl) throw new Error("Signed URL missing");

  return { signedUrl: data.signedUrl, filename: row.filename, mimeType: row.mime_type, expiresAt: row.expires_at };
}

export async function downloadAttachmentBytes({ userId, id }) {
  const supabase = getSupabaseAdmin();
  const row = await getAttachmentById({ userId, id });
  const bucket = row?.bucket || getAttachmentsConfig().bucket;

  const { data, error } = await supabase.storage.from(bucket).download(row.storage_path);
  if (error) throw new Error(`Download failed: ${error.error.message}`);
  if (!data) throw new Error("Download missing");

  const bytes = Buffer.from(await data.arrayBuffer());
  return { row, bytes };
}

export async function deleteAttachmentById({ userId, id }) {
  const supabase = getSupabaseAdmin();
  const row = await getAttachmentById({ userId, id });
  const bucket = row?.bucket || getAttachmentsConfig().bucket;

  const rm = await supabase.storage.from(bucket).remove([row.storage_path]);
  if (rm.error) throw new Error(`Storage delete failed: ${rm.error.message}`);

  const del = await supabase.from("attachments").delete().eq("id", id).eq("user_id", userId);
  if (del.error) throw new Error(`DB delete failed: ${del.error.message}`);

  return { ok: true };
}

export async function deleteAttachmentsByConversation({ userId, conversationId }) {
  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("attachments")
    .select("id,bucket,storage_path")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw new Error(`List attachments failed: ${error.error.message}`);

  const byBucket = new Map();
  for (const r of rows || []) {
    const bucket = r?.bucket || getAttachmentsConfig().bucket;
    const arr = byBucket.get(bucket) || [];
    if (r?.storage_path) arr.push(r.storage_path);
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
