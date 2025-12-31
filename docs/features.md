# Features - Vikini

> **Cập nhật**: 2025-12-31

---

## 1. Danh Sách Tính Năng

| Tính năng                | Trạng thái    | Mô tả                             |
| ------------------------ | ------------- | --------------------------------- |
| **Chat Streaming**       | ✅ Hoàn thành | SSE streaming với Gemini AI       |
| **Conversations**        | ✅ Hoàn thành | CRUD + auto-title                 |
| **GEMs System**          | ✅ Hoàn thành | Custom AI personas với versioning |
| **File Attachments**     | ✅ Hoàn thành | Upload, parse, 36h TTL            |
| **Message Encryption**   | ✅ Hoàn thành | AES-256-GCM                       |
| **Rate Limiting**        | ✅ Hoàn thành | Redis-based per user              |
| **Daily Message Limits** | ✅ Hoàn thành | Theo rank                         |
| **Web Search**           | ✅ Hoàn thành | Optional, rank-gated              |
| **Admin Dashboard**      | ✅ Hoàn thành | User/GEM/Rank management          |
| **Google OAuth**         | ✅ Hoàn thành | NextAuth v5                       |

---

## 2. Chi Tiết Tính Năng

### 2.1 Chat System

**Luồng xử lý**:

```
User Input → Rate Limit Check → Daily Limit Check → Build Context → Gemini API → Stream Response → Save to DB
```

**Files liên quan**:

- `/app/api/chat-stream/route.ts` - Entry point
- `/app/api/chat-stream/chatStreamCore.ts` - Core logic
- `/lib/features/chat/conversations.ts` - Conversation CRUD
- `/lib/features/chat/messages.ts` - Message CRUD
- `/lib/core/genaiClient.ts` - Gemini client

---

### 2.2 GEMs (AI Personas)

**Mô tả**: Custom system instructions có thể gắn vào conversation.

**Loại GEM**:

- **Premade**: GEM hệ thống (read-only), quản lý qua Admin
- **Custom**: User tự tạo

**Versioning**: Mỗi lần đổi `instructions` → tạo bản ghi mới trong `gem_versions`.

**Files**:

- `/app/api/gems/route.ts` - API
- `/lib/features/gems/gems.ts` - Business logic

---

### 2.3 Attachments

**Quy trình**:

1. Validate MIME type và size
2. Upload lên Supabase Storage
3. Parse/extract text (PDF, text files)
4. Đếm tokens
5. Đưa vào context khi chat

**TTL**: 36 giờ (cleanup via cron)

**Files**:

- `/app/api/attachments/upload/route.ts`
- `/lib/features/attachments/attachments.ts`

---

### 2.4 Admin Dashboard

**Capabilities**:

- Quản lý users (rank, block)
- Quản lý premade GEMs
- Cấu hình rank limits

**Route**: `/admin`

---

## 3. Roadmap (Dự kiến)

| Tính năng            | Priority | Effort    | Notes                       |
| -------------------- | -------- | --------- | --------------------------- |
| Multi-model support  | High     | Medium    | Thêm Claude, GPT            |
| Code Artifacts       | High     | High      | Render HTML/React real-time |
| Knowledge Base       | Medium   | High      | Persistent document context |
| Voice Chat (TTS/STT) | Medium   | Medium    | Web Speech API              |
| Plugin System        | Low      | Very High | Extensibility               |

---

## 4. Dependencies Giữa Các Tính Năng

```mermaid
graph TD
    Auth[Google OAuth] --> Chat
    Auth --> Admin

    Chat --> Conversations
    Chat --> Messages
    Chat --> Streaming

    Conversations --> GEMs
    Conversations --> Attachments

    Messages --> Encryption

    Admin --> UserManagement
    Admin --> GEMManagement
    Admin --> RankConfig

    RankConfig --> DailyLimits
    RankConfig --> RateLimiting
    RankConfig --> WebSearch
```
