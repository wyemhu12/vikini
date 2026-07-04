/**
 * File System Types - Dual Storage (Gemini Files API + Supabase Storage)
 */

// ============================================
// FILE ROW (DB record)
// ============================================

export type FileKind = "image" | "video" | "audio" | "document" | "text" | "archive" | "other";

export interface FileRow {
  id: string;
  user_id: string;
  conversation_id: string;
  message_id: string | null;

  // Metadata
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind: FileKind;

  // Gemini Files API
  gemini_file_name: string | null;
  gemini_file_uri: string | null;
  gemini_expires_at: string | null;

  // Supabase Storage
  storage_path: string | null;
  bucket: string;

  // Text extraction cache
  extracted_text: string | null;
  text_extracted_at: string | null;

  // TTL
  expires_at?: string | null;
  token_count?: number | null;

  // Lifecycle
  created_at: string;
  updated_at: string;
}

// ============================================
// UPLOAD
// ============================================

export interface UploadFileParams {
  userId: string;
  conversationId: string;
  messageId?: string | null;
  file: File;
  filename?: string;
}

export interface UploadFileResult {
  file: FileRow;
  geminiReady: boolean;
}

// ============================================
// QUERY
// ============================================

export interface ListFilesParams {
  userId: string;
  conversationId: string;
}

export interface GetFileParams {
  userId: string;
  id: string;
}

// ============================================
// CONFIG
// ============================================

export interface FilesConfig {
  bucket: string;
  maxFilesPerConversation: number;
  maxTotalBytesPerConversation: number;
  signedUrlSeconds: number;
  ttlDays: number;
}

// ============================================
// CLIENT-SIDE (for UI)
// ============================================

export interface FileItem {
  id: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  kind: FileKind;
  created_at: string;
  conversation_id: string;
  gemini_ready: boolean;
}

// ============================================
// Added in Phase 1: Unified File System
// ============================================

/** File validation result (returned by validateFile on success; throws on failure). */
export interface FileValidationResult {
  filename: string;
  ext: string;
  mime: string;
  kind: FileKind;
  sizeBytes: number;
}

/** File support level for UI display */
export type FileSupportLevel = "best" | "basic" | "blocked" | "unknown";

/** File category for UI help tooltip. */
export interface FileCategory {
  labelKey: string;
  descriptionKey: string;
  extensions: readonly string[];
  icon: string;
}

/** Upload progress tracking (client-side) */
export interface FileUploadProgress {
  tempId: string;
  file: File;
  filename: string;
  size: number;
  kind: FileKind;
  progress: number;
  status: "queued" | "uploading" | "processing" | "ready" | "error";
  error?: string;
  result?: FileItem;
}

/** Cleanup result from cron */
export interface CleanupResult {
  deleted: number;
  errors: number;
}
