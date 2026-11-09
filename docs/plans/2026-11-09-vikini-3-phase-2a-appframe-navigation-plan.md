# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 2A: Khung Trang Chung, Điều Hướng Mobile, Font & PageHeader

- **Revision**: 1
- **Status**: Approved
- **Date**: 2026-11-09
- **Author**: Claude Code (in-session, PM yêu cầu không chạy CLI planner) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: `docs/plans/2026-11-08-vikini-3-tokens-and-themes-implementation-plan.md` (Giai đoạn 1 — token & theme, đã code xong, chờ QA)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn yêu cầu: `docs/specs/2026-11-08-vikini-3-redesign-brief.md` (mục "Layout & components", "Suggested phasing" bước 2) và audit UX 2026-11-08 (C2, C5, C6, M4, M8). Giai đoạn 2 của brief được **chia đôi** để mỗi lần giao đủ nhỏ để QA:

- **2A (plan này)**: sửa các lỗi điều hướng/khung trang nghiêm trọng mà không đổi kiến trúc sidebar.
- **2B (plan sau)**: icon rail 64px + context panel theo canvas, tách `Sidebar.tsx` (645 dòng), Novelcrafter "focus mode", CTA cố định "Đoạn chat mới".

**Mục tiêu 2A**:

1. **C2 — Bỏ nút menu nổi kéo-thả**: xóa `FloatingMenuTrigger` ở 5 màn (Chat, Gallery, Describe, Image Studio, Novelcrafter); thay bằng nút hamburger **cố định ở góc trái header**, vùng chạm 44×44px, chỉ hiện trên mobile, mở drawer sidebar có sẵn.
2. **C6 — Header có nền**: header mobile/desktop dùng nền `--bg` 85% + `backdrop-blur` + viền `--line`, nội dung không còn trôi lộ bên dưới chữ.
3. **C5 — Hết ngõ cụt**: `/gems` (→ `/features/gems`), `/features/personas`, `/projects/[id]` hiển thị trong cùng khung trang (sidebar + header) như Gallery. Tạo component `AppFrame` dùng chung, thay khối markup đang bị lặp ở Gallery và Describe.
4. **M4 — Landmark**: hết `<main>` lồng `<main>`; sidebar dùng `<nav aria-label>` thay `<aside role="navigation">`; mỗi trang có đúng một `h1` (ẩn `sr-only` nếu thiết kế không có tiêu đề hiển thị).
5. **M8 — `PageHeader` + `EmptyState` dùng chung** trong `src/components/ui/`, áp dụng cho Gallery, Describe, Gems, Personas, Project. Tiêu đề Describe bỏ gradient tím-xanh cứng (màu thô).
6. **Font**: Be Vietnam Pro (UI), Newsreader (văn xuôi), JetBrains Mono (code) qua `next/font/google` với subset `vietnamese`, thay Geist.

**Out of Scope (What We're NOT Doing)**:

- Icon rail 64px, context panel, tách `Sidebar.tsx`, đổi CTA sidebar, Novelcrafter focus mode (→ 2B).
- Composer, model picker, thanh action tin nhắn (Giai đoạn 3). Image Studio tabs (Giai đoạn 4). Gems/Personas dạng lưới card (Giai đoạn 6, H3) — 2A chỉ đặt chúng vào khung chung.
- Type scale token 12–32 và lint chặn `text-[Npx]` (Giai đoạn 6, H5) — 2A chỉ không thêm chỗ vi phạm mới.
- Gỡ gói `geist` khỏi `package.json` (file nhạy cảm; chỉ ngừng import, dọn ở Giai đoạn 6).
- `<html lang>` theo trình duyệt (M6) và Sign-in (H7).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                                               | Nội dung rút ra                                                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                                                | Stack, cấm `any`/`console.log`, co-located test, giới hạn kích thước file          |
| `.agents/rules/03-ui.md`                                                  | Token Vikini 3.0, cấm `style={{}}`, chữ < 12px, `div role="button"`; landmark/aria |
| `.agents/rules/05-plan-review.md`                                         | Cấu trúc plan, Critic Pass khi chạm `.agents/**`                                   |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md`                        | AppShell, hamburger 44px trên mobile, phasing                                      |
| `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`       | API `next/font/google` của Next 16.4 (`subsets`, `variable`, `display`)            |
| `node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`       | `Be_Vietnam_Pro` **bắt buộc** `weight`; cả 3 font có subset `vietnamese`           |
| Canvas concept (artifact `EX6CrQpyty54jcm8LAeeGN`, board Chat/ChatMobile) | Header mobile 56px, nút "Mở menu" bên trái, nền `--bg`, viền `--line`              |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                                          | Lý do nạp                                                                               | Quyết định kỹ thuật chịu ảnh hưởng                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md`                   | Thêm 1 key `galleryEmptyAction`; tái dùng `openMenu`, `goBack`, `galleryNoImages` đã có | Thêm key vào **cả** `vi.ts`/`en.ts`, chạy `npm run type-check` |
| `.agents/skills/vikini-investigate/SKILL.md` (blast-radius) | `HeaderBar` dùng ở 5 màn; `Sidebar` dùng ở 5 màn + test                                 | Liệt kê caller (A3) trước khi đổi prop/markup                  |
| `.agents/skills/vikini-simplify/SKILL.md`                   | Khối Sidebar + Header + state bị lặp ở Gallery/Describe                                 | Gộp vào `AppFrame`; xóa `FloatingMenuTrigger.tsx`              |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                             | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `HeaderBar` **đã có** nút hamburger nhưng bị ẩn bằng class `hidden` ("HIDDEN in favor of Floating Bubble"); prop `onToggleSidebar` đã được cả 5 màn truyền vào               | `[SRC]` `src/app/features/layout/components/HeaderBar.tsx:73-81`; `src/app/features/gallery/components/GalleryView.tsx:57`, `src/app/features/image-gen/components/DescribeImageView.tsx:222`, `src/app/features/image-gen/components/ImageGenStudio.tsx:172`, `src/app/features/chat/components/ChatApp.tsx:268`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:326` |
| A2  | Header đang trong suốt (`bg-transparent`), mobile là `fixed`                                                                                                                 | `[SRC]` `src/app/features/layout/components/HeaderBar.tsx:64`                                                                                                                                                                                                                                                                                                                               |
| A3  | `FloatingMenuTrigger` có đúng 5 caller                                                                                                                                       | `[SRC]` `src/app/features/chat/components/ChatApp.tsx:263`, `src/app/features/gallery/components/GalleryView.tsx:52`, `src/app/features/image-gen/components/DescribeImageView.tsx:217`, `src/app/features/image-gen/components/ImageGenStudio.tsx:163`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:317`                                                           |
| A4  | Gallery và Describe lặp y hệt khối: wrapper `h-screen` + `<Sidebar>` 8 prop + padding theo `sidebarCollapsed` + `<HeaderBar>` + `<main>`; dữ liệu `mainChats` lọc giống nhau | `[SRC]` `src/app/features/gallery/components/GalleryView.tsx:40-59`, `src/app/features/image-gen/components/DescribeImageView.tsx:205-224`, `src/app/features/image-gen/components/DescribeImageView.tsx:32-41`, `src/app/features/gallery/components/hooks/useGalleryController.ts:39`                                                                                                     |
| A5  | Root layout đã bọc mọi trang trong `<main id="main">` → `<main>` bên trong trang là lồng nhau                                                                                | `[SRC]` `src/app/features/layout/components/MainLayout.tsx:7`; `src/app/features/gallery/components/GalleryView.tsx:59`, `src/app/features/image-gen/components/DescribeImageView.tsx:224`, `src/app/projects/[id]/page.tsx:231`, `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:90`                                                                           |
| A6  | Sidebar desktop và drawer mobile dùng `<aside role="navigation">`                                                                                                            | `[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:546-548`, `src/app/features/sidebar/components/Sidebar.tsx:580-582`                                                                                                                                                                                                                                                                |
| A7  | `/gems` redirect sang `/features/gems`; trang Gems/Personas không có sidebar/header, nền `bg-neutral-950` cứng                                                               | `[SRC]` `next.config.ts:92-93`; `src/app/features/gems/page.tsx:18`, `src/app/features/personas/page.tsx:17`                                                                                                                                                                                                                                                                                |
| A8  | Font hiện là Geist qua gói `geist`; `@theme --font-sans` trỏ `--font-geist-sans`                                                                                             | `[SRC]` `src/app/layout.tsx:8-9`, `src/app/layout.tsx:27`, `src/app/styles/themes/_shared/base.css:6-7`                                                                                                                                                                                                                                                                                     |
| A9  | `next/font/google` tải font **lúc build** (cần mạng khi `next build`); không gọi Google lúc runtime                                                                          | `[SRC]` `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md:98-106`                                                                                                                                                                                                                                                                                                          |

**Cross-Task Dependencies**: cần Giai đoạn 1 (token `--bg`, `--line`) đã có trong nhánh. 2B sẽ thay phần trong của `AppFrame` bằng icon rail; API `AppFrame` (children + `title`) giữ nguyên để 2B không phải sửa lại các trang.

**Quyết định sản phẩm (Default Assumption nếu PM không phản hồi)**:

- `[NEEDS_PRODUCT_DECISION]` **D1 — Header desktop**: _Default_: cũng dùng nền đặc 85% như mobile (audit C6 thấy lỗi nhẹ trên desktop).
- `[NEEDS_PRODUCT_DECISION]` **D2 — Trang Project**: _Default_: giữ header riêng của Project (breadcrumb, nút xóa) **bên trong** `AppFrame` dưới dạng `PageHeader` có `actions`; nút xóa chuyển vào menu "⋯" ở 2B, 2A giữ nguyên vị trí.

### 4. Bảng Verified Versions

| Thư viện / Công cụ                     | `package.json` | Phiên bản cài | Ghi chú                                                                                     | Nguồn                                                                                                                     |
| -------------------------------------- | -------------- | ------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `next`                                 | `^16.4.0`      | `16.4.0`      | `next/font/google` có `Be_Vietnam_Pro`, `Newsreader`, `JetBrains_Mono`, subset `vietnamese` | `[SRC]` `node_modules/next/package.json:3`; `node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts:1901-1910` |
| `tailwindcss`                          | `^4.1.18`      | 4.x           | `@theme { --font-serif }` sinh class `font-serif`                                           | `[SRC]` `src/app/styles/themes/_shared/base.css:5-7`                                                                      |
| `@radix-ui/react-dialog` (qua Sidebar) | có sẵn         | —             | Drawer mobile đã có focus-trap + ESC, tái dùng                                              | `[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:561-566`                                                         |
| `vitest`                               | `^4.1.12`      | 4.x           | Test component bằng Testing Library                                                         | `[SRC]` `package.json:117`                                                                                                |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**Khung trang & điều hướng**

- `[NEW]` `src/app/features/layout/components/AppFrame.tsx` — wrapper `h-dvh`, `<Sidebar>` (dữ liệu chat chính + state collapsed/mobile), `<HeaderBar>`, vùng nội dung `<div id="page-content">` cuộn được. Props: `children`, `title` (cho `h1` ẩn khi trang không tự render `PageHeader`).
- `[NEW]` `src/app/features/layout/hooks/useAppFrameState.ts` — `mainChats` (lọc như A4), `mobileOpen`, `sidebarCollapsed`.
- `[NEW]` `src/app/features/layout/hooks/useAppFrameState.test.ts`
- `[NEW]` `src/app/features/layout/components/AppFrame.test.tsx`
- `[MODIFY]` `src/app/features/layout/components/HeaderBar.tsx` — hiện hamburger (`md:hidden`, `h-11 w-11`, `aria-label={t("openMenu")}`); nền `bg-(--bg)/85 backdrop-blur-md border-b border-(--line)`.
- `[MODIFY]` `src/app/features/layout/HeaderBar.test.tsx` — thêm TC-05, TC-06.
- `[DELETE]` `src/app/features/layout/components/FloatingMenuTrigger.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatApp.tsx` — bỏ FAB; thêm `h1` `sr-only`.
- `[MODIFY]` `src/app/features/image-gen/components/ImageGenStudio.tsx` — bỏ FAB; thêm `h1` `sr-only`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` — bỏ FAB; thêm `h1` `sr-only`.
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.tsx` — dùng `AppFrame` + `PageHeader` + `EmptyState`.
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.test.tsx` — cập nhật mock (bỏ mock `FloatingMenuTrigger`, mock `AppFrame`).
- `[MODIFY]` `src/app/features/gallery/components/hooks/useGalleryController.ts` — bỏ `mainChats`, `mobileOpen`, `sidebarCollapsed` (chuyển vào `useAppFrameState`).
- `[MODIFY]` `src/app/features/image-gen/components/DescribeImageView.tsx` — dùng `AppFrame` + `PageHeader`; bỏ gradient tím-xanh.
- `[MODIFY]` `src/app/features/gems/page.tsx` — bọc `AppFrame`; bỏ `bg-neutral-950`.
- `[MODIFY]` `src/app/features/personas/page.tsx` — như trên.
- `[MODIFY]` `src/app/features/gems/components/GemManager.tsx` — header → `PageHeader` (giữ nhánh `inModal` cũ).
- `[MODIFY]` `src/app/features/personas/components/PersonaManager.tsx` — như trên.
- `[MODIFY]` `src/app/projects/[id]/page.tsx` — bọc `AppFrame`; header → `PageHeader` có `backHref` + `actions`; `<main>` → `<div>`.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx` — `<main>` → `<div id="prompt-studio-main">` (giữ skip link).

**Landmark**

- `[MODIFY]` `src/app/features/sidebar/components/Sidebar.tsx` — 2 chỗ `<aside role="navigation">` → `<nav aria-label>` (giữ `motion.nav` cho drawer). Không đổi gì khác.
- `[MODIFY]` `src/app/features/sidebar/components/Sidebar.test.tsx` — thêm TC-09.

**Primitive dùng chung**

- `[NEW]` `src/components/ui/page-header.tsx` — `title`, `description?`, `actions?`, `backHref?`, `backLabel?`; render `<header>` + `h1`.
- `[NEW]` `src/components/ui/page-header.test.tsx`
- `[NEW]` `src/components/ui/empty-state.tsx` — `icon?`, `title`, `description?`, `action?` (`{ label, href } | { label, onClick }`).
- `[NEW]` `src/components/ui/empty-state.test.tsx`

**Font**

- `[MODIFY]` `src/app/layout.tsx` — `Be_Vietnam_Pro` (400/500/600/700), `Newsreader` (variable, normal+italic), `JetBrains_Mono` (variable), subset `["latin","vietnamese"]`, `display: "swap"`, biến `--font-ui`, `--font-prose`, `--font-code`.
- `[MODIFY]` `src/app/styles/themes/_shared/base.css` — `@theme`: `--font-sans: var(--font-ui), …`, `--font-serif: var(--font-prose), Georgia, serif`, `--font-mono: var(--font-code), …`.

**i18n** (chỉ thêm khi Grep xác nhận chưa có)

- `[MODIFY]` `src/lib/utils/translations/vi.ts` — thêm `galleryEmptyAction` ("Tạo ảnh đầu tiên"). Tái dùng key sẵn có: `openMenu` (`src/lib/utils/translations/vi.ts:1320`), `goBack` (`src/lib/utils/translations/vi.ts:718`), `galleryNoImages` (`src/lib/utils/translations/en.ts:538`).
- `[MODIFY]` `src/lib/utils/translations/en.ts`

**Living docs**

- `[MODIFY]` `.agents/rules/03-ui.md` — mục "Page structure": trang mới dùng `AppFrame` + `PageHeader`/`EmptyState`, một `h1`/trang, không `<main>` trong trang (→ Critic Pass).
- `[MODIFY]` `docs/architecture.md` — `AppFrame`, primitive mới.
- `[MODIFY]` `docs/CHANGELOG.md`

### 6. Caller-First Design Sketch

**6.1 Trang dùng `AppFrame`**

```tsx
// src/app/features/gems/page.tsx
export default function GemsPage() {
  return (
    <AppFrame>
      <ErrorBoundary>
        <Suspense fallback={<GemLoading />}>
          <GemManager />
        </Suspense>
      </ErrorBoundary>
    </AppFrame>
  );
}

// GalleryView.tsx (rút gọn)
<AppFrame>
  <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
    <PageHeader title={g.t("galleryTitle")} actions={<CompareToggle />} />
    {g.images.length === 0 ? (
      <EmptyState
        icon={<ImageIcon />}
        title={g.t("galleryNoImages")}
        action={{ label: g.t("galleryEmptyAction"), href: "/images" }}
      />
    ) : (<GalleryGrid … />)}
  </div>
</AppFrame>
```

**6.2 `AppFrame`**

```tsx
export default function AppFrame({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const f = useAppFrameState();
  const router = useRouter();
  return (
    <div className="h-dvh w-full flex overflow-hidden bg-(--bg) text-(--text)">
      <Sidebar
        conversations={f.mainChats}
        allConversations={f.conversations}
        onSelectConversation={(id) => router.push(`/?id=${id}`)}
        onNewChat={() => router.push("/")}
        collapsed={f.sidebarCollapsed}
        onToggleCollapse={f.toggleCollapsed}
        mobileOpen={f.mobileOpen}
        onCloseMobile={f.closeMobile}
      />
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          f.sidebarCollapsed ? PAD_COLLAPSED : PAD_EXPANDED
        )}
      >
        <HeaderBar onToggleSidebar={f.openMobile} />
        <div
          id="page-content"
          className="flex-1 overflow-y-auto pt-[calc(4.5rem+var(--sat,0px))] md:pt-0"
        >
          {title && <h1 className="sr-only">{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
```

`PAD_*` là chuỗi class padding đang dùng ở `src/app/features/gallery/components/GalleryView.tsx:55`, chuyển thành hằng số trong `AppFrame`.

**6.3 `HeaderBar` (C2 + C6)**

```tsx
<motion.header className={`chat-header-bar fixed md:sticky … bg-(--bg)/85 backdrop-blur-md border-b border-(--line) …`}>
  <button
    type="button"
    onClick={onToggleSidebar}
    className="md:hidden -ml-2 flex h-11 w-11 items-center justify-center rounded-xl text-(--text) hover:bg-(--raised) focus-visible:ring-2 focus-visible:ring-(--ring)"
    aria-label={t("openMenu")}
  >
    <Menu className="w-6 h-6" />
  </button>
  …
```

Nếu `onToggleSidebar` không được truyền → không render nút (tránh nút chết).

**6.4 `PageHeader` / `EmptyState`**

```tsx
<PageHeader
  title={project.name}
  description={t("projectSubtitle")}
  backHref="/" backLabel={t("goBack")}
  actions={<><Button …>{t("newChat")}</Button><DeleteButton … /></>}
/>
// → <header className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-(--line)">
//     <div><Link …><ArrowLeft/>{backLabel}</Link><h1 className="text-2xl font-semibold text-(--text)">…</h1><p className="text-sm text-(--muted)">…</p></div>
//     <div className="flex gap-2">{actions}</div>
//   </header>

<EmptyState icon={…} title="…" description="…" action={{ label, href }} />
// → <section role="status" className="flex flex-col items-center text-center gap-3 py-16"> … <Link|Button> … </section>
```

Không có logic nghiệp vụ trong 2 primitive (đúng ranh giới `src/components/ui/`).

**6.5 Font**

```tsx
const uiFont = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-ui" });
const proseFont = Newsreader({ subsets: ["latin", "vietnamese"], style: ["normal", "italic"], display: "swap", variable: "--font-prose" });
const codeFont = JetBrains_Mono({ subsets: ["latin", "vietnamese"], display: "swap", variable: "--font-code" });
<html className={`h-full ${uiFont.variable} ${proseFont.variable} ${codeFont.variable}`} …>
```

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: viết `page-header.test.tsx`, `empty-state.test.tsx`, `useAppFrameState.test.ts`, `AppFrame.test.tsx` và các ca mới trong `HeaderBar.test.tsx`, `Sidebar.test.tsx` theo §8 → chạy, phải **đỏ**.
- [ ] **B2 — Primitive**: `page-header.tsx`, `empty-state.tsx` (< 80 dòng mỗi file).
- [ ] **B3 — `HeaderBar`**: hamburger + nền (§6.3).
- [ ] **B4 — `useAppFrameState` + `AppFrame`** (§6.2).
- [ ] **B5 — Gỡ FAB**: xóa `FloatingMenuTrigger.tsx` và 5 chỗ dùng (A3); thêm `h1` `sr-only` ở Chat, Image Studio, Novelcrafter.
- [ ] **B6 — Gallery, Describe** sang `AppFrame` + `PageHeader` (+ `EmptyState` cho Gallery); dọn `useGalleryController`.
- [ ] **B7 — Gems, Personas, Project** sang `AppFrame` + `PageHeader`; Project `<main>` → `<div>`; PromptStudio `<main>` → `<div>`.
- [ ] **B8 — Sidebar landmark** (A6).
- [ ] **B9 — Font** (§6.5) + `@theme`.
- [ ] **B10 — i18n** (add-translation SKILL) + `npm run type-check`.
- [ ] **B11 — Living docs**.
- [ ] **B12 — Verify** theo §9; kiểm tay mobile 375px và desktop 1440px trên 8 route.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                       | Input                                                                              | Kỳ vọng                                                                                                                       |
| ----- | -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `page-header.test.tsx`     | `title`, `description`, `actions`                                                  | Đúng 1 `heading level 1` với `title`; `description` hiển thị; `actions` render bên trong `<header>`                           |
| TC-02 | `page-header.test.tsx`     | `backHref="/"`, `backLabel="Quay lại"`                                             | Link `href="/"` có tên "Quay lại"; **không** có link khi thiếu `backHref` (Negative)                                          |
| TC-03 | `empty-state.test.tsx`     | `action={{label, href}}` / `{label, onClick}`                                      | Render `<a href>` / `<button>` tương ứng; click gọi `onClick` 1 lần; không có action → không có link/button (Negative)        |
| TC-04 | `empty-state.test.tsx`     | —                                                                                  | Container có `role="status"`; không chứa class `text-[10px]`/`text-[11px]`                                                    |
| TC-05 | `HeaderBar.test.tsx`       | có `onToggleSidebar`                                                               | Nút "Mở menu" có class `md:hidden`, `h-11`, `w-11`; click gọi `onToggleSidebar` 1 lần                                         |
| TC-06 | `HeaderBar.test.tsx`       | không truyền `onToggleSidebar` (Negative)                                          | Không có nút "Mở menu"; header có class `bg-(--bg)/85` và **không** có `bg-transparent`                                       |
| TC-07 | `useAppFrameState.test.ts` | conversations gồm model `vikini-image-studio`, `user_templates_store`, chat thường | `mainChats` chỉ còn chat thường; `openMobile/closeMobile/toggleCollapsed` đổi state đúng                                      |
| TC-08 | `AppFrame.test.tsx`        | `title="Gems"` + children                                                          | Có `h1` sr-only "Gems"; children nằm trong `#page-content`; **không** có phần tử `main` nào do AppFrame render (Negative, M4) |
| TC-09 | `Sidebar.test.tsx`         | render desktop                                                                     | `getAllByRole("navigation")` tìm thấy phần tử `NAV` (không còn `ASIDE` mang `role="navigation"`)                              |
| TC-10 | `GalleryView.test.tsx`     | 0 ảnh                                                                              | Hiển thị `EmptyState` với link tới `/images`                                                                                  |

**Pass/fail**: 100% xanh, không `.skip/.only`; chỉ thay test cũ theo Loại C ở `GalleryView.test.tsx` (mock khung trang) — không giảm `expect` của ca nghiệp vụ.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

**Test co-located**: `src/components/ui/{page-header,empty-state}.test.tsx`, `src/app/features/layout/hooks/useAppFrameState.test.ts`, `src/app/features/layout/components/AppFrame.test.tsx`, cùng test component đã liệt kê.

```powershell
npx vitest run src/components/ui src/app/features/layout src/app/features/sidebar src/app/features/gallery --reporter=dot
npm run type-check; npm run lint; npm run test:run
```

**Wiring Probes**

| #   | Probe                                                                                                                                      | Kỳ vọng                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| W1  | Grep `FloatingMenuTrigger` trong `src/`                                                                                                    | 0 kết quả                                               |
| W2  | Grep `<main` trong `src/app/**/*.tsx` (trừ test)                                                                                           | Chỉ `src/app/features/layout/components/MainLayout.tsx` |
| W3  | Grep `role="navigation"` trong `src/`                                                                                                      | 0 kết quả                                               |
| W4  | Grep `bg-neutral-950\|from-purple-400` trong `src/app/features/{gems,personas}/page.tsx` và `DescribeImageView.tsx`                        | 0 kết quả                                               |
| W5  | `npm run build` (có `.env.local`) → HTML trang `/` có `<link rel="preload" … as="font">` của Be Vietnam Pro; Grep `geist` trong `src/` → 0 | Font mới nối dây, Geist ngừng dùng                      |

**Negative Probes**

| #   | Probe                                                                | Kỳ vọng                |
| --- | -------------------------------------------------------------------- | ---------------------- |
| N1  | Tạm thêm `className="hidden"` cho nút hamburger → chạy TC-05         | TC-05 **đỏ**; hoàn tác |
| N2  | Tạm bọc children của `AppFrame` trong `<main>` → TC-08               | **đỏ**; hoàn tác       |
| N3  | Tạm bỏ bộ lọc `vikini-image-studio` trong `useAppFrameState` → TC-07 | **đỏ**; hoàn tác       |

**Kiểm tay (QA)**: 375px — header không còn đè chữ khi cuộn chat; nút ☰ trái mở drawer, ESC/kéo đóng được; không còn nút tròn nổi. `/gems`, `/features/personas`, `/projects/<id>` có sidebar + header + nút quay lại. Tiếng Việt có dấu hiển thị đúng font Be Vietnam Pro (không rơi về font hệ thống ở chữ có dấu).

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                               | Mức           | Control                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Header đặc che nội dung đầu trang mobile (chat đang dùng `pt-[calc(6rem…)]`)                         | Trung bình    | Giữ padding hiện có ở `src/app/features/chat/components/ChatApp.tsx:281`; `AppFrame` thêm `pt` tương ứng; kiểm tay 375px |
| Gems/Personas đang dùng `inModal` (render trong modal) — bọc `AppFrame` ở page không ảnh hưởng modal | Thấp          | Chỉ sửa `page.tsx`; `GemManager` giữ nhánh `inModal` (`src/app/features/gems/components/GemManager.tsx:183-188`)         |
| `next/font/google` cần mạng khi build                                                                | Thấp          | Vercel build có mạng; fallback `system-ui` trong `@theme`                                                                |
| Đổi font làm lệch layout chữ (Be Vietnam Pro rộng hơn Geist)                                         | Trung bình    | `adjustFontFallback` mặc định của `next/font`; QA kiểm truncation ở sidebar, header                                      |
| `Sidebar.tsx` 645 dòng vượt giới hạn 500                                                             | Thấp (có sẵn) | 2A chỉ đổi 2 thẻ; tách file ở 2B                                                                                         |
| Test cũ tìm `role="navigation"`                                                                      | Thấp          | `<nav>` có role ngầm định `navigation` → `getByRole` vẫn khớp                                                            |

### Lộ Trình

| Bước | Nội dung                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2B   | Icon rail 64px + context panel (canvas Chat), tách `Sidebar.tsx`, CTA "Đoạn chat mới" cố định, Novelcrafter focus mode, thay phần trong `AppFrame` |
| 3    | Chat, composer, model picker (C1, C3, H2, H6, M1, M2)                                                                                              |
| 4    | Ảnh: tabs Tạo ảnh / Thư viện / Mô tả ảnh (M3, M5)                                                                                                  |
| 5    | Novelcrafter theo canvas (H1)                                                                                                                      |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô (H4/H5), gỡ alias token cũ                                                    |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định "Tự review ở đây"); Critic Pass miễn theo cách PM đã chọn ở plan Giai đoạn 1 — PM có thể yêu cầu chạy lại]

#### 1. Output verify-plan.mjs

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-09-vikini-3-phase-2a-appframe-navigation-plan.md` → `SECTIONS 7/7`, mọi `LINE_REF` PASS, `CRITIC_REQUIRED yes (.agents/rules/03-ui.md)`, `VERIFY_PLAN: PASS`.
- Đã đối chiếu lại tại source: A1 (nút hamburger ẩn, `HeaderBar.tsx:73-81`), A3 (5 caller FAB), A4 (khối lặp Gallery/Describe), A5 (`<main>` lồng), A6 (`role="navigation"`), A8 (Geist), API `Be_Vietnam_Pro` bắt buộc `weight` — đều khớp.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                               | Bằng chứng                                                                                                                  | Lý do / Hướng xử lý khi code                                                                                                                                                                                  |
| --- | -------------- | ------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/app/features/layout/components/HeaderBar.tsx:65`                     | [SRC] Header mobile: `pt-[calc(1rem+var(--sat))]` + nút `h-11` (2,75rem) + `pb-4` = 4,75rem + safe-area                     | §6.2 đặt `pt-[calc(4.5rem+var(--sat,0px))]` cho `#page-content` → lệch ~4px, dòng đầu có thể bị header che. Dùng `4.75rem` (hoặc biến `--header-h`) và kiểm tay 375px.                                        |
| 2   | DEFECT         | [MINOR] | `src/app/features/sidebar/components/Sidebar.tsx:561-566`                 | [SRC] Drawer mobile là `Dialog.Content asChild`; Radix gán `role="dialog"`, hiện bị ghi đè bởi `role="navigation"` explicit | Khi đổi sang `motion.nav` không có `role`, drawer sẽ mang `role="dialog"` (đúng ngữ nghĩa modal). Giữ `aria-label`; TC-09 chỉ khẳng định bản desktop là `NAV`. Không chặn.                                    |
| 3   | DEFECT         | [MINOR] | `src/app/projects/[id]/page.tsx:149`                                      | [SRC] Trang Project có 2 nhánh `return` (loading/không tìm thấy ở dòng 149, nội dung ở dòng 161)                            | §5 chỉ nói "bọc AppFrame"; phải bọc **cả hai** nhánh, nếu không trạng thái "không tìm thấy" vẫn là ngõ cụt (C5).                                                                                              |
| 4   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/components/ChapterManuscriptEditor.tsx:79` | [SRC] Tùy chọn font bản thảo `serif: "font-serif"`                                                                          | Định nghĩa `--font-serif` làm tùy chọn này đổi từ Georgia sang Newsreader — đúng ý brief (văn xuôi dùng Newsreader) nhưng nằm ngoài danh sách blast radius; ghi vào CHANGELOG và QA kiểm editor Novelcrafter. |
| 5   | RISK_DISMISSED | —       | `src/app/features/gems/components/GemManager.tsx:183-188`                 | [SRC] `GemManager` còn được `GemModal.tsx` dùng với `inModal`                                                               | `AppFrame` chỉ bọc ở `page.tsx`, modal không bị ảnh hưởng; giữ nhánh `inModal` như plan ghi.                                                                                                                  |

#### Kết Luận

Không có `[BLOCKER]` hay `[MAJOR]`. 4 `[MINOR]` xử lý trong lúc code (B4, B7, B8, B9). Test Contract có ca âm tính (TC-02, TC-03, TC-06, TC-08) và Negative Probe N1–N3; mọi logic mới (`useAppFrameState`, primitive UI) có test co-located. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]
