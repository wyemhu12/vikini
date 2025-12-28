-- ===================================================================
-- Database Performance Optimizations for Vikini
-- ===================================================================
-- File này chứa các indexes và optimizations để cải thiện performance
-- Chạy các lệnh này trên Supabase SQL Editor hoặc qua migration
-- ===================================================================

-- ===================================================================
-- 1. CONVERSATIONS TABLE
-- ===================================================================

-- Index cho query: WHERE user_id = ? ORDER BY updated_at DESC
-- Query này được dùng rất nhiều trong listConversationsSafe()
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
ON conversations(user_id, updated_at DESC);

-- Index cho query: WHERE id = ? (đã có primary key, nhưng thêm để rõ ràng)
-- Index này thường đã có sẵn với primary key, nhưng thêm để đảm bảo

-- Index cho gem_id (foreign key lookups và joins)
CREATE INDEX IF NOT EXISTS idx_conversations_gem_id 
ON conversations(gem_id) 
WHERE gem_id IS NOT NULL;

-- ===================================================================
-- 2. MESSAGES TABLE
-- ===================================================================

-- Composite index cho query: WHERE conversation_id = ? ORDER BY created_at ASC
-- Query này được dùng trong getMessages() và getRecentMessages()
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at ASC);

-- Composite index cho query: WHERE conversation_id = ? AND role = ? ORDER BY created_at DESC
-- Query này được dùng trong deleteLastAssistantMessage()
CREATE INDEX IF NOT EXISTS idx_messages_conversation_role_created 
ON messages(conversation_id, role, created_at DESC);

-- Index cho created_at để hỗ trợ range queries (deleteMessagesIncludingAndAfter)
-- Composite index trên (conversation_id, created_at) đã cover case này

-- ===================================================================
-- 3. GEMS TABLE
-- ===================================================================

-- Index cho user_id (để filter gems của user)
CREATE INDEX IF NOT EXISTS idx_gems_user_id 
ON gems(user_id) 
WHERE user_id IS NOT NULL;

-- Index cho is_premade (để filter system gems)
CREATE INDEX IF NOT EXISTS idx_gems_is_premade 
ON gems(is_premade) 
WHERE is_premade = true;

-- Composite index cho query: WHERE (is_premade = true OR user_id = ?) ORDER BY name
-- Query này được dùng trong getGemsForUser()
-- Note: OR queries khó optimize, nhưng indexes riêng sẽ giúp
CREATE INDEX IF NOT EXISTS idx_gems_name 
ON gems(name);

-- ===================================================================
-- 4. GEM_VERSIONS TABLE
-- ===================================================================

-- Composite index cho query: WHERE gem_id = ? ORDER BY version DESC LIMIT 1
-- Query này được dùng nhiều để lấy latest version
-- Note: Composite primary key (gem_id, version) đã có, nhưng cần DESC order
CREATE INDEX IF NOT EXISTS idx_gem_versions_gem_version_desc 
ON gem_versions(gem_id, version DESC);

-- Index cho query: WHERE gem_id IN (...) ORDER BY version DESC
-- Query này được dùng trong getGemsForUser() để enrich với versions
-- Index trên đã cover case này

-- ===================================================================
-- 5. ATTACHMENTS TABLE
-- ===================================================================

-- Composite index cho query: WHERE conversation_id = ? AND user_id = ?
-- Query này được dùng nhiều trong listAttachmentsForConversation() và enforceConversationQuotas()
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_user 
ON attachments(conversation_id, user_id);

-- Index cho expires_at (để cleanup job chạy nhanh)
CREATE INDEX IF NOT EXISTS idx_attachments_expires_at 
ON attachments(expires_at) 
WHERE expires_at IS NOT NULL;

-- Index cho message_id (nếu cần query theo message)
CREATE INDEX IF NOT EXISTS idx_attachments_message_id 
ON attachments(message_id) 
WHERE message_id IS NOT NULL;

-- Composite index cho query: WHERE conversation_id = ? AND user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_user_created 
ON attachments(conversation_id, user_id, created_at DESC);

-- ===================================================================
-- 6. FOREIGN KEY CONSTRAINTS (Data Integrity)
-- ===================================================================

-- Đảm bảo foreign key constraints tồn tại (cải thiện data integrity và có thể giúp query planner)
-- Chạy các lệnh này chỉ nếu chưa có constraints

-- ALTER TABLE conversations 
-- ADD CONSTRAINT fk_conversations_gem_id 
-- FOREIGN KEY (gem_id) REFERENCES gems(id) ON DELETE SET NULL;

-- ALTER TABLE messages 
-- ADD CONSTRAINT fk_messages_conversation_id 
-- FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- ALTER TABLE gem_versions 
-- ADD CONSTRAINT fk_gem_versions_gem_id 
-- FOREIGN KEY (gem_id) REFERENCES gems(id) ON DELETE CASCADE;

-- ALTER TABLE attachments 
-- ADD CONSTRAINT fk_attachments_conversation_id 
-- FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- ALTER TABLE attachments 
-- ADD CONSTRAINT fk_attachments_message_id 
-- FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- ===================================================================
-- 7. TABLE STATISTICS (PostgreSQL optimization)
-- ===================================================================

-- Update table statistics để query planner có thông tin chính xác
-- Chạy định kỳ hoặc sau khi có nhiều data changes

-- ANALYZE conversations;
-- ANALYZE messages;
-- ANALYZE gems;
-- ANALYZE gem_versions;
-- ANALYZE attachments;

-- ===================================================================
-- NOTES & RECOMMENDATIONS
-- ===================================================================

-- 1. **Partial Indexes**: Một số indexes sử dụng WHERE clause để tạo partial indexes
--    giúp tiết kiệm space và tăng tốc độ (chỉ index các rows thỏa điều kiện)

-- 2. **Index Maintenance**: 
--    - Monitor index usage: SELECT * FROM pg_stat_user_indexes;
--    - Rebuild indexes nếu cần: REINDEX INDEX idx_name;
--    - VACUUM ANALYZE định kỳ

-- 3. **Query Optimization**:
--    - Sử dụng EXPLAIN ANALYZE để kiểm tra query plans
--    - Tránh SELECT * khi chỉ cần một vài columns
--    - Sử dụng LIMIT khi có thể

-- 4. **Connection Pooling**:
--    - Supabase đã có connection pooling built-in
--    - Nên sử dụng connection pool nếu có nhiều concurrent requests

-- 5. **Caching**:
--    - Consider caching frequently accessed data (gems, user conversations list)
--    - Redis/Upstash Redis đã được setup, có thể sử dụng cho caching

