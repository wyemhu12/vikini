# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 1: Design Token Ngữ Nghĩa & Rút 16 Theme Còn 5 Theme (Sáng/Tối)

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-08
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

**Mục tiêu** (nguồn yêu cầu đã được PM duyệt: `docs/specs/2026-11-08-vikini-3-redesign-brief.md`, mục "Design tokens", "Migration of the 16 legacy theme ids", "Suggested phasing" bước 1):

1. **Token ngữ nghĩa**: định nghĩa 11 token của brief (`--bg`, `--surface`, `--raised`, `--line`, `--text`, `--muted`, `--faint`, `--accent`, `--on-accent`, `--soft`, `--glow`) cho **5 theme × 2 mode = 10 bộ** (`hoanghon`, `muc`, `reu`, `sen`, `than` × `dark`/`light`) trong `src/app/styles/themes/`, thay 16 file theme cũ (thư mục `focus/`, `glassmorphism/`, `ra2/`).
2. **Theme config + migrate**: viết lại `src/lib/config/theme-config.ts` theo mô hình _family × mode_, có hàm thuần `resolveThemeKey()` chuyển 16 id cũ sang id mới đúng bảng migrate của brief; tự động ghi đè lựa chọn đã lưu của người dùng (localStorage key `theme` của `next-themes`) **không nháy giao diện** ở lần tải đầu.
3. **Chế độ sáng/tối**: người dùng chọn 1 trong 5 theme + 1 trong 2 mode (HeaderBar desktop/mobile, menu theme của Novelcrafter/Prompt Studio, Command Palette).
4. **Sửa tương phản C4**: thay `bg-(--accent) text-white` bằng `text-(--on-accent)` tại `src/app/error.tsx:36`, `src/app/not-found.tsx:18`, `src/app/features/chat/components/InputForm.tsx:289`, `src/app/features/chat/components/FileLightbox.tsx:352,370` — và ca cùng lỗi phát hiện thêm khi khảo sát tại `src/components/features/projects/CreateProjectModal.tsx:181`.
5. **Bản dịch vi/en** cho tên 5 theme mới + nhãn chế độ; xóa key của 16 theme cũ và 3 nhóm theme.
6. **Tương thích ngược**: giữ toàn bộ tên biến CSS cũ mà component đang dùng (`--surface-muted`, `--surface-elevated`, `--control-*`, `--border`, `--text-primary`, `--text-secondary`, `--accent-foreground`, `--primary*`, `--bg-glow`, `--surface-strong`) dưới dạng **alias** trỏ về token mới, để **không phải sửa ~1.390 lượt dùng token / 743 class màu** trong 140 file ở giai đoạn này.

**Out of Scope (What We're NOT Doing)**:

- AppShell / icon rail / thay `FloatingMenuTrigger` (Giai đoạn 2).
- Chat, composer, model picker, vệt sáng `--glow` sau composer (Giai đoạn 3) — giai đoạn này chỉ _định nghĩa_ `--glow`.
- Ảnh (Giai đoạn 4), Novelcrafter (Giai đoạn 5) — chỉ thay vòng lặp menu theme bằng component dùng chung vì API `THEME_CONFIG` bị thay đổi (bắt buộc để compile), không đổi layout.
- Không đổi font (Be Vietnam Pro / Newsreader / JetBrains Mono) và thang chữ 12–32 → dời sang Giai đoạn 2 vì đụng `src/app/layout.tsx` + `next/font` (xem §Lộ trình).
- Không codemod 743 class màu thô / không thêm lint guard cấm màu thô (Giai đoạn 6, H4/H5).
- Không sửa tương phản của `--danger` + `text-white` (`#ef4444` vs `#fff` ≈ 3,76:1) — ngoài phạm vi C4, ghi nhận cho Giai đoạn 6.
- Không thêm cột DB / API lưu theme: khảo sát xác nhận theme **chỉ** lưu ở localStorage (xem Assumption A2).
- Không bật `enableSystem` (theo hệ điều hành) — xem `[NEEDS_PRODUCT_DECISION]` D1.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                        | Nội dung rút ra                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                         | Tech stack bất biến, cấm `any`/`console.log`, co-located test, cấm git mutating                                        |
| `.agents/rules/01-coding.md`                       | Giới hạn kích thước file/hàm, co-located test, hằng số `UPPER_SNAKE_CASE`                                              |
| `.agents/rules/02-quality.md`                      | Pre-Work triggers (UI → `03-ui.md`, i18n → add-translation), Test Failure Triage Loại A/B/C, PowerShell dùng `;`       |
| `.agents/rules/03-ui.md`                           | Bảng token hiện hành (dòng 21–29) và mục Theme Integration (dòng 81–85) sẽ trở nên lỗi thời → phải cập nhật living doc |
| `.agents/rules/05-plan-review.md`                  | Cấu trúc plan, Critic Pass khi chạm `.agents/**`                                                                       |
| `.agents/agents/reviewer/evidence-bar.md`          | §4.5.3 Negative Probe, §4.5.4 Risk Table Audit                                                                         |
| `scripts/verify-plan.mjs`                          | 7 heading bắt buộc, kiểm `file:line`, `CRITIC_REQUIRED` khi chạm `.agents/`                                            |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md` | Bảng token, mã màu, bảng migrate, phasing                                                                              |
| `docs/architecture.md:64-76`                       | Mục Design System mô tả từ vựng token cũ → cập nhật                                                                    |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                                          | Lý do nạp                                                                               | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/skills/add-translation/SKILL.md`                   | Thêm/xóa key UI trong `vi.ts`/`en.ts`                                                   | Thêm 8 key mới vào **cả hai** file cùng lúc; mọi chỗ hiển thị dùng `useLanguage()` + `t("key")`; chạy `npm run type-check` để bắt lệch key (parity check của `index.ts`) |
| `.agents/skills/vikini-investigate/SKILL.md` (blast-radius) | Đổi API của module dùng chung `src/lib/config/theme-config.ts`                          | Liệt kê đủ 7 caller (§3 A5) trước khi đổi export; xóa `THEME_CONFIG`/`ThemeGroup`/`ThemeTone` chỉ sau khi mọi caller đã chuyển                                           |
| `.agents/skills/vikini-simplify/SKILL.md`                   | Gỡ code chết của 16 theme (RA2 emblem, nhóm theme, rule `data-theme-tone` không ai gán) | Xóa `ChatThemeBackground.tsx` + 3 ảnh RA2; xóa khối CSS `:root[data-theme-tone=…]` vô hiệu; gộp 4 vòng lặp menu theme trùng lặp thành 1 component                        |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Theme được áp bằng `next-themes` `attribute="class"`, map id → class `theme-<id>` qua prop `value`, `defaultTheme="blueprint"`, `enableSystem={false}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `[SRC]` `src/app/features/layout/providers.tsx:12-18,22-28`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A2  | Lựa chọn theme **chỉ** lưu ở localStorage key mặc định `theme` của `next-themes` (không có `storageKey` tùy chỉnh, không có cột DB/API)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `[SRC]` `src/app/features/layout/providers.tsx:22-28` (không truyền `storageKey`); `[CMD]` Grep `theme` (không phân biệt hoa thường) trong `supabase/` → 0 file; Grep `localStorage.(get\|set)Item("theme` trong repo → 0 kết quả                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A3  | `next-themes@0.4.6`: script chặn render chạy **trước hydrate**, đọc `localStorage.getItem(storageKey)`, rồi `classList.add(value[name] ?? name)` — tức **một id cũ có mặt trong map `value` sẽ được áp class mới ngay ở first paint**; khi chạy runtime `classList.remove(...Object.values(value))` rồi add class mới; `setTheme(x)` ghi `localStorage.setItem(storageKey, x)`; `enableColorScheme` chỉ set `style.colorScheme` khi tên theme là `"light"`/`"dark"` (không áp dụng cho id của ta)                                                                                                                                                                                                                                                                                                                   | `[SRC]` `node_modules/next-themes/dist/index.mjs` dòng 1 (đọc tại bản cài của checkout chính `C:\Users\wyemh\vikini\node_modules\next-themes`, version `0.4.6` theo `package.json` của gói) — hàm `M` (script) và callback `S`/`f` trong `V`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A4  | Rule `:root[data-theme-tone="light"]` / `:root[data-theme-tone="dark"]` là **code chết**: không nơi nào gán thuộc tính `data-theme-tone`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `[SRC]` `src/app/styles/themes/_shared/base.css:143-169`; `[CMD]` Grep `themeTone\|data-theme-tone\|theme-tone` trong `src/` → chỉ khớp chính `base.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A5  | Caller của `theme-config.ts` (blast radius): `providers.tsx`, `HeaderBar.tsx`, `useTheme.ts`, `NovelcrafterTopBar.tsx`, `PromptStudioApp.tsx`, test `theme-config.test.ts`, mock trong `HeaderBar.test.tsx`. **Caller của `useTheme.ts` (Revision 2)**: `HeaderBar.tsx`, `NovelcrafterTopBar.tsx`, `PromptStudioApp.tsx`, `CommandPalette.tsx` (dùng `theme`, `setTheme`, `toggleTheme`) và 5 caller chỉ đọc `theme` hoặc gọi suông: `ChatApp.tsx`, `GalleryView.tsx`, `ImageGenStudio.tsx`, `DescribeImageView.tsx`, `NovelcrafterStudioApp.tsx`; mock trong `GalleryView.test.tsx`                                                                                                                                                                                                                                | `[SRC]` `src/app/features/chat/components/CommandPalette.tsx:36`, `src/app/features/chat/components/ChatApp.tsx:55`, `src/app/features/gallery/components/GalleryView.tsx:36`, `src/app/features/image-gen/components/ImageGenStudio.tsx:35`, `src/app/features/image-gen/components/DescribeImageView.tsx:28`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:48`, `src/app/features/gallery/components/GalleryView.test.tsx:69-72`, `src/app/features/layout/providers.tsx:8`, `src/app/features/layout/components/HeaderBar.tsx:9`, `src/app/features/chat/hooks/useTheme.ts:3`, `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:44`, `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:17`, `src/app/features/layout/HeaderBar.test.tsx:48-53` |
| A6  | Theme CSS cũ **chỉ** chứa 1 khối token `.theme-<id> { … }`, không có selector con phụ thuộc theme                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `[CMD]` Grep selector cấp đỉnh trong `src/app/styles/themes/` (trừ `_shared`) → đúng 16 khối, ví dụ `src/app/styles/themes/glassmorphism/sunset.css:5-81`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| A7  | **Xung đột tên `--surface`**: hệ cũ dùng `--surface` = nền trang (canvas, `src/app/styles/themes/_shared/base.css:78,178`), brief dùng `--surface` = panel. Plan theo brief: `--surface` mang nghĩa _panel_; mọi chỗ cần _nền trang_ chuyển sang `--bg`: `body` (`src/app/styles/themes/_shared/base.css:177-181`), class `.bg-surface` (`src/app/styles/themes/_shared/tokens.css:7-10`, dùng ở `src/app/layout.tsx:32` và `src/app/features/chat/components/ChatApp.tsx:235`), `.static-depth-bg` (`src/app/styles/themes/_shared/utilities.css:6-10`), shadcn `--color-background` (`src/app/styles/themes/_shared/base.css:10`). ~80 chỗ `bg-(--surface)` trong 51 file `.tsx` (`[CMD]` Grep count) đa số là modal/card → nhận màu panel là đúng ngữ nghĩa mới; chênh lệch thị giác nhỏ (`#0C0A09` → `#151110`) | `[SRC]` như trên; `[CMD]` Grep `--surface[)\]]` → 80 lượt / 51 file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| A8  | Quy ước sẵn có cho chữ trên nền accent là `text-(--accent-foreground)` (đã có test khẳng định)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `[SRC]` `src/app/features/chat/components/InputForm.test.tsx:103-112`, `src/components/ui/error-boundary.test.tsx:51-53`, `src/app/features/gallery/components/GalleryView.test.tsx:116-122`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A9  | Worktree hiện **không có** `node_modules` (chỉ checkout chính có) → trước khi chạy kiểm thử phải cài phụ thuộc trong worktree                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `[CMD]` Glob `node_modules/next-themes/dist/*` tại worktree → 0 file; tại `C:\Users\wyemh\vikini\node_modules\next-themes\dist` → 4 file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Cross-Task Dependencies**: Giai đoạn 2–6 (xem §Lộ trình) đều phụ thuộc bộ token này; Giai đoạn 6 sẽ gỡ alias cũ sau khi codemod xong 743 class màu.

**Quyết định sản phẩm cần PM xác nhận** (plan triển khai theo Default Assumption nếu PM không phản hồi):

- `[NEEDS_PRODUCT_DECISION]` **D1 — Mode mặc định cho người dùng mới**: _Default Assumption_: `hoanghon-dark` (app hiện là dark-first, `src/app/styles/themes/_shared/base.css:59`). Phương án khác: theo hệ điều hành (`enableSystem`), dời sang Giai đoạn 2.
- `[NEEDS_PRODUCT_DECISION]` **D2 — Bản sáng của Than**: brief chỉ ghi "`#111111` on white base". _Default_: `--bg #FFFFFF`, `--surface #FFFFFF`, `--raised #F2F2F3`, `--line #E2E2E5`, text/muted/faint lấy neutral light (`#16181D`/`#50565F`/`#6A707A`), `--on-accent #FFFFFF`.
- `[NEEDS_PRODUCT_DECISION]` **D3 — Text của Than tối**: brief chỉ cho nền OLED (`#000`/`#0A0A0B`/`#141416`/`#232327`). _Default_: text/muted/faint/on-accent lấy neutral dark.
- `[NEEDS_PRODUCT_DECISION]` **D4 — `--soft` của 4 theme phụ**: brief không ghi. _Default_: `rgba(<accent>, .14)` (tối) / `rgba(<accent>, .09)` (sáng), cùng hệ số với Hoàng Hôn; `--glow: transparent`.
- `[NEEDS_PRODUCT_DECISION]` **D5 — Tên tiếng Anh**: _Default_: Hoàng Hôn → "Dusk", Mực → "Ink", Rêu → "Moss", Sen → "Lotus", Than → "Mono" (theo chú thích trong brief).

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json` | Phiên bản cài / tra cứu 2026                               | Ghi chú                                                                         | Nguồn                                                                                                                                             |
| ------------------ | -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next-themes`      | `^0.4.6`       | `0.4.6` — vẫn là bản mới nhất trên npm (11/2026)           | Dùng `value` map nhiều key → cùng class (legacy alias), không cần `themes` prop | `[SRC]` `package.json:66`; `[URL]` https://unpkg.com/next-themes@0.4.6/README.md ; https://github.com/pacocoursey/next-themes                     |
| `tailwindcss`      | `^4.1.18`      | 4.x — cú pháp biến `bg-(--token)` (ngoặc tròn) là chuẩn v4 | Không thêm `@config`; token đi qua CSS custom property                          | `[SRC]` `package.json:113`; `[URL]` https://tailwindcss.com/docs/theme , https://tailwindcss.com/docs/adding-custom-styles#using-arbitrary-values |
| `next`             | `^16.4.0`      | 16.x App Router                                            | Không đổi API Next trong giai đoạn này                                          | `[SRC]` `package.json:64`                                                                                                                         |
| `react`            | `^19.2.3`      | 19.x                                                       | Hook migrate dùng `useEffect` chuẩn                                             | `[SRC]` `package.json:69`                                                                                                                         |
| `vitest`           | `^4.1.12`      | 4.x                                                        | `renderHook` từ `@testing-library/react` cho test hook                          | `[SRC]` `package.json:117`                                                                                                                        |
| CSS `color-mix()`  | —              | Baseline 2023 (Chrome 111, Safari 16.2, Firefox 113)       | Đã được dùng sẵn tại `src/app/styles/themes/_shared/base.css:109-110`           | `[URL]` https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix                                                                    |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**CSS — token & theme**

- `[NEW]` `src/app/styles/themes/hoanghon.css` — `.theme-hoanghon-dark` + `.theme-hoanghon-light` (11 token + `color-scheme`).
- `[NEW]` `src/app/styles/themes/muc.css`
- `[NEW]` `src/app/styles/themes/reu.css`
- `[NEW]` `src/app/styles/themes/sen.css`
- `[NEW]` `src/app/styles/themes/than.css`
- `[MODIFY]` `src/app/styles/themes/_shared/base.css` — `:root` mặc định = Hoàng Hôn tối; khối alias token cũ → mới; `@theme` shadcn trỏ token mới; `body` dùng `--bg`; xóa khối `:root.theme-*` color-scheme (dòng 121–141) và khối `data-theme-tone` chết (dòng 143–169); xóa biến `--surface-dark/-light/...` không còn dùng.
- `[MODIFY]` `src/app/styles/themes/_shared/tokens.css` — `.bg-surface, .theme-surface-canvas` dùng `var(--bg)`.
- `[MODIFY]` `src/app/styles/themes/_shared/utilities.css` — `.static-depth-bg` dùng `--bg` + `--glow` đường chân trời.
- `[MODIFY]` `src/app/globals.css` — thay 16 `@import` bằng 5 `@import`.
- `[DELETE]` `src/app/styles/themes/focus/amber.css`
- `[DELETE]` `src/app/styles/themes/focus/blueprint.css`
- `[DELETE]` `src/app/styles/themes/focus/charcoal.css`
- `[DELETE]` `src/app/styles/themes/focus/gold.css`
- `[DELETE]` `src/app/styles/themes/focus/indigo.css`
- `[DELETE]` `src/app/styles/themes/focus/pitch-black.css`
- `[DELETE]` `src/app/styles/themes/focus/red.css`
- `[DELETE]` `src/app/styles/themes/focus/rose.css`
- `[DELETE]` `src/app/styles/themes/glassmorphism/aqua.css`
- `[DELETE]` `src/app/styles/themes/glassmorphism/holo.css`
- `[DELETE]` `src/app/styles/themes/glassmorphism/nebula.css`
- `[DELETE]` `src/app/styles/themes/glassmorphism/orchid.css`
- `[DELETE]` `src/app/styles/themes/glassmorphism/sunset.css`
- `[DELETE]` `src/app/styles/themes/ra2/allied.css`
- `[DELETE]` `src/app/styles/themes/ra2/soviet.css`
- `[DELETE]` `src/app/styles/themes/ra2/yuri.css`

**Config + logic + test**

- `[MODIFY]` `src/lib/config/theme-config.ts` — mô hình family × mode, `LEGACY_THEME_MAP`, `resolveThemeKey`, `getThemeClassMap`.
- `[MODIFY]` `src/lib/config/theme-config.test.ts` — viết lại theo Test Contract §8 (Loại C).
- `[NEW]` `src/app/features/layout/hooks/useThemeKeyMigration.ts` — ghi đè localStorage khi id lưu không hợp lệ.
- `[NEW]` `src/app/features/layout/hooks/useThemeKeyMigration.test.ts`
- `[MODIFY]` `src/app/features/layout/providers.tsx` — `value={getThemeClassMap()}`, `defaultTheme={DEFAULT_THEME_KEY}`, gắn `<ThemeKeyMigrator />`.
- `[MODIFY]` `src/app/features/chat/hooks/useTheme.ts` — giữ `theme`, `setTheme`, `forcedTheme`, `resolvedTheme`, `systemTheme` (9 caller ở A5 không phải sửa); thêm `family`, `mode`, `setFamily`, `setMode`, `toggleMode`; bỏ `toggleTheme`, `themeIds`.
- `[MODIFY]` `src/app/features/gallery/components/GalleryView.test.tsx` — mock `useTheme` (dòng 69-72) đổi `toggleTheme` → `toggleMode` để khớp shape mới và probe W2 xanh.

**UI**

- `[NEW]` `src/app/features/layout/components/ThemeMenuItems.tsx` — 5 theme (radio) + 2 mode (radio) dùng `DropdownMenuRadioGroup/RadioItem` có sẵn.
- `[MODIFY]` `src/app/features/layout/components/HeaderBar.tsx` — bỏ nhóm theme, dùng `ThemeMenuItems` cho desktop + mobile.
- `[MODIFY]` `src/app/features/layout/HeaderBar.test.tsx` — cập nhật mock/kỳ vọng (Loại C).
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx` — thay vòng lặp `THEME_CONFIG` (dòng 352–361) bằng `<ThemeMenuItems />`.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx` — thay vòng lặp (dòng 91–100) bằng `<ThemeMenuItems />`.
- `[MODIFY]` `src/app/features/chat/components/CommandPalette.tsx` — lệnh "Chuyển giao diện" chuyển sáng/tối.
- `[MODIFY]` `src/app/features/chat/components/CommandPalette.test.tsx` — mock `toggleMode` (Loại C).
- `[MODIFY]` `src/app/features/chat/components/ChatApp.tsx` — gỡ import/render `ChatThemeBackground` (dòng 17, 292–294).
- `[DELETE]` `src/app/features/chat/components/ChatThemeBackground.tsx`
- `[DELETE]` `public/assets/themes/allied.png`
- `[DELETE]` `public/assets/themes/soviet.png`
- `[DELETE]` `public/assets/themes/yuri.png`

**C4 — tương phản**

- `[MODIFY]` `src/app/error.tsx`
- `[MODIFY]` `src/app/not-found.tsx`
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx`
- `[MODIFY]` `src/app/features/chat/components/InputForm.test.tsx` — thêm ca khẳng định nút "+" ở image mode (không giảm `expect` cũ).
- `[MODIFY]` `src/app/features/chat/components/FileLightbox.tsx`
- `[MODIFY]` `src/components/features/projects/CreateProjectModal.tsx`

**i18n**

- `[MODIFY]` `src/lib/utils/translations/vi.ts`
- `[MODIFY]` `src/lib/utils/translations/en.ts`
- `[MODIFY]` `src/lib/utils/translations/index.test.ts` — thay 3 key nhóm theme bằng 3 key mode trong `referencedKeys` (giữ tổng 59).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatTranslations.ts` — xóa 16 key theme cũ (dòng 64–80).

**Living docs**

- `[MODIFY]` `.agents/rules/03-ui.md` — bảng token + mục Theme Integration (→ kích hoạt Cross-Model Critic Pass).
- `[MODIFY]` `docs/architecture.md` — mục Design System.
- `[MODIFY]` `docs/CHANGELOG.md` — mục 2026-11-08.

### 6. Caller-First Design Sketch

**6.1 Call site trong Provider (không nháy theme với id cũ)**

```tsx
// src/app/features/layout/providers.tsx
import { DEFAULT_THEME_KEY, getThemeClassMap } from "@/lib/config/theme-config";
import { useThemeKeyMigration } from "./hooks/useThemeKeyMigration";

const THEME_CLASS_MAP = getThemeClassMap(); // module scope, tính 1 lần

function ThemeKeyMigrator() {
  useThemeKeyMigration();
  return null;
}

<ThemeProvider
  attribute="class"
  defaultTheme={DEFAULT_THEME_KEY} // "hoanghon-dark"
  enableSystem={false}
  disableTransitionOnChange
  value={THEME_CLASS_MAP} // 10 key mới + 16 id cũ → class mới
>
  <ThemeKeyMigrator />
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
</ThemeProvider>;
```

`getThemeClassMap()` trả về ví dụ `{ "hoanghon-dark": "theme-hoanghon-dark", …, "sunset": "theme-hoanghon-dark", "orchid": "theme-sen-light", "pitch-black": "theme-than-dark", … }`. Nhờ A3, người dùng còn lưu `"sunset"` được áp `theme-hoanghon-dark` ngay ở first paint; sau đó `useThemeKeyMigration` gọi `setTheme("hoanghon-dark")` để ghi đè localStorage một lần.

**6.2 Call site trong UI**

```tsx
// HeaderBar / NovelcrafterTopBar / PromptStudioApp
<DropdownMenuContent align="end" className="w-56">
  <ThemeMenuItems />
</DropdownMenuContent>

// ThemeMenuItems.tsx (bên trong)
const { family, mode, setFamily, setMode } = useTheme();   // hook của Vikini
<DropdownMenuLabel>{t("themes")}</DropdownMenuLabel>
<DropdownMenuRadioGroup value={family} onValueChange={(v) => isThemeFamilyId(v) && setFamily(v)}>
  {THEME_FAMILIES.map((f) => (
    <DropdownMenuRadioItem key={f.id} value={f.id}>
      <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: f.swatch[mode] }} />
      {t(f.labelKey)}
    </DropdownMenuRadioItem>
  ))}
</DropdownMenuRadioGroup>
<DropdownMenuSeparator />
<DropdownMenuLabel>{t("themeMode")}</DropdownMenuLabel>
<DropdownMenuRadioGroup value={mode} onValueChange={(v) => isThemeMode(v) && setMode(v)}>
  <DropdownMenuRadioItem value="dark"><Moon /> {t("themeModeDark")}</DropdownMenuRadioItem>
  <DropdownMenuRadioItem value="light"><Sun /> {t("themeModeLight")}</DropdownMenuRadioItem>
</DropdownMenuRadioGroup>

// CommandPalette
const { mode, toggleMode } = useTheme();
title: `${t("switchTheme")}: ${t(mode === "dark" ? "themeModeLight" : "themeModeDark")}`,
perform: () => { toggleMode(); onClose(); }
```

(`style={{ backgroundColor }}` cho swatch giữ đúng tiền lệ hiện có tại `src/app/features/layout/components/HeaderBar.tsx:189-192` vì swatch biểu diễn theme _khác_ theme đang áp nên không thể là token.)

**6.3 Phía test (viết trước khi cài đặt)**

```ts
expect(resolveThemeKey("sunset")).toBe("hoanghon-dark");
expect(resolveThemeKey("orchid")).toBe("sen-light");
expect(resolveThemeKey("pitch-black")).toBe("than-dark");
expect(resolveThemeKey("muc-light")).toBe("muc-light"); // key hợp lệ giữ nguyên
expect(resolveThemeKey("__proto__")).toBe(DEFAULT_THEME_KEY); // chống prototype key
expect(resolveThemeKey(undefined)).toBe(DEFAULT_THEME_KEY);
expect(parseThemeKey("reu-light")).toEqual({ family: "reu", mode: "light" });
expect(parseThemeKey("reu")).toBeNull();
```

**6.4 Interface `theme-config.ts`**

```ts
export type ThemeMode = "dark" | "light";
export type ThemeFamilyId = "hoanghon" | "muc" | "reu" | "sen" | "than";
export type ThemeKey = `${ThemeFamilyId}-${ThemeMode}`;

export interface ThemeFamily {
  id: ThemeFamilyId;
  labelKey: TranslationKey;
  swatch: Readonly<Record<ThemeMode, string>>; // = --accent của mode đó
}

export const THEME_FAMILIES: readonly ThemeFamily[]; // 5 phần tử, Hoàng Hôn đầu tiên
export const THEME_MODES: readonly ThemeMode[]; // ["dark", "light"]
export const THEME_KEYS: readonly ThemeKey[]; // 10 phần tử
export const DEFAULT_THEME_KEY: ThemeKey; // "hoanghon-dark"
export const LEGACY_THEME_MAP: Readonly<Record<string, ThemeKey>>; // 16 phần tử
export function isThemeKey(value: unknown): value is ThemeKey;
export function isThemeFamilyId(value: unknown): value is ThemeFamilyId;
export function isThemeMode(value: unknown): value is ThemeMode;
export function toThemeKey(family: ThemeFamilyId, mode: ThemeMode): ThemeKey;
export function parseThemeKey(value: string): { family: ThemeFamilyId; mode: ThemeMode } | null;
export function resolveThemeKey(stored: string | null | undefined): ThemeKey;
export function getThemeClassMap(): Readonly<Record<string, string>>; // object prototype null
```

**Revision 2 — chống prototype key ở runtime `next-themes`**: runtime của `next-themes@0.4.6` làm `value[name] ?? name` rồi `classList.add(...)` **ngoài** `try` (chỉ script chặn render có `try`). Nếu map là object thường, giá trị lưu `"__proto__"`/`"constructor"`/`"toString"` resolve ra thành viên của `Object.prototype` → `InvalidCharacterError` trong `useEffect` của provider. Vì vậy `getThemeClassMap()` dựng map bằng `Object.assign(Object.create(null) as Record<string, string>, entries)` rồi `Object.freeze`; khi đó key lạ trả `undefined` → `next-themes` dùng nguyên chuỗi (không có class khớp, CSS rơi về `:root` = Hoàng Hôn tối), và `useThemeKeyMigration` ghi đè sang `DEFAULT_THEME_KEY` ở effect kế tiếp.

Tra `LEGACY_THEME_MAP` bằng `Object.hasOwn(LEGACY_THEME_MAP, stored)` (tiền lệ chống prototype key trong `docs/CHANGELOG.md:15`).

**6.5 `useThemeKeyMigration.ts`**

```ts
export function useThemeKeyMigration(): void {
  const { theme, setTheme } = useNextTheme();
  useEffect(() => {
    if (theme === undefined || isThemeKey(theme)) return; // chưa mount hoặc đã hợp lệ
    setTheme(resolveThemeKey(theme));
  }, [theme, setTheme]);
}
```

**6.6 `useTheme.ts` (hook của Vikini)**

```ts
const themeKey = resolveThemeKey(theme);
const { family, mode } = parseThemeKey(themeKey)!; // luôn hợp lệ sau resolve — viết không dùng "!" bằng fallback tường minh
setFamily = (f) => setTheme(toThemeKey(f, mode));
setMode = (m) => setTheme(toThemeKey(family, m));
toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

return {
  theme,
  setTheme,
  forcedTheme,
  resolvedTheme,
  systemTheme,
  family,
  mode,
  setFamily,
  setMode,
  toggleMode,
};
// theme/setTheme giữ nguyên (Revision 2): 9 caller ở A5 tiếp tục chạy; HeaderBar/NovelcrafterTopBar/PromptStudioApp chuyển sang family/mode qua ThemeMenuItems, CommandPalette sang toggleMode.
```

**6.7 Token CSS — mẫu khối theme & alias**

```css
/* hoanghon.css */
.theme-hoanghon-dark {
  color-scheme: dark;
  --bg: #0c0a09;
  --surface: #151110;
  --raised: #201a16;
  --line: #30271f;
  --text: #f6efe9;
  --muted: #b9aba0;
  --faint: #8f8278;
  --accent: #ff8a4c;
  --on-accent: #1a0b03;
  --soft: rgba(255, 138, 76, 0.14);
  --glow: rgba(255, 112, 51, 0.22);
}
.theme-hoanghon-light {
  color-scheme: light; /* 11 token cột Light của brief */
}

/* base.css :root — giá trị mặc định = Hoàng Hôn tối (an toàn khi chưa có class) + alias cũ */
:root {
  /* …11 token Hoàng Hôn tối… */
  --surface-strong: var(--bg);
  --surface-muted: var(--raised);
  --surface-elevated: var(--surface);
  --border: var(--line);
  --control-bg: var(--raised);
  --control-bg-hover: color-mix(in oklab, var(--raised) 88%, var(--text) 12%);
  --control-border: color-mix(in oklab, var(--line) 80%, var(--text) 20%);
  --text-primary: var(--text);
  --text-secondary: var(--muted);
  --accent-foreground: var(--on-accent);
  --bg-glow: var(--glow);
  /* --primary/-light/-dark giữ như cũ (đã alias --accent) */
}
```

Alias khai báo trên `:root` và class theme cũng gắn trên `<html>` (A3: `document.documentElement.classList`) → `var(--line)` được tính trên **cùng một phần tử**, nên alias luôn nhận giá trị của theme đang áp.

**6.8 C4**

`bg-(--accent) text-white …` → `bg-(--accent) text-(--on-accent) …` tại 6 vị trí (§1 mục 4). Chọn tên chuẩn của brief `--on-accent` (Giai đoạn 6 sẽ codemod `--accent-foreground` → `--on-accent`); hai tên luôn bằng nhau nhờ alias.

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B0 — Môi trường**: trong worktree chạy `npm ci` (A9). Ghi baseline: `npm run type-check; npx vitest run src/lib/config src/app/features/layout src/lib/utils/translations --reporter=dot`.
- [ ] **B1 — Test trước (TDD)**: viết lại `src/lib/config/theme-config.test.ts` theo §8 TC-01…TC-10 và tạo `src/app/features/layout/hooks/useThemeKeyMigration.test.ts` (TC-11…TC-14). Chạy → phải **đỏ** (chứng minh test thực sự kiểm tra hành vi mới).
- [ ] **B2 — `theme-config.ts`**: cài đặt interface §6.4. Mỗi hàm < 20 dòng, file < 150 dòng, không `any`, không non-null assertion.
- [ ] **B3 — CSS theme**: tạo 5 file `src/app/styles/themes/{hoanghon,muc,reu,sen,than}.css` với giá trị đúng brief (và Default D2–D4). Viết hex chữ thường; `--soft`/`--glow` dạng `rgba()`.
- [ ] **B4 — `base.css` / `tokens.css` / `utilities.css`**: theo §6.7 và A7: `:root` = Hoàng Hôn tối + alias; `@theme` (`src/app/styles/themes/_shared/base.css:9-28`): `--color-background: var(--bg)`, `--color-card`/`--color-popover: var(--surface)`, `--color-muted: var(--raised)`, `--color-muted-foreground: var(--muted)`, `--color-primary-foreground`/`--color-accent-foreground: var(--on-accent)`, `--color-border: var(--line)`; `body { background: var(--bg); color: var(--text); }`; xóa `src/app/styles/themes/_shared/base.css:121-169`; `.bg-surface, .theme-surface-canvas { background: var(--bg); }`; `.static-depth-bg { background: radial-gradient(ellipse 120% 40% at 50% 110%, var(--glow), transparent 70%), var(--bg); }`.
- [ ] **B5 — `globals.css`**: thay dòng 15–41 bằng 5 `@import "./styles/themes/<id>.css";` dưới tiêu đề "THEMES (Vikini 3.0)". Xóa 16 file CSS cũ.
- [ ] **B6 — Provider + migrate**: tạo `useThemeKeyMigration.ts`; sửa `providers.tsx` theo §6.1. Chạy test B1 → xanh.
- [ ] **B7 — `useTheme.ts`**: theo §6.6; xóa `THEME_IDS`, `THEME_TONES`, `ThemeTone`, `toggleTheme` (Grep xác nhận 0 caller còn lại ngoài `CommandPalette`); sửa mock `toggleTheme` → `toggleMode` trong `src/app/features/gallery/components/GalleryView.test.tsx:72`.
- [ ] **B8 — `ThemeMenuItems.tsx`** (< 120 dòng) + thay vào `HeaderBar.tsx` (desktop 172–202, mobile 248–277; xóa `THEME_GROUP_LABELS` 29–33 và `groupedThemes` 46–55; trigger hiện tên theme + swatch theo `family`/`mode`), `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:352-361`, `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:91-100`. Xóa import `THEME_CONFIG`/`setTheme` thừa.
- [ ] **B9 — `src/app/features/chat/components/CommandPalette.tsx:82-91`** dùng `toggleMode` + nhãn mode; cập nhật mock `src/app/features/chat/components/CommandPalette.test.tsx:14-21,89-103` (`toggleMode`).
- [ ] **B10 — Gỡ RA2**: xóa `ChatThemeBackground.tsx`, 3 ảnh `public/assets/themes/*.png`, import/render tại `src/app/features/chat/components/ChatApp.tsx:17,292-294` (giữ `useTheme()` ở `src/app/features/chat/components/ChatApp.tsx:55` chỉ khi còn dùng `theme`; nếu không còn → xóa luôn import `useTheme` dòng 25).
- [ ] **B11 — i18n**: theo add-translation SKILL — thêm vào **cả** `vi.ts` và `en.ts`: `themeHoangHon` ("Hoàng Hôn"/"Dusk"), `themeMuc` ("Mực"/"Ink"), `themeReu` ("Rêu"/"Moss"), `themeSen` ("Sen"/"Lotus"), `themeThan` ("Than"/"Mono"), `themeMode` ("Chế độ"/"Mode"), `themeModeDark` ("Tối"/"Dark"), `themeModeLight` ("Sáng"/"Light"). Xóa 16 key theme cũ (`src/lib/utils/translations/vi.ts:50-65`, `src/lib/utils/translations/en.ts:52-67`) và 3 key nhóm (`src/lib/utils/translations/vi.ts:908-910`, `src/lib/utils/translations/en.ts:898-900`) sau khi Grep xác nhận 0 caller. Sửa `src/app/features/chat/components/hooks/useChatTranslations.ts:64-80`, `src/lib/utils/translations/index.test.ts:88-90` (thay bằng `themeMode`, `themeModeDark`, `themeModeLight`, giữ `toBe(59)`). Chạy `npm run type-check`.
- [ ] **B12 — C4**: sửa 6 vị trí §1 mục 4; thêm ca test TC-17 vào `InputForm.test.tsx` (không đụng ca `stopBtn` `text-white` của nút `--danger` tại dòng 126–129 — ngoài phạm vi).
- [ ] **B13 — HeaderBar.test.tsx**: mock `@/lib/config/theme-config` theo API mới hoặc bỏ mock để dùng config thật; thay 2 ca nhóm theme (`src/app/features/layout/HeaderBar.test.tsx:134-144`) bằng TC-15/TC-16 (Loại C).
- [ ] **B14 — Living docs**: `.agents/rules/03-ui.md` (bảng token dòng 21–29 thêm 11 token mới + ghi chú alias tạm thời; Theme Integration dòng 81–85: "5 theme × sáng/tối, file `app/styles/themes/<id>.css`"; dòng 43 "all 15 themes" → "all 10 theme/mode"), giữ file ≤ 12.000 ký tự; `docs/architecture.md:68-72`; `docs/CHANGELOG.md`.
- [ ] **B15 — Verify** theo §9 (Tier 1 + Tier 2), chạy Wiring/Negative Probes, kiểm tay 10 tổ hợp theme/mode.
- [ ] **B16 — Đóng**: báo PM, chờ `@qa`; sau nghiệm thu đổi Header plan sang `- **Status**: Completed`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

**`src/lib/config/theme-config.test.ts`** (logic thuần + kiểm CSS bằng đọc file)

| TC                          | Input                                                                                                                                                       | Output mong đợi                                                                                                                                                                                                                                                                                                                                        | Lý do chống specification gaming                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| TC-01                       | `THEME_FAMILIES`, `THEME_KEYS`                                                                                                                              | đúng 5 family theo thứ tự `hoanghon, muc, reu, sen, than`; đúng 10 key = tích Descartes family × `["dark","light"]`; `DEFAULT_THEME_KEY === "hoanghon-dark"`                                                                                                                                                                                           | So sánh `toEqual` mảng tường minh, không chỉ `toHaveLength`                                                       |
| TC-02                       | 16 id cũ                                                                                                                                                    | `resolveThemeKey` trả đúng bảng brief: `sunset/amber/gold→hoanghon-dark`; `blueprint/indigo/nebula/holo/allied→muc-dark`; `aqua→reu-dark`; `rose/red/soviet/yuri→sen-dark`; `orchid→sen-light`; `charcoal/pitch-black→than-dark`                                                                                                                       | `it.each` 16 dòng, mỗi dòng 1 kỳ vọng cụ thể; thêm kiểm `Object.keys(LEGACY_THEME_MAP).sort()` bằng đúng 16 id cũ |
| TC-03                       | 10 key hợp lệ                                                                                                                                               | `resolveThemeKey(k) === k` (idempotent) và `resolveThemeKey(resolveThemeKey(x)) === resolveThemeKey(x)` với mọi x trong 16 id cũ                                                                                                                                                                                                                       | Bảo đảm migrate chạy lặp an toàn                                                                                  |
| TC-04 (**Negative**)        | `undefined`, `null`, `""`, `"system"`, `"light"`, `"dark"`, `"HOANGHON-DARK"`, `"hoanghon"`, `"hoanghon-dim"`, `"__proto__"`, `"constructor"`, `"toString"` | đều trả `DEFAULT_THEME_KEY`                                                                                                                                                                                                                                                                                                                            | Chặn lookup qua `Object.prototype` và chuỗi gần đúng                                                              |
| TC-05                       | `parseThemeKey`                                                                                                                                             | `"reu-light"→{family:"reu",mode:"light"}`; `"reu"`, `"reu-light-x"`, `"foo-dark"`, `""` → `null`                                                                                                                                                                                                                                                       | Ca âm tính bắt buộc                                                                                               |
| TC-06                       | `toThemeKey` / `isThemeKey` / `isThemeFamilyId` / `isThemeMode`                                                                                             | round-trip `parseThemeKey(toThemeKey(f,m))` cho cả 10 tổ hợp; guard trả `false` cho `42`, `{}`, `null`                                                                                                                                                                                                                                                 |                                                                                                                   |
| TC-07                       | `getThemeClassMap()`                                                                                                                                        | 26 entry; `map["muc-light"]==="theme-muc-light"`; `map["orchid"]==="theme-sen-light"`; mọi giá trị khớp `/^theme-(hoanghon\|muc\|reu\|sen\|than)-(dark\|light)$/` (một token class duy nhất — A3 `classList.add`); **(Revision 2)** `Object.getPrototypeOf(map) === null`, `map["__proto__"]`, `map["constructor"]`, `map["toString"]` đều `undefined` | Bắt lỗi giá trị chứa khoảng trắng hoặc prototype key gây `InvalidCharacterError`                                  |
| TC-08                       | Đọc 5 file CSS trong `src/app/styles/themes/`                                                                                                               | Mỗi `THEME_KEYS` có đúng 1 khối `.theme-<key> { … }`; khối khai báo đủ 11 token; `color-scheme` bằng mode của key                                                                                                                                                                                                                                      | Lặp theo `THEME_KEYS` (không theo file) để key thiếu CSS là đỏ                                                    |
| TC-09                       | Tương phản WCAG 2.2 (hàm `getContrastRatio` hiện có, mở rộng parse hex)                                                                                     | Với cả 10 khối: `--text`/`--bg` ≥ 7; `--muted`/`--bg` ≥ 4.5; `--faint`/`--bg` ≥ 4.5; `--on-accent`/`--accent` ≥ 4.5; `--accent`/`--bg` ≥ 3 (non-text UI, WCAG 1.4.11)                                                                                                                                                                                  | Ngưỡng cụ thể, message nêu theme + cặp màu + tỷ lệ                                                                |
| TC-10 (**Negative/Wiring**) | Cấu trúc thư mục + `globals.css` + `base.css`                                                                                                               | Thư mục `focus/`, `glassmorphism/`, `ra2/` **không tồn tại**; `globals.css` có đúng 5 `@import "./styles/themes/<id>.css"` khớp `THEME_FAMILIES`, đứng **sau** `@import` của `_shared/base.css` (thứ tự cascade); `base.css` `:root` khai báo đủ 11 alias (§6.7) dạng `var(--…)`/`color-mix(…)` và **không** còn `data-theme-tone`                     | Chứng minh CSS cũ đã gỡ và alias được nối dây                                                                     |

**`src/app/features/layout/hooks/useThemeKeyMigration.test.ts`** (mock `next-themes` `useTheme`, `renderHook`)

| TC                   | `theme` hiện tại                          | Kỳ vọng                                                                             |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| TC-11                | `"sunset"` / `"orchid"` / `"pitch-black"` | `setTheme` gọi **đúng 1 lần** với `"hoanghon-dark"` / `"sen-light"` / `"than-dark"` |
| TC-12 (**Negative**) | `"hoanghon-light"` (hợp lệ)               | `setTheme` **không** được gọi                                                       |
| TC-13 (**Negative**) | `undefined` (SSR / chưa mount)            | `setTheme` **không** được gọi                                                       |
| TC-14                | `"garbage"`, `"__proto__"`                | `setTheme("hoanghon-dark")` đúng 1 lần                                              |

**UI (component test)**

| TC    | File                      | Kỳ vọng                                                                                                                                                                                            |
| ----- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-15 | `HeaderBar.test.tsx`      | Menu desktop và mobile đều hiển thị 5 tên theme đã dịch + "Tối"/"Sáng" (`getAllByText(...).toHaveLength(2)` cho mỗi nhãn); không còn nhãn "Tập trung"/"Báo động đỏ (RA2)" (`queryByText` → `null`) |
| TC-16 | `HeaderBar.test.tsx`      | Với `useTheme` mock `theme: "muc-light"`, radio item "Mực" và "Sáng" có `aria-checked="true"` / `data-state="checked"`                                                                             |
| TC-17 | `InputForm.test.tsx`      | Ở image mode, nút "+" có `bg-(--accent)` và `text-(--on-accent)`, **không** chứa `text-white`                                                                                                      |
| TC-18 | `CommandPalette.test.tsx` | Click mục `switchTheme` → `toggleMode` được gọi 1 lần (thay `toggleTheme`)                                                                                                                         |

**Failure modes & message**: test TC-08/09 phải in `Theme '<key>' <tokenA> (<hex>) vs <tokenB> (<hex>) = <ratio>:1 < <ngưỡng>`; TC-02 in id cũ bị sai. **Pass/fail**: 100% TC xanh, không `.skip/.only`, không giảm `expect` của test cũ ngoài các ca được thay thế theo Loại C đã liệt kê (`src/lib/config/theme-config.test.ts:31-53,128-133`, `src/app/features/layout/HeaderBar.test.tsx:134-144`, `src/app/features/chat/components/CommandPalette.test.tsx:89-103`, `src/lib/utils/translations/index.test.ts:88-90`).

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

**Test co-located**: `src/lib/config/theme-config.test.ts` (cạnh `theme-config.ts`), `src/app/features/layout/hooks/useThemeKeyMigration.test.ts` (cạnh hook), cùng các test component đã liệt kê.

**Lệnh (PowerShell, dùng `;`)**

```powershell
npm ci
npx vitest run src/lib/config src/app/features/layout src/app/features/chat/components/InputForm.test.tsx src/app/features/chat/components/CommandPalette.test.tsx src/lib/utils/translations --reporter=dot
npm run type-check; npm run lint; npm run test:run
```

**Wiring Probes**

| #   | Probe                                                                                                                                                                                                             | Kỳ vọng                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| W1  | Grep `theme-(nebula\|orchid\|aqua\|holo\|sunset\|blueprint\|amber\|indigo\|charcoal\|pitch-black\|gold\|red\|rose\|yuri\|allied\|soviet)\b` trong `src/**/*.{ts,tsx,css}`                                         | 0 kết quả ngoài `LEGACY_THEME_MAP` + test của nó |
| W2  | Grep `THEME_CONFIG\|ThemeGroup\|ThemeTone\|THEME_TONES\|toggleTheme\|ChatThemeBackground\|data-theme-tone` trong `src/`                                                                                           | 0 kết quả                                        |
| W3  | Grep `bg-\(--accent\)[^"]*text-white\|bg-\[var\(--accent\)\][^"]*text-white` trong `src/`                                                                                                                         | 0 kết quả                                        |
| W4  | `npm run dev` → DevTools trên `<html>`: chọn lần lượt 10 tổ hợp → `class` đúng `theme-<family>-<mode>`; `getComputedStyle(document.documentElement).getPropertyValue("--border")` bằng giá trị `--line` của theme | Alias nối dây đúng trên cùng phần tử             |
| W5  | Sau `npm run build`, mở CSS bundle trong `.next/static/css/` → Grep `.theme-hoanghon-dark` có, `.theme-blueprint` không                                                                                           | Import mới thực sự vào bundle                    |

**Negative Probes** (§4.5.3)

| #   | Probe                                                                       | Kỳ vọng                                                                                                                          |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| N1  | DevTools: `localStorage.setItem("theme","sunset")` → reload                 | First paint đã có `theme-hoanghon-dark` (không nháy về default); sau hydrate `localStorage.getItem("theme") === "hoanghon-dark"` |
| N2  | `localStorage.setItem("theme","orchid")` → reload                           | `theme-sen-light`, `color-scheme: light`; storage → `"sen-light"`                                                                |
| N3  | `localStorage.setItem("theme","__proto__")` → reload                        | Không lỗi console; storage → `"hoanghon-dark"` (TC-04/TC-14 là bản tự động)                                                      |
| N4  | Tạm sửa một giá trị `--faint` trong `muc.css` thành `#555555` → chạy TC-09  | TC-09 **đỏ** với message nêu `muc-dark --faint`; hoàn tác                                                                        |
| N5  | Tạm xóa `@import "./styles/themes/reu.css"` khỏi `globals.css` → chạy TC-10 | TC-10 **đỏ**; hoàn tác                                                                                                           |
| N6  | Tạm đổi `LEGACY_THEME_MAP.orchid` thành `"sen-dark"` → chạy TC-02           | **đỏ**; hoàn tác                                                                                                                 |

**Kiểm tay (QA)**: 10 tổ hợp × các màn: chat, sign-in, `/not-found`, error boundary, FileLightbox (lỗi + mở tab mới), CreateProjectModal (chọn icon), Novelcrafter top bar, Prompt Studio, Command Palette (⌘K → chuyển sáng/tối). Hai tab cùng mở: đổi theme ở tab A → tab B cập nhật (sự kiện `storage` của `next-themes`, A3).

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                              | Mức        | Control kỹ thuật / Probe                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Người dùng có id cũ trong localStorage bị mất theme / nháy giao diện                | **Cao**    | `getThemeClassMap()` map 16 id cũ → class mới cho script chặn render (A3, `src/app/features/layout/providers.tsx:22-28` sau sửa) + `useThemeKeyMigration` ghi đè storage; kiểm bằng TC-02, TC-07, TC-11, Negative Probe N1/N2                                                                                                                                       |
| Giá trị localStorage rác / độc (`__proto__`, `constructor`) làm hỏng lookup         | Trung bình | `Object.hasOwn` + guard `isThemeKey` trong `resolveThemeKey`; TC-04, TC-14, N3                                                                                                                                                                                                                                                                                      |
| Đổi nghĩa `--surface` (canvas → panel) làm nền trang / card đổi màu ngoài ý muốn    | Trung bình | Nền trang chuyển tường minh sang `--bg` tại `src/app/styles/themes/_shared/base.css:177-181`, `src/app/styles/themes/_shared/tokens.css:7-10`, `src/app/styles/themes/_shared/utilities.css:6-10`, `src/app/styles/themes/_shared/base.css:10` (A7); probe W4 + kiểm tay 10 tổ hợp; ghi nhận chênh lệch nhỏ đã chấp nhận                                            |
| Alias cũ không nhận giá trị theme (khai báo khác phần tử)                           | Trung bình | Alias đặt trên `:root`, class theme do `next-themes` gắn trên `document.documentElement` (A3) — cùng phần tử; TC-10 kiểm alias tồn tại; W4 kiểm giá trị computed                                                                                                                                                                                                    |
| Bộ màu brief không đạt WCAG trên một số cặp                                         | Trung bình | TC-09 tự động trên cả 10 khối (ngưỡng §8). Tính tay trước: neutral light `--faint #6A707A` / `#F6F5F1` ≈ 4,57:1 (sát ngưỡng, đạt); Hoàng Hôn light `#FFF`/`#C2410C` ≈ 5,18:1; Rêu light ≈ 5,7:1; Sen light ≈ 6,0:1. Ghi chú: `--faint` trên `--raised` (light) ≈ 4,2:1 — brief chỉ yêu cầu trên `--bg`, nên cấm dùng `--faint` trên `--raised` (ghi vào `03-ui.md`) |
| Gỡ key dịch / export cũ làm vỡ caller chưa phát hiện                                | Trung bình | `npm run type-check` (TS strict + parity của `src/lib/utils/translations/index.ts`) + probe W1/W2                                                                                                                                                                                                                                                                   |
| Light mode lộ các class màu thô (`text-white`, `bg-black/…`) ở 35 file chưa codemod | Trung bình | Chấp nhận có kiểm soát: chỉ C4 được sửa ở giai đoạn này; danh sách 142 lượt `text-white` / 35 file (`[CMD]` Grep count) chuyển vào backlog Giai đoạn 6; QA kiểm tay light mode các màn chính ở B15                                                                                                                                                                  |
| `--danger` + `text-white` ≈ 3,76:1                                                  | Thấp       | Ngoài phạm vi C4; ghi backlog Giai đoạn 6                                                                                                                                                                                                                                                                                                                           |
| Xóa ảnh RA2 làm hỏng tham chiếu khác                                                | Thấp       | `[CMD]` Grep `assets/themes` chỉ khớp `src/app/features/chat/components/ChatThemeBackground.tsx:33` (file cũng bị xóa)                                                                                                                                                                                                                                              |
| Sửa `.agents/rules/03-ui.md` vượt giới hạn 12.000 ký tự                             | Thấp       | Đo độ dài file sau sửa ở B14                                                                                                                                                                                                                                                                                                                                        |

### Lộ Trình (Giai đoạn 2–6 theo brief)

| Giai đoạn | Nội dung                                                                                                                                                                                                                                                                                                                                                                              | Mã audit               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 2         | **AppShell & điều hướng**: icon rail 64px (logo, "+", Chat, Dự án, Gems & Persona, Ảnh, Novelcrafter, ⌘K, cài đặt, avatar) + context panel theo section; thay `FloatingMenuTrigger`; hamburger 44px trên mobile; `PageHeader`/`EmptyState` dùng chung; nạp font Be Vietnam Pro / Newsreader / JetBrains Mono + token thang chữ 12/13/14/16/20/24/32; (tùy D1) theo theme hệ điều hành | C2, C5, C6, M4, M8     |
| 3         | **Chat, composer, model picker**: tin nhắn AI không bubble + avatar model, nhịp 28px, action bar icon có nhãn/tooltip, header đặc, composer dock với toggle `aria-pressed`, chip model, vệt accent khi streaming, `--glow` Hoàng Hôn sau composer; model picker dạng Command (tìm, lọc, "Gần đây", nhóm theo provider), bottom sheet mobile                                           | C1, C3, H2, H6, M1, M2 |
| 4         | **Ảnh**: gộp một section với tab Tạo ảnh / Thư viện / Mô tả ảnh                                                                                                                                                                                                                                                                                                                       | M3, M5                 |
| 5         | **Novelcrafter**: view Viết / Dàn ý / Hồ sơ, selection toolbar, feedback lề, pane thẻ AI + composer hiển thị nguồn prompt, outline theo hồi, story bible "ẩn với AI", "Cài đặt AI của truyện" hợp nhất, AI dock mobile                                                                                                                                                                | H1                     |
| 6         | **Gems/Personas grid, Sign-in**: copy + theme Sign-in; codemod 743 class màu thô sang token, đổi `--accent-foreground` → `--on-accent`, gỡ alias cũ; lint guard cấm màu thô/hex trong `src/**/*.tsx`; sửa `--danger` contrast                                                                                                                                                         | H3, H7, H4, H5         |

## Audit History

### Audit Run 1

- **Reviewer**: Claude Opus 5.5 (orchestrator session) — PM chỉ định review trực tiếp trong phiên, thay cho `@reviewer` / Claude CLI, để tiết kiệm token (2026-11-08).
- **Cross-Model Critic Pass**: plan chạm `.agents/rules/03-ui.md` (`CRITIC_REQUIRED yes`); PM miễn Critic Pass cho plan này.
- **`node scripts/verify-plan.mjs`**: lần đầu FAIL (27 tham chiếu `file:line` viết tắt, không có đường dẫn đầy đủ). Đã mở rộng thành đường dẫn đầy đủ; chạy lại → `VERIFY_PLAN: PASS (0 failures, 0 warnings)`.
- **Kiểm chứng ngẫu nhiên**: `[CMD]` đã đọc đúng các dòng C4 (`src/app/error.tsx:36`, `src/app/not-found.tsx:18`, `src/app/features/chat/components/InputForm.tsx:289`, `src/app/features/chat/components/FileLightbox.tsx:352`, `src/app/features/chat/components/FileLightbox.tsx:370`, `src/components/features/projects/CreateProjectModal.tsx:181`), `src/app/features/layout/providers.tsx:22-28`, `src/app/features/chat/components/CommandPalette.tsx:82-91`, `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:352-361`, `src/app/features/chat/components/ChatApp.tsx:292-294`, `src/lib/utils/translations/vi.ts:908-910` — khớp mô tả.
- **Kiểm đủ alias**: `[CMD]` liệt kê biến khai báo trong 16 file theme cũ: `--accent`, `--border`, `--control-*`, `--glow`, `--surface`, `--surface-elevated`, `--surface-muted`, `--surface-gradient`, `--text-primary`, `--text-secondary`, `--danger`, `--danger-hover`. Tất cả đã có alias ở §6.7 hoặc mặc định trong `src/app/styles/themes/_shared/base.css` (`--danger`, `--danger-hover`, `--ring`, `--overlay`, `--success`, `--warning` đều có trong `_shared`). `--surface-gradient` chỉ dùng kèm fallback tại `src/app/styles/themes/_shared/base.css:178` và `src/app/styles/themes/_shared/tokens.css:9`, và B4 viết lại cả hai chỗ.

#### Critic Findings

| #   | Mức       | Vị trí                                                                                                           | Phát hiện                                                                                                                                                                                                             | Xử lý                                                                                                                                          |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `[MINOR]` | `src/app/features/chat/components/DashboardView.tsx:191`, `src/app/features/layout/components/HeaderBar.tsx:109` | `--glow` hiện là màu phát sáng của accent, dùng cho đổ bóng ở hai chỗ này. Theo brief, `--glow` thành vệt chân trời và bằng `transparent` ở Mực/Rêu/Sen/Than, nên hai bóng biến mất ở 4 theme đó. Không vỡ chức năng. | Chấp nhận như thay đổi thị giác. Giai đoạn 2/3 thay bằng `color-mix(in srgb, var(--accent) 25%, transparent)` khi làm lại HeaderBar/Dashboard. |
| 2   | `[MINOR]` | `src/app/features/layout/components/HeaderBar.tsx:109`                                                           | Logo dùng `text-(--surface)` trên nền accent; với nghĩa mới, `--surface` là màu panel. Đã tính: `#151110` trên `#FF8A4C` ≈ 7,6:1 và `#FFFFFF` trên `#C2410C` ≈ 5,2:1, đều đạt.                                        | Không sửa ở giai đoạn này; thống nhất sang `--on-accent` ở Giai đoạn 6.                                                                        |
| 3   | `[MINOR]` | `src/app/features/layout/providers.tsx:22-28`                                                                    | `useThemeKeyMigration` (§6.5) gọi `setTheme` của `next-themes` trong `useEffect`. `setTheme` ổn định giữa các lần render (A3) và guard `isThemeKey` chặn lặp vô hạn.                                                  | Không cần thêm `useMemo`/ref; TC-11 ("gọi đúng 1 lần") khóa hành vi.                                                                           |
| 4   | `[MINOR]` | `src/app/features/chat/components/ChatThemeBackground.tsx:33`                                                    | Xóa `ChatThemeBackground.tsx` và 3 ảnh RA2 nằm ngoài danh sách brief, nhưng đây là tham chiếu duy nhất tới `assets/themes` và chỉ phục vụ 3 theme RA2 bị gỡ.                                                          | Hợp lệ; probe W2 xác nhận.                                                                                                                     |

#### Kết luận

Không có `[BLOCKER]` hay `[MAJOR]`. Test Contract đủ ca âm tính (TC-04, TC-05, TC-12, TC-13, TC-14) và có probe nối dây (W1–W5, N1–N6). Có test co-located cho logic mới trong `src/lib/config/` và hook mới. Bảng rủi ro có control cho từng mục. Các quyết định D1–D5 áp dụng theo Default Assumption; PM có thể đổi sau mà không ảnh hưởng cấu trúc.

### Audit Run 2

[REVIEWER_MODEL: claude-opus-5-5 (independent re-review, PM yêu cầu trong phiên)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-08-vikini-3-tokens-and-themes-implementation-plan.md` → `SECTIONS 7/7`, 58 `LINE_REF` PASS, `CRITIC_REQUIRED yes (.agents/rules/03-ui.md)`, `CRITIC_FLOOR 4`, `VERIFY_PLAN: PASS (0 failures, 0 warnings)`.
- Không kế thừa kết luận Audit Run 1. Ghi nhận governance: Audit Run 1 do orchestrator tự duyệt và Critic Pass được PM miễn. Đây là quyết định của PM nên không chặn.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                   | Bằng chứng                                                                                                                                                                                                                                                                                           | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------- | ------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/layout/providers.tsx:22-28`                 | [SRC] `next-themes@0.4.6` `dist/index.mjs` dòng 1: runtime `S` làm `v = d ? d[r] : r` rồi `P.classList.add(v)`, **không** nằm trong `try` (chỉ script chặn render có `try`).                                                                                                                         | Nếu `getThemeClassMap()` trả object thường, giá trị lưu `"__proto__"` / `"constructor"` / `"toString"` resolve ra thành viên của `Object.prototype`. `classList.add` nhận chuỗi có khoảng trắng nên ném `InvalidCharacterError` trong `useEffect` của provider, rơi vào error boundary. `useThemeKeyMigration` không cứu được vì `S(c)` vẫn chạy với `c` cũ trong cùng commit. Probe N3 sẽ FAIL; TC-04/TC-14 không kiểm map. **Sửa**: `getThemeClassMap()` trả object prototype null (`Object.assign(Object.create(null), …)`); TC-07 thêm `Object.getPrototypeOf(map) === null` và `map["__proto__"]`, `map["constructor"]`, `map["toString"]` đều `undefined`. |
| 2   | DEFECT         | [MINOR] | `src/app/features/gallery/components/GalleryView.test.tsx:72` | [CMD] Grep `toggleTheme` trong `src/`                                                                                                                                                                                                                                                                | Mock còn `toggleTheme`, file không có trong §5, nên probe W2 ("0 kết quả") sẽ đỏ. **Sửa**: thêm `[MODIFY]` hoặc loại mock khỏi W2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | DEFECT         | [MINOR] | `src/app/features/chat/components/ChatApp.tsx:55`             | [CMD] Grep import `useTheme`: còn `src/app/features/gallery/components/GalleryView.tsx:36`, `src/app/features/image-gen/components/ImageGenStudio.tsx:35`, `src/app/features/image-gen/components/DescribeImageView.tsx:28`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:48` | A5 chưa liệt kê caller của `useTheme.ts`; §6.6 không ghi shape trả về. **Sửa**: ghi rõ hook vẫn trả `theme` + `setTheme` và bổ sung 4 caller vào blast radius.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | RISK_DISMISSED | —       | `src/app/globals.css:11`                                      | [SRC] `_shared/base.css` import trước file theme                                                                                                                                                                                                                                                     | `:root` và `.theme-<key>` cùng specificity, nhưng theme đứng sau nên thắng. Gợi ý: TC-10 khẳng định thêm thứ tự import.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 5   | RISK_DISMISSED | —       | `docs/specs/2026-11-08-vikini-3-redesign-brief.md:37-58`      | [CMD] tính tay WCAG                                                                                                                                                                                                                                                                                  | Các cặp sát ngưỡng đều đạt: Hoàng Hôn light faint ≈ 5,1:1; neutral dark faint ≈ 5,1:1; Rêu light ≈ 5,7:1; Mực light ≈ 6,5:1; Mực dark on-accent ≈ 8,4:1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | RISK_DISMISSED | —       | `src/app/features/layout/providers.tsx:12-18`                 | [SRC] `next-themes` `S` = `useCallback(..., [p])`, đóng băng `value` lần đầu                                                                                                                                                                                                                         | `THEME_CLASS_MAP` ở module scope nên ổn định. `enableColorScheme` đặt `colorScheme = null` cho key không phải light/dark, nên `color-scheme` trong CSS có hiệu lực (khớp A3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

#### 4. Kết Luận

1 `[MAJOR]` (#1), nên cần Revision 2: sửa §6.4 + TC-07, kèm #2, #3. `CRITIC_REQUIRED yes`: sau khi sửa cần Critic Pass, trừ khi PM tiếp tục miễn.

[CHANGES_REQUESTED]

### Audit Run 3

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định; Critic Pass do PM miễn)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-08-vikini-3-tokens-and-themes-implementation-plan.md` → `VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED yes (.agents/rules/03-ui.md)`.
- Audit Run 2 #1 `[MAJOR]` → **đã xử lý**: §6.4 dùng map prototype null + `Object.freeze`; TC-07 kiểm `Object.getPrototypeOf(map) === null` và 3 prototype key trả `undefined`.
- Audit Run 2 #2 `[MINOR]` → **đã xử lý**: `GalleryView.test.tsx` có trong §5 và B7; probe W2 sẽ xanh.
- Audit Run 2 #3 `[MINOR]` → **đã xử lý**: A5 liệt kê đủ 9 caller của `useTheme.ts`; §6.6 ghi shape trả về giữ `theme`/`setTheme`.
- Audit Run 2 #4 (gợi ý) → TC-10 đã kiểm thứ tự `@import`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                   | Bằng chứng                                                                                                                                                                                | Lý do / Kết luận                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------- | ------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `src/app/features/layout/providers.tsx:22-28`                 | [SRC] `node_modules/next-themes/dist/index.mjs` (0.4.6, repo chính): runtime `let v=d?d[r]:r; … v&&P.classList.add(v)`; script chặn render `d.classList.add(a&&a[n]?a[n]:n)` trong `try`. | Đoạn "Revision 2" ở §6.4 mô tả runtime là `value[name] ?? name` và nói key lạ "dùng nguyên chuỗi" — chưa chính xác: runtime **không thêm class nào** (vì `v` = `undefined`), còn script chặn render mới dùng nguyên chuỗi (token hợp lệ, không khoảng trắng, nên không ném lỗi). Kết quả cuối giống plan (CSS rơi về `:root` = Hoàng Hôn tối, migration ghi đè), nên không chặn; khi code chỉ cần sửa comment cho đúng. |
| 2   | RISK_DISMISSED | —       | `src/app/features/layout/providers.tsx:1`                     | [SRC] File có `"use client"`.                                                                                                                                                             | Object prototype null không đi qua ranh giới RSC (vốn chỉ nhận plain object), nên `value={THEME_CLASS_MAP}` an toàn. `JSON.stringify` trong script chặn render vẫn serialize được object prototype null đã freeze.                                                                                                                                                                                                      |
| 3   | RISK_DISMISSED | —       | `src/app/features/chat/components/CommandPalette.test.tsx:19` | [CMD] Grep `toggleTheme` trong `src/**/*.test.tsx` → chỉ `CommandPalette.test.tsx` và `GalleryView.test.tsx`.                                                                             | Cả hai đã nằm trong §5 (`CommandPalette.test.tsx` qua B9, `GalleryView.test.tsx` qua B7); probe W2 không còn kết quả sót.                                                                                                                                                                                                                                                                                               |
| 4   | RISK_DISMISSED | —       | `src/app/features/gallery/components/GalleryView.tsx:36`      | [SRC] 4 caller (`GalleryView.tsx:36`, `ImageGenStudio.tsx:35`, `DescribeImageView.tsx:28`, `NovelcrafterStudioApp.tsx:48`) chỉ đọc `theme` hoặc gọi suông.                                | §6.6 giữ `theme` trong shape trả về nên 4 file này không cần sửa; `npm run type-check` ở bước kiểm tra sẽ bắt mọi lệch shape.                                                                                                                                                                                                                                                                                           |

#### 4. Kết Luận

Không có `[BLOCKER]` hay `[MAJOR]`; 1 `[MINOR]` về diễn đạt, xử lý khi code. Critic Pass (`CRITIC_REQUIRED yes`) được PM miễn như Audit Run 1. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]
