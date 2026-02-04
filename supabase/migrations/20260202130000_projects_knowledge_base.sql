-- Migration: Projects + Knowledge Base
-- Created: 2026-02-02

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6366f1',
  embedding_model TEXT DEFAULT 'gemini-embedding-001',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);

-- ============================================
-- LINK CONVERSATIONS TO PROJECTS
-- ============================================
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_project_id_idx ON conversations(project_id);

-- ============================================
-- KNOWLEDGE DOCUMENTS (per-project)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  embedding_model TEXT,
  status TEXT DEFAULT 'processing', -- processing, ready, error
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_documents_project_id_idx ON knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_user_id_idx ON knowledge_documents(user_id);

-- ============================================
-- KNOWLEDGE CHUNKS with embeddings
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(3072), -- Supports both embedding models
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: HNSW index has max 2000 dimensions limit, but gemini-embedding-001 uses 3072
-- Using exact search instead (fine for <100k chunks per project)
-- If needed for scale, can create IVFFlat index after data exists:
-- CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for project-scoped queries
CREATE INDEX IF NOT EXISTS knowledge_chunks_project_id_idx ON knowledge_chunks(project_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_document_id_idx ON knowledge_chunks(document_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only access their own
DROP POLICY IF EXISTS "Users manage own projects" ON projects;
CREATE POLICY "Users manage own projects" ON projects
  FOR ALL USING (auth.jwt() ->> 'email' = user_id);

-- Knowledge Documents: Users can only access their own
DROP POLICY IF EXISTS "Users manage own knowledge docs" ON knowledge_documents;
CREATE POLICY "Users manage own knowledge docs" ON knowledge_documents
  FOR ALL USING (auth.jwt() ->> 'email' = user_id);

-- Knowledge Chunks: Users can only access their own
DROP POLICY IF EXISTS "Users manage own knowledge chunks" ON knowledge_chunks;
CREATE POLICY "Users manage own knowledge chunks" ON knowledge_chunks
  FOR ALL USING (auth.jwt() ->> 'email' = user_id);

-- ============================================
-- SIMILARITY SEARCH FUNCTION (project-scoped)
-- ============================================
CREATE OR REPLACE FUNCTION match_project_knowledge(
  p_project_id UUID,
  query_embedding VECTOR(3072),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  filename TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kd.filename,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE 
    kc.project_id = p_project_id
    AND kd.status = 'ready'
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- HELPER: Get project storage usage
-- ============================================
CREATE OR REPLACE FUNCTION get_project_storage_bytes(p_project_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_bytes BIGINT;
BEGIN
  SELECT COALESCE(SUM(size_bytes), 0) INTO total_bytes
  FROM knowledge_documents
  WHERE project_id = p_project_id;
  
  RETURN total_bytes;
END;
$$;
