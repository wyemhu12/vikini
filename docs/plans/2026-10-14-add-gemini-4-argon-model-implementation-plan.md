# Kế Hoạch Triển Khai: Tích Hợp Mô Hình Gemini 4 Argon (`gemini-4-argon`)

> **Ngày lập**: 2026-10-14  
> **Tác giả**: Technical Planner (`@planner`)  
> **Revision**: 3 (Cập nhật sau Audit Run 2)  
> **Trạng thái**: Ready for Review

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Tích hợp mô hình suy luận đa phương thức **Gemini 4 Argon** (`gemini-4-argon`, phát hành ngày 13/10/2026) vào hệ thống **Vikini** thông qua Google GenAI SDK (`@google/genai`), đảm bảo các yêu cầu kỹ thuật và bảo mật sau:

1. **Đăng ký Model Registry & Chuẩn hóa SSOT**:
   - Khai báo hằng số `GEMINI_4_ARGON: "gemini-4-argon"` trong [`MODEL_IDS`](file:///c:/Users/wyemh/vikini/src/lib/utils/constants.ts#L17-L31) dưới nhóm `// Gemini models` (giữ nguyên toàn bộ các khóa/giá trị hiện hữu trong `MODEL_IDS`).
   - Đăng ký `gemini-4-argon` vào `SELECTABLE_MODELS`, `API_ALLOWED` và `MODEL_ALIASES` (`"gemini-4-argon-preview"` $\rightarrow$ `"gemini-4-argon"`) trong [`src/lib/core/modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts#L74-L97) với cửa sổ ngữ cảnh hợp nhất `1,048,576` tokens (`1M`), hạn mức đầu ra mỗi lượt streaming `65,536` tokens (`64K`), phân loại `"reasoning"` và danh sách mức độ suy luận hỗ trợ `["low", "medium", "high"]`.
   - Bổ sung helper [`isGemini4Model`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts#L430-L440) và mở rộng [`modelSupportsThinking`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts#L432-L436), [`getSupportedGeminiThinkingLevels`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts#L442-L456) để nhận diện nhánh `gemini-4`.
2. **Bảo Mật Phân Quyền Model Phía Server (Server-Side Rank Gating — Fail-Closed)**:
   - Bổ sung hàm kiểm tra quyền sử dụng model [`assertModelAllowedForUser(userId, model)`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.ts#L430-L444) trong `src/lib/core/limits.ts` dựa trên `getUserLimits(userId).allowed_models` (kèm cập nhật `BASIC_FALLBACK_CONFIG` có `allowed_models: ["gemini-2.5-flash"]`).
   - Cưỡng chế kiểm tra tại [`setConversationModel`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts#L472-L500), [`doSaveConversation`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts#L361-L395), [`loadOrCreateConversation`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.ts#L21-L42) và [`handleChatStreamCore`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts#L98-L125). Khi vi phạm quyền, `assertModelAllowedForUser` ném thẳng `ForbiddenError` (HTTP 403) hoặc `ServiceUnavailableError` (HTTP 503) ra ngoài `handleChatStreamCore` để khối `catch (e)` tại [`src/app/api/chat-stream/route.ts:108-119`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L108-L119) xử lý và **không** gọi `incrementDailyMessageCount(userId)` tại dòng 101. Đồng thời sửa fallback trong [`useAllowedModels.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useAllowedModels.ts#L39-L42) về `new Set([DEFAULT_MODEL])` khi fetch lỗi.
3. **Tuân Thủ Đặc Tả API Gemini 4 Argon (Thinking Always-On, Implicit Caching, Tool Context Circulation, Timeout 15 Phút & Paid-Tier Error Handling)**:
   - **Chính sách Thinking không thể tắt trên Gemini 4 Argon**: Theo tài liệu Google (`https://ai.google.dev/gemini-api/docs/generate-content/thinking`), `gemini-4-argon` không cho phép tắt thinking (chỉ hỗ trợ `["low", "medium", "high"]`, mặc định `"medium"`). Trên UI ([`useThinkingLevel.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.ts#L96-L152) và [`ThinkingLevelSelector.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx#L38-L77)), bảo toàn nguyên vẹn toàn bộ nhánh của các model hiện hữu (`isGLMModel`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `isGemini25Model`, `isGemini3Model`), chỉ loại bỏ tùy chọn `"off"` khi `isGemini4Model(currentModel)` là `true` (hiển thị `["low", "medium", "high"]`, ánh xạ `"off"` / `"minimal"` từ `localStorage` sang `"low"`). Ở phía server ([`gemini-stream.ts:153-175`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L153-L175)), nếu `isGemini4Model(model)` là `true`, luôn gửi `thinkingConfig: { thinkingLevel: clampedLevel, includeThoughts: true }` (trong đó `"off"` hoặc `"minimal"` được clamp tường minh về `"low"`, còn `undefined` dùng `"medium"`).
   - **Ngắt Explicit Context Caching cho Gemini 4**: Bổ sung chốt chặn trong [`getOrCreateCompositeCache`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L121-L125) và [`getOrCreateKBCache`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L215-L219) để trả về `null` đối với model `startsWith("gemini-4")` vì Gemini 4 Argon sử dụng Implicit Caching tự động và không hỗ trợ `ai.caches.create()`.
   - **Kích hoạt Tool Context Circulation cho Gemini 4**: Cập nhật [`setupToolsAndSafety`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/contextBuilder.ts#L118-L140) để kết hợp `googleSearch`, `codeExecution`, và `functionDeclarations` kèm `toolConfig: { includeServerSideToolInvocations: true }` cho `gemini-4-argon`.
   - **Timeout 15 phút (`900,000ms`) & Serverless `maxDuration`**: Thêm `ARGON: 900000` (15 phút) vào [`TIMEOUT_CONFIG`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/types.ts#L86-L92) (giữ nguyên `PRO`, `PRO_DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING`, `DEFAULT`), cập nhật [`getStreamTimeout`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/utils.ts#L7-L31) (giữ nguyên `process.env.STREAM_TIMEOUT_MS` và nhánh `flash`), và khai báo `export const maxDuration = 800;` trong [`src/app/api/chat-stream/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L1-L6).
   - **Xử lý lỗi Paid-Tier Only (HTTP 403/404) & `StreamTimeoutError` không retry vô ích**: Cập nhật [`extractGeminiErrorInfo`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L529-L598) và [`runStreamWithFallback`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L592-L657) để nhận diện lỗi quyền truy cập / Free tier (HTTP 401/403/404 $\rightarrow$ `MODEL_TIER_RESTRICTED`) cũng như `err instanceof StreamTimeoutError`, không chạy nhánh retry `[TOOLS FALLBACK]`.
4. **Song Ngữ i18n & Phân Quyền DB**:
   - Bổ sung khóa dịch thuật `"gemini-4-argon"` và `modelDescArgon4` trong [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts#L83-L113), [`vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts#L85-L116) và [`useChatTranslations.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatTranslations.ts#L42-L59).
   - Tạo script migration idempotent `database-migrations/20261014000000_add_gemini_4_argon.sql` cấp quyền truy cập `gemini-4-argon` cho hai hạng người dùng `'admin'` và `'pro'`.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ bảng Pre-Work Protocol tại [`.agents/rules/02-quality.md`](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md) và quy trình [`.agents/skills/add-model.md`](file:///c:/Users/wyemh/vikini/.agents/skills/add-model.md):

- **Quy tắc & Kỹ năng hệ thống**:
  - [`.agents/skills/add-model.md`](file:///c:/Users/wyemh/vikini/.agents/skills/add-model.md) (Checklist tích hợp model mới).
  - [`.agents/rules/01-coding.md`](file:///c:/Users/wyemh/vikini/.agents/rules/01-coding.md) (Chuẩn TypeScript strict, modularity, không dùng `any`, quy tắc unit test).
  - [`.agents/rules/02-quality.md`](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md) (Pre-Work Protocol, Testing Rules, Verification Tiers).
  - [`.agents/agents/reviewer/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/agent.md) & [`.agents/agents/reviewer/evidence-bar.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/evidence-bar.md) (Tiêu chuẩn thẩm định kế hoạch S1–S6 và kiểm toán bảng rủi ro).
- **Tài liệu kiến trúc & Model**:
  - [`docs/models.md`](file:///c:/Users/wyemh/vikini/docs/models.md) & [`docs/CHANGELOG.md`](file:///c:/Users/wyemh/vikini/docs/CHANGELOG.md).
- **Mã nguồn thực tế đã khảo sát**:
  - [`src/lib/utils/constants.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/constants.ts#L17-L31) (`MODEL_IDS`).
  - [`src/lib/core/modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts#L1-L574) & [`src/lib/core/modelRegistry.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.test.ts#L1-L120).
  - [`src/lib/core/limits.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.ts#L1-L444) & [`src/lib/core/limits.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.test.ts#L1-L248).
  - [`src/lib/features/chat/conversations.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts#L360-L510) & [`src/lib/features/chat/conversations.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.test.ts#L1-L189).
  - [`src/lib/core/contextCache.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L109-L271).
  - [`src/app/api/chat-stream/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L1-L121), [`src/app/api/chat-stream/chatStreamCore.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts#L96-L130), & [`src/app/api/chat-stream/conversationLoader.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.ts#L1-L65).
  - [`src/app/api/chat-stream/contextBuilder.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/contextBuilder.ts#L108-L153).
  - [`src/app/api/chat-stream/streaming/gemini-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L150-L256) (và dòng `529-657`) & [`src/app/api/chat-stream/streaming/gemini-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.test.ts#L133-L246).
  - [`src/app/api/chat-stream/streaming/types.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/types.ts#L86-L92) & [`src/app/api/chat-stream/streaming/utils.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/utils.ts#L1-L216).
  - [`src/app/features/chat/components/hooks/useThinkingLevel.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.ts#L1-L224), [`src/app/features/chat/components/hooks/useThinkingLevel.test.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.test.ts#L1-L136), & [`src/app/features/chat/components/ThinkingLevelSelector.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx#L1-L118).
  - [`src/app/features/chat/components/hooks/useAllowedModels.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useAllowedModels.ts#L1-L59) & [`src/app/features/chat/components/hooks/useChatTranslations.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatTranslations.ts#L42-L59).

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1. Các Giả Định Kỹ Thuật Đã Xác Minh (Verified Technical Assumptions)

1. **Tương thích `generateContentStream` (`streamGenerateContent`) của `@google/genai` (`^2.10.0`) và Kiểm chứng Thực Tế**:
   - Tài liệu GenerateContent API chính thức cho Gemini 4 Argon tại `https://ai.google.dev/gemini-api/docs/generate-content/latest-model` và `https://ai.google.dev/gemini-api/docs/generate-content/thinking` xác nhận `ai.models.generateContent` / `generateContentStream` nhận `model: "gemini-4-argon"` cùng `config: { maxOutputTokens: 65536, thinkingConfig: { thinkingLevel: "low" | "medium" | "high", includeThoughts: true } }`.
   - Trong `@google/genai@2.10.0`, tham số `model` là chuỗi động truyền thẳng tới REST endpoint `models/{model}:streamGenerateContent`. Kế hoạch bổ sung **Bước 17 (Live API Probe)** dùng `npx tsx -e` gọi trực tiếp `ai.models.generateContentStream` với `ThinkingLevel.LOW` từ `@google/genai`.
   - Tại [`src/app/api/chat-stream/streaming/gemini-stream.ts:153-175`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L153-L175), cấu hình request cho model hỗ trợ thinking chỉ đính kèm `thinkingConfig: { thinkingLevel, includeThoughts: true }` và không truyền `thinkingBudget` hay `temperature`/`top_p`/`top_k`, khớp với đặc tả của `gemini-4-argon`.
2. **Chính sách Thinking không thể tắt ("Always-On Thinking") trên `gemini-4-argon`**:
   - Tài liệu `https://ai.google.dev/gemini-api/docs/generate-content/thinking` nêu rõ: _"You cannot disable thinking for Gemini 4 Argon... If you don't specify a thinking level, Gemini will use the model's default thinking level (`"medium"` for Gemini 4 Argon)."_
   - Để tránh việc UI hiển thị `"OFF"` trong khi backend vẫn chạy suy luận mức `"medium"` gây phát sinh chi phí token ẩn, hệ thống áp dụng chính sách đồng bộ:
     - **Trên UI**: `getAvailableThinkingLevels("gemini-4-argon")` chỉ trả về `["low", "medium", "high"]` (không có `"off"`), đồng thời giữ nguyên toàn bộ nhánh hiện hữu của `isGLMModel`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `isGemini25Model` và `isGemini3Model`. Trong `ThinkingLevelSelector.tsx`, mảng `options: ThinkingOption[]` bỏ phần tử `{ value: "off", ... }` khi `isGemini4Model(currentModel)` là `true`. Nếu `localStorage` đang lưu `"off"` hoặc `"minimal"` từ model trước, `getEffectiveThinkingLevel("gemini-4-argon", requestedLevel)` ánh xạ về `"low"`.
     - **Trên Server (`gemini-stream.ts:153-175`)**: Đối với `isGemini4Model(model)`, server luôn khởi tạo `thinkingConfig` ngay cả khi request truyền `thinkingLevel: "off"` hoặc `undefined`. Cụ thể: `"off"` và `"minimal"` được clamp tường minh về `"low"`, còn `undefined` mặc định về `"medium"`, đồng thời cập nhật `effectiveThinkingLevel`.
3. **Loại trừ Explicit Context Caching cho `gemini-4-argon`**:
   - Theo hướng dẫn di trú tại `https://ai.google.dev/gemini-api/docs/generate-content/latest-model`: _"Explicit caching (`cachedContents` / `caches.create`) is not supported on Gemini 4 Argon. Remove calls that create or reference `cached_content` from your requests. Implicit caching is enabled by default for prompts of at least 4,096 tokens and discounts cached input tokens by 95% on cache hits."_
   - Do đó, [`src/lib/core/contextCache.ts:122`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L122) và [`contextCache.ts:216`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L216) phải trả về `null` ngay lập tức khi `model.startsWith("gemini-4")`.
4. **Giới hạn Serverless `maxDuration` so với khuyến nghị Timeout 15 phút**:
   - Tài liệu Google khuyến nghị đặt HTTP client timeout tối thiểu 15 phút (`900,000ms`) cho `gemini-4-argon`.
   - Trong `TIMEOUT_CONFIG` (`src/app/api/chat-stream/streaming/types.ts:86-92`), kế hoạch bổ sung `ARGON: 900000` (15 phút) cho `getStreamTimeout` bên cạnh `PRO`, `PRO_DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING`, `DEFAULT`.
   - Trên hạ tầng Vercel Pro Serverless Functions, trần `maxDuration` tối đa của nền tảng là `800` giây (13 phút 20 giây — xem [`src/app/api/deep-research/[taskId]/stream/route.ts:6-8`](file:///c:/Users/wyemh/vikini/src/app/api/deep-research/%5BtaskId%5D/stream/route.ts#L6-L8)). Kế hoạch bổ sung `export const maxDuration = 800;` vào [`src/app/api/chat-stream/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L1-L6) và ghi nhận rõ trade-off: trên môi trường self-hosted Node.js/Docker, ngưỡng `900,000ms` (15 phút) có hiệu lực đầy đủ; trên Vercel Pro, thời gian sống tối đa của toàn bộ request stream bị giới hạn ở `800s` (13.3 phút).
5. **Giới hạn Paid-Tier Only trên Gemini API & Chặn Retry Khi Timeout/4xx**:
   - `gemini-4-argon` không khả dụng ở gói Free tier hoặc Google AI Pro plan (`https://ai.google.dev/gemini-api/docs/generate-content/latest-model`). Nếu môi trường cấu hình `GEMINI_API_KEY` thuộc Free tier, Gemini API sẽ trả lỗi HTTP 403 (`PERMISSION_DENIED`) hoặc HTTP 404 (`NOT_FOUND`). `extractGeminiErrorInfo` và `runStreamWithFallback` (`gemini-stream.ts:529-657`) sẽ bắt các mã lỗi 401/403/404 này (`MODEL_TIER_RESTRICTED`) cũng như `StreamTimeoutError` và không thực hiện retry `[TOOLS FALLBACK]`.

#### 3.2. Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies)

- **Task 1 (Đã hoàn thành)**: Nâng cấp cấu hình quản trị `.agents/` lên `gemini-4-argon` đã hoàn tất ngày 2026-10-14.
- **Task 2 (Hiện tại)**: Tích hợp `gemini-4-argon` kèm cơ chế cưỡng chế `allowed_models` phía server vào ứng dụng Vikini (`src/`, `database-migrations/`, `docs/`).

---

### 4. Bảng Verified Versions (Grounding 2026)

Dữ liệu được đối chiếu trực tiếp từ tài liệu chính thức của Google AI for Developers (`https://ai.google.dev/gemini-api/docs/models/gemini-4-argon`, `https://ai.google.dev/gemini-api/docs/generate-content/latest-model`, `https://ai.google.dev/gemini-api/docs/generate-content/thinking`, cập nhật ngày 2026-10-13 UTC) và `package.json` của dự án:

| Thành Phần / Công Nghệ            | Phiên Bản / Định Danh Xác Thực (10/2026)                                                                                                                                      | Nguồn Tra Cứu / Căn Cứ Xác Thực                                                                                                |
| :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **Canonical Model ID**            | `gemini-4-argon`                                                                                                                                                              | [Gemini 4 Argon Model Page](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon)                                       |
| **Tên hiển thị chính thức**       | `Gemini 4 Argon`                                                                                                                                                              | [Google Gemini API — Models](https://ai.google.dev/gemini-api/docs/models)                                                     |
| **Unified Context Window**        | `1,048,576` tokens (1M shared input + thinking + output)                                                                                                                      | [GenerateContent — Latest Model](https://ai.google.dev/gemini-api/docs/generate-content/latest-model)                          |
| **Max Output Tokens (Streaming)** | `65,536` tokens (64K per-request streaming cap)                                                                                                                               | [Setting output token limits](https://ai.google.dev/gemini-api/docs/generate-content/latest-model#setting-output-token-limits) |
| **Supported Thinking Levels**     | `["low", "medium", "high"]` (Default API: `"medium"`; **không thể tắt thinking**)                                                                                             | [Thinking in Gemini 4 Argon](https://ai.google.dev/gemini-api/docs/generate-content/thinking)                                  |
| **Context Caching**               | **Implicit Caching only** (95% discount cho prompt $\ge 4,096$ tokens; Explicit `caches.create` không hỗ trợ)                                                                 | [Migration Guide — Gemini 4 Argon](https://ai.google.dev/gemini-api/docs/generate-content/latest-model)                        |
| **Tier Availability & Pricing**   | **Paid tier only** (Không hỗ trợ Free tier). Intro đến 30/11/2026: `$2.00/1M` in (`$0.10/1M` cached), `$10.00/1M` out+thinking. Từ 01/12/2026: `$4.00/1M` in, `$20.00/1M` out | [Gemini 4 Argon Pricing & Tier](https://ai.google.dev/gemini-api/docs/generate-content/latest-model#pricing)                   |
| **`@google/genai` SDK**           | `^2.10.0` (`2.10.0` installed)                                                                                                                                                | [`package.json:40`](file:///c:/Users/wyemh/vikini/package.json#L40)                                                            |
| **Next.js / React / Vitest**      | `next@^16.4.0` / `react@^19.2.3` / `vitest@^4.1.11`                                                                                                                           | [`package.json:64-117`](file:///c:/Users/wyemh/vikini/package.json#L64-L117)                                                   |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### Danh sách tổng hợp thay đổi

| Trạng Thái | Đường Dẫn File                                                                                                                                                     | Mô Tả Thay Đổi                                                                                                                                                                                                                                                                                                                                                                                          |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[MODIFY]` | [`src/lib/utils/constants.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/constants.ts)                                                                           | Thêm `GEMINI_4_ARGON: "gemini-4-argon"` vào `MODEL_IDS` dưới comment `// Gemini models` (giữ nguyên toàn bộ khóa hiện có).                                                                                                                                                                                                                                                                              |
| `[MODIFY]` | [`src/lib/core/modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts)                                                                     | Thêm `gemini-4-argon` vào `SELECTABLE_MODELS`, `API_ALLOWED`, `MODEL_ALIASES` (`"gemini-4-argon-preview"`); thêm `isGemini4Model`; cập nhật `modelSupportsThinking` và `getSupportedGeminiThinkingLevels`.                                                                                                                                                                                              |
| `[MODIFY]` | [`src/lib/core/modelRegistry.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.test.ts)                                                           | Bổ sung unit tests cho `gemini-4-argon` (`isGemini4Model`, thinking support, supported levels, clamping, normalization).                                                                                                                                                                                                                                                                                |
| `[MODIFY]` | [`src/lib/core/limits.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.ts)                                                                                   | Import `ForbiddenError` và `DEFAULT_MODEL, normalizeModelForApi, coerceStoredModel`; thêm `allowed_models: [DEFAULT_MODEL]` vào `BASIC_FALLBACK_CONFIG`; thêm `isModelAllowedForUser` và `assertModelAllowedForUser`.                                                                                                                                                                                   |
| `[MODIFY]` | [`src/lib/core/limits.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.test.ts)                                                                         | Bổ sung unit tests cho `assertModelAllowedForUser` (happy path `pro`/`admin`, chặn `basic` gọi `gemini-4-argon` với `ForbiddenError`, chặn `not_whitelisted`, và fail-closed `ServiceUnavailableError` khi lỗi DB).                                                                                                                                                                                     |
| `[MODIFY]` | [`src/lib/features/chat/conversations.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts)                                                   | Gọi `await assertModelAllowedForUser(userId, finalModel)` trong `setConversationModel` và `doSaveConversation` (khi `payload?.model` được chỉ định).                                                                                                                                                                                                                                                    |
| `[MODIFY]` | [`src/lib/features/chat/conversations.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.test.ts)                                         | Bổ sung unit tests cho `setConversationModel` và `saveConversation` kiểm chứng việc chặn model trái phép qua `assertModelAllowedForUser`.                                                                                                                                                                                                                                                               |
| `[MODIFY]` | [`src/app/api/chat-stream/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts)                                                               | Khai báo `export const maxDuration = 800;` ở đầu file và chỉ gọi `incrementDailyMessageCount(userId)` khi `response.ok` là `true`.                                                                                                                                                                                                                                                                      |
| `[MODIFY]` | [`src/app/api/chat-stream/conversationLoader.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.ts)                                     | Bảo toàn và rethrow `if (e instanceof AppError) throw e;` khi `getConversation` hoặc `saveConversation` ném `AppError` (`ForbiddenError`, `NotFoundError`, `ServiceUnavailableError`).                                                                                                                                                                                                                  |
| `[MODIFY]` | [`src/app/api/chat-stream/chatStreamCore.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts)                                             | Rethrow `if (e instanceof AppError) throw e;` tại khối `loadOrCreateConversation` và gọi trực tiếp `await assertModelAllowedForUser(userId, model);` để `route.ts:108` bắt `AppError` mà không tăng bộ đếm tin nhắn hàng ngày.                                                                                                                                                                          |
| `[MODIFY]` | [`src/lib/core/contextCache.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts)                                                                       | Bổ sung guard `return null` khi `model.startsWith("gemini-4")` trong `getOrCreateCompositeCache` và `getOrCreateKBCache`.                                                                                                                                                                                                                                                                               |
| `[NEW]`    | `src/lib/core/contextCache.test.ts`                                                                                                                                | Tạo mới unit test co-located (có cô lập state module `activeCacheNames`) kiểm thử `getOrCreateCompositeCache` và `getOrCreateKBCache` cho `gemini-4-argon`, `gemini-3-flash-preview` và `deepseek-v4-flash`.                                                                                                                                                                                            |
| `[MODIFY]` | [`src/app/api/chat-stream/contextBuilder.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/contextBuilder.ts)                                             | Mở rộng điều kiện trong `setupToolsAndSafety` sang `model.startsWith("gemini-3") \|\| model.startsWith("gemini-4")` để bật Tool Context Circulation cho `gemini-4-argon`.                                                                                                                                                                                                                               |
| `[NEW]`    | `src/app/api/chat-stream/contextBuilder.test.ts`                                                                                                                   | Tạo mới unit test co-located cho `setupToolsAndSafety` kiểm thử `gemini-4-argon`, regression `gemini-3-flash-preview` và `gemini-2.5-flash`.                                                                                                                                                                                                                                                            |
| `[MODIFY]` | [`src/app/api/chat-stream/streaming/types.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/types.ts)                                           | Thêm `ARGON: 900000` (15 phút) vào `TIMEOUT_CONFIG` (giữ nguyên `PRO`, `PRO_DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING`, `DEFAULT`).                                                                                                                                                                                                                                                                 |
| `[MODIFY]` | [`src/app/api/chat-stream/streaming/utils.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/utils.ts)                                           | Cập nhật `getStreamTimeout` (giữ nguyên `process.env.STREAM_TIMEOUT_MS`, `pro`, `flash` và export ở dòng 215) và thêm `"gemini-4-argon"`, `"gemini-4-argon-preview"` vào `gemini3Identifiers` trong `isGemini3Model`.                                                                                                                                                                                   |
| `[MODIFY]` | [`src/app/api/chat-stream/streaming/gemini-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts)                           | Tại `:153-175`, cưỡng chế gửi `thinkingConfig` cho `isGemini4Model(model)` (map `"off"`/`"minimal"` $\rightarrow$ `"low"`, `undefined` $\rightarrow$ `"medium"`). Tại `:529-657`, cập nhật `extractGeminiErrorInfo` và `runStreamWithFallback` để báo lỗi `MODEL_TIER_RESTRICTED` cho HTTP 401/403/404 và không retry `[TOOLS FALLBACK]` khi gặp `isNonRetryableClientError` hoặc `StreamTimeoutError`. |
| `[MODIFY]` | [`src/app/api/chat-stream/streaming/gemini-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.test.ts)                 | Bổ sung unit tests cho `gemini-4-argon`: `thinkingLevel: "high"`, `"minimal"` $\rightarrow$ `"low"`, `"off"` $\rightarrow$ `"low"`, lỗi 403/404 Paid-tier và `StreamTimeoutError` không retry `[TOOLS FALLBACK]`, và `getStreamTimeout`.                                                                                                                                                                |
| `[MODIFY]` | [`src/app/features/chat/components/hooks/useThinkingLevel.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.ts)           | Cập nhật `isGemini3Model`, `getAvailableThinkingLevels` và `getEffectiveThinkingLevel` cho `isGemini4Model` trong khi giữ nguyên toàn bộ nhánh `isGLMModel`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `isGemini25Model`.                                                                                                                                                                           |
| `[MODIFY]` | [`src/app/features/chat/components/ThinkingLevelSelector.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx)           | Trong biểu thức khởi tạo `options: ThinkingOption[]` (dòng 46–76), ẩn phần tử `{ value: "off", label: t("webSearchOff") }` khi `isGemini4Model(currentModel)` là `true`.                                                                                                                                                                                                                                |
| `[MODIFY]` | [`src/app/features/chat/components/hooks/useThinkingLevel.test.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.test.ts) | Bổ sung unit tests cho `gemini-4-argon` (danh sách `["low", "medium", "high"]` không có `"off"`, và ánh xạ `"off"` / `"minimal"` $\rightarrow$ `"low"`).                                                                                                                                                                                                                                                |
| `[MODIFY]` | [`src/app/features/chat/components/hooks/useAllowedModels.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useAllowedModels.ts)           | Sửa nhánh `catch` (dòng 41) để fallback về `new Set([DEFAULT_MODEL])` thay vì mở toàn bộ `SELECTABLE_MODELS`.                                                                                                                                                                                                                                                                                           |
| `[MODIFY]` | [`src/app/features/chat/components/hooks/useChatTranslations.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatTranslations.ts)     | Thêm `"gemini-4-argon"` và `"modelDescArgon4"` vào `CHAT_TRANSLATION_KEYS`.                                                                                                                                                                                                                                                                                                                             |
| `[MODIFY]` | [`src/lib/utils/translations/en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts)                                                               | Thêm khóa `"gemini-4-argon"` và `modelDescArgon4`.                                                                                                                                                                                                                                                                                                                                                      |
| `[MODIFY]` | [`src/lib/utils/translations/vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts)                                                               | Thêm khóa `"gemini-4-argon"` và `modelDescArgon4` tương ứng.                                                                                                                                                                                                                                                                                                                                            |
| `[NEW]`    | `database-migrations/20261014000000_add_gemini_4_argon.sql`                                                                                                        | Migration SQL idempotent bổ sung `"gemini-4-argon"` vào `rank_configs.allowed_models` cho rank `'admin'` và `'pro'`.                                                                                                                                                                                                                                                                                    |
| `[MODIFY]` | [`docs/models.md`](file:///c:/Users/wyemh/vikini/docs/models.md)                                                                                                   | Bổ sung mục tài liệu kỹ thuật cho `gemini-4-argon` (Gemini 4 Series, thinking levels `low, medium, high` — không thể tắt) và cập nhật bảng Thinking Mode.                                                                                                                                                                                                                                               |
| `[MODIFY]` | [`docs/CHANGELOG.md`](file:///c:/Users/wyemh/vikini/docs/CHANGELOG.md)                                                                                             | Ghi nhận bản ghi thay đổi tích hợp model `gemini-4-argon` và cưỡng chế phân quyền model phía server.                                                                                                                                                                                                                                                                                                    |

---

### 6. Các Bước Thực Hiện Tuần Tự (Step-by-Step Implementation Checklist)

#### Giai đoạn 1: Khai báo Constants & Model Registry SSOT

- [ ] **Bước 1: Cập nhật [`src/lib/utils/constants.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/constants.ts#L17-L31)**:
  - Tại đối tượng `MODEL_IDS` (`src/lib/utils/constants.ts:17-31`), giữ nguyên toàn bộ các khóa/giá trị hiện có (`IMAGE_STUDIO`, `USER_TEMPLATES_STORE`, `CLAUDE_SONNET_45`, `CLAUDE_HAIKU_45`, `DEEPSEEK_V4_FLASH`, `DEEPSEEK_V4_PRO`, `DEEPSEEK_V41_FLASH`, `DEEPSEEK_V32`, `GLM_52`) và chỉ thêm khóa `GEMINI_4_ARGON`:
    ```ts
    export const MODEL_IDS = {
      IMAGE_STUDIO: "vikini-image-studio",
      USER_TEMPLATES_STORE: "user_templates_store",
      // Gemini models
      GEMINI_4_ARGON: "gemini-4-argon",
      // Claude models
      CLAUDE_SONNET_45: "claude-sonnet-4.5",
      CLAUDE_HAIKU_45: "claude-haiku-4.5",
      // DeepSeek V4 models
      DEEPSEEK_V4_FLASH: "deepseek-v4-flash",
      DEEPSEEK_V4_PRO: "deepseek/deepseek-v4-pro",
      DEEPSEEK_V41_FLASH: "deepseek/deepseek-v4.1-flash",
      // DeepSeek V3.2 (via OpenRouter)
      DEEPSEEK_V32: "deepseek/deepseek-v3.2:floor",
      // Z.ai / GLM models (via OpenRouter)
      GLM_52: "z-ai/glm-5.2",
    } as const;
    ```

- [ ] **Bước 2: Cập nhật [`src/lib/core/modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts)**:
  - **2.1. Trong `SELECTABLE_MODELS` (`src/lib/core/modelRegistry.ts:74-97`)**: Bổ sung cấu hình `gemini-4-argon` vào đầu nhóm reasoning của Google:
    ```ts
      // Gemini 4 Series (Released Oct 2026)
      {
        id: MODEL_IDS.GEMINI_4_ARGON,
        descKey: "modelDescArgon4",
        name: "Gemini 4 Argon",
        tokenLimit: 1048576, // 1M unified context window
        contextWindow: 1048576,
        maxOutputTokens: 65536, // 64K standard streaming limit
        category: "reasoning",
        supportedThinkingLevels: ["low", "medium", "high"],
        providerId: "gemini",
      },
    ```
  - **2.2. Trong `API_ALLOWED` (`src/lib/core/modelRegistry.ts:289-302`)**: Bổ sung `MODEL_IDS.GEMINI_4_ARGON`:
    ```ts
      // Gemini 4 (10/2026)
      MODEL_IDS.GEMINI_4_ARGON,
    ```
  - **2.3. Trong `MODEL_ALIASES` (`src/lib/core/modelRegistry.ts:340-352`)**: Bổ sung alias `"gemini-4-argon-preview"` (không thêm ID suy đoán `"gemini-4.0-argon"`):
    ```ts
      // Gemini 4 aliases
      "gemini-4-argon-preview": MODEL_IDS.GEMINI_4_ARGON,
    ```
  - **2.4. Bổ sung helper `isGemini4Model` và cập nhật `modelSupportsThinking` (`src/lib/core/modelRegistry.ts:432-436`)**:

    ```ts
    /**
     * Check if a model belongs to the Gemini 4 family (where thinking cannot be disabled)
     */
    export function isGemini4Model(modelId: unknown): boolean {
      const normalized = normalizeModelForApi(modelId);
      return normalized.startsWith("gemini-4");
    }

    export function modelSupportsThinking(modelId: unknown): boolean {
      const normalized = normalizeModelForApi(modelId);
      // Hỗ trợ ThinkingConfig (thinkingLevel) cho các mô hình Gemini 3 và Gemini 4
      return normalized.startsWith("gemini-3") || normalized.startsWith("gemini-4");
    }
    ```

  - **2.5. Trong `getSupportedGeminiThinkingLevels` (`src/lib/core/modelRegistry.ts:442-456`)**: Cập nhật nhánh fallback (dòng 449) cho cả `gemini-3` và `gemini-4`:
    ```ts
    if (normalized.startsWith("gemini-3") || normalized.startsWith("gemini-4")) {
      return ["low", "medium", "high"];
    }
    ```

- [ ] **Bước 3: Cập nhật unit test [`src/lib/core/modelRegistry.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.test.ts)**:
  - Bổ sung các kiểm thử cho `gemini-4-argon`:
    - `isGemini4Model("gemini-4-argon")` và `isGemini4Model("gemini-4-argon-preview")` trả về `true`; `isGemini4Model("gemini-3.1-pro-preview")` trả về `false`.
    - `modelSupportsThinking("gemini-4-argon")` trả về `true`.
    - `getSupportedGeminiThinkingLevels("gemini-4-argon")` trả về `["low", "medium", "high"]`.
    - `clampGeminiThinkingLevel("gemini-4-argon", "minimal")` và `clampGeminiThinkingLevel("gemini-4-argon", "off")` trả về `"low"`.
    - `clampGeminiThinkingLevel("gemini-4-argon", "medium")` trả về `"medium"`, `"high"` trả về `"high"`.
    - `normalizeModelForApi("gemini-4-argon")` và `normalizeModelForApi("gemini-4-argon-preview")` trả về `"gemini-4-argon"`.
    - `getModelTokenLimit("gemini-4-argon")` trả về `1048576` và `getModelMaxOutputTokens("gemini-4-argon")` trả về `65536`.

#### Giai đoạn 2: Cưỡng Chế Phân Quyền Model Phía Server (Server-Side Rank Gating)

- [ ] **Bước 4: Cập nhật [`src/lib/core/limits.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.ts#L1-L444) và [`src/lib/core/limits.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.test.ts)**:
  - **4.1. Bổ sung imports tại đầu file `src/lib/core/limits.ts` (`:1-9`)**:
    ```ts
    import { getSupabaseAdmin } from "./supabase.server";
    import { Redis } from "@upstash/redis";
    import { logger } from "@/lib/utils/logger";
    import { ForbiddenError, ServiceUnavailableError, UserBlockedError } from "@/lib/utils/errors";
    import { DEFAULT_MODEL, normalizeModelForApi, coerceStoredModel } from "./modelRegistry";
    ```
  - **4.2. Trong `BASIC_FALLBACK_CONFIG` (`src/lib/core/limits.ts:70-76`)**: Thêm `allowed_models: [DEFAULT_MODEL]` (`["gemini-2.5-flash"]`) để khi bảng `rank_configs` thiếu dòng `basic`, người dùng `basic` vẫn dùng được model mặc định nhưng bị từ chối đối với các model cao cấp.
  - **4.3. Thêm `isModelAllowedForUser` và `assertModelAllowedForUser` vào cuối `src/lib/core/limits.ts` (`:430-444`)**:

    ```ts
    /**
     * Check whether a user's rank permits using the specified model.
     * Fails closed (throws ServiceUnavailableError / UserBlockedError) if limits cannot be verified.
     */
    export async function isModelAllowedForUser(userId: string, model: string): Promise<boolean> {
      const limits = await getUserLimits(userId);
      if (limits.rank === "not_whitelisted") {
        return false;
      }
      const normalizedModel = normalizeModelForApi(model);
      const coercedModel = coerceStoredModel(model);
      const allowedList = limits.allowed_models ?? [];
      const allowedSet = new Set(
        allowedList.flatMap((m) => [m, normalizeModelForApi(m), coerceStoredModel(m)])
      );
      return (
        allowedSet.has(model) || allowedSet.has(normalizedModel) || allowedSet.has(coercedModel)
      );
    }

    /**
     * Enforce rank-based model access on the server.
     * Throws ForbiddenError (403) if the user's rank is not permitted to use the model.
     */
    export async function assertModelAllowedForUser(userId: string, model: string): Promise<void> {
      const limits = await getUserLimits(userId);
      if (limits.rank === "not_whitelisted") {
        throw new ForbiddenError("User account is not approved to access AI models");
      }
      const normalizedModel = normalizeModelForApi(model);
      const coercedModel = coerceStoredModel(model);
      const allowedList = limits.allowed_models ?? [];
      const allowedSet = new Set(
        allowedList.flatMap((m) => [m, normalizeModelForApi(m), coerceStoredModel(m)])
      );
      if (
        !allowedSet.has(model) &&
        !allowedSet.has(normalizedModel) &&
        !allowedSet.has(coercedModel)
      ) {
        throw new ForbiddenError(
          `Model "${normalizedModel}" is not allowed for rank "${limits.rank}"`
        );
      }
    }
    ```

  - **4.4. Trong [`src/lib/core/limits.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.test.ts)**: Bổ sung khối `describe("assertModelAllowedForUser")` kiểm thử:
    - User rank `pro` hoặc `admin` có `"gemini-4-argon"` trong `allowed_models` $\rightarrow$ resolve thành công (`undefined`).
    - User rank `basic` (chỉ có `["gemini-2.5-flash"]`) yêu cầu `"gemini-4-argon"` $\rightarrow$ ném `ForbiddenError` (HTTP 403).
    - User `not_whitelisted` $\rightarrow$ ném `ForbiddenError`.
    - Lỗi kết nối DB khi đọc `rank_configs` hoặc `allowed_users` $\rightarrow$ ném `ServiceUnavailableError` (HTTP 503, fail-closed).

- [ ] **Bước 5: Cưỡng chế `assertModelAllowedForUser` tại [`src/lib/features/chat/conversations.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts#L361-L500), [`src/app/api/chat-stream/conversationLoader.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.ts#L6-L42), [`src/app/api/chat-stream/chatStreamCore.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts#L96-L130), [`src/app/api/chat-stream/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L97-L108) và [`src/app/features/chat/components/hooks/useAllowedModels.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useAllowedModels.ts#L39-L42)**:
  - **5.1. Trong `setConversationModel` (`src/lib/features/chat/conversations.ts:472-500`)**:
    - Import `assertModelAllowedForUser` từ `@/lib/core/limits`.
    - Ngay sau `const finalModel = isSelectableModelId(model) ? model : DEFAULT_MODEL;` (dòng 482), gọi `await assertModelAllowedForUser(userId, finalModel);`. Khi user `basic` gửi `PATCH /api/conversations { id, model: "gemini-4-argon" }`, hàm ném `ForbiddenError` và route trả HTTP 403.
  - **5.2. Trong `doSaveConversation` (`src/lib/features/chat/conversations.ts:361-375`)**:
    - Khi `payload?.model` được truyền tường minh (`if (payload?.model !== undefined)`), gọi `await assertModelAllowedForUser(userId, model);` trước khi insert vào bảng `conversations`.
  - **5.3. Trong [`src/app/api/chat-stream/conversationLoader.ts:6, 27-42`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.ts#L6-L42)**:
    - Cập nhật import dòng 6 thành `import { AppError, NotFoundError } from "@/lib/utils/errors";`.
    - Trong khối `catch (e)` của `saveConversation` (`:38-41`), bảo toàn mọi `AppError` (`ForbiddenError`, `ServiceUnavailableError`) thay vì bọc thành `Error` thường:
      ```ts
      } catch (e) {
        if (e instanceof AppError) throw e;
        const error = e as Error;
        throw new Error(error?.message || "Failed to create conversation");
      }
      ```
  - **5.4. Trong `handleChatStreamCore` (`src/app/api/chat-stream/chatStreamCore.ts:98-120`) và `POST` (`src/app/api/chat-stream/route.ts:97-108`)**:
    - Import `assertModelAllowedForUser` từ `@/lib/core/limits` và `AppError` từ `@/lib/utils/errors` trong `chatStreamCore.ts`.
    - Tại khối `catch (e)` của `loadOrCreateConversation` (`chatStreamCore.ts:100-107`), nếu `e instanceof AppError` thì `throw e;` trực tiếp để `route.ts:108-116` bắt và trả `errorFromAppError(e)`.
    - Ngay sau khi lấy `const { model, ... } = convContext;` (`chatStreamCore.ts:116`), gọi trực tiếp (không bọc `try/catch return Response`):
      ```ts
      // Enforce rank-based model access; throws ForbiddenError (403) or ServiceUnavailableError (503)
      // directly to route.ts:108 so daily message count is NOT incremented on rejection.
      await assertModelAllowedForUser(userId, model);
      ```
    - Đồng thời tại [`src/app/api/chat-stream/route.ts:97-107`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L97-L107), chỉ tăng bộ đếm quota khi `response.ok` là `true`:

      ```ts
      const response = await handleChatStreamCore({ req, userId });

      // Increment daily message count only after successful stream initiation
      if (response.ok) {
        try {
          await incrementDailyMessageCount(userId);
        } catch (err) {
          routeLogger.error("Failed to increment message count:", err);
        }
      }

      perfMonitor.end(response.status, { streaming: response.ok });
      return response;
      ```

  - **5.5. Trong [`src/app/features/chat/components/hooks/useAllowedModels.ts:39-42`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useAllowedModels.ts#L39-L42)**:
    - Sửa nhánh `catch` từ `setAllowedModels(new Set(SELECTABLE_MODELS.map((m) => m.id)))` thành `setAllowedModels(new Set([DEFAULT_MODEL]))` để giao diện client cũng fail-closed về model mặc định khi API lỗi.
  - **5.6. Cập nhật [`src/lib/features/chat/conversations.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.test.ts)**:
    - Mock `@/lib/core/limits` (`assertModelAllowedForUser`) và bổ sung unit tests cho `setConversationModel`: (a) cho phép đổi sang `"gemini-4-argon"` khi `assertModelAllowedForUser` resolve; (b) ném `ForbiddenError` và không gọi `update` DB khi `assertModelAllowedForUser` reject.

#### Giai đoạn 3: Context Caching Guard, Tool Context Circulation, Timeout 15 Phút & Stream Error Handling

- [ ] **Bước 6: Cập nhật [`src/lib/core/contextCache.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L109-L225)**:
  - Trong `getOrCreateCompositeCache` (`src/lib/core/contextCache.ts:121-124`), cập nhật guard loại trừ `gemini-4`:
    ```ts
    // Guard: only Gemini 2.5 / 3.x models support explicit caching.
    // Gemini 4 Argon uses automatic implicit caching and does not support explicit caches.create().
    if (!config.model.startsWith("gemini-") || config.model.startsWith("gemini-4")) {
      return null;
    }
    ```
  - Trong `getOrCreateKBCache` (`src/lib/core/contextCache.ts:215-218`), cập nhật guard tương tự:
    ```ts
    // Guard: only Gemini 2.5 / 3.x models support explicit caching
    if (!model.startsWith("gemini-") || model.startsWith("gemini-4")) {
      return null;
    }
    ```

- [ ] **Bước 7: Tạo mới unit test co-located `src/lib/core/contextCache.test.ts`**:
  - **Chiến lược cô lập state**: Mock `@/lib/core/genaiClient` (`getGenAIClient`) và `@/lib/utils/logger`. Sử dụng `vi.resetModules()` trong `beforeEach` (hoặc truyền chuỗi `systemInstruction` / `kbContent` có hậu tố riêng biệt cho từng test case) để cô lập `Map` module-level `activeCacheNames` (`src/lib/core/contextCache.ts:21`), tránh hiện tượng cache HIT chéo giữa các test.
  - Các trường hợp kiểm thử cho cả `getOrCreateCompositeCache` và `getOrCreateKBCache`:
    1. `model: "gemini-4-argon"` với nội dung dài $> 5,000$ ký tự: trả về `null` và `mockCachesCreate` không được gọi (`toHaveBeenCalledTimes(0)`).
    2. `model: "gemini-3-flash-preview"` với nội dung dài $> 5,000$ ký tự: gọi `mockCachesCreate` 1 lần và trả về `{ cacheName: "cachedContents/test-123", cacheHit: false }`.
    3. `model: "deepseek-v4-flash"` (non-Gemini error/rejection path) hoặc nội dung ngắn $< 4,096$ ký tự: trả về `null` và không gọi `mockCachesCreate`.
    4. Khi `mockCachesCreate` ném lỗi API (error path): hàm bắt lỗi an toàn và trả về `null`.

- [ ] **Bước 8: Cập nhật [`src/app/api/chat-stream/contextBuilder.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/contextBuilder.ts#L108-L140) và tạo mới `src/app/api/chat-stream/contextBuilder.test.ts`**:
  - **8.1. Trong `setupToolsAndSafety` (`src/app/api/chat-stream/contextBuilder.ts:118-140`)**: Mở rộng điều kiện nhận diện mô hình hỗ trợ kết hợp công cụ (`googleSearch` + `codeExecution` + `functionDeclarations` kèm `includeServerSideToolInvocations: true`) cho cả Gemini 3 và Gemini 4:

    ```ts
    const isGemini3Or4 = model.startsWith("gemini-3") || model.startsWith("gemini-4");
    const useGoogleSearch = enableWebSearch && WEB_SEARCH_AVAILABLE;

    if (useGoogleSearch) {
      tools.push({ googleSearch: {} });
    }

    if (isGemini3Or4 || !useGoogleSearch) {
      tools.push({ codeExecution: {} });
      const declarations = getAllDeclarations();
      if (declarations.length > 0) {
        tools.push({ functionDeclarations: declarations });
      }
    }

    const toolConfig =
      isGemini3Or4 && useGoogleSearch ? { includeServerSideToolInvocations: true } : undefined;
    ```

  - **8.2. Tạo mới `src/app/api/chat-stream/contextBuilder.test.ts`**:
    - Kiểm thử `setupToolsAndSafety`:
      - Với `model: "gemini-4-argon"` và `enableWebSearch: true`: `tools` chứa đủ `googleSearch`, `codeExecution`, `functionDeclarations`, và `toolConfig` bằng `{ includeServerSideToolInvocations: true }` (**TC-ARGON-08**).
      - Với `model: "gemini-3-flash-preview"` và `enableWebSearch: true` (Regression Gemini 3): hành vi tương đương `gemini-4-argon`.
      - Với `model: "gemini-2.5-flash"` và `enableWebSearch: true` (Regression Gemini 2.5): `tools` chỉ chứa `[{ googleSearch: {} }]` (không có `codeExecution` hay `functionDeclarations`) và `toolConfig` là `undefined`.
      - Với `enableWebSearch: false` (Error/Boundary case): không có `googleSearch`, có `codeExecution` + `functionDeclarations`, và `toolConfig` là `undefined`.

- [ ] **Bước 9: Cập nhật [`src/app/api/chat-stream/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L1-L6), [`src/app/api/chat-stream/streaming/types.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/types.ts#L86-L92) và [`src/app/api/chat-stream/streaming/utils.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/utils.ts#L1-L216)**:
  - **9.1. Trong [`src/app/api/chat-stream/route.ts:1-5`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L1-L5)**: Khai báo `maxDuration = 800` (trần tối đa trên Vercel Pro, đồng bộ với `deep-research/[taskId]/stream/route.ts:8`):
    ```ts
    export const runtime = "nodejs";
    export const dynamic = "force-dynamic";
    // Maximum allowed duration on Vercel Pro (800s = 13m20s).
    // Self-hosted Node.js deployments enforce TIMEOUT_CONFIG.ARGON (900,000ms = 15m).
    export const maxDuration = 800;
    ```
  - **9.2. Trong [`src/app/api/chat-stream/streaming/types.ts:86-92`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/types.ts#L86-L92)**: Giữ nguyên cả 5 hằng số hiện có (`PRO`, `PRO_DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING`, `DEFAULT`) và chỉ bổ sung `ARGON: 900000` (15 phút theo khuyến nghị của Google):
    ```ts
    export const TIMEOUT_CONFIG = {
      ARGON: 900000, // 15 minutes for Gemini 4 Argon (per Google migration guide)
      PRO: 300000, // 5 minutes for Pro models
      PRO_DEEP_THINKING: 600000, // 10 minutes for Pro + Deep Thinking
      FLASH: 240000, // 4 minutes for Flash models
      FLASH_DEEP_THINKING: 480000, // 8 minutes for Flash + Deep Thinking
      DEFAULT: 180000, // 3 minutes for other models
    } as const;
    ```
  - **9.3. Trong [`src/app/api/chat-stream/streaming/utils.ts:1-31`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/utils.ts#L1-L31)**:
    - Thêm `import { normalizeModelForApi } from "@/lib/core/modelRegistry";` ở đầu file.
    - Giữ nguyên chữ ký `function getStreamTimeout(model?: string, thinkingLevel?: ThinkingLevel): number` (**không** thêm từ khóa `export` ở dòng 7 vì cuối file tại dòng 215 đã có `export { getStreamTimeout, createTimeoutPromise, withTimeout, withIdleTimeout };`), giữ nguyên nhánh đọc `process.env.STREAM_TIMEOUT_MS` (dòng 9–15) và nhánh `pro` / `flash` (dòng 22–28), chỉ chèn kiểm tra Gemini 4 vào đầu khối `if (model)`:

      ```ts
      function getStreamTimeout(model?: string, thinkingLevel?: ThinkingLevel): number {
        // Environment variable override takes priority
        const envTimeout = process.env.STREAM_TIMEOUT_MS;
        if (envTimeout) {
          const parsed = parseInt(envTimeout, 10);
          if (!isNaN(parsed) && parsed > 0) {
            return parsed;
          }
        }

        // Deep thinking requires longer timeouts (high = maximum reasoning depth)
        const isDeepThinking = thinkingLevel === "high";

        // Model-specific timeouts with thinking level consideration
        if (model) {
          const normalized = normalizeModelForApi(model);
          if (normalized.startsWith("gemini-4") || model.includes("argon")) {
            return TIMEOUT_CONFIG.ARGON;
          }
          if (model.includes("pro")) {
            return isDeepThinking ? TIMEOUT_CONFIG.PRO_DEEP_THINKING : TIMEOUT_CONFIG.PRO;
          }
          if (model.includes("flash")) {
            return isDeepThinking ? TIMEOUT_CONFIG.FLASH_DEEP_THINKING : TIMEOUT_CONFIG.FLASH;
          }
        }

        return TIMEOUT_CONFIG.DEFAULT;
      }
      ```

  - **9.4. Trong `isGemini3Model` (`src/app/api/chat-stream/streaming/utils.ts:152-169`)**: Giữ nguyên tên biến mảng `gemini3Identifiers` và kiểu so khớp hiện hữu, chỉ bổ sung `"gemini-4-argon"` và `"gemini-4-argon-preview"` vào `gemini3Identifiers`:
    ```ts
    export function isGemini3Model(model: string): boolean {
      const gemini3Identifiers = [
        "gemini-4-argon",
        "gemini-4-argon-preview",
        "gemini-3-pro",
        "gemini-3-flash",
        "gemini-3-pro-preview",
        "gemini-3-flash-preview",
        "gemini-3-pro-image",
        "gemini-3-pro-image-preview",
        "gemini-3-pro-thinking",
        "gemini-3-flash-thinking",
        // Gemini 3.1 series (March 2026)
        "gemini-3.1-pro",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite",
        "gemini-3.1-flash-lite-preview",
      ];
      return gemini3Identifiers.some((id) => model.includes(id) || model.startsWith(id));
    }
    ```

- [ ] **Bước 10: Cập nhật [`src/app/api/chat-stream/streaming/gemini-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L153-L175) (và `:529-657`) kèm [`src/app/api/chat-stream/streaming/gemini-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.test.ts)**:
  - **10.1. Chính sách Thinking cho Gemini 4 (`src/app/api/chat-stream/streaming/gemini-stream.ts:153-175`)**:
    - Import `isGemini4Model` từ `@/lib/core/modelRegistry`.
    - Vì `gemini-4-argon` không thể tắt thinking, khi `isGemini4Model(model)` là `true`, nếu client gửi `thinkingLevel === "off"` hoặc `"minimal"`, server clamp tường minh về `"low"`; nếu `thinkingLevel === undefined`, server dùng `"medium"` (default của Argon):

      ```ts
      let thinkingConfig:
        | {
            thinkingLevel?: GeminiThinkingLevel;
            thinkingBudget?: number;
            includeThoughts?: boolean;
          }
        | undefined;

      let effectiveThinkingLevel = thinkingLevel;

      if (isGemini4Model(model)) {
        const requested =
          !thinkingLevel || thinkingLevel === "off"
            ? thinkingLevel === "off"
              ? "low"
              : "medium"
            : thinkingLevel;
        const clampedLevel = clampGeminiThinkingLevel(model, requested);
        effectiveThinkingLevel = clampedLevel;
        thinkingConfig = { thinkingLevel: clampedLevel, includeThoughts: true };
      } else if (thinkingLevel && thinkingLevel !== "off") {
        if (modelSupportsThinking(model)) {
          // Gemini 3+: clamp level to model capabilities and send thinkingLevel
          // INVARIANT: Never send thinkingBudget
          const clampedLevel = clampGeminiThinkingLevel(model, thinkingLevel);
          effectiveThinkingLevel = clampedLevel;
          thinkingConfig = { thinkingLevel: clampedLevel, includeThoughts: true };
        } else if (normalized.startsWith("gemini-2.5")) {
          // Gemini 2.5: preserve backward compatibility for DEFAULT_MODEL
          // INVARIANT: Never send thinkingLevel
          thinkingConfig = { thinkingBudget: -1, includeThoughts: true };
        }
        // Other models: no thinking config (would cause API error)
      }
      ```

  - **10.2. Xử lý lỗi Paid-Tier Only (HTTP 401/403/404), `StreamTimeoutError` và chặn retry `[TOOLS FALLBACK]` (`src/app/api/chat-stream/streaming/gemini-stream.ts:529-657`)**:
    - Trong `extractGeminiErrorInfo` (`:529-598`), bổ sung cờ `isNonRetryableClientError: boolean` vào kiểu trả về. Khi `status === 401 || status === 403 || status === 404` hoặc thông điệp chứa `/free tier|permission_denied|not_found|not available on the free tier/i`:
      - Đặt `isNonRetryableClientError: true`.
      - Nếu xảy ra trên model `gemini-4` (hoặc thông báo liên quan đến tier/permission), trả về `{ message: "Gemini 4 Argon requires a paid-tier Gemini API key and is not available on the Free tier.", code: "MODEL_TIER_RESTRICTED", status, isRateLimit: false, isNonRetryableClientError: true }`.
    - Trong `runStreamWithFallback` (`:592-635`):
      - Tại dòng 593, kiểm tra `if (abortSignal?.aborted || err instanceof StreamTimeoutError) { throw err; }` để khi `executeStream` đã gửi `STREAM_TIMEOUT` (ở dòng 246–250) sau 15 phút, `runStreamWithFallback` thoát ngay mà không retry lần 2 qua nhánh `[TOOLS FALLBACK]`.
      - Tại dòng 606, nếu `errorInfo.isRateLimit || errorInfo.isNonRetryableClientError` là `true`, gửi ngay sự kiện `sendEvent(controller, "error", { message: errorInfo.message, code: errorInfo.code, status: errorInfo.status, ...(errorInfo.isRateLimit ? { isRateLimit: true, retryAfter: errorInfo.retryAfter } : {}) })` và `throw err` mà **không** chạy nhánh `[TOOLS FALLBACK]`.
  - **10.3. Trong [`src/app/api/chat-stream/streaming/gemini-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.test.ts)**:
    - Bổ sung các test cases cho `gemini-4-argon`:
      1. `thinkingLevel: "high"` $\rightarrow$ gửi `{ thinkingLevel: "high", includeThoughts: true }`, không có `thinkingBudget`, `temperature`, `top_p`, `top_k`.
      2. `thinkingLevel: "minimal"` $\rightarrow$ clamp về `{ thinkingLevel: "low", includeThoughts: true }`.
      3. `thinkingLevel: "off"` $\rightarrow$ vẫn gửi `thinkingConfig: { thinkingLevel: "low", includeThoughts: true }` (không bỏ trống `thinkingConfig`).
      4. Khi `generateContentStream` ném lỗi HTTP 403 (`PERMISSION_DENIED` / Free tier) cho `gemini-4-argon`: stream phát sự kiện error với `code: "MODEL_TIER_RESTRICTED"`, **không** phát `meta: webSearchFallback`, và `generateContentStream` chỉ được gọi đúng 1 lần (`toHaveBeenCalledTimes(1)`).
      5. Kiểm thử `getStreamTimeout("gemini-4-argon", "medium") === 900000` và `getStreamTimeout("gemini-4-argon-preview", "low") === 900000`.

#### Giai đoạn 4: Tích Hợp UI Thinking Controls, Song Ngữ i18n & Database Migration

- [ ] **Bước 11: Cập nhật [`src/app/features/chat/components/hooks/useThinkingLevel.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.ts#L5-L152) và [`src/app/features/chat/components/ThinkingLevelSelector.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx#L19-L77)**:
  - **11.1. Trong `src/app/features/chat/components/hooks/useThinkingLevel.ts`**:
    - Tại dòng 5–9, import thêm `isGemini4Model` từ `@/lib/core/modelRegistry`:
      ```ts
      import {
        getSupportedGeminiThinkingLevels,
        clampGeminiThinkingLevel,
        isGLMModel,
        isGemini4Model,
      } from "@/lib/core/modelRegistry";
      ```
    - Mở rộng `isGemini3Model(model: string)` (`:24-26`) để bao gồm `model.includes("gemini-4")`:
      ```ts
      export function isGemini3Model(model: string): boolean {
        return (
          model.includes("gemini-3") || model.includes("gemini-3.") || model.includes("gemini-4")
        );
      }
      ```
    - Trong `getAvailableThinkingLevels(currentModel: string)` (`:96-106`), **giữ nguyên toàn bộ nhánh hiện có** của `isGLMModel`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `isGemini25Model` và chỉ thêm nhánh `if (isGemini4Model(currentModel))`:
      ```ts
      export function getAvailableThinkingLevels(currentModel: string): ThinkingLevel[] {
        if (isGLMModel(currentModel)) return ["off", "high"];
        if (isClaudeThinkingModel(currentModel)) return ["off", "high"];
        if (isDeepSeekV4Model(currentModel)) return ["off", "low", "high"];
        if (isGemini25Model(currentModel)) return ["off", "low", "high"];
        if (isGemini4Model(currentModel)) {
          // Gemini 4 Argon cannot disable thinking; expose only ["low", "medium", "high"]
          return [...getSupportedGeminiThinkingLevels(currentModel)];
        }
        const geminiSupported = getSupportedGeminiThinkingLevels(currentModel);
        if (geminiSupported.length > 0) {
          return ["off", ...geminiSupported];
        }
        return ["off", "low", "high"];
      }
      ```
    - Trong `getEffectiveThinkingLevel(currentModel: string, requestedLevel: ThinkingLevel)` (`:112-152`), **giữ nguyên toàn bộ nhánh hiện có** của `isGLMModel`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `isGemini25Model`, `isGemini3Model` và chỉ thêm nhánh `if (isGemini4Model(currentModel))` ở đầu hàm:

      ```ts
      export function getEffectiveThinkingLevel(
        currentModel: string,
        requestedLevel: ThinkingLevel
      ): ThinkingLevel {
        if (isGemini4Model(currentModel)) {
          // Thinking cannot be disabled on Gemini 4; map "off" or "minimal" to "low"
          return clampGeminiThinkingLevel(
            currentModel,
            requestedLevel === "off" ? "low" : requestedLevel
          );
        }

        if (requestedLevel === "off" || !modelSupportsThinkingUI(currentModel)) {
          return "off";
        }

        if (isGLMModel(currentModel)) {
          // GLM only supports off/high; any non-off level activates high reasoning
          return "high";
        }

        if (isClaudeThinkingModel(currentModel)) {
          // Claude only supports off/high; any non-off level activates extended thinking (high)
          return "high";
        }

        if (isDeepSeekV4Model(currentModel)) {
          // DeepSeek V4: minimal/low/medium -> low, high -> high (matches deepseek-request-builder.ts:35-75)
          if (requestedLevel === "high") {
            return "high";
          }
          return "low";
        }

        if (isGemini25Model(currentModel)) {
          // Gemini 2.5 dynamic thinking via thinkingBudget: -1
          if (requestedLevel === "high") {
            return "high";
          }
          return "low";
        }

        if (isGemini3Model(currentModel)) {
          // Gemini 3: clamp directly based on model capabilities
          return clampGeminiThinkingLevel(currentModel, requestedLevel);
        }

        return "off";
      }
      ```

  - **11.2. Trong [`src/app/features/chat/components/ThinkingLevelSelector.tsx:19-77`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx#L19-L77)**:
    - Import thêm `isGemini4Model` từ `@/lib/core/modelRegistry` (dòng 19).
    - Tại dòng 41–76, thêm `const isGemini4 = isGemini4Model(currentModel);` và trong nhánh `isGemini3 && geminiSupported.length > 0` của biến `options: ThinkingOption[]`, chỉ chèn `{ value: "off", label: t("webSearchOff") }` khi `!isGemini4`:

      ```tsx
      const isDeepSeek = isDeepSeekV4Model(currentModel);
      const isClaudeModel = isClaudeThinkingModel(currentModel);
      const isGLM = isGLMModel(currentModel);
      const isGemini4 = isGemini4Model(currentModel);
      const isGemini3 = isGemini3Model(currentModel);
      const geminiSupported = isGemini3 ? getSupportedGeminiThinkingLevels(currentModel) : [];

      // Build options based on model
      // DeepSeek V4: off / low(=reasoning_effort:high) / high(=reasoning_effort:max)
      const options: ThinkingOption[] = isDeepSeek
        ? [
            { value: "off", label: t("webSearchOff") },
            { value: "low", label: t("thinkingLevelLow") || "STANDARD" },
            { value: "high", label: t("thinkingLevelHigh") || "DEEP" },
          ]
        : isClaudeModel || isGLM
          ? [
              { value: "off", label: t("webSearchOff") },
              { value: "high", label: t("thinkingLevelHigh") || "HIGH" },
            ]
          : isGemini3 && geminiSupported.length > 0
            ? [
                ...(isGemini4 ? [] : [{ value: "off" as ThinkingLevel, label: t("webSearchOff") }]),
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

- [ ] **Bước 12: Cập nhật unit test [`src/app/features/chat/components/hooks/useThinkingLevel.test.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.test.ts)**:
  - Giữ nguyên toàn bộ 25 test cases hiện có và bổ sung kiểm thử cho `"gemini-4-argon"`:
    - `modelSupportsThinkingUI("gemini-4-argon") === true`.
    - `getAvailableThinkingLevels("gemini-4-argon")` trả về `["low", "medium", "high"]` (không chứa `"off"`).
    - `getEffectiveThinkingLevel("gemini-4-argon", "minimal") === "low"`.
    - `getEffectiveThinkingLevel("gemini-4-argon", "off") === "low"`.
    - `getEffectiveThinkingLevel("gemini-4-argon", "medium") === "medium"` và `"high"` trả về `"high"`.

- [ ] **Bước 13: Cập nhật từ điển song ngữ [`src/lib/utils/translations/en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts#L83-L113), [`src/lib/utils/translations/vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts#L85-L116) và [`src/app/features/chat/components/hooks/useChatTranslations.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatTranslations.ts#L42-L59)**:
  - Trong `src/lib/utils/translations/en.ts`:
    - Thêm `"gemini-4-argon": "Gemini 4 Argon"` (cạnh `"gemini-3.1-pro-preview"`, dòng 86) và `modelDescArgon4: "Flagship Gemini 4 reasoning & coding (1M context)"` (cạnh `modelDescPro31`, dòng 93).
  - Trong `src/lib/utils/translations/vi.ts`:
    - Thêm `"gemini-4-argon": "Gemini 4 Argon"` (cạnh `"gemini-3.1-pro-preview"`, dòng 88) và `modelDescArgon4: "Suy luận & lập trình thế hệ mới (1M ngữ cảnh)"` (cạnh `modelDescPro31`, dòng 96).
  - Trong `src/app/features/chat/components/hooks/useChatTranslations.ts:42-59`:
    - Thêm `"gemini-4-argon"` và `"modelDescArgon4"` vào mảng `CHAT_TRANSLATION_KEYS`.

- [ ] **Bước 14: Tạo mới migration SQL `database-migrations/20261014000000_add_gemini_4_argon.sql`**:
  - Cấp quyền sử dụng `"gemini-4-argon"` cho các hạng `'admin'` và `'pro'` trong bảng `rank_configs` theo mẫu idempotent của `20261012000000_add_glm_5_2.sql`:

    ```sql
    -- =====================================================================================
    -- Add Gemini 4 Argon to Rank Configs
    -- =====================================================================================
    -- Version: 20261014000000
    -- Date: 2026-10-14
    -- Model: gemini-4-argon (Google Gemini API)
    -- Rationale: Flagship Gemini 4 reasoning model ($2.00/M in, $10.00/M out intro pricing)
    --            granted to 'admin' and 'pro' ranks
    -- =====================================================================================

    UPDATE rank_configs
    SET allowed_models = allowed_models || '["gemini-4-argon"]'::jsonb
    WHERE rank IN ('admin', 'pro')
      AND NOT (allowed_models @> '["gemini-4-argon"]'::jsonb);

    -- Verification:
    -- SELECT rank, allowed_models FROM rank_configs ORDER BY rank;
    ```

#### Giai đoạn 5: Cập Nhật Tài Liệu Living Docs, Verification Gate & Live Probe

- [ ] **Bước 15: Cập nhật [`docs/models.md`](file:///c:/Users/wyemh/vikini/docs/models.md) và [`docs/CHANGELOG.md`](file:///c:/Users/wyemh/vikini/docs/CHANGELOG.md)**:
  - Trong `docs/models.md`: Thêm mục `## Gemini 4 Series` (`### gemini-4-argon`) với bảng thuộc tính (Unified 1M token window, 65,536 streaming output limit, thinking levels `low, medium, high` — luôn bật, không có `off`, Implicit Context Caching 95% discount, Search Grounding, URL Context, Function Calling, Code Execution, yêu cầu Paid-tier API key) và cập nhật ngày `Updated: 2026-10-14`.
  - Trong `docs/CHANGELOG.md`: Thêm mục `## 2026-10-14: Feature -- Integrate Gemini 4 Argon (gemini-4-argon) Model & Server-Side Model Rank Gating`.

- [ ] **Bước 16: Dọn dẹp artefact `.next/` cũ và chạy toàn bộ Verification Gate (`npm run verify`)**:
  - Xóa thư mục `.next` (`Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue` hoặc `npx next typegen`) để loại bỏ file `.next/types/validator.ts` cũ trỏ tới route đã xóa.
  - Chạy `npm run verify` (`npm run type-check && npm run lint && npm run test:run`) đảm bảo 0 lỗi TypeScript, 0 lỗi ESLint và tất cả các bộ test đều pass.

- [ ] **Bước 17: Thực hiện Live API Smoke Probe cho `generateContentStream` với `gemini-4-argon` (Pre-Merge Gate)**:
  - Chạy lệnh probe (sử dụng enum `ThinkingLevel.LOW` từ `@google/genai`, không dùng `any`) với `GEMINI_API_KEY` trả phí trên môi trường staging/local trước khi merge:
    ```bash
    npx tsx -e 'import { GoogleGenAI, ThinkingLevel } from "@google/genai"; const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); (async () => { const s = await ai.models.generateContentStream({ model: "gemini-4-argon", contents: "Reply with OK", config: { maxOutputTokens: 64, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: true } } }); for await (const chunk of s) { console.log("CHUNK:", chunk.text ?? "[thought]"); break; } })()'
    ```
  - Ghi nhận exit code `0` và chunk phản hồi đầu tiên (hoặc xác nhận thông báo lỗi `MODEL_TIER_RESTRICTED` nếu key môi trường hiện tại là Free tier).

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Mã Kiểm Thử     | Vị Trí / Hàm Kiểm Thử                                                                                         | Đầu Vào (Input)                                                                                                          | Kết Quả Mong Đợi (Expected Output)                                                                                                                                                                                                                               | Failure Mode / Boundary Condition                                                                                                                                                       |
| :-------------- | :------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-ARGON-01** | `modelRegistry.ts`<br>`normalizeModelForApi` & `isGemini4Model`                                               | `"gemini-4-argon"` và `"gemini-4-argon-preview"`                                                                         | `normalizeModelForApi === "gemini-4-argon"`<br>`isGemini4Model === true`                                                                                                                                                                                         | Không bị fallback về `DEFAULT_MODEL` (`"gemini-2.5-flash"`).                                                                                                                            |
| **TC-ARGON-02** | `limits.ts`<br>`assertModelAllowedForUser`                                                                    | `userId` rank `"basic"` (`allowed_models: ["gemini-2.5-flash"]`), `model: "gemini-4-argon"`                              | Ném `ForbiddenError` (HTTP 403); với user rank `"pro"`/`"admin"` có `"gemini-4-argon"` thì resolve `undefined`                                                                                                                                                   | Chặn việc user rank `basic` hoặc `not_whitelisted` gọi `gemini-4-argon` qua API mà không làm tăng `incrementDailyMessageCount`; fail-closed (`ServiceUnavailableError` 503) khi DB lỗi. |
| **TC-ARGON-03** | `modelRegistry.ts`<br>`getModelTokenLimit` & `getModelMaxOutputTokens`                                        | `"gemini-4-argon"`                                                                                                       | `tokenLimit === 1048576`<br>`maxOutputTokens === 65536`                                                                                                                                                                                                          | Trả về đúng hạn mức 1M unified context và 64K output cap.                                                                                                                               |
| **TC-ARGON-04** | `modelRegistry.ts`<br>`modelSupportsThinking` & `getSupportedGeminiThinkingLevels`                            | `"gemini-4-argon"`                                                                                                       | `modelSupportsThinking === true`<br>`levels === ["low", "medium", "high"]`                                                                                                                                                                                       | Không bao gồm `"minimal"`, không trả về mảng rỗng `[]`.                                                                                                                                 |
| **TC-ARGON-05** | `modelRegistry.ts`<br>`clampGeminiThinkingLevel`                                                              | `("gemini-4-argon", "minimal")`<br>`("gemini-4-argon", "off")`<br>`("gemini-4-argon", "medium")`                         | `"low"` cho `"minimal"` và `"off"`<br>`"medium"` cho `"medium"`                                                                                                                                                                                                  | Mức `"minimal"` và `"off"` bị ép an toàn về `"low"`, tránh lỗi HTTP 400 hoặc chạy ngầm ở `"medium"`.                                                                                    |
| **TC-ARGON-06** | `contextCache.ts`<br>`getOrCreateCompositeCache` & `getOrCreateKBCache`                                       | `model: "gemini-4-argon"`, `systemInstruction: "A".repeat(5000)`                                                         | `null` (và `ai.caches.create` có số lần gọi bằng `0`)                                                                                                                                                                                                            | Ngăn chặn việc gọi `caches.create` không được hỗ trợ trên Gemini 4 Argon.                                                                                                               |
| **TC-ARGON-07** | `contextCache.ts`<br>`getOrCreateCompositeCache` & `getOrCreateKBCache` (Regression & Error)                  | `model: "gemini-3-flash-preview"` vs `model: "deepseek-v4-flash"`                                                        | `{ cacheName: "cachedContents/...", cacheHit: false }` cho Gemini 3; `null` cho DeepSeek                                                                                                                                                                         | Bảo toàn Explicit Context Caching của Gemini 2.5/3.x và xử lý đúng non-Gemini / API error.                                                                                              |
| **TC-ARGON-08** | `contextBuilder.ts`<br>`setupToolsAndSafety`                                                                  | `enableWebSearch: true`, `model: "gemini-4-argon"` (kèm regression `"gemini-2.5-flash"`)                                 | Với Argon: `tools` chứa `googleSearch`, `codeExecution`, `functionDeclarations` và `toolConfig: { includeServerSideToolInvocations: true }`. Với 2.5 Flash: chỉ `googleSearch`, `toolConfig: undefined`                                                          | Đảm bảo Gemini 4 Argon kích hoạt Tool Context Circulation mà không làm hỏng nhánh Gemini 2.5.                                                                                           |
| **TC-ARGON-09** | `streaming/utils.ts`<br>`getStreamTimeout`                                                                    | `("gemini-4-argon", "medium")`<br>`("gemini-4-argon-preview", "low")`                                                    | `900000` (15 phút = `TIMEOUT_CONFIG.ARGON`)                                                                                                                                                                                                                      | Khớp khuyến nghị timeout $\ge 15$ phút của Google cho Gemini 4 Argon; giữ nguyên `FLASH` và `PRO`.                                                                                      |
| **TC-ARGON-10** | `streaming/gemini-stream.ts`<br>`createChatReadableStream`                                                    | `model: "gemini-4-argon"` với `thinkingLevel: "high"`, `"minimal"`, `"off"`, và lỗi 403 Free-tier / `StreamTimeoutError` | `"high"` $\rightarrow$ `{ thinkingLevel: "high", includeThoughts: true }`; `"minimal"` và `"off"` $\rightarrow$ `{ thinkingLevel: "low", includeThoughts: true }`; lỗi 403 $\rightarrow$ `MODEL_TIER_RESTRICTED` (gọi SDK 1 lần, không retry `[TOOLS FALLBACK]`) | Đảm bảo thinking luôn được cấu hình tường minh trên Argon, không truyền sampling params, và không retry vô ích khi API key thiếu quyền tier hoặc timeout.                               |
| **TC-ARGON-11** | `useThinkingLevel.ts`<br>`modelSupportsThinkingUI`, `getAvailableThinkingLevels`, `getEffectiveThinkingLevel` | `currentModel: "gemini-4-argon"`, `requestedLevel: "minimal"` hoặc `"off"`                                               | `supports === true`<br>`available === ["low", "medium", "high"]` (không có `"off"`)<br>`effective === "low"` cho cả `"minimal"` và `"off"`                                                                                                                       | Đảm bảo UI không hiển thị tùy chọn `"off"` giả tạo cho Argon, tự động ánh xạ `"off"`/`"minimal"` sang `"low"`, và bảo toàn 25/25 unit tests hiện có của Claude/GLM/DeepSeek/Gemini 2.5. |
| **TC-ARGON-12** | `translations/index.test.ts`                                                                                  | Khóa `"gemini-4-argon"` và `"modelDescArgon4"`                                                                           | Tồn tại và là chuỗi khác rỗng trong cả `en.ts` và `vi.ts`                                                                                                                                                                                                        | Đảm bảo tính đối xứng từ điển song ngữ Anh - Việt.                                                                                                                                      |

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

1. **Co-located Unit Tests**:
   - [`src/lib/core/modelRegistry.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.test.ts): Kiểm thử **TC-ARGON-01**, **TC-ARGON-03**, **TC-ARGON-04**, **TC-ARGON-05**.
   - [`src/lib/core/limits.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.test.ts) & [`src/lib/features/chat/conversations.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.test.ts): Kiểm thử **TC-ARGON-02** (cưỡng chế `assertModelAllowedForUser` ở tầng core limits và tầng lưu/cập nhật hội thoại).
   - `src/lib/core/contextCache.test.ts` (`[NEW]`): Kiểm thử **TC-ARGON-06** và **TC-ARGON-07** (mock `@/lib/core/genaiClient`, cô lập `activeCacheNames`).
   - `src/app/api/chat-stream/contextBuilder.test.ts` (`[NEW]`): Kiểm thử **TC-ARGON-08** (`setupToolsAndSafety` cho `gemini-4-argon`, `gemini-3-flash-preview`, và `gemini-2.5-flash`).
   - [`src/app/api/chat-stream/streaming/gemini-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.test.ts): Kiểm thử **TC-ARGON-09** (`getStreamTimeout` được đặt cùng file test này vì chưa có `utils.test.ts` riêng và `gemini-stream` là caller trực tiếp duy nhất của `getStreamTimeout`) và **TC-ARGON-10**.
   - [`src/app/features/chat/components/hooks/useThinkingLevel.test.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.test.ts): Kiểm thử **TC-ARGON-11**.
   - [`src/lib/utils/translations/index.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/index.test.ts): Kiểm thử **TC-ARGON-12**.
2. **Lệnh chạy kiểm thử và chất lượng (Verification Gate Tier 2)**:
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   npm run verify
   ```
   _(Thực thi tuần tự: xóa artefact `.next` cũ, sau đó chạy `npm run type-check && npm run lint && npm run test:run`)_.

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risks & Technical Controls)

| STT    | Rủi Ro Kỹ Thuật Tiềm Ẩn                                                                                                                                                                                                                                                                                                                                                                                                                                          | Mức Độ         | Phương Án Phòng Ngừa & Technical Control Trong Mã Nguồn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **Lỗi HTTP 400 từ Gemini API khi gọi Explicit Context Caching (`ai.caches.create`) trên `gemini-4-argon`**: Tài liệu Google xác nhận `gemini-4-argon` không hỗ trợ `cachedContents` / `caches.create`. Nếu `createGeminiStream` gọi `getOrCreateCompositeCache`, mỗi request có system prompt $\ge 4,096$ ký tự sẽ gặp lỗi API 400.                                                                                                                              | **Cao**        | **Technical Control**: Chặn trực tiếp tại [`src/lib/core/contextCache.ts:122`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L122) và [`contextCache.ts:216`](file:///c:/Users/wyemh/vikini/src/lib/core/contextCache.ts#L216) bằng điều kiện `if (!model.startsWith("gemini-") \|\| model.startsWith("gemini-4")) return null;`. Kiểm chứng bằng unit test **TC-ARGON-06** trong `contextCache.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                               |
| **R2** | **Mất khả năng gọi công cụ (`codeExecution`, `functionDeclarations`) khi bật Web Search trên `gemini-4-argon`**: Trong [`contextBuilder.ts:118`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/contextBuilder.ts#L118), biến `isGemini3 = model.startsWith("gemini-3")` trả về `false` cho `"gemini-4-argon"`, khiến hệ thống xử lý `gemini-4-argon` như Gemini 2.5 (chỉ gửi `googleSearch` đơn độc và bỏ qua `includeServerSideToolInvocations: true`). | **Cao**        | **Technical Control**: Cập nhật [`src/app/api/chat-stream/contextBuilder.ts:118`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/contextBuilder.ts#L118) thành `const isGemini3Or4 = model.startsWith("gemini-3") \|\| model.startsWith("gemini-4");`. Kiểm chứng bằng **TC-ARGON-08** trong `contextBuilder.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **R3** | **Sai lệch trạng thái Thinking và phát sinh chi phí ngầm do `gemini-4-argon` không cho phép tắt thinking (`"off"`)**: Trên Gemini 4 Argon, nếu không gửi `thinkingConfig` (khi user chọn `"off"`), model vẫn tự suy luận ở mức `"medium"` (tính phí `$10`–`$20/1M` tokens) trong khi UI báo `"OFF"`.                                                                                                                                                             | **Cao**        | **Technical Control**: (1) Trên UI, `getAvailableThinkingLevels("gemini-4-argon")` tại [`useThinkingLevel.ts:96`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.ts#L96) và `options` tại [`ThinkingLevelSelector.tsx:57`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ThinkingLevelSelector.tsx#L57) chỉ trả về `["low", "medium", "high"]` (ẩn `"off"`) và ánh xạ `"off"`/`"minimal"` từ `localStorage` sang `"low"`; (2) Ở server, [`gemini-stream.ts:153-175`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L153-L175) luôn gửi `thinkingConfig` với `"off"`/`"minimal"` được clamp tường minh về `"low"`. Kiểm chứng bằng **TC-ARGON-05**, **TC-ARGON-10**, **TC-ARGON-11**.                                                      |
| **R4** | **Ngắt kết nối sớm (Premature Stream Timeout) hoặc bị Serverless Function cắt ngang khi `gemini-4-argon` suy luận dài**: Google khuyến nghị client timeout $\ge 15$ phút cho Argon, trong khi `getStreamTimeout` hiện chỉ cấp `180,000ms` (do tên không chứa `"pro"`) và `src/app/api/chat-stream/route.ts` chưa khai báo `maxDuration`.                                                                                                                         | **Cao**        | **Technical Control**: (1) Thêm `ARGON: 900000` (15 phút) vào [`TIMEOUT_CONFIG`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/types.ts#L86) và cập nhật [`getStreamTimeout`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/utils.ts#L20) theo `normalizeModelForApi(model).startsWith("gemini-4")`; (2) Khai báo `export const maxDuration = 800;` trong [`src/app/api/chat-stream/route.ts:4`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/route.ts#L4) (trần tối đa 13m20s của Vercel Pro; self-hosted Node.js hưởng trọn 15 phút). Kiểm chứng bằng **TC-ARGON-09**.                                                                                                                                                                                                                |
| **R5** | **Vượt rào phân quyền (Privilege Escalation) gọi `gemini-4-argon` từ tài khoản rank `basic` hoặc trừ nhầm quota khi từ chối**: Trước đây `rank_configs.allowed_models` chỉ được kiểm tra ở UI (`useAllowedModels.ts`), nên user rank `basic` có thể gọi trực tiếp `PATCH /api/conversations` hoặc `POST /api/chat-stream` với `model: "gemini-4-argon"`.                                                                                                         | **Cao**        | **Technical Control**: Bổ sung `assertModelAllowedForUser(userId, model)` trong [`src/lib/core/limits.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/limits.ts#L430) (fail-closed) và cưỡng chế tại [`setConversationModel`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts#L483), [`doSaveConversation`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts#L368), [`conversationLoader.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.ts#L38), và [`handleChatStreamCore`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts#L118) (ném `AppError` ra `route.ts:108` và kiểm tra `if (response.ok)` trước `incrementDailyMessageCount`), kết hợp migration `20261014000000_add_gemini_4_argon.sql`. Kiểm chứng bằng **TC-ARGON-02**. |
| **R6** | **Lỗi HTTP 403/404 từ Gemini API khi `GEMINI_API_KEY` thuộc gói Free tier hoặc `StreamTimeoutError` bị retry nhân đôi vô ích**: `gemini-4-argon` chỉ mở cho Paid tier; khi gặp lỗi 403/404 hoặc timeout 15 phút, `runStreamWithFallback` hiện tại sẽ hiểu nhầm là lỗi công cụ và chạy lại `executeStream` lần 2 (`[TOOLS FALLBACK]`).                                                                                                                            | **Trung bình** | **Technical Control**: Cập nhật [`extractGeminiErrorInfo`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L529) và [`runStreamWithFallback`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts#L593) để thoát ngay khi `err instanceof StreamTimeoutError` hoặc `isNonRetryableClientError: true` (401/403/404 $\rightarrow$ `MODEL_TIER_RESTRICTED`), bỏ qua nhánh retry `[TOOLS FALLBACK]`. Kiểm chứng bằng **TC-ARGON-10** và **Bước 17 (Live Probe)**.                                                                                                                                                                                                                                                                                                          |

---

## Audit History

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5`)
- **Ngày**: 2026-10-14
- **Đối tượng**: Technical Plan Revision 1 (bản đầu tiên, plan chưa đánh số revision)
- **Kiểm chứng lỗi cũ**: N/A — đây là lần thẩm định đầu tiên.

#### A. Xác minh nguồn ngoài (`[URL]`, truy cập 2026-10-14)

| Claim trong plan                                                                                           | Kết quả                                                                                                                                                                   | Bằng chứng                                                                                                   |
| :--------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- |
| Model ID `gemini-4-argon`, context 1,048,576, output mặc định 64K                                          | ✅ Đúng                                                                                                                                                                   | `[URL]` `ai.google.dev/gemini-api/docs/latest-model`                                                         |
| Explicit caching (`cachedContents`/`caches.create`) không hỗ trợ; implicit caching ≥4,096 tokens, giảm 95% | ✅ Đúng                                                                                                                                                                   | `[URL]` như trên, mục Migration                                                                              |
| Thinking levels `low/medium/high`, default `medium`                                                        | ✅ Đúng — **nhưng** trang ghi rõ thinking **không thể tắt** (không có `off`)                                                                                              | `[URL]` như trên                                                                                             |
| `temperature/top_p/top_k` bị bỏ qua                                                                        | ✅ Đúng                                                                                                                                                                   | `[URL]` như trên                                                                                             |
| Tool combination + `includeServerSideToolInvocations` cho Gemini 4                                         | ✅ Đúng ("supported for Gemini 4 and Gemini 3 models", Preview)                                                                                                           | `[URL]` `ai.google.dev/gemini-api/docs/tool-combination`                                                     |
| Timeout 300s / 600s là "hợp lý"                                                                            | ❌ **Mâu thuẫn** — Migration checklist: _"Increase client timeouts to at least 15 minutes"_                                                                               | `[URL]` `latest-model`, Migration                                                                            |
| `generateContentStream` "hoàn toàn tương thích", trích "dòng 944–948"                                      | ⚠️ **UNVERIFIED** — trang không đề cập `generateContentStream`; checklist khuyến nghị `previous_interaction_id` (Interactions API) cho multi-turn. Không có `[CMD]` probe | `[URL]` + `[SRC]` `node_modules/@google/genai/package.json` = `2.10.0`, không có chuỗi "argon" trong `dist/` |
| Khả dụng                                                                                                   | ⚠️ Plan bỏ sót: _"not available on the Free tier or on the Google AI Pro plan"_                                                                                           | `[URL]` `latest-model`                                                                                       |

#### B. Mental Simulation Matrix (S1–S6)

| Kịch bản                                    | Kết quả               | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------------------------------------------ | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1 Cold-start & Build**                   | **PASS (có ghi chú)** | `[CMD]` `npm run type-check` → exit 2, chỉ 2 lỗi `TS2307` trong `.next/types/validator.ts` và `.next/dev/types/validator.ts` trỏ tới route đã xoá `src/app/api/files/[id]/analyze/route.js` (artefact build cũ, không phải lỗi `src/`). `[SRC]` `package.json:40,64,117` khớp bảng Verified Versions; không Prisma/Better Auth. `[SRC]` `MODEL_IDS` dùng được trong `modelRegistry.ts:6` (đã import). Không có env mới.                                                                                                                                                                                                                                                                                                                                                                                             |
| **S2 Lifecycle & Teardown**                 | **PASS (có ghi chú)** | `[SRC]` Plan không thêm tài nguyên mới; abort đi qua `abortSignal` có sẵn (`gemini-stream.ts:230`). `[SRC]` `contextCache.ts` giữ Map module-level `activeCacheNames` → `contextCache.test.ts` [NEW] phải cô lập state (`vi.resetModules()` + dynamic import, hoặc dùng `systemInstruction` khác nhau mỗi test), nếu không TC-ARGON-07 có thể dính cache HIT từ test trước. Plan chưa nêu — xem [MINOR]-4.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **S3 Database & Temporal**                  | **PASS**              | `[SRC]` Migration theo đúng mẫu idempotent `database-migrations/20261012000000_add_glm_5_2.sql` (`allowed_models` là `jsonb`, `src/types/database.types.ts:606`). `[ADV]` _Đồng thời_: chạy migration 2 lần song song → lần 2 bị lọc bởi `NOT (allowed_models @> ...)` → AN TOÀN. _TOCTOU_: `limits.ts` cache `rank_configs:all` 5 phút (`RANK_CONFIGS_TTL_SECONDS`) → model xuất hiện trễ ≤5 phút, chấp nhận được. _Thất bại giữa chừng_: 1 câu `UPDATE` atomic → AN TOÀN. _Serverless_: N/A (DDL/DML chạy một lần). Không đổi RLS/FK.                                                                                                                                                                                                                                                                             |
| **S4 Cross-Task State Flow**                | **FAIL**              | `[SRC]` `useThinkingLevel.ts:96-106` luôn prepend `"off"`; `getEffectiveThinkingLevel` trả `"off"` (`:113-115`); `gemini-stream.ts:162-175` khi `"off"` thì **không gửi `thinkingConfig`**. `[URL]` Argon không thể tắt thinking, default `medium`. `[ADV]` T1: user chọn `OFF` cho Argon (localStorage `vikini.thinkingLevel="off"`) → T2: UI hiển thị "THINKING: OFF" → T3: server gửi request không `thinkingConfig` → Argon suy luận ở mức `medium`, thinking token bị tính phí $10→$20/1M, timeout tính theo `effectiveThinkingLevel="off"`. Kết cục: UI nói dối trạng thái, chi phí ngầm → **LỖI (MAJOR-2)**.                                                                                                                                                                                                 |
| **S5 Security & 3-Tier Auth**               | **FAIL**              | `[SRC]` `rank_configs.allowed_models` **chỉ được dùng ở client** (`useAllowedModels.ts`, `/api/user/allowed-models/route.ts:21`). Server không kiểm tra: `setConversationModel` (`src/lib/features/chat/conversations.ts:482`) chỉ kiểm `isSelectableModelId(model)`; `conversationLoader.ts:59-60` lấy `convo.model` → `normalizeModelForApi`; `chat-stream/route.ts:41-105` chỉ kiểm session, daily limit, rate limit. `[ADV]` T1: user rank `basic` gọi `PATCH /api/conversations {id, model:"gemini-4-argon"}` → T2: server chấp nhận vì Argon thuộc `SELECTABLE_MODELS` sau Bước 2 → T3: `POST /api/chat-stream` stream Argon bằng API key trả phí của hệ thống. Kết cục: rank gating của R6 bị bypass hoàn toàn → **LỖI (BLOCKER-1)**. Thêm: `useAllowedModels.ts` fallback "allow all models" khi fetch lỗi. |
| **S6 External Resilience & Serverless Cap** | **FAIL**              | `[SRC]` `src/app/api/chat-stream/route.ts` **không khai báo `maxDuration`** (`grep maxDuration src/app/api/chat-stream` = rỗng; chỉ có `runtime = "nodejs"`), nên function bị cắt theo giới hạn mặc định của nền tảng trước khi `PRO_DEEP_THINKING=600000` (`streaming/types.ts:88`) có hiệu lực. `[URL]` Google yêu cầu client timeout ≥15 phút cho Argon. `[ADV]` T1: user chọn `high` → T2: Argon suy luận dài >5 phút → T3: serverless instance bị kill trước timeout ứng dụng → stream đứt không có `StreamErrorBanner` có kiểm soát. → **LỖI (MAJOR-1)**. Thêm: Argon không có ở Free tier → API key free trả 403/404; plan không có control/thông báo lỗi, và nhánh `[TOOLS FALLBACK]` (`gemini-stream.ts:~590`) sẽ retry lần 2 vô ích.                                                                      |
| **Domain Inquiry**                          | Ghi chú               | _Reasoning truncation_: `maxOutputTokens=65536` ≥ khuyến nghị 32,768 → OK. _i18n_: `translations/index.test.ts` đã có parity test vi/en → TC-ARGON-12 khả thi. _Attachments_: `attachmentProcessor.ts:197` `startsWith("gemini-")` → OK. _Thought signatures_: tool continuation dùng `allResponseParts` (`gemini-stream.ts:425`) → OK.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

#### C. Phân loại lỗi

**[BLOCKER]**

1. **BLOCKER-1 — Rank gating (R6) không phải technical control phía server.** R6 coi migration `rank_configs` là control giới hạn Argon cho `admin`/`pro`, nhưng `allowed_models` chưa bao giờ được enforce ở server (bằng chứng S5). Thêm một model trả phí cao (intro $10/1M output, tăng lên $20/1M từ 01/12/2026) vào `SELECTABLE_MODELS` sẽ mở nó cho mọi user đã approve qua API. Vi phạm `evidence-bar.md` §4.5.4 (control chưa xác minh) và nguyên tắc fail-closed của commit `b893d01`.
   - **Yêu cầu**: thêm bước enforce phía server trong `src/lib/` (ví dụ helper `assertModelAllowedForUser(userId, model)` trong `src/lib/core/limits.ts`, dùng `getUserLimits(userId).allowed_models`), gọi tại `setConversationModel`/`saveConversation` **và** tại `handleChatStreamCore` trước `createProviderStream` (phòng conversation cũ đã lưu model). Model không được phép → `ForbiddenError` (hoặc coerce về `DEFAULT_MODEL` có log), fail-closed khi không đọc được rank config. Kèm co-located test (happy path + basic user bị chặn + config lỗi → chặn) và cập nhật R6.
   - Nếu PM muốn tách thành task riêng: plan phải ghi rõ Argon **không** được thêm vào `SELECTABLE_MODELS` cho tới khi task đó merge, hoặc ghi nhận rủi ro được PM chấp thuận bằng văn bản trong plan.

**[MAJOR]**

1. **MAJOR-1 — Timeout & serverless cap sai so với đặc tả Argon.** Plan đặt 300s/600s, trong khi Google yêu cầu ≥15 phút, và route `chat-stream` không có `maxDuration`. Yêu cầu: (a) thêm `TIMEOUT_CONFIG` riêng cho Argon (ví dụ `ARGON: 900000`) thay vì tái dùng `PRO`; (b) khai báo `export const maxDuration = <N>` trong `src/app/api/chat-stream/route.ts` phù hợp gói hosting (≤800 trên Vercel Pro) và ghi rõ trade-off nếu không đạt 15 phút; (c) cập nhật R4 + TC-ARGON-09. Ưu tiên kiểm tra theo ID chuẩn hoá (`normalizeModelForApi(model).startsWith("gemini-4")`) thay vì `includes("argon")`.
2. **MAJOR-2 — Tuỳ chọn "OFF" không có thật trên Argon.** Plan (Bước 9, TC-ARGON-11, `docs/models.md` "off, low, medium, high") khẳng định hỗ trợ `off`, nhưng Argon không thể tắt thinking (S4). Yêu cầu: chọn và ghi rõ một chính sách, ví dụ server map `off` → `thinkingLevel: "low"` tường minh cho `gemini-4*` trong `gemini-stream.ts:162-175` (giới hạn chi phí, timeout đúng) **và** UI không hiển thị "OFF" cho Argon (hoặc hiển thị đúng ngữ nghĩa). Bổ sung test cho `thinkingLevel: "off"` + Argon ở cả `gemini-stream.test.ts` và `useThinkingLevel.test.ts`; sửa TC-ARGON-11 và nội dung `docs/models.md`.
3. **MAJOR-3 — Giả định 3.1.1 (tương thích `generateContentStream`) chưa xác minh, và chưa xử lý điều kiện "paid-tier only".** Nguồn trích dẫn không chứa thông tin đó (mục A). Yêu cầu: thêm bước Verification có probe thật (`npx tsx -e` gọi `ai.models.generateContentStream({ model: "gemini-4-argon", ... thinkingConfig })` bằng key staging, ghi exit code + chunk đầu) **trước** khi merge; thêm rủi ro "API key không đủ tier → 403/404" với control cụ thể (mapping lỗi rõ ràng qua `extractGeminiErrorInfo`, không retry `[TOOLS FALLBACK]` với lỗi 4xx quyền truy cập) và test tương ứng.
4. **MAJOR-4 — Test Contract đặt TC-ARGON-08 sai file và thiếu trong danh sách file.** §8 gán TC-ARGON-08 (`setupToolsAndSafety`) vào `gemini-stream.test.ts`, nhưng hàm nằm ở `src/app/api/chat-stream/contextBuilder.ts` và không có `contextBuilder.test.ts`. Yêu cầu: thêm `[NEW] src/app/api/chat-stream/contextBuilder.test.ts` vào §5 với TC-ARGON-08 + regression Gemini 2.5 (search đơn lẻ, không `toolConfig`) và Gemini 3. Tương tự, TC-ARGON-09 (`getStreamTimeout` ở `streaming/utils.ts`) nên nằm trong test của `utils` (hoặc ghi rõ lý do gộp vào `gemini-stream.test.ts`).

**[MINOR]**

1. Bước 1: snippet `MODEL_IDS` liệt kê các khoá **không tồn tại** (`GEMINI_25_FLASH`, `GEMINI_25_PRO`, `GEMINI_31_PRO_PREVIEW`, `GEMINI_3_FLASH_PREVIEW`, `GEMINI_31_FLASH_LITE_PREVIEW`) và yêu cầu chèn "ngay trên dòng `GEMINI_31_PRO_PREVIEW`" (`[SRC]` `constants.ts:17-31` chỉ có Image Studio/Claude/DeepSeek/GLM). Sửa thành: thêm khoá `GEMINI_4_ARGON` dưới comment `// Gemini models`, không thêm khoá khác.
2. Trích dẫn dòng sai: thinking config nằm ở `gemini-stream.ts:153-175` (clamp ở `:166`), không phải `:539-578`/`:554`.
3. `src/app/features/chat/components/hooks/useChatTranslations.ts:42-59` có danh sách khoá model hardcode; nên thêm `"gemini-4-argon"`, `"modelDescArgon4"` cho nhất quán (không ảnh hưởng chức năng vì `ModelSelector.tsx:70` dùng `useLanguage`).
4. `contextCache.test.ts`: ghi rõ chiến lược cô lập Map `activeCacheNames` (xem S2) và mock `@/lib/core/genaiClient` (`contextCache.ts:12`); thêm case `getOrCreateKBCache` với `deepseek` để đủ "1 error case" theo `01-coding.md`.
5. `streaming/utils.ts:isGemini3Model` hiện chỉ được re-export (`streaming/index.ts:8`), không có caller — sửa vô hại nhưng không cần thay đổi cách so khớp (`toLowerCase()`) như snippet Bước 7 đề xuất.
6. Bước 14: xoá `.next/` trước `npm run verify`, nếu không `type-check` fail giả do artefact cũ (S1).
7. Alias `"gemini-4.0-argon"` không có nguồn chính thức — cân nhắc bỏ để tránh đăng ký ID suy đoán.

#### D. Kết luận

**[CHANGES_REQUESTED]** — Còn 1 `[BLOCKER]` và 4 `[MAJOR]`. Việc cần làm trong Revision 2:

1. Thêm control phía server cho `allowed_models` (BLOCKER-1) và cập nhật R6, có test.
2. Sửa timeout Argon theo yêu cầu ≥15 phút + khai báo `maxDuration` cho `chat-stream` (MAJOR-1).
3. Chọn chính sách cho `off` trên Argon (server map + UI), sửa TC-ARGON-11 và docs (MAJOR-2).
4. Thêm bước probe thật cho `generateContentStream` + rủi ro/control cho tier trả phí (MAJOR-3).
5. Thêm `contextBuilder.test.ts` vào §5/§8, đặt lại TC-ARGON-08/09 (MAJOR-4).
6. (Tuỳ chọn) xử lý các mục MINOR 1–7.

---

### Audit Run 2

**[REVIEWER_MODEL: gemini-4-argon]**

#### 1. Kiểm Chứng Lỗi Cũ (Old Error Verification)

- **`BLOCKER-1` (Thiếu kiểm tra quyền dùng model phía server cho `allowed_models`)**: **`SỬA MỘT PHẦN`** (Phát sinh lỗi mới — xem `MAJOR-NEW-3`).
  - _Bằng chứng `[SRC]`_: Revision 2 đã bổ sung hàm `assertModelAllowedForUser(userId, modelId)` tại `src/lib/core/limits.ts` (Bước 3.1) và gọi tại `setConversationModel` + `doSaveConversation` (`src/lib/features/chat/conversations.ts:466-511, 567-613`, Bước 4.1–4.2) cũng như `handleChatStreamCore` (`src/app/api/chat-stream/chatStreamCore.ts:98-120`, Bước 5.3).
  - _Điểm chưa đạt_:
    1. Tại `src/app/api/chat-stream/chatStreamCore.ts:98-120` (Bước 5.3), việc bọc `assertModelAllowedForUser` trong `try/catch` rồi `return errorFromAppError(e)` trả về một đối tượng `Response` (HTTP 403/503) về cho caller `POST` tại `src/app/api/chat-stream/route.ts:97`. Do `handleChatStreamCore` không throw exception mà return `Response`, luồng thực thi tại `src/app/api/chat-stream/route.ts:101-106` vẫn chạy tiếp `await incrementDailyMessageCount(userId)` và `perfMonitor.end(200, { streaming: true })`. Hậu quả: user bị chặn 403 do không có quyền dùng model vẫn bị trừ quota tin nhắn hàng ngày và metric ghi nhận status 200.
    2. Tại `src/app/api/chat-stream/conversationLoader.ts:38-41`, lệnh gọi `await saveConversation(...)` nằm trong khối `try { ... } catch (saveErr) { throw new Error(\`Failed to create new conversation: \${errorMsg}\`); }`. Khi `doSaveConversation`ném`ForbiddenError`(403) hoặc`ServiceUnavailableError`(503) từ`assertModelAllowedForUser`, `conversationLoader.ts:40`nuốt mất kiểu`AppError`và bọc lại thành`Error`thường, khiến`route.ts:112` trả về HTTP 500 thay vì 403/503.
    3. Tại `src/lib/core/limits.ts:1-16`, file hiện chỉ import `{ ServiceUnavailableError } from "@/lib/utils/errors"` (dòng 7) và chưa có import `ForbiddenError` hay `DEFAULT_MODEL, normalizeModelForApi, coerceStoredModel` từ `@/lib/core/modelRegistry`. Bước 3.1 cần ghi rõ các câu lệnh import cần bổ sung.

- **`MAJOR-1` (Timeout 5 phút & giới hạn serverless < 15 phút)**: **`SỬA MỘT PHẦN`** (Phát sinh lỗi mới — xem `MAJOR-NEW-2`).
  - _Bằng chứng `[SRC]`_: Revision 2 đã thêm `export const maxDuration = 800;` vào `src/app/api/chat-stream/route.ts` (Bước 5.1) và `ARGON: 900000` (15 phút) vào `TIMEOUT_CONFIG` (Bước 9.2), đồng thời nêu rõ giới hạn trần 800s của Vercel Pro trong R4 (§7).
  - _Điểm chưa đạt_:
    1. Snippet Bước 9.2 (`src/app/api/chat-stream/streaming/types.ts:86-92`) thay thế `TIMEOUT_CONFIG` bằng object chứa `IMAGE_GENERATION` và `SECOND_STEP` (không tồn tại trong file thật) và làm mất 2 hằng số đang có trong code thật là `FLASH: 240000` và `FLASH_DEEP_THINKING: 480000` (`[SRC]` `src/app/api/chat-stream/streaming/types.ts:86-92`).
    2. Snippet Bước 9.3 (`src/app/api/chat-stream/streaming/utils.ts:7-31`) thêm từ khoá `export` trực tiếp vào `export function getStreamTimeout(...)`, trong khi cuối file `src/app/api/chat-stream/streaming/utils.ts:215` đã có `export { getStreamTimeout, createStreamTimeout, resetStreamTimeout };` — dẫn tới lỗi biên dịch TypeScript duplicate export. Đồng thời snippet Bước 9.3 làm mất nhánh đọc `process.env.STREAM_TIMEOUT_MS` (`utils.ts:9-15`) và nhánh `model.includes("flash")` (`utils.ts:25-27`).

- **`MAJOR-2` (Tùy chọn `"off"` trên Argon mâu thuẫn giữa server, UI và tài liệu Google)**: **`SỬA MỘT PHẦN`** (Phát sinh lỗi mới — xem `MAJOR-NEW-1`).
  - _Bằng chứng `[SRC]`_: Phía server tại `src/app/api/chat-stream/streaming/gemini-stream.ts:153-175` (Bước 10.1) đã ép `level === "off"` về `"LOW"` cho Argon. Tuy nhiên, phần UI tại Bước 11.1 (`src/app/features/chat/components/hooks/useThinkingLevel.ts:96-152`) và Bước 11.2 (`src/app/features/chat/components/ThinkingLevelSelector.tsx:57-71`) chứa code giả định không khớp với codebase thật, làm hỏng các model hiện hữu và không biên dịch được (chi tiết tại `MAJOR-NEW-1`).

- **`MAJOR-3` (Thiếu kiểm chứng `generateContentStream` & xử lý lỗi tier trả phí 403/404)**: **`SỬA MỘT PHẦN`** (Xem `MINOR-NEW-1` & `MINOR-NEW-2`).
  - _Bằng chứng `[SRC]`_: Revision 2 đã bổ sung Bước 17 (Live API Probe cho `generateContentStream` và `caches.create`) và cập nhật `extractGeminiErrorInfo` tại `src/app/api/chat-stream/streaming/gemini-stream.ts:529-657` (Bước 10.2) để không retry khi gặp 401/403/404 (`isNonRetryableClientError`).
  - _Điểm chưa đạt_:
    1. Bước 17 (dòng 537) dùng `thinkingLevel: "low" as any`, vi phạm quy tắc cấm `any` tại `.agents/rules/01-coding.md:29` (nên import `ThinkingLevel` từ `@google/genai` và dùng `ThinkingLevel.LOW`).
    2. Tại `src/app/api/chat-stream/streaming/gemini-stream.ts:244-255, 592-644`, khi `StreamTimeoutError` xảy ra sau 15 phút chờ Argon, `executeStream` gửi `STREAM_TIMEOUT` xuống client rồi rethrow `err`; `runStreamWithFallback` bắt `err` và (nếu request có `tools`) vẫn thực hiện retry lần 2 qua nhánh `[TOOLS FALLBACK]` vì điều kiện chặn retry chỉ kiểm tra `!errorInfo.isNonRetryableClientError` mà chưa kiểm tra `!(err instanceof StreamTimeoutError)`.

- **`MAJOR-4` (Thiếu `contextBuilder.test.ts` & đặt sai chỗ `TC-ARGON-08`, `TC-ARGON-09`)**: **`ĐÃ SỬA`**.
  - _Bằng chứng `[SRC]`_: Đã thêm `src/app/api/chat-stream/contextBuilder.test.ts` vào §5 (dòng 122), Bước 8.2 (dòng 350–353) và §8 (dòng 480–481), kiểm thử trực tiếp `buildContextAndTools` tại `src/app/api/chat-stream/contextBuilder.ts:108-153`.

- **`MINOR-1` (Snippet Bước 1 làm hỏng `MODEL_IDS` trong `src/lib/utils/constants.ts:17-31`)**: **`CHƯA SỬA`** — Nâng mức độ lên **`MAJOR-NEW-4`** vì nếu thực thi theo snippet Bước 1 sẽ gây lỗi biên dịch và làm gãy unit test hiện hữu.
- **`MINOR-2` (Sai số dòng trong `gemini-stream.ts`)**: **`ĐÃ SỬA`** (`[SRC]` `src/app/api/chat-stream/streaming/gemini-stream.ts:153-175, 529-657`).
- **`MINOR-3` (Thiếu cập nhật `useChatTranslations.ts`)**: **`ĐÃ SỬA`** (`[SRC]` `src/app/features/chat/components/hooks/useChatTranslations.ts:42-59`, Bước 13.3).
- **`MINOR-4` (Chiến lược cô lập `activeCacheNames` trong `contextCache.test.ts`)**: **`ĐÃ SỬA`** (`[SRC]` `src/lib/core/contextCache.ts:12,45`, Bước 7.2 & §8 dòng 477–478).
- **`MINOR-5` (`streaming/utils.ts:isGemini3Model`)**: **`SỬA MỘT PHẦN`** — Bước 9.4 ghi tên biến mảng là `gemini3Models`, nhưng trong `src/app/api/chat-stream/streaming/utils.ts:153` tên biến thật là `gemini3Identifiers`.
- **`MINOR-6` (Xoá `.next/` trước `npm run verify`)**: **`ĐÃ SỬA`** (Bước 16, dòng 516–521).
- **`MINOR-7` (Bỏ alias suy đoán `"gemini-4.0-argon"`)**: **`ĐÃ SỬA`** (Bước 2.1, dòng 180–213 chỉ đăng ký `"gemini-4-argon"`).

---

#### 2. Phát Hiện Mới (New Findings)

##### `[MAJOR-NEW-1]` — Snippet Bước 11.1 và 11.2 không khớp cấu trúc thật của `useThinkingLevel.ts` và `ThinkingLevelSelector.tsx`, làm gãy 8 unit test hiện hữu và lỗi biên dịch

- **Bằng chứng**:
  - `[SRC]` Trong `src/app/features/chat/components/hooks/useThinkingLevel.ts:96-114`, hàm `getAvailableThinkingLevels(model?: string): ThinkingLevel[]` hiện tại kiểm tra lần lượt:
    - `isGemini3Model(model) || isGemini25Model(model)` -> trả về `["off", "low", "high"]`
    - `isGLMModel(model)` -> trả về `["off", "high"]`
    - `isClaudeThinkingModel(model)` -> trả về `["off", "low", "medium", "high"]`
    - `isDeepSeekV4Model(model)` -> trả về `["off", "high"]`
      Snippet Bước 11.1 (dòng 404–413) ghi đè hàm này bằng 4 dòng chỉ còn `isArgonModel`, `isGemini3Model`, `isGemini25Model` (đổi thành `["off", "high"]`), xóa toàn bộ nhánh `isGLMModel`, `isClaudeThinkingModel`, `isDeepSeekV4Model`. Tương tự, `getEffectiveThinkingLevel` trong Bước 11.1 (dòng 415–425) cũng xóa toàn bộ logic validate của các họ model khác tại `useThinkingLevel.ts:120-152`.
  - `[CMD]` Chạy `npx vitest run src/app/features/chat/components/hooks/useThinkingLevel.test.ts` hiện pass 25/25 tests; nếu áp dụng Bước 11.1 sẽ làm fail ít nhất 8 test cases tại `src/app/features/chat/components/hooks/useThinkingLevel.test.ts:70-122` (kiểm tra Gemini 2.5 trả về `["off", "low", "high"]`, Claude Sonnet/Haiku trả về 4 mức, GLM-5.2 trả về `["off", "high"]`, DeepSeek V4 trả về `["off", "high"]`).
  - `[SRC]` Trong `src/app/features/chat/components/ThinkingLevelSelector.tsx:46-76`, component **không hề gọi** `getAvailableThinkingLevels` và **không có** biến `levels` hay `availableLevels` như snippet Bước 11.2 (dòng 431–442) mô tả. Thay vào đó, file thật dựng mảng `options: ThinkingOption[]` bằng chuỗi toán tử ba ngôi (`isClaude ? [...] : isDeepSeek ? [...] : isGLM ? [...] : [...]`). Ngoài ra, `useThinkingLevel.ts:154-223` còn có state khởi tạo (dòng 159), `useEffect` (dòng 169–185) và `cycleThinkingLevel` (dòng 199–209) tự định nghĩa lại `availableLevels` nội bộ chưa xử lý model Argon (mặc định khởi tạo `"off"` và xoay vòng qua `"off"`).
- **Yêu cầu sửa**:
  - Trong `src/app/features/chat/components/hooks/useThinkingLevel.ts`: Giữ nguyên toàn bộ nhánh của Gemini 2.5, GLM, Claude, DeepSeek; chỉ bổ sung helper `isGeminiArgonModel(model?: string): boolean` (khớp `model?.toLowerCase() === "gemini-4-argon"`), thêm nhánh `if (isGeminiArgonModel(model)) return ["low", "high"];` lên đầu `getAvailableThinkingLevels`, cập nhật `getEffectiveThinkingLevel` (nếu `isGeminiArgonModel(model)` và level khác `"low"`/`"high"` thì trả về `"low"`), và cập nhật cả `useThinkingLevel` hook (`useEffect` dòng 169–185 và `cycleThinkingLevel` dòng 199–209) để sử dụng `getAvailableThinkingLevels(currentModel)` hoặc nhánh Argon tương ứng.
  - Trong `src/app/features/chat/components/ThinkingLevelSelector.tsx:46-76`: Thêm `const isArgon = currentModel?.toLowerCase() === "gemini-4-argon";` và thêm nhánh đầu tiên vào biểu thức khởi tạo `options`: `isArgon ? [{ value: "low", ... }, { value: "high", ... }] : ...`.

##### `[MAJOR-NEW-2]` — Snippet Bước 9.2 và 9.3 làm mất cấu hình timeout Flash, mất biến môi trường `STREAM_TIMEOUT_MS` và gây lỗi duplicate export trong `streaming/utils.ts`

- **Bằng chứng**:
  - `[SRC]` `src/app/api/chat-stream/streaming/types.ts:86-92` hiện có:
    ```ts
    const TIMEOUT_CONFIG = {
      DEFAULT: 180000, // 3 minutes for normal models
      DEEP_THINKING: 360000, // 6 minutes for deep thinking models
      FLASH: 240000, // 4 minutes for Gemini 3 Flash
      FLASH_DEEP_THINKING: 480000, // 8 minutes for Gemini 3 Flash with deep thinking
    } as const;
    ```
    Snippet Bước 9.2 (dòng 359–366) xóa mất `FLASH` và `FLASH_DEEP_THINKING`, thay bằng `IMAGE_GENERATION` và `SECOND_STEP` không tồn tại.
  - `[SRC]` `src/app/api/chat-stream/streaming/utils.ts:7-31` hiện đọc `process.env.STREAM_TIMEOUT_MS` (dòng 9–15), kiểm tra `model.includes("flash")` dùng `TIMEOUT_CONFIG.FLASH_DEEP_THINKING` / `TIMEOUT_CONFIG.FLASH` (dòng 25–27), và cuối file tại dòng 215 đã có `export { getStreamTimeout, createStreamTimeout, resetStreamTimeout };`. Snippet Bước 9.3 (dòng 371–378) xóa mất logic `STREAM_TIMEOUT_MS` + `flash`, đồng thời khai báo `export function getStreamTimeout` gây lỗi biên dịch duplicate export với dòng 215.
- **Yêu cầu sửa**:
  - Bước 9.2: Giữ nguyên `DEFAULT`, `DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING` trong `TIMEOUT_CONFIG` và chỉ thêm `ARGON: 900000`.
  - Bước 9.3: Giữ nguyên hàm `function getStreamTimeout(model: string, thinkingLevel?: string): number` (không thêm `export` ở đầu hàm vì đã export ở dòng 215), giữ nguyên khối kiểm tra `process.env.STREAM_TIMEOUT_MS`, và chỉ chèn nhánh `if (normalizedModel.includes("argon")) { return TIMEOUT_CONFIG.ARGON; }` ngay sau khối `envTimeout` (trước nhánh `if (normalizedModel.includes("flash"))`).
  - Bước 9.4: Sửa tên biến trong mô tả từ `gemini3Models` thành `gemini3Identifiers` cho khớp với `src/app/api/chat-stream/streaming/utils.ts:153`.

##### `[MAJOR-NEW-3]` — Lỗi xử lý luồng lỗi của `assertModelAllowedForUser` làm tăng nhầm bộ đếm quota tin nhắn (`incrementDailyMessageCount`) và trả sai HTTP status khi tạo hội thoại mới

- **Bằng chứng**:
  - `[SRC]` Tại `src/app/api/chat-stream/route.ts:97-106`:
    ```ts
    const response = await handleChatStreamCore(context, req);
    if (userId) {
      await incrementDailyMessageCount(userId);
    }
    perfMonitor.end(200, { streaming: true });
    return response;
    ```
    Trong Bước 5.3 (dòng 305–312), `handleChatStreamCore` bắt `try { await assertModelAllowedForUser(...); } catch (e) { if (e instanceof AppError) return errorFromAppError(e); throw e; }`. Khi `handleChatStreamCore` trả về `Response` 403/503 thay vì ném `AppError`, `route.ts:101` vẫn coi như thành công và gọi `await incrementDailyMessageCount(userId)` (trừ mất 1 lượt chat trong ngày của user dù request bị từ chối 403) và log `perfMonitor.end(200, ...)`. Ngược lại, nếu để `assertModelAllowedForUser` throw trực tiếp `AppError` ra ngoài `handleChatStreamCore`, khối `catch (error)` sẵn có tại `src/app/api/chat-stream/route.ts:108-112` (`if (error instanceof AppError) { perfMonitor.end(error.statusCode, { error: error.code }); return errorFromAppError(error); }`) sẽ xử lý đúng status code và không gọi `incrementDailyMessageCount`.
  - `[SRC]` Tại `src/app/api/chat-stream/conversationLoader.ts:31-42`, khi request chưa có `conversationId`, `loadOrCreateConversation` gọi `await saveConversation(userEmail, { title, model, ... })`. Nếu user gửi model không được phép cho cuộc hội thoại mới, `doSaveConversation` ném `ForbiddenError` (kế thừa `AppError`), nhưng `conversationLoader.ts:38-41` bắt `catch (saveErr)` và `throw new Error(\`Failed to create new conversation: \${errorMsg}\`)`, làm mất instance `AppError`trước khi tới`handleChatStreamCore`hay`route.ts:108`.
- **Yêu cầu sửa**:
  - Trong Bước 5.3 (`src/app/api/chat-stream/chatStreamCore.ts`): Đặt lệnh `await assertModelAllowedForUser(userId, effectiveModel);` (không bọc `try/catch return errorFromAppError`) và đặt **trước** hoặc đảm bảo `conversationLoader.ts:38-41` rethrow nếu `saveErr instanceof AppError` (`if (saveErr instanceof AppError) throw saveErr;`).
  - Trong Bước 3.1 (`src/lib/core/limits.ts`): Ghi rõ việc thêm `ForbiddenError` vào câu lệnh import từ `@/lib/utils/errors` (dòng 7) và import `DEFAULT_MODEL, normalizeModelForApi, coerceStoredModel` từ `@/lib/core/modelRegistry`.

##### `[MAJOR-NEW-4]` — Snippet Bước 1 (`src/lib/utils/constants.ts`) vẫn ghi đè sai hàng loạt hằng số `MODEL_IDS` hiện hữu (tồn đọng từ `MINOR-1` của Audit Run 1)

- **Bằng chứng**:
  - `[SRC]` Đối chiếu `src/lib/utils/constants.ts:17-31` với snippet Bước 1 (dòng 151–168 của kế hoạch):
    - `IMAGE_STUDIO`: code thật là `"vikini-image-studio"`, snippet đổi thành `"image-studio"`.
    - `USER_TEMPLATES_STORE`: code thật là `"user_templates_store"`, snippet đổi thành `"__user_templates__"`.
    - `CLAUDE_SONNET_45`: code thật là `"claude-sonnet-4-5-20250929"`, snippet đổi thành `"claude-sonnet-4-5"`.
    - `CLAUDE_HAIKU_45`: code thật là `"claude-haiku-4-5-20251001"`, snippet đổi thành `"claude-haiku-4-5"`.
    - `DEEPSEEK_V4_PRO`: code thật là `"deepseek-v4-pro"`, snippet đổi thành `"deepseek-v4"`.
    - Xoá mất `DEEPSEEK_V41_FLASH: "deepseek-v4.1-flash"` và `DEEPSEEK_V32: "deepseek-v3.2"`.
    - Đổi tên key `GLM_52` thành `GLM_5_2`, làm gãy trực tiếp `src/lib/core/modelRegistry.ts:328,364,365` (`MODEL_IDS.GLM_52`) và `src/lib/core/modelRegistry.test.ts:88` (`MODEL_IDS.GLM_52`).
- **Yêu cầu sửa**:
  - Sửa lại snippet Bước 1 sao cho giữ nguyên toàn bộ các key/value hiện có tại `src/lib/utils/constants.ts:17-31` và chỉ thêm duy nhất dòng `GEMINI_ARGON: "gemini-4-argon",`.

##### `[MINOR-NEW-1]` — Sử dụng `as any` trong Bước 17 vi phạm `.agents/rules/01-coding.md`

- **Bằng chứng**:
  - `[SRC]` Bước 17 (dòng 537) viết: `config: { thinkingConfig: { includeThoughts: true, thinkingLevel: "low" as any } }`. Quy tắc tại `.agents/rules/01-coding.md:29` quy định: _"No `any` types without strong justification - use `unknown` and type guards instead"_. Package `@google/genai` (v1.34.0, đã kiểm chứng trong `src/app/api/chat-stream/streaming/gemini-stream.ts:9,166`) đã export sẵn enum `ThinkingLevel` (`ThinkingLevel.LOW`).
- **Yêu cầu sửa**: Import `ThinkingLevel` từ `@google/genai` trong lệnh probe ở Bước 17 và dùng `thinkingLevel: ThinkingLevel.LOW`.

##### `[MINOR-NEW-2]` — `runStreamWithFallback` vẫn retry lần 2 khi gặp `StreamTimeoutError` (sau 15 phút) nếu có `tools`

- **Bằng chứng**:
  - `[SRC]` Tại `src/app/api/chat-stream/streaming/gemini-stream.ts:244-255`, khi `StreamTimeoutError` xảy ra, `executeStream` gửi `STREAM_TIMEOUT` xuống controller rồi `throw err;`. Tại `gemini-stream.ts:592-615`, `runStreamWithFallback` bắt `err` và kiểm tra `if (tools && Array.isArray(tools) && tools.length > 0 && !errorInfo.isNonRetryableClientError)` — do `StreamTimeoutError` không có mã 401/403/404 nên `isNonRetryableClientError` là `false`, dẫn đến việc server tự động gọi lại `executeStream` lần 2 không có tools và nếu lỗi tiếp sẽ gửi thêm một frame `ERROR` chồng lên sau frame `STREAM_TIMEOUT`.
- **Yêu cầu sửa**: Tại Bước 10.2 (`src/app/api/chat-stream/streaming/gemini-stream.ts:592-644`), bổ sung kiểm tra `if (err instanceof StreamTimeoutError) { return; }` trong `catch (err)` của `runStreamWithFallback` (vì `executeStream` đã gửi `STREAM_TIMEOUT` event tới client ở dòng 246–253).

---

#### 3. Mental Simulation Verification Matrix

| Bước / Thay đổi                                                                                  | Happy Path                                                          | Input Rỗng / Null                                                                                                | Timeout / Lỗi Mạng                                                                                                    | Xung Đột Luồng (Concurrency)                                | Kết quả                                                                                                                                                                              |
| :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bước 1–2**: `constants.ts` & `modelRegistry.ts`                                                | Đăng ký `"gemini-4-argon"` vào `MODEL_REGISTRY`                     | `normalizeModelForApi(null)` trả về `DEFAULT_MODEL`                                                              | N/A (đồng bộ)                                                                                                         | Read-only registry, an toàn                                 | **FAIL** (`MAJOR-NEW-4`: Snippet Bước 1 làm mất `GLM_52`, `DEEPSEEK_V41_FLASH`, đổi `IMAGE_STUDIO`)                                                                                  |
| **Bước 3–5**: `assertModelAllowedForUser` (`limits.ts`, `conversations.ts`, `chatStreamCore.ts`) | User có `"gemini-4-argon"` trong `allowed_models` vượt qua kiểm tra | `allowed_models = []` hoặc `null` -> chỉ cho phép `DEFAULT_MODEL`; DB lỗi -> ném `ServiceUnavailableError` (503) | Lỗi kết nối Supabase -> fail-closed 503 (`ServiceUnavailableError`)                                                   | Kiểm tra stateless theo mỗi request                         | **FAIL** (`MAJOR-NEW-3`: `chatStreamCore.ts` return `Response` thay vì throw khiến `route.ts:101` vẫn tăng `incrementDailyMessageCount`; `conversationLoader.ts:40` nuốt `AppError`) |
| **Bước 7–8**: `contextCache.ts` & `contextBuilder.ts`                                            | `isCachingSupported("gemini-4-argon")` trả về `true`, tạo cache KB  | `geminiCacheName = null` -> fallback inline system instruction                                                   | `caches.create` ném lỗi 400/429 -> trả về `null`, fallback inline                                                     | `activeCacheNames` Map cập nhật theo key `kbId:model:hash`  | **PASS**                                                                                                                                                                             |
| **Bước 9–10**: `streaming/types.ts`, `utils.ts`, `gemini-stream.ts`                              | Argon nhận timeout 900.000ms và `ThinkingLevel.LOW`/`HIGH`          | `thinkingLevel` là `"off"` hoặc `undefined` -> ép về `ThinkingLevel.LOW`                                         | Lỗi 403/404 từ Google API -> `isNonRetryableClientError = true`, không retry; Timeout 15 phút -> `StreamTimeoutError` | Mỗi stream có `AbortController` và timer riêng              | **FAIL** (`MAJOR-NEW-2`: Bước 9.2/9.3 xóa `FLASH` timeout, xóa `STREAM_TIMEOUT_MS`, duplicate export `getStreamTimeout`; `MINOR-NEW-2`: retry sau `StreamTimeoutError`)              |
| **Bước 11**: `useThinkingLevel.ts` & `ThinkingLevelSelector.tsx`                                 | Chọn Argon -> chỉ hiển thị `"low"` và `"high"`                      | Model khác (Claude, GLM, DeepSeek, Gemini 2.5) giữ nguyên các mức                                                | N/A (client state)                                                                                                    | Đổi model trên UI tự động điều chỉnh `thinkingLevel` hợp lệ | **FAIL** (`MAJOR-NEW-1`: Bước 11.1 xóa nhánh GLM/Claude/DeepSeek; Bước 11.2 dùng biến `levels`/`availableLevels` không tồn tại)                                                      |

---

#### 4. Claim Verification (Kiểm Chứng Định Lượng)

| Tuyên bố trong kế hoạch                                                                                                                        | Nguồn kiểm chứng                                                                                                                                      | Kết quả đối chiếu                                                                                                           | Trạng thái              |
| :--------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :---------------------- |
| "6 vị trí dùng `model.includes('pro')` trong `src/`" (§4, dòng 73–90)                                                                          | `[SRC]` Kiểm tra `src/app/api/chat-stream/streaming/utils.ts:27`, `gemini-stream.ts:147,160`, `contextBuilder.ts:116`, `gems.ts:212`, `limits.ts:365` | Khớp 6 vị trí trong `src/`.                                                                                                 | **ĐÚNG**                |
| "`src/app/api/chat-stream/route.ts` chưa khai báo `export const maxDuration`" (§4, dòng 93)                                                    | `[SRC]` Đọc `src/app/api/chat-stream/route.ts:1-121`                                                                                                  | File hiện chỉ có `export const dynamic = "force-dynamic";` tại dòng 26, chưa có `maxDuration`.                              | **ĐÚNG**                |
| "`ThinkingLevelSelector.tsx` dòng 57–71 dùng biến `levels` và `availableLevels`" (Bước 11.2, dòng 427–442)                                     | `[SRC]` Đọc `src/app/features/chat/components/ThinkingLevelSelector.tsx:46-76`                                                                        | Sai: File thật dùng mảng `options: ThinkingOption[]` tạo bởi toán tử ba ngôi, không có biến `levels` hay `availableLevels`. | **SAI** (`MAJOR-NEW-1`) |
| "`TIMEOUT_CONFIG` trong `streaming/types.ts:86-92` gồm `DEFAULT`, `DEEP_THINKING`, `IMAGE_GENERATION`, `SECOND_STEP`" (Bước 9.2, dòng 359–366) | `[SRC]` Đọc `src/app/api/chat-stream/streaming/types.ts:86-92`                                                                                        | Sai: File thật gồm `DEFAULT`, `DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING`.                                              | **SAI** (`MAJOR-NEW-2`) |
| "Đã sửa `MINOR-1` (`MODEL_IDS` trong `constants.ts`)" (§9 Revision 2, dòng 575)                                                                | `[SRC]` Đọc Bước 1 (dòng 151–168) và `src/lib/utils/constants.ts:17-31`                                                                               | Sai: Snippet Bước 1 vẫn chưa được cập nhật, vẫn ghi đè sai các key/value hiện hữu.                                          | **SAI** (`MAJOR-NEW-4`) |

---

#### 5. Adversarial Timelines (Kịch Bản Phản Chứng)

- **Timeline 1 — User không có quyền gọi `/api/chat-stream` với `"gemini-4-argon"` vẫn bị trừ quota**:
  1. `t0`: User (tier thường, `allowed_models = ["gemini-3-flash"]`) gửi `POST /api/chat-stream` với body `{ conversationId: "conv-1", model: "gemini-4-argon", message: "Hi" }`.
  2. `t1`: `POST` (`src/app/api/chat-stream/route.ts:86`) gọi `checkRateLimit(userId)` -> user còn 1 lượt tin nhắn cuối cùng trong ngày (`9/10`).
  3. `t2`: `POST` (`route.ts:97`) gọi `await handleChatStreamCore(context, req)`.
  4. `t3`: Trong `handleChatStreamCore` (Bước 5.3), `assertModelAllowedForUser(userId, "gemini-4-argon")` ném `ForbiddenError("Model gemini-4-argon is not enabled for this account")`. Khối `catch (e)` trong Bước 5.3 bắt lỗi này và **return** `errorFromAppError(e)` (một `Response` HTTP 403) về cho `route.ts:97`.
  5. `t4`: Do `handleChatStreamCore` hoàn thành bình thường (resolved với một `Response`), `route.ts:101` chạy tiếp `await incrementDailyMessageCount(userId)` -> tăng bộ đếm của user lên `10/10` (hết quota trong ngày) rồi dòng 106 ghi `perfMonitor.end(200, { streaming: true })` trước khi trả `Response` 403 về client.

- **Timeline 2 — User chọn model Claude Sonnet 4.5 hoặc GLM-5.2 trên UI sau khi áp dụng Bước 11.1**:
  1. `t0`: Code Bước 11.1 được áp vào `src/app/features/chat/components/hooks/useThinkingLevel.ts`.
  2. `t1`: `getAvailableThinkingLevels("claude-sonnet-4-5-20250929")` chạy qua `isArgonModel` (false), `isGemini3Model` (false), `isGemini25Model` (false) và rơi vào `return ["off"]` (vì các nhánh `isClaudeThinkingModel`, `isGLMModel`, `isDeepSeekV4Model` đã bị xóa trong snippet Bước 11.1).
  3. `t2`: `getEffectiveThinkingLevel("claude-sonnet-4-5-20250929", "medium")` trả về `"off"`, làm mất khả năng chọn mức suy luận trên Claude, GLM và DeepSeek, đồng thời làm fail 8 unit test trong `useThinkingLevel.test.ts`.

---

#### 6. Commands Executed

1. `npx vitest list --filesOnly` -> Exit code `0` (liệt kê 112 file test trong dự án).
2. `npm run type-check` -> Exit code `1` (0 lỗi trong `src/`; 2 lỗi `TS2307` tồn đọng trong artefact cũ `.next/dev/types/validator.ts:452` và `.next/types/validator.ts:452` tham chiếu tới `src/app/api/files/[id]/analyze/route.js` đã xóa — khớp với ghi chú xoá `.next/` ở Bước 16).
3. `npm run lint` -> Exit code `0` (0 errors, 0 warnings).
4. `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/core/limits.test.ts src/lib/features/chat/conversations.test.ts src/app/api/chat-stream/streaming/gemini-stream.test.ts src/app/features/chat/components/hooks/useThinkingLevel.test.ts src/app/api/chat-stream/route.test.ts` -> Exit code `0` (6 test files passed, 83 tests passed).

---

#### 7. Kết Luận & Hành Động Cần Thiết Cho Revision 3

Kế hoạch đã giải quyết được cấu trúc kiểm thử `contextBuilder.test.ts` (`MAJOR-4`), bổ sung live probe và không retry lỗi 401/403/404, nhưng các đoạn code mẫu ở Bước 1, Bước 3.1/5.3, Bước 9.2/9.3 và Bước 11.1/11.2 chưa khớp với mã nguồn thật và gây regression nếu thực thi. Cần chỉnh sửa 4 điểm `[MAJOR]` và 2 điểm `[MINOR]` sau trong Revision 3:

1. **`[MAJOR-NEW-1]` (`useThinkingLevel.ts` & `ThinkingLevelSelector.tsx`)**: Cập nhật lại Bước 11.1 và 11.2 dựa trên code thật của `src/app/features/chat/components/hooks/useThinkingLevel.ts:96-223` (giữ nguyên các nhánh Gemini 2.5 `["off", "low", "high"]`, GLM, Claude, DeepSeek; cập nhật cả `useEffect` và `cycleThinkingLevel` trong hook) và `src/app/features/chat/components/ThinkingLevelSelector.tsx:46-76` (thêm nhánh `isArgon` vào biểu thức khởi tạo mảng `options`).
2. **`[MAJOR-NEW-2]` (`streaming/types.ts` & `streaming/utils.ts`)**: Cập nhật lại Bước 9.2 (giữ `FLASH` và `FLASH_DEEP_THINKING`, bỏ `IMAGE_GENERATION`/`SECOND_STEP`), Bước 9.3 (bỏ từ khóa `export` trùng lặp ở đầu hàm `getStreamTimeout`, giữ nguyên logic `process.env.STREAM_TIMEOUT_MS` và nhánh `flash`), và Bước 9.4 (đổi tên mảng thành `gemini3Identifiers`).
3. **`[MAJOR-NEW-3]` (`chatStreamCore.ts`, `conversationLoader.ts`, `limits.ts`)**: Tại Bước 5.3, để `assertModelAllowedForUser` ném thẳng `AppError` ra ngoài `handleChatStreamCore` (để `route.ts:108-112` bắt lỗi mà không chạy `incrementDailyMessageCount` ở dòng 101); tại `src/app/api/chat-stream/conversationLoader.ts:38-41`, rethrow nếu `saveErr instanceof AppError`; tại Bước 3.1 (`limits.ts`), liệt kê đầy đủ các import (`ForbiddenError`, `DEFAULT_MODEL`, `normalizeModelForApi`, `coerceStoredModel`).
4. **`[MAJOR-NEW-4]` (`constants.ts`)**: Sửa lại snippet Bước 1 để giữ nguyên toàn bộ các hằng số hiện có trong `src/lib/utils/constants.ts:17-31` và chỉ thêm `GEMINI_ARGON: "gemini-4-argon"`.
5. **`[MINOR-NEW-1]` & `[MINOR-NEW-2]`**: Thay `"low" as any` ở Bước 17 bằng `ThinkingLevel.LOW` (import từ `@google/genai`); thêm kiểm tra `if (err instanceof StreamTimeoutError) return;` trong `runStreamWithFallback` (`gemini-stream.ts:592-644`) để không retry sau khi đã timeout 15 phút.

[CHANGES_REQUESTED]

---

### Audit Run 3

**[REVIEWER_MODEL: gemini-4-argon]**

#### 1. Kiểm Chứng Lỗi Cũ (Old Error Verification)

- **`MAJOR-NEW-1` (và `MAJOR-2` từ Run 1 — Cấu trúc `useThinkingLevel.ts` & `ThinkingLevelSelector.tsx` cho chính sách không có `"off"` trên Argon)**: **`ĐÃ SỬA`**.
  - _Bằng chứng `[SRC]`_:
    1. Tại Bước 11.1 (`docs/plans/2026-10-14-add-gemini-4-argon-model-implementation-plan.md:546-635`), code mẫu đã đối chiếu khớp với `src/app/features/chat/components/hooks/useThinkingLevel.ts:1-152`: mở rộng `isGemini3Model` bao gồm `model.includes("gemini-4")` (nhờ đó `modelSupportsThinkingUI("gemini-4-argon")` tại `useThinkingLevel.ts:70-78` trả về `true`), giữ nguyên các nhánh `isGLMModel`, `isClaudeThinkingModel`, `isDeepSeekV4Model`, `isGemini25Model` trong cả `getAvailableThinkingLevels` (`:568-582`) và `getEffectiveThinkingLevel` (`:586-634`), đồng thời thêm nhánh `if (isGemini4Model(currentModel))` trả về `["low", "medium", "high"]` (không có `"off"`) và ánh xạ `"off"`/`"minimal"` về `"low"`.
    2. Tại Bước 11.2 (`:636-680`), code mẫu đã khớp với cấu trúc toán tử ba ngôi của mảng `options: ThinkingOption[]` trong `src/app/features/chat/components/ThinkingLevelSelector.tsx:46-76`, chỉ chèn `{ value: "off", label: t("webSearchOff") }` khi `!isGemini4`.

- **`MAJOR-NEW-2` (và `MAJOR-1`, `MINOR-5` từ Run 1 — `TIMEOUT_CONFIG`, `getStreamTimeout`, `gemini3Identifiers`)**: **`ĐÃ SỬA`**.
  - _Bằng chứng `[SRC]`_:
    1. Bước 9.2 (`:423-433`) giữ nguyên 5 khóa hiện có (`PRO`, `PRO_DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING`, `DEFAULT`) của `TIMEOUT_CONFIG` trong `src/app/api/chat-stream/streaming/types.ts:86-92` và bổ sung `ARGON: 900000`.
    2. Bước 9.3 (`:434-467`) giữ nguyên chữ ký `function getStreamTimeout(model?: string, thinkingLevel?: ThinkingLevel): number` (không thêm `export` trùng với dòng 215 của `src/app/api/chat-stream/streaming/utils.ts`), giữ nguyên nhánh đọc `process.env.STREAM_TIMEOUT_MS` (`:9-15`) và hai nhánh `pro` / `flash` (`:22-28`).
    3. Bước 9.4 (`:468-490`) sử dụng đúng tên mảng `gemini3Identifiers` tại `src/app/api/chat-stream/streaming/utils.ts:153`.

- **`MAJOR-NEW-3` (và `BLOCKER-1` từ Run 1 — Luồng ném `AppError` của `assertModelAllowedForUser` và bảo toàn bộ đếm quota `incrementDailyMessageCount`)**: **`ĐÃ SỬA`**.
  - _Bằng chứng `[SRC]`_:
    1. Bước 4.1 (`:234-249`) bổ sung đầy đủ import `ForbiddenError` từ `@/lib/utils/errors` và `DEFAULT_MODEL, normalizeModelForApi, coerceStoredModel` từ `./modelRegistry` vào `src/lib/core/limits.ts:1-9`.
    2. Bước 5.3 (`:319-328`) cập nhật `src/app/api/chat-stream/conversationLoader.ts:6, 38-41` để rethrow `if (e instanceof AppError) throw e;` khi `saveConversation` ném `ForbiddenError` hoặc `ServiceUnavailableError`.
    3. Bước 5.4 (`:329-353`) cập nhật `src/app/api/chat-stream/chatStreamCore.ts:100-118` để rethrow `AppError` và gọi trực tiếp `await assertModelAllowedForUser(userId, model);` (ném thẳng về `catch (e)` tại `src/app/api/chat-stream/route.ts:108-119`), kết hợp kiểm tra `if (response.ok)` tại `route.ts:97-107` trước khi gọi `incrementDailyMessageCount(userId)`.

- **`MAJOR-NEW-4` (và `MINOR-1` từ Run 1 — Bảo toàn `MODEL_IDS` trong `src/lib/utils/constants.ts:17-31`)**: **`ĐÃ SỬA`**.
  - _Bằng chứng `[SRC]`_: Bước 1 (`:150-170`) giữ nguyên cả 9 hằng số hiện có trong `src/lib/utils/constants.ts:17-31` (`IMAGE_STUDIO`, `USER_TEMPLATES_STORE`, `CLAUDE_SONNET_45`, `CLAUDE_HAIKU_45`, `DEEPSEEK_V4_FLASH`, `DEEPSEEK_V4_PRO`, `DEEPSEEK_V41_FLASH`, `DEEPSEEK_V32`, `GLM_52`) và chỉ bổ sung `GEMINI_4_ARGON: "gemini-4-argon"`.

- **`MINOR-NEW-1` (và `MAJOR-3` từ Run 1 — Không dùng `as any` trong lệnh Live Probe Bước 17)**: **`ĐÃ SỬA`**.
  - _Bằng chứng `[SRC]`_: Bước 17 (`:731-735`) import `ThinkingLevel` từ `@google/genai` và truyền `thinkingLevel: ThinkingLevel.LOW`.

- **`MINOR-NEW-2` (và `MAJOR-3` từ Run 1 — Không retry `[TOOLS FALLBACK]` khi gặp `StreamTimeoutError`)**: **`ĐÃ SỬA`**.
  - _Bằng chứng `[SRC]`_: Bước 10.2 (`:533`) bổ sung kiểm tra `if (abortSignal?.aborted || err instanceof StreamTimeoutError) { throw err; }` ở đầu khối `catch (err)` của `runStreamWithFallback` (`src/app/api/chat-stream/streaming/gemini-stream.ts:593`).

---

#### 2. Phát Hiện Mới & Các Tấn Công Đã Thử (New Findings & Attempted Attacks)

Không ghi nhận lỗi mới (`[BLOCKER]`, `[MAJOR]`, hoặc `[MINOR]`) trong Revision 3.

##### Các Tấn Công Đã Thử (Attempted Attacks)

1. **Tấn công 1 — Vượt rào phân quyền qua `branchConversation` hoặc hội thoại cũ sau khi tài khoản bị hạ hạng (`pro` $\rightarrow$ `basic`)**:
   - _Giả thuyết tấn công_: Trong `src/lib/features/chat/conversations.ts:766`, hàm `branchConversation` tạo hội thoại nhánh bằng cách sao chép `model: sourceConvo.model` trực tiếp qua `supabase.from("conversations").insert(...)` mà không đi qua `doSaveConversation`. Nếu user từng ở hạng `pro` có hội thoại dùng `"gemini-4-argon"` (hoặc branch hội thoại đó) rồi bị hạ xuống hạng `basic`, user gửi `POST /api/chat-stream` với `conversationId` đó để tiếp tục dùng Argon.
   - _Kết quả kiểm chứng (`[SRC]`)_: Không vượt qua được. Tại `src/app/api/chat-stream/chatStreamCore.ts:98-118` (Bước 5.4, dòng 332–337), sau khi `loadOrCreateConversation` lấy `model` từ bản ghi hội thoại trong DB (`src/app/api/chat-stream/conversationLoader.ts:59-60`), `handleChatStreamCore` luôn thực thi `await assertModelAllowedForUser(userId, model)` trước khi chạy `handleMessageTruncation` (`:121`), trước khi lưu tin nhắn user (`:130`) và trước khi gọi Gemini SDK. Yêu cầu bị chặn với `ForbiddenError` (HTTP 403).

2. **Tấn công 2 — Xung đột trạng thái `localStorage.getItem("vikini.thinkingLevel") === "off"` hoặc `"minimal"` khi chuyển từ model khác sang `gemini-4-argon`**:
   - _Giả thuyết tấn công_: User đang chọn `"off"` (hoặc `"minimal"` trên `gemini-3-flash-preview`), giá trị này được lưu trong `localStorage` và nạp vào state `thinkingLevel` tại `src/app/features/chat/components/hooks/useThinkingLevel.ts:161, 175`. Khi user chuyển model sang `"gemini-4-argon"`, mảng `options` trong `ThinkingLevelSelector.tsx` không còn phần tử `"off"` hay `"minimal"`, thử kiểm tra xem `ThinkingLevelSelector.tsx:78-80` có bị lỗi `undefined` label hoặc `getLowerThinkingLevel` (`useThinkingLevel.ts:213-223`) có bị sai lệch khi `availableLevels` không chứa `"off"` hay không.
   - _Kết quả kiểm chứng (`[SRC]`)_: Không gây lỗi. Tại `src/app/features/chat/components/ThinkingLevelSelector.tsx:78-80`, component tính `const effectiveLevel = getEffectiveThinkingLevel(currentModel, thinkingLevel);` trước khi tra cứu `options.find((o) => o.value === effectiveLevel)`. Với Bước 11.1 (`:590-596`), `getEffectiveThinkingLevel("gemini-4-argon", "off")` và `getEffectiveThinkingLevel("gemini-4-argon", "minimal")` đều trả về `"low"`, khớp với phần tử đầu tiên `{ value: "low", ... }` trong `options` (`:662-674`). Ngoài ra, hàm `getLowerThinkingLevel` tại `src/app/features/chat/components/hooks/useThinkingLevel.ts:218-222` lọc `.filter((lvl) => lvl !== "off" && (LEVEL_ORDER[lvl] ?? 0) < currentRank)` nên hoạt động bình thường với `availableLevels = ["low", "medium", "high"]`.

3. **Tấn công 3 — Mất `tools` hoặc `systemInstruction` ở lượt gọi thứ 2 (Function Call Continuation) trên `gemini-4-argon`**:
   - _Giả thuyết tấn công_: Tại `src/app/api/chat-stream/streaming/gemini-stream.ts:441-450`, khi thực hiện lượt gọi continuation sau khi chạy `executeFunction`, nếu `params.cachedContent` có giá trị thì code chỉ gán `contConfig.cachedContent = params.cachedContent` và bỏ qua `systemInstruction`, `tools`, `toolConfig`.
   - _Kết quả kiểm chứng (`[SRC]`)_: Không xảy ra trên `gemini-4-argon`. Bước 6 (`src/lib/core/contextCache.ts:122, 216`) chặn mọi model `model.startsWith("gemini-4")` và trả về `null` ngay từ đầu hàm `getOrCreateCompositeCache` và `getOrCreateKBCache`. Do đó `params.cachedContent` luôn là `undefined` đối với `gemini-4-argon`, đảm bảo nhánh `else` tại `gemini-stream.ts:443-450` luôn đính kèm đầy đủ `systemInstruction`, `tools` và `toolConfig`.

4. **Tấn công 4 — Truyền alias `"gemini-4-argon-preview"` vào `assertModelAllowedForUser`, `getStreamTimeout` và `gemini-stream.ts`**:
   - _Giả thuyết tấn công_: Client hoặc dữ liệu cũ truyền `"gemini-4-argon-preview"` khi DB `rank_configs.allowed_models` chỉ chứa `["gemini-4-argon"]`, hoặc kiểm tra xem `getStreamTimeout("gemini-4-argon-preview", "low")` có bị rơi về `TIMEOUT_CONFIG.DEFAULT` (180s) không.
   - _Kết quả kiểm chứng (`[SRC]`)_: Không bị lệch. Bước 2.3 đăng ký `"gemini-4-argon-preview": MODEL_IDS.GEMINI_4_ARGON` trong `MODEL_ALIASES` (`src/lib/core/modelRegistry.ts:340-352`). Trong `assertModelAllowedForUser` (Bước 4.3, `:290-300`), `normalizedModel = normalizeModelForApi(model)` chuyển `"gemini-4-argon-preview"` thành `"gemini-4-argon"`, khớp với `allowedSet`. Trong `getStreamTimeout` (Bước 9.3, `:453-455`) và `isGemini4Model` (Bước 2.4, `:203-206`), cả hai đều gọi `normalizeModelForApi` trước khi kiểm tra `.startsWith("gemini-4")`.

---

#### 3. Mental Simulation Verification Matrix

| Bước / Thay đổi                                                                                                                       | Happy Path                                                                                                                                                                                                            | Input Rỗng / Null                                                                                                                          | Timeout / Lỗi Mạng                                                                                                  | Xung Đột Luồng (Concurrency)                                                                                        | Kết quả  |
| :------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ | :------- |
| **Bước 1–3**: `constants.ts` & `modelRegistry.ts`                                                                                     | Đăng ký `GEMINI_4_ARGON: "gemini-4-argon"` vào `MODEL_IDS`, `SELECTABLE_MODELS`, `API_ALLOWED`, `MODEL_ALIASES`                                                                                                       | `normalizeModelForApi(null)` trả về `DEFAULT_MODEL`; `isGemini4Model(null)` trả về `false`                                                 | N/A (hàm đồng bộ)                                                                                                   | Các cấu trúc hằng số bất biến, an toàn khi truy cập đồng thời                                                       | **PASS** |
| **Bước 4–5**: `assertModelAllowedForUser` (`limits.ts`, `conversations.ts`, `conversationLoader.ts`, `chatStreamCore.ts`, `route.ts`) | User rank `pro`/`admin` có `"gemini-4-argon"` trong `allowed_models` được phép lưu và stream                                                                                                                          | `allowed_models` rỗng hoặc user `basic` gọi Argon -> ném `ForbiddenError` (403) ra `route.ts:108`, không tăng `incrementDailyMessageCount` | Lỗi đọc Supabase `rank_configs`/`allowed_users` -> `getUserLimits` ném `ServiceUnavailableError` (503, fail-closed) | Deduplication `pendingCreates` trong `saveConversation` dọn dẹp key trong `finally` khi `doSaveConversation` reject | **PASS** |
| **Bước 6–8**: `contextCache.ts` & `contextBuilder.ts`                                                                                 | `getOrCreateCompositeCache` / `getOrCreateKBCache` trả về `null` cho `gemini-4-argon`; `setupToolsAndSafety` bật `googleSearch` + `codeExecution` + `functionDeclarations` + `includeServerSideToolInvocations: true` | `enableWebSearch: false` -> không thêm `googleSearch`, `toolConfig` là `undefined`                                                         | Khi Gemini 3 gọi `caches.create` gặp lỗi mạng -> bắt lỗi và trả về `null` (fallback inline)                         | `contextCache.test.ts` cô lập `activeCacheNames` bằng `vi.resetModules()`                                           | **PASS** |
| **Bước 9–10**: `route.ts`, `streaming/types.ts`, `utils.ts`, `gemini-stream.ts`                                                       | `getStreamTimeout("gemini-4-argon")` trả về `900000` (15 phút); `route.ts` khai báo `maxDuration = 800`; Argon luôn gửi `thinkingConfig`                                                                              | `thinkingLevel` là `"off"` hoặc `"minimal"` -> clamp về `"low"`; `undefined` -> `"medium"`                                                 | Lỗi 401/403/404 (`MODEL_TIER_RESTRICTED`) hoặc `StreamTimeoutError` -> thoát ngay, không retry `[TOOLS FALLBACK]`   | Mỗi request stream có `AbortController` và bộ đếm timeout độc lập                                                   | **PASS** |
| **Bước 11–14**: `useThinkingLevel.ts`, `ThinkingLevelSelector.tsx`, i18n, SQL migration                                               | Chọn Argon trên UI hiển thị `["low", "medium", "high"]`; các model Claude/GLM/DeepSeek/Gemini 2.5 giữ nguyên hành vi                                                                                                  | `localStorage` lưu `"off"` hoặc `"minimal"` -> `getEffectiveThinkingLevel` trả về `"low"`                                                  | Khi `/api/user/allowed-models` lỗi mạng -> `useAllowedModels.ts` fallback về `new Set([DEFAULT_MODEL])`             | Migration SQL idempotent với điều kiện `NOT (allowed_models @> '["gemini-4-argon"]'::jsonb)`                        | **PASS** |

---

#### 4. Claim Verification (Kiểm Chứng Định Lượng)

| Tuyên bố trong kế hoạch                                                                                                                                         | Nguồn kiểm chứng                                                               | Kết quả đối chiếu                                                                          | Trạng thái |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :--------- |
| "`MODEL_IDS` trong `src/lib/utils/constants.ts:17-31` có 9 khóa hiện hữu" (Bước 1, dòng 150–170)                                                                | `[SRC]` Đọc `src/lib/utils/constants.ts:17-31`                                 | Khớp cả 9 khóa và giá trị chuỗi tương ứng, chỉ bổ sung `GEMINI_4_ARGON: "gemini-4-argon"`. | **ĐÚNG**   |
| "`TIMEOUT_CONFIG` trong `streaming/types.ts:86-92` có 5 hằng số `PRO`, `PRO_DEEP_THINKING`, `FLASH`, `FLASH_DEEP_THINKING`, `DEFAULT`" (Bước 9.2, dòng 423–433) | `[SRC]` Đọc `src/app/api/chat-stream/streaming/types.ts:86-92`                 | Khớp tên khóa và giá trị mili-giây trong file thật.                                        | **ĐÚNG**   |
| "`streaming/utils.ts:215` đã có câu lệnh `export { getStreamTimeout, createTimeoutPromise, withTimeout, withIdleTimeout }`" (Bước 9.3, dòng 436)                | `[SRC]` Đọc `src/app/api/chat-stream/streaming/utils.ts:215`                   | Khớp chính xác dòng 215 của `src/app/api/chat-stream/streaming/utils.ts`.                  | **ĐÚNG**   |
| "`ThinkingLevelSelector.tsx:46-76` xây dựng mảng `options: ThinkingOption[]` bằng toán tử ba ngôi" (Bước 11.2, dòng 638–680)                                    | `[SRC]` Đọc `src/app/features/chat/components/ThinkingLevelSelector.tsx:38-77` | Khớp cấu trúc biến và tên thuộc tính trong file thật.                                      | **ĐÚNG**   |

---

#### 5. Commands Executed

1. `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/core/limits.test.ts src/lib/features/chat/conversations.test.ts src/app/api/chat-stream/streaming/gemini-stream.test.ts src/app/features/chat/components/hooks/useThinkingLevel.test.ts src/app/api/chat-stream/route.test.ts src/app/api/chat-stream/conversationLoader.test.ts` -> Exit code `0` (7 test files passed, 86 tests passed).

---

#### 6. Kết Luận

Tất cả các lỗi `[BLOCKER]`, `[MAJOR]` và `[MINOR]` từ Audit Run 1 và Audit Run 2 đã được giải quyết trong Revision 3 và đối chiếu khớp với mã nguồn thực tế. Kế hoạch đủ điều kiện chuyển sang giai đoạn triển khai.

[PLAN_APPROVED]
