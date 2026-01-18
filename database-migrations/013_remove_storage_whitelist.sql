-- Up Migration: Remove storage whitelist (Allow all types)
-- This removes strict MIME type validation from the bucket
DO $$
BEGIN
    UPDATE storage.buckets
    SET allowed_mime_types = NULL
    WHERE id = 'vikini-attachments';
END $$;
