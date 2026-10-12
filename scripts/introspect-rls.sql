-- Script: scripts/introspect-rls.sql
-- Purpose: Read-only introspection of SECURITY DEFINER functions, RLS policies, and storage buckets
-- Run in Supabase SQL Editor / CLI to ground truth database state

-- 1. Introspect all SECURITY DEFINER functions in schema 'public'
SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true
  AND n.nspname = 'public'
ORDER BY p.proname;

-- 2. Introspect RLS policies for relevant tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('daily_message_counts', 'daily_research_counts', 'research_tasks', 'personas', 'conversations', 'messages', 'projects')
ORDER BY tablename, policyname;

-- 3. Introspect storage buckets privacy setting
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
ORDER BY name;

-- 4. Check schema of pgvector extension
SELECT 
    e.extname,
    n.nspname AS schema_name,
    e.extversion
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname = 'vector';
