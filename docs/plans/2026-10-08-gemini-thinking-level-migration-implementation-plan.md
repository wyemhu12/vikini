# Kế Hoạch Triển Khai: Chuyển Đổi thinking_budget Sang thinking_level Và Loại Bỏ Sampling Parameters Cho Google Gemini API (v6 - Pure Derived State & Zero Destructive Persist Addressing Audit Run 5 Feedback)

**Ngày**: 2026-10-08  
**Tác giả**: @planner (Technical Planner)  
**Trạng thái**: Revised - Incorporating Audit Run 5 Feedback (Ready for Audit Run 6)  
**Môi trường thực thi**: Local Workspace (`wyemh/vikini`)  
**Mục tiêu**: Nâng cấp tương thích Google Gemini API 2026 — chuyển dịch sang `thinking_level` semantic tiers cho Gemini 3+, bảo toàn tương thích suy luận cho Gemini 2.5 qua `thinkingBudget: -1`, bảo đảm bất biến loại trừ lẫn nhau (Mutual Exclusion Invariant), thiết lập Single Source of Truth cho năng lực bậc suy luận đồng bộ giữa UI và Server, điều phối trạng thái dẫn xuất xuyên mô hình thuần túy khi render (pure derived state qua `getEffectiveThinkingLevel`, không persist phá hủy), kẹp (clamp) bậc suy luận tự động, và dọn dẹp chủ động các tham số lấy mẫu (`temperature`, `top_p`, `top_k`) cho Gemini API calls tuân thủ khuyến nghị kỹ thuật chính thức.

---

## Technical Plan

### 1. Mục Tiêu (Goal)

1. **Bảo đảm Bất Biến Loại Trừ Lẫn Nhau (Mutual Exclusion Invariant) giữa `thinking_level` và `thinking_budget`**:
   - Theo tài liệu chính thức của Google Gemini API (`https://ai.google.dev/gemini-api/docs/gemini-3`), `thinking_budget` vẫn được hỗ trợ cho mục đích tương thích ngược, nhưng Google khuyến nghị di chuyển sang `thinking_level`.
   - **Quy tắc bất biến cốt lõi**: Google API cấm tuyệt đối việc gửi đồng thời cả `thinking_level` và `thinking_budget` trong cùng một request config (_"You cannot use both `thinking_level` and the legacy `thinking_budget` parameter in the same request"_ — vi phạm sẽ ném lỗi `HTTP 400 Bad Request`).
   - Phân nhánh rành mạch theo dòng mô hình:
     - **Gemini 3+ series**: Gửi `thinkingConfig: { thinkingLevel, includeThoughts: true }`, **TUYỆT ĐỐI KHÔNG** gửi `thinkingBudget`.
     - **Gemini 2.5 series**: Gửi `thinkingConfig: { thinkingBudget: -1, includeThoughts: true }`, **TUYỆT ĐỐI KHÔNG** gửi `thinkingLevel`.
     - Khi `thinkingLevel === "off"` hoặc model không hỗ trợ suy luận: `thinkingConfig = undefined` (bỏ qua hoàn toàn, không gửi bất kỳ trường nào).
2. **Bảo toàn 100% Khả Năng Tương Thích Ngược Cho Mô Hình Mặc Định (`gemini-2.5-flash`)**:
   - `DEFAULT_MODEL` của Vikini hiện là `gemini-2.5-flash` (`src/lib/core/modelRegistry.ts:4`).
   - Gemini 2.5 không hỗ trợ `thinking_level` (sẽ ném lỗi _"Thinking level is not supported for this model"_ nếu nhận trường này) mà chỉ nhận `thinkingBudget` (với `-1` là dynamic).
   - Duy trì nguyên vẹn nhánh kích hoạt suy luận cho Gemini 2.5 (`thinkingBudget: -1`, `includeThoughts: true`) khi người dùng bật suy luận trên UI, triệt tiêu 100% rủi ro regression biến toggle suy luận thành no-op trên model mặc định.
3. **Thiết Lập Single Source of Truth Cho Bậc Suy Luận & Điều Phối Trạng Thái Dẫn Xuất Xuyên Mô Hình (Pure Derived State via getEffectiveThinkingLevel, Zero Destructive Persist)**:
   - Theo tài liệu Google (`https://ai.google.dev/gemini-api/docs/thinking`), các model Gemini 3 hỗ trợ các tập bậc suy luận khác nhau:
     - `gemini-3-flash-preview` và `gemini-3.1-flash-lite-preview`: Hỗ trợ đầy đủ 4 bậc (`minimal`, `low`, `medium`, `high`).
     - `gemini-3.1-pro-preview`: Hỗ trợ 3 bậc (`low`, `medium`, `high`) — **KHÔNG hỗ trợ `minimal`**.
   - Bổ sung trường dữ liệu `supportedThinkingLevels` vào `SELECTABLE_MODELS` trong `src/lib/core/modelRegistry.ts` làm Single Source of Truth duy nhất cho Gemini 3.
   - Hàm thuần `getSupportedGeminiThinkingLevels` đọc metadata từ `SELECTABLE_MODELS`, và `clampGeminiThinkingLevel` kẹp bậc về `supported[0]`.
   - **Điều phối trạng thái dẫn xuất thuần túy (`getEffectiveThinkingLevel`)**: Xây dựng hàm thuần `getEffectiveThinkingLevel(currentModel, requestedLevel)` trong `useThinkingLevel.ts` làm Single Source of Truth giải quyết bậc suy luận hiệu lực cho **toàn bộ các dòng mô hình** tại thời điểm render:
     - Gemini 3: gọi `clampGeminiThinkingLevel(currentModel, requestedLevel)`.
     - Claude: chỉ hỗ trợ `off` / `high` -> mọi level khác `"off"` (kể cả `"low"`, `"medium"`, `"minimal"`) đều quy về `"high"` (đồng bộ 100% với `anthropic-stream.ts:214`).
     - DeepSeek V4: hỗ trợ `off` / `low` / `high` -> `"minimal"`, `"low"`, `"medium"` quy về `"low"`, `"high"` quy về `"high"` (khớp 100% logic xử lý của `deepseek-request-builder.ts:35-75`).
     - Gemini 2.5: hỗ trợ `off` / `low` / `high` -> `"high"` giữ nguyên, `"minimal"`/`"low"`/`"medium"` quy về `"low"`.
     - Model không hỗ trợ suy luận: quy về `"off"`.
   - **Bảo toàn 100% Preference Người Dùng (Zero Destructive Persist)**: `effectiveLevel` thuần túy là giá trị dẫn xuất khi render (pure derived value at render time) phục vụ hiển thị trên `ThinkingLevelSelector` (nhãn và checkmark). Tuyệt đối **KHÔNG** dùng `useEffect` tự động ghi đè preference trong `localStorage` khi model thay đổi. Nhờ đó, preference `"medium"` hay `"high"` của người dùng không bao giờ bị xóa mất khi URL cold-start (chờ SWR tải conversation) hoặc khi tạm thời chuyển sang model không-thinking (Llama/Groq/Haiku). Server đã tự động clamp và xử lý đúng theo model thực tế của request.
4. **Dọn Dẹp Chủ Động Sampling Parameters (`temperature`, `top_p`, `top_k`) Tuân Thủ Khuyến Nghị Google**:
   - Google Gemini 3 documentation khuyến nghị: _"we strongly recommend keeping the temperature parameter at its default value of 1.0 … setting it below 1.0 may lead to unexpected behavior, such as looping"_.
   - Trong codebase Vikini, `autoTitleEngine.ts` đang gán `temperature: 0.3` và `fileProcessors.ts` đang gán `temperature: 0.2`. Giá trị `< 1.0` này đi ngược lại khuyến nghị của Google và tiềm ẩn rủi ro vòng lặp (looping).
   - Dọn dẹp chủ động (proactive cleanup): Xóa `temperature` khỏi `autoTitleEngine.ts`, `fileProcessors.ts`, và xóa `temperature?: number` khỏi kiểu `ChatStreamParams.ai.models.generateContentStream.config` trong `types.ts` để Google API dùng giá trị mặc định tối ưu (1.0).
   - Bảo toàn tuyệt đối tham số sampling của các nhà cung cấp khác: **Anthropic Claude** (`temperature: 1` khi thinking, `0.7` khi không thinking), **OpenAI/Groq/OpenRouter** (`temperature: 0.7`), **DeepSeek** (`temperature: 0.7`).
5. **Khắc Phục Lỗi Type Compile SDK & Chống Tràn Token Suy Luận Trong Auto-Title**:
   - SDK `@google/genai@2.10.0` định nghĩa `ThinkingConfig.thinkingLevel?: ThinkingLevel` là enum UPPERCASE (`ThinkingLevel.MINIMAL = "MINIMAL"`, `ThinkingLevel.LOW = "LOW"`, `ThinkingLevel.MEDIUM = "MEDIUM"`, `ThinkingLevel.HIGH = "HIGH"`).
   - Sử dụng chuẩn xác `import { ThinkingLevel } from "@google/genai";` và gán `thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }` cho `PRIMARY_MODEL` (`gemini-3-flash-preview`) trong `autoTitleEngine.ts`. Vừa vượt qua 100% kiểm tra kiểu `npm run type-check`, vừa ép suy luận tối thiểu để bảo vệ ngân sách `maxOutputTokens: 15/20` không bị chiếm chỗ.
   - Đối với cuộc gọi fallback (`gemini-2.5-flash`), không gửi `thinkingConfig`.
6. **Bổ Sung `abortSignal` Cho Cuộc Gọi Tiếp Nối (Continuation Call)**:
   - Trong `gemini-stream.ts:419-431`, bổ sung `abortSignal: params.abortSignal` vào config continuation call để bảo đảm dọn dẹp tài nguyên và ngắt kết nối lập tức khi client bấm Stop.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ nghiêm ngặt bảng Pre-Work Protocol tại `.agents/rules/02-quality.md`:

| Tài liệu / Quy chuẩn             | Đường dẫn                                        | Trọng tâm kiểm tra                                                                                                                                                                   |
| :------------------------------- | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Gemini 3 Docs (2026)**  | `https://ai.google.dev/gemini-api/docs/gemini-3` | Khuyến nghị di chuyển sang `thinking_level`, cấm gửi cả hai tham số trong cùng request, khuyến nghị giữ `temperature: 1.0` tránh looping.                                            |
| **Google Thinking Mode Guide**   | `https://ai.google.dev/gemini-api/docs/thinking` | Ma trận hỗ trợ `thinking_level` theo từng model: Flash (minimal/low/medium/high) vs Pro (low/medium/high). Ràng buộc `max_output_tokens` áp dụng cho cả thinking và response tokens. |
| **Streaming Patterns Skill**     | `.agents/skills/streaming-patterns.md`           | Chuẩn SSE frames (`token`, `meta`, `thinking`, `done`, `error`), AbortSignal handling, thinking/text separation state machine.                                                       |
| **Model Registry Documentation** | `docs/models.md`                                 | Danh mục Gemini models (Gemini 2.5 Flash, Gemini 3 Flash, Gemini 3.1 Pro), token limits, thinking capabilities.                                                                      |
| **API Patterns Skill**           | `.agents/skills/api-patterns.md`                 | Chuẩn Validate → Execute → Respond, Zod validation schema, sanitization lỗi.                                                                                                         |
| **Bilingual Standard**           | `.agents/rules/04-bilingual.md`                  | Chuẩn song ngữ Anh - Việt trong `translations/en.ts` và `translations/vi.ts`.                                                                                                        |
| **Coding & Quality Rules**       | `.agents/rules/01-coding.md`, `02-quality.md`    | Cấm `any`, strict null checks, co-located tests trong `lib/` và `app/api/`, Verification Tier 2 (`npm run verify`).                                                                  |
| **Plan Review Rules**            | `.agents/rules/05-plan-review.md`                | Code freeze đến khi nhận thẻ `[PLAN_APPROVED]`, 6 kịch bản đối kháng S1–S6, Rubric phân loại lỗi.                                                                                    |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1. Các Giả Định Kỹ Thuật (Assumptions)

1. **Bất Biến Loại Trừ Lẫn Nhau (Mutual Exclusion Invariant)**: Trong mọi request gửi tới Google Gemini API, đối tượng `thinkingConfig` chỉ được phép chứa **HOẶC `thinkingLevel`** (cho Gemini 3+), **HOẶC `thinkingBudget`** (cho Gemini 2.5), tuyệt đối không bao giờ chứa đồng thời cả hai trường.
2. **Năng Lực Bậc Suy Luận Của Từng Dòng Mô Hình**:
   - `gemini-3-flash-preview` & `gemini-3.1-flash-lite-preview`: Hỗ trợ `"minimal"`, `"low"`, `"medium"`, `"high"`.
   - `gemini-3.1-pro-preview`: Hỗ trợ `"low"`, `"medium"`, `"high"` (không hỗ trợ `"minimal"`).
   - `gemini-2.5-flash` & `gemini-2.5-pro`: Không hỗ trợ `thinkingLevel`; kích hoạt suy luận qua `thinkingBudget: -1`.
3. **Chính Sách Kẹp Bậc (Clamping Policy)**: Nếu giá trị `thinkingLevel` yêu cầu không nằm trong danh sách hỗ trợ của model hiện tại, hệ thống sẽ tự động kẹp về bậc hợp lệ thấp nhất được hỗ trợ (`supported[0]`). Ví dụ: `"minimal"` -> kẹp về `"low"` trên Gemini 3.1 Pro.
4. **Đồng Bộ Giao Diện & Bảo Toàn Preference Người Dùng (Pure Derived UI State)**: `getEffectiveThinkingLevel` giải quyết bậc suy luận hiệu lực tại thời điểm render cho mọi model (Gemini 3, Gemini 2.5, Claude, DeepSeek). Giao diện `ThinkingLevelSelector.tsx` hiển thị đúng nhãn và checkmark tương ứng model hiện tại, trong khi `localStorage` bảo toàn nguyên vẹn preference đã chọn của người dùng (không bị effect ghi đè phá hủy).
5. **SDK Enum Types**: SDK `@google/genai@2.10.0` yêu cầu `ThinkingLevel` enum UPPERCASE khi gọi `GoogleGenAI` trực tiếp trong `autoTitleEngine.ts`. Đối với REST API / streaming wrapper `gemini-stream.ts`, literal union lowercase `GeminiThinkingLevel` được dùng đồng bộ với Zod validation.
6. **Dọn Dẹp Sampling Độc Lập Với Các Provider Khác**: Codebase Vikini đã phân tách streaming routes thành các module độc lập: `gemini-stream.ts`, `anthropic-stream.ts`, `openai-stream.ts`, `deepseek-stream.ts`. Việc loại bỏ `temperature` cho Gemini tuyệt đối không gây ảnh hưởng tới Anthropic Claude (`temperature: 1` bắt buộc khi thinking), OpenAI/Groq (`temperature: 0.7`), hay DeepSeek.
7. **No Database Migration Required**: Thay đổi này thuần túy thuộc về tầng API request payload và client configuration, không làm thay đổi cấu trúc bảng Supabase (`messages`, `conversations`).

#### 3.2. Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies)

- `modelRegistry.ts`: Khai báo metadata `supportedThinkingLevels`, hàm tiện ích `getSupportedGeminiThinkingLevels` và `clampGeminiThinkingLevel`.
- `useThinkingLevel.ts`: Cung cấp hàm thuần `getAvailableThinkingLevels`, `getEffectiveThinkingLevel`, và quản lý preference của người dùng (chỉ cập nhật localStorage khi người dùng chủ động chọn).
- `ThinkingLevelSelector.tsx`: Tiêu thụ `getSupportedGeminiThinkingLevels` để dựng dropdown options, dùng `getEffectiveThinkingLevel` hiển thị `effectiveLevel` và đồng bộ checkmark.
- `useChatStreamController.ts`: Đọc `localStorage.getItem("vikini.thinkingLevel")` và gửi lên API chat stream.
- `/api/chat-stream/validators.ts`: Xác thực `thinkingLevel` qua Zod enum `["off", "low", "medium", "high", "minimal"]`.
- `chatStreamCore.ts`: Chuyển tiếp `thinkingLevel` vào `createGeminiStream`.
- `gemini-stream.ts`: Nhận `thinkingLevel`, tính `clampedLevel`, phân nhánh theo Gemini 3+ / Gemini 2.5, tính timeout theo `clampedLevel`, và đính kèm `abortSignal` cho cả initial call lẫn continuation call.

---

### 4. Bảng Verified Versions (Tra Cứu Thực Tế 2026)

Tra cứu trực tiếp từ `package.json` và tài liệu chính thức năm 2026:

| Gói / Framework           | Phiên bản thực tế | Trạng thái tương thích & Ghi chú kỹ thuật 2026                                                                                                                                                                                                                                              | Dẫn chứng                                                                                                                  |
| :------------------------ | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------- |
| **`@google/genai`**       | `^2.10.0`         | `ThinkingConfig` hỗ trợ `thinkingLevel?: ThinkingLevel` (enum `MINIMAL`, `LOW`, `MEDIUM`, `HIGH`) và `thinkingBudget?: number` (backward compat). `temperature?: number` vẫn là trường hợp lệ trong type SDK. Lý do bỏ `temperature` là tuân thủ Google advisory (tránh looping khi < 1.0). | `[SRC]` `node_modules/@google/genai/dist/genai.d.ts:12171-12215`<br>`[URL]` https://ai.google.dev/gemini-api/docs/gemini-3 |
| **`@anthropic-ai/sdk`**   | `^0.71.2`         | Bắt buộc `temperature = 1` khi bật extended thinking (`budget_tokens`), `temperature = 0.7` khi tắt. Không bị ảnh hưởng bởi thay đổi của Gemini.                                                                                                                                            | `[SRC]` `src/app/api/chat-stream/streaming/anthropic-stream.ts:235-241`                                                    |
| **`openai`**              | `^6.15.0`         | Quản lý kết nối OpenAI-compatible (Groq, OpenRouter). Duy trì `temperature = 0.7`.                                                                                                                                                                                                          | `[SRC]` `src/app/api/chat-stream/streaming/openai-stream.ts:230`                                                           |
| **`next`**                | `^16.1.1`         | Next.js App Router, Route Handlers chuẩn Web Streams API, AbortSignal handling.                                                                                                                                                                                                             | `[SRC]` `package.json:34`                                                                                                  |
| **`react` / `react-dom`** | `^19.2.3`         | React 19 Client Components, hooks `useState`, `useCallback`, `useEffect`.                                                                                                                                                                                                                   | `[SRC]` `package.json:40-41`                                                                                               |
| **`typescript`**          | `^5.9.3`          | TypeScript strict mode, cấm `any`, strict null checks.                                                                                                                                                                                                                                      | `[SRC]` `package.json:67`                                                                                                  |
| **`vitest`**              | `^4.0.16`         | Framework kiểm thử co-located unit test. 89 files / 975 tests hiện đang pass sạch.                                                                                                                                                                                                          | `[CMD]` `npx vitest run` (Exit Code 0)                                                                                     |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

```
[MODIFY] src/lib/core/modelRegistry.ts
[MODIFY] src/app/features/chat/components/hooks/useThinkingLevel.ts
[MODIFY] src/app/features/chat/components/hooks/useThinkingLevel.test.ts
[MODIFY] src/app/features/chat/components/ThinkingLevelSelector.tsx
[MODIFY] src/app/api/chat-stream/streaming/types.ts
[MODIFY] src/app/api/chat-stream/streaming/gemini-stream.ts
[MODIFY] src/lib/core/autoTitleEngine.ts
[MODIFY] src/lib/features/files/fileProcessors.ts
[MODIFY] src/app/api/chat-stream/streaming/gemini-stream.test.ts
[NEW]    src/lib/core/modelRegistry.test.ts
[NEW]    src/lib/core/autoTitleEngine.test.ts
[NEW]    src/lib/features/files/fileProcessors.test.ts
[MODIFY] docs/models.md
[MODIFY] docs/CHANGELOG.md
```

---

### 6. Các Bước Thực Hiện Tuần Tự

#### Bước 1: Cập Nhật `src/lib/core/modelRegistry.ts` [MODIFY]

- **Mục tiêu**: Bổ sung kiểu dữ liệu `GeminiThinkingLevel`, metadata danh sách bậc suy luận cho từng mô hình trong `SELECTABLE_MODELS`, và các hàm tiện ích Single Source of Truth cho việc lấy danh sách và kẹp bậc suy luận.
- **Chi tiết thay đổi**:
  - Khai báo kiểu dữ liệu bậc suy luận Gemini:
    ```typescript
    export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";
    ```
  - Thêm thuộc tính tùy chọn `supportedThinkingLevels?: readonly GeminiThinkingLevel[];` vào `interface SelectableModel`.
  - Cập nhật danh sách `SELECTABLE_MODELS`:
    - `gemini-3-flash-preview`: `supportedThinkingLevels: ["minimal", "low", "medium", "high"]`
    - `gemini-3.1-pro-preview`: `supportedThinkingLevels: ["low", "medium", "high"]`
    - `gemini-3.1-flash-lite-preview`: `supportedThinkingLevels: ["minimal", "low", "medium", "high"]`
    - Các mô hình Gemini 2.5 không khai báo trường này (mặc định undefined).
  - Thêm hàm `getSupportedGeminiThinkingLevels` đọc metadata từ `SELECTABLE_MODELS`:
    ```typescript
    export function getSupportedGeminiThinkingLevels(
      modelId: unknown
    ): readonly GeminiThinkingLevel[] {
      const normalized = normalizeModelForApi(modelId);
      const found = SELECTABLE_MODELS.find((m) => m.id === normalized);
      if (found?.supportedThinkingLevels) {
        return found.supportedThinkingLevels;
      }
      // Fallback cho các mô hình Gemini 3 có trong API_ALLOWED nhưng không nằm trong SELECTABLE_MODELS (ví dụ: gemini-3-pro-image)
      if (normalized.startsWith("gemini-3")) {
        if (normalized.includes("flash")) {
          return ["minimal", "low", "medium", "high"];
        }
        return ["low", "medium", "high"];
      }
      return [];
    }
    ```
  - Thêm hàm `clampGeminiThinkingLevel`:
    ```typescript
    export function clampGeminiThinkingLevel(
      modelId: unknown,
      requestedLevel: string
    ): GeminiThinkingLevel {
      const supported = getSupportedGeminiThinkingLevels(modelId);
      if (supported.length === 0) return "low";
      if (supported.includes(requestedLevel as GeminiThinkingLevel)) {
        return requestedLevel as GeminiThinkingLevel;
      }
      // Chính sách kẹp: kẹp về bậc hợp lệ thấp nhất được hỗ trợ (phần tử đầu tiên)
      return supported[0];
    }
    ```

#### Bước 2: Cập Nhật `src/app/features/chat/components/hooks/useThinkingLevel.ts` [MODIFY]

- **Mục tiêu**: Trích xuất các hàm thuần `getAvailableThinkingLevels` và `getEffectiveThinkingLevel` làm Single Source of Truth cho danh sách bậc và bậc suy luận hiệu lực dẫn xuất xuyên mô hình khi render, bảo toàn nguyên vẹn preference của người dùng (Zero Destructive Persist).
- **Chi tiết thay đổi**:
  - Import `getSupportedGeminiThinkingLevels` và `clampGeminiThinkingLevel` từ `@/lib/core/modelRegistry`.
  - Export hàm thuần `getAvailableThinkingLevels`:
    ```typescript
    export function getAvailableThinkingLevels(currentModel: string): ThinkingLevel[] {
      if (isClaudeThinkingModel(currentModel)) return ["off", "high"];
      if (isDeepSeekV4Model(currentModel)) return ["off", "low", "high"];
      if (isGemini25Model(currentModel)) return ["off", "low", "high"];
      const geminiSupported = getSupportedGeminiThinkingLevels(currentModel);
      if (geminiSupported.length > 0) {
        return ["off", ...geminiSupported];
      }
      return ["off", "low", "high"];
    }
    ```
  - Export hàm thuần `getEffectiveThinkingLevel` (Single Source of Truth cho bậc hiệu lực dẫn xuất khi render):

    ```typescript
    export function getEffectiveThinkingLevel(
      currentModel: string,
      requestedLevel: ThinkingLevel
    ): ThinkingLevel {
      if (requestedLevel === "off" || !modelSupportsThinkingUI(currentModel)) {
        return "off";
      }

      if (isClaudeThinkingModel(currentModel)) {
        // Claude chỉ hỗ trợ off/high; mọi level khác "off" kích hoạt thinking high
        return "high";
      }

      if (isDeepSeekV4Model(currentModel)) {
        // DeepSeek V4: minimal/low/medium -> low, high -> high (khớp 100% deepseek-request-builder.ts:35-75)
        if (requestedLevel === "high") {
          return "high";
        }
        return "low";
      }

      if (isGemini25Model(currentModel)) {
        // Gemini 2.5 toggle dynamic thinking qua thinkingBudget: -1
        if (requestedLevel === "high") {
          return "high";
        }
        return "low";
      }

      if (isGemini3Model(currentModel)) {
        // Gemini 3: kẹp bậc trực tiếp theo năng lực model
        return clampGeminiThinkingLevel(currentModel, requestedLevel);
      }

      return "off";
    }
    ```

  - Trong hook `useThinkingLevel`:
    - Tính `availableLevels = getAvailableThinkingLevels(currentModel);`
    - Cập nhật `hasExtendedLevels: getSupportedGeminiThinkingLevels(currentModel).includes("minimal"),` (dọn dẹp logic hardcode cũ).
    - **BẢO TOÀN NGUYÊN VẸN TRẠNG THÁI (BỎ HOÀN TOÀN `useEffect` AUTO-PERSIST)**:
      - Không sử dụng `useEffect` tự động ghi đè `localStorage` khi `currentModel` thay đổi.
      - Preference của người dùng trong `localStorage` chỉ được cập nhật khi người dùng chủ động thao tác chọn trên UI thông qua `setThinkingLevel`.
      - `effectiveLevel` được dẫn xuất thuần túy khi render (pure derived state) bởi `ThinkingLevelSelector` để hiển thị nhãn và checkmark khớp với năng lực mô hình hiện tại, và được `ChatApp.tsx:413` sử dụng cho logic hạ cấp `getLowerThinkingLevel`.
      - Phía server đã tự động clamp và map theo model thực tế của request (`gemini-stream.ts` clamp server-side, `anthropic-stream.ts` và `gemini-2.5` coi mọi level ≠ `"off"` là bật thinking, `deepseek-request-builder.ts` coi `medium` = `low`).
      - Triệt tiêu 100% nguy cơ mất preference `"medium"`/`"high"` khi URL cold-start (chờ SWR tải conversation) hoặc khi tạm thời chuyển sang model không hỗ trợ suy luận (Llama/Groq/Haiku), đồng thời loại bỏ hoàn toàn khối `catch {}` rỗng vi phạm rule ESLint `no-empty`.

#### Bước 3: Cập Nhật `src/app/features/chat/components/ThinkingLevelSelector.tsx` [MODIFY]

- **Mục tiêu**: Loại bỏ logic hardcode `isGemini3FlashModel`, sử dụng `getSupportedGeminiThinkingLevels` để dựng dropdown options, hiển thị `effectiveLevel` qua `getEffectiveThinkingLevel`, và đồng bộ checkmark với `effectiveLevel`.
- **Chi tiết thay đổi**:
  - Dọn dẹp `interface ThinkingOption`: bỏ trường dead code `flashOnly?: boolean;`.
  - Cập nhật import:
    ```typescript
    import { getSupportedGeminiThinkingLevels } from "@/lib/core/modelRegistry";
    import {
      type ThinkingLevel,
      isGemini3Model,
      isDeepSeekV4Model,
      isClaudeThinkingModel,
      getEffectiveThinkingLevel,
    } from "./hooks/useThinkingLevel";
    ```
    _(Bỏ import `isGemini3FlashModel` vì không còn sử dụng, loại bỏ hoàn toàn cảnh báo `@typescript-eslint/no-unused-vars`)._
  - Khai báo các biến kiểm tra model và xây dựng `options`:

    ```typescript
    const isDeepSeek = isDeepSeekV4Model(currentModel);
    const isClaudeModel = isClaudeThinkingModel(currentModel);
    const isGemini3 = isGemini3Model(currentModel);
    const geminiSupported = isGemini3 ? getSupportedGeminiThinkingLevels(currentModel) : [];

    const options: ThinkingOption[] = isDeepSeek
      ? [
          { value: "off", label: t("webSearchOff") },
          { value: "low", label: t("thinkingLevelLow") || "STANDARD" },
          { value: "high", label: t("thinkingLevelHigh") || "DEEP" },
        ]
      : isClaudeModel
        ? [
            { value: "off", label: t("webSearchOff") },
            { value: "high", label: t("thinkingLevelHigh") || "HIGH" },
          ]
        : isGemini3 && geminiSupported.length > 0
          ? [
              { value: "off", label: t("webSearchOff") },
              ...geminiSupported.map((lvl) => ({
                value: lvl as ThinkingLevel,
                label:
                  lvl === "minimal"
                    ? t("thinkingLevelMinimal") || "MINIMAL"
                    : lvl === "low"
                      ? t("thinkingLevelLow") || "LOW"
                      : lvl === "medium"
                        ? t("thinkingLevelMedium") || "MEDIUM"
                        : t("thinkingLevelHigh") || "HIGH",
              })),
            ]
          : [
              { value: "off", label: t("webSearchOff") },
              { value: "low", label: t("thinkingLevelLow") || "LOW" },
              { value: "high", label: t("thinkingLevelHigh") || "HIGH" },
            ];
    ```

  - Tính `effectiveLevel`, `currentOption` và nhãn hiển thị thông qua `getEffectiveThinkingLevel`:
    ```typescript
    const effectiveLevel = getEffectiveThinkingLevel(currentModel, thinkingLevel);
    const currentOption = options.find((o) => o.value === effectiveLevel) || options[0];
    const displayLabel = `${t("thinkingLevel") || "THINKING"}: ${currentOption.label}`;
    ```
  - Cập nhật JSX `DropdownMenuItem`: so sánh checkmark và highlight với `effectiveLevel` thay vì `thinkingLevel` gốc:
    ```tsx
    <DropdownMenuItem
      key={option.value}
      onSelect={() => setThinkingLevel(option.value)}
      className={`flex items-center justify-between gap-3 ${
        effectiveLevel === option.value ? "bg-(--control-bg-hover) text-(--text-primary)" : ""
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wider">{option.label}</span>
      {effectiveLevel === option.value && (
        <div className="bg-(--accent) rounded-full p-0.5">
          <Check className="w-2.5 h-2.5 text-(--surface)" />
        </div>
      )}
    </DropdownMenuItem>
    ```
  - Nhờ đó:
    - Với `gemini-3.1-pro-preview`, người dùng có thể chọn `medium`, và nếu trước đó chọn `minimal` từ Flash thì UI tự hiển thị `THINKING: LOW` kèm checkmark tại `LOW`.
    - Khi chuyển sang Claude với level `"low"`/`"medium"`/`"minimal"`, UI tự hiển thị `THINKING: HIGH` kèm checkmark tại `HIGH`, đồng bộ 100% với server extended thinking.

#### Bước 4: Cập Nhật `src/app/api/chat-stream/streaming/types.ts` [MODIFY]

- **Mục tiêu**: Loại bỏ `temperature?: number;` khỏi `ChatStreamParams.ai.models.generateContentStream.config` và định nghĩa chặt chẽ `thinkingConfig`.
- **Chi tiết thay đổi**:
  - Import `GeminiThinkingLevel` từ `@/lib/core/modelRegistry`.
  - Cập nhật kiểu `ChatStreamParams`:
    ```typescript
    config: {
      systemInstruction?: string | unknown;
      tools?: unknown[];
      toolConfig?: unknown;
      safetySettings?: unknown[];
      maxOutputTokens?: number;
      thinkingConfig?: {
        thinkingLevel?: GeminiThinkingLevel;
        thinkingBudget?: number;
        includeThoughts?: boolean;
      };
      cachedContent?: string;
      abortSignal?: AbortSignal;
    };
    ```

#### Bước 5: Cập Nhật `src/app/api/chat-stream/streaming/gemini-stream.ts` [MODIFY]

- **Mục tiêu**: Thực thi bất biến Mutual Exclusion, kẹp bậc suy luận phía server, tính toán timeout và log dựa trên level đã kẹp, bổ sung `abortSignal` cho continuation call, và bảo đảm không truyền tham số sampling.
- **Chi tiết thay đổi**:
  - Import `clampGeminiThinkingLevel` và `GeminiThinkingLevel` từ `@/lib/core/modelRegistry`.
  - Tại dòng 132-146, thay thế khối khởi tạo `thinkingConfig`:

    ```typescript
    let thinkingConfig:
      | { thinkingLevel?: GeminiThinkingLevel; thinkingBudget?: number; includeThoughts?: boolean }
      | undefined;

    let effectiveThinkingLevel = thinkingLevel;

    if (thinkingLevel && thinkingLevel !== "off") {
      if (modelSupportsThinking(model)) {
        // Nhánh Gemini 3+: Kẹp level theo năng lực model và gửi thinkingLevel
        // BẤT BIẾN: Tuyệt đối KHÔNG gửi thinkingBudget
        const clampedLevel = clampGeminiThinkingLevel(model, thinkingLevel);
        effectiveThinkingLevel = clampedLevel;
        thinkingConfig = { thinkingLevel: clampedLevel, includeThoughts: true };
      } else if (normalized.startsWith("gemini-2.5")) {
        // Nhánh Gemini 2.5: Bảo toàn backward compatibility cho DEFAULT_MODEL
        // BẤT BIẾN: Tuyệt đối KHÔNG gửi thinkingLevel
        thinkingConfig = { thinkingBudget: -1, includeThoughts: true };
      }
      // Các model khác: thinkingConfig giữ nguyên undefined
    }
    ```

  - Tại dòng 163-166: Sử dụng `effectiveThinkingLevel` cho timeout và logging:
    ```typescript
    const timeoutMs = getStreamTimeout(model, effectiveThinkingLevel);
    streamLogger.info(
      `Executing stream for model: ${model} with maxTokens: ${maxTokens}, timeout: ${timeoutMs}ms, thinkingLevel: ${effectiveThinkingLevel || "off"}`
    );
    ```
  - Tại dòng 419-431, bổ sung `abortSignal: params.abortSignal` vào cấu hình continuation call:
    ```typescript
    const contResult = params.ai.models.generateContentStream({
      model: params.model,
      contents: contContents as unknown[],
      config: {
        systemInstruction,
        tools:
          params.useTools && Array.isArray(params.tools) && params.tools.length > 0
            ? params.tools
            : undefined,
        toolConfig: params.useTools ? params.toolConfig : undefined,
        abortSignal: params.abortSignal, // Bổ sung abortSignal bảo vệ vòng đời stream
      },
    });
    ```
  - Rà soát xác nhận cả initial call và continuation call không truyền `temperature`, `top_p`, `top_k`.

#### Bước 6: Cập Nhật `src/lib/core/autoTitleEngine.ts` [MODIFY]

- **Mục tiêu**: Xóa bỏ `temperature`, import enum `ThinkingLevel` từ `@google/genai` để gán `ThinkingLevel.MINIMAL` cho `PRIMARY_MODEL` để vượt qua type-check và chống tràn token suy luận.
- **Chi tiết thay đổi**:
  - Import enum:
    ```typescript
    import { ThinkingLevel } from "@google/genai";
    ```
  - Xóa `temperature` khỏi `interface GenerateTitleOptions`:
    ```typescript
    interface GenerateTitleOptions {
      maxOutputTokens: number;
    }
    ```
  - Trong hàm `generateTitleWithModel`:
    ```typescript
    const attemptGenerate = async (modelId: string): Promise<string> => {
      // Gemini 3 Flash mặc định bật suy luận mức "high". Khi giới hạn maxOutputTokens: 15/20,
      // token suy luận có thể chiếm trọn ngân sách khiến tiêu đề bị rỗng.
      // Giải pháp: Ép thinkingLevel: ThinkingLevel.MINIMAL cho Gemini 3 để dành trọn tokens cho tiêu đề.
      const isGemini3 = modelId.startsWith("gemini-3");
      const res = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          maxOutputTokens,
          ...(isGemini3 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
        },
      });
      return extractText(res);
    };
    ```
  - Cập nhật call sites:
    - Tại dòng 145: `{ maxOutputTokens: 15 }`
    - Tại dòng 174: `{ maxOutputTokens: 20 }`

#### Bước 7: Cập Nhật `src/lib/features/files/fileProcessors.ts` [MODIFY]

- **Mục tiêu**: Xóa `temperature: 0.2` khỏi `analyzeWithAI`.
- **Chi tiết thay đổi**:
  - Tại dòng 608-613:
    ```typescript
    config: {
      ...(opts.systemInstruction?.trim() ? { systemInstruction: opts.systemInstruction } : {}),
      maxOutputTokens: 2048,
    },
    ```

#### Bước 8: Mở Rộng Test `src/app/api/chat-stream/streaming/gemini-stream.test.ts` [MODIFY]

- **Mục tiêu**: Cập nhật mock factory dùng `importOriginal` để hàm thật `clampGeminiThinkingLevel` chạy trong test; cập nhật test abort dùng model ID chuẩn; bổ sung test cases kiểm tra Gemini 3, Gemini 2.5, Clamping, và Continuation call.
- **Chi tiết thay đổi**:
  - Cập nhật mock `modelRegistry`:
    ```typescript
    vi.mock("@/lib/core/modelRegistry", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/core/modelRegistry")>();
      return {
        ...actual,
        getModelMaxOutputTokens: () => 4096,
        modelSupportsThinking: vi.fn((m: unknown) => actual.modelSupportsThinking(m)),
      };
    });
    ```
  - Trong test case abort hiện tại: đổi `model: "gemini-3.8-flash"` thành `model: "gemini-3-flash-preview"` (model hợp lệ trong `API_ALLOWED`).
  - Thêm 5 test cases mới:
    1. `sets thinkingConfig with thinkingLevel and includeThoughts for Gemini 3`: Gọi với `gemini-3-flash-preview`, `thinkingLevel: "high"`. Assert `thinkingConfig = { thinkingLevel: "high", includeThoughts: true }`, assert KHÔNG có `thinkingBudget`, KHÔNG có `temperature`.
    2. `sets thinkingConfig with thinkingBudget: -1 for Gemini 2.5`: Gọi với `gemini-2.5-flash`, `thinkingLevel: "high"`. Assert `thinkingConfig = { thinkingBudget: -1, includeThoughts: true }`, assert KHÔNG có `thinkingLevel`, KHÔNG có `temperature`.
    3. `clamps minimal to low for Gemini 3.1 Pro`: Gọi với `gemini-3.1-pro-preview`, `thinkingLevel: "minimal"`. Assert `thinkingConfig = { thinkingLevel: "low", includeThoughts: true }`.
    4. `omits thinkingConfig when thinkingLevel is off or undefined`: Gọi với `thinkingLevel: "off"`. Assert `thinkingConfig === undefined`.
    5. `continuation call includes abortSignal and excludes sampling parameters`: Giả lập function call, assert cuộc gọi continuation thứ 2 chứa `abortSignal` và không chứa `temperature`, `topP`, `topK`, `top_p`, `top_k`.

#### Bước 9: Bổ Sung Test `src/app/features/chat/components/hooks/useThinkingLevel.test.ts` [MODIFY]

- **Mục tiêu**: Bổ sung unit tests cho hàm thuần `getAvailableThinkingLevels` và hàm điều phối xuyên mô hình `getEffectiveThinkingLevel` (tổng cộng 11 test cases mới, nâng tổng test file lên 18 cases).
- **Chi tiết test cases**:
  - Nhóm 1: `getAvailableThinkingLevels` (5 cases):
    1. `returns full levels for Gemini 3 Flash`: `getAvailableThinkingLevels("gemini-3-flash-preview")` trả về `["off", "minimal", "low", "medium", "high"]`.
    2. `returns low, medium, high for Gemini 3.1 Pro`: `getAvailableThinkingLevels("gemini-3.1-pro-preview")` trả về `["off", "low", "medium", "high"]`.
    3. `returns off, low, high for Gemini 2.5 Flash`: `getAvailableThinkingLevels("gemini-2.5-flash")` trả về `["off", "low", "high"]`.
    4. `returns off, high for Claude`: `getAvailableThinkingLevels("claude-sonnet-4.5")` trả về `["off", "high"]`.
    5. `returns off, low, high for DeepSeek V4`: `getAvailableThinkingLevels("deepseek-v4-flash")` trả về `["off", "low", "high"]`.
  - Nhóm 2: `getEffectiveThinkingLevel` (6 cases):
    1. `Claude maps non-off levels to high and preserves off`: Gọi với `claude-sonnet-4.5`, `"low"` -> `"high"`, `"minimal"` -> `"high"`, `"off"` -> `"off"`.
    2. `Gemini 3.1 Pro clamps minimal to low`: Gọi với `gemini-3.1-pro-preview`, `"minimal"` -> `"low"`, `"medium"` -> `"medium"`.
    3. `Gemini 3 Flash preserves supported levels`: Gọi với `gemini-3-flash-preview`, `"minimal"` -> `"minimal"`, `"high"` -> `"high"`.
    4. `DeepSeek V4 maps minimal, low, medium to low and high to high`: Gọi với `deepseek-v4-flash`, `"minimal"` -> `"low"`, `"low"` -> `"low"`, `"medium"` -> `"low"`, `"high"` -> `"high"`.
    5. `Gemini 2.5 maps minimal to low and high to high`: Gọi với `gemini-2.5-flash`, `"minimal"` -> `"low"`, `"high"` -> `"high"`.
    6. `Non-thinking model returns off`: Gọi với `claude-haiku-3.5` hoặc `gpt-4o-mini`, `"high"` -> `"off"`.

#### Bước 10: Tạo Mới Co-located Test `src/lib/core/modelRegistry.test.ts` [NEW]

- **Mục tiêu**: Đảm bảo 100% coverage cho các hàm tiện ích mới.
- **Chi tiết test cases (4 cases)**:
  1. `modelSupportsThinking`: `true` cho `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`; `false` cho `gemini-2.5-flash`, `gemini-2.5-pro`, `claude-sonnet-4.5`.
  2. `getSupportedGeminiThinkingLevels`: Trả về `["minimal", "low", "medium", "high"]` cho Flash; `["low", "medium", "high"]` cho Gemini 3.1 Pro; `[]` cho Gemini 2.5 Flash.
  3. `clampGeminiThinkingLevel`: Kẹp `"minimal"` thành `"low"` trên `gemini-3.1-pro-preview`; giữ nguyên `"minimal"` trên `gemini-3-flash-preview`.
  4. `normalizeModelForApi`: Map đúng aliases và fallback về `DEFAULT_MODEL`.

#### Bước 11: Tạo Mới Co-located Test `src/lib/core/autoTitleEngine.test.ts` [NEW]

- **Mục tiêu**: Kiểm thử an toàn cô lập mà không kích hoạt env validation thật.
- **Chi tiết test cases (4 cases)**:
  - Mock SDK: `vi.mock("@/lib/core/genaiClient", () => ({ getGenAIClient: () => mockAi }))`.
  - `normalizeTitle`: Chuẩn hóa khoảng trắng, viết hoa chữ cái đầu, bỏ ngoặc kép và dấu câu, giới hạn tối đa 6 từ.
  - `generateOptimisticTitle`: Gọi với `maxOutputTokens: 15`, `thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }`, assert `mockGenerateContent.mock.calls.every(c => !("temperature" in c[0].config))`.
  - `generateFinalTitle`: Gọi với `maxOutputTokens: 20`, `thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }`, assert không có `temperature`.
  - Fallback logic: Khi `PRIMARY_MODEL` ném lỗi, thử `FALLBACK_MODEL` (`gemini-2.5-flash`), assert cuộc gọi fallback KHÔNG có `thinkingConfig`, và khi cả hai lỗi trả fallback title an toàn.

#### Bước 12: Tạo Mới Co-located Test `src/lib/features/files/fileProcessors.test.ts` [NEW]

- **Mục tiêu**: Kiểm thử cấu hình AI file analysis.
- **Chi tiết test cases (2 cases)**:
  - Mock SDK: `vi.mock("@/lib/core/genaiClient", () => ({ getGenAIClient: () => mockAi }))`.
  - `analyzeWithAI`: Gọi `generateContent` với `maxOutputTokens: 2048`, `systemInstruction` (nếu có), assert không chứa `temperature`, `top_p`, `top_k`.
  - Error case: Khi model ném lỗi, ném lỗi rõ ràng không nuốt exception.

#### Bước 13: Cập Nhật Tài Liệu `docs/models.md` & `docs/CHANGELOG.md` [MODIFY]

- Cập nhật ma trận `supportedThinkingLevels`, bất biến Mutual Exclusion trong `docs/models.md`.
- Ghi nhận changelog dọn dẹp sampling parameters và nâng cấp logic thinking trong `docs/CHANGELOG.md`.
- Ghi nhận thay đổi UX của Claude trong `ThinkingLevelSelector`: chuyển từ hiển thị off/low/high sang off/high nhằm nhất quán 100% với `anthropic-stream.ts` (Claude chỉ phân biệt bật/tắt suy luận).

---

### 7. Test Contract

#### 7.1. Contract: Gemini Stream Generation Config (`gemini-stream.ts`)

- **Trường hợp 1: Gemini 3 Series (Active Thinking)**
  - Input: `model: "gemini-3-flash-preview"`, `thinkingLevel: "high"`
  - Expectation:
    ```typescript
    expect(mockGenerateContentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          thinkingConfig: {
            thinkingLevel: "high",
            includeThoughts: true,
          },
        }),
      })
    );
    expect(capturedConfig.thinkingConfig).not.toHaveProperty("thinkingBudget");
    expect(capturedConfig).not.toHaveProperty("temperature");
    ```
- **Trường hợp 2: Gemini 2.5 Series (Backward Compatibility Preservation)**
  - Input: `model: "gemini-2.5-flash"`, `thinkingLevel: "high"`
  - Expectation:
    ```typescript
    expect(mockGenerateContentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          thinkingConfig: {
            thinkingBudget: -1,
            includeThoughts: true,
          },
        }),
      })
    );
    expect(capturedConfig.thinkingConfig).not.toHaveProperty("thinkingLevel");
    expect(capturedConfig).not.toHaveProperty("temperature");
    ```
- **Trường hợp 3: Clamping Level Không Được Hỗ Trợ**
  - Input: `model: "gemini-3.1-pro-preview"`, `thinkingLevel: "minimal"`
  - Expectation:
    ```typescript
    expect(mockGenerateContentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          thinkingConfig: {
            thinkingLevel: "low", // Tự động kẹp từ minimal lên low
            includeThoughts: true,
          },
        }),
      })
    );
    ```
- **Trường hợp 4: Continuation Call Sau Tool Execution**
  - Input: Stream trả về `functionCall`, thực thi tool và gửi `functionResponse`.
  - Expectation: Cuộc gọi `generateContentStream` thứ hai chứa `abortSignal: params.abortSignal` và không chứa `temperature`, `top_p`, `top_k`.

#### 7.2. Contract: Auto-Title Engine (`autoTitleEngine.ts`)

- **Input**: `generateOptimisticTitle(text)` và `generateFinalTitle({ userId, conversationId, messages })`
- **Expectation**:

  ```typescript
  import { ThinkingLevel } from "@google/genai";

  // Assert tất cả các cuộc gọi đều không chứa temperature
  expect(mockGenerateContent.mock.calls.every((call) => !("temperature" in call[0].config))).toBe(
    true
  );

  // Assert primary call (gemini-3-flash-preview) có thinkingLevel: ThinkingLevel.MINIMAL ("MINIMAL")
  const primaryCall = mockGenerateContent.mock.calls.find(
    (c) => c[0].model === "gemini-3-flash-preview"
  );
  expect(primaryCall[0].config).toEqual(
    expect.objectContaining({
      maxOutputTokens: 15, // hoặc 20 cho final title
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    })
  );

  // Khi primary lỗi và rơi về fallback (gemini-2.5-flash): assert fallback call KHÔNG có thinkingConfig
  const fallbackCall = mockGenerateContent.mock.calls.find(
    (c) => c[0].model === "gemini-2.5-flash"
  );
  if (fallbackCall) {
    expect(fallbackCall[0].config).not.toHaveProperty("thinkingConfig");
  }
  ```

#### 7.3. Contract: File AI Analysis (`fileProcessors.ts`)

- **Input**: `analyzeWithAI(fileBuffer, mime, fileName, opts)`
- **Expectation**:
  ```typescript
  expect(mockGenerateContent).toHaveBeenCalledWith(
    expect.objectContaining({
      config: expect.objectContaining({
        maxOutputTokens: 2048,
      }),
    })
  );
  expect(mockGenerateContent.mock.calls[0][0].config).not.toHaveProperty("temperature");
  ```

#### 7.4. Contract: Non-Gemini Sampling Preservation

- **Anthropic Claude**: `temperature: 1` khi thinking bật, `temperature: 0.7` khi thinking tắt.
- **OpenAI / Groq / OpenRouter**: Duy trì `temperature: 0.7`.
- **DeepSeek**: Duy trì `temperature: 0.7` khi tắt thinking.

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 8.1. Các Lệnh Thực Thi Kiểm Thử

Tuân thủ chuẩn dự án Vikini:

```powershell
# Tier 1: Kiểm tra cú pháp và kiểu dữ liệu tức thì
npm run type-check

# Tier 2: Kiểm tra toàn diện chất lượng (Type check + Linter + All Unit Tests)
npm run verify
```

_(Ghi chú: Lệnh `npm run verify` được định nghĩa trong `package.json:25` chạy `npm run type-check && npm run lint && npm run test:run` thông qua npm script runner trên shell `cmd.exe`, hoàn toàn an toàn và không bị nuốt exit code)._

#### 8.2. Danh Sách Co-Located Tests Kiểm Thử

1. `src/app/api/chat-stream/streaming/gemini-stream.test.ts`: 6 test cases (1 abort test cập nhật model chuẩn + 5 test cases mới).
2. `src/app/features/chat/components/hooks/useThinkingLevel.test.ts`: 18 test cases (7 cases hiện có + 5 cases mới cho `getAvailableThinkingLevels` + 6 cases mới cho `getEffectiveThinkingLevel`).
3. `src/lib/core/modelRegistry.test.ts`: 4 test cases mới.
4. `src/lib/core/autoTitleEngine.test.ts`: 4 test cases mới.
5. `src/lib/features/files/fileProcessors.test.ts`: 2 test cases mới.

#### 8.3. Wiring Probe & Negative Probes (Mục 4.5.3 Evidence Bar)

- **Wiring Probe (Chứng minh linter enforce cấm `any` và cấm `console.log`)**:
  Chạy `npm run lint` để kiểm chứng rule `@typescript-eslint/no-explicit-any: error`.
- **Negative Probe Thực Thi Được (Bảo đảm TypeScript compiler bắt lỗi nếu truyền `temperature` vào Gemini stream config)**:
  1. Trong `src/app/api/chat-stream/streaming/gemini-stream.ts`, thử thêm thuộc tính bị cấm: `config: { temperature: 0.7, ... }`.
  2. Thực thi lệnh: `npm run type-check`.
  3. Compiler bắt buộc dừng lại với mã lỗi thoát ≠ 0 và thông báo lỗi:
     `TS2353: Object literal may only specify known properties, and 'temperature' does not exist in type '...'`.
  4. Khôi phục lại code sạch và xác nhận `npm run type-check` đạt exit code 0.

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi Ro                                                              | Mức Độ     | Kịch Bản & Ảnh Hưởng                                                                                                            | Biện Pháp Phòng Ngừa Kỹ Thuật (Technical Control)                                                                                                                                                                   | Dẫn Chứng Xác Minh                                                                                                                                                        |
| :------------------------------------------------------------------ | :--------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Gửi đồng thời `thinkingLevel` và `thinkingBudget`**               | Cao        | Gửi cả hai tham số khiến Google Gemini API ném lỗi `HTTP 400 Bad Request`.                                                      | Phân nhánh rành mạch `if (modelSupportsThinking(model)) { ... } else if (normalized.startsWith("gemini-2.5")) { ... }`. Không bao giờ gán cả hai trường vào cùng một object `thinkingConfig`.                       | `[SRC]` `src/app/api/chat-stream/streaming/gemini-stream.ts:132-146`<br>`[URL]` https://ai.google.dev/gemini-api/docs/gemini-3                                            |
| **Regression suy luận trên Gemini 2.5 (model mặc định)**            | Cao        | Xóa `thinkingBudget` làm mất `<think>` block của model mặc định `gemini-2.5-flash`.                                             | Bảo toàn nhánh Gemini 2.5 với `thinkingBudget: -1`, `includeThoughts: true` khi người dùng bật suy luận.                                                                                                            | `[SRC]` `src/lib/core/modelRegistry.ts:4`<br>`[SRC]` `src/app/api/chat-stream/streaming/gemini-stream.ts:143`                                                             |
| **Level suy luận không được model hỗ trợ (VD: `minimal` trên Pro)** | Trung bình | Người dùng đổi model từ Flash sang Pro, client gửi `minimal` khiến Pro API ném lỗi HTTP 400.                                    | Hàm `clampGeminiThinkingLevel(model, thinkingLevel)` tại server tự động kẹp `minimal` về `low` trước khi truyền vào API config; UI `ThinkingLevelSelector` hiển thị `effectiveLevel`.                               | `[SRC]` `src/lib/core/modelRegistry.ts`<br>`[SRC]` `src/app/features/chat/components/ThinkingLevelSelector.tsx`<br>`[URL]` https://ai.google.dev/gemini-api/docs/thinking |
| **Tràn token suy luận trong Auto-Title Engine**                     | Trung bình | Gemini 3 Flash mặc định suy luận mức "high", chiếm trọn ngân sách 15-20 tokens khiến tiêu đề rỗng.                              | Truyền tường minh `thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }` cho `PRIMARY_MODEL` trong `autoTitleEngine.ts`. Đã có lưới an toàn `fallback = titleFromUserMessage(userMessage)` bảo đảm không crash. | `[SRC]` `src/lib/core/autoTitleEngine.ts:114, 140`                                                                                                                        |
| **Ảnh hưởng nhầm tới Claude, Groq hoặc DeepSeek**                   | Cao        | Vô tình xóa `temperature` ở các provider khác làm vi phạm yêu cầu của Claude API (`temperature = 1` bắt buộc khi bật thinking). | Cô lập 100% phạm vi sửa đổi trong các module chuyên biệt của Gemini. Giữ nguyên logic của `anthropic-stream.ts`, `openai-stream.ts`, `deepseek-request-builder.ts`.                                                 | `[SRC]` `src/app/api/chat-stream/streaming/anthropic-stream.ts:239-241`<br>`[SRC]` `src/app/api/chat-stream/streaming/deepseek-request-builder.ts:148`                    |

---

### 10. Mental Simulation Verification Matrix (S1–S6 & Domain)

| Kịch Bản                               | Trạng Thái | Loại Bằng Chứng   | Chi Tiết Đánh Giá & Phòng Vệ Kỹ Thuật                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :------------------------------------- | :--------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**             | PASS       | `[CMD]` + `[SRC]` | `npm run type-check` (exit 0), `npm run lint` (exit 0) và `npx vitest run` (89 files / 975 tests pass sạch). Đã xác minh tính tương thích kiểu và lint: `ThinkingLevel.MINIMAL` enum cho `autoTitleEngine.ts` (probe compile sạch); `ThinkingLevelSelector.tsx` import chuẩn xác `isGemini3Model`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `getEffectiveThinkingLevel` từ `./hooks/useThinkingLevel`, import `getSupportedGeminiThinkingLevels` từ `@/lib/core/modelRegistry`, khai báo đầy đủ `isClaudeModel` (triệt tiêu 100% lỗi TS2305/TS2304 theo MAJOR-R3-1 và MINOR-R5-1); loại bỏ hoàn toàn khối `catch {}` rỗng triệt tiêu 100% lỗi ESLint `no-empty` theo MAJOR-R5-2. |
| **S2: Lifecycle & Abort Teardown**     | PASS       | `[SRC]`           | Giữ nguyên cơ chế `abortSignal` trong `gemini-stream.ts`, bổ sung `abortSignal` vào continuation call (dòng 422), và lưới an toàn `saveMessage` với `isPartial: true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **S3: Database & Temporal Logic**      | PASS (N/A) | `[SRC]`           | Kế hoạch không thay đổi cấu trúc bảng hay migration Supabase (`messages`, `conversations`). `saveMessage` và `upsertMessage` giữ nguyên vẹn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **S4: Cross-Task State Flow**          | PASS       | `[SRC]` + `[ADV]` | `getEffectiveThinkingLevel` giải quyết bậc suy luận hiệu lực dẫn xuất thuần túy tại thời điểm render cho `ThinkingLevelSelector` (nhãn và checkmark). Trạng thái `localStorage` bảo toàn nguyên vẹn preference gốc của người dùng (không dùng effect persist phá hủy theo MAJOR-R5-1). Phía server tự động clamp và map theo model thực tế của request. Triệt tiêu 100% rủi ro mất preference khi URL cold-start hoặc ghé qua model không-thinking.                                                                                                                                                                                                                                   |
| **S5: Security & Auth**                | PASS       | `[SRC]`           | API routes vẫn được bảo vệ bởi `requireUser()` / `auth()`. Không in log thông tin nhạy cảm, API keys. Upstash Redis rate limiting giữ nguyên.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **S6: External Resilience**            | PASS       | `[SRC]` + `[ADV]` | Triệt tiêu 100% nguy cơ lỗi HTTP 400 Bad Request do gửi đồng thời 2 tham số hoặc gửi level không hợp lệ. Fallback model trong `autoTitleEngine.ts` tiếp tục hoạt động trơn tru.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Domain: Gemini Thinking & Sampling** | PASS       | `[URL]` + `[SRC]` | Tuân thủ triệt để tài liệu Google 2026: Mutual Exclusion Invariant, UI/Server Clamping Control, Proactive Sampling Cleanup, và Reasoning Token Guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

#### Adversarial Timeline S4 & S6: Xử Lý Điều Phối Trạng Thái Khi Chuyển Model Đột Ngột

```
Cơ chế 1: Chuyển model từ Gemini 3 Flash sang Gemini 3.1 Pro với bậc suy luận "minimal"
T1: Người dùng đang trò chuyện bằng Gemini 3 Flash và chọn thinking level "minimal" -> localStorage lưu "vikini.thinkingLevel" = "minimal".
T2: Người dùng đổi model sang Gemini 3.1 Pro (vốn KHÔNG hỗ trợ "minimal").
T3: ThinkingLevelSelector gọi getEffectiveThinkingLevel("gemini-3.1-pro-preview", "minimal") -> "low".
    UI lập tức hiển thị "THINKING: LOW", dropdown có đầy đủ 4 options [off, low, medium, high], checkmark tick tại "LOW".
    Preference "minimal" trong localStorage được bảo toàn nguyên vẹn (không bị ghi đè phá hủy).
T4: Client gửi tin nhắn, gemini-stream.ts kẹp level về "low", tính timeout theo "low", gửi thinkingConfig = { thinkingLevel: "low", includeThoughts: true } tới Google API.
Kết cục: UI hiển thị LOW, Server thực thi LOW, Google API trả về HTTP 200 OK -> AN TOÀN TUYỆT ĐỐI.

Cơ chế 2: Chuyển model từ Gemini 3 sang Claude với bậc suy luận "low" / "medium" / "minimal" (MAJOR-R4-1 Defense)
T1: Người dùng ở Gemini 3 Flash chọn thinking level "medium" -> localStorage lưu "medium".
T2: Người dùng chuyển sang model Claude (claude-sonnet-4.5, chỉ hỗ trợ options [off, high]).
T3: ThinkingLevelSelector gọi getEffectiveThinkingLevel("claude-sonnet-4.5", "medium") -> "high".
    UI lập tức hiển thị "THINKING: HIGH", dropdown tick vào "HIGH" (không bị rơi về options[0] "OFF").
    Preference "medium" trong localStorage được bảo toàn nguyên vẹn để khi quay lại Gemini 3 Flash vẫn là "medium".
T4: Client gửi tin nhắn: payload gửi thinkingLevel: "medium" (hoặc level đã chọn). Server anthropic-stream.ts kiểm tra "medium" !== "off", kích hoạt extended thinking chuẩn xác.
Kết cục: UI hiển thị HIGH, server kích hoạt thinking HIGH -> Khớp 100%, triệt tiêu hoàn toàn rủi ro UI hiển thị nhầm "OFF" trong khi Claude thực tế đang suy luận, đồng thời bảo toàn preference của người dùng.
```

---

## Audit History

_(Khu vực dành riêng cho Lead Reviewer ghi chú kết quả thẩm định)_

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-08
- **Đối tượng**: Technical Plan Revision 1 (v1)
- **Kiểm chứng lỗi cũ**: N/A — đây là lượt thẩm định đầu tiên.

#### Bằng chứng đã thu thập

| #   | Loại    | Bằng chứng                                                                               | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :-- | :------ | :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | `[CMD]` | `npm run type-check`                                                                     | Exit 0 (baseline sạch).                                                                                                                                                                                                                                                                                                                                                                                                                    |
| E2  | `[CMD]` | `npx vitest run`                                                                         | Exit 0 — **89 files / 975 tests passed** (khớp số liệu plan mục 4).                                                                                                                                                                                                                                                                                                                                                                        |
| E3  | `[CMD]` | `node -p "require('./node_modules/@google/genai/package.json').version"`                 | `2.10.0`.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| E4  | `[SRC]` | `node_modules/@google/genai/dist/genai.d.ts:12171-12215`                                 | `ThinkingConfig` vẫn có `thinkingBudget?: number` với doc "0 is DISABLED. -1 is AUTOMATIC" — **KHÔNG có `@deprecated`**. `thinkingLevel?: ThinkingLevel` là enum UPPERCASE (`MINIMAL/LOW/MEDIUM/HIGH`, dòng 12185-12205).                                                                                                                                                                                                                  |
| E5  | `[SRC]` | `genai.d.ts:4686, 5305`                                                                  | `temperature?: number` vẫn là field hợp lệ của `GenerateContentConfig`, không deprecated.                                                                                                                                                                                                                                                                                                                                                  |
| E6  | `[URL]` | https://ai.google.dev/gemini-api/docs/gemini-3                                           | _"Yes, `thinking_budget` is still supported for backward compatibility, but we recommend migrating to `thinking_level`"_; _"You cannot use both `thinking_level` and the legacy `thinking_budget` parameter in the same request."_; _"we strongly recommend keeping the temperature parameter at its default value of 1.0 … setting it below 1.0 may lead to unexpected behavior, such as looping"_ — **khuyến nghị, không phải lỗi 400**. |
| E7  | `[URL]` | https://ai.google.dev/gemini-api/docs/thinking                                           | Bảng hỗ trợ theo model: `gemini-3-flash-preview` = minimal/low/medium/high; `gemini-3.1-pro-preview` = low/medium/high (**không có `minimal`**); `gemini-3-pro-preview` = low/high.                                                                                                                                                                                                                                                        |
| E8  | `[SRC]` | `src/lib/core/modelRegistry.ts:4, 36, 46`                                                | `DEFAULT_MODEL = "gemini-2.5-flash"`; `gemini-2.5-pro` vẫn là selectable model.                                                                                                                                                                                                                                                                                                                                                            |
| E9  | `[SRC]` | `src/app/features/chat/components/hooks/useThinkingLevel.ts:65-72, 108-117`              | UI hiển thị thinking toggle cho Gemini 2.5 (`isGemini25Model`), `availableLevels = ["off","low","high"]`; comment dòng 108: _"high = dynamic thinkingBudget"_.                                                                                                                                                                                                                                                                             |
| E10 | `[SRC]` | `src/app/api/chat-stream/streaming/gemini-stream.ts:136-146`                             | Nhánh `normalized.startsWith("gemini-2.5")` → `{ thinkingBudget: -1, includeThoughts: true }` là cơ chế **duy nhất** hiển thị thought stream cho Gemini 2.5. Không bao giờ gửi đồng thời với `thinkingLevel` (if/else-if).                                                                                                                                                                                                                 |
| E11 | `[SRC]` | `useChatStreamController.ts:661-684` + `ChatApp.tsx:411-414`                             | Server nhận `thinkingLevel` đọc thẳng từ `localStorage`, **không clamp theo `availableLevels` của model hiện tại**.                                                                                                                                                                                                                                                                                                                        |
| E12 | `[SRC]` | `gemini-stream.test.ts:5-9`                                                              | `modelSupportsThinking: () => true` là hằng số trong `vi.mock` → không thể test nhánh model không hỗ trợ nếu giữ nguyên mock.                                                                                                                                                                                                                                                                                                              |
| E13 | `[SRC]` | `src/lib/core/genaiClient.ts:4`                                                          | `import "@/lib/env"` (env validation tại import) → test mới cho `autoTitleEngine`/`fileProcessors` bắt buộc `vi.mock("@/lib/core/genaiClient")`.                                                                                                                                                                                                                                                                                           |
| E14 | `[SRC]` | `anthropic-stream.ts:235-241`, `openai-stream.ts:230`, `deepseek-request-builder.ts:148` | Line refs của plan về provider isolation chính xác.                                                                                                                                                                                                                                                                                                                                                                                        |
| E15 | `[SRC]` | `chatStreamCore.ts:553`                                                                  | `ai as unknown as ChatStreamParams["ai"]` → thu hẹp `thinkingConfig` trong `types.ts` thành literal union lowercase không gây xung đột với enum UPPERCASE của SDK ở compile-time; runtime hiện tại đã gửi lowercase và hoạt động (REST chấp nhận).                                                                                                                                                                                         |

#### Mental Simulation Matrix (S1–S6)

| Kịch Bản                               | Kết quả          | Bằng chứng                                                          | Nhận định                                                                                                                                                                                                                                                                          |
| :------------------------------------- | :--------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**             | PASS             | `[CMD]` E1, E2; `[SRC]` `package.json:13,17,20,25`                  | Baseline sạch, không thêm dependency, không Prisma/Better Auth. Các file `[NEW]` không bị import bởi module khác trước khi tạo.                                                                                                                                                    |
| **S2: Lifecycle & Abort**              | PASS (kèm MINOR) | `[SRC]` `gemini-stream.ts:201, 234, 419-434, 663-679`               | Abort chính giữ nguyên. Tuy nhiên continuation call (dòng 419-431) **không truyền `abortSignal`** — plan Bước 1 còn "xác nhận" config continuation chỉ gồm `systemInstruction/tools/toolConfig`, tức hợp thức hóa thiếu sót này (xem MINOR-4).                                     |
| **S3: Database & Temporal**            | PASS (N/A)       | `[SRC]` plan §3.1.5 + đối chiếu không có file migration trong mục 5 | Không chạm schema/RLS.                                                                                                                                                                                                                                                             |
| **S4: Cross-Task State Flow**          | **FAIL**         | `[SRC]` E9, E11                                                     | (a) `"minimal"` lưu trong `localStorage` khi ở Gemini 3 Flash sẽ được gửi nguyên trạng khi người dùng chuyển sang `gemini-3.1-pro-preview` (không hỗ trợ `minimal` theo E7). (b) Sau thay đổi, toggle thinking của Gemini 2.5 (model mặc định) vẫn hiển thị nhưng trở thành no-op. |
| **S5: Security & Auth**                | PASS             | `[SRC]` `validators.ts:13` (Zod enum giữ nguyên)                    | Plan không chạm auth/rate-limit/route; không log thêm dữ liệu nhạy cảm.                                                                                                                                                                                                            |
| **S6: External Resilience**            | **FAIL**         | `[URL]` E6, E7; `[SRC]` E4, E10; `[ADV]` timeline dưới              | Tiền đề "thinkingBudget/temperature gây 400" bị tài liệu chính thức bác bỏ; thay đổi gây regression chức năng cho Gemini 2.5; rủi ro 400 thực sự (level không được model hỗ trợ) không có control.                                                                                 |
| **Domain: Gemini Thinking & Sampling** | **FAIL**         | E4–E10                                                              | Xem MAJOR-1 → MAJOR-3.                                                                                                                                                                                                                                                             |

**Adversarial Timeline (Reviewer)**

```
Cơ chế: Regression thinking cho model mặc định Gemini 2.5
T1: User dùng DEFAULT_MODEL gemini-2.5-flash, bật thinking "high" (toggle hiển thị theo useThinkingLevel.ts:65-72).
T2: Sau plan, executeStream: modelSupportsThinking("gemini-2.5-flash") === false → thinkingConfig = undefined.
T3: Gemini 2.5 vẫn suy luận ngầm (dynamic mặc định) nhưng includeThoughts không được gửi → không có thought parts → không có <think> block.
Kết cục: Toggle UI là no-op, mất tính năng hiển thị suy luận trên model mặc định → LỖI (MAJOR).

Cơ chế: Level không được hỗ trợ theo model
T1: User chọn "minimal" trên gemini-3-flash-preview → localStorage "vikini.thinkingLevel" = "minimal".
T2: User chuyển sang gemini-3.1-pro-preview; availableLevels = ["off","low","high"] nhưng state/localStorage vẫn "minimal" (không clamp, E11).
T3: Server: modelSupportsThinking → true → thinkingConfig { thinkingLevel: "minimal" } gửi tới model không hỗ trợ minimal (E7).
Kết cục: Rủi ro HTTP 400 INVALID_ARGUMENT — đúng loại lỗi plan tuyên bố "Zero 400 errors" → LỖI (MAJOR).
```

#### Phân loại lỗi

**[MAJOR-1] Tiền đề kỹ thuật sai & dẫn chứng bị trình bày sai (Evidence Bar 4.5.1).**

- Plan §1.1, §1.2, §3.1.2, §3.1.3 và bảng §4 khẳng định `thinkingBudget` và `temperature/top_p/top_k` "deprecated, ném lỗi 400", dẫn `[SRC] genai.d.ts:12171-12215`. Thực tế E4/E5: d.ts **không** đánh dấu deprecated; E6: Google xác nhận `thinking_budget` _"still supported for backward compatibility"_ — chỉ lỗi khi gửi **đồng thời** với `thinking_level`; `temperature` chỉ được **khuyến nghị** giữ default 1.0.
- **Yêu cầu**: Viết lại Goal/Assumptions/bảng Verified Versions theo đúng dẫn chứng. Lý do hợp lệ để bỏ `temperature` là khuyến nghị E6 (giá trị 0.2/0.3 < 1.0 có thể gây looping) — vẫn nên thực hiện, nhưng phải mô tả đúng bản chất. Bất biến cần bảo vệ là: **không bao giờ gửi `thinkingLevel` và `thinkingBudget` trong cùng một request**.

**[MAJOR-2] Regression chức năng trên Gemini 2.5 (model mặc định).**

- Bước 1 xóa nhánh `gemini-2.5` (E10) trong khi `gemini-2.5-flash` là `DEFAULT_MODEL` và UI vẫn hiển thị toggle cho Gemini 2.5 (E8, E9). Kết quả: toggle no-op, mất thought stream (timeline trên). Plan cũng không cập nhật `modelSupportsThinkingUI`/`availableLevels`, nên UI và backend mâu thuẫn nhau.
- **Yêu cầu** (chọn một, ghi rõ trong plan):
  - **(Khuyến nghị)** Giữ nhánh Gemini 2.5 `{ thinkingBudget: -1, includeThoughts: true }` (hợp lệ theo E4/E6), chỉ đảm bảo bất biến mutual-exclusion và thêm test cho nhánh này; HOẶC
  - Chủ động bỏ thinking cho 2.5 → khi đó phải sửa `useThinkingLevel.ts` (`modelSupportsThinkingUI`, `availableLevels`), cập nhật test `useThinkingLevel.test.ts`, và ghi rõ đây là thay đổi hành vi người dùng trong CHANGELOG.

**[MAJOR-3] Thiếu control cho rủi ro "level không được model hỗ trợ" (Evidence Bar 4.5.4 — rủi ro Trung bình không có control đã xác minh).**

- Risk table hàng 1 chỉ dựa vào `modelSupportsThinking` (cấp họ model), không kiểm tra level cụ thể theo model (E7). Phía client không clamp (E11).
- **Yêu cầu**: Thêm hàm thuần trong `src/lib/core/modelRegistry.ts` (ví dụ `getSupportedGeminiThinkingLevels(modelId)` hoặc field dữ liệu trong `SELECTABLE_MODELS`) làm single source of truth; trong `gemini-stream.ts` clamp level không hợp lệ xuống level hỗ trợ gần nhất (server-side, vì client có thể gửi bất kỳ giá trị nào qua Zod enum). Nên cho `useThinkingLevel` dùng chung nguồn dữ liệu này thay vì `isGemini3FlashModel` hardcode. Kèm test cho hàm mới trong `modelRegistry.test.ts`.

**[MAJOR-4] Test Contract chưa đủ để chứng minh các bất biến.**

- E12: mock `modelSupportsThinking: () => true` hằng số → Bước 6 phải đổi sang `vi.fn()` cấu hình theo từng test; hiện plan không đề cập.
- Thiếu test case: (a) nhánh Gemini 2.5 (theo phương án MAJOR-2) và assert `thinkingLevel` + `thinkingBudget` không bao giờ cùng tồn tại; (b) clamp level không hỗ trợ (MAJOR-3); (c) continuation call (`generateContentStream` lần 2 khi có `functionCall`) cũng không chứa `temperature/topP/topK`.
- E13: `autoTitleEngine.test.ts` và `fileProcessors.test.ts` phải ghi rõ chiến lược `vi.mock("@/lib/core/genaiClient", () => ({ getGenAIClient: () => mockAi }))`, nếu không test sẽ chạm env validation thật.
- Contract §7.2 dùng `mock.calls[0][0]`: với test fallback (primary throw → fallback), cần assert trên **mọi** call (`mock.calls.every(...)`) để chứng minh fallback model cũng không nhận `temperature`.

**[MINOR-1]** Goal §1.4 nhắc tinh chỉnh `ThinkingLevelSelector.tsx` nhưng file này không có trong mục 5 / không có bước nào — đồng bộ lại hoặc bỏ khỏi Goal.

**[MINOR-2]** §8.1 Tier 2 dùng `npm run type-check; npm run lint; npm run test:run` — với `;` exit code của các lệnh trước bị nuốt. Dùng `npm run verify` (`package.json:25`, chuỗi `&&` chạy trong npm shell nên tương thích PowerShell 5.1).

**[MINOR-3]** (Domain — Reasoning Token Truncation) `autoTitleEngine` gọi `gemini-3-flash-preview` với `maxOutputTokens: 15/20` trong khi Gemini 3 mặc định thinking "high" (E7); thought tokens có thể chiếm budget → title rỗng → rơi về fallback. Cân nhắc truyền `thinkingConfig: { thinkingLevel: "minimal" }` chỉ cho PRIMARY_MODEL (không gửi cho FALLBACK `gemini-2.5-flash`). Không chặn plan.

**[MINOR-4]** Continuation call (`gemini-stream.ts:419-431`) thiếu `abortSignal: params.abortSignal` — lỗi có sẵn, nhưng Bước 1 không nên "xác nhận" danh sách field loại trừ nó. Đề xuất bổ sung `abortSignal` (1 dòng, cùng file đang sửa).

**[MINOR-5]** Snippet "Sau" ở Bước 1 dùng `thinkingLevel as "minimal" | "low" | "medium" | "high"` — không cần thiết: sau guard `thinkingLevel && thinkingLevel !== "off"`, TypeScript đã tự narrow union. Bỏ type assertion; nên định nghĩa type alias `GeminiThinkingLevel` dùng chung cho `types.ts` và `gemini-stream.ts` thay vì lặp literal union.

**[MINOR-6]** §8.3 Negative Probe chỉ mô tả kết quả kỳ vọng, chưa phải bước thực thi. Khuyến nghị ghi lệnh cụ thể (ví dụ tạm thêm `temperature: 0.7` vào config, chạy `npm run type-check` xác nhận `TS2353` + exit ≠ 0, rồi revert). Lưu ý guard này chỉ áp dụng cho `gemini-stream.ts`; `autoTitleEngine.ts`/`fileProcessors.ts` dùng type SDK thật (E5) nên chỉ được bảo vệ bởi unit test.

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 4 lỗi `[MAJOR]`. Việc cần làm cho Revision 2:

1. Sửa tiền đề & dẫn chứng (MAJOR-1) theo E4–E6.
2. Quyết định và ghi rõ phương án Gemini 2.5 (MAJOR-2); khuyến nghị giữ nhánh `thinkingBudget: -1` với bất biến mutual-exclusion.
3. Thêm control clamp level theo model trong `lib/core/modelRegistry.ts` + áp dụng server-side (MAJOR-3).
4. Bổ sung Test Contract: mock `vi.fn()` cho `modelSupportsThinking`, test nhánh 2.5, test clamp, test continuation call, mock `genaiClient`, assert mọi call trong fallback (MAJOR-4).
5. Xử lý các MINOR nếu thuận tiện (không bắt buộc để approve).

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-08
- **Đối tượng**: Technical Plan Revision 2 (v2 — "Incorporating Audit Run 1 Feedback")

#### Kiểm chứng lỗi cũ (so với Audit Run 1)

| Lỗi Run 1                                 | Trạng thái            | Nhận định                                                                                                                                            |
| :---------------------------------------- | :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-1 (tiền đề "deprecated / 400")      | ✅ Đã khắc phục       | §1.1, §1.4, §4 mô tả đúng: `thinking_budget` vẫn hỗ trợ, chỉ cấm gửi đồng thời; bỏ `temperature` là theo khuyến nghị (looping khi < 1.0).            |
| MAJOR-2 (regression Gemini 2.5)           | ✅ Đã khắc phục       | Giữ nhánh `{ thinkingBudget: -1, includeThoughts: true }` (Bước 4), có test case 2 + contract §7.1 TH2.                                              |
| MAJOR-3 (thiếu control clamp level)       | ⚠️ Khắc phục một phần | Đã thêm `getSupportedGeminiThinkingLevels` / `clampGeminiThinkingLevel` server-side. Nhưng tầng UI vẫn không dùng chung nguồn dữ liệu (xem MAJOR-B). |
| MAJOR-4 (Test Contract)                   | ⚠️ Khắc phục một phần | Đã thêm `vi.fn()`, test 2.5, clamp, continuation, mock `genaiClient`, `mock.calls.every`. Còn thiếu wiring mock cho hàm mới (xem MAJOR-C).           |
| MINOR-1 (`ThinkingLevelSelector.tsx`)     | ❌ Xử lý sai          | Plan nay khẳng định selector "tiêu thụ `availableLevels`" — sai so với source (MAJOR-B).                                                             |
| MINOR-2 (`;` nuốt exit code)              | ✅                    | §8.1 dùng `npm run verify`.                                                                                                                          |
| MINOR-3 (reasoning truncation auto-title) | ⚠️                    | Đã đưa vào Bước 5, nhưng snippet không compile (MAJOR-A).                                                                                            |
| MINOR-4 (`abortSignal` continuation)      | ✅                    | Bước 4 bổ sung `abortSignal: params.abortSignal`.                                                                                                    |
| MINOR-5 (type alias dùng chung)           | ✅                    | `GeminiThinkingLevel` export từ `modelRegistry.ts`, dùng cho `types.ts`/`gemini-stream.ts`.                                                          |
| MINOR-6 (Negative Probe thực thi được)    | ✅                    | §8.3 có các bước cụ thể + revert.                                                                                                                    |

#### Bằng chứng đã thu thập

| #   | Loại    | Bằng chứng                                                                                                                                                                                                                                                                            | Kết quả                                                                                                                                                                                                                                                                                   |
| :-- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `[CMD]` | `npm run type-check`                                                                                                                                                                                                                                                                  | Exit 0 (baseline sạch).                                                                                                                                                                                                                                                                   |
| R2  | `[CMD]` | `npx vitest run`                                                                                                                                                                                                                                                                      | Exit 0 — 89 files / 975 tests passed.                                                                                                                                                                                                                                                     |
| R3  | `[CMD]` | Probe: tạm tạo `src/__probe_thinking__.ts` chứa nguyên văn snippet Bước 5 (`ai.models.generateContent({ config: { maxOutputTokens: 15, ...(isGemini3 ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}) } })` với `ai: GoogleGenAI`), chạy `npx tsc --noEmit`, sau đó xóa probe | **Exit 2** — `TS2322: Type '"minimal"' is not assignable to type 'ThinkingLevel or undefined'. Did you mean 'ThinkingLevel.MINIMAL'?`                                                                                                                                                     |
| R4  | `[SRC]` | `node_modules/@google/genai/dist/genai.d.ts:12171-12205`                                                                                                                                                                                                                              | `ThinkingConfig.thinkingLevel?: ThinkingLevel` là **enum** (`MINIMAL/LOW/MEDIUM/HIGH`); kiểu literal lowercase `ThinkingLevel_2` chỉ là alias nội bộ, không gắn vào `ThinkingConfig`. `autoTitleEngine.ts` dùng client `GoogleGenAI` thật (`genaiClient.ts:6,17`) nên chịu kiểu enum này. |
| R5  | `[SRC]` | `src/app/features/chat/components/ThinkingLevelSelector.tsx:12-16, 36, 41-69, 71`                                                                                                                                                                                                     | Selector **không** nhận prop `availableLevels`; tự dựng options từ `isGemini3FlashModel(currentModel)` → Flash: off/minimal/low/medium/high; mọi model khác: off/low/high. Dòng 71: level không có trong options → hiển thị `options[0]` ("OFF").                                         |
| R6  | `[SRC]` | `ChatApp.tsx:411-414`                                                                                                                                                                                                                                                                 | `availableLevels` của hook chỉ dùng cho `getLowerThinkingLevel` (regenerate với level thấp hơn), không truyền xuống selector.                                                                                                                                                             |
| R7  | `[SRC]` | `gemini-stream.test.ts:5-9`                                                                                                                                                                                                                                                           | `vi.mock("@/lib/core/modelRegistry", () => ({ getModelMaxOutputTokens, modelSupportsThinking, normalizeModelForApi }))` — factory không export `clampGeminiThinkingLevel`.                                                                                                                |
| R8  | `[SRC]` | `modelRegistry.ts` (`MODEL_ALIASES`)                                                                                                                                                                                                                                                  | `"gemini-3-pro-preview"` → alias sang `"gemini-3.1-pro-preview"`; nhánh `normalized === "gemini-3-pro-preview"` trong `getSupportedGeminiThinkingLevels` là dead code (vô hại).                                                                                                           |
| R9  | `[URL]` | https://ai.google.dev/gemini-api/docs/gemini-3                                                                                                                                                                                                                                        | Gemini 3.1 Flash-Lite hỗ trợ `minimal` (default)/`low`/`medium`/`high` → giả định §3.1.2 đúng. _"Note, `minimal` does not guarantee that thinking is off."_                                                                                                                               |
| R10 | `[URL]` | https://ai.google.dev/gemini-api/docs/thinking                                                                                                                                                                                                                                        | _"`max_output_tokens` applies to the combined total of thinking tokens and output tokens, setting a low limit can truncate responses."_ — xác nhận rủi ro auto-title là thật.                                                                                                             |
| R11 | `[SRC]` | `validators.ts:13`, `gemini-stream.ts:136-146, 181-202, 419-431`, `fileProcessors.ts:5-6, 608-613`, `autoTitleEngine.ts:13-21, 103-120, 145, 174`, `types.ts:113-123`                                                                                                                 | Line refs của plan chính xác; `types.ts` hiện có `temperature?: number` → sau khi xóa, negative probe §8.3 (excess property check trên object literal) sẽ cho `TS2353` như mô tả.                                                                                                         |

#### Mental Simulation Matrix (S1–S6)

| Kịch Bản                               | Kết quả            | Bằng chứng                                         | Nhận định                                                                                                                                                                                                                 |
| :------------------------------------- | :----------------- | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**             | **FAIL**           | `[CMD]` R1, R2, R3                                 | Baseline sạch, không thêm dependency, không Prisma/Better Auth. Nhưng snippet Bước 5 **không qua được `npm run type-check`** (R3) → Tier 1 sẽ đỏ ngay khi triển khai.                                                     |
| **S2: Lifecycle & Abort**              | PASS               | `[SRC]` R11 (`gemini-stream.ts:201, 234, 419-431`) | Abort chính giữ nguyên; continuation call được bổ sung `abortSignal`, có test case 5 xác nhận.                                                                                                                            |
| **S3: Database & Temporal**            | PASS (N/A)         | `[SRC]` mục 5 không có migration                   | Không chạm schema/RLS/thời gian.                                                                                                                                                                                          |
| **S4: Cross-Task State Flow**          | **FAIL**           | `[SRC]` R5, R6; `[ADV]` timeline dưới              | UI selector và hook dùng hai nguồn dữ liệu khác nhau → dropdown, `availableLevels` và payload server lệch nhau.                                                                                                           |
| **S5: Security & Auth**                | PASS               | `[SRC]` `validators.ts:13`                         | Không chạm auth/rate-limit; Zod enum giữ nguyên; server clamp không tin input client.                                                                                                                                     |
| **S6: External Resilience**            | PASS (kèm MINOR)   | `[SRC]` R4, R8; `[URL]` R9, R10                    | Mutual exclusion bảo đảm bằng if/else-if; clamp server-side chặn 400 do level không hỗ trợ. `minimal` không đảm bảo tắt thinking (R9) → auto-title vẫn có thể rỗng nhưng đã có fallback `titleFromUserMessage` (MINOR-C). |
| **Domain: Gemini Thinking & Sampling** | PASS (kèm MAJOR-A) | R3, R4, R9, R10                                    | Nội dung kỹ thuật đúng; lỗi nằm ở kiểu SDK (MAJOR-A).                                                                                                                                                                     |

**Adversarial Timeline (Reviewer)**

```
Cơ chế: UI selector lệch với hook availableLevels + server clamp
T1: User ở gemini-3-flash-preview chọn "minimal" → localStorage "vikini.thinkingLevel" = "minimal".
T2: User chuyển sang gemini-3.1-pro-preview. ThinkingLevelSelector (isGemini3FlashModel=false) dựng options off/low/high;
    "minimal" không có trong options → dòng 71 hiển thị "THINKING: OFF".
T3: User gửi tin nhắn. Client gửi thinkingLevel="minimal"; server clamp → "low" → thinkingConfig { thinkingLevel: "low", includeThoughts: true }.
Kết cục: HTTP 200 (clamp hoạt động) NHƯNG UI báo OFF trong khi model đang suy luận và trả <think> block;
         đồng thời hook (plan Bước 2) trả availableLevels = off/low/medium/high cho 3.1 Pro còn dropdown không có "medium"
         → "single source of truth" không đạt → LỖI (MAJOR).

Cơ chế: Auto-title type-check
T1: Developer dán snippet Bước 5 vào autoTitleEngine.ts.
T2: npm run type-check.
Kết cục: TS2322 '"minimal"' not assignable to 'ThinkingLevel' (R3) → Tier 1/Tier 2 fail → LỖI (MAJOR).
```

#### Phân loại lỗi

**[MAJOR-A] Snippet Bước 5 (`autoTitleEngine.ts`) không compile với SDK `@google/genai@2.10.0`.**

- `[CMD]` R3 + `[SRC]` R4: `thinkingConfig: { thinkingLevel: "minimal" }` → `TS2322`. Khác với `gemini-stream.ts` (đi qua kiểu nội bộ `ChatStreamParams` + cast `unknown`, Run 1 E15), `autoTitleEngine.ts` gọi trực tiếp client `GoogleGenAI` có kiểu enum.
- **Yêu cầu**: Dùng `import { ThinkingLevel } from "@google/genai"` và `thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }` (hoặc phương án tương đương đã qua type-check). Cập nhật Contract §7.2 / test Bước 9 cho khớp giá trị gửi đi (`ThinkingLevel.MINIMAL` === `"MINIMAL"`, KHÔNG phải `"minimal"` — assertion `toEqual({ thinkingLevel: "minimal" })` sẽ fail). Bổ sung assertion rằng call fallback (`gemini-2.5-flash`) **không** chứa `thinkingConfig`.

**[MAJOR-B] Khẳng định sai về `ThinkingLevelSelector.tsx` → Single Source of Truth không đạt, lệch trạng thái UI (S4; Evidence Bar 4.5.1).**

- Ghi chú mục 5 và §3.2 nói selector "tiêu thụ `availableLevels` từ `useThinkingLevel` mà không cần sửa JSX" — sai theo R5/R6. Hệ quả: (a) với `gemini-3.1-pro-preview`, hook trả `["off","low","medium","high"]` nhưng dropdown chỉ có off/low/high (không chọn được `medium` dù model hỗ trợ); (b) level đã lưu nhưng không hợp lệ cho model hiện tại hiển thị "OFF" trong khi server clamp và bật thinking (timeline trên).
- **Yêu cầu** (chọn một, ghi rõ trong plan):
  - **(Khuyến nghị)** Thêm `ThinkingLevelSelector.tsx` (và `ChatControls.tsx` nếu cần truyền prop) vào mục 5: selector nhận `availableLevels` (hoặc dùng `getSupportedGeminiThinkingLevels`) để dựng options; giữ nhánh DeepSeek/Claude hiện có. Đồng thời xử lý level đã lưu không hợp lệ cho model hiện tại phía client (hiển thị level đã clamp, hoặc clamp state khi đổi model) để UI phản ánh đúng thứ server gửi.
  - HOẶC thu hẹp phạm vi: giữ `availableLevels` của hook khớp với selector hiện tại, bỏ tuyên bố SSOT cho UI và ghi rõ đây là hạn chế đã biết.
- Kèm test: cập nhật `useThinkingLevel.test.ts` (đã tồn tại, hiện chỉ test `getLowerThinkingLevel`) với case `availableLevels` cho 3 Flash / 3.1 Pro / 2.5 / Claude / DeepSeek, hoặc trích logic dựng danh sách level thành hàm thuần có test.

**[MAJOR-C] Test Contract `gemini-stream.test.ts` chưa xử lý mock cho hàm mới.**

- R7: `vi.mock` factory hiện tại không export `clampGeminiThinkingLevel`; sau Bước 4, gemini-stream import hàm này → mọi test có `thinkingLevel` khác "off" sẽ ném lỗi "No export defined on the mock". Test case 3 (clamp `minimal`→`low`) chỉ có ý nghĩa nếu dùng implementation thật; nếu mock thì thành tautological (vi phạm S2 "không dùng mock tự pass").
- **Yêu cầu**: Ghi rõ chiến lược mock, ví dụ:
  `vi.mock("@/lib/core/modelRegistry", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/core/modelRegistry")>()), getModelMaxOutputTokens: () => 4096, modelSupportsThinking: vi.fn() }))` — giữ `clampGeminiThinkingLevel`/`normalizeModelForApi` thật. Lưu ý test abort hiện tại dùng model giả `"gemini-3.8-flash"` (không có trong `API_ALLOWED`) → nếu dùng `normalizeModelForApi` thật sẽ chuẩn hóa về `gemini-2.5-flash`; plan cần xác nhận test này vẫn pass hoặc đổi sang model ID thật.

**[MINOR-A]** Bước 1 vừa thêm field `supportedThinkingLevels` vào `SELECTABLE_MODELS`, vừa hardcode danh sách trong `getSupportedGeminiThinkingLevels` → hai nguồn dữ liệu. Nên cho hàm đọc field từ `SELECTABLE_MODELS` (fallback theo prefix cho model không selectable như `gemini-3-pro-image`), hoặc bỏ field. Nhánh `"gemini-3-pro-preview"` là dead code do alias (R8). Goal §1.3 ghi `gemini-3-pro-preview` = (low, high) nhưng hàm trả low/medium/high — đồng bộ lại mô tả.

**[MINOR-B]** `clampGeminiThinkingLevel`: nhánh `if (requestedLevel === "minimal") return "low"` thừa (đã được `supported[0]` bao phủ vì danh sách sắp tăng dần); `|| "low"` sau `supported[0]` không cần khi đã có guard `length === 0`. Với `"medium"` trên model chỉ hỗ trợ low/high, fallback `supported[0]` hạ xuống `low` thay vì level gần nhất — chấp nhận được nhưng nên ghi rõ chính sách "clamp về level thấp nhất được hỗ trợ".

**[MINOR-C]** R9: `minimal` _"does not guarantee that thinking is off"_ — với `maxOutputTokens: 15/20` vẫn có khả năng tiêu đề rỗng; hiện đã có fallback `titleFromUserMessage`. Cân nhắc tăng nhẹ `maxOutputTokens` cho PRIMARY_MODEL hoặc ghi nhận là rủi ro còn lại trong §9.

**[MINOR-D]** `getStreamTimeout(model, thinkingLevel)` (`gemini-stream.ts:163`) và log dòng 165 vẫn dùng level chưa clamp — nên dùng giá trị đã clamp để timeout/log nhất quán. Continuation call (dòng 419-431) cũng không mang `thinkingConfig`/`maxOutputTokens`/`safetySettings` — lỗi có sẵn, ngoài phạm vi, chỉ ghi nhận.

**[MINOR-E]** Mục 8.2 khai số lượng test (5/5/5/3) — nên khớp với danh sách case ở Bước 7–10 sau khi bổ sung các assertion yêu cầu ở trên.

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 3 lỗi `[MAJOR]`. Việc cần làm cho Revision 3:

1. Sửa snippet + Contract auto-title sang `ThinkingLevel.MINIMAL` (enum SDK), xác nhận bằng `npm run type-check`; assert fallback call không có `thinkingConfig` (MAJOR-A).
2. Xử lý `ThinkingLevelSelector.tsx`: đưa vào phạm vi và dùng chung nguồn level, hoặc rút lại tuyên bố SSOT; bổ sung test `availableLevels` trong `useThinkingLevel.test.ts` (MAJOR-B).
3. Ghi rõ chiến lược `vi.mock` dùng `importOriginal` để `clampGeminiThinkingLevel` chạy thật; xác nhận test abort hiện có vẫn pass (MAJOR-C).
4. Xử lý các MINOR nếu thuận tiện (không bắt buộc để approve).

### Audit Run 3

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-08
- **Đối tượng**: Technical Plan Revision 3 (v3 — "Comprehensive Revision Addressing Audit Run 2 Feedback")

#### Kiểm chứng lỗi cũ (so với Audit Run 2)

| Lỗi Run 2                                   | Trạng thái                                                | Nhận định                                                                                                                                                                                                                             |
| :------------------------------------------ | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------ |
| MAJOR-A (auto-title không compile)          | ✅ Đã khắc phục                                           | Bước 6 dùng `ThinkingLevel.MINIMAL`; probe T3 compile sạch với kiểu `GoogleGenAI` thật. Contract §7.2 assert `ThinkingLevel.MINIMAL` và assert fallback call không có `thinkingConfig`.                                               |
| MAJOR-B (`ThinkingLevelSelector` / SSOT)    | ⚠️ Thiết kế đã khắc phục, nhưng snippet mới không compile | Selector đã vào mục 5, dựng options từ `getSupportedGeminiThinkingLevels`, hiển thị `effectiveLevel`; hook clamp state khi đổi model; bổ sung test `getAvailableThinkingLevels`. Tuy nhiên Bước 3 import sai module (xem MAJOR-R3-1). |
| MAJOR-C (mock `clampGeminiThinkingLevel`)   | ✅ Đã khắc phục                                           | Bước 8 dùng `importOriginal`, giữ hàm thật; test abort đổi sang `gemini-3-flash-preview` (có trong `API_ALLOWED`, T6).                                                                                                                |
| MINOR-A (2 nguồn dữ liệu)                   | ✅                                                        | Hàm đọc từ `SELECTABLE_MODELS`; Goal §1.3 không còn nhắc `gemini-3-pro-preview`.                                                                                                                                                      |
| MINOR-B (nhánh clamp thừa)                  | ✅ (còn `                                                 |                                                                                                                                                                                                                                       | "low"` vô hại) | Chính sách "kẹp về `supported[0]`" đã ghi rõ ở §3.1.3. |
| MINOR-C (`minimal` không tắt hẳn thinking)  | ⚠️ Chấp nhận                                              | Rủi ro còn lại được bao bởi fallback `titleFromUserMessage` (§9 hàng 4).                                                                                                                                                              |
| MINOR-D (timeout/log dùng level chưa clamp) | ✅                                                        | Bước 5 dùng `effectiveThinkingLevel`.                                                                                                                                                                                                 |
| MINOR-E (số lượng test)                     | ✅                                                        | §8.2 khớp Bước 8–12; `useThinkingLevel.test.ts` hiện có đúng 7 case (T5).                                                                                                                                                             |

#### Bằng chứng đã thu thập

| #   | Loại    | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                             | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                       |
| :-- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | `[CMD]` | `npm run type-check`                                                                                                                                                                                                                                                                                                                                                                                   | Exit 0 (baseline sạch).                                                                                                                                                                                                                                                                                                                                                                                       |
| T2  | `[CMD]` | `npx vitest run`                                                                                                                                                                                                                                                                                                                                                                                       | Exit 0 — 89 files / 975 tests passed.                                                                                                                                                                                                                                                                                                                                                                         |
| T3  | `[CMD]` | Probe tạm `src/__probe_r3b__.ts` tái hiện snippet Bước 1 (`getSupportedGeminiThinkingLevels`/`clampGeminiThinkingLevel`, field `readonly` trong mảng `as const`), Bước 2 (`getAvailableThinkingLevels`), Bước 5 (nhánh `thinkingConfig` + `effectiveThinkingLevel`), Bước 6 (`generateContent` với `ThinkingLevel.MINIMAL` trên client `getGenAIClient()` thật) → `npx tsc --noEmit`, sau đó xóa probe | **Exit 0** — không lỗi kiểu.                                                                                                                                                                                                                                                                                                                                                                                  |
| T4  | `[CMD]` | `npx tsx` chạy probe T3                                                                                                                                                                                                                                                                                                                                                                                | `clamp("gemini-3.1-pro-preview","minimal")="low"`; `clamp("gemini-3-flash-preview","minimal")="minimal"`; alias `gemini-3-pro-preview` → `"low"`; `getAvailableThinkingLevels("gemini-3.1-pro-preview")=["off","low","medium","high"]`; `("gemini-2.5-flash")=["off","low","high"]`; cấu hình Bước 5 cho Pro + `"minimal"` = `{thinkingLevel:"low",includeThoughts:true}` — khớp Contract §7.1 TH3 và Bước 9. |
| T5  | `[CMD]` | `grep -c "it(" useThinkingLevel.test.ts gemini-stream.test.ts`                                                                                                                                                                                                                                                                                                                                         | 7 và 1 — khớp §8.2 (7+5, 1+5).                                                                                                                                                                                                                                                                                                                                                                                |
| T6  | `[SRC]` | `src/lib/core/modelRegistry.ts:265-299, 336-353, 377-381`                                                                                                                                                                                                                                                                                                                                              | `API_ALLOWED` có `gemini-3-flash-preview`; `normalizeModelForApi` map ID lạ (vd. `gemini-3.8-flash`) về `DEFAULT_MODEL`; `modelSupportsThinking` dùng prefix `gemini-3`. **Không có export `isGemini3Model`.**                                                                                                                                                                                                |
| T7  | `[CMD]` | Probe tạm `src/__probe_r3__.ts`: `import { isGemini3Model } from "@/lib/core/modelRegistry"` → `npx tsc --noEmit`, sau đó xóa probe                                                                                                                                                                                                                                                                    | **Exit 2** — `TS2305: Module '"@/lib/core/modelRegistry"' has no exported member 'isGemini3Model'.`                                                                                                                                                                                                                                                                                                           |
| T8  | `[SRC]` | `useThinkingLevel.ts:19, 41`; `streaming/utils.ts:154`                                                                                                                                                                                                                                                                                                                                                 | `isGemini3Model` chỉ tồn tại ở hook (`includes("gemini-3")`) và `streaming/utils.ts` (danh sách ID, server-side). `isClaudeThinkingModel` export từ hook.                                                                                                                                                                                                                                                     |
| T9  | `[SRC]` | `ThinkingLevelSelector.tsx:12-16, 36-37, 41-71, 95, 99`                                                                                                                                                                                                                                                                                                                                                | Selector hiện chỉ import `isGemini3FlashModel`, `isDeepSeekV4Model`; **không có biến `isClaudeModel`** và không có nhánh Claude (Claude hiện thấy off/low/high). Highlight/check mark (dòng 95, 99) so với `thinkingLevel` gốc, không phải `currentOption`.                                                                                                                                                   |
| T10 | `[SRC]` | `gemini-stream.ts:2-6, 129-146, 163-166, 419-431`; `types.ts:107-123`                                                                                                                                                                                                                                                                                                                                  | Line refs Bước 4/5 chính xác; continuation call hiện thiếu `abortSignal`; `types.ts:115` có `temperature?: number`.                                                                                                                                                                                                                                                                                           |
| T11 | `[SRC]` | `autoTitleEngine.ts:4-21, 103-120, 145, 174`; `fileProcessors.ts:5-8, 516-525, 603-614`                                                                                                                                                                                                                                                                                                                | Line refs chính xác; cả hai lấy client qua `getGenAIClient` → chiến lược `vi.mock("@/lib/core/genaiClient")` hợp lệ. `fileProcessors` còn dùng `pickFirstEnv` (`@/lib/utils/config`) — đọc `process.env` lúc gọi hàm, không có side-effect khi import.                                                                                                                                                        |
| T12 | `[CMD]` | `grep -rn temperature src`                                                                                                                                                                                                                                                                                                                                                                             | Ngoài Anthropic/OpenAI/DeepSeek (giữ nguyên), chỉ còn đúng các vị trí Gemini mà plan xóa (`types.ts:115`, `autoTitleEngine.ts:19,115,145,174`, `fileProcessors.ts:610`). Phạm vi xóa đầy đủ.                                                                                                                                                                                                                  |
| T13 | `[SRC]` | `eslint.config.mjs`; `package.json:13,17,25,96`                                                                                                                                                                                                                                                                                                                                                        | `no-explicit-any: error`, `no-console: error`; `eslint-plugin-react-hooks@7.0.1` đã cài nhưng **không** được wire vào config → effect gọi `setState` ở Bước 2 không bị lint chặn. Probe `catch {}` qua `npx eslint --stdin` → exit 0.                                                                                                                                                                         |

#### Mental Simulation Matrix (S1–S6)

| Kịch Bản                               | Kết quả          | Bằng chứng                                        | Nhận định                                                                                                                                                                                                                                                                                                   |
| :------------------------------------- | :--------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**             | **FAIL**         | `[CMD]` T1, T3, T7; `[SRC]` T6, T8, T9            | Baseline sạch, không thêm dependency, không Prisma/Better Auth. Snippet Bước 1/2/5/6 compile (T3). Nhưng Bước 3 import `isGemini3Model` từ `@/lib/core/modelRegistry` → `TS2305` (T7) và dùng `isClaudeModel` chưa khai báo → Tier 1 đỏ. Tuyên bố §10 "S1 PASS … giải quyết 100% lỗi type-check" chưa đúng. |
| **S2: Lifecycle & Abort**              | PASS             | `[SRC]` T10                                       | Continuation call được bổ sung `abortSignal`; test case 5 assert điều này. Mock không tautological: `clampGeminiThinkingLevel`/`normalizeModelForApi` chạy thật (Bước 8).                                                                                                                                   |
| **S3: Database & Temporal**            | PASS (N/A)       | `[SRC]` mục 5                                     | Không migration, không chạm RLS/thời gian.                                                                                                                                                                                                                                                                  |
| **S4: Cross-Task State Flow**          | PASS (kèm MINOR) | `[CMD]` T4; `[SRC]` T8, T9; `[ADV]` timeline dưới | Hook, selector và server dùng chung `getSupportedGeminiThinkingLevels` + `clampGeminiThinkingLevel`; T4 xác nhận Pro có `medium`, `minimal` → `low` thống nhất cả client lẫn server. Xem MINOR-R3-2/3.                                                                                                      |
| **S5: Security & Auth**                | PASS             | `[SRC]` `validators.ts:13`                        | Không chạm auth/rate-limit/route; Zod enum giữ nguyên; server không tin input client (clamp server-side).                                                                                                                                                                                                   |
| **S6: External Resilience**            | PASS             | `[CMD]` T4; `[SRC]` T10, T11                      | Mutual exclusion bằng if/else-if (`thinkingLevel` chỉ ở nhánh Gemini 3+, `thinkingBudget` chỉ ở nhánh 2.5); level không hỗ trợ bị clamp trước khi gọi API; auto-title có fallback model + fallback title.                                                                                                   |
| **Domain: Gemini Thinking & Sampling** | PASS             | `[CMD]` T3, T4, T12                               | Phạm vi xóa `temperature` đầy đủ và cô lập khỏi provider khác; reasoning-token guard cho auto-title dùng đúng enum SDK.                                                                                                                                                                                     |

**Adversarial Timeline (Reviewer)**

```
Cơ chế: Chuyển model Flash → Pro với level "minimal" (giả định đã sửa import Bước 3)
T1: User ở gemini-3-flash-preview chọn "minimal" → state + localStorage = "minimal".
T2: User chuyển sang gemini-3.1-pro-preview. Render đầu: selector tính effectiveLevel = clamp(pro, "minimal") = "low" → nhãn "THINKING: LOW";
    dropdown = off/low/medium/high (T4). Sau commit, effect Bước 2 clamp state → "low", ghi localStorage = "low".
T3: User gửi tin. useChatStreamController đọc localStorage "low"; server clamp("low") = "low" → thinkingConfig { thinkingLevel: "low", includeThoughts: true }.
Kết cục: UI, state, localStorage và payload khớp nhau; HTTP 200 → AN TOÀN.
         (Phụ: chuyển ngược về Flash vẫn giữ "low" — lựa chọn "minimal" bị ghi đè, xem MINOR-R3-2.)

Cơ chế: Đồng thời — 2 tab cùng mở, tab A ở Flash/"minimal", tab B đổi sang Pro
T1: Tab B effect ghi localStorage = "low". | T2: Tab A gửi tin (đọc localStorage) → "low" trên Flash.
Kết cục: Tab A gửi "low" thay vì "minimal" trong khi UI tab A vẫn hiển thị MINIMAL. Hành vi sẵn có (localStorage dùng chung,
         không lắng nghe sự kiện `storage`), không gây lỗi API → AN TOÀN, chỉ lệch hiển thị (ngoài phạm vi).

Cơ chế: Build — Bước 3 dán nguyên văn
T1: Developer dán import `{ getSupportedGeminiThinkingLevels, clampGeminiThinkingLevel, isGemini3Model } from "@/lib/core/modelRegistry"`.
T2: npm run type-check.
Kết cục: TS2305 (T7) + "Cannot find name 'isClaudeModel'" → Tier 1/Tier 2 đỏ → LỖI (MAJOR).
```

**Trục đối kháng (Evidence Bar 4.5.2)**: (1) Đồng thời — timeline 2 tab ở trên. (2) TOCTOU — level đổi giữa lúc UI render và lúc gửi: server luôn clamp lại theo `model` của request → an toàn. (3) Thất bại giữa chừng — abort trong continuation call nay được ngắt bằng `abortSignal` (T10). (4) Serverless — các hàm mới là hàm thuần, không có state in-memory giữa các instance → N/A.

#### Phân loại lỗi

**[MAJOR-R3-1] Snippet Bước 3 (`ThinkingLevelSelector.tsx`) không compile (S1).**

- `[CMD]` T7 + `[SRC]` T6/T8: `isGemini3Model` không được export từ `@/lib/core/modelRegistry` → `TS2305`. Snippet còn dùng `isClaudeModel` nhưng không có bước khai báo (T9: selector hiện không có biến này).
- **Yêu cầu** (chỉ cần sửa văn bản Bước 3):
  - Import `getSupportedGeminiThinkingLevels`, `clampGeminiThinkingLevel` từ `@/lib/core/modelRegistry`; import `isGemini3Model`, `isClaudeThinkingModel` (cùng `isDeepSeekV4Model`, `type ThinkingLevel`) từ `./hooks/useThinkingLevel`; bỏ import `isGemini3FlashModel` nếu không còn dùng (tránh `@typescript-eslint/no-unused-vars`).
  - Khai báo `const isClaudeModel = isClaudeThinkingModel(currentModel);`.
  - Xác nhận bằng `npm run type-check` (exit 0) trong Verification.

**[MINOR-R3-1]** Nhánh Claude mới trong selector đổi UX từ off/low/high → off/high. Nhất quán với `availableLevels` của hook và `anthropic-stream.ts` (chỉ phân biệt bật/tắt), nhưng nên ghi rõ trong `docs/CHANGELOG.md` như một thay đổi hành vi người dùng.

**[MINOR-R3-2]** Effect Bước 2 ghi đè `localStorage` bằng level đã clamp → chuyển Pro → Flash sẽ mất lựa chọn `minimal` ban đầu. Vì selector đã hiển thị `effectiveLevel` và server tự clamp, có thể chỉ hiển thị mà không persist. Chấp nhận được nếu giữ — nên ghi chú là hành vi có chủ đích.

**[MINOR-R3-3]** Highlight/check mark trong dropdown (`ThinkingLevelSelector.tsx:95, 99`) vẫn so với `thinkingLevel` gốc; nên so với `effectiveLevel` để mục được tick khớp nhãn ngay ở render đầu (trước khi effect của hook đồng bộ state).

**[MINOR-R3-4]** Comment fallback trong `getSupportedGeminiThinkingLevels` ("biến thể preview chưa đăng ký") không đúng thực tế: `normalizeModelForApi` map mọi ID lạ về `DEFAULT_MODEL` (T6), nên nhánh prefix chỉ chạm tới ID có trong `API_ALLOWED` nhưng không selectable (`gemini-3-pro-image`). Ngoài ra hook guard bằng `isGemini3Model` (`includes`) trong khi `getSupportedGeminiThinkingLevels` trả `[]` cho ID lạ → `clampGeminiThinkingLevel` trả `"low"` và hạ `"high"` → `"low"`. `coerceStoredModel` khiến tình huống này gần như không xảy ra; khuyến nghị guard effect bằng `getSupportedGeminiThinkingLevels(currentModel).length > 0`.

**[MINOR-R3-5]** `eslint-plugin-react-hooks@7.0.1` đã cài nhưng chưa wire (T13) → `react-hooks/exhaustive-deps` / `set-state-in-effect` không được enforce cho effect mới. Ngoài phạm vi plan, chỉ ghi nhận.

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 1 lỗi `[MAJOR]` (S1 FAIL). Thiết kế kỹ thuật (mutual exclusion, SSOT, clamp, test contract, sampling cleanup) đã đạt; chỉ còn lỗi import/khai báo trong snippet Bước 3. Việc cần làm cho Revision 4:

1. Sửa import và khai báo `isClaudeModel` trong Bước 3 theo MAJOR-R3-1; cập nhật §10 S1 cho đúng.
2. Xử lý các MINOR-R3-1 → R3-4 nếu thuận tiện (không bắt buộc để approve).

### Audit Run 4

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-08
- **Đối tượng**: Technical Plan Revision 4 (v4 — "Final Polish Addressing Audit Run 3 Feedback")

#### Kiểm chứng lỗi cũ (so với Audit Run 3)

| Lỗi Run 3                                 | Trạng thái      | Nhận định                                                                                                                                                                                                                                                                                              |
| :---------------------------------------- | :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-R3-1 (Bước 3 không compile)         | ✅ Đã khắc phục | Import `getSupportedGeminiThinkingLevels`/`clampGeminiThinkingLevel` từ `@/lib/core/modelRegistry`; `isGemini3Model`/`isDeepSeekV4Model`/`isClaudeThinkingModel`/`type ThinkingLevel` từ `./hooks/useThinkingLevel`; khai báo `isClaudeModel`; bỏ `isGemini3FlashModel`. Probe U1 compile + lint sạch. |
| MINOR-R3-1 (UX Claude off/high)           | ✅              | Bước 13 ghi nhận vào `docs/CHANGELOG.md`. Tuy nhiên chính thay đổi này mở ra lệch hiển thị mới — xem MAJOR-R4-1.                                                                                                                                                                                       |
| MINOR-R3-2 (persist level đã clamp)       | ✅              | Ghi chú "hành vi có chủ đích" dưới snippet Bước 2.                                                                                                                                                                                                                                                     |
| MINOR-R3-3 (checkmark so với level gốc)   | ✅              | JSX Bước 3 so sánh với `effectiveLevel`.                                                                                                                                                                                                                                                               |
| MINOR-R3-4 (guard effect)                 | ✅              | Effect Bước 2 guard bằng `getSupportedGeminiThinkingLevels(currentModel).length > 0`; comment fallback nêu đúng `gemini-3-pro-image`.                                                                                                                                                                  |
| MINOR-R3-5 (react-hooks plugin chưa wire) | —               | Ngoài phạm vi, giữ ghi nhận.                                                                                                                                                                                                                                                                           |

#### Bằng chứng đã thu thập

| #   | Loại    | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                      | Kết quả                                                                                                                                                                           |
| :-- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | `[CMD]` | Probe tạm `src/__probe_r4__/reg.ts` (nguyên văn `getSupportedGeminiThinkingLevels`/`clampGeminiThinkingLevel` Bước 1 trên `normalizeModelForApi` thật) + `src/__probe_r4__/Sel.tsx` (nguyên văn import, `options`, `effectiveLevel`, `currentOption`, JSX `DropdownMenuItem` Bước 3, import từ `useThinkingLevel` thật) → `npx tsc --noEmit` và `npx eslint src/__probe_r4__`, sau đó xóa probe | `TSC_EXIT=0`, `ESLINT_EXIT=0` — snippet Bước 3 compile và không có `no-unused-vars`.                                                                                              |
| U2  | `[CMD]` | `npx vitest run`                                                                                                                                                                                                                                                                                                                                                                                | Exit 0 — 89 files / 975 tests passed (baseline khớp §4).                                                                                                                          |
| U3  | `[CMD]` | `grep -c "it(" useThinkingLevel.test.ts gemini-stream.test.ts`                                                                                                                                                                                                                                                                                                                                  | 7 và 1 — khớp §8.2 (7+5, 1+5).                                                                                                                                                    |
| U4  | `[SRC]` | `gemini-stream.ts:132-146, 163-166, 419-431`                                                                                                                                                                                                                                                                                                                                                    | Line refs Bước 5 vẫn chính xác; continuation call hiện chưa có `abortSignal`.                                                                                                     |
| U5  | `[SRC]` | `ThinkingLevelSelector.tsx:47-71` (hiện tại)                                                                                                                                                                                                                                                                                                                                                    | Claude hiện rơi vào nhánh mặc định off/low/high → level `"low"` đã lưu hiển thị đúng "LOW".                                                                                       |
| U6  | `[SRC]` | `anthropic-stream.ts:214`                                                                                                                                                                                                                                                                                                                                                                       | `modelSupportsClaudeThinking(model) && thinkingLevel && thinkingLevel !== "off"` → mọi level khác `"off"` (kể cả `"low"`, `"medium"`, `"minimal"`) đều **bật** extended thinking. |
| U7  | `[SRC]` | `deepseek-request-builder.ts:39-75`; `gemini-stream.ts:140-143`                                                                                                                                                                                                                                                                                                                                 | DeepSeek: `"minimal"`/`"medium"` được map như `"low"` (bật thinking). Gemini 2.5: mọi level khác `"off"` → `thinkingBudget: -1` (bật thinking).                                   |
| U8  | `[SRC]` | `useChatStreamController.ts:661-684`                                                                                                                                                                                                                                                                                                                                                            | Payload gửi server đọc thẳng `localStorage` (không qua `effectiveLevel` của selector).                                                                                            |
| U9  | `[CMD]` | `grep -rn hasExtendedLevels src`                                                                                                                                                                                                                                                                                                                                                                | Chỉ còn dùng nội bộ `useThinkingLevel.ts:99` (vẫn dựa trên `isGemini3FlashModel`), không có consumer bên ngoài.                                                                   |

#### Mental Simulation Matrix (S1–S6)

| Kịch Bản                               | Kết quả    | Bằng chứng                              | Nhận định                                                                                                                                                                                                                                                                                                |
| :------------------------------------- | :--------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**             | PASS       | `[CMD]` U1, U2; Run 3 T3 (Bước 1/2/5/6) | Toàn bộ snippet Bước 1/2/3/5/6 đã được probe compile sạch; không thêm dependency; không Prisma/Better Auth; file `[NEW]` không bị import trước khi tạo.                                                                                                                                                  |
| **S2: Lifecycle & Abort**              | PASS       | `[SRC]` U4                              | Continuation call được bổ sung `abortSignal`; test case 5 assert điều này; mock `importOriginal` giữ hàm thật (không tautological).                                                                                                                                                                      |
| **S3: Database & Temporal**            | PASS (N/A) | `[SRC]` mục 5                           | Không migration, không chạm RLS/thời gian.                                                                                                                                                                                                                                                               |
| **S4: Cross-Task State Flow**          | **FAIL**   | `[SRC]` U5–U8; `[ADV]` timeline dưới    | Gemini 3 đã đồng bộ UI ↔ server. Nhưng nhánh Claude mới (off/high) không có cơ chế `effectiveLevel`/clamp tương ứng → level `"low"` đã lưu hiển thị "OFF" trong khi server bật thinking. Đây là regression do Bước 3 tạo ra (U5) và mâu thuẫn trực tiếp Goal §1.3 ("không bao giờ … hiển thị nhầm OFF"). |
| **S5: Security & Auth**                | PASS       | `[SRC]` `validators.ts:13`              | Không chạm auth/rate-limit/route; Zod enum giữ nguyên; server clamp không tin input client.                                                                                                                                                                                                              |
| **S6: External Resilience**            | PASS       | Run 3 T4; `[SRC]` U4                    | Mutual exclusion bằng if/else-if; level không hỗ trợ bị clamp trước khi gọi API; auto-title có fallback model + fallback title.                                                                                                                                                                          |
| **Domain: Gemini Thinking & Sampling** | PASS       | Run 3 T3, T4, T12                       | Phạm vi xóa `temperature` đầy đủ, cô lập khỏi provider khác; reasoning-token guard dùng đúng enum SDK.                                                                                                                                                                                                   |

**Adversarial Timeline (Reviewer)**

```
Cơ chế: Chuyển model sang Claude với level không thuộc options off/high
T1: User ở gemini-3.1-pro-preview (hoặc Claude trước khi nâng cấp) chọn "low" → state + localStorage = "low".
T2: User chuyển sang claude-sonnet-*. Effect Bước 2: getSupportedGeminiThinkingLevels(claude) = [] → không clamp, state giữ "low".
    Selector Bước 3: isGemini3 = false → effectiveLevel = "low"; options = [off, high] → currentOption = options[0]
    → nhãn "THINKING: OFF", checkmark không ở mục nào.
T3: User gửi tin. useChatStreamController đọc localStorage "low" (U8) → anthropic-stream: "low" !== "off"
    → bật extended thinking (U6), temperature = 1, budget_tokens.
Kết cục: UI báo OFF nhưng Claude suy luận (tốn token/latency, hiện <think> block) → lệch UI/server — cùng loại lỗi
         với MAJOR-B Run 2 → LỖI (MAJOR). Trước plan (U5) cùng kịch bản hiển thị "THINKING: LOW" → regression mới.
         Biến thể tồn tại sẵn (không do plan gây ra nhưng cùng gốc): Gemini 2.5 / DeepSeek với "minimal"/"medium"
         cũng hiển thị OFF trong khi server bật thinking (U7).

Cơ chế: Chuyển Flash → Pro với "minimal" (tái kiểm sau khi sửa Bước 3)
T1: Flash chọn "minimal". | T2: Đổi sang Pro → effectiveLevel = "low", nhãn LOW, checkmark LOW; effect persist "low".
T3: Gửi tin → server clamp("low") = "low" → { thinkingLevel: "low", includeThoughts: true }.
Kết cục: Khớp UI/state/payload, HTTP 200 → AN TOÀN.
```

**Trục đối kháng (Evidence Bar 4.5.2)**: (1) Đồng thời — 2 tab dùng chung `localStorage` (đã phân tích Run 3, chỉ lệch hiển thị, hành vi sẵn có). (2) TOCTOU — level đổi giữa render và gửi: server luôn clamp theo `model` của request → an toàn cho Gemini; với Claude/DeepSeek/2.5 server coi mọi level ≠ "off" là bật (U6, U7) → nguồn gốc MAJOR-R4-1. (3) Thất bại giữa chừng — continuation call nay có `abortSignal`. (4) Serverless — hàm mới là hàm thuần, không state in-memory → N/A.

#### Phân loại lỗi

**[MAJOR-R4-1] Nhánh Claude mới trong `ThinkingLevelSelector` gây lệch UI ↔ server cho level ngoài options (S4, sót edge case).**

- `[SRC]` U5, U6, U8 + timeline trên: `effectiveLevel` chỉ được tính cho Gemini 3; với Claude (options off/high), level `"low"`/`"medium"`/`"minimal"` đã lưu → nhãn "OFF" nhưng `anthropic-stream.ts:214` bật thinking. `"low"` trên Claude trước plan hiển thị đúng → regression do Bước 3, trái Goal §1.3.
- **Yêu cầu** (sửa văn bản Bước 2/3 + test, không cần đổi kiến trúc):
  - Trích một hàm thuần trong `useThinkingLevel.ts`, ví dụ `getEffectiveThinkingLevel(currentModel: string, level: ThinkingLevel): ThinkingLevel`: `"off"` → `"off"`; Gemini 3 có danh sách hỗ trợ → `clampGeminiThinkingLevel`; ngược lại nếu `level` thuộc `getAvailableThinkingLevels(currentModel)` → giữ nguyên; nếu không → map về level non-off tương ứng ngữ nghĩa server (Claude → `"high"`; DeepSeek → `"low"` theo U7; Gemini 2.5/mặc định → một level non-off có trong danh sách, ghi rõ lựa chọn).
  - Selector dùng hàm này cho `effectiveLevel` thay cho điều kiện `isGemini3 && …`; (khuyến nghị) effect Bước 2 dùng cùng hàm để persist, bỏ guard chỉ-Gemini-3 — khi đó cập nhật lại ghi chú dưới snippet.
  - Bổ sung test vào `useThinkingLevel.test.ts` (cập nhật số lượng §8.2): Claude + `"low"` → `"high"`; Gemini 3.1 Pro + `"minimal"` → `"low"`; Gemini 2.5 + `"medium"` → level non-off; mọi model + `"off"` → `"off"`.
  - Bổ sung kịch bản Gemini 3 → Claude vào Adversarial Timeline §10.

**[MINOR-R4-1]** `hasExtendedLevels` trong hook (U9) vẫn dựa trên `isGemini3FlashModel`, không có consumer bên ngoài — có thể suy ra từ `getSupportedGeminiThinkingLevels(...).includes("minimal")` hoặc để nguyên (không chặn).

**[MINOR-R4-2]** Trường `flashOnly?` trong `interface ThinkingOption` (`ThinkingLevelSelector.tsx:27`) thành dead field sau Bước 3 — có thể bỏ (không chặn).

**[MINOR-R4-3]** `return supported[0] || "low";` — `|| "low"` thừa sau guard `length === 0` (đã nêu Run 2 MINOR-B, vô hại).

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 1 lỗi `[MAJOR]` (S4 FAIL). Lỗi compile của Run 3 đã khắc phục và được xác minh (U1). Việc cần làm cho Revision 5:

1. Thêm hàm thuần `getEffectiveThinkingLevel` (hoặc tương đương) dùng chung cho selector + effect, phủ Claude/DeepSeek/Gemini 2.5, kèm test; cập nhật §8.2 và §10 (MAJOR-R4-1).
2. Xử lý MINOR-R4-1 → R4-3 nếu thuận tiện (không bắt buộc để approve).

### Audit Run 5

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-08
- **Đối tượng**: Technical Plan Revision 5 (v5 — "Cross-Model State Flow Harmonization Addressing Audit Run 4 Feedback")

#### Kiểm chứng lỗi cũ (so với Audit Run 4)

| Lỗi Run 4                                                      | Trạng thái                      | Nhận định                                                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------------------------------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MAJOR-R4-1 (Claude hiển thị OFF trong khi server bật thinking) | ✅ Đã khắc phục ở tầng hiển thị | `getEffectiveThinkingLevel` phủ Claude/DeepSeek/Gemini 2.5/Gemini 3; selector dùng `effectiveLevel` cho nhãn + checkmark; 6 test mới; timeline Gemini 3 → Claude đã bổ sung §10. Probe V2 xác nhận Claude `low/medium/minimal → high`. **Tuy nhiên** effect persist của Bước 2 (làm theo khuyến nghị "bỏ guard chỉ-Gemini-3" của Run 4) tạo ra regression mới — xem MAJOR-R5-1. |
| MINOR-R4-1 (`hasExtendedLevels`)                               | ✅                              | Suy ra từ `getSupportedGeminiThinkingLevels(...).includes("minimal")`.                                                                                                                                                                                                                                                                                                          |
| MINOR-R4-2 (`flashOnly?` dead field)                           | ✅                              | Bước 3 bỏ trường.                                                                                                                                                                                                                                                                                                                                                               |
| MINOR-R4-3 (`\|\| "low"` thừa)                                 | ✅                              | `return supported[0];` — compile sạch (`tsconfig` không bật `noUncheckedIndexedAccess`, probe V1).                                                                                                                                                                                                                                                                              |

#### Bằng chứng đã thu thập

| #   | Loại              | Bằng chứng                                                                                                                                                                                                                                                                                                             | Kết quả                                                                                                                                                                                                                                                                                                     |
| :-- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | `[CMD]`           | Probe tạm `src/__probe_r5__/{reg,eff,hook}.ts` (nguyên văn Bước 1 `getSupportedGeminiThinkingLevels`/`clampGeminiThinkingLevel`, Bước 2 `getAvailableThinkingLevels`/`getEffectiveThinkingLevel` và `useEffect`, import `useThinkingLevel` thật) → `npx tsc --noEmit`, `npx eslint src/__probe_r5__`; sau đó xóa probe | `TSC_EXIT=0`; **`ESLINT_EXIT=1`** — `hook.ts 14:17 error Empty block statement no-empty` (chính là `} catch {}` trong effect Bước 2).                                                                                                                                                                       |
| V2  | `[CMD]`           | `npx vitest run src/__probe_r5__/run.test.ts` — ma trận `getEffectiveThinkingLevel` × 9 model                                                                                                                                                                                                                          | 2.5-flash `minimal/low/medium→low, high→high`; 3-flash giữ nguyên; 3.1-pro `minimal→low`; claude-sonnet `*→high`; DeepSeek `minimal/low→low, medium/high→high`; llama-3.3 & claude-haiku `*→off`.                                                                                                           |
| V3  | `[CMD]`           | Cùng probe — mô phỏng state qua các lần render của effect                                                                                                                                                                                                                                                              | `stored="medium"`, render với `gemini-2.5-flash` rồi `gemini-3-flash-preview` → **state cuối `low`**; `state="high"`, chuyển `llama-3.3-70b-versatile` rồi về `gemini-3-flash-preview` → **state cuối `off`**.                                                                                              |
| V4  | `[SRC]`           | `ChatApp.tsx:148-158, 284, 411`                                                                                                                                                                                                                                                                                        | `landingModel` khởi tạo `DEFAULT_MODEL` (`gemini-2.5-flash`), restore từ `localStorage` trong effect; `currentModel = currentConversation?.model \|\| landingModel` → trước khi danh sách conversation (SWR) tải xong, `currentModel` tạm thời là landing model, không phải model của conversation đang mở. |
| V5  | `[SRC]`           | `ChatControls.tsx:211`; `ChatApp.tsx:411`                                                                                                                                                                                                                                                                              | Selector chỉ render khi `modelSupportsThinkingUI`; nhưng hook `useThinkingLevel` luôn chạy trong `ChatApp` với mọi model, kể cả model không thinking (llama, grok, gemma, claude-haiku…).                                                                                                                   |
| V6  | `[SRC]`           | `useChatStreamController.ts:661-685`                                                                                                                                                                                                                                                                                   | Payload gửi `thinkingLevel` đọc thẳng `localStorage`, không gửi `model` (server lấy model từ conversation).                                                                                                                                                                                                 |
| V7  | `[SRC]` + `[CMD]` | `deepseek-request-builder.ts:35-75`; probe V2 gọi `mapDeepSeekEffort` thật                                                                                                                                                                                                                                             | Server DeepSeek: `medium` luôn được xử lý **giống `low`** trên cả 3 nhánh (v4.1-flash `low`, v4-pro `high`, direct `high`); chỉ `high` lên bậc trên (`high`/`xhigh`/`max`).                                                                                                                                 |
| V8  | `[SRC]`           | `anthropic-stream.ts:214`; `gemini-stream.ts:140-143` (Run 4 U6/U7)                                                                                                                                                                                                                                                    | Claude và Gemini 2.5 coi mọi level ≠ `off` là bật thinking → server đã tự đúng ngữ nghĩa mà không cần client persist level đã chuẩn hóa.                                                                                                                                                                    |
| V9  | `[CMD]`           | `npx vitest run`                                                                                                                                                                                                                                                                                                       | Exit 0 — 89 files / 975 tests (baseline khớp §4). `grep -c "it("` → 7 và 1, khớp §8.2.                                                                                                                                                                                                                      |

#### Mental Simulation Matrix (S1–S6)

| Kịch Bản                               | Kết quả    | Bằng chứng                                       | Nhận định                                                                                                                                                                                                                                                                             |
| :------------------------------------- | :--------- | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**             | **FAIL**   | `[CMD]` V1                                       | Type-check sạch, nhưng snippet effect Bước 2 (`catch {}`) vi phạm `no-empty` ở mức `error` → `npm run lint` / `npm run verify` (Tier 2, §8.1) exit ≠ 0. Không thêm dependency, không Prisma/Better Auth, file `[NEW]` không bị import trước khi tạo.                                  |
| **S2: Lifecycle & Abort**              | PASS       | `[SRC]` Run 4 U4                                 | Continuation call có `abortSignal`; test case 5 Bước 8 assert; mock `importOriginal` không tautological.                                                                                                                                                                              |
| **S3: Database & Temporal**            | PASS (N/A) | `[SRC]` §5                                       | Không migration, không chạm RLS.                                                                                                                                                                                                                                                      |
| **S4: Cross-Task State Flow**          | **FAIL**   | `[CMD]` V3; `[SRC]` V4–V6; `[ADV]` timeline dưới | Hiển thị đã đồng bộ (MAJOR-R4-1 xong), nhưng effect Bước 2 **ghi đè có tính phá hủy** preference đã lưu dựa trên `currentModel` tạm thời/không-thinking → mất lựa chọn của người dùng, trái Goal §1.3 ("state … luôn được tự động chuẩn hóa … triệt tiêu 100% rủi ro state bị lệch"). |
| **S5: Security & Auth**                | PASS       | `[SRC]` `validators.ts:13`                       | Không chạm auth/rate-limit/route; Zod enum giữ nguyên; server clamp không tin input client.                                                                                                                                                                                           |
| **S6: External Resilience**            | PASS       | `[SRC]` V8; Run 3 T4                             | Mutual exclusion if/else-if; level không hỗ trợ bị clamp server-side trước khi gọi API; auto-title có fallback model + fallback title.                                                                                                                                                |
| **Domain: Gemini Thinking & Sampling** | PASS       | Run 3 T3/T4/T12; V2                              | Phạm vi xóa `temperature` đầy đủ và cô lập; enum SDK đúng; clamp Pro `minimal→low` đúng tài liệu.                                                                                                                                                                                     |

**Adversarial Timeline (Reviewer)**

```
Cơ chế A: Cold-start khi mở thẳng URL một conversation Gemini 3 Flash (preference "medium")
T1: Mount ChatApp. landingModel = DEFAULT_MODEL ("gemini-2.5-flash") hoặc model landing đã lưu; thinkingLevel = "off".
    Effect load (useThinkingLevel) → setState("medium"); effect chuẩn hóa cùng commit thấy "off" → bỏ qua.
T2: Render 2: thinkingLevel = "medium", conversations SWR CHƯA tải → currentModel = landingModel ("gemini-2.5-flash").
    Effect: getEffectiveThinkingLevel("gemini-2.5-flash","medium") = "low" → setState("low") + localStorage = "low".
T3: SWR tải xong → currentModel = "gemini-3-flash-preview". Effect: "low" hợp lệ → giữ "low".
Kết cục: Preference "medium" của người dùng bị xóa vĩnh viễn ở mỗi lần reload, không có tương tác nào → LỖI (MAJOR).
         Biến thể: landing model đã lưu là model không-thinking (llama/grok/claude-haiku) → T2 ghi "off" → mất hẳn thinking.

Cơ chế B: Ghé qua model không hỗ trợ thinking
T1: User ở gemini-3-flash-preview chọn "high". | T2: Đổi conversation/landing sang llama-3.3-70b-versatile
    (selector ẩn, hook vẫn chạy) → getEffectiveThinkingLevel = "off" → setState("off") + localStorage = "off".
T3: Quay lại gemini-3-flash-preview → state "off" (V3).
Kết cục: Trước plan preference được giữ nguyên qua model không-thinking; sau plan bị tắt ngầm → regression → LỖI (MAJOR).

Cơ chế C: Flash → Pro với "minimal" và Gemini 3 → Claude (tái kiểm MAJOR-R4-1)
Pro: effectiveLevel "low", nhãn/checkmark LOW, server clamp "low". Claude: effectiveLevel "high", server bật thinking.
Kết cục: Hiển thị ↔ server khớp → AN TOÀN.
```

**Trục đối kháng (Evidence Bar 4.5.2)**: (1) Đồng thời — 2 tab chung `localStorage`: với effect persist, tab mở Claude ghi "high" sẽ ghi đè preference "medium" mà tab Gemini 3 Flash vừa chọn (tab kia đọc lại khi reload) — cùng gốc MAJOR-R5-1. (2) TOCTOU — `currentModel` tại thời điểm effect chạy ≠ model của conversation thật (Cơ chế A) → nguồn gốc MAJOR-R5-1. Server luôn tự map theo model thật (V7, V8) nên không có HTTP 400. (3) Thất bại giữa chừng — `localStorage.setItem` ném (quota/private mode) được nuốt; nhưng khối nuốt rỗng vi phạm lint (MAJOR-R5-2). (4) Serverless — hàm thuần, không state in-memory → N/A.

#### Phân loại lỗi

**[MAJOR-R5-1] Effect Bước 2 persist level đã chuẩn hóa một cách phá hủy, dựa trên `currentModel` tạm thời hoặc không-thinking (S4, sót edge case, regression).**

- `[CMD]` V3 + `[SRC]` V4, V5 + Cơ chế A/B: preference bị ghi đè sang `low`/`high`/`off` mà người dùng không hề thao tác; ghé qua model không-thinking tắt thinking vĩnh viễn.
- Persist là **không cần thiết** để đạt đồng bộ UI ↔ server: server đã tự map đúng theo model thật (V7, V8: Gemini 3 clamp, Claude/Gemini 2.5 coi mọi level ≠ off là bật, DeepSeek coi `medium` = `low`).
- **Yêu cầu** (chỉ sửa văn bản Bước 2/3/9 + §10, không đổi kiến trúc):
  1. Bỏ `useEffect` chuẩn hóa-và-persist ở Bước 2. State/`localStorage` giữ nguyên lựa chọn thô của người dùng; `effectiveLevel` chỉ là giá trị dẫn xuất khi render (selector đã làm vậy ở Bước 3). Chỉ khi người dùng bấm chọn (`setThinkingLevel`) mới ghi `localStorage`.
  2. Căn `getEffectiveThinkingLevel` cho DeepSeek theo đúng server (V7): `minimal`/`low`/`medium → "low"`, `high → "high"` — để nhãn hiển thị phản ánh đúng effort server thực thi mà không cần persist. (Claude `→ high`, Gemini 2.5 `minimal/low/medium → low`, Gemini 3 clamp: giữ như hiện tại — đã khớp server.)
  3. (Khuyến nghị) `ChatApp.tsx:413` gọi `getLowerThinkingLevel(getEffectiveThinkingLevel(currentModel, thinkingLevel), availableLevels)` để fallback-degrade bắt đầu từ bậc hiệu lực.
  4. Cập nhật test Bước 9: DeepSeek `"medium" → "low"`; giữ case model không-thinking trả `"off"` (chỉ ở tầng hiển thị, không side-effect ghi state). Cập nhật số lượng §8.2 nếu thay đổi; sửa ghi chú dưới snippet Bước 2, Goal §1.3, §3.1 mục 4 và timeline §10 (bỏ bước T4 "effect persist").
  - Nếu Planner vẫn muốn giữ effect persist: bắt buộc (a) không chạy khi `!modelSupportsThinkingUI(currentModel)`, (b) chỉ chạy sau khi conversation đã resolve (không dựa trên landing model tạm thời), và (c) bổ sung test hook (`renderHook`) cho Cơ chế A và B. Phương án 1 đơn giản hơn và được khuyến nghị.

**[MAJOR-R5-2] Snippet effect Bước 2 dùng `catch {}` rỗng → `no-empty` error, làm `npm run verify` (Tier 2, §8.1) thất bại.**

- `[CMD]` V1: `Empty block statement  no-empty` (error). Code hiện hữu cùng file dùng `catch { // Ignore errors }` (`useThinkingLevel.ts:126-128, 135-137`).
- **Yêu cầu**: Nếu giữ bất kỳ khối `catch` nào trong snippet, thêm comment `// Ignore errors` như code hiện có. (Tự động biến mất nếu áp dụng phương án 1 của MAJOR-R5-1.)

**[MINOR-R5-1]** §10 dòng S1 vẫn ghi `ThinkingLevelSelector.tsx` import `clampGeminiThinkingLevel` từ `@/lib/core/modelRegistry`, trong khi snippet Bước 3 chỉ import `getSupportedGeminiThinkingLevels` — đồng bộ lại văn bản (không chặn).

**[MINOR-R5-2]** `getEffectiveThinkingLevel` gọi `getSupportedGeminiThinkingLevels` rồi `clampGeminiThinkingLevel` (gọi lại lần nữa bên trong) — có thể gọi thẳng `clamp` sau khi kiểm `isGemini3Model`; vô hại (không chặn).

**[MINOR-R5-3]** Guard `normalized.startsWith("gemini-3") || normalized.startsWith("gemini-3.")` — vế sau thừa (đã bao bởi vế trước); vô hại (không chặn).

#### Kết luận

**[CHANGES_REQUESTED]** — Còn 2 lỗi `[MAJOR]` (S1 FAIL do lint, S4 FAIL do persist phá hủy). MAJOR-R4-1 đã được khắc phục ở tầng hiển thị và xác minh bằng probe (V2). Việc cần làm cho Revision 6:

1. Bỏ effect chuẩn hóa-và-persist ở Bước 2 (hoặc áp đủ 3 điều kiện a/b/c), căn DeepSeek `medium → "low"` theo `deepseek-request-builder.ts`, cập nhật test Bước 9, §8.2, §1.3, §3.1, §10 (MAJOR-R5-1).
2. Không để khối `catch {}` rỗng trong snippet (MAJOR-R5-2).
3. Xử lý MINOR-R5-1 → R5-3 nếu thuận tiện (không bắt buộc để approve).

### Audit Run 6

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-08
- **Đối tượng**: Technical Plan Revision 6 (v6 — "Pure Derived State & Zero Destructive Persist Addressing Audit Run 5 Feedback")

#### Kiểm chứng lỗi cũ (so với Audit Run 5)

| Lỗi Run 5                                                | Trạng thái                         | Nhận định                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------------------------------------------------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-R5-1 (effect persist phá hủy preference)           | ✅ Đã khắc phục                    | Bước 2 bỏ hoàn toàn `useEffect` chuẩn hóa-và-persist; `localStorage` chỉ ghi qua `setThinkingLevel` khi người dùng chọn. `effectiveLevel` là giá trị dẫn xuất khi render (Bước 3). DeepSeek căn đúng server: `minimal/low/medium → low`, `high → high` (W2). Test Bước 9 cập nhật (DeepSeek `medium → low`, model không-thinking `→ off`); §1.3, §3.1 mục 4, §8.2 (7 + 11 = 18), timeline §10 (bỏ T4 persist, Cơ chế 2 bảo toàn `"medium"`) đã đồng bộ. Cơ chế A/B của Run 5 không còn tái hiện vì không có side-effect ghi state. |
| MAJOR-R5-2 (`catch {}` rỗng → `no-empty`)                | ✅ Đã khắc phục                    | Khối catch biến mất cùng effect. Probe W1: `ESLINT_EXIT=0`, 0 error trên snippet Bước 1/2/3.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| MINOR-R5-1 (§10 S1 nêu sai import selector)              | ✅                                 | §10 S1 nay ghi selector chỉ import `getSupportedGeminiThinkingLevels` từ `@/lib/core/modelRegistry` — khớp Bước 3.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| MINOR-R5-2 (gọi `getSupported…` hai lần)                 | ✅                                 | `getEffectiveThinkingLevel` kiểm `isGemini3Model` rồi gọi thẳng `clampGeminiThinkingLevel`.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| MINOR-R5-3 (guard `startsWith` thừa)                     | ✅                                 | Fallback Bước 1 chỉ còn `normalized.startsWith("gemini-3")`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Khuyến nghị R5-1.3 (`ChatApp.tsx:413` dùng bậc hiệu lực) | ⚠️ Chưa áp dụng, văn bản mô tả sai | Xem MINOR-R6-1 (không chặn — mục này là khuyến nghị).                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

#### Bằng chứng đã thu thập

| #   | Loại    | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :-- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | `[CMD]` | Probe tạm `src/__probe_r6__/{reg.ts,eff.ts,Sel.tsx}` — nguyên văn Bước 1 (`getSupportedGeminiThinkingLevels`/`clampGeminiThinkingLevel` trên `normalizeModelForApi`/`SELECTABLE_MODELS` thật), Bước 2 (`getAvailableThinkingLevels`/`getEffectiveThinkingLevel`, import predicate thật từ `useThinkingLevel.ts`), Bước 3 (import, `options`, `effectiveLevel`, `currentOption`, JSX `DropdownMenuItem`) → `npx tsc --noEmit -p tsconfig.json`, `npx eslint src/__probe_r6__`; sau đó xóa probe (`ls src \| grep -c probe` = 0) | `TSC_EXIT=0`; `ESLINT_EXIT=0` (0 error; 1 warning `curly` chỉ nằm trong file test của chính probe, không thuộc snippet plan).                                                                                                                                                                                                                                                                                            |
| W2  | `[CMD]` | `npx vitest run src/__probe_r6__/run.test.ts` — ma trận `getEffectiveThinkingLevel` × 9 model × 5 level                                                                                                                                                                                                                                                                                                                                                                                                                        | 2.5-flash `minimal/low/medium→low, high→high`; 3-flash & 3.1-flash-lite giữ nguyên; 3.1-pro `minimal→low`, `medium→medium`; claude-sonnet `*→high`; deepseek-v4-flash `minimal/low/medium→low, high→high`; claude-haiku/gpt-4o-mini/llama `*→off`; `off→off` mọi model. Mọi level hiệu lực ≠ off đều ∈ `getAvailableThinkingLevels(model)` → checkmark selector luôn rơi vào một option. Khớp 100% Test Contract Bước 9. |
| W3  | `[SRC]` | `useThinkingLevel.ts:19-72`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `isGemini3Model`, `isGemini25Model`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `modelSupportsThinkingUI` đều đã export → import Bước 2/3 hợp lệ. Effect load-from-storage (`:120-129`) và `setThinkingLevel` (`:131-138`) giữ nguyên, catch có comment.                                                                                                                                                              |
| W4  | `[SRC]` | `ChatApp.tsx:411-414`; `ChatBubble.tsx:273-277`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `getLowerThinkingLevel(thinkingLevel, availableLevels)` vẫn dùng level thô; `ChatApp.tsx` không nằm trong §5. Xem MINOR-R6-1.                                                                                                                                                                                                                                                                                            |
| W5  | `[SRC]` | `gemini-stream.ts:132-146, 163-166, 419-431`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Line refs Bước 5 vẫn chính xác; source chưa bị sửa (`git status`: chỉ `tsconfig.tsbuildinfo` và file plan) → code freeze được tôn trọng.                                                                                                                                                                                                                                                                                 |
| W6  | `[CMD]` | `npx vitest run` (sau khi xóa probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Exit 0 — 89 files / 975 tests passed (khớp §4). `grep -c "it("` → 7 (`useThinkingLevel.test.ts`), 1 (`gemini-stream.test.ts`); 3 file `[NEW]` chưa tồn tại — khớp §5, §8.2.                                                                                                                                                                                                                                              |
| W7  | `[SRC]` | Run 3 T3/T4/T12; Run 4 U4/U6/U7; Run 5 V7/V8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Các phần không đổi từ Rev 5 (Bước 1, 4–8, 10–13; mutual exclusion; enum `ThinkingLevel.MINIMAL`; phạm vi xóa `temperature`) đã được xác minh ở các Run trước và nội dung không thay đổi.                                                                                                                                                                                                                                 |

#### Mental Simulation Matrix (S1–S6)

| Kịch Bản                               | Kết quả    | Bằng chứng                                                     | Nhận định                                                                                                                                                                                                                                               |
| :------------------------------------- | :--------- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**             | PASS       | `[CMD]` W1, W6; Run 3 T3 (Bước 5/6)                            | Snippet Bước 1/2/3 compile + lint sạch; không thêm dependency, không Prisma/Better Auth; file `[NEW]` không bị import trước khi tạo; không biến môi trường mới.                                                                                         |
| **S2: Lifecycle & Abort**              | PASS       | `[SRC]` W5; Run 4 U4                                           | Continuation call được bổ sung `abortSignal`; test case 5 Bước 8 assert; mock `importOriginal` giữ hàm thật (không tautological). Bỏ effect → không còn side-effect client cần teardown.                                                                |
| **S3: Database & Temporal**            | PASS (N/A) | `[SRC]` §5, §3.1 mục 7                                         | Không migration, không chạm RLS/bảng/thời gian.                                                                                                                                                                                                         |
| **S4: Cross-Task State Flow**          | PASS       | `[CMD]` W2; `[SRC]` W3, W4, Run 5 V4–V8; `[ADV]` timeline dưới | State/`localStorage` giữ lựa chọn thô; hiển thị dẫn xuất khớp ngữ nghĩa server cho mọi dòng model; payload (`useChatStreamController` đọc `localStorage`) được server tự clamp/map theo model thật. Không còn ghi đè phụ thuộc `currentModel` tạm thời. |
| **S5: Security & Auth**                | PASS       | `[SRC]` `validators.ts:13` (Run 4/5)                           | Không chạm auth/rate-limit/route; Zod enum giữ nguyên; server clamp không tin input client.                                                                                                                                                             |
| **S6: External Resilience**            | PASS       | `[SRC]` Run 5 V8; Run 3 T4                                     | Mutual exclusion bằng if/else-if; level không hỗ trợ bị clamp server-side trước khi gọi API → không HTTP 400; auto-title có fallback model + fallback title; không log credential.                                                                      |
| **Domain: Gemini Thinking & Sampling** | PASS       | `[CMD]` W2; Run 3 T3/T4/T12                                    | Clamp Pro `minimal→low` đúng tài liệu; reasoning-token guard dùng đúng enum SDK; xóa `temperature` cô lập khỏi Claude/OpenAI/DeepSeek. Bilingual: dùng lại key `thinkingLevel*` sẵn có, không thêm text thô.                                            |

**Adversarial Timeline (Reviewer)**

```
Cơ chế A (tái kiểm Run 5): Cold-start mở thẳng URL conversation Gemini 3 Flash, preference "medium"
T1: Mount ChatApp, currentModel = landingModel ("gemini-2.5-flash"), effect load → state "medium".
T2: SWR chưa tải → selector (nếu hiện) hiển thị getEffectiveThinkingLevel("gemini-2.5-flash","medium") = "low"; KHÔNG ghi state/localStorage.
T3: SWR tải xong → currentModel = "gemini-3-flash-preview" → hiển thị "MEDIUM"; payload gửi "medium"; server clamp "medium" → { thinkingLevel: "medium", includeThoughts: true }.
Kết cục: Preference bảo toàn, chỉ nhấp nháy nhãn trong cửa sổ tải → AN TOÀN.

Cơ chế B (tái kiểm Run 5): Ghé qua model không-thinking
T1: Gemini 3 Flash chọn "high". | T2: Đổi sang llama-3.3-70b-versatile → effective "off" chỉ để hiển thị (selector ẩn), state giữ "high".
T3: Quay lại Gemini 3 Flash → "high".
Kết cục: Không regression → AN TOÀN.

Cơ chế C: Regenerate-lower trên DeepSeek/Gemini 2.5 với preference thô "medium"
T1: Model deepseek-v4-flash, state "medium" → nhãn "LOW" (W2). | T2: ChatApp tính getLowerThinkingLevel("medium", [off,low,high]) = "low" (W4) → nút "regenerate lower" đề xuất "LOW".
T3: Người dùng bấm → setThinkingLevel("low") → server xử lý "low" giống "medium" (Run 5 V7).
Kết cục: Regenerate cùng effort (no-op về chất lượng), hành vi sẵn có trước plan → AN TOÀN (MINOR-R6-1).
```

**Trục đối kháng (Evidence Bar 4.5.2)**: (1) Đồng thời — 2 tab chung `localStorage`: chỉ ghi khi người dùng chọn, last-write-wins giống hành vi sẵn có; không còn ghi ngầm → an toàn. (2) TOCTOU — `currentModel` client lệch model thật của conversation chỉ ảnh hưởng nhãn hiển thị; server luôn clamp/map theo model của request → không HTTP 400. (3) Thất bại giữa chừng — continuation call có `abortSignal`; lỗi `localStorage` được nuốt với comment như code hiện hữu. (4) Serverless — hàm mới là hàm thuần, không state in-memory → N/A.

#### Phân loại lỗi

**[MINOR-R6-1]** Bước 2 (gạch đầu dòng cuối mục "Bảo toàn nguyên vẹn trạng thái") ghi `effectiveLevel` "được `ChatApp.tsx:413` sử dụng cho logic hạ cấp `getLowerThinkingLevel`", nhưng hook không trả về `effectiveLevel`, `ChatApp.tsx` không nằm trong §5, và `ChatApp.tsx:413` vẫn dùng level thô (W4). Hệ quả chỉ là nút "regenerate lower" có thể đề xuất bậc trùng với bậc hiệu lực trên DeepSeek/Gemini 2.5 (Cơ chế C — hành vi sẵn có). Khi triển khai: hoặc sửa câu văn cho đúng thực tế, hoặc thêm `ChatApp.tsx` vào §5 và gọi `getLowerThinkingLevel(getEffectiveThinkingLevel(currentModel, thinkingLevel), availableLevels)` (W2: khi đó DeepSeek/2.5 với `medium` → `null`, hợp lý). Không chặn.

**[MINOR-R6-2]** `getEffectiveThinkingLevel` dùng predicate client (`isGemini3Model` dựa trên `includes`) còn `clampGeminiThinkingLevel` dùng `normalizeModelForApi` (fallback `DEFAULT_MODEL` cho id lạ) → một id Gemini 3 không có trong `API_ALLOWED` sẽ hiển thị `"low"` dù server có thể từ chối model đó. Chỉ ảnh hưởng hiển thị với id không hợp lệ; không chặn.

#### Kết luận

**APPROVED** — Toàn bộ lỗi `[MAJOR]` của Run 5 (MAJOR-R5-1, MAJOR-R5-2) và MINOR-R5-1 → R5-3 đã được khắc phục và xác minh bằng probe compile/lint (W1) và ma trận hành vi (W2). S1–S6 và Domain đều PASS. Chỉ còn 2 lỗi `[MINOR]` không chặn; khuyến nghị xử lý MINOR-R6-1 khi triển khai Bước 2. Code freeze được gỡ cho phạm vi file tại §5.

[PLAN_APPROVED]
