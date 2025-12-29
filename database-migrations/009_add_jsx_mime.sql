-- Up Migration: Insert text/jsx into allowed_mime_types table
-- Adds proper support for JSX file uploads

DO $$
BEGIN
    -- Insert into allowed_mime_types if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'allowed_mime_types') THEN
        INSERT INTO allowed_mime_types (mime_type, kind) VALUES 
            ('text/jsx', 'text')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Fallback for mime_types table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mime_types') THEN
        INSERT INTO mime_types (mime_type, kind) VALUES 
            ('text/jsx', 'text')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
