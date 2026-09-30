-- ============================================================================
-- Migration: Unify Gemini Embedding 2 (3072d) & Clean Legacy Chunks
-- ============================================================================

BEGIN;

-- 1. Đánh dấu lỗi các tài liệu có chunks bị lệch chiều (khác 3072d)
-- (Thu hẹp điều kiện: chỉ đánh dấu error các tài liệu thực sự có chunk lệch chiều, các tài liệu hợp lệ có embedding_model NULL sẽ được chuẩn hóa ở bước sau)
UPDATE knowledge_documents
SET status = 'error',
    error_message = 're-upload required (embedding model upgraded to gemini-embedding-2)',
    embedding_model = 'gemini-embedding-2',
    updated_at = now()
WHERE id IN (
  SELECT DISTINCT document_id 
  FROM knowledge_chunks 
  WHERE embedding IS NOT NULL AND vector_dims(embedding) <> 3072
);

-- 2. Xóa triệt để các chunks có số chiều vector khác 3072
DELETE FROM knowledge_chunks
WHERE embedding IS NOT NULL AND vector_dims(embedding) <> 3072;

-- 2b. Khóa cứng số chiều vector ở mức schema CSDL: 3072 dimensions
-- (Khóa chặt ở tầng schema, loại bỏ hoàn toàn nguy cơ lệch chiều ở mức pgvector)
ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE VECTOR(3072);

-- 3. Cập nhật các tài liệu còn lại sang gemini-embedding-2
UPDATE knowledge_documents
SET embedding_model = 'gemini-embedding-2'
WHERE embedding_model IS NULL OR embedding_model <> 'gemini-embedding-2';

-- 4. Cập nhật tất cả dự án sang gemini-embedding-2
UPDATE projects 
SET embedding_model = 'gemini-embedding-2' 
WHERE embedding_model IS NULL OR embedding_model <> 'gemini-embedding-2';

-- 5. Áp đặt NOT NULL, DEFAULT và CHECK Constraint cho bảng projects
ALTER TABLE projects ALTER COLUMN embedding_model SET NOT NULL;
ALTER TABLE projects ALTER COLUMN embedding_model SET DEFAULT 'gemini-embedding-2';
ALTER TABLE projects DROP CONSTRAINT IF EXISTS chk_projects_embedding_model;
ALTER TABLE projects ADD CONSTRAINT chk_projects_embedding_model CHECK (embedding_model = 'gemini-embedding-2');

-- 6. Áp đặt NOT NULL, DEFAULT và CHECK Constraint cho bảng knowledge_documents
ALTER TABLE knowledge_documents ALTER COLUMN embedding_model SET NOT NULL;
ALTER TABLE knowledge_documents ALTER COLUMN embedding_model SET DEFAULT 'gemini-embedding-2';
ALTER TABLE knowledge_documents DROP CONSTRAINT IF EXISTS chk_knowledge_documents_embedding_model;
ALTER TABLE knowledge_documents ADD CONSTRAINT chk_knowledge_documents_embedding_model CHECK (embedding_model = 'gemini-embedding-2');

-- 7. Cập nhật RPC match_project_knowledge: Bảo toàn 100% chữ ký & kiểu trả về, chỉ thêm vector_dims = 3072
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
  WHERE kc.project_id = p_project_id
    AND kd.status = 'ready'
    AND vector_dims(kc.embedding) = 3072
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMIT;
