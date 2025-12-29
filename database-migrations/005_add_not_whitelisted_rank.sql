-- =====================================================================================
-- Add "Not Whitelisted" Rank for Manual Approval Workflow
-- =====================================================================================
-- Adds a new rank 'not_whitelisted' for users pending admin approval
-- Version: 005
-- Date: 2025-12-29
-- =====================================================================================

-- Add the new rank to rank_configs
INSERT INTO rank_configs (rank, daily_message_limit, max_file_size_mb, features, allowed_models)
VALUES (
  'not_whitelisted',
  0,  -- No messages allowed
  0,  -- No file uploads allowed
  '{"web_search": false, "unlimited_gems": false}'::jsonb,
  '[]'::jsonb  -- No models allowed
)
ON CONFLICT (rank) DO UPDATE SET
  daily_message_limit = 0,
  max_file_size_mb = 0,
  features = '{"web_search": false, "unlimited_gems": false}'::jsonb,
  allowed_models = '[]'::jsonb;

-- Update check constraint to include new rank
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rank_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_rank_check 
  CHECK (rank IN ('not_whitelisted', 'basic', 'pro', 'admin'));

-- Add comment
COMMENT ON TABLE rank_configs IS 'Rank configurations including not_whitelisted for manual approval workflow';

-- =====================================================================================
-- Optional: Update existing 'basic' users if needed
-- =====================================================================================
-- If you want to reset all current 'basic' users to pending approval, uncomment:
-- UPDATE profiles SET rank = 'not_whitelisted' WHERE rank = 'basic';

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================
-- SELECT * FROM rank_configs ORDER BY 
--   CASE rank 
--     WHEN 'not_whitelisted' THEN 0
--     WHEN 'basic' THEN 1 
--     WHEN 'pro' THEN 2 
--     WHEN 'admin' THEN 3 
--   END;
