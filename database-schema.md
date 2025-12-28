# Database Schema - Vikini Project

Tài liệu này mô tả các tables được sử dụng trong project Vikini trên Supabase.

## Tables

### 1. `conversations`
Lưu thông tin các cuộc hội thoại

**Columns:**
- `id` (UUID, Primary Key)
- `user_id` (String/Text) - ID của user sở hữu conversation
- `title` (String/Text) - Tiêu đề cuộc hội thoại
- `created_at` (Timestamp) - Thời gian tạo
- `updated_at` (Timestamp) - Thời gian cập nhật
- `last_message_preview` (String/Text, nullable) - Preview tin nhắn cuối
- `gem_id` (UUID, nullable, Foreign Key -> gems.id) - ID của gem được áp dụng
- `model` (String/Text) - Model AI được sử dụng (default: từ DEFAULT_MODEL)

**Relationships:**
- Belongs to: `gems` (via `gem_id`)

**Indexes/Suggestions:**
- Index trên `user_id` để query nhanh danh sách conversations của user
- Index trên `updated_at` để sort nhanh
- Foreign key constraint trên `gem_id`

---

### 2. `messages`
Lưu các tin nhắn trong conversations

**Columns:**
- `id` (UUID, Primary Key)
- `conversation_id` (UUID, Foreign Key -> conversations.id)
- `role` (String/Text) - "user" hoặc "assistant"
- `content` (Text) - Nội dung tin nhắn (được encrypt)
- `created_at` (Timestamp) - Thời gian tạo
- `meta` (JSONB, nullable) - Metadata bổ sung

**Relationships:**
- Belongs to: `conversations` (via `conversation_id`)

**Indexes/Suggestions:**
- Index trên `conversation_id` để query nhanh messages của một conversation
- Index trên `created_at` để sort và filter theo thời gian
- Index trên `role` nếu cần filter theo role thường xuyên

---

### 3. `gems`
Lưu các custom instructions/prompts (Gems)

**Columns:**
- `id` (UUID, Primary Key)
- `user_id` (String/Text, nullable) - NULL cho system gems, có giá trị cho user gems
- `name` (String/Text) - Tên của gem
- `description` (String/Text, nullable) - Mô tả
- `instruction` hoặc `instructions` (Text, nullable) - Instructions (legacy, có thể không còn dùng)
- `icon` (String/Text, nullable) - Icon của gem
- `color` (String/Text, nullable) - Màu của gem
- `is_premade` hoặc `isPremade` (Boolean, nullable) - True nếu là system gem

**Relationships:**
- Has many: `gem_versions` (via `gem_id`)
- Has many: `conversations` (via `gem_id`)

**Indexes/Suggestions:**
- Index trên `user_id` để filter gems của user
- Index trên `is_premade` để filter system vs user gems

---

### 4. `gem_versions`
Lưu các phiên bản của gems (versioned instructions)

**Columns:**
- `gem_id` (UUID, Foreign Key -> gems.id, Primary Key)
- `version` (Integer, Primary Key) - Số version
- `instructions` (Text) - Instructions cho version này
- `created_by` (String/Text, nullable) - User tạo version (optional)

**Relationships:**
- Belongs to: `gems` (via `gem_id`)

**Indexes/Suggestions:**
- Composite primary key: (`gem_id`, `version`)
- Index trên `gem_id` và `version` để query latest version nhanh

---

### 5. `attachments`
Lưu thông tin các file đính kèm

**Columns:**
- `id` (UUID, Primary Key)
- `conversation_id` (UUID, Foreign Key -> conversations.id)
- `message_id` (UUID, nullable, Foreign Key -> messages.id)
- `user_id` (String/Text)
- `filename` (String/Text) - Tên file
- `mime_type` (String/Text) - MIME type của file
- `size_bytes` (BigInt/Integer) - Kích thước file (bytes)
- `storage_path` (String/Text) - Đường dẫn file trong Supabase Storage
- `created_at` (Timestamp) - Thời gian tạo
- `expires_at` (Timestamp, nullable) - Thời gian hết hạn (dùng cho cleanup)

**Relationships:**
- Belongs to: `conversations` (via `conversation_id`)
- Belongs to: `messages` (via `message_id`, optional)

**Storage:**
- Files được lưu trong Supabase Storage bucket (config: `ATTACHMENTS_BUCKET` hoặc default: "vikini-attachments")
- Path pattern: `{user_id}/{conversation_id}/{uuid}-{filename}`

**Indexes/Suggestions:**
- Index trên `conversation_id` và `user_id` để query nhanh attachments của conversation
- Index trên `expires_at` để cleanup job chạy nhanh
- Index trên `message_id` nếu cần query theo message

---

## Relationships Diagram

```
conversations
  ├── gem_id -> gems.id
  ├── user_id
  │
  ├── has many messages (via conversation_id)
  └── has many attachments (via conversation_id)

messages
  ├── conversation_id -> conversations.id
  └── has many attachments (via message_id, optional)

gems
  ├── user_id (nullable for system gems)
  ├── has many gem_versions (via gem_id)
  └── has many conversations (via gem_id)

gem_versions
  └── gem_id -> gems.id (composite PK: gem_id, version)

attachments
  ├── conversation_id -> conversations.id
  ├── message_id -> messages.id (optional)
  └── user_id
```

---

## Notes

1. **Encryption**: Messages content được encrypt trước khi lưu vào database (xem `lib/core/encryption.js`)

2. **Schema Flexibility**: Code hỗ trợ cả snake_case (`user_id`, `created_at`) và camelCase (`userId`, `createdAt`) để tương thích với nhiều schema khác nhau

3. **Legacy Support**: Một số columns có cả tên cũ và mới (ví dụ: `instruction` và `instructions` trong gems table)

4. **Storage**: Attachments được lưu trong Supabase Storage, chỉ metadata được lưu trong database table

