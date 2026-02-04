-- Fix embedding dimension mismatch
-- The original migration created VECTOR(3072) which only accepts gemini-embedding-001
-- This migration removes the dimension constraint to support both:
-- - text-embedding-004: 768 dimensions
-- - gemini-embedding-001: 3072 dimensions

-- Drop the old column and recreate without dimension constraint
-- pgvector supports vectors of any dimension without specifying

-- Step 1: Add new column without dimension constraint
ALTER TABLE knowledge_chunks 
ADD COLUMN IF NOT EXISTS embedding_new VECTOR;

-- Step 2: Copy existing data (if any)
UPDATE knowledge_chunks 
SET embedding_new = embedding 
WHERE embedding IS NOT NULL;

-- Step 3: Drop old column
ALTER TABLE knowledge_chunks 
DROP COLUMN IF EXISTS embedding;

-- Step 4: Rename new column
ALTER TABLE knowledge_chunks 
RENAME COLUMN embedding_new TO embedding;

-- Note: Without fixed dimension, can't use HNSW/IVFFlat indexes across different dimensions
-- For search, we rely on exact match with cosine similarity
-- This is fine for < 100k chunks per project
