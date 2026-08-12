-- =====================================================================================
-- Normalize userId: profiles.id from providerAccountId to email
-- =====================================================================================
-- CONTEXT:
-- profiles.id was previously set to Google providerAccountId (e.g. "115107433714263238238")
-- This migration changes profiles.id to use email (lowercased) as the canonical identity.
--
-- WHY: The codebase was split between email and providerAccountId for user identity,
-- creating potential cross-system inconsistencies in ownership, rate limiting, and audit.
--
-- IMPACT: After this migration, profiles.id = profiles.email (lowercased).
-- All application code must use email as the canonical userId.
--
-- Version: 022
-- Date: 2026-08-12
-- =====================================================================================

-- STEP 0: Safety check — ensure no duplicate emails (should be enforced by UNIQUE constraint)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM (SELECT LOWER(email) FROM profiles GROUP BY LOWER(email) HAVING COUNT(*) > 1) sub) > 0 THEN
    RAISE EXCEPTION 'Duplicate emails found in profiles table. Cannot proceed with migration.';
  END IF;
END $$;

-- STEP 1: Fix gems data BEFORE changing profiles.id
-- Admin-created gems have user_id = providerAccountId (numeric string)
-- User-created gems already have user_id = email
-- Identify by: providerAccountId is numeric, email contains '@'
UPDATE gems
SET user_id = p.email
FROM profiles p
WHERE gems.user_id = p.id
  AND gems.user_id NOT LIKE '%@%'
  AND p.email IS NOT NULL;

-- Fix created_by in gem_versions (same pattern)
UPDATE gem_versions
SET created_by = p.email
FROM profiles p
WHERE gem_versions.created_by = p.id
  AND gem_versions.created_by NOT LIKE '%@%'
  AND p.email IS NOT NULL;

-- STEP 2: Fix admin_audit_logs (admin_id and target_id may contain providerAccountId)
UPDATE admin_audit_logs
SET admin_id = p.email
FROM profiles p
WHERE admin_audit_logs.admin_id = p.id
  AND admin_audit_logs.admin_id NOT LIKE '%@%'
  AND p.email IS NOT NULL;

UPDATE admin_audit_logs
SET target_id = p.email
FROM profiles p
WHERE admin_audit_logs.target_id = p.id
  AND admin_audit_logs.target_id NOT LIKE '%@%'
  AND p.email IS NOT NULL;

-- STEP 3: Change profiles.id from providerAccountId to email
-- Since email is UNIQUE NOT NULL, this is safe.
-- Must use a 2-pass approach to avoid PK conflicts during update.

-- 3a: Add a temporary column to hold the new id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS new_id TEXT;
UPDATE profiles SET new_id = LOWER(email);

-- 3b: Verify no conflicts
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM (SELECT new_id FROM profiles GROUP BY new_id HAVING COUNT(*) > 1) sub) > 0 THEN
    RAISE EXCEPTION 'Duplicate new_id values detected. Cannot proceed.';
  END IF;
END $$;

-- 3c: Drop PK, update id, re-add PK
ALTER TABLE profiles DROP CONSTRAINT profiles_pkey;
UPDATE profiles SET id = new_id;
ALTER TABLE profiles ADD PRIMARY KEY (id);
ALTER TABLE profiles DROP COLUMN new_id;

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================
-- After running, verify:
-- SELECT id, email FROM profiles LIMIT 10;
-- All id values should now be email addresses (lowercased).
--
-- SELECT user_id FROM gems WHERE user_id NOT LIKE '%@%';
-- Should return 0 rows (all user_id values are now emails).
--
-- SELECT created_by FROM gem_versions WHERE created_by NOT LIKE '%@%' AND created_by IS NOT NULL;
-- Should return 0 rows.
