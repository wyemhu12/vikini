// src/types/attachments.d.ts
// Centralized type definitions for attachments feature

export interface AttachmentsConfig {
  bucket: string;
  ttlHours: number;
  maxTextBytes: number;
  maxImageBytes: number;
  maxDocBytes: number;
  maxZipBytes: number;
  maxFilesPerConversation: number;
  maxTotalBytesPerConversation: number;
  signedUrlSeconds: number;
  uploadUrlSeconds: number;
}

export interface ValidateUploadResult {
  kind: "text" | "image" | "doc" | "zip" | "other";
  filename: string;
  ext: string;
  mime: string;
  sizeBytes: number;
}

export interface AttachmentRow {
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

export interface AttachmentBytesResult {
  row: AttachmentRow;
  bytes: Buffer;
}

export interface SignedUrlResult {
  signedUrl: string;
  filename?: string;
  mimeType?: string;
  expiresAt?: string;
}

export interface SignedUploadUrlResult {
  signedUrl: string;
  token: string;
  path: string;
  filename: string;
  mimeType: string;
}

export interface CompleteUploadParams {
  userId: string;
  conversationId: string;
  path: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ValidateUploadParams {
  file: File;
  filename?: string;
  userId: string;
}

export interface EnforceQuotasParams {
  supabase: unknown; // SupabaseClient
  userId: string;
  conversationId: string;
  addBytes: number;
}

export interface ListAttachmentsParams {
  userId: string;
  conversationId: string;
}

export interface GetAttachmentParams {
  userId: string;
  id: string;
}

export interface UploadAttachmentParams {
  userId: string;
  conversationId: string;
  messageId?: string | null;
  file: File;
  filename?: string;
}

export interface CreateSignedUrlParams {
  userId: string;
  id: string;
}

export type FileSupportLevel = "best" | "basic" | "blocked" | "unknown";
