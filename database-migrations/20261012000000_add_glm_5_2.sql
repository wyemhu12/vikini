-- =====================================================================================
-- Add GLM 5.2 to Rank Configs
-- =====================================================================================
-- Version: 20261012000000
-- Date: 2026-10-12
-- Model: z-ai/glm-5.2 (Z.ai via OpenRouter)
-- Rationale: High-capability reasoning model ($7.00/M output) granted to 'admin' and 'pro' ranks
-- =====================================================================================

UPDATE rank_configs
SET allowed_models = allowed_models || '["z-ai/glm-5.2"]'::jsonb
WHERE rank IN ('admin', 'pro')
  AND NOT (allowed_models @> '["z-ai/glm-5.2"]'::jsonb);

-- Verification:
-- SELECT rank, allowed_models FROM rank_configs ORDER BY rank;
