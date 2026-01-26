# Danh sách Model và Tính năng - Vikini

> **Cập nhật**: 2026-01-26  
> **Nguồn**: [Google AI - Gemini Models](https://ai.google.dev/gemini-api/docs/models)

---

## Gemini 3 Series (Latest)

### gemini-3-pro-preview

| Thuộc tính             | Giá trị                        |
| ---------------------- | ------------------------------ |
| **Tên hiển thị**       | Gemini 3 Pro                   |
| **Input token limit**  | 1,048,576 (1M)                 |
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

## Thinking Mode (Gemini 3 Only)

Thinking mode cho phép AI "suy nghĩ sâu" trước khi trả lời, cải thiện quality cho các task phức tạp.

### Thinking Levels

| Level     | Mô tả                        | Models      |
| --------- | ---------------------------- | ----------- |
| `off`     | Không bật thinking (default) | Pro + Flash |
| `minimal` | Gần như không suy nghĩ       | Flash only  |
| `low`     | Nhanh, ít reasoning          | Pro + Flash |
| `medium`  | Cân bằng                     | Flash only  |
| `high`    | Maximum reasoning depth      | Pro + Flash |

### Thought Signatures

Khi `includeThoughts: true`, API trả về `thoughtSignature` trong response. Signature này PHẢI được gửi lại trong các turn tiếp theo để duy trì reasoning chain.

```typescript
interface ThinkingConfig {
  thinkingLevel: "off" | "low" | "medium" | "high" | "minimal";
  includeThoughts?: boolean; // true để nhận signature
}
```

### Vikini Implementation

- **UI**: Dropdown selector cho tất cả Gemini 3 models
- **Default**: "Off" (không bật thinking)
- **Research mode**: Forced "high" (user không thể thay đổi)
- **Storage**: `localStorage.vikini.thinkingLevel`

---

## Liên kết

- [Google AI Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Vikini Contracts](./contracts.md)
