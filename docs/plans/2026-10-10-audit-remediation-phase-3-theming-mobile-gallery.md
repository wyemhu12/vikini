# Kế Hoạch Triển Khai: Giai Đoạn 3 — Theming, Mobile/Foldable & Gallery UX (Phase 3 Remediation - Revision 3)

> **Mã Tài Liệu**: `docs/plans/2026-10-10-audit-remediation-phase-3-theming-mobile-gallery.md`  
> **Ngày Lập**: 10/10/2026  
> **Ngày Cập Nhật**: 10/10/2026  
> **Phiên Bản (Revision)**: 3 (Khắc phục dứt điểm 2 lỗi [MAJOR] M7, M8 cùng 5 góp ý [MINOR] m8–m12 từ Audit Run 2 của Claude Code CLI: chuẩn hóa cấu hình Framer Motion dragConstraints={left:0,right:0} kèm dragSnapToOrigin và mock wiring trong Sidebar.test.tsx; bổ sung translation key closeImageDetails chuẩn Rule 04 vào vi.ts và en.ts; đồng bộ số đo WCAG thực tế; safe-area non-landing cho ChatControls; stub getBoundingClientRect happy-dom; sẵn sàng thẩm định Audit Run 3)  
> **Tác Giả**: Technical Planner (Vikini Antigravity)  
> **Trạng Thái**: Status: Ready for Review  
> **Tài Liệu Căn Cứ**: [`docs/audit-report-2026-10-01.md`](../audit-report-2026-10-01.md), [`.agents/rules/00-core.md`](../../.agents/rules/00-core.md), [`.agents/rules/01-coding.md`](../../.agents/rules/01-coding.md), [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md), [`.agents/rules/03-ui.md`](../../.agents/rules/03-ui.md), [`.agents/rules/04-bilingual.md`](../../.agents/rules/04-bilingual.md), [`.agents/rules/05-plan-review.md`](../../.agents/rules/05-plan-review.md)

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Khắc phục triệt để các khiếm khuyết về hệ thống Giao diện (Theming & Contrast), Trải nghiệm Di động & Thiết bị gập (Mobile & Foldable UX), cùng các lỗi trong phân hệ Gallery & Image Studio được ghi nhận trong Báo cáo Audit toàn diện `docs/audit-report-2026-10-01.md` (Mục 2, Mục 4.3, Mục 6 và Mục 7), tích hợp toàn diện các chỉ dẫn kỹ thuật từ Audit Run 1 (M1–M6) và Audit Run 2 (M7–M8, m8–m12):

1. **THEME-01 & THEME-02 + Chuẩn Hóa Color Contrast WCAG AA (M1, M5, m1, m2, m7, m8, m9)**:
   - Sửa theme Orchid Silk trong `src/lib/config/theme-config.ts` từ `tone: "dark"` thành `tone: "light"`; tách `:root.theme-orchid` khỏi khối `color-scheme: dark;` trong `src/app/styles/themes/_shared/base.css` và thiết lập `color-scheme: light;` cho `.theme-orchid` trong `src/app/styles/themes/glassmorphism/orchid.css` và `base.css`.
   - Bổ sung biến CSS token `--surface-elevated` cho 10 file theme CSS đang thiếu: 7 file nhóm Focus (`amber.css`, `blueprint.css`, `charcoal.css`, `gold.css`, `indigo.css`, `red.css`, `rose.css`) và 3 file nhóm Red Alert 2 (`allied.css`, `soviet.css`, `yuri.css`), loại bỏ hiện tượng Dialog, Popover, Card bị rơi về màu xám lạnh mặc định `#0f1115`.
   - Chuẩn hóa token `--accent-foreground`: Đảm bảo 100% 16 themes sử dụng giá trị kế thừa từ `:root` là `--accent-foreground: #0a0a0a;` (đo lường thực tế dải 5.00:1 đến 14.12:1, vượt ngưỡng WCAG AA 4.5:1). Tuyệt đối không gán `#ffffff` cho Orchid, Yuri (`#a855f7` + `#ffffff` chỉ đạt 3.96:1) hay Soviet (`#ef4444` + `#ffffff` chỉ đạt 3.76:1).
   - Thay thế raw color class `text-white` trên nền `bg-(--accent)` bằng `text-(--accent-foreground)` tại 4 vị trí:
     (a) `src/components/ui/error-boundary.tsx:76` (nút reload);
     (b) `src/app/features/gallery/components/GalleryView.tsx:152` (nút Compare Now);
     (c) `src/app/features/gallery/components/GalleryView.tsx:228` (chỉ báo Compare Mode Selection);
     (d) `src/app/features/gallery/components/GalleryView.tsx:385` (nút Remix).
   - Bổ sung accessible focus rings (`focus-visible:ring-2 focus-visible:ring-(--ring)`) cho các nút tương tác.
2. **Trải Nghiệm Mobile & Thiết Bị Gập (Foldables UX) (M3, M4, M6, M7, m4, m10, m12)**:
   - Thêm thuộc tính `interactiveWidget: "resizes-content"` vào `export const viewport` trong `src/app/layout.tsx` theo chuẩn W3C VirtualKeyboard API và Next.js 16 metadata, ngăn bàn phím ảo che khuất thanh chat input và `ChatControls` trên thiết bị di động.
   - Bổ sung safe-area horizontal padding (`--sal`, `--sar`) cho `ChatControls.tsx` (áp dụng riêng cho nhánh non-landing fixed bar để tránh cộng dồn). Đối với `HeaderBar.tsx`, bổ sung safe-area padding cho mobile kèm `md:px-6` để reset trên desktop/tablet ngang, triệt tiêu hoàn toàn lỗi cộng dồn safe-area hai lần với container cha `ChatApp.tsx:750`.
   - Khắc phục lỗi tràn viền màn hình ngoài Samsung Galaxy Z Fold (~280px) trong `src/components/ui/popover.tsx` bằng cơ chế trần `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]` ở base component, đảm bảo `twMerge` không thể bị vô hiệu hóa khi caller truyền `className="w-80"`, `w-72`, `w-56`.
   - Cử chỉ vuốt chạm Mobile Drawer chuẩn mực (M7): Tách hàm thuần `shouldCloseDrawer(info)` trong `src/app/features/sidebar/utils/drawerGesture.ts`; cấu hình `motion.aside` với `drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.5, right: 0 }} dragSnapToOrigin` để drawer tự động bật hồi quy về `x = 0` nếu người dùng kéo dở dưới ngưỡng đóng; lọc sạch props framer trong `Sidebar.test.tsx` tránh HTML attribute warning và gắn nhầm event `dragend`.
3. **Sửa Lỗi Giao Diện Gallery & Image Studio (UI-02, UI-03, API-02, A11Y-01, M2, M8, m3, m11)**:
   - **UI-02 & M8 (Bilingual Rule 04)**: Bổ sung translation key `closeImageDetails` vào cả `src/lib/utils/translations/vi.ts` ("Đóng chi tiết hình ảnh") và `en.ts` ("Close image details"). Chuẩn hóa nút đóng modal chi tiết trong `src/app/features/gallery/components/GalleryView.tsx`: sửa class `hover:text-(--text)` thành `hover:text-(--text-primary)`, `focus-visible:ring-blue-500/50` thành `focus-visible:ring-(--ring)`. Bổ sung floating close button tiện dụng cho di động bọc trong thẻ `div` (tránh bị `[&>button]:hidden` của `DialogContent` giấu mất), mang class `lg:hidden` và `aria-label={g.t("closeImageDetails")}`.
   - **UI-03 & m11**: Bổ sung sự kiện vuốt chạm `onTouchStart` và `onTouchMove` cho thanh trượt so sánh ảnh trong `src/app/features/gallery/components/ImageCompareModal.tsx`, thêm `touch-none` để người dùng di động / foldable vuốt so sánh ảnh mượt mà không bị gián đoạn do cuộn trang. Test stub `getBoundingClientRect()` để tránh NaN trong môi trường happy-dom.
   - **API-02 & M2**: Cập nhật file test hiện có `src/app/api/gallery/route.test.ts` (`[MODIFY]`, không ghi đè 22 tests hiện có): assert query builder gọi `.neq("conversations.model", MODEL_IDS.USER_TEMPLATES_STORE)`, assert không có lệnh nào loại trừ `MODEL_IDS.IMAGE_STUDIO`, assert query lọc `favorites=true`, và sửa fixture comment lỗi thời ở dòng 115.
   - **A11Y-01**: Bổ sung `group-focus-within:opacity-100` và `group-focus-within:translate-y-0` cho Canvas overlay trong `src/app/features/image-gen/components/Canvas.tsx:228, 230, 297` để lớp điều khiển hiển thị đầy đủ khi duyệt bằng phím Tab (WCAG 2.2 Level AA).
4. **Co-located Tests & Verification**:
   - Viết các bộ test co-located mới:
     - `[NEW] src/app/features/sidebar/utils/drawerGesture.ts` và `[NEW] src/app/features/sidebar/utils/drawerGesture.test.ts` (test hàm thuần đóng drawer với các giá trị biên `-79`, `-80`, `-81`, velocity `-299`, `-300`, `-301`).
     - `[NEW] src/lib/config/theme-config.test.ts` (test 16 themes, Orchid tone "light", trích xuất CSS và tính toán toán học WCAG contrast ≥ 4.5:1 với fallback `:root`).
     - `[NEW] src/components/ui/popover.test.tsx` (test `max-w-*` không bị ghi đè bởi `className="w-80"`).
     - `[NEW] src/components/ui/error-boundary.test.tsx` (test ErrorBoundary token contrast và action).
     - `[NEW] src/app/features/gallery/components/ImageCompareModal.test.tsx` (test mouse & touch events với stub getBoundingClientRect).
     - `[NEW] src/app/features/image-gen/components/Canvas.test.tsx` (test Canvas overlay keyboard focus-within).
   - Cập nhật các test hiện có:
     - `[MODIFY] src/app/api/gallery/route.test.ts` (bổ sung assert query builder Image Studio, User Templates, Favorites).
     - `[MODIFY] src/app/features/gallery/components/GalleryView.test.tsx` (test modal close aria-label closeImageDetails, Remix/Compare contrast).
     - `[MODIFY] src/app/features/sidebar/components/Sidebar.test.tsx` (mock framer-motion lọc props, capture onDragEnd simulation).
     - `[MODIFY] src/app/features/layout/HeaderBar.test.tsx` (test safe-area padding và `md:px-6`).
   - Xác thực toàn bộ bằng lệnh `npm run verify` (`npm run type-check; npm run lint; npm run test:run`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ nghiêm ngặt Giao thức Pre-Work trong [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md):

| Lĩnh Vực / Module                       | Tài Liệu Bắt Buộc Đọc Trước Khi Viết Code                                                             | Quy Chuẩn Kỹ Thuật Áp Dụng                                                                                                        |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| **Theming & Design Tokens**             | [`.agents/rules/03-ui.md`](../../.agents/rules/03-ui.md), `src/app/styles/themes/_shared/base.css`    | Sử dụng Vikini token vocabulary (`--surface-elevated`, `--accent-foreground`), cấm raw Tailwind colors (`text-white`, `blue-500`) |
| **Color Contrast & WCAG 2.2**           | W3C WCAG 2.2 Success Criterion 1.4.3 (Contrast Minimum: 4.5:1), SC 2.4.11 (Focus Appearance)          | `--accent-foreground: #0a0a0a` đạt tỷ lệ tương phản tối thiểu 4.5:1 trên 100% 16 theme accents; `focus-visible:ring-2`            |
| **Bilingual Localization (Rule 04)**    | [`.agents/rules/04-bilingual.md`](../../.agents/rules/04-bilingual.md), `src/lib/utils/translations/` | Cấm hardcoded text trên UI; mọi `aria-label` người dùng tiếp cận được phải qua translation key (`closeImageDetails`)              |
| **Mobile Viewport & VirtualKeyboard**   | W3C VirtualKeyboard API Specification, Next.js 16 Metadata Viewport Spec                              | `interactiveWidget: "resizes-content"` trên Next.js `Viewport` export                                                             |
| **Safe Area Insets & Deduplication**    | `src/app/features/chat/components/ChatApp.tsx:750`, W3C CSS Environment Variables                     | Dùng `pl/pr` safe-area trên mobile, reset bằng `md:px-6` trên desktop/tablet; tách riêng nhánh non-landing cho ChatControls       |
| **Touch Events & Gesture Interaction**  | W3C Touch Events Level 2, Framer Motion v12 Drag Gesture Documentation                                | `dragConstraints={{ left: 0, right: 0 }}`, `dragElastic={{ left: 0.5, right: 0 }}`, `dragSnapToOrigin`, `shouldCloseDrawer`       |
| **Responsive Containers & Breakpoints** | [`.agents/rules/03-ui.md`](../../.agents/rules/03-ui.md) (§ Anti-Patterns), Tailwind CSS `twMerge`    | Sử dụng `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]` ngăn ghi đè class width bởi `twMerge`  |
| **Co-located Testing Standards**        | [`.agents/rules/01-coding.md`](../../.agents/rules/01-coding.md), Vitest 4 Documentation              | Co-located tests `*.test.ts` / `*.test.tsx`, mock đầy đủ context, test cả happy path lẫn error/boundary cases                     |

---

### 3. Assumptions & Cross-Task Dependencies

1. **Hệ Thống Phân Lớp Theming & Trạng Thái Metadata (m1)**:
   - `ThemeProvider` trong `src/app/features/layout/providers.tsx` quản lý theme thông qua `next-themes` với `attribute="class"`, sinh ra các class dạng `theme-<id>` trên thẻ `<html>` (`:root`).
   - `base.css` định nghĩa các biến mặc định cho `:root`, đồng thời thiết lập `color-scheme: dark;` cho các class theme tối.
   - **Ghi chú kiến trúc (m1)**: Thuộc tính `tone` trong `THEME_CONFIG` đóng vai trò là metadata định danh chế độ cho component và hook `useTheme`. Các rule selector `:root[data-theme-tone=...]` trong `base.css:139–166` hiện là dead code (không có runtime client/server nào gán thuộc tính `data-theme-tone`). Hệ thống kích hoạt giao diện hoàn toàn dựa vào class `.theme-<id>` trên `:root`. Việc sửa `tone: "light"` cho Orchid là chuẩn hóa schema và logic metadata, đồng thời việc phân chia scheme thực tế được đảm bảo tuyệt đối qua CSS selector riêng `:root.theme-orchid { color-scheme: light; }`.
2. **Giá Trị `--surface-elevated` Cho 10 Theme CSS Đang Thiếu**:
   - `blueprint`: `--surface-elevated: #131b2e;` (nâng tông từ `--surface-muted: #0e1422`, hòa quyện với navy blueprint).
   - `amber`: `--surface-elevated: #1e1810;` (nâng tông từ `--surface-muted: #14100a`).
   - `charcoal`: `--surface-elevated: #1a1a1a;` (nâng tông từ `--surface-muted: #111111`).
   - `gold`: `--surface-elevated: #1f190e;` (nâng tông từ `--surface-muted: #141008`).
   - `indigo`: `--surface-elevated: #161b30;` (nâng tông từ `--surface-muted: #0f1220`).
   - `red`: `--surface-elevated: #1c0f0f;` (nâng tông từ `--surface-muted: #120909`).
   - `rose`: `--surface-elevated: #1f171c;` (nâng tông từ `--surface-muted: #151013`).
   - `allied`: `--surface-elevated: rgba(32, 38, 52, 0.96);` (hài hòa với Allied blue glass).
   - `soviet`: `--surface-elevated: rgba(42, 20, 20, 0.96);` (hài hòa với Soviet red glass).
   - `yuri`: `--surface-elevated: rgba(38, 24, 52, 0.96);` (hài hòa với Yuri purple glass).
3. **Phối Màu `--accent-foreground` Chuẩn Tương Phản WCAG AA (M1, m8, m9)**:
   - Đo lường toán học chính xác theo W3C WCAG 2.2 Relative Luminance (với `#0a0a0a` có `L ≈ 0.0030`, `#ffffff` có `L = 1.0`):
     - `gold` (`#ffd700`) + `#0a0a0a`: **14.12:1** (PASS WCAG AAA)
     - `holo` (`#22d3ee`) + `#0a0a0a`: **10.96:1** (PASS WCAG AAA)
     - `nebula` (`#22d3ee`) + `#0a0a0a`: **10.96:1** (PASS WCAG AAA)
     - `allied` (`#38bdf8`) + `#0a0a0a`: **9.24:1** (PASS WCAG AAA)
     - `amber` (`#f59e0b`) + `#0a0a0a`: **9.22:1** (PASS WCAG AAA)
     - `aqua` (`#14b8a6`) + `#0a0a0a`: **7.95:1** (PASS WCAG AAA)
     - `pitch-black` (`#9ca3af`) + `#0a0a0a`: **7.80:1** (PASS WCAG AAA)
     - `blueprint` (`#60a5fa`) + `#0a0a0a`: **7.79:1** (PASS WCAG AAA)
     - `charcoal` (`#8ba3be`) + `#0a0a0a`: **7.62:1** (PASS WCAG AAA)
     - `rose` (`#fb7185`) + `#0a0a0a`: **7.36:1** (PASS WCAG AA)
     - `red` (`#f87171`) + `#0a0a0a`: **7.16:1** (PASS WCAG AA)
     - `sunset` (`#f97316`) + `#0a0a0a`: **7.06:1** (PASS WCAG AA)
     - `indigo` (`#818cf8`) + `#0a0a0a`: **6.64:1** (PASS WCAG AA)
     - `soviet` (`#ef4444`) + `#0a0a0a`: **5.26:1** (PASS WCAG AA, trong khi `#ffffff` chỉ đạt **3.76:1** -> FAIL)
     - `orchid` (`#a855f7`) + `#0a0a0a`: **5.00:1** (PASS WCAG AA, trong khi `#ffffff` chỉ đạt **3.96:1** -> FAIL)
     - `yuri` (`#a855f7`) + `#0a0a0a`: **5.00:1** (PASS WCAG AA, trong khi `#ffffff` chỉ đạt **3.96:1** -> FAIL)
   - **Kết luận kiến trúc (M1, m9)**: Toàn bộ 16 theme đều đạt chuẩn WCAG AA (≥ 4.5:1) khi sử dụng `--accent-foreground: #0a0a0a;`. Giá trị này đã được định nghĩa tại `:root` trong `base.css:93`, do đó tất cả theme tự động kế thừa an toàn. Tuyệt đối KHÔNG gán `--accent-foreground: #ffffff;` cho Orchid, Yuri, Soviet. Trong bộ test, parser sẽ đọc từ `.theme-<id>` và tự động fallback về `:root` của `base.css`.
4. **Trải Nghiệm Màn Hình Gập & Cơ Chế Max-Width Cho Popover (M3)**:
   - Các component gọi Popover (`ChatControls.tsx:255` `w-80`, `IconPicker.tsx:137` `w-72`, `GemQuickSwitch.tsx:80` `w-56`, `PersonaQuickSwitch.tsx:83` `w-56`) đều truyền `className="w-*"` vào `PopoverContent`.
   - Vì hàm `cn()` sử dụng `twMerge`, việc đổi lớp `w-72` cơ sở sẽ bị `w-80` của consumer ghi đè hoàn toàn. Do đó, kỹ thuật bắt buộc là đặt giới hạn trần bằng `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]`. Vì `max-w-*` và `w-*` thuộc hai nhóm thuộc tính CSS độc lập trong `twMerge`, thuộc tính `max-w-*` sẽ luôn được giữ lại và ép Popover không bao giờ vượt quá viewport width trừ khoảng đệm 2rem.
5. **Hiện Trạng API Gallery Route & Bộ Test (M2)**:
   - `src/app/api/gallery/route.test.ts` ĐÃ TỒN TẠI (589 dòng, 22 tests pass). Thao tác với file này phải là `[MODIFY]`, tuyệt đối không ghi đè làm mất bộ test hiện có.
   - Thêm các kiểm tra xác thực query builder của Supabase: đảm bảo `.neq("conversations.model", MODEL_IDS.USER_TEMPLATES_STORE)` được gọi; đảm bảo KHÔNG có filter nào loại trừ `MODEL_IDS.IMAGE_STUDIO`; và kiểm tra filter `favorites=true`.
6. **Deduplication Safe-Area Giữa HeaderBar và ChatApp (M4, m10)**:
   - `ChatApp.tsx:750` đã áp dụng padding ngang safe-area ở `md+`: `md:pl-[calc(...+var(--sal,0px))] pr-[var(--sar,0px)]`.
   - `HeaderBar` ở `md:` trở lên là `md:sticky` nằm bên trong `ChatApp`. Nếu `HeaderBar` dùng `sm:pl-[calc(1.5rem+var(--sal))]` thì safe-area sẽ bị cộng dồn hai lần ở landscape tablet/desktop. Bắt buộc có `md:px-6` để reset.
   - Đối với `ChatControls.tsx`, chỉ bổ sung safe-area ngang cho nhánh non-landing (fixed bar trên mobile), không đặt vào chuỗi class dùng chung để tránh nhánh landing (`relative`) bị cộng dồn `--sar` hai lần.
7. **Cơ Chế Drag Drawer và Snap-To-Origin (M7, m4)**:
   - Khi cấu hình `dragConstraints={{ left: 0, right: 0 }}` kết hợp `dragElastic={{ left: 0.5, right: 0 }}` và `dragSnapToOrigin`, Framer Motion bảo đảm nếu người dùng buông tay khi chưa đạt ngưỡng đóng (`offset.x > -80` và `velocity.x > -300`), drawer sẽ tự động bật hồi quy về `x = 0`, không bị kẹt lơ lửng giữa màn hình.

---

### 4. Bảng Verified Versions (Năm 2026)

| Thư Viện / Nền Tảng         | Phiên Bản Thực Tế 2026 | Vai Trò Trong Dự Án & Phạm Vi Tác Động Giai Đoạn 3                                                                  |
| :-------------------------- | :--------------------: | :------------------------------------------------------------------------------------------------------------------ |
| **Next.js**                 |       `^16.1.1`        | App Router, quản lý Viewport metadata (`interactiveWidget: "resizes-content"`), API Routes handler                  |
| **React & React DOM**       |       `^19.2.3`        | Xử lý sự kiện touch / mouse, ref callbacks, client-side rendering                                                   |
| **Tailwind CSS**            |       `^4.1.18`        | Tailwind v4 arbitrary property syntax (`bg-(--surface-elevated)`, `text-(--accent-foreground)`, `max-w-[min(...)]`) |
| **Framer Motion**           |      `^12.23.26`       | Cử chỉ vuốt chạm Drawer (`drag="x"`, `dragDirectionLock`, `dragConstraints={{left:0,right:0}}`, `dragSnapToOrigin`) |
| **@radix-ui/react-popover** |       `^1.1.15`        | Popover primitive, responsive floating positioning                                                                  |
| **next-themes**             |        `^0.4.6`        | Theme class switching trên thẻ root `<html>`                                                                        |
| **Lucide Icons**            |       `^0.562.0`       | Icon thư viện chính thức (`X`, `ArrowLeftRight`, `ZoomIn`, `ZoomOut`, `RotateCcw`, `Sparkles`)                      |
| **Vitest**                  |       `^4.0.16`        | Test runner cho unit & component tests                                                                              |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### [MODIFY] Các file mã nguồn cần cập nhật:

1. `src/lib/config/theme-config.ts` (Sửa tone theme Orchid thành "light").
2. `src/app/styles/themes/_shared/base.css` (Tách Orchid khỏi dark scheme, bổ sung selector riêng `:root.theme-orchid { color-scheme: light; }`).
3. `src/app/styles/themes/glassmorphism/orchid.css` (Thêm `color-scheme: light;` vào `.theme-orchid`).
4. `src/app/styles/themes/focus/blueprint.css` (Bổ sung `--surface-elevated: #131b2e;`).
5. `src/app/styles/themes/focus/amber.css` (Bổ sung `--surface-elevated: #1e1810;`).
6. `src/app/styles/themes/focus/charcoal.css` (Bổ sung `--surface-elevated: #1a1a1a;`).
7. `src/app/styles/themes/focus/gold.css` (Bổ sung `--surface-elevated: #1f190e;`).
8. `src/app/styles/themes/focus/indigo.css` (Bổ sung `--surface-elevated: #161b30;`).
9. `src/app/styles/themes/focus/red.css` (Bổ sung `--surface-elevated: #1c0f0f;`).
10. `src/app/styles/themes/focus/rose.css` (Bổ sung `--surface-elevated: #1f171c;`).
11. `src/app/styles/themes/ra2/allied.css` (Bổ sung `--surface-elevated: rgba(32, 38, 52, 0.96);`).
12. `src/app/styles/themes/ra2/soviet.css` (Bổ sung `--surface-elevated: rgba(42, 20, 20, 0.96);`).
13. `src/app/styles/themes/ra2/yuri.css` (Bổ sung `--surface-elevated: rgba(38, 24, 52, 0.96);`).
14. `src/components/ui/error-boundary.tsx` (Thay thế `text-white` bằng `text-(--accent-foreground)`, thêm accessible focus rings).
15. `src/app/layout.tsx` (Thêm `interactiveWidget: "resizes-content"` vào `viewport`).
16. `src/app/features/layout/components/HeaderBar.tsx` (Thêm safe-area insets ngang cho mobile kèm `md:px-6` để tránh cộng dồn).
17. `src/app/features/chat/components/ChatControls.tsx` (Thêm safe-area insets ngang cho nhánh non-landing fixed mobile controls).
18. `src/components/ui/popover.tsx` (Thêm `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]`).
19. `src/app/features/sidebar/components/Sidebar.tsx` (Tích hợp `shouldCloseDrawer`, `drag="x"`, `dragDirectionLock`, `dragConstraints={{left:0,right:0}}`, `dragSnapToOrigin`).
20. `src/app/features/gallery/components/GalleryView.tsx` (Sửa token nút đóng modal, thay `text-white` thành `text-(--accent-foreground)` tại dòng 152, 228, 385, thêm mobile floating close bọc trong `div` với `lg:hidden` và `aria-label={g.t("closeImageDetails")}`).
21. `src/app/features/gallery/components/ImageCompareModal.tsx` (Bổ sung `onTouchStart`, `onTouchMove`, `touch-none`).
22. `src/app/features/image-gen/components/Canvas.tsx` (Bổ sung `group-focus-within:opacity-100` và `group-focus-within:translate-y-0` cho overlay controls).
23. `src/lib/utils/translations/vi.ts` (Bổ sung translation key `closeImageDetails: "Đóng chi tiết hình ảnh"`).
24. `src/lib/utils/translations/en.ts` (Bổ sung translation key `closeImageDetails: "Close image details"`).

#### [NEW] Các file mã nguồn và test co-located cần tạo mới:

25. `[NEW] src/app/features/sidebar/utils/drawerGesture.ts` (Hàm thuần `shouldCloseDrawer` và các hằng số ngưỡng `-80px` và `-300px/s`).
26. `[NEW] src/app/features/sidebar/utils/drawerGesture.test.ts` (Test biên cho `shouldCloseDrawer` với các giá trị `-79`, `-80`, `-81`, velocity `-299`, `-300`, `-301`).
27. `[NEW] src/lib/config/theme-config.test.ts` (Kiểm thử 16 theme definitions, Orchid tone "light", trích xuất CSS và tính toán toán học WCAG contrast ≥ 4.5:1 kèm fallback `:root`).
28. `[NEW] src/components/ui/popover.test.tsx` (Kiểm thử `max-w-*` không bị ghi đè bởi `className="w-80"`).
29. `[NEW] src/components/ui/error-boundary.test.tsx` (Kiểm thử ErrorBoundary bắt lỗi, render class `--accent-foreground`, và nút reload/reset).
30. `[NEW] src/app/features/gallery/components/ImageCompareModal.test.tsx` (Kiểm thử chức năng so sánh ảnh, tương tác chuột và touch events trên mobile với stub getBoundingClientRect).
31. `[NEW] src/app/features/image-gen/components/Canvas.test.tsx` (Kiểm thử Canvas overlay, class keyboard focus-within, và render các action buttons).

#### [MODIFY] Các file test hiện có cần cập nhật:

32. `[MODIFY] src/app/api/gallery/route.test.ts` (Cập nhật 22 tests hiện có: bổ sung assert query builder Image Studio, User Templates Store, Favorites, sửa fixture comment).
33. `[MODIFY] src/app/features/gallery/components/GalleryView.test.tsx` (Mở rộng kiểm thử close button với `closeImageDetails`, nút Remix/Compare token contrast).
34. `[MODIFY] src/app/features/sidebar/components/Sidebar.test.tsx` (Cập nhật mock framer-motion lọc sạch props lạ, capture `onDragEnd` simulation).
35. `[MODIFY] src/app/features/layout/HeaderBar.test.tsx` (Kiểm thử safe-area padding và `md:px-6`).

---

### 6. Các Bước Thực Hiện Tuần Tự

#### Giai Đoạn 3.1: Hệ Thống Theming, Song Ngữ & Độ Tương Phản (THEME-01, THEME-02, Contrast, M1, M5, M8)

- [ ] **Bước 1**: Cập nhật `src/lib/config/theme-config.ts`:
  - Đổi định nghĩa của theme `orchid`: `{ id: "orchid", labelKey: "orchid", swatch: "#c084fc", group: "Glassmorphism", tone: "light" }`.
- [ ] **Bước 2**: Cập nhật `src/app/styles/themes/_shared/base.css`:
  - Xóa bỏ `:root.theme-orchid` khỏi danh sách selector `color-scheme: dark;` (dòng 135).
  - Thêm quy tắc riêng: `:root.theme-orchid { color-scheme: light; }`.
- [ ] **Bước 3**: Cập nhật `src/app/styles/themes/glassmorphism/orchid.css`:
  - Thêm thuộc tính `color-scheme: light;` vào selector `.theme-orchid`. Giữ nguyên kế thừa `--accent-foreground: #0a0a0a;` từ `base.css` (đo lường thực tế đạt 5.00:1 ≥ 4.5:1).
- [ ] **Bước 4**: Bổ sung `--surface-elevated` vào 7 theme nhóm Focus:
  - `src/app/styles/themes/focus/blueprint.css`: `--surface-elevated: #131b2e;`.
  - `src/app/styles/themes/focus/amber.css`: `--surface-elevated: #1e1810;`.
  - `src/app/styles/themes/focus/charcoal.css`: `--surface-elevated: #1a1a1a;`.
  - `src/app/styles/themes/focus/gold.css`: `--surface-elevated: #1f190e;`.
  - `src/app/styles/themes/focus/indigo.css`: `--surface-elevated: #161b30;`.
  - `src/app/styles/themes/focus/red.css`: `--surface-elevated: #1c0f0f;`.
  - `src/app/styles/themes/focus/rose.css`: `--surface-elevated: #1f171c;`.
- [ ] **Bước 5**: Bổ sung `--surface-elevated` vào 3 theme nhóm Red Alert 2:
  - `src/app/styles/themes/ra2/allied.css`: `--surface-elevated: rgba(32, 38, 52, 0.96);`.
  - `src/app/styles/themes/ra2/soviet.css`: `--surface-elevated: rgba(42, 20, 20, 0.96);`.
  - `src/app/styles/themes/ra2/yuri.css`: `--surface-elevated: rgba(38, 24, 52, 0.96);`.
- [ ] **Bước 6**: Thay thế raw color class trong `src/components/ui/error-boundary.tsx`:
  - Dòng 76: Đổi `bg-(--accent) text-white` thành `bg-(--accent) text-(--accent-foreground)`.
  - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho cả hai nút "Try Again" và "Reload Page".
- [ ] **Bước 7**: Cập nhật translation keys chuẩn Rule 04:
  - `src/lib/utils/translations/vi.ts`: Thêm `closeImageDetails: "Đóng chi tiết hình ảnh"`.
  - `src/lib/utils/translations/en.ts`: Thêm `closeImageDetails: "Close image details"`.
- [ ] **Bước 8**: Tạo test `[NEW] src/lib/config/theme-config.test.ts` và `[NEW] src/components/ui/error-boundary.test.tsx`:
  - `theme-config.test.ts`: dùng `fs.readFileSync` đọc trực tiếp các file CSS, parse token `--accent` từ selector `.theme-<id>`, parse `--accent-foreground` kèm fallback về `:root` trong `base.css`, hỗ trợ multiline gradient và rgba; tính toán toán học relative luminance và contrast ratio chuẩn WCAG 2.2, assert 100% 16 theme đều đạt ≥ 4.5:1.

#### Giai Đoạn 3.2: Tối Ưu Hóa Mobile & Thiết Bị Gập (MOB-01..MOB-04, M3, M4, M6, M7, m10)

- [ ] **Bước 9**: Cập nhật `src/app/layout.tsx`:
  - Bổ sung `interactiveWidget: "resizes-content"` vào `export const viewport: Viewport`.
- [ ] **Bước 10**: Cập nhật `src/app/features/layout/components/HeaderBar.tsx`:
  - Sửa padding ngang trong class `chat-header-bar`:
    `pl-[calc(1rem+var(--sal,0px))] pr-[calc(1rem+var(--sar,0px))] sm:pl-[calc(1.5rem+var(--sal,0px))] sm:pr-[calc(1.5rem+var(--sar,0px))] md:px-6`.
    (Thêm `md:px-6` để reset trên desktop/tablet ngang, tránh cộng dồn với `ChatApp.tsx:750`).
- [ ] **Bước 11**: Cập nhật `src/app/features/chat/components/ChatControls.tsx`:
  - Chỉ bổ sung safe-area padding ngang vào nhánh non-landing (fixed bar):
    `${isLanding ? "relative z-40" : "pb-[calc(1.5rem+var(--sab,0px))] md:pb-6 shadow-2xl md:shadow-none fixed bottom-0 left-0 right-0 z-40 bg-(--surface)/95 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none md:static md:translate-y-0 pl-[calc(1rem+var(--sal,0px))] pr-[calc(1rem+var(--sar,0px))] md:px-0"}`
    (Giữ nguyên chuỗi container chung `px-4 md:px-6` để nhánh landing không bị cộng dồn `--sar` hai lần).
- [ ] **Bước 12**: Cập nhật `src/components/ui/popover.tsx`:
  - Bổ sung class giới hạn độ rộng trần:
    `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]` vào `PopoverContent`.
  - Tạo test `[NEW] src/components/ui/popover.test.tsx`: render `PopoverContent` với `className="w-80"` và assert thuộc tính className vẫn giữ lại `max-w-[min(...)]`.
- [ ] **Bước 13**: Tách module gesture và cập nhật `Sidebar.tsx` (M7):
  - Tạo `[NEW] src/app/features/sidebar/utils/drawerGesture.ts`: khai báo `DRAWER_CLOSE_OFFSET_THRESHOLD = -80`, `DRAWER_CLOSE_VELOCITY_THRESHOLD = -300`, và hàm thuần:
    ```ts
    export function shouldCloseDrawer(info: {
      offset: { x: number };
      velocity: { x: number };
    }): boolean {
      return (
        info.offset.x <= DRAWER_CLOSE_OFFSET_THRESHOLD ||
        info.velocity.x <= DRAWER_CLOSE_VELOCITY_THRESHOLD
      );
    }
    ```
  - Tạo `[NEW] src/app/features/sidebar/utils/drawerGesture.test.ts`: test các giá trị biên: `-79`, `-80`, `-81`, velocity `-299`, `-300`, `-301`, vuốt sang phải.
  - Cập nhật `src/app/features/sidebar/components/Sidebar.tsx`: import `shouldCloseDrawer`, gắn vào `motion.aside`:
    `drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.5, right: 0 }} dragSnapToOrigin onDragEnd={(_, info) => { if (shouldCloseDrawer(info)) onCloseMobile?.(); }}`.
  - Cập nhật `src/app/features/sidebar/components/Sidebar.test.tsx`: sửa mock framer-motion để bóc tách các props `drag*`, `onDragEnd` không spread xuống HTML `<aside>`, đồng thời capture `onDragEnd` để test mô phỏng gọi với offset `-120` (verify đóng) và `-50` (verify không đóng).

#### Giai Đoạn 3.3: Khắc Phục Lỗi Gallery & Image Studio (UI-02, UI-03, API-02, A11Y-01, M2, M5, M8, m3, m11)

- [ ] **Bước 14**: Cập nhật `src/app/features/gallery/components/GalleryView.tsx`:
  - Sửa nút Compare Now (`:152`): đổi `text-white` thành `text-(--accent-foreground)`.
  - Sửa Compare Mode Selection Indicator (`:228`): đổi `text-white` thành `text-(--accent-foreground)`.
  - Sửa nút Remix (`:385`): đổi `text-white` thành `text-(--accent-foreground)`.
  - Sửa nút đóng modal chi tiết (`:331`): đổi `hover:text-(--text)` thành `hover:text-(--text-primary)`, đổi `focus-visible:ring-blue-500/50` thành `focus-visible:ring-(--ring)`.
  - Bổ sung floating close button cho mobile layout: bọc trong thẻ `div` với class `absolute top-3 right-3 z-20 lg:hidden` (tránh bị `[&>button]:hidden` giấu mất), nút con mang icon `<X className="w-5 h-5" />` và `aria-label={g.t("closeImageDetails")}`.
  - Cập nhật `src/app/features/gallery/components/GalleryView.test.tsx` assert nút đóng modal qua `closeImageDetails` và token `text-(--accent-foreground)` trên các nút Action.
- [ ] **Bước 15**: Cập nhật `src/app/features/gallery/components/ImageCompareModal.tsx`:
  - Tạo helper `updateSliderFromClientX(clientX: number, target: HTMLDivElement)`.
  - Bổ sung `onTouchStart` và `onTouchMove` cho container trượt so sánh.
  - Thêm class `touch-none` vào container để ngăn trình duyệt cuộn dọc trang khi người dùng đang thao tác kéo thanh trượt.
  - Tạo test `[NEW] src/app/features/gallery/components/ImageCompareModal.test.tsx`: stub `getBoundingClientRect()` trả về `{ left: 0, width: 400 }` để test touch event không bị NaN trong happy-dom.
- [ ] **Bước 16**: Cập nhật `src/app/features/image-gen/components/Canvas.tsx`:
  - Thêm `group-focus-within:opacity-100` vào overlay container (`:228`).
  - Thêm `group-focus-within:translate-y-0` vào header badges (`:230`) và bottom controls (`:297`).
  - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring)` cho tất cả interactive buttons trong overlay (Reuse, Edit, Variation, Delete, Favorite).
  - Tạo test `[NEW] src/app/features/image-gen/components/Canvas.test.tsx`.
- [ ] **Bước 17**: Cập nhật file test hiện có `[MODIFY] src/app/api/gallery/route.test.ts`:
  - Sửa fixture comment lỗi thời ở dòng 115 thành `// should be included (API-02)`.
  - Bổ sung test case kiểm tra query builder:
    1. Assert query builder gọi `.neq("conversations.model", MODEL_IDS.USER_TEMPLATES_STORE)`.
    2. Assert query builder KHÔNG có bất kỳ lệnh `neq` hoặc `eq` nào loại trừ `MODEL_IDS.IMAGE_STUDIO`.
    3. Assert query builder gọi `.eq("meta->>is_favorite", "true")` khi truyền `favorites=true`.
  - Đảm bảo toàn bộ 22 tests hiện có tiếp tục pass 100%.

#### Giai Đoạn 3.4: Kiểm Tra Toàn Diện & Cập Nhật Tài Liệu

- [ ] **Bước 18**: Chạy bộ kiểm soát chất lượng Tier 2:
      `npm run type-check; npm run lint; npm run test:run`
      (Bắt buộc 0 error, 0 warning, 100% tests pass).
- [ ] **Bước 19**: Cập nhật `docs/CHANGELOG.md` ghi nhận các thay đổi của Giai đoạn 3.

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Nhằm chống specification gaming và đảm bảo Lead Reviewer cùng `@qa` có tiêu chí nghiệm thu khách quan, bản hợp đồng kiểm thử quy định các hành vi biên sau:

#### Hợp Đồng 1: Theming & Color Contrast (TC-THEME)

- **TC-THEME-01 (Orchid Tone & Scheme)**:
  - _Input_: `getThemeById("orchid")`.
  - _Expected Output_: Trả về `tone === "light"`.
  - _CSS Rule_: Class `.theme-orchid` có thuộc tính `color-scheme: light;` và kế thừa `--accent-foreground: #0a0a0a;` từ `:root`.
  - _Pass/Fail Criteria_: Pass nếu `theme-config.ts` xuất tone "light", file CSS có `color-scheme: light;`, không có override `--accent-foreground: #ffffff;`.
- **TC-THEME-02 (Surface Elevated Token Coverage & Contrast Test)**:
  - _Input_: Duyệt qua toàn bộ 16 theme files trong `src/app/styles/themes/` qua `fs.readFileSync`.
  - _Expected Output_:
    1. 100% file CSS (bao gồm 7 Focus themes và 3 RA2 themes) đều định nghĩa biến `--surface-elevated: ...`.
    2. Hàm tính relative luminance và contrast ratio xác nhận 100% 16 cặp `--accent` và `--accent-foreground` (kèm fallback `:root`) đều đạt contrast ratio ≥ 4.5:1.
  - _Pass/Fail Criteria_: Pass nếu không có bất kỳ theme nào thiếu `--surface-elevated` và 100% contrast ratio ≥ 4.5:1.
- **TC-THEME-03 (WCAG AA Accent Contrast - No Text-White on Accent)**:
  - _Input_: Nút Action trong `ErrorBoundary` (`src/components/ui/error-boundary.tsx`), các nút Compare Now, chỉ báo Compare Mode và nút Remix trong `GalleryView` (`src/app/features/gallery/components/GalleryView.tsx`).
  - _Expected Output_: Sử dụng `text-(--accent-foreground)`. Tuyệt đối không còn bất kỳ thẻ nào kết hợp `bg-(--accent)` với raw class `text-white`.
  - _Pass/Fail Criteria_: Pass nếu quét regex không phát hiện `bg-(--accent)` đi kèm `text-white` trong cả 2 file trên.

#### Hợp Đồng 2: Mobile & Foldable Layout (TC-MOB)

- **TC-MOB-01 (Interactive Widget)**:
  - _Input_: Module `src/app/layout.tsx`.
  - _Expected Output_: `viewport.interactiveWidget === "resizes-content"`.
  - _Pass/Fail Criteria_: Pass nếu thuộc tính tồn tại và có giá trị chính xác là `"resizes-content"`.
- **TC-MOB-02 (Safe-Area Inset Landscape & Desktop Reset)**:
  - _Input_: DOM render của `HeaderBar` và `ChatControls` (chế độ fixed).
  - _Expected Output_:
    1. HeaderBar chứa class có `var(--sal` và `var(--sar)`, ĐỒNG THỜI chứa `md:px-6` để triệt tiêu cộng dồn padding trên desktop.
    2. ChatControls chứa class có `var(--sal` và `var(--sar)` trong nhánh non-landing.
  - _Pass/Fail Criteria_: Pass nếu HeaderBar có cả safe-area mobile lẫn `md:px-6` reset.
- **TC-MOB-03 (Popover Responsive Max-Width)**:
  - _Input_: Render component `PopoverContent` trong `src/components/ui/popover.tsx` với prop `className="w-80"`.
  - _Expected Output_: Thuộc tính className kết quả vừa chứa `w-80` vừa chứa `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]` (không bị `twMerge` ghi đè).
  - _Pass/Fail Criteria_: Pass nếu class name chứa đầy đủ chuỗi max-w trên.
- **TC-MOB-04 (Drawer Touch Swipe Gesture & Snap-to-Origin - M7)**:
  - _Input_: Hàm thuần `shouldCloseDrawer(info)` trong `drawerGesture.ts` và component `Sidebar` mobile drawer.
  - _Expected Output_:
    1. Hàm thuần:
       - `shouldCloseDrawer({ offset: { x: -79 }, velocity: { x: 0 } })` === false.
       - `shouldCloseDrawer({ offset: { x: -80 }, velocity: { x: 0 } })` === true.
       - `shouldCloseDrawer({ offset: { x: -81 }, velocity: { x: 0 } })` === true.
       - `shouldCloseDrawer({ offset: { x: 0 }, velocity: { x: -299 } })` === false.
       - `shouldCloseDrawer({ offset: { x: 0 }, velocity: { x: -300 } })` === true.
       - `shouldCloseDrawer({ offset: { x: 0 }, velocity: { x: -301 } })` === true.
       - `shouldCloseDrawer({ offset: { x: 50 }, velocity: { x: 100 } })` === false.
    2. Component `Sidebar`:
       - `motion.aside` mang `drag="x"`, `dragConstraints={{ left: 0, right: 0 }}`, `dragSnapToOrigin={true}`.
       - Khi gọi simulated `onDragEnd` với offset `-120px` -> `onCloseMobile` được gọi 1 lần.
       - Khi gọi simulated `onDragEnd` với offset `-50px` -> `onCloseMobile` KHÔNG được gọi.
  - _Pass/Fail Criteria_: Pass nếu 100% test cases biên của hàm thuần và component wiring đều khớp.

#### Hợp Đồng 3: Gallery & Canvas Interaction (TC-GAL)

- **TC-GAL-01 (Gallery Modal Close Accessible & Bilingual - M8)**:
  - _Input_: Render modal chi tiết ảnh trong `GalleryView.tsx`.
  - _Expected Output_:
    1. Nút đóng modal trong sidebar có icon `<X />`, `hover:text-(--text-primary)`, và `focus-visible:ring-(--ring)`.
    2. Nút đóng floating cho mobile view nằm trong thẻ bọc `div` mang class `lg:hidden` và `aria-label` lấy từ translation key `closeImageDetails` ("Đóng chi tiết hình ảnh" / "Close image details").
  - _Pass/Fail Criteria_: Pass nếu cả hai nút đóng hiển thị đúng cấu trúc DOM, đóng modal khi click, không bị `[&>button]:hidden` giấu mất và không bị lỗi multiple match `getByRole`.
- **TC-GAL-02 (Image Compare Touch Events - m11)**:
  - _Input_: Slider container trong `ImageCompareModal.tsx` với stub `getBoundingClientRect()` trả về `{ left: 0, width: 400 }`.
  - _Expected Output_: Có gắn cả `onTouchStart` và `onTouchMove`, có class `touch-none`. Khi kích hoạt sự kiện `touchmove` với `touches: [{ clientX: 200 }]`, vị trí slider cập nhật về `50%`.
  - _Pass/Fail Criteria_: Pass nếu `sliderPosition` cập nhật chính xác theo tọa độ touch clientX mà không bị NaN.
- **TC-GAL-03 (Canvas Overlay Keyboard Focus)**:
  - _Input_: Render `Canvas.tsx` chứa danh sách ảnh tạo ra.
  - _Expected Output_: Thẻ div overlay bao bọc ảnh có class `group-focus-within:opacity-100`. Các khối badges và actions có `group-focus-within:translate-y-0`.
  - _Pass/Fail Criteria_: Pass nếu class `group-focus-within:opacity-100` hiện diện trong overlay markup.
- **TC-GAL-04 (Gallery API Query Builder Assertion - API-02)**:
  - _Input_: Mocking Supabase query builder trong `src/app/api/gallery/route.test.ts`.
  - _Expected Output_:
    1. Kiểm chứng gọi `.neq("conversations.model", MODEL_IDS.USER_TEMPLATES_STORE)`.
    2. Kiểm chứng KHÔNG có bất kỳ lệnh `.neq` hay `.eq` nào loại trừ `MODEL_IDS.IMAGE_STUDIO`.
    3. Khi gọi với `favorites=true`, kiểm chứng gọi `.eq("meta->>is_favorite", "true")`.
  - _Pass/Fail Criteria_: Pass nếu các assertion trên đều pass và toàn bộ 22 tests hiện hữu tiếp tục pass 100%.

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 8.1. Ma Trận Test Files & Phạm Vi Bao Phủ

| Test File                                                              | Loại Test  | Đối Tượng Kiểm Thử                                                 |
| :--------------------------------------------------------------------- | :--------- | :----------------------------------------------------------------- |
| `[NEW] src/app/features/sidebar/utils/drawerGesture.test.ts`           | Co-located | Kiểm tra hàm thuần `shouldCloseDrawer` với các giá trị biên        |
| `[NEW] src/lib/config/theme-config.test.ts`                            | Co-located | Kiểm tra 16 theme definition, Orchid tone, WCAG contrast ≥ 4.5:1   |
| `[NEW] src/components/ui/popover.test.tsx`                             | Co-located | Kiểm tra `max-w-[min(...)]` không bị ghi đè bởi `className="w-80"` |
| `[NEW] src/components/ui/error-boundary.test.tsx`                      | Co-located | Kiểm tra ErrorBoundary fallback, text token contrast               |
| `[NEW] src/app/features/gallery/components/ImageCompareModal.test.tsx` | Co-located | Kiểm tra so sánh ảnh, mouse & touch events, stub getBoundingClient |
| `[NEW] src/app/features/image-gen/components/Canvas.test.tsx`          | Co-located | Kiểm tra Canvas overlay focus-within và action buttons             |
| `[MODIFY] src/app/api/gallery/route.test.ts`                           | Co-located | Bổ sung assert query builder Image Studio, Templates, Favorites    |
| `[MODIFY] src/app/features/gallery/components/GalleryView.test.tsx`    | Co-located | Test closeImageDetails bilingual, Remix/Compare token contrast     |
| `[MODIFY] src/app/features/sidebar/components/Sidebar.test.tsx`        | Co-located | Mock framer-motion bóc tách props, capture onDragEnd simulation    |
| `[MODIFY] src/app/features/layout/HeaderBar.test.tsx`                  | Co-located | Bổ sung test safe-area horizontal padding và `md:px-6`             |

#### 8.2. Quy Trình Chạy Kiểm Thử (Verification Gate)

Theo quy định tại [`.agents/rules/02-quality.md`](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md):

- Sau mỗi chỉnh sửa file: chạy `npm run type-check` (Tier 1).
- Sau khi hoàn thành toàn bộ các bước: chạy trọn vẹn Tier 2 trong PowerShell 5.1:
  ```powershell
  npm run type-check; npm run lint; npm run test:run
  ```
- Tiêu chí chấp nhận: 100% test files pass (107+ files), 0 TypeScript errors, 0 ESLint warnings.

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi Ro Tiềm Ẩn                                                                               | Mức Độ  | Technical Control Trong Code (Phương Án Phòng Ngừa)                                                                                                                                                                           |
| :------------------------------------------------------------------------------------------- | :-----: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Drawer bị kẹt ở trạng thái mở dở khi thả tay dưới ngưỡng đóng**:                           | `MAJOR` | Cấu hình `dragConstraints={{ left: 0, right: 0 }}`, `dragElastic={{ left: 0.5, right: 0 }}` kết hợp `dragSnapToOrigin={true}` để drawer tự động bật hồi quy về `x = 0` khi người dùng buông tay mà không đạt ngưỡng đóng.     |
| **Vi phạm chuẩn Song ngữ (Rule 04) khi thêm nhãn accessible cho modal close**:               | `MAJOR` | Bổ sung translation key `closeImageDetails` trong cả `vi.ts` và `en.ts`, sử dụng `aria-label={g.t("closeImageDetails")}`, ngăn chặn hoàn toàn hardcoded English.                                                              |
| **Tràn layout Popover khi consumer truyền class width cố định (w-80, w-72)**:                | `MAJOR` | Bổ sung class giới hạn trần `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]`. Vì `max-w-*` không bị `twMerge` ghi đè bởi `w-*`, Popover luôn được bảo vệ không tràn viền trên màn hình hẹp. |
| **Cộng dồn safe-area padding trên HeaderBar khi xoay ngang máy trên tablet/desktop**:        | `MAJOR` | Thêm `md:px-6` vào `HeaderBar.tsx` để reset padding ngang trên desktop/tablet ngang, triệt tiêu hoàn toàn hiện tượng cộng dồn hai lần safe-area với container cha `ChatApp.tsx:750`.                                          |
| **Lỗi gián đoạn cuộn trang khi vuốt thanh so sánh ảnh trên mobile**:                         | `MAJOR` | Thêm class `touch-none` vào container thanh trượt trong `ImageCompareModal.tsx` để trình duyệt chuyển quyền ưu tiên xử lý cử chỉ vuốt hoàn toàn cho React Touch Handlers.                                                     |
| **Phép chia cho 0 sinh NaN khi test thanh so sánh ảnh trong happy-dom**:                     | `MINOR` | Test BẮT BUỘC stub `getBoundingClientRect()` của slider container trả về `{ left: 0, width: 400 }` trước khi phát sự kiện touch/mouse.                                                                                        |
| **Vô tình khóa cuộn dọc khi bật drag ngang trên Drawer**:                                    | `MINOR` | Bổ sung thuộc tính `dragDirectionLock` trên `motion.aside` trong `Sidebar.tsx` để Framer Motion chỉ bắt đầu gesture khi chuyển động theo trục ngang, không cản trở thao tác cuộn dọc danh sách hội thoại.                     |
| **Nút floating close bị CSS `[&>button]:hidden` của DialogContent giấu mất**:                | `MINOR` | Bọc nút floating close bên trong thẻ `div` cha (`absolute top-3 right-3 z-20 lg:hidden`), gán `aria-label={g.t("closeImageDetails")}` để tránh xung đột với nút close trong sidebar chi tiết.                                 |
| **Phát sinh cảnh báo React Unknown Attribute và dính HTML5 dragend khi test Framer Motion**: | `MINOR` | Trong `Sidebar.test.tsx`, mock `motion.aside` bóc tách riêng các props `drag*`, `onDragEnd` trước khi spread `rest` xuống thẻ HTML `<aside>`, đồng thời capture handler để test giả lập cử chỉ vuốt chạm an toàn.             |

---

## Audit History

_(Khu vực dành riêng cho Lead Reviewer — Claude Code CLI hoặc Fallback Reviewer `@reviewer` — ghi nhận xét và đánh giá theo từng Audit Run)_

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-10
- **Đối tượng**: Technical Plan — Revision 1
- **Ghi chú**: Mục `### Audit Run 1` trước đó chỉ là placeholder chưa được thẩm định (Pending Reviewer Dispatch), nên đây là lần thẩm định đầu tiên và được ghi trực tiếp vào Run 1.

#### Kiểm chứng lỗi cũ

N/A — đây là lần thẩm định đầu tiên, chưa có Run nào trước đó.

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                          |       Kết quả       | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :-------------------------------- | :-----------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**         |        PASS         | `[CMD]` `npm run type-check` → exit 0, không có lỗi. `[SRC]` `node_modules/next/dist/lib/metadata/types/extra-types.d.ts:53` khai báo `interactiveWidget?: 'resizes-visual' \| 'resizes-content' \| 'overlays-content'` → Bước 8 hợp lệ về kiểu (Next `16.1.4`). Không có dependency hay env var mới, không dùng Prisma/Better Auth. `[CMD]` Phiên bản đã cài: framer-motion `12.27.5`, tailwindcss `4.1.18`.                                                                                      |
| **S2 Lifecycle & Teardown**       |      **FAIL**       | `[SRC]` `Sidebar.test.tsx:22-38` mock `motion.aside` bằng cách spread toàn bộ props xuống `<aside>` → `onDragEnd` thành handler `dragend` gốc của HTML5 (nhận `DragEvent`, không có `info`), còn `dragConstraints` bị đẩy xuống DOM. Vì vậy TC-MOB-04 không kiểm được như đang viết (xem M6). `[SRC]` Test `route.test.ts:308` cho Image Studio là test tautological: mock `range()` trả dữ liệu bất kể filter (`route.test.ts:80-102`) (xem M2). Không có SSE/AbortController trong phạm vi plan. |
| **S3 Database & Temporal**        | PASS (N/A phần lớn) | Plan không đụng schema/migration/RPC. `[SRC]` `src/app/api/gallery/route.ts:99-112` lọc ở tầng DB bằng `.eq(user_id)` + `.neq("conversations.model", USER_TEMPLATES_STORE)` + `.range()`. Timeline: T1 user A gọi GET `offset=20` \| T2 có ảnh mới insert \| T3 `range` dịch cửa sổ → có thể trùng 1 phần tử giữa các trang → AN TOÀN (hành vi phân trang offset đã có sẵn, không phải do plan gây ra). Trục đồng thời/serverless: N/A, vì route chỉ đọc và stateless.                             |
| **S4 Cross-Task State**           |      **FAIL**       | `[SRC]` `ChatApp.tsx:750` — container cha đã có `md:pl-[calc(…+var(--sal))]` và `pr-[var(--sar)]`. HeaderBar ở `md:sticky` nằm trong container này, nên Bước 9 (`sm:pl/pr` có `--sal/--sar`) sẽ cộng inset **hai lần** ở ≥768px (xem M4). `[SRC]` `useTheme.ts:10` `THEME_TONES` không có consumer, và `data-theme-tone` không được set ở đâu trong `src/` → việc đổi `tone` chỉ là metadata (m1).                                                                                                 |
| **S5 Security Boundary**          |        PASS         | `[SRC]` `gallery/route.ts:62-65` có `auth()` và trả 401 khi không có email; `getSupabaseAdmin` import từ `supabase.server`, chỉ dùng trong route server. Plan không thêm API hay client Supabase mới. Trục TOCTOU/SSRF: N/A (không có fetch URL ngoài).                                                                                                                                                                                                                                            |
| **S6 External Resilience**        |     PASS (N/A)      | Plan không gọi AI provider, không thay đổi `maxDuration`.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Domain: WCAG/Theming**          |      **FAIL**       | `[CMD]` Probe `node -e` tính tỷ lệ tương phản WCAG: `#ffffff` trên `#a855f7` = **3.96:1**, trên `#ef4444` = **3.76:1** (đều < 4.5 → FAIL AA). Ngược lại, `#0a0a0a` trên `#a855f7` = 5.00:1, trên `#ef4444` = 5.26:1 (PASS) (xem M1).                                                                                                                                                                                                                                                               |
| **Domain: Bilingual / File Size** |        MINOR        | Floating close cần `aria-label` dùng `g.t("close")` (đã có key). `Sidebar.tsx` hiện 612 dòng, đã vượt hard max 500 cho UI component (m5).                                                                                                                                                                                                                                                                                                                                                          |

#### Phân loại lỗi

**[MAJOR] M1 — Bảng `--accent-foreground` làm GIẢM độ tương phản và vi phạm WCAG AA (Assumption §3, Bước 3, Bước 5, TC-THEME-01)**

- `[CMD]` Tương phản thực tế: orchid/yuri `#a855f7` + `#ffffff` = 3.96:1; soviet `#ef4444` + `#ffffff` = 3.76:1. Plan tự ghi "4.0:1 (đạt chuẩn WCAG AA)", điều này sai vì 4.0 < 4.5.
- `[SRC]` `base.css:93` đã đặt mặc định `--accent-foreground: #0a0a0a`, cho 5.00:1 và 5.26:1. Như vậy plan đang làm hồi quy a11y trên đúng 3 theme mà nó muốn sửa.
- **Yêu cầu**: Bỏ override `#ffffff` cho orchid/yuri/soviet (giữ `#0a0a0a`), hoặc đổi sang accent đậm hơn kèm số đo ≥ 4.5:1. Sửa TC-THEME-01 tương ứng. Bổ sung một test tính contrast (hàm luminance thuần) cho cả 16 cặp `--accent`/`--accent-foreground`, chạy trên giá trị đọc từ CSS.

**[MAJOR] M2 — `src/app/api/gallery/route.test.ts` ĐÃ TỒN TẠI, plan lại đánh dấu `[NEW]` (file #28, Bước 16, Assumption §5)**

- `[CMD]` `npx vitest run src/app/api/gallery/route.test.ts` → 22 tests pass. Assumption §5 ("hoàn toàn chưa có co-located unit test") là sai. Nếu tạo mới file này sẽ ghi đè 22 test hiện có.
- `[SRC]` Test hiện tại **không** assert `.neq("conversations.model", MODEL_IDS.USER_TEMPLATES_STORE)` và không test `favorites=true`. Test Image Studio ở `:308` là tautological vì mock trả dữ liệu bất kể filter.
- **Yêu cầu**: Đổi thành `[MODIFY]`. Bổ sung các assert vào đối số của query builder: (a) `neq` được gọi với `("conversations.model", MODEL_IDS.USER_TEMPLATES_STORE)`; (b) không có `neq`/`eq` nào lọc `MODEL_IDS.IMAGE_STUDIO`; (c) `favorites=true` → `eq("meta->>is_favorite", "true")`. Sửa luôn comment fixture lỗi thời `"should be filtered out"` ở `route.test.ts:115`.

**[MAJOR] M3 — Fix Popover không có hiệu lực vì mọi consumer đều override width (Bước 11, TC-MOB-03)**

- `[SRC]` `cn()` = `twMerge(clsx())` (`src/lib/utils/cn.ts`). `[CMD]` `twMerge("w-[min(18rem,calc(100vw-2rem))] p-4", "w-80 p-3")` → `"w-80 p-3"`.
- `[SRC]` Cả 5 consumer đều tự truyền width: `ChatControls.tsx:255` `w-80` (320px, vẫn tràn màn hình cover ~280px), `IconPicker.tsx:137` `w-72`, `GemQuickSwitch.tsx:80` và `PersonaQuickSwitch.tsx:83` `w-56`, `TokenBadge.tsx:94` `w-auto`. Do đó đổi base `w-72` không ảnh hưởng đến bất kỳ màn hình nào thực tế.
- **Yêu cầu**: Đặt giới hạn bằng `max-w-*` ở base (twMerge không ghi đè `max-w` bằng `w-*`), ví dụ `max-w-[min(var(--radix-popover-content-available-width),calc(100vw-2rem))]`, và có thể thêm `collisionPadding`. TC-MOB-03 phải render kèm `className="w-80"` và assert `max-w-…` vẫn còn. Đồng bộ lại dòng Risk Table (đang nhắc `max-w-[calc(100vw-2rem)]` nhưng các bước lại không có).

**[MAJOR] M4 — HeaderBar bị cộng safe-area hai lần ở breakpoint `md+` (Bước 9, TC-MOB-02)**

- `[SRC]` `HeaderBar.tsx:68-72`: dưới `md` header là `fixed left-0 right-0` nên cần inset; từ `md` trở lên là `md:sticky` bên trong `ChatApp.tsx:750`, vốn đã có `md:pl-[…+var(--sal)]` và `pr-[var(--sar)]`.
- `[ADV]` T1: iPhone Pro Max xoay ngang (932px, inset trái/phải ≈ 59px) \| T2: breakpoint `md` kích hoạt, header chuyển sang sticky trong container đã có padding \| T3: class `sm:pl-[calc(1.5rem+var(--sal))]` vẫn áp dụng → inset bị cộng 2 lần, mất ~118px chiều ngang → LỖI (MAJOR, hồi quy layout).
- **Yêu cầu**: Thêm `md:px-6` để reset ở `md+` (giống cách Bước 10 làm với ChatControls). TC-MOB-02 cần assert có `md:px-6`.

**[MAJOR] M5 — TC-THEME-03 tự mâu thuẫn với phạm vi của Bước 13**

- `[SRC]` `GalleryView.tsx:152` (nút "Compare Now") và `:228` (chỉ báo đang chọn để so sánh) vẫn dùng `bg-(--accent) text-white`. Plan chỉ sửa nút Remix ở `:385`. Theo tiêu chí Pass của TC-THEME-03 ("không còn … `text-white` kết hợp `bg-(--accent)` trong các file này"), plan sẽ tự FAIL.
- **Yêu cầu**: Đưa cả `:152` và `:228` vào Bước 13, hoặc thu hẹp TC-THEME-03 kèm lý do. Nên thêm assertion dạng grep/regex trong test để chặn tái phát.

**[MAJOR] M6 — TC-MOB-04 (drawer swipe) không có chiến lược test khả thi (Bước 12)**

- `[SRC]` Mock framer-motion tại `Sidebar.test.tsx:22-38` (đã nêu ở S2): `fireEvent.dragEnd` sẽ gọi handler với `info === undefined` → `info.offset` ném lỗi, hoặc test chỉ kiểm sự tồn tại của prop, tức là tautological.
- **Yêu cầu**: Tách logic quyết định đóng drawer thành hàm thuần, ví dụ `shouldCloseDrawer(info: Pick<PanInfo, "offset" | "velocity">): boolean`. Các ngưỡng `-80px` / `-300px/s` đưa thành hằng `UPPER_SNAKE_CASE`. Viết test co-located cho các biên: `-79`, `-80`, `-81`, velocity `-299`/`-301`, và trường hợp vuốt sang phải. Cập nhật mock để capture `onDragEnd` của framer và gọi với `info` giả lập. Bổ sung file mới vào §5 và §8.1.

**[MINOR]**

- **m1**: Đổi `tone` của Orchid không có tác dụng runtime: `THEME_TONES` (`useTheme.ts:10`) không có consumer, và `[data-theme-tone]` không được set ở đâu. Các khối `:root[data-theme-tone=…]` (`base.css:139-166`) là dead code; nếu sau này được wire vào, chúng có specificity (0,2,0) cao hơn `.theme-*` (0,1,0) và sẽ ghi đè `--surface-elevated` của mọi theme. Nên ghi chú điều này trong plan.
- **m2**: TC-THEME-02 cần đọc file CSS. Plan nên nêu rõ `theme-config.test.ts` dùng `fs.readFileSync` trên glob `src/app/styles/themes/**/*.css` và parse token theo từng selector `.theme-<id>`. Không nên chỉ khớp chuỗi trên toàn file.
- **m3**: Floating close trong GalleryView: `DialogContent` có `[&>button]:hidden` (`GalleryView.tsx:271`), nên nút mới không được là `<button>` con trực tiếp. Nút cần `lg:hidden`, vì layout chuyển sang hàng ngang ở `lg` chứ không phải `md`. Khi có 2 nút cùng accessible name "Close", `getByRole` trong TC-GAL-01 sẽ ném lỗi multiple match → cần `getAllByRole` hoặc label riêng.
- **m4**: Khi bật `drag="x"`, framer tự áp `userSelect: none`, `WebkitTouchCallout: none`, `touchAction: pan-y` lên toàn bộ `motion.aside` (`[SRC]` `framer-motion/dist/es/render/html/use-props.mjs:34-46`). Hệ quả là mất bôi chọn văn bản và long-press link trên iOS trong drawer. Cân nhắc dùng `dragDirectionLock`, hoặc `useDragControls` + `dragListener={false}` với vùng kéo ở mép drawer.
- **m5**: `Sidebar.tsx` có 612 dòng, đã vượt hard max 500. Nên tách `MobileDrawer.tsx` khi thêm logic gesture.
- **m6**: `ImageCompareModal` slider chưa hỗ trợ bàn phím (`role="slider"`, `aria-valuenow`, phím mũi tên), nên ghi nhận vào backlog A11Y. Các nút prev/next ở `GalleryView.tsx:302,316` là `opacity-0 group-hover`, nên vô hình trên thiết bị cảm ứng (ngoài phạm vi plan).
- **m7**: Thêm `--accent-foreground: #0a0a0a` vào từng theme là dư thừa vì `:root` đã có sẵn (`base.css:93`). Việc này vô hại nhưng tăng diff. Assumption §3 cũng thiếu `indigo` (`#818cf8`, 6.64:1 với `#0a0a0a`).

#### Kết luận

**[CHANGES_REQUESTED]** — còn 6 lỗi `[MAJOR]` (M1–M6). Không có `[BLOCKER]`: plan không vi phạm layer boundary hay tech stack, và không có lỗi bảo mật.

Việc cần làm cho Revision 2:

1. M1: Sửa bảng `--accent-foreground` theo số đo thực tế (≥ 4.5:1) và thêm test tính contrast.
2. M2: Đổi `route.test.ts` sang `[MODIFY]` và assert đối số `neq`/`eq` của query builder.
3. M3: Chuyển giới hạn Popover sang `max-w-*` để không bị consumer override, và test có kèm className của consumer.
4. M4: Thêm `md:px-6` cho HeaderBar để tránh cộng inset hai lần.
5. M5: Mở rộng Bước 13 cho `GalleryView.tsx:152` và `:228`.
6. M6: Tách hàm thuần `shouldCloseDrawer` kèm test biên, và cập nhật mock framer-motion.

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-10
- **Đối tượng**: Technical Plan — Revision 2

#### Kiểm chứng lỗi cũ

| Mã                 |   Trạng thái    | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                  |
| :----------------- | :-------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1**             |     ĐÃ SỬA      | Đã bỏ override `#ffffff`, dùng `#0a0a0a` kế thừa từ `base.css:93`. `[CMD]` Probe `node -e` WCAG cho 16 accent: giá trị thấp nhất là orchid/yuri `#a855f7` = **5.00:1**, soviet = **5.26:1**, tất cả ≥ 4.5 → kết luận đúng. `[CMD]` `grep accent-foreground src/app/styles/themes` cho thấy không theme nào override. Tuy vậy nhiều con số trong bảng §3.3 vẫn sai (xem m8). |
| **M2**             |     ĐÃ SỬA      | Đã đổi sang `[MODIFY]`. `[SRC]` `route.test.ts:80-102` `mockBothQueries` trả về `chain` có `neq`/`eq` là `vi.fn()`, nên assert được `chain.neq.mock.calls`. `[SRC]` `route.ts:102,109-110` khớp với các assert dự kiến (`neq(...USER_TEMPLATES_STORE)`, `eq("meta->>is_favorite","true")`). `[CMD]` vitest: 4 file liên quan, 30/30 tests pass.                             |
| **M3**             |     ĐÃ SỬA      | `[CMD]` `twMerge(base có max-w-[min(...)], "w-80 p-3")` → giữ `max-w-[min(...)] w-80 p-3`; với `w-auto` (TokenBadge) cũng giữ. `[SRC]` `@radix-ui/react-popover/dist/index.mjs:253` có định nghĩa `--radix-popover-content-available-width`.                                                                                                                                |
| **M4**             |     ĐÃ SỬA      | `[CMD]` Compile Tailwind 4.1.18: `.md:px-6` (`padding-inline` trong `@media (width >= 48rem)`) được xuất **sau** `.pl-[…]`/`.pr-[…]` (`padding-left/right`) với cùng specificity → reset thắng ở ≥768px. `[SRC]` `HeaderBar.tsx:68-72` (fixed ở <md, sticky ở md+), `ChatApp.tsx:750`.                                                                                      |
| **M5**             |     ĐÃ SỬA      | `[SRC]` `GalleryView.tsx:152, 228, 385` đều đã có trong Bước 13. `:229` (`text-white/70` trên `bg-black/50`) không nằm trên accent nên đúng là ngoài phạm vi.                                                                                                                                                                                                               |
| **M6**             | ĐÃ SỬA một phần | Hàm thuần `shouldCloseDrawer` + hằng số + test biên là khả thi. Nhưng cấu hình drag đi kèm ở Bước 12 lại sinh lỗi mới (xem **M7**).                                                                                                                                                                                                                                         |
| m1, m2, m3, m4, m7 |     ĐÃ SỬA      | Ghi chú dead code `data-theme-tone` (§3.1); dùng `fs.readFileSync`; bọc floating close trong `div` + `lg:hidden`; có `dragDirectionLock`; bỏ override dư thừa và thêm indigo.                                                                                                                                                                                               |
| m5, m6             |   CHƯA XỬ LÝ    | `Sidebar.tsx` vẫn 612 dòng (`[CMD]` `wc -l`), plan còn thêm logic drag vào. Backlog A11Y của slider bàn phím chưa được ghi nhận. Vẫn là MINOR.                                                                                                                                                                                                                              |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                    |    Kết quả     | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :-------------------------- | :------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**   |      PASS      | `[CMD]` `npm run type-check` (`tsc --noEmit`) không có lỗi. Không có dependency mới, env var mới, Prisma hay Better Auth. `[CMD]` framer-motion `12.27.5`, tailwindcss `4.1.18`. Các file `[NEW]` (`drawerGesture.ts`, thư mục `sidebar/utils/` chưa tồn tại) được tạo trước khi import → không có import treo.                                                                                                                                                                                            |
| **S2 Lifecycle & Teardown** |    **FAIL**    | `[SRC]` `framer-motion/dist/es/gestures/drag/VisualElementDragControls.mjs:282-314`: khi thả tay, `startAnimation` chạy `inertia` với `min/max` lấy từ `dragConstraints`. Chỉ khi có `dragSnapToOrigin` thì mới ép `{min:0,max:0}`. Với `dragConstraints={{left:-300,right:0}}`, drawer sẽ dừng ở bất kỳ vị trí nào trong `[-300, 0]` (xem M7). `[SRC]` `Sidebar.tsx:561-564`: `animate={{ x: 0 }}` không đổi target nên không chạy lại để kéo drawer về. Không có SSE/AbortController trong phạm vi plan. |
| **S3 Database & Temporal**  |   PASS (N/A)   | Plan không đụng schema, migration hay RPC. Gallery route chỉ đọc và stateless (`route.ts:99-115`). Cả 4 trục đối kháng đều N/A: không ghi dữ liệu, không check-then-act, không có state in-memory.                                                                                                                                                                                                                                                                                                         |
| **S4 Cross-Task State**     | PASS (kèm m10) | `[SRC]` `ChatApp.tsx:750` có `pr-[var(--sar)]` **không prefix** (áp dụng cả mobile). HeaderBar ở <md là `fixed` nên không cộng dồn. Riêng `ChatControls.tsx:146` dùng chung chuỗi `px-4 md:px-6` cho cả nhánh landing (`relative`), nên nếu chèn safe-area vào chuỗi chung thì nhánh landing bị cộng `--sar` hai lần (xem m10).                                                                                                                                                                            |
| **S5 Security Boundary**    |      PASS      | `[SRC]` `gallery/route.ts:62-80`: `auth()` → 401, Zod parse `favorites`, dùng `getSupabaseAdmin` server-only. Plan không thêm API, client Supabase hay fetch URL ngoài. TOCTOU/SSRF: N/A.                                                                                                                                                                                                                                                                                                                  |
| **S6 External Resilience**  |   PASS (N/A)   | Không gọi AI provider, không đổi `maxDuration`.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Domain: WCAG**            | PASS (kèm m8)  | `[CMD]` Đã tính lại 16 cặp accent/`#0a0a0a`: dải 5.00–14.12:1.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Domain: Bilingual**       |    **FAIL**    | `[SRC]` `.agents/rules/04-bilingual.md` ("No Hardcoded Text"). Bước 13 và TC-GAL-01 lại bắt buộc `aria-label="Close image details"` dạng hardcode tiếng Anh, trong khi `GalleryView.tsx:330` đang dùng `g.t("close")` (xem M8).                                                                                                                                                                                                                                                                            |

`[ADV]` Timeline cho cơ chế drag drawer:

```
Cơ chế: motion.aside drag="x", dragConstraints={{left:-300,right:0}}, onDragEnd → shouldCloseDrawer
T1: User vuốt trái 50px chậm (offset.x=-50, velocity.x=-120) rồi thả tay
T2: shouldCloseDrawer → false (chưa qua -80 và -300) → không gọi onCloseMobile
T3: framer chạy inertia {min:-300,max:0}, velocity -120 → x trôi thêm theo quán tính rồi dừng ở một điểm âm trong [-300,0], không quay về 0
Kết cục: drawer kẹt lệch ~50–140px, nội dung bị cắt; animate={{x:0}} không chạy lại → LỖI (MAJOR)
```

Trục đồng thời, TOCTOU và serverless đều N/A (gesture thuần client). Trục thất bại giữa chừng: nếu user đóng drawer khi đang kéo dở, `exit={{x:"-100%"}}` sẽ animate từ vị trí hiện tại → AN TOÀN.

#### Phân loại lỗi

**[MAJOR] M7 — `dragConstraints={{ left: -300, right: 0 }}` làm drawer bị kẹt ở trạng thái mở dở (Bước 12)**

- `[SRC]` `VisualElementDragControls.mjs:289-314`: thả tay thì inertia bị giới hạn bởi constraints chứ không quay về 0, trừ khi có `dragSnapToOrigin`. Xem timeline ở trên.
- **Yêu cầu**: Đổi sang một trong hai cách sau:
  - (a) `dragConstraints={{ left: 0, right: 0 }}` + `dragElastic={{ left: 0.5, right: 0 }}`: kéo kiểu rubber-band và tự bật về 0. `info.offset` là offset của con trỏ, nên ngưỡng -80 vẫn hoạt động.
  - (b) Giữ constraints nhưng thêm `dragSnapToOrigin`.
- Cập nhật Bước 12, §1.2 và thêm assert vào `Sidebar.test.tsx`: mock capture props của `motion.aside` và kiểm tra cấu hình snap-back. Nên dùng chính mock đó để gọi `onDragEnd(undefined, { offset:{x:-120}, velocity:{x:0} })` và assert `onCloseMobile` được gọi. Mock cũng phải loại bỏ các prop framer (`drag*`, `onDragEnd`) trước khi spread xuống `<aside>`, nếu không React sẽ cảnh báo unknown prop và gắn `onDragEnd` vào sự kiện HTML5 `dragend` (`[SRC]` `Sidebar.test.tsx:22-38`).

**[MAJOR] M8 — Test Contract khóa cứng vi phạm quy tắc song ngữ (Bước 13, TC-GAL-01, Risk Table dòng cuối)**

- `[SRC]` `04-bilingual.md`: mọi text người dùng cảm nhận được (kể cả `aria-label` mà screen reader đọc) phải qua `t("key")`. Plan lại bắt buộc `aria-label="Close image details"` hardcode tiếng Anh. Lỗi này đã được nêu ở Run 1 (mục Domain) nhưng Revision 2 không sửa mà còn đưa vào hợp đồng.
- **Yêu cầu**: Thêm key mới (ví dụ `closeImageDetails`) vào `src/lib/utils/translations/vi.ts` và `en.ts`, rồi bổ sung 2 file này vào §5. Dùng `aria-label={g.t("closeImageDetails")}`. Sửa TC-GAL-01 để assert theo key/giá trị dịch. Vì label khác với nút đóng sidebar (`g.t("close")`), việc này cũng giải quyết luôn lỗi `getByRole` multiple match đã nêu ở m3.

**[MINOR]**

- **m8**: Bảng §3.3 có 12/16 số đo sai so với probe (`[CMD]`): gold 14.12 (plan ghi 14.42), holo/nebula 10.96 (13.43), allied 9.24 (10.68), amber 9.22 (9.80), blueprint 7.79 (8.44), charcoal 7.62 (8.01), pitch-black 7.80 (7.89), aqua 7.95 (7.50), sunset 7.06 (7.42), rose 7.36 (6.41), red 7.16 (6.32), orchid/yuri 5.00 (5.01). Ngoài ra `#0a0a0a` có L ≈ 0.0030, không phải 0.0028. Kết luận ≥ 4.5 không đổi và test tự tính từ CSS, nên chỉ cần sửa bảng cho đúng.
- **m9**: `theme-config.test.ts` sẽ không tìm thấy `--accent-foreground` trong bất kỳ selector `.theme-<id>` nào, nên phải fallback về `:root` trong `base.css`. Parser cũng phải xử lý value nhiều dòng (`--surface:` dạng gradient ở RA2/orchid) và value `rgba(...)` cho `--surface-elevated`. Nên ghi rõ điều này để test không fail giả.
- **m10**: Bước 10 cần chỉ rõ chỉ đặt `pl/pr` safe-area vào **nhánh non-landing (fixed)** của `ChatControls.tsx:146-151`. Nhánh landing (`relative`) nằm trong container đã có `pr-[var(--sar)]`. Bước 9 bỏ `sm:px-6` cũ, nên dải 640–767px đổi padding từ 1.5rem xuống 1rem; cần xác nhận đây là chủ ý.
- **m11**: TC-GAL-02 dùng "container rộng 400px", nhưng `vitest.config.ts` chạy `happy-dom`, nơi `getBoundingClientRect()` trả về 0. Test phải stub `getBoundingClientRect` (`{left:0,width:400}`), nếu không phép chia cho 0 sẽ cho `NaN`.
- **m12**: TC-MOB-04 thiếu biên velocity `-300` (Bước 12 có liệt kê) → nên bổ sung để chốt rõ ngữ nghĩa `<` hay `<=`. m5 (tách `Sidebar.tsx` 612 dòng) và m6 (backlog slider bàn phím) vẫn còn mở.

#### Kết luận

**[CHANGES_REQUESTED]** — Revision 2 đã khắc phục tốt M1–M5 (đã kiểm chứng bằng probe twMerge, Tailwind compile và WCAG). Còn 2 lỗi `[MAJOR]` mới. Không có `[BLOCKER]`.

Việc cần làm cho Revision 3:

1. M7: Sửa cấu hình drag để drawer bật về 0 khi không đóng (`dragConstraints={{left:0,right:0}}` + elastic, hoặc `dragSnapToOrigin`), đồng thời bổ sung test wiring `onDragEnd` → `onCloseMobile` qua mock đã lọc prop framer.
2. M8: Thay `aria-label` hardcode bằng translation key mới trong `vi.ts`/`en.ts`, thêm 2 file vào §5 và sửa TC-GAL-01.
3. (Khuyến nghị) Sửa các MINOR m8–m12.

### Audit Run 3

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-10
- **Đối tượng**: Technical Plan — Revision 3

#### Kiểm chứng lỗi cũ

| Mã      | Trạng thái | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :------ | :--------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M7**  |   ĐÃ SỬA   | Bước 13, §1.2, §3.7 và TC-MOB-04 đều dùng `dragConstraints={{left:0,right:0}}` + `dragElastic={{left:0.5,right:0}}` + `dragSnapToOrigin`. `[SRC]` `framer-motion@12.27.5` `VisualElementDragControls.mjs:289-291`: khi có `dragSnapToOrigin` thì inertia bị ép `{min:0,max:0}`, nên drawer luôn quay về `x=0`. `[SRC]` `:116-123` + `:203-210`: `updateAxis` chỉ áp `applyConstraints` lên giá trị hiển thị, còn `info.offset` là offset con trỏ, nên ngưỡng `-80` vẫn chạm được dù elastic là 0.5. `[SRC]` `Sidebar.test.tsx:105` render `mobileOpen={true}`, nên mock capture `onDragEnd` của `motion.aside` là khả thi. `[SRC]` Mock hiện tại (`Sidebar.test.tsx:22-38`) spread toàn bộ props → Bước 13 đã yêu cầu lọc `drag*`/`onDragEnd`. |
| **M8**  |   ĐÃ SỬA   | Key `closeImageDetails` đã được thêm vào Bước 7 và §5 (#23, #24) cho cả `vi.ts`/`en.ts`. Plan dùng `aria-label={g.t("closeImageDetails")}`. `[CMD]` `grep closeImageDetails src` → chưa tồn tại, nên không trùng key. `[SRC]` `GalleryView.test.tsx:10` mock `t: (key) => key`, nên 2 nút có accessible name khác nhau (`close` và `closeImageDetails`) → `getByRole` không còn multiple match (đóng luôn m3).                                                                                                                                                                                                                                                                                                                                 |
| **m8**  |   ĐÃ SỬA   | `[CMD]` Probe WCAG `node -e` khớp 16/16 số đo trong §3.3 (gold 14.12 … orchid/yuri 5.00, `L(#0a0a0a)=0.0030`). `[CMD]` Grep `--accent:` trên 16 file CSS khớp với bảng hex.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **m9**  |   ĐÃ SỬA   | Bước 8 ghi rõ fallback `:root`, hỗ trợ giá trị gradient nhiều dòng và `rgba`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **m10** |   ĐÃ SỬA   | Bước 11 chỉ thêm safe-area vào nhánh non-landing. Bước 10 giữ `sm:` = 1.5rem nên dải 640–767px không đổi padding. (Có phát sinh class chết, xem m13.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **m11** |   ĐÃ SỬA   | Bước 15 và TC-GAL-02 đã stub `getBoundingClientRect` `{left:0,width:400}`. `[SRC]` `ImageCompareModal.tsx:68-71` chia cho `rect.width` → stub là bắt buộc, plan đã có.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **m12** |   ĐÃ SỬA   | TC-MOB-04 đã có biên velocity `-300` → `true` (ngữ nghĩa `<=` được chốt).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| m5, m6  | CHƯA XỬ LÝ | `[CMD]` `wc -l Sidebar.tsx` = 612 dòng. Backlog bàn phím cho slider chưa được ghi. Vẫn là MINOR, không chặn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                    |    Kết quả     | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :-------------------------- | :------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**   |      PASS      | `[CMD]` `npm run type-check` (`tsc --noEmit`) → exit 0. Không thêm dependency hay env var, không có Prisma hoặc Better Auth. `[SRC]` `src/app/layout.tsx:16-20` có `viewport` để bổ sung `interactiveWidget` (kiểu đã xác minh ở Run 1). `[SRC]` `theme-config.ts:41` đã export `getThemeById`. Có 16 theme id (`[CMD]` `grep -c 'id: "'` = 16). File `drawerGesture.ts` là `[NEW]` và được tạo trước khi import. `docs/CHANGELOG.md` tồn tại.               |
| **S2 Lifecycle & Teardown** |      PASS      | `[SRC]` `VisualElementDragControls.mjs:164-172` `stop()` → `startAnimation` (snap về 0) → `onDragEnd`. Nếu `shouldCloseDrawer` = true thì `onCloseMobile` → AnimatePresence chạy `exit={{x:"-100%"}}` trên cùng motion value, `MotionValue.start` dừng animation snap trước đó → không có animation tranh chấp. Mock framer trong test được lọc props → không bị dính handler HTML5 `dragend`. Không có SSE, AbortController hay AudioContext trong phạm vi. |
| **S3 Database & Temporal**  |   PASS (N/A)   | Không có schema, migration hay RPC. Gallery route chỉ đọc. `[CMD]` vitest 4 file liên quan (route, GalleryView, Sidebar, HeaderBar): **30/30 pass**, baseline giữ được 22 test của `route.test.ts`. Cả 4 trục đối kháng đều N/A: không ghi dữ liệu, không check-then-act, không có state in-memory.                                                                                                                                                          |
| **S4 Cross-Task State**     | PASS (kèm m13) | `[SRC]` `ChatApp.tsx:750` (`md:pl…--sal`, `pr-[var(--sar)]`), `HeaderBar.tsx:66-73` (`fixed` ở <md, `md:sticky`), `ChatControls.tsx:145-151` (chuỗi chung `px-4 md:px-6`). `[CMD]` Compile Tailwind 4 (`@tailwindcss/postcss`): `.px-4` → `.pr-[…]`/`.pl-[…]` → `.md:px-0` → `.md:px-6`. Như vậy trên mobile, safe-area `pl/pr` thắng `px-4`; ở `md+`, `md:px-6` thắng → không cộng dồn và desktop không mất padding.                                        |
| **S5 Security Boundary**    |      PASS      | Không thêm API route, Supabase client hay fetch URL ngoài. `gallery/route.ts` vẫn giữ `auth()` → 401 (đã xác minh ở Run 2). TOCTOU/SSRF: N/A.                                                                                                                                                                                                                                                                                                                |
| **S6 External Resilience**  |   PASS (N/A)   | Không gọi AI provider, không đổi `maxDuration`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Domain: WCAG / Theming**  |      PASS      | `[CMD]` 16 cặp accent/`#0a0a0a` nằm trong dải 5.00–14.12:1. `#ffffff` FAIL ở cả 16 theme (1.40–3.96) → quyết định không override là đúng. `[SRC]` `base.css:128-138`: `:root.theme-orchid` nằm trong khối `color-scheme: dark`, đúng với Bước 2.                                                                                                                                                                                                             |
| **Domain: Bilingual**       | PASS (kèm m15) | Key mới được thêm vào cả 2 file. Lưu ý: kiểm tra parity tại `translations/index.ts:24-35` **không hoạt động** vì `TranslationSet` khai báo `Record<string,string>` → `keyof` = `string`, nên tsc không bắt được key thiếu (xem m15).                                                                                                                                                                                                                         |

`[ADV]` Timeline cho cơ chế drag drawer (Revision 3):

```
Cơ chế: motion.aside drag="x" dragDirectionLock dragConstraints={{left:0,right:0}} dragElastic={{left:0.5,right:0}} dragSnapToOrigin
T1: User vuốt trái 50px chậm (offset.x=-50, velocity.x=-120) → x hiển thị ≈ -25 (elastic 0.5) | T2: thả tay → stop() → inertia {min:0,max:0} | T3: shouldCloseDrawer → false
Kết cục: drawer bật về x=0, không kẹt → AN TOÀN
T1b: vuốt trái nhanh (offset.x=-40, velocity.x=-450) | T2b: snap bắt đầu, onDragEnd → shouldCloseDrawer true → onCloseMobile | T3b: exit x:"-100%" thay thế animation snap
Kết cục: drawer đóng mượt → AN TOÀN
T1c: user vuốt dọc để cuộn danh sách | T2c: dragDirectionLock khóa trục y → không cập nhật x | T3c: onDragEnd vẫn bắn với offset.x nhỏ → shouldCloseDrawer false
Kết cục: không đóng nhầm → AN TOÀN
```

Trục đồng thời, TOCTOU và serverless đều N/A (gesture thuần client). Trục thất bại giữa chừng: đóng drawer bằng nút X khi đang kéo → `exit` animate từ vị trí hiện tại → AN TOÀN.

#### Phân loại lỗi

Không còn `[BLOCKER]` hay `[MAJOR]`.

**[MINOR]** (không chặn, nên xử lý khi triển khai)

- **m13**: Bước 11 đưa `md:px-0` vào nhánh non-landing, nhưng chuỗi chung đã có `md:px-6`. Template literal không đi qua `cn()`/twMerge, nên hai class cùng tồn tại. `[CMD]` Tailwind xuất `md:px-6` sau `md:px-0` → `md:px-0` là class chết, kết quả đúng chỉ nhờ thứ tự sort nội bộ. Nên bỏ `md:px-0` cho rõ ý đồ.
- **m14**: TC-MOB-01 (`viewport.interactiveWidget`) và TC-MOB-02 (phần ChatControls) không có file test tương ứng trong §8.1 (`[CMD]` không có `layout.test.tsx` hay `ChatControls.test.tsx`). Cần ghi rõ phương thức nghiệm thu (grep hoặc review) hoặc thêm test nhẹ, ví dụ import `viewport` từ `layout.tsx` rồi assert.
- **m15**: TC-GAL-01 mô tả assert theo giá trị dịch, nhưng mock `t` trả về key (`GalleryView.test.tsx:10`) → test nên assert `name: "closeImageDetails"`. Vì kiểm tra parity vi/en ở `translations/index.ts` không có hiệu lực, implementer phải tự xác nhận key có mặt ở cả 2 file (có thể thêm 1 assert vào test).
- **m16**: TC-MOB-02 ghi `var(--sar)` nhưng class thực tế là `var(--sar,0px)` → assert nên khớp chuỗi con `var(--sar` để không fail giả.
- **m5 / m6** (từ Run 1): tách `Sidebar.tsx` (612 dòng > hard max 500); ghi backlog hỗ trợ bàn phím cho slider so sánh.

#### Kết luận

**APPROVED** — Revision 3 đã khắc phục dứt điểm M7 (đã kiểm chứng trong source framer-motion 12.27.5) và M8 (key song ngữ cùng chiến lược test không còn multiple match), cùng các MINOR m8–m12. S1–S6 đều PASS hoặc N/A có bằng chứng `[CMD]`/`[SRC]`/`[ADV]`. Các MINOR m13–m16, m5, m6 không chặn kế hoạch; khuyến nghị xử lý trong lúc triển khai.

[PLAN_APPROVED]
