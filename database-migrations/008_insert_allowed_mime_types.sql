-- Up Migration: Insert missing MIME types into allowed_mime_types table
-- Fix: Include 'kind' column but remove 'extension' as it does not exist

DO $$
BEGIN
    -- Try to insert into allowed_mime_types if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'allowed_mime_types') THEN
        INSERT INTO allowed_mime_types (mime_type, kind) VALUES 
            ('text/typescript', 'text'),
            ('text/tsx', 'text')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Fallback/Alternative table name check (just in case)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mime_types') THEN
        INSERT INTO mime_types (mime_type, kind) VALUES 
             ('text/typescript', 'text'),
            ('text/tsx', 'text')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
