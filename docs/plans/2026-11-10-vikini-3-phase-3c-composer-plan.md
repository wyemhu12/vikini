# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 3C: Ô Nhập (Composer) — Toggle Có Nhãn, Chip, Sheet Tùy Chọn Mobile, Vệt Stream

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-10
- **Author**: Claude Code (in-session, PM yêu cầu không chạy CLI planner) (`[PLANNER_MODEL: claude-opus-5-5]`)
- **Depends on**: Giai đoạn 1–3B (commit `b34b2a0`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: `docs/specs/2026-11-08-vikini-3-redesign-brief.md` mục "Chat" ("composer dock with labelled toggles (`aria-pressed`), model chip, accent hairline while streaming, one-line disclaimer. Mobile: options bottom sheet"), canvas board **Chat** và **ChatMobile** (artifact `EX6CrQpyty54jcm8LAeeGN`), audit **H2** (thanh điều khiển ô nhập: chữ in hoa "WEB OFF"/"ALWAYS SEARCH OFF", trạng thái chỉ bằng chữ, cuộn ngang trên mobile) và phần còn lại của **H5** (UPPERCASE) trong ô nhập.

1. **Toggle có nhãn (desktop)**: "Tìm web" và "Luôn tìm kiếm" thành nút bật/tắt `aria-pressed`, có icon (Globe / Search) + nhãn chữ thường cố định; trạng thái thể hiện bằng màu (`--accent` viền + nền `--soft` khi bật) **và** `aria-pressed`, không ghép "BẬT/TẮT". Model không hỗ trợ web → nút `disabled` + `title` "Model này không hỗ trợ tìm kiếm web".
2. **Chip theo canvas**: "Suy luận: Vừa", "Gem: Kỹ sư Next.js", "Persona: …" (chưa chọn → "Gem" / "Persona"). Dùng chung một primitive `ComposerChip` (cao 32px, bo tròn, chữ 13px, không `uppercase`). Menu mức suy luận bỏ `uppercase`; mức "off" ghi "Tắt" (key mới `thinkingOff`) thay vì "TẮT" của web search.
3. **Đưa điều khiển vào trong ô nhập**: bỏ thanh viên thuốc nổi phía trên ô nhập (`ChatControls`), các toggle/chip nằm ở hàng dưới của ô nhập, ngay sau nút "+" (canvas Chat). Model + Suy luận giữ ở bên phải trước Mic/Gửi.
4. **Mobile (< 768px)**: hàng dưới ô nhập chỉ còn `[+] [Tùy chọn] … [Model] [Mic] [Gửi]`; nút **"Tùy chọn"** mở **bottom sheet** (Radix Dialog qua `Sheet side="bottom"`) gồm: Tìm web (switch + mô tả "AI tự quyết khi nào cần tra cứu"), Luôn tìm kiếm (chỉ Gemini, "Tra cứu ở mọi tin nhắn"), Mức suy luận (radiogroup), Gem, Persona, Model, Đính kèm ảnh hoặc tệp, Tham số cục bộ (chỉ model Strata local). Nút "Tùy chọn" hiện số tùy chọn đang bật (badge) để không "giấu" trạng thái.
5. **Vệt accent khi stream**: khi `isStreaming`, mép trên ô nhập có vệt 2px `--accent` ở giữa (24%–76% chiều rộng), `aria-hidden`, nhấp nháy nhẹ, tắt animation khi `prefers-reduced-motion`.

**Out of Scope (What We're NOT Doing)**:

- Nút Gửi/Dừng: canvas dùng nền `--accent` cho "Dừng trả lời", hiện tại là `--danger` — giữ nguyên (đổi màu nút Dừng là quyết định riêng, có test hiện hữu `src/app/features/chat/components/InputForm.test.tsx:128`).
- Thay vòng sáng blur khi focus bằng `--glow` chân trời (brief "horizon glow") — để Giai đoạn 6 cùng type scale.
- Chuỗi cứng chưa dịch trong `GemQuickSwitch`/`PersonaQuickSwitch` ("No GEMs found", "Remove GEM", toast "Failed to apply gem") và nhãn "IMAGE GENERATION MODE" in hoa trong `InputForm` — thuộc 3D (C3/i18n) và 6.
- `useThinkingRegenerate.ts` vẫn dùng `webSearchOff` cho mức "off" (`src/app/features/chat/components/hooks/useThinkingRegenerate.ts:14`) — đổi ở 3D cùng đợt rà nhãn.
- Không đổi logic gửi, upload, web search, thinking level, gem/persona API; chỉ đổi giao diện và vị trí điều khiển.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                                                                                                                                       | Nội dung rút ra                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/2026-11-08-vikini-3-redesign-brief.md`                                                                                                                | Mục "Chat" (composer dock, `aria-pressed`, hairline, sheet mobile); token `--surface` cho composer, `--accent` cho "streaming line"                                                                                                                     |
| Canvas board **Chat** (`project/Chat.dc.html`)                                                                                                                    | Hàng dưới ô nhập: `[Đính kèm] [Tìm web aria-pressed] [Suy luận: Vừa] [Gem: Kỹ sư Next.js] … [Gemini 3.8 Flash ▾] [Dừng]`; chip cao 34px bo `999px`, chữ 13px/500; bật = viền `--accent` + nền `--soft`; vệt `top:-1px; left:24%; width:52%; height:2px` |
| Canvas board **ChatMobile** (`project/ChatMobile.dc.html`)                                                                                                        | Sheet "Tùy chọn" + nút "Xong"; hàng 56px: icon 36px, tiêu đề 15px, mô tả 13px `--faint`, `role="switch"`; "Mức suy luận" radiogroup 4 ô; hàng Gem / Model / Đính kèm có giá trị bên phải                                                                |
| `docs/plans/2026-11-10-vikini-3-phase-3b-messages-header-plan.md`                                                                                                 | Định dạng plan, quy ước Loại C, Lộ trình 3C                                                                                                                                                                                                             |
| `src/app/features/chat/components/ChatControls.tsx`, `InputForm.tsx`, `InputModelControls.tsx`, `ThinkingLevelSelector.tsx`, `ModelSelector.tsx`                  | Cấu trúc hiện tại (A1–A9)                                                                                                                                                                                                                               |
| `src/app/features/gems/components/GemQuickSwitch.tsx`, `src/app/features/personas/components/PersonaQuickSwitch.tsx`, `src/components/ui/sheet.tsx`, `switch.tsx` | Trigger chip hiện tại, primitive Sheet/Switch sẵn có                                                                                                                                                                                                    |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                                    | Quyết định kỹ thuật chịu ảnh hưởng                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn mới "Tìm web", "Tùy chọn", mô tả toggle, "Tắt", "Đính kèm ảnh hoặc tệp" | Key mới thêm vào **cả** `vi.ts`/`en.ts`; `npm run type-check` bắt lệch key; tái dùng `alwaysSearch`, `thinkingLevel*`, `done` |
| `.agents/skills/vikini-investigate/SKILL.md` | `ChatControls` được `ChatApp` dùng ở 2 chỗ (landing + đoạn chat)             | Giữ nguyên **props** `ChatControlsProps` và `buildChatControlsProps`; `InputForm` chỉ **thêm** prop tùy chọn                  |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự thật đã kiểm chứng                                                                                                                                                  | Bằng chứng                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Toggle Web ghép nhãn "Web" + "BẬT/TẮT", class `uppercase tracking-wider`, không có `aria-pressed`                                                                                 | `[SRC]` `src/app/features/chat/components/ChatControls.tsx:138`, `src/app/features/chat/components/ChatControls.tsx:146-151`                                                                                    |
| A2  | Toggle "Luôn tìm kiếm" chỉ hiện với model Gemini hỗ trợ web, cũng ghép "BẬT/TẮT" + `uppercase`                                                                                    | `[SRC]` `src/app/features/chat/components/ChatControls.tsx:163`, `src/app/features/chat/components/ChatControls.tsx:177`                                                                                        |
| A3  | Các điều khiển nằm trong thanh viên thuốc nổi phía trên ô nhập; mobile cuộn ngang `overflow-x-auto`                                                                               | `[SRC]` `src/app/features/chat/components/ChatControls.tsx:281-293`                                                                                                                                             |
| A4  | `InputForm` đã có slot `trailingControls` (model + suy luận) ở bên phải hàng dưới; nút "+" (`aria-label` addAttachment) ở bên trái; `openFilePicker` chỉ có bên trong `InputForm` | `[SRC]` `src/app/features/chat/components/InputForm.tsx:41-42`, `src/app/features/chat/components/InputForm.tsx:89-105`, `src/app/features/chat/components/InputForm.tsx:323-324`                               |
| A5  | Form ô nhập là `relative` (đặt được vệt `absolute`); nhận `isStreaming`                                                                                                           | `[SRC]` `src/app/features/chat/components/InputForm.tsx:232`, `src/app/features/chat/components/InputForm.tsx:52`                                                                                               |
| A6  | `ThinkingLevelSelector`: danh sách mức dựng inline theo model; mức "off" dùng `t("webSearchOff")` ("TẮT"); nhãn trigger ẩn dưới `@sm/chat`; mục menu `uppercase`                  | `[SRC]` `src/app/features/chat/components/ThinkingLevelSelector.tsx:56-105`, `src/app/features/chat/components/ThinkingLevelSelector.tsx:125`, `src/app/features/chat/components/ThinkingLevelSelector.tsx:145` |
| A7  | `InputModelControls` chỉ ghép `ModelSelector` (inline) + `ThinkingLevelSelector` khi `modelSupportsThinkingUI`                                                                    | `[SRC]` `src/app/features/chat/components/InputModelControls.tsx:18-38`                                                                                                                                         |
| A8  | `ModelSelector` tự quản `isOpen`; trên mobile mở `Sheet side="bottom"` riêng — đặt trigger của nó trong sheet "Tùy chọn" là dialog lồng nhau (Radix hỗ trợ)                       | `[SRC]` `src/app/features/chat/components/ModelSelector.tsx:115-126`                                                                                                                                            |
| A9  | Trigger Gem/Persona là `<button>` trong `PopoverTrigger asChild`, chỉ hiện tên (không tiền tố "Gem:"), nhãn rỗng bị ẩn dưới `sm`                                                  | `[SRC]` `src/app/features/gems/components/GemQuickSwitch.tsx:58-75`, `src/app/features/personas/components/PersonaQuickSwitch.tsx:71-89`                                                                        |
| A10 | Có sẵn `Sheet` (Radix Dialog, `side="bottom"`, `max-h-[82dvh]`, safe-area) và `Switch` (Radix, `role="switch"`)                                                                   | `[SRC]` `src/components/ui/sheet.tsx:36-37`, `src/components/ui/switch.tsx:8-26`                                                                                                                                |
| A11 | `FileManagerPanel` định vị `absolute bottom-full right-0` theo phần tử cha — chip "Tệp (n)" phải giữ wrapper `relative`                                                           | `[SRC]` `src/app/features/chat/components/FileManagerPanel.tsx:113`                                                                                                                                             |
| A12 | Key `webSearchOn`/`webSearchOff` còn được `useThinkingRegenerate` dùng → **không xóa** key                                                                                        | `[SRC]` `src/app/features/chat/components/hooks/useThinkingRegenerate.ts:14`, `src/lib/utils/translations/vi.ts:144-145`                                                                                        |
| A13 | Đã có test co-located cho `InputForm` và `InputModelControls`; **chưa có** test cho `ChatControls`, `ThinkingLevelSelector`, `GemQuickSwitch`, `PersonaQuickSwitch`               | `[SRC]` `src/app/features/chat/components/InputForm.test.tsx:87`, `src/app/features/chat/components/InputModelControls.test.tsx:28`                                                                             |

**Cross-Task Dependencies**: dùng token ngữ nghĩa Giai đoạn 1 (`--soft`, `--accent`, `--line`, `--muted`, `--faint`, `--raised`), `useIsDesktop` không cần (ẩn/hiện bằng CSS `md:` để không lệch SSR). 3D sẽ rà `aria-label` còn thiếu và thêm test a11y — 3C đã tự đặt `aria-label`/`aria-pressed` cho mọi điều khiển mới.

**Quyết định sản phẩm (Default Assumption)**:

- `[NEEDS_PRODUCT_DECISION]` **D1 — Vị trí "Suy luận"**: _Default_ giữ chip "Suy luận: Vừa" ở **bên phải** cạnh Model (trong `InputModelControls`) thay vì bên trái như canvas — tránh đổi `InputModelControls` và test T5, và gom "cấu hình model" một chỗ.
- `[NEEDS_PRODUCT_DECISION]` **D2 — Nút "+" trên mobile**: _Default_ giữ nút "+" (Tải tệp / Tạo ảnh) **và** thêm hàng "Đính kèm ảnh hoặc tệp" trong sheet như canvas.
- `[NEEDS_PRODUCT_DECISION]` **D3 — Badge "Tùy chọn"**: _Default_ hiện số tùy chọn đang bật (Tìm web, Luôn tìm kiếm, Suy luận ≠ Tắt, Gem, Persona) dạng chấm số nhỏ `--accent`.

### 4. Bảng Verified Versions

| Thư viện / Công cụ                  | `package.json`        | Phiên bản  | Ghi chú                                                    | Nguồn                                         |
| ----------------------------------- | --------------------- | ---------- | ---------------------------------------------------------- | --------------------------------------------- |
| `@radix-ui/react-dialog`            | `^1.1.15`             | 1.1.x      | Bottom sheet "Tùy chọn" qua `src/components/ui/sheet.tsx`  | `[SRC]` `package.json:43`                     |
| `@radix-ui/react-popover`           | `^1.1.15`             | 1.1.x      | Popover Gem/Persona/Local sampling mở được bên trong sheet | `[SRC]` `package.json:46`                     |
| `@radix-ui/react-switch`            | `^1.2.6`              | 1.2.x      | Switch trong sheet (`role="switch"` + `aria-checked`)      | `[SRC]` `package.json:50`                     |
| `lucide-react`                      | `^0.562.0`            | 0.562      | Icon `Globe`, `Search`, `SlidersHorizontal`, `Paperclip`   | `[SRC]` `package.json:62`                     |
| `vitest` / `@testing-library/react` | `^4.1.12` / `^16.3.1` | 4.1 / 16.3 | Test co-located                                            | `[SRC]` `package.json:117`, `package.json:89` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[NEW]` `src/app/features/chat/components/ComposerChip.tsx` — primitive chip/toggle (`forwardRef`, dùng được với `asChild` của Radix trigger), prop `pressed?: boolean` (chỉ render `aria-pressed` khi được truyền), `icon?: LucideIcon`, `className`.
- `[NEW]` `src/app/features/chat/components/ComposerChip.test.tsx` — TC-01, TC-02.
- `[NEW]` `src/app/features/chat/components/thinkingOptions.ts` — `getThinkingOptions(model, t)` **(Revision 2)** = `getAvailableThinkingLevels(model).map(level => ({ value, label, hint }))` — dựa trên SSOT có sẵn (`src/app/features/chat/components/hooks/useThinkingLevel.ts:93`), **không** chép lại nhánh rẽ của `ThinkingLevelSelector` (nhánh đó bị xóa). Nhãn: `off` → `thinkingOff`, `minimal/low/medium/high` → `thinkingLevelMinimal/Low/Medium/High`; `hint` "≤ 4K/8K/12K tokens" chỉ cho Strata local (giữ như cũ). Danh sách rỗng (Gemini 4 không có trong registry) → trả `[]` và chip/radiogroup không render. Dùng chung cho chip desktop và radiogroup trong sheet.
- `[NEW]` `src/app/features/chat/components/thinkingOptions.test.ts` — TC-03, TC-04.
- `[NEW]` `src/app/features/chat/components/ComposerLeadingControls.tsx` — nhóm điều khiển bên trái hàng dưới ô nhập: desktop (`hidden md:flex`) toggle + chip; mobile (`md:hidden`) nút "Tùy chọn" + chip "Tệp (n)"; giữ cảnh báo xung đột Gem+Persona, ghi chú giá DeepSeek V3.2, `LocalSamplingSettings`, `FileManagerPanel`.
- `[NEW]` `src/app/features/chat/components/ComposerLeadingControls.test.tsx` — TC-05…TC-08.
- `[NEW]` `src/app/features/chat/components/ComposerOptionsSheet.tsx` — bottom sheet mobile (§6.3).
- `[NEW]` `src/app/features/chat/components/ComposerOptionsSheet.test.tsx` — TC-09…TC-12.
- `[MODIFY]` `src/app/features/chat/components/ChatControls.tsx` — bỏ mảng `controls` + thanh viên thuốc phía trên; truyền `renderLeadingControls` cho `InputForm` dựng `ComposerLeadingControls`. Props `ChatControlsProps` giữ nguyên.
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx` — thêm prop `renderLeadingControls?: (api: ComposerApi) => React.ReactNode` (render sau nút "+", ẩn khi chế độ tạo ảnh) và vệt stream `data-testid="composer-stream-line"`.
- `[MODIFY]` `src/app/features/chat/components/InputForm.test.tsx` — **chỉ thêm** TC-13, TC-14 (không có ca cũ bị thay).
- `[MODIFY]` `src/app/features/chat/components/ThinkingLevelSelector.tsx` — dùng `getThinkingOptions`; trigger = `ComposerChip` "Suy luận: Vừa", `hidden md:inline-flex` (mobile chỉnh trong sheet); mục menu bỏ `uppercase`.
- `[NEW]` `src/app/features/chat/components/ThinkingLevelSelector.test.tsx` — TC-15, TC-16.
- `[MODIFY]` `src/app/features/gems/components/GemQuickSwitch.tsx`, `src/app/features/personas/components/PersonaQuickSwitch.tsx` — trigger dùng `ComposerChip`, nhãn "Gem: tên"/"Gem" (Persona tương tự); thêm prop `showPrefix?: boolean` (mặc định `true`; sheet truyền `false` vì hàng đã có tiêu đề). Logic popover/apply giữ nguyên.
- `[NEW]` `src/app/features/gems/components/GemQuickSwitch.test.tsx`, `src/app/features/personas/components/PersonaQuickSwitch.test.tsx` — TC-17, TC-18.
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts` — key mới: `webSearchToggle` ("Tìm web" / "Web search"), `webSearchDesc` ("AI tự quyết khi nào cần tra cứu" / "AI decides when to look things up"), `alwaysSearchDesc` ("Tra cứu ở mọi tin nhắn" / "Search on every message"), `composerOptions` ("Tùy chọn" / "Options"), `composerOptionsActive` ("{n} tùy chọn đang bật" / "{n} options on"), `thinkingOff` ("Tắt" / "Off"), `attachFileOrImage` ("Đính kèm ảnh hoặc tệp" / "Attach image or file"), `gemChip` ("Gem"), `personaChip` ("Persona"), `conflictWarning` ("Đang bật cả Gem và Persona. Nếu chỉ dẫn mâu thuẫn, Gem được ưu tiên." / "Both Gem and Persona are on. If instructions conflict, the Gem wins.") — key này **chưa tồn tại**, code cũ dựa vào chuỗi dự phòng tiếng Anh (`src/app/features/chat/components/ChatControls.tsx:225-227`). Hàng tham số cục bộ trong sheet tái dùng `localSamplingTitle` (`src/lib/utils/translations/vi.ts:1325`). Không xóa key cũ (A12).
- `[MODIFY]` `docs/CHANGELOG.md` — mục "2026-11-xx: Vikini 3.0 Phase 3C — Composer"; `[MODIFY]` `docs/architecture.md` — dòng mô tả cụm composer (`ChatControls` → `InputForm` + `ComposerLeadingControls` / `ComposerOptionsSheet`).

**Không sửa**: `InputModelControls.tsx` và test của nó (D1), `ModelSelector.tsx` (A8), `chatControlsProps.ts`, `ChatApp.tsx`. **Không** chạm `.agents/**`, `.claude/**`, `*.server.ts`, migration, `package.json` → `CRITIC_REQUIRED` dự kiến `no`; nếu verify-plan báo `yes` thì ghi chú miễn Critic Pass theo cách PM đã chọn.

### 6. Caller-First Design Sketch

**6.1 `ChatControls` → `InputForm` (caller)**

```tsx
<InputForm
  …props như cũ…
  renderLeadingControls={({ openFilePicker, disabled }) => (
    <ComposerLeadingControls
      currentModel={currentModel}
      webSearchEnabled={webSearchEnabled} toggleWebSearch={toggleWebSearch}
      alwaysSearch={alwaysSearch} toggleAlwaysSearch={toggleAlwaysSearch}
      thinkingLevel={thinkingLevel} setThinkingLevel={setThinkingLevel}
      currentGem={currentGem ?? null} currentPersona={currentPersona ?? null}
      conversationId={selectedConversationId}
      fileCount={fileCount} fileConversationId={conversationId}
      onSelectModel={handleModelChange} isModelAllowed={isModelAllowed}
      onAttach={openFilePicker}
      localSamplingDisabled={isStreaming || regenerating} // (Revision 2) chỉ khóa đúng như cũ
    />
  )}
  trailingControls={<InputModelControls … /> /* như cũ */}
/>
```

`ComposerApi = { openFilePicker: () => void }` (export type từ `InputForm.tsx`). **(Revision 2) Quy tắc khóa giữ nguyên như hiện tại**: Tìm web chỉ khóa khi `!canWebSearch`; Luôn tìm kiếm, Gem, Persona, nút "Tùy chọn", chip "Tệp" **không** khóa khi đang stream; `LocalSamplingSettings` khóa khi `isStreaming || regenerating` (`src/app/features/chat/components/ChatControls.tsx:191`); hàng "Đính kèm" trong sheet khóa theo cùng điều kiện với nút "+" (`disabled || isUploading`, `src/app/features/chat/components/InputForm.tsx:286`) — `ComposerApi` thêm `attachDisabled: boolean` cho việc này. Thanh viên thuốc phía trên (A3) bị xóa; khoảng `mb-4 pt-4` của nó thay bằng `pt-3` trên mobile để ô nhập không dính mép.

**6.2 `ComposerLeadingControls`**

```tsx
<>
  {/* Desktop */}
  <div className="hidden md:flex items-center gap-1.5 flex-wrap min-w-0">
    <ComposerChip icon={Globe} pressed={canWebSearch && webSearchEnabled} disabled={!canWebSearch}
      title={!canWebSearch ? t("webSearchNotSupported") : undefined} onClick={toggleWebSearch}>
      {t("webSearchToggle")}
    </ComposerChip>
    {isV32 && webSearchEnabled && <span className="text-xs text-(--warning)">{t("webSearchPricingNote")}</span>}
    {showAlwaysSearch && <ComposerChip icon={Search} pressed={alwaysSearch} title={t("alwaysSearchTooltip")} onClick={toggleAlwaysSearch}>{t("alwaysSearch")}</ComposerChip>}
    {isLocal && <LocalSamplingSettings … />}
    <GemQuickSwitch currentGem={currentGem} conversationId={conversationId} />
    <PersonaQuickSwitch currentPersona={currentPersona} conversationId={conversationId} />
    {currentGem && currentPersona && <ConflictBadge />}  {/* AlertTriangle + aria-label conflictWarning */}
  </div>
  {/* Mobile */}
  <ComposerChip className="md:hidden" icon={SlidersHorizontal} aria-haspopup="dialog"
    aria-label={activeCount ? `${t("composerOptions")} · ${t("composerOptionsActive").replace("{n}", …)}` : t("composerOptions")}
    onClick={() => setSheetOpen(true)}>
    {t("composerOptions")}{activeCount > 0 && <span aria-hidden className="… bg-(--accent) text-(--on-accent)">{activeCount}</span>}
  </ComposerChip>
  {fileCount > 0 && <FilesChip … /> /* wrapper relative, FileManagerPanel như cũ (A11), hiện ở cả 2 cỡ */}
  <ComposerOptionsSheet open={sheetOpen} onOpenChange={setSheetOpen} … />
</>
```

`showAlwaysSearch = canWebSearch && currentModel.startsWith("gemini")` (giữ nguyên điều kiện A2). `activeCount` tính qua hàm thuần `countActiveComposerOptions(...)` export từ cùng file để test. **(Revision 2)** Định nghĩa: `(canWebSearch && webSearchEnabled) + (showAlwaysSearch && alwaysSearch) + (modelSupportsThinkingUI(model) && getEffectiveThinkingLevel(model, thinkingLevel) !== "off") + (currentGem ? 1 : 0) + (currentPersona ? 1 : 0)` — mức suy luận theo giá trị **hiệu lực** (Gemini 4 luôn ≥ "low" nên luôn đếm; model không hỗ trợ → không đếm).

**6.3 `ComposerOptionsSheet`**

```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="bottom" hideCloseButton className="px-4 pb-6 pt-2">
    <div aria-hidden className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-(--line)" />
    <div className="flex items-center justify-between pb-2">
      <SheetTitle className="text-[17px] font-semibold">{t("composerOptions")}</SheetTitle>
      <SheetClose className="h-9 px-3 text-sm font-semibold text-(--accent)">{t("done")}</SheetClose>
    </div>
    <OptionSwitchRow icon={Globe} title={t("webSearchToggle")} description={canWebSearch ? t("webSearchDesc") : t("webSearchNotSupported")}
      checked={canWebSearch && webSearchEnabled} disabled={!canWebSearch} onCheckedChange={toggleWebSearch} />
    {showAlwaysSearch && <OptionSwitchRow icon={Search} title={t("alwaysSearch")} description={t("alwaysSearchDesc")} … />}
    {supportsThinking && (
      <fieldset> <legend>{t("thinkingLevel")}</legend>
        <div role="radiogroup" aria-label={t("thinkingLevel")} className="grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-(--raised) p-1">
          {options.map(o => <button role="radio" aria-checked={o.value === effective} onClick={() => setThinkingLevel(o.value)} className="h-9 …">{o.label}</button>)}
        </div>
      </fieldset>
    )}
    <OptionRow title={t("gemChip")}><GemQuickSwitch showPrefix={false} … /></OptionRow>
    <OptionRow title={t("personaChip")}><PersonaQuickSwitch showPrefix={false} … /></OptionRow>
    {currentGem && currentPersona && <p className="text-xs text-(--warning)">{t("conflictWarning")}</p>}
    <OptionRow title="Model"><ModelSelector variant="inline" … /></OptionRow>
    {isLocal && <OptionRow title={t("localSamplingTitle")}><LocalSamplingSettings … /></OptionRow>}
    <button type="button" className="flex min-h-14 w-full items-center …" onClick={() => { onOpenChange(false); onAttach(); }}>
      <span className="flex-1 text-left">{t("attachFileOrImage")}</span><Paperclip aria-hidden />
    </button>
  </SheetContent>
</Sheet>
```

`OptionSwitchRow`: hàng `min-h-14`, icon 36px (`bg-(--soft) text-(--accent)` khi bật, `bg-(--raised) text-(--muted)` khi tắt), tiêu đề 15px + mô tả 13px `--faint`, `Switch` có `aria-label={title}` và `aria-describedby` trỏ mô tả. Radiogroup dùng phím ←/→ chuyển mức (roving `tabIndex`). Thứ tự hàng theo canvas: Tìm web → Luôn tìm kiếm → Mức suy luận → Gem → (Persona) → Model → Đính kèm.

**6.4 `ComposerChip`**

```tsx
export const ComposerChip = React.forwardRef<HTMLButtonElement, ComposerChipProps>(
  ({ icon: Icon, pressed, className, children, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      {...rest}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:cursor-not-allowed disabled:opacity-45",
        pressed
          ? "border-(--accent) bg-(--soft) text-(--accent)"
          : "border-(--line) text-(--muted) hover:text-(--text) hover:bg-(--raised)",
        className
      )}
    >
      {Icon && <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  )
);
```

`pressed` không truyền (chip mở menu) → không có thuộc tính `aria-pressed`. Trigger Gem/Persona/Suy luận dùng chip với `pressed` **không** truyền; màu "đang có giá trị" qua prop `active` (viền `--accent`, chữ `--accent`, không nền) — tránh lạm dụng `aria-pressed` cho nút mở menu.

**6.5 Vệt stream trong `InputForm`**

```tsx
{
  isStreaming && (
    <div
      aria-hidden
      data-testid="composer-stream-line"
      className="pointer-events-none absolute -top-px left-[24%] h-0.5 w-[52%] rounded-full bg-(--accent) animate-pulse motion-reduce:animate-none"
    />
  );
}
```

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **B1 — Test trước**: TC-01…TC-18 → **đỏ** (file mới chưa tồn tại / hành vi chưa có).
- [ ] **B2 — `ComposerChip` + `thinkingOptions`** (tách logic, `thinkingOff`).
- [ ] **B3 — `ThinkingLevelSelector`, `GemQuickSwitch`, `PersonaQuickSwitch`** dùng chip.
- [ ] **B4 — `ComposerOptionsSheet` + `ComposerLeadingControls`**.
- [ ] **B5 — `InputForm` (slot trái + vệt stream) và `ChatControls`** (bỏ thanh trên, nối slot).
- [ ] **B6 — i18n + living docs** (`CHANGELOG.md`, `architecture.md`).
- [ ] **B7 — Verify** §9 + Negative Probes + QA Playwright (1440×900 và 375×812, landing + đoạn chat, mở sheet, bật/tắt, stream mock).

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| TC    | File                               | Input                                                                                                                                                                     | Kỳ vọng                                                                                                                                                                                                                                                                                                                                       |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | `ComposerChip.test.tsx`            | `pressed` true / false                                                                                                                                                    | `aria-pressed="true"` + class `bg-(--soft)`; `"false"` + `border-(--line)`; không có class `uppercase`; icon `aria-hidden`                                                                                                                                                                                                                    |
| TC-02 | `ComposerChip.test.tsx`            | không truyền `pressed` (Negative)                                                                                                                                         | Không có thuộc tính `aria-pressed`; `type="button"`; `ref` trỏ tới `<button>`                                                                                                                                                                                                                                                                 |
| TC-03 | `thinkingOptions.test.ts`          | **(Revision 2)** `gemini-3-flash-preview`, `gemini-3.8-flash`, `claude-sonnet-4.5`, `deepseek-v4-flash`, `z-ai/glm-5.2`, `gemini-4-argon`, Strata local                   | `value` lần lượt (viết tay, không snapshot): `[off,minimal,low,medium,high]`, `[off,low,medium,high]`, `[off,high]`, `[off,low,high]`, `[off,high]`, `[low,medium,high]`, `[off,low,medium,high]`; nhãn "Vừa" cho `medium`; chỉ Strata local có `hint` chứa "8K" ở `medium`; mọi trường hợp `values` bằng `getAvailableThinkingLevels(model)` |
| TC-04 | `thinkingOptions.test.ts`          | mọi nhánh có "off"                                                                                                                                                        | Nhãn "off" = `t("thinkingOff")`, **không** gọi `t("webSearchOff")` (Negative)                                                                                                                                                                                                                                                                 |
| TC-05 | `ComposerLeadingControls.test.tsx` | model Gemini hỗ trợ web, web bật, always tắt                                                                                                                              | Nút "Tìm web" `aria-pressed="true"`, "Luôn tìm kiếm" `aria-pressed="false"`; click → `toggleWebSearch`/`toggleAlwaysSearch` 1 lần; không có chữ "BẬT"/"TẮT"/"ON"/"OFF"                                                                                                                                                                        |
| TC-06 | `ComposerLeadingControls.test.tsx` | model không hỗ trợ web (Negative)                                                                                                                                         | "Tìm web" `disabled`, `aria-pressed="false"`, `title` = webSearchNotSupported; click không gọi `toggleWebSearch`; không render "Luôn tìm kiếm". **(Revision 2)** Ca thêm: model hỗ trợ web, `isStreaming` true → "Tìm web" và "Tùy chọn" **không** `disabled`, click vẫn gọi `toggleWebSearch`                                                |
| TC-07 | `ComposerLeadingControls.test.tsx` | `countActiveComposerOptions` các tổ hợp (gồm `gemini-4-argon` + `thinkingLevel="off"` → vẫn đếm 1; model không hỗ trợ thinking + `"high"` → 0); render với 2 tùy chọn bật | Hàm trả đúng số; nút "Tùy chọn" có class `md:hidden`, `aria-haspopup="dialog"`, `aria-label` chứa "2"; nhóm desktop có `hidden md:flex`                                                                                                                                                                                                       |
| TC-08 | `ComposerLeadingControls.test.tsx` | `fileCount` 0 / 3; Gem + Persona cùng có                                                                                                                                  | 0 → không có chip "Tệp"; 3 → chip "Tệp (3)"; có cảnh báo xung đột với `aria-label`                                                                                                                                                                                                                                                            |
| TC-09 | `ComposerOptionsSheet.test.tsx`    | `open` true, model Gemini web bật                                                                                                                                         | Có `role="dialog"` tên "Tùy chọn"; switch "Tìm web" `aria-checked="true"` + mô tả "AI tự quyết…"; bấm → `toggleWebSearch`                                                                                                                                                                                                                     |
| TC-10 | `ComposerOptionsSheet.test.tsx`    | model hỗ trợ thinking, level "medium"                                                                                                                                     | `role="radiogroup"` có radio "Vừa" `aria-checked="true"`; bấm "Sâu" → `setThinkingLevel("high")`                                                                                                                                                                                                                                              |
| TC-11 | `ComposerOptionsSheet.test.tsx`    | model không hỗ trợ thinking & không phải Gemini (Negative)                                                                                                                | Không có radiogroup; không có switch "Luôn tìm kiếm"                                                                                                                                                                                                                                                                                          |
| TC-12 | `ComposerOptionsSheet.test.tsx`    | bấm "Đính kèm ảnh hoặc tệp"; bấm "Xong"                                                                                                                                   | `onOpenChange(false)` rồi `onAttach` 1 lần; "Xong" → `onOpenChange(false)`                                                                                                                                                                                                                                                                    |
| TC-13 | `InputForm.test.tsx`               | `renderLeadingControls` trả `<span data-testid="lead"/>`; bật chế độ tạo ảnh                                                                                              | Hàm được gọi với `openFilePicker` là function; "lead" đứng **sau** nút "+" trong DOM; chế độ ảnh → không render "lead" (Negative)                                                                                                                                                                                                             |
| TC-14 | `InputForm.test.tsx`               | `isStreaming` true / false                                                                                                                                                | true → có `composer-stream-line` với `aria-hidden="true"` và `motion-reduce:animate-none`; false → không có (Negative)                                                                                                                                                                                                                        |
| TC-15 | `ThinkingLevelSelector.test.tsx`   | model Gemini 3, level "medium"                                                                                                                                            | Trigger hiện "Suy luận: Vừa", có `hidden md:inline-flex`, không có `aria-pressed`                                                                                                                                                                                                                                                             |
| TC-16 | `ThinkingLevelSelector.test.tsx`   | mở menu                                                                                                                                                                   | Không mục nào có class `uppercase`; chọn "Sâu" → `setThinkingLevel("high")`                                                                                                                                                                                                                                                                   |
| TC-17 | `GemQuickSwitch.test.tsx`          | `currentGem` có tên / `null`; `showPrefix={false}`                                                                                                                        | "Gem: Kỹ sư Next.js" / "Gem"; `showPrefix=false` → chỉ "Kỹ sư Next.js"; không có class `uppercase`                                                                                                                                                                                                                                            |
| TC-18 | `PersonaQuickSwitch.test.tsx`      | tương tự TC-17                                                                                                                                                            | "Persona: tên" / "Persona"; `showPrefix=false` → chỉ tên                                                                                                                                                                                                                                                                                      |

**Ca test cũ bị thay theo Loại C (đích danh)**: **không có**. Lý do: `ChatControls`, `ThinkingLevelSelector`, `GemQuickSwitch`, `PersonaQuickSwitch` chưa có test (A13); `InputModelControls.test.tsx` mock `ThinkingLevelSelector` nên không phụ thuộc markup trigger (`src/app/features/chat/components/InputModelControls.test.tsx:17-22`); `InputForm.test.tsx` chỉ **thêm** ca — các ca T1/T2/T4 (`src/app/features/chat/components/InputForm.test.tsx:283-333`) giữ nguyên vì nút "+" vẫn đứng sau textarea và `trailingControls` không đổi. Nếu khi chạy một ca cũ đỏ do markup, dừng lại, ghi tên ca vào Audit History như phát sinh Loại C trước khi sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx vitest run src/app/features/chat/components src/app/features/gems src/app/features/personas --reporter=dot
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx prettier --check --end-of-line auto <các file đã sửa>
```

**Wiring Probes**:

- W1 Grep `uppercase` trong `ChatControls.tsx`, `ComposerLeadingControls.tsx`, `ComposerOptionsSheet.tsx`, `ThinkingLevelSelector.tsx` → 0.
- W2 Grep `webSearchOn|webSearchOff` trong `ChatControls.tsx`, `ComposerLeadingControls.tsx`, `ThinkingLevelSelector.tsx`, `thinkingOptions.ts` → 0.
- W3 Grep `renderLeadingControls` trong `ChatControls.tsx` → 1 (slot được nối).
- W4 QA Playwright 1440×900 (đoạn chat mock): không còn thanh viên thuốc phía trên ô nhập; hàng dưới có "Tìm web" với `aria-pressed`, bấm đổi trạng thái; chip "Suy luận: …", "Gem", "Persona"; route stream mock giữ mở → thấy `composer-stream-line`.
- W5 QA 375×812: hàng dưới không cuộn ngang (`scrollWidth <= clientWidth`); bấm "Tùy chọn" → sheet có "Tìm web", "Mức suy luận", "Gem", "Model", "Đính kèm ảnh hoặc tệp"; bật switch → badge số tăng; "Xong" đóng sheet; landing (`isLanding`) cũng mở được sheet.

**Negative Probes** (hoàn tác sau mỗi probe):

- N1 Bỏ `aria-pressed={pressed}` trong `ComposerChip` → TC-01 đỏ.
- N2 Đổi nhãn "off" trong `thinkingOptions.ts` về `t("webSearchOff")` → TC-04 đỏ.
- N5 **(Revision 2)** Tạm thêm `disabled={isStreaming}` cho chip "Tìm web" → ca stream của TC-06 đỏ.
- N6 **(Revision 2)** Tạm đếm suy luận theo `thinkingLevel` thô thay vì mức hiệu lực → TC-07 đỏ.
- N3 Bỏ điều kiện `isStreaming &&` của vệt (luôn render) → TC-14 đỏ.
- N4 Bỏ `onOpenChange(false)` trước `onAttach()` trong sheet → TC-12 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                        | Mức        | Control                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hàng dưới ô nhập desktop quá chật khi đủ chip (Web, Luôn tìm, Local, Gem, Persona, ⚠, Tệp) + Model + Suy luận | Trung bình | Nhóm trái `flex-wrap min-w-0`; tên Gem/Persona `max-w-[120px] truncate`; QA ở 768px và 1024px với model Gemini + Gem + Persona                                 |
| Dialog lồng nhau (sheet "Tùy chọn" → sheet Model / popover Gem) mất focus hoặc đóng cả hai                    | Trung bình | Radix hỗ trợ dialog lồng; QA Playwright mở Model và Gem từ trong sheet, Esc chỉ đóng lớp trên cùng; nếu lỗi: hàng Model đóng sheet trước rồi mở picker         |
| Mở file picker từ sheet bị trình duyệt chặn (không còn "user activation")                                     | Thấp       | `onAttach` gọi đồng bộ trong cùng handler click (đóng sheet bằng state, không `await`/`setTimeout`); TC-12 khẳng định thứ tự gọi                               |
| `GemQuickSwitch`/`PersonaQuickSwitch` dùng ở nơi khác bị đổi nhãn ngoài ý muốn                                | Thấp       | Đã grep: caller duy nhất là `ChatControls.tsx` (sẽ chuyển sang `ComposerLeadingControls`/`ComposerOptionsSheet`); `showPrefix` chỉ đổi chữ hiển thị, giữ logic |
| Mất ô nhập trên mobile do bỏ thanh trên làm lệch padding `fixed bottom-0`                                     | Thấp       | Giữ nguyên class container `motion.div`; chỉ thay khối toolbar; QA 375px với bàn phím ảo giả lập (viewport cao 500px)                                          |
| Hook đặt sau early return (repo không có rule react-hooks)                                                    | Trung bình | Component mới không có early return trước hook; review thủ công từng file mới                                                                                  |

### Lộ Trình

| Bước | Nội dung                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 3C   | **Plan này** — composer: toggle `aria-pressed`, chip, sheet tùy chọn mobile, vệt stream (H2)                                           |
| 3D   | `aria-label`/tooltip control icon-only còn thiếu (C3) + test a11y; chuỗi cứng Gem/Persona; `useThinkingRegenerate` nhãn "off"          |
| 4    | Ảnh: tabs Tạo ảnh / Thư viện / Mô tả ảnh (M3, M5)                                                                                      |
| 5    | Novelcrafter theo canvas (H1)                                                                                                          |
| 6    | Gems/Personas lưới card, Sign-in (H3, H7), type scale + lint màu thô, gỡ alias token, `--glow` sau composer, eslint-plugin-react-hooks |

### 11. Ghi Chú Triển Khai (sai khác so với plan, phát hiện khi QA)

- **Điểm chuyển desktop/mobile**: plan ghi `md:` (viewport). QA ở 768px (panel ngữ cảnh mở, cột chat ~330px) cho thấy chip "Thinking" đè lên Mic/Gửi. Đổi sang container query `@3xl/chat` (cột chat ≥ 768px) cho nhóm toggle desktop, nút "Tùy chọn" và chip Suy luận; TC-07/TC-15 khẳng định class `@3xl/chat:*` thay cho `md:*`.
- **Nhóm trái không co dưới nội dung**: bỏ `min-w-0` ở `ComposerLeadingControls` (nút "Tùy chọn" từng bị Model đè ở 768px); chip Suy luận được co (`min-w-0 shrink`) với nhãn `truncate`.
- **Mock test**: `ComposerLeadingControls.test.tsx` mock `ComposerOptionsSheet` bằng `importOriginal` để giữ `canAlwaysSearch` thật.
- **QA Playwright** (1440, 1280, 1024, 768, 375): không nút nào đè nhau; toggle đổi `aria-pressed`; vệt stream hiện khi stream và mất khi xong; sheet mở/đóng, switch đổi `aria-checked`, nhãn badge đổi theo. Dev server chạy `next dev --webpack` vì Turbopack không đọc `node_modules` dạng junction ngoài root của worktree.

## Audit History

### Audit Run 1

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định "Tự review ở đây")]

#### 1. Output verify-plan.mjs

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-10-vikini-3-phase-3c-composer-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS toàn bộ, `CRITIC_REQUIRED no`, `VERIFY_PLAN: PASS`.
- Đối chiếu source: A1–A13 khớp. Grep thêm `getAvailableThinkingLevels`, `getEffectiveThinkingLevel`, caller của `GemQuickSwitch`/`PersonaQuickSwitch`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                      | Bằng chứng                                                                                                                                                                                                                                                                                        | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------- | ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/app/features/chat/components/hooks/useThinkingLevel.ts:93`  | [SRC] `getAvailableThinkingLevels` đã là nguồn duy nhất cho danh sách mức theo model, có test cụ thể (`src/app/features/chat/components/hooks/useThinkingLevel.test.ts:52`); `ThinkingLevelSelector` chép lại cùng nhánh rẽ (`src/app/features/chat/components/ThinkingLevelSelector.tsx:56-105`) | §5 định "tách nguyên logic" từ `ThinkingLevelSelector` sang `thinkingOptions.ts` → giữ bản sao thứ hai của SSOT. TC-03 "snapshot từng nhánh" chụp lại chính output mới → test tự khẳng định (tautology). **Sửa**: `getThinkingOptions` = `getAvailableThinkingLevels(model).map(level → nhãn + hint)`; TC-03 dùng id model cụ thể và giá trị kỳ vọng viết tay.                      |
| 2   | DEFECT         | [MAJOR] | `src/app/features/chat/components/ChatControls.tsx:133-137`      | [SRC] Toggle Web hiện chỉ `disabled={!canWebSearch}`; Gem/Persona không bị khóa; chỉ `LocalSamplingSettings` khóa khi `isStreaming \|\| regenerating` (`src/app/features/chat/components/ChatControls.tsx:191`)                                                                                   | Sketch §6.1 truyền `disabled={disabled \|\| isStreaming \|\| regenerating}` cho cả nhóm → khóa Tìm web/Gem/Persona/nút "Tùy chọn" khi đang stream: **đổi hành vi**, trái "Không đổi logic" ở §1. `ComposerApi.disabled` cũng chưa có nghĩa rõ. **Sửa**: bỏ `disabled` chung; giữ đúng quy tắc khóa cũ từng điều khiển; thêm ca test âm tính "đang stream vẫn bật/tắt được Tìm web". |
| 3   | DEFECT         | [MINOR] | `src/app/features/chat/components/hooks/useThinkingLevel.ts:115` | [SRC] `getEffectiveThinkingLevel` đổi "off" → "low" với Gemini 4 và trả "off" khi model không hỗ trợ thinking UI                                                                                                                                                                                  | §6.2 chưa định nghĩa `countActiveComposerOptions`: phải đếm theo mức **hiệu lực** (không theo `thinkingLevel` thô), Tìm web chỉ khi `canWebSearch`, Luôn tìm kiếm chỉ khi `showAlwaysSearch`.                                                                                                                                                                                       |
| 4   | RISK_DISMISSED | —       | `src/app/features/chat/components/ModelSelector.tsx:117-120`     | [SRC] Trên mobile trigger được bọc `<span onClick className="contents">` rồi mở `Sheet` riêng                                                                                                                                                                                                     | Đặt `ModelSelector` trong sheet "Tùy chọn" vẫn mở được picker (dialog lồng); đã có hướng dự phòng ở §10 nếu QA thấy lỗi focus.                                                                                                                                                                                                                                                      |

#### Kết Luận

2 `[MAJOR]` → cần Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: claude-opus-5-5 (in-session, PM chỉ định); Critic Pass miễn theo cách PM đã chọn ở các plan trước (và `CRITIC_REQUIRED no`) — PM có thể yêu cầu chạy]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-10-vikini-3-phase-3c-composer-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` → **đã xử lý**: §5 `getThinkingOptions` dựng trên `getAvailableThinkingLevels`, xóa nhánh rẽ trùng; TC-03 có 7 id model cụ thể với giá trị kỳ vọng viết tay, khớp `src/app/features/chat/components/hooks/useThinkingLevel.test.ts:52-110`.
- Audit Run 1 #2 `[MAJOR]` → **đã xử lý**: §6.1 bỏ `disabled` chung, liệt kê quy tắc khóa từng điều khiển giữ như cũ; TC-06 thêm ca "đang stream vẫn bật/tắt được"; Negative Probe N5.
- Audit Run 1 #3 `[MINOR]` → **đã xử lý**: công thức `countActiveComposerOptions` theo mức hiệu lực ở §6.2; TC-07 thêm 2 tổ hợp biên; N6.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                          | Bằng chứng                                                                                                                                                   | Lý do / Hướng xử lý khi code                                                                                                                    |
| --- | -------------- | ------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_ACCEPTED  | [MINOR] | `src/app/features/chat/components/hooks/useThinkingLevel.ts:100-103` | [SRC] Gemini 4 chỉ trả danh sách từ registry; id Gemini 4 không có trong `SELECTABLE_MODELS` → có thể ra `[]`, trong khi selector cũ rơi về `[off,low,high]` | Khác biệt chỉ ở id Gemini 4 ngoài registry (không chọn được trong UI). Chấp nhận: `[]` → ẩn chip; đúng hơn vì Gemini 4 không tắt được suy luận. |
| 2   | DEFECT         | [MINOR] | `src/app/features/chat/components/InputForm.tsx:323-324`             | [SRC] Nhóm phải `ml-auto min-w-0`; thêm nhóm trái `flex-wrap` vào cùng hàng `flex-wrap`                                                                      | Khi code: nhóm trái `flex-1 min-w-0` để nhóm phải không bị đẩy xuống dòng riêng ở 768–1024px; QA W4 đo ở 768px.                                 |
| 3   | RISK_DISMISSED | —       | `src/app/features/chat/components/InputModelControls.test.tsx:17-22` | [SRC] Test mock `ThinkingLevelSelector`                                                                                                                      | Đổi trigger thành `ComposerChip` + `hidden md:inline-flex` không ảnh hưởng test T5; xác nhận không có ca Loại C.                                |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-02, TC-04, TC-06, TC-11, TC-13, TC-14) và Negative Probe N1–N6; xác nhận không có ca test cũ bị thay (Loại C rỗng, có lý do). Plan đạt chuẩn để triển khai.

[PLAN_APPROVED]
