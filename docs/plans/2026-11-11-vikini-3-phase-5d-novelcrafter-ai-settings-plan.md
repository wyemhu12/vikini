# Kế Hoạch Triển Khai: Vikini 3.0 — Giai Đoạn 5D: Novelcrafter — Trang Cài Đặt AI Của Truyện (Bảng Kế Thừa + Prompt Studio)

- **Revision**: 2
- **Status**: Approved
- **Date**: 2026-11-11
- **Author**: Gemini 4 Carbon (in-session; PM đã ủy quyền chạy liền 4B → 6) (`[PLANNER_MODEL: gemini-4-carbon]`)
- **Depends on**: Giai đoạn 5C (commit `9b125f8`, đã lên `main`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

Nguồn: canvas board **NovelAI** (`NovelAI.dc.html`: cột giữa "Cài đặt AI của truyện" gồm 2 thẻ tổng **GEM tổng · luôn áp dụng** & **Persona tổng · mặc định cho mọi tính năng** + bảng kế thừa 6 tính năng 4 cột `Tính năng | Persona | Model | AI sẽ nhận` tô nổi dòng ghi đè bằng `--soft`/`--accent`; cột phải `<aside aria-label="Prompt Studio">` `480px` gồm menu `Bộ mẫu`, `role="listbox"` "Hành động AI" bên trái `160px`, phần chi tiết hành động + công tắc "Ngữ cảnh gửi kèm" + "Xem trước prompt" kèm ước lượng token `≈ Xk token`) và brief (`docs/specs/2026-11-08-vikini-3-redesign-brief.md` dòng 83: `unified "Cài đặt AI của truyện" (GEM/Persona cascade + Prompt Studio)`).

Hiện trạng:

- Nút "Cài đặt AI" trên `NovelcrafterTopBar` mở hộp thoại hẹp `GemPersonaRoutingModal` (`src/app/features/novelcrafter/components/GemPersonaRoutingModal.tsx`, 242 dòng) chỉ có danh sách `<select>` Persona theo 6 tính năng, không có ghi đè Model theo tính năng, không hiển thị cột tổng hợp "AI sẽ nhận", và tách rời khỏi Prompt Studio qua liên kết sang `/novelcrafter/prompts`.
- Trang `/novelcrafter/prompts` (`src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx:21-88`) không có AppShell `Sidebar`, không thấy cài đặt GEM/Persona/Model của truyện, và các component con còn dùng token thế hệ cũ (`--surface-elevated`, `--control-bg`, `--text-secondary`, `uppercase tracking-wider`).

Mục tiêu Giai đoạn 5D:

1. **Logic kế thừa & ghi đè Model từng tính năng** (`aiInheritanceTable.ts` + mở rộng tương thích ngược `featureModels` trong `types.ts`, `stateLimits.ts`, `streamRequestBody.ts`, `useNovelcrafterStream.ts`, `useNovelcrafterStateMutators.ts`): mỗi slot trong 6 `NOVELCRAFTER_FEATURE_SLOTS` có thể chọn `"inherit"` (kế thừa `selectedModel` của truyện) hoặc ghi đè một model hợp lệ được phép dùng; tính sẵn chuỗi mô tả cột **"AI sẽ nhận"** và ước lượng token XML.
2. **Bảng kế thừa "Cài đặt AI của truyện"** (`NovelcrafterInheritanceTable.tsx`): tiêu đề `h1` "Cài đặt AI của truyện", tên truyện phía trên + nút quay lại bản thảo, 2 thẻ chọn nhanh **GEM tổng** và **Persona tổng** (kèm mở kho GEM/Persona qua `openGemModal` / `openPersonaModal`), và bảng 6 dòng × 4 cột (`Tính năng | Persona | Model | AI sẽ nhận`), tô nền `--soft` và viền/chữ `--accent` cho ô/dòng có ghi đè.
3. **Prompt Studio neo phải 480px** (nâng cấp bộ `components/prompt-studio/*` sang token Vikini 3.0): header "Prompt Studio" + menu `Bộ mẫu` (chọn preset có sẵn/tùy chỉnh, lưu preset mới, xóa preset tùy chỉnh, khôi phục tất cả), cột trái `role="listbox"` "Hành động AI" hỗ trợ phím ↑/↓/Home/End, cột phải chỉnh Directive + danh sách kiểm "Ngữ cảnh gửi kèm" + "Xem trước prompt" kèm badge `≈ X token` và nút Sao chép.
4. **Hợp nhất cả hai lối vào**: bấm "Cài đặt AI" trong `/novelcrafter` mở ngay `NovelcrafterAiSettingsWorkspace` toàn khung trong shell (không mất chữ đang soạn, đóng bằng nút quay lại hoặc `Escape`); truy cập `/novelcrafter/prompts` hiển thị cùng `NovelcrafterAiSettingsWorkspace` kèm `Sidebar`. Xóa `GemPersonaRoutingModal.tsx` đã được thay thế hoàn toàn.

**Out of Scope (What We're NOT Doing)**:

- Không đổi API/schema phía server (`*.server.ts`, `/api/novelcrafter/stream`) — client phân giải `effectiveModel` từ `routing.featureModels` trước khi gửi `model` lên `/api/novelcrafter/stream` (server đã kiểm tra `isValidGenerationModel` và `assertModelAllowedForUser`).
- Không làm khung soạn lệnh AI ở panel phải màn hình Viết, panel chi tiết chương ở Dàn ý, dock AI mobile hay nhóm chương theo hồi — thuộc Giai đoạn 5E.
- Không đổi logic lưu trữ `promptStudioStore` (vẫn dùng store hiện hữu, giữ nguyên preset tùy chỉnh của người dùng).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File / nguồn đã đọc                                                                                                                   | Nội dung rút ra                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas `NovelAI.dc.html` & `docs/specs/2026-11-08-vikini-3-redesign-brief.md`                                                         | Cột chính "Cài đặt AI của truyện" (2 thẻ tổng + bảng 6 tính năng × 4 cột tô nổi dòng ghi đè) + cột phải `Prompt Studio` `480px` (`Bộ mẫu`, `listbox` hành động, công tắc ngữ cảnh, xem trước XML kèm `≈ Xk token`) |
| `src/lib/features/novelcrafter/types.ts`, `stateLimits.ts`, `promptBuilder.ts`, `streamRequestBody.ts`, `src/lib/core/modelAccess.ts` | Schema `routing`, hàm `resolveEffectivePersonaId`, kiểm tra model hợp lệ `isSelectableModelId` + `isModelAllowedById`                                                                                              |
| `src/app/features/novelcrafter/components/GemPersonaRoutingModal.tsx`, `NovelcrafterStudioApp.tsx`, `components/prompt-studio/*`      | Cấu trúc hiện tại của modal routing và trang `/novelcrafter/prompts`                                                                                                                                               |

**Skills Loaded & Applied**

| Skill (`SKILL.md`)                           | Lý do nạp                                                                                    | Quyết định kỹ thuật chịu ảnh hưởng                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md`    | Nhãn bảng kế thừa 4 cột, trạng thái "AI sẽ nhận", menu Bộ mẫu & token preview                | Thêm khóa dịch song ngữ đồng thời ở `vi.ts` và `en.ts`, chỉ dùng `useLanguage()` |
| `.agents/skills/vikini-investigate/SKILL.md` | Mở rộng `NovelcrafterRoutingConfigSchema` và `buildNovelcrafterStreamRequestBody` dùng chung | Dùng `.optional()` cho `featureModels` để giữ 100% tương thích ngược             |

### 3. Assumptions & Cross-Task Dependencies

- **A1**: `NovelcrafterRoutingConfigSchema` (`src/lib/features/novelcrafter/types.ts:259-271`) hiện có `masterGemId`, `masterPersonaId`, `featurePersonas`. Thêm `featureModels: NovelcrafterFeatureModelsSchema.optional()` giữ tương thích ngược 100% với mọi bản ghi cũ trong DB và fixture test.
- **A2**: `resolveEffectivePersonaId` (`src/lib/features/novelcrafter/promptBuilder.ts:67-80`) là hàm chuẩn phân giải Persona (`"inherit"` → `masterPersonaId`, `"none"` → `null`, `<id>` → `<id>`). Tái sử dụng trực tiếp trong `aiInheritanceTable.ts`.
- **A3**: `buildNovelcrafterStreamRequestBody` (`src/lib/features/novelcrafter/streamRequestBody.ts:138-145`) hiện gán `model: opts.selectedModel`. Thay bằng `resolveEffectiveSlotModel(params.feature, opts.selectedModel, opts.routing, opts.allowedModelIds).modelId` giúp ghi đè Model theo tính năng hoạt động ngay cho mọi luồng stream mà không cần sửa `.server.ts`.
- **A4**: `MainLayout` (`src/app/features/layout/components/MainLayout.tsx:7-13`) đã bọc toàn ứng dụng trong `<main id="main">` và gắn sẵn `<LazyModals />` (`GemModal`, `PersonaModal`). Do đó `openGemModal(null)` và `openPersonaModal(null)` hoạt động ở cả `/novelcrafter` và `/novelcrafter/prompts`.
- **A5**: `NovelcrafterTopBar.test.tsx` (`src/app/features/novelcrafter/components/NovelcrafterTopBar.test.tsx:90-128`) kiểm tra nút `"Cài đặt AI"` gọi `onOpenRoutingModal` và mục menu `"Quản lý Prompt"` trỏ tới `/novelcrafter/prompts`. Giữ nguyên cả hai hợp đồng này → 0 ca test Loại C.

### 4. Quyết Định Thiết Kế (Design Decisions)

- **D1 — Mở rộng `featureModels` phía client thay vì đổi endpoint stream**: Server `/api/novelcrafter/stream` vốn nhận `model` theo từng request và xác thực quyền model (`assertModelAllowedForUser`). Phân giải model hiệu lực từ `routing.featureModels?.[feature]` ngay tại `streamRequestBody.ts` + `useNovelcrafterStream.ts` vừa đáp ứng đúng cột `Model` trên canvas `NovelAI`, vừa giữ nguyên ranh giới bảo mật server. Kiểm tra đồng thời `isSelectableModelId(coerced)` và `isModelAllowedById(coerced, allowedModelIds)` (tránh trường hợp `isModelAllowedById` cho qua model nội bộ `MODEL_IDS.NOVELCRAFTER` tại `src/lib/core/modelAccess.ts:36-38`); nếu không hợp lệ thì tự động lùi về `selectedModel` mặc định của truyện.
- **D2 — Thẻ chọn GEM tổng & Persona tổng dùng Radix `DropdownMenu`**: Hai nút thẻ lớn ở đầu trang (`border-(--accent)` khi đang gắn GEM/Persona, `border-(--line)` khi trống) mở `DropdownMenu` gồm `DropdownMenuRadioGroup` để đổi nhanh chỉ với 1 cú nhấp + mục cuối `"Mở kho GEMs"` / `"Mở kho Personas"` gọi `openGemModal(null)` / `openPersonaModal(null)`.
- **D3 — Ô chọn Persona & Model trong bảng 6 dòng dùng `<select>` có `aria-label` tường minh**: Đảm bảo thao tác bàn phím tự nhiên, tương thích tốt trên mobile 375px không bị tràn menu, và đạt chuẩn axe `select-name`. Ô có giá trị khác `"inherit"` mang viền & chữ `--accent`; dòng có bất kỳ ghi đè nào (Persona hoặc Model) mang nền `bg-(--soft)`.
- **D4 — Giữ trọn tính năng chỉnh Directive & Preset tùy chỉnh trong Prompt Studio**: Canvas tĩnh rút gọn phần Directive, nhưng người dùng hiện tại có tính năng sửa `draftDirective`, lưu override và quản lý Preset tùy chỉnh. Giữ đầy đủ `<textarea>` Directive (thu gọn `rows={3}`), nút Lưu/Khôi phục và menu `Bộ mẫu` ngay trong `<aside aria-label="Prompt Studio">` để không mất tính năng nào.
- **D5 — Không lồng thẻ `<main>`**: Vì `src/app/features/layout/components/MainLayout.tsx:8` đã render `<main id="main">`, cột trái của `NovelcrafterAiSettingsWorkspace` dùng thẻ `<div role="region" aria-labelledby={headingId}>` thay vì `<main>` để tránh vi phạm landmark lồng nhau.

### 4. Bảng Verified Versions

| Thư viện / Công cụ | `package.json` | Phiên bản | Ghi chú                                                                         | Nguồn                     |
| ------------------ | -------------- | --------- | ------------------------------------------------------------------------------- | ------------------------- |
| `react`            | `^19.2.3`      | 19.2      | Component state, `useId`, keyboard roving `tabIndex`                            | `[SRC]` `package.json:69` |
| `zod`              | `^4.2.1`       | 4.2       | Schema `.optional()` cho `featureModels` trên `NovelcrafterRoutingConfigSchema` | `[SRC]` `package.json:80` |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/lib/features/novelcrafter/types.ts` — thêm `NovelcrafterFeatureModelsSchema` và trường tùy chọn `featureModels` vào `NovelcrafterRoutingConfigSchema`.
- `[MODIFY]` `src/lib/features/novelcrafter/stateLimits.ts` — chuẩn hóa `routing.featureModels` khi đọc/lưu state truyện.
- `[NEW]` `src/lib/features/novelcrafter/aiInheritanceTable.ts` — hàm thuần `resolveEffectiveSlotModel`, `resolveFeatureInheritanceRows`, `estimatePromptTokens`, `formatApproxTokens`.
- `[NEW]` `src/lib/features/novelcrafter/aiInheritanceTable.test.ts` — unit test cho bảng kế thừa, fallback model không hợp lệ/không được phép, Persona bị xóa, và ước lượng token.
- `[MODIFY]` `src/lib/features/novelcrafter/streamRequestBody.ts` — dùng `resolveEffectiveSlotModel` chọn `model` gửi lên stream theo `params.feature`.
- `[MODIFY]` `src/lib/features/novelcrafter/streamRequestBody.test.ts` — bổ sung ca test ghi đè `featureModels` theo slot và fallback về `selectedModel` khi `"inherit"`.
- `[MODIFY]` `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts` — giữ `featureModels` trong `updateRouting` và thêm `updateFeatureModelSlot`.
- `[MODIFY]` `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts` — truyền `allowedModelIds` tùy chọn và áp dụng `resolveEffectiveSlotModel` cho `initialMeta` + `buildNovelcrafterStreamRequestBody`.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterInheritanceTable.tsx` — cột chính "Cài đặt AI của truyện": tiêu đề `h1`, 2 thẻ tổng GEM/Persona, bảng 6 tính năng × 4 cột.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterInheritanceTable.test.tsx` — component test cho thẻ tổng, ghi đè Persona/Model, cột "AI sẽ nhận", tô nổi dòng ghi đè.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioPresetBar.tsx` — nút menu `Bộ mẫu: {tên} ▾` gọn trên header Prompt Studio (chọn/lưu/xóa preset, khôi phục tất cả) theo token Vikini 3.0.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioActionList.tsx` — cột `role="listbox"` "Hành động AI" (`168px` trên `sm+`) với `role="option"`, `aria-selected`, roving `tabIndex` và phím ↑/↓/Home/End.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioContextToggles.tsx` — danh sách kiểm "Ngữ cảnh gửi kèm" dạng checkbox theo canvas `NovelAI` và token Vikini 3.0.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioXmlPreview.tsx` — hiển thị `≈ X token` cạnh tiêu đề "Xem trước prompt" + nút Sao chép, token Vikini 3.0.
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioActionEditor.tsx` — bố cục chi tiết hành động gọn cho cột phải `480px` (tiêu đề hành động, trạng thái chỉnh sửa + Khôi phục + Lưu, Directive, Ngữ cảnh, Xem trước XML).
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterAiSettingsWorkspace.tsx` — khung 2 cột kết nối `NovelcrafterInheritanceTable` và `<aside aria-label="Prompt Studio">`.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterAiSettingsWorkspace.test.tsx` — test tích hợp bảng kế thừa + Prompt Studio (`listbox` phím mũi tên, công tắc ngữ cảnh, đóng bằng `Escape`).
- `[MODIFY]` `src/app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx` — trang `/novelcrafter/prompts` gắn `Sidebar` + `HeaderBar` mobile + `NovelcrafterAiSettingsWorkspace`.
- `[MODIFY]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` — thay `GemPersonaRoutingModal` bằng chế độ hiển thị `NovelcrafterAiSettingsWorkspace` trong shell, đảm bảo đúng 1 thẻ `h1` và `< 500` dòng.
- `[DELETE]` `src/app/features/novelcrafter/components/GemPersonaRoutingModal.tsx` — gỡ modal cũ đã được thay thế hoàn toàn.
- `[MODIFY]` `src/lib/utils/translations/vi.ts` — bổ sung khóa dịch cho trang Cài đặt AI mới.
- `[MODIFY]` `src/lib/utils/translations/en.ts` — bổ sung khóa dịch tiếng Anh tương ứng.

### 6. Caller-First Design Sketch

#### 6.1. Phân giải bảng kế thừa (`aiInheritanceTable.ts`)

```ts
export type ResolvedPersonaSource = "inherit" | "override" | "disabled";

export interface FeatureInheritanceRow {
  slot: NovelcrafterFeatureSlot;
  personaSelectValue: string; // "inherit" | "none" | personaId
  personaSource: ResolvedPersonaSource;
  effectivePersonaName: string | null;
  isPersonaOverridden: boolean;
  modelSelectValue: string; // "inherit" | modelId
  effectiveModelId: string;
  effectiveModelName: string;
  isModelOverridden: boolean;
  isRowOverridden: boolean;
  masterGemName: string | null;
}
```

- Khi `routing.featurePersonas[slot]` trỏ tới một `personaId` không còn tồn tại trong `personas`, `personaSelectValue` lùi về `"inherit"`, `personaSource = "inherit"`, `isPersonaOverridden = false` và `effectivePersonaName` tính từ `masterPersonaId`? **Cẩn trọng**: trên server (`novelcrafterStreamRunner.server.ts`), `resolveEffectivePersonaId` trả về `<deletedId>`, sau đó `personas.find` trả `undefined` nên server chạy **không có Persona** (`personaName = null`), không tự động quay về `masterPersonaId`! Vì vậy để cột **"AI sẽ nhận"** phản ánh trung thực 100% những gì AI thực sự nhận, khi `slotValue` là ID lạ không tìm thấy trong `personas`, `effectivePersonaName = null`, `personaSource = "override"`, `isPersonaOverridden = true` (kèm nhãn báo Persona không tìm thấy / chọn lại).
- Cột **"AI sẽ nhận"** được format từ `FeatureInheritanceRow` qua các khóa dịch song ngữ:
  - Có `masterGemName`:
    - `personaSource === "disabled"` → `"Chỉ GEM tổng (tắt Persona)"` / `"Master GEM only (Persona off)"`
    - `personaSource === "override"` & `effectivePersonaName` → `"GEM tổng + {persona} (ghi đè)"` / `"Master GEM + {persona} (override)"`
    - `personaSource === "override"` & `!effectivePersonaName` → `"Chỉ GEM tổng (Persona đã xóa)"` / `"Master GEM only (missing Persona)"`
    - `personaSource === "inherit"` & `effectivePersonaName` → `"GEM tổng + {persona}"` / `"Master GEM + {persona}"`
    - `personaSource === "inherit"` & `!effectivePersonaName` → `"Chỉ GEM tổng"` / `"Master GEM only"`
  - Không có `masterGemName`:
    - `personaSource === "disabled"` → `"Mặc định (tắt Persona)"` / `"Default (Persona off)"`
    - `personaSource === "override"` & `effectivePersonaName` → `"{persona} (ghi đè)"` / `"{persona} (override)"`
    - `personaSource === "inherit"` & `effectivePersonaName` → `"{persona}"`
    - Còn lại → `"Mặc định hệ thống"` / `"System default"`

#### 6.2. Khóa dịch mới (`vi.ts` / `en.ts`)

| Key                                       | `vi`                                                                                            | `en`                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `novelcrafterAiSettingsLead`              | `"Chọn một lần ở trên cùng, mọi tính năng tự kế thừa. Chỉ ghi đè ở dòng nào thật sự cần khác."` | `"Set defaults once at the top so every feature inherits them. Only override rows that truly need to differ."` |
| `novelcrafterMasterGemCardMeta`           | `"GEM tổng · luôn áp dụng"`                                                                     | `"Master GEM · always applied"`                                                                                |
| `novelcrafterMasterPersonaCardMeta`       | `"Persona tổng · mặc định cho mọi tính năng"`                                                   | `"Master Persona · default for all features"`                                                                  |
| `novelcrafterChangeBtn`                   | `"Đổi"`                                                                                         | `"Change"`                                                                                                     |
| `novelcrafterInheritanceTableAria`        | `"Từng tính năng"`                                                                              | `"Per-feature AI inheritance"`                                                                                 |
| `novelcrafterColFeature`                  | `"Tính năng"`                                                                                   | `"Feature"`                                                                                                    |
| `novelcrafterColPersona`                  | `"Persona"`                                                                                     | `"Persona"`                                                                                                    |
| `novelcrafterColModel`                    | `"Model"`                                                                                       | `"Model"`                                                                                                      |
| `novelcrafterColAiReceives`               | `"AI sẽ nhận"`                                                                                  | `"AI receives"`                                                                                                |
| `novelcrafterInheritShort`                | `"Kế thừa"`                                                                                     | `"Inherit"`                                                                                                    |
| `novelcrafterDisablePersonaShort`         | `"Tắt"`                                                                                         | `"Off"`                                                                                                        |
| `novelcrafterInheritModelOption`          | `"Kế thừa ({model})"`                                                                           | `"Inherit ({model})"`                                                                                          |
| `novelcrafterAiReceivesGemAndPersona`     | `"GEM tổng + {persona}"`                                                                        | `"Master GEM + {persona}"`                                                                                     |
| `novelcrafterAiReceivesGemAndOverride`    | `"GEM tổng + {persona} (ghi đè)"`                                                               | `"Master GEM + {persona} (override)"`                                                                          |
| `novelcrafterAiReceivesGemOnlyPersonaOff` | `"Chỉ GEM tổng (tắt Persona)"`                                                                  | `"Master GEM only (Persona off)"`                                                                              |
| `novelcrafterAiReceivesGemOnly`           | `"Chỉ GEM tổng"`                                                                                | `"Master GEM only"`                                                                                            |
| `novelcrafterAiReceivesPersonaOverride`   | `"{persona} (ghi đè)"`                                                                          | `"{persona} (override)"`                                                                                       |
| `novelcrafterAiReceivesPersonaOff`        | `"Mặc định (tắt Persona)"`                                                                      | `"Default (Persona off)"`                                                                                      |
| `novelcrafterAiReceivesSystemDefault`     | `"Mặc định hệ thống"`                                                                           | `"System default"`                                                                                             |
| `novelcrafterPromptStudioPaneTitle`       | `"Prompt Studio"`                                                                               | `"Prompt Studio"`                                                                                              |
| `novelcrafterPromptStudioOptionalHint`    | `"Dành cho người muốn chỉnh sâu. Không bắt buộc."`                                              | `"For deep customization. Optional."`                                                                          |
| `novelcrafterPromptStudioPresetMenuBtn`   | `"Bộ mẫu: {preset}"`                                                                            | `"Preset: {preset}"`                                                                                           |
| `novelcrafterPromptStudioActionsAria`     | `"Hành động AI"`                                                                                | `"AI actions"`                                                                                                 |
| `novelcrafterPromptStudioEditedStatus`    | `"Đã chỉnh so với mặc định"`                                                                    | `"Modified from default"`                                                                                      |
| `novelcrafterPromptStudioDefaultStatus`   | `"Đang dùng mặc định"`                                                                          | `"Using default"`                                                                                              |
| `novelcrafterPromptStudioRestoreShort`    | `"Khôi phục"`                                                                                   | `"Restore"`                                                                                                    |
| `novelcrafterPromptStudioContextShort`    | `"Ngữ cảnh gửi kèm"`                                                                            | `"Included context"`                                                                                           |
| `novelcrafterPromptStudioPreviewShort`    | `"Xem trước prompt"`                                                                            | `"Prompt preview"`                                                                                             |
| `novelcrafterPromptStudioApproxTokens`    | `"≈ {tokens} token"`                                                                            | `"≈ {tokens} tokens"`                                                                                          |

### 7. Các Bước Thực Hiện Tuần Tự

1. **Bước B1 (TDD Red)**: Viết `aiInheritanceTable.test.ts`, cập nhật `streamRequestBody.test.ts`, viết `NovelcrafterInheritanceTable.test.tsx` và `NovelcrafterAiSettingsWorkspace.test.tsx` → chạy Vitest xác nhận đỏ.
2. **Bước B2 (Domain & Hooks)**: Cập nhật `types.ts`, `stateLimits.ts`, tạo `aiInheritanceTable.ts`, cập nhật `streamRequestBody.ts`, `useNovelcrafterStateMutators.ts`, `useNovelcrafterStream.ts` → chạy unit test xác nhận TC-01…TC-03 xanh.
3. **Bước B3 (UI & i18n)**: Bổ sung khóa dịch `vi.ts`/`en.ts`; cập nhật 5 component trong `components/prompt-studio/*`; tạo `NovelcrafterInheritanceTable.tsx` và `NovelcrafterAiSettingsWorkspace.tsx`; nối vào `PromptStudioApp.tsx` và `NovelcrafterStudioApp.tsx`; xóa `GemPersonaRoutingModal.tsx` → chạy TC-04, TC-05 xanh.
4. **Bước B4 (Verify & QA)**: Chạy Prettier, `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, Negative Probes N1–N4, Playwright `tests/e2e/a11y.spec.ts` và QA `/novelcrafter` + `/novelcrafter/prompts` ở `1440px` & `375px`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

**Danh sách ca test Loại C (sửa test hiện hữu)**: **Không có** (0 ca Loại C; mọi test cũ của `NovelcrafterTopBar.test.tsx`, `NovelcrafterA11yNames.test.tsx`, `promptStudio*.test.ts`, `streamRequestBody.test.ts` giữ nguyên kỳ vọng).

| ID    | File test                                                                           | Mô tả ca test                                                                                                                                                                                                                                                  | Loại      |
| ----- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| TC-01 | `src/lib/features/novelcrafter/aiInheritanceTable.test.ts`                          | `resolveEffectiveSlotModel` trả về `selectedModel` khi `"inherit"`, trả về model ghi đè khi hợp lệ & được phép, và **ca âm tính**: tự lùi về `selectedModel` khi model ghi đè là `"novelcrafter-studio"`, không tồn tại hoặc không nằm trong `allowedModelIds` | Unit      |
| TC-02 | `src/lib/features/novelcrafter/aiInheritanceTable.test.ts`                          | `resolveFeatureInheritanceRows` tính đúng 6 dòng cho `inherit`, `none`, `override`, đánh dấu `isRowOverridden` khi ghi đè Persona hoặc Model, và xử lý an toàn khi `personaId` đã bị xóa (`effectivePersonaName = null`)                                       | Unit      |
| TC-03 | `src/lib/features/novelcrafter/streamRequestBody.test.ts`                           | `buildNovelcrafterStreamRequestBody` gửi `model` ghi đè của `routing.featureModels.feedback` khi chạy `feature: "feedback"`, trong khi `feature: "write"` để `"inherit"` vẫn gửi `selectedModel`                                                               | Unit      |
| TC-04 | `src/app/features/novelcrafter/components/NovelcrafterInheritanceTable.test.tsx`    | Render đúng 1 `h1`, 2 thẻ tổng (đổi GEM tổng và Persona tổng qua menu), bảng 6 tính năng × 4 cột; đổi Persona sang `"none"` hoặc đổi Model sang model riêng cập nhật callback và cột "AI sẽ nhận", tô `bg-(--soft)` trên dòng ghi đè                           | Component |
| TC-05 | `src/app/features/novelcrafter/components/NovelcrafterAiSettingsWorkspace.test.tsx` | Kết hợp bảng kế thừa + `<aside aria-label="Prompt Studio">`; `role="listbox"` "Hành động AI" chuyển hành động bằng phím `ArrowDown`/`End`; bật/tắt checkbox ngữ cảnh không bắt buộc cập nhật XML preview & badge `≈ ... token`; phím `Escape` gọi `onClose`    | Component |

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

```powershell
npx tsc --noEmit; npm run lint; npx vitest run --reporter=dot
npx playwright test tests/e2e/a11y.spec.ts
```

**Wiring Probes**:

- **W1**: Mọi component UI (`NovelcrafterStudioApp.tsx`, `NovelcrafterInheritanceTable.tsx`, `NovelcrafterAiSettingsWorkspace.tsx`, `PromptStudioApp.tsx`, `PromptStudio*`) đều `< 500` dòng; `aiInheritanceTable.ts`, `stateLimits.ts`, `streamRequestBody.ts` đều `< 400` dòng; không chứa raw Tailwind palette hay chữ `< 12px`.
- **W2**: QA Playwright ở `1440px` và `375px`: từ `/novelcrafter` bấm "Cài đặt AI" mở bảng kế thừa + Prompt Studio, đổi Persona/Model cập nhật cột "AI sẽ nhận", chuyển hành động trong Prompt Studio bằng phím mũi tên, quay lại bản thảo không mất chữ đang gõ; mở `/novelcrafter/prompts` trực tiếp hoạt động đồng nhất, không tràn ngang, axe tên truy cập sạch.

**Negative Probes** (hoàn tác ngay sau mỗi probe):

- **N1**: Trong `aiInheritanceTable.ts`, bỏ kiểm tra `allowedModelIds` trong `resolveEffectiveSlotModel` → TC-01 đỏ.
- **N2**: Trong `streamRequestBody.ts`, trả lại `model: opts.selectedModel` thay vì `resolveEffectiveSlotModel` → TC-03 đỏ.
- **N3**: Trong `NovelcrafterInheritanceTable.tsx`, bỏ `bg-(--soft)` trên dòng ghi đè → TC-04 đỏ.
- **N4**: Trong `PromptStudioActionList.tsx`, bỏ xử lý phím `ArrowDown` trên `role="listbox"` → TC-05 đỏ.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                                                             | Mức        | Control                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lồng `<main>` bên trong `<main id="main">` của `src/app/features/layout/components/MainLayout.tsx:8` gây lỗi a11y landmark                                                         | Cao        | Cột chính dùng `<div role="region" aria-labelledby={headingId}>` thay vì `<main>`                                                                                              |
| Hai thẻ `<h1>` xuất hiện cùng lúc khi mở Cài đặt AI trong `/novelcrafter` (`src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:313` có `<h1 className="sr-only">`) | Cao        | Chỉ render `<h1 className="sr-only">` khi `!isRoutingModalOpen`; khi mở Cài đặt AI, `<h1>` duy nhất là `"Cài đặt AI của truyện"`                                               |
| Bảng 4 cột + Prompt Studio 480px gây tràn ngang trên mobile 375px                                                                                                                  | Trung bình | Dưới `xl` xếp dọc bảng kế thừa ở trên và `<aside>` Prompt Studio ở dưới; dưới `md` mỗi dòng tính năng trong bảng chuyển sang thẻ xếp chồng 2 hàng không ép 4 cột ngang         |
| Bấm `Escape` khi đang mở `DropdownMenu` chọn GEM/Persona hoặc Preset vô tình đóng luôn toàn bộ trang Cài đặt AI                                                                    | Trung bình | Lắng nghe `Escape` ở `NovelcrafterAiSettingsWorkspace` kiểm tra `!e.defaultPrevented && !hasActiveOverlayInDom()` (tái dùng `novelcrafterKeyboard.ts`) trước khi gọi `onClose` |

### Lộ Trình

| Bước        | Nội dung                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------- |
| 5D          | **Plan này** — Trang Cài đặt AI của truyện dạng bảng kế thừa + Prompt Studio              |
| 5E          | Khung soạn lệnh AI, panel chi tiết chương, dock mobile, nhóm chương theo hồi              |
| 6 (còn lại) | Codemod màu thô & alias token cũ, bật lint guard, type scale, `eslint-plugin-react-hooks` |

### 11. Ghi Chú Triển Khai

- Mở rộng tương thích ngược `featureModels` trong `NovelcrafterRoutingConfigSchema` (`types.ts`) và `stateLimits.ts`; tạo `aiInheritanceTable.ts` (158 dòng) phân giải `resolveEffectiveSlotModel` (ràng buộc kép `isSelectableModelId` + `isModelAllowedById`), `resolveFeatureInheritanceRows` (xử lý đúng cả trường hợp Persona ghi đè đã xóa khớp `novelcrafterStreamRunner.server.ts`), `estimatePromptTokens` và `formatApproxTokens`.
- Nối `resolveEffectiveSlotModel` vào `streamRequestBody.ts` và `useNovelcrafterStream.ts` để ghi đè Model theo từng tính năng có hiệu lực ngay khi stream mà không cần đổi API server; bổ sung `updateFeatureModelSlot` trong `useNovelcrafterStateMutators.ts`.
- Tạo `NovelcrafterInheritanceTable.tsx` (391 dòng) và `NovelcrafterAiSettingsWorkspace.tsx` (99 dòng); nâng cấp trọn bộ `components/prompt-studio/*` (`PromptStudioPresetBar.tsx`, `PromptStudioActionList.tsx` với `role="listbox"` + phím ↑/↓/Home/End, `PromptStudioActionEditor.tsx`, `PromptStudioContextToggles.tsx`, `PromptStudioXmlPreview.tsx` kèm badge `≈ X token`, `PromptStudioApp.tsx` gắn `Sidebar` + `HeaderBar`); nối vào `NovelcrafterStudioApp.tsx` (496 dòng `< 500`) và xóa `GemPersonaRoutingModal.tsx`.
- Kiểm tra: TC-01…TC-05 xanh; `tsc`, `lint` sạch; vitest toàn repo 225/225 file (`1814/1814` test); Negative Probes N1–N4 đều đỏ như kỳ vọng và khôi phục sạch; e2e `a11y.spec.ts` 15/15; QA Playwright `/novelcrafter` & `/novelcrafter/prompts` ở 1440px và 375px xanh 2/2 (chọn GEM tổng, ghi đè Persona cập nhật cột "AI sẽ nhận" + tô `bg-(--soft)`, điều hướng bàn phím trên `listbox` Hành động AI, đóng bằng `Escape` giữ nguyên bản thảo đang gõ, không tràn ngang, axe tên truy cập sạch).

## Audit History

### Audit Run 1

[REVIEWER_MODEL: Gemini 4 Carbon (in-session; PM đã ủy quyền tự review cho chuỗi 4B → 6)]

#### 1. Output verify-plan.mjs & Đối Chiếu Nguồn

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5d-novelcrafter-ai-settings-plan.md` → `SECTIONS 7/7`, `LINE_REF` PASS, `CRITIC_REQUIRED no`.
- Đối chiếu thêm `src/lib/core/modelAccess.ts` và `src/lib/features/novelcrafter/draftStorage.ts`.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                  | Bằng chứng                                                                                                               | Lý do / Yêu cầu sửa                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------- | ------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/lib/core/modelAccess.ts:36-38`                                          | [SRC] `isModelAllowedById` trả `true` cho `MODEL_IDS.NOVELCRAFTER` và `MODEL_IDS.IMAGE_STUDIO` khi `allowedSet.size > 0` | Nếu `resolveEffectiveSlotModel` chỉ gọi `isModelAllowedById`, giá trị rác như `"novelcrafter-studio"` trong `featureModels` sẽ lọt xuống `/api/novelcrafter/stream` và bị `isValidGenerationModel` chặn 400. **Sửa (Revision 2)**: chuẩn hóa qua `coerceStoredModel` và bắt buộc `isSelectableModelId(coerced) && isModelAllowedById(coerced, allowedModelIds)`. |
| 2   | DEFECT         | [MINOR] | `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts:86-104` | [SRC] `updateRouting` gộp `featurePersonas` nhưng chưa gộp `featureModels`                                               | Nếu gọi `onUpdateRouting({ masterGemId })` sau khi đã đặt `featureModels`, cần giữ nguyên `prev.routing.featureModels` và gộp nông `patch.featureModels` khi có.                                                                                                                                                                                                 |
| 3   | RISK_DISMISSED | —       | `src/lib/features/novelcrafter/draftStorage.ts:88-105`                       | [SRC] `hasUnsavedDraftContent` dùng cho `NC-01 Guard` tại `src/lib/features/novelcrafter/draftStorage.ts:449`            | Không sửa `hasUnsavedDraftContent` theo `routing` để tránh bản nháp rỗng nội dung ghi đè truyện trên server.                                                                                                                                                                                                                                                     |

#### Kết Luận

1 `[MAJOR]` → cập nhật Revision 2.

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: Gemini 4 Carbon (in-session); Critic Pass miễn (`CRITIC_REQUIRED no`)]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- `[CMD]` `node scripts/verify-plan.mjs docs/plans/2026-11-11-vikini-3-phase-5d-novelcrafter-ai-settings-plan.md` → `VERIFY_PLAN: PASS`.
- Audit Run 1 #1 `[MAJOR]` đã khóa chặt trong D1 và được kiểm chứng bằng ca âm tính trong TC-01 + Negative Probe N1.
- Audit Run 1 #2 `[MINOR]` đã đưa vào `useNovelcrafterStateMutators.ts` trong §5.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                   | Bằng chứng                                                                                                                      | Lý do / Hướng xử lý khi code                                                                                                            |
| --- | -------------- | ------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | —       | `src/app/features/novelcrafter/components/NovelcrafterTopBar.test.tsx:90-128` | [SRC] Test 5A kiểm tra nút `"Cài đặt AI"` gọi `onOpenRoutingModal` và menu `"Quản lý Prompt"` có `href="/novelcrafter/prompts"` | Giữ nguyên cả hai lối vào, không sửa bất kỳ test cũ nào (0 Loại C).                                                                     |
| 2   | RISK_ACCEPTED  | [MINOR] | `src/app/features/layout/components/MainLayout.tsx:8`                         | [SRC] `MainLayout` đã bọc `<main id="main">`                                                                                    | Dùng `<div role="region">` cho cột chính để không lồng `<main>` và giữ đúng 1 `<h1>` trên toàn trang.                                   |
| 3   | RISK_ACCEPTED  | [MINOR] | `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx:313`      | [SRC] `NovelcrafterStudioApp` có `<h1 className="sr-only">` ở chế độ viết                                                       | Khi `isRoutingModalOpen === true`, ẩn `<h1 className="sr-only">` để tiêu đề `<h1>` của `NovelcrafterInheritanceTable` là `h1` duy nhất. |

#### Kết Luận

Không còn `[BLOCKER]`/`[MAJOR]`. Test Contract có ca âm tính (TC-01, TC-02) và Negative Probes N1–N4; 0 ca Loại C. Plan đạt chuẩn triển khai.

[PLAN_APPROVED]
