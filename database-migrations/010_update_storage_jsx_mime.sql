-- Up Migration: Update allowed_mime_types for vikini-attachments bucket to include JSX types
-- Similar to 006 and 007, this updates the Supabase Storage Bucket configuration

DO $$
BEGIN
    UPDATE storage.buckets
    SET allowed_mime_types = array(
        SELECT DISTINCT UNNEST(allowed_mime_types || ARRAY[
            'text/jsx'
        ])
    )
    WHERE id = 'vikini-attachments';
END $$;
