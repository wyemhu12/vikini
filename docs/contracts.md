# Data Contracts & Protocols - Vikini

> **Cập nhật**: 2025-12-31  
> **Mục đích**: Định nghĩa các cấu trúc dữ liệu (Interfaces) và giao thức truyền tải giữa các thành phần của hệ thống Vikini.

---

## 1. Core Models (Thực thể chính)

### Conversation (Cuộc hội thoại)

```typescript
interface Conversation {
  id: string; // UUID
  userId: string; // Email người dùng (lowercase)
  title: string; // Tiêu đề (mặc định: "New Chat")
  model: string; // Model AI (e.g. "gemini-1.5-flash")
  gemId: string | null; // GEM đang áp dụng
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

---

### Message (Tin nhắn)

```typescript
interface Message {
  id: string; // UUID
  conversationId: string; // FK → Conversation
  role: "user" | "assistant"; // Vai trò
  content: string; // Nội dung (đã giải mã)
  meta: MessageMeta | null; // Dữ liệu bổ sung
  createdAt: string; // ISO timestamp
}

interface MessageMeta {
  sources?: WebSearchSource[]; // Kết quả web search
  attachmentIds?: string[]; // IDs tệp đính kèm
  modelUsed?: string; // Model thực tế được sử dụng
  tokensUsed?: number; // Token count
}

interface WebSearchSource {
  title: string;
  url: string;
  snippet?: string;
}
```

> [!IMPORTANT]
> **Mã hóa**: Cột `content` trong DB được mã hóa bằng AES. Client luôn nhận nội dung đã giải mã.

---

### GEM (AI Persona)

```typescript
interface Gem {
  id: string; // UUID
  slug: string | null; // URL-friendly identifier
  name: string; // Tên hiển thị
  description: string; // Mô tả ngắn
  icon: string; // Emoji hoặc icon name
  color: string; // Hex color (#ffffff)
  instructions: string; // System prompt (latest version)
  userId: string | null; // Owner email (null = premade)
  isPremade: boolean; // true = GEM hệ thống (read-only)
  latestVersion: number; // Số phiên bản mới nhất
  createdAt: string;
  updatedAt: string;
}

// Response từ API (camelCase)
interface GemForClient {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  icon: string;
  color: string;
  isPremade: boolean;
  latestVersion: number;
  instructions: string;
}
```

---

### Attachment (Tệp đính kèm)

```typescript
interface Attachment {
  id: string; // UUID
  conversationId: string; // FK → Conversation
  messageId: string | null; // FK → Message (optional)
  userId: string; // Email owner
  filename: string; // Tên file gốc
  storagePath: string; // Path trong Supabase Storage
  mimeType: string; // MIME type (image/png, etc.)
  sizeBytes: number; // Kích thước
  extractedText: string | null; // Nội dung trích xuất
  tokenCount: number | null; // Token ước tính
  expiresAt: string; // ISO timestamp (36h TTL)
  createdAt: string;
}
```

**Định dạng hỗ trợ**:

| Loại     | Extensions                | Max Size |
| -------- | ------------------------- | -------- |
| Ảnh      | png, jpg, jpeg, webp      | 10MB     |
| Văn bản  | txt, js, jsx, tsx, json   | 2MB      |
| Tài liệu | pdf, doc, docx, xls, xlsx | 20MB     |
| Nén      | zip                       | 20MB     |

**Vòng đời**:

1. **Upload** → Supabase Storage: `{userId}/{conversationId}/{uuid}-{filename}`
2. **Metadata** → DB `attachments` table kèm `expires_at` (36h)
3. **Context** → Nội dung trích xuất đưa vào AI prompt
4. **Cleanup** → Cron job xóa sau khi hết hạn

---

### Profile (Hồ sơ người dùng)

```typescript
interface Profile {
  id: string; // UUID từ Supabase Auth
  email: string; // Email đăng nhập
  rank: UserRank; // Xếp hạng
  isBlocked: boolean; // Trạng thái khóa
  createdAt: string;
  updatedAt: string;
}

type UserRank = "basic" | "pro" | "admin" | "not_whitelisted";
```

---

### RankConfig (Cấu hình xếp hạng)

```typescript
interface RankConfig {
  rank: UserRank;
  dailyMessageLimit: number; // Giới hạn tin nhắn/ngày
  maxFileSizeMb: number; // Giới hạn upload (MB)
  features: RankFeatures;
  allowedModels: string[]; // Danh sách model được phép
  updatedAt: string;
}

interface RankFeatures {
  webSearch: boolean;
  unlimitedGems: boolean;
}
```

---

## 2. API Request/Response Schemas

### Chat Stream Request

```typescript
// POST /api/chat-stream
interface ChatStreamRequest {
  conversationId?: string; // UUID (optional - tạo mới nếu không có)
  content: string; // Tin nhắn (min: 1 char)
  regenerate?: boolean; // Tạo lại response
  truncateMessageId?: string; // Xóa messages sau ID này
  skipSaveUserMessage?: boolean; // Không lưu tin nhắn user
}
```

### Chat Stream Events (SSE)

```typescript
// Event: token
interface TokenEvent {
  type: "token";
  data: { token: string };
}

// Event: meta
interface MetaEvent {
  type: "meta";
  data: {
    conversationId: string;
    title: string;
    sources?: WebSearchSource[];
  };
}

// Event: done
interface DoneEvent {
  type: "done";
  data: {};
}

// Event: error
interface ErrorEvent {
  type: "error";
  data: { error: string; message?: string };
}
```

---

### GEM Operations

```typescript
// POST /api/gems (Create)
interface CreateGemRequest {
  name: string; // Bắt buộc
  description: string; // Bắt buộc
  instructions: string; // System prompt - Bắt buộc
  icon: string; // Emoji
  color: string; // Hex color
}

// PATCH /api/gems (Update)
interface UpdateGemRequest {
  id: string; // UUID - Bắt buộc
  name?: string;
  description?: string;
  instructions?: string; // Thay đổi → tạo version mới
  icon?: string;
  color?: string;
}

// DELETE /api/gems
interface DeleteGemRequest {
  id: string; // UUID
}
```

---

### Conversation Operations

```typescript
// POST /api/conversations (Create)
interface CreateConversationRequest {
  title?: string;
  model?: string;
  gemId?: string;
}

// PATCH /api/conversations (Update)
interface UpdateConversationRequest {
  id: string; // UUID - Bắt buộc
  title?: string; // Đổi tiêu đề
  gemId?: string | null; // Đổi/xóa GEM
  model?: string; // Đổi model
}
```

---

## 3. Security & Performance

### Encryption

- **Thuật toán**: AES-256-GCM
- **Áp dụng**: Cột `content` trong bảng `messages`
- **Functions**: `encryptText()` / `decryptText()` trong `/lib/core/encryption.ts`

### Caching (Redis)

- **Conversations list**: Cache theo userId
- **Gems list**: Cache theo userId
- **TTL**: Vài phút, invalidate khi có thay đổi

### 4. Hằng số dùng chung (Shared Constants)

- **Model IDs**: Các định danh như `vikini-image-studio` được tập trung tại `lib/utils/constants.ts` trong object `MODEL_IDS`.
- **Roles**: Sử dụng `MESSAGE_ROLES` cho "user" và "assistant" để đảm bảo tính nhất quán.

---

## 4. Liên kết tài liệu

- [Database Schema](./database-schema.md) - Chi tiết bảng và ERD
- [API Reference](./api-reference.md) - Chi tiết endpoints
- [Security](./security.md) - RLS và encryption
