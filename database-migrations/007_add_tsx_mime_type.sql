-- Up Migration: Update allowed_mime_types for vikini-attachments bucket to include TSX types

DO $$
BEGIN
    UPDATE storage.buckets
    SET allowed_mime_types = array(
        SELECT DISTINCT UNNEST(allowed_mime_types || ARRAY[
            'text/tsx'
        ])
    )
    WHERE id = 'vikini-attachments';
END $$;
