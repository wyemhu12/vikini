-- Migration: 20261012000000_rls_security_audit_cycle_2.sql
-- Description: Hardening RLS policies and locking 4 SECURITY DEFINER RPC functions
-- Approved by Lead Reviewer (Claude Code CLI Audit Run 9)

BEGIN;

-- 1. Khóa chặt 4 RPC SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION increment_daily_message_count(TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_daily_message_count(TEXT, DATE) TO service_role;
ALTER FUNCTION increment_daily_message_count(TEXT, DATE) SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION increment_daily_research_count(TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_daily_research_count(TEXT, DATE) TO service_role;
ALTER FUNCTION increment_daily_research_count(TEXT, DATE) SET search_path = public, pg_temp;

-- match_project_knowledge: BẮT BUỘC giữ extensions trong search_path cho pgvector (<=>, vector)
REVOKE EXECUTE ON FUNCTION match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER) TO service_role;
ALTER FUNCTION match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION get_project_storage_bytes(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_project_storage_bytes(UUID) TO service_role;
ALTER FUNCTION get_project_storage_bytes(UUID) SET search_path = public, pg_temp;

-- 2. Củng cố Deny-by-Default cho các bảng nhạy cảm
ALTER TABLE daily_message_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE daily_message_counts FROM anon, authenticated;

ALTER TABLE daily_research_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE daily_research_counts FROM anon, authenticated;

ALTER TABLE research_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE research_tasks FROM anon, authenticated;

-- 3. Xóa bỏ toàn bộ 5 permissive policies trên personas
DROP POLICY IF EXISTS "Users can view own personas" ON personas;
DROP POLICY IF EXISTS "Users can insert own personas" ON personas;
DROP POLICY IF EXISTS "Users can update own personas" ON personas;
DROP POLICY IF EXISTS "Users can delete own personas" ON personas;
DROP POLICY IF EXISTS "Anyone can view premade personas" ON personas;
REVOKE ALL ON TABLE personas FROM anon, authenticated;

COMMIT;
