# Implementation Plan: Model Catalog Upgrade & Model Picker Redesign

- **Date**: 2026-11-21
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Status**: Ready for Review
- **Revision**: 1
- **Scope**: Nâng cấp đồng bộ danh mục AI Model (Gemini 4 Hydrogen/Neon, Claude 5.5 Haiku/Sonnet + Adaptive Thinking, DeepSeek gom nhóm, Grok 4.7, Groq `openai/gpt-oss-120b` + fix routing, giữ GLM 5.2 & Strata Local) và thiết kế lại Model Picker theo nhóm hãng (`uiGroup`), nhãn `Miễn phí` / `Trả phí`, thông số Context, và bộ mô tả song ngữ VI/EN mới.

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Goal

1. **Nâng cấp Model Catalog (`src/lib/core/modelRegistry.ts`, `src/lib/utils/constants.ts`)** theo đúng quyết định PM:
   - **Gemini** (đầu danh sách): Giữ `gemini-3.5-flash-lite` (`DEFAULT_MODEL`); bỏ `gemini-3.8-flash` & `gemini-3-flash-preview` → thay bằng `gemini-4-hydrogen` (`1M` context, `64K` output, thinking `low/medium/high/xhigh`); bỏ `gemini-4-argon` → thay bằng `gemini-4-neon` (`1M` context, `64K` output, thinking `low/medium/high/xhigh`). Map đầy đủ legacy aliases.
   - **Claude (Anthropic)**: Nâng `claude-haiku-4.5` → `claude-haiku-5-5` (OpenRouter: `anthropic/claude-haiku-5.5`) và `claude-sonnet-4.5` → `claude-sonnet-5-5` (OpenRouter: `anthropic/claude-sonnet-5.5`), cả 2 đều `1M` context, `128K` max output; hỗ trợ **Adaptive Thinking** (`thinking: { type: "adaptive" }`, KHÔNG gửi `budget_tokens` gây HTTP 400). Giữ alias ngược `claude-haiku-4.5` / `claude-sonnet-4.5`.
   - **DeepSeek**: Gom 3 model (`deepseek/deepseek-v4.1-flash`, `deepseek/deepseek-v4-pro`, `deepseek/deepseek-v3.2:floor`) vào chung 1 nhóm UI `deepseek`; bỏ `deepseek-v4-flash` (map `deepseek-v4-flash`, `deepseek-chat`, `deepseek-reasoner` → `deepseek/deepseek-v4.1-flash`) và dọn sạch dead code `deepseekClient.ts` / Direct API branch.
   - **Grok (xAI via OpenRouter)**: Nâng `x-ai/grok-4.3` → `x-ai/grok-4.7` (`500K` context, giữ alias `x-ai/grok-4.3` → `x-ai/grok-4.7`).
   - **GLM (Z.ai via OpenRouter)**: Giữ `z-ai/glm-5.2` trong nhóm UI `glm`.
   - **Groq**: Bỏ `llama-3.1-8b-instant` & `llama-3.3-70b-versatile`; thay bằng `openai/gpt-oss-120b` (`131K` context, Groq Free Tier, `isFree: true`); map toàn bộ legacy Llama aliases sang `openai/gpt-oss-120b`. Sửa routing trong `chatStreamCore.ts` dùng helper `isGroqModel(model)` dựa trên `providerId === "groq"` trước check `isOpenRouter` để không route nhầm `openai/gpt-oss-120b` (có dấu `/`) sang OpenRouter.
   - **Local**: Giữ `strata-local` (`isFree: true`, `32K` context).
2. **Mở rộng Thinking Level (`xhigh`)** nhất quán từ `modelRegistry.ts` → `validators.ts` → `streaming/*` → `useThinkingLevel.ts` → `thinkingOptions.ts` → UI & i18n.
3. **Thiết kế lại Model Picker (`src/lib/core/modelPicker.ts`, `src/app/features/chat/components/ModelPickerList.tsx`, `vi.ts`, `en.ts`)**:
   - Gom nhóm theo Hãng (`uiGroup`) đúng thứ tự: `gemini` → `anthropic` (Claude) → `deepseek` → `grok` → `glm` → `groq` → `local`.
   - Chỉ phân biệt `Miễn phí` (`isFree: true`: `openai/gpt-oss-120b`, `strata-local`) và `Trả phí` (`isFree: false`); tuyệt đối không hiển thị giá USD hay `$ / $$ / $$$`.
   - Tab lọc `free` lọc theo `model.isFree === true`.
   - Chỉ hiển thị thông số Context (`1M`, `500K`, `131K`, `128K`, `32K` + nhãn song ngữ `ngữ cảnh` / `context`).
   - Dòng 2 của item dùng `line-clamp-2`, viết lại toàn bộ `modelDesc*` trong `vi.ts` và `en.ts` theo công thức `[Dùng để làm gì] · [Ưu điểm / hiệu quả]`, không lặp tên model.

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** tạo migration SQL hay thay đổi bảng `rank_configs` trên DB (hệ thống `modelAccess.ts` và `limits.ts` đã tự động giải quyết alias 2 chiều qua `MODEL_ALIASES` + `normalizeModelForApi()` / `coerceStoredModel()`; admin có thể tick model mới trên UI `RankConfigManager.tsx` bất cứ lúc nào).
- **KHÔNG** nâng cấp phiên bản `@anthropic-ai/sdk` hay `@google/genai` trong `package.json` (giữ nguyên dependencies đã verify ổn định; dùng type narrowing sạch tại boundary).
- **KHÔNG** thay đổi Image Studio models (`ALLOWED_GENERATE_IMAGE_MODELS`, `ALLOWED_EDIT_IMAGE_MODELS`) hay `gemini-3-pro-image`.
- **KHÔNG** thay đổi cấu trúc Popover / Sheet container của `ModelSelector.tsx` hoặc luồng lưu `recentModelsStore.ts`.
- **KHÔNG** sửa đổi `novelcrafter` prompt builder hay cấu trúc SSE frame.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Tài liệu đã đọc

- `.agents/rules/00-core.md`, `.agents/rules/02-quality.md`, `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md`, `.agents/rules/05-plan-review.md`
- `docs/models.md` (`[SRC]` `docs/models.md:1-401`)
- `package.json` (`[SRC]` `package.json:38-82`)

#### Skills Loaded & Applied

| Skill (`SKILL.md` đã đọc bằng `read_file`)   | Quyết định kỹ thuật chịu ảnh hưởng trực tiếp                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/add-model/SKILL.md`          | Tuân thủ đúng quy trình 4 bước: cập nhật `SELECTABLE_MODELS` + `API_ALLOWED` + `MODEL_ALIASES` trong `src/lib/core/modelRegistry.ts`, đồng bộ key mô tả song ngữ trong `vi.ts`/`en.ts`, kiểm tra tương thích `rank_configs` (`modelAccess.ts` / `limits.ts`), và cập nhật living doc `docs/models.md`.                            |
| `.agents/skills/add-translation/SKILL.md`    | Mọi text UI mới (`modelBadgeFree`, `modelBadgePaid`, `modelContextSuffix`, `thinkingLevelXHigh`, các `modelDesc*`) đều thêm đồng thời vào `src/lib/utils/translations/vi.ts` và `en.ts`, gọi qua `useLanguage()` + `t("key")`, xóa các key mô tả đã ngừng dùng để tránh rác và kiểm tra key parity qua `npm run type-check`.      |
| `.agents/skills/vikini-investigate/SKILL.md` | Thực hiện phân tích blast-radius đa tầng (static import, interface/type consumer, mocked test files) trên `src/lib/core/modelRegistry.ts`, `src/lib/core/modelPicker.ts`, `src/lib/utils/constants.ts`, `src/app/api/chat-stream/**`, `src/lib/features/novelcrafter/**` trước khi đề xuất thay đổi hoặc xóa `deepseekClient.ts`. |

---

### 3. Assumptions & Cross-Task Dependencies

#### Assumptions (kèm bằng chứng `[SRC]`)

1. **Tương thích DB `rank_configs` & lịch sử chat cũ không cần SQL migration**: `src/lib/core/limits.ts:370-373` và `src/lib/core/modelAccess.ts:45-68` đều ánh xạ 2 chiều thông qua `normalizeModelForApi()` và `coerceStoredModel()` dựa trên `MODEL_ALIASES`. Do đó, các bản ghi cũ lưu `gemini-3.8-flash`, `gemini-4-argon`, `claude-sonnet-4.5`, `deepseek-v4-flash`, `x-ai/grok-4.3`, `llama-3.3-70b-versatile` sẽ tự động khớp model mới mà không làm khóa quyền người dùng hay hỏng lịch sử chat.
2. **Tách biệt `providerId` (transport routing) và `uiGroup` (nhóm hiển thị UI)**: `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:411,488-534` đọc `modelMeta.providerId` để định tuyến giữa `gemini`, `anthropic`, `local`, `groq`, và `openrouter-pay`. Giữ nguyên `providerId` cho routing và thêm `uiGroup` cho nhóm UI trong `modelPicker.ts` giúp gom 3 model DeepSeek vào 1 nhóm và tách riêng GLM mà không làm vỡ routing của Novelcrafter.
3. **Gemini 4 Explicit Caching tiếp tục bị tắt**: `src/lib/core/contextCache.ts:157,251` đã chặn `model.startsWith("gemini-4")` (chỉ dùng implicit caching). `gemini-4-hydrogen` và `gemini-4-neon` đều bắt đầu bằng `"gemini-4"`, nên guard này tự động áp dụng an toàn.
4. **Anthropic Claude 5.5 Adaptive Thinking**: Theo tài liệu Anthropic 2026, gửi `thinking: { type: "enabled", budget_tokens: N }` cho `claude-sonnet-5-5` hoặc `claude-haiku-5-5` sẽ trả lỗi `400 Bad Request`; phải dùng `thinking: { type: "adaptive" }` (không có `budget_tokens`) và giữ `temperature: 1`. Trong `src/app/api/chat-stream/streaming/anthropic-stream.ts:257`, payload đã được narrowed cast sang `Parameters<typeof ai.beta.messages.create>[0]`, tương thích với `@anthropic-ai/sdk@^0.71.2` (`package.json:39`).
5. **Groq routing không thể dựa vào `!model.includes("/")`**: `src/app/api/chat-stream/chatStreamCore.ts:533-534` hiện dùng `model.includes("llama") && !model.includes("/")` và `isOpenRouter = model.includes("/") || model.includes(":free")`. Với `openai/gpt-oss-120b` (chứa `/`), bắt buộc kiểm tra `isGroqModel(model)` trước và loại trừ `!isGroq` khỏi `isOpenRouter`.

#### Blast-Radius Analysis (theo `.agents/skills/vikini-investigate/SKILL.md` Mode 4)

| Caller / Consumer                                    | `file:line` (`[SRC]`)                                                                                                                                                                                                                                                                                                                        | Tầng | Cách tham chiếu | Usage Pattern                                                                                                                     | Compatible?                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `chatStreamCore.ts`                                  | `src/app/api/chat-stream/chatStreamCore.ts:11-21,530-630`                                                                                                                                                                                                                                                                                    | 2    | static import   | Routing Groq (`llama`), DeepSeek Direct (`getDeepSeekClient`), Claude fallback (`CLAUDE_HAIKU_45`)                                | **No** → Migrate sang `isGroqModel`, bỏ DeepSeek Direct, đổi sang `CLAUDE_HAIKU_55`     |
| `anthropic-stream.ts`                                | `src/app/api/chat-stream/streaming/anthropic-stream.ts:3,53,225-257`                                                                                                                                                                                                                                                                         | 2    | static import   | `modelSupportsClaudeThinking`, gửi `budget_tokens`, union `thinkingLevel` thiếu `xhigh`                                           | **No** → Thêm nhánh Adaptive Thinking cho Claude 5.5, mở rộng union `ThinkingLevel`     |
| `gemini-stream.ts`                                   | `src/app/api/chat-stream/streaming/gemini-stream.ts:144,176-195,554,614-623`                                                                                                                                                                                                                                                                 | 2    | static import   | Hardcode message `"Gemini 4 Argon..."`, union `thinkingLevel` thiếu `xhigh`                                                       | **No** → Cập nhật message sang Gemini 4 chung, mở rộng union `ThinkingLevel`            |
| `streaming/utils.ts`                                 | `src/app/api/chat-stream/streaming/utils.ts:29,34-36,179-193`                                                                                                                                                                                                                                                                                | 2    | static import   | `isDeepThinking` chỉ check `high`, `isGemini3Model` liệt kê `gemini-4-argon`                                                      | **No** → Thêm `xhigh` vào `isDeepThinking`, cập nhật `isGemini3Model` nhận `gemini-4-*` |
| `streaming/types.ts` & `validators.ts`               | `src/app/api/chat-stream/streaming/types.ts:74,193`; `validators.ts:22`                                                                                                                                                                                                                                                                      | 1    | static import   | `ThinkingLevel` & Zod enum thiếu `"xhigh"`                                                                                        | **No** → Thêm `"xhigh"`                                                                 |
| `deepseek-stream.ts` & `deepseek-request-builder.ts` | `src/app/api/chat-stream/streaming/deepseek-stream.ts:28`; `deepseek-request-builder.ts:37,96`                                                                                                                                                                                                                                               | 2    | static import   | `thinkingLevel` union thiếu `"xhigh"`                                                                                             | **No** → Thêm `"xhigh"` (map tương đương `"high"`)                                      |
| `strata-stream.ts` & `strataThinking.ts`             | `src/app/api/chat-stream/streaming/strata-stream.ts:44`; `strataThinking.ts:165-170`                                                                                                                                                                                                                                                         | 2    | static import   | `thinkingLevel` thiếu `"xhigh"`, `normalizeStrataThinkingLevel` chưa map `"xhigh"` → `"high"`                                     | **No** → Thêm `"xhigh"` và clamp `"xhigh"` → `"high"`                                   |
| `novelcrafterStreamRunner.server.ts`                 | `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts:8,14,148-153,381,417`                                                                                                                                                                                                                                                      | 2    | static import   | Import `getDeepSeekClient`/`isDeepSeekDirectModel`, fallback `CLAUDE_HAIKU_45`, `GEMINI_SDK_THINKING_LEVEL_MAP`                   | **No** → Gỡ DeepSeek Direct, đổi fallback `CLAUDE_HAIKU_55`, bổ sung `xhigh` vào map    |
| `useThinkingLevel.ts` & `thinkingOptions.ts`         | `src/app/features/chat/components/hooks/useThinkingLevel.ts:22,36-39,100-163,185,211-217`; `thinkingOptions.ts:14-20`                                                                                                                                                                                                                        | 2    | static import   | `ThinkingLevel` thiếu `xhigh`, `isClaudeThinkingModel` loại Haiku 5.5                                                             | **No** → Thêm `xhigh`, dùng SSOT `modelSupportsClaudeThinking`, clamp an toàn           |
| `modelPicker.ts` & `ModelPickerList.tsx`             | `src/lib/core/modelPicker.ts:16-33,55-157`; `ModelPickerList.tsx:160-209`                                                                                                                                                                                                                                                                    | 1–2  | static import   | Nhóm theo `providerId`, filter `free` theo `openrouter-free`, `line-clamp-1`, thiếu badge Free/Paid & Context                     | **No** → Refactor sang `uiGroup`, `isFree`, `formatContextWindow`, `line-clamp-2`       |
| `RankConfigManager.tsx`                              | `src/app/admin/components/RankConfigManager.tsx:5,287-313`                                                                                                                                                                                                                                                                                   | 2    | static import   | Duyệt `SELECTABLE_MODELS` render `name` & `contextWindow`                                                                         | **Yes** (tự động hiển thị catalog mới)                                                  |
| Mocked / Unit Tests                                  | `modelRegistry.test.ts`, `modelPicker.test.ts`, `modelAccess.test.ts`, `ModelPickerList.test.tsx`, `useThinkingLevel.test.ts`, `chatStreamCore.test.ts`, `anthropic-stream.test.ts`, `gemini-stream.test.ts`, `openai-stream.test.ts`, `novelcrafterStreamRunner.server.test.ts`, `deepseek-request-builder.test.ts`, `contextCache.test.ts` | 1–3  | static / mock   | Chứa fixture ID cũ (`gemini-3.8-flash`, `gemini-4-argon`, `claude-sonnet-4.5`, `llama-3.3-70b-versatile`) & mock `deepseekClient` | **No** → Cập nhật theo Test Contract (Loại C: Approved Spec Change)                     |

---

### 4. Bảng Verified Versions (Online Grounding 2026)

| Thành phần / Model / SDK         | Phiên bản / ID đã xác minh                                      | Thông số chính thức                                                                                                                     | Nguồn xác minh                                                        |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `gemini-4-hydrogen`              | API ID: `gemini-4-hydrogen`                                     | `1,048,576` (1M) context, `65,536` (64K) sync output, `thinkingLevel`: `low`, `medium`, `high` (default), `xhigh`                       | `[URL]` Google Gemini API Docs 2026 (`ai.google.dev` / `blog.google`) |
| `gemini-4-neon`                  | API ID: `gemini-4-neon`                                         | `1,048,576` (1M) context, `65,536` (64K) sync output, `thinkingLevel`: `low`, `medium`, `high` (default), `xhigh`, Paid tier            | `[URL]` Google Gemini API Docs & DeepMind 2026                        |
| `claude-haiku-5-5`               | Direct: `claude-haiku-5-5` / OR: `anthropic/claude-haiku-5.5`   | `1,000,000` (1M) context, `128,000` (128K) max output, Adaptive Thinking (`thinking: { type: "adaptive" }`, không dùng `budget_tokens`) | `[URL]` Anthropic Claude Docs 2026 (`claude.com` / `anthropic.com`)   |
| `claude-sonnet-5-5`              | Direct: `claude-sonnet-5-5` / OR: `anthropic/claude-sonnet-5.5` | `1,000,000` (1M) context, `128,000` (128K) max output, Adaptive Thinking (`thinking: { type: "adaptive" }`, `budget_tokens` gây 400)    | `[URL]` Anthropic Claude Docs 2026 (`claude.com` / `anthropic.com`)   |
| `x-ai/grok-4.7`                  | OpenRouter ID: `x-ai/grok-4.7`                                  | `500,000` (500K) context                                                                                                                | `[URL]` OpenRouter Model Catalog 2026 (`openrouter.ai`)               |
| `openai/gpt-oss-120b`            | Groq API ID: `openai/gpt-oss-120b`                              | `131,072` (131K) context; Groq Free Tier: 30 RPM / 1,000 RPD / 8,000 TPM / 200,000 TPD                                                  | `[URL]` Groq Rate Limits Docs 2026                                    |
| `@google/genai`                  | `^2.10.0`                                                       | Hỗ trợ `thinkingConfig.thinkingLevel` gồm `xhigh`                                                                                       | `[SRC]` `package.json:40` + `[URL]` `@google/genai` TS SDK Docs 2026  |
| `@anthropic-ai/sdk`              | `^0.71.2`                                                       | `ai.beta.messages.create` tương thích với `thinking: { type: "adaptive" }` qua narrowed payload cast                                    | `[SRC]` `package.json:39`                                             |
| `next` / `react` / `tailwindcss` | `16.4.0` / `19.2.3` / `4.1.18`                                  | App Router + Tailwind CSS v4 semantic tokens (`bg-(--token)`)                                                                           | `[SRC]` `package.json:53,64,69`                                       |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới / Xóa

#### `[MODIFY]` (Core, Constants, Streaming, Novelcrafter)

- `src/lib/utils/constants.ts`
- `src/lib/core/modelRegistry.ts`
- `src/lib/core/modelPicker.ts`
- `src/app/api/chat-stream/validators.ts`
- `src/app/api/chat-stream/chatStreamCore.ts`
- `src/app/api/chat-stream/streaming/types.ts`
- `src/app/api/chat-stream/streaming/utils.ts`
- `src/app/api/chat-stream/streaming/gemini-stream.ts`
- `src/app/api/chat-stream/streaming/anthropic-stream.ts`
- `src/app/api/chat-stream/streaming/deepseek-stream.ts`
- `src/app/api/chat-stream/streaming/deepseek-request-builder.ts`
- `src/app/api/chat-stream/streaming/strata-stream.ts`
- `src/lib/features/local-llm/strataThinking.ts`
- `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`

#### `[MODIFY]` (UI Components & Bilingual Translations)

- `src/app/features/chat/components/ModelPickerList.tsx`
- `src/app/features/chat/components/hooks/useThinkingLevel.ts`
- `src/app/features/chat/components/thinkingOptions.ts`
- `src/lib/utils/translations/vi.ts`
- `src/lib/utils/translations/en.ts`

#### `[DELETE]` (Dead Code Removal — DeepSeek Direct API đã ngừng dùng)

- `src/lib/core/deepseekClient.ts`

#### `[MODIFY]` (Co-Located Tests & Living Docs)

- `src/lib/core/modelRegistry.test.ts`
- `src/lib/core/modelPicker.test.ts`
- `src/lib/core/modelAccess.test.ts`
- `src/lib/core/contextCache.test.ts`
- `src/app/features/chat/components/ModelPickerList.test.tsx`
- `src/app/features/chat/components/hooks/useThinkingLevel.test.ts`
- `src/app/api/chat-stream/chatStreamCore.test.ts`
- `src/app/api/chat-stream/streaming/anthropic-stream.test.ts`
- `src/app/api/chat-stream/streaming/gemini-stream.test.ts`
- `src/app/api/chat-stream/streaming/openai-stream.test.ts`
- `src/app/api/chat-stream/streaming/deepseek-request-builder.test.ts`
- `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`
- `docs/models.md`
- `docs/CHANGELOG.md`

---

### 6. Caller-First Design Sketch

#### 6.1 `src/lib/core/modelRegistry.ts` & `src/lib/utils/constants.ts`

```ts
// src/lib/utils/constants.ts
export const MODEL_IDS = {
  IMAGE_STUDIO: "vikini-image-studio",
  NOVELCRAFTER: "vikini-novelcrafter",
  USER_TEMPLATES_STORE: "user_templates_store",
  // Gemini 4
  GEMINI_4_HYDROGEN: "gemini-4-hydrogen",
  GEMINI_4_NEON: "gemini-4-neon",
  // Claude 5.5
  CLAUDE_SONNET_55: "claude-sonnet-5-5",
  CLAUDE_HAIKU_55: "claude-haiku-5-5",
  // DeepSeek (all via OpenRouter)
  DEEPSEEK_V4_PRO: "deepseek/deepseek-v4-pro",
  DEEPSEEK_V41_FLASH: "deepseek/deepseek-v4.1-flash",
  DEEPSEEK_V32: "deepseek/deepseek-v3.2:floor",
  // Grok (via OpenRouter)
  GROK_47: "x-ai/grok-4.7",
  // Z.ai / GLM (via OpenRouter)
  GLM_52: "z-ai/glm-5.2",
  // Groq (Free Tier)
  GROQ_GPT_OSS_120B: "openai/gpt-oss-120b",
  // Local LLM (Strata Engine)
  STRATA_LOCAL: "strata-local",
} as const;

export const CLAUDE_API_MODELS = {
  OPENROUTER: {
    [MODEL_IDS.CLAUDE_SONNET_55]: "anthropic/claude-sonnet-5.5",
    [MODEL_IDS.CLAUDE_HAIKU_55]: "anthropic/claude-haiku-5.5",
  },
  ANTHROPIC: {
    [MODEL_IDS.CLAUDE_SONNET_55]: "claude-sonnet-5-5",
    [MODEL_IDS.CLAUDE_HAIKU_55]: "claude-haiku-5-5",
  },
} as const;
```

```ts
// src/lib/core/modelRegistry.ts
export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

export type ModelUiGroup = "gemini" | "anthropic" | "deepseek" | "grok" | "glm" | "groq" | "local";

export interface SelectableModel {
  id: string;
  descKey: string;
  name?: string;
  tokenLimit: number;
  contextWindow: number;
  maxOutputTokens?: number;
  category: "reasoning" | "low-latency" | "local";
  supportedThinkingLevels?: readonly GeminiThinkingLevel[];
  providerId:
    | "gemini"
    | "grok"
    | "anthropic"
    | "openrouter-free"
    | "openrouter-pay"
    | "openai"
    | "deepseek"
    | "groq"
    | "local";
  /** Brand-based grouping in Model Picker UI */
  uiGroup: ModelUiGroup;
  /** True only for Free Tier / Local models (Groq Free Tier + Strata Local) */
  isFree: boolean;
}

export const UI_GROUP_LABELS: Record<ModelUiGroup, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  deepseek: "DeepSeek",
  grok: "Grok",
  glm: "GLM",
  groq: "Groq",
  local: "Local Models",
};

// New / updated helpers:
export function isGroqModel(modelId: unknown): boolean {
  const normalized = normalizeModelForApi(modelId);
  const found = SELECTABLE_MODELS.find((m) => m.id === normalized);
  return found?.providerId === "groq";
}

export function isClaude55Model(modelId: unknown): boolean {
  const normalized = normalizeModelForApi(modelId).toLowerCase();
  return (
    normalized === MODEL_IDS.CLAUDE_SONNET_55 ||
    normalized === MODEL_IDS.CLAUDE_HAIKU_55 ||
    normalized.includes("claude-sonnet-5") ||
    normalized.includes("claude-haiku-5")
  );
}

export function modelSupportsClaudeThinking(modelId: unknown): boolean {
  const normalized = normalizeModelForApi(modelId).toLowerCase();
  return (
    normalized.includes("claude-sonnet") ||
    normalized.includes("claude-opus") ||
    normalized.includes("claude-haiku-5")
  );
}
```

#### 6.2 `clampGeminiThinkingLevel` Directional Clamping (chống tụt bậc ngược)

```ts
// Khi user chuyển từ Gemini 4 (đang chọn "xhigh") sang Gemini 3.5 Flash-Lite (max "high"),
// kẹp lên/xuống theo hướng hợp lý thay vì luôn đẩy về supported[0] ("minimal"):
const GEMINI_LEVEL_RANK: Record<GeminiThinkingLevel, number> = {
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
};

export function clampGeminiThinkingLevel(
  modelId: unknown,
  requestedLevel: string
): GeminiThinkingLevel {
  const supported = getSupportedGeminiThinkingLevels(modelId);
  if (supported.length === 0) return "low";
  if (supported.includes(requestedLevel as GeminiThinkingLevel)) {
    return requestedLevel as GeminiThinkingLevel;
  }
  const reqRank = GEMINI_LEVEL_RANK[requestedLevel as GeminiThinkingLevel];
  const maxSupported = supported[supported.length - 1];
  if (reqRank !== undefined && reqRank > GEMINI_LEVEL_RANK[maxSupported]) {
    return maxSupported; // e.g. "xhigh" -> "high" on gemini-3.5-flash-lite
  }
  return supported[0]; // e.g. "off" / "minimal" -> "low" on gemini-4-*
}
```

#### 6.3 Groq Routing & Claude 5.5 Adaptive Thinking Call Sites

```ts
// src/app/api/chat-stream/chatStreamCore.ts
const isGroq = isGroqModel(model);
const isDeepSeekV4Pro = isDeepSeekV4ProModel(model);
const isDeepSeekV41Flash = isDeepSeekV41FlashModel(model);
const isOpenRouter = !isGroq && (model.includes("/") || model.includes(":free"));
const isClaude = model.startsWith("claude-");
const useDirectAnthropic = isClaude && Boolean(process.env.ANTHROPIC_API_KEY);
// Routing:
// - useDirectAnthropic -> getClaudeClient() + createAnthropicStream()
// - isDeepSeekV4Pro || isDeepSeekV41Flash -> getOpenRouterClient() + createDeepSeekStream()
// - isGroq -> getGroqClient() + createOpenAICompatibleStream()
// - isOpenRouter || isClaude -> getOpenRouterClient() + createOpenAICompatibleStream()
// - else -> getGenAIClient() + createGeminiStream()
```

```ts
// src/app/api/chat-stream/streaming/anthropic-stream.ts
const isClaudeThinking =
  modelSupportsClaudeThinking(model) && Boolean(thinkingLevel) && thinkingLevel !== "off";
const isAdaptiveThinking = isClaude55Model(model);
const claudeMaxTokens = isClaudeThinking ? 16384 : 8192;

// Request spread:
...(isClaudeThinking
  ? isAdaptiveThinking
    ? { thinking: { type: "adaptive" as const }, temperature: 1 }
    : { thinking: { type: "enabled" as const, budget_tokens: 10240 }, temperature: 1 }
  : { temperature: 0.7 })
```

#### 6.4 `src/lib/core/modelPicker.ts` & `ModelPickerList.tsx`

```ts
// src/lib/core/modelPicker.ts
export const UI_GROUP_ORDER: readonly ModelUiGroup[] = [
  "gemini",
  "anthropic",
  "deepseek",
  "grok",
  "glm",
  "groq",
  "local",
];

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
  if (tokens < 65_536) return `${Math.floor(tokens / 1024)}K`;
  return `${Math.floor(tokens / 1000)}K`;
}

// matchesFilter:
case "free":
  return model.isFree === true;
```

**Bố cục mỗi item trong `ModelPickerList.tsx`**:

- **Dòng 1** (`flex items-center gap-1.5 flex-wrap` hoặc `min-w-0`):
  - Status dot (nếu `strata-local`) + Tên model (`truncate text-sm font-medium text-(--text)`)
  - Badge Free/Paid (`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium`):
    - Free (`model.isFree`): `bg-(--soft) text-(--accent)` → `{t("modelBadgeFree")}` (`Miễn phí` / `Free`)
    - Paid (`!model.isFree`): `border border-(--line) bg-(--raised) text-(--muted)` → `{t("modelBadgePaid")}` (`Trả phí` / `Paid`)
  - Context meta (`shrink-0 text-xs text-(--faint)`): `{formatContextWindow(model.contextWindow)} {t("modelContextSuffix")}` (`1M ngữ cảnh` / `1M context`)
- **Dòng 2**: `<p className="mt-0.5 line-clamp-2 text-xs text-(--muted)">{reason ?? (model.descKey ? t(model.descKey) : "")}</p>`

---

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **Bước 1 — Constants & Model Registry**:
  - Cập nhật `MODEL_IDS` và `CLAUDE_API_MODELS` trong `src/lib/utils/constants.ts`.
  - Cập nhật `src/lib/core/modelRegistry.ts`:
    - Mở rộng `GeminiThinkingLevel` thêm `"xhigh"`.
    - Thêm `ModelUiGroup`, `UI_GROUP_LABELS`, trường `uiGroup` & `isFree` lên `SelectableModel`.
    - Cập nhật `SELECTABLE_MODELS` đúng 12 model theo thứ tự hãng:
      1. `gemini-3.5-flash-lite` (`uiGroup: "gemini"`, `isFree: false`, `1048576`, `65536`, `["minimal","low","medium","high"]`)
      2. `gemini-4-hydrogen` (`uiGroup: "gemini"`, `isFree: false`, `1048576`, `65536`, `category: "low-latency"`, `["low","medium","high","xhigh"]`)
      3. `gemini-4-neon` (`uiGroup: "gemini"`, `isFree: false`, `1048576`, `65536`, `category: "reasoning"`, `["low","medium","high","xhigh"]`)
      4. `claude-haiku-5-5` (`uiGroup: "anthropic"`, `isFree: false`, `1000000`, `128000`, `category: "low-latency"`)
      5. `claude-sonnet-5-5` (`uiGroup: "anthropic"`, `isFree: false`, `1000000`, `128000`, `category: "reasoning"`)
      6. `deepseek/deepseek-v4.1-flash` (`uiGroup: "deepseek"`, `providerId: "openrouter-pay"`, `isFree: false`, `1048576`, `384000`, `category: "low-latency"`)
      7. `deepseek/deepseek-v4-pro` (`uiGroup: "deepseek"`, `providerId: "openrouter-pay"`, `isFree: false`, `1000000`, `65536`, `category: "reasoning"`)
      8. `deepseek/deepseek-v3.2:floor` (`uiGroup: "deepseek"`, `providerId: "deepseek"`, `isFree: false`, `128000`, `16384`, `category: "reasoning"`)
      9. `x-ai/grok-4.7` (`uiGroup: "grok"`, `providerId: "grok"`, `isFree: false`, `500000`, `category: "reasoning"`)
      10. `z-ai/glm-5.2` (`uiGroup: "glm"`, `providerId: "openrouter-pay"`, `isFree: false`, `1048576`, `65536`, `category: "reasoning"`)
      11. `openai/gpt-oss-120b` (`uiGroup: "groq"`, `providerId: "groq"`, `isFree: true`, `131072`, `8192`, `category: "reasoning"`)
      12. `strata-local` (`uiGroup: "local"`, `providerId: "local"`, `isFree: true`, `32768`, `16384`, `category: "local"`)
    - Cập nhật `API_ALLOWED` (chỉ giữ canonical IDs hiện hành + `gemini-3-pro-image`).
    - Cập nhật `MODEL_ALIASES` đầy đủ:
      - `gemini-3.8-flash`, `gemini-3-flash-preview`, `gemini-3-flash`, `gemini-2.5-pro`, `gemini-3.1-pro-preview`, `gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-pro-preview` → `"gemini-4-hydrogen"`
      - `gemini-4-argon`, `gemini-4-argon-preview` → `"gemini-4-neon"`
      - `claude-haiku-4.5` → `"claude-haiku-5-5"`
      - `claude-sonnet-4.5` → `"claude-sonnet-5-5"`
      - `deepseek-v4-flash`, `deepseek-chat`, `deepseek-reasoner` → `"deepseek/deepseek-v4.1-flash"`
      - `x-ai/grok-4.3` → `"x-ai/grok-4.7"`
      - `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `llama3-70b-8192`, `llama3-8b-8192`, `llama-3.1-70b-versatile`, `llama-3.1-70b-specdec` → `"openai/gpt-oss-120b"`
    - Thêm `isGroqModel()`, `isClaude55Model()`; cập nhật `modelSupportsClaudeThinking()` hỗ trợ `claude-haiku-5`; cập nhật `clampGeminiThinkingLevel()` với directional clamping; gỡ bỏ `isDeepSeekDirectModel()` hoặc chỉ giữ `isDeepSeekV4ProModel` / `isDeepSeekV41FlashModel` (xác minh không còn caller nào của `isDeepSeekDirectModel`).
- [ ] **Bước 2 — Streaming, Routing & Thinking Pipeline**:
  - Xóa `src/lib/core/deepseekClient.ts`.
  - Cập nhật `src/app/api/chat-stream/validators.ts` và `src/app/api/chat-stream/streaming/types.ts` thêm `"xhigh"` vào `ThinkingLevel`.
  - Cập nhật `src/app/api/chat-stream/chatStreamCore.ts`: thay `isStandardGroq` bằng `isGroqModel(model)`, đặt `isOpenRouter = !isGroq && (model.includes("/") || model.includes(":free"))`, gỡ `getDeepSeekClient`/`isDeepSeekDirectModel`, đổi fallback `CLAUDE_HAIKU_45` → `CLAUDE_HAIKU_55`.
  - Cập nhật `src/app/api/chat-stream/streaming/anthropic-stream.ts`: hỗ trợ Adaptive Thinking (`thinking: { type: "adaptive" }`, không gửi `budget_tokens`) cho Claude 5.5 (`isClaude55Model(model)`), mở rộng `thinkingLevel` thêm `"xhigh"`.
  - Cập nhật `src/app/api/chat-stream/streaming/gemini-stream.ts` & `utils.ts`: mở rộng `thinkingLevel` thêm `"xhigh"`, cập nhật `isDeepThinking` (`"high" || "xhigh"`), cập nhật `isGemini3Model()` nhận `gemini-4-*`, cập nhật message lỗi 403 Gemini 4 không hardcode `"Gemini 4 Argon"`.
  - Cập nhật `src/app/api/chat-stream/streaming/deepseek-stream.ts`, `deepseek-request-builder.ts`, `strata-stream.ts`, và `src/lib/features/local-llm/strataThinking.ts` để chấp nhận `"xhigh"` an toàn (clamp `"xhigh"` → `"high"`).
  - Cập nhật `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`: gỡ `getDeepSeekClient`/`isDeepSeekDirectModel`, đổi fallback `CLAUDE_HAIKU_45` → `CLAUDE_HAIKU_55`, thêm `xhigh` vào `GEMINI_SDK_THINKING_LEVEL_MAP`.
- [ ] **Bước 3 — Model Picker Logic, Thinking UI & Bilingual Translations**:
  - Cập nhật `src/lib/core/modelPicker.ts`: chuyển `ModelPickerSection["id"]` sang `"recent" | ModelUiGroup`, sắp xếp theo `UI_GROUP_ORDER`, sửa filter `free` theo `model.isFree === true`, thêm `formatContextWindow()`, cập nhật `resolveChatModelDisplay()` dùng `UI_GROUP_LABELS`.
  - Cập nhật `src/app/features/chat/components/ModelPickerList.tsx`: hiển thị badge `Miễn phí`/`Trả phí` + thông số Context (`1M ngữ cảnh` / `1M context`), đổi mô tả dòng 2 sang `line-clamp-2`, tuân thủ Vikini 3.0 semantic tokens & `text-xs` minimum.
  - Cập nhật `src/app/features/chat/components/hooks/useThinkingLevel.ts` & `thinkingOptions.ts`: thêm `"xhigh"` vào `ThinkingLevel`, `LEVEL_ORDER`, `localStorage` whitelist, `LABEL_KEYS`; `isClaudeThinkingModel` gọi SSOT `modelSupportsClaudeThinking`; clamp `"xhigh"` an toàn cho từng họ model.
  - Cập nhật `src/lib/utils/translations/vi.ts` và `en.ts`:
    - Thêm `modelBadgeFree` (`"Miễn phí"` / `"Free"`), `modelBadgePaid` (`"Trả phí"` / `"Paid"`), `modelContextSuffix` (`"ngữ cảnh"` / `"context"`), `thinkingLevelXHigh` (`"Cực sâu"` / `"Extra Deep"`).
    - Thêm key tên model `"gemini-4-hydrogen"`, `"gemini-4-neon"`.
    - Viết lại toàn bộ 12 `modelDesc*` theo công thức `[Dùng để làm gì] · [Ưu điểm / hiệu quả]` (KHÔNG giá USD, KHÔNG `$ / $$ / $$$`, KHÔNG lặp tên model).
    - Xóa các key mô tả cũ không còn dùng (`modelDescFlash38`, `modelDescFlash3`, `modelDescArgon4`, `modelDescGrok43`, `modelDescLlama33_70b`, `modelDescLlama31_8b`, `modelDescDeepSeekV4Flash`, `modelDescDeepSeekV3`, `modelDescDeepSeekR1`).
- [ ] **Bước 4 — Co-Located Tests & Living Docs**:
  - Cập nhật toàn bộ 12 file test co-located liệt kê ở Mục 5 theo Test Contract (Mục 8).
  - Cập nhật `docs/models.md` và `docs/CHANGELOG.md`.
- [ ] **Bước 5 — Verification & Visual QA**:
  - Chạy `npm run type-check; npm run lint; npm run test:run`.
  - Thực hiện Visual QA Gate bằng Playwright (`1440×900` Desktop & `375×812` Mobile × Dark/Light) trên Model Picker và Thinking Level Selector, gọi `read_file` soi từng ảnh `.png`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Mọi test case dưới đây là tiêu chí Pass/Fail bắt buộc để `@qa` đối soát:

1. **TC-MC-01 (Registry Catalog & Ordering)**:
   - `DEFAULT_MODEL === "gemini-3.5-flash-lite"` và `SELECTABLE_MODELS[0].id === "gemini-3.5-flash-lite"`.
   - `SELECTABLE_MODELS` có đúng 12 model mới; KHÔNG chứa bất kỳ ID đã bỏ nào (`gemini-3.8-flash`, `gemini-3-flash-preview`, `gemini-4-argon`, `claude-haiku-4.5`, `claude-sonnet-4.5`, `deepseek-v4-flash`, `x-ai/grok-4.3`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`).
   - Mọi entry đều có `uiGroup` hợp lệ trong `UI_GROUP_ORDER`, `isFree: boolean`, và `descKey` tồn tại đồng thời ở cả `vi` và `en`.
   - Chỉ đúng 2 model có `isFree === true`: `openai/gpt-oss-120b` và `strata-local`.
2. **TC-MC-02 (Legacy Alias Mapping & Invariant)**:
   - `normalizeModelForApi` & `coerceStoredModel` map chính xác:
     - `gemini-3.8-flash`, `gemini-3-flash-preview`, `gemini-3-flash`, `gemini-2.5-pro`, `gemini-3.1-pro-preview` → `gemini-4-hydrogen`
     - `gemini-4-argon`, `gemini-4-argon-preview` → `gemini-4-neon`
     - `claude-haiku-4.5` → `claude-haiku-5-5`; `claude-sonnet-4.5` → `claude-sonnet-5-5`
     - `deepseek-v4-flash`, `deepseek-chat`, `deepseek-reasoner` → `deepseek/deepseek-v4.1-flash`
     - `x-ai/grok-4.3` → `x-ai/grok-4.7`
     - `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `llama3-70b-8192` → `openai/gpt-oss-120b`
   - Mọi target trong `Object.values(MODEL_ALIASES)` đều phải tự ổn định (`normalizeModelForApi(target) === target`, không alias dây chuyền gãy).
   - **Negative Probe (Prototype Pollution)**: `constructor`, `__proto__`, `toString` trả về `DEFAULT_MODEL`.
3. **TC-MC-03 (Gemini 4 `xhigh` & Directional Clamping)**:
   - `getSupportedGeminiThinkingLevels("gemini-4-hydrogen")` và `getSupportedGeminiThinkingLevels("gemini-4-neon")` đều trả `["low", "medium", "high", "xhigh"]`.
   - `clampGeminiThinkingLevel("gemini-4-neon", "xhigh") === "xhigh"`; `clampGeminiThinkingLevel("gemini-4-neon", "off") === "low"`; `clampGeminiThinkingLevel("gemini-4-neon", "minimal") === "low"`.
   - `clampGeminiThinkingLevel("gemini-3.5-flash-lite", "xhigh") === "high"` (kẹp về bậc cao nhất thay vì `"minimal"`).
   - `chatStreamRequestSchema.safeParse({ content: "hi", thinkingLevel: "xhigh" }).success === true`.
   - `getEffectiveThinkingLevel("strata-local", "xhigh") === "high"` và `resolveStrataThinkingPlan("xhigh").level === "high"`.
4. **TC-MC-04 (Claude 5.5 Adaptive Thinking — Negative Probe chống 400)**:
   - `modelSupportsClaudeThinking("claude-sonnet-5-5") === true` và `modelSupportsClaudeThinking("claude-haiku-5-5") === true`.
   - Khi `createAnthropicStream` gọi với `model: "claude-sonnet-5-5"` hoặc `"claude-haiku-5-5"` và `thinkingLevel: "high"`, payload gửi `ai.beta.messages.create` BẮT BUỘC có `thinking: { type: "adaptive" }`, `temperature: 1`, và **TUYỆT ĐỐI KHÔNG** có thuộc tính `budget_tokens` (`expect(callArg.thinking).not.toHaveProperty("budget_tokens")`).
   - Khi `thinkingLevel: "off"`, payload KHÔNG có `thinking` và có `temperature: 0.7`.
5. **TC-MC-05 (Groq Routing Fix — Negative Probe chống route nhầm OpenRouter)**:
   - `isGroqModel("openai/gpt-oss-120b") === true`, `isGroqModel("llama-3.3-70b-versatile") === true` (qua alias), `isGroqModel("x-ai/grok-4.7") === false`, `isGroqModel("deepseek/deepseek-v4.1-flash") === false`.
   - Trong `handleChatStreamCore`, khi conversation dùng `model: "openai/gpt-oss-120b"`, hệ thống BẮT BUỘC gọi `getGroqClient()` và **TUYỆT ĐỐI KHÔNG** gọi `getOpenRouterClient()` hay `getGenAIClient()`.
   - Trong `runNovelcrafterStream`, khi `request.model: "openai/gpt-oss-120b"`, hệ thống gọi `getGroqClient()` và KHÔNG gọi `getOpenRouterClient()`.
6. **TC-MC-06 (Model Picker Grouping, Free Filter, Context & No-Price Invariant)**:
   - `buildModelPickerSections` trả về các section đúng thứ tự `["gemini", "anthropic", "deepseek", "grok", "glm", "groq", "local"]` (bỏ `local` khi `isLocalVisible: false`).
   - Nhóm `deepseek` chứa đủ cả 3 model (`deepseek/deepseek-v4.1-flash`, `deepseek/deepseek-v4-pro`, `deepseek/deepseek-v3.2:floor`); KHÔNG còn section `openrouter-pay` hay `openrouter-free`.
   - `filter: "free"` trả về `["openai/gpt-oss-120b"]` khi `isLocalVisible: false` và `["openai/gpt-oss-120b", "strata-local"]` khi `isLocalVisible: true`.
   - `formatContextWindow`: `1048576 → "1M"`, `1000000 → "1M"`, `500000 → "500K"`, `131072 → "131K"`, `128000 → "128K"`, `32768 → "32K"`.
   - **Negative Probe (No USD / Dollar Sign in Descriptions)**: Mọi `vi[m.descKey]` và `en[m.descKey]` của tất cả `SELECTABLE_MODELS` KHÔNG chứa `$` hoặc `USD`.
   - `ModelPickerList` render badge `Miễn phí` / `Trả phí`, context `1M ngữ cảnh` / `131K ngữ cảnh`, và mô tả có class `line-clamp-2`.

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Co-Located Unit Tests

- `src/lib/core/modelRegistry.test.ts` — TC-MC-01, TC-MC-02, TC-MC-03, TC-MC-05 (`isGroqModel`, `isClaude55Model`, `modelSupportsClaudeThinking`), kiểm tra xóa key mô tả cũ & no-USD invariant.
- `src/lib/core/modelPicker.test.ts` — TC-MC-06 (`UI_GROUP_ORDER`, `deepseek` 3 models, `filter: "free"`, `formatContextWindow`, `resolveChatModelDisplay`).
- `src/lib/core/modelAccess.test.ts` — kiểm tra allowlist 2 chiều với alias mới (`gemini-4-argon` ↔ `gemini-4-neon`, `claude-sonnet-4.5` ↔ `claude-sonnet-5-5`, không leo thang đặc quyền `gemini-2.5-flash` → `gemini-4-hydrogen`).
- `src/app/api/chat-stream/chatStreamCore.test.ts` — TC-MC-05 (Groq routing cho `openai/gpt-oss-120b`, Claude 5.5 Direct Anthropic, DeepSeek V4.1 Flash via OpenRouter).
- `src/app/api/chat-stream/streaming/anthropic-stream.test.ts` — TC-MC-04 (Adaptive Thinking cho `claude-sonnet-5-5` & `claude-haiku-5-5`, Negative Probe không có `budget_tokens`).
- `src/app/api/chat-stream/streaming/gemini-stream.test.ts` — `gemini-4-hydrogen`, `gemini-4-neon`, `xhigh`, `MODEL_TIER_RESTRICTED`, timeout 900000ms.
- `src/app/api/chat-stream/streaming/openai-stream.test.ts` — `x-ai/grok-4.7`, `openai/gpt-oss-120b`, `anthropic/claude-haiku-5.5`, `z-ai/glm-5.2`.
- `src/app/api/chat-stream/streaming/deepseek-request-builder.test.ts` — `xhigh` mapping cho `deepseek/deepseek-v4.1-flash` và `deepseek/deepseek-v4-pro`.
- `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts` — `gemini-4-neon`, `gemini-4-hydrogen`, `claude-sonnet-5-5` (Direct & OpenRouter fallback), `openai/gpt-oss-120b` (Groq client).
- `src/app/features/chat/components/hooks/useThinkingLevel.test.ts` — `xhigh`, `claude-haiku-5-5`, `gemini-4-hydrogen`/`neon`, `strata-local` clamp `xhigh → high`.
- `src/app/features/chat/components/ModelPickerList.test.tsx` — TC-MC-06 (UI groups, Free/Paid badge, context display, `line-clamp-2`, filter `Miễn phí`).
- `src/lib/core/contextCache.test.ts` — cập nhật fixture `gemini-4-neon` / `gemini-4-hydrogen` / `gemini-3.5-flash-lite`.

#### Verification Commands (Windows PowerShell 5.1 — dùng `;`)

1. **Plan Lint Gate**:
   ```powershell
   node scripts/verify-plan.mjs docs/plans/2026-11-21-model-catalog-redesign-plan.md
   ```
2. **Type-Check, Lint & Full Unit Tests**:
   ```powershell
   npm run type-check; npm run lint; npm run test:run
   ```
3. **Wiring & Negative Probes (Scoped)**:
   ```powershell
   npx vitest run src/lib/core/modelRegistry.test.ts src/lib/core/modelPicker.test.ts src/lib/core/modelAccess.test.ts src/app/api/chat-stream/chatStreamCore.test.ts src/app/api/chat-stream/streaming/anthropic-stream.test.ts src/app/api/chat-stream/streaming/gemini-stream.test.ts src/app/features/chat/components/ModelPickerList.test.tsx src/app/features/chat/components/hooks/useThinkingLevel.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts --reporter=dot
   ```
4. **Visual QA Gate (Playwright — `.agents/rules/03-ui.md`)**:
   - Bật `next dev`, chụp `.png` Model Picker (mở Popover/Sheet, tab `Tất cả` & `Miễn phí`) và Thinking Level Selector (với `gemini-4-neon` hiển thị 4 mức gồm `Cực sâu`/`Extra Deep`) ở Desktop `1440×900` và Mobile `375×812` × Dark & Light.
   - Gọi `read_file` đọc trực tiếp từng ảnh `.png` để kiểm tra không tràn ngang (`scrollWidth <= innerWidth`), badge không đè chữ, `line-clamp-2` hiển thị rõ ràng, không raw translation key, độ tương phản đạt chuẩn.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                                                                                 | Mức độ         | Technical Control & Kiểm chứng                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openai/gpt-oss-120b` chứa dấu `/` bị route nhầm sang OpenRouter thay vì Groq                                                          | **Cao**        | Thêm `isGroqModel(model)` dựa trên `SELECTABLE_MODELS[].providerId === "groq"` (`src/lib/core/modelRegistry.ts`), ưu tiên kiểm tra trước `isOpenRouter` trong `src/app/api/chat-stream/chatStreamCore.ts:533-534`. Kiểm chứng bằng Negative Probe **TC-MC-05** (`chatStreamCore.test.ts` & `novelcrafterStreamRunner.server.test.ts`). |
| Gửi `budget_tokens` cho Claude 5.5 gây HTTP 400 Bad Request                                                                            | **Cao**        | Thêm `isClaude55Model(model)` và gửi `thinking: { type: "adaptive" }` không kèm `budget_tokens` trong `src/app/api/chat-stream/streaming/anthropic-stream.ts:248-253`. Kiểm chứng bằng Negative Probe **TC-MC-04** (`anthropic-stream.test.ts`).                                                                                       |
| User đang chọn `xhigh` trên Gemini 4 rồi chuyển sang Gemini 3.5 Flash-Lite / Strata Local / DeepSeek gây lỗi 400 hoặc tụt về `minimal` | **Trung bình** | Directional clamping trong `clampGeminiThinkingLevel()` (`xhigh → high`), `normalizeStrataThinkingLevel()` (`xhigh → high` tại `src/lib/features/local-llm/strataThinking.ts:165-170`), `mapDeepSeekEffort()` (`xhigh` → tương đương `high`), và `getEffectiveThinkingLevel()`. Kiểm chứng qua **TC-MC-03**.                           |
| User có `rank_configs.allowed_models` lưu ID cũ (`gemini-3.8-flash`, `claude-sonnet-4.5`, ...) bị khóa quyền sau nâng cấp              | **Trung bình** | Bảo toàn ánh xạ 2 chiều trong `MODEL_ALIASES` (`src/lib/core/modelRegistry.ts`), được `modelAccess.ts:45-68` và `limits.ts:370-373` tự động giải quyết. Kiểm chứng qua `modelAccess.test.ts` (**TC-MC-02**).                                                                                                                           |
| Xóa `src/lib/core/deepseekClient.ts` làm gãy import hoặc test mock ẩn                                                                  | **Trung bình** | Gỡ toàn bộ import/mock tại `chatStreamCore.ts:11`, `novelcrafterStreamRunner.server.ts:8`, `chatStreamCore.test.ts:40` trước khi xóa file; kiểm chứng bằng `npm run type-check; npm run test:run`.                                                                                                                                     |
| UI Model Picker bị chật / tràn ngang trên Mobile `375px` khi thêm badge `Miễn phí`/`Trả phí` + `1M ngữ cảnh`                           | **Trung bình** | Dùng `flex-wrap items-center gap-x-1.5 gap-y-0.5` cho dòng meta, tối thiểu `text-xs` (không sub-12px), semantic tokens `bg-(--soft)`/`border-(--line)`, và kiểm chứng bằng Visual QA Gate Playwright `375×812` + `1440×900` × Dark/Light.                                                                                              |

---

## Audit History

<!-- Reviewer sẽ nối các lượt Audit Run tại đây -->
