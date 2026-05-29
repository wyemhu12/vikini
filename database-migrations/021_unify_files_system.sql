-- =============================================
-- Migration 021: Unify file system
-- - Add TTL support to files table
-- - Drop legacy attachments table
-- - Drop deprecated allowed_mime_types table
-- =============================================

-- 1. Add expires_at column for TTL (30-day default set by application)
ALTER TABLE files ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Add token_count for estimated token tracking
ALTER TABLE files ADD COLUMN IF NOT EXISTS token_count INTEGER;

-- 3. Create index for TTL cleanup cron
CREATE INDEX IF NOT EXISTS idx_files_expires_at
  ON files(expires_at) WHERE expires_at IS NOT NULL;

-- 4. Drop legacy attachments table (data not migrated per decision)
DROP TABLE IF EXISTS attachments CASCADE;

-- 5. Drop deprecated allowed_mime_types table
DROP TABLE IF EXISTS allowed_mime_types CASCADE;
