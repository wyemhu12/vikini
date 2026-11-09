# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 3A: Model Picker Dạng Command, Command Palette Toàn Cục, Tên Model Cũ

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-09
- **Author**: Claude Code (in-session, PM yêu cầu không chạy CLI planner) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: `docs/plans/2026-11-09-vikini-3-phase-2b-app-rail-context-panel-plan.md` (2B — đã code + QA, chưa commit)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: `docs/specs/2026-11-08-vikini-3-redesign-brief.md` mục "Model picker" ("Command-style list with search, filters, Gần đây, grouped by provider; bottom sheet on mobile"), canvas board **ModelPicker** (artifact `EX6CrQpyty54jcm8LAeeGN`), audit C1, M1, M2. Giai đoạn 3 của brief được chia: **3A** (plan này) = các bề mặt "chọn & ra lệnh"; **3B** = luồng tin nhắn + composer (H2, H6, header chat); **3C** = tên truy cập cho control icon-only (C3) + test axe.

1. **C1 — Model picker mới** (thay nội dung `ModelSelector`):
   - Một danh sách duy nhất có **ô tìm kiếm** (tên model, nhà cung cấp, mô tả đã dịch), **bộ lọc** dạng nút bật/tắt `aria-pressed`: Tất cả / Nhanh (`low-latency`) / Suy luận (`reasoning`) / Miễn phí (`openrouter-free`) / Máy cục bộ (chỉ khi Local LLM hiện diện).
   - Nhóm **"Gần đây"** (tối đa 3 model dùng gần nhất, lưu localStorage) đứng đầu, sau đó nhóm theo nhà cung cấp với tiêu đề nhóm; model không được phép (`isModelAllowed`) hiển thị khóa + lý do, không chọn được.
   - Bàn phím: ↑/↓ di chuyển, Enter chọn, Esc đóng; `role="listbox"`/`option` + `aria-selected`; chân popover gợi ý phím.
   - **Desktop**: Radix Popover có `avoidCollisions` + `collisionPadding` (hết bị cắt mép trên). **Mobile** (< md): mở dạng bottom sheet (`Sheet side="bottom"` có sẵn).
2. **Command Palette toàn cục (M1 + nút ⌘K trên rail ở mọi trang)**: ở các trang ngoài Chat, `Ctrl/⌘K` và nút ⌘K trên rail mở palette với lệnh điều hướng (Đoạn chat mới, Chat, Gems & Persona, Ảnh, Thư viện, Novelcrafter), đổi sáng/tối, đổi ngôn ngữ, mở đoạn chat gần đây. Ở Chat giữ palette hiện có (có lệnh riêng của Chat).
3. **M1 — Sửa palette**: bỏ nhãn "Esc" bị trùng với nút ✕ của Dialog (giữ ✕, thêm `aria-keyshortcuts="Escape"`), bỏ viền focus lồng trong ô input; mục đổi ngôn ngữ hiển thị đích ("Đổi ngôn ngữ → English").
4. **M2 — Tên model cũ / đã ngừng**: avatar và tooltip trong tin nhắn dùng hàm hiển thị chung: alias cũ (`gemini-2.5-flash`, …) → tên model mới + hậu tố "(cũ)"; id không còn trong registry → id gốc + "(đã ngừng)" thay cho chuỗi thô.

**Out of Scope (What We're NOT Doing)**:

- Bộ lọc "Đọc ảnh" của canvas — registry chưa có dữ liệu năng lực ảnh (`SelectableModel` không có trường vision, `src/lib/core/modelRegistry.ts:12-31`); để Giai đoạn 6 khi bổ sung dữ liệu.
- Đổi danh sách model, quyền theo rank, API — không đụng.
- Composer, toggle Web/Thinking, thanh action tin nhắn, header chat (3B). `aria-label` cho các control khác (3C).
- Novelcrafter giữ biến thể `toolbar` của picker (chỉ đổi phần danh sách bên trong, không đổi vị trí).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                                                        | Nội dung rút ra                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/03-ui.md` | Giới hạn kích thước, co-located test, Radix cho popover/dialog, chữ ≥ 12px, `aria-pressed` cho toggle                                                           |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md`                                 | Mô tả model picker và phasing bước 3                                                                                                                            |
| Canvas board ModelPicker                                                           | `role="dialog"` "Chọn model", ô "Tìm model", bộ lọc `aria-pressed`, `role="listbox"` "Danh sách model", `option` + `aria-selected`, chân gợi ý ↑↓ / Enter / Esc |
| `src/app/features/chat/components/ModelSelector.tsx`                               | Cấu trúc hiện tại (A1)                                                                                                                                          |
| `src/lib/core/modelRegistry.ts`, `src/lib/features/novelcrafter/modelDisplay.ts`   | Dữ liệu model, alias, hàm hiển thị đã có (A4, A5)                                                                                                               |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                                    | Quyết định kỹ thuật chịu ảnh hưởng                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` | `ModelSelector` có 2 caller; `resolveModelDisplayInfo` dùng bởi Novelcrafter | Giữ **nguyên props** của `ModelSelector`; hàm hiển thị mới đặt ở `src/lib/core/` và Novelcrafter giữ hàm cũ (không đổi hành vi) |
| `.agents/skills/vikini-simplify/SKILL.md`    | 2 tab "Providers/Service" + logic lọc trùng                                  | Thay bằng 1 hàm thuần `buildModelPickerSections()` có test; xóa state tab                                                       |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn bộ lọc, nhóm, gợi ý phím, "(cũ)"                                        | Thêm key vào **cả** `vi.ts`/`en.ts`                                                                                             |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                   | Bằng chứng                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `ModelSelector` dùng Popover với 2 tab ("providers" mặc định / "service"), chọn provider rồi mới thấy model; `side` cố định theo `expandDown`, không có ô tìm kiếm | `[SRC]` `src/app/features/chat/components/ModelSelector.tsx:85`, `src/app/features/chat/components/ModelSelector.tsx:105-131`, `src/app/features/chat/components/ModelSelector.tsx:188-194` |
| A2  | 2 caller, cùng interface props                                                                                                                                     | `[SRC]` `src/app/features/chat/components/InputModelControls.tsx:21-28`, `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx:205-211`                                          |
| A3  | `SelectableModel` có `category` (`reasoning`/`low-latency`/`local`) và `providerId`; có `PROVIDER_LABELS`                                                          | `[SRC]` `src/lib/core/modelRegistry.ts:12-31`, `src/lib/core/modelRegistry.ts:259`                                                                                                          |
| A4  | Có `MODEL_ALIASES` + `normalizeModelForApi` (chống prototype key bằng `Object.hasOwn`)                                                                             | `[SRC]` `src/lib/core/modelRegistry.ts:319`, `src/lib/core/modelRegistry.ts:369-377`                                                                                                        |
| A5  | Tin nhắn truyền `meta.model` thô vào avatar/tooltip → id cũ hiện nguyên                                                                                            | `[SRC]` `src/app/features/chat/components/ChatBubble.tsx:221`, `src/app/features/chat/components/BubbleAvatar.tsx:92`                                                                       |
| A6  | Palette chỉ được render trong Chat; có nhãn `Esc` riêng cạnh ô input                                                                                               | `[SRC]` `src/app/features/chat/components/ChatOverlays.tsx:73-83`, `src/app/features/chat/components/CommandPalette.tsx:171-173`                                                            |
| A7  | `MainLayout` bọc mọi trang (nơi gắn palette toàn cục)                                                                                                              | `[SRC]` `src/app/features/layout/components/MainLayout.tsx:7`                                                                                                                               |
| A8  | Sheet bottom có sẵn                                                                                                                                                | `[SRC]` `src/components/ui/sheet.tsx:1`                                                                                                                                                     |

**Cross-Task Dependencies**: cần 2B (rail có prop `onOpenCommandPalette`). 3B sẽ đặt picker vào header chat mới; API picker giữ ổn định.

**Quyết định sản phẩm (Default Assumption)**:

- `[NEEDS_PRODUCT_DECISION]` **D1 — Số model "Gần đây"**: _Default_ 3.
- `[NEEDS_PRODUCT_DECISION]` **D2 — Model bị khóa**: _Default_ vẫn hiện (mờ, biểu tượng khóa, "Cần nâng hạng") để người dùng biết model tồn tại; phương án khác: ẩn hẳn.

### 4. Bảng Verified Versions

| Thư viện / Công cụ               | `package.json` | Phiên bản | Ghi chú                                                              | Nguồn                                          |
| -------------------------------- | -------------- | --------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `@radix-ui/react-popover`        | `^1.1.15`      | 1.1.x     | `avoidCollisions` (mặc định true), `collisionPadding`, `side` tự lật | `[SRC]` `package.json:46`                      |
| `@radix-ui/react-dialog` (Sheet) | `^1.1.15`      | 1.1.x     | Bottom sheet mobile + Command Palette                                | `[SRC]` `package.json:43`                      |
| `zustand`                        | có sẵn         | 5.0.10    | Store mở/đóng palette toàn cục                                       | `[SRC]` `node_modules/zustand/package.json:6`  |
| `cmdk`                           | **không có**   | —         | Không thêm thư viện; tự viết listbox nhỏ có test                     | `[CMD]` Grep `"cmdk"` trong `package.json` → 0 |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**Logic (src/lib)**

- `[NEW]` `src/lib/core/modelPicker.ts` — `MODEL_FILTERS`, `filterModels(models, {query, filter, translate})`, `buildModelPickerSections(models, {recentIds, query, filter, isLocalVisible})` (thuần), `resolveChatModelDisplay(modelId)` → `{ name, providerLabel, status: "current" | "legacy" | "retired" }`.
- `[NEW]` `src/lib/core/modelPicker.test.ts`
- `[NEW]` `src/lib/store/recentModelsStore.ts` — `recentModelIds` (≤ 3, mới nhất trước), `pushRecentModel(id)`; `persist` + `safeLocalStorage` + `skipHydration` (theo mẫu `src/lib/store/layoutStore.ts`).
- `[NEW]` `src/lib/store/recentModelsStore.test.ts`
- `[NEW]` `src/lib/store/commandPaletteStore.ts` — `isOpen`, `open()`, `close()`, `toggle()`.
- `[NEW]` `src/lib/store/commandPaletteStore.test.ts`

**UI**

- `[NEW]` `src/app/features/chat/components/ModelPickerList.tsx` — ô tìm, bộ lọc, listbox nhóm, điều hướng phím (dùng chung cho popover & sheet).
- `[NEW]` `src/app/features/chat/components/ModelPickerList.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/ModelSelector.tsx` — giữ trigger + props; nội dung = `ModelPickerList`; desktop Popover (`collisionPadding={12}`), mobile `Sheet side="bottom"`; ghi `pushRecentModel` khi chọn; xóa state tab.
- `[NEW]` `src/app/features/layout/components/GlobalCommandPalette.tsx` — gắn trong `MainLayout`; **(Revision 2)** chỉ hoạt động khi `useSession().status === "authenticated"`, pathname không bắt đầu bằng `/auth` và `getSectionForPath(pathname) !== "chat"`; lắng nghe `Ctrl/⌘K` nhưng **bỏ qua** khi `event.defaultPrevented` hoặc target là `input`/`textarea`/`[contenteditable]` (Quick Edit của Novelcrafter dùng ⌘K, `src/app/features/novelcrafter/hooks/useManuscriptEditor.ts:338-340`); danh sách chat chỉ tải khi palette đang mở (component con chỉ mount khi `isOpen`).
- `[NEW]` `src/app/features/layout/hooks/useIsDesktop.ts` — **(Revision 2)** `matchMedia("(min-width: 768px)")`, trả `true` khi SSR/chưa mount, cập nhật qua `useEffect` + listener `change`.
- `[NEW]` `src/app/features/layout/hooks/useIsDesktop.test.ts`
- `[NEW]` `src/app/features/layout/components/GlobalCommandPalette.test.tsx`
- `[MODIFY]` `src/app/features/layout/components/MainLayout.tsx` — thêm `<GlobalCommandPalette />`.
- `[MODIFY]` `src/app/features/chat/components/CommandPalette.tsx` — nhận `extraCommands?` (lệnh điều hướng), M1 (bỏ `<kbd>Esc</kbd>`, bỏ viền focus input, nhãn ngôn ngữ đích); `onOpenShortcuts` thành tùy chọn.
- `[MODIFY]` `src/app/features/chat/components/CommandPalette.test.tsx` — ca M1.
- `[MODIFY]` `src/app/features/layout/components/AppFrame.tsx` — `onOpenCommandPalette={openPalette}` cho rail.
- `[MODIFY]` `src/app/features/image-gen/components/ImageGenStudio.tsx`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` — truyền `onOpenCommandPalette` từ store.
- `[MODIFY]` `src/app/features/chat/components/ChatBubble.tsx` — `modelName` qua `resolveChatModelDisplay` (M2).
- `[MODIFY]` `src/app/features/chat/components/BubbleAvatar.tsx` — nhận thêm `modelStatus` để hiển thị "(cũ)"/"(đã ngừng)" trong tooltip.

**i18n**: `[MODIFY]` `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts` — `modelPickerSearch`, `modelPickerList`, `modelFilterAll/Fast/Reasoning/Free/Local`, `modelGroupRecent`, `modelPickerHintMove/Select/Close`, `modelLocked`, `modelLegacySuffix`, `modelRetiredSuffix`, `modelPickerEmpty`, `commandGoTo`, `switchLanguageTo`.

**Living docs**: `[MODIFY]` `.agents/rules/03-ui.md` (picker/palette dùng chung, không tự viết popover chọn model) → Critic Pass; `[MODIFY]` `docs/architecture.md`; `[MODIFY]` `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch

**6.1 Caller không đổi**

```tsx
<ModelSelector
  variant="inline"
  currentModelId={m}
  onSelectModel={set}
  isModelAllowed={allowed}
  disabled={false}
  expandDown
/>
```

**6.2 Logic thuần**

```ts
export const MODEL_FILTERS = ["all", "fast", "reasoning", "free", "local"] as const;
export type ModelFilter = (typeof MODEL_FILTERS)[number];

export interface ModelPickerSection {
  id: "recent" | SelectableModel["providerId"];
  labelKey?: TranslationKey;
  label?: string;
  models: SelectableModel[];
}

export function buildModelPickerSections(
  models: readonly SelectableModel[],
  opts: {
    recentIds: readonly string[];
    query: string;
    filter: ModelFilter;
    isLocalVisible: boolean;
    describe: (m: SelectableModel) => string;
  }
): ModelPickerSection[];
// - bỏ local khi !isLocalVisible; lọc theo filter; query không phân biệt hoa thường, bỏ dấu (NFD) trên name/providerLabel/describe(m)
// - "Gần đây" chỉ khi query rỗng & filter "all"; model đã ở "Gần đây" không lặp lại ở nhóm provider
// - nhóm provider theo thứ tự PROVIDER_IDS hiện có; bỏ nhóm rỗng

export function resolveChatModelDisplay(modelId: unknown): {
  name: string;
  providerLabel: string;
  status: "current" | "legacy" | "retired";
};
// current: id có trong SELECTABLE_MODELS; legacy: Object.hasOwn(MODEL_ALIASES, id) → tên model đích; retired: còn lại (giữ id gốc)
```

**6.3 Global palette**

```tsx
// MainLayout: <GlobalCommandPalette />
const pathname = usePathname() ?? "/";
const { status } = useSession();
const enabled =
  status === "authenticated" &&
  !pathname.startsWith("/auth") &&
  getSectionForPath(pathname) !== "chat";
const { isOpen, close, toggle } = useCommandPaletteStore();
useEffect(() => {
  if (!enabled) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isEditableTarget(e.target)) return; // (Revision 2) không tranh ⌘K với Quick Edit / ô nhập
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      toggle();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [enabled, toggle]);
if (!enabled || !isOpen) return null; // chỉ mount (và tải chat) khi mở
return (
  <CommandPalette
    isOpen={isOpen}
    onClose={close}
    onNewChat={() => router.push("/")}
    extraCommands={navCommands}
    conversations={recent}
    onSelectConversation={(id) => router.push(`/?id=${id}`)}
  />
);
```

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: `modelPicker.test.ts`, `recentModelsStore.test.ts`, `commandPaletteStore.test.ts`, `ModelPickerList.test.tsx`, `GlobalCommandPalette.test.tsx`, `useIsDesktop.test.ts`, ca M1 → **đỏ**.
- [ ] **B2 — Logic + store**.
- [ ] **B3 — `ModelPickerList` + `ModelSelector`** (popover desktop, sheet mobile).
- [ ] **B4 — Palette**: `CommandPalette` (M1, `extraCommands`), `GlobalCommandPalette`, `MainLayout`, rail ở `AppFrame`/Studio/Novelcrafter.
- [ ] **B5 — M2**: `ChatBubble`, `BubbleAvatar`.
- [ ] **B6 — i18n**, living docs.
- [ ] **B7 — Verify** §9 + QA Playwright (picker 1440×900 không bị cắt; 375px mở bottom sheet; ⌘K ở `/gallery`).

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                            | Input                                                                                                | Kỳ vọng                                                                                                             |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `modelPicker.test.ts`           | query `""`, filter `all`, recent `[id Claude]`                                                       | Nhóm đầu là `recent` chứa đúng model đó; model đó **không** lặp ở nhóm `anthropic`; không có nhóm rỗng              |
| TC-02 | `modelPicker.test.ts`           | query `"flash lite"` / `"FLASH"` / `"gémini"` (có dấu)                                               | Khớp không phân biệt hoa thường & dấu; không có nhóm `recent` khi có query                                          |
| TC-03 | `modelPicker.test.ts`           | filter `fast` / `reasoning` / `free`                                                                 | Mọi model trả về đúng `category`/`providerId`; filter `local` khi `isLocalVisible=false` → rỗng (Negative)          |
| TC-04 | `modelPicker.test.ts`           | `resolveChatModelDisplay("gemini-2.5-flash")`, id hiện hành, `"gpt-9-x"`, `"__proto__"`, `undefined` | `legacy` + tên Gemini 3.5 Flash-Lite; `current`; `retired` giữ id; `retired` (không dùng prototype); `retired` "AI" |
| TC-05 | `recentModelsStore.test.ts`     | push A, B, C, D, rồi B                                                                               | `[B, D, C]` (≤ 3, không trùng, mới nhất trước); dữ liệu lưu hỏng → `[]` (Negative)                                  |
| TC-06 | `commandPaletteStore.test.ts`   | open/close/toggle                                                                                    | Đúng trạng thái                                                                                                     |
| TC-07 | `ModelPickerList.test.tsx`      | gõ tìm, ↓ ↓ Enter                                                                                    | `onSelect` nhận đúng model thứ 2 trong kết quả; `aria-selected` di chuyển theo                                      |
| TC-08 | `ModelPickerList.test.tsx`      | model không được phép                                                                                | `aria-disabled="true"`, click/Enter **không** gọi `onSelect` (Negative); có chữ "Cần nâng hạng"                     |
| TC-09 | `ModelPickerList.test.tsx`      | bấm bộ lọc "Suy luận"                                                                                | Nút có `aria-pressed="true"`, các nút khác `false`; không còn model `low-latency`                                   |
| TC-10 | `GlobalCommandPalette.test.tsx` | pathname `/gallery`, nhấn Ctrl+K                                                                     | Palette mở, có lệnh "Thư viện"/"Ảnh"; chọn "Novelcrafter" → `router.push("/novelcrafter")`                          |
| TC-11 | `GlobalCommandPalette.test.tsx` | pathname `/`                                                                                         | Không render, Ctrl+K không mở (Negative — tránh trùng palette của Chat)                                             |
| TC-12 | `CommandPalette.test.tsx`       | mở palette                                                                                           | Không có `<kbd>` "Esc"; mục ngôn ngữ ghi "→ English" khi đang `vi`                                                  |
| TC-13 | `GlobalCommandPalette.test.tsx` | **(Revision 2)** Ctrl+K gửi từ `textarea` / `[contenteditable]`, hoặc sự kiện đã `preventDefault`    | Palette **không** mở (Negative)                                                                                     |
| TC-14 | `GlobalCommandPalette.test.tsx` | **(Revision 2)** session `unauthenticated` trên `/gallery`; pathname `/auth/signin`                  | Không render, không gắn phím, không gọi `useConversation` (Negative)                                                |
| TC-15 | `useIsDesktop.test.ts`          | `matchMedia` giả lập 375px rồi 1440px                                                                | `false` rồi `true` sau sự kiện `change`; lần render đầu trả `true`                                                  |

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/lib/core/modelPicker.test.ts src/lib/store src/app/features/chat/components src/app/features/layout --reporter=dot
npm run type-check; npm run lint; npm run test:run
```

**Wiring Probes**: W1 Grep `activeTab` trong `ModelSelector.tsx` → 0. W2 Grep `<kbd` "Esc" trong `CommandPalette.tsx` → 0. W3 QA Playwright: picker 1440×900 nằm trọn trong viewport (`getBoundingClientRect().top ≥ 0`), 375px là sheet đáy; `/gallery` Ctrl+K mở palette; `/` Ctrl+K chỉ mở **một** palette.

**Negative Probes**: N1 tạm bỏ loại trùng "Gần đây" → TC-01 đỏ. N2 tạm bỏ `Object.hasOwn` trong `resolveChatModelDisplay` (dùng `in`) → TC-04 đỏ với `__proto__`. N3 tạm bỏ guard `section === "chat"` → TC-11 đỏ. Hoàn tác sau mỗi probe.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                       | Mức        | Control                                                                                                                |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hai palette cùng mở ở Chat (global + Chat)   | Cao        | Global trả `null` và không gắn phím khi section là `chat`; TC-11; W3                                                   |
| ⌘K tranh với Quick Edit của Novelcrafter     | Cao        | **(Revision 2)** bỏ qua sự kiện `defaultPrevented`/vùng nhập; TC-13; QA gõ ⌘K trong bản thảo                           |
| Palette chạy ở trang đăng nhập (gọi API 401) | Trung bình | **(Revision 2)** chỉ khi `authenticated` và ngoài `/auth`; TC-14                                                       |
| Picker mới làm vỡ Novelcrafter top bar       | Trung bình | Giữ trigger/props; QA Novelcrafter; test hiện có của `InputModelControls` giữ nguyên                                   |
| Tìm kiếm tiếng Việt có dấu                   | Thấp       | Chuẩn hóa NFD + bỏ dấu ở cả query và nguồn; TC-02                                                                      |
| `recentModelsStore` lệch hydrate             | Thấp       | `skipHydration` + rehydrate khi mở picker (giống layoutStore); danh sách "Gần đây" chỉ hiện khi popover mở (sau mount) |
| Model bị khóa vẫn hiện gây bực               | Thấp       | D2; nhãn rõ lý do                                                                                                      |

### Lộ Trình

| Bước | Nội dung                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 3B   | Tin nhắn AI không bong bóng, thanh action icon + "⋯" (H6), composer toggle `aria-pressed` + sheet tùy chọn mobile (H2), header chat 60px |
| 3C   | `aria-label`/tooltip cho control icon-only còn thiếu (C3) + test a11y                                                                    |
| 4    | Ảnh: tabs Tạo ảnh / Thư viện / Mô tả ảnh (M3, M5)                                                                                        |
| 5    | Novelcrafter theo canvas (H1)                                                                                                            |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô, gỡ alias token                                                     |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định "Tự review ở đây")]

#### 1. Output verify-plan.mjs

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-09-vikini-3-phase-3a-model-picker-command-palette-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED yes`, `VERIFY_PLAN: PASS`.
- Đối chiếu source: A1–A8 khớp; `MODEL_ALIASES` có `"gemini-2.5-flash" → "gemini-3.5-flash-lite"` (`src/lib/core/modelRegistry.ts:324`); `Sheet` hỗ trợ `side="bottom"` (`src/components/ui/sheet.tsx:27`).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                    | Bằng chứng                                                                                                                                                                              | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                                                                 |
| --- | -------------- | ------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/novelcrafter/hooks/useManuscriptEditor.ts:338-340`           | [SRC] Editor Novelcrafter đã dùng `Ctrl/⌘K` (mở Quick Edit, `preventDefault` ở keydown của editor)                                                                                      | Listener `window` của palette toàn cục (§6.3) vẫn nhận sự kiện nổi bọt → gõ ⌘K trong bản thảo mở **cả** Quick Edit lẫn palette. **Sửa**: bỏ qua khi `event.defaultPrevented` hoặc target là vùng nhập (`input`, `textarea`, `[contenteditable]`); thêm TC Negative.                                 |
| 2   | DEFECT         | [MAJOR] | `src/app/features/layout/components/MainLayout.tsx:7`                          | [SRC] `MainLayout` bọc **mọi** route, kể cả `src/app/auth/signin/page.tsx`; `useConversation` gọi `useSWR("/api/conversations")` (`src/app/features/chat/hooks/useConversation.ts:218`) | Palette toàn cục sẽ chạy ở trang đăng nhập/lỗi: gọi API khi chưa đăng nhập (401) và cho người chưa đăng nhập lệnh điều hướng. **Sửa**: chỉ kích hoạt khi `useSession().status === "authenticated"` và pathname không bắt đầu bằng `/auth`; chỉ tải danh sách chat khi palette đang mở; TC Negative. |
| 3   | DEFECT         | [MINOR] | `src/app/features/novelcrafter/components/ChapterManuscriptEditor.tsx:183-184` | [SRC] Repo chưa có hook media query dùng chung (chỉ `matchMedia` cục bộ)                                                                                                                | Plan chưa nói cách chọn Popover vs Sheet. Ghi rõ: hook `useIsDesktop()` (`matchMedia("(min-width: 768px)")`, mặc định `true` khi SSR, cập nhật trong `useEffect`) + test.                                                                                                                           |
| 4   | RISK_DISMISSED | —       | `src/lib/core/modelRegistry.ts:376`                                            | [SRC] `normalizeModelForApi` dùng `Object.hasOwn(MODEL_ALIASES, raw)`                                                                                                                   | `resolveChatModelDisplay` theo cùng mẫu là đủ chống `__proto__` (TC-04, N2).                                                                                                                                                                                                                        |

#### Kết Luận

2 `[MAJOR]` → cần Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định); Critic Pass miễn theo cách PM đã chọn ở các plan trước — PM có thể yêu cầu chạy]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-09-vikini-3-phase-3a-model-picker-command-palette-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` → **đã xử lý**: §5/§6.3 bỏ qua `defaultPrevented` và vùng nhập; TC-13; dòng rủi ro mới.
- Audit Run 1 #2 `[MAJOR]` → **đã xử lý**: chỉ khi `authenticated` và ngoài `/auth`; chỉ mount (tải chat) khi palette mở; TC-14.
- Audit Run 1 #3 `[MINOR]` → **đã xử lý**: `useIsDesktop` + TC-15.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                        | Bằng chứng                                                      | Lý do / Hướng xử lý khi code                                                                                                 |
| --- | -------------- | ------- | ------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | —       | `src/app/layout.tsx:58-59`                                         | [SRC] `MainLayout` nằm trong `Providers` (có `SessionProvider`) | `useSession()` trong `GlobalCommandPalette` hợp lệ ở mọi route.                                                              |
| 2   | DEFECT         | [MINOR] | `src/app/features/chat/components/hooks/useChatShortcuts.ts:45-48` | [SRC] Palette của Chat bắt ⌘K kể cả khi đang gõ trong ô nhập    | Hành vi hiện có (người dùng quen ⌘K từ ô chat) nên giữ; ghi chú khác biệt với palette toàn cục trong `03-ui.md`. Không chặn. |
| 3   | RISK_DISMISSED | —       | `src/app/features/chat/hooks/useConversation.ts:218`               | [SRC] SWR key `"/api/conversations"` dùng chung                 | Mount palette khi mở sẽ dùng cache SWR sẵn có từ sidebar (`AppFrame`), không gọi trùng nhiều lần.                            |
| 4   | RISK_ACCEPTED  | [MINOR] | `src/app/features/chat/components/ModelSelector.tsx:188-194`       | [SRC] Popover hiện đặt `side` theo `expandDown`                 | Giữ `side` ưu tiên như cũ, để Radix tự lật khi va mép (`avoidCollisions` mặc định); QA W3 kiểm `top ≥ 0` ở 1440×900.         |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-03, TC-04, TC-05, TC-08, TC-11, TC-13, TC-14) và Negative Probe N1–N3; logic mới trong `src/lib/` có test co-located. Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]
