-- =====================================================================================
-- Add Model Selection Feature to Rank Configs
-- =====================================================================================
-- Adds 'allowed_models' column to store which models each rank can use
-- Version: 004
-- Date: 2025-12-29
-- =====================================================================================

-- Add allowed_models column to rank_configs
ALTER TABLE rank_configs 
ADD COLUMN IF NOT EXISTS allowed_models JSONB NOT NULL DEFAULT '["gemini-2.5-flash"]'::jsonb;

-- Update existing ranks with default model permissions (based on latest Dec 2024 models)
UPDATE rank_configs SET allowed_models = '["gemini-2.5-flash"]'::jsonb WHERE rank = 'basic';
UPDATE rank_configs SET allowed_models = '["gemini-2.5-flash", "gemini-2.5-pro", "llama-3.3-70b-versatile"]'::jsonb WHERE rank = 'pro';
UPDATE rank_configs SET allowed_models = '["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3-pro-preview", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]'::jsonb WHERE rank = 'admin';

-- Add comment
COMMENT ON COLUMN rank_configs.allowed_models IS 'Array of model IDs this rank can access';

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================
-- SELECT rank, allowed_models FROM rank_configs ORDER BY rank;
