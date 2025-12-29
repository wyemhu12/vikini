-- Up Migration: Update allowed_mime_types for vikini-attachments bucket to include TypeScript types
-- We use array concatenation to ensure we don't remove existing types, and verify the bucket exists.

DO $$
BEGIN
    UPDATE storage.buckets
    SET allowed_mime_types = array(
        SELECT DISTINCT UNNEST(allowed_mime_types || ARRAY[
            'text/typescript',
            'application/typescript',
            'video/mp2t',
            'text/plain' -- Ensure basic text is always there
        ])
    )
    WHERE id = 'vikini-attachments';
END $$;
