# Kế Hoạch Triển Khai: Gỡ Bỏ Gemini 3.1 (Pro / Flash-Lite Preview) & Chuyển Embedding Sang `gemini-embedding-2` GA

- **Revision**: 2
- **Status**: Completed
- **Date**: 2026-11-13
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

**Mục tiêu**

1. Gỡ hoàn toàn `gemini-3.1-pro-preview` và `gemini-3.1-flash-lite-preview` khỏi danh sách model đang hoạt động: `SELECTABLE_MODELS`, `API_ALLOWED`, translations (`en.ts`/`vi.ts`), `useChatTranslations.ts`, `streaming/utils.ts`.
2. Giữ an toàn cho hội thoại cũ trong DB: ánh xạ `gemini-3.1-flash-lite-preview → gemini-3.5-flash-lite` và `gemini-3.1-pro-preview → gemini-3.8-flash` trong `MODEL_ALIASES`; **đồng thời trỏ lại toàn bộ alias đang chain vào 3.1** (`gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-pro-preview`, `gemini-3.1-flash-lite`) sang đích mới để không alias nào trả về ID đã chết.
3. Đổi model cứng trong `src/app/api/prompt-suggest/route.ts` sang `gemini-3.5-flash-lite`.
4. Đổi `GEMINI_EMBEDDING_API_MODEL` từ `gemini-embedding-2-preview` sang `gemini-embedding-2` (GA) và cập nhật test.
5. Cập nhật các test bị ảnh hưởng theo Test Failure Triage **Loại C** (đặc tả đổi có plan), đồng bộ `docs/models.md`, `docs/database-schema.md`, `docs/CHANGELOG.md`.

**Out of Scope (What We're NOT Doing)**

- KHÔNG viết migration SQL / backfill cột `conversations.model` — chuẩn hóa xảy ra lúc đọc qua `coerceStoredModel` (`src/lib/features/chat/conversations.ts:144`).
- KHÔNG sửa `rank_configs.allowed_models` trong DB — `modelAccess` đã reverse-match qua alias (`src/lib/core/modelAccess.ts:40-66`).
- KHÔNG re-embed dữ liệu knowledge base hiện có (xem `[NEEDS_PRODUCT_DECISION]` #1 ở §3).
- KHÔNG đổi cột/constraint `embedding_model` (đã là `'gemini-embedding-2'` tại `supabase/migrations/20260928180000_unify_gemini_embedding_2.sql:42,48`).
- KHÔNG gộp/xóa hàm `isGemini3Model` trùng tên giữa `streaming/utils.ts` và `useThinkingLevel.ts`, KHÔNG thêm `gemini-3.5`/`gemini-3.8` vào danh sách `isGemini3Model` của streaming (export không có caller — dọn dead code là task riêng `/simplify`).
- KHÔNG đổi key translation `"gemini-3-pro"` (nhãn "Gemini 3.1 Pro", `src/lib/utils/translations/en.ts:117`) — key legacy không phải model 3.1 ID; ghi nhận là `[MINOR]` follow-up.
- KHÔNG sửa `scripts/smoke-embedding.ts` (dùng `console.log`, ngoài phạm vi; constant được import nên tự nhận ID mới).
- KHÔNG sửa plan/CHANGELOG lịch sử trong `docs/plans/*` và `docs/archive/*`.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File                              | Mục đích                                                            |
| --------------------------------- | ------------------------------------------------------------------- |
| `.agents/rules/00-core.md`        | Tech stack, ranh giới 4 tầng, kỷ luật git, co-located test bắt buộc |
| `.agents/rules/02-quality.md`     | Pre-Work triggers, Test Failure Triage (Loại C), cấm hạ chuẩn test  |
| `.agents/rules/05-plan-review.md` | Cấu trúc plan, Cross-Model Critic (chạm `*.server.ts`)              |
| `scripts/verify-plan.mjs`         | 7 heading bắt buộc, kiểm `file:line`, `CRITIC_REQUIRED`             |
| `docs/models.md`                  | Bảng model/alias cần đồng bộ                                        |
| `src/lib/core/modelRegistry.ts`   | SSOT registry, alias, normalize/coerce                              |

**Skills Loaded & Applied**

| Skill                                        | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/add-model/SKILL.md`          | Gỡ entry `SELECTABLE_MODELS` phải gỡ cặp `descKey` ở cả `vi.ts`/`en.ts`; cập nhật `docs/models.md` (Step 4)                                                    |
| `.agents/skills/add-translation/SKILL.md`    | Xóa key đồng thời ở cả 2 file; `index.ts` có compile-time parity → bắt buộc `npm run type-check`                                                               |
| `.agents/skills/api-patterns/SKILL.md`       | `prompt-suggest` chỉ đổi literal model, giữ nguyên pattern `requireApprovedUser` → `AppError` → `success/error`; test mới mock theo pattern route test hiện có |
| `.agents/skills/vikini-investigate/SKILL.md` | Blast-radius của `MODEL_ALIASES`/`normalizeModelForApi` (lib/core shared): đã truy vết 12 caller (§3 A3)                                                       |
| `.agents/skills/streaming-patterns/SKILL.md` | Chạm `streaming/utils.ts`: chỉ xóa phần tử mảng, không đổi SSE contract                                                                                        |

### 3. Assumptions & Cross-Task Dependencies

- **A1** — `normalizeModelForApi` trả **thẳng** giá trị alias, không chuẩn hóa đệ quy và không kiểm `API_ALLOWED` cho giá trị đó `[SRC] src/lib/core/modelRegistry.ts:376-378`. ⇒ Nếu chỉ xóa 3.1 khỏi `API_ALLOWED` mà để nguyên `"gemini-3-pro": "gemini-3.1-pro-preview"` (`src/lib/core/modelRegistry.ts:333-336`), các alias này sẽ gửi ID đã chết lên Gemini API (404). **Bắt buộc trỏ lại cả 4 alias chain**.
- **A2** — `coerceStoredModel` = normalize + kiểm selectable, fallback `DEFAULT_MODEL` `[SRC] src/lib/core/modelRegistry.ts:393-397`; hội thoại DB đọc qua hàm này `[SRC] src/lib/features/chat/conversations.ts:144`. ⇒ Alias mới đủ để hội thoại cũ hiển thị model đích (3.8 Flash / 3.5 Flash-Lite) thay vì rơi về default.
- **A3** — Blast-radius `normalizeModelForApi`/`coerceStoredModel`: `src/app/api/chat-stream/conversationLoader.ts:67`, `src/app/api/chat-stream/chatStreamCore.ts:273`, `src/app/api/chat-stream/streaming/gemini-stream.ts:156`, `src/app/api/generate-image/route.ts:161`, `src/lib/features/files/fileProcessors.ts:525`, `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:397`, `src/lib/features/novelcrafter/modelDisplay.ts:46`, `src/lib/features/novelcrafter/aiInheritanceTable.ts:44`, `src/lib/core/limits.ts:371`, `src/lib/core/modelAccess.ts:45`. Tất cả tiêu thụ qua registry → chỉ đổi registry là đủ, không cần sửa caller.
- **A4** — `modelAccess` coi key `MODEL_ALIASES` là "known" và reverse-match `[SRC] src/lib/core/modelAccess.ts:40-66`. ⇒ Rank có `allowed_models` chứa `gemini-3.1-pro-preview` sẽ được dùng `gemini-3.8-flash` (đúng tiền lệ migrate 2.5 → 3.8, `src/lib/core/modelRegistry.ts:325-326`).
- **A5** — Thinking level sau alias: `gemini-3.1-pro-preview` → `gemini-3.8-flash` hỗ trợ `["low","medium","high"]` `[SRC] src/lib/core/modelRegistry.ts:60`, giống 3.1 Pro cũ `[SRC] src/lib/core/modelRegistry.ts:86`; `gemini-3.1-flash-lite-preview` → `gemini-3.5-flash-lite` hỗ trợ đủ 4 mức `[SRC] src/lib/core/modelRegistry.ts:49`. ⇒ Clamp không đổi hành vi với người dùng cũ.
- **A6** — `useThinkingLevel.isGemini3Model` resolve qua `MODEL_ALIASES` trước `[SRC] src/app/features/chat/components/hooks/useThinkingLevel.ts:27-30` ⇒ UI thinking vẫn đúng cho ID legacy, không cần sửa file này.
- **A7** — `streaming/utils.ts#isGemini3Model` chỉ được re-export `[SRC] src/app/api/chat-stream/streaming/index.ts:9`, không có caller runtime (grep `isGemini3Model` toàn `src/`) ⇒ xóa 4 phần tử 3.1 tại `src/app/api/chat-stream/streaming/utils.ts:178-182` không đổi hành vi runtime.
- **A8** — Translation keys 3.1 chỉ được tham chiếu tại `src/lib/core/modelRegistry.ts:80,91` và `src/app/features/chat/components/hooks/useChatTranslations.ts:47,60,62-63` (grep `modelDescPro31|modelDescFlashLite31`) ⇒ xóa an toàn khi xóa đồng bộ.
- **A9** — `prompt-suggest` hard-code `"gemini-3.1-flash-lite-preview"` `[SRC] src/app/api/prompt-suggest/route.ts:43`; Google đã shutdown model này ngày 2026-05-25 `[URL] https://ai.google.dev/gemini-api/docs/deprecations` ⇒ route hiện có thể đang lỗi 500; đây là fix thật, không chỉ dọn dẹp. Route chưa có test (Glob `src/app/api/prompt-suggest/**` chỉ ra `route.ts`).
- **A10** — `gemini-embedding-2` là ID GA (22/04/2026), cùng 3072 chiều, preview là `gemini-embedding-2-preview` (10/03/2026) `[URL] https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2`. Cấu hình `outputDimensionality: EMBEDDING_DIMENSION` giữ nguyên `[SRC] src/lib/features/projects/embedding.server.ts:111-113,148-153`.
- **Cross-Task Dependencies**: Không phụ thuộc plan đang mở khác. Working tree hiện có thay đổi Novelcrafter Prompt Studio chưa commit (`docs/plans/2026-11-12-novelcrafter-prompt-studio-ide-overhaul-plan.md`) — **chạm chung `en.ts`/`vi.ts`** ⇒ chỉ dùng `Edit` thay chính xác 2–4 dòng, không ghi đè file.

**`[NEEDS_PRODUCT_DECISION]`**

1. **Tương thích embedding space preview ↔ GA**: Tài liệu Google xác nhận `embedding-001` ↔ `embedding-2-preview` **không** tương thích, nhưng KHÔNG nêu rõ preview ↔ GA `[URL] https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2-preview`.
   - **Default Assumption**: GA là bản promote của preview cùng embedding space (cùng tên họ, cùng 3072d, cùng task prefix) ⇒ không re-embed trong task này. Kèm Wiring Probe thủ công sau deploy (§9 WP-5) và rollback 1 dòng nếu điểm similarity sụt.
2. **Hội thoại đang chọn 3.1 Pro bị chuyển sang 3.8 Flash** (category `reasoning`, không còn "Pro"). **Default Assumption**: chấp nhận, theo đúng yêu cầu task brief.

### 4. Bảng Verified Versions

| Thư viện / Model                             | Phiên bản                                                     | Nguồn                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@google/genai`                              | `^2.10.0`                                                     | `[SRC] package.json:40` — `models.embedContent` / `generateContent` không đổi chữ ký                                                                                   |
| `next`                                       | `^16.4.0`                                                     | `[SRC] package.json:64`                                                                                                                                                |
| `vitest`                                     | `^4.1.12`                                                     | `[SRC] package.json:118`                                                                                                                                               |
| `gemini-embedding-2` (GA, 3072d, 22/04/2026) | GA                                                            | `[URL] https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2` · `[URL] https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/embedding-2` |
| `gemini-3.1-flash-lite-preview`              | Shutdown 25/05/2026                                           | `[URL] https://ai.google.dev/gemini-api/docs/deprecations`                                                                                                             |
| `gemini-3.1-pro-preview`                     | Preview (chưa công bố shutdown) — gỡ theo quyết định sản phẩm | `[URL] https://ai.google.dev/gemini-api/docs/deprecations` · `[URL] https://ai.google.dev/gemini-api/docs/changelog`                                                   |
| `gemini-3.5-flash-lite`, `gemini-3.8-flash`  | Đã có trong registry                                          | `[SRC] src/lib/core/modelRegistry.ts:41-62`                                                                                                                            |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

**Source**

- [MODIFY] `src/lib/core/modelRegistry.ts` — xóa 2 entry `SELECTABLE_MODELS` (`:77-99`), xóa 2 dòng `API_ALLOWED` (`:283-285`), viết lại khối alias 3.1 (`:332-336`).
- [MODIFY] `src/app/api/prompt-suggest/route.ts` — đổi literal model (`:43`).
- [MODIFY] `src/lib/features/projects/embedding.server.ts` — đổi header comment (`:3`) + constant (`:10`).
- [MODIFY] `src/lib/utils/translations/en.ts` — xóa `:114`, `:118`, `:122`, `:124`.
- [MODIFY] `src/lib/utils/translations/vi.ts` — xóa `:116`, `:120`, `:125`, `:127`.
- [MODIFY] `src/app/features/chat/components/hooks/useChatTranslations.ts` — xóa `:47`, `:60`, `:62`, `:63`.
- [MODIFY] `src/app/api/chat-stream/streaming/utils.ts` — xóa comment + 4 phần tử 3.1 (`:178-182`).

**Tests (Loại C)**

- [MODIFY] `src/lib/core/modelRegistry.test.ts`
- [MODIFY] `src/lib/features/projects/embedding.server.test.ts`
- [MODIFY] `src/app/api/generate-image/route.test.ts`
- [MODIFY] `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/gemini-stream.test.ts`
- [MODIFY] `src/app/features/chat/components/hooks/useThinkingLevel.test.ts`
- [MODIFY] `src/app/features/chat/components/thinkingOptions.test.ts`
- [NEW] `src/app/api/prompt-suggest/route.test.ts`

**Docs**

- [MODIFY] `docs/models.md`
- [MODIFY] `docs/database-schema.md`
- [MODIFY] `docs/CHANGELOG.md`

> `CRITIC_REQUIRED`: **yes** — `src/lib/features/projects/embedding.server.ts` khớp `*.server.ts`.

### 6. Caller-First Design Sketch

**Phía caller (không đổi chữ ký nào)**

```ts
// Hội thoại cũ đọc từ DB (src/lib/features/chat/conversations.ts:144)
coerceStoredModel("gemini-3.1-pro-preview"); // → "gemini-3.8-flash"
coerceStoredModel("gemini-3.1-flash-lite-preview"); // → "gemini-3.5-flash-lite"
normalizeModelForApi("gemini-3-pro"); // → "gemini-3.8-flash"   (trước: ID chết)
normalizeModelForApi("gemini-3.1-flash-lite"); // → "gemini-3.5-flash-lite"
isSelectableModelId("gemini-3.1-pro-preview"); // → false
```

**Registry sau thay đổi (`src/lib/core/modelRegistry.ts`)**

```ts
// API_ALLOWED: bỏ khối "// Gemini 3.1 (March 2026)"

// Gemini 3.1 deprecations (Nov 2026) → Gemini 3.5 Flash-Lite / 3.8 Flash
"gemini-3.1-pro-preview": "gemini-3.8-flash",
"gemini-3.1-pro": "gemini-3.8-flash",
"gemini-3-pro": "gemini-3.8-flash",
"gemini-3-pro-preview": "gemini-3.8-flash",
"gemini-3.1-flash-lite-preview": "gemini-3.5-flash-lite",
"gemini-3.1-flash-lite": "gemini-3.5-flash-lite",
```

**Phía test (invariant mới — chống alias trỏ vào ID chết)**

```ts
it.each(Object.entries(MODEL_ALIASES))(
  "TC-G31-05: alias %s → %s resolves to a live canonical ID",
  (_alias, target) => {
    expect(normalizeModelForApi(target)).toBe(target);
    expect(target.startsWith("gemini-3.1")).toBe(false);
  }
);
```

**Embedding**

```ts
export const GEMINI_EMBEDDING_API_MODEL = "gemini-embedding-2";
```

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **S1** — `modelRegistry.ts`: xóa entry `gemini-3.1-pro-preview` + `gemini-3.1-flash-lite-preview` và comment section (`src/lib/core/modelRegistry.ts:77-99`).
- [ ] **S2** — `modelRegistry.ts`: xóa comment + 2 ID khỏi `API_ALLOWED` (`src/lib/core/modelRegistry.ts:283-285`).
- [ ] **S3** — `modelRegistry.ts`: thay khối alias (`src/lib/core/modelRegistry.ts:332-336`) bằng 6 dòng như §6.
- [ ] **S4** — `en.ts`/`vi.ts`: xóa 4 key `"gemini-3.1-pro-preview"`, `"gemini-3.1-flash-lite-preview"`, `modelDescPro31`, `modelDescFlashLite31` ở **cả hai** file bằng `Edit` khoanh dòng.
- [ ] **S5** — `useChatTranslations.ts`: xóa 4 phần tử tương ứng (`src/app/features/chat/components/hooks/useChatTranslations.ts:47,60,62-63`).
- [ ] **S6** — `streaming/utils.ts`: xóa comment + 4 phần tử 3.1 (`src/app/api/chat-stream/streaming/utils.ts:178-182`).
- [ ] **S7** — `src/app/api/prompt-suggest/route.ts:43`: `model: "gemini-3.5-flash-lite"`.
- [ ] **S8** — `src/lib/features/projects/embedding.server.ts:3` và `src/lib/features/projects/embedding.server.ts:10`: `gemini-embedding-2`.
- [ ] **S9** — `npm run type-check` (Tier 1; bắt parity translation + `descKey`).
- [ ] **S10** — Cập nhật test theo §8 (Loại C) + tạo `src/app/api/prompt-suggest/route.test.ts`.
- [ ] **S11** — Chạy test theo path (§9), sau đó `npm run type-check; npm run lint; npm run test:run`.
- [ ] **S12** — Docs: `docs/models.md` (xóa section §"Gemini 3.1 Series" `:49-110` nhưng giữ callout Thinking Level Migration `:55-62` dời vào section Gemini 3.5/3.8; sửa ghi chú `:163`, bảng thinking `:360-364`, bảng alias `:426-429` + thêm 2 dòng alias mới); `docs/database-schema.md:392` đổi "API endpoint" sang `gemini-embedding-2`; thêm entry `docs/CHANGELOG.md`.
- [ ] **S13** — Negative Probe grep (§9 NP-1) xác nhận không còn literal 3.1 / embedding preview ngoài alias + test legacy.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

**`src/lib/core/modelRegistry.test.ts`** — thêm `describe("Gemini 3.1 Deprecation Migration (TC-G31-01..07)")`:

| ID        | Input                                                                                                          | Output kỳ vọng (matcher chặt `toBe`/`toEqual`)                                                                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-G31-01 | `SELECTABLE_MODELS`                                                                                            | không phần tử nào có `id.startsWith("gemini-3.1")` (`toHaveLength(0)`)                                                                                                                                                                                                                          |
| TC-G31-02 | `it.each` `[gemini-3.1-pro-preview→gemini-3.8-flash]`, `[gemini-3.1-flash-lite-preview→gemini-3.5-flash-lite]` | `MODEL_ALIASES[id]`, `normalizeModelForApi(id)`, `coerceStoredModel(id)` đều `toBe(target)`; `isSelectableModelId(id)` `toBe(false)`                                                                                                                                                            |
| TC-G31-03 | `it.each` `gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-pro-preview`                                             | `normalizeModelForApi` `toBe("gemini-3.8-flash")`                                                                                                                                                                                                                                               |
| TC-G31-04 | `gemini-3.1-flash-lite`                                                                                        | `toBe("gemini-3.5-flash-lite")`                                                                                                                                                                                                                                                                 |
| TC-G31-05 | `it.each(Object.entries(MODEL_ALIASES))`                                                                       | `normalizeModelForApi(target)` `toBe(target)` **và** `target.startsWith("gemini-3.1")` `toBe(false)` — **Negative Probe**: fail nếu bất kỳ alias nào trỏ vào ID không còn trong `API_ALLOWED` (vì hàm fallback `DEFAULT_MODEL` ≠ target, trừ target = DEFAULT hợp lệ)                           |
| TC-G31-06 | `en`, `vi`                                                                                                     | `Object.hasOwn(x, k)` `toBe(false)` cho `modelDescPro31`, `modelDescFlashLite31`, `"gemini-3.1-pro-preview"`, `"gemini-3.1-flash-lite-preview"`                                                                                                                                                 |
| TC-G31-07 | legacy IDs                                                                                                     | `getSupportedGeminiThinkingLevels("gemini-3.1-pro-preview")` `toEqual(["low","medium","high"])`; `clampGeminiThinkingLevel("gemini-3.1-pro-preview","minimal")` `toBe("low")`; `getSupportedGeminiThinkingLevels("gemini-3.1-flash-lite-preview")` `toEqual(["minimal","low","medium","high"])` |

Sửa hiện hữu: `src/lib/core/modelRegistry.test.ts:129` → `toBe("gemini-3.8-flash")`; đổi tiêu đề `:67` thành "…for legacy Gemini 3.1 Pro alias and Gemini 3.8 Flash" (giữ nguyên expectation `:68-77`). Dòng `:35-36`, `:53-58`, `:105`, `:117`, `:227` giữ nguyên — vẫn đúng qua alias (đóng vai trò regression cho ID legacy).

**`src/lib/features/projects/embedding.server.test.ts`** — `:52`, `:116`, `:184` → `"gemini-embedding-2"`. Thêm 1 assertion Negative: `expect(GEMINI_EMBEDDING_API_MODEL).not.toContain("preview")`.

**`src/app/api/generate-image/route.test.ts`** — TC-GI-04 (`:900-923`): input + kỳ vọng → `"gemini-3.8-flash"`. Thêm **TC-GI-04b**: `enhancerModel: "gemini-3.1-pro-preview"` ⇒ `mockGenerateContent.mock.calls[0][0].model` `toBe("gemini-3.8-flash")` (wiring alias qua `src/app/api/generate-image/route.ts:161-166`).

**`src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`** — `:409`, `:446` giữ input `"gemini-3.1-pro-preview"` (mô phỏng story cũ), `:416` kỳ vọng `model: "gemini-3.8-flash"`; `thinkingConfig.thinkingLevel` vẫn `"LOW"` (A5). Đây là wiring probe `normalizeModelForApi` tại `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:397`.

**`src/app/api/chat-stream/streaming/gemini-stream.test.ts`** — test `:420-444`: đổi tiêu đề "clamps minimal to low for legacy Gemini 3.1 Pro alias (→ 3.8 Flash)", giữ input `gemini-3.1-pro-preview`, thêm `expect(generateMock.mock.calls[0][0].model).toBe("gemini-3.8-flash")`; giữ nguyên các expect `thinkingConfig` hiện có.

**`src/app/features/chat/components/hooks/useThinkingLevel.test.ts`** — `:63`, `:119` đổi tiêu đề sang "legacy gemini-3.1-pro-preview alias"; giữ nguyên expectation (A6).

**`src/app/features/chat/components/thinkingOptions.test.ts`** — `:35` thay `"gemini-3.1-pro-preview"` bằng `"gemini-3.8-flash"`.

**[NEW] `src/app/api/prompt-suggest/route.test.ts`** (mock `@/lib/features/auth/requireApprovedUser`, `@/lib/core/rateLimit`, `@/lib/core/genaiClient` theo pattern `src/app/api/generate-image/route.test.ts:11-21`):

| ID       | Input                                                                                | Output                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| TC-PS-01 | `{ partialPrompt: "a cat on a" }`, rate limit allowed, mock trả `text: "a\nb\nc\nd"` | status 200; `mockGenerateContent.mock.calls[0][0].model` `toBe("gemini-3.5-flash-lite")`; `data.suggestions` `toEqual(["a","b","c","d"])` |
| TC-PS-02 | `partialPrompt: "abc"` (< 5 ký tự)                                                   | status 400; `mockGenerateContent` `not.toHaveBeenCalled()`                                                                                |
| TC-PS-03 | rate limit `{ allowed: false }`                                                      | status 429; `mockGenerateContent` `not.toHaveBeenCalled()`                                                                                |
| TC-PS-04 | `mockGenerateContent` reject `new Error("upstream")`                                 | status 500; body `error.message` `toBe("Failed to generate suggestions")` (không lộ "upstream")                                           |

**Chống specification gaming (cho `@qa`)**: Cấm `.skip/.only/xit/fit`; cấm xóa `expect` hiện có ngoài các dòng liệt kê ở trên; matcher giữ `toBe`/`toEqual`, cấm hạ xuống `toBeDefined`/`toBeTruthy`. TC-G31-05 phải lặp trên `Object.entries(MODEL_ALIASES)` thật, không hard-code danh sách.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

**Co-located**: `src/lib/core/modelRegistry.ts` ↔ `src/lib/core/modelRegistry.test.ts`; `src/lib/features/projects/embedding.server.ts` ↔ `src/lib/features/projects/embedding.server.test.ts`; `src/app/api/prompt-suggest/route.ts` ↔ [NEW] `route.test.ts`.

**Lệnh (PowerShell 5.1, dùng `;`)**

```powershell
npm run type-check
npx vitest run src/lib/core/modelRegistry.test.ts src/lib/features/projects/embedding.server.test.ts src/app/api/prompt-suggest src/app/api/generate-image/route.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts src/app/api/chat-stream/streaming/gemini-stream.test.ts src/app/features/chat/components --reporter=dot
npm run type-check; npm run lint; npm run test:run
node scripts/verify-plan.mjs docs/plans/2026-11-13-deprecate-gemini-31-and-update-embedding.md
```

**Wiring Probes**

- **WP-1** TC-G31-02 — DB row `model = "gemini-3.1-pro-preview"` đi qua `coerceStoredModel` (`src/lib/features/chat/conversations.ts:144`) ra `gemini-3.8-flash`.
- **WP-2** TC-GI-04b — alias đi qua `src/app/api/generate-image/route.ts:161-166` tới payload SDK.
- **WP-3** Novelcrafter test — alias đi qua `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:397` tới `generateContentStream({ model })`.
- **WP-4** TC-PS-01 — literal mới thực sự xuất hiện trong payload `generateContent`.
- **WP-5 (thủ công, sau deploy)** — mở 1 project có knowledge doc đã index trước đó, hỏi câu có đáp án trong tài liệu; kỳ vọng RAG vẫn trích đúng đoạn. Nếu không → rollback `src/lib/features/projects/embedding.server.ts:10` và mở task re-embed.

**Negative Probes**

- **NP-1 (grep)**: `rg -n "gemini-3\.1-(pro|flash-lite)-preview|gemini-embedding-2-preview" src` chỉ được trả về: (a) key trong `MODEL_ALIASES`, (b) input legacy trong test. Bất kỳ match nào trong `SELECTABLE_MODELS`, `API_ALLOWED`, translations, `useChatTranslations.ts`, `streaming/utils.ts`, `prompt-suggest/route.ts`, `embedding.server.ts` ⇒ FAIL.
- **NP-2**: TC-G31-05 — chèn tạm (mental simulation) `"foo": "gemini-3.1-pro-preview"` ⇒ `normalizeModelForApi("gemini-3.1-pro-preview")` trả `gemini-3.8-flash` ≠ target ⇒ test đỏ. Chứng minh guard chặn alias trỏ vào ID chết.
- **NP-3**: TC-G31-06 — nếu quên xóa key ở 1 trong 2 file ⇒ đỏ; nếu xóa lệch 1 file ⇒ `npm run type-check` đỏ do parity `index.ts`.
- **NP-4**: TC-PS-02/03 — validation & rate-limit chặn trước khi gọi Gemini.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                                             | Mức        | Technical control / Probe                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Embedding space GA ≠ preview ⇒ vector query mới lệch vector tài liệu cũ, RAG trả kết quả kém (không lỗi, "silent") | **Cao**    | Constant duy nhất `src/lib/features/projects/embedding.server.ts:10` dùng cho cả query & index (`:111`, `:148`) ⇒ rollback 1 dòng; WP-5 kiểm sau deploy; `[NEEDS_PRODUCT_DECISION]` #1 |
| R2  | Alias chain (`gemini-3-pro` → 3.1) trả ID đã gỡ ⇒ Gemini 404                                                       | **Cao**    | S3 trỏ lại 4 alias; TC-G31-03/04 + Negative Probe TC-G31-05 trên `src/lib/core/modelRegistry.ts:376-378`                                                                               |
| R3  | Hội thoại / story cũ lưu 3.1 rơi về `DEFAULT_MODEL` thay vì model tương đương                                      | Trung bình | Alias trực tiếp + `coerceStoredModel` `src/lib/core/modelRegistry.ts:393-397`; TC-G31-02, WP-1, WP-3                                                                                   |
| R4  | Xóa translation lệch giữa `en`/`vi` hoặc còn `descKey` mồ côi ⇒ type error / UI hiện key thô                       | Trung bình | Parity compile-time (`add-translation` SKILL) + TC-G31-06 + test sẵn có `src/lib/core/modelRegistry.test.ts:341-346`                                                                   |
| R5  | Thinking level legacy bị clamp khác (vd `minimal` gửi lên 3.8 Flash ⇒ HTTP 400)                                    | Trung bình | Clamp theo model đích `src/lib/core/modelRegistry.ts:460-471`; TC-G31-07 + gemini-stream test `src/app/api/chat-stream/streaming/gemini-stream.test.ts:420-444`                        |
| R6  | Rank `allowed_models` chứa 3.1 ID mở quyền 3.8 Flash cho rank đó                                                   | Thấp       | Hành vi mong muốn (A4), reverse-match `src/lib/core/modelAccess.ts:53-66`                                                                                                              |
| R7  | Xung đột với thay đổi chưa commit trên `en.ts`/`vi.ts` (Prompt Studio)                                             | Thấp       | Chỉ `Edit` khoanh dòng, không `Write` đè file                                                                                                                                          |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision 1 (chưa có lỗi cũ).
- Output `node scripts/verify-plan.mjs docs/plans/2026-11-13-deprecate-gemini-31-and-update-embedding.md` (exit code `1`):

```text
[PASS] SECTIONS 7/7
[FAIL] MISSING_FILE conversations.ts:144
[FAIL] MISSING_FILE prompt-suggest/route.ts:43
[FAIL] MISSING_FILE embedding.server.ts:3
[FAIL] MISSING_FILE embedding.server.ts:10
[INFO] CRITIC_REQUIRED yes (src/lib/features/projects/embedding.server.ts)
[INFO] CRITIC_FLOOR skipped (no audit run)
VERIFY_PLAN: FAIL (4 failures, 0 warnings)
```

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                     | Bằng chứng | Lý do                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------- | ------- | ------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `docs/plans/2026-11-13-deprecate-gemini-31-and-update-embedding.md:122,167,168` | [CMD]      | `verify-plan.mjs` trả exit 1 (`4 failures`: `conversations.ts:144`, `prompt-suggest/route.ts:43`, `embedding.server.ts:3`, `embedding.server.ts:10`) do dùng đường dẫn rút gọn thay vì relative path đầy đủ từ repo root (`src/lib/features/chat/conversations.ts:144`, `src/app/api/prompt-suggest/route.ts:43`, `src/lib/features/projects/embedding.server.ts:3,10`). Vi phạm Fail Criterion #1. |
| 2   | RISK_DISMISSED | [MINOR] | `src/lib/core/modelAccess.ts:40-66`                                             | [SRC]      | Reverse-match qua `normalizeModelForApi(item) === normalized` (`:63`) và `coerceStoredModel(item) === coerced` (`:64`) hoạt động đúng như thiết kế khi `rank_configs.allowed_models` còn chứa ID 3.1 cũ.                                                                                                                                                                                            |
| 3   | RISK_DISMISSED | [MINOR] | `src/app/features/chat/components/hooks/useThinkingLevel.ts:27-30`              | [SRC]      | `isGemini3Model` tra `MODEL_ALIASES` trước khi kiểm `includes("gemini-3") \|\| includes("gemini-4")`, nên ID legacy 3.1 vẫn giữ đúng hành vi thinking UI mà không cần sửa hook này.                                                                                                                                                                                                                 |
| 4   | RISK_DISMISSED | [MINOR] | `src/lib/core/modelRegistry.ts:376-378`                                         | [SRC]      | `normalizeModelForApi` trả thẳng `MODEL_ALIASES[raw]` không đệ quy; bước S3 trỏ lại cả 4 alias chain (`gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-pro-preview`, `gemini-3.1-flash-lite`) sang `3.8-flash`/`3.5-flash-lite` xử lý triệt để nguy cơ trả ID đã gỡ.                                                                                                                                     |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                 | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                              |
| ----------------------------------- | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness (7/7)             | FAIL    | [CMD]        | `SECTIONS 7/7` đạt, nhưng `verify-plan.mjs` FAIL 4 `MISSING_FILE` do shorthand `file:line` (Fail Criterion #1).                                                                                                                       |
| Skills Loaded & Applied             | PASS    | [SRC]        | Đã ánh xạ `add-model`, `add-translation`, `api-patterns`, `vikini-investigate`, `streaming-patterns` khớp `.agents/rules/02-quality.md`.                                                                                              |
| S1: Cold-start & Build              | PASS    | [CMD]        | `npm run type-check` exit 0; `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/features/projects/embedding.server.test.ts --reporter=dot` exit 0 (57/57 passed).                                                             |
| S2: Runner Lifecycle & Teardown     | PASS    | [SRC]        | Không thêm stream/timer mới; `gemini-stream.test.ts:420-444` giữ nguyên teardown; `embedding.server.test.ts:45-48` có `beforeEach` reset mock.                                                                                        |
| S3: Database & Temporal Logic       | N/A     | [SRC]        | Không thêm/sửa migration SQL hay RLS; `conversations.ts:144` chuẩn hóa lúc đọc qua `coerceStoredModel`; cột `embedding_model` đã là `'gemini-embedding-2'` (`supabase/migrations/20260928180000_unify_gemini_embedding_2.sql:42,48`). |
| S4: Cross-Task State Flow           | PASS    | [SRC]        | Đã đối chiếu `conversations.ts:144`, `useThinkingLevel.ts:27-30`, `useChatTranslations.ts:47,60,62-63`, `en.ts:114-124`, `vi.ts:116-127`; không xung đột chữ ký.                                                                      |
| S5: Security Boundary & 3-Tier Auth | PASS    | [SRC]        | `prompt-suggest/route.ts:17-24` giữ nguyên `requireApprovedUser()` và `consumeRateLimit`; `embedding.server.ts` giữ nguyên phạm vi `*.server.ts`.                                                                                     |
| S6: External Resilience & Cap       | PASS    | [SRC], [URL] | `embedding.server.ts:65-94` giữ `withEmbeddingRetry`; `gemini-embedding-2` GA (3072d) và `gemini-3.1-flash-lite-preview` shutdown 2026-05-25 đã xác nhận qua web search.                                                              |
| Domain: Model Registry & Bilingual  | PASS    | [SRC]        | Khớp toàn bộ line ref tại `modelRegistry.ts:77-99,283-285,332-336`, `en.ts`/`vi.ts`, `docs/models.md`, `docs/database-schema.md:392`, và các file test Loại C.                                                                        |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Đồng thời**: `N/A` — Không thay đổi cơ chế locking, rate-limit hay quota transaction; `prompt-suggest/route.ts:21` và `embedding.server.ts:109-174` giữ nguyên luồng hiện hữu.
  2. **Khoảng trống check→use (TOCTOU)**: `N/A` — `normalizeModelForApi` và `coerceStoredModel` (`modelRegistry.ts:369-397`) là hàm thuần đồng bộ trên hằng số tĩnh `MODEL_ALIASES`/`API_ALLOWED`/`SELECTABLE_SET`.
  3. **Thất bại giữa chừng & dọn dẹp**: `N/A` — Không thay đổi SSE controller hay abort listener; `prompt-suggest/route.ts:84-88` giữ catch `AppError` / 500 không lộ upstream error.
  4. **Môi trường serverless**: `N/A` — Không thêm state in-memory mới (`embedding.server.ts:18` giữ nguyên singleton client lazy-init).
- **Commands Executed**:
  - `node scripts/verify-plan.mjs docs/plans/2026-11-13-deprecate-gemini-31-and-update-embedding.md` → exit `1` (`4 failures`: `MISSING_FILE` cho 4 shorthand `file:line`).
  - `npm run type-check` → exit `0`.
  - `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/features/projects/embedding.server.test.ts --reporter=dot` → exit `0` (2 files, 57 tests passed).

#### 4. Kết Luận

[CHANGES_REQUESTED]

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-13-deprecate-gemini-31-and-update-embedding.md` (exit code `0`):

```text
[PASS] SECTIONS 7/7
[INFO] CRITIC_REQUIRED yes (src/lib/features/projects/embedding.server.ts)
[PASS] CRITIC_FLOOR 4 findings with valid file:line
VERIFY_PLAN: PASS (0 failures, 0 warnings)
```

| Lỗi cũ (Audit Run 1)                                                                                                          | Trạng thái | Bằng chứng                       | Chi tiết                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------- | ---------------------------------------------------------------------------- |
| 4 shorthand `file:line` gây `MISSING_FILE` (`conversations.ts:144`, `prompt-suggest/route.ts:43`, `embedding.server.ts:3,10`) | ĐÃ SỬA     | `[CMD]` `verify-plan.mjs` exit 0 | Đã thay bằng relative path đầy đủ từ repo root tại dòng `122`, `167`, `168`. |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                | Bằng chứng | Lý do                                                                                                                                                                                                                                              |
| --- | -------------- | ------- | ---------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | [MINOR] | `src/lib/features/projects/embedding.server.ts:10,111,148` | [SRC]      | Đổi `GEMINI_EMBEDDING_API_MODEL` sang `"gemini-embedding-2"` dùng chung cho cả `generateEmbedding` (`:111`) và `generateEmbeddingsBatch` (`:148`) với `outputDimensionality: 3072`; rollback 1 dòng nếu điểm similarity thực tế sụt (WP-5).        |
| 2   | RISK_DISMISSED | [MINOR] | `src/app/api/prompt-suggest/route.ts:43`                   | [SRC]      | Đổi model literal từ `"gemini-3.1-flash-lite-preview"` (đã shutdown 2026-05-25) sang `"gemini-3.5-flash-lite"`, giữ nguyên `requireApprovedUser`, `consumeRateLimit`, và schema Zod.                                                               |
| 3   | RISK_DISMISSED | [MINOR] | `src/lib/core/modelRegistry.ts:332-336,376-378`            | [SRC]      | Cả 4 alias chain (`gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-pro-preview`, `gemini-3.1-flash-lite`) cùng 2 preview ID được trỏ thẳng về `gemini-3.8-flash` / `gemini-3.5-flash-lite`; `TC-G31-05` khóa invariant không alias nào trỏ vào ID chết. |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                 | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                   |
| ----------------------------------- | ------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness (7/7)             | PASS    | [CMD]        | `verify-plan.mjs` exit 0 (`SECTIONS 7/7`, `0 failures, 0 warnings`).                                                                                                                                                                                       |
| Skills Loaded & Applied             | PASS    | [SRC]        | Ánh xạ đầy đủ `add-model`, `add-translation`, `api-patterns`, `vikini-investigate`, `streaming-patterns`.                                                                                                                                                  |
| S1: Cold-start & Build              | PASS    | [CMD]        | `npm run type-check` exit 0; `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/features/projects/embedding.server.test.ts --reporter=dot` exit 0 (57/57 passed).                                                                                  |
| S2: Runner Lifecycle & Teardown     | PASS    | [SRC]        | Không thêm stream/timer mới; `gemini-stream.test.ts:420-444` và `embedding.server.test.ts:45-48` giữ nguyên teardown/reset.                                                                                                                                |
| S3: Database & Temporal Logic       | N/A     | [SRC]        | Không thêm/sửa migration SQL hay RLS; `src/lib/features/chat/conversations.ts:144` chuẩn hóa lúc đọc qua `coerceStoredModel`; DB `embedding_model` đã là `'gemini-embedding-2'` (`supabase/migrations/20260928180000_unify_gemini_embedding_2.sql:42,48`). |
| S4: Cross-Task State Flow           | PASS    | [SRC]        | Đã đối chiếu `conversations.ts:144`, `useThinkingLevel.ts:27-30`, `useChatTranslations.ts:47,60,62-63`, `en.ts:114-124`, `vi.ts:116-127`.                                                                                                                  |
| S5: Security Boundary & 3-Tier Auth | PASS    | [SRC]        | `src/app/api/prompt-suggest/route.ts:17-24` giữ nguyên `requireApprovedUser()` và `consumeRateLimit`; `src/lib/features/projects/embedding.server.ts` giữ nguyên `*.server.ts`.                                                                            |
| S6: External Resilience & Cap       | PASS    | [SRC], [URL] | `embedding.server.ts:65-94` giữ `withEmbeddingRetry`; `gemini-embedding-2` GA (3072d) và `gemini-3.1-flash-lite-preview` shutdown 2026-05-25 đã xác nhận.                                                                                                  |
| Domain: Model Registry & Bilingual  | PASS    | [SRC]        | Khớp line ref tại `modelRegistry.ts`, `en.ts`/`vi.ts`, `docs/models.md`, `docs/database-schema.md:392`, và các file test Loại C.                                                                                                                           |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Đồng thời**: `N/A` — Không thay đổi cơ chế locking, rate-limit hay quota transaction.
  2. **Khoảng trống check→use (TOCTOU)**: `N/A` — `normalizeModelForApi` và `coerceStoredModel` (`src/lib/core/modelRegistry.ts:369-397`) là hàm thuần đồng bộ trên hằng số tĩnh.
  3. **Thất bại giữa chừng & dọn dẹp**: `N/A` — Không thay đổi SSE controller hay abort listener.
  4. **Môi trường serverless**: `N/A` — Không thêm state in-memory mới (`src/lib/features/projects/embedding.server.ts:18` giữ nguyên singleton lazy-init).
- **Commands Executed**:
  - `node scripts/verify-plan.mjs docs/plans/2026-11-13-deprecate-gemini-31-and-update-embedding.md` → exit `0` (`VERIFY_PLAN: PASS (0 failures, 0 warnings)`, `CRITIC_REQUIRED yes`).

#### 4. Kết Luận

[AWAITING_CRITIC]

### Audit Run 3 (Cross-Model Critic)

[REVIEWER_MODEL: claude-code-cli (critic)]
CRITIC_VERDICT: AGREE

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- **Giới hạn môi trường**: Bash và PowerShell bị từ chối trong phiên critic (`dontAsk` mode) ⇒ KHÔNG thực thi được `node scripts/verify-plan.mjs`. Thay vào đó đã đọc toàn bộ `scripts/verify-plan.mjs:15-384` và giả lập thủ công 4 check:
  - `SECTIONS` (`scripts/verify-plan.mjs:67-90`): 7/7 heading có mặt trong `## Technical Plan` (§1 Out of Scope, §2 Skills Loaded, §3 Assumptions, §4 Verified Versions, §7 Các Bước Thực Hiện, §8 Test Contract, §9 Verification Plan).
  - `LINE_REF` (`scripts/verify-plan.mjs:145-186`): `## Technical Plan` không đổi kể từ Audit Run 2 (exit 0); đã đối chiếu lại bằng `Read` các ref trọng yếu — tất cả khớp nội dung thật (xem bảng dưới).
  - `CRITIC_REQUIRED` (`scripts/verify-plan.mjs:205-243`): `yes` — trigger duy nhất là `src/lib/features/projects/embedding.server.ts` (các file `*.server.test.ts` không khớp regex `\.server\.(ts|tsx|js|jsx)$`).
  - `CRITIC_FLOOR` (`scripts/verify-plan.mjs:253-310`): bảng Critic Findings dưới đây có 7 dòng, mỗi dòng có ≥ 1 `file:line` repo-relative tồn tại.
- **Yêu cầu cho Orchestrator (Gate 3)**: chạy `node scripts/verify-plan.mjs docs/plans/2026-11-13-deprecate-gemini-31-and-update-embedding.md` và xác nhận exit 0 trước khi bắt đầu S1.
- **Kiểm chứng line ref của plan** (không kế thừa Run 1/2):

| Ref trong plan                         | Trạng thái                                    | Bằng chứng                                                                  |
| -------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| Entry 3.1 `SELECTABLE_MODELS` `:77-99` | KHỚP                                          | [SRC] `src/lib/core/modelRegistry.ts:77-99`                                 |
| `API_ALLOWED` 3.1 `:283-285`           | KHỚP                                          | [SRC] `src/lib/core/modelRegistry.ts:283-285`                               |
| Alias chain 3.1 `:332-336`             | KHỚP                                          | [SRC] `src/lib/core/modelRegistry.ts:332-336`                               |
| Translation en `:114,118,122,124`      | KHỚP (sau thay đổi Prompt Studio chưa commit) | [SRC] `src/lib/utils/translations/en.ts:114-124`                            |
| Translation vi `:116,120,125,127`      | KHỚP                                          | [SRC] `src/lib/utils/translations/vi.ts:116-127`                            |
| `useChatTranslations` `:47,60,62,63`   | KHỚP                                          | [SRC] `src/app/features/chat/components/hooks/useChatTranslations.ts:47-63` |
| `streaming/utils.ts` `:178-182`        | KHỚP                                          | [SRC] `src/app/api/chat-stream/streaming/utils.ts:178-182`                  |
| `prompt-suggest` literal `:43`         | KHỚP                                          | [SRC] `src/app/api/prompt-suggest/route.ts:43`                              |
| Embedding constant `:10`               | KHỚP                                          | [SRC] `src/lib/features/projects/embedding.server.ts:10`                    |

#### Critic Findings

| #   | Loại           | Severity | `file:line`                                        | Evidence                                                                        | Lý do & Biện pháp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------- | -------- | -------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR]  | `src/lib/features/projects/embedding.server.ts:10` | [URL] https://aistudio.google.com/docs/deprecations (redirect từ ai.google.dev) | Google ghi `gemini-embedding-2-preview` **shutdown 06/11/2026, request tự động route sang `gemini-embedding-2`**. Hôm nay 13/11/2026 ⇒ prod đã chạy GA từ 1 tuần; đổi constant là no-op về hành vi. Hệ quả: (a) R1 không do plan này gây ra (đã xảy ra từ 06/11, giảm mức thực tế); (b) **"rollback 1 dòng" ở R1/WP-5 vô hiệu** — đổi lại `-preview` vẫn bị route sang GA. Khuyến nghị khi implement: ghi CHANGELOG đúng sự thật này; nếu WP-5 phát hiện RAG suy giảm thì biện pháp duy nhất là re-embed, không phải rollback. Không chặn vì không thay đổi hành vi runtime. |
| 2   | RISK_DISMISSED | [MINOR]  | `src/lib/core/modelRegistry.ts:376-386`            | [SRC]                                                                           | TC-G31-05 (`normalizeModelForApi(target) === target` ∀ alias) không false-fail: mọi target hiện hữu đều nằm trong `API_ALLOWED` và không target nào là alias key — `DEFAULT_MODEL = "gemini-3.5-flash-lite"` (`src/lib/core/modelRegistry.ts:4`, `:276`), `gemini-3-flash-preview`/`gemini-3-pro-image` (`:280-281`), `GEMINI_4_ARGON` (`:288`), Llama (`:294-295`), DeepSeek (`:302-307`), GLM (`:310`). Sau S3 hai target mới `gemini-3.8-flash`/`gemini-3.5-flash-lite` (`:276-277`) cũng thỏa.                                                                           |
| 3   | RISK_DISMISSED | [MINOR]  | `src/lib/core/limits.ts:371-380`                   | [SRC]                                                                           | Ngoài `modelAccess.ts`, `limits.ts` cũng mở rộng `allowedSet` qua `normalizeModelForApi`/`coerceStoredModel` của từng phần tử ⇒ rank có `gemini-3-pro-preview` (vd admin, `database-migrations/004_add_model_permissions.sql:16`) hoặc ID 3.1 sẽ được dùng `gemini-3.8-flash`. Đây đúng là R6 + tiền lệ `gemini-2.5-pro → gemini-3.8-flash` (`src/lib/core/modelRegistry.ts:326`); không phải leo thang đặc quyền ngoài ý muốn. Plan nên liệt kê thêm `limits.ts` trong A4 — chỉ là tài liệu.                                                                                |
| 4   | RISK_DISMISSED | [MINOR]  | `src/app/api/chat-stream/streaming/index.ts:9`     | [SRC]                                                                           | Comment "requires thoughtSignature handling" ở `src/app/api/chat-stream/streaming/utils.ts:164` gợi ý runtime dependency, nhưng Grep `isGemini3Model` toàn `src/` chỉ ra re-export này và bản riêng ở `src/app/features/chat/components/hooks/useThinkingLevel.ts:27-30` (resolve alias trước). Xóa 4 phần tử 3.1 không đổi hành vi.                                                                                                                                                                                                                                         |
| 5   | RISK_DISMISSED | [MINOR]  | `src/app/api/prompt-suggest/route.ts:19-35`        | [SRC]                                                                           | Route gọi `consumeRateLimit` (`:21`) **trước** `schema.parse` (`:29`) ⇒ TC-PS-02 (400) phải mock rate-limit `allowed: true`, nếu không sẽ ra 429/500. Plan không ghi rõ — implementer cần set mặc định `allowed: true` trong `beforeEach`. TC-PS-04: `error()` chỉ sanitize khi `NODE_ENV === "production"` (`src/lib/utils/apiResponse.ts:38-41`) ⇒ test env trả đúng literal `"Failed to generate suggestions"`. TC-PS-03: `RateLimitError` = 429 (`src/lib/utils/errors.ts:105`). Contract khả thi.                                                                       |
| 6   | RISK_DISMISSED | [MINOR]  | `src/lib/core/modelRegistry.ts:403`                | [SRC]                                                                           | Hội thoại cũ 3.1 Pro: `tokenLimit` 2M (`src/lib/core/modelRegistry.ts:82`) → 1M của 3.8 Flash (`:56`) qua `getModelTokenLimit` → `coerceStoredModel`. Lịch sử > 1M token sẽ bị cắt theo cơ chế context hiện hữu, không crash; cùng tiền lệ migrate 2.5 Pro. Chấp nhận theo `[NEEDS_PRODUCT_DECISION]` #2.                                                                                                                                                                                                                                                                    |
| 7   | RISK_DISMISSED | [MINOR]  | `src/lib/utils/translations/index.ts:22-34`        | [SRC]                                                                           | Parity en/vi compile-time thật sự tồn tại (`MissingInVi`/`MissingInEn` → `_AssertTranslationsParity`) ⇒ NP-3 hợp lệ: xóa lệch 1 file sẽ đỏ `npm run type-check`. Test sẵn có `src/lib/core/modelRegistry.test.ts:341-346` (TC-ORF-07) bắt `descKey` mồ côi. Gợi ý: TC-G31-06 có thể tái dùng pattern `REMOVED_DESC_KEYS` (`src/lib/core/modelRegistry.test.ts:333-339`).                                                                                                                                                                                                     |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Hạng mục / Kịch bản                 | Kết quả           | Evidence Type | Chi tiết                                                                                                                                                                                                       |
| ----------------------------------- | ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan Completeness (7/7)             | PASS              | [SRC]         | Giả lập `checkRequiredSections` (`scripts/verify-plan.mjs:67-90`) trên heading §1–§9; `[CMD]` chưa chạy được — Orchestrator chạy lại ở Gate 3.                                                                 |
| Signature parity `[MODIFY]`         | PASS              | [SRC]         | Không đổi chữ ký hàm nào; chỉ đổi literal/phần tử mảng/alias (`src/lib/core/modelRegistry.ts:319-356`, `src/app/api/prompt-suggest/route.ts:43`).                                                              |
| Technical control rủi ro Cao        | PASS (có ghi chú) | [SRC], [URL]  | R2: TC-G31-03/04/05. R1: control "rollback" vô hiệu (Finding #1) nhưng rủi ro đã tồn tại độc lập với plan từ 06/11/2026; WP-5 + re-embed là control thực.                                                      |
| Negative Probe                      | PASS              | [SRC]         | TC-G31-05 lặp `Object.entries(MODEL_ALIASES)` thật; NP-1 regex `gemini-3\.1-(pro                                                                                                                               | flash-lite)-preview`không bắt nhầm`gemini-3.1-flash-image`(image-gen, ngoài phạm vi —`src/app/features/image-gen/components/hooks/useImageGenStudio.ts:72`). |
| S1: Cold-start & Build              | PASS              | [SRC]         | Parity translation compile-time (`src/lib/utils/translations/index.ts:22-34`) + S9 `npm run type-check` ngay sau sửa source.                                                                                   |
| S2: Runner Lifecycle & Teardown     | N/A               | [SRC]         | Không thêm stream/timer/listener; `src/app/api/chat-stream/streaming/gemini-stream.ts:156-187` chỉ đổi đầu vào alias.                                                                                          |
| S3: Database & Temporal Logic       | N/A               | [SRC]         | Không migration; đọc qua `coerceStoredModel` (`src/lib/core/modelRegistry.ts:393-397`); `embedding_model` luôn `"gemini-embedding-2"` (`src/lib/features/projects/knowledge.server.ts:163`).                   |
| S4: Cross-Task State Flow           | PASS              | [SRC]         | Working tree Prompt Studio chạm `en.ts`/`vi.ts` nhưng line ref 3.1 vẫn đúng (bảng §1); plan bắt buộc `Edit` khoanh dòng.                                                                                       |
| S5: Security Boundary & 3-Tier Auth | PASS              | [SRC]         | `requireApprovedUser` (`src/app/api/prompt-suggest/route.ts:19`) và access check (`src/lib/core/limits.ts:389-402`, `src/lib/core/modelAccess.ts:40-70`) không đổi; mở rộng quyền chỉ theo alias (Finding #3). |
| S6: External Resilience             | PASS              | [URL]         | 3.1 Flash-Lite Preview shutdown 25/05/2026; embedding preview auto-route GA từ 06/11/2026 (aistudio.google.com/docs/deprecations).                                                                             |

#### 3. Adversarial Timelines & Commands Executed

- **S3/S5 Timelines**: S3 `N/A` (không ghi DB, chuẩn hóa thuần lúc đọc). S5: user rank basic có `allowed_models = ["gemini-3.1-pro-preview"]` → sau deploy gửi `gemini-3.1-pro-preview` → `limits.ts:371` normalize → `gemini-3.8-flash` ∈ allowedSet → cho phép; user đó KHÔNG được thêm model nào ngoài đích alias ⇒ không leo thang.
- **Embedding timeline**: index tài liệu trước 06/11 (preview) → query sau 06/11 (đã GA do auto-route) → sau deploy plan (GA) — không có điểm chuyển mới do plan tạo ra.
- **Tools đã dùng** (shell bị từ chối): `Read` (`scripts/verify-plan.mjs`, `src/lib/core/modelRegistry.ts`, `src/lib/core/modelAccess.ts`, `src/app/api/prompt-suggest/route.ts`, `src/app/api/generate-image/route.ts`, `src/app/api/chat-stream/streaming/gemini-stream.ts`, các test Loại C, `src/lib/utils/apiResponse.ts`); `Grep` (`gemini-3\.1|gemini-embedding-2-preview|Pro31|FlashLite31` toàn repo, `isGemini3Model`, `embedding_model`, `limits.ts`, parity `translations/index.ts`); `WebFetch` aistudio.google.com/docs/deprecations và /docs/models/gemini-embedding-2.

#### 4. Kết Luận

Không có `[BLOCKER]`/`[MAJOR]` mới có dẫn chứng. Lưu ý thực thi: (1) Orchestrator chạy `verify-plan.mjs` ở Gate 3; (2) TC-PS-02 mock rate-limit allowed; (3) CHANGELOG/R1 ghi đúng việc preview đã auto-route GA từ 06/11/2026.

[PLAN_APPROVED]
