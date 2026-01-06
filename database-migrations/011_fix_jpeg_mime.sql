-- Up Migration: Fix image/jpeg support
-- 1. Add image/jpeg to vikini-attachments bucket configuration
DO $$
BEGIN
    UPDATE storage.buckets
    SET allowed_mime_types = array(
        SELECT DISTINCT UNNEST(allowed_mime_types || ARRAY[
            'image/jpeg'
        ])
    )
    WHERE id = 'vikini-attachments';
END $$;

-- 2. Add image/jpeg to allowed_mime_types table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'allowed_mime_types') THEN
        INSERT INTO allowed_mime_types (mime_type, kind) VALUES 
            ('image/jpeg', 'image')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
