-- database-migrations/20261001000000_clean_corrupted_extracted_text.sql
-- Cleans up corrupted binary text extracted from binary documents (.docx, .xlsx, .pdf, .doc, .xls, .ppt)
-- Prior code called bytes.toString('utf8') on binary documents, polluting extracted_text with PK.. or raw binary headers.
-- Clearing extracted_text for kind = 'document' triggers clean lazy-reparsing with mammoth, exceljs, and pdf-parse.

UPDATE files
SET
  extracted_text = NULL,
  token_count = NULL,
  text_extracted_at = NULL
WHERE
  kind = 'document'
  AND (
    extracted_text IS NOT NULL
    OR token_count IS NOT NULL
  );

-- Also add comment explaining the hygiene rule
COMMENT ON COLUMN files.extracted_text IS 'Cached clean extracted plain text. Must not contain raw binary or NUL characters.';
