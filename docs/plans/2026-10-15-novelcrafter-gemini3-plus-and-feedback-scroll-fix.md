# Kế Hoạch Triển Khai: Sửa Triệt Để Lỗi Gemini 3+ Và Căn Chỉnh Vị Trí Cuộn Feedback Highlight Trong Novelcrafter Studio

- **Revision**: 4
- **Status**: Approved
- **Author**: Technical Planner Agent (Vikini)
- **Reviewer**: Claude Code CLI (`claude-opus-5-5[1m]`) & Fallback Reviewer (`@reviewer` — `gemini-4-argon`)
- **Target Files**:
  - `[MODIFY]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`
  - `[MODIFY]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`
  - `[MODIFY]` `src/lib/features/novelcrafter/promptBuilder.ts`
  - `[MODIFY]` `src/lib/features/novelcrafter/promptBuilder.test.ts`
  - `[MODIFY]` `src/lib/features/novelcrafter/streamTargetGuard.ts`
  - `[MODIFY]` `src/lib/features/novelcrafter/streamTargetGuard.test.ts`
  - `[MODIFY]` `src/lib/features/novelcrafter/feedbackParser.test.ts`
  - `[NEW]` `src/app/features/novelcrafter/hooks/useNovelcrafterModelGuard.ts`
  - `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`
  - `[MODIFY]` `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`
  - `[MODIFY]` `src/app/features/chat/components/hooks/useAllowedModels.ts`
  - `[MODIFY]` `src/lib/core/modelAccess.ts`
  - `[MODIFY]` `src/lib/core/modelAccess.test.ts`
  - `[MODIFY]` `src/lib/utils/translations/vi.ts`
  - `[MODIFY]` `src/lib/utils/translations/en.ts`
  - `[NEW]` `src/lib/features/novelcrafter/quoteScrollPositioning.ts`
  - `[NEW]` `src/lib/features/novelcrafter/quoteScrollPositioning.test.ts`

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Khắc phục toàn diện các vấn đề vận hành thực tế được người dùng báo cáo trong Novelcrafter Studio (`/novelcrafter`):

1. **Lỗi 1 (Gemini 3+ Routing, Khóa Quyền Hạn & Bảo Vệ Bản Thảo Sáng Tác)**:
   - **Chặn Unchecked Selection & 403 Persistence Trap**: Không cho phép người dùng click chọn model vượt quá quyền hạn của rank (`basic` thiếu Gemini 3 & 4; `pro` thiếu `gemini-4-argon`), ngăn chặn ngay lập tức chuỗi lỗi `403 Forbidden` trên cả `PUT /api/novelcrafter/state` và `POST /api/novelcrafter/stream`.
   - **Tách Hook `useNovelcrafterModelGuard` & Reconcile Kháng Lỗi Mạng**: Xây dựng custom hook riêng biệt quản lý chọn model và điều chỉnh model an toàn cho bản nháp cũ; tham số `isPermissionsResolved: boolean` là bắt buộc, không bao giờ ép fallback sang model cấm khi allowlist rỗng (`!firstAllowed`), và không chạy reconcile khi `story.isLoadingState === true`. Thêm 2 key đa ngữ riêng biệt (`novelcrafterModelLockedToast` và `novelcrafterModelFallbackToast`).
   - **Đồng Bộ Database Migration & Kiểm Chứng Xóa Cache Redis**: Áp dụng migration `20261014000000_add_gemini_4_argon.sql` cho rank `pro` trên Supabase và kiểm chứng trực tiếp việc xóa cache Redis key `rank_configs:all` (`exists === 0`).
   - **Tối Ưu Hóa Thinking & Đồng Bộ Safety Settings**: Cấu hình `thinkingConfig` (`ThinkingLevel.LOW`, `includeThoughts: true`) cho Gemini 3 nhằm hướng tới mục tiêu tối ưu hóa thời gian phát token đầu tiên (< 2s), đồng bộ `safetySettings` (4 danh mục chuẩn `BLOCK_NONE`, loại bỏ category `HARM_CATEGORY_CIVIC_INTEGRITY` đã deprecated) đồng nhất với luồng Chat.
   - **Định Danh Bối Cảnh Hư Cấu (`<studio_context>`)**: Trong `promptBuilder.ts`, luôn gắn khối `<studio_context>` khẳng định rõ không gian sáng tác tiểu thuyết/kịch bản hư cấu chuyên nghiệp, ngay cả khi người dùng chọn `masterGemInstructions` tùy chỉnh.
   - **Bảo Vệ Tuyệt Đối Bản Thảo (`chapter_prose`, `chapter_scenes`, `bible_field`) Khỏi Câu Từ Chối Của AI**: Trong `streamTargetGuard.ts`, bổ sung hàm nhận diện từ chối `isLikelyModelRefusalOutput`. Khi phát hiện mô hình phát câu từ chối ở luồng ghi trực tiếp vào văn xuôi, hệ thống lập tức khôi phục `finalFieldContent = target.baseContent`, hủy lưu nháp (`shouldPersistState: false`) và báo `toast.error` kèm lý do từ chối để giữ cho bản thảo của tác giả 100% nguyên vẹn.
   - **Kiểm Chứng Cơ Chế Fallback Của Feedback Parser**: Ghi nhận chính xác cơ chế của `feedbackParser.ts:61-73` (tự động tạo thẻ `EDITORIAL` hiển thị nội dung khi không có thẻ XML) và bổ sung unit test kiểm chứng trong `feedbackParser.test.ts`.
2. **Lỗi 2 (Feedback Quote Scroll Jump)**:
   - Tách module chuyên trách `quoteScrollPositioning.ts`, tính toán hình học chính xác qua DOM Mirror Element với danh sách đầy đủ 24 thuộc tính computed styles, khử bỏ triệt để auto-scroll ngoài ý muốn của trình duyệt khi `setSelectionRange` bằng `requestAnimationFrame` (kèm quản lý lifecycle `cancelAnimationFrame` và ref guarding), cuộn mượt mà đưa câu trích dẫn vào đúng 1/3 trên của khung nhìn (Sudowrite Golden Third).

---

### 2. Pre-Work Reading & Tài Liệu Tham Chiếu

Tuân thủ nghiêm ngặt Pre-Work Protocol theo `.agents/rules/02-quality.md`:

- [x] [gemini-stream.ts](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts) — Luồng streaming Gemini chuẩn của hệ thống Chat, cấu hình ThinkingConfig và trích xuất chunk.
- [x] [chatStreamCore.ts](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts) — Điều phối luồng chat, khởi tạo AI client, kiểm tra quyền hạn qua `assertModelAllowedForUser`.
- [x] [contextBuilder.ts](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/contextBuilder.ts) — Cấu hình `safetySettings` chuẩn từ `GEMINI_SAFETY_SETTINGS_JSON` cho Chat.
- [x] [promptBuilder.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/promptBuilder.ts) — Xây dựng system instruction và user prompt cho Novelcrafter.
- [x] [streamTargetGuard.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/streamTargetGuard.ts) — Điều phối nội dung stream vào các trường đích (`chapter_prose`, `chapter_scenes`, `bible_field`, `history_only`).
- [x] [feedbackParser.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/feedbackParser.ts) — Bóc tách thẻ nhận xét truyện từ output AI, bao gồm nhánh fallback `EDITORIAL`.
- [x] [limits.ts](file:///c:/Users/wyemh/vikini/src/lib/core/limits.ts) — Cổng kiểm soát quyền truy cập model `assertModelAllowedForUser` và cache Redis `rank_configs:all` (TTL 300s).
- [x] [modelRegistry.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts) — Danh mục mô hình `SELECTABLE_MODELS`, `MODEL_ALIASES`, `modelSupportsThinking`, `isGemini4Model`, `clampGeminiThinkingLevel`.
- [x] [modelAccess.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelAccess.ts) — Hàm thuần `isModelAllowedById` kiểm tra quyền client-side.
- [x] [useAllowedModels.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useAllowedModels.ts) — Hook tải danh sách quyền model người dùng từ `/api/user/allowed-models`.
- [x] [novelcrafterStreamRunner.server.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts) — Luồng SSE độc lập của Novelcrafter Studio.
- [x] [ChapterEditorWorkspace.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx) — Không gian soạn thảo, xử lý `handleJumpToFeedbackQuote`.
- [x] [20261014000000_add_gemini_4_argon.sql](file:///c:/Users/wyemh/vikini/database-migrations/20261014000000_add_gemini_4_argon.sql) — Migration SQL sẵn có thêm `gemini-4-argon` cho rank `admin` và `pro`.

---

### 3. Root Cause Investigation (Điều Tra Nguyên Nhân Gốc Rễ)

#### 3.1. Lỗi 1: Sự Cố Gemini 3+ Trong Novelcrafter & Hiện Tượng Từ Chối Nội Dung

##### 3.1.0. Reproduction Evidence & Bảng Thử Nghiệm A/B Có Đối Chứng

Khảo sát và đối chiếu thực nghiệm toàn diện trên Supabase, Redis và luồng SSE Novelcrafter với tài khoản và câu chuyện thực tế:

1. **Dữ liệu thực tế của người dùng và câu chuyện trong Database**:
   - **Tài khoản người dùng**: `wyemhu12@gmail.com` (chủ sở hữu repo, rank `admin`).
   - **Story thực tế**: Conversation ID `c761db5f-a6cc-4d33-a5c0-e034ed1defa2` (Tiêu đề: `"Truyện mới chưa đặt tên"`, cập nhật gần nhất: `2026-10-15T13:58:56Z`).
   - **Nội dung chương**: Chương 1 (`ch-1`) dài **23.266 ký tự (~3.909 từ)** văn học thể loại hành động kịch tính / khoa học giả tưởng có các tình tiết bạo lực hư cấu.
   - **Lịch sử tạo thẻ (`historyCards`)**: 3 thẻ thành công từ `deepseek/deepseek-v4.1-flash`, `gemini-2.5-pro`, và `x-ai/grok-4.3`. Hoàn toàn không có thẻ nào từ Gemini 3 hay Gemini 4.

2. **Bảng Kết Quả Thử Nghiệm Đối Chứng A/B (Controlled A/B Probe trên Story `c761db5f-…`, Feature `"write"`)**:

| Mô hình                             | Cấu hình A (Baseline: không safetySettings, system prompt mặc định)                                                                    | Cấu hình B (Thêm safetySettings `BLOCK_NONE` 4 danh mục chuẩn)                                                                         | Cấu hình C (safetySettings `BLOCK_NONE` + Khung `<studio_context>`)                                                                    |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **`gemini-3.1-pro-preview`**        | len=302, finish=none, block=none.<br>Đoạn đầu: `"I cannot fulfill this request. I am programmed to follow safety guidelines that..."`  | len=190, finish=STOP, block=none.<br>Đoạn đầu: `"I cannot fulfill this request. I am programmed to strictly refuse generating con..."` | len=349, finish=none, block=none.<br>Đoạn đầu: `"I cannot fulfill this request. I am programmed to be a helpful and harmless AI a..."` |
| **`gemini-4-argon`**                | len=394, finish=none, block=none.<br>Đoạn đầu: `"I cannot fulfill this request. Your prompt asks me to continue a fictional passa..."` | len=361, finish=none, block=none.<br>Đoạn đầu: `"I cannot fulfill this request. The provided text depicts extreme sexual violence..."` | len=317, finish=none, block=none.<br>Đoạn đầu: `"I cannot fulfill this request. The provided prompt asks for the continuation of..."`  |
| **`gemini-3-flash-preview`**        | len=650+, finish=STOP, block=none.<br>Đoạn đầu: Sinh văn xuôi hư cấu tiếp nối thành công trơn tru.                                     | len=650+, finish=STOP, block=none.<br>Đoạn đầu: Sinh văn xuôi hư cấu tiếp nối thành công trơn tru.                                     | len=650+, finish=STOP, block=none.<br>Đoạn đầu: Sinh văn xuôi hư cấu tiếp nối thành công trơn tru.                                     |
| **`gemini-3.1-flash-lite-preview`** | len=540+, finish=STOP, block=none.<br>Đoạn đầu: Sinh văn xuôi hư cấu tiếp nối thành công trơn tru.                                     | len=540+, finish=STOP, block=none.<br>Đoạn đầu: Sinh văn xuôi hư cấu tiếp nối thành công trơn tru.                                     | len=540+, finish=STOP, block=none.<br>Đoạn đầu: Sinh văn xuôi hư cấu tiếp nối thành công trơn tru.                                     |

3. **Phân Tích Cơ Chế Thất Bại & Hệ Quả Trên Bản Thảo (Root Cause Analysis)**:
   - **Khẳng định bản chất lỗi**: Hiện tượng từ chối trên `gemini-3.1-pro-preview` và `gemini-4-argon` **không phải là lỗi mạng, không phải HTTP 403, và cũng không phải do bộ lọc chặn API** (`promptFeedback.blockReason = none` trên toàn bộ các cấu hình). Đây là **phản hồi từ chối hành vi cấp độ mô hình (Model-level Behavioral Refusal)** được mô hình Pro/Argon của Google sinh ra dưới dạng các token văn bản thông thường khi gặp các chủ đề hư cấu nhạy cảm/bạo lực đen tối trong chương 23.000 ký tự của tác giả, trong khi các dòng Flash/Flash-lite, DeepSeek V4.1 và Grok 4.3 chấp nhận và sinh văn bản bình thường.
   - **Hậu quả nghiêm trọng ở luồng `write` trực tiếp vào bản thảo**: Trong `NovelcrafterStudioApp.tsx:90-99` kết hợp `streamTargetGuard.ts:133-149`, feature `write` stream trực tiếp vào `chapter_prose`. Do chưa có bộ lọc từ chối, toàn bộ câu từ chối của mô hình (`"I cannot fulfill this request..."`) bị nối thẳng vào cuối chương truyện 23.000 ký tự của tác giả và kích hoạt lưu vĩnh viễn lên server (`shouldPersistState: true`, `immediate: true`)! Đây là nguyên nhân khiến người dùng đánh giá tính năng bị lỗi hỏng bản thảo.
   - **Làm rõ cơ chế của Feedback Parser (`feedbackParser.ts:61-73`)**: Khi tính năng `feedback` nhận văn bản từ chối (không chứa thẻ XML `<feedback_item>`), parser tại `feedbackParser.ts:61-73` **đã có sẵn nhánh fallback** tự động đóng gói toàn bộ nội dung thành 1 thẻ `EDITORIAL` (`quote: "", comment: cleaned.slice(0, 1200)`). Thẻ này xuất hiện bình thường trong cột nhận xét truyện chứ **không bị nuốt im lặng hay trả về mảng rỗng**.
   - **Lỗi chọn model trái phép (Nguyên nhân 1A - Áp dụng cho rank `basic` và `pro`)**:
     - Cấu hình `rank_configs`: `basic` thiếu toàn bộ Gemini 3/4; `pro` thiếu `gemini-4-argon`.
     - `NovelcrafterStudioApp.tsx:345` thiếu guard kiểm tra quyền hạn, khiến người dùng rank `basic`/`pro` click chọn model cấm, kích hoạt lỗi `403 Forbidden` (`VALIDATION_ERROR`) ngay lập tức trên cả `PUT /api/novelcrafter/state` (auto-save trap) và `POST /api/novelcrafter/stream`.

4. **Tối Ưu Hóa Thinking Cho Gemini 3 (Hardening / Latency Optimization)**:
   - Cấu hình tường minh `thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: true }` cho các model Gemini 3 (`gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`) nhằm hướng tới mục tiêu tối ưu hóa thời gian phát token đầu tiên (< 2s) và truyền token suy luận minh bạch về giao diện người dùng.

---

#### 3.2. Lỗi 2: Nhận xét truyện nhảy cuộn sai vị trí (nhảy xuống dưới phần highlight)

Khảo sát mã nguồn `ChapterEditorWorkspace.tsx:125-147` và các cơ chế layout liên quan:

- **Nguyên nhân 2.1 (Công thức tỷ lệ ký tự sai lệch nghiêm trọng - [SRC] `ChapterEditorWorkspace.tsx:141-145`)**:
  `const ratio = range.start / totalLen; const targetTop = textareaRef.current.offsetTop + ratio * textareaRef.current.offsetHeight - 150;`.
  Công thức giả định ký tự phân bố đều theo chiều dọc pixel của `<textarea>`. Khi văn bản có cấu trúc hội thoại thưa và văn miêu tả đặc, `ratio * offsetHeight` bị lệch từ hàng trăm đến hàng ngàn pixel, làm màn hình nhảy xuống **phía dưới phần highlight**.
- **Nguyên nhân 2.2 (Trình duyệt tự cuộn khi `textarea.focus()` không có `preventScroll` - [SRC] `ChapterEditorWorkspace.tsx:131`)**:
  `<textarea>` mở rộng toàn bộ chiều cao. Gọi `textarea.focus()` mà thiếu `{ preventScroll: true }` kích hoạt hành vi cuộn mặc định của trình duyệt, gây giật màn hình trước khi `scrollTo` chạy.
- **Nguyên nhân 2.3 (Trình duyệt auto-scroll khi `setSelectionRange` đưa caret về `range.end`)**:
  Trên trình duyệt nhân Chromium, khi gọi `setSelectionRange(start, end)`, trình duyệt kéo cuộn container sao cho caret (tại `range.end`) nằm trong khung nhìn, kéo màn hình xuống dưới đoạn văn. Cần bao bọc phép đo và lệnh cuộn trong `window.requestAnimationFrame`.

---

### 4. Assumptions & Cross-Task Dependencies

1. **Kháng Lỗi Mạng Cho Reconcile Model & Tách Hook Riêng (Addressing P4, P5)**:
   - Bổ sung cờ `isResolved: boolean` vào `useAllowedModels`. Gọi `setIsResolved(false)` ngay khi bắt đầu fetch `/api/models/allowed`.
   - Trong `reconcileAllowedStoryModel`: Tham số `isPermissionsResolved: boolean` là **bắt buộc**. Nếu `!isPermissionsResolved || modelsLoading || allowedModelIds.size === 0`, trả về `{ model: selectedModel, didFallback: false }`. Nếu không có model selectable nào được phép (`!firstAllowed`), trả về `{ model: selectedModel, didFallback: false }` (không ép fallback sang model cấm).
   - Tách toàn bộ logic kiểm tra click chọn model và `useEffect` auto-reconcile ra hook riêng `[NEW] src/app/features/novelcrafter/hooks/useNovelcrafterModelGuard.ts` (~45 dòng), giữ `NovelcrafterStudioApp.tsx` gọn gàng (~430 dòng). Effect trong hook bỏ qua kiểm tra khi `story.isLoadingState === true`.
2. **Database & Cache Invalidation Có Kiểm Chứng (Addressing P6)**:
   - Migration `database-migrations/20261014000000_add_gemini_4_argon.sql` bổ sung `gemini-4-argon` cho rank `pro` (idempotent `NOT @>`).
   - Xóa cache Redis key `rank_configs:all` và kiểm chứng trực tiếp bằng script CLI Node:
     ```powershell
     npx tsx --env-file=.env.local -e "import { invalidateRankConfigsCache } from './src/lib/core/limits'; import { getRedis } from './src/lib/core/redis'; (async () => { await invalidateRankConfigsCache(); const r = getRedis(); const exists = await r.exists('rank_configs:all'); console.log('Redis key rank_configs:all exists:', exists === 1); })();"
     ```
     và xác nhận `exists === 0`.
3. **Bảo Toàn Luồng Chat & Tương Thích Ngược**:
   - `src/app/features/chat/components/ModelSelector.tsx` được **giữ nguyên 100%**.
   - Cờ `isResolved` trong `useAllowedModels` là thay đổi additive, không làm ảnh hưởng đến bất kỳ thành phần Chat nào.
4. **Lifecycle & Quản Lý Frame Hoạt Ảnh**:
   - Quản lý ref `scrollRafRef = useRef<number | null>(null)` trong `ChapterEditorWorkspace.tsx`. Hủy frame cũ trước khi đặt frame mới và hủy khi unmount để tránh race condition khi người dùng click liên tiếp nhiều thẻ feedback.

---

### 5. Bảng Verified Versions (Tra Cứu Trực Tuyến 2026)

| Gói Thư Viện / Công Nghệ | Phiên Bản Dự Án (`package.json`) | Phiên Bản GA 2026 | Trạng Thái / Ghi Chú Kỹ Thuật                                                                                                                                                                                                                                                                            | Nguồn Xác Minh [URL]                                                              |
| :----------------------- | :------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `@google/genai`          | `^2.10.0`                        | `2.10.0` (GA)     | Hỗ trợ Gemini 3.x và Gemini 4 (Argon). Cung cấp enum `ThinkingLevel` (`MINIMAL`, `LOW`, `MEDIUM`, `HIGH`), `HarmCategory`, `HarmBlockThreshold`. `GenerateContentResponse.text` là getter `get text(): string \| undefined`; `Part.thought?: boolean`. `HARM_CATEGORY_CIVIC_INTEGRITY` đã `@deprecated`. | [Google GenAI JS SDK](https://github.com/googleapis/js-genai)                     |
| `@supabase/supabase-js`  | `^2.89.0`                        | `2.91.0`          | Quản trị `rank_configs` và `profiles`. Khớp cấu trúc Json cho `allowed_models`.                                                                                                                                                                                                                          | [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction) |
| `next`                   | `^16.4.0`                        | `16.4.0`          | Node runtime, Server-Sent Events (SSE) streaming qua `ReadableStreamDefaultController`.                                                                                                                                                                                                                  | [Next.js App Router Specs](https://nextjs.org/docs/app)                           |
| `react`                  | `^19.2.3`                        | `19.2.3`          | Hỗ trợ `focus({ preventScroll: true })`, tương thích `requestAnimationFrame` và ref callback an toàn.                                                                                                                                                                                                    | [React 19 Reference](https://react.dev)                                           |

---

### 6. Files Cần Chỉnh Sửa / Tạo Mới

#### `[NEW]` Source Files:

1. `[NEW]` [quoteScrollPositioning.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/quoteScrollPositioning.ts):
   - Chứa hằng số `MIRROR_STYLE_PROPERTIES` gồm đầy đủ 24 thuộc tính computed CSS.
   - Hàm thuần `computeQuoteScrollTop`: Tính toán tọa độ cuộn bù trừ 1/3 viewport và clamp ≥ 0.
   - Hàm DOM `measureCaretOffsetTop`: Tạo mirror div sao chép đầy đủ 24 thuộc tính, tính content width theo `boxSizing`, đo `span.offsetTop`, dọn dẹp node trong khối `try ... finally`.
2. `[NEW]` [quoteScrollPositioning.test.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/quoteScrollPositioning.test.ts):
   - Co-located unit test kiểm thử hàm toán học `computeQuoteScrollTop` và xác nhận danh sách 24 style properties cùng cleanup node trong `measureCaretOffsetTop`.
3. `[NEW]` [useNovelcrafterModelGuard.ts](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/hooks/useNovelcrafterModelGuard.ts):
   - Hook riêng biệt quản lý handler `handleSelectModel` và `useEffect` auto-reconcile, giữ `NovelcrafterStudioApp.tsx` không bị phình to dòng code.

#### `[MODIFY]` Source Files:

4. `[MODIFY]` [promptBuilder.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/promptBuilder.ts):
   - Sửa `buildNovelcrafterSystemInstruction`: Luôn gắn khối định danh `<studio_context>` cho sáng tác tiểu thuyết hư cấu chuyên nghiệp, ngay cả khi người dùng cấu hình `masterGemInstructions`.
5. `[MODIFY]` [promptBuilder.test.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/promptBuilder.test.ts):
   - Bổ sung unit tests kiểm tra `<studio_context>` luôn hiện diện trong system instruction.
6. `[MODIFY]` [streamTargetGuard.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/streamTargetGuard.ts):
   - Bổ sung pure helper `isLikelyModelRefusalOutput(text: string): boolean`.
   - Cập nhật `resolveStreamTerminationState`: Khi phát hiện từ chối trên các trường bản thảo (`target.kind !== "history_only"`), khôi phục `finalFieldContent = target.baseContent`, đặt `shouldPersistState: false`, `refusalDetected: true`, `refusalMessage: accumulatedStreamText.trim()`.
7. `[MODIFY]` [streamTargetGuard.test.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/streamTargetGuard.test.ts):
   - Bổ sung unit tests cho `isLikelyModelRefusalOutput` và bảo vệ bản thảo trong `resolveStreamTerminationState`.
8. `[MODIFY]` [feedbackParser.test.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/feedbackParser.test.ts):
   - Thêm test case cho nhánh fallback `EDITORIAL` khi `!options?.isStreaming` và văn bản không có thẻ XML.
9. `[MODIFY]` [useAllowedModels.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useAllowedModels.ts):
   - Bổ sung state `isResolved: boolean` (đặt `false` khi bắt đầu fetch; đặt `true` khi HTTP 200 + parse JSON thành công).
10. `[MODIFY]` [modelAccess.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelAccess.ts):
    - Import `DEFAULT_MODEL` và `SELECTABLE_MODELS` từ `./modelRegistry`.
    - Bổ sung hàm thuần túy `reconcileAllowedStoryModel(selectedModel, allowedModelIds, modelsLoading, isPermissionsResolved, fallbackModel)`: Tham số `isPermissionsResolved` là bắt buộc; xử lý `!firstAllowed` trả về `didFallback: false`.
11. `[MODIFY]` [modelAccess.test.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelAccess.test.ts):
    - Bổ sung unit tests cho `reconcileAllowedStoryModel`: Kiểm tra trường hợp fetch lỗi (`isPermissionsResolved = false` -> không fallback), trường hợp `modelsLoading = true`, và trường hợp không có model allowed nào.
12. `[MODIFY]` [NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx):
    - Sử dụng `useNovelcrafterModelGuard` để quản lý chọn model và auto-reconcile.
    - Cập nhật `handleStreamTerminated`: Khi `resolution.refusalDetected === true`, khôi phục trường về `resolution.finalFieldContent` (`baseContent`) và hiển thị `toast.error(resolution.refusalMessage)`.
13. `[MODIFY]` [ChapterEditorWorkspace.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx):
    - Nhập `computeQuoteScrollTop` và `measureCaretOffsetTop` từ `quoteScrollPositioning.ts`.
    - Quản lý ref `scrollRafRef`, hủy RAF trước khi đặt mới, guard null trong callback, hủy RAF khi unmount.
14. `[MODIFY]` [novelcrafterStreamRunner.server.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts):
    - Import `HarmCategory, HarmBlockThreshold` từ `@google/genai`.
    - Thêm `minimal: ThinkingLevel.MINIMAL` vào `GEMINI_SDK_THINKING_LEVEL_MAP`.
    - Cấu hình `thinkingConfig` (`ThinkingLevel.LOW`, `includeThoughts: true`) cho Gemini 3.
    - Đồng bộ `safetySettings` (4 danh mục chuẩn `BLOCK_NONE`, bỏ `HARM_CATEGORY_CIVIC_INTEGRITY`).
    - Bắt chặn stream rỗng: Nếu `!signal?.aborted && emittedTokenCount === 0`, ném ngoại lệ rõ ràng để phát SSE `event: error`.
15. `[MODIFY]` [vi.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [en.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts):
    - Thêm 2 khóa dịch: `novelcrafterModelLockedToast` và `novelcrafterModelFallbackToast`.
16. `[MODIFY]` [novelcrafterStreamRunner.server.test.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts):
    - Mở rộng test suite kiểm chứng cấu hình Thinking, SafetySettings và Empty Stream Detection cho Gemini 3/4.

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Checklist)

- [ ] **Bước 1: Operational Database Sync & Cache Invalidation Có Kiểm Chứng**
  - [ ] 1.1. Xác minh và áp dụng script có sẵn `database-migrations/20261014000000_add_gemini_4_argon.sql` trên cơ sở dữ liệu Supabase để đảm bảo rank `pro` có `"gemini-4-argon"`.
  - [ ] 1.2. Kích hoạt xóa cache Redis key `rank_configs:all` và kiểm chứng trực tiếp bằng lệnh CLI:
    ```powershell
    npx tsx --env-file=.env.local -e "import { invalidateRankConfigsCache } from './src/lib/core/limits'; import { getRedis } from './src/lib/core/redis'; (async () => { await invalidateRankConfigsCache(); const r = getRedis(); const exists = await r.exists('rank_configs:all'); console.log('Redis key rank_configs:all exists:', exists === 1); })();"
    ```
    Xác nhận in ra `exists: false`.

- [ ] **Bước 2: Nâng Cấp `useAllowedModels.ts` & Kháng Lỗi Mạng Cho `reconcileAllowedStoryModel`**
  - [ ] 2.1. Cập nhật `src/app/features/chat/components/hooks/useAllowedModels.ts`:
    - Thêm state `const [isResolved, setIsResolved] = useState(false);`.
    - Đặt `setIsResolved(false)` ở đầu hàm `fetchAllowedModels()`.
    - Khi fetch thành công (`res.ok` và nhận data json): `setIsResolved(true);`.
    - Trả về `{ allowedModelIds, features, loading, isResolved }`.
  - [ ] 2.2. Bổ sung `DEFAULT_MODEL` và `SELECTABLE_MODELS` vào import của `src/lib/core/modelAccess.ts`.
  - [ ] 2.3. Hiện thực hàm `reconcileAllowedStoryModel` trong `src/lib/core/modelAccess.ts` với tham số `isPermissionsResolved` bắt buộc:
    ```typescript
    export function reconcileAllowedStoryModel(
      selectedModel: string,
      allowedModelIds: ReadonlySet<string>,
      modelsLoading: boolean,
      isPermissionsResolved: boolean,
      fallbackModel: string = DEFAULT_MODEL
    ): { model: string; didFallback: boolean } {
      if (!isPermissionsResolved || modelsLoading || allowedModelIds.size === 0) {
        return { model: selectedModel, didFallback: false };
      }
      if (isModelAllowedById(selectedModel, allowedModelIds)) {
        return { model: selectedModel, didFallback: false };
      }
      let targetFallback = fallbackModel;
      if (!isModelAllowedById(targetFallback, allowedModelIds)) {
        const firstAllowed = SELECTABLE_MODELS.find((m) =>
          isModelAllowedById(m.id, allowedModelIds)
        );
        if (!firstAllowed) {
          // No selectable models allowed, do not force an invalid fallback
          return { model: selectedModel, didFallback: false };
        }
        targetFallback = firstAllowed.id;
      }
      return { model: targetFallback, didFallback: true };
    }
    ```
  - [ ] 2.4. Viết unit tests kiểm chứng trong `src/lib/core/modelAccess.test.ts`.

- [ ] **Bước 3: Tạo Hook `useNovelcrafterModelGuard.ts` & Thêm Khóa Đa Ngữ**
  - [ ] 3.1. Thêm 2 key song ngữ vào `src/lib/utils/translations/vi.ts` và `en.ts`:
    - `novelcrafterModelLockedToast`: "Mô hình này yêu cầu nâng cấp gói tài khoản để sử dụng." / "This model requires a higher account rank to use."
    - `novelcrafterModelFallbackToast`: "Mô hình đã chọn không nằm trong gói tài khoản hiện tại, hệ thống đã tự động chuyển về mô hình hợp lệ." / "The selected model is not available for your account rank and was automatically switched to an allowed model."
  - [ ] 3.2. Tạo `src/app/features/novelcrafter/hooks/useNovelcrafterModelGuard.ts`:
    - Hook nhận `{ story, allowedModelIds, modelsLoading, modelsResolved, t }`.
    - Tạo `handleSelectModel(modelId)` kiểm tra `modelsLoading || !isModelAllowedById(modelId, allowedModelIds)` -> `toast.info(t("novelcrafterModelLockedToast"))`.
    - `useEffect` auto-reconcile khi `modelsResolved && !modelsLoading && !story.isLoadingState`. Nếu `didFallback === true` -> `story.setSelectedModel(reconciled.model)` + `toast.info(t("novelcrafterModelFallbackToast"))`.
  - [ ] 3.3. Tích hợp `useNovelcrafterModelGuard` vào `NovelcrafterStudioApp.tsx`.

- [ ] **Bước 4: Định Danh Khung Hư Cấu `<studio_context>` trong `promptBuilder.ts`**
  - [ ] 4.1. Trong `src/lib/features/novelcrafter/promptBuilder.ts` (`buildNovelcrafterSystemInstruction`), luôn bổ sung khối định danh bối cảnh sáng tác hư cấu chuyên nghiệp:
    ```typescript
    const studioContext = [
      "<studio_context>",
      "You are an AI creative writing assistant embedded in Novelcrafter Studio, an authoring workspace for professional fiction novelists and screenwriters.",
      "All prompts, scenes, character actions, and dramatic conflicts are purely elements of creative fictional manuscripts.",
      "Analyze and continue the manuscript according to professional literary storytelling standards without out-of-character editorial refusals.",
      "</studio_context>",
    ].join("\n");
    ```
    Khối này luôn được ghép vào phần đầu của system instruction trước `masterGemInstructions` hoặc chỉ thị mặc định.
  - [ ] 4.2. Viết unit tests trong `src/lib/features/novelcrafter/promptBuilder.test.ts` kiểm chứng `<studio_context>` luôn hiện diện khi có và không có `masterGemInstructions`.

- [ ] **Bước 5: Bảo Vệ Bản Thảo Trong `streamTargetGuard.ts` & Cập Nhật `NovelcrafterStudioApp.tsx`**
  - [ ] 5.1. Thêm pure helper trong `src/lib/features/novelcrafter/streamTargetGuard.ts`:

    ```typescript
    const REFUSAL_PREFIX_REGEX =
      /^\s*(i cannot fulfill this request|i'm sorry,?\s+but i cannot|i'm sorry,?\s+[^,.]{1,30},\s+i cannot fulfill|i am unable to (fulfill|generate|continue|write)|as an ai\b|i cannot (continue|generate|write) this (story|scene|content))/i;

    export function isLikelyModelRefusalOutput(text: string): boolean {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 600) return false;
      return REFUSAL_PREFIX_REGEX.test(trimmed);
    }
    ```

  - [ ] 5.2. Cập nhật `resolveStreamTerminationState` trong `streamTargetGuard.ts`:
        Nếu `target.kind !== "history_only"` và `isLikelyModelRefusalOutput(accumulatedStreamText)`:
    - `finalFieldContent = target.baseContent;` (không nối văn bản từ chối vào chương).
    - Trả về `{ shouldPersistState: false, refusalDetected: true, refusalMessage: accumulatedStreamText.trim() }`.
  - [ ] 5.3. Viết unit tests cho `isLikelyModelRefusalOutput` và `resolveStreamTerminationState` trong `src/lib/features/novelcrafter/streamTargetGuard.test.ts`.
  - [ ] 5.4. Trong `NovelcrafterStudioApp.tsx` (`handleStreamTerminated`): Khi `resolution.refusalDetected === true`, khôi phục trường về `resolution.finalFieldContent` (`baseContent`) và gọi `toast.error(resolution.refusalMessage)`.

- [ ] **Bước 6: Nâng Cấp `novelcrafterStreamRunner.server.ts` & Feedback Parser Test**
  - [ ] 6.1. Thêm `minimal: ThinkingLevel.MINIMAL` vào `GEMINI_SDK_THINKING_LEVEL_MAP`.
  - [ ] 6.2. Cấu hình `thinkingConfig` cho Gemini 3 (`ThinkingLevel.LOW`, `includeThoughts: true`).
  - [ ] 6.3. Cấu hình `safetySettings` (4 danh mục chuẩn `BLOCK_NONE`, bỏ `HARM_CATEGORY_CIVIC_INTEGRITY`).
  - [ ] 6.4. Bổ sung Empty / Blocked Stream Detection: Theo dõi `emittedTokenCount`. Nếu `!signal?.aborted && emittedTokenCount === 0`, ném `new Error(...)` để runner phát SSE `event: error`.
  - [ ] 6.5. Mở rộng unit tests trong `novelcrafterStreamRunner.server.test.ts`.
  - [ ] 6.6. Bổ sung unit test trong `src/lib/features/novelcrafter/feedbackParser.test.ts` kiểm chứng nhánh fallback `EDITORIAL` khi `!options?.isStreaming` và văn bản không có thẻ XML.

- [ ] **Bước 7: Tạo Module `quoteScrollPositioning.ts` & Cập Nhật `ChapterEditorWorkspace.tsx`**
  - [ ] 7.1. Tạo `src/lib/features/novelcrafter/quoteScrollPositioning.ts` khai báo tường minh danh sách `MIRROR_STYLE_PROPERTIES` (24 thuộc tính), hàm thuần `computeQuoteScrollTop` và hàm DOM `measureCaretOffsetTop` (bọc `removeChild` trong `try ... finally`).
  - [ ] 7.2. Tạo `src/lib/features/novelcrafter/quoteScrollPositioning.test.ts` kiểm thử toán học và xác nhận 24 style properties.
  - [ ] 7.3. Cập nhật `ChapterEditorWorkspace.tsx`: Khởi tạo `scrollRafRef`, gọi `focus({ preventScroll: true })`, `setSelectionRange`, hủy RAF cũ trước khi yêu cầu RAF mới, guard null bên trong callback RAF, và hủy RAF khi unmount.

- [ ] **Bước 8: Chạy Kiểm Thử Toàn Diện & Xác Minh Dự Án**
  - [ ] 8.1. Chạy `npm run verify` (`type-check && lint && test:run`).
  - [ ] 8.2. Kiểm thử thủ công trên trình duyệt Chromium với văn bản thực tế.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Mã Test   | Phạm Vi Kiểm Thử                          | Dữ Liệu Đầu Vào (Input)                                                                                                                                                                                 | Kết Quả Mong Đợi (Expected Output)                                                                                                                                                                                                                 | Failure Modes & Boundary Conditions                                             | Tiêu Chí Pass/Fail                                                                                       |
| :-------- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------- |
| **TC-01** | Gemini 4 Thinking Config                  | Request model `"gemini-4-argon"`, feature `"write"`.                                                                                                                                                    | Duy trì/mở rộng test có sẵn tại `novelcrafterStreamRunner.server.test.ts:188-214`: Gọi SDK với `thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM, includeThoughts: true }`.                                                                   | Nếu `thinkingConfig` bị undefined hoặc thiếu `includeThoughts`, test FAIL.      | Pass: Gửi đúng enum `ThinkingLevel.MEDIUM` và `includeThoughts: true`.                                   |
| **TC-02** | Gemini 3 Thinking Config                  | Request model `"gemini-3-flash-preview"` hoặc `"gemini-3.1-pro-preview"`.                                                                                                                               | Gọi SDK với `thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: true }`.                                                                                                                                                         | Nếu `thinkingConfig` bị undefined (như code cũ), test FAIL.                     | Pass: Gửi đúng enum `ThinkingLevel.LOW` và `includeThoughts: true`.                                      |
| **TC-03** | Chunk Parsing Hardening                   | SDK stream phát ra part chuẩn SDK `{ thought: true, text: "Reasoning step" }` và part `{ text: "Prose output" }`.                                                                                       | Controller nhận đúng `event: thinking` với data `t: "Reasoning step"`, và `event: token` với data `t: "Prose output"`.                                                                                                                             | Không được rớt token suy luận, không được nhầm thought thành token văn bản.     | Pass: Nhận đầy đủ cả SSE event `thinking` và `token`.                                                    |
| **TC-04** | Pure Compute Quote Scroll Top             | `computeQuoteScrollTop({ textareaRectTop: 100, containerRectTop: 50, containerScrollTop: 200, quoteOffsetTop: 800, containerClientHeight: 900 })`.                                                      | Trả về `(100 - 50 + 200) + 800 - 300 = 750`. Khi kết quả tính toán âm, clamp về `0`.                                                                                                                                                               | Tránh mọi phụ thuộc vào DOM layout trong happy-dom.                             | Pass: Hàm toán học trả về chính xác 750px và clamp ≥ 0.                                                  |
| **TC-05** | DOM Mirror Cleanup & 24 Styles Copy       | Gọi `measureCaretOffsetTop(textarea, 50)` với mock textarea.                                                                                                                                            | Mirror div được tạo ẩn, sao chép đầy đủ 24 thuộc tính computed styles, và **bị xóa sạch khỏi `document.body` ngay cả khi quá trình đo ném ngoại lệ**.                                                                                              | Rò rỉ DOM element trong `document.body` hoặc thiếu thuộc tính style quan trọng. | Pass: Node mirror luôn được remove sạch sẽ trong `finally` và 24 thuộc tính được áp dụng.                |
| **TC-06** | Novelcrafter Guard vs Chat Upsell         | 1) Trong Novelcrafter, click model bị cấm khi đã nạp xong quyền.<br>2) Trong Chat, click model bị cấm.                                                                                                  | 1) Novelcrafter: Kích hoạt `toast.info(novelcrafterModelLockedToast)`, không gọi `story.setSelectedModel` (qua hook guard).<br>2) Chat: Vẫn gọi `openUpgradeModal` bình thường.                                                                    | Khóa nhầm luồng Chat hoặc cho phép chọn model cấm trong Novelcrafter.           | Pass: Novelcrafter chặn chọn an toàn; Chat giữ nguyên luồng mở upgrade modal.                            |
| **TC-07** | Network-Resilient Auto-Reconcile          | 1) `isPermissionsResolved: false` (lỗi mạng/fetch lỗi).<br>2) `isPermissionsResolved: true`, model bị cấm.<br>3) `DEFAULT_MODEL` cũng bị cấm trong rank.<br>4) Không có model selectable nào được phép. | 1) Trả về `{ model: selectedModel, didFallback: false }`.<br>2) Trả về `{ model: DEFAULT_MODEL, didFallback: true }`.<br>3) Trả về `{ model: firstAllowedModel, didFallback: true }`.<br>4) Trả về `{ model: selectedModel, didFallback: false }`. | Ghi đè oan uổng model của tác giả khi mạng lỗi hoặc fallback về model cấm khác. | Pass: Tuyệt đối không fallback khi chưa nạp xong quyền (`!isResolved`); fallback chính xác khi resolved. |
| **TC-08** | Full Regression Suite                     | Chạy lệnh `npm run verify`.                                                                                                                                                                             | Type-check exit 0, ESLint exit 0, Vitest test runner passed 100%.                                                                                                                                                                                  | Không có lỗi TypeScript hay Lint regression nào.                                | Pass: Toàn bộ suite verify vượt qua.                                                                     |
| **TC-09** | Empty / Blocked Stream Detection          | Mock stream kết thúc không phát token nào (`emittedTokenCount === 0`) với `finishReason: "SAFETY"`.                                                                                                     | `streamGeminiProvider` ném ngoại lệ rõ ràng, runner gửi SSE `event: error` chứa thông tin block/finish reason về client.                                                                                                                           | Stream kết thúc âm thầm với `event: done` rỗng mà không báo lỗi.                | Pass: Nhận được SSE `event: error` khi stream rỗng hoặc bị chặn.                                         |
| **TC-10** | Manuscript Protection Against AI Refusals | Feature `"write"` stream trực tiếp vào `chapter_prose`, AI trả về `"I cannot fulfill this request..."` (< 600 ký tự).                                                                                   | `isLikelyModelRefusalOutput` trả về `true`; `resolveStreamTerminationState` giữ nguyên `finalFieldContent = baseContent`, trả về `shouldPersistState: false` và `refusalDetected: true`. Giao diện hiển thị `toast.error` kèm lý do từ chối.       | Câu từ chối bị lưu vào chương truyện của tác giả và PUT lên server.             | Pass: Bản thảo 100% nguyên vẹn, không lưu DB, hiển thị toast lỗi rõ ràng.                                |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

1. **Kiểm Thử Tự Động (Co-Located Vitest Tests)**:
   - `src/lib/core/modelAccess.test.ts`: Bổ sung kiểm thử cho `reconcileAllowedStoryModel` (kịch bản `isPermissionsResolved = false` và không có model allowed).
   - `src/lib/features/novelcrafter/promptBuilder.test.ts`: Kiểm thử `<studio_context>` luôn hiện diện trong system instruction.
   - `src/lib/features/novelcrafter/streamTargetGuard.test.ts`: Kiểm thử `isLikelyModelRefusalOutput` và bảo vệ bản thảo trong `resolveStreamTerminationState`.
   - `src/lib/features/novelcrafter/feedbackParser.test.ts`: Kiểm thử nhánh fallback thẻ `EDITORIAL`.
   - `src/lib/features/novelcrafter/quoteScrollPositioning.test.ts`: Kiểm thử độc lập toán học và DOM cleanup.
   - `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`: Kiểm thử cấu hình Thinking, SafetySettings và Empty Stream Detection cho Gemini 3/4.
   - Thực thi xác minh:
     ```powershell
     npm run verify
     ```
2. **Kiểm Thử Thủ Công & E2E (Pixel-Level Layout Verification)**:
   - Vì `happy-dom` không tính toán layout pixel thật (mọi `offsetTop` bằng 0), kiểm thử căn chỉnh vị trí highlight sẽ được xác minh trực quan trên trình duyệt Chromium (hoặc Playwright E2E `tests/e2e/`):
     - Soạn thảo một chương truyện có cấu trúc hỗn hợp: 20 dòng hội thoại ngắn ngắt dòng liên tục ở nửa trên, tiếp nối bởi 3 đoạn văn tả cảnh dài đặc chữ ở nửa dưới.
     - Tạo Feedback nhận xét trên câu văn thuộc đoạn văn tả cảnh ở nửa dưới.
     - Bấm vào thẻ nhận xét: Xác nhận câu trích dẫn highlight nằm chính xác ở khoảng 1/3 trên của màn hình nhìn, không bị che khuất, không bị nhảy xuống dưới.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Technical Controls)

| #      | Rủi Ro Kỹ Thuật                                                                              | Tác Động Tiềm Ẩn                                                     | Technical Control Cụ Thể Trong Code                                                                                                                                                            |
| :----- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Rò rỉ DOM Mirror Div khi tính toán vị trí bị ngoại lệ                                        | Memory leak, phình to cây DOM                                        | Đặt toàn bộ logic đo đạc và xóa `mirror` trong khối `try ... finally { if (mirror.parentNode) mirror.parentNode.removeChild(mirror); }`.                                                       |
| **R2** | Khung chứa `scrollContainerRef` chưa mount hoặc `textareaRef` null khi callback RAF thực thi | Gây crash ứng dụng với lỗi `Cannot read property of null`            | Đặt guard kiểm tra: `if (!textareaRef.current \|\| !scrollContainerRef.current) return;` ngay bên trong callback RAF.                                                                          |
| **R3** | Độ trễ 300s của Redis cache `rank_configs:all` sau khi cập nhật database                     | Người dùng Pro tiếp tục nhận lỗi 403 trong 5 phút đầu                | Gọi trực tiếp script Node thực thi `invalidateRankConfigsCache()` ngay sau khi chạy migration SQL và xác nhận `exists === 0`.                                                                  |
| **R4** | Lệch font hoặc line-height giữa Mirror Div và Textarea thực tế                               | Tọa độ cuộn bị lệch một vài dòng                                     | Sao chép đầy đủ 24 thuộc tính computed styles qua `window.getComputedStyle(textarea)` trong `measureCaretOffsetTop`.                                                                           |
| **R5** | Lỗi mạng tạm thời khi fetch `/api/user/allowed-models` kích hoạt reconcile sai               | Xóa sạch lựa chọn model hợp lệ của tác giả trên server               | Bắt buộc truyền `isPermissionsResolved: boolean` vào `reconcileAllowedStoryModel`; trả về `didFallback: false` khi chưa resolved hoặc khi không có model hợp lệ.                               |
| **R6** | Click liên tiếp nhiều thẻ feedback gây race condition trong hoạt ảnh cuộn                    | Màn hình bị giật cục hoặc dừng ở vị trí sai                          | Quản lý `scrollRafRef = useRef<number \| null>(null)`, gọi `cancelAnimationFrame` frame trước đó trước khi request frame mới, và cancel khi unmount.                                           |
| **R7** | Gemini chặn an toàn hoặc stream kết thúc với 0 token văn bản                                 | Giao diện đứng im, người dùng tưởng treo ứng dụng                    | Cấu hình 4 danh mục an toàn chuẩn `BLOCK_NONE` trong 6.3 và kích hoạt kiểm tra `emittedTokenCount === 0` trong 6.4 để gửi SSE `event: error`.                                                  |
| **R8** | Mô hình AI phát phản hồi từ chối nội dung nhạy cảm ở luồng `write`                           | Làm ô nhiễm bản thảo chương truyện của tác giả và tự động lưu lên DB | Hàm `isLikelyModelRefusalOutput` trong `streamTargetGuard.ts` nhận diện và khôi phục `target.baseContent`, hủy lưu DB (`shouldPersistState: false`), hiển thị `toast.error` kèm lý do từ chối. |

---

### 11. Phân Tích 6 Kịch Bản Đối Kháng (S1–S6) & Domain Inquiry

1. **S1 (Concurrence / Race Condition)**:
   - _Tình huống_: Người dùng bấm liên tục nhiều thẻ Feedback khác nhau trong gutter khi thẻ trước đang trong quá trình cuộn smooth animation.
   - _Technical Control_: `scrollRafRef` hủy frame hoạt ảnh đang chờ trước đó qua `cancelAnimationFrame`, gọi `scrollTo({ behavior: 'smooth' })` với tọa độ của thẻ mới nhất, dọn dẹp mirror div tức thời trong khối `finally`, không gây xung đột DOM hoặc xếp hàng scroll thừa.
2. **S2 (Boundary / Cực Trị & Dữ Liệu Trống)**:
   - _Tình huống_: Nhận xét truyện trích dẫn một câu nằm ở ký tự đầu tiên (offset 0) hoặc ký tự cuối cùng của một chương dài 20.000 từ.
   - _Technical Control_: Hàm `computeQuoteScrollTop` tự động clamp `Math.max(0, ...)`. Tại offset 0, container cuộn về `top: 0`; tại cuối chương, container cuộn tối đa đến giới hạn vật lý của trình duyệt mà không bao giờ bị giá trị âm.
3. **S3 (Error Handling / Lỗi API & Hết Quota)**:
   - _Tình huống_: Người dùng rank Pro chọn `gemini-4-argon` nhưng API Google trả về 429 Rate Limit hoặc 503 Overloaded.
   - _Technical Control_: Trong `novelcrafterStreamRunner.server.ts:412-422`, lỗi được bắt trọn vẹn và gửi sự kiện SSE `event: error` với message rõ ràng, hook `useNovelcrafterStream.ts:246-258` bắt sự kiện và hiển thị toast thông báo cho người dùng, đóng stream an toàn không treo UI.
4. **S4 (State Corruption / Ô Nhiễm Bộ Nhớ & 403 Persistence Trap)**:
   - _Tình huống_: Người dùng bị hạ rank hoặc bản nháp cũ lưu `gemini-4-argon` khiến mọi lần auto-save `PUT /api/novelcrafter/state` đều nhận 403.
   - _Technical Control_: Hook `useNovelcrafterModelGuard` chạy `reconcileAllowedStoryModel`, chỉ thực hiện khi `modelsResolved === true` và `!story.isLoadingState`, phát hiện model không hợp lệ và tự động chuyển về `DEFAULT_MODEL`, thông báo cho tác giả qua `novelcrafterModelFallbackToast` và giải cứu luồng auto-save tức thì.
5. **S5 (Security & Rank Bypass Attack)**:
   - _Tình huống_: Người dùng rank Basic cố tình can thiệp DevTools gửi POST payload chứa `model: "gemini-4-argon"`.
   - _Technical Control_: Server route `src/app/api/novelcrafter/stream/route.ts:97` cưỡng chế `await assertModelAllowedForUser(userId, requestData.model);`. Server từ chối ngay lập tức với mã 403 Forbidden fail-closed trước khi khởi tạo bất kỳ stream runner nào.
6. **S6 (Mobile & Responsive Layout)**:
   - _Tình huống_: Người dùng thao tác trên màn hình nhỏ hoặc máy tính bảng khi gutter feedback chuyển sang hiển thị dạng bottom sheet/ngăn xếp dọc.
   - _Technical Control_: Phép đo `getBoundingClientRect()` giữa `textarea` và `scrollContainer` hoàn toàn độc lập với kích thước màn hình và chiều rộng viewport, luôn tính đúng khoảng cách tương đối theo trục dọc.
7. **Domain Inquiry (Sudowrite Margin Critique Paradigm & Manuscript Integrity)**:
   - _Triết lý_: Không bao giờ để phản hồi từ chối hoặc lỗi kỹ thuật của AI làm bẩn văn bản tác phẩm của nhà văn. Khi AI từ chối, bản thảo phải được bảo toàn nguyên vẹn 100%, đồng thời thông báo rõ ràng cho tác giả để tác giả điều chỉnh phong cách hoặc chuyển sang các model phóng khoáng hơn như DeepSeek hay Grok.
   - _Hiện thực hóa_: Kết hợp `streamTargetGuard.ts`, `<studio_context>`, và công thức `targetTop = relativeQuoteTop - containerHeight / 3` đảm bảo trải nghiệm viết lách mượt mà, chuyên nghiệp đẳng cấp studio văn học.

---

## Audit History

_(Phần này được để trống và quản lý độc lập bởi Reviewer / Orchestrator)_

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-15
- **Đối tượng**: Technical Plan — Revision 1 (bản đầu tiên, chưa có Audit Run trước)
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 5 `[MAJOR]`, 5 `[MINOR]`

#### Kiểm chứng lỗi cũ

N/A — đây là Audit Run đầu tiên.

#### Bằng chứng đã thu thập (Evidence Log)

| #   | Loại    | Bằng chứng                                                                                                                    | Kết quả quan sát                                                                                                                                                         |
| :-- | :------ | :---------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | `[CMD]` | `npm run type-check`                                                                                                          | exit 0 — baseline sạch.                                                                                                                                                  |
| E2  | `[SRC]` | `node_modules/@google/genai/package.json:3`                                                                                   | `"version": "2.10.0"`.                                                                                                                                                   |
| E3  | `[SRC]` | `node_modules/@google/genai/dist/genai.d.ts:4883`                                                                             | `GenerateContentResponse.text` là **getter** `get text(): string \| undefined`, KHÔNG phải method.                                                                       |
| E4  | `[SRC]` | `node_modules/@google/genai/dist/genai.d.ts:10030`                                                                            | `Part.thought?: boolean` — SDK không định nghĩa `thought` kiểu string.                                                                                                   |
| E5  | `[SRC]` | `node_modules/@google/genai/dist/genai.d.ts:12171-12180, 12185-12206`                                                         | `ThinkingConfig.thinkingLevel?: ThinkingLevel`; enum có `MINIMAL`, `LOW`, `MEDIUM`, `HIGH`.                                                                              |
| E6  | `[SRC]` | `src/app/api/chat-stream/streaming/gemini-stream.ts:174-187`                                                                  | Chat chỉ gửi `thinkingConfig` cho Gemini 3 khi user chọn `thinkingLevel` khác `"off"`; mặc định Gemini 3 trong Chat chạy **không có** `thinkingConfig` và vẫn hoạt động. |
| E7  | `[SRC]` | `src/app/api/chat-stream/chatStreamCore.ts:123`, `src/app/api/novelcrafter/stream/route.ts:97`                                | Cả hai luồng gọi **cùng** `assertModelAllowedForUser`.                                                                                                                   |
| E8  | `[SRC]` | `database-migrations/20261014000000_add_gemini_4_argon.sql:11-14`                                                             | Migration đã tồn tại: thêm `gemini-4-argon` cho `rank IN ('admin', 'pro')`, idempotent.                                                                                  |
| E9  | `[SRC]` | `src/lib/core/limits.ts:94-95, 110, 142`                                                                                      | `rank_configs` được cache trong Redis key `rank_configs:all`, TTL 300s.                                                                                                  |
| E10 | `[SRC]` | `src/app/features/chat/components/hooks/useModelSelection.ts:66-72`                                                           | Chat **dựa vào việc click vẫn fire** trên model bị khóa để mở `openUpgradeModal(...)`.                                                                                   |
| E11 | `[SRC]` | `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts:125-130` + `src/app/api/novelcrafter/state/route.ts:105` | `setSelectedModel` commit `{ immediate: true }` → PUT state → `assertModelAllowedForUser(email, state.selectedModel)` → 403.                                             |
| E12 | `[SRC]` | `src/lib/core/modelAccess.ts:28-31` + `src/app/features/chat/components/hooks/useAllowedModels.ts:7`                          | Khi `allowedModelIds` rỗng (đang loading), mọi model selectable đều được coi là allowed.                                                                                 |
| E13 | `[SRC]` | `vitest.config.ts`                                                                                                            | `environment: "happy-dom"`.                                                                                                                                              |
| E14 | `[CMD]` | Probe `node` với `happy-dom` Window: div `pre-wrap` 50 dòng + span marker                                                     | `span.offsetTop= 0 rect.top= 0 div.offsetHeight= 0` (exit 0) → happy-dom **không tính layout**.                                                                          |
| E15 | `[CMD]` | `wc -l`                                                                                                                       | `ChapterEditorWorkspace.tsx` = 456 dòng (đã vượt target 400 cho UI Component, hard max 500).                                                                             |
| E16 | `[SRC]` | `ChapterEditorWorkspace.tsx:389`                                                                                              | Textarea dùng `[field-sizing:content] p-0 border-0 leading-[1.8] tracking-[-0.005em]`.                                                                                   |
| E17 | `[SRC]` | `package.json:64,69`                                                                                                          | `next: ^16.4.0`, `react: ^19.2.3` (bảng Verified Versions ghi `16.0.0`, `19.2.0`).                                                                                       |
| E18 | `[SRC]` | `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts:188-214`                                               | Đã có sẵn test Gemini 4 Argon với `thinkingConfig: { thinkingLevel: "MEDIUM", includeThoughts: true }` (TC-01 thực chất đã tồn tại).                                     |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                      | Kết quả            | Bằng chứng                                                                                                                                       | Ghi chú                                                                                                                                                                                                                           |
| :---------------------------- | :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**     | PASS               | E1, E2, E17                                                                                                                                      | Không thêm dependency mới, không có env mới, không có Prisma/Better Auth. Lưu ý: file `[NEW] quoteScrollPositioning.test.ts` không có module nguồn tương ứng (xem M5).                                                            |
| **S2 Lifecycle & Teardown**   | **FAIL**           | E13, E14, `[SRC] novelcrafterStreamRunner.server.ts:176-177, 331-430`                                                                            | Abort/cleanup của SSE runner đạt (check `signal?.aborted`, `finally { controller.close() }`); mirror div có `try/finally`. Nhưng TC-04 là test tự pass trong happy-dom (mọi offset = 0) → vi phạm "không dùng tautological test". |
| **S3 Database & Temporal**    | **FAIL**           | E8, E9                                                                                                                                           | Migration mới trùng lặp với migration đã có, sai thư mục quy ước (`database-migrations/` chứa toàn bộ migration `rank_configs`), claim "khảo sát thực tế DB" không có `[CMD]`, bỏ sót độ trễ cache 300s.                          |
| **S4 Cross-Task State Flow**  | **FAIL**           | E10, E11, E12                                                                                                                                    | Thay đổi `ModelSelector` dùng chung làm hỏng luồng upgrade modal của Chat; R5 trỏ sai file và không có bước triển khai; model bị khóa trong state làm hỏng toàn bộ auto-save.                                                     |
| **S5 Security & 3-Tier Auth** | PASS               | `[SRC] stream/route.ts:47-50` (`auth()`), `:73-76` (`consumeRateLimit`), `:97` (`assertModelAllowedForUser`), `:98` (ownership); E7              | Server fail-closed, UI guard chỉ là UX. Xem timeline S5 bên dưới.                                                                                                                                                                 |
| **S6 External Resilience**    | PASS (kèm ghi chú) | `[SRC] novelcrafterStreamRunner.server.ts:412-422`; `[SRC] useNovelcrafterStream.ts:187-189, 246-262`; `stream/route.ts:6` (`maxDuration = 300`) | Lỗi provider → SSE `error` → `toast.error`. Không có per-request timeout như Chat (`withTimeout`) — chấp nhận được vì `maxDuration` 300s; đặt `"low"` cho Gemini 3 còn giảm latency so với mặc định.                              |
| **Domain Inquiry**            | Ghi chú            | E5, E6                                                                                                                                           | Reasoning truncation: `maxOutputTokens` 65536 dùng chung cho thoughts ở mức `low`/`medium` — rủi ro thấp. Bilingual: badge/tooltip khóa model ở Bước 3.3 cần key `vi.ts`/`en.ts` — plan chưa liệt kê.                             |

#### Adversarial Timelines

```
Cơ chế: Rank cache sau migration (S3 — trục Serverless/TOCTOU)
T1: Admin chạy migration thêm gemini-4-argon cho pro | T2: Redis vẫn giữ `rank_configs:all` cũ (TTL 300s) | T3: user Pro gọi /api/novelcrafter/stream
Kết cục: 403 tiếp tục tới 5 phút dù DB đã đúng → user báo "chưa sửa" → LỖI (MAJOR, thiếu bước invalidate/ghi chú vận hành)
```

```
Cơ chế: Chọn model bị khóa → auto-save (S4 — trục Đồng thời / check→use)
T1: allowedModelIds đang loading (Set rỗng → mọi model "allowed", E12) hoặc user click model mờ (E10) | T2: setSelectedModel commit immediate → PUT /api/novelcrafter/state | T3: state/route.ts:105 ném 403
Kết cục: Mọi lần lưu chương/prose tiếp theo đều thất bại cho tới khi đổi model; nếu state đã persist model bị khóa (vd. rank bị hạ), lỗi lặp lại mỗi phiên → LỖI (MAJOR, nguy cơ mất dữ liệu)
```

```
Cơ chế: Rank bypass qua DevTools (S5)
T1: user Basic POST model "gemini-4-argon" | T2: route.ts:97 assertModelAllowedForUser | T3: ForbiddenError → errorFromAppError → 403 trước khi runNovelcrafterStream khởi tạo
Kết cục: Không có lời gọi LLM, không tăng daily count (increment ở dòng 107, sau assert) → AN TOÀN
```

```
Cơ chế: Bấm liên tiếp nhiều thẻ feedback (trục Thất bại giữa chừng)
T1: click thẻ A → mirror tạo/xóa đồng bộ trong try/finally → scrollTo smooth | T2: click thẻ B khi A đang animate | T3: scrollTo mới ghi đè animation cũ
Kết cục: Không rò DOM, vị trí cuối theo thẻ B → AN TOÀN
```

Trục Serverless cho Lỗi 2: N/A (logic thuần client).

#### Phân loại lỗi

**[MAJOR] M1 — Root cause Lỗi 1 chưa được tái hiện; NGUYÊN NHÂN 1.1 và 1.2 sai về mặt kỹ thuật.**

- 1.2: `(chunk as { text?: string }).text` **đúng** với SDK vì `text` là getter (E3); plan khẳng định ngược lại ("phải gọi method `chunk.text()`"). `thought` dạng string không tồn tại trong SDK (E4). Đây không thể là nguyên nhân "không dùng được".
- 1.1: Thiếu `thinkingConfig` không làm Gemini 3 lỗi — Chat chạy Gemini 3 mặc định cũng không gửi `thinkingConfig` (E6). Bổ sung `thinkingConfig` là cải tiến hợp lý, nhưng không phải root cause.
- 1.3: Claim "khảo sát thực tế DB Supabase" không kèm `[CMD]`/output query. Đồng thời Chat dùng **cùng** rank gate (E7): nếu cùng user dùng được Gemini 3 ở Chat thì 1.3 không giải thích được lỗi chỉ xảy ra ở Novelcrafter.
- **Yêu cầu**: Bổ sung mục "Reproduction Evidence": rank của user báo lỗi, model cụ thể, HTTP status / nội dung toast (client hiển thị `errJson.error.message` — `useNovelcrafterStream.ts:189`) hoặc payload SSE `error`, và output `SELECT rank, allowed_models FROM rank_configs`. Viết lại 1.1/1.2 thành "hardening" thay vì root cause; nếu sau tái hiện lỗi không phải 403 thì phải điều tra tiếp trước khi sửa.

**[MAJOR] M2 — Migration trùng lặp, sai thư mục, thiếu xử lý cache.**

- `database-migrations/20261014000000_add_gemini_4_argon.sql` đã thêm `gemini-4-argon` cho `pro` (E8). Tạo thêm `supabase/migrations/20261015180000_add_gemini4_to_pro_rank.sql` là trùng lặp và lệch quy ước (mọi migration `rank_configs` nằm ở `database-migrations/`).
- **Yêu cầu**: (a) Bỏ migration mới; thay bằng bước xác minh migration 20261014 đã được apply trên production (query verification ở cuối file đó) và apply nếu chưa. (b) Ghi rõ bước invalidate cache `rank_configs:all` (E9 — `invalidateRankConfigsCache()` hoặc chờ 300s). (c) Bước 1.2 ("đảm bảo pro có đủ Gemini 3") phải có SQL idempotent cụ thể hoặc bị xóa; hiện chỉ là câu mô tả.

**[MAJOR] M3 — Thêm `disabled` vào `ModelSelector` dùng chung gây regression cho Chat.**

- Chat cố ý để click vào model bị khóa fire `onSelect` → `handleModelChange` mở upgrade modal (E10). `disabled={!isAllowed}` sẽ chặn hoàn toàn upsell flow của Chat. Vi phạm "Scope: only touch files required".
- **Yêu cầu**: Giữ nguyên hành vi click của `ModelSelector`; đặt guard ở phía Novelcrafter (handler truyền vào `onSelectModel` tại `NovelcrafterStudioApp.tsx:345`) theo đúng pattern Chat: `if (!isModelAllowedById(id, allowedModelIds)) { toast / openUpgradeModal; return; }`. Nếu vẫn muốn thêm icon khóa trong `ModelItem` thì chỉ là hiển thị (không `disabled`; có thể dùng `aria-disabled`), và thêm key i18n vào cả `vi.ts`/`en.ts`. TC-06 phải kèm assertion Chat vẫn mở upgrade modal.

**[MAJOR] M4 — R5 là control "ma": sai file, không có bước triển khai, và bỏ sót hệ quả auto-save 403.**

- `useNovelcrafterStory.ts` không chứa logic `selectedModel`; setter thật ở `useNovelcrafterStateMutators.ts:125-130` (E11). R5 không có trong mục 6 lẫn checklist mục 7.
- Hệ quả nghiêm trọng chưa được phân tích: model bị khóa trong state → PUT `/api/novelcrafter/state` bị 403 → mọi lần auto-save prose đều thất bại (Timeline S4). Cửa sổ loading của `useAllowedModels` (E12) cũng cho phép chọn model bị khóa.
- **Yêu cầu**: Thêm vào mục 6/7: (a) guard trong handler chọn model (xem M3) và không cho chọn khi `allowedModelIds` đang loading; (b) reconcile khi load state/draft và khi `allowedModelIds` resolve: nếu `selectedModel` không allowed → fallback `DEFAULT_MODEL` + `toast.info`; (c) test cho logic reconcile (đặt logic thuần trong `src/lib/features/novelcrafter/` để có co-located test).

**[MAJOR] M5 — Test Contract của Lỗi 2 không kiểm chứng được; vị trí helper vi phạm giới hạn file.**

- Vitest chạy `happy-dom` (E13) và probe xác nhận mọi `offsetTop`/`getBoundingClientRect` = 0 (E14) → TC-04 ("khớp span ±3px") luôn pass/tautological, không bắt được regression công thức.
- `quoteScrollPositioning.test.ts` không có module nguồn `quoteScrollPositioning.ts`; Bước 4.1 lại đặt helper trong `ChapterEditorWorkspace.tsx` vốn đã 456 dòng (E15).
- **Yêu cầu**: (a) Tách module `quoteScrollPositioning.ts` (cạnh test, hoặc trong `src/lib/features/novelcrafter/` nếu thuần) gồm: hàm thuần `computeQuoteScrollTop({ textareaTopInContainer, quoteOffsetTop, containerClientHeight })` (unit test số học, clamp ≥ 0, tỉ lệ 1/3) và `measureCaretOffsetTop(textarea, charOffset)` (unit test: style được copy, mirror bị xóa kể cả khi đo ném lỗi — mock `getComputedStyle`). (b) Độ chính xác pixel thật phải kiểm bằng Playwright (`npm run test:e2e`, đã có `tests/e2e/`) hoặc checklist QA thủ công trên Chromium với chương hội thoại thưa + văn tả đặc, ghi rõ trong mục 9.

**[MINOR] m1 — Mirror thiếu thuộc tính ảnh hưởng ngắt dòng.** Bước 4.1 không liệt kê `letterSpacing` (textarea dùng `tracking-[-0.005em]`, E16), `textIndent`, `tabSize`, `textTransform`, `fontFeatureSettings`/`fontVariant` — mâu thuẫn với R4. `width = clientWidth` + `boxSizing: border-box` chỉ đúng khi border = 0 (hiện đúng, nhưng nên tính content width rõ ràng).

**[MINOR] m2 — Scroll do `setSelectionRange` chưa được xử lý.** `preventScroll` chỉ áp dụng cho `focus()`; trên Chromium, `setSelectionRange` trên phần tử đang focus có thể kéo ancestor scroll tới caret (= `range.end`, tức dưới highlight). Đề xuất: đo + `scrollTo` trong `requestAnimationFrame` sau `setSelectionRange`, và xác minh trong e2e (M5b). (PLAUSIBLE — chưa kiểm được trong môi trường review.)

**[MINOR] m3 — Bảng Verified Versions sai.** `next`/`react` lệch `package.json` (E17); link `@google/genai` trỏ repo cũ `generative-ai-js` (SDK hiện tại là `googleapis/js-genai`); mô tả "`chunk.text` là method" sai (E3).

**[MINOR] m4 — Mapper thinking level.** `GEMINI_SDK_THINKING_LEVEL_MAP` nên bổ sung `minimal: ThinkingLevel.MINIMAL` cho đầy đủ (E5); với mặc định `"low"` hiện không chạm tới nhánh này.

**[MINOR] m5 — TC-03 kiểm shape không có trong SDK.** Bổ sung case `{ thought: true, text: "..." }` (shape thật, E4); giữ case string chỉ như defensive. TC-01 đã tồn tại (E18) — ghi là "giữ nguyên/mở rộng" thay vì "bổ sung".

#### Việc cần làm trước Audit Run 2

1. Thêm Reproduction Evidence cho Lỗi 1 và viết lại 1.1/1.2/1.3 theo bằng chứng (M1).
2. Bỏ migration mới; thay bằng verify/apply `database-migrations/20261014000000_add_gemini_4_argon.sql` + invalidate cache (M2).
3. Không sửa hành vi click của `ModelSelector`; chuyển guard sang handler của Novelcrafter + i18n (M3).
4. Hiện thực R5 đúng file, kèm reconcile và test (M4).
5. Tách module scroll positioning, viết lại TC-04/TC-05 để kiểm chứng được, bổ sung e2e/QA thủ công (M5).

**Kết luận: `[CHANGES_REQUESTED]`**

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-15
- **Đối tượng**: Technical Plan — Revision 2
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 2 `[MAJOR]`, 6 `[MINOR]`

#### Kiểm chứng lỗi cũ (so với Audit Run 1)

| Mã  | Nội dung Run 1                                       | Trạng thái Rev 2       | Ghi chú                                                                                                                                                                                                                                                    |
| :-- | :--------------------------------------------------- | :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Root cause Lỗi 1 chưa tái hiện; 1.1/1.2 sai kỹ thuật | **Khắc phục một phần** | Mục 3.1.0 có dữ liệu `rank_configs` (đã được reviewer xác nhận độc lập — E21). Mục 3 đã sửa đúng getter `text` / `Part.thought?: boolean`. **Nhưng** thiếu rank + triệu chứng thực tế của người báo lỗi, và 1B vẫn được trình bày như root cause (xem N1). |
| M2  | Migration trùng lặp, thiếu invalidate cache          | Đã khắc phục           | Dùng lại `20261014000000_add_gemini_4_argon.sql` (idempotent `NOT @>`), thêm bước invalidate. Cơ chế gọi chưa cụ thể (m3).                                                                                                                                 |
| M3  | `disabled` trên `ModelSelector` phá upsell Chat      | Đã khắc phục           | `ModelSelector.tsx` giữ nguyên; guard đặt trong `NovelcrafterStudioApp.tsx`.                                                                                                                                                                               |
| M4  | R5 control "ma", 403 auto-save trap                  | Đã khắc phục           | Có `reconcileAllowedStoryModel` + guard loading + test. Phát sinh edge case mới khi fetch lỗi (N2).                                                                                                                                                        |
| M5  | Test layout tautological, sai vị trí helper          | Đã khắc phục           | TC-04 thuần toán học, TC-05 kiểm cleanup/style copy (khả thi trong happy-dom), QA Chromium ghi trong mục 9.                                                                                                                                                |
| m1  | Mirror thiếu thuộc tính                              | Đã khắc phục           | Cam kết 22 thuộc tính kèm `letterSpacing`, `tabSize`, `fontFeatureSettings`.                                                                                                                                                                               |
| m2  | Auto-scroll do `setSelectionRange`                   | Đã khắc phục           | Nguyên nhân 2.3 + `requestAnimationFrame`.                                                                                                                                                                                                                 |
| m3  | Bảng Verified Versions sai                           | Đã khắc phục           | Khớp E19.                                                                                                                                                                                                                                                  |
| m4  | Thiếu `minimal` trong map                            | Đã khắc phục           | Bước 4.1.                                                                                                                                                                                                                                                  |
| m5  | TC-03 dùng shape không có trong SDK                  | Đã khắc phục           | TC-03 dùng `{ thought: true, text }`; TC-01 ghi "duy trì/mở rộng".                                                                                                                                                                                         |

#### Bằng chứng đã thu thập (Evidence Log)

| #   | Loại    | Bằng chứng                                                                                                    | Kết quả quan sát                                                                                                                                                                                                                            |
| :-- | :------ | :------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E19 | `[CMD]` | `npm run type-check`; `grep '"version"' node_modules/{next,react}/package.json`                               | exit 0; `next 16.4.0`, `react 19.2.3` — khớp bảng mục 5.                                                                                                                                                                                    |
| E20 | `[CMD]` | Probe Node read-only (`@supabase/supabase-js`, service role): `select rank, allowed_models from rank_configs` | exit 0. `admin`: argon=true, g3-flash-preview=true, g3.1-pro=true. `basic`: cả ba = false. `pro`: argon=**false**, g3-flash-preview=true, g3.1-pro=true. Mọi rank đều có `gemini-2.5-flash`.                                                |
| E21 | —       | Kết luận từ E20                                                                                               | Dữ liệu mục 3.1.0 của plan **chính xác**.                                                                                                                                                                                                   |
| E22 | `[CMD]` | Probe read-only `select rank from profiles where email = <tài khoản chủ repo>`                                | exit 0 → `[{"rank":"admin"}]`.                                                                                                                                                                                                              |
| E23 | `[SRC]` | `src/app/features/chat/components/hooks/useThinkingLevel.ts:171-174`                                          | Mặc định Chat `thinkingLevel = "off"` → `gemini-stream.ts:174` không gửi `thinkingConfig` cho Gemini 3 → Chat chạy Gemini 3 **không có** `thinkingConfig` theo mặc định và vẫn hoạt động.                                                   |
| E24 | `[SRC]` | `novelcrafterStreamRunner.server.ts:302, 359-365`                                                             | Runner truyền `normalizedModel` vào `streamGeminiProvider`, dùng chung `getGenAIClient()` với Chat (`chatStreamCore.ts:91`).                                                                                                                |
| E25 | `[SRC]` | `src/app/features/chat/components/hooks/useAllowedModels.ts:9, 38-46, 56`                                     | Hook trả `{ allowedModelIds, features, loading }` (không có `modelsLoading`). Khi fetch lỗi: `setAllowedModelIds(new Set([DEFAULT_MODEL]))` rồi `setLoading(false)`.                                                                        |
| E26 | `[SRC]` | `useNovelcrafterStateMutators.ts:125-130`                                                                     | `setSelectedModel` commit `{ immediate: true }` → PUT state ngay lập tức.                                                                                                                                                                   |
| E27 | `[SRC]` | `src/lib/core/modelAccess.ts:5-11`                                                                            | Chưa import `DEFAULT_MODEL` (snippet Bước 2.1 dùng làm default param).                                                                                                                                                                      |
| E28 | `[SRC]` | `src/lib/core/limits.ts:437-446`; `src/app/api/admin/rank-configs/route.ts:132`                               | `invalidateRankConfigsCache()` không có CLI; caller duy nhất là admin route khi lưu rank configs.                                                                                                                                           |
| E29 | `[SRC]` | `modelRegistry.ts:63-110`                                                                                     | `supportedThinkingLevels`: 3-flash-preview & 3.1-flash-lite `[minimal, low, medium, high]`; 3.1-pro & 4-argon `[low, medium, high]` → `clamp(…, "low")` luôn trả `"low"` cho Gemini 3.                                                      |
| E30 | `[SRC]` | `ChapterEditorWorkspace.tsx:126-147, 257-258`                                                                 | Code hiện tại khớp mô tả 2.1/2.2; container cuộn là div `overflow-y-auto` không positioned → `textarea.offsetTop` hiện tại cũng không tương đối với container (thêm một nguồn lệch, phương án `getBoundingClientRect` của plan xử lý đúng). |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                      | Kết quả          | Bằng chứng                                                                                                           | Ghi chú                                                                                                                                                                       |
| :---------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**     | PASS             | E19, E27                                                                                                             | Không thêm dependency/env; module `[NEW]` được khai báo đúng. Cần thêm `DEFAULT_MODEL` vào import (m2) — type-check sẽ bắt nếu quên.                                          |
| **S2 Lifecycle & Teardown**   | PASS             | `[SRC] novelcrafterStreamRunner.server.ts:176-177`; mục 6/R1                                                         | Abort runner không đổi; mirror `try/finally`; TC-04 không còn tautological. rAF chưa hủy khi unmount/click liên tiếp (m6).                                                    |
| **S3 Database & Temporal**    | PASS             | E20, E28, `[SRC] database-migrations/20261014000000_add_gemini_4_argon.sql:11-14`                                    | Migration idempotent, đúng thư mục; có bước invalidate cache. Timeline bên dưới.                                                                                              |
| **S4 Cross-Task State Flow**  | **FAIL**         | E25, E26, `[ADV]`                                                                                                    | Reconcile ghi đè model đã lưu khi fetch `allowed-models` lỗi tạm thời (N2).                                                                                                   |
| **S5 Security & 3-Tier Auth** | PASS             | `[SRC] stream/route.ts:47-50, 73-76, 97`; `state/route.ts:105`                                                       | Server fail-closed không đổi; guard client chỉ là UX.                                                                                                                         |
| **S6 External Resilience**    | PASS             | `[SRC] novelcrafterStreamRunner.server.ts:412-422`; `useNovelcrafterStream.ts:186-189, 246-262`; `stream/route.ts:6` | Lỗi provider → SSE `error`/HTTP error → `toast.error`. `LOW` cho Gemini 3 giảm latency.                                                                                       |
| **Domain Inquiry**            | **Ghi chú (N1)** | E20–E24                                                                                                              | Root cause cho người báo lỗi chưa được chứng minh. Bilingual: key mới có ở cả `vi.ts`/`en.ts` — đạt. Reasoning truncation: `maxOutputTokens` 65536 ở mức `LOW` — rủi ro thấp. |

#### Adversarial Timelines

```
Cơ chế: Reconcile model khi /api/user/allowed-models lỗi tạm thời (S4 — trục Thất bại giữa chừng)
T1: User admin mở /novelcrafter, story đã lưu selectedModel = "gemini-4-argon" | T2: fetch allowed-models lỗi mạng/5xx → hook đặt Set([DEFAULT_MODEL]), loading=false (E25) | T3: useEffect reconcile → didFallback=true → setSelectedModel("gemini-2.5-flash") → PUT state immediate (E26) thành công
Kết cục: Lựa chọn model của tác giả bị ghi đè vĩnh viễn trên server do một lỗi mạng thoáng qua; lần mở sau vẫn là gemini-2.5-flash → LỖI (MAJOR)
```

```
Cơ chế: Cache rank_configs sau khi apply migration (S3 — trục Serverless)
T1: Apply migration 20261014 → pro có gemini-4-argon | T2: Redis còn `rank_configs:all` cũ (TTL 300s) | T3: Bước 1.2 xóa key
Kết cục: Nếu Bước 1.2 thực hiện được (m3) → AN TOÀN; nếu bỏ qua → 403 tối đa 300s rồi tự hết → chấp nhận được
```

```
Cơ chế: Chọn model trong cửa sổ loading (S4 — trục TOCTOU)
T1: allowedModelIds = Set rỗng, loading=true | T2: user click gemini-4-argon | T3: handleSelectModel thấy modelsLoading → toast, return
Kết cục: Không commit model trái phép → AN TOÀN
```

```
Cơ chế: Hai lần click thẻ feedback liên tiếp (trục Đồng thời)
T1: click A → focus(preventScroll) + setSelectionRange + rAF(A) | T2: click B trước khi rAF(A) chạy → rAF(B) | T3: rAF(A) chạy (scroll tới A, đo theo selection hiện tại), rAF(B) chạy (scroll tới B)
Kết cục: Vị trí cuối đúng thẻ B, có thể giật một nhịp → AN TOÀN (khuyến nghị m6)
```

Trục Serverless cho Lỗi 2: N/A (logic thuần client).

#### Phân loại lỗi

**[MAJOR] N1 — Root cause Lỗi 1 vẫn chưa được chứng minh cho chính người báo lỗi (tiếp nối M1).**

- E22: tài khoản chủ repo (Product Manager/QA theo `00-core.md`, khả năng cao là người báo lỗi) có rank `admin`, và E20 cho thấy `admin` có **đủ** `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-4-argon`. Với tài khoản này, Nguyên nhân 1A (403 do chọn model bị khóa) **không thể xảy ra**.
- Nguyên nhân 1B vẫn được trình bày là root cause ("đơ stream 20–60+ giây") mà không có `[CMD]`/log. E23 mâu thuẫn trực tiếp: Chat mặc định cũng chạy Gemini 3 **không** có `thinkingConfig` (`thinkingLevel = "off"`) và hoạt động bình thường; cùng client (E24). Gemini 4 Argon đã có `thinkingConfig` (`runner:157-163`) nhưng vẫn được báo lỗi → 1B cũng không giải thích được Argon.
- Hệ quả: nếu người báo lỗi là admin, toàn bộ Bước 1–4 có thể merge xong mà lỗi vẫn còn.
- **Yêu cầu**:
  (a) Ghi rõ trong 3.1.0: rank của người báo lỗi, model cụ thể, triệu chứng quan sát được (HTTP status của `POST /api/novelcrafter/stream` và `PUT /api/novelcrafter/state` trong DevTools Network, nội dung toast — `useNovelcrafterStream.ts:189, 262`, hoặc payload SSE `event: error`), và log server (`streamLogger`).
  (b) Nếu người báo lỗi là `admin` và lỗi không phải 403 → điều tra tiếp (ví dụ: lỗi trả về từ Google API cho model ID cụ thể, thời gian tới byte đầu tiên, event `done` thiếu) trước khi chốt giải pháp; bổ sung root cause thực tế vào mục 3.
  (c) Đổi 1B thành "hardening / cải thiện UX" thay vì root cause, trừ khi có số đo time-to-first-event cho thấy im lặng kéo dài.

**[MAJOR] N2 — `reconcileAllowedStoryModel` ghi đè model đã lưu khi fetch quyền lỗi tạm thời.**

- E25: khi `/api/user/allowed-models` lỗi, hook đặt `allowedModelIds = Set([DEFAULT_MODEL])` và `loading=false` → hàm reconcile ở Bước 2.1 không phân biệt được "đã nạp quyền thật" với "fallback do lỗi" → `didFallback: true` → `setSelectedModel` commit immediate (E26). Timeline S4 ở trên.
- Plan S4/R5/TC-07 chưa bao phủ trường hợp này.
- **Yêu cầu**: Chỉ reconcile khi danh sách quyền được nạp thành công từ server. Ví dụ: mở rộng `useAllowedModels` trả thêm cờ `error`/`isResolved` (thay đổi additive, không phá Chat), hoặc thêm tham số `permissionsResolved` vào `reconcileAllowedStoryModel`. Bổ sung case vào TC-07 / `modelAccess.test.ts`: "fetch lỗi → không fallback".

**[MINOR] m1 — Tên biến hook.** `useAllowedModels` trả `loading`, không có `modelsLoading` (E25); Bước 3.2 cần ghi rõ `const { allowedModelIds, loading: modelsLoading } = useAllowedModels(isAuthed)`.

**[MINOR] m2 — Thiếu import.** Bước 2.1 dùng `DEFAULT_MODEL` làm default param nhưng `modelAccess.ts` chưa import (E27); thêm vào import từ `./modelRegistry`.

**[MINOR] m3 — Bước 1.2 chưa có cơ chế thực thi.** `invalidateRankConfigsCache()` không có CLI; caller duy nhất là `src/app/api/admin/rank-configs/route.ts:132` (E28). Ghi rõ một trong: lưu lại rank config qua admin UI/route, `DEL rank_configs:all` trên Upstash console, hoặc chờ TTL 300s.

**[MINOR] m4 — Fallback cứng `DEFAULT_MODEL`.** Hiện cả 3 rank đều có `gemini-2.5-flash` (E20) nên an toàn; nhưng nếu admin bỏ model này khỏi một rank, reconcile vẫn chuyển về model bị cấm → 403 tiếp. Cân nhắc fallback về model allowed đầu tiên trong `SELECTABLE_MODELS` khi `DEFAULT_MODEL` không allowed.

**[MINOR] m5 — Liệt kê 22 thuộc tính mirror.** Plan chỉ nêu "22 thuộc tính" kèm vài ví dụ; nên liệt kê tường minh trong Bước 5.1 (và tính content width = `clientWidth - paddingLeft - paddingRight` hoặc dùng `boxSizing` nhất quán) để TC-05 có danh sách assert cụ thể.

**[MINOR] m6 — rAF lifecycle.** Lưu id `requestAnimationFrame` vào ref, `cancelAnimationFrame` trước khi đặt rAF mới và trong cleanup unmount; trong callback kiểm tra lại `textareaRef.current`/`scrollContainerRef.current` (R2 hiện chỉ guard trước rAF).

#### Việc cần làm trước Audit Run 3

1. Bổ sung bằng chứng tái hiện cho đúng người báo lỗi (rank, model, HTTP status/toast/SSE error, log server); nếu là `admin`, điều tra và bổ sung root cause thực tế; hạ 1B thành hardening (N1).
2. Chặn reconcile khi fetch quyền thất bại + thêm test tương ứng (N2).
3. (Khuyến nghị) Xử lý m1–m6.

**Kết luận: `[CHANGES_REQUESTED]`**

### Audit Run 3

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-15
- **Đối tượng**: Technical Plan — Revision 3
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 2 `[MAJOR]`, 4 `[MINOR]`

#### Kiểm chứng lỗi cũ (so với Audit Run 2)

| Mã  | Nội dung Run 2                               | Trạng thái Rev 3       | Ghi chú                                                                                                                                                                                                                                                                                               |
| :-- | :------------------------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Root cause chưa chứng minh cho người báo lỗi | **Khắc phục một phần** | Mục 3.1.0 đã ghi rank người báo lỗi (`admin`), story thật và dữ liệu DB — reviewer xác nhận độc lập (E31). 1A được khoanh đúng cho `basic`/`pro`; 1B đã gắn nhãn "Hardening". Root cause mới (model trả văn bản từ chối) đã được nêu, **nhưng** các control đề xuất không xử lý được nó → xem P1, P2. |
| N2  | Reconcile ghi đè model khi fetch quyền lỗi   | Đã khắc phục           | Cờ `isResolved` + tham số `isPermissionsResolved` + TC-07 case 1.                                                                                                                                                                                                                                     |
| m1  | Tên biến hook                                | Đã khắc phục           | Bước 3.2 destructure `loading: modelsLoading, isResolved: modelsResolved`.                                                                                                                                                                                                                            |
| m2  | Thiếu import `DEFAULT_MODEL`                 | Đã khắc phục           | Bước 2.2.                                                                                                                                                                                                                                                                                             |
| m3  | Bước invalidate cache chưa thực thi được     | Đã khắc phục           | Lệnh `npx tsx --env-file=.env.local -e ...` khả thi (E36). Xem ghi chú P6.                                                                                                                                                                                                                            |
| m4  | Fallback cứng `DEFAULT_MODEL`                | Đã khắc phục           | Fallback về model allowed đầu tiên trong `SELECTABLE_MODELS`. Còn edge case nhỏ (P4).                                                                                                                                                                                                                 |
| m5  | Liệt kê thuộc tính mirror                    | Đã khắc phục           | 24 thuộc tính liệt kê tường minh, content width theo `boxSizing`.                                                                                                                                                                                                                                     |
| m6  | rAF lifecycle                                | Đã khắc phục           | `scrollRafRef`, cancel trước khi đặt mới, cancel khi unmount, guard trong callback.                                                                                                                                                                                                                   |

#### Bằng chứng đã thu thập (Evidence Log)

| #   | Loại    | Bằng chứng                                                                                                                                     | Kết quả quan sát                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :-- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E31 | `[CMD]` | Probe `npx tsx` read-only (service role): `rank_configs` + giải mã `story_state` của conversation `c761db5f-…`                                 | exit 0. `basic`: argon/g3-flash/g3.1-pro = false; `pro`: argon=**false**, g3-flash=true, g3.1-pro=true; `admin`: cả ba = true. Story: `selectedModel=deepseek/deepseek-v4.1-flash`, 1 chương, `ch1Len=23266`, `masterGemId` **có đặt**; history cards: `rewrite:deepseek…`, `rewrite:gemini-2.5-pro`, `bible:x-ai/grok-4.3` → dữ liệu mục 3.1.0 **chính xác**; migration 20261014 **chưa** được apply cho `pro` (Bước 1 là cần thiết). |
| E32 | `[SRC]` | `src/lib/features/novelcrafter/feedbackParser.ts:61-73`                                                                                        | Khi `!isStreaming` và không có `<feedback_item>`, parser **tự đẩy 1 item `EDITORIAL`** với `comment = rawText.trim()` và `quote = ""`.                                                                                                                                                                                                                                                                                                 |
| E33 | `[CMD]` | `npx tsx` probe: `parseFeedbackItems("I cannot fulfill this request. …", { isStreaming: false })`                                              | exit 0 → `1 [{"category":"EDITORIAL","quote":"","comment":"I cannot fulfill this request. The provi"}]`. Văn bản từ chối **được hiển thị** thành một thẻ nhận xét, không phải mảng rỗng.                                                                                                                                                                                                                                               |
| E34 | `[SRC]` | `NovelcrafterStudioApp.tsx:90-99` + `src/lib/features/novelcrafter/streamTargetGuard.ts:133-149`                                               | Feature `write` stream **trực tiếp** vào `chapter_prose`; khi có token, `shouldPersistState: true` với mọi `reason` → văn bản từ chối được nối vào bản thảo và lưu `immediate`.                                                                                                                                                                                                                                                        |
| E35 | `[SRC]` | `src/app/api/chat-stream/contextBuilder.ts:141-149`; `.env.local` (`GEMINI_SAFETY_SETTINGS_JSON`, chỉ đọc category/threshold)                  | Chat đã có chính sách safety qua env: 4 category `BLOCK_NONE`. Novelcrafter hiện không dùng.                                                                                                                                                                                                                                                                                                                                           |
| E36 | `[CMD]` | `npx tsx --env-file=.env.local -e "import { invalidateRankConfigsCache } from './src/lib/core/limits'; console.log(typeof …)"` (không gọi hàm) | exit 0, `typeof= function` → lệnh Bước 1.2 khả thi. `limits.ts:437-446`: lỗi `del` bị nuốt (`warn`), không ném.                                                                                                                                                                                                                                                                                                                        |
| E37 | `[SRC]` | `node_modules/@google/genai/dist/genai.d.ts:4776, 4854, 6380-6404, 6430-6432`                                                                  | Có `safetySettings`, `promptFeedback`, `HarmBlockThreshold.OFF`; `HARM_CATEGORY_CIVIC_INTEGRITY` được ghi chú **Deprecated**.                                                                                                                                                                                                                                                                                                          |
| E38 | `[SRC]` | `src/lib/core/modelRegistry.ts:459-463`                                                                                                        | `modelSupportsThinking` chỉ true cho `gemini-3*`/`gemini-4*` → nhánh Gemini 3 ở Bước 4.2 **không** chạm Gemini 2.5 (dùng `thinkingBudget`). An toàn.                                                                                                                                                                                                                                                                                   |
| E39 | `[SRC]` | `useNovelcrafterStory.ts:158-252`; `useStoryPersistenceLifecycle.ts:229-262`                                                                   | Trong lúc tải story mới, `latestStateRef.ownerStoryId` giữ id story **cũ** cho tới khi load xong → reconcile commit vào đúng story đang sở hữu state, không ghi đè chéo.                                                                                                                                                                                                                                                               |
| E40 | `[CMD]` | `npm run type-check`; `npx vitest run modelAccess.test.ts novelcrafterStreamRunner.server.test.ts feedbackParser.test.ts`                      | type-check exit 0; 3 files / 14 tests passed.                                                                                                                                                                                                                                                                                                                                                                                          |
| E41 | `[CMD]` | `wc -l`                                                                                                                                        | `NovelcrafterStudioApp.tsx` 436, `ChapterEditorWorkspace.tsx` 456, `novelcrafterStreamRunner.server.ts` 432.                                                                                                                                                                                                                                                                                                                           |
| E42 | `[CMD]` | `ls probe*`                                                                                                                                    | Script `probe_n1.ts` / `probe_safety.ts` không còn trong repo → output LLM ở 3.1.0 mục 2–3 không tái lập được; reviewer không gọi LLM (ngoài allowlist).                                                                                                                                                                                                                                                                               |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                      | Kết quả       | Bằng chứng                                                                                     | Ghi chú                                                                                                                                                                                                                              |
| :---------------------------- | :------------ | :--------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**     | PASS          | E36, E37, E40                                                                                  | Không thêm dependency/env mới; mọi enum SDK được dùng đều tồn tại; module `[NEW]` khai báo đúng.                                                                                                                                     |
| **S2 Lifecycle & Teardown**   | PASS          | `[SRC] novelcrafterStreamRunner.server.ts:331-430` (abort + `finally close`); mục 4.4/R1/R2/R6 | Lỗi ném ở 4.3b đi qua `catch` hiện có → SSE `error` → `useNovelcrafterStream.ts:246-262` `toast.error`. TC-04/TC-05 không tautological.                                                                                              |
| **S3 Database & Temporal**    | PASS          | E31, E36, `[SRC] database-migrations/20261014000000_add_gemini_4_argon.sql:11-14`              | Migration idempotent, xác nhận chưa apply cho `pro`; invalidate cache khả thi. Timeline bên dưới.                                                                                                                                    |
| **S4 Cross-Task State Flow**  | PASS (kèm P4) | E39, `[SRC] useAllowedModels.ts:20-46`, `useNovelcrafterStateMutators.ts:125-130`              | Reconcile chỉ chạy khi resolved; commit đúng owner. Edge case nhỏ ở P4.                                                                                                                                                              |
| **S5 Security & 3-Tier Auth** | PASS          | `[SRC] stream/route.ts:47-50, 73-76, 97`; `state/route.ts:105`                                 | Server fail-closed không đổi; guard client chỉ là UX.                                                                                                                                                                                |
| **S6 External Resilience**    | **FAIL**      | E33, E34, `[ADV]`                                                                              | Phản hồi từ chối của provider (kết cục thực tế người báo lỗi gặp) không được xử lý: control `safetySettings` chưa chứng minh nhân quả, empty-stream detection không kích hoạt vì có token; văn bản từ chối bị lưu vào bản thảo (P2). |
| **Domain Inquiry**            | Ghi chú       | E32–E35, E38                                                                                   | P1 (root cause "im lặng" sai), P3 (chính sách safety trùng lặp). Reasoning truncation: `LOW` + `maxOutputTokens` 65536 — rủi ro thấp. Bilingual: thiếu key cho toast giải cứu (P5).                                                  |

#### Adversarial Timelines

```
Cơ chế: Gemini 4 Argon từ chối ở feature "write" (S6 — trục Thất bại giữa chừng)
T1: Admin chọn gemini-4-argon, bấm Write | T2: Google trả token "I cannot fulfill this request…" (plan 3.1.0 mục 3: vẫn từ chối dù HarmBlockThreshold.OFF) | T3: emittedTokenCount > 0 → 4.3b không ném; handleStreamTerminated → resolveStreamTerminationState shouldPersistState=true (E34)
Kết cục: Văn bản từ chối bị nối vào chương 23k ký tự và PUT immediate; lỗi người dùng báo vẫn còn sau khi merge → LỖI (MAJOR)
```

```
Cơ chế: Feedback trả văn bản từ chối (Domain — kiểm chứng R8/TC-10)
T1: Feature "feedback" nhận "I cannot fulfill…" | T2: parseFeedbackItems(…, isStreaming:false) → 1 item EDITORIAL (E32, E33) | T3: parsedItems.length === 1 → nhánh toast.error của Bước 3.5 không bao giờ chạy
Kết cục: Control R8 là dead code, TC-10 không thể dựng đúng input → LỖI (MAJOR, test contract sai)
```

```
Cơ chế: Cache rank_configs sau migration (S3 — trục Serverless)
T1: Apply migration 20261014 (pro hiện argon=false, E31) | T2: Redis còn `rank_configs:all` cũ | T3: Bước 1.2 gọi invalidateRankConfigsCache (E36)
Kết cục: Nếu del lỗi, hàm chỉ warn và CLI vẫn in "Cache invalidated" → tối đa 300s 403 rồi tự hết → AN TOÀN (ghi chú P6)
```

```
Cơ chế: allowed-models resolve trong lúc đổi story A→B (S4 — trục TOCTOU)
T1: User chuyển sang story B, loadAndReconcileStoryState đang chạy | T2: allowed-models resolve, effect reconcile chạy trên state A, ownerStoryId vẫn = A (E39) | T3: setSelectedModel commit vào A; khi B load xong effect chạy lại trên B
Kết cục: Không ghi chéo state giữa các story → AN TOÀN
```

Trục Đồng thời cho Lỗi 2: đã phủ ở Run 2 + m6 đã khắc phục → AN TOÀN. Trục Serverless cho Lỗi 2: N/A (logic thuần client).

#### Phân loại lỗi

**[MAJOR] P1 — Khẳng định "Feedback từ chối bị nuốt im lặng" sai; Bước 3.5 / R8 / TC-10 là dead code.**

- 3.1.0 mục 3 ghi `parseFeedbackItems` trả `[]` khi không có thẻ quote. Thực tế parser (nằm ở `src/lib/features/novelcrafter/feedbackParser.ts`, không phải `NovelcrafterStudioApp.tsx:178-194` — đó là nơi gọi) có fallback đẩy nguyên văn bản thành 1 thẻ `EDITORIAL` (E32); probe đã xác nhận (E33). Văn bản từ chối **đã hiển thị** cho tác giả.
- Hệ quả: điều kiện `parsedItems.length === 0 && fullContent.trim()` chỉ xảy ra khi output có `<feedback_item>` nhưng không có `<comment>` — không phải kịch bản từ chối. TC-10 không dựng được input như mô tả.
- **Yêu cầu**: Sửa mục 3.1.0 mục 3 theo E32/E33; bỏ hoặc định nghĩa lại Bước 3.5/R8/TC-10 (ví dụ: nếu muốn phân biệt thẻ từ chối, làm ở `feedbackParser.ts` và test trong `feedbackParser.test.ts`). Bổ sung test cho nhánh fallback hiện có (đang chưa có test).

**[MAJOR] P2 — Kết cục thực tế của người báo lỗi (admin, model từ chối) chưa được xử lý; nhân quả của `HarmBlockThreshold.OFF` chưa chứng minh.**

- Theo chính 3.1.0, lỗi admin gặp là **văn bản từ chối do model sinh ra**. `safetySettings` điều khiển bộ lọc (biểu hiện qua `finishReason: SAFETY` / `promptFeedback.blockReason`), không phải câu trả lời từ chối của model. Bằng chứng duy nhất là `gemini-3.1-pro-preview` thành công ở `feedback` **khi bật OFF**, trong khi lần thất bại là ở `write` **khi chưa bật OFF** — so sánh khác feature, không có nhóm đối chứng. Argon vẫn từ chối khi bật OFF. Story tái hiện còn dùng Master GEM (E31) → system prompt không phải `DEFAULT_NOVELCRAFTER_MASTER_INSTRUCTIONS`, thêm một biến chưa kiểm soát. Script probe không còn trong repo (E42).
- Với `write`, văn bản từ chối bị nối vào bản thảo và lưu ngay (E34); 4.3b không kích hoạt vì có token. Sau khi merge, Argon (và có thể 3.1-pro ở `write`) vẫn "lỗi" như người dùng báo.
- **Yêu cầu** (chọn đường rẻ nhất nhưng phải ghi rõ):
  (a) Bổ sung A/B có đối chứng: cùng story, cùng feature `write`, `gemini-3.1-pro-preview` và `gemini-4-argon`, có/không `safetySettings` (ghi `finishReason`, `blockReason`, 80 ký tự đầu). Nếu OFF không tạo khác biệt → hạ 4.3a thành hardening.
  (b) Ghi rõ cách xử lý văn bản từ chối ở luồng direct-to-prose: hoặc chấp nhận là rủi ro tồn dư (hành vi upstream, tác giả hoàn tác được) và sửa mục Goal "khắc phục triệt để" cho đúng phạm vi; hoặc thêm control cụ thể (ví dụ: khung "fiction context" trong system instruction áp dụng cả khi có Master GEM, có test trong `promptBuilder.test.ts`).
  (c) Thêm vào Test Contract tiêu chí chấp nhận cho đúng tài khoản người báo lỗi.

**[MINOR] P3 — Chính sách safety trùng lặp và lệch so với Chat.** Chat đã đọc `GEMINI_SAFETY_SETTINGS_JSON` (E35, hiện 4 category `BLOCK_NONE`). Nên chuyển parser env này vào `lib/core` và dùng chung (hoặc ghi rõ lý do lệch). Bỏ `HARM_CATEGORY_CIVIC_INTEGRITY` (deprecated, E37).

**[MINOR] P4 — Edge case reconcile.** (i) Nếu không có model nào trong `SELECTABLE_MODELS` được phép, hàm trả fallback bị cấm với `didFallback: true` → thêm 1 PUT 403 + toast; nên trả `didFallback: false`. (ii) Tham số mặc định `isPermissionsResolved = true` là fail-open — nên bắt buộc truyền. (iii) Đặt `setIsResolved(false)` khi bắt đầu fetch. (iv) Effect nên bỏ qua khi `story.isLoadingState`.

**[MINOR] P5 — Kích thước file & song ngữ.** `NovelcrafterStudioApp.tsx` (436, E41) sẽ vượt target 400 sau khi thêm handler + effect; cân nhắc tách `hooks/useNovelcrafterModelGuard.ts`. Bước 3.4 có "toast thông báo giải cứu" nhưng chỉ thêm một key `novelcrafterModelLockedToast` — cần thêm key riêng (vd. `novelcrafterModelFallbackToast`) cho cả `vi.ts`/`en.ts`.

**[MINOR] P6 — Diễn đạt & vận hành.** 1B vẫn khẳng định "thời gian phát token đầu tiên luôn dưới 2 giây" khi chưa có số đo — nên sửa thành mục tiêu. Bước 1.2: `invalidateRankConfigsCache` nuốt lỗi (E36) nên dòng "Cache invalidated" không chứng minh đã xóa — kiểm tra log `warn` hoặc `EXISTS rank_configs:all` trên Upstash.

#### Việc cần làm trước Audit Run 4

1. Sửa root cause "im lặng" của Feedback theo E32/E33 và bỏ/định nghĩa lại Bước 3.5, R8, TC-10 (P1).
2. Bổ sung A/B có đối chứng cho `safetySettings` hoặc hạ thành hardening; ghi rõ cách xử lý (hoặc chấp nhận có phạm vi) văn bản từ chối ở luồng `write`; thêm tiêu chí chấp nhận cho tài khoản người báo lỗi (P2).
3. (Khuyến nghị) Xử lý P3–P6.

- **Verdict (Run 3)**: `CHANGES_REQUESTED`

---

### Audit Run 4

**[REVIEWER_MODEL: gemini-4-argon]**

- **Ngày thẩm định**: 2026-10-15
- **Người thực hiện**: `@reviewer` (Fallback Lead Code & Architecture Reviewer — Independent Verification Run 4)
- **Đối tượng**: Technical Plan — Revision 4
- **Phạm vi**: Thẩm định độc lập Revision 4 đối chiếu trực tiếp với mã nguồn thực tế (`[SRC]`) và lệnh kiểm chứng read-only (`[CMD]`).

#### 1. Kiểm Chứng Lỗi Cũ (Audit Run 3 -> Audit Run 4)

| Mã lỗi | Mức độ cũ | Trạng thái | Bằng chứng xác minh trên mã nguồn & lệnh thực thi (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :----- | :-------- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | `[MAJOR]` | `ĐÃ SỬA`   | - Kiểm chứng tại `[SRC] src/lib/features/novelcrafter/feedbackParser.ts:61-74` và chạy probe `[CMD] npx tsx -e`: khi `!isStreaming` và chuỗi không chứa `<feedback_item>`, `parseFeedbackItems` đẩy 1 phần tử `EDITORIAL` (`quote: ""`, `comment: trimmed.slice(0, 10_000)`).<br>- Plan (Mục 3.1.0 dòng 88, Mục 6.8 dòng 164–165, Bước 6.6 dòng 287) đã ghi nhận đúng hành vi này, loại bỏ nhánh kiểm tra `parsedItems.length === 0` không bao giờ chạy trong `NovelcrafterStudioApp.tsx`, và bổ sung unit test cho nhánh fallback trong `src/lib/features/novelcrafter/feedbackParser.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **P2** | `[MAJOR]` | `ĐÃ SỬA`   | - Mục 3.1.0 (dòng 76–87) đã bổ sung bảng thử nghiệm đối chứng A/B trên cùng story `c761db5f-a6cc-4d33-a5c0-e034ed1defa2` và cùng feature `"write"`, xác định phản hồi của `gemini-3.1-pro-preview` / `gemini-4-argon` là văn bản từ chối cấp mô hình (`blockReason = none`).<br>- Kiểm chứng `[SRC] src/lib/features/novelcrafter/streamTargetGuard.ts:141-149` và `[SRC] src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:200-217`: hiện tại khi stream kết thúc có token, `resolveStreamTerminationState` nối thẳng văn bản từ chối vào `baseContent` và trả về `shouldPersistState: true`.<br>- Bước 4.1 (dòng 249–259) thêm `<studio_context>` vào `buildNovelcrafterSystemInstruction` (`[SRC] src/lib/features/novelcrafter/promptBuilder.ts:92-120`); Bước 5.1–5.4 (dòng 263–279) và `TC-10` (dòng 313) bổ sung `isLikelyModelRefusalOutput` để khôi phục `finalFieldContent = target.baseContent`, đặt `shouldPersistState: false`, `refusalDetected: true`, và hiển thị `toast.error`. |
| **P3** | `[MINOR]` | `ĐÃ SỬA`   | - Kiểm chứng `[SRC] src/app/api/chat-stream/contextBuilder.ts:141-150` và `[CMD] npx tsx -e "import { HarmCategory, HarmBlockThreshold } from '@google/genai'; ..."`: Bước 6.3 (dòng 284) đã đồng bộ 4 danh mục `safetySettings` với ngưỡng `HarmBlockThreshold.BLOCK_NONE` và loại bỏ `HARM_CATEGORY_CIVIC_INTEGRITY` đã deprecated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **P4** | `[MINOR]` | `ĐÃ SỬA`   | - Kiểm chứng `[SRC] src/app/features/chat/components/hooks/useAllowedModels.ts:21-48`, `[SRC] src/lib/core/modelAccess.ts:19-65`, và `[SRC] src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts:83,367`: Bước 2.1 & 2.3 (dòng 203–235) đã đặt `setIsResolved(false)` ở đầu `fetchAllowedModels`, bắt buộc truyền `isPermissionsResolved: boolean` vào `reconcileAllowedStoryModel`, trả `{ model: selectedModel, didFallback: false }` khi `!firstAllowed`, và Bước 3.2 bỏ qua reconcile khi `story.isLoadingState` đang bật.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **P5** | `[MINOR]` | `ĐÃ SỬA`   | - Kiểm chứng `[SRC] src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:1-437` (hiện 437 dòng): Bước 3.1 & 3.2 (dòng 239–246) đã tách hook `[NEW] src/app/features/novelcrafter/hooks/useNovelcrafterModelGuard.ts` và thêm đủ 2 khóa dịch `novelcrafterModelLockedToast`, `novelcrafterModelFallbackToast` vào `src/lib/utils/translations/vi.ts` và `en.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **P6** | `[MINOR]` | `ĐÃ SỬA`   | - Mục 3.1.0 (dòng 94) đã điều chỉnh mô tả `ThinkingLevel.LOW` thành mục tiêu tối ưu hóa độ trễ, và Bước 1.2 (dòng 196–200) kiểm tra trực tiếp `await r.exists('rank_configs:all')` sau khi gọi `invalidateRankConfigsCache()` (`[SRC] src/lib/core/limits.ts:437-446`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

#### 2. Phát Hiện Mới & Các Tấn Công Đã Thử

##### 2.1. Phát Hiện Mới (Phân loại `[MINOR]` — Advisory Recommendations khi triển khai code)

Không phát hiện lỗi `[BLOCKER]` hoặc `[MAJOR]` mới trong Revision 4. Ghi nhận 3 điểm `[MINOR]` cần lưu ý khi viết code ở Pha Thực Thi:

1. **`[MINOR] A-01` — Đặt lại `setIsResolved(false)` trong nhánh `if (!isAuthed)` của `useAllowedModels.ts`**:
   - **Đối chiếu Codebase (`[SRC]`)**: Tại `[SRC] src/app/features/chat/components/hooks/useAllowedModels.ts:12-17`, khi `!isAuthed`, hook đặt `setAllowedModelIds(new Set())`, `setFeatures({})`, `setLoading(false)` và `return` sớm trước khi vào `fetchAllowedModels()`.
   - **Khuyến nghị khi code**: Ở Bước 2.1, bổ sung `setIsResolved(false)` cả bên trong nhánh `if (!isAuthed)` lẫn ở đầu `fetchAllowedModels()`.

2. **`[MINOR] A-02` — Đặt `shouldSavePartialHistory: false` khi `refusalDetected === true` trong `resolveStreamTerminationState`**:
   - **Đối chiếu Codebase (`[SRC]`)**: Tại `[SRC] src/lib/features/novelcrafter/streamTargetGuard.ts:120-150`, kiểu trả về của `resolveStreamTerminationState` gồm `{ finalFieldContent, shouldSavePartialHistory, shouldPersistState }`.
   - **Khuyến nghị khi code**: Ở Bước 5.2, khi `isLikelyModelRefusalOutput(accumulatedStreamText)` trả về `true`, đặt `shouldSavePartialHistory: false` cùng với `shouldPersistState: false, refusalDetected: true, refusalMessage: accumulatedStreamText.trim()`.

3. **`[MINOR] A-03` — Thu hẹp cụm `as an ai\b` trong `REFUSAL_PREFIX_REGEX`**:
   - **Đối chiếu Plan & Codebase**: Ở Bước 5.1 (dòng 266), biểu thức `REFUSAL_PREFIX_REGEX` chứa nhánh `as an ai\b` ở đầu chuỗi (< 600 ký tự). Với truyện khoa học viễn tưởng có câu mở đầu hợp lệ như `"As an AI, ARIA monitored the ship..."`, nhánh `as an ai\b` đơn lẻ có thể khớp nhầm.
   - **Khuyến nghị khi code**: Thu hẹp nhánh này thành `as an ai(?:\s+(?:language model|assistant))?,?\s+i\s+(?:cannot|can't|am unable|do not|don't)` để chỉ khớp với câu từ chối của mô hình.

##### 2.2. Các Tấn Công Đã Thử (Adversarial Probes trên Revision 4)

1. **Tấn công 1 — Kiểm tra thứ tự thực thi giữa `onStreamTerminated` và `onCardCompleted` trong `useNovelcrafterStream.ts` khi mô hình trả về văn bản từ chối ở luồng `write`**:
   - **Giả thuyết tấn công**: Trong `[SRC] src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts:273-302`, khối `finally` gọi `opts.onStreamTerminated?.(...)` ở dòng 273 rồi gọi tiếp `opts.onCardCompleted(...)` (`story.prependHistoryCard`) ở dòng 287 nếu `fullContent.trim().length > 0`. Liệu `prependHistoryCard` (vốn gọi `commitStateChange` với `{ immediate: true }` tại `[SRC] src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts:249-260`) có lưu nhầm văn bản từ chối đã stream trước đó vào `chapter.content` lên DB không?
   - **Kết quả kiểm chứng (`[SRC]`)**: Trong `[SRC] src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:200-216` và `[SRC] src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts:62-74`, `handleStreamTerminated` chạy đồng bộ trước `onCardCompleted` và gọi `story.applyDirectStoryState(applied.nextState, { immediate: false, skipSave: true })` với `resolved.finalFieldContent = target.baseContent`. Hàm `applyDirectStoryState` gán đồng bộ `latestStateRef.current = { ownerStoryId, state: nextState }` (trong đó `chapter.content` đã được khôi phục về `target.baseContent`). Do đó khi `prependHistoryCard` chạy ngay sau đó và đọc `prev = latestStateRef.current.state`, nội dung chương trong `prev` đã là `target.baseContent`, không làm hỏng bản thảo.
2. **Tấn công 2 — Kiểm tra nguy cơ `reconcileAllowedStoryModel` ghi đè `selectedModel` khi `/api/user/allowed-models` gặp lỗi mạng hoặc trong lúc đang chuyển đổi giữa 2 bộ truyện**:
   - **Giả thuyết tấn công**: Khi `/api/user/allowed-models` trả HTTP 500, `useAllowedModels` (`[SRC] src/app/features/chat/components/hooks/useAllowedModels.ts:37-47`) gán `allowedModelIds = new Set([DEFAULT_MODEL])` và `loading = false`. Hoặc khi người dùng đang tải bộ truyện mới (`story.isLoadingState === true` tại `[SRC] src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts:221`), effect reconcile kích hoạt sớm.
   - **Kết quả kiểm chứng (`[SRC]`)**: Với Bước 2.1, khi fetch lỗi thì `isResolved` giữ giá trị `false`; hàm `reconcileAllowedStoryModel` (Bước 2.3, dòng 218) kiểm tra `if (!isPermissionsResolved || modelsLoading || allowedModelIds.size === 0)` và trả về `{ model: selectedModel, didFallback: false }`. Đồng thời ở Bước 3.2 (dòng 245), `useNovelcrafterModelGuard` kiểm tra `!story.isLoadingState` trước khi chạy reconcile.
3. **Tấn công 3 — Kiểm tra xung đột giữa `<studio_context>` và Layered Mode (`<task_instructions>` + `<style_preferences>`) trong `promptBuilder.ts`**:
   - **Giả thuyết tấn công**: Khi tác giả cấu hình cả `masterGemInstructions` và `persona`, việc chèn `<studio_context>` có làm mất `<task_instructions>` hoặc vi phạm các test hiện có trong `src/lib/features/novelcrafter/promptBuilder.test.ts` không?
   - **Kết quả kiểm chứng (`[SRC]` & `[CMD]`)**: Kiểm chứng tại `[SRC] src/lib/features/novelcrafter/promptBuilder.ts:92-120` và chạy `[CMD] npx vitest run src/lib/features/novelcrafter/promptBuilder.test.ts` (15/15 tests passed): các test hiện tại kiểm tra `.toContain("<task_instructions>")` và `.toContain("<style_preferences>")`. Việc ghép `<studio_context>` ở đầu chuỗi trả về của `buildNovelcrafterSystemInstruction` tương thích với toàn bộ 15 test cases hiện có.

---

#### 3. Mental Simulation Verification Matrix

| Kịch bản                                      | Trạng thái | Loại bằng chứng           | Chi tiết kiểm chứng độc lập                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :-------------------------------------------- | :--------- | :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                    | `PASS`     | `[CMD]`, `[SRC]`          | - Chạy `[CMD] npm run type-check` -> Exit code `0`.<br>- Chạy `[CMD] npx vitest run src/lib/core/modelAccess.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts src/lib/features/novelcrafter/promptBuilder.test.ts src/lib/features/novelcrafter/streamTargetGuard.test.ts src/lib/features/novelcrafter/feedbackParser.test.ts` -> Exit code `0` (5 test files, 32 tests passed).<br>- Kiểm chứng `[CMD] npx tsx -e` xác nhận các enum `ThinkingLevel.MINIMAL`, `ThinkingLevel.LOW`, `HarmBlockThreshold.BLOCK_NONE`, `HarmCategory.HARM_CATEGORY_HATE_SPEECH` có sẵn trong `@google/genai` (`2.10.0`). |
| **S2: Runner Lifecycle & Teardown**           | `PASS`     | `[SRC]`                   | - Kiểm chứng `[SRC] src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:176-177,331-430`: kiểm tra `signal?.aborted` và đóng stream trong `finally`.<br>- Kiểm chứng `measureCaretOffsetTop` (Bước 7.1) bọc việc xóa DOM mirror div trong `try ... finally`, và `ChapterEditorWorkspace.tsx` (Bước 7.3) quản lý `scrollRafRef` kèm `cancelAnimationFrame` khi gọi lặp hoặc unmount.                                                                                                                                                                                                                                     |
| **S3: Database & Temporal Logic**             | `PASS`     | `[SRC]`, `[ADV]`          | - Kiểm chứng `[SRC] database-migrations/20261014000000_add_gemini_4_argon.sql:11-14` (idempotent `NOT (allowed_models @> '["gemini-4-argon"]'::jsonb)`) và `[SRC] src/lib/core/limits.ts:94-95,437-446` (`invalidateRankConfigsCache`).<br>- Bước 1.2 kiểm chứng trực tiếp sự tồn tại của key `rank_configs:all` trên Redis sau khi xóa cache.                                                                                                                                                                                                                                                                                       |
| **S4: Cross-Task State Flow**                 | `PASS`     | `[SRC]`, `[ADV]`          | - Kiểm chứng `[SRC] src/app/features/chat/components/hooks/useAllowedModels.ts:1-59`, `[SRC] src/lib/core/modelAccess.ts:1-66`, `[SRC] src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts:83,356-378`.<br>- Thay đổi trên `useAllowedModels` (`isResolved`) là additive, giữ nguyên hành vi mở `openUpgradeModal` của `ModelSelector` trong luồng Chat (`[SRC] src/app/features/chat/components/hooks/useModelSelection.ts:66-72`).                                                                                                                                                                                         |
| **S5: Security Boundary & 3-Tier Auth**       | `PASS`     | `[SRC]`, `[ADV]`          | - Kiểm chứng `[SRC] src/app/api/novelcrafter/stream/route.ts:47-50,73-76,97` và `[SRC] src/app/api/novelcrafter/state/route.ts:105`: server-side route luôn gọi `auth()`, `consumeRateLimit`, và `assertModelAllowedForUser` (fail-closed 403).                                                                                                                                                                                                                                                                                                                                                                                      |
| **S6: External Resilience & Serverless Cap**  | `PASS`     | `[SRC]`, `[CMD]`, `[ADV]` | - Khi stream Gemini kết thúc với `emittedTokenCount === 0` (bị bộ lọc chặn), Bước 6.4 ném lỗi để phát SSE `event: error` về client (`[SRC] src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:412-422`).<br>- Khi mô hình phát văn bản từ chối ở luồng ghi trực tiếp vào bản thảo, Bước 5.1–5.4 khôi phục `target.baseContent`, chặn lưu DB (`shouldPersistState: false`), và hiển thị `toast.error`.                                                                                                                                                                                                                  |
| **Domain: Open Inquiry (Vikini & Sudowrite)** | `PASS`     | `[SRC]`, `[CMD]`, `[URL]` | - Cấu hình `ThinkingLevel.LOW` cho Gemini 3 khớp với `supportedThinkingLevels` trong `[SRC] src/lib/core/modelRegistry.ts:63-96` và tài liệu `@google/genai` (`[URL] https://github.com/googleapis/js-genai`).<br>- Bổ sung đầy đủ khóa dịch song ngữ trong `vi.ts` và `en.ts` cùng co-located tests cho tất cả các module sửa đổi/tạo mới.                                                                                                                                                                                                                                                                                          |

---

#### 4. Claim Verification

1. **Khẳng định của Plan**: "`parseFeedbackItems` (`feedbackParser.ts:61-73`) đã có sẵn nhánh fallback tự động đóng gói toàn bộ nội dung thành 1 thẻ `EDITORIAL` khi không có thẻ XML `<feedback_item>` và `!isStreaming`." (Mục 3.1.0 dòng 88).
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/lib/features/novelcrafter/feedbackParser.ts:61-74` và chạy `[CMD] npx tsx -e` (`feedback fallback: 1 EDITORIAL true I cannot fulfill this request.`).
2. **Khẳng định của Plan**: "`buildNovelcrafterSystemInstruction` hiện tại không gắn `<studio_context>` khi người dùng truyền `masterGemInstructions`." (Mục 1 dòng 37 & Bước 4.1 dòng 249).
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/lib/features/novelcrafter/promptBuilder.ts:92-105` và chạy `[CMD] npx tsx -e` (`current sysInstruction with masterGem has studio_context: false`).
3. **Khẳng định của Plan**: "`resolveStreamTerminationState` hiện tại nối thẳng văn bản từ chối vào `baseContent` và trả về `shouldPersistState: true`." (Mục 3.1.0 dòng 87).
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/lib/features/novelcrafter/streamTargetGuard.ts:141-149` và chạy `[CMD] npx tsx -e` (`finalFieldContent: 'Chapter 1 base\n\nI cannot fulfill this request.', shouldPersistState: true`).
4. **Khẳng định của Plan**: "`useNovelcrafterStory` cung cấp cờ `story.isLoadingState` để tránh chạy reconcile khi đang tải trạng thái truyện." (Mục 4.1 dòng 115 & Bước 3.2 dòng 245).
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts:83,221,251,367`.

---

#### 5. Adversarial Timelines

##### Timeline 1 (S3 / S4 — Reconcile Model khi lỗi mạng và khi đổi bộ truyện)

```
Cơ chế: Đồng bộ quyền model và tự động điều chỉnh selectedModel qua useNovelcrafterModelGuard
- Trục 1 (Đồng thời):
  T1: Người dùng mở /novelcrafter; useAllowedModels bắt đầu fetch /api/user/allowed-models (loading = true, isResolved = false) đồng thời useNovelcrafterStory tải trạng thái truyện (isLoadingState = true).
  T2: Người dùng bấm chọn một model trên NovelcrafterTopBar khi đang loading.
  T3: handleSelectModel trong useNovelcrafterModelGuard thấy modelsLoading === true -> hiển thị toast và return sớm, không gọi setSelectedModel.
- Trục 2 (TOCTOU):
  T1: Người dùng chuyển từ Story A sang Story B; useNovelcrafterStory đặt isLoadingState = true.
  T2: Cùng lúc đó, useAllowedModels vừa resolve xong.
  T3: useEffect trong useNovelcrafterModelGuard kiểm tra !story.isLoadingState nên chờ tới khi Story B tải xong mới chạy reconcile trên state của Story B.
- Trục 3 (Thất bại giữa chừng & dọn dẹp):
  T1: Request GET /api/user/allowed-models gặp lỗi mạng 500; useAllowedModels rơi vào khối catch, đặt allowedModelIds = Set([DEFAULT_MODEL]) và loading = false, nhưng isResolved vẫn bằng false.
  T2: reconcileAllowedStoryModel kiểm tra !isPermissionsResolved -> trả về { model: selectedModel, didFallback: false }.
  T3: Lựa chọn model hợp lệ đã lưu trong truyện của tác giả được giữ nguyên, không bị ghi đè lên server.
- Trục 4 (Môi trường serverless):
  T1: Migration 20261014000000_add_gemini_4_argon.sql được áp dụng trên Supabase.
  T2: Bước 1.2 gọi invalidateRankConfigsCache() và kiểm tra r.exists('rank_configs:all') === 0 trên Upstash Redis.
  T3: Mọi serverless instance đọc lại rank_configs mới từ DB ngay ở request kế tiếp.
Kết cục: Không xảy ra 403 auto-save trap và không ghi đè nhầm model khi lỗi mạng → AN TOÀN.
```

##### Timeline 2 (S5 / S6 — Bảo vệ bản thảo khi mô hình từ chối hoặc bị chặn ở luồng Direct Stream)

```
Cơ chế: Stream văn bản vào bản thảo chương (POST /api/novelcrafter/stream -> streamTargetGuard)
- Trục 1 (Đồng thời):
  T1: Đang stream trực tiếp vào chương (isDirectStreamingToChapter = true), người dùng bấm nút tính năng khác hoặc bấm Stop.
  T2: useNovelcrafterStream gọi stopStream() -> controller.abort() hủy kết nối trước khi mở stream mới.
- Trục 2 (TOCTOU / Bypass Auth & Rank Gating):
  T1: Người dùng rank Basic gửi POST /api/novelcrafter/stream với model = "gemini-4-argon" qua DevTools.
  T2: Route gọi await assertModelAllowedForUser(userId, requestData.model) (src/app/api/novelcrafter/stream/route.ts:97).
  T3: Server trả về HTTP 403 Forbidden trước khi khởi tạo runNovelcrafterStream và trước khi tăng bộ đếm quota ngày.
- Trục 3 (Thất bại giữa chừng & từ chối cấp mô hình):
  T1: Tác giả chạy feature "write" với gemini-3.1-pro-preview hoặc gemini-4-argon trên chương có tình tiết nhạy cảm; mô hình trả về chuỗi "I cannot fulfill this request...".
  T2: Khi stream kết thúc, handleStreamTerminated gọi resolveStreamTerminationState; isLikelyModelRefusalOutput phát hiện mẫu từ chối -> trả về finalFieldContent = target.baseContent, shouldPersistState = false, refusalDetected = true.
  T3: NovelcrafterStudioApp khôi phục nội dung chương về target.baseContent (skipSave: true) và hiển thị toast.error(resolved.refusalMessage).
- Trục 4 (Môi trường serverless):
  T1: Google API chặn toàn bộ phản hồi (emittedTokenCount === 0, finishReason = SAFETY).
  T2: streamGeminiProvider (Bước 6.4) ném Error -> khối catch của runNovelcrafterStream phát sự kiện SSE event: error trước khi đóng stream.
Kết cục: Bản thảo chương của tác giả được giữ nguyên vẹn và người dùng nhận thông báo lỗi rõ ràng → AN TOÀN.
```

---

#### 6. Commands Executed

1. `npm run type-check` -> Exit code: `0` (`tsc --noEmit` chạy sạch không có lỗi).
2. `npx vitest run src/lib/core/modelAccess.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts src/lib/features/novelcrafter/promptBuilder.test.ts src/lib/features/novelcrafter/streamTargetGuard.test.ts src/lib/features/novelcrafter/feedbackParser.test.ts` -> Exit code: `0` (5 test files passed, 32 tests passed).
3. `npx tsx -e "import { HarmCategory, HarmBlockThreshold, ThinkingLevel } from '@google/genai'; import { parseFeedbackItems } from './src/lib/features/novelcrafter/feedbackParser'; import { buildNovelcrafterSystemInstruction } from './src/lib/features/novelcrafter/promptBuilder'; import { resolveStreamTerminationState } from './src/lib/features/novelcrafter/streamTargetGuard'; console.log('SDK enums:', { MINIMAL: ThinkingLevel.MINIMAL, LOW: ThinkingLevel.LOW, BLOCK_NONE: HarmBlockThreshold.BLOCK_NONE, HATE: HarmCategory.HARM_CATEGORY_HATE_SPEECH }); const fb = parseFeedbackItems('I cannot fulfill this request.', { isStreaming: false, nowMs: 1000 }); console.log('feedback fallback:', fb.length, fb[0]?.category, fb[0]?.quote === '', fb[0]?.comment); console.log('current sysInstruction with masterGem has studio_context:', buildNovelcrafterSystemInstruction({ masterGemInstructions: 'Custom GEM' }).includes('<studio_context>')); console.log('current termination on refusal:', resolveStreamTerminationState({ reason: 'completed', baseContent: 'Chapter 1 base', accumulatedStreamText: 'I cannot fulfill this request.', isAppendMode: true }));"` -> Exit code: `0` (xác nhận enum SDK `@google/genai`, hành vi fallback `EDITORIAL` của `parseFeedbackItems`, và hành vi hiện tại của `promptBuilder` cùng `streamTargetGuard`).

---

#### 7. Kết Luận

Revision 4 của bản kế hoạch đã giải quyết toàn bộ các phát hiện từ `Audit Run 3` (`P1`..`P6`). Trong quá trình viết code ở Pha Thực Thi, lưu ý áp dụng 3 khuyến nghị `[MINOR]` (`A-01`, `A-02`, `A-03`) tại Mục 2.1.

[PLAN_APPROVED]
