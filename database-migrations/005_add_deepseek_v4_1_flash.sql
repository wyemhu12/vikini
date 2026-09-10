-- =====================================================================================
-- Add DeepSeek V4.1 Flash to Rank Configs
-- =====================================================================================
-- Version: 005
-- Date: 2026-09-10
-- Model: deepseek/deepseek-v4.1-flash (OpenRouter / Fireworks)
-- =====================================================================================

-- Example update: Add 'deepseek/deepseek-v4.1-flash' to admin rank if not present
UPDATE rank_configs
SET allowed_models = allowed_models || '["deepseek/deepseek-v4.1-flash"]'::jsonb
WHERE rank = 'admin'
  AND NOT (allowed_models @> '["deepseek/deepseek-v4.1-flash"]'::jsonb);

-- Verification:
-- SELECT rank, allowed_models FROM rank_configs ORDER BY rank;
