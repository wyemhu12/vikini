# Kế Hoạch Triển Khai: Giai Đoạn 4 — Bilingual i18n, WCAG 2.2 Accessibility, Performance Optimization & Co-located Tests (Phase 4 Remediation)

> **Mã Tài Liệu**: `docs/plans/2026-10-11-audit-remediation-phase-4-i18n-a11y-perf-tests.md`  
> **Ngày Lập**: 11/10/2026  
> **Phiên Bản (Revision)**: 3 (Cập nhật xử lý 100% phản hồi từ Audit Run 2 của Lead Reviewer: MAJOR-7, MAJOR-8, MINOR-R2-1 đến MINOR-R2-5)  
> **Tác Giả**: Technical Planner (Vikini Antigravity)  
> **Trạng Thái**: Status: Ready for Review (Audit Run 3)  
> **Tài Liệu Căn Cứ**: [`docs/audit-report-2026-10-01.md`](../audit-report-2026-10-01.md), [`.agents/rules/00-core.md`](../../.agents/rules/00-core.md), [`.agents/rules/01-coding.md`](../../.agents/rules/01-coding.md), [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md), [`.agents/rules/03-ui.md`](../../.agents/rules/03-ui.md), [`.agents/rules/04-bilingual.md`](../../.agents/rules/04-bilingual.md), [`.agents/rules/05-plan-review.md`](../../.agents/rules/05-plan-review.md)

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Hoàn thiện toàn diện phân hệ Đa ngôn ngữ (Bilingual i18n - Rule 04), Tiêu chuẩn Trợ năng Tiếp cận (WCAG 2.2 Level AA), Tối ưu hóa Hiệu năng Render (Tránh vỡ React.memo khi streaming AI), và Bổ sung 100% Co-located Unit/Component Tests theo các phát hiện từ Báo cáo Audit `docs/audit-report-2026-10-01.md` (Mục 6.3, 6.4 và Mục 7 — Giai đoạn 4), khắc phục triệt để các phát hiện trong Audit Run 1 và Audit Run 2:

1. **Chuẩn Hóa Song Ngữ (Bilingual i18n - Rule 04 & I18N-01, I18N-02, MAJOR-7)**:
   - **I18N-01 (Compile-time Parity Enforcement)**: Bổ sung 3 translation keys còn thiếu trong `src/lib/utils/translations/vi.ts` (`language`, `themes`, `loadingConfigs`) so với `en.ts`. Tái cấu trúc Type Assertion trong `src/lib/utils/translations/index.ts`: loại bỏ việc ép kiểu nới lỏng sang `Record<string, string>` khiến `tsc` bị vô hiệu hóa; áp dụng compile-time check hai chiều bắt buộc TypeScript báo lỗi ngay lập tức khi phát hiện bất kỳ key nào lệch pha giữa `vi.ts` và `en.ts`. Giữ nguyên type exports `TranslationKey`, `TranslationValue`, `Translations`, `TranslationSet` để bảo đảm tương thích với `src/lib/utils/config.ts`.
   - **Quy Tắc Kiểm Tra Key Trùng, Dead-Code Fallback & Xử Lý Key Tham Chiếu (MAJOR-1, MAJOR-2, MAJOR-7)**:
     - Trước khi bổ sung bất kỳ key nào, bắt buộc kiểm tra sự tồn tại trong từ điển. Loại bỏ hoàn toàn `newProject`, `rankChangeConfirm`, `rankChangeDesc` khỏi danh sách key thêm mới vì đã có sẵn trong cả `vi.ts` và `en.ts`, tránh lỗi `TS1117: An object literal cannot have multiple properties with the same name`. Tái sử dụng giá trị hiện có.
     - Bổ sung `clearIcon`, `failedUpdateUser`, và `icon` vào cả `vi.ts` và `en.ts`.
     - **Khắc phục lỗi key tham chiếu chưa tồn tại (MAJOR-7)**: Bổ sung key `adminManagement`: `"Admin Management"` (en) và `"Quản lý hệ thống"` (vi) vào cả `vi.ts` và `en.ts`. Tại `Sidebar.tsx:510`, đổi `t?.signOut || t?.logout || "Sign Out"` thành `t("signOut")` (key `signOut` đã có sẵn trong từ điển).
     - Lưu ý kỹ thuật bắt buộc: Hàm `t(key)` trong `src/app/features/chat/hooks/useLanguage.ts:27` trả về chính `String(key)` khi không tìm thấy chuỗi bản dịch. Do chuỗi key luôn mang giá trị truthy, biểu thức fallback dạng `t("key") || "fallback"` là **dead code** (không bao giờ lọt vào vế sau `||`). Không được dùng `|| "fallback"` làm lưới an toàn; 100% các chuỗi UI phải có translation key hợp lệ trong từ điển.
   - **I18N-02 (Xóa Bỏ Triệt Để Prop Drilling `t`)**: Loại bỏ thuộc tính `t?: Record<string, string>` trong `SidebarProps` tại `src/app/features/sidebar/components/Sidebar.tsx` và xóa bỏ việc truyền `t={t}` hoặc ép kiểu `t as unknown as Record<string, string>` tại 4 consumer: `ChatApp.tsx`, `GalleryView.tsx`, `DescribeImageView.tsx`, `ImageGenStudio.tsx`. Toàn bộ component (`Sidebar`, `SidebarItem`, `SidebarSection`, `ProjectNode`) bắt buộc sử dụng trực tiếp hook `useLanguage()`.
   - **Bản Địa Hóa Toàn Diện Các Chuỗi Hardcoded Còn Sót (MINOR-R2-1, MINOR-R2-4)**:
     - Quét và thay thế toàn bộ các chuỗi tiếng Anh hardcoded trên UI thành `t("key")` tại các file: `Sidebar.tsx` (gồm tooltip GEMs `t("gemsDesc")`, `aria-label={t("navigation")}`, `label={isCollapsed ? t("expand") : t("collapse")}`, `label={t("adminManagement")}`), `SidebarItem.tsx`, `KnowledgePanel.tsx`, `PersonaEditor.tsx`, `UserManager.tsx` (dùng `t("failedUpdateUser")`), `CreateProjectModal.tsx`, `IconPicker.tsx` (thay `Icon: ${value}` bằng `${t("icon")}: ${value}`, nhãn `t("clearIcon")`), và `ToastContainer.tsx` (thêm `aria-label={t("close")}`).
     - Trong `HeaderBar.tsx`, sử dụng ánh xạ tường minh `THEME_GROUP_LABELS: Record<ThemeGroup, TranslationKey>` để compiler TypeScript bắt buộc kiểm tra đủ nhóm theme ("Focus", "Glassmorphism", "Red Alert 2") (MINOR-R2-4).

2. **Trợ Năng Accessibility (WCAG 2.2 Level AA - A11Y-02, A11Y-03, MINOR-R2-5)**:
   - **A11Y-02 (Tái Cấu Trúc Toàn Diện `IconPicker.tsx` - MAJOR-2, MINOR-2, MINOR-3, MINOR-R2-5)**:
     - Nhập và sử dụng `useLanguage` từ `@/app/features/chat/hooks/useLanguage` (tiền lệ tương tự `src/components/ui/confirm-dialog.tsx:15`).
     - Loại bỏ anti-pattern `<div role="combobox">` bọc `<button type="button">`. Chuyển nút kích hoạt Popover thành semantic `<button type="button">` với đầy đủ `aria-haspopup="dialog"`, `aria-expanded={open}`, `aria-label={value ? `${t("icon")}: ${value}` : t("selectIcon")}`.
     - **Bảo toàn prop `className` trên trigger (MINOR-R2-5)**: Giữ nguyên prop `className` trên trigger `<button type="button">`, không chuyển sang wrapper `div`, để đảm bảo tương thích styling đầy đủ với mọi caller.
     - Khi có `value`, bổ sung padding-right `pr-14` cho nút trigger để tránh nút Clear icon che mất text nhãn icon.
     - Tách nút xóa icon (`handleClear`) thành button anh em (sibling) độc lập đặt tại `absolute right-8`, gọi đồng thời `e.stopPropagation()` và `e.preventDefault()`, có `title={t("clearIcon")}` và `aria-label={t("clearIcon")}`.
   - **A11Y-03 (Bổ Sung Visible Focus Indicators & Dọn Dẹp Class Cũ - MINOR-9, MINOR-R2-1)**:
     - Bổ sung lớp `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho toàn bộ các nút bấm tương tác: `SidebarButton`, `SidebarItem` (nút chọn hội thoại, menu 3 chấm, dropdown items), `ProjectNode` (chevron toggle, project header, new chat, options), nút dismiss trong `ToastContainer.tsx` (nhãn `t("close")`), và CreateProjectModal close button.
     - Dọn sạch class quy ước Tailwind v3 `focus:ring-opacity-50` tại `HeaderBar.tsx:57`, thay thế bằng `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none`.

3. **Tối Ưu Hiệu Năng & Bảo Toàn Memoization (Performance - PERF-01, PERF-02 - MAJOR-3, MAJOR-4, MINOR-R2-3)**:
   - **PERF-01 (Bảo Vệ `React.memo` & Phạm Vi Memoization - MINOR-R2-3)**:
     - **Mục tiêu cốt lõi của memoization (MINOR-R2-3)**: Bảo vệ memoization cho `SidebarItem` (`React.memo`) để ngăn chặn việc hàng chục mục hội thoại bị re-render liên tục theo từng token AI stream về trong cửa sổ chat.
     - **Phạm vi phase hiện tại**: Nhận diện rằng các nút điều hướng cố định (`SidebarButton`) và cây thư mục dự án (`ProjectNode:408-420`) vẫn sử dụng inline callback arrow vì không chịu ảnh hưởng bởi tần suất stream token của cửa sổ chat.
     - **Nguyên tắc Rules of Hooks (MAJOR-3)**: Tuyệt đối KHÔNG được đặt `useCallback` bên trong hàm render helper `renderSidebarContent(isMobile = false)` vì hàm này được gọi có điều kiện khi `mobileOpen` bật/tắt, sẽ gây vi phạm React Rules of Hooks dẫn tới crash màn hình.
     - **Giải pháp Hoist**: Hoist `handleNavigation` lên thân component `Sidebar`, bọc bằng `useCallback`:
       ```typescript
       const handleNavigation = useCallback(
         (path: string, isMobile: boolean) => {
           router.push(path);
           if (isMobile) onCloseMobile?.();
         },
         [router, onCloseMobile]
       );
       ```
     - Bọc toàn bộ các hàm callback truyền vào `SidebarItem` trong `Sidebar.tsx` (`handleSelect`, `handleNew`, `handleOpenGems`, `handleOpenPersonas`, `handleRename`, `handleDelete`) bằng `useCallback` với dependency tối giản và chuẩn xác. Điều này ngăn chặn việc `SidebarItem` bị re-render liên tục theo từng token AI stream về (bảo toàn shallow comparison của `React.memo`).
     - **Ghi nhận nợ kỹ thuật (MINOR-6)**: `Sidebar.tsx` hiện có hơn 620 dòng (vượt khuyến nghị 500 dòng). Trong giai đoạn này, giữ nguyên cấu trúc một file để bảo toàn các sửa đổi gesture drawer của Phase 3 đang uncommitted, ghi nhận việc tách module vào Technical Debt backlog.
   - **PERF-02 (Loại Bỏ Hand-Rolled SVG Khỏi `SidebarItem.tsx` - MAJOR-5)**: Xóa bỏ 4 hàm SVG tự chế thủ công (`EllipsisVerticalIcon`, `PencilIcon`, `TrashIcon`, `DownloadIcon`) vi phạm Rule 03; thay thế bằng các icon chuẩn từ thư viện `lucide-react`:
     - `MoreVertical` (render ra `<svg class="lucide lucide-ellipsis-vertical">`)
     - `Pencil` (render ra `<svg class="lucide lucide-pencil">`)
     - `Trash2` (render ra `<svg class="lucide lucide-trash-2 lucide-trash2">`)
     - `Download` (render ra `<svg class="lucide lucide-download">`)
     - `Loader2` (render ra `<svg class="lucide lucide-loader-circle">`)

4. **Bổ Sung Đầy Đủ Co-located Tests & Type Safety (MAJOR-5, MAJOR-6, MAJOR-7, MAJOR-8, MINOR-R2-2, MINOR-R2-4)**:
   - `[NEW] src/lib/utils/translations/index.test.ts` (MAJOR-7): Kiểm tra 100% parity keys giữa `vi.ts` và `en.ts`, assert không có key nào mang giá trị rỗng `""`, kiểm tra export `TranslationKey`, `TranslationSet`, `Translations`. **Đặc biệt**: Bổ sung test case duyệt danh sách toàn bộ các translation keys được tham chiếu trong các file sửa đổi (`Sidebar`, `SidebarItem`, `IconPicker`, `HeaderBar`, `PersonaEditor`, `UserManager`, `KnowledgePanel`, `ToastContainer`) và assert 100% các keys này tồn tại và không rỗng trong cả `vi.ts` và `en.ts`.
   - `[MODIFY] src/app/features/personas/components/PersonaEditor.tsx` (MAJOR-8): Khai báo tường minh kiểu trả về cho hàm helper:
     `const getToneOptions = (t: (key: string) => string): { value: PersonaTone; label: string; description: string }[] => [ ... ];`
     và trong component gọi `const toneOptions = useMemo(() => getToneOptions(t), [t]);`, loại bỏ hoàn toàn nguy cơ mất type annotation gây lỗi TS2345.
   - `[NEW] src/lib/features/image-gen/templates.test.ts`: Kiểm tra toàn bộ 18 curated templates, cấu trúc song ngữ `en`/`vi`, thuộc tính `requiresPhoto`, styles, và assert ID của 6 templates đầu tiên chính xác là `["anime", "cinematic", "clay", "neon", "headshot", "watercolor"]`.
   - `[NEW] src/lib/features/image-gen/stylePrompts.test.ts`: Kiểm tra đầy đủ 18 cấu hình styles trong `STYLE_PROMPTS` (gồm cả `art-nouveau`), instruction system (> 50 ký tự), shortAppends, kiểm tra hàm export `getStyleInstruction` (happy path và edge cases `"none"`, `""`, id lạ), và kiểm tra chéo 100% `template.style` đều có trong `STYLE_PROMPTS`.
   - `[NEW] src/lib/features/image-gen/core/ImageGenFactory.test.ts`: Kiểm tra Factory khởi tạo đúng provider instances (Gemini, Replicate, OpenAI), kiểm tra alias `"gemini-native"` cùng trỏ về `GeminiNativeImageProvider`, kiểm tra singleton identity (`getProvider("gemini") === getProvider("gemini")`), và ném lỗi khi gặp ID lạ.
   - `[NEW] src/components/ui/IconPicker.test.tsx`: Kiểm tra semantic button, `pr-14` khi có value, popover open/close, icon selection, clear action (sibling button với `stopPropagation` và `preventDefault`), keyboard focus-visible.
   - `[NEW] src/app/features/sidebar/components/SidebarItem.test.tsx` (MINOR-R2-2): Chiến lược kiểm tra Dropdown menu rõ ràng: Mock `@radix-ui/react-dropdown-menu` để render nội dung inline, hoặc kích hoạt mở menu qua `pointerdown` / keyboard và assert trên `document.body` / `baseElement` để kiểm tra các icon Lucide (`lucide-ellipsis-vertical`, `lucide-trash-2`, `lucide-pencil`, `lucide-download`), assert số lượng inline svg không có class `lucide` bằng 0.
   - `[MODIFY] src/app/features/sidebar/components/Sidebar.test.tsx`: Kiểm tra reference stability (TC-PERF-01) thông qua spy component của `SidebarItem`, test case thuận (prop không liên quan đổi -> callbacks giữ nguyên `toBe`) và test case nghịch đối chứng (thay đổi `onSelectConversation` -> callback đổi `not.toBe`). Thiết lập `useLanguageStore.setState({ language: "vi" })` và reset về `"en"` trong `afterEach`.
   - `[MODIFY] src/app/features/layout/HeaderBar.test.tsx` (MINOR-R2-4): Cập nhật mock `translations` dictionary với `themeFocus`, `themeGlassmorphism`, `themeRa2`, và `theme`; assertion kiểm tra `t("theme")`, không còn class `focus:ring-opacity-50`.
   - Xác thực chất lượng toàn diện với `npm run verify` (`npm run type-check && npm run lint && npm run test:run`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ nghiêm ngặt Giao thức Pre-Work trong [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md):

| Lĩnh Vực / Module                      | Tài Liệu Bắt Buộc Đọc Trước Khi Viết Code                                                             | Quy Chuẩn Kỹ Thuật Áp Dụng                                                                                                                                                              |
| :------------------------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bilingual i18n & Type Safety**       | [`.agents/rules/04-bilingual.md`](../../.agents/rules/04-bilingual.md), `src/lib/utils/translations/` | Cấm prop drilling `t`; bắt buộc `useLanguage() + t("key")`; 100% key parity giữa `vi.ts` và `en.ts` ở cấp độ TypeScript compile; kiểm tra key tồn tại trước khi thêm.                   |
| **UI Design & A11y Standards**         | [`.agents/rules/03-ui.md`](../../.agents/rules/03-ui.md), W3C WCAG 2.2 SC 2.4.11 (Focus Appearance)   | Cấm `<div role="combobox">` lồng button; bắt buộc native `<button>`, `focus-visible:ring-2 focus-visible:ring-(--ring)`; cấm v3 `focus:ring-opacity-50`.                                |
| **React 19 & Memoization Performance** | [`.agents/rules/01-coding.md`](../../.agents/rules/01-coding.md), React 19 Compiler / Memo Guarantees | Bọc callback truyền vào `React.memo` bằng `useCallback`; cấm gọi hook trong hàm helper có điều kiện; cấm inline SVG thủ công, dùng Lucide icons.                                        |
| **Co-located Testing Standards**       | [`.agents/rules/01-coding.md`](../../.agents/rules/01-coding.md), Vitest 4 Documentation              | Co-located tests `*.test.ts` / `*.test.tsx` cạnh file nguồn trong `lib/` và `components/ui/`; test cả happy path lẫn error path và edge cases; reset singleton store sau mỗi test case. |
| **Plan-Review & Code Freeze Protocol** | [`.agents/rules/05-plan-review.md`](../../.agents/rules/05-plan-review.md)                            | Giữ nguyên code freeze trước khi nhận `[PLAN_APPROVED]`; cấu trúc phân khu kép `Technical Plan` và `Audit History`.                                                                     |

> [!WARNING] **LƯU Ý ĐẶC BIỆT DÀNH CHO EXECUTOR (Phase 3 Baseline Protection)**:
> Trong working tree hiện đang có **30 files chưa commit** thuộc Phase 3 (`Sidebar.tsx`, `HeaderBar.tsx`, `vi.ts`, `en.ts`, CSS theme...). Executor tuyệt đối KHÔNG được thực hiện các lệnh nguy hiểm như `git checkout -- .`, `git reset --hard` hay ghi đè toàn bộ file làm mất các tính năng cử chỉ drawer vuốt chạm, theme switcher đã hoàn thành ở Phase 3. Mọi thao tác chỉnh sửa phải là granular targeted diff.

---

### 3. Assumptions & Cross-Task Dependencies

1. **Nguyên Nhân Gốc Khiến Compile-time Check Bị Vô Hiệu Hóa & Giải Pháp Bảo Toàn Type (MAJOR-1, MINOR-8)**:
   - Trong `src/lib/utils/translations/index.ts`, việc gán `export const translations: TranslationSet = { vi, en };` làm TypeScript mở rộng kiểu của `vi` và `en` thành `Record<string, string>`, khiến biểu thức `Record<EnKeys, string> extends Record<ViKeys, string>` luôn đánh giá là `true` kể cả khi `vi.ts` thiếu key.
   - **Giải pháp**: Xuất `translations` dưới dạng đối tượng thuần túy suy luận kiểu hẹp:
     ```typescript
     export const translations = { vi, en };
     export const tVi = translations.vi;
     export const tEn = translations.en;
     ```
   - Đồng thời giữ nguyên các type exports cho backward-compatibility với `src/lib/utils/config.ts`:
     ```typescript
     export type TranslationKey = keyof typeof en;
     export type TranslationValue = string;
     export interface Translations {
       [key: string]: TranslationValue | Translations;
     }
     export interface TranslationSet {
       vi: Record<string, string>;
       en: Record<string, string>;
     }
     ```
   - Thiết lập compile-time assertion hai chiều nghiêm ngặt:
     ```typescript
     type MissingInVi = Exclude<keyof typeof en, keyof typeof vi>;
     type MissingInEn = Exclude<keyof typeof vi, keyof typeof en>;
     type _AssertTranslationsParity = [MissingInVi, MissingInEn] extends [never, never]
       ? true
       : {
           error: "Compile Error: Translation keys mismatch between vi.ts and en.ts";
           missingInVi: MissingInVi;
           missingInEn: MissingInEn;
         };
     const _parityAssertion: _AssertTranslationsParity = true;
     void _parityAssertion;
     ```

2. **Cơ Chế Khử Prop Drilling `t`, Dead-Code Fallback & Bổ Sung Key Tham Chiếu (MAJOR-2, MAJOR-7)**:
   - Trong `SidebarProps`, xóa trường `t?: Record<string, string>`. `Sidebar.tsx` và các component con (`SidebarItem`, `ProjectNode`) trực tiếp gọi `const { t } = useLanguage();`.
   - Xóa bỏ việc truyền prop `t` ở 4 file cha: `ChatApp.tsx:732`, `GalleryView.tsx:50`, `DescribeImageView.tsx:215`, và xác nhận `ImageGenStudio.tsx` không truyền `t`.
   - **Bản chất của `t()`**: Theo `src/app/features/chat/hooks/useLanguage.ts:27`, chuỗi fallback cuối cùng của hàm `t(key)` là `String(key)`. Vì chuỗi key luôn là truthy, cấu trúc `t("key") || "fallback text"` là **dead code** (vế sau `||` không bao giờ được đánh giá). Do đó, kế hoạch loại bỏ hoàn toàn thói quen viết fallback dead code; 100% key phải tồn tại trong cả `vi.ts` và `en.ts`.
   - **Khắc phục lỗi key tham chiếu chưa tồn tại (MAJOR-7)**: Parity check hai chiều giữa `vi.ts` và `en.ts` chỉ phát hiện sự lệch pha giữa 2 file; nếu một key bị thiếu ở cả hai file (như `adminManagement`), parity check vẫn pass và compiler `tsc` không bắt được vì `t()` nhận `key: string`. Do đó, kế hoạch áp dụng giải pháp 2 tầng:
     - Bổ sung key `adminManagement`: `"Admin Management"` (en) và `"Quản lý hệ thống"` (vi) vào cả hai file từ điển.
     - Đổi `t?.signOut || t?.logout || "Sign Out"` tại `Sidebar.tsx:510` thành `t("signOut")` (key `signOut` đã có sẵn trong từ điển).
     - Thiết lập test case tự động duyệt 100% các translation keys được tham chiếu trong UI components tại `src/lib/utils/translations/index.test.ts`.

3. **Cơ Chế Bảo Vệ React.memo & Phạm Vi Memoization Trong `Sidebar.tsx` (MAJOR-3, MAJOR-4, MINOR-6, MINOR-R2-3)**:
   - **Mục tiêu cốt lõi (MINOR-R2-3)**: `SidebarItem` được bọc bởi `React.memo`. Để tránh re-render hàng chục items khi token AI đang stream về chat window, các callback truyền vào `SidebarItem` (`onSelect`, `onRename`, `onDelete`) bắt buộc phải duy trì tính ổn định tham chiếu (reference stability) qua `useCallback`.
   - **Phạm vi phase hiện tại**: Các nút điều hướng tĩnh (`SidebarButton`) và cây thư mục dự án (`ProjectNode:408-420`) nhận inline arrow callback là chấp nhận được trong giai đoạn này, do chúng không bị ảnh hưởng bởi luồng stream token của chat window.
   - **Phòng chống Conditional Hook**: Hàm `renderSidebarContent(isMobile = false)` là render helper function được gọi có điều kiện bên trong `{mobileOpen && ...}`. Nếu đặt `useCallback` bên trong hàm này, React sẽ ném lỗi crash: _"Rendered more hooks than during the previous render"_. Do đó, `handleNavigation` bắt buộc phải được **hoist lên thân component `Sidebar`**:
     ```typescript
     const handleNavigation = useCallback(
       (path: string, isMobile: boolean) => {
         router.push(path);
         if (isMobile) onCloseMobile?.();
       },
       [router, onCloseMobile]
     );
     ```
   - **Technical Control cho Hooks (MAJOR-4)**: Do `eslint.config.mjs` chưa wire bộ rule `react-hooks/*`, technical control chính thức để phát hiện phá vỡ memoization hoặc stale closure là **kiểm thử hành vi reference stability (TC-PERF-01)** trong `Sidebar.test.tsx` với cả kịch bản thuận (`toBe`) lẫn kịch bản đối chứng (`not.toBe`).
   - **Nợ kỹ thuật (MINOR-6)**: `Sidebar.tsx` hiện > 620 dòng; việc refactor tách file được hoãn sang phase sau để tránh làm vỡ 30 file chưa commit của Phase 3.

4. **Cơ Chế Trợ Năng Cho `IconPicker.tsx` & Bảo Toàn Prop `className` (MAJOR-2, MINOR-2, MINOR-3, MINOR-R2-5)**:
   - Nhập `useLanguage` từ `@/app/features/chat/hooks/useLanguage` (đã có tiền lệ tại `src/components/ui/confirm-dialog.tsx:15`).
   - Thẻ `<div role="combobox">` bọc `<button>` vi phạm WCAG 4.1.2. Giải pháp: Thẻ ngoài cùng là `div` bố cục. Nút kích hoạt Popover là thẻ semantic `<button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={value ? `${t("icon")}: ${value}` : t("selectIcon")}>`.
   - **Bảo toàn prop `className` trên trigger (MINOR-R2-5)**: Giữ nguyên prop `className` trên trigger `<button type="button">`, không chuyển sang wrapper `div`, để đảm bảo styling của các caller truyền vào không bị lệch.
   - Khi có `value`, gán thêm lớp `pr-14` cho nút trigger để nhãn text không bị đè lên bởi nút xóa icon.
   - Nút Clear icon là button anh em (sibling) độc lập đặt tại `absolute right-8`, gọi đồng thời `e.stopPropagation()` và `e.preventDefault()`, có `title={t("clearIcon")}` và `aria-label={t("clearIcon")}`.

5. **Type Safety Cho PersonaTone Trong `PersonaEditor.tsx` (MAJOR-8)**:
   - Tại `PersonaEditor.tsx:41`, state `tone` được định nghĩa bằng `useState<PersonaTone>("default")`.
   - Nếu hàm tạo dữ liệu động `getToneOptions` không khai báo tường minh kiểu trả về, TypeScript sẽ suy diễn thuộc tính `value` thành kiểu nguyên thủy `string`, dẫn đến lỗi biên dịch `error TS2345: Argument of type 'string' is not assignable to parameter of type 'PersonaTone'` tại các điểm gọi `setTone(opt.value)`.
   - **Giải pháp**: Khai báo tường minh kiểu trả về cho `getToneOptions`:
     ```typescript
     const getToneOptions = (
       t: (key: string) => string
     ): { value: PersonaTone; label: string; description: string }[] => [
       { value: "default", label: t("toneDefault"), description: t("toneDefaultDesc") },
       {
         value: "professional",
         label: t("toneProfessional"),
         description: t("toneProfessionalDesc"),
       },
       { value: "friendly", label: t("toneFriendly"), description: t("toneFriendlyDesc") },
       { value: "candid", label: t("toneCandid"), description: t("toneCandidDesc") },
       { value: "quirky", label: t("toneQuirky"), description: t("toneQuirkyDesc") },
       { value: "efficient", label: t("toneEfficient"), description: t("toneEfficientDesc") },
       { value: "cynical", label: t("toneCynical"), description: t("toneCynicalDesc") },
       { value: "lawyer", label: t("toneLawyer"), description: t("toneLawyerDesc") },
     ];
     ```
     và trong thân component gọi:
     ```typescript
     const toneOptions = useMemo(() => getToneOptions(t), [t]);
     ```

6. **Ánh Xạ Tường Minh Theme Groups Trong `HeaderBar.tsx` (MINOR-R2-4)**:
   - Kiểu `ThemeGroup` trong `@/lib/config/theme-config` gồm `"Focus" | "Glassmorphism" | "Red Alert 2"`.
   - Để tránh việc hiển thị chuỗi tiếng Anh hardcoded hoặc fallback lỏng lẻo, sử dụng ánh xạ tường minh:
     ```typescript
     const THEME_GROUP_LABELS: Record<ThemeGroup, TranslationKey> = {
       Focus: "themeFocus",
       Glassmorphism: "themeGlassmorphism",
       "Red Alert 2": "themeRa2",
     };
     ```
     Điều này đảm bảo compiler TypeScript sẽ báo lỗi ngay lập tức nếu có nhóm theme mới mà chưa được gán TranslationKey.
     Đồng thời cập nhật từ điển mock trong `HeaderBar.test.tsx` để test runner kiểm tra chuẩn xác nhãn hiển thị tiếng Việt.

---

### 4. Bảng Verified Versions (Năm 2026)

Tra cứu trực tuyến và đối soát dependencies thực tế của dự án Vikini:

| Thư Viện / Công Nghệ          | Phiên Bản Cài Đặt (Đã Kiểm Chứng) | Trạng Thái Kiểm Chứng & Quy Chuẩn Áp Dụng                                                     |
| :---------------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------- |
| **Next.js**                   | `16.1.1`                          | Đang cài đặt (`package.json`). App Router, React 19 streaming architecture.                   |
| **React / React DOM**         | `19.2.3`                          | Đang cài đặt (`package.json`). `React.memo` shallow comparison, `useCallback`, Hooks Rules.   |
| **TypeScript**                | `5.9.3`                           | Đang cài đặt (`package.json`). Strict mode (`noImplicitAny`, compile-time parity validation). |
| **Tailwind CSS**              | `4.1.18`                          | Đang cài đặt (`package.json`). CSS variables tokens `bg-(--control-bg)`, `ring-(--ring)`.     |
| **Framer Motion**             | `12.23.26`                        | Đang cài đặt (`package.json`). `AnimatePresence`, motion components, smooth drawer gestures.  |
| **Lucide React**              | `0.562.0`                         | Đang cài đặt (`package.json`). Render classes: `lucide-ellipsis-vertical`, `lucide-trash-2`.  |
| **Radix UI Dialog / Popover** | `1.1.15`                          | Đang cài đặt (`package.json`). Focus trap, ESC key close, ARIA semantics, portal overlays.    |
| **Vitest**                    | `4.0.16`                          | Đang cài đặt (`package.json`). Test runner tốc độ cao, ESM native, co-located tests.          |

---

### 5. Danh Sách Files Cần Chỉnh Sửa / Tạo Mới

#### [MODIFY] — Chỉnh Sửa Các File Hiện Có:

1. `src/lib/utils/translations/vi.ts`: Bổ sung 3 keys thiếu (`language`, `themes`, `loadingConfigs`), key quản trị `adminManagement: "Quản lý hệ thống"` (MAJOR-7), và các keys mới (`clearIcon`, `failedUpdateUser`, `icon`, `gemsDesc`,...). Loại bỏ các keys đã có (`newProject`, `rankChangeConfirm`, `rankChangeDesc`).
2. `src/lib/utils/translations/en.ts`: Bổ sung `adminManagement: "Admin Management"` (MAJOR-7) và các translation keys mới tương ứng để bảo đảm 100% parity.
3. `src/lib/utils/translations/index.ts`: Tái cấu trúc Type Assertion sang compile-time parity check hai chiều, giữ nguyên các type exports cho `config.ts`.
4. `src/app/features/sidebar/components/Sidebar.tsx`: Xóa prop `t`, gọi `useLanguage()`, hoist `handleNavigation` lên thân component bọc bằng `useCallback`, bọc các callbacks bằng `useCallback`, đổi `label={t("adminManagement")}`, đổi `t("signOut")` (MAJOR-7), thay `aria-label={t("navigation")}`, `label={isCollapsed ? t("expand") : t("collapse")}` (MINOR-R2-1), bổ sung focus-visible rings.
5. `src/app/features/sidebar/components/SidebarItem.tsx`: Xóa 4 inline SVG functions, import Lucide icons (`MoreVertical`, `Pencil`, `Trash2`, `Download`, `Loader2`), gọi `useLanguage()`, thay hardcoded text bằng `t()`, bổ sung focus-visible rings.
6. `src/app/features/sidebar/components/ProjectNode.tsx`: Bổ sung focus-visible indicators cho tất cả nút bấm tương tác (chevron, new chat, options, conversation buttons).
7. `src/app/features/chat/components/ChatApp.tsx`: Xóa bỏ việc truyền prop `t={t}` vào `<Sidebar>`.
8. `src/app/features/gallery/components/GalleryView.tsx`: Xóa bỏ việc truyền prop `t={...}` vào `<Sidebar>`.
9. `src/app/features/image-gen/components/DescribeImageView.tsx`: Xóa bỏ việc truyền prop `t={...}` vào `<Sidebar>`.
10. `src/app/features/layout/components/HeaderBar.tsx`: Sử dụng `THEME_GROUP_LABELS: Record<ThemeGroup, TranslationKey>` (MINOR-R2-4), thay thế `"Theme"` hardcoded bằng `t("theme")`, xóa class v3 `focus:ring-opacity-50`, bổ sung focus-visible rings.
11. `src/components/features/projects/KnowledgePanel.tsx`: Thay thế hardcoded text bằng `t()`, thay thế dead classes (`bg-primary`, `bg-destructive`, `border-border`, `text-muted-foreground`) bằng Vikini CSS variable tokens, bổ sung focus-visible rings.
12. `src/app/features/personas/components/PersonaEditor.tsx`: Khai báo kiểu trả về tường minh cho `getToneOptions` với `{ value: PersonaTone; ... }[]` và gọi qua `useMemo` (MAJOR-8), thay thế raw classes (`bg-white text-black`), bổ sung focus-visible rings.
13. `src/app/admin/components/UserManager.tsx`: Thay thế hardcoded error strings bằng `t("failedFetchUsers")`, `t("failedLoadUsers")`, `t("failedUpdateUser")`, `t("failedUpdateUsers")`, thay confirm dialogs và aria-labels bằng `t()`.
14. `src/components/ui/IconPicker.tsx`: Nhập `useLanguage`, thay thế `<div role="combobox">` bằng native `<button type="button">`, bảo toàn prop `className` trên trigger button (MINOR-R2-5), padding `pr-14` khi có value, tách nút Clear icon thành button độc lập với `e.stopPropagation()` và `e.preventDefault()`, bổ sung focus-visible rings và aria attributes localized.
15. `src/components/ui/ToastContainer.tsx`: Bổ sung `aria-label={t("close")}` và `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-md` cho nút đóng thông báo (MINOR-R2-1).
16. `src/components/features/projects/CreateProjectModal.tsx`: Bổ sung `aria-label={t("close")}` và `focus-visible:ring-2 focus-visible:ring-(--ring)` cho nút đóng modal.
17. `src/app/features/sidebar/components/Sidebar.test.tsx`: Cập nhật render test (không truyền `t`), test reference stability (TC-PERF-01) với spy component, reset `useLanguageStore` sau mỗi test.
18. `src/app/features/layout/HeaderBar.test.tsx`: Cập nhật mock `translations` dictionary với các theme group labels `themeFocus`, `themeGlassmorphism`, `themeRa2`, và `theme` (MINOR-R2-4), assert không còn class v3.

#### [NEW] — Tạo Mới Các File Test Co-located:

19. `src/lib/utils/translations/index.test.ts`: Test kiểm tra 100% key parity giữa `vi.ts` và `en.ts`, kiểm tra không có key rỗng, kiểm tra exports `TranslationSet`, `Translations`, `TranslationKey`. Bổ sung test case duyệt danh sách toàn bộ các translation keys được tham chiếu trong UI components (`Sidebar`, `SidebarItem`, `IconPicker`, `HeaderBar`, `PersonaEditor`, `UserManager`, `KnowledgePanel`, `ToastContainer`) và assert 100% keys này tồn tại và không rỗng trong cả `vi.ts` và `en.ts` (MAJOR-7).
20. `src/lib/features/image-gen/templates.test.ts`: Test kiểm tra toàn bộ 18 templates trong `IMAGE_TEMPLATES`, kiểm tra song ngữ `en`/`vi` của `name` và `description`, kiểm tra valid styles và flags, assert ID của 6 phần tử đầu tiên là `["anime", "cinematic", "clay", "neon", "headshot", "watercolor"]`.
21. `src/lib/features/image-gen/stylePrompts.test.ts`: Test kiểm tra 18 styles trong `STYLE_PROMPTS` (gồm `art-nouveau`), kiểm tra `getStyleInstruction` (happy path và edge cases), kiểm tra chéo mọi `template.style` đều tồn tại trong `STYLE_PROMPTS`.
22. `src/lib/features/image-gen/core/ImageGenFactory.test.ts`: Test kiểm tra `ImageGenFactory.getProvider` khởi tạo singleton providers, kiểm tra alias `"gemini-native"`, kiểm tra singleton identity, và ném lỗi khi provider không hỗ trợ.
23. `src/components/ui/IconPicker.test.tsx`: Test component `IconPicker` về semantic trigger button, nhận và áp dụng `className` trên trigger, padding `pr-14`, popover interactions, icon selection, clear action (sibling button với event stop), keyboard focus.
24. `src/app/features/sidebar/components/SidebarItem.test.tsx`: Test component `SidebarItem` về active/inactive state, onSelect, onRename, onDelete, handleDownload, focus visible ring, và lucide icons rendering qua mock `@radix-ui/react-dropdown-menu` (render inline) hoặc query trên `document.body` kích hoạt qua `pointerdown`/bàn phím (kiểm tra class thật `lucide-ellipsis-vertical`, `lucide-trash-2`, assert 0 custom svg) (MINOR-R2-2).

---

### 6. Các Bước Thực Hiện Tuần Tự (Checklist Chi Tiết)

- [ ] **Bước 1: Bổ Sung Translation Keys & Khắc Phục Type Assertion Compile Parity (I18N-01, MAJOR-1, MAJOR-2)**
  - [ ] 1.1. Cập nhật `src/lib/utils/translations/vi.ts`:
    - **Quy tắc kỹ thuật bắt buộc (MAJOR-1)**: Trước khi thêm bất kỳ key mới nào, bắt buộc kiểm tra xem key đã tồn tại trong `vi.ts` hay chưa (`'key' in vi`). Tuyệt đối không thêm key trùng lặp để tránh lỗi biên dịch `TS1117: An object literal cannot have multiple properties with the same name`.
    - **Loại bỏ khỏi danh sách thêm mới**: `newProject`, `rankChangeConfirm`, `rankChangeDesc` (đã có sẵn trong từ điển: `newProject: "Dự án mới"`, `rankChangeConfirm: "Thay đổi cấp bậc user này?"`, `rankChangeDesc: "Thay đổi này sẽ có hiệu lực ngay lập tức."`). Tái sử dụng các key hiện có.
    - Bổ sung 3 keys bị thiếu từ audit report:
      ```typescript
      language: "Ngôn ngữ",
      themes: "Giao diện",
      loadingConfigs: "Đang tải cấu hình...",
      ```
    - Bổ sung các keys mới chuẩn hóa cho toàn bộ hệ thống UI (gồm `clearIcon`, `failedUpdateUser`, `icon` - MAJOR-2):
      ```typescript
      // Icon Picker & General UI
      icon: "Biểu tượng",
      clearIcon: "Xóa biểu tượng",
      // Navigation & Sidebar
      chat: "Trò chuyện",
      imageStudio: "Image Studio",
      gallery: "Bộ sưu tập",
      noProjects: "Chưa có dự án nào",
      createProjectHint: "Tạo dự án để sắp xếp các cuộc trò chuyện của bạn",
      startChatHint: "Bắt đầu cuộc trò chuyện mới để trải nghiệm",
      gemsDesc: "Nhân vật AI tùy chỉnh với chỉ dẫn và kiến thức chuyên biệt",
      navigation: "Điều hướng",
      closeSidebar: "Đóng thanh bên",
      renameFallbackToast: "Sử dụng giao diện chính để đổi tên cuộc trò chuyện",
      deleteFallbackToast: "Sử dụng giao diện chính để xóa cuộc trò chuyện",
      // Sidebar Item Actions
      downloadComplete: "Tải xuống hoàn tất",
      downloadFailed: "Tải xuống thất bại",
      conversationOptions: "Tùy chọn cuộc hội thoại",
      optionsFor: "Tùy chọn cho",
      exportTxt: "Xuất .txt",
      downloading: "Đang tải...",
      // Theme Groups
      themeFocus: "Tập trung",
      themeGlassmorphism: "Thủy tinh mờ",
      themeRa2: "Báo động đỏ (RA2)",
      // Persona Tones
      toneDefault: "Mặc định",
      toneDefaultDesc: "Phong cách và giọng điệu chuẩn",
      toneProfessional: "Chuyên nghiệp",
      toneProfessionalDesc: "Chỉn chu và chính xác",
      toneFriendly: "Thân thiện",
      toneFriendlyDesc: "Ấm áp và cởi mở",
      toneCandid: "Thẳng thắn",
      toneCandidDesc: "Trực diện và khích lệ",
      toneQuirky: "Phá cách",
      toneQuirkyDesc: "Vui tươi và giàu tưởng tượng",
      toneEfficient: "Hiệu quả",
      toneEfficientDesc: "Súc tích và dễ hiểu",
      toneCynical: "Châm biếm",
      toneCynicalDesc: "Phê bình và hóm hỉnh",
      toneLawyer: "Luật sư",
      toneLawyerDesc: "Cố vấn pháp lý, thuật ngữ chính xác",
      // User Manager & Knowledge Panel
      failedFetchUsers: "Không thể tải danh sách người dùng",
      failedLoadUsers: "Tải người dùng thất bại",
      failedUpdateUser: "Không thể cập nhật người dùng",
      failedUpdateUsers: "Không thể cập nhật danh sách người dùng",
      userDetailAria: "Chi tiết người dùng",
      kbDeleteConfirmDesc: "Tài liệu này và tất cả các đoạn dữ liệu sẽ bị xóa vĩnh viễn.",
      ```
  - [ ] 1.2. Cập nhật `src/lib/utils/translations/en.ts` với đầy đủ các keys tương ứng (loại bỏ `newProject`, `rankChangeConfirm`, `rankChangeDesc`; thêm `clearIcon`, `failedUpdateUser`, `icon`):
    ```typescript
    // Icon Picker & General UI
    icon: "Icon",
    clearIcon: "Clear icon",
    // Navigation & Sidebar
    chat: "Chat",
    imageStudio: "Image Studio",
    gallery: "Gallery",
    noProjects: "No projects yet",
    createProjectHint: "Create a project to organize your chats",
    startChatHint: "Start a new chat to begin",
    gemsDesc: "Custom AI personas with specialized instructions and knowledge",
    navigation: "Navigation",
    closeSidebar: "Close sidebar",
    renameFallbackToast: "Use the main interface to rename conversations",
    deleteFallbackToast: "Use the main interface to delete conversations",
    // Sidebar Item Actions
    downloadComplete: "Download complete",
    downloadFailed: "Download failed",
    conversationOptions: "Conversation options",
    optionsFor: "Options for",
    exportTxt: "Export .txt",
    downloading: "Downloading...",
    // Theme Groups
    themeFocus: "Focus",
    themeGlassmorphism: "Glassmorphism",
    themeRa2: "Red Alert 2",
    // Persona Tones
    toneDefault: "Default",
    toneDefaultDesc: "Preset style and tone",
    toneProfessional: "Professional",
    toneProfessionalDesc: "Polished and precise",
    toneFriendly: "Friendly",
    toneFriendlyDesc: "Warm and chatty",
    toneCandid: "Candid",
    toneCandidDesc: "Direct and encouraging",
    toneQuirky: "Quirky",
    toneQuirkyDesc: "Playful and imaginative",
    toneEfficient: "Efficient",
    toneEfficientDesc: "Concise and plain",
    toneCynical: "Cynical",
    toneCynicalDesc: "Critical and sarcastic",
    toneLawyer: "Lawyer",
    toneLawyerDesc: "Legal advisor, precise terminology",
    // User Manager & Knowledge Panel
    failedFetchUsers: "Failed to fetch users",
    failedLoadUsers: "Failed to load users",
    failedUpdateUser: "Failed to update user",
    failedUpdateUsers: "Failed to update users",
    userDetailAria: "User detail",
    kbDeleteConfirmDesc: "This document and all its chunks will be permanently removed.",
    ```
  - [ ] 1.3. Cập nhật `src/lib/utils/translations/index.ts`:
    - Giữ nguyên cấu trúc object `export const translations = { vi, en };` cùng các re-exports cho `src/lib/utils/config.ts`.
    - Khai báo kiểu parity hai chiều bắt buộc compiler kiểm tra:
      ```typescript
      export type TranslationKey = keyof typeof en;
      type MissingInVi = Exclude<keyof typeof en, keyof typeof vi>;
      type MissingInEn = Exclude<keyof typeof vi, keyof typeof en>;
      type _AssertTranslationsParity = [MissingInVi, MissingInEn] extends [never, never]
        ? true
        : {
            error: "Compile Error: Translation keys mismatch between vi.ts and en.ts";
            missingInVi: MissingInVi;
            missingInEn: MissingInEn;
          };
      const _parityAssertion: _AssertTranslationsParity = true;
      void _parityAssertion;
      ```
    - Chạy `npm run type-check` để kiểm chứng compiler bắt lỗi chính xác nếu cố tình xóa một key.

- [ ] **Bước 2: Xóa Bỏ Prop Drilling `t` Khỏi Sidebar & Các Component Con (I18N-02, MAJOR-2)**
  - [ ] 2.1. Trong `src/app/features/sidebar/components/Sidebar.tsx`:
    - Xóa trường `t?: Record<string, string>;` khỏi interface `SidebarProps`.
    - Nhập hook `import { useLanguage } from "../../chat/hooks/useLanguage";`.
    - Gọi `const { t } = useLanguage();` ngay đầu component `Sidebar`.
    - Thay thế toàn bộ các biểu thức `t?.key || "Fallback"` thành `t("key")`. Lưu ý: Không dùng `|| "fallback"` vì `t()` trả về chuỗi key (truthy) khi thiếu key, khiến `|| "fallback"` trở thành dead code.
  - [ ] 2.2. Xóa việc truyền prop `t` ở các file cha:
    - Trong `src/app/features/chat/components/ChatApp.tsx:732`: xóa dòng `t={t},`.
    - Trong `src/app/features/gallery/components/GalleryView.tsx:50`: xóa dòng `t={g.t as unknown as Record<string, string>},`.
    - Trong `src/app/features/image-gen/components/DescribeImageView.tsx:215`: xóa dòng `t={t as unknown as Record<string, string>},`.
    - Kiểm tra `ImageGenStudio.tsx` bảo đảm không truyền `t`.

- [ ] **Bước 3: Tối Ưu Hóa Hiệu Năng & Bảo Vệ `React.memo` Trong `Sidebar.tsx` (PERF-01, MAJOR-3, MAJOR-4)**
  - [ ] 3.1. **Ngăn chặn Conditional Hook & Bọc Callbacks Bằng `useCallback` (MAJOR-3)**:
    - Tuyệt đối KHÔNG bọc `useCallback` bên trong hàm render helper `renderSidebarContent(isMobile = false)` (vì hàm này được gọi có điều kiện khi `mobileOpen` bật/tắt, vi phạm Rules of Hooks).
    - Hoist hàm điều hướng `handleNavigation` lên trực tiếp thân component `Sidebar`:
      ```typescript
      const handleNavigation = useCallback(
        (path: string, isMobile: boolean) => {
          router.push(path);
          if (isMobile) onCloseMobile?.();
        },
        [router, onCloseMobile]
      );
      ```
    - Bọc toàn bộ các hàm callback trong `Sidebar.tsx` bằng `useCallback`:

      ```typescript
      const handleSelect = useCallback(
        (id: string) => {
          (onSelectChat ?? onSelectConversation)?.(id);
          onCloseMobile?.();
        },
        [onSelectChat, onSelectConversation, onCloseMobile]
      );

      const handleNew = useCallback(() => {
        if (isCreatingChat) return;
        onNewChat?.();
        onCloseMobile?.();
      }, [isCreatingChat, onNewChat, onCloseMobile]);

      const handleOpenGems = useCallback(() => {
        openGemModal(currentId);
        onCloseMobile?.();
      }, [openGemModal, currentId, onCloseMobile]);

      const handleOpenPersonas = useCallback(() => {
        openPersonaModal(currentId);
        onCloseMobile?.();
      }, [openPersonaModal, currentId, onCloseMobile]);

      const renameFallback = useCallback(
        async (_id: string) => {
          toast.info(t("renameFallbackToast"));
        },
        [t]
      );

      const deleteFallback = useCallback(
        async (_id: string) => {
          toast.info(t("deleteFallbackToast"));
        },
        [t]
      );

      const handleRename = useCallback(
        (id: string) =>
          typeof onRenameChat === "function" ? onRenameChat(id) : renameFallback(id),
        [onRenameChat, renameFallback]
      );

      const handleDelete = useCallback(
        (id: string) => {
          const fn = onDeleteChat ?? onDeleteConversation;
          if (typeof fn === "function") {
            setDeletingId(id);
            setTimeout(() => {
              fn(id);
              setTimeout(() => setDeletingId(null), 500);
            }, 250);
          } else {
            void deleteFallback(id);
          }
        },
        [onDeleteChat, onDeleteConversation, deleteFallback]
      );
      ```

  - [ ] 3.2. Bổ sung `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho `SidebarButton` (A11Y-03).
  - [ ] 3.3. Thay thế các chuỗi hardcoded trong `Sidebar.tsx`: `"GEMs"` giữ nguyên thương hiệu nhưng tooltip dùng `t("gemsDesc")`, nhãn `t("chat")`, `t("imageStudio")`, `t("gallery")`.

- [ ] **Bước 4: Chuẩn Hóa `SidebarItem.tsx` — Thay Hand-Rolled SVG Bằng Lucide & Tăng Cường Trợ Năng (PERF-02, A11Y-03, MAJOR-5)**
  - [ ] 4.1. Xóa bỏ 4 inline SVG functions thủ công: `EllipsisVerticalIcon`, `PencilIcon`, `TrashIcon`, `DownloadIcon`.
  - [ ] 4.2. Nhập các icons chuẩn từ `lucide-react`:
    ```typescript
    import { MoreVertical, Pencil, Trash2, Download, Loader2 } from "lucide-react";
    ```
    _(Lưu ý về tên class sinh ra bởi `lucide-react@0.562`: `MoreVertical` render `<svg class="lucide lucide-ellipsis-vertical">`, `Trash2` render `<svg class="lucide lucide-trash-2 lucide-trash2">`, `Loader2` render `<svg class="lucide lucide-loader-circle">`)_.
  - [ ] 4.3. Nhập và sử dụng hook `const { t } = useLanguage();`.
  - [ ] 4.4. Thay thế các chuỗi văn bản hardcoded:
    - `"Download complete"` ➔ `t("downloadComplete")`
    - `"Download failed"` ➔ `t("downloadFailed")`
    - `c.title ? "Options for ..." : "Conversation options"` ➔ `c.title ? `${t("optionsFor")} ${c.title}` : t("conversationOptions")`
    - `"Rename"` ➔ `t("rename")`
    - `isDownloading ? "Downloading..." : "Export .txt"` ➔ `isDownloading ? t("downloading") : t("exportTxt")`
    - `"Delete"` ➔ `t("delete")`
  - [ ] 4.5. Bổ sung focus visible ring:
    - Thẻ `<button>` chính của SidebarItem: thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none`.
    - Thẻ `<button>` trigger của dropdown 3 chấm: thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none`.

- [ ] **Bước 5: Tái Cấu Trúc Trợ Năng Cho `IconPicker.tsx` (A11Y-02, MAJOR-2, MINOR-2, MINOR-3)**
  - [ ] 5.1. Nhập hook `useLanguage` từ `@/app/features/chat/hooks/useLanguage` và gọi `const { t } = useLanguage();`.
  - [ ] 5.2. Loại bỏ `<div role="combobox">` bọc `<button>`.
  - [ ] 5.3. Chuyển thành cấu trúc semantic đạt chuẩn W3C WCAG 4.1.2:

    ```tsx
    <div className={cn("relative flex items-center w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={value ? `${t("icon")}: ${value}` : t("selectIcon")}
            className={cn(
              "w-full h-[38px] px-3 flex items-center justify-between gap-2 rounded-md",
              "bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--border)",
              "text-(--text-primary) text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
              "disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer",
              value && "pr-14" // Thêm padding-right để nhãn icon không bị nút Clear đè lên
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {value ? (
                <DynamicIcon name={value} className="w-5 h-5 text-(--text-primary)" />
              ) : (
                <Sparkles className="w-4 h-4 text-(--text-secondary)" />
              )}
              <span className="truncate text-xs text-(--text-secondary)">
                {value ? value : t("selectIcon")}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ChevronDown className="w-3.5 h-3.5 text-(--text-secondary)" />
            </div>
          </button>
        </PopoverTrigger>

        {/* Nút Clear Icon đặt ngoài trigger button, là button anh em (sibling) độc lập */}
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSelect("");
              setOpen(false);
            }}
            className="absolute right-8 p-1 rounded hover:bg-(--control-bg-hover) text-(--text-secondary) hover:text-(--danger) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            title={t("clearIcon")}
            aria-label={t("clearIcon")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <PopoverContent
          className="w-72 max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))] p-3 bg-(--surface-elevated) border-(--border) shadow-xl rounded-xl z-(--z-popover) max-h-80 overflow-y-auto custom-scrollbar"
          align="start"
          sideOffset={6}
        >
          ...
        </PopoverContent>
      </Popover>
    </div>
    ```

  - [ ] 5.4. Bổ sung `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)` cho tất cả các nút icon trong grid `LUCIDE_ICONS` và `EMOJI_ICONS`.

- [ ] **Bước 6: Bổ Sung Focus Rings & Bản Địa Hóa Cho Các Component Còn Lại (A11Y-03, i18n, MINOR-9)**
  - [ ] 6.1. `ProjectNode.tsx`:
    - Bổ sung `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho các nút: Chevron toggle, Project Name select, New Chat, Radix Dropdown Trigger, và Chat items.
  - [ ] 6.2. `ToastContainer.tsx`:
    - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-md` cho nút `<button onClick={() => onRemove(toast.id)}>`.
  - [ ] 6.3. `CreateProjectModal.tsx`:
    - Thêm `aria-label={t("close")}` và `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho nút đóng modal (`<button onClick={onClose}>`).
  - [ ] 6.4. `HeaderBar.tsx` (MINOR-9):
    - Thay thế `"Theme"` hardcoded bằng `t("theme")`.
    - Nhóm theme: hiển thị nhãn localized `t("themeFocus")`, `t("themeGlassmorphism")`, `t("themeRa2")` dựa vào `group`.
    - Thay thế lớp cũ Tailwind v3 `outline-none focus:ring-2 focus:ring-(--accent) focus:ring-opacity-50` bằng lớp chuẩn: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)`.
  - [ ] 6.5. `KnowledgePanel.tsx`:
    - Thay thế `title="Refresh"` bằng `title={t("refresh")}`.
    - Sửa các chuỗi bản dịch: `t("kbDeleteConfirm")`, `t("kbDeleteConfirmDesc")`, `t("uploadFailed")`, `t("deleteFailed")`.
    - Thay thế dead Tailwind classes: `border-border` ➔ `border-(--border)`, `bg-muted` ➔ `bg-(--control-bg)`, `text-muted-foreground` ➔ `text-(--text-secondary)`, `bg-destructive` ➔ `bg-(--danger)`, `bg-primary` ➔ `bg-(--accent)`.
    - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho các nút Refresh, Delete, Upload label.
  - [ ] 6.6. `PersonaEditor.tsx`:
    - Chuyển `TONE_OPTIONS` thành hàm tạo dữ liệu động với `t`:
      ```typescript
      const getToneOptions = (t: (key: string) => string) => [
        { value: "default", label: t("toneDefault"), description: t("toneDefaultDesc") },
        { value: "professional", label: t("toneProfessional"), description: t("toneProfessionalDesc") },
        ...
      ];
      ```
    - Thay thế raw class `bg-white text-black` tại nút Save bằng `bg-(--accent) text-(--accent-foreground) hover:opacity-90`.
    - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho các tone buttons.
  - [ ] 6.7. `UserManager.tsx` (MAJOR-2):
    - Thay thế các chuỗi thông báo lỗi tiếng Anh bằng `t("failedFetchUsers")`, `t("failedLoadUsers")`, `t("failedUpdateUser")`, `t("failedUpdateUsers")`.
    - Thay thế `aria-label="User detail"` bằng `aria-label={t("userDetailAria")}`.
    - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` cho checkbox toggle và các action buttons.

- [ ] **Bước 7: Viết Bộ Test Co-located & Cập Nhật Test Suite (MAJOR-5, MAJOR-6, MINOR-7)**
  - [ ] 7.1. Tạo mới `src/lib/utils/translations/index.test.ts`:
    - Kiểm tra `vi` và `en` có chính xác 100% keys trùng nhau.
    - Kiểm tra không có key nào bị undefined, null hoặc chuỗi rỗng `""`.
    - Kiểm tra các keys cốt lõi: `language`, `themes`, `loadingConfigs`, `clearIcon`, `failedUpdateUser`, `icon`, `chat`, `imageStudio`, `gallery`.
    - Kiểm tra bảo toàn các exports `TranslationSet`, `Translations`, `TranslationKey`.
  - [ ] 7.2. Tạo mới `src/lib/features/image-gen/templates.test.ts` (MINOR-7):
    - Kiểm tra `IMAGE_TEMPLATES` là mảng có đúng 18 phần tử.
    - Kiểm tra mỗi template có đầy đủ `id`, `name.en`, `name.vi`, `prompt`, `description.en`, `description.vi`, `previewUrl`, `requiresPhoto`, `style`.
    - Kiểm tra chính xác ID của 6 templates hiển thị mặc định đầu tiên: `expect(IMAGE_TEMPLATES.slice(0, 6).map(t => t.id)).toEqual(["anime", "cinematic", "clay", "neon", "headshot", "watercolor"])`.
  - [ ] 7.3. Tạo mới `src/lib/features/image-gen/stylePrompts.test.ts` (MAJOR-5, MAJOR-6):
    - Kiểm tra `STYLE_PROMPTS` chứa đầy đủ **18 styles** (`photorealistic`, `anime`, `digital-art`, `cinematic`, `3d-render`, `watercolor`, `oil-painting`, `sketch-pencil`, `pop-art`, `minimalist`, `surrealist`, `pixel-art`, `isometric`, `low-poly`, `steampunk`, `cyberpunk`, `fantasy-art`, `art-nouveau`).
    - Kiểm tra mỗi style có trường `instruction` độ dài > 50 ký tự và `shortAppend` không rỗng.
    - Kiểm tra hàm xuất khẩu `getStyleInstruction(styleId)`:
      - Happy path: `getStyleInstruction("cinematic")` trả về đúng config của cinematic.
      - Edge cases: `getStyleInstruction("none")`, `getStyleInstruction("")`, và `getStyleInstruction("unknown-style")` đều trả về `undefined`.
    - Kiểm tra tính nhất quán chéo (cross-consistency): Duyệt qua toàn bộ 18 templates trong `IMAGE_TEMPLATES`, khẳng định mọi `template.style` đều tồn tại trong `STYLE_PROMPTS` (`expect(STYLE_PROMPTS[template.style]).toBeDefined()`).
  - [ ] 7.4. Tạo mới `src/lib/features/image-gen/core/ImageGenFactory.test.ts` (MAJOR-6):
    - Test `ImageGenFactory.getProvider("gemini")` trả về instance của `GeminiNativeImageProvider`.
    - Test `ImageGenFactory.getProvider("gemini-native")` trả về instance của `GeminiNativeImageProvider`.
    - Test Singleton Identity: `expect(ImageGenFactory.getProvider("gemini")).toBe(ImageGenFactory.getProvider("gemini"))` (cùng tham chiếu bộ nhớ).
    - Test `ImageGenFactory.getProvider("replicate")` trả về instance của `ReplicateImageProvider`.
    - Test `ImageGenFactory.getProvider("openai")` trả về instance của `OpenAIImageProvider`.
    - Test ném Exception khi truyền provider ID không hợp lệ: `expect(() => ImageGenFactory.getProvider("unsupported")).toThrow("Image Provider 'unsupported' not supported")`.
  - [ ] 7.5. Tạo mới `src/components/ui/IconPicker.test.tsx`:
    - Test trigger hiển thị đúng `t("selectIcon")` khi chưa chọn icon.
    - Test trigger hiển thị đúng tên icon và có class `pr-14` khi có `value="Sparkles"`.
    - Test nút trigger có semantic `<button type="button">`, `aria-haspopup="dialog"`, `aria-label="Biểu tượng: Sparkles"` (khi ngôn ngữ là vi).
    - Test nút Clear icon là sibling button: click nút Clear gọi `onSelect("")`, ngăn chặn bubbling (`stopPropagation`, `preventDefault`).
    - Test thuộc tính `disabled` ngăn chặn kích hoạt popover và áp dụng proper aria.
  - [ ] 7.6. Tạo mới `src/app/features/sidebar/components/SidebarItem.test.tsx` (MAJOR-5):
    - Test render đúng tiêu đề cuộc trò chuyện.
    - Test click vào nút chính gọi `onSelect(id)`.
    - Test hiển thị class active `sidebar-accent-active` khi `isActive={true}`.
    - Test click vào nút 3 chấm mở Dropdown menu với các lựa chọn Rename, Export, Delete.
    - Test các nút có class `focus-visible:ring-(--ring)`.
    - Test icon classes từ `lucide-react`: Kiểm tra các phần tử `<svg>` chứa class `lucide-ellipsis-vertical`, `lucide-trash-2`, `lucide-pencil`, `lucide-download`.
    - Khẳng định chống gaming: Assert số lượng inline `<svg>` không chứa class `lucide` bằng 0 (`container.querySelectorAll("svg:not(.lucide)").length === 0`).
  - [ ] 7.7. Cập nhật `src/app/features/sidebar/components/Sidebar.test.tsx` (MAJOR-4, MAJOR-5):
    - Test render độc lập không cần prop `t`.
    - Test Reference Stability (TC-PERF-01): Mock `./SidebarItem` bằng spy component ghi nhận các props nhận được. Re-render `Sidebar` với các props không liên quan thay đổi (ví dụ: đổi session dummy nhưng giữ nguyên danh sách hội thoại) -> Assert các hàm `onSelect`, `onRename`, `onDelete` truyền vào `SidebarItem` giữ nguyên tham chiếu tuyệt đối (`expect(props2.onSelect).toBe(props1.onSelect)`).
    - Test đối chứng nghịch đảo (Counter-factual Case): Rerender `Sidebar` với prop callback thay đổi (ví dụ truyền `onSelectConversation` mới) -> Assert tham chiếu truyền vào `SidebarItem` phải thay đổi (`expect(props3.onSelect).not.toBe(props1.onSelect)`).
    - Quản lý cách ly trạng thái: Trong `beforeEach`/`afterEach`, thiết lập và reset store ngôn ngữ: `useLanguageStore.setState({ language: "en" })`.
  - [ ] 7.8. Cập nhật `src/app/features/layout/HeaderBar.test.tsx`:
    - Cập nhật mock và assertion kiểm tra nhãn "Theme" được lấy qua hook `useLanguage()`.
    - Assert không còn bất kỳ phần tử nào chứa class cũ `focus:ring-opacity-50`.

- [ ] **Bước 8: Chạy Verification Toàn Diện**
  - [ ] 8.1. Chạy `npm run type-check` (0 errors).
  - [ ] 8.2. Chạy `npm run lint` (0 errors, 0 warnings).
  - [ ] 8.3. Chạy `npm run test:run` (100% pass trên toàn bộ test suite).
  - [ ] 8.4. Chạy `npm run verify` để chốt chặn toàn diện.

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc - MAJOR-5, MAJOR-6)

| Mã ID          | Phân Hệ / Module    | Hành Vi Được Kiểm Thử (Expected Behavior)                                                                                                                | Dữ Liệu Đầu Vào (Inputs)                                                                                                 | Kết Quả Mong Đợi (Expected Output)                                                                                                                                                                                                                   | Tiêu Chí Thất Bại (Failure Modes & Gaming Prevention)                                                                                                                       |
| :------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-I18N-01** | Translations Core   | 100% key parity giữa `vi.ts` và `en.ts`, bảo toàn exports `TranslationKey`, `TranslationSet`, `Translations`.                                            | Object `vi` và `en` từ `src/lib/utils/translations/`                                                                     | `Object.keys(vi).sort()` bằng chính xác `Object.keys(en).sort()`. Không có key nào giá trị rỗng `""`.                                                                                                                                                | Thất bại nếu `vi` thiếu bất kỳ key nào từ `en` (đặc biệt `language`, `themes`, `loadingConfigs`, `clearIcon`, `failedUpdateUser`, `icon`) hoặc giá trị là chuỗi trắng `""`. |
| **TC-I18N-02** | Sidebar Component   | `Sidebar` không nhận prop `t`; tự động đọc bản dịch từ `useLanguage()`; cách ly trạng thái giữa các tests.                                               | Render `<Sidebar chats={[...]} />` không truyền prop `t`. Set `useLanguageStore.setState({ language: "vi" })`.           | Hiển thị đúng chuỗi đã dịch ("Trò chuyện", "Cuộc trò chuyện mới" theo `vi.ts` thật, không mock `t`). Reset về `"en"` trong `afterEach`.                                                                                                              | Thất bại nếu `Sidebar` yêu cầu prop `t`, hiển thị key thô, hiển thị fallback dead code tiếng Anh, hoặc rò rỉ ngôn ngữ sang test khác.                                       |
| **TC-I18N-03** | PersonaEditor       | Nhãn và mô tả của 8 phong cách Persona (`TONE_OPTIONS`) được dịch động theo ngôn ngữ hiện tại.                                                           | Set `useLanguageStore.setState({ language: "vi" })` hoặc `"en"`.                                                         | "Chuyên nghiệp" / "Chỉn chu và chính xác" khi vi; "Professional" / "Polished and precise" khi en. Reset store trong `afterEach`.                                                                                                                     | Thất bại nếu hiển thị chuỗi tiếng Anh cố định khi `language === "vi"`, hoặc mock hàm `t` giả tạo thay vì đọc từ ngữ cảnh thực tế.                                           |
| **TC-A11Y-01** | IconPicker          | Trigger là `<button type="button">` semantic đạt chuẩn W3C; nút Clear là sibling độc lập; có padding `pr-14`.                                            | Render `<IconPicker value="Sparkles" />`                                                                                 | Thẻ trigger là `<button type="button">` có `aria-haspopup="dialog"`, `aria-label="Biểu tượng: Sparkles"` và class `pr-14`. Nút Clear là sibling button có `stopPropagation` và `preventDefault`.                                                     | Thất bại nếu trigger là thẻ `<div>` có `role="combobox"`, chứa thẻ `<button>` con lồng bên trong, thiếu `pr-14` khiến text bị che, hoặc click nút Clear làm mở Popover.     |
| **TC-A11Y-02** | Interactive A11y    | Toàn bộ interactive elements có visible focus ring `focus-visible:ring-2 focus-visible:ring-(--ring)`.                                                   | Render `Sidebar`, `SidebarItem`, `ProjectNode`, `ToastContainer`, `HeaderBar`.                                           | Các thẻ button đều có class `focus-visible:ring-(--ring)` và `focus-visible:outline-none`. Không còn class v3 `focus:ring-opacity-50`.                                                                                                               | Thất bại nếu thiếu focus-visible ring trên bất kỳ nút tương tác chính nào, hoặc còn sót lại class quy ước cũ `focus:ring-opacity-50`.                                       |
| **TC-PERF-01** | Sidebar Memo        | Callback props truyền vào `SidebarItem` giữ nguyên tham chiếu giữa các lần re-render nếu callback prop của cha không đổi; có test case nghịch đối chứng. | Rerender `Sidebar` qua spy component của `SidebarItem`: (Case 1) đổi session dummy; (Case 2) đổi `onSelectConversation`. | Case 1: `props2.onSelect === props1.onSelect` (`toBe`). Case 2: `props3.onSelect !== props1.onSelect` (`not.toBe`).                                                                                                                                  | Thất bại nếu tạo mới function instance làm vỡ shallow equality của `React.memo(SidebarItem)`, hoặc test case đối chứng thất bại (chứng tỏ test bị tautological).            |
| **TC-PERF-02** | SidebarItem Icons   | `SidebarItem` sử dụng 100% icon từ `lucide-react`, không dùng inline hand-rolled SVG; kiểm tra class thật.                                               | Render `SidebarItem`                                                                                                     | DOM chứa icon Lucide với class thật: `lucide-ellipsis-vertical`, `lucide-trash-2`, `lucide-pencil`, `lucide-download`. Số lượng SVG không có class `lucide` bằng 0.                                                                                  | Thất bại nếu phát hiện inline `<svg>` tự vẽ không thông qua thư viện `lucide-react`, hoặc dùng sai class phỏng đoán (như `lucide-more-vertical`).                           |
| **TC-IMG-01**  | Image Gen Templates | Toàn bộ 18 templates trong `IMAGE_TEMPLATES` tuân thủ đúng schema song ngữ; kiểm tra ID 6 templates đầu tiên.                                            | `IMAGE_TEMPLATES` array                                                                                                  | `length === 18`, mỗi phần tử có song ngữ `name.en`/`vi` và `description.en`/`vi`. 6 templates đầu tiên có ID chính xác: `["anime", "cinematic", "clay", "neon", "headshot", "watercolor"]`.                                                          | Thất bại nếu thiếu template, thiếu bản dịch tiếng Việt, hoặc sai thứ tự ID của 6 templates hiển thị mặc định ban đầu.                                                       |
| **TC-IMG-02**  | Image Gen Styles    | `STYLE_PROMPTS` định nghĩa đầy đủ 18 styles; kiểm tra `getStyleInstruction`; kiểm tra chéo không có orphan styles.                                       | `STYLE_PROMPTS` object và mảng `IMAGE_TEMPLATES`.                                                                        | Chứa đủ 18 styles (gồm `art-nouveau`), `instruction.length > 50`, `shortAppend.length > 0`. `getStyleInstruction` trả về đúng config cho id hợp lệ, trả về `undefined` cho `"none"`, `""`, id lạ. Mọi `template.style` đều có trong `STYLE_PROMPTS`. | Thất bại nếu thiếu bất kỳ style nào (đặc biệt `art-nouveau`), `getStyleInstruction` xử lý sai edge cases, hoặc phát hiện orphan style từ templates.                         |
| **TC-IMG-03**  | Image Gen Factory   | `ImageGenFactory.getProvider` hỗ trợ alias `"gemini-native"`, duy trì singleton identity, và ném lỗi có kiểm soát khi sai ID.                            | ID: `"gemini"`, `"gemini-native"`, `"replicate"`, `"openai"`, `"invalid"`.                                               | `"gemini"` và `"gemini-native"` cùng trả về `GeminiNativeImageProvider`. `getProvider("gemini") === getProvider("gemini")` (`toBe`). Ném Error `"Image Provider 'invalid' not supported"`.                                                           | Thất bại nếu không hỗ trợ alias `"gemini-native"`, tạo instance mới thay vì singleton cache, hoặc không ném lỗi khi gặp ID lạ.                                              |

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 8.1. Danh Sách File Test Co-located (_.test.ts, _.test.tsx):

- `src/lib/utils/translations/index.test.ts` (Co-located bên cạnh `index.ts`):
  - Test 100% key parity giữa `vi` và `en`.
  - Test không có giá trị rỗng trong cả hai từ điển.
  - Test xuất đúng `translations.vi`, `translations.en`, và các type exports `TranslationKey`, `TranslationSet`, `Translations`.
- `src/lib/features/image-gen/templates.test.ts` (Co-located bên cạnh `templates.ts`):
  - Test danh sách 18 templates, kiểm tra các trường bắt buộc và định dạng song ngữ.
  - Test khẳng định chính xác ID của 6 templates hiển thị mặc định: `["anime", "cinematic", "clay", "neon", "headshot", "watercolor"]`.
- `src/lib/features/image-gen/stylePrompts.test.ts` (Co-located bên cạnh `stylePrompts.ts`):
  - Test danh sách 18 styles (bao gồm `art-nouveau`), kiểm tra độ dài và chất lượng của prompt system instructions.
  - Test hàm `getStyleInstruction` với happy path (`"cinematic"`) và edge cases (`"none"`, `""`, id lạ).
  - Test chéo tính nhất quán: khẳng định mọi `template.style` trong `IMAGE_TEMPLATES` đều có cấu hình hợp lệ trong `STYLE_PROMPTS`.
- `src/lib/features/image-gen/core/ImageGenFactory.test.ts` (Co-located bên cạnh `ImageGenFactory.ts`):
  - Test khởi tạo provider Gemini Native (với cả 2 ID `"gemini"` và alias `"gemini-native"`), Replicate, OpenAI.
  - Test Singleton Identity: `expect(ImageGenFactory.getProvider("gemini")).toBe(ImageGenFactory.getProvider("gemini"))`.
  - Test kịch bản lỗi khi truyền provider ID không hợp lệ: ném `Error("Image Provider '...' not supported")`.
- `src/components/ui/IconPicker.test.tsx` (Co-located bên cạnh `IconPicker.tsx`):
  - Test semantic button trigger, padding `pr-14` khi có value, mở Popover, chọn icon, trạng thái disabled, và ARIA attributes.
  - Test nút Clear icon là button sibling độc lập: click gọi `onSelect("")`, ngăn chặn bubbling (`stopPropagation`, `preventDefault`).
- `src/app/features/sidebar/components/SidebarItem.test.tsx` (Co-located bên cạnh `SidebarItem.tsx`):
  - Test render title, trạng thái active/deleting, gọi callback `onSelect`, mở Dropdown Rename/Delete/Export.
  - Test class name thật của `lucide-react@0.562`: `lucide-ellipsis-vertical`, `lucide-trash-2`, `lucide-loader-circle`, `lucide-pencil`, `lucide-download`.
  - Assert số lượng inline `<svg>` không chứa class `lucide` bằng 0.
- `src/app/features/sidebar/components/Sidebar.test.tsx` (Co-located bên cạnh `Sidebar.tsx`):
  - Cập nhật test suite xác thực `Sidebar` hoạt động độc lập không cần prop `t`.
  - Test Reference Stability (TC-PERF-01) qua spy component của `SidebarItem`: test case thuận (prop không liên quan đổi -> callbacks giữ nguyên `toBe`) và test case nghịch đối chứng (thay đổi `onSelectConversation` -> callback đổi `not.toBe`).
  - Thiết lập và reset store ngôn ngữ `useLanguageStore` trong `beforeEach`/`afterEach`.
- `src/app/features/layout/HeaderBar.test.tsx` (Co-located bên cạnh `HeaderBar.tsx`):
  - Cập nhật test suite xác thực nhãn "Theme" được lấy qua hook `useLanguage()`.
  - Assert không còn bất kỳ phần tử nào chứa class cũ `focus:ring-opacity-50`.

#### 8.2. Lệnh Chạy Kiểm Thử & Kiểm Soát Chất Lượng (Verification Commands):

Thực thi theo quy chuẩn tại Windows Terminal (PowerShell 5.1 - `.agents/rules/02-quality.md`):

1. **Kiểm tra kiểu dữ liệu (Tier 1)**:
   ```powershell
   npm run type-check
   ```
2. **Kiểm tra linter (Tier 2)**:
   ```powershell
   npm run lint
   ```
3. **Chạy toàn bộ unit & integration tests (Tier 2)**:
   ```powershell
   npm run test:run
   ```
4. **Cổng kiểm soát chất lượng tích hợp (Full Verification Gate)**:
   ```powershell
   npm run verify
   ```

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Technical Controls - MAJOR-4, MINOR-4)

| STT | Rủi Ro Kỹ Thuật Tiềm Ẩn                                                                            | Mức Độ      | Nguyên Nhân Kỹ Thuật                                                                                                           | Phương Án Phòng Ngừa & Technical Control Trong Code                                                                                                                                                                                                                   |
| :-- | :------------------------------------------------------------------------------------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Trùng key hoặc lệch translation keys giữa `vi.ts` và `en.ts` khi thêm keys mới (MAJOR-1)**       | `[BLOCKER]` | Khai báo lại key đã có (`newProject`, `rankChangeConfirm`, `rankChangeDesc`) gây lỗi `TS1117`, hoặc thêm lệch key giữa 2 file. | Technical Control: Quy tắc kiểm tra key chưa tồn tại trước khi thêm; compiler `TS1117` và biểu thức type assertion hai chiều trong `index.ts` kết hợp `index.test.ts` sẽ làm fail `tsc` và `vitest` ngay lập tức nếu trùng hoặc lệch dù chỉ 1 key.                    |
| 2   | **Vỡ vòng lặp re-render hoặc conditional hook crash trong `Sidebar` (MAJOR-3, MAJOR-4)**           | `[MAJOR]`   | Bọc `useCallback` trong render helper function có điều kiện (`renderSidebarContent`), hoặc sai dependency array.               | Technical Control: Hoist `handleNavigation` lên thân component; ghi nhận `eslint.config.mjs` chưa nạp `react-hooks`; sử dụng test hành vi reference stability (TC-PERF-01) với cả case thuận (`toBe`) lẫn case nghịch đối chứng (`not.toBe`) để kiểm soát chất lượng. |
| 3   | **Nút Clear icon trong `IconPicker.tsx` kích hoạt mở Popover ngoài ý muốn hoặc đè text (MINOR-3)** | `[MAJOR]`   | Do PopoverTrigger bắt event bubbling từ các phần tử con, và vị trí absolute che mất label text.                                | Technical Control: Thêm lớp `pr-14` cho nút trigger khi có `value`; tách nút Clear thành button độc lập (sibling) bên ngoài `PopoverTrigger`, gọi đồng thời `e.stopPropagation()` và `e.preventDefault()`.                                                            |
| 4   | **Xóa prop `t` gây lỗi type error tại các component cha gọi `<Sidebar>` (MINOR-4)**                | `[MAJOR]`   | Cha vẫn truyền `t={...}` trong khi `SidebarProps` đã gỡ bỏ trường `t`.                                                         | Technical Control: Dùng Grep tool quét `<Sidebar` và loại bỏ prop `t` tại tất cả 3 điểm gọi (`ChatApp`, `GalleryView`, `DescribeImageView`). Trình biên dịch `tsc` (excess JSX property check) là chốt chặn tự động.                                                  |
| 5   | **Dead classes trong `KnowledgePanel.tsx` và `HeaderBar.tsx` trên Tailwind CSS v4 (MINOR-9)**      | `[MINOR]`   | Sử dụng các class quy ước v3 như `bg-primary`, `border-border`, `focus:ring-opacity-50`.                                       | Technical Control: Thay thế 100% bằng arbitrary token classes `bg-(--accent)`, `border-(--border)`, `focus-visible:ring-2 focus-visible:ring-(--ring)`.                                                                                                               |
| 6   | **Ghi đè làm mất 30 file chưa commit của Phase 3 trong working tree**                              | `[BLOCKER]` | Executor dùng `git checkout`, `git reset`, hoặc ghi đè toàn bộ file thay vì áp dụng diff cục bộ.                               | Technical Control: Cảnh báo bắt buộc tại Mục 2 Pre-Work; Executor chỉ áp dụng sửa đổi cục bộ (targeted diff) trên các file chung (`Sidebar.tsx`, `HeaderBar.tsx`, `vi.ts`, `en.ts`), kiểm tra `git status` trước và sau mỗi bước.                                     |

---

## Audit History

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-11
- **Đối tượng**: Technical Plan — Revision 1
- **Ghi chú**: Mục `### Audit Run 1` trước đó chỉ là placeholder chưa được thẩm định, nên đây là lần thẩm định đầu tiên và được ghi trực tiếp vào Run 1 (cùng tiền lệ với `2026-10-10-audit-remediation-phase-3-theming-mobile-gallery.md:425`).
- **Baseline working tree**: Có 30 file đang sửa dở chưa commit thuộc Phase 3 (drawer gesture `Sidebar.tsx:36,566-575`, `closeImageDetails` trong `vi.ts`/`en.ts`, theme CSS…). Plan Phase 4 chạm cùng các file `Sidebar.tsx`, `Sidebar.test.tsx`, `HeaderBar.tsx`, `HeaderBar.test.tsx`, `vi.ts`, `en.ts` → executor phải giữ nguyên các thay đổi Phase 3 khi chỉnh sửa.

#### Kiểm chứng lỗi cũ

N/A — đây là lần thẩm định đầu tiên.

#### Xác minh các khẳng định cốt lõi của plan

| Khẳng định trong plan                                                                                                    | Kết quả                        | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :----------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vi.ts` thiếu đúng 3 key `language`, `themes`, `loadingConfigs`                                                          | ĐÚNG                           | `[CMD]` `npx tsx` probe trên `vi`/`en` thực tế → `missingInVi [ 'language', 'themes', 'loadingConfigs' ] missingInEn []` (vi 817 key / en 820 key, không có giá trị rỗng).                                                                                                                                                                                                                                                  |
| Assertion parity hiện tại trong `translations/index.ts` vô hiệu vì widen sang `Record<string,string>`                    | ĐÚNG                           | `[SRC]` `src/lib/utils/translations/index.ts:5,12-17` (`TranslationKey = string`, `translations: TranslationSet`). `[CMD]` Probe tái hiện cấu trúc hiện tại với vi/en thật → `tsc --strict` **exit 0** dù vi thiếu 3 key.                                                                                                                                                                                                   |
| Assertion mới (Bước 1.3) bắt được lệch key                                                                               | ĐÚNG                           | `[CMD]` Probe dùng nguyên văn đoạn code Bước 1.3 với vi/en thật → `error TS2322: Type 'boolean' is not assignable to type '{ error: "mismatch"; missingInVi: MissingInVi; ... }'` (exit 2).                                                                                                                                                                                                                                 |
| Đổi `TranslationKey` thành `keyof typeof en` không làm vỡ consumer                                                       | ĐÚNG                           | `[CMD]` Grep: consumer duy nhất là `src/lib/config/theme-config.ts:8` (`labelKey: TranslationKey`); probe xác nhận 16/16 `labelKey` đều có trong `en`. `useLanguage.ts:16-28` nhận `key: string` nên không bị ảnh hưởng.                                                                                                                                                                                                    |
| Line numbers `ChatApp.tsx:732`, `GalleryView.tsx:50`, `DescribeImageView.tsx:215`; `ImageGenStudio.tsx` không truyền `t` | ĐÚNG                           | `[CMD]` Grep `t={` khớp đúng 3 vị trí; `ImageGenStudio.tsx:141-160` không có `t`. Ghi chú: `GalleryView`/`DescribeImageView` hiện truyền hàm `t` ép kiểu thành `Record` → `t?.key` luôn `undefined` → Sidebar luôn hiển thị fallback tiếng Anh ở 2 trang này. Plan sửa đúng gốc lỗi.                                                                                                                                        |
| `ImageGenFactory` test được không cần env/network                                                                        | ĐÚNG                           | `[SRC]` Constructor các provider là lazy; API key chỉ đọc trong `generate()` (`OpenAIImageProvider.ts:10-20`, `ReplicateImageProvider.ts:16-22`, `GeminiNativeImageProvider.ts:24-26`). Error message khớp `ImageGenFactory.ts:26`.                                                                                                                                                                                         |
| `IMAGE_TEMPLATES` có 18 phần tử                                                                                          | ĐÚNG                           | `[CMD]` `npx tsx` → `templates 18`, mọi `template.style` đều tồn tại trong `STYLE_PROMPTS` (`orphan styles []`).                                                                                                                                                                                                                                                                                                            |
| `STYLE_PROMPTS` có **17** styles                                                                                         | **SAI**                        | `[CMD]` `npx tsx` → `styles 18` — thiếu `art-nouveau` trong danh sách của plan (`stylePrompts.ts:~100`).                                                                                                                                                                                                                                                                                                                    |
| TC-PERF-02: DOM có class `lucide-more-vertical`                                                                          | **SAI**                        | `[CMD]` `renderToStaticMarkup` với `lucide-react@0.562.0` đã cài: `MoreVertical → class="lucide lucide-ellipsis-vertical"`, `Trash2 → lucide-trash2 lucide-trash-2`, `Loader2 → lucide-loader-circle`.                                                                                                                                                                                                                      |
| Control Risk #2: "Chạy linter `react-hooks/exhaustive-deps`"                                                             | **SAI — rule không được wire** | `[CMD]` `npx eslint --print-config src/app/features/sidebar/components/Sidebar.tsx` → không có bất kỳ rule `react-hooks/*` nào (chỉ `no-console`, `no-explicit-any`…). `[CMD]` Negative probe: code gọi `useCallback` trong hàm lồng, deps rỗng, qua `--stdin --stdin-filename .../Sidebar.tsx` → **exit 0**. `eslint-plugin-react-hooks@^7.0.1` có trong `package.json:96` nhưng không được nạp trong `eslint.config.mjs`. |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                                     | Kết quả           | Bằng chứng & Phân tích                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :------------------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**                   | **FAIL**          | `[CMD]` Baseline `npm run type-check` → exit 0. `package.json` không có Prisma/Better Auth; plan không thêm dependency, không thêm env var. **Nhưng**: Bước 1.1/1.2 thêm lại `newProject`, `rankChangeConfirm`, `rankChangeDesc` — 3 key này **đã tồn tại** trong cả `vi.ts` và `en.ts` (`[CMD]` probe runtime: `proposed-but-exists vi/en: ['newProject','rankChangeConfirm','rankChangeDesc']`). Object literal trùng key → `[CMD]` probe `tsc` trả `TS1117: An object literal cannot have multiple properties with the same name` → `type-check` vỡ ngay Bước 1. Ngoài ra giá trị mới (`"Change user rank?"`) khác giá trị hiện có (`"Change this user's rank?"`) → nếu executor "sửa" bằng cách xóa bản cũ sẽ thay đổi copy đang dùng.                                                                                                                                                                                                                          |
| **S2: Lifecycle, Teardown & Test Isolation** | PASS (có ghi chú) | Không có SSE/EventSource/AudioContext mới. `[SRC]` `ImageGenFactory.ts:7` dùng `private static providers` cache dùng chung giữa các test case → test phải khẳng định singleton (`getProvider("gemini") === getProvider("gemini")`) và không phụ thuộc thứ tự. `[SRC]` `languageStore.ts:9-12` là Zustand store global, default `"en"` → test TC-I18N-02/TC-I18N-03 đổi sang `"vi"` bắt buộc reset store trong `beforeEach`/`afterEach`, nếu không sẽ rò state sang test khác. `[SRC]` `Sidebar.tsx:254-258` `setTimeout` lồng không cleanup (có sẵn, ngoài phạm vi) → test `handleDelete` cần `vi.useFakeTimers()`. Plan chưa nêu cơ chế test TC-PERF-01 (xem MAJOR-5).                                                                                                                                                                                                                                                                                             |
| **S3: Database & Temporal Logic**            | N/A               | Không chạm Supabase, migration, RLS hay dữ liệu thời gian.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **S4: Cross-Task State Flow**                | **FAIL**          | `[ADV]` timeline bên dưới — mục tiêu PERF-01 (dòng 28) yêu cầu bọc `handleNavigation` bằng `useCallback`, nhưng `[SRC]` `Sidebar.tsx:265-271` khai báo `handleNavigation` **bên trong** render function `renderSidebarContent`, được gọi vô điều kiện ở `:534` và **có điều kiện** ở `:603` (trong `{mobileOpen && …}` tại `:546`). Không có lint `rules-of-hooks` để chặn (đã chứng minh ở trên). Ngoài ra `[SRC]` `Sidebar.tsx:403-423`: `ProjectNode` vẫn nhận 3 inline arrow (`onSelect`, `onSelectConversation`, `onNewChat`) — plan không đề cập, nên mục tiêu "bảo toàn memo" chỉ đạt một phần (MINOR). `[SRC]` `ChatApp.tsx:724-745` các callback đã memoized nên `useCallback` trong Sidebar có tác dụng thực ở trang chat; ở `GalleryView.tsx:41-51`, `DescribeImageView.tsx:206-216`, `ImageGenStudio.tsx:141-160` cha truyền inline arrow (`onCloseMobile={() => …}`) nên deps vẫn đổi mỗi render (chấp nhận được vì các trang này không stream token). |
| **S5: Security Boundary**                    | PASS              | `[CMD]` Không có API route, không đổi auth/RLS/rate-limit. `UserManager.tsx` chỉ đổi chuỗi hiển thị phía client. Không có import `supabase.server.ts` mới.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **S6: External Resilience**                  | N/A / PASS        | Không gọi AI provider mới. `[SRC]` Test `ImageGenFactory` chỉ khởi tạo instance (constructor lazy) → không phát sinh network call trong CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Adversarial Timeline (S4 — conditional hook):**

```
Cơ chế: useCallback cho handleNavigation đặt trong renderSidebarContent (theo Goal PERF-01 dòng 28)
T1: Render đầu (desktop, mobileOpen=false) → renderSidebarContent() gọi 1 lần ở :534 → N hooks
T2: Người dùng mở drawer mobile → mobileOpen=true → renderSidebarContent(true) được gọi thêm ở :603 → N+1 hooks
T3: React so thứ tự hook giữa 2 lần render
Kết cục: "Rendered more hooks than during the previous render" → Sidebar crash, ErrorBoundary nuốt cả trang → LỖI (MAJOR). ESLint không chặn vì react-hooks plugin chưa wire.
```

**Adversarial Timeline (Domain i18n — key không tồn tại):**

```
Cơ chế: t(key) fallback chain tại useLanguage.ts:20-28 (dict → en → vi → String(key))
T1: IconPicker render aria-label={t("clearIcon") || "Clear icon"} (Bước 5.2)
T2: "clearIcon" không có trong vi/en (đã xác minh [CMD]) → t trả về chuỗi "clearIcon" (truthy)
T3: Toán tử || không bao giờ rơi xuống fallback
Kết cục: Screen reader đọc "clearIcon"; tương tự UserManager hiển thị "failedUpdateUser" → LỖI (MAJOR, vi phạm Rule 04 & WCAG 4.1.2 Name)
```

#### Phân loại lỗi

**[MAJOR]**

1. **MAJOR-1 — Trùng key gây vỡ build (S1).** Bước 1.1 và 1.2 thêm lại `newProject`, `rankChangeConfirm`, `rankChangeDesc` đã có sẵn → `TS1117`. **Yêu cầu**: loại 3 key này khỏi danh sách thêm mới (tái sử dụng key hiện có), và bổ sung bước kiểm tra "key đề xuất chưa tồn tại" trước khi thêm.
2. **MAJOR-2 — Plan tham chiếu key không tồn tại và không bổ sung.** `t("clearIcon")` (Bước 5.2) và `t("failedUpdateUser")` (Bước 6.7; đang dùng sai sẵn tại `UserManager.tsx:143`) không có trong `vi`/`en`. Vì `t()` trả về chính key khi thiếu (`useLanguage.ts:27`), pattern `t("x") || "Fallback"` là dead code → UI/aria hiển thị key thô. **Yêu cầu**: thêm `clearIcon`, `failedUpdateUser` vào cả `vi.ts`/`en.ts`; nêu rõ trong plan rằng fallback `|| "…"` không có tác dụng và không được dùng làm lưới an toàn. Lưu ý thêm `Icon: ${value}` (Bước 5.2) là chuỗi hardcoded mới → dùng key có tham số hoặc ghép `t("icon")`.
3. **MAJOR-3 — `handleNavigation` + `useCallback` gây conditional hook (S4).** Goal PERF-01 (dòng 28) liệt kê `handleNavigation`, mâu thuẫn với Bước 3.1 (không có). **Yêu cầu**: ghi rõ `handleNavigation` **không** được bọc `useCallback` tại chỗ; nếu muốn ổn định thì hoist lên thân `Sidebar` dạng `useCallback((path: string, isMobile: boolean) => …, [router, onCloseMobile])`. Đồng bộ lại Goal với Bước 3.1.
4. **MAJOR-4 — Technical control của Risk #2 không tồn tại (Evidence-bar 4.5.3/4.5.4).** `react-hooks/exhaustive-deps` và `rules-of-hooks` **không** được wire (đã chứng minh bằng `--print-config` + negative probe exit 0). **Yêu cầu** chọn một trong hai: (a) thêm plugin `eslint-plugin-react-hooks` (đã cài) vào `eslint.config.mjs` kèm bước Verification chứa negative probe (vd. `useCallback` trong hàm lồng → phải exit ≠ 0 với `react-hooks/rules-of-hooks`) và đánh giá số lỗi mới phát sinh trên toàn codebase; hoặc (b) thay control bằng test hành vi TC-PERF-01 (xem MAJOR-5) + ghi rõ không có lint gate cho hooks.
5. **MAJOR-5 — Test Contract dựa trên dữ kiện sai / thiếu cơ chế chống gaming.**
   - TC-IMG-02 & Bước 7.3: `STYLE_PROMPTS` có **18** styles (thiếu `art-nouveau`), không phải 17. Assertion `length === 17` sẽ fail hoặc dụ executor xóa style để "pass".
   - TC-PERF-02: class đúng là `lucide-ellipsis-vertical` / `lucide-trash-2` / `lucide-loader-circle`, không phải `lucide-more-vertical`. Nên assert theo `svg.lucide-ellipsis-vertical` hoặc tốt hơn: assert số lượng `<svg>` không có class `lucide` bằng 0.
   - TC-PERF-01: chưa nêu cơ chế đo. **Yêu cầu**: mock `./SidebarItem` bằng spy component ghi nhận props qua các lần `rerender` với prop không liên quan (vd. `collapsed` không đổi, `session` mới) và assert `onSelect/onRename/onDelete` giữ nguyên reference (`toBe`), đồng thời có một case ngược (đổi `onSelectConversation`) assert reference **thay đổi** để tránh test tautological.
   - TC-I18N-02/03: phải set ngôn ngữ qua `useLanguageStore.setState({ language: "vi" })` và reset trong `afterEach`; assert chuỗi lấy từ `vi.ts` thật, không mock `t`.
6. **MAJOR-6 — Thiếu test cho exported function trong `lib/features` (Rule 01 Testing).** `[SRC]` `stylePrompts.ts:113` export `getStyleInstruction` (trả `undefined` cho `"none"`, `""`, id lạ). **Yêu cầu**: bổ sung happy path + error/edge case vào `stylePrompts.test.ts`; khuyến nghị thêm test chéo "mọi `IMAGE_TEMPLATES[i].style` tồn tại trong `STYLE_PROMPTS`" (hiện đang đúng — `[CMD]` orphan `[]`) và test alias `"gemini-native"` + singleton identity cho `ImageGenFactory`.

**[MINOR]**

1. Còn chuỗi hardcoded chưa nằm trong phạm vi dù Goal ghi "toàn bộ": `Sidebar.tsx` (`aria-label="Main navigation"`, `"GEMs"` tại `:310`, mô tả tooltip `:312` — key `gemsDesc` đã được thêm nhưng Bước 2 không ghi thay thế), `ProjectNode.tsx:104,171` (`"Collapse project"`, `"Expand project"`, `"Conversation options"`), `ToastContainer.tsx:14,57`, `IconPicker.tsx:145,173` (`"Icons"`, `"Emojis"`). Liệt kê rõ hoặc ghi chú hoãn sang phase sau.
2. Plan không nêu `IconPicker.tsx` cần `import { useLanguage } from "@/app/features/chat/hooks/useLanguage"`. `components/ui` → `app/features` là hướng import ngược tầng, nhưng đã có tiền lệ (`src/components/ui/confirm-dialog.tsx:15`) nên chấp nhận; cần ghi rõ trong Bước 5.
3. Nút Clear `absolute right-8` đè lên vùng text của trigger → thêm `pr-14` (hoặc tương đương) cho trigger khi có `value` để label không bị che. `aria-haspopup`/`aria-expanded` đã được Radix `PopoverTrigger` tự gán — khai báo thủ công là thừa nhưng vô hại. Risk #3 nói gọi `e.preventDefault()` nhưng snippet chỉ có `stopPropagation` — đồng bộ lại.
4. Risk #4 dùng `git grep` — mâu thuẫn `00-core.md` ("NEVER run git commands directly"). Thay bằng Grep tool; control thực sự là `tsc` (excess property trên JSX props).
5. Bảng Verified Versions: cột "Mới nhất (2026)" (vd. `lucide-react 1.55.0`, `Next.js 16.4.0`) không kèm `[URL]` — không ảnh hưởng triển khai vì plan không nâng version, nhưng nên ghi "chưa xác minh" hoặc bỏ cột.
6. `Sidebar.tsx` đã 623 dòng (vượt hard max 500 cho UI component); plan thêm code vào. Không yêu cầu tách trong phase này (tránh refactor ngoài phạm vi) nhưng nên ghi nhận nợ kỹ thuật.
7. Bước 7.2 "Kiểm tra 6 featured templates đầu tiên hiển thị đúng danh mục" — `ImageTemplate` (`templates.ts:4-12`) không có trường category/featured → tiêu chí không kiểm được; viết lại thành assert cụ thể (vd. id của 6 phần tử đầu) hoặc bỏ.
8. Giữ `TranslationSet`/`Translations` export trong `index.ts` và re-export ở `src/lib/utils/config.ts:4-12` — plan cần nói rõ giữ nguyên để không vỡ re-export.
9. `HeaderBar.tsx:57` còn `focus:ring-opacity-50` (class v3 không tồn tại trong Tailwind 4) — khi thêm `focus-visible:ring-*` nên thay luôn.

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 6 lỗi `[MAJOR]` (1 lỗi làm vỡ `type-check` ngay Bước 1, 1 lỗi gây crash runtime nếu làm theo Goal, 1 technical control không tồn tại, và Test Contract dựa trên dữ kiện sai). Không có `[BLOCKER]` về kiến trúc/bảo mật.

**Việc cần làm cho Revision 2:**

1. Loại `newProject`, `rankChangeConfirm`, `rankChangeDesc` khỏi danh sách key mới; thêm `clearIcon`, `failedUpdateUser` (và key thay thế cho `Icon: ${value}`) vào cả `vi.ts`/`en.ts`.
2. Đồng bộ Goal PERF-01 với Bước 3.1; cấm `useCallback` bên trong `renderSidebarContent`, hoặc hoist `handleNavigation` lên thân component.
3. Chọn và mô tả control thật cho Risk #2 (wire `eslint-plugin-react-hooks` + negative probe, hoặc test reference-stability có case đối chứng).
4. Sửa TC-IMG-02/Bước 7.3 thành 18 styles (thêm `art-nouveau`); sửa TC-PERF-02 theo class name thật của lucide 0.562; mô tả cơ chế test TC-PERF-01 và reset `useLanguageStore` cho TC-I18N-02/03.
5. Bổ sung test `getStyleInstruction` (happy + `"none"`/`""`/id lạ), alias `gemini-native`, singleton identity, và test chéo template-style.
6. (Khuyến nghị) Xử lý các mục `[MINOR]` 1–4.

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-11
- **Đối tượng**: Technical Plan — Revision 2
- **Baseline**: `[CMD]` `npm run type-check` → exit 0. Working tree vẫn còn các thay đổi Phase 3 chưa commit (token `--ring` tại `src/app/styles/themes/_shared/base.css:103`, `--accent-foreground` `:93`, `--danger` `:96` mà plan dựa vào đều đang tồn tại trong working tree).

#### Kiểm chứng lỗi cũ (Audit Run 1)

| Lỗi Run 1                                                                                             | Trạng thái                          | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                         |
| :---------------------------------------------------------------------------------------------------- | :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-1 — Trùng key `newProject`/`rankChangeConfirm`/`rankChangeDesc`                                 | **ĐÃ SỬA**                          | `[CMD]` `npx tsx` probe toàn bộ 47 key đề xuất ở Bước 1.1/1.2 so với `vi`/`en` thật → `proposed already in vi: []`; ở `en` chỉ trùng `language`/`themes`/`loadingConfigs` — đúng ý đồ (snippet `en` Bước 1.2 không thêm lại 3 key này). Không còn nguy cơ `TS1117`.                                                                                                                                |
| MAJOR-2 — Key `clearIcon`, `failedUpdateUser`, `icon` không tồn tại; fallback `\|\| "…"` là dead code | **ĐÃ SỬA (một phần — xem MAJOR-7)** | Ba key đã được thêm vào cả hai file; ghi chú dead-code khớp `[SRC]` `useLanguage.ts:20-28`. Tuy nhiên Bước 2.1 áp dụng chuyển đổi cơ học `t?.key \|\| "…"` → `t("key")` cho một key không tồn tại (xem MAJOR-7).                                                                                                                                                                                   |
| MAJOR-3 — `useCallback` trong `renderSidebarContent` gây conditional hook                             | **ĐÃ SỬA**                          | Goal, Mục 3.3 và Bước 3.1 thống nhất: hoist `handleNavigation(path, isMobile)` lên thân `Sidebar`. `[SRC]` `Sidebar.tsx:162-266` không có early return trước vị trí các hook → thứ tự hook ổn định.                                                                                                                                                                                                |
| MAJOR-4 — Control Risk #2 không tồn tại                                                               | **ĐÃ SỬA**                          | Chọn phương án (b): ghi rõ `react-hooks/*` chưa wire, control = TC-PERF-01 có case đối chứng `not.toBe`. Đạt 4.5.3/4.5.4.                                                                                                                                                                                                                                                                          |
| MAJOR-5 — Test Contract sai dữ kiện                                                                   | **ĐÃ SỬA**                          | `[CMD]` probe: `STYLE_PROMPTS` 18 key (gồm `art-nouveau`), `IMAGE_TEMPLATES.length === 18`, `slice(0,6)` = `['anime','cinematic','clay','neon','headshot','watercolor']`, mọi style có `instruction.length > 50` và `shortAppend` (`bad styles []`). Class Lucide đã đúng theo Run 1. TC-PERF-01 đã mô tả spy + case đối chứng; TC-I18N-02/03 đã reset `useLanguageStore`.                         |
| MAJOR-6 — Thiếu test `getStyleInstruction`, alias, singleton                                          | **ĐÃ SỬA**                          | `[SRC]` `stylePrompts.ts:113-116`; `[CMD]` probe: `getStyleInstruction("cinematic")` → `object`, `"none"`/`""`/`"zzz"` → `undefined` — khớp Bước 7.3.                                                                                                                                                                                                                                              |
| MINOR 2–9                                                                                             | ĐÃ SỬA                              | Import `useLanguage` cho IconPicker ghi rõ; `pr-14` + `preventDefault` đồng bộ; Risk #4 dùng Grep tool; bỏ cột version chưa xác minh; ghi nhận nợ kỹ thuật 623 dòng; tiêu chí 6 template cụ thể; giữ type exports; thay `focus:ring-opacity-50`.                                                                                                                                                   |
| MINOR 1 (chuỗi hardcoded còn sót)                                                                     | CHƯA SỬA HẾT                        | Vẫn ngoài phạm vi: `ProjectNode.tsx` (`"Collapse project"`, `"Expand project"`, `"Conversation options"`), `ToastContainer.tsx`, `IconPicker.tsx` (`"Icons"`, `"Emojis"`), `Sidebar.tsx` `aria-label="Main navigation"` (key `navigation` được thêm nhưng không có bước thay thế), `label={isCollapsed ? "Expand" : "Collapse"}` (key `expand`/`collapse` đã có sẵn). Không chặn — xem MINOR-R2-1. |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                                     | Kết quả           | Bằng chứng & Phân tích                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :------------------------------------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   | **FAIL**          | `[CMD]` Baseline `type-check` exit 0; không thêm dependency/env, không Prisma/Better Auth. `[CMD]` Probe nguyên văn assertion Bước 1.3 + mô phỏng consumer `useLanguage.ts:16` (`translations?.[language] … as Record<string,string>`) với `vi`/`en` thật (`as const`) → chỉ báo đúng 1 lỗi parity mong đợi (vi đang thiếu 3 key); consumer không vỡ khi `translations` chuyển sang kiểu hẹp. **Nhưng**: `[CMD]` probe nguyên văn snippet `getToneOptions` Bước 6.6 với `setTone: (v: PersonaTone) => void` (`[SRC]` `PersonaEditor.tsx:41` `useState<PersonaTone>`) → `error TS2345: Argument of type 'string' is not assignable to parameter of type 'PersonaTone'` (exit 2). Snippet bỏ mất annotation `{ value: PersonaTone; … }[]` đang có ở `PersonaEditor.tsx:17` → `npm run type-check` vỡ ở Bước 6.6 (MAJOR-8).                                                                                                                                                                      |
| **S2: Lifecycle, Teardown & Test Isolation** | PASS (có ghi chú) | Không có SSE/EventSource mới. Reset `useLanguageStore` trong `beforeEach/afterEach` đã có ở 7.7/TC-I18N-02/03. `ImageGenFactory` static cache → test singleton không phụ thuộc thứ tự (đã nêu). `[SRC]` Tiền lệ test trong repo mock toàn bộ `@radix-ui/react-dropdown-menu` (`ProjectNode.test.tsx:31`, `HeaderBar.test.tsx`); plan 7.6 dùng `container.querySelectorAll("svg:not(.lucide)")` — nếu không mock, nội dung `DropdownMenu.Portal` (`SidebarItem.tsx:160`) render vào `document.body`, ngoài `container` → check chống gaming bỏ sót 3 icon Pencil/Download/Trash (MINOR-R2-2).                                                                                                                                                                                                                                                                                                                                                                                                  |
| **S3: Database & Temporal Logic**            | N/A               | Không chạm Supabase/migration/RLS/thời gian.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **S4: Cross-Task State Flow**                | **FAIL**          | `[SRC]` `Sidebar.tsx:451-460` `SidebarItem` nhận trực tiếp `handleSelect/handleRename/handleDelete` → spy `vi.mock("./SidebarItem")` cho TC-PERF-01 khả thi; deps Bước 3.1 đúng (đổi `onSelectConversation` → `handleSelect` đổi → case đối chứng hợp lệ). `[SRC]` `Sidebar.test.tsx:63-74` mock `useGemStore` trả `{ openManager }` → `openGemModal` là `undefined` ổn định, không phá `useCallback`. **Nhưng** `[ADV]` timeline bên dưới: `[SRC]` `Sidebar.tsx:498` `label={t?.adminManagement \|\| "Admin Management"}`; `[CMD]` probe → `adminManagement` **undefined** trong cả `en` và `vi` (Grep toàn `src/` chỉ khớp đúng dòng này). Bước 2.1 yêu cầu chuyển cơ học thành `t("adminManagement")` và cấm fallback → nút Admin hiển thị key thô (MAJOR-7). Ghi chú: hoist `handleNavigation` không ổn định props của `SidebarButton` vì call site vẫn là inline arrow `onClick={() => handleNavigation("/")}` (`Sidebar.tsx:276`) — không sai, chỉ không có tác dụng memo (MINOR-R2-3). |
| **S5: Security Boundary**                    | PASS              | `[SRC]` Không có API route/auth/RLS/rate-limit mới; `UserManager.tsx:75,80,137,208` chỉ đổi chuỗi phía client; thông điệp lỗi server (`json?.error?.message`) vẫn được ưu tiên như cũ. Không import `*.server.ts` vào client.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **S6: External Resilience**                  | N/A / PASS        | Không gọi AI provider; test `ImageGenFactory` chỉ khởi tạo instance lazy (đã xác minh Run 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Adversarial Timeline (Domain i18n — key bị tham chiếu nhưng không tồn tại):**

```
Cơ chế: Bước 2.1 — chuyển `t?.adminManagement || "Admin Management"` thành `t("adminManagement")` (cấm fallback)
T1: Admin đăng nhập, Sidebar render footer (Sidebar.tsx:498)
T2: t("adminManagement") → dict[key] undefined → en[key] undefined → vi[key] undefined → String(key) (useLanguage.ts:20-28)
T3: Parity compile-time (Bước 1.3) PASS vì key thiếu ở CẢ HAI file; index.test.ts parity PASS; tsc PASS vì t nhận `key: string`
Kết cục: Nút hiển thị "adminManagement" ở cả vi/en — không control nào bắt được → LỖI (MAJOR, vi phạm Rule 04)
```

#### Phân loại lỗi

**[MAJOR]**

7. **MAJOR-7 — Key `adminManagement` không tồn tại nhưng bị chuyển cơ học sang `t()` (Bước 2.1).** Quy tắc "kiểm tra key tồn tại" của plan chỉ áp dụng cho key _thêm mới_, không cho key _được tham chiếu_; parity hai chiều không bắt được key thiếu đồng thời ở cả hai file. **Yêu cầu**: (a) thêm `adminManagement` vào cả `vi.ts`/`en.ts` (hoặc dùng lại `adminDashboard` có sẵn tại `en.ts:181`); (b) bổ sung vào Bước 2.1/Bước 8 một bước kiểm chứng: mọi literal `t("…")` trong các file được sửa phải tồn tại trong `en` (probe `npx tsx`, hoặc test trong `index.test.ts` duyệt danh sách key mà Sidebar/SidebarItem/IconPicker/HeaderBar/PersonaEditor/UserManager/KnowledgePanel dùng). Ghi rõ thêm: `t?.signOut || t?.logout || "Sign Out"` → `t("signOut")`.
8. **MAJOR-8 — Snippet `getToneOptions` (Bước 6.6) làm vỡ `type-check`.** Đã chứng minh `[CMD]` TS2345. **Yêu cầu**: khai báo kiểu trả về `(t: (key: string) => string): { value: PersonaTone; label: string; description: string }[] => [...]` (hoặc `as const` trên `value`), và gọi trong thân component, ví dụ `useMemo(() => getToneOptions(t), [t])`.

**[MINOR]**

- **MINOR-R2-1** — Chuỗi hardcoded còn sót (MINOR 1 của Run 1, liệt kê ở bảng trên): bổ sung bước thay thế (key `expand`/`collapse`/`navigation` đã có hoặc đã được thêm), hoặc ghi rõ hoãn sang phase sau và hạ câu "Quét và thay thế toàn bộ" ở Goal 1 cho khớp phạm vi.
- **MINOR-R2-2** — `SidebarItem.test.tsx` (7.6/TC-PERF-02): nêu rõ chiến lược mở dropdown — theo tiền lệ mock `@radix-ui/react-dropdown-menu` (render content inline), hoặc dùng `baseElement`/`document.body` cho assertion `svg:not(.lucide)` thay vì `container`; Radix DropdownMenu mở bằng `pointerdown`/bàn phím, không phải `click`.
- **MINOR-R2-3** — `handleNavigation` hoist bằng `useCallback` không ổn định tham chiếu vì call site vẫn bọc inline arrow; `ProjectNode` vẫn nhận 3 inline arrow (`Sidebar.tsx:408-420`). Chấp nhận cho phase này (mục tiêu chính là `SidebarItem`), nhưng nên ghi rõ trong Goal để tránh kỳ vọng sai.
- **MINOR-R2-4** — HeaderBar theme group: `ThemeGroup = "Glassmorphism" | "Focus" | "Red Alert 2"` (`theme-config.ts:4`). Nên chỉ định mapping tường minh `Record<ThemeGroup, TranslationKey>` (`Focus → themeFocus`, `Glassmorphism → themeGlassmorphism`, `"Red Alert 2" → themeRa2`) để compiler bắt thiếu nhóm; đồng thời cập nhật dictionary mock trong `HeaderBar.test.tsx:80-95` (mock trả key thô khi thiếu).
- **MINOR-R2-5** — Snippet IconPicker (5.3) chuyển `className` từ trigger sang wrapper `div` — thay đổi hành vi với caller có truyền `className`; nên ghi chú hoặc giữ `className` trên trigger. `aria-haspopup`/`aria-expanded` thủ công là thừa (`[SRC]` `node_modules/@radix-ui/react-popover/dist/index.mjs:90-91` đã tự gán) nhưng vô hại.

#### Kết luận

**[CHANGES_REQUESTED]** — Toàn bộ 6 lỗi `[MAJOR]` của Run 1 đã được khắc phục và kiểm chứng bằng probe. Revision 2 phát sinh 2 lỗi `[MAJOR]` mới, đều xác minh bằng `[CMD]`/`[SRC]`: một key được tham chiếu nhưng không tồn tại mà không control nào bắt được (MAJOR-7), và một snippet làm vỡ `type-check` (MAJOR-8). Không có `[BLOCKER]`.

**Việc cần làm cho Revision 3:**

1. Thêm `adminManagement` (hoặc chuyển sang `adminDashboard`) và bổ sung bước/test kiểm chứng mọi key `t("…")` được tham chiếu trong các file sửa đều tồn tại trong `en`/`vi`.
2. Sửa snippet `getToneOptions` giữ kiểu `value: PersonaTone`.
3. (Khuyến nghị) Xử lý MINOR-R2-1 … R2-5.
