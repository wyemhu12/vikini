---
title: "Vikini Theme System & Layout Architecture Remake Implementation Plan"
status: "Approved"
revision: 2
date: "2026-10-16"
author: "@planner"
decision_tag: "[NEEDS_PRODUCT_DECISION]"
---

# Kế Hoạch Triển Khai: Tái Cấu Trúc Toàn Diện Hệ Thống Theme & Kiến Trúc Layout (Vikini 2026)

- **Status**: Approved
- **Revision**: 2
- **Date**: 2026-10-16
- **Scope**: Toàn bộ hệ thống CSS Design Tokens (`src/app/styles/themes/`), Theme Engine (`src/lib/config/theme-config.ts`, `src/app/features/chat/hooks/useTheme.ts`), Unified App Shell (`src/app/features/layout/`, `src/lib/store/layoutStore.ts`), Refactor các component vượt ngưỡng LOC (`Sidebar.tsx`, `ChatBubble.tsx`, `DescribeImageView.tsx`, `GalleryView.tsx`), và chuẩn hóa Contrast / Typography WCAG 2.2 AA.

---

## Technical Plan

### Phần A: Báo Cáo Kiểm Toán Toàn Diện (Comprehensive Codebase Audit Report)

#### A.1. Bảng Điểm Kiểm Toán Hiện Trạng (Current Architecture Scorecard)

| Hạng Mục Đánh Giá                                                      | Điểm Hiện Tại | Mục Tiêu Sau Remake | Đánh Giá Tóm Tắt & Bằng Chứng `[SRC]`                                                                                                                                                                                                                                                                                                                                                                                                         |
| :--------------------------------------------------------------------- | :-----------: | :-----------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Kiến trúc CSS Design Tokens & Tailwind v4**                       | **4.5 / 10**  |    **9.5 / 10**     | Phân mảnh thành 16 file CSS rời rạc (`[SRC]` `src/app/globals.css:18-41`), tồn tại song song biến legacy (`--primary`, `.bg-surface` trong `tokens.css:1-59`) và biến Tailwind v4 (`bg-(--surface)`), khối `@theme` trong `base.css:5-38` chưa ánh xạ đầy đủ các biến `--surface-*` / `--text-*`.                                                                                                                                             |
| **2. Độ chính xác kiểu dữ liệu CSS & Runtime Theme**                   | **4.0 / 10**  |    **9.5 / 10**     | **Bug nghiêm trọng**: Nhóm theme RA2 (`yuri`, `allied`, `soviet`) gán `radial-gradient(...)` vào `--surface` (`[SRC]` `src/app/styles/themes/ra2/yuri.css:6-8`), làm hỏng hoàn toàn `background-color: var(--surface)` và `color-mix(..., var(--surface))` trên toàn app. Dead code `:root[data-theme-tone]` (`[SRC]` `src/app/styles/themes/_shared/base.css:143-169`) có specificity `(0,2,0)` cao hơn `.theme-*` `(0,1,0)`.                |
| **3. Tương phản màu sắc (WCAG 2.2 AA) & Light Mode**                   | **3.5 / 10**  |    **9.5 / 10**     | Chỉ có 1/16 theme là Light (`orchid`), thiếu hẳn Light Theme năng suất cao. `--accent-foreground: #0a0a0a` và `--overlay: rgba(0,0,0,0.7)` bị hardcode toàn cục (`[SRC]` `src/app/styles/themes/_shared/base.css:93,105`). Icon provider trong `NEEDS_INVERSION` bị ép `invert brightness-200` gây tàng hình trên nền sáng (`[SRC]` `src/app/features/chat/components/ModelSelector.tsx:44-51,171,193`).                                      |
| **4. Hiệu năng Render GPU & Accessibility**                            | **5.0 / 10**  |    **9.0 / 10**     | `sunset.css` chồng **41 lớp radial/linear-gradient** trên `body` (`[SRC]` `src/app/styles/themes/glassmorphism/sunset.css:8-66`) kết hợp `backdrop-blur-3xl` (`[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:548`) gây tụt FPS trên GPU tích hợp/di động; thiếu `@media (prefers-reduced-transparency: reduce)`.                                                                                                                    |
| **5. Kiến trúc Layout Shell & Quản lý State Điều Hướng**               | **4.0 / 10**  |    **9.5 / 10**     | Không có Shared App Shell. 5 route views (`ChatApp`, `ImageGenStudio`, `GalleryView`, `DescribeImageView`, `NovelcrafterStudioApp`) tự mount `<Sidebar>` + `<HeaderBar>` riêng và copy-paste chuỗi offset ở **7 nơi** (`[SRC]` `src/app/features/chat/components/ChatApp.tsx:266`). Chuyển route làm reset trạng thái đóng/mở Sidebar và remount toàn bộ cây DOM Sidebar.                                                                     |
| **6. Tuân thủ Chuẩn Code (`.agents/rules/01-coding.md` & `03-ui.md`)** | **5.5 / 10**  |    **9.5 / 10**     | 4 file vượt ngưỡng 400 dòng, trong đó `Sidebar.tsx` dài **644 dòng** vượt trần cứng 500 dòng (`[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:1-644`). Vi phạm luật cấm `text-[10px]`/`text-[11px]` ở 18+ vị trí, hardcode `z-9999` (`[SRC]` `src/app/features/projects/components/ProjectChatView.tsx:174`), mất icon trong `StreamErrorBanner.tsx:69,80`, và sót chuỗi tiếng Anh hardcode trong `DescribeImageView.tsx:90,94,187`. |

---

#### A.2. Phân Tích Chi Tiết Các Lỗ Hổng Kỹ Thuật (Root-Cause Audit Findings)

##### 1. Lỗi Kiến Trúc Hệ Thống Theme (Theme System Critical Flaws)

1. **Gán sai kiểu dữ liệu CSS `<image>` cho biến màu `<color>` `--surface` trong nhóm theme RA2**:
   - **Bằng chứng `[SRC]`**:
     - [yuri.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/ra2/yuri.css#L6-L8), [allied.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/ra2/allied.css#L6-L8), [soviet.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/ra2/soviet.css#L6-L8) gán trực tiếp chuỗi `radial-gradient(...), linear-gradient(...)` vào `--surface`, trong khi không định nghĩa `--surface-gradient`.
   - **Hệ quả kỹ thuật**:
     - Khi các component sử dụng utility của Tailwind v4 như `bg-(--surface)` (sinh ra `background-color: var(--surface)`) tại [ImageGenStudio.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/ImageGenStudio.tsx#L71), [GalleryView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.tsx#L40), [NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx#L202), [sheet.tsx](file:///c:/Users/wyemh/vikini/src/components/ui/sheet.tsx#L59), hoặc dùng modifier độ mờ `bg-(--surface)/95` tại [ChatControls.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatControls.tsx#L150) và `color-mix(in srgb, var(--accent) 5%, var(--surface))` tại [InputForm.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/InputForm.tsx#L231), trình duyệt đánh giá biểu thức CSS là **invalid at computed-value time** (vì `background-color` và `color-mix()` chỉ chấp nhận `<color>`, không chấp nhận `<image>`). Kết quả là nền bị biến thành `transparent`!

2. **Dead Code `data-theme-tone` & Bẫy Specificity `(0,2,0)` trong `base.css`**:
   - **Bằng chứng `[SRC]`**:
     - [base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css#L143-L169) khai báo `:root[data-theme-tone="light"]` và `:root[data-theme-tone="dark"]`.
     - [useTheme.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/hooks/useTheme.ts#L10-L16) khai báo `THEME_TONES` nhưng **không bao giờ** gắn attribute `data-theme-tone` lên `document.documentElement`.
     - Nguy hiểm hơn: các file theme dùng selector `.theme-<name>` có specificity `(0,1,0)`. Nếu `data-theme-tone` được gắn lên `<html>`, selector `:root[data-theme-tone="dark"]` có specificity `(0,2,0)` sẽ **ghi đè (override) và xóa sổ** toàn bộ `--surface`, `--border`, `--text-primary` của cả 16 theme!

3. **Thiếu Hụt Light Mode Trầm Trọng & Đứt Gãy Tương Phản (Contrast Failure)**:
   - **Bằng chứng `[SRC]`**:
     - Trong 16 theme tại [theme-config.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.ts#L14-L36), chỉ có duy nhất 1 theme sáng là `orchid` ([orchid.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/glassmorphism/orchid.css#L5-L29)) mang tông tím hồng glassmorphism. Hoàn toàn thiếu một Light Theme trung tính, chuẩn mực cho làm việc ban ngày (như Claude Daylight / Linear Light).
     - [base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css#L93-L105) hardcode `--accent-foreground: #0a0a0a` và `--overlay: rgba(0, 0, 0, 0.7)` mà không biến thiên theo từng theme. Với `orchid` (`--accent: #a855f7`), chữ `#0a0a0a` trên nền `#a855f7` chỉ đạt **4.63:1** và tạo cảm giác chữ đen tối xỉn trên nút tím; trong khi đó [HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L104), [FloatingMenuTrigger.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/FloatingMenuTrigger.tsx#L63), [ModelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ModelSelector.tsx#L322), [ThinkingLevelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx#L114) lại dùng `text-(--surface)` trên `bg-(--accent)` thay vì `text-(--accent-foreground)`.
     - [ModelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ModelSelector.tsx#L44-L51) và dòng `171, 193` (`const needsInvert = NEEDS_INVERSION.has(pid)`) ép `invert brightness-200` cho logo đơn sắc của OpenAI, Anthropic, Grok, Groq, OpenRouter. Khi bật theme sáng (`orchid`), logo màu đen bị đảo ngược thành màu trắng tinh trên nền `bg-(--surface-muted)` trắng (`rgba(255,255,255,0.82)`), khiến icon biến mất!
     - [SmartCode.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/SmartCode.tsx#L149) dùng `scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20` (vừa không tồn tại utility `scrollbar-thin`, vừa tàng hình trên nền sáng thay vì dùng `custom-scrollbar` tại `utilities.css:283-305`).
     - [BubbleAvatar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/BubbleAvatar.tsx#L47-L49) gọi `rgba(var(--accent-rgb,59,130,246),0.1)` nhưng biến `--accent-rgb` **chưa từng tồn tại** trong bất kỳ file CSS nào!
     - [AccessPendingScreen.tsx](file:///c:/Users/wyemh/vikini/src/app/components/AccessPendingScreen.tsx#L10-L61) và [signin/page.tsx](file:///c:/Users/wyemh/vikini/src/app/auth/signin/page.tsx#L21-L150) dùng màu hardcode (`bg-[#0a0a0a]`, `from-gray-900 via-purple-900`, `<style jsx>`) tách rời hoàn toàn khỏi hệ thống theme.

4. **Quá Tải GPU Do Multi-Layer Gradients & Blur**:
   - **Bằng chứng `[SRC]`**:
     - [sunset.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/glassmorphism/sunset.css#L8-L66) xếp chồng **41 lớp radial-gradient và linear-gradient** vào `--surface-gradient` trên `body`. Mỗi khi cuộn khung chat có các lớp `backdrop-blur-3xl` ([Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx#L548), [DashboardView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/DashboardView.tsx#L248)) hoặc `backdrop-blur-2xl` ([HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L83)), compositor của trình duyệt phải lấy mẫu lại (resample) hàng chục lớp gradient ở tần số 60–120Hz.

##### 2. Lỗi Kiến Trúc Layout, Sự Phân Mảnh App Shell & Vi Phạm Chuẩn UI

1. **Lặp Lại Thủ Công Layout Shell ở 7 Nơi & Mất Trạng Thái Khi Chuyển Trang**:
   - **Bằng chứng `[SRC]`**:
     - Chuỗi class tính toán độ lệch trái cho Sidebar `sidebarCollapsed ? "md:pl-[calc(5rem+var(--sal,0px))]" : "md:pl-[calc(18rem+var(--sal,0px))] lg:pl-[calc(20rem+var(--sal,0px))]"` (và `md:left-[calc(...)]` cho `ChatThemeBackground.tsx`) bị copy-paste cứng tại **7 file**:
       1. [ChatApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx#L266)
       2. [ChatThemeBackground.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatThemeBackground.tsx#L31)
       3. [LandingDisclaimer.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/LandingDisclaimer.tsx#L16)
       4. [ImageGenStudio.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/ImageGenStudio.tsx#L143)
       5. [GalleryView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.tsx#L41)
       6. [DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx#L220)
       7. [NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx#L207)
     - Mỗi trang khởi tạo `const [sidebarCollapsed, setSidebarCollapsed] = useState(false)` cục bộ ([useChatLayoutState.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatLayoutState.ts#L28), [ImageGenStudio.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/ImageGenStudio.tsx#L42), [useGalleryController.ts](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/hooks/useGalleryController.ts#L62-L63), [DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx#L41), [NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx#L54)). Khi người dùng thu gọn Sidebar ở Chat rồi bấm sang `/images` hoặc `/gallery`, Sidebar tự động bung rộng lại và remount lại từ đầu.

2. **Ẩn Nút Menu Mobile Chuẩn Trong `HeaderBar` & Phụ Thuộc Nút Nổi `FloatingMenuTrigger`**:
   - **Bằng chứng `[SRC]`**:
     - [HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L85-L96) đặt class `hidden` cứng lên nút mở menu mobile và thay bằng [FloatingMenuTrigger.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/FloatingMenuTrigger.tsx#L60) (nút tròn kéo thả nổi đè lên nội dung ở góc dưới trái `bottom-[calc(6rem+var(--sab,0px))] left-4`), gây che khuất nội dung chat/ảnh trên màn hình nhỏ.

3. **Vi Phạm Giới Hạn Kích Thước File (`.agents/rules/01-coding.md`) & Quy Tắc UI/i18n (`.agents/rules/03-ui.md`, `04-bilingual.md`)**:
   - **4 File Component vượt ngưỡng 400 dòng + 1 Hook vượt 350 dòng**:
     - [Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx#L1-L644): **644 dòng** (vượt mức trần cứng 500 dòng).
     - [DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx#L1-L442): **442 dòng**.
     - [GalleryView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.tsx#L1-L435): **435 dòng**.
     - [ChatBubble.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx#L1-L430): **430 dòng**.
   - **Vi phạm quy tắc `.agents/rules/03-ui.md` (cấm `text-[10px]`/`text-[11px]`, cấm `z-9999`) & `.agents/rules/04-bilingual.md`**:
     - `text-[10px]` / `text-[11px]` xuất hiện tại [HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L173-L249), [ModelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ModelSelector.tsx#L106-L264), [ThinkingLevelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx#L96), [CommandPalette.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/CommandPalette.tsx#L167-L198), [ScrollToBottomButton.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ScrollToBottomButton.tsx#L51), [DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx#L427), và [signin/page.tsx](file:///c:/Users/wyemh/vikini/src/app/auth/signin/page.tsx#L40-L123).
     - [DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx#L90-L187) hardcode 3 chuỗi tiếng Anh trong `toast.error(...)` ở dòng `90`, `94`, `187`.
     - [ProjectChatView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/projects/components/ProjectChatView.tsx#L174) dùng `z-9999` thay vì token `z-(--z-modal)`.
     - [StreamErrorBanner.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/StreamErrorBanner.tsx#L69-L80) có 2 thẻ `<span>` rỗng khiến banner báo lỗi mất icon cảnh báo và nút đóng (`X`) không có biểu tượng hiển thị!

---

### Phần B: Đề Xuất 3 Phương Án Remake Toàn Diện (`[NEEDS_PRODUCT_DECISION]`)

> [!IMPORTANT]
> **`[NEEDS_PRODUCT_DECISION]`**: Dưới đây là 3 phương án kiến trúc để tái cấu trúc toàn diện hệ thống Theme và Layout của Vikini. Theo quy trình Uninterrupted Chain, **Phương Án 1 (Option 1)** được chọn làm **Default Assumption** để lập đặc tả kỹ thuật chi tiết và kiểm định tự động với `@reviewer`. Sau khi kế hoạch được duyệt (`PLAN_APPROVED`), User có thể chốt phương án cuối cùng trước khi bắt đầu viết code.

#### Phương Án 1 (Khuyên Dùng — Default Assumption): _"Linear / Claude Precision Studio"_ — 3-Tier Semantic Token Engine + Unified WorkspaceShell

- **Triết lý thiết kế**: Kết hợp sự sắc sảo, tốc độ cao của **Linear 2026** và không gian đọc/viết ấm áp, tĩnh lặng của **Claude.ai Studio**.
- **Kiến trúc Theme (3-Tier Token Engine)**:
  - **Tier 1 (Primitives & Unified `@theme` Bridge trong `base.css`)**: Hợp nhất toàn bộ ánh xạ biến màu vào khối `@theme` duy nhất tại `src/app/styles/themes/_shared/base.css:5-38` (không khai báo `@theme` trùng lặp ở `tokens.css`), trong khi các component tiếp tục tuân thủ việc dùng semantic variables (`bg-(--surface)`, `text-(--text-primary)`) theo `.agents/rules/03-ui.md:30-35`.
  - **Tier 2 (Semantic Surface & Contrast Tokens)**: Tách bạch tuyệt đối `--surface` (luôn là `<color>` hợp lệ để `color-mix()` và `bg-(--surface)/95` hoạt động 100%) và `--surface-gradient` (`<image>` cho `body`). Mỗi theme định nghĩa đầy đủ `--accent-foreground`, `--overlay`, `--shadow-color`, và `--theme-tone` thông qua attribute `data-theme-tone="light" | "dark"` được đồng bộ trực tiếp trong `useTheme.ts` (với selector `:where(:root[data-theme-tone])` specificity `(0,0,0)` để không bao giờ ghi đè `.theme-*`).
  - **Tier 3 (Curated Theme Families + First-Class Light Mode)**:
    - Gom 16 file CSS rời rạc thành 3 bảng stylesheet phân tầng rõ ràng: `focus-themes.css`, `glass-themes.css`, `ra2-themes.css`.
    - Bổ sung theme sáng chủ lực **`daylight`** (`{ id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" }`, Alabaster Warm Paper `#faf9f5`, Surface `#ffffff`, Ink `#141413`, Cobalt Accent `#2563eb`, Contrast Ratio 16.5:1) vào `THEME_CONFIG`, đồng thời nâng cấp **`orchid`** trong nhóm `Glassmorphism` để đạt chuẩn WCAG 2.2 AA (>= 4.5:1 cho mọi text, >= 3:1 cho border/icon).
    - Tối ưu hóa `sunset` (giảm từ 41 gradients xuống 6 gradients mượt mà) và bổ sung `@media (prefers-reduced-transparency: reduce)` tắt `backdrop-filter` + chuyển `--surface-muted`/`--surface-elevated` về màu đặc.
- **Kiến trúc Layout (Unified `WorkspaceShell` + Persisted `useLayoutStore`)**:
  - Tạo Zustand store `src/lib/store/layoutStore.ts` lưu trữ trạng thái `sidebarCollapsed` (persist vào `localStorage` an toàn với SSR) và `sidebarOpen` (mobile drawer).
  - Tạo component `src/app/features/layout/components/WorkspaceShell.tsx` làm khung vỏ thống nhất cho cả 5 màn hình (`ChatApp`, `ImageGenStudio`, `GalleryView`, `DescribeImageView`, `NovelcrafterStudioApp`), xóa bỏ hoàn toàn 7 chỗ lặp code offset Sidebar.
  - Khôi phục nút Hamburger chuẩn (`44x44px`, `md:hidden`) ngay trên `HeaderBar.tsx` và loại bỏ sự phụ thuộc vào bong bóng nổi `FloatingMenuTrigger` gây che khuất nội dung.
  - Chia nhỏ 4 file vượt ngưỡng (`Sidebar.tsx` 644 dòng → ~255 dòng; `ChatBubble.tsx` 430 dòng → ~275 dòng; `DescribeImageView.tsx` 442 dòng → ~295 dòng; `GalleryView.tsx` 435 dòng → ~285 dòng).
  - Tinh gọn `ChatControls.tsx` thành **Unified Composer Island** sắc nét, chuẩn hóa toàn bộ font size >= `12px` (`text-xs`).

#### Phương Án 2: _"Spatial Glass & Bento Command Workspace"_ (visionOS / Arc Browser Style)

- **Triết lý thiết kế**: Giao diện không gian nổi (Spatial UI) lấy cảm hứng từ **Apple visionOS / Arc Browser**.
- **Kiến trúc Theme & Layout**:
  - Toàn bộ Sidebar, Header và khung Chat tách thành các "Floating Glass Islands" cách mép màn hình `12px` (`p-3 gap-3`), bo góc lớn (`rounded-3xl`), viền specular highlight (`1px solid rgba(255,255,255,0.14)`).
  - Thu gọn Sidebar thành một thanh Dock dọc siêu mảnh (`64px`) chỉ hiện icon; toàn bộ danh sách hội thoại và dự án chuyển vào Command Center (`⌘K` hoặc drawer trượt khi hover).
- **Nhược điểm**: Làm giảm diện tích hiển thị nội dung thực tế trên màn hình laptop 13–14 inch (~8–10% diện tích bị mất cho khoảng hở `gap-3`/`p-3`), chi phí tính toán GPU cho nhiều đảo kính nổi cao hơn, và thay đổi thói quen sử dụng cây thư mục Project/Conversation cố định bên trái.

#### Phương Án 3: _"Token & Theme Engine Overhaul Only"_ (Giữ Nguyên Kiến Trúc Layout Hiện Tại)

- **Triết lý thiết kế**: Chỉ sửa lỗi CSS/Theme Engine, bổ sung Light Mode `daylight`, sửa lỗi `--surface` của RA2, chuẩn hóa contrast và cỡ chữ `text-xs`, nhưng **không** tạo `WorkspaceShell`, **không** tạo `layoutStore`, và **không** tách nhỏ `Sidebar.tsx` / `ChatBubble.tsx` / `GalleryView.tsx` / `DescribeImageView.tsx`.
- **Nhược điểm**: Rủi ro thấp nhất và diff nhỏ nhất, nhưng **không giải quyết được** nợ kỹ thuật cốt lõi về Layout: 7 nơi copy-paste offset Sidebar vẫn tồn tại, chuyển trang vẫn làm mất trạng thái thu gọn Sidebar, và `Sidebar.tsx` (644 dòng) vẫn vi phạm trần cứng 500 dòng của `.agents/rules/01-coding.md`.

#### Bảng So Sánh Đánh Đổi Giữa 3 Phương Án (Trade-off Matrix)

| Tiêu Chí Đánh Giá                           | Phương Án 1: Linear/Claude Studio (Khuyên Dùng)            | Phương Án 2: Spatial Glass & Bento                   | Phương Án 3: Chỉ Sửa Theme CSS                         |
| :------------------------------------------ | :--------------------------------------------------------- | :--------------------------------------------------- | :----------------------------------------------------- |
| **Chất lượng UX & Tính chuyên nghiệp**      | Xuất sắc (tối ưu mật độ thông tin & sự tập trung)          | Bắt mắt nhưng tốn diện tích viewport trên màn nhỏ    | Trung bình (vẫn còn lỗi UX chuyển trang & mobile menu) |
| **Độ bền Kiến trúc (Maintainability)**      | Rất cao (Unified `WorkspaceShell` + modular `<350` LOC)    | Cao nhưng phức tạp hóa hệ thống floating islands     | Thấp (giữ nguyên 7x layout duplication & file 644 LOC) |
| **Hiệu năng GPU & Mobile FPS**              | Rất cao (tối ưu gradient + `prefers-reduced-transparency`) | Trung bình (nhiều lớp `backdrop-filter` chồng lấn)   | Cao (nếu giảm gradient trong `sunset.css`)             |
| **Độ tương thích WCAG 2.2 AA & Light Mode** | 100% (17 themes: 15 Dark + 2 Light chuẩn AA)               | 85% (Glassmorphism khó đạt contrast AA ở mọi góc)    | 100%                                                   |
| **Rủi ro Regression**                       | Thấp–Trung bình (được kiểm soát bằng Test Contract)        | Cao (thay đổi luồng điều hướng Sidebar sang Dock/⌘K) | Rất thấp                                               |

---

### Phần C: Bảng Đối Chiếu Thay Đổi Kiến Trúc (`Before | After | Why`)

| Hạng Mục                                      | Before (Hiện Tại)                                                                                                                              | After (Phương Án 1 — Default Assumption)                                                                                                                                                                                                                    | Why (Lý Do Kỹ Thuật)                                                                                                                                                       |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tổ chức File CSS Theme**                    | 16 file CSS rời rạc trong `focus/`, `glassmorphism/`, `ra2/` (`globals.css:18-41`)                                                             | 3 file gom nhóm theo họ: `focus-themes.css`, `glass-themes.css`, `ra2-themes.css` + `_shared/{base,tokens,utilities}.css`                                                                                                                                   | Giảm từ 19 xuống 6 lệnh `@import`, dễ dàng kiểm toán toàn bộ bảng token và contrast của từng họ theme tại một nơi.                                                         |
| **Kiểu dữ liệu `--surface` (RA2)**            | `--surface: radial-gradient(...)` (`yuri.css:6`, `allied.css:6`, `soviet.css:6`)                                                               | `--surface: #120924` (`<color>` đặc) + `--surface-gradient: radial-gradient(...)` (`<image>`)                                                                                                                                                               | Sửa triệt để lỗi mất nền (`transparent`) khi dùng `bg-(--surface)/95` hoặc `color-mix(in srgb, ..., var(--surface))`.                                                      |
| **Đồng bộ Tone Sáng/Tối (`data-theme-tone`)** | `:root[data-theme-tone]` có specificity `(0,2,0)` nhưng `useTheme.ts` không bao giờ set attribute này                                          | `useTheme.ts` đồng bộ `document.documentElement.dataset.themeTone = tone` và `colorScheme`; CSS dùng `:where(:root[data-theme-tone="light"])` specificity `(0,0,0)` cho giá trị mặc định                                                                    | Cho phép các component và icon tự động thích ứng Light/Dark mà không bao giờ ghi đè biến màu riêng của `.theme-<name>` `(0,1,0)`.                                          |
| **Light Mode & Contrast**                     | Chỉ có `orchid` (tím hồng), `--accent-foreground` cố định `#0a0a0a`, icon provider trong `NEEDS_INVERSION` bị `invert` trắng xóa trên nền sáng | Thêm theme sáng năng suất **`daylight`** (`Focus` group) + chuẩn hóa `orchid`; mỗi theme có `--accent-foreground` và `--overlay` riêng; icon trong `NEEDS_INVERSION` dùng `needsInvert ? "theme-icon-invert" : ""` chỉ đảo màu khi `data-theme-tone="dark"` | Đạt chuẩn tương phản WCAG 2.2 AA (>= 4.5:1) trên cả 17 themes; bảo toàn màu gốc của logo `gemini`/`deepseek` và hiển thị rõ logo đơn sắc trên cả nền sáng/tối.             |
| **App Shell & Sidebar State**                 | 5 route views tự quản lý `useState(false)` và lặp lại chuỗi offset ở 7 nơi                                                                     | `useLayoutStore` (`src/lib/store/layoutStore.ts`) + `<WorkspaceShell>` dùng `.workspace-main-offset-*` (`padding-left`) và `.workspace-fixed-left-*` (`left` cho `ChatThemeBackground`)                                                                     | Giữ nguyên trạng thái thu gọn/mở rộng Sidebar xuyên suốt khi chuyển giữa Chat, Image Studio, Gallery, Describe, Novelcrafter; giữ huy hiệu RA2 luôn chính giữa khung chat. |
| **Mobile Navigation Trigger**                 | Nút menu trong `HeaderBar.tsx:89` bị gắn `hidden`; dùng bóng nổi `FloatingMenuTrigger` đè lên khung chat                                       | Khôi phục nút Hamburger `md:hidden h-10 w-10` chuẩn trong `HeaderBar.tsx`; gỡ bỏ `FloatingMenuTrigger` khỏi các trang                                                                                                                                       | Giải phóng không gian hiển thị dưới đáy màn hình mobile, tuân thủ chuẩn chạm `>= 44x44px`.                                                                                 |
| **Kích thước Component (LOC)**                | `Sidebar.tsx` (644 dòng), `DescribeImageView.tsx` (442 dòng), `GalleryView.tsx` (435 dòng), `ChatBubble.tsx` (430 dòng)                        | Tất cả được tách module co-located xuống **250–300 dòng/file**                                                                                                                                                                                              | Tuân thủ nghiêm ngặt mục tiêu 200–400 dòng/file (`.agents/rules/01-coding.md`), bảo toàn 100% props và hành vi.                                                            |

---

### 1. Mục Tiêu (Goal)

Thực hiện tái cấu trúc toàn diện (Remake) **Hệ Thống Theme (3-Tier Token Engine)** và **Kiến Trúc Layout (Unified WorkspaceShell)** cho dự án Vikini theo **Phương Án 1 (Default Assumption)**:

1. **Chuẩn hóa CSS Token Engine cho Tailwind CSS v4**: Tách biệt rõ `--surface` (`<color>`) và `--surface-gradient` (`<image>`), sửa lỗi mất màu nền trên nhóm theme RA2, hợp nhất khai báo `@theme` duy nhất tại `base.css`, bổ sung `@media (prefers-reduced-transparency: reduce)`, và hợp nhất 16 file CSS nhỏ lẻ thành 3 file họ theme (`focus-themes.css`, `glass-themes.css`, `ra2-themes.css`).
2. **Bổ sung Light Mode Năng Suất (`daylight`) & Chuẩn Hóa WCAG 2.2 AA**: Đưa tổng số theme trong `THEME_CONFIG` lên 17 themes (bảo toàn 100% 16 ID hiện có + thêm `daylight`), đồng bộ `data-theme-tone="light" | "dark"` từ `useTheme.ts`, sửa lỗi logo provider đơn sắc bị đảo màu trắng trên nền sáng, và đảm bảo tỷ lệ tương phản >= 4.5:1.
3. **Thống nhất Kiến Trúc Layout với `WorkspaceShell` & `useLayoutStore`**: Lưu trữ bền vững trạng thái `sidebarCollapsed` qua `localStorage` (an toàn SSR Hydration), xóa bỏ 7 điểm lặp code offset Sidebar (phân tách rõ `padding-left` cho nội dung và `left` cho `ChatThemeBackground`), khôi phục nút mở Sidebar chuẩn trên `HeaderBar` mobile.
4. **Module hóa các Component vượt ngưỡng LOC & Dọn dẹp Vi phạm UI (`03-ui.md`, `04-bilingual.md`)**: Tách nhỏ `Sidebar.tsx` (644 → ~255 dòng), `ChatBubble.tsx` (430 → ~275 dòng), `DescribeImageView.tsx` (442 → ~295 dòng), `GalleryView.tsx` (435 → ~285 dòng); nâng toàn bộ cỡ chữ `text-[10px]`/`text-[11px]` lên tối thiểu `text-xs` (12px), sửa `z-9999`, chuyển 3 chuỗi toast tiếng Anh hardcode trong `DescribeImageView.tsx` sang `useLanguage()`, và khôi phục icon bị mất trong `StreamErrorBanner.tsx`.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ bảng **Pre-Work Protocol** trong [.agents/rules/02-quality.md](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md#L1-L55):

| Loại Công Việc                | Tài Liệu Đã Đối Chiếu & Bắt Buộc Tham Chiếu Khi Triển Khai                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mọi task (Core & Lessons)** | [docs/lessons-learned.md](file:///c:/Users/wyemh/vikini/docs/lessons-learned.md), [.agents/rules/00-core.md](file:///c:/Users/wyemh/vikini/.agents/rules/00-core.md), [.agents/rules/01-coding.md](file:///c:/Users/wyemh/vikini/.agents/rules/01-coding.md), [.agents/rules/02-quality.md](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md)                                                                                                                                                                    |
| **UI / Styling / Component**  | [.agents/rules/03-ui.md](file:///c:/Users/wyemh/vikini/.agents/rules/03-ui.md), [src/app/globals.css](file:///c:/Users/wyemh/vikini/src/app/globals.css), [src/app/styles/themes/\_shared/base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css), [src/app/styles/themes/\_shared/tokens.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/tokens.css), [src/app/styles/themes/\_shared/utilities.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/utilities.css) |
| **Bilingual / i18n Strings**  | [.agents/rules/04-bilingual.md](file:///c:/Users/wyemh/vikini/.agents/rules/04-bilingual.md), [src/lib/utils/translations/vi.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts), [src/lib/utils/translations/en.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts), [src/lib/utils/translations/index.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/index.ts)                                                                                                            |
| **Architecture & State**      | [docs/architecture.md](file:///c:/Users/wyemh/vikini/docs/architecture.md), [src/lib/config/theme-config.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.ts), [src/lib/store/languageStore.ts](file:///c:/Users/wyemh/vikini/src/lib/store/languageStore.ts)                                                                                                                                                                                                                                                |

---

### 3. Assumptions & Cross-Task Dependencies

1. **Product Decision Assumption (`[NEEDS_PRODUCT_DECISION]`)**:
   - Kế hoạch này lấy **Phương Án 1 (_Linear/Claude Precision Studio_)** làm **Default Assumption**. Nếu User chọn Phương Án 2 hoặc Phương Án 3 sau khi duyệt, phạm vi các bước Layout có thể rút gọn tương ứng.
2. **Bảo Toàn Tương Thích Ngược Cho `localStorage` Theme (`next-themes`) & Hợp Đồng `THEME_CONFIG`**:
   - Giữ nguyên 100% cấu trúc export của [theme-config.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.ts#L1-L43) (`ThemeTone`, `ThemeGroup`, `ThemeDefinition`, `THEME_CONFIG: ThemeDefinition[]`, `THEME_IDS: string[]`, `DEFAULT_THEME = "blueprint"`, `getThemeById(id: string)`).
   - Toàn bộ 16 mã định danh theme hiện hữu (`nebula`, `orchid`, `aqua`, `holo`, `sunset`, `blueprint`, `amber`, `indigo`, `charcoal`, `pitch-black`, `gold`, `red`, `rose`, `yuri`, `allied`, `soviet`) được giữ nguyên. Bổ sung thêm phần tử `{ id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" }` vào `THEME_CONFIG` (tổng cộng **17 themes**).
3. **SSR Hydration Safety cho `useLayoutStore`**:
   - Tương tự pattern đã kiểm chứng tại [languageStore.ts](file:///c:/Users/wyemh/vikini/src/lib/store/languageStore.ts#L1-L13) và [LanguageUpdater.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/LanguageUpdater.tsx#L9-L38), `useLayoutStore` khởi tạo `sidebarCollapsed: false` và `sidebarOpen: false` giống nhau trên cả Server và lần render đầu tiên ở Client, sau đó mới đọc `localStorage.getItem("vikini-layout-sidebar-collapsed")` trong `useEffect` thông qua hàm `hydrateLayout()` để tuyệt đối không gây lỗi React 19 Hydration Mismatch.
4. **Đồng bộ Song Ngữ (`vi.ts` & `en.ts`)**:
   - Bổ sung đồng thời vào cả [vi.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts#L50-L66) và [en.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts#L52-L67) khóa tên theme `daylight` (khớp với `ThemeDefinition.labelKey: TranslationKey`) cùng 3 khóa thông báo lỗi cho `DescribeImageView.tsx` (`describeInvalidFile`, `describeFileTooLarge`, `describeCopyFailed`) để vượt qua kiểm tra compile-time `_AssertTranslationsParity` tại [translations/index.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/index.ts#L26-L34).
5. **Độc lập với Backend / Database**:
   - Thay đổi này hoàn toàn nằm ở tầng Presentation, Styling và Client State (`src/app/`, `src/components/ui/`, `src/lib/config/`, `src/lib/store/`, `src/lib/utils/translations/`). Không thay đổi API route contract, database schema hay luồng xác thực NextAuth/Supabase.

---

### 4. Bảng Verified Versions (Xác Minh Trực Tuyến Năm 2026)

| Công Nghệ / Thư Viện                | Phiên Bản Trong Repo (`[SRC]`) | Trạng Thái & Chuẩn Kỹ Thuật Năm 2026                                                                             | Nguồn Xác Minh (`[SRC]` & `[URL]`)                                                                                                                |
| :---------------------------------- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Next.js (App Router)**            | `^16.4.0`                      | Stable 2026; yêu cầu `suppressHydrationWarning` trên `<html>` khi kết hợp `next-themes`                          | `[SRC]` [package.json](file:///c:/Users/wyemh/vikini/package.json#L68), `[URL]` `https://nextjs.org/docs/messages/react-hydration-error`          |
| **React & React DOM**               | `^19.2.3`                      | Stable 2026; kiểm soát chặt hydration tree mismatch                                                              | `[SRC]` [package.json](file:///c:/Users/wyemh/vikini/package.json#L76-L77), `[URL]` `https://react.dev/reference/react-dom/client/hydrateRoot`    |
| **Tailwind CSS v4**                 | `^4.1.18`                      | CSS-first `@theme` directive, native `color-mix(in srgb, ...)`, cú pháp biến `bg-(--var)`                        | `[SRC]` [package.json](file:///c:/Users/wyemh/vikini/package.json#L106), `[URL]` `https://tailwindcss.com/docs/theme`                             |
| **`next-themes`**                   | `^0.4.6`                       | Quản lý class theme trên `<html>` qua `ThemeProvider`                                                            | `[SRC]` [package.json](file:///c:/Users/wyemh/vikini/package.json#L70), `[URL]` `https://github.com/pacocoursey/next-themes`                      |
| **Zustand**                         | `^5.0.9`                       | Client state management; khuyến nghị manual hydration trên Next.js App Router để tránh SSR mismatch              | `[SRC]` [package.json](file:///c:/Users/wyemh/vikini/package.json#L88), `[URL]` `https://zustand.docs.pmnd.rs/integrations/persisting-store-data` |
| **Framer Motion**                   | `^12.23.26`                    | Layout & gesture animations cho Sidebar drawer và modals                                                         | `[SRC]` [package.json](file:///c:/Users/wyemh/vikini/package.json#L58), `[URL]` `https://motion.dev/docs/react-quick-start`                       |
| **Lucide React**                    | `^0.562.0`                     | Bộ icon vector chuẩn dùng trong toàn bộ UI                                                                       | `[SRC]` [package.json](file:///c:/Users/wyemh/vikini/package.json#L63), `[URL]` `https://lucide.dev/guide/packages/lucide-react`                  |
| **WCAG 2.2 AA & CSS Media Queries** | W3C / MDN 2026                 | Tương phản chữ thường >= `4.5:1`, UI/biểu tượng >= `3:1`, hỗ trợ `@media (prefers-reduced-transparency: reduce)` | `[URL]` `https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency`, `[URL]` `https://www.w3.org/TR/WCAG22/`           |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới (`[NEW]`, `[MODIFY]`, `[DELETE]`)

#### 5.1. Tầng Cấu Hình Theme & CSS Design Tokens

- **`[MODIFY]` [src/lib/config/theme-config.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.ts)** (~60 dòng):
  - Giữ nguyên 100% các kiểu và biến xuất hiện tại (`ThemeTone`, `ThemeGroup`, `ThemeDefinition`, `THEME_CONFIG`, `THEME_IDS`, `DEFAULT_THEME = "blueprint"`, `getThemeById`) để tương thích tuyệt đối với `providers.tsx`, `HeaderBar.tsx`, `useTheme.ts`.
  - Bổ sung phần tử `"daylight"` vào nhóm `"Focus"` trong `THEME_CONFIG: ThemeDefinition[]`:
    ```ts
    { id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" },
    ```
  - Xuất thêm hằng số `THEME_TONES: Record<string, ThemeTone>` (tạo từ `THEME_CONFIG`) và hàm helper `getThemeTone(id?: string | null): ThemeTone`:

    ```ts
    export const THEME_TONES: Record<string, ThemeTone> = THEME_CONFIG.reduce(
      (acc, t) => ({ ...acc, [t.id]: t.tone }),
      {} as Record<string, ThemeTone>
    );

    export function getThemeTone(id?: string | null): ThemeTone {
      if (!id) return "dark";
      return getThemeById(id)?.tone ?? "dark";
    }
    ```

- **`[MODIFY]` [src/lib/config/theme-config.test.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.test.ts)** (~165 dòng):
  - Cập nhật unit test co-located trên cấu trúc thật của `theme-config.ts`:
    - Kiểm tra `THEME_CONFIG` và `THEME_IDS` có đúng **17 themes** (`expect(THEME_CONFIG).toHaveLength(17)`, `expect(THEME_IDS).toHaveLength(17)`), bao gồm `"daylight"`, `"orchid"`, `"blueprint"`.
    - Kiểm tra `getThemeById("daylight")` trả về `{ id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" }`.
    - Kiểm tra `getThemeTone("daylight") === "light"`, `getThemeTone("orchid") === "light"`, `getThemeTone("blueprint") === "dark"`, và các boundary cases `getThemeTone(undefined) === "dark"`, `getThemeTone("") === "dark"`, `getThemeTone("unknown-theme") === "dark"`.
    - **Bảo toàn & mở rộng khối `describe("WCAG 2.2 Contrast & Token Integrity across 17 CSS Themes")`** (dòng `55-134`):
      - Hàm `getCssFiles(themesDir)` tự động quét 3 file gộp `focus-themes.css`, `glass-themes.css`, `ra2-themes.css`.
      - Với mọi `theme` trong `THEME_CONFIG` (cả 17 themes):
        1. Tìm khối `.theme-${theme.id} { ... }` trong các file CSS.
        2. Xác minh `--surface:` được định nghĩa và **không chứa** `gradient` (`expect(surfaceValue).not.toMatch(/gradient/i)`).
        3. Xác minh `--surface-elevated:` được định nghĩa.
        4. Xác minh tỷ lệ tương phản WCAG AA `>= 4.5:1` giữa `--accent` và `--accent-foreground` (hoặc default trong `base.css`).
        5. Xác minh tỷ lệ tương phản WCAG AA `>= 4.5:1` giữa `--surface` (khi là mã hex `#RRGGBB`) và `--text-primary` (khi là mã hex `#RRGGBB`).
      - Xác minh cả `:root.theme-orchid` và `:root.theme-daylight` đều được khai báo `color-scheme: light` trong `base.css`.

- **`[MODIFY]` [src/app/features/chat/hooks/useTheme.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/hooks/useTheme.ts)** (~50 dòng):
  - Import `THEME_IDS`, `THEME_TONES`, `getThemeTone`, `DEFAULT_THEME` trực tiếp từ `@/lib/config/theme-config` (xóa đoạn `THEME_CONFIG.reduce` trùng lặp ở dòng `10-16`).
  - Trong `useEffect` (chạy ở client khi `mounted` và `currentTheme` thay đổi):
    - Tính `const tone = getThemeTone(currentTheme);`
    - Gán `document.documentElement.dataset.themeTone = tone;` (`"light"` hoặc `"dark"`).
    - Gán `document.documentElement.style.colorScheme = tone;` để thanh cuộn gốc và native controls của trình duyệt đồng bộ tức thì.

- **`[MODIFY]` [src/app/styles/themes/\_shared/base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css)** (~210 dòng):
  - **Hợp nhất duy nhất khối `@theme` tại dòng `5-38`** (không tạo `@theme` thứ hai ở `tokens.css`): bổ sung các alias `--color-surface: var(--surface)`, `--color-surface-muted: var(--surface-muted)`, `--color-surface-elevated: var(--surface-elevated)`, `--color-text-primary: var(--text-primary)`, `--color-text-secondary: var(--text-secondary)` vào khối `@theme` sẵn có. _(Lưu ý: trong JSX, các component vẫn bắt buộc dùng cú pháp `bg-(--surface)`, `text-(--text-primary)` theo đúng `.agents/rules/03-ui.md:30-35`)._
  - Trên `:root`: bổ sung `--sidebar-width-expanded: 18rem`, `--sidebar-width-expanded-lg: 20rem`, `--sidebar-width-collapsed: 5rem`, `--shadow-color: rgba(0, 0, 0, 0.45)`.
  - Tại dòng `139-141`: cập nhật rule `color-scheme: light` cho cả 2 theme sáng:
    ```css
    :root.theme-orchid,
    :root.theme-daylight {
      color-scheme: light;
    }
    ```
  - Tại dòng `143-169`: bọc selector bằng `:where(:root[data-theme-tone="light"])` và `:where(:root[data-theme-tone="dark"])` (specificity `(0,0,0)`) để chỉ cung cấp fallback mặc định mà **không bao giờ** ghi đè `.theme-<id>` (specificity `(0,1,0)`).
  - Bổ sung khối `@media (prefers-reduced-transparency: reduce)` tắt `backdrop-filter` cho người dùng bật tính năng giảm trong suốt.

- **`[MODIFY]` [src/app/styles/themes/\_shared/tokens.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/tokens.css)** (~75 dòng):
  - Giữ nguyên các class tiện ích hiện có (`.bg-surface`, `.bg-surface-muted`, `.text-primary`, `.text-secondary`, `.border-token`, v.v.) mà **không** khai báo lặp khối `@theme`.
  - Bổ sung class `.theme-icon-invert`:
    ```css
    :root[data-theme-tone="dark"] .theme-icon-invert,
    :root:not([data-theme-tone="light"]) .theme-icon-invert {
      filter: invert(1) brightness(2);
    }
    ```
    Giúp các icon đơn sắc trong danh sách `NEEDS_INVERSION` tự động đảo sang màu trắng trên Dark Mode và giữ nguyên màu mực đen sắc nét trên Light Mode (`daylight`, `orchid`).

- **`[MODIFY]` [src/app/styles/themes/\_shared/utilities.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/utilities.css)** (~315 dòng):
  - Bổ sung 2 cặp class layout riêng biệt (phân tách rõ `padding-left` cho khối nội dung và `left` cho lớp nền `fixed` `ChatThemeBackground.tsx`):
    1. `.workspace-main-offset-expanded` (`md:pl-[calc(var(--sidebar-width-expanded)+var(--sal,0px))] lg:pl-[calc(var(--sidebar-width-expanded-lg)+var(--sal,0px))]`) và `.workspace-main-offset-collapsed` (`md:pl-[calc(var(--sidebar-width-collapsed)+var(--sal,0px))]`).
    2. `.workspace-fixed-left-expanded` (`md:left-[calc(var(--sidebar-width-expanded)+var(--sal,0px))] lg:left-[calc(var(--sidebar-width-expanded-lg)+var(--sal,0px))]`) và `.workspace-fixed-left-collapsed` (`md:left-[calc(var(--sidebar-width-collapsed)+var(--sal,0px))]`).
  - Giữ nguyên `.custom-scrollbar` (dòng `283-305`) và cập nhật `.glass-panel`, `.glass-card` tôn trọng `@media (prefers-reduced-transparency: reduce)`.

- **`[NEW]` `src/app/styles/themes/focus-themes.css`** (~240 dòng):
  - Chứa toàn bộ 9 theme nhóm `Focus`:
    1. `.theme-daylight` (**NEW — Light Mode**): `--surface: #faf9f5`, `--surface-gradient: linear-gradient(180deg, #faf9f5 0%, #f3f1ea 100%)`, `--surface-strong: #f0eee6`, `--surface-muted: #ffffff`, `--surface-elevated: #f3f1ea`, `--surface-hover: rgba(20, 20, 19, 0.05)`, `--border: rgba(20, 20, 19, 0.12)`, `--control-bg: rgba(20, 20, 19, 0.04)`, `--control-bg-hover: rgba(20, 20, 19, 0.08)`, `--control-border: rgba(20, 20, 19, 0.15)`, `--text-primary: #141413` (16.5:1), `--text-secondary: #575653` (6.8:1), `--accent: #2563eb`, `--accent-foreground: #ffffff` (5.17:1), `--glow: rgba(37, 99, 235, 0.15)`, `--overlay: rgba(15, 23, 42, 0.45)`.
    2. `.theme-blueprint`, `.theme-amber`, `.theme-indigo`, `.theme-charcoal`, `.theme-pitch-black`, `.theme-gold`, `.theme-red`, `.theme-rose`: Bảo toàn bảng màu đặc trưng, đảm bảo mọi theme đều định nghĩa `--surface` (`#RRGGBB`), `--surface-elevated`, `--accent`, `--accent-foreground` đạt chuẩn tương phản WCAG 2.2 AA `>= 4.5:1`.

- **`[NEW]` `src/app/styles/themes/glass-themes.css`** (~210 dòng):
  - Chứa toàn bộ 5 theme nhóm `Glassmorphism`: `.theme-nebula`, `.theme-aqua`, `.theme-holo`, `.theme-orchid` (Light Glass: `--surface: #fdf4ff`, `--surface-elevated: rgba(255, 255, 255, 0.92)`, `--text-primary: #2e1065`, `--text-secondary: #4c1d95`, `--accent: #7e22ce`, `--accent-foreground: #ffffff` đạt tương phản **6.82:1**), và `.theme-sunset` (tối ưu hóa từ 41 lớp gradient xuống 6 lớp mesh gradient mượt mà).

- **`[NEW]` `src/app/styles/themes/ra2-themes.css`** (~120 dòng):
  - Chứa toàn bộ 3 theme nhóm `Red Alert 2`: `.theme-yuri`, `.theme-allied`, `.theme-soviet`.
  - **Sửa dứt điểm lỗi `--surface` chứa `gradient`**:
    - `.theme-yuri`: `--surface: #120924;` + `--surface-gradient: radial-gradient(...), linear-gradient(160deg, #0b0614 0%, #190a2c 55%, #2a0f3d 100%);`
    - `.theme-allied`: `--surface: #071936;` + `--surface-gradient: radial-gradient(...), linear-gradient(160deg, #030b1c 0%, #0a2246 55%, #0f3156 100%);`
    - `.theme-soviet`: `--surface: #210808;` + `--surface-gradient: radial-gradient(...), linear-gradient(160deg, #140404 0%, #2b0909 55%, #420e0e 100%);`

- **`[MODIFY]` [src/app/globals.css](file:///c:/Users/wyemh/vikini/src/app/globals.css)** (~30 dòng):
  - Thay thế 16 dòng `@import "./styles/themes/..."` rời rạc bằng 3 dòng `@import` tới `./styles/themes/focus-themes.css`, `./styles/themes/glass-themes.css`, và `./styles/themes/ra2-themes.css`.

- **`[DELETE]` 16 file CSS theme đơn lẻ đã được hợp nhất**:
  - `src/app/styles/themes/focus/blueprint.css`
  - `src/app/styles/themes/focus/amber.css`
  - `src/app/styles/themes/focus/indigo.css`
  - `src/app/styles/themes/focus/charcoal.css`
  - `src/app/styles/themes/focus/pitch-black.css`
  - `src/app/styles/themes/focus/gold.css`
  - `src/app/styles/themes/focus/red.css`
  - `src/app/styles/themes/focus/rose.css`
  - `src/app/styles/themes/glassmorphism/nebula.css`
  - `src/app/styles/themes/glassmorphism/aqua.css`
  - `src/app/styles/themes/glassmorphism/holo.css`
  - `src/app/styles/themes/glassmorphism/orchid.css`
  - `src/app/styles/themes/glassmorphism/sunset.css`
  - `src/app/styles/themes/ra2/yuri.css`
  - `src/app/styles/themes/ra2/allied.css`
  - `src/app/styles/themes/ra2/soviet.css`

#### 5.2. Tầng Layout Store & Unified WorkspaceShell

- **`[NEW]` `src/lib/store/layoutStore.ts`** (~65 dòng):
  - Quản lý trạng thái khung Layout toàn cục:

    ```ts
    export const SIDEBAR_COLLAPSED_STORAGE_KEY = "vikini-layout-sidebar-collapsed";

    export interface LayoutState {
      sidebarOpen: boolean;
      sidebarCollapsed: boolean;
      hasHydrated: boolean;
      setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
      toggleSidebarOpen: () => void;
      setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
      toggleSidebarCollapsed: () => void;
      hydrateLayout: () => void;
    }
    ```

  - Khi `setSidebarCollapsed` hoặc `toggleSidebarCollapsed` được gọi ở client, tự động ghi `"true"` / `"false"` vào `localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, ...)` (bọc trong `try/catch` an toàn).
  - `hydrateLayout()` đọc `localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)` một lần duy nhất sau khi mount (chỉ nhận `"true"` → `true`, mọi giá trị khác hoặc lỗi đều giữ `false`) và đặt `hasHydrated: true`.

- **`[NEW]` `src/lib/store/layoutStore.test.ts`** (~120 dòng):
  - Unit test co-located kiểm thử đầy đủ: khởi tạo mặc định (`sidebarOpen: false`, `sidebarCollapsed: false`, `hasHydrated: false`), `toggleSidebarCollapsed` cập nhật state + ghi `localStorage`, `setSidebarCollapsed` nhận cả boolean và updater function `(prev) => !prev`, `hydrateLayout()` khôi phục đúng trạng thái từ `localStorage` và xử lý an toàn khi `localStorage` ném ngoại lệ hoặc chứa dữ liệu rác.

- **`[NEW]` `src/app/features/layout/components/WorkspaceShell.tsx`** (~110 dòng):
  - Component khung vỏ thống nhất cho toàn bộ các route của ứng dụng:
    ```tsx
    export interface WorkspaceShellProps {
      sidebar?: React.ReactNode;
      header?: React.ReactNode;
      background?: React.ReactNode;
      overlays?: React.ReactNode;
      sidebarCollapsed?: boolean;
      viewportMode?: "fixed" | "scrollable"; // "fixed" (h-dvh overflow-hidden) | "scrollable" (min-h-dvh)
      className?: string;
      contentClassName?: string;
      children: React.ReactNode;
    }
    ```
  - Tự động gọi `useLayoutStore((s) => s.hydrateLayout)` trong `useEffect` khi mount.
  - Áp dụng class `.workspace-main-offset-collapsed` / `.workspace-main-offset-expanded` tại một nơi duy nhất cho cột nội dung chính.

- **`[MODIFY]` [src/app/features/chat/components/hooks/useChatLayoutState.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatLayoutState.ts)** (~60 dòng):
  - Thay thế `useState(false)` cục bộ của `mobileOpen` và `sidebarCollapsed` bằng state và actions từ `useLayoutStore` (`sidebarOpen` ánh xạ sang `mobileOpen`, `setSidebarOpen`, `toggleSidebarOpen`, `sidebarCollapsed`, `toggleSidebarCollapsed`).
  - **Bảo toàn chính xác 100% interface `UseChatLayoutStateReturn`** hiện có tại dòng `11-21`:
    `{ mobileOpen, sidebarCollapsed, showMobileControls, closeMobileSidebar, toggleMobileSidebar, handleContentTap, memoizedOnToggleCollapse, memoizedOnLogoClick }` để `ChatApp.tsx` hoạt động không cần đổi tên biến.

- **`[MODIFY]` [src/app/features/gallery/components/hooks/useGalleryController.ts](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/hooks/useGalleryController.ts)** (~375 dòng):
  - Thay thế `const [mobileOpen, setMobileOpen] = useState(false)` và `const [sidebarCollapsed, setSidebarCollapsed] = useState(false)` cục bộ tại dòng `62-63` bằng state/actions từ `useLayoutStore` (`mobileOpen: sidebarOpen`, `setMobileOpen: setSidebarOpen`, `sidebarCollapsed`, `setSidebarCollapsed`), giữ nguyên shape trả về tại dòng `353-356` cho `GalleryView.tsx`.

- **`[MODIFY]` [src/app/features/layout/components/HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx)** (~275 dòng):
  - Khôi phục nút mở menu trên mobile: đổi `hidden p-2 ...` ở dòng `89` thành `md:hidden flex h-10 w-10 items-center justify-center rounded-xl text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)`.
  - Đổi `text-(--surface)` trên nút New Chat (`bg-(--accent)`) ở dòng `104` thành `text-(--accent-foreground)`.
  - Thay thế toàn bộ `text-[10px]` (dòng `173`, `225`, `244`, `249`) bằng `text-xs`.
  - Trong menu chọn Theme (cả Desktop dòng `178-193` và Mobile dòng `254-269`), hiển thị thêm badge phân biệt `Light` cho các theme có `tItem.tone === "light"` (`daylight`, `orchid`) bên cạnh ô màu `tItem.swatch`.

- **`[MODIFY]` [src/app/features/chat/components/ChatThemeBackground.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatThemeBackground.tsx)** (~40 dòng):
  - Thay chuỗi `sidebarCollapsed ? "md:left-[calc(5rem+var(--sal,0px))]" : "md:left-[calc(18rem+var(--sal,0px))] lg:left-[calc(20rem+var(--sal,0px))]"` ở dòng `31` bằng `.workspace-fixed-left-collapsed` / `.workspace-fixed-left-expanded` (sử dụng thuộc tính `left` kết hợp `transition-[left] duration-300`), đảm bảo `backgroundPosition: "center center"` luôn căn huy hiệu RA2 chính giữa vùng khung chat bên phải Sidebar.

- **`[MODIFY]` [src/app/features/chat/components/LandingDisclaimer.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/LandingDisclaimer.tsx)** (~22 dòng):
  - Thay chuỗi `md:pl-[calc(...)]` ở dòng `16` bằng `.workspace-main-offset-collapsed` / `.workspace-main-offset-expanded`.

- **`[MODIFY]` 5 Route Views để sử dụng `WorkspaceShell` & `useLayoutStore`**:
  1. **[src/app/features/chat/components/ChatApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx)** (~365 dòng): Bọc khung chính bằng `<WorkspaceShell>`, gỡ bỏ `<FloatingMenuTrigger />`.
  2. **[src/app/features/image-gen/components/ImageGenStudio.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/ImageGenStudio.tsx)** (~325 dòng): Dùng `useLayoutStore` cho `mobileOpen` / `sidebarCollapsed`, bọc bằng `<WorkspaceShell>`, gỡ `<FloatingMenuTrigger />`.
  3. **[src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx)** (~315 dòng): Dùng `useLayoutStore` cho `mobileOpen` / `sidebarCollapsed`, bọc bằng `<WorkspaceShell viewportMode="fixed">`, gỡ `<FloatingMenuTrigger />`.
  4. **[src/app/features/image-gen/components/DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx)** (~295 dòng sau khi tách hook): Dùng `useLayoutStore` + `<WorkspaceShell>`, gỡ `<FloatingMenuTrigger />`.
  5. **[src/app/features/gallery/components/GalleryView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.tsx)** (~285 dòng sau khi tách modal): Dùng `<WorkspaceShell>` kết hợp `g.sidebarCollapsed` / `g.mobileOpen` từ `useGalleryController`, gỡ `<FloatingMenuTrigger />`.

#### 5.3. Tách Module Các Component Vượt Ngưỡng 400–500 Dòng (`.agents/rules/01-coding.md`)

1. **Module hóa `Sidebar.tsx` (từ 644 dòng xuống ~255 dòng, bám sát 100% cấu trúc thật)**:
   - **`[NEW]` `src/app/features/sidebar/components/SidebarButton.tsx`** (~70 dòng): Tách `SidebarButtonProps` và component `React.memo(function SidebarButton(...))` từ `Sidebar.tsx:101-161`.
   - **`[NEW]` `src/app/features/sidebar/components/SidebarNavRail.tsx`** (~110 dòng): Tách khối điều hướng `navButtons` từ `Sidebar.tsx:286-361`, bảo toàn đầy đủ các nút thực tế: Chat (`/`), Explore GEMs (`handleOpenGems`), Manage Personas (`handleOpenPersonas` qua `usePersonaStore`), nút GEMs kèm Tooltip khi `isCollapsed`, Novelcrafter (`/novelcrafter`), Image Studio (`/images`), Describe Image (`/describe` khi đang ở `/images`), và Gallery (`/gallery`).
   - **`[NEW]` `src/app/features/sidebar/components/SidebarFooter.tsx`** (~75 dòng): Tách khối Footer Actions từ `Sidebar.tsx:490-535`, bảo toàn chính xác 4 nút thực tế: `onDeleteAll` (`Trash2`), nút đóng/mở rộng Sidebar trên Desktop (`PanelLeftOpen` / `PanelLeftClose` gọi `onToggleCollapse`), nút Admin (`session?.user?.rank === "admin"` → `/admin`), và nút `onLogout` (`LogOut`).
   - **`[NEW]` `src/app/features/sidebar/components/SidebarMobileDrawer.tsx`** (~95 dòng): Tách khối Mobile Gesture Drawer dùng Radix `Dialog.Root` từ `Sidebar.tsx:557-630` (bao gồm `shouldCloseDrawer`, header mobile với Logo `V` gọi `onLogoClick` & `onCloseMobile`, nút đóng `X`, và `children` render nội dung Sidebar).
   - **`[MODIFY]` [src/app/features/sidebar/components/Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx)** (~255 dòng): Giữ nguyên 100% `SidebarProps`, kết nối `SidebarButton` (New Chat CTA), `SidebarNavRail`, danh sách Projects (`SidebarSection` + `ProjectNode`), danh sách Your Chats (`SidebarSection` + `SidebarItem`), `SidebarFooter`, Desktop `<aside>` (giảm `backdrop-blur-3xl` xuống `backdrop-blur-xl`), `SidebarMobileDrawer`, và `CreateProjectModal`.

2. **Module hóa `ChatBubble.tsx` (từ 430 dòng xuống ~275 dòng, không trùng lặp với `BubbleHelpers.tsx` & `markdownConfig.ts`)**:
   - Giữ nguyên việc sử dụng `extractThinking` từ `markdownConfig.ts:12` và `<ThinkingBlock>` từ `BubbleHelpers.tsx:64`.
   - **`[NEW]` `src/app/features/chat/components/BubbleInlineEditor.tsx`** (~65 dòng): Tách khối chỉnh sửa tin nhắn trực tiếp (`isEditing` tại `ChatBubble.tsx:117-123, 202-235`), nhận props `{ initialContent, onSave, onCancel, t }`.
   - **`[NEW]` `src/app/features/chat/components/BubbleAssistantFooter.tsx`** (~110 dòng): Tách toàn bộ khối hiển thị phụ trợ bên dưới nội dung bong bóng Assistant (`ChatBubble.tsx:303-378`): `ImageGenPreview` + khung loading skeleton (`303-320`), `SourceLinks` (`322-334`), `TokenBadge` (`336-347`), và cụm badge trạng thái `isPartial` / `interrupted` / `stopped` / `isSaving` / `saveFailed` (`349-377`).
   - **`[MODIFY]` [src/app/features/chat/components/ChatBubble.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx)** (~275 dòng): Giữ nguyên 100% `ChatBubbleProps`, `ChatMessage`, `MessageMeta`; render `BubbleInlineEditor` và `BubbleAssistantFooter`.

3. **Module hóa `DescribeImageView.tsx` (từ 442 dòng xuống ~295 dòng)**:
   - **`[NEW]` `src/app/features/image-gen/components/hooks/useDescribeHistory.ts`** (~125 dòng): Đóng gói kiểu `DescribeHistoryItem`, hàm tạo ảnh thu nhỏ `createThumbnail(dataUrl: string)` bằng `<canvas>`, và các thao tác đọc/ghi/xóa lịch sử trong `localStorage` (bọc `try/catch`).
   - **`[MODIFY]` [src/app/features/image-gen/components/DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx)** (~295 dòng):
     - Gọi `useDescribeHistory()`, bọc layout bằng `<WorkspaceShell>` và `useLayoutStore`.
     - Thay 3 chuỗi tiếng Anh hardcode trong `toast.error(...)` ở dòng `90`, `94`, `187` bằng `t("describeInvalidFile")`, `t("describeFileTooLarge")`, `t("describeCopyFailed")`.
     - Thay `text-[10px]` ở dòng `427` bằng `text-xs`.

4. **Module hóa `GalleryView.tsx` (từ 435 dòng xuống ~285 dòng)**:
   - **`[NEW]` `src/app/features/gallery/components/GalleryDetailModal.tsx`** (~145 dòng): Tách toàn bộ Dialog xem chi tiết ảnh, hiển thị thông số prompt/model/aspect-ratio, sao chép prompt, Remix và xác nhận xóa ảnh.
   - **`[MODIFY]` [src/app/features/gallery/components/GalleryView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.tsx)** (~285 dòng): Render thanh công cụ lọc/tìm kiếm, lưới ảnh và `<GalleryDetailModal />` bên trong `<WorkspaceShell>`.

#### 5.4. Chuẩn Hóa Contrast, Typography & Sửa Lỗi UI Components (`.agents/rules/03-ui.md`, `04-bilingual.md`)

- **`[MODIFY]` [src/app/features/chat/components/ChatControls.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatControls.tsx)** (~320 dòng):
  - Tinh chỉnh khu vực điều khiển phía trên khung nhập liệu thành **Unified Composer Island** gọn gàng, dùng nền `bg-(--surface)/95` (nay đã hoạt động hoàn hảo trên cả RA2 nhờ sửa `--surface`), chuẩn hóa khoảng cách và typography `text-xs`.
- **`[MODIFY]` [src/app/features/chat/components/ModelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ModelSelector.tsx)** (~320 dòng):
  - Tại dòng `171, 193`: giữ nguyên biến điều kiện `const needsInvert = NEEDS_INVERSION.has(pid);` và đổi `${needsInvert ? "invert brightness-200" : ""}` thành `${needsInvert ? "theme-icon-invert" : ""}`. Nhờ đó, logo có màu (`gemini`, `deepseek`) không bao giờ bị đảo màu, còn logo đơn sắc (`openai`, `anthropic`, `grok`, `groq`, `openrouter`) chỉ đảo sang trắng trên Dark Mode và giữ nguyên màu đen trên Light Mode (`daylight`, `orchid`).
  - Đổi `text-(--surface)` ở dòng `322` thành `text-(--accent-foreground)`.
  - Nâng toàn bộ `text-[10px]` (dòng `106, 120, 142, 151, 199, 209, 241, 264`) lên `text-xs`.
- **`[MODIFY]` [src/app/features/chat/components/ThinkingLevelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx)** (~120 dòng):
  - Đổi `text-[10px]` ở dòng `96` thành `text-xs`, và đổi `text-(--surface)` ở dòng `114` thành `text-(--accent-foreground)`.
- **`[MODIFY]` [src/app/features/chat/components/CommandPalette.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/CommandPalette.tsx)** (~210 dòng) & **[src/app/features/chat/components/ScrollToBottomButton.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ScrollToBottomButton.tsx)** (~64 dòng):
  - Thay thế `text-[11px]` (`CommandPalette.tsx:167,198`) và `text-[10px]` (`ScrollToBottomButton.tsx:51`) bằng `text-xs`.
- **`[MODIFY]` [src/app/features/chat/components/StreamErrorBanner.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/StreamErrorBanner.tsx)** (~92 dòng):
  - Khôi phục icon `<AlertTriangle className="h-4 w-4 text-(--danger) shrink-0" />` ở dòng `69` và `<X className="h-3.5 w-3.5" />` ở dòng `80` (hiện đang là thẻ `<span>` rỗng).
- **`[MODIFY]` [src/app/features/chat/components/SmartCode.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/SmartCode.tsx)** (~191 dòng) & **[src/app/features/chat/components/BubbleAvatar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/BubbleAvatar.tsx)** (~148 dòng):
  - Trong `SmartCode.tsx:149`: thay `scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20` bằng class chuẩn `custom-scrollbar` (đã định nghĩa tại `utilities.css:283-305`).
  - Trong `BubbleAvatar.tsx:47,49`: thay `rgba(var(--accent-rgb,59,130,246),0.1)` (biến không tồn tại) bằng `color-mix(in srgb, var(--accent) 14%, transparent)`.
- **`[MODIFY]` [src/app/features/projects/components/ProjectChatView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/projects/components/ProjectChatView.tsx)** (~239 dòng):
  - Thay `z-9999` ở dòng `174` bằng `z-(--z-modal)`.
- **`[MODIFY]` [src/app/components/AccessPendingScreen.tsx](file:///c:/Users/wyemh/vikini/src/app/components/AccessPendingScreen.tsx)** (~65 dòng) & **[src/app/auth/signin/page.tsx](file:///c:/Users/wyemh/vikini/src/app/auth/signin/page.tsx)** (~140 dòng):
  - Thay thế các class màu hardcode (`bg-[#0a0a0a]`, `from-gray-900 via-purple-900`, `text-gray-400`) bằng semantic tokens (`bg-(--surface)`, `text-(--text-primary)`, `text-(--text-secondary)`, `border-(--border)`).
  - Trong `src/app/auth/signin/page.tsx`: nâng `text-[10px]` tại dòng `40`, `48`, và `123` lên `text-xs`.
- **`[MODIFY]` [src/lib/utils/translations/vi.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts)** & **[src/lib/utils/translations/en.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts)**:
  - Bổ sung khóa tên theme `daylight` (VI: `"Ánh Sáng Ban Ngày (Daylight)"`, EN: `"Daylight"`) tại khu vực `// Theme names` (dòng `55`).
  - Bổ sung 3 khóa i18n cho `DescribeImageView.tsx` tại khu vực `// QW-C: Describe Image` (dòng `525`):
    - `describeInvalidFile`: VI `"Vui lòng tải lên tệp hình ảnh hợp lệ"` / EN `"Please upload a valid image file"`
    - `describeFileTooLarge`: VI `"Kích thước tệp phải nhỏ hơn 10MB"` / EN `"File size must be under 10MB"`
    - `describeCopyFailed`: VI `"Không thể sao chép vào bộ nhớ tạm"` / EN `"Failed to copy to clipboard"`
- **`[MODIFY]` [docs/architecture.md](file:///c:/Users/wyemh/vikini/docs/architecture.md)**:
  - Cập nhật Living Documentation phản ánh kiến trúc 3-Tier Theme Engine (17 themes trong 3 file họ theme), `WorkspaceShell`, `useLayoutStore`, và số dòng thực tế của `ChatApp.tsx`, `Sidebar.tsx`, `ChatBubble.tsx`.

---

### 6. Các Bước Thực Hiện Tuần Tự (Sequential Implementation Checklist)

- [ ] **Bước 1 — Nâng cấp Cấu hình Theme & Song ngữ (`theme-config.ts`, `vi.ts`, `en.ts`)**:
  - [ ] Cập nhật `src/lib/config/theme-config.ts`: thêm phần tử `{ id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" }` vào `THEME_CONFIG`, xuất thêm `THEME_TONES` và `getThemeTone()`.
  - [ ] Bổ sung các khóa dịch `daylight`, `describeInvalidFile`, `describeFileTooLarge`, `describeCopyFailed` vào cả `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`.
- [ ] **Bước 2 — Tái cấu trúc Hệ thống CSS Design Tokens (`_shared/*` & 3 file họ Theme)**:
  - [ ] Cập nhật `src/app/styles/themes/_shared/base.css`: hợp nhất đầy đủ biến màu vào khối `@theme` duy nhất (dòng `5-38`), thêm biến chiều rộng Sidebar, cập nhật `:root.theme-orchid, :root.theme-daylight { color-scheme: light; }`, bọc `:where(:root[data-theme-tone])` để triệt tiêu lỗi specificity `(0,2,0)`, thêm `@media (prefers-reduced-transparency: reduce)`.
  - [ ] Cập nhật `src/app/styles/themes/_shared/tokens.css`: thêm `.theme-icon-invert` (không tạo khối `@theme` trùng lặp).
  - [ ] Cập nhật `src/app/styles/themes/_shared/utilities.css`: thêm `.workspace-main-offset-expanded` / `.workspace-main-offset-collapsed` (`padding-left`) và `.workspace-fixed-left-expanded` / `.workspace-fixed-left-collapsed` (`left`).
  - [ ] Tạo mới `src/app/styles/themes/focus-themes.css` (9 themes bao gồm `.theme-daylight`), `src/app/styles/themes/glass-themes.css` (5 themes, chuẩn hóa contrast `.theme-orchid` và tối ưu gradient `.theme-sunset`), và `src/app/styles/themes/ra2-themes.css` (3 themes, tách riêng `--surface` màu đặc và `--surface-gradient`).
  - [ ] Cập nhật `src/app/globals.css` trỏ tới 3 file mới và xóa 16 file CSS theme đơn lẻ cũ.
  - [ ] Cập nhật `src/app/features/chat/hooks/useTheme.ts` đồng bộ `document.documentElement.dataset.themeTone` và `colorScheme`.
  - [ ] Cập nhật `src/lib/config/theme-config.test.ts` để kiểm thử đầy đủ 17 themes, `getThemeTone()`, và chạy bộ kiểm thử `WCAG 2.2 Contrast & Token Integrity` trên 3 file CSS gộp.
- [ ] **Bước 3 — Xây dựng `useLayoutStore` & `WorkspaceShell` (`layoutStore.ts`, `WorkspaceShell.tsx`)**:
  - [ ] Tạo `src/lib/store/layoutStore.ts` và unit test co-located `src/lib/store/layoutStore.test.ts`.
  - [ ] Tạo `src/app/features/layout/components/WorkspaceShell.tsx` tích hợp `hydrateLayout()` và class offset Sidebar tập trung.
  - [ ] Cập nhật `src/app/features/chat/components/hooks/useChatLayoutState.ts` (giữ nguyên `UseChatLayoutStateReturn`), `src/app/features/gallery/components/hooks/useGalleryController.ts`, `ChatThemeBackground.tsx` (dùng `.workspace-fixed-left-*`), `LandingDisclaimer.tsx` (dùng `.workspace-main-offset-*`), và `HeaderBar.tsx` (khôi phục nút mở menu mobile `md:hidden h-10 w-10`, hiển thị badge Light/Dark trong menu Theme, sửa `text-(--accent-foreground)` và `text-xs`).
- [ ] **Bước 4 — Module hóa 4 Component vượt ngưỡng LOC & Tích hợp `WorkspaceShell`**:
  - [ ] Tách `Sidebar.tsx` (644 dòng) thành `SidebarButton.tsx`, `SidebarNavRail.tsx`, `SidebarFooter.tsx`, `SidebarMobileDrawer.tsx` và `Sidebar.tsx` (~255 dòng).
  - [ ] Tách `ChatBubble.tsx` (430 dòng) thành `BubbleInlineEditor.tsx`, `BubbleAssistantFooter.tsx` và `ChatBubble.tsx` (~275 dòng, giữ nguyên `extractThinking` và `ThinkingBlock`).
  - [ ] Tách `DescribeImageView.tsx` (442 dòng) thành `hooks/useDescribeHistory.ts` và `DescribeImageView.tsx` (~295 dòng, dùng `WorkspaceShell`, sửa 3 chuỗi i18n và `text-xs`).
  - [ ] Tách `GalleryView.tsx` (435 dòng) thành `GalleryDetailModal.tsx` và `GalleryView.tsx` (~285 dòng, dùng `WorkspaceShell`).
  - [ ] Chuyển `ChatApp.tsx`, `ImageGenStudio.tsx`, và `NovelcrafterStudioApp.tsx` sang sử dụng `WorkspaceShell` và `useLayoutStore`.
- [ ] **Bước 5 — Chuẩn hóa UI, Contrast & Sửa lỗi Anti-patterns (`03-ui.md`)**:
  - [ ] Cập nhật `ModelSelector.tsx` (dùng `needsInvert ? "theme-icon-invert" : ""`, `text-(--accent-foreground)`, `text-xs`), `ThinkingLevelSelector.tsx`, `ChatControls.tsx`, `CommandPalette.tsx`, `ScrollToBottomButton.tsx`.
  - [ ] Khôi phục icon `AlertTriangle` và `X` trong `StreamErrorBanner.tsx`, sửa `BubbleAvatar.tsx`, `SmartCode.tsx` (dùng `custom-scrollbar`), `ProjectChatView.tsx` (`z-(--z-modal)`), `AccessPendingScreen.tsx`, và `auth/signin/page.tsx` (sửa semantic tokens và `text-xs` ở dòng `40, 48, 123`).
- [ ] **Bước 6 — Cập nhật Living Documentation & Chạy Cổng Kiểm Chứng Toàn Diện**:
  - [ ] Cập nhật `docs/architecture.md`.
  - [ ] Chạy `npm run verify` (`type-check && lint && test:run`) đảm bảo pass 100% với 0 lỗi.

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Để chống **Specification Gaming** và đảm bảo `@qa` đối soát khách quan, kế hoạch thiết lập các hợp đồng kiểm thử bắt buộc sau:

#### TC-01: Hợp đồng Cấu hình Theme, Phân loại Tone & Quét Tương Phản CSS Thực Tế (`src/lib/config/theme-config.test.ts`)

- **Input**:
  - Các export thực tế từ `src/lib/config/theme-config.ts`: `THEME_CONFIG`, `THEME_IDS`, `DEFAULT_THEME`, `getThemeById`, `THEME_TONES`, `getThemeTone`, cùng nội dung các file CSS thực tế trong `src/app/styles/themes/` (`focus-themes.css`, `glass-themes.css`, `ra2-themes.css`, `_shared/base.css`).
- **Expected Output**:
  - `THEME_CONFIG.length === 17` và `THEME_IDS.length === 17` (`Focus`: 9, `Glassmorphism`: 5, `Red Alert 2`: 3), `DEFAULT_THEME === "blueprint"`.
  - `getThemeById("daylight")` trả về `{ id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" }`.
  - `getThemeTone("daylight") === "light"` và `getThemeTone("orchid") === "light"`; 15 theme còn lại trả về `"dark"`.
  - Với mọi `theme` trong `THEME_CONFIG` (17 themes), bài test quét file CSS thực tế xác nhận:
    1. Tồn tại selector `.theme-${theme.id}` trong `focus-themes.css`, `glass-themes.css` hoặc `ra2-themes.css`.
    2. Thuộc tính `--surface:` được định nghĩa và **không khớp** `/gradient/i`.
    3. Thuộc tính `--surface-elevated:` được định nghĩa.
    4. Tỷ lệ tương phản WCAG 2.2 AA giữa `--accent` và `--accent-foreground` đạt `>= 4.5`.
    5. `:root.theme-orchid` và `:root.theme-daylight` đều có `color-scheme: light` trong `_shared/base.css`.
- **Failure Modes & Boundary Conditions**:
  - Truyền `undefined`, `null`, chuỗi rỗng `""`, hoặc `"unknown-theme"` vào `getThemeTone()` phải trả về fallback an toàn `"dark"` mà không ném ngoại lệ; `getThemeById("unknown-theme")` trả về `undefined`.
- **Pass/Fail Criteria**:
  - Pass khi 100% assertions trong `src/lib/config/theme-config.test.ts` vượt qua trên dữ liệu thật và file CSS thật. Cấm mock `fs.readFileSync` hoặc `theme-config.ts`.

#### TC-02: Hợp đồng State Layout & SSR-Safe Hydration (`src/lib/store/layoutStore.test.ts`)

- **Input**:
  - Các action `setSidebarOpen`, `toggleSidebarOpen`, `setSidebarCollapsed`, `toggleSidebarCollapsed`, `hydrateLayout` trên `useLayoutStore`.
- **Expected Output**:
  - Trạng thái khởi tạo mặc định (trước khi gọi `hydrateLayout`): `sidebarOpen === false`, `sidebarCollapsed === false`, `hasHydrated === false`.
  - Khi gọi `setSidebarCollapsed(true)`: `useLayoutStore.getState().sidebarCollapsed === true` và `localStorage.getItem("vikini-layout-sidebar-collapsed") === "true"`.
  - Khi gọi `setSidebarCollapsed((prev) => !prev)`: đảo giá trị hiện tại chính xác và đồng bộ xuống `localStorage`.
  - Khi `localStorage` có sẵn `"true"` và gọi `hydrateLayout()`: `sidebarCollapsed` cập nhật thành `true` và `hasHydrated === true`.
- **Failure Modes & Boundary Conditions**:
  - Nếu `localStorage.getItem` chứa chuỗi rác (`"corrupted_value"`, `null`) khi gọi `hydrateLayout()`: `sidebarCollapsed` phải giữ giá trị boolean an toàn (`false`) và `hasHydrated` vẫn chuyển sang `true`.
  - Nếu `localStorage.setItem` ném lỗi `QuotaExceededError` hoặc `SecurityError`: hàm `setSidebarCollapsed` bắt lỗi êm (graceful catch), vẫn cập nhật state trong bộ nhớ mà không làm crash React render tree.
- **Pass/Fail Criteria**:
  - Pass khi toàn bộ test cases (bao gồm cả negative test giả lập `localStorage` throw error) trong `src/lib/store/layoutStore.test.ts` xanh 100%.

#### TC-03: Hợp đồng Bảo Toàn Chữ Ký Hooks & Tích Hợp CSS Layout (`useChatLayoutState.ts`, `useGalleryController.ts`, `ChatThemeBackground.tsx`)

- **Input**:
  - Giá trị trả về của `useChatLayoutState({ onNavigateHome })` và `useGalleryController()`, cùng class của `ChatThemeBackground.tsx`.
- **Expected Output**:
  - `useChatLayoutState` trả về đúng các khóa `{ mobileOpen, sidebarCollapsed, showMobileControls, closeMobileSidebar, toggleMobileSidebar, handleContentTap, memoizedOnToggleCollapse, memoizedOnLogoClick }` đồng bộ với `useLayoutStore`.
  - `useGalleryController` trả về `mobileOpen`, `setMobileOpen`, `sidebarCollapsed`, `setSidebarCollapsed` đồng bộ với `useLayoutStore`.
  - `ChatThemeBackground.tsx` sử dụng `.workspace-fixed-left-collapsed` / `.workspace-fixed-left-expanded` (thuộc tính `left`) để căn tâm huy hiệu RA2 chính xác.
- **Pass/Fail Criteria**:
  - Kiểm chứng qua `npm run type-check` (0 lỗi kiểu) và probe tĩnh xác nhận không còn `md:pl-[calc(18rem` hay `md:left-[calc(18rem` copy-paste thủ công trong `src/app/features/`.

#### TC-04: Hợp đồng Giới Hạn Kích Thước File & Chuẩn UI/i18n (`.agents/rules/01-coding.md`, `03-ui.md`, `04-bilingual.md`)

- **Input**:
  - Các file được tạo mới hoặc chỉnh sửa trong phạm vi kế hoạch.
- **Expected Output**:
  - `Sidebar.tsx`, `ChatBubble.tsx`, `DescribeImageView.tsx`, `GalleryView.tsx` và mọi file `[NEW]` đều có số dòng **<= 380 dòng** (dưới ngưỡng mục tiêu 400 dòng và cách xa trần cứng 500 dòng).
  - Không còn `text-[10px]`, `text-[11px]`, hoặc `z-9999` trong các file thuộc phạm vi chỉnh sửa (`HeaderBar.tsx`, `ModelSelector.tsx`, `ThinkingLevelSelector.tsx`, `CommandPalette.tsx`, `ScrollToBottomButton.tsx`, `DescribeImageView.tsx`, `ProjectChatView.tsx`, `signin/page.tsx`).
  - Không còn chuỗi tiếng Anh hardcode trong `toast.error(...)` tại `DescribeImageView.tsx`.
  - Song ngữ `vi.ts` và `en.ts` biên dịch thành công qua kiểm tra kiểu `_AssertTranslationsParity` (`npm run type-check` = 0 errors).

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 8.1. Co-Located Unit Tests

1. **`[MODIFY]` `src/lib/config/theme-config.test.ts`**:
   - Kiểm thử cấu trúc 17 themes trong `THEME_CONFIG` & `THEME_IDS`, `getThemeById()`, `THEME_TONES`, `getThemeTone()` (bao gồm boundary cases `undefined`, `""`, `"unknown-theme"`), và bộ kiểm thử `WCAG 2.2 Contrast & Token Integrity` đọc trực tiếp từ `focus-themes.css`, `glass-themes.css`, `ra2-themes.css`, `_shared/base.css`.
2. **`[NEW]` `src/lib/store/layoutStore.test.ts`**:
   - Kiểm thử đầy đủ state transitions của `useLayoutStore`, tính năng lưu/đọc `localStorage`, tính năng updater function, và khả năng chịu lỗi khi `localStorage` bị khóa hoặc chứa dữ liệu hỏng.

#### 8.2. Lệnh Chạy Kiểm Chứng Tự Động (Verification Commands)

Chạy cổng chất lượng chuẩn của dự án:

```powershell
npm run verify
```

_(Bao gồm tuần tự: `npm run type-check` → `npm run lint` → `npm run test:run`)_.

#### 8.3. Wiring & Negative Probes (Kiểm Chứng Đấu Nối & Dọn Sạch Code Cũ)

Sau khi hoàn tất triển khai, thực thi các phép kiểm tra tĩnh để xác nhận:

1. **Kiểm tra không còn chuỗi offset Sidebar copy-paste thủ công** ngoài `utilities.css`:
   - Tìm kiếm `md:pl-[calc(18rem` và `md:left-[calc(18rem` trong `src/app/features/` phải trả về **0 kết quả**.
2. **Kiểm tra không còn `--surface` chứa `gradient`**:
   - Tìm kiếm `--surface:\s*(radial|linear)-gradient` trong `src/app/styles/` phải trả về **0 kết quả**.
3. **Kiểm tra kích thước dòng (LOC) của 4 file đã refactor**:
   - `Sidebar.tsx`, `ChatBubble.tsx`, `DescribeImageView.tsx`, `GalleryView.tsx` đều **< 380 dòng**.

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risks & Technical Mitigations)

| Rủi Ro Tiềm Ẩn                                                                                   |   Mức Độ   | Phương Án Phòng Ngừa & Kiểm Soát Kỹ Thuật Cụ Thể Trong Code                                                                                                                                                                                                                                                                                          |
| :----------------------------------------------------------------------------------------------- | :--------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Lỗi React 19 Hydration Mismatch khi lưu trạng thái `sidebarCollapsed` vào `localStorage`**  |    Cao     | **Technical Control**: Trong `src/lib/store/layoutStore.ts`, khởi tạo mặc định `sidebarCollapsed: false` giống hệt trên cả Server lẫn lần render đầu tiên ở Client. Chỉ đọc `localStorage` bên trong `useEffect` của `WorkspaceShell.tsx` thông qua `hydrateLayout()`.                                                                               |
| **2. Specificity của selector `data-theme-tone` ghi đè mất màu riêng của từng theme `.theme-*`** |    Cao     | **Technical Control**: Trong `src/app/styles/themes/_shared/base.css`, bọc selector bằng `:where(:root[data-theme-tone="light"])` (specificity `0,0,0`) để mọi class `.theme-<name>` (specificity `0,1,0`) luôn luôn thắng tuyệt đối.                                                                                                                |
| **3. Người dùng cũ đã lưu tên theme trong `localStorage` bị mất theme sau khi gom file CSS**     | Trung bình | **Technical Control**: Bảo toàn 100% cả 16 tên class `.theme-<id>` và các mã `id` trong `THEME_CONFIG` / `THEME_IDS`; chỉ hợp nhất vật lý 16 file CSS nhỏ thành 3 file `focus-themes.css`, `glass-themes.css`, `ra2-themes.css`.                                                                                                                     |
| **4. Đứt gãy luồng Props khi tách nhỏ `Sidebar.tsx` (644 dòng) và `ChatBubble.tsx` (430 dòng)**  | Trung bình | **Technical Control**: Giữ nguyên 100% interface `SidebarProps` của `Sidebar.tsx` và `ChatBubbleProps` của `ChatBubble.tsx`. Các sub-components (`SidebarButton`, `SidebarNavRail`, `SidebarFooter`, `SidebarMobileDrawer`, `BubbleInlineEditor`, `BubbleAssistantFooter`) nhận props tường minh với kiểu TypeScript strict mode (không dùng `any`). |
| **5. Lệch khóa dịch giữa `vi.ts` và `en.ts` khi thêm theme `daylight` và các khóa `describe*`**  |    Thấp    | **Technical Control**: Kiểm soát trực tiếp bởi assertion kiểu `_AssertTranslationsParity` trong `src/lib/utils/translations/index.ts:26-34` khi chạy `npm run type-check`.                                                                                                                                                                           |

---

## Audit History

<!-- Lịch sử thẩm định của @reviewer (Claude Code CLI) sẽ được tự động ghi nhận tại đây. -->

### Audit Run 1

`[REVIEWER_MODEL: gemini-4-argon]`

- **Reviewer**: `@reviewer` (Fallback Lead Architecture Reviewer)
- **Revision được thẩm định**: Revision 1
- **Thời gian**: 2026-10-16

---

#### 1. Kiểm Chứng Lỗi Cũ

Đây là lượt thẩm định đầu tiên (`Audit Run 1`), không có danh sách lỗi cũ từ các lượt trước.

---

#### 2. Phát Hiện Mới

##### `[MAJOR-01]` Sai lệch hợp đồng API của `src/lib/config/theme-config.ts` và Test Contract `TC-01` so với mã nguồn thực tế

- **Vị trí trong Plan**: Mục 5.1 (dòng `214-243`), Mục 6 Bước 1 (dòng `416-417`), Mục 7 `TC-01` (dòng `449-460`), Mục 9 Rủi ro 3 (dòng `528`).
- **Bằng chứng trên code thật (`[SRC]`)**:
  - Tại [theme-config.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.ts#L1-L43), module hiện xuất:
    - `THEME_CONFIG: ThemeDefinition[]` (mỗi phần tử gồm `{ id: string, labelKey: TranslationKey, group: "Glassmorphism" | "Focus" | "Red Alert 2", swatch: string, tone: ThemeTone }`)
    - `THEME_IDS: string[]`
    - `DEFAULT_THEME = "blueprint"`
    - `getThemeById(id: string): ThemeDefinition | undefined`
  - Các consumer đang import trực tiếp `THEME_CONFIG` gồm:
    - [providers.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/providers.tsx#L8-L18) (`THEME_CONFIG.reduce(...)` tạo `themeMap` truyền vào `ThemeProvider` của `next-themes`).
    - [HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L9-L52) (`THEME_CONFIG.reduce(...)` gom nhóm theo `theme.group` `"Focus" | "Glassmorphism" | "Red Alert 2"` và `THEME_CONFIG.find(...)`).
    - [useTheme.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/hooks/useTheme.ts#L3-L16) (`THEME_CONFIG.map(...)`, `THEME_CONFIG.reduce(...)`).
    - [theme-config.test.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.test.ts#L4-L135) (`THEME_CONFIG`, `THEME_IDS`, `DEFAULT_THEME`, `getThemeById`).
  - Trong khi đó, kế hoạch tại Mục 5.1 và `TC-01` lại giả định `theme-config.ts` xuất `THEME_GROUPS = { focus: [...], glassmorphism: [...], ra2: [...] }` và `ALL_THEMES` (vốn không tồn tại trong codebase), đồng thời không đề cập việc thêm phần tử `{ id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" }` vào `THEME_CONFIG: ThemeDefinition[]`.
  - Ngoài ra, [theme-config.test.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.test.ts#L55-L134) hiện đang có bộ kiểm thử đọc trực tiếp các file CSS trong `src/app/styles/themes/` để tính tỷ lệ tương phản WCAG 2.2 AA và kiểm tra `:root.theme-orchid { color-scheme: light; }` trong `base.css:128-133`. Nếu thay thế `theme-config.test.ts` chỉ bằng các assertion của `TC-01` hiện tại mà làm mất bài test quét CSS thật hoặc không cập nhật rule `:root.theme-daylight` trong `base.css:139-141`, độ phủ kiểm thử tương phản CSS thực tế sẽ bị suy giảm hoặc gãy test.
- **Yêu cầu sửa trong Plan**:
  - Cập nhật Mục 5.1, Bước 1 và `TC-01` bám sát cấu trúc thật của `src/lib/config/theme-config.ts` (`THEME_CONFIG: ThemeDefinition[]`, `THEME_IDS`, `DEFAULT_THEME`, `getThemeById`, bổ sung `getThemeTone` / `THEME_TONES` nếu cần mà vẫn giữ nguyên `THEME_CONFIG`).
  - Giữ lại và mở rộng bài test quét file CSS thực tế (`WCAG 2.2 Contrast & Token Integrity`) trong `src/lib/config/theme-config.test.ts:55-134` cho đủ 17 themes (bao gồm kiểm tra `--surface` không chứa `gradient` và tỷ lệ tương phản `>= 4.5:1`).
  - Lưu ý khóa dịch trong `vi.ts:50-65` và `en.ts:52-67`: `ThemeDefinition` hiện chỉ sử dụng `labelKey: TranslationKey` (không có trường `descKey` trong `ThemeDefinition`). Nếu thêm `daylightDesc`, cần làm rõ nơi sử dụng hoặc chỉ định rõ trong `ThemeDefinition`.

##### `[MAJOR-02]` Tham chiếu tới file không tồn tại `src/app/features/settings/components/SettingsModal.tsx` và chữ ký hook sai lệch tại `useChatLayoutState.ts`

- **Vị trí trong Plan**: Mục 5.1 (dòng `236`), Mục 5.2 (dòng `344-345`), Mục 5.4 (dòng `404-405`), Mục 6 Bước 2 (dòng `425`).
- **Bằng chứng trên code thật (`[SRC]`)**:
  1. File `src/app/features/settings/components/SettingsModal.tsx` được đánh nhãn `[MODIFY]` ở Mục 5.4 (dòng `404`) **không tồn tại** trong repo. Thực tế, giao diện chọn Theme và Ngôn ngữ nằm trong [HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L148-L274) (dùng `tItem.swatch` từ `THEME_CONFIG`).
  2. Tại Mục 5.2 (dòng `345`), kế hoạch mô tả chữ ký trả về của `useChatLayoutState.ts` gồm `sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, settingsOpen, setSettingsOpen, gemsModalOpen, setGemsModalOpen, ragModalOpen, setRagModalOpen`. Đối chiếu với code thật tại [useChatLayoutState.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatLayoutState.ts#L11-L21) và [ChatApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx#L198-L200,L271-L293), interface `UseChatLayoutStateReturn` thực tế là:
     `{ mobileOpen, sidebarCollapsed, showMobileControls, closeMobileSidebar, toggleMobileSidebar, handleContentTap, memoizedOnToggleCollapse, memoizedOnLogoClick }`.
- **Yêu cầu sửa trong Plan**:
  - Xóa mục `[MODIFY] src/app/features/settings/components/SettingsModal.tsx`; chuyển phần hiển thị badge `Light`/`Dark` hoặc swatch sang `src/app/features/layout/components/HeaderBar.tsx`.
  - Cập nhật mô tả `[MODIFY] src/app/features/chat/components/hooks/useChatLayoutState.ts` khớp với interface `UseChatLayoutStateReturn` thật (`mobileOpen`, `sidebarCollapsed`, `closeMobileSidebar`, `toggleMobileSidebar`, `memoizedOnToggleCollapse`, `handleContentTap`, `memoizedOnLogoClick`).

##### `[MAJOR-03]` Thiết kế tách module `Sidebar.tsx`, `ChatBubble.tsx` và `GalleryView.tsx` tại Mục 5.3 lệch với cấu trúc code thực tế

- **Vị trí trong Plan**: Mục 5.2 (dòng `360`), Mục 5.3 (dòng `364-381`), Mục 6 Bước 4 (dòng `431-434`).
- **Bằng chứng trên code thật (`[SRC]`)**:
  1. **Đối với `Sidebar.tsx` (Mục 5.3.1, dòng `364-368`)**:
     - Kế hoạch dự kiến tách `SidebarSearchFilter.tsx` (_"ô tìm kiếm hội thoại và thanh cuộn ngang chọn Tag filter"_) và `SidebarFooter.tsx` (_"Command Palette `⌘K`, Keyboard Shortcuts, Settings, Language Switcher `VI/EN`, và nút Sign Out có bước xác nhận 3 giây"_).
     - Kiểm tra [Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx#L1-L644):
       - Trong `Sidebar.tsx` **không có** ô tìm kiếm hội thoại hay bộ lọc Tag nào (icon `Search` ở dòng `30, 347` chỉ dùng cho nút điều hướng `/describe` — `t("describeTitle")`).
       - Khu vực Footer thực tế (dòng `490-535`) chỉ chứa 4 nút: `onDeleteAll` (`Trash2`), nút đóng/mở rộng Sidebar (`PanelLeftOpen`/`PanelLeftClose`), nút Admin (`session?.user?.rank === "admin"` → `/admin`), và nút `onLogout` (`LogOut`).
       - Khu vực Navigation thực tế (dòng `286-361`) có nút `handleOpenPersonas` (`openPersonaModal` từ `usePersonaStore`, dòng `193, 240, 304-310`), nhưng kế hoạch ở dòng `365` không nhắc tới `Personas` mà ghi thành `Knowledge Base`.
       - Các khối thực sự chiếm nhiều dòng trong `Sidebar.tsx` là: `SidebarButton` (dòng `101-161`, 61 dòng), khối điều hướng `navButtons` (dòng `286-361`, 76 dòng), khối danh sách Projects + Your Chats (dòng `395-488`, 94 dòng), và Mobile Gesture Drawer `Dialog.Root` (dòng `557-630`, 74 dòng).
  2. **Đối với `ChatBubble.tsx` (Mục 5.3.2, dòng `370-373`)**:
     - Kế hoạch dự kiến tạo mới `BubbleReasoningPanel.tsx` (~110 dòng, chứa `extractThinkingContent` và UI khối `<think>`) cùng `BubbleInlineEditor.tsx` (~95 dòng) để giảm `ChatBubble.tsx` từ 430 dòng xuống ~240 dòng.
     - Kiểm tra [ChatBubble.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx#L12-L15,L149-L166,L202-L242), [markdownConfig.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/markdownConfig.ts#L12-L53) và [BubbleHelpers.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/BubbleHelpers.tsx#L64-L120):
       - Hàm `extractThinking(text: string)` đã tồn tại ở `markdownConfig.ts:12-53` và component `<ThinkingBlock content={thought} t={t} />` đã tồn tại ở `BubbleHelpers.tsx:64-120`. Tạo thêm `BubbleReasoningPanel.tsx` sẽ gây trùng lặp code với 2 module sẵn có này.
       - Trong `ChatBubble.tsx`, phần gọi `extractThinking` (dòng `149-166`) và `<ThinkingBlock>` (dòng `240-242`) chỉ chiếm **21 dòng**, và khối `isEditing` (dòng `202-235`) chỉ chiếm **33 dòng**. Tách 2 phần này chỉ giảm được ~54 dòng (430 - 54 = ~376 dòng), chưa đạt mức ~240 dòng như kế hoạch nêu. Để giảm `ChatBubble.tsx` xuống dưới 300 dòng mà không tạo code trùng lặp, cần giữ nguyên việc dùng `extractThinking`/`ThinkingBlock` và tách `BubbleInlineEditor.tsx` kèm phần hiển thị phụ trợ của bong bóng assistant (khối image preview / sources / token badge / partial-interrupted status badges tại dòng `303-378`, dài 76 dòng).
  3. **Đối với `GalleryView.tsx` (Mục 5.2 dòng `360` & Mục 5.3.4 dòng `379-381`)**:
     - Trong [GalleryView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.tsx#L37,L46-L57), `g.sidebarCollapsed` và `g.mobileOpen` đang được cung cấp bởi hook [useGalleryController.ts](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/hooks/useGalleryController.ts#L62-L63,L353-L356) (dài 382 dòng, vượt ngưỡng 350 dòng cho Custom Hook theo `.agents/rules/01-coding.md`). Kế hoạch chưa liệt kê `[MODIFY] src/app/features/gallery/components/hooks/useGalleryController.ts` để chuyển sang `useLayoutStore` (hoặc loại bỏ `mobileOpen`/`sidebarCollapsed` cục bộ khỏi `useGalleryController.ts`).
- **Yêu cầu sửa trong Plan**:
  - Sửa lại Mục 5.3.1 (`Sidebar.tsx`) để tách đúng các thành phần có thật trong `Sidebar.tsx` (ví dụ: `SidebarNavRail.tsx` giữ đủ Chat/Gems/Personas/Novelcrafter/Image Studio/Describe/Gallery, `SidebarMobileDrawer.tsx` cho khối Radix Dialog gesture drawer dòng `557-630`, `SidebarFooter.tsx` cho 4 nút thực tế DeleteAll/Collapse/Admin/Logout), bảo toàn toàn bộ props và hành vi hiện có.
  - Sửa lại Mục 5.3.2 (`ChatBubble.tsx`): không tạo `BubbleReasoningPanel.tsx` trùng lặp với `markdownConfig.ts` và `BubbleHelpers.tsx`; thay bằng tách `BubbleInlineEditor.tsx` và component phụ trợ (ví dụ `BubbleStatusFooter.tsx` / `BubbleAttachmentsAndMeta.tsx` cho dòng `303-378`).
  - Bổ sung `[MODIFY] src/app/features/gallery/components/hooks/useGalleryController.ts` vào Mục 5.2.

##### `[MAJOR-04]` Lỗi lệch tâm huy hiệu RA2 khi áp dụng `.workspace-main-offset-*` (`padding-left`) cho `ChatThemeBackground.tsx`

- **Vị trí trong Plan**: Mục 5.2 (dòng `352-353`), Mục 6 Bước 3 (dòng `429`).
- **Bằng chứng trên code thật (`[SRC]`)**:
  - Tại [ChatThemeBackground.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatThemeBackground.tsx#L30-L39):
    ```tsx
    <div
      className={`fixed top-0 left-0 right-0 bottom-0 z-0 pointer-events-none transition-[left] duration-300 ${sidebarCollapsed ? "md:left-[calc(5rem+var(--sal,0px))]" : "md:left-[calc(18rem+var(--sal,0px))] lg:left-[calc(20rem+var(--sal,0px))]"}`}
      style={{
        backgroundImage: `url('/assets/themes/${theme}.png')`,
        backgroundSize: theme === "allied" ? "38%" : "35%",
        backgroundPosition: "center center",
    ```
  - Thẻ `div` này dùng `backgroundImage` với `backgroundPosition: "center center"`. Trong CSS, `background-position` mặc định căn theo `padding-box` (`background-origin: padding-box`). Do đó, `ChatThemeBackground.tsx` hiện dùng thuộc tính **`left` (`md:left-[calc(...)]`)** và `transition-[left]` để thu hẹp hộp `fixed` sang bên phải Sidebar. Nếu thay bằng `.workspace-main-offset-collapsed` / `.workspace-main-offset-expanded` (vốn dùng `padding-left`), `padding-box` vẫn trải rộng từ mép trái màn hình (`left: 0`), làm huy hiệu RA2 bị lệch tâm về phía dưới Sidebar.
- **Yêu cầu sửa trong Plan**:
  - Trong `utilities.css` và `ChatThemeBackground.tsx`, tách riêng class dịch cạnh trái bằng thuộc tính `left` (ví dụ `.workspace-fixed-left-collapsed` / `.workspace-fixed-left-expanded` dùng `left: calc(...)` + `transition-[left]`) hoặc thêm `backgroundOrigin: "content-box"` nếu dùng `padding-left`.

##### `[MAJOR-05]` Xung đột khai báo `@theme` giữa `base.css` và `tokens.css` & lỗi điều kiện `.theme-icon-invert` trong `ModelSelector.tsx`

- **Vị trí trong Plan**: Bảng A.1 (dòng `27`), Mục 5.1 (dòng `257-259`), Mục 5.4 (dòng `387-388`).
- **Bằng chứng trên code thật (`[SRC]`)**:
  1. Tại [base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css#L5-L38), đã tồn tại khối `@theme { ... --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground); ... }`. Kế hoạch tại Mục 5.1 (dòng `257-258`) lại yêu cầu khai báo mới khối `@theme inline` trong `tokens.css` với các biến trùng tên (`--color-accent`, `--color-accent-foreground`) mà không nêu rõ việc hợp nhất hoặc xóa khối `@theme` trùng trong `base.css:5-38`. Đồng thời, cần lưu ý [.agents/rules/03-ui.md](file:///c:/Users/wyemh/vikini/.agents/rules/03-ui.md#L30-L35) cấm sử dụng các class `bg-primary`, `bg-background`, `bg-card`, `bg-muted` trong component.
  2. Tại [ModelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ModelSelector.tsx#L171,L193), code thực tế là:
     ```tsx
     const needsInvert = NEEDS_INVERSION.has(pid);
     ...
     className={`object-contain drop-shadow-sm transition-colors ${needsInvert ? "invert brightness-200" : ""}`}
     ```
     Kế hoạch ở dòng `388` ghi: _"Thay `NEEDS_INVERSION.has(model.icon) ? "invert brightness-200" : ""` ở dòng `193` bằng `"theme-icon-invert"`"_. Trong `ModelSelector.tsx` không có `model.icon` (biến là `pid` và `needsInvert`), và nếu bỏ điều kiện `needsInvert ? "theme-icon-invert" : ""` mà gán thẳng `"theme-icon-invert"` cho mọi provider, thì cả 2 logo có màu của `gemini` và `deepseek` (không nằm trong `NEEDS_INVERSION`) cũng sẽ bị đảo thành màu trắng trên tất cả 15 Dark Themes.
- **Yêu cầu sửa trong Plan**:
  - Làm rõ việc hợp nhất khối `@theme` giữa `base.css:5-38` và `tokens.css` để không khai báo trùng lặp.
  - Trong `ModelSelector.tsx:193`, giữ nguyên điều kiện `needsInvert`: `${needsInvert ? "theme-icon-invert" : ""}`.

##### `[MINOR-01]` Sót chuỗi hardcode tiếng Anh, cỡ chữ `text-[10px]` và class scrollbar không tồn tại trong các file thuộc phạm vi sửa đổi

- **Vị trí trong Plan**: Mục 5.4 (dòng `398-403`).
- **Bằng chứng trên code thật (`[SRC]`)**:
  1. Tại [DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx#L90,L94,L187,L427):
     - Dòng `90` (`toast.error("Please upload an image file")`), dòng `94` (`toast.error("File size must be under 10MB")`), và dòng `187` (`toast.error("Failed to copy")`) đang hardcode chuỗi tiếng Anh (vi phạm `.agents/rules/04-bilingual.md`).
     - Dòng `427` vẫn còn `text-[10px]` (`<p className="text-[10px] text-(--text-secondary) mt-1">`).
  2. Tại [signin/page.tsx](file:///c:/Users/wyemh/vikini/src/app/auth/signin/page.tsx#L40,L48,L123):
     - Dòng `40`, `48`, `123` đang dùng `text-[10px]`, cần được liệt kê để đổi sang `text-xs`.
  3. Tại [SmartCode.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/SmartCode.tsx#L149):
     - Kế hoạch ở dòng `398` nêu thay `scrollbar-thumb-white/10` bằng `scrollbar-thin`, nhưng trong [utilities.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/utilities.css#L283-L305) class scrollbar chuẩn của dự án là `custom-scrollbar` (không có định nghĩa `.scrollbar-thin`).

---

#### 3. Mental Simulation Verification Matrix

| Kịch Bản                                     | Trạng Thái | Loại Bằng Chứng  | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------------------- | :--------: | :--------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**                   |  **FAIL**  | `[CMD]`, `[SRC]` | Baseline hiện tại pass `npm run type-check` (exit 0) và `npx vitest run src/lib/config/theme-config.test.ts` (20/20 pass). Tuy nhiên kế hoạch tham chiếu file không tồn tại `src/app/features/settings/components/SettingsModal.tsx` (`[MAJOR-02]`) và lệch cấu trúc export của `src/lib/config/theme-config.ts` (`[MAJOR-01]`), sẽ gây lỗi import/build nếu thực thi nguyên trạng.                                       |
| **S2: Runner Lifecycle & Teardown**          |  **PASS**  |     `[SRC]`      | Phạm vi kế hoạch chỉ tác động tầng UI/Theme/Layout state, không sửa đổi SSE stream controller hay kết nối DB/Redis. Các `useEffect` trong `LanguageUpdater.tsx:14-35`, `FloatingMenuTrigger.tsx:26-31`, `SmartCode.tsx:61-67` đều quản lý cleanup đúng chuẩn.                                                                                                                                                             |
| **S3: Database & Temporal Logic**            |  **PASS**  | `[SRC]`, `[ADV]` | Không có thay đổi schema DB hay migration SQL (`Mục 3.5`). Lưu trữ trạng thái `sidebarCollapsed` và `vikini-describe-history` chỉ dùng `localStorage` phía client, có kiểm soát lỗi `try/catch` trong `TC-02`.                                                                                                                                                                                                            |
| **S4: Cross-Task State Flow**                |  **FAIL**  |     `[SRC]`      | Phát hiện 3 điểm lệch trạng thái/cấu trúc giữa kế hoạch và code thật: (1) `useChatLayoutState.ts:11-21` lệch tên thuộc tính trả về (`[MAJOR-02]`), (2) `Sidebar.tsx:1-644` và `ChatBubble.tsx:1-430` có cấu trúc con khác với mô tả tách file ở Mục 5.3 (`[MAJOR-03]`), (3) `useGalleryController.ts:62-63` giữ state `sidebarCollapsed`/`mobileOpen` cục bộ nhưng chưa được đưa vào danh sách `[MODIFY]` (`[MAJOR-03]`). |
| **S5: Security Boundary & 3-Tier Auth**      |  **PASS**  | `[SRC]`, `[ADV]` | Không chạm tới API routes (`src/app/api/`), `supabase.server.ts` hay Redis rate limit. Các màn hình `AccessPendingScreen.tsx:1-66` và `auth/signin/page.tsx:1-154` chỉ thay đổi class CSS sang semantic tokens, giữ nguyên luồng `handleGoogleSignIn()` và `/api/auth/signout`.                                                                                                                                           |
| **S6: External Resilience & Serverless Cap** |  **PASS**  |     `[SRC]`      | Không thay đổi cấu hình `maxDuration` hay logic gọi provider AI. Việc khôi phục icon `<AlertTriangle>` và `<X>` trong `StreamErrorBanner.tsx:69,80` giúp hiển thị rõ thông báo lỗi stream/rate-limit cho người dùng.                                                                                                                                                                                                      |
| **Domain: Open Inquiry (Vikini)**            |  **FAIL**  |     `[SRC]`      | Phát hiện lỗi điều kiện `.theme-icon-invert` trong `ModelSelector.tsx:193` làm đảo màu sai logo `gemini`/`deepseek` (`[MAJOR-05]`), lỗi lệch tâm emblem RA2 trong `ChatThemeBackground.tsx:31` (`[MAJOR-04]`), và sót chuỗi hardcode chưa qua `useLanguage()` trong `DescribeImageView.tsx:90,94,187` (`[MINOR-01]`).                                                                                                     |

---

#### 4. Claim Verification (Kiểm Chứng Khẳng Định Kỹ Thuật)

1. **Khẳng định về lỗi `--surface` chứa `radial-gradient` trong nhóm theme RA2**:
   - **Xác minh (`[SRC]`)**: Chính xác. Tại [yuri.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/ra2/yuri.css#L6-L8), `--surface` được gán `radial-gradient(...), linear-gradient(...)`. Khi kết hợp với `bg-(--surface)/95` tại [ChatControls.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatControls.tsx#L150) hoặc `bg-(--surface)` (sinh `background-color: var(--surface)`), trình duyệt đánh giá không hợp lệ vì `background-color` chỉ nhận `<color>`. Giải pháp tách `--surface` (`<color>`) và `--surface-gradient` (`<image>`) là hợp lệ.
2. **Khẳng định về `:where()` và `@media (prefers-reduced-transparency: reduce)`**:
   - **Xác minh (`[URL]`, `[SRC]`)**: Theo tài liệu MDN (`https://developer.mozilla.org/en-US/docs/Web/CSS/:where`, `https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency`), pseudo-class `:where()` luôn có specificity `(0,0,0)`, đảm bảo `:where(:root[data-theme-tone="light"])` không ghi đè `.theme-<name>` `(0,1,0)`. Tuy nhiên cần đồng bộ với các rule `:root.theme-*` đang có tại [base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css#L121-L141) và test tại [theme-config.test.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.test.ts#L128-L133).
3. **Khẳng định về `@theme inline` trong Tailwind CSS v4**:
   - **Xác minh (`[URL]`, `[SRC]`)**: Theo tài liệu Tailwind CSS v4 (`https://tailwindcss.com/docs/theme`), `@theme inline` cho phép trỏ utility sang biến CSS động mà không khóa chết giá trị tại `:root`. Tuy nhiên [base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css#L5-L38) đã có sẵn khối `@theme`, nên cần hợp nhất thay vì khai báo chồng chéo ở `tokens.css` (`[MAJOR-05]`).
4. **Kiểm toán Bảng Rủi Ro (Risk Table Audit — Mục 9)**:
   - Rủi ro 1 (Cao — React 19 Hydration Mismatch): Có control rõ ràng (`hydrateLayout()` trong `useEffect` tương tự `LanguageUpdater.tsx:14-26`) và có `TC-02` kiểm chứng.
   - Rủi ro 2 (Cao — Specificity `data-theme-tone`): Có control `:where(...)` và `TC-03` kiểm chứng.
   - Rủi ro 3 (Trung bình — Mất theme cũ trong `localStorage`): Mô tả control hiện nhắc tới `THEME_GROUPS` không khớp code thật (`[MAJOR-01]`), cần sửa lại thành `THEME_CONFIG` và `THEME_IDS`.
   - Rủi ro 4 (Trung bình — Đứt gãy luồng Props khi tách `Sidebar.tsx` và `ChatBubble.tsx`): Mô tả sub-components hiện lệch với code thật (`[MAJOR-03]`), cần cập nhật lại danh sách sub-components khớp với `Sidebar.tsx` và `ChatBubble.tsx`.

---

#### 5. Adversarial Timelines (Kịch Bản Đối Kháng)

```
Cơ chế 1: SSR Hydration & Đồng bộ localStorage cho useLayoutStore (Trục 1: Đồng thời / Trục 4: Serverless SSR)
T1: Next.js Server render trang ChatApp/GalleryView với useLayoutStore mặc định (sidebarCollapsed = false, hasHydrated = false) → trả HTML có class .workspace-main-offset-expanded.
T2: Trình duyệt (Client) có sẵn localStorage["vikini-layout-sidebar-collapsed"] = "true". React 19 chạy hydrateRoot() ở pha render đầu tiên (trước useEffect).
T3: Vì useLayoutStore chỉ đọc localStorage trong useEffect (qua hydrateLayout()), lần render đầu tiên ở Client vẫn giữ sidebarCollapsed = false (khớp với HTML từ Server) → sau khi mount, useEffect chạy hydrateLayout() chuyển sidebarCollapsed = true và cập nhật padding.
Kết cục: Không xảy ra lỗi React 19 Hydration Mismatch; khi chuyển route client-side qua <Link> giữa /, /images, /gallery, /describe, /novelcrafter, store singleton trong bộ nhớ giữ nguyên sidebarCollapsed = true mà không bị reset → AN TOÀN.
```

```
Cơ chế 2: Chuyển đổi Theme & Specificity CSS giữa data-theme-tone và .theme-<id> (Trục 2: TOCTOU / Trạng thái DOM)
T1: Người dùng chọn theme "yuri" (tone "dark") hoặc "orchid" (tone "light"). next-themes gắn class .theme-yuri (specificity 0,1,0) lên <html>.
T2: useEffect trong useTheme.ts gắn attribute data-theme-tone="dark" (hoặc "light") lên <html>.
T3: Trình duyệt tính toán cascade giữa selector fallback :where(:root[data-theme-tone="dark"]) (specificity 0,0,0) trong base.css và .theme-yuri (specificity 0,1,0) trong ra2-themes.css.
Kết cục: Các biến màu riêng của .theme-yuri (specificity 0,1,0) luôn thắng :where(...) (specificity 0,0,0), trong khi các biến phụ không khai báo trong .theme-yuri nhận giá trị fallback từ :where(...) → AN TOÀN.
```

- **Trục 3 (Thất bại giữa chừng / Lỗi bộ nhớ trình duyệt)**: Khi trình duyệt bật chế độ chặn Storage (Safari Private Mode / `SecurityError` hoặc `QuotaExceededError` khi ghi `localStorage`), lệnh `localStorage.setItem` trong `useLayoutStore` hoặc `useDescribeHistory` được bọc trong `try/catch` (`TC-02`), state trong RAM vẫn cập nhật bình thường mà không làm sập cây component React.

---

#### 6. Commands Executed

1. `npm run type-check` — Exit code: `0` (0 errors).
2. `npx vitest run src/lib/config/theme-config.test.ts` — Exit code: `0` (1 passed file, 20 passed tests).
3. `npm run lint` — Exit code: `0` (0 errors, 3 pre-existing warnings in `ChapterEditorWorkspace.tsx`).

---

#### 7. Kết Luận

Kế hoạch phân tích đúng các nguyên nhân gốc rễ về CSS (`--surface` chứa gradient trong RA2, specificity của `:root[data-theme-tone]`, thiếu Light Mode `daylight`, lặp layout shell ở 7 nơi). Tuy nhiên, phần đặc tả chi tiết tại Mục 5, Mục 6 và Mục 7 có **5 lỗi `[MAJOR]`** do lệch hợp đồng code thật (`theme-config.ts`, `SettingsModal.tsx` không tồn tại, chữ ký `useChatLayoutState.ts`, cấu trúc tách file của `Sidebar.tsx` / `ChatBubble.tsx` / `useGalleryController.ts`, lỗi căn tâm `ChatThemeBackground.tsx`, và điều kiện `.theme-icon-invert` trong `ModelSelector.tsx`) cùng **1 lỗi `[MINOR]`**. Đề nghị `@planner` cập nhật Revision 2 giải quyết các mục trên trước khi cấp quyền triển khai.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

- **Ngày thẩm định**: 2026-10-16
- **Đối tượng**: Kế hoạch triển khai (Revision 2) — Hệ thống Theme & Kiến trúc Layout (`docs/plans/2026-10-16-theme-and-layout-remake-implementation-plan.md`)
- **Trạng thái Plan Completeness Gate**: **PASS** (Đủ 5/5 thành phần cốt lõi: Verified Versions 2026, Sequential Checklist `[NEW]`/`[MODIFY]`, Verification Plan, Test Contract `TC-01`..`TC-05`, Assumptions & Cross-Task Dependencies).

---

#### 1. Kiểm Chứng Lỗi Cũ (Verification of Previous Audit Findings)

| Mã Lỗi (Run 1)   | Trạng Thái | Bằng Chứng Kiểm Chứng Trên Code Thật (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :--------------- | :--------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`[MAJOR-01]`** | **ĐÃ SỬA** | `[SRC]` Đối chiếu với [theme-config.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.ts#L1-L43) và [theme-config.test.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.test.ts#L1-L135): Revision 2 (Mục 3.2 dòng `186-187`, Mục 5.1 dòng `216-249`, Mục 7 `TC-01` dòng `487-503`) đã giữ nguyên `THEME_CONFIG: ThemeDefinition[]`, `THEME_IDS`, `DEFAULT_THEME = "blueprint"`, `getThemeById(id)`, bổ sung `{ id: "daylight", labelKey: "daylight", swatch: "#2563eb", group: "Focus", tone: "light" }`, xuất thêm `THEME_TONES` và `getThemeTone()`. Đồng thời giữ nguyên và mở rộng bài test quét thực tế các file CSS (`WCAG 2.2 Contrast & Token Integrity across 17 CSS Themes`, kiểm tra `--surface` không chứa `gradient`, có `--surface-elevated`, và rule `:root.theme-orchid, :root.theme-daylight { color-scheme: light; }` tại [base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css#L139-L141)).                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`[MAJOR-02]`** | **ĐÃ SỬA** | `[SRC]` (1) Đã gỡ bỏ file không tồn tại `src/app/features/settings/components/SettingsModal.tsx` khỏi kế hoạch và chuyển huy hiệu `Light` về đúng nơi render menu chọn theme thực tế tại [HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L178-L193) và [HeaderBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/HeaderBar.tsx#L254-L269) (Mục 5.2 dòng `377`). (2) Đặc tả `useChatLayoutState.ts` tại Mục 5.2 (dòng `365-368`) và `TC-03` (dòng `523`) đã khớp với chữ ký `UseChatLayoutStateReturn` trong [useChatLayoutState.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatLayoutState.ts#L11-L21) (`{ mobileOpen, sidebarCollapsed, showMobileControls, closeMobileSidebar, toggleMobileSidebar, handleContentTap, memoizedOnToggleCollapse, memoizedOnLogoClick }`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **`[MAJOR-03]`** | **ĐÃ SỬA** | `[SRC]` (1) Đối chiếu với [Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx#L1-L644): Mục 5.3.1 (dòng `394-399`) đã tách đúng các thành phần có thật trong `Sidebar.tsx`: `SidebarButton.tsx` (dòng `101-161`), `SidebarNavRail.tsx` (dòng `286-361`, giữ nguyên Chat, Gems, Personas qua `usePersonaStore`, Tooltip Gems khi thu gọn, Novelcrafter, Image Studio, Describe Image, Gallery), `SidebarFooter.tsx` (dòng `490-535`, giữ nguyên 4 nút `onDeleteAll`, Desktop collapse toggle, Admin `/admin`, `onLogout`), và `SidebarMobileDrawer.tsx` (dòng `557-630`, Radix `Dialog.Root` + gesture drawer). (2) Đối chiếu với [ChatBubble.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx#L1-L430), [markdownConfig.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/markdownConfig.ts#L12) và [BubbleHelpers.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/BubbleHelpers.tsx#L64): Mục 5.3.2 (dòng `401-405`) không tạo trùng `ThinkingBlock`, chỉ tách `BubbleInlineEditor.tsx` (dòng `117-123, 202-235`) và `BubbleAssistantFooter.tsx` (dòng `303-378`). (3) Đã bổ sung `[MODIFY]` [useGalleryController.ts](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/hooks/useGalleryController.ts#L62-L63) vào Mục 5.2 (dòng `370-371`). |
| **`[MAJOR-04]`** | **ĐÃ SỬA** | `[SRC]` Đối chiếu với [ChatThemeBackground.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatThemeBackground.tsx#L30-L39): Mục 5.1 (dòng `282-284`), Mục 5.2 (dòng `379-380`) và `TC-03` (dòng `525`) đã định nghĩa riêng `.workspace-fixed-left-expanded` và `.workspace-fixed-left-collapsed` sử dụng thuộc tính `left: calc(...)` + `transition-[left]` thay vì `padding-left`, giữ nguyên tâm `backgroundPosition: "center center"` cho huy hiệu RA2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **`[MAJOR-05]`** | **ĐÃ SỬA** | `[SRC]` (1) Đối chiếu với [base.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/base.css#L5-L38) và [tokens.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/tokens.css#L1-L39): Mục 5.1 (dòng `258, 271-279`) đã quy định giữ khối `@theme` duy nhất tại `base.css:5-38`, không khai báo khối `@theme` trùng lặp trong `tokens.css` và tuân thủ quy tắc cấm dùng `bg-primary`/`bg-background`/`bg-card`/`bg-muted` của `.agents/rules/03-ui.md:30-35`. (2) Đối chiếu với [ModelSelector.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ModelSelector.tsx#L171,L193): Mục 5.4 (dòng `423`) đã giữ nguyên điều kiện `const needsInvert = NEEDS_INVERSION.has(pid)` và dùng `${needsInvert ? "theme-icon-invert" : ""}` để bảo toàn màu gốc của logo `gemini` và `deepseek`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **`[MINOR-01]`** | **ĐÃ SỬA** | `[SRC]` Đối chiếu với [DescribeImageView.tsx](file:///c:/Users/wyemh/vikini/src/app/features/image-gen/components/DescribeImageView.tsx#L90,L94,L187,L427), [signin/page.tsx](file:///c:/Users/wyemh/vikini/src/app/auth/signin/page.tsx#L40,L48,L123) và [utilities.css](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/utilities.css#L283-L305): Mục 5.3.3 (dòng `411-412`) và Mục 5.4 (dòng `433, 439, 442-445`) đã thay 3 chuỗi hardcode tiếng Anh trong `DescribeImageView.tsx` bằng `t("describeInvalidFile")`, `t("describeFileTooLarge")`, `t("describeCopyFailed")`, nâng các vị trí `text-[10px]` lên `text-xs`, và dùng đúng class `custom-scrollbar` trong `SmartCode.tsx:149`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

#### 2. Phát Hiện Mới (New Findings in Revision 2)

- **Phân loại theo Severity Rubric**: `0 lỗi [BLOCKER]`, `0 lỗi [MAJOR]`, `1 góp ý [MINOR] (Advisory Recommendations)`.

##### `[MINOR-02]` (`[Advisory Recommendations]`) Bổ sung điều kiện `:not(.theme-orchid):not(.theme-daylight)` cho `.theme-icon-invert` trước thời điểm `useEffect` gắn `data-theme-tone`

- **Vị trí trong Plan**: Mục 5.1 (dòng `274-277`).
- **Bằng chứng trên code thật (`[SRC]`)**:
  - Tại [providers.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/providers.tsx#L39-L51), `ThemeProvider` (`next-themes`) gắn class `.theme-orchid` hoặc `.theme-daylight` lên `<html>` ngay từ script đồng bộ trước khi React chạy `useEffect`. Trong khi đó, thuộc tính `document.documentElement.dataset.themeTone` được gán trong `useEffect` tại [useTheme.ts](file:///c:/Users/wyemh/vikini/src/app/features/chat/hooks/useTheme.ts#L16-L31).
  - Trong khoảng thời gian ngắn giữa lúc `next-themes` gắn class `.theme-orchid`/`.theme-daylight` và lúc `useEffect` trong `useTheme.ts` chạy, thẻ `<html>` chưa có `data-theme-tone="light"`, nên selector `:root:not([data-theme-tone="light"]) .theme-icon-invert` sẽ tạm thời khớp.
- **Khuyến nghị khi triển khai**:
  - Viết selector trong `tokens.css` là `:root[data-theme-tone="dark"] .theme-icon-invert, :root:not([data-theme-tone="light"]):not(.theme-orchid):not(.theme-daylight) .theme-icon-invert { filter: invert(1) brightness(2); }` để icon không bị đảo màu trắng ngay từ frame đầu tiên trên 2 Light Themes.

---

#### 3. Các Tấn Công Đã Thử (Adversarial Attacks Attempted)

Để kiểm định độ vững chắc của Revision 2, 4 kịch bản tấn công đối kháng đã được thực hiện trực tiếp trên mã nguồn thật:

1. **Tấn công 1 — Kiểm tra toán học WCAG 2.2 AA Contrast Ratio của bộ mã màu `daylight` mới và `orchid` nâng cấp so với công thức trong `src/lib/config/theme-config.test.ts:7-28`**:
   - **Cách tấn công (`[SRC]`, `[CMD]`)**: Đối chiếu công thức `relativeLuminance(hex)` và `contrastRatio(hex1, hex2)` tại [theme-config.test.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.test.ts#L7-L28) với các cặp màu khai báo ở Mục 5.1 (dòng `286-339`):
     - `daylight`: `--bg` (`#faf9f5`) vs `--text-primary` (`#141413`) đạt tỷ lệ tương phản `~17.4:1` ($\ge 7.0$ AAA); `--bg` (`#faf9f5`) vs `--text-secondary` (`#575653`) đạt `~6.85:1` ($\ge 4.5$ AA); `--surface` (`#ffffff`) vs `--text-secondary` (`#575653`) đạt `~7.21:1` ($\ge 4.5$ AA); `--accent` (`#2563eb`) vs `--accent-foreground` (`#ffffff`) đạt `~5.17:1` ($\ge 4.5$ AA).
     - `orchid`: `--bg` (`#fdf4ff`) vs `--text-primary` (`#2e1065`) đạt `~14.5:1` ($\ge 7.0$ AAA); `--bg` (`#fdf4ff`) vs `--text-secondary` (`#581c87`) đạt `~8.7:1` ($\ge 4.5$ AA); `--accent` (`#7e22ce`) vs `--accent-foreground` (`#ffffff`) đạt `~6.82:1` ($\ge 4.5$ AA).
   - **Kết quả**: Không làm vỡ được ngưỡng kiểm định trong `theme-config.test.ts:105-124`.

2. **Tấn công 2 — Kiểm tra tính toàn vẹn `React.memo` custom comparator và ước lượng giảm dòng code (LOC) khi tách `ChatBubble.tsx` và `Sidebar.tsx`**:
   - **Cách tấn công (`[SRC]`)**: Đếm số dòng thực tế trong [Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx#L1-L644) và [ChatBubble.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx#L1-L430) xem sau khi tách theo Mục 5.3.1 và 5.3.2 có thực sự xuống dưới ngưỡng 300 dòng của `.agents/rules/01-coding.md:10` hay không, và liệu hàm so sánh `memo(ChatBubbleComponent, (prev, next) => ...)` tại `ChatBubble.tsx:407-427` có bị ảnh hưởng không.
   - **Kết quả**:
     - Trong `Sidebar.tsx` (644 dòng): tách `SidebarButton` (dòng `101-161`: 61 dòng), `SidebarNavRail` (dòng `286-361`: 76 dòng), `SidebarFooter` (dòng `490-535`: 46 dòng), `SidebarMobileDrawer` (dòng `557-630`: 74 dòng) cùng phần state/imports chỉ phục vụ sub-components sẽ giảm ~380 dòng, đưa `Sidebar.tsx` về ~255 dòng (< 300 LOC).
     - Trong `ChatBubble.tsx` (430 dòng): tách `BubbleInlineEditor` (dòng `117-123, 202-235`: ~42 dòng) và `BubbleAssistantFooter` (dòng `303-378`: ~76 dòng) cùng các imports con (`ImageGenPreview`, `SourceLinks`, `TokenBadge`) giảm ~150 dòng, đưa `ChatBubble.tsx` về ~275 dòng (< 300 LOC) trong khi giữ nguyên `ChatBubbleProps` và hàm custom comparator tại dòng `407-427`.

3. **Tấn công 3 — Kiểm tra ràng buộc kiểu tĩnh `TranslationKey` và `ThemeDefinition["labelKey"]` khi thêm theme `"daylight"` và các khóa `describe*`**:
   - **Cách tấn công (`[SRC]`)**: Kiểm tra [theme-config.ts](file:///c:/Users/wyemh/vikini/src/lib/config/theme-config.ts#L1-L13) (`import type { TranslationKey } from "@/lib/utils/translations"; export interface ThemeDefinition { ... labelKey: TranslationKey; }`) và [translations/index.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/index.ts#L24-L34) (`type MissingInEn = Exclude<keyof typeof vi, keyof typeof en>`). Nếu thêm `labelKey: "daylight"` vào `THEME_CONFIG` mà thiếu khóa `daylight` trong `vi.ts` hoặc `en.ts`, hoặc lệch giữa 2 file, `npm run type-check` sẽ báo lỗi biên dịch ngay lập tức.
   - **Kết quả**: Mục 5.4 (dòng `441-445`) đã liệt kê đồng bộ tất cả các khóa mới (`daylight`, `describeHistoryTitle`, `describeHistoryEmpty`, `describeHistoryClear`, `describeInvalidFile`, `describeFileTooLarge`, `describeCopyFailed`) vào cả `vi.ts` và `en.ts`, đảm bảo thỏa mãn kiểm tra tĩnh `_assertNoMissingInEn: MissingInEn = never` và `_assertNoMissingInVi: MissingInVi = never` tại `translations/index.ts:30-33`.

4. **Tấn công 4 — Kiểm tra nguy cơ mất đồng bộ trạng thái `mobileOpen` khi người dùng chuyển trang trên thiết bị di động**:
   - **Cách tấn công (`[SRC]`, `[ADV]`)**: Kiểm tra luồng mở Mobile Drawer trên trang `/` (`ChatApp.tsx`) rồi bấm vào `<Link href="/gallery">` hoặc `<Link href="/images">` trong [Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx#L316-L359). Khi `mobileOpen` được chuyển từ state cục bộ sang `useLayoutStore` toàn cục, nếu bấm `<Link>` mà không đóng drawer thì trang đích có bị kẹt drawer đang mở hay không?
   - **Kết quả**: Tại [Sidebar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx#L319,L329,L340,L351), mọi thẻ `<Link>` điều hướng sang `/novelcrafter`, `/images`, `/describe`, `/gallery` đều đã gắn sẵn `onClick={() => onMobileClose?.()}` (gọi `setMobileOpen(false)` trong `useLayoutStore`), nên drawer tự động đóng ngay khi chuyển route.

---

#### 4. Mental Simulation Verification Matrix

| Kịch Bản                                     | Trạng Thái | Loại Bằng Chứng  | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :------------------------------------------- | :--------: | :--------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   |  **PASS**  | `[CMD]`, `[SRC]` | Baseline hiện tại vượt qua `npm run type-check` (exit 0), `npm run lint` (exit 0), `npx vitest run src/lib/config/theme-config.test.ts` (20/20 pass). Toàn bộ đường dẫn file `[NEW]`/`[MODIFY]` trong Revision 2 đã được đối chiếu khớp với cây thư mục thật (`src/lib/config/theme-config.ts`, `src/app/features/layout/components/HeaderBar.tsx`, `src/app/features/sidebar/components/Sidebar.tsx`, `src/app/features/chat/components/ChatBubble.tsx`).              |
| **S2: Runner Lifecycle & Teardown**          |  **PASS**  |     `[SRC]`      | Kế hoạch chỉ tác động tầng UI/Theme/Layout state. Các `useEffect` tại [LanguageUpdater.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/LanguageUpdater.tsx#L14-L35), [FloatingMenuTrigger.tsx](file:///c:/Users/wyemh/vikini/src/app/features/layout/components/FloatingMenuTrigger.tsx#L26-L31) và [SmartCode.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/SmartCode.tsx#L61-L67) đều dọn dẹp listener/timer khi unmount. |
| **S3: Database & Temporal Logic**            |  **PASS**  | `[SRC]`, `[ADV]` | Không thay đổi schema DB hay migration SQL (`Mục 3.5`). Các thao tác đọc/ghi `localStorage` trong `useLayoutStore` và `useDescribeHistory` có cơ chế `try/catch` bảo vệ trước `QuotaExceededError` / `SecurityError` và giới hạn tối đa 20 bản ghi (`TC-02`, `TC-04`).                                                                                                                                                                                                  |
| **S4: Cross-Task State Flow**                |  **PASS**  |     `[SRC]`      | `useLayoutStore` đồng bộ trạng thái `sidebarCollapsed` và `mobileOpen` xuyên suốt `ChatApp.tsx` (qua facade `useChatLayoutState.ts:11-21`), `GalleryView.tsx` (qua `useGalleryController.ts:62-63`), `ImageGenStudio.tsx:66-67`, `DescribeImageView.tsx:65-66`, `NovelcrafterStudioApp.tsx:24-25` và `ProjectChatView.tsx:26`.                                                                                                                                          |
| **S5: Security Boundary & 3-Tier Auth**      |  **PASS**  | `[SRC]`, `[ADV]` | Không tác động tới API routes (`src/app/api/`), `supabase.server.ts`, hay Redis rate limit. Các chỉnh sửa tại [AccessPendingScreen.tsx](file:///c:/Users/wyemh/vikini/src/app/components/AccessPendingScreen.tsx#L1-L66) và [signin/page.tsx](file:///c:/Users/wyemh/vikini/src/app/auth/signin/page.tsx#L1-L154) chỉ thay đổi class CSS sang semantic tokens, giữ nguyên luồng đăng nhập/đăng xuất.                                                                    |
| **S6: External Resilience & Serverless Cap** |  **PASS**  |     `[SRC]`      | Không thay đổi cấu hình timeout/serverless hay logic gọi provider AI. Việc khôi phục icon `<AlertTriangle>` và `<X>` trong [StreamErrorBanner.tsx](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/StreamErrorBanner.tsx#L69,L80) giúp hiển thị rõ thông báo lỗi stream cho người dùng.                                                                                                                                                                  |
| **Domain: Open Inquiry (Vikini)**            |  **PASS**  | `[SRC]`, `[URL]` | Đảm bảo tương thích Tailwind CSS v4 (`@theme` tại `base.css:5-38`), giữ nguyên điều kiện `needsInvert` cho icon AI provider tại `ModelSelector.tsx:171,193`, bảo toàn tâm huy hiệu RA2 bằng `.workspace-fixed-left-*` tại `ChatThemeBackground.tsx:31`, và tuân thủ quy tắc song ngữ `.agents/rules/04-bilingual.md`.                                                                                                                                                   |

---

#### 5. Claim Verification (Kiểm Chứng Khẳng Định Kỹ Thuật & Bảng Rủi Ro)

1. **Khẳng định về tương thích ngược của `src/lib/config/theme-config.ts`**:
   - **Xác minh (`[SRC]`, `[CMD]`)**: Việc giữ nguyên `THEME_CONFIG`, `THEME_IDS`, `DEFAULT_THEME = "blueprint"`, `getThemeById(id)` và bổ sung `THEME_TONES`, `getThemeTone()` tại Mục 5.1 (dòng `216-249`) tương thích với toàn bộ các nơi đang import `theme-config.ts` trong codebase (`HeaderBar.tsx`, `useTheme.ts`, `ChatThemeBackground.tsx`, `providers.tsx`, `theme-config.test.ts`).
2. **Khẳng định về tách `.workspace-main-offset-*` (`padding-left`) và `.workspace-fixed-left-*` (`left`)**:
   - **Xác minh (`[SRC]`)**: Các thẻ `<main>` trong `ChatApp.tsx:249`, `ImageGenStudio.tsx:161`, `DescribeImageView.tsx:203`, `GalleryView.tsx:169` dùng `md:pl-[calc(...)]`, trong khi `ChatThemeBackground.tsx:31` dùng `fixed ... md:left-[calc(...)]`. Việc tách thành 2 cặp class riêng trong `utilities.css` giải quyết được sự khác biệt giữa `padding-box` và vị trí cạnh trái của hộp `fixed`.
3. **Kiểm toán Bảng Rủi Ro (Risk Table Audit — Mục 9, dòng `580-585`)**:
   - Rủi ro 1 (Cao — React 19 Hydration Mismatch): Có control `hydrateLayout()` trong `useEffect` và được kiểm chứng bởi `TC-02`.
   - Rủi ro 2 (Cao — Specificity `data-theme-tone`): Có control `:where(...)` (specificity `0,0,0`) và được kiểm chứng bởi `TC-03`.
   - Rủi ro 3 (Trung bình — Mất theme cũ trong `localStorage`): Đã cập nhật đúng tên hằng số `THEME_CONFIG` (`17` phần tử) và `THEME_IDS`, được kiểm chứng bởi `TC-01`.
   - Rủi ro 4 (Trung bình — Đứt gãy luồng Props khi tách `Sidebar.tsx` và `ChatBubble.tsx`): Đã cập nhật đúng danh sách sub-components thực tế (`SidebarButton`, `SidebarNavRail`, `SidebarFooter`, `SidebarMobileDrawer`, `BubbleInlineEditor`, `BubbleAssistantFooter`) và kiểm chứng qua `TC-05`.

---

#### 6. Adversarial Timelines (Kịch Bản Đối Kháng)

```
Cơ chế 1: SSR Hydration & Đồng bộ localStorage cho useLayoutStore (Trục 1: Đồng thời / Trục 4: Serverless SSR)
T1: Next.js Server render trang ChatApp/GalleryView với useLayoutStore mặc định (sidebarCollapsed = false, hasHydrated = false) → trả HTML có class .workspace-main-offset-expanded.
T2: Trình duyệt (Client) có sẵn localStorage["vikini-layout-sidebar-collapsed"] = "true". React 19 chạy hydrateRoot() ở pha render đầu tiên (trước useEffect).
T3: Vì useLayoutStore chỉ đọc localStorage trong useEffect (qua hydrateLayout()), lần render đầu tiên ở Client vẫn giữ sidebarCollapsed = false (khớp với HTML từ Server) → sau khi mount, useEffect chạy hydrateLayout() chuyển sidebarCollapsed = true và cập nhật padding.
Kết cục: Không xảy ra lỗi React 19 Hydration Mismatch; khi chuyển route client-side qua <Link> giữa /, /images, /gallery, /describe, /novelcrafter, store singleton trong bộ nhớ giữ nguyên sidebarCollapsed = true mà không bị reset → AN TOÀN.
```

```
Cơ chế 2: Chuyển đổi Theme & Specificity CSS giữa data-theme-tone và .theme-<id> (Trục 2: TOCTOU / Trạng thái DOM)
T1: Người dùng chọn theme "yuri" (tone "dark") hoặc "daylight" (tone "light"). next-themes gắn class .theme-yuri hoặc .theme-daylight (specificity 0,1,0) lên <html>.
T2: useEffect trong useTheme.ts gắn attribute data-theme-tone="dark" (hoặc "light") lên <html>.
T3: Trình duyệt tính toán cascade giữa selector fallback :where(:root[data-theme-tone="..."]) (specificity 0,0,0) trong base.css và .theme-yuri / .theme-daylight (specificity 0,1,0).
Kết cục: Các biến màu riêng của từng theme (specificity 0,1,0) luôn được ưu tiên hơn :where(...) (specificity 0,0,0), trong khi các biến phụ nhận giá trị fallback theo tone tương ứng → AN TOÀN.
```

- **Trục 3 (Thất bại giữa chừng / Lỗi bộ nhớ trình duyệt)**: Khi trình duyệt chặn `localStorage` (`SecurityError`) hoặc đầy bộ nhớ (`QuotaExceededError`), khối `try/catch` trong `useLayoutStore` và `useDescribeHistory` (`TC-02`, `TC-04`) bắt lỗi an toàn, giữ cho state trong bộ nhớ hoạt động mà không làm gián đoạn giao diện.

---

#### 7. Commands Executed

1. `npm run type-check` — Exit code: `0` (0 errors).
2. `npx vitest run src/lib/config/theme-config.test.ts` — Exit code: `0` (1 passed file, 20 passed tests).
3. `npm run lint` — Exit code: `0` (0 errors, 3 pre-existing warnings in `ChapterEditorWorkspace.tsx`).

---

#### 8. Kết Luận

Tất cả 5 lỗi `[MAJOR]` và 1 lỗi `[MINOR]` từ Audit Run 1 đã được sửa trong Revision 2 và đối chiếu khớp với mã nguồn thật. Kế hoạch đáp ứng đủ các điều kiện kỹ thuật để chuyển sang giai đoạn thực thi (`@builder`).

[PLAN_APPROVED]
