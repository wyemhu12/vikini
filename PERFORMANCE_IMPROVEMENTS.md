# Performance Improvements Guide

## Tổng quan

Sau khi phân tích code và database schema, có một số cải thiện quan trọng có thể làm để tăng performance đáng kể.

## 🚀 Quick Start

### 1. Tạo Database Indexes (QUAN TRỌNG NHẤT)

Chạy file SQL trong Supabase SQL Editor:

1. Mở Supabase Dashboard → SQL Editor
2. Copy nội dung từ `database-optimizations.sql`
3. Paste và chạy

**Expected Impact**: 
- Queries sẽ nhanh hơn **10-100 lần** cho các queries phổ biến
- Giảm database load đáng kể
- Cải thiện user experience (page load nhanh hơn)

### 2. Verify Indexes đã được tạo

```bash
npm run check-indexes
```

Script này sẽ hiển thị SQL query để check indexes trong Supabase SQL Editor.

### 3. Update Database Statistics

Sau khi tạo indexes, chạy ANALYZE:

```sql
ANALYZE conversations;
ANALYZE messages;
ANALYZE gems;
ANALYZE gem_versions;
ANALYZE attachments;
```

## 📊 Chi tiết các cải thiện

### A. Database Indexes (Priority: 🔴 HIGH)

**File**: `database-optimizations.sql`

Các indexes quan trọng nhất:

1. **conversations(user_id, updated_at DESC)**
   - Query: List conversations của user
   - Impact: Mỗi lần user mở sidebar

2. **messages(conversation_id, created_at)**
   - Query: Load messages của conversation
   - Impact: Mỗi lần user mở conversation

3. **messages(conversation_id, role, created_at DESC)**
   - Query: Delete last assistant message (regenerate)
   - Impact: Mỗi lần regenerate message

4. **attachments(conversation_id, user_id, created_at DESC)**
   - Query: List attachments
   - Impact: Khi user xem attachments

Xem chi tiết trong `database-optimizations.sql`

### B. Code Improvements (Priority: 🟡 MEDIUM)

#### 1. Schema Format Detection Cache

**Vấn đề**: Code thử nhiều schema formats (snake_case vs camelCase)

**Cải thiện**: Cache schema format sau lần detect đầu tiên

**File**: `lib/features/chat/conversations.js`

```javascript
// TODO: Add schema format cache
// Cache detected format để tránh thử nhiều lần
```

#### 2. Query Optimization

Các queries hiện tại đã khá tốt, nhưng có thể optimize:

- ✅ `getRecentMessages()` đã optimize tốt
- ✅ `listConversationsSafe()` sử dụng JOIN tốt
- ⚠️ `getGemsForUser()` có nhiều fallback queries - có thể cache format

### C. Caching Opportunities (Priority: 🟢 LOW - Future)

Redis đã được setup, có thể dùng cho:

1. **User Conversations List**
   - TTL: 60 seconds
   - Invalidate khi có update
   - Key: `conv:list:${userId}`

2. **Gems List**
   - TTL: 300 seconds (5 minutes)
   - Invalidate khi user create/update gem
   - Key: `gems:list:${userId}`

3. **Gem Instructions** (nếu cần)
   - TTL: 3600 seconds (1 hour)
   - Key: `gem:instructions:${gemId}`

## 📈 Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| List conversations | ~200-500ms | ~20-50ms | **10x faster** |
| Load messages | ~300-800ms | ~30-80ms | **10x faster** |
| Regenerate message | ~100-300ms | ~10-30ms | **10x faster** |
| Database CPU usage | High | Low | **Significant** |

*Actual improvements depend on data size*

## 🔍 Monitoring

Sau khi apply indexes, monitor performance:

### Check Index Usage

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Check Slow Queries

```sql
-- If pg_stat_statements extension is enabled
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

## ✅ Checklist

- [ ] Chạy `database-optimizations.sql` trong Supabase SQL Editor
- [ ] Verify indexes đã được tạo (chạy `npm run check-indexes`)
- [ ] Chạy ANALYZE trên các tables
- [ ] Monitor query performance sau 1-2 ngày
- [ ] (Optional) Implement caching cho conversations list
- [ ] (Optional) Implement caching cho gems list

## 📝 Notes

1. **Indexes không làm chậm INSERT/UPDATE đáng kể** với data size hiện tại
2. **Partial indexes** (với WHERE clause) tiết kiệm space và tăng tốc độ
3. **Foreign key constraints** giúp data integrity và có thể giúp query planner
4. **ANALYZE** nên chạy định kỳ hoặc sau khi có nhiều data changes

## 🆘 Troubleshooting

### Index không được sử dụng?

1. Check query plan: `EXPLAIN ANALYZE <query>`
2. Update statistics: `ANALYZE <table>`
3. Check index is correct: Columns và order phải match query

### Performance vẫn chậm sau khi tạo indexes?

1. Check data size - indexes help nhưng không solve mọi vấn đề
2. Consider query optimization - có thể query có thể được viết lại tốt hơn
3. Consider caching - database không phải solution cho mọi vấn đề

## 📚 Resources

- `database-optimizations.sql` - SQL để tạo indexes
- `database-performance-analysis.md` - Chi tiết phân tích
- `database-schema.md` - Schema documentation

