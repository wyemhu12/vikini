# Kế Hoạch Triển Khai: Chat Streaming Progress, Tool Activity & Upload UX/Animation Overhaul

- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-21
- **Revision**: 1
- **Status**: Pending Review

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
3. **Client SSE Drops Tool Activity & Interleaved Thinking (`[SRC]`)**: `src/app/features/chat/components/hooks/useChatStreamReader.ts:47-111` bỏ qua hoàn toàn `codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`. `src/app/features/chat/components/hooks/useThinkingStats.ts:23-57` không reset `endedAtRef` khi `markThinking` được gọi lại sau `markAnswer` (interleaved thinking). `src/app/features/chat/components/ChatBubble.tsx:188` chỉ đánh dấu `isThinking` khi `!extracted.rest.trim()`.
4. **Orphan Cursor & Static Composer Line (`[SRC]`)**: `src/app/features/chat/components/BubbleMarkdown.tsx:221` render `<TypingCursor />` làm phần tử con kế tiếp sau `<ReactMarkdown>` (rơi sang dòng trống dưới đoạn `<p>`). `src/app/features/chat/components/InputForm.tsx:318-324` render thanh cố định `w-[52%] animate-pulse`, và test hiện có (`src/app/features/chat/components/InputForm.test.tsx:423-438`) kiểm tra `data-testid="composer-stream-line"` phải có `aria-hidden="true"`, class chứa `bg-(--accent)` và `motion-reduce:animate-none`.
5. **Composer Upload Duplicate + Ghost + Sort Teleport (`[SRC]`)**: `src/lib/features/files/useFileUpload.ts:199-205` gọi `onUploadComplete(uploadedFile)` ngay rồi đợi `800ms` mới xóa `tempId` khỏi `uploadQueue`. `src/app/features/chat/components/FilePreviewArea.tsx:93-106` render `files` (`key={file.id}`) tách biệt với `uploadQueue` (`key={upload.tempId}`), tạo 2 thẻ song song. `src/lib/features/files/fileService.server.ts:316` trả danh sách giảm dần (`ascending: false`), còn `src/app/features/chat/components/InputForm.tsx:130` nối cuối mảng lạc quan khiến thẻ nhảy từ phải sang trái khi SWR revalidate.
6. **FilePreviewCard / Area / InputForm / Lightbox Defects (`[SRC]`)**:
   - `src/lib/features/files/useFileUpload.ts:42` chỉ xét `status === "uploading"` cho `isUploading` (bỏ sót `queued`/`processing`).
   - `src/app/features/chat/components/InputForm.tsx:287` có lỗi logic `(!disabled || isUploading)` bật nhầm nút Send khi đang upload, và `src/app/features/chat/components/InputForm.tsx:334,372,412` khóa nút xóa tệp và nút `+` khi đang upload. `src/app/features/chat/components/InputForm.tsx:474` thiếu `onNavigate={setLightboxFile}` cho `FileLightbox`, trong khi `src/app/features/chat/components/FileLightbox.tsx:55-56,232,244` vẫn render mũi tên Prev/Next dù không có `onNavigate`.
   - `src/app/features/chat/components/FilePreviewArea.tsx:47` early return phá hủy `exit` animation và khiến overlay kéo-thả có chiều cao 0px khi `!hasContent && isDragging`; `src/app/features/chat/components/FilePreviewArea.tsx:56` tạo `setTimeout` không cleanup.
   - `src/app/features/chat/components/FilePreviewCard.tsx:156-160` gọi `setDeleting(true)` không có `finally`, kẹt spinner nếu `DELETE` thất bại.
   - `src/app/features/chat/components/FileManagerPanel.tsx:26-40,113-128` dùng `position: absolute` không portal (vi phạm quy tắc `docs/lessons-learned.md:781-786`), hardcode ngày tiếng Anh và dùng cú pháp legacy `var(--...)`. `src/app/features/chat/components/ComposerChip.tsx:17-40` đã dùng `React.forwardRef`, sẵn sàng cho Radix `<PopoverTrigger asChild>`.
7. **Project Knowledge, Image Studio, Describe & Template Defects (`[SRC]`)**:
   - `src/components/features/projects/KnowledgePanel.tsx:66-102,152-196` thiếu drag-and-drop, thiếu `multiple`, dùng `style={{ width }}`, không có tiến độ XHR, và có chuỗi tiếng Việt/Anh cứng; tương tự tại `src/app/projects/[id]/page.tsx:101,109,203` và `src/components/features/projects/ProjectSettingsModal.tsx:77,119,127,131,148`.
   - `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx:28-46,93,104` dùng `FileReader` dính race condition, `key={idx}`, và nút xóa `opacity-0` không bấm được trên mobile.
   - `src/app/features/image-gen/components/DescribeImageView.tsx:98-102,117-125,152-165,182,229-256` thiếu `e.target.value = ""`, thiếu `dragDepthRef`, thiếu `reader.onerror`/`img.onerror` (gây treo `analyzing = true`), và không dọn `setTimeout`.
   - `src/app/features/image-gen/components/TemplateModal.tsx:36-43` bỏ qua im lặng tệp không phải ảnh, không kiểm tra dung lượng 10MB, và thiếu kéo-thả.
8. **CI Static Guards (`[SRC]`)**: `src/lib/config/theme-config.test.ts:437-538` khóa cứng: `TC-13` (mọi hook `use*.ts(x)` trong `src/app/` `<= 350` dòng sau Prettier, 0 `transition-all`, 0 dead hover, 0 `import * as ... from "lucide-react"`, 0 `t: Record<string, string>`), và `TC-14` (0 lời gọi `use*Store()` không selector). `docs/lessons-learned.md:188-193` cấm lưu `Set`/`Map` trong Zustand state.

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
- `[NEW]` `src/lib/features/chat/streamActivity.ts` — Kiểu `StreamActivity`, bộ reducer thuần `reduceStreamActivityFromMeta` / `reduceStreamActivityOnThinking` / `reduceStreamActivityOnToken`, `isQuietStream`, `shouldShowActivityBar`, `formatElapsedDuration`, `formatStreamChars` (~155 dòng).
- `[NEW]` `src/lib/features/chat/streamActivity.test.ts` — Unit tests co-located đầy đủ cho máy trạng thái hoạt động, quiet-stream 8s, interleaved thinking, và định dạng thời gian/ký tự.
- `[MODIFY]` `src/lib/features/chat/streamProtocol.ts` — Bổ sung trường tùy chọn (`status?: string`, `chars?: number`, `name?: string`) trên `ParsedSSEEvent["data"]`, `streamActivity?: StreamActivity` trên `ChatFrontendMessage["meta"]`, và helper `clearStreamRuntimeState` giúp thu gọn `useChatStreamExecution.ts` (~360 dòng).
- `[MODIFY]` `src/lib/features/chat/streamProtocol.test.ts` — Kiểm thử parse sự kiện meta mới (`codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`).
- `[MODIFY]` `src/app/features/chat/components/hooks/chatStreamHookTypes.ts` — Thêm `setStreamingActivity` vào `UseChatStreamReaderParams`, `UseChatPartialPersistenceParams`, `UseChatStreamExecutionParams`.
- `[MODIFY]` `src/app/features/chat/components/hooks/useThinkingStats.ts` — Reset `endedAtRef.current = null` khi `markThinking` chạy lại sau `markAnswer` (hỗ trợ interleaved thinking).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamReader.ts` — Xử lý `codeExecutionStatus`, `webSearchStatus`, `webFetchStatus`, `functionCall`, `localQueue`, `localPromptProgress` qua `reduceStreamActivityFromMeta`; cập nhật hoạt động khi nhận `thinking` (kể cả interleaved) và `token` (throttle `updatedAt` mỗi 2s) (~270 dòng).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatPartialPersistence.ts` — Xóa `setStreamingActivity(null)` khi hoàn tất/hủy stream (~325 dòng).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamExecution.ts` — Khởi tạo `createInitialStreamActivity()` khi bắt đầu stream và xóa qua `clearStreamRuntimeState` khi hủy/reset, tái cấu trúc gọn xuống **~290 dòng** (`<= 350` sau Prettier).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamController.ts` — Thêm state `streamingActivity` và xuất trả cho view (~312 dòng, `<= 350`).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatStreamController.test.ts` — Kiểm thử `streamingActivity` qua chuỗi `codeExecutionStatus` (writing/running/done), `webSearchStatus`, `functionCall`, và interleaved thinking.
- `[NEW]` `src/app/features/chat/components/StreamingActivityBar.tsx` — Thanh trạng thái streaming `React.memo` cô lập đồng hồ 1s `tabular-nums`, bộ phát hiện im lặng 8s (`stillWorking`), shimmer GPU, và icon Lucide theo giai đoạn (~150 dòng).
- `[NEW]` `src/app/features/chat/components/StreamingActivityBar.test.tsx` — Unit tests cho từng phase, đếm ngược 8s quiet-stream bằng fake timers, `reduced-motion`, và `chars` counter.
- `[MODIFY]` `src/app/features/chat/components/BubbleMarkdown.tsx` — Xóa `<TypingCursor />` orphan sau `<ReactMarkdown>`, thêm prop `showInlineCursor?: boolean` gắn class `.chat-markdown-streaming`, và cung cấp `BubbleStreamingContext` nhẹ cho `SmartCode`.
- `[MODIFY]` `src/app/features/chat/components/SmartCode.tsx` — Hiển thị chỉ báo live nhẹ trên tiêu đề khối mã khi đang stream qua `useContext(BubbleStreamingContext)` (~205 dòng).
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.tsx` — Nhận `streamingActivity` qua `message.meta.streamActivity`, kích hoạt `isStreamThinking` khi interleaved thinking, bỏ logic lặp `typingStatusText` sang helper, render `<StreamingActivityBar />` dưới nội dung, cập nhật `React.memo` comparator (~475 dòng, `<= 500`).
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.test.tsx` — Kiểm thử không còn orphan cursor block, render `StreamingActivityBar` theo phase, và interleaved thinking.
- `[MODIFY]` `src/app/features/chat/components/ChatMessagesArea.tsx` — Truyền `streamingActivity` vào `meta.streamActivity` của Active Streaming Bubble và cho phép hiển thị bubble khi `Boolean(streamingActivity)` (~345 dòng).
- `[MODIFY]` `src/app/features/chat/components/ChatConversationView.tsx` — Truyền `streamingActivity={chat.streamingActivity}` sang `ChatMessagesArea`.
- `[MODIFY]` `src/app/styles/themes/_shared/animations.css` — Thêm `@keyframes vikini-shimmer`, `@utility animate-vikini-shimmer`, `@keyframes vikini-stream-dot` và quy tắc `@media (prefers-reduced-motion: reduce)`.
- `[MODIFY]` `src/app/styles/themes/_shared/utilities.css` — Thêm `.chat-markdown-streaming` inline-end dot trên phần tử cuối (`p`, `li`, `blockquote > p`) và guard reduced-motion.

#### Workstream 2 — File & Image Upload UI + Animation Overhaul (5 Surfaces)

- `[MODIFY]` `src/types/files.ts` — Thêm `previewUrl?: string` vào `FileUploadProgress`.
- `[NEW]` `src/lib/features/files/uploadPresentation.ts` — Các helper thuần: `sortComposerFiles`, `mergeUploadedFileOptimistically`, `filterVisibleUploadQueue`, `createSafeObjectUrl`, `revokeSafeObjectUrl`, `formatFileUploadError`, `formatRelativeFileDate`, `getStableFileKey`, `validateReferenceImages` (~180 dòng).
- `[NEW]` `src/lib/features/files/uploadPresentation.test.ts` — Unit tests co-located cho toàn bộ helper trên.
- `[MODIFY]` `src/lib/features/files/store.ts` — Bổ sung `renderKeyByFileId`, `localPreviewByFileId`, `recentlyCompletedAt`, `enqueueFiles`, `completeUpload`, `releaseFileMetadata`, `clearRecentlyCompleted`, và thu hồi `objectURL` an toàn khi xóa/dọn hàng đợi (~145 dòng).
- `[NEW]` `src/lib/features/files/store.test.ts` — Unit tests co-located cho atomic `completeUpload`, chuyển giao `previewUrl`, và `URL.revokeObjectURL` khi remove/clear.
- `[MODIFY]` `src/lib/features/files/fileUploadHelpers.ts` — Chuyển `activeXhrs` sang `Map<string, XMLHttpRequest>` theo `tempId` và thêm callback `onProcessing` khi `xhr.upload` đạt 100% / `xhr.upload.onload` (~280 dòng).
- `[MODIFY]` `src/lib/features/files/fileUploadHelpers.test.ts` — Bổ sung tests cho `onProcessing` và hủy XHR theo `tempId`.
- `[MODIFY]` `src/lib/features/files/useFileUpload.ts` — Sửa `isUploading` (`queued | uploading | processing`), xếp toàn bộ tệp hợp lệ thành `"queued"` ngay lập tức kèm `previewUrl`, xử lý `onProcessing`, chuyển trạng thái đồng bộ không delay 800ms bằng `completeUpload` + `onUploadComplete`, và xuất `cancelUpload` / `dismissUploadError` (~320 dòng).
- `[MODIFY]` `src/lib/features/files/useFileUpload.test.ts` — Bổ sung tests cho upfront queueing, `processing` phase, per-file cancel (chỉ hủy đúng 1 tệp), atomic handoff 0ms (không có 800ms ghost), và `URL.revokeObjectURL`.
- `[MODIFY]` `src/app/features/chat/components/FilePreviewCard.tsx` — Hiển thị ngay `previewUrl` cho ảnh đang tải & mới tải xong (`ImageThumbnail` nhận `initialSrc`), giai đoạn `queued`/`uploading`/`processing`/`justCompleted`/`error`, nút hủy từng tệp và đóng lỗi, `snap-start`, `active:scale-[0.97]`, và sửa kẹt `deleting` spinner bằng `try/finally` + `mountedRef` (~295 dòng).
- `[NEW]` `src/app/features/chat/components/FilePreviewCard.test.tsx` — Unit tests cho chuyển đổi tại chỗ (cùng instance DOM), `initialSrc` không fetch thừa, `processing` shimmer, hủy từng tệp, và nhả spinner khi `onRemove` lỗi.
- `[MODIFY]` `src/app/features/chat/components/FilePreviewArea.tsx` — Giữ wrapper ổn định với `<AnimatePresence>` (mở/đóng mượt, khắc phục 0px dropzone khi trống bằng `min-h-[88px]`), khóa thẻ bằng `renderKeyByFileId[file.id] ?? file.id`, chống trùng queue/files, dọn `clearTimerRef`, và sửa token legacy (~185 dòng).
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx` — Nâng cấp `composer-stream-line` sang GPU shimmer, sửa `isReady` (`!disabled && !isUploading`), bỏ khóa `FilePreviewArea`/`+` khi đang upload, sắp xếp `files` tăng dần qua `sortComposerFiles`, dùng `mergeUploadedFileOptimistically`, gọi `releaseFileMetadata` khi xóa tệp, bỏ `scale-[1.02]` khi kéo-thả, nối `onNavigate={setLightboxFile}` cho `FileLightbox`, và truyền `onCancelUpload`/`onDismissError` (~460 dòng, `<= 500`).
- `[MODIFY]` `src/app/features/chat/components/InputForm.test.tsx` — Bổ sung tests cho `isReady` khi `isUploading=true` / `disabled=true`, giữ nguyên test `composer-stream-line`, và xác minh `onNavigate` được truyền sang `FileLightbox`.
- `[MODIFY]` `src/app/features/chat/components/FileLightbox.tsx` — Chặn render mũi tên Prev/Next khi thiếu `onNavigate` (`hasPrev = Boolean(onNavigate) && ...`).
- `[MODIFY]` `src/app/features/chat/components/FileLightbox.test.tsx` — Bổ sung Negative Probe: không render nút Prev/Next khi `onNavigate` vắng mặt dù `files.length > 1`.
- `[MODIFY]` `src/app/features/chat/components/FileInMessage.tsx` — Nâng cấp thumbnail ảnh 28×28px (ưu tiên `localPreviewByFileId` rồi lazy signed URL), sửa token CSS legacy, thêm `focus-visible` & `active:scale-[0.97]` (~105 dòng).
- `[MODIFY]` `src/app/features/chat/components/FileManagerPanel.tsx` — Chuyển sang Radix `<PopoverContent>` portaled, loại bỏ 100% legacy `var(--...)` & ngày tiếng Anh cứng, thêm thumbnail ảnh + mở `FileLightbox` + hiển thị `uploadQueue` trực tiếp (~255 dòng).
- `[MODIFY]` `src/app/features/chat/components/ComposerLeadingControls.tsx` — Bọc `FilesChip` bằng Radix `<Popover>` + `<PopoverTrigger asChild>` quanh `<ComposerChip>`.
- `[NEW]` `src/app/features/chat/components/FileManagerPanel.test.tsx` — Kiểm thử portal Radix Popover, ngày song ngữ, thumbnail + lightbox, và hiển thị hàng đợi đang tải.
- `[NEW]` `src/lib/features/projects/knowledgeUploadHelpers.ts` — `validateKnowledgeFile`, `sendKnowledgeUploadXhr` (tiến độ `onProgress` + `onProcessing` + chuẩn hóa lỗi 413/JSON + `AbortSignal`) (~130 dòng).
- `[NEW]` `src/lib/features/projects/knowledgeUploadHelpers.test.ts` — Unit tests co-located cho validate, XHR progress -> processing, 413, JSON nested error, và abort.
- `[MODIFY]` `src/components/features/projects/KnowledgePanel.tsx` — Kéo-thả với `dragDepthRef`, `multiple`, hàng tải lên lạc quan (progress -> shimmer `kbProcessing`), Framer Motion `AnimatePresence`, thanh dung lượng GPU `scaleX`, và xóa chuỗi cứng (~380 dòng).
- `[MODIFY]` `src/components/features/projects/KnowledgePanel.test.tsx` — Bổ sung tests cho drag-and-drop nhiều tệp, từ chối định dạng/dung lượng sai, và hàng đang xử lý.
- `[MODIFY]` `src/app/projects/[id]/page.tsx` — Nối `sendKnowledgeUploadXhr` trong `handleUpload` (giữ `Promise.all([fetchDocuments(), fetchProjects()])`) và thay chuỗi cứng bằng `t(...)` (~375 dòng).
- `[MODIFY]` `src/components/features/projects/ProjectSettingsModal.tsx` — Nối `sendKnowledgeUploadXhr` trong `handleUpload` (giữ `Promise.all([fetchDocuments(), fetchProjects()])`) và thay chuỗi cứng bằng `t(...)` (~375 dòng).
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

#### 6.2. Client Stream Activity State & Isolated Timer (`useChatStreamReader` ➔ `ChatBubble` ➔ `StreamingActivityBar`)

```typescript
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

// Inside useChatStreamReader.ts:
// - meta event:
const nextActivity = reduceStreamActivityFromMeta(activityRef.current, data);
if (nextActivity !== undefined) {
  activityRef.current = nextActivity;
  setStreamingActivity(nextActivity);
}
// - thinking event (including interleaved after first text token):
const nextThinkingActivity = reduceStreamActivityOnThinking(activityRef.current);
activityRef.current = nextThinkingActivity;
setStreamingActivity(nextThinkingActivity);

// Inside ChatBubble.tsx:
<BubbleMarkdown
  content={deferredDisplayContent}
  isBot={isBot}
  isStreaming={isStreaming}
  isLastAssistant={isLastAssistant}
  showInlineCursor={isStreaming && isLastAssistant && streamActivity?.phase === "responding"}
/>
{isBot && isStreaming && isLastAssistant && (
  <StreamingActivityBar
    activity={streamActivity}
    isStreaming={true}
    hasDisplayContent={Boolean(displayContent.trim())}
  />
)}
```

#### 6.3. Atomic Same-Key Upload Handoff (`useFileUpload` + `useFileStore` ➔ `FilePreviewArea` ➔ `FilePreviewCard`)

```typescript
// Upfront queueing inside src/lib/features/files/useFileUpload.ts:
const queuedItems = validFiles.map((file) => {
  const kind = classifyClientSide(ext, file.type);
  return {
    tempId: crypto.randomUUID(),
    file,
    filename: file.name,
    size: file.size,
    kind,
    progress: 0,
    status: "queued" as const,
    previewUrl: kind === "image" ? createSafeObjectUrl(file) : undefined,
  };
});
useFileStore.getState().enqueueFiles(queuedItems);

// Per-file XHR lifecycle:
await sendFileUploadXhr({
  tempId,
  file,
  conversationId: targetConvId,
  activeXhrs: activeXhrsRef.current, // Map<string, XMLHttpRequest>
  onProgress: (pct) => useFileStore.getState().updateProgress(tempId, pct),
  onProcessing: () => useFileStore.getState().setStatus(tempId, "processing"),
  onSuccess: (uploadedFile) => {
    if (uploadedFile && !isUnmountedRef.current) {
      // Single-tick atomic handoff: ZERO 800ms ghost, ZERO duplicate card!
      useFileStore.getState().completeUpload(tempId, uploadedFile);
      onUploadCompleteRef.current?.(uploadedFile);
    } else {
      useFileStore.getState().removeFromQueue(tempId);
    }
  },
});

// Inside src/app/features/chat/components/FilePreviewArea.tsx:
// Same React key across queued -> uploading -> processing -> ready!
{files.map((file) => (
  <FilePreviewCard
    key={renderKeyByFileId[file.id] ?? file.id}
    file={file}
    localPreviewUrl={localPreviewByFileId[file.id]}
    justCompleted={Boolean(recentlyCompletedAt[file.id])}
    onRemove={onRemoveFile}
    onClick={onClickFile}
    disabled={disabled}
  />
))}
{visibleQueue.map((upload, idx) => (
  <FilePreviewCard
    key={upload.tempId}
    upload={upload}
    staggerIndex={idx}
    onCancelUpload={onCancelUpload}
    onDismissError={onDismissError}
  />
))}
```

#### 6.4. Knowledge Base Staged XHR Upload (`KnowledgePanel` ➔ `sendKnowledgeUploadXhr`)

```typescript
// Inside src/lib/features/projects/knowledgeUploadHelpers.ts
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
```

#### 6.5. Adversarial Timelines (Concurrency, TOCTOU, Cleanup & Serverless)

```text
Cơ chế: Anthropic Server Tool Input Accumulation & Idle Timeout
T1: Claude phát server_tool_use (code_execution) + 500 chunk input_json_delta (25KB Python)
T2: Tiếp theo sandbox chạy 110 giây không phát chunk (hoặc client ấn Stop giữa chừng)
T3: activeBlock chỉ đếm inputChars (0 tích trữ chuỗi lớn), phát meta writing mỗi >=500ms,
    chuyển sang running tại content_block_stop, idleTimeoutMs=150s (hoặc 300s deep thinking)
    giữ luồng sống; nếu client ấn Stop, ac.abort() + withIdleTimeout finally đóng iterator và savePartialOnce() lưu an toàn.
Kết cục: Không rò rỉ bộ nhớ, không ngắt sớm 90s, dọn tài nguyên sạch -> An toàn

Cơ chế: Atomic Same-Key Upload Handoff + SWR Revalidation Race (Surface A)
T1: Người dùng kéo 2 ảnh A, B vào composer (đã có tệp X) -> enqueueFiles đặt A, B ở bên phải X với status "queued"
T2: Ảnh A hoàn tất XHR; cùng lúc SWR revalidate trả về GET /api/files sắp xếp created_at DESC ([A, X])
T3: completeUpload(tempIdA, fileA) gán renderKeyByFileId[fileA.id] = tempIdA và chuyển giao previewUrlA trong 1 tick;
    InputForm gọi mutate(mergeUploadedFileOptimistically) và sortComposerFiles ép thứ tự tăng dần ([X, A]),
    đồng thời filterVisibleUploadQueue chặn trùng nếu có bất kỳ độ trễ render nào.
Kết cục: React giữ nguyên DOM node của thẻ A ở đúng vị trí bên phải X, ảnh hiển thị tức thì không nhấp nháy -> An toàn

Cơ chế: Per-File Cancel vs. Conversation Switch Cleanup & Blob URL Revocation
T1: Người dùng tải 3 ảnh (A đang upload, B/C đang queued) rồi bấm × hủy riêng ảnh A
T2: 500ms sau khi ảnh B đang upload, người dùng chuyển sang cuộc hội thoại khác (conv-1 -> conv-2)
T3: cancelUpload(tempIdA) chỉ abort XHR của A trong Map<tempId, XHR>, thu hồi blob URL của A, tiếp tục B;
    khi chuyển hội thoại, shouldClearQueue trả true -> cancelActiveUploads() hủy toàn bộ Map XHR + clearQueue() thu hồi
    100% blob URL còn lại trong uploadQueue & localPreviewByFileId (kể cả khi unmount).
Kết cục: Không rò rỉ XHR, không rò rỉ ObjectURL, không lỗi trạng thái giữa các hội thoại -> An toàn

Cơ chế: DescribeImageView Corrupt Image Decode & Rapid Re-Select
T1: Người dùng chọn tệp .png hỏng phần header -> bấm Phân tích -> API trả mô tả nhưng tạo thumbnail canvas gọi img.onerror
T2: Người dùng thoát trang ngay sau khi bấm Sao chép (trong cửa sổ 2000ms timeout)
T3: img.onerror resolve promise thumbnail an toàn (bỏ qua thumbnail thay vì treo vô hạn) -> finally luôn đặt analyzing=false;
    copyTimeoutRef được clearTimeout trong unmount cleanup.
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

- [ ] **Bước 3.1**: Tạo `src/lib/features/chat/streamActivity.ts` và `src/lib/features/chat/streamActivity.test.ts`. Cập nhật `src/lib/features/chat/streamProtocol.ts` (mở rộng `ParsedSSEEvent["data"]`, `ChatFrontendMessage["meta"]`, thêm `clearStreamRuntimeState`) và `src/lib/features/chat/streamProtocol.test.ts`.
- [ ] **Bước 3.2**: Cập nhật `useThinkingStats.ts` (reset `endedAtRef` cho interleaved thinking), `chatStreamHookTypes.ts`, `useChatStreamReader.ts`, `useChatPartialPersistence.ts`, `useChatStreamExecution.ts` (đảm bảo `<= 320` dòng sau Prettier), và `useChatStreamController.ts` + cập nhật `useChatStreamController.test.ts`.
- [ ] **Bước 3.3**: Tạo `src/app/features/chat/components/StreamingActivityBar.tsx` và `src/app/features/chat/components/StreamingActivityBar.test.tsx`.
- [ ] **Bước 3.4**: Cập nhật `BubbleMarkdown.tsx` (xóa `<TypingCursor />`, thêm `.chat-markdown-streaming` + `BubbleStreamingContext`), `SmartCode.tsx` (chỉ báo live nhẹ), `ChatBubble.tsx` (giữ `<= 485` dòng), `ChatMessagesArea.tsx`, `ChatConversationView.tsx` + cập nhật `ChatBubble.test.tsx`.

#### Giai đoạn 4 — Workstream 2: Surface A (Chat Composer) & Surface B (Files Popover)

- [ ] **Bước 4.1**: Cập nhật `src/types/files.ts`, tạo `src/lib/features/files/uploadPresentation.ts` + `src/lib/features/files/uploadPresentation.test.ts`.
- [ ] **Bước 4.2**: Nâng cấp `src/lib/features/files/store.ts` (`renderKeyByFileId`, `localPreviewByFileId`, `recentlyCompletedAt`, `enqueueFiles`, `completeUpload`, `releaseFileMetadata`, revoke blob URLs) + tạo `src/lib/features/files/store.test.ts`.
- [ ] **Bước 4.3**: Cập nhật `src/lib/features/files/fileUploadHelpers.ts` (`Map<string, XMLHttpRequest>`, `onProcessing`) + `src/lib/features/files/fileUploadHelpers.test.ts`, và `src/lib/features/files/useFileUpload.ts` (upfront queueing, atomic handoff không delay 800ms, `cancelUpload`/`dismissUploadError`, sửa `isUploading`) + `src/lib/features/files/useFileUpload.test.ts`.
- [ ] **Bước 4.4**: Nâng cấp `FilePreviewCard.tsx` (+ tạo `FilePreviewCard.test.tsx`), `FilePreviewArea.tsx`, `InputForm.tsx` (bao gồm `composer-stream-line` GPU shimmer, `isReady`, `sortComposerFiles`, `onNavigate`, bỏ khóa thừa) + `InputForm.test.tsx`, `FileLightbox.tsx` + `FileLightbox.test.tsx`, và `FileInMessage.tsx`.
- [ ] **Bước 4.5**: Nâng cấp `ComposerLeadingControls.tsx` + `FileManagerPanel.tsx` (Radix `<Popover>` portaled, song ngữ, v4 tokens, thumbnail + lightbox, live queue) + tạo `FileManagerPanel.test.tsx`.

#### Giai đoạn 5 — Workstream 2: Surfaces C, D, E

- [ ] **Bước 5.1**: Tạo `src/lib/features/projects/knowledgeUploadHelpers.ts` + `src/lib/features/projects/knowledgeUploadHelpers.test.ts`. Nâng cấp `KnowledgePanel.tsx`, `src/app/projects/[id]/page.tsx`, và `ProjectSettingsModal.tsx` + cập nhật `KnowledgePanel.test.tsx`.
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

| ID         | Thành phần / Luồng                                                | Input / Kịch bản                                                                                                                                                                                                                                         | Expected Output / Hành vi bắt buộc                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Failure Mode / Boundary Condition                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TC-SU-01` | `anthropic-tool-helpers` & `anthropic-stream`                     | Chuỗi chunk Anthropic: `server_tool_use` (`code_execution`) ➔ 10 `input_json_delta` ➔ `content_block_stop` ➔ `code_execution_tool_result` (`content: { type: "code_execution_result", stdout: "OK\n", stderr: "", return_code: 0 }`)                     | Phát `meta` `codeExecutionStatus` với `status: "writing"` (có `chars` throttled), `status: "running"` khi stop, phát `token` chứa `OK`, và `status: "done"`.                                                                                                                                                                                                                                                                                                                          | **NP-1**: `code_execution_tool_result` chứa `BetaCodeExecutionToolResultError` (`error_code: "execution_time_exceeded"`) không crash, vẫn phát thông báo lỗi gọn + `status: "done"`. Sau `server_tool_use`, một `tool_use` (`get_current_time`) kế tiếp nhận JSON sạch, **không** dính rác `partial_json` từ block trước. |
| `TC-SU-02` | `streaming/utils.ts` (`getStreamTimeout`)                         | `model = "claude-sonnet-4-5"`, `thinkingLevel = "off"` và `"high"`                                                                                                                                                                                       | Trả về `300000` (5 phút) khi off và `600000` (10 phút) khi `"high"`; `gemini-4-argon` vẫn `900000`; model lạ vẫn `180000`.                                                                                                                                                                                                                                                                                                                                                            | Khi `process.env.STREAM_TIMEOUT_MS = "45000"`, biến môi trường luôn ưu tiên trả `45000`.                                                                                                                                                                                                                                  |
| `TC-SU-03` | `streamActivity.ts` & `useChatStreamController`                   | Nhận tuần tự: `thinking` ➔ `token` ("Intro") ➔ `meta` `codeExecutionStatus` (`writing`, `chars: 420`) ➔ `running` ➔ `done` ➔ `thinking` (interleaved!) ➔ `token` ("Final")                                                                               | `streamingActivity.phase` chuyển chính xác: `thinking` ➔ `responding` ➔ `code_writing` (`chars: 420`) ➔ `code_running` ➔ `responding` ➔ `thinking` (interleaved làm `thinkingStats.live = true` trở lại) ➔ `responding`. Kết thúc stream: `streamingActivity === null`.                                                                                                                                                                                                               | **NP-2**: Frame `meta` malformed hoặc `chars: NaN` / `position: "bad"` không crash và không ghi đè trạng thái hợp lệ.                                                                                                                                                                                                     |
| `TC-SU-04` | `StreamingActivityBar` & `BubbleMarkdown` & `ChatBubble`          | Render assistant message đang stream: (a) đang `code_writing` (`chars: 1250`), (b) đang `responding` bình thường, (c) `responding` im lặng 9 giây (fake timers).                                                                                         | (a) Hiện `Code2` + `streamActivityWritingCode` + `1.3K` + bộ đếm thời gian `tabular-nums`, **không** hiện orphan `<TypingCursor />`; (b) `.chat-markdown-streaming` bật trên container, **0** phần tử `<TypingCursor />` ngoài `<ReactMarkdown>`; (c) sau `>= 8000ms` tự hiện `streamActivityStillWorking`.                                                                                                                                                                           | Khi `isStreaming = false`, `StreamingActivityBar` không render (`null`) và interval 1s bị hủy hoàn toàn (0 tick sau unmount).                                                                                                                                                                                             |
| `TC-SU-05` | `store.ts` & `useFileUpload` & `uploadPresentation`               | Kéo 2 ảnh (A, B) vào hội thoại đã có tệp X (`created_at` cũ hơn). Giả lập `xhr.upload.onprogress` 50% ➔ 100% ➔ `xhr.onload` 200 cho A trong khi B vẫn `queued`.                                                                                          | Cả A và B vào `uploadQueue` ngay lập tức (`queued`) kèm `previewUrl` (blob URL). Khi A đạt 100% upload bytes, trạng thái A chuyển sang `"processing"` trước `onload`. Khi A `onload` 200: **trong cùng 1 tick** (không đợi 800ms), A rời `uploadQueue`, `renderKeyByFileId[A.id] === tempIdA`, `localPreviewByFileId[A.id] === previewUrlA`, `recentlyCompletedAt[A.id]` được ghi, và `sortComposerFiles([A, X])` giữ thứ tự `[X, A]`.                                                | **NP-3**: Bấm `cancelUpload(tempIdA)` khi A đang chạy chỉ gọi `xhrA.abort()`, thu hồi blob URL của A, **không** hủy B đang `queued`. Chuyển hội thoại (`conv-1 -> conv-2`) hủy mọi XHR và gọi `URL.revokeObjectURL` cho toàn bộ blob URL.                                                                                 |
| `TC-SU-06` | `FilePreviewCard`, `FilePreviewArea`, `InputForm`, `FileLightbox` | (a) Render `FilePreviewCard` chuyển từ `{ upload }` sang `{ file, localPreviewUrl, justCompleted: true }` với cùng `key`; (b) `onRemove` reject; (c) `InputForm` với `isUploading=true`, `disabled=false`; (d) `FileLightbox` không truyền `onNavigate`. | (a) Không gọi `fetch("/api/files/.../url")` khi có `localPreviewUrl`, hiển thị ngay ảnh local; (b) `deleting` spinner tự tắt nhờ `finally`; (c) Nút Send bị disable (`isReady === false`), nhưng nút `+` và nút xóa tệp đã up vẫn dùng được; `composer-stream-line` giữ `aria-hidden="true"`, `bg-(--accent)`, `motion-reduce:animate-none`; (d) **NP-4**: `FileLightbox` không render nút Prev/Next khi thiếu `onNavigate`; `InputForm` truyền `onNavigate` nên Prev/Next hoạt động. | Khi `!hasContent && isDragging` trên `FilePreviewArea`, dropzone render với class `min-h-[88px]` (không sụp 0px).                                                                                                                                                                                                         |
| `TC-SU-07` | `FileManagerPanel` & `ComposerLeadingControls`                    | Mở popover Tệp từ chip `Tệp (2)`                                                                                                                                                                                                                         | Render qua Radix `<PopoverContent>` portaled vào `document.body` (không còn `absolute bottom-full right-0`), thời gian tương đối dùng khóa `relativeTime*` (0 chuỗi tiếng Anh cứng `"just now"`/`"m ago"`), 0 token legacy `var(--...)`, hiện thumbnail ảnh & click mở `FileLightbox`.                                                                                                                                                                                                | Nhấn `Escape` đóng popover; xóa tệp thất bại hiển thị `toast.error` và tắt spinner.                                                                                                                                                                                                                                       |
| `TC-SU-08` | `knowledgeUploadHelpers` & `KnowledgePanel`                       | Kéo thả 2 tệp hợp lệ (`.md`, `.pdf`) + 1 tệp không hỗ trợ (`.exe`) vào `KnowledgePanel`                                                                                                                                                                  | `.exe` bị chặn kèm `toast.error(t("kbUnsupportedFileType"))`; 2 tệp hợp lệ hiện hàng lạc quan chuyển `uploading %` ➔ `processing` (`kbProcessing`); thành công gọi cả `fetchDocuments()` và `fetchProjects()`.                                                                                                                                                                                                                                                                        | **NP-5**: HTTP `413` ném thông báo `serverPayloadTooLarge`; lỗi JSON `{ error: { message: "..." } }` trích đúng chuỗi (không `[object Object]`); tệp `> 4MB` bị chặn trước khi mở XHR.                                                                                                                                    |
| `TC-SU-09` | `ControlPanelReferenceImages`                                     | Thêm 3 ảnh, xóa ảnh #1, thả tệp `.txt` và tệp `> 10MB`                                                                                                                                                                                                   | Tạo `objectURL` ổn định (không `FileReader`), thu hồi `URL.revokeObjectURL` đúng ảnh bị xóa và toàn bộ khi unmount; nút xóa có `opacity-100 md:opacity-0`; tệp sai loại/quá 10MB gọi `toast.error`; vượt quá 4 ảnh hiện `toast.info`.                                                                                                                                                                                                                                                 | Không dùng `key={idx}` trên danh sách preview.                                                                                                                                                                                                                                                                            |
| `TC-SU-10` | `DescribeImageView` & `TemplateModal`                             | (a) `DescribeImageView`: chọn cùng 1 tệp 2 lần, giả lập `FileReader.onerror` và `img.onerror` khi tạo thumbnail; (b) `TemplateModal`: chọn tệp `.pdf` hoặc ảnh `> 10MB`, hoặc kéo thả ảnh `.png` hợp lệ.                                                 | (a) `input.value` reset về `""`; `reader.onerror` gọi `toast.error(t("describeReadFailed"))`; `img.onerror` vẫn cho `analyzing` về `false` và giữ kết quả mô tả; (b) `TemplateModal` gọi `toast.error` cho tệp sai loại/quá 10MB và gọi `onChoosePhoto` khi thả ảnh hợp lệ.                                                                                                                                                                                                           | Unmount `DescribeImageView` trong lúc `copied=true` dọn sạch `copyTimeoutRef`.                                                                                                                                                                                                                                            |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Danh sách tệp test co-located (21 suites)

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
11. `src/lib/features/files/fileUploadHelpers.test.ts` (cập nhật — `TC-SU-05`)
12. `src/lib/features/files/useFileUpload.test.ts` (cập nhật — `TC-SU-05`, `NP-3`)
13. `src/app/features/chat/components/FilePreviewCard.test.tsx` (mới — `TC-SU-06`)
14. `src/app/features/chat/components/InputForm.test.tsx` (cập nhật — `TC-SU-06`)
15. `src/app/features/chat/components/FileLightbox.test.tsx` (cập nhật — `TC-SU-06`, `NP-4`)
16. `src/app/features/chat/components/FileManagerPanel.test.tsx` (mới — `TC-SU-07`)
17. `src/lib/features/projects/knowledgeUploadHelpers.test.ts` (mới — `TC-SU-08`, `NP-5`)
18. `src/components/features/projects/KnowledgePanel.test.tsx` (cập nhật — `TC-SU-08`)
19. `src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx` (mới — `TC-SU-09`)
20. `src/app/features/image-gen/components/DescribeImageView.test.tsx` (cập nhật — `TC-SU-10`)
21. `src/app/features/image-gen/components/TemplateModal.test.tsx` (mới — `TC-SU-10`)

#### Lệnh kiểm chứng (Windows PowerShell 5.1 — dùng `;`, KHÔNG dùng `&&`)

```powershell
# 1. Kiểm tra format Prettier trước để chống trượt giới hạn dòng TC-13 lúc commit
npx prettier --check src/app/api/chat-stream/streaming/ src/lib/features/chat/ src/lib/features/files/ src/lib/features/projects/ src/app/features/chat/components/ src/components/features/projects/ src/app/projects/ src/app/features/image-gen/components/ src/lib/utils/translations/

# 2. Chạy tập trung các suite mới/đã sửa + bộ chốt chặn tĩnh TC-13 / TC-14
npx vitest run --reporter=dot src/app/api/chat-stream/streaming/anthropic-tool-helpers.test.ts src/app/api/chat-stream/streaming/anthropic-stream.test.ts src/app/api/chat-stream/streaming/utils.test.ts src/lib/features/chat/streamActivity.test.ts src/lib/features/chat/streamProtocol.test.ts src/app/features/chat/components/hooks/useChatStreamController.test.ts src/app/features/chat/components/StreamingActivityBar.test.tsx src/app/features/chat/components/ChatBubble.test.tsx src/lib/features/files/ src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/FilePreviewCard.test.tsx src/app/features/chat/components/FileLightbox.test.tsx src/app/features/chat/components/FileManagerPanel.test.tsx src/app/features/chat/components/ComposerLeadingControls.test.tsx src/lib/features/projects/knowledgeUploadHelpers.test.ts src/components/features/projects/KnowledgePanel.test.tsx src/app/features/image-gen/components/ControlPanelReferenceImages.test.tsx src/app/features/image-gen/components/DescribeImageView.test.tsx src/app/features/image-gen/components/TemplateModal.test.tsx src/lib/config/theme-config.test.ts

# 3. Full Verification Gate (Tier 2)
npm run type-check; npm run lint; npm run test:run
```

#### Wiring Probes (WP) & Negative Probes (NP)

- **WP-1 (Static Guards Baseline)**: `npx vitest run src/lib/config/theme-config.test.ts` xác nhận mọi file sửa đổi vượt qua `TC-13` (hook `<= 350L`, 0 `transition-all`, 0 dead hover, 0 lucide namespace) và `TC-14` (0 unscoped `use*Store()`).
- **WP-2 (ESLint Legacy Token & Exhaustive-Deps Wiring)**: `npx eslint --print-config src/app/features/chat/components/FileManagerPanel.tsx` xác nhận rule `vikini-design/no-legacy-tokens` và `react-hooks/exhaustive-deps` đang ở mức `error`, và `npm run lint` ra 0 errors / 0 warnings.
- **WP-3 (Translation Key Parity)**: `npm run type-check` kiểm chứng compile-time assertion giữa `vi.ts` và `en.ts` trong `src/lib/utils/translations/index.ts`.
- **NP-1 (Anthropic Tool Error & Isolation Probe)**: Test trong `src/app/api/chat-stream/streaming/anthropic-tool-helpers.test.ts` nạp `server_tool_use` với 10KB `partial_json` + `code_execution_tool_result_error` theo sau bởi `tool_use` `get_current_time` — chứng minh 0 rò rỉ JSON và xử lý lỗi không crash.
- **NP-2 (Malformed SSE Meta Probe)**: Test trong `src/lib/features/chat/streamActivity.test.ts` gửi `{ type: "codeExecutionStatus", status: "unknown_phase", chars: NaN }` và `{ type: "localQueue", position: "abc" }` — chứng minh reducer trả `undefined` (giữ nguyên trạng thái hợp lệ).
- **NP-3 (Upload Abort & Blob Cleanup Probe)**: Test trong `src/lib/features/files/useFileUpload.test.ts` + `src/lib/features/files/store.test.ts` kiểm chứng hủy file A không làm hỏng file B đang `queued`, và chuyển hội thoại/unmount gọi `URL.revokeObjectURL` đúng số lượng blob đã tạo.
- **NP-4 (FileLightbox Missing `onNavigate` Probe)**: Test trong `src/app/features/chat/components/FileLightbox.test.tsx` truyền 2 files nhưng `onNavigate={undefined}` — chứng minh 0 nút Prev/Next bị render như nút chết.
- **NP-5 (Knowledge 413 & Unsupported Extension Probe)**: Test trong `src/lib/features/projects/knowledgeUploadHelpers.test.ts` & `src/components/features/projects/KnowledgePanel.test.tsx` gửi tệp `.exe`, tệp `> 4MB`, và phản hồi server `413` / `{ error: { message: "..." } }` — chứng minh chặn đúng đầu vào vi phạm và không tạo `[object Object]`.

#### Visual QA Gate (Bắt buộc cho thay đổi UI/CSS — `.agents/rules/03-ui.md`)

1. Khởi chạy `npx next dev --webpack -H 127.0.0.1 -p 3100` (từ đường dẫn chuẩn chữ hoa ổ `C:\Users\wyemh\vikini` trên Windows theo `docs/lessons-learned.md:882`).
2. Dùng Playwright mock auth + SSE/API qua `page.route` để chụp ảnh `.png` vào thư mục tạm ngoài git ở cả **Desktop (`1440×900`)** và **Mobile (`375×812`)** × **Dark** & **Light** themes cho các trạng thái:
   - Chat đang stream với `StreamingActivityBar` (`Đang viết mã...`, `Đang chạy mã...`, `Vẫn đang xử lý...`) + `composer-stream-line` shimmer + xác nhận không có dấu `|` rơi dòng dưới đoạn văn.
   - Chat Composer đang upload ảnh (`queued` + `uploading 60%` + `processing` + `justCompleted`) + mở `FileManagerPanel` Popover trên Mobile `375px` (kiểm tra không cắt mép trái và `scrollWidth <= innerWidth`).
   - `/projects/[id]` Knowledge Base Panel (trạng thái kéo-thả + hàng đang lập chỉ mục).
   - `/images` Reference Images + `/describe` Describe Image dropzone.
3. Gọi `read_file` đọc trực tiếp từng ảnh `.png` để tự kiểm tra tương phản, căn lề, tràn khung, và không có khóa dịch thô. Dừng server và dọn sạch tệp tạm.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                                                                                                                                             | Mức độ         | Technical Control cụ thể (`[SRC]` / Negative Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1 — Prettier mở rộng mảng `deps` làm hook vượt trần 350 dòng (`TC-13`)** (`src/app/features/chat/components/hooks/useChatStreamExecution.ts` hiện 337L, `src/lib/features/files/useFileUpload.ts` 329L, `src/app/features/chat/components/ChatBubble.tsx` 498L) | **Cao**        | Trích xuất `clearStreamRuntimeState` vào `src/lib/features/chat/streamProtocol.ts` (kéo `useChatStreamExecution.ts` xuống ~290L), trích xuất `formatFileUploadError` + `sortComposerFiles` vào `src/lib/features/files/uploadPresentation.ts` (kéo `InputForm.tsx` xuống ~460L), tách `StreamingActivityBar.tsx` riêng (kéo `ChatBubble.tsx` xuống ~475L). Kiểm chứng bắt buộc qua `npx prettier --check` + `src/lib/config/theme-config.test.ts:453-460` (`WP-1`).                     |
| **R2 — Rò rỉ bộ nhớ `URL.createObjectURL` khi upload hủy / lỗi / chuyển chat / xóa ảnh**                                                                                                                                                                           | **Cao**        | Mọi blob URL được cấp qua `createSafeObjectUrl` và thu hồi tập trung trong `useFileStore` (`removeFromQueue`, `releaseFileMetadata`, `clearQueue`) cùng `useEffect` unmount cleanup tại `src/lib/features/files/useFileUpload.ts` và `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`. Kiểm chứng bằng `NP-3` (`store.test.ts` & `useFileUpload.test.ts` & `ControlPanelReferenceImages.test.tsx`).                                                              |
| **R3 — Re-render toàn cây chat mỗi 1 giây do đồng hồ `StreamingActivityBar` hoặc mỗi 15ms khi stream token**                                                                                                                                                       | **Cao**        | Cô lập `setInterval(1000)` hoàn toàn bên trong `React.memo(StreamingActivityBar)`; `src/app/features/chat/components/hooks/useChatStreamReader.ts` chỉ cập nhật `streamingActivity.updatedAt` trên `event: token` tối đa 1 lần mỗi 2000ms; mọi selector `useFileStore` đều atomic (`src/lib/config/theme-config.test.ts:510-524`, `TC-14`).                                                                                                                                             |
| **R4 — Trùng thẻ tạm hoặc sai thứ tự khi SWR revalidate `GET /api/files` (`created_at DESC`) đè mảng lạc quan**                                                                                                                                                    | **Trung bình** | Kết hợp 3 lớp phòng thủ: (1) `completeUpload` + `mutate(mergeUploadedFileOptimistically)` đồng bộ trong cùng tick (không còn `setTimeout(..., 800)` tại `src/lib/features/files/useFileUpload.ts:204`), (2) `sortComposerFiles` luôn ép thứ tự `created_at ASC` trong `src/app/features/chat/components/InputForm.tsx`, (3) `filterVisibleUploadQueue` lọc trùng tại `src/app/features/chat/components/FilePreviewArea.tsx`. Kiểm chứng bằng `TC-SU-05` & `uploadPresentation.test.ts`. |
| **R5 — Thay đổi `composer-stream-line` hoặc `FileManagerPanel` phá vỡ test hiện hữu (`src/app/features/chat/components/InputForm.test.tsx:424-437`, `src/app/features/chat/components/ComposerLeadingControls.test.tsx:40-42,199`)**                               | **Trung bình** | Giữ nguyên `data-testid="composer-stream-line"`, `aria-hidden="true"`, `bg-(--accent)`, `motion-reduce:animate-none` trên thanh shimmer bên trong `InputForm.tsx`; đặt `<PopoverTrigger asChild><ComposerChip /></PopoverTrigger>` trực tiếp trong `ComposerLeadingControls.tsx` để mock `FileManagerPanel` vẫn giữ nguyên nút `Tệp (3)`. Kiểm chứng bằng `WP-1` + chạy trực tiếp `InputForm.test.tsx` & `ComposerLeadingControls.test.tsx`.                                            |
| **R6 — Biến thể mới của Anthropic Code Execution block (`bash_code_execution_tool_result` hoặc `code_execution_tool_result_error`) không được nhận diện**                                                                                                          | **Trung bình** | `anthropic-tool-helpers.ts` đối chiếu trực tiếp schema `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:328-334,382-406`, hỗ trợ cả `code_execution_tool_result`, `bash_code_execution_tool_result`, fallback `code_execution_result`, và nhánh lỗi `*_error`. Kiểm chứng bằng `TC-SU-01` & `NP-1`.                                                                                                                                                                |
| **R7 — Knowledge Base upload quên làm mới thống kê dung lượng dự án (`document_count`, `storage_bytes`)**                                                                                                                                                          | **Trung bình** | Bảo toàn `await Promise.all([fetchDocuments(), fetchProjects()])` sau `sendKnowledgeUploadXhr` tại cả `src/app/projects/[id]/page.tsx:117` và `src/components/features/projects/ProjectSettingsModal.tsx:135` theo `docs/lessons-learned.md:366-371`. Kiểm chứng bằng `TC-SU-08`.                                                                                                                                                                                                       |

---

## Audit History

> _Chưa có lượt kiểm toán. Sẵn sàng chuyển tiếp cho Primary Reviewer (`@reviewer`) thực hiện `### Audit Run 1`._
