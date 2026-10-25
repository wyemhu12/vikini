# Kế Hoạch Triển Khai: Gỡ Bỏ Deep Research & Thu Gọn Thanh Chat (Model/Thinking Vào Ô Nhập)

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-25
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope

**Mục tiêu**

1. **Gỡ bỏ hoàn toàn Deep Research khỏi mã ứng dụng**: UI (nút toolbar, agent selector, cards, panels, modal), hooks (`useDeepResearchMode`, `useResearchAwareSend`), API routes (`/api/deep-research/**`), feature logic (`src/lib/features/research/**`), core helpers (`createResearchInteraction`, `getResearchInteraction`, `tryClaimResearchSlot`, `getResearchDailyCount`, `modelSupportsDeepResearch`), types, translations (`deepResearch*`, `dailyResearchLimit`, `configureFeatures`), admin UI (ô "Daily Research Limit" + modal "Configure Features" vốn chỉ chứa `deep_research`), tests và living docs.
2. **Thu gọn thanh công cụ phía trên (`ChatControls`)**: chuyển **Model Selector** và **Thinking Level Selector** xuống bên trong ô nhập chat (`InputForm` — chính là "ChatInput" trong brief), nằm ở cụm phải **trước nút Mic/Send** (giống prompt bar của Gemini: model picker ở góc dưới phải; ChatGPT: nút Think có icon não trong composer).
3. Ô nhập chuyển sang **bố cục 2 hàng thống nhất trên mọi breakpoint**: hàng 1 = textarea full-width; hàng 2 = `[+]` bên trái · `[Model ▾] [🧠 Level ▾] [Mic] [Send]` bên phải. Tuân thủ `.agents/rules/03-ui.md` (token, a11y, mobile) và `.agents/rules/04-bilingual.md`.

**Out of Scope (KHÔNG làm)**

- **KHÔNG** viết migration DROP bảng `research_tasks`, `daily_research_counts`, cột `rank_configs.daily_research_limit`, RPC `increment_daily_research_count` (xem `[NEEDS_PRODUCT_DECISION]` D1). Không sửa `supabase/migrations/**`, `src/types/database.types.ts` (file generated), `scripts/verify-rls-negative-probe.ts`, `scripts/introspect-rls.sql` — các đối tượng DB vẫn tồn tại nên các script/tài liệu RLS này vẫn đúng.
- **KHÔNG** sửa `.agents/**` (file nhạy cảm bị khóa): `.agents/agents/reviewer/mental-simulation.md:51` và `.agents/skills/vikini-investigate/SKILL.md:86` đang trỏ tới `src/app/api/deep-research/...` làm ví dụ → ghi nhận là follow-up governance (D3).
- **KHÔNG** sửa lịch sử: `docs/plans/**` cũ, `docs/archive/**`, `docs/lessons-learned.md`, `docs/audit-report-*.md`, `docs/specs/**`.
- **KHÔNG** dọn localStorage cũ (`STORAGE_KEY` / `ACTIVE_RESEARCH_KEY` của `useDeepResearchMode.ts:106,116`) ở trình duyệt người dùng — key mồ côi vô hại, thêm code dọn dẹp là vi phạm "Subtract Before You Add".
- **KHÔNG** di chuyển `LocalSamplingSettings`, Web Search, Always Search, Gem, Persona, Files — vẫn ở toolbar.
- **KHÔNG** đổi giao diện `ModelSelector` trong `NovelcrafterTopBar.tsx:202` (giữ variant mặc định `toolbar`).
- **KHÔNG** gỡ prop `children` generic của `ChatMessagesArea` (slot chung, có test) — chỉ sửa comment nhắc Deep Research.

### 2. Tài Liệu Cần Tham Chiếu & Skills Loaded & Applied

| File đã đọc                                                                      | Mục đích                                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`, `01-coding.md`, `02-quality.md`, `05-plan-review.md` | Ranh giới kiến trúc, cấm `any`/`console.log`, co-located test, Triage A/B/C, file nhạy cảm              |
| `.agents/rules/03-ui.md`                                                         | Token `bg-(--token)`, cấm `text-[10px]`, `aria-label` cho icon-only, focus ring, dropdown `min()` width |
| `.agents/rules/04-bilingual.md`                                                  | Chỉ `useLanguage()` + `t("key")`, parity `vi.ts`/`en.ts`                                                |
| `.agents/agents/reviewer/evidence-bar.md`, `mental-simulation.md`                | Wiring/Negative Probe (§4.5.3), Risk Table (§4.5.4), S1–S6                                              |
| `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md:176-178`     | `next typegen` tái sinh route types sau khi xóa route                                                   |

| Skill (`SKILL.md`)                                                       | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` (Mode 4 `/blast-radius`)    | Bảng blast-radius §3.2 cho mọi export bị xóa ở `src/lib/core/` + `src/lib/features/`, gồm dynamic import (`stream/route.ts:152,173`) và mock (`researchService.server.test.ts:181-186`) |
| `.agents/skills/vikini-simplify/SKILL.md`                                | Mỗi symbol xóa phải có grep 0-ref; không nới test; xóa test của code chết chỉ theo Test Contract (Loại C)                                                                               |
| `.agents/skills/add-translation/SKILL.md`                                | Xóa key đồng thời ở `vi.ts` + `en.ts`; **không thêm key mới** (tái dùng `selectModel`, `thinkingLevel`, `thinkingLevelTooltip`)                                                         |
| `.agents/skills/api-patterns/SKILL.md` (áp dụng cho route admin còn lại) | `rank-configs/route.ts` giữ nguyên Validate → Execute → Respond; chỉ bỏ nhánh validate `daily_research_limit`                                                                           |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định                                                                                                                                                              | Bằng chứng                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A1  | "ChatInput" trong brief = `InputForm.tsx`, được render duy nhất bởi `ChatControls.tsx:400`                                                                            | `[SRC]` grep `InputForm` chỉ có `ChatControls.tsx:12,400` + test                                               |
| A2  | `ThinkingLevelSelector` chỉ có 1 call site (`ChatControls.tsx:221`) → restyle trực tiếp, không cần variant                                                            | `[SRC]` grep `ThinkingLevelSelector`                                                                           |
| A3  | `ModelSelector` có 2 call site: `ChatControls.tsx:152` và `NovelcrafterTopBar.tsx:202` → thêm prop `variant` mặc định `"toolbar"` để Novelcrafter không đổi           | `[SRC]`                                                                                                        |
| A4  | Conversation cũ tạo bởi Deep Research có `model = "deep-research"` (`researchService.server.ts:37`) sẽ tự fallback `DEFAULT_MODEL`                                    | `[SRC]` `modelRegistry.ts:441-445` `coerceStoredModel` → `isSelectableModelId ? normalized : DEFAULT_MODEL`    |
| A5  | `RankConfig.features` có index signature `[key: string]: boolean` → bỏ field `deep_research` khỏi interface không làm vỡ dữ liệu JSONB còn chứa `deep_research`       | `[SRC]` `limits.ts:22-27`                                                                                      |
| A6  | `features` từ `useModelSelection` chỉ được ChatApp dùng cho `deepResearchAllowed`                                                                                     | `[SRC]` `ChatApp.tsx:157,247`; `useModelSelection.ts:96` (giữ nguyên return của hook)                          |
| A7  | `logger` trong `genaiClient.ts` chỉ được dùng trong `getResearchInteraction` → xóa import                                                                             | `[SRC]` `genaiClient.ts:7,275`; grep count `logger.` = 1                                                       |
| A8  | `ServiceUnavailableError` vẫn dùng ở phần khác của `limits.ts` → giữ import                                                                                           | `[CMD]` grep count 10 trong `limits.ts`                                                                        |
| A9  | Modal "Configure Features" trong admin chỉ có một mục `deep_research` → sau khi xóa sẽ rỗng → gỡ cả nút + modal + state `featureModalRank` + icon `Settings2`         | `[SRC]` `RankConfigManager.tsx:259-271,329-393`                                                                |
| A10 | `tsconfig.json:30,33` include `.next/types/**` và `.next/dev/types/**` → validator cũ có thể còn tham chiếu route đã xóa → chạy `npx next typegen` trước `type-check` | `[SRC]` tsconfig; `[SRC]` next docs `next.md:178`                                                              |
| A11 | `ChatControls` + `InputForm` nằm trong `@container/chat`                                                                                                              | `[SRC]` `ChatApp.tsx:294`                                                                                      |
| A12 | Không có e2e/tests ngoài `src/` tham chiếu research                                                                                                                   | `[CMD]` grep `{tests,e2e,scripts}/**` chỉ ra `scripts/verify-rls-negative-probe.ts` (đụng bảng DB, giữ nguyên) |

**`[NEEDS_PRODUCT_DECISION]`**

- **D1 – Dữ liệu DB**: Có DROP bảng/cột/RPC research không? **Default**: KHÔNG trong task này (không phá hủy, có thể hoàn tác bằng `git revert`); đề xuất plan migration riêng sau khi xác nhận không cần lưu báo cáo cũ.
- **D2 – Model/Thinking trong Image Mode**: **Default**: ẩn cụm Model/Thinking khi `isImageMode` (giống Mic hiện đang ẩn, `InputForm.tsx:334`) vì Image Gen dùng model riêng.
- **D3 – Governance follow-up**: cập nhật ví dụ trỏ `deep-research` trong `.agents/**` bằng plan governance riêng (file khóa).

**Cross-task**: Plan `docs/plans/2026-10-25-novelcrafter-sudowrite-refactor-and-ui-audit-implementation-plan.md` cùng ngày có nhắc `ModelSelector` — thay đổi ở đây giữ variant mặc định nên không xung đột.

### 4. Bảng Verified Versions

| Thư viện                            | `package.json` `[SRC]`        | Tài liệu 2026 `[URL]`                                                                                                     | Ghi chú áp dụng                                                                |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ | ------------------------ |
| `next`                              | `^16.4.0` (`package.json:64`) | `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md` (`next typegen`)                                     | Xóa route handler → tái sinh types                                             |
| `react` / `react-dom`               | `^19.2.3`                     | https://react.dev/reference/react                                                                                         | —                                                                              |
| `@radix-ui/react-dropdown-menu`     | `^2.1.16`                     | https://www.radix-ui.com/primitives/docs/components/dropdown-menu                                                         | `Content` `align: start                                                        | center | end`, `collisionPadding` |
| `@radix-ui/react-popover`           | `^1.1.15`                     | https://www.radix-ui.com/primitives/docs/components/popover                                                               | `align="end"`, `collisionPadding` cho ModelSelector inline                     |
| `lucide-react`                      | `^0.562.0`                    | https://lucide.dev/icons/brain                                                                                            | Icon `Brain` (đã import tại `ThinkingLevelSelector.tsx:4`)                     |
| `tailwindcss`                       | `^4.1.18`                     | https://tailwindcss.com/docs/responsive-design#container-queries                                                          | Container query `@sm/chat:`                                                    |
| `@google/genai`                     | `^2.10.0`                     | https://ai.google.dev/gemini-api/docs/interactions                                                                        | Chỉ gỡ code dùng Interactions API; không đổi version                           |
| `vitest` / `@testing-library/react` | `^4.1.12` / `^16.3.1`         | https://vitest.dev/api/ · https://testing-library.com/docs/react-testing-library/api                                      | Test component + probe                                                         |
| UX tham chiếu                       | —                             | https://9to5google.com/2025/10/09/gemini-app-prompt-bar-redesign/ · https://aiuxplayground.com/teardowns/chatgpt/composer | Gemini: model picker ở góc dưới-phải prompt bar; ChatGPT: Think trong composer |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**Phần A — Gỡ Deep Research**

- `[DELETE]` `src/app/api/deep-research/route.ts`
- `[DELETE]` `src/app/api/deep-research/[taskId]/route.ts`
- `[DELETE]` `src/app/api/deep-research/[taskId]/approve/route.ts`
- `[DELETE]` `src/app/api/deep-research/[taskId]/stream/route.ts`
- `[DELETE]` `src/lib/features/research/researchService.server.ts` _(nhạy cảm `_.server.ts`→ guard sẽ`ask`)\*
- `[DELETE]` `src/lib/features/research/researchService.server.test.ts` _(test file → `ask`; Loại C)_
- `[DELETE]` `src/lib/features/research/types.ts`
- `[DELETE]` `src/app/features/research/components/ResearchAgentSelector.tsx`
- `[DELETE]` `src/app/features/research/components/ResearchPlanCard.tsx`
- `[DELETE]` `src/app/features/research/components/ResearchProgressCard.tsx`
- `[DELETE]` `src/app/features/research/components/ResearchReportCard.tsx`
- `[DELETE]` `src/app/features/research/components/ResearchReportPanel.tsx`
- `[DELETE]` `src/app/features/research/components/ResearchThinkingPanel.tsx`
- `[DELETE]` `src/app/features/research/components/EditPlanModal.tsx`
- `[DELETE]` `src/app/features/chat/components/ChatDeepResearch.tsx`
- `[DELETE]` `src/app/features/chat/components/hooks/useDeepResearchMode.ts`
- `[DELETE]` `src/app/features/chat/components/hooks/useResearchAwareSend.ts`
- `[MODIFY]` `src/lib/core/genaiClient.ts` — xóa khối "Deep Research Interactions API" (`:85-390`) + import `logger`
- `[NEW]` `src/lib/core/genaiClient.test.ts` — co-located test bắt buộc (file chưa có test)
- `[MODIFY]` `src/lib/core/limits.ts` — xóa `daily_research_limit`, `features.deep_research` khỏi `RankConfig` + 2 fallback config; xóa `getResearchDailyCount`, `tryClaimResearchSlot` (`:322-406`)
- `[MODIFY]` `src/lib/core/limits.test.ts` — xóa `describe("tryClaimResearchSlot")` (`:212-245`) + field fixture (`:89,91`); thêm Negative Probe export
- `[MODIFY]` `src/lib/core/modelRegistry.ts` — xóa `modelSupportsDeepResearch` (`:620-629`)
- `[MODIFY]` `src/lib/core/modelRegistry.test.ts` — thêm Negative Probe export
- `[MODIFY]` `src/app/api/admin/rank-configs/route.ts` — xóa field `daily_research_limit` khỏi type + nhánh validate (`:67,108-121`)
- `[MODIFY]` `src/app/api/admin/rank-configs/route.test.ts` — thay 2 case `daily_research_limit` (`:295-345`) bằng case "field bị bỏ qua"
- `[MODIFY]` `src/app/api/user/allowed-models/route.test.ts` — bỏ `daily_research_limit` / `deep_research` khỏi fixture (`:54,56,79,81`)
- `[MODIFY]` `src/app/admin/components/RankConfigManager.tsx` — bỏ ô Daily Research Limit, nút + modal Configure Features, state `featureModalRank`, icon `Settings2`, field interface
- `[MODIFY]` `src/app/features/chat/components/ChatApp.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatConversationView.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatOverlays.tsx`
- `[MODIFY]` `src/app/features/chat/components/DashboardView.tsx` — bỏ prop `isDeepResearchMode`, nhánh greeting research, `Microscope`
- `[MODIFY]` `src/app/features/chat/components/ChatMessagesArea.tsx` — chỉ sửa comment `:310`
- `[MODIFY]` `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts` — xóa khối `// Deep Research` (44 key `deepResearch*`) + `configureFeatures` + `dailyResearchLimit`

**Phần B — Thu gọn thanh chat**

- `[NEW]` `src/app/features/chat/components/InputModelControls.tsx` — gom ModelSelector + ThinkingLevelSelector cho ô nhập (~60 dòng)
- `[NEW]` `src/app/features/chat/components/InputModelControls.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/ChatControls.tsx` — bỏ mục `model`, `thinking`, `deep-research`; truyền `InputModelControls` vào `InputForm`
- `[MODIFY]` `src/app/features/chat/components/chatControlsProps.ts`
- `[MODIFY]` `src/app/features/chat/components/InputForm.tsx` — prop slot `trailingControls`, bố cục 2 hàng
- `[MODIFY]` `src/app/features/chat/components/InputForm.test.tsx`
- `[MODIFY]` `src/app/features/chat/components/ModelSelector.tsx` — prop `variant?: "toolbar" | "inline"`
- `[MODIFY]` `src/app/features/chat/components/ThinkingLevelSelector.tsx` — trigger gọn kiểu ChatGPT + prop `expandDown`

**Phần C — Living docs**

- `[MODIFY]` `docs/CHANGELOG.md`
- `[MODIFY]` `docs/database-schema.md` — đánh dấu `research_tasks`, `daily_research_counts`, `rank_configs.daily_research_limit`, RPC là **legacy (không còn code ứng dụng dùng; chờ D1)**
- `[MODIFY]` `docs/security.md` — ghi chú tương tự tại `:19-22,40-41`

### 6. Caller-First Design Sketch

**6.1 Call site trong `ChatControls.tsx` (sau thay đổi)**

```tsx
<InputForm
  /* ...props hiện có giữ nguyên... */
  trailingControls={
    <InputModelControls
      currentModel={currentModel}
      onSelectModel={handleModelChange}
      isModelAllowed={isModelAllowed}
      thinkingLevel={thinkingLevel}
      setThinkingLevel={setThinkingLevel}
      disabled={isStreaming || regenerating}
      expandDown={isLanding}
    />
  }
/>
```

**6.2 `InputModelControls.tsx` [NEW]**

```tsx
interface InputModelControlsProps {
  currentModel: string;
  onSelectModel: (id: string) => void;
  isModelAllowed: (id: string) => boolean;
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  disabled: boolean;
  expandDown?: boolean;
}

export default function InputModelControls(props: InputModelControlsProps) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <ModelSelector
        variant="inline"
        currentModelId={props.currentModel}
        onSelectModel={props.onSelectModel}
        isModelAllowed={props.isModelAllowed}
        disabled={props.disabled}
        expandDown={props.expandDown}
      />
      {modelSupportsThinkingUI(props.currentModel) && (
        <ThinkingLevelSelector
          thinkingLevel={props.thinkingLevel}
          setThinkingLevel={props.setThinkingLevel}
          currentModel={props.currentModel}
          expandDown={props.expandDown}
        />
      )}
    </div>
  );
}
```

**6.3 `InputForm.tsx` — slot & bố cục**

```tsx
interface InputFormProps {
  // ...
  /** Composer-level controls (model / thinking) rendered right-aligned before Mic/Send. */
  trailingControls?: React.ReactNode;
}

// Input row: luôn 2 hàng
<div className={`flex flex-wrap items-end gap-2 p-2 ${hasFiles ? "pt-0" : ""}`}>
  {/* Textarea: order-first basis-full trên MỌI breakpoint (bỏ md:order-none md:basis-auto md:flex-1) */}
  {/* [+] trái */}
  <div className="flex items-center gap-1 @sm/chat:gap-2 ml-auto min-w-0">
    {!isImageMode && trailingControls} {/* D2 */}
    {isImageMode && <CancelImageModeButton />}
    {!isImageMode && <VoiceButton />}
    <SendButton />
  </div>
</div>;
```

**6.4 Trigger styles (design tokens, ≥ `text-xs`, hit target 40px)**

- `ModelSelector variant="inline"` trigger: `h-10 inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.97]`; tên model bọc `<span className="truncate max-w-[7rem] @sm/chat:max-w-[12rem]">`; `aria-label={`${t("selectModel")}: ${name}`}`; `PopoverContent align="end" collisionPadding={8}` (variant `toolbar` giữ `align="start"`, class cũ nguyên vẹn). Trạng thái `disabled` của inline dùng cùng kích thước + `opacity-50 cursor-not-allowed`.
- `ThinkingLevelSelector` trigger: `h-10 inline-flex items-center gap-1.5 rounded-full px-2.5 @sm/chat:px-3 text-xs font-semibold` + `<Brain className="w-4 h-4" />` luôn hiện; nhãn mức (`currentOption.label`, ví dụ "Sâu") hiển thị `hidden @sm/chat:inline`; khi mức ≠ `off` dùng nền `bg-(--accent)/15 text-(--accent) border border-(--accent)/30` (khác biệt về fill + border, không chỉ màu); khi `off` nền trong suốt. `aria-label={`${t("thinkingLevel")}: ${currentOption.label}`}`, `title={t("thinkingLevelTooltip")}`, thêm `type="button"`. `DropdownMenuContent side={expandDown ? "bottom" : "top"} align="end" collisionPadding={8}`.
- Không thêm translation key mới.

**6.5 Test-side sketch**

```tsx
render(
  <InputForm
    input=""
    onChangeInput={vi.fn()}
    onSubmit={vi.fn()}
    trailingControls={<div data-testid="trailing" />}
  />
);
const trailing = screen.getByTestId("trailing");
const send = screen.getByRole("button", { name: /^send$/i });
expect(
  trailing.compareDocumentPosition(screen.getByTestId("voice-button")) &
    Node.DOCUMENT_POSITION_FOLLOWING
).toBeTruthy();
expect(trailing.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
```

**6.6 Sau-gỡ ChatApp (trích)**

```tsx
const handleMessageSend = chat.handleSend;               // thay useResearchAwareSend
const { isModelAllowed, handleModelChange } = useModelSelection({...});
const showLanding = !isRemixMode && !showProjectView && (!selectedConversationId || renderedMessages.length === 0);
<ChatControls {...controlsProps} />                     // bỏ selectedResearchAgent/onResearchAgentChange
<ChatOverlays modals imageGen projectNav shortcuts conversations onNewChat onSelectConversation t />
```

### 7. Các Bước Thực Hiện Tuần Tự

**Bước 0 — Baseline**

- [x] `npm run type-check; npm run lint; npm run test:run` → ghi số test PASS baseline.

**Bước 1 — Gỡ consumer UI trước (từ ngoài vào trong)**

- [x] `ChatControls.tsx`: xóa props `deepResearchEnabled`, `toggleDeepResearch`, `deepResearchAllowed`, `selectedResearchAgent`, `onResearchAgentChange`; xóa mục `deep-research`, state `showAgentSelector`, import `Microscope`, `Popover*`, `ResearchAgentSelector`, `ResearchAgent`, `modelSupportsDeepResearch`.
- [x] `chatControlsProps.ts`: bỏ `research`, `deepResearchAllowed`, 3 dòng map; `SharedChatControlsProps = Omit<ChatControlsProps, "isLanding">`; bỏ import `UseDeepResearchModeReturn`.
- [x] `ChatConversationView.tsx`: bỏ `research`, `showResearch`, `onEditPlan`, lazy `ChatDeepResearch`, `lazy`/`Suspense` import, children; cập nhật JSDoc.
- [x] `ChatOverlays.tsx`: bỏ 3 panel research, props `research`, `isEditPlanOpen`, `closeEditPlan`, `onOpenResearchConversation`, import `toast` + 3 lazy import; cập nhật JSDoc.
- [x] `ChatApp.tsx`: bỏ `useDeepResearchMode`, `useResearchAwareSend`, `isEditPlanOpen`, `hasActiveResearch`, `deepResearchAllowed`, `features`, props research ở `ChatConversationView`/`ChatControls`/`ChatOverlays`; `handleSend: chat.handleSend`.
- [x] `DashboardView.tsx`: bỏ prop + nhánh `isDeepResearchMode` (`:23,101,171-199,206`) và `Microscope`.
- [x] `ChatMessagesArea.tsx:310`: comment → `{/* Appended cards slot */}`.
- [x] `npm run type-check`.

**Bước 2 — Xóa file research**

- [x] Xóa 16 file `[DELETE]` (§5 Phần A). Chạy `npx next typegen` rồi `npm run type-check`. Nếu tsc báo lỗi từ `.next/types/**` / `.next/dev/types/**` còn tham chiếu `deep-research` → xin phép user xóa 2 thư mục build artifact này rồi chạy lại.

**Bước 3 — Core (sau `/blast-radius` §3.2 bên dưới)**

- [x] `genaiClient.ts`: xóa `:85-390` và `import { logger }`.
- [x] `limits.ts`: xóa field + fallback + 2 hàm.
- [x] `modelRegistry.ts`: xóa `modelSupportsDeepResearch`.
- [x] Cập nhật/tạo test co-located (Test Contract T5–T7). `npm run type-check`.

**Bước 4 — Admin**

- [x] `RankConfigManager.tsx`: xóa ô Daily Research Limit (`:195-212`), nút Configure Features (`:259-271`), modal (`:329-393`), `featureModalRank`, `Settings2`, `deep_research?`/`daily_research_limit?` trong interface.
- [x] `rank-configs/route.ts`: xóa `daily_research_limit?: unknown` + nhánh `:108-121`.
- [x] `rank-configs/route.test.ts` + `allowed-models/route.test.ts` theo T8–T9.

**Bước 5 — Translations**

- [x] Xóa khối `// Deep Research` trong `en.ts:851-895` / `vi.ts:858-902` và `configureFeatures`, `dailyResearchLimit` ở cả hai file. Grep xác nhận 0 tham chiếu `t("deepResearch`, `t.deepResearch`, `"configureFeatures"`, `"dailyResearchLimit"`. `npm run type-check` (parity `index.ts`).

**Bước 6 — Thu gọn thanh chat**

- [x] `ModelSelector.tsx`: thêm `variant` (default `"toolbar"`, class cũ giữ nguyên byte-for-byte); nhánh `inline` theo §6.4.
- [x] `ThinkingLevelSelector.tsx`: trigger mới + prop `expandDown` theo §6.4.
- [x] Tạo `InputModelControls.tsx` theo §6.2.
- [x] `InputForm.tsx`: thêm `trailingControls`; bố cục 2 hàng; cụm phải `ml-auto min-w-0`.
- [x] `ChatControls.tsx`: bỏ mục `model` + `thinking`, import `ModelSelector`/`ThinkingLevelSelector`/`modelSupportsThinkingUI`; truyền `InputModelControls`. Toolbar còn: Web · Always Search (Gemini) · Local Sampling · Gem · Persona · Conflict · Files.
- [x] Tạo `InputModelControls.test.tsx`, cập nhật `InputForm.test.tsx` (T1–T4).

**Bước 7 — Verification & Docs**

- [x] Chạy toàn bộ §9 (type-check, lint, test:run, probes).
- [x] Kiểm tra thủ công (`npm run dev`): viewport 375px, 768px, 1280px; landing + conversation; sidebar mở/đóng; mở dropdown Model/Thinking không tràn viewport; Tab/Enter/Esc.
- [x] Cập nhật `docs/CHANGELOG.md`, `docs/database-schema.md`, `docs/security.md`.
- [x] Đổi Header plan sang `- **Status**: Completed`.

#### 3.2 Blast-Radius (vikini-investigate Mode 4)

| Symbol                                                       | Caller                                                                                                      | `file:line`           | Tầng | Cách tham chiếu  | Compatible?                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------- | ---- | ---------------- | ---------------------------- |
| `createResearchInteraction`                                  | `researchService.server.ts`                                                                                 | `:5,151,241`          | 1    | static import    | No → file bị DELETE cùng lúc |
| `createResearchInteraction`                                  | stream route                                                                                                | `stream/route.ts:173` | 1    | dynamic import   | No → DELETE                  |
| `getResearchInteraction`                                     | `researchService.server.ts`                                                                                 | `:5,326`              | 1    | static           | No → DELETE                  |
| `tryClaimResearchSlot`                                       | `researchService.server.ts`                                                                                 | `:6,118`              | 1    | static           | No → DELETE                  |
| `tryClaimResearchSlot`                                       | `limits.test.ts`                                                                                            | `:212-245`            | 1    | test             | Loại C → xóa describe        |
| `getResearchDailyCount`                                      | chỉ nội bộ `limits.ts:375,389`                                                                              | —                     | 1    | nội bộ           | Xóa cùng                     |
| `genaiClient` + `limits` mocks                               | `researchService.server.test.ts`                                                                            | `:181-186`            | 1    | mock             | DELETE                       |
| `checkResearchStatus` et al.                                 | `stream/route.ts:12,152`, `[taskId]/route.ts:9`, `approve/route.ts:7`, `route.ts:7`                         | —                     | 2    | static + dynamic | DELETE toàn bộ               |
| `modelSupportsDeepResearch`                                  | `ChatControls.tsx`                                                                                          | `:24,134`             | 1    | static           | Sửa ở Bước 1                 |
| `RankConfig.daily_research_limit` / `features.deep_research` | `limits.ts:75,77,88,90,361,392`; `limits.test.ts:89,91,215-216`; `allowed-models/route.test.ts:54,56,79,81` | —                     | 1    | type/fixture     | Sửa fixtures (Loại B)        |
| `research/types.ts` exports                                  | `useDeepResearchMode.ts:5`, `ChatControls.tsx:27`, `ChatDeepResearch.tsx:9`, 4 component research, 2 route  | —                     | 1    | static           | Tất cả DELETE/MODIFY         |
| `getUserLimits` (giữ nguyên, trả về object ít field hơn)     | `allowed-models/route.ts:23` trả `features` nguyên khối                                                     | —                     | 1    | static           | Yes — JSONB vẫn chuyển qua   |

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID  | File                                                                                                          | Input                                                                                            | Output kỳ vọng                                                                                                                                                                                    | Failure mode bị bắt                  |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| T1  | `InputForm.test.tsx`                                                                                          | `trailingControls={<div data-testid="trailing"/>}`, không image mode                             | `trailing` tồn tại; đứng **trước** `voice-button` và nút `Send` theo `compareDocumentPosition`                                                                                                    | Slot không render / sai vị trí       |
| T2  | `InputForm.test.tsx`                                                                                          | `trailingControls` + `initialImageMode`                                                          | `queryByTestId("trailing")` là `null`; nút "Cancel Image Mode" vẫn có                                                                                                                             | D2 vi phạm                           |
| T3  | `InputForm.test.tsx`                                                                                          | không truyền `trailingControls`                                                                  | Toàn bộ test cũ (Send/Stop state machine, IME, voice language) PASS **không sửa expect**                                                                                                          | Regression                           |
| T4  | `InputForm.test.tsx`                                                                                          | render mặc định                                                                                  | textarea (`getByPlaceholderText("Type a message...")`) đứng trước nút `Upload/Add` (`aria-label` addAttachment) trong DOM; wrapper textarea có class `basis-full` và **không** có `md:basis-auto` | Bố cục 2 hàng bị quay lại            |
| T5  | `InputModelControls.test.tsx` (mock `./ModelSelector`, `./ThinkingLevelSelector`, `./hooks/useThinkingLevel`) | `modelSupportsThinkingUI → true`, `disabled=false`                                               | Cả 2 mock render; ModelSelector nhận `variant="inline"`, `disabled=false`; Thinking nhận `currentModel`                                                                                           | Thiếu wiring                         |
| T5b | như trên                                                                                                      | `modelSupportsThinkingUI → false`                                                                | ModelSelector render, ThinkingLevelSelector **không** render                                                                                                                                      | Hiện thinking cho model không hỗ trợ |
| T5c | như trên                                                                                                      | `disabled=true`, `expandDown=true`                                                               | ModelSelector nhận `disabled=true`, `expandDown=true`; Thinking nhận `expandDown=true`                                                                                                            | Cho đổi model khi đang stream        |
| T6  | `limits.test.ts`                                                                                              | `import * as limits`                                                                             | `"tryClaimResearchSlot" in limits === false`, `"getResearchDailyCount" in limits === false`; các describe khác PASS nguyên vẹn                                                                    | Code chết sót lại                    |
| T7  | `modelRegistry.test.ts`                                                                                       | `import * as registry`                                                                           | `"modelSupportsDeepResearch" in registry === false`                                                                                                                                               | Sót export                           |
| T7b | `genaiClient.test.ts` [NEW] (mock `@/lib/env`, `@google/genai`)                                               | env có `GEMINI_API_KEY="k"` gọi `getGenAIClient()` 2 lần                                         | Cùng instance; constructor gọi 1 lần với `{ apiKey: "k" }`; `getGenAIClientInfo().cached === true`                                                                                                | Cache vỡ                             |
| T7c | như trên                                                                                                      | xóa `GEMINI_API_KEY`/`GOOGLE_API_KEY`                                                            | throw `"AI service configuration is missing"` (không lộ tên env)                                                                                                                                  | Lộ cấu hình                          |
| T7d | như trên                                                                                                      | `import * as mod`                                                                                | `"createResearchInteraction" in mod === false`, `"getResearchInteraction" in mod === false`                                                                                                       | Sót export                           |
| T8  | `rank-configs/route.test.ts`                                                                                  | PATCH admin, config hợp lệ + `daily_research_limit: -1`                                          | **200** `{ updated: true }`; payload gửi `.update()` **không** chứa key `daily_research_limit` (`expect(updateMock.mock.calls[0][0]).not.toHaveProperty("daily_research_limit")`)                 | Route còn validate/ghi cột legacy    |
| T8b | như trên                                                                                                      | Các case auth (403), rank không hợp lệ (400), `daily_message_limit`/`max_file_size_mb` sai (400) | Giữ nguyên PASS, không sửa expect                                                                                                                                                                 | Regression validate                  |
| T9  | `allowed-models/route.test.ts`                                                                                | Fixture bỏ field research                                                                        | Assertion cũ về `allowedModels`, `features` PASS (`features` vẫn trả nguyên object mock)                                                                                                          | Type error fixture                   |

**Chống specification gaming**: cấm `.skip/.only/.fails`, cấm nới matcher; số test PASS cuối ≥ baseline − (số test trong `researchService.server.test.ts` + 4 test `tryClaimResearchSlot` + 2 test `daily_research_limit` cũ) + số test mới T1–T9. `@qa` đối chiếu chênh lệch bằng output `vitest`.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

**Co-located tests**: `src/lib/core/genaiClient.test.ts` [NEW], `src/lib/core/limits.test.ts`, `src/lib/core/modelRegistry.test.ts`, `src/app/features/chat/components/{InputForm,InputModelControls}.test.tsx`, `src/app/api/admin/rank-configs/route.test.ts`, `src/app/api/user/allowed-models/route.test.ts`.

**Lệnh (PowerShell 5.1, dùng `;`)**

```powershell
npx next typegen; npm run type-check; npm run lint
npx vitest run src/lib/core src/app/features/chat/components src/app/api/admin/rank-configs src/app/api/user/allowed-models --reporter=dot
npm run test:run -- --reporter=dot
```

**Wiring Probes**

- W1: `T1` + `T5` chứng minh `ChatControls → InputForm.trailingControls → InputModelControls → ModelSelector(variant="inline") / ThinkingLevelSelector`.
- W2: Grep `ModelSelector` trong `ChatControls.tsx` = 0 dòng JSX trực tiếp; `InputModelControls` = 1 import + 1 JSX.
- W3: `NovelcrafterTopBar.tsx:202` không truyền `variant` → dùng nhánh `toolbar` (type-check + so sánh class cũ trong diff `ModelSelector.tsx`).

**Negative Probes (phải trả 0 kết quả / False)**

- N1: Grep (ripgrep, `-i`) `deep[-_ ]?research|ResearchTask|ResearchAgent|features/research|useDeepResearchMode|useResearchAwareSend|ChatDeepResearch|tryClaimResearchSlot|ResearchInteraction` trong `src/` → **0 hit** (lưu ý: `src/types/database.types.ts` chỉ chứa `daily_research_counts`/`research_tasks`, không khớp pattern).
- N2: `Test-Path "src/app/api/deep-research"`, `Test-Path "src/lib/features/research"`, `Test-Path "src/app/features/research"` → `False`.
- N3: Grep `t\("(deepResearch|configureFeatures|dailyResearchLimit)` và `t\.deepResearch` trong `src/` → 0.
- N4: T6, T7, T7d (export absence) và T8 (`daily_research_limit` bị bỏ qua, không ghi DB) PASS.
- N5: T5b (không render thinking cho model không hỗ trợ) và T2 (ẩn trong image mode) PASS.
- N6: Grep `text-\[10px\]|text-\[11px\]` trong `InputModelControls.tsx` và trong nhánh `inline` của `ModelSelector.tsx` + toàn bộ `ThinkingLevelSelector.tsx` → 0 (03-ui.md).
- N7: `npm run lint` 0 error (rule `no-explicit-any`, `no-console` đang `error` theo `01-coding.md:15`).

**Manual (UI)**: 375px (iPhone SE): hàng 2 chứa `[+] [Model…] [🧠] [Mic] [Send]` không tràn/không wrap; 768px & 1280px: nhãn mức Thinking hiện; dropdown nằm trong viewport; focus ring hiện khi Tab; screen reader đọc "Chọn Model: <tên>" và "Suy luận: <mức>"; ngôn ngữ EN/VI chuyển đúng.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                         | Mức        | Technical control                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ----------------------------------------------------------------------------------- |
| Sót tham chiếu tới module đã xóa (static/dynamic import) gây build fail        | Cao        | Blast-radius §3.2 (dynamic import `stream/route.ts:152,173` nằm trong file bị xóa); Negative Probe N1/N2; `npm run type-check`                                     |
| `.next/types` cũ tham chiếu route đã xóa → `tsc` fail                          | Trung bình | `tsconfig.json:30,33`; bước `npx next typegen` (`next.md:178`); fallback xin phép xóa artifact                                                                     |
| Conversation cũ có `model="deep-research"` hỏng UI/stream                      | Trung bình | `coerceStoredModel` `modelRegistry.ts:441-445` fallback `DEFAULT_MODEL`; stream server dùng `assertModelAllowedForUser` `limits.ts:477-494` với model đã normalize |
| Admin lưu config gửi kèm `daily_research_limit`/`features.deep_research` từ DB | Thấp       | Route không còn đưa `daily_research_limit` vào `updatePayload` (T8); `features` JSONB chuyển nguyên trạng — vô hại vì không còn code đọc                           |
| ModelSelector đổi style làm vỡ Novelcrafter                                    | Trung bình | `variant` mặc định `"toolbar"` giữ class cũ; W3 + type-check                                                                                                       |
| Hàng nút mobile 375px bị tràn khi tên model dài                                | Trung bình | `truncate max-w-[7rem]` + Thinking icon-only dưới `@sm/chat` (§6.4); `min-w-0` trên cụm phải; kiểm tra thủ công Bước 7                                             |
| Đổi model khi đang stream                                                      | Trung bình | `disabled={isStreaming                                                                                                                                             |     | regenerating}` chuyển nguyên vẹn (`ChatControls.tsx:156`→`InputModelControls`); T5c |
| Test bị "làm yếu" khi xóa                                                      | Trung bình | Chỉ xóa test của code chết (Loại C, liệt kê §8); T3/T8b giữ expect cũ; `02-quality.md:61-62`                                                                       |
| Plan/tài liệu governance `.agents/**` còn ví dụ trỏ route đã xóa               | Thấp       | Ghi follow-up D3 (file khóa)                                                                                                                                       |
| Dữ liệu research cũ trong DB không còn truy cập qua UI                         | Thấp       | Không DROP (D1); dữ liệu còn nguyên trong `research_tasks` để xử lý sau                                                                                            |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Kiểm Chứng Lỗi Cũ

_Đây là Audit Run 1 (Revision 1), chưa có mã lỗi từ các lượt thẩm định trước._

| Mã lỗi | Trạng thái | Chi tiết & Bằng chứng (`[SRC]` / `[CMD]`) |
| ------ | ---------- | ----------------------------------------- |
| N/A    | N/A        | Không có lỗi tồn đọng từ vòng trước       |

#### 2. Phát Hiện Mới

Không phát hiện lỗi `[BLOCKER]` hoặc `[MAJOR]`. Toàn bộ thiết kế phân tầng, ranh giới kiến trúc, co-located test contract và xử lý thu gọn giao diện đều đáp ứng các tiêu chuẩn kỹ thuật của Vikini.

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Probe 1: Novelcrafter Regression Probe**
   - _Rủi ro_: Thay đổi props và giao diện của `ModelSelector.tsx` có thể gây lỗi hiển thị hoặc crash thanh công cụ `NovelcrafterTopBar.tsx:202`.
   - _Kiểm chứng_: Khảo sát `NovelcrafterTopBar.tsx:202-208` (`[SRC]`), component gọi `<ModelSelector currentModelId={selectedModel} onSelectModel={onSelectModel} isModelAllowed={...} disabled={false} expandDown={true} />` mà không truyền prop `variant`. Trong thiết kế của plan, prop `variant` có giá trị mặc định `"toolbar"`, giữ nguyên cấu trúc DOM và class Tailwind cũ byte-for-byte. `Wiring Probe W3` và `npm run type-check` bảo đảm tính tương thích ngược hoàn chỉnh.
2. **Probe 2: Dropdown Popover Viewport Overflow Probe (375px Viewport)**
   - _Rủi ro_: Đưa `ModelSelector` và `ThinkingLevelSelector` vào hàng 2 của ô nhập có thể làm vỡ layout trên màn hình hẹp (375px iPhone SE) hoặc khiến menu dropdown bị cắt mép màn hình.
   - _Kiểm chứng_: Trên hàng 2 của `InputForm.tsx`, nút `ThinkingLevelSelector` được thiết kế chỉ hiện icon não `Brain` khi ở container hẹp, nhãn text chỉ xuất hiện từ breakpoint `@sm/chat:inline`. Nút `ModelSelector` có `truncate max-w-[7rem]`. Dropdown Popover được cấu hình `align="end"`, `collisionPadding={8}` (khớp đặc tả Radix UI 2026 `[URL]`), và class popover content có `w-[min(350px,calc(100vw-2rem))]` (`ModelSelector.tsx:165` `[SRC]`), ngăn ngừa hiện tượng tràn mép màn hình.
3. **Probe 3: Next.js App Router Route Types Desync Probe**
   - _Rủi ro_: Sau khi xóa 4 route handlers trong `src/app/api/deep-research/**`, lệnh `tsc --noEmit` có thể đọc type definitions mồ côi trong `.next/types/app/api/deep-research/` và báo lỗi `TS2307`.
   - _Kiểm chứng_: Plan đưa bước `npx next typegen` (`[URL]` tài liệu Next.js 16 CLI 2026) vào Bước 2 và Bước 7 để tái sinh route types trước khi chạy kiểm tra TypeScript. Kế hoạch cũng dự phòng bước làm sạch thư mục build `.next/types` nếu phát sinh cache cũ.
4. **Probe 4: Test Suite Degradation & Mock Integrity Probe**
   - _Rủi ro_: Việc loại bỏ 16 file có thể bị lạm dụng để xóa bỏ assertions hoặc nới lỏng matcher trong test suite.
   - _Kiểm chứng_: Test Contract §8 phân định rõ chỉ xóa test file của chính module bị xóa (`researchService.server.test.ts` - Loại C). Các test core (`limits.test.ts`, `modelRegistry.test.ts`) được bổ sung Negative Probes (T6, T7, T7d) để xác nhận export đã bị gỡ khỏi module. Route test `rank-configs/route.test.ts` bổ sung test case T8 xác nhận route bỏ qua thuộc tính `daily_research_limit` mà không ghi vào DB. Tổng số test PASS cuối cùng được kiểm soát định lượng minh bạch.

#### 4. Plan Completeness Gate & Mental Simulation Matrix

##### Plan Completeness Gate (7 Hạng Mục)

| Hạng mục                                             | Trạng thái | Bằng chứng / Chi tiết                                                                                                              |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. Verified Versions                                 | PASS       | Next.js 16.4.0, React 19.2.3, Radix UI Popover/Dropdown, Tailwind CSS 4, Lucide React, Google GenAI SDK v2.10.0 (`[URL]`, `[SRC]`) |
| 2. Checklist tuần tự (`[NEW]`/`[MODIFY]`/`[DELETE]`) | PASS       | §5 & §7 phân định rõ ràng 16 file DELETE, 3 file NEW, 16 file MODIFY                                                               |
| 3. Verification Plan                                 | PASS       | Lệnh kiểm tra theo PowerShell 5.1, Wiring Probes W1–W3, Negative Probes N1–N7                                                      |
| 4. Test Contract                                     | PASS       | Bảng T1–T9 định nghĩa rõ Input, Output kỳ vọng, Failure Mode bị bắt, chống gaming test                                             |
| 5. Assumptions & Dependencies                        | PASS       | A1–A12 đối chiếu mã nguồn thực tế, quyết định D1–D3 minh bạch                                                                      |
| 6. Out of Scope                                      | PASS       | Phân định rõ ràng không can thiệp schema DB, không xóa migration cũ, không chạm `.agents/**`                                       |
| 7. Skills Loaded & Applied                           | PASS       | Đã ánh xạ `vikini-investigate` (Mode 4 Blast-radius), `vikini-simplify`, `add-translation`, `api-patterns`                         |

##### Mental Simulation Matrix (S1–S6 + Domain)

| Kịch bản                                     | Trạng thái | Loại bằng chứng  | Chi tiết đánh giá                                                                                                                                                                                                                            |
| -------------------------------------------- | ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   | PASS       | `[CMD]`, `[SRC]` | `npm run type-check` baseline PASS (exit code 0); `package.json` không dùng công nghệ ngoại lai; xử lý tái sinh route types bằng `next typegen`                                                                                              |
| **S2: Runner Lifecycle & Teardown**          | PASS       | `[SRC]`          | Gỡ sạch các luồng SSE stream và interval polling của research; cô lập test singleton `genaiClient` với mock env                                                                                                                              |
| **S3: Database & Temporal Logic**            | PASS       | `[SRC]`, `[ADV]` | Quyết định D1 bảo toàn schema và dữ liệu DB, tránh data loss; không chạy RPC hoặc query tới các bảng dormant; Timeline 1 AN TOÀN                                                                                                             |
| **S4: Cross-Task State Flow**                | PASS       | `[SRC]`          | Di chuyển Model/Thinking vào ô nhập qua `trailingControls`; `showLanding` và `DashboardView` được dọn dẹp state research gọn gàng                                                                                                            |
| **S5: Security Boundary & 3-Tier Auth**      | PASS       | `[SRC]`, `[ADV]` | Xóa bỏ route handler research; route admin giữ nguyên 3-tier auth và int4 validation; xử lý fallback model cũ về `DEFAULT_MODEL` an toàn; Timeline 2 & 3 AN TOÀN                                                                             |
| **S6: External Resilience & Serverless Cap** | PASS       | `[SRC]`          | Gỡ bỏ Interactions API không còn dùng trong `genaiClient.ts`; bổ sung co-located test `genaiClient.test.ts`; chat stream chính giữ nguyên `maxDuration = 800`                                                                                |
| **Domain: Open Inquiry**                     | PASS       | `[SRC]`, `[URL]` | Bố cục 2 hàng của `InputForm` đáp ứng chuẩn UX tương tự Gemini / ChatGPT; trigger nút bấm tuân thủ token hệ thống, kích thước tối thiểu 40px, font tối thiểu 12px; xóa sạch translation keys không còn dùng và bảo đảm tính đồng bộ song ngữ |

#### 5. Adversarial Timelines & Commands Executed

##### Adversarial Timelines

```
Cơ chế: Không DROP bảng / cột DB khi loại bỏ code ứng dụng (D1)
T1: Admin cập nhật rank config qua /api/admin/rank-configs không gửi daily_research_limit | T2: DB Supabase vẫn tồn tại cột daily_research_limit và bảng daily_research_counts | T3: Route handler tạo updatePayload hợp lệ, Supabase update thành công, cột cũ giữ nguyên giá trị
Kết cục: Không lỗi SQL, không crash runtime → AN TOÀN

Cơ chế: Phục hồi cuộc trò chuyện cũ có model = "deep-research"
T1: User mở một cuộc trò chuyện cũ lưu model "deep-research" | T2: modelRegistry.ts gọi coerceStoredModel("deep-research") | T3: Trả về DEFAULT_MODEL ("gemini-2.5-flash"); luồng gửi tin nhắn tiếp theo xác thực với DEFAULT_MODEL
Kết cục: Giao diện không lỗi, stream tiếp tục bình thường → AN TOÀN

Cơ chế: Chặn đổi model / thinking khi đang streaming trong InputForm
T1: User gửi tin nhắn, SSE chat stream đang hoạt động (isStreaming = true) | T2: User nhấn vào ModelSelector hoặc ThinkingLevelSelector trong InputModelControls | T3: Prop disabled = true làm vô hiệu hóa trigger button, Popover/Dropdown không mở
Kết cục: Không phát sinh race condition đổi model giữa chừng → AN TOÀN

Cơ chế: Trục Môi trường Serverless (Next.js App Router Instances)
T1: Client gửi request tới route /api/admin/rank-configs trên instance mới | T2: Config được cache tại Upstash Redis | T3: Route handler đọc cache hoặc DB nhất quán, loại bỏ trường daily_research_limit khỏi updatePayload
Kết cục: Hoạt động đồng bộ giữa các serverless instances → AN TOÀN
```

##### Commands Executed

- `npm run type-check`: Exit code 0 (Baseline check)
- `npm run test:run -- --reporter=dot`: Exit code 0 (176 test files, 1664 passed)
- `npm run lint`: Exit code 0 (ESLint clean, 0 errors)

#### 6. Kết Luận

Kế hoạch triển khai Revision 1 đáp ứng đầy đủ 7 hạng mục của Plan Completeness Gate, vượt qua 6 kịch bản Mental Simulation và 4 Attack Probes độc lập. Kế hoạch được phê duyệt để tiến hành thực thi theo đúng phạm vi đã khai báo.

[PLAN_APPROVED]
