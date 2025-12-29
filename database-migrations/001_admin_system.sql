-- =====================================================================================
-- Admin System Migration
-- =====================================================================================
-- Creates tables for user profiles, rank configurations, and daily message tracking
-- Version: 001
-- Date: 2025-12-29
-- =====================================================================================

-- =====================================================================================
-- TABLE: profiles
-- Stores user profiles with rank and blocked status
-- =====================================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  rank TEXT NOT NULL DEFAULT 'basic' CHECK (rank IN ('basic', 'pro', 'admin')),
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_rank ON profiles(rank);
CREATE INDEX IF NOT EXISTS idx_profiles_is_blocked ON profiles(is_blocked) WHERE is_blocked = true;

-- Comment
COMMENT ON TABLE profiles IS 'User profiles with rank-based permissions';
COMMENT ON COLUMN profiles.rank IS 'User rank: basic, pro, or admin';
COMMENT ON COLUMN profiles.is_blocked IS 'Whether user is blocked from accessing the system';

-- =====================================================================================
-- TABLE: rank_configs
-- Stores configuration for each rank (limits and features)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS rank_configs (
  rank TEXT PRIMARY KEY CHECK (rank IN ('basic', 'pro', 'admin')),
  daily_message_limit INTEGER NOT NULL,
  max_file_size_mb INTEGER NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment
COMMENT ON TABLE rank_configs IS 'Configuration for each user rank (limits and features)';
COMMENT ON COLUMN rank_configs.daily_message_limit IS 'Maximum messages per day for this rank';
COMMENT ON COLUMN rank_configs.max_file_size_mb IS 'Maximum file upload size in MB';
COMMENT ON COLUMN rank_configs.features IS 'JSON object with feature flags (web_search, unlimited_gems, etc.)';

-- Initial data for rank_configs
INSERT INTO rank_configs (rank, daily_message_limit, max_file_size_mb, features) VALUES
  ('basic', 20, 5, '{"web_search": false, "unlimited_gems": false}'::jsonb),
  ('pro', 100, 50, '{"web_search": true, "unlimited_gems": false}'::jsonb),
  ('admin', 9999, 100, '{"web_search": true, "unlimited_gems": true}'::jsonb)
ON CONFLICT (rank) DO NOTHING;

-- =====================================================================================
-- TABLE: daily_message_counts
-- Tracks daily message usage per user for limit enforcement
-- =====================================================================================
CREATE TABLE IF NOT EXISTS daily_message_counts (
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_daily_message_counts_user_date ON daily_message_counts(user_id, date);

-- Comment
COMMENT ON TABLE daily_message_counts IS 'Tracks daily message usage per user';
COMMENT ON COLUMN daily_message_counts.count IS 'Number of messages sent on this date';

-- =====================================================================================
-- TRIGGER: Update updated_at timestamp automatically
-- =====================================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for rank_configs
DROP TRIGGER IF EXISTS update_rank_configs_updated_at ON rank_configs;
CREATE TRIGGER update_rank_configs_updated_at
  BEFORE UPDATE ON rank_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================
-- Uncomment to verify after running:
-- SELECT * FROM rank_configs ORDER BY rank;
-- SELECT COUNT(*) as profile_count FROM profiles;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'rank_configs', 'daily_message_counts');
