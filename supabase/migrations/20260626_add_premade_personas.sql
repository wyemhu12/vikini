-- Add is_premade flag to personas table
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_premade BOOLEAN DEFAULT false;

-- Allow everyone to READ premade personas (system-created templates)
CREATE POLICY "Anyone can view premade personas" ON personas
  FOR SELECT USING (is_premade = true);

-- Index for fast premade queries
CREATE INDEX IF NOT EXISTS idx_personas_is_premade ON personas(is_premade);
