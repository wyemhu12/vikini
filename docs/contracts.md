# Data Contracts & Protocols - Vikini

> **Updated**: 2026-11-02  
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
  model: string; // Model AI (e.g. "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-4-argon")
  gemId: string | null; // GEM đang áp dụng
  projectId: string | null; // Project chứa cuộc hội thoại
  parentConversationId?: string | null; // Cuộc hội thoại gốc nếu rẽ nhánh
  forkedFromMessageId?: string | null; // Tin nhắn mốc rẽ nhánh
  lastMessagePreview: string | null; // Đoạn xem trước tin nhắn cuối
  gem: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  persona: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  createdAt: string | null; // ISO timestamp
  updatedAt: string | null; // ISO timestamp
}
```

---

### Message (Tin nhắn)

```typescript
interface Message {
  id: string; // UUID
  conversationId: string; // FK → Conversation
  role: "user" | "assistant" | "system"; // Vai trò
  content: string; // Nội dung (đã giải mã AES-256-GCM)
  meta: MessageMeta | null; // Dữ liệu bổ sung
  createdAt: string | null; // ISO timestamp
}

interface MessageMeta {
  type?: "image_gen" | "image_edit" | "text" | "chart";
  sources?: WebSearchSource[]; // Kết quả web search grounding
  ragSources?: RagSource[]; // Trích dẫn Knowledge Base RAG
  urlContext?: Array<{ retrievedUrl: string; status: string }>; // URL Context grounding
  reasoning?: string; // Khối suy luận tách biệt (được mã hóa AES-256-GCM khi lưu DB)
  /** @deprecated Use thoughtSignatures array instead */
  thoughtSignature?: string;
  thoughtSignatures?: string[]; // Chữ ký suy luận đa lượt (Gemini 3 / 4 Argon)
  thinkingStats?: { tokens: number; elapsedMs: number }; // Thống kê thời gian & token suy luận
  emptyAnswerReason?: "length" | "no_content"; // Lý do khi model chỉ sinh reasoning không có answer
  fileIds?: string[]; // IDs file đính kèm
  model?: string; // Model thực tế được sử dụng
  promptTokenCount?: number; // Input tokens
  candidatesTokenCount?: number; // Output tokens
  thoughtsTokenCount?: number; // Thinking tokens
  totalTokenCount?: number; // Tổng số tokens
  clientMessageId?: string; // ID định danh từ client (dùng cho upsert/abort)
  isPartial?: boolean; // Tin nhắn dừng giữa chừng (abort/cutoff)
  aborted?: boolean;
  status?: "aborted";
  isContextOnly?: boolean; // Ngữ cảnh ẩn (rẽ nhánh hội thoại hoặc Novelcrafter state)
  novelcrafterType?: "story_state" | "story_state_corrupted_backup";

  // Image Generation (type = "image_gen" | "image_edit")
  prompt?: string; // Original prompt used for generation
  imageUrl?: string; // Public URL of generated image
  file?: {
    url: string; // Storage URL
    storagePath: string; // Supabase storage path
    mimeType: string; // "image/png" etc.
    filename: string; // Original filename
  };
  attachment?: {
    url?: string;
    storagePath: string;
    mimeType?: string;
    filename?: string;
  };
  originalOptions?: {
    aspectRatio?: string; // "1:1", "16:9", etc.
    style?: string; // Style preset used
    enhancer?: boolean; // AI prompt enhancement enabled
    model?: string; // Image model used
  };
}

interface WebSearchSource {
  uri: string;
  title: string;
}

interface RagSource {
  filename: string;
  documentId: string;
  chunkId: string;
  similarity: number;
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
  embeddingModel: "gemini-embedding-2"; // Model bất biến 3072 chiều
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
// POST /api/chat-stream (src/app/api/chat-stream/validators.ts)
interface ChatStreamRequest {
  conversationId?: string; // UUID (optional - tạo mới nếu không có)
  content: string; // Tin nhắn
  regenerate?: boolean; // Tạo lại response
  truncateMessageId?: string | null; // Xóa messages từ ID này khi chỉnh sửa/regenerate
  truncateClientMessageId?: string | null; // Fallback xóa theo clientMessageId
  clientMessageId?: string | null; // UUID định danh tin nhắn phía client
  skipSaveUserMessage?: boolean; // Không lưu tin nhắn user mới
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high"; // Mức độ suy luận
  fileIds?: string[]; // Danh sách UUID file đính kèm (max 10)
  strataSampling?: {
    mode?: "default" | "creative" | "custom";
    temperature?: number;
    top_p?: number;
    top_k?: number;
    min_p?: number;
    presence_penalty?: number;
  };
}
```

### Chat Stream Events (SSE)

Mọi sự kiện SSE được phát qua `sendEvent(controller, event, data)` tại `src/app/api/chat-stream/streaming/utils.ts` theo wire format chuẩn `event: <event>\ndata: <JSON>\n\n`:

```typescript
// event: token
// data: {"t":"..."}
interface TokenEventPayload {
  t: string;
}

// event: thinking (luồng suy luận thời gian thực)
// data: {"thinking":"..."}
interface ThinkingEventPayload {
  thinking: string;
}

// event: meta (Discriminated union theo trường `type`)
type MetaEventPayload =
  | { type: "conversationCreated"; conversation: Conversation }
  | { type: "ragSources"; sources: RagSource[] }
  | { type: "webSearch"; enabled: boolean; available: boolean; cookie?: string }
  | {
      type: "gem";
      gemId: string | null;
      hasSystemInstruction: boolean;
      systemInstructionChars: number;
      error?: string | null;
    }
  | { type: "model"; model: string; isDefault: boolean }
  | { type: "optimisticTitle"; conversationId: string; title: string }
  | { type: "finalTitle"; conversationId: string; title: string }
  | { type: "sources"; sources: WebSearchSource[] }
  | { type: "urlContext"; urls: Array<{ retrievedUrl: string; status: string }> }
  | {
      type: "safety";
      blocked: boolean;
      blockReason?: string | null;
      finishReason?: string | null;
      safetyRatings?: unknown;
    }
  | { type: "webSearchFallback"; message: string }
  | {
      type: "usageMetadata";
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
      cachedContentTokenCount?: number;
      totalTokenCount?: number;
    }
  | { type: "emptyAnswerNotice"; reason: "length" | "no_content" }
  | { type: "localQueue"; position: number }
  | {
      type: "localPromptProgress";
      total: number;
      cache: number;
      processed: number;
      time_ms: number;
    };

// event: done
// data: {"ok":true}
interface DoneEventPayload {
  ok: boolean;
}

// event: error
// data: {"message":"...","code":"...","status":500}
interface ErrorEventPayload {
  message: string;
  code?: string;
  status?: number;
  isTimeout?: boolean;
  isRateLimit?: boolean;
  retryAfter?: number;
  isTokenLimit?: boolean;
  tokenInfo?: unknown;
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
  projectId?: string | null;
}

// PATCH /api/conversations (Update)
interface UpdateConversationRequest {
  id: string; // UUID - Bắt buộc
  title?: string; // Đổi tiêu đề
  gemId?: string | null; // Đổi/xóa GEM
  personaId?: string | null; // Đổi/xóa Persona
  projectId?: string | null; // Chuyển/xóa Project
  model?: string; // Đổi model
}

// POST /api/conversations/[id]/branch (Branch / Fork Conversation)
interface BranchConversationRequest {
  messageId: string; // UUID tin nhắn mốc để rẽ nhánh - Bắt buộc
  titlePrefix?: string; // Tiền tố tiêu đề nhánh (max 40 ký tự)
}
```

---

### Project Operations

```typescript
// POST /api/projects (Create)
// Note: embedding_model is immutable and defaults to "gemini-embedding-2".
// Providing embedding_model in request body returns 400 Bad Request.
interface CreateProjectRequest {
  name: string; // Bắt buộc (max 100)
  description?: string; // Max 500
  icon?: string; // Emoji (mặc định '📁')
  color?: string; // Hex color (#xxxxxx, mặc định '#6366f1')
}

// PATCH /api/projects/[id] (Update)
// Note: embedding_model is immutable.
// Providing embedding_model in request body returns 400 Bad Request.
interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: string;
}

// POST /api/projects/[id]/knowledge (Upload document)
// Note: embedding_model is determined automatically as "gemini-embedding-2".
// Providing embedding_model in request body returns 400 Bad Request.
// Limit: file size <= 5MB, chunks <= 500 (~350-400 KB text).
interface UploadDocumentRequest {
  filename: string; // Bắt buộc
  content: string; // Text content - Bắt buộc (max 5MB)
  mimeType?: string;
}

// POST /api/projects/[id]/knowledge/search (RAG search)
interface KnowledgeSearchRequest {
  query: string; // Search query
  matchThreshold?: number; // Default 0.7
  matchCount?: number; // Default 5
}

// Knowledge Search Result (RPC match_project_knowledge)
interface KnowledgeSearchResult {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
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

| Method                | Endpoint                              | Description                                                |
| --------------------- | ------------------------------------- | ---------------------------------------------------------- |
| POST                  | `/api/chat-stream`                    | Send message, receive multi-provider SSE stream            |
| GET                   | `/api/conversations`                  | List all user conversations                                |
| GET/PUT               | `/api/conversations?id={uuid}`        | Get conversation with decrypted messages                   |
| POST/PATCH/DELETE     | `/api/conversations`                  | Conversation CRUD operations                               |
| POST                  | `/api/conversations/[id]/branch`      | Branch (fork) conversation from a specific message         |
| POST/DELETE           | `/api/messages`                       | Save partial message / delete by `clientMessageId`         |
| DELETE                | `/api/messages/[id]`                  | Delete a single message by ID                              |
| PATCH                 | `/api/messages/[id]/favorite`         | Toggle favorite/bookmark on a message                      |
| PATCH                 | `/api/messages/[id]/tag`              | Add/remove tag on a message                                |
| GET/POST/PATCH/DELETE | `/api/gems`                           | User GEM CRUD operations                                   |
| POST                  | `/api/gems/preview`                   | Preview GEM response with draft instructions               |
| GET/POST/PATCH/DELETE | `/api/personas`                       | User Persona CRUD operations                               |
| GET/POST/DELETE       | `/api/user-templates`                 | User prompt template CRUD                                  |
| POST                  | `/api/prompt-suggest`                 | AI prompt enhancement & suggestion                         |
| POST                  | `/api/files/upload`                   | Upload file (FormData) to Supabase Storage                 |
| GET/DELETE            | `/api/files`                          | List/delete files                                          |
| GET                   | `/api/files/[id]/url`                 | Get signed download URL                                    |
| POST                  | `/api/generate-image`                 | AI image generation (Gemini, DALL-E, Flux)                 |
| POST                  | `/api/edit-image`                     | Single-image AI editing                                    |
| POST                  | `/api/edit-image-multi`               | Multi-reference AI image editing                           |
| POST                  | `/api/describe-image`                 | Vision AI image analysis & prompt extraction               |
| GET                   | `/api/batch-gen-quota`                | Check batch image generation quota                         |
| GET/DELETE            | `/api/gallery`                        | Gallery list & bulk delete                                 |
| DELETE                | `/api/gallery/[id]`                   | Delete single gallery image                                |
| GET                   | `/api/user/allowed-models`            | Get user's allowed models & features by rank               |
| GET/POST              | `/api/projects`                       | List/create projects                                       |
| GET/PATCH/DELETE      | `/api/projects/[id]`                  | Single project CRUD                                        |
| GET/POST/DELETE       | `/api/projects/[id]/knowledge`        | Knowledge document upload & management                     |
| POST                  | `/api/projects/[id]/knowledge/search` | RAG similarity search (`match_project_knowledge`)          |
| GET/PUT               | `/api/novelcrafter/state`             | Load/save encrypted Novelcrafter story state (CAS guarded) |
| POST                  | `/api/novelcrafter/stream`            | Novelcrafter AI writing/editing/feedback SSE stream        |
| GET                   | `/api/local-llm/health`               | Local LLM (Strata) status & FIFO queue health              |
| GET/PATCH             | `/api/admin/users`                    | Admin: user rank & block management                        |
| GET/POST              | `/api/admin/gems`                     | Admin: premade GEM management                              |
| GET/POST/PATCH/DELETE | `/api/admin/personas`                 | Admin: premade Persona management                          |
| GET/PATCH             | `/api/admin/rank-configs`             | Admin: rank configuration                                  |
| GET                   | `/api/admin/audit-log`                | Admin: view administrative audit logs                      |
| GET                   | `/api/admin/stats`                    | Admin: system usage statistics                             |
| GET/POST              | `/api/cron/cleanup`                   | Cron: cleanup expired files (30-day TTL) & stuck RAG docs  |

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
