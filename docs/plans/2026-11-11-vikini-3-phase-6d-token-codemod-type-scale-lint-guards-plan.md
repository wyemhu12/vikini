# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 6D (Cuối): Codemod Màu Thô & Token Cũ, Thang Chữ 12–32 và Lint Guards

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Gemini 4 Carbon (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: gemini-4-carbon]`)
- **Depends on**: Giai đoạn 5E (commit `9b24d3a`, đã lên `main`) và Giai đoạn 6C (commit `7ad82ad`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Hoàn tất những hạng mục cuối cùng còn lại của lộ trình thiết kế lại **Vikini 3.0** theo `docs/specs/2026-11-08-vikini-3-redesign-brief.md` (§Design tokens, §Typography, §Suggested phasing bước 6) và phần Out of Scope đã ghi nhận tại Giai đoạn 6C:

1. **Codemod triệt để màu Tailwind thô, mã hex tùy tiện và cỡ chữ `< 12px` trên `src/**/\*.{ts,tsx}`\*\*:
   - Chuyển toàn bộ **655** lượt class bảng màu Tailwind thô (`text-white`, `bg-black/*`, `border-white/*`, `text-gray-*`, `bg-purple-*`, `from-purple-600 to-blue-600`, `text-red-*`, `text-emerald-*`, `text-amber-*`, `shadow-black/*`…) và **1** class hex tùy tiện (`bg-[#0a0a0a]`) trên **42** file nguồn sang hệ token ngữ nghĩa Vikini 3.0 (`--bg`, `--surface`, `--raised`, `--line`, `--text`, `--muted`, `--faint`, `--accent`, `--on-accent`, `--soft`, `--danger`, `--danger-foreground`, `--success`, `--warning`, `--overlay`, `--on-overlay`).
   - Bảo đảm ngữ nghĩa tương phản cho cả 5 theme × 2 chế độ sáng/tối: nút CTA dùng `bg-(--accent) text-(--on-accent)`, nút nguy hiểm dùng `bg-(--danger) text-(--danger-foreground)`, lớp phủ trực tiếp trên ảnh/huy hiệu màu dùng `--overlay` + `--on-overlay`, còn chữ trên thẻ/panel/modal dùng `--text` / `--muted` / `--faint`.
   - Nâng toàn bộ **37** lượt cỡ chữ nhỏ dưới ngưỡng (`text-[8px]`..`text-[11px]`) trên **15** file nguồn lên `text-xs` (`12px`).
2. **Codemod 1.369 lượt biến token cũ Vikini 2.x và gỡ bỏ khối alias trong CSS nền**:
   - Thay toàn bộ `--surface-strong` → `--bg`, `--surface-muted` → `--raised`, `--surface-elevated` → `--surface`, `--control-bg` / `--control-bg-hover` → `--raised`, `--control-border` / `--border` → `--line`, `--text-primary` → `--text`, `--text-secondary` → `--muted`, `--accent-foreground` → `--on-accent`, `--primary` / `--primary-light` / `--primary-dark` → `--accent`, `--bg-glow` → `--glow` trên `src/**/*.{ts,tsx,css}`.
   - Xóa hai khối alias tạm thời trong `src/app/styles/themes/_shared/base.css:81-92` và `src/app/styles/themes/_shared/base.css:105-110`; cập nhật `--color-secondary`, `--color-input`, `::-webkit-scrollbar-thumb`, `tokens.css`, `utilities.css` và `shimmer.css`.
3. **Định nghĩa thang chữ (Typography Scale Tokens `12 / 13 / 14 / 16 / 20 / 24 / 32`)**:
   - Khai báo `--type-12` (`0.75rem`), `--type-13` (`0.8125rem`), `--type-14` (`0.875rem`), `--type-16` (`1rem`), `--type-20` (`1.25rem`), `--type-24` (`1.5rem`), `--type-32` (`2rem`) trong `:root` của `src/app/styles/themes/_shared/base.css` và nối vào `@theme` (`--text-xs`, `--text-13`, `--text-sm`, `--text-base`, `--text-xl`, `--text-2xl`, `--text-3xl`).
4. **Bật chốt chặn ESLint (`eslint.config.mjs` + `scripts/vikini-design-lint.mjs`) và `eslint-plugin-react-hooks`**:
   - Bật plugin nội bộ `vikini-design` ở mức `"error"` cho `src/**/*.{ts,tsx}` (trừ `*.test.{ts,tsx}`, `*.spec.{ts,tsx}`) chặn: (a) class màu Tailwind thô / class màu hex-rgb tùy tiện, (b) tên biến token cũ Vikini 2.x đã gỡ, (c) class cỡ chữ `< 12px` (`text-[8–11px]`, `text-[0.65rem]`).
   - Bật `eslint-plugin-react-hooks` (`"react-hooks/rules-of-hooks": "error"`, `"react-hooks/exhaustive-deps": "warn"`; tắt `rules-of-hooks` trên `tests/e2e/**` để tránh dương tính giả với tham số fixture `use` của Playwright) và sửa lỗi gọi hook sau `return` sớm tại `src/app/features/chat/components/BubbleMarkdown.tsx:172-183`.

**Out of Scope (What We're NOT Doing)**:

- Không cấm mã hex hợp lệ không thuộc hệ giao diện: logo thương hiệu SVG Google/AI (`src/app/auth/signin/page.tsx`, `ModelAvatar.tsx`), mảng màu biểu đồ Recharts (`ChartTool.tsx`), trang cứu hộ khẩn cấp khi mất gốc CSS (`src/app/global-error.tsx`), và bảng màu biểu tượng dự án do người dùng chọn lưu DB (`CreateProjectModal.tsx`, `ProjectIcon.tsx`).
- Không ép sửa hàng loạt 17 cảnh báo `react-hooks/exhaustive-deps` hiện hữu trên các hook luồng/trạng thái ổn định (chỉ giữ `"warn"` chuẩn React để tránh gây vòng lặp render hoặc đổi hành vi ngoài phạm vi).
- Không chạm vào `.agents/**` (danh mục nhạy cảm quản trị).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                | Nội dung rút ra                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md`                 | 11 token ngữ nghĩa, cấm màu Tailwind thô & hex trên component, thang chữ `12/13/14/16/20/24/32`  |
| `docs/plans/2026-11-11-vikini-3-phase-6c-gallery-keyboard-plan.md` | Hạng mục Giai đoạn 6 còn lại: codemod màu thô + alias token cũ, type scale, `react-hooks`, lint  |
| `src/app/styles/themes/_shared/base.css`                           | Khối `@theme`, `:root` token 3.0, khối alias tạm dòng 81–92 & 105–110, scrollbar dòng 138        |
| `src/app/styles/themes/_shared/tokens.css` & `utilities.css`       | Các lớp tiện ích CSS còn tham chiếu biến cũ (`--surface-muted`, `--border`, `--text-primary`…)   |
| `eslint.config.mjs` & `scripts/verify-plan.mjs`                    | Cấu hình Flat Config ESLint 9 và quy ước module `.mjs` kèm unit test `.test.ts` trong `scripts/` |
| `docs/architecture.md:68-80`                                       | Đoạn tài liệu sống mô tả alias token cũ cần cập nhật đồng bộ sau khi gỡ                          |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                     | Lý do nạp                                        | Quyết định kỹ thuật chịu ảnh hưởng                                                                  |
| -------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-audit/SKILL.md` | Kiểm toán toàn diện UI token, cỡ chữ, hook, test | Phân tách ngữ cảnh `text-white` (nút nguy hiểm vs phủ ảnh vs văn bản thường) để giữ tương phản sáng |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                               | Bằng chứng                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A1  | `base.css` còn tham chiếu `--control-bg` và `--control-border` tại `@theme` và `::-webkit-scrollbar-thumb` ngoài hai khối alias                                | `[SRC]` `src/app/styles/themes/_shared/base.css:19-28`, `src/app/styles/themes/_shared/base.css:138`                     |
| A2  | `shimmer.css` dùng `var(--surface-muted)` và `var(--control-bg-hover)` tạo dải sáng chuyển động; nếu gộp cả hai thành `var(--raised)` hiệu ứng shimmer sẽ mất  | `[SRC]` `src/app/features/styles/shimmer.css:2-11`                                                                       |
| A3  | `eslint-plugin-react-hooks` (`^7.0.1`) đã cài sẵn trong `package.json`; quét toàn repo phát hiện đúng 1 lỗi thật trong `src/` và 1 dương tính giả ở Playwright | `[SRC]` `package.json:105`, `src/app/features/chat/components/BubbleMarkdown.tsx:172-183`, `tests/e2e/fixtures.ts:14-38` |
| A4  | Có đúng 8 file unit test hiện khẳng định tên biến alias cũ (hoặc `text-white` trên nút `bg-(--danger)`) cần cập nhật theo Loại C                               | `[SRC]` `src/lib/config/theme-config.test.ts:232-251`, `src/app/features/chat/components/InputForm.test.tsx:103-130`     |

**Quyết định sản phẩm (theo brief & canvas)**:

- **D1 — Tiền cảnh trên lớp phủ tối (`--on-overlay`)**: `base.css` đã có `--overlay: rgba(0, 0, 0, 0.7)` (bất biến theo theme cho màn mờ modal và dải đen đáy ảnh); bổ sung `--on-overlay: #ffffff` ngay cạnh `--overlay` để chú thích nằm trực tiếp trên ảnh và biểu tượng trên huy hiệu màu đậm giữ tương phản cao ở cả chế độ Sáng lẫn Tối mà không dùng `text-white`.
- **D2 — Bảng màu `KIND_COLORS` cho loại tệp (`fileDisplayUtils.ts`)**: chuyển `pink/purple/amber/red/blue/green` thô sang các token ngữ nghĩa sẵn có (`text-(--accent)`, `text-(--warning)`, `text-(--danger)`, `text-(--success)`, `text-(--muted)`).

### 4. Bảng Verified Versions

| Thư viện / Công cụ          | `package.json` | Phiên bản | Ghi chú                                                                           | Nguồn                      |
| --------------------------- | -------------- | --------- | --------------------------------------------------------------------------------- | -------------------------- |
| `eslint`                    | `^9.39.2`      | 9.39      | Flat config hỗ trợ custom plugin nội bộ trực tiếp trong `eslint.config.mjs`       | `[SRC]` `package.json:102` |
| `eslint-plugin-react-hooks` | `^7.0.1`       | 7.0       | Bật tường minh `rules-of-hooks: "error"` & `exhaustive-deps: "warn"`              | `[SRC]` `package.json:105` |
| `tailwindcss`               | `^4.1.18`      | 4.1       | `@theme` ánh xạ `--text-*` sang thang chữ `12 / 13 / 14 / 16 / 20 / 24 / 32`      | `[SRC]` `package.json:114` |
| `vitest`                    | `^4.1.12`      | 4.1       | Kiểm thử co-located cho plugin lint thiết kế, thang chữ CSS và `fileDisplayUtils` | `[SRC]` `package.json:118` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**Hạ tầng Token, Thang chữ & ESLint Guards**

- `[NEW]` `scripts/vikini-design-lint.mjs` — plugin ESLint `vikini-design` (`no-raw-tailwind-colors`, `no-legacy-tokens`, `no-sub-12px-text`) + hàm kiểm tra thuần cho test.
- `[NEW]` `scripts/vikini-design-lint.test.ts` — unit test cho 3 rule ESLint (ca dương tính + âm tính).
- `[MODIFY]` `eslint.config.mjs` — đăng ký `eslint-plugin-react-hooks` và `vikini-design`.
- `[MODIFY]` `src/app/styles/themes/_shared/base.css` — thêm thang chữ `--type-12..32` + `@theme` `--text-*`, thêm `--on-overlay`, gỡ toàn bộ biến alias cũ.
- `[MODIFY]` `src/app/styles/themes/_shared/tokens.css` — trỏ các lớp tiện ích trực tiếp về token Vikini 3.0.
- `[MODIFY]` `src/app/styles/themes/_shared/utilities.css` — thay toàn bộ biến cũ trong `.chat-markdown` và `.custom-scrollbar`.
- `[MODIFY]` `src/app/features/styles/shimmer.css` — dùng `var(--raised)` + `color-mix(in oklab, var(--raised) 88%, var(--text) 12%)`.

**Tiện ích & Unit Test mới**

- `[MODIFY]` `src/lib/utils/fileDisplayUtils.ts` — chuyển `KIND_COLORS` sang token ngữ nghĩa Vikini 3.0.
- `[NEW]` `src/lib/utils/fileDisplayUtils.test.ts` — unit test cho `formatFileSize`, `truncateFilename`, `KIND_COLORS`.

**8 File Test cập nhật theo Loại C (đổi kỳ vọng tên biến cũ sang tên biến Vikini 3.0)**

- `[MODIFY]` `src/lib/config/theme-config.test.ts`
- `[MODIFY]` `src/app/features/chat/components/BubbleAvatar.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/BubbleHelpers.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/InputForm.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/SmartCode.test.tsx`
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.test.tsx`
- `[MODIFY]` `src/components/ui/error-boundary.test.tsx`

**122 File UI `.tsx` được Codemod Token, Màu Thô, Chữ `< 12px` & Sửa Hook (`BubbleMarkdown.tsx`)**

- `[MODIFY]` `src/app/_components/go-back-button.tsx`
- `[MODIFY]` `src/app/admin/components/AdminDashboard.tsx`
- `[MODIFY]` `src/app/admin/components/AuditLogViewer.tsx`
- `[MODIFY]` `src/app/admin/components/GemsManager.tsx`
- `[MODIFY]` `src/app/admin/components/PersonasManager.tsx`
- `[MODIFY]` `src/app/admin/components/RankConfigManager.tsx`
- `[MODIFY]` `src/app/admin/components/StatisticsOverview.tsx`
- `[MODIFY]` `src/app/admin/components/UserManager.tsx`
- `[MODIFY]` `src/app/components/AccessPendingScreen.tsx`
- `[MODIFY]` `src/app/components/EditImagePromptModal.tsx`
- `[MODIFY]` `src/app/components/UpgradeModal.tsx`
- `[MODIFY]` `src/app/error.tsx`
- `[MODIFY]` `src/app/features/chat/components/BubbleAvatar.tsx`
- `[MODIFY]` `src/app/features/chat/components/BubbleHelpers.tsx`
- `[MODIFY]` `src/app/features/chat/components/BubbleMarkdown.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChartTool.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatApp.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatConversationView.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatLoadingScreen.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatMessagesArea.tsx`
- `[MODIFY]` `src/app/features/chat/components/CommandPalette.tsx`
- `[MODIFY]` `src/app/features/chat/components/DashboardView.tsx`
- `[MODIFY]` `src/app/features/chat/components/EmptyReasoningNotice.tsx`
- `[MODIFY]` `src/app/features/chat/components/FileInMessage.tsx`
- `[MODIFY]` `src/app/features/chat/components/FileLightbox.tsx`
- `[MODIFY]` `src/app/features/chat/components/FileManagerPanel.tsx`
- `[MODIFY]` `src/app/features/chat/components/FilePreviewArea.tsx`
- `[MODIFY]` `src/app/features/chat/components/FilePreviewCard.tsx`
- `[MODIFY]` `src/app/features/chat/components/ImageGenPreview.tsx`
- `[MODIFY]` `src/app/features/chat/components/ImageLightbox.tsx`
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx`
- `[MODIFY]` `src/app/features/chat/components/KeyboardShortcutsModal.tsx`
- `[MODIFY]` `src/app/features/chat/components/LocalSamplingSettings.tsx`
- `[MODIFY]` `src/app/features/chat/components/ModelSelector.tsx`
- `[MODIFY]` `src/app/features/chat/components/ScrollToBottomButton.tsx`
- `[MODIFY]` `src/app/features/chat/components/SmartCode.tsx`
- `[MODIFY]` `src/app/features/chat/components/SourceLinks.tsx`
- `[MODIFY]` `src/app/features/chat/components/StreamErrorBanner.tsx`
- `[MODIFY]` `src/app/features/chat/components/TokenBadge.tsx`
- `[MODIFY]` `src/app/features/chat/components/VoiceButton.tsx`
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.tsx`
- `[MODIFY]` `src/app/features/gallery/components/ImageCompareModal.tsx`
- `[MODIFY]` `src/app/features/gems/components/GemEditor.tsx`
- `[MODIFY]` `src/app/features/gems/components/GemManager.tsx`
- `[MODIFY]` `src/app/features/gems/components/GemModal.tsx`
- `[MODIFY]` `src/app/features/gems/components/GemPreview.tsx`
- `[MODIFY]` `src/app/features/gems/components/GemQuickSwitch.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/Canvas.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanel.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanelReferenceImages.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/DescribeImageView.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/EditPanel.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/ImageGenStudio.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/ImageLightbox.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/PromptBuilder.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/SettingsModal.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/StyleSelector.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/TagInput.tsx`
- `[MODIFY]` `src/app/features/image-gen/components/TemplateModal.tsx`
- `[MODIFY]` `src/app/features/layout/components/HeaderBar.tsx`
- `[MODIFY]` `src/app/features/layout/components/ThemeMenuItems.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterAiBrainstormMenu.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterAiToolbar.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterAiToolMenus.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterFeedbackGutter.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterManuscriptEditor.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterSelectionToolbar.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ChapterSnapshotsModal.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/CodexEntityPreview.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/DestructiveSaveConfirmModal.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/ManuscriptTypographyMenu.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterCardMetaBadges.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterHistoryCardItem.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/PromptSourceTooltip.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/SheetSubToolbar.tsx`
- `[MODIFY]` `src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx`
- `[MODIFY]` `src/app/features/personas/components/PersonaEditor.tsx`
- `[MODIFY]` `src/app/features/personas/components/PersonaManager.tsx`
- `[MODIFY]` `src/app/features/personas/components/PersonaModal.tsx`
- `[MODIFY]` `src/app/features/personas/components/PersonaPreview.tsx`
- `[MODIFY]` `src/app/features/personas/components/PersonaQuickSwitch.tsx`
- `[MODIFY]` `src/app/features/projects/components/ProjectChatView.tsx`
- `[MODIFY]` `src/app/features/sidebar/components/ContextPanelContent.tsx`
- `[MODIFY]` `src/app/features/sidebar/components/MobileNavDrawer.tsx`
- `[MODIFY]` `src/app/features/sidebar/components/ProjectNode.tsx`
- `[MODIFY]` `src/app/features/sidebar/components/RailMenus.tsx`
- `[MODIFY]` `src/app/features/sidebar/components/SidebarItem.tsx`
- `[MODIFY]` `src/app/features/sidebar/components/SidebarSection.tsx`
- `[MODIFY]` `src/app/layout.tsx`
- `[MODIFY]` `src/app/not-found.tsx`
- `[MODIFY]` `src/app/page.tsx`
- `[MODIFY]` `src/app/projects/[id]/page.tsx`
- `[MODIFY]` `src/components/features/projects/CreateProjectModal.tsx`
- `[MODIFY]` `src/components/features/projects/KnowledgePanel.tsx`
- `[MODIFY]` `src/components/features/projects/ProjectIcon.tsx`
- `[MODIFY]` `src/components/features/projects/ProjectSettingsModal.tsx`
- `[MODIFY]` `src/components/features/projects/ProjectSwitcher.tsx`
- `[MODIFY]` `src/components/ui/alert-dialog.tsx`
- `[MODIFY]` `src/components/ui/avatar.tsx`
- `[MODIFY]` `src/components/ui/bento-grid.tsx`
- `[MODIFY]` `src/components/ui/button.tsx`
- `[MODIFY]` `src/components/ui/card.tsx`
- `[MODIFY]` `src/components/ui/dialog.tsx`
- `[MODIFY]` `src/components/ui/dropdown-menu.tsx`
- `[MODIFY]` `src/components/ui/error-boundary.tsx`
- `[MODIFY]` `src/components/ui/IconPicker.tsx`
- `[MODIFY]` `src/components/ui/input.tsx`
- `[MODIFY]` `src/components/ui/popover.tsx`
- `[MODIFY]` `src/components/ui/select.tsx`
- `[MODIFY]` `src/components/ui/sheet.tsx`
- `[MODIFY]` `src/components/ui/skeleton.tsx`
- `[MODIFY]` `src/components/ui/switch.tsx`
- `[MODIFY]` `src/components/ui/textarea.tsx`
- `[MODIFY]` `src/components/ui/ToastContainer.tsx`
- `[MODIFY]` `src/components/ui/tooltip.tsx`
- `[MODIFY]` `src/components/ui/VoiceWaveform.tsx`

**Tài liệu sống**

- `[MODIFY]` `docs/architecture.md` — cập nhật mục Design System (bỏ câu mô tả alias cũ, bổ sung thang chữ `12–32` và chốt chặn ESLint).
- `[MODIFY]` `docs/CHANGELOG.md` — ghi nhận phát hành Giai đoạn 6D.

### 6. Caller-First Design Sketch

```css
/* src/app/styles/themes/_shared/base.css */
@theme {
  /* Typography scale tokens (12 / 13 / 14 / 16 / 20 / 24 / 32 px; min 12px) */
  --text-xs: var(--type-12);
  --text-13: var(--type-13);
  --text-13--line-height: 1.4;
  --text-sm: var(--type-14);
  --text-base: var(--type-16);
  --text-xl: var(--type-20);
  --text-2xl: var(--type-24);
  --text-3xl: var(--type-32);
  --text-3xl--line-height: 1.2;
}

:root {
  --type-12: 0.75rem;
  --type-13: 0.8125rem;
  --type-14: 0.875rem;
  --type-16: 1rem;
  --type-20: 1.25rem;
  --type-24: 1.5rem;
  --type-32: 2rem;

  --overlay: rgba(0, 0, 0, 0.7);
  --on-overlay: #ffffff;
}
```

```js
// eslint.config.mjs (excerpt)
import reactHooks from "eslint-plugin-react-hooks";
import { vikiniDesignPlugin } from "./scripts/vikini-design-lint.mjs";

// In main rules block:
"react-hooks/rules-of-hooks": "error",
"react-hooks/exhaustive-deps": "warn",

// In src/**/*.{ts,tsx} non-test block:
"vikini-design/no-raw-tailwind-colors": "error",
"vikini-design/no-legacy-tokens": "error",
"vikini-design/no-sub-12px-text": "error",
```

### 7. Các Bước Thực Hiện Tuần Tự

- [x] **B1 — Viết Test trước (TDD Red)**:
  - Tạo `scripts/vikini-design-lint.test.ts` (TC-01..TC-03), `src/lib/utils/fileDisplayUtils.test.ts` (TC-04) và cập nhật `src/lib/config/theme-config.test.ts` (TC-05: khẳng định `base.css` có đủ `--type-12..32` và **không còn** 14 biến alias cũ) → chạy Vitest xác nhận **đỏ**.
- [x] **B2 — Cập nhật CSS nền & Thang chữ**:
  - Cập nhật `base.css`, `tokens.css`, `utilities.css`, `shimmer.css`.
- [x] **B3 — Chạy Codemod chính xác & Sửa Hook `BubbleMarkdown.tsx`**:
  - Chạy codemod bảo toàn kiểu xuống dòng gốc (`CRLF`/`LF`) trên 122 file `.tsx`, `fileDisplayUtils.ts`, và 7 file test `.test.tsx` Loại C.
  - Đưa `React.useMemo` lên trước nhánh `if (isBot === false)` trong `src/app/features/chat/components/BubbleMarkdown.tsx:172-183`.
- [x] **B4 — Tạo `scripts/vikini-design-lint.mjs` & Bật ESLint Guards trong `eslint.config.mjs`**.
- [x] **B5 — Verification toàn diện, Negative Probes `N1–N4` & Playwright QA**:
  - Chạy Prettier, `npx tsc --noEmit`, `npm run lint`, `npx vitest run`.
  - Thực hiện 4 Negative Probes `N1–N4` (khẳng định `npm run lint` và Vitest bắt đỏ ngay khi chèn màu thô, chữ `text-[10px]`, biến cũ `--text-primary`, hoặc gọi hook sau `return`, rồi hoàn tác).
  - Chạy `tests/e2e/a11y.spec.ts` (15/15) + QA Playwright đa trang (`/`, `/images`, `/gallery`, `/gems`, `/novelcrafter`, `/auth/signin`) ở `1440px` và `375px` cả chế độ Tối và Sáng.
- [x] **B6 — Cập nhật `docs/architecture.md`, Ghi chú triển khai, `docs/CHANGELOG.md`, commit, push nhánh và fast-forward `origin/main`**.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                                     | Input / Action                                                                                                                 | Kỳ vọng                                                                                                                               |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `scripts/vikini-design-lint.test.ts`     | Chuỗi class có `bg-blue-500`, `text-white`, `bg-[#0a0a0a]` vs chuỗi `bg-(--accent) text-(--on-accent)` và SVG `fill="#4285F4"` | Rule `no-raw-tailwind-colors` báo lỗi đúng 3 mẫu vi phạm và **không** báo lỗi trên token hợp lệ hoặc thuộc tính `fill` SVG (Negative) |
| TC-02 | `scripts/vikini-design-lint.test.ts`     | Chuỗi có `text-[10px]`, `md:text-[9px]`, `text-[0.65rem]` vs `text-xs`, `text-[13px]`, `text-[15px]`                           | Rule `no-sub-12px-text` báo lỗi cỡ chữ `< 12px` và cho qua `>= 12px` (Negative)                                                       |
| TC-03 | `scripts/vikini-design-lint.test.ts`     | Chuỗi có `bg-(--surface-muted)`, `border-(--border)`, `text-(--text-primary)` vs `--color-border`                              | Rule `no-legacy-tokens` báo lỗi biến cũ và **không** báo nhầm `--color-border` / `--color-primary` (Negative)                         |
| TC-04 | `src/lib/utils/fileDisplayUtils.test.ts` | Gọi `formatFileSize`, `truncateFilename` và đọc `KIND_COLORS`                                                                  | Định dạng đúng byte/KB/MB, cắt tên giữ đuôi mở rộng, mọi giá trị `KIND_COLORS` dùng `text-(--...)` không chứa màu thô                 |
| TC-05 | `src/lib/config/theme-config.test.ts`    | Đọc `src/app/styles/themes/_shared/base.css`                                                                                   | Có đủ 7 biến thang chữ `--type-12`..`--type-32` và **không còn** bất kỳ khai báo biến alias cũ nào (Negative)                         |

**Ca test cũ bị thay theo Loại C (liệt kê đích danh 8 file)**:

1. `src/lib/config/theme-config.test.ts:232-251` (`TC-10`): Phase 1 khẳng định 11 biến alias cũ tạm tồn tại trong `base.css` → nay Giai đoạn 6 gỡ alias theo đúng lộ trình, đổi sang khẳng định 14 biến alias cũ **đã được gỡ sạch** và 7 biến thang chữ `--type-12..32` có mặt.
2. `src/app/features/chat/components/BubbleAvatar.test.tsx:50-67` & `src/app/features/chat/components/BubbleAvatar.test.tsx:165-195`: đổi kỳ vọng tên class từ `text-(--accent-foreground)`, `bg-(--surface-elevated)`, `border-(--border)`, `text-(--text-primary)`, `text-(--text-secondary)` sang `text-(--on-accent)`, `bg-(--surface)`, `border-(--line)`, `text-(--text)`, `text-(--muted)`.
3. `src/app/features/chat/components/BubbleHelpers.test.tsx:32-42` & `src/app/features/chat/components/BubbleHelpers.test.tsx:66-100`: đổi `bg-(--primary)`, `text-(--text-secondary)`, `hover:text-(--text-primary)`, `bg-(--control-bg)`, `border-(--border)` sang `bg-(--accent)`, `text-(--muted)`, `hover:text-(--text)`, `bg-(--raised)`, `border-(--line)`.
4. `src/app/features/chat/components/ChatBubble.test.tsx:246-253`: đổi `text-(--text-primary)` sang `text-(--text)`.
5. `src/app/features/chat/components/InputForm.test.tsx:103-130`: đổi `text-(--accent-foreground)` sang `text-(--on-accent)` và trên nút Stop (`bg-(--danger)`) đổi `text-white` sang `text-(--danger-foreground)`.
6. `src/app/features/chat/components/SmartCode.test.tsx:83-107`, `src/app/features/chat/components/SmartCode.test.tsx:137-142` & `src/app/features/chat/components/SmartCode.test.tsx:206-240`: đổi `bg-(--control-bg)`, `bg-(--surface-elevated)`, `from-(--surface-elevated)`, `border-(--border)`, `text-(--text-secondary)`, `hover:text-(--text-primary)` sang token Vikini 3.0 tương ứng.
7. `src/app/features/gallery/components/GalleryView.test.tsx:136-143`: đổi `text-(--accent-foreground)` sang `text-(--on-accent)` (giữ nguyên kiểm tra âm tính `.not.toContain("text-white")`).
8. `src/components/ui/error-boundary.test.tsx:51-54`: đổi `text-(--accent-foreground)` sang `text-(--on-accent)` (giữ nguyên kiểm tra âm tính `.not.toContain("text-white")`).

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run scripts/vikini-design-lint.test.ts src/lib/utils/fileDisplayUtils.test.ts src/lib/config/theme-config.test.ts --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run src/ scripts/ --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Negative Probes** (hoàn tác ngay sau mỗi probe):

- **N1**: Chèn tạm `bg-blue-500` vào `src/app/not-found.tsx` → `npm run lint` báo lỗi `vikini-design/no-raw-tailwind-colors` (exit `1`).
- **N2**: Chèn tạm `text-[10px]` vào `src/app/not-found.tsx` → `npm run lint` báo lỗi `vikini-design/no-sub-12px-text` (exit `1`).
- **N3**: Chèn tạm `text-(--text-primary)` vào `src/app/not-found.tsx` → `npm run lint` báo lỗi `vikini-design/no-legacy-tokens` (exit `1`).
- **N4**: Đưa `React.useMemo` xuống sau `if (isBot === false) return ...` trong `src/app/features/chat/components/BubbleMarkdown.tsx` → `npm run lint` báo lỗi `react-hooks/rules-of-hooks` (exit `1`).

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                 | Mức        | Control                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Thay `text-white` máy móc thành `text-(--text)` làm mất tương phản chữ trắng trên nút `bg-(--danger)` hoặc nền ảnh tối | Cao        | Phân nhánh ngữ cảnh trong codemod: nút nguy hiểm → `text-(--danger-foreground)`, lớp phủ ảnh/huy hiệu → `text-(--on-overlay)`, panel → `--text` |
| Thay `--surface-muted` và `--control-bg-hover` cùng thành `var(--raised)` làm mất dải sáng chuyển động ở `shimmer.css` | Trung bình | Giữ điểm sáng giữa của `src/app/features/styles/shimmer.css:2-11` bằng `color-mix(in oklab, var(--raised) 88%, var(--text) 12%)`                |
| Rule ESLint quét cả `*.test.tsx` gây lỗi giả trên các dòng `expect(...).not.toContain("text-white")`                   | Trung bình | Khối rule `vikini-design/*` trong `eslint.config.mjs` chỉ áp cho `src/**/*.{ts,tsx}` với `ignores: ["**/*.test.*", "**/*.spec.*"]`              |
| `react-hooks/rules-of-hooks` hiểu nhầm callback `use` trong fixture Playwright là `React.use()`                        | Thấp       | Thêm override `files: ["tests/e2e/**/*.{ts,tsx}"], rules: { "react-hooks/rules-of-hooks": "off" }` tại `eslint.config.mjs`                      |

### Lộ Trình

| Bước | Nội dung                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------- |
| 6D   | **Plan này (Giai đoạn cuối Vikini 3.0)** — Codemod màu thô & token cũ, thang chữ 12–32, lint guard |

### 11. Ghi Chú Triển Khai

- **Codemod & Tương phản Tối/Sáng**: Đã chuyển đổi toàn bộ `656` class màu thô Tailwind/hex tùy ý (`42` file), `37` class chữ `< 12px` (`15` file), và `1.369` điểm tham chiếu biến CSS Vikini 2.x cũ trên `122` file `.tsx`, `src/lib/utils/fileDisplayUtils.ts` và `4` file CSS nền (`base.css`, `tokens.css`, `utilities.css`, `shimmer.css`). Bổ sung `--on-overlay: #ffffff` cho lớp phủ ảnh/huy hiệu bão hòa và khắc phục lỗi tương phản `bg-(--primary) text-black` trên theme sáng (`than-light`) tại `GemPreview.tsx`, `PersonaPreview.tsx`, `ProjectSettingsModal.tsx` bằng `bg-(--accent) text-(--on-accent)`.
- **Thang chữ `12–32` & Gỡ 14 biến alias cũ**: Khai báo `--type-12`..`--type-32` và ánh xạ `@theme` (`--text-xs`, `--text-13`, `--text-sm`, `--text-base`, `--text-xl`, `--text-2xl`, `--text-3xl`), đồng thời gỡ bỏ dứt điểm 14 biến alias cũ trong `base.css`.
- **Chốt chặn ESLint & Rules of Hooks**: Tạo plugin nội bộ `scripts/vikini-design-lint.mjs` (`no-raw-tailwind-colors`, `no-legacy-tokens`, `no-sub-12px-text`), bật `react-hooks/rules-of-hooks: "error"` + `react-hooks/exhaustive-deps: "warn"` trong `eslint.config.mjs` (kèm override tắt `rules-of-hooks` trên `tests/e2e/**` cho callback `use` của Playwright fixture), và đưa `React.useMemo` lên trước `return` sớm tại `BubbleMarkdown.tsx`.
- **Kiểm chứng**: `npx tsc --noEmit` (`0 errors`), `npm run lint` (`0 errors`), Vitest (`234/234` bộ test ứng dụng & script xanh, `2.006` assertions; riêng `code-freeze-guard.test.ts` còn 2 lỗi ngân sách ký tự có sẵn từ trước), 4 Negative Probes `N1–N4` đều chặn đúng lỗi `exit 1` rồi hoàn tác sạch, `tests/e2e/a11y.spec.ts` `15/15` PASS và `qa-6d.spec.ts` `2/2` PASS trên cả `hoanghon-dark`, `hoanghon-light` và `muc-light` ở `1440px` & `375px`.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: Gemini 4 Carbon (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6d-token-codemod-type-scale-lint-guards-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS.
- Đối chiếu `base.css`, `tokens.css`, `utilities.css`, `shimmer.css`, `eslint.config.mjs`, `BubbleMarkdown.tsx`, `tests/e2e/fixtures.ts` và 8 file test Loại C.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                    | Bằng chứng                                                                                                         | Lý do / Yêu cầu sửa                                                                                                                                                    |
| --- | -------------- | ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/styles/themes/_shared/base.css:19-28` | [SRC] `--color-secondary: var(--control-bg)` và `--color-input: var(--control-border)` nằm trong khối `@theme`     | Nếu chỉ xóa dòng 81–92 & 105–110 mà quên sửa dòng 19, 28 và dòng 138 (`::-webkit-scrollbar-thumb`), biến shadcn và thanh cuộn sẽ đứt tham chiếu. **Sửa ở Revision 2**. |
| 2   | DEFECT         | [MINOR] | `src/app/features/styles/shimmer.css:2-11`     | [SRC] `.shimmer-block` tạo hiệu ứng lấp lánh giữa `--surface-muted` và `--control-bg-hover`                        | Nếu thay cả hai thành `var(--raised)` sẽ mất hiệu ứng chuyển động. **Sửa (Revision 2)**: dùng `color-mix(in oklab, var(--raised) 88%, var(--text) 12%)` ở điểm 40%.    |
| 3   | RISK_DISMISSED | —       | `tests/e2e/fixtures.ts:14-38`                  | [SRC] Fixture `authedPage: async ({ page }, use) => { await use(page); }` bị `rules-of-hooks` nhầm với `React.use` | Bổ sung override tắt `react-hooks/rules-of-hooks` riêng cho `tests/e2e/**/*.{ts,tsx}` trong `eslint.config.mjs`.                                                       |

#### Kết Luận

1 `[MAJOR]` về tham chiếu `--control-bg`/`--control-border` trong `@theme` và scrollbar của `base.css` → cập nhật Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: Gemini 4 Carbon (in-session; PM đã ủy quyền tự review không chạy Claude CLI)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-6d-token-codemod-type-scale-lint-guards-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` đã được cập nhật đầy đủ trong §1, §3 A1, §5 (`base.css`, `tokens.css`, `utilities.css`).
- Audit Run 1 #2 `[MINOR]` đã có phương án bảo toàn hiệu ứng shimmer tại `shimmer.css:2-11`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                   | Bằng chứng                                                                                           | Lý do / Hướng xử lý khi code                                                                                                         |
| --- | -------------- | ------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | RISK_DISMISSED | —       | `src/app/features/chat/components/BubbleMarkdown.tsx:172-183` | [SRC] `React.useMemo` đang nằm sau `if (isBot === false) return ...`                                 | Chuyển `const rehypePlugins = React.useMemo(...)` lên dòng 172 trước nhánh `return` sớm.                                             |
| 2   | RISK_ACCEPTED  | [MINOR] | `src/lib/config/theme-config.test.ts:232-251`                 | [SRC] `TC-10` kiểm tra sự tồn tại tạm thời của 11 biến alias cũ từ Giai đoạn 1                       | Khai báo tường minh Loại C tại §8: cập nhật `TC-10` khẳng định 14 biến alias cũ đã bị gỡ và 7 biến thang chữ `--type-12..32` có mặt. |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/features/gems/components/GemPreview.tsx:29-31`       | [SRC] `bg-(--primary) text-2xl text-black` gây chữ đen trên nền đen ở theme `than-light` (`#111111`) | Codemod chuyển sang `bg-(--accent) text-2xl text-(--on-accent)`, đảm bảo tương phản đạt chuẩn WCAG trên cả 10 theme.                 |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Đủ 8 file test Loại C liệt kê đích danh; Test Contract có ca âm tính (TC-01..TC-05) và Negative Probes N1–N4. Plan đạt chuẩn triển khai.

[PLAN_APPROVED]
