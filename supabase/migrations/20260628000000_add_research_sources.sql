-- Adds sources column to research_tasks to store citation metadata independently
ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS sources JSONB;
