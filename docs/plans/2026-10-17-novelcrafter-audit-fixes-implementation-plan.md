---
document_type: implementation_plan
round: 7
status: Approved
feature: novelcrafter-audit-fixes
date: 2026-10-17
---

## Technical Plan

### 1. Mục Tiêu (Goal)

Triển khai đồng bộ **Phương án A (Thực dụng — Ưu tiên sửa lỗi thực tế & bổ sung kiểm thử)**: Khắc phục triệt để **100% lỗi chức năng, bảo mật, độ tin cậy, toàn vẹn dữ liệu và UI/A11y** còn tồn tại trên `HEAD` từ báo cáo kiểm toán toàn diện `Novelcrafter Studio (6+1)` (gồm **6 lỗi Nghiêm trọng / Phase 1** và các lỗi **Trung bình & Nhỏ / Phase 2**), đồng thời bổ sung **6 file unit test co-located** còn thiếu trong `src/lib/features/novelcrafter/` và mở rộng **9 file test hiện hữu** để đạt chuẩn chất lượng dự án (`npm run verify` xanh 100%).

> [!NOTE]
> **Giới hạn phạm vi theo Phương án A & Đối chiếu thực tế trên `HEAD` (`m-3`)**:
>
> - **Thực hiện**: Toàn bộ các bản vá lỗi logic/bảo mật/tính năng/UI thuộc **Phase 1**, **Phase 2** trên **27 file mã nguồn** (`[MODIFY]`), tạo mới **6 file unit test co-located** còn thiếu (`characterParser.test.ts`, `openingsParser.test.ts`, `pruneStoryBibleForStream.test.ts`, `streamRunRegistry.test.ts`, `modelGuards.server.test.ts`, `novelcrafterStreamStore.test.ts` — `[NEW]`) và cập nhật **9 file test hiện có** (`novelcrafterStreamRunner.server.test.ts`, `streamQuotaGuard.server.test.ts`, `storyPersistence.server.test.ts`, `src/app/api/novelcrafter/state/route.test.ts`, `draftStorage.test.ts`, `feedbackParser.test.ts`, `promptBuilder.test.ts`, `featureDirectives.test.ts`, `storyBibleSerializer.test.ts` — `[MODIFY]`), tổng cộng **36 mục `[MODIFY]`** và **6 mục `[NEW]`**.
> - **Các hạng mục trong báo cáo cũ đã được giải quyết sẵn trên `HEAD` (loại khỏi phạm vi sửa code để tránh tạo thay đổi giả)**:
>   1. Câu chỉ dẫn `"included in FULL in <previous_chapter_full_text>"` trong `promptBuilder.ts` không còn tồn tại trên `HEAD` (hiện `promptBuilder.ts:311-318` dùng `<previous_chapter_continuity>` và `:326-329` dùng `<preceding_prose>`). Bản vá ở `promptBuilder.ts:326-329` chỉ tập trung vào việc giữ cả phần đầu + phần cuối (head + tail) khi `chapterProse` vượt quá `MAX_CHAPTER_CONTEXT_CHARS` (`18_000` ký tự).
>   2. Các phần tử `<aside>` của `NovelcrafterLeftNavigator.tsx:95` (`w-full md:w-64 lg:w-72`), `NovelcrafterHistoryPane.tsx:61` (`w-full md:w-80 lg:w-96`), và `ChapterFeedbackGutter.tsx:100` (`w-full lg:w-80 xl:w-88`) đã có sẵn `w-full` cho chế độ mobile/sheet, và `ChapterFeedbackGutter.tsx:156` đã dùng `aria-label={t("novelcrafterSlotFeedback")}` (không còn chuỗi cứng `"More actions"`).
>   3. Hằng số `FALLBACK_TRIM_PAYLOAD_BYTES = 1_500_000` (1.5MB) tại `src/app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts:35` đã nằm dưới ngưỡng `DEFAULT_MAX_STATE_PAYLOAD_BYTES = 1_800_000` (`draftStorage.ts:22`) và dưới giới hạn `MAX_STATE_BODY_BYTES = 2 * 1024 * 1024` (`state/route.ts:23`), nên giữ nguyên `1_500_000` và chỉ sửa việc đọc snapshot mới nhất `latestStateRef.current.state` khi thực hiện trim retry.
> - **Không thực hiện trong đợt này**: Tách nhỏ file/hàm chỉ để giảm số dòng theo ngưỡng Hard Max (Phase 3 Architectural Refactoring).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ bảng **Pre-Work Protocol** trong `.agents/rules/02-quality.md` (chỉ liệt kê các tài liệu thực tế tồn tại trong repo — `m-1`):

| Loại thay đổi                    | Tài liệu đã tham chiếu                                                                       | Trọng tâm áp dụng                                                                                                                                                                                                                                                            |
| :------------------------------- | :------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mọi công việc / Kiến trúc**    | `docs/architecture.md`, `.agents/rules/01-coding.md`                                         | Cấu trúc phân lớp thực tế: Route Handlers tại `src/app/api/novelcrafter/`, Feature UI & Hooks tại `src/app/features/novelcrafter/{components,hooks,utils}/`, Domain & Server Logic tại `src/lib/features/novelcrafter/`, Shared Utilities tại `src/lib/utils/`.              |
| **Auth / Security & API Routes** | `docs/security.md`, `.agents/skills/api-patterns.md`, `.agents/skills/streaming-patterns.md` | Chuẩn hóa lỗi trả về qua `sanitizeError()` và `AppError` từ `src/lib/utils/errors.ts`, giữ nguyên log chuỗi `rawMsg` nội bộ (không truyền nguyên object lỗi SDK), bảo vệ Redis rate-limit/in-flight quota, chỉ khấu trừ quota khi model phát `token` chunk thực tế đầu tiên. |
| **UI Components & Đa ngữ**       | `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md`                                    | Quy chuẩn typography tối thiểu `text-xs`, khóa `readOnly` khi story lỗi tải, đồng bộ chuỗi đa ngữ `vi.ts` / `en.ts`.                                                                                                                                                         |
| **Testing & Quality Gate**       | `.agents/rules/02-quality.md`, `.agents/rules/05-plan-review.md`                             | Quy tắc co-located test (`*.test.ts`), kiểm thử biên (boundary conditions), lệnh `npm run verify`.                                                                                                                                                                           |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1. Giả định kỹ thuật (Assumptions)

1. **Bảo toàn API Contract với Client**: Các bản vá ở tầng SSE (`/api/novelcrafter/stream`) và Persistence (`/api/novelcrafter/state`) giữ nguyên cấu trúc JSON/SSE event envelope (`meta`, `thinking`, `token`, `done`, `error`) để không làm gãy client parser `src/app/features/novelcrafter/utils/novelcrafterSseParser.ts`.
2. **Hành vi thực tế của `sanitizeError(error, isProduction)` trong `src/lib/utils/errors.ts:148-256` & Logging nội bộ (`m-5`)**:
   - Khi `isProduction = true`, `sanitizeError` thay thế các mẫu biến môi trường nhạy cảm (`GEMINI_API_KEY`, `*_KEY=...` $\rightarrow$ `[REDACTED]`), địa chỉ IP (`[ip]`), đường dẫn file (`[path]`), stack trace (`at ...` $\rightarrow$ `at [stack]`).
   - Tại `src/lib/utils/errors.ts:233-249`, nếu số lượng mục bị redact `> 3` **hoặc** chuỗi sau khi redact bị rút ngắn xuống `< 50%` độ dài ban đầu (`sanitizationRatio < 0.5 && sanitized !== message`), `sanitizeError` trả về thông báo an toàn tổng quát: `"An error occurred. Please try again later."`.
   - Tại `novelcrafterStreamRunner.server.ts:504-512`, giữ nguyên cách trích xuất `const rawMsg = err instanceof Error ? err.message : String(err);` và log chuỗi `streamLogger.error(\`Novelcrafter stream failed (feature=\${params.feature}, model=\${params.resolvedModelId}): \${rawMsg}\`)`như hiện tại (không truyền nguyên object`err`vào`logger`vì`src/lib/utils/logger.ts`không có bộ lọc redact object), và truyền`sanitizeError(err, true)`vào SSE frame`error`.
3. **Quyết định sản phẩm về Quota khi chỉ có `thinking` chunk (`m-4`)**: Trong `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:410-421`, callback `emitModelOutput(type, content)` chỉ gọi `onFirstModelOutput?.()` khi `type === "token" && !hasEmittedFirstOutput`. Nếu provider chỉ phát `type === "thinking"` mà không phát bất kỳ `type === "token"` nào trước khi kết thúc hoặc bị abort, hệ thống **không trừ quota lượt dùng trong ngày**. Rủi ro lạm dụng compute đồng thời vẫn bị chặn bởi Redis in-flight counter (`reserveNovelcrafterStreamQuota`).
4. **Quyết định sản phẩm về thẻ `visibleToAI === false` trong `buildBibleDirective` (`M-4`) và `buildConflictBackupCard` (`m-3`)**:
   - Trong `buildBibleDirective` (`src/lib/features/novelcrafter/featureDirectives.ts:94-101`), việc lấy nội dung hiện tại qua `serializeStoryBibleWithStructuredCards(input.storyBible)` **chủ đích loại bỏ** các thẻ có `visibleToAI === false` để tôn trọng quyền kiểm soát ngữ cảnh AI của tác giả.
   - Trong `buildConflictBackupCard` (`src/lib/features/novelcrafter/draftStorage.ts:187-222`), mục đích là phát hiện xung đột dữ liệu giữa bản nháp cục bộ và bản máy chủ nên phải so sánh **trực tiếp toàn bộ mảng** `characterCards`, `worldElements`, `outlineItems` (bao gồm cả các thẻ `visibleToAI === false`) và trường `extraInstructions` của từng chương.
5. **Cơ chế Phân Biệt Bản Ghi Hỏng (`STORY_STATE_CORRUPTED`), Bảo Toàn Optimistic Concurrency NC-08, Chống Cross-Story Contamination Khi Retry & Sao Lưu Bền Vững Bằng Dòng `messages` Riêng (`P-1`, `R-1..R-4`, `m-12..m-21`)**:
   - **Phân biệt mã lỗi riêng cho bản ghi hỏng giải mã (`R-1`, `m-16`)**:
     - Tại `getStoryState` (`src/lib/features/novelcrafter/storyPersistence.server.ts:120-127`), khi `decryptText(rows[0].content)` hoặc `JSON.parse` thất bại, server log `dbLogger.error("[STORY_STATE_CORRUPTED] Failed to decrypt or parse story_state payload (verify DATA_ENCRYPTION_KEY if widespread):", { conversationId, error: err })` để ops phát hiện ngay nếu lệch khóa môi trường (`m-16`), rồi ném `new AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED")` (thay vì `DatabaseError` vốn dùng chung mã `"DATABASE_ERROR"` cho lỗi truy vấn Supabase tạm thời tại `:88-90`). Route `GET /api/novelcrafter/state` (`state/route.ts:58-68`) tự động trả HTTP `500` với `{ success: false, error: { message: ..., code: "STORY_STATE_CORRUPTED" } }`.
     - Tại `fetchRemoteStoryState` (`src/app/features/novelcrafter/hooks/useNovelcrafterCatalog.ts:53-64`), khi `!res.ok`, hàm đọc JSON body để lấy `error.code` và ném `new StoryLoadError(loadErrorMsg, res.status, errCode)`.
   - **Bảo toàn tuyệt đối Stale Check NC-08, Chặn mọi ghi đè chưa xác nhận trên dòng hỏng & Sao lưu bền vững bằng dòng `messages` riêng (`R-2`, `R-4`, `m-16`, `m-19`)**:
     - Tại `saveStoryState` (`src/lib/features/novelcrafter/storyPersistence.server.ts:144-241`), server kiểm tra khả năng giải mã `existingRow.content` **trước** bước kiểm tra stale version, đặt cờ `existingCorrupted = true` chỉ khi `decryptText`/`JSON.parse` trên `existingRow.content` ném lỗi.
     - Điều kiện bỏ qua stale version check là `const canBypassStaleForCorruptedRecovery = existingCorrupted && Boolean(options?.allowDestructive);`. Khi bản ghi trên server còn lành (`existingCorrupted === false`), mọi yêu cầu lưu (kể cả có `allowDestructive: true` từ luồng xác nhận xóa >90% thông thường) **vẫn bắt buộc đi qua stale check** (`sanitized.version < existingVersion || sanitized.updatedAt < existingUpdatedAt` $\rightarrow$ ném `ValidationError(STALE_STORY_STATE_MESSAGE)`), ngăn chặn tuyệt đối việc Tab A ghi đè mất dữ liệu của Tab B (Timeline T-E).
     - Defense-in-depth trên dòng hỏng (`m-19`): Khi `existingRow && !options?.allowDestructive`, nếu `existingCorrupted === true` thì **luôn luôn** ném `AppError` 409 `DESTRUCTIVE_SAVE_REJECTED` (với `previousChars = Math.max(existingRow.content?.length ?? 0, DESTRUCTIVE_SAVE_MIN_CHARS)` và `nextChars`), **không phụ thuộc vào tỷ lệ `nextChars < previousChars * 0.1`**.
     - Sao lưu bền vững qua các lần lưu tiếp theo (`R-4` — Đóng Timeline T-J): Khi thực hiện ghi đè phục hồi trên bản ghi hỏng (`canBypassStaleForCorruptedRecovery && existingRow?.content`), **trước khi** gọi `update` trên `existingRow.id`, server chèn một dòng backup độc lập vào bảng `messages` với `role: "system"`, `content: existingRow.content` và `meta: { novelcrafterType: NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE ("story_state_corrupted_backup"), isContextOnly: true, sourceRowId: existingRow.id, corruptedVersion: existingVersion, backedUpAt: now }`. Vì `fetchStoryStateRows` chỉ lọc theo `meta->>novelcrafterType = "story_state"`, dòng backup riêng này:
       1. Không bao giờ bị ghi đè bởi các lần autosave `saveStoryState` tiếp theo (bảo toàn vĩnh viễn qua mọi lần lưu sau đó).
       2. Không làm phình payload của `fetchStoryStateRows` ở mỗi lần `GET`/`PUT`.
       3. Không bị nhánh dọn duplicate (`:95-101`) xóa mất.
   - **Khóa Autosave Server, giữ lưu nháp Local & Chống Cross-Story Contamination khi Retry (`R-3`, `m-12`, `m-13`, `m-15`, `m-17`, `m-18`, `m-20`, `m-21`)**:
     - Khi `loadAndReconcileStoryState` ném lỗi trong `.catch` (`useNovelcrafterStory.ts:238-243`), bên trong khối `if (!cancelled)` (`m-15`), hook gọi `cancelPendingSaveTimers()`, xóa `validStoryId` khỏi `dirtyStoryIdsRef.current`, cập nhật `latestStateRef.current` qua pure helper `resolveStoryLoadFailureState`, đặt `updateLoadErrorStoryId(validStoryId)` và `setSaveStatus("error")`.
     - Scope việc gỡ khóa theo đúng `storyId` (`R-3`): Trong `useNovelcrafterStory.ts`, khai báo `const clearLoadErrorForStory = useCallback((storyId: string) => { if (loadErrorStoryIdRef.current === storyId) { loadErrorStoryIdRef.current = null; setLoadErrorStoryId(null); } }, []);` và truyền `onClearLoadError: clearLoadErrorForStory` vào `useStoryPersistenceLifecycle`.
     - Khi `isLoadLocked` (`Boolean(story.validStoryId && story.loadErrorStoryId === story.validStoryId)`) là `true`:
       1. `ChapterEditorWorkspace` bật `readOnly` trên `<textarea>` (`:513`), chặn các callback AI stream của chương (`m-13`), đồng thời truyền `isStreaming={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterDraftBeatsCard />` (`:411`) và `<InlineStoryBibleSection />` (`:541`) cùng `disabled={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterEmptyStateActions />` (`:433`) để khóa toàn bộ AI stream trong cả Chapter Editor lẫn Story Bible (`m-21`). Các chỉnh sửa thủ công trên Story Bible/Feedback (nếu có) vẫn được lưu vào `localStorage` (`flushLocalDraftSync`) và sẽ được hòa giải an toàn qua `reconcileStoryStateWithDraft` khi Retry thành công (`m-13`, `m-21`).
       2. Trong `scheduleSave` (`useStoryPersistenceLifecycle.ts:300-344`), khối hẹn giờ ghi bản nháp vào `localStorage` (`flushLocalDraftSync`) **vẫn chạy bình thường** (`m-13`), nhưng phần đồng bộ lên server (`executeCoordinatorSave`) bị chặn bởi `if (shouldBlockAutosaveForStory(ownerId, loadErrorStoryIdRef.current)) return;`.
       3. Khi người dùng nhấn nút **"Thử lưu lại / Retry save"** (`saveNow({ isManual: true })`), nếu `shouldBlockAutosaveForStory(targetStoryId, loadErrorStoryIdRef.current)` đang bật:
          - **Guard Single-Flight & Chụp Snapshot trước `await` (`R-3`, `m-17`)**:
            - Kiểm tra `if (isRetryingLockedStoryRef.current === targetStoryId) return;` và đặt `isRetryingLockedStoryRef.current = targetStoryId` trong `try/finally` để chống nhấn Retry/Ctrl+S liên tiếp (`m-17`).
            - Chụp `const snapshotStateForRecovery = latestStateRef.current.ownerStoryId === targetStoryId ? latestStateRef.current.state : (readLocalStoryDraft(targetStoryId, t("novelcrafterDefaultChapterTitle"))?.state ?? currentState);` **trước khi** gọi `await fetchRemoteStoryState(targetStoryId, ...)` (`R-3`).
          - **Bước 1 (`R-3`, `m-12` — Khi `fetchRemoteStoryState` thành công)**:
            - Luôn chạy các thao tác dữ liệu theo `targetStoryId` (không phụ thuộc UI hiện tại, giống `runConflictRecovery` tại `:196-219`): `coordinator.seedServerMeta(targetStoryId, ...)`, `const postReconcileEpoch = coordinator.bumpEpoch(targetStoryId)`, `reconcileStoryStateWithDraft(remoteState, localEnvelope)`, `writeLocalStoryDraft(targetStoryId, reconciled.state, ...)`, và `onClearLoadError?.(targetStoryId)` (chỉ gỡ khóa nếu `loadErrorStoryIdRef.current === targetStoryId`).
            - Kiểm tra owner sau `await` qua pure helper `shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })` (`R-3`):
              - **Chỉ khi trả về `true`** (người dùng vẫn đang mở `targetStoryId`): mới cập nhật `latestStateRef.current = { ownerStoryId: targetStoryId, state: reconciled.state }`, `setStoryState(reconciled.state)`, hiện `toast.info` nếu `reconciled.conflictDetected`, và đặt `setSaveStatus("saved")` (nếu không cần sync tiếp).
              - **Khi trả về `false`** (người dùng đã chuyển sang story B trong lúc `await` — Timeline T-H): **tuyệt đối không** ghi đè `latestStateRef.current` hay `setStoryState` của story B!
            - Nếu `reconciled.shouldSyncDraftToServer === true`, vẫn gọi `await executeCoordinatorSave(targetStoryId, reconciled.state, { epoch: postReconcileEpoch, isManual: true })` (hàm `executeCoordinatorSave` đã có sẵn owner guard nội bộ tại `:113, :131, :239`).
          - **Bước 2 (`R-1`, `R-3`, `m-18` — Khi `fetchRemoteStoryState` ném lỗi `err`)**:
            - Kiểm tra ngay `if (!shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })) return;` (`R-3` / Timeline T-G): nếu người dùng đã chuyển sang story B trong lúc chờ mạng, thoát sớm ngay lập tức, **tuyệt đối không** mở modal hay bắn toast trên màn hình của story B!
            - Khi vẫn đang ở `targetStoryId`, gọi pure helper `resolveLoadLockRecoveryAction(err instanceof StoryLoadError ? err.code : undefined)`:
              - **Chỉ khi trả về `"overwrite_prompt"`** (`err.code === "STORY_STATE_CORRUPTED"`): Mở `<DestructiveSaveConfirmModal />` với `{ storyId: targetStoryId, previousChars: 0, nextChars: snapshotStateForRecovery.chapters.reduce((acc, ch) => acc + ch.content.length, 0), pendingState: snapshotStateForRecovery, reason: "corrupted_remote" }` (`R-3`: dùng `snapshotStateForRecovery` đã chụp trước `await`). Khi đóng/hủy modal ở chế độ `corrupted_remote` (`m-18`), nút hủy hiển thị nhãn `t("novelcrafterCorruptedStateKeepLockedBtn")` (`"Để sau (Giữ khóa an toàn)"` / `"Keep Locked (Cancel)"`) và `reloadAfterDestructiveRejection` chỉ đóng modal (`setDestructivePrompt(null); return;`) mà không gọi lại `fetchRemoteStoryState`.
              - **Khi trả về `"keep_locked"`** (mọi lỗi mất mạng, 401, 429, hoặc 500 `DATABASE_ERROR` tạm thời): Giữ nguyên khóa `loadErrorStoryId`, hiển thị `toast.error(t("novelcrafterLoadError"))`, **tuyệt đối không mở hộp thoại ghi đè** (Timeline T-F).

#### 3.2. Quan hệ phụ thuộc chéo (Cross-Task Dependencies)

- **Tách 6 pure helpers trong `src/lib/features/novelcrafter/` kèm co-located unit tests (Giải quyết triệt để `B-1`, `N-6`, `P-1`, `R-1` và `R-3`)**:
  1. `shouldAbortStreamOnConversationChange` trong `src/lib/features/novelcrafter/streamRunRegistry.ts` (kiểm thử tại `src/lib/features/novelcrafter/streamRunRegistry.test.ts` — **TC-04**).
  2. `mergeStreamedFeedbackItems` trong `src/lib/features/novelcrafter/feedbackParser.ts` (kiểm thử tại `src/lib/features/novelcrafter/feedbackParser.test.ts` — **TC-10**).
  3. `resolveStoryLoadFailureState`, `shouldBlockAutosaveForStory`, `resolveLoadLockRecoveryAction` và `shouldApplyLoadLockRetryResult` trong `src/lib/features/novelcrafter/draftStorage.ts` (kiểm thử tại `src/lib/features/novelcrafter/draftStorage.test.ts` — **TC-03B**).
- **Đồng bộ `validStoryId`, `loadErrorStoryId`, `onClearLoadError(storyId)`, `StoryLoadError`, `replyToFeedbackId` và thứ tự xử lý toast giữa các Hook & Component trong `src/app/features/novelcrafter/`**:
  - `src/app/features/novelcrafter/hooks/useNovelcrafterCatalog.ts:53-64` export `StoryLoadError` mang `status` và `code` từ JSON lỗi của `/api/novelcrafter/state`.
  - `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:77` truyền `selectedConversationId: story.validStoryId` vào `useDirectStreamBridge`, và tại `#L291-L310` truyền `isLoadLocked={Boolean(story.validStoryId && story.loadErrorStoryId === story.validStoryId)}` vào `ChapterEditorWorkspace`.
  - `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts:68-71` truyền `coordinator` vào `resolveValidNovelcrafterStoryId(selectedConversationId, stories, coordinator)` với mảng phụ thuộc `[selectedConversationId, stories, coordinator]` (`m-7`).
  - `TriggerNovelcrafterStreamParams` (`src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts:36-53`) bổ sung `replyToFeedbackId?: string` để `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx:285-291` truyền `replyToFeedbackId: item.id` trong `onReplyFeedback`.
  - `handleStreamTerminated` (`src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts:160-204`) trả về `{ handledRefusal: boolean }`. Trong `useNovelcrafterStream.ts:321-356`, lỗi ở khối `catch` được lưu vào biến tạm `pendingErrorToast` và chỉ gọi `toast.error(pendingErrorToast)` trong khối `finally` **sau khi** gọi `opts.onStreamTerminated?.(...)` nếu `!termResult?.handledRefusal` (`m-C`).

---

### 4. Bảng Verified Versions & Mental Simulation Matrix (S1–S6)

#### 4.1. Bảng Verified Versions (Tra cứu thực tế năm 2026 & đối chiếu `package.json`)

| Gói công nghệ         | Phiên bản trong `package.json` | Phiên bản ổn định 2026 | Ghi chú tương thích                                                                             |
| :-------------------- | :----------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------- |
| `next`                | `^16.2.1`                      | `16.2.x`               | App Router, Route Handlers (`maxDuration = 300`), React 19 Server/Client Components.            |
| `react` / `react-dom` | `19.2.4`                       | `19.2.x`               | Tương thích đầy đủ các hook `useCallback`, `useEffect`, `useRef`.                               |
| `typescript`          | `^5` (`5.9.x`)                 | `5.9.x` / `6.0.x`      | Strict mode bật (`tsconfig.json`); không thay đổi cấu hình compiler.                            |
| `vitest`              | `^4.1.2`                       | `4.1.x`                | Hỗ trợ chạy unit test co-located với `vi.fn()`, `vi.hoisted()`.                                 |
| `zustand`             | `^5.0.12`                      | `5.0.x`                | Quản lý store `src/lib/features/novelcrafter/novelcrafterStreamStore.ts`.                       |
| `zod`                 | `^4.3.6`                       | `4.3.x`                | Xác thực schema request API `/api/novelcrafter/*`.                                              |
| `@upstash/redis`      | `^1.36.1`                      | `1.36.x`               | Hỗ trợ `redis.expire(key, seconds, "NX")` (`ExpireOption`) và `redis.eval(script, keys, args)`. |

#### 4.2. Mental Simulation Matrix (S1–S6) & Adversarial Timelines

_(Lưu ý theo `m-2`: Nhãn `[SRC]` / `[CMD]` chỉ dùng để trích dẫn trạng thái hiện có trên `HEAD`; phần hành vi mới được tách rõ dưới nhãn `Thiết kế sau sửa:`)_

| Kịch bản                     | Kết quả  | Bằng chứng kiểm chứng (`[SRC]` / `[CMD]` trên `HEAD` & Thiết kế sau sửa)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :--------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **PASS** | `[CMD]` `npm run type-check` thoát với mã `0`. `[CMD]` `npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state` pass `15/15` test files (`71/71` tests). Toàn bộ 36 đường dẫn file `[MODIFY]` đã được xác minh tồn tại thực tế trên `HEAD`, và 6 đường dẫn file `[NEW]` chưa tồn tại nên không đè coverage cũ.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **S2 Lifecycle & Teardown**  | **PASS** | `[SRC]` `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts:128-135` (effect theo dõi `selectedConversationId`), `:163-195` (`startRun` $\rightarrow$ `ensureStoryConversation` $\rightarrow$ `setIsStreaming(true)`), `:333-343` (`finally` check `registry.endRun(runId)`).<br>**Thiết kế sau sửa**: Dùng hàm thuần `shouldAbortStreamOnConversationChange` trong `streamRunRegistry.ts`; khởi tạo `AbortController` + `setIsStreaming(true)` trước khi `await ensureStoryConversation()`; bọc `ensureStoryConversation()` trong `try/catch/finally` (nếu throw thì gán `targetConversationId = null` để đi vào nhánh thoát sớm — `m-9`); ở nhánh thoát sớm chỉ đặt `setIsStreaming(false)` khi `wasCurrentRun \|\| !registry.isBusy()` (`N-4`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **S3 Database & Temporal**   | **PASS** | `[SRC]` `src/lib/features/novelcrafter/streamQuotaGuard.server.ts:125-179`, `src/lib/features/novelcrafter/storyPersistence.server.ts:88-90, 116-127, 154, 164-172, 204-241` (bảng `messages`).<br>**Thiết kế sau sửa (`R-1`, `R-2`, `R-4`, `m-16`, `m-19`)**: Dùng `redis.expire(key, INFLIGHT_TTL_SECONDS, "NX")` khi `inFlight > 1` và Lua script nguyên tử qua `redis.eval` tại `:137`, `:167`, `:175`. Tại `storyPersistence.server.ts:120-127`, ném `new AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED")` khi giải mã/parse thất bại. Tại `saveStoryState` (`:144-241`), tính `existingCorrupted` trước stale check, chỉ bỏ qua stale check khi `existingCorrupted && Boolean(options?.allowDestructive)` (`R-2`), chặn tuyệt đối mọi lần lưu chưa có `allowDestructive` trên dòng hỏng bằng 409 `DESTRUCTIVE_SAVE_REJECTED` (`m-19`), và khi ghi đè dòng hỏng thì chèn **một dòng `messages` backup riêng** (`meta.novelcrafterType = "story_state_corrupted_backup"`) để bản sao lưu tồn tại vĩnh viễn qua mọi lần autosave tiếp theo (`R-4` — đóng Timeline T-J).                                                                                                                                                                                                                       |
| **S4 Cross-Task State Flow** | **PASS** | `[SRC]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:77`, `src/app/features/novelcrafter/hooks/useNovelcrafterCatalog.ts:53-64`, `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts:238-243`, `src/app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts:35, 172, 269, 300, 357`, `src/app/features/novelcrafter/components/DestructiveSaveConfirmModal.tsx:33-60`.<br>**Thiết kế sau sửa (`P-1`, `R-1`, `R-3`, `m-12..m-21`)**: Đồng bộ truyền `story.validStoryId` cho `useDirectStreamBridge`. Khi `loadAndReconcileStoryState` ném lỗi, trong `if (!cancelled)` (`m-15`), đặt `loadErrorStoryId = validStoryId`, khóa `readOnly` + khóa AI stream cho cả Chapter Editor lẫn Story Bible (`m-21`), và chặn lưu lên server qua `shouldBlockAutosaveForStory` (vẫn giữ `flushLocalDraftSync` xuống `localStorage` — `m-13`). Khi bấm Retry (`saveNow`), dùng `isRetryingLockedStoryRef` chống bấm đúp (`m-17`), chụp `snapshotStateForRecovery` trước `await` và kiểm tra owner sau `await` bằng pure helper `shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })` kèm `onClearLoadError(targetStoryId)` đã scope theo story (`R-3`), triệt tiêu hoàn toàn nguy cơ trộn state giữa 2 story (Timeline T-G & T-H). |
| **S5 Security Boundary**     | **PASS** | `[SRC]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:503-513`, `src/lib/utils/errors.ts:148-256`.<br>**Thiết kế sau sửa**: Giữ nguyên log chuỗi `rawMsg` nội bộ (`m-5`), và gọi `sanitizeError(err, true)` trước khi đóng gói vào SSE event `error`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **S6 External Resilience**   | **PASS** | `[SRC]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:410-421, 520-524`.<br>**Thiết kế sau sửa**: Trong `emitModelOutput(type, content)`, chỉ đánh dấu `hasEmittedFirstOutput = true` và gọi `onFirstModelOutput?.()` khi `type === "token"`. Giữ nguyên `try/catch` quanh `controller.close()` và `maxDuration = 300`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

##### Adversarial Timelines (Đối chứng Trước & Sau khi sửa)

```text
Timeline 1 (BUG-01, N-4, m-9): Tạo truyện mới từ trạng thái trắng (selectedConversationId = null), nhấn Escape, ensure throw, hoặc kích hoạt chồng Run B
[TRƯỚC KHI SỬA]:
T1: triggerStream() gọi registry.startRun({ targetStoryId: null }) -> runId = "nc-run-1". Lúc này setIsStreaming(true) CHƯA chạy (:191 nằm sau await).
T2: await opts.ensureStoryConversation() (:176) tạo story "story-123" và gọi setSelectedConversationId("story-123").
T3: Khi ensureStoryConversation() resolve, triggerStream gọi setIsStreaming(true) (:191) và fetch().
T4: React commit re-render với selectedConversationId = "story-123" -> cleanup của useEffect([selectedConversationId, registry]) (:128-135) chạy!
T5: Cleanup gọi abortControllerRef.current?.abort() + registry.reset()!
T6: fetch() bị abort -> khối finally (:334) gọi registry.endRun("nc-run-1") trả về false (do registry đã reset ở T5) -> KHÔNG gọi setIsStreaming(false) -> UI kẹt vĩnh viễn ở isStreaming = true!

[SAU KHI SỬA]:
T1: triggerStream() gọi registry.startRun() -> runId, tạo AbortController, gọi setIsStreaming(true) và beginStreamRun(runId, initialMeta) TRƯỚC khi await opts.ensureStoryConversation().
T2: Bật isPromotingStoryRef.current = true trong khối try/catch/finally bao quanh await opts.ensureStoryConversation() (m-9: nếu ensureStoryConversation ném lỗi bất ngờ, catch log lỗi và gán targetConversationId = null để đi vào nhánh thoát sớm).
    - Kịch bản 1A (User nhấn Escape hoặc ensureStoryConversation ném lỗi): Nhánh thoát sớm kiểm tra (!targetConversationId || controller.signal.aborted || registry.getActiveRunId() !== runId) -> gọi const wasCurrent = registry.endRun(runId); chỉ khi (wasCurrent || !registry.isBusy()) mới gọi setIsStreaming(false) và finishStreamRun(runId) rồi return.
    - Kịch bản 1B (Run B mới được kích hoạt trong lúc Run A đang await): Run B abort controller A, gọi registry.endRun(runIdA), startRun(runIdB) và setIsStreaming(true). Khi await của Run A kết thúc, registry.getActiveRunId() === runIdB (registry.isBusy() === true và wasCurrent === false) -> nhánh thoát sớm của Run A KHÔNG chạm vào setIsStreaming(false), bảo vệ an toàn Run B!
    - Kịch bản 1C (ensureStoryConversation thành công): Gọi registry.promotePendingRunStory(runId, targetConversationId) trước khi kết thúc khối try. Khi effect [selectedConversationId] chạy, shouldAbortStreamOnConversationChange({ prevStoryId: null, nextStoryId: "story-123", activeTargetStoryId: "story-123", isPromotingPendingStory }) trả về FALSE -> stream chạy thông suốt tới khi hoàn tất!
```

```text
Timeline 2 (BUG-02): Upstream chỉ trả về "thinking" rồi đóng stream rỗng
[TRƯỚC KHI SỬA]:
T1: Provider gọi emitModelOutput("thinking", "Đang lập dàn ý...") (novelcrafterStreamRunner.server.ts:410).
T2: emitModelOutput thấy !hasEmittedFirstOutput -> gán hasEmittedFirstOutput = true và gọi onFirstModelOutput() -> TRỪ QUOTA trong ngày của user (:412-418).
T3: Provider kết thúc mà không phát bất kỳ chunk "token" nào (emittedTokenChunks === 0) -> ném Error("... model stream returned an empty response") (:142, 232, 379).
T4: User mất 1 lượt quota trong ngày dù chỉ nhận lỗi!

[SAU KHI SỬA]:
T1: Trong emitModelOutput(type, content) (:410-421), chỉ kiểm tra `if (type === "token" && !hasEmittedFirstOutput)` mới gán `hasEmittedFirstOutput = true` và gọi `onFirstModelOutput?.()`.
T2: Các chunk `type === "thinking"` vẫn được enqueue xuống SSE bình thường nhưng không kích hoạt trừ quota.
```

```text
Timeline 3 (BUG-03): Redis In-Flight Quota — Chống trượt TTL (Sliding TTL) & Race Condition DECR/DEL
[TRƯỚC KHI SỬA]:
- Kịch bản 3A (TTL = -1): incr(key) trả về > 1 nhưng request đầu tiên crash trước khi gọi expire -> key tồn tại vĩnh viễn với TTL = -1.
- Kịch bản 3B (Sliding TTL nếu gọi expire không có "NX"): Nếu 1 slot bị rò rỉ và user mở stream mới mỗi < 360s, gọi expire(key, 360) vô điều kiện sẽ làm mới TTL liên tục khiến đơn vị rò rỉ sống suốt ngày UTC.
- Kịch bản 3C (Race condition DECR rồi DEL rời rạc): Stream A gọi decr(key) về 0; Stream B gọi incr(key) lên 1; Stream A gọi del(key) -> xóa mất reservation của Stream B!

[SAU KHI SỬA]:
T1 (Khi reserve tại streamQuotaGuard.server.ts:125-128):
    - Nếu inFlight === 1: gọi await redis.expire(key, INFLIGHT_TTL_SECONDS).
    - Nếu inFlight > 1: gọi await redis.expire(key, INFLIGHT_TTL_SECONDS, "NX") (chỉ đặt TTL nếu key đang chưa có TTL, tức TTL = -1; không làm trượt TTL đang đếm ngược).
T2 (Khi từ chối tại :137, khi releaseReservation tại :167, và khi rollback tại :175):
    Thực thi Lua script nguyên tử qua redis.eval:
    `local v = redis.call('DECR', KEYS[1]); if v <= 0 then redis.call('DEL', KEYS[1]); return 0; end; return v;`
```

```text
Timeline 4 (BUG-04, P-1, R-1..R-4, m-12..m-21): Lỗi tải Story State, Phân biệt STORY_STATE_CORRUPTED, Bảo toàn Concurrency NC-08, Owner Guard khi Retry & Backup Dòng Riêng Bền Vững
[SAU KHI SỬA (Giải quyết triệt để P-1, R-1, R-2, R-3, R-4)]:
T1 (Phân tách mã lỗi trên Server — R-1, m-16):
    - Nếu lỗi truy vấn Supabase tạm thời (:88-90): ném DatabaseError (code: "DATABASE_ERROR", 500).
    - Nếu lỗi giải mã/parse bản ghi story_state (:120-127): log marker `[STORY_STATE_CORRUPTED]` và ném new AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED").
T2 (Bảo toàn Stale Check NC-08, Chặn mọi ghi đè chưa xác nhận & Chèn dòng backup riêng trong saveStoryState :144-241 — Đóng R-2, R-4 / Timeline T-E, T-J & m-16, m-19):
    - Giải mã thử existingRow.content trước stale check để xác định cờ boolean `existingCorrupted`.
    - Chỉ cho phép bỏ qua stale check khi `existingCorrupted && Boolean(options?.allowDestructive)`. Khi bản ghi lành (`existingCorrupted === false`), Tab A gửi PUT v5 kèm `allowDestructive: true` sau khi Tab B đã lưu v6 VẪN bị chặn bởi `ValidationError(STALE_STORY_STATE_MESSAGE)` (Timeline T-E).
    - Khi `existingCorrupted && !options?.allowDestructive`: LUÔN LUÔN ném `AppError` 409 `DESTRUCTIVE_SAVE_REJECTED` bất kể độ dài `nextChars` (m-19).
    - Khi ghi đè bản ghi hỏng (`existingCorrupted && Boolean(options?.allowDestructive) && existingRow?.content`): TRƯỚC khi update `existingRow.id`, server `insert` một dòng `messages` riêng có `meta.novelcrafterType = "story_state_corrupted_backup"` (`isContextOnly: true`) chứa nguyên vẹn `existingRow.content`. Khi user tiếp tục gõ và autosave lần 2, lần 3..., `saveStoryState` chỉ `update` dòng `"story_state"` nên dòng `"story_state_corrupted_backup"` tồn tại vĩnh viễn và không làm phình `fetchStoryStateRows` (Đóng R-4 / Timeline T-J).
T3 (Cô lập & Khóa an toàn trên Client useNovelcrafterStory.ts :238-243 — m-13, m-15, m-21):
    - Trong `if (!cancelled)` của `.catch`: gọi cancelPendingSaveTimers(), xóa validStoryId khỏi dirtyStoryIdsRef, gán latestStateRef.current = resolveStoryLoadFailureState(...), đặt updateLoadErrorStoryId(validStoryId) và setSaveStatus("error").
    - ChapterEditorWorkspace bật readOnly và khóa AI stream cho cả Chapter Editor lẫn Story Bible khi isLoadLocked = true (m-21). Trong scheduleSave, vẫn chạy flushLocalDraftSync vào localStorage (m-13) nhưng chặn executeCoordinatorSave khi shouldBlockAutosaveForStory(ownerId, loadErrorStoryIdRef.current) là true.
T4 (Đường khôi phục có Single-Flight, Pre-Await Snapshot & Owner Guard sau await trong saveNow — Đóng R-1, R-3 / Timeline T-F, T-G, T-H & m-12, m-17, m-18):
    - Trước await: kiểm tra `isRetryingLockedStoryRef.current === targetStoryId` (m-17) và chụp `snapshotStateForRecovery` của `targetStoryId` (R-3).
    - Bước 1 (m-12, R-3 — fetchRemoteStoryState thành công):
      * Chạy các thao tác dữ liệu theo `targetStoryId`: seedServerMeta, bumpEpoch, reconcileStoryStateWithDraft, writeLocalStoryDraft, và gọi `onClearLoadError(targetStoryId)` (chỉ xóa nếu `loadErrorStoryIdRef.current === targetStoryId`).
      * Kiểm tra `shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })`: nếu user đã chuyển sang story B trong lúc chờ mạng (Timeline T-H -> trả về `false`), KHÔNG chạm vào `latestStateRef.current` hay `setStoryState` của story B! Chỉ khi trả về `true` mới cập nhật UI state của `targetStoryId`.
      * Nếu `reconciled.shouldSyncDraftToServer === true`, gọi `executeCoordinatorSave(targetStoryId, reconciled.state, ...)`.
    - Bước 2 (R-1, R-3, m-18 — fetchRemoteStoryState ném lỗi `err`):
      * Kiểm tra `if (!shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })) return;`: nếu user đã chuyển sang story B trong lúc chờ mạng (Timeline T-G -> trả về `false`), thoát ngay lập tức, KHÔNG mở modal ghi đè trên màn hình B và KHÔNG bao giờ ghép state của B vào A!
      * Khi vẫn đang ở `targetStoryId`, kiểm tra `resolveLoadLockRecoveryAction(err instanceof StoryLoadError ? err.code : undefined)`:
        + Nếu là lỗi mạng / 429 / 401 / DATABASE_ERROR (`"keep_locked"`): hiện `toast.error(t("novelcrafterLoadError"))`, giữ nguyên khóa (Timeline T-F).
        + Chỉ khi `err.code === "STORY_STATE_CORRUPTED"` (`"overwrite_prompt"`): mở `<DestructiveSaveConfirmModal />` với `pendingState: snapshotStateForRecovery` và `reason: "corrupted_remote"` (nút hủy hiển thị `novelcrafterCorruptedStateKeepLockedBtn` và chỉ đóng modal — m-18).
```

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### 5.1. Danh sách Files `[MODIFY]` (36 files — 27 source files + 9 existing test files — Đã xác minh tồn tại 100% trên `HEAD`)

**Tầng Server & Domain Logic (`src/lib/features/novelcrafter/`)**:

1. `[MODIFY]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`
   - Tại `emitModelOutput` (`#L410-L421`): Chỉ gọi `onFirstModelOutput?.()` khi `type === "token"`.
   - Tại `catch` (`#L503-L513`): Giữ nguyên log chuỗi `rawMsg` nội bộ (`m-5`), import `sanitizeError` từ `@/lib/utils/errors` và dùng `sanitizeError(err, true)` cho `message` của SSE event `error`.
2. `[MODIFY]` `src/lib/features/novelcrafter/streamQuotaGuard.server.ts`
   - Tại `#L125-L128`: Gọi `await redis.expire(key, INFLIGHT_TTL_SECONDS, "NX")` khi `inFlight > 1`.
   - Tại `#L137`, `#L167`, `#L175`: Thay `await redis.decr(key)` bằng `await redis.eval(DECR_AND_CLEANUP_LUA, [key], [])`.
3. `[MODIFY]` `src/lib/features/novelcrafter/storyPersistence.server.ts`
   - Khai báo hằng số `export const NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE = "story_state_corrupted_backup" as const;` (`R-4`).
   - Tại `getStoryState` (`#L120-L127`): Log lỗi với marker `[STORY_STATE_CORRUPTED]` (`m-16`) và ném `new AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED")` khi giải mã hoặc parse JSON thất bại (`R-1`).
   - Tại `saveStoryState` (`#L144-L241`): Giải mã thử `existingRow.content` trước bước kiểm tra stale để xác định `existingCorrupted` và `decryptedExistingChars`. Tại `#L154`, chỉ bỏ qua stale check khi `existingCorrupted && Boolean(options?.allowDestructive)` (`R-2`). Khi `existingRow && !options?.allowDestructive`: nếu `existingCorrupted === true` thì **luôn luôn** ném `AppError` 409 `DESTRUCTIVE_SAVE_REJECTED` bất kể độ dài `nextChars` (`m-19`); nếu `!existingCorrupted` thì kiểm tra ngưỡng giảm >90% như hiện tại. Khi `existingCorrupted && Boolean(options?.allowDestructive) && existingRow?.content`, trước khi `update` `existingRow.id`, thực hiện `supabase.from("messages").insert(...)` một dòng backup riêng có `meta.novelcrafterType = NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE` (`isContextOnly: true`) chứa nguyên vẹn `existingRow.content` (`R-4`, `m-16`).
4. `[MODIFY]` `src/lib/features/novelcrafter/streamRunRegistry.ts`
   - Bổ sung pure helper `shouldAbortStreamOnConversationChange`.
5. `[MODIFY]` `src/lib/features/novelcrafter/feedbackParser.ts`
   - Bổ sung pure helper `mergeStreamedFeedbackItems` (sử dụng `normalizeFeedbackItems` từ `./stateLimits`).
6. `[MODIFY]` `src/lib/features/novelcrafter/promptBuilder.ts`
   - Tại `buildNovelcrafterUserPrompt` (`#L326-L329`): Khi `input.chapterProse.trim().length > MAX_CHAPTER_CONTEXT_CHARS`, giữ `25%` đầu (`4_500` ký tự) + `\n...[middle of chapter omitted for context budget]...\n` + `75%` cuối (`13_500` ký tự) trong `<preceding_prose>`.
7. `[MODIFY]` `src/lib/features/novelcrafter/featureDirectives.ts`
   - Tại `buildBibleDirective` (`#L94-L96`): Dùng `serializeStoryBibleWithStructuredCards(input.storyBible)` và ánh xạ tường minh theo `target` (`synopsis`, `characters`, `worldbuilding`, `outline`, `scenes`).
   - Tại `buildFeatureDirective` (`#L206-L312`): Đưa `input.chapterExtraInstructions?.trim()` vào cả 5 sub-mode của nhánh `write` (`first_draft_rough`, `openings_3`, `tone_shift`, `guided`, default), nhánh `rewrite`, và cả 2 sub-mode của nhánh `expand` (`describe`, default `expand`) (`m-4`).
8. `[MODIFY]` `src/lib/features/novelcrafter/characterParser.ts`
   - Tại `#L35`: Đổi `dashMatch` từ `/^(.+?)\s*[—–-]\s*(.+)$/` sang `/^(.+?)(?:\s+[—–-]\s+|\s*:\s*)(.+)$/` để không cắt nhầm tên có dấu gạch nối liền (`Spider-Man`, `Jean-Luc Picard`, `T-800`).
9. `[MODIFY]` `src/lib/features/novelcrafter/openingsParser.ts`
   - Tại `#L9-L10` và `#L28`: Cập nhật `OPENING_DELIMITERS` giữ nguyên cờ `/gi` và 4 capture groups `match[1..4]` nhưng hỗ trợ dấu `**` bọc tiêu đề và làm sạch dấu `**` thừa ở `subtitle`.
10. `[MODIFY]` `src/lib/features/novelcrafter/draftStorage.ts`
    - Tại `buildConflictBackupCard` (`#L187-L222`): So sánh trực tiếp thêm các mảng `characterCards`, `worldElements`, `outlineItems` và trường `extraInstructions` của chương.
    - Bổ sung 4 pure helpers: `resolveStoryLoadFailureState`, `shouldBlockAutosaveForStory`, `resolveLoadLockRecoveryAction(errorCode?: string | null): "overwrite_prompt" | "keep_locked"`, và `shouldApplyLoadLockRetryResult(params: { targetStoryId: string | null; currentOwnerStoryId: string | null }): boolean` (`P-1`, `R-1`, `R-3`).

**Tầng Client Hooks & Components (`src/app/features/novelcrafter/`)**: 11. `[MODIFY]` `src/app/features/novelcrafter/hooks/useNovelcrafterCatalog.ts` - Export class `StoryLoadError` (chứa `status: number` và `code?: string`) và cập nhật `fetchRemoteStoryState` (`#L53-L64`) để đọc `error.code` từ JSON phản hồi khi `!res.ok` và ném `new StoryLoadError(loadErrorMsg, res.status, errCode)` (`R-1`). 12. `[MODIFY]` `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts` - Bổ sung `replyToFeedbackId?: string` vào `TriggerNovelcrafterStreamParams`; sửa vòng đời `triggerStream` (bọc `ensureStoryConversation` trong `try/catch/finally` — `m-9`), `stopStream`, nhánh thoát sớm (`N-4`), thứ tự xử lý toast refusal (`m-C`), và guard effect `selectedConversationId` bằng `shouldAbortStreamOnConversationChange`. 13. `[MODIFY]` `src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts` - Lưu `feedbackBaseItemsRef` khi bắt đầu stream `feedback`; dùng `mergeStreamedFeedbackItems` khi nhận chunk (`#L130-L145`) và khi kết thúc (`#L164-L177`); trả về `{ handledRefusal: true }` từ `handleStreamTerminated` khi đã hiển thị `toast.error` cho refusal (`#L200-L202`). 14. `[MODIFY]` `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts` - Tại `#L68-L71`: Truyền `coordinator` vào `resolveValidNovelcrafterStoryId(selectedConversationId, stories, coordinator)` với deps `[selectedConversationId, stories, coordinator]` (`m-7`). - Quản lý state `loadErrorStoryId` (`string | null`), `loadErrorStoryIdRef`, và hàm `clearLoadErrorForStory = useCallback((storyId: string) => { if (loadErrorStoryIdRef.current === storyId) { loadErrorStoryIdRef.current = null; setLoadErrorStoryId(null); } }, [])` (`R-3`): xóa về `null` khi tải thành công hoặc khi không có story; trong `.catch` của `loadAndReconcileStoryState` (`#L238-L243`), bên trong `if (!cancelled)` (`m-15`), gọi `cancelPendingSaveTimers()`, xóa `validStoryId` khỏi `dirtyStoryIdsRef.current`, cập nhật `latestStateRef.current` qua `resolveStoryLoadFailureState`, đặt `updateLoadErrorStoryId(validStoryId)` và `setSaveStatus("error")`; chặn flush khi chuyển khỏi story đang có `shouldBlockAutosaveForStory(prevStoryId, loadErrorStoryIdRef.current)` (`#L161-L171`); bổ sung `updateLoadErrorStoryId` vào deps của `useEffect` tải story (`#L249` — `m-20`); truyền `loadErrorStoryIdRef` và `onClearLoadError: clearLoadErrorForStory` vào `useStoryPersistenceLifecycle` và trả về `loadErrorStoryId` từ hook (`P-1`, `R-3`). 15. `[MODIFY]` `src/app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts` - Mở rộng `DestructiveSavePromptState` (`#L37-L42`) với `reason?: "destructive_drop" | "corrupted_remote"`. - Nhận thêm `loadErrorStoryIdRef: MutableRefObject<string | null>` và `onClearLoadError?: (storyId: string) => void` trong `UseStoryPersistenceLifecycleParams` (`R-3`), và thêm `isRetryingLockedStoryRef = useRef<string | null>(null)` (`m-17`): - Trong `scheduleSave` (`#L300-L355`): giữ nguyên khối hẹn giờ `flushLocalDraftSync` vào `localStorage` (`m-13`), chặn phần đồng bộ server (`executeCoordinatorSave`) tại `#L309` và `#L326` khi `shouldBlockAutosaveForStory(ownerId, loadErrorStoryIdRef.current)` là `true`, và bổ sung `loadErrorStoryIdRef` vào deps (`m-20`); chặn tương tự trong `handleVisibilityChange` (`#L390`) và bổ sung `loadErrorStoryIdRef` vào deps của `useEffect` (`#L413-L420` — `m-20`). - Trong `executeCoordinatorSave` (`#L122-L139`, `#L247-L255`): khi `outcome.status === "saved"`, gọi `onClearLoadError?.(storyId)` để gỡ khóa có scope theo `storyId` (`P-1`, `R-3`) và bổ sung `onClearLoadError` vào deps (`m-20`). - Trong `reloadAfterDestructiveRejection` (`#L269-L297`): nếu `destructivePrompt.reason === "corrupted_remote"`, chỉ gọi `setDestructivePrompt(null); return;` mà không tải lại từ server (`m-18`). - Trong `saveNow` (`#L357-L382`): bổ sung `loadErrorStoryIdRef`, `onClearLoadError`, `setStoryState`, `setSaveStatus`, `t` vào mảng deps (`m-20`); khi `shouldBlockAutosaveForStory(targetStoryId, loadErrorStoryIdRef.current)` là `true`: 1. Kiểm tra single-flight `if (isRetryingLockedStoryRef.current === targetStoryId) return;` (`m-17`) và chụp `snapshotStateForRecovery` của `targetStoryId` trước `await` (`R-3`). 2. Thử tải lại qua `fetchRemoteStoryState(targetStoryId, ...)`; nếu thành công thì chạy `seedServerMeta`, `bumpEpoch`, `reconcileStoryStateWithDraft`, `writeLocalStoryDraft`, `onClearLoadError?.(targetStoryId)`, chỉ cập nhật UI state (`latestStateRef`, `setStoryState`, `toast.info`, `setSaveStatus`) khi `shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })` là `true` (`R-3`), và nếu `reconciled.shouldSyncDraftToServer` thì gọi `executeCoordinatorSave` (`m-12`). 3. Nếu `fetchRemoteStoryState` ném lỗi `err`: kiểm tra `if (!shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })) return;` (`R-3`). Khi vẫn ở `targetStoryId`, gọi `resolveLoadLockRecoveryAction(err instanceof StoryLoadError ? err.code : undefined)`: chỉ khi trả về `"overwrite_prompt"` (`STORY_STATE_CORRUPTED`) mới mở `setDestructivePrompt({ storyId: targetStoryId, previousChars: 0, nextChars: ..., pendingState: snapshotStateForRecovery, reason: "corrupted_remote" })`; nếu trả về `"keep_locked"` thì giữ khóa và báo `toast.error(t("novelcrafterLoadError"))` (`R-1`, `R-3`). - Tại `#L172`: Khi trim payload để retry sau lỗi `payload_too_large`, lấy state mới nhất từ `latestStateRef.current.ownerStoryId === storyId ? latestStateRef.current.state : stateToSave` (giữ nguyên `FALLBACK_TRIM_PAYLOAD_BYTES = 1_500_000`). 16. `[MODIFY]` `src/app/features/novelcrafter/components/DestructiveSaveConfirmModal.tsx` - Tại `#L33-L60`: Khi `prompt.reason === "corrupted_remote"`, hiển thị tiêu đề `t("novelcrafterCorruptedStateTitle")`, nội dung `t("novelcrafterCorruptedStateDesc").replace("{next}", prompt.nextChars.toLocaleString())`, và đổi nhãn nút outline từ `t("novelcrafterDestructiveSaveReloadBtn")` sang `t("novelcrafterCorruptedStateKeepLockedBtn")` (`R-1`, `m-18`). 17. `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` - Tại `#L77`: Truyền `selectedConversationId: story.validStoryId` vào `useDirectStreamBridge`. - Tại `#L291-L310`: Truyền `isLoadLocked={Boolean(story.validStoryId && story.loadErrorStoryId === story.validStoryId)}` vào `ChapterEditorWorkspace` (`P-1`, `m-13`). 18. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx` - Bổ sung prop `isLoadLocked?: boolean` vào `ChapterEditorWorkspaceProps` (`#L48-L71`) và cập nhật `<textarea readOnly={isDirectStreamingToChapter || Boolean(isLoadLocked)} />` tại `#L513` (`P-1`). - Thêm guard `if (isStreaming || isLoadLocked) return;` ở đầu các callback kích hoạt stream (`handleRunFirstDraft` `#L230`, `handleRunRewrite` `#L238`, `onReplyFeedback` `#L279`, `onRunWrite` `#L318`, `onRunFeedback` `#L323`, `onRunExpand` `#L337`, `onRunBrainstorm` `#L349`, `onGenerateBeats`/`onRewriteBeats` `#L412-L427`, và các callback của `ChapterEmptyStateActions` `#L434-L454`), đồng thời truyền `isStreaming={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterDraftBeatsCard />` (`#L411`) và `<InlineStoryBibleSection />` (`#L541`) cùng `disabled={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterEmptyStateActions />` (`#L433`) (`m-13`, `m-21`); truyền `replyToFeedbackId: item.id` trong `onReplyFeedback` (`#L285-L291`); đổi `text-[11px]` thành `text-xs` tại `#L472`. 19. `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx` - Tại `#L219`: Sửa `py-0.2` thành `py-0.5` và `text-[10px]` thành `text-xs`. 20. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterAiToolMenus.tsx` - Tại `#L298`: Đổi `text-[11px]` thành `text-xs`. 21. `[MODIFY]` `src/app/features/novelcrafter/components/ChapterFeedbackGutter.tsx` - Tại `#L221` và `#L225`: Đổi `text-[11px]` thành `text-xs`. 22. `[MODIFY]` `src/app/features/novelcrafter/components/SheetSubToolbar.tsx` - Tại `#L94`: Đổi `text-[11px]` thành `text-xs`. 23. `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx` - Tại `#L95`: Đổi `text-[11px]` thành `text-xs`. 24. `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx` - Tại `#L282`: Đổi `text-[11px]` thành `text-xs`. 25. `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx` - Tại `handleRunAi` (`#L120`): Thêm guard `if (isStreaming) return;` để đồng nhất hành vi chống double-trigger và khóa AI khi `isLoadLocked` được truyền qua `isStreaming` từ `ChapterEditorWorkspace.tsx` (`m-10`, `m-21`). - Tại `#L242`: Đổi `text-[11px]` thành `text-xs`.

**Tầng Đa ngữ (`src/lib/utils/translations/`)**: 26. `[MODIFY]` `src/lib/utils/translations/vi.ts` - Cập nhật `novelcrafterMasterGemHint` (`#L1012-L1013`) và `novelcrafterFeatureSlotsLabel` (`#L1016`) từ "5 tính năng" thành "6 tính năng". - Bổ sung 3 khóa `novelcrafterCorruptedStateTitle`, `novelcrafterCorruptedStateDesc`, và `novelcrafterCorruptedStateKeepLockedBtn` ngay sau `novelcrafterDestructiveSaveDesc` (`#L1221`) (`R-1`, `m-18`). 27. `[MODIFY]` `src/lib/utils/translations/en.ts` - Cập nhật `novelcrafterMasterGemHint` (`#L1002-L1003`) và `novelcrafterFeatureSlotsLabel` (`#L1007`) từ "5 features / 5 Sudowrite Feature Slots" thành "6 features / 6 Sudowrite Feature Slots". - Bổ sung 3 khóa `novelcrafterCorruptedStateTitle`, `novelcrafterCorruptedStateDesc`, và `novelcrafterCorruptedStateKeepLockedBtn` ngay sau `novelcrafterDestructiveSaveDesc` (`#L1217`) (`R-1`, `m-18`).

**Tầng Kiểm thử hiện hữu (`*.test.ts` — 9 files)**: 28. `[MODIFY]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts` - Bổ sung kiểm thử **TC-01** (không gọi `onFirstModelOutput` khi chỉ có `thinking` chunk; gọi `sanitizeError(err, true)` khi phát SSE event `error`). 29. `[MODIFY]` `src/lib/features/novelcrafter/streamQuotaGuard.server.test.ts` - Bổ sung kiểm thử **TC-02** (mock `getRedis()` với `incr`, `expire`, `eval`, `decr` để kiểm chứng `expire(..., "NX")` và Lua script nguyên tử). 30. `[MODIFY]` `src/lib/features/novelcrafter/storyPersistence.server.test.ts` - Bổ sung kiểm thử **TC-03A** (Cases 3A-1..3A-5: `getStoryState` ném `AppError` 500 `STORY_STATE_CORRUPTED` khi ciphertext hỏng; `saveStoryState` trên bản ghi hỏng không có `allowDestructive` luôn ném 409 `DESTRUCTIVE_SAVE_REJECTED` kể cả khi `nextChars` lớn; `saveStoryState` trên bản ghi hỏng có `allowDestructive: true` chèn dòng backup riêng `story_state_corrupted_backup` và ghi đè thành công; `saveStoryState` trên **bản ghi lành** nhưng version cũ kèm `allowDestructive: true` **vẫn ném `ValidationError` stale**; dòng backup `story_state_corrupted_backup` vẫn tồn tại nguyên vẹn sau các lần `saveStoryState` bình thường tiếp theo — `R-1`, `R-2`, `R-4`, `m-16`, `m-19`). 31. `[MODIFY]` `src/app/api/novelcrafter/state/route.test.ts` - Bổ sung kiểm thử route `GET /api/novelcrafter/state` trả về HTTP `500` với `{ error: { code: "STORY_STATE_CORRUPTED" } }` khi `getStoryState` ném `AppError` `STORY_STATE_CORRUPTED` (`R-1`). 32. `[MODIFY]` `src/lib/features/novelcrafter/draftStorage.test.ts` - Bổ sung kiểm thử `buildConflictBackupCard` với thẻ `visibleToAI: false` và kiểm thử 4 pure helpers `resolveStoryLoadFailureState`, `shouldBlockAutosaveForStory`, `resolveLoadLockRecoveryAction`, `shouldApplyLoadLockRetryResult` (**TC-03B** — `P-1`, `R-1`, `R-3`). 33. `[MODIFY]` `src/lib/features/novelcrafter/feedbackParser.test.ts` - Bổ sung kiểm thử pure helper `mergeStreamedFeedbackItems` (**TC-10**). 34. `[MODIFY]` `src/lib/features/novelcrafter/promptBuilder.test.ts` - Bổ sung kiểm thử **TC-05** (head + tail windowing cho `chapterProse > MAX_CHAPTER_CONTEXT_CHARS`). 35. `[MODIFY]` `src/lib/features/novelcrafter/featureDirectives.test.ts` - Bổ sung kiểm thử **TC-06** (`buildBibleDirective` với structured cards + `chapterExtraInstructions` trên đủ cả 5 sub-mode của `write`, `rewrite`, và 2 sub-mode của `expand` — `m-4`, `m-14`). 36. `[MODIFY]` `src/lib/features/novelcrafter/storyBibleSerializer.test.ts` - Mở rộng kiểm thử `serializeStoryBibleWithStructuredCards` cho trường hợp lọc `visibleToAI === false` trên cả `characterCards` và `worldElements`.

#### 5.2. Danh sách Files `[NEW]` (6 Co-located Test Files còn thiếu trong `src/lib/features/novelcrafter/`)

1. `[NEW]` `src/lib/features/novelcrafter/characterParser.test.ts`
2. `[NEW]` `src/lib/features/novelcrafter/openingsParser.test.ts`
3. `[NEW]` `src/lib/features/novelcrafter/pruneStoryBibleForStream.test.ts`
4. `[NEW]` `src/lib/features/novelcrafter/streamRunRegistry.test.ts`
5. `[NEW]` `src/lib/features/novelcrafter/modelGuards.server.test.ts`
6. `[NEW]` `src/lib/features/novelcrafter/novelcrafterStreamStore.test.ts`

_(Không có file nào thuộc diện `[DELETE]`)_

---

### 6. Các Bước Thực Hiện Tuần Tự (Step-by-Step Checklist)

#### Nhóm A — Vá lỗi Server, Bảo mật, Quota & Persistence (Phase 1 Server & Client Error Lock)

- [ ] **Bước 1.1 — Vá lỗi trừ Quota oan & Rò rỉ lỗi nội bộ trong `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`**:
  - Import `sanitizeError` từ `@/lib/utils/errors`.
  - Tại `emitModelOutput` (`#L410-L421`): Sửa điều kiện `if (!hasEmittedFirstOutput)` thành `if (type === "token" && !hasEmittedFirstOutput)` để các chunk `type === "thinking"` không kích hoạt `onFirstModelOutput?.()`.
  - Tại khối `catch (err: unknown)` (`#L503-L513`): Giữ nguyên câu lệnh trích xuất `const rawMsg = err instanceof Error ? err.message : String(err);` và log chuỗi nội bộ `streamLogger.error(\`Novelcrafter stream failed (feature=\${params.feature}, model=\${params.resolvedModelId}): \${rawMsg}\`);`(không truyền nguyên object`err`vào logger —`m-5`), nhưng đổi giá trị `message`gửi xuống SSE event`"error"`thành`err instanceof Error ? sanitizeError(err, true) : "Failed to generate story content"`.

- [ ] **Bước 1.2 — Vá lỗi Redis In-Flight Quota trong `src/lib/features/novelcrafter/streamQuotaGuard.server.ts`**:
  - Khai báo hằng số Lua script nguyên tử ở đầu file:
    ```ts
    const DECR_AND_CLEANUP_LUA =
      "local v = redis.call('DECR', KEYS[1]); if v <= 0 then redis.call('DEL', KEYS[1]); return 0; end; return v;";
    ```
  - Tại `reserveNovelcrafterStreamQuota` (`#L125-L128`):
    - Khi `inFlight === 1`: gọi `await redis.expire(key, INFLIGHT_TTL_SECONDS);`.
    - Khi `inFlight > 1`: gọi `await redis.expire(key, INFLIGHT_TTL_SECONDS, "NX");` để gắn TTL nếu key bị sót ở trạng thái `TTL = -1` mà không làm trượt TTL đang đếm ngược.
  - Tại nhánh từ chối `!dailyCheck.canSend || effectiveCount > dailyCheck.limit` (`#L137`), bên trong `releaseReservation` (`#L167`), và bên trong `catch` rollback (`#L175`): Thay `await redis.decr(key)` bằng `await redis.eval(DECR_AND_CLEANUP_LUA, [key], [])`.

- [ ] **Bước 1.3 — Phân tách mã lỗi `STORY_STATE_CORRUPTED`, bảo toàn Stale Check NC-08 + sao lưu bền vững bằng dòng `messages` riêng trong `src/lib/features/novelcrafter/storyPersistence.server.ts` & Cô lập + Khóa + Khôi phục có Owner Guard phía Client (`P-1`, `R-1..R-4`, `m-12..m-21`)**:
  - Trong `src/lib/features/novelcrafter/storyPersistence.server.ts`:
    - Khai báo `export const NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE = "story_state_corrupted_backup" as const;` ngay dưới `NOVELCRAFTER_STATE_META_TYPE` (`#L21`).
    - Tại `getStoryState` (`#L120-L127`): Khi `decryptText(rows[0].content)` hoặc `JSON.parse` ném lỗi, log lỗi qua `dbLogger.error("[STORY_STATE_CORRUPTED] Failed to decrypt or parse story_state payload (verify DATA_ENCRYPTION_KEY if widespread):", { conversationId, error: err })` (`m-16`) và `throw new AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED")` (`R-1`: tách biệt hoàn toàn với `DatabaseError` `DATABASE_ERROR` của lỗi query Supabase tại `:88-90`; khi `rows.length === 0 || !rows[0].content` tại `#L116-L118` vẫn trả về `createDefaultStoryState()` bình thường).
    - Tại `saveStoryState` (`#L144-L241` — `R-2`, `R-4`, `m-16`, `m-19`):
      1. Giải mã thử `existingRow?.content` **trước** bước kiểm tra stale version:
         ```ts
         let existingCorrupted = false;
         let decryptedExistingChars = -1;
         if (existingRow?.content) {
           try {
             const decryptedExisting = decryptText(existingRow.content);
             const parsedExisting = sanitizeStoryState(JSON.parse(decryptedExisting));
             decryptedExistingChars = computeTotalStoryContentChars(parsedExisting);
           } catch {
             existingCorrupted = true;
           }
         }
         ```
      2. Tại bước kiểm tra stale (`#L154`): Chỉ cho phép bỏ qua stale check khi **đồng thời** `existingCorrupted && Boolean(options?.allowDestructive)`:
         ```ts
         const canBypassStaleForCorruptedRecovery =
           existingCorrupted && Boolean(options?.allowDestructive);
         if (
           !canBypassStaleForCorruptedRecovery &&
           (sanitized.version < existingVersion || sanitized.updatedAt < existingUpdatedAt)
         ) {
           throw new ValidationError(STALE_STORY_STATE_MESSAGE);
         }
         ```
      3. Tại bước kiểm tra destructive (`#L161-L183` — `m-19`): Khi `existingRow && !options?.allowDestructive`:
         - Nếu `existingCorrupted === true`: **luôn luôn** ném `AppError` 409 `DESTRUCTIVE_SAVE_REJECTED` (với `previousChars = Math.max(existingRow.content?.length ?? 0, DESTRUCTIVE_SAVE_MIN_CHARS)` và `nextChars`), bất kể `nextChars` lớn hay nhỏ (`m-19`).
         - Nếu `!existingCorrupted`: tính `previousChars = typeof existingMeta?.contentChars === "number" ? existingMeta.contentChars : decryptedExistingChars` và ném `AppError` 409 `DESTRUCTIVE_SAVE_REJECTED` khi `previousChars >= DESTRUCTIVE_SAVE_MIN_CHARS && nextChars < previousChars * 0.1`.
      4. Tại bước ghi DB khi `existingRow` tồn tại (`#L204` — `R-4`, `m-16`): Nếu `canBypassStaleForCorruptedRecovery && existingRow.content`, **trước khi** gọi `supabase.from("messages").update(...)` trên `existingRow.id`, chèn một dòng backup riêng vào bảng `messages`:
         ```ts
         if (canBypassStaleForCorruptedRecovery && existingRow.content) {
           const { error: backupError } = await supabase.from("messages").insert({
             conversation_id: conversationId,
             role: "system",
             content: existingRow.content,
             meta: {
               novelcrafterType: NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE,
               isContextOnly: true,
               sourceRowId: existingRow.id,
               corruptedVersion: existingVersion,
               backedUpAt: now,
             },
           });
           if (backupError) {
             dbLogger.error("Failed to insert story_state_corrupted_backup row:", backupError);
             throw new DatabaseError("Failed to back up unreadable story state before overwrite");
           }
         }
         ```
  - Trong `src/lib/features/novelcrafter/draftStorage.ts`:
    - Export 4 pure helpers `resolveStoryLoadFailureState`, `shouldBlockAutosaveForStory`, `resolveLoadLockRecoveryAction`, và `shouldApplyLoadLockRetryResult` (`P-1`, `R-1`, `R-3`):

      ```ts
      export function resolveStoryLoadFailureState(params: {
        storyId: string;
        defaultChapterTitle: string;
      }): { ownerStoryId: string; state: NovelcrafterStoryState } {
        const localEnvelope = readLocalStoryDraft(params.storyId, params.defaultChapterTitle);
        return {
          ownerStoryId: params.storyId,
          state: localEnvelope
            ? localEnvelope.state
            : createDefaultStoryState(params.defaultChapterTitle),
        };
      }

      export function shouldBlockAutosaveForStory(
        storyId: string | null,
        loadErrorStoryId: string | null
      ): boolean {
        return Boolean(storyId && loadErrorStoryId && storyId === loadErrorStoryId);
      }

      export function resolveLoadLockRecoveryAction(
        errorCode?: string | null
      ): "overwrite_prompt" | "keep_locked" {
        return errorCode === "STORY_STATE_CORRUPTED" ? "overwrite_prompt" : "keep_locked";
      }

      export function shouldApplyLoadLockRetryResult(params: {
        targetStoryId: string | null;
        currentOwnerStoryId: string | null;
      }): boolean {
        return Boolean(
          params.targetStoryId &&
          params.currentOwnerStoryId &&
          params.targetStoryId === params.currentOwnerStoryId
        );
      }
      ```

  - Trong `src/app/features/novelcrafter/hooks/useNovelcrafterCatalog.ts` (`#L53-L64` — `R-1`):
    - Export class `StoryLoadError extends Error` có `readonly status: number` và `readonly code?: string`.
    - Trong `fetchRemoteStoryState`, khi `!res.ok`, parse JSON body để lấy `errCode = errJson.error?.code || errJson.code` và `throw new StoryLoadError(loadErrorMsg, res.status, errCode)`.
  - Trong `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts`:
    - (a) Khai báo `const [loadErrorStoryId, setLoadErrorStoryId] = useState<string | null>(null);`, `const loadErrorStoryIdRef = useRef<string | null>(null);`, helper `const updateLoadErrorStoryId = useCallback((id: string | null) => { loadErrorStoryIdRef.current = id; setLoadErrorStoryId(id); }, []);`, và helper gỡ khóa có scope theo `storyId` (`R-3`):
      ```ts
      const clearLoadErrorForStory = useCallback((storyId: string) => {
        if (loadErrorStoryIdRef.current === storyId) {
          loadErrorStoryIdRef.current = null;
          setLoadErrorStoryId(null);
        }
      }, []);
      ```
      Truyền `loadErrorStoryIdRef` và `onClearLoadError: clearLoadErrorForStory` vào `useStoryPersistenceLifecycle` (`#L121-L130`), đồng thời trả `loadErrorStoryId` trong object return của `useNovelcrafterStory` (`#L353-L377`).
    - (b) Trong `useEffect` tải story (`#L154-L250`):
      - Tại nhánh flush `prevStoryId` khi chuyển story (`#L161-L171`): Thêm điều kiện `!shouldBlockAutosaveForStory(prevStoryId, loadErrorStoryIdRef.current)` để không autosave state dự phòng của story đang bị lỗi tải.
      - Tại nhánh `!isAuthed || !validStoryId` (`#L174-L189`), nhánh `decision.shouldPromoteUnsaved` (`#L196-L208`), và nhánh `.then` khi `loadAndReconcileStoryState` thành công (`#L223-L237`): Gọi `updateLoadErrorStoryId(null)` để gỡ khóa.
      - Tại nhánh `.catch` của `loadAndReconcileStoryState` (`#L238-L243` — `m-15`): Đặt **toàn bộ** các thao tác bên trong khối `if (!cancelled)`:
        1. Gọi `cancelPendingSaveTimers()` và `dirtyStoryIdsRef.current.delete(validStoryId)`.
        2. Gọi `const fallbackScoped = resolveStoryLoadFailureState({ storyId: validStoryId, defaultChapterTitle: t("novelcrafterDefaultChapterTitle") });`.
        3. Cập nhật `latestStateRef.current = fallbackScoped;`, `setStoryState(fallbackScoped.state);`.
        4. Gọi `updateLoadErrorStoryId(validStoryId);` và `setSaveStatus("error");`.
        5. Giữ nguyên `storyLogger.error("Failed to load story state:", err);` và `toast.error(t("novelcrafterLoadError"));`.
      - Bổ sung `updateLoadErrorStoryId` vào mảng dependencies của `useEffect` tại `#L249` (`m-20`).
  - Trong `src/app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts`:
    - (c) Thêm `reason?: "destructive_drop" | "corrupted_remote"` vào `DestructiveSavePromptState` (`#L37-L42`), nhận `loadErrorStoryIdRef: MutableRefObject<string | null>` + `onClearLoadError?: (storyId: string) => void` trong `UseStoryPersistenceLifecycleParams` (`#L44-L53`), và khai báo `const isRetryingLockedStoryRef = useRef<string | null>(null);` (`m-17`).
    - Trong `scheduleSave` (`#L300-L355` — `m-13`, `m-20`): Giữ nguyên khối `draftThrottleTimerRef` ghi bản nháp vào `localStorage` (`flushLocalDraftSync`), chỉ chặn lệnh gọi `executeCoordinatorSave` khi vượt quota tại `#L309` và chặn phần đồng bộ server tại `#L326` bằng `if (shouldBlockAutosaveForStory(ownerId, loadErrorStoryIdRef.current)) return;`, đồng thời thêm `loadErrorStoryIdRef` vào deps tại `#L345-L354`. Chặn tương tự tại `handleVisibilityChange` (`#L390`) và thêm `loadErrorStoryIdRef` vào deps của `useEffect` tại `#L413-L420` (`m-20`).
    - (d) Trong `executeCoordinatorSave` (`#L122-L139`, `#L247-L255` — `R-3`, `m-20`): Khi `outcome.status === "saved"`, gọi `onClearLoadError?.(storyId)` để gỡ khóa có scope theo `storyId`, và thêm `onClearLoadError` vào mảng deps.
    - Trong `reloadAfterDestructiveRejection` (`#L269-L297` — `m-18`): Nếu `destructivePrompt.reason === "corrupted_remote"`, chỉ gọi `setDestructivePrompt(null); return;` (giữ nguyên khóa an toàn, không gọi lại `fetchRemoteStoryState`).
    - Trong `saveNow` (`#L357-L382` — `R-1`, `R-3`, `m-12`, `m-17`, `m-20`): Bổ sung `loadErrorStoryIdRef`, `onClearLoadError`, `setStoryState`, `setSaveStatus`, `t` vào mảng deps (`#L373-L381`). Nếu `shouldBlockAutosaveForStory(targetStoryId, loadErrorStoryIdRef.current)` là `true`:
      1. **Single-Flight & Pre-Await Snapshot (`R-3`, `m-17`)**:
         - Kiểm tra `if (isRetryingLockedStoryRef.current === targetStoryId) return;`, đặt `isRetryingLockedStoryRef.current = targetStoryId;` và bọc toàn bộ khối retry trong `try { ... } finally { if (isRetryingLockedStoryRef.current === targetStoryId) { isRetryingLockedStoryRef.current = null; } }`.
         - Chụp `const snapshotStateForRecovery = latestStateRef.current.ownerStoryId === targetStoryId ? latestStateRef.current.state : (readLocalStoryDraft(targetStoryId, t("novelcrafterDefaultChapterTitle"))?.state ?? currentState);` **trước** `await`.
      2. **Bước 1 (`R-3`, `m-12` — Khi `await fetchRemoteStoryState(targetStoryId, ...)` thành công)**:
         - Chạy các thao tác dữ liệu theo `targetStoryId`: `coordinator.seedServerMeta(targetStoryId, { version: remoteState.version, updatedAt: remoteState.updatedAt });`, `const postReconcileEpoch = coordinator.bumpEpoch(targetStoryId);`, `const localEnvelope = readLocalStoryDraft(targetStoryId, t("novelcrafterDefaultChapterTitle")); const reconciled = reconcileStoryStateWithDraft(remoteState, localEnvelope);`, `writeLocalStoryDraft(targetStoryId, reconciled.state, { baseVersion: remoteState.version, dirty: reconciled.shouldSyncDraftToServer });`, và `onClearLoadError?.(targetStoryId);`.
         - Kiểm tra owner sau `await`: `const stillOnTargetStory = shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId });`.
         - Chỉ khi `stillOnTargetStory === true` mới cập nhật `latestStateRef.current = { ownerStoryId: targetStoryId, state: reconciled.state }; setStoryState(reconciled.state);` và gọi `if (reconciled.conflictDetected) toast.info(t("novelcrafterConflictBackupNotice"));`.
         - Nếu `reconciled.shouldSyncDraftToServer` là `true`, thêm `dirtyStoryIdsRef.current.add(targetStoryId)` và `await executeCoordinatorSave(targetStoryId, reconciled.state, { epoch: postReconcileEpoch, isManual: true })`; ngược lại xóa `dirtyStoryIdsRef.current.delete(targetStoryId)` và nếu `stillOnTargetStory === true` thì đặt `setSaveStatus("saved")`.
      3. **Bước 2 (`R-1`, `R-3` — Khi `fetchRemoteStoryState` ném lỗi `err`)**:
         - Kiểm tra ngay `if (!shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })) return;` (`R-3` / Timeline T-G: nếu user đã chuyển sang story khác trong lúc `await`, thoát ngay lập tức, không mở modal hay hiện toast).
         - Khi vẫn đang ở `targetStoryId`, kiểm tra `const action = resolveLoadLockRecoveryAction(err instanceof StoryLoadError ? err.code : undefined);`:
           - Nếu `action === "overwrite_prompt"` (`err.code === "STORY_STATE_CORRUPTED"`): gọi `setDestructivePrompt({ storyId: targetStoryId, previousChars: 0, nextChars: snapshotStateForRecovery.chapters.reduce((acc, ch) => acc + ch.content.length, 0), pendingState: snapshotStateForRecovery, reason: "corrupted_remote" })` (`R-3`: dùng `snapshotStateForRecovery` đã chụp của `targetStoryId`).
           - Nếu `action === "keep_locked"` (mọi lỗi mạng, 401, 429, hoặc `DATABASE_ERROR` tạm thời): giữ nguyên khóa, đặt `setSaveStatus("error")` và gọi `toast.error(t("novelcrafterLoadError"))`.
  - Trong `src/app/features/novelcrafter/components/DestructiveSaveConfirmModal.tsx` (`#L33-L60` — `R-1`, `m-18`):
    - Kiểm tra `const isCorruptedRemote = prompt.reason === "corrupted_remote";`.
    - Khi `isCorruptedRemote === true`, hiển thị tiêu đề `t("novelcrafterCorruptedStateTitle")`, mô tả `t("novelcrafterCorruptedStateDesc").replace("{next}", prompt.nextChars.toLocaleString())`, và nhãn nút outline là `t("novelcrafterCorruptedStateKeepLockedBtn")`.
  - Trong `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` (`#L291-L310`) & `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx` (`#L48-L71`, `#L230-L349`, `#L411-L456`, `#L513`, `#L541`):
    - Thêm `isLoadLocked?: boolean` vào `ChapterEditorWorkspaceProps`, đổi `readOnly={isDirectStreamingToChapter}` tại `ChapterEditorWorkspace.tsx:513` thành `readOnly={isDirectStreamingToChapter || Boolean(isLoadLocked)}`, chặn các handler AI stream khi `isLoadLocked` là `true` (`m-13`), và truyền `isStreaming={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterDraftBeatsCard />` (`:411`) + `<InlineStoryBibleSection />` (`:541`) cùng `disabled={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterEmptyStateActions />` (`:433`) (`m-21`).
    - Tại `NovelcrafterStudioApp.tsx:291-310`, truyền `isLoadLocked={Boolean(story.validStoryId && story.loadErrorStoryId === story.validStoryId)}` vào `<ChapterEditorWorkspace />`.

#### Nhóm B — Vá lỗi Stream Lifecycle, Target Guard & Feedback Merge (Phase 1 Client & Pure Helpers)

- [ ] **Bước 2.1 — Bổ sung pure helper `shouldAbortStreamOnConversationChange` trong `src/lib/features/novelcrafter/streamRunRegistry.ts`**:
  - Export hàm thuần (không chứa nhánh `activeTargetStoryId === null` theo khuyến nghị `m-D`):
    ```ts
    export function shouldAbortStreamOnConversationChange(params: {
      prevStoryId: string | null;
      nextStoryId: string | null;
      activeTargetStoryId?: string | null;
      isPromotingPendingStory?: boolean;
    }): boolean {
      const { prevStoryId, nextStoryId, activeTargetStoryId, isPromotingPendingStory } = params;
      if (prevStoryId === nextStoryId) return false;
      if (
        prevStoryId === null &&
        nextStoryId !== null &&
        (isPromotingPendingStory || activeTargetStoryId === nextStoryId)
      ) {
        return false;
      }
      return true;
    }
    ```

- [ ] **Bước 2.2 — Bổ sung pure helper `mergeStreamedFeedbackItems` trong `src/lib/features/novelcrafter/feedbackParser.ts`**:
  - Import `normalizeFeedbackItems` từ `./stateLimits`.
  - Export hàm thuần `mergeStreamedFeedbackItems(params: { parsedItems: NovelcrafterFeedbackItem[]; baseItems: NovelcrafterFeedbackItem[]; isReplyMode?: boolean }): NovelcrafterFeedbackItem[]`:
    - Nếu `parsedItems.length === 0`, trả về `baseItems`.
    - Nếu `isReplyMode === true`: giữ toàn bộ `baseItems` và ghép `parsedItems` lên đầu.
    - Nếu `isReplyMode !== true`: giữ lại các thẻ trong `baseItems` có `status === "resolved"` hoặc đã có tương tác của tác giả (`Boolean(item.userReply?.trim()) || Boolean(item.rating)`), thay thế các thẻ `open` chưa tương tác bằng `parsedItems`.
    - Khử trùng lặp theo khóa `${item.category}::${item.quote.trim().toLowerCase()}::${item.comment.trim().toLowerCase()}` và trả kết quả qua `normalizeFeedbackItems(deduped)`.

- [ ] **Bước 2.3 — Sửa vòng đời Stream trong `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts`, `useDirectStreamBridge.ts`, `NovelcrafterStudioApp.tsx` và `ChapterEditorWorkspace.tsx`**:
  - Trong `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts`:
    1. Thêm `replyToFeedbackId?: string` vào `TriggerNovelcrafterStreamParams` (`#L36-L53`) và cập nhật kiểu của `onStreamTerminated` (`#L96`) thành `(payload: StreamTerminatedPayload) => { handledRefusal?: boolean } | void`.
    2. Thêm `prevConversationIdRef = useRef<string | null>(selectedConversationId)` và `isPromotingStoryRef = useRef(false)`.
    3. Thay `useEffect` tại `#L128-L135` bằng:
       - Một `useEffect` theo dõi `[selectedConversationId, registry]`: lấy `prevStoryId = prevConversationIdRef.current`, cập nhật `prevConversationIdRef.current = selectedConversationId`, lấy `activeRunId = registry.getActiveRunId()` và `activeTargetStoryId = activeRunId ? registry.getTarget(activeRunId)?.targetStoryId : undefined`. Chỉ khi `shouldAbortStreamOnConversationChange({ prevStoryId, nextStoryId: selectedConversationId, activeTargetStoryId, isPromotingPendingStory: isPromotingStoryRef.current })` là `true` mới gọi `abortControllerRef.current?.abort()`, `abortControllerRef.current = null`, `registry.reset()`, `useNovelcrafterStreamStore.getState().resetStreamStore()`, và `setIsStreaming(false)`.
       - Một `useEffect(() => () => { abortControllerRef.current?.abort(); abortControllerRef.current = null; registry.reset(); useNovelcrafterStreamStore.getState().resetStreamStore(); }, [registry])` riêng cho unmount.
    4. Trong `triggerStream` (`#L156-L205`):
       - Khởi tạo `runId = registry.startRun(...)`, `controller = new AbortController()`, `abortControllerRef.current = controller`, `setIsStreaming(true)`, `setStreamingContent("")`, `setStreamingThinking("")`, `setStreamingMeta(initialMeta)`, `useNovelcrafterStreamStore.getState().beginStreamRun(runId, initialMeta)` **trước** khi gọi `opts.ensureStoryConversation()`.
       - Nếu `!opts.selectedConversationId`, bọc `await opts.ensureStoryConversation()` trong `try { isPromotingStoryRef.current = true; targetConversationId = await opts.ensureStoryConversation(); if (targetConversationId) { registry.promotePendingRunStory(runId, targetConversationId); } } catch (err: unknown) { streamLogger.error("Failed to ensure story conversation:", err); targetConversationId = null; } finally { isPromotingStoryRef.current = false; }` (`m-9`: nếu `ensureStoryConversation` ném exception bất ngờ, `targetConversationId` về `null` và đi thẳng vào nhánh thoát sớm bên dưới để dọn sạch `isStreaming` và `registry`).
       - Tại nhánh thoát sớm (`if (!targetConversationId || controller.signal.aborted || registry.getActiveRunId() !== runId)`): gọi `const wasCurrentRun = registry.endRun(runId);` và **chỉ khi** `wasCurrentRun || !registry.isBusy()` mới gọi `setIsStreaming(false)` và `useNovelcrafterStreamStore.getState().finishStreamRun(runId)` (`N-4`).
    5. Tại khối `catch` & `finally` (`#L321-L378`):
       - Lưu thông báo lỗi vào `let pendingErrorToast: string | null = null;` trong `catch` thay vì gọi `toast.error(msg)` ngay lập tức.
       - Trong `finally`: gọi `const wasCurrentRun = registry.endRun(runId);`, nếu `wasCurrentRun || !registry.isBusy()` thì `setIsStreaming(false)`. Nếu `wasCurrentRun`, gọi `const termResult = opts.onStreamTerminated?.(...)`; sau đó nếu `pendingErrorToast && !termResult?.handledRefusal` mới gọi `toast.error(pendingErrorToast)` (`m-C`).
  - Trong `src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts`:
    - Thêm `feedbackBaseItemsRef = useRef<{ storyId: string; chapterId: string; baseItems: NovelcrafterFeedbackItem[]; isReplyMode: boolean } | null>(null)`.
    - Trong `handleStreamStarted`: khi `params.feature === "feedback"`, lưu `baseItems: activeCh.feedbackItems ?? []` và `isReplyMode: Boolean(params.replyToFeedbackId)` vào `feedbackBaseItemsRef.current`.
    - Trong `handleStreamTokenChunk` (`#L130-L145`) và `handleStreamTerminated` (`#L164-L177`): dùng `mergeStreamedFeedbackItems({ parsedItems, baseItems, isReplyMode })`.
    - Tại `#L200-L202`: khi `resolved.refusalDetected && resolved.refusalMessage`, gọi `toast.error(resolved.refusalMessage.slice(0, 240))` và `return { handledRefusal: true };`.
  - Trong `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:77`:
    - Đổi `selectedConversationId: story.selectedConversationId` thành `selectedConversationId: story.validStoryId`.
  - Trong `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx:285-291`:
    - Truyền thêm `replyToFeedbackId: item.id` trong `onReplyFeedback`.

#### Nhóm C — Vá lỗi Prompt, Directives, Parsers, Draft Storage & UI/Typography (Phase 2)

- [ ] **Bước 3.1 — Giữ phần đầu + phần cuối (head + tail) cho `<preceding_prose>` trong `src/lib/features/novelcrafter/promptBuilder.ts`**:
  - Tại `#L326-L329`: Khi `rawProse = input.chapterProse.trim()` có `rawProse.length > MAX_CHAPTER_CONTEXT_CHARS`, tính `headChars = Math.floor(MAX_CHAPTER_CONTEXT_CHARS * 0.25)` và `tailChars = MAX_CHAPTER_CONTEXT_CHARS - headChars`, rồi tạo `proseWindow = `${rawProse.slice(0, headChars)}\n...[middle of chapter omitted for context budget]...\n${rawProse.slice(-tailChars)}``.

- [ ] **Bước 3.2 — Sửa `buildBibleDirective` và bổ sung `chapterExtraInstructions` trong `src/lib/features/novelcrafter/featureDirectives.ts` (`m-4`)**:
  - Trong `buildBibleDirective` (`#L94-L96`): Import `serializeStoryBibleWithStructuredCards` từ `./storyBibleSerializer` và ánh xạ tường minh:
    ```ts
    const serializedBible = serializeStoryBibleWithStructuredCards(input.storyBible);
    const existingContentByTarget: Record<Exclude<NovelcrafterBibleTarget, "draft">, string> = {
      synopsis: input.storyBible.synopsis.trim(),
      characters: serializedBible.charactersText.trim(),
      worldbuilding: serializedBible.worldbuildingText.trim(),
      outline: serializedBible.outlineText.trim(),
      scenes: input.chapterScenes?.trim() || "",
    };
    const currentSectionValue = existingContentByTarget[target];
    ```
  - Trong `buildFeatureDirective` (`#L200-L312`): Đọc `const chapterExtra = input.chapterExtraInstructions?.trim() ? \`Chapter Extra Instructions: \${input.chapterExtraInstructions.trim()}\` : "";`và chèn`chapterExtra`vào mảng`.filter(Boolean).join("\n")` của:
    - Cả 5 sub-mode của `write`: `first_draft_rough` (`#L212-L218`), `openings_3` (`#L221-L236`), `tone_shift` (`#L240-L246`), `guided` (`#L249-L254`), và nhánh default (`#L256-L262`).
    - Nhánh `rewrite` (`#L275-L281`, đặt ngay trước dòng `"Return ONLY the rewritten passage..."`).
    - Cả 2 sub-mode của `expand`: `describe` (`#L299-L304`) và nhánh default `expand` (`#L306-L311`).

- [ ] **Bước 3.3 — Sửa Regex trong `src/lib/features/novelcrafter/characterParser.ts` và `src/lib/features/novelcrafter/openingsParser.ts`**:
  - Trong `src/lib/features/novelcrafter/characterParser.ts` (`#L35`):
    - Đổi `const dashMatch = rawHeader.match(/^(.+?)\s*[—–-]\s*(.+)$/);` thành `const dashMatch = rawHeader.match(/^(.+?)(?:\s+[—–-]\s+|\s*:\s*)(.+)$/);` (chấp nhận đánh đổi: tiêu đề dùng em-dash viết liền không có khoảng trắng kiểu `Linh—Kiếm khách` sẽ giữ nguyên cả cụm làm `name` để bảo vệ an toàn các tên ghép `Spider-Man`, `T-800` — `m-6`).
  - Trong `src/lib/features/novelcrafter/openingsParser.ts` (`#L9-L10, #L28`):
    - Cập nhật `OPENING_DELIMITERS`:
      ```ts
      const OPENING_DELIMITERS =
        /(?:^|\n)[ \t]*(?:===+[ \t]*(?:\*\*)?OPENING[ \t]*(\d+)(?:\*\*)?[ \t]*(?:[:\-–—][ \t]*([^=\n]+?))?(?:\*\*)?[ \t]*===+|#{2,3}[ \t]*(?:\*\*)?(?:Opening|Mở đầu|Phương án)[ \t]*(\d+)(?:\*\*)?[ \t]*(?:[:\-–—][ \t]*([^\n]+?))?(?:\*\*)?)[ \t]*\n/gi;
      ```
    - Tại `#L28`: `const subtitle = (match[2] || match[4] || "").replace(/^\*\*|\*\*$/g, "").trim();`.

- [ ] **Bước 3.4 — Sửa `buildConflictBackupCard`, truyền `coordinator` vào `resolveValidNovelcrafterStoryId` và lấy state mới nhất khi trim retry**:
  - Trong `src/lib/features/novelcrafter/draftStorage.ts` (`#L187-L222`):
    - Trong `buildConflictBackupCard`, so sánh thêm `characterCards`, `worldElements`, `outlineItems` bằng `JSON.stringify` (bảo toàn cả các thẻ có `visibleToAI === false`) và so sánh thêm `(localCh.extraInstructions ?? "").trim()` với `(remoteCh?.extraInstructions ?? "").trim()`.
  - Trong `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts` (`#L68-L71`):
    - Truyền `coordinator` làm đối số thứ 3 và thêm `coordinator` vào mảng phụ thuộc `useMemo`:
      ```ts
      const validStoryId = useMemo(
        () => resolveValidNovelcrafterStoryId(selectedConversationId, stories, coordinator),
        [selectedConversationId, stories, coordinator]
      );
      ```
      _(Lưu ý `m-7`: `coordinator` là instance ổn định qua `useRef`, việc tính lại `validStoryId` diễn ra khi `selectedConversationId` hoặc `stories` thay đổi)._
  - Trong `src/app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts` (`#L172`):
    - Giữ nguyên `FALLBACK_TRIM_PAYLOAD_BYTES = 1_500_000`; khi gọi `enforceStatePayloadBudget`, truyền `latestStateRef.current.ownerStoryId === storyId ? latestStateRef.current.state : stateToSave`.

- [ ] **Bước 3.5 — Chặn double-trigger khi đang stream/load-lock & Chuẩn hóa 9 vị trí Typography + 2 file i18n**:
  - Trong `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`:
    - Thêm `if (isStreaming || isLoadLocked) return;` ở đầu `handleRunFirstDraft` (`#L230`), `handleRunRewrite` (`#L238`), `onReplyFeedback` (`#L279`), `onRunWrite` (`#L318`), `onRunFeedback` (`#L323`), `onRunExpand` (`#L337`), `onRunBrainstorm` (`#L349`), `onGenerateBeats`/`onRewriteBeats` (`#L412-L427`) và các callback của `ChapterEmptyStateActions` (`#L434-L454`), đồng thời truyền `isStreaming={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterDraftBeatsCard />` (`#L411`) + `<InlineStoryBibleSection />` (`#L541`) và `disabled={isStreaming || Boolean(isLoadLocked)}` xuống `<ChapterEmptyStateActions />` (`#L433`) (`m-13`, `m-21`).
  - Trong `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx`:
    - Thêm `if (isStreaming) return;` ở đầu `handleRunAi` (`#L120`) để đồng nhất hành vi với `ChapterEditorWorkspace.tsx` (`m-10`, `m-21`).
  - Chuẩn hóa đúng 9 vị trí `text-[10px]` / `text-[11px]` / `py-0.2` trong `src/app/features/novelcrafter/components/`:
    1. `NovelcrafterTopBar.tsx:219`: `py-0.2` $\rightarrow$ `py-0.5`, `text-[10px]` $\rightarrow$ `text-xs`.
    2. `ChapterAiToolMenus.tsx:298`: `text-[11px]` $\rightarrow$ `text-xs`.
    3. `ChapterEditorWorkspace.tsx:472`: `text-[11px]` $\rightarrow$ `text-xs`.
    4. `ChapterFeedbackGutter.tsx:221`: `text-[11px]` $\rightarrow$ `text-xs`.
    5. `ChapterFeedbackGutter.tsx:225`: `text-[11px]` $\rightarrow$ `text-xs`.
    6. `SheetSubToolbar.tsx:94`: `text-[11px]` $\rightarrow$ `text-xs`.
    7. `StoryBibleSectionCard.tsx:95`: `text-[11px]` $\rightarrow$ `text-xs`.
    8. `StoryBibleStructuredCards.tsx:282`: `text-[11px]` $\rightarrow$ `text-xs`.
    9. `StoryBibleWorkspace.tsx:242`: `text-[11px]` $\rightarrow$ `text-xs`.
  - Trong `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`:
    - Cập nhật `novelcrafterMasterGemHint` và `novelcrafterFeatureSlotsLabel` từ 5 tính năng sang 6 tính năng.
    - Bổ sung 3 khóa `novelcrafterCorruptedStateTitle`, `novelcrafterCorruptedStateDesc`, và `novelcrafterCorruptedStateKeepLockedBtn` cho hộp thoại khôi phục bản lưu hỏng giải mã (`R-1`, `m-18`).

#### Nhóm D — Tạo mới 6 Co-Located Unit Tests & Mở rộng 9 Test Files hiện hữu

- [ ] **Bước 4.1 — Mở rộng 9 file test hiện hữu (`[MODIFY]`)**:
  - Cập nhật `novelcrafterStreamRunner.server.test.ts` (**TC-01**), `streamQuotaGuard.server.test.ts` (**TC-02**), `storyPersistence.server.test.ts` (**TC-03A**), `src/app/api/novelcrafter/state/route.test.ts` (**TC-03A route**), `draftStorage.test.ts` (**TC-03B & backup card**), `promptBuilder.test.ts` (**TC-05**), `featureDirectives.test.ts` (**TC-06**), `storyBibleSerializer.test.ts`, và `feedbackParser.test.ts` (**TC-10**).

- [ ] **Bước 4.2 — Tạo mới 6 file co-located unit test còn thiếu (`[NEW]`)**:
  - Tạo `characterParser.test.ts` (**TC-07**), `openingsParser.test.ts` (**TC-08**), `pruneStoryBibleForStream.test.ts`, `streamRunRegistry.test.ts` (**TC-04 & TC-09**), `modelGuards.server.test.ts` (**TC-09**), `novelcrafterStreamStore.test.ts` (**TC-09**).

- [ ] **Bước 4.3 — Chạy cổng kiểm chứng chất lượng toàn diện (`npm run verify`)**:
  - Chạy `npm run verify` (`type-check && lint && test:run`) và đảm bảo pass 100%.

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Bảng dưới đây định nghĩa chính xác **Input $\rightarrow$ Expected Output / Side Effects $\rightarrow$ Target Test File** khớp 100% với chữ ký hàm và hành vi thực tế trong codebase:

| Mã TC      | Hàm / Module mục tiêu & File Test đích                                                                                                                                                                                                                              | Input & Kịch bản                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Expected Output & Side Effects (Tiêu chí Pass)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Boundary & Failure Modes                                                                                                                                                                      |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01**  | `runNovelcrafterStream` (`src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:386`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`                                                                 | **Case 1A**: Generator chỉ yield part `{ text: "Planning...", thought: true }` rồi kết thúc (không có `token` chunk).<br>**Case 1B**: Generator ném `new Error("Fatal at 10.0.0.1 with GEMINI_API_KEY=secret123")`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **Case 1A**: Callback `onFirstModelOutput` được gọi đúng **0 lần**; SSE phát event `error` có `code: "STREAM_ERROR"` và `message` chứa `"returned an empty response"`.<br>**Case 1B**: SSE event `error` có `message` đã qua `sanitizeError(err, true)` (trả về `"An error occurred. Please try again later."` do `sanitizationRatio < 0.5`), **tuyệt đối không** chứa `"10.0.0.1"` hay `"secret123"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Khi generator yield `token` chunk hợp lệ (`{ text: "Hello", thought: false }`), `onFirstModelOutput` được gọi đúng **1 lần** duy nhất.                                                        |
| **TC-02**  | `reserveNovelcrafterStreamQuota` (`src/lib/features/novelcrafter/streamQuotaGuard.server.ts:53`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/streamQuotaGuard.server.test.ts`                                                                         | Mock `getRedis()` trả về `{ incr: vi.fn(), expire: vi.fn(), eval: vi.fn(), decr: vi.fn() }` và mock `checkDailyMessageLimit` trả về `{ canSend: true, count: 8, limit: 10, rank: "basic" }`:<br>- Lần 1: `incr` $\rightarrow$ `1` (`effectiveCount = 9 <= 10`).<br>- Lần 2: `incr` $\rightarrow$ `2` (`effectiveCount = 10 <= 10`).<br>- Lần 3: `incr` $\rightarrow$ `3` (`effectiveCount = 11 > 10`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | - Lần 1: Gọi `expire(key, 360)` (không có `"NX"`), trả `{ allowed: true, count: 9, limit: 10 }`.<br>- Lần 2: Gọi `expire(key, 360, "NX")`, trả `{ allowed: true, count: 10, limit: 10 }`.<br>- Lần 3: Trả `{ allowed: false, count: 10, limit: 10 }` và gọi `redis.eval(DECR_AND_CLEANUP_LUA, [key], [])` để hoàn trả slot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Khi gọi `lease.releaseReservation()` nhiều lần liên tiếp, chỉ gọi `redis.eval` đúng **1 lần** ở lần đầu tiên (`released = true`).                                                             |
| **TC-03A** | `getStoryState` & `saveStoryState` (`src/lib/features/novelcrafter/storyPersistence.server.ts:109, 134`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/storyPersistence.server.test.ts` & `src/app/api/novelcrafter/state/route.test.ts`                | - **Case 3A-1 (`R-1` — Corrupted Row)**: Dòng `messages` có `content: "corrupted-ciphertext"` và `meta: { novelcrafterType: "story_state", version: 2, updatedAt: 1000 }`.<br>- **Case 3A-2 (`m-8`, `m-19` — Unconfirmed Save on Corrupted Row with Large `nextChars`)**: Gọi `saveStoryState` trên dòng hỏng với `incomingState` (`version: 2, updatedAt: 2000`, `chapters[0].content = "A".repeat(5_000)`) và `allowDestructive !== true`.<br>- **Case 3A-3 (`P-1`, `R-4`, `m-16` — Confirmed Recovery on Corrupted Row)**: Gọi `saveStoryState` trên dòng hỏng với `incomingState` (`version: 1, updatedAt: 500`) kèm `{ allowDestructive: true }`.<br>- **Case 3A-4 (`R-2` — Stale Save on Healthy Row with `allowDestructive: true`)**: Dòng `messages` **hợp lệ, được mã hóa bằng `encryptText`** (`version: 2, updatedAt: 2000`); gọi `saveStoryState` với `incomingState` stale (`version: 1, updatedAt: 500`) kèm `{ allowDestructive: true }`.<br>- **Case 3A-5 (`R-4` — Backup Row Survives Subsequent Normal Saves)**: Ngay sau Case 3A-3 (`version: 3`), chỉnh sửa state và gọi thêm `saveStoryState` bình thường (`allowDestructive` không bật) để lưu `version: 4`, rồi gọi `getStoryState`. | - **Case 3A-1**: `getStoryState` ném `AppError` (`statusCode === 500`, `code === "STORY_STATE_CORRUPTED"`). Route `GET /api/novelcrafter/state` trả về HTTP `500` với `{ error: { code: "STORY_STATE_CORRUPTED" } }`.<br>- **Case 3A-2 (`m-19`)**: **Luôn ném `AppError` 409 với `code === "DESTRUCTIVE_SAVE_REJECTED"`** kể cả khi `nextChars > 5_000`.<br>- **Case 3A-3**: Bỏ qua stale check vì `existingCorrupted && allowDestructive`, chèn dòng backup riêng có `meta.novelcrafterType === "story_state_corrupted_backup"` (`content === "corrupted-ciphertext"`), và cập nhật dòng chính lên `version === 3`.<br>- **Case 3A-4 (`R-2`)**: **Vẫn ném `ValidationError` (`STALE_STORY_STATE_MESSAGE`)** vì `existingCorrupted === false`!<br>- **Case 3A-5 (`R-4`)**: Lần lưu tiếp theo cập nhật dòng `"story_state"` lên `version === 4`, `getStoryState` trả về đúng bản `version === 4`, và dòng backup `meta.novelcrafterType === "story_state_corrupted_backup"` trong `storedMessages` **vẫn tồn tại nguyên vẹn** với `content === "corrupted-ciphertext"` (không bị ghi đè và không bị dọn duplicate xóa mất)! | Khi bảng `messages` chưa có dòng nào cho `conversationId` (`rows.length === 0`), `getStoryState` vẫn trả về `createDefaultStoryState()` (HTTP `200`).                                         |
| **TC-03B** | `resolveStoryLoadFailureState`, `shouldBlockAutosaveForStory`, `resolveLoadLockRecoveryAction` & `shouldApplyLoadLockRetryResult` (`src/lib/features/novelcrafter/draftStorage.ts`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/draftStorage.test.ts` | - **Case 3B-1**: `storyId = "story-err-1"` chưa có bản nháp trong `localStorage`.<br>- **Case 3B-2**: `storyId = "story-err-2"` đã có bản nháp local hợp lệ lưu qua `writeLocalStoryDraft`.<br>- **Case 3B-3 (`P-1`)**: Kiểm tra `shouldBlockAutosaveForStory(storyId, loadErrorStoryId)` với `("story-err-1", "story-err-1")`, `("story-ok", "story-err-1")`, `("story-ok", null)`, và `(null, "story-err-1")`.<br>- **Case 3B-4 (`R-1`)**: Kiểm tra `resolveLoadLockRecoveryAction(errorCode)` với `"STORY_STATE_CORRUPTED"`, `"DATABASE_ERROR"`, `"RATE_LIMIT_EXCEEDED"`, `undefined`, `null`.<br>- **Case 3B-5 (`R-3` — Owner Guard after `await`)**: Kiểm tra `shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId })` với `("story-a", "story-a")`, `("story-a", "story-b")`, `("story-a", null)`, và `(null, "story-a")`.                                                                                                                                                                                                                                                                                                                                                            | - **Case 3B-1**: Trả về `{ ownerStoryId: "story-err-1", state }` với `state` là default story state sạch.<br>- **Case 3B-2**: Trả về `{ ownerStoryId: "story-err-2", state }` khớp với `state` của bản nháp local.<br>- **Case 3B-3**: Trả về `true` chỉ khi `storyId === "story-err-1" && loadErrorStoryId === "story-err-1"`, còn lại trả về `false`.<br>- **Case 3B-4 (`R-1`)**: Trả về `"overwrite_prompt"` duy nhất khi `errorCode === "STORY_STATE_CORRUPTED"`, và trả về `"keep_locked"` cho mọi mã lỗi khác.<br>- **Case 3B-5 (`R-3`)**: Trả về `true` chỉ khi `targetStoryId === "story-a" && currentOwnerStoryId === "story-a"`, và trả về `false` khi owner đã chuyển sang `"story-b"` hoặc `null`!                                                                                                                                                                                                                                                                                                                                                                                                             | Ngăn chặn tuyệt đối việc áp dụng kết quả retry hoặc mở hộp thoại ghi đè của Story A lên màn hình của Story B (Timeline T-G & T-H).                                                            |
| **TC-04**  | `shouldAbortStreamOnConversationChange` (`src/lib/features/novelcrafter/streamRunRegistry.ts`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/streamRunRegistry.test.ts`                                                                                 | - **Case 4A**: `{ prevStoryId: null, nextStoryId: "story-1", activeTargetStoryId: "story-1", isPromotingPendingStory: false }`.<br>- **Case 4B**: `{ prevStoryId: null, nextStoryId: "story-1", activeTargetStoryId: null, isPromotingPendingStory: true }`.<br>- **Case 4C**: `{ prevStoryId: null, nextStoryId: "story-other", activeTargetStoryId: null, isPromotingPendingStory: false }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | - **Case 4A & 4B**: Trả về `false` (không hủy stream khi promote từ `null` sang story mới vừa tạo).<br>- **Case 4C**: Trả về `true` (hủy stream nếu người dùng tự bấm chọn một story khác khi không phải đang promote).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Khi `prevStoryId === nextStoryId`, luôn trả về `false`.                                                                                                                                       |
| **TC-05**  | `buildNovelcrafterUserPrompt` (`src/lib/features/novelcrafter/promptBuilder.ts:287`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/promptBuilder.test.ts`                                                                                               | Chương hiện tại có `chapterProse` dài `25_000` ký tự (`> MAX_CHAPTER_CONTEXT_CHARS = 18_000`), đầu chương là `"HEAD_MARKER_START"`, cuối chương là `"TAIL_MARKER_END"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Chuỗi `<preceding_prose>` trong prompt chứa cả `"HEAD_MARKER_START"`, `"...[middle of chapter omitted for context budget]..."`, và `"TAIL_MARKER_END"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Chương có độ dài `<= 18_000` ký tự được giữ nguyên 100% không chèn dòng omitted.                                                                                                              |
| **TC-06**  | `buildFeatureDirective` (`src/lib/features/novelcrafter/featureDirectives.ts:199`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/featureDirectives.test.ts` (`m-4`, `m-14`)                                                                             | - **Case 6A (`m-14`)**: Gọi `buildFeatureDirective` với `chapterExtraInstructions: "Giữ giọng văn cổ phong"` trên đủ **5 sub-mode** của nhánh `write` (`first_draft_rough`, `openings_3`, `tone_shift`, `guided`, và default `auto`), nhánh `rewrite` (`selectedText: "Đoạn văn"`), và **2 sub-mode** của nhánh `expand` (`describe` và `expand`).<br>- **Case 6B**: `feature: "bible"`, `bibleTarget: "characters"`, `actionMode: "rewrite"`, `storyBible.characters: ""` nhưng `characterCards: [{ id: "c1", name: "Linh", role: "Kiếm khách", traits: "Lạnh lùng", visibleToAI: true }]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | - **Case 6A**: Cả 8 lời gọi (5 sub-mode `write` + 1 `rewrite` + 2 sub-mode `expand`) đều trả về directive chứa `"Chapter Extra Instructions: Giữ giọng văn cổ phong"`.<br>- **Case 6B**: Directive trả về chứa `"### Linh (Kiếm khách)"` và `"Lạnh lùng"` trong `<current_characters>`, không ném `ValidationError`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Nếu cả `storyBible.characters` và `characterCards` (visible) đều rỗng và không có `customInstruction`, `actionMode: "rewrite"` ném `ValidationError`.                                         |
| **TC-07**  | `parseCharacterCardsFromMarkdown` (`src/lib/features/novelcrafter/characterParser.ts:8`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/characterParser.test.ts`                                                                                         | Văn bản đầu vào (`m-6`):<br>`### Spider-Man — Superhero`<br>`Nhanh nhẹn, thông minh`<br>`### Jean-Luc Picard: Starfleet Captain`<br>`Điềm tĩnh`<br>`### T-800`<br>`**Vai trò**: vệ sĩ\nBền bỉ`<br>`### Linh—Kiếm khách`<br>`Lạnh lùng`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Trả về mảng 4 `StoryBibleCharacterCard`:<br>1. `{ name: "Spider-Man", role: "Superhero", traits: "Nhanh nhẹn, thông minh", visibleToAI: true }`<br>2. `{ name: "Jean-Luc Picard", role: "Starfleet Captain", traits: "Điềm tĩnh", visibleToAI: true }`<br>3. `{ name: "T-800", role: "vệ sĩ", traits: "Bền bỉ", visibleToAI: true }`<br>4. `{ name: "Linh—Kiếm khách", role: "", traits: "Lạnh lùng", visibleToAI: true }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Dấu gạch nối liền không có khoảng trắng hai bên (`Spider-Man`, `Jean-Luc`, `T-800`, `Linh—Kiếm khách`) được giữ nguyên trong `name`; tuân thủ giới hạn `MAX_CHARACTER_CARDS - existingCount`. |
| **TC-08**  | `parseThreeOpenings` (`src/lib/features/novelcrafter/openingsParser.ts:12`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/openingsParser.test.ts`                                                                                                       | Đầu vào có dấu `**` bọc tiêu đề:<br>`=== **OPENING 1: Hành động kịch tính** ===\nNội dung 1\n=== **OPENING 2: Đối thoại bí ẩn** ===\nNội dung 2\n### **Phương án 3: Miêu tả nội tâm**\nNội dung 3`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Trả về mảng 3 phần tử `ParsedOpeningOption`:<br>1. `{ label: "Opening 1: Hành động kịch tính", content: "Nội dung 1" }`<br>2. `{ label: "Opening 2: Đối thoại bí ẩn", content: "Nội dung 2" }`<br>3. `{ label: "Opening 3: Miêu tả nội tâm", content: "Nội dung 3" }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Khi đầu vào có `< 2` delimiter khớp, fallback trả về mảng 1 phần tử `[{ label: "Opening 1", content: trimmed }]` (khớp `openingsParser.ts:17-19`).                                            |
| **TC-09**  | `NovelcrafterStreamRunRegistry` (`streamRunRegistry.ts`), `isValidGenerationModel` (`modelGuards.server.ts`), `useNovelcrafterStreamStore` & `createRafStreamBatcher` (`novelcrafterStreamStore.ts`)<br>$\rightarrow$ Test tại 3 file `.test.ts` tương ứng          | - `NovelcrafterStreamRunRegistry`: `startRun` $\rightarrow$ `promotePendingRunStory` $\rightarrow$ `endRun`.<br>- `isValidGenerationModel`: kiểm tra `"gemini-2.5-flash"`, `MODEL_IDS.NOVELCRAFTER`, `""`.<br>- `useNovelcrafterStreamStore` & `createRafStreamBatcher` (`m-11`): khởi tạo `const batcher = createRafStreamBatcher((snap) => useNovelcrafterStreamStore.getState().flushStreamSnapshot(snap))`, gọi `beginStreamRun` $\rightarrow$ `batcher.scheduleUpdate` $\rightarrow$ `batcher.flushNow` $\rightarrow$ `finishStreamRun`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | - `promotePendingRunStory(runId, "story-99")` cập nhật `getTarget(runId)?.targetStoryId === "story-99"`.<br>- `isValidGenerationModel` trả `true` cho `"gemini-2.5-flash"` và `false` cho `MODEL_IDS.NOVELCRAFTER`, `MODEL_IDS.IMAGE_STUDIO`, `""`.<br>- Khi truyền callback `onFlush` gọi `flushStreamSnapshot(snap)`, `batcher.scheduleUpdate` + `batcher.flushNow()` cập nhật `streamingText` và `streamingThinking` trong `useNovelcrafterStreamStore`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Khi gọi `resetStreamStore()`, trạng thái store trở về `{ isStreaming: false, activeRunId: null, streamingText: "", streamingThinking: "", streamingMeta: null }`.                             |
| **TC-10**  | `mergeStreamedFeedbackItems` (`src/lib/features/novelcrafter/feedbackParser.ts`)<br>$\rightarrow$ Test tại: `src/lib/features/novelcrafter/feedbackParser.test.ts`                                                                                                  | `baseItems` gồm 1 thẻ `resolved`, 1 thẻ `open` đã có `userReply: "Đã sửa"`, và 1 thẻ `open` chưa tương tác.<br>- **Case 10A (`isReplyMode: false`)**: truyền `parsedItems` mới.<br>- **Case 10B (`isReplyMode: true`)**: truyền `parsedItems` phản hồi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | - **Case 10A**: Giữ thẻ `resolved` và thẻ `open` có `userReply`, thay thế thẻ `open` chưa tương tác bằng `parsedItems`, khử trùng lặp.<br>- **Case 10B**: Giữ toàn bộ `baseItems` và ghép `parsedItems` mới lên đầu. Tổng số thẻ luôn `<= 50`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Khi tổng số thẻ vượt quá 50, `normalizeFeedbackItems` giữ lại tối đa 50 thẻ và ưu tiên giữ thẻ `open` hơn thẻ `resolved`.                                                                     |

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 8.1. Chi tiết 6 File Unit Test Co-Located Mới (`[NEW]`)

1. **`src/lib/features/novelcrafter/characterParser.test.ts`**
   - Kiểm thử `parseCharacterCardsFromMarkdown(markdown, existingCount)`:
     - Giữ nguyên tên có dấu gạch nối liền không có khoảng trắng hai bên (`Spider-Man`, `Jean-Luc Picard`, `T-800`, `Linh—Kiếm khách`) khi tách `role` qua `—`, `-`, `: ` hoặc `(Role)`.
     - Trích xuất đúng `role` từ dòng đầu body `**Role**: ...` hoặc `**Vai trò**: ...` khi tiêu đề chưa có role (`characterParser.ts:44-49`).
     - Tôn trọng giới hạn `MAX_CHARACTER_CARDS - existingCount`.
2. **`src/lib/features/novelcrafter/openingsParser.test.ts`**
   - Kiểm thử `parseThreeOpenings(rawOutput)`:
     - Parse chính xác cả định dạng banner `=== OPENING 1: ... ===`, `=== **OPENING 1: ...** ===` và Markdown heading `### **Phương án 1: ...**` thành `{ label: "Opening 1: ...", content: "..." }`.
     - Loại bỏ sạch dấu `**` thừa ở `subtitle`.
     - Fallback trả về `[{ label: "Opening 1", content: trimmed }]` khi có `< 2` delimiter khớp.
3. **`src/lib/features/novelcrafter/pruneStoryBibleForStream.test.ts`**
   - Kiểm thử `pruneStoryBibleForStream(storyBible, feature, bibleTarget)`:
     - Chỉ giữ `braindump` khi `feature === "bible"` và `bibleTarget === "synopsis" | "outline"`.
     - Lọc bỏ `characters`/`characterCards` khi `charactersVisibleToAI === false` và lọc từng card có `visibleToAI === false`.
     - Lọc bỏ `worldbuilding`/`worldElements` khi `worldbuildingVisibleToAI === false` và lọc từng phần tử có `visibleToAI === false`.
4. **`src/lib/features/novelcrafter/streamRunRegistry.test.ts`**
   - Kiểm thử class `NovelcrafterStreamRunRegistry` (`startRun`, `promotePendingRunStory`, `getTarget`, `getActiveRunId`, `isBusy`, `endRun`, `reset`) và hàm `shouldAbortStreamOnConversationChange` (**TC-04 & TC-09**).
5. **`src/lib/features/novelcrafter/modelGuards.server.test.ts`**
   - Kiểm thử `isValidGenerationModel(modelId)` với các model hợp lệ (`"gemini-2.5-flash"`, `"claude-sonnet-4.5"`), các pseudo-model bị cấm (`MODEL_IDS.NOVELCRAFTER`, `MODEL_IDS.IMAGE_STUDIO`), và chuỗi rỗng/không hợp lệ (`""`, `"unknown-model-xyz"`).
6. **`src/lib/features/novelcrafter/novelcrafterStreamStore.test.ts`**
   - Kiểm thử `useNovelcrafterStreamStore` (`beginStreamRun`, `updateStreamMeta`, `flushStreamSnapshot`, `finishStreamRun`, `resetStreamStore`) và `createRafStreamBatcher` (truyền callback `(snap) => useNovelcrafterStreamStore.getState().flushStreamSnapshot(snap)` khi kiểm thử `scheduleUpdate`, `flushNow`, `cancel` — `m-11`).

#### 8.2. Lệnh Kiểm Chứng Bắt Buộc (Verification Commands)

Sau khi hoàn tất triển khai, `@developer` và `@qa` chạy tuần tự các lệnh sau:

```powershell
# 1. Chạy toàn bộ unit test trong thư mục novelcrafter và route state
npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state/route.test.ts

# 2. Chạy cổng kiểm tra chất lượng toàn dự án (type-check + lint + test:run)
npm run verify
```

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

Mỗi rủi ro đều được ánh xạ tới **Technical Control cụ thể trong code** và **File Test kiểm chứng** (đáp ứng tiêu chuẩn `B-1`, `N-6`, `P-1`, `R-1..R-4` và `m-16..m-21` của Reviewer):

| #     | Rủi ro tiềm ẩn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |     Mức độ     | Technical Control trong Code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Bằng chứng kiểm chứng (Test Verification)                                                                                                                                                                                                       |
| :---- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Khi tạo story mới từ trạng thái trắng (`selectedConversationId: null` $\rightarrow$ `newStoryId`), effect theo dõi `selectedConversationId` hủy nhầm stream vừa mở, hoặc `ensureStoryConversation` ném lỗi làm kẹt `isStreaming`, hoặc nhánh thoát sớm của Run A tắt nhầm `isStreaming` của Run B mới hơn.                                                                                                                                                                                                                            |    **Cao**     | 1. Tách hàm thuần `shouldAbortStreamOnConversationChange` trong `src/lib/features/novelcrafter/streamRunRegistry.ts`.<br>2. Trong `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts`: tạo `AbortController` + `setIsStreaming(true)` trước khi `await opts.ensureStoryConversation()`, bọc `ensureStoryConversation` trong `try/catch/finally` (`m-9`), gọi `promotePendingRunStory` bên trong `try`, và ở nhánh thoát sớm chỉ gọi `setIsStreaming(false)` khi `wasCurrentRun \|\| !registry.isBusy()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Được kiểm thử tự động bởi **TC-04** và **TC-09** trong `src/lib/features/novelcrafter/streamRunRegistry.test.ts`.                                                                                                                               |
| **2** | Khi stream tính năng `feedback`, việc parse lại văn bản tích lũy qua từng chunk làm mất thẻ `resolved`/`open` đã trả lời hoặc tạo thẻ trùng lặp vượt quá 50 thẻ.                                                                                                                                                                                                                                                                                                                                                                      |    **Cao**     | Tách hàm thuần `mergeStreamedFeedbackItems` trong `src/lib/features/novelcrafter/feedbackParser.ts`: phân tách rõ `isReplyMode`, bảo toàn thẻ `resolved` và thẻ `open` đã có `userReply`/`rating`, khử trùng lặp theo `category + quote + comment`, và giới hạn qua `normalizeFeedbackItems` (`stateLimits.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Được kiểm thử tự động bởi **TC-10** trong `src/lib/features/novelcrafter/feedbackParser.test.ts`.                                                                                                                                               |
| **3** | Kịch bản Redis In-Flight Quota bị trượt TTL (sliding TTL) khi gọi `expire` liên tục hoặc bị race condition khi gọi `decr` và `del` rời rạc.                                                                                                                                                                                                                                                                                                                                                                                           | **Trung bình** | Trong `src/lib/features/novelcrafter/streamQuotaGuard.server.ts`: dùng `redis.expire(key, INFLIGHT_TTL_SECONDS, "NX")` khi `inFlight > 1` và dùng Lua script nguyên tử qua `redis.eval` để thực hiện `DECR` + `DEL` trong cùng một lệnh Redis.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Được kiểm thử tự động bởi **TC-02** trong `src/lib/features/novelcrafter/streamQuotaGuard.server.test.ts`.                                                                                                                                      |
| **4** | Khi tải story thất bại: (a) Client rơi vào vòng lặp autosave `PUT 400 + GET 500` (`P-1`), (b) mở nhầm hộp thoại ghi đè khi lỗi chỉ là mất mạng/429/DB tạm thời (`R-1`), (c) `allowDestructive` bỏ qua stale check làm mất dữ liệu giữa 2 tab trên bản ghi lành (`R-2`), (d) chuyển sang story B trong lúc đang `await fetchRemoteStoryState(A)` làm trộn state hoặc ghi đè nội dung B vào A (`R-3`), hoặc (e) lệch khóa `DATA_ENCRYPTION_KEY` làm mất ciphertext gốc khi ghi đè hoặc ở các lần lưu tiếp theo (`R-4`, `m-16`, `m-19`). |    **Cao**     | 1. **Server (`storyPersistence.server.ts`)**: `getStoryState` log marker `[STORY_STATE_CORRUPTED]` và ném mã lỗi riêng `STORY_STATE_CORRUPTED` (500); `saveStoryState` tính `existingCorrupted` trước stale check, **chỉ bỏ qua stale check khi `existingCorrupted && allowDestructive`** (`R-2`), **luôn ném 409 `DESTRUCTIVE_SAVE_REJECTED` khi `existingCorrupted && !allowDestructive`** (`m-19`), và khi ghi đè dòng hỏng thì **chèn một dòng `messages` backup riêng (`meta.novelcrafterType = "story_state_corrupted_backup"`)** tồn tại vĩnh viễn qua mọi lần lưu tiếp theo (`R-4`).<br>2. **Client (`draftStorage.ts`, `useStoryPersistenceLifecycle.ts`, `useNovelcrafterStory.ts`)**: Tách 4 pure helpers (`resolveStoryLoadFailureState`, `shouldBlockAutosaveForStory`, `resolveLoadLockRecoveryAction`, `shouldApplyLoadLockRetryResult`); chụp `snapshotStateForRecovery` trước `await`, dùng single-flight `isRetryingLockedStoryRef` (`m-17`), scope `onClearLoadError(storyId)` theo đúng `storyId`, và kiểm tra `shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId: latestStateRef.current.ownerStoryId })` sau `await` ở cả 2 nhánh của `saveNow` (`R-3`). | Được kiểm thử tự động ở cả 2 phía: Server bởi **TC-03A** (Cases 3A-1..3A-5 tại `storyPersistence.server.test.ts` & `state/route.test.ts`) và Client bởi **TC-03B** (Cases 3B-1..3B-5 tại `src/lib/features/novelcrafter/draftStorage.test.ts`). |
| **5** | Biểu thức chính quy mới trong `openingsParser.ts` làm mất cờ `/g` khi gọi `matchAll` hoặc làm lệch chỉ số capture group `match[1..4]`.                                                                                                                                                                                                                                                                                                                                                                                                | **Trung bình** | Giữ nguyên cờ `/gi` và cấu trúc 4 capture groups `match[1..4]` trong `OPENING_DELIMITERS`, chỉ bổ sung non-capturing group `(?:\*\*)?` cho dấu sao Markdown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Được kiểm thử tự động bởi **TC-08** trong `src/lib/features/novelcrafter/openingsParser.test.ts`.                                                                                                                                               |

---

## Audit History

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-17
- **Đối tượng**: Technical Plan Revision 1 (`round: 1`, `status: DRAFT`)
- **Kiểm chứng lỗi cũ**: N/A — đây là lượt audit đầu tiên.

#### Baseline đã chạy

- `[CMD]` `npm run type-check` → exit 0 (baseline sạch).
- `[CMD]` `npx vitest run src/lib/features/novelcrafter` → `Test Files 14 passed (14)`, `Tests 64 passed (64)`.
- `[CMD]` Probe regex (node) cho Bước 3.5 — kết quả ở M-5 bên dưới.
- `[CMD]` `npx tsx -e` probe `sanitizeError(new Error("Raw SDK secret failure at 10.0.0.1"), true)` → `"Raw SDK secret failure at [stack]"`.

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả                 | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **FAIL**                | `[CMD]` type-check baseline exit 0, không thêm dependency (khớp `package.json`). Nhưng plan tham chiếu path/symbol không tồn tại (M-1), Bước 3.3 sẽ gây lỗi TypeScript (M-4), Bước 3.5 sẽ gây `TypeError` lúc runtime (M-5). Bảng S1 của plan ghi PASS với `[SRC]` sai → `UNVERIFIED`.                                                                                                                                            |
| **S2 Lifecycle & Teardown**  | **FAIL**                | `[SRC]` `useNovelcrafterStream.ts:128-135` (cleanup gắn với `selectedConversationId`), `:163-181` (`startRun` → `await ensureStoryConversation()`), `:191` (`setIsStreaming(true)` chạy **sau** khi ensure xong), `:334-338` (`endRun` trả về `false` sau `reset()` → kẹt `isStreaming`). Bug có thật, nhưng thiết kế fix chưa xác định (dùng "hoặc") và còn hở thứ tự commit của React (M-6). Không có regression test cho hook. |
| **S3 Database & Temporal**   | **FAIL**                | Không có migration/RLS mới (đúng). Cơ chế Redis (BUG-03) còn thiếu Adversarial Timeline cho trục Đồng thời và TTL trượt (M-8). Luồng `DatabaseError` mới chưa mô phỏng phía client (M-9).                                                                                                                                                                                                                                         |
| **S4 Cross-Task State Flow** | **FAIL**                | `[SRC]` `NovelcrafterStudioApp.tsx:77` truyền `story.selectedConversationId` cho bridge còn `:84` truyền `story.validStoryId` cho stream → đổi sang `validStoryId` là đúng. Nhưng ngữ nghĩa merge feedback mâu thuẫn với thiết kế hiện tại (M-7). Khi load lỗi, `latestStateRef` vẫn giữ owner của story trước (M-9).                                                                                                             |
| **S5 Security Boundary**     | **PASS (có điều kiện)** | Không đụng route/auth/service_role. Đổi sang `sanitizeError` là đúng hướng (`[SRC]` `errors.ts:148-158`, route state đã dùng ở `state/route.ts:62,74`). Riêng kỳ vọng test TC-01 thì sai (M-3).                                                                                                                                                                                                                                   |
| **S6 External Resilience**   | **PASS**                | `[SRC]` `novelcrafterStreamRunner.server.ts:503-525` — bọc `enqueue`/`close` trong try/catch; không đổi `maxDuration`; không log credential. Có ghi chú MINOR m-4 về lạm dụng compute khi chỉ có `thinking`.                                                                                                                                                                                                                      |

#### Adversarial Timelines bổ sung (reviewer)

```
Cơ chế: Redis in-flight counter — expire vô điều kiện (Bước 2.2)
T1: Stream A rò rỉ 1 đơn vị (worker bị kill trước release) → key = 1
T2: User mở stream mới mỗi < 360s → mỗi lần incr kéo theo expire(key, 360) → TTL được làm mới liên tục
T3: Key không bao giờ hết hạn trong ngày khi user còn hoạt động; effectiveCount = count + inFlight bị cộng dư 1
Kết cục: Đơn vị rò rỉ sống đến hết ngày UTC (key chứa ngày ở streamQuotaGuard.server.ts:21-22) → LỖI (MAJOR)
```

```
Cơ chế: decr → del (Bước 2.2)
T1: A release: decr → 0 | T2: B reserve: incr → 1, expire | T3: A thực thi del(key)
Kết cục: Reservation của B bị xóa; stream C tiếp theo thấy inFlight=1 thay vì 2 → đếm thiếu, vượt quota → LỖI (MAJOR)
```

```
Cơ chế: BUG-01 fix theo phương án "ensure trước startRun"
T1: triggerStream await ensureStoryConversation() → selectConversation(newId) (React setState, chưa commit)
T2: Promise resolve → microtask chạy tiếp: startRun + new AbortController + fetch()
T3: React commit re-render → effect cleanup [selectedConversationId] chạy → abort() + registry.reset()
Kết cục: Nếu không có guard prevConversationIdRef thì vẫn tự hủy → phải BẮT BUỘC cả hai biện pháp, không phải "hoặc" → LỖI THIẾT KẾ (MAJOR)
```

```
Cơ chế: Escape trong lúc ensure (phương án isEnsuringStoryRef)
T1: setIsStreaming(true), isEnsuringStoryRef=true, await ensure... | T2: User nhấn Escape → stopStream(): abortControllerRef=null, activeRunId=null → setIsStreaming(false)
T3: ensure resolve → startRun + fetch vẫn chạy
Kết cục: Lệnh Stop của user bị bỏ qua, stream chạy ngầm → LỖI (MAJOR, thuộc M-6)
```

#### Phân loại lỗi

**[BLOCKER]**

- **B-1 (Risk Table Audit — evidence-bar 4.5.4)**: Rủi ro 1 và Rủi ro 2 được xếp **Cao**, nhưng control chỉ là dự định (code trong `useNovelcrafterStream.ts`/`useDirectStreamBridge.ts`). Plan không có bước Verification hay test chứng minh control hoạt động: không có test cho hook, không có test cho logic merge/slice. Theo 4.5.4, rủi ro Cao không có control đã xác minh → BLOCKER. **Yêu cầu**: tách logic thuần vào `src/lib/features/novelcrafter/` (ví dụ `mergeStreamedFeedbackItems(...)`, `shouldAbortOnConversationChange(prevId, nextId, activeTarget)`) kèm co-located test. Hoặc bổ sung test `renderHook` cho kịch bản `null → newStoryId` để chứng minh `isStreaming` trở về `false` và không bị abort.

**[MAJOR]**

- **M-1 (Evidence `[SRC]` sai — S1/S2 UNVERIFIED)**:
  - Path i18n sai: `src/lib/i18n/translations/{vi,en}.ts` **không tồn tại**; file thật là `src/lib/utils/translations/{vi,en}.ts`.
  - Key `novelcrafterStudioSubtitle` không tồn tại. Chuỗi "5 tính năng/5 features" nằm ở `novelcrafterMasterGemHint` (vi:1012-1013, en:1002-1003). "5 Tính năng/5 Sudowrite Feature Slots" nằm ở `novelcrafterFeatureSlotsLabel` (vi:1016, en:1007).
  - `storySwitchCoordinator.ts` / `StorySwitchCoordinatorState` không tồn tại. Thật ra là `draftStorage.ts:379-393`, tham số `coordinator?: NovelcrafterSyncCoordinator`.
  - `feedbackParser.ts:81-84` → thật ra ở `:25-28`.
  - `resolveNovelcrafterLayoutTier` → thật ra là `resolveStudioLayout(width)`; điều kiện ở `studioLayout.ts:36` là `width < 1180`, không phải `>=`.
  - `buildChapterContextXml` không tồn tại → logic inline trong `buildNovelcrafterUserPrompt` (`promptBuilder.ts:320-329`).
  - `MAX_STORY_STATE_PAYLOAD_BYTES` không tồn tại → `DEFAULT_MAX_STATE_PAYLOAD_BYTES` / `FALLBACK_TRIM_PAYLOAD_BYTES`.
  - Bước 3.2 liệt kê feature `describe`, `first_draft`, `openings`, nhưng `NOVELCRAFTER_FEATURE_SLOTS` (`types.ts:19-26`) chỉ có `bible, write, rewrite, feedback, expand, brainstorm`.
  - Pre-Work table ghi đã đọc `docs/UI_GUIDELINES.md` và `docs/TECH_DEBT.md`, nhưng cả hai **không tồn tại**.
  - `FeedbackItem` (Bước 4.2) → tên type thật là `NovelcrafterFeedbackItem`.
- **M-2 (Test Contract nhắm vào API không tồn tại — dễ dẫn tới specification gaming hoặc dev tự bịa hành vi)**:
  - TC-02: `acquireStreamSlot`, `MAX_CONCURRENT_STREAMS`, `expire(key, 180)`, `{ status: 429 }` không có thật. Hàm thật là `reserveNovelcrafterStreamQuota`, `INFLIGHT_TTL_SECONDS = 360` (`streamQuotaGuard.server.ts:12`), và khi từ chối thì trả `{ allowed:false, count, limit }`. Câu "khóa vĩnh viễn 429" trong Timeline 3 cũng không đúng với code.
  - TC-01: SSE code `EMPTY_MODEL_OUTPUT` không tồn tại trong runner.
  - TC-05: `buildNovelcrafterPrompt` → thật ra là `buildNovelcrafterUserPrompt`.
  - TC-06/TC-08: field `details` không tồn tại; card dùng `traits` (`types.ts:133-139`). TC-08 còn kỳ vọng `role: "Starfleet Captain"` trong khi header `— Captain` thắng do `if (roleLineMatch && !role)` (`characterParser.ts:46`) → test sẽ fail nếu plan không đổi logic.
  - TC-08/8.1: `splitMultipleOpenings` + `subLabel` → thật ra là `parseThreeOpenings` trả `{ label, content }`.
  - TC-09/8.1: `createStreamRunRegistry`, `promoteStoryId`, `isActiveRun` → thật ra là class `NovelcrafterStreamRunRegistry` với `promotePendingRunStory`, và hàm này cập nhật **vô điều kiện** (`streamRunRegistry.ts:49-54`), trái với kỳ vọng "chỉ khi null".
  - `modelGuards.server.ts` chỉ export `isValidGenerationModel`; không có `isAnthropicModel` / `isUnsupported*`.
  - `novelcrafterStreamStore.ts` không có `startStreamStore` / `appendThinkingChunk` / `appendTokenChunk` / `finishStreamStore`; API thật là `beginStreamRun`, `updateStreamMeta`, `flushStreamSnapshot`, `finishStreamRun`, `resetStreamStore`, `createRafStreamBatcher`.
- **M-3 (TC-01 sanitizeError)**: `[CMD]` probe cho thấy production trả `"Raw SDK secret failure at [stack]"`, không phải `"Failed to generate response"`. Còn môi trường test (`NODE_ENV !== "production"`) thì `sanitizeError` **trả nguyên message** (`errors.ts:153-158`) → assertion "không chứa 10.0.0.1" sẽ fail. **Yêu cầu**: chỉ định rõ cách test, stub `NODE_ENV` hoặc dùng một message generic cố định cho `STREAM_ERROR`.
- **M-4 (Bước 3.3 không compile)**: `serializeStoryBibleWithStructuredCards()` trả `{ charactersText, worldbuildingText, outlineText }` (`storyBibleSerializer.ts:6-10`). Biểu thức `serializedBible[target]` với `target ∈ {synopsis, characters, …}` sẽ lỗi TS. Nếu ép kiểu cho qua thì sẽ ra `undefined.trim()` lúc runtime. **Yêu cầu**: map tường minh `characters→charactersText`, `worldbuilding→worldbuildingText`, `outline→outlineText`, các target khác dùng `storyBible[target]`. Ngoài ra serializer lọc card `visibleToAI === false`, nên cần ghi rõ quyết định cho Rewrite.
- **M-5 (Bước 3.5 regex Openings gây crash)**: `[CMD]` `matchAll` với regex mới (không có cờ `g`) → `TypeError: String.prototype.matchAll called with a non-global RegExp argument`. Regex mới cũng **không còn capture group**, nên `match[1..4]` (`openingsParser.ts:27-28`) mất số thứ tự và subtitle: probe với `gim` trả `[m[1], m[2]] = [undefined, undefined]`. **Yêu cầu**: giữ cờ `g` và các nhóm bắt `(\d+)`/subtitle. (Regex `characterParser` mới đã được probe: `Jean-Luc Picard — Captain` → `["Jean-Luc Picard","Captain"]`, `Spider-Man` → không tách — đạt.)
- **M-6 (BUG-01 thiết kế chưa xác định)**: Bước 4.1 cho phép "ensure trước startRun **hoặc** promote runId an toàn". Timeline reviewer ở trên chứng minh phải có **cả** guard effect. Các điều kiện guard còn phải nêu rõ:
  - So khớp `selectedConversationId` mới với `registry.getTarget(activeRunId).targetStoryId` (hoặc target đang pending), không chỉ kiểm tra `prev === null`.
  - Reset `isEnsuringStoryRef` trong `finally` kể cả khi `ensureStoryConversation()` ném lỗi.
  - Xử lý Escape/Stop trong lúc ensure (cờ cancel).
  - Ghi rõ thay đổi hành vi "abort và chạy lại" (`:159-161`) thành "busy thì bỏ qua".

  Timeline "Trước khi sửa" của plan cũng sai thứ tự: `setIsStreaming(true)` nằm ở `:191`, sau ensure.

- **M-7 (BUG-06 đổi ngữ nghĩa merge feedback)**: Handler kết thúc hiện tại **cố ý** thay thế thẻ `open` và chỉ giữ `resolved` (`useDirectStreamBridge.ts:168-171`). Plan chuyển sang giữ cả `open` cũ → mỗi lần chạy lại Feedback sẽ cộng dồn nhận xét trùng trên cùng quote, không có dedupe. Ngoài ra `.slice(0, 50)` cắt đuôi tùy ý, trong khi `normalizeFeedbackItems` ưu tiên giữ `open` (`stateLimits.ts:95-98`). **Yêu cầu**: chốt ngữ nghĩa (thay thế `open` hay cộng dồn + dedupe theo quote), đưa vào helper thuần trong `lib/` và viết test.
- **M-8 (BUG-03 Redis)**: Xem 2 timeline ở trên.
  - (a) Dùng `expire(key, INFLIGHT_TTL_SECONDS, "NX")`. `[SRC]` `@upstash/redis` v1.36.1 có hỗ trợ `ExpireOption = "NX" | …` (`node_modules/@upstash/redis/zmscore-0SAuWM0q.d.ts:315`), nên tránh được TTL trượt mà vẫn vá được trường hợp TTL = -1.
  - (b) Bỏ `del` không nguyên tử. Thay vào đó dùng `eval` Lua (decr rồi del nếu ≤ 0 trong cùng script), hoặc chỉ clamp. Bỏ guard `typeof redis.del === "function"` vì type `Redis` luôn có `del`.
  - (c) Test phải mock `getRedis()` với `incr` là `vi.fn`, vì `resolveUsableRedis` trả `null` khi `incr` không phải mock (`streamQuotaGuard.server.ts:28-35`).
- **M-9 (DatabaseError khi giải mã thất bại — chưa mô phỏng phía client)**:
  - Khi load lỗi, client chỉ `toast.error` (`useNovelcrafterStory.ts:238-243`) và **không** cập nhật `latestStateRef`. Owner/state của story trước vẫn được giữ, và mutators tiếp tục ghi/lưu theo owner cũ (`useNovelcrafterStateMutators.ts:42-63`) trong khi sidebar đã chọn story mới.
  - Story hỏng sẽ trả 500 vĩnh viễn và không có đường khôi phục.
  - Tiền đề "xóa trắng DB" trong Timeline 4 bị phóng đại: đã có guard stale-version (`storyPersistence.server.ts:154`, state mặc định có `version: 1`) và guard destructive >90% (`:161-181`).
  - **Yêu cầu**: định nghĩa UX client (khóa editor/read-only, không autosave, hiển thị lỗi) và bổ sung test `src/app/api/novelcrafter/state/route.test.ts` cho kỳ vọng 500 + message đã sanitize.

**[MINOR]**

- **m-1**: Lý do Loại C ở `studioLayout` tính sai. Sidebar `lg:pl-20rem` = 320px; ở 1280px: 1280−320−224−320 = **416px**, không phải ~208px (gutter ở chế độ `sheet` khi <1480). Ngưỡng cũng không tính trường hợp sidebar thu gọn (5rem). Nhánh `width >= 1440 ? 256 : 224` (`studioLayout.ts:57-58`) sẽ thành dead code. Test hiện tại (`studioLayout.test.ts:32-36`, 1600px → gutter `docked`) sẽ đổi kỳ vọng; cần liệt kê rõ.
- **m-2**: Toast refusal có thể bị bắn 2 lần: hook không biết bridge đã toast hay chưa. Cần contract rõ, ví dụ `onStreamTerminated` trả `{ handledRefusal: boolean }`.
- **m-3**: `buildConflictBackupCard` dùng serializer sẽ bỏ qua khác biệt ở các card `visibleToAI === false`. Nên so sánh trực tiếp mảng `characterCards/worldElements/outlineItems`.
- **m-4**: Không trừ quota khi chỉ có `thinking` → user có thể trigger rồi abort sau pha thinking để dùng compute miễn phí (concurrency vẫn bị chặn bởi in-flight). Nên ghi nhận là quyết định sản phẩm.
- **m-5**: Lệch số dòng nhỏ: `ChapterFeedbackGutter.tsx` aria-label "More actions" nằm ở `:156`, không phải `:166`. Ngoài ra 9 vị trí `text-[10px]/text-[11px]/py-0.2` mà plan liệt kê đã được `[CMD]` grep xác nhận là đúng và đủ.

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 1 BLOCKER và 9 MAJOR. Việc cần làm cho Revision 2:

1. Sửa toàn bộ path/symbol/line trong S1–S2, Pre-Work, Mục 5–8 theo M-1 (đặc biệt path i18n `src/lib/utils/translations/`).
2. Viết lại Test Contract TC-01, 02, 05, 06, 08, 09 và mục 8.1 theo API thật (M-2, M-3).
3. Sửa Bước 3.3 (mapping serializer) và Bước 3.5 (regex giữ `g` + capture group), kèm test case tương ứng (M-4, M-5).
4. Chốt một thiết kế BUG-01 duy nhất có đủ guard, xử lý ensure-throw/Escape (M-6). Chốt ngữ nghĩa merge feedback (M-7). Tách logic thuần vào `lib/` + test để đóng B-1.
5. Thiết kế lại BUG-03 với `expire NX` + decr/del nguyên tử, kèm chiến lược mock Redis (M-8).
6. Bổ sung luồng client + route test cho `DatabaseError` (M-9).

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-17
- **Đối tượng**: Technical Plan Revision 2 (`round: 2`, `status: Ready for Review`)

#### Baseline đã chạy

- `[CMD]` `npm run type-check` → exit 0.
- `[CMD]` `npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state` → `Test Files 15 passed (15)`, `Tests 71 passed (71)`. Run 1 ghi 14/64, nghĩa là codebase đã thay đổi giữa hai lượt audit.
- `[CMD]` `npx tsx -e` probe `sanitizeError(new Error("Fatal at 10.0.0.1 with GEMINI_API_KEY=secret123"), true)` → `"An error occurred. Please try again later."`.
- `[CMD]` Probe node cho regex mới của Bước 3.3 (kết quả ở mục Kiểm chứng lỗi cũ).
- `[SRC]` `node_modules/@upstash/redis` v1.36.1: `ExpireOption = "NX" | …` (`zmscore-0SAuWM0q.d.ts:315`), `eval(script, keys, args)` (`:2068`). `getRedis()` trả về `Redis | null` (`src/lib/core/batchGenQuota.ts:43`).

#### Kiểm chứng lỗi cũ (so với Run 1)

| Mã       | Trạng thái                       | Ghi chú kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B-1      | **Đã khắc phục một phần**        | Rủi ro 1 và 2 giờ có control là pure helper (`shouldAbortStreamOnConversationChange`, `mergeStreamedFeedbackItems`) đặt trong `lib/` kèm TC-04/TC-10. Phần tích hợp vào hook vẫn chưa có test, nhưng chấp nhận được vì logic quyết định đã được tách ra. Rủi ro 4 vẫn hở, xem N-6.                                                                                                                                                                                                                                                                                       |
| M-1      | **CHƯA khắc phục, còn nặng hơn** | Path i18n và số dòng i18n đã đúng (`vi.ts:1012-1016`, `en.ts:1002-1007` — `[CMD]` grep khớp). Nhưng Revision 2 sinh thêm rất nhiều path/symbol không tồn tại, xem B-2 và N-1.                                                                                                                                                                                                                                                                                                                                                                                            |
| M-2      | **CHƯA khắc phục**               | Test Contract vẫn nhắm vào API không có thật hoặc kỳ vọng sai hành vi, xem N-2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| M-3      | **CHƯA khắc phục**               | Đã chốt `sanitizeError(err, true)` (đúng hướng), nhưng kỳ vọng TC-01 Case 1B sai theo `[CMD]` probe, xem N-2(a).                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M-4      | **Đã khắc phục**                 | Map tường minh `characters→charactersText`… khớp kiểu trả về tại `storyBibleSerializer.ts:6-10`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M-5      | **Đã khắc phục**                 | `[CMD]` probe regex của plan với input TC-08: `["1","Hành động kịch tính",null,null]`, `["2","Đối thoại bí ẩn",null,null]`, `[null,null,"3","Miêu tả nội tâm"]`. Cờ `g` và 4 capture group vẫn giữ nguyên. Regex character: `Spider-Man — Superhero`→`["Spider-Man","Superhero"]`, `Jean-Luc Picard: Starfleet Captain`→`["Jean-Luc Picard","Starfleet Captain"]`, `T-800`→không tách. Đạt.                                                                                                                                                                              |
| M-6      | **Đã khắc phục một phần**        | Đã chốt một thiết kế duy nhất: controller tạo trước `await`, `try/finally` cho `isPromotingStoryRef`, kiểm tra `aborted` sau `await`, effect unmount riêng. Còn lỗi ở nhánh thoát sớm, xem N-4.                                                                                                                                                                                                                                                                                                                                                                          |
| M-7      | **Đã khắc phục**                 | Đã chốt ngữ nghĩa: non-reply thì thay thẻ `open` chưa tương tác; reply thì cộng dồn. Có dedupe và `normalizeFeedbackItems` (`stateLimits.ts:66-98`). Cần thêm `replyToFeedbackId`, vì hiện `onReplyFeedback` (`ChapterEditorWorkspace.tsx:278-291`) không truyền id. Hướng này đúng.                                                                                                                                                                                                                                                                                     |
| M-8      | **Đã khắc phục (thiết kế)**      | `expire NX` + Lua `DECR/DEL` nguyên tử đã có `[SRC]` hỗ trợ (xem Baseline). Riêng TC-02 sai, xem N-2(b).                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| M-9      | **Đã khắc phục một phần**        | Đã định nghĩa luồng client, nhưng code đặc tả không compile, xem N-5. Chưa định nghĩa khóa editor, xem m-B.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| m-1      | N/A                              | Revision 2 bỏ phương án đổi ngưỡng `studioLayout`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| m-2      | Đã đưa vào plan                  | Đặc tả còn sai thứ tự, xem m-C.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| m-3, m-4 | **Đã khắc phục**                 | Có quyết định sản phẩm ở §3.1.3–4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| m-5      | **Đính chính của Run 1**         | Run 1 xác nhận "9 vị trí đúng và đủ" là **sai**. `[CMD]` grep trên `HEAD` hiện cho thấy 9 vị trí `text-[10px]/text-[11px]/py-0.2` nằm ở `ChapterAiToolMenus.tsx:298`, `ChapterEditorWorkspace.tsx:472`, `ChapterFeedbackGutter.tsx:221,225`, `NovelcrafterTopBar.tsx:219` (đây là chỗ có `py-0.2`), `SheetSubToolbar.tsx:94`, `StoryBibleSectionCard.tsx:95`, `StoryBibleStructuredCards.tsx:282`, `StoryBibleWorkspace.tsx:242`. `NovelcrafterLeftNavigator.tsx` và `NovelcrafterHistoryPane.tsx` có 0 vị trí. Chuỗi `"More actions"` không tồn tại ở đâu trong `src/`. |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả                 | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **FAIL**                | `[CMD]` type-check baseline exit 0, không thêm dependency. Nhưng §4.2 S1 ghi "đối chiếu 1-1 với codebase", trong khi `[CMD]` `find`/`ls` cho thấy 2 thư mục layer, 1 module import và 2 component trong §5 **không tồn tại** (B-2). Nhiều đoạn code đặc tả sẽ lỗi TS (N-1, N-5). Bằng chứng S1 của plan → `UNVERIFIED`.                                                                                                                                                         |
| **S2 Lifecycle & Teardown**  | **FAIL**                | `[SRC]` `useNovelcrafterStream.ts:128-135` (cleanup theo `selectedConversationId`), `:163-191`, `:332-338`. Thiết kế guard đúng (xem timeline 3). Nhưng nhánh thoát sớm gọi `setIsStreaming(false)` vô điều kiện sẽ làm sai trạng thái của run mới (N-4). `activeRunContextRef` không tồn tại trong `useDirectStreamBridge.ts` (N-1).                                                                                                                                           |
| **S3 Database & Temporal**   | **FAIL**                | Thiết kế Redis đạt (`[SRC]` ở Baseline, timeline 3A–3C hợp lệ). Không có migration/RLS mới. Nhưng TC-02/TC-03 mô tả sai hành vi thật (N-2): không có `MAX_CONCURRENT_STREAMS`; `getStoryState` trả `createDefaultStoryState()` chứ không trả `null` (`storyPersistence.server.ts:114-116`); tùy chọn thật là `allowDestructive` và mã lỗi là `DESTRUCTIVE_SAVE_REJECTED` (409) (`:143,162-171`); bảng thật là `messages` (`:97`), không phải `novelcrafter_story_states`.       |
| **S4 Cross-Task State Flow** | **FAIL**                | `[SRC]` `NovelcrafterStudioApp.tsx:76-81`: bridge nhận `story.selectedConversationId`, stream nhận `story.validStoryId` → đổi sang `validStoryId` là đúng. Nhưng: `FALLBACK_TRIM_PAYLOAD_BYTES = 2_800_000` vượt cap 2 MiB của route (N-3); client fallback không compile (N-5); `coordinator.isSwitchPending()` không tồn tại (N-1).                                                                                                                                           |
| **S5 Security Boundary**     | **PASS (có điều kiện)** | Không đụng auth, `service_role` hay RLS. Ép `sanitizeError(err, true)` là đúng (`[SRC]` `src/lib/utils/errors.ts:148-230`). Điều kiện: sửa import path (`@/lib/utils/errors`, không phải `@/lib/core/errors`) và sửa kỳ vọng TC-01B (N-2a).                                                                                                                                                                                                                                     |
| **S6 External Resilience**   | **UNVERIFIED**          | Bug trừ quota khi chỉ có thinking là có thật: `[SRC]` `novelcrafterStreamRunner.server.ts:410-419` — `emitModelOutput` gọi `onFirstModelOutput` cho **cả** `"thinking"` lẫn `"token"`. Nhưng Bước 1.1 mô tả sửa ở "vòng lặp `#L436-L462`" với `markFirstModelOutput`/`chunk.type`, và các thứ này không tồn tại. `emittedTokenChunks` là biến cục bộ của từng provider (`:240-258`). Điểm sửa đúng là gate `type === "token"` trong `emitModelOutput`. Không đổi `maxDuration`. |

#### Adversarial Timelines bổ sung (reviewer)

```
Cơ chế: Fallback trim payload (Bước 3.4, FALLBACK_TRIM_PAYLOAD_BYTES = 2_800_000)
T1: Story lớn, save chính bị từ chối → useStoryPersistenceLifecycle.ts:172 gọi enforceStatePayloadBudget(state, 2_800_000)
T2: State được trim xuống còn ~2.6MB (vẫn "fits" theo budget mới) → PUT /api/novelcrafter/state
T3: state/route.ts:121 — byteLength > MAX_STATE_BODY_BYTES (2 * 1024 * 1024 = 2,097,152) → từ chối
Kết cục: Đường fallback vốn đang hoạt động (1_500_000 < 2 MiB) bị phá; save fallback luôn fail với state > 2 MiB → LỖI (MAJOR, N-3)
```

```
Cơ chế: Nhánh thoát sớm sau await ensureStoryConversation (Bước 2.3.6)
T1: Run A: startRun → setIsStreaming(true) → await ensure…
T2: Cùng tick (prop isStreaming của workspace chưa re-render), user bấm tool khác → triggerStream B: abort controller A, endRun(A), startRun(B), setIsStreaming(true), fetch B
T3: ensure A resolve → controller A đã aborted → nhánh thoát sớm gọi setIsStreaming(false) vô điều kiện
Kết cục: Stream B vẫn chạy nhưng UI ghi isStreaming=false → listener Escape (:137-154) bị gỡ, guard `if (isStreaming) return` mất tác dụng → LỖI (MAJOR, N-4)
```

```
Cơ chế: Promote null → newId (shouldAbortStreamOnConversationChange)
T1: triggerStream: startRun(target=null), isPromotingStoryRef=true, await ensure → selectConversation(newId) (setState, default lane)
T2: Promise resolve → continuation (microtask) chạy trước khi React commit → finally đặt isPromotingStoryRef=false, rồi promotePendingRunStory(runId,newId)
T3: React commit → effect: prev=null, next=newId, isPromoting=false, activeTarget=newId → điều kiện `activeTargetStoryId === nextStoryId` → false
Kết cục: Không abort → AN TOÀN. Nhánh OR của helper cover được cả hai thứ tự commit.
```

Trục serverless: Redis in-flight counter là state chia sẻ giữa các instance; Lua `eval` chạy nguyên tử phía Redis → AN TOÀN. Fallback in-memory `localInFlightCounts` chỉ chạy ngoài production (`streamQuotaGuard.server.ts:59-62`) → AN TOÀN.

#### Phân loại lỗi

**[BLOCKER]**

- **B-2 (Plan không khớp codebase, sai layer boundary, bằng chứng S1 giả)**. Nếu làm theo §5–§6, developer sẽ tạo file mới ở các layer không tồn tại hoặc import module không có:
  - `src/hooks/novelcrafter/*` và `src/components/novelcrafter/*` **không tồn tại**. Path thật là `src/app/features/novelcrafter/hooks/` và `src/app/features/novelcrafter/components/` (`[CMD]` `find`). Sai ở 11/25 mục `[MODIFY]` và ở §2, §3.2, §4.2, §9.
  - `StoryBibleDrawer.tsx` và `NovelcrafterRightInspector.tsx` **không tồn tại** ở đâu trong `src/` (`[CMD]` grep rỗng). Đây là mục 20 và 21.
  - `@/lib/core/errors` **không tồn tại**. `sanitizeError` và `DatabaseError` nằm ở `src/lib/utils/errors.ts:114,148`. Sai ở Bước 1.1, 1.3, §3.1.2 và S5.
  - `[NEW] storyBibleSerializer.test.ts` **đã tồn tại** (107 dòng). Nếu "tạo mới" sẽ ghi đè coverage hiện có. Phải đổi thành `[MODIFY]`.
  - Pre-Work: `docs/API_REFERENCE.md` và `docs/TESTING.md` **không tồn tại**.
  - **Yêu cầu**: rà lại toàn bộ §2–§9 bằng `find`/`grep` thật trên `HEAD` hiện tại, rồi cập nhật bảng S1 với `[CMD]` thật.

**[MAJOR]**

- **N-1 (Symbol/line không tồn tại — khiến đặc tả không thực thi được)**:
  - `novelcrafterStreamRunner.server.ts`: không có `markFirstModelOutput`, không có vòng lặp `chunk.type` ở `#L436-462`. Điểm sửa thật là `emitModelOutput` (`:410-419`) và catch (`:493-503`, biến `rawMsg`).
  - `streamQuotaGuard.server.ts`: không có `MAX_CONCURRENT_STREAMS`. Chỉ có một nhánh từ chối duy nhất là `effectiveCount > dailyCheck.limit` (`:136-143`). `#L167` là `releaseReservation`, `#L175` là rollback trong catch; không có "nhánh vượt dailyLimit" riêng.
  - `featureDirectives.ts`: không có `buildRewriteDirective` và không có `input.Extra_Instructions`. Chỉ có `buildBibleDirective` (`:76`), `buildFeedbackDirective` (`:135`), `buildFeatureDirective` (`:199`). Cần chỉ rõ nhánh rewrite thật và field thật (`chapterExtraInstructions`?).
  - `promptBuilder.ts`: không có `MAX_CHAPTER_PROSE_CHARS`, `<previous_chapter_full_text>` hay câu "included in FULL". Prose dùng `.slice(-MAX_CHAPTER_CONTEXT_CHARS)` trong `<preceding_prose>` (`:330-334`). Bước 3.1 và TC-05 phải viết lại theo code thật, hoặc bỏ nếu bug không còn.
  - `characterParser.ts`: hàm thật là `parseCharacterCardsFromMarkdown(markdown, existingCount)` (`:8`), không phải `parseCharactersTextToCards`. Không có `split(/\s*[-–—:]\s*/)`; regex cần đổi là `dashMatch` (`:35`).
  - `storyBibleSerializer.ts` chỉ export `serializeStoryBibleWithStructuredCards`, không có `serializeCharacterCardsToText` / `serializeWorldElementsToText` / `serializeOutlineItemsToText` (§8.1.3).
  - `createRafStreamBatcher` trả `{ scheduleUpdate, flushNow, cancel }` (`novelcrafterStreamStore.ts:79-129`), không có `push`/`flush` (TC-09). `TEXT_GENERATION_MODEL_IDS` không tồn tại; `isValidGenerationModel` dựa vào `isSelectableModelId`/`normalizeModelForApi` (`modelGuards.server.ts:7-17`).
  - `useDirectStreamBridge.ts` không có `activeRunContextRef`, và refusal dùng `toast.error` (`:200-202`), không phải `toast.warning`.
  - `NovelcrafterSyncCoordinator` không có `isSwitchPending()` (`storySyncCoordinator.ts:103-194`; chỉ có `isCreatingStory`, `isCandidateNewStoryId`, …). Ngoài ra lời gọi duy nhất là `resolveValidNovelcrafterStoryId(selectedConversationId, stories)` (`useNovelcrafterStory.ts:69`), **không truyền** `coordinator`, nên sửa trong hàm sẽ không có tác dụng.
  - `ChapterEditorWorkspace.tsx`: chỉ có `handleRunRewrite` (`:238`). 6 handler còn lại (`handleRunExpand`, `handleGenerateThreeOpenings`, `handleAnalyzeFeedback`, `handleDescribeSensory`, `handleFirstDraftScene`, `handleBrainstormDirections`) **không tồn tại** ở đâu trong `src/`.
  - `buildConflictBackupCard` ở `draftStorage.ts:187-217`, không phải `:316-327`.
  - `aside` của LeftNavigator/HistoryPane/FeedbackGutter đã là `w-full md:w-64…` / `w-full md:w-80…` / `w-full lg:w-80…` (`:95`, `:61`, `:100`). Không có `w-56` hay `py-0.2` trong các file này. `ChapterFeedbackGutter` render trong `ChapterEditorWorkspace.tsx:258`, không nằm trong `<SheetContent>` của StudioApp (`NovelcrafterStudioApp.tsx:282,315`).
- **N-2 (Test Contract sai hành vi thật — test sẽ fail, hoặc dev phải sửa code cho khớp test)**:
  - (a) TC-01 Case 1B: `[CMD]` probe cho kết quả `"An error occurred. Please try again later."`, **không** chứa `"[ip]"` hay `"[REDACTED]"`. Phải đổi assertion thành "không chứa `10.0.0.1`/`secret123`".
  - (b) TC-02: Lần 3 dựa vào `MAX_CONCURRENT_STREAMS = 2` vốn không tồn tại. Với mock `checkDailyMessageLimit` hiện có (`count: 9, limit: 10`, `streamQuotaGuard.server.test.ts:9-14`), **lần 2** đã bị từ chối. Phải chỉ định mock `count/limit` cụ thể cho từng lần gọi.
  - (c) TC-03: kỳ vọng `null`/`state: null`, `confirmDestructiveSave`, `DESTRUCTIVE_SAVE_CONFIRMATION_REQUIRED` không khớp code (xem S3).
  - (d) TC-07: kỳ vọng `traits: "Nhanh nhẹn"` từ dòng `- Đặc điểm: Nhanh nhẹn`, nhưng code gán `traits = body` (`characterParser.ts:45`) và chỉ nhận `**Role**:` dạng in đậm (`:44`). §8.1.1 còn yêu cầu parse `- Vai trò:`/`- Tính cách:` và "bảo toàn `id`/`visibleToAI` từ `existingCards`", là những tính năng **không có** trong code và không có bước nào trong §6 thực hiện. Đây chính là rủi ro specification gaming.
  - (e) TC-08: kỳ vọng label `"Opening 1 — Hành động kịch tính"`, nhưng code tạo `` `Opening ${num}: ${subtitle}` `` (`openingsParser.ts:32`). Fallback khi `< 2` match trả **1** phần tử (`:17-19`), không phải "tách 3 đoạn".
  - (f) TC-01 (runner) và TC-03 (persistence) **không có file test nào trong §5** được giao. `novelcrafterStreamRunner.server.test.ts` và `storyPersistence.server.test.ts` phải được thêm vào danh sách `[MODIFY]`.
- **N-3 (Bước 3.4 — `FALLBACK_TRIM_PAYLOAD_BYTES` gây hồi quy)**: Giá trị hiện tại là `1_500_000` (`useStoryPersistenceLifecycle.ts:35`), không phải `900_000`. `DEFAULT_MAX_STATE_PAYLOAD_BYTES` là `1_800_000` (`draftStorage.ts:22`), không phải 3.5MB. Nâng lên `2_800_000` sẽ vượt cap `MAX_STATE_BODY_BYTES = 2 MiB` (`state/route.ts:23,121`), xem timeline ở trên. **Yêu cầu**: bỏ bước này, hoặc giữ giá trị `< DEFAULT_MAX_STATE_PAYLOAD_BYTES`.
- **N-4 (Bước 2.3.6 — nhánh thoát sớm)**: `setIsStreaming(false)` / `finishStreamRun(runId)` phải được bảo vệ bằng cùng điều kiện như `finally` (`registry.getActiveRunId() === runId || !registry.isBusy()`), xem timeline.
- **N-5 (Đặc tả client của Bước 1.3 không compile)**:
  - `readLocalStoryDraft` trả `NovelcrafterLocalDraftEnvelope | null` (`draftStorage.ts:112-115`), nên `readLocalStoryDraft(...) ?? createDefaultStoryState(...)` sẽ lệch kiểu. Phải dùng `.state`.
  - `saveTimerRef` và `selectedStoryTitle` không tồn tại trong `useNovelcrafterStory.ts`. Hook đã có sẵn `cancelPendingSaveTimers()` (đang nằm trong deps của effect), và tiêu đề mặc định lấy từ `t("novelcrafterDefaultChapterTitle")`.
- **N-6 (Risk Table 4.5.4 — Rủi ro 4 mức Trung bình)**: Control là thay đổi client trong hook, nhưng bằng chứng lại trỏ tới `storyPersistence.server.test.ts` (không có trong §5) và route test (chỉ phủ phía server). Không có test nào chứng minh `latestStateRef.ownerStoryId` được đổi sang `validStoryId`. **Yêu cầu**: tách logic dựng fallback thành pure helper trong `src/lib/features/novelcrafter/` kèm test, hoặc bổ sung test `renderHook`.

**[MINOR]**

- **m-A**: `decrementInFlightKey` có nhánh fallback `decr` "nếu mock chưa khai báo `eval`". Đây là nhánh chỉ phục vụ test nằm trong production code, vì kiểu `Redis` luôn có `eval`. Nên mock `eval` trong test và bỏ fallback này.
- **m-B**: Sau khi load lỗi, plan không khóa editor. User gõ tiếp sẽ autosave state mặc định (`version: 1`), và guard stale (`storyPersistence.server.ts:154`) sẽ từ chối liên tục. Nên chặn autosave hoặc chuyển sang read-only cho story đó, kèm banner lỗi.
- **m-C**: Trong hook, `toast.error` ở catch (`useNovelcrafterStream.ts:330`) chạy **trước** `onStreamTerminated` ở `finally` (`:343-355`). Vì vậy `handledRefusal` không thể chặn toast đó nếu không đổi thứ tự. Cần nêu rõ thứ tự mới.
- **m-D**: `shouldAbortStreamOnConversationChange` trả `false` khi `activeTargetStoryId === null`. Nếu user chọn một story **khác** có sẵn trong lúc story mới đang được tạo, stream sẽ không bị hủy. Edge case hiếm; nên ghi nhận hoặc bỏ nhánh `=== null`.
- **m-E**: `saveStoryState` dùng `existingRow.content.length` (độ dài ciphertext, lớn hơn plaintext) làm `previousChars`. Cách này bảo thủ, chấp nhận được, nhưng nên comment rõ chủ đích.

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 1 BLOCKER (B-2) và 6 MAJOR (N-1 → N-6). Phần thiết kế cốt lõi (Redis NX + Lua, guard promote, merge feedback, map serializer, regex) đã đạt. Vấn đề chính là Revision 2 được viết dựa trên một snapshot codebase không khớp với `HEAD` hiện tại. Việc cần làm cho Revision 3:

1. Sửa toàn bộ path sang `src/app/features/novelcrafter/{hooks,components}/` và `@/lib/utils/errors`. Bỏ `StoryBibleDrawer`/`NovelcrafterRightInspector`. Đổi `storyBibleSerializer.test.ts` sang `[MODIFY]`. Sửa bảng Pre-Work (B-2).
2. Đối chiếu lại từng symbol và số dòng trong §5–§8 với code thật (N-1). Với các hạng mục mà bug không còn trong code (promptBuilder "FULL", 6 handler, `w-56`, `"More actions"`), ghi rõ là "đã không còn / loại khỏi phạm vi" thay vì để developer tự bịa.
3. Viết lại TC-01B, TC-02, TC-03, TC-07, TC-08 và §8.1.1 theo hành vi thật, đồng thời giao file test cho TC-01 và TC-03 (N-2).
4. Bỏ hoặc sửa giá trị `FALLBACK_TRIM_PAYLOAD_BYTES` (N-3). Bảo vệ nhánh thoát sớm (N-4). Sửa đặc tả client cho compile được (N-5). Bổ sung test cho control của Rủi ro 4 (N-6).

### Audit Run 3

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-17
- **Đối tượng**: Technical Plan Revision 3 (`round: 3`, `status: Ready for Review`)

#### Baseline đã chạy

- `[CMD]` `npm run type-check` → exit 0.
- `[CMD]` `npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state` → `Test Files 15 passed (15)`, `Tests 71 passed (71)`. Khớp với số liệu S1 trong plan. `HEAD` = `67a6500`, không có thay đổi source nào chưa commit.
- `[CMD]` `npx tsx` probe `sanitizeError(…, true)`:
  - `"Fatal at 10.0.0.1 with GEMINI_API_KEY=secret123"` → `"An error occurred. Please try again later."`. Khớp TC-01 Case 1B.
  - `"Model gemini-2.5-flash returned an empty response (reason: STOP)…"` → giữ nguyên. Vì vậy TC-01 Case 1A (`message` chứa `"returned an empty response"`) vẫn đạt sau khi bọc `sanitizeError`.
- `[CMD]` Probe node cho regex của Bước 3.3:
  - TC-08 input → `[{"label":"Opening 1: Hành động kịch tính","content":"Nội dung 1"},{"label":"Opening 2: Đối thoại bí ẩn",…},{"label":"Opening 3: Miêu tả nội tâm",…}]`. Khớp 100%.
  - Định dạng do `featureDirectives.ts:226-231` sinh ra (`=== OPENING 1: Action/Conflict Hook ===`) vẫn parse đúng.
  - Input `< 2` delimiter → fallback 1 phần tử.
  - Regex character: `Spider-Man — Superhero` → `["Spider-Man","Superhero"]`; `Jean-Luc Picard: Starfleet Captain` → `["Jean-Luc Picard","Starfleet Captain"]`; `T-800` → `null`.
- `[CMD]` `grep` 9 vị trí `text-[10px]|text-[11px]|py-0.2` trong `src/app/features/novelcrafter/` khớp đúng danh sách ở Bước 3.5. i18n `vi.ts:1012-1016` và `en.ts:1002-1007` khớp.
- `[CMD]` `npx eslint --print-config …/useNovelcrafterStream.ts`: `no-explicit-any` = 2 và `no-console` = 2. Không có rule `react-hooks/set-state-in-effect`, nên `setIsStreaming(false)` trong effect body không làm gãy lint.

#### Kiểm chứng lỗi cũ (so với Run 2)

| Mã  | Trạng thái                                     | Ghi chú kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-2 | **Đã khắc phục**                               | Toàn bộ path đã đúng `src/app/features/novelcrafter/{hooks,components}/` và `@/lib/utils/errors` (`errors.ts:114,148`). Đã bỏ `StoryBibleDrawer`/`NovelcrafterRightInspector`. `storyBibleSerializer.test.ts` đã chuyển sang `[MODIFY]`. Còn sót 1 tài liệu Pre-Work không tồn tại, xem m-1 (MINOR).                                                                                                                                                                                                                                                                                                                                                                                           |
| N-1 | **Đã khắc phục**                               | `[SRC]` đối chiếu từng symbol/line: `emitModelOutput` `:410-421`; catch `:503-513`; `streamQuotaGuard` `:125-128/137/167/175`; `getStoryState :109`, `saveStoryState :134`, `:116-127`, `:164-172`; `buildBibleDirective :94-95`; `buildFeatureDirective :199`; `dashMatch :35`; `OPENING_DELIMITERS :9-10`, `:28`; `buildConflictBackupCard :187-222`; `resolveValidNovelcrafterStoryId(…, coordinator?)` `draftStorage.ts:379-383`; `useNovelcrafterStory.ts:69, :238-243`; `useStoryPersistenceLifecycle.ts:35, :172`; `NovelcrafterStudioApp.tsx:77`; 7 handler của `ChapterEditorWorkspace.tsx` `:230/238/279/318/323/337/349`. Đều đúng. Đã ghi rõ các hạng mục không còn bug ở §1 NOTE. |
| N-2 | **Đã khắc phục**                               | (a) TC-01B khớp probe. (b) TC-02 với `count:8, limit:10`: lần 1/2/3 → `effectiveCount` 9/10/11, lần 3 trả `count = max(8, 10) = 10` (`:140`). Khớp. (c) TC-03A dùng `DatabaseError` (`code DATABASE_ERROR`, 500) và `DESTRUCTIVE_SAVE_REJECTED` 409. Route `formatErrorResponse` (`state/route.ts:58-67`) trả `{ error: { code } }`. Khớp. (d) TC-07 khớp `roleLineMatch` (`characterParser.ts:44`, chấp nhận `**Vai trò**`). (e) TC-08 khớp probe. (f) Runner và persistence test đã có trong §5 (mục 26, 28).                                                                                                                                                                                |
| N-3 | **Đã khắc phục**                               | Giữ `1_500_000` (< `1_800_000` < 2 MiB). Chỉ đổi nguồn state sang `latestStateRef` khi cùng owner.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| N-4 | **Đã khắc phục**                               | Nhánh thoát sớm và `finally` cùng dùng guard `wasCurrentRun \|\| !registry.isBusy()`. Xem timeline T-B bên dưới.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| N-5 | **Đã khắc phục**                               | `localEnvelope ? localEnvelope.state : createDefaultStoryState(…)` khớp kiểu `NovelcrafterLocalDraftEnvelope \| null` (`draftStorage.ts:112-115`). Dùng `cancelPendingSaveTimers` có sẵn (`useNovelcrafterStory.ts:115`). Kiểu trả về gán được cho `StoryScopedState` (`streamTargetGuard.ts:15-18`).                                                                                                                                                                                                                                                                                                                                                                                          |
| N-6 | **Đã khắc phục**                               | `resolveStoryLoadFailureState` là pure helper trong `lib/`, có TC-03B.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| m-A | **Đã khắc phục**                               | Không còn fallback `decr` trong production code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| m-B | **CHƯA khắc phục, nay thành mâu thuẫn nội bộ** | Xem **P-1** (MAJOR).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| m-C | **Đã khắc phục**                               | `pendingErrorToast` được hoãn tới sau `onStreamTerminated`. `handleStreamTerminated` được truyền thẳng (`NovelcrafterStudioApp.tsx:97`), nên giá trị trả về `{ handledRefusal }` tới được hook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| m-D | **Đã ghi nhận**                                | Đã bỏ nhánh `=== null`. Vẫn còn trường hợp hiếm: user chọn story khác trong lúc `isPromoting === true` thì stream không bị hủy. Bridge đã chặn theo `ownerStoryId` (`useDirectStreamBridge.ts:131,181`), nên chấp nhận.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| m-E | **Đã khắc phục**                               | Có comment chủ đích cho `previousChars` theo độ dài ciphertext.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **PASS** | `[CMD]` type-check exit 0, test 15/71 pass. Không thêm dependency, không có biến `.env` mới. Mọi `[MODIFY]` đều tồn tại (`[CMD]` `ls`/`grep`). 6 file `[NEW]` test chưa tồn tại (`[CMD]` `ls src/lib/features/novelcrafter/`), không đè lên coverage cũ. `createDefaultStoryState` import được vào `draftStorage.ts` từ `./types` (`types.ts:357`), không tạo vòng import. `feedbackParser` → `stateLimits` → `@/lib/core/modelRegistry` là module client-safe (`stateLimits` đã được dùng ở client trong `NovelcrafterHistoryCardItem.tsx`).                                                |
| **S2 Lifecycle & Teardown**  | **PASS** | `[SRC]` `useNovelcrafterStream.ts:128-135` (cleanup cũ), `:156-205`, `:321-378`. `[SRC]` `useConversation.ts:407-414`: `createConversation` gọi `upsertConversation` + `setActiveId` rồi mới `await mutate()`. Vì vậy React commit `validStoryId = newId` **trong lúc** `isPromotingStoryRef === true` (timeline T-A). Escape trong lúc ensure: `setIsStreaming(true)` đã chạy trước `await` → listener `:137-154` đã gắn → `stopStream()` hoạt động. `[SRC]` `useConversation.ts:416-420`: `createConversation` tự `catch` và trả `null` → đi vào nhánh thoát sớm. Có unmount effect riêng. |
| **S3 Database & Temporal**   | **PASS** | Không có migration/RLS mới. Bảng thật là `messages` (`storyPersistence.server.ts:82-86`). Redis: timeline T-C. `[SRC]` `@upstash/redis` `ExpireOption "NX"` và `eval(script, keys, args)` (đã xác minh ở Run 2). `resolveUsableRedis` (`streamQuotaGuard.server.ts:28-35`) chấp nhận mock `vi.fn()` vì có thuộc tính `mock`, nên TC-02 không bị bỏ qua. Lưu ý: §4.2 S3/S4 của plan dùng nhãn `[SRC]` cho code **dự kiến** chưa tồn tại, xem m-2.                                                                                                                                             |
| **S4 Cross-Task State Flow** | **FAIL** | `[SRC]` `NovelcrafterStudioApp.tsx:76-98`: đổi bridge sang `validStoryId` là an toàn (timeline T-A). Nhưng §4.2 S4 của plan khẳng định "khóa editor (`readOnly`) để ngăn autosave ghi đè". Control này **không có bước thực thi** nào trong §6, và không có test. Khi không khóa, client rơi vào vòng lặp lỗi save/GET trên story hỏng (timeline T-D). Xem **P-1**.                                                                                                                                                                                                                          |
| **S5 Security Boundary**     | **PASS** | Không đụng auth (`requireAuthenticatedEmail`, `state/route.ts:84`), `service_role` hay RLS. Rate limit giữ nguyên (`:86-89`). `[CMD]` probe: `sanitizeError(err, true)` loại bỏ IP và secret. Ghi chú log nội bộ: xem m-5.                                                                                                                                                                                                                                                                                                                                                                   |
| **S6 External Resilience**   | **PASS** | `[SRC]` `novelcrafterStreamRunner.server.ts:237-256`: part `thought: true` → `emitModelOutput("thinking")`. Khi không có token thì ném `"…returned an empty response"`. Gate `type === "token"` tại `:412` phủ cả 3 provider. `maxDuration` không đổi. TTL in-flight 360s > `maxDuration` 300s nên không hết hạn giữa stream. Quyết định sản phẩm "chỉ thinking thì không trừ quota" đã ghi ở §3.1.3.                                                                                                                                                                                        |

#### Adversarial Timelines bổ sung (reviewer)

```
T-A — Cơ chế: Promote null → newId qua cả stream hook và bridge (validStoryId)
T1: triggerStream: startRun(target=null), setIsStreaming(true), isPromoting=true, await ensureActiveStory()
T2: createConversation: onBeforeActivate(bindState) → upsertConversation + setActiveId(newId) → await mutate() (network)
T3: React commit trong lúc chờ mutate: validStoryId = newId (đã có trong stories)
    → stream effect: prev=null, next=newId, isPromoting=true → không abort
    → bridge effect (:60-65): directStreamTargetRef = null (lúc này vẫn null vì onStreamStarted chưa chạy)
T4: ensure resolve → promote(runId,newId) → finally isPromoting=false → onStreamStarted gán target
Kết cục: Không abort, target direct-prose được gán sau reset → AN TOÀN
```

```
T-B — Cơ chế: Run B chen vào khi Run A đang await ensure (StoryBibleWorkspace không có guard isStreaming)
T1: Run A: startRun(A), setIsStreaming(true), await ensure | T2: StoryBibleWorkspace.tsx:120 gọi triggerStream B → abort(A), endRun(A), startRun(B), setIsStreaming(true)
T3: A resolve → aborted → wasCurrent=false, isBusy()=true → không gọi setIsStreaming(false)
Kết cục: Trạng thái của B được bảo toàn → AN TOÀN
```

```
T-C — Cơ chế: Redis in-flight Lua DECR/DEL + expire NX (đồng thời)
T1: A reserve incr→1, expire 360 | T2: B reserve incr→2, expire NX (no-op, TTL đang đếm) | T3: A release eval → DECR→1 (không DEL)
T4: B release eval → DECR→0 → DEL nguyên tử | T5: C reserve incr→1 → expire 360
Kết cục: Không mất reservation, không có TTL trượt → AN TOÀN
Trục serverless: counter nằm trên Redis dùng chung; fallback in-memory chỉ chạy khi không phải production (:59-62) → AN TOÀN
```

```
T-D — Cơ chế: Load story hỏng → fallback client → autosave (nếu làm theo đúng checklist Bước 1.3, không có khóa)
T1: GET /state → getStoryState ném DatabaseError → 500 → loadAndReconcileStoryState throw → catch: latestStateRef = {owner: S, state: fallback(version 1 hoặc version của draft)}
T2: User gõ → scheduleSave → PUT: sanitized.version (1) < meta.version (≥2) → ValidationError STALE (storyPersistence.server.ts:154)
T3: putStoryStateOnServer → { status: "conflict" } (useNovelcrafterCatalog.ts:189) → runConflictRecovery → fetchRemoteStoryState → GET 500 → throw
T4: "Conflict recovery failed" → setSaveStatus("error") (useStoryPersistenceLifecycle.ts:233-236)
Kết cục: Mỗi lần gõ phím sinh 1 PUT 400 + 1 GET 500, user không có đường khôi phục → LỖI (MAJOR, P-1)
```

#### Phân loại lỗi

**[BLOCKER]**

- Không có.

**[MAJOR]**

- **P-1 (Control khóa editor khi load lỗi được khẳng định nhưng không có trong checklist — mâu thuẫn nội bộ, sót edge case)**:
  - Plan mô tả khóa editor ở 3 nơi, với 3 tên gọi khác nhau:
    - §4.2 S4: "khóa editor (`readOnly`)".
    - §5.1 mục 13: "quản lý cờ `hasLoadError`".
    - Timeline 4 T3: "đánh dấu `loadErrorStoryId` để `ChapterEditorWorkspace` khóa `readOnly`".
  - Nhưng **Bước 1.3** (checklist thực thi) chỉ có 3 việc: cancel timers, gọi helper, `setSaveStatus("error")`. Không có bước nào làm những việc sau:
    - (a) expose cờ lỗi từ `useNovelcrafterStory`;
    - (b) truyền prop qua `NovelcrafterStudioApp.tsx` → `ChapterEditorWorkspace.tsx`. Hiện component chỉ có `readOnly={isDirectStreamingToChapter}` tại `:513`. §5.1 mục 15–16 cũng không liệt kê thay đổi này;
    - (c) chặn `scheduleSave`/`executeCoordinatorSave` cho story lỗi trong `useStoryPersistenceLifecycle.ts`;
    - (d) gỡ khóa khi load lại thành công.
  - Không có test nào cho control này.
  - Nếu làm theo checklist, hệ thống rơi vào vòng lặp ở timeline T-D. Nếu làm theo Timeline 4, story hỏng bị khóa vĩnh viễn, vì "khóa cho tới khi tải lại thành công" sẽ không bao giờ thành công khi ciphertext hỏng cố định. Plan không định nghĩa đường khôi phục.
  - **Yêu cầu**: chốt **một** phương án và đưa vào §5.1 + §6.
    - **Phương án khuyến nghị**: thêm `loadErrorStoryId` vào `useNovelcrafterStory`, truyền `readOnly` vào `ChapterEditorWorkspace`, và guard `scheduleSave` khi `storyId === loadErrorStoryId`. Thêm một hành động khôi phục rõ ràng: "Khôi phục từ bản nháp local / bắt đầu lại", gọi save với `allowDestructive: true` và seed `coordinator.seedServerMeta` để vượt stale guard. Hoặc tối thiểu ghi rõ là "chỉ đọc, liên hệ hỗ trợ".
    - Hoặc **bỏ hẳn** tuyên bố khóa khỏi §4.2/§5.1/Timeline 4, rồi ghi nhận timeline T-D là rủi ro chấp nhận.
    - Dù chọn phương án nào cũng cần một test. Có thể tách guard thành pure helper (ví dụ `shouldBlockAutosaveForStory(storyId, loadErrorStoryId)`) trong `lib/`, hoặc thêm test cho `resolveStoryLoadFailureState`/guard tương ứng.

**[MINOR]**

- **m-1**: Bảng Pre-Work (§2) trỏ tới `.agents/rules/03-security.md`, nhưng file này **không tồn tại** (`[CMD]` `ls .agents/rules/` → `00-core, 01-coding, 02-quality, 03-ui, 04-bilingual, 05-plan-review`). Nên đổi sang `.agents/skills/api-patterns.md` hoặc `docs/security.md`.
- **m-2**: §4.2 S3/S4 dùng nhãn `[SRC]` cho code **sẽ viết** (ví dụ "`streamQuotaGuard.server.ts:125-179`: Dùng `expire(…,"NX")`…", "`useNovelcrafterStory.ts:238-243`: … khóa editor"). Theo evidence-bar, đây là diễn giải plan, không phải evidence. Nên ghi rõ là "Thiết kế sau sửa".
- **m-3**: Các con số đếm lệch nhau: §1 NOTE ghi "cập nhật 6 file test hiện có", tiêu đề §5.1 ghi "28 files", nhưng danh sách thực tế có 33 mục, trong đó 8 file test `[MODIFY]` (Nhóm D cũng ghi 8).
- **m-4**: TC-06 kiểm thử `buildFeatureDirective` (`featureDirectives.ts`) nhưng đặt trong `promptBuilder.test.ts`. Trong khi đó `featureDirectives.test.ts` đã tồn tại (`[CMD]` grep: `describe("featureDirectives …")`). Theo quy tắc co-located, nên đặt vào `featureDirectives.test.ts`. Ngoài ra, nhánh `write` có 5 sub-mode (`first_draft_rough`, `openings_3`, `tone_shift`, `guided`, default; `featureDirectives.ts:208-266`). Plan chưa nêu chèn `chapterExtra` vào sub-mode nào, và TC-06 chỉ phủ `rewrite`.
- **m-5**: Bước 1.1 ghi "Giữ log nội bộ `streamLogger.error(…, err)`", nhưng code hiện tại log `rawMsg` (`:505`), không log `err`. Đổi sang log nguyên object lỗi SDK sẽ là một thay đổi, không phải "giữ", trong khi `logger` không có cơ chế redact (`[CMD]` grep `redact|REDACTED` trong `src/lib/utils/logger.ts` rỗng). Nên tiếp tục log `rawMsg`.
- **m-6**: Regex `dashMatch` mới yêu cầu khoảng trắng hai bên dấu gạch. Header kiểu `Linh—Kiếm khách` (em-dash liền, `[CMD]` probe → `null`) sẽ không còn tách được role. Đây là đánh đổi chấp nhận được; nên thêm 1 case vào TC-07 để cố định hành vi.
- **m-7**: `resolveValidNovelcrafterStoryId(…, coordinator)` nằm trong `useMemo([selectedConversationId, stories])` (`useNovelcrafterStory.ts:68-71`). Cần thêm `coordinator` vào deps. Lưu ý trạng thái nội bộ của coordinator không kích hoạt re-render, nên memo chỉ tính lại khi `selectedConversationId`/`stories` đổi (hiện vẫn đủ, vì `setActiveId` chạy cùng lúc `upsertConversation`).
- **m-8**: TC-03A (save) cần chỉ định `incomingState.version >= 2` và `updatedAt >= 1000`. Nếu không, `ValidationError` stale (`:154`) sẽ ném trước guard destructive và test sẽ đo sai nhánh. Dialog destructive cũng sẽ hiển thị `previousChars = 2000` (giá trị giả). Nên ghi chú UX này.
- **m-9**: `setIsStreaming(true)` nay chạy trước `await ensureStoryConversation()`, nhưng khối `try/finally` quanh ensure không có `catch`. Nếu `bindState`/`promoteUnsavedDraftToStory` ném lỗi bất ngờ, `isStreaming` sẽ kẹt `true` và registry vẫn busy. Hậu quả là guard `if (isStreaming) return` khóa mọi tool cho tới khi user nhấn Escape/Stop. Nên cho nhánh thoát sớm chạy cả khi ensure throw.
- **m-10**: `StoryBibleWorkspace.tsx:120` vẫn gọi `onTriggerStream` mà không có guard `isStreaming`, nên vẫn theo ngữ nghĩa "abort và chạy lại", trong khi editor theo ngữ nghĩa "busy thì bỏ qua". T-B đã chứng minh trường hợp này an toàn. Nên ghi nhận sự khác biệt UX này hoặc thêm guard cho đồng nhất.
- **m-11**: TC-09: `createRafStreamBatcher` không tự ghi vào store (`novelcrafterStreamStore.ts:79-129`, chỉ gọi `onFlush`). Test phải truyền `onFlush` gọi `flushStreamSnapshot` thì kỳ vọng "cập nhật `streamingText` trong store" mới đúng. Nên ghi rõ.

#### Kết luận

**[CHANGES_REQUESTED]**: còn 0 BLOCKER, 1 MAJOR (P-1).

Revision 3 đã khắc phục toàn bộ B-2 và N-1 → N-6. Path, symbol, số dòng và Test Contract nay khớp `HEAD` (đã kiểm chứng bằng `[CMD]`/`[SRC]` ở trên). Thiết kế cốt lõi (gate token quota, Redis NX + Lua, guard promote, merge feedback, regex, `sanitizeError`) đều đạt.

Việc cần làm cho Revision 4:

1. Đóng **P-1**: chốt một phương án duy nhất cho trạng thái "load story thất bại".
   - Hoặc thêm bước khóa editor + chặn autosave + đường khôi phục vào §5.1/§6, kèm test.
   - Hoặc xóa tuyên bố khóa khỏi §4.2 S4, §5.1 mục 13 và Timeline 4, rồi ghi nhận timeline T-D là rủi ro chấp nhận.
   - Đồng bộ một tên cờ duy nhất.
2. (Khuyến nghị, không chặn) Xử lý m-1, m-4, m-5, m-8, m-9.

### Audit Run 4

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-17
- **Đối tượng**: Technical Plan Revision 4 (`round: 4`, `status: Ready for Review`)

#### Baseline đã chạy

- `[CMD]` `npm run type-check` → exit 0. `HEAD` = `67a6500`, không có thay đổi source nào chưa commit (chỉ có `tsconfig.tsbuildinfo` và 2 file plan).
- `[CMD]` `npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state` → `Test Files 15 passed (15)`, `Tests 71 passed (71)`. Khớp S1.
- `[CMD]` `ls .agents/rules/ docs/security.md .agents/skills/api-patterns.md .agents/skills/streaming-patterns.md`: mọi tài liệu ở §2 đều tồn tại.
- `[CMD]` Probe regex `dashMatch` mới: `"Linh—Kiếm khách"` → `null` (giữ nguyên làm `name`), các case `Spider-Man`/`Jean-Luc Picard`/`T-800` như Run 3. TC-07 case 4 khớp.
- `[SRC]` `storyPersistence.server.ts:22`: `DESTRUCTIVE_SAVE_MIN_CHARS = 2_000`.

#### Kiểm chứng lỗi cũ (so với Run 3)

| Mã   | Trạng thái                                                               | Ghi chú kiểm chứng                                                                                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1  | **Đã khắc phục một phần, nhưng đường khôi phục mới sinh ra 2 lỗi MAJOR** | Đã chốt một tên cờ (`loadErrorStoryId`). Đã có bước khóa (§6 Bước 1.3 a–d, §5.1 mục 13–16), guard autosave, pure helper + TC-03B. Vòng lặp T-D đã bị chặn. Tuy nhiên đường khôi phục Bước 2 và việc bỏ qua stale check vô điều kiện tạo ra lỗi mất dữ liệu. Xem **R-1**, **R-2**. |
| m-1  | **Đã khắc phục**                                                         | §2 không còn `03-security.md`.                                                                                                                                                                                                                                                    |
| m-2  | **Đã khắc phục**                                                         | §4.2 tách rõ `[SRC]` (HEAD) và "Thiết kế sau sửa".                                                                                                                                                                                                                                |
| m-3  | **Đã khắc phục**                                                         | 25 source + 9 test = 34 `[MODIFY]`. Danh sách §5.1 đếm đúng 34 mục.                                                                                                                                                                                                               |
| m-4  | **Đã khắc phục**                                                         | TC-06 chuyển sang `featureDirectives.test.ts`. Bước 3.2 phủ đủ 5 sub-mode `write`, `rewrite`, 2 sub-mode `expand`. (TC-06 Case 6A chưa liệt kê `openings_3`/`tone_shift`, xem m-14.)                                                                                              |
| m-5  | **Đã khắc phục**                                                         | Giữ log `rawMsg`, không log nguyên object `err`.                                                                                                                                                                                                                                  |
| m-6  | **Đã khắc phục**                                                         | TC-07 thêm case `Linh—Kiếm khách`, khớp probe.                                                                                                                                                                                                                                    |
| m-7  | **Đã khắc phục**                                                         | Thêm `coordinator` vào deps `useMemo`.                                                                                                                                                                                                                                            |
| m-8  | **Đã khắc phục**                                                         | TC-03A dùng `version: 2, updatedAt: 2000`. Với `content: "corrupted-ciphertext"`, `previousChars = max(20, 2000) = 2000`, `nextChars = 0 < 200` → 409. Nhánh recovery trả `version 3`. Khớp `[SRC]` `:174-176`.                                                                   |
| m-9  | **Đã khắc phục**                                                         | `try/catch/finally` quanh `ensureStoryConversation`, nếu throw thì gán `targetConversationId = null`.                                                                                                                                                                             |
| m-10 | **Đã khắc phục**                                                         | Thêm guard `isStreaming` vào `StoryBibleWorkspace.handleRunAi`.                                                                                                                                                                                                                   |
| m-11 | **Đã khắc phục**                                                         | TC-09 ghi rõ callback `onFlush` → `flushStreamSnapshot`.                                                                                                                                                                                                                          |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **PASS** | `[CMD]` type-check exit 0, test 15/71 pass. Không thêm dependency hay biến `.env`. Các symbol plan dùng đều đã tồn tại: `fetchRemoteStoryState`, `reconcileStoryStateWithDraft`, `setDestructivePrompt`, `confirmDestructiveSave`, `dirtyStoryIdsRef`, `cancelPendingSaveTimers` (`[SRC]` `useStoryPersistenceLifecycle.ts:20,32,72,258,422-432`). `DestructiveSavePromptState` có đúng 4 trường plan dùng (`:37-42`).                                                                                                |
| **S2 Lifecycle & Teardown**  | **PASS** | Không đổi so với Run 3 (T-A, T-B vẫn đúng). `confirmDestructiveSave` gọi `executeCoordinatorSave(…, { allowDestructive: true })` (`:258-267`). Khi `outcome.status === "saved"`, hàm này xóa prompt (`:123`), nên điểm móc `onClearLoadError` ở bước (d) là hợp lệ.                                                                                                                                                                                                                                                   |
| **S3 Database & Temporal**   | **FAIL** | `[SRC]` `storyPersistence.server.ts:154`: stale check hiện là control optimistic concurrency NC-08 duy nhất. Plan biến `allowDestructive` thành cờ bỏ qua cả stale check cho **mọi** lần lưu destructive, không chỉ với bản ghi hỏng. Timeline T-E: ghi đè mất dữ liệu giữa 2 tab. Xem **R-2**.                                                                                                                                                                                                                       |
| **S4 Cross-Task State Flow** | **FAIL** | `[SRC]` `useNovelcrafterCatalog.ts:63`: `fetchRemoteStoryState` ném cùng một `Error(loadErrorMsg)` cho **mọi** `!res.ok` (429/500/401) và cả khi mất mạng. `[SRC]` `state/route.ts:86,…`: GET và PUT dùng 2 bucket rate limit riêng (`novelcrafter-state-get` / `-put`). `[SRC]` `storyPersistence.server.ts:88-90`: lỗi query Supabase tạm thời cũng là `DatabaseError` (cùng code với lỗi giải mã dự kiến). Vì vậy Bước 2 của `saveNow` mở hộp thoại ghi đè cả khi story còn nguyên vẹn. Timeline T-F. Xem **R-1**. |
| **S5 Security Boundary**     | **PASS** | Không đụng auth (`requireAuthenticatedEmail`), `service_role` hay RLS. `allowDestructive` chỉ tác động lên dữ liệu của chính user (ownership được kiểm tra tại `:61-77`). `sanitizeError(err, true)` giữ nguyên như Run 3.                                                                                                                                                                                                                                                                                            |
| **S6 External Resilience**   | **PASS** | Không đổi so với Run 3: gate `type === "token"`, TTL in-flight 360s > `maxDuration` 300s.                                                                                                                                                                                                                                                                                                                                                                                                                             |

#### Adversarial Timelines bổ sung (reviewer)

```
T-E — Cơ chế: allowDestructive bỏ qua stale check (2 tab, story KHÔNG hỏng)
T1: Tab A và Tab B cùng mở story S (server version 5, 50.000 ký tự)
T2: Tab A xóa gần hết chương → PUT v5 → 409 DESTRUCTIVE_SAVE_REJECTED → prompt hiện, user chưa bấm
T3: Tab B viết thêm 3.000 ký tự → PUT v5 → server lưu v6
T4: Tab A bấm "Xác nhận xóa & ghi đè" → PUT v5 + allowDestructive
    HEAD hiện tại: v5 < v6 → ValidationError STALE → conflict recovery → hòa giải, giữ thay đổi của B → AN TOÀN
    Sau Revision 4: bỏ qua stale check → lưu v7 = state của Tab A
Kết cục: 3.000 ký tự của Tab B bị ghi đè âm thầm, không có backup card → LỖI (MAJOR, R-2)
```

```
T-F — Cơ chế: Đường khôi phục Bước 2 khi lỗi tải chỉ là tạm thời (story KHÔNG hỏng)
T1: Mở story S (server có 80.000 ký tự). GET /state → Supabase lỗi tạm thời (:88-90) hoặc 429 → throw → khóa story, latestStateRef = fallback (draft local cũ hoặc default rỗng)
T2: User bấm "Retry save" → saveNow → fetchRemoteStoryState → lại 429 (bucket GET chưa hồi) hoặc DB vẫn chập chờn → throw
T3: Bước 2 mở DestructiveSaveConfirmModal với previousChars: 200 (giả) → nội dung hiển thị "200 → 0 ký tự"
T4: User nghĩ chỉ mất 200 ký tự → bấm "Xác nhận xóa & ghi đè" → PUT (bucket PUT riêng, DB đã hồi) với allowDestructive → bỏ qua stale check VÀ destructive guard
Kết cục: Story 80.000 ký tự nguyên vẹn bị ghi đè bằng state rỗng/cũ → LỖI MẤT DỮ LIỆU (MAJOR, R-1)
```

#### Phân loại lỗi

**[BLOCKER]**

- Không có.

**[MAJOR]**

- **R-1 (Đường khôi phục Bước 2 không phân biệt "bản ghi hỏng" với "lỗi tạm thời", nên có thể xóa story còn nguyên vẹn)**:
  - §3.1.5 và §6 Bước 1.3 (`saveNow` bước 2) mở hộp thoại ghi đè **mỗi khi** `fetchRemoteStoryState` ném lỗi. Nhưng hàm này ném cùng một lỗi cho mất mạng, 401, 429 và 500. Ở phía server, lỗi giải mã dự kiến là `DatabaseError`, **trùng code** `DATABASE_ERROR` với lỗi query Supabase tạm thời (`storyPersistence.server.ts:88-90`).
  - `previousChars: 200` là con số giả. Nó còn mâu thuẫn với `DESTRUCTIVE_SAVE_MIN_CHARS = 2_000`. Hộp thoại hiện "200 → N ký tự", khiến user đánh giá sai mức độ mất dữ liệu (T-F).
  - Logic quyết định nằm trong hook, không có test.
  - **Yêu cầu**:
    1. Server ném lỗi có code riêng cho bản ghi hỏng, ví dụ `new AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED")` (hoặc subclass của `DatabaseError` với code riêng). Lỗi query vẫn giữ `DATABASE_ERROR`.
    2. `fetchRemoteStoryState` ném lỗi có kiểu, mang theo `status`/`code` (ví dụ class `StoryLoadError`).
    3. `saveNow` chỉ mở hộp thoại ghi đè khi `code === "STORY_STATE_CORRUPTED"`. Mọi lỗi khác thì giữ khóa, `toast.error(t("novelcrafterLoadError"))` và cho phép thử lại.
    4. Không dùng hộp thoại ">90%" với con số giả. Dùng prompt hoặc chuỗi i18n riêng (`vi.ts`/`en.ts`) giải thích "bản lưu trên máy chủ không đọc được". Nếu dùng lại modal thì cần truyền cờ để đổi nội dung.
    5. Tách quyết định thành pure helper trong `lib/` (ví dụ `resolveLoadLockRecoveryAction(errorCode)` → `"overwrite_prompt" | "keep_locked"`), kèm test trong `draftStorage.test.ts`. Thêm test route `GET` trả `STORY_STATE_CORRUPTED` vào TC-03A.

- **R-2 (`allowDestructive` bỏ qua stale check vô điều kiện, làm hỏng optimistic concurrency NC-08)**:
  - Bước 1.3 sửa `:154` thành `if (!options?.allowDestructive && (stale…))`. `allowDestructive` hiện là cờ của luồng "xác nhận lưu khi xóa >90%" thông thường (`useStoryPersistenceLifecycle.ts:258-267`). Sau khi sửa, mọi lần xác nhận đó đều ghi đè được bản mới hơn từ tab hoặc thiết bị khác (T-E).
  - Rủi ro #4 (§9) không nêu tác dụng phụ này.
  - **Yêu cầu**:
    1. Chỉ bỏ qua stale check khi **server tự xác định** bản ghi hiện có không giải mã/parse được **và** `allowDestructive === true`. Ví dụ: tính `existingCorrupted` một lần (dùng lại khối decrypt ở `:164-172`, đặt lên trước stale check), rồi viết `if (!(options?.allowDestructive && existingCorrupted) && (stale…)) throw …`.
    2. Thêm case vào TC-03A: bản ghi **giải mã được**, `incomingState` stale (`version: 1 < 2`) kèm `allowDestructive: true` → vẫn ném `ValidationError` stale.

**[MINOR]**

- **m-12**: Bước 1 của `saveNow` (tải lại thành công) đặt `saveStatus = "saved"` sau khi hòa giải, nhưng bỏ qua `reconciled.shouldSyncDraftToServer`, `writeLocalStoryDraft` và `coordinator.bumpEpoch`. Nên dùng lại đúng logic nhánh `.then` (`useNovelcrafterStory.ts:223-237`) hoặc của `runConflictRecovery` (`:190-221`). Nếu không, thay đổi local đã hòa giải sẽ không được đẩy lên server.
- **m-13**: Guard ở đầu `scheduleSave` (`:300`) `return` trước cả khối ghi bản nháp local (`:302-317`). Khi story bị khóa, chỉ textarea chương là `readOnly`. Story Bible, feedback gutter và các AI tool (stream ghi trực tiếp vào chương qua bridge) vẫn sửa được state, nhưng thay đổi không được ghi vào localStorage và mất khi reload. Có 2 cách: chỉ chặn phần lưu server, vẫn giữ `flushLocalDraftSync`; hoặc ghi rõ phạm vi khóa và chặn luôn các trigger stream khi `isLoadLocked`.
- **m-14**: TC-06 Case 6A chỉ liệt kê sub-mode `first_draft_rough`, `guided` và default của `write`, trong khi Bước 3.2 sửa cả `openings_3` và `tone_shift`. Nên thêm 2 sub-mode này vào test.
- **m-15**: Bước 1.3 mục (b) `.catch` cần ghi rõ các thao tác mới nằm trong `if (!cancelled)` như code hiện tại (`:239`). Nếu không, một lần tải bị hủy (user đã chuyển story) có thể ghi đè `latestStateRef` của story mới.

#### Kết luận

**[CHANGES_REQUESTED]**: còn 0 BLOCKER, 2 MAJOR (R-1, R-2).

Revision 4 đã đóng vòng lặp T-D. Ngoài ra đã khắc phục toàn bộ m-1 → m-11 (đã kiểm chứng bằng `[CMD]`/`[SRC]` ở trên). Phần còn lại của plan (stream lifecycle, Redis, quota, regex, prompt, typography, i18n) giữ nguyên trạng thái đạt như Run 3.

Tuy nhiên, đường khôi phục mới có thể làm mất dữ liệu thật trong 2 trường hợp: story nguyên vẹn nhưng tải lỗi tạm thời (T-F), và xung đột giữa 2 tab (T-E).

Việc cần làm cho Revision 5:

1. Đóng **R-1**: phân biệt lỗi hỏng bản ghi bằng code riêng từ server tới client. Chỉ mở hộp thoại ghi đè khi bản ghi hỏng. Bỏ `previousChars: 200` giả, thay bằng nội dung i18n riêng. Tách pure helper kèm test.
2. Đóng **R-2**: chỉ bỏ qua stale check khi server xác nhận `existingCorrupted && allowDestructive`. Thêm test âm cho bản ghi lành.
3. Cập nhật Timeline 4, §3.1.5, §5.1 mục 3/14/28/29/30, §7 TC-03A/TC-03B và §9 Rủi ro #4 cho đồng bộ.
4. (Khuyến nghị, không chặn) Xử lý m-12 → m-15.

### Audit Run 5

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-17
- **Đối tượng**: Technical Plan Revision 5 (`round: 5`, `status: Ready for Review`)

#### Baseline đã chạy

- `[CMD]` `npm run type-check` (`tsc --noEmit`) → exit 0, không có lỗi. `HEAD` = `67a6500`, không có thay đổi source nào chưa commit.
- `[CMD]` `npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state` → `Test Files 15 passed (15)`, `Tests 71 passed (71)`. Khớp S1.
- `[CMD]` `grep getStoryState src` (bỏ test): caller duy nhất là `src/app/api/novelcrafter/state/route.ts:98`. Việc đổi `getStoryState` từ "trả default" sang "ném `STORY_STATE_CORRUPTED`" không làm gãy caller nào khác.
- `[CMD]` `grep it( storyPersistence.server.test.ts`: không có test hiện hữu nào assert hành vi "decrypt lỗi → trả default", nên TC-03A không mâu thuẫn với test cũ.
- `[SRC]` `src/lib/core/encryption.ts:75-120`: `decryptText("corrupted-ciphertext")` (không có `:`) trả về plain text kèm warn, sau đó `JSON.parse` ném lỗi → `existingCorrupted = true`. Fixture của TC-03A Case 3A-1/3A-2/3A-3 hợp lệ. Test dùng AES thật (không mock `@/lib/core/encryption`), nên Case 3A-4 cần tạo dòng lành bằng `encryptText`.
- `[SRC]` `src/app/api/novelcrafter/state/route.ts:58-66`: `formatErrorResponse` trả `{ error: { message, code } }` với `status = error.statusCode`. Client đọc `errJson.error?.code` là đúng.

#### Kiểm chứng lỗi cũ (so với Run 4)

| Mã   | Trạng thái       | Ghi chú kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1  | **Đã khắc phục** | §3.1.5, §6 Bước 1.3 và §5.1 mục 3/10/11/15/16: server ném `AppError(…, 500, "STORY_STATE_CORRUPTED")` riêng. Lỗi query Supabase vẫn là `DATABASE_ERROR` (`[SRC]` `storyPersistence.server.ts:88-90`). Client có `StoryLoadError` mang `status`/`code`. Pure helper `resolveLoadLockRecoveryAction` chỉ trả `"overwrite_prompt"` với `STORY_STATE_CORRUPTED` và có test ở TC-03B Case 3B-4. Đã bỏ `previousChars: 200` giả, thay bằng `reason: "corrupted_remote"` + 2 khóa i18n mới (`[CMD]` grep xác nhận chưa tồn tại trong `vi.ts`/`en.ts`). Đã thêm test route vào TC-03A. Chạy lại T-F → AN TOÀN (xem dưới). |
| R-2  | **Đã khắc phục** | Bước 1.3 (2): `canBypassStaleForCorruptedRecovery = existingCorrupted && Boolean(options?.allowDestructive)`, trong đó `existingCorrupted` do server tự xác định bằng decrypt/parse. TC-03A Case 3A-4 là test âm cho bản ghi lành. Rủi ro #4 trong §9 đã cập nhật. Chạy lại T-E → AN TOÀN.                                                                                                                                                                                                                                                                                                                        |
| m-12 | **Đã khắc phục** | Bước 1 của `saveNow` đã có đủ `seedServerMeta`, `bumpEpoch`, `reconcileStoryStateWithDraft`, `writeLocalStoryDraft` và `executeCoordinatorSave` khi `shouldSyncDraftToServer`, giống nhánh `.then` (`[SRC]` `useNovelcrafterStory.ts:223-237`). **Tuy nhiên chưa có owner guard**, xem R-3.                                                                                                                                                                                                                                                                                                                       |
| m-13 | **Đã khắc phục** | Giữ khối `draftThrottleTimerRef`/`flushLocalDraftSync` (`[SRC]` `useStoryPersistenceLifecycle.ts:302-317`). Chỉ chặn `executeCoordinatorSave` tại `:309` và `:326`. Guard đặt tại `:326` nằm trước `dirtyStoryIdsRef.add`/`setSaveStatus("unsaved")`, nên trạng thái "error" được giữ nguyên. Đã chặn thêm các trigger stream trong `ChapterEditorWorkspace` khi `isLoadLocked`.                                                                                                                                                                                                                                  |
| m-14 | **Đã khắc phục** | TC-06 Case 6A phủ đủ 8 lời gọi (5 `write` + `rewrite` + 2 `expand`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| m-15 | **Đã khắc phục** | Toàn bộ thao tác mới ở `.catch` đều nằm trong `if (!cancelled)`, đúng với `[SRC]` `useNovelcrafterStory.ts:238-243`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **PASS** | `[CMD]` type-check exit 0, 15 files/71 tests pass. Không thêm dependency hay biến `.env`. `resolveValidNovelcrafterStoryId` đã có tham số thứ 3 `coordinator?` (`[SRC]` `draftStorage.ts:379-383`). `fetchRemoteStoryState` đã được import vào lifecycle (`[SRC]` `useStoryPersistenceLifecycle.ts:32`), nên import thêm `StoryLoadError` từ cùng module không tạo vòng phụ thuộc mới. Số lượng file khớp: 27 source + 9 test = 36 `[MODIFY]`, 6 `[NEW]`.                                                                   |
| **S2 Lifecycle & Teardown**  | **PASS** | Không đổi so với Run 4. `confirmDestructiveSave` gọi `executeCoordinatorSave(…, { allowDestructive: true })` (`[SRC]` `:258-267`). Khi `saved`, bước (d) gỡ khóa bằng điều kiện `loadErrorStoryIdRef.current === storyId` (đã scope đúng).                                                                                                                                                                                                                                                                                  |
| **S3 Database & Temporal**   | **PASS** | `[ADV]` chạy lại T-E: bản ghi lành → `existingCorrupted = false` → stale check vẫn chạy → `ValidationError` → conflict recovery. Check-then-act giữa đọc `existingRow` và ghi đã có sẵn trên `HEAD`, plan không làm nó tệ hơn. Trường hợp 2 tab cùng ghi đè một bản ghi hỏng: cả hai đều lấy pending state từ cùng một khóa `localStorage`, last-write-wins chấp nhận được. Trục serverless: N/A, không có state in-memory mới phía server.                                                                                 |
| **S4 Cross-Task State Flow** | **FAIL** | `[SRC]` code hiện tại luôn kiểm tra owner sau mỗi `await fetchRemoteStoryState`: `useStoryPersistenceLifecycle.ts:212` (conflict recovery), `:284` (reload), `:142` (destructive prompt). Đường Retry mới trong `saveNow` (§6 Bước 1.3, §3.1.5 mục 3) lại cập nhật `latestStateRef`/`setStoryState`, gọi `onClearLoadError()` và `setDestructivePrompt({ pendingState: latestStateRef.current.state })` **mà không kiểm tra** `latestStateRef.current.ownerStoryId === targetStoryId` sau `await`. Xem T-G, T-H và **R-3**. |
| **S5 Security Boundary**     | **PASS** | Không đụng auth (`requireAuthenticatedEmail`, `[SRC]` `route.ts:25-32`), `service_role` hay RLS. Ownership vẫn kiểm tra trước mọi read/write (`[SRC]` `storyPersistence.server.ts:61-77,113,140`). Message `"Story state is unreadable"` đi qua `sanitizeError` và không chứa dữ liệu nhạy cảm.                                                                                                                                                                                                                             |
| **S6 External Resilience**   | **PASS** | Không đổi so với Run 4: chỉ trừ quota khi có `type === "token"`, TTL in-flight 360s > `maxDuration` 300s, SSE `error` đi qua `sanitizeError(err, true)`.                                                                                                                                                                                                                                                                                                                                                                    |

#### Adversarial Timelines bổ sung (reviewer)

```
T-E (chạy lại trên Revision 5) — Cơ chế: allowDestructive + stale check, 2 tab, story KHÔNG hỏng
T1: Tab A và Tab B cùng mở S (v5). Tab A xóa gần hết → 409 → prompt
T2: Tab B lưu v6
T3: Tab A xác nhận → PUT v5 + allowDestructive → server decrypt existingRow OK → existingCorrupted = false
    → canBypass = false → v5 < v6 → ValidationError STALE → conflict recovery
Kết cục: thay đổi của B được giữ → AN TOÀN (R-2 đã đóng)
```

```
T-F (chạy lại trên Revision 5) — Cơ chế: Retry khi lỗi tải chỉ là tạm thời
T1: GET /state → 429 hoặc DATABASE_ERROR → khóa S
T2: Retry → fetchRemoteStoryState lại lỗi → StoryLoadError(code = "RATE_LIMIT_EXCEEDED" | "DATABASE_ERROR")
T3: resolveLoadLockRecoveryAction → "keep_locked" → toast, không mở modal
Kết cục: story 80.000 ký tự không bị chạm tới → AN TOÀN (R-1 đã đóng)
```

```
T-G — Cơ chế: Retry (Bước 2, bản ghi hỏng) chạy đua với việc chuyển story
T1: Story A (bản ghi hỏng) bị khóa. latestStateRef = { owner: A, state: draft local của A }
T2: User bấm Retry → saveNow chốt targetStoryId = A → await fetchRemoteStoryState(A) (đang chờ mạng)
T3: User bấm sang story B → effect tải B thành công → latestStateRef = { owner: B, state: B }
T4: fetch A trả 500 STORY_STATE_CORRUPTED → "overwrite_prompt"
    → setDestructivePrompt({ storyId: A, pendingState: latestStateRef.current.state /* = B */, reason: "corrupted_remote" })
T5: Modal "bản lưu không đọc được" hiện ngay trên màn hình B → user bấm xác nhận
    → executeCoordinatorSave(A, stateCủaB, allowDestructive) → server: A hỏng + allowDestructive → ghi nội dung B vào A
    → markLocalDraftSynced(A) đánh dấu draft local của A là synced
Kết cục: story A thành bản sao của B, draft local của A (bản duy nhất còn đọc được) bị coi là đã đồng bộ và bị ghi đè ở lần tải sau → LỖI MẤT DỮ LIỆU (MAJOR, R-3)
```

```
T-H — Cơ chế: Retry (Bước 1, tải lại thành công) chạy đua với việc chuyển story
T1: Story A bị khóa do 429 tạm thời. User bấm Retry → await fetchRemoteStoryState(A)
T2: User chuyển sang B → B tải xong → latestStateRef = { owner: B }; (hoặc B cũng lỗi tải → loadErrorStoryId = B)
T3: fetch A thành công → plan gán latestStateRef = { owner: A, state: reconciledA }, setStoryState(reconciledA), onClearLoadError()
Kết cục: UI đang chọn B nhưng hiển thị nội dung A. Mọi chỉnh sửa tiếp theo được scheduleSave ghi vào A (ownerId = A).
         Nếu B đang bị khóa thì onClearLoadError() (không scope) gỡ khóa của B một cách sai → LỖI (MAJOR, R-3)
```

#### Phân loại lỗi

**[BLOCKER]**

- Không có.

**[MAJOR]**

- **R-3 (Đường Retry của `saveNow` khi đang khóa thiếu owner guard sau `await`, gây lẫn state giữa các story)**:
  - Vị trí: §3.1.5 mục 3 (Bước 1 và Bước 2), §6 Bước 1.3 (`saveNow` 1–2), Timeline 4 T4, §5.1 mục 15.
  - Bước 1 ghi `latestStateRef`/`setStoryState` và gọi `onClearLoadError()` vô điều kiện. Bước 2 dựng `pendingState` từ `latestStateRef.current.state` tại thời điểm **sau** `await`. Toàn bộ code hiện có đều kiểm tra owner sau `await` (`[SRC]` `useStoryPersistenceLifecycle.ts:142,212,284`), riêng đường mới thì không (T-G, T-H).
  - `onClearLoadError: () => updateLoadErrorStoryId(null)` không có tham số story, nên có thể gỡ khóa của story khác.
  - **Yêu cầu**:
    1. Sau `await fetchRemoteStoryState(targetStoryId, …)` (cả nhánh thành công và nhánh lỗi), chỉ cập nhật UI state (`latestStateRef`, `setStoryState`, `setSaveStatus`, `setDestructivePrompt`, `toast`) khi `latestStateRef.current.ownerStoryId === targetStoryId`. Các thao tác không gắn với UI (`seedServerMeta`, `bumpEpoch`, `writeLocalStoryDraft`) vẫn chạy được, giống `runConflictRecovery` tại `:196-219`.
    2. Ở Bước 2, chụp `pendingState` **trước** `await`, hoặc kiểm tra lại owner rồi mới dùng `latestStateRef.current.state`. Tuyệt đối không ghép `storyId: A` với state của story khác.
    3. Scope việc gỡ khóa theo story: `onClearLoadError(storyId)` → `if (loadErrorStoryIdRef.current === storyId) updateLoadErrorStoryId(null)`. Dùng `useCallback` để giữ identity ổn định trong deps của `executeCoordinatorSave`/`saveNow`.
    4. Tách quyết định thành pure helper trong `lib/` (ví dụ `shouldApplyLoadLockRetryResult({ targetStoryId, currentOwnerStoryId })` trong `draftStorage.ts`) và thêm case vào TC-03B: owner trùng → `true`, owner đã đổi → `false`, owner `null` → `false`.
    5. Cập nhật Timeline 4 T4 và Rủi ro #4 (§9) để nêu control này.

**[MINOR]**

- **m-16 (Lệch khóa mã hóa bị coi là bản ghi hỏng)**: `existingCorrupted`/`STORY_STATE_CORRUPTED` dựa trên việc AES-GCM auth thất bại. Nếu một môi trường (preview/staging dùng chung DB) có `DATA_ENCRYPTION_KEY` hợp lệ nhưng khác khóa thật, **mọi** story sẽ bị coi là hỏng. Khi user xác nhận ghi đè, ciphertext gốc (còn khôi phục được nếu sửa đúng khóa) bị mất vĩnh viễn. Nên nêu rủi ro này ở §9. Cân nhắc giữ lại ciphertext cũ (ví dụ chép sang `meta.corruptedBackup` hoặc một row backup) trước khi ghi đè, hoặc ít nhất log `dbLogger.error` với marker riêng để ops phát hiện hàng loạt.
- **m-17**: Nhấn Retry/Ctrl+S nhiều lần khi đang khóa sẽ gọi song song nhiều `fetchRemoteStoryState`. Lần `bumpEpoch` sau làm lần lưu trước bị `superseded`, nên không mất dữ liệu nhưng có thể hiện nhiều toast. Nên thêm một ref single-flight.
- **m-18**: Ở chế độ `corrupted_remote`, nút "Tải lại an toàn" của modal gọi `reloadAfterDestructiveRejection` (`[SRC]` `:269-297`). Hàm này chắc chắn lại thất bại và chỉ hiện toast `novelcrafterLoadError` chung chung. Nên đổi nhãn nút thành "Để sau / Giữ khóa" cho `reason === "corrupted_remote"`, hoặc ghi rõ hành vi này.

#### Kết luận

**[CHANGES_REQUESTED]**: còn 0 BLOCKER, 1 MAJOR (R-3).

Revision 5 đã đóng R-1 và R-2. Hai timeline mất dữ liệu T-E, T-F chạy lại đều AN TOÀN. m-12 → m-15 cũng đã được xử lý. Phần còn lại của plan (server persistence, Redis, quota, regex, prompt, typography, i18n, test contract) đạt chuẩn.

Lỗi còn lại nằm trong đường Retry mới thêm: thiếu owner guard sau `await` nên có thể ghi nội dung story B vào story A (T-G) hoặc hiển thị/ghi lẫn state giữa 2 story (T-H).

Việc cần làm cho Revision 6:

1. Đóng **R-3**: thêm owner guard sau `await` cho cả 2 nhánh của `saveNow` khi khóa, chụp `pendingState` an toàn, scope `onClearLoadError(storyId)`, tách pure helper kèm case TC-03B.
2. Cập nhật §3.1.5, §6 Bước 1.3, Timeline 4 và §9 Rủi ro #4 cho đồng bộ.
3. (Khuyến nghị, không chặn) Xử lý m-16 → m-18.

### Audit Run 6

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-17
- **Đối tượng**: Technical Plan Revision 6 (`round: 6`, `status: Ready for Review`)

#### Baseline đã chạy

- `[CMD]` `npm run type-check` (`tsc --noEmit`) → exit 0. `HEAD` = `67a6500`, không có source nào chưa commit (chỉ `tsconfig.tsbuildinfo` và 2 file plan).
- `[CMD]` `npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state` → `Test Files 15 passed (15)`, `Tests 71 passed (71)`. Khớp S1.
- `[CMD]` `grep executeCoordinatorSave|saveNow src` (ngoài lifecycle): các caller là `useNovelcrafterStory.ts:102` (`ensureActiveStory`, chỉ cho story mới), `:168` (flush khi chuyển story, plan đã chặn), `:205` (promote unsaved), `:230` (`.then` khi tải thành công), `:267`/`:283` (`handleCreateStory`) và `NovelcrafterStudioApp.tsx:257` (`onRetrySave`). `:267` chỉ chạy khi `dirtyStoryIdsRef.has(prevOwner)`. Do `.catch` đã xóa `validStoryId` khỏi dirty set và guard tại `useStoryPersistenceLifecycle.ts:326` nằm trước `dirtyStoryIdsRef.add`, story đang khóa không thể bị autosave qua `:267`.
- `[SRC]` `src/lib/core/encryption.ts:74-124`: `decryptText` ném lỗi khi GCM auth thất bại (lệch khóa) hoặc sai format có `:`. Với chuỗi không có `:`, hàm trả plain text và `JSON.parse` sẽ ném lỗi sau đó. Cả hai trường hợp đều dẫn tới `existingCorrupted = true`.
- `[SRC]` `src/lib/features/novelcrafter/storyPersistence.server.ts:194-211`: `metaPayload` được **dựng lại từ đầu** ở mỗi lần lưu, và `update({ meta: metaPayload })` thay thế toàn bộ cột `meta`. Đây là cơ sở của **R-4** bên dưới.

#### Kiểm chứng lỗi cũ (so với Run 5)

| Mã   | Trạng thái             | Ghi chú kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-3  | **Đã khắc phục**       | §3.1.5 mục 3, §6 Bước 1.3 `saveNow` (1)–(3), §5.1 mục 14/15, Timeline 4 T4 và §9 Rủi ro #4 đã đồng bộ: (1) `snapshotStateForRecovery` được chụp **trước** `await`. (2) Nhánh thành công chỉ chạy các thao tác dữ liệu theo `targetStoryId`; `latestStateRef`, `setStoryState`, `toast` và `setSaveStatus` chỉ được cập nhật khi `shouldApplyLoadLockRetryResult(...) === true`, giống mẫu `[SRC]` `useStoryPersistenceLifecycle.ts:196-219`. (3) Nhánh lỗi kiểm tra owner trước khi mở modal hoặc bắn toast. (4) `clearLoadErrorForStory(storyId)` đã scope theo story và dùng `useCallback([])` nên identity ổn định. (5) Pure helper có TC-03B Case 3B-5. Chạy lại T-G và T-H → AN TOÀN (xem dưới). |
| m-16 | **Khắc phục một phần** | Đã có log marker `[STORY_STATE_CORRUPTED]`. Tuy nhiên bản sao lưu `corruptedBackupCiphertext` **bị xóa ở lần lưu kế tiếp**, xem **R-4**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| m-17 | **Đã khắc phục**       | `isRetryingLockedStoryRef` single-flight, `try/finally` chỉ reset khi ref vẫn bằng `targetStoryId`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| m-18 | **Đã khắc phục**       | Ở chế độ `corrupted_remote`, nút hủy dùng nhãn `novelcrafterCorruptedStateKeepLockedBtn` và `reloadAfterDestructiveRejection` chỉ đóng modal. Ba khóa i18n mới được thêm vào cả `vi.ts` và `en.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **PASS** | `[CMD]` type-check exit 0, 15 files/71 tests pass. Không thêm dependency hay biến `.env`. Các import mới của lifecycle (`readLocalStoryDraft`, `shouldBlockAutosaveForStory`, `shouldApplyLoadLockRetryResult`, `resolveLoadLockRecoveryAction` từ `draftStorage`, và `StoryLoadError` từ `./useNovelcrafterCatalog`) đều trỏ tới module đã được import sẵn (`[SRC]` `useStoryPersistenceLifecycle.ts:15-22,32`), nên không tạo vòng phụ thuộc mới. `readLocalStoryDraft` đã được export sẵn (`[SRC]` `draftStorage.ts:112`). Số lượng file khớp: 36 `[MODIFY]` và 6 `[NEW]`. |
| **S2 Lifecycle & Teardown**  | **PASS** | Chỉ đổi khối retry `try/finally` cho ref single-flight. Các timer được hủy qua `cancelPendingSaveTimers()` trong `.catch`, nên `retryTimerRef` của nhánh `rate_limited` (`:157-165`) cũng bị dừng. Phần SSE/stream giữ nguyên như Run 5.                                                                                                                                                                                                                                                                                                                                      |
| **S3 Database & Temporal**   | **FAIL** | `[ADV]` T-J: bản sao lưu ciphertext gốc chỉ tồn tại tới lần autosave kế tiếp, vì `metaPayload` được dựng lại và ghi đè toàn bộ `meta` (`[SRC]` `storyPersistence.server.ts:194-211`). Control cho Rủi ro #4(e) (mức **Cao**) vì vậy không có hiệu lực. TC-03A Case 3A-3 chỉ assert lần ghi đè đầu tiên, nên không bắt được lỗi này. Xem **R-4**. Trục serverless: N/A, không có state in-memory mới phía server.                                                                                                                                                              |
| **S4 Cross-Task State Flow** | **PASS** | `[ADV]` chạy lại T-G và T-H (dưới) → AN TOÀN. `[SRC]` `executeCoordinatorSave` vẫn giữ owner guard tại `:113,131,142,155,174,212,230,239`, nên lời gọi `executeCoordinatorSave(targetStoryId, …)` sau khi user đã chuyển story không chạm vào UI của story B.                                                                                                                                                                                                                                                                                                                 |
| **S5 Security Boundary**     | **PASS** | Không đụng auth, `service_role` hay RLS. Ownership vẫn được kiểm tra trước mọi read/write (`[SRC]` `storyPersistence.server.ts:61-77,113,140`). Ciphertext sao lưu chỉ nằm phía server, trong cột `meta` của dòng có `isContextOnly: true`, và không được trả về client qua `/api/novelcrafter/state`.                                                                                                                                                                                                                                                                        |
| **S6 External Resilience**   | **PASS** | Không đổi so với Run 5: chỉ trừ quota khi có `type === "token"`, TTL in-flight 360s > `maxDuration` 300s, SSE `error` đi qua `sanitizeError(err, true)`.                                                                                                                                                                                                                                                                                                                                                                                                                      |

#### Adversarial Timelines bổ sung (reviewer)

```
T-G (chạy lại trên Revision 6) — Cơ chế: Retry (Bước 2, bản ghi hỏng) chạy đua với việc chuyển story
T1: A (hỏng) bị khóa. latestStateRef = { owner: A, state: draftA }
T2: Retry → snapshotStateForRecovery = draftA (chụp trước await) → await fetchRemoteStoryState(A)
T3: User chuyển sang B → latestStateRef = { owner: B }
T4: fetch A → STORY_STATE_CORRUPTED → shouldApplyLoadLockRetryResult({ A, B }) = false → return; finally reset ref
Kết cục: không mở modal trên B, không ghép state của B vào A. A vẫn khóa và sẽ được kiểm tra lại khi user mở lại A → AN TOÀN
```

```
T-H (chạy lại trên Revision 6) — Cơ chế: Retry (Bước 1, tải lại thành công) chạy đua với việc chuyển story; B cũng đang khóa
T1: A khóa do 429. Retry → await fetch(A)
T2: User chuyển sang B, B cũng lỗi tải → loadErrorStoryId = B
T3: fetch A thành công → seedServerMeta(A), bumpEpoch(A), writeLocalStoryDraft(A), clearLoadErrorForStory(A)
    → loadErrorStoryIdRef (= B) !== A → không gỡ khóa B. shouldApply = false → không đổi UI của B
Kết cục: B vẫn khóa đúng, UI của B không bị đổi → AN TOÀN
```

```
T-I — Cơ chế: modal corrupted_remote đang mở, user chuyển story rồi bấm xác nhận
T1: Modal mở cho A với pendingState = snapshot của A
T2: User chuyển sang B (modal không tự đóng — hành vi giống destructive_drop trên HEAD)
T3: Bấm xác nhận → executeCoordinatorSave(A, snapshotA, allowDestructive) → ghi đúng nội dung của A vào A
Kết cục: không bị lẫn dữ liệu nhờ dùng snapshot → AN TOÀN
```

```
T-J — Cơ chế: độ bền của bản sao lưu ciphertext (m-16) qua các lần lưu kế tiếp
T1: Môi trường preview dùng DATA_ENCRYPTION_KEY khác prod → GET A → STORY_STATE_CORRUPTED → khóa
T2: Retry → overwrite_prompt → user xác nhận → saveStoryState(allowDestructive)
    → meta = { …, corruptedBackupCiphertext: <ciphertext gốc>, … } → lưu thành công, gỡ khóa
T3: User gõ 1 ký tự → scheduleSave → 2s sau PUT → saveStoryState: existingCorrupted = false
    → metaPayload dựng lại KHÔNG có corruptedBackup* → update({ meta }) thay toàn bộ cột meta
Kết cục: ciphertext gốc (vẫn khôi phục được nếu dùng đúng khóa) mất vĩnh viễn sau vài giây
         → LỖI MẤT DỮ LIỆU (MAJOR, R-4). Control của Rủi ro #4(e) không có hiệu lực.
```

#### Phân loại lỗi

**[BLOCKER]**

- Không có.

**[MAJOR]**

- **R-4 (Bản sao lưu ciphertext `corruptedBackup*` bị xóa ở lần lưu kế tiếp)**:
  - Vị trí: §3.1.5 mục 5 (gạch đầu dòng "Bảo toàn tuyệt đối Stale Check…" — câu sao lưu ciphertext), §6 Bước 1.3 `saveStoryState` (4), §5.1 mục 3, TC-03A Case 3A-3, §9 Rủi ro #4(e).
  - `[SRC]` `storyPersistence.server.ts:194-200` dựng `metaPayload` mới ở mỗi lần lưu, và `:207-211` ghi đè toàn bộ `meta`. Plan chỉ đính kèm `corruptedBackup*` khi `canBypassStaleForCorruptedRecovery`. Lần lưu ngay sau đó có `existingCorrupted = false` nên dựng `meta` không có backup → backup mất (T-J). Rủi ro #4(e) được xếp mức **Cao** nhưng control đã nêu không chịu được lần autosave đầu tiên (evidence-bar §4.5.4).
  - **Yêu cầu**:
    1. Giữ backup bền vững qua các lần lưu. Có hai cách: (a) khi `existingMeta` đã có `corruptedBackupCiphertext`/`corruptedBackupVersion`/`corruptedBackupAt` (là `string`/`number`) thì chép sang `metaPayload` mới; hoặc (b) khuyến nghị: ghi backup vào **một dòng `messages` riêng** (ví dụ `meta.novelcrafterType = "story_state_corrupted_backup"`, `isContextOnly: true`). Cách (b) không làm phình payload của `fetchStoryStateRows` ở mỗi lần GET/PUT, và không bị nhánh dọn duplicate tại `:95-101` xóa vì filter theo `novelcrafterType`.
    2. Thêm **Case 3A-5** vào TC-03A: sau Case 3A-3, gọi thêm một `saveStoryState` bình thường trên dòng vừa lành. Assert backup vẫn còn (vẫn có trong `meta` với cách (a), hoặc dòng backup không bị xóa/ghi đè với cách (b)).
    3. Cập nhật Bước 1.3 (4), §5.1 mục 3 và §9 Rủi ro #4(e) cho đồng bộ.

**[MINOR]**

- **m-19 (Lưu không có `allowDestructive` trên bản ghi hỏng vẫn có thể ghi đè mà không cần xác nhận và không có backup)**: Bước 1.3 (3) dùng `previousChars = Math.max(ciphertext.length, 2_000)` rồi áp ngưỡng `nextChars < previousChars * 0.1` (`[SRC]` `:173`). Ví dụ ciphertext dài 20.000 ký tự và draft có 3.000 ký tự: lần lưu **qua được** check destructive, cũng qua stale check nếu version không cũ, và ghi đè bản ghi hỏng mà không có backup (vì backup chỉ gắn khi `allowDestructive`). Client hiện chặn mọi autosave khi khóa nên khó xảy ra, nhưng server nên tự phòng thủ (defense in depth): khi `existingCorrupted && !allowDestructive` thì **luôn** ném 409 `DESTRUCTIVE_SAVE_REJECTED` (không dùng tỉ lệ), và tạo backup ở **mọi** lần ghi đè dòng hỏng. Nếu sửa, cập nhật thêm Case 3A-2 với `nextChars` lớn.
- **m-20 (Mảng deps của hook)**: `executeCoordinatorSave` (`:247-255`), `saveNow` (`:373-381`), `scheduleSave` (`:345-354`) và effect `visibilitychange` (`:413-420`) sẽ dùng thêm `onClearLoadError`, `loadErrorStoryIdRef`, `setStoryState`, `t`. Plan nên ghi rõ việc bổ sung các biến này vào deps để giữ 0 warnings của `react-hooks/exhaustive-deps`. `saveNow` hiện chưa có `t`/`setStoryState`/`setSaveStatus` trong deps.
- **m-21**: Khi khóa, `StoryBibleWorkspace` vẫn chạy được AI stream và chỉnh sửa bible (chỉ lưu local). Dữ liệu không mất vì sẽ được reconcile khi Retry thành công, nhưng nên ghi rõ đây là quyết định chủ đích, hoặc truyền `isLoadLocked` vào cả workspace này.

#### Kết luận

**[CHANGES_REQUESTED]**: còn 0 BLOCKER, 1 MAJOR (R-4).

Revision 6 đã đóng **R-3**. Các timeline lẫn state T-G, T-H và T-I chạy lại đều AN TOÀN. m-17 và m-18 cũng đã xử lý. Phần còn lại của plan (Redis quota, stream lifecycle, feedback merge, prompt, regex, typography, i18n, Test Contract) đạt chuẩn và không đổi so với Run 5.

Lỗi còn lại là control sao lưu ciphertext mới thêm cho m-16: nó tự triệt tiêu ở lần autosave đầu tiên (T-J), trong khi plan dùng nó làm control cho Rủi ro #4(e) mức Cao.

Việc cần làm cho Revision 7:

1. Đóng **R-4**: giữ backup qua các lần lưu (ưu tiên dòng `messages` riêng) và thêm TC-03A Case 3A-5.
2. Đồng bộ lại §3.1.5, §5.1 mục 3, §6 Bước 1.3 (4) và §9 Rủi ro #4(e).
3. (Khuyến nghị, không chặn) Xử lý m-19 → m-21.

### Audit Run 7

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-17
- **Đối tượng**: Technical Plan Revision 7 (`round: 7`, `status: Ready for Review`)

#### Baseline đã chạy

- `[CMD]` `npm run type-check` (`tsc --noEmit`) → exit 0. `HEAD` = `67a6500`, không có source nào chưa commit (chỉ `tsconfig.tsbuildinfo` và 2 file plan).
- `[CMD]` `npx vitest run src/lib/features/novelcrafter src/app/api/novelcrafter/state` → `Test Files 15 passed (15)`, `Tests 71 passed (71)`. Khớp S1.
- `[SRC]` `src/lib/features/novelcrafter/storyPersistence.server.ts:79-104`: `fetchStoryStateRows` lọc theo `.eq("meta->>novelcrafterType", NOVELCRAFTER_STATE_META_TYPE)`. Nhánh dọn duplicate tại `:95-101` chỉ xóa trong tập đã lọc, nên không chạm tới dòng `story_state_corrupted_backup`.
- `[SRC]` `storyPersistence.server.ts:242-247`: shape `insert({ conversation_id, role: "system", content, meta })` của dòng backup trong Bước 1.3 (4) giống hệt lệnh insert `story_state` đang có. Không cần cột mới, migration hay thay đổi RLS (dùng `getSupabaseAdmin`, `:7`). `docs/database-schema.md` §2.4: `role TEXT NOT NULL`, không có CHECK constraint giới hạn giá trị.
- `[SRC]` `storyPersistence.server.ts:186`: `nextVersion = Math.max(sanitized.version, existingVersion) + 1`. Case 3A-3 (incoming v1, existing v2) → v3, và Case 3A-5 (incoming v3) → v4. Kỳ vọng của Test Contract khớp với code.
- `[CMD]` `grep from("messages") src`: các loader tổng quát đọc mọi dòng của conversation (`src/lib/features/chat/messages.ts:333-343` `getMessages`) đều đi qua `mapMessageRow` (`:93-102`). Hàm này bọc `decryptText` trong `try/catch` và chỉ `warn`, nên một dòng backup không giải mã được **không** làm crash loader. Dòng backup có `isContextOnly: true` nên được UI chat ẩn giống dòng `story_state` (`useConversationSelectors.ts:26`, `useChatStreamController.ts:147`).
- `[SRC]` `src/lib/features/novelcrafter/storyPersistence.server.test.ts:32-102`: mock Supabase hỗ trợ `insert` (`unshift`, `:51-66`), `update(...).eq(id)` (`:67-77`) và filter `story_state` (`:42-45`). Case 3A-3 và 3A-5 chạy được trên mock hiện có mà không cần đổi hạ tầng test.
- `[CMD]` grep i18n: 3 khóa `novelcrafterCorruptedState*` chưa tồn tại trong `vi.ts`/`en.ts`, nên không bị trùng. Các khóa `novelcrafterConflictBackupNotice`, `novelcrafterLoadError`, `novelcrafterDefaultChapterTitle` mà `saveNow` dùng đều đã có ở cả 2 locale.

#### Kiểm chứng lỗi cũ (so với Run 6)

| Mã   | Trạng thái       | Ghi chú kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-4  | **Đã khắc phục** | Plan chọn cách (b) theo khuyến nghị: §3.1.5 mục 5, §5.1 mục 3, §6 Bước 1.3 (4), Timeline 4 T2 và §9 Rủi ro #4(e) đã đồng bộ. Hằng `NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE` được export. Dòng backup được `insert` **trước** `update` dòng chính. Nếu insert lỗi thì ném `DatabaseError` và **không** ghi đè (fail-closed). TC-03A đã có Case 3A-5: lưu thường v4, sau đó `getStoryState`, rồi assert dòng backup vẫn nguyên `content`. Chạy lại T-J → AN TOÀN (xem dưới). |
| m-19 | **Đã khắc phục** | Bước 1.3 (3): khi `existingCorrupted && !allowDestructive` thì **luôn** ném 409 `DESTRUCTIVE_SAVE_REJECTED`, không phụ thuộc tỉ lệ 10%. Case 3A-2 dùng `"A".repeat(5_000)` để phủ đúng trường hợp `nextChars` lớn. Vì backup chỉ tạo khi `allowDestructive`, mọi lần ghi đè dòng hỏng đều có backup.                                                                                                                                                                       |
| m-20 | **Đã khắc phục** | §5.1 mục 14/15 và Bước 1.3 đã liệt kê deps mới cho `scheduleSave`, `executeCoordinatorSave`, `saveNow`, effect `visibilitychange` (`:413-420`) và effect tải story (`useNovelcrafterStory.ts:249`). Đối chiếu `[SRC]` `useStoryPersistenceLifecycle.ts:345-354,373-381,413-420`: line refs đúng. `isRetryingLockedStoryRef`, `dirtyStoryIdsRef` và `setDestructivePrompt` là ref/setter cục bộ của hook (`:70-74`) nên không cần đưa vào deps.                             |
| m-21 | **Đã khắc phục** | Truyền `isStreaming={isStreaming \|\| Boolean(isLoadLocked)}` vào `<InlineStoryBibleSection />` (`[SRC]` `ChapterEditorWorkspace.tsx:541`). Prop này đi tiếp xuống `StoryBibleWorkspace` (`[SRC]` `InlineStoryBibleSection.tsx:105`), cộng thêm guard `if (isStreaming) return;` ở `handleRunAi`, nên AI stream của Story Bible bị khóa khi load-lock. Chỉnh sửa thủ công vẫn lưu local và được reconcile khi Retry; plan đã ghi rõ đây là quyết định chủ đích.            |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1 Cold-start & Build**    | **PASS** | `[CMD]` type-check exit 0, 15 files/71 tests pass. Không thêm dependency, biến `.env` hay migration. Các import mới (`NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE` khai báo cùng file; `DatabaseError` đã import sẵn tại `storyPersistence.server.ts:10`) không tạo module chưa tồn tại. Số lượng file khớp: 36 `[MODIFY]` và 6 `[NEW]`.                                                                                                                                                                                     |
| **S2 Lifecycle & Teardown**  | **PASS** | Không đổi so với Run 6. Ref single-flight dùng `try/finally`, timer được hủy qua `cancelPendingSaveTimers()`, và vòng đời SSE/AbortController giữ nguyên như đã xác minh ở Run 5–6.                                                                                                                                                                                                                                                                                                                                      |
| **S3 Database & Temporal**   | **PASS** | `[ADV]` T-J và T-K (dưới) → AN TOÀN. Dòng backup nằm ngoài filter `story_state` (`[SRC]` `:85`), nên không bị `update` (`:204-240`) hay dọn duplicate (`:95-101`) đụng tới. Conditional update `.eq("meta->>version", …)` (`:224-232`) vẫn chặn ghi đồng thời. Trường hợp xấu nhất là một dòng backup thừa (xem m-22), **không** mất dữ liệu. Trục serverless: N/A, không có state in-memory mới phía server.                                                                                                            |
| **S4 Cross-Task State Flow** | **PASS** | Không đổi so với Run 6. `[ADV]` T-G, T-H và T-I vẫn AN TOÀN vì phần client của Revision 7 không thay đổi logic owner guard, snapshot hay scope `clearLoadErrorForStory`.                                                                                                                                                                                                                                                                                                                                                 |
| **S5 Security Boundary**     | **PASS** | Không đụng auth, `service_role` hay RLS. Dòng backup được ghi bằng admin client phía server, **sau** `verifyNovelcrafterConversationOwnership` (`[SRC]` `:140`), và gắn với đúng `conversation_id` đã được kiểm tra ownership. Không có API nào trả dòng backup về client. Loader chat tổng quát chỉ thấy một dòng ẩn `isContextOnly` có content không giải mã được (`mapMessageRow` trả về ciphertext thô thay vì crash). Đây đúng là hành vi hiện tại với dòng `story_state` hỏng, nên không phát sinh lộ dữ liệu mới. |
| **S6 External Resilience**   | **PASS** | Không đổi so với Run 6: chỉ trừ quota khi có `type === "token"`, TTL in-flight 360s > `maxDuration` 300s, SSE `error` đi qua `sanitizeError(err, true)`.                                                                                                                                                                                                                                                                                                                                                                 |

#### Adversarial Timelines bổ sung (reviewer)

```
T-J (chạy lại trên Revision 7) — Cơ chế: độ bền của backup ciphertext qua các lần lưu kế tiếp
T1: Preview dùng DATA_ENCRYPTION_KEY lệch → GET A → STORY_STATE_CORRUPTED → khóa
T2: Retry → overwrite_prompt → xác nhận → saveStoryState(allowDestructive)
    → insert dòng { novelcrafterType: "story_state_corrupted_backup", content: <ciphertext gốc> } → update dòng story_state lên v3
T3: User gõ tiếp → autosave v4, v5… → fetchStoryStateRows chỉ thấy dòng story_state → update đúng dòng đó
Kết cục: dòng backup còn nguyên vĩnh viễn, có thể khôi phục khi sửa lại khóa đúng → AN TOÀN (R-4 đã đóng, TC-03A Case 3A-5)
```

```
T-K — Cơ chế: insert backup thành công nhưng update dòng chính thất bại (thất bại giữa chừng)
T1: Tab A xác nhận ghi đè dòng hỏng (meta.version = 2) → insert backup #1 OK
T2: Trước khi A update, Tab B cũng xác nhận ghi đè → insert backup #2 → update .eq(meta->>version, "2") → OK → v3
T3: A update .eq(meta->>version, "2") → 0 dòng → AppError 409 STALE_STORY_STATE → client chạy conflict recovery
Kết cục: dòng chính = nội dung của B (đã được user B xác nhận). Ciphertext gốc có 2 bản backup giống nhau.
         Không mất dữ liệu, chỉ thừa một dòng → AN TOÀN (ghi nhận m-22)
```

```
T-L — Cơ chế: insert backup lỗi (Supabase tạm thời)
T1: Xác nhận ghi đè → insert backup trả error
T2: Server log + ném DatabaseError → KHÔNG gọi update
Kết cục: dòng hỏng vẫn nguyên (fail-closed). Client nhận lỗi lưu, story vẫn khóa, user có thể Retry → AN TOÀN
```

#### Phân loại lỗi

**[BLOCKER]**

- Không có.

**[MAJOR]**

- Không có.

**[MINOR]**

- **m-22 (Backup có thể bị trùng)**: Mỗi lần xác nhận ghi đè đều `insert` một dòng backup, kể cả khi lần `update` ngay sau đó bị 409 `STALE_STORY_STATE` (T-K) hoặc user Retry nhiều lần sau lỗi mạng. Không mất dữ liệu, nhưng có thể tạo nhiều dòng giống nhau. Nếu muốn: trước khi insert, `select` kiểm tra đã có backup với cùng `meta->>sourceRowId` và `meta->>corruptedVersion` chưa, có rồi thì bỏ qua.
- **m-23 (Mock filter trong test là tautology một phần)**: Mock `select().eq().eq()` tại `storyPersistence.server.test.ts:39-45` bỏ qua `_typeVal` và hardcode `"story_state"`. Vì vậy vế "không bị dọn duplicate xóa" của Case 3A-5 đúng sẵn theo cách dựng mock, không chứng minh được filter thật. Assert `meta.novelcrafterType === "story_state_corrupted_backup"` ở Case 3A-3 vẫn bắt được lỗi ghi nhầm type, nhưng nên cho mock so khớp theo `_typeVal` để test phản ánh đúng query thật.
- **m-24 (Ghi chú vận hành)**: Dòng backup không có TTL hay dọn dẹp, và tồn tại tới khi conversation bị xóa. Nên ghi vào `docs/database-schema.md` hoặc runbook cách tìm (`meta->>novelcrafterType = 'story_state_corrupted_backup'`) và khôi phục bằng đúng khóa. Nên cập nhật mô tả cột `role` (§2.4 hiện chỉ ghi `user`/`assistant`, trong khi code đã dùng `system`).

#### Kết luận

**APPROVED**: còn 0 BLOCKER, 0 MAJOR, 3 MINOR (m-22 → m-24, không chặn).

Revision 7 đã đóng **R-4** bằng cách ghi backup vào dòng `messages` riêng, nằm ngoài filter `story_state`, theo hướng fail-closed và có Case 3A-5 kiểm chứng. Chạy lại T-J cho kết quả AN TOÀN, và T-K, T-L cũng không làm mất dữ liệu. m-19, m-20 và m-21 đã được xử lý trọn vẹn. Mọi rủi ro Cao/Trung bình ở §9 đều đã ánh xạ tới control trong `src/lib/features/` kèm Test Contract tương ứng (evidence-bar §4.5.4). Các lỗi R-1 → R-4 tích lũy qua Run 1–6 đều đã đóng.

Khi triển khai, `@developer` cần chạy đủ §8.2 (`npx vitest run …` và `npm run verify`). Các MINOR m-22 → m-24 có thể xử lý trong lúc implement hoặc để lại cho đợt sau.

[PLAN_APPROVED]
