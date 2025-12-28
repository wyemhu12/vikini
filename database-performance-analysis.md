# Database Performance Analysis & Recommendations

## Phân tích các vấn đề hiệu năng

### 1. **Queries thường xuyên nhất**

#### a. `listConversationsSafe()` - List conversations của user
```sql
SELECT *, gems(name,icon,color) 
FROM conversations 
WHERE user_id = ? 
ORDER BY updated_at DESC;
```
**Vấn đề**: Cần composite index `(user_id, updated_at DESC)`
**Impact**: 🔴 HIGH - Query này chạy mỗi lần user mở sidebar

#### b. `getMessages()` / `getRecentMessages()` - Load messages
```sql
SELECT * 
FROM messages 
WHERE conversation_id = ? 
ORDER BY created_at ASC/DESC 
LIMIT ?;
```
**Vấn đề**: Cần composite index `(conversation_id, created_at)`
**Impact**: 🔴 HIGH - Query này chạy mỗi lần load conversation

#### c. `deleteLastAssistantMessage()` - Regenerate message
```sql
SELECT id 
FROM messages 
WHERE conversation_id = ? AND role = 'assistant' 
ORDER BY created_at DESC 
LIMIT 1;
```
**Vấn đề**: Cần composite index `(conversation_id, role, created_at DESC)`
**Impact**: 🟡 MEDIUM - Query này chạy khi regenerate

#### d. `getGemsForUser()` - Load gems
```sql
SELECT * 
FROM gems 
WHERE is_premade = true OR user_id = ? 
ORDER BY name;
```
**Vấn đề**: OR query khó optimize, cần indexes riêng cho `user_id` và `is_premade`
**Impact**: 🟡 MEDIUM - Query này chạy khi mở gem manager

#### e. `listAttachmentsForConversation()` - Load attachments
```sql
SELECT * 
FROM attachments 
WHERE conversation_id = ? AND user_id = ? 
ORDER BY created_at DESC;
```
**Vấn đề**: Cần composite index `(conversation_id, user_id, created_at DESC)`
**Impact**: 🟢 LOW - Query này ít khi chạy

### 2. **N+1 Query Problems**

#### ✅ Đã được xử lý tốt:
- `listConversationsSafe()` sử dụng JOIN với gems: `select("*,gems(name,icon,color)")`
- `getGemsForUser()` sử dụng `.in("gem_id", ids)` để batch load gem_versions

#### ⚠️ Có thể cải thiện:
- Không thấy vấn đề N+1 nghiêm trọng trong code hiện tại

### 3. **Indexes hiện tại (cần verify)**

Dựa trên code, các indexes sau **NÊN** được tạo:

#### conversations:
- ✅ `idx_conversations_user_updated` - `(user_id, updated_at DESC)`
- ✅ `idx_conversations_gem_id` - `(gem_id)` partial index

#### messages:
- ✅ `idx_messages_conversation_created` - `(conversation_id, created_at)`
- ✅ `idx_messages_conversation_role_created` - `(conversation_id, role, created_at DESC)`

#### gems:
- ✅ `idx_gems_user_id` - `(user_id)` partial index
- ✅ `idx_gems_is_premade` - `(is_premade)` partial index
- ✅ `idx_gems_name` - `(name)` cho ORDER BY

#### gem_versions:
- ✅ `idx_gem_versions_gem_version_desc` - `(gem_id, version DESC)`
- Note: Composite PK `(gem_id, version)` đã có, nhưng cần DESC order

#### attachments:
- ✅ `idx_attachments_conversation_user` - `(conversation_id, user_id)`
- ✅ `idx_attachments_expires_at` - `(expires_at)` partial index
- ✅ `idx_attachments_conversation_user_created` - `(conversation_id, user_id, created_at DESC)`

### 4. **Code Improvements**

#### a. Batch Decryption
**Hiện tại**: `mapMessageRow()` decrypt từng message một
```javascript
// Trong getMessages(), decrypt từng row
return (data || []).map(mapMessageRow);
```
**Cải thiện**: Decrypt có thể được optimize nếu cần, nhưng hiện tại OK vì decrypt nhanh

#### b. Query Optimization
**Hiện tại**: Một số queries có thể optimize

**Ví dụ 1**: `getRecentMessages()` reverse array
```javascript
const rows = (data || []).map(mapMessageRow);
rows.reverse(); // Có thể order DESC ngay từ đầu
```
✅ Đã optimize: Query đã dùng `ORDER BY created_at DESC`, reverse là cần thiết

**Ví dụ 2**: `getGemsForUser()` có nhiều fallback queries
```javascript
// Try multiple schema formats - có thể cache kết quả schema format
```
⚠️ Có thể cache schema format sau lần detect đầu tiên

#### c. Caching Opportunities
- **User conversations list**: Cache 1-2 phút, invalidate khi có update
- **Gems list**: Cache 5-10 phút (ít thay đổi)
- **Gem instructions**: Cache khi load conversation

### 5. **Recommended Actions**

#### Immediate (High Priority):
1. ✅ Tạo các indexes trong `database-optimizations.sql`
2. ✅ Verify indexes đã tồn tại chưa
3. ✅ Chạy ANALYZE để update statistics

#### Medium Priority:
1. Consider thêm Redis caching cho:
   - User conversations list (TTL: 60s)
   - Gems list (TTL: 300s)
2. Monitor query performance với EXPLAIN ANALYZE
3. Consider connection pooling nếu có nhiều concurrent users

#### Low Priority:
1. Schema format detection cache (giảm fallback queries)
2. Consider materialized views nếu có reports phức tạp
3. Partitioning tables nếu data lớn (messages, attachments)

### 6. **Monitoring Queries**

Sau khi apply indexes, monitor performance:

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check slow queries (if pg_stat_statements enabled)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### 7. **Expected Performance Improvements**

Sau khi apply indexes:

| Query | Current | Expected | Improvement |
|-------|---------|----------|-------------|
| listConversations | O(n log n) scan | O(log n) index | 10-100x faster |
| getMessages | O(n) scan | O(log n) index | 10-50x faster |
| deleteLastAssistantMessage | O(n log n) scan | O(log n) index | 10-100x faster |
| getGemsForUser | O(n) scan | O(log n) index | 5-20x faster |
| listAttachments | O(n) scan | O(log n) index | 5-20x faster |

*Improvements phụ thuộc vào số lượng rows trong mỗi table*

