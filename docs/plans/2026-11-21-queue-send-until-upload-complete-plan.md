# Kế Hoạch Triển Khai: Tự Động Chờ Tải Tệp Xong Rồi Gửi Tin Nhắn (Queue-to-Send)

- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-21
- **Revision**: 3
- **Status**: Completed

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục Tiêu (Goal)

Giải quyết triệt để lỗi UX thực tế khi người dùng vừa tải ảnh/tệp lên vừa gõ lệnh và bấm `Enter` hoặc nút **Gửi** ngay lập tức trong Chat Composer (cả ở cuộc trò chuyện đã tồn tại lẫn **New Chat** `conversationId === null`), nâng cấp trải nghiệm đạt chuẩn Gemini / Claude / ChatGPT:

1. **Bít toàn bộ 3 lỗ hổng gốc khiến prompt bị gửi đi thiếu ảnh hoặc tạo hội thoại trùng**:
   - **Lỗ hổng 1 — Khoảng mù `ensureConversationId()` trên New Chat (`src/lib/features/files/useFileUpload.ts:161-186`)**: Hiện `uploadFiles` chờ `await ensureConversationIdRef.current()` (`300-800ms`) trước khi kiểm tra tệp và trước khi gọi `enqueueFiles(queuedItems)`. Trong suốt `300-800ms` đó `uploadQueue` rỗng ➔ `isUploading === false`, khiến người dùng nhấn `Enter` sẽ gửi prompt trơn đi thiếu ảnh và làm `useChatStreamExecution.coreSend` (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:137-159`) gọi `createConversation()` lần thứ hai tạo hội thoại trùng. **Khắc phục**: kiểm tra tệp, nạp `enqueueFiles(queuedItems)` + tạo ảnh xem trước **đồng bộ trước mọi `await`**, quản lý bộ đếm `preparingCountRef` / state `isPreparingUpload` (chỉ giảm khi `!isStale()`, reset về `0` trong `cancelActiveUploads`) để `isUploadBusy = isPreparingUpload || isUploading` luôn là `true` từ mili-giây `0`; nếu người dùng chuyển sang hội thoại khác giữa lúc `ensureConversationId()` đang chờ (`switchedAway`) hoặc `!targetConvId`, gọi `onSessionReset` / `onError` **trước** khi xóa `queuedItems` và hạ `isPreparingUpload`.
   - **Lỗ hổng 2 — Độ trễ SWR cache, lan truyền `conversationId` & HTTP 200 thiếu payload `file` (`src/app/features/chat/components/InputForm.tsx:103-126,217-220`, `src/lib/features/files/useFileUpload.ts:223-237`)**: Khi tệp cuối cùng hoàn tất XHR, `completeUpload` làm rỗng `uploadQueue` đồng bộ trước khi `useFiles(conversationId)` (SWR) hoặc prop `conversationId` trên New Chat (`null -> conv-new`) kịp re-render vào `InputForm` và `handleSend`; đồng thời `clearSentFileIds()` tại `src/app/features/chat/components/InputForm.tsx:218-220` chạy vô điều kiện có nguy cơ xóa ngược `markAsSent()`, và phản hồi HTTP 200 thiếu payload `file` (`uploadedFile === null`) hiện hạ `isUploadBusy` mà không báo lỗi. **Khắc phục**: theo dõi `recentCompletedIds` trong `usePendingUploadSend`, gộp đồng bộ qua `mergeDispatchFileIds`, chỉ flush khi `isPendingSendReadyToFlush` xác nhận đủ `!isUploadBusy`, `Boolean(input.trim())` và `currentConversationId === expectedConversationId`, chỉ gọi `clearSentFileIds()` trên chuyển hội thoại thực sự (không xóa khi `null -> conv-new` self-initiated), và fail-closed (`logger.error` + `onError`) khi `uploadedFile === null`.
   - **Lỗ hổng 3 — Chặn cứng / phớt lờ thao tác Gửi thay vì chờ gửi (`src/app/features/chat/components/InputForm.tsx:254-286,445-464`)**: Chuyển từ trạng thái khóa cứng nút Gửi khi đang tải lên sang cơ chế **Queue-to-Send (`isPendingSend`)** khi có nội dung prompt (`Boolean(input.trim())`): giữ nguyên nội dung prompt, cho phép nhấn `Enter` (desktop) hoặc click nút **Gửi** ngay lập tức để xếp hàng chờ gửi (lặp `Enter` là idempotent no-op; nút hành động chuyển sang `type="button"` kèm `onClick={onCancelPendingSend}` khi `isPendingSend && !isStreaming` để click-to-cancel không mâu thuẫn với double-Enter), hiển thị `<PendingUploadSendBanner />` kèm nút **Hủy gửi** và phím `Escape`, rồi tự động gửi kèm đầy đủ `fileIds` ngay khi toàn bộ tệp hoàn tất thành công.

2. **Xử lý sạch 100% nhánh lỗi, hủy, sửa đổi và chuyển ngữ cảnh (Zero Surprises)**:
   - Bất kỳ tệp nào tải lên thất bại (hoặc trả HTTP 200 thiếu `file`, hoặc `ensureConversationId` lỗi/rỗng) khi đang `isPendingSend` ➔ hủy `isPendingSend` **trước** khi hàng đợi cạn, giữ nguyên prompt, hiển thị duy nhất 1 `toast.info` song ngữ giải thích (không spam lặp nếu nhiều tệp lỗi).
   - Người dùng bấm **Hủy gửi**, click nút hành động đang xoay (`type="button"`), nhấn **`Escape`** (có guard `escapeDisabled={Boolean(lightboxFile)}` + IME + `!e.defaultPrevented`), **chỉnh sửa văn bản / chèn giọng nói / thay đổi `input` từ bên ngoài** (như `DashboardView` chọn gợi ý), **hủy một tệp đang tải (`×`)** hoặc **xóa tệp đã tải**, **chuyển hội thoại thực sự** (kể cả `null -> conv-existing` khi `ensureConversationId()` đang chờ, khác với thăng cấp tự khởi phát `null -> conv-new`), chuyển sang **Image Mode**, `disabled`/`isStreaming` bật lên, hoặc **unmount** ➔ hủy sạch `isPendingSend` và không bao giờ gửi nhầm hay gửi thiếu ảnh.
   - Người dùng thả/dán/chọn thêm tệp mới khi đang `isPendingSend` ➔ tiếp tục giữ chờ cho đến khi toàn bộ tệp mới cũng tải xong rồi mới gửi một lần với đầy đủ tệp.

3. **Tái cấu trúc bảo đảm trần dòng `TC-13` / `.agents/rules/01-coding.md:101-106` sau Prettier**:
   - `src/lib/features/files/useFileUpload.ts` hiện `340/350L` và `src/app/features/chat/components/InputForm.tsx` hiện `489/500L`. Tách cấu trúc rõ ràng trước khi thêm logic mới (`useGlobalFileDropPaste.ts`, gộp 1 selector `activeUploadCount` trong `useFileUpload.ts`; tách `useComposerFileActions.ts`, `usePendingUploadSend.ts`, `PendingUploadSendBanner.tsx`, `ComposerSubmitButton.tsx`, và helper thuần trong `uploadPresentation.ts`) để `useFileUpload.ts <= 330L` (`Hard Max 350L`) và `InputForm.tsx <= 455L` (`Hard Max 500L`) sau Prettier.

#### Out of Scope (What We're NOT Doing)

- **KHÔNG sửa** bất kỳ tệp nhạy cảm phía server/database/cấu hình nào: không chạm `*.server.ts`, `src/app/api/**`, SQL migrations, `next.config.ts`, `package.json`, hay `.agents/**`.
- **KHÔNG sửa** `src/app/features/chat/components/hooks/useChatStreamExecution.ts` hoặc `src/app/features/chat/components/hooks/useChatStreamController.ts`: bằng cách đợi đồng bộ `currentConversationId === expectedConversationId` trước khi gọi `onSubmit(mergedFileIds)`, `handleSend` hiện hữu đã có sẵn `selectedConversationId` chính xác mà không tăng blast radius sang luồng SSE stream.
- **KHÔNG sửa** luồng upload của các bề mặt không phải Chat Composer (Knowledge Base, Image Studio Reference Images, Describe Image, Template Modal).
- **KHÔNG thay đổi** cơ chế bỏ qua tin nhắn rỗng trong `src/app/features/chat/components/hooks/useChatStreamExecution.ts:174` (`if (!isAuthed || creatingConversation || !text) return;`) — vì vậy Queue-to-Send (`isUploadBusy === true`) bắt buộc yêu cầu `Boolean(input.trim())` (không xếp hàng chờ gửi khi `input` trống dù `fileCount > 0`, tránh `markAsSent` ẩn tệp mà không gửi tin), trong khi trạng thái không upload (`!isUploadBusy`) giữ nguyên hợp đồng hiện hữu.
- **KHÔNG thêm** gói npm ngoài; sử dụng 100% Framer Motion, Lucide React, Zustand, SWR, Tailwind CSS v4 đã cài đặt.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Tài liệu đã đọc trực tiếp bằng `read_file` trong phiên

- Governance & Rules: `.agents/rules/00-core.md`, `.agents/rules/01-coding.md:90-120`, `.agents/rules/02-quality.md`, `.agents/rules/03-ui.md:1-128`, `.agents/rules/04-bilingual.md:1-56`, `.agents/rules/05-plan-review.md`.
- Lessons & Static Guards: `docs/lessons-learned.md:850-913`, `src/lib/config/theme-config.test.ts:435-545`.
- Target Source & Tests:
  - `src/lib/features/files/useFileUpload.ts:1-340`, `src/lib/features/files/useFileUpload.test.ts:1-346`
  - `src/lib/features/files/store.ts:1-188`, `src/lib/features/files/fileUploadHelpers.ts:1-398`
  - `src/lib/features/files/uploadPresentation.ts:1-283`, `src/lib/features/files/uploadPresentation.test.ts:1-182`
  - `src/lib/features/chat/draftConversation.ts:1-75`
  - `src/app/features/chat/components/InputForm.tsx:1-489`, `src/app/features/chat/components/InputForm.test.tsx:1-594`
  - `src/app/features/chat/components/ChatControls.tsx:1-190`, `src/app/features/chat/components/ChatApp.tsx:1-371`
  - `src/app/features/chat/components/hooks/useChatAttachments.ts:1-70`, `src/app/features/chat/components/hooks/useChatStreamExecution.ts:1-325`, `src/app/features/chat/components/hooks/useChatMessageActions.ts:1-200`, `src/app/features/chat/components/hooks/useUrlSync.ts:1-84`
  - `src/app/features/chat/components/FilePreviewArea.tsx:1-196`
  - `src/lib/utils/translations/vi.ts:1780-1835`, `src/lib/utils/translations/en.ts:1780-1827`

#### Bảng Ánh Xạ `Skills Loaded & Applied`

| Skill (`SKILL.md` đã đọc bằng `read_file`)   | Quyết định kỹ thuật chịu ảnh hưởng trực tiếp trong kế hoạch                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-debug/SKILL.md`       | Truy vết tận gốc 3 nguyên nhân (`ensureConversationId` blind window, SWR/conversationId propagation lag, và khóa cứng submit) kèm bằng chứng `[SRC]` trước khi đề xuất giải pháp; lên kế hoạch ghi nhận bài học vào `docs/lessons-learned.md` và cập nhật `docs/CHANGELOG.md` theo Post-Fix Protocol §Part 2.                                                                                 |
| `.agents/skills/vikini-investigate/SKILL.md` | Thực hiện phân tích `/blast-radius` cho mọi export thay đổi trên `src/lib/features/files/useFileUpload.ts` và `src/lib/features/files/uploadPresentation.ts`, giữ toàn bộ option/return mở rộng tương thích ngược và đồng bộ mock factory tại `src/app/features/chat/components/InputForm.test.tsx:74-85`.                                                                                    |
| `.agents/skills/emil-design-eng/SKILL.md`    | Thiết kế `<PendingUploadSendBanner />` và trạng thái nút Gửi theo chuẩn motion: dùng `AnimatePresence initial={false}` với `height: 0 -> "auto"` + `opacity` + `overflow-hidden` (`TRANSITION.FAST` từ `src/lib/utils/motion.ts`), không dùng `scale(0)` / `transition-all` / `ease-in`, phản hồi nhấn `active:scale-[0.97]`, tôn trọng `useReducedMotion()` và `motion-reduce:animate-none`. |
| `.agents/skills/add-translation/SKILL.md`    | Bổ sung đồng bộ 6 khóa song ngữ vào `src/lib/utils/translations/vi.ts` (tiếng Việt tự nhiên, không chèn tiếng Anh trong ngoặc đơn) và `src/lib/utils/translations/en.ts`, chỉ đọc qua `useLanguage()` + `t("key")`, kiểm chứng compile-time parity qua `npm run type-check`.                                                                                                                  |

---

### 3. Assumptions & Cross-Task Dependencies

#### Verified Assumptions (kèm bằng chứng `[SRC]`)

1. **New Chat Blind Window, `null -> conv-existing` Switch & Duplicate Conversation Hazard (`[SRC]`)**: Tại `src/lib/features/files/useFileUpload.ts:161-186`, `uploadFiles` gọi `await ensureConversationIdRef.current()` trước khi gọi `buildQueuedUploadItems` và `enqueueFiles`. Trong lúc chờ `POST /api/conversations`, `uploadQueue` rỗng nên `isUploading` (`src/lib/features/files/useFileUpload.ts:41-45`) là `false`. Nếu người dùng nhấn `Enter` lúc này, `InputForm.handleSubmit` (`src/app/features/chat/components/InputForm.tsx:254-281`) gọi thẳng `onSubmit(undefined)` ➔ `useChatStreamExecution.coreSend` (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:137-159,212`) gọi `createConversation()` độc lập với `draftCoordinator` (`src/app/features/chat/components/hooks/useChatAttachments.ts:27-40`), sinh 2 hội thoại và gửi prompt thiếu ảnh. Ngoài ra, nếu người dùng chuyển từ New Chat sang `"conv-existing"` trong lúc `ensureConversationId()` đang chờ, `shouldClearQueue(null, "conv-existing", true)` tại `src/lib/features/chat/draftConversation.ts:22` trả `false`; do đó sau `await ensureConversationIdRef.current()` phải kiểm tra **`if (isStale())` ĐẦU TIÊN** (tránh session cũ / sau unmount gọi `onSessionResetRef.current?.()` làm hủy nhầm hội thoại mới), tiếp theo mới xử lý `switchedAway` (gọi `onSessionResetRef.current?.()` + đặt `isSelfInitiatedUploadRef.current = false`) và `!targetConvId` (gọi `onErrorRef.current?.({ code: "CONVERSATION_INIT_FAILED" })`) **trước** khi xóa `queuedItems` và hạ `isPreparingUpload`; trong `catch`, đặt `isSelfInitiatedUploadRef.current = false` **bên trong `if (!isStale())`** để promise cũ bị reject không ghi đè cờ của New Chat thứ 2; trong `finally`, chỉ giảm `preparingCountRef` khi `!isStale()`.
2. **Thứ tự Effect `clearSentFileIds()`, `isSelfInitiatedUploadRef` Single-Consumer & Cắt Vòng Phụ Thuộc Hook (`[SRC]`)**:
   - `src/lib/features/files/useFileUpload.ts:318-327` đặt lại `isSelfInitiatedUploadRef.current = false` ngay sau khi kiểm tra `shouldClearQueue(prevId, conversationId, isSelfInitiated)`, nên `useFileUpload` phải là consumer duy nhất của `isSelfInitiatedUploadRef` và chỉ phát `onSessionReset?.()` khi thực sự chuyển hội thoại.
   - `src/app/features/chat/components/InputForm.tsx:217-220` hiện gọi `clearSentFileIds()` vô điều kiện mỗi khi `conversationId` đổi; nếu effect flush chạy trước dòng 218 trên cùng commit `null -> conv-new`, `clearSentFileIds()` sẽ xóa ngược `sentFileIds` làm thẻ tệp vừa gửi bật lại! **Khắc phục**: bỏ `useEffect([conversationId])` vô điều kiện này và **chỉ gọi `clearSentFileIds()` khi thực sự chuyển hội thoại** (trong `onSessionReset` của `useFileUpload` và nhánh dự phòng `prevConvId !== null && prevConvId !== conversationId` của `usePendingUploadSend`), KHÔNG xóa `sentFileIds` khi thăng cấp tự khởi phát `null -> conv-new`.
   - Cắt vòng phụ thuộc TDZ giữa `useFileUpload` (cần callbacks của `usePendingUploadSend`) và `usePendingUploadSend` (cần `isUploadBusy` từ `useFileUpload`) bằng `pendingSendBridgeRef = useRef<PendingSendBridge | null>(null)` cập nhật qua `useEffect` ngay sau khi gọi `usePendingUploadSend`.
3. **Không Unmount `InputForm` Khi Thăng Cấp New Chat `null -> conv-new` (`[SRC]`)**: Tại `src/app/features/chat/components/ChatApp.tsx:210-211,312-322`, `showLanding` phụ thuộc `(!selectedConversationId || renderedMessages.length === 0)`. Khi `ensureConversationId()` gọi `setSelectedConversationIdAndUrl(conv.id)` (`src/app/features/chat/components/hooks/useChatAttachments.ts:33`), `renderedMessages.length` vẫn bằng `0` nên `<ChatControls isLanding={true} />` và `<InputForm />` **giữ nguyên instance**, không mất state `isPendingSend` hay nội dung `input`.
4. **Phản Hồi HTTP 200 Thiếu `file` (`uploadedFile === null`) & Thứ Tự `onError` (`[SRC]`)**: Tại `src/lib/features/files/fileUploadHelpers.ts:248-260`, HTTP 200 sai định dạng JSON gọi `onSuccess(null)`. Hiện `src/lib/features/files/useFileUpload.ts:234-236` chỉ gọi `removeFromQueue(item.tempId)` mà không gọi `onError`, khiến `isUploadBusy` tụt về `false` và tự gửi prompt trơn! Đồng thời `src/lib/features/files/useFileUpload.ts:250-255` đặt `setStatus(..., "error")` trước `onErrorRef.current?.(...)`. **Khắc phục**: tại mọi nhánh lỗi (gồm `!isUnmountedRef.current && !uploadedFile`, `CONVERSATION_INIT_FAILED`, `!targetConvId`, và `result.outcome === "error"`), ghi `logger.error` và gọi `onErrorRef.current?.(...)` **trước** khi đặt `"error"` hoặc gọi `removeFromQueue`.
5. **Hợp Đồng `!text` của `coreSend`, Nút `type="button"` Click-to-Cancel & `FileLightbox` `Escape` (`[SRC]`)**:
   - `src/app/features/chat/components/hooks/useChatStreamExecution.ts:174` bỏ qua im lặng khi `!text`; do đó kích hoạt và flush Queue-to-Send (`isUploadBusy === true`) **bắt buộc** yêu cầu `Boolean(input.trim())` (tránh gọi `markAsSent` ẩn tệp mà không gửi tin).
   - `src/app/features/chat/components/InputForm.tsx:300-307,445-464` dùng `<button type="submit">` đi qua `<form onSubmit>`; để click nút đang xoay hủy `isPendingSend` mà double-Enter vẫn là idempotent no-op, tách `<ComposerSubmitButton />` đổi rõ sang `type="button"` kèm `onClick={onCancelPendingSend}` khi `isPendingSend && !isStreaming` (giữ `type="submit"` khi thường hoặc `isStreaming`).
   - `src/app/features/chat/components/FileLightbox.tsx:10` dùng `@radix-ui/react-dialog` không luôn gọi `e.preventDefault()` trên `Escape`, nên truyền `escapeDisabled={Boolean(lightboxFile)}` (`src/app/features/chat/components/InputForm.tsx:85`) kết hợp `!e.defaultPrevented`, đồng thời theo dõi `prevInputRef` trong `usePendingUploadSend` để tự hủy khi `input` đổi từ bên ngoài (như `DashboardView` `onPromptSelect={setInput}` tại `src/app/features/chat/components/ChatApp.tsx:315`).
6. **Spec Change Loại C trên `src/app/features/chat/components/InputForm.test.tsx:549-577` (`[SRC]`)**: `src/app/features/chat/components/InputForm.test.tsx:549-577` (`NP-3b` từ plan trước) hiện khẳng định `sendBtn` bị `toBeDisabled()` khi `isUploading = true`. Yêu cầu mới của User đổi đặc tả từ "khóa chết nút Gửi" sang "Queue-to-Send" (nút Gửi khả dụng khi có prompt để xếp hàng chờ gửi và `onSubmit` vẫn chưa bị gọi khi `isUploading = true`), thuộc **Loại C (Approved Spec Change)** theo `.agents/rules/02-quality.md` §Test Failure Triage Protocol.
7. **Trần Dòng `TC-13` & `.agents/rules/01-coding.md:101-106` (`[SRC]`)**: `src/lib/features/files/useFileUpload.ts` hiện `340/350L`; `src/app/features/chat/components/InputForm.tsx` hiện `489/500L`; `src/lib/config/theme-config.test.ts:453-460,510-524` khóa cứng mọi `src/app/**/use*.ts(x) <= 350L` sau Prettier, 0 `transition-all`, 0 `t: Record<string, string>`, và 0 `use*Store()` thiếu selector. Tách thêm `ComposerSubmitButton.tsx` (~55L) kéo `InputForm.tsx <= 455L` và gộp 1 selector `activeUploadCount` kéo `useFileUpload.ts <= 330L`.

#### Phân Tích Blast-Radius (`/blast-radius` theo `.agents/skills/vikini-investigate/SKILL.md`)

| Caller / Test                              | `file:line`                                                     | Tầng | Cách tham chiếu | Usage Pattern                                                                               | Compatible?                                                                                |
| ------------------------------------------ | --------------------------------------------------------------- | ---- | --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `InputForm`                                | `src/app/features/chat/components/InputForm.tsx:7,144-160`      | 1    | `static import` | Gọi `useFileUpload(...)` & nhận `isUploadBusy`, `activeUploadCount`, nối `onSessionReset`   | **Yes** — cập nhật đồng bộ trong kế hoạch                                                  |
| `InputForm.test.tsx`                       | `src/app/features/chat/components/InputForm.test.tsx:74-85,549` | 1    | `mock`          | `vi.mock("@/lib/features/files/useFileUpload", ...)`                                        | **No (cần migrate)** — cập nhật mock factory + test `NP-3b` theo Loại C (`TC-QS-02/03/04`) |
| `useFileUpload.test.ts`                    | `src/lib/features/files/useFileUpload.test.ts:5,73-346`         | 1    | `static import` | Gọi `useFileUpload` trực tiếp; kiểm thử New Chat `null -> conv-new`, retry, per-file cancel | **Yes** — option mới đều optional; bổ sung test `isPreparingUpload` & `onSessionReset`     |
| `uploadPresentation.test.ts`               | `src/lib/features/files/uploadPresentation.test.ts:3-15`        | 1    | `static import` | Kiểm thử các helper thuần của `uploadPresentation.ts`                                       | **Yes** — chỉ thêm 2 export mới (`mergeDispatchFileIds`, `isPendingSendReadyToFlush`)      |
| `FilePreviewArea.tsx` & `ChatControls.tsx` | `src/app/features/chat/components/ChatControls.tsx:131-179`     | 2    | `static import` | Render `<InputForm />` với props hiện hữu (không đổi `InputFormProps`)                      | **Yes** — `InputFormProps` giữ nguyên 100% tương thích ngược                               |

#### Cross-Task Dependencies

- **Thứ tự triển khai bắt buộc**:
  1. `src/lib/utils/translations/{vi,en}.ts` (6 khóa mới)
  2. `src/lib/features/files/uploadPresentation.ts` (`mergeDispatchFileIds`, `isPendingSendReadyToFlush`) + `uploadPresentation.test.ts`
  3. `src/lib/features/files/useGlobalFileDropPaste.ts` (tách từ `useFileUpload.ts`) + `src/lib/features/files/useFileUpload.ts` (1 selector `activeUploadCount`, `isPreparingUpload`, `isUploadBusy`, pre-`ensureConversationId` enqueue, `switchedAway`/`!targetConvId`/`uploadedFile === null` fail-closed ordering, `!isStale()` trong `finally`) + `useFileUpload.test.ts`
  4. `src/app/features/chat/components/hooks/useComposerFileActions.ts` + `src/app/features/chat/components/hooks/usePendingUploadSend.ts` + `usePendingUploadSend.test.ts`
  5. `src/app/features/chat/components/PendingUploadSendBanner.tsx` + `PendingUploadSendBanner.test.tsx` + `src/app/features/chat/components/ComposerSubmitButton.tsx` + `ComposerSubmitButton.test.tsx`
  6. `src/app/features/chat/components/InputForm.tsx` + `InputForm.test.tsx`
  7. Living docs (`docs/CHANGELOG.md`, `docs/lessons-learned.md`), Prettier check, full verify & Playwright Visual QA.

---

### 4. Bảng Verified Versions

| Công nghệ / Thư viện                   | Phiên bản thực tế (`[SRC]`)                   | Xác minh 2026 & Ghi chú tương thích (`[URL]` / `[SRC]`)                                                                                                                                            |
| -------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                                 | `^16.4.0` (`package.json:64`)                 | Next.js 16 App Router; toàn bộ hook/component composer mới gắn `"use client"`, giữ ranh giới client-only.                                                                                          |
| `react` / `react-dom`                  | `^19.2.3` (`package.json:69-70`)              | React 19 automatic batching + Strict Mode double-mount resilience (`isUnmountedRef` reset trên mount, `isPendingSendRef` đồng bộ chống double-dispatch).                                           |
| `swr`                                  | `^2.3.8` (`package.json:78`)                  | `[URL]` https://swr.vercel.app/docs/mutation — `useSWR` bound `mutate` và `useSWRConfig().mutate` cập nhật lạc quan; bổ sung `mergeDispatchFileIds` loại bỏ mọi độ trễ SWR giữa upload và send.    |
| `zustand`                              | `^5.0.9` (`package.json:81`)                  | Bắt buộc atomic selector (`src/lib/config/theme-config.test.ts:510-524`, `TC-14`) trả primitive (`activeUploadCount: number`) và đọc imperative `useFileStore.getState()` trong callbacks/effects. |
| `framer-motion`                        | `^12.23.26` (`package.json:59`)               | `[URL]` https://motion.dev/docs/react-animate-presence — `AnimatePresence initial={false}` + `height: 0 -> "auto"` + `overflow-hidden` + `useReducedMotion()` cho `PendingUploadSendBanner.tsx`.   |
| `tailwindcss` / `@tailwindcss/postcss` | `^4.1.18` (`package.json:53,114`)             | Cú pháp v4 `bg-(--soft)`, `border-(--accent)/25`, `text-(--text)`, `focus-visible:ring-(--ring)`, `motion-reduce:animate-none`.                                                                    |
| `lucide-react`                         | `^0.562.0` (`package.json:62`)                | Named imports (`Loader2`, `X`, `SendHorizontal`, `Square`, `Image`); cấm namespace import (`TC-13`).                                                                                               |
| `vitest` / `@playwright/test`          | `^4.1.12` / `^1.62.1` (`package.json:87,118`) | Unit tests co-located (`*.test.ts(x)`) + Playwright Visual QA Desktop `1440×900` & Mobile `375×812` × Dark/Light.                                                                                  |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

> **Kiểm soát giới hạn dòng sau Prettier (`printWidth: 100`)**: Mọi hook (`use*.ts`) giữ `<= 330L` (`Hard Max 350L`), UI component giữ `<= 455L` (`Hard Max 500L`), `src/lib/` module giữ `<= 360L` (`Hard Max 400L`).

#### Pure Domain & Upload Lifecycle (`src/lib/features/files/`)

- `[MODIFY]` `src/lib/features/files/uploadPresentation.ts` — Thêm 2 hàm thuần `mergeDispatchFileIds(swrFiles, completedIds, sentIds)` và `isPendingSendReadyToFlush(params)` (yêu cầu `hasPromptText: boolean`, `283L` ➔ **~325 dòng**, `<= 400L`).
- `[MODIFY]` `src/lib/features/files/uploadPresentation.test.ts` — Bổ sung unit tests cho `mergeDispatchFileIds` (gộp không trùng, lọc `sentIds`, giữ thứ tự khi SWR rỗng) và `isPendingSendReadyToFlush` (bao gồm `hasPromptText: false` phải trả `false`).
- `[NEW]` `src/lib/features/files/useGlobalFileDropPaste.ts` — Tách nguyên vẹn bộ lắng nghe `window` `dragenter`/`dragleave`/`dragover`/`drop` + `paste` và state `isDragging` từ `useFileUpload.ts` sang hook đơn nhiệm (~68 dòng, `<= 350L`).
- `[NEW]` `src/lib/features/files/useGlobalFileDropPaste.test.ts` — Unit tests co-located cho drag counter, drop gọi `onFiles`, paste screenshot/files, disabled guard, và tháo listener khi unmount.
- `[MODIFY]` `src/lib/features/files/useFileUpload.ts` — Dùng `useGlobalFileDropPaste`, gộp 1 atomic selector `activeUploadCount` (`isUploading = activeUploadCount > 0`), đảo thứ tự **validate + `enqueueFiles` + `hydrateQueuedImagePreviews` TRƯỚC `await ensureConversationId()`**, thêm `preparingCountRef` / `isPreparingUpload` (reset `0` trong `cancelActiveUploads()`, và trong `finally` chỉ giảm khi `!isStale()`), trả `isUploadBusy = isPreparingUpload || isUploading` và `activeUploadCount`, bổ sung options `onConversationResolved?: (convId: string) => void` và `onSessionReset?: () => void`; ngay sau `await ensureConversationIdRef.current()` kiểm tra **`if (isStale())` ĐẦU TIÊN** (`removeBatchFromQueue(); return;`), kế tiếp trên nhánh `switchedAway` gọi `onSessionResetRef.current?.()` + reset `isSelfInitiatedUploadRef.current = false` **trước** khi xóa `queuedItems` / hạ `isPreparingUpload`; trên nhánh `!targetConvId` (hoặc thiếu `ensureConversationId`) gọi `onErrorRef.current?.({ code: "CONVERSATION_INIT_FAILED" })` trước khi dọn queue; trong khối `catch` đặt `isSelfInitiatedUploadRef.current = false` **bên trong `if (!isStale())`**; trên nhánh HTTP 200 thiếu `file` (`!isUnmountedRef.current && !uploadedFile`) ghi `logger.error` và gọi `onErrorRef.current?.({ code: "UPLOAD_FAILED", filename: item.filename })` **trước** `removeFromQueue`; gọi `onErrorRef.current?.(...)` trước `setStatus(..., "error")` (`340L` ➔ **~325 dòng**, `<= 330L <= 350L`).
- `[MODIFY]` `src/lib/features/files/useFileUpload.test.ts` — Bổ sung tests cho New Chat immediate enqueue & `isPreparingUpload === true`, `ensureConversationId` reject / trả chuỗi rỗng, chuyển sang `"conv-existing"` giữa lúc `ensureConversationId` đang chạy (`switchedAway` gọi `onSessionReset` trước khi hạ `isUploadBusy` & 0 XHR), HTTP 200 payload thiếu `file` (`uploadedFile === null` gọi `logger.error` + `onError` trước khi xóa queue), stale session resolve/reject sau multi-switch hoặc unmount (KHÔNG gọi `onSessionReset`, KHÔNG ghi đè `isSelfInitiatedUploadRef` của New Chat #2, và `finally` không giảm nhầm `preparingCountRef`), và `onError` chạy trước khi `isUploading` hạ về `false`.

#### Composer Hooks, Banner, Submit Button & Integration (`src/app/features/chat/components/`)

- `[NEW]` `src/app/features/chat/components/hooks/useComposerFileActions.ts` — Tách `handleUploadComplete` (kèm fallback `globalMutate` cho New Chat), `handleRemoveFile`, và `handleClearAll` ra khỏi `InputForm.tsx` kèm callback hook `onFileCompleted` / `onFileRemoved` / `onFilesCleared` (~95 dòng, `<= 350L`).
- `[NEW]` `src/app/features/chat/components/hooks/useComposerFileActions.test.ts` — Unit tests co-located cho optimistic SWR merge, fallback `globalMutate`, lỗi HTTP 500 khi xóa đơn/xóa tất cả, và gọi callback thông báo `usePendingUploadSend`.
- `[NEW]` `src/app/features/chat/components/hooks/usePendingUploadSend.ts` — Hook máy trạng thái Queue-to-Send chuyên trách: quản lý `isPendingSend`, `isPendingSendRef`, `recentCompletedIdsRef`, `expectedConversationIdRef`, `prevInputRef`, `prevConversationIdRef`; yêu cầu `hasPromptText` (`Boolean(input.trim())`) cho cả `queuePendingSend` lẫn `isPendingSendReadyToFlush`; **khai báo toàn bộ `useEffect` tự hủy (`prevInputRef` đổi `input`, `prevConversationIdRef` chuyển hội thoại gọi `onConversationSwitch` chỉ khi `prevConvId !== null && prevConvId !== conversationId`, và `disabled || isStreaming || isImageMode`) TRƯỚC `useEffect` auto-flush** và kiểm tra `if (!isPendingSendRef.current) return;` ngay đầu `useEffect` auto-flush; hỗ trợ `Escape` (tôn trọng `escapeDisabled`, IME & `!e.defaultPrevented`) và unmount cleanup; xuất `queuePendingSend`, `cancelPendingSend`, `recordCompletedUpload`, `forgetCompletedFile`, `clearCompletedFiles`, `handleConversationResolved`, `handleUploadFailure`, `resetForConversationChange`, `consumeMergedFileIds` (~185 dòng, `<= 350L`).
- `[NEW]` `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts` — Unit tests co-located phủ toàn bộ ma trận trạng thái: arm & auto-flush kèm `recentCompletedIds` dù SWR rỗng, New Chat `null -> conv-new` chờ `conversationId === expectedConversationId` mới gửi và KHÔNG gọi `onConversationSwitch`/`clearSentFileIds`, `null -> conv-existing` (`switchedAway` gọi `resetForConversationChange`) không gửi nhầm, chặn arm khi `input` trống dù `fileCount > 0`, thêm tệp mới tiếp tục chờ, lỗi upload / HTTP 200 thiếu `file` hủy `isPendingSend` + 1 lần `toast.info`, `escapeDisabled={true}` (Lightbox mở) + `!defaultPrevented`, thay đổi `input` từ bên ngoài tự hủy, hủy 1 tệp / chuyển hội thoại / unmount không bao giờ gọi `onFlushSend`, và double-flush lock.
- `[NEW]` `src/app/features/chat/components/PendingUploadSendBanner.tsx` — Banner chỉ báo chờ gửi nằm trong khung composer (dưới `FilePreviewArea`, trên `Textarea`): `AnimatePresence initial={false}` + `height: 0 -> "auto"` + `overflow-hidden` + `useReducedMotion()`, `role="status"` + `aria-live="polite"`, `Loader2` xoay (`motion-reduce:animate-none`), nhãn song ngữ (`pendingSendWaiting` / `pendingSendWaitingCount`), nút `<button type="button">` **Hủy gửi** (`active:scale-[0.97]`, `focus-visible:ring-2 focus-visible:ring-(--ring)`, kích thước tối thiểu `text-xs`) (~85 dòng, `<= 500L`).
- `[NEW]` `src/app/features/chat/components/PendingUploadSendBanner.test.tsx` — Unit tests cho trạng thái ẩn/hiện, số ít/số nhiều (`activeUploadCount`), click nút **Hủy gửi**, `role="status"`, không dùng `transition-all`, và `reduced-motion`.
- `[NEW]` `src/app/features/chat/components/ComposerSubmitButton.tsx` — Tách toàn bộ state machine nút hành động (Send / Stop / Pending-Send Cancel) ra khỏi `InputForm.tsx`: dùng `useLanguage()` trực tiếp, khi `isPendingSend && !isStreaming` render **`type="button"`** với **`onClick={onCancelPendingSend}`** và `<Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />` (giải quyết dứt điểm mâu thuẫn click-to-cancel vs double-Enter idempotent), giữ `type="submit"` cho Send bình thường và `isStreaming` Stop (~60 dòng, `<= 500L`).
- `[NEW]` `src/app/features/chat/components/ComposerSubmitButton.test.tsx` — Unit tests co-located cho cả 4 trạng thái (disabled, ready Send `type="submit"`, uploading ready `sendWhenUploadsReady` `type="submit"`, pending-send `type="button"` click gọi `onCancelPendingSend` không submit form, và streaming Stop `type="submit"`).
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx` — Tích hợp `useComposerFileActions`, `usePendingUploadSend` (nối bằng `pendingSendBridgeRef` cập nhật trong `useEffect` — không vòng phụ thuộc TDZ), `<PendingUploadSendBanner />`, và `<ComposerSubmitButton />`; bỏ `useEffect([conversationId])` vô điều kiện gọi `clearSentFileIds()` tại `src/app/features/chat/components/InputForm.tsx:217-220` và chỉ gọi `clearSentFileIds()` trong `onSessionReset` / `onConversationSwitch` (chuyển hội thoại thực sự); truyền `escapeDisabled={Boolean(lightboxFile)}` vào `usePendingUploadSend`; yêu cầu `Boolean(input.trim())` khi `effectiveUploadBusy` để kích hoạt `isPendingSend` (double-Enter là idempotent no-op); tự hủy `isPendingSend` trước khi đổi text / chèn giọng nói / hủy tệp / xóa tệp / vào Image Mode; dùng `consumeMergedFileIds()` cho gửi ngay (`489L` ➔ **~448 dòng**, `<= 455L <= 500L`).
- `[MODIFY]` `src/app/features/chat/components/InputForm.test.tsx` — Cập nhật mock `useFileUpload` (`isPreparingUpload`, `isUploadBusy`, `activeUploadCount`, capture `onUploadComplete`, `onError`, `onConversationResolved`, `onSessionReset`); cập nhật `NP-3b` theo đặc tả Loại C mới thành chuỗi kiểm thử Queue-to-Send đầy đủ (`Enter` & click Send khi có prompt kích hoạt chờ gửi, không arm khi `input` trống dù `fileCount > 0`, nút chờ gửi là `type="button"` click để hủy trong khi double-Enter không hủy, `sentFileIds` không bị xóa ngược trên `null -> conv-new`, `escapeDisabled` khi `lightboxFile` mở, thay đổi `input` từ bên ngoài tự hủy, và không phá IME / `isStreaming` / `isImageMode`).

#### Song ngữ & Living Docs

- `[MODIFY]` `src/lib/utils/translations/vi.ts` — Thêm 6 khóa tiếng Việt tự nhiên (không tiếng Anh trong ngoặc đơn).
- `[MODIFY]` `src/lib/utils/translations/en.ts` — Thêm 6 khóa tiếng Anh tương ứng.
- `[MODIFY]` `docs/CHANGELOG.md` — Ghi nhận tính năng Queue-to-Send và bản sửa lỗi blind window New Chat / SWR lag.
- `[MODIFY]` `docs/lessons-learned.md` — Ghi bài học Post-Fix về khoảng mù `ensureConversationId()`, thứ tự consumer của `isSelfInitiatedUploadRef`, và gộp `recentCompletedIds` chống SWR lag.

---

### 6. Caller-First Design Sketch

#### 6.1. Pure Helpers (`src/lib/features/files/uploadPresentation.ts`)

```typescript
/**
 * Merges SWR-known composer files with synchronously completed upload IDs from the current
 * batch, preserving chronological order, deduplicating IDs, and excluding already-sent files.
 */
export function mergeDispatchFileIds(
  swrFiles: readonly FileItem[],
  completedIds: readonly string[],
  sentIds: readonly string[]
): string[] {
  const sent = new Set(sentIds);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const file of swrFiles) {
    if (!sent.has(file.id) && !seen.has(file.id)) {
      seen.add(file.id);
      result.push(file.id);
    }
  }
  for (const id of completedIds) {
    if (!sent.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export interface PendingSendFlushCheck {
  isPendingSend: boolean;
  isUploadBusy: boolean;
  disabled: boolean;
  isStreaming: boolean;
  isImageMode: boolean;
  expectedConversationId: string | null;
  currentConversationId: string | null;
  hasPromptText: boolean; // Matches useChatStreamExecution coreSend !text contract
}

/** Pure gate deciding whether a queued send can safely flush right now. */
export function isPendingSendReadyToFlush(p: PendingSendFlushCheck): boolean {
  if (!p.isPendingSend || p.isUploadBusy || p.disabled || p.isStreaming || p.isImageMode) {
    return false;
  }
  if (!p.hasPromptText) return false;
  if (p.expectedConversationId && p.currentConversationId !== p.expectedConversationId) {
    return false;
  }
  return true;
}
```

#### 6.2. Immediate Enqueue, Stale-Safe Preparing Counter & Fail-Closed Error Ordering (`src/lib/features/files/useFileUpload.ts`)

```typescript
// Single atomic primitive selector (TC-14 + Zustand v5 Object.is safe):
const activeUploadCount = useFileStore(
  (s) =>
    s.uploadQueue.filter(
      (q) => q.status === "queued" || q.status === "uploading" || q.status === "processing"
    ).length
);
const isUploading = activeUploadCount > 0;
const isUploadBusy = isPreparingUpload || isUploading;

// In cancelActiveUploads():
preparingCountRef.current = 0;
if (!isUnmountedRef.current) setIsPreparingUpload(false);

// Inside uploadFiles (BEFORE any await!):
const queuedItems = buildQueuedUploadItems(fileArray, (validationError) => {
  logger.warn("[useFileUpload] File rejected by client validation:", validationError);
  onErrorRef.current?.(validationError);
});
if (queuedItems.length === 0) return;

// Enqueue & hydrate previews synchronously at T0 so isUploading/isUploadBusy === true immediately
useFileStore.getState().enqueueFiles(queuedItems);
hydrateQueuedImagePreviews(
  queuedItems,
  (tempId) => !isStale() && !cancelledTempIdsRef.current.has(tempId),
  (tempId, previewUrl) => useFileStore.getState().setPreviewUrl(tempId, previewUrl)
);

const removeBatchFromQueue = () => {
  for (const item of queuedItems) useFileStore.getState().removeFromQueue(item.tempId);
};

let targetConvId = conversationIdRef.current;
if (!targetConvId && ensureConversationIdRef.current) {
  if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = true;
  preparingCountRef.current += 1;
  setIsPreparingUpload(true);
  try {
    targetConvId = await ensureConversationIdRef.current();
    // ALWAYS check isStale() FIRST before switchedAway / !targetConvId so a stale/unmounted
    // session never resets a newer conversation's pendingSend or touches state after unmount!
    if (isStale()) {
      removeBatchFromQueue();
      return;
    }
    const switchedAway = Boolean(
      targetConvId && conversationIdRef.current && conversationIdRef.current !== targetConvId
    );
    if (switchedAway) {
      if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
      // Reset pending send FIRST before queue removal & finally lower isUploadBusy!
      onSessionResetRef.current?.();
      removeBatchFromQueue();
      return;
    }
    if (!targetConvId) {
      if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
      onErrorRef.current?.({ code: "CONVERSATION_INIT_FAILED" });
      removeBatchFromQueue();
      return;
    }
  } catch (err: unknown) {
    logger.error("[useFileUpload] Failed to initialize conversation:", err);
    if (!isStale()) {
      // Guard inside !isStale() so an older rejected New Chat promise never clobbers New Chat #2's flag!
      if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
      onErrorRef.current?.({
        code: "CONVERSATION_INIT_FAILED",
        detail: err instanceof Error ? err.message : undefined,
      });
    }
    removeBatchFromQueue();
    return;
  } finally {
    // Guarded by !isStale() so a stale session never decrements a newer session's counter!
    if (!isStale()) {
      preparingCountRef.current = Math.max(0, preparingCountRef.current - 1);
      if (!isUnmountedRef.current && preparingCountRef.current === 0) {
        setIsPreparingUpload(false);
      }
    }
  }
} else if (!targetConvId) {
  onErrorRef.current?.({ code: "CONVERSATION_INIT_FAILED" });
  removeBatchFromQueue();
  return;
}

onConversationResolvedRef.current?.(targetConvId);

// Inside uploadFileWithRetry onSuccess callback:
// When !isUnmountedRef.current && !uploadedFile (HTTP 200 missing file payload):
//   logger.error("[useFileUpload] Upload returned HTTP 200 without file payload:", item.filename);
//   onErrorRef.current?.({ code: "UPLOAD_FAILED", filename: item.filename }); // FIRST!
//   useFileStore.getState().removeFromQueue(item.tempId);
// And on result.outcome === "error":
//   onErrorRef.current?.(result.error); // FIRST before setStatus(..., "error")!

// Conversation switch effect (SINGLE authoritative consumer of isSelfInitiatedUploadRef):
useEffect(() => {
  const prevId = prevConversationIdRef.current;
  const isSelfInitiated = isSelfInitiatedUploadRef?.current ?? false;
  if (shouldClearQueue(prevId, conversationId, isSelfInitiated)) {
    cancelActiveUploads();
    useFileStore.getState().clearQueue();
    onSessionResetRef.current?.();
  }
  if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
  prevConversationIdRef.current = conversationId;
}, [conversationId, cancelActiveUploads, isSelfInitiatedUploadRef]);
```

#### 6.3. Non-Circular Ref Bridge, `clearSentFileIds` Invariant & `ComposerSubmitButton` (`InputForm.tsx`)

```typescript
// Inside src/app/features/chat/components/InputForm.tsx:
// 1. Cut circular hook dependency (useFileUpload <-> usePendingUploadSend) with a typed ref bridge:
interface PendingSendBridge {
  recordCompletedUpload: (file: FileItem) => void;
  handleConversationResolved: (convId: string) => void;
  handleUploadFailure: () => void;
  resetForConversationChange: () => void;
}
const pendingSendBridgeRef = useRef<PendingSendBridge | null>(null);

// 2. Call useComposerFileActions + useFileUpload FIRST (referencing pendingSendBridgeRef):
const handleSessionReset = useCallback(() => {
  clearSentFileIds(); // ONLY cleared on real conversation switch, NEVER on null -> conv-new!
  pendingSendBridgeRef.current?.resetForConversationChange();
}, [clearSentFileIds]);

const {
  openFilePicker,
  cancelUpload,
  dismissUploadError,
  isDragging,
  fileInputRef,
  fileAccept,
  handleFileInputChange,
  isUploading,
  isPreparingUpload,
  isUploadBusy,
  activeUploadCount,
} = useFileUpload({
  conversationId: conversationId ?? null,
  disabled: Boolean(disabled),
  ensureConversationId,
  isSelfInitiatedUploadRef,
  onUploadComplete: fileActions.handleUploadComplete, // calls pendingSendBridgeRef.current?.recordCompletedUpload
  onError: handleUploadError, // toast.error + pendingSendBridgeRef.current?.handleUploadFailure()
  onConversationResolved: (id) => pendingSendBridgeRef.current?.handleConversationResolved(id),
  onSessionReset: handleSessionReset,
});
const effectiveUploadBusy = isUploadBusy ?? (Boolean(isPreparingUpload) || isUploading);

// 3. Call usePendingUploadSend SECOND (receives effectiveUploadBusy cleanly — zero TDZ!):
const pendingSend = usePendingUploadSend({
  input,
  files,
  sentFileIds: allSentFileIds,
  conversationId: conversationId ?? null,
  isUploadBusy: effectiveUploadBusy,
  disabled: Boolean(disabled),
  isStreaming: Boolean(isStreaming),
  isImageMode,
  escapeDisabled: Boolean(lightboxFile), // Radix Dialog DismissableLayer safety
  onFlushSend: dispatchSend,
  onConversationSwitch: clearSentFileIds, // Fallback for mocked useFileUpload when prevConvId !== null
  onCancelledByError: () => toast.info(t("pendingSendCancelledOnError")),
});

// 4. Populate bridge ref in useEffect (React 19 strict-safe, zero render-phase ref mutation):
useEffect(() => {
  pendingSendBridgeRef.current = {
    recordCompletedUpload: pendingSend.recordCompletedUpload,
    handleConversationResolved: pendingSend.handleConversationResolved,
    handleUploadFailure: pendingSend.handleUploadFailure,
    resetForConversationChange: pendingSend.resetForConversationChange,
  };
}, [
  pendingSend.recordCompletedUpload,
  pendingSend.handleConversationResolved,
  pendingSend.handleUploadFailure,
  pendingSend.resetForConversationChange,
]);

// 5. Submit logic & ComposerSubmitButton (zero conflict between double-Enter & click-to-cancel):
const hasPromptText = Boolean(input.trim());
const isReady =
  !disabled &&
  (isImageMode
    ? hasPromptText
    : effectiveUploadBusy
      ? hasPromptText
      : hasPromptText || fileCount > 0);

// handleSubmit():
//   if (disabled || isSubmittingRef.current || isStreaming) return;
//   if (isImageMode && onImageGen) { /* unchanged image mode */ return; }
//   if (effectiveUploadBusy) {
//     if (hasPromptText && !pendingSend.isPendingSend) pendingSend.queuePendingSend();
//     return; // Double-Enter is an idempotent no-op!
//   }
//   if (hasPromptText || fileCount > 0) dispatchSend(pendingSend.consumeMergedFileIds());

// Inside src/app/features/chat/components/hooks/usePendingUploadSend.ts (Internal Effect Order):
// 1. Cancel effect #1: prevInputRef !== input -> cancelPendingSend()
// 2. Cancel effect #2: prevConversationIdRef !== null && prevConversationIdRef !== conversationId -> onConversationSwitch() + reset()
// 3. Cancel effect #3: (disabled || isStreaming || isImageMode || !hasPromptText) && isPendingSendRef.current -> cancelPendingSend()
// 4. Auto-flush effect (DECLARED LAST):
//    if (!isPendingSendRef.current) return; // Synchronous ref guard guarantees cancel effects always win in same commit!
//    if (!isPendingSendReadyToFlush(...)) return;
//    /* mark isPendingSendRef=false, setIsPendingSend(false), consumeMergedFileIds(), call onFlushSend(ids) */

// Inside src/app/features/chat/components/ComposerSubmitButton.tsx:
// - isStreaming                     -> <button type="submit" ...><Square /></button> (form onSubmit -> onStop)
// - !isStreaming && isPendingSend   -> <button type="button" onClick={onCancelPendingSend} ...><Loader2 /></button>
// - !isStreaming && !isPendingSend  -> <button type="submit" disabled={!isReady} ...><SendHorizontal /></button>
```

#### 6.4. Adversarial Timelines (Concurrency, TOCTOU, Cleanup & Serverless)

```text
Cơ chế: New Chat Switch (null -> conv-existing), Multi-Switch Stale Resolve/Reject & Unmount
T1: Trên New Chat #1 (sessionId=0), user thả photo.png -> enqueueFiles([photo.png]) + isPreparingUpload=true
    trước await ensureConversationId(); user gõ "Mô tả ảnh" và bấm Enter (isPendingSend=true).
T2: (a) User chọn "conv-existing" (session 0 vẫn active, switchedAway===true);
    hoặc (b) user đổi tiếp sang "conv-2" / unmount / mở New Chat #2 (uploadSessionIdRef=1 -> isStale() của session 0 === true).
T3: Sau await ensureConversationId(): kiểm tra if (isStale()) ĐẦU TIÊN -> ở (b), session 0 chỉ dọn batch của chính nó rồi return
    (KHÔNG gọi onSessionReset, KHÔNG ghi đè isSelfInitiatedUploadRef trong catch, KHÔNG giảm preparingCountRef trong finally);
    ở (a), session 0 chưa stale nên switchedAway===true -> reset isSelfInitiatedUploadRef=false và gọi onSessionReset()
    TRƯỚC removeBatchFromQueue() & finally.
Kết cục: (a) 0 XHR mở, 0 tự gửi nhầm vào "conv-existing"; (b) 0 hủy nhầm "conv-2", 0 ghi đè New Chat #2, 0 setState sau unmount -> An toàn

Cơ chế: New Chat Promotion (null -> conv-new) + clearSentFileIds() & SWR Lag
T1: Trên New Chat (conversationId=null), photo.png tải xong (id="f-1") với isPendingSend=true, expectedConversationId="conv-new".
T2: Prop conversationId đổi sang "conv-new" trong 1 commit React. Không còn useEffect([conversationId]) vô điều kiện gọi clearSentFileIds();
    shouldClearQueue(null, "conv-new", true) trả false nên onSessionReset không chạy; prevConvId===null nên fallback không chạy.
T3: isPendingSendReadyToFlush trả true (currentConversationId==="conv-new" && hasPromptText) ->
    mergeDispatchFileIds(files, ["f-1"], sent) trả ["f-1"] -> markAsSent(["f-1"]) + onSubmit(["f-1"]) chạy 1 lần;
    sentFileIds giữ nguyên ["f-1"] (không bị xóa ngược trong cùng commit).
Kết cục: 1 hội thoại, 1 tin nhắn đầy đủ ảnh, thẻ f-1 ẩn ngay không bật lại -> An toàn

Cơ chế: HTTP 200 Thiếu Payload file (uploadedFile === null), XHR Error & Empty-Text Guard
T1: (a) User đang isPendingSend=true với 1 ảnh; server trả HTTP 200 nhưng JSON rỗng -> onSuccess(null);
    (b) Hoặc user đã có fileCount=1 nhưng input="", thả thêm tệp #2 và bấm Gửi/Enter.
T2: (a) useFileUpload ghi logger.error và gọi onErrorRef.current({ code: "UPLOAD_FAILED", filename }) TRƯỚC removeFromQueue;
    handleUploadFailure() đặt isPendingSend=false + 1 toast.info trước khi isUploadBusy tụt về false.
    (b) isReady & handleSubmit yêu cầu hasPromptText===true khi effectiveUploadBusy -> nút Gửi disabled, Enter bị chặn.
Kết cục: Không bao giờ gửi prompt trơn khi payload rỗng, không ẩn mất tệp khi input trống -> An toàn

Cơ chế: Click Nút Chờ Gửi vs Double-Enter, Escape + FileLightbox & External Input Change
T1: User đang isPendingSend=true -> (a) nhấn Enter lần 2; (b) click nút xoay; (c) mở FileLightbox rồi nhấn Escape;
    (d) click gợi ý prompt trên DashboardView (onPromptSelect -> setInput).
T2: (a) Enter đi qua handleSubmit() thấy isPendingSend===true -> no-op; (b) nút xoay là type="button" với onClick=cancelPendingSend
    nên hủy trực tiếp mà không submit form; (c) escapeDisabled={Boolean(lightboxFile)} chặn Escape của usePendingUploadSend
    để Lightbox đóng trước; (d) useEffect([input]) thấy prevInputRef.current !== input -> tự hủy isPendingSend.
Kết cục: Tách bạch tuyệt đối click-to-cancel vs double-Enter, không đụng Lightbox, không gửi nhầm prompt mới -> An toàn

Môi trường serverless: N/A — toàn bộ thay đổi thuộc tầng Client React hooks/UI; không thêm state server hay route API mới.
```

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

#### Giai đoạn 1 — Song ngữ & Pure Helpers

- [ ] **Bước 1.1**: Bổ sung 6 khóa song ngữ (`pendingSendWaiting`, `pendingSendWaitingCount`, `cancelPendingSend`, `pendingSendCancelledOnError`, `sendWhenUploadsReady`, `pendingSendEscHint`) vào `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`.
- [ ] **Bước 1.2**: Bổ sung `mergeDispatchFileIds` và `isPendingSendReadyToFlush` (với `hasPromptText: boolean`) vào `src/lib/features/files/uploadPresentation.ts` + unit tests vào `src/lib/features/files/uploadPresentation.test.ts`.

#### Giai đoạn 2 — Tách `useGlobalFileDropPaste` & Gia cố `useFileUpload`

- [ ] **Bước 2.1**: Tạo `src/lib/features/files/useGlobalFileDropPaste.ts` (tách toàn bộ listener drag/drop & paste từ `useFileUpload.ts`) + tạo co-located `src/lib/features/files/useGlobalFileDropPaste.test.ts`.
- [ ] **Bước 2.2**: Nâng cấp `src/lib/features/files/useFileUpload.ts`:
  - Sử dụng `useGlobalFileDropPaste` và gộp 1 atomic selector `activeUploadCount` (`isUploading = activeUploadCount > 0`).
  - Validate & `enqueueFiles` + `hydrateQueuedImagePreviews` **trước** `await ensureConversationId()`.
  - Thêm `preparingCountRef` / `isPreparingUpload` (reset về `0` trong `cancelActiveUploads()`, chỉ giảm trong `finally` khi `!isStale()`), trả thêm `isPreparingUpload`, `isUploadBusy`, `activeUploadCount`.
  - Thêm options `onConversationResolved` và `onSessionReset`; ngay sau `await ensureConversationIdRef.current()` kiểm tra **`if (isStale())` ĐẦU TIÊN** (`removeBatchFromQueue(); return;`), kế tiếp mới xử lý `switchedAway` (đặt `isSelfInitiatedUploadRef.current = false` + gọi `onSessionResetRef.current?.()` **trước** xóa `queuedItems` / hạ `isPreparingUpload`) và `!targetConvId` (hoặc thiếu `ensureConversationId`: gọi `onErrorRef.current?.({ code: "CONVERSATION_INIT_FAILED" })` trước khi dọn queue); trong khối `catch`, đặt `isSelfInitiatedUploadRef.current = false` **bên trong `if (!isStale())`**.
  - Trên nhánh HTTP 200 thiếu payload `file` (`!isUnmountedRef.current && !uploadedFile`), ghi `logger.error` và gọi `onErrorRef.current?.({ code: "UPLOAD_FAILED", filename: item.filename })` **trước** `removeFromQueue`.
  - Gọi `onErrorRef.current?.(...)` **trước** khi đặt `setStatus(..., "error")`.
  - Bảo đảm `useFileUpload.ts <= 330L` (`<= 350L` Hard Max) sau Prettier.
- [ ] **Bước 2.3**: Cập nhật `src/lib/features/files/useFileUpload.test.ts` kiểm chứng toàn bộ hành vi mới (gồm `switchedAway`, `!targetConvId`, `uploadedFile === null`, stale `finally`, và giữ xanh 100% test cũ).

#### Giai đoạn 3 — Hooks `useComposerFileActions`, `usePendingUploadSend` & Components `PendingUploadSendBanner`, `ComposerSubmitButton`

- [ ] **Bước 3.1**: Tạo `src/app/features/chat/components/hooks/useComposerFileActions.ts` (tách `handleUploadComplete`, `handleRemoveFile`, `handleClearAll` từ `InputForm.tsx`) + tạo co-located `src/app/features/chat/components/hooks/useComposerFileActions.test.ts`.
- [ ] **Bước 3.2**: Tạo `src/app/features/chat/components/hooks/usePendingUploadSend.ts` (máy trạng thái Queue-to-Send yêu cầu `hasPromptText`, gộp `recentCompletedIds`, chờ đồng bộ `expectedConversationId`, **khai báo toàn bộ `useEffect` tự hủy [`prevInputRef`, `prevConversationIdRef`, `disabled || isStreaming || isImageMode`] TRƯỚC `useEffect` auto-flush kèm guard `if (!isPendingSendRef.current) return;`**, `Escape` guard `escapeDisabled` + IME + `!e.defaultPrevented`, hủy trên error/unmount) + tạo co-located `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts`.
- [ ] **Bước 3.3**: Tạo `src/app/features/chat/components/PendingUploadSendBanner.tsx` (chuẩn Emil Design Engineering + Vikini v4 tokens + `useReducedMotion()` + a11y `role="status"` + nút `<button>` **Hủy gửi**) + tạo co-located `src/app/features/chat/components/PendingUploadSendBanner.test.tsx`.
- [ ] **Bước 3.4**: Tạo `src/app/features/chat/components/ComposerSubmitButton.tsx` (nút `type="button"` kèm `onClick={onCancelPendingSend}` khi `isPendingSend && !isStreaming`; `type="submit"` cho Send bình thường và Stop khi `isStreaming`) + tạo co-located `src/app/features/chat/components/ComposerSubmitButton.test.tsx`.

#### Giai đoạn 4 — Tích Hợp `InputForm` & Kiểm Thử Tích Hợp

- [ ] **Bước 4.1**: Cập nhật `src/app/features/chat/components/InputForm.tsx` nối `useComposerFileActions`, `useFileUpload` và `usePendingUploadSend` qua `pendingSendBridgeRef` (cập nhật trong `useEffect`, 0 vòng phụ thuộc TDZ), bỏ `useEffect([conversationId])` vô điều kiện gọi `clearSentFileIds()` tại `src/app/features/chat/components/InputForm.tsx:217-220` và chỉ gọi `clearSentFileIds()` khi chuyển hội thoại thực sự, truyền `escapeDisabled={Boolean(lightboxFile)}`, gắn `<PendingUploadSendBanner />` và `<ComposerSubmitButton />`, yêu cầu `Boolean(input.trim())` khi `effectiveUploadBusy`, tự hủy `isPendingSend` khi sửa text / chèn giọng nói / hủy tệp / xóa tệp / vào Image Mode, và gợi ý `Esc` khi `isFocused && isPendingSend`. Bảo đảm `InputForm.tsx <= 455L` (`<= 500L` Hard Max) sau Prettier.
- [ ] **Bước 4.2**: Cập nhật `src/app/features/chat/components/InputForm.test.tsx` (cập nhật mock `useFileUpload` + chuyển `NP-3b` theo đặc tả Loại C sang đầy đủ kịch bản `TC-QS-02`..`TC-QS-09`).

#### Giai đoạn 5 — Living Docs, Prettier, Full Verify & Playwright Visual QA

- [ ] **Bước 5.1**: Cập nhật `docs/CHANGELOG.md` và ghi bài học hậu xử lý vào `docs/lessons-learned.md`.
- [ ] **Bước 5.2**: Chạy `npx prettier --write` trên toàn bộ tệp mới/sửa rồi `npx prettier --check` (bảo đảm `TC-13` không trượt khi `lint-staged` chạy).
- [ ] **Bước 5.3**: Chạy `npm run type-check; npm run lint; npm run test:run`.
- [ ] **Bước 5.4**: Thực hiện **Playwright Visual QA** trên `C:\Users\wyemh\vikini` ở **Desktop (`1440×900`)** và **Mobile (`375×812`)** × **Dark** & **Light** themes cho trạng thái đang tải ảnh + `PendingUploadSendBanner` (`isPendingSend = true`) và trạng thái sau khi tự động gửi thành công kèm ảnh; dùng `read_file` soi từng ảnh `.png`, dừng server và dọn tệp tạm.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Mọi tiêu chí dưới đây là **BẮT BUỘC PASS** để `@qa` nghiệm thu (chống specification gaming):

| ID         | Thành phần / Luồng                                                                                                                                                         | Input / Kịch bản                                                                                                                                                                                                                                                                                                     | Expected Output / Hành vi bắt buộc                                                                                                                                                                                                                                                                                                                                                                                                                   | Failure Mode / Boundary Condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TC-QS-01` | `useFileUpload` (New Chat blind window, `switchedAway`, `uploadedFile === null`, stale `isStale()` / `catch` / `finally`)                                                  | Trên New Chat (`conversationId = null`), gọi `uploadFiles([photo.png])` với `ensureConversationId` trả về Promise chưa resolve. Kiểm thử cả nhánh thành công `"conv-new"`, reject, trả chuỗi rỗng `""`, chuyển sang `"conv-existing"`, multi-switch / unmount (`isStale()`), và HTTP 200 thiếu `file`.               | **Ngay lập tức (đồng bộ trước khi `ensureConversationId` resolve)**: `uploadQueue` đã chứa `photo.png` (`status: "queued"`), `isPreparingUpload === true`, `isUploading === true`, `isUploadBusy === true`, `activeUploadCount === 1`, `MockXHR.instances.length === 0`. Khi resolve `"conv-new"`: gọi `onConversationResolved("conv-new")`, `isPreparingUpload === false`, mở XHR #1 giữ `isUploadBusy === true`.                                   | **NP-1**: (a) Nếu `ensureConversationId` reject hoặc trả `""` khi `!isStale()`, gọi `onError({ code: "CONVERSATION_INIT_FAILED" })` **trước** khi xóa queue và hạ `isPreparingUpload` (0 thẻ ma); (b) nếu chuyển sang `"conv-existing"` giữa chừng khi `isPendingSend = true` (session chưa stale), nhánh `switchedAway` gọi `onSessionReset()` + đặt `isSelfInitiatedUploadRef.current = false` **trước** khi xóa queue/hạ `isPreparingUpload` (0 XHR mở, 0 tự gửi nhầm vào `"conv-existing"`); (c) HTTP 200 payload thiếu `file` (`uploadedFile === null`) ghi `logger.error` + gọi `onError({ code: "UPLOAD_FAILED" })` **trước** `removeFromQueue`; (d) khi session cũ đã `isStale()` (multi-switch `null -> conv-1 -> conv-2`, unmount, hoặc mở lại New Chat #2): resolve cũ **KHÔNG** gọi `onSessionReset()` của `"conv-2"`/sau unmount, reject cũ trong `catch` **KHÔNG** ghi đè `isSelfInitiatedUploadRef.current` của New Chat #2, và `finally` **KHÔNG** giảm nhầm `preparingCountRef` của session mới. |
| `TC-QS-02` | `InputForm`, `ComposerSubmitButton` & `usePendingUploadSend` (Queue-to-Send happy path — Loại C spec update tại `src/app/features/chat/components/InputForm.test.tsx:549`) | `isUploadBusy = true`, `input = "Giải thích ảnh này"`. Người dùng nhấn `Enter` trên desktop (hoặc click nút Gửi). Sau đó tệp tải xong với `{ id: "f-new", conversation_id: "conv-1" }` ngay cả khi SWR `files` vẫn rỗng `[]`.                                                                                        | Nút Gửi **khả dụng** (`type="submit"`, không `disabled`), `onSubmit` **chưa** bị gọi ngay, `<PendingUploadSendBanner />` hiện (`role="status"` + nút **Hủy gửi**), nút hành động chuyển sang `type="button"` kèm spinner + `onClick` hủy chờ gửi. Khi upload xong (`isUploadBusy` ➔ `false`), tự động gọi `markAsSent(["f-new"])` và `onSubmit(["f-new"])` **đúng 1 lần** kèm đầy đủ ID (gộp cả `files` sẵn có + `recentCompletedIds`, không trùng). | **NP-2**: Nhấn `Enter` lặp lại lần 2 khi đã `isPendingSend = true` là no-op (không hủy nhầm, không gọi `onSubmit` sớm). Nhấn `Enter` trong khi `isComposing = true` hoặc `keyCode = 229` (IME Telex) không kích hoạt `isPendingSend` và không `preventDefault`. **NP-7**: Khi `fileCount === 1`, `input === ""` và `isUploadBusy === true`, nút Gửi bị `disabled`, nhấn `Enter` không kích hoạt `isPendingSend`, `markAsSent` & `onSubmit` bị gọi `0` lần.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `TC-QS-03` | `usePendingUploadSend` + `uploadPresentation` + `InputForm` (New Chat `null -> conv-new` sync, `sentFileIds` retention & SWR lag)                                          | Trên New Chat (`conversationId = null`), ảnh bắt đầu tải ➔ user nhấn `Enter` (`isPendingSend = true`) ➔ `ensureConversationId` resolve `"conv-new"` ➔ XHR hoàn tất trả `f-1` **trước** khi prop `conversationId` kịp chuyển thành `"conv-new"`.                                                                      | `isPendingSendReadyToFlush` trả `false` chừng nào `conversationId !== "conv-new"`. Ngay khi prop `conversationId` cập nhật thành `"conv-new"` (`onSessionReset` và `clearSentFileIds` KHÔNG bị gọi vì là self-initiated), auto-send chạy **đúng 1 lần** với `onSubmit(["f-1"])` và **khẳng định `useFileStore.getState().sentFileIds` vẫn chứa `"f-1"`** sau khi commit kết thúc (thẻ `f-1` không bật lại trên `FilePreviewArea`).                   | `mergeDispatchFileIds(swrFiles, ["f-1"], ["f-old-sent"])` luôn trả `["f-1"]` không trùng khi SWR đã có `f-1`, và loại bỏ sạch `f-old-sent`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `TC-QS-04` | `usePendingUploadSend` & `InputForm` (Drop thêm tệp khi đang chờ gửi)                                                                                                      | Tệp A đang tải, user nhấn `Enter` (`isPendingSend = true`), rồi thả thêm tệp B. Tệp A hoàn tất trước trong khi tệp B vẫn đang `uploading`.                                                                                                                                                                           | Khi A hoàn tất, vì B vẫn trong `uploadQueue` (`isUploadBusy === true`), `onSubmit` **chưa** chạy và ID của A được giữ trong `recentCompletedIds`. Khi B hoàn tất (`isUploadBusy === false`), `onSubmit` gọi **1 lần duy nhất** với `["id-A", "id-B"]`.                                                                                                                                                                                               | Nếu tệp B là tệp không hợp lệ (ví dụ `.exe`) bị chặn client validation trong lúc `isPendingSend = true` ➔ `handleUploadFailure()` hủy `isPendingSend` và hiện thông báo để người dùng biết.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `TC-QS-05` | `usePendingUploadSend` & `InputForm` (Upload error cancellation)                                                                                                           | Hai tệp `[A, B]` đang tải, `isPendingSend = true`. Tệp A thất bại (HTTP 500, mạng, hoặc HTTP 200 thiếu `file`), tệp B sau đó tải xong thành công.                                                                                                                                                                    | Ngay khi A lỗi: `isPendingSend` chuyển về `false`, giữ nguyên nội dung `input`, hiện `toast.error` (lỗi tệp A) + **đúng 1 lần** `toast.info(t("pendingSendCancelledOnError"))`. Khi B hoàn tất sau đó, **KHÔNG** tự động gửi.                                                                                                                                                                                                                        | **NP-3**: Nếu cả A và B đều lỗi liên tiếp, `toast.info(t("pendingSendCancelledOnError"))` chỉ hiện **1 lần duy nhất** (không spam lặp), và `onSubmit` bị gọi `0` lần.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `TC-QS-06` | `InputForm`, `ComposerSubmitButton` & `usePendingUploadSend` (User explicit cancel & external `input` change)                                                              | `isPendingSend = true` khi đang tải tệp A. Kiểm thử từng thao tác: (a) click nút **Hủy gửi** trên banner; (b) click nút xoay `ComposerSubmitButton` (`type="button"`); (c) nhấn `Escape`; (d) gõ sửa text; (e) nhận `onFinalTranscript` từ `VoiceButton`; (f) prop `input` đổi từ bên ngoài (gợi ý `DashboardView`). | Cả 6 thao tác đều lập tức đặt `isPendingSend = false`, ẩn banner, giữ nguyên nội dung prompt (hoặc prompt mới) và để tệp A tiếp tục tải bình thường; khi tệp A tải xong, `onSubmit` **KHÔNG** bị gọi tự động.                                                                                                                                                                                                                                        | **NP-4**: Khi `escapeDisabled={true}` (`lightboxFile !== null`) hoặc `e.defaultPrevented === true` (Popover/Dropdown đang mở) hoặc `isComposing === true`, nhấn `Escape` **KHÔNG** hủy `isPendingSend`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `TC-QS-07` | `InputForm` & `usePendingUploadSend` (Hủy 1 tệp đang tải / xóa tệp đã tải khi đang chờ gửi)                                                                                | Tệp A đang tải, `input = "Phân tích ảnh này"`, `isPendingSend = true`. Người dùng bấm `×` hủy tệp A (hoặc xóa tệp sẵn có `handleRemoveFile` / `handleClearAll`).                                                                                                                                                     | `cancelPendingSend()` chạy **trước** khi `cancelUpload(tempIdA)` xóa A khỏi hàng đợi ➔ `isPendingSend` về `false`, prompt giữ nguyên trong textarea, và `onSubmit` **KHÔNG** bị gọi trơn thiếu ảnh. Nếu xóa tệp đã up (`handleRemoveFile`), `forgetCompletedFile(id)` loại ID đó khỏi `recentCompletedIds`.                                                                                                                                          | **NP-5**: Sau khi hủy tệp A duy nhất, chờ flush effect chạy — `onSubmit` bị gọi `0` lần.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `TC-QS-08` | `usePendingUploadSend` & `InputForm` (Conversation switch, Image Mode, `isStreaming`, `disabled`, Unmount)                                                                 | `isPendingSend = true`. Chuyển `conversationId` từ `"conv-1"` sang `"conv-2"`, hoặc bật `isImageMode` / `isStreaming` / `disabled`, hoặc `unmount()` trước khi upload xong.                                                                                                                                          | `isPendingSend` lập tức hủy sạch, `recentCompletedIds` & `expectedConversationId` bị xóa, `clearSentFileIds()` được gọi khi chuyển hội thoại thực sự; `onSubmit` **KHÔNG** bao giờ bị gọi vào hội thoại `"conv-2"` hoặc sau khi unmount.                                                                                                                                                                                                             | **NP-6**: Nếu `isUploadBusy` về `false` cùng lúc hoặc ngay sau khi đổi `"conv-1" -> "conv-2"`, `onSubmit` bị gọi `0` lần.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `TC-QS-09` | `PendingUploadSendBanner`, `ComposerSubmitButton`, `useGlobalFileDropPaste` & `useComposerFileActions`                                                                     | Render banner (`visible={true}` count `1`/`3`, `visible={false}`), render `ComposerSubmitButton` đủ 5 trạng thái; test drag/drop/paste & xóa file HTTP 500.                                                                                                                                                          | Banner hiển thị đúng khóa `pendingSendWaiting` / `pendingSendWaitingCount`, nút **Hủy gửi** là native `<button type="button">` gọi `onCancel`, có `role="status"`, không `transition-all`, chữ `>= text-xs`. `ComposerSubmitButton` dùng `type="button"` khi `isPendingSend` và `type="submit"` khi thường/`isStreaming`. `useGlobalFileDropPaste` dọn 100% listener khi unmount; `useComposerFileActions` giữ xử lý lỗi HTTP 500 + `toast.error`.   | Banner với `visible={false}` không render nội dung chờ gửi vào DOM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Danh sách tệp test co-located (8 suites + 3 static/regression suites)

1. `src/lib/features/files/uploadPresentation.test.ts` (cập nhật — `TC-QS-03`, `NP-7`)
2. `src/lib/features/files/useGlobalFileDropPaste.test.ts` (mới — `TC-QS-09`)
3. `src/lib/features/files/useFileUpload.test.ts` (cập nhật — `TC-QS-01`, `NP-1`)
4. `src/app/features/chat/components/hooks/useComposerFileActions.test.ts` (mới — `TC-QS-09`)
5. `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts` (mới — `TC-QS-02`..`TC-QS-08`, `NP-3`, `NP-4`, `NP-6`, `NP-7`)
6. `src/app/features/chat/components/PendingUploadSendBanner.test.tsx` (mới — `TC-QS-09`)
7. `src/app/features/chat/components/ComposerSubmitButton.test.tsx` (mới — `TC-QS-02`, `TC-QS-06`, `TC-QS-09`)
8. `src/app/features/chat/components/InputForm.test.tsx` (cập nhật — `TC-QS-02`..`TC-QS-08`, `NP-2`, `NP-5`, `NP-7`)
9. Static & regression checks bắt buộc chạy kèm: `src/lib/config/theme-config.test.ts` (`TC-13` / `TC-14`) & `src/lib/features/files/store.test.ts` & `src/lib/features/files/fileUploadHelpers.test.ts`.

#### Lệnh kiểm chứng (Windows PowerShell 5.1 — dùng `;`, KHÔNG dùng `&&`)

```powershell
# 1. Kiểm tra định dạng Prettier trước để khóa chắc trần dòng TC-13
npx prettier --check src/lib/features/files/ src/app/features/chat/components/InputForm.tsx src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/PendingUploadSendBanner.tsx src/app/features/chat/components/PendingUploadSendBanner.test.tsx src/app/features/chat/components/ComposerSubmitButton.tsx src/app/features/chat/components/ComposerSubmitButton.test.tsx src/app/features/chat/components/hooks/useComposerFileActions.ts src/app/features/chat/components/hooks/useComposerFileActions.test.ts src/app/features/chat/components/hooks/usePendingUploadSend.ts src/app/features/chat/components/hooks/usePendingUploadSend.test.ts src/lib/utils/translations/

# 2. Chạy tập trung các suite liên quan + bộ chốt chặn tĩnh TC-13 / TC-14
npx vitest run --reporter=dot src/lib/features/files/ src/app/features/chat/components/hooks/useComposerFileActions.test.ts src/app/features/chat/components/hooks/usePendingUploadSend.test.ts src/app/features/chat/components/PendingUploadSendBanner.test.tsx src/app/features/chat/components/ComposerSubmitButton.test.tsx src/app/features/chat/components/InputForm.test.tsx src/lib/config/theme-config.test.ts

# 3. Full Verification Gate (Tier 2)
npm run type-check; npm run lint; npm run test:run
```

#### Wiring Probes (WP) & Negative Probes (NP)

- **WP-1 (Static Guards & Hook/Component Line Budget)**: `npx vitest run src/lib/config/theme-config.test.ts` xác nhận `TC-13` (mọi hook `src/app/**/use*.ts <= 350L`, 0 `transition-all`, 0 dead hover, 0 lucide namespace, 0 `t: Record<string, string>`) và `TC-14` (0 unscoped `use*Store()`).
- **WP-2 (ESLint Design Token & Exhaustive-Deps Wiring)**: `npx eslint --print-config src/app/features/chat/components/PendingUploadSendBanner.tsx` và `src/app/features/chat/components/ComposerSubmitButton.tsx` xác nhận `vikini-design/no-legacy-tokens` và `react-hooks/exhaustive-deps` đang ở mức `error`, và `npm run lint` ra 0 errors / 0 warnings.
- **WP-3 (Bilingual Compile-Time Parity)**: `npm run type-check` kiểm chứng khớp 100% khóa giữa `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts` tại `src/lib/utils/translations/index.ts`.
- **NP-1 (New Chat Init Failure, `null -> conv-existing` Switch-Away, `uploadedFile === null` & Stale Session Isolation Probe)**: Trong `src/lib/features/files/useFileUpload.test.ts` và `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts`, kiểm chứng: (a) `ensureConversationId()` reject / trả `""` khi `!isStale()` gọi `onError` trước khi xóa queue (0 ghost card); (b) chuyển sang `"conv-existing"` giữa lúc `ensureConversationId()` đang chờ khi `isPendingSend = true` gọi `onSessionReset()` trước khi hạ `isUploadBusy` (0 XHR, 0 tự gửi nhầm vào `"conv-existing"`); (c) HTTP 200 payload thiếu `file` gọi `logger.error` + `onError` trước `removeFromQueue`; (d) khi session cũ đã `isStale()` (multi-switch `null -> conv-1 -> conv-2`, unmount, hoặc mở lại New Chat #2): resolve cũ không gọi `onSessionReset()` của `"conv-2"` / sau unmount, reject cũ trong `catch` không ghi đè `isSelfInitiatedUploadRef.current` của New Chat #2, và `finally` không giảm `preparingCountRef` của session mới.
- **NP-2 (Double-Enter Idempotency & IME Telex Guard Probe)**: Trong `src/app/features/chat/components/InputForm.test.tsx`, nhấn `Enter` 2 lần khi đang upload không hủy `isPendingSend` và không gọi `onSubmit` sớm; nhấn `Enter` với `isComposing=true` / `keyCode=229` không kích hoạt `isPendingSend`.
- **NP-3 (Upload Failure Anti-Spam & Zero Partial Send Probe)**: Trong `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts`, lỗi liên tiếp 2 tệp chỉ gọi `toast.info` 1 lần, hủy `isPendingSend`, và không gọi `onFlushSend` khi tệp còn lại hoàn tất.
- **NP-4 (`Escape` Respects `escapeDisabled` Lightbox, Modal/Popover `defaultPrevented` & IME Probe)**: Trong `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts` & `InputForm.test.tsx`, nhấn `Escape` khi `lightboxFile !== null` (`escapeDisabled={true}`) hoặc `e.defaultPrevented === true` hoặc `isComposing === true` không hủy `isPendingSend`.
- **NP-5 (Cancel Only Uploading File Never Auto-Sends Prompt Without Image Probe)**: Trong `src/app/features/chat/components/InputForm.test.tsx`, bấm `×` hủy ảnh duy nhất khi `isPendingSend = true` đặt `isPendingSend = false` trước khi hàng đợi rỗng ➔ `onSubmit` bị gọi `0` lần.
- **NP-6 (Cross-Conversation Switch Never Leaks Pending Send Probe)**: Trong `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts` & `InputForm.test.tsx`, đổi `conversationId` từ `"conv-1"` sang `"conv-2"` khi đang `isPendingSend = true` hủy sạch và không bao giờ gọi `onSubmit` vào `"conv-2"`.
- **NP-7 (Empty Prompt With Existing File Never Arms Queue-to-Send Probe)**: Trong `src/app/features/chat/components/InputForm.test.tsx` & `src/app/features/chat/components/hooks/usePendingUploadSend.test.ts`, khi `fileCount === 1`, `input === ""` và `isUploadBusy === true`, nút Gửi bị `disabled`, `Enter` không kích hoạt `isPendingSend`, và `markAsSent` / `onSubmit` bị gọi `0` lần.

#### Visual QA Gate (Bắt buộc cho thay đổi UI/CSS — `.agents/rules/03-ui.md`)

1. Khởi chạy `npx next dev --webpack -H 127.0.0.1 -p 3100` từ đường dẫn chuẩn chữ hoa ổ `C:\Users\wyemh\vikini` trên Windows (`docs/lessons-learned.md:882`).
2. Dùng Playwright mock auth + làm chậm `/api/files/upload` (~1500ms) và mock `/api/chat-stream` qua `page.route` để chụp ảnh `.png` vào thư mục tạm ngoài git ở cả **Desktop (`1440×900`)** và **Mobile (`375×812`)** × **Dark** & **Light** themes cho 2 trạng thái:
   - Đang upload ảnh + người dùng vừa nhấn `Enter` ➔ hiển thị `<PendingUploadSendBanner />` (spinner + thông điệp song ngữ + nút **Hủy gửi**) + `<ComposerSubmitButton />` ở trạng thái chờ xoay + thẻ ảnh đang upload, kiểm tra `scrollWidth <= innerWidth` không tràn viền Mobile 375px.
   - Sau khi `/api/files/upload` trả 200 ➔ banner biến mất mượt, tin nhắn tự động gửi kèm ảnh hiển thị trong cuộc trò chuyện.
3. Gọi `read_file` đọc trực tiếp từng ảnh `.png` để tự kiểm tra bố cục, khoảng cách, tương phản chữ/nút trong cả Dark & Light, và không có khóa dịch thô. Dừng server và dọn sạch tệp tạm.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                                                                           | Mức độ         | Technical Control cụ thể (`[SRC]` / Negative Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1 — Vượt trần dòng `TC-13` / `.agents/rules/01-coding.md:101-106` sau Prettier** (`src/lib/features/files/useFileUpload.ts` 340L, `src/app/features/chat/components/InputForm.tsx` 489L)      | **Cao**        | Tách cấu trúc trước khi thêm logic: (1) tách `useGlobalFileDropPaste.ts` (~68L) + gộp 1 atomic selector `activeUploadCount` kéo `useFileUpload.ts` xuống **~325L** (`<= 330L <= 350L`); (2) tách `useComposerFileActions.ts` (~95L), `usePendingUploadSend.ts` (~185L), `PendingUploadSendBanner.tsx` (~85L), và `ComposerSubmitButton.tsx` (~60L) kéo `InputForm.tsx` xuống **~448L** (`<= 455L <= 500L`). Kiểm chứng bắt buộc bằng `npx prettier --check` + `src/lib/config/theme-config.test.ts:453-460` (`WP-1`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **R2 — Race chuyển hội thoại (`null -> conv-existing`, multi-switch / stale `catch` / unmount), `clearSentFileIds()` xóa ngược `markAsSent()`, hoặc thứ tự effect trong `usePendingUploadSend`** | **Cao**        | (1) Sau `await ensureConversationIdRef.current()`, kiểm tra **`if (isStale())` ĐẦU TIÊN** trước `switchedAway`/`!targetConvId`, đặt `isSelfInitiatedUploadRef.current = false` bên trong `if (!isStale())` ở nhánh `catch`, và guard `!isStale()` trong `finally`; trên `switchedAway` (khi `!isStale()`), gọi `onSessionResetRef.current?.()` trước khi xóa queue/hạ `isPreparingUpload`; (2) bỏ `useEffect([conversationId])` vô điều kiện gọi `clearSentFileIds()` tại `src/app/features/chat/components/InputForm.tsx:217-220`, chỉ gọi khi chuyển hội thoại thực sự; (3) nối `useFileUpload` ↔ `usePendingUploadSend` qua `pendingSendBridgeRef` cập nhật trong `useEffect` (0 TDZ); (4) trong `usePendingUploadSend.ts`, khai báo toàn bộ `useEffect` tự hủy (`prevInputRef`, `prevConversationIdRef`, `disabled \|\| isStreaming \|\| isImageMode`) **TRƯỚC** `useEffect` auto-flush kèm guard `if (!isPendingSendRef.current) return;`. Kiểm chứng bằng `TC-QS-01`, `TC-QS-03`, `TC-QS-06`, `TC-QS-08`, `NP-1` & `NP-6`. |
| **R3 — Auto-send bắn trước khi `conversationId` prop kịp đồng bộ trên New Chat ➔ `useChatStreamExecution` tạo hội thoại thứ 2 trùng lặp**                                                        | **Cao**        | `useFileUpload` gọi `onConversationResolved(targetConvId)` và `usePendingUploadSend` khóa điều kiện `isPendingSendReadyToFlush` yêu cầu `currentConversationId === expectedConversationId` trước khi gọi `onSubmit`, bảo đảm closure `handleSend` tại `src/app/features/chat/components/hooks/useChatStreamExecution.ts:137-159` đã có đúng `conv-new`. Kiểm chứng bằng `TC-QS-03`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **R4 — Race tự động gửi prompt trơn khi tệp lỗi, HTTP 200 thiếu payload `file` (`uploadedFile === null`), hoặc người dùng bấm `×` hủy ảnh duy nhất**                                             | **Cao**        | Thực thi quy tắc **hủy chờ trước khi hạ cờ bận**: (1) `useFileUpload.ts` gọi `onErrorRef.current?.(...)` **trước** `setStatus(..., "error")` và `removeFromQueue(...)` tại cả nhánh XHR lỗi, `CONVERSATION_INIT_FAILED`, `!targetConvId`, lẫn `!uploadedFile` (kèm `logger.error`); (2) `InputForm.tsx` gọi `pendingSend.cancelPendingSend()` **trước** `cancelUpload(tempId)` / `handleRemoveFile` / `handleClearAll`. Kiểm chứng bằng `TC-QS-01`, `TC-QS-05`, `TC-QS-07`, `NP-1`, `NP-3`, `NP-5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **R5 — Mâu thuẫn nút Gửi click-to-cancel vs double-Enter, hoặc xếp hàng khi `input` trống (`fileCount > 0`) làm ẩn tệp mà không gửi tin**                                                        | **Cao**        | (1) `ComposerSubmitButton.tsx` chuyển rõ sang `type="button"` với `onClick={onCancelPendingSend}` khi `isPendingSend && !isStreaming` (còn `Enter` lặp qua `handleSubmit()` là idempotent no-op); (2) siết `isReady`, `handleSubmit` và `isPendingSendReadyToFlush` yêu cầu `Boolean(input.trim())` khớp hợp đồng `!text` tại `src/app/features/chat/components/hooks/useChatStreamExecution.ts:174`. Kiểm chứng bằng `TC-QS-02`, `TC-QS-06`, `NP-2`, `NP-7`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **R6 — SWR cache chưa kịp cập nhật `files` khi auto-send kích hoạt (gửi thiếu file vừa tải) hoặc tái sử dụng ID tệp đã xóa**                                                                     | **Trung bình** | Hợp nhất đồng bộ qua `mergeDispatchFileIds(files, recentCompletedIds, allSentIds)` trong `src/lib/features/files/uploadPresentation.ts`; gọi `forgetCompletedFile(id)` khi xóa tệp đơn, `clearCompletedFiles()` khi xóa tất cả/gửi xong/chuyển hội thoại. Kiểm chứng bằng `TC-QS-02`, `TC-QS-03`, `TC-QS-07`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **R7 — Xung đột phím `Escape` với `FileLightbox` (Radix Dialog) / `Popover`, IME Telex, hoặc `input` đổi từ bên ngoài (`DashboardView`)**                                                        | **Trung bình** | Truyền `escapeDisabled={Boolean(lightboxFile)}` (`src/app/features/chat/components/FileLightbox.tsx:10`, `src/app/features/chat/components/InputForm.tsx:85`) kết hợp guard IME (`isComposing \|\| keyCode === 229`) và `!e.defaultPrevented`; theo dõi `prevInputRef` trong `usePendingUploadSend` để tự hủy khi `input` đổi từ bên ngoài (`src/app/features/chat/components/ChatApp.tsx:315`). Kiểm chứng bằng `TC-QS-06`, `NP-2`, `NP-4`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **R8 — Tệp lỗi cũ trong `uploadQueue` (status `"error"`) làm `isUploadBusy` kẹt `true` mãi mãi**                                                                                                 | **Trung bình** | `activeUploadCount` tại `src/lib/features/files/useFileUpload.ts:41-45` chỉ đếm `queued \| uploading \| processing` (không đếm `"error"`), và `preparingCountRef` luôn giảm trong `finally` (khi `!isStale()`) + reset về `0` trong `cancelActiveUploads()`, nên `isUploadBusy` không bao giờ kẹt `true`. Kiểm chứng bằng `TC-QS-01`, `TC-QS-05`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision 1 (lượt thẩm định đầu tiên — không có lỗi lượt cũ).
- Kết quả `node scripts/verify-plan.mjs docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - `63/63` tham chiếu `LINE_REF` đạt `[PASS]`
  - `[INFO] CRITIC_REQUIRED no`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

#### Critic Findings

| #   | Loại           | Mức       | `file:line`                                                            | Bằng chứng      | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------- | --------- | ---------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | `[MAJOR]` | `src/lib/features/chat/draftConversation.ts:22`                        | `[SRC]` `[ADV]` | **Race chuyển hội thoại `null -> conv-existing` khi `ensureConversationId()` đang chờ gây tự gửi prompt trơn vào nhầm hội thoại**: Khi tải tệp ở New Chat, `isSelfInitiatedUploadRef.current = true` và `isPreparingUpload = true`; nếu user bấm Enter (`isPendingSend = true`, `expectedConversationId = null`) rồi chuyển sang `"conv-existing"` trước khi `ensureConversationId()` resolve, `shouldClearQueue(null, "conv-existing", true)` tại `src/lib/features/chat/draftConversation.ts:22` trả `false` nên `useFileUpload` (`src/lib/features/files/useFileUpload.ts:318-327`) không gọi `onSessionReset()`. Cơ chế dự phòng `prevConvId !== null && prevConvId !== conversationId` trong `usePendingUploadSend` cũng bỏ qua vì `prevConvId === null`. Khi `ensureConversationId()` resolve `"conv-new"`, nhánh `switchedAway` (và `!targetConvId`) xóa `queuedItems` và hạ `isPreparingUpload` mà không gọi `onSessionResetRef.current?.()` / `onErrorRef.current?.(...)` ➔ `isPendingSendReadyToFlush` thấy `isPendingSend = true`, `isUploadBusy = false`, `expectedConversationId = null` nên trả `true` và tự gửi prompt thiếu ảnh vào `"conv-existing"`. Cần: (a) gọi `onSessionResetRef.current?.()` (và reset `isSelfInitiatedUploadRef.current = false`) trên nhánh `switchedAway`, và `onErrorRef.current?.({ code: "CONVERSATION_INIT_FAILED" })` trên `!targetConvId && !isStale()`, **trước** khi xóa `queuedItems` và hạ `isPreparingUpload`; (b) trong `finally`, chỉ giảm `preparingCountRef` khi `!isStale()` để tránh session cũ giảm nhầm bộ đếm sau khi `cancelActiveUploads()` đã reset về `0`; (c) bổ sung Negative Probe cho `null -> conv-existing` khi `isPendingSend = true`. |
| 2   | DEFECT         | `[MAJOR]` | `src/app/features/chat/components/InputForm.tsx:217-220`               | `[SRC]` `[ADV]` | **Lỗi thứ tự `useEffect` (`clearSentFileIds()` xóa ngược `markAsSent()`) & phụ thuộc vòng chưa giải quyết giữa `useFileUpload` và `usePendingUploadSend`**: (a) Trong React, `useEffect` chạy tuần tự theo thứ tự khai báo trong cùng một commit. Nếu `usePendingUploadSend` khai báo phía trên `src/app/features/chat/components/InputForm.tsx:217-220`, ở commit thăng cấp `null -> conv-new` (`TC-QS-03`), effect flush của `usePendingUploadSend` chạy trước (`markAsSent(["f-1"])`), sau đó effect tại dòng `218-220` chạy ngay sau trong cùng commit và gọi `clearSentFileIds()` xóa `sentFileIds` về `[]`, làm tệp vừa gửi hiện lại trên `FilePreviewArea`. (b) Kế hoạch truyền `pendingSend.handleUploadFailure` / `handleConversationResolved` / `resetForConversationChange` vào `useFileUpload` (`src/app/features/chat/components/InputForm.tsx:144-160`), nhưng `usePendingUploadSend` lại cần `isUploadBusy` từ kết quả trả về của `useFileUpload` ➔ phát sinh vòng phụ thuộc TDZ nếu không chốt cơ chế cầu nối ref (`pendingSendHandlersRef` cập nhật qua `useEffect`) hoặc tách thứ tự khai báo rõ ràng. Cần chốt rõ thiết kế không vòng phụ thuộc, chỉ gọi `clearSentFileIds()` trên chuyển hội thoại thực sự (trong `onSessionReset` / `prevConvId !== null && prevConvId !== conversationId`) hoặc đảm bảo khai báo trước flush effect, và khẳng định trong `TC-QS-03` rằng `sentFileIds` không bị xóa sau `markAsSent`.                                                                                                                                                                                                                                                                     |
| 3   | DEFECT         | `[MAJOR]` | `src/lib/features/files/useFileUpload.ts:223-237`                      | `[SRC]`         | **Phản hồi HTTP 200 thiếu payload `file` (`uploadedFile === null`) hạ `isUploadBusy` mà không hủy `isPendingSend`**: `src/lib/features/files/fileUploadHelpers.ts:248-260` gọi `onSuccess(null)` và resolve khi HTTP 200 chứa JSON sai định dạng. Tại `src/lib/features/files/useFileUpload.ts:234-236`, nhánh `else` chỉ gọi `removeFromQueue(item.tempId)` mà không gọi `onError` hay `onUploadComplete`. Nếu đang `isPendingSend = true` và đây là tệp duy nhất, `isUploadBusy` tụt về `false` trong khi `isPendingSend` vẫn `true` ➔ tự động gửi prompt trơn thiếu ảnh mà không báo lỗi. Cần bổ sung tại nhánh `!isUnmountedRef.current && !uploadedFile`: ghi `logger.error` và gọi `onErrorRef.current?.({ code: "UPLOAD_FAILED", filename: item.filename })` **trước** `removeFromQueue(item.tempId)`, kèm unit test trong `useFileUpload.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4   | DEFECT         | `[MAJOR]` | `src/app/features/chat/components/InputForm.tsx:300-307`               | `[SRC]`         | **Mâu thuẫn cơ chế nút Gửi (`type="submit"`) với yêu cầu click-to-cancel vs. double-Enter idempotent**: Tại `src/app/features/chat/components/InputForm.tsx:445-464`, nút Gửi có `type="submit"` không có `onClick` nên mọi thao tác click đều đi qua `<form onSubmit>` (`InputForm.tsx:300-307`) ➔ gọi `handleSubmit()`. Kế hoạch vừa yêu cầu `handleSubmit()` là no-op khi đã `isPendingSend = true` (cho `NP-2` double-Enter), vừa yêu cầu click nút Gửi đang xoay sẽ gọi `pendingSend.cancelPendingSend()` (`TC-QS-06 (b)`). Hai hành vi mâu thuẫn trừ khi đổi rõ thuộc tính nút Gửi sang `type="button"` kèm `onClick={pendingSend.cancelPendingSend}` khi `isPendingSend && !isStreaming` (tương tự nút hủy Image Mode tại `src/app/features/chat/components/InputForm.tsx:425`), và giữ `type="submit"` cho trạng thái bình thường / `isStreaming`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | DEFECT         | `[MAJOR]` | `src/app/features/chat/components/hooks/useChatStreamExecution.ts:174` | `[SRC]`         | **Xếp hàng chờ gửi khi `input` rỗng nhưng đã có `fileCount > 0` làm mất thẻ tệp mà không gửi tin nhắn**: Tại `src/app/features/chat/components/hooks/useChatStreamExecution.ts:174`, `coreSend` bỏ qua im lặng khi `!text` (`if (!isAuthed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |     | creatingConversation |     | !text) return;`), được gọi trực tiếp từ `src/app/features/chat/components/ChatControls.tsx:134`. Nếu user đã có 1 tệp (`fileCount === 1`), để trống `input`, thả thêm tệp thứ 2 (`isUploadBusy === true`) rồi nhấn Gửi, điều kiện `Boolean(input.trim()) |     | fileCount > 0`vẫn kích hoạt`isPendingSend = true`; khi tệp thứ 2 xong, `dispatchSend`gọi`markAsSent(["f-1", "f-2"])`(ẩn vĩnh viễn cả 2 tệp khỏi composer) rồi`onSubmit`bị`coreSend` bỏ qua không gửi gì. Cần siết điều kiện kích hoạt và flush Queue-to-Send (`queuePendingSend`/`isPendingSendReadyToFlush`/`isReady`khi`isUploadBusy`) yêu cầu `Boolean(input.trim())`khớp với hợp đồng`!text`của`coreSend`. |
| 6   | DEFECT         | `[MAJOR]` | `src/app/features/chat/components/InputForm.tsx:1-489`                 | `[SRC]`         | **Dự toán số dòng `InputForm.tsx` vượt ngưỡng Hard Max `500` dòng (`.agents/rules/01-coding.md:101-106`) sau Prettier**: `InputForm.tsx` hiện `489L`. Tách `useComposerFileActions` (`handleUploadComplete` L109-126, `handleRemoveFile` L163-176, `handleClearAll` L178-205, `useSWRConfig`, `logger`) chỉ giảm `~68L` xuống `~421L`; bổ sung 2 hook mới, cầu nối ref chống vòng phụ thuộc, `dispatchSend`, các wrapper hủy `isPendingSend`, `<PendingUploadSendBanner />`, nhánh trạng thái nút Gửi `isPendingSend`, và gợi ý `Esc` tăng `~80–90L` sau Prettier (`printWidth: 100`) ➔ ước tính `~501–511L`, vượt Hard Max `500L` (không phải `~445L` như ước lượng). Cần tách thêm một thành phần UI gọn (ví dụ `ComposerSubmitButton.tsx` ~55L gộp `sendButtonClasses` + nút Send/Stop/Pending) để đưa `InputForm.tsx` xuống thực tế `<= 455L`, đồng thời dùng 1 selector `activeUploadCount` (`isUploading = activeUploadCount > 0`) trong `useFileUpload.ts` để giữ `<= 330L` (`<= 350L`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | DEFECT         | `[MINOR]` | `src/app/features/chat/components/FileLightbox.tsx:10`                 | `[SRC]`         | **`Escape` guard với `FileLightbox` (`@radix-ui/react-dialog`) & thay đổi `input` từ bên ngoài**: `FileLightbox.tsx:10` dùng Radix Dialog `DismissableLayer` vốn không tự gọi `e.preventDefault()` trên phím `Escape`; vì `InputForm.tsx:85` đang giữ trực tiếp state `lightboxFile`, nên truyền `escapeDisabled={Boolean(lightboxFile)}` vào `usePendingUploadSend` kết hợp `!e.defaultPrevented`. Đồng thời cân nhắc theo dõi thay đổi `input` khi `isPendingSend = true` (kể cả khi `DashboardView` gọi `onPromptSelect={setInput}` tại `src/app/features/chat/components/ChatApp.tsx:315`) để tự hủy đồng nhất.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 8   | RISK_DISMISSED | `[MINOR]` | `src/app/features/chat/components/ChatApp.tsx:210-211`                 | `[SRC]`         | **Rủi ro unmount `InputForm` khi thăng cấp New Chat `null -> conv-new` bị bác bỏ**: Tại `src/app/features/chat/components/ChatApp.tsx:210-211` và `312-322`, `showLanding` giữ `true` khi `renderedMessages.length === 0`, nên `<ChatControls isLanding={true} />` và `<InputForm />` giữ nguyên instance trong suốt quá trình `ensureConversationId()` cập nhật `selectedConversationId`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9   | RISK_DISMISSED | `[MINOR]` | `src/lib/utils/translations/en.ts:1801-1827`                           | `[SRC]`         | **Rủi ro xung đột khóa dịch và hồi quy `useFileUpload.test.ts` bị bác bỏ**: Đối chiếu `src/lib/utils/translations/en.ts:1801-1827` và `src/lib/utils/translations/vi.ts:1809-1835` cho thấy 6 khóa đề xuất không trùng lặp; đối chiếu `src/lib/features/files/useFileUpload.test.ts:129-175` xác nhận kịch bản `NP-2` tương thích với việc đẩy `buildQueuedUploadItems` + `enqueueFiles` lên trước `await ensureConversationId()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                             | Kết quả | Bằng chứng      | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan Completeness Gate (7 mục + Skills)         | `PASS`  | `[CMD]` `[SRC]` | `verify-plan.mjs` xác nhận `7/7` heading bắt buộc và `63/63` `LINE_REF` hợp lệ; đủ 4 skill bắt buộc (`vikini-debug`, `vikini-investigate`, `emil-design-eng`, `add-translation`), bảng `/blast-radius` có đủ caller/mock và mục đích Spec Change Loại C cho `InputForm.test.tsx:549-577`.                                                                                                                                                                                                                                                                          |
| S1: Cold-start & Build                          | `PASS`  | `[CMD]` `[SRC]` | `npm run type-check` (exit `0`), `npx vitest run` (`10` files, `143` tests pass, exit `0`); không thêm gói npm ngoài hay biến môi trường mới; toàn bộ đường dẫn `[NEW]` khớp kiến trúc 4 tầng (`src/lib/features/files/`, `src/app/features/chat/components/`).                                                                                                                                                                                                                                                                                                    |
| S2: Runner Lifecycle & Teardown                 | `FAIL`  | `[SRC]` `[ADV]` | Phát hiện 2 lỗ hổng vòng đời: (1) `preparingCountRef` trong `finally` chưa chặn `!isStale()` sau khi `cancelActiveUploads()` (`src/lib/features/files/useFileUpload.ts:72-96`) đặt lại bộ đếm về `0`; (2) `InputForm.tsx` còn vòng phụ thuộc hook chưa định nghĩa cơ chế cắt vòng (`Finding #2`) và vượt trần `500L` sau Prettier (`Finding #6`).                                                                                                                                                                                                                  |
| S3: Database & Temporal Logic                   | `N/A`   | `[SRC]`         | Kế hoạch chỉ thay đổi client React hooks, UI composer và từ điển song ngữ; không sửa bảng Supabase, SQL migration, RLS policy hay logic lưu trữ DB.                                                                                                                                                                                                                                                                                                                                                                                                                |
| S4: Cross-Task State Flow (Zustand / SWR / URL) | `FAIL`  | `[SRC]` `[ADV]` | Phát hiện 5 lỗi đồng bộ trạng thái trên mã nguồn thực tế: race `null -> conv-existing` (`Finding #1`, `draftConversation.ts:22`), thứ tự `useEffect` `clearSentFileIds()` xóa `markAsSent()` (`Finding #2`, `InputForm.tsx:217-220`), `uploadedFile === null` không hủy `isPendingSend` (`Finding #3`, `useFileUpload.ts:223-237`), mâu thuẫn `type="submit"` click-to-cancel vs. double-Enter (`Finding #4`, `InputForm.tsx:300-307`), và `fileCount > 0` + `input === ""` bị `coreSend` bỏ qua sau `markAsSent` (`Finding #5`, `useChatStreamExecution.ts:174`). |
| S5: Security Boundary & 3-Tier Auth             | `N/A`   | `[SRC]`         | Không thêm/sửa API route `src/app/api/**`, không chạm `*.server.ts`, không đổi xác thực NextAuth/RLS/Upstash Redis (`CRITIC_REQUIRED no`).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| S6: External Resilience & Serverless Cap        | `N/A`   | `[SRC]`         | Không sửa provider AI ngoài hay cấu hình `maxDuration` serverless; client XHR timeout/retry giữ nguyên cơ chế hiện hữu tại `src/lib/features/files/fileUploadHelpers.ts:248-288`.                                                                                                                                                                                                                                                                                                                                                                                  |
| Domain: Bilingual, UI Tokens & Attachments      | `PASS`  | `[SRC]` `[CMD]` | 6 khóa song ngữ mới không trùng (`vi.ts:1809-1835`, `en.ts:1801-1827`), `eslint.config.mjs:119-144` bật `error` cho token thiết kế và `react-hooks/exhaustive-deps`, `src/lib/config/theme-config.test.ts:437-524` (`TC-13`/`TC-14`) pass baseline.                                                                                                                                                                                                                                                                                                                |

#### 3. Adversarial Timelines & Commands Executed

```text
1. Trục Đồng Thời — New Chat Switch (null -> conv-existing) Trong Lúc ensureConversationId() Đang Chờ:
T1: Trên New Chat (conversationId=null), user thả photo.png -> uploadFiles() đặt isSelfInitiatedUploadRef=true,
    isPreparingUpload=true, await ensureConversationId(); user gõ prompt và nhấn Enter (isPendingSend=true, expectedConversationId=null).
T2: Trước khi POST /api/conversations xong, user chọn hội thoại "conv-existing" trên sidebar ->
    shouldClearQueue(null, "conv-existing", true) trả false (draftConversation.ts:22) -> không gọi onSessionReset();
    usePendingUploadSend bỏ qua fallback vì prevConvId === null.
T3: ensureConversationId() resolve "conv-new" -> finally hạ isPreparingUpload=false; nhánh switchedAway xóa queuedItems
    (isUploading=false) nhưng KHÔNG gọi onSessionReset() -> isPendingSendReadyToFlush thấy expectedConversationId===null
    và isUploadBusy===false nên trả true.
Kết cục: Tự động gửi prompt trơn (0 tệp) vào sai hội thoại "conv-existing" -> Lỗi ([MAJOR] - Finding #1).

2. Trục TOCTOU — Commit Thăng Cấp New Chat (null -> conv-new) & Thứ Tự Effect clearSentFileIds():
T1: Trên New Chat (conversationId=null), ảnh f-1 tải xong trước khi prop conversationId đổi (recentCompletedIds=["f-1"],
    expectedConversationId="conv-new", isPendingSend=true).
T2: Prop conversationId đổi sang "conv-new" trong 1 commit React; usePendingUploadSend (nếu khai báo trước InputForm.tsx:218)
    chạy effect flush trước -> gọi markAsSent(["f-1"]) + onSubmit(["f-1"]).
T3: Ngay trong cùng commit đó, useEffect([conversationId]) tại InputForm.tsx:218-220 chạy sau -> gọi clearSentFileIds().
Kết cục: sentFileIds bị xóa về [] ngay sau khi vừa gửi, thẻ f-1 bật lại trong FilePreviewArea -> Lỗi ([MAJOR] - Finding #2).

3. Trục Thất Bại Giữa Chừng — HTTP 200 Payload Rỗng (uploadedFile === null) & Empty-Text + Existing File:
T1: User đang isPendingSend=true với 1 ảnh đang tải; server trả HTTP 200 nhưng JSON thiếu trường file -> onSuccess(null)
    (fileUploadHelpers.ts:248-260).
T2: useFileUpload.ts:234-236 gọi removeFromQueue(tempId) mà không gọi onError -> isUploadBusy về false trong khi isPendingSend=true.
T3: Tương tự, nếu input="" nhưng fileCount===1 khi thả tệp thứ 2 và bấm Gửi -> dispatchSend gọi markAsSent() rồi
    useChatStreamExecution.ts:174 trả sớm vì !text.
Kết cục: Gửi prompt trơn thiếu ảnh (hoặc ẩn mất tệp mà không gửi tin) -> Lỗi ([MAJOR] - Findings #3 & #5).

4. Trục Môi Trường Serverless:
N/A — Toàn bộ phạm vi chỉ nằm ở client React hooks/components; không thêm state in-memory server hay route serverless mới.
```

- **Commands Executed (Read-Only Allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md` — exit `0` (`VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED no`).
  2. `npm run type-check` — exit `0` (`tsc --noEmit` sạch).
  3. `npx vitest run --reporter=dot src/lib/config/theme-config.test.ts src/lib/features/files/ src/app/features/chat/components/InputForm.test.tsx` — exit `0` (`10 passed`, `143 passed`).
  4. `git status -s` — exit `0` (`M tsconfig.tsbuildinfo`, `?? docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md`).

#### 4. Kết Luận

Kế hoạch có nền tảng phân tích lỗi gốc rõ ràng và bộ Test Contract chi tiết, nhưng còn **6 lỗi `[MAJOR]`** có bằng chứng trực tiếp trên codebase (`Findings #1–#6`) liên quan đến race chuyển hội thoại `null -> conv-existing`, thứ tự `useEffect` `clearSentFileIds()` + vòng phụ thuộc hook, phản hồi HTTP 200 thiếu `file`, mâu thuẫn `type="submit"` click-to-cancel, mất tệp khi `input` rỗng + `fileCount > 0`, và nguy cơ vượt ngưỡng `500L` tại `InputForm.tsx`. Đề nghị `@planner` cập nhật lên **Revision 2** để xử lý triệt để cả 6 mục `[MAJOR]` (và khuyến nghị `[MINOR]` #7) trước khi thẩm định lại.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Kết quả `node scripts/verify-plan.mjs docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ `LINE_REF` đạt `[PASS]`
  - `[INFO] CRITIC_REQUIRED no`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

| Lỗi Audit Run 1                                                                                                                           | Trạng thái     | Đối chiếu `[SRC]` / Ghi chú                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `#1 [MAJOR]` Race `null -> conv-existing`, `!targetConvId`, stale `finally` (`src/lib/features/chat/draftConversation.ts:22`)             | `SỬA MỘT PHẦN` | Đã bổ sung `onSessionResetRef.current?.()` trên `switchedAway`, `onError` trên `!targetConvId`, và guard `!isStale()` trong `finally`; nhưng đặt `if (switchedAway)` **trước** `if (isStale())` và đặt `isSelfInitiatedUploadRef.current = false` ngoài `if (!isStale())` trong `catch` phát sinh lỗi hồi quy session cũ / sau unmount (xem Critic Finding #1 bên dưới). |
| `#2 [MAJOR]` Thứ tự `clearSentFileIds()` & vòng phụ thuộc hook (`src/app/features/chat/components/InputForm.tsx:217-220`)                 | `ĐÃ SỬA`       | Đã bỏ `useEffect([conversationId])` vô điều kiện, chuyển `clearSentFileIds()` vào `onSessionReset` / `onConversationSwitch` và chốt cầu nối `pendingSendBridgeRef` cập nhật qua `useEffect` (không TDZ, không mutate ref trong render).                                                                                                                                  |
| `#3 [MAJOR]` HTTP 200 thiếu payload `file` (`src/lib/features/files/useFileUpload.ts:223-237`)                                            | `ĐÃ SỬA`       | Đã bổ sung fail-closed `logger.error` + `onErrorRef.current?.({ code: "UPLOAD_FAILED", filename })` trước `removeFromQueue` kèm `TC-QS-01` NP-1(c) & `TC-QS-05`.                                                                                                                                                                                                         |
| `#4 [MAJOR]` Nút `type="submit"` click-to-cancel vs. double-Enter (`src/app/features/chat/components/InputForm.tsx:300-307,445-464`)      | `ĐÃ SỬA`       | Đã tách `ComposerSubmitButton.tsx` đổi sang `type="button"` kèm `onClick={onCancelPendingSend}` khi `isPendingSend && !isStreaming`, giữ `type="submit"` cho Send bình thường và Stop khi `isStreaming`.                                                                                                                                                                 |
| `#5 [MAJOR]` Empty-text + `fileCount > 0` bị `coreSend` bỏ qua (`src/app/features/chat/components/hooks/useChatStreamExecution.ts:174`)   | `ĐÃ SỬA`       | Đã siết `isReady`, `handleSubmit` và `isPendingSendReadyToFlush` yêu cầu `hasPromptText` (`Boolean(input.trim())`) khi `effectiveUploadBusy`, kèm `NP-7`.                                                                                                                                                                                                                |
| `#6 [MAJOR]` Ngân sách dòng `InputForm.tsx <= 500L` & `useFileUpload.ts <= 350L` (`src/app/features/chat/components/InputForm.tsx:1-489`) | `ĐÃ SỬA`       | Đã tách thêm `ComposerSubmitButton.tsx` (~60L) đưa `InputForm.tsx` dự kiến còn ~445L (`<= 500L`) và gộp 1 selector `activeUploadCount` giữ `useFileUpload.ts` ~326L (`<= 350L`).                                                                                                                                                                                         |
| `#7 [MINOR]` `Escape` với `FileLightbox` & thay đổi `input` từ bên ngoài (`src/app/features/chat/components/FileLightbox.tsx:10`)         | `ĐÃ SỬA`       | Đã thêm `escapeDisabled={Boolean(lightboxFile)}` và theo dõi `prevInputRef` trong `usePendingUploadSend`.                                                                                                                                                                                                                                                                |

#### Critic Findings

| #   | Loại           | Mức       | `file:line`                                                 | Bằng chứng      | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------- | --------- | ----------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | `[MAJOR]` | `src/lib/features/files/useFileUpload.ts:89-96`             | `[SRC]` `[ADV]` | **Hồi quy kiểm tra `if (switchedAway)` trước `if (isStale())` & ghi `isSelfInitiatedUploadRef.current = false` ngoài `if (!isStale())` trong `catch`**: Tại `src/lib/features/files/useFileUpload.ts:89-96,158-178`, `isStale()` trả `true` khi component đã unmount hoặc `cancelActiveUploads()` đã tăng `uploadSessionIdRef` ở lần chuyển hội thoại trước. Thiết kế Revision 2 chạy `if (switchedAway)` (gọi `onSessionResetRef.current?.()` và đặt `isSelfInitiatedUploadRef.current = false`) **trước** `if (isStale())`, đồng thời ở nhánh `catch` đặt `isSelfInitiatedUploadRef.current = false` vô điều kiện trước `if (!isStale())`. Hậu quả: (a) nếu New Chat chuyển sang `"conv-1"` rồi unmount trong lúc `ensureConversationId()` đang chờ, khi promise resolve `"conv-new"`, `switchedAway` là `true` sẽ gọi `onSessionResetRef.current?.()` **sau khi unmount**; (b) nếu chuyển `null -> conv-1 -> conv-2` và user bắt đầu tải/chờ gửi ở `"conv-2"`, promise cũ resolve `"conv-new"` sẽ chạy `onSessionResetRef.current?.()` và **hủy nhầm `isPendingSend` + xóa `sentFileIds` của `"conv-2"`**; (c) nếu chuyển `null -> conv-1 -> null` và bắt đầu upload ở New Chat thứ 2 (`isSelfInitiated = true`), promise cũ reject ở `catch` sẽ ghi đè `isSelfInitiatedUploadRef.current = false`, khiến New Chat thứ 2 tự abort khi resolve. **Cách sửa**: kiểm tra `if (isStale()) { removeBatchFromQueue(); return; }` **đầu tiên** ngay sau `await ensureConversationIdRef.current()` (trước `switchedAway` và `!targetConvId`), chuyển `if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;` vào **bên trong** `if (!isStale())` ở nhánh `catch`, và bổ sung kiểm chứng vào `TC-QS-01` NP-1(d). |
| 2   | DEFECT         | `[MINOR]` | `src/app/features/chat/components/InputForm.tsx:217-220`    | `[SRC]`         | **Chốt rõ thứ tự `useEffect` nội bộ trong `usePendingUploadSend.ts`**: Khai báo các effect tự hủy (`prevInputRef` đổi `input`, `prevConversationIdRef` chuyển hội thoại, `disabled \|\| isStreaming \|\| isImageMode`) **trước** effect auto-flush (và kiểm tra lại `isPendingSendRef.current` trong effect auto-flush), để nếu `input` hoặc `disabled` thay đổi trong cùng commit với lúc `isUploadBusy` tụt về `false`, nhánh hủy luôn thắng tuyệt đối.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3   | RISK_DISMISSED | `[MINOR]` | `src/app/features/chat/components/InputForm.test.tsx:50-65` | `[SRC]`         | **Rủi ro lệch mock `useLanguage` khi tách `ComposerSubmitButton.tsx` bị bác bỏ**: Cả `InputForm.tsx` lẫn `ComposerSubmitButton.tsx` cùng nằm tại `src/app/features/chat/components/` nên dùng chung đường dẫn `"../hooks/useLanguage"` khớp mock tại `src/app/features/chat/components/InputForm.test.tsx:50-65`, giữ nguyên nhãn `"Send"` / `"Stop generation"` / `"Stop"` cho các bài test cũ tại `InputForm.test.tsx:154-195` và tuân thủ `TC-13` (0 `t` prop-drilling).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | RISK_DISMISSED | `[MINOR]` | `src/app/features/chat/components/InputForm.tsx:1-489`      | `[SRC]`         | **Rủi ro vượt trần `500L` tại `InputForm.tsx` và `350L` tại `useFileUpload.ts` bị bác bỏ ở Revision 2**: `InputForm.tsx` giảm `489 - 68 (useComposerFileActions) - 30 (ComposerSubmitButton) - 6 (bỏ effect clearSentFileIds) + ~60 (wiring + banner + bridge) ≈ 445L` (`<= 500L`), và `useFileUpload.ts` với 1 selector `activeUploadCount` còn `340 - 47 + ~33 ≈ 326L` (`<= 350L`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                             | Kết quả | Bằng chứng      | Chi tiết                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7 mục + Skills)         | `PASS`  | `[CMD]` `[SRC]` | `verify-plan.mjs` đạt `7/7` heading và mọi `LINE_REF` hợp lệ; toàn bộ tệp `[NEW]`/`[MODIFY]` (gồm `ComposerSubmitButton.tsx` và `ComposerSubmitButton.test.tsx`) đều khai báo đầy đủ trong mục 5; không chạm tệp nhạy cảm (`CRITIC_REQUIRED no`).                                                                                           |
| S1: Cold-start & Build                          | `PASS`  | `[CMD]` `[SRC]` | Baseline `npm run type-check` (exit `0`) và `vitest` (`10` files, `143` tests pass, exit `0`) sạch; `git status -s` xác nhận không có thay đổi source ngoài plan; toàn bộ module mới khớp ranh giới 4 tầng.                                                                                                                                 |
| S2: Runner Lifecycle & Teardown                 | `FAIL`  | `[SRC]` `[ADV]` | Nhánh `if (switchedAway)` chạy trước `if (isStale())` cho phép gọi `onSessionResetRef.current?.()` sau khi component đã unmount (`src/lib/features/files/useFileUpload.ts:89-96`, Critic Finding #1).                                                                                                                                       |
| S3: Database & Temporal Logic                   | `N/A`   | `[SRC]`         | Không thay đổi bảng Supabase, SQL migration hay RLS policy.                                                                                                                                                                                                                                                                                 |
| S4: Cross-Task State Flow (Zustand / SWR / URL) | `FAIL`  | `[SRC]` `[ADV]` | 5/6 lỗi S4 từ lượt 1 đã xử lý (`clearSentFileIds`, `pendingSendBridgeRef`, `uploadedFile === null`, `ComposerSubmitButton` `type="button"`, `hasPromptText`), nhưng còn lỗ hổng cross-session do `switchedAway` và `catch` không kiểm tra `isStale()` trước khi chạm `onSessionResetRef` và `isSelfInitiatedUploadRef` (Critic Finding #1). |
| S5: Security Boundary & 3-Tier Auth             | `N/A`   | `[SRC]`         | Không sửa `src/app/api/**`, `*.server.ts` hay lớp xác thực/rate-limit (`CRITIC_REQUIRED no`).                                                                                                                                                                                                                                               |
| S6: External Resilience & Serverless Cap        | `N/A`   | `[SRC]`         | Không sửa provider AI ngoài hay cấu hình `maxDuration` serverless.                                                                                                                                                                                                                                                                          |
| Domain: Bilingual, UI Tokens & Attachments      | `PASS`  | `[SRC]` `[CMD]` | 6 khóa song ngữ sạch, `ComposerSubmitButton` dùng `useLanguage()` trực tiếp, `eslint.config.mjs:119-144` và `src/lib/config/theme-config.test.ts:437-524` giữ chốt chặn token và `TC-13`/`TC-14`.                                                                                                                                           |

#### 3. Adversarial Timelines & Commands Executed

```text
1. Trục Đồng Thời — Multi-Switch (null -> conv-1 -> conv-2) Khi ensureConversationId() Cũ Chưa Resolve:
T1: Trên New Chat (null), user thả photo.png -> sessionId=0, await ensureConversationId() (chậm 2s).
T2: User bấm sang "conv-1" rồi sang "conv-2" -> shouldClearQueue("conv-1", "conv-2", false)===true ->
    cancelActiveUploads() tăng uploadSessionIdRef=1 (isStale() của session 0 = true); ở "conv-2" user tải report.pdf
    và nhấn Enter (isPendingSend=true trên "conv-2").
T3: Promise cũ của session 0 resolve "conv-new" -> Revision 2 kiểm tra switchedAway ("conv-2" !== "conv-new") TRƯỚC isStale()
    -> gọi onSessionResetRef.current?.().
Kết cục: Hủy nhầm isPendingSend và gọi clearSentFileIds() của hội thoại đang hoạt động "conv-2" -> Lỗi ([MAJOR] - Finding #1).

2. Trục TOCTOU — Stale Catch Ghi Đè isSelfInitiatedUploadRef Của New Chat Thứ 2:
T1: New Chat #1 (sessionId=0) thả ảnh -> await ensureConversationId() chậm.
T2: User chuyển sang "conv-1" (sessionId=1) rồi mở lại New Chat #2 (null) và thả ảnh mới -> isSelfInitiatedUploadRef.current = true.
T3: Promise cũ của session 0 bị reject -> nhánh catch chạy isSelfInitiatedUploadRef.current = false TRƯỚC if (!isStale()).
Kết cục: Khi New Chat #2 resolve "conv-new-2", shouldClearQueue(null, "conv-new-2", false) trả true và tự abort XHR của New Chat #2 -> Lỗi ([MAJOR] - Finding #1).

3. Trục Thất Bại Giữa Chừng / Dọn Dẹp — Unmount Sau Khi Chuyển Sang "conv-1" Trong Lúc ensureConversationId() Chờ:
T1: New Chat (null) thả ảnh -> user chuyển "conv-1" -> component unmount (isUnmountedRef=true -> isStale()=true).
T2: ensureConversationId() resolve "conv-new" -> switchedAway===true chạy trước isStale() -> gọi onSessionResetRef.current?.().
Kết cục: Gọi callback đổi state/store sau khi component đã unmount -> Lỗi ([MAJOR] - Finding #1).

4. Trục Môi Trường Serverless:
N/A — Toàn bộ phạm vi chỉ nằm ở client React hooks/components; không thêm state in-memory server hay route serverless mới.
```

- **Commands Executed (Read-Only Allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md` — exit `0` (`VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED no`).
  2. `git status -s` — exit `0` (`M tsconfig.tsbuildinfo`, `?? docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md`).

#### 4. Kết Luận

Revision 2 đã khắc phục sạch 5/6 lỗi `[MAJOR]` (`#2–#6`) và góp ý `[MINOR]` (`#7`) từ Audit Run 1, tuy nhiên phần bổ sung xử lý `switchedAway` tại `useFileUpload.ts` vẫn còn **1 lỗi `[MAJOR]` hồi quy** (`Finding #1`: đặt `if (switchedAway)` trước `if (isStale())` và đặt `isSelfInitiatedUploadRef.current = false` ngoài `if (!isStale())` trong `catch`). Đề nghị `@planner` cập nhật ngắn gọn lên **Revision 3** (đảo `if (isStale())` lên đầu khối `try`, gói `isSelfInitiatedUploadRef.current = false` trong `if (!isStale())` ở `catch`, thêm assertion vào `TC-QS-01` NP-1(d), và chốt thứ tự effect nội bộ trong `usePendingUploadSend.ts` ở `[MINOR]` #2) để phê duyệt ngay ở Audit Run 3.

[CHANGES_REQUESTED]

---

### Audit Run 3

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Kết quả `node scripts/verify-plan.mjs docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ `LINE_REF` đạt `[PASS]`
  - `[INFO] CRITIC_REQUIRED no`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

| Lỗi Audit Run 2                                                                                                                                                                                         | Trạng thái | Đối chiếu `[SRC]` / Ghi chú                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#1 [MAJOR]` Thứ tự `if (isStale())` trước `if (switchedAway)` & `isSelfInitiatedUploadRef.current = false` trong `if (!isStale())` ở `catch` (`src/lib/features/files/useFileUpload.ts:89-96,158-178`) | `ĐÃ SỬA`   | Đã đặt `if (isStale()) { removeBatchFromQueue(); return; }` ngay đầu khối `try` trước `switchedAway` và `!targetConvId`; chuyển `isSelfInitiatedUploadRef.current = false` vào bên trong `if (!isStale())` ở `catch`; bổ sung kiểm chứng vào `TC-QS-01` NP-1(d) và bảng rủi ro R2. |
| `#2 [MINOR]` Thứ tự `useEffect` tự hủy trước auto-flush trong `usePendingUploadSend.ts` (`src/app/features/chat/components/InputForm.tsx:217-220`)                                                      | `ĐÃ SỬA`   | Đã chốt rõ thứ tự khai báo 3 `useEffect` tự hủy (`prevInputRef`, `prevConversationIdRef`, `disabled \|\| isStreaming \|\| isImageMode`) trước `useEffect` auto-flush kèm guard đồng bộ `if (!isPendingSendRef.current) return;`.                                                   |

#### Critic Findings

| #   | Loại           | Mức       | `file:line`                                              | Bằng chứng | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------- | --------- | -------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | `[MINOR]` | `src/lib/features/files/useFileUpload.ts:89-96`          | `[SRC]`    | **Tối ưu nhỏ khi `isUnmountedRef.current === true` trong nhánh `if (isStale())`**: Cleanup unmount tại `src/lib/features/files/useFileUpload.ts:94` đã gọi `useFileStore.getState().clearQueue()`, nên trong nhánh `if (isStale())` và cuối `catch` có thể thêm điều kiện `if (!isUnmountedRef.current) removeBatchFromQueue()` để tránh gọi `set()` thừa trên Zustand store sau unmount (không gây lỗi runtime — không chặn phê duyệt).     |
| 2   | RISK_DISMISSED | `[MINOR]` | `src/lib/features/files/fileUploadHelpers.ts:305`        | `[SRC]`    | **Rủi ro `removeBatchFromQueue()` của session cũ xóa nhầm tệp của session mới (`"conv-2"`) bị bác bỏ**: `src/lib/features/files/fileUploadHelpers.ts:305` cấp `tempId: crypto.randomUUID()` duy nhất cho từng tệp và `src/lib/features/files/store.ts:132-141` lọc chính xác theo `q.tempId !== tempId`, nên `removeBatchFromQueue()` ở nhánh `isStale()` không thể tác động tới hàng đợi của hội thoại mới.                                 |
| 3   | RISK_DISMISSED | `[MINOR]` | `src/app/features/chat/components/InputForm.tsx:247-252` | `[SRC]`    | **Rủi ro gửi trùng (double-dispatch) khi auto-flush chạy trong React Strict Mode bị bác bỏ**: `usePendingUploadSend` hạ `isPendingSendRef.current = false` và `setIsPendingSend(false)` đồng bộ trước khi gọi `onFlushSend(ids)`, kết hợp chốt chặn `isSubmittingRef` tại `src/app/features/chat/components/InputForm.tsx:247-252` và điều kiện `hasPromptText` khớp `src/app/features/chat/components/hooks/useChatStreamExecution.ts:174`. |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                             | Kết quả | Bằng chứng      | Chi tiết                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7 mục + Skills)         | `PASS`  | `[CMD]` `[SRC]` | `verify-plan.mjs` đạt `7/7` heading và toàn bộ `LINE_REF` hợp lệ; đủ 4 skill bắt buộc, đầy đủ khai báo `[NEW]`/`[MODIFY]` trong mục 5, đủ `WP-1..3` và `NP-1..7`; `CRITIC_REQUIRED no`.                                                                                                                             |
| S1: Cold-start & Build                          | `PASS`  | `[CMD]` `[SRC]` | `npm run type-check` (exit `0`), `vitest` (`10` files, `143` tests pass, exit `0`), `git status -s` sạch; không thêm gói npm hay biến môi trường mới; giữ đúng kiến trúc 4 tầng.                                                                                                                                    |
| S2: Runner Lifecycle & Teardown                 | `PASS`  | `[SRC]` `[ADV]` | `if (isStale())` đứng đầu sau `await ensureConversationIdRef.current()`, `catch` và `finally` đều guard `!isStale()`, `cancelActiveUploads()` (`src/lib/features/files/useFileUpload.ts:89-96`) dọn sạch XHR/timer/sleep/`preparingCountRef`, và `useGlobalFileDropPaste` tháo sạch `window` listeners khi unmount. |
| S3: Database & Temporal Logic                   | `N/A`   | `[SRC]`         | Không thay đổi bảng Supabase, SQL migration hay RLS policy.                                                                                                                                                                                                                                                         |
| S4: Cross-Task State Flow (Zustand / SWR / URL) | `PASS`  | `[SRC]` `[ADV]` | Toàn bộ 6 lỗi trạng thái lượt 1 và 1 lỗi hồi quy `isStale()` lượt 2 đã đóng kín (`switchedAway`, `clearSentFileIds`, `pendingSendBridgeRef`, `uploadedFile === null`, `ComposerSubmitButton` `type="button"`, `hasPromptText`, thứ tự `useEffect` nội bộ `usePendingUploadSend`).                                   |
| S5: Security Boundary & 3-Tier Auth             | `N/A`   | `[SRC]`         | Không chạm `src/app/api/**`, `*.server.ts`, xác thực NextAuth/RLS hay Upstash Redis (`CRITIC_REQUIRED no`).                                                                                                                                                                                                         |
| S6: External Resilience & Serverless Cap        | `N/A`   | `[SRC]`         | Không thay đổi provider AI ngoài hay cấu hình `maxDuration` serverless.                                                                                                                                                                                                                                             |
| Domain: Bilingual, UI Tokens & Attachments      | `PASS`  | `[SRC]` `[CMD]` | 6 khóa song ngữ mới đồng bộ `vi.ts`/`en.ts`, không có `t` prop-drilling, `eslint.config.mjs:119-144` và `src/lib/config/theme-config.test.ts:437-524` bảo vệ token v4 và `TC-13`/`TC-14`.                                                                                                                           |

#### 3. Adversarial Timelines & Commands Executed

```text
1. Trục Đồng Thời — Multi-Switch (null -> conv-1 -> conv-2) & Stale Catch (null -> conv-1 -> null):
T1: New Chat #1 (sessionId=0) thả photo.png -> await ensureConversationId() chậm.
T2: Chuyển sang "conv-1" -> "conv-2" (sessionId=1, isStale() của session 0 === true), user tải tệp & arm isPendingSend ở "conv-2";
    hoặc mở New Chat #2 (isSelfInitiatedUploadRef.current = true).
T3: Promise cũ của session 0 resolve hoặc reject -> if (isStale()) chặn ngay đầu try (không gọi onSessionReset của "conv-2"),
    catch kiểm tra if (!isStale()) (không ghi đè isSelfInitiatedUploadRef của New Chat #2), finally kiểm tra if (!isStale())
    (không giảm preparingCountRef của session mới), removeBatchFromQueue chỉ dọn tempId riêng của session 0.
Kết cục: Session mới và hội thoại "conv-2" hoàn toàn cô lập, 0 hủy nhầm, 0 tự abort -> An toàn.

2. Trục TOCTOU — Same-Commit External Input Change / Disabled vs Upload Completion:
T1: User đang isPendingSend=true với tệp cuối đang tải.
T2: Trong cùng commit React, isUploadBusy chuyển false đồng thời input đổi từ DashboardView (hoặc disabled=true).
T3: Các useEffect tự hủy khai báo trước trong usePendingUploadSend chạy trước -> đặt isPendingSendRef.current = false;
    useEffect auto-flush khai báo cuối thấy !isPendingSendRef.current -> trả sớm.
Kết cục: Không bao giờ tự gửi prompt mới chưa được xác nhận -> An toàn.

3. Trục Thất Bại Giữa Chừng / Dọn Dẹp — Unmount & HTTP 200 Missing File:
T1: (a) Unmount giữa lúc ensureConversationId() đang chờ; hoặc (b) server trả HTTP 200 JSON thiếu file.
T2: (a) isStale()===true chặn mọi onSessionReset/onError/setState; (b) logger.error + onError chạy trước removeFromQueue.
Kết cục: 0 gọi callback sau unmount, 0 gửi prompt trơn thiếu tệp -> An toàn.

4. Trục Môi Trường Serverless:
N/A — Toàn bộ phạm vi chỉ nằm ở client React hooks/components; không thêm state in-memory server hay route serverless mới.
```

- **Commands Executed (Read-Only Allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md` — exit `0` (`VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED no`).
  2. `git status -s` — exit `0` (`M tsconfig.tsbuildinfo`, `?? docs/plans/2026-11-21-queue-send-until-upload-complete-plan.md`).

#### 4. Kết Luận

Revision 3 đã đóng sạch toàn bộ lỗi `[MAJOR]` từ Audit Run 1 và Audit Run 2 (0 `[BLOCKER]`, 0 `[MAJOR]`, chỉ còn 1 tối ưu `[MINOR]` không chặn), đáp ứng đầy đủ Plan Completeness Gate, S1–S6 + Domain và `CRITIC_REQUIRED no`. Phê duyệt kế hoạch để mở khóa triển khai.

[PLAN_APPROVED]
