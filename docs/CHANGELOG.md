# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

> [!NOTE]
> Các bản ghi lịch sử phát hành cũ hơn ngày 2026-09-10 được lưu trữ nguyên vẹn tại [CHANGELOG Legacy Archive](./archive/CHANGELOG-legacy.md).

---

## 2026-10-01: Audit Remediation Phase 1 -- Security, Admin Dashboard & Core Fixes

- **Pillar 1: Security Hardening & Zero-Trust Tenant Isolation**:
  - **SEC-01 (IDOR & Storage Traversal)**: Bổ sung xác thực quyền sở hữu `userId` qua 4 điểm sink (`deleteMessage`, `deleteMessageByClientMessageId`, `deleteMessagesIncludingAndAfter`, `/api/gallery/[id]`) và `conversationLoader.ts`. Tạo module `src/lib/features/chat/storageCleanup.ts` kiểm tra nghiêm ngặt tiền tố `${userId}/` và loại trừ directory traversal `..` trước khi gọi `storage.remove()`. Co-located test: `storageCleanup.test.ts` (4 tests).
  - **SEC-02 (RAG Cross-Tenant Context Leak)**: Thêm `.eq("user_id", userId)` vào `getConversationProjectId` trong `ragContext.server.ts`. Bổ sung kiểm tra quyền sở hữu project trước khi gọi `generateEmbedding` và RPC `match_project_knowledge` trong `knowledge.server.ts`. Co-located test: `ragContext.server.test.ts` (11 tests), `knowledge.server.test.ts` (17 tests).
  - **SEC-03 (SSRF Defense)**: Tạo `src/lib/core/ssrfGuard.server.ts` với `fetchSafeImage`. Sử dụng `dns.promises.lookup` và `net.BlockList` ngăn chặn IP loopback, private RFC 1918, link-local, cloud metadata (`169.254.169.254`), CGNAT, ULA và IPv4-mapped IPv6. Manual redirect tối đa 3 hops, tổng deadline 10s, giới hạn streaming 10MB và hủy socket với `body.cancel()`. Bảo vệ `/api/describe-image` và `/api/edit-image`. Co-located test: `ssrfGuard.server.test.ts` (19 tests).
  - **SEC-04 (Safe Math Parsing & Injection Defense)**: Thay thế hoàn toàn `new Function` trong chat function registry `calculate` bằng `src/lib/features/chat/mathParser.ts` (Recursive Descent Parser). Hỗ trợ toán tử `+,-,*,/,%,^,**`, toán tử âm `-(2^2) = -4`, giới hạn lũy thừa `[-50, 50]` và danh sách allowlist hàm `Math`. Co-located test: `mathParser.test.ts` (20 tests), `functionRegistry.test.ts` (6 tests).
- **Pillar 2: Admin Dashboard Integrity & PostgREST Counting**:
  - **ADM-01 & ADM-02 (User Identity & Stats Counting)**: Hỗ trợ cả canonical email và UUID trong `/api/admin/users`. Tra cứu hồ sơ theo ID rồi fallback sang canonical email, cập nhật theo `targetProfile.id` và bump token version theo canonical email. Sửa `/api/admin/stats` chuẩn hóa email lowercase và đếm tin nhắn qua PostgREST join `messages` với `conversations!inner(user_id)`. Co-located test: `admin/users/route.test.ts` (15 tests), `admin/stats/route.test.ts` (5 tests).
  - **ADM-03 (Rank Configs Boundary Validation)**: Ràng buộc số nguyên `int4` `[0, 2147483647]` trên `daily_message_limit`, `max_file_size_mb`, `daily_research_limit` trong `/api/admin/rank-configs`. Đưa `daily_research_limit` vào payload update CSDL. Cập nhật `RankConfigManager.tsx` với fallback an toàn chống `NaN` và vượt ngưỡng int4. Co-located test: `admin/rank-configs/route.test.ts` (16 tests).
- **Pillar 3: Gallery Database Pagination & UI Polish**:
  - **API-01 & API-02 (Gallery Database-Level Pagination)**: Chuyển đổi truy vấn `/api/gallery` sang join PostgREST `messages` với `conversations!inner(user_id, model)` kèm lọc ảnh JSONB, sắp xếp `created_at.desc, id.desc` và phân trang `.range(offset, offset + limit)` trực tiếp tại CSDL, ngăn ngừa tải toàn bộ messages vào RAM. Bao gồm hình ảnh sinh từ Image Studio. Co-located test: `api/gallery/route.test.ts` (22 tests).
  - **UI-01 (CommandPalette Theming)**: Thêm key song ngữ `switchTheme` vào `vi.ts`/`en.ts`. Kết nối lệnh switch theme với hook `useTheme:toggleTheme()`, ngăn chặn reset biến màu CSS. Co-located test: `CommandPalette.test.tsx` (5 tests).
  - **UI-02 (GalleryView Modal Close Button)**: Bổ sung icon `<X />`, `aria-label`, tooltip và focus ring cho nút đóng modal chi tiết ảnh. Co-located test: `GalleryView.test.tsx` (2 tests).
- **Quality Gate & Verification**:
  - 89 test files passed, 975 tests passed (tăng từ 892 lên 975 tests, 0 failed).
  - `npm run type-check`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - Cập nhật living documentation `docs/database-schema.md` (mô tả `profiles.id` là canonical email).

---

## 2026-10-01: Foldable Responsive Design, DeepSeek Thinking Recovery & Avatar Enhancement

- **Pillar 1: Foldable & Special Aspect Ratio Responsive Overhaul**:
  - `viewportFit: "cover"` trong `src/app/layout.tsx`. Khai báo CSS custom properties cho Safe Area Insets (`--sat`, `--sar`, `--sab`, `--sal`) và `@media (max-height: 500px)` trong `src/app/styles/themes/_shared/base.css`.
  - Thay thế toàn bộ giả định `h-screen w-screen` bằng `h-dvh w-full overflow-hidden` trên `ChatApp.tsx`. Container query `@container/chat` và padding an toàn trên `scrollRef`, floating controls, `ScrollToBottomButton`, và `ChatControls`.
  - Đồng bộ safe area insets trục ngang (`calc(5rem + var(--sal, 0px))` và `calc(18rem + var(--sal, 0px))` kèm `pr-[var(--sar,0px)]`) cho cả 2 trạng thái aside desktop và mobile drawer trong `Sidebar.tsx`, cùng 3 view vệ tinh dùng chung (`GalleryView.tsx`, `ImageGenStudio.tsx`, `DescribeImageView.tsx`).
  - Cập nhật `dialog.tsx` và `alert-dialog.tsx` với `max-h-[calc(100dvh-2rem)] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full`.
- **Pillar 2: DeepSeek Stream Optimization & 1-Click Thinking Recovery**:
  - Nâng trần `maxOutputTokens` cho `deepseek-v4-pro` từ 16.384 lên `65536` trong `src/lib/core/modelRegistry.ts`.
  - Tạo mới module typed request builder `src/app/api/chat-stream/streaming/deepseek-request-builder.ts`: chuẩn hóa `reasoning.effort` sang `"high"` / `"xhigh"`, định tuyến OpenRouter fallback providers (`Relace`, `Together`, `Novita`, `DeepSeek`), và dọn sạch 100% `any`. Co-located test: `deepseek-request-builder.test.ts` (9 tests).
  - Khắc phục phản hồi rỗng hoàn toàn 0 delta: server phát event SSE `error` `{ code: "empty_response", status: 502 }`, hiển thị banner song ngữ qua `StreamErrorBanner.tsx`.
  - Cơ chế Thinking Recovery Card 1-Click: Khi stream cạn token chỉ có suy nghĩ mà không có câu trả lời, server phát meta event `emptyAnswerNotice` và lưu DB. Client render `EmptyReasoningNotice.tsx` với nút "Tạo lại" và "Tạo lại với suy nghĩ thấp hơn" (tính toán qua `getLowerThinkingLevel`). Backward-compatible với tin nhắn DB cũ qua `parseLegacyNotice`.
  - Co-located tests: `useThinkingLevel.test.ts` (7 tests), `EmptyReasoningNotice.test.tsx` (5 tests), `legacyNotice.test.ts` (4 tests).
- **Pillar 3: High-Fidelity Model Brand Icons & Thinking/Streaming Avatar Animations**:
  - Nâng cấp `ModelAvatar.tsx`: Bộ SVG nhận diện chính hãng với multi-stop brand gradients (Gemini 4-color, Claude Terracotta, DeepSeek Ocean Cyan, OpenAI Emerald, Groq Flame, Generic Brain Violet). Bảo vệ chống xung đột gradient DOM ID thông qua `React.useId()`. Co-located test: `ModelAvatar.test.tsx` (8 tests).
  - Nâng cấp `BubbleAvatar.tsx`: Áp dụng vật lý chuyển động Emil Kowalski, cấu trúc 4-state Precedence (`loading` > `thinking` > `streaming` > `idle`) với thuộc tính DOM `data-state`. Trạng thái suy nghĩ Breathing Pulse (chu kỳ 2.0s, scale [1, 1.05, 1], opacity [0.85, 1, 0.85], aura glow). Gating chống áp dụng hiệu ứng cho tin nhắn lịch sử. Co-located test: `BubbleAvatar.test.tsx` (17 tests).
- **Quality Gate & Verification**:
  - 82 test files passed, 892 tests passed (tăng từ 850 lên 892 tests, 0 failed).
  - `npm run type-check`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - Grep probe xác nhận 0 occurrences của `h-screen` trong `ChatApp.tsx`.

---

## 2026-10-01: Update DeepSeek V4.1 Flash Provider Metrics (Relace)

- **Provider Verification & Metrics Sync**: Xác thực cấu hình OpenRouter provider ưu tiên của DeepSeek V4.1 Flash (`deepseek/deepseek-v4.1-flash`) là Relace (`order: ["Relace"]`). Cập nhật thông số chi phí ($0.02/M input, $0.60/M output, $0.02/M cache read) và hiệu năng (latency 1.12s, throughput 51 tps, uptime 99.98%) trong tài liệu kỹ thuật `docs/models.md`. Toàn bộ 5/5 unit tests của `deepseek-stream.test.ts` và 850/850 tests toàn dự án đều pass.

---

## 2026-10-01: File Upload & Chat Attachments System Overhaul

- **Binary Storage Key Fix [C4]**: Chuẩn hóa đường dẫn Supabase Storage chỉ chứa pure ASCII: `${userId}/${conversationId}/${uuid}.${safeExt}`. Giữ nguyên 100% tên file tiếng Việt gốc có dấu trong bảng PostgreSQL `files.filename`.
- **Clean Document Text Extraction [C1 & M7]**:
  - Tích hợp bộ parser tài liệu sạch `src/lib/features/files/documentParsers.ts`: DOCX (`mammoth`), XLSX (`exceljs`), PDF (`pdf-parse` v2 với page cap 200 trang và parser cleanup trong `finally`), text UTF-8, loại bỏ ký tự rác nhị phân NUL (`\u0000`). Chặn hoàn toàn binary garbage / OLE2 (`.doc`, `.xls`, `.ppt`).
  - Tạo migration SQL `database-migrations/20261001000000_clean_corrupted_extracted_text.sql` dọn sạch cache rác nhị phân cũ.
- **Multi-turn Context Injection & Gemini ACTIVE Polling [C2, C3, C5]**:
  - Tái cấu trúc `attachmentProcessor.ts` và `contextBuilder.ts`: chấm dứt việc nhồi toàn bộ 30 file cũ vào `contents[0]`. File của từng message được định tuyến chính xác vào đúng turn tương ứng thông qua `contentsMeta` từ `messages.meta.fileIds`.
  - Phân luồng native multimodal cho Gemini models với Gemini Files API, polling trạng thái `ACTIVE` cho file lớn/video qua `waitForGeminiFileActive` với timeout 15s và AbortSignal. Fallback an toàn sang inline base64 cho hình ảnh và text cho tài liệu.
  - Tính toán token budget chính xác dựa trên `estimateTokens` (chuẩn hóa Unicode tiếng Việt). Chống IDOR triệt để qua kiểm tra `listFiles` theo tenant `userId` + `conversationId`.
- **Draft Conversation Coordinator cho New Chat [U1, MAJOR-7]**:
  - Tạo `src/lib/features/chat/draftConversation.ts` với predicate `shouldClearQueue` và `createDraftCoordinator`.
  - Cho phép người dùng chọn file / drag-drop / paste ngay khi ở trạng thái New Chat (`conversationId === null`). Hàng đợi upload không bị xóa oan khi conversationId chuyển từ `null -> newId`.
- **Database Relationship Synchronization [M1]**:
  - Bổ sung `linkFilesToMessage(userId, conversationId, fileIds, messageId)` trong `fileService.server.ts` với tenant filters an toàn, liên kết `files.message_id` với `messages.id` sau khi lưu user message.
- **Mobile Touch UX & Bilingual i18n [U2, U3, U4]**:
  - Sửa nút xóa file trên `FilePreviewCard.tsx`: bổ sung `pointer-coarse:opacity-100` và kích thước tối thiểu 24×24px tuân thủ WCAG 2.2 cho màn hình cảm ứng.
  - Bổ sung 6 translation keys thiếu vào `src/lib/utils/translations/vi.ts` và `en.ts` (`dropFilesHere`, `confirmClearAll`, `clearAllFiles`, `filesCleared`, `deleteFileFailed`, `noFilesUploaded`). Truyền `t` đối xứng cho `FileLightbox` và `FileManagerPanel`.
- **Co-located Test Suite & Verification**:
  - Bổ sung 5 file test co-located mới: `tokenEstimate.test.ts` (7 tests), `documentParsers.test.ts` (13 tests), `fileValidation.test.ts` (12 tests), `fileService.server.test.ts` (4 tests), `draftConversation.test.ts` (7 tests), `attachmentProcessor.test.ts` (4 tests).
  - Verification: 77 test files passed, 850 tests passed, 0 lint warnings, 0 type errors.

---

## 2026-09-30: Comprehensive UI/UX Audit & Modernization Implementation (Phases 0–3)

- **Phase 0 (Critical P0 Bug Fixes & UX Blockers)**:
  - **LazyModals & Modal Confirm Fix (TC-01)**: Tách `LazyModals.tsx` với latch pattern chống tải thừa modal bundle, chuyển `GemModal` và `PersonaModal` sang `confirm()` từ `confirmStore` với `variant: "danger"` và re-entrancy lock `isConfirmingRef`. Co-located unit tests: `GemModal.test.tsx` (3 tests), `PersonaModal.test.tsx` (3 tests).
  - **Semantic Z-Scale & Glassmorphism Theme Fixes**: Bổ sung thang z-index ngữ nghĩa (`--z-drawer: 60`, `--z-modal: 70`, `--z-popover: 75`, `--z-toast: 80`, `--z-banner: 90`), sửa lỗi các themes glassmorphism (`nebula`, `aqua`, `holo`, `orchid`, `sunset`) tách biệt solid fallback `--surface` và `--surface-gradient`. Đồng bộ z-index trên toàn bộ primitives (`dialog`, `popover`, `select`, `tooltip`, `dropdown-menu`, `alert-dialog`, `IconPicker`, `ToastContainer`, `StreamErrorBanner`, `Sidebar`).
  - **Dead Token Eradication (TC-04)**: Quét sạch 0 occurrences các CSS tokens chết trên toàn bộ `src/`: `--text-muted` -> `--text-secondary`, `--surface-base` -> `--surface`, `--surface-hover` -> `--control-bg-hover`, `--border-hover` -> `--control-border`, `--text-tertiary` -> `--text-secondary`, `--primary-hover` & `--primary-foreground` -> `bg-(--accent) text-(--accent-foreground) hover:brightness-110`.
  - **Language Hydration & Side-Effect Explosion Fix (TC-07)**: Sửa `LanguageUpdater.tsx` theo chuẩn read-first, write-after latch pattern `const [hasHydrated, setHasHydrated] = useState(false)` chống ghi đè cài đặt tiếng Việt thành tiếng Anh khi reload. Loại bỏ side-effect ghi đè `localStorage` trong `useLanguage.ts` (loại bỏ 71 re-writes trên mount). Co-located test: `LanguageUpdater.test.tsx` (2 tests).
  - **Navigation & Error Feedback (TC-06, TC-08, TC-09)**: Sửa điều hướng deep research gọi `setSelectedConversationIdAndUrl(id)`. Thêm `toast.error()` và `logger.error()` với symmetric translation keys vào `KnowledgePanel.tsx`, `ProjectNode.tsx`. Khóa `isSubmittingRef` chống double-submit trong `InputForm.tsx`.
- **Phase 1 (Safe P1 - Performance & Modular Extraction)**:
  - **Typewriter Module (TC-02)**: Tạo `src/lib/features/chat/typewriter.ts` với hàm thuần `computeCharsToTake`, hằng số `BASE_CHARS_PER_TICK = 2`, `MIN_INTERVAL_MS = 30`. Co-located test: `typewriter.test.ts` (5 tests). Tạo hook `useTypewriterBuffer.ts` tích hợp vào `useChatStreamController.ts`.
  - **Virtualization Module & useChatScroll (TC-03a,b,c,d)**: Tạo `src/lib/features/chat/virtualization.ts` (prefix-sum `createSizeCache`, `computeVisibleRange`, `calculateVirtualPadding`, conditional `computeScrollCompensation`). Feature flag: `ENABLE_VIRTUALIZED_CHAT = false` an toàn trong `constants.ts`. Co-located test: `virtualization.test.ts` (5 tests). Cập nhật `useChatScroll.ts` với `isAtBottom`, `unreadCount`, `scrollToBottom`.
  - **ChatMessagesArea Component Extraction**: Tách khối render danh sách tin nhắn từ `ChatApp.tsx` thành `src/app/features/chat/components/ChatMessagesArea.tsx` (280 dòng), hỗ trợ cả chế độ ảo hóa lẫn fallback map, bao bọc toàn bộ logic hiển thị tin nhắn, nhánh hội thoại, ngữ cảnh ẩn, và streaming bubble. Co-located test: `ChatMessagesArea.test.tsx` (4 tests).
  - **Markdown & HeaderBar Optimization**: Hoãn thực thi `rehypeHighlight` trong `BubbleMarkdown.tsx` khi `isStreaming` đang chạy để tránh lag main-thread. Thay thế `next/dynamic` bằng direct Lucide icon imports trong `HeaderBar.tsx` tránh layout shift FOIC.
- **Phase 2 (P2 - Accessibility & UI Polish)**:
  - Nâng cấp typography <12px thành `text-xs` (12px) trên `ChatApp.tsx`, `HeaderBar.tsx`.
  - Bổ sung `aria-expanded` và `aria-label` cho `SidebarSection.tsx` và `SidebarItem.tsx`.
  - Tạo `ScrollToBottomButton.tsx` với icon ChevronDown, badge số lượng tin nhắn chưa đọc, animation Framer Motion. Co-located test: `ScrollToBottomButton.test.tsx` (4 tests).
- **Phase 3 (P3 - Feature Enhancements)**:
  - **Command Palette (`Cmd+K` / `Ctrl+K`)**: Tạo `src/app/features/chat/components/CommandPalette.tsx` hỗ trợ tìm kiếm nhanh tác vụ (New chat, Switch theme, Change language, Keyboard shortcuts) và nhảy nhanh đến các cuộc trò chuyện gần đây qua bàn phím. Co-located test: `CommandPalette.test.tsx` (4 tests).
  - **Keyboard Shortcuts Modal (`?`)**: Tạo `src/app/features/chat/components/KeyboardShortcutsModal.tsx` hiển thị bảng phím tắt tiện ích chuẩn Vikini. Co-located test: `KeyboardShortcutsModal.test.tsx` (2 tests).
  - Bổ sung đầy đủ cặp từ khóa đa ngôn ngữ đối xứng (`commandPalette`, `keyboardShortcuts`, v.v.) trong `vi.ts` và `en.ts`.
- **Quality Gates Verification**:
  - `npm run type-check`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run test:run`: 71 test files passed, 803 tests passed, 0 failures.
  - `npm run build`: Production build thành công 100% (22 static/dynamic routes).

---

## 2026-09-29: Docs, Rules & Agents Restructuring (Revision 6)

- Tái cấu trúc toàn diện thư mục docs và hạ tầng tác tử theo chuẩn Diátaxis và Agent-Ready 2026.
- Tạo mới navigation hubs: docs/README.md, .agents/README.md, .agents/skills/README.md.
- Cắt giảm dung lượng CHANGELOG.md từ 138 KB xuống ~33.5 KB; lưu trữ 74 mục cũ sang docs/archive/CHANGELOG-legacy.md.
- Hợp nhất context.md vào overview.md; chuyển model routing guide sang .agents/README.md.
- Chuẩn hóa toàn bộ tham chiếu nội bộ sang tiền tố .agents/ và sửa lỗi chính tả trong tiền tố quy tắc tác tử.
- Dọn dẹp thư mục rác reviewer backup và chuẩn hóa tài liệu superpowers cũ sang docs/specs/ và docs/archive/plans/.

## 2026-09-29: Supabase CLI TypeGen Automation & Immutable Gemini Embedding 2 Migration

- **Supabase CLI & Type Generation Automation**:
  - Nâng cấp `supabase` CLI trong `devDependencies` lên `v2.118.0`.
  - Thiết lập lệnh `npm run db:types` tự động sinh file `src/types/database.types.ts` trực tiếp từ schema remote Supabase.
  - Cấu hình `.gitignore`, `.prettierignore`, và `eslint.config.mjs` bảo vệ file types tự sinh.
- **Thống Nhất Mô Hình Embedding Duy Nhất `gemini-embedding-2` (3072d)**:
  - Loại bỏ hoàn toàn `text-embedding-004` (đã deprecate/ngừng hỗ trợ), thống nhất duy nhất `gemini-embedding-2` (API endpoint: `gemini-embedding-2-preview`) với số chiều cố định 3072.
  - Tạo migration DDL `supabase/migrations/20260928180000_unify_gemini_embedding_2.sql` bọc trong transaction `BEGIN; ... COMMIT;`:
    - Đánh dấu `status = 'error'` cho các documents có chunks bị lệch số chiều.
    - Xóa sạch các chunks ≠ 3072 chiều.
    - Khóa cứng số chiều cột qua `ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE VECTOR(3072);`.
    - Đặt `NOT NULL`, `DEFAULT 'gemini-embedding-2'`, và `CHECK` constraint trên cả 2 bảng `projects` và `knowledge_documents`.
    - Cập nhật RPC `match_project_knowledge` giữ nguyên 100% chữ ký và cột trả về `filename TEXT`, bổ sung guard `vector_dims(kc.embedding) = 3072`.
- **Sửa Lỗi Native Batching Của Google GenAI SDK (`@google/genai` 2.10.0)**:
  - Khắc phục lỗi SDK tự động gộp mảng `string[]` thành 1 user Content duy nhất dẫn đến việc Gemini chỉ trả về 1 vector cho cả batch.
  - Chuyển sang định dạng Content parts chuẩn xác: `contents: subBatch.map((text) => ({ role: "user", parts: [{ text }] }))`.
  - Phân định rõ ràng chiến lược retry: Search query retry tối đa 1 lần, Batch upload retry tối đa 3 lần với exponential backoff.
- **Bảo Vệ Tính Bất Biến & Type Safety (Strict 400 Rejection)**:
  - Nghiêm cấm client truyền `embedding_model` qua API routes (`POST /api/projects`, `PATCH /api/projects/[id]`, `POST /api/projects/[id]/knowledge`), lập tức trả về HTTP 400 `ValidationError`.
  - Triển khai singleton typed client `getTypedSupabaseAdmin()` bảo toàn 100% fallback biến môi trường `pickFirstEnv`.
  - Xây dựng mapper function `toProject(row)` bảo vệ toàn bộ dữ liệu trả về khỏi kiểu `string | null` của Supabase CLI.
  - Giữ nguyên singleton client untyped `getSupabaseAdmin()` tại `knowledge.server.ts` để tương thích hoàn hảo với `ChunkMetadata`.
- **Pre-Insert Validation & 2 Tầng Hook Dọn Dẹp (Auto-Cleanup)**:
  - Giới hạn tải: File tối đa 5MB, tài liệu tối đa 500 chunks (~350–400 KB text) được validate TRƯỚC KHI insert DB nhằm tránh rò rỉ quota tài liệu.
  - Bổ sung hàm `cleanupStuckProcessingDocuments()` tự động đánh dấu lỗi các tài liệu kẹt trạng thái `processing` quá 15 phút.
  - Tích hợp 2 tầng dọn dẹp: Opportunistic cleanup trong handler GET `/api/projects/[id]/knowledge` (sau khi verify project) và Cron cleanup định kỳ trong `/api/cron/cleanup` qua `Promise.allSettled`.
- **Làm Sạch UI & Bộ Từ Điển Song Ngữ**:
  - Dọn sạch UI bộ chọn model tại `CreateProjectModal.tsx` và `projectStore.ts`.
  - Xóa bỏ 4 translation keys thừa không còn sử dụng trong `vi.ts` và `en.ts`.
- **Bộ Kiểm Thử Co-Located Đạt Chuẩn 100%**:
  - Bổ sung 3 file test co-located mới:
    - [`src/lib/features/projects/embedding.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/embedding.server.test.ts) (15 tests)
    - [`src/lib/features/projects/projects.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/projects.server.test.ts) (13 tests)
    - [`src/lib/features/projects/knowledge.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.test.ts) (16 tests)
  - Cập nhật 4 test suites API routes hiện hữu: `projects/route.test.ts`, `projects/[id]/route.test.ts`, `knowledge/route.test.ts`, `cleanup/route.test.ts`.
  - Vượt qua Verification Gate Tier 2 (`npm run verify`): 59/59 test files pass, 760/760 tests pass, 0 type errors, 0 lint errors.
- **Files Modified & Added**:
  - [NEW] [`supabase/migrations/20260928180000_unify_gemini_embedding_2.sql`](file:///c:/Users/wyemh/vikini/supabase/migrations/20260928180000_unify_gemini_embedding_2.sql)
  - [NEW] [`scripts/smoke-embedding.ts`](file:///c:/Users/wyemh/vikini/scripts/smoke-embedding.ts)
  - [NEW] [`src/types/database.types.ts`](file:///c:/Users/wyemh/vikini/src/types/database.types.ts)
  - [NEW] [`src/lib/features/projects/embedding.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/embedding.server.test.ts)
  - [NEW] [`src/lib/features/projects/projects.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/projects.server.test.ts)
  - [NEW] [`src/lib/features/projects/knowledge.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.test.ts)
  - [MODIFY] [`package.json`](file:///c:/Users/wyemh/vikini/package.json)
  - [MODIFY] [`.gitignore`](file:///c:/Users/wyemh/vikini/.gitignore)
  - [MODIFY] [`.prettierignore`](file:///c:/Users/wyemh/vikini/.prettierignore)
  - [MODIFY] [`eslint.config.mjs`](file:///c:/Users/wyemh/vikini/eslint.config.mjs)
  - [MODIFY] [`src/types/projects.ts`](file:///c:/Users/wyemh/vikini/src/types/projects.ts)
  - [MODIFY] [`src/lib/core/supabase.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/supabase.server.ts)
  - [MODIFY] [`src/lib/features/projects/embedding.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/embedding.server.ts)
  - [MODIFY] [`src/lib/features/projects/projects.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/projects.server.ts)
  - [MODIFY] [`src/lib/features/projects/knowledge.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.ts)
  - [MODIFY] [`src/app/api/cron/cleanup/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/cron/cleanup/route.ts)
  - [MODIFY] [`src/app/api/projects/[id]/knowledge/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/projects/[id]/knowledge/route.ts)
  - [MODIFY] [`src/app/api/projects/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/projects/route.ts)
  - [MODIFY] [`src/app/api/projects/[id]/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/projects/[id]/route.ts)
  - [MODIFY] [`src/components/features/projects/CreateProjectModal.tsx`](file:///c:/Users/wyemh/vikini/src/components/features/projects/CreateProjectModal.tsx)
  - [MODIFY] [`src/lib/store/projectStore.ts`](file:///c:/Users/wyemh/vikini/src/lib/store/projectStore.ts)
  - [MODIFY] [`src/lib/utils/translations/en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts)
  - [MODIFY] [`src/lib/utils/translations/vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts)
  - [MODIFY] [`docs/database-schema.md`](file:///c:/Users/wyemh/vikini/docs/database-schema.md)
  - [MODIFY] [`docs/contracts.md`](file:///c:/Users/wyemh/vikini/docs/contracts.md)
  - [MODIFY] [`docs/features.md`](file:///c:/Users/wyemh/vikini/docs/features.md)
  - [MODIFY] [`docs/lessons-learned.md`](file:///c:/Users/wyemh/vikini/docs/lessons-learned.md)

## 2026-09-28: Fix Streaming Abort and Interruption Text Loss with Partial Persistence

- **Streaming Abort & Disconnection Text Loss Fix**:
  - Resolved issue where clicking Stop (red square button) or experiencing connection drops/timeouts caused streamed response text to vanish from the chat interface.
  - Implemented client-side partial message finalization with state preservation (`isPartial: true`, `aborted: true`) and seamless background sync via `POST /api/messages`.
  - Added "Complete beats Partial" rule in `upsertMessage` to guarantee completed answers are never accidentally downgraded by delayed partial syncs.
  - Added an in-memory tombstone cache with 60-second TTL to prevent late-arriving stream chunks or aborted responses from resurrecting deleted or regenerated messages.
  - Added server-side stream abort detection across all 4 providers (Gemini, Anthropic, OpenAI, DeepSeek) with safety nets before `processPostStream` and in exception handlers.
  - Balanced `<think>` tags via `ensureBalancedThinkTags` so unclosed reasoning blocks do not corrupt Markdown rendering when interrupted.
  - Added "Tiếp tục" (Continue) action button and prompt extension for interrupted assistant messages, along with UI status badges ("Đã dừng", "Bị gián đoạn", "Đang lưu...", "Lưu thất bại — Thử lưu lại").
- **Files Modified & Added**:
  - [NEW] [`src/lib/features/chat/thinkTags.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/thinkTags.ts) & [`thinkTags.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/thinkTags.test.ts)
  - [NEW] [`src/lib/features/chat/messageMerge.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messageMerge.ts) & [`messageMerge.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messageMerge.test.ts)
  - [NEW] [`src/app/api/messages/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/messages/route.ts) & [`route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/messages/route.test.ts)
  - [NEW] [`src/app/api/chat-stream/streaming/gemini-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.test.ts)
  - [NEW] [`src/app/features/chat/components/hooks/useChatStreamController.test.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatStreamController.test.ts)
  - [MODIFY] [`src/lib/features/chat/messages.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messages.ts) & [`messages.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messages.test.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/gemini-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/anthropic-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/anthropic-stream.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/openai-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/openai-stream.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts)
  - [MODIFY] [`src/app/features/chat/components/hooks/useChatStreamController.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatStreamController.ts)
  - [MODIFY] [`src/app/features/chat/components/ChatBubble.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx)
  - [MODIFY] [`src/app/features/chat/components/MessageActions.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/MessageActions.tsx)
  - [MODIFY] [`src/app/features/chat/components/ChatApp.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx)
  - [MODIFY] [`src/lib/utils/translations/vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts)

## 2026-09-27: Upgrade Multi-Agent Governance & Code Freeze Guard from Project AURORA (Revision 5)

- **Machine-Enforced Code Freeze Guard**:
  - Triển khai hook tự động `PreToolUse` tại `.agents/hooks.json` và `.agents/scripts/code-freeze-guard.js` (cô lập native ESM qua `.agents/scripts/package.json` và strict typing `// @ts-check`).
  - Áp dụng chính sách **Scoped Protection (Phương án 2)**: Sau khi plan được duyệt (`[PLAN_APPROVED]`), tự động cho phép ghi vào UI components/hooks và feature code; luôn khóa và yêu cầu xác nhận (`ask`) đối với các file nhạy cảm: `*.server.ts`, database migrations, cấu hình hạ tầng test `TEST_INFRA_FILES`, và file test chịu Test Integrity Guard.
  - Tích hợp Test Integrity Guard: Phát hiện và cảnh báo hành vi làm yếu test (giảm `expect()`, thêm `.skip`/`.only`/`xit`/`fit`/`.fails`, nới lỏng matcher, thêm `try/catch`).
  - Chống bypass artifact 4 lớp: Bắt buộc đường dẫn tuyệt đối `path.isAbsolute()`, kiểm tra thoát repo `toRepoRelative() === null`, chuẩn hóa `ARTIFACT_ROOT`, kiểm tra đuôi an toàn (`.md`, `.json`, `scratch/*`), cấm file thực thi.
  - Bổ sung bộ unit test toàn diện `.agents/scripts/code-freeze-guard.test.ts` (64 tests) bao phủ 100% kịch bản.
- **Nâng Cấp Thẩm Quyền & Bộ 3 Vệ Tinh Cho `@reviewer`**:
  - Thêm quyền `run_command` kiểm chứng read-only trong frontmatter `reviewer/agent.md`.
  - Tạo `.agents/agents/reviewer/allowlist.md`: Quy định 4 nhóm lệnh được phép (Verification suite, Wiring probes, Semantic probes in-memory, Git read-only).
  - Tạo `.agents/agents/reviewer/evidence-bar.md`: Quy chuẩn 4 loại bằng chứng bắt buộc (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`), quy trình Negative Probe cho Zod/RLS/Redis, Adversarial Timeline 4 trục.
  - Tạo `.agents/agents/reviewer/mental-simulation.md`: 6 kịch bản đối kháng S1–S6 (Cold-start, SSE streaming teardown, Supabase PostgreSQL temporal logic, cross-task state, 3-tier auth, external resilience & serverless execution cap 800s/60s/30s) và Domain Open Inquiry bản địa hóa 100% cho Vikini.
  - Cập nhật quy trình 7 bước tuần tự và cơ chế công bố `[FALLBACK_MODEL]`.
- **Nâng Cấp Subagent `@qa` và `@planner`**:
  - `@qa` (`qa/agent.md`): Thống nhất taxonomy lỗi `[BLOCKER]`, `[MAJOR]`, `[MINOR]`; thiết lập quy trình 7 bước; bổ sung Bước 3 Verification Gate (fail-fast: dừng ngay và xuất `[QA_FAILED]` nếu verify thất bại, không soi code); Bước 4 bảo tồn 100% tiêu chuẩn riêng của Vikini (co-located tests, bilingual `04-bilingual.md`, `toast.error()`, file size 150–400 dòng, SSE stream abort cleanup, Zustand/SWR race conditions); Bước 6 Test Integrity Audit chống specification gaming; bổ sung allowlist lệnh và Post-[QA_FAILED] Flow.
  - `@planner` (`planner/agent.md`): Thêm `replace_file_content` vào tools, quy định mục Test Contract bắt buộc, nhận diện Circuit Breaker dừng sau 3 vòng lặp, và cơ chế `[NEEDS_PRODUCT_DECISION]` với default assumption.
- **Cập Nhật Bộ Rules Quản Trị Cốt Lõi**:
  - `rules/01-coding.md`: Bổ sung Bảng Trạng Thái Cưỡng Chế (Enforcement Status: máy chặn vs máy hỏi vs kỷ luật) phản ánh trung thực cấu hình linter/compiler Vikini.
  - `rules/02-quality.md`: Bổ sung lưu ý PowerShell 5.1 (dùng `;` thay vì `&&` khi chạy chuỗi lệnh thủ công); quy chuẩn Governance-only changes; Giao thức phân loại lỗi test Loại A/B/C và cấm nới test; phân định ranh giới giữa `workflows/audit.md` và tác tử on-demand `@qa`.
  - `rules/05-plan-review.md`: Tích hợp hook Code Freeze Scoped Protection; chính xác hóa Circuit Breaker (Orchestrator dừng chuỗi sau 3 vòng lặp revision thất bại, tổng hợp lỗi tồn đọng trình User); bắt buộc công bố model fallback.
- **Cập Nhật Tài Liệu Hệ Thống**:
  - `docs/architecture.md`: Cập nhật Section 7 (Multi-Agent Governance Architecture) bổ sung đầy đủ các cơ chế mới.
- **Files Modified & Added**:
  - [NEW] [`.agents/scripts/package.json`](file:///c:/Users/wyemh/vikini/.agents/scripts/package.json)
  - [NEW] [`.agents/scripts/code-freeze-guard.js`](file:///c:/Users/wyemh/vikini/.agents/scripts/code-freeze-guard.js)
  - [NEW] [`.agents/scripts/code-freeze-guard.test.ts`](file:///c:/Users/wyemh/vikini/.agents/scripts/code-freeze-guard.test.ts)
  - [NEW] [`.agents/agents/reviewer/allowlist.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/allowlist.md)
  - [NEW] [`.agents/agents/reviewer/evidence-bar.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/evidence-bar.md)
  - [NEW] [`.agents/agents/reviewer/mental-simulation.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/mental-simulation.md)
  - [NEW] [`.agents/hooks.json`](file:///c:/Users/wyemh/vikini/.agents/hooks.json)
  - [MODIFY] [`.agents/agents/reviewer/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/agent.md)
  - [MODIFY] [`.agents/agents/qa/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/qa/agent.md)
  - [MODIFY] [`.agents/agents/planner/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/planner/agent.md)
  - [MODIFY] [`.agents/rules/01-coding.md`](file:///c:/Users/wyemh/vikini/.agents/rules/01-coding.md)
  - [MODIFY] [`.agents/rules/02-quality.md`](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md)
  - [MODIFY] [`.agents/rules/05-plan-review.md`](file:///c:/Users/wyemh/vikini/.agents/rules/05-plan-review.md)
  - [MODIFY] [`docs/architecture.md`](file:///c:/Users/wyemh/vikini/docs/architecture.md)
  - [MODIFY] [`docs/CHANGELOG.md`](file:///c:/Users/wyemh/vikini/docs/CHANGELOG.md)

## 2026-09-27: Fix Mobile & Short Viewport Sidebar Scroll Failure

- **Bug Fix**: Resolved issue where sidebar chat list and footer could not be scrolled down or accessed on mobile devices and short desktop windows.
- **Root Cause & Technical Highlights**:
  - **Single Scroll Flow Architecture (Option A)**:
    - Desktop: Kept navigation links (`+ New Chat`, `Chat`, `Explore Gems`, `Manage Personas`, `Image Studio`, `Gallery`) fixed at the top, while unifying Projects and Your chats into a single flexible scroll container (`flex-1 min-h-0 overflow-y-auto pr-1 pb-2 custom-scrollbar`).
    - Mobile: Unified all navigation items, Projects, and Your chats into a single continuous scroll area so users can swipe smoothly through the entire drawer without fragmentation or 0px container collapse.
  - **Mobile Drawer Polish**:
    - Reduced excessive drawer padding from `p-6 pb-24` (120px) to `p-5 pb-16` (80px), preserving safe spacing for iOS Safari bottom toolbar while reclaiming vertical space for chat history.
    - Added missing `X` icon inside the mobile drawer close button (`Dialog.Close`).
    - Raised mobile drawer to `z-[60]` and overlay to `z-[55]`, and hid `FloatingMenuTrigger` when `mobileOpen` is active to eliminate UI overlap.
  - **Cross-Browser Theme-Aware Custom Scrollbar**:
    - Added `.custom-scrollbar` utility in `src/app/styles/themes/_shared/utilities.css` using 5px Webkit scrollbars and `@supports not selector(::-webkit-scrollbar)` for Firefox, ensuring Chrome 121+ does not disregard custom width/color rules.
    - Supports the 8 components already referencing `.custom-scrollbar`.
  - **Collapsed Desktop Sidebar Cleanup**:
    - Removed redundant `flex-1` placeholder that split sidebar height 50/50 in collapsed mode; cleanly anchored border-t to the footer.
- **Testing & Verification**:
  - Added new unit test file [`Sidebar.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.test.tsx) testing desktop scroll container, collapsed mode, and mobile drawer.
  - Full Tier 2 quality gate (`npm run verify`: type-check + lint + 618 vitest tests) passed with 0 errors.
- **Files Modified & Added**:
  - [MODIFY] [`src/app/features/sidebar/components/Sidebar.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx)
  - [MODIFY] [`src/app/features/chat/components/ChatApp.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx)
  - [MODIFY] [`src/app/styles/themes/_shared/utilities.css`](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/utilities.css)
  - [NEW] [`src/app/features/sidebar/components/Sidebar.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.test.tsx)
  - [NEW] [`docs/plans/2026-09-27-mobile-sidebar-scroll-fix-implementation-plan.md`](file:///c:/Users/wyemh/vikini/docs/plans/2026-09-27-mobile-sidebar-scroll-fix-implementation-plan.md)
  - [MODIFY] [`docs/lessons-learned.md`](file:///c:/Users/wyemh/vikini/docs/lessons-learned.md)

## 2026-09-17: Adopt Multi-Agent Subagent Architecture (Planner, Reviewer, QA) from Project AURORA

- **Architecture & System Governance**: Tích hợp toàn diện hệ thống phối hợp đa tác tử (Multi-Agent System) chuẩn Antigravity 2.0 từ Project AURORA, thiết lập quy trình kiểm soát chất lượng khép kín với các cơ chế cưỡng chế bất biến:
  - **Subagent `@planner`** (`.agents/agents/planner/agent.md`): Sử dụng mô hình `gemini-3.8-flash`, trang bị 7 công cụ chuẩn bao gồm tra cứu trực tuyến (`search_web`, `read_url_content`) để cập nhật API năm 2026, thiết kế kế hoạch bám sát nguyên tắc Minimal Diffs, ghi kế hoạch vào `docs/plans/` và xử lý Revision Loop in-place.
  - **Subagent `@reviewer`** (`.agents/agents/reviewer/agent.md`): Sử dụng mô hình `claude-4.6-opus` (tự động Fallback sang `gemini-3.8-flash` khi chạm HTTP 429), trang bị 6 công cụ Read-Only & Online Grounding, áp dụng Severity Rubric 3 cấp độ (`[BLOCKER]`, `[MAJOR]`, `[MINOR]`), nắm giữ thẩm quyền Gatekeeper duy nhất cấp token `[PLAN_APPROVED]`.
  - **Subagent `@qa`** (`.agents/agents/qa/agent.md`): Sử dụng mô hình `claude-4.6-opus` (Fallback `gemini-3.8-flash`), hoạt động ở chế độ On-Demand (chỉ kích hoạt khi người dùng gõ `@qa`), thẩm định 4 giai đoạn độc lập: Plan Compliance, Deep Bug Hunting, Actionable Improvements và xuất báo cáo `[QA_PASSED]` / `[QA_FAILED]`.
  - **Quy tắc điều phối `05-plan-review.md`**: Ban hành quy tắc Plan-Review-Revise Loop với 3 cơ chế cưỡng chế cốt lõi:
    1. _Strict Code Freeze_: Cấm chạm source code trước khi có thẻ `[PLAN_APPROVED]`.
    2. _Zero-Self-Execution_: Orchestrator cấm tự lập kế hoạch trên luồng chính, bắt buộc 100% ủy quyền cho `@planner`.
    3. _Uninterrupted Execution Chain_: Chuỗi task ➔ planner ➔ reviewer chạy tự động liên tục, cấm ngắt quãng hỏi người dùng trước khi có thẻ phê duyệt.
    4. _Pre-Flight Gate_: Kiểm tra bắt buộc 3 cổng (Plan Persistence, Reviewer Dispatch, Approval Token) trước khi xin phép mở khóa code.
  - **Thư mục lưu trữ `docs/plans/`**: Khởi tạo cấu trúc lưu vết kế hoạch thực thi dài hạn.
  - **Tài liệu hóa**: Cập nhật `00-core.md`, `02-quality.md`, và bổ sung Section 7 vào `docs/architecture.md`.
- **Files Modified & Added**:
  - [NEW] [`.agents/agents/planner/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/planner/agent.md)
  - [NEW] [`.agents/agents/reviewer/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/agent.md)
  - [NEW] [`.agents/agents/qa/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/qa/agent.md)
  - [NEW] [`.agents/rules/05-plan-review.md`](file:///c:/Users/wyemh/vikini/.agents/rules/05-plan-review.md)
  - [NEW] [`docs/plans/README.md`](file:///c:/Users/wyemh/vikini/docs/plans/README.md)
  - [NEW] [`docs/plans/2026-09-17-multi-agent-system-implementation-plan.md`](file:///c:/Users/wyemh/vikini/docs/plans/2026-09-17-multi-agent-system-implementation-plan.md)
  - [MODIFY] [`.agents/rules/00-core.md`](file:///c:/Users/wyemh/vikini/.agents/rules/00-core.md)
  - [MODIFY] [`.agents/rules/02-quality.md`](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md)
  - [MODIFY] [`docs/architecture.md`](file:///c:/Users/wyemh/vikini/docs/architecture.md)

## 2026-09-16: Implement "Branch In New Chat" (Conversation Branching) Feature

- **Feature**: Added **Branch In New Chat** capability to Vikini, allowing users to fork any conversation from a specific message node into an independent new conversation session.
- **Architecture & Technical Highlights**:
  - **Hybrid Snapshot Fork Model**: Clones conversation history up to the target message node ($M_1 \dots M_k$) directly at the database level, preserving AES encrypted content without plaintext exposure in memory.
  - **Turn Isolation & AI Context Retention**: Only the branched turn (user prompt + assistant answer) is displayed on the user's interface, keeping the view clean. All older prior messages are tagged with `isContextOnly: true` and fed seamlessly to the LLM backend, preserving 100% conversational intelligence and prefix KV cache reuse.
  - **Contextual Branch Title**: Auto-generates the branch conversation title from the branched user prompt for immediate topic recognition.
  - **Genealogy Tracking**: Added `parent_conversation_id` and `forked_from_message_id` columns with indexes on the `conversations` table.
  - **API Route**: Created `POST /api/conversations/[id]/branch` with RFC 4122 UUID validation, authentication checks, and cache invalidation.
  - **UI/UX**:
    - Added `GitFork` action button to `MessageActions.tsx` with loading state and bilingual tooltips.
    - Integrated with `ChatBubble.tsx` and `ChatApp.tsx`.
    - Implemented subtle **Origin Breadcrumb** at the top of branched conversations linking back to the parent conversation.
    - Added prior context notification badge indicating background context retained for AI.
  - **Bilingual**: Full English and Vietnamese translations added for action buttons, notifications, and breadcrumbs.
- **Files Modified & Added**:
  - [`20260916_add_conversation_branching.sql`](file:///c:/Users/wyemh/vikini/supabase/migrations/20260916_add_conversation_branching.sql): Added migration script for branching columns and index.
  - [`database-schema.md`](file:///c:/Users/wyemh/vikini/docs/database-schema.md): Updated ERD and Section 2.3 `conversations` documentation.
  - [`conversations.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts): Added `branchConversation` domain logic and updated `Conversation` types & mappers.
  - [`conversations.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.test.ts): Added unit tests for branching mappers.
  - [`branch/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/conversations/[id]/branch/route.ts): Created branching API handler.
  - [`branch/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/conversations/[id]/branch/route.test.ts): Added integration tests for branch API.
  - [`validators.ts`](file:///c:/Users/wyemh/vikini/src/app/api/conversations/validators.ts): Added `branchConversationSchema`.
  - [`MessageActions.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/MessageActions.tsx): Added branch button and loading state.
  - [`MessageActions.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/MessageActions.test.tsx): Added unit tests for branch button.
  - [`ChatBubble.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx): Forwarded `onBranch` and `isBranching` props and updated React.memo comparison.
  - [`ChatApp.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx): Added `handleBranchMessage`, origin breadcrumb, and navigation.
  - [`useConversation.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/hooks/useConversation.ts): Added `parentConversationId` and `forkedFromMessageId` to `FrontendConversation`.
  - [`vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts): Added bilingual translation keys.

## 2026-09-16: Switch DeepSeek V4.1 Flash Provider to Relace on OpenRouter

- **Improvement**: Switched DeepSeek V4.1 Flash (`deepseek/deepseek-v4.1-flash`) OpenRouter priority provider from Fireworks to **Relace** (`provider: { order: ["Relace"], allow_fallbacks: true }`).
- **Key Metrics with Relace**:
  - **Lower Cost**: Input reduced to $0.15/M (down from $0.22/M), Output reduced to $0.60/M (down from $0.66/M).
  - **Faster Latency**: TTFT reduced to 1.43s (down from 1.87s).
  - **Higher Availability**: 99.50% uptime with verified badge on OpenRouter.
- **Files Modified**:
  - [`deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts): Updated `order: ["Relace"]`.
  - [`modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts): Updated provider comment.
  - [`deepseek-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.test.ts): Updated unit test expectations to verify Relace routing.
  - [`models.md`](file:///c:/Users/wyemh/vikini/docs/models.md): Updated specifications table and benchmark details.

## 2026-09-10: Integrate DeepSeek V4.1 Flash via OpenRouter (Fireworks AI)

- **Feature**: Added **DeepSeek V4.1 Flash** (`deepseek/deepseek-v4.1-flash`) to the Vikini model registry with OpenRouter integration, prioritized on Fireworks AI infrastructure.
- **Key Capabilities**:
  - **Causal Encoder-Decoder (CED) MoE Architecture**: 552B total parameters with asymmetric activation (8B prefill, 16B decode) achieving ~70 tps throughput and 1.87s latency.
  - **Ultra-deep Context Window**: 1,048,576 tokens (1M tokens), on par with Gemini 3 Flash.
  - **Full Unconstrained Output Token Limit**: `384,000` completion tokens (no artificial cap), enabling end-to-end full codebase and long-form report generation.
  - **Multimodal Vision**: Enables native image understanding (`image_url` data URLs) for DeepSeek models in Vikini chat and file attachment pipelines.
  - **Thinking Mode**: Integrated OpenRouter reasoning parameter (`include_reasoning: true`, `reasoning.effort`) with real-time `<think>` tag streaming and `<ThinkingBlock>` UI render.
  - **Provider Routing**: Configured OpenRouter provider order `["Fireworks"]` with automatic fallbacks for maximum throughput and 96.8% cache discount ($0.007/M cached tokens).
- **Files Modified**:
  - [`constants.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/constants.ts): Added `MODEL_IDS.DEEPSEEK_V41_FLASH`.
  - [`modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts): Registered model metadata, 1M context, 384k output tokens, `isDeepSeekV41FlashModel` helper, and aliases.
  - [`useThinkingLevel.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.ts): Enabled Thinking Level selector for DeepSeek V4.1 Flash.
  - [`chatStreamCore.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts): Dispatched to OpenRouter client and `createDeepSeekStream`.
  - [`deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts): Added Fireworks provider routing and full 384k token budget calculation.
  - [`vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts): Added bilingual model descriptions highlighting CED 1M context, multimodal, superior efficiency, and lowest cost.
  - [`models.md`](file:///c:/Users/wyemh/vikini/docs/models.md): Documented full technical specifications and comparison matrix.
  - [`005_add_deepseek_v4_1_flash.sql`](file:///c:/Users/wyemh/vikini/database-migrations/005_add_deepseek_v4_1_flash.sql): Added database migration script for rank configurations.
  - [`deepseek-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.test.ts): Added unit test verifying Fireworks routing, 384k tokens, thinking config, and multimodal image handling.
