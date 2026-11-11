# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 4: Khu "Ảnh" — Header + Tab Tạo ảnh / Thư viện / Mô tả ảnh, Token Màu Studio, M3, M5

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Claude Code (in-session, PM yêu cầu không chạy CLI planner) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: Giai đoạn 3D (`docs/plans/2026-11-11-vikini-3-phase-3d-a11y-names-plan.md`) — triển khai **sau** 3D vì cùng sửa `ControlPanel.tsx`/`GalleryView.tsx` và dùng `tests/e2e/a11y.spec.ts` của 3D làm lưới an toàn.

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: canvas board **ImageStudio** (artifact `EX6CrQpyty54jcm8LAeeGN`, "Ảnh · Studio + Thư viện"): header 60px gồm `h1` "Ảnh" + 3 tab "Tạo ảnh / Thư viện / Mô tả ảnh"; form bên trái có nhãn chữ thường ("Mô tả ảnh bạn muốn", "Model", "Tỷ lệ", "Phong cách"), nút Tạo màu `--accent`, dòng phụ "Hoặc nhấn Ctrl Enter". Audit **M3** (Gallery trống vẫn hiện tìm kiếm/bộ lọc/So sánh; 2 nút lọc lệch chiều cao 42/46px), **M5** (gợi ý Ctrl+Enter hiện trên mobile; nút Generate bị khóa không nói lý do; chữ trong select model căn giữa), **H4** phần Image Studio ("Image Studio luôn tím-xanh") và **H5** (chữ < 12px, UPPERCASE) trong khu Ảnh.

1. **Header khu Ảnh dùng chung** (`ImageSectionHeader`): `h1` "Ảnh" + `<nav aria-label="Chế độ ảnh">` gồm 3 **liên kết** dạng tab tới `/images`, `/gallery`, `/describe`; tab hiện tại có `aria-current="page"` + gạch chân `--accent`. Dùng ở cả 3 trang; thay `h1` ẩn "Studio" của Studio và `PageHeader` của Gallery/Describe (mỗi trang vẫn đúng **một** `h1`). Mobile: nav cuộn ngang được, mỗi tab cao ≥ 44px. **(Revision 2) Bố cục mobile (< `md`)**: header gọn `h-12` chỉ hiện hàng tab; `h1` "Ảnh" vẫn có trong DOM nhưng `sr-only md:not-sr-only` (trình đọc màn hình vẫn có tiêu đề trang). Trên Studio, hàng tab khu Ảnh nằm dưới `HeaderBar` và trên thanh Tùy chỉnh/Kết quả; khối tiêu đề "Studio" trong vùng cuộn của `ControlPanel` bị bỏ nên nội dung form bắt đầu cao hơn. Tiêu chí QA: ở 375×667, ô prompt và nút Tạo (sticky đáy `ControlPanel`) cùng nằm trong viewport khi chưa cuộn.
2. **Studio theo token** (`ControlPanel`, `Canvas`, `DescribeImageView`): bỏ gradient tím/xanh/hồng (`from-purple-600 to-blue-600`, `bg-purple-500/…`, `text-purple-400`…) → `--accent`, `--soft`, `--on-accent`, `--line`, `--raised`, `--muted`, `--danger`. Nhãn nhóm (`PROMPT`, `ENHANCEMENT`, `MODEL`, `DIMENSIONS`…) bỏ `uppercase tracking-wider` → chữ thường `text-sm font-semibold`; chữ `text-[9px]/[10px]/[11px]` → tối thiểu `text-xs` (12px). Ngoại lệ có chủ đích: chữ/nút **đè lên ảnh** (badge, overlay hành động trong `Canvas`) giữ `text-white` + nền `bg-black/…` để đọc được trên mọi ảnh, nhưng màu nhấn tím/hồng/xanh của chúng đổi sang `--accent`/`--danger`.
3. **M5**: gợi ý "Ctrl+Enter" ẩn trên thiết bị con trỏ thô (`pointer-coarse:hidden`, cả `ControlPanel` và `EditPanel`); nút Tạo khi bị khóa vì prompt trống có dòng "Nhập prompt để bắt đầu" ngay dưới, nối bằng `aria-describedby`; nội dung model trong select căn trái.
4. **M3** (`GalleryView`): khi đã tải xong và **chưa có ảnh nào**, chỉ hiện EmptyState (đã có CTA "Tạo ảnh đầu tiên" từ 2A) — ẩn ô tìm kiếm, bộ lọc, dòng đếm và nút So sánh; mọi control lọc cao bằng nhau (`h-10`); nút "Yêu thích" thành toggle `aria-pressed` màu `--accent` (bỏ hồng thô); nhãn chi tiết ảnh bỏ `uppercase`.
5. **Nhãn panel ngữ cảnh khớp tab**: `Sidebar` (panel khu Ảnh) đổi nhãn "Image Studio / Bộ sưu tập / Mô Tả Ảnh" → "Tạo ảnh / Thư viện / Mô tả ảnh", tiêu đề panel "Ảnh".
6. **Tách `ControlPanel.tsx`** (772 dòng, vượt trần 500 dòng UI): đưa khối Prompt (chế độ Free/Guided, ô nhập, gợi ý, Quick add, Exclude, mẹo chữ, lịch sử) sang `ControlPanelPromptSection.tsx`, khối ảnh tham chiếu sang `ControlPanelReferenceImages.tsx`; `ControlPanel.tsx` ≤ 500 dòng. Props của `ControlPanel` giữ nguyên.

**Out of Scope (What We're NOT Doing)**:

- Làm lại form theo canvas (thẻ tỷ lệ có icon dạng radiogroup, chip phong cách thay `StyleSelector`, nút "Tạo 4 ảnh", dải "Trước đó" + "Xem thư viện") — cần quyết định sản phẩm về số ảnh mặc định và bỏ chế độ Guided; để Giai đoạn 4B nếu PM muốn.
- Đưa Studio vào `AppFrame` (Studio vẫn tự dựng `Sidebar` + `HeaderBar` riêng) — thay đổi khung lớn, thuộc đợt hợp nhất C5 còn lại.
- Màu thô trong `ImageLightbox`, `ImageCompareModal`, `EditPanel` (trừ gợi ý Ctrl+Enter), `PromptBuilder`, `TagInput`, `TemplateModal`; chấm màu nhận diện của từng phong cách trong `StyleSelector` (màu danh mục có chủ đích) — Giai đoạn 6 (codemod + lint chặn màu thô).
- Thẻ ảnh trong Gallery là `div onClick` (chưa dùng được bằng bàn phím, có nút lồng bên trong) — cần tái cấu trúc thẻ; ghi nhận cho Giai đoạn 6.
- Logic sinh ảnh, quota, API, hook `useImageGenStudio`/`useGalleryController` — không đổi.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                                                  | Nội dung rút ra                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas board **ImageStudio** (`project/ImageStudio.dc.html`)                                                                                         | Header 60px, `h1` 18px/600 "Ảnh", tab cao bằng header, gạch chân 2px `--accent`, tab không chọn màu `--muted`; nút Tạo `--accent`/`--on-accent` cao 48px |
| Audit UX mục M3, M5, H4, H5                                                                                                                          | Các lỗi cần đóng ở §1                                                                                                                                    |
| Ảnh quét 2026-11-11 `/images` 1440px                                                                                                                 | Nhãn in hoa "PROMPT/QUICK ADD/EXCLUDE/ENHANCEMENT/MODEL/DIMENSIONS", nút Generate gradient tím-xanh, gợi ý "Press Ctrl+Enter" 10px                       |
| `src/app/features/image-gen/components/ImageGenStudio.tsx`, `ControlPanel.tsx`, `Canvas.tsx`, `DescribeImageView.tsx`, `EditPanel.tsx`               | Cấu trúc hiện tại (A1–A8)                                                                                                                                |
| `src/app/features/gallery/components/GalleryView.tsx` + test; `src/components/ui/page-header.tsx`; `src/app/features/sidebar/components/Sidebar.tsx` | A9–A12                                                                                                                                                   |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                                  | Quyết định kỹ thuật chịu ảnh hưởng                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn header/tab, dòng "Nhập prompt để bắt đầu"                             | Key mới vào **cả** `vi.ts`/`en.ts`; `npm run type-check` bắt lệch                                          |
| `.agents/skills/vikini-investigate/SKILL.md` | `ControlPanel` lớn, được `ImageGenStudio` dùng; Sidebar dùng chung mọi khu | Tách khối nhưng **giữ nguyên props** `ControlPanel`; Sidebar chỉ đổi nhãn của nhánh `section === "images"` |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                     | Bằng chứng                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Studio tự dựng `Sidebar` + `HeaderBar`, `h1` chỉ là `sr-only` "Studio"; vùng chính `flex-col md:flex-row` chứa tab mobile Studio/Kết quả + `ControlPanel` + `Canvas` | `[SRC]` `src/app/features/image-gen/components/ImageGenStudio.tsx:76-78`, `src/app/features/image-gen/components/ImageGenStudio.tsx:147-176`                                                                        |
| A2  | `ControlPanel` có khối tiêu đề riêng (ô vuông gradient indigo→purple + chữ "Studio" + nút ⚙)                                                                         | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:216-228`                                                                                                                                            |
| A3  | Nhãn nhóm trong `ControlPanel` đều `text-xs font-semibold uppercase tracking-wider`                                                                                  | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:231`, `src/app/features/image-gen/components/ControlPanel.tsx:473`                                                                                  |
| A4  | Nút Generate gradient `from-purple-600 to-blue-600 text-white`, khóa khi `generating \|\| !prompt.trim()` mà không có giải thích                                     | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:755-768`                                                                                                                                            |
| A5  | Gợi ý phím tắt 10px hiện ở mọi thiết bị (`ControlPanel`), và "Ctrl+Enter" 9px trong `EditPanel`                                                                      | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:322`, `src/app/features/image-gen/components/EditPanel.tsx:438-440`                                                                                 |
| A6  | Nội dung `SelectItem` model là `flex flex-col` không căn trái                                                                                                        | `[SRC]` `src/app/features/image-gen/components/ControlPanel.tsx:481-487`                                                                                                                                            |
| A7  | `Canvas` empty state dùng icon nền gradient tím/xanh; badge/nút đè ảnh dùng `bg-purple-500/80`, `bg-blue-500/80`, `bg-pink-500/80`                                   | `[SRC]` `src/app/features/image-gen/components/Canvas.tsx:385-387`, `src/app/features/image-gen/components/Canvas.tsx:276`, `src/app/features/image-gen/components/Canvas.tsx:318`                                  |
| A8  | `DescribeImageView` dùng `AppFrame` + `PageHeader`; vùng thả ảnh và nút chính dùng tím; 2 nhãn `uppercase`                                                           | `[SRC]` `src/app/features/image-gen/components/DescribeImageView.tsx:192-196`, `src/app/features/image-gen/components/DescribeImageView.tsx:215`, `src/app/features/image-gen/components/DescribeImageView.tsx:306` |
| A9  | `GalleryView` luôn render tìm kiếm + bộ lọc + dòng đếm + nút So sánh, kể cả khi 0 ảnh; EmptyState có CTA `/images` khi `images.length === 0`                         | `[SRC]` `src/app/features/gallery/components/GalleryView.tsx:45-110`, `src/app/features/gallery/components/GalleryView.tsx:171-179`                                                                                 |
| A10 | Nút "Yêu thích" dùng `bg-pink-500/20 … text-pink-400`, không có `aria-pressed`; nhãn chi tiết ảnh `uppercase`                                                        | `[SRC]` `src/app/features/gallery/components/GalleryView.tsx:96-108`, `src/app/features/gallery/components/GalleryView.tsx:336`                                                                                     |
| A11 | `GalleryView.test.tsx` khẳng định **một** `h1` (mock `AppFrame`) và EmptyState có link `galleryEmptyAction` → `/images`                                              | `[SRC]` `src/app/features/gallery/components/GalleryView.test.tsx:88-104`                                                                                                                                           |
| A12 | Panel ngữ cảnh khu Ảnh dùng nhãn `imageStudio` / `gallery` / `describeTitle`, tiêu đề panel `imageStudio`                                                            | `[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:139-151`                                                                                                                                                   |
| A13 | `Canvas.test.tsx` chỉ khẳng định lớp focus/hover và tên nút, không khẳng định màu                                                                                    | `[SRC]` `src/app/features/image-gen/components/Canvas.test.tsx:45-120`                                                                                                                                              |
| A14 | Tailwind 4.1 có biến thể `pointer-coarse:`                                                                                                                           | `[SRC]` `package.json:113` (`tailwindcss ^4.1.18`)                                                                                                                                                                  |

**Cross-Task Dependencies**: 3D thêm `aria-label` cho nút ⚙/Switch/Select trong `ControlPanel` và 2 `<select>` Gallery — Giai đoạn 4 phải **giữ** các tên này (test a11y e2e của 3D + TC của 3D bảo vệ). Token từ Giai đoạn 1; `EmptyState` từ 2A.

**Quyết định sản phẩm (Default Assumption)**:

- `[NEEDS_PRODUCT_DECISION]` **D1 — Tab là liên kết**: _Default_ `<nav>` + `<Link aria-current="page">` (mỗi tab là một trang/URL riêng, giữ back/forward và chia sẻ link), **không** dùng `role="tablist"` như canvas (ARIA tabs dành cho panel cùng trang).
- `[NEEDS_PRODUCT_DECISION]` **D2 — Giữ liên kết trong panel ngữ cảnh**: _Default_ giữ 3 liên kết ở panel trái (desktop) **và** thêm tab trong header (dùng được cả trên mobile), đổi nhãn panel cho khớp tab.
- `[NEEDS_PRODUCT_DECISION]` **D3 — Form Studio**: _Default_ giữ nguyên bộ điều khiển hiện có (Free/Guided, Quick add, Exclude, tỷ lệ mở rộng, độ phân giải, số ảnh), chỉ đổi màu/nhãn/cỡ chữ; bố cục mới theo canvas để 4B.

### 4. Bảng Verified Versions

| Thư viện / Công cụ                      | `package.json` | Phiên bản | Ghi chú                                     | Nguồn                      |
| --------------------------------------- | -------------- | --------- | ------------------------------------------- | -------------------------- |
| `tailwindcss`                           | `^4.1.18`      | 4.1.x     | Biến thể `pointer-coarse:`, container query | `[SRC]` `package.json:113` |
| `next` (`next/link`, `next/navigation`) | `^16.4.0`      | 16.4      | `Link`, `usePathname` cho tab hiện tại      | `[SRC]` `package.json:64`  |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `src/app/features/image-gen/components/ImageSectionHeader.tsx` — header + nav tab (§6.1).
- `[NEW]` `src/app/features/image-gen/components/ImageSectionHeader.test.tsx` — TC-01, TC-02.
- `[MODIFY]` `src/app/features/image-gen/components/ImageGenStudio.tsx` — bỏ `h1` sr-only, đặt `ImageSectionHeader` trên cùng vùng nội dung (trên tab mobile Studio/Kết quả).
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanel.tsx` — bỏ khối tiêu đề "Studio" (giữ nút ⚙ ở hàng nhãn Prompt, giữ `aria-label` của 3D), token màu, nhãn chữ thường, chữ ≥ 12px, gợi ý `pointer-coarse:hidden`, dòng lý do khóa nút Tạo, model căn trái; ≤ 500 dòng.
- `[NEW]` `src/app/features/image-gen/components/ControlPanelPromptSection.tsx`, `ControlPanelReferenceImages.tsx` — khối tách từ `ControlPanel` (giữ nguyên hành vi, đổi token/nhãn cùng lúc).
- `[MODIFY]` `src/app/features/image-gen/components/ControlPanel.test.tsx` (tạo ở 3D) — thêm TC-03…TC-06.
- `[MODIFY]` `src/app/features/image-gen/components/Canvas.tsx` + `Canvas.test.tsx` — token màu (theo ngoại lệ overlay ở §1.2), chữ ≥ 12px; thêm TC-07.
- `[MODIFY]` `src/app/features/image-gen/components/EditPanel.tsx` — chỉ gợi ý "Ctrl+Enter": `text-xs pointer-coarse:hidden`.
- `[MODIFY]` `src/app/features/image-gen/components/DescribeImageView.tsx` — `ImageSectionHeader` thay `PageHeader` (mô tả trang giữ thành đoạn dưới header), vùng thả ảnh + nút chính theo token, bỏ `uppercase`.
- `[NEW]` `src/app/features/image-gen/components/DescribeImageView.test.tsx` — TC-08.
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.tsx` + `GalleryView.test.tsx` — header mới, M3, toggle Yêu thích, nhãn chữ thường; TC-09…TC-11.
- `[MODIFY]` `src/app/features/sidebar/components/Sidebar.tsx` — nhãn panel khu Ảnh (A12).
- `[MODIFY]` `src/app/features/sidebar/components/Sidebar.test.tsx` — TC-12 (chỉ thêm ca).
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `en.ts` — `imagesTitle` ("Ảnh" / "Images"), `imageSectionNav` ("Chế độ ảnh" / "Image modes"), `imageTabCreate` ("Tạo ảnh" / "Create"), `imageTabLibrary` ("Thư viện" / "Library"), `imageTabDescribe` ("Mô tả ảnh" / "Describe"), `studioPromptRequired` ("Nhập prompt để bắt đầu" / "Enter a prompt to start").
- `[MODIFY]` `docs/CHANGELOG.md`, `docs/architecture.md`.

**Không sửa**: hook `useImageGenStudio`, `useGalleryController`, API, `StyleSelector`, `ImageLightbox`, `ImageCompareModal`, `src/app/images|gallery|describe/page.tsx`.

### 6. Caller-First Design Sketch

**6.1 `ImageSectionHeader`**

```tsx
const TABS = [
  { href: "/images", key: "imageTabCreate", icon: Wand2 },
  { href: "/gallery", key: "imageTabLibrary", icon: LayoutGrid },
  { href: "/describe", key: "imageTabDescribe", icon: ScanSearch },
] as const;

export function ImageSectionHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  return (
    <header
      className={cn(
        "flex h-15 shrink-0 items-center gap-6 border-b border-(--line) bg-(--bg) px-4 md:px-6",
        className
      )}
    >
      <h1 className="text-lg font-semibold text-(--text)">{t("imagesTitle")}</h1>
      <nav
        aria-label={t("imageSectionNav")}
        className="flex h-full min-w-0 overflow-x-auto [scrollbar-width:none]"
      >
        {TABS.map((tab) => {
          const current = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex h-full min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                current
                  ? "border-(--accent) font-semibold text-(--text)"
                  : "border-transparent font-medium text-(--muted) hover:text-(--text)"
              )}
            >
              <tab.icon aria-hidden="true" className="h-4 w-4" />
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
```

Gallery/Describe: `<AppFrame><ImageSectionHeader /><div className="p-4 md:p-8">…</div></AppFrame>`; Describe giữ `describeSubtitle` thành `<p className="text-sm text-(--muted)">` đầu nội dung. **(Revision 2)** Studio: `ImageSectionHeader` chèn giữa `HeaderBar` và vùng nội dung chính (`src/app/features/image-gen/components/ImageGenStudio.tsx:172-175`), tức **dưới** thanh ứng dụng mobile (nút ☰, đã chừa `4.75rem`) và **trên** thanh tab Tùy chỉnh/Kết quả; xóa `h1` sr-only "Studio" để trang chỉ còn một `h1`. Class header: `h-12 md:h-15`; `h1`: `sr-only md:not-sr-only`.

**6.2 Nút Tạo + lý do khóa (`ControlPanel`)**

```tsx
const promptMissing = !generating && !prompt.trim();
<Button
  onClick={onGenerate}
  disabled={generating || !prompt.trim()}
  aria-describedby={promptMissing ? promptHintId : undefined}
  className="w-full bg-(--accent) text-(--on-accent) hover:brightness-110 disabled:opacity-50"
  size="lg"
>
  …
</Button>;
{
  promptMissing && (
    <p id={promptHintId} className="mt-2 text-center text-xs text-(--muted)">
      {t("studioPromptRequired")}
    </p>
  );
}
<p className="text-xs text-(--faint) pointer-coarse:hidden">{t("studioShortcutHint")}</p>;
```

**6.3 Gallery M3**

```tsx
const isEmptyLibrary = !g.loading && g.images.length === 0;
{
  !isEmptyLibrary && <>{/* tìm kiếm + bộ lọc (h-10) + dòng đếm + So sánh */}</>;
}
<button
  type="button"
  aria-pressed={g.showFavoritesOnly}
  className={cn(
    "h-10 …",
    g.showFavoritesOnly
      ? "border-(--accent) bg-(--soft) text-(--accent)"
      : "border-(--line) text-(--muted)"
  )}
>
  …
</button>;
```

**6.4 Bảng đổi màu chính (áp dụng nhất quán)**

| Cũ                                                                      | Mới                                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `bg-linear-to-r from-purple-600 to-blue-600 … text-white`               | `bg-(--accent) text-(--on-accent)`                                                      |
| `bg-purple-500/10 border-purple-500/30` (trạng thái bật/chọn)           | `bg-(--soft) border-(--accent)`                                                         |
| `text-purple-300/400`, `hover:border-purple-500/20..40`                 | `text-(--accent)`, `hover:border-(--accent)`                                            |
| `bg-purple-500 text-white` (ô icon bật)                                 | `bg-(--accent) text-(--on-accent)`                                                      |
| `text-red-400 bg-red-500/8 border-red-500/20` (Exclude)                 | `text-(--danger) bg-(--danger)/10 border-(--danger)/30`                                 |
| `text-blue-400 bg-blue-500/8 …` (mẹo chữ)                               | `text-(--muted) bg-(--raised) border-(--line)`                                          |
| Overlay trên ảnh `bg-purple-500/80`, `bg-blue-500/80`, `bg-pink-500/80` | `bg-black/60 text-white`; trạng thái bật (yêu thích) `bg-(--accent) text-(--on-accent)` |

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-13 → **đỏ**.
- [ ] **B2 — `ImageSectionHeader`** + i18n.
- [ ] **B3 — Tách `ControlPanel`** (di chuyển nguyên khối, chạy test → xanh trước khi đổi màu) rồi đổi token/nhãn/M5.
- [ ] **B4 — `ImageGenStudio`, `Canvas`, `EditPanel`**.
- [ ] **B5 — `DescribeImageView`**.
- [ ] **B6 — `GalleryView` (M3)** + `Sidebar` nhãn.
- [ ] **B7 — Verify** §9 + `tests/e2e/a11y.spec.ts` (3D) + QA Playwright 1440/768/375 ở `/images`, `/gallery` (0 ảnh và có ảnh), `/describe`, theme Hoàng hôn + Mực sáng.
- [ ] **B8 — Living docs**.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                          | Input                                                 | Kỳ vọng                                                                                                                                                   |
| ----- | ----------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `ImageSectionHeader.test.tsx` | `usePathname` = `/gallery`                            | Một `h1` "Ảnh"; `nav` tên "Chế độ ảnh" có 3 link với `href` `/images`, `/gallery`, `/describe`; chỉ "Thư viện" có `aria-current="page"`                   |
| TC-02 | `ImageSectionHeader.test.tsx` | `usePathname` = `/images/abc` (Negative)              | Không link nào có `aria-current`; tab không chọn có `border-transparent`                                                                                  |
| TC-03 | `ControlPanel.test.tsx`       | render mặc định                                       | Không phần tử nào có class `uppercase`; không class chứa `purple`/`indigo`/`from-`; không chữ "Studio" tiêu đề; các tên của 3D vẫn còn (⚙, Switch, Model) |
| TC-04 | `ControlPanel.test.tsx`       | `prompt = ""`, `generating = false`                   | Nút Tạo `disabled`, `aria-describedby` trỏ đoạn "Nhập prompt để bắt đầu"; nút có `bg-(--accent)` + `text-(--on-accent)`                                   |
| TC-05 | `ControlPanel.test.tsx`       | `prompt = "mèo"` / `generating = true` (Negative)     | Không có đoạn "Nhập prompt để bắt đầu"; không có `aria-describedby`                                                                                       |
| TC-06 | `ControlPanel.test.tsx`       | render                                                | Gợi ý phím tắt có class `pointer-coarse:hidden` và `text-xs`; không còn `text-[9px]`/`text-[10px]`/`text-[11px]` trong cây render                         |
| TC-07 | `Canvas.test.tsx`             | `images = []` (empty state) và 1 ảnh yêu thích        | Không class chứa `purple`/`pink`/`blue-500`; nút yêu thích đang bật có `bg-(--accent)`                                                                    |
| TC-08 | `DescribeImageView.test.tsx`  | render (mock `AppFrame`, `usePathname` = `/describe`) | Đúng một `h1` "Ảnh"; tab "Mô tả ảnh" `aria-current="page"`; vùng thả ảnh không class `purple`; không `uppercase`                                          |
| TC-09 | `GalleryView.test.tsx`        | `images = []`, `loading = false`                      | Không có ô tìm kiếm, không `combobox`, không nút "So sánh"; vẫn có EmptyState + link `/images` (giữ TC-10 cũ)                                             |
| TC-10 | `GalleryView.test.tsx`        | có ảnh, `availableModels = ["m1"]`                    | Ô tìm kiếm, 2 `select`, nút Yêu thích đều có `h-10`; Yêu thích có `aria-pressed="false"`, bấm → `setShowFavoritesOnly(true)`                              |
| TC-11 | `GalleryView.test.tsx`        | `loading = true`, `images = []` (Negative)            | Bộ lọc **vẫn hiện** (đang tải chưa phải thư viện trống); có skeleton                                                                                      |
| TC-13 | `ImageSectionHeader.test.tsx` | render bất kỳ (Revision 2)                            | `header` có `h-12` và `md:h-15`; `h1` có `sr-only` và `md:not-sr-only` (vẫn là heading cấp 1 truy cập được)                                               |
| TC-12 | `Sidebar.test.tsx`            | `section` khu Ảnh                                     | Panel có liên kết "Tạo ảnh", "Thư viện", "Mô tả ảnh"; tiêu đề panel "Ảnh"                                                                                 |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có** — `GalleryView.test.tsx` giữ nguyên ca "single page h1" (`src/app/features/gallery/components/GalleryView.test.tsx:88`) và "TC-10 empty state" (`src/app/features/gallery/components/GalleryView.test.tsx:95`), chỉ thêm ca; `Canvas.test.tsx` không khẳng định màu (A13). Nếu `Sidebar.test.tsx` hoặc ca cũ nào đỏ vì nhãn, dừng và ghi tên ca vào Audit History trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/features/image-gen src/app/features/gallery src/app/features/sidebar --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
npx prettier --check --end-of-line auto <các file đã sửa>
```

**Wiring Probes**: W1 Grep `purple|indigo|fuchsia` trong `ControlPanel*.tsx`, `Canvas.tsx`, `DescribeImageView.tsx`, `GalleryView.tsx` → 0. W2 Grep `uppercase` trong cùng nhóm file → 0. W3 Grep `text-\[(8|9|10|11)px\]` trong `ControlPanel*.tsx`, `Canvas.tsx` → 0. W4 `wc -l ControlPanel.tsx` ≤ 500. W5 Grep `ImageSectionHeader` trong `ImageGenStudio.tsx`, `GalleryView.tsx`, `DescribeImageView.tsx` → mỗi file 1. W6 QA: ở 3 trang đúng một `h1`; bấm tab đổi URL; theme Mực (sáng) nút Tạo màu xanh mực, không còn tím. **(Revision 2)** W7 QA 375×667 `/images`: `boundingBox` của ô prompt và nút Tạo đều nằm trong viewport khi chưa cuộn. W8 QA context `hasTouch: true, isMobile: true` → gợi ý Ctrl+Enter có `display: none`; context desktop → hiện.

**Negative Probes** (hoàn tác sau mỗi probe): N1 bỏ `aria-current` trong `ImageSectionHeader` → TC-01 đỏ. N2 bỏ điều kiện `isEmptyLibrary` (luôn hiện bộ lọc) → TC-09 đỏ. N3 bỏ `aria-describedby` của nút Tạo → TC-04 đỏ. N4 trả gradient tím cho nút Tạo → TC-03 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                              | Mức        | Control                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tách `ControlPanel` làm đổi hành vi (state, ref ô nhập, autocomplete)                                                                               | Trung bình | Di chuyển nguyên khối JSX + truyền props tường minh; chạy test trước/sau bước tách; QA gõ prompt, Quick add, Exclude, lịch sử                                      |
| Mất tên truy cập 3D khi viết lại phần tử                                                                                                            | Trung bình | TC-03 khẳng định lại; chạy `tests/e2e/a11y.spec.ts`                                                                                                                |
| **(Revision 2)** Header cố định chiếm chỗ trên mobile (khối "Studio" cũ nằm trong vùng cuộn nên không bù được); hai hàng tab chồng nhau trên Studio | Trung bình | Header mobile gọn `h-12`, `h1` chỉ cho trình đọc màn hình (TC-13); bỏ khối tiêu đề Studio để form bắt đầu cao hơn; W7 đo ô prompt + nút Tạo trong viewport 375×667 |
| Overlay trên ảnh mất tương phản khi đổi sang token                                                                                                  | Thấp       | Giữ `bg-black/60 text-white` cho chữ đè ảnh (ngoại lệ có chủ đích); chỉ đổi trạng thái bật sang `--accent`                                                         |
| Theme sáng: `--soft` quá nhạt trên `--surface` cho trạng thái bật                                                                                   | Thấp       | Trạng thái bật có thêm viền `--accent` (không chỉ dựa vào nền); QA theme Mực sáng                                                                                  |

### Lộ Trình

| Bước | Nội dung                                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| 4    | **Plan này** — header + tab khu Ảnh, token màu Studio/Describe/Gallery, M3, M5, tách `ControlPanel`                           |
| 4B   | (Tùy PM) Form Studio theo canvas: tỷ lệ dạng thẻ icon, chip phong cách, "Tạo N ảnh", dải "Trước đó"                           |
| 5    | Novelcrafter theo canvas (H1)                                                                                                 |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô, thẻ ảnh Gallery dùng được bằng bàn phím, gỡ alias token |

### 11. Ghi Chú Triển Khai (sai khác so với plan)

- **Thẻ mẫu "Needs photo"** trong `Canvas` xuống 2 dòng sau khi tăng cỡ chữ từ 10 lên 12px → thêm `whitespace-nowrap`, icon 12px.
- **A11y bổ sung khi tách khối Prompt**: ô prompt và ô Exclude có `aria-label`; nút Free/Guided có `aria-pressed`; Exclude/Lịch sử/tỷ lệ mở rộng có `aria-expanded`; nút xóa ảnh tham chiếu có `aria-label`.
- **Test Gallery**: modal chi tiết ảnh (mở sẵn trong mock) ẩn phần còn lại khỏi cây a11y, nên ca header tắt modal trước khi truy vấn `navigation`.
- **QA Playwright** (`/images`, `/gallery`, `/describe` ở 1440 / 375×667 / 375×812; theme Hoàng hôn + Mực sáng; context cảm ứng Pixel 7): đúng một `h1` mỗi trang; tab đổi URL; ô prompt (y 275–403) và nút Tạo (y 583–627) nằm trong viewport 375×667; gợi ý Ctrl+Enter `display: none` khi cảm ứng, `block` trên desktop; thư viện trống không còn ô tìm kiếm/bộ lọc; nút Tạo ở theme Mực sáng `rgb(52, 81, 209)` = `--accent`; không tràn ngang ở 375px.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định "Tự review ở đây")]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-4-images-section-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS toàn bộ, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- A1–A14 khớp source. Kiểm thêm bố cục mobile của Studio.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                   | Bằng chứng                                                                                                                                                                                                                                                                                                                            | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------- | ------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/image-gen/components/ControlPanel.tsx:214`  | [SRC] Khối tiêu đề "Studio" nằm **bên trong** vùng cuộn `flex-1 overflow-y-auto` nên cuộn đi mất; trên mobile cột nội dung đã chừa `4.75rem` cho `HeaderBar` (`src/app/features/image-gen/components/ImageGenStudio.tsx:170`) và có thêm thanh tab Tùy chỉnh/Kết quả (`src/app/features/image-gen/components/ImageGenStudio.tsx:177`) | §10 khẳng định "header 60px thay khối tiêu đề cũ nên tổng gần như không đổi" — **sai**: header mới cố định, không cuộn, nên trên 375×667 vùng làm việc mất thêm 60px vĩnh viễn và có **hai hàng tab chồng nhau** (khu Ảnh + Tùy chỉnh/Kết quả). **Sửa**: định nghĩa bố cục mobile rõ ràng (header gọn, `h1` chỉ còn cho trình đọc màn hình trên mobile), thêm ca test và bước QA đo vùng còn lại. |
| 2   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/EditPanel.tsx:438`     | [SRC] Gợi ý Ctrl+Enter 9px; `pointer-coarse:` chỉ được chứng minh qua phiên bản Tailwind (A14)                                                                                                                                                                                                                                        | Thêm wiring probe: QA Playwright với context `hasTouch: true, isMobile: true` (Chrome đặt `pointer: coarse`) → gợi ý `display: none`; desktop → hiện.                                                                                                                                                                                                                                             |
| 3   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/ImageGenStudio.tsx:78` | [SRC] `h1` sr-only "Studio" hiện tại                                                                                                                                                                                                                                                                                                  | Câu ở §6.1 về vị trí header Studio viết lửng ("trên `HeaderBar`-mobile? — không: …"); viết lại dứt khoát. Đảm bảo xóa `h1` sr-only để trang chỉ còn một `h1`.                                                                                                                                                                                                                                     |
| 4   | RISK_DISMISSED | —       | `src/app/features/gallery/components/GalleryView.test.tsx:88` | [SRC] Ca "single page h1" mock `AppFrame`, không mock `next/navigation`                                                                                                                                                                                                                                                               | `ImageSectionHeader` dùng `usePathname`; trong jsdom không có router context hook trả `null` (không ném lỗi) → không tab nào `aria-current`, ca cũ vẫn xanh. Ca mới TC-08/TC-01 mock `usePathname` tường minh.                                                                                                                                                                                    |

#### Kết Luận

1 `[MAJOR]` → cần Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định); Critic Pass miễn theo cách PM đã chọn ở các plan trước (`CRITIC_REQUIRED no`) — PM có thể yêu cầu chạy]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-4-images-section-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` → **đã xử lý**: §1.1 định nghĩa bố cục mobile (header `h-12`, `h1` `sr-only md:not-sr-only`), §10 sửa lại rủi ro cho đúng (header cố định không bù được bằng khối "Studio" trong vùng cuộn), thêm TC-13 và W7 đo ô prompt + nút Tạo trong viewport 375×667.
- Audit Run 1 #2 `[MINOR]` → **đã xử lý**: W8 kiểm `pointer-coarse:` bằng context cảm ứng thật.
- Audit Run 1 #3 `[MINOR]` → **đã xử lý**: §6.1 viết lại vị trí header Studio, nêu rõ xóa `h1` sr-only.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                  | Bằng chứng                                                                                | Lý do / Hướng xử lý khi code                                                                                                                             |
| --- | -------------- | ------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_ACCEPTED  | [MINOR] | `src/app/features/sidebar/components/Sidebar.tsx:142-144`    | [SRC] Panel trái và tab header cùng dẫn tới 3 trang (D2)                                  | Trùng điều hướng trên desktop có chủ đích (panel cho chuột, tab dùng được cả mobile); nhãn đã thống nhất. Xem lại khi làm 4B.                            |
| 2   | DEFECT         | [MINOR] | `src/app/features/image-gen/components/ControlPanel.tsx:322` | [SRC] Gợi ý phím tắt nằm trong khối Prompt sẽ chuyển sang `ControlPanelPromptSection.tsx` | TC-06 render `ControlPanel` không mock khối con để vẫn thấy gợi ý; nếu sau này mock khối con thì chuyển TC-06 sang test của `ControlPanelPromptSection`. |
| 3   | RISK_DISMISSED | —       | `src/app/features/image-gen/components/Canvas.test.tsx:45`   | [SRC] Test Canvas chỉ khẳng định lớp focus/hover và tên nút                               | Đổi màu overlay không làm đỏ ca cũ; không có Loại C.                                                                                                     |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-02, TC-05, TC-11) và Negative Probe N1–N4; không có ca test cũ bị thay. Plan đạt chuẩn để triển khai **sau** 3D.

[PLAN_APPROVED]
