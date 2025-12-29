# 🚀 Hướng dẫn Execute Database Migration

## ✅ Migration Files

Có 2 file SQL cần chạy theo thứ tự:

1. **001_admin_system.sql** - Tạo tables (profiles, rank_configs, daily_message_counts)
2. **002_user_data.sql** - Insert dữ liệu 3 users hiện tại

---

## Bước 1: Mở Supabase SQL Editor

Truy cập link sau trong browser:

```
https://otqhztwogsvsfeuwhrom.supabase.co/project/_/sql/new
```

---

## Bước 2: Run Migration 001 (Schema)

### 2.1 Copy SQL

Copy toàn bộ nội dung file:

```
database-migrations/001_admin_system.sql
```

### 2.2 Paste và Run

1. Paste SQL vào editor trong Supabase Dashboard
2. Click nút **"Run"** (góc dưới bên phải)
3. Đợi ~2-3 giây để execute

### 2.3 Verify

Chạy query này để verify:

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'rank_configs', 'daily_message_counts');

-- Check rank configs data
SELECT * FROM rank_configs ORDER BY rank;
```

Kết quả mong đợi:

- ✅ 3 tables: `profiles`, `rank_configs`, `daily_message_counts`
- ✅ 3 rows trong `rank_configs`: basic (20 msgs, 5MB), pro (100 msgs, 50MB), admin (9999 msgs, 100MB)

---

## Bước 3: Run Migration 002 (User Data)

### 3.1 Copy SQL

Copy toàn bộ nội dung file:

```
database-migrations/002_user_data.sql
```

### 3.2 Paste và Run

1. Clear editor (hoặc mở SQL editor mới)
2. Paste SQL vào editor
3. Click **"Run"**

### 3.3 Verify

Chạy query:

```sql
SELECT * FROM temp_user_ranks ORDER BY rank DESC, email;
```

Kết quả mong đợi:

- ✅ wyemhu12@gmail.com → admin
- ✅ kimtuyentd267@gmail.com → pro
- ✅ heartbeattui@gmail.com → pro

---

## ✅ Bước tiếp theo

Sau khi cả 2 migrations chạy thành công:

1. **Báo lại cho Agent** - để implement code logic
2. **Test login** - 3 users login lần đầu sẽ auto-create profiles với ranks đúng
3. **Clean up** - Sau khi tất cả đã login, có thể drop table `temp_user_ranks`

---

## 📋 User Mapping

| Email                   | Rank  | Limits                     |
| ----------------------- | ----- | -------------------------- |
| wyemhu12@gmail.com      | admin | 9999 msgs/day, 100MB files |
| kimtuyentd267@gmail.com | pro   | 100 msgs/day, 50MB files   |
| heartbeattui@gmail.com  | pro   | 100 msgs/day, 50MB files   |
