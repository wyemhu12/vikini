# API Reference - Vikini

> **Cập nhật**: 2026-01-13  
> **Base URL**: `/api`  
> **Runtime**: Node.js (Next.js App Router)

---

## Mục Lục

1. [Xác thực](#1-xác-thực)
2. [Chat Streaming](#2-chat-streaming)
3. [Conversations](#3-conversations)
4. [GEMs](#4-gems)
5. [Attachments](#5-attachments)
6. [Image Generation](#6-image-generation)
7. [Gallery](#7-gallery)
8. [Admin APIs](#8-admin-apis)
9. [Mã Lỗi](#9-mã-lỗi)

---

## 1. Xác Thực

Tất cả các API yêu cầu xác thực thông qua **NextAuth session**. Cookie session được tự động gửi từ browser.

```
Authorization: Session-based (cookie)
```

> [!NOTE]
> Không có Bearer token hay API key. Chỉ hoạt động với browser session.

---

## 2. Chat Streaming

### `POST /api/chat-stream`

Gửi tin nhắn và nhận phản hồi AI dạng streaming (Server-Sent Events).

#### Request Body

```typescript
{
  // ID cuộc hội thoại (nếu đã có)
  conversationId?: string;          // UUID, optional

  // Nội dung tin nhắn người dùng
  content: string;                  // Bắt buộc, min 1 ký tự

  // Tạo lại phản hồi của assistant (không tạo tin nhắn user mới)
  regenerate?: boolean;             // Default: false

  // Xóa các tin nhắn sau messageId này trước khi gửi
  truncateMessageId?: string;       // UUID, optional

  // Không lưu tin nhắn user (dùng khi regenerate)
  skipSaveUserMessage?: boolean;    // Default: false
}
```

#### Response (SSE Stream)

Các event types:

| Event   | Data                                      | Mô tả                            |
| ------- | ----------------------------------------- | -------------------------------- |
| `token` | `{ token: string }`                       | Từng phần của phản hồi AI        |
| `meta`  | `{ conversationId, title, sources, ... }` | Metadata sau khi stream hoàn tất |
| `done`  | `{}`                                      | Kết thúc stream                  |
| `error` | `{ error: string }`                       | Lỗi xảy ra                       |

#### Ví dụ Request

```javascript
const response = await fetch("/api/chat-stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    conversationId: "123e4567-e89b-...",
    content: "Xin chào, hãy giúp tôi viết một câu chuyện",
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parse SSE events...
}
```

#### Errors

| Status | Lỗi                         | Mô tả                           |
| ------ | --------------------------- | ------------------------------- |
| 401    | Unauthorized                | Chưa đăng nhập                  |
| 403    | Access Pending Approval     | Tài khoản chờ admin duyệt       |
| 429    | Daily message limit reached | Vượt giới hạn tin nhắn/ngày     |
| 429    | Rate limit exceeded         | Gửi quá nhanh, retry sau X giây |
| 500    | Internal error              | Lỗi server                      |

---

## 3. Conversations

### `GET /api/conversations`

Lấy danh sách tất cả cuộc hội thoại của user.

#### Response

```typescript
{
  conversations: Array<{
    id: string; // UUID
    title: string; // Tiêu đề chat
    model: string; // Model AI (e.g. "gemini-1.5-flash")
    gemId: string | null; // GEM đang dùng
    updatedAt: string; // ISO timestamp
  }>;
}
```

---

### `GET /api/conversations?id={uuid}`

Lấy chi tiết cuộc hội thoại kèm tin nhắn.

#### Query Parameters

| Param | Type | Mô tả               |
| ----- | ---- | ------------------- |
| `id`  | UUID | ID của conversation |

#### Response

```typescript
{
  conversation: {
    id: string;
    title: string;
    model: string;
    gemId: string | null;
    updatedAt: string;
  },
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;      // Đã giải mã
    meta: object | null;  // sources, attachments, etc.
    createdAt: string;
  }>
}
```

---

### `POST /api/conversations`

Tạo cuộc hội thoại mới.

#### Request Body

```typescript
{
  title?: string;     // Default: "New Chat"
  model?: string;     // Model AI mặc định
  gemId?: string;     // GEM áp dụng (optional)
}
```

#### Response

```typescript
{
  conversation: {
    id: string;
    title: string;
    model: string;
    gemId: string | null;
    updatedAt: string;
  }
}
```

---

### `PATCH /api/conversations`

Cập nhật cuộc hội thoại (đổi tên, đổi GEM, đổi model).

#### Request Body

```typescript
{
  id: string;           // UUID - Bắt buộc

  // Một trong các field sau:
  title?: string;       // Đổi tiêu đề
  gemId?: string | null;// Đổi GEM (null = xóa GEM)
  model?: string;       // Đổi model AI
}
```

#### Response

```typescript
{
  conversation: { ... }  // Conversation đã cập nhật
}
```

---

### `DELETE /api/conversations`

Xóa cuộc hội thoại (kèm messages và attachments).

#### Request Body

```typescript
{
  id: string; // UUID của conversation
}
```

#### Response

```typescript
{
  ok: true;
}
```

---

## 4. GEMs

### `GET /api/gems`

Lấy tất cả GEMs (premade + custom của user).

#### Response

```typescript
{
  gems: Array<{
    id: string;
    slug: string | null; // URL-friendly ID
    name: string;
    description: string;
    icon: string; // Emoji hoặc icon name
    color: string; // Hex color
    isPremade: boolean; // true = GEM hệ thống (read-only)
    latestVersion: number;
    instructions: string; // System prompt
  }>;
}
```

---

### `POST /api/gems`

Tạo GEM mới (custom).

#### Request Body

```typescript
{
  name: string; // Bắt buộc
  description: string; // Bắt buộc
  instructions: string; // System prompt - Bắt buộc
  icon: string; // Emoji
  color: string; // Hex color
}
```

#### Response

```typescript
{
  gem: { ... }  // GEM vừa tạo
}
```

---

### `PATCH /api/gems`

Cập nhật GEM (chỉ custom GEMs, không thể sửa premade).

#### Request Body

```typescript
{
  id: string;             // UUID - Bắt buộc

  // Các field optional:
  name?: string;
  description?: string;
  instructions?: string;  // Tạo version mới nếu thay đổi
  icon?: string;
  color?: string;
}
```

> [!NOTE]
> Khi thay đổi `instructions`, hệ thống tự động tạo bản ghi mới trong `gem_versions` và tăng `latest_version`.

---

### `DELETE /api/gems`

Xóa GEM (chỉ custom GEMs).

#### Request Body

```typescript
{
  id: string; // UUID
}
```

---

## 5. Attachments

### `POST /api/attachments/upload`

Upload file đính kèm vào cuộc hội thoại.

#### Request (FormData)

| Field            | Type   | Mô tả                  |
| ---------------- | ------ | ---------------------- |
| `conversationId` | string | UUID - Bắt buộc        |
| `messageId`      | string | UUID - Optional        |
| `file`           | File   | File upload - Bắt buộc |

#### Định dạng hỗ trợ

| Loại     | Extensions                | Max Size |
| -------- | ------------------------- | -------- |
| Ảnh      | png, jpg, jpeg, webp      | 10MB     |
| Văn bản  | txt, js, jsx, tsx, json   | 2MB      |
| Tài liệu | pdf, doc, docx, xls, xlsx | 20MB     |
| Nén      | zip                       | 20MB     |

#### Response

```typescript
{
  attachment: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    extractedText?: string;  // Nội dung trích xuất (text files)
    tokenCount?: number;
    expiresAt: string;       // Hết hạn sau 36h
  }
}
```

---

### `GET /api/attachments?conversationId={uuid}`

Lấy danh sách attachments của cuộc hội thoại.

---

### `DELETE /api/attachments?id={uuid}`

Xóa attachment theo ID.

### `DELETE /api/attachments?conversationId={uuid}`

Xóa tất cả attachments của cuộc hội thoại.

---

## 6. Image Generation

### `POST /api/generate-image`

Tạo ảnh AI từ prompt.

#### Request Body

```typescript
{
  prompt: string;              // Mô tả ảnh - Bắt buộc
  conversationId: string;      // UUID để lưu message
  options?: {
    model?: string;            // "gemini-imagen-3" | "dall-e-3" | "flux-pro"
    style?: string;            // "anime" | "photorealistic" | "watercolor" | etc.
    aspectRatio?: string;      // "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
    enhancer?: boolean;        // AI cải thiện prompt
    apiKey?: string;           // BYOK cho DALL-E/Flux (optional)
  }
}
```

#### Response

```typescript
{
  success: boolean;
  imageUrl?: string;        // URL ảnh đã tạo
  message?: object;         // Message đã lưu
  error?: string;           // Lỗi (nếu có)
}
```

#### Models & BYOK

| Model             | Provider  | Key Required                           |
| ----------------- | --------- | -------------------------------------- |
| `gemini-imagen-3` | Google    | Không (dùng server key)                |
| `dall-e-3`        | OpenAI    | `vikini-openai-key` từ localStorage    |
| `flux-pro`        | Replicate | `vikini-replicate-key` từ localStorage |

---

## 7. Gallery

### `GET /api/gallery`

Lấy danh sách ảnh đã tạo (chỉ từ chat, không bao gồm Image Studio).

#### Query Parameters

| Param    | Type   | Default | Mô tả            |
| -------- | ------ | ------- | ---------------- |
| `limit`  | number | 20      | Số ảnh mỗi trang |
| `offset` | number | 0       | Vị trí bắt đầu   |

#### Response

```typescript
{
  images: Array<{
    id: string;
    url: string;
    prompt: string;
    createdAt: string;
    aspectRatio?: string;
    style?: string;
    model?: string;
  }>;
  hasMore: boolean; // Còn ảnh để load không
}
```

---

### `DELETE /api/gallery/{id}`

Xóa ảnh khỏi gallery.

#### Response

```typescript
{
  ok: true;
}
```

---

## 8. Admin APIs

> [!WARNING]
> Chỉ users có `rank = 'admin'` mới có quyền truy cập.

### `GET /api/admin/users`

Lấy danh sách tất cả users.

### `PATCH /api/admin/users`

Cập nhật user (đổi rank, block/unblock).

```typescript
{
  id: string;
  rank?: "basic" | "pro" | "admin" | "not_whitelisted";
  isBlocked?: boolean;
}
```

---

### `GET /api/admin/gems`

Lấy tất cả GEMs (bao gồm cả premade để quản lý).

### `POST /api/admin/gems`

Tạo/cập nhật premade GEM (system GEMs).

---

### `GET /api/admin/rank-configs`

Lấy cấu hình cho các ranks.

### `PATCH /api/admin/rank-configs`

Cập nhật cấu hình rank (limits, features, allowed models).

---

## 9. Mã Lỗi

### HTTP Status Codes

| Code | Tên                   | Mô tả                        |
| ---- | --------------------- | ---------------------------- |
| 200  | OK                    | Thành công                   |
| 400  | Bad Request           | Dữ liệu đầu vào không hợp lệ |
| 401  | Unauthorized          | Chưa đăng nhập               |
| 403  | Forbidden             | Không có quyền truy cập      |
| 404  | Not Found             | Không tìm thấy resource      |
| 429  | Too Many Requests     | Rate limit / Daily limit     |
| 500  | Internal Server Error | Lỗi server                   |

### Error Response Format

```typescript
{
  error: string;           // Thông báo lỗi
  message?: string;        // Chi tiết (optional)
  retryAfter?: number;     // Seconds to wait (429 only)
  count?: number;          // Current count (daily limit)
  limit?: number;          // Max limit (daily limit)
}
```

---

## Rate Limiting

| Endpoint           | Limit            | Window          |
| ------------------ | ---------------- | --------------- |
| `/api/chat-stream` | Theo rank config | Per user        |
| Tất cả APIs        | IP-based         | Redis (Upstash) |

Rate limit headers:

```
X-RateLimit-Remaining: 99
Retry-After: 60
```
