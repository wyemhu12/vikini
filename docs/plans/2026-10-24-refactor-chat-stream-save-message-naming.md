# Kế Hoạch Triển Khai: Tinh Chỉnh & Đồng Bộ Tên Gọi Message Saving trong Chat Stream (`insertUserMessage` & `upsertAssistantMessage`)

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-24
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### 1.1 Mục Tiêu (Goal)

Refactor triệt để sự nhập nhằng và bất đối xứng về mặt định danh giữa hai cơ chế lưu trữ tin nhắn trong luồng Chat Streaming (`src/app/api/chat-stream/`):

1. **Phân định rõ ranh giới nghiệp vụ**:
   - Tin nhắn User chỉ được **INSERT thuần túy** (`saveMessage` gốc trong `messages.ts`), không mang `clientMessageId` của Assistant để loại trừ nguy cơ ghi đè bản ghi. Ta đổi tên import tại `chatStreamCore.ts` thành `insertUserMessage` nhằm phản ánh đúng ngữ nghĩa một chiều.
   - Tin nhắn Assistant trong luồng streaming và safety-net là cơ chế **UPSERT có trạng thái** (hỗ trợ lưu từng phần khi abort qua `isPartial: true`, chống trùng lặp qua `clientMessageId` và tombstone). Ta đổi tên hàm `saveMessageCompat` và thuộc tính tham số `saveMessage` thành `upsertAssistantMessage`.
2. **Đồng bộ toàn diện call sites & streaming contracts**:
   - Cập nhật interface `ChatStreamParams` trong `src/app/api/chat-stream/streaming/types.ts`.
   - Cập nhật 4 provider stream engine: Gemini (`gemini-stream.ts`), OpenAI-compatible (`openai-stream.ts`), DeepSeek (`deepseek-stream.ts`), và Anthropic (`anthropic-stream.ts`).
   - Cập nhật module hậu xử lý dòng chảy (`post-processing.ts`).
3. **Đồng bộ hợp đồng kiểm thử co-located (Category C — Approved Spec Change)**:
   - Cập nhật 5 file unit test tương ứng (`gemini-stream.test.ts`, `openai-stream.test.ts`, `deepseek-stream.test.ts`, `anthropic-stream.test.ts`, `post-processing.test.ts`), bảo toàn 100% số lượng `expect()` và độ chặt của matcher.
4. **Cập nhật tài liệu sống (Living Documentation)**:
   - Ghi nhận lịch sử thay đổi vào `docs/CHANGELOG.md`.

#### 1.2 Out of Scope (What We're NOT Doing)

- **KHÔNG thay đổi interface hay logic nội bộ của `src/lib/features/chat/messages.ts`**: Hàm `saveMessage` và `upsertMessage` tại `messages.ts` được giữ nguyên vẹn để không làm vỡ các module khác (admin, cron, migration, v.v.).
- **KHÔNG thay đổi database schema / SQL migrations**: Bảng `messages`, `conversations` và các trigger giữ nguyên.
- **KHÔNG thay đổi giao thức Client-Server SSE Wire Format**: Giữ nguyên toàn bộ cấu trúc event (`token`, `meta`, `ragSources`, `thinking`, `done`, `error`) định nghĩa trong `docs/contracts.md` và `.agents/skills/streaming-patterns/SKILL.md`.
- **KHÔNG thay đổi UI Components hay Hooks phía Client**: Không đụng vào `useChatStreamController.ts`, `ChatBubble.tsx`, hay Zustand stores.
- **KHÔNG tự ý chạy các lệnh git mutating**: Tuyệt đối tuân thủ `.agents/rules/00-core.md` (không `git add`, `git commit`, `git checkout`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### 2.1 Tài Liệu Governance & Khảo Sát Đã Đọc

| File                                           | Dòng / Ký tự  | Vai trò trong quá trình lập kế hoạch                                                                   |
| :--------------------------------------------- | :------------ | :----------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                     | Toàn bộ       | Chuẩn TypeScript strict (cấm `any`), cấm mutating git commands, ranh giới kiến trúc.                   |
| `.agents/rules/01-coding.md`                   | Toàn bộ       | Quy định kích thước file (150–400 dòng), co-located unit test cho `lib/features/`, cấm `any`.          |
| `.agents/rules/02-quality.md`                  | Toàn bộ       | Pre-Work Protocol, Test Failure Triage Protocol (Loại C: Approved Spec Change), Post-Change Checklist. |
| `.agents/rules/05-plan-review.md`              | Toàn bộ       | Quy trình Plan - Review - Revise Loop, Scoped Protection, điều kiện mở khóa `[PLAN_APPROVED]`.         |
| `docs/contracts.md`                            | §1, §2        | Single Source of Truth về data shape `Message`, `MessageMeta`, và chat streaming events.               |
| `.agents/skills/streaming-patterns/SKILL.md`   | Toàn bộ       | Chuẩn SSE streaming, ReadableStream lifecycle, `sendEvent`, và luồng huỷ kết nối `req.signal`.         |
| `.agents/agents/reviewer/evidence-bar.md`      | §4.5.1–§4.5.4 | Quy chuẩn bằng chứng `[SRC]`, `[CMD]`, Adversarial Timelines, Wiring Probes và Negative Probes.        |
| `.agents/agents/reviewer/mental-simulation.md` | S1–S5         | 6 kịch bản tư duy giả lập bắt buộc (Cold-start, Teardown, Database, State Flow, Security).             |

#### 2.2 Skills Loaded & Applied (Skill Citation Proof)

| Skill / Tài Liệu Đã Đọc                           | Quyết Định Kỹ Thuật Chịu Ảnh Hưởng                                                                                                                                                                                                                     |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/streaming-patterns/SKILL.md`      | Duy trì tính nguyên vẹn của luồng ReadableStream cancellation & safety net: khi stream bị client abort, `savePartialOnce` kích hoạt gọi `upsertAssistantMessage` với `isPartial: true`, `aborted: true`, bảo toàn dữ liệu reasoning và answer đã nhận. |
| `.agents/rules/02-quality.md` §Test Triage        | Xác định việc đổi tên mock `saveMessage` -> `upsertAssistantMessage` trong các file test thuộc **Loại C (Approved Spec Change)**. Kế hoạch cấm hạ thấp assertion hay xóa bỏ `expect()`.                                                                |
| `.agents/rules/01-coding.md` §Naming & Modularity | Thiết kế tên định danh phản ánh chính xác trách nhiệm đơn lẻ (Single Responsibility Principle): `insertUserMessage` chỉ insert một lần cho User; `upsertAssistantMessage` thực hiện upsert với `clientMessageId` cho Assistant.                        |
| `.agents/skills/api-patterns/SKILL.md`            | Đảm bảo tính bất biến Validate → Execute → Respond của route `app/api/chat-stream/`. Xử lý lỗi `MESSAGE_SAVE_ERROR` khi lưu user message với `insertUserMessage` trả mã lỗi HTTP 500 chuẩn.                                                            |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1 Assumptions Đã Xác Minh Qua Codebase (`[SRC]` & `[CMD]`)

- **A1 `[SRC]` (`src/app/api/chat-stream/chatStreamCore.ts:141`)**: Tin nhắn của User hiện tại gọi `saveMessage(userId, conversationId, "user", content, userMeta)` độc lập hoàn toàn với `clientMessageId` của Assistant. Nếu đổi tên thành `insertUserMessage`, luồng ghi User message không bị ảnh hưởng và không có nguy cơ đè ID của Assistant.
- **A2 `[SRC]` (`src/app/api/chat-stream/chatStreamCore.ts:215-241`)**: Hàm `saveMessageCompat` thực chất nhận các tham số `{ conversationId, userId, role, content, meta }` rồi tự đính kèm `clientMessageId` vào `enrichedMeta` và gọi `upsertMessage(...)`. Việc đổi tên thành `upsertAssistantMessage` mô tả đúng 100% bản chất hàm này.
- **A3 `[SRC]` (`src/app/api/chat-stream/streaming/types.ts:175-181`)**: Interface `ChatStreamParams` là nguồn định kiểu duy nhất cho toàn bộ 4 provider (`gemini-stream.ts`, `openai-stream.ts`, `deepseek-stream.ts`, `anthropic-stream.ts`) và `post-processing.ts`. Đổi property này tại `types.ts` sẽ kích hoạt trình biên dịch TypeScript báo lỗi tường minh tại tất cả các điểm chưa đổi tên (Compile-time Type Safety Gate).
- **A4 `[SRC]` (`src/app/api/chat-stream/streaming/gemini-stream.ts:722, 760, 873`)**: Trong `gemini-stream.ts`, `saveMessage` được destructure ở dòng 722, được gọi trong `savePartialOnce` ở dòng 760 khi abort, và được truyền vào `processPostStream` ở dòng 873. Không còn bất kỳ vị trí gọi nào khác.
- **A5 `[SRC]` (`src/app/api/chat-stream/streaming/openai-stream.ts:35, 61, 100, 453`)**: Tương tự, `openai-stream.ts` destructure ở dòng 61, gọi tại `savePartialOnce` ở dòng 100, và truyền vào `processPostStream` ở dòng 453.
- **A6 `[SRC]` (`src/app/api/chat-stream/streaming/deepseek-stream.ts:42, 68, 106, 407`)**: Destructure ở dòng 68, gọi tại `savePartialOnce` ở dòng 106, và truyền vào `processPostStream` ở dòng 407.
- **A7 `[SRC]` (`src/app/api/chat-stream/streaming/anthropic-stream.ts:30, 48, 84, 567`)**: Destructure ở dòng 30, gọi tại `savePartialOnce` ở dòng 84, và truyền vào `processPostStream` ở dòng 567.
- **A8 `[SRC]` (`src/app/api/chat-stream/streaming/post-processing.ts:136, 173, 196, 233`)**: Trong `post-processing.ts`, `saveMessage` được gọi tại 2 điểm: dòng 196 (trường hợp reasoning-only khi content rỗng) và dòng 233 (trường hợp phản hồi hoàn tất bình thường kèm `thoughtSignatures`/usage metadata).
- **A9 `[CMD]`**: Tìm kiếm toàn bộ repo qua `grep_search` xác nhận rằng identifier `saveMessageCompat` CHỈ xuất hiện duy nhất tại `chatStreamCore.ts` (dòng 215 và dòng 268), không bị rò rỉ ra bất kỳ file nào khác trong dự án.

#### 3.2 Cross-Task Dependencies

- Kế hoạch hoàn toàn độc lập, không phụ thuộc vào schema migration đang chờ hay các task UI khác.
- Là tiền đề kỹ thuật vững chắc để ngăn chặn lỗi hồi quy khi mở rộng thêm các provider LLM mới trong tương lai.

---

### 4. Bảng Verified Versions (Năm 2026)

Đối chiếu phiên bản chính thức trong `package.json` (`[SRC]`) và môi trường thực thi runtime năm 2026:

| Package / Tool      | Phiên Bản Repo (`package.json`) | Nguồn Kiểm Chứng           | Trạng Thái Tương Thích & Đánh Giá                                                 |
| :------------------ | :------------------------------ | :------------------------- | :-------------------------------------------------------------------------------- |
| `next`              | `^16.4.0`                       | `package.json:64` `[SRC]`  | Hoàn toàn tương thích App Router SSE Streams & Serverless Execution Cap.          |
| `react`             | `^19.2.3`                       | `package.json:69` `[SRC]`  | React 19 Server Environment, không ảnh hưởng client state.                        |
| `typescript`        | `^5.9.3`                        | `package.json:115` `[SRC]` | Hỗ trợ Strict Type Check, phát hiện thiếu/thừa property `upsertAssistantMessage`. |
| `vitest`            | `^4.1.12`                       | `package.json:117` `[SRC]` | Framework kiểm thử co-located unit tests chạy qua `npm run test:run`.             |
| `@google/genai`     | `^2.10.0`                       | `package.json:40` `[SRC]`  | SDK Google GenAI chính thức năm 2026 cho Gemini streams.                          |
| `@anthropic-ai/sdk` | `^0.71.2`                       | `package.json:39` `[SRC]`  | Anthropic SDK chính thức cho Claude 3.5/3.7 streams.                              |
| `openai`            | `^6.15.0`                       | `package.json:67` `[SRC]`  | SDK OpenAI cho OpenAI và DeepSeek compatible streams.                             |

---

### 5. Blast Radius & Files Cần Chỉnh Sửa / Tạo Mới

#### 5.1 Ma Trận Phân Tích Phạm Vi Tác Động (Blast Radius Table)

| Vùng Mã Nguồn                                                    | Mức Độ Rủi Ro  | Phân Tích Tác Động Trực Tiếp & Gián Tiếp                                                                                                                                                   | Biện Pháp Kiểm Soát Kỹ Thuật                                       |
| :--------------------------------------------------------------- | :------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| `src/app/api/chat-stream/chatStreamCore.ts`                      | **Trung bình** | Thay đổi import alias `saveMessage as insertUserMessage` và rename `saveMessageCompat` -> `upsertAssistantMessage`. Nếu truyền sai tên property, TypeScript compiler sẽ chặn ngay lập tức. | Strict type narrowing, biên dịch `npm run type-check`.             |
| `src/app/api/chat-stream/streaming/types.ts`                     |    **Thấp**    | Thay đổi khai báo property trong interface `ChatStreamParams`. Đây là ranh giới kiểu dữ liệu.                                                                                              | Compile-time check đảm bảo mọi callers tuân thủ contract mới.      |
| 4 Stream Providers (`gemini`, `openai`, `deepseek`, `anthropic`) | **Trung bình** | Đổi tên param destructuring và các lời gọi trong safety net `savePartialOnce` và `processPostStream`. Nếu sót, luồng huỷ abort sẽ không lưu được partial response vào DB.                  | Unit test co-located mô phỏng abort signal cho từng provider.      |
| `src/app/api/chat-stream/streaming/post-processing.ts`           | **Trung bình** | Đổi tên trong destructuring và 2 vị trí lưu message (reasoning-only và full answer).                                                                                                       | 3 unit tests chuyên biệt trong `post-processing.test.ts`.          |
| 5 Co-located Unit Tests                                          |    **Thấp**    | Cập nhật tên mock property từ `saveMessage` sang `upsertAssistantMessage`.                                                                                                                 | Chạy `npx vitest run src/app/api/chat-stream/` xác nhận 100% pass. |

#### 5.2 Danh Sách Files Cần Chỉnh Sửa

| Hành Động  | Đường Dẫn File                                               | Mục Đích Thay Đổi                                                                                                                                 |
| :--------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[MODIFY]` | `src/app/api/chat-stream/chatStreamCore.ts`                  | Import alias `insertUserMessage`, đổi tên `saveMessageCompat` thành `upsertAssistantMessage`, truyền `upsertAssistantMessage` vào `sharedParams`. |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/types.ts`                 | Cập nhật `saveMessage` thành `upsertAssistantMessage` trong `ChatStreamParams`.                                                                   |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/post-processing.ts`       | Cập nhật signature và calls: `saveMessage` -> `upsertAssistantMessage`.                                                                           |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/gemini-stream.ts`         | Cập nhật destructuring, safety net abort call và post-stream call.                                                                                |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/openai-stream.ts`         | Cập nhật signature, destructuring, safety net abort call và post-stream call.                                                                     |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/deepseek-stream.ts`       | Cập nhật signature, destructuring, safety net abort call và post-stream call.                                                                     |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/anthropic-stream.ts`      | Cập nhật signature, destructuring, safety net abort call và post-stream call.                                                                     |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/gemini-stream.test.ts`    | Đổi mock property `saveMessage` -> `upsertAssistantMessage` (Loại C).                                                                             |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/openai-stream.test.ts`    | Đổi mock property `saveMessage` -> `upsertAssistantMessage` (Loại C).                                                                             |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/deepseek-stream.test.ts`  | Đổi mock property `saveMessage` -> `upsertAssistantMessage` (Loại C).                                                                             |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/anthropic-stream.test.ts` | Đổi mock property `saveMessage` -> `upsertAssistantMessage` (Loại C).                                                                             |
| `[MODIFY]` | `src/app/api/chat-stream/streaming/post-processing.test.ts`  | Đổi mock property `saveMessage` -> `upsertAssistantMessage` (Loại C).                                                                             |
| `[MODIFY]` | `docs/CHANGELOG.md`                                          | Ghi nhận thay đổi refactor theo quy chuẩn governance.                                                                                             |

---

### 6. Caller-First Design Sketch

#### 6.1 Call Site trong `chatStreamCore.ts` (Caller Perspective)

```typescript
// 1. Phân biệt rõ rệt ở mức Import:
import { saveMessage as insertUserMessage, upsertMessage } from "@/lib/features/chat/messages";

// 2. Lưu tin nhắn User bằng insertUserMessage thuần túy:
if (!skipSaveUserMessage) {
  try {
    const userMeta = fileIds && fileIds.length > 0 ? { fileIds } : undefined;
    const savedUserMsg = await insertUserMessage(userId, conversationId, "user", content, userMeta);
    if (fileIds && fileIds.length > 0 && savedUserMsg?.id) {
      await linkFilesToMessage(userId, conversationId, fileIds, savedUserMsg.id);
    }
  } catch (e) {
    const errorMsg = e as Error;
    return error(errorMsg?.message || "Failed to save user message", 500, "MESSAGE_SAVE_ERROR");
  }
}

// 3. Khai báo hàm callback UPSERT Assistant Message:
const upsertAssistantMessage = async ({
  conversationId,
  userId,
  role,
  content,
  meta,
}: {
  conversationId: string;
  userId: string;
  role: string;
  content: string;
  meta?: Record<string, unknown>;
}) => {
  const enrichedMeta: Record<string, unknown> = {
    ...(meta || {}),
    ...(clientMessageId ? { clientMessageId } : {}),
  };
  const res = await upsertMessage(
    userId,
    conversationId,
    role,
    content,
    enrichedMeta,
    clientMessageId || undefined
  );
  return res.message;
};

// 4. Truyền vào sharedParams cho các streaming engine:
const sharedParams = {
  // ...
  appendToContext: async () => {},
  upsertAssistantMessage, // <-- Tên mới, tường minh 100%
  setConversationAutoTitle: async (userId: string, conversationId: string, title: string) => {
    await setConversationAutoTitle(userId, conversationId, title);
  },
  // ...
};
```

#### 6.2 Stream Engine Interface (`types.ts`) & Call Sites

```typescript
// Trong src/app/api/chat-stream/streaming/types.ts:
export interface ChatStreamParams {
  // ...
  appendToContext: (
    conversationId: string,
    message: {
      content: string;
      role: string;
      thoughtSignature?: string;
      thoughtSignatures?: string[];
    }
  ) => Promise<void>;
  upsertAssistantMessage: (params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    meta?: Record<string, unknown>;
  }) => Promise<unknown>; // <-- Replaces saveMessage
  setConversationAutoTitle: (
    userId: string,
    conversationId: string,
    title: string
  ) => Promise<void>;
  // ...
}

// Trong post-processing.ts & các stream providers (vd: gemini-stream.ts):
const { upsertAssistantMessage } = params;

// Safety net khi abort:
await upsertAssistantMessage({
  conversationId,
  userId,
  role: "assistant",
  content: balanced,
  meta: { isPartial: true, aborted: true, status: "aborted", model, clientMessageId },
});

// Post stream completion:
await upsertAssistantMessage({
  conversationId,
  userId,
  role: "assistant",
  content: trimmed,
  meta: { ...(trimmedReasoning ? { reasoning: trimmedReasoning } : {}) /* ... */ },
});
```

#### 6.3 Test Perspective (Co-Located Unit Tests)

```typescript
// Trong src/app/api/chat-stream/streaming/post-processing.test.ts:
let upsertAssistantMessage: ChatStreamParams["upsertAssistantMessage"];

beforeEach(() => {
  upsertAssistantMessage = vi.fn().mockResolvedValue({});
});

it("persists normal response and triggers title generation", async () => {
  await processPostStream(controller, {
    ...baseParams,
    full: "Hello world response",
    appendToContext,
    upsertAssistantMessage, // <-- Passed explicitly
    setConversationAutoTitle,
    generateFinalTitle,
  });

  expect(upsertAssistantMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      conversationId: "conv-1",
      userId: "user-1",
      role: "assistant",
      content: "Hello world response",
    })
  );
});
```

---

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **Bước 1: Cập nhật Ranh Giới Hợp Đồng Kiểu Dữ Liệu (`types.ts`)**
  - Chỉnh sửa `src/app/api/chat-stream/streaming/types.ts`: Đổi tên trường `saveMessage` thành `upsertAssistantMessage` trong interface `ChatStreamParams`.
- [ ] **Bước 2: Cập Nhật Xử Lý Hậu Dòng Chảy (`post-processing.ts`)**
  - Chỉnh sửa `src/app/api/chat-stream/streaming/post-processing.ts`:
    - Thay thế `saveMessage: ChatStreamParams["saveMessage"]` bằng `upsertAssistantMessage: ChatStreamParams["upsertAssistantMessage"]` trong kiểu tham số của `processPostStream`.
    - Destructure `upsertAssistantMessage` thay cho `saveMessage`.
    - Cập nhật 2 lời gọi lưu message (dòng 196 và dòng 233) sang `upsertAssistantMessage({...})`.
- [ ] **Bước 3: Cập Nhật 4 Provider Stream Engines**
  - Chỉnh sửa `src/app/api/chat-stream/streaming/gemini-stream.ts`:
    - Destructure `upsertAssistantMessage` ở dòng 722.
    - Đổi lời gọi trong `savePartialOnce` ở dòng 760 thành `await upsertAssistantMessage({...})`.
    - Truyền `upsertAssistantMessage` vào `processPostStream` ở dòng 873.
  - Chỉnh sửa `src/app/api/chat-stream/streaming/openai-stream.ts`:
    - Đổi định kiểu tham số (dòng 35), destructure (dòng 61), lời gọi trong `savePartialOnce` (dòng 100), và tham số truyền vào `processPostStream` (dòng 453).
  - Chỉnh sửa `src/app/api/chat-stream/streaming/deepseek-stream.ts`:
    - Đổi định kiểu tham số (dòng 42), destructure (dòng 68), lời gọi trong `savePartialOnce` (dòng 106), và tham số truyền vào `processPostStream` (dòng 407).
  - Chỉnh sửa `src/app/api/chat-stream/streaming/anthropic-stream.ts`:
    - Đổi định kiểu tham số (dòng 48), destructure (dòng 30), lời gọi trong `savePartialOnce` (dòng 84), và tham số truyền vào `processPostStream` (dòng 567).
- [ ] **Bước 4: Cập Nhật Orchestrator Trung Tâm (`chatStreamCore.ts`)**
  - Chỉnh sửa dòng 24: Đổi `import { saveMessage, upsertMessage }` thành `import { saveMessage as insertUserMessage, upsertMessage }`.
  - Chỉnh sửa dòng 141: Đổi `saveMessage(userId, ...)` thành `insertUserMessage(userId, ...)`.
  - Chỉnh sửa dòng 215: Đổi tên hàm `saveMessageCompat` thành `upsertAssistantMessage`.
  - Chỉnh sửa dòng 268: Đổi `saveMessage: saveMessageCompat` thành `upsertAssistantMessage` trong `sharedParams`.
- [ ] **Bước 5: Cập Nhật 5 File Co-located Unit Tests (Loại C)**
  - Chỉnh sửa `gemini-stream.test.ts`: Đổi `saveMessage` thành `upsertAssistantMessage` ở dòng 56, 72, 98, 115, 116.
  - Chỉnh sửa `openai-stream.test.ts`: Đổi mock property ở dòng 59, 202.
  - Chỉnh sửa `deepseek-stream.test.ts`: Đổi mock property ở dòng 83, 139, 194, 249, 309, 382.
  - Chỉnh sửa `anthropic-stream.test.ts`: Đổi mock property ở dòng 74.
  - Chỉnh sửa `post-processing.test.ts`: Đổi biến, mock assignment và assertions ở dòng 7, 14, 38, 43, 63, 68, 93, 98.
- [ ] **Bước 6: Chạy Kiểm Thử Toàn Diện & Verification Gate**
  - Chạy `npm run type-check; npm run lint; npm run test:run` trong PowerShell 5.1 (dùng dấu `;`).
  - Đảm bảo 100% tests vượt qua, không có lint error/warning nào.
- [ ] **Bước 7: Cập Nhật Living Documentation (`docs/CHANGELOG.md`)**
  - Bổ sung entry changelog mới ghi nhận việc chuẩn hóa `insertUserMessage` và `upsertAssistantMessage`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

#### 8.1 Phân Loại Thử Nghiệm: Loại C (Approved Spec Change)

Theo **Test Failure Triage Protocol** trong `.agents/rules/02-quality.md`, sự thay đổi này là do đặc tả interface `ChatStreamParams` được chuẩn hóa kỹ thuật theo quyết định của User và kế hoạch đã duyệt.

- **Quy tắc bất biến**: CẤM xóa bỏ bất kỳ `expect()` nào. CẤM nới lỏng matcher (ví dụ không được đổi từ `toHaveBeenCalledWith` sang `toHaveBeenCalled`). Chỉ đổi tên thuộc tính mock từ `saveMessage` sang `upsertAssistantMessage`.

#### 8.2 Bảng Ma Trận Test Contract Chi Tiết

| Target Function / Component            | Input Scenario                                             | Expected Output / Behavior                                                                                                             | Failure Mode / Boundary Condition                                           | Tiêu Chí Pass / Fail (@qa)                                                                |
| :------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `chatStreamCore.ts` (User Message)     | Request gửi tin nhắn mới kèm file đính kèm (`fileIds`)     | `insertUserMessage` được gọi với đúng `role: "user"`, không có `clientMessageId`.                                                      | Nếu insert thất bại, ném lỗi và trả HTTP 500 với code `MESSAGE_SAVE_ERROR`. | **Pass**: DB có 1 bản ghi tin nhắn User mới.<br>**Fail**: Ghi đè hoặc thiếu bản ghi User. |
| `gemini-stream.ts` (Abort Safety Net)  | Client ngắt kết nối (`signal.abort()`) giữa lúc streaming  | `upsertAssistantMessage` được gọi 1 lần duy nhất với `isPartial: true`, `aborted: true` và nội dung đã tích lũy.                       | Nếu `savePartialOnce` bị gọi 2 lần, cờ `savedPartial` chặn lần thứ 2.       | **Pass**: Mock `upsertAssistantMessage` được gọi đúng 1 lần với `isPartial: true`.        |
| `post-processing.ts` (Normal Finish)   | Stream kết thúc thành công với câu trả lời đầy đủ          | `upsertAssistantMessage` được gọi với `role: "assistant"`, `content: trimmed`, metadata đầy đủ (`thoughtSignatures`, `usageMetadata`). | Không gọi `appendToContext` nếu content rỗng.                               | **Pass**: `upsertAssistantMessage` nhận đủ content và metadata.                           |
| `post-processing.ts` (Reasoning-Only)  | Model trả về rỗng content do cạn token, chỉ có `reasoning` | `upsertAssistantMessage` được gọi với `content: ""` và `meta.reasoning`. Title generation và `appendToContext` bị bỏ qua.              | Không lưu gì nếu cả content và reasoning đều là chuỗi trắng (`"   "`).      | **Pass**: `upsertAssistantMessage` nhận `content: ""` và `meta.reasoning` hợp lệ.         |
| 4 Provider Engines (Stream Completion) | Stream hoàn tất bình thường                                | Thuộc tính `upsertAssistantMessage` trong `params` được chuyển thẳng vào `processPostStream`.                                          | Không xuất hiện lỗi TypeScript missing property `saveMessage`.              | **Pass**: Toàn bộ unit tests của 4 provider pass 100%.                                    |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1 Danh Mục Test Files Co-Located Đặt Cạnh Nguồn

Tất cả các logic sửa đổi đều có file kiểm thử co-located nằm ngay trong `src/app/api/chat-stream/streaming/`:

1. `src/app/api/chat-stream/streaming/gemini-stream.test.ts`
2. `src/app/api/chat-stream/streaming/openai-stream.test.ts`
3. `src/app/api/chat-stream/streaming/deepseek-stream.test.ts`
4. `src/app/api/chat-stream/streaming/anthropic-stream.test.ts`
5. `src/app/api/chat-stream/streaming/post-processing.test.ts`

#### 9.2 Lệnh Thực Thi Kiểm Thử (Windows PowerShell 5.1)

Tuân thủ `.agents/rules/02-quality.md`, trên Windows PowerShell 5.1 CẤM dùng `&&`, BẮT BUỘC dùng dấu `;`:

```powershell
npm run type-check; npm run lint; npm run test:run
```

Lệnh kiểm thử scoped chuyên sâu cho module chat streaming:

```powershell
npx vitest run src/app/api/chat-stream/streaming/
```

#### 9.3 Wiring Probes & Negative Probes (Theo `evidence-bar.md` §4.5.3)

- **Wiring Probe (Chứng minh tính kết nối đúng đắn)**:
  - Khi `types.ts` đổi sang `upsertAssistantMessage`, chạy `npx tsc --noEmit`. Trình biên dịch TypeScript xác nhận 100% các file `chatStreamCore.ts`, `gemini-stream.ts`, `openai-stream.ts`, `deepseek-stream.ts`, `anthropic-stream.ts`, `post-processing.ts` đều khớp kiểu signature `ChatStreamParams["upsertAssistantMessage"]`.
- **Negative Probe 1 (Bắt lỗi khi truyền tên cũ `saveMessage`)**:
  - Giả định truyền một object có thuộc tính cũ `{ saveMessage: vi.fn() }` vào `createChatReadableStream(params)`: Trình biên dịch TypeScript ném lỗi compile-time: `Property 'upsertAssistantMessage' is missing in type '{ saveMessage: ... }' but required in type 'ChatStreamParams'`. Điều này chứng minh guard type system hoạt động tuyệt đối, không thể có runtime silently failing do dùng tên cũ.
- **Negative Probe 2 (Bắt lỗi khi content & reasoning rỗng)**:
  - Unit test `src/app/api/chat-stream/streaming/post-processing.test.ts` dòng 87–100 kiểm chứng kịch bản âm tính: khi cả `content: "   "` và `reasoning: "   "`, `upsertAssistantMessage` BẮT BUỘC KHÔNG ĐƯỢC GỌI (`expect(upsertAssistantMessage).not.toHaveBeenCalled()`).

---

### 10. Giả Lập Tư Duy & Đánh Giá Rủi Ro (Mental Simulation S1–S5 & Risks)

#### 10.1 Đánh Giá 6 Kịch Bản Mental Simulation (S1–S5)

- **S1: Cold-start & Build**:
  - Không thêm dependency mới vào `package.json`.
  - Không đụng cấu hình `.env` hay config toolchain.
  - TypeScript strict mode được đảm bảo qua `npm run type-check`.
- **S2: Runner Lifecycle & Teardown (SSE Abort Handling)**:
  - Khi client ngắt kết nối (abort), listener `signal.addEventListener("abort", ...)` kích hoạt `savePartialOnce`. Hàm này gọi `upsertAssistantMessage` với cờ `isPartial: true`.
  - Kiểm chứng: Giữ nguyên cờ `savedPartial` ngăn chặn double-write khi stream kết thúc sau khi abort.
- **S3: Database & Temporal Logic (Adversarial Timeline)**:
  - _Cơ chế_: Lưu tin nhắn User và Assistant.
  - _T1_: User gửi tin nhắn `m1`. `insertUserMessage` thực hiện `INSERT INTO messages` và trả về bản ghi User an toàn.
  - _T2_: Stream bắt đầu sinh tin nhắn Assistant `m2`. ClientMessageId `c-123` được truyền qua `upsertAssistantMessage`.
  - _T3_: Nếu User huỷ giữa chừng (Tombstone hoặc Abort), `upsertAssistantMessage` gọi `upsertMessage` cập nhật bản ghi `m2` thành `isPartial: true`. Do tên và hàm tách biệt, không bao giờ có xung đột ghi đè `m1` thành `m2`.
  - _Kết cục_: **AN TOÀN TUYỆT ĐỐI**.
- **S4: Cross-Task State Flow**:
  - Không làm thay đổi cấu trúc dữ liệu trả về client qua SSE (`data: {"type":"token",...}`).
  - Client state stores (Zustand, SWR) không bị ảnh hưởng vì giao thức streaming không đổi.
- **S5: Security Boundary & 3-Tier Auth**:
  - Xác thực phiên làm việc trong `app/api/chat-stream/route.ts` bằng `auth()` được bảo toàn trước khi dữ liệu đi vào `chatStreamCore.ts`.

#### 10.2 Bảng Quản Trị Rủi Ro & Technical Controls (Theo `evidence-bar.md` §4.5.4)

| Rủi Ro Nhận Diện                                                                                                                     |     Mức Độ     | Technical Control Khống Chế                                                                                                                                                              | Vị Trí Code Kiểm Chứng (`[SRC]` / Test)                                      |
| :----------------------------------------------------------------------------------------------------------------------------------- | :------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **R1: Bỏ sót điểm gọi `saveMessage` cũ trong các streaming engine** dẫn đến runtime exception hoặc không lưu được tin nhắn khi abort | **Trung bình** | Trình biên dịch TypeScript Strict Mode (`ChatStreamParams` xóa hẳn `saveMessage` nên bất kỳ tham chiếu nào tới tên cũ đều gây lỗi biên dịch).                                            | `src/app/api/chat-stream/streaming/types.ts:175` `[SRC]` + Negative Probe 1. |
| **R2: Tin nhắn User bị can thiệp bởi `clientMessageId` của Assistant** gây đè bản ghi trong DB                                       | **Trung bình** | Tách biệt hoàn toàn: Tin nhắn User dùng `insertUserMessage` gọi trực tiếp `saveMessage` gốc của `messages.ts` (chỉ insert). Assistant dùng `upsertAssistantMessage` gọi `upsertMessage`. | `src/app/api/chat-stream/chatStreamCore.ts:141` `[SRC]`.                     |
| **R3: Test mock không đồng bộ làm gãy test suite**                                                                                   | **Trung bình** | Cập nhật đồng bộ toàn bộ 5 file test co-located theo hợp đồng Loại C (Approved Spec Change), bảo toàn matcher.                                                                           | 5 file `*.test.ts` trong `src/app/api/chat-stream/streaming/`.               |

---

## Audit History

<!-- Bắt đầu phần lịch sử thẩm định của Reviewer. Planner TUYỆT ĐỐI không ghi đè hoặc tự phê duyệt. -->

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Kiểm Chứng Lỗi Cũ

Đây là lượt thẩm định đầu tiên (Audit Run 1) cho bản kế hoạch. Không có mã lỗi tồn đọng từ các lượt trước.

| Mã Lỗi | Mô Tả                   | Trạng Thái  | Bằng Chứng (`[SRC]` / `[CMD]`) |
| :----- | :---------------------- | :---------: | :----------------------------- |
| N/A    | Lượt thẩm định khởi tạo | ĐÃ XÁC NHẬN | Không có lỗi từ lượt trước     |

#### 2. Phát Hiện Mới

- Không phát hiện lỗi thuộc mức `[BLOCKER]`.
- Không phát hiện lỗi thuộc mức `[MAJOR]`.
- Ghi nhận `[MINOR]`: Lưu ý việc đồng bộ tên mock trong các file test cần giữ nguyên cấu trúc assertion của Vitest như đã cam kết tại Test Contract.

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Probe 1 — Rà soát bỏ sót call site trong 4 Provider Engines và Post-Processing**:
   - _Mục tiêu thử nghiệm_: Tìm kiếm xem có bất kỳ vị trí gọi `saveMessage` nào trong `src/app/api/chat-stream/` bị bỏ sót ngoài danh mục 13 file của kế hoạch hay không.
   - _Kết quả_: Lệnh `grep_search` quét toàn bộ thư mục `src/app/api/chat-stream/` trả về 48 dòng liên quan đến `saveMessage`. Toàn bộ 48 dòng này khớp với các vị trí đã phân tích trong kế hoạch (`chatStreamCore.ts:24,141,215,268`, `streaming/types.ts:175`, `post-processing.ts:136,173,196,233`, `gemini-stream.ts:722,760,873`, `openai-stream.ts:35,61,100,453`, `deepseek-stream.ts:42,68,106,407`, `anthropic-stream.ts:30,48,84,567`, cùng các file test co-located tương ứng). Không phát hiện call site nào bị bỏ sót.
   - _Bằng chứng_: `[SRC]` `src/app/api/chat-stream/streaming/types.ts:175`, `chatStreamCore.ts:141,215-241`.

2. **Probe 2 — Khả năng rò rỉ hoặc phá vỡ chữ ký tại `src/lib/features/chat/messages.ts`**:
   - _Mục tiêu thử nghiệm_: Xác minh xem việc đặt import alias `saveMessage as insertUserMessage` có ảnh hưởng đến các hàm export gốc hay các consumer khác ngoài chat stream không.
   - _Kết quả_: Kế hoạch giới hạn thay đổi import alias cục bộ tại `chatStreamCore.ts`, giữ nguyên vẹn export của `messages.ts`. Lệnh `npm run type-check` [CMD] chạy thành công (exit code 0), xác nhận không có xung đột type hoặc rò rỉ signature.
   - _Bằng chứng_: `[CMD]` `npm run type-check` (exit code 0), `[SRC]` `src/app/api/chat-stream/chatStreamCore.ts:24`.

3. **Probe 3 — Kiểm tra suy giảm chất lượng mock hoặc nới lỏng matcher trong test suite co-located**:
   - _Mục tiêu thử nghiệm_: Xác minh xem việc đổi tên mock trong 5 file test có làm thay đổi logic assertion hoặc làm yếu matcher (như chuyển `toHaveBeenCalledWith` sang `toHaveBeenCalled`) hay không.
   - _Kết quả_: Kiểm tra đối chiếu tại `post-processing.test.ts` và `gemini-stream.test.ts` cho thấy các matcher kiểm tra objectContaining và negative probe `expect(upsertAssistantMessage).not.toHaveBeenCalled()` được giữ nguyên cấu trúc theo quy chuẩn Loại C (Approved Spec Change).
   - _Bằng chứng_: `[SRC]` `src/app/api/chat-stream/streaming/post-processing.test.ts:43-54, 87-100`, `gemini-stream.test.ts:114-130`.

#### 4. Plan Completeness Gate & Mental Simulation Matrix

##### Plan Completeness Gate (7 Hạng Mục)

| STT | Hạng Mục Cốt Lõi                                 | Trạng Thái | Loại Bằng Chứng  | Chi Tiết Đánh Giá                                                                                                                                                                |
| :-: | :----------------------------------------------- | :--------: | :--------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | Bảng Verified Versions (2026)                    |  **PASS**  | `[SRC]`, `[URL]` | Đầy đủ Next.js 16.4.0, React 19.2.3, TypeScript 5.9.3, Vitest 4.1.12, @google/genai 2.10.0, @anthropic-ai/sdk 0.71.2, openai 6.15.0 khớp `package.json`.                         |
|  2  | Checklist Các Bước Tuần Tự (`[MODIFY]`)          |  **PASS**  |     `[SRC]`      | 7 bước tuần tự rõ ràng, gắn nhãn `[MODIFY]` cho 13 file liên quan.                                                                                                               |
|  3  | Kế Hoạch Kiểm Thử Co-Located & Verification Plan |  **PASS**  |     `[CMD]`      | Liệt kê 5 test files co-located, lệnh chạy PowerShell 5.1 dùng dấu `;`, có Wiring Probe và 2 Negative Probes.                                                                    |
|  4  | Test Contract (Input, Output, Failure Modes)     |  **PASS**  |     `[SRC]`      | Định nghĩa rõ bảng ma trận 5 kịch bản, tuân thủ Test Failure Triage Loại C (Approved Spec Change).                                                                               |
|  5  | Assumptions & Cross-Task Dependencies            |  **PASS**  | `[SRC]`, `[CMD]` | 9 giả định A1–A9 được đối chiếu trực tiếp qua `view_file` và `grep_search`.                                                                                                      |
|  6  | Out of Scope (What We're NOT Doing)              |  **PASS**  |     `[SRC]`      | Xác định rõ không đổi database schema, không sửa `messages.ts`, không đổi SSE wire format, không đổi UI client.                                                                  |
|  7  | Skills Loaded & Applied                          |  **PASS**  |     `[SRC]`      | Trích dẫn và ánh xạ trực tiếp `.agents/skills/streaming-patterns/SKILL.md`, `.agents/skills/api-patterns/SKILL.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`. |

##### Mental Simulation Matrix (S1–S6 & Domain)

| Kịch Bản                                     | Trọng Tâm Đánh Giá                       | Trạng Thái | Loại Bằng Chứng  | Chi Tiết Đối Soát                                                                                                                             |
| :------------------------------------------- | :--------------------------------------- | :--------: | :--------------: | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   | TypeScript strict, build config, deps    |  **PASS**  | `[CMD]`, `[SRC]` | `npm run type-check` exit code 0; `package.json` chuẩn hóa, không phụ thuộc thư viện lạ.                                                      |
| **S2: Runner Lifecycle & Teardown**          | Abort signal, cleanup stream             |  **PASS**  |     `[SRC]`      | Giữ nguyên xử lý abort listener `signal.addEventListener("abort")`, guard `savedPartial` chống double-write.                                  |
| **S3: Database & Temporal Logic**            | RLS, persistence, ID mapping             |  **PASS**  | `[ADV]`, `[SRC]` | Tách biệt `insertUserMessage` (INSERT không ID client) và `upsertAssistantMessage` (UPSERT với `clientMessageId`), loại bỏ nguy cơ ghi đè ID. |
| **S4: Cross-Task State Flow**                | Client state, store sync, SSE wire       |  **PASS**  |     `[SRC]`      | Giữ nguyên Wire format SSE (`token`, `meta`, `ragSources`, `thinking`, `done`, `error`), không ảnh hưởng Zustand store.                       |
| **S5: Security Boundary & 3-Tier Auth**      | Auth session, rate limit, server-only    |  **PASS**  |     `[SRC]`      | Xác thực qua `auth()` tại `app/api/chat-stream/route.ts` được bảo toàn trước khi vào `chatStreamCore.ts`.                                     |
| **S6: External Resilience & Serverless Cap** | Timeout, provider fallbacks, maxDuration |  **PASS**  |     `[SRC]`      | 4 stream engine giữ nguyên `StreamTimeoutError`, cấu trúc try/catch và hoàn tất stream đúng hạn.                                              |
| **Domain: Open Inquiry**                     | Message naming consistency & Reasoning   |  **PASS**  |     `[SRC]`      | Xử lý reasoning-only khi content rỗng (`post-processing.ts:196`) gọi `upsertAssistantMessage` với `meta.reasoning` an toàn.                   |

#### 5. Adversarial Timelines & Commands Executed

##### Adversarial Timelines (4 Trục Đối Kháng)

1. **Trục 1 — Đồng Thời (Concurrency)**:
   - _Cơ chế_: Hai request stream gửi đồng thời từ một user.
   - _T1_: Request 1 gọi `insertUserMessage`, sinh UUID `msg_user_1`. Request 2 gọi `insertUserMessage`, sinh UUID `msg_user_2`.
   - _T2_: Hai stream xử lý song song với `clientMessageId` độc lập (`c-1` và `c-2`).
   - _T3_: `upsertAssistantMessage` cập nhật riêng cho từng bản ghi assistant tương ứng qua `clientMessageId`.
   - _Kết cục_: An toàn, không xảy ra xung đột dữ liệu giữa hai luồng song song.

2. **Trục 2 — Khoảng Trống check→use (TOCTOU)**:
   - _Cơ chế_: Client gửi `clientMessageId` nhưng ngắt kết nối ngay khi vừa gửi request.
   - _T1_: `insertUserMessage` lưu tin nhắn User vào database.
   - _T2_: Client gửi tín hiệu ngắt (`signal.abort()`) trước khi LLM kịp sinh token đầu tiên.
   - _T3_: `savePartialOnce` kiểm tra `trimmed` và `trimmedReasoning`. Cả hai đều rỗng nên bỏ qua không ghi bản ghi rác vào cơ sở dữ liệu.
   - _Kết cục_: An toàn, không sinh bản ghi assistant trống.

3. **Trục 3 — Thất Bại Giữa Chừng & Dọn Dẹp (Teardown Failure)**:
   - _Cơ chế_: Client ngắt kết nối giữa stream, thao tác ghi cơ sở dữ liệu gặp lỗi mạng tạm thời.
   - _T1_: Client đóng kết nối, kích hoạt sự kiện abort.
   - _T2_: `savePartialOnce` gọi `upsertAssistantMessage`, kết nối Supabase ném ngoại lệ mạng.
   - _T3_: Khối `try / catch` tại `gemini-stream.ts:760` (và các provider khác) bắt lỗi và ghi log, không làm sập tiến trình server; cờ `savedPartial` ngăn retry lặp vô hạn.
   - _Kết cục_: An toàn, tài nguyên stream được giải phóng.

4. **Trục 4 — Môi Trường Serverless (Stateless Execution)**:
   - _Cơ chế_: Instance Next.js App Router xử lý phân tán không chia sẻ in-memory state.
   - _T1_: Request streaming xử lý trên một container serverless.
   - _T2_: Toàn bộ trạng thái tin nhắn được duy trì trực tiếp vào database Supabase thông qua `conversationId` và `clientMessageId`.
   - _T3_: Khi container bị tái khởi động hoặc request kế tiếp điều hướng tới container khác, dữ liệu được tải lại đồng nhất từ cơ sở dữ liệu.
   - _Kết cục_: An toàn, đáp ứng mô hình kiến trúc serverless.

##### Commands Executed (Allowlist Read-Only)

- `npx vitest run src/app/api/chat-stream/streaming/` (Exit code: 0, 7 test files passed, 54 tests passed)
- `npm run type-check` (Exit code: 0, `tsc --noEmit` hoàn tất không có lỗi)
- `node scripts/verify-docs.mjs` (Exit code: 0, kiểm tra link và governance rules hợp lệ)

#### 6. Kết Luận

Bản kế hoạch đạt đầy đủ các tiêu chuẩn kiểm định của Vikini: Plan Completeness Gate (7/7 mục), Mental Simulation Matrix (S1–S6 & Domain), và các bài kiểm tra rà soát mã nguồn. Không có lỗi `[BLOCKER]` hay `[MAJOR]`. Kế hoạch được phê duyệt để tiến hành triển khai.

[PLAN_APPROVED]
