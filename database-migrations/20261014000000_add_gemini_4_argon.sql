-- =====================================================================================
-- Add Gemini 4 Argon to Rank Configs
-- =====================================================================================
-- Version: 20261014000000
-- Date: 2026-10-14
-- Model: gemini-4-argon (Google Gemini API)
-- Rationale: Flagship Gemini 4 reasoning model ($2.00/M in, $10.00/M out intro pricing)
--            granted to 'admin' and 'pro' ranks
-- =====================================================================================

UPDATE rank_configs
SET allowed_models = allowed_models || '["gemini-4-argon"]'::jsonb
WHERE rank IN ('admin', 'pro')
  AND NOT (allowed_models @> '["gemini-4-argon"]'::jsonb);

-- Verification:
-- SELECT rank, allowed_models FROM rank_configs ORDER BY rank;
