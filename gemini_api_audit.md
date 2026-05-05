# 🔍 Gemini API Audit: Vikini vs Official Docs (May 2026)

> **Phân tích ngày:** 05/05/2026  
> **Nguồn:** https://ai.google.dev/gemini-api/docs (tất cả các mục trong sidebar)  
> **Project:** Vikini Chat — `@google/genai` SDK

---

## 📊 Tổng quan nhanh

| Danh mục              | Tổng tính năng | Vikini ĐÃ CÓ | Vikini CHƯA CÓ | Mức phủ |
| --------------------- | :------------: | :----------: | :------------: | :-----: |
| **Models**            |      15+       |      5       |      10+       | ⚠️ 33%  |
| **Core Capabilities** |       9        |      4       |       5        | ⚠️ 44%  |
| **Tools**             |       7        |      2       |       5        | 🔴 29%  |
| **Agents**            |       2        |      0       |       2        |  🔴 0%  |
| **Live API**          |    1 suite     |      0       |       1        |  🔴 0%  |
| **Optimization**      |       5        |      0       |       5        |  🔴 0%  |
| **Guides**            |       7        |      3       |       4        | ⚠️ 43%  |

---

## ✅ PHẦN 1: Vikini ĐÃ CÓ (đang hoạt động)

### 1.1 Models (Registry)

| Model              | Official ID                  |          Vikini Status           |
| ------------------ | ---------------------------- | :------------------------------: |
| Gemini 2.5 Flash   | `gemini-2.5-flash`           |     ✅ Stable, default model     |
| Gemini 2.5 Pro     | `gemini-2.5-pro`             |            ✅ Stable             |
| Gemini 3 Flash     | `gemini-3-flash-preview`     |            ✅ Preview            |
| Gemini 3.1 Pro     | `gemini-3.1-pro-preview`     |   ✅ Preview (replaces 3 Pro)    |
| Gemini 3 Pro Image | `gemini-3-pro-image-preview` | ✅ In API_ALLOWED (Image Studio) |

### 1.2 Core Capabilities (Implemented)

| Tính năng                | Docs Page                                                                        | Vikini Implementation                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Text Generation**      | [text-generation](https://ai.google.dev/gemini-api/docs/text-generation)         | ✅ `chatStreamCore.ts` + `streaming.ts` — full streaming SSE                                           |
| **Thinking / Reasoning** | [thinking](https://ai.google.dev/gemini-api/docs/thinking)                       | ✅ `thinkingConfig` with `thinkingLevel` (Gemini 3) + `thinkingBudget` (Gemini 2.5) — proper dual-mode |
| **Thought Signatures**   | [thought-signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)   | ✅ Multi-step signature collection + re-injection across turns                                         |
| **Image Understanding**  | [image-understanding](https://ai.google.dev/gemini-api/docs/image-understanding) | ✅ Attachment system supports image input to Gemini                                                    |
| **Structured Outputs**   | [structured-output](https://ai.google.dev/gemini-api/docs/structured-output)     | ✅ Research done, used in `autoTitleEngine.ts` (zodToJsonSchema)                                       |
| **Image Generation**     | [image-generation](https://ai.google.dev/gemini-api/docs/image-generation)       | ✅ `lib/features/image-gen/` — Nano Banana (Gemini 3 Pro Image) + Imagen + providers                   |

### 1.3 Tools (Implemented)

| Tool              | Docs Page                                                            | Vikini Implementation                                               |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Google Search** | [google-search](https://ai.google.dev/gemini-api/docs/google-search) | ✅ `googleSearch` grounding — toggle from UI, strict tool isolation |
| **URL Context**   | [url-context](https://ai.google.dev/gemini-api/docs/url-context)     | ✅ `urlContext` tool — supported for Gemini 3 models                |

### 1.4 Guides (Implemented)

| Guide               | Vikini Implementation                                         |
| ------------------- | ------------------------------------------------------------- |
| **Token Counting**  | ✅ Usage metadata extraction + persistence to DB              |
| **Embeddings**      | ✅ `gemini-embedding-001` used in Knowledge Base RAG pipeline |
| **Safety Settings** | ⚠️ Partial — not explicitly configurable by user in UI        |

---

## 🔴 PHẦN 2: Vikini CHƯA CÓ (Missing Features)

### 2.1 Models — Thiếu hoàn toàn

| Model                     | Official ID                                    | Mô tả                                                  |          Ưu tiên           |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------ | :------------------------: |
| **Gemini 3.1 Flash-Lite** | `gemini-3.1-flash-lite-preview`                | Rẻ nhất, nhanh nhất trong series 3                     |         🟡 Medium          |
| **Gemini 3.1 Flash Live** | `gemini-3.1-flash-live-preview`                | Dedicated cho Live API (realtime voice)                |           🔵 Low           |
| **Gemini 3.1 Flash TTS**  | `gemini-3.1-flash-tts-preview`                 | Text-to-Speech chuyên dụng                             |         🟡 Medium          |
| **Nano Banana 2**         | `gemini-3.1-flash-image-preview`               | Image gen mới, nhanh hơn Nano Banana Pro               |          🟢 High           |
| **Veo 3.1**               | `veo-3.1-generate-preview`                     | Video generation với audio                             |           🔵 Low           |
| **Veo 3.1 Lite**          | `veo-3.1-lite-generate-preview`                | Video generation tiết kiệm                             |           🔵 Low           |
| **Lyria 3 Pro/Clip**      | `lyria-3-pro-preview` / `lyria-3-clip-preview` | Music generation                                       |           🔵 Low           |
| **Lyria RealTime**        | `lyria-realtime-exp`                           | Realtime music streaming                               |           🔵 Low           |
| **Imagen 4**              | `imagen-4-*`                                   | Text-to-image standalone                               | 🔵 Low (đã có Nano Banana) |
| **Gemini Embedding 2**    | `gemini-embedding-2`                           | Multimodal embeddings (text, image, video, audio, PDF) |          🟢 High           |
| **Gemini Deep Research**  | `deep-research-preview-04-2026`                | Autonomous research agent                              |          🟢 High           |
| **Computer Use**          | `gemini-2.5-computer-use-preview`              | Browser automation                                     |           🔵 Low           |

### 2.2 Core Capabilities — Thiếu

| Tính năng                   | Docs Page                                                                        | Mô tả                                                     |  Ưu tiên  |
| --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | :-------: |
| **Video Understanding**     | [video-understanding](https://ai.google.dev/gemini-api/docs/video-understanding) | Gửi video input cho Gemini phân tích                      | 🟡 Medium |
| **Audio Understanding**     | [audio](https://ai.google.dev/gemini-api/docs/audio)                             | Gửi audio/speech input cho Gemini transcribe + analyze    | 🟡 Medium |
| **Document Processing**     | [document-processing](https://ai.google.dev/gemini-api/docs/document-processing) | PDF processing lên tới 1000 trang multimodal              |  🟢 High  |
| **Speech Generation (TTS)** | [speech-generation](https://ai.google.dev/gemini-api/docs/speech-generation)     | Gemini native TTS — chuyển text→audio với voices tùy chọn |  🟢 High  |
| **Function Calling**        | [function-calling](https://ai.google.dev/gemini-api/docs/function-calling)       | Model gọi custom functions — agentic workflows            |  🟢 High  |
| **Long Context**            | [long-context](https://ai.google.dev/gemini-api/docs/long-context)               | Tối ưu 1M+ token input                                    | 🟡 Medium |

### 2.3 Tools — Thiếu

| Tool                 | Docs Page                                                                  | Mô tả                                                     |  Ưu tiên  |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | :-------: |
| **Code Execution**   | [code-execution](https://ai.google.dev/gemini-api/docs/code-execution)     | Gemini chạy Python code trong sandbox an toàn             |  🟢 High  |
| **Google Maps**      | [maps-grounding](https://ai.google.dev/gemini-api/docs/maps-grounding)     | Location-aware responses với Google Maps data             |  🔵 Low   |
| **Computer Use**     | [computer-use](https://ai.google.dev/gemini-api/docs/computer-use)         | UI automation — click, type, navigate                     |  🔵 Low   |
| **File Search**      | [file-search](https://ai.google.dev/gemini-api/docs/file-search)           | Built-in RAG — Google quản lý vector store                | 🟡 Medium |
| **Tool Combination** | [tool-combination](https://ai.google.dev/gemini-api/docs/tool-combination) | Kết hợp Google Search + Function Calling + Code Execution |  🟢 High  |

### 2.4 Agents — Thiếu hoàn toàn

| Agent                   | Docs Page                                                            | Mô tả                                                                                                                                                                                                                                                              |   Ưu tiên   |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------: |
| **Deep Research Agent** | [deep-research](https://ai.google.dev/gemini-api/docs/deep-research) | Agent tự lập kế hoạch → tìm kiếm → tổng hợp → báo cáo. Sử dụng **Interactions API** mới. 2 phiên bản: `deep-research-preview-04-2026` (nhanh) và `deep-research-max-preview-04-2026` (sâu). Hỗ trợ collaborative planning, visualization, MCP servers, file_search | 🟢 **High** |
| **Interactions API**    | [interactions](https://ai.google.dev/gemini-api/docs/interactions)   | API thế hệ mới thay thế `generateContent`. Quản lý state server-side, multi-turn stateful, background tasks, tool orchestration                                                                                                                                    |  🟡 Medium  |

### 2.5 Live API — Thiếu hoàn toàn

| Tính năng    | Docs Page                                                  | Mô tả                                                                                                                                                                                                                         |  Ưu tiên  |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------: |
| **Live API** | [live-api](https://ai.google.dev/gemini-api/docs/live-api) | Real-time voice + video bidirectional streaming qua WebSocket. Models: `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-*`. Features: barge-in, multilingual (70 langs), affective dialog, audio transcription | 🟡 Medium |

> **Ghi chú:** Vikini hiện có `lib/features/voice/` với `useSpeechRecognition.ts` và `useSpeechSynthesis.ts` — nhưng đây là **Web Speech API** phía browser, KHÔNG phải Gemini Live API.

### 2.6 Optimization — Thiếu hoàn toàn

| Tính năng              | Docs Page                                                                      | Mô tả                                                               |   Ưu tiên   |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- | :---------: |
| **Context Caching**    | [caching](https://ai.google.dev/gemini-api/docs/caching)                       | Cache system prompt / large docs → giảm cost đáng kể cho multi-turn | 🟢 **High** |
| **Batch API**          | [batch-api](https://ai.google.dev/gemini-api/docs/batch-api)                   | Xử lý hàng loạt requests async — giá rẻ hơn 50%                     |   🔵 Low    |
| **Flex Inference**     | [flex-inference](https://ai.google.dev/gemini-api/docs/flex-inference)         | Giảm giá khi chấp nhận latency cao hơn                              |   🔵 Low    |
| **Priority Inference** | [priority-inference](https://ai.google.dev/gemini-api/docs/priority-inference) | Đảm bảo SLA cho production                                          |   🔵 Low    |
| **Webhooks**           | [webhooks](https://ai.google.dev/gemini-api/docs/webhooks)                     | Callback notifications cho async tasks                              |   🔵 Low    |

### 2.7 Guides — Thiếu

| Guide                    | Docs Page                                                                  |                      Vikini Status                      |  Ưu tiên  |
| ------------------------ | -------------------------------------------------------------------------- | :-----------------------------------------------------: | :-------: |
| **Files API**            | [files](https://ai.google.dev/gemini-api/docs/files)                       | ❌ Chưa dùng Files API (upload lớn cho video/audio/PDF) |  🟢 High  |
| **Media Resolution**     | [media-resolution](https://ai.google.dev/gemini-api/docs/media-resolution) |   ❌ Chưa cấu hình media resolution cho image inputs    |  🔵 Low   |
| **OpenAI Compatibility** | [openai](https://ai.google.dev/gemini-api/docs/openai)                     |         ❌ Chưa dùng endpoint OpenAI-compatible         |  🔵 Low   |
| **Safety Settings (UI)** | [safety-settings](https://ai.google.dev/gemini-api/docs/safety-settings)   |   ⚠️ Không có UI để user tùy chỉnh safety thresholds    | 🟡 Medium |

---

## 🎯 PHẦN 3: Roadmap đề xuất (theo ưu tiên)

### 🟢 Ưu tiên CAO — Nên làm sớm

|  #  | Feature                     | Lý do                                                                                                                      | Effort |
| :-: | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | :----: |
|  1  | **Context Caching**         | Giảm chi phí 50-90% cho system prompts + GEMs persona dài. Gemini tính phí cache thấp hơn nhiều so với re-send mỗi request | Medium |
|  2  | **Deep Research Agent**     | Killer feature — dùng Interactions API mới. Agent tự search + tổng hợp → report. Vikini đã có KI roadmap cho feature này   |  High  |
|  3  | **Function Calling**        | Nền tảng cho agentic workflows. Cho phép model gọi external APIs (weather, database, calculator...)                        | Medium |
|  4  | **Code Execution**          | Gemini chạy Python code trực tiếp — perfect cho data analysis, math, chart generation                                      |  Low   |
|  5  | **Tool Combination**        | Kết hợp Google Search + Code Execution + Function Calling trong 1 request — cần cho advanced agents                        | Medium |
|  6  | **Document Processing**     | PDF multimodal processing — rất hữu ích cho Knowledge Base. Upload PDF → Gemini hiểu nội dung + hình ảnh                   | Medium |
|  7  | **Files API**               | Upload files lớn (video, audio, PDF >20MB) qua Files API thay vì inline base64                                             | Medium |
|  8  | **Speech Generation (TTS)** | Nâng cấp voice feature: Gemini native TTS thay vì browser Web Speech API                                                   | Medium |
|  9  | **Gemini Embedding 2**      | Multimodal embeddings — upgrade RAG pipeline hỗ trợ image + video + audio search                                           | Medium |
| 10  | **Nano Banana 2**           | Image gen model mới, nhanh hơn, rẻ hơn — thêm vào Image Studio                                                             |  Low   |

### 🟡 Ưu tiên TRUNG BÌNH

|  #  | Feature                    | Lý do                                                                              |
| :-: | -------------------------- | ---------------------------------------------------------------------------------- |
| 11  | **Interactions API**       | API thế hệ mới — stateful server-side, đơn giản hóa multi-turn. Cân nhắc migration |
| 12  | **Video Understanding**    | Gửi video cho Gemini phân tích — phù hợp Knowledge Base                            |
| 13  | **Audio Understanding**    | Gửi audio cho Gemini transcribe/analyze                                            |
| 14  | **File Search (built-in)** | RAG do Google quản lý — có thể thay thế/bổ sung RAG pipeline hiện tại              |
| 15  | **Live API**               | Real-time voice chat — nâng cấp lớn cho UX                                         |
| 16  | **Safety Settings UI**     | Cho user tùy chỉnh safety thresholds                                               |
| 17  | **Gemini 3.1 Flash-Lite**  | Model rẻ nhất trong series 3 — tiết kiệm cho tasks đơn giản                        |

### 🔵 Ưu tiên THẤP

|  #  | Feature                     | Lý do                                                   |
| :-: | --------------------------- | ------------------------------------------------------- |
| 18  | Video Generation (Veo)      | Niche feature, tốn resource                             |
| 19  | Music Generation (Lyria)    | Niche feature                                           |
| 20  | Computer Use                | Complex, cần infra riêng                                |
| 21  | Google Maps Grounding       | Niche — location-based apps                             |
| 22  | Batch API / Flex / Priority | Production optimization — chưa cần ở giai đoạn hiện tại |
| 23  | Robotics                    | Không liên quan                                         |

---

## 📝 PHẦN 4: Model Registry — Cần update

### 4.1 Models mới cần thêm vào `modelRegistry.ts`

```diff
+ // Gemini 3.1 Flash-Lite (May 2026)
+ {
+   id: "gemini-3.1-flash-lite-preview",
+   name: "Gemini 3.1 Flash-Lite",
+   descKey: "modelDescFlashLite31",
+   tokenLimit: 1000000,
+   contextWindow: 1000000,
+   maxOutputTokens: 65536,
+   category: "low-latency",
+   providerId: "gemini",
+ },
+
+ // Gemini Embedding 2 (for RAG upgrade)
+ // Note: Not a chat model — used internally for embeddings
```

### 4.2 Models đã deprecated theo official docs

| Model                   |      Status      | Action                                    |
| ----------------------- | :--------------: | ----------------------------------------- |
| `gemini-2.0-flash`      |  ⚠️ Deprecated   | ✅ Đã có alias → `gemini-2.5-flash`       |
| `gemini-2.0-flash-lite` |  ⚠️ Deprecated   | ✅ Đã có alias                            |
| `gemini-3-pro-preview`  | 🔴 **Shut down** | ✅ Đã redirect → `gemini-3.1-pro-preview` |

---

## 🏗️ PHẦN 5: Architecture Gap Analysis

### Vikini hiện dùng `generateContent` / `generateContentStream`

- **Docs khuyến nghị:** Chuyển sang **Interactions API** (`client.interactions.create()`) cho:
  - Stateful multi-turn (server quản lý history)
  - Background tasks (Deep Research)
  - Unified tool orchestration

### Vikini voice = Browser Web Speech API

- **Docs cung cấp:** Gemini **Live API** (WebSocket) với:
  - Native audio input/output
  - Barge-in (ngắt giữa chừng)
  - 70 languages
  - Affective dialog (nhận diện cảm xúc)
  - Chuyên dụng model: `gemini-3.1-flash-live-preview`

### Vikini RAG = Custom pipeline (Supabase + `gemini-embedding-001`)

- **Docs cung cấp:** Built-in **File Search** tool — Google quản lý vector store
- **Và:** **Gemini Embedding 2** — multimodal embeddings cho cả image/video/audio

---

## 💡 Key Takeaways

1. **Vikini đã cover tốt core chat + thinking + search grounding** — đây là foundation vững chắc
2. **Thiếu lớn nhất: Agentic capabilities** (Function Calling, Code Execution, Deep Research, Tool Combination)
3. **Tiết kiệm chi phí: Context Caching** là feature #1 nên triển khai — giảm cost system prompt/GEM persona cho mỗi request
4. **Deep Research Agent** là killer feature mới nhất — phù hợp roadmap Vikini đã lên kế hoạch
5. **Interactions API** đang dần thay thế `generateContent` — cần lên kế hoạch migration
6. **Model registry cần cập nhật** để phản ánh Gemini 3.1 Flash-Lite và Nano Banana 2
