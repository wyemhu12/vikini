-- =====================================================================================
-- Migrate Rank Configs from Gemini 2.5 (Shutdown 2026-12-01) to Gemini 3.5 Flash-Lite & 3.8 Flash
-- =====================================================================================
-- Version: 20261103000000
-- Date: 2026-11-03
-- Models:
--   gemini-2.5-flash -> gemini-3.5-flash-lite (DEFAULT_MODEL, granted to basic/pro/admin)
--   gemini-2.5-pro   -> gemini-3.8-flash      (granted to admin and ranks holding gemini-2.5-pro)
-- =====================================================================================

BEGIN;

ALTER TABLE rank_configs ALTER COLUMN allowed_models SET DEFAULT '["gemini-3.5-flash-lite"]'::jsonb;

UPDATE rank_configs
SET allowed_models = allowed_models || '["gemini-3.5-flash-lite"]'::jsonb
WHERE (rank IN ('basic', 'pro', 'admin') OR allowed_models @> '["gemini-2.5-flash"]'::jsonb)
  AND NOT (allowed_models @> '["gemini-3.5-flash-lite"]'::jsonb);

UPDATE rank_configs
SET allowed_models = allowed_models || '["gemini-3.8-flash"]'::jsonb
WHERE (rank = 'admin' OR allowed_models @> '["gemini-2.5-pro"]'::jsonb)
  AND NOT (allowed_models @> '["gemini-3.8-flash"]'::jsonb);

UPDATE rank_configs
SET allowed_models = (allowed_models - 'gemini-2.5-flash') - 'gemini-2.5-pro'
WHERE allowed_models ? 'gemini-2.5-flash' OR allowed_models ? 'gemini-2.5-pro';

COMMIT;

-- Verification:
-- SELECT rank, allowed_models FROM rank_configs ORDER BY rank;
