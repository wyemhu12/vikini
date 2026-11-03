# Danh sách Model và Tính năng - Vikini

> **Updated**: 2026-11-02  
> **Nguồn**: [Google AI - Gemini Models](https://ai.google.dev/gemini-api/docs/models), [What's new in Gemini 4 Argon](https://ai.google.dev/gemini-api/docs/latest-model), [Anthropic Claude Docs](https://docs.anthropic.com/), [DeepSeek API](https://api-docs.deepseek.com/), [OpenRouter](https://openrouter.ai), [Groq Cloud](https://console.groq.com/docs/models), [Strata Local Inference Engine](https://github.com/Niko1221/Strata)

> [!NOTE]
> Để tham khảo hướng dẫn phân bổ model cho AI Coding Agents, xem [Agent Task-to-Model Routing Guide](../.agents/README.md#agent-task-to-model-routing).

---

## Gemini 4 Series

> [!IMPORTANT]
> **Gemini 4 Argon Architecture & Policy (October 2026)**:
>
> - **Always-On Thinking**: `gemini-4-argon` không cho phép tắt thinking (`off`) và không hỗ trợ `minimal`. Các bậc hợp lệ là `low`, `medium` (mặc định), `high`.
> - **Implicit Context Caching Only**: Tự động áp dụng chiết khấu 95% trên tiền tố lặp lại (tối thiểu 2,048 tokens); không hỗ trợ Explicit Context Caching (`caches.create`).
> - **15-Minute Timeout**: Áp dụng `TIMEOUT_CONFIG.ARGON = 900,000ms` (15 phút) trên self-hosted Node.js và `maxDuration = 800s` trên Vercel Pro.
> - **Paid-Tier Only**: Chỉ khả dụng trên khóa API Gemini trả phí (cấp quyền cho hạng `pro` và `admin`).

### gemini-4-argon

| Thuộc tính                | Giá trị                                            |
| ------------------------- | -------------------------------------------------- |
| **Tên hiển thị**          | Gemini 4 Argon                                     |
| **Alias tương thích**     | `gemini-4-argon-preview`                           |
| **Unified context limit** | 1,048,576 (1M)                                     |
| **Output token limit**    | 65,536 (64K streaming standard)                    |
| **Inputs**                | Text, Image, Video, Audio, PDF                     |
| **Outputs**               | Text                                               |
| **Pricing (Intro)**       | \$2.00 / 1M input, \$10.00 / 1M output (+thinking) |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Always-On (`low`, `medium` default, `high` — no `off`) |
| Search Grounding | ✅ Supported (with Tool Context Circulation) |
| URL Context | ✅ Supported |
| Function Calling | ✅ Supported |
| Code Execution | ✅ Supported |
| Structured Outputs | ✅ Supported |
| Implicit Caching | ✅ Automatic (95% discount, min 2,048 tokens) |
| Explicit Caching (`caches.create`) | ❌ Not supported |
| Image Generation | ❌ Not supported |
| Live API | ❌ Not supported |

---

## Gemini 3.1 Series

> [!IMPORTANT]
> **Migration Notice (March 2026)**: `gemini-3-pro-preview` sẽ bị discontinue ngày 9/3/2026.
> Vikini đã migrate sang `gemini-3.1-pro-preview`. Alias cũ (`gemini-3-pro`, `gemini-3-pro-preview`) tự động redirect.

> [!IMPORTANT]
> **Gemini Thinking Level & Sampling Migration (November 2026)**:
>
> - **Gemini 3+ / 4+**: Chuyển đổi toàn diện sang `thinkingLevel` (`minimal`, `low`, `medium`, `high`) theo chuẩn Google GenAI SDK mới.
> - **Gemini 2.5 Deprecation (Shutdown 01/12/2026)**: `gemini-2.5-flash` và `gemini-2.5-pro` đã được thay thế bởi `gemini-3.5-flash-lite` (`DEFAULT_MODEL` mới) và `gemini-3.8-flash`; toàn bộ nhánh `thinkingBudget` cũ đã được gỡ bỏ và các ID cũ được ánh xạ tự động qua `MODEL_ALIASES`.
> - **Mutual Exclusion Invariant**: Tuyệt đối không gửi đồng thời `thinkingLevel` và `thinkingBudget` trong cùng một request config.
> - **Sampling Parameters Sanitization**: Toàn bộ tham số sampling tùy biến (`temperature`, `top_p`, `top_k`) đã được loại bỏ khỏi các request gọi Gemini API (`gemini-stream.ts`, `autoTitleEngine.ts`, `fileProcessors.ts`) để tuân thủ khuyến nghị của Google và tránh lỗi 400 trong các thế hệ model mới.
> - **Claude Thinking Toggle**: Giao diện hiển thị `off/high` nhất quán 100% với `anthropic-stream.ts`.

### gemini-3.1-pro-preview

| Thuộc tính             | Giá trị                        |
| ---------------------- | ------------------------------ |
| **Tên hiển thị**       | Gemini 3.1 Pro                 |
| **Input token limit**  | 2,000,000 (2M)                 |
| **Output token limit** | 65,536 (65K)                   |
| **Inputs**             | Text, Image, Video, Audio, PDF |
| **Outputs**            | Text                           |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Supported (off, low, medium, high) |
| Search Grounding | ✅ Supported |
| URL Context | ✅ Supported |
| Function Calling | ✅ Supported |
| Code Execution | ✅ Supported |
| Structured Outputs | ✅ Supported |
| Caching | ✅ Supported |
| Image Generation | ❌ Not supported |
| Live API | ❌ Not supported |

---

### gemini-3.1-flash-lite-preview

| Thuộc tính             | Giá trị                        |
| ---------------------- | ------------------------------ |
| **Tên hiển thị**       | Gemini 3.1 Flash-Lite          |
| **Alias tương thích**  | `gemini-3.1-flash-lite`        |
| **Input token limit**  | 1,000,000 (1M)                 |
| **Output token limit** | 65,536 (65K)                   |
| **Category**           | Low-latency                    |
| **Inputs**             | Text, Image, Video, Audio, PDF |
| **Outputs**            | Text                           |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Supported (`off`, `minimal`, `low`, `medium`, `high`) |
| Search Grounding | ✅ Supported |
| URL Context | ✅ Supported |
| Function Calling | ✅ Supported |
| Structured Outputs | ✅ Supported |

---

### gemini-3-pro-image

| Thuộc tính             | Giá trị                      |
| ---------------------- | ---------------------------- |
| **Tên hiển thị**       | Gemini 3 Pro Image           |
| **Alias tương thích**  | `gemini-3-pro-image-preview` |
| **Input token limit**  | 65,536 (65K)                 |
| **Output token limit** | 32,768 (32K)                 |
| **Inputs**             | Text, Image                  |
| **Outputs**            | Text, Image                  |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Supported |
| Image Generation | ✅ Supported |
| Search Grounding | ✅ Supported |
| Structured Outputs | ✅ Supported |
| Function Calling | ❌ Not supported |
| Code Execution | ❌ Not supported |
| Caching | ❌ Not supported |
| URL Context | ❌ Not supported |
| Live API | ❌ Not supported |

---

### gemini-3-flash-preview

| Thuộc tính             | Giá trị                        |
| ---------------------- | ------------------------------ |
| **Tên hiển thị**       | Gemini 3 Flash                 |
| **Alias tương thích**  | `gemini-3-flash`               |
| **Input token limit**  | 1,048,576 (1M)                 |
| **Output token limit** | 65,536 (65K)                   |
| **Inputs**             | Text, Image, Video, Audio, PDF |
| **Outputs**            | Text                           |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Supported (`off`, `minimal`, `low`, `medium`, `high`) |
| Search Grounding | ✅ Supported |
| URL Context | ✅ Supported |
| Function Calling | ✅ Supported |
| Code Execution | ✅ Supported |
| Structured Outputs | ✅ Supported |
| Caching | ✅ Supported |
| Image Generation | ❌ Not supported |
| Live API | ❌ Not supported |

> [!NOTE]
> Các model Flash-Lite và Gemini 3 Flash (`gemini-3.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`) hỗ trợ thêm mức `minimal` bên cạnh `low`, `medium`, `high`. Các model `gemini-3.8-flash`, `gemini-3.1-pro-preview` và `gemini-4-argon` chỉ hỗ trợ `low`, `medium`, `high` (`minimal` không được hỗ trợ trên `gemini-3.8-flash` và sẽ gây lỗi HTTP 400 nếu gửi lên).

---

## Gemini 3.5 & 3.8 Series (Replacing Gemini 2.5 Series)

### gemini-3.5-flash-lite

| Thuộc tính             | Giá trị                                       |
| ---------------------- | --------------------------------------------- |
| **Tên hiển thị**       | Gemini 3.5 Flash-Lite (`DEFAULT_MODEL`)       |
| **Input token limit**  | 1,048,576 (1M)                                |
| **Output token limit** | 65,536 (64K)                                  |
| **Category**           | Low-latency                                   |
| **Thinking Levels**    | `minimal` (mặc định), `low`, `medium`, `high` |

---

### gemini-3.8-flash

| Thuộc tính             | Giá trị                                                         |
| ---------------------- | --------------------------------------------------------------- |
| **Tên hiển thị**       | Gemini 3.8 Flash                                                |
| **Input token limit**  | 1,048,576 (1M)                                                  |
| **Output token limit** | 65,536 (64K)                                                    |
| **Category**           | Reasoning                                                       |
| **Thinking Levels**    | `low`, `medium` (mặc định), `high` (**không** hỗ trợ `minimal`) |

---

## Anthropic Claude 4.5 Series

### claude-sonnet-4.5

| Thuộc tính            | Giá trị                     |
| --------------------- | --------------------------- |
| **Tên hiển thị**      | Claude 4.5 Sonnet           |
| **Input token limit** | 200,000 (200K)              |
| **Category**          | Reasoning                   |
| **Provider**          | Anthropic Direct API        |
| **API Key**           | `ANTHROPIC_API_KEY`         |
| **Thinking Mode**     | ✅ Supported (`off`/`high`) |

---

### claude-haiku-4.5

| Thuộc tính            | Giá trị                     |
| --------------------- | --------------------------- |
| **Tên hiển thị**      | Claude 4.5 Haiku (Fast)     |
| **Input token limit** | 200,000 (200K)              |
| **Category**          | Low-latency                 |
| **Provider**          | Anthropic Direct API        |
| **API Key**           | `ANTHROPIC_API_KEY`         |
| **Thinking Mode**     | ✅ Supported (`off`/`high`) |

---

## xAI Grok & Groq Llama Series

### x-ai/grok-4.3

| Thuộc tính            | Giá trị                         |
| --------------------- | ------------------------------- |
| **Tên hiển thị**      | Grok 4.3                        |
| **Input token limit** | 131,072 (128K)                  |
| **Category**          | Reasoning                       |
| **Provider**          | OpenRouter (`providerId: grok`) |
| **API Key**           | `OPENROUTER_API_KEY`            |

---

### llama-3.3-70b-versatile & llama-3.1-8b-instant

| Model                     | Tên hiển thị            | Context Window | Category    | Provider                | API Key          |
| ------------------------- | ----------------------- | -------------- | ----------- | ----------------------- | ---------------- |
| `llama-3.3-70b-versatile` | Llama 3.3 70B Versatile | 128,000        | Reasoning   | Groq (`provider: groq`) | `LLAMA3_API_KEY` |
| `llama-3.1-8b-instant`    | Llama 3.1 8B Instant    | 128,000        | Low-latency | Groq (`provider: groq`) | `LLAMA3_API_KEY` |

---

## DeepSeek V4 & V4.1 Models (Direct API & OpenRouter)

> [!IMPORTANT]
> **Deprecation Notice**: `deepseek-chat` và `deepseek-reasoner` đã bị deprecated (**2026/07/24**) và tự động map sang `deepseek-v4-flash` qua alias. `deepseek-v4-pro` đã được di trú sang `deepseek/deepseek-v4-pro` qua OpenRouter (Baidu Qianfan FP8, 1M context).

### deepseek-v4-flash

| Thuộc tính             | Giá trị                                 |
| ---------------------- | --------------------------------------- |
| **Tên hiển thị**       | DeepSeek V4 Flash                       |
| **Input token limit**  | 128,000                                 |
| **Output token limit** | 8,192                                   |
| **Category**           | Low-latency                             |
| **Provider**           | Direct API (`https://api.deepseek.com`) |
| **API Key**            | `DEEPSEEK_API_KEY`                      |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Default enabled (`reasoning_content`) |
| Reasoning Effort | ✅ `high` (default), `max` |
| Tool Calls | ✅ Supported (incl. thinking + tools) |
| Streaming | ✅ SSE with `reasoning_content` delta |
| Context Caching | ✅ 90% input cost reduction on cache hit |
| Image Input | ❌ Not supported |
| Image Generation | ❌ Not supported |

---

### deepseek/deepseek-v4-pro

| Thuộc tính             | Giá trị                                                        |
| ---------------------- | -------------------------------------------------------------- |
| **Tên hiển thị**       | DeepSeek V4 Pro                                                |
| **Alias tương thích**  | `deepseek-v4-pro`                                              |
| **Input token limit**  | **1,000,000** (1M)                                             |
| **Output token limit** | **65,536** (65K)                                               |
| **Category**           | Reasoning                                                      |
| **Provider**           | OpenRouter → Baidu Qianfan (`providerId: openrouter-pay`, FP8) |
| **API Key**            | `OPENROUTER_API_KEY`                                           |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Supported (`reasoning: { effort }` via OpenRouter) |
| Reasoning Effort | ✅ `high` (default), `max` |
| Tool Calls | ✅ Supported |
| Streaming | ✅ SSE with `delta.reasoning_content` / `delta.reasoning` |
| Image Generation | ❌ Not supported |

---

### deepseek/deepseek-v4.1-flash

| Thuộc tính             | Giá trị                                                  |
| ---------------------- | -------------------------------------------------------- |
| **Tên hiển thị**       | DeepSeek V4.1 Flash                                      |
| **Input token limit**  | **1,048,576** (1M)                                       |
| **Output token limit** | **384,000** (Full unconstrained completion)              |
| **Category**           | Low-latency / High Efficiency                            |
| **Architecture**       | Causal Encoder-Decoder (CED MoE, 552B total, 8B/16B act) |
| **Provider**           | OpenRouter (Ưu tiên Relace)                              |
| **API Key**            | `OPENROUTER_API_KEY`                                     |
| **Pricing**            | ~$0.02/M input, ~$0.60/M output, **$0.02/M cache read**  |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Supported (`reasoning: { effort }` via OpenRouter) |
| Reasoning Effort | ✅ `high`, `max` (với system prompt prefix) |
| Tool Calls | ✅ Supported (`tools` + `tool_choice`) |
| Streaming | ✅ SSE with `delta.reasoning_content` / `delta.reasoning` |
| Context Caching | ✅ **Đồng giá $0.02/M token** khi hit cache |
| Image Input (Vision) | ✅ **Supported** (Multimodal input qua base64 `image_url`) |
| Structured Output | ✅ Supported (`json_object` mode) |
| Stream Cancellation | ✅ Supported |
| Performance | ✅ Latency 1.12s, Throughput 51 tps, Uptime 99.98% |

> [!TIP]
> DeepSeek V4.1 Flash là model flagship Flash-tier mới nhất (9/2026), vượt trội về hiệu năng và rẻ hơn nhiều so với V4 Pro. Tối ưu cực mạnh cho tác vụ phân tích tài liệu/code lớn (1M context) và sinh nội dung siêu dài (384K output).

---

## DeepSeek Legacy (via OpenRouter)

### deepseek/deepseek-v3.2:floor

| Thuộc tính             | Giá trị                         |
| ---------------------- | ------------------------------- |
| **Tên hiển thị**       | DeepSeek V3.2                   |
| **Input token limit**  | 128,000                         |
| **Output token limit** | 16,384                          |
| **Category**           | Reasoning                       |
| **Provider**           | OpenRouter (auto cheapest)      |
| **Pricing**            | ~$0.28/M input, ~$0.40/M output |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Reasoning | ✅ Strong reasoning capability |
| Tool Use | ✅ Supported |
| DSA (Sparse Attention) | ✅ Efficient long-context |
| Thinking Mode | ❌ Not supported (use V4 instead) |
| Image Generation | ❌ Not supported |

> [!NOTE]
> `:floor` suffix = OpenRouter tự động route tới provider có giá thấp nhất.

## Thinking Mode

Thinking mode cho phép AI "suy nghĩ sâu" trước khi trả lời, cải thiện quality cho các task phức tạp.

### Gemini 3 & Gemini 4 Thinking

| Level     | Mô tả                                      | Models hỗ trợ                                                                                                            |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `off`     | Không bật thinking (default trên Gemini 3) | `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview` (không hỗ trợ trên `gemini-4-argon`) |
| `minimal` | Gần như không suy nghĩ                     | `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`                                                                |
| `low`     | Nhanh, ít reasoning                        | `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview`, `gemini-4-argon`                    |
| `medium`  | Cân bằng (default trên `gemini-4-argon`)   | `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview`, `gemini-4-argon`                    |
| `high`    | Maximum reasoning depth                    | `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview`, `gemini-4-argon`                    |

**Thought Signatures**: Khi `includeThoughts: true`, API trả về `thoughtSignature` / `thoughtSignatures` trong response. Các chữ ký này PHẢI được bảo toàn qua `extractThoughtSignatures(meta)` và gửi lại trong các turn tiếp theo để duy trì reasoning chain.

### DeepSeek V4 Thinking

| Vikini Level               | DeepSeek Config                                           | Mô tả                                  |
| -------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `off`                      | `thinking: { type: "disabled" }`                          | Không suy nghĩ, cho phép `temperature` |
| `low`, `medium`, `minimal` | `thinking: { type: "enabled" }, reasoning_effort: "high"` | Suy luận mặc định                      |
| `high`                     | `thinking: { type: "enabled" }, reasoning_effort: "max"`  | Suy luận tối đa                        |

> [!WARNING]
> Khi thinking enabled, DeepSeek **bỏ qua** `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`.
> Response chứa `reasoning_content` (CoT) bên cạnh `content` — Vikini inject `<think>` tags để frontend ThinkingBlock render.

### Z.ai GLM 5.2 Thinking & Specs

| Thuộc tính             | Giá trị                                                     |
| ---------------------- | ----------------------------------------------------------- |
| **Tên hiển thị**       | GLM 5.2                                                     |
| **ID Canonical**       | `z-ai/glm-5.2`                                              |
| **Nhà phát triển**     | Z.ai (Zhipu AI) - Phát hành 06/2026                         |
| **Provider Routing**   | **CoreWeave** (`coreweave/fp4`, FP4 precision, 100% uptime) |
| **Kiến trúc**          | Mixture-of-Experts (MoE) 753B (IndexShare Attention)        |
| **Context window**     | 1,048,576 tokens (~1.05M)                                   |
| **Output token limit** | 65,536 (trần an toàn chat streaming)                        |
| **Đơn giá API**        | $0.76/M input, $2.42/M output, $0.14/M cache read           |
| **Thinking UI**        | `off` / `high` (tắt ngầm khi undefined/off; effort high)    |

---

## Local Models (Strata Engine - 32K Context)

| Thuộc tính             | Giá trị                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| **Tên hiển thị**       | `Orcarouter-qwen3.8-flash-next-uncensored-iq3`                            |
| **ID Nội bộ**          | `strata-local` (`providerId: "local"`, `category: "local"`)               |
| **ID Upstream**        | `orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs` (125B MoE, `qwen4exp`) |
| **Engine**             | Strata Local Inference (`http://127.0.0.1:8080/v1`, loopback-only)        |
| **Context window**     | 32,768 tokens (32K, `--kv int8 --prefill 512`)                            |
| **Output token limit** | 16,384 tokens (thinking `high`: 12K reasoning + 4K answer reserve)        |
| **Thinking UI**        | `off` (mặc định) / `low` (≤4K) / `medium` (≤8K) / `high` (≤12K)           |
| **Sampling Presets**   | Mặc định Qwen / Viết truyện (`creative`) / Tùy chỉnh (`custom`)           |
| **Inputs**             | Text + Text-extracted Documents (không hỗ trợ Image/Audio/Video/Web)      |

---

## Model Aliases

Vikini tự động redirect các model ID cũ sang model canonical hiện hành (`src/lib/core/modelRegistry.ts`):

| Alias cũ                     | → Redirect sang                 |
| ---------------------------- | ------------------------------- |
| `gemini-2.0-flash`           | `gemini-3.5-flash-lite`         |
| `gemini-2.0-flash-exp`       | `gemini-3.5-flash-lite`         |
| `gemini-1.5-pro`             | `gemini-3.5-flash-lite`         |
| `gemini-1.5-flash`           | `gemini-3.5-flash-lite`         |
| `gemini-2.5-flash`           | `gemini-3.5-flash-lite`         |
| `gemini-2.5-pro`             | `gemini-3.8-flash`              |
| `gemini-3-flash`             | `gemini-3-flash-preview`        |
| `gemini-3-pro-image-preview` | `gemini-3-pro-image`            |
| `gemini-3-pro`               | `gemini-3.1-pro-preview`        |
| `gemini-3-pro-preview`       | `gemini-3.1-pro-preview`        |
| `gemini-3.1-pro`             | `gemini-3.1-pro-preview`        |
| `gemini-3.1-flash-lite`      | `gemini-3.1-flash-lite-preview` |
| `gemini-4-argon-preview`     | `gemini-4-argon`                |
| `llama3-70b-8192`            | `llama-3.3-70b-versatile`       |
| `llama3-8b-8192`             | `llama-3.1-8b-instant`          |
| `llama-3.1-70b-versatile`    | `llama-3.3-70b-versatile`       |
| `llama-3.1-70b-specdec`      | `llama-3.3-70b-versatile`       |
| `deepseek-chat`              | `deepseek-v4-flash`             |
| `deepseek-reasoner`          | `deepseek-v4-flash`             |
| `deepseek-v4-pro`            | `deepseek/deepseek-v4-pro`      |
| `deepseek-v4.1-flash`        | `deepseek/deepseek-v4.1-flash`  |
| `z-ai/glm-5.2-20260616`      | `z-ai/glm-5.2`                  |
| `glm-5.2`                    | `z-ai/glm-5.2`                  |

> [!NOTE]
> Các model OpenRouter Free cũ đã ngừng miễn phí (`meta-llama/llama-4-maverick:free`, `meta-llama/llama-3.3-70b-instruct:free`, `google/gemma-3-27b-it:free`, `mistral/mistral-small-3.1-24b-instruct:free`) đã được gỡ khỏi `SELECTABLE_MODELS` và tự động fallback an toàn về `DEFAULT_MODEL` (`gemini-3.5-flash-lite`) qua `coerceStoredModel()`.

---

## Liên kết

- [Google AI Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
- [Vikini Contracts](./contracts.md)
