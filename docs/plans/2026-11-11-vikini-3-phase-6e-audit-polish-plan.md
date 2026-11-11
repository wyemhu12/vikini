# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 6E (Cuối): Vá Lỗi Audit, Chuẩn Hóa Hook & Hoàn Thiện Tinh Chỉnh Giao Diện

- **Revision**: 1
- **Status**: Changes Requested
- **Date**: 2026-11-11
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Depends on**: Giai đoạn 6D (`docs/plans/2026-11-11-vikini-3-phase-6d-token-codemod-type-scale-lint-guards-plan.md`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Giải quyết triệt để 6 nhóm tồn đọng kỹ thuật và thẩm mỹ cuối cùng từ đợt kiểm toán tổng thể sau Giai đoạn 6D theo `docs/specs/2026-11-08-vikini-3-redesign-brief.md`, khóa chặt bằng rule ESLint mức `"error"` và bộ kiểm thử co-located đầy đủ:

1. **Hạng mục 1a — Chặn gọi API & bắn toast lặp vô hạn ở `PersonaQuickSwitch` (+ đồng bộ `GemQuickSwitch`)**:
   - Bổ sung `requestedRef = useRef(false)` (đặt lại khi `!open`), tham chiếu `tRef = useRef(t)` và biến cờ `cancelled` khi đóng popover/unmount tại `src/app/features/personas/components/PersonaQuickSwitch.tsx:32-51` để mỗi lượt mở popover chỉ gọi `/api/personas` tối đa 1 lần và bắn tối đa 1 `toast.error`, kể cả khi API trả mảng rỗng `[]`, lỗi HTTP 500 hoặc người dùng đổi ngôn ngữ.
   - Bổ sung đồng bộ cờ `cancelled`, `tRef`, và thuộc tính `type="button"` còn thiếu trên 2 nút chọn/quản lý trong popover `src/app/features/gems/components/GemQuickSwitch.tsx:34-58`, `src/app/features/gems/components/GemQuickSwitch.tsx:124`, `src/app/features/gems/components/GemQuickSwitch.tsx:141` để không vô tình submit `<form>` cha (`InputForm`).
2. **Hạng mục 1b (`M7`) — Chống sập toàn trang Dự Án khi API thiếu trường `documents` & dọn class shadcn chết**:
   - Chuẩn hóa `Array.isArray(data?.data?.documents) ? data.data.documents : []` tại `src/app/projects/[id]/page.tsx:59` và `src/components/features/projects/ProjectSettingsModal.tsx:74`; đồng thời phòng thủ `const safeDocuments = Array.isArray(documents) ? documents : [];` ngay đầu `src/components/features/projects/KnowledgePanel.tsx:37-52` để không bao giờ văng `TypeError: Cannot read properties of undefined (reading 'length')` tại `src/components/features/projects/KnowledgePanel.tsx:208` và `src/components/features/projects/KnowledgePanel.tsx:215`.
   - Thay thế class shadcn không tồn tại `bg-primary text-primary-foreground hover:bg-primary/90` tại `src/app/projects/[id]/page.tsx:310` bằng `bg-(--accent) text-(--on-accent) hover:brightness-110`.
3. **Hạng mục 1c (`M6`) — Đồng bộ sớm `<html lang>`, dọn class chết trên `<body>` & skip-link song ngữ**:
   - Giữ mặc định `language: "en"` trong `src/lib/store/languageStore.ts:9-12` để bảo toàn 100% unit test jsdom hiện hữu; bổ sung script bootstrap đồng bộ nhỏ gọn trong `<head>` tại `src/app/layout.tsx:48` đọc `localStorage.getItem("vikini-language")` (hỗ trợ cả chuỗi `"vi"`/`"en"` trực tiếp lẫn định dạng JSON `{ state: { language } }`, fallback sang `navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en"`) để gán `document.documentElement.lang` trước khi paint, đồng thời đồng bộ cùng hàm thuần `resolveInitialLanguage` trong `src/app/features/layout/components/LanguageUpdater.tsx:14-35`.
   - Thay class chết `bg-surface text-primary` tại `src/app/layout.tsx:50` (và 2 chỗ sót tương tự tại `src/app/features/chat/components/ChatApp.tsx:234` và `src/app/features/image-gen/components/ImageGenStudio.tsx:67`) sang `bg-(--bg) text-(--text)`.
   - Thay thẻ `<a href="#main">Skip to main content</a>` đặt cứng tiếng Anh tại `src/app/layout.tsx:51-56` bằng client component `<RootSkipLink />` dùng `useLanguage()` (`t("skipToMainContent")`) và ẩn trên các route đã có skip-link chuyên biệt (`/`, `/novelcrafter`, `/novelcrafter/prompts`) để bàn phím không gặp 2 skip-link trùng nhau mà `tests/e2e/a11y.spec.ts:32-53` vẫn xanh tuyệt đối trên mọi route.
4. **Hạng mục 2a — Dọn sạch `uppercase` ngoài tiêu đề nhóm sidebar + khóa bằng `vikini-design/no-uppercase`**:
   - Theo `docs/specs/2026-11-08-vikini-3-redesign-brief.md:75` (_"Uppercase only for sidebar group labels"_), giữ duy nhất `uppercase` tại `src/app/features/sidebar/components/SidebarSection.tsx:69` và gỡ toàn bộ 37 lượt class `uppercase` (kèm `tracking-wider`/`tracking-widest`/`tracking-wide` chỉ phục vụ in hoa) trên 21 file `.tsx` còn lại; sửa luôn class chết `text-muted-foreground` thành `text-(--muted)` tại `src/app/features/image-gen/components/PromptBuilder.tsx:190`, `:212`, `:222`, `:224`, `:244`.
   - Bổ sung rule `"vikini-design/no-uppercase": "error"` vào `scripts/vikini-design-lint.mjs` + `eslint.config.mjs:125-129` (miễn trừ duy nhất `src/app/features/sidebar/components/SidebarSection.tsx`).
5. **Hạng mục 2b — Xử lý tận gốc 17 cảnh báo `react-hooks/exhaustive-deps` trên 11 file & nâng rule lên `"error"`**:
   - Sửa từng vị trí cụ thể trên 11 file nguồn bằng thiết kế an toàn (tách `useCallback` ổn định, dùng `ref` giữ callback/offset/id đã đồng bộ, gọi `sizeCache.clear()` trong `useEffect`, loại dependency thừa), đảm bảo không sinh vòng lặp render và không xóa dữ liệu người dùng đang gõ; sau đó nâng `"react-hooks/exhaustive-deps"` từ `"warn"` lên `"error"` tại `eslint.config.mjs:33`.
6. **Hạng mục 2c — Nút Dừng màu `--accent` & quầng sáng chân trời `--glow` phía sau khung nhập chat**:
   - Đổi nhánh `isStreaming` của nút Dừng tại `src/app/features/chat/components/InputForm.tsx:223` từ `--danger` sang `bg-(--accent) text-(--on-accent) ring-2 ring-(--accent)/30` (cập nhật ca test Loại C tại `src/app/features/chat/components/InputForm.test.tsx:114-134`).
   - Bổ sung lớp tiện ích `.composer-horizon-glow` dùng `var(--glow)` tại `src/app/styles/themes/_shared/utilities.css:6-10` và gắn lớp `pointer-events-none` phía sau hộp nhập ở cả `src/app/features/chat/components/ChatControls.tsx:122-125` (chế độ thường + `isLanding`) và `src/app/features/projects/components/ProjectChatView.tsx:108-131` theo đúng `docs/specs/2026-11-08-vikini-3-redesign-brief.md:31`, `:47`.

**Out of Scope (What We're NOT Doing)**:

- Không chạm bất kỳ file nào thuộc danh sách nhạy cảm quản trị, bảo mật hoặc DB (`.agents/**`, `.claude/**`, `.husky/**`, `AGENTS.md`, `CLAUDE.md`, `scripts/code-freeze-guard.js`, `supabase/**`, `database-migrations/**`, `*.sql`, `*.server.*`, `src/app/api/auth/**`, `src/lib/core/auth*`, `src/proxy.ts`, `src/middleware.ts`, `next.config.ts`).
- Không thay đổi giao thức SSE, schema API backend `/api/personas`, `/api/projects/[id]/knowledge`, hay cấu trúc bảng lưu trữ Supabase.
- Không đổi giá trị mặc định tĩnh `language: "en"` trong `src/lib/store/languageStore.ts:9-12` để không phá vỡ môi trường unit test jsdom hiện tại.
- Không tách nhỏ toàn bộ `useChatStreamController.ts` sang kiến trúc file mới ngoài phạm vi ổn định hóa 5 dependency array của `useCallback`.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / Nguồn Đã Đọc                                                 | Nội Dung & Ràng Buộc Kỹ Thuật Rút Ra                                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/rules/02-quality.md`                                       | Pre-Work Protocol, phân loại lỗi test Loại A/B/C, cú pháp PowerShell `;`, Visual QA Gate (Desktop `1440px` & Mobile `375px` × Dark/Light)                                                  |
| `.agents/rules/03-ui.md`                                            | Hệ token ngữ nghĩa Vikini 3.0 (`--bg`, `--text`, `--muted`, `--accent`, `--on-accent`, `--glow`), cấm class màu chết (`bg-surface`, `text-primary`, `bg-primary`, `text-muted-foreground`) |
| `.agents/rules/04-bilingual.md`                                     | Mọi văn bản hiển thị cho người dùng (kể cả skip-link a11y) bắt buộc đi qua từ điển song ngữ `vi.ts` / `en.ts`                                                                              |
| `.agents/rules/05-plan-review.md`                                   | Quy trình Plan Scope Guard, cấu trúc 10 mục + `## Audit History`, cấm chạm danh mục `CRITIC_REQUIRED` ngoài phạm vi                                                                        |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md:31`, `:47`, `:75` | `--glow` chỉ tỏa ấm ở Hoàng Hôn và `transparent` ở 4 theme còn lại; `uppercase` chỉ dùng cho tiêu đề nhóm sidebar; nút Dừng dùng `--accent`                                                |
| `docs/lessons-learned.md`                                           | Mẫu phòng vệ dữ liệu API thiếu trường (`Array.isArray`), chặn hiệu ứng gọi lặp `useEffect`, và đồng bộ hydration an toàn                                                                   |
| `tests/e2e/a11y.spec.ts:32-53`, `:101-128`                          | Quét axe-core (`link-name`, `button-name`…) trên 7 route × 2 viewport; mọi thẻ `<a>` / `<button>` phải có accessible name hợp lệ                                                           |

**Skills Loaded & Applied**

| Skill (`SKILL.md` đã đọc bằng `read_file`)   | Lý Do Kích Hoạt                                                                                                                               | Quyết Định Kỹ Thuật Chịu Ảnh Hưởng                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-debug/SKILL.md`       | Xác minh root cause cho lỗi gọi lặp `PersonaQuickSwitch`, crash `KnowledgePanel` (`M7`), hydration `<html lang>` (`M6`), và 17 hook warnings  | Bắt đúng nguyên nhân gốc: dùng `requestedRef` + `cancelled` thay vì vá điều kiện độ dài mảng; phòng thủ `Array.isArray` ở cả caller lẫn component con; dùng `syncedPersonaKeyRef` / `syncedChapterIdRef` để không mất chữ đang gõ                                                                                                                         |
| `.agents/skills/vikini-investigate/SKILL.md` | Phân tích blast-radius khi chỉnh `layout.tsx`, `LanguageUpdater.tsx`, `useConversation.ts`, `useChatStreamController.ts`, `eslint.config.mjs` | Kiểm tra toàn bộ caller & unit test liên quan (`src/app/features/layout/components/LanguageUpdater.test.tsx:42-77`, `src/app/features/chat/components/SmartCode.test.tsx:101-127`, `src/app/features/chat/components/InputForm.test.tsx:114-134`, `src/app/features/chat/components/hooks/useChatStreamController.test.ts:31-70`) trước khi chốt thiết kế |
| `.agents/skills/vikini-audit/SKILL.md`       | Kiểm toán toàn diện 39 vị trí `uppercase`, các class token chết sót lại, và rule lint tự động                                                 | Thiết kế regex `findUppercaseClasses` chính xác theo ranh giới token Tailwind, đồng thời dọn sạch `bg-surface`/`text-primary`/`bg-primary`/`text-muted-foreground` tại các file chạm tới                                                                                                                                                                  |
| `.agents/skills/add-translation/SKILL.md`    | Chuyển skip-link cứng tiếng Anh sang cơ chế song ngữ chuẩn                                                                                    | Tái sử dụng khóa có sẵn `skipToMainContent` trong `vi.ts` / `en.ts` thông qua `useLanguage()` trong `RootSkipLink.tsx`, không sinh khóa trùng lặp                                                                                                                                                                                                         |
| `.agents/skills/streaming-patterns/SKILL.md` | Chạm `src/app/features/chat/components/hooks/useChatStreamController.ts`                                                                      | Giữ bất biến luồng `AbortController`, thứ tự `flushRemaining()` → `resetBuffer()`, và tách các hàm `useCallback` ổn định từ `useThinkingStats` (`markThinking`, `markAnswer`, `reset`) + `thinkingStatsSnapshotRef` để không tạo lại hàm stream mỗi nhịp `tick` suy luận                                                                                  |

---

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả Định / Sự Thật Đã Kiểm Chứng                                                                                                                                                                                                                                                                                                                                                                     | Bằng Chứng Xác Minh                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `PersonaQuickSwitch.tsx` đã có `type="button"` ở cả 3 nút trong popover, trong khi `GemQuickSwitch.tsx` đã có `requestedRef` nhưng thiếu cờ `cancelled` khi đóng sớm và thiếu `type="button"` ở 2 nút chọn Gem / Manage GEMs                                                                                                                                                                         | `[SRC]` `src/app/features/personas/components/PersonaQuickSwitch.tsx:109`, `src/app/features/personas/components/PersonaQuickSwitch.tsx:120`, `src/app/features/personas/components/PersonaQuickSwitch.tsx:141`, `src/app/features/gems/components/GemQuickSwitch.tsx:34-58`, `src/app/features/gems/components/GemQuickSwitch.tsx:124`, `src/app/features/gems/components/GemQuickSwitch.tsx:141` |
| A2  | Đường dẫn thực tế của `PromptBuilder.tsx` nằm dưới `image-gen/components/` (không phải `gems/components/`) và đang chứa cả `uppercase` lẫn 5 chỗ class chết `text-muted-foreground`                                                                                                                                                                                                                  | `[SRC]` `src/app/features/image-gen/components/PromptBuilder.tsx:190`, `src/app/features/image-gen/components/PromptBuilder.tsx:212`, `src/app/features/image-gen/components/PromptBuilder.tsx:222`, `src/app/features/image-gen/components/PromptBuilder.tsx:224`, `src/app/features/image-gen/components/PromptBuilder.tsx:244`                                                                  |
| A3  | Toàn bộ `src/**/*.{ts,tsx}` có đúng 39 kết quả khớp chuỗi `uppercase` trên 23 file: 1 chỗ hợp lệ giữ lại tại `src/app/features/sidebar/components/SidebarSection.tsx:69`, 1 comment trong `src/app/features/chat/components/SmartCode.test.tsx:101` (test kỳ vọng `{lang}` chữ thường `"python"` ở dòng 102 & 127), và 37 lượt class CSS trên 21 file `.tsx` cần gỡ                                  | `[SRC]` `src/app/features/sidebar/components/SidebarSection.tsx:69`, `src/app/features/chat/components/SmartCode.tsx:116`, `src/app/features/chat/components/SmartCode.test.tsx:101-102`, `src/app/features/chat/components/SmartCode.test.tsx:127`                                                                                                                                                |
| A4  | `LanguageUpdater.test.tsx` kiểm chứng lưu trữ chuỗi `"vi"` / `"en"` trực tiếp trong `localStorage["vikini-language"]` và kỳ vọng không ghi đè `"en"` khi mount; trong jsdom `navigator.language` mặc định là `"en-US"` nên fallback theo `navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en"` hoàn toàn tương thích ngược với mọi unit test hiện có                                    | `[SRC]` `src/lib/store/languageStore.ts:9-12`, `src/app/features/layout/components/LanguageUpdater.tsx:14-35`, `src/app/features/layout/components/LanguageUpdater.test.tsx:42-77`                                                                                                                                                                                                                 |
| A5  | Ba không gian làm việc `/`, `/novelcrafter`, và `/novelcrafter/prompts` đã tự render skip-link song ngữ riêng (`#main-content`, `#nc-manuscript`, `#nc-ai-settings`), còn các route còn lại (`/images`, `/gallery`, `/describe`, `/gems`, `/projects/[id]`, `/admin`, `/auth/*`) dựa vào `<main id="main">` của `MainLayout.tsx`                                                                     | `[SRC]` `src/app/features/layout/components/MainLayout.tsx:8`, `src/app/features/chat/components/ChatApp.tsx:235-240`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:261-266`, `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:54-59`                                                                                                            |
| A6  | `eslint.config.mjs` bật `"@typescript-eslint/no-unused-expressions": "error"`, nên tại `src/app/features/chat/components/ChatMessagesArea.tsx:92` không được dùng biểu thức giả `void selectedConversationId;` mà phải tách `useMemo(() => createSizeCache(100), [])` kèm `useEffect(() => { sizeCache.clear(); }, [selectedConversationId, sizeCache])` (hàm `clear()` đã có sẵn trong `SizeCache`) | `[SRC]` `eslint.config.mjs:103`, `src/app/features/chat/components/ChatMessagesArea.tsx:92`, `src/lib/features/chat/virtualization.ts:13`, `src/lib/features/chat/virtualization.ts:75-77`                                                                                                                                                                                                         |
| A7  | `useThinkingStats()` trả về object literal mới mỗi lần render (khi `stats` nhảy số giây suy luận), nhưng 3 hàm `markThinking`, `markAnswer`, `reset` bên trong đều đã bọc `useCallback(..., [])` ổn định; tương tự `resetBuffer` của `useTypewriterBuffer` đã bọc `useCallback(..., [])`                                                                                                             | `[SRC]` `src/app/features/chat/components/hooks/useThinkingStats.ts:23-65`, `src/app/features/chat/components/hooks/useTypewriterBuffer.ts:66-74`, `src/app/features/chat/components/hooks/useChatStreamController.ts:78`, `src/app/features/chat/components/hooks/useChatStreamController.ts:117-122`                                                                                             |

**Cross-Task Dependencies**:

- **Hạng mục 2a** (`no-uppercase` rule) phải bật sau khi đã gỡ sạch `uppercase` trên 21 file `.tsx` để `npm run lint` đạt 0 lỗi.
- **Hạng mục 2b** (`"react-hooks/exhaustive-deps": "error"` tại `eslint.config.mjs:33`) phụ thuộc trực tiếp vào việc hoàn tất sửa cả 17 cảnh báo (bao gồm `src/app/projects/[id]/page.tsx:65` dùng chung với **Hạng mục 1b** và `src/app/features/personas/components/PersonaEditor.tsx:62` dùng chung với **Hạng mục 2a**).

---

### 4. Bảng Verified Versions

| Thư Viện / Công Cụ                         | Khai Báo `package.json`          | Trạng Thái 2026 & Ghi Chú Kỹ Thuật                                                                                                                                                                           | Nguồn Xác Minh                                                                                                          |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `next`                                     | `^16.4.0`                        | App Router hỗ trợ `suppressHydrationWarning` trên `<html>` kết hợp inline `<script>` đồng bộ trong `<head>` để cập nhật thuộc tính `document.documentElement.lang` trước first paint không gây lỗi hydration | `[SRC]` `package.json:64` · `[URL]` `https://nextjs.org/docs/messages/react-hydration-error`                            |
| `react` / `react-dom`                      | `^19.2.3`                        | React 19 giữ nguyên ngữ nghĩa `suppressHydrationWarning` (1 cấp sâu cho thuộc tính/text trực tiếp) và batch state update trong `useEffect`                                                                   | `[SRC]` `package.json:69`, `package.json:70` · `[URL]` `https://react.dev/reference/react-dom/components/common`        |
| `eslint`                                   | `^9.39.2`                        | Flat Config (`eslint.config.mjs`) cho phép khai báo rule nội bộ `vikini-design/no-uppercase` và override cục bộ theo `files: [...]` cho `SidebarSection.tsx`                                                 | `[SRC]` `package.json:102`, `eslint.config.mjs:125-129`                                                                 |
| `eslint-plugin-react-hooks`                | `^7.0.1`                         | Phiên bản 7 hỗ trợ đầy đủ Flat Config; nâng `"react-hooks/exhaustive-deps"` lên `"error"` để chặn vĩnh viễn stale closure và thiếu dependency                                                                | `[SRC]` `package.json:105`, `eslint.config.mjs:31-35` · `[URL]` `https://react.dev/reference/eslint-plugin-react-hooks` |
| `tailwindcss`                              | `^4.1.18`                        | Hỗ trợ cú pháp biến CSS `bg-(--accent)`, `text-(--on-accent)`, `ring-(--accent)/30` và lớp CSS tùy biến dùng `var(--glow)`                                                                                   | `[SRC]` `package.json:114`                                                                                              |
| `zustand`                                  | `^5.0.9`                         | Store `useLanguageStore` cho phép đọc đồng bộ qua `getState()` bên trong `useEffect` mà không sinh chu kỳ render phụ                                                                                         | `[SRC]` `package.json:81`                                                                                               |
| `vitest` / `@playwright/test` / `axe-core` | `^4.1.12` / `^1.62.1` / `4.11.1` | Bộ kiểm thử đơn vị jsdom co-located và kiểm thử E2E a11y (`a11y.spec.ts`)                                                                                                                                    | `[SRC]` `package.json:87`, `package.json:100`, `package.json:118`                                                       |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**Nhóm Hạng Mục 1a — `PersonaQuickSwitch` & `GemQuickSwitch` (4 files)**

- [MODIFY] `src/app/features/personas/components/PersonaQuickSwitch.tsx` — thêm `requestedRef`, `tRef`, cờ `cancelled` khi đóng/unmount để chỉ fetch `/api/personas` và bắn `toast.error` tối đa 1 lần mỗi lượt mở popover.
- [MODIFY] `src/app/features/personas/components/PersonaQuickSwitch.test.tsx` — bổ sung ca kiểm thử mảng rỗng `[]`, lỗi HTTP 500 / network chỉ gọi fetch & toast 1 lần, đóng rồi mở lại được phép thử lại, đổi ngôn ngữ không fetch lại, và kiểm tra `type="button"` trên các nút trong popover.
- [MODIFY] `src/app/features/gems/components/GemQuickSwitch.tsx` — bổ sung cờ `cancelled`, `tRef`, và thêm `type="button"` cho 2 nút chọn Gem (`:124`) & quản lý Gem (`:141`) đồng bộ với `PersonaQuickSwitch`.
- [MODIFY] `src/app/features/gems/components/GemQuickSwitch.test.tsx` — bổ sung kiểm chứng `type="button"` trên các nút trong popover và không fetch lặp khi đổi ngôn ngữ.

**Nhóm Hạng Mục 1b (`M7`) — Phòng Vệ Trang Dự Án & `KnowledgePanel` (5 files)**

- [MODIFY] `src/app/projects/[id]/page.tsx` — chuẩn hóa `Array.isArray(data?.data?.documents) ? data.data.documents : []` (`:59`), thêm `t` vào dependency `useCallback` của `fetchDocuments` (`:65`), và đổi nút New Chat (`:310`) từ `bg-primary text-primary-foreground hover:bg-primary/90` sang `bg-(--accent) text-(--on-accent) hover:brightness-110`.
- [NEW] `src/app/projects/[id]/page.test.tsx` — kiểm thử co-located chứng minh API `/api/projects/[id]/knowledge` trả `{ success: true, data: {} }` (thiếu `documents`) không sập trang và nút New Chat mang token `bg-(--accent) text-(--on-accent)`.
- [MODIFY] `src/components/features/projects/ProjectSettingsModal.tsx` — chuẩn hóa `Array.isArray(data?.data?.documents) ? data.data.documents : []` tại `:74`.
- [MODIFY] `src/components/features/projects/KnowledgePanel.tsx` — chuẩn hóa `const safeDocuments = Array.isArray(documents) ? documents : [];` ngay đầu thân hàm (`:37-52`) và thay `documents.length` / `documents.map` (`:208`, `:215`) bằng `safeDocuments`.
- [MODIFY] `src/components/features/projects/KnowledgePanel.test.tsx` — bổ sung ca kiểm thử truyền `documents={undefined as unknown as KnowledgeDocument[]}` và `documents={[]}` hiển thị trạng thái rỗng an toàn, không văng lỗi `.length`.

**Nhóm Hạng Mục 1c (`M6`) — `<html lang>`, Token `<body>` & Skip-Link Song Ngữ (6 files)**

- [MODIFY] `src/app/layout.tsx` — thêm inline bootstrap `<script>` đồng bộ `document.documentElement.lang` trong `<head>` (`:48`), đổi `bg-surface text-primary` sang `bg-(--bg) text-(--text)` trên `<body>` (`:50`), và thay skip-link tiếng Anh cứng (`:51-56`) bằng `<RootSkipLink />`.
- [MODIFY] `src/app/features/layout/components/LanguageUpdater.tsx` — xuất hàm thuần `resolveInitialLanguage(stored, navigatorLang)` hỗ trợ cả chuỗi `"vi"`/`"en"` lẫn JSON Zustand `{ state: { language } }` + fallback `navigator.language`, đồng bộ `document.documentElement.lang` ngay khi mount và mỗi khi đổi ngôn ngữ.
- [MODIFY] `src/app/features/layout/components/LanguageUpdater.test.tsx` — bổ sung unit test cho `resolveInitialLanguage` (chuỗi thô, JSON `{ state: { language: "vi" } }`, JSON hỏng, fallback `navigator.language = "vi-VN"` vs `"en-US"`).
- [NEW] `src/app/features/layout/components/RootSkipLink.tsx` — client component render `<a href="#main">` dịch động qua `t("skipToMainContent")` (`suppressHydrationWarning`), tự ẩn trên `/`, `/novelcrafter`, `/novelcrafter/prompts` nơi đã có skip-link không gian làm việc riêng.
- [NEW] `src/app/features/layout/components/RootSkipLink.test.tsx` — kiểm thử co-located cho `RootSkipLink` (đổi ngôn ngữ `"vi"` ↔ `"en"`, thuộc tính `href="#main"`, ẩn trên `/` và hiển thị trên `/images`, `/projects/p1`).
- [MODIFY] `src/app/features/chat/components/ChatApp.tsx` — thay class chết `text-primary ... bg-surface` tại `:234` sang `text-(--text) ... bg-(--bg)`.

**Nhóm Hạng Mục 2a — Gỡ `uppercase` Trên 21 File UI + Rule Lint `vikini-design/no-uppercase` (24 files)**

- [MODIFY] `scripts/vikini-design-lint.mjs` — bổ sung hàm thuần `findUppercaseClasses(value)` và rule ESLint `"no-uppercase"` trong `vikiniDesignPlugin`.
- [MODIFY] `scripts/vikini-design-lint.test.ts` — bổ sung unit test dương tính (`"uppercase"`, `"md:uppercase"`, `"!uppercase"`) và âm tính (văn bản thường, tên biến không phải class).
- [MODIFY] `eslint.config.mjs` — bật `"vikini-design/no-uppercase": "error"` cho `src/**/*.{ts,tsx}` (trừ test files và `src/lib/utils/translations/**`), thêm override tắt `"vikini-design/no-uppercase"` riêng cho `src/app/features/sidebar/components/SidebarSection.tsx`, đồng thời nâng `"react-hooks/exhaustive-deps"` lên `"error"` tại `:33`.
- [MODIFY] `src/app/components/EditImagePromptModal.tsx` — gỡ `uppercase tracking-wider` tại `:59`.
- [MODIFY] `src/app/features/chat/components/BubbleHelpers.tsx` — gỡ `uppercase tracking-wider` tại `:102`.
- [MODIFY] `src/app/features/chat/components/BubbleMarkdown.tsx` — gỡ `uppercase` trên `<th>` markdown tại `:140`.
- [MODIFY] `src/app/features/chat/components/ChatBubble.tsx` — gỡ `uppercase tracking-wider` tại `:270` và `:277`.
- [MODIFY] `src/app/features/chat/components/FileManagerPanel.tsx` — gỡ `tracking-wide uppercase` tại `:117`.
- [MODIFY] `src/app/features/chat/components/LocalSamplingSettings.tsx` — gỡ `uppercase tracking-wider` tại `:113`, `:130` và đổi nhãn `"SAMPLING"` thành `"Sampling"` tại `:118`.
- [MODIFY] `src/app/features/chat/components/ModelSelector.tsx` — gỡ `uppercase tracking-wider` tại `:65` và `:91`.
- [MODIFY] `src/app/features/chat/components/SmartCode.tsx` — gỡ `uppercase tracking-wider` tại `:116` (giữ nguyên `{lang}` chữ thường để khớp `src/app/features/chat/components/SmartCode.test.tsx:102`).
- [MODIFY] `src/app/features/gems/components/GemPreview.tsx` — gỡ `uppercase tracking-wider` tại `:44`, `:54`, `:68`.
- [MODIFY] `src/app/features/image-gen/components/PromptBuilder.tsx` — gỡ `uppercase tracking-wider` (`:190`, `:212`, `:244`), gỡ `normal-case` thừa (`:216`), và thay toàn bộ `text-muted-foreground` bằng `text-(--muted)` (`:190`, `:212`, `:222`, `:224`, `:244`).
- [MODIFY] `src/app/features/layout/components/HeaderBar.tsx` — gỡ `uppercase tracking-wider` (`:52`, `:116`) và `uppercase tracking-widest` (`:182`).
- [MODIFY] `src/app/features/layout/components/ThemeMenuItems.tsx` — gỡ `uppercase tracking-widest` tại `:15`.
- [MODIFY] `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx` — gỡ `uppercase` tại `:280`.
- [MODIFY] `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx` — gỡ `uppercase tracking-wider` tại `:71`.
- [MODIFY] `src/app/features/novelcrafter/components/ChapterFeedbackGutter.tsx` — gỡ `uppercase tracking-wider` tại `:259`.
- [MODIFY] `src/app/features/novelcrafter/components/ManuscriptTypographyMenu.tsx` — gỡ class `uppercase` tại `:68`, `:114`, `:172` và chuyển mã cỡ chữ (`sm`/`md`/`lg`/`xl`) sang `.toUpperCase()` ở chuỗi dữ liệu tại `:68`, `:116`, `:178`.
- [MODIFY] `src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx` — gỡ `uppercase` tại `:275`.
- [MODIFY] `src/app/features/personas/components/PersonaEditor.tsx` — gỡ `uppercase tracking-wider` tại `:151`, `:178` và sửa cảnh báo `exhaustive-deps` tại `:51-63` bằng `syncedPersonaKeyRef`.
- [MODIFY] `src/app/features/personas/components/PersonaPreview.tsx` — gỡ `uppercase tracking-wider` tại `:59`, `:68`, `:83`, `:93`.
- [MODIFY] `src/app/features/sidebar/components/RailMenus.tsx` — gỡ `uppercase tracking-widest` tại `:24`.
- [MODIFY] `src/components/ui/IconPicker.tsx` — gỡ `uppercase tracking-wider` tại `:154` và `:182`.

**Nhóm Hạng Mục 2b — Khử Sạch 17 Cảnh Báo `react-hooks/exhaustive-deps` & Test Co-Located (11 files bổ sung)**

- [MODIFY] `src/app/admin/components/UserManager.tsx` — bọc `fetchUsers` trong `useCallback` ổn định với `tRef` và gọi trong `useEffect([fetchUsers])` tại `:67-84`.
- [MODIFY] `src/app/features/chat/components/ChatMessagesArea.tsx` — khởi tạo `sizeCache` bằng `useMemo(() => createSizeCache(100), [])` và xóa cache khi đổi `selectedConversationId` bằng `useEffect` tại `:92`.
- [MODIFY] `src/app/features/chat/components/hooks/useChatStreamController.ts` — tách các hàm ổn định từ `useThinkingStats` (`markThinking`, `markAnswer`, `reset`) + `thinkingStatsSnapshotRef` và `resetBuffer` từ `useTypewriterBuffer`, hoàn thiện mảng phụ thuộc cho 5 `useCallback` tại `:309`, `:364`, `:524`, `:716`, `:827`.
- [MODIFY] `src/app/features/chat/components/hooks/useChatTranslations.ts` — bỏ biến `language` dư thừa khỏi destructuring và khỏi `useMemo` tại `:127-136`.
- [MODIFY] `src/app/features/chat/hooks/useConversation.ts` — bổ sung `t` vào mảng phụ thuộc `useCallback` của `createConversation` (`:428`), `renameConversation` (`:455`), và `deleteConversation` (`:511`).
- [MODIFY] `src/app/features/gallery/components/hooks/useGalleryController.ts` — chuyển `offset` phân trang nội bộ sang `offsetRef = useRef(0)` kết hợp `tRef`, bọc `fetchImages` bằng `useCallback(..., [showFavoritesOnly])` và gọi trong `useEffect([fetchImages])` tại `:70-140`.
- [MODIFY] `src/app/features/image-gen/components/DescribeImageView.tsx` — cập nhật dependency array `handleAnalyze` tại `:162` thành `[imageFile, imagePreview, addToHistory]`.
- [MODIFY] `src/app/features/image-gen/components/ImageGenStudio.tsx` — destructure `{ t, fetchBatchQuota } = studio`, cập nhật `useEffect([isAuthed, fetchBatchQuota])` tại `:52-54`, xóa `useEffect` rỗng không còn tác dụng tại `:56-62`, và thay `bg-surface text-primary` bằng `bg-(--bg) text-(--text)` tại `:67`.
- [MODIFY] `src/app/features/novelcrafter/hooks/useChapterEditorController.ts` — dùng `syncedChapterIdRef` tại `:66-83` để chỉ reset trạng thái panel/quickEdit khi chuyển sang `chapterId` khác, kèm `chapterId` trong dependency array.
- [NEW] `src/app/features/novelcrafter/hooks/useChapterEditorController.test.ts` — kiểm thử co-located xác minh gõ nội dung trong cùng `chapterId` không làm đóng `quickEditOpen` hay mất `quickEditPrompt`, còn đổi `chapterId` thì reset sạch.
- [NEW] `src/app/features/personas/components/PersonaEditor.test.tsx` — kiểm thử co-located xác minh khi cha render lại với object `persona` mới nhưng cùng `persona.id`, nội dung người dùng đang sửa không bị ghi đè ngược, còn khi đổi sang `persona.id` khác thì form nạp đúng dữ liệu mới.

**Nhóm Hạng Mục 2c — Nút Dừng `--accent` & Quầng Sáng `--glow` Phía Sau Khung Nhập (6 files)**

- [MODIFY] `src/app/features/chat/components/InputForm.tsx` — đổi nhánh `isStreaming` của nút Dừng tại `:223` sang `bg-(--accent) text-(--on-accent) ring-2 ring-(--accent)/30 hover:brightness-110 active:scale-[0.92]`.
- [MODIFY] `src/app/features/chat/components/InputForm.test.tsx` — cập nhật ca kiểm thử Loại C tại `:114-134` sang khẳng định `bg-(--accent)`, `text-(--on-accent)`, `ring-(--accent)/30` và không chứa `bg-(--danger)`.
- [MODIFY] `src/app/styles/themes/_shared/utilities.css` — định nghĩa lớp `.composer-horizon-glow` dùng `radial-gradient` với `var(--glow)` tại `:6-10`.
- [MODIFY] `src/app/features/chat/components/ChatControls.tsx` — thêm lớp nền quầng sáng `pointer-events-none` (`data-testid="composer-horizon-glow"`) bao phía sau hộp nhập ở cả chế độ thường và `isLanding` tại `:122-125`.
- [NEW] `src/app/features/chat/components/ChatControls.test.tsx` — kiểm thử co-located xác minh phần tử quầng sáng `composer-horizon-glow` hiện diện với `pointer-events-none` và `aria-hidden="true"` ở cả chế độ thường và `isLanding={true}`.
- [MODIFY] `src/app/features/projects/components/ProjectChatView.tsx` — bọc khung `InputForm` trong wrapper `relative` kèm phần tử `.composer-horizon-glow` `pointer-events-none` tại `:108-131`.

**Tài Liệu Sống (Living Docs — 2 files)**

- [MODIFY] `docs/CHANGELOG.md` — ghi nhận các bản vá và nâng cấp chất lượng của Vikini 3.0 Giai đoạn 6E.
- [MODIFY] `docs/lessons-learned.md` — ghi nhận bài học phòng ngừa lỗi gọi lặp popover khi danh sách rỗng, phòng thủ mảng API ở cả 2 tầng, và mẫu `syncedIdRef` cho form/editor khi bật `exhaustive-deps: "error"`.

---

### 6. Caller-First Design Sketch

#### 6.1. `PersonaQuickSwitch` & `GemQuickSwitch` — Chốt Chặn 1 Request Mỗi Lượt Mở Popover (Hạng mục 1a)

```tsx
// src/app/features/personas/components/PersonaQuickSwitch.tsx
const requestedRef = useRef(false);
const tRef = useRef(t);
useEffect(() => {
  tRef.current = t;
}, [t]);

useEffect(() => {
  if (!open) {
    requestedRef.current = false;
    return;
  }
  if (requestedRef.current || personas.length > 0) return;

  let cancelled = false;
  requestedRef.current = true;
  setLoading(true);

  fetch("/api/personas")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((json: unknown) => {
      if (cancelled) return;
      const payload =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: { personas?: unknown } }).data
          : (json as { personas?: unknown } | null);
      setPersonas(Array.isArray(payload?.personas) ? (payload.personas as PersonaForUI[]) : []);
    })
    .catch((error: unknown) => {
      if (cancelled) return;
      logger.error("[PersonaQuickSwitch] Failed to load personas:", error);
      toast.error(tRef.current("personaLoadFailed"));
      setPersonas([]);
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [open, personas.length]);
```

#### 6.2. Phòng Thủ 2 Tầng Cho `KnowledgePanel` (`M7` — Hạng mục 1b)

```tsx
// Caller 1: src/app/projects/[id]/page.tsx:48-65
const fetchDocuments = useCallback(async () => {
  try {
    const res = await fetch(`/api/projects/${projectId}/knowledge`);
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error?.message || "Failed to load documents");
    }
    setDocuments(Array.isArray(data?.data?.documents) ? data.data.documents : []);
    setStorageInfo({
      usedBytes: data?.data?.storage?.usedBytes ?? 0,
      maxBytes: data?.data?.storage?.maxBytes ?? 10 * 1024 * 1024,
    });
  } catch (error: unknown) {
    logger.error("[ProjectDetailPage] Failed to fetch knowledge documents:", error);
    toast.error(t("projectKnowledgeLoadFailed"));
  }
}, [projectId, t]);

// Component con: src/components/features/projects/KnowledgePanel.tsx:37-52
export function KnowledgePanel({ documents, ...rest }: KnowledgePanelProps) {
  const safeDocuments = Array.isArray(documents) ? documents : [];
  // Dòng 208 & 215 luôn đọc safeDocuments.length và safeDocuments.map(...)
}
```

#### 6.3. Bootstrap `<html lang>` Không Chớp & `<RootSkipLink />` Song Ngữ (`M6` — Hạng mục 1c)

```ts
// src/app/features/layout/components/LanguageUpdater.tsx
export function resolveInitialLanguage(
  stored: string | null,
  navigatorLang?: string
): SupportedLanguage {
  if (stored === "vi" || stored === "en") return stored;
  if (stored && stored.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(stored);
      const lang =
        typeof parsed === "object" &&
        parsed !== null &&
        "state" in parsed &&
        typeof (parsed as { state?: { language?: unknown } }).state?.language === "string"
          ? (parsed as { state: { language: string } }).state.language
          : null;
      if (lang === "vi" || lang === "en") return lang;
    } catch {
      // Ignore malformed JSON and fall through to navigator language
    }
  }
  return navigatorLang?.toLowerCase().startsWith("vi") ? "vi" : "en";
}
```

```tsx
// src/app/layout.tsx — inline synchronous script trong <head> + <RootSkipLink />
const LANGUAGE_BOOTSTRAP_SCRIPT = `(function(){try{var s=localStorage.getItem("vikini-language"),l=null;if(s==="vi"||s==="en"){l=s;}else if(s&&s.charAt(0)==="{"){var p=JSON.parse(s);if(p&&p.state&&(p.state.language==="vi"||p.state.language==="en")){l=p.state.language;}}if(!l){var n=(navigator.language||"").toLowerCase();l=n.indexOf("vi")===0?"vi":"en";}document.documentElement.lang=l;}catch(e){}})();`;

// src/app/features/layout/components/RootSkipLink.tsx
("use client");
const WORKSPACE_SKIP_LINK_ROUTES = new Set(["/", "/novelcrafter", "/novelcrafter/prompts"]);

export default function RootSkipLink() {
  const pathname = usePathname();
  const { t } = useLanguage();
  if (pathname && WORKSPACE_SKIP_LINK_ROUTES.has(pathname)) return null;
  return (
    <a
      href="#main"
      suppressHydrationWarning
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-(--accent) focus:text-(--on-accent) focus:text-xs focus:font-semibold"
    >
      {t("skipToMainContent")}
    </a>
  );
}
```

#### 6.4. Rule ESLint `vikini-design/no-uppercase` (Hạng mục 2a)

```js
// scripts/vikini-design-lint.mjs
const UPPERCASE_CLASS_RE = /(?<![a-zA-Z0-9_-])(?:[a-z0-9-]+:)*(?:!)?uppercase(?![a-zA-Z0-9_-])/g;

export function findUppercaseClasses(value) {
  return Array.from(new Set(value.match(UPPERCASE_CLASS_RE) ?? []));
}
// Đăng ký vikiniDesignPlugin.rules["no-uppercase"] báo lỗi:
// "Vikini 3.0: avoid `{{token}}` — uppercase is reserved strictly for sidebar group labels (SidebarSection.tsx)."
```

#### 6.5. Bảng Thiết Kế Chi Tiết Cho Cả 17 Cảnh Báo `react-hooks/exhaustive-deps` (Hạng mục 2b)

| #    | File & Dòng Cảnh Báo                                                                                    | Nguyên Nhân Gốc                                                                                                                                                                                                             | Giải Pháp Chính Xác (Không Sinh Loop / Không Mất Dữ Liệu Đang Gõ)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `src/app/admin/components/UserManager.tsx:69`                                                           | `useEffect(() => { fetchUsers(); }, [])` gọi hàm `fetchUsers` khai báo thường bên ngoài                                                                                                                                     | Giữ `tRef = useRef(t)` đồng bộ qua `useEffect`, bọc `fetchUsers` trong `useCallback(async () => { ... }, [])`, rồi gọi `useEffect(() => { void fetchUsers(); }, [fetchUsers])`                                                                                                                                                                                                                                                                                                                          |
| 2    | `src/app/features/chat/components/ChatMessagesArea.tsx:92`                                              | `useMemo(() => createSizeCache(100), [selectedConversationId])` có dependency không đọc trong thân callback                                                                                                                 | Đổi thành `const sizeCache = useMemo(() => createSizeCache(100), []);` và thêm `useEffect(() => { sizeCache.clear(); }, [selectedConversationId, sizeCache]);`                                                                                                                                                                                                                                                                                                                                          |
| 3–7  | `src/app/features/chat/components/hooks/useChatStreamController.ts:309`, `:364`, `:524`, `:716`, `:827` | `thinkingStats` và `typewriter` là object mới mỗi lần render (khi số giây suy luận nhảy) nhưng được gọi qua `thinkingStats.reset()` / `markThinking()` / `markAnswer()` và `typewriter.resetBuffer()` trong 5 `useCallback` | Destructure trực tiếp các hàm ổn định `{ stats: streamingThinkingStats, markThinking, markAnswer, reset: resetThinkingStats } = useThinkingStats()` + `thinkingStatsSnapshotRef = useRef(streamingThinkingStats)` (đồng bộ qua `useEffect` để đọc snapshot khi lưu partial message trong `cancelStream`) và `{ appendToBuffer, flushRemaining, resetBuffer: resetTypewriterBuffer } = useTypewriterBuffer(onTypewriterChunk)`; đưa đúng các hàm ổn định này vào dependency array của cả 5 `useCallback` |
| 8    | `src/app/features/chat/components/hooks/useChatTranslations.ts:135`                                     | `useMemo(..., [tRaw, language])` có `language` dư thừa vì `tRaw` đã đổi tham chiếu theo `language`                                                                                                                          | Bỏ `language` khỏi destructuring `useLanguage()` và dùng `[tRaw]` trong `useMemo`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9–11 | `src/app/features/chat/hooks/useConversation.ts:428`, `:455`, `:511`                                    | `createConversation`, `renameConversation`, `deleteConversation` gọi `t(...)` cho `toast.error` nhưng thiếu `t` trong deps                                                                                                  | Bổ sung `t` vào mảng phụ thuộc của cả 3 `useCallback` (`t` đã được ổn định hóa bằng `useCallback` trong `src/app/features/chat/hooks/useLanguage.ts:19-31` và không nằm trong bất kỳ `useEffect` tự động fetch nào)                                                                                                                                                                                                                                                                                     |
| 12   | `src/app/features/gallery/components/hooks/useGalleryController.ts:139`                                 | `useEffect(() => { fetchImages(false); }, [showFavoritesOnly])` thiếu `fetchImages`, trong khi `fetchImages` đang đọc state `offset`                                                                                        | Đổi `offset` nội bộ (không xuất ra ngoài hook) sang `offsetRef = useRef(0)` + `tRef = useRef(t)`, bọc `fetchImages = useCallback(async (resetOffset = false) => { ... }, [showFavoritesOnly])`, và gọi `useEffect(() => { void fetchImages(false); }, [fetchImages])`                                                                                                                                                                                                                                   |
| 13   | `src/app/features/image-gen/components/DescribeImageView.tsx:162`                                       | `handleAnalyze` (`useCallback`) dùng `addToHistory` (Zustand selector ổn định) và `imagePreview` nhưng chỉ khai báo `[imageFile]`                                                                                           | Đổi mảng phụ thuộc tại `:162` thành `[imageFile, imagePreview, addToHistory]`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 14   | `src/app/features/image-gen/components/ImageGenStudio.tsx:54`                                           | `useEffect` gọi `studio.fetchBatchQuota()` nhưng chỉ khai báo `[isAuthed, studio.fetchBatchQuota]` khiến rule yêu cầu cả object `studio`                                                                                    | Destructure `const { t, fetchBatchQuota } = studio;` ở đầu component, dùng `[isAuthed, fetchBatchQuota]` tại `:52-54`, và xóa `useEffect` rỗng chú thích cũ tại `:56-62`                                                                                                                                                                                                                                                                                                                                |
| 15   | `src/app/features/novelcrafter/hooks/useChapterEditorController.ts:82`                                  | `useEffect` đồng bộ khi đổi `chapterId` đọc `chapterContent` nhưng thiếu `chapterContent` trong deps; nếu thêm thẳng sẽ xóa `quickEditPrompt` mỗi lần người dùng gõ chữ                                                     | Thêm `syncedChapterIdRef = useRef<string                                                                                                                                                                                                                                                                                                                                                                                                                                                                | null>(null)`trong`useEffect([chapterId, chapterContent])`: luôn giữ `if (!chapterId) { syncedChapterIdRef.current = null; setDraftContent(""); return; }`, còn khi `syncedChapterIdRef.current !== chapterId`mới cập nhật`syncedChapterIdRef.current = chapterId`, nạp `setDraftContent(chapterContent)`và reset`beatsOpen`/`activeFeedbackId`/`quickEditOpen`/`quickEditPrompt` |
| 16   | `src/app/features/personas/components/PersonaEditor.tsx:62`                                             | `useEffect` khởi tạo form chỉ theo dõi `[persona?.id]`; nếu thêm thẳng `[persona]` mà cha tạo object mới cùng `id` sẽ xóa mất nội dung người dùng đang gõ                                                                   | Dùng `syncedPersonaKeyRef = useRef<string                                                                                                                                                                                                                                                                                                                                                                                                                                                               | undefined>(undefined)`với`const personaKey = persona ? (persona.id                                                                                                                                                                                                                                                                                                               |     | "**new**") : "**empty**";`bên trong`useEffect([persona])`: chỉ nạp lại các trường `name`, `icon`, `color`, `description`, `instructions`khi`syncedPersonaKeyRef.current !== personaKey` |
| 17   | `src/app/projects/[id]/page.tsx:65`                                                                     | `fetchDocuments` (`useCallback`) gọi `t("projectKnowledgeLoadFailed")` nhưng chỉ khai báo `[projectId]`                                                                                                                     | Đổi mảng phụ thuộc thành `[projectId, t]`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

#### 6.6. Nút Dừng `--accent` & Quầng Sáng `--glow` Phía Sau Khung Nhập (Hạng mục 2c)

```css
/* src/app/styles/themes/_shared/utilities.css */
.composer-horizon-glow {
  background: radial-gradient(ellipse 85% 70% at 50% 85%, var(--glow), transparent 75%);
  filter: blur(20px);
}
```

```tsx
// src/app/features/chat/components/ChatControls.tsx:122-125
<div className={boxWrapperClass}>
  <div className="relative">
    <div
      aria-hidden="true"
      data-testid="composer-horizon-glow"
      className="pointer-events-none absolute -inset-x-6 -inset-y-3 rounded-4xl composer-horizon-glow"
    />
    <div className="relative z-10">
      <InputForm ... />
    </div>
  </div>
  {/* Disclaimer giữ nguyên bên dưới */}
</div>
```

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

- [ ] **Bước 1 (Hạng mục 1a — `PersonaQuickSwitch` & `GemQuickSwitch`)**:
  - Cập nhật `src/app/features/personas/components/PersonaQuickSwitch.tsx:32-51` với `requestedRef`, `tRef`, cờ `cancelled` khi đóng popover/unmount, và thu hẹp kiểu `unknown` cho JSON trả về.
  - Cập nhật `src/app/features/gems/components/GemQuickSwitch.tsx:34-58`, `:124`, `:141` bổ sung `cancelled`, `tRef`, và `type="button"` trên 2 nút trong popover.
  - Mở rộng `src/app/features/personas/components/PersonaQuickSwitch.test.tsx` và `src/app/features/gems/components/GemQuickSwitch.test.tsx`; chạy `npm run type-check`.
- [ ] **Bước 2 (Hạng mục 1b — `M7` Phòng vệ `KnowledgePanel` & Trang Dự Án)**:
  - Chuẩn hóa `Array.isArray(data?.data?.documents) ? data.data.documents : []` tại `src/app/projects/[id]/page.tsx:59` (kèm `[projectId, t]` tại `:65` và đổi class nút New Chat tại `:310` sang `bg-(--accent) text-(--on-accent) hover:brightness-110`) và tại `src/components/features/projects/ProjectSettingsModal.tsx:74`.
  - Thêm `const safeDocuments = Array.isArray(documents) ? documents : [];` tại `src/components/features/projects/KnowledgePanel.tsx:37-52` và dùng `safeDocuments` tại `:208`, `:215`.
  - Cập nhật `src/components/features/projects/KnowledgePanel.test.tsx` và tạo `src/app/projects/[id]/page.test.tsx`; chạy `npm run type-check`.
- [ ] **Bước 3 (Hạng mục 1c — `M6` Bootstrap `<html lang>`, Token `<body>` & `RootSkipLink`)**:
  - Xuất `resolveInitialLanguage` trong `src/app/features/layout/components/LanguageUpdater.tsx` và cập nhật `LanguageUpdater.test.tsx`.
  - Tạo `src/app/features/layout/components/RootSkipLink.tsx` + `RootSkipLink.test.tsx`.
  - Cập nhật `src/app/layout.tsx:48-56` (thêm inline bootstrap script trong `<head>`, đổi `<body>` sang `bg-(--bg) text-(--text)`, gắn `<RootSkipLink />`) và dọn `bg-surface text-primary` tại `src/app/features/chat/components/ChatApp.tsx:234`; chạy `npm run type-check`.
- [ ] **Bước 4 (Hạng mục 2a — Gỡ `uppercase` trên 21 file UI & Thêm Rule `vikini-design/no-uppercase`)**:
  - Gỡ sạch 37 lượt `uppercase` (kèm `tracking-wider`/`tracking-widest`/`tracking-wide` chỉ phục vụ in hoa) trên đúng 21 file `.tsx` đã liệt kê ở Mục 5, chuyển mã cỡ chữ trong `src/app/features/novelcrafter/components/ManuscriptTypographyMenu.tsx:68`, `:116`, `:178` sang `.toUpperCase()`, đổi `"SAMPLING"` sang `"Sampling"` tại `src/app/features/chat/components/LocalSamplingSettings.tsx:118`, và sửa 5 chỗ `text-muted-foreground` sang `text-(--muted)` tại `src/app/features/image-gen/components/PromptBuilder.tsx:190-244`.
  - Mở rộng `scripts/vikini-design-lint.mjs` + `scripts/vikini-design-lint.test.ts` với `findUppercaseClasses` và rule `"no-uppercase"`, đăng ký `"vikini-design/no-uppercase": "error"` (miễn trừ `SidebarSection.tsx`) trong `eslint.config.mjs`.
- [ ] **Bước 5 (Hạng mục 2b — Xử lý 17 cảnh báo `react-hooks/exhaustive-deps` & Khóa mức `"error"`)**:
  - Thực hiện chính xác 17 chỉnh sửa trên 11 file theo Bảng 6.5 (`UserManager.tsx`, `ChatMessagesArea.tsx`, `useChatStreamController.ts`, `useChatTranslations.ts`, `useConversation.ts`, `useGalleryController.ts`, `DescribeImageView.tsx`, `ImageGenStudio.tsx`, `useChapterEditorController.ts`, `PersonaEditor.tsx`, `src/app/projects/[id]/page.tsx`).
  - Tạo `src/app/features/novelcrafter/hooks/useChapterEditorController.test.ts` và `src/app/features/personas/components/PersonaEditor.test.tsx` để kiểm chứng bảo toàn chữ đang gõ.
  - Nâng `"react-hooks/exhaustive-deps"` từ `"warn"` lên `"error"` tại `eslint.config.mjs:33`; chạy `npm run lint` xác nhận 0 error, 0 warning.
- [ ] **Bước 6 (Hạng mục 2c — Nút Dừng `--accent` & Quầng Sáng `--glow`)**:
  - Cập nhật `src/app/features/chat/components/InputForm.tsx:223` và ca test Loại C tại `src/app/features/chat/components/InputForm.test.tsx:114-134`.
  - Thêm `.composer-horizon-glow` vào `src/app/styles/themes/_shared/utilities.css:6-10`, gắn lớp quầng sáng phía sau composer tại `src/app/features/chat/components/ChatControls.tsx:122-125` (+ tạo `ChatControls.test.tsx`) và `src/app/features/projects/components/ProjectChatView.tsx:108-131`.
- [ ] **Bước 7 (Kiểm Chứng Toàn Diện, Visual QA & Cập Nhật Living Docs)**:
  - Chạy `npm run type-check; npm run lint; npm run test:run` và chạy Playwright `npx playwright test tests/e2e/a11y.spec.ts`.
  - Thực hiện Visual QA Gate theo `.agents/rules/02-quality.md`: bật `next dev`, chụp ảnh `.png` ở Desktop (`1440px`) & Mobile (`375px`) × Dark/Light (đặc biệt kiểm tra quầng sáng `--glow` ở Hoàng Hôn Dark/Light so với Mực/Than, nút Dừng `--accent`, và trang Dự Án), dùng `read_file` đọc trực tiếp từng ảnh để nghiệm thu thị giác.
  - Cập nhật `docs/CHANGELOG.md` và `docs/lessons-learned.md`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Mã TC        | Hạng Mục / File Đích                                              | Input & Điều Kiện Biên                                                                                                                                                                                                                                                                                            | Hành Vi & Output Kỳ Vọng (Pass Criteria)                                                                                                                                                                                                                                                                           | Phân Loại                                              |
| ------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **TC-6E-01** | `PersonaQuickSwitch.test.tsx` & `GemQuickSwitch.test.tsx`         | Mở popover khi `fetch("/api/personas")` trả `{ personas: [] }` hoặc lỗi HTTP `500`; đổi ngôn ngữ khi popover đang mở; đóng rồi mở lại popover                                                                                                                                                                     | Mỗi lượt mở chỉ gọi `fetch` đúng `1` lần (`toHaveBeenCalledTimes(1)`) và lỗi chỉ bắn `toast.error` đúng `1` lần; đổi ngôn ngữ không gọi lại `fetch`; đóng rồi mở lại gọi lần thứ `2`; mọi `<button>` trong `PopoverContent` có `type="button"`                                                                     | Mới (Co-located)                                       |
| **TC-6E-02** | `KnowledgePanel.test.tsx` & `src/app/projects/[id]/page.test.tsx` | 1) Truyền `documents={undefined as unknown as KnowledgeDocument[]}` vào `<KnowledgePanel />`; 2) Mock `/api/projects/p1/knowledge` trả `{ success: true, data: {} }` trên `ProjectDetailPage`                                                                                                                     | Không ném `TypeError` (`reading 'length'`), hiển thị thông báo danh sách tài liệu trống; nút New Chat trên `ProjectDetailPage` có class `bg-(--accent)` và `text-(--on-accent)`, không còn `bg-primary`                                                                                                            | Mới (Co-located)                                       |
| **TC-6E-03** | `LanguageUpdater.test.tsx` & `RootSkipLink.test.tsx`              | 1) `resolveInitialLanguage` nhận `"vi"`, `'{"state":{"language":"vi"}}'`, JSON lỗi `'{'`, hoặc `null` kèm `navigatorLang = "vi-VN"` / `"en-US"`; 2) Render `<RootSkipLink />` ở `/images` vs `/` khi đổi `useLanguageStore` `"vi"` ↔ `"en"`                                                                       | 1) Trả `"vi"` cho chuỗi/JSON `"vi"` và `navigatorLang = "vi-VN"`, trả `"en"` cho `"en-US"` mà không làm gãy `src/app/features/layout/components/LanguageUpdater.test.tsx:42-77`; 2) Ở `/images` render `<a href="#main">` đổi nhãn đúng bản dịch Việt/Anh, ở `/` trả `null` để không trùng skip-link của `ChatApp` | Mới (Co-located)                                       |
| **TC-6E-04** | `scripts/vikini-design-lint.test.ts`                              | Truyền `"text-xs uppercase tracking-wider"`, `"md:uppercase"`, `"!uppercase"` vs `"text-xs font-medium"` vào `findUppercaseClasses` & rule `vikini-design/no-uppercase`                                                                                                                                           | Bắt chính xác cả 3 biến thể dương tính; cho qua chuỗi không chứa token `uppercase`; `src/app/features/sidebar/components/SidebarSection.tsx:69` được miễn trừ hợp lệ trong `eslint.config.mjs`                                                                                                                     | Mới (Co-located)                                       |
| **TC-6E-05** | `PersonaEditor.test.tsx` & `useChapterEditorController.test.ts`   | 1) Người dùng sửa trường `name` trong `PersonaEditor` rồi parent re-render truyền object `{ ...persona }` mới cùng `id`; sau đó truyền `persona` có `id` khác; 2) Người dùng mở `quickEditOpen` + nhập `quickEditPrompt` trong `useChapterEditorController` rồi `chapterContent` đổi nhưng `chapterId` giữ nguyên | 1) Giữ nguyên chuỗi người dùng đang gõ khi cùng `persona.id`, nạp lại dữ liệu mới khi đổi sang `persona.id` khác; 2) Giữ nguyên `quickEditOpen === true` và `quickEditPrompt` khi cùng `chapterId`, reset sạch khi chuyển sang `chapterId` mới                                                                     | Mới (Co-located)                                       |
| **TC-6E-06** | `src/app/features/chat/components/InputForm.test.tsx:114-134`     | Render `<InputForm isStreaming={true} onCancel={...} />`                                                                                                                                                                                                                                                          | Nút Dừng (`aria-label="Stop"`) có `bg-(--accent)`, `text-(--on-accent)`, `ring-(--accent)/30`, và **không** chứa `bg-(--danger)` hay `text-white`                                                                                                                                                                  | **Loại C** (Đổi đặc tả nút Dừng theo Brief Vikini 3.0) |
| **TC-6E-07** | `ChatControls.test.tsx`                                           | Render `<ChatControls isLanding={false} ... />` và `<ChatControls isLanding={true} ... />`                                                                                                                                                                                                                        | Đều xuất hiện phần tử `data-testid="composer-horizon-glow"` mang `aria-hidden="true"`, `pointer-events-none`, và `composer-horizon-glow` nằm phía sau `InputForm`                                                                                                                                                  | Mới (Co-located)                                       |
| **TC-6E-08** | `tests/e2e/a11y.spec.ts:101-128`                                  | Quét axe-core trên cả 7 route (`/`, `/?id=conv-e2e-123`, `/images`, `/gallery`, `/describe`, `/gems`, `/novelcrafter`) × Desktop/Mobile + mobile options sheet                                                                                                                                                    | `expect(await nameViolations(page)).toEqual([])` đạt 100% pass (0 vi phạm `link-name` / `button-name`)                                                                                                                                                                                                             | Hồi quy E2E                                            |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1. Lệnh Chạy Kiểm Thử Chuẩn (Windows PowerShell 5.1 — Dùng `;`)

```powershell
# 1. Chạy unit tests co-located trọng tâm của Giai đoạn 6E
npx vitest run --reporter=dot scripts/vikini-design-lint.test.ts src/app/features/personas/components/PersonaQuickSwitch.test.tsx src/app/features/gems/components/GemQuickSwitch.test.tsx src/components/features/projects/KnowledgePanel.test.tsx "src/app/projects/[id]/page.test.tsx" src/app/features/layout/components/LanguageUpdater.test.tsx src/app/features/layout/components/RootSkipLink.test.tsx src/app/features/novelcrafter/hooks/useChapterEditorController.test.ts src/app/features/personas/components/PersonaEditor.test.tsx src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/ChatControls.test.tsx src/app/features/chat/components/hooks/useChatStreamController.test.ts

# 2. Chạy cổng kiểm chứng toàn cục Tier 2 (0 lỗi kiểu, 0 lỗi/cảnh báo lint, 100% unit tests xanh)
npm run type-check; npm run lint; npm run test:run

# 3. Chạy kiểm thử E2E Accessibility xác nhận skip-link song ngữ & các control trên 7 route
npx playwright test tests/e2e/a11y.spec.ts
```

#### 9.2. Wiring Probes (Kiểm Chứng Đấu Nối Thật)

```powershell
# Probe W1: Xác nhận chỉ còn duy nhất SidebarSection.tsx chứa class uppercase trên toàn bộ src/ (không tính comment test)
npx eslint "src/**/*.{ts,tsx}" --max-warnings=0

# Probe W2: Xác nhận không còn class màu chết bg-surface / text-primary / bg-primary / text-muted-foreground tại các file đã chạm
node -e "const fs=require('fs');const files=['src/app/layout.tsx','src/app/projects/[id]/page.tsx','src/app/features/image-gen/components/PromptBuilder.tsx','src/app/features/chat/components/ChatApp.tsx','src/app/features/image-gen/components/ImageGenStudio.tsx'];for(const f of files){const c=fs.readFileSync(f,'utf8');if(/\b(bg-surface|text-primary|bg-primary|text-primary-foreground|text-muted-foreground)\b/.test(c)){console.error('DEAD_CLASS_FOUND:',f);process.exit(1);}}console.info('WIRING_OK');"
```

#### 9.3. Negative Probes (Chứng Minh Chốt Chặn Bắt Đúng Vi Phạm Theo `.agents/agents/reviewer/evidence-bar.md` §4.5.3)

```powershell
# Negative Probe N1: Chứng minh ESLint chặn ngay class `uppercase` trên component bất kỳ ngoài SidebarSection.tsx (kỳ vọng exit code = 1 và báo rule vikini-design/no-uppercase)
"export function Probe() { return <span className='text-xs uppercase'>Bad</span>; }" | npx eslint --stdin --stdin-filename src/app/features/chat/components/Probe.tsx -f compact

# Negative Probe N2: Chứng minh ESLint chặn ngay lỗi thiếu dependency với react-hooks/exhaustive-deps ở mức error (kỳ vọng exit code = 1)
"import { useEffect } from 'react'; export function HookProbe({ id }: { id: string }) { useEffect(() => { console.warn(id); }, []); return null; }" | npx eslint --stdin --stdin-filename src/app/features/chat/components/HookProbe.tsx -f compact
```

#### 9.4. Visual QA Gate (Bắt Buộc Theo `.agents/rules/02-quality.md` & `.agents/rules/03-ui.md`)

- Khởi chạy `next dev` cục bộ, dùng Playwright chụp ảnh `.png` ở **Desktop (`1440×900`)** và **Mobile (`375×812`)** × **Dark / Light** cho:
  1. Màn hình Chat với theme **Hoàng Hôn** (kiểm chứng quầng sáng `.composer-horizon-glow` ấm áp phía sau khung nhập ở cả landing và hội thoại đang mở, nút Dừng màu `--accent`).
  2. Màn hình Chat với theme **Mực** hoặc **Than** (kiểm chứng `--glow: transparent` không rò vệt sáng phía sau composer).
  3. Màn hình chi tiết Dự Án `/projects/[id]` & thanh bên (kiểm chứng nút New Chat `--accent`, tiêu đề nhóm sidebar là nơi duy nhất in hoa).
- Gọi `read_file` đọc trực tiếp từng file `.png` vừa chụp để tự soi bố cục, độ tương phản và chữ trước khi kết thúc.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi Ro                                                                                                                                                                                                    | Mức Độ         | Phương Án Phòng Ngừa Kỹ Thuật & Probe Kiểm Chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1 — Mất dữ liệu người dùng đang gõ** khi sửa `exhaustive-deps` ở `src/app/features/personas/components/PersonaEditor.tsx:62` và `src/app/features/novelcrafter/hooks/useChapterEditorController.ts:82` | **Cao**        | Tuyệt đối không nạp đè state mù quáng trên mỗi lần `persona` hoặc `chapterContent` đổi tham chiếu; dùng `syncedPersonaKeyRef` (`src/app/features/personas/components/PersonaEditor.tsx:51-63`) và `syncedChapterIdRef` (`src/app/features/novelcrafter/hooks/useChapterEditorController.ts:66-83`), khóa chặt bằng 2 unit test hồi quy **TC-6E-05**                                                                                                                                                               |
| **R2 — Tái tạo hàm stream liên tục mỗi giây suy luận** khi sửa 5 cảnh báo `exhaustive-deps` trong `src/app/features/chat/components/hooks/useChatStreamController.ts:309-827`                             | **Cao**        | Không đưa cả object `thinkingStats` vào mảng phụ thuộc `useCallback`; chỉ destructure 3 hàm ổn định `markThinking`, `markAnswer`, `reset` từ `src/app/features/chat/components/hooks/useThinkingStats.ts:23-65` và đọc giá trị thống kê tức thời qua `thinkingStatsSnapshotRef` khi hủy luồng, kiểm chứng qua `useChatStreamController.test.ts`                                                                                                                                                                   |
| **R3 — Lệch hydration hoặc gãy unit test jsdom** khi đồng bộ ngôn ngữ sớm ở `src/app/layout.tsx:44-57`                                                                                                    | **Trung bình** | Giữ nguyên `language: "en"` trong `src/lib/store/languageStore.ts:9-12`; gắn `suppressHydrationWarning` trên `<html>` (`src/app/layout.tsx:46`) và trên `<a href="#main">` của `RootSkipLink.tsx`; dùng chung logic `resolveInitialLanguage` (trong jsdom `navigator.language` là `"en-US"` nên vẫn ra `"en"`), kiểm chứng qua `src/app/features/layout/components/LanguageUpdater.test.tsx:42-77` và **TC-6E-03**                                                                                                |
| **R4 — Trùng lặp 2 skip-link hoặc rớt kiểm thử axe-core** trên `/`, `/novelcrafter`, `/novelcrafter/prompts`                                                                                              | **Trung bình** | `RootSkipLink.tsx` kiểm tra `usePathname()` ẩn mình trên 3 route đã có skip-link chuyên biệt (`src/app/features/chat/components/ChatApp.tsx:235-240`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:261-266`, `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:54-59`) và hiển thị `<a href="#main">` trên mọi route còn lại trỏ đúng vào `src/app/features/layout/components/MainLayout.tsx:8`, kiểm chứng bằng `tests/e2e/a11y.spec.ts:101-128` (**TC-6E-08**) |
| **R5 — Quầng sáng `.composer-horizon-glow` chặn thao tác chuột/chạm** vào các nút phía trên hoặc bên dưới ô nhập chat                                                                                     | **Trung bình** | Bắt buộc đặt `pointer-events-none` và `aria-hidden="true"` trên lớp quầng sáng ở cả `src/app/features/chat/components/ChatControls.tsx:122-125` và `src/app/features/projects/components/ProjectChatView.tsx:108-131`, đồng thời bọc `InputForm` trong `relative z-10`, kiểm chứng bằng **TC-6E-07**                                                                                                                                                                                                              |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- **Kiểm chứng lỗi cũ**: N/A (Revision 1 — lượt thẩm định đầu tiên).
- **Output `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6e-audit-polish-plan.md`** (Exit code `0`):

```text
[PASS] SECTIONS 7/7
[PASS] LINE_REF ... (86 tham chiếu file:line trong Technical Plan đều hợp lệ)
[INFO] CRITIC_REQUIRED no
[INFO] CRITIC_FLOOR skipped (no audit run)

VERIFY_PLAN: PASS (0 failures, 0 warnings)
```

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                                                                                                                | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | DEFECT         | [MAJOR] | `eslint.config.mjs:139-151`, `vitest.config.ts:11`                                                                                                                         | [CMD], [SRC] | `[CMD] npm run lint` và `[CMD] npm run verify` thoát với exit `1` (`4364 errors, 17 warnings`) vì `eslint.config.mjs:139-151` đã ignore `.agents/**` (`eslint.config.mjs:146`) nhưng bỏ sót `".claude/**"`, khiến `@typescript-eslint/parser` quét `.claude/worktrees/**` nằm ngoài `tsconfig.json`. Đồng thời `[CMD] npx vitest run src/app/features/layout/components/LanguageUpdater.test.tsx` thoát với exit `1` và `[CMD] npx vitest list --filesOnly` nạp nhầm `.claude/worktrees/**/node_modules/zod/**/*.test.ts` cùng bản sao test trong `.claude/worktrees/**` (ném `TypeError: Cannot read properties of null (reading 'useCallback')`) do `vitest.config.ts:11` đặt `exclude: ["tests/e2e/**", "node_modules/**"]` ghi đè mặc định `**/node_modules/**` và thiếu `".claude/**"`. Cần bổ sung `".claude/**"` vào `eslint.config.mjs:139-151` và khai báo `[MODIFY] vitest.config.ts` với `exclude: ["tests/e2e/**", "**/node_modules/**", ".claude/**"]` để Bước 5, Bước 7 và Verification Plan chạy được.                                                                                                                            |
| 2   | DEFECT         | [MAJOR] | `src/app/projects/[id]/page.tsx:26-31,48-65`                                                                                                                               | [SRC]        | Thiết kế Mục 6.2 và Bảng 6.5 #17 lệch hợp đồng mã nguồn thật tại `src/app/projects/[id]/page.tsx:26-31,48-65`: gọi `setStorageInfo(...)` không tồn tại (component truyền trực tiếp `project?.storage_bytes \|\| 0` tại `src/app/projects/[id]/page.tsx:234`), gọi `logger.error` / `toast.error` chưa import, dùng khóa dịch `t("projectKnowledgeLoadFailed")` không tồn tại trong `src/lib/utils/translations/en.ts:706` (sẽ gây lỗi biên dịch `TS2345`; khóa thật đang dùng tại `src/app/projects/[id]/page.tsx:56,61` là `t("fetchDocsFailed")`), và bỏ mất `setIsLoading(true)` / `setError(null)` / `finally { setIsLoading(false); }` khiến `isLoading` (`useState(true)` tại `src/app/projects/[id]/page.tsx:28`) kẹt vĩnh viễn ở `true`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | DEFECT         | [MAJOR] | `src/app/features/chat/components/hooks/useChatStreamController.ts:117-122,346-365,549-564,716,827`, `src/app/features/chat/components/hooks/useTypewriterBuffer.ts:84-91` | [SRC], [CMD] | Mục 2 và Bảng 6.5 #3–7 destructure `{ appendToBuffer, flushRemaining, resetBuffer: resetTypewriterBuffer } = useTypewriterBuffer(onTypewriterChunk)`, nhưng `src/app/features/chat/components/hooks/useTypewriterBuffer.ts:84-91` chỉ trả `{ bufferRef, accumulatedRef, startTypewriter, stopTypewriter, appendToTypewriterBuffer, resetBuffer }` (không có `appendToBuffer` hay `flushRemaining` ➔ gãy `npm run type-check`). Ngoài ra `[CMD] npm run lint` chỉ ra 3 nhóm phụ thuộc `react-hooks/exhaustive-deps` bị sót trong Bảng 6.5 #3–7: (a) dòng `:364` thiếu `'typewriterBufferRef'` do `:347` gán `typewriterBufferRef.current = ""` (cần thay `:347` bằng `resetTypewriterBuffer()` và bỏ destructure `bufferRef: typewriterBufferRef` tại `:118`); (b) dòng `:716` thiếu `'parseSSEEvent'` và `'t'` — trong đó `parseSSEEvent` (`src/app/features/chat/components/hooks/useChatStreamController.ts:549-564`) đang khai báo hàm thường nội tuyến nên đưa thẳng vào deps sẽ sinh lỗi `exhaustive-deps` mới (cần nhấc hàm thuần `parseSSEEvent` + `ParsedSSEEvent` ra phạm vi module); (c) dòng `:827` thiếu `'onStreamError'` và `'t'`. |
| 4   | DEFECT         | [MAJOR] | `src/app/features/novelcrafter/hooks/useChapterEditorController.ts:66-83`, `src/app/features/personas/components/PersonaEditor.tsx:41-63`                                  | [SRC], [CMD] | Tại `src/app/features/novelcrafter/hooks/useChapterEditorController.ts:66-83`, Bảng 6.5 #15 gọi `setDraftContent("")` và `setDraftContent(chapterContent)` nhưng hook không có state `draftContent`/`setDraftContent`; đồng thời dòng `:78` đang đọc `chapter?.content.trim().length` nên `[CMD] npm run lint` cảnh báo thiếu `'chapter?.content'` (cần đổi `:78` sang đọc `chapterContent.trim().length === 0` để khớp deps `[chapterId, chapterContent]`). Tại `src/app/features/personas/components/PersonaEditor.tsx:41-63`, Bảng 6.5 #16 chỉ liệt kê `name, icon, color, description, instructions` (trong đó `color` và `instructions` không tồn tại), cần ghi đúng 10 setter thực tế tại `:52-61` (`setId`, `setName`, `setDescription`, `setTone`, `setUseEmojis`, `setUseHeadersLists`, `setUserContext`, `setCustomInstructions`, `setIcon`, `setDirty(false)`).                                                                                                                                                                                                                                                                       |
| 5   | DEFECT         | [MAJOR] | `src/app/features/chat/components/LocalSamplingSettings.tsx:118`, `src/app/features/projects/components/ProjectChatView.tsx:108-131`                                       | [SRC]        | (a) Vi phạm chuẩn song ngữ `.agents/rules/04-bilingual.md:10` (Fail Criterion #6): dù kế hoạch đã nạp `.agents/skills/add-translation/SKILL.md`, Mục 5 và Bước 4 vẫn đổi `"SAMPLING"` tại `src/app/features/chat/components/LocalSamplingSettings.tsx:118` thành chuỗi tiếng Anh cứng `"Sampling"` thay vì qua `t(...)` (cần dùng khóa sẵn có tại `src/lib/utils/translations/en.ts:1355` hoặc khai báo `[MODIFY] src/lib/utils/translations/en.ts` + `src/lib/utils/translations/vi.ts` để thêm khóa song ngữ). (b) Lệch cấu trúc component tại `src/app/features/projects/components/ProjectChatView.tsx:108-131`: file này không render `InputForm` như kế hoạch mô tả mà render `<button onClick={onNewChat} className="... mb-8">` (`src/app/features/projects/components/ProjectChatView.tsx:109-130`); cần chuyển `mb-8` ra thẻ bọc `<div className="relative mb-8">` bên ngoài để quầng sáng `absolute -inset-y-3` không tràn vào margin đáy và bổ sung kiểm thử cho `ProjectChatView` trong **TC-6E-07**.                                                                                                                               |
| 6   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/PromptBuilder.tsx:198`, `scripts/vikini-design-lint.mjs:81-101`, `eslint.config.mjs:103`, `vitest.config.ts:8`                      | [SRC]        | (a) `src/app/features/image-gen/components/PromptBuilder.tsx:198` (nằm trong dải `:190-244` đang sửa) vẫn còn biến CSS không định nghĩa `bg-(--input-bg) border-(--input-border)` (không có trong `src/app/styles/themes/_shared/base.css:1-154`); (b) `createStringTokenRule` tại `scripts/vikini-design-lint.mjs:81-101` quét mọi `Literal`/`TemplateElement`, nên `"vikini-design/no-uppercase"` nên giới hạn `files: ["src/**/*.tsx"]` để tránh dương tính giả trên văn bản/prompt tiếng Anh chứa từ `"uppercase"` trong các file `.ts`; (c) Giả định A6 ghi `@typescript-eslint/no-unused-expressions: "error"` nhưng `eslint.config.mjs:103` thực tế là `"no-unused-expressions": ["warn", ...]`, môi trường test tại `vitest.config.ts:8` là `"happy-dom"` (không phải `jsdom`), và `src/app/features/chat/components/InputForm.test.tsx:126` tìm nút Dừng theo accessible name `/stop generation/i` (`title="Stop"`), không phải `aria-label="Stop"`.                                                                                                                                                                                    |
| 7   | RISK_DISMISSED | [MINOR] | `next.config.ts:70-80`, `src/app/layout.tsx:46`                                                                                                                            | [SRC]        | Bác bỏ lo ngại inline `<script>` đồng bộ hóa `<html lang>` trong `<head>` bị chặn bởi Content-Security-Policy hoặc gây lỗi hydration React 19: header CSP tại `next.config.ts:70-80` đã cấu hình `script-src 'self' 'unsafe-eval' 'unsafe-inline'` (`next.config.ts:73`) và thẻ `<html>` tại `src/app/layout.tsx:46` đã có `suppressHydrationWarning`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | RISK_DISMISSED | [MINOR] | `src/app/features/layout/components/MainLayout.tsx:8`, `src/app/features/chat/components/ChatApp.tsx:235-240`, `tests/e2e/a11y.spec.ts:32-53`                              | [SRC]        | Bác bỏ rủi ro trùng 2 skip-link hoặc mất đích `#main`: 3 route `/`, `/novelcrafter`, `/novelcrafter/prompts` đã có skip-link riêng (`src/app/features/chat/components/ChatApp.tsx:235-240`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:261-266`, `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:54-59`), còn các route còn lại bọc qua `src/app/features/layout/components/MainLayout.tsx:8` (`<main id="main">`), tương thích `tests/e2e/a11y.spec.ts:32-53,101-128`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                  | Kết quả  | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Plan Completeness Gate (7/7 Headings)**            | **PASS** | [CMD]        | `[CMD] node scripts/verify-plan.mjs` xác nhận đủ 7/7 heading bắt buộc (`[PASS] SECTIONS 7/7`), đủ Test Contract và ánh xạ các `SKILL.md` liên quan.                                                                                                                                                                                                                                                                                                                                                                      |
| **S1: Cold-start, Build & Toolchain Gate**           | **FAIL** | [CMD], [SRC] | `[CMD] npm run type-check` đạt exit `0`, nhưng `[CMD] npm run verify` và `[CMD] npm run lint` thoát exit `1` (`4364 errors`) do `eslint.config.mjs:139-151` thiếu ignore `".claude/**"`, còn `vitest.config.ts:11` làm `npx vitest run` gãy trên `.claude/worktrees/**` (Finding #1). Destructure sai `appendToBuffer`/`flushRemaining` từ `src/app/features/chat/components/hooks/useTypewriterBuffer.ts:84-91` và `t("projectKnowledgeLoadFailed")` sẽ làm gãy `tsc --noEmit` khi triển khai (Findings #2, #3).        |
| **S2: Runner Lifecycle & Teardown**                  | **PASS** | [SRC], [ADV] | Cờ `cancelled` trong `src/app/features/personas/components/PersonaQuickSwitch.tsx:32-51` và `src/app/features/gems/components/GemQuickSwitch.tsx:34-58` chặn `setState`/`toast.error` sau khi đóng popover hoặc unmount; `src/app/features/chat/components/hooks/useTypewriterBuffer.ts:76-82` và `src/app/features/chat/components/hooks/useThinkingStats.ts:36-40` đều dọn `clearInterval` khi unmount; `tests/setup.ts:5` gọi `cleanup()` sau mỗi test.                                                               |
| **S3: Database & Temporal Logic**                    | **N/A**  | [SRC]        | Kế hoạch chỉ sửa UI components, client hooks và cấu hình ESLint/test; không chạm bảng dữ liệu, RLS policy hay migration SQL.                                                                                                                                                                                                                                                                                                                                                                                             |
| **S4: Cross-Task State Flow**                        | **FAIL** | [SRC], [CMD] | Đối chiếu mã nguồn thật phát hiện gọi setter ảo `setStorageInfo` + bỏ sót `setIsLoading(false)` tại `src/app/projects/[id]/page.tsx:48-65` (Finding #2), sót 3 nhóm phụ thuộc `exhaustive-deps` tại `src/app/features/chat/components/hooks/useChatStreamController.ts:364,716,827` (Finding #3), và gọi setter ảo `setDraftContent` / lệch danh sách state tại `src/app/features/novelcrafter/hooks/useChapterEditorController.ts:66-83` & `src/app/features/personas/components/PersonaEditor.tsx:41-63` (Finding #4). |
| **S5: Security Boundary & 3-Tier Auth**              | **PASS** | [SRC]        | Không import `*.server.ts` vào Client Component, không lộ biến `.env*`; inline bootstrap script trong `src/app/layout.tsx:48` chỉ đọc khóa `"vikini-language"` và gán `"vi"` hoặc `"en"` tĩnh cho `document.documentElement.lang` (không nối chuỗi DOM/HTML nên không có bề mặt XSS), hợp lệ với CSP tại `next.config.ts:70-80`.                                                                                                                                                                                         |
| **S6: External Resilience & Serverless Cap**         | **N/A**  | [SRC]        | Kế hoạch không thay đổi API route backend, provider SDK client, timeout hay `maxDuration`.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Domain: Open Inquiry (Bilingual & Design System)** | **FAIL** | [SRC]        | Đổi `"SAMPLING"` sang chuỗi cứng `"Sampling"` tại `src/app/features/chat/components/LocalSamplingSettings.tsx:118` vi phạm `.agents/rules/04-bilingual.md:10`; bọc quầng sáng tại `src/app/features/projects/components/ProjectChatView.tsx:108-131` lệch phần tử thật (`<button>` mang `mb-8` thay vì `InputForm`) (Finding #5). Kiểm tra toàn bộ 22 file chứa `uppercase` khớp với phạm vi Hạng mục 2a.                                                                                                                |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục bắt buộc theo `.agents/agents/reviewer/evidence-bar.md` §4.5.2)**:
  1. **Trục 1 — Đồng thời (`PersonaQuickSwitch` / `GemQuickSwitch` mở-đóng-mở nhanh & đổi ngôn ngữ)**:
     - _Cơ chế_: `requestedRef` + cờ `cancelled` trong `useEffect([open])` tại `src/app/features/personas/components/PersonaQuickSwitch.tsx:32-51` và `src/app/features/gems/components/GemQuickSwitch.tsx:34-58`.
     - `T1`: User mở popover (`open=true`) ➔ `requestedRef.current = true`, bắt đầu `fetch("/api/personas")` (request #1 đang bay). | `T2`: User đóng popover (`open=false`) ➔ cleanup chạy `cancelled = true`, effect chạy lại gán `requestedRef.current = false`; ngay lập tức user mở lại (`open=true`) ➔ phát request #2, đồng thời đổi ngôn ngữ (`t` đổi tham chiếu). | `T3`: Request #1 trả lỗi 500 muộn nhưng bị chặn bởi `if (!cancelled)` nên không bắn `toast.error` thừa hay ghi đè kết quả của request #2; đổi ngôn ngữ chỉ cập nhật `tRef.current` chứ không kích hoạt lại `useEffect([open])`.
     - _Kết cục_: Mỗi lượt mở gửi đúng 1 request và hiển thị đúng kết quả của lượt mở hiện hành ➔ **An toàn**.
  2. **Trục 2 — Khoảng trống check→use / TOCTOU (Parent re-render khi user đang gõ trong `PersonaEditor` & `useChapterEditorController`)**:
     - _Cơ chế_: `syncedPersonaKeyRef` (`src/app/features/personas/components/PersonaEditor.tsx:51-63`) và `syncedChapterIdRef` (`src/app/features/novelcrafter/hooks/useChapterEditorController.ts:66-83`).
     - `T1`: User đang sửa dở `customInstructions` trong `PersonaEditor` (cùng `persona.id = "p1"`) hoặc đang nhập `quickEditPrompt` trong `useChapterEditorController` (cùng `chapterId = "ch1"`). | `T2`: Parent re-render tạo object `persona` mới cùng `"p1"` hoặc `chapterContent` đổi khi autosave. | `T3`: `PersonaEditor` giữ được dữ liệu nếu nạp đủ 10 state setter khi đổi key, **nhưng** thiết kế hiện tại trong Bảng 6.5 #15–#16 gọi `setDraftContent` không tồn tại, sót `chapter?.content` tại dòng `:78`, và ghi sai danh sách trường của `PersonaEditor`.
     - _Kết cục_: Lỗi biên dịch TypeScript và còn sót cảnh báo `exhaustive-deps` tại `src/app/features/novelcrafter/hooks/useChapterEditorController.ts:78-82` ➔ **Lỗi (`[MAJOR]`, Finding #4)**.
  3. **Trục 3 — Thất bại giữa chừng & dọn dẹp (`useChatStreamController` hủy luồng khi đang suy luận)**:
     - _Cơ chế_: `cancelStream` và `sendStreamMessage` trong `src/app/features/chat/components/hooks/useChatStreamController.ts:346-365,549-827`.
     - `T1`: Luồng SSE đang chạy `thinking` (mỗi giây `useThinkingStats` tăng `seconds` làm `streamingThinkingStats` đổi tham chiếu). | `T2`: User bấm nút Dừng (`cancelStream(false)`) hoặc đóng hội thoại (`cancelStream(true)`). | `T3`: Đọc qua `thinkingStatsSnapshotRef.current` giúp `cancelStream` không tái tạo mỗi giây, **nhưng** Bảng 6.5 #3–7 gọi `appendToBuffer`/`flushRemaining` không tồn tại trên `src/app/features/chat/components/hooks/useTypewriterBuffer.ts:84-91`, giữ `typewriterBufferRef.current = ""` tại `:347`, và chưa xử lý `parseSSEEvent` nội tuyến tại `:549-564` cùng `onStreamError`/`t` tại `:716,:827`.
     - _Kết cục_: Khi nâng `"react-hooks/exhaustive-deps"` lên `"error"`, cả `tsc --noEmit` lẫn `eslint` đều thất bại trên `useChatStreamController.ts` ➔ **Lỗi (`[MAJOR]`, Finding #3)**.
  4. **Trục 4 — Môi trường serverless**:
     - `N/A` — Toàn bộ thay đổi thuộc tầng giao diện client, hooks trình duyệt và cấu hình lint/test cục bộ; không có state in-memory phía server hay route handler serverless.

- **Commands Executed (Allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6e-audit-polish-plan.md` ➔ Exit `0` (`SECTIONS 7/7`, 86 `LINE_REF` pass, `CRITIC_REQUIRED no`).
  2. `npm run type-check` ➔ Exit `0` (`tsc --noEmit` sạch trên baseline).
  3. `npm run lint` ➔ Exit `1` (`4381 problems: 4364 errors` từ `.claude/worktrees/**`, `17 warnings` `react-hooks/exhaustive-deps` trong `src/**`).
  4. `npm run verify` ➔ Exit `1` (`type-check` pass, dừng ở bước `lint` do `.claude/worktrees/**`).
  5. `npx eslint --print-config src/app/features/chat/components/InputForm.tsx` ➔ Exit `0` (`"react-hooks/exhaustive-deps": [1]`, `"no-unused-expressions": [1, ...]`, 3 rule `vikini-design/*` ở mức `[2]`).
  6. `npx vitest list --filesOnly` ➔ Exit `0` (phát hiện Vitest quét cả `.claude/worktrees/**` và `node_modules/zod` bên trong worktrees).
  7. `npx vitest run src/app/features/layout/components/LanguageUpdater.test.tsx` ➔ Exit `1` (file gốc pass `2/2`, bản sao trong `.claude/worktrees/upgrade-interface-cbe94d/...` fail `2/2`).

#### 4. Kết Luận

Kế hoạch cần cập nhật Revision 2 để khắc phục triệt để 5 lỗi `[MAJOR]` (Findings #1–#5) và các điểm `[MINOR]` (Finding #6) trước khi mở khóa triển khai.

[CHANGES_REQUESTED]
