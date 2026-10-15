# Kế Hoạch Triển Khai: Novelcrafter Studio — Full-Width Canvas, Unified Inline Story Bible, và Sửa Lỗi Định Tuyến Mô Hình Gemini 4 / Claude

## Technical Plan (Revision 4 - Addressing Audit Run 3)

### 1. Mục Tiêu (Goal)

Giải quyết triệt để 3 vấn đề trải nghiệm cốt lõi và lỗi hạ tầng mô hình AI trên **Novelcrafter Studio** (`/novelcrafter`):

1. **Khung soạn thảo văn xuôi và khung Phân cảnh (Draft / Beats) co giãn Full-Width Canvas**: Loại bỏ giới hạn cứng `max-w-[820px]` trong [ChapterEditorWorkspace.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx) khiến màn hình rộng bị hổng 50% diện tích bên phải; chuyển sang hệ thống responsive container `w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl` kết hợp padding chuẩn (`px-6 md:px-12 lg:px-16`) giúp khung phân cảnh (Scenes / Beats) và khung soạn thảo văn xuôi tự nhiên lấp đầy tờ giấy viết. Thêm `key={chapter.id}` trên textarea để reset chiều cao sạch sẽ khi chuyển chương.
2. **Hợp nhất Story Bible nằm ngay PHÍA DƯỚI khung text chính (Single Unified Document Canvas kiểu Sudowrite)**: Xóa bỏ cơ chế chuyển đổi màn hình loại trừ lẫn nhau `{isStoryBibleOpen ? <StoryBibleWorkspace /> : <ChapterEditorWorkspace />}` trong [NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx). Hợp nhất Story Bible thành phân khu Accordion hiển thị trực tiếp ngay dưới khung soạn thảo chương trong cùng một luồng cuộn duy nhất. Hỗ trợ cuộn mượt (`scrollIntoView({ behavior: "smooth" })`) đến đúng 1 trong 7 phân khu độc lập (`braindump`, `genre`, `style`, `synopsis`, `characters`, `worldbuilding`, `outline`) thông qua cơ chế Jump Request với nonce tránh tự cuộn khi tải trang (Cold-start). Gỡ bỏ lệnh cưỡng chế đóng Bible `isStoryBibleOpen: false` trong `useNovelcrafterStateMutators.ts` khi chọn/thêm chương.
3. **Khắc phục lỗi mô hình Gemini 4 (`gemini-4-argon`) và Claude fallback qua OpenRouter**:
   - Tách hàm thuần client-safe `isModelAllowedById` vào [src/lib/core/modelRegistry.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts) có co-located unit test. Thay thế thẻ HTML `<select>` thô trên [NovelcrafterTopBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx) bằng default import component `ModelSelector` của Vikini (có icon logo, phân loại tab Providers/Service, dropdown `expandDown={true}`, `disabled={false}`, kiểm tra quyền hạn `isModelAllowedById` đối chiếu 2 chiều cả định danh gốc và alias để không bị vô hiệu hóa oan `gemini-4-argon`).
   - Cung cấp cấu hình bắt buộc Always-On Thinking chuẩn SDK `@google/genai` sử dụng enum `ThinkingLevel` (`SDK_THINKING_LEVEL_MAP: { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH }`) và `maxOutputTokens` khi gọi `@google/genai` `generateContentStream` cho họ mô hình Gemini 4 trong [novelcrafterStreamRunner.server.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts), bảo đảm 100% vượt qua `tsc --noEmit` không lỗi `TS2322`.
   - Bổ sung cơ chế fallback tự động sang OpenRouter cho các mô hình Claude khi môi trường server không cấu hình trực tiếp biến `ANTHROPIC_API_KEY`, truyền tham số `{ signal }` hủy kết nối upstream tức thời cho cả Anthropic và OpenRouter, đồng bộ với chuẩn kiến trúc tại `chatStreamCore.ts`.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ bảng **Pre-Work Protocol** trong `.agents/rules/02-quality.md`:

| Tài liệu / Quy chuẩn            | Đường dẫn                                                    | Mục đích đối soát                                                                                                                                          |
| :------------------------------ | :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Streaming Patterns**          | `.agents/skills/streaming-patterns.md`                       | Chuẩn định dạng 5 sự kiện SSE (`meta`, `thinking`, `token`, `done`, `error`) và quản lý hủy luồng `AbortSignal`.                                           |
| **Plan Review Protocol**        | `.agents/rules/05-plan-review.md`                            | Tuân thủ Code Freeze, phân khu kép `## Technical Plan` / `## Audit History`, cấm tự duyệt `[PLAN_APPROVED]`.                                               |
| **Reviewer Mental Simulation**  | `.agents/agents/reviewer/mental-simulation.md`               | Đối soát 6 kịch bản đối kháng S1–S6 và Domain Open Inquiry.                                                                                                |
| **Quality & Coding Guidelines** | `.agents/rules/01-coding.md` & `.agents/rules/02-quality.md` | Chuẩn TypeScript strict, cấm `any`, kiểm soát kích thước file 150–400 dòng, quy trình kiểm thử Tier 1 (`npm run type-check`) và Tier 2 (`npm run verify`). |
| **Bilingual Translation Rules** | `.agents/rules/04-bilingual.md`                              | Cấm hardcode text UI, bổ sung translation keys đồng bộ cho cả `vi.ts` và `en.ts`.                                                                          |
| **Model Registry & Limits**     | `src/lib/core/modelRegistry.ts`, `src/lib/core/limits.ts`    | Đối soát hàm `isGemini4Model`, `normalizeModelForApi`, `coerceStoredModel`, `isModelAllowedForUser`.                                                       |
| **Claude Routing Reference**    | `src/app/api/chat-stream/chatStreamCore.ts:520-566`          | Đối soát mẫu chuẩn fallback từ Anthropic sang OpenRouter khi thiếu `ANTHROPIC_API_KEY`.                                                                    |

---

### 3. Assumptions & Cross-Task Dependencies

1. **Phụ thuộc cơ sở dữ liệu**: Không có thay đổi schema DB hay migration mới; cấu trúc lưu trữ `story_bible` và `chapters` trong bảng `conversations.metadata` của Supabase đã hoàn tất từ kế hoạch trước đó ([docs/plans/2026-10-14-novelcrafter-studio-implementation-plan.md](file:///c:/Users/wyemh/vikini/docs/plans/2026-10-14-novelcrafter-studio-implementation-plan.md)).
2. **Trạng thái Document Canvas & Auto-Resize Co Giãn 2 Chiều Không Giật**: Khung soạn thảo chương (`ChapterEditorWorkspace`) và Story Bible (`StoryBibleWorkspace`) chia sẻ chung một vùng cuộn dọc (`overflow-y-auto`). Chiều cao khung soạn thảo văn xuôi được quản lý qua hook `useAutoResizeTextarea` (loại bỏ `flex-1`, áp dụng `field-sizing: content` CSS 2026 kết hợp JS fallback đo `scrollHeight` có lưu/khôi phục `scrollTop`, `overflow-hidden resize-none`, tối thiểu `420px`), tự co giãn 2 chiều (cả dài ra lẫn ngắn lại khi xóa text) và remount theo `key={chapter.id}` khi chuyển chương để triệt tiêu hiện tượng giật màn hình và không để lại khoảng trắng thừa.
3. **Bảo toàn trạng thái khi chuyển chương và chèn từ History**: Trong canvas hợp nhất:
   - Các hàm `handleAppendToChapter` và `handleReplaceSelection` giữ nguyên trạng thái `isStoryBibleOpen`.
   - Các hàm mutator `selectChapter` và `addChapter` trong `useNovelcrafterStateMutators.ts` **không còn** gán `isStoryBibleOpen: false`, tôn trọng trạng thái mở/đóng Story Bible của người dùng xuyên suốt phiên làm việc.
4. **Môi trường Serverless & Khóa API**: Dự án Vikini có thể chạy với khóa `ANTHROPIC_API_KEY` trực tiếp hoặc qua cổng `OPENROUTER_API_KEY`. Khối `novelcrafterStreamRunner.server.ts` bắt buộc hoạt động trơn tru trong cả hai kịch bản triển khai.

---

### 4. Bảng Verified Versions (Năm 2026)

Tất cả thư viện liên quan đã được tra cứu và kiểm chứng tương thích:

| Thư viện / Công nghệ    | Phiên bản thực tế      | Link tài liệu chính thức `[URL]`                                                       | Trích dẫn mã nguồn dự án `[SRC]`                                  | Trạng thái tương thích                                                                                 |
| :---------------------- | :--------------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **Next.js**             | `^16.4.0` (App Router) | [npmjs.com/package/next](https://www.npmjs.com/package/next)                           | [package.json:64](file:///c:/Users/wyemh/vikini/package.json#L64) | Tương thích App Router streaming & dynamic server routes.                                              |
| **React**               | `^19.2.3`              | [npmjs.com/package/react](https://www.npmjs.com/package/react)                         | [package.json:69](file:///c:/Users/wyemh/vikini/package.json#L69) | Tương thích React 19 Client Components & Hooks.                                                        |
| **@google/genai**       | `^2.10.0`              | [npmjs.com/package/@google/genai](https://www.npmjs.com/package/@google/genai)         | [package.json:40](file:///c:/Users/wyemh/vikini/package.json#L40) | Export enum `ThinkingLevel` (`ThinkingLevel.MEDIUM = "MEDIUM"`), tương thích hoàn toàn `tsc --noEmit`. |
| **@anthropic-ai/sdk**   | `^0.71.2`              | [npmjs.com/package/@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) | [package.json:39](file:///c:/Users/wyemh/vikini/package.json#L39) | Hỗ trợ Claude streaming messages API kèm tùy chọn hủy `{ signal }`.                                    |
| **openai** (OpenRouter) | `^6.15.0`              | [npmjs.com/package/openai](https://www.npmjs.com/package/openai)                       | [package.json:67](file:///c:/Users/wyemh/vikini/package.json#L67) | Chuẩn OpenAI-compatible stream cho OpenRouter fallback kèm tùy chọn `{ signal }`.                      |
| **framer-motion**       | `^12.23.26`            | [npmjs.com/package/framer-motion](https://www.npmjs.com/package/framer-motion)         | [package.json:59](file:///c:/Users/wyemh/vikini/package.json#L59) | Animation co giãn mượt cho Accordion Story Bible và Beats (`TRANSITION.FAST` = 0.15s).                 |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới (Chiến Lược Module Hóa `<= 400` Dòng)

Nhằm tuân thủ tuyệt đối quy định về kích thước file (`.agents/rules/01-coding.md`: mục tiêu 150–400 dòng, Hard Max 500 dòng), kế hoạch Revision 4 phân tách các khối logic lớn:

| Thao tác   | Tệp tin                                                                                                                                                                        | Số dòng dự kiến | Trách nhiệm kiến trúc                                                                                                                                                                                                                                                                        |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[NEW]`    | [src/app/features/novelcrafter/hooks/useAutoResizeTextarea.ts](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/hooks/useAutoResizeTextarea.ts)                     |    ~75 dòng     | Hook quản lý tự động co giãn chiều cao 2 chiều của Textarea bảo toàn `scrollTop` không giật màn hình; cung cấp hàm `calculateScrollTopForCharOffset` đo bằng mirror-div chính xác 100% dòng soft-wrap có khối `finally` dọn dẹp node.                                                        |
| `[NEW]`    | [src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx)         |    ~110 dòng    | Tách cụm Phân cảnh chương (Scenes / Chapter Beats) và các nút AI sinh beats / rewrite beats khỏi `ChapterEditorWorkspace.tsx`.                                                                                                                                                               |
| `[NEW]`    | [src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx)     |    ~95 dòng     | Phân khu bọc Story Bible hiển thị inline dưới chân văn bản: đường divider mảnh, tiêu đề phân khu Sudowrite, nút thu gọn/đóng, `AnimatePresence initial={false}` và callback `onAnimationComplete` cuộn trang không giật kèm `useEffect` đồng bộ `wasOpenRef`.                                |
| `[NEW]`    | [src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx)         |    ~135 dòng    | Tách component thẻ accordion đại diện cho từng phân khu Story Bible (header, nút ẩn/hiện với AI, nút sinh AI / sửa lại AI) khỏi `StoryBibleWorkspace.tsx`.                                                                                                                                   |
| `[MODIFY]` | [src/lib/core/modelRegistry.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts)                                                                                   |    ~620 dòng    | Xuất khẩu hàm thuần client-safe `isModelAllowedById(modelId, allowedModelIds)` dùng `Object.hasOwn(MODEL_ALIASES, raw)` hỗ trợ đối chiếu 2 chiều alias, loại trừ ID không hợp lệ.                                                                                                            |
| `[MODIFY]` | [src/lib/core/modelRegistry.test.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.test.ts)                                                                         |    ~210 dòng    | Bổ sung co-located unit test cho `isModelAllowedById` (TC-04) gồm cả kiểm tra prototype pollution (`toString`).                                                                                                                                                                              |
| `[MODIFY]` | [src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx)       |    ~280 dòng    | Loại bỏ giới hạn cứng `max-w-[820px]`; gán `key={chapter.id}` trên textarea; reset `scrollContainerRef.current.scrollTop = 0` khi đổi chương; tích hợp `useAutoResizeTextarea`; cuộn container ngoài chính xác bằng mirror-div khi nhảy tới feedback quote; nhúng `InlineStoryBibleSection`. |
| `[MODIFY]` | [src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx)             |    ~240 dòng    | Gỡ bỏ hoàn toàn `prop activeSection` và `useEffect([activeSection])` tự cuộn; nhận prop `jumpRequest` để mở accordion đích; gán DOM `id={`bible-section-${id}`}`; hỗ trợ chế độ `embedded`.                                                                                                  |
| `[MODIFY]` | [src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts)       |    ~300 dòng    | Gỡ bỏ lệnh `isStoryBibleOpen: false` trong `selectChapter` (dòng 143) và `addChapter` (dòng 166) để bảo toàn trạng thái mở Story Bible của người dùng trong layout hợp nhất.                                                                                                                 |
| `[MODIFY]` | [src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx)         |    ~380 dòng    | Xóa bỏ rendering loại trừ màn hình; quản lý Jump Request `{ section, nonce }` đồng thời gọi `setActiveBibleSection(sec)` để giữ highlight TOC; giữ nguyên trạng thái mở Bible khi append/replace văn bản từ History.                                                                         |
| `[MODIFY]` | [src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx)               |    ~250 dòng    | Thay thế `<select>` bằng default import `ModelSelector` với `expandDown={true}`, `disabled={false}`, gọi `isModelAllowedById`.                                                                                                                                                               |
| `[MODIFY]` | [src/app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx) |    ~275 dòng    | Sửa logic highlight chương `chapter.id === activeChapterId`; kết nối TOC với `onJumpToBibleSection`.                                                                                                                                                                                         |
| `[MODIFY]` | [src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts)             |    ~395 dòng    | Ánh xạ enum `ThinkingLevel` (`SDK_THINKING_LEVEL_MAP`) và `maxOutputTokens` cho Gemini 4 Argon trong `streamGeminiProvider`; fallback OpenRouter và Anthropic truyền `{ signal }` và import `MODEL_IDS`.                                                                                     |
| `[MODIFY]` | [src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts)   |    ~280 dòng    | Thiết lập môi trường test cách ly với `vi.stubEnv` / `afterEach(vi.unstubAllEnvs)`, test riêng biệt nhánh Anthropic có key và nhánh OpenRouter fallback; assert `ThinkingLevel.MEDIUM` cho TC-01.                                                                                            |
| `[MODIFY]` | [src/lib/utils/translations/vi.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [en.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts)   |   ~1100 dòng    | Bổ sung song ngữ cho các key: `novelcrafterCollapseBible`, `novelcrafterExpandBible`, `novelcrafterJumpToBible`.                                                                                                                                                                             |

---

### 6. Các Bước Thực Hiện Tuần Tự (Checklist Chi Tiết)

- [ ] **Bước 1: Nâng Cấp Core Model Registry & Co-Located Tests (Giải quyết MAJOR-2, MINOR-1, MINOR-2)**
  - [ ] 1.1 Tại [src/lib/core/modelRegistry.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts), xây dựng và export hàm thuần client-safe `isModelAllowedById`:

    ```ts
    /**
     * Client-safe model permission check against an allowed model set/list.
     * Matches raw model ID, normalized API model, and coerced stored model bidirectionally.
     * Guards against arbitrary unknown strings accidentally matching DEFAULT_MODEL on the modelId side.
     * Note: on the allowlist side, unknown items coerce to DEFAULT_MODEL matching server-side limits.ts:488-490 behavior.
     */
    export function isModelAllowedById(
      modelId: string,
      allowedModelIds: ReadonlySet<string> | readonly string[] | Set<string>
    ): boolean {
      const raw = String(modelId || "").trim();
      if (!raw) return false;

      const allowedSet =
        allowedModelIds instanceof Set
          ? (allowedModelIds as Set<string>)
          : new Set(allowedModelIds);

      // If allowlist is empty (e.g. while loading or rank has no constraints), permit selection
      if (allowedSet.size === 0) return true;

      // Direct exact match
      if (allowedSet.has(raw)) return true;

      // Check if raw is a known model or alias using Object.hasOwn to prevent prototype pollution
      const isKnown =
        Object.hasOwn(MODEL_ALIASES, raw) || API_ALLOWED.has(raw) || SELECTABLE_SET.has(raw);
      if (!isKnown) return false;

      const normalized = normalizeModelForApi(raw);
      const coerced = coerceStoredModel(raw);

      if (allowedSet.has(normalized) || allowedSet.has(coerced)) return true;

      // Bidirectional expansion check: if allowlist contains an alias/variant of raw
      for (const allowed of allowedSet) {
        if (
          normalizeModelForApi(allowed) === normalized ||
          coerceStoredModel(allowed) === coerced
        ) {
          return true;
        }
      }

      return false;
    }
    ```

  - [ ] 1.2 Mở [src/lib/core/modelRegistry.test.ts](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.test.ts), bổ sung describe block kiểm thử cho `isModelAllowedById` (TC-04):
    - Cho phép `gemini-4-argon` khi allowlist chứa `gemini-4-argon-preview` (trả `true`).
    - Cho phép `gemini-4-argon-preview` khi allowlist chứa `gemini-4-argon` (trả `true`).
    - Cho phép model chuẩn xác khi trùng ID (`claude-sonnet-4.5`) (trả `true`).
    - Trả về `false` khi model cao cấp (`gemini-4-argon`) không nằm trong allowlist chỉ chứa `["gemini-2.5-flash"]`.
    - Trả về `true` khi allowlist rỗng (chế độ open/loading).
    - Trả về `false` với chuỗi không xác định ngẫu nhiên (ví dụ `"unknown-fake-model"`), không bị match nhầm về `DEFAULT_MODEL`.
    - Trả về `false` khi kiểm tra `"toString"` hoặc `"constructor"` (phòng vệ prototype pollution).
    - Khóa hành vi allowlist: `("gemini-2.5-flash", ["some-unknown-id"])` trả về `true` do `coerceStoredModel("some-unknown-id")` fallback về `DEFAULT_MODEL`, đồng bộ với server `limits.ts`.
  - [ ] 1.3 Chạy `npx vitest run src/lib/core/modelRegistry.test.ts` đảm bảo 100% test cases pass.

- [ ] **Bước 2: Nâng Cấp Server Stream Runner Với SDK Enum & Test Harness (Giải quyết MAJOR-A, MINOR-3, MINOR-6)**
  - [ ] 2.1 Mở [src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts):
    - Import enum `{ ThinkingLevel }` từ `@google/genai`.
    - Import `isGemini4Model`, `getModelMaxOutputTokens`, `clampGeminiThinkingLevel`, type `GeminiThinkingLevel` từ `@/lib/core/modelRegistry`.
    - Import `MODEL_IDS` từ `@/lib/utils/constants`.
    - Khai báo bảng ánh xạ kiểu:
      ```ts
      const SDK_THINKING_LEVEL_MAP: Record<GeminiThinkingLevel, ThinkingLevel> = {
        minimal: ThinkingLevel.MINIMAL,
        low: ThinkingLevel.LOW,
        medium: ThinkingLevel.MEDIUM,
        high: ThinkingLevel.HIGH,
      };
      ```
    - Cập nhật hàm `streamGeminiProvider`:

      ```ts
      const maxTokens = getModelMaxOutputTokens(model);
      const clampedLevel = clampGeminiThinkingLevel(model, "medium");
      const thinkingConfig = isGemini4Model(model)
        ? {
            thinkingLevel: SDK_THINKING_LEVEL_MAP[clampedLevel] || ThinkingLevel.MEDIUM,
            includeThoughts: true,
          }
        : undefined;

      const responseStream = await client.models.generateContentStream({
        model,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          abortSignal: signal,
          ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      });
      ```

    - Cập nhật hàm `streamAnthropicProvider`: truyền `{ signal }` làm tham số options thứ hai vào `client.messages.create(body, { signal })` để ngắt kết nối upstream ngay khi client hủy stream.
    - Cập nhật nhánh Anthropic trong `runNovelcrafterStream`:
      - Nếu `process.env.ANTHROPIC_API_KEY`: gọi `streamAnthropicProvider(normalizedModel, systemInstruction, userPrompt, controller, signal)`.
      - Nếu vắng mặt `process.env.ANTHROPIC_API_KEY`: trích xuất `openRouterModel = (CLAUDE_API_MODELS.OPENROUTER as Record<string, string>)[normalizedModel] || CLAUDE_API_MODELS.OPENROUTER[MODEL_IDS.CLAUDE_HAIKU_45] || normalizedModel`.
      - Ghi `streamLogger.info("Falling back Claude to OpenRouter provider")` (tuyệt đối không log credentials hay keys).
      - Gọi `streamOpenAICompatibleProvider("openrouter-pay", openRouterModel, systemInstruction, userPrompt, controller, signal)`.
    - Cập nhật `streamOpenAICompatibleProvider`: truyền `{ signal }` làm tham số request options thứ hai vào `client.chat.completions.create(body, { signal })` để ngắt kết nối upstream ngay khi client hủy stream.

  - [ ] 2.2 Mở [src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts](file:///c:/Users/wyemh/vikini/src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts):
    - Import `ThinkingLevel` từ `@google/genai`.
    - Thêm `afterEach` vào import `vitest` ở dòng 2 và đăng ký: `afterEach(() => { vi.unstubAllEnvs(); });`.
    - Trong test hiện hữu dòng 171 (`maps Claude model IDs via CLAUDE_API_MODELS.ANTHROPIC`): bổ sung `vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");`.
    - Bổ sung test case riêng biệt `TC-01`: Gọi `runNovelcrafterStream` với `model: "gemini-4-argon"`, xác minh `generateContentStreamMock` nhận `config.thinkingConfig` có `thinkingLevel: ThinkingLevel.MEDIUM` và `includeThoughts: true`, cùng `config.maxOutputTokens: 65536`.
    - Bổ sung test case riêng biệt `TC-02`: Gọi `runNovelcrafterStream` với `model: "claude-sonnet-4.5"` khi `vi.stubEnv("ANTHROPIC_API_KEY", "")` (vắng mặt key), mock `openRouterChatCreateMock` trả async generator token. Xác minh:
      - `hoisted.openRouterChatCreateMock` được gọi với model `"anthropic/claude-sonnet-4-6"`.
      - `hoisted.claudeMessagesCreateMock` KHÔNG được gọi.
      - Stream trả về event `token` và `done` thành công mà không ném lỗi missing key.
    - Test case `TC-03`: Giữ nguyên test abort hiện hữu (`test.ts:199-231`) và test Claude native.
  - [ ] 2.3 Chạy `npm run type-check` (xác nhận 0 lỗi kiểu, giải quyết triệt để TS2322) và chạy `npx vitest run src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts` đảm bảo 100% tests pass.

- [ ] **Bước 3: Xây Dựng Hook `useAutoResizeTextarea` Co Giãn 2 Chiều & Đo Mirror-Div Cho Quote (Giải quyết MAJOR-D, MINOR-4)**
  - [ ] 3.1 Tạo file mới `[NEW]` [src/app/features/novelcrafter/hooks/useAutoResizeTextarea.ts](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/hooks/useAutoResizeTextarea.ts):
    - Hook nhận `textareaRef: React.RefObject<HTMLTextAreaElement | null>`, `scrollContainerRef: React.RefObject<HTMLDivElement | null>`, `value: string`, `chapterId: string`, options `{ minHeight?: number }`.
    - Lưu trữ `lastAppliedHeightRef = useRef<number>(0)`.
    - Trong `useLayoutEffect` (với SSR safety guard) phụ thuộc `[value, chapterId]`:

      ```ts
      if (!textareaRef.current) return;
      const el = textareaRef.current;
      const min = options?.minHeight ?? 420;

      // Modern CSS 2026 check: if field-sizing is supported natively, browser handles resizing
      const supportsFieldSizing =
        typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content");
      if (supportsFieldSizing) return;

      // Fallback for browsers without field-sizing:
      const prevScrollTop = scrollContainerRef.current?.scrollTop;
      el.style.height = "auto";
      const nextHeight = Math.max(min, el.scrollHeight);

      if (nextHeight !== lastAppliedHeightRef.current) {
        el.style.height = `${nextHeight}px`;
        lastAppliedHeightRef.current = nextHeight;
      } else {
        el.style.height = `${lastAppliedHeightRef.current}px`;
      }

      if (prevScrollTop !== undefined && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = prevScrollTop;
      }
      ```

    - Cung cấp hàm đo chính xác bằng mirror-div `calculateScrollTopForCharOffset(content, charIndex, textareaElement, scrollContainerElement): number`:
      - Tạo `mirror = document.createElement("div")`.
      - Đặt `mirror.style.position = "absolute"`, `mirror.style.visibility = "hidden"`, `mirror.style.left = "-9999px"`, `mirror.style.width = `${textareaElement.clientWidth}px``, sao chép đầy đủ typography, padding, border, `whiteSpace: "pre-wrap"`, `wordBreak: "break-word"`.
      - Chia text thành `beforeSpan`, `targetSpan`, `afterSpan`, đọc `targetSpan.offsetTop`.
      - Tính toán `textareaOffsetInContainer = textareaElement.getBoundingClientRect().top - scrollContainerElement.getBoundingClientRect().top + scrollContainerElement.scrollTop`.
      - Trả về tọa độ cuộn căn giữa viewport: `Math.max(0, textareaOffsetInContainer + targetSpan.offsetTop - scrollContainerElement.clientHeight / 3)`.
      - **Bọc việc gỡ bỏ node trong khối `finally`**: `finally { if (mirror.parentNode) mirror.parentNode.removeChild(mirror); }`.

  - [ ] 3.2 Tách component `[NEW]` [src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx):
    - Chuyển toàn bộ JSX và state điều khiển của phân cảnh chương (Beats textarea, Extra instructions input, nút Generate Beats, nút Rewrite Beats, nút First Draft) sang component này.
    - Giúp `ChapterEditorWorkspace.tsx` giảm hơn 150 dòng mã.

- [ ] **Bước 4: Tách Thẻ Story Bible Card & Gỡ Bỏ Cơ Chế Cuộn Cũ (Giải quyết MAJOR-C, MINOR-5)**
  - [ ] 4.1 Tạo file mới `[NEW]` [src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx):
    - Quản lý giao diện và tương tác của từng phân khu độc lập: `braindump`, `genre`, `style`, `synopsis`, `characters`, `worldbuilding`, `outline`.
    - Gán thuộc tính `id={`bible-section-${id}`}` trên thẻ cha của từng section để làm anchor định vị chính xác.
    - Nhận callback toggle accordion, render AI controls (generate/rewrite) và input ghi chú.
  - [ ] 4.2 Cập nhật [src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx):
    - **XÓA BỎ HOÀN TOÀN** prop `activeSection` và `useEffect([activeSection])` tại dòng 114-121 (nguyên nhân gây tự trôi màn hình xuống Braindump khi mount).
    - Thay thế bằng prop `jumpRequest: { section: NovelcrafterBibleSectionId; nonce: number } | null`.
    - Lắng nghe `jumpRequest?.nonce`: khi `jumpRequest` có giá trị, tự động mở accordion đích:
      `setOpenSections((prev) => ({ ...prev, [jumpRequest.section]: true }));`.
    - Tái sử dụng `StoryBibleSectionCard` cho 7 phân khu.
    - Bổ sung prop `embedded?: boolean`.
    - Khi `embedded === true`, bỏ wrapper cuộn `overflow-y-auto`, áp dụng `w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto`.
    - Giảm số dòng từ 522 xuống ~240 dòng (dưới ngưỡng 400).

- [ ] **Bước 5: Xây Dựng Component `InlineStoryBibleSection` & Xử Lý Cuộn Nhảy An Toàn (Giải quyết MAJOR-C, MINOR-1, MINOR-4, MINOR-5)**
  - [ ] 5.1 Tạo file mới `[NEW]` [src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx):
    - Nhận props: `isOpen: boolean`, `onClose: () => void`, `jumpRequest: { section: NovelcrafterBibleSectionId; nonce: number } | null`, `storyBible`, `onUpdateStoryBible`, `isStreaming`, `onTriggerStream`.
    - Duy trì `wasOpenRef = useRef(isOpen)` và cờ `isPendingScrollRef = useRef(false)`.
    - Đồng bộ `wasOpenRef`:
      ```ts
      useEffect(() => {
        wasOpenRef.current = isOpen;
      }, [isOpen]);
      ```
    - Bọc trong `AnimatePresence initial={false}` và `motion.section` với `TRANSITION.FAST` (0.15s).
    - Thêm thanh phân cách divider phía trên và tiêu đề phân khu Sudowrite kèm nút thu gọn Story Bible có gán nhãn i18n (`t("novelcrafterCollapseBible")`).
    - Lắng nghe sự thay đổi của `jumpRequest?.nonce`:
      - Khi `jumpRequest === null` (cold-start / initial mount): **tuyệt đối không cuộn**.
      - Khi `jumpRequest` có nonce mới:
        - Hàm cuộn an toàn:
          ```ts
          const scrollToTarget = () => {
            const el = document.getElementById("bible-section-" + jumpRequest.section);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
            isPendingScrollRef.current = false;
          };
          ```
        - Nếu `wasOpenRef.current` là true (Bible đã mở sẵn): gọi `requestAnimationFrame(scrollToTarget)`.
        - Nếu Bible vừa mở từ trạng thái đóng (cần animation mở ra): gán `isPendingScrollRef.current = true`. Trong callback `onAnimationComplete` của `motion.section`, kiểm tra nếu `isPendingScrollRef.current` thì thực thi `scrollToTarget()`.
  - [ ] 5.2 Bổ sung translation keys trong [src/lib/utils/translations/vi.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) và [en.ts](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts):
    - `novelcrafterCollapseBible`: "Thu gọn Hồ sơ tác phẩm" / "Collapse Story Bible"
    - `novelcrafterExpandBible`: "Mở Hồ sơ tác phẩm" / "Expand Story Bible"
    - `novelcrafterJumpToBible`: "Chuyển tới Story Bible" / "Jump to Story Bible"

- [ ] **Bước 6: Tích Hợp Chapter Editor Workspace Full-Width, Key Reset & Interface Props (Giải quyết MAJOR-B, MAJOR-D, MINOR-2, MINOR-3)**
  - [ ] 6.1 Mở [src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx):
    - Cập nhật interface `ChapterEditorWorkspaceProps` đầy đủ:
      ```ts
      interface ChapterEditorWorkspaceProps {
        chapter: NovelcrafterChapter;
        onUpdateChapter: (chapterId: string, patch: Partial<NovelcrafterChapter>) => void;
        onUpdateFeedbackItems: (
          chapterId: string,
          updater: (items: NovelcrafterFeedbackItem[]) => NovelcrafterFeedbackItem[],
          immediate?: boolean
        ) => void;
        selection: EditorSelectionRange | null;
        onSelectionChange: (sel: EditorSelectionRange | null) => void;
        isStreaming: boolean;
        isDirectStreamingToChapter: boolean;
        onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
        onStopStream: () => void;
        // Props hợp nhất Document Canvas & Story Bible:
        isStoryBibleOpen: boolean;
        onToggleStoryBible: (open: boolean) => void;
        storyBible: StoryBible;
        onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
        bibleJumpRequest: { section: NovelcrafterBibleSectionId; nonce: number } | null;
      }
      ```
    - Thay toàn bộ `max-w-[820px]` bằng `w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl` tại tiêu đề chương, Quick Edit bar, Feedback Quote locator button.
    - Tích hợp `ChapterDraftBeatsCard`.
    - Tạo `scrollContainerRef = useRef<HTMLDivElement | null>(null)` gắn vào container cuộn chính `<div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">`.
    - Khi `chapter.id` thay đổi: tự động reset vị trí cuộn lên đầu:
      ```ts
      useEffect(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      }, [chapter.id]);
      ```
    - Trên `textarea`:
      - **Gán `key={chapter.id}`** để React unmount/remount textarea khi chuyển chương, reset hoàn toàn chiều cao DOM về `min-h-[420px]` (loại bỏ triệt để khoảng trắng thừa).
      - **Loại bỏ hoàn toàn class `flex-1`** (tránh flexbox can thiệp đè chiều cao inline).
      - Áp dụng `w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl min-h-[420px] bg-transparent border-0 p-0 text-[16px] md:text-[17px] leading-[1.8] antialiased text-(--text-primary) placeholder:text-(--text-secondary)/70 focus:outline-none resize-none overflow-hidden [field-sizing:content]`.
      - Gọi hook `useAutoResizeTextarea(textareaRef, scrollContainerRef, chapter.content, chapter.id, { minHeight: 420 })`.
    - Trong hàm `jumpToFeedbackQuote`:
      - Gọi `textareaRef.current.setSelectionRange(range.start, range.end)`.
      - Đo vị trí quote chính xác qua `calculateScrollTopForCharOffset(chapter.content, range.start, textareaRef.current, scrollContainerRef.current)`.
      - Cuộn mượt container cha: `scrollContainerRef.current?.scrollTo({ top: targetOffset, behavior: "smooth" });`.
    - Đặt `<InlineStoryBibleSection />` ngay dưới khung textarea.

- [ ] **Bước 7: Cập Nhật Mutators, StudioApp, TopBar & LeftNavigator (Giải quyết MINOR-2, MINOR-5, MINOR-7)**
  - [ ] 7.1 Mở [src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts):
    - Trong hàm `selectChapter` (dòng 139–148): xóa bỏ dòng `isStoryBibleOpen: false`.
    - Trong hàm `addChapter` (dòng 150–173): xóa bỏ dòng `isStoryBibleOpen: false`.
    - Điều này bảo toàn nguyên vẹn trạng thái mở/đóng Story Bible của người dùng khi làm việc giữa các chương.
  - [ ] 7.2 Mở [src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx):
    - Khởi tạo state: `const [bibleJumpRequest, setBibleJumpRequest] = useState<{ section: NovelcrafterBibleSectionId; nonce: number } | null>(null);`.
    - Xóa bỏ điều kiện render loại trừ `{story.storyState.isStoryBibleOpen ? <StoryBibleWorkspace /> : <ChapterEditorWorkspace />}`.
    - Cập nhật callback truyền vào `NovelcrafterLeftNavigator`:
      ```tsx
      onJumpToBibleSection={(sec) => {
        setActiveBibleSection(sec); // BẮT BUỘC GIỮ: highlight TOC và đồng bộ state
        story.setStoryBibleOpen(true);
        setBibleJumpRequest({ section: sec, nonce: Date.now() });
      }}
      ```
    - Luôn render `<ChapterEditorWorkspace />` làm Unified Canvas duy nhất, truyền các props Story Bible và `bibleJumpRequest`.
    - Trong `handleAppendToChapter` và `handleReplaceSelection`: **xóa bỏ dòng `story.setStoryBibleOpen(false)`** để không làm biến mất Story Bible khi người dùng đang mở xem.
    - Truyền `allowedModelIds` và `modelsLoading` xuống `NovelcrafterTopBar`.
  - [ ] 7.3 Mở [src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx):
    - Sử dụng default import: `import ModelSelector from "@/app/features/chat/components/ModelSelector";`.
    - Thay thế thẻ `<select>` bằng:
      ```tsx
      <ModelSelector
        currentModelId={selectedModel}
        onSelectModel={onSelectModel}
        isModelAllowed={(mId) => isModelAllowedById(mId, allowedModelIds)}
        disabled={false}
        expandDown={true}
      />
      ```
  - [ ] 7.4 Mở [src/app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx](file:///c:/Users/wyemh/vikini/src/app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx):
    - Đổi điều kiện highlight chương: `const isSelected = chapter.id === activeChapterId;` (luôn sáng rõ ràng kể cả khi Story Bible mở bên dưới).
    - Nút TOC Story Bible vẫn nhận `isActive = isStoryBibleOpen && activeBibleSection === id` và khi bấm gọi `onJumpToBibleSection(id)`.

- [ ] **Bước 8: Kiểm Thử Toàn Diện, UI Verification & Verification Tier 2**
  - [ ] 8.1 Chạy `npm run type-check` (phải exit 0 không có lỗi kiểu TS2322).
  - [ ] 8.2 Chạy `npm run lint` (phải exit 0).
  - [ ] 8.3 Chạy `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`.
  - [ ] 8.4 Kiểm chứng UI Contract cho TC-05, TC-06, TC-07:
    - **Kiểm chứng tự động/thủ công TC-05 (Full-Width Canvas & Textarea Shrink)**:
      1. Mở `/novelcrafter` ở các viewport 1920px và 2560px, đóng/mở History Pane bên phải. Kiểm tra qua DevTools: không còn class `max-w-[820px]`, khung textarea và beats đạt `max-w-5xl` (1024px) / `max-w-6xl` (1152px) / `max-w-7xl` (1280px) lấp đầy khoảng trống bên phải.
      2. Nhập văn bản dài 3000 từ vào Chương 1 (textarea mở rộng hàng ngàn px). Sau đó tạo Chương 2 mới (hoặc chọn chương ngắn 200 từ): nhờ `key={chapter.id}`, textarea Chương 2 lập tức remount về chiều cao mặc định `min-h-[420px]`, không còn khoảng trắng thừa.
      3. Trong một chương dài, xóa thử một đoạn lớn (undo/cut 2000 từ): textarea co lại ngay lập tức tương ứng với lượng text còn lại.
    - **Kiểm chứng UI TC-06 (No Auto-Scroll on Mount & Re-click TOC)**:
      1. Tải lại trang (F5) với truyện có sẵn Story Bible mở. Xác nhận: Viewport hiển thị tiêu đề và văn bản chương ở trên cùng; vị trí cuộn `scrollTop === 0`.
      2. Bấm mục "Characters" ở thanh điều hướng trái: Story Bible cuộn mượt xuống đưa thẻ `#bible-section-characters` vào khung nhìn.
      3. Cuộn lên đoạn văn xuôi rồi bấm lại mục "Characters": Nhờ nonce mới, viewport tiếp tục cuộn mượt xuống lại chính xác thẻ này.
    - **Kiểm chứng UI TC-07 (Mirror-Div Jump to Quote)**:
      1. Tạo chương 3000 từ. Bấm vào một feedback quote ở gần cuối chương.
      2. Kiểm tra: Dòng trích dẫn được bôi đen và nằm hoàn toàn trong khung nhìn `[scrollTop, scrollTop + clientHeight]` của `scrollContainerRef`.
  - [ ] 8.5 Chạy `npm run verify` kiểm chứng toàn bộ repo.

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID        | Module / Hàm mục tiêu                | Đầu vào (Inputs)                                                                                                                                                                                                                                                                    | Hành vi mong đợi (Outputs)                                                                                                                                                                                                                                      | Trạng thái lỗi & Biên ngoại lệ                                                      | Tiêu chí Pass/Fail                                                                                                                                                                      |
| :-------- | :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01** | `runNovelcrafterStream`              | Request với `model: "gemini-4-argon"`, `feature: "write"`                                                                                                                                                                                                                           | `@google/genai` `generateContentStream` nhận `config.thinkingConfig = { thinkingLevel: ThinkingLevel.MEDIUM, includeThoughts: true }` và `config.maxOutputTokens = 65536`. Emits các event `meta`, `thinking`, `token`, `done`.                                 | Nếu thiếu `thinkingConfig`, Gemini 4 sẽ không thể stream khối suy luận `thinking`.  | **Pass**: Mock `generateContentStream` nhận đúng `thinkingConfig.thinkingLevel === ThinkingLevel.MEDIUM` (`"MEDIUM"`) và `thinkingConfig.includeThoughts === true` mà không lỗi TS2322. |
| **TC-02** | `runNovelcrafterStream`              | Request với `model: "claude-sonnet-4.5"`, môi trường test gọi `vi.stubEnv("ANTHROPIC_API_KEY", "")` (vắng mặt key)                                                                                                                                                                  | Runner tự động fallback sang `getOpenRouterClient().chat.completions.create` với model mapped `anthropic/claude-sonnet-4-6` kèm tùy chọn `{ signal }`. Emits event `token`, `done`.                                                                             | Không được ném ngoại lệ `Anthropic Claude API configuration is missing`.            | **Pass**: Không crash; `openRouterChatCreateMock` được gọi với model `anthropic/claude-sonnet-4-6`; `claudeMessagesCreateMock` KHÔNG được gọi.                                          |
| **TC-03** | `runNovelcrafterStream`              | Request với `model: "claude-sonnet-4.5"`, `vi.stubEnv("ANTHROPIC_API_KEY", "test-key")`                                                                                                                                                                                             | Runner gọi trực tiếp `getClaudeClient().messages.create` với model `claude-sonnet-4-6` kèm `{ signal }`.                                                                                                                                                        | Dọn dẹp với `afterEach(vi.unstubAllEnvs)`.                                          | **Pass**: `claudeMessagesCreateMock` được gọi; output nhận đủ SSE frames.                                                                                                               |
| **TC-04** | `isModelAllowedById` (Pure Function) | 1. `("gemini-4-argon", ["gemini-4-argon-preview"])`<br>2. `("gemini-4-argon-preview", ["gemini-4-argon"])`<br>3. `("gemini-4-argon", ["gemini-2.5-flash"])`<br>4. `("random-fake", ["gemini-2.5-flash"])`<br>5. `("gemini-4-argon", [])`<br>6. `("toString", ["gemini-2.5-flash"])` | 1. Trả về `true`<br>2. Trả về `true`<br>3. Trả về `false`<br>4. Trả về `false`<br>5. Trả về `true` (allowlist rỗng mở cho loading)<br>6. Trả về `false` (chặn prototype pollution).                                                                             | Tránh việc normalize biến chuỗi lạ thành `DEFAULT_MODEL` rồi vô tình trả về `true`. | **Pass**: Cả 6 test cases trong `src/lib/core/modelRegistry.test.ts` khớp chính xác 100%.                                                                                               |
| **TC-05** | `ChapterEditorWorkspace`             | 1. Viewport 1920px / 2560px.<br>2. Nhập 3000 từ rồi chuyển sang chương mới 200 từ.<br>3. Xóa 2000 từ trong chương dài.                                                                                                                                                              | 1. Không còn class `max-w-[820px]`, co giãn tới `max-w-7xl`.<br>2. `key={chapter.id}` remount textarea về `min-h-[420px]`, không có khoảng trắng thừa.<br>3. Textarea co lại vừa vặn nội dung text mới.                                                         | Textarea không có `flex-1` hay thanh cuộn riêng (`overflow-hidden resize-none`).    | **Pass**: Textarea co giãn 2 chiều chính xác; chuyển chương không để lại khoảng trắng; duy nhất container ngoài cuộn.                                                                   |
| **TC-06** | Unified Story Bible Navigation       | 1. Mới vào trang (cold-start mount)<br>2. Click nút `Characters` ở cột trái<br>3. Cuộn lên đoạn văn xuôi rồi click lại nút `Characters` lần 2                                                                                                                                       | 1. Viewport giữ nguyên ở đầu trang chương, KHÔNG tự cuộn xuống Bible (`scrollTop === 0`).<br>2. Bible mở và cuộn mượt xuống phân khu có `id="bible-section-characters"`.<br>3. Nhờ nonce thay đổi, viewport tiếp tục cuộn mượt xuống lại phân khu `characters`. | Animation mở Bible (0.15s) không làm lệch đích cuộn của `scrollIntoView`.           | **Pass**: 1 không cuộn (`scrollTop === 0`); 2 và 3 cuộn mượt chính xác đến thẻ phân khu mục tiêu; highlight trên Left Navigator đồng bộ.                                                |
| **TC-07** | `jumpToFeedbackQuote`                | Bấm thẻ locator của một feedback quote nằm ở dòng thứ 300 trong chương dài 3000 từ                                                                                                                                                                                                  | Textarea bôi đen đoạn quote (`setSelectionRange`), container cha `scrollContainerRef` cuộn mượt đưa dòng quote vào khung nhìn viewport.                                                                                                                         | Quote không bị ẩn khỏi màn hình do textarea đã auto-resize.                         | **Pass**: Vị trí offset của quote nằm trong khoảng `[scrollTop, scrollTop + clientHeight]` của `scrollContainerRef` sau khi cuộn.                                                       |

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

1. **File kiểm thử co-located**:
   - `src/lib/core/modelRegistry.test.ts` (kiểm thử đơn vị thuần hàm `isModelAllowedById`).
   - `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts` (kiểm thử luồng SSE runner với env isolation và enum SDK).
2. **Lệnh thực thi kiểm thử và xác minh chất lượng**:
   - Chạy kiểm tra kiểu: `npm run type-check`
   - Chạy kiểm tra linting: `npm run lint`
   - Chạy bộ test co-located: `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`
   - Cổng nghiệm thu Tier 2 toàn dự án: `npm run verify` (`npm run type-check && npm run lint && npm run test:run`)

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Bao Quát 6 Kịch Bản S1–S6 & Mental Simulation)

| Rủi ro tiềm ẩn                                                       | Mức độ     | Kịch bản đối kháng                 | Technical Control & Phương án phòng ngừa                                                                                                                                                                                                                                                                                                                                                |
| :------------------------------------------------------------------- | :--------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1. Xung đột thanh cuộn lồng nhau & lệch vị trí Quote**            | Trung bình | **S4: State & DOM Flow**           | - Bỏ `flex-1` khỏi textarea, dùng `useAutoResizeTextarea` với `minHeight: 420` có lưu/khôi phục `scrollTop` và CSS `[field-sizing:content]` co giãn 2 chiều.<br>- Gán `key={chapter.id}` trên textarea để reset chiều cao khi chuyển chương.<br>- Trong `jumpToFeedbackQuote`, đo tọa độ thực qua mirror-div và gọi `scrollContainerRef.current.scrollTo({ top, behavior: "smooth" })`. |
| **R2. Tự động trôi màn hình xuống Story Bible khi mở trang**         | Cao        | **S4: Cross-Task State Flow**      | Gỡ bỏ hoàn toàn `useEffect([activeSection])` trong `StoryBibleWorkspace`. Sử dụng cơ chế Jump Request với nonce `{ section, nonce }` khởi tạo là `null`. Chỉ kích hoạt `scrollIntoView` khi người dùng bấm trực tiếp vào mục TOC ở cột trái.                                                                                                                                            |
| **R3. Hỏng test suite Vitest do thiếu biến môi trường Anthropic**    | Cao        | **S2: Lifecycle & S1: Cold-start** | Dùng `vi.stubEnv("ANTHROPIC_API_KEY", "...")` cho các test case Anthropic trực tiếp; dọn dẹp bằng `afterEach(() => vi.unstubAllEnvs())`. Tách bạch test case Claude direct và Claude OpenRouter fallback.                                                                                                                                                                               |
| **R4. Vượt Hard Max kích thước file (> 500 dòng)**                   | Trung bình | **S1: Cold-start & Architecture**  | Tách 4 module nhỏ: `useAutoResizeTextarea.ts` (~75 dòng), `ChapterDraftBeatsCard.tsx` (~110 dòng), `InlineStoryBibleSection.tsx` (~95 dòng), `StoryBibleSectionCard.tsx` (~135 dòng). Giữ cả `ChapterEditorWorkspace` và `StoryBibleWorkspace` dưới 280 dòng.                                                                                                                           |
| **R5. Upstream OpenRouter / Anthropic im lặng khi abort giữa chừng** | Trung bình | **S2: Lifecycle & S6: Resilience** | Truyền `{ signal }` vào options `client.chat.completions.create(body, { signal })` và `client.messages.create(body, { signal })` để ngắt kết nối HTTP upstream ngay lập tức, không chờ chunk tiếp theo.                                                                                                                                                                                 |

#### Adversarial Timelines (4 Trục Đối Kháng Theo evidence-bar.md)

1. **Trục 1: Đồng thời (Concurrent Stream & Bible Navigation)**
   - _T1_: Người dùng bấm "Generate Prose" (bắt đầu stream viết tiếp vào chương qua SSE).
   - _T2_: Đồng thời, người dùng bấm vào mục "Characters" ở Story Bible bên trái.
   - _T3_: Hệ thống mở Story Bible phía dưới và cuộn mượt xuống mà KHÔNG ngắt stream (do `AbortController` của stream tách biệt với state UI của navigation). Text token vẫn tiếp tục chảy vào active chapter prose thông qua RAF buffer (`useNovelcrafterStream`).
   - _Kết cục_: **AN TOÀN**. Cả hai thao tác viết tiếp và xem hồ sơ nhân vật diễn ra trơn tru.

2. **Trục 2: TOCTOU & Model Aliasing**
   - _T1_: User rank `pro` có quyền dùng `gemini-4-argon`.
   - _T2_: Giao diện nhận state với alias `gemini-4-argon-preview`.
   - _T3_: Hàm thuần `isModelAllowedById` mở rộng đối chiếu cả 3 dạng `[raw, normalizeModelForApi, coerceStoredModel]`, khớp thành công với whitelist từ server mà không bị disable oan.
   - _Kết cục_: **AN TOÀN**. Dropdown model hiển thị sẵn sàng cho người dùng.

3. **Trục 3: Thất bại dọn dẹp luồng (Stream Cleanup Failure)**
   - _T1_: Stream đang sinh dở văn bản thì người dùng đột ngột tắt tab hoặc điều hướng khỏi trang.
   - _T2_: `req.signal` nhận tín hiệu abort.
   - _T3_: Vòng lặp `for await (const chunk of responseStream)` nhận diện `signal.aborted` lập tức break; khối `finally` đóng controller stream giải phóng kết nối serverless; upstream client hủy request ngay lập tức nhờ `{ signal }`.
   - _Kết cục_: **AN TOÀN**. Không rò rỉ socket hay giữ luồng LLM chạy ngầm.

4. **Trục 4: Môi trường Serverless (Missing Keys Graceful Fallback)**
   - _T1_: Ứng dụng triển khai trên Vercel/Node.js không có cấu hình `ANTHROPIC_API_KEY`.
   - _T2_: Người dùng chọn mô hình `claude-sonnet-4.5` để viết phân cảnh truyện.
   - _T3_: Runner kiểm tra thấy `!process.env.ANTHROPIC_API_KEY`, tự động điều hướng sang `getOpenRouterClient()` với model `anthropic/claude-sonnet-4-6`.
   - _Kết cục_: **AN TOÀN**. Luồng truyện sinh ra bình thường, người dùng không gặp lỗi sập hệ thống.

---

## Audit History

_(Khu vực dành riêng cho Lead Reviewer ghi nhận xét sau các lượt thẩm định)_

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-15
- **Đối tượng**: Technical Plan — Revision 1 (bản đầu tiên, plan chưa ghi số revision)
- **Kiểm chứng lỗi cũ**: N/A — đây là lượt thẩm định đầu tiên, chưa có Run trước.

#### Lệnh đã chạy (`[CMD]`)

| Lệnh                                                                                         | Exit | Kết quả liên quan                                                                                                                                                                                       |
| :------------------------------------------------------------------------------------------- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run type-check`                                                                         | 0    | Baseline sạch.                                                                                                                                                                                          |
| `npx vitest run src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`       | 0    | 3/3 pass (baseline).                                                                                                                                                                                    |
| Probe tạm (đã xóa): `expect(Boolean(process.env.ANTHROPIC_API_KEY)).toBe(true)` trong vitest | 1    | `AssertionError: expected false to be true` → **trong môi trường vitest, `ANTHROPIC_API_KEY` KHÔNG được set** (`tests/setup.ts:11-16` không khai báo; vitest không nạp `.env.local` vào `process.env`). |
| `wc -l` các component Novelcrafter                                                           | 0    | `ChapterEditorWorkspace.tsx` 468, `StoryBibleWorkspace.tsx` 521, `NovelcrafterStudioApp.tsx` 439, `NovelcrafterTopBar.tsx` 266.                                                                         |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                      | Kết quả           | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :---------------------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**    | PASS              | `[CMD]` type-check exit 0. `[SRC]` `isGemini4Model` tồn tại tại `src/lib/core/modelRegistry.ts:447`; `MODEL_IDS.CLAUDE_HAIKU_45` tại `src/lib/utils/constants.ts:25`; `CLAUDE_API_MODELS.OPENROUTER["claude-sonnet-4.5"] = "anthropic/claude-sonnet-4-6"` tại `constants.ts:44` → kỳ vọng TC-02 khớp. Không thêm dependency, không có Prisma/Better Auth. Lưu ý: runner hiện chỉ import `CLAUDE_API_MODELS` (`novelcrafterStreamRunner.server.ts:18`) — bước 1.3 phải import thêm `MODEL_IDS`. `ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY` đã được dùng sẵn (`chatStreamCore.ts:541`, `claudeClient.ts:20`). |
| **S2: Lifecycle & Teardown**  | **FAIL**          | `[CMD]` probe env ở trên + `[SRC]` test hiện hữu `novelcrafterStreamRunner.server.test.ts:171-197` kỳ vọng `claudeMessagesCreateMock` được gọi. Sau khi thêm nhánh `process.env.ANTHROPIC_API_KEY ? … : OpenRouter`, test này sẽ rẽ sang OpenRouter → **hỏng**. Plan không đề cập sửa test cũ, và bước 2.3 "Tạm thời xóa `process.env.ANTHROPIC_API_KEY`" không có chiến lược khôi phục/isolation → xem `[MAJOR-1]`. Abort path: `[SRC]` `node_modules/openai/core/streaming.js:74-82` — thoát vòng `for await` sẽ `controller.abort()` → cleanup đạt khi có chunk tiếp theo.                             |
| **S3: Database & Temporal**   | PASS (N/A schema) | Không có migration. `[SRC]` `isStoryBibleOpen` được persist trong state (`src/lib/features/novelcrafter/types.ts:236` `z.boolean().default(true)`, `:340`) — không đổi schema, nhưng có hệ quả UI ở S4.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **S4: Cross-Task State Flow** | **FAIL**          | `[SRC]` `StoryBibleWorkspace.tsx:114-121` gọi `scrollIntoView` trong `useEffect([activeSection])` chạy cả khi mount; `NovelcrafterStudioApp.tsx:50-51` mặc định `activeBibleSection = "braindump"`; Bible mặc định mở (`types.ts:340`). Khi nhúng inline trong cùng container cuộn, `scrollIntoView` cuộn **container tổ tiên dùng chung** → xem `[MAJOR-4]`. Auto-resize textarea phá `jumpToFeedbackQuote` (`ChapterEditorWorkspace.tsx:101-112`) → xem `[MAJOR-3]`.                                                                                                                                    |
| **S5: Security Boundary**     | PASS              | `[SRC]` Server vẫn gate model tại `src/app/api/novelcrafter/stream/route.ts:97` (`assertModelAllowedForUser`) với cùng thuật toán mở rộng alias (`src/lib/core/limits.ts:486-492`). `isModelAllowed` phía client chỉ là UX. Fallback OpenRouter chạy SAU gate rank → không bypass quyền.                                                                                                                                                                                                                                                                                                                  |
| **S6: External Resilience**   | PASS (kèm MINOR)  | `[SRC]` Mẫu fallback khớp `chatStreamCore.ts:541-572` (Anthropic khi có key, ngược lại OpenAI-compatible qua OpenRouter). Nếu thiếu cả `OPENROUTER_API_KEY`, `getOpenRouterClient()` ném lỗi → bị `catch` tại `novelcrafterStreamRunner.server.ts:364-374` → phát `event: error` (không crash). `maxDuration = 300` (`stream/route.ts:6`). Xem `[MINOR-3]` về `signal` cho request OpenRouter.                                                                                                                                                                                                            |
| **Domain Inquiry**            | Ghi nhận          | Reasoning truncation: nhánh Gemini của runner không truyền `maxOutputTokens` trong khi chat path có (`gemini-stream.ts:226`) → `[MINOR-1]`. Bilingual: nút thu gọn Bible cần key i18n mới, chưa có trong `en.ts` (chỉ có `novelcrafterStoryBibleTab/Title/Subtitle` tại `en.ts:1012-1019`) → `[MINOR-4]`.                                                                                                                                                                                                                                                                                                 |

#### Adversarial Timelines bổ sung (`[ADV]`)

```
Cơ chế: Auto-scroll Story Bible inline khi mount
T1: User mở /novelcrafter, story có isStoryBibleOpen=true (default, types.ts:340)
T2: ChapterEditorWorkspace render textarea + <StoryBibleWorkspace embedded activeSection="braindump">
T3: useEffect([activeSection]) chạy lần đầu (StoryBibleWorkspace.tsx:114-121) → el.scrollIntoView({behavior:"smooth"})
    cuộn container overflow-y-auto CHUNG (ChapterEditorWorkspace.tsx:222)
Kết cục: Mỗi lần tải trang / tạo truyện mới, viewport tự trượt khỏi văn xuôi xuống Braindump → LỖI (MAJOR)
```

```
Cơ chế: Bấm lại cùng một mục TOC
T1: User bấm "Characters" → setActiveBibleSection("characters") → cuộn xuống Characters
T2: User cuộn lên đoạn văn xuôi để viết tiếp
T3: User bấm lại "Characters" → state không đổi → useEffect không chạy
Kết cục: Không cuộn; TC-06 thất bại ở lần bấm thứ 2 → LỖI (MAJOR)
```

```
Cơ chế: Chạy test Claude hiện hữu sau khi thêm nhánh env
T1: Vitest chạy test "maps Claude model IDs via CLAUDE_API_MODELS.ANTHROPIC" (test.ts:171)
T2: process.env.ANTHROPIC_API_KEY === undefined (đã probe)
T3: Runner rẽ sang streamOpenAICompatibleProvider → openRouterChatCreateMock trả undefined → lỗi → event: error
Kết cục: expect(claudeMessagesCreateMock).toHaveBeenCalledWith(...) FAIL → `npm run verify` đỏ → LỖI (MAJOR)
```

#### Phân loại lỗi

**[MAJOR-1] Thiếu chiến lược env isolation cho test; test hiện hữu sẽ vỡ.**

- `[CMD]` probe xác nhận `ANTHROPIC_API_KEY` không có trong vitest. `[SRC]` `novelcrafterStreamRunner.server.test.ts:171-197`.
- Việc cần làm: (a) thêm `afterEach(() => vi.unstubAllEnvs())`; (b) TC-03 và test Claude hiện có dùng `vi.stubEnv("ANTHROPIC_API_KEY", "test-key")`; (c) TC-02 dùng `vi.stubEnv("ANTHROPIC_API_KEY", "")` thay vì `delete` trực tiếp `process.env`; (d) TC-02 bổ sung assert `claudeMessagesCreateMock` KHÔNG được gọi; (e) ghi rõ việc cập nhật test ở dòng 171 trong Bước 2.

**[MAJOR-2] TC-04 không có nơi kiểm thử; logic so khớp alias bị nhân bản.**

- `[SRC]` Plan đặt `isModelAllowed` trong `useCallback` của `NovelcrafterStudioApp.tsx` → không unit-test được, và bảng Files không có file test nào cho TC-04. Thuật toán trùng lặp với `limits.ts:467-470` / `:488-490`.
- Việc cần làm: tách hàm thuần, client-safe (ví dụ `isModelInAllowList(modelId: string, allowed: Iterable<string>): boolean`) vào `src/lib/core/modelRegistry.ts` (không import server-only), kèm co-located test phủ: alias `gemini-4-argon-preview` ↔ `gemini-4-argon` hai chiều; model premium KHÔNG có trong allowlist → `false`; ID không xác định (bị normalize về `DEFAULT_MODEL` theo `modelRegistry.ts:415-416`) không được khớp nhầm khi allowlist chứa `DEFAULT_MODEL`. Component chỉ gọi lại hàm này.

**[MAJOR-3] Control cho rủi ro R1 (mức Trung bình) chưa được đặc tả/kiểm chứng; auto-resize gây hồi quy nhảy-tới-quote.**

- Theo `evidence-bar.md` 4.5.4, rủi ro Trung bình phải ánh xạ tới control đã xác minh. Bước 3.2 vẫn giữ `flex-1` trên textarea (`flex: 1 1 0%` → `height` inline không được dùng làm flex-basis) và `custom-scrollbar`; bước 3.3 không nêu cách hiện thực (hook nào, đo lúc nào, overflow ra sao).
- `[SRC]` `jumpToFeedbackQuote` (`ChapterEditorWorkspace.tsx:101-112`) chỉ `focus()` + `setSelectionRange()`, dựa vào cuộn nội bộ của textarea. Sau auto-resize, textarea không còn tự cuộn → với chương dài, đoạn quote được chọn nằm ngoài viewport.
- Việc cần làm: đặc tả hook (ví dụ `useAutoResizeTextarea` trong `src/app/features/novelcrafter/hooks/`, `useLayoutEffect` theo `chapter.content`: đặt `height="auto"` rồi `height=scrollHeight`), bỏ `flex-1`/`custom-scrollbar`, đặt `overflow-hidden` cho textarea; bổ sung cơ chế cuộn container ngoài tới vị trí quote (tính offset dòng/caret); thêm bước verification thủ công/E2E cho cả hai hành vi.

**[MAJOR-4] Hành vi cuộn của Story Bible inline sai về state (S4).**

- `[SRC]`/`[ADV]` như hai timeline đầu: (a) tự cuộn khi mount do `isStoryBibleOpen` mặc định `true` + `activeSection` mặc định `"braindump"`; (b) bấm lại cùng mục không cuộn; (c) R4 nêu `setTimeout 50ms` nhưng animation mở là `TRANSITION.FAST` = 0.15s (`src/lib/utils/motion.ts:5,21`) chuyển `height: 0 → auto` → cuộn giữa lúc chiều cao đang đổi sẽ lệch đích; và bước 4.3 không hề đưa cơ chế trễ này vào checklist.
- Việc cần làm: thay `activeSection` bằng "jump request" có nonce (ví dụ `{ section, requestId }`) chỉ phát khi người dùng bấm TOC; effect phụ thuộc `requestId`, KHÔNG cuộn ở lần mount ban đầu; thực hiện cuộn sau khi animation xong (`onAnimationComplete` của `motion.section`, hoặc `requestAnimationFrame` nếu Bible đã mở sẵn). Mở rộng TC-06 gồm case bấm lại cùng mục và case tải trang không tự cuộn.

**[MAJOR-5] Vượt Hard Max kích thước file, plan không có chiến lược tách.**

- `[CMD]` `wc -l` ở trên: `StoryBibleWorkspace.tsx` 521 dòng đã vượt Hard Max 500 cho UI Component (`01-coding.md`); `ChapterEditorWorkspace.tsx` 468 dòng sẽ nhận thêm props, khối `AnimatePresence`, auto-resize, logic cuộn quote → chắc chắn vượt 500.
- Việc cần làm: bổ sung vào bảng Files các file `[NEW]` được tách, ví dụ `InlineStoryBibleSection.tsx` (khối `motion.section` + nút đóng), hook `useAutoResizeTextarea.ts`, và tách header/section của `StoryBibleWorkspace`; ghi số dòng dự kiến sau thay đổi.

**[MINOR-1]** Bước 1.2 khai báo `config: Record<string, unknown>` → mất kiểm tra kiểu của SDK. Nên dùng type `GenerateContentConfig` của `@google/genai` (đã cài v2.10.0) và tái sử dụng `clampGeminiThinkingLevel(model, "medium")` cho đồng nhất với `gemini-stream.ts:164-173`; cân nhắc truyền `maxOutputTokens: getModelMaxOutputTokens(model)` như chat path để tránh reasoning chiếm hết budget output.

**[MINOR-2]** R2 khẳng định "Gemini 4 bị lỗi API do thiếu thinking config" nhưng chưa có bằng chứng; `modelRegistry.ts:446` mô tả thinking của Gemini 4 là always-on. Tác dụng thực của thay đổi là `includeThoughts: true` để stream sự kiện `thinking`. Nên diễn đạt lại nguyên nhân gốc (lỗi chính là UI disable oan do `allowedModelIds.has(m.id)` tại `NovelcrafterTopBar.tsx:171` không xét alias).

**[MINOR-3]** Nhánh fallback OpenRouter nên truyền request option `{ signal }` cho `client.chat.completions.create(...)` để hủy upstream ngay cả khi upstream đang im lặng (đang suy luận) — hiện chỉ abort khi có chunk tiếp theo (`openai/core/streaming.js:74-82`). Log info khi fallback không được chứa giá trị key.

**[MINOR-4]** Nút thu gọn Story Bible cần key i18n mới; bổ sung `src/lib/utils/translations/en.ts` và `vi.ts` vào bảng Files theo `.agents/rules/04-bilingual.md`.

**[MINOR-5]** Mô tả không nhất quán: Mục tiêu 2 nói "7 phân khu" nhưng chỉ liệt kê 6 (gộp "Genre & Style"), trong khi `NovelcrafterLeftNavigator.tsx:54-60` có 7 id (`genre`, `style` tách riêng). TC-06 nói cuộn tới `#characters` nhưng `StoryBibleWorkspace` dùng `sectionRefs`, không có DOM `id` → sửa tiêu chí Pass cho khớp.

**[MINOR-6]** `handleAppendToChapter`/`handleReplaceSelection` gọi `story.setStoryBibleOpen(false)` (`NovelcrafterStudioApp.tsx:254, 267`). Trong canvas hợp nhất, việc này sẽ thu gọn Bible (và persist trạng thái) mỗi lần chèn văn bản từ History — cần quyết định giữ hay bỏ và ghi rõ trong plan.

**[MINOR-7]** `ModelSelector` là default export (`ModelSelector.tsx:63`) → phải dùng `import ModelSelector from "@/app/features/chat/components/ModelSelector"`. Import chéo từ feature `chat` đã có tiền lệ (`useAllowedModels`, `useLanguage`) nên chấp nhận được.

#### Kết luận

**[CHANGES_REQUESTED]** — còn 5 lỗi `[MAJOR]` (MAJOR-1 → MAJOR-5). Antigravity cần cập nhật `## Technical Plan` (ghi số Revision mới) để xử lý toàn bộ MAJOR, khuyến nghị xử lý luôn các MINOR, rồi gửi thẩm định Audit Run 2.

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-15
- **Đối tượng**: Technical Plan — Revision 2 (Addressing Audit Run 1)

#### Kiểm chứng lỗi cũ (so với Audit Run 1)

| Lỗi Run 1                                                   | Trạng thái                     | Ghi chú                                                                                                                                                                                                                                |
| :---------------------------------------------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-1 (env isolation test)                                | ✅ Đã khắc phục                | Bước 2.2 có `afterEach(vi.unstubAllEnvs)`, stub key cho test dòng 171, TC-02 dùng `vi.stubEnv("ANTHROPIC_API_KEY", "")` + assert `claudeMessagesCreateMock` không được gọi. `vi.stubEnv` với chuỗi rỗng → falsy → đúng nhánh fallback. |
| MAJOR-2 (TC-04 không test được)                             | ✅ Đã khắc phục                | `isModelAllowedById` là hàm thuần trong `modelRegistry.ts` + co-located test. Probe `[CMD]` bên dưới: cả 5 case TC-04 cho đúng kết quả mong đợi.                                                                                       |
| MAJOR-3 (auto-resize / jump-to-quote)                       | ⚠️ Khắc phục một phần          | Đã đặc tả hook, bỏ `flex-1`, `overflow-hidden`, cuộn container ngoài. Còn lỗi trong chính control và chưa có bước verification UI → xem `[MAJOR-B]`.                                                                                   |
| MAJOR-4 (cuộn Bible inline sai state)                       | ⚠️ Khắc phục một phần          | Đã có Jump Request + nonce, nhưng plan KHÔNG gỡ `useEffect([activeSection])` cũ trong `StoryBibleWorkspace` → lỗi tự cuộn khi mount vẫn còn → xem `[MAJOR-C]`.                                                                         |
| MAJOR-5 (file size)                                         | ✅ Đã khắc phục                | Đã tách 4 file `[NEW]` và ghi số dòng dự kiến.                                                                                                                                                                                         |
| MINOR-1 (`GenerateContentConfig`, clamp, `maxOutputTokens`) | ⚠️ Áp dụng nhưng sinh lỗi kiểu | Snippet mới không qua `tsc` → xem `[MAJOR-A]`.                                                                                                                                                                                         |
| MINOR-2 → MINOR-7                                           | ✅ Đã khắc phục                | Diễn đạt lại nguyên nhân; `{ signal }` cho OpenRouter; i18n keys; 7 phân khu + DOM id `bible-section-*`; bỏ `setStoryBibleOpen(false)`; default import `ModelSelector`.                                                                |

#### Lệnh đã chạy (`[CMD]`)

| Lệnh                                                                                                                                                                                                                                        | Exit                          | Kết quả liên quan                                                                                                                                                                                                              |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run type-check`                                                                                                                                                                                                                        | 0                             | Baseline sạch.                                                                                                                                                                                                                 |
| `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`                                                                                                                   | 0                             | 2 files, 20/20 pass (baseline).                                                                                                                                                                                                |
| Probe tạm (đã xóa) `src/__probe_thinking__.ts` chứa nguyên snippet Bước 2.1 (`const config: GenerateContentConfig`; `config.thinkingConfig = { thinkingLevel: clampGeminiThinkingLevel(...), includeThoughts: true }`) + `npx tsc --noEmit` | 2                             | `error TS2322: Type 'GeminiThinkingLevel' is not assignable to type 'ThinkingLevel \| undefined'.`                                                                                                                             |
| Probe vitest tạm (đã xóa) `src/lib/core/__probe_allow__.test.ts` tái hiện thuật toán `isModelAllowedById` của plan trên registry thật                                                                                                       | 1 (assert cố ý để in kết quả) | `{"c1":true,"c2":true,"c3":false,"c4":false,"c5":true,"x1":true,"x2":true,"x3":true,"toString":true}` — c1..c5 khớp TC-04; `x2`: `("gemini-2.5-flash", ["some-unknown-id"])` → `true`; `"toString" in MODEL_ALIASES` → `true`. |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                      | Kết quả          | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :---------------------------- | :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**    | **FAIL**         | `[CMD]` probe TS2322 ở trên. `[SRC]` `node_modules/@google/genai/dist/genai.d.ts:12172-12205`: `ThinkingConfig.thinkingLevel?: ThinkingLevel` là **string enum** (`MEDIUM = "MEDIUM"`), không nhận literal `"medium"`. Chat path né lỗi này bằng object không annotate `GenerateContentConfig` (`src/app/api/chat-stream/streaming/gemini-stream.ts:158-173, 227-230`). Các symbol còn lại tồn tại: `getModelMaxOutputTokens` (`modelRegistry.ts:439`; argon = 65536 tại `:105` → khớp TC-01), `clampGeminiThinkingLevel` (`:490`), `MODEL_ALIASES` export (`:350`), `API_ALLOWED`/`SELECTABLE_SET` module-local (`:299-302`) dùng được trong cùng file. Không có dependency mới, không Prisma/Better Auth. |
| **S2: Lifecycle & Teardown**  | PASS             | `[SRC]` Test harness đã hoisted sẵn `openRouterChatCreateMock` (`novelcrafterStreamRunner.server.test.ts:4-36`) → TC-02 hiện thực được; cần thêm `afterEach` vào import dòng 2. `streamOpenAICompatibleProvider` với model `anthropic/claude-sonnet-4-6` + providerId `openrouter-pay` → `isDeepSeekDirectModel` false → `getOpenRouterClient()` (`runner.server.ts:222-226`) đúng. `{ signal }` request option đóng khe hở upstream im lặng.                                                                                                                                                                                                                                                               |
| **S3: Database & Temporal**   | PASS (N/A)       | Không migration/schema. `isStoryBibleOpen` persist sẵn (`types.ts:340`); `chapters` `.min(1)` (`types.ts:239`) → `ChapterEditorWorkspace` luôn có chapter để gắn Bible inline, không có case "0 chương mất Bible".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **S4: Cross-Task State Flow** | **FAIL**         | `[SRC]` `StoryBibleWorkspace.tsx:114-121` vẫn `scrollIntoView` trong `useEffect([activeSection])` chạy khi mount; `NovelcrafterStudioApp.tsx:50-51` mặc định `"braindump"`, truyền vào `:391`. Plan (Bước 4.2, 7.1) không gỡ effect/prop này → `[MAJOR-C]`. Auto-resize `height="auto"` làm co scroll container → `[MAJOR-B]`.                                                                                                                                                                                                                                                                                                                                                                              |
| **S5: Security Boundary**     | PASS             | `[SRC]` Server vẫn gate qua `assertModelAllowedForUser` (`limits.ts:479-495`) với cùng thuật toán mở rộng `[m, normalize(m), coerce(m)]`; client check chỉ là UX. `useAllowedModels` fail-closed về `{DEFAULT_MODEL}` khi lỗi (`useAllowedModels.ts:36-41`); Set rỗng chỉ xảy ra khi loading/unauthed → nhánh `size === 0 → true` đồng nhất với `useModelSelection.ts:59-60` và TopBar hiện tại (`NovelcrafterTopBar.tsx:171`). Fallback OpenRouter chạy sau gate rank.                                                                                                                                                                                                                                     |
| **S6: External Resilience**   | PASS (kèm MINOR) | `[SRC]` Thiếu cả hai key → `getOpenRouterClient()` ném → bắt tại `runner.server.ts:364-374` → `event: error`. Log fallback không chứa key. `streamAnthropicProvider` vẫn không truyền `{ signal }` vào `messages.create` (`:191-197`) → `[MINOR-6]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Domain Inquiry**            | Ghi nhận         | Reasoning truncation: `maxOutputTokens` = 65536 cho Argon — đạt. Bilingual: xem `[MINOR-5]`. Registry: toán tử `in` đi qua prototype → `[MINOR-1]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### Adversarial Timelines bổ sung (`[ADV]`)

```
Cơ chế: Auto-scroll Bible khi mount (lỗi Run 1 vẫn còn)
T1: User mở /novelcrafter, isStoryBibleOpen=true (default types.ts:340)
T2: Unified canvas render ChapterEditorWorkspace → InlineStoryBibleSection → StoryBibleWorkspace embedded.
    Bước 7.1 không xóa activeBibleSection, Bước 4.2 không gỡ useEffect([activeSection]).
T3: StoryBibleWorkspace.tsx:114-121 chạy lần đầu → scrollIntoView("braindump") cuộn scroll container CHUNG
Kết cục: Viewport trượt khỏi văn xuôi ngay khi tải trang; jumpRequest=null không ngăn được → LỖI (MAJOR), TC-06 case 1 FAIL
```

```
Cơ chế: Highlight TOC & mở accordion đích sau khi đổi sang Jump Request
T1: Bước 7.3 thay callback onJumpToBibleSection bằng { setStoryBibleOpen(true); setBibleJumpRequest(...) } — bỏ setActiveBibleSection
T2: NovelcrafterLeftNavigator.tsx:252 vẫn tính isActive = isStoryBibleOpen && activeBibleSection === id
T3: activeBibleSection kẹt ở "braindump"; đồng thời setOpenSections(...[section]: true) (StoryBibleWorkspace.tsx:116) không còn được kích hoạt
Kết cục: TOC luôn highlight "Braindump"; nếu thẻ "Characters" đang thu gọn, cuộn tới header thẻ thu gọn → LỖI (MAJOR)
```

```
Cơ chế: useAutoResizeTextarea đo chiều cao bằng height="auto"
T1: Chương 3000 từ (textarea ~5000px), Bible đang thu gọn; user cuộn xuống cuối và gõ tiếp (hoặc RAF stream đổ token vào cuối chương)
T2: Mỗi lần content đổi, hook set el.style.height="auto" → textarea co về min-h 420px → scrollHeight của container giảm ~4500px
T3: Trình duyệt clamp scrollContainer.scrollTop về max mới; sau đó height=scrollHeight khôi phục chiều cao nhưng scrollTop KHÔNG được khôi phục
Kết cục: Viewport giật lên trên mỗi phím gõ / mỗi frame stream → LỖI (MAJOR)
```

```
Cơ chế: calculateScrollTopForCharOffset "ước lượng theo dòng"
T1: Văn xuôi: mỗi đoạn là 1 dòng logic dài 600–1200 ký tự, textarea rộng max-w-7xl → soft-wrap 5–10 dòng hiển thị
T2: Đếm "\n" trước charIndex × line-height → thiếu toàn bộ dòng soft-wrap
T3: scrollTo(top) dừng sớm hàng nghìn px so với quote
Kết cục: TC-07 "Pass: scrollTop thay đổi" vẫn PASS dù quote nằm ngoài viewport — tiêu chí tautological → LỖI (MAJOR)
```

#### Phân loại lỗi

**[MAJOR-A] Snippet `thinkingConfig` Bước 2.1 không qua type-check.**

- `[CMD]` TS2322 như trên; `[SRC]` `genai.d.ts:12179,12185-12205`.
- Rủi ro: executor bị đẩy tới `as any`/cast mù để vượt Tier 1 (vi phạm `01-coding.md`).
- Việc cần làm: theo đúng mẫu `gemini-stream.ts:158-173` — khai báo `thinkingConfig` cục bộ kiểu `{ thinkingLevel?: GeminiThinkingLevel; includeThoughts?: boolean }` và truyền inline vào `config` (không annotate `GenerateContentConfig`), HOẶC ánh xạ tường minh sang enum `ThinkingLevel.MEDIUM` của SDK. Ghi rõ lựa chọn vào Bước 2.1 và cho TC-01 assert đúng giá trị thực gửi đi.

**[MAJOR-B] Control của R1 còn lỗi và các Test Contract UI không có phương tiện kiểm chứng.**

- `[ADV]` timeline 3 và 4 ở trên.
- Việc cần làm:
  1. Trong `useAutoResizeTextarea`, nhận thêm ref của scroll container và lưu/khôi phục `scrollTop` quanh bước `height="auto"` → `height=scrollHeight`; chỉ ghi `height` khi giá trị thay đổi để tránh reflow thừa mỗi frame stream.
  2. Thay "đếm dòng" bằng phép đo thực: mirror-div (sao chép font/padding/width/`white-space: pre-wrap` của textarea, chèn `<span>` tại `charIndex`, đọc `offsetTop`) cộng `textarea.offsetTop` tương đối với scroll container.
  3. Sửa tiêu chí TC-07: phần tử quote phải nằm trong `[scrollTop, scrollTop + clientHeight]` của container sau khi cuộn.
  4. Thêm vào Bước 8 phương tiện chạy TC-05/06/07: spec Playwright (`npm run test:e2e`; `@playwright/test ^1.62.1` đã có, thư mục `tests/e2e/`) hoặc checklist kiểm thử thủ công ghi rõ viewport/steps/kết quả. Hiện Bước 8 chỉ chạy unit test → 3 TC UI không được thực thi.

**[MAJOR-C] Gỡ bỏ cơ chế cuộn cũ của `StoryBibleWorkspace` chưa được đặc tả (MAJOR-4 Run 1 còn tồn đọng).**

- `[SRC]` `StoryBibleWorkspace.tsx:35,81,114-121`; `NovelcrafterStudioApp.tsx:50-51,373-377,391`; `NovelcrafterLeftNavigator.tsx:252`. `[ADV]` timeline 1 và 2.
- Việc cần làm (ghi vào Bước 4.2 / 5.1 / 7.1 / 7.3):
  1. Xóa prop `activeSection` và `useEffect` cuộn tại `StoryBibleWorkspace.tsx:114-121`; thay bằng prop `jumpRequest` để mở accordion đích (`setOpenSections`) khi nonce đổi.
  2. Giữ `activeBibleSection` CHỈ cho highlight TOC; callback mới phải gọi cả `setActiveBibleSection(sec)` lẫn `setBibleJumpRequest({ section: sec, nonce })`.
  3. Thứ tự trong `InlineStoryBibleSection`: mở accordion đích → chờ animation (Bible + card) → `scrollIntoView`.

**[MINOR-1]** `raw in MODEL_ALIASES` đi qua prototype (`[CMD]` probe: `"toString" in MODEL_ALIASES === true`) → `isKnown` sai cho `"toString"`, `"constructor"`… Dùng `Object.hasOwn(MODEL_ALIASES, raw)`.

**[MINOR-2]** Docstring "Guards against arbitrary unknown strings accidentally matching DEFAULT_MODEL" chỉ đúng phía `modelId`. Phía allowlist, mọi entry lạ/không selectable đều `coerceStoredModel` → `DEFAULT_MODEL` (`[CMD]` probe `x1`, `x2` = `true`). Hành vi này trùng khớp server (`limits.ts:488-490`) nên chấp nhận được — chỉ cần sửa docstring và thêm 1 test khóa hành vi này cho tường minh.

**[MINOR-3]** TC-03 không thống nhất: Bước 2.2 mô tả TC-03 là test abort, bảng Test Contract mô tả TC-03 là Anthropic có key. Test abort đã có sẵn (`test.ts:199-231`). Đồng bộ lại ID; nhớ thêm `afterEach` vào import `vitest` (`test.ts:2`).

**[MINOR-4]** `InlineStoryBibleSection`: không thể phân biệt "đã mở sẵn" vs "vừa mở" bằng `isOpen` tại thời điểm effect (`setStoryBibleOpen(true)` và `setBibleJumpRequest` được batch cùng render). Cần ref `wasOpenRef`/cờ `animationDone`; đặt `AnimatePresence initial={false}` để không animate lúc cold-start.

**[MINOR-5]** Key `novelcrafterJumpToBible` có trong bảng Files nhưng thiếu trong Bước 5.2; `novelcrafterExpandBible` chưa có điểm sử dụng. Đồng bộ danh sách key và vị trí dùng.

**[MINOR-6]** Song song với R5: `streamAnthropicProvider` nên truyền `{ signal }` làm request option cho `client.messages.create(...)` (`runner.server.ts:191-197`) để hủy upstream Anthropic khi đang im lặng suy luận.

**[MINOR-7]** Bước 7.3 đặt snippet `onJumpToBibleSection` dưới mục `NovelcrafterLeftNavigator.tsx`, nhưng callback thực tế nằm trong `NovelcrafterStudioApp.tsx:374-377` (nơi có `story` và `setBibleJumpRequest`). Chuyển sang Bước 7.1.

#### Kết luận

**[CHANGES_REQUESTED]** — Revision 2 đã xử lý tốt MAJOR-1, MAJOR-2, MAJOR-5 và phần lớn MINOR của Run 1, nhưng còn 3 lỗi `[MAJOR]`:

1. `[MAJOR-A]` sửa snippet `thinkingConfig` cho qua `tsc` (không dùng `any`/cast mù).
2. `[MAJOR-B]` khôi phục `scrollTop` trong auto-resize, đo vị trí quote bằng mirror-div, sửa tiêu chí TC-07, thêm phương tiện thực thi (Playwright hoặc checklist thủ công) cho TC-05/06/07.
3. `[MAJOR-C]` gỡ `useEffect([activeSection])` của `StoryBibleWorkspace`, giữ `activeBibleSection` cho highlight, mở accordion đích trước khi cuộn.

Antigravity cần cập nhật `## Technical Plan` lên Revision 3, khuyến nghị xử lý luôn MINOR-1 → MINOR-7, rồi gửi thẩm định Audit Run 3.

### Audit Run 3

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-15
- **Đối tượng**: Technical Plan — Revision 3 (Addressing Audit Run 2)

#### Kiểm chứng lỗi cũ (so với Audit Run 2)

| Lỗi Run 2                                                 | Trạng thái            | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :-------------------------------------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-A (TS2322 `thinkingConfig`)                         | ❌ **Chưa khắc phục** | Bỏ annotation `GenerateContentConfig` và truyền inline **vẫn** lỗi TS2322 (probe `[CMD]` bên dưới). Lập luận "khớp `gemini-stream.ts:158-173`" không đúng: chat path qua được `tsc` chỉ vì `ai` có kiểu cấu trúc tự định nghĩa (`src/app/api/chat-stream/streaming/types.ts:113-118`) và được cast tại `chatStreamCore.ts:577` (`ai as unknown as ChatStreamParams["ai"]`). Runner Novelcrafter gọi `GoogleGenAI` thật (`genaiClient.ts:48`). → `[MAJOR-A]` vẫn còn. |
| MAJOR-B (auto-resize / jump-to-quote / verification UI)   | ⚠️ Khắc phục một phần | ✅ Lưu/khôi phục `scrollTop`; ✅ mirror-div; ✅ tiêu chí TC-07 `[scrollTop, scrollTop + clientHeight]`; ✅ checklist thủ công TC-05/06/07 ở Bước 8.4. Nhưng điều kiện chạy resize mới thêm vào khiến textarea **không bao giờ co lại** ở nhánh JS fallback → `[MAJOR-D]`.                                                                                                                                                                                            |
| MAJOR-C (gỡ cơ chế cuộn cũ của `StoryBibleWorkspace`)     | ✅ Đã khắc phục       | Bước 4.2 xóa `activeSection` + `useEffect` tại `StoryBibleWorkspace.tsx:114-121`; Bước 7.1 giữ `setActiveBibleSection(sec)`; Bước 5.1 cuộn sau `onAnimationComplete`/RAF. `[SRC]` Thẻ section không animate (render điều kiện `openSections[sec.id] && …`, `StoryBibleWorkspace.tsx:333,354,437,463`) → mở thẻ đích không làm lệch `block: "start"`.                                                                                                                 |
| MINOR-1 (`Object.hasOwn`)                                 | ✅                    | `[CMD]` snippet `isModelAllowedById` qua `tsc` (lib `esnext`, `tsconfig.json:3`).                                                                                                                                                                                                                                                                                                                                                                                    |
| MINOR-2 (docstring + test khóa hành vi allowlist)         | ✅                    | Docstring đã sửa; Bước 1.2 có case `("gemini-2.5-flash", ["some-unknown-id"])`.                                                                                                                                                                                                                                                                                                                                                                                      |
| MINOR-3 (đồng bộ ID TC-03, `afterEach` import)            | ✅                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| MINOR-4 (`wasOpenRef`, `AnimatePresence initial={false}`) | ⚠️ Một phần           | Đã có, nhưng thời điểm đồng bộ `wasOpenRef` chưa đúng → `[MINOR-1]` bên dưới.                                                                                                                                                                                                                                                                                                                                                                                        |
| MINOR-5 (i18n keys)                                       | ✅                    | 3 key đã đồng bộ giữa bảng Files và Bước 5.2.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| MINOR-6 (`{ signal }` cho Anthropic)                      | ✅                    | `[SRC]` `node_modules/@anthropic-ai/sdk/internal/request-options.d.ts:56` và `node_modules/openai/internal/request-options.d.ts:56` đều có `signal?: AbortSignal`.                                                                                                                                                                                                                                                                                                   |
| MINOR-7 (vị trí callback `onJumpToBibleSection`)          | ✅                    | Đã chuyển sang Bước 7.1.                                                                                                                                                                                                                                                                                                                                                                                                                                             |

#### Lệnh đã chạy (`[CMD]`)

| Lệnh                                                                                                                                                                                                                                                                                     | Exit | Kết quả liên quan                                                                                                                                                                                                                                                                               |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Probe tạm (đã xóa) `src/__probe_r3__/probe.ts` chứa **nguyên văn** snippet Bước 2.1 (inline `thinkingConfig`, `client = getGenAIClient()`) + snippet `isModelAllowedById` Bước 1.1 + biểu thức `openRouterModel` Bước 2.1; `npx tsc --noEmit -p tsconfig.json`                           | 2    | `probe.ts(22,5): error TS2322: … Types of property 'thinkingConfig' are incompatible … Type '"medium"' is not assignable to type 'ThinkingLevel \| undefined'. Did you mean 'ThinkingLevel.MEDIUM'?` — lỗi duy nhất; `isModelAllowedById` và `openRouterModel` sạch.                            |
| Probe tạm (đã xóa) thay `thinkingLevel` bằng bảng ánh xạ `{ minimal: ThinkingLevel.MINIMAL, low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH }[clampGeminiThinkingLevel(model, "medium")]` (import `ThinkingLevel` từ `@google/genai`); `npx tsc --noEmit` | 0    | Phương án sửa hợp lệ, không cần cast. `[SRC]` enum tại `node_modules/@google/genai/dist/genai.d.ts:12185-12206` (`MEDIUM = "MEDIUM"`).                                                                                                                                                          |
| Probe Playwright Chromium (script tạm ngoài repo) chạy **nguyên văn** thân hook Bước 3.1 trên textarea 600px trong scroll container 600px, CÓ `field-sizing: content`                                                                                                                    | 0    | `{"grow":"skipped",…,"shrink":"skipped"}` — Chromium tự co giãn bằng `field-sizing`, hook không làm gì (đúng).                                                                                                                                                                                  |
| Cùng probe, **KHÔNG** có `field-sizing` (mô phỏng trình duyệt chưa hỗ trợ → đi nhánh JS fallback)                                                                                                                                                                                        | 0    | `{"grow":"resized","hAfterGrow":"19208px",…,"shrinkSH":19208,"shrinkCH":19208,"shrink":"skipped","hAfterShrink":"19208px"}` — sau khi nội dung chỉ còn `"short"`, `scrollHeight === clientHeight` nên điều kiện `scrollHeight < clientHeight - 40` không bao giờ đúng → textarea kẹt ở 19208px. |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                      | Kết quả    | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :---------------------------- | :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**    | **FAIL**   | `[CMD]` TS2322 ở trên → Bước 2.3 / 8.1 (`npm run type-check` exit 0) không đạt được theo snippet hiện tại. Các phần còn lại sạch: `MODEL_IDS.CLAUDE_HAIKU_45` (`constants.ts:25`), `CLAUDE_API_MODELS.OPENROUTER` (`constants.ts:43-45`), `ModelSelector` default export với đúng props `currentModelId/onSelectModel/isModelAllowed/disabled/expandDown` (`ModelSelector.tsx:53-63`), thư mục `src/app/features/novelcrafter/hooks/` đã tồn tại. Không thêm dependency; không Prisma/Better Auth.                                                                                                                            |
| **S2: Lifecycle & Teardown**  | PASS       | `[SRC]` Test harness mock ở mức `@/lib/core/genaiClient` (`novelcrafterStreamRunner.server.test.ts:12-18`), KHÔNG mock `@google/genai` → import enum `ThinkingLevel` vẫn dùng được trong test. `afterEach(vi.unstubAllEnvs)` + `vi.stubEnv` cho cả hai nhánh Claude; TC-02 assert `claudeMessagesCreateMock` không được gọi → không tautological. `{ signal }` truyền vào cả `messages.create` và `chat.completions.create` (SDK hỗ trợ, `[SRC]` ở trên). Runner đã tách `thought` part thành sự kiện `thinking` (`novelcrafterStreamRunner.server.ts:157-168`) → `includeThoughts: true` không làm rò suy luận vào văn xuôi. |
| **S3: Database & Temporal**   | PASS (N/A) | Không có migration/schema. `isStoryBibleOpen` persist sẵn (`types.ts:340`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **S4: Cross-Task State Flow** | **FAIL**   | `[CMD]` probe Playwright: nhánh fallback không co lại → `[MAJOR-D]`. `[SRC]` textarea không có `key` theo chương (`ChapterEditorWorkspace.tsx:396-413`) → khi chuyển từ chương dài sang chương ngắn, cùng phần tử DOM giữ chiều cao cũ. `[SRC]` `selectChapter`/`addChapter` ép `isStoryBibleOpen: false` (`useNovelcrafterStateMutators.ts:139-147, 150-170`) — plan không đề cập → `[MINOR-2]`. Jump Request + `wasOpenRef` → `[MINOR-1]`.                                                                                                                                                                                  |
| **S5: Security Boundary**     | PASS       | `[SRC]` Server vẫn gate `assertModelAllowedForUser` (`limits.ts:479-495`) trước khi chạy runner; `isModelAllowedById` chỉ là UX phía client, thuật toán mở rộng trùng server. Fallback OpenRouter chạy sau gate rank, log không chứa key.                                                                                                                                                                                                                                                                                                                                                                                     |
| **S6: External Resilience**   | PASS       | `[SRC]` Thiếu cả hai key → `getOpenRouterClient()` ném → `catch` tại `novelcrafterStreamRunner.server.ts:364-374` → `event: error`. Upstream hủy ngay qua `{ signal }`. `maxOutputTokens` = 65536 cho Argon (`modelRegistry.ts:105`, `getModelMaxOutputTokens` `:439`) giảm rủi ro reasoning chiếm hết budget.                                                                                                                                                                                                                                                                                                                |
| **Domain Inquiry**            | Ghi nhận   | Model Registry: `clampGeminiThinkingLevel` trả kiểu chuỗi thường `GeminiThinkingLevel` (`modelRegistry.ts:10, 490-503`) — cần ánh xạ sang enum SDK (xem `[MAJOR-A]`). Bilingual: đạt.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### Adversarial Timelines bổ sung (`[ADV]`)

```
Cơ chế: useAutoResizeTextarea — nhánh JS fallback (trình duyệt không hỗ trợ field-sizing)
T1: Chương A 3000 từ → hook set el.style.height = "19208px"
T2: User chọn Chương B (200 từ). Cùng phần tử <textarea> (không có key) nhận value mới;
    height inline vẫn 19208px → scrollHeight = clientHeight = 19208
T3: Điều kiện (scrollHeight > clientHeight || scrollHeight < clientHeight - 40) = false → bỏ qua
Kết cục: Chương B hiển thị 200 từ rồi ~18000px khoảng trắng; Story Bible inline bị đẩy xuống tận đáy.
         Tương tự khi xoá đoạn lớn / undo / Replace Selection rút ngắn văn bản → LỖI (MAJOR)
```

```
Cơ chế: wasOpenRef chỉ được cập nhật bên trong effect theo jumpRequest.nonce
T1: User bấm "Characters" (Bible đóng → mở) → wasOpenRef = true sau lần nhảy
T2: User bấm nút thu gọn Bible (onClose) → isOpen = false, nhưng effect nonce không chạy → wasOpenRef vẫn true
T3: User bấm "Outline": setStoryBibleOpen(true) + nonce mới trong cùng render → nhánh "đã mở sẵn" → requestAnimationFrame(scrollToTarget)
    trong khi motion.section đang animate height 0 → auto (0.15s) → scrollHeight container chưa đủ → trình duyệt kẹp scrollTop
Kết cục: Cuộn dừng sớm, thẻ Outline không vào khung nhìn → LỖI (MINOR — spec chưa đủ chặt, sửa đơn giản)
```

#### Phân loại lỗi

**[MAJOR-A] (tồn đọng từ Run 2) Snippet `thinkingConfig` Bước 2.1 vẫn không qua `tsc`.**

- `[CMD]` TS2322 nguyên văn ở trên. Truyền inline không giúp được vì `GenerateContentParameters.config` vẫn được kiểm theo `GenerateContentConfig` của SDK.
- Việc cần làm:
  1. Trong `novelcrafterStreamRunner.server.ts`, `import { ThinkingLevel } from "@google/genai"` và khai báo bảng ánh xạ `const SDK_THINKING_LEVEL: Record<GeminiThinkingLevel, ThinkingLevel> = { minimal: ThinkingLevel.MINIMAL, low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH };` — đã probe `tsc` exit 0. Không dùng `as any`/`as unknown as`.
  2. Sửa lời giải thích ở Bước 2.1 và Mục tiêu 3 (bỏ khẳng định "inline tránh TS2322 như `gemini-stream.ts`").
  3. Cập nhật TC-01 (Bước 2.2 và bảng Test Contract): giá trị thực gửi đi là `thinkingLevel: "MEDIUM"` (`ThinkingLevel.MEDIUM`), không phải `"medium"`. Assert nên so với `ThinkingLevel.MEDIUM` để không lệch khi SDK đổi chuỗi.

**[MAJOR-D] Control của rủi ro R1 (Trung bình) vẫn sai: textarea không co lại ở nhánh JS fallback.**

- `[CMD]` probe Playwright; `[ADV]` timeline 1. Theo `evidence-bar.md` 4.5.4, rủi ro Trung bình phải có control đúng → `[MAJOR]`.
- Việc cần làm (Bước 3.1):
  1. Bỏ điều kiện `scrollHeight > clientHeight || scrollHeight < clientHeight - 40`. Luôn đo: lưu `prevScrollTop` → `el.style.height = "auto"` → `next = Math.max(min, el.scrollHeight)` → chỉ ghi `el.style.height` (và khôi phục `scrollTop`) khi `next` khác chiều cao đã áp dụng lần trước (lưu trong `useRef<number>`) để tránh reflow thừa mỗi frame stream.
  2. Hoặc tách hẳn hai nhánh: nếu `CSS.supports("field-sizing", "content")` thì hook không làm gì; ngược lại chạy JS như ý 1. Ghi rõ lựa chọn.
  3. Thêm `chapter.id` vào dependency của hook (hoặc `key={chapter.id}` cho textarea) và bổ sung bước TC-05 thủ công: chuyển từ chương dài sang chương ngắn và xoá một đoạn lớn → chiều cao textarea co lại, không còn khoảng trắng.

**[MINOR-1]** `InlineStoryBibleSection`: đồng bộ `wasOpenRef.current = isOpen` trong một effect riêng theo `[isOpen]` (chạy sau effect nonce), không chỉ trong effect của nonce; xoá cờ "chờ animation" sau khi `onAnimationComplete` đã cuộn để lần mở bằng nút toggle sau đó không cuộn ngoài ý muốn (`[ADV]` timeline 2).

**[MINOR-2]** `selectChapter` và `addChapter` đặt `isStoryBibleOpen: false` (`useNovelcrafterStateMutators.ts:143, 166`). Trong canvas hợp nhất, đổi chương sẽ thu gọn Bible — mâu thuẫn tinh thần Assumption 3 và Bước 7.3 ("luôn sáng kể cả khi Story Bible mở bên dưới"). Quyết định giữ hay bỏ; nếu bỏ thì thêm file vào bảng Files. Cân nhắc đặt `scrollContainerRef.current.scrollTop = 0` khi `chapter.id` đổi.

**[MINOR-3]** Bước 6.1 / 7.1 chưa liệt kê props mới mà `ChapterEditorWorkspace` phải nhận để nhúng `InlineStoryBibleSection` (`storyBible`, `onUpdateStoryBible`, `isStoryBibleOpen`, `onCloseStoryBible`, `bibleJumpRequest`). Ghi rõ interface để executor không phải tự đoán.

**[MINOR-4]** `calculateScrollTopForCharOffset`: mô tả nói "căn giữa viewport" nhưng công thức dùng `clientHeight / 3`; cần ghi rõ cách tính `textareaOffsetInContainer` (ví dụ `textarea.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop`), đặt `mirror.style.width = textarea.clientWidth + "px"`, `visibility: hidden`, `position: absolute`, và gỡ mirror trong `finally`.

**[MINOR-5]** `disabled={modelsLoading}` khoá toàn bộ selector khi đang tải, trong khi TopBar hiện tại cho phép chọn lúc loading (`NovelcrafterTopBar.tsx:171`). Chấp nhận được nhưng nên ghi nhận là thay đổi hành vi có chủ đích.

#### Kết luận

**[CHANGES_REQUESTED]** — Revision 3 đã xử lý MAJOR-C và hầu hết MINOR của Run 2, nhưng còn 2 lỗi `[MAJOR]`:

1. `[MAJOR-A]` (tồn đọng) — snippet `thinkingConfig` vẫn lỗi TS2322; dùng bảng ánh xạ sang enum `ThinkingLevel` của SDK (đã probe exit 0) và sửa kỳ vọng TC-01 thành `ThinkingLevel.MEDIUM`.
2. `[MAJOR-D]` — sửa thuật toán `useAutoResizeTextarea` để co lại được (đo vô điều kiện + so với chiều cao đã áp dụng, hoặc chỉ chạy JS khi không hỗ trợ `field-sizing`), reset theo `chapter.id`, bổ sung bước kiểm chứng co lại vào TC-05.

Antigravity cần cập nhật `## Technical Plan` lên Revision 4, khuyến nghị xử lý luôn MINOR-1 → MINOR-5, rồi gửi thẩm định Audit Run 4.

### Audit Run 4

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-15
- **Đối tượng**: Technical Plan — Revision 4 (Addressing Audit Run 3)

#### Kiểm chứng lỗi cũ (so với Audit Run 3)

| Lỗi Run 3                                                               | Trạng thái      | Ghi chú                                                                                                                                                                                                                                                                                                                                     |
| :---------------------------------------------------------------------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MAJOR-A (TS2322 `thinkingConfig`)                                       | ✅ Đã khắc phục | Bước 2.1 dùng `SDK_THINKING_LEVEL_MAP: Record<GeminiThinkingLevel, ThinkingLevel>` (đủ 4 key `minimal/low/medium/high`, khớp `modelRegistry.ts:10`). `[CMD]` probe nguyên văn snippet → `tsc` exit 0, không cast. TC-01 đã assert `ThinkingLevel.MEDIUM`.                                                                                   |
| MAJOR-D (textarea không co lại ở nhánh JS fallback)                     | ✅ Đã khắc phục | Bước 3.1: bỏ điều kiện `scrollHeight < clientHeight - 40`, luôn `height="auto"` → đo → ghi; tách nhánh `CSS.supports("field-sizing", "content")`; `key={chapter.id}` + `chapterId` trong deps; TC-05 có case chuyển chương dài → ngắn và xóa 2000 từ. `[CMD]` probe Chromium: grow `26612px` → shrink `420px`, `scrollTop` được giữ nguyên. |
| MINOR-1 (`wasOpenRef` / cờ chờ animation)                               | ⚠️ Một phần     | Đã có effect `[isOpen]` riêng và `isPendingScrollRef = false` sau khi cuộn. Nhưng plan vẫn chưa quy định **thứ tự khai báo** hai effect → xem `[MINOR-1]` bên dưới.                                                                                                                                                                         |
| MINOR-2 (`selectChapter`/`addChapter` ép đóng Bible; reset `scrollTop`) | ✅              | Bước 7.1 xóa `isStoryBibleOpen: false` (`[SRC]` `useNovelcrafterStateMutators.ts:143, 166` đúng vị trí); Bước 6.1 reset `scrollTop = 0` theo `chapter.id`.                                                                                                                                                                                  |
| MINOR-3 (interface props `ChapterEditorWorkspace`)                      | ✅              | Interface đầy đủ ở Bước 6.1; mọi type tham chiếu đều tồn tại: `StoryBible` (`types.ts:158`), `TriggerNovelcrafterStreamParams` (`useNovelcrafterStream.ts:27`), `EditorSelectionRange` (`ChapterEditorWorkspace.tsx:24`), `NovelcrafterBibleSectionId` (`NovelcrafterLeftNavigator.tsx`).                                                   |
| MINOR-4 (mirror-div spec)                                               | ✅              | Đã ghi rõ `textareaOffsetInContainer`, `clientWidth`, `visibility/position`, gỡ node trong `finally`.                                                                                                                                                                                                                                       |
| MINOR-5 (`disabled={modelsLoading}`)                                    | ✅              | Đổi sang `disabled={false}`; khi loading `useAllowedModels` trả Set rỗng (`useAllowedModels.ts:7`) → `isModelAllowedById` trả `true` → giữ nguyên hành vi hiện tại (`NovelcrafterTopBar.tsx:171`).                                                                                                                                          |

#### Lệnh đã chạy (`[CMD]`)

| Lệnh                                                                                                                                                                                                                                                                       | Exit     | Kết quả liên quan                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Probe tạm (đã xóa) `src/__probe_r4__/probe.ts` chứa **nguyên văn** `SDK_THINKING_LEVEL_MAP` + thân `streamGeminiProvider` Bước 2.1 (`getGenAIClient()` thật, spread `maxOutputTokens`/`thinkingConfig`) + biểu thức `openRouterModel`; `npx tsc --noEmit -p tsconfig.json` | 0        | Không lỗi kiểu.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Probe vitest tạm (đã xóa) `src/lib/core/__probe_r4__/p.test.ts` tái hiện `isModelAllowedById` trên registry thật (assert cố ý để in kết quả)                                                                                                                               | 1 (cố ý) | `{"c1":true,"c2":true,"c3":false,"c4":false,"c5":true,"c6":false,"c7":false,"c8":true,…,"normSonnet":"claude-sonnet-4.5","orSonnet":"anthropic/claude-sonnet-4-6","antSonnet":"claude-sonnet-4-6"}` — khớp TC-04 (gồm `toString`/`constructor` → `false`, case khóa hành vi allowlist → `true`), TC-02 và TC-03. Ghi chú: `API_ALLOWED` là biến module-local (`modelRegistry.ts:302`) nên probe xấp xỉ bằng `SELECTABLE_SET`; hàm thật đặt trong cùng file nên truy cập được. |
| Probe Playwright Chromium (script tạm ngoài repo, đã xóa) chạy nguyên văn thuật toán fallback Bước 3.1 trong scroll container 600px                                                                                                                                        | 0        | `{"grow":"26612px","scrollKept":true,"shrink":"420px","supportsFieldSizing":true}`.                                                                                                                                                                                                                                                                                                                                                                                           |
| `wc -l`                                                                                                                                                                                                                                                                    | 0        | `modelRegistry.ts` 600, `novelcrafterStreamRunner.server.ts` 384, `ChapterEditorWorkspace.tsx` 468, `StoryBibleWorkspace.tsx` 521, `NovelcrafterStudioApp.tsx` 439, `NovelcrafterTopBar.tsx` 266.                                                                                                                                                                                                                                                                             |
| `grep` translation keys `novelcrafterCollapseBible/ExpandBible/JumpToBible`                                                                                                                                                                                                | 1        | Chưa tồn tại → không trùng key.                                                                                                                                                                                                                                                                                                                                                                                                                                               |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                      | Kết quả          | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :---------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**    | PASS             | `[CMD]` `tsc` exit 0 với snippet Bước 2.1. `ThinkingLevel` là export runtime của `@google/genai` và test harness chỉ mock `@/lib/core/genaiClient` → import enum trong test hợp lệ. `ModelSelector` default export với đúng props (`ModelSelector.tsx:53-63`). Không thêm dependency; không Prisma/Better Auth; layer boundary đúng (hàm thuần trong `lib/core/`, UI trong `app/features/`). Xem `[MINOR-2]` về kích thước file. |
| **S2: Lifecycle & Teardown**  | PASS             | `afterEach(vi.unstubAllEnvs)` (cần import thêm `afterEach` vào dòng 2 — `[SRC]` hiện chỉ có `beforeEach, describe, expect, it, vi`); test dòng 171 được stub key. `{ signal }` truyền vào `messages.create` và `chat.completions.create`; vòng `for await` vẫn `break` khi `signal.aborted`; `finally` đóng controller.                                                                                                          |
| **S3: Database & Temporal**   | PASS (N/A)       | Không migration/schema. `isStoryBibleOpen` persist sẵn; bỏ việc ép `false` chỉ đổi hành vi UI, không đổi schema.                                                                                                                                                                                                                                                                                                                 |
| **S4: Cross-Task State Flow** | PASS (kèm MINOR) | `[CMD]` probe co giãn 2 chiều đạt. Cold-start: `jumpRequest = null`, `useEffect([activeSection])` cũ bị gỡ, `scrollTop = 0` theo `chapter.id` → không tự cuộn. Re-click TOC: nonce mới → cuộn lại. Mở Bible bằng toggle khi còn `jumpRequest` cũ: `StoryBibleWorkspace` mount lại chỉ mở accordion đích, `InlineStoryBibleSection` không cuộn vì nonce không đổi → vô hại. Còn khe hở thứ tự effect → `[MINOR-1]`.               |
| **S5: Security Boundary**     | PASS             | Server vẫn gate `assertModelAllowedForUser` (`limits.ts:479-495`) trước runner; `isModelAllowedById` chỉ là UX, thuật toán mở rộng trùng server; `Object.hasOwn` chặn prototype key. Fallback OpenRouter chạy sau gate rank; log không chứa key.                                                                                                                                                                                 |
| **S6: External Resilience**   | PASS             | Thiếu cả hai key → `getOpenRouterClient()` ném → `catch` phát `event: error`. `maxOutputTokens` 65536 cho Argon. Upstream hủy ngay qua `{ signal }`.                                                                                                                                                                                                                                                                             |
| **Domain Inquiry**            | Ghi nhận         | Model Registry: map enum đầy đủ, không cast. Bilingual: 3 key mới, đủ `vi.ts`/`en.ts`. Reasoning: `includeThoughts: true` + runner đã tách `thought` part thành sự kiện `thinking` → suy luận không rò vào văn xuôi.                                                                                                                                                                                                             |

#### Adversarial Timelines bổ sung (`[ADV]`)

```
Cơ chế: Thứ tự khai báo effect trong InlineStoryBibleSection (Bước 5.1 liệt kê effect [isOpen] TRƯỚC effect nonce)
T1: Bible đang đóng; user bấm "Outline" → setStoryBibleOpen(true) + setBibleJumpRequest(nonce mới) được batch trong 1 render
T2: React chạy effect theo thứ tự khai báo: effect [isOpen] gán wasOpenRef.current = true TRƯỚC
T3: Effect nonce đọc wasOpenRef.current === true → nhánh "đã mở sẵn" → requestAnimationFrame(scrollToTarget)
    trong khi motion.section đang animate height 0 → auto (0.15s) → scrollHeight chưa đủ → trình duyệt kẹp scrollTop
Kết cục: Cuộn dừng sớm ở case "Bible đóng → bấm TOC". Nếu khai báo effect nonce TRƯỚC effect [isOpen] thì đúng → MINOR (spec cần ghi rõ thứ tự)
```

#### Phân loại lỗi

Không còn `[BLOCKER]` hay `[MAJOR]`.

**[MINOR-1]** (tồn đọng một phần từ Run 3) Bước 5.1: ghi rõ effect lắng nghe `jumpRequest?.nonce` phải được **khai báo trước** effect đồng bộ `wasOpenRef.current = isOpen` (React chạy effect theo thứ tự khai báo), hoặc đọc trạng thái cũ bằng `const wasOpen = wasOpenRef.current` ở đầu effect nonce rồi cập nhật ref trong cùng effect đó. Nên bổ sung bước thủ công vào TC-06: "Thu gọn Bible → bấm `Outline` → thẻ Outline vào khung nhìn".

**[MINOR-2]** Kích thước file: `modelRegistry.ts` hiện đã 600 dòng (vượt Hard Max 400 cho `lib/`, `01-coding.md:104`) và plan đưa lên ~620–645 — trái với tiêu đề Mục 5 "Chiến lược `<= 400` dòng". `novelcrafterStreamRunner.server.ts` 384 dòng; tổng thay đổi Bước 2.1 (import, map 6 dòng, thinking/maxTokens, nhánh fallback ~12 dòng) nhiều khả năng đưa lên ~410–420, vượt ước tính ~395. Khuyến nghị: đặt `isModelAllowedById` vào file mới `src/lib/core/modelAccess.ts` + `modelAccess.test.ts`; nếu runner vượt 400 thì tách adapter provider sang `novelcrafterProviders.server.ts`. Vi phạm có sẵn từ trước và quy tắc ghi "heuristic" (`01-coding.md:95`) nên không chặn.

**[MINOR-3]** Sau khi thay `<select>` bằng `ModelSelector`, prop `modelsLoading` của `NovelcrafterTopBar` (`NovelcrafterTopBar.tsx:39, 63`) không còn được dùng, trong khi Bước 7.2 vẫn truyền xuống. Xóa prop (cả interface lẫn `NovelcrafterStudioApp.tsx:346`) để tránh cảnh báo `no-unused-vars` (yêu cầu 0 warning, `01-coding.md:16`).

**[MINOR-4]** Mục tiêu 3 (dòng 12) mô tả `SDK_THINKING_LEVEL_MAP: { low, medium, high }` (3 key) trong khi Bước 2.1 khai báo đủ 4 key — `Record<GeminiThinkingLevel, …>` bắt buộc có `minimal`. Đồng bộ lại mô tả. Fallback `|| ThinkingLevel.MEDIUM` là thừa vì `Record` đã total.

**[MINOR-5]** `useAutoResizeTextarea`: nhánh `else` luôn ghi lại chiều cao và `height = "auto"` đã gây reflow mỗi lần chạy, nên `lastAppliedHeightRef` không thực sự tiết kiệm reflow như mô tả — chỉ cần ghi `el.style.height = nextHeight + "px"` vô điều kiện. Tương tự, cast `(allowedModelIds as Set<string>)` trong `isModelAllowedById` là thừa sau `instanceof Set`. Không ảnh hưởng đúng/sai.

#### Kết luận

**APPROVED** — Revision 4 đã khắc phục toàn bộ `[MAJOR]` tồn đọng (MAJOR-A đã probe `tsc` exit 0; MAJOR-D đã probe Chromium co lại về 420px và giữ `scrollTop`) và gần hết `[MINOR]` của Run 3. S1–S6 đều PASS. Năm `[MINOR]` ở trên không chặn kế hoạch; khuyến nghị executor xử lý MINOR-1 và MINOR-3 khi triển khai, và theo dõi số dòng (MINOR-2) tại Tier 1.

[PLAN_APPROVED]
