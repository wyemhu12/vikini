-- Rollback Migration: 20261012000000_rollback_rls_security_audit_cycle_2.sql
-- Description: Rollback script for 20261012000000_rls_security_audit_cycle_2.sql
-- Note: Placed in database-migrations/rollback/ to prevent automatic execution by Supabase CLI

BEGIN;

-- 1. Khôi phục quyền EXECUTE cho 4 hàm RPC
GRANT EXECUTE ON FUNCTION increment_daily_message_count(TEXT, DATE) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_daily_research_count(TEXT, DATE) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_project_storage_bytes(UUID) TO PUBLIC, anon, authenticated;

-- 2. Khôi phục 5 policies trên personas
CREATE POLICY "Users can view own personas" ON personas
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own personas" ON personas
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own personas" ON personas
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own personas" ON personas
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Anyone can view premade personas" ON personas
  FOR SELECT USING (is_premade = true);

GRANT ALL ON TABLE personas TO anon, authenticated;

COMMIT;
