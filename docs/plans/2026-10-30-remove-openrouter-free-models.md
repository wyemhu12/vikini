# Kế Hoạch Triển Khai: Gỡ 4 Model OpenRouter (Free) Không Còn Miễn Phí

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-30
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

**Goal**: Gỡ 4 model không còn miễn phí khỏi registry dùng chung cho UI + backend:

| Model ID                                      | `descKey`                  | Vị trí `SELECTABLE_MODELS`              | Vị trí `API_ALLOWED`                |
| :-------------------------------------------- | :------------------------- | :-------------------------------------- | :---------------------------------- |
| `meta-llama/llama-4-maverick:free`            | `modelDescLlama4Maverick`  | `src/lib/core/modelRegistry.ts:152-160` | `src/lib/core/modelRegistry.ts:342` |
| `meta-llama/llama-3.3-70b-instruct:free`      | `modelDescLlama33Instruct` | `src/lib/core/modelRegistry.ts:161-169` | `src/lib/core/modelRegistry.ts:343` |
| `google/gemma-3-27b-it:free`                  | `modelDescGemma3`          | `src/lib/core/modelRegistry.ts:171-180` | `src/lib/core/modelRegistry.ts:344` |
| `mistral/mistral-small-3.1-24b-instruct:free` | `modelDescMistralSmall`    | `src/lib/core/modelRegistry.ts:182-191` | `src/lib/core/modelRegistry.ts:345` |

Sau thay đổi: tab **OPENROUTER (FREE)** vẫn hiển thị trong ModelSelector nhưng danh sách rỗng, nên tự động rơi vào nhánh "Sẽ có sau" / "Available later" (giống tab GPT hiện tại). ID cũ lưu trong DB/conversation được coerce về `DEFAULT_MODEL` (`gemini-2.5-flash`).

**Out of Scope (What We're NOT Doing)**:

- KHÔNG xóa `"openrouter-free"` khỏi union `SelectableModel["providerId"]` (`src/lib/core/modelRegistry.ts:25`), `PROVIDER_LABELS` (`src/lib/core/modelRegistry.ts:310`), hay `PROVIDER_IDS` / `PROVIDER_LOGOS` / `PROVIDER_COLORS` / `NEEDS_INVERSION` trong `src/app/features/chat/components/ModelSelector.tsx:25,37,48,59` — theo yêu cầu User giữ tab.
- KHÔNG sửa `ModelSelector.tsx` (nhánh empty-state đã có sẵn tại `src/app/features/chat/components/ModelSelector.tsx:274-277`).
- KHÔNG thêm `MODEL_ALIASES` cho 4 ID cũ: fallback `DEFAULT_MODEL` của `normalizeModelForApi` (`src/lib/core/modelRegistry.ts:433-434`) đã đủ và đúng yêu cầu.
- KHÔNG sửa heuristic `model.includes(":free")` trong `src/app/api/chat-stream/chatStreamCore.ts:506` (API route; vô hại vì model đã được coerce trước đó tại `src/app/api/chat-stream/chatStreamCore.ts:273`). Có thể dọn trong task riêng.
- KHÔNG dọn các khóa dịch mồ côi khác (`modelDescDeepSeekV3`, `modelDescDeepSeekR1` tại `src/lib/utils/translations/vi.ts:103-104`) — ngoài phạm vi Task Brief.
- KHÔNG tạo migration SQL: grep toàn repo không thấy `:free` trong `database-migrations/` (chỉ thấy `llama-3.3-70b-versatile` của Groq tại `database-migrations/004_add_model_permissions.sql:15-16`, không liên quan).
- KHÔNG thêm model miễn phí thay thế.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File                                                                    | Mục đích                                                                                                                     |
| :---------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                                              | Tech stack, layer boundary, git discipline, co-located test bắt buộc                                                         |
| `.agents/rules/01-coding.md`                                            | Cấm `any`/`console.log`; exemption kích thước cho `modelRegistry.ts`, `vi.ts`/`en.ts` (`.agents/rules/01-coding.md:129-134`) |
| `.agents/rules/02-quality.md`                                           | Pre-Work triggers, Tier 1/2 checklist, Test Failure Triage, PowerShell `;`                                                   |
| `.agents/rules/05-plan-review.md`                                       | Cấu trúc plan, Code Freeze, test file thuộc nhóm nhạy cảm (d) luôn `ask`                                                     |
| `.agents/agents/reviewer/evidence-bar.md`                               | §4.5.3 Wiring/Negative Probe, §4.5.4 Risk Table Audit                                                                        |
| `scripts/verify-plan.mjs`                                               | 7 heading bắt buộc, kiểm tra `file:line`                                                                                     |
| `src/lib/core/modelRegistry.ts`, `modelRegistry.test.ts`                | Nguồn & test hiện có                                                                                                         |
| `src/app/features/chat/components/ModelSelector.tsx`                    | Xác nhận empty-state "Sẽ có sau" hoạt động theo dữ liệu                                                                      |
| `src/lib/utils/translations/{vi,en,index}.ts`                           | Vị trí khóa dịch & cơ chế parity compile-time                                                                                |
| `src/lib/core/modelAccess.ts`, `src/lib/features/chat/conversations.ts` | Blast-radius: model ID cũ trong rank config / conversation                                                                   |

**Skills Loaded & Applied**

| Skill                                        | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                       |
| :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/add-translation/SKILL.md`    | Xóa khóa **đồng thời** ở `vi.ts` và `en.ts`; dùng `npm run type-check` để bắt lệch parity (`src/lib/utils/translations/index.ts:24-33`). |
| `.agents/skills/vikini-investigate/SKILL.md` | Phân tích blast-radius trước khi sửa module dùng chung `src/lib/core/` (xem §3 Assumptions A3–A6).                                       |
| `.agents/skills/vikini-simplify/SKILL.md`    | Thay đổi thuần xóa (Subtract Before You Add): không thêm abstraction, không đổi runtime của model còn lại.                               |

### 3. Assumptions & Cross-Task Dependencies

- **A1** `[SRC]` Empty-state đã tồn tại và dựa hoàn toàn vào dữ liệu: `filteredModelsByProvider` lọc `SELECTABLE_MODELS` theo `providerId` (`src/app/features/chat/components/ModelSelector.tsx:126-132`); khi rỗng render `t("modelSelectorAvailableLater")` (`src/app/features/chat/components/ModelSelector.tsx:274-277`) = "Sẽ có sau" (`src/lib/utils/translations/vi.ts:80`) / "Available later" (`src/lib/utils/translations/en.ts:80`). Tab GPT (`openai`) hiện không có model nào nên cũng đang đi nhánh này.
- **A2** `[SRC]` 4 model ID là các mục duy nhất có `providerId: "openrouter-free"` (`src/lib/core/modelRegistry.ts:159,168,179,190`) → sau khi xóa, tab rỗng.
- **A3** `[SRC]` Conversation cũ lưu ID bị gỡ được coerce khi đọc: `coerceStoredModel(row.model ?? DEFAULT_MODEL)` (`src/lib/features/chat/conversations.ts:144`) → `normalizeModelForApi` fallback `DEFAULT_MODEL` (`src/lib/core/modelRegistry.ts:433-434`).
- **A4** `[SRC]` Request chat-stream gửi ID cũ được coerce tại `src/app/api/chat-stream/chatStreamCore.ts:273` trước khi chọn client ở `src/app/api/chat-stream/chatStreamCore.ts:502-507`.
- **A5** `[SRC]` Rank config `allowed_models` còn chứa ID cũ (nếu có trong DB) bị bỏ qua an toàn: `isKnown` false → `return false` (`src/lib/core/modelAccess.ts:40-43`), mục không-known trong allowlist bị `continue` (`src/lib/core/modelAccess.ts:56-58`). Không cần migration.
- **A6** `[CMD]` `Grep` toàn repo (trừ `node_modules`, `.next`, `docs/plans`) cho 4 ID + 4 descKey: chỉ xuất hiện trong `src/lib/core/modelRegistry.ts` và `src/lib/utils/translations/{vi,en}.ts` (`src/lib/utils/translations/vi.ts:105-108`, `src/lib/utils/translations/en.ts:102-105`). Không có test, component hay `useChatTranslations.ts` nào tham chiếu.
- **A7** `[URL]` Tra cứu `https://openrouter.ai/api/v1/models` (2026-10-30): không còn ID nào trong 4 ID `:free` trên (kể cả biến thể `mistralai/...:free`) → xác nhận nhu cầu gỡ.
- **A8** `[SRC]` Parity khóa dịch được enforce compile-time (`src/lib/utils/translations/index.ts:24-33`), nên xóa lệch một bên sẽ làm `npm run type-check` fail.
- **Cross-Task Dependencies**: Không. Không chạm file nhạy cảm Security/Governance/Database → kỳ vọng `CRITIC_REQUIRED no`.
- **Lưu ý Code Freeze**: `src/lib/core/modelRegistry.test.ts` thuộc nhóm nhạy cảm (d) của `.agents/rules/05-plan-review.md` → hook sẽ trả `ask` dù đã Approved; executor cần User xác nhận khi ghi file test.
- `[NEEDS_PRODUCT_DECISION]`: Không có (User đã quyết định giữ tab).

### 4. Bảng Verified Versions

| Thư viện / Công cụ             | `package.json` `[SRC]`         | Ghi chú 2026 `[URL]`                                                                  |
| :----------------------------- | :----------------------------- | :------------------------------------------------------------------------------------ |
| Next.js                        | `^16.4.0` (`package.json:64`)  | https://nextjs.org/docs — không dùng API mới; chỉ đổi dữ liệu tĩnh.                   |
| TypeScript                     | `^5.9.3` (`package.json:115`)  | https://www.typescriptlang.org/docs/ — parity check dựa trên `keyof`/`Exclude`.       |
| Vitest                         | `^4.1.12` (`package.json:117`) | https://vitest.dev/api/ — dùng `describe`/`it.each`/`expect`, không cần API mới.      |
| OpenAI SDK (OpenRouter client) | `^6.15.0` (`package.json:67`)  | https://openrouter.ai/docs/api-reference/list-available-models — không đổi call site. |
| OpenRouter Models API          | N/A                            | https://openrouter.ai/api/v1/models — xác nhận 4 ID `:free` đã biến mất (A7).         |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `src/lib/core/modelRegistry.ts` — xóa khối "OPENROUTER FREE MODELS" (dòng 147-191) và 4 dòng + comment trong `API_ALLOWED` (dòng 341-345).
- `[MODIFY]` `src/lib/core/modelRegistry.test.ts` — thêm `describe` "OpenRouter Free Model Removal (TC-ORF)".
- `[MODIFY]` `src/lib/utils/translations/vi.ts` — xóa 4 khóa (dòng 105-108).
- `[MODIFY]` `src/lib/utils/translations/en.ts` — xóa 4 khóa (dòng 102-105).
- `[MODIFY]` `docs/CHANGELOG.md` — thêm entry 2026-10-30 lên đầu.

Không có `[NEW]` / `[DELETE]`.

### 6. Caller-First Design Sketch

Không đổi public API. Phía caller (không đổi):

```ts
// ModelSelector.tsx — tab "openrouter-free" vẫn nằm trong PROVIDER_IDS
SELECTABLE_MODELS.filter((m) => m.providerId === "openrouter-free"); // => []  → "Sẽ có sau"

// conversations.ts / chatStreamCore.ts
coerceStoredModel("google/gemma-3-27b-it:free"); // => "gemini-2.5-flash"
```

Phía test (mới):

```ts
import { en } from "@/lib/utils/translations/en";
import { vi } from "@/lib/utils/translations/vi";

const REMOVED_OPENROUTER_FREE_IDS = [
  "meta-llama/llama-4-maverick:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistral/mistral-small-3.1-24b-instruct:free",
] as const;
const REMOVED_DESC_KEYS = [
  "modelDescLlama4Maverick",
  "modelDescLlama33Instruct",
  "modelDescGemma3",
  "modelDescMistralSmall",
] as const;

describe("OpenRouter Free Model Removal (TC-ORF)", () => {
  it.each(REMOVED_OPENROUTER_FREE_IDS)(
    "%s is no longer selectable and falls back to DEFAULT_MODEL",
    (id) => {
      expect(SELECTABLE_MODELS.some((m) => m.id === id)).toBe(false);
      expect(isSelectableModelId(id)).toBe(false);
      expect(normalizeModelForApi(id)).toBe(DEFAULT_MODEL);
      expect(coerceStoredModel(id)).toBe(DEFAULT_MODEL);
      expect(getModelTokenLimit(id)).toBe(getModelTokenLimit(DEFAULT_MODEL));
    }
  );
  // + tab retained, no ":free" left, descKey wiring, Groq Llama regression (xem §8)
});
```

### 7. Các Bước Thực Hiện Tuần Tự

- [x] **B1 (Red-first)**: Thêm `describe("OpenRouter Free Model Removal (TC-ORF)")` vào `src/lib/core/modelRegistry.test.ts` theo §8 (thêm import `getModelTokenLimit` đã có; thêm `en`, `vi`). Chạy `npx vitest run src/lib/core/modelRegistry.test.ts --reporter=dot` → **kỳ vọng FAIL** ở TC-ORF-01/02/03/05 trên code hiện tại (chứng minh test bắt được vi phạm).
- [x] **B2**: Trong `src/lib/core/modelRegistry.ts`, xóa nguyên khối comment header + 4 object từ dòng 147 đến 191 (giữ dòng trống trước header "CLAUDE MODELS").
- [x] **B3**: Trong `API_ALLOWED`, xóa comment `// OpenRouter Free Models` và 4 ID (dòng 341-345) cùng dòng trống thừa.
- [x] **B4**: Xóa 4 khóa trong `src/lib/utils/translations/vi.ts:105-108` và `src/lib/utils/translations/en.ts:102-105` đồng thời (skill add-translation).
- [x] **B5 (Tier 1)**: `npm run type-check` → exit 0 (parity giữ nguyên, không còn tham chiếu khóa đã xóa).
- [x] **B6 (Green)**: `npx vitest run src/lib/core/modelRegistry.test.ts --reporter=dot` → toàn bộ PASS.
- [x] **B7 (Wiring/grep probes)**: chạy các probe §9.
- [x] **B8**: Thêm entry `## 2026-10-30: Cleanup -- Remove 4 Deprecated OpenRouter Free Models` vào đầu `docs/CHANGELOG.md` (sau khối NOTE, trước entry 2026-10-27), nêu rõ tab OpenRouter (Free) giữ lại hiển thị "Sẽ có sau" và ID cũ fallback `gemini-2.5-flash`.
- [x] **B9 (Tier 2)**: `npm run type-check; npm run lint; npm run test:run` → exit 0.
- [x] **B10**: Đổi Header plan sang `- **Status**: Completed`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

File: `src/lib/core/modelRegistry.test.ts`. Tất cả assertion dùng `toBe`/`toEqual`/`toHaveLength` chính xác; cấm `toBeDefined`/`toBeTruthy` thay thế, cấm `.skip`/`.only`.

| TC                                  | Input                                                        | Expected Output                                                                                                                                         | Failure mode bị bắt                                                           |
| :---------------------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------- |
| TC-ORF-01                           | Mỗi ID trong `REMOVED_OPENROUTER_FREE_IDS` (`it.each`)       | `SELECTABLE_MODELS.some(id)` = `false`; `isSelectableModelId` = `false`                                                                                 | Còn sót trong `SELECTABLE_MODELS`                                             |
| TC-ORF-02                           | Như trên                                                     | `normalizeModelForApi(id)` = `DEFAULT_MODEL`; `coerceStoredModel(id)` = `DEFAULT_MODEL`; `getModelTokenLimit(id)` = `getModelTokenLimit(DEFAULT_MODEL)` | Còn sót trong `API_ALLOWED` (normalize sẽ trả lại chính ID) hoặc bị alias sai |
| TC-ORF-03                           | `SELECTABLE_MODELS.filter(providerId === "openrouter-free")` | `toHaveLength(0)`                                                                                                                                       | Tab không rỗng → không hiện "Sẽ có sau"                                       |
| TC-ORF-04                           | `PROVIDER_LABELS["openrouter-free"]`                         | `"OpenRouter (Free)"`                                                                                                                                   | Xóa nhầm tab (vi phạm yêu cầu User)                                           |
| TC-ORF-05                           | `SELECTABLE_MODELS.filter(m => m.id.endsWith(":free"))`      | `toHaveLength(0)`                                                                                                                                       | Model `:free` khác còn sót                                                    |
| TC-ORF-06                           | Mỗi khóa `REMOVED_DESC_KEYS`                                 | `Object.hasOwn(en, key)` = `false` và `Object.hasOwn(vi, key)` = `false`                                                                                | Khóa dịch chết còn sót                                                        |
| TC-ORF-07 (wiring)                  | Mọi `model.descKey` trong `SELECTABLE_MODELS`                | `Object.hasOwn(en, key)` = `true` và `Object.hasOwn(vi, key)` = `true`                                                                                  | Xóa nhầm khóa dịch của model còn hoạt động                                    |
| TC-ORF-08 (regression / happy path) | `"llama-3.3-70b-versatile"`                                  | `isSelectableModelId` = `true`; `normalizeModelForApi` = `"llama-3.3-70b-versatile"`; `providerId` = `"groq"`                                           | Xóa nhầm model Groq trùng tên "llama-3.3-70b"                                 |

**Boundary conditions**: TC-ORF-01/02 chạy trên đúng 4 ID chuỗi literal (không dùng regex), nên không bị "game" bằng cách đổi ID gần giống. TC-ORF-02 sẽ FAIL nếu executor chỉ xóa khỏi `SELECTABLE_MODELS` mà quên `API_ALLOWED` (vì `normalizeModelForApi` trả ID cũ). Test hiện có `falls back to DEFAULT_MODEL for unknown models` (`src/lib/core/modelRegistry.test.ts:112-114`) giữ nguyên.

**Pass criteria cho `@qa`**: B1 phải được quan sát FAIL trước khi sửa code; sau B2–B4 toàn bộ TC-ORF-01..08 PASS; không test nào khác bị sửa.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

- **Co-located test**: `src/lib/core/modelRegistry.test.ts` (cạnh `src/lib/core/modelRegistry.ts`). Translation files là data, được phủ gián tiếp bởi TC-ORF-06/07 + parity compile-time.
- **Lệnh**:
  - `npx vitest run src/lib/core/modelRegistry.test.ts --reporter=dot`
  - `npm run type-check; npm run lint; npm run test:run`
- **Negative Probes**:
  - **NP1 (red-first)**: B1 chạy test mới trên code chưa sửa → TC-ORF-01, 02, 03, 05, 06 phải FAIL. Nếu PASS → test vô hiệu, dừng lại.
  - **NP2 (API_ALLOWED-only regression)**: Sau B6, tạm khôi phục _chỉ_ 1 dòng `"google/gemma-3-27b-it:free"` vào `API_ALLOWED` (không commit) → TC-ORF-02 phải FAIL với `expected 'google/gemma-3-27b-it:free' to be 'gemini-2.5-flash'`; sau đó hoàn tác.
  - **NP3 (parity)**: Bằng chứng sẵn có — cơ chế `src/lib/utils/translations/index.ts:24-33` gây lỗi type nếu xóa lệch; B5 xác nhận baseline exit 0.
- **Wiring Probes**:
  - **WP1**: `Grep` pattern `llama-4-maverick:free|llama-3.3-70b-instruct:free|gemma-3-27b-it:free|mistral-small-3.1-24b-instruct:free|modelDescLlama4Maverick|modelDescLlama33Instruct|modelDescGemma3|modelDescMistralSmall` trên `src/` → chỉ còn match trong `src/lib/core/modelRegistry.test.ts`.
  - **WP2**: `Grep` `openrouter-free` trên `src/` → vẫn còn ở `modelRegistry.ts` (union + label) và `ModelSelector.tsx` (4 chỗ) → tab được giữ.
  - **WP3 (thủ công, tùy chọn)**: `npm run dev`, mở ModelSelector → tab "OpenRouter (Free)" hiển thị "Sẽ có sau" (vi) / "Available later" (en).

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                    | Mức        | Technical control                                                                                                                                                                                           |
| :---------------------------------------------------------------------------------------- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation / user đang dùng 1 trong 4 model bị lỗi khi mở lại                           | Trung bình | `coerceStoredModel` khi đọc conversation (`src/lib/features/chat/conversations.ts:144`) và khi stream (`src/app/api/chat-stream/chatStreamCore.ts:273`) → `DEFAULT_MODEL`; kiểm chứng bằng TC-ORF-02 + NP2. |
| Xóa sót `API_ALLOWED` khiến ID cũ vẫn được gửi tới OpenRouter (lỗi 404/402)               | Trung bình | `normalizeModelForApi` chỉ trả ID khi nằm trong `API_ALLOWED` (`src/lib/core/modelRegistry.ts:429-434`); TC-ORF-02 + NP2 bắt lỗi này.                                                                       |
| Xóa nhầm khóa dịch / lệch parity vi–en làm vỡ build                                       | Trung bình | Parity compile-time `src/lib/utils/translations/index.ts:24-33` + `npm run type-check` (B5); TC-ORF-07 kiểm mọi `descKey` còn lại tồn tại ở cả hai ngôn ngữ.                                                |
| Xóa nhầm tab OpenRouter (Free) trái yêu cầu User                                          | Trung bình | TC-ORF-04 (`PROVIDER_LABELS["openrouter-free"]`), WP2; tab render từ `PROVIDER_IDS` tại `src/app/features/chat/components/ModelSelector.tsx:18-28`.                                                         |
| Rank config trong DB còn chứa ID cũ làm lệch quyền                                        | Thấp       | `src/lib/core/modelAccess.ts:40-43,56-58` loại ID không-known.                                                                                                                                              |
| Xóa nhầm model Groq `llama-3.3-70b-versatile` do tên gần giống                            | Thấp       | TC-ORF-08; dòng Groq nằm ngoài vùng xóa (`src/lib/core/modelRegistry.ts:128-136`).                                                                                                                          |
| Heuristic `:free` trong `src/app/api/chat-stream/chatStreamCore.ts:506` thành dead branch | Thấp       | Vô hại (model đã coerce); ghi nhận Out of Scope.                                                                                                                                                            |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-10-30-remove-openrouter-free-models.md`:
  - `[PASS] SECTIONS 7/7`
  - `[PASS] LINE_REF` cho toàn bộ 42 tham chiếu `file:line`
  - `[INFO] CRITIC_REQUIRED no`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`
- Kiểm chứng lỗi cũ: Không áp dụng (Revision 1).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                         | Bằng chứng | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------- | ------- | ------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | [MINOR] | `src/app/api/chat-stream/conversationLoader.ts:66-68`               | [SRC]      | Kế hoạch dẫn chiếu `src/app/api/chat-stream/chatStreamCore.ts:273` (`modelMeta.model = coerceStoredModel(requestedModel)`) cho bước coerce trước khi chọn client tại `src/app/api/chat-stream/chatStreamCore.ts:502-507`; đối chiếu code thực tế xác nhận biến `model` dùng để phân nhánh client đã được chuẩn hóa sớm hơn tại `src/app/api/chat-stream/conversationLoader.ts:67` (`const model = normalizeModelForApi(requestedModel)`), nên nhánh `model.includes(":free")` tại `src/app/api/chat-stream/chatStreamCore.ts:506` không thể bị kích hoạt bởi 4 ID đã xóa.                             |
| 2   | RISK_DISMISSED | [MINOR] | `src/lib/core/limits.ts:378-380`                                    | [SRC]      | Kiểm tra nguy cơ `allowedList.flatMap((m) => [m, normalizeModelForApi(m), coerceStoredModel(m)])` trong `isModelAllowedForUser`/`assertModelAllowedForUser` (`src/lib/core/limits.ts:378,399`) biến một ID `:free` cũ trong `rank_configs.allowed_models` thành `DEFAULT_MODEL`: rủi ro được bác bỏ vì `DEFAULT_MODEL` (`gemini-2.5-flash`) vốn là model cơ sở mặc định của mọi rank được duyệt (`src/lib/core/limits.ts:75`, `database-migrations/004_add_model_permissions.sql:14-16`), và phía client `isModelAllowedById` đã chặn sớm bằng `isKnown` (`src/lib/core/modelAccess.ts:40-43,56-58`). |
| 3   | RISK_DISMISSED | [MINOR] | `src/app/features/chat/components/hooks/useModelSelection.ts:18-21` | [SRC]      | Kiểm tra nguy cơ người dùng đang lưu 1 trong 4 ID `:free` trong `localStorage` (`vikini-landing-model`) trên trang Landing hoặc trong lịch sử Novelcrafter (`src/lib/features/novelcrafter/modelDisplay.ts:42-48`): `useLandingModel` kiểm tra `SELECTABLE_MODELS.some((m) => m.id === savedModel)` nên tự động giữ `DEFAULT_MODEL`, còn `resolveModelDisplayInfo` trả về nhánh fallback `"Custom"` (`src/lib/features/novelcrafter/modelDisplay.ts:66-72`) không gây lỗi render.                                                                                                                     |
| 4   | RISK_DISMISSED | [MINOR] | `src/lib/utils/translations/vi.ts:103-104`                          | [SRC]      | Hai khóa mồ côi cũ `modelDescDeepSeekV3` và `modelDescDeepSeekR1` tại `src/lib/utils/translations/vi.ts:103-104` và `src/lib/utils/translations/en.ts:100-101` nằm sát vùng xóa nhưng không thuộc 4 model OpenRouter `:free` của task; kế hoạch đã tách khỏi phạm vi trong Out of Scope để giữ minimal diff theo `.agents/rules/02-quality.md`.                                                                                                                                                                                                                                                       |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                     | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7 mục + Skills + Test Contract) | PASS    | [CMD], [SRC] | `node scripts/verify-plan.mjs` pass 7/7 sections; đầy đủ `Skills Loaded & Applied` (`.agents/skills/add-translation/SKILL.md`, `.agents/skills/vikini-investigate/SKILL.md`, `.agents/skills/vikini-simplify/SKILL.md`), Test Contract TC-ORF-01..08 và Negative Probes NP1–NP3.                                                                                                                                                                                                                                                                         |
| S1: Cold-start & Build                                  | PASS    | [CMD], [SRC] | `npm run type-check` exit 0; không thêm dependency hay biến môi trường; kiểm tra parity khóa dịch compile-time tại `src/lib/utils/translations/index.ts:24-33`.                                                                                                                                                                                                                                                                                                                                                                                          |
| S2: Runner Lifecycle & Teardown                         | PASS    | [CMD], [SRC] | Thay đổi dữ liệu tĩnh đồng bộ và unit test trong `src/lib/core/modelRegistry.test.ts:1-188` (`npx vitest run src/lib/core/modelRegistry.test.ts` pass 19/19 tests); không tạo stream/timer/thư mục tạm và không dùng circular mock.                                                                                                                                                                                                                                                                                                                      |
| S3: Database & Temporal Logic                           | N/A     | [SRC]        | Không áp dụng vì task chỉ xóa mục dữ liệu tĩnh trong TypeScript và khóa dịch, không chạm bảng Supabase, RLS hay SQL migration (`database-migrations/004_add_model_permissions.sql:14-16`).                                                                                                                                                                                                                                                                                                                                                               |
| S4: Cross-Task State Flow                               | PASS    | [SRC]        | Đã đối chiếu luồng state thực tế: `mapConversationRow` coerce model cũ về `DEFAULT_MODEL` (`src/lib/features/chat/conversations.ts:144`), `useLandingModel` kiểm tra `SELECTABLE_MODELS.some(...)` (`src/app/features/chat/components/hooks/useModelSelection.ts:18-21`), `reconcileAllowedStoryModel` kiểm tra `isModelAllowedById` (`src/lib/core/modelAccess.ts:78-100`), và tab `"openrouter-free"` trong `ModelSelector.tsx` (`src/app/features/chat/components/ModelSelector.tsx:25,126-132,274-277`) hiển thị `t("modelSelectorAvailableLater")`. |
| S5: Security Boundary & 3-Tier Auth                     | PASS    | [SRC], [ADV] | Server-side `loadOrCreateConversation` chuẩn hóa `model = normalizeModelForApi(requestedModel)` (`src/app/api/chat-stream/conversationLoader.ts:67`) trước `assertModelAllowedForUser` (`src/app/api/chat-stream/chatStreamCore.ts:128`) và trước khi chọn client (`src/app/api/chat-stream/chatStreamCore.ts:502-507`), chặn mọi request gửi trực tiếp 4 ID `:free` đã gỡ.                                                                                                                                                                              |
| S6: External Resilience & Serverless Cap                | N/A     | [SRC]        | Không áp dụng vì task không sửa API route, timeout/retry của SDK hay cấu hình `maxDuration`.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Domain: Open Inquiry (Vikini Specifics)                 | PASS    | [SRC], [CMD] | Đối chiếu `SELECTABLE_MODELS` (`src/lib/core/modelRegistry.ts:147-191`), `API_ALLOWED` (`src/lib/core/modelRegistry.ts:341-345`), `getModelTokenLimit` (`src/lib/core/modelRegistry.ts:450-453`), và xóa đồng thời 4 khóa dịch trong `src/lib/utils/translations/vi.ts:105-108` cùng `src/lib/utils/translations/en.ts:102-105`.                                                                                                                                                                                                                         |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines**:
  - **Đồng thời**: `N/A` — Thay đổi chỉ xóa hằng số tĩnh trong `SELECTABLE_MODELS`, `API_ALLOWED` và từ điển dịch thuật lúc khởi tạo module, không có trạng thái khả biến dùng chung giữa các request.
  - **Khoảng trống check→use (TOCTOU)**:
    ```
    Cơ chế: Chuẩn hóa và kiểm tra quyền model khi gửi chat-stream với conversation cũ lưu ID ":free"
    T1: Client gửi POST /api/chat-stream cho conversation có row.model = "google/gemma-3-27b-it:free" | T2: getConversation() gọi mapConversationRow (conversations.ts:144) coerce về "gemini-2.5-flash" và conversationLoader.ts:67 gọi normalizeModelForApi() trả về "gemini-2.5-flash" | T3: assertModelAllowedForUser(userId, "gemini-2.5-flash") kiểm tra quyền trên DEFAULT_MODEL và định tuyến về Gemini
    Kết cục: Không có khả năng lọt ID ":free" đã xóa sang OpenRouter client -> An toàn
    ```
  - **Thất bại giữa chừng & dọn dẹp**: `N/A` — Không thay đổi luồng SSE stream controller, AbortController hay kết nối mạng/DB.
  - **Môi trường serverless**: `N/A` — `SELECTABLE_MODELS` và `API_ALLOWED` là hằng số bất biến theo bundle, đồng nhất giữa mọi serverless instance.
- **Commands Executed**:
  - `node scripts/verify-plan.mjs docs/plans/2026-10-30-remove-openrouter-free-models.md` (exit 0)
  - `npm run type-check` (exit 0)
  - `npx vitest run src/lib/core/modelRegistry.test.ts` (exit 0, 19 passed)

#### 4. Kết Luận

[PLAN_APPROVED]
