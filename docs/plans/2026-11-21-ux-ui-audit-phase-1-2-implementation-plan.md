# Kế Hoạch Triển Khai: Khắc Phục Audit UX/UI Vikini — Phase 1 (Wave 1: Quick Wins & P0 Bugs) + Phase 2 (Wave 2: Motion Craft, Visual Polish & Code Block)

- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-21
- **Status**: Completed
- **Revision**: 2
- **Scope**: Triển khai trọn vẹn Wave 1 (P0 Bugs, Toast toàn cục, Hover-Layout Feedback Loop 60fps, Dead Clicks/Hover, WCAG AA 10 Themes, Visual QA fixes) và Wave 2 (Motion Craft theo `emil-design-eng`, pure-CSS Radix animations, Syntax Highlighting `.hljs-*`, Brand Logo & Icons thống nhất).

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục Tiêu (Goal)

Khắc phục triệt để toàn bộ nhóm lỗi chí mạng **P0** (Wave 1) và nâng chuẩn tương tác/thị giác **P1** (Wave 2) từ báo cáo audit UX/UI 3 lớp chéo:

1. **Phản hồi Toast toàn cục & thông minh**: Mount `<ToastContainer />` duy nhất 1 lần tại `MainLayout.tsx` (cạnh `<ConfirmDialogHost />`), gỡ 3 bản mount trùng ở cấp trang; nâng cấp nền đục `bg-(--surface)`, chống tràn 375px, chuyển sang CSS transitions mượt và hỗ trợ tạm dừng timer khi hover/focus hoặc tab ẩn trong `toastStore.ts`.
2. **Triệt tiêu lỗi P0 Hover-Layout Feedback Loop 60fps trên Landing**: Chặn auto-resize `<Textarea>` khi `isPreview === true`, chuẩn hóa preview 1 dòng sạch, đổi neo dọc Landing từ `justify-center` sang đệm trên cố định `pt-[12vh] md:pt-[18vh]`, đồng thời song ngữ hóa toàn bộ 24 mẫu prompt gợi ý (`vi.ts` + `en.ts`) và bổ sung `aria-label` cho nút đóng dropdown.
3. **Khôi phục chức năng P0 `/describe` History Click**: Bấm lịch sử hiển thị đủ ảnh thumbnail + kết quả prompt, bọc `try/catch` bảo vệ `localStorage`, song ngữ hóa toàn bộ toast/alt text.
4. **Sửa Dead Clicks & Wiring toàn bộ App Shell**: Nối đủ 6 handler Project/Chat trong `AppFrame.tsx` + `useAppFrameState.ts`, lọc bỏ chat thuộc Project khỏi `mainChats`, tự đóng `MobileNavDrawer` khi chạm link Ảnh hoặc `Admin`, và mở lại `⌘K` trên `/projects/[id]`.
5. **Xóa sổ Dead Hover/Focus & `Switch` tàng hình**: Sửa thumb `Switch` sang `data-[state=checked]:bg-(--on-accent)`, đổi nền `DropdownMenu` sang `bg-(--surface)`, định nghĩa token `--raised-hover` để sửa dứt điểm các nút/menu/hàng danh sách đang dùng `bg-(--raised) hover:bg-(--raised)` và thêm phản hồi nhấn `active:scale-[0.97]` cho `Button`.
6. **Đạt chuẩn WCAG 2.1 AA ($\ge 4.5:1$) trên toàn bộ 10 Themes (5 họ × Dark/Light)**: Bổ sung hệ màu trạng thái riêng cho Dark (`--danger: #f87171` + `--danger-foreground: #1a0404`) và 5 Light themes (`--danger: #b91c1c` + `#ffffff`, `--success: #147237`, `--warning: #92400e`), chỉnh `--accent` của `hoanghon-light` (`#b33a08`) đạt $5.01:1$ trên `--raised`, và chỉnh nhẹ `--faint` trên 7 theme để đạt $\ge 4.72:1$ trên `--raised`.
7. **Sửa lỗi Visual QA thực tế trên Desktop & Mobile 375px**: Căn Composer Landing 1 hàng chip gọn gàng trên Desktop & tối đa 2 hàng trên Mobile 375px (`text-base md:text-[15px]`); sửa `SelectTrigger` Model bị tràn đè nhãn và lỗi `h-full` cắt đáy ở `/images`; sửa `whitespace-nowrap` nút `So sánh` ở `/gallery`; sửa `min-w-0` chống xén card `Kho kiến thức`, hiển thị đúng số chunk, dùng `limits.maxStorageBytesPerProject`, và hiện `<Skeleton />` thay vì nháy Empty State khi tải ở `/projects/[id]`.
8. **Wave 2 — Motion Craft (`emil-design-eng`) + Code Block + Brand Logo & Icons**: Khôi phục animation cho toàn bộ Radix overlays bằng **pure CSS** (`animations.css`, không thêm npm package), gỡ class slide gây lỗi double-translate Tailwind v4 trên Dialog/AlertDialog, thêm `transform-origin` cho Popover/Dropdown/Tooltip, `TooltipProvider delayDuration={300} skipDelayDuration={300}`, instant `⌘K` (0ms animation, focus đồng bộ qua `onOpenAutoFocus`), thay `transition-all`, bỏ xung đột `TypingDots`, bọc hover transforms trong `@media (hover: hover) and (pointer: fine)`, bổ sung `.hljs-*` syntax highlighting đạt WCAG AA Dark/Light (`hljs.css`), bỏ khoảng trống 24px thừa trên code block, làm mềm shadow trên Light mode, chuẩn hóa 1 `<VikiniLogo />` duy nhất, sửa `DynamicIcon`/`ProjectIcon`/`PersonaList`/`ModelSelector`.

#### Out of Scope (What We're NOT Doing)

- **Không xử lý Wave 3 (Accessibility sâu & Hand-rolled Modals)**: Không refactor 5 modal/lightbox tự chế (`ProjectSettingsModal`, `FileLightbox`, `image-gen/ImageLightbox`, `chat/ImageLightbox`, `ProjectSwitcher`) sang Radix `Dialog`; không thay đổi cấu trúc `<main>` của `AuthShell` hay chuyển `<motion.nav>` trong `MobileNavDrawer` (giữ nguyên cấu trúc drag của `Sidebar.test.tsx`); không nâng hàng loạt touch target NovelCrafter/MessageActions hay thay 9 `<div onClick>` ngoài `ModelSelector`.
- **Không xử lý Wave 4 (IA & NovelCrafter Mobile & Admin)**: Không thiết kế lại thanh công cụ NovelCrafter mobile, không gộp thanh điều hướng `/images` vs `ImageSectionHeader`, không mở lối Gems ↔ Personas, không tích hợp `/admin` vào `AppFrame`, không xóa orphan routes (`/features/chat`, `ProjectSwitcher.tsx`), không xử lý inline `language === "vi"` ở `/auth/error` hay `AuditLogViewer`.
- **Không thay đổi Backend / Database / Auth / Dependencies**: Không sửa file `*.server.ts`, không tạo migration SQL, không thêm/xóa package trong `package.json` (`tw-animate-css` được thay bằng pure-CSS `@utility` gọn nhẹ trong repo).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Pre-Work Reading Đã Đọc Trong Phiên

- `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md`, `.agents/rules/05-plan-review.md`
- `.agents/agents/reviewer/evidence-bar.md`, `.agents/scripts/plan-scope.js`, `scripts/verify-plan.mjs`, `scripts/vikini-design-lint.mjs`, `eslint.config.mjs`, `package.json`, `vitest.config.ts`
- Toàn bộ file nguồn và test co-located thuộc phạm vi Phase 1–2 (trích dẫn `[SRC]` bên dưới).

#### Bảng Skills Loaded & Applied

| Skill (`SKILL.md`)                        | Đã đọc (`read_file`)  | Quyết Định Kỹ Thuật Chịu Ảnh Hưởng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/skills/emil-design-eng/SKILL.md` | Có (toàn bộ 685 dòng) | (1) Dùng custom strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)` $\le 200\text{ms}$ cho mọi Radix overlay trong `animations.css` và tuyệt đối không `scale(0)` (`zoom-in` bắt đầu từ `0.95`); (2) Tắt 100% animation & delay 50ms ở `CommandPalette` (`⌘K` tần suất 100+/ngày); (3) Thêm `active:scale-[0.97]` cho `Button`; (4) Thêm `transform-origin` từ biến Radix cho `DropdownMenu`, `Popover`, `Tooltip` (trừ Modal giữ tâm); (5) `TooltipProvider delayDuration={300} skipDelayDuration={300}` + `data-[state=instant-open]:animate-none`; (6) Bỏ Framer Motion `x`/`scale` ở `ToastContainer` sang CSS transitions interruptible + pause timer khi hover hoặc `document.hidden` (Sonner principle #4); (7) Bỏ `transition-all`, bỏ xung đột JS+CSS ở `TypingDots`, bọc hover transform trong `@media (hover: hover) and (pointer: fine)`, giữ transition opacity/color nhẹ dưới `prefers-reduced-motion`. |
| `.agents/skills/add-translation/SKILL.md` | Có (toàn bộ 77 dòng)  | Mọi chuỗi giao diện mới (24 mẫu prompt trong `DashboardView`, 4 thông báo/alt text ở `DescribeImageView`) được khai báo đồng thời ở cả `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`, gọi qua `const { t } = useLanguage()` (`t("key")`), kiểm chứng đối xứng compile-time qua `src/lib/utils/translations/index.ts:24-34` và `npm run type-check`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `.agents/rules/03-ui.md`                  | Có (toàn bộ 128 dòng) | Tuân thủ 100% Vikini 3.0 semantic tokens (`--bg`, `--surface`, `--raised`, `--raised-hover`, `--on-accent`, `--overlay`, `--z-popover`) khớp 4 rule ESLint tại `eslint.config.mjs:126-143`; dùng `<Skeleton />` trong `KnowledgePanel`; áp dụng quy trình Visual QA Playwright Desktop (`1440×900`) & Mobile (`375×812`) × Dark/Light + `read_file` soi từng ảnh chụp.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `.agents/rules/04-bilingual.md`           | Có (toàn bộ 56 dòng)  | Loại bỏ 24 mẫu prompt English hardcode trong `src/app/features/chat/components/DashboardView.tsx:30-82` và 4 chuỗi hardcode trong `src/app/features/image-gen/components/DescribeImageView.tsx:77,81,174,257` mà không dùng inline ternary `language === "vi"` hay prop-drilling `t`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

### 3. Assumptions & Cross-Task Dependencies

#### Giả Định Có Dẫn Chứng Thực Tế (`[SRC]`)

1. **Vikini dùng 10 class theme tường minh (`.theme-<family>-<mode>`), KHÔNG dùng `.dark` class**: Xác nhận tại `src/app/features/layout/providers.tsx:22-28` và `src/lib/config/theme-config.ts:89-94` (`next-themes` gắn class `.theme-hoanghon-dark`..`.theme-than-light`). Do đó mọi override Light mode (màu trạng thái, `--shadow-elevated`, `--hljs-*`) PHẢI đặt trong block `.theme-hoanghon-light, .theme-muc-light, .theme-reu-light, .theme-sen-light, .theme-than-light` như mẫu `--xml-*` sẵn có tại `src/app/styles/themes/_shared/base.css:132-145` — tuyệt đối không dùng Tailwind `dark:`.
2. **ESLint custom design plugin chặn màu thô, legacy token, cỡ chữ `< 12px` và `uppercase`**: Xác nhận tại `eslint.config.mjs:120-144` và `scripts/vikini-design-lint.mjs:12-25`. Do đó `src/app/features/chat/components/SmartCode.tsx:147` (cả `scrollbar-thumb-white/10` lẫn `hover:scrollbar-thumb-white/20`) được đổi sang `scrollbar-thumb-(--line)`, còn `--raised-hover` và `--shadow-elevated` nằm ngoài danh sách `LEGACY_TOKEN_RE` và `removedAliases` (`src/lib/config/theme-config.test.ts:232-247`).
3. **Tailwind CSS v4 dùng CSS property `translate` độc lập cho `translate-x-*`/`translate-y-*`**: Xác nhận từ tài liệu Tailwind v4 & bug double-translate trên `shadcn/ui`. Hiện tại `src/components/ui/dialog.tsx:41` và `src/components/ui/alert-dialog.tsx:39` đang chứa `translate-x-[-50%] translate-y-[-50%]` cùng `slide-in-from-left-1/2 slide-in-from-top-[48%]`. Khi bật `animate-in` trong `animations.css`: (a) keyframes bắt buộc animate bằng `transform: translate3d(...) scale3d(...)` (không ghi thuộc tính CSS `translate` độc lập để bảo toàn căn giữa của `Dialog`/`AlertDialog`, `SelectContent`, và tooltip `ControlPanel`); (b) gỡ các class `slide-in-from-left-1/2` / `slide-in-from-top-[48%]` / `slide-out-to-*` khỏi `src/components/ui/dialog.tsx:41` và `src/components/ui/alert-dialog.tsx:39` để modal phóng nhẹ từ tâm (`fade-in-0 zoom-in-95`).
4. **Nguyên nhân 2 dòng trống phía trên code block là `.chat-markdown pre`**: Xác nhận tại `src/app/styles/themes/_shared/utilities.css:93-95` (`.chat-markdown pre { @apply my-6; }`) áp vào thẻ `<pre>` bên trong `src/app/features/chat/components/SmartCode.tsx:146-150`. Thu hẹp selector thành `.chat-markdown > pre` + đặt `my-0` trên `<pre>` của `SmartCode` loại bỏ hoàn toàn 24px khoảng trống thừa.
5. **Nguyên nhân Landing Desktop Composer vỡ 2 hàng & Mobile 375px bị bóp ngang**:
   - _Desktop Landing_: Thread mode (`src/app/features/chat/components/ChatControls.tsx:113`) rộng `xl:max-w-5xl` (1024px - 48px = 976px), còn Landing (`src/app/features/chat/components/DashboardView.tsx:152`) bóp còn `xl:max-w-4xl px-4` cộng thêm `md:px-6` của `ChatControls` = 816px trong khi `@3xl/chat` đo theo container ngoài (1104px) nên vẫn bật 4 chip desktop. Đồng bộ `DashboardView` sang `max-w-3xl lg:max-w-4xl xl:max-w-5xl` và bỏ padding thừa khi `isLanding` khôi phục đúng 976px.
   - _Mobile 375px_: Trên Landing, `src/app/features/chat/components/ChatApp.tsx:298` đã có `px-4 md:px-0` nên `src/app/features/chat/components/DashboardView.tsx:152` dùng `px-0 md:px-6` (tránh cộng dồn 64px lề ngang, giữ đủ `325px` ruột composer). Trên Thread, `src/app/features/chat/components/ChatControls.tsx:117` có `pl-[calc(1rem+var(--sal,0px))] pr-[calc(1rem+var(--sar,0px))]` ghi đè `px-3` nên đổi đồng bộ sang `0.75rem` (`333px` ruột composer). Đồng bộ `+`/`Mic`/`Send` mobile `h-9 w-9 sm:h-10 sm:w-10` và `ModelSelector` (cùng wrapper cụm phải `ml-auto flex min-w-0 items-center`) dùng `min-w-0 max-w-full overflow-hidden` giúp Row 2 luôn gọn 1 hàng khi `fileCount === 0` và co an toàn không tràn ngang khi `fileCount > 0`.
6. **Ràng buộc tương thích với các bộ Unit Test hiện có (`[SRC]`)**:
   - `src/app/features/chat/components/ComposerLeadingControls.test.tsx:172,178` kiểm tra chính xác class `@3xl/chat:hidden`, `hidden`, `@3xl/chat:flex` → giữ nguyên các breakpoint class này.
   - `src/app/features/chat/components/InputForm.test.tsx:333-336` kiểm tra `textarea.parentElement` chứa `basis-full` và không chứa `md:basis-auto` → giữ nguyên wrapper Row 1 có `basis-full` và bọc Row 2 bằng một flex container riêng.
   - `src/app/features/image-gen/components/ControlPanel.test.tsx:130,175` kiểm tra keyboard hint chứa `pointer-coarse:hidden` → dùng `hidden md:block pointer-coarse:hidden` (ẩn cả trên mobile `< 768px` lẫn tablet touch).
   - `src/app/features/chat/components/SmartCode.test.tsx:111,215` kiểm tra `active:scale-[0.95]` → giữ nguyên `active:scale-[0.95]`.
   - `src/app/features/chat/components/BubbleHelpers.test.tsx:11-21` kiểm tra `.typing-dots` có 3 `<span>` mang `w-1.5 h-1.5 bg-(--accent) rounded-full` → giữ nguyên lớp này khi bỏ `motion.span`.
   - `src/app/features/sidebar/components/Sidebar.test.tsx:203` kiểm tra `pb-[calc(4rem+var(--sab,0px))]` cũ của `MobileNavDrawer` → cập nhật sang `pb-[calc(1.25rem+var(--sab,0px))]` thuộc **Loại C (Approved Spec Change)** trong Test Contract TC-P1-05.
   - `src/app/features/layout/HeaderBar.test.tsx:200-203` kiểm tra phân biệt hoa/thường `screen.getByText("V")` trên logo cũ của `src/app/features/layout/components/HeaderBar.tsx:88-90` → cập nhật sang `screen.getByText("v")` (khớp `<VikiniLogo size="sm" />` chữ _v_ thường serif nghiêng chuẩn thương hiệu tại `src/app/auth/signin/page.tsx:25-27`) thuộc **Loại C (Approved Spec Change)** trong Test Contract TC-P2-02.
   - `src/app/features/chat/hooks/useConversation.ts:431-434,458-464,515-520`: `createConversation` (trả `FrontendConversation | null`), `renameConversation` và `deleteConversation` đã tự gọi `mutate()` và tự bắn `toast.success`/`toast.error` nội bộ (không throw) → `useAppFrameState.ts` ủy quyền hoàn toàn, không bắn toast hay gọi `refreshConversations()` trùng lặp.
7. **Quyết định thiết kế `DynamicIcon.tsx` (tương thích ngược DB)**: Các Gem/Persona có sẵn trong Supabase có thể lưu bất kỳ tên icon Lucide nào (vd `"pen-tool"` không nằm trong danh sách 30 icon của `src/components/ui/IconPicker.tsx:17-48`). Giữ lookup đồng bộ trên `lucide-react` với hàm chuẩn hóa `normalizeIconName()` (loại `-`, `_`, khoảng trắng) + lọc bỏ non-component exports + fallback an toàn cho chuỗi ASCII không khớp + `overflow-hidden` đảm bảo 0% hồi quy dữ liệu cũ và vẫn đáp ứng đồng bộ `DynamicIcon.test.tsx`.
8. **Chứng minh toán học tương phản WCAG 2.1 AA ($\ge 4.5:1$) cho `--danger` ở Dark vs Light**: Không tồn tại một mã hex đỏ duy nhất vừa đạt $\ge 4.5:1$ trên `#ffffff` ($L \le 0.183$) vừa đạt $\ge 4.5:1$ trên Dark `--raised` `#1d2029` ($L \ge 0.240$). Áp dụng đúng quy ước `--accent`/`--on-accent` sẵn có của Vikini 3.0: Dark dùng `--danger: #f87171`, `--danger-hover: #ef4444`, `--danger-foreground: #1a0404` ($5.88:1$ trên `--raised`, $7.15:1$ trên nút xóa); Light dùng `--danger: #b91c1c`, `--danger-hover: #991b1b`, `--danger-foreground: #ffffff` ($5.44:1$ trên `--raised` `#f3eae1`, $6.47:1$ trên nút xóa), `--success: #147237` ($5.06:1$ trên `#f3eae1`), `--warning: #92400e` ($5.96:1$ trên `#f3eae1`). Tất cả 10/10 theme đạt WCAG AA cho mọi cặp nền/chữ và được khóa bằng test tự động trong `theme-config.test.ts`.

#### Cross-Task Dependencies

- Bước tạo `--raised-hover` & `--shadow-elevated` (`base.css`) phải thực hiện trước hoặc đồng thời với các bước cập nhật `button.tsx`, `HeaderBar.tsx`, `InputForm.tsx`, `SmartCode.tsx`, `ToastContainer.tsx`.
- Bước gỡ `slide-in-from-left-1/2` / `slide-in-from-top-[48%]` ở `dialog.tsx` và `alert-dialog.tsx` bắt buộc thực hiện đồng bộ với việc thêm `animations.css` để tránh lỗi double-translate.
- Bước thêm 28 key vào `vi.ts` và `en.ts` phải làm đồng thời (tránh lỗi biên dịch `src/lib/utils/translations/index.ts:26-34`) trước khi `DashboardView.tsx` và `DescribeImageView.tsx` tham chiếu.
- Bước mount `<ToastContainer />` vào `MainLayout.tsx` phải đi kèm việc gỡ ở `ChatApp.tsx`, `NovelcrafterStudioApp.tsx`, `PromptStudioApp.tsx` để không hiển thị 2 toast chồng nhau.

---

### 4. Bảng Verified Versions

| Thư viện / Công cụ                                                                                  | Phiên bản trong `package.json` (`[SRC]`)                          | Trạng thái 2026 & Xác minh (`[URL]` / `[SRC]`)                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                                                                                              | `^16.4.0` (`package.json:64`)                                     | Tương thích React 19 & App Router; không sửa route handler/server logic.                                                                                                                                                                                    |
| `react` / `react-dom`                                                                               | `^19.2.3` (`package.json:69-70`)                                  | Lưu ý StrictMode chạy double-invoke updater (chuyển `localStorage.setItem` ra ngoài updater thuần ở `DescribeImageView.tsx`); ưu tiên `React.ComponentRef` cho component mới.                                                                               |
| `tailwindcss` / `@tailwindcss/postcss`                                                              | `^4.1.18` (`package.json:53,114`)                                 | CSS-first engine hỗ trợ `@utility`, `@keyframes`, `@starting-style`, `color-mix(in oklab, ...)` (`[URL]` Tailwind CSS v4 docs & `tw-animate-css` pattern 2026). Không cần cài thêm package ngoài; lưu ý tránh double-translate trên `Dialog`/`AlertDialog`. |
| `@radix-ui/react-dialog`, `alert-dialog`, `dropdown-menu`, `popover`, `select`, `switch`, `tooltip` | `1.1.15` – `2.2.6` (`package.json:41-51`)                         | Tương thích đầy đủ React 19 (`[URL]` Radix UI docs 2026); hỗ trợ biến CSS `--radix-*-content-transform-origin` và `data-state="instant-open"` trên `TooltipContent` cùng `skipDelayDuration` trên `TooltipProvider`.                                        |
| `framer-motion`                                                                                     | `^12.23.26` (`package.json:59`)                                   | Đã bọc `<MotionConfig reducedMotion="user">` tại `src/app/features/layout/providers.tsx:30`; dùng hằng số chuẩn `src/lib/utils/motion.ts:4-25` thay vì hardcode duration.                                                                                   |
| `rehype-highlight`                                                                                  | `^7.0.2` (`package.json:73`)                                      | Đã gắn sẵn tại `src/app/features/chat/components/BubbleMarkdown.tsx:9,175`, xuất các class `.hljs-*` tiêu chuẩn (`[URL]` rehype-highlight / highlight.js WCAG AA theme pattern 2026); chỉ thiếu file CSS ánh xạ biến theme.                                 |
| `lucide-react`                                                                                      | `^0.562.0` (`package.json:62`)                                    | Bộ icon duy nhất được phép (`.agents/rules/03-ui.md:52,76`).                                                                                                                                                                                                |
| `zustand`                                                                                           | `^5.0.9` (`package.json:81`)                                      | Quản lý `toastStore.ts`, `projectStore.ts`, `layoutStore.ts`, `commandPaletteStore.ts`.                                                                                                                                                                     |
| `vitest` / `@testing-library/react` / `axe-core` / `@playwright/test`                               | `4.1.12` / `16.3.1` / `4.11.1` / `1.62.1` (`package.json:87-118`) | Chạy co-located unit tests (happy-dom, `vitest.config.ts:8`) và Visual QA + `axe-core` multi-viewport.                                                                                                                                                      |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### Tạo Mới (8 files)

- [NEW] `src/app/styles/themes/_shared/animations.css` — Pure-CSS Tailwind v4 `@utility` & `@keyframes` cho Radix overlays (`animate-in`/`animate-out`/`fade-*`/`zoom-*`/`slide-*`) với `cubic-bezier(0.23, 1, 0.32, 1)` $\le 200\text{ms}$ + `.toast-enter` dùng `@starting-style`.
- [NEW] `src/app/styles/themes/_shared/hljs.css` — Theme-aware WCAG AA `.hljs-*` syntax highlighting (Dark defaults + 5 Light overrides).
- [NEW] `src/components/ui/vikini-logo.tsx` — Shared UI primitive logo chữ _v_ serif nghiêng thống nhất toàn app (`size="sm" | "md" | "lg"`).
- [NEW] `src/lib/store/toastStore.test.ts` — Co-located unit tests cho timer lifecycle, hover pause/resume, visibility pause/resume và negative probes của `toastStore`.
- [NEW] `src/components/ui/ToastContainer.test.tsx` — Unit tests cho `ToastContainer` (nền đục, width 375px, hover & `visibilitychange` wiring, dismiss).
- [NEW] `src/app/features/chat/components/DashboardView.test.tsx` — Unit tests cho song ngữ hóa 24 prompt, preview 1 dòng sạch không chứa `\n`, `aria-label` nút đóng dropdown.
- [NEW] `src/components/features/projects/ProjectIcon.test.tsx` — Unit tests cho `sparkles`, normalize kebab-case, fallback `<Folder>` cho slug ASCII lạ và `overflow-hidden`.
- [NEW] `src/app/features/chat/components/ModelSelector.test.tsx` — Unit tests cho `resolveChatModelDisplay()` (không lộ raw slug `gemini-2.5-flash`) và mobile trigger an toàn.

#### Chỉnh Sửa (69 files)

**Nhóm A — Styles & 10-Theme WCAG AA Tokens (9 files):**

- [MODIFY] `src/app/globals.css` — Import `./styles/themes/_shared/animations.css` và `./styles/themes/_shared/hljs.css`.
- [MODIFY] `src/app/styles/themes/_shared/base.css` — Thêm `--raised-hover`, `--shadow-elevated`; cập nhật `--danger`/`--danger-hover`/`--danger-foreground` cho Dark; bổ sung override `--danger`, `--danger-hover`, `--danger-foreground`, `--success`, `--warning`, `--shadow-elevated` cho 5 Light themes.
- [MODIFY] `src/app/styles/themes/_shared/utilities.css` — Nâng inline `code:not(pre code)` bằng CSS thuần `font-size: max(0.75rem, 0.85em);` (thay `text-[0.85em]` tránh nhập nhằng font-size/color Tailwind v4); thu hẹp `.chat-markdown > pre`; bỏ `bg-current` ở `.typing-dots span`; bọc `.group-del-hover:hover`, `.hover-lift:hover`, `.sidebar-accent-bar:hover::before` trong `@media (hover: hover) and (pointer: fine)`; tinh chỉnh `prefers-reduced-motion` giữ lại opacity/color nhẹ.
- [MODIFY] `src/app/styles/themes/hoanghon.css` — Đổi `.theme-hoanghon-light` `--accent: #b33a08;` và `--soft: rgba(179, 58, 8, 0.09);` đạt $5.01:1$ trên `--raised`.
- [MODIFY] `src/app/styles/themes/muc.css` — Đổi `--faint` dark `#868d9b` (4.88:1 trên `--raised`) & light `#636973` (4.72:1 trên `--raised`).
- [MODIFY] `src/app/styles/themes/reu.css` — Đổi `--faint` dark `#868d9b` & light `#636973`.
- [MODIFY] `src/app/styles/themes/sen.css` — Đổi `--faint` dark `#868d9b` & light `#636973`.
- [MODIFY] `src/app/styles/themes/than.css` — Đổi `.theme-than-light` `--faint` `#636973` (4.94:1 trên `--raised`).
- [MODIFY] `src/lib/config/theme-config.ts` — Đồng bộ swatch light của `hoanghon` thành `#b33a08`.

**Nhóm B — Core Store & Shared UI Primitives (11 files):**

- [MODIFY] `src/lib/store/toastStore.ts` — Quản lý timer theo `Map`, dọn timer khi xóa, thêm `pauseToast`, `resumeToast`, `setVisibilityPaused`, `clearAllToasts`; bảo toàn 2 bất biến: không lập lịch `setTimeout` khi `addToast` chạy lúc `visibilityPaused === true`, và bỏ qua `pauseToast`/`resumeToast` cho toast persistent (`duration <= 0`).
- [MODIFY] `src/components/ui/ToastContainer.tsx` — Nền đục `bg-(--surface)`, rộng `w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]`, `shadow-(--shadow-elevated)`, CSS `.toast-enter`, pause/resume trên hover/focus (kèm guard `!e.currentTarget.contains(e.relatedTarget as Node | null)` cho `onBlur`) & `visibilitychange`.
- [MODIFY] `src/components/ui/switch.tsx` — Thumb dùng `bg-(--text) data-[state=checked]:bg-(--on-accent)`.
- [MODIFY] `src/components/ui/dropdown-menu.tsx` — Container `bg-(--surface)` + `origin-(--radix-dropdown-menu-content-transform-origin)`.
- [MODIFY] `src/components/ui/button.tsx` — Thêm `active:scale-[0.97]` + transition tường minh; phân biệt `outline` (`bg-transparent hover:bg-(--raised)`); sửa hover `secondary`/`glass`/`island` sang `hover:bg-(--raised-hover)`.
- [MODIFY] `src/components/ui/popover.tsx` — Thêm `origin-(--radix-popover-content-transform-origin)`.
- [MODIFY] `src/components/ui/tooltip.tsx` — Thêm `origin-(--radix-tooltip-content-transform-origin) data-[state=instant-open]:animate-none data-[state=instant-open]:duration-0`.
- [MODIFY] `src/components/ui/dialog.tsx` — Gỡ class slide gây double-translate Tailwind v4; thêm prop `instant?: boolean` truyền xuống **cả `DialogOverlay` lẫn `DialogContent`** (tắt hoàn toàn `animate-in`/`animate-out` để Radix `<Presence>` không giữ backdrop trễ khi đóng `CommandPalette`).
- [MODIFY] `src/components/ui/alert-dialog.tsx` — Gỡ class slide gây double-translate Tailwind v4.
- [MODIFY] `src/components/ui/sheet.tsx` — Thêm `data-[state=open]:animate-in data-[state=closed]:animate-out duration-200` trên `SheetContent`.
- [MODIFY] `src/components/ui/DynamicIcon.tsx` — Hỗ trợ kebab-case (`pen-tool` → `PenTool`), lọc non-component exports, fallback an toàn cho slug ASCII không tồn tại, `overflow-hidden max-w-full`.

**Nhóm C — Shell, Layout, Sidebar & Auth Logo (13 files):**

- [MODIFY] `src/app/features/layout/components/MainLayout.tsx` — Mount `<ToastContainer />` toàn cục duy nhất cạnh `<ConfirmDialogHost />`.
- [MODIFY] `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` — Gỡ `<ToastContainer />` trùng lặp.
- [MODIFY] `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx` — Gỡ `<ToastContainer />` trùng lặp.
- [MODIFY] `src/app/features/layout/hooks/useAppFrameState.ts` — Lọc bỏ `c.projectId` & `vikini-novelcrafter` khỏi `mainChats`; bổ sung `handleSelectProject`, `handleCreateProjectChat`, `handleDeleteChat` và state/handler đổi tên chat.
- [MODIFY] `src/app/features/layout/components/AppFrame.tsx` — Truyền đủ 6 handler Project/Chat vào `<Sidebar>` và render Radix Rename `<Dialog>`.
- [MODIFY] `src/app/features/layout/components/GlobalCommandPalette.tsx` — Chỉ tắt trên `/` và `/features/chat*` (`isChatAppRoute`), bật lại `⌘K` trên `/projects/[id]`.
- [MODIFY] `src/app/features/layout/components/HeaderBar.tsx` — Sửa dead hover `triggerButtonStyles`, dùng `<VikiniLogo size="sm" />` và chữ `text-(--text)` không gradient mờ.
- [MODIFY] `src/app/features/sidebar/components/Sidebar.tsx` — Truyền `onNavigate={onCloseMobile}` xuống `ContextPanelContent` và đổi `<TooltipProvider delayDuration={300} skipDelayDuration={300}>`.
- [MODIFY] `src/app/features/sidebar/components/ContextPanelContent.tsx` — Sửa dead hover `variant === "primary"` sang `hover:bg-(--raised-hover)`.
- [MODIFY] `src/app/features/sidebar/components/MobileNavDrawer.tsx` — Gọi `onClose?.()` khi bấm `onAdmin`; đổi nền `bg-(--surface)`, overlay `bg-(--overlay)`, sửa `pb-[calc(1.25rem+var(--sab,0px))]`, dùng `<VikiniLogo size="sm" />` và hằng số từ `motion.ts`.
- [MODIFY] `src/app/features/sidebar/components/SidebarItem.tsx` — Đổi nền dropdown sang `bg-(--surface)/95` + `origin-(--radix-dropdown-menu-content-transform-origin)`.
- [MODIFY] `src/app/features/sidebar/components/ProjectNode.tsx` — Đổi nền dropdown sang `bg-(--surface)/95` + `origin-(--radix-dropdown-menu-content-transform-origin)`.
- [MODIFY] `src/app/auth/signin/page.tsx` — Dùng `<VikiniLogo size="lg" className="mx-auto" />`.

**Nhóm D — Chat Landing, Composer, Bubbles, Code Block & Command Palette (13 files):**

- [MODIFY] `src/app/features/chat/components/ChatApp.tsx` — Gỡ `<ToastContainer />` trùng; đổi neo dọc Landing từ `justify-center pb-[25vh] ... duration-500` sang `pt-[12vh] md:pt-[18vh] pb-24 animate-in fade-in-0 duration-200`.
- [MODIFY] `src/app/features/chat/components/DashboardView.tsx` — Song ngữ hóa 24 prompt qua `promptKey`, chuẩn hóa preview 1 dòng khi hover, đồng bộ `max-w-3xl lg:max-w-4xl xl:max-w-5xl px-0 md:px-6` (tránh double-padding với `ChatApp` trên mobile 375px), thêm `aria-label={t("close")}`, nền dropdown `bg-(--surface)/95`, dùng `DURATION`/`EASE` từ `motion.ts`.
- [MODIFY] `src/app/features/chat/components/ChatControls.tsx` — Gỡ double horizontal padding khi `isLanding`, đồng bộ safe-area padding mobile sang `pl-[calc(0.75rem+var(--sal,0px))] pr-[calc(0.75rem+var(--sar,0px))] md:px-6` (không đè `px-3`), `shadow-(--shadow-elevated)`, và `motion.ts`.
- [MODIFY] `src/app/features/chat/components/InputForm.tsx` — Chặn auto-resize khi `isPreview === true`; tách Row 2 thành `flex w-full items-center gap-1 @sm/chat:gap-2 min-w-0` gọn 1 hàng trên mobile 375px (giữ wrapper `basis-full` Row 1, cụm phải `ml-auto flex min-w-0 items-center gap-1 @sm/chat:gap-1.5`); đồng bộ `+`/`Send` mobile `h-9 w-9 sm:h-10 sm:w-10`; đổi `<Textarea>` sang `text-base md:text-[15px]`; sửa dead hover trong composer sang `hover:bg-(--raised-hover)`; thay `transition-all` & `shadow-2xl`.
- [MODIFY] `src/app/features/chat/components/ComposerLeadingControls.tsx` — Đổi wrapper sang `flex min-w-0 shrink-0 @3xl/chat:flex-1 flex-wrap items-center gap-1.5 self-center` (kèm `max-w-[52%] @3xl/chat:max-w-none` khi `fileCount > 0` để `Tùy chọn` + `Tệp (n)` không đẩy tràn ngang 375px) và bảo toàn `@3xl/chat:flex`/`@3xl/chat:hidden`.
- [MODIFY] `src/app/features/chat/components/ComposerChip.tsx` — Đổi `hover:bg-(--raised)` → `hover:bg-(--raised-hover)` và `px-2.5 sm:px-3`.
- [MODIFY] `src/app/features/chat/components/ModelSelector.tsx` — Dùng `resolveChatModelDisplay(currentModelId).name`; thu gọn inline trigger trên 375px (`h-9 sm:h-10 px-2 sm:px-3 min-w-0 max-w-full overflow-hidden hover:bg-(--raised-hover)`); gắn click mở Sheet trực tiếp trên `<button>` thay vì `<span onClick>`.
- [MODIFY] `src/app/features/chat/components/VoiceButton.tsx` — Đồng bộ kích thước `h-9 w-9 sm:h-10 sm:w-10` & `hover:bg-(--raised-hover)`.
- [MODIFY] `src/app/features/chat/components/CommandPalette.tsx` — Truyền `instant` + `onOpenAutoFocus` vào `DialogContent`, bỏ `setTimeout(..., 50)`, thêm `pr-10` cho thanh tìm kiếm.
- [MODIFY] `src/app/features/chat/components/ChatBubble.tsx` — Sửa dead hover nút Cancel & giới hạn `min-w` edit box an toàn trên mobile.
- [MODIFY] `src/app/features/chat/components/BubbleHelpers.tsx` — Chuyển `TypingDots` về pure CSS `@keyframes typing` (bỏ `motion.div`/`motion.span`), sửa dead hover ở `ThinkingBlock`.
- [MODIFY] `src/app/features/chat/components/SmartCode.tsx` — Thêm `my-0` trên `<pre>`, thay cả `scrollbar-thumb-white/10` lẫn `hover:scrollbar-thumb-white/20` bằng `scrollbar-thumb-(--line)`, giảm `shadow-2xl` → `shadow-(--shadow-elevated)`, thay `transition-all`, thêm `toast.error` khi copy thất bại.
- [MODIFY] `src/app/features/chat/components/EmptyReasoningNotice.tsx` — Sửa dead hover (`hover:bg-(--raised-hover)`) & thay `transition-all`.

**Nhóm E — Image Studio, Describe, Gallery, Projects & Personas (9 files):**

- [MODIFY] `src/app/features/image-gen/components/DescribeImageView.tsx` — Click lịch sử set `imagePreview(item.thumbnail || null)` + `result(item.prompt)` + `imageFile(null)` và mở nhánh hiển thị khi `Boolean(imagePreview || result)` (guard an toàn khi `item.thumbnail` rỗng); bọc `try/catch` cả `addToHistory` (`localStorage.setItem`) lẫn `clearHistory` (`localStorage.removeItem`); thêm `t` vào deps `handleFileSelect`; thay chuỗi toast/alt hardcode bằng `t(...)`; sửa dead hover + `aria-label`; dùng `motion.ts`.
- [MODIFY] `src/app/features/image-gen/components/ControlPanel.tsx` — Model `SelectTrigger` `h-auto min-h-10 py-2 [&>span]:line-clamp-none`; `SelectContent` `z-(--z-popover)`; keyboard hint `hidden md:block pointer-coarse:hidden`.
- [MODIFY] `src/app/features/image-gen/components/ImageGenStudio.tsx` — Đổi `h-full` → `flex-1 min-h-0`; đổi badge mobile `bg-(--accent)/20` → `bg-(--soft)`.
- [MODIFY] `src/app/features/gallery/components/GalleryView.tsx` — Thêm `flex-wrap gap-2` ở hàng tiêu đề, `whitespace-nowrap shrink-0` cho số lượng & nút `So sánh`, sửa dead hover (`hover:bg-(--raised-hover)`).
- [MODIFY] `src/app/projects/[id]/page.tsx` — Thêm `min-w-0` cho cả 2 cột grid; lấy `limits?.maxStorageBytesPerProject ?? 5 * 1024 * 1024` từ `useProjectStore()`; sửa dead hover hàng hội thoại.
- [MODIFY] `src/components/features/projects/KnowledgePanel.tsx` — Hiện `<Skeleton />` khi `isLoading && safeDocuments.length === 0`; định nghĩa kiểu mở rộng tường minh `KnowledgeDocument & { chunk_count?: number }` (không `any`) trong helper `resolveDocumentChunkCount` để hiển thị số chunk an toàn (`total_chunks` → `chunk_count` → `0`); bảo vệ chia 0 khi `storageMaxBytes === 0`.
- [MODIFY] `src/components/features/projects/ProjectIcon.tsx` — Thêm `Sparkles` + chuẩn hóa key, thêm `overflow-hidden`, fallback `<Folder>` cho slug ASCII lạ.
- [MODIFY] `src/app/features/projects/components/ProjectChatView.tsx` — Sửa dropdown `z-(--z-popover)`, `bg-(--surface)/95`, `origin-(--radix-dropdown-menu-content-transform-origin)`.
- [MODIFY] `src/app/features/personas/components/PersonaList.tsx` — Thêm `fallback={<User className="h-5 w-5" />}` cho `<DynamicIcon />`.

**Nhóm F — Translations, Existing Unit Tests & Living Docs (14 files):**

- [MODIFY] `src/lib/utils/translations/vi.ts` — Thêm 24 key prompt gợi ý Landing + 4 key Describe.
- [MODIFY] `src/lib/utils/translations/en.ts` — Thêm 28 key tiếng Anh đối xứng 100%.
- [MODIFY] `src/lib/config/theme-config.test.ts` — Mở rộng kiểm chứng WCAG AA $\ge 4.5:1$ cho state colors, `--accent`/`--faint` trên `--raised`, `hoanghon` swatch và CSS imports mới.
- [MODIFY] `src/components/ui/DynamicIcon.test.tsx` — Thêm test kebab-case (`pen-tool`), unknown ASCII slug fallback và `overflow-hidden`.
- [MODIFY] `src/app/features/layout/HeaderBar.test.tsx` — Cập nhật assertion logo (Loại C: `"V"` → `"v"` khớp `<VikiniLogo size="sm" />`) + kiểm chứng chữ `{t("appName")}` dùng `text-(--text)` không gradient mờ.
- [MODIFY] `src/app/features/layout/hooks/useAppFrameState.test.ts` — Thêm test lọc `projectId`/`vikini-novelcrafter`, null-guard + `closeMobile()` khi tạo chat Project, và xác nhận không bắn trùng `toast` / không gọi thừa `refreshConversations()`.
- [MODIFY] `src/app/features/layout/components/AppFrame.test.tsx` — Kiểm chứng wiring 6 handler sang `<Sidebar>` và Rename dialog.
- [MODIFY] `src/app/features/layout/components/GlobalCommandPalette.test.tsx` — Thêm test `Ctrl+K` hoạt động trên `/projects/p1` và tắt trên `/` & `/features/chat`.
- [MODIFY] `src/app/features/sidebar/components/Sidebar.test.tsx` — Cập nhật assertion `pb-[calc(1.25rem+var(--sab,0px))]` (Loại C) + test `bg-(--surface)`/`bg-(--overlay)`, `onNavigate`, `onAdmin` tự đóng drawer.
- [MODIFY] `src/app/features/chat/components/InputForm.test.tsx` — Thêm test `isPreview={true}` không tăng `textarea.style.height`, cỡ chữ `text-base md:text-[15px]`, không còn `transition-all`.
- [MODIFY] `src/app/features/chat/components/CommandPalette.test.tsx` — Thêm test mở/đóng tức thì (`instant` áp dụng cho cả `DialogContent` lẫn `DialogOverlay`, không delay `setTimeout`) và `pr-10` trên thanh search.
- [MODIFY] `src/app/features/image-gen/components/DescribeImageView.test.tsx` — Thêm test click mục lịch sử hiển thị thumbnail + prompt (kể cả khi thumbnail rỗng), an toàn khi `localStorage.setItem`/`removeItem` ném lỗi, và toast song ngữ.
- [MODIFY] `src/components/features/projects/KnowledgePanel.test.tsx` — Thêm test `isLoading={true}` render `<Skeleton>` (không nháy Empty State) và hiển thị chunk count kể cả khi chỉ có `chunk_count` hoặc `undefined`.
- [MODIFY] `docs/CHANGELOG.md` — Cập nhật mục phát hành cho Phase 1 & Phase 2 UX/UI audit fixes.

#### Xóa Bỏ (0 files)

- Không xóa file nào trong phạm vi Phase 1–2.

---

### 6. Caller-First Design Sketch

#### 6.1 `toastStore` & `ToastContainer` (Caller & Timer Invariants)

```ts
// toastStore.ts invariants:
// 1. duration <= 0 (sticky toast): NEVER added to timers Map -> pauseToast/resumeToast are safe no-ops.
// 2. addToast while visibilityPaused === true: creates entry with timerId: null, remainingMs: duration;
//    does NOT start setTimeout until setVisibilityPaused(false) runs.
// 3. syncTimer(id): starts setTimeout(remainingMs) iff !entry.hoverPaused && !visibilityPaused;
//    otherwise clears active timerId and deducts elapsed ms from remainingMs.

// ToastContainer lifecycle wiring:
const { toasts, removeToast, pauseToast, resumeToast, setVisibilityPaused } = useToastStore();
useEffect(() => {
  const onVisibility = () => setVisibilityPaused(document.hidden);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    setVisibilityPaused(false);
  };
}, [setVisibilityPaused]);
// Each toast item:
// onMouseEnter={() => pauseToast(item.id)} onMouseLeave={() => resumeToast(item.id)}
// onFocus={() => pauseToast(item.id)}
// onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resumeToast(item.id); }}
```

#### 6.2 Landing Hover Preview Anti-Oscillation Contract (`DashboardView` → `ChatControls` → `InputForm`)

```ts
// Helper exported from DashboardView.tsx for direct unit testing:
export function toSingleLinePreview(prompt: string): string {
  return prompt.replace(/\s*\n+\s*/g, " ").trim();
}

// In DashboardView:
// Hover: onPromptPreview?.(sug.promptKey ? toSingleLinePreview(t(sug.promptKey)) : null)
// Click: onPromptSelect?.(t(sug.promptKey)) // preserves full "\n\n" formatting!

// In InputForm.tsx:
useEffect(() => {
  if (!textareaRef.current) return;
  if (isPreview) {
    textareaRef.current.style.height = "";
    return;
  }
  textareaRef.current.style.height = "auto";
  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
}, [input, isPreview]);
```

#### 6.3 `AppFrame` + `useAppFrameState` Wiring (Delegated Mutations — Zero Duplicate Toasts)

```ts
// useAppFrameState.ts delegates mutate() & toast.success/error to useConversation.ts (lines 431-520):
// handleSelectProject(projectId):   router.push(`/projects/${projectId}`); closeMobile();
// handleCreateProjectChat(projectId):
//   const conv = await createConversation({ title: "", projectId });
//   if (!conv) return;              // null-guard when createConversation aborts/fails
//   closeMobile();
//   router.push(`/?id=${conv.id}`);
// handleDeleteChat(id):
//   const ok = await confirm({ title, description, variant: "danger", ... });
//   if (!ok) return;
//   await deleteConversation(id);   // already calls toast + mutate() internally
// confirmRenameChat():
//   const trimmed = renameValue.trim();
//   if (!renamingChatId || !trimmed) return;
//   const targetId = renamingChatId;
//   closeRenameChat();
//   renameConversationOptimistic(targetId, trimmed);
//   await renameConversation(targetId, trimmed); // already calls toast + mutate() internally
```

#### 6.4 `DialogContent` / `DialogOverlay` Instant Mode, `animations.css` Contract & `VikiniLogo`

```tsx
// dialog.tsx:
// DialogOverlay accepts `instant?: boolean` -> omits animate-in/animate-out, applies `animate-none duration-0`
// DialogContent accepts `instant?: boolean` -> passes `<DialogOverlay instant={instant} />` and omits animate-in/out on content
// Both DialogContent & AlertDialogContent drop Tailwind v3 `slide-in-from-left-1/2` / `slide-in-from-top-[48%]` / `slide-out-to-*`

// CommandPalette.tsx caller:
<DialogContent
  instant
  onOpenAutoFocus={(e) => {
    e.preventDefault();
    inputRef.current?.focus();
  }}
  className="max-w-xl p-0 gap-0 overflow-hidden bg-(--surface) border-(--line)"
>

// Shared brand logo primitive (SignInPage, HeaderBar, MobileNavDrawer):
<VikiniLogo size="sm" /> // sm: h-8 w-8 rounded-lg text-xl | md: h-10 w-10 | lg: h-16 w-16 rounded-2xl text-4xl
```

```css
/* animations.css — Tailwind v4 pure-CSS contract (zero npm deps):
 * - Uses transform: translate3d(...) scale3d(...) ONLY (never writes CSS `translate`, preserving centering).
 * - Reads var(--tw-duration, 180ms), easing cubic-bezier(0.23, 1, 0.32, 1), animation-fill-mode: both.
 * - Full utilities matching codebase usage:
 *   animate-in, animate-out,
 *   fade-in, fade-in-0, fade-out, fade-out-0,
 *   zoom-in (0.95), zoom-in-95 (0.95), zoom-out (0.95), zoom-out-95 (0.95),
 *   slide-in-from-top-1 (-0.25rem), slide-in-from-top-2 (-0.5rem),
 *   slide-in-from-bottom-1 (0.25rem), slide-in-from-bottom-2 (0.5rem),
 *   slide-in-from-left-2 (-0.5rem), slide-in-from-right-2 (0.5rem),
 *   bare 100% Sheet slides: slide-in-from-left/right/bottom/top, slide-out-to-left/right/bottom/top,
 *   .toast-enter with @starting-style { opacity: 0; transform: translateY(-8px) scale(0.97); }.
 */
```

#### 6.5 `GlobalCommandPalette` Route Guard

```ts
// Exported pure helper in GlobalCommandPalette.tsx:
export function isChatAppRoute(pathname: string): boolean {
  return (
    pathname === "/" || pathname === "/features/chat" || pathname.startsWith("/features/chat/")
  );
}
// enabled = status === "authenticated" && !pathname.startsWith("/auth") && !isChatAppRoute(pathname);
```

#### 6.6 `DynamicIcon` & `ProjectIcon` Safe Resolution

```ts
// DynamicIcon.tsx:
export function normalizeIconName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "");
}
// Unrecognized multi-char ASCII identifier (e.g. "unknown-slug"): render fallback ?? <Sparkles ... />
// Emoji / short symbol (e.g. "💡", "◆"): render <span className="... overflow-hidden max-w-full">

// ProjectIcon.tsx:
// Normalize key via icon.trim().toLowerCase() -> ICON_MAP (includes "sparkles": Sparkles)
// Unrecognized ASCII slug -> fallback <Folder /> (never spills raw text outside box)
// Emoji -> <span className="... overflow-hidden">
```

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

#### Giai đoạn A — CSS Foundation, 10-Theme WCAG AA & Pure-CSS Animations

- [ ] **Bước 1**: Tạo `src/app/styles/themes/_shared/animations.css` (Tailwind v4 `@utility` cho `animate-in`/`animate-out` đọc `var(--tw-duration, 180ms)` + `animation-fill-mode: both` + `transform: translate3d(...) scale3d(...)` không đè `translate`, phủ đủ `fade-in`/`fade-in-0`/`fade-out`/`fade-out-0`, `zoom-in`/`zoom-in-95`/`zoom-out`/`zoom-out-95`, `slide-in-from-*-1`/`-2`, bare 100% `slide-in-from-left|right|bottom|top` & `slide-out-to-*` cho `SheetContent`, cùng `.toast-enter` dùng `@starting-style`) và `src/app/styles/themes/_shared/hljs.css` (biến `--hljs-*` Dark + 5 Light đạt WCAG AA $\ge 4.5:1$ cùng ánh xạ `.hljs-*`).
- [ ] **Bước 2**: Cập nhật `src/app/globals.css` import `animations.css` và `hljs.css` trong nhóm SHARED (trước các file theme).
- [ ] **Bước 3**: Cập nhật `src/app/styles/themes/_shared/base.css` (thêm `--raised-hover`, `--shadow-elevated`; cập nhật `--danger`/`--danger-hover`/`--danger-foreground` cho Dark; bổ sung override `--danger`, `--danger-hover`, `--danger-foreground`, `--success`, `--warning`, `--shadow-elevated` cho 5 Light themes) và tinh chỉnh `src/app/styles/themes/_shared/utilities.css` (`code:not(pre code)` dùng `font-size: max(0.75rem, 0.85em);`, `.chat-markdown > pre`, `.typing-dots span`, `@media (hover: hover) and (pointer: fine)` cho 3 hover transform, `prefers-reduced-motion` giữ lại opacity/color nhẹ).
- [ ] **Bước 4**: Cập nhật 5 file theme (`hoanghon.css`, `muc.css`, `reu.css`, `sen.css`, `than.css`) và `src/lib/config/theme-config.ts` (đồng bộ swatch `#b33a08`); mở rộng `src/lib/config/theme-config.test.ts` kiểm chứng toán học toàn bộ cặp tương phản WCAG AA trên 10/10 themes.

#### Giai đoạn B — Shared UI Primitives, Brand Logo, Toast & Translations

- [ ] **Bước 5**: Tạo `src/components/ui/vikini-logo.tsx`; cập nhật `src/app/auth/signin/page.tsx`, `src/app/features/layout/components/HeaderBar.tsx` (kèm sửa dead hover & bỏ gradient mờ chữ `"Chat"`), `src/app/features/layout/HeaderBar.test.tsx` (Loại C: `"V"` → `"v"`), và `src/app/features/sidebar/components/MobileNavDrawer.tsx`.
- [ ] **Bước 6**: Nâng cấp `src/lib/store/toastStore.ts` (timer Map + `pauseToast`/`resumeToast`/`setVisibilityPaused`/`clearAllToasts` bảo toàn bất biến `visibilityPaused` khi `addToast` & `duration <= 0` sticky toast) + viết `src/lib/store/toastStore.test.ts`; nâng cấp `src/components/ui/ToastContainer.tsx` (kèm `onBlur` guard `relatedTarget`) + viết `src/components/ui/ToastContainer.test.tsx`; mount `<ToastContainer />` duy nhất tại `MainLayout.tsx` và gỡ ở `ChatApp.tsx`, `NovelcrafterStudioApp.tsx`, `PromptStudioApp.tsx`.
- [ ] **Bước 7**: Sửa các Radix/Shadcn UI primitives: `switch.tsx` (thumb `--on-accent`), `dropdown-menu.tsx` (`bg-(--surface)` + `transform-origin`), `button.tsx` (`active:scale-[0.97]`, `outline` vs `secondary`, `hover:bg-(--raised-hover)`), `popover.tsx` (`transform-origin`), `tooltip.tsx` (`transform-origin` + `data-[state=instant-open]:animate-none`), `dialog.tsx` (gỡ class slide double-translate + truyền `instant` xuống cả `DialogOverlay` & `DialogContent`) & `alert-dialog.tsx` (gỡ class slide double-translate), `sheet.tsx` (bật `animate-in`/`animate-out`).
- [ ] **Bước 8**: Sửa `DynamicIcon.tsx` (+ mở rộng `DynamicIcon.test.tsx`), `ProjectIcon.tsx` (+ tạo `ProjectIcon.test.tsx`), và thêm fallback `<User />` ở `PersonaList.tsx`.
- [ ] **Bước 9**: Bổ sung đồng bộ 28 key dịch thuật mới vào cả `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`, chạy `npm run type-check` xác nhận key parity 100%.

#### Giai đoạn C — Shell Wiring, Dead Clicks & Mobile Drawer

- [ ] **Bước 10**: Nâng cấp `useAppFrameState.ts` (lọc `!c.projectId` & `vikini-novelcrafter`, thêm 6 handler Project/Chat + state rename ủy quyền toast/`mutate` cho `useConversation`, thêm null-guard `if (!conv) return;` + `closeMobile()` trong `handleCreateProjectChat`) và `AppFrame.tsx` (truyền đủ 6 handler vào `<Sidebar>` + Rename `<Dialog>`); cập nhật `useAppFrameState.test.ts` và `AppFrame.test.tsx`.
- [ ] **Bước 11**: Cập nhật `Sidebar.tsx` (`onNavigate={onCloseMobile}`, `TooltipProvider delayDuration={300} skipDelayDuration={300}`), `ContextPanelContent.tsx` (dead hover primary button), `MobileNavDrawer.tsx` (`onAdmin` gọi `onClose?.()`, `bg-(--surface)`, `bg-(--overlay)`, `pb-[calc(1.25rem+var(--sab,0px))]`, `motion.ts`), `SidebarItem.tsx`, `ProjectNode.tsx`, `ProjectChatView.tsx` (`bg-(--surface)/95` + `transform-origin` + `z-(--z-popover)`); cập nhật `Sidebar.test.tsx`.
- [ ] **Bước 12**: Sửa `GlobalCommandPalette.tsx` (`isChatAppRoute` để bật lại `⌘K` trên `/projects/[id]`) và cập nhật `GlobalCommandPalette.test.tsx`; sửa `CommandPalette.tsx` (instant `⌘K` trên cả content & overlay, bỏ `setTimeout 50ms`, thêm `pr-10`) và cập nhật `CommandPalette.test.tsx`.

#### Giai đoạn D — Chat Landing Anti-Oscillation, Composer, Bubbles & Code Block

- [ ] **Bước 13**: Sửa lỗi P0 Hover-Layout Feedback Loop & Composer Layout: cập nhật `ChatApp.tsx` (neo dọc Landing `pt-[12vh] md:pt-[18vh]`), `DashboardView.tsx` (24 prompt song ngữ, preview 1 dòng, `max-w-3xl lg:max-w-4xl xl:max-w-5xl px-0 md:px-6`, `aria-label` nút đóng, `motion.ts`) + tạo `DashboardView.test.tsx`; cập nhật `ChatControls.tsx` (bỏ double padding khi `isLanding`, đồng bộ safe-area mobile `0.75rem`, `shadow-(--shadow-elevated)`).
- [ ] **Bước 14**: Cập nhật `InputForm.tsx` (chặn auto-resize khi `isPreview === true`, Row 2 `flex w-full items-center gap-1 @sm/chat:gap-2 min-w-0` giữ `basis-full` Row 1, `+`/`Send` mobile `h-9 w-9 sm:h-10 sm:w-10`, `text-base md:text-[15px]`, sửa dead hover & `transition-all` & `shadow-(--shadow-elevated)`), `ComposerLeadingControls.tsx` (an toàn không tràn ngang cả khi `fileCount > 0`), `ComposerChip.tsx`, `VoiceButton.tsx`, và `ModelSelector.tsx` (`resolveChatModelDisplay()`, `min-w-0 max-w-full overflow-hidden`, bỏ `<span onClick>`); cập nhật `InputForm.test.tsx` và tạo `ModelSelector.test.tsx`.
- [ ] **Bước 15**: Cập nhật `SmartCode.tsx` (`my-0` trên `<pre>`, thay cả `scrollbar-thumb-white/10` & `hover:scrollbar-thumb-white/20` bằng `scrollbar-thumb-(--line)`, `shadow-(--shadow-elevated)`, bỏ `transition-all`, `toast.error`), `ChatBubble.tsx` (Cancel hover & `min-w` an toàn), `BubbleHelpers.tsx` (pure CSS `TypingDots`, `ThinkingBlock` hover), `EmptyReasoningNotice.tsx` (hover & bỏ `transition-all`).

#### Giai đoạn E — Image Studio, Describe, Gallery & Project Page

- [ ] **Bước 16**: Sửa P0 `/describe` History Click trong `DescribeImageView.tsx` (`setImagePreview(item.thumbnail || null)` + `setResult(item.prompt)` + nhánh hiển thị khi `Boolean(imagePreview || result)`, `try/catch` cả `addToHistory` lẫn `clearHistory`, thêm `t` vào deps `handleFileSelect`, song ngữ toast/alt, hover & `motion.ts`) và mở rộng `DescribeImageView.test.tsx`.
- [ ] **Bước 17**: Sửa Image Studio & Gallery: `ControlPanel.tsx` (`h-auto min-h-10 py-2 [&>span]:line-clamp-none`, `z-(--z-popover)`, `hidden md:block pointer-coarse:hidden`), `ImageGenStudio.tsx` (`flex-1 min-h-0`, `bg-(--soft)`), `GalleryView.tsx` (`flex-wrap gap-2`, `whitespace-nowrap shrink-0`, dead hover).
- [ ] **Bước 18**: Sửa `/projects/[id]/page.tsx` (`min-w-0` cho 2 cột grid, `limits?.maxStorageBytesPerProject ?? 5 * 1024 * 1024`, dead hover) và `KnowledgePanel.tsx` (`<Skeleton />` khi `isLoading && safeDocuments.length === 0`, chunk count fallback, chia 0 an toàn); mở rộng `KnowledgePanel.test.tsx`.

#### Giai đoạn F — Verification, Visual QA & Living Docs

- [ ] **Bước 19**: Chạy đầy đủ `npm run type-check; npm run lint; npm run test:run`, thực hiện các Wiring Probe & Negative Probe.
- [ ] **Bước 20**: Chạy Playwright Visual QA live trên `next dev` với dữ liệu mock tại Desktop (`1440×900`) & Mobile (`375×812`) × Dark/Light (bao gồm `hoanghon-light` và `than-dark`/`than-light`), chạy `axe-core` + script đo ổn định tọa độ hover trên Landing (0px shift), gọi `read_file` soi từng ảnh chụp, và cập nhật `docs/CHANGELOG.md`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID           | Nhóm Hành Vi                                                    | Input / Điều Kiện                                                                                                                                   | Output Mong Đợi (Pass)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Failure Mode / Boundary Condition (Fail nếu vi phạm)                                                                                                                                                    |
| ------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-P1-01** | `toastStore` timer pause/resume & invariants                    | `addToast("Hi", "info", 5000)` + `addToast("Sticky", "info", 0)` + `addToast("Bg", "error", 5000)` khi `visibilityPaused === true`                  | Toast thường paused khi hover (`pauseToast`) hoặc tab ẩn (`setVisibilityPaused(true)`), tự xóa đúng thời gian còn lại sau resume; `addToast` lúc `visibilityPaused === true` KHÔNG đặt `setTimeout` cho tới khi `setVisibilityPaused(false)`; sticky toast (`duration <= 0`) không bị xóa khi gọi `pauseToast`/`resumeToast`; `ToastContainer` `onBlur` nội bộ (`currentTarget.contains(relatedTarget)`) không gọi `resumeToast`.                                                                                                                                                                                                                                                                                                           | Fail nếu toast tự biến mất khi tab đang ẩn (kể cả toast mới thêm trong lúc ẩn), hoặc resume sớm toast đang hover, hoặc sticky toast bị xóa sau hover, hoặc ném lỗi khi pause/resume `id` không tồn tại. |
| **TC-P1-02** | `ToastContainer` toàn cục                                       | Render `MainLayout` + bắn `toast.error("Lỗi")`                                                                                                      | `<ToastContainer />` render duy nhất 1 vùng `role="region"` toàn app; item có `bg-(--surface)` (không có `/10`), `max-w-[calc(100vw-2rem)]`; không còn `<ToastContainer />` trong `ChatApp`, `NovelcrafterStudioApp`, `PromptStudioApp`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Fail nếu bất kỳ trang nào mount trùng 2 container hoặc toast dùng nền trong suốt `/10`.                                                                                                                 |
| **TC-P1-03** | Hover-Layout Anti-Oscillation (`DashboardView` + `InputForm`)   | Hover gợi ý `"Review và tối ưu code"` (`promptKey` có `\n\n`) trên Landing                                                                          | `DashboardView` đẩy preview 1 dòng sạch (không chứa `\n`); `InputForm` với `isPreview={true}` không set `textarea.style.height = scrollHeight` (chiều cao Composer dịch chuyển `0px`); click mới đổ full prompt có `\n\n` và bung chiều cao; tiếng Việt xuất prompt tiếng Việt, tiếng Anh xuất prompt tiếng Anh; nút đóng dropdown có `aria-label`.                                                                                                                                                                                                                                                                                                                                                                                         | Fail nếu `isPreview={true}` gọi auto-resize hoặc làm nhảy tọa độ `y` của dropdown $> 0\text{px}$ khi rê chuột liên tục, hoặc vẫn còn chuỗi English hardcode khi `language === "vi"`.                    |
| **TC-P1-04** | `/describe` History Click & `localStorage` Resilience           | `localStorage` có mục `{ thumbnail, prompt: "A sunset", timestamp }` (cả có thumbnail lẫn `thumbnail: ""`); click mục lịch sử                       | Khi có thumbnail, `imagePreview` được set bằng `item.thumbnail` và hiện đủ ảnh + `"A sunset"`; khi `item.thumbnail` rỗng vẫn hiện khối kết quả `"A sunset"`. Nếu `localStorage.setItem` hoặc `removeItem` ném `QuotaExceededError`, UI không crash. Toast lỗi file/copy dùng key dịch thuật; `handleFileSelect` khai báo đủ `[t]` deps.                                                                                                                                                                                                                                                                                                                                                                                                     | Fail nếu click lịch sử vẫn hiện khung upload, hoặc ném uncaught exception khi storage đầy/bị chặn.                                                                                                      |
| **TC-P1-05** | `AppFrame` + `useAppFrameState` + `Sidebar` + `MobileNavDrawer` | `conversations` gồm chat thường, chat có `projectId: "p1"`, `vikini-image-studio`, `vikini-novelcrafter`; test `createConversation` trả `null`      | `mainChats` chỉ còn chat thường; `AppFrame` truyền đủ 6 handler Project/Chat xuống `Sidebar`; `handleCreateProjectChat` kiểm tra `if (!conv) return;` và gọi `closeMobile()` trước `router.push`; `handleDeleteChat`/`confirmRenameChat` ủy quyền toast & `mutate()` cho `useConversation` (không bắn 2 toast trùng); `Sidebar` truyền `onNavigate={onCloseMobile}` cho `ContextPanelContent` trong mobile drawer; bấm `Admin` gọi cả `onAdmin` lẫn `onClose`; drawer có `bg-(--surface)`, overlay `bg-(--overlay)`, `pb-[calc(1.25rem+var(--sab,0px))]` (**Loại C**: cập nhật `src/app/features/sidebar/components/Sidebar.test.tsx:203`).                                                                                                 | Fail nếu chat thuộc Project lặp trong `mainChats`, bấm Project là dead click, bắn trùng 2 toast, lỗi runtime khi `createConversation` trả `null`, hoặc drawer mobile không đóng khi bấm tab Ảnh/Admin.  |
| **TC-P1-06** | `GlobalCommandPalette` trên `/projects/[id]`                    | Đứng tại `/projects/proj-1`, nhấn `Ctrl+K` / `⌘K`                                                                                                   | Mở dialog `CommandPalette`; vẫn giữ tắt trên `/` và `/features/chat`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Fail nếu `Ctrl+K` không mở trên `/projects/proj-1` hoặc mở trùng 2 palette trên `/`.                                                                                                                    |
| **TC-P1-07** | Contrast WCAG AA 10 Themes & `Switch`                           | Quét toán học toàn bộ 10 theme trong `theme-config.test.ts` + render `Switch`                                                                       | 10/10 themes đạt: `--danger`/`--success`/`--warning` trên `--bg`/`--surface`/`--raised` $\ge 4.5:1$; `--danger-foreground` trên `--danger` & `--danger-hover` $\ge 4.5:1$; `--accent` & `--faint` trên `--raised` $\ge 4.5:1$; `--on-accent` trên `--accent` $\ge 4.5:1$. `Switch` thumb chứa `data-[state=checked]:bg-(--on-accent)`.                                                                                                                                                                                                                                                                                                                                                                                                      | Fail nếu bất kỳ cặp màu nào $< 4.5:1$ (đặc biệt `hoanghon-light` `--accent` trên `--raised` hoặc `than-dark`/`than-light` Switch).                                                                      |
| **TC-P1-08** | Visual Layout Fixes (Composer 375px, Images, Gallery, Project)  | Render trên Desktop `1440×900` và Mobile `375×812` (cả `fileCount === 0` lẫn `fileCount > 0`)                                                       | Composer Mobile 375px gọn tối đa 2 hàng khi `fileCount === 0` (`DashboardView` `px-0 md:px-6`, `ChatControls` safe-area `0.75rem`, `+`/`Mic`/`Send` `h-9 w-9 sm:h-10 sm:w-10`, `ModelSelector` `min-w-0 max-w-full`, `text-base md:text-[15px]`) và không tràn ngang kể cả khi `fileCount > 0`; Landing Desktop 4 chip trên 1 hàng; `ControlPanel` Model trigger dùng `h-auto min-h-10 py-2`, shortcut hint ẩn dưới `md` vẫn giữ `pointer-coarse:hidden`; `ImageGenStudio` dùng `flex-1 min-h-0`; `GalleryView` nút `So sánh` có `whitespace-nowrap`; `/projects/[id]` grid item có `min-w-0` và dùng `limits.maxStorageBytesPerProject`; `KnowledgePanel` hiện `<Skeleton>` khi `isLoading && documents.length === 0` và luôn in số chunk. | Fail nếu `scrollWidth > innerWidth`, bị xén card `Kho kiến thức`, tràn chữ đè label `"Model"`, nháy Empty State khi loading, hoặc in `"121.6 KB • phần"` thiếu số.                                      |
| **TC-P2-01** | Wave 2 Motion Craft & Radix Overlays                            | Mở/đóng `Dialog`, `DropdownMenu`, `Popover`, `Tooltip`, `Sheet`, `CommandPalette`                                                                   | `animations.css` định nghĩa đủ `@utility animate-in/out` (`var(--tw-duration, 180ms)`, `animation-fill-mode: both`, chỉ animate `transform`/`opacity` không đụng `translate`), bare `fade-in`, `slide-in-from-bottom-1`, bare 100% `Sheet` slides; `DialogContent`/`AlertDialogContent` không còn `slide-*-1/2`; `PopoverContent`/`DropdownMenuContent`/`TooltipContent` có `origin-(--radix-*-content-transform-origin)`; `CommandPalette` truyền `instant` xuống **cả `DialogContent` lẫn `DialogOverlay`** (`animate-none duration-0`, không `setTimeout 50ms`, có `pr-10`); `TypingDots` thuần CSS không có `motion.span`; không còn `transition-all` trong `InputForm`/`SmartCode`/`EmptyReasoningNotice`.                             | Fail nếu `CommandPalette` còn delay ở backdrop `DialogOverlay` hoặc `Dialog` bay lệch góc trên trái, hoặc `Tooltip` không tắt animation khi `data-[state=instant-open]`.                                |
| **TC-P2-02** | Code Block `.hljs-*`, Brand Logo, Icons & Model Name            | Render `SmartCode` (có `.hljs-keyword`), `HeaderBar`, `MobileNavDrawer`, `SignInPage`, `DynamicIcon`, `ProjectIcon`, `PersonaList`, `ModelSelector` | `hljs.css` tô màu `.hljs-*` đạt AA trên cả Dark & Light; `<pre>` trong `SmartCode` có `my-0` và chỉ dùng `scrollbar-thumb-(--line)` (không còn `white/10`, `white/20`); 3 vị trí logo đều dùng `<VikiniLogo />` (**Loại C**: cập nhật `src/app/features/layout/HeaderBar.test.tsx:200-203` từ `"V"` → `"v"`); `DynamicIcon("pen-tool")` render `<svg>` `PenTool` và slug lạ rơi về fallback + `overflow-hidden`; `ProjectIcon("sparkles")` render `<svg>` và slug lạ rơi về `<Folder>`; `PersonaList` có fallback `<User>`; `ModelSelector("gemini-2.5-flash")` hiển thị `"Gemini 3.5 Flash-Lite"`.                                                                                                                                         | Fail nếu lộ raw slug `gemini-2.5-flash`, tràn chữ `"pen-tool"`/`"sparkles"`, vỡ `HeaderBar.test.tsx`, hoặc khối code vẫn có 2 dòng trống phía trên.                                                     |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1 Danh Sách Co-Located Unit Tests

- **Logic mới/sửa trong `src/lib/`**:
  - `src/lib/store/toastStore.test.ts` (**Mới** — bắt buộc theo `00-core.md` vì sửa `src/lib/store/toastStore.ts`)
  - `src/lib/config/theme-config.test.ts` (**Cập nhật** — mở rộng kiểm chứng toàn bộ 10 themes + CSS imports)
- **UI Logic & Interaction Tests**:
  - `src/components/ui/ToastContainer.test.tsx` (**Mới**)
  - `src/components/ui/DynamicIcon.test.tsx` (**Cập nhật**)
  - `src/components/features/projects/ProjectIcon.test.tsx` (**Mới**)
  - `src/components/features/projects/KnowledgePanel.test.tsx` (**Cập nhật**)
  - `src/app/features/chat/components/DashboardView.test.tsx` (**Mới**)
  - `src/app/features/chat/components/InputForm.test.tsx` (**Cập nhật**)
  - `src/app/features/chat/components/ModelSelector.test.tsx` (**Mới**)
  - `src/app/features/chat/components/CommandPalette.test.tsx` (**Cập nhật**)
  - `src/app/features/chat/components/SmartCode.test.tsx` (chạy đối chiếu không hồi quy)
  - `src/app/features/chat/components/BubbleHelpers.test.tsx` (chạy đối chiếu không hồi quy)
  - `src/app/features/chat/components/ChatBubble.test.tsx` (chạy đối chiếu không hồi quy)
  - `src/app/features/chat/components/ComposerLeadingControls.test.tsx` (chạy đối chiếu không hồi quy)
  - `src/app/features/layout/HeaderBar.test.tsx` (**Cập nhật** — kèm cập nhật Loại C cho logo `"V"` → `"v"`)
  - `src/app/features/layout/hooks/useAppFrameState.test.ts` (**Cập nhật**)
  - `src/app/features/layout/components/AppFrame.test.tsx` (**Cập nhật**)
  - `src/app/features/layout/components/GlobalCommandPalette.test.tsx` (**Cập nhật**)
  - `src/app/features/sidebar/components/Sidebar.test.tsx` (**Cập nhật** — kèm cập nhật Loại C cho `pb-`)
  - `src/app/features/image-gen/components/DescribeImageView.test.tsx` (**Cập nhật**)
  - `src/app/features/image-gen/components/ControlPanel.test.tsx` (chạy đối chiếu không hồi quy)
  - `src/app/features/gallery/components/GalleryView.test.tsx` (chạy đối chiếu không hồi quy)
  - `src/app/features/personas/components/PersonaList.test.tsx` (chạy đối chiếu không hồi quy)
  - `src/app/projects/[id]/page.test.tsx` & `src/app/auth/signin/page.test.tsx` & `src/components/ui/popover.test.tsx` (chạy đối chiếu không hồi quy)

#### 9.2 Lệnh Kiểm Chứng Tuần Tự (PowerShell 5.1 — dùng `;`, cấm `&&`)

```powershell
# 1. TypeScript strict + Translation key parity check
npm run type-check

# 2. ESLint (bao gồm vikini-design/no-raw-tailwind-colors, no-legacy-tokens, no-sub-12px-text, no-uppercase)
npm run lint

# 3. Chạy tập test mục tiêu trước với output gọn
npx vitest run --reporter=dot src/lib/store/toastStore.test.ts src/lib/config/theme-config.test.ts src/components/ui/ToastContainer.test.tsx src/components/ui/DynamicIcon.test.tsx src/components/features/projects/ProjectIcon.test.tsx src/components/features/projects/KnowledgePanel.test.tsx src/app/features/chat/components/DashboardView.test.tsx src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/ModelSelector.test.tsx src/app/features/chat/components/CommandPalette.test.tsx src/app/features/layout/HeaderBar.test.tsx src/app/features/layout/hooks/useAppFrameState.test.ts src/app/features/layout/components/AppFrame.test.tsx src/app/features/layout/components/GlobalCommandPalette.test.tsx src/app/features/sidebar/components/Sidebar.test.tsx src/app/features/image-gen/components/DescribeImageView.test.tsx

# 4. Chạy toàn bộ test suite trước khi hoàn tất
npm run test:run -- --reporter=dot
```

#### 9.3 Wiring Probes & Negative Probes (`.agents/agents/reviewer/evidence-bar.md` §4.5.3)

- **Wiring Probe 1 (ESLint Vikini Design Rules)**: Chạy `npx eslint --print-config src/components/ui/vikini-logo.tsx` và `npx eslint --print-config src/components/ui/ToastContainer.tsx` xác nhận cả 4 rule (`vikini-design/no-raw-tailwind-colors`, `no-legacy-tokens`, `no-sub-12px-text`, `no-uppercase`) ở mức `error` (`2`).
- **Wiring Probe 2 (Single ToastContainer Mount)**: Kiểm tra grep `<ToastContainer` toàn `src/` chỉ còn đúng 1 lần mount tại `src/app/features/layout/components/MainLayout.tsx` (không còn trong `ChatApp.tsx`, `NovelcrafterStudioApp.tsx`, `PromptStudioApp.tsx`).
- **Wiring Probe 3 (Pure-CSS Animation & HLJS Import Order)**: `src/lib/config/theme-config.test.ts` khẳng định `globals.css` import `animations.css` và `hljs.css` sau `base.css` và trước 5 file theme.
- **Negative Probe 1 (WCAG Contrast Guard)**: Trong `theme-config.test.ts`, xác nhận hàm đo tương phản trả `< 4.5` với cặp vi phạm cũ (`#c2410c` trên `#f3eae1` = `4.35`, `#22c55e` trên `#f3eae1` = `2.07`, `#ecedf0` trên `#f2f2f2` = `1.05`) và trả `>= 4.5` với toàn bộ giá trị mới trên 10/10 theme.
- **Negative Probe 2 (Hover Preview Non-Resize Guard)**: Trong `InputForm.test.tsx`, mock `textarea.scrollHeight = 140` và truyền `isPreview={true}` với chuỗi nhiều dòng `"Line 1\n\nLine 2"` → khẳng định `textarea.style.height` KHÔNG bị gán `"140px"` (`""`), trái ngược với `isPreview={false}` gán `"140px"`.
- **Negative Probe 3 (Toast Timer Pause, Hidden-Add & Sticky Guard)**: Trong `toastStore.test.ts`, xác nhận (a) toast KHÔNG bị xóa sau `duration + 5000ms` khi `pauseToast(id)` hoặc `setVisibilityPaused(true)` đang bật; (b) `addToast(..., 5000)` khi `visibilityPaused === true` KHÔNG tạo timer và KHÔNG bị xóa trong lúc ẩn; (c) `setVisibilityPaused(false)` KHÔNG xóa toast đang bị hover; (d) toast sticky `duration <= 0` KHÔNG bị xóa sau chuỗi `pauseToast` → `resumeToast` → `advanceTimersByTime(60_000)`.
- **Negative Probe 4 (Unknown Icon Slug Guard)**: Trong `DynamicIcon.test.tsx` và `ProjectIcon.test.tsx`, truyền `"unknown-long-slug"` → khẳng định KHÔNG in raw text `"unknown-long-slug"` vào DOM mà rơi về icon fallback an toàn.
- **Negative Probe 5 (`GlobalCommandPalette` & Instant Overlay Guard)**: Trong `GlobalCommandPalette.test.tsx`, xác nhận `Ctrl+K` trên `/` và `/features/chat` KHÔNG mở dialog, còn trên `/projects/p1` mở chính xác 1 dialog; trong `CommandPalette.test.tsx`, xác nhận cả `DialogContent` lẫn `DialogOverlay` đều có `animate-none` / `duration-0` và không chứa `animate-in` / `animate-out`.
- **Negative Probe 6 (`useAppFrameState` Null & No-Duplicate-Toast Guard)**: Trong `useAppFrameState.test.ts`, mock `createConversation` trả `null` → khẳng định `handleCreateProjectChat` KHÔNG gọi `router.push` hay `closeMobile`; gọi `handleDeleteChat`/`confirmRenameChat` khẳng định không tự bắn `toast.success`/`toast.error` trực tiếp.

#### 9.4 Visual QA Playwright Gate (`.agents/rules/03-ui.md:121-128`)

1. Khởi động dev server cục bộ (`npx next dev --webpack -H 127.0.0.1 -p 3100`) và mock auth/API realistic (chat thread có code block + table, projects có documents với `total_chunks`, images, gallery, describe có localStorage history, personas, gems).
2. Chụp ảnh `.png` vào thư mục scratch ngoài git (`<artifact-dir>/scratch/phase1-2-qa/`) ở **Desktop (`1440×900`)** và **Mobile (`375×812`)** × **Dark (`hoanghon-dark`, `than-dark`)** & **Light (`hoanghon-light`, `than-light`)** cho các màn hình:
   - `/` Landing (Desktop + Mobile, kèm **Hover-Oscillation Probe**: mở category `Code`, di chuột liên tục 20 lần qua ranh giới mục `"Review và tối ưu code"` đo `boundingBox().y` của dropdown trước/trong/sau hover — yêu cầu `Math.abs(deltaY) === 0`!)
   - `/` Active Chat Thread (code block `.hljs-*` + không khoảng trống thừa + inline `code` trong table `>= 12px` + ModelSelector tên đẹp + Mobile Composer $\le 2$ hàng)
   - `/images` (Model Select không đè label, `Mở rộng (9)` không cắt đáy, Mobile ẩn shortcut hint, Switch rõ nét trên `than-dark`/`than-light`)
   - `/gallery` (Mobile filter & nút `So sánh` không vỡ dòng + toast nổi rõ khi thao tác)
   - `/describe` (click mục lịch sử hiển thị đủ thumbnail + prompt kết quả)
   - `/projects/[id]` (Mobile 375px card `Kho kiến thức` không bị xén mép phải, hiện đúng `"121.6 KB • 18 phần"`, `⌘K` mở tức thì)
   - `/features/personas` (Persona card có icon fallback, `DynamicIcon("pen-tool")` hiển thị SVG gọn)
   - `/auth/signin` + Mobile Drawer + Dropdown Menu open (logo thống nhất, highlight mục menu rõ, overlay tối đúng `--overlay`).
3. Chạy `axe-core` kiểm tra `color-contrast` = `0` vi phạm trên tất cả các màn hình trên (đặc biệt `hoanghon-light` và `than-dark`/`than-light`), và kiểm tra `document.documentElement.scrollWidth <= window.innerWidth`.
4. Gọi `read_file` trực tiếp lên từng file ảnh `.png` để tự soi bằng mắt trước khi kết luận; tắt dev server sạch và hoàn nguyên `next-env.d.ts` nếu phát sinh.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #      | Rủi Ro                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Mức Độ         | Technical Control & Bằng Chứng Kiểm Chứng (`[SRC]` / Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Kích hoạt `animate-in`/`animate-out` trên Tailwind v4 gây lỗi double-translate (Dialog/AlertDialog bay chéo) hoặc `DialogOverlay` làm trễ đóng `⌘K`                                                                                                                                                                                                                                                                                                                          | **Cao**        | `animations.css` chỉ animate `transform: translate3d(...) scale3d(...)` (không ghi thuộc tính `translate` độc lập); gỡ `slide-*-1/2` / `slide-*-top-[48%]` tại `src/components/ui/dialog.tsx:41` và `src/components/ui/alert-dialog.tsx:39`; truyền `instant` xuống cả `DialogOverlay` lẫn `DialogContent` tại `src/components/ui/dialog.tsx:21-45`; kiểm chứng bằng Negative Probe #5 (`CommandPalette.test.tsx`) & Visual QA Playwright.                                                                                                                                                                    |
| **R2** | Thay đổi màu trạng thái `--danger`/`--success`/`--warning` hoặc `--accent`/`--faint` vô tình làm rớt tương phản WCAG AA trên 1 trong 10 theme                                                                                                                                                                                                                                                                                                                                | **Cao**        | Tách rõ bộ màu Dark (`--danger: #f87171` + `--danger-foreground: #1a0404`) và Light (`--danger: #b91c1c` + `#ffffff`, `--success: #147237`, `--warning: #92400e`) tại `src/app/styles/themes/_shared/base.css:101-145`; khóa cứng bằng công thức tính độ tương phản WCAG 2.2 tự động trên cả 10/10 theme trong `src/lib/config/theme-config.test.ts` + Negative Probe #1 + `axe-core` live.                                                                                                                                                                                                                   |
| **R3** | Vi phạm 4 luật ESLint tùy chỉnh (`vikini-design/*`) khi thêm class màu/hover/scrollbar/shadow mới                                                                                                                                                                                                                                                                                                                                                                            | **Trung bình** | Tuyệt đối không dùng màu Tailwind thô hay legacy token; dùng `--raised-hover`, `--shadow-elevated`, `scrollbar-thumb-(--line)` định nghĩa trong CSS thuần (`base.css`/`hljs.css`); kiểm chứng qua Wiring Probe #1 (`eslint --print-config`) và `npm run lint` đạt 0 errors.                                                                                                                                                                                                                                                                                                                                   |
| **R4** | Sửa bố cục Composer, `HeaderBar` hoặc `MobileNavDrawer` làm vỡ các unit test hiện có (`src/app/features/chat/components/InputForm.test.tsx:335`, `src/app/features/chat/components/ComposerLeadingControls.test.tsx:172`, `src/app/features/image-gen/components/ControlPanel.test.tsx:130`, `src/app/features/sidebar/components/Sidebar.test.tsx:203`, `src/app/features/layout/HeaderBar.test.tsx:200-203`, `src/app/features/chat/components/BubbleHelpers.test.tsx:19`) | **Trung bình** | Đã đọc toàn bộ test nguồn và bảo toàn mọi contract cần giữ (`basis-full`, `@3xl/chat:flex`/`hidden`, `pointer-coarse:hidden`, `active:scale-[0.95]`, 3 `<span>` trong `.typing-dots`); 2 cập nhật đặc tả Loại C được khai báo tường minh trong Test Contract (`src/app/features/sidebar/components/Sidebar.test.tsx:203` `pb-` tại TC-P1-05 và `src/app/features/layout/HeaderBar.test.tsx:200-203` `"V"` → `"v"` tại TC-P2-02); kiểm chứng bằng `npm run test:run`.                                                                                                                                          |
| **R5** | Lệch key song ngữ `vi.ts` vs `en.ts` khi song ngữ hóa 24 prompt gợi ý & 4 chuỗi Describe                                                                                                                                                                                                                                                                                                                                                                                     | **Trung bình** | Áp dụng `.agents/skills/add-translation/SKILL.md`: thêm đồng thời đúng 28 key vào cả 2 file; chốt chặn compile-time `_AssertTranslationsParity` tại `src/lib/utils/translations/index.ts:24-34` + `npm run type-check` lập tức báo lỗi nếu thiếu bất kỳ key nào.                                                                                                                                                                                                                                                                                                                                              |
| **R6** | Rò rỉ timer, tự hủy toast tạo lúc tab ẩn, xóa nhầm toast sticky (`duration <= 0`), hoặc xung đột hover/`onBlur`/`visibilitychange` trong `toastStore.ts`                                                                                                                                                                                                                                                                                                                     | **Trung bình** | Tách `hoverPaused` (per-toast) và `visibilityPaused` (toàn cục), bỏ qua `timers` Map cho `duration <= 0`, không đặt `setTimeout` khi `addToast` chạy lúc `visibilityPaused === true`, guard `currentTarget.contains(relatedTarget)` trong `ToastContainer.tsx`, và `clearTimeout` triệt để trong `removeToast`/`clearAllToasts` tại `src/lib/store/toastStore.ts`; kiểm chứng bằng Fake Timers & Negative Probe #3 trong `src/lib/store/toastStore.test.ts`.                                                                                                                                                  |
| **R7** | Hover-Layout Feedback Loop tái diễn hoặc Mobile 375px Composer bị tràn ngang                                                                                                                                                                                                                                                                                                                                                                                                 | **Cao**        | Phòng thủ đa lớp: (1) `toSingleLinePreview()` loại bỏ `\n` khi hover ở `DashboardView.tsx`, (2) `InputForm.tsx` bỏ qua auto-resize khi `isPreview === true` (Negative Probe #2), (3) `src/app/features/chat/components/ChatApp.tsx:316` đổi `justify-center` sang neo trên `pt-[12vh] md:pt-[18vh]`, (4) khử double-padding `DashboardView.tsx` (`px-0 md:px-6`) & đồng bộ `0.75rem` tại `src/app/features/chat/components/ChatControls.tsx:117` + `min-w-0 max-w-full` ở `ModelSelector.tsx`; kiểm chứng bằng Playwright Hover-Oscillation Probe (`deltaY === 0`) và `scrollWidth <= innerWidth` trên 375px. |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision 1 (chưa có lỗi cũ để kiểm lại).
- Output `node scripts/verify-plan.mjs docs/plans/2026-11-21-ux-ui-audit-phase-1-2-implementation-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - `[PASS] LINE_REF` (toàn bộ 53 tham chiếu `file:line` hợp lệ)
  - `[INFO] CRITIC_REQUIRED no`
  - `[INFO] CRITIC_FLOOR skipped (no audit run)`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                 | Bằng chứng          | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------- | ------- | ----------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/layout/HeaderBar.test.tsx:200-203`        | [SRC], [CMD]        | `HeaderBar.test.tsx:202` kiểm tra exact case-sensitive `screen.getByText("V")` (hiện pass ở baseline). Đổi `src/app/features/layout/components/HeaderBar.tsx:88-90` sang `<VikiniLogo size="sm" />` (chữ thường `"v"` theo `src/app/auth/signin/page.tsx:25-27`) sẽ làm hỏng ngay test này, nhưng `HeaderBar.test.tsx` không có trong Mục 5 (`[MODIFY]`), Mục 3.6, Test Contract (thiếu khai báo Loại C theo `.agents/rules/02-quality.md`), Mục 9.1 và Rủi ro R4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | DEFECT         | [MAJOR] | `src/components/ui/dialog.tsx:21-45`                        | [SRC], [URL]        | Hai lỗ hổng hợp đồng animation: (a) `DialogContent` gắn `<DialogOverlay />` (`dialog.tsx:24,37`) có cứng `data-[state=open]:animate-in data-[state=closed]:animate-out`, nếu prop `instant` không truyền xuống `DialogOverlay` thì Radix `<Presence>` vẫn giữ backdrop chạy exit animation 150–200ms khi đóng `⌘K` (`CommandPalette`), vi phạm TC-P2-01 và `.agents/skills/emil-design-eng/SKILL.md:72,77`; (b) `animations.css` chưa khóa đặc tả kỹ thuật cho các class đang tồn tại trong codebase thật: bare `fade-in` (`src/app/features/sidebar/components/SidebarItem.tsx:97`, `src/app/features/sidebar/components/ProjectNode.tsx:182`, `src/app/features/projects/components/ProjectChatView.tsx:185`, `src/app/features/chat/components/InputForm.tsx:276,395`, `src/app/features/image-gen/components/ControlPanel.tsx:313`), `slide-in-from-bottom-1` (`0.25rem`), bare 100% slide `slide-in-from-left`/`right`/`bottom` & `slide-out-to-*` của `src/components/ui/sheet.tsx:33-37`, đọc `var(--tw-duration, 180ms)` + `animation-fill-mode: both`, và bắt buộc animate qua `transform: translate3d(...) scale3d(...)` (không đè thuộc tính CSS độc lập `translate` đang căn giữa `dialog.tsx:41`/`alert-dialog.tsx:39`/`select.tsx:73`/`ControlPanel.tsx:313`). |
| 3   | DEFECT         | [MAJOR] | `src/app/features/chat/hooks/useConversation.ts:442-523`    | [SRC]               | `renameConversation` (`useConversation.ts:458-462`) và `deleteConversation` (`useConversation.ts:515-520`) đã tự gọi `await mutate()` và tự bắn `toast.success`/`toast.error` nội bộ (không throw). Sketch Mục 6.3 của `useAppFrameState.ts` (`deleteConversation(id) -> refreshConversations() + toast`) sẽ gây bắn trùng 2 toast mỗi lần xóa/đổi tên và gọi thừa `mutate()`. Ngoài ra `handleCreateProjectChat` chưa kiểm tra null cho kết quả `createConversation` (`useConversation.ts:173` trả `Promise<FrontendConversation \| null>`) và chưa gọi `closeMobile()` như `src/app/features/chat/components/hooks/useProjectNavigation.ts:51-56,75-78`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | DEFECT         | [MAJOR] | `src/app/features/chat/components/ChatControls.tsx:113-117` | [SRC]               | Ngân sách chiều rộng Mobile 375px có lỗi tràn ngang: (a) Trên Landing Mobile, `src/app/features/chat/components/ChatApp.tsx:298` đã có `px-4 md:px-0` trong khi `src/app/features/chat/components/DashboardView.tsx:152` vẫn giữ `px-4` (bị cộng dồn thành 64px lề ngang, còn 293px bên trong `InputForm`); (b) Trên Thread Mobile, `ChatControls.tsx:117` có `pl-[calc(1rem+var(--sal,0px))] pr-[calc(1rem+var(--sar,0px))]` ghi đè `px-3` ở dòng 113; (c) Hàng 2 có `+` (`40px`) + `Tùy chọn` (`100–122px`) + `VoiceButton` (`36px`) + `Send` (`40px`) + gaps (`20px`) = `236–258px`, chỉ còn `35–57px` cho `ModelSelector` (nút tại `src/app/features/chat/components/ModelSelector.tsx:74` cũng thiếu `min-w-0 max-w-full`) và sẽ tràn `scrollWidth > innerWidth` khi `fileCount > 0` (`Tệp (1)`). Cần bỏ `px-4` mobile thừa ở `DashboardView.tsx:152` (`px-0 md:px-6`), đồng bộ `0.75rem` tại `ChatControls.tsx:117`, đồng bộ kích thước `+`/`Send` mobile `h-9 w-9 sm:h-10 sm:w-10`, thêm `min-w-0` cho `ModelSelector` và xử lý wrap/co an toàn khi `fileCount > 0`.                                                                                                                                                                                                  |
| 5   | DEFECT         | [MAJOR] | `src/lib/store/toastStore.ts:20-38`                         | [SRC], [ADV]        | Hợp đồng timer `toastStore` (Mục 6.1, TC-P1-01, Rủi ro R6) bỏ sót 2 edge case vòng đời quan trọng: (a) Gọi `addToast` khi `visibilityPaused === true` (tab đang ẩn, ví dụ lỗi nền trả về) — nếu `addToast` vẫn đặt `setTimeout` mà không kiểm tra `visibilityPaused`, toast tự hủy trước khi người dùng quay lại tab; (b) Toast tồn tại vô hạn `duration <= 0` (`toastStore.ts:26` hiện có `if (duration > 0)`) — nếu `resumeToast` không bỏ qua toast persistent thì rê chuột vào/ra sẽ gắn timer 0ms làm mất toast. Đồng thời `onBlur` ở `ToastContainer` cần kiểm tra `!e.currentTarget.contains(e.relatedTarget as Node \| null)` tránh resume giả khi chuyển focus trong cùng toast.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6   | DEFECT         | [MINOR] | `src/types/projects.ts:72-85`                               | [SRC], [URL]        | Ba chi tiết triển khai cần khóa rõ: (a) `KnowledgeDocument` (`src/types/projects.ts:79`) chỉ có `total_chunks`, nên đọc `chunk_count` trong `src/components/features/projects/KnowledgePanel.tsx:276` cần type mở rộng tường minh (`KnowledgeDocument & { chunk_count?: number }`), cấm `any`; (b) `src/app/styles/themes/_shared/utilities.css:90` nên dùng CSS thuần `font-size: max(0.75rem, 0.85em);` thay vì `@apply text-[max(0.75rem,0.85em)]` để tránh nhập nhằng `font-size` vs `color` của Tailwind v4 (`[URL]`); (c) `src/app/features/image-gen/components/DescribeImageView.tsx:70-93,372` cần thêm `t` vào deps của `handleFileSelect` (`react-hooks/exhaustive-deps`), bọc `try/catch` cả `clearHistory` (`localStorage.removeItem`), bảo vệ trường hợp `item.thumbnail` rỗng, và tại `src/app/features/chat/components/SmartCode.tsx:147` thay cả `scrollbar-thumb-white/10` lẫn `hover:scrollbar-thumb-white/20`.                                                                                                                                                                                                                                                                                                                                           |
| 7   | RISK_DISMISSED | N/A     | `src/app/styles/themes/_shared/base.css:101-145`            | [SRC], [CMD], [URL] | Xác minh độc lập công thức tương phản WCAG 2.2 trên cả 10 theme: Dark `--danger: #f87171` trên `#1d2029` đạt `5.88:1`, `--danger-foreground: #1a0404` trên `--danger-hover: #ef4444` đạt `5.25:1`; Light `--danger: #b91c1c` (`5.44:1`), `--success: #147237` (`5.06:1`), `--warning: #92400e` (`5.96:1`) trên `#f3eae1`; `hoanghon-light` `--accent: #b33a08` (`5.01:1`) và `--faint: #76675c` (`4.57:1`) trên `#f3eae1`; `muc/reu/sen-light` `--faint: #636973` (`4.72:1`) trên `#eeede8`. Đồng thời xác nhận `[URL]` Tailwind v4 biên dịch `shadow-(--shadow-elevated)` thành `box-shadow: var(--shadow-elevated)` (tách biệt với `shadow-(color:--var)`) và `[CMD]` `npx eslint --print-config src/components/ui/ToastContainer.tsx` kích hoạt cả 4 rule `vikini-design/*` ở mức `2` (`error`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                     | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7 mục + Skills + Risk Controls) | FAIL    | [CMD], [SRC] | `verify-plan.mjs` pass 7/7 mục, nhưng thiếu `HeaderBar.test.tsx` (Mục 5, 8, 9.1, R4), thiếu đặc tả kỹ thuật `animations.css` & `DialogOverlay instant` (Mục 6), và thiếu kiểm soát `toastStore` hidden-tab/persistent toast (Mục 8, R6).                                                                                                                          |
| S1: Cold-start & Build                                  | PASS    | [CMD], [SRC] | Baseline `npm run type-check` (exit 0), `npm run lint` (exit 0), `npx vitest run` 15 file mục tiêu (142/142 tests pass), `npx eslint --print-config src/components/ui/ToastContainer.tsx` (4 rule `vikini-design/*` ở mức `2`). `package.json` không thêm dependency hay biến `.env` mới.                                                                         |
| S2: Runner Lifecycle & Teardown                         | FAIL    | [SRC], [ADV] | `src/lib/store/toastStore.ts:20-38` chưa xử lý `addToast` khi `visibilityPaused === true` và hover/resume trên toast `duration <= 0`; `src/components/ui/dialog.tsx:24,37` còn giữ exit animation của `DialogOverlay` khi `CommandPalette` bật `instant`.                                                                                                         |
| S3: Database & Temporal Logic                           | N/A     | [SRC]        | Kế hoạch thuần UI/CSS/client store, không chạm `supabase/`, `database-migrations/`, `*.sql` hay `*.server.ts`.                                                                                                                                                                                                                                                    |
| S4: Cross-Task State Flow                               | FAIL    | [SRC]        | `useAppFrameState.ts` bắn trùng toast với `src/app/features/chat/hooks/useConversation.ts:458-520`, thiếu null-guard & `closeMobile()` trong `handleCreateProjectChat`; `HeaderBar.test.tsx:202` bị vỡ do đổi `"V"` → `"v"`; Mobile 375px Composer bị double-padding tại `DashboardView.tsx:152` và `ChatControls.tsx:117` đè `px-3`.                             |
| S5: Security Boundary & 3-Tier Auth                     | N/A     | [SRC]        | Không sửa API route (`src/app/api/**`), auth logic, Redis rate limit hay file `*.server.ts`; chỉ gọi các client hook/API sẵn có.                                                                                                                                                                                                                                  |
| S6: External Resilience & Serverless Cap                | N/A     | [SRC]        | Không sửa AI provider client, SSE stream hay cấu hình `maxDuration` của serverless route.                                                                                                                                                                                                                                                                         |
| Domain: Open Inquiry (Vikini)                           | PASS    | [SRC]        | Đối chiếu `src/lib/core/modelPicker.ts:132-157` + `src/lib/core/modelRegistry.ts:44,297` xác nhận `resolveChatModelDisplay("gemini-2.5-flash").name === "Gemini 3.5 Flash-Lite"`; cơ chế khóa đối xứng key song ngữ tại `src/lib/utils/translations/index.ts:24-34` hoạt động compile-time; các file UI đều dưới ngưỡng 500 dòng theo `.agents/rules/00-core.md`. |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Đồng thời (`toastStore` hover vs `visibilitychange` + background `addToast`)**:
     - Cơ chế: `toastStore` timer pause/resume (`src/lib/store/toastStore.ts:20-38`).
     - T1: Người dùng chuyển sang tab khác (`visibilitychange` đặt `visibilityPaused = true`) | T2: Một request nền thất bại gọi `toast.error("Lỗi")` (`addToast(..., 5000)`) | T3: Nếu `addToast` vẫn lập lịch `setTimeout` khi `visibilityPaused === true`, toast tự bị xóa sau 5000ms trong lúc tab đang ẩn.
     - Kết cục: Người dùng quay lại tab không thấy thông báo lỗi ➔ **Lỗi (`[MAJOR]`)**.
     - Cơ chế phụ: `duration <= 0` persistent toast — T1: `addToast("Syncing", "info", 0)` | T2: Hover (`pauseToast`) rồi rời chuột (`resumeToast`) | T3: `resumeToast` không kiểm tra `duration > 0` nên đặt timer 0ms xóa mất toast persistent ➔ **Lỗi (`[MAJOR]`)**.
  2. **Khoảng trống check→use (TOCTOU)**: `N/A` — Không có tác vụ kiểm tra quyền/SSRF/quota phía server trong phạm vi kế hoạch.
  3. **Thất bại giữa chừng & thất bại của bước dọn dẹp**:
     - Cơ chế: `CommandPalette` (`⌘K`) Radix `DialogPresence` (`src/components/ui/dialog.tsx:24,37`).
     - T1: Người dùng mở `⌘K` (`instant={true}`) rồi nhấn `Esc` ngay | T2: `DialogContent` tắt animation nhưng `DialogOverlay` vẫn còn `data-[state=closed]:animate-out` | T3: Radix `<Presence>` trì hoãn unmount backdrop 150–200ms chờ `animationend`.
     - Kết cục: `⌘K` vẫn tạo cảm giác trễ đóng và che click phía dưới trong lúc đóng ➔ **Lỗi (`[MAJOR]`)**.
     - Cơ chế phụ: `useAppFrameState.handleCreateProjectChat` — T1: Người dùng bấm `+` tạo chat Project trên mobile | T2: `createConversation` trả về `null` do đang tạo dở hoặc lỗi mạng (`src/app/features/chat/hooks/useConversation.ts:395,434`) | T3: Nếu không kiểm tra `if (!conv) return;`, truy cập `conv.id` gây lỗi runtime/compile ➔ **Lỗi (`[MAJOR]`)**.
  4. **Môi trường serverless**: `N/A` — Toàn bộ thay đổi nằm ở client-side UI/CSS/Zustand store trong trình duyệt.

- **Commands Executed**:
  - `node scripts/verify-plan.mjs docs/plans/2026-11-21-ux-ui-audit-phase-1-2-implementation-plan.md` (exit `0`)
  - `npm run type-check` (exit `0`)
  - `npm run lint` (exit `0`)
  - `npx vitest list --filesOnly` (exit `0`, liệt kê 256 test files)
  - `npx eslint --print-config src/components/ui/ToastContainer.tsx` (exit `0`, xác nhận 4 rule `vikini-design/*` ở mức `2`)
  - `npx vitest run --reporter=dot src/lib/config/theme-config.test.ts src/components/ui/DynamicIcon.test.tsx src/components/ui/popover.test.tsx src/app/features/layout/HeaderBar.test.tsx src/app/features/layout/hooks/useAppFrameState.test.ts src/app/features/layout/components/AppFrame.test.tsx src/app/features/layout/components/GlobalCommandPalette.test.tsx src/app/features/sidebar/components/Sidebar.test.tsx src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/CommandPalette.test.tsx src/app/features/image-gen/components/DescribeImageView.test.tsx src/app/features/image-gen/components/ControlPanel.test.tsx src/components/features/projects/KnowledgePanel.test.tsx src/app/projects/[id]/page.test.tsx src/app/auth/signin/page.test.tsx` (exit `0`, 15 files / 142 tests pass)
  - `git status` (exit `0`)

#### 4. Kết Luận

Cần `@planner` cập nhật kế hoạch để khắc phục 5 lỗi `[MAJOR]` (và 1 góp ý `[MINOR]`) nêu trong bảng Critic Findings trước khi mở khóa triển khai:

1. Bổ sung `src/app/features/layout/HeaderBar.test.tsx` vào Mục 5 (`[MODIFY]`), Mục 3.6, Test Contract TC-P2-02 (Loại C: `"V"` → `"v"`), Mục 9.1 và Rủi ro R4.
2. Truyền `instant` xuống `DialogOverlay` trong `src/components/ui/dialog.tsx` (kèm assertion trong `CommandPalette.test.tsx`) và chốt đặc tả CSS tường minh cho `animations.css` (`transform` không đè `translate`, `var(--tw-duration, 180ms)`, `animation-fill-mode: both`, bare `fade-in`, `slide-in-from-*-1`/`-2`, và bare 100% slide của `SheetContent`).
3. Bỏ `toast` & `refreshConversations()` trùng lặp trong `useAppFrameState.ts` (ủy quyền cho `useConversation.ts`), bổ sung null-guard `if (!conv) return;` và `closeMobile()` trong `handleCreateProjectChat`.
4. Khắc phục ngân sách chiều rộng Mobile 375px: `DashboardView.tsx:152` dùng `px-0 md:px-6`, `ChatControls.tsx:117` đồng bộ `0.75rem` cho safe-area padding, thu gọn `+`/`Send` mobile `h-9 w-9 sm:h-10 sm:w-10`, thêm `min-w-0 max-w-full` cho `ModelSelector` và đảm bảo không tràn ngang khi `fileCount > 0`.
5. Chốt 2 bất biến timer `toastStore.ts` (không đặt `setTimeout` khi `addToast` chạy lúc `visibilityPaused === true`; bỏ qua `pauseToast`/`resumeToast` cho toast `duration <= 0`) và guard `relatedTarget` cho `onBlur` trong `ToastContainer.tsx`.
6. (Minor) Ghi rõ kiểu mở rộng cho `chunk_count?: number` trong `KnowledgePanel.tsx`, dùng `font-size: max(0.75rem, 0.85em);` trong `utilities.css`, thêm `t` vào deps `handleFileSelect` + `try/catch` cho `clearHistory` + guard `item.thumbnail` rỗng ở `DescribeImageView.tsx`, và thay cả `hover:scrollbar-thumb-white/20` ở `SmartCode.tsx:147`.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-21-ux-ui-audit-phase-1-2-implementation-plan.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - `[PASS] LINE_REF` (toàn bộ 61 tham chiếu `file:line` hợp lệ)
  - `[INFO] CRITIC_REQUIRED no`
  - `[PASS] CRITIC_FLOOR 7 findings with valid file:line`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

| # Lỗi Audit Run 1                                                  | Mức     | Trạng thái | Đối chiếu `[SRC]` / Kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 `HeaderBar.test.tsx` vỡ khi đổi `"V"` → `"v"`                   | [MAJOR] | `ĐÃ SỬA`   | Đã bổ sung `src/app/features/layout/HeaderBar.test.tsx` (`:200-203`) vào Mục 3.6, Mục 5 `[MODIFY]`, Bước 5, Test Contract TC-P2-02 (Loại C), Mục 9.1, Mục 9.2 và Rủi ro R4.                                                                                                                                                                                                                                                                                                                    |
| #2 `DialogOverlay instant` & đặc tả `animations.css`               | [MAJOR] | `ĐÃ SỬA`   | Đã nối `instant` cho cả `DialogOverlay` lẫn `DialogContent` (`src/components/ui/dialog.tsx:21-45`) kèm Negative Probe #5; khóa hợp đồng `animations.css` chỉ animate `transform: translate3d(...) scale3d(...)` (không ghi `translate`), đọc `var(--tw-duration, 180ms)`, `animation-fill-mode: both`, bare `fade-in`, `slide-in-from-bottom-1`, và full-size slides cho `src/components/ui/sheet.tsx:32-38`.                                                                                  |
| #3 `useAppFrameState` trùng toast & thiếu null-guard/`closeMobile` | [MAJOR] | `ĐÃ SỬA`   | Đã ủy quyền `toast` & `mutate()` cho `src/app/features/chat/hooks/useConversation.ts:431-520`, bổ sung `if (!conv) return;` + `closeMobile()` trong `handleCreateProjectChat` và khóa bằng Negative Probe #6.                                                                                                                                                                                                                                                                                  |
| #4 Ngân sách chiều rộng Mobile 375px Composer                      | [MAJOR] | `ĐÃ SỬA`   | Đã bỏ `px-4` mobile trùng tại `src/app/features/chat/components/DashboardView.tsx:152` (`px-0 md:px-6`), đồng bộ `0.75rem` tại `src/app/features/chat/components/ChatControls.tsx:117`, đồng bộ `+`/`Send` mobile `h-9 w-9 sm:h-10 sm:w-10`, thêm `min-w-0 max-w-full overflow-hidden` cho `src/app/features/chat/components/ModelSelector.tsx:74`, và giới hạn `max-w-[52%]` cho `ComposerLeadingControls` khi `fileCount > 0`.                                                               |
| #5 `toastStore` hidden-tab `addToast` / `duration <= 0` / `onBlur` | [MAJOR] | `ĐÃ SỬA`   | Đã khóa 3 bất biến timer tại Mục 6.1, TC-P1-01, Negative Probe #3 và Rủi ro R6 cho `src/lib/store/toastStore.ts:20-38` cùng guard `!e.currentTarget.contains(e.relatedTarget as Node \| null)` tại `src/components/ui/ToastContainer.tsx:45-65`.                                                                                                                                                                                                                                               |
| #6 Bốn chi tiết kỹ thuật nhỏ                                       | [MINOR] | `ĐÃ SỬA`   | Đã khóa type `KnowledgeDocument & { chunk_count?: number }` cho `src/components/features/projects/KnowledgePanel.tsx:276`, CSS thuần `font-size: max(0.75rem, 0.85em);` cho `src/app/styles/themes/_shared/utilities.css:90`, thêm `[t]` deps + `try/catch` cả `clearHistory` + guard `item.thumbnail` rỗng cho `src/app/features/image-gen/components/DescribeImageView.tsx:70-93,372`, và thay cả `hover:scrollbar-thumb-white/20` tại `src/app/features/chat/components/SmartCode.tsx:147`. |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                           | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------- | ------- | --------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/DescribeImageView.tsx:253-265` | [SRC]        | Khi mở rộng nhánh hiển thị sang `Boolean(imagePreview \|\| result)` để hỗ trợ mục lịch sử có `item.thumbnail` rỗng, cần bọc khối preview `<Image src={imagePreview} />` trong `{imagePreview && (...)}` (để `tsc` strict chấp nhận `imagePreview: string \| null`) và đổi điều kiện ẩn danh sách lịch sử tại `DescribeImageView.tsx:352` từ `!imagePreview` sang `!(imagePreview \|\| result)`. Không chặn phê duyệt vì `npm run type-check` sẽ cưỡng chế ngay khi viết code.                                                                 |
| 2   | RISK_DISMISSED | N/A     | `src/app/features/layout/HeaderBar.test.tsx:200-203`                  | [SRC], [CMD] | Rủi ro vỡ unit test ngoài phạm vi đã được loại bỏ: `HeaderBar.test.tsx` đã có tên trong Mục 5 (`[MODIFY]`), Mục 3.6, Test Contract TC-P2-02 (Loại C tường minh) và lệnh kiểm thử Mục 9.2; các test liên quan khác (`InputForm.test.tsx`, `ComposerLeadingControls.test.tsx`, `ControlPanel.test.tsx`, `SmartCode.test.tsx`, `BubbleHelpers.test.tsx`, `popover.test.tsx`, `page.test.tsx`) đã đối chiếu `[SRC]` và chạy baseline 142/142 pass không xung đột.                                                                                 |
| 3   | RISK_DISMISSED | N/A     | `src/components/ui/dialog.tsx:21-45`                                  | [SRC], [URL] | Rủi ro trễ đóng `⌘K` qua Radix `<Presence>` và đè thuộc tính CSS `translate` của Tailwind v4 đã được khóa kỹ thuật: `instant` truyền xuống cả `DialogOverlay` lẫn `DialogContent` (Negative Probe #5), `animations.css` chỉ animate `transform: translate3d(...) scale3d(...)`, đọc `var(--tw-duration, 180ms)` và định nghĩa đủ toàn bộ class `fade-in`/`slide-in-from-bottom-1`/full-size `Sheet` slides (`src/components/ui/sheet.tsx:32-38`).                                                                                             |
| 4   | RISK_DISMISSED | N/A     | `src/app/features/chat/components/ChatControls.tsx:113-117`           | [SRC], [ADV] | Tính toán lại ngân sách 375px sau khi bỏ `px-4` mobile thừa ở `DashboardView.tsx:152` và đồng bộ `0.75rem` tại `ChatControls.tsx:117`: ruột Row 2 đạt `325px` (Landing) / `333px` (Thread), các nút cố định (`+` 36 + `Tùy chọn` 96 + `Mic` 36 + `Send` 36 + gaps 16 = `220px`) chừa `105–113px` cho `ModelSelector` (`min-w-0 max-w-full`), và `max-w-[52%]` trên `ComposerLeadingControls` giữ an toàn không tràn ngang khi `fileCount > 0`. Đồng thời `toastStore.ts` đã đóng đủ 2 lỗ hổng timer ẩn tab và sticky toast (`duration <= 0`). |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                     | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7 mục + Skills + Risk Controls) | PASS    | [CMD], [SRC] | `verify-plan.mjs` pass 7/7 mục, 61/61 `file:line` hợp lệ, 0 warnings; 4 skills/rules bắt buộc (`emil-design-eng`, `add-translation`, `03-ui.md`, `04-bilingual.md`) ánh xạ đầy đủ; 7 rủi ro R1–R7 gắn technical control + 6 Negative Probes + Playwright Visual QA.                                                                                                                    |
| S1: Cold-start & Build                                  | PASS    | [CMD], [SRC] | Baseline `npm run type-check` (exit 0), `npm run lint` (exit 0), `npx vitest run` 15 file mục tiêu (142/142 pass), `npx eslint --print-config src/components/ui/ToastContainer.tsx` (4 rule `vikini-design/*` ở mức `2`). Không thêm package hay biến `.env` mới.                                                                                                                      |
| S2: Runner Lifecycle & Teardown                         | PASS    | [SRC], [ADV] | `toastStore.ts` dọn `clearTimeout` trong `removeToast`/`clearAllToasts`, tách `hoverPaused` vs `visibilityPaused`, không tạo timer khi tab ẩn hoặc `duration <= 0`; `ToastContainer.tsx` gỡ listener `visibilitychange` khi unmount và guard `relatedTarget` ở `onBlur`; `DialogOverlay` + `DialogContent` tắt đồng bộ animation khi `instant={true}`.                                 |
| S3: Database & Temporal Logic                           | N/A     | [SRC]        | Kế hoạch thuần UI/CSS/client store, không chạm `supabase/`, `database-migrations/`, `*.sql` hay `*.server.ts`.                                                                                                                                                                                                                                                                         |
| S4: Cross-Task State Flow                               | PASS    | [SRC]        | `useAppFrameState.ts` ủy quyền `mutate()`/`toast` cho `src/app/features/chat/hooks/useConversation.ts:431-520`, có null-guard `if (!conv) return;` và `closeMobile()`; `GlobalCommandPalette` bật lại `⌘K` trên `/projects/[id]` mà giữ tắt trên `/` và `/features/chat`; 2 thay đổi đặc tả Loại C (`Sidebar.test.tsx:203`, `HeaderBar.test.tsx:200-203`) đã được khai báo tường minh. |
| S5: Security Boundary & 3-Tier Auth                     | N/A     | [SRC]        | Không sửa API route (`src/app/api/**`), auth, Redis rate limit hay `*.server.ts`.                                                                                                                                                                                                                                                                                                      |
| S6: External Resilience & Serverless Cap                | N/A     | [SRC]        | Không sửa AI provider client, SSE stream hay `maxDuration`.                                                                                                                                                                                                                                                                                                                            |
| Domain: Open Inquiry (Vikini)                           | PASS    | [SRC]        | `resolveChatModelDisplay("gemini-2.5-flash")` khớp `src/lib/core/modelPicker.ts:132-157` + `src/lib/core/modelRegistry.ts:44,297` (`"Gemini 3.5 Flash-Lite"`); 28 key dịch thuật thêm đồng thời vào `vi.ts`/`en.ts` được khóa bởi `src/lib/utils/translations/index.ts:24-34`; mọi cặp màu 10 themes vượt chuẩn WCAG AA $\ge 4.5:1$; các file UI đều dưới Hard Max 500 dòng.           |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục — kiểm chứng sau Revision 2)**:
  1. **Đồng thời (`toastStore` hidden-tab `addToast` & sticky toast)**:
     - Cơ chế: `toastStore` timer pause/resume (`src/lib/store/toastStore.ts:20-38`).
     - T1: `document.hidden === true` (`visibilityPaused = true`) | T2: Request nền lỗi gọi `addToast("Lỗi", "error", 5000)` | T3: `addToast` lưu `timerId: null, remainingMs: 5000` không gọi `setTimeout`; khi người dùng quay lại tab (`setVisibilityPaused(false)`), `syncTimer` mới bắt đầu đếm 5000ms.
     - Kết cục: Người dùng luôn thấy đủ 5000ms thông báo lỗi; toast `duration <= 0` không nằm trong `timers` Map nên hover/unhover an toàn ➔ **An toàn**.
  2. **Khoảng trống check→use (TOCTOU)**: `N/A` — Không có tác vụ kiểm tra quyền/SSRF/quota phía server trong phạm vi kế hoạch.
  3. **Thất bại giữa chừng & thất bại của bước dọn dẹp**:
     - Cơ chế: `CommandPalette` (`⌘K`) Radix `DialogPresence` (`src/components/ui/dialog.tsx:21-45`) & `useAppFrameState.handleCreateProjectChat`.
     - T1: Người dùng bấm `Esc` đóng `⌘K` (`instant={true}`) | T2: Cả `DialogContent` và `DialogOverlay` mang `animate-none duration-0` (không có `animate-out`) | T3: Radix `<Presence>` unmount tức thì 0ms.
     - T1': `handleCreateProjectChat` gọi `createConversation` khi mạng lỗi trả `null` (`src/app/features/chat/hooks/useConversation.ts:431-434`) | T2': Nhánh `if (!conv) return;` dừng sớm | T3': Không điều hướng sai, không đóng drawer nhầm, toast lỗi đã do `useConversation` phát duy nhất 1 lần.
     - Kết cục: Đóng tức thì không kẹt overlay và thất bại mạng được cô lập sạch ➔ **An toàn**.
  4. **Môi trường serverless**: `N/A` — Toàn bộ thay đổi nằm ở client-side UI/CSS/Zustand store.

- **Commands Executed**:
  - `node scripts/verify-plan.mjs docs/plans/2026-11-21-ux-ui-audit-phase-1-2-implementation-plan.md` (exit `0`, `CRITIC_REQUIRED no`, 0 failures, 0 warnings)
  - Kế thừa baseline cùng phiên chưa đổi mã nguồn: `npm run type-check` (exit `0`), `npm run lint` (exit `0`), `npx vitest run` 15 file mục tiêu (142/142 pass), `npx eslint --print-config src/components/ui/ToastContainer.tsx` (exit `0`).

#### 4. Kết Luận

Toàn bộ 5 lỗi `[MAJOR]` và 1 lỗi `[MINOR]` từ Audit Run 1 đã được xử lý triệt để trong Revision 2; không còn lỗi `[BLOCKER]` hay `[MAJOR]`, chỉ còn 1 lưu ý `[MINOR]` triển khai tại `DescribeImageView.tsx:253-265,352`; `CRITIC_REQUIRED no`. Kế hoạch đủ điều kiện mở khóa triển khai.

[PLAN_APPROVED]
