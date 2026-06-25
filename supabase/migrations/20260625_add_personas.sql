-- Create personas table
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  tone VARCHAR(50) DEFAULT 'default',
  use_emojis BOOLEAN DEFAULT true,
  use_headers_lists BOOLEAN DEFAULT true,
  user_context TEXT DEFAULT '',
  custom_instructions TEXT DEFAULT '',
  icon VARCHAR(100) DEFAULT '',
  color VARCHAR(50) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add persona_id to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id) ON DELETE SET NULL;

-- RLS policies
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas" ON personas FOR SELECT USING (user_id = current_setting('request.jwt.claims')::json->>'email');
CREATE POLICY "Users can insert own personas" ON personas FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims')::json->>'email');
CREATE POLICY "Users can update own personas" ON personas FOR UPDATE USING (user_id = current_setting('request.jwt.claims')::json->>'email');
CREATE POLICY "Users can delete own personas" ON personas FOR DELETE USING (user_id = current_setting('request.jwt.claims')::json->>'email');

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_persona_id ON conversations(persona_id);
