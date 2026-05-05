-- Migration 020: Create files table (dual-storage: Gemini Files API + Supabase Storage)
-- Replaces the old 'attachments' table with richer metadata

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  conversation_id UUID NOT NULL,
  message_id UUID NULL,

  -- File metadata
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'other', -- 'image' | 'video' | 'audio' | 'document' | 'text' | 'archive' | 'other'

  -- Gemini Files API references
  gemini_file_name TEXT NULL,          -- e.g., "files/abc123" (for ai.files.get/delete)
  gemini_file_uri TEXT NULL,           -- full URI for createPartFromUri()
  gemini_expires_at TIMESTAMPTZ NULL,  -- 48h auto-delete from Gemini

  -- Supabase Storage references (permanent fallback)
  storage_path TEXT NULL,              -- path in Supabase Storage bucket
  bucket TEXT DEFAULT 'vikini-files',

  -- Text extraction cache (for non-Gemini providers)
  extracted_text TEXT NULL,
  text_extracted_at TIMESTAMPTZ NULL,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_files_conversation ON files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_gemini_expiry ON files(gemini_expires_at)
  WHERE gemini_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);

-- NOTE on Row Level Security:
-- This project uses email (e.g. "user@gmail.com") as user_id, NOT Supabase auth.uid() (UUID).
-- All queries go through the supabase admin client (service_role key) which bypasses RLS.
-- Server-side enforcement is done in fileService.server.ts (every query filters by user_id).
-- This is consistent with the conversations, messages, and attachments tables.
-- DO NOT add auth.uid() based RLS policies — they would be incorrect and would block
-- operations if accidentally used with a non-admin client.
