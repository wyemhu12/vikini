# Danh sách Model và Tính năng - Vikini

> **Updated**: 2026-05-03  
> **Nguồn**: [Google AI - Gemini Models](https://ai.google.dev/gemini-api/docs/models), [DeepSeek API](https://api-docs.deepseek.com/), [OpenRouter](https://openrouter.ai)

---

## Gemini 3.1 Series

> [!IMPORTANT]
> **Migration Notice (March 2026)**: `gemini-3-pro-preview` sẽ bị discontinue ngày 9/3/2026.
> Vikini đã migrate sang `gemini-3.1-pro-preview`. Alias cũ (`gemini-3-pro`, `gemini-3-pro-preview`) tự động redirect.

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
| Thinking Mode | ✅ Supported (off, low, high) |
| Search Grounding | ✅ Supported |
| URL Context | ✅ Supported |
| Function Calling | ✅ Supported |
| Code Execution | ✅ Supported |
| Structured Outputs | ✅ Supported |
| Caching | ✅ Supported |
| Image Generation | ❌ Not supported |
| Live API | ❌ Not supported |

---

### gemini-3-pro-image-preview

| Thuộc tính             | Giá trị            |
| ---------------------- | ------------------ |
| **Tên hiển thị**       | Gemini 3 Pro Image |
| **Input token limit**  | 65,536 (65K)       |
| **Output token limit** | 32,768 (32K)       |
| **Inputs**             | Text, Image        |
| **Outputs**            | Text, Image        |

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
| **Input token limit**  | 1,048,576 (1M)                 |
| **Output token limit** | 65,536 (65K)                   |
| **Inputs**             | Text, Image, Video, Audio, PDF |
| **Outputs**            | Text                           |

**Supported Features:**
| Feature | Status |
|---------|--------|
| Thinking Mode | ✅ Supported (off, minimal, low, medium, high) |
| Search Grounding | ✅ Supported |
| URL Context | ✅ Supported |
| Function Calling | ✅ Supported |
| Code Execution | ✅ Supported |
| Structured Outputs | ✅ Supported |
| Caching | ✅ Supported |
| Image Generation | ❌ Not supported |
| Live API | ❌ Not supported |

> [!NOTE]
> Flash models support thêm 2 thinking levels: `minimal` và `medium` (4 levels thay vì 3).

---

## Gemini 2.5 Series

### gemini-2.5-flash

| Thuộc tính             | Giá trị          |
| ---------------------- | ---------------- |
| **Tên hiển thị**       | Gemini 2.5 Flash |
| **Input token limit**  | 1,000,000 (1M)   |
| **Output token limit** | 65,535           |
| **Category**           | Low-latency      |

---

### gemini-2.5-pro

| Thuộc tính             | Giá trị                 |
| ---------------------- | ----------------------- |
| **Tên hiển thị**       | Gemini 2.5 Pro          |
| **Input token limit**  | 2,000,000 (2M)          |
| **Output token limit** | 65,535                  |
| **Category**           | Low-latency / Reasoning |

---

## DeepSeek V4 Models (Direct API)

> [!IMPORTANT]
> **Deprecation Notice**: `deepseek-chat` và `deepseek-reasoner` sẽ bị deprecated vào **2026/07/24**.
> Vikini đã map chúng sang `deepseek-v4-flash` qua alias. Dùng V4 models cho mọi tích hợp mới.

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

### deepseek-v4-pro

| Thuộc tính             | Giá trị                                 |
| ---------------------- | --------------------------------------- |
| **Tên hiển thị**       | DeepSeek V4 Pro                         |
| **Input token limit**  | 128,000                                 |
| **Output token limit** | 8,192                                   |
| **Category**           | Reasoning                               |
| **Provider**           | Direct API (`https://api.deepseek.com`) |
| **API Key**            | `DEEPSEEK_API_KEY`                      |
| **Pricing**            | Đang giảm 75% đến 2026/05/31            |

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

> [!TIP]
> V4 Pro là model flagship thông minh nhất của DeepSeek, tối ưu cho complex reasoning.
> Đang có chương trình giảm giá 75% đến hết tháng 5/2026.

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

### Gemini 3 Thinking

| Level     | Mô tả                        | Models      |
| --------- | ---------------------------- | ----------- |
| `off`     | Không bật thinking (default) | Pro + Flash |
| `minimal` | Gần như không suy nghĩ       | Flash only  |
| `low`     | Nhanh, ít reasoning          | Pro + Flash |
| `medium`  | Cân bằng                     | Flash only  |
| `high`    | Maximum reasoning depth      | Pro + Flash |

**Thought Signatures**: Khi `includeThoughts: true`, API trả về `thoughtSignature` trong response. Signature này PHẢI được gửi lại trong các turn tiếp theo để duy trì reasoning chain.

### DeepSeek V4 Thinking

| Vikini Level               | DeepSeek Config                                           | Mô tả                                  |
| -------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `off`                      | `thinking: { type: "disabled" }`                          | Không suy nghĩ, cho phép `temperature` |
| `low`, `medium`, `minimal` | `thinking: { type: "enabled" }, reasoning_effort: "high"` | Suy luận mặc định                      |
| `high`                     | `thinking: { type: "enabled" }, reasoning_effort: "max"`  | Suy luận tối đa                        |

> [!WARNING]
> Khi thinking enabled, DeepSeek **bỏ qua** `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`.
> Response chứa `reasoning_content` (CoT) bên cạnh `content` — Vikini inject `<think>` tags để frontend ThinkingBlock render.

### Vikini Implementation

- **UI**: Dropdown selector cho Gemini 3 + DeepSeek V4 models
- **Default**: "Off" (không bật thinking)
- **Research mode**: Forced "high" (user không thể thay đổi)
- **Storage**: `localStorage.vikini.thinkingLevel`

---

## Model Aliases

Vikini tự động redirect các model ID cũ sang model mới:

| Alias cũ               | → Redirect sang          |
| ---------------------- | ------------------------ |
| `deepseek-chat`        | `deepseek-v4-flash`      |
| `deepseek-reasoner`    | `deepseek-v4-flash`      |
| `gemini-3-pro`         | `gemini-3.1-pro-preview` |
| `gemini-3-pro-preview` | `gemini-3.1-pro-preview` |
| `gemini-2.0-flash`     | `gemini-2.5-flash`       |

---

## Liên kết

- [Google AI Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
- [Vikini Contracts](./contracts.md)
