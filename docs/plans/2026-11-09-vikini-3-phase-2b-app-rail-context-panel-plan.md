# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 2B: Thanh Icon 64px, Panel Ngữ Cảnh & Tách Sidebar

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-09
- **Author**: Claude Code (in-session, PM yêu cầu không chạy CLI planner) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: `docs/plans/2026-11-09-vikini-3-phase-2a-appframe-navigation-plan.md` (2A — đã code + QA tự động, chưa commit)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: `docs/specs/2026-11-08-vikini-3-redesign-brief.md` mục "Layout & components" → **AppShell** ("fixed 64px icon rail … + per-section context panel"), canvas board **Chat** (artifact `EX6CrQpyty54jcm8LAeeGN`), audit C5 (CTA sidebar đổi theo trang) và H1 (Novelcrafter cần "focus mode").

1. **`AppRail` (desktop ≥ md)**: thanh dọc 64px cố định bên trái, nút 44×44px có `aria-label` + tooltip, theo thứ tự canvas: **Đoạn chat mới** (nền `--accent`, luôn là chat mới — hết đổi nhãn theo trang), **Chat**, **Gems & Persona**, **Ảnh**, **Novelcrafter**; nhóm dưới: **Lệnh nhanh ⌘K** (chỉ khi trang có Command Palette), **Cài đặt** (ngôn ngữ + `ThemeMenuItems`), **Tài khoản** (Admin nếu `rank === "admin"`, Đăng xuất). Mục đang ở có `aria-current="page"` + nền `--soft`/chữ `--accent`.
2. **`ContextPanel` (desktop)**: panel 272px cạnh rail, chứa nội dung theo khu vực (Chat: dự án + danh sách đoạn chat; Ảnh: dự án Studio; Novelcrafter: danh sách truyện) với nút chính **riêng của khu vực** ("Dự án mới", "Truyện mới"). Thu gọn = **ẩn hẳn panel** (rail vẫn còn) thay cho chế độ "sidebar icon" hiện tại.
3. **Trạng thái layout dùng chung, nhớ qua trang**: `useLayoutStore` (zustand + `persist`) giữ `panelCollapsed`; 4 nơi đang tự giữ `sidebarCollapsed` + chuỗi padding lặp lại dùng chung một helper.
4. **Novelcrafter focus mode**: lần đầu vào Novelcrafter panel tự thu gọn (chỉ còn rail) — người dùng mở lại được, lựa chọn được nhớ riêng cho Novelcrafter.
5. **Header desktop gọn**: logo, ngôn ngữ, theme đã nằm trên rail → `HeaderBar` chỉ hiện trên mobile (`hideOnDesktop` mặc định ở các trang có rail).
6. **Mobile**: giữ drawer 2A; drawer liệt kê các mục rail (có nhãn) + nội dung panel của khu vực hiện tại.
7. **Tách `Sidebar.tsx`** (645 dòng > giới hạn 500) thành rail / panel / drawer / danh sách mục điều hướng; xóa chế độ "collapsed icon" và `SidebarButton` collapsed tooltip.

**Out of Scope (What We're NOT Doing)**:

- Mục **"Dự án"** riêng trên rail (canvas có) — xem `[NEEDS_PRODUCT_DECISION]` D1; 2B giữ dự án trong panel của Chat.
- Command Palette dùng toàn cục (hiện chỉ Chat có, `src/app/features/chat/components/ChatOverlays.tsx:73-76`) → rail chỉ hiện nút ⌘K ở Chat; toàn cục ở Giai đoạn 3.
- Header chat 60px có tiêu đề hội thoại, tìm kiếm/nhóm theo ngày trong danh sách chat (canvas) → Giai đoạn 3.
- Novelcrafter: toolbar, Viết/Dàn ý/Hồ sơ → Giai đoạn 5. Gems/Personas dạng lưới → Giai đoạn 6.
- Đổi route/URL; đổi API.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                              | Nội dung rút ra                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`, `.agents/rules/01-coding.md` | Giới hạn 500 dòng UI / 350 dòng hook, co-located test, cấm `any`                                                |
| `.agents/rules/03-ui.md`                                 | `AppFrame`/`PageHeader` (2A), Radix cho menu/dialog, `aria-current`, `focus-visible:ring-(--ring)`              |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md`       | AppShell rail 64px + context panel, thứ tự mục rail                                                             |
| Canvas board Chat (artifact `EX6CrQpyty54jcm8LAeeGN`)    | Nút rail 44×44, bo 12px; mục hiện tại `--soft`/`--accent`; nút chat mới nền `--accent`; panel 272px "Đoạn chat" |
| `src/app/features/sidebar/components/Sidebar.tsx`        | Cấu trúc hiện tại (xem A1–A4)                                                                                   |
| `src/lib/store/projectStore.ts`                          | Tiền lệ `zustand/middleware` `persist`                                                                          |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                       | Quyết định kỹ thuật chịu ảnh hưởng                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.agents/skills/vikini-investigate/SKILL.md` | `Sidebar` có 4 caller + 1 test lớn                              | Giữ **API props của `Sidebar`** (A2) để 4 caller chỉ đổi tối thiểu; `Sidebar` thành lớp ghép rail + panel + drawer |
| `.agents/skills/vikini-simplify/SKILL.md`    | 4 bản sao state collapse + chuỗi padding; chế độ collapsed-icon | Gộp vào `useLayoutStore` + `getShellPaddingClass()`; xóa nhánh `isCollapsed`                                       |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn rail mới                                                   | Thêm key vào **cả** `vi.ts`/`en.ts`, tái dùng key có sẵn khi được                                                  |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                                                                                                     | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `Sidebar.tsx` gồm: `SidebarButton` (có nhánh tooltip khi collapsed), hàm render `renderSidebarContent(isMobile)` với khối nút điều hướng, nút chính, vùng dự án/chat, footer (Xóa tất cả, Thu gọn, Admin, Đăng xuất); desktop `<nav>` + drawer Radix | `[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:112`, `src/app/features/sidebar/components/Sidebar.tsx:285-288`, `src/app/features/sidebar/components/Sidebar.tsx:366-376`, `src/app/features/sidebar/components/Sidebar.tsx:493-535`                                                                                                                                                          |
| A2  | 4 caller của `Sidebar`; Image Studio và Novelcrafter đổi nhãn nút chính qua `newChatLabel`                                                                                                                                                           | `[SRC]` `src/app/features/chat/components/ChatApp.tsx:241`, `src/app/features/image-gen/components/ImageGenStudio.tsx:141`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:289`, `src/app/features/layout/components/AppFrame.tsx:26`; `src/app/features/image-gen/components/ImageGenStudio.tsx:152`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:300`    |
| A3  | Chuỗi padding theo trạng thái collapse bị lặp ở 4 nơi; state collapse tự giữ ở mỗi trang (mất khi chuyển trang)                                                                                                                                      | `[SRC]` `src/app/features/chat/components/ChatApp.tsx:264`, `src/app/features/image-gen/components/ImageGenStudio.tsx:166-167`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:320-321`, `src/app/features/layout/components/AppFrame.tsx:10-11`; `src/app/features/chat/components/hooks/useChatLayoutState.ts:28`, `src/app/features/image-gen/components/ImageGenStudio.tsx:41` |
| A4  | Nút Gems/Persona hiện chỉ hiện ở `/` và mở **modal** (`openGemModal`/`openPersonaModal`); dự án bị ẩn ở `/images` và `/novelcrafter`                                                                                                                 | `[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:297-310`, `src/app/features/sidebar/components/Sidebar.tsx:397-400`                                                                                                                                                                                                                                                                            |
| A5  | Store dùng `persist` của zustand đã có tiền lệ                                                                                                                                                                                                       | `[SRC]` `src/lib/store/projectStore.ts:5`, `src/lib/store/projectStore.ts:54`                                                                                                                                                                                                                                                                                                                           |
| A6  | Command Palette chỉ được render trong Chat                                                                                                                                                                                                           | `[SRC]` `src/app/features/chat/components/ChatOverlays.tsx:73-76`                                                                                                                                                                                                                                                                                                                                       |
| A7  | `HeaderBar` đã có prop `hideOnDesktop`                                                                                                                                                                                                               | `[SRC]` `src/app/features/layout/components/HeaderBar.tsx:25`                                                                                                                                                                                                                                                                                                                                           |

**Cross-Task Dependencies**: cần Giai đoạn 1 (token) và 2A (`AppFrame`, nút ☰) trong nhánh. Giai đoạn 3 sẽ thêm header chat 60px vào vùng nội dung bên phải panel và Command Palette toàn cục (nút ⌘K của rail khi đó hiện ở mọi trang).

**Quyết định sản phẩm (Default Assumption nếu PM không phản hồi)**:

- `[NEEDS_PRODUCT_DECISION]` **D1 — Mục "Dự án" trên rail**: _Default_: **không** có ở 2B (dự án nằm trong panel Chat như hiện nay). Phương án khác: thêm mục rail mở panel chỉ có dự án.
- `[NEEDS_PRODUCT_DECISION]` **D2 — Gems & Persona trên rail**: _Default_: dẫn tới trang `/gems` (đã có khung chung từ 2A); trang Gems có link "Persona" trong `PageHeader` actions. Modal Gems/Persona vẫn mở được từ composer như cũ.
- `[NEEDS_PRODUCT_DECISION]` **D3 — Novelcrafter focus mode**: _Default_: panel thu gọn ở lần đầu vào Novelcrafter; sau đó nhớ lựa chọn riêng cho Novelcrafter (`panelCollapsedBySection.novelcrafter`).

### 4. Bảng Verified Versions

| Thư viện / Công cụ                                                      | `package.json` | Phiên bản cài       | Ghi chú                                                      | Nguồn                                                        |
| ----------------------------------------------------------------------- | -------------- | ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `zustand`                                                               | có sẵn         | đang dùng `persist` | Store layout nhớ qua trang, key localStorage `vikini-layout` | `[SRC]` `src/lib/store/projectStore.ts:54`                   |
| `@radix-ui/react-dropdown-menu` (qua `components/ui/dropdown-menu.tsx`) | có sẵn         | —                   | Menu Cài đặt / Tài khoản trên rail                           | `[SRC]` `src/components/ui/dropdown-menu.tsx:116-136`        |
| `@radix-ui/react-tooltip` (qua `components/ui/tooltip.tsx`)             | có sẵn         | —                   | Tooltip nhãn nút rail                                        | `[SRC]` `src/app/features/sidebar/components/Sidebar.tsx:14` |
| `next`                                                                  | `^16.4.0`      | 16.4.0              | `usePathname` cho `aria-current`                             | `[SRC]` `node_modules/next/package.json:3`                   |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**Store & helper**

- `[NEW]` `src/lib/store/layoutStore.ts` — `panelCollapsedBySection: Record<ShellSection, boolean>`, `setPanelCollapsed(section, value)`, `togglePanel(section)`; `persist` key `vikini-layout`; mặc định `{ chat: false, images: false, novelcrafter: true, pages: false }` (D3).
- `[NEW]` `src/lib/store/layoutStore.test.ts`
- `[NEW]` `src/lib/utils/safeStorage.ts` — **(Revision 2)** `safeLocalStorage: StateStorage` dùng chung, viết theo mẫu `src/lib/features/novelcrafter/promptStudioStore.ts:40-60` (bắt lỗi Safari private / quota / JSON hỏng, log `console.warn` qua `logger`). **Không** sửa `promptStudioStore.ts`: bản của Prompt Studio có logic riêng (`isRecordingPersistError`, ghi lỗi vào store) — gộp để Giai đoạn 6.
- `[NEW]` `src/lib/utils/safeStorage.test.ts`
- `[NEW]` `src/app/features/layout/utils/shellNav.ts` — `ShellSection`, `RAIL_ITEMS` (id, href, icon, labelKey, `match(pathname)`), `getSectionForPath(pathname)`, `getShellPaddingClass(collapsed)`.
- `[NEW]` `src/app/features/layout/utils/shellNav.test.ts`

**Component**

- `[NEW]` `src/app/features/sidebar/components/AppRail.tsx` — rail 64px (§6.2).
- `[NEW]` `src/app/features/sidebar/components/AppRail.test.tsx`
- `[NEW]` `src/app/features/sidebar/components/RailMenus.tsx` — `RailSettingsMenu` (ngôn ngữ + `ThemeMenuItems`), `RailAccountMenu` (Admin, Đăng xuất).
- `[NEW]` `src/app/features/sidebar/components/ContextPanelContent.tsx` — nút chính của khu vực + dự án + danh sách chat (phần giữa của `renderSidebarContent` hiện tại, bỏ nhánh collapsed).
- `[NEW]` `src/app/features/sidebar/components/MobileNavDrawer.tsx` — drawer Radix hiện tại (chuyển nguyên logic kéo-đóng `shouldCloseDrawer`) + danh sách mục rail có nhãn + `ContextPanelContent`.
- `[MODIFY]` `src/app/features/sidebar/components/Sidebar.tsx` — còn là lớp ghép: `<AppRail/>` + `<aside aria-label>` panel 272px (ẩn khi collapsed; landmark `complementary`, nhãn "Danh sách đoạn chat"/theo khu vực như canvas) + `<MobileNavDrawer/>`; giữ nguyên interface `SidebarProps` (prop `collapsed`/`onToggleCollapse` vẫn nhận, nay điều khiển panel). Mục tiêu < 250 dòng.
- `[MODIFY]` `src/app/features/sidebar/components/Sidebar.test.tsx` — cập nhật theo cấu trúc mới (Loại C), thêm TC-08…TC-10.
- `[MODIFY]` `src/app/features/layout/components/AppFrame.tsx` — dùng `useLayoutStore` + `getShellPaddingClass`; `HeaderBar hideOnDesktop`.
- `[MODIFY]` `src/app/features/layout/hooks/useAppFrameState.ts` — bỏ `sidebarCollapsed`/`toggleCollapsed` (chuyển sang store).
- `[MODIFY]` `src/app/features/layout/hooks/useAppFrameState.test.ts`, `src/app/features/layout/components/AppFrame.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatApp.tsx` — padding qua helper; truyền `onOpenCommandPalette={shortcuts.openCommandPalette}`; `HeaderBar hideOnDesktop`.
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatShortcuts.ts` — **(Revision 2)** thêm `openCommandPalette` vào giá trị trả về (`src/app/features/chat/components/hooks/useChatShortcuts.ts:65-71`).
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatShortcuts.test.ts` — TC-11.
- `[MODIFY]` `src/app/features/chat/components/hooks/useChatLayoutState.ts` — collapse đọc/ghi `useLayoutStore` (giữ tên trả về `sidebarCollapsed`, `memoizedOnToggleCollapse` để caller không đổi).
- `[MODIFY]` `src/app/features/image-gen/components/ImageGenStudio.tsx` — như trên; `newChatLabel` → `sectionActionLabel`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` — như trên (section `novelcrafter`, D3).
- `[MODIFY]` `src/app/features/gems/components/GemManager.tsx` — link "Persona" trong actions khi không ở modal (D2).

**i18n**

- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts` — `railMain` ("Điều hướng chính"), `railGemsPersonas`, `railImages`, `railCommandPalette`, `railSettings`, `railAccount`, `panelShow`, `panelHide` (tái dùng `newChat`, `chat`, `novelcrafterStudio`, `signOut`, `adminManagement`, `language`).

**Living docs**

- `[MODIFY]` `.agents/rules/03-ui.md` — mục "Page structure": rail + panel, `useLayoutStore`, không tự giữ state collapse trong trang (→ Critic Pass).
- `[MODIFY]` `docs/architecture.md`, `docs/CHANGELOG.md`

### 6. Caller-First Design Sketch

**6.1 Caller không đổi API**

```tsx
// ImageGenStudio.tsx — chỉ đổi 2 dòng
<Sidebar … sectionActionLabel={t("studioNewProject")} onSectionAction={createStudioProject} />
<div className={cn("flex-1 …", getShellPaddingClass(panelCollapsed))}>
```

`onNewChat` vẫn là hành động của **nút "Đoạn chat mới" trên rail** (luôn tạo chat). Nút chính trong panel dùng `onSectionAction ?? onNewChat` và nhãn `sectionActionLabel ?? t("newChat")`.

**6.2 `AppRail`**

```tsx
<nav
  aria-label={t("railMain")}
  className="hidden md:flex fixed inset-y-0 left-0 w-16 pl-[var(--sal,0px)] flex-col items-center gap-1.5 py-3 bg-(--surface) border-r border-(--line) z-30"
>
  <RailButton label={t("newChat")} icon={Plus} onClick={onNewChat} tone="accent" />
  <div className="h-px w-8 bg-(--line) my-1" />
  {RAIL_ITEMS.map((item) => (
    <RailLink
      key={item.id}
      href={item.href}
      label={t(item.labelKey)}
      icon={item.icon}
      current={item.match(pathname)}
    /> // aria-current="page" + bg-(--soft) text-(--accent)
  ))}
  <div className="flex-1" />
  {onOpenCommandPalette && (
    <RailButton label={t("railCommandPalette")} icon={Command} onClick={onOpenCommandPalette} />
  )}
  <RailSettingsMenu />
  <RailAccountMenu session={session} onLogout={onLogout} />
</nav>
```

`RailButton`/`RailLink`: `h-11 w-11 rounded-xl`, `Tooltip side="right"` với nhãn; `focus-visible:ring-2 ring-(--ring)`. Nút "ẩn/hiện panel" đặt ở đầu panel (canvas: "Thu gọn danh sách") và trên rail khi panel đang ẩn.

**6.3 `shellNav.ts`**

```ts
export type ShellSection = "chat" | "images" | "novelcrafter" | "pages";
export const RAIL_ITEMS: readonly RailItem[] = [
  {
    id: "chat",
    href: "/",
    icon: MessageSquare,
    labelKey: "chat",
    match: (p) => p === "/" || p.startsWith("/projects"),
  },
  {
    id: "gems",
    href: "/gems",
    icon: Sparkles,
    labelKey: "railGemsPersonas",
    match: (p) => p.startsWith("/features/gems") || p.startsWith("/features/personas"),
  },
  {
    id: "images",
    href: "/images",
    icon: ImageIcon,
    labelKey: "railImages",
    match: (p) => ["/images", "/gallery", "/describe"].some((r) => p.startsWith(r)),
  },
  {
    id: "novelcrafter",
    href: "/novelcrafter",
    icon: BookOpen,
    labelKey: "novelcrafterStudio",
    match: (p) => p.startsWith("/novelcrafter"),
  },
];
export function getSectionForPath(pathname: string | null): ShellSection;
export function getShellPaddingClass(panelCollapsed: boolean): string;
// rail 4rem (+ panel 17rem khi mở) + safe-area trái; chỉ áp từ md
```

**6.4 `layoutStore.ts`**

```ts
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      panelCollapsedBySection: { chat: false, images: false, novelcrafter: true, pages: false },
      setPanelCollapsed: (section, value) =>
        set((s) => ({
          panelCollapsedBySection: { ...s.panelCollapsedBySection, [section]: value },
        })),
      togglePanel: (section) =>
        set((s) => ({
          panelCollapsedBySection: {
            ...s.panelCollapsedBySection,
            [section]: !s.panelCollapsedBySection[section],
          },
        })),
    }),
    {
      name: "vikini-layout",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      skipHydration: true, // (Revision 2) SSR và render đầu ở client cùng dùng giá trị mặc định
      merge: mergeLayoutState, // chỉ nhận boolean cho 4 section đã biết
    }
  )
);

// AppRail (luôn mount trên mọi trang có khung) — chạy 1 lần sau hydrate của React
useEffect(() => {
  void useLayoutStore.persist.rehydrate();
}, []);
```

**(Revision 2)** `zustand@5.0.10` `persist` mặc định hydrate **đồng bộ** lúc tạo store (`node_modules/zustand/esm/middleware.mjs:466`) → nếu không `skipHydration`, render đầu ở client đã khác HTML server và class padding bị lệch khi hydrate. Theo tiền lệ `src/lib/features/novelcrafter/promptStudioStore.ts:130`: `skipHydration` + `rehydrate()` sau mount; panel có thể "nhảy" 1 frame từ mặc định sang giá trị đã lưu — chấp nhận (transition padding 300ms đã có).

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: `layoutStore.test.ts`, `shellNav.test.ts`, `safeStorage.test.ts`, `AppRail.test.tsx`, ca mới trong `Sidebar.test.tsx` và `useChatShortcuts.test.ts` → **đỏ**.
- [ ] **B2 — `safeStorage.ts` (theo mẫu Prompt Studio) + `shellNav.ts` + `layoutStore.ts`**; `useChatShortcuts.openCommandPalette`.
- [ ] **B3 — `AppRail` + `RailMenus`**.
- [ ] **B4 — Tách `Sidebar.tsx`**: `ContextPanelContent`, `MobileNavDrawer`, lớp ghép; xóa nhánh collapsed-icon; cập nhật `Sidebar.test.tsx` (Loại C, giữ mọi ca drawer/gesture).
- [ ] **B5 — 4 caller**: padding helper + store; `sectionActionLabel`; `HeaderBar hideOnDesktop`; nút ⌘K ở Chat.
- [ ] **B6 — Gems link Persona** (D2).
- [ ] **B7 — i18n** + `npm run type-check`.
- [ ] **B8 — Living docs**.
- [ ] **B9 — Verify** theo §9 + QA Playwright (script QA của 2A, thêm kiểm rail).

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC                   | File                       | Input                                                                                                              | Kỳ vọng                                                                                                                                            |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01                | `shellNav.test.ts`         | `/`, `/projects/x`, `/gallery`, `/describe`, `/novelcrafter/prompts`, `/features/personas`, `/admin`               | `getSectionForPath` → `chat`, `chat`, `images`, `images`, `novelcrafter`, `pages`, `pages`; mỗi path khớp **đúng 1** hoặc 0 mục rail               |
| TC-02                | `shellNav.test.ts`         | `getShellPaddingClass(false/true)`                                                                                 | Chứa `md:pl-[calc(21rem+var(--sal,0px))]` / `md:pl-[calc(4rem+var(--sal,0px))]`; không chứa class áp ở mobile (không có `pl-` thiếu tiền tố `md:`) |
| TC-03                | `layoutStore.test.ts`      | mặc định                                                                                                           | `novelcrafter: true`, còn lại `false`                                                                                                              |
| TC-04                | `layoutStore.test.ts`      | `togglePanel("chat")` 2 lần; `setPanelCollapsed("images", true)`                                                   | Đúng giá trị; section khác không đổi                                                                                                               |
| TC-05 (**Negative**) | `layoutStore.test.ts`      | localStorage `vikini-layout` = JSON hỏng / `{"state":{"panelCollapsedBySection":{"chat":"yes","__proto__":true}}}` | Rơi về mặc định cho key sai kiểu; không thêm key lạ                                                                                                |
| TC-06                | `AppRail.test.tsx`         | pathname `/gallery`                                                                                                | Mục "Ảnh" có `aria-current="page"`; các mục khác không có; mọi nút/link có tên truy cập được                                                       |
| TC-07                | `AppRail.test.tsx`         | click "Đoạn chat mới"                                                                                              | Gọi `onNewChat` 1 lần; không có `onOpenCommandPalette` → không có nút ⌘K (Negative)                                                                |
| TC-08                | `Sidebar.test.tsx`         | `collapsed={true}`                                                                                                 | Không render panel 272px; rail vẫn có                                                                                                              |
| TC-09                | `Sidebar.test.tsx`         | `sectionActionLabel="Truyện mới"`                                                                                  | Nút chính trong panel mang nhãn "Truyện mới"; nút rail vẫn là "Đoạn chat mới"                                                                      |
| TC-10                | `Sidebar.test.tsx`         | `session.user.rank` = `admin` / `pro`                                                                              | Menu tài khoản có / không có mục Admin                                                                                                             |
| TC-11                | `useChatShortcuts.test.ts` | gọi `openCommandPalette()`                                                                                         | `isCommandPaletteOpen === true`; `closeCommandPalette()` → `false`                                                                                 |
| TC-12                | `layoutStore.test.ts`      | localStorage có `{"state":{"panelCollapsedBySection":{"chat":true}},"version":1}` trước khi import                 | Trước `rehydrate()`: `chat === false` (mặc định, khớp SSR); sau `rehydrate()`: `chat === true`                                                     |
| TC-13                | `safeStorage.test.ts`      | `localStorage.setItem` ném lỗi (giả lập quota); `getItem` trả chuỗi không phải JSON                                | `setItem` không ném; `getItem` → `null` (Negative)                                                                                                 |

**Pass/fail**: 100% xanh; giữ nguyên các ca drawer/gesture hiện có của `Sidebar.test.tsx`; chỉ thay ca gắn với chế độ collapsed-icon (Loại C, liệt kê trong commit).

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/lib/store src/app/features/layout src/app/features/sidebar --reporter=dot
npm run type-check; npm run lint; npm run test:run
```

**Wiring Probes**

| #   | Probe                                                                                                                                          | Kỳ vọng            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| W1  | Grep `md:pl-\[calc(5rem\|md:pl-\[calc(18rem` trong `src/`                                                                                      | 0 (chỉ còn helper) |
| W2  | Grep `useState(false)` gắn với `sidebarCollapsed` trong `src/app`                                                                              | 0                  |
| W3  | `wc -l src/app/features/sidebar/components/Sidebar.tsx`                                                                                        | < 250              |
| W4  | QA Playwright 1440px: rail có 5 mục + menu; panel ẩn/hiện; chuyển `/` → `/gallery` → panel giữ trạng thái; `/novelcrafter` lần đầu chỉ có rail | Đúng               |
| W5  | QA 375px: không thấy rail; drawer có mục rail có nhãn                                                                                          | Đúng               |

**Negative Probes**

| #   | Probe                                                | Kỳ vọng          |
| --- | ---------------------------------------------------- | ---------------- |
| N1  | Tạm bỏ `aria-current` trong `RailLink` → TC-06       | **đỏ**; hoàn tác |
| N2  | Tạm bỏ kiểm tra kiểu trong `merge` của store → TC-05 | **đỏ**; hoàn tác |
| N3  | Tạm đổi mặc định `novelcrafter: false` → TC-03       | **đỏ**; hoàn tác |

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                   | Mức        | Control                                                                                                                                                                                                       |
| -------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tách `Sidebar.tsx` làm hỏng drawer kéo-đóng / focus-trap | Cao        | Chuyển nguyên khối Radix + `shouldCloseDrawer`; giữ toàn bộ ca test drawer/gesture hiện có; QA 375px                                                                                                          |
| `persist` gây lệch hydrate (SSR mặc định khác client)    | Trung bình | **(Revision 2)** `skipHydration: true` + `rehydrate()` trong `useEffect` của `AppRail` (tiền lệ `src/lib/features/novelcrafter/promptStudioStore.ts:130`); TC-12; QA kiểm console không có cảnh báo hydration |
| Mất lối vào Persona khi bỏ nút cạnh "Chat"               | Trung bình | D2: link Persona trong trang Gems; modal từ composer giữ nguyên                                                                                                                                               |
| Người dùng quen sidebar rộng có nhãn                     | Thấp       | Tooltip + nhãn đầy đủ trong drawer mobile; panel vẫn có nhãn                                                                                                                                                  |
| Desktop mất header (logo/ngôn ngữ/theme)                 | Thấp       | Rail có Cài đặt (ngôn ngữ + theme); logo ở đầu rail dạng nút "Đoạn chat mới"/link `/`                                                                                                                         |

### Lộ Trình

| Bước | Nội dung                                                                                    |
| ---- | ------------------------------------------------------------------------------------------- |
| 3    | Header chat 60px, Command Palette toàn cục, composer, model picker (C1, C3, H2, H6, M1, M2) |
| 4    | Ảnh: tabs Tạo ảnh / Thư viện / Mô tả ảnh (M3, M5)                                           |
| 5    | Novelcrafter theo canvas (H1)                                                               |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô, gỡ alias token        |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định "Tự review ở đây")]

#### 1. Output verify-plan.mjs

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-09-vikini-3-phase-2b-app-rail-context-panel-plan.md` → `SECTIONS 7/7`, mọi `LINE_REF` PASS, `CRITIC_REQUIRED yes`, `VERIFY_PLAN: PASS`.
- Đối chiếu source: A1–A7 khớp (`Sidebar.tsx` 645 dòng, 4 caller, 4 bản sao padding, `persist` ở `projectStore`, Palette chỉ ở Chat, `hideOnDesktop`).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                        | Bằng chứng                                                                                                                                                                                              | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                                                                                                 |
| --- | -------------- | ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/lib/features/novelcrafter/promptStudioStore.ts:130`           | [SRC] `zustand@5.0.10` `persist` tự hydrate **đồng bộ** khi tạo store trừ khi `skipHydration` (`node_modules/zustand/esm/middleware.mjs:466`); repo đã có tiền lệ `skipHydration: true` + `rehydrate()` | §6.4/§10 dựa vào `hasHydrated` — nhưng trên client store đã mang giá trị localStorage ngay render đầu, khác HTML server → class padding/panel lệch khi hydrate (React 19 không vá thuộc tính lệch). **Sửa**: `skipHydration: true`, gọi `useLayoutStore.persist.rehydrate()` trong `useEffect` ở một chỗ (`AppRail`), test hydrate. |
| 2   | DEFECT         | [MAJOR] | `src/app/features/chat/components/hooks/useChatShortcuts.ts:65-71` | [SRC] Hook chỉ trả `isCommandPaletteOpen`, `closeCommandPalette` — **không có** hàm mở                                                                                                                  | §6.1/§5 nói Chat truyền `onOpenCommandPalette` nhưng không khai báo sửa `useChatShortcuts.ts` (+ test) → thiếu file trong scope, nút ⌘K không có handler. **Sửa**: thêm `[MODIFY]` `useChatShortcuts.ts` + `useChatShortcuts.test.ts` (`openCommandPalette`).                                                                       |
| 3   | DEFECT         | [MINOR] | `src/lib/features/novelcrafter/promptStudioStore.ts:40`            | [SRC] `safeLocalStorage` là `const` nội bộ                                                                                                                                                              | Store mới cần storage an toàn (Safari private mode / quota). Ghi rõ: tách `safeLocalStorage` ra `src/lib/utils/safeStorage.ts` (+ test) và dùng lại ở cả hai store, hoặc chấp nhận bản sao.                                                                                                                                         |
| 4   | RISK_DISMISSED | —       | `src/app/features/sidebar/components/Sidebar.tsx:546`              | [SRC] 2A TC-09 khẳng định `NAV` desktop có class `md:flex`                                                                                                                                              | Rail mới là `<nav className="hidden md:flex …">` → TC-09 vẫn đúng; panel đổi sang `<aside aria-label>` không vi phạm (landmark `complementary` có nhãn).                                                                                                                                                                            |

#### Kết Luận

2 `[MAJOR]` (#1, #2) → cần Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định); Critic Pass miễn theo cách PM đã chọn ở các plan trước — PM có thể yêu cầu chạy]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-09-vikini-3-phase-2b-app-rail-context-panel-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` → **đã xử lý**: §6.4 dùng `skipHydration: true` + `rehydrate()` sau mount, có TC-12 kiểm giá trị trước/sau rehydrate; bảng rủi ro cập nhật.
- Audit Run 1 #2 `[MAJOR]` → **đã xử lý**: §5 có `[MODIFY]` `useChatShortcuts.ts` + test, TC-11.
- Audit Run 1 #3 `[MINOR]` → **đã xử lý**: `safeStorage.ts` mới theo mẫu, không đụng `promptStudioStore.ts` (có lý do), TC-13.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                             | Bằng chứng                                                                              | Lý do / Hướng xử lý khi code                                                                                                                                                                      |
| --- | -------------- | ------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `node_modules/zustand/esm/middleware.mjs:451`           | [SRC] `rehydrate: () => hydrate()` đọc lại storage mỗi lần gọi                          | `AppRail` mount lại ở mỗi lần chuyển trang → `rehydrate()` chạy nhiều lần. Vô hại (storage luôn bằng state vì persist ghi ngay) nhưng nên chặn bằng cờ module (`let rehydrated = false`) cho gọn. |
| 2   | RISK_DISMISSED | —       | `src/app/features/sidebar/components/Sidebar.tsx:546`   | [SRC] Phần tử desktop dùng `hidden md:flex` — vẫn mount trên mobile                     | `useEffect` rehydrate trong `AppRail` vẫn chạy trên mobile dù rail bị ẩn bằng CSS → trạng thái panel vẫn được nạp khi người dùng xoay/mở rộng màn hình.                                           |
| 3   | RISK_DISMISSED | —       | `src/lib/features/novelcrafter/promptStudioStore.ts:40` | [SRC] `safeLocalStorage` của Prompt Studio gắn `isRecordingPersistError` + logger riêng | Không gộp ở 2B là đúng phạm vi; bản sao nhỏ (< 40 dòng) có test riêng; gộp ở Giai đoạn 6.                                                                                                         |
| 4   | RISK_ACCEPTED  | [MINOR] | `src/app/features/chat/components/ChatApp.tsx:264`      | [SRC] Padding chuyển tiếp `transition-[padding] duration-300`                           | Với `skipHydration`, người dùng đã lưu "panel ẩn" sẽ thấy panel co lại 1 lần sau khi tải trang (≤ 300ms). Chấp nhận; QA ghi nhận.                                                                 |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. 2 `[MINOR]` xử lý khi code. Test Contract có ca âm tính (TC-02, TC-05, TC-07, TC-13) và Negative Probe N1–N3; logic mới trong `src/lib/` (`layoutStore`, `safeStorage`) có test co-located. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]
