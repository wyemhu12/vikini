-- Deep Research feature tables
-- Adds research_tasks table for tracking async Deep Research operations
-- Adds daily_research_counts for per-user daily limits
-- Updates rank_configs with daily_research_limit column

-- 1. Research tasks table
CREATE TABLE IF NOT EXISTS research_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL,
  query                 TEXT NOT NULL,
  agent_model           TEXT NOT NULL DEFAULT 'deep-research-preview-04-2026',
  plan_text             TEXT,
  report_text           TEXT,
  status                TEXT NOT NULL DEFAULT 'planning'
                        CHECK (status IN ('planning', 'ready_to_execute', 'executing', 'completed', 'failed')),
  plan_interaction_id   TEXT,
  exec_interaction_id   TEXT,
  conversation_id       UUID REFERENCES conversations(id) ON DELETE SET NULL,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  gem_id                UUID REFERENCES gems(id) ON DELETE SET NULL,
  error_message         TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE research_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_research_tasks_user_id ON research_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks(status);
CREATE INDEX IF NOT EXISTS idx_research_tasks_conversation_id ON research_tasks(conversation_id);

-- Auto-update updated_at trigger
CREATE TRIGGER set_research_tasks_updated_at
  BEFORE UPDATE ON research_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Daily research counts table (mirrors daily_message_counts pattern)
CREATE TABLE IF NOT EXISTS daily_research_counts (
  user_id   TEXT NOT NULL,
  date      DATE NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE daily_research_counts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_daily_research_counts_user_date
  ON daily_research_counts(user_id, date);

-- 3. Add daily_research_limit column to rank_configs
ALTER TABLE rank_configs
  ADD COLUMN IF NOT EXISTS daily_research_limit INTEGER NOT NULL DEFAULT 0;

-- Set default limits: admin=9999, pro=5, basic=1
UPDATE rank_configs SET daily_research_limit = 9999 WHERE rank = 'admin';
UPDATE rank_configs SET daily_research_limit = 5 WHERE rank = 'pro';
UPDATE rank_configs SET daily_research_limit = 1 WHERE rank = 'basic';
UPDATE rank_configs SET daily_research_limit = 0 WHERE rank = 'not_whitelisted';

-- 4. Add deep_research feature flag to existing rank_configs
UPDATE rank_configs
SET features = features || '{"deep_research": true}'::jsonb
WHERE rank IN ('admin', 'pro');

UPDATE rank_configs
SET features = features || '{"deep_research": false}'::jsonb
WHERE rank IN ('basic', 'not_whitelisted');
