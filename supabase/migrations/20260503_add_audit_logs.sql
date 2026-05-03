-- Migration: Create admin_audit_logs table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  admin_email TEXT,
  target_id TEXT,
  target_email TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);

-- Enable RLS (access only via service_role)
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- No policies needed - accessed only via service_role (server-side)
