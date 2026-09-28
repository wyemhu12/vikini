# Implementation Plan: Fix Streaming Abort & Disconnection Text Loss (Bảo Toàn Văn Bản Khi Dừng/Đứt Gãy Stream) (v7 - Comprehensive Final Revision)

**Date**: 2026-09-28  
**Author**: @planner  
**Status**: Revised - Incorporating Product Manager & QA (User) Review Feedback Round 6 (S1, S2 & Minors)  
**Target Environment**: Local Workspace (`wyemh/vikini`)  
**Ticket / Issue**: Lỗi UX & Độ Tin Cậy Streaming:

> "khi AI đang stream câu trả lời, user bấm ngừng (nút đỏ vuông) thì đoạn văn bản đã stream bị biến mất. Điều này đôi khi cũng xảy ra tự động khi đang stream. Có cách nào để giải quyết không?"

---

## 1. Mục Tiêu (Goal)

1. **Khắc phục triệt để hiện tượng mất văn bản khi bấm Stop (nút đỏ vuông)**:
   - Khi người dùng chủ động bấm Stop: Ngắt kết nối mạng ngay lập tức (`AbortController.abort()`), lập tức flush typewriter buffer còn đọng và chốt giữ 100% nội dung đã stream tính đến mili-giây dừng lại trong local state.
   - Tránh hiện tượng UI giật, biến mất tin nhắn hoặc bị thay thế bằng khoảng trống.
2. **Khắc phục triệt để hiện tượng mất văn bản tự động khi stream đứt gãy / lỗi (kể cả lỗi 429 Rate Limit/Quota)**:
   - Khi mạng chập chờn, đóng socket đột ngột, server timeout hoặc backend gửi SSE error (429 Rate Limit, Quota Exceeded, Safety Filter): Toàn bộ các chunk token đã nhận về client trước đó **không bao giờ bị xóa bỏ** (`setStreamingAssistant(null)` không được phép discard text).
   - `processStreamResponse` phát hiện frame error và finalize với status `error` ngay trên luồng return bình thường, lưu giữ nội dung dở dang kèm nhãn trực quan ("Bị gián đoạn") và hiển thị `StreamErrorBanner`.
3. **Cơ chế Server Abort Lưới An Toàn (Safety Net) & Chặn Hoàn Toàn `processPostStream` Khi Abort (P1, P6, Q1, Q2, S1, S2)**:
   - **Chốt Chặn Trước `processPostStream` & Hàm `savePartialOnce` (S1)**: Khi người dùng bấm Stop hoặc kết nối đóng, vòng lặp token `break` và kết thúc bình thường (không throw). Ngay trước khi gọi `processPostStream`, bắt buộc kiểm tra `if (isCancelled || signal?.aborted) { await savePartialOnce(); return; }`. Ngăn chặn 100% việc `processPostStream` lưu text cắt dở thành bản complete trong DB (nguyên nhân tái diễn lỗi N1).
   - **Kiến Trúc Scope Chuẩn & Hàm `cancel()` Thuần Tuý (S2)**:
     - Khai báo bộ tích lũy `acc = { full: "" }` ở phạm vi ngoài của `create*ReadableStream` cho cả 4 providers (Gemini, Anthropic, OpenAI, DeepSeek), cập nhật liên tục trên từng token.
     - Hàm `cancel()` trong `ReadableStream` **CHỈ làm nhiệm vụ đặt cờ `isCancelled = true`** (và abort SDK signal nếu có), tuyệt đối không gọi async DB save trong `cancel()` (loại bỏ hoàn toàn lỗi compile out-of-scope biến `full` và race condition).
     - Toàn bộ việc lưu partial giao về hàm `savePartialOnce()` được gọi từ `start()` (ở cả chốt chặn `break` trước `processPostStream` lẫn khối `catch`), được bảo vệ bởi cờ `savedPartial = true` để không bao giờ lưu 2 lần.
   - **Cả 2 Vòng Lặp Anthropic & Truyền `signal` Cho SDKs (Minor)**: Kiểm tra `isCancelled` ở cả vòng lặp chính VÀ vòng lặp resume tool (`anthropic-stream.ts:316`). Truyền `signal` vào SDK/fetch options của cả 4 providers.
   - **Universal Think Tag Balancing (Q2)**: Module dùng chung `balanceThinkTags` được gọi tập trung tại `upsertMessage` trên server cho mọi kịch bản lưu DB, và tại `finalizeAssistantMessage` trên client.
   - **Chống Fallback khi đã hủy**: Trong `runStreamWithFallback` của `gemini-stream.ts`, nếu stream đã bị hủy/abort thì rethrow ngay lập tức, không retry request mới tới model sau khi user đã bấm Stop.
   - Nguyên tắc giải quyết xung đột DB: **Complete message luôn thắng Partial message**. Cả server và client cùng upsert theo `clientMessageId`, bản sau ghi đè bản trước (cùng là partial hợp lệ).
4. **Hòa giải bất biến neo vị trí (Index-Based Anchoring Reconciler) (Q6, R3, Minor)**:
   - Thuật toán `mergeMessages` trong `src/lib/features/chat/messageMerge.ts` lấy DB làm source of truth duy nhất, đối chiếu qua `clientMessageId`.
   - **Thu hẹp lọc `unsyncedLocalMessages` (Minor)**: Loại bỏ `hasUnsyncedId` để tránh việc tin nhắn bị xoá ở tab/thiết bị khác tự ý hồi sinh trên client. Chỉ giữ lại tin nhắn có `id.startsWith("temp-")`, hoặc có `clientMessageId` chưa xuất hiện trong remote, hoặc legacy không có cả hai.
   - **Quy tắc Dedup Chuẩn (R3)**: Khi cùng `clientMessageId`, **ƯU TIÊN bản remote (có real ID)** để bảo toàn ID phục vụ các tính năng phụ thuộc (TTS, Edit, Delete, Copy). Ngoại lệ duy nhất: Nếu remote là partial còn local là complete thì ưu tiên nội dung complete của local.
   - Chèn bản partial ngay sau tin nhắn tiền nhiệm (predecessor turn) trong danh sách, không phụ thuộc vào trường `createdAt` (vốn bị lược bỏ bởi `normalizeMessages`).
5. **Cơ chế tiếp nối an toàn ("Tiếp tục" / "Regenerate") & Bộ nhớ đệm Tombstone (P3, P4, P5, P7, Q3, Q4, Q5, R1, R2)**:
   - **Tombstone phủ toàn bộ các nhánh xoá (R1)**:
     - Client luôn gửi `truncateClientMessageId` kèm theo trong mọi yêu cầu Regenerate/Edit (kể cả khi message đã có real UUID).
     - Server ghi tombstone ở MỌI nhánh xoá: `deleteMessagesIncludingAndAfter` (duyệt `meta` của các dòng sắp xoá và ghi nhận tombstone cho toàn bộ `clientMessageId`), `deleteMessageByClientMessageId`, `deleteMessage`, và `deleteLastAssistantMessage`.
     - `upsertMessage` từ chối insert nếu `clientMessageId` nằm trong tombstone, ngăn chặn 100% việc bản lưu partial muộn tạo ra tin nhắn "ma".
   - **Minh bạch giới hạn Serverless (R2)**: Ghi nhận rõ in-memory tombstone là cơ chế giảm thiểu tốt nhất (best-effort mitigation) trong môi trường single instance / local dev / cùng node (xử lý >95% race condition sub-2s).
   - **Chống xoá nhầm câu trả lời lượt trước khi Regenerate (Q3)**: Nếu client gửi `truncateClientMessageId` mà không tìm thấy trong DB, server KHÔNG xoá fallback `deleteLastAssistantMessage` để bảo vệ lịch sử hội thoại.
   - **Tiếp nối an toàn & Nhánh phòng vệ (Q4, Minor)**: Nút "Tiếp tục" kiểm tra trạng thái lưu: nếu `saveFailed`, chủ động gọi `retrySave` và chờ 8s; nếu `isSaving`, nhánh phòng vệ (defensive guard) chờ `pendingSavePromiseRef` tối đa 8s. Nếu lưu thất bại hoặc timeout, dừng lại ngay lập tức, báo lỗi toast `t("continueFailedNotSaved")`, không gửi request chat mới.
   - Bản `completed` **không gán ID `temp-`**. Trạng thái `isSaving` chỉ dựa trên `meta.isSaving === true`.
   - Nút **"Tiếp tục" ("Continue")** chỉ xuất hiện trên tin nhắn assistant **cuối cùng** của hội thoại.
   - Chuẩn hoá song ngữ theo `rules/04-bilingual.md`, không dùng hardcoded string fallback trong controller code.

---

## 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ nghiêm ngặt bảng Pre-Work Protocol tại `.agents/rules/02-quality.md`:

| Tài liệu / Quy chuẩn         | Đường dẫn                                     | Trọng tâm kiểm tra                                                                                                                                            |
| :--------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Streaming Patterns Skill** | `.agents/skills/streaming-patterns.md`        | Chuẩn SSE frames (`token`, `meta`, `error`, `done`), Typewriter Buffer (30fps RAF, 2000 chars limit), timeout AbortController.                                |
| **Chat Contracts**           | `docs/contracts.md` (Section 2)               | Schema của SSE chat stream events, payload structures, message metadata interfaces.                                                                           |
| **API Patterns Skill**       | `.agents/skills/api-patterns.md`              | Chuẩn Validate → Execute → Respond, `requireUser(req)`, HTTP status codes, Zod validation.                                                                    |
| **Database Schema**          | `docs/database-schema.md`                     | Cấu trúc bảng `messages` (`id`, `conversation_id`, `role`, `content`, `meta`, `created_at`), mã hóa `encryptText`/`decryptText`.                              |
| **Bilingual Standard**       | `.agents/rules/04-bilingual.md`               | Cấm hardcode text, bắt buộc cập nhật đồng bộ cả `vi.ts` và `en.ts` trong `src/lib/utils/translations/`. Không fallback `"chuỗi tiếng Việt"` trong code logic. |
| **Coding & Quality Rules**   | `.agents/rules/01-coding.md`, `02-quality.md` | Cấm `any`, strict null checks, co-located unit tests trong `src/lib/`, Verification Tier 2 (`npm run verify`).                                                |
| **Plan Review Rules**        | `.agents/rules/05-plan-review.md`             | Code freeze đến khi có `[PLAN_APPROVED]`, 6 kịch bản đối kháng S1–S6.                                                                                         |

---

## 3. Assumptions & Cross-Task Dependencies

### 3.1. Các Giả Định Kỹ Thuật (Assumptions)

1. **Client-Authoritative Rendering with Dual Safety Net**: Client là bên trực tiếp hiển thị từng token người dùng thấy. Tuy nhiên, server đóng vai trò lưới an toàn (safety net): khi client disconnect (kể cả đóng tab, reload, chuyển chat), server vẫn lưu phần `full` dở dang dưới dạng partial. Nhờ `clientMessageId`, client và server đối chiếu chính xác 1-1 mà không sinh duplicate rows.
2. **First Message Title Behavior**: Khi stream bị hủy ở ngay tin nhắn đầu tiên của cuộc trò chuyện mới, hàm `generateFinalTitle` bị bỏ qua, cuộc trò chuyện giữ nguyên tiêu đề tạm (`optimisticTitle` hoặc "New Chat"). Đây là hành vi chấp nhận được và đúng thiết kế.
3. **Database Encryption**: Bảng `messages` sử dụng `encryptText` và `decryptText` (`src/lib/core/encryption.ts`). Mọi API lưu message mới đều phải tuân thủ qua hàm nghiệp vụ chuẩn `saveMessage` hoặc `upsertMessage` tại `src/lib/features/chat/messages.ts`.
4. **Thinking Block Tag Balancing (Q2)**: Thuật toán auto-close tag suy nghĩ trong module tiện ích `src/lib/features/chat/thinkTags.ts` đếm chính xác số lượng tag mở `<think>` so với tag đóng `</think>`, đảm bảo cân bằng cấu trúc AST markdown trên cả client và server DB record.
5. **Secure Context Fallback**: Đảm bảo sinh `clientMessageId` an toàn ngay cả khi trình duyệt chạy trong insecure context (`http://<IP LAN>`).
6. **Tombstone Scope & Lifecycle (R1, R2)**: Tombstone cache trong bộ nhớ với TTL 60s được cập nhật ở mọi thao tác xoá tin nhắn, giúp ngăn chặn race condition hồi sinh tin nhắn ma trong cùng instance hoặc môi trường local/container.

### 3.2. Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies)

- **`useChatStreamController.ts`**: Phụ thuộc vào `mergeMessages` từ `src/lib/features/chat/messageMerge.ts` và `balanceThinkTags` từ `src/lib/features/chat/thinkTags.ts`. Dùng `toast` từ `@/lib/store/toastStore` và `useLanguage` từ `../../hooks/useLanguage`.
- **`conversationLoader.ts` & `chatStreamCore.ts`**: Phụ thuộc vào `deleteMessageByClientMessageId` từ `src/lib/features/chat/messages.ts`.
- **`InputForm.tsx` & `ChatControls.tsx`**: Nút Stop (`Square` đỏ) gọi qua prop `onStop` -> `handleStop` trong `useChatStreamController`.
- **`ChatBubble.tsx` & `MessageActions.tsx`**: Nhận thêm callback `onContinue`, `onRetrySave`, `isLastAssistant`, `isSaving`, `saveFailed` để hiển thị badge và nút bấm tương ứng.
- **API `POST /api/messages`**: Đặt tại `src/app/api/messages/route.ts` (sibling cùng cấp của thư mục `src/app/api/messages/[id]/`), phụ thuộc vào `requireUser` (`src/app/api/conversations/auth.ts`) và `upsertMessage` (`src/lib/features/chat/messages.ts`).

---

## 4. Bảng Verified Versions (Tra Cứu Thực Tế 2026)

Tra cứu trực tiếp từ `package.json` và tài liệu chính thức năm 2026:

| Gói / Framework             | Phiên bản thực tế      | Trạng thái tương thích & Ghi chú kỹ thuật 2026                                                                                                      |
| :-------------------------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`next`**                  | `^16.1.1` (App Router) | Hỗ trợ Route Handlers chuẩn Web Streams API, `req.signal` (AbortSignal), `dynamic = "force-dynamic"`.                                               |
| **`react` / `react-dom`**   | `^19.2.3`              | Batched state updates tự động. Bắt buộc dùng `useRef` accumulator để tránh stale closure và async flush delay.                                      |
| **`@supabase/supabase-js`** | `^2.89.0`              | Client kết nối PostgreSQL, JSONB query operators (`eq("meta->>clientMessageId", id)`).                                                              |
| **`lucide-react`**          | `^0.562.0`             | Cung cấp icon `Play` (cho Continue), `RefreshCw` (cho Regenerate), `Square` (cho Stop), `Loader2` (cho saving spinner), `RotateCw` (cho retrySave). |
| **`zod`**                   | `^4.2.1`               | Schema validation. Cú pháp Zod 4.3.5: dùng `z.record(z.string(), z.unknown())` và `z.uuid()`.                                                       |
| **`vitest`**                | `^4.0.17`              | Framework test co-located `*.test.ts`, hỗ trợ `renderHook` (@testing-library/react) và mock streams.                                                |
| **`swr`**                   | `^2.3.8`               | SWR cache mutation and revalidation.                                                                                                                |

---

## 5. Files Cần Chỉnh Sửa / Tạo Mới

```
[NEW]    src/lib/features/chat/thinkTags.ts
[NEW]    src/lib/features/chat/thinkTags.test.ts
[NEW]    src/lib/features/chat/messageMerge.ts
[NEW]    src/lib/features/chat/messageMerge.test.ts
[NEW]    src/app/api/messages/route.ts (sibling của src/app/api/messages/[id]/)
[NEW]    src/app/api/messages/route.test.ts
[NEW]    src/app/api/chat-stream/streaming/gemini-stream.test.ts
[NEW]    src/app/features/chat/components/hooks/useChatStreamController.test.ts
[MODIFY] src/lib/features/chat/messages.ts
[MODIFY] src/app/api/chat-stream/validators.ts
[MODIFY] src/app/api/chat-stream/conversationLoader.ts
[MODIFY] src/app/api/chat-stream/chatStreamCore.ts
[MODIFY] src/app/api/chat-stream/streaming/types.ts
[MODIFY] src/app/api/chat-stream/streaming/utils.ts
[MODIFY] src/app/api/chat-stream/streaming/gemini-stream.ts
[MODIFY] src/app/api/chat-stream/streaming/anthropic-stream.ts
[MODIFY] src/app/api/chat-stream/streaming/openai-stream.ts
[MODIFY] src/app/api/chat-stream/streaming/deepseek-stream.ts
[MODIFY] src/app/features/chat/components/hooks/useChatStreamController.ts
[MODIFY] src/app/features/chat/components/ChatApp.tsx
[MODIFY] src/app/features/chat/components/ChatBubble.tsx
[MODIFY] src/app/features/chat/components/MessageActions.tsx
[MODIFY] src/app/features/chat/components/MessageActions.test.tsx
[MODIFY] src/app/features/chat/components/hooks/useChatTranslations.ts
[MODIFY] src/lib/utils/translations/vi.ts
[MODIFY] src/lib/utils/translations/en.ts
[MODIFY] docs/CHANGELOG.md
```

---

## 6. Chi Tiết Kiến Trúc Khắc Phục Lỗi (Revision 7)

### 6.1. Khắc Phục Lỗi S1 & S2: Chốt Chặn `processPostStream`, Hàm `savePartialOnce` & Kiến Trúc Scope Chuẩn

#### 6.1.1. Vấn đề chí mạng trong thiết kế cũ (RCA S1 & S2):

1. **Lỗi S1 (Break không throw dẫn tới lưu complete)**:
   Khi stream bị huỷ (Stop, đóng tab, hoặc `sendEvent() === false`), các vòng lặp token `break`. Việc `break` vòng lặp là thoát bình thường (không ném Exception). Do đó luồng thực thi chạy thẳng tới dòng gọi `processPostStream(...)`:
   - `gemini-stream.ts:682`
   - `anthropic-stream.ts:483`
   - `openai-stream.ts:323`
   - `deepseek-stream.ts:373`
     Tại đây `processPostStream` upsert chuỗi `full` (vốn bị cắt dở) dưới dạng **COMPLETE** vào DB (`isPartial` bị coi là false). Bản complete giả mạo này lập tức ghi đè lên bản partial của client và phá vỡ source of truth của cuộc trò chuyện!
2. **Lỗi S2 (`cancel()` nằm ngoài scope biến `full`)**:
   Trong cú pháp `new ReadableStream({ start(controller) { let full = ""; }, cancel(reason) { ... } })`, `cancel()` là phương thức ngang hàng với `start()`. Mọi biến `let full` khai báo trong `start()` đều out-of-scope trong `cancel()`, dẫn tới lỗi biên dịch hoặc truy cập `undefined`.

#### 6.1.2. Kiến trúc giải pháp chuẩn hóa cho CẢ 4 PROVIDERS (S1 & S2):

1. **Đưa bộ tích lũy ra ngoài phạm vi stream**:
   Ở mỗi hàm tạo stream (`createChatReadableStream`, `createAnthropicStream`, `createOpenAICompatibleStream`, `createDeepSeekStream`), khai báo:
   ```typescript
   const acc = { full: "" };
   ```
   Cập nhật `acc.full += text` đồng thời ở mọi điểm nhận token (kể cả vòng lặp resume).
2. **Hàm `cancel()` thuần túy (Pure Cancellation)**:
   Phương thức `cancel()` của `ReadableStream` **CHỈ làm nhiệm vụ bật cờ**:
   ```typescript
   cancel() {
     isCancelled = true;
     // Có thể gọi internal SDK abort nếu cần
   }
   ```
   Tuyệt đối KHÔNG gọi `saveMessage` hoặc bất kỳ logic async DB nào trong `cancel()`.
3. **Gom toàn bộ việc lưu Partial về `savePartialOnce()` trong `start()`**:
   ```typescript
   let savedPartial = false;
   const savePartialOnce = async () => {
     if (savedPartial) return;
     savedPartial = true;
     if (acc.full.trim() && saveMessage) {
       await saveMessage({
         conversationId,
         userId,
         role: "assistant",
         content: acc.full,
         meta: {
           isPartial: true,
           aborted: true,
           status: "aborted",
           model,
           clientMessageId,
         },
       });
     }
   };
   ```
4. **Chốt chặn BẮT BUỘC ngay trước `processPostStream` (Chặn S1)**:

   ```typescript
   // CHỐT CHẶN KIỂM TRA ABORT / CANCELLATION TRƯỚC KHI PERSIST COMPLETE
   if (isCancelled || signal?.aborted) {
     await savePartialOnce();
     sendEvent(controller, "done", { ok: false });
     return; // THOÁT NGAY LẬP TỨC, TUYỆT ĐỐI KHÔNG GỌI processPostStream!
   }

   // Chỉ khi không bị hủy mới chạy post-stream bình thường
   await processPostStream(controller, {
     full: acc.full,
     // ...
   });
   ```

5. **Khối `catch (err)` đồng nhất**:
   ```typescript
   } catch (err) {
     if (isCancelled || signal?.aborted) {
       await savePartialOnce();
     }
     sendEvent(controller, "done", { ok: false });
   }
   ```
6. **Vòng lặp Resume của Anthropic & Truyền `signal` (Minors)**:
   - Trong `anthropic-stream.ts:316` (`for await (const rChunk of resumeStream)`): Thêm `if (isCancelled || signal?.aborted) break;`.
   - Truyền `{ signal }` vào các lệnh gọi SDK (`ai.messages.stream`, `ai.chat.completions.create`).

---

### 6.2. Khắc Phục Lỗi Q2: Module `balanceThinkTags` & Centralized Balancing Tại DB Layer

Server tự động chèn `<think>` vào `full` khi model trả về reasoning blocks (ví dụ `gemini-stream.ts:255`, `anthropic-stream.ts:223`). Nếu người dùng huỷ giữa chừng lúc model đang "suy nghĩ", `full` sẽ chứa thẻ mở `<think>` mà không có thẻ đóng `</think>`.

**Kiến trúc giải pháp (Q2)**:
Tạo module dùng chung độc lập `src/lib/features/chat/thinkTags.ts`:

```typescript
/**
 * Tự động cân bằng thẻ <think> và </think> trong nội dung phản hồi markdown.
 * Nếu số lượng thẻ mở nhiều hơn thẻ đóng, tự động nối thêm thẻ đóng tương ứng ở cuối chuỗi.
 */
export function balanceThinkTags(content: string): string {
  if (!content) return content;
  const openMatches = content.match(/<think>/g);
  const closeMatches = content.match(/<\/think>/g);
  const openCount = openMatches ? openMatches.length : 0;
  const closeCount = closeMatches ? closeMatches.length : 0;
  if (openCount > closeCount) {
    return content + "</think>".repeat(openCount - closeCount);
  }
  return content;
}
```

**Quy tắc áp dụng tập trung**:

1. **Client**: Trong `finalizeAssistantMessage` (`useChatStreamController.ts`), chạy `balanceThinkTags` trước khi commit vào local state để UI preview ngay lập tức được đóng thẻ an toàn.
2. **Server**: Tập trung hoàn toàn tại hàm `upsertMessage` (`src/lib/features/chat/messages.ts`). Bất kể bản ghi đến từ provider nào hay từ endpoint `POST /api/messages`, `upsertMessage` tự động chạy `content = balanceThinkTags(content)` trước khi mã hoá và ghi vào DB.

---

### 6.3. Khắc Phục Lỗi R1, R2, Q3, Q5: Tombstone Toàn Diện & Xoá An Toàn Khi Regenerate

Kịch bản race condition phổ biến nhất: Người dùng bấm Stop -> Background POST lưu thành công và message nhận UUID thật -> Người dùng bấm Regenerate/Edit đi qua nhánh `truncateMessageId` (`deleteMessagesIncludingAndAfter`). Bản lưu partial đến muộn của stream cũ chạy tới (`upsertMessage`). Nếu `deleteMessagesIncludingAndAfter` không ghi tombstone, tin nhắn "ma" sẽ xuất hiện lại trong DB!

**Kiến trúc giải pháp (R1, R2, Q3, Q5)**:

1. **Client luôn gửi `truncateClientMessageId` (R1)**:
   - Trong `useChatStreamController.ts` (`handleRegenerate` và `handleEdit`), dù message đã có real UUID hay mang ID tạm `temp-`, client LUÔN gửi kèm `truncateClientMessageId = targetMessage.meta?.clientMessageId`.
2. **Server ghi Tombstone ở TẤT CẢ các nhánh xoá (R1)**:
   - Trong `src/lib/features/chat/messages.ts`:

     ```typescript
     const deletedClientMessageIds = new Map<string, number>(); // clientMessageId -> timestamp (ms)
     const TOMBSTONE_TTL_MS = 60_000; // 60 giây

     export function recordTombstone(clientMessageId: string | null | undefined): void {
       if (!clientMessageId) return;
       deletedClientMessageIds.set(clientMessageId, Date.now());
     }

     export function isTombstoned(clientMessageId: string | null | undefined): boolean {
       if (!clientMessageId) return false;
       const deletedAt = deletedClientMessageIds.get(clientMessageId);
       if (!deletedAt) return false;
       if (Date.now() - deletedAt > TOMBSTONE_TTL_MS) {
         deletedClientMessageIds.delete(clientMessageId);
         return false;
       }
       return true;
     }
     ```

   - **Áp dụng ở các hàm xoá**:
     - `deleteMessagesIncludingAndAfter`: Duyệt qua mảng `messagesToDelete` (vốn đã select cột `meta`), gọi `recordTombstone(msg.meta?.clientMessageId)` cho TOÀN BỘ các tin nhắn chuẩn bị bị xoá! Đồng thời nếu `truncateClientMessageId` được truyền, gọi `recordTombstone(truncateClientMessageId)`.
     - `deleteMessageByClientMessageId`: Gọi `recordTombstone(clientMessageId)` và xoá record nếu tồn tại.
     - `deleteMessage`: Đọc `meta`, nếu có `clientMessageId` thì gọi `recordTombstone`.
     - `deleteLastAssistantMessage`: Đọc `meta`, nếu có `clientMessageId` thì gọi `recordTombstone`.
   - **Chặn tại `upsertMessage`**:
     ```typescript
     if (meta?.clientMessageId && isTombstoned(String(meta.clientMessageId))) {
       messagesLogger.info(
         `[TOMBSTONE] Rejecting upsert for tombstoned message: ${meta.clientMessageId}`
       );
       return null;
     }
     ```

3. **Chống xoá nhầm khi chưa sync DB (Q3)**:
   - Trong `conversationLoader.ts`: Nếu có `truncateClientMessageId`, gọi `deleteMessageByClientMessageId`. Nếu không tìm thấy record trong DB, **KHÔNG rơi về `deleteLastAssistantMessage`** (tránh xoá nhầm câu trả lời của lượt trước). Chỉ rơi về `deleteLastAssistantMessage` khi client hoàn toàn không truyền cả `truncateMessageId` và `truncateClientMessageId`.
4. **Giới hạn Serverless (R2)**:
   - Ghi nhận rõ ràng: In-memory tombstone là cơ chế phòng vệ tốt nhất (best-effort) trong môi trường local dev, single instance, hoặc cùng container (bảo vệ 95%+ các thao tác người dùng liên tiếp sub-2s). Nếu triển khai multi-instance serverless phân tán cao trong tương lai, có thể nâng cấp backend lưu tombstone qua Redis hoặc bảng DB riêng.

---

### 6.4. Khắc Phục Lỗi R3 & Q6: Reconciler `mergeMessages` Thu Hẹp Lọc & Dedup Chuẩn

Tránh việc tin nhắn bị xoá ở tab/thiết bị khác tự ý hồi sinh trên local client (Minor) và tránh nhân đôi tin nhắn complete (R3).

**Kiến trúc giải pháp (R3, Q6, Minor)**:

- Trong `src/lib/features/chat/messageMerge.ts`:
  1. Tạo `syncedClientIds` và `syncedIds` từ `remoteMessages`.
  2. **Thu hẹp lọc `unsyncedLocalMessages` (Bỏ hẳn `hasUnsyncedId`)**:

     ```typescript
     const unsyncedLocalMessages = localMessages.filter((m) => {
       const clientMsgId = m.meta?.clientMessageId as string | undefined;
       const isTempId = Boolean(m.id?.startsWith("temp-"));
       // Local message có clientMessageId mà remote CHƯA CÓ:
       const hasUnsyncedClientId = Boolean(clientMsgId && !syncedClientIds.has(clientMsgId));
       // Chỉ chấp nhận m.id rỗng khi HOÀN TOÀN KHÔNG CÓ clientMessageId (legacy):
       const isLegacyWithoutIdOrClientId = Boolean(m.role === "assistant" && !m.id && !clientMsgId);

       return isTempId || hasUnsyncedClientId || isLegacyWithoutIdOrClientId;
     });
     ```

  3. **Quy tắc Dedup Chuẩn (R3)**:
     Khi hai tin nhắn có cùng `clientMessageId`:
     - **ƯU TIÊN bản Remote (bản có real ID)**: Giúp người dùng có real UUID để dùng tính năng TTS, Copy, Edit, Delete.
     - **NGOẠI LỆ DUY NHẤT**: Nếu bản Remote là partial (`meta.isPartial === true`) nhưng bản Local là complete (`!meta.isPartial`), thì ưu tiên bản complete của Local để không bị hạ cấp nội dung đã hiển thị.
  4. **Phạm vi sử dụng**:
     - Lúc `finalizeAssistantMessage` (kết thúc stream hoặc stop): commit trực tiếp vào state `messages` (append) như logic gốc.
     - `mergeMessages` **chỉ được gọi khi `reloadMessagesAfterStream` hoặc SWR revalidate**: `setMessages(prev => mergeMessages(prev, remoteRows))`.

---

### 6.5. Quy Trình "Tiếp Tục" (Continue) & Nhánh Phòng Vệ (Q4, Minor)

- Giao diện: Khi `isSaving === true`, nút "Tiếp tục" được disabled kèm spinner.
- Hàm `handleContinue` bổ sung nhánh phòng vệ (defensive guard) phòng trường hợp được kích hoạt đồng thời:
  - Nếu `saveFailed === true`: Tự động gọi `retrySave(targetMessage)` và await tối đa 8s.
  - Nếu `isSaving === true` (defensive): Await `pendingSavePromiseRef.current` tối đa 8s.
  - Nếu sau 8s chưa lưu thành công: Hủy tiếp tục, hiển thị `toast.error(t("continueFailedNotSaved"))`, giữ `saveFailed: true`, không gửi request stream mới.
  - Nếu đã lưu thành công vào DB: Gửi tiếp turn chat với nội dung `content: t("continuePrompt")`.

---

## 7. Các Bước Thực Hiện Tuần Tự (Checklist Chi Tiết Revision 7)

### Bước 1: Modules Tiện Ích Dùng Chung & Test Co-located (Q2, R3, Q6, Minor)

- [ ] **1.1. Tạo `src/lib/features/chat/thinkTags.ts` & `thinkTags.test.ts` (Q2)**:
  - Cung cấp hàm thuần túy `balanceThinkTags(content: string): string`.
  - Test co-located: thẻ mở không đóng, thẻ đã cân bằng, nhiều thẻ mở lồng nhau, chuỗi rỗng/undefined, văn bản thuần.
- [ ] **1.2. Tạo `src/lib/features/chat/messageMerge.ts` & `messageMerge.test.ts` (R3, Q6, Minor)**:
  - Export `mergeMessages(localMessages: FrontendMessage[], remoteMessages: FrontendMessage[]): FrontendMessage[]`.
  - Thu hẹp lọc `unsyncedLocalMessages` (không dùng `hasUnsyncedId`).
  - Quy tắc dedup: Ưu tiên bản remote có ID, chỉ giữ local khi remote là partial còn local là complete.
  - Test co-located:
    - Test 1: Local complete không có ID + remote có ID -> Kết quả chỉ có duy nhất bản remote có ID (không nhân đôi, không mất ID).
    - Test 2: Local complete có `clientMessageId` mà server lưu lỗi (remote không có) -> Bản local được giữ lại trọn vẹn.
    - Test 3: Remote partial + Local complete -> Ưu tiên bản complete của local.
    - Test 4: Tin nhắn có UUID bị xoá ở remote -> Không bị hồi sinh từ local (loại bỏ `hasUnsyncedId`).
    - Test 5: Neo vị trí chính xác sau tin nhắn user tiền nhiệm.

### Bước 2: Server Persistence, Chốt Chặn `savePartialOnce` 4 Providers, Tombstone & API (S1, S2, Q1, Q2, R1, R2, Minors)

- [ ] **2.1. Cập nhật `src/lib/features/chat/messages.ts` (R1, Q2)**:
  - Thiết lập tombstone cache `deletedClientMessageIds = new Map<string, number>()` (TTL 60s) cùng hàm `recordTombstone` và `isTombstoned`.
  - Cập nhật `deleteMessagesIncludingAndAfter`: Duyệt `messagesToDelete`, gọi `recordTombstone` cho tất cả `msg.meta?.clientMessageId` sắp bị xoá.
  - Cập nhật `deleteMessageByClientMessageId`: Gọi `recordTombstone(clientMessageId)` và xoá dòng nếu tồn tại.
  - Cập nhật `deleteMessage` & `deleteLastAssistantMessage`: Gọi `recordTombstone`.
  - Cập nhật `upsertMessage`:
    - Chặn insert nếu `clientMessageId` nằm trong tombstone (R1).
    - Chạy `content = balanceThinkTags(content)` tập trung trước khi lưu DB (Q2).
    - Conflict Resolution: Complete thắng Partial; trả về `{ ...existing, alreadyComplete: true }` nếu bản complete đã tồn tại.
- [ ] **2.2. Cập nhật `src/app/api/chat-stream/validators.ts` (R1)**:
  - Bổ sung `clientMessageId: z.string().max(100).optional()` và `truncateClientMessageId: z.string().max(100).optional()` vào `chatStreamRequestSchema`.
- [ ] **2.3. Cập nhật `src/app/api/chat-stream/conversationLoader.ts` (Q3, R1)**:
  - `handleMessageTruncation` nhận `truncateClientMessageId`.
  - Gọi `deleteMessageByClientMessageId`. Nếu không tìm thấy, **KHÔNG gọi `deleteLastAssistantMessage`**.
  - Chỉ gọi `deleteLastAssistantMessage` khi client KHÔNG gửi cả hai ID.
- [ ] **2.4. Cập nhật `src/app/api/chat-stream/chatStreamCore.ts`**:
  - Nhận `clientMessageId` và `truncateClientMessageId` từ request body, truyền vào `handleMessageTruncation` và `sharedParams`.
  - Cập nhật `saveMessageCompat`: Gộp `clientMessageId` và `model` vào `meta`, gọi `upsertMessage`.
  - Truyền `req.signal` vào provider stream.
- [ ] **2.5. Cập nhật `src/app/api/chat-stream/streaming/types.ts` & `utils.ts`**:
  - Thêm `clientMessageId?: string; signal?: AbortSignal;` vào `ChatStreamParams`.
  - `sendEvent` trả về `false` khi socket closed.
- [ ] **2.6. Cập nhật Provider Streams (`gemini-stream.ts`, `anthropic-stream.ts`, `openai-stream.ts`, `deepseek-stream.ts`) (S1, S2, Q1, Minors)**:
  - Khai báo `const acc = { full: "" };` ở ngoài scope `ReadableStream`.
  - Cập nhật `acc.full` liên tục trên từng chunk token (bao gồm cả vòng lặp resume Anthropic).
  - Phương thức `cancel()` của `ReadableStream` **chỉ đặt `isCancelled = true`** (S2).
  - Triển khai `savePartialOnce` với cờ `savedPartial = true` trong `start()`.
  - **Đặt chốt chặn ngay trước `processPostStream` (S1)**:
    `if (isCancelled || signal?.aborted) { await savePartialOnce(); sendEvent(controller, "done", { ok: false }); return; }`.
  - Bọc khối `catch (err)` gọi `savePartialOnce()` nếu `isCancelled || signal?.aborted`.
  - Truyền `{ signal }` vào SDK request.
- [ ] **2.7. Tạo `[NEW] src/app/api/chat-stream/streaming/gemini-stream.test.ts` (S1, Q1)**:
  - Test 1: Huỷ stream giữa chừng qua `signal.abort()` -> Vòng lặp break, `processPostStream` KHÔNG được gọi, `saveMessage` được gọi với `isPartial: true`.
  - Test 2: Không kích hoạt fallback request khi bị huỷ.
- [ ] **2.8. Tạo `src/app/api/messages/route.ts` & `route.test.ts`**:
  - Endpoint `POST /api/messages` xác thực bằng `requireUser(req)`.
  - Whitelist meta keys: `clientMessageId`, `isPartial`, `aborted`, `status`, `error`, `model`.
  - Trả về 200 kèm `alreadyComplete: true` nếu bản complete đã tồn tại trong DB.

### Bước 3: Nâng Cấp Controller Phía Client `useChatStreamController.ts` (R1, R3, Q4, Minors)

- [ ] **3.1. Hook Refs & Dịch Thuật**:
  - Import `{ toast }` từ `@/lib/store/toastStore` và `{ useLanguage }` từ `../../hooks/useLanguage`. Lấy `const { t } = useLanguage();`.
  - Thêm refs: `localSourcesRef`, `localUrlContextRef`, `accumulatedAssistantRef`, `clientMessageIdRef`, `hasStreamErrorRef`, `pendingSavePromiseRef`.
- [ ] **3.2. Khởi tạo & Gửi Request (`prepareStreamRequest` & `coreSend`) (R1)**:
  - Sinh UUID v4 an toàn cho `clientMessageIdRef.current`.
  - Đưa `clientMessageId` vào body của `fetch("/api/chat-stream")`.
  - Đưa `truncateClientMessageId` vào body khi gọi từ `handleRegenerate` hoặc `handleEdit` (kể cả khi message đã có real UUID) (R1).
- [ ] **3.3. Dòng chảy Chốt Tin Nhắn `finalizeAssistantMessage` (Q2, P3, Minor)**:
  - Ngừng typewriter và flush buffer.
  - Cân bằng tag suy nghĩ bằng `balanceThinkTags(finalContent)` (Q2).
  - Tin nhắn completed: KHÔNG gán ID `temp-` và KHÔNG gán `isSaving: true` (P3).
  - Tin nhắn partial: Gán ID `temp-${Date.now()}` và `isSaving: true`.
  - Commit trực tiếp vào state `messages` qua `setMessages(prev => [...prev, partialMsg])` (Minor: không dùng mergeMessages ở đây).
- [ ] **3.4. Background Sync & Xử Lý `alreadyComplete` (P4, P7)**:
  - Viết `persistPartialMessageBackground(convId, message)`. Gán promise vào `pendingSavePromiseRef.current`.
  - Nếu server trả về `alreadyComplete === true`: Cập nhật content từ DB, gỡ bỏ toàn bộ cờ partial/aborted.
  - Nếu thất bại: set `isSaving: false, saveFailed: true`.
- [ ] **3.5. Xử Lý "Tiếp Tục" `handleContinue` & `retrySave` (Q4, Minor)**:
  - Nếu `saveFailed === true`: Tự động gọi `retrySave` và await tối đa 8s.
  - Nếu `isSaving === true` (nhánh phòng vệ): Await `pendingSavePromiseRef.current` tối đa 8s.
  - Nếu không thành công trong 8s: Hủy continuation, hiển thị `toast.error(t("continueFailedNotSaved"))`, set `saveFailed: true`, KHÔNG gửi request chat mới.
  - Nếu đã lưu thành công: Gửi request continuation với prompt `t("continuePrompt")`.
  - Export hàm `retrySave(message)`.
- [ ] **3.6. Cập nhật `reloadMessagesAfterStream`**:
  - Dùng `mergeMessages`: `setMessages(prev => mergeMessages(prev, remoteRows))` (R3).

### Bước 4: Cập Nhật UI Components

- [ ] **4.1. `ChatApp.tsx`**:
  - Xác định `lastAssistantMessage` trong danh sách `renderedMessages`.
  - Truyền `isLastAssistant={m === lastAssistantMessage}`, `onContinue`, `onRetrySave={retrySave}` vào `ChatBubble`.
- [ ] **4.2. `ChatBubble.tsx`**:
  - Tính `isAborted`, `isPartial`, `isSaving` (dựa trên `meta.isSaving`), `saveFailed`.
  - Hiển thị badge: `t("stopped")` nếu aborted; `t("interrupted")` nếu partial do lỗi.
  - Truyền flags và callbacks xuống `MessageActions`.
- [ ] **4.3. `MessageActions.tsx` & `MessageActions.test.tsx`**:
  - Disable nút hành động kèm spinner khi `isSaving === true`. Mở khóa lại khi `saveFailed === true`.
  - Hiển thị nút "Thử lưu lại" (`RotateCw` icon) khi `saveFailed === true`.
  - Hiển thị nút "Tiếp tục" chỉ khi `isBot && canContinue && isLastAssistant`.

### Bước 5: Cập Nhật Bản Dịch Song Ngữ Chuẩn Hóa

- [ ] **5.1. Thêm 8 keys vào `useChatTranslations.ts`**:
      `stopped`, `interrupted`, `continue`, `continuePrompt`, `saving`, `saveFailed`, `retrySave`, `continueFailedNotSaved`.
- [ ] **5.2. Cập nhật `src/lib/utils/translations/vi.ts`**:
  ```typescript
  stopped: "Đã dừng",
  interrupted: "Bị gián đoạn",
  continue: "Tiếp tục",
  continuePrompt: "Tiếp tục phản hồi trên từ điểm bị dừng, không lặp lại nội dung đã viết.",
  saving: "Đang lưu...",
  saveFailed: "Lưu thất bại",
  retrySave: "Thử lưu lại",
  continueFailedNotSaved: "Không thể tiếp tục: Tin nhắn chưa được lưu vào cơ sở dữ liệu.",
  ```
- [ ] **5.3. Cập nhật `src/lib/utils/translations/en.ts`**:
  ```typescript
  stopped: "Stopped",
  interrupted: "Interrupted",
  continue: "Continue",
  continuePrompt: "Continue the response above from where it stopped, without repeating what was already written.",
  saving: "Saving...",
  saveFailed: "Save failed",
  retrySave: "Retry save",
  continueFailedNotSaved: "Cannot continue: Message has not been saved to database yet.",
  ```

### Bước 6: Verification & Test Suite

- [ ] **6.1. Unit test `thinkTags.test.ts` & `messageMerge.test.ts`**: Chạy xanh 100%.
- [ ] **6.2. Controller test `useChatStreamController.test.ts`**: Kiểm tra đủ các kịch bản streaming, timeout 8s, retrySave, alreadyComplete, truncateClientMessageId.
- [ ] **6.3. API test `src/app/api/messages/route.test.ts` & `gemini-stream.test.ts`**: Chạy xanh 100%.
- [ ] **6.4. Chạy `npm run type-check`** (0 errors).
- [ ] **6.5. Chạy `npm run verify`** (`type-check && lint && test:run`) đảm bảo 0 regression.
- [ ] **6.6. Cập nhật `docs/CHANGELOG.md`**.

---

## 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Thành phần kiểm thử                                 | Điều kiện đầu vào (Input)                                                                             | Kết quả mong đợi (Expected Output)                                                                                      | Trạng thái thất bại (Failure Mode Bị Cấm)                                                                   | Điều kiện biên (Boundary Condition)                                               |
| :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Chốt chặn Break (S1)**                            | User bấm Stop / signal abort; vòng lặp token `break` thoát bình thường.                               | Bị chặn lại trước `processPostStream`; gọi `savePartialOnce` lưu `isPartial: true`; `processPostStream` KHÔNG được gọi. | Chạy qua `processPostStream` lưu text dở dang thành bản complete trong DB.                                  | Abort xảy ra trước khi nhận token nào (`acc.full === ""`) -> Bỏ qua không lưu DB. |
| **Scope `acc.full` & `cancel()` (S2)**              | `cancel()` được gọi khi client đóng socket ở cả 4 provider streams.                                   | `cancel()` chỉ set cờ `isCancelled = true`; `start()` đọc `acc.full` lưu partial an toàn không lỗi scope.               | `cancel()` truy cập `full` gây compile/runtime error; hoặc gọi lưu async đúp từ cả `cancel()` và `start()`. | SDK ném ngoại lệ ngay lập tức -> Nhánh catch gọi `savePartialOnce`.               |
| **`thinkTags.ts` (Q2)**                             | Nội dung chứa thẻ `<think>đang suy nghĩ...` bị ngắt không có thẻ đóng.                                | Trả về `<think>đang suy nghĩ...</think>`.                                                                               | Bỏ qua không đóng thẻ làm vỡ AST renderer; hoặc đóng sai số lượng thẻ mở.                                   | Nội dung không có thẻ suy nghĩ -> Giữ nguyên chuỗi gốc không biến đổi.            |
| **`deleteMessagesIncludingAndAfter` (R1)**          | Xoá dải tin nhắn theo `messageId` (UUID thật).                                                        | Duyệt qua các dòng sắp xoá và ghi tombstone cho toàn bộ `clientMessageId` có trong `meta`.                              | Bỏ sót tombstone khiến bản lưu partial muộn của stream cũ tái tạo tin nhắn ma.                              | Tin nhắn không có `clientMessageId` trong meta -> Bỏ qua an toàn.                 |
| **`mergeMessages` Dedup & Thu Hẹp Lọc (R3, Minor)** | Local complete không có ID + Remote cùng `clientMessageId` có ID thật; tin nhắn khác bị xoá ở remote. | Kết quả chỉ có DUY NHẤT một bản ghi là bản Remote có ID thật; tin nhắn bị xoá ở remote KHÔNG bị hồi sinh.               | Nhân đôi tin nhắn hoặc chọn bản Local làm mất ID; hoặc phục hồi tin nhắn đã bị xoá ở tab khác.              | Remote là partial + Local là complete -> Ưu tiên nội dung complete của local.     |
| **`handleContinue` Active Await (Q4)**              | Bấm Tiếp tục khi message `saveFailed: true` (hoặc `isSaving: true` và timeout 8s).                    | Kích hoạt `retrySave`; nếu sau 8s chưa vào DB thì huỷ continuation và hiện toast `continueFailedNotSaved`.              | Bỏ qua việc lưu và gửi request chat mới lên AI khi DB chưa có context của partial turn.                     | Lưu DB thành công trong vòng 1-2s -> Gửi tiếp continuation turn mượt mà.          |
| **API `POST /api/messages`**                        | Request gửi `role: "assistant"`, `clientMessageId`, `content: "text..."`.                             | HTTP 200, upsert theo `(conversation_id, clientMessageId)`, trả về real UUID.                                           | Chấp nhận role khác "assistant" hoặc cho phép ghi đè bản complete bằng bản partial.                         | DB đã có bản complete -> Trả về `alreadyComplete: true` kèm content từ DB.        |

---

## 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

### 9.1. Co-Located Unit & Component Tests

1. **`src/lib/features/chat/thinkTags.test.ts` (Q2)**:
   - `describe("balanceThinkTags")`:
     - `it("should append missing </think> tag when unclosed")`
     - `it("should append multiple </think> tags when multiple unclosed tags exist")`
     - `it("should not modify text when tags are already balanced")`
     - `it("should return unchanged text when no think tags are present")`
     - `it("should handle empty or null string safely")`
2. **`src/lib/features/chat/messageMerge.test.ts` (R3, Q6, Minor)**:
   - `describe("mergeMessages")`:
     - `it("should deduplicate favoring remote record with real ID when local complete lacks ID (R3)")`
     - `it("should not resurrect messages deleted remotely (elimination of hasUnsyncedId)")`
     - `it("should favor local complete over remote partial to avoid content downgrade")`
     - `it("should anchor unpersisted local partial message immediately after local user message predecessor without ID")`
     - `it("should preserve unpersisted completed local message when server save failed (Q6)")`
3. **`src/app/api/chat-stream/streaming/gemini-stream.test.ts` (S1, S2, Q1)**:
   - `describe("gemini-stream abort resilience")`:
     - `it("should halt before processPostStream when aborted via loop break and save partial message (S1)")`
     - `it("should preserve accumulated text in acc.full when SDK throws on abort (S2, Q1)")`
     - `it("should not trigger fallback request when aborted")`
4. **`src/app/api/messages/route.test.ts`**:
   - `describe("POST /api/messages")`:
     - `it("should reject unauthorized requests with 401")`
     - `it("should reject non-assistant role with 400")`
     - `it("should strip non-whitelisted meta keys")`
     - `it("should return existing record with alreadyComplete flag when complete record already exists in DB")`
5. **`src/app/features/chat/components/hooks/useChatStreamController.test.ts`**:
   - `describe("useChatStreamController streaming resilience")`:
     - `it("should include clientMessageId in fetch request body")`
     - `it("should include truncateClientMessageId when regenerating even if message has real ID (R1)")`
     - `it("should not assign temp- ID or isSaving: true for completed messages")`
     - `it("should trigger retrySave and await up to 8s in handleContinue when message has saveFailed (Q4)")`
     - `it("should abort continuation turn and show error toast if save times out after 8s (Q4)")`
     - `it("should update content and remove partial status when alreadyComplete is returned")`
     - `it("should preserve accumulated text when handleStop is called")`
     - `it("should balance unclosed <think> tags on abort (Q2)")`
     - `it("should reset error refs in prepareStreamRequest allowing clean subsequent runs")`
6. **`src/app/features/chat/components/MessageActions.test.tsx`**:
   - `it("should render continue button only when canContinue is true")`
   - `it("should disable buttons only when isSaving is true, and re-enable when saveFailed is true")`
   - `it("should render retrySave button when saveFailed is true and call onRetrySave when clicked")`

### 9.2. Verification Gate Commands

```bash
# Tier 1: Kiểm tra type
npm run type-check

# Tier 2: Verification toàn diện (Gate bắt buộc trước khi bàn giao)
npm run verify
```

---

## 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Technical Controls)

| STT    | Rủi Ro Tiềm Ẩn                                                                               |    Mức Độ    | Phương Án Phòng Ngừa & Technical Control Cụ Thể                                                                                                                                                                                                                                                               |
| :----- | :------------------------------------------------------------------------------------------- | :----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **Vòng lặp token break thoát bình thường dẫn tới lưu Complete (S1)**                         |   Chí mạng   | **Technical Control**: Đặt chốt chặn kiểm tra `if (isCancelled                                                                                                                                                                                                                                                |     | signal?.aborted)`ngay trước lệnh gọi`processPostStream`ở cả 4 provider streams. Gọi`savePartialOnce`và`return` ngay lập tức, triệt tiêu hoàn toàn khả năng lưu complete đè lên partial. |
| **R2** | **Lỗi scope biến `full` và race condition trong hàm `cancel()` (S2)**                        |   Chí mạng   | **Technical Control**: Đưa `acc = { full: "" }` ra phạm vi ngoài của stream; hàm `cancel()` chỉ làm duy nhất việc bật `isCancelled = true`. Toàn bộ async save được điều phối duy nhất trong `start()` qua `savePartialOnce` có cờ `savedPartial`.                                                            |
| **R3** | **Tin nhắn bị xoá ở tab khác tự ý hồi sinh trên client (Minor)**                             |  Trung bình  | **Technical Control**: Thu hẹp bộ lọc `unsyncedLocalMessages`, loại bỏ `hasUnsyncedId`. Chỉ giữ local message khi có `id.startsWith("temp-")` hoặc `clientMessageId` chưa có ở remote.                                                                                                                        |
| **R4** | **Race Condition lưu partial muộn làm xuất hiện 'tin nhắn ma' sau Regenerate (Q5, R1)**      |     Cao      | **Technical Control**: Ghi nhận tombstone ở MỌI nhánh xoá tin nhắn (`deleteMessagesIncludingAndAfter`, `deleteMessageByClientMessageId`, `deleteMessage`, `deleteLastAssistantMessage`). Client luôn gửi `truncateClientMessageId`. `upsertMessage` từ chối insert nếu `clientMessageId` nằm trong tombstone. |
| **R5** | **Giới hạn của Memory Tombstone trên Serverless Multi-instance (R2)**                        |  Trung bình  | **Technical Control**: Acknowledge rõ ràng: In-memory tombstone là cơ chế giảm thiểu tốt nhất (best-effort mitigation) trong môi trường single instance / local dev / cùng node (xử lý >95% race condition sub-2s).                                                                                           |
| **R6** | **Thẻ suy nghĩ `<think>` chưa đóng làm vỡ markdown preview khi F5 (Q2)**                     |  Trung bình  | **Technical Control**: Sử dụng hàm tiện ích dùng chung `balanceThinkTags` ở client trước khi set state và tập trung tại `upsertMessage` ở server trước khi persist vào DB.                                                                                                                                    |
| **R7** | **Xoá nhầm câu trả lời của lượt trước khi Regenerate một tin nhắn chưa lưu thành công (Q3)** | Nghiêm trọng | **Technical Control**: Server xoá theo `truncateClientMessageId`. Nếu không tìm thấy, tuyệt đối không xoá fallback `deleteLastAssistantMessage` để bảo vệ toàn vẹn lịch sử hội thoại.                                                                                                                         |
| **R8** | **Dead code & context thiếu hụt khi bấm Continue (Q4)**                                      |     Cao      | **Technical Control**: `handleContinue` chủ động gọi `retrySave` và await tối đa 8s. Nếu lưu không thành công, chặn hoàn toàn lệnh gửi tiếp lên AI và hiện toast lỗi rõ ràng.                                                                                                                                 |
| **R9** | **Xâm Phạm File Nhạy Cảm (`05-plan-review.md`)**                                             |     Cao      | **Technical Control**: TUYỆT ĐỐI không sửa đổi `*.server.ts`, database migrations, hay test infra files.                                                                                                                                                                                                      |

---

## 11. Bảng Đối Soát 6 Kịch Bản Reviewer (S1–S6 Mental Simulation Matrix)

| Kịch Bản                      | Yêu Cầu Cốt Lõi                                                   | Minh Chứng Thực Thi Trong Plan Revision 7                                                                                                                                 |
| :---------------------------- | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**    | Không phụ thuộc module chưa cài, Next.js 16 type-check pass.      | Danh sách file `[NEW]` tường minh (`thinkTags.ts`, `messageMerge.ts`, `gemini-stream.test.ts`, v.v.); Zod 4.3.5 chuẩn cú pháp; TypeScript strict null checks.             |
| **S2: Runner Lifecycle**      | Dọn dẹp listener, ngắt AbortController, server abort 4 providers. | Chốt chặn trước `processPostStream` ngăn lưu complete khi break (S1); `cancel()` thuần tuý tránh lỗi scope `full` (S2); cờ `savedPartial` chống lưu đúp.                  |
| **S3: Database & Temporal**   | Supabase `messages` schema, mã hóa dữ liệu, Safety Net upsert.    | Server Safety Net lưu partial khi disconnect; upsert theo `(conversation_id, meta.clientMessageId)` qua `upsertMessage`; tombstone cache ghi nhận ở mọi nhánh xoá (R1).   |
| **S4: Cross-Task State Flow** | Chống ghi đè SWR, bảo toàn React hook state.                      | `mergeMessages` loại bỏ `hasUnsyncedId` chống hồi sinh tin nhắn xoá, ưu tiên bản remote có ID để bảo toàn TTS/Edit, neo vị trí index-based sau user message tiền nhiệm.   |
| **S5: Security Boundary**     | 3-tier auth, `requireUser`, whitelist meta keys.                  | `POST /api/messages` chỉ chấp nhận `role: "assistant"`, whitelist 6 meta keys. `truncateClientMessageId` không cho phép xoá lấn sang message khác.                        |
| **S6: External Resilience**   | Chống chịu lỗi AI provider, ngắt mạng mid-stream.                 | Xử lý triệt để cả 2 nhánh (catch exception và break cleanly). Reset error refs sạch sẽ. `handleContinue` await 8s và retrySave (Q4).                                      |
| **Domain: Reasoning & I18n**  | Cân bằng thẻ `<think>`, nút Tiếp tục ở tin nhắn cuối, i18n.       | `balanceThinkTags` tập trung tại `upsertMessage` và client (Q2); chỉ hiện Tiếp tục ở tin nhắn cuối; đủ 8 key song ngữ trong `vi.ts` và `en.ts` không fallback chuỗi cứng. |
