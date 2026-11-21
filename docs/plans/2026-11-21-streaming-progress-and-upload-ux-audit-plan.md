# Kế Hoạch Triển Khai: Chat Streaming Progress, Tool Activity & Upload UX/Animation Overhaul

- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-21
- **Revision**: 2
- **Status**: Completed

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục Tiêu (Goal)

Giải quyết triệt để 2 nhóm lỗi UX/UI và trạng thái thực thi do người dùng báo cáo khi sử dụng Claude 4.5 Sonnet (Code Execution) và khi tải lên tệp/ảnh trên toàn ứng dụng Vikini:

1. **Workstream 1 — Chat Streaming Progress, Tool Activity & Loading UX Overhaul**:
   - Sửa lỗi phía server trong `src/app/api/chat-stream/streaming/anthropic-stream.ts`: theo dõi đúng khối `server_tool_use` để chấm dứt rò rỉ `currentToolInput`; sửa kiểm tra loại khối kết quả từ `code_execution_result` sang đúng schema SDK `code_execution_tool_result` (và biến thể `bash_code_execution_tool_result`); phát sự kiện `event: meta` tiến độ có tiết lưu (`writing` kèm `chars` -> `running` -> `done`, `webSearchStatus`, `webFetchStatus`); và bổ sung ngưỡng timeout riêng cho Claude (5 phút / 10 phút deep thinking) thay vì rơi vào `DEFAULT = 180s` / `idleTimeout = 90s`.
   - Xây dựng máy trạng thái `StreamActivity` có kiểu chặt chẽ ở phía client (`src/lib/features/chat/streamActivity.ts`), tiêu thụ đầy đủ các `event: meta` (`codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`, `localQueue`, `localPromptProgress`), xử lý đúng **interleaved thinking** sau khi đã xuất văn bản, và tự động nâng trạng thái sang `"stillWorking"` kèm bộ đếm thời gian `tabular-nums` khi luồng im lặng `>= 8s`.
   - Loại bỏ hoàn toàn dấu nháy dọc màu cam rơi xuống dòng trống bên dưới đoạn văn (`<TypingCursor />` đặt sau `<ReactMarkdown>`), thay bằng chỉ báo cuối dòng inline thuần CSS + thanh trạng thái `StreamingActivityBar` (chuẩn Emil Design Engineering, chạy shimmer bằng GPU `translate3d`, tôn trọng `prefers-reduced-motion`, cô lập bộ đếm 1 giây bằng `React.memo` để tránh re-render tầng trên).
   - Nâng cấp `composer-stream-line` trên `InputForm` từ thanh tĩnh 52% `animate-pulse` sang đường hairline cắt ngang toàn khung với hiệu ứng shimmer GPU mượt mà.

2. **Workstream 2 — Comprehensive File & Image Upload UI + Animation Overhaul (5 Surfaces)**:
   - **Surface A (Chat Composer)**: Xóa hoàn toàn hiện tượng nhân đôi thẻ + bóng ma 800ms + nhảy vị trí (sort-order teleport) + nhấp nháy thumbnail ảnh khi tải lên hoàn tất bằng cơ chế **giữ nguyên `key` theo `tempId` (`renderKeyByFileId`) + chuyển giao cục bộ `objectURL` (`localPreviewByFileId`) + cập nhật đồng bộ trong 1 frame + sắp xếp tăng dần theo `created_at`**. Bổ sung tiến độ nhiều giai đoạn (`queued -> uploading -> processing -> ready / error`), hủy từng tệp riêng lẻ, gỡ lỗi tức thì, sửa lỗi overlay kéo-thả 0px khi trống, sửa lỗi nút gửi `isReady`, sửa lỗi spinner xóa kẹt vĩnh viễn, sửa điều hướng `FileLightbox`, và hiển thị thumbnail ảnh trong `FileInMessage`.
   - **Surface B (Conversation Files Popover)**: Di chuyển `FileManagerPanel` sang Radix `<Popover>` portaled (`@/components/ui/popover`), loại bỏ toàn bộ chuỗi ngày tiếng Anh cứng và token CSS cũ (`var(--...)`), thêm thumbnail ảnh + mở `FileLightbox` + hiển thị hàng đợi đang tải.
   - **Surface C (Project Knowledge Base)**: Bổ sung kéo-thả thực thụ (`dragDepthRef`) + chọn nhiều tệp (`multiple`), tải lên qua XHR có tiến độ giai đoạn (`uploading %` -> `processing` lập chỉ mục), hàng lạc quan + Framer Motion `AnimatePresence`, thanh dung lượng GPU `scaleX`, và song ngữ hóa toàn bộ thông báo lỗi.
   - **Surface D (Image Studio Reference Images)**: Thay `FileReader` (dính race condition + lỗi im lặng) bằng `URL.createObjectURL` có `WeakMap` stable key + thu hồi bộ nhớ chặt chẽ, nút xóa dễ bấm trên cảm ứng, hỗ trợ kéo-thả + kiểm tra loại/dung lượng kèm `toast.error` + `AnimatePresence`.
   - **Surface E (Describe Image View & Template Modal)**: Reset `e.target.value`, bộ đếm `dragDepthRef`, xử lý `reader.onerror`/`img.onerror` chống treo `analyzing = true`, dọn dẹp `setTimeout` khi unmount, kiểm tra ảnh + hỗ trợ kéo-thả trên `TemplateModal`.

#### Out of Scope (What We're NOT Doing)

- **KHÔNG sửa** bất kỳ tệp nhạy cảm phía server/database nào: không chạm `*.server.ts` (bao gồm `src/lib/features/files/fileService.server.ts`, `knowledge.server.ts`, `reasoningStreamHelper.server.ts`), không sửa migration SQL hay schema PostgreSQL, không thay đổi thứ tự sắp xếp trả về của `GET /api/files` (composer tự sắp xếp tăng dần ở client qua `sortComposerFiles`).
- **KHÔNG sửa** `.agents/**` (kể cả `.agents/skills/streaming-patterns/SKILL.md`, vì `.agents/skills/streaming-patterns/SKILL.md:33` đã ủy quyền định nghĩa chi tiết `event: meta` cho `docs/contracts.md` mục 2 — ta cập nhật `docs/contracts.md` làm nguồn chân lý duy nhất và không tạo thêm top-level SSE event name mới ngoài `token`/`thinking`/`meta`/`done`/`error`).
- **KHÔNG thêm** thư viện npm bên ngoài; dùng 100% primitive có sẵn (Framer Motion 12, Radix UI Popover/Dialog, Lucide React, Tailwind CSS v4, Zustand v5, SWR v2).
- **KHÔNG tái cấu trúc** các màn hình không liên quan (Novelcrafter Studio, Admin Dashboard, Gallery, Deep Research, Gems/Personas).
- **KHÔNG thay đổi** `src/app/api/chat-stream/streaming/openai-stream.ts` hoặc `deepseek-stream.ts` (các luồng OpenRouter web search chạy ngầm phía provider sẽ tự hưởng lợi từ bộ phát hiện quiet-stream 8 giây ở phía client mà không tăng blast radius phía server).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Tài liệu đã đọc trực tiếp trong phiên

- Governance & Standards: `.agents/agents/planner/agent.md`, `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md`, `.agents/rules/05-plan-review.md`, `.agents/agents/reviewer/evidence-bar.md`.
- Contracts & Lessons: `docs/contracts.md:309-388`, `docs/lessons-learned.md:188-193,366-371,781-786,869-884`.
- Guard & CI Tests: `scripts/verify-plan.mjs:16-384`, `.agents/scripts/plan-scope.js:1-276`, `src/lib/config/theme-config.test.ts:437-538`.

#### Bảng Ánh Xạ `Skills Loaded & Applied`

| Skill (`SKILL.md` đã đọc bằng `read_file`)   | Quyết định kỹ thuật chịu ảnh hưởng trực tiếp trong kế hoạch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/skills/streaming-patterns/SKILL.md` | Giữ nguyên giao thức SSE `event: <event>\ndata: <JSON>\n\n` qua `sendEvent()` (`src/app/api/chat-stream/streaming/utils.ts:81-91`), chỉ mở rộng các payload `event: meta` (`codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`) và đồng bộ đặc tả tại `docs/contracts.md` §2 (theo `.agents/skills/streaming-patterns/SKILL.md:33`). Giữ nguyên typewriter buffer tách biệt mạng/UI và giới hạn timeout theo model (`CLAUDE`: 5 phút / 10 phút deep thinking).                                                                                    |
| `.agents/skills/emil-design-eng/SKILL.md`    | Không dùng `scale(0)` (dùng `scale: 0.94 -> 1` + `opacity`), không dùng `transition-all` (chỉ định chính xác thuộc tính chuyển tiếp), không dùng `ease-in`, mọi chuyển tiếp phản hồi UI `< 250ms` sử dụng `TRANSITION` từ `src/lib/utils/motion.ts`, phản hồi nhấn nút `active:scale-[0.97]`, thanh shimmer & progress bar dùng thuần GPU (`transform: translate3d(...)` / `scaleX(...)`) chạy ngoài main thread, hỗ trợ đầy đủ `prefers-reduced-motion`, popover dùng `origin-(--radix-popover-content-transform-origin)`, và stagger 40ms cho danh sách tải nhiều tệp. |
| `.agents/skills/add-translation/SKILL.md`    | Mọi nhãn mới (25 khóa) được thêm đồng bộ cả hai tệp `src/lib/utils/translations/vi.ts` (tiếng Việt tự nhiên, không chèn tiếng Anh trong ngoặc đơn theo `docs/lessons-learned.md:81-88`) và `src/lib/utils/translations/en.ts`, chỉ đọc qua `useLanguage()` + `t("key")`, cấm tuyệt đối inline ternary hoặc prop drilling `t: Record<string, string>`.                                                                                                                                                                                                                    |
| `.agents/skills/api-patterns/SKILL.md`       | Đối chiếu quy chuẩn phản hồi `{ success: true, data }` và `{ success: false, error: { message, code } }` cho `/api/files` (`src/app/api/files/route.ts:54-59`) và `/api/projects/[id]/knowledge` (`src/app/api/projects/[id]/knowledge/route.ts:151,195-200`) khi xây dựng parser XHR (`sendKnowledgeUploadXhr`, `extractUploadErrorMessage`) để không bao giờ hiển thị `[object Object]`.                                                                                                                                                                               |

---

### 3. Assumptions & Cross-Task Dependencies

#### Verified Assumptions (kèm bằng chứng `[SRC]`)

1. **Anthropic Beta SDK Block Schema (`[SRC]`)**: Trong `@anthropic-ai/sdk` v0.71.2, khối kết quả chạy mã có tên `type: 'code_execution_tool_result'` bọc `content: BetaCodeExecutionResultBlock | BetaCodeExecutionToolResultError` (`node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:328-334,382-406`). Hiện `src/app/api/chat-stream/streaming/anthropic-stream.ts:466` kiểm tra sai thành `block.type === "code_execution_result"` nên không bao giờ khớp. Ngoài ra `src/app/api/chat-stream/streaming/anthropic-stream.ts:320,328-334` chỉ gán `currentToolName` cho `tool_use` mà không gán cho `server_tool_use`, khiến `currentToolInput` bị nối dồn vô hạn mọi `input_json_delta` của `server_tool_use`.
2. **Anthropic Timeout Gap (`[SRC]`)**: `getStreamTimeout` (`src/app/api/chat-stream/streaming/utils.ts:32-46`) không có nhánh cho model `"claude"`, khiến Claude 4.5 Sonnet rơi vào `TIMEOUT_CONFIG.DEFAULT = 180000` (`src/app/api/chat-stream/streaming/types.ts:93`) với `idleTimeoutMs = 90_000` (`src/app/api/chat-stream/streaming/anthropic-stream.ts:275`), dễ ngắt luồng khi container chạy mã lâu. Đồng thời `src/app/api/chat-stream/streaming/anthropic-stream.ts:531` gọi `getStreamTimeout()` không truyền tham số khi ghi log lỗi timeout.
3. **Client SSE Drops Tool Activity, Type Narrowing & Interleaved Thinking (`[SRC]`)**:
   - `src/lib/features/chat/streamProtocol.ts:20,51` đã khai báo `ParsedSSEEvent["data"]["status"]?: number` và gán thẳng sang `StreamError.status?: number` tại `src/app/features/chat/components/hooks/useChatStreamReader.ts:179`; do đó phải mở rộng thành `status?: number | string` kèm type narrowing (`typeof data?.status === "number"` ở nhánh `error`, `typeof data.status === "string"` ở `streamActivity.ts`).
   - `src/app/features/chat/components/hooks/useChatStreamReader.ts:47-111` bỏ qua `codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`. Đồng thời `src/app/features/chat/components/hooks/useChatStreamReader.ts:139,150-156` chỉ gọi `markAnswer()` bên trong `if (isFirstToken)`, nên với interleaved thinking sau khi đã xuất token chữ, `markThinking()` (`src/app/features/chat/components/hooks/useThinkingStats.ts:23-82`) bật lại `live = true` + `setInterval(1000)` nhưng không tắt được ở token hậu-tool nếu không tách cờ `isThinkingActive` khỏi `isFirstToken`.
   - `src/app/features/chat/components/ChatBubble.tsx:188,221-227,307-311` chỉ đánh dấu `isThinking` khi `!extracted.rest.trim()` và render `<TypingDots />` trực tiếp khi `!hasContent`, nên cần loại trừ lẫn nhau chặt chẽ với `<StreamingActivityBar />` (tối đa 1 `role="status"`).
4. **Orphan Cursor, TypingCursor Export Preservation & Static Composer Line (`[SRC]`)**: `src/app/features/chat/components/BubbleMarkdown.tsx:221` render `<TypingCursor />` làm phần tử con kế tiếp sau `<ReactMarkdown>` (rơi sang dòng trống dưới đoạn `<p>`). Tuy nhiên `src/app/features/chat/components/BubbleHelpers.test.tsx:25-43` kiểm thử trực tiếp export `TypingCursor` tại `src/app/features/chat/components/BubbleHelpers.tsx:36-51`, nên chỉ gỡ bỏ lời gọi khỏi `BubbleMarkdown.tsx` và **giữ nguyên** export `TypingCursor` trong `BubbleHelpers.tsx`. `src/app/features/chat/components/InputForm.tsx:318-324` render thanh cố định `w-[52%] animate-pulse`, và `src/app/features/chat/components/InputForm.test.tsx:423-438` kiểm tra `data-testid="composer-stream-line"` phải có `aria-hidden="true"`, `bg-(--accent)` và `motion-reduce:animate-none`.
5. **Composer Upload Duplicate + Ghost + Sort Teleport + New Chat SWR Race (`[SRC]`)**: `src/lib/features/files/useFileUpload.ts:199-205` gọi `onUploadComplete(uploadedFile)` ngay rồi đợi `800ms` mới xóa `tempId` khỏi `uploadQueue`. `src/app/features/chat/components/FilePreviewArea.tsx:93-106` render `files` (`key={file.id}`) tách biệt với `uploadQueue` (`key={upload.tempId}`), tạo 2 thẻ song song. `src/lib/features/files/fileService.server.ts:316` trả danh sách giảm dần (`ascending: false`), còn `src/app/features/chat/components/InputForm.tsx:130` nối cuối mảng lạc quan khiến thẻ nhảy từ phải sang trái khi SWR revalidate. Ngoài ra `node_modules/swr/dist/_internal/config-context-12s-Dh3trQsc.mjs:259` bỏ qua bound `mutate` khi key SWR vẫn đang `null` (New Chat `null -> conv-new` xong XHR quá nhanh trước khi prop cập nhật), nên cần fallback sang global SWR `mutate("/api/files?conversationId=" + fileConvId, ...)` dựa trên `src/lib/features/files/useFiles.ts:37-38`.
6. **FilePreviewCard / Area / InputForm / Lightbox / Popover Defects (`[SRC]`)**:
   - `src/lib/features/files/useFileUpload.ts:42` chỉ xét `status === "uploading"` cho `isUploading` (bỏ sót `queued`/`processing`), và `src/lib/features/files/useFileUpload.ts:100-115,223-226` dùng `break` khi bị abort khiến hủy 1 tệp làm bỏ rơi các tệp `queued` còn lại (cần phân biệt hủy từng tệp `continue` với hủy phiên `isStale()` `break`, kèm `cancelledTempIdsRef` và per-tempId retry sleep).
   - `src/app/features/chat/components/InputForm.tsx:287` có lỗi logic `(!disabled || isUploading)` bật nhầm nút Send khi đang upload; `src/app/features/chat/components/InputForm.tsx:239-244,257` (`handleSubmit`) thiếu điều kiện `|| isUploading` nên phím `Enter` desktop vượt qua nút Send bị disable; `src/app/features/chat/components/InputForm.tsx:334,372,412` khóa thừa nút xóa tệp và nút `+`; `src/app/features/chat/components/InputForm.tsx:362` vẫn còn cú pháp Tailwind v3 `scrollbar-thumb-[var(--line)]`; `src/app/features/chat/components/InputForm.tsx:474` thiếu `onNavigate={setLightboxFile}`, trong khi `src/app/features/chat/components/FileLightbox.tsx:55-56,232,244` vẫn render mũi tên Prev/Next dù thiếu `onNavigate`.
   - `src/app/features/chat/components/FilePreviewArea.tsx:47` early return phá hủy `exit` animation và khiến overlay kéo-thả có chiều cao 0px khi `!hasContent && isDragging`; `src/app/features/chat/components/FilePreviewArea.tsx:56` tạo `setTimeout` không cleanup; `src/app/features/chat/components/FilePreviewArea.tsx:90` dùng `scrollbar-thumb-[var(--line)]`.
   - `node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:15,72,99` yêu cầu con trực tiếp dưới `<AnimatePresence mode="popLayout">` phải chuyển tiếp `ref` bằng `React.forwardRef`, hiện cả `src/app/features/chat/components/FilePreviewCard.tsx:40` và `src/app/features/chat/components/FileManagerPanel.tsx:167` đều chưa có `React.forwardRef`.
   - `src/app/features/chat/components/FilePreviewCard.tsx:156-160` gọi `setDeleting(true)` không có `finally`, kẹt spinner nếu `DELETE` thất bại.
   - `src/app/features/chat/components/FileManagerPanel.tsx:26-40,113-128` dùng `position: absolute` không portal (vi phạm `docs/lessons-learned.md:781-786`), hardcode ngày tiếng Anh và dùng token legacy `var(--...)`. Khi chuyển sang Radix `<PopoverContent>` (`src/components/ui/popover.tsx:16-27`), mở `<FileLightbox />` (Radix `<Dialog>` tại `src/app/features/chat/components/FileLightbox.tsx:149-155`) từ bên trong `<PopoverContent>` sẽ làm Popover đóng theo `onFocusOutside` và unmount ngay Dialog; do đó `<FileLightbox />` bắt buộc đặt làm phần tử anh em **NGOÀI** `<Popover>` tại `src/app/features/chat/components/ComposerLeadingControls.tsx:51-74`. `src/app/features/chat/components/ComposerChip.tsx:17-40` đã dùng `React.forwardRef`, sẵn sàng cho Radix `<PopoverTrigger asChild>`.
7. **Project Knowledge, Image Studio, Describe & Template Defects (`[SRC]`)**:
   - `src/components/features/projects/KnowledgePanel.tsx:34,66-102,152-196,217-247` chỉ khai báo `onUpload: (file: File, payload: FormData | string)` 2 tham số, thiếu drag-and-drop, thiếu `multiple`, dùng `style={{ width }}`, thiếu `AbortController` khi unmount, nhánh skeleton `isLoading && safeDocuments.length === 0` (khi tệp #1 xong gọi `fetchDocuments()` tại `src/app/projects/[id]/page.tsx:55` hoặc `src/components/features/projects/ProjectSettingsModal.tsx:70`) sẽ ghi đè xóa mất hàng lạc quan của tệp #2 đang upload, và có chuỗi tiếng Việt/Anh cứng; tương tự tại `src/app/projects/[id]/page.tsx:80,101,109,117,203` và `src/components/features/projects/ProjectSettingsModal.tsx:77,98,119,127,131,135,148`.
   - `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:28-46,93,104` dùng `FileReader` dính race condition, `key={idx}`, và nút xóa `opacity-0` không bấm được trên mobile.
   - `src/app/features/image-gen/components/DescribeImageView.tsx:98-102,117-125,152-165,182,229-256` thiếu `e.target.value = ""`, thiếu `dragDepthRef`, thiếu `reader.onerror`/`img.onerror` (gây treo `analyzing = true`), và không dọn `setTimeout`.
   - `src/app/features/image-gen/components/TemplateModal.tsx:36-43` bỏ qua im lặng tệp không phải ảnh, không kiểm tra dung lượng 10MB, và thiếu kéo-thả.
8. **CI Static Guards & File Line Ceilings (`[SRC]`)**: `src/lib/config/theme-config.test.ts:437-538` khóa cứng: `TC-13` (mọi hook `use*.ts(x)` trong `src/app/` `<= 350` dòng sau Prettier, 0 `transition-all`, 0 dead hover, 0 `import * as ... from "lucide-react"`, 0 `t: Record<string, string>`), và `TC-14` (0 lời gọi `use*Store()` không selector). `.agents/rules/01-coding.md:101-106` áp trần Hard Max `350L` cho hooks (kể cả `src/lib/features/files/useFileUpload.ts`, hiện 329L), `400L` cho `src/lib/`, và `500L` cho UI components (`src/app/features/chat/components/ChatBubble.tsx` hiện 498L). `docs/lessons-learned.md:188-193` cấm lưu `Set`/`Map` trong Zustand state.

#### Cross-Task Dependencies

- **Nội bộ Workstream 1**: `anthropic-tool-helpers.ts` ➔ `anthropic-stream.ts` + `utils.ts`/`types.ts` ➔ `streamActivity.ts` + `streamProtocol.ts` ➔ `useThinkingStats.ts` + `useChatStreamReader.ts` + `useChatStreamExecution.ts` + `useChatPartialPersistence.ts` + `useChatStreamController.ts` ➔ `StreamingActivityBar.tsx` + `BubbleMarkdown.tsx` + `ChatBubble.tsx` + `ChatMessagesArea.tsx` + `ChatConversationView.tsx` + `SmartCode.tsx` + `InputForm.tsx`.
- **Nội bộ Workstream 2**: `src/types/files.ts` + `uploadPresentation.ts` + `store.ts` + `fileUploadHelpers.ts` ➔ `useFileUpload.ts` ➔ `FilePreviewCard.tsx` + `FilePreviewArea.tsx` + `InputForm.tsx` + `FileLightbox.tsx` + `FileInMessage.tsx` + `FileManagerPanel.tsx` + `ComposerLeadingControls.tsx`. Các bề mặt C (`knowledgeUploadHelpers.ts` ➔ `KnowledgePanel.tsx` + `projects/[id]/page.tsx` + `ProjectSettingsModal.tsx`), D (`ControlPanelReferenceImages.tsx`), và E (`DescribeImageView.tsx`, `TemplateModal.tsx`) dùng chung CSS animation `.animate-vikini-shimmer` và các tiện ích trong `uploadPresentation.ts`, không phụ thuộc chéo với Workstream 1.
- **Song ngữ**: Bổ sung 25 khóa vào `vi.ts` và `en.ts` trước khi chạy `npm run type-check`.

---

### 4. Bảng Verified Versions

| Công nghệ / Thư viện                   | Phiên bản thực tế trong Repo (`[SRC]`)        | Xác minh 2026 & Ghi chú tương thích (`[URL]` / `[SRC]`)                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                                 | `^16.4.0` (`package.json:64`)                 | Next.js 16 App Router; giữ ranh giới Client Component (`"use client"`) & thin route handlers.                                                                                                                                                                                                                                                           |
| `react` / `react-dom`                  | `^19.2.3` (`package.json:69-70`)              | React 19 concurrent batching (Zustand + SWR mutate cùng tick), Strict Mode unmount/remount guard, `useDeferredValue`.                                                                                                                                                                                                                                   |
| `@anthropic-ai/sdk`                    | `^0.71.2` (`package.json:39`)                 | `[SRC]` `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:328-334,382-406,1836-1840,1943-1948` + `[URL]` https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/code-execution-tool — xác nhận sự kiện `server_tool_use` + `input_json_delta` + `code_execution_tool_result` (và biến thể `bash_code_execution_tool_result`). |
| `framer-motion`                        | `^12.23.26` (`package.json:59`)               | `[URL]` https://motion.dev/docs/react-animate-presence — `AnimatePresence mode="popLayout"` yêu cầu phần tử con trực tiếp là `motion.*` hoặc forward ref; GPU transform ưu tiên `transform: "scaleX(...)"` / CSS keyframes ngoài main thread.                                                                                                           |
| `@radix-ui/react-popover`              | `^1.1.15` (`package.json:46`)                 | `[SRC]` `src/components/ui/popover.tsx:12-29` đã portal ra `document.body`, đặt `origin-(--radix-popover-content-transform-origin)` và clamp chiều rộng viewport.                                                                                                                                                                                       |
| `tailwindcss` / `@tailwindcss/postcss` | `^4.1.18` (`package.json:53,114`)             | `[URL]` https://tailwindcss.com/docs/theme — cú pháp biến tùy ý `bg-(--token)`, `@keyframes` + `@utility` trong CSS (`src/app/styles/themes/_shared/animations.css`), modifier `motion-reduce:animate-none`.                                                                                                                                            |
| `zustand`                              | `^5.0.9` (`package.json:81`)                  | Bắt buộc atomic selector (`TC-14`) và chỉ lưu cấu trúc thuần JSON-serializable (`Record<string, ...>`, không `Set`/`Map`).                                                                                                                                                                                                                              |
| `swr`                                  | `^2.3.8` (`package.json:78`)                  | `mutate((cur) => mergeUploadedFileOptimistically(cur, file), { revalidate: true })` đồng bộ trong 1 frame.                                                                                                                                                                                                                                              |
| `lucide-react`                         | `^0.562.0` (`package.json:62`)                | Named imports bắt buộc (`TC-13` cấm `import * as`).                                                                                                                                                                                                                                                                                                     |
| `vitest` / `@playwright/test`          | `^4.1.12` / `^1.62.1` (`package.json:87,118`) | Unit tests co-located + Visual QA Playwright trên Desktop `1440×900` & Mobile `375×812`.                                                                                                                                                                                                                                                                |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

> **Lưu ý kiểm soát giới hạn dòng sau Prettier (`printWidth: 100`)**: Tất cả hook trong `src/app/` giữ `<= 325` dòng (`Hard Max 350`), component UI giữ `<= 480` dòng (`Hard Max 500`), module trong `src/lib/` giữ `<= 360` dòng (`Hard Max 400`).

#### Workstream 1 — Streaming Progress, Tool Activity & Loading UX

- `[NEW]` `src/app/api/chat-stream/streaming/anthropic-tool-helpers.ts` — Bộ theo dõi khối tool (`ActiveToolBlock`), throttle tiến độ `input_json_delta`, và parser `code_execution_tool_result` / `bash_code_execution_tool_result` / lỗi thực thi (~150 dòng).
- `[NEW]` `src/app/api/chat-stream/streaming/anthropic-tool-helpers.test.ts` — Unit tests co-located cho mọi chuyển trạng thái server tool, throttle, và trích xuất stdout/stderr/error.
- `[MODIFY]` `src/app/api/chat-stream/streaming/anthropic-stream.ts` — Tích hợp `anthropic-tool-helpers.ts`, sửa rò rỉ `currentToolInput`, phát `codeExecutionStatus` (`writing` + `chars` -> `running` -> `done`), `webSearchStatus` (`searching` -> `done`), `webFetchStatus` (`fetching` -> `done`), sửa `getStreamTimeout(model, thinkingLevel)` tại dòng 531 (thu gọn xuống ~545 dòng).
- `[MODIFY]` `src/app/api/chat-stream/streaming/anthropic-stream.test.ts` — Bổ sung tests cho vòng đời `server_tool_use` -> `input_json_delta` -> `content_block_stop` -> `code_execution_tool_result` (stdout/stderr/error) và xác minh không rò rỉ input sang `tool_use` kế tiếp.
- `[MODIFY]` `src/app/api/chat-stream/streaming/types.ts` — Thêm `CLAUDE: 300000` và `CLAUDE_DEEP_THINKING: 600000` vào `TIMEOUT_CONFIG`.
- `[MODIFY]` `src/app/api/chat-stream/streaming/utils.ts` — Bổ sung nhánh `model.includes("claude")` trong `getStreamTimeout`.
- `[MODIFY]` `src/app/api/chat-stream/streaming/utils.test.ts` — Thêm unit test kiểm tra `getStreamTimeout("claude-sonnet-4-5", ...)` và deep thinking.
- `[NEW]` `src/lib/features/chat/streamActivity.ts` — Kiểu `StreamActivity`, bộ reducer thuần `reduceStreamActivityFromMeta` / `reduceStreamActivityOnThinking` / `reduceStreamActivityOnToken` (thu hẹp `typeof data.status === "string"`), `isQuietStream`, `shouldShowActivityBar`, `formatLocalProgressText`, `formatElapsedDuration`, `formatStreamChars` (~175 dòng).
- `[NEW]` `src/lib/features/chat/streamActivity.test.ts` — Unit tests co-located đầy đủ cho máy trạng thái hoạt động, quiet-stream 8s, interleaved thinking, type narrowing khi `status` là số, và định dạng thời gian/ký tự.
- `[MODIFY]` `src/lib/features/chat/streamProtocol.ts` — Mở rộng `status?: number | string` và thêm `chars?: number`, `name?: string` trên `ParsedSSEEvent["data"]`, thêm `streamActivity?: StreamActivity` trên `ChatFrontendMessage["meta"]`, và trích xuất `isExecutionAborted`, `recordStreamExecutionError`, `clearStreamRuntimeState` giúp giảm mạnh độ dài `useChatStreamExecution.ts` (~378 dòng, `<= 400`).
- `[MODIFY]` `src/lib/features/chat/streamProtocol.test.ts` — Kiểm thử parse sự kiện meta mới (`codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`), `status` dạng số & chuỗi, và `isExecutionAborted` / `recordStreamExecutionError` / `clearStreamRuntimeState`.
- `[MODIFY]` `src/app/features/chat/components/hooks/chatStreamHookTypes.ts` — Thêm `setStreamingActivity` vào `UseChatStreamReaderParams`, `UseChatPartialPersistenceParams`, `UseChatStreamExecutionParams`.
- `[MODIFY]` `src/app/features/chat/components/hooks/useThinkingStats.ts` — Reset `endedAtRef.current = null` khi `markThinking` chạy lại sau `markAnswer` (hỗ trợ interleaved thinking).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamReader.ts` — Thu hẹp `status: typeof data?.status === "number" ? data.status : undefined` tại nhánh `error` (`src/app/features/chat/components/hooks/useChatStreamReader.ts:179`), tách cờ `isThinkingActive` khỏi `isFirstToken` để `markAnswer()` luôn tắt `thinkingStats.live` & dừng `setInterval(1000)` sau interleaved thinking, xử lý `codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`, `localQueue`, `localPromptProgress` qua `reduceStreamActivityFromMeta`, và throttle `updatedAt` mỗi 2s trên `token` (~275 dòng, `<= 350`).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatPartialPersistence.ts` — Xóa `setStreamingActivity(null)` khi hoàn tất/hủy stream (~325 dòng, `<= 350`).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamExecution.ts` — Thay 5 khối lặp hủy bỏ bằng `isExecutionAborted`, thay 2 khối ghi lỗi bằng `recordStreamExecutionError`, và gọi `clearStreamRuntimeState` (khởi tạo `createInitialStreamActivity()` khi bắt đầu stream và đặt `null` khi hủy/reset), kéo chiều dài từ `337L` xuống **~295 dòng** (`<= 350` sau Prettier).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamController.ts` — Thêm state `streamingActivity` và xuất trả cho view (~312 dòng, `<= 350`).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamController.test.ts` — Kiểm thử `streamingActivity` qua chuỗi `codeExecutionStatus` (writing/running/done), `webSearchStatus`, `functionCall`, và xác minh `streamingThinkingStats.live` chuyển `true -> false -> true -> false` khi interleaved thinking (không rò timer).
- `[NEW]` `src/app/features/chat/components/StreamingActivityBar.tsx` — Thanh trạng thái streaming `React.memo` giữ duy nhất 1 vùng `role="status"`, cô lập đồng hồ 1s `tabular-nums`, render `<TypingDots />` nội bộ khi `phase === "connecting" && !hasDisplayContent && !localProgress && elapsed < 8000`, tự chuyển sang `stillWorking` ở `>= 8s`, shimmer GPU, và icon Lucide theo giai đoạn (~165 dòng).
- `[NEW]` `src/app/features/chat/components/StreamingActivityBar.test.tsx` — Unit tests cho từng phase, chuyển `TypingDots` ➔ `stillWorking` tại 8s bằng fake timers, `reduced-motion`, và `chars` counter.
- `[MODIFY]` `src/app/features/chat/components/BubbleHelpers.tsx` — Trích xuất `PartialMessageStatusBadges` từ `ChatBubble.tsx` (~160 dòng); **giữ nguyên** `export const TypingCursor` tại `src/app/features/chat/components/BubbleHelpers.tsx:36-51` để bảo toàn `src/app/features/chat/components/BubbleHelpers.test.tsx:25-43`.
- `[MODIFY]` `src/app/features/chat/components/BubbleMarkdown.tsx` — Xóa `<TypingCursor />` orphan sau `<ReactMarkdown>`, thêm prop `showInlineCursor?: boolean` gắn class `.chat-markdown-streaming`, và cung cấp `BubbleStreamingContext` nhẹ cho `SmartCode`.
- `[MODIFY]` `src/app/features/chat/components/SmartCode.tsx` — Hiển thị chỉ báo live nhẹ trên tiêu đề khối mã khi đang stream qua `useContext(BubbleStreamingContext)` (~205 dòng).
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.tsx` — Nhận `streamingActivity` qua `message.meta.streamActivity`, kích hoạt `isStreamThinking` khi interleaved thinking, chuyển `typingStatusText` sang `streamActivity.ts` và tách `PartialMessageStatusBadges` sang `BubbleHelpers.tsx`, áp đặt **loại trừ lẫn nhau tuyệt đối** giữa `<TypingDots />` và `<StreamingActivityBar />` (khi `useActivityBar` bật thì tắt `<TypingDots />`, bảo toàn `regenerating={true}` khi không stream), cập nhật `React.memo` comparator — kéo từ `498L` xuống **~459 dòng** (`<= 500` sau Prettier).
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.test.tsx` — Kiểm thử không còn orphan cursor block, render `StreamingActivityBar` theo phase, interleaved thinking, và khẳng định `getAllByRole("status")` luôn có độ dài `1` (không trùng 2 loader).
- `[MODIFY]` `src/app/features/chat/components/ChatMessagesArea.tsx` — Truyền `streamingActivity` vào `meta.streamActivity` của Active Streaming Bubble và cho phép hiển thị bubble khi `Boolean(streamingActivity)` (~345 dòng).
- `[MODIFY]` `src/app/features/chat/components/ChatConversationView.tsx` — Truyền `streamingActivity={chat.streamingActivity}` sang `ChatMessagesArea`.
- `[MODIFY]` `src/app/styles/themes/_shared/animations.css` — Thêm `@keyframes vikini-shimmer`, `@utility animate-vikini-shimmer`, `@keyframes vikini-stream-dot` và quy tắc `@media (prefers-reduced-motion: reduce)`.
- `[MODIFY]` `src/app/styles/themes/_shared/utilities.css` — Thêm `.chat-markdown-streaming` inline-end dot trên phần tử cuối (`p`, `li`, `blockquote > p`) và guard reduced-motion.

#### Workstream 2 — File & Image Upload UI + Animation Overhaul (5 Surfaces)

- `[MODIFY]` `src/types/files.ts` — Thêm `previewUrl?: string` vào `FileUploadProgress`.
- `[NEW]` `src/lib/features/files/uploadPresentation.ts` — Các helper thuần: `sortComposerFiles` (xử lý an toàn khi thiếu/sai `created_at`, giữ nguyên thứ tự gốc cho mock tối giản), `mergeUploadedFileOptimistically`, `filterVisibleUploadQueue`, `createSafeObjectUrl`, `revokeSafeObjectUrl`, `formatFileUploadError`, `formatRelativeFileDate`, `getStableFileKey`, `validateReferenceImages` (~185 dòng).
- `[NEW]` `src/lib/features/files/uploadPresentation.test.ts` — Unit tests co-located cho toàn bộ helper trên (kể cả `sortComposerFiles` với mục thiếu `created_at`).
- `[MODIFY]` `src/lib/features/files/store.ts` — Bổ sung `renderKeyByFileId`, `localPreviewByFileId`, `recentlyCompletedAt`, `enqueueFiles`, `completeUpload`, `releaseFileMetadata`, `clearRecentlyCompleted`, và thu hồi `objectURL` an toàn khi xóa/dọn hàng đợi (~145 dòng).
- `[NEW]` `src/lib/features/files/store.test.ts` — Unit tests co-located cho atomic `completeUpload`, chuyển giao `previewUrl`, `clearRecentlyCompleted`, và `URL.revokeObjectURL` khi remove/clear.
- `[MODIFY]` `src/lib/features/files/fileUploadHelpers.ts` — Chuyển `activeXhrs` sang `Map<string, XMLHttpRequest>` theo `tempId`, thêm callback `onProcessing` khi `xhr.upload` đạt 100% / `xhr.upload.onload`, và tách 2 helper `buildQueuedUploadItems` + `uploadFileWithRetry` từ `useFileUpload.ts` sang đây (~366 dòng, `<= 400`).
- `[MODIFY]` `src/lib/features/files/fileUploadHelpers.test.ts` — Bổ sung tests cho `onProcessing`, hủy XHR theo `tempId`, `buildQueuedUploadItems`, và `uploadFileWithRetry` (phân biệt `cancelled` vs `stale` vs retry).
- `[MODIFY]` `src/lib/features/files/useFileUpload.ts` — Sửa `isUploading` (`queued | uploading | processing`), ủy quyền `buildQueuedUploadItems` và `uploadFileWithRetry` cho `fileUploadHelpers.ts`, bổ sung `cancelledTempIdsRef` + `sleepResolversByTempIdRef` để `cancelUpload(tempId)` chỉ hủy đúng 1 tệp (`continue` để tệp `queued` còn lại tiếp tục tải, bỏ qua tệp `queued` đã bị hủy trước lượt và đánh thức đúng retry sleep của tệp đó) khác với `isStale()` (`break`), đồng bộ `completeUpload` + `onUploadComplete(normalizedFile)` (gắn `conversation_id: targetConvId` nếu server thiếu) kèm `scheduleManagedTimeout(() => clearRecentlyCompleted(normalizedFile.id), 1400)`, dọn `clearQueue()` khi unmount, và xuất `cancelUpload` / `dismissUploadError` — kéo từ `329L` xuống **~285 dòng** (`<= 350` sau Prettier).
- `[MODIFY]` `src/lib/features/files/useFileUpload.test.ts` — Bổ sung tests cho upfront queueing, `processing` phase, per-file cancel (hủy A vẫn tiếp tục tải B; hủy B lúc đang `queued` bỏ qua B; hủy trong lúc retry sleep), `recentlyCompletedAt` tự xóa sau 1400ms (và dọn khi unmount), atomic handoff 0ms, và `URL.revokeObjectURL`.
- `[MODIFY]` `src/app/features/chat/components/FilePreviewCard.tsx` — Bọc component bằng `React.forwardRef<HTMLDivElement, FilePreviewCardProps>` chuyển tiếp `ref` xuống `<motion.div>` gốc (tương thích `AnimatePresence mode="popLayout"`), hiển thị ngay `previewUrl` (`ImageThumbnail` nhận `initialSrc`), giai đoạn `queued`/`uploading`/`processing`/`justCompleted`/`error`, nút hủy từng tệp và đóng lỗi, `snap-start`, `active:scale-[0.97]`, và sửa kẹt `deleting` spinner bằng `try/finally` + `mountedRef` (~300 dòng).
- `[NEW]` `src/app/features/chat/components/FilePreviewCard.test.tsx` — Unit tests cho chuyển đổi tại chỗ (cùng instance DOM), chuyển tiếp `ref`, `initialSrc` không fetch thừa, `processing` shimmer, hủy từng tệp, và nhả spinner khi `onRemove` lỗi.
- `[MODIFY]` `src/app/features/chat/components/FilePreviewArea.tsx` — Giữ wrapper ổn định với `<AnimatePresence>` (mở/đóng mượt, khắc phục 0px dropzone khi trống bằng `min-h-[88px]`), khóa thẻ bằng `renderKeyByFileId[file.id] ?? file.id`, chống trùng queue/files, dọn `clearTimerRef`, và đổi `scrollbar-thumb-[var(--line)]` (`src/app/features/chat/components/FilePreviewArea.tsx:90`) sang `scrollbar-thumb-(--line)` (~185 dòng).
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx` — Nâng cấp `composer-stream-line` sang GPU shimmer, sửa `isReady` (`!disabled && !isUploading`) **và** thêm `|| isUploading` vào `handleSubmit` (`src/app/features/chat/components/InputForm.tsx:257`) chặn phím `Enter` gửi khi đang tải, đổi `scrollbar-thumb-[var(--line)]` (`src/app/features/chat/components/InputForm.tsx:362`) sang `scrollbar-thumb-(--line)`, bỏ khóa `FilePreviewArea`/`+` khi đang upload, sắp xếp `files` tăng dần qua `sortComposerFiles`, dùng `mergeUploadedFileOptimistically` kèm fallback `useSWRConfig().mutate` cho New Chat (`null -> conv-new`), gọi `releaseFileMetadata` khi xóa tệp, bỏ `scale-[1.02]` khi kéo-thả, nối `onNavigate={setLightboxFile}` cho `FileLightbox`, và truyền `onCancelUpload`/`onDismissError` (~465 dòng, `<= 500`).
- `[MODIFY]` `src/app/features/chat/components/InputForm.test.tsx` — Cập nhật mock `useFileUpload` (`cancelUpload`, `dismissUploadError`) và `stableFileStoreState` (`releaseFileMetadata`), bổ sung tests cho `isReady` khi `isUploading=true` / `disabled=true`, **NP-3b** (nhấn `Enter` khi `isUploading=true` không gọi `onSubmit`), giữ nguyên test `composer-stream-line`, và xác minh `onNavigate` được truyền sang `FileLightbox`.
- `[MODIFY]` `src/app/features/chat/components/FileLightbox.tsx` — Chặn render mũi tên Prev/Next khi thiếu `onNavigate` (`hasPrev = Boolean(onNavigate) && ...`).
- `[MODIFY]` `src/app/features/chat/components/FileLightbox.test.tsx` — Bổ sung Negative Probe: không render nút Prev/Next khi `onNavigate` vắng mặt dù `files.length > 1`.
- `[MODIFY]` `src/app/features/chat/components/FileInMessage.tsx` — Nâng cấp thumbnail ảnh 28×28px (ưu tiên `localPreviewByFileId` rồi lazy signed URL), sửa token CSS legacy, thêm `focus-visible` & `active:scale-[0.97]` (~105 dòng).
- `[MODIFY]` `src/app/features/chat/components/FileManagerPanel.tsx` — Chuyển sang Radix `<PopoverContent>` portaled, bọc `FileListItem` bằng `React.forwardRef<HTMLDivElement, FileListItemProps>` chuyển tiếp `ref` xuống `<motion.div>`, nhận callback `onPreviewFile?: (file: FileItem, files: FileItem[]) => void` (không đặt `<FileLightbox />` bên trong `<PopoverContent>`), loại bỏ 100% legacy `var(--...)` & ngày tiếng Anh cứng, thêm thumbnail ảnh và hiển thị `uploadQueue` trực tiếp (~255 dòng).
- `[MODIFY]` `src/app/features/chat/components/ComposerLeadingControls.tsx` — Bọc `FilesChip` bằng Radix `<Popover>` + `<PopoverTrigger asChild>` quanh `<ComposerChip>`, và đặt `<FileLightbox />` (lazy `next/dynamic(..., { ssr: false })`, chỉ render khi `lightboxFile !== null`) làm phần tử anh em **NGOÀI** `<Popover>` kèm `onPreviewFile={(file, files) => { setOpen(false); setLightboxFiles(files); setLightboxFile(file); }}`, truyền đủ `files` và `onNavigate={setLightboxFile}` (~195 dòng).
- `[NEW]` `src/app/features/chat/components/FileManagerPanel.test.tsx` — Bọc `<FileManagerPanel>` trong `<Popover open={true}>`, kiểm thử portal Radix Popover, ngày song ngữ, thumbnail + `onPreviewFile`, `FileListItem` dưới `popLayout`, và hiển thị hàng đợi đang tải (cùng 1 test trong `ComposerLeadingControls.test.tsx` hoặc tại đây xác minh `<FileLightbox />` vẫn mở sau khi Popover đóng).
- `[NEW]` `src/lib/features/projects/knowledgeUploadHelpers.ts` — `KnowledgeUploadCallbacks`, `validateKnowledgeFile`, `sendKnowledgeUploadXhr` (tiến độ `onProgress` + `onProcessing` + chuẩn hóa lỗi 413/JSON + `AbortSignal` ném `UPLOAD_ABORTED_SENTINEL`) (~135 dòng).
- `[NEW]` `src/lib/features/projects/knowledgeUploadHelpers.test.ts` — Unit tests co-located cho validate, XHR progress -> processing, 413, JSON nested error, và abort.
- `[MODIFY]` `src/components/features/projects/KnowledgePanel.tsx` — Mở rộng chữ ký tương thích ngược `onUpload: (file: File, payload: FormData | string, callbacks?: KnowledgeUploadCallbacks) => Promise<{ truncated?: boolean; document?: KnowledgeDocument } | void>`, quản lý `activeUploadControllersRef` (`Map<string, AbortController>`) hủy toàn bộ XHR đang chạy khi unmount, tách khối `pendingUploads` (`<AnimatePresence mode="popLayout">` với `React.forwardRef` trên `PendingUploadRow`/`DocumentItem`) **độc lập ngoài** nhánh skeleton/empty state (`isLoading && safeDocuments.length === 0 && pendingUploads.length === 0`), kéo-thả `dragDepthRef`, `multiple`, thanh dung lượng GPU `scaleX`, và xóa chuỗi cứng (~395 dòng, `<= 500`).
- `[MODIFY]` `src/components/features/projects/KnowledgePanel.test.tsx` — Bổ sung tests cho drag-and-drop nhiều tệp, từ chối định dạng/dung lượng sai, giữ nguyên hàng `pendingUploads` khi `isLoading=true` & `documents=[]`, và hủy `AbortController` khi unmount giữa chừng.
- `[MODIFY]` `src/app/projects/[id]/page.tsx` — Cập nhật `handleUpload(file, payload, callbacks?)` nối `sendKnowledgeUploadXhr` cho `FormData` (chuyển tiếp `onProgress`/`onProcessing`/`signal`, giữ `Promise.all([fetchDocuments(), fetchProjects()])`) và thay chuỗi cứng bằng `t(...)` (~378 dòng).
- `[MODIFY]` `src/components/features/projects/ProjectSettingsModal.tsx` — Cập nhật `handleUpload(file, payload, callbacks?)` nối `sendKnowledgeUploadXhr` cho `FormData` (chuyển tiếp `onProgress`/`onProcessing`/`signal`, giữ `Promise.all([fetchDocuments(), fetchProjects()])`) và thay chuỗi cứng bằng `t(...)` (~378 dòng).
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx` — Chuyển sang `URL.createObjectURL` + `getStableFileKey` + revoke cleanup, nút xóa chạm được trên mobile, kéo-thả + kiểm tra loại/dung lượng kèm `toast.error`, và `AnimatePresence` (~205 dòng).
- `[NEW]` `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx` — Kiểm thử objectURL lifecycle/revoke, stable keys, drag-drop, validation toasts, và nút xóa hiển thị trên mobile.
- `[MODIFY]` `src/app/features/image-gen/components/DescribeImageView.tsx` — Reset `e.target.value = ""`, `dragDepthRef`, sửa transition dropzone (bỏ `scale-[1.02]`), thêm `reader.onerror` & `img.onerror` chống treo `analyzing`, và dọn `copyTimeoutRef` (~460 dòng).
- `[MODIFY]` `src/app/features/image-gen/components/DescribeImageView.test.tsx` — Bổ sung tests cho `reader.onerror`, `img.onerror` không treo `analyzing`, và reset input.
- `[MODIFY]` `src/app/features/image-gen/components/TemplateModal.tsx` — Kiểm tra loại ảnh + dung lượng <= 10MB kèm `toast.error`, bổ sung kéo-thả với `dragDepthRef` (~155 dòng).
- `[NEW]` `src/app/features/image-gen/components/TemplateModal.test.tsx` — Kiểm thử từ chối tệp sai loại/quá 10MB bằng `toast.error` và thả ảnh hợp lệ.

#### Song ngữ & Living Docs

- `[MODIFY]` `src/lib/utils/translations/vi.ts` — Thêm 25 khóa tiếng Việt tự nhiên.
- `[MODIFY]` `src/lib/utils/translations/en.ts` — Thêm 25 khóa tiếng Anh tương ứng.
- `[MODIFY]` `docs/contracts.md` — Bổ sung các biến thể `codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall` vào `MetaEventPayload` §2.
- `[MODIFY]` `docs/CHANGELOG.md` — Ghi nhận đầy đủ các cải tiến Workstream 1 & 2.
- `[MODIFY]` `docs/lessons-learned.md` — Ghi bài học hậu xử lý (Post-Fix Protocol) về Anthropic `code_execution_tool_result`, orphan `<TypingCursor />`, và atomic same-key handoff khi upload tệp.

---

### 6. Caller-First Design Sketch

#### 6.1. Anthropic Server Tool Tracker (`anthropic-stream.ts` ➔ `anthropic-tool-helpers.ts`)

```typescript
// Caller site inside createAnthropicStream loop (src/app/api/chat-stream/streaming/anthropic-stream.ts)
const toolTracker = createAnthropicToolTracker();

// On content_block_start:
const startOutcome = toolTracker.handleBlockStart(block, Date.now());
for (const metaEvt of startOutcome.metaEvents) {
  sendEvent(controller, "meta", metaEvt);
}
if (startOutcome.codeResultMarkdown) {
  full += startOutcome.codeResultMarkdown;
  acc.full = full;
  sendEvent(controller, "token", { t: startOutcome.codeResultMarkdown });
}
if (startOutcome.webSources.length > 0) {
  collectedSources.push(...startOutcome.webSources);
}

// On content_block_delta (input_json_delta):
const deltaMeta = toolTracker.handleInputJsonDelta(partial, Date.now());
if (deltaMeta) sendEvent(controller, "meta", deltaMeta);

// On content_block_stop:
const stopOutcome = toolTracker.handleBlockStop(Date.now());
if (stopOutcome.metaEvent) sendEvent(controller, "meta", stopOutcome.metaEvent);
if (stopOutcome.clientToolCall) {
  // Execute get_current_time with safely parsed inputJson
}
```

#### 6.2. Client Stream Activity State, Type Narrowing & Mutual Exclusion (`useChatStreamReader` ➔ `ChatBubble` ➔ `StreamingActivityBar`)

```typescript
// Type widening in src/lib/features/chat/streamProtocol.ts:
export interface ParsedSSEEvent {
  event: string;
  data: {
    // ...existing fields...
    status?: number | string; // HTTP status number on "error"; activity phase string on "meta"
    chars?: number;
    name?: string;
  } | null;
}

// Pure state transitions in src/lib/features/chat/streamActivity.ts
export type StreamActivityPhase =
  | "connecting"
  | "thinking"
  | "code_writing"
  | "code_running"
  | "web_searching"
  | "web_fetching"
  | "tool_running"
  | "local_queue"
  | "local_prompt"
  | "responding";

export interface StreamActivity {
  phase: StreamActivityPhase;
  startedAt: number;
  updatedAt: number;
  chars?: number;
  toolName?: string;
  queuePosition?: number;
  promptPercent?: number;
}

// Inside src/app/features/chat/components/hooks/useChatStreamReader.ts:
let isFirstToken = true;
let isThinkingActive = false;

// - event === "thinking" (handles both initial AND post-tool interleaved thinking):
isThinkingActive = true;
markThinking();
const nextThinking = reduceStreamActivityOnThinking(activityRef.current);
activityRef.current = nextThinking;
setStreamingActivity(nextThinking);

// - event === "token":
if (isThinkingActive) {
  isThinkingActive = false;
  markAnswer(); // Always stops useThinkingStats setInterval(1000) after interleaved thinking!
}
if (isFirstToken) {
  isFirstToken = false;
}
const nextTokenActivity = reduceStreamActivityOnToken(activityRef.current, Date.now());
if (nextTokenActivity !== undefined) {
  activityRef.current = nextTokenActivity;
  setStreamingActivity(nextTokenActivity);
}

// - event === "error" (narrow number | string -> number for StreamError.status):
const errData: StreamError = {
  message: data?.message || t("streamErrorGeneric"),
  code: data?.code,
  status: typeof data?.status === "number" ? data.status : undefined,
};

// Inside src/app/features/chat/components/ChatBubble.tsx (Strict Mutual Exclusion):
const streamActivity = safeMessage.meta?.streamActivity ?? null;
const useActivityBar = Boolean(
  isBot && isStreaming && isLastAssistant && (streamActivity || localProgress)
);
const showTyping = !useActivityBar && (isLoading || (isBot && isLastAssistant && isStreamThinking && !displayContent.trim()));

// Render (at most ONE loader & ONE role="status" inside ChatBubble):
{showTyping ? (
  <TypingDots />
) : (
  <>
    <BubbleMarkdown
      content={deferredDisplayContent}
      isBot={isBot}
      isStreaming={isStreaming}
      isLastAssistant={isLastAssistant}
      showInlineCursor={isStreaming && isLastAssistant && streamActivity?.phase === "responding"}
    />
    {useActivityBar && (
      <StreamingActivityBar
        activity={streamActivity}
        localProgress={localProgress}
        isStreaming={true}
        hasDisplayContent={Boolean(displayContent.trim())}
      />
    )}
  </>
)}
```

#### 6.3. Atomic Same-Key Upload Handoff, Per-File Cancel & Popover/Lightbox Separation (Surfaces A & B)

```typescript
// Upfront queueing & per-file cancel inside src/lib/features/files/useFileUpload.ts:
const cancelledTempIdsRef = useRef<Set<string>>(new Set());
const sleepResolversByTempIdRef = useRef<Map<string, () => void>>(new Map());
const activeXhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());

const cancelUpload = useCallback((tempId: string) => {
  cancelledTempIdsRef.current.add(tempId);
  activeXhrsRef.current.get(tempId)?.abort();
  activeXhrsRef.current.delete(tempId);
  sleepResolversByTempIdRef.current.get(tempId)?.();
  sleepResolversByTempIdRef.current.delete(tempId);
  useFileStore.getState().removeFromQueue(tempId); // Also revokes its previewUrl
}, []);

// Inside uploadFiles loop (delegated to buildQueuedUploadItems & uploadFileWithRetry):
const queuedItems = buildQueuedUploadItems(fileArray, (err) => onErrorRef.current?.(err));
useFileStore.getState().enqueueFiles(queuedItems);

for (const item of queuedItems) {
  if (isStale()) break;
  if (cancelledTempIdsRef.current.delete(item.tempId)) continue; // Cancelled while queued -> skip!

  const result = await uploadFileWithRetry({
    item,
    conversationId: targetConvId,
    activeXhrs: activeXhrsRef.current,
    isStale,
    isCancelled: () => cancelledTempIdsRef.current.has(item.tempId),
    sleep: (ms) => abortableSleep(ms, item.tempId),
    onProgress: (pct) => useFileStore.getState().updateProgress(item.tempId, pct),
    onProcessing: () => useFileStore.getState().setStatus(item.tempId, "processing"),
    onSuccess: (uploadedFile) => {
      if (uploadedFile && !isUnmountedRef.current) {
        const normalizedFile = uploadedFile.conversation_id
          ? uploadedFile
          : { ...uploadedFile, conversation_id: targetConvId };
        useFileStore.getState().completeUpload(item.tempId, normalizedFile);
        onUploadCompleteRef.current?.(normalizedFile);
        scheduleManagedTimeout(
          () => useFileStore.getState().clearRecentlyCompleted(normalizedFile.id),
          1400
        );
      } else {
        useFileStore.getState().removeFromQueue(item.tempId);
      }
    },
  });

  if (result.outcome === "stale") break;
  if (result.outcome === "cancelled") {
    cancelledTempIdsRef.current.delete(item.tempId);
    useFileStore.getState().removeFromQueue(item.tempId);
    continue; // Per-file cancel MUST continue uploading remaining queued files!
  }
  if (result.outcome === "error" && result.error) { /* mark error + schedule 5s cleanup */ }
}

// Inside src/app/features/chat/components/InputForm.tsx (New Chat SWR fallback + Enter guard):
const { mutate: globalMutate } = useSWRConfig();
const handleUploadComplete = useCallback((uploadedFile: FileItem) => {
  const fileConvId = uploadedFile.conversation_id;
  if (conversationId && (!fileConvId || fileConvId === conversationId)) {
    void mutateFiles((cur) => mergeUploadedFileOptimistically(cur, uploadedFile), { revalidate: true });
  } else if (fileConvId) {
    void globalMutate<FileItem[]>(
      `/api/files?conversationId=${fileConvId}`,
      (cur) => mergeUploadedFileOptimistically(cur, uploadedFile),
      { revalidate: true }
    );
  }
}, [conversationId, globalMutate, mutateFiles]);

// handleSubmit guard (blocks desktop Enter while uploading):
if (disabled || isSubmittingRef.current || isStreaming || isUploading) return;

// Inside src/app/features/chat/components/FilePreviewCard.tsx & FileManagerPanel.tsx:
// Wrap FilePreviewCard and FileListItem in React.forwardRef<HTMLDivElement, ...>
// forwarding ref to root <motion.div ref={ref} ... /> for AnimatePresence mode="popLayout"!

// Inside src/app/features/chat/components/ComposerLeadingControls.tsx (Lightbox OUTSIDE Popover):
<div className="relative shrink-0">
  <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <ComposerChip icon={FolderOpen} active={open}>{`${t("files")} (${fileCount})`}</ComposerChip>
    </PopoverTrigger>
    {conversationId && (
      <FileManagerPanel
        conversationId={conversationId}
        isOpen={open}
        onClose={() => setOpen(false)}
        onPreviewFile={(file, files) => {
          setOpen(false);
          setLightboxFiles(files);
          setLightboxFile(file);
        }}
      />
    )}
  </Popover>
  {lightboxFile && (
    <FileLightbox
      file={lightboxFile}
      files={lightboxFiles}
      onClose={() => setLightboxFile(null)}
      onNavigate={setLightboxFile}
    />
  )}
</div>
```

#### 6.4. Knowledge Base Staged XHR Upload & Unmount Abort (Surface C)

```typescript
// Inside src/lib/features/projects/knowledgeUploadHelpers.ts:
export interface KnowledgeUploadCallbacks {
  onProgress?: (percent: number) => void;
  onProcessing?: () => void;
  signal?: AbortSignal;
}

export function sendKnowledgeUploadXhr(params: {
  projectId: string;
  file: File;
  onProgress?: (percent: number) => void;
  onProcessing?: () => void;
  signal?: AbortSignal;
}): Promise<{ document?: KnowledgeDocument; truncated: boolean }>;

// Backward-compatible 3-arg contract on src/components/features/projects/KnowledgePanel.tsx:
export interface KnowledgePanelProps {
  // ...existing props...
  onUpload: (
    file: File,
    payload: FormData | string,
    callbacks?: KnowledgeUploadCallbacks
  ) => Promise<{ truncated?: boolean; document?: KnowledgeDocument } | void>;
}

// Inside KnowledgePanel.tsx:
// 1. Track activeUploadControllersRef = useRef<Map<string, AbortController>>(new Map());
//    abort all controllers on unmount, swallow UPLOAD_ABORTED_SENTINEL without toast.error.
// 2. Render pendingUploads OUTSIDE the skeleton/empty conditional:
//    - Pending rows: <AnimatePresence initial={false} mode="popLayout">...</AnimatePresence>
//    - Skeleton only when: isLoading && safeDocuments.length === 0 && pendingUploads.length === 0
//    - Empty state only when: !isLoading && safeDocuments.length === 0 && pendingUploads.length === 0
```

#### 6.5. Adversarial Timelines (Concurrency, TOCTOU, Cleanup & Serverless)

```text
Cơ chế: Anthropic Server Tool Input Accumulation & Interleaved Thinking Timer Lifecycle
T1: Claude phát thinking -> token("Intro") -> server_tool_use (code_execution, 25KB input_json_delta)
T2: Sandbox chạy 110s, trả code_execution_tool_result, phát tiếp thinking (interleaved) -> token("Final")
T3: activeBlock chỉ đếm inputChars (0 tích trữ chuỗi), idleTimeoutMs=150s/300s giữ luồng sống;
    ở client, isThinkingActive=true ở cả 2 pha thinking và token("Final") kiểm tra if (isThinkingActive)
    để gọi markAnswer(), đóng thinkingStats.live=false và xóa sạch setInterval(1000).
Kết cục: Không rò bộ nhớ server, không ngắt sớm 90s, không rò 1s interval sau interleaved thinking -> An toàn

Cơ chế: Atomic Same-Key Upload Handoff + New Chat SWR Race (Surface A)
T1: Trên New Chat (conversationId=null), kéo 2 ảnh A, B -> ensureConversationId tạo "conv-new" và enqueueFiles đặt A, B status "queued"
T2: Ảnh A hoàn tất XHR trước khi prop conversationId kịp đổi sang "conv-new" (bound mutate đang key null); hoặc SWR revalidate trả [A, X] DESC
T3: useFileUpload gắn conversation_id="conv-new" vào normalizedFile, completeUpload(tempIdA, normalizedFile) gán renderKeyByFileId & localPreviewByFileId
    kèm scheduleManagedTimeout(clearRecentlyCompleted, 1400); InputForm fallback sang globalMutate("/api/files?conversationId=conv-new", ...) và sortComposerFiles ép ASC;
    FilePreviewCard dùng React.forwardRef cho PopChild đo đúng vị trí dưới AnimatePresence mode="popLayout".
Kết cục: Không mất tệp trên New Chat, 0 duplicate, 0 nhảy vị trí, 0 lỗi popLayout, justCompleted tự dọn sau 1.4s -> An toàn

Cơ chế: Per-File Cancel vs. Conversation Switch & Enter-Key TOCTOU (Surface A)
T1: Người dùng thả [A, B, C] (A uploading, B/C queued), bấm × hủy riêng A rồi gõ chữ bấm Enter trên desktop khi B đang tải
T2: 500ms sau khi B đang upload hoặc đang ở retry sleep, người dùng đổi sang conv-2 (hoặc hủy riêng C lúc đang queued)
T3: cancelUpload(tempIdA) ghi cancelledTempIdsRef + abort XHR của A + đánh thức sleep của A -> uploadFileWithRetry trả "cancelled" -> loop continue sang B;
    Enter gặp guard (disabled || isSubmittingRef || isStreaming || isUploading) tại src/app/features/chat/components/InputForm.tsx:257 nên bị chặn;
    khi đổi hội thoại, isStale() -> break + cancelActiveUploads() hủy toàn bộ Map XHR/timers/sleep và clearQueue() thu hồi 100% ObjectURL.
Kết cục: Hủy riêng A không làm kẹt B, Enter không gửi thiếu tệp, đổi chat/unmount sạch 100% XHR & Blob URL -> An toàn

Cơ chế: Radix Popover + FileLightbox Focus Handoff & KnowledgePanel Empty-Project Multi-Upload (Surfaces B & C)
T1: Mở FileManagerPanel (Radix PopoverContent) rồi bấm ảnh mở FileLightbox (Radix Dialog); tương tự thả 2 tệp vào KnowledgePanel đang trống
T2: Dialog nhận focus làm Radix Popover đóng qua onFocusOutside; tệp #1 KnowledgePanel hoàn tất gọi fetchDocuments() đặt isLoading=true khi documents=[]
T3: FileLightbox nằm làm phần tử anh em NGOÀI <Popover> trong ComposerLeadingControls.tsx nên không bị unmount khi Popover đóng;
    KnowledgePanel render pendingUploads độc lập ngoài nhánh skeleton (isLoading && safeDocuments.length === 0 && pendingUploads.length === 0)
    và abort toàn bộ activeUploadControllersRef khi unmount.
Kết cục: FileLightbox giữ mở ổn định kèm Prev/Next; tệp #2 KnowledgePanel không bị skeleton xóa mất; unmount không rò XHR -> An toàn

Cơ chế: DescribeImageView Corrupt Image Decode & Rapid Re-Select (Surface E)
T1: Người dùng chọn tệp .png hỏng phần header -> bấm Phân tích -> API trả mô tả nhưng tạo thumbnail canvas gọi img.onerror
T2: Người dùng thoát trang ngay sau khi bấm Sao chép (trong cửa sổ 2000ms timeout)
T3: img.onerror resolve promise thumbnail an toàn -> finally luôn đặt analyzing=false; copyTimeoutRef được clearTimeout trong unmount cleanup.
Kết cục: Không treo nút Phân tích, không cảnh báo setState sau unmount -> An toàn

Môi trường serverless: N/A cho Surface A–E client state (thuần trình duyệt); phía server anthropic-tool-helpers
chỉ tạo createAnthropicToolTracker() cục bộ theo từng ReadableStream request (không dùng biến module-global),
nên an toàn tuyệt đối khi chạy song song nhiều serverless instances.
```

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

#### Giai đoạn 1 — Song ngữ & Shared CSS Animations

- [ ] **Bước 1.1**: Bổ sung 25 khóa song ngữ mới vào `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`:
  - Streaming activity: `streamActivityWritingCode`, `streamActivityRunningCode`, `streamActivitySearchingWeb`, `streamActivityFetchingWeb`, `streamActivityThinking`, `streamActivityRunningTool`, `streamActivityStillWorking`, `streamActivityGenerating`, `streamCharsUnit`.
  - File upload status & actions: `fileStatusQueued`, `fileStatusProcessing`, `fileStatusReady`, `cancelUpload`, `dismissUploadError`.
  - Relative dates: `relativeTimeJustNow`, `relativeTimeMinutesAgo`, `relativeTimeHoursAgo`, `relativeTimeYesterday`, `relativeTimeDaysAgo`.
  - Knowledge Base, Studio References, Describe & Template: `kbDropFilesHint`, `kbProcessing`, `kbUnsupportedFileType`, `studioRefMaxReached`, `describeReadFailed`, `templateDropPhotoHint`.
- [ ] **Bước 1.2**: Bổ sung `@keyframes vikini-shimmer`, `@utility animate-vikini-shimmer`, `@keyframes vikini-stream-dot` (kèm `@media (prefers-reduced-motion: reduce)`) vào `src/app/styles/themes/_shared/animations.css`, và thêm `.chat-markdown-streaming` inline-end dot vào `src/app/styles/themes/_shared/utilities.css`.

#### Giai đoạn 2 — Workstream 1: Server-Side Anthropic Streaming & Timeouts

- [ ] **Bước 2.1**: Cập nhật `TIMEOUT_CONFIG` (`CLAUDE`, `CLAUDE_DEEP_THINKING`) trong `src/app/api/chat-stream/streaming/types.ts` và nhánh `"claude"` trong `getStreamTimeout` (`src/app/api/chat-stream/streaming/utils.ts`) + cập nhật `src/app/api/chat-stream/streaming/utils.test.ts`.
- [ ] **Bước 2.2**: Tạo `src/app/api/chat-stream/streaming/anthropic-tool-helpers.ts` và co-located `src/app/api/chat-stream/streaming/anthropic-tool-helpers.test.ts` (xử lý `server_tool_use` + `tool_use`, throttle `input_json_delta`, `content_block_stop`, `code_execution_tool_result`, `bash_code_execution_tool_result`, `web_search_tool_result`, `web_fetch_tool_result`).
- [ ] **Bước 2.3**: Tích hợp `createAnthropicToolTracker()` vào `src/app/api/chat-stream/streaming/anthropic-stream.ts`, sửa `getStreamTimeout(model, thinkingLevel)` tại nhánh catch timeout, và bổ sung test vào `src/app/api/chat-stream/streaming/anthropic-stream.test.ts`.

#### Giai đoạn 3 — Workstream 1: Client-Side Stream Activity & UI

- [ ] **Bước 3.1**: Tạo `src/lib/features/chat/streamActivity.ts` (kèm `typeof data.status === "string"` narrowing và `formatLocalProgressText`) và `src/lib/features/chat/streamActivity.test.ts`. Cập nhật `src/lib/features/chat/streamProtocol.ts` (mở rộng `status?: number | string`, `chars?: number`, `name?: string` trên `ParsedSSEEvent["data"]`, `streamActivity?: StreamActivity` trên `ChatFrontendMessage["meta"]`, và trích xuất `isExecutionAborted`, `recordStreamExecutionError`, `clearStreamRuntimeState`) + cập nhật `src/lib/features/chat/streamProtocol.test.ts`.
- [ ] **Bước 3.2**: Cập nhật `useThinkingStats.ts` (reset `endedAtRef` cho interleaved thinking), `chatStreamHookTypes.ts`, `useChatStreamReader.ts` (thu hẹp `typeof data?.status === "number"` ở nhánh `error`, tách cờ `isThinkingActive` khỏi `isFirstToken` để `markAnswer()` tắt timer sau interleaved thinking, xử lý đủ meta activity), `useChatPartialPersistence.ts`, `useChatStreamExecution.ts` (dùng `isExecutionAborted`/`recordStreamExecutionError`/`clearStreamRuntimeState` đưa xuống ~295 dòng `<= 350` sau Prettier), và `useChatStreamController.ts` + cập nhật `useChatStreamController.test.ts`.
- [ ] **Bước 3.3**: Tạo `src/app/features/chat/components/StreamingActivityBar.tsx` (1 vùng `role="status"` duy nhất, render `<TypingDots />` nội bộ khi `connecting` < 8s và chuyển sang `stillWorking` >= 8s) và `src/app/features/chat/components/StreamingActivityBar.test.tsx`.
- [ ] **Bước 3.4**: Cập nhật `BubbleHelpers.tsx` (trích xuất `PartialMessageStatusBadges` từ `ChatBubble.tsx`, **giữ nguyên** `export const TypingCursor` cho `BubbleHelpers.test.tsx`), `BubbleMarkdown.tsx` (xóa lời gọi `<TypingCursor />`, thêm `.chat-markdown-streaming` + `BubbleStreamingContext`), `SmartCode.tsx` (chỉ báo live nhẹ), `ChatBubble.tsx` (áp đặt loại trừ lẫn nhau `<TypingDots />` vs `<StreamingActivityBar />`, kéo xuống ~459 dòng `<= 500` sau Prettier), `ChatMessagesArea.tsx`, `ChatConversationView.tsx` + cập nhật `ChatBubble.test.tsx`.

#### Giai đoạn 4 — Workstream 2: Surface A (Chat Composer) & Surface B (Files Popover)

- [ ] **Bước 4.1**: Cập nhật `src/types/files.ts`, tạo `src/lib/features/files/uploadPresentation.ts` (`sortComposerFiles` chịu được `created_at` thiếu/sai) + `src/lib/features/files/uploadPresentation.test.ts`.
- [ ] **Bước 4.2**: Nâng cấp `src/lib/features/files/store.ts` (`renderKeyByFileId`, `localPreviewByFileId`, `recentlyCompletedAt`, `enqueueFiles`, `completeUpload`, `releaseFileMetadata`, `clearRecentlyCompleted`, revoke blob URLs) + tạo `src/lib/features/files/store.test.ts`.
- [ ] **Bước 4.3**: Cập nhật `src/lib/features/files/fileUploadHelpers.ts` (`Map<string, XMLHttpRequest>`, `onProcessing`, tách `buildQueuedUploadItems` và `uploadFileWithRetry`, ~366 dòng `<= 400`) + `src/lib/features/files/fileUploadHelpers.test.ts`, và `src/lib/features/files/useFileUpload.ts` (ủy quyền cho `fileUploadHelpers.ts` kéo xuống ~285 dòng `<= 350`, `cancelledTempIdsRef` + per-tempId `sleepResolversByTempIdRef` để hủy 1 tệp `continue` khác với `isStale()` `break`, `scheduleManagedTimeout(clearRecentlyCompleted, 1400)`, chuẩn hóa `conversation_id`, dọn `clearQueue()` khi unmount, sửa `isUploading`) + `src/lib/features/files/useFileUpload.test.ts`.
- [ ] **Bước 4.4**: Nâng cấp `FilePreviewCard.tsx` (bọc `React.forwardRef` cho `popLayout`, + tạo `FilePreviewCard.test.tsx`), `FilePreviewArea.tsx` (đổi `scrollbar-thumb-(--line)`), `InputForm.tsx` (`composer-stream-line` GPU shimmer, `isReady`, thêm `|| isUploading` vào `handleSubmit`, đổi `scrollbar-thumb-(--line)`, `sortComposerFiles`, fallback `useSWRConfig().mutate` cho New Chat, `onNavigate`, bỏ khóa thừa) + `InputForm.test.tsx` (bổ sung mocks & test chặn `Enter` khi đang upload), `FileLightbox.tsx` + `FileLightbox.test.tsx`, và `FileInMessage.tsx`.
- [ ] **Bước 4.5**: Nâng cấp `ComposerLeadingControls.tsx` (bọc `FilesChip` bằng Radix `<Popover>` + đặt `<FileLightbox />` làm anh em **NGOÀI** `<Popover>` kèm `files` + `onNavigate`) + `FileManagerPanel.tsx` (Radix `<PopoverContent>` portaled, bọc `FileListItem` bằng `React.forwardRef`, nhận `onPreviewFile`, song ngữ, v4 tokens, thumbnail, live queue) + tạo `FileManagerPanel.test.tsx` (bọc `<Popover open={true}>`).

#### Giai đoạn 5 — Workstream 2: Surfaces C, D, E

- [ ] **Bước 5.1**: Tạo `src/lib/features/projects/knowledgeUploadHelpers.ts` (`KnowledgeUploadCallbacks`, `validateKnowledgeFile`, `sendKnowledgeUploadXhr`) + `src/lib/features/projects/knowledgeUploadHelpers.test.ts`. Nâng cấp `KnowledgePanel.tsx` (chữ ký 3 tham số tương thích ngược `onUpload`, `activeUploadControllersRef` hủy XHR khi unmount, tách khối `pendingUploads` độc lập ngoài skeleton/empty state, `React.forwardRef` trên hàng `popLayout`, kéo-thả + `multiple` + thanh GPU `scaleX`), `src/app/projects/[id]/page.tsx`, và `ProjectSettingsModal.tsx` + cập nhật `KnowledgePanel.test.tsx`.
- [ ] **Bước 5.2**: Nâng cấp `ControlPanelReferenceImages.tsx` (+ tạo `ControlPanelReferenceImages.test.tsx`).
- [ ] **Bước 5.3**: Nâng cấp `DescribeImageView.tsx` (+ cập nhật `DescribeImageView.test.tsx`) và `TemplateModal.tsx` (+ tạo `TemplateModal.test.tsx`).

#### Giai đoạn 6 — Living Docs, Format Check, Verification & Visual QA

- [ ] **Bước 6.1**: Cập nhật `docs/contracts.md` (§2 `MetaEventPayload`), `docs/CHANGELOG.md`, và `docs/lessons-learned.md`.
- [ ] **Bước 6.2**: Chạy `npx prettier --write` trên toàn bộ tệp đã sửa/tạo mới rồi kiểm tra `npx prettier --check` để bảo đảm `TC-13` (giới hạn dòng hook/component) không bị trượt khi `lint-staged` chạy.
- [ ] **Bước 6.3**: Chạy đầy đủ `npm run type-check; npm run lint; npm run test:run`.
- [ ] **Bước 6.4**: Thực hiện **Visual QA bằng Playwright** (khởi chạy `next dev` với đường dẫn chữ hoa ổ `C:\...` trên Windows, chụp ảnh `.png` ở Desktop `1440×900` & Mobile `375×812` × Dark & Light themes cho Chat Streaming Activity Bar, Composer Upload Tray + Popover, Knowledge Base, Image Studio References, Describe Image; gọi `read_file` soi từng ảnh bằng mắt; dừng server và dọn tệp tạm).

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Mọi tiêu chí dưới đây là **BẮT BUỘC PASS** để `@qa` nghiệm thu (chống specification gaming):

| ID         | Thành phần / Luồng                                                         | Input / Kịch bản                                                                                                                                                                                                                                                     | Expected Output / Hành vi bắt buộc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Failure Mode / Boundary Condition                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TC-SU-01` | `anthropic-tool-helpers` & `anthropic-stream`                              | Chuỗi chunk Anthropic: `server_tool_use` (`code_execution`) ➔ 10 `input_json_delta` ➔ `content_block_stop` ➔ `code_execution_tool_result` (`content: { type: "code_execution_result", stdout: "OK\n", stderr: "", return_code: 0 }`)                                 | Phát `meta` `codeExecutionStatus` với `status: "writing"` (có `chars` throttled), `status: "running"` khi stop, phát `token` chứa `OK`, và `status: "done"`.                                                                                                                                                                                                                                                                                                                                                                                                                         | **NP-1**: `code_execution_tool_result` chứa `BetaCodeExecutionToolResultError` (`error_code: "execution_time_exceeded"`) không crash, vẫn phát thông báo lỗi gọn + `status: "done"`. Sau `server_tool_use`, một `tool_use` (`get_current_time`) kế tiếp nhận JSON sạch, **không** dính rác `partial_json` từ block trước.                                                          |
| `TC-SU-02` | `streaming/utils.ts` (`getStreamTimeout`)                                  | `model = "claude-sonnet-4-5"`, `thinkingLevel = "off"` và `"high"`                                                                                                                                                                                                   | Trả về `300000` (5 phút) khi off và `600000` (10 phút) khi `"high"`; `gemini-4-argon` vẫn `900000`; model lạ vẫn `180000`.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Khi `process.env.STREAM_TIMEOUT_MS = "45000"`, biến môi trường luôn ưu tiên trả `45000`.                                                                                                                                                                                                                                                                                           |
| `TC-SU-03` | `streamActivity.ts`, `streamProtocol.ts` & `useChatStreamController`       | Nhận tuần tự: `thinking` ➔ `token` ("Intro") ➔ `meta` `codeExecutionStatus` (`writing`, `chars: 420`) ➔ `running` ➔ `done` ➔ `thinking` (interleaved!) ➔ `token` ("Final") ➔ `done`                                                                                  | `streamingActivity.phase` chuyển: `thinking` ➔ `responding` ➔ `code_writing` (`chars: 420`) ➔ `code_running` ➔ `responding` ➔ `thinking` ➔ `responding` ➔ `null`. **Quan trọng**: `streamingThinkingStats.live` chuyển đúng `true -> false -> true -> false` (khi nhận `token("Final")`, `isThinkingActive` kích hoạt `markAnswer()` tắt timer `setInterval(1000)` ngay lập tức, 0 tick thừa trước `done`). Sự kiện `error` với `status: 429` giữ nguyên `StreamError.status === 429`.                                                                                               | **NP-2**: Frame `meta` malformed hoặc `status: 500` (kiểu số thay vì chuỗi) / `chars: NaN` / `position: "bad"` không crash và trả `undefined` (giữ nguyên trạng thái hợp lệ).                                                                                                                                                                                                      |
| `TC-SU-04` | `StreamingActivityBar`, `BubbleHelpers`, `BubbleMarkdown` & `ChatBubble`   | Render assistant message đang stream: (a) `code_writing` (`chars: 1250`) khi `!displayContent`, (b) `connecting` < 8s rồi tiến fake timers 9s, (c) `responding` bình thường, (d) `regenerating=true` không stream.                                                   | (a) Hiện `Code2` + `streamActivityWritingCode` + `1.3K` + `tabular-nums`, **không** hiện `<TypingDots />` song song (`expect(screen.getAllByRole("status")).toHaveLength(1)`); (b) hiện `<TypingDots />` bên trong 1 `role="status"` rồi chuyển sang `streamActivityStillWorking` sau `>= 8000ms`; (c) `.chat-markdown-streaming` bật trên container, 0 `<TypingCursor />` ngoài `<ReactMarkdown>`; (d) giữ nguyên `TypingDots` cho `regenerating=true` và `BubbleHelpers.test.tsx` (`TypingCursor` export) pass 100%.                                                               | Khi `isStreaming = false`, `StreamingActivityBar` không render (`null`) và interval 1s bị hủy hoàn toàn (0 tick sau unmount).                                                                                                                                                                                                                                                      |
| `TC-SU-05` | `store.ts`, `fileUploadHelpers.ts`, `useFileUpload` & `uploadPresentation` | Kéo 3 ảnh (A, B, C) vào hội thoại đã có tệp X (`created_at` cũ hơn). Test cả hoàn tất bình thường, hủy A giữa chừng, hủy C khi còn `queued`, và New Chat (`null -> conv-new`).                                                                                       | Cả A, B, C vào `uploadQueue` ngay lập tức (`queued`) kèm `previewUrl`. Khi A đạt 100% bytes -> `"processing"` -> `onload` 200: **trong cùng 1 tick** (không đợi 800ms), A rời `uploadQueue`, `renderKeyByFileId[A.id] === tempIdA`, `localPreviewByFileId[A.id] === previewUrlA`, `recentlyCompletedAt[A.id]` được ghi và **tự xóa sau 1400ms** qua managed timer (dọn sạch khi unmount), `normalizedFile.conversation_id` luôn có giá trị cho New Chat SWR fallback, và `sortComposerFiles` giữ `[X, A]` (an toàn khi mục thiếu `created_at`).                                      | **NP-3**: Bấm `cancelUpload(tempIdA)` khi A đang chạy (hoặc đang retry sleep) chỉ hủy A, thu hồi blob URL của A, và **vòng lặp `continue` tiếp tục tải B** (không kẹt `queued` / `isUploading`). Hủy C lúc đang `queued` khiến vòng lặp bỏ qua C. Chuyển hội thoại (`conv-1 -> conv-2`) / unmount `break`, hủy mọi XHR/timer/sleep và gọi `URL.revokeObjectURL` cho 100% blob URL. |
| `TC-SU-06` | `FilePreviewCard`, `FilePreviewArea`, `InputForm`, `FileLightbox`          | (a) `FilePreviewCard` chuyển `{ upload }` ➔ `{ file, localPreviewUrl, justCompleted: true }` cùng `key` + chuyển tiếp `ref`; (b) `onRemove` reject; (c) `InputForm` với `isUploading=true`, `disabled=false` và nhấn `Enter`; (d) `FileLightbox` thiếu `onNavigate`. | (a) Không gọi `fetch("/api/files/.../url")` khi có `localPreviewUrl`, `ref.current` trỏ đúng root `HTMLDivElement` cho `popLayout`; (b) `deleting` spinner tự tắt nhờ `finally`; (c) Nút Send bị disable (`isReady === false`), **NP-3b**: nhấn `Enter` trên desktop khi `isUploading=true` **KHÔNG** gọi `onSubmit`, nhưng nút `+` và nút xóa tệp đã up vẫn dùng được; `composer-stream-line` giữ `aria-hidden="true"`, `bg-(--accent)`, `motion-reduce:animate-none`; (d) **NP-4**: `FileLightbox` không render Prev/Next khi thiếu `onNavigate`; `InputForm` truyền `onNavigate`. | Khi `!hasContent && isDragging` trên `FilePreviewArea`, dropzone render với class `min-h-[88px]` (không sụp 0px).                                                                                                                                                                                                                                                                  |
| `TC-SU-07` | `FileManagerPanel` & `ComposerLeadingControls`                             | Mở popover Tệp từ chip `Tệp (2)` rồi bấm vào ảnh để mở Lightbox                                                                                                                                                                                                      | Render qua Radix `<PopoverContent>` portaled vào `document.body`, `FileListItem` chuyển tiếp `ref` (`React.forwardRef`) cho `popLayout`, ngày dùng `relativeTime*` (0 chuỗi Anh cứng), 0 token legacy `var(--...)`. Khi bấm ảnh, `onPreviewFile` đóng Popover và mở `<FileLightbox />` đặt **NGOÀI** `<Popover>` với đủ `files` + `onNavigate` nên Lightbox giữ mở ổn định sau khi Popover đóng.                                                                                                                                                                                     | Nhấn `Escape` đóng popover; xóa tệp thất bại hiển thị `toast.error` và tắt spinner.                                                                                                                                                                                                                                                                                                |
| `TC-SU-08` | `knowledgeUploadHelpers` & `KnowledgePanel`                                | Kéo thả 2 tệp hợp lệ (`.md`, `.pdf`) + 1 tệp `.exe` vào dự án **đang trống** (`documents = []`); khi tệp #1 xong gọi `fetchDocuments()` (`isLoading=true`); đồng thời kiểm thử unmount giữa lúc tệp đang upload.                                                     | `.exe` bị chặn kèm `toast.error(t("kbUnsupportedFileType"))`; 2 tệp hợp lệ hiện hàng lạc quan (`uploading %` ➔ `kbProcessing`) và **hàng tệp #2 không bị skeleton che mất** khi `isLoading=true` lúc `documents=[]`; thành công gọi cả `fetchDocuments()` và `fetchProjects()`; chữ ký 3 tham số `onUpload(file, payload, callbacks?)` tương thích ngược 100% caller 2 tham số.                                                                                                                                                                                                      | **NP-5**: HTTP `413` ném `serverPayloadTooLarge`; lỗi JSON `{ error: { message: "..." } }` trích đúng chuỗi (không `[object Object]`); tệp `> 4MB` chặn trước XHR; unmount `KnowledgePanel` giữa chừng gọi `AbortController.abort()` hủy XHR mà không báo `toast.error` hay cảnh báo `setState`.                                                                                   |
| `TC-SU-09` | `ControlPanelReferenceImages`                                              | Thêm 3 ảnh, xóa ảnh #1, thả tệp `.txt` và tệp `> 10MB`                                                                                                                                                                                                               | Tạo `objectURL` ổn định (không `FileReader`), thu hồi `URL.revokeObjectURL` đúng ảnh bị xóa và toàn bộ khi unmount; nút xóa có `opacity-100 md:opacity-0`; tệp sai loại/quá 10MB gọi `toast.error`; vượt quá 4 ảnh hiện `toast.info`.                                                                                                                                                                                                                                                                                                                                                | Không dùng `key={idx}` trên danh sách preview.                                                                                                                                                                                                                                                                                                                                     |
| `TC-SU-10` | `DescribeImageView` & `TemplateModal`                                      | (a) `DescribeImageView`: chọn cùng 1 tệp 2 lần, giả lập `FileReader.onerror` và `img.onerror` khi tạo thumbnail; (b) `TemplateModal`: chọn tệp `.pdf` hoặc ảnh `> 10MB`, hoặc kéo thả ảnh `.png` hợp lệ.                                                             | (a) `input.value` reset về `""`; `reader.onerror` gọi `toast.error(t("describeReadFailed"))`; `img.onerror` vẫn cho `analyzing` về `false` và giữ kết quả mô tả; (b) `TemplateModal` gọi `toast.error` cho tệp sai loại/quá 10MB và gọi `onChoosePhoto` khi thả ảnh hợp lệ.                                                                                                                                                                                                                                                                                                          | Unmount `DescribeImageView` trong lúc `copied=true` dọn sạch `copyTimeoutRef`.                                                                                                                                                                                                                                                                                                     |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Danh sách tệp test co-located (21 suites + 2 regression suites giữ xanh)

1. `src/app/api/chat-stream/streaming/anthropic-tool-helpers.test.ts` (mới — `TC-SU-01`, `NP-1`)
2. `src/app/api/chat-stream/streaming/anthropic-stream.test.ts` (cập nhật — `TC-SU-01`)
3. `src/app/api/chat-stream/streaming/utils.test.ts` (cập nhật — `TC-SU-02`)
4. `src/lib/features/chat/streamActivity.test.ts` (mới — `TC-SU-03`, `NP-2`)
5. `src/lib/features/chat/streamProtocol.test.ts` (cập nhật — `TC-SU-03`)
6. `src/app/features/chat/components/hooks/useChatStreamController.test.ts` (cập nhật — `TC-SU-03`)
7. `src/app/features/chat/components/StreamingActivityBar.test.tsx` (mới — `TC-SU-04`)
8. `src/app/features/chat/components/ChatBubble.test.tsx` (cập nhật — `TC-SU-04`)
9. `src/lib/features/files/uploadPresentation.test.ts` (mới — `TC-SU-05`, `TC-SU-07`)
10. `src/lib/features/files/store.test.ts` (mới — `TC-SU-05`, `NP-3`)
11. `src/lib/features/files/fileUploadHelpers.test.ts` (cập nhật — `TC-SU-05`, `NP-3`)
12. `src/lib/features/files/useFileUpload.test.ts` (cập nhật — `TC-SU-05`, `NP-3`)
13. `src/app/features/chat/components/FilePreviewCard.test.tsx` (mới — `TC-SU-06`)
14. `src/app/features/chat/components/InputForm.test.tsx` (cập nhật — `TC-SU-06`, `NP-3b`)
15. `src/app/features/chat/components/FileLightbox.test.tsx` (cập nhật — `TC-SU-06`, `NP-4`)
16. `src/app/features/chat/components/FileManagerPanel.test.tsx` (mới — `TC-SU-07`)
17. `src/lib/features/projects/knowledgeUploadHelpers.test.ts` (mới — `TC-SU-08`, `NP-5`)
18. `src/components/features/projects/KnowledgePanel.test.tsx` (cập nhật — `TC-SU-08`, `NP-5`)
19. `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx` (mới — `TC-SU-09`)
20. `src/app/features/image-gen/components/DescribeImageView.test.tsx` (cập nhật — `TC-SU-10`)
21. `src/app/features/image-gen/components/TemplateModal.test.tsx` (mới — `TC-SU-10`)
22. Regression checks bắt buộc chạy kèm: `src/app/features/chat/components/BubbleHelpers.test.tsx` (`TypingCursor` export) & `src/app/features/chat/components/ComposerLeadingControls.test.tsx` (`Tệp (3)` chip + Popover trigger).

#### Lệnh kiểm chứng (Windows PowerShell 5.1 — dùng `;`, KHÔNG dùng `&&`)

```powershell
# 1. Kiểm tra format Prettier trước để chống trượt giới hạn dòng TC-13 lúc commit
npx prettier --check src/app/api/chat-stream/streaming/ src/lib/features/chat/ src/lib/features/files/ src/lib/features/projects/ src/app/features/chat/components/ src/components/features/projects/ src/app/projects/ src/app/features/image-gen/components/ src/lib/utils/translations/

# 2. Chạy tập trung các suite mới/đã sửa + regression suites + bộ chốt chặn tĩnh TC-13 / TC-14
npx vitest run --reporter=dot src/app/api/chat-stream/streaming/anthropic-tool-helpers.test.ts src/app/api/chat-stream/streaming/anthropic-stream.test.ts src/app/api/chat-stream/streaming/utils.test.ts src/lib/features/chat/streamActivity.test.ts src/lib/features/chat/streamProtocol.test.ts src/app/features/chat/components/hooks/useChatStreamController.test.ts src/app/features/chat/components/StreamingActivityBar.test.tsx src/app/features/chat/components/BubbleHelpers.test.tsx src/app/features/chat/components/ChatBubble.test.tsx src/lib/features/files/ src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/FilePreviewCard.test.tsx src/app/features/chat/components/FileLightbox.test.tsx src/app/features/chat/components/FileManagerPanel.test.tsx src/app/features/chat/components/ComposerLeadingControls.test.tsx src/lib/features/projects/knowledgeUploadHelpers.test.ts src/components/features/projects/KnowledgePanel.test.tsx src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx src/app/features/image-gen/components/DescribeImageView.test.tsx src/app/features/image-gen/components/TemplateModal.test.tsx src/lib/config/theme-config.test.ts

# 3. Full Verification Gate (Tier 2)
npm run type-check; npm run lint; npm run test:run
```

#### Wiring Probes (WP) & Negative Probes (NP)

- **WP-1 (Static Guards Baseline)**: `npx vitest run src/lib/config/theme-config.test.ts` xác nhận mọi file sửa đổi vượt qua `TC-13` (hook `<= 350L`, 0 `transition-all`, 0 dead hover, 0 lucide namespace) và `TC-14` (0 unscoped `use*Store()`).
- **WP-2 (ESLint Legacy Token & Exhaustive-Deps Wiring)**: `npx eslint --print-config src/app/features/chat/components/FileManagerPanel.tsx` xác nhận rule `vikini-design/no-legacy-tokens` và `react-hooks/exhaustive-deps` đang ở mức `error`, và `npm run lint` ra 0 errors / 0 warnings.
- **WP-3 (Translation Key Parity)**: `npm run type-check` kiểm chứng compile-time assertion giữa `vi.ts` và `en.ts` trong `src/lib/utils/translations/index.ts`, đồng thời kiểm chứng type narrowing của `ParsedSSEEvent["data"]["status"]` (`number | string`) tại `src/app/features/chat/components/hooks/useChatStreamReader.ts:179`.
- **NP-1 (Anthropic Tool Error & Isolation Probe)**: Test trong `src/app/api/chat-stream/streaming/anthropic-tool-helpers.test.ts` nạp `server_tool_use` với 10KB `partial_json` + `code_execution_tool_result_error` theo sau bởi `tool_use` `get_current_time` — chứng minh 0 rò rỉ JSON và xử lý lỗi không crash.
- **NP-2 (Malformed & Wrong-Type SSE Meta Probe)**: Test trong `src/lib/features/chat/streamActivity.test.ts` gửi `{ type: "codeExecutionStatus", status: 500, chars: NaN }`, `{ type: "codeExecutionStatus", status: "unknown_phase" }`, và `{ type: "localQueue", position: "abc" }` — chứng minh reducer trả `undefined` (giữ nguyên trạng thái hợp lệ).
- **NP-3 (Per-File Cancel, Retry-Sleep Abort & Blob Cleanup Probe)**: Test trong `src/lib/features/files/useFileUpload.test.ts` + `src/lib/features/files/fileUploadHelpers.test.ts` + `src/lib/features/files/store.test.ts` kiểm chứng hủy file A (khi đang XHR hoặc đang retry sleep) tiếp tục tải file B đang `queued`, hủy file C khi còn `queued` bỏ qua C, `recentlyCompletedAt` tự xóa sau 1400ms, và chuyển hội thoại/unmount gọi `URL.revokeObjectURL` đúng số lượng blob đã tạo.
- **NP-3b (Desktop Enter-Key Bypass While Uploading Probe)**: Test trong `src/app/features/chat/components/InputForm.test.tsx` đặt `isUploading = true`, nhập chữ và nhấn `Enter` — chứng minh `handleSubmit` (`src/app/features/chat/components/InputForm.tsx:257`) chặn gửi, `onSubmit` bị gọi `0` lần.
- **NP-4 (FileLightbox Missing `onNavigate` Probe)**: Test trong `src/app/features/chat/components/FileLightbox.test.tsx` truyền 2 files nhưng `onNavigate={undefined}` — chứng minh 0 nút Prev/Next bị render như nút chết.
- **NP-5 (Knowledge 413, Unsupported Extension & Unmount Abort Probe)**: Test trong `src/lib/features/projects/knowledgeUploadHelpers.test.ts` & `src/components/features/projects/KnowledgePanel.test.tsx` gửi tệp `.exe`, tệp `> 4MB`, phản hồi `413` / `{ error: { message: "..." } }`, và unmount `KnowledgePanel` giữa chừng — chứng minh chặn đúng đầu vào vi phạm, không tạo `[object Object]`, và hủy XHR sạch không bắn `toast.error`.

#### Visual QA Gate (Bắt buộc cho thay đổi UI/CSS — `.agents/rules/03-ui.md`)

1. Khởi chạy `npx next dev --webpack -H 127.0.0.1 -p 3100` (từ đường dẫn chuẩn chữ hoa ổ `C:\Users\wyemh\vikini` trên Windows theo `docs/lessons-learned.md:882`).
2. Dùng Playwright mock auth + SSE/API qua `page.route` để chụp ảnh `.png` vào thư mục tạm ngoài git ở cả **Desktop (`1440×900`)** và **Mobile (`375×812`)** × **Dark** & **Light** themes cho các trạng thái:
   - Chat đang stream với `StreamingActivityBar` (`Đang viết mã...`, `Đang chạy mã...`, `Vẫn đang xử lý...`) + `composer-stream-line` shimmer + xác nhận không có dấu `|` rơi dòng dưới đoạn văn và không hiện 2 loader cùng lúc.
   - Chat Composer đang upload ảnh (`queued` + `uploading 60%` + `processing` + `justCompleted`) + mở `FileManagerPanel` Popover trên Mobile `375px` (kiểm tra không cắt mép trái và `scrollWidth <= innerWidth`) + bấm ảnh mở `FileLightbox` xác nhận Dialog giữ mở sau khi Popover đóng.
   - `/projects/[id]` Knowledge Base Panel (trạng thái kéo-thả + hàng đang lập chỉ mục trên dự án trống).
   - `/images` Reference Images + `/describe` Describe Image dropzone.
3. Gọi `read_file` đọc trực tiếp từng ảnh `.png` để tự kiểm tra tương phản, căn lề, tràn khung, và không có khóa dịch thô. Dừng server và dọn sạch tệp tạm.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                                                                                                                                                                                                 | Mức độ         | Technical Control cụ thể (`[SRC]` / Negative Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1 — Prettier mở rộng mảng `deps` làm hook/component vượt trần (`TC-13` / `.agents/rules/01-coding.md:101-106`)** (`src/app/features/chat/components/hooks/useChatStreamExecution.ts` 337L, `src/lib/features/files/useFileUpload.ts` 329L, `src/app/features/chat/components/ChatBubble.tsx` 498L)                  | **Cao**        | Áp dụng 3 đợt tách cấu trúc cụ thể: (1) trích xuất `isExecutionAborted` (xóa 5 khối lặp), `recordStreamExecutionError` (xóa 2 khối lặp), `clearStreamRuntimeState` vào `src/lib/features/chat/streamProtocol.ts` (~378L `<= 400L`) kéo `useChatStreamExecution.ts` xuống **~295L** (`<= 350L`); (2) trích xuất `buildQueuedUploadItems` & `uploadFileWithRetry` vào `src/lib/features/files/fileUploadHelpers.ts` (~366L `<= 400L`) kéo `useFileUpload.ts` xuống **~285L** (`<= 350L`); (3) tách `PartialMessageStatusBadges` (`src/app/features/chat/components/ChatBubble.tsx:414-441`) vào `src/app/features/chat/components/BubbleHelpers.tsx` (~160L) và chuyển `typingStatusText` (`src/app/features/chat/components/ChatBubble.tsx:197-219`) vào `streamActivity.ts` kéo `ChatBubble.tsx` xuống **~459L** (`<= 500L`). Kiểm chứng bắt buộc qua `npx prettier --check` + `src/lib/config/theme-config.test.ts:453-460` (`WP-1`). |
| **R2 — Rò rỉ bộ nhớ `URL.createObjectURL`, timer `recentlyCompletedAt`, hoặc `setInterval(1000)` khi interleaved thinking**                                                                                                                                                                                            | **Cao**        | (1) Mọi blob URL thu hồi tập trung trong `useFileStore` (`removeFromQueue`, `releaseFileMetadata`, `clearQueue`) + unmount cleanup tại `src/lib/features/files/useFileUpload.ts` & `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`; (2) `clearRecentlyCompleted` chạy qua `scheduleManagedTimeout(..., 1400)` được dọn bởi `timersRef` khi đổi hội thoại/unmount; (3) `useChatStreamReader.ts` tách `isThinkingActive` khỏi `isFirstToken` để luôn gọi `markAnswer()` tắt `useThinkingStats` timer sau interleaved thinking. Kiểm chứng bằng `TC-SU-03`, `TC-SU-05` & `NP-3`.                                                                                                                                                                                                                                                                                                                                  |
| **R3 — Re-render toàn cây chat mỗi 1 giây do đồng hồ `StreamingActivityBar` hoặc trùng 2 loader (`TypingDots` + `StreamingActivityBar`)**                                                                                                                                                                              | **Cao**        | Cô lập `setInterval(1000)` hoàn toàn bên trong `React.memo(StreamingActivityBar)`; `src/app/features/chat/components/hooks/useChatStreamReader.ts` throttle `updatedAt` trên `token` mỗi 2000ms; loại trừ lẫn nhau tuyệt đối (`useActivityBar` tắt `<TypingDots />` ngoài trong `ChatBubble.tsx`, luôn `<= 1` `role="status"`); mọi selector `useFileStore` đều atomic (`src/lib/config/theme-config.test.ts:510-524`, `TC-14`). Kiểm chứng bằng `TC-SU-04` & `WP-1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **R4 — Trùng thẻ tạm, sai thứ tự SWR, hoặc mất tệp New Chat (`conversationId: null -> conv-new`)**                                                                                                                                                                                                                     | **Trung bình** | Kết hợp 4 lớp phòng thủ: (1) `completeUpload` + `onUploadComplete(normalizedFile)` đồng bộ trong 1 tick (bỏ `setTimeout(..., 800)` tại `src/lib/features/files/useFileUpload.ts:204`), (2) fallback `useSWRConfig().mutate("/api/files?conversationId=" + fileConvId, ...)` khi closure `conversationId` còn `null` (`node_modules/swr/dist/_internal/config-context-12s-Dh3trQsc.mjs:259`), (3) `sortComposerFiles` ép `created_at ASC` (chịu được trường thiếu), (4) `filterVisibleUploadQueue` lọc trùng. Kiểm chứng bằng `TC-SU-05` & `uploadPresentation.test.ts`.                                                                                                                                                                                                                                                                                                                                                                |
| **R5 — Radix Popover đóng làm unmount `FileLightbox` hoặc `AnimatePresence mode="popLayout"` thiếu `forwardRef`**                                                                                                                                                                                                      | **Trung bình** | Đặt `<FileLightbox />` làm phần tử anh em **NGOÀI** `<Popover>` trong `src/app/features/chat/components/ComposerLeadingControls.tsx:51-74` (đóng Popover khi bấm ảnh và truyền đủ `files` + `onNavigate`); bọc `FilePreviewCard`, `FileListItem` (`FileManagerPanel.tsx`), và hàng `KnowledgePanel` bằng `React.forwardRef<HTMLDivElement, ...>` chuyển tiếp `ref` xuống `<motion.div>` theo `node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:15,72,99`. Kiểm chứng bằng `TC-SU-06` & `TC-SU-07`.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **R6 — Thay đổi `composer-stream-line`, `BubbleHelpers` hoặc `FileManagerPanel` phá vỡ test hiện hữu (`src/app/features/chat/components/InputForm.test.tsx:424-437`, `src/app/features/chat/components/BubbleHelpers.test.tsx:25-43`, `src/app/features/chat/components/ComposerLeadingControls.test.tsx:40-42,199`)** | **Trung bình** | Giữ nguyên `data-testid="composer-stream-line"`, `aria-hidden="true"`, `bg-(--accent)`, `motion-reduce:animate-none` trong `InputForm.tsx`; giữ nguyên `export const TypingCursor` trong `src/app/features/chat/components/BubbleHelpers.tsx:36-51`; đặt `<PopoverTrigger asChild><ComposerChip /></PopoverTrigger>` trong `ComposerLeadingControls.tsx`. Kiểm chứng bằng chạy trực tiếp cả 3 regression suites.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **R7 — Biến thể mới của Anthropic Code Execution block (`bash_code_execution_tool_result` hoặc `code_execution_tool_result_error`) không được nhận diện**                                                                                                                                                              | **Trung bình** | `anthropic-tool-helpers.ts` đối chiếu trực tiếp schema `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:328-334,382-406`, hỗ trợ cả `code_execution_tool_result`, `bash_code_execution_tool_result`, fallback `code_execution_result`, và nhánh lỗi `*_error`. Kiểm chứng bằng `TC-SU-01` & `NP-1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **R8 — Knowledge Base quên làm mới thống kê dự án, skeleton che hàng đang tải, hoặc rò XHR khi unmount**                                                                                                                                                                                                               | **Trung bình** | Bảo toàn `await Promise.all([fetchDocuments(), fetchProjects()])` tại `src/app/projects/[id]/page.tsx:117` & `src/components/features/projects/ProjectSettingsModal.tsx:135` (`docs/lessons-learned.md:366-371`); render `pendingUploads` độc lập ngoài nhánh skeleton (`isLoading && safeDocuments.length === 0 && pendingUploads.length === 0`); quản lý `activeUploadControllersRef` abort mọi XHR khi unmount. Kiểm chứng bằng `TC-SU-08` & `NP-5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-21-streaming-progress-and-upload-ux-audit-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - Tất cả 89 tham chiếu `LINE_REF` trong kế hoạch đều `[PASS]`
  - `[INFO] CRITIC_REQUIRED no`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`
- Kiểm chứng lỗi cũ: `N/A` (Revision 1 — lượt thẩm định đầu tiên).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                    | Bằng chứng                                                                                                                                                                                                                                                                                                                | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------- | ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/lib/features/chat/streamProtocol.ts:51`                                   | `[SRC]` `src/lib/features/chat/streamProtocol.ts:20,51`, `src/app/features/chat/components/hooks/useChatStreamReader.ts:179`                                                                                                                                                                                              | `ParsedSSEEvent["data"]` hiện đã khai báo `status?: number` (dùng cho HTTP status code lỗi tại `useChatStreamReader.ts:179` gán thẳng vào `StreamError.status?: number`). Kế hoạch ghi bổ sung `status?: string` trên `ParsedSSEEvent["data"]` mà không mở rộng thành `status?: number \| string` và không thu hẹp kiểu `typeof data?.status === "number" ? data.status : undefined` tại `useChatStreamReader.ts:179`, gây lỗi biên dịch `TS2322` ngay khi chạy `npm run type-check`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | DEFECT         | [MAJOR] | `src/app/features/chat/components/hooks/useChatStreamReader.ts:150-156`        | `[SRC]` `src/app/features/chat/components/hooks/useChatStreamReader.ts:139,150-156`, `src/app/features/chat/components/hooks/useThinkingStats.ts:67-82`, `src/app/features/chat/components/ChatBubble.tsx:221-227,307-311`                                                                                                | **Hai lỗ hổng Workstream 1 client**: (a) `useChatStreamReader.ts:150` chỉ gọi `markAnswer()` bên trong `if (isFirstToken)`. Trong kịch bản interleaved thinking (`thinking -> token("Intro") -> thinking -> token("Final")` tại `TC-SU-03`), `markThinking()` đặt lại `live = true` và bật `setInterval(1000)` trong `useThinkingStats.ts:69`, nhưng `token("Final")` không bao giờ gọi `markAnswer()` vì `isFirstToken` đã là `false`, làm `thinkingStats.live` kẹt `true` và timer tick liên tục tới hết stream (cần tách cờ `isThinkingActive` khỏi `isFirstToken`). (b) `ChatBubble.tsx:307-311` vẫn render `<TypingDots />` khi `!displayContent.trim()` trong lúc kế hoạch đồng thời render `<StreamingActivityBar />` phía dưới, chưa chỉ định loại trừ lẫn nhau (dễ sinh 2 bộ chỉ báo tải + 2 `role="status"` chồng nhau khi Claude chạy `code_execution`/`thinking` trước token chữ đầu tiên).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | DEFECT         | [MAJOR] | `src/lib/features/files/useFileUpload.ts:223-226`                              | `[SRC]` `src/lib/features/files/useFileUpload.ts:100-115,223-226`, `src/app/features/chat/components/InputForm.tsx:239-244,257,287`                                                                                                                                                                                       | **Bốn lỗ hổng Surface A**: (a) `useFileUpload.ts:223-226` dùng `if (wasAborted \|\| isStale()) { removeFromQueue(tempId); break; }` — khi hủy riêng file A (`cancelUpload(tempIdA)`), lệnh `break` thoát toàn bộ vòng lặp tải nhiều tệp, bỏ rơi file B kẹt vĩnh viễn ở `status: "queued"` và khóa cứng `isUploading = true` (phải phân biệt hủy từng tệp `continue` vs hủy phiên `isStale()` `break`). (b) Chưa có cơ chế `cancelledTempIdsRef` để bỏ qua file B bị hủy ngay lúc đang `"queued"` (chưa có XHR) hoặc hủy file đang nằm trong `abortableSleep(1000)` giữa các lần retry. (c) `InputForm.tsx:257` (`handleSubmit`) thiếu điều kiện `\|\| isUploading` — nhấn phím `Enter` trên desktop (`InputForm.tsx:239-244`) đi thẳng vào `handleSubmit()`, bỏ qua nút Send đang bị disable bởi `isReady` (`InputForm.tsx:287`) và gửi tin nhắn giữa lúc đang upload. (d) Kế hoạch thêm `recentlyCompletedAt`/`clearRecentlyCompleted` vào `store.ts` nhưng không chỉ định ai đặt và dọn timer tự xóa `recentlyCompletedAt[file.id]`, khiến `justCompleted` kẹt `true` tới khi đổi hội thoại.                                                                                                                                                                                                                                                        |
| 4   | DEFECT         | [MAJOR] | `src/components/features/projects/KnowledgePanel.tsx:34`                       | `[SRC]` `src/components/features/projects/KnowledgePanel.tsx:34,217-247`, `src/app/projects/[id]/page.tsx:55,80`, `src/components/features/projects/ProjectSettingsModal.tsx:70,98`                                                                                                                                       | **Hợp đồng Surface C chưa khép kín**: (a) `KnowledgePanelProps.onUpload` (`KnowledgePanel.tsx:34`) hiện chỉ nhận `(file: File, payload: FormData \| string)`, cả `page.tsx:80` và `ProjectSettingsModal.tsx:98` đều triển khai 2 tham số này; kế hoạch dùng `sendKnowledgeUploadXhr` (`onProgress`, `onProcessing`, `signal`) nhưng không khai báo chữ ký mới của `onUpload` (ví dụ tham số thứ 3 tùy chọn `callbacks?: KnowledgeUploadCallbacks` để tương thích ngược `KnowledgePanel.test.tsx`) và không khai báo `AbortController` hủy XHR khi `KnowledgePanel` unmount. (b) Khi dự án đang trống (`safeDocuments.length === 0`) và tải nhiều tệp, tệp #1 hoàn tất gọi `fetchDocuments()` đặt `isLoading = true` (`page.tsx:55`, `ProjectSettingsModal.tsx:70`), làm nhánh `isLoading && safeDocuments.length === 0` (`KnowledgePanel.tsx:217`) ghi đè xóa mất hàng lạc quan của tệp #2 đang upload; cần render danh sách `pendingUploads` độc lập với nhánh skeleton/empty state.                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | DEFECT         | [MAJOR] | `src/app/features/chat/components/FilePreviewCard.tsx:40`                      | `[SRC]` `node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:15,72,99`, `src/app/features/chat/components/FilePreviewCard.tsx:40`, `src/app/features/chat/components/FileManagerPanel.tsx:167`, `src/components/ui/popover.tsx:16-27`, `src/app/features/chat/components/FileLightbox.tsx:149-155` | **Hai bẫy primitive Radix & Framer Motion**: (a) `PopChild.mjs:15,72,99` yêu cầu con trực tiếp của `<AnimatePresence mode="popLayout">` phải chuyển tiếp `ref` xuống phần tử DOM/`motion.*` (`React.forwardRef`), nếu không `childRef.current` luôn `null` và `popLayout` không đo được vị trí khi thẻ thoát; cả `FilePreviewCard` (`FilePreviewCard.tsx:40`) lẫn `FileListItem` (`FileManagerPanel.tsx:167`) đều chưa dùng `React.forwardRef` và kế hoạch chưa yêu cầu bổ sung. (b) Khi di chuyển `FileManagerPanel` sang Radix `<PopoverContent>` (`popover.tsx:16-27`), mở `<FileLightbox />` (Radix `<Dialog>` tại `FileLightbox.tsx:149-155`) từ bên trong `<PopoverContent>` sẽ chuyển focus sang portal của Dialog, khiến Popover đóng và **unmount ngay `FileLightbox`** nếu `FileLightbox` nằm trong `<PopoverContent>`; kế hoạch phải chỉ định rõ đặt `<FileLightbox />` làm phần tử anh em NGOÀI `<PopoverContent>` (kèm gọi `onClose()` khi mở lightbox, truyền `files` + `onNavigate`, và bọc `<Popover open>` trong `FileManagerPanel.test.tsx`).                                                                                                                                                                                                                                                                                       |
| 6   | DEFECT         | [MAJOR] | `src/lib/features/files/useFileUpload.ts:1-329`                                | `[SRC]` `src/lib/features/files/useFileUpload.ts:1-329`, `src/app/features/chat/components/hooks/useChatStreamExecution.ts:64-83,1-337`, `src/app/features/chat/components/ChatBubble.tsx:197-219,414-441,1-498`, `src/lib/config/theme-config.test.ts:453-460`                                                           | **Dự toán giới hạn dòng sau Prettier không khớp thực tế codebase**: (a) `useFileUpload.ts` hiện đã `329L` (trần Hard Max `350L` cho custom hook theo `.agents/rules/01-coding.md:103`); kế hoạch bổ sung hàng loạt logic mới (`enqueueFiles`, `previewUrl`, `cancelUpload`, `dismissUploadError`, `cancelledTempIdsRef`, `onProcessing`, `completeUpload`, `clearRecentlyCompleted`, unmount `clearQueue`) mà không tách helper nào ra khỏi file nhưng vẫn ước tính `~320L` (thực tế sẽ vượt `~375-390L` sau Prettier; cần tách `buildQueuedUploadItems` / `uploadFileWithRetry` sang `fileUploadHelpers.ts`). (b) `useChatStreamExecution.ts` hiện `337L` (CI `TC-13` khóa cứng `<= 350L` tại `theme-config.test.ts:453-460`); `clearStreamBuffers` (`lines 64-83`) chỉ dài `20L`, nên chỉ tách hàm này trong khi thêm `setStreamingActivity` + `createInitialStreamActivity` chỉ còn `~325-332L`, không đạt `~290L` như dự toán và dễ vượt trần khi Prettier mở rộng deps (cần tách thêm helper xử lý lỗi/phiên stream sang `streamProtocol.ts`). (c) `ChatBubble.tsx` hiện `498L` (sát trần `500L`); bỏ `typingStatusText` (`23L`) rồi thêm `StreamingActivityBar` + interleaved thinking + `showInlineCursor` chỉ còn `~490-495L` (cần tách thêm `PartialMessageStatusBadges` tại `lines 414-441` sang `BubbleHelpers.tsx` để đưa xuống `~460L`). |
| 7   | DEFECT         | [MINOR] | `src/app/features/chat/components/InputForm.tsx:362`                           | `[SRC]` `src/app/features/chat/components/InputForm.tsx:362`, `src/app/features/chat/components/InputForm.test.tsx:92-97,489`, `src/app/features/chat/components/BubbleHelpers.test.tsx:25-43`, `node_modules/swr/dist/_internal/config-context-12s-Dh3trQsc.mjs:259`                                                     | Bốn điểm hoàn thiện nhỏ nên ghi rõ: (a) `InputForm.tsx:362` vẫn còn cú pháp Tailwind v3 `scrollbar-thumb-[var(--line)]` cần đổi sang `scrollbar-thumb-(--line)` cùng lúc với `FilePreviewArea.tsx:90`. (b) `InputForm.test.tsx:489` đẩy mock `{ id: "file-1", name: "a.pdf" }` không có `created_at` nên `sortComposerFiles` phải xử lý an toàn trường thiếu/không hợp lệ, và `stableFileStoreState` (`InputForm.test.tsx:92-97`) cần mock thêm `releaseFileMetadata`. (c) Giữ nguyên export `TypingCursor` trong `BubbleHelpers.tsx:36-51` vì `BubbleHelpers.test.tsx:25-43` đang kiểm thử trực tiếp component này. (d) Trong kịch bản New Chat (`conversationId: null -> conv-new`), `config-context-12s-Dh3trQsc.mjs:259` cho thấy bound `mutate` sẽ bỏ qua nếu key còn rỗng khi XHR xong quá nhanh — truyền thêm `targetConvId` sang `onUploadComplete` (hoặc dùng global SWR `mutate`) sẽ đóng kín khe đua này.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 8   | RISK_DISMISSED | [MINOR] | `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:382-406` | `[SRC]` `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:121-138,328-334,382-406,1033-1044`                                                                                                                                                                                                          | Đã đối chiếu trực tiếp khai báo SDK `@anthropic-ai/sdk@0.71.2`: các khối `server_tool_use` (`BetaServerToolUseBlock`), `code_execution_tool_result` (`BetaCodeExecutionToolResultBlock`), `bash_code_execution_tool_result` (`BetaBashCodeExecutionToolResultBlock`), và các biến thể `*_error` đều khớp với đặc tả trong kế hoạch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 9   | RISK_DISMISSED | [MINOR] | `node_modules/swr/dist/_internal/config-context-12s-Dh3trQsc.mjs:307-350`      | `[SRC]` `node_modules/swr/dist/_internal/config-context-12s-Dh3trQsc.mjs:307-350`, `node_modules/framer-motion/dist/es/components/AnimatePresence/utils.mjs:3-12`                                                                                                                                                         | Đã kiểm chứng hai giả định nền tảng của chuyển đổi thẻ tại chỗ (Surface A): (1) `internalMutate` gọi hàm updater đồng bộ (không `await`) nên React 19 gom batch với Zustand `completeUpload` trong cùng một khung hình; (2) `AnimatePresence` dùng `onlyElements()` qua `React.Children.forEach` (phẳng hóa mảng không đổi key), nên chuyển `<FilePreviewCard key={tempId}>` từ `visibleQueue` sang `files` bên trong cùng `<AnimatePresence>` giữ nguyên được `PresenceChild` (với điều kiện bổ sung `React.forwardRef` theo Finding #5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                                                    | Kết quả | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                 | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan Completeness Gate (7/7 mục, Skills Loaded & Applied, Risk Table, Negative Probes) | FAIL    | `[CMD]` `verify-plan.mjs` exit 0; `[SRC]` `src/lib/features/chat/streamProtocol.ts:51`, `src/components/features/projects/KnowledgePanel.tsx:34`                                                                                                                                                                                                                                                                                           | Đủ 7 mục và ánh xạ 4 skill bắt buộc (`streaming-patterns`, `emil-design-eng`, `add-translation`, `api-patterns`), nhưng sai/thiếu chữ ký hàm trên file `[MODIFY]` (`ParsedSSEEvent["data"]["status"]`, `KnowledgePanelProps.onUpload`) và thiếu thiết kế giải phóng tài nguyên cho `recentlyCompletedAt` / Knowledge XHR unmount.                                                                                  |
| S1: Cold-start & Build                                                                 | FAIL    | `[CMD]` `npm run type-check` (baseline exit 0), `vitest` 12 suites 104/104 PASS; `[SRC]` `src/lib/features/chat/streamProtocol.ts:51`, `src/app/features/chat/components/hooks/useChatStreamReader.ts:179`, `package.json:39-82`                                                                                                                                                                                                           | Dependencies và `.env` hiện tại hợp lệ (0 package ngoại lai), nhưng khai báo `status?: string` trên `ParsedSSEEvent["data"]` làm gãy `tsc --noEmit` tại `useChatStreamReader.ts:179` (`TS2322`) và thiếu định nghĩa chữ ký 3 tham số cho `KnowledgePanelProps.onUpload`.                                                                                                                                           |
| S2: Runner Lifecycle & Teardown                                                        | FAIL    | `[SRC]` `src/app/features/chat/components/hooks/useChatStreamReader.ts:139,150-156`, `src/app/features/chat/components/hooks/useThinkingStats.ts:67-82`, `src/lib/features/files/useFileUpload.ts:100-115`                                                                                                                                                                                                                                 | `useChatStreamReader` không gọi `markAnswer()` sau interleaved thinking làm rò rỉ 1s interval của `useThinkingStats` tới hết stream; `useFileUpload` chưa xử lý hủy `abortableSleep` theo `tempId` và chưa chỉ định cleanup timer cho `recentlyCompletedAt`; `KnowledgePanel` thiếu `AbortController` hủy XHR khi unmount.                                                                                         |
| S3: Database & Temporal Logic                                                          | N/A     | `[CMD]` `verify-plan.mjs` (`CRITIC_REQUIRED no`); `[SRC]` `src/lib/features/files/fileService.server.ts:316`                                                                                                                                                                                                                                                                                                                               | Kế hoạch không sửa bảng PostgreSQL, migration SQL, RLS hay logic DB `*.server.ts`; giữ nguyên truy vấn `GET /api/files` và chỉ sắp xếp ở phía client.                                                                                                                                                                                                                                                              |
| S4: Cross-Task State Flow                                                              | FAIL    | `[SRC]` `src/lib/features/files/useFileUpload.ts:223-226`, `src/app/features/chat/components/InputForm.tsx:257`, `src/components/features/projects/KnowledgePanel.tsx:217-247`, `node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:15,72,99`, `src/components/ui/popover.tsx:16-27`                                                                                                                               | 4 xung đột trạng thái thực tế: (1) `break` khi hủy 1 tệp làm kẹt toàn bộ hàng đợi `queued` + `isUploading = true`; (2) Enter bypass `isReady` tại `InputForm.tsx:257`; (3) `<FileLightbox>` bị unmount nếu nằm trong `<PopoverContent>`, và `FilePreviewCard`/`FileListItem` thiếu `forwardRef` cho `popLayout`; (4) `fetchDocuments()` đặt `isLoading = true` ghi đè hàng lạc quan đang tải của `KnowledgePanel`. |
| S5: Security Boundary & 3-Tier Auth                                                    | PASS    | `[SRC]` `src/app/api/chat-stream/route.ts:9-14`, `src/app/api/files/route.ts:30-31,64-65`, `src/app/api/projects/[id]/knowledge/route.ts:45-56,120-138`                                                                                                                                                                                                                                                                                    | Không chạm tầng xác thực, RBAC, rate limit, hay file `.server.ts`; không rò rỉ `service_role` hay secrets sang Client Component; mọi kiểm tra tệp phía client chỉ bổ trợ cho kiểm tra phía server đã có sẵn.                                                                                                                                                                                                       |
| S6: External Resilience & Serverless Cap                                               | PASS    | `[SRC]` `src/app/api/chat-stream/route.ts:6`, `src/app/api/chat-stream/streaming/anthropic-stream.ts:57-105,275,522-567`, `src/app/api/chat-stream/streaming/utils.ts:209-258`                                                                                                                                                                                                                                                             | `TIMEOUT_CONFIG.CLAUDE` (`300s`/`600s`) nằm dưới `maxDuration = 800s`; `createAnthropicToolTracker()` cục bộ theo từng request (không có biến module-global); `withIdleTimeout` và `savePartialOnce` dọn tài nguyên khi timeout/abort.                                                                                                                                                                             |
| Domain (Static Guards `TC-13`/`TC-14`, Bilingual, File Ceilings)                       | FAIL    | `[CMD]` `npx vitest run src/lib/config/theme-config.test.ts` (63/63 PASS), `npx eslint --print-config src/app/features/chat/components/FileManagerPanel.tsx` (exit 0); `[SRC]` `eslint.config.mjs:33,127`, `src/lib/utils/translations/index.ts:24-34`, `src/lib/features/files/useFileUpload.ts:1-329`, `src/app/features/chat/components/hooks/useChatStreamExecution.ts:1-337`, `src/app/features/chat/components/ChatBubble.tsx:1-498` | Hệ thống song ngữ và ESLint/Vitest guards đã đấu nối chính xác ở baseline, nhưng 3 tệp (`useFileUpload.ts` 329L, `useChatStreamExecution.ts` 337L, `ChatBubble.tsx` 498L) chưa có kế hoạch tách cấu trúc đủ sâu để nằm an toàn dưới trần `<= 350L` / `<= 500L` sau khi Prettier chạy.                                                                                                                              |

#### 3. Adversarial Timelines & Commands Executed

```text
Cơ chế: Interleaved Thinking Timer Leak (Đồng thời / Luồng SSE)
T1: Claude phát event: thinking -> token("Intro") -> isFirstToken thành false, markAnswer() dừng timer
T2: Claude chạy code_execution rồi phát tiếp event: thinking (interleaved) -> markThinking() bật lại live=true + setInterval(1000)
T3: Claude phát token("Final") -> useChatStreamReader.ts:150 kiểm tra if (isFirstToken) nên bỏ qua markAnswer()
Kết cục: thinkingStats.live kẹt true và setInterval(1000) tiếp tục re-render tới hết stream -> Lỗi ([MAJOR], Finding #2)

Cơ chế: Per-File Cancel & Enter-Key TOCTOU trên Chat Composer (Khoảng trống check->use)
T1: Người dùng thả 2 tệp [A, B] -> enqueueFiles đưa A (uploading) và B (queued) vào store; người dùng bấm × hủy riêng A
T2: xhrA.abort() ném UPLOAD_ABORTED_SENTINEL -> useFileUpload.ts:223 chạy if (wasAborted || isStale()) { removeFromQueue(A); break; }
T3: Vòng lặp thoát sớm; B bị bỏ kẹt ở status="queued" vĩnh viễn làm isUploading=true không bao giờ tắt; hoặc nếu người dùng gõ chữ và bấm Enter khi A đang tải, InputForm.tsx:257 không kiểm tra isUploading nên gửi tin nhắn thiếu tệp
Kết cục: Treo hàng đợi upload hoặc gửi thiếu tệp -> Lỗi ([MAJOR], Finding #3)

Cơ chế: Radix Popover + FileLightbox Focus Handoff & KnowledgePanel Multi-File Reload (Thất bại giữa chừng & cleanup)
T1: Người dùng mở FileManagerPanel (Radix PopoverContent) rồi bấm vào ảnh để mở FileLightbox (Radix Dialog)
T2: Dialog portal nhận focus -> Radix Popover kích hoạt onFocusOutside và đóng PopoverContent
T3: Nếu FileLightbox nằm bên trong PopoverContent, cây con bị unmount tức thì làm Lightbox biến mất ngay khi mở; tương tự trên KnowledgePanel, khi tệp #1 xong và gọi fetchDocuments() đặt isLoading=true lúc documents=[], nhánh skeleton xóa mất hàng tiến độ của tệp #2
Kết cục: Lightbox tự tắt ngay lập tức / mất hàng tiến độ upload -> Lỗi ([MAJOR], Findings #4 & #5)

Môi trường serverless: N/A cho Surface A–E (thuần trình duyệt); phía server createAnthropicToolTracker() khởi tạo theo từng request trong ReadableStream.start(), không dùng state module-global nên an toàn khi chạy đa instance -> An toàn
```

- **Commands Executed (Allowlist Read-Only)**:
  - `node scripts/verify-plan.mjs docs/plans/2026-11-21-streaming-progress-and-upload-ux-audit-plan.md` ➔ exit `0` (`VERIFY_PLAN: PASS`, 7/7 sections, 89 `LINE_REF`, `CRITIC_REQUIRED no`)
  - `npm run type-check` ➔ exit `0` (baseline sạch)
  - `npx vitest run src/lib/config/theme-config.test.ts --reporter=dot` ➔ exit `0` (1/1 file, 63/63 tests passed)
  - `npx eslint --print-config src/app/features/chat/components/FileManagerPanel.tsx` ➔ exit `0` (`react-hooks/exhaustive-deps: [2]`, `vikini-design/no-legacy-tokens: [2]`)
  - `npx vitest run --reporter=dot src/app/api/chat-stream/streaming/anthropic-stream.test.ts src/app/api/chat-stream/streaming/utils.test.ts src/lib/features/chat/streamProtocol.test.ts src/app/features/chat/components/hooks/useChatStreamController.test.ts src/app/features/chat/components/ChatBubble.test.tsx src/lib/features/files/fileUploadHelpers.test.ts src/lib/features/files/useFileUpload.test.ts src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/FileLightbox.test.tsx src/app/features/chat/components/ComposerLeadingControls.test.tsx src/components/features/projects/KnowledgePanel.test.tsx src/app/features/image-gen/components/DescribeImageView.test.tsx` ➔ exit `0` (12/12 files, 104/104 tests passed)
  - `git status -s` ➔ exit `0`

#### 4. Kết Luận

Tồn tại **6 lỗi `[MAJOR]`** đã đối chiếu trực tiếp với mã nguồn thực tế (`[SRC]`) cần Planner bổ sung và sửa hợp đồng trước khi mở khóa triển khai: (1) mở rộng `ParsedSSEEvent["data"]["status"]` thành `number | string` kèm narrowing tại `useChatStreamReader.ts:179`; (2) tách cờ `isThinkingActive` cho interleaved thinking + loại trừ lẫn nhau giữa `TypingDots` và `StreamingActivityBar`; (3) sửa per-file cancel (`continue` + `cancelledTempIdsRef` + per-tempId sleep), chặn `isUploading` trong `InputForm.tsx:257`, và quản lý timer `clearRecentlyCompleted`; (4) chốt chữ ký `KnowledgePanelProps.onUpload` 3 tham số (tùy chọn), `AbortController` khi unmount, và không để skeleton/empty state che khuất `pendingUploads`; (5) đặt `FileLightbox` ngoài `<PopoverContent>` và thêm `React.forwardRef` cho `FilePreviewCard`/`FileListItem` dưới `<AnimatePresence mode="popLayout">`; (6) bổ sung bước tách helper cụ thể cho `useFileUpload.ts`, `useChatStreamExecution.ts`, và `ChatBubble.tsx` để bảo đảm giới hạn dòng `TC-13` / `01-coding.md` sau Prettier.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-21-streaming-progress-and-upload-ux-audit-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ 125 tham chiếu `LINE_REF` trong Revision 2 đều `[PASS]`
  - `[INFO] CRITIC_REQUIRED no`
  - `[PASS] CRITIC_FLOOR 9 findings with valid file:line`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

| # Audit Run 1                                                    | Mức     | Trạng thái | Bằng chứng đối chiếu Revision 2 vs. Mã nguồn thật                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 (`ParsedSSEEvent["data"]["status"]`)                          | [MAJOR] | ĐÃ SỬA     | `[SRC]` `src/lib/features/chat/streamProtocol.ts:20,51`, `src/app/features/chat/components/hooks/useChatStreamReader.ts:179` — Revision 2 mở rộng `status?: number \| string`, thu hẹp `typeof data?.status === "number" ? data.status : undefined` tại nhánh `error`, thu hẹp `typeof data.status === "string"` trong `streamActivity.ts`, và bổ sung `NP-2` kiểm thử `status: 500`.                                                                                                                                                                                                                                                                                                             |
| #2 (Interleaved thinking timer & double loader)                  | [MAJOR] | ĐÃ SỬA     | `[SRC]` `src/app/features/chat/components/hooks/useChatStreamReader.ts:139,150-156`, `src/app/features/chat/components/hooks/useThinkingStats.ts:23-82`, `src/app/features/chat/components/ChatBubble.tsx:221-227,307-311` — Revision 2 tách cờ `isThinkingActive` khỏi `isFirstToken` để `markAnswer()` tắt `setInterval(1000)` sau interleaved thinking (`TC-SU-03`), đồng thời áp đặt loại trừ lẫn nhau `showTyping = !useActivityBar && ...` trong `ChatBubble.tsx` bảo đảm tối đa 1 `role="status"` (`TC-SU-04`).                                                                                                                                                                            |
| #3 (Per-file cancel, Enter guard, `recentlyCompletedAt`)         | [MAJOR] | ĐÃ SỬA     | `[SRC]` `src/lib/features/files/useFileUpload.ts:100-115,223-226`, `src/app/features/chat/components/InputForm.tsx:239-244,257,287` — Revision 2 bổ sung `cancelledTempIdsRef` + `sleepResolversByTempIdRef`, phân biệt `result.outcome === "cancelled"` (`continue`) với `"stale"` (`break`), thêm `\|\| isUploading` vào `handleSubmit` (`NP-3b`), và gắn `scheduleManagedTimeout(() => clearRecentlyCompleted(id), 1400)` dọn bởi `timersRef` (`TC-SU-05`, `NP-3`).                                                                                                                                                                                                                            |
| #4 (Surface C `onUpload` 3-arg, unmount abort, skeleton clobber) | [MAJOR] | ĐÃ SỬA     | `[SRC]` `src/components/features/projects/KnowledgePanel.tsx:34,217-247`, `src/app/projects/[id]/page.tsx:55,80`, `src/components/features/projects/ProjectSettingsModal.tsx:70,98` — Revision 2 chốt chữ ký 3 tham số tương thích ngược `onUpload(file, payload, callbacks?)` trên cả 3 file, quản lý `activeUploadControllersRef` abort khi unmount (`NP-5`), và tách khối `pendingUploads` độc lập ngoài nhánh skeleton/empty state (`TC-SU-08`).                                                                                                                                                                                                                                              |
| #5 (Radix Popover + Lightbox & `forwardRef` cho `popLayout`)     | [MAJOR] | ĐÃ SỬA     | `[SRC]` `node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:15,72,99`, `src/components/ui/popover.tsx:16-27`, `src/app/features/chat/components/FileLightbox.tsx:149-155`, `src/app/features/chat/components/FilePreviewCard.tsx:40`, `src/app/features/chat/components/FileManagerPanel.tsx:167`, `src/app/features/chat/components/ComposerLeadingControls.tsx:51-74` — Revision 2 đặt `<FileLightbox />` làm anh em NGOÀI `<Popover>` tại `ComposerLeadingControls.tsx` kèm `files` + `onNavigate`, bọc `<Popover open={true}>` trong `FileManagerPanel.test.tsx`, và bọc `React.forwardRef` cho `FilePreviewCard`, `FileListItem`, `PendingUploadRow`/`DocumentItem`. |
| #6 (Dự toán giới hạn dòng sau Prettier)                          | [MAJOR] | ĐÃ SỬA     | `[SRC]` `src/lib/features/files/useFileUpload.ts:1-329`, `src/app/features/chat/components/hooks/useChatStreamExecution.ts:1-337`, `src/app/features/chat/components/ChatBubble.tsx:1-498`, `src/app/features/chat/components/BubbleHelpers.tsx:1-121` — Revision 2 bổ sung `BubbleHelpers.tsx` vào danh sách `[MODIFY]` và chỉ rõ các đợt tách cấu trúc cụ thể (`isExecutionAborted`/`recordStreamExecutionError`/`clearStreamRuntimeState` ➔ `useChatStreamExecution.ts` ~295L; `buildQueuedUploadItems`/`uploadFileWithRetry` ➔ `useFileUpload.ts` ~285L; `PartialMessageStatusBadges` + `formatLocalProgressText` ➔ `ChatBubble.tsx` ~459L).                                                  |
| #7 (4 mục nhỏ Surface A & `TypingCursor`)                        | [MINOR] | ĐÃ SỬA     | `[SRC]` `src/app/features/chat/components/InputForm.tsx:362`, `src/app/features/chat/components/InputForm.test.tsx:92-97,489`, `src/app/features/chat/components/BubbleHelpers.tsx:36-51`, `src/app/features/chat/components/BubbleHelpers.test.tsx:25-43`, `node_modules/swr/dist/_internal/config-context-12s-Dh3trQsc.mjs:259` — Đã bổ sung đổi `scrollbar-thumb-(--line)`, chịu `created_at` thiếu trong `sortComposerFiles`, mock `releaseFileMetadata`, giữ export `TypingCursor`, và fallback `useSWRConfig().mutate` cho New Chat.                                                                                                                                                        |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                               | Bằng chứng                                                                                                                                                                                                                              | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------- | ------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/lib/features/chat/streamProtocol.ts:37-61`                           | `[SRC]` `src/lib/features/chat/streamProtocol.ts:37-61`, `src/app/features/chat/components/hooks/useChatStreamReader.ts:91-108`                                                                                                         | Đoạn minh họa §6.2 ghi `data: { ... } \| null` trên `ParsedSSEEvent`, trong khi khai báo thật tại `streamProtocol.ts:37-61` là non-null object (`data: { ... }`) và được `streamProtocol.test.ts` sử dụng trực tiếp. Khi triển khai, giữ nguyên kiểu non-null trên `ParsedSSEEvent["data"]` (chỉ mở rộng `status?: number \| string`, `chars?: number`, `name?: string`) và lọc `if (!data \|\| typeof data !== "object") return null` ngay trong `parseSSEEvent` nếu cần, để không gây thừa null-check trên caller/test.                                      |
| 2   | DEFECT         | [MINOR] | `src/lib/features/files/fileUploadHelpers.ts:22`                          | `[SRC]` `src/lib/features/files/fileUploadHelpers.ts:22,128`, `docs/lessons-learned.md:788-793`                                                                                                                                         | `uploadPresentation.ts` sẽ import `CLIENT_MAX_FILE_SIZE_MB` & `type FileUploadError` từ `fileUploadHelpers.ts`. Nếu `buildQueuedUploadItems` đặt trong `fileUploadHelpers.ts` lại import ngược `createSafeObjectUrl` từ `uploadPresentation.ts`, sẽ tạo vòng phụ thuộc 2 chiều (`fileUploadHelpers.ts <-> uploadPresentation.ts`). Khi triển khai, giữ đồ thị import một chiều bằng cách truyền callback `createPreviewUrl` vào `buildQueuedUploadItems` hoặc đặt `createSafeObjectUrl` trong `fileUploadHelpers.ts` rồi re-export từ `uploadPresentation.ts`. |
| 3   | DEFECT         | [MINOR] | `src/app/features/chat/components/ComposerLeadingControls.test.tsx:40-42` | `[SRC]` `src/app/features/chat/components/ComposerLeadingControls.test.tsx:40-42,186-201`                                                                                                                                               | `ComposerLeadingControls.test.tsx` không nằm trong danh sách `[MODIFY]` ở §5 (Plan Scope Guard); khi triển khai, đặt test kiểm chứng `<FileLightbox />` giữ mở sau khi `<Popover>` đóng trực tiếp trong `[NEW]` `FileManagerPanel.test.tsx` để giữ nguyên `ComposerLeadingControls.test.tsx` không cần chỉnh sửa, và chạy lại suite này để xác nhận lazy `next/dynamic` import trong `ComposerLeadingControls.tsx` hoạt động sạch.                                                                                                                             |
| 4   | RISK_DISMISSED | [MINOR] | `src/app/features/chat/components/BubbleHelpers.tsx:57-65`                | `[SRC]` `src/app/features/chat/components/BubbleHelpers.tsx:36-65`, `src/lib/config/theme-config.test.ts:487-495`                                                                                                                       | Đã kiểm chứng rủi ro tách `PartialMessageStatusBadges` sang `BubbleHelpers.tsx`: `theme-config.test.ts:493` cho phép `(key: string) => string` (chỉ chặn `t: Record<string, string>`), hoặc `PartialMessageStatusBadges` có thể gọi trực tiếp `useLanguage()` theo `.agents/rules/04-bilingual.md:23-32`; `BubbleHelpers.tsx` sau tách đạt ~160L (rất xa trần 500L) và giữ nguyên export `TypingCursor` cho `BubbleHelpers.test.tsx:25-43`.                                                                                                                    |
| 5   | RISK_DISMISSED | [MINOR] | `src/lib/features/chat/streamProtocol.ts:1-337`                           | `[SRC]` `src/lib/features/chat/streamProtocol.ts:1-337`, `src/app/features/chat/components/hooks/useChatStreamExecution.ts:1-337`, `src/lib/features/files/fileUploadHelpers.ts:1-264`, `src/lib/features/files/useFileUpload.ts:1-329` | Đã đối soát lại toàn bộ ngân sách dòng thực tế sau các đợt tách mới của Revision 2: `useChatStreamExecution.ts` (~295L <= 350L), `useFileUpload.ts` (~285L <= 350L), `ChatBubble.tsx` (~459L <= 500L), `streamProtocol.ts` (~378L <= 400L), `fileUploadHelpers.ts` (~366L <= 400L), kèm bước bắt buộc `npx prettier --check` trước `TC-13`.                                                                                                                                                                                                                    |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                                                    | Kết quả | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                            | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7/7 mục, Skills Loaded & Applied, Risk Table, Negative Probes) | PASS    | `[CMD]` `node scripts/verify-plan.mjs` exit 0 (7/7 sections, 125 `LINE_REF`, 0 failures, 0 warnings); `[SRC]` `src/lib/features/chat/streamProtocol.ts:51`, `src/components/features/projects/KnowledgePanel.tsx:34`, `src/app/features/chat/components/BubbleHelpers.tsx:36-51`                                                                                                      | Đầy đủ 7 mục, 4 skill bắt buộc đã ánh xạ, bảng Risk 8 mục đều gắn technical control `[SRC]` + Negative Probe (`NP-1`..`NP-5` + `NP-3b`), mọi file `[NEW]`/`[MODIFY]` đều khai báo khớp thiết kế.                                                                                                                                                                                                                                                                      |
| S1: Cold-start & Build                                                                 | PASS    | `[CMD]` `npm run type-check` exit 0, 12 target Vitest suites 104/104 PASS; `[SRC]` `package.json:39-82`, `src/lib/features/chat/streamProtocol.ts:20,51`, `src/app/features/chat/components/hooks/useChatStreamReader.ts:179`, `src/components/features/projects/KnowledgePanel.tsx:34`                                                                                               | Không thêm package hay biến `.env` mới; xung đột kiểu `ParsedSSEEvent["data"]["status"]` đã được xử lý kèm type narrowing; chữ ký 3 tham số `KnowledgePanelProps.onUpload` tương thích ngược cả 2 page/modal caller và test hiện hữu.                                                                                                                                                                                                                                 |
| S2: Runner Lifecycle & Teardown                                                        | PASS    | `[SRC]` `src/app/features/chat/components/hooks/useChatStreamReader.ts:139,150-156`, `src/app/features/chat/components/hooks/useThinkingStats.ts:23-82`, `src/lib/features/files/useFileUpload.ts:84-115`, `src/app/features/image-gen/components/DescribeImageView.tsx:152-182`; `[ADV]` Timeline #1–#4                                                                              | Đã khép kín toàn bộ vòng đời tài nguyên: `isThinkingActive` tắt `useThinkingStats` interval sau interleaved thinking; `scheduleManagedTimeout` dọn `recentlyCompletedAt`; `sleepResolversByTempIdRef` + `activeXhrsRef` + `clearQueue()` giải phóng XHR/timer/ObjectURL khi đổi chat hoặc unmount; `activeUploadControllersRef` hủy XHR KnowledgePanel khi unmount; `DescribeImageView` dọn `copyTimeoutRef` và thoát `analyzing` qua `img.onerror`/`reader.onerror`. |
| S3: Database & Temporal Logic                                                          | N/A     | `[CMD]` `node scripts/verify-plan.mjs` (`CRITIC_REQUIRED no`); `[SRC]` `src/lib/features/files/fileService.server.ts:316`                                                                                                                                                                                                                                                             | Kế hoạch không thay đổi schema PostgreSQL, migration SQL, RLS policy hay logic DB trong `*.server.ts`; chỉ sắp xếp danh sách hiển thị ở phía client.                                                                                                                                                                                                                                                                                                                  |
| S4: Cross-Task State Flow                                                              | PASS    | `[SRC]` `node_modules/swr/dist/_internal/config-context-12s-Dh3trQsc.mjs:259,307-350`, `node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:15,72,99`, `node_modules/framer-motion/dist/es/components/AnimatePresence/utils.mjs:3-12`, `src/components/ui/popover.tsx:16-27`, `src/app/features/chat/components/InputForm.tsx:257,287`; `[ADV]` Timeline #2–#3 | Đồng bộ Zustand + SWR trong 1 tick (có fallback `useSWRConfig().mutate` cho New Chat); hủy từng tệp dùng `continue` + `cancelledTempIdsRef`; phím `Enter` bị chặn khi `isUploading`; `React.forwardRef` bảo đảm `popLayout`; `<FileLightbox />` đặt ngoài `<Popover>` không bị unmount; `ChatBubble` giữ tối đa 1 `role="status"`; `KnowledgePanel` tách `pendingUploads` ngoài nhánh skeleton/empty.                                                                 |
| S5: Security Boundary & 3-Tier Auth                                                    | PASS    | `[SRC]` `src/app/api/chat-stream/route.ts:9-14`, `src/app/api/files/route.ts:30-31,64-65`, `src/app/api/projects/[id]/knowledge/route.ts:45-56,120-138`                                                                                                                                                                                                                               | Không chạm ranh giới auth/RBAC/rate-limit hay tệp `*.server.ts`; không đưa `service_role` hoặc secrets sang client; kiểm tra tệp phía client chỉ bổ trợ fast-fail cho kiểm tra phía server.                                                                                                                                                                                                                                                                           |
| S6: External Resilience & Serverless Cap                                               | PASS    | `[SRC]` `src/app/api/chat-stream/route.ts:6`, `src/app/api/chat-stream/streaming/anthropic-stream.ts:57-105,275,522-567`, `src/app/api/chat-stream/streaming/utils.ts:209-258`                                                                                                                                                                                                        | `TIMEOUT_CONFIG.CLAUDE` (`300s`/`600s`) nằm trong giới hạn `maxDuration = 800s`; `createAnthropicToolTracker()` cục bộ theo từng request (không biến module-global); `withIdleTimeout` và `savePartialOnce` dọn sạch khi timeout/abort.                                                                                                                                                                                                                               |
| Domain (Static Guards `TC-13`/`TC-14`, Bilingual, File Ceilings)                       | PASS    | `[CMD]` `npx vitest run src/lib/config/theme-config.test.ts` (63/63 PASS), `npx eslint --print-config src/app/features/chat/components/FileManagerPanel.tsx` (exit 0); `[SRC]` `eslint.config.mjs:33,127`, `src/lib/utils/translations/index.ts:24-34`, `src/lib/config/theme-config.test.ts:453-460,510-524`                                                                         | 25 khóa song ngữ bảo vệ bằng compile-time parity (`vi.ts`/`en.ts`), zero unscoped Zustand selector (`TC-14`), zero legacy token (`vikini-design/no-legacy-tokens`), mọi hook/component/lib đều có biên dòng an toàn sau `npx prettier --check`, kèm Visual QA Playwright Desktop & Mobile × Dark/Light.                                                                                                                                                               |

#### 3. Adversarial Timelines & Commands Executed

```text
Cơ chế: Interleaved Thinking Timer & Tool Execution (Đồng thời / SSE Stream)
T1: Claude phát thinking -> token("Intro") -> isThinkingActive thành false, markAnswer() tắt timer 1s
T2: Claude chạy code_execution (110s), trả code_execution_tool_result, phát tiếp thinking (interleaved) -> isThinkingActive=true, markThinking() bật lại timer
T3: Claude phát token("Final") -> useChatStreamReader kiểm tra if (isThinkingActive) gọi markAnswer(), đặt live=false và dừng setInterval(1000) ngay lập tức
Kết cục: Không rò bộ nhớ input JSON trên server, không ngắt sớm 90s, không rò 1s interval trên client -> An toàn

Cơ chế: Per-File Cancel, Queued Cancel, New Chat SWR Race & Desktop Enter TOCTOU (Khoảng trống check->use)
T1: Trên New Chat (conversationId=null), thả 3 ảnh [A, B, C] -> ensureConversationId tạo "conv-new", enqueueFiles đưa [A, B, C] vào hàng đợi; bấm × hủy A và hủy C khi còn queued
T2: Trong lúc B đang upload, người dùng gõ chữ và bấm Enter trên desktop; sau đó B hoàn tất XHR trước khi prop conversationId kịp đổi
T3: cancelUpload(A) kích hoạt outcome="cancelled" -> continue sang B; Enter bị chặn tại InputForm.tsx:257 (|| isUploading); B xong gọi completeUpload + globalMutate("/api/files?conversationId=conv-new") + scheduleManagedTimeout(clearRecentlyCompleted, 1400); vòng lặp gặp C trong cancelledTempIdsRef -> bỏ qua C
Kết cục: B hoàn tất không mất thẻ/không trùng/không nhảy vị trí, A & C được thu hồi ObjectURL, Enter không gửi thiếu tệp -> An toàn

Cơ chế: Radix Popover + FileLightbox Focus Handoff & KnowledgePanel Unmount/Reload (Thất bại giữa chừng & cleanup)
T1: Bấm ảnh trong FileManagerPanel (Radix PopoverContent) mở FileLightbox (Radix Dialog); tương tự tải 2 tệp vào KnowledgePanel dự án trống rồi unmount giữa tệp #2
T2: Dialog nhận focus làm Radix Popover đóng qua onFocusOutside; tệp #1 KnowledgePanel gọi fetchDocuments() đặt isLoading=true khi documents=[]; sau đó người dùng đóng modal/rời trang
T3: FileLightbox đặt làm phần tử anh em NGOÀI <Popover> trong ComposerLeadingControls.tsx nên giữ mở ổn định kèm Prev/Next; KnowledgePanel render pendingUploads độc lập ngoài nhánh skeleton nên tệp #2 không biến mất, và unmount cleanup gọi AbortController.abort() trên activeUploadControllersRef, nuốt UPLOAD_ABORTED_SENTINEL không bắn toast.error
Kết cục: Lightbox không bị unmount, tiến độ đa tệp ổn định, không rò XHR hay cảnh báo setState sau unmount -> An toàn

Môi trường serverless: N/A cho Surface A–E (client-only); phía server createAnthropicToolTracker() cấp phát cục bộ theo từng ReadableStream request, không dùng biến module-global nên an toàn khi nhiều serverless instances chạy đồng thời -> An toàn
```

- **Commands Executed (Allowlist Read-Only)**:
  - `node scripts/verify-plan.mjs docs/plans/2026-11-21-streaming-progress-and-upload-ux-audit-plan.md` ➔ exit `0` (`VERIFY_PLAN: PASS`, 7/7 sections, 125 `LINE_REF`, `CRITIC_FLOOR: 9 findings`, `CRITIC_REQUIRED: no`)
  - Baseline verification từ Audit Run 1 (mã nguồn chưa thay đổi kể từ Audit Run 1): `npm run type-check` (exit `0`), `npx vitest run src/lib/config/theme-config.test.ts --reporter=dot` (63/63 PASS), `npx eslint --print-config src/app/features/chat/components/FileManagerPanel.tsx` (exit `0`), `npx vitest run` 12 target suites (104/104 PASS), `git status -s` (exit `0`).

#### 4. Kết Luận

Toàn bộ **6 lỗi `[MAJOR]`** và **4 điểm `[MINOR]`** từ `Audit Run 1` đã được khắc phục đầy đủ ở Revision 2 và đối chiếu khớp với mã nguồn thật (`[SRC]` / `[CMD]`). Còn lại 3 lưu ý `[MINOR]` (không chặn phê duyệt) cho giai đoạn triển khai: giữ kiểu non-null trên `ParsedSSEEvent["data"]` (`streamProtocol.ts:37-61`), giữ đồ thị import một chiều không vòng giữa `fileUploadHelpers.ts` và `uploadPresentation.ts`, và đặt test Popover+Lightbox persistence trong `[NEW]` `FileManagerPanel.test.tsx`. `CRITIC_REQUIRED` là `no` — phê duyệt mở khóa triển khai.

[PLAN_APPROVED]
