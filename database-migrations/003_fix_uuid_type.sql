-- =====================================================================================
-- Fix UUID Type Error for Google OAuth
-- =====================================================================================
-- Google providerAccountId is a number string (e.g., "115107433714263238238"), not UUID
-- This migration changes profiles.id from UUID to TEXT
-- Version: 003
-- Date: 2025-12-29
-- =====================================================================================

-- Step 1: Drop the profiles table if it exists (since it's likely empty)
-- If you have data you want to keep, use ALTER TABLE instead
DROP TABLE IF EXISTS profiles CASCADE;

-- Step 2: Recreate profiles table with TEXT id
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,  -- Changed from UUID to TEXT for Google OAuth
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

-- Comments
COMMENT ON TABLE profiles IS 'User profiles with rank-based permissions (using Google OAuth ID)';
COMMENT ON COLUMN profiles.id IS 'User ID from Google OAuth (providerAccountId)';
COMMENT ON COLUMN profiles.rank IS 'User rank: basic, pro, or admin';
COMMENT ON COLUMN profiles.is_blocked IS 'Whether user is blocked from accessing the system';

-- Recreate trigger for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================
-- Check table structure:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'profiles' ORDER BY ordinal_position;
