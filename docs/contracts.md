# Data Contracts & Protocols - Vikini

> **Updated**: 2026-05-03  
> **Purpose**: Single source of truth for data shapes, API protocols, and endpoint contracts.  
> **Note**: This file merges the former `api-reference.md`. All endpoint info lives here now.

---

## 1. Core Models (Thực thể chính)

### Conversation (Cuộc hội thoại)

```typescript
interface Conversation {
  id: string; // UUID
  userId: string; // Email người dùng (lowercase)
  title: string; // Tiêu đề (mặc định: "New Chat")
  model: string; // Model AI (e.g. "gemini-3-flash-preview")
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
  fileIds?: string[]; // IDs file đính kèm
  modelUsed?: string; // Model thực tế được sử dụng
  tokensUsed?: number; // Token count

  // Image Generation (type = "image_gen")
  type?: "image_gen"; // Indicates this is a generated image message
  prompt?: string; // Original prompt used for generation
  imageUrl?: string; // Public URL of generated image
  file?: {
    url: string; // Storage URL
    storagePath: string; // Supabase storage path
    mimeType: string; // "image/png" etc.
    filename: string; // Original filename
  };
  originalOptions?: {
    aspectRatio?: string; // "1:1", "16:9", etc.
    style?: string; // Style preset used
    enhancer?: boolean; // AI prompt enhancement enabled
    model?: string; // Image model used (gemini-flash-image, gemini-pro-image, flux, dall-e)
  };
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

### FileItem (File đính kèm)

```typescript
interface FileItem {
  id: string; // UUID
  conversationId: string; // FK → Conversation
  userId: string; // Email owner
  filename: string; // Tên file gốc
  storagePath: string; // Path trong Supabase Storage
  mimeType: string; // MIME type (image/png, etc.)
  kind: FileKind; // image|video|audio|document|text|archive|other
  sizeBytes: number; // Kích thước
  extractedText?: string; // Nội dung trích xuất
  tokenCount?: number; // Token ước tính
  geminiFileName?: string; // Gemini File API name
  geminiFileUri?: string; // Gemini File API URI
  geminiExpiresAt?: string; // Gemini file expiration
  geminiReady: boolean; // Gemini file processing status
  expiresAt?: string; // ISO timestamp (30-day TTL)
  createdAt: string;
}

type FileKind = "image" | "video" | "audio" | "document" | "text" | "archive" | "other";
```

**File Upload Policy** (Blacklist approach):

Hệ thống cho phép hầu hết các loại file, **NGOẠI TRỪ** các file nguy hiểm sau:

| Loại bị chặn     | Extensions                             | Lý do                    |
| ---------------- | -------------------------------------- | ------------------------ |
| Executables      | exe, bat, cmd, com, scr, msi, pif      | Nguy cơ thực thi mã độc  |
| Scripts          | ps1, vbs, vbe, wsf, wsh, hta           | Scripts tự động thực thi |
| System files     | dll, sys, drv, cpl, ocx, reg, inf, lnk | File hệ thống Windows    |
| Package archives | jar, apk, deb, rpm                     | Có thể chứa executables  |

**Giới hạn kích thước**: Theo rank của user (xem bảng `rank_configs`).

**File types được hỗ trợ tốt nhất** (có text extraction/processing):

- **Text**: txt, js, ts, tsx, jsx, json, md, csv, xml, yaml, html, css
- **Images**: png, jpg, jpeg, webp, gif, svg, bmp
- **Documents**: pdf, doc, docx, xls, xlsx, ppt, pptx
- **Archives**: zip, tar, gz, 7z, rar (không chứa executables)

**Vòng đời**:

1. **Upload** → Supabase Storage: `{userId}/{conversationId}/{uuid}-{filename}`
2. **Metadata** → DB `files` table kèm `expires_at` (30 ngày)
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

### Project (Dự án)

```typescript
interface Project {
  id: string; // UUID
  userId: string; // Email người dùng
  name: string; // Tên project (unique per user)
  description: string | null; // Mô tả
  icon: string; // Emoji (default: 📁)
  color: string; // Hex color (default: #6366f1)
  embeddingModel: string; // "text-embedding-004" | "gemini-embedding-001"
  createdAt: string;
  updatedAt: string;
}
```

---

### KnowledgeDocument (Tài liệu Knowledge Base)

```typescript
interface KnowledgeDocument {
  id: string; // UUID
  projectId: string; // FK → Project
  userId: string; // Email owner
  filename: string; // Tên file gốc
  mimeType: string | null; // MIME type
  sizeBytes: number; // Kích thước
  totalChunks: number; // Số chunks sau khi chia
  embeddingModel: string | null; // Model dùng để embed
  status: "processing" | "ready" | "error"; // Trạng thái
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
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
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal"; // Gemini 3 thinking mode
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

### Project Operations

```typescript
// POST /api/projects (Create)
interface CreateProjectRequest {
  name: string; // Bắt buộc (max 100)
  description?: string; // Max 500
  icon?: string; // Emoji
  color?: string; // Hex color (#xxxxxx)
  embedding_model?: "text-embedding-004" | "gemini-embedding-001";
}

// PATCH /api/projects/[id] (Update)
interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: string;
  embedding_model?: "text-embedding-004" | "gemini-embedding-001";
}

// POST /api/projects/[id]/knowledge (Upload document)
interface UploadDocumentRequest {
  filename: string; // Bắt buộc
  content: string; // Text content - Bắt buộc
  mimeType?: string;
  embedding_model?: "text-embedding-004" | "gemini-embedding-001";
}

// POST /api/projects/[id]/knowledge/search (RAG search)
interface KnowledgeSearchRequest {
  query: string; // Search query
  matchThreshold?: number; // Default 0.7
  matchCount?: number; // Default 5
}
```

---

### API Response Contracts (MANDATORY)

> **Standard format cho TẤT CẢ API responses**

```typescript
// SUCCESS Response
interface SuccessResponse<T> {
  success: true;
  data: T;
}

// ERROR Response
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string; // e.g. "VALIDATION_ERROR", "NOT_FOUND"
  };
}
```

**Error Codes:**

| Code                  | Status | Ý nghĩa                 |
| --------------------- | ------ | ----------------------- |
| `VALIDATION_ERROR`    | 400    | Input không hợp lệ      |
| `UNAUTHORIZED`        | 401    | Chưa đăng nhập          |
| `FORBIDDEN`           | 403    | Không có quyền          |
| `NOT_FOUND`           | 404    | Không tìm thấy resource |
| `RATE_LIMIT_EXCEEDED` | 429    | Quá nhiều requests      |
| `INTERNAL_ERROR`      | 500    | Lỗi server              |

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

## 5. API Endpoints Reference

### Authentication

All API routes require NextAuth session (cookie-based). No Bearer tokens.
Public routes: `/auth/signin`, `/auth/error`, `/auth/signout`, `/api/auth/*`.

### Key Endpoints

| Method                | Endpoint                              | Description                              |
| --------------------- | ------------------------------------- | ---------------------------------------- |
| POST                  | `/api/chat-stream`                    | Send message, receive SSE stream         |
| GET                   | `/api/conversations`                  | List all user conversations              |
| GET                   | `/api/conversations?id={uuid}`        | Get conversation with messages           |
| POST/PATCH/DELETE     | `/api/conversations`                  | CRUD operations                          |
| GET/POST/PATCH/DELETE | `/api/gems`                           | GEM CRUD operations                      |
| POST                  | `/api/files/upload`                   | Upload file (FormData)                   |
| GET/DELETE            | `/api/files`                          | List/delete files                        |
| GET                   | `/api/files/[id]/url`                 | Get signed download URL                  |
| POST                  | `/api/files/[id]/analyze`             | AI-powered file analysis                 |
| DELETE                | `/api/messages/[id]`                  | Delete a single message                  |
| POST                  | `/api/generate-image`                 | AI image generation                      |
| GET/DELETE            | `/api/gallery`                        | Gallery CRUD                             |
| GET                   | `/api/user/allowed-models`            | Get user's allowed models by rank        |
| GET/POST              | `/api/projects`                       | List/create projects                     |
| GET/PATCH/DELETE      | `/api/projects/[id]`                  | Single project CRUD                      |
| GET/POST/DELETE       | `/api/projects/[id]/knowledge`        | Knowledge document management            |
| POST                  | `/api/projects/[id]/knowledge/search` | RAG similarity search                    |
| GET/PATCH             | `/api/admin/users`                    | Admin: user management                   |
| GET/POST              | `/api/admin/gems`                     | Admin: premade GEM management            |
| GET/PATCH             | `/api/admin/rank-configs`             | Admin: rank configuration                |
| GET                   | `/api/files/cleanup`                  | Cron: cleanup expired files (30-day TTL) |

### Rate Limiting

- `/api/chat-stream`: Per-user limits based on rank config
- All APIs: IP-based rate limiting via Upstash Redis
- Headers: `X-RateLimit-Remaining`, `Retry-After`

---

## 6. Related Documentation

- [Database Schema](./database-schema.md) -- Table details and ERD
- [Security](./security.md) -- RLS and encryption
- [Features](./features.md) -- Feature details and file locations
- [Models](./models.md) -- AI model specifications
