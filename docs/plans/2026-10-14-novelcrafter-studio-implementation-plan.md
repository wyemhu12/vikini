# Kế Hoạch Triển Khai: Novelcrafter (Story & Script Studio)

## Technical Plan

### 1. Mục Tiêu (Goal)

Xây dựng tính năng **Novelcrafter (Story & Script Studio)** tại route độc lập `/novelcrafter` theo đúng mô hình **Sudowrite 3-Pane Workspace & Story Bible Dependency Graph** (`[URL] https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC`), tích hợp cơ chế **Layered Mode ("1 Master GEM + 1 Master Persona (tùy chọn) + 5 Feature Persona Slots")** và lưu trữ bền vững theo từng bộ truyện thông qua kiến trúc **Zero DB Schema Migration** (mỗi bộ truyện là 1 `conversation` có `model = "vikini-novelcrafter"`, trạng thái JSON của bộ truyện được mã hóa AES-256-GCM trong bảng `messages` với `meta: { novelcrafterType: "story_state", isContextOnly: true, version, updatedAt }`).

Các trụ cột kiến trúc cốt lõi:

1. **Điều hướng, Quốc tế hóa Song ngữ & Tách biệt Lịch sử (Navigation, Bilingual i18n & Isolation)**:
   - Thêm nút **Novelcrafter** (`BookOpen` icon, `label={t("novelcrafter")}`) vào `Sidebar.tsx` nằm **ngay phía trên `Image Studio`** (giữa `Chat` và `Image Studio`).
   - Định nghĩa `MODEL_IDS.NOVELCRAFTER = "vikini-novelcrafter"` trong `src/lib/utils/constants.ts`, đăng ký trong `src/lib/core/modelRegistry.ts` (`isSelectableModelId`, `normalizeModelForApi`) và `src/lib/core/limits.ts` (`isModelAllowedForUser`, `assertModelAllowedForUser` cho phép tạo conversation container `MODEL_IDS.NOVELCRAFTER` đối với user đã được phê duyệt `rank !== "not_whitelisted"`).
   - Cô lập hoàn toàn các bộ truyện Novelcrafter khỏi luồng Chat thông thường: cập nhật `src/app/features/chat/components/hooks/useConversationSelectors.ts` (lọc bỏ `MODEL_IDS.NOVELCRAFTER` ở cả `filteredConversations` lẫn `currentConversation`), `src/app/features/chat/components/ChatApp.tsx` (truyền `filteredConversations` vào `ChatOverlays`), và `src/app/api/chat-stream/conversationLoader.ts` (chặn `convo.model === MODEL_IDS.NOVELCRAFTER` hoặc `MODEL_IDS.IMAGE_STUDIO` bằng `ValidationError` `400 VALIDATION_ERROR`).
   - Trên `/novelcrafter`, Sidebar hiển thị danh sách **Stories / Series** (tạo mới, đổi tên, xóa qua `await confirm({ ... })` từ `@/lib/store/confirmStore`) và ẩn mục `Projects` tương tự `/images`. Toàn bộ chuỗi giao diện được khai báo song ngữ đầy đủ trong `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`.
2. **Lưu trữ Bền vững An toàn & Chống Ghi đè Lùi (Encrypted Story State Persistence & Optimistic Concurrency)**:
   - Không tái sử dụng `upsertMessage` của Chat vì `upsertMessage` gọi `balanceThinkTags(content)` (`[SRC] src/lib/features/chat/messages.ts:224`) sẽ tự động nối `</think>` vào cuối chuỗi JSON nếu nội dung truyện chứa thẻ `<think>` chưa đóng, làm hỏng `JSON.parse()`.
   - Xây dựng module độc lập `src/lib/features/novelcrafter/storyPersistence.server.ts` sử dụng trực tiếp `getSupabaseAdmin()` (`[SRC] src/lib/core/supabase.server.ts`) và `encryptText` / `decryptText` (`[SRC] src/lib/core/encryption.ts:52,75`, định dạng 3 phần hex `iv:authTag:encryptedData`) để đọc/ghi bản ghi `messages` có `meta: { novelcrafterType: "story_state", isContextOnly: true, version, updatedAt }`.
   - Kiểm tra nghiêm ngặt quyền sở hữu `conversation.user_id === userId` và `conversation.model === MODEL_IDS.NOVELCRAFTER`, kiểm tra chống ghi đè lùi (`incoming.updatedAt < existing.updatedAt` hoặc `incoming.version < existing.version` -> ném `ValidationError("Stale story state rejected")`), dọn dẹp các bản ghi `story_state` trùng lặp nếu có, và cập nhật `conversations.updated_at = new Date().toISOString()` kèm `invalidateConversationsCache(userId)`.
3. **Stream Runner Độc lập Đa Provider (`src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`)**:
   - Tuân thủ tuyệt đối chiều phụ thuộc kiến trúc `app/` -> `lib/features/` -> `lib/core/`: **không import ngược** từ `src/app/api/chat-stream/streaming/`.
   - Gọi trực tiếp các singleton clients trong `src/lib/core/` (`getGenAIClient` từ `genaiClient.ts`, `getClaudeClient` từ `claudeClient.ts`, `getGroqClient` từ `groqClient.ts`, `getOpenRouterClient` từ `openRouterClient.ts`, `getDeepSeekClient` từ `deepseekClient.ts`).
   - Không gọi `savePartialOnce()`, `saveMessage()`, `processPostStream()`, hay `setConversationAutoTitle()` của Chat (không chèn tin nhắn `role: "assistant"` vào bảng `messages` và không tự đổi tên bộ truyện), không tiêm beta tools `code_execution_20250522` / `web_fetch_20250910`.
   - Chuẩn hóa định dạng khung SSE (`event: <name>\ndata: <json>\n\n`) thống nhất giữa server (`novelcrafterStreamRunner.server.ts`) và client (`useNovelcrafterStream.ts`) cho 5 loại sự kiện: `meta`, `thinking` (`{ t: string }`), `token` (`{ t: string }`), `done`, `error` (`{ message: string, code: string }`), kèm lắng nghe `req.signal` (`abort`) để dừng ngay vòng lặp đọc stream từ AI provider.
4. **Giao diện 3-Pane & Bố cục Persistent Story Bible chuẩn Sudowrite (`src/app/features/novelcrafter/`)**:
   - **Studio Top Bar**: Tên bộ truyện, Model Selector (`SELECTABLE_MODELS` lọc qua `useAllowedModels`), huy hiệu **👑 Master GEM**, huy hiệu **🎭 Master Persona**, trạng thái lưu tự động (`Saved` / `Saving...` / `Unsaved`), và nút mở Modal **⚙️ GEM & Persona Routing Settings**.
   - **Left Pane (Project Bar — Chapters & Story Bible Toggle)**:
     - Phía trên là danh sách **📑 Chapters (Documents)** (thêm chương, chọn chương, đổi tên, xóa qua `await confirm({ ... })` từ `@/lib/store/confirmStore`, đếm số từ từng chương và tổng số từ).
     - Ngay bên dưới danh sách Chapters là nút bật/tắt **📘 Story Bible Toggle** (`isStoryBibleOpen: boolean`) kèm mục lục nhảy nhanh (Quick-Jump Anchors) tới các trường của Story Bible.
   - **Center Pane (Document Prose + Scenes/Draft + Persistent Story Bible)**:
     - Phần trên hiển thị **Chapter Prose Editor** của chương đang chọn (theo dõi chính xác `selectionStart`/`selectionEnd`/`selectedText`), thanh công cụ **Sudowrite AI Toolbar**, và khung **Scenes (Chapter Beats) & Draft** của chương đó.
     - Khi **📘 Story Bible** được bật (`isStoryBibleOpen = true`), các trường Story Bible hiển thị **bên dưới phần Prose/Scenes của chương** và giữ tính **Persistent (xuyên suốt toàn bộ Truyện/Series)** khi người dùng chuyển đổi qua lại giữa các Chapter (chỉ có `Chapter Prose` và `Chapter Scenes` thay đổi theo chương).
     - Mỗi mục có sinh tự động trong Story Bible & Chapter (`Synopsis`, `Characters`, `Worldbuilding`, `Outline`, `Scenes (Chapter Beats)`) đều có bộ nút đôi chuẩn Sudowrite: **✨ Generate** (tạo mới dựa trên các trường nguồn trong Đồ thị Phụ thuộc) và **🔄 Rewrite** (nhập chỉ dẫn cụ thể để AI sửa lại mục đó). Mục **Draft (First Draft)** có nút **📝 Generate Draft** để sinh văn bản chương từ `Scenes + Style + Genre + Characters + Worldbuilding`.
   - **Right Pane (AI History Cards)**: Hiển thị luồng sinh văn bản trực tiếp (live SSE stream) kèm `<think>` collapsible và danh sách thẻ lịch sử AI của bộ truyện với các thao tác: `[⬅️ Append to Chapter]`, `[🔄 Replace Selection]`, `[📥 Apply to Bible/Scenes]` (khi thẻ sinh ra từ Slot 1), `[📋 Copy]`, `[🗑️ Delete Card]`.
5. **Đồ thị Phụ thuộc 8 Thành phần của Story Bible (Sudowrite 8-Node Dependency Graph)**:
   ```mermaid
   flowchart TD
     Braindump["1. Braindump (Manual)"] --> Synopsis["4. Synopsis (Generate / Rewrite)"]
     Genre["2. Genre (Manual)"] --> Synopsis
     Genre --> Outline["7. Outline (Generate / Rewrite)"]
     Genre --> Scenes["8a. Scenes / Chapter Beats (Generate / Rewrite)"]
     Genre --> Draft["8b. Draft / Write Prose"]
     Style["3. Style / POV / Tense (Manual)"] --> Scenes
     Style --> Draft
     Synopsis -. "Fallback: Braindump if Synopsis empty" .-> Characters["5. Characters (Generate / Rewrite + isVisibleToAI)"]
     Synopsis -. "Fallback: Braindump if Synopsis empty" .-> Worldbuilding["6. Worldbuilding (Generate / Rewrite + isVisibleToAI)"]
     Synopsis -. "Fallback: Braindump if Synopsis empty" .-> Outline
     Synopsis -. "Fallback: Braindump if Synopsis empty" .-> Scenes
     Characters -- "if isVisibleToAI" --> Outline
     Characters -- "if isVisibleToAI" --> Scenes
     Characters -- "if isVisibleToAI" --> Draft
     Worldbuilding -- "if isVisibleToAI" --> Outline
     Worldbuilding -- "if isVisibleToAI" --> Scenes
     Worldbuilding -- "if isVisibleToAI" --> Draft
     Outline --> Scenes
     Scenes --> Draft
   ```
6. **5 Slot Tính năng & Cơ chế Layered Mode (GEM + Persona Orchestration)**:
   - **5 Feature Slots**:
     - **Slot 1 (`bible`)**: **Story Bible & Scenes/First Draft** (_Generate_ / _Rewrite_ cho `Synopsis`, `Characters`, `Worldbuilding`, `Outline`, `Scenes (Chapter Beats)` và _Generate_ cho `Draft`).
     - **Slot 2 (`write`)**: **Write** (_Auto Write_ & _Guided Write_ viết tiếp văn bản chương hiện tại).
     - **Slot 3 (`rewrite`)**: **Rewrite** (Selection menu khi bôi đen văn bản: _Rephrase_, _Shorter_, _More descriptive_, _Show don't tell_, _More inner conflict_, _Customize_).
     - **Slot 4 (`expand`)**: **Expand & Describe** (_Expand_ mở rộng phân cảnh ngắn; _Describe_ miêu tả theo 5 giác quan _Sight, Sound, Smell, Taste, Touch_ & _Metaphor_).
     - **Slot 5 (`brainstorm`)**: **Brainstorm** (Gợi ý _Plot twists_, _Character names_, _World objects_, _Dialogue_, _Scene ideas_).
   - **Lắp ghép `systemInstruction` (Layered Mode)**:
     - Tầng 1 (`<task_instructions>`): Lệnh hệ thống nguyên bản từ **Master GEM** (`getGemsForUser` / `gem.instructions`), giữ quyền ưu tiên tuyệt đối số 1.
     - Tầng 2 (`<style_preferences>`): Giọng văn từ **Feature Persona** (hoặc kế thừa từ **Master Persona** nếu slot đặt `"inherit"`) thông qua `buildPersonaSystemPrompt(input: PersonaPromptInput)` (`[SRC] src/lib/features/personas/prompt-builder.ts:22-28`, với `{ tone, useEmojis, useHeadersLists, userContext, customInstructions }`), kèm chỉ dẫn bắt buộc tuân thủ `<task_instructions>`.
     - **Không cắt ngắn 12.000 ký tự (`MAX_SYSTEM_PROMPT_CHARS`)** trên đường chạy `/api/novelcrafter/stream` để bảo toàn 100% nội dung Master GEM và Persona.
   - **Lắp ghép `contents` (User Prompt)**:
     - **Story Bible & Ngữ cảnh Chương** không bao giờ đưa vào `systemInstruction`; luôn được đóng gói cấu trúc XML (`<story_bible>`, `<chapter_context>`, `<selected_text>`, `<feature_instruction>`) trong `contents` (User Prompt) theo đúng **Đồ thị Phụ thuộc 8 Thành phần** của Sudowrite.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ bảng Pre-Work Protocol trong `.agents/rules/02-quality.md`:

| Loại công việc                                    | Tài liệu & Source Code đã đọc và đối chiếu                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Architecture, Security & Rules**                | `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md`, `[SRC] docs/architecture.md`, `[SRC] docs/contracts.md`, `[SRC] docs/security.md`, `[SRC] docs/database-schema.md`, `[SRC] docs/CHANGELOG.md`                                                                                                                                                                |
| **Sudowrite Official Spec**                       | `[URL] https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC` (Story Bible Persistent Layout, Generate/Rewrite buttons, 8-Node Dependency Graph, Braindump Fallback, Visibility Settings, Chapter Continuity)                                                                                                                                                                 |
| **Model Registry, Limits & Constants**            | `[SRC] src/lib/utils/constants.ts:17-31,95-122`, `[SRC] src/lib/core/modelRegistry.ts:368-407`, `[SRC] src/lib/core/limits.ts:266-305,463-511`, `[SRC] src/lib/core/rateLimit.ts:187-230`                                                                                                                                                                                                                                            |
| **Sidebar, Confirm Store, i18n & Chat Filtering** | `[SRC] src/app/features/sidebar/components/Sidebar.tsx:285-442`, `[SRC] src/lib/store/confirmStore.ts:1-60`, `[SRC] src/lib/utils/translations/vi.ts:480-600`, `[SRC] src/lib/utils/translations/en.ts:480-600`, `[SRC] src/app/features/chat/components/hooks/useConversationSelectors.ts:23-53`, `[SRC] src/app/features/chat/components/ChatApp.tsx:169-250,380-405`, `[SRC] src/app/api/chat-stream/conversationLoader.ts:14-74` |
| **Conversations & Encryption**                    | `[SRC] src/lib/features/chat/conversations.ts:127-160,294-395,476-505`, `[SRC] src/lib/features/chat/messages.ts:121-285`, `[SRC] src/lib/core/encryption.ts:52-125`, `[SRC] src/lib/core/supabase.server.ts:1-60`                                                                                                                                                                                                                   |
| **GEMs & Personas**                               | `[SRC] src/lib/features/gems/gems.ts:214-320`, `[SRC] src/lib/features/personas/personas.ts:72-84`, `[SRC] src/lib/features/personas/prompt-builder.ts:22-62`, `[SRC] src/app/api/gems/route.ts:1-40`, `[SRC] src/app/api/personas/route.ts:1-40`                                                                                                                                                                                    |
| **Core AI Singleton Clients**                     | `[SRC] src/lib/core/genaiClient.ts:48-61`, `[SRC] src/lib/core/claudeClient.ts:19-39`, `[SRC] src/lib/core/groqClient.ts:7-25`, `[SRC] src/lib/core/openRouterClient.ts:3-16`, `[SRC] src/lib/core/deepseekClient.ts:3-12`, `[SRC] src/app/api/chat-stream/route.ts:1-115`                                                                                                                                                           |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1. Giả định Kỹ thuật & Phụ thuộc Chéo (Cross-Task Dependencies)

- **Zero DB Migration Dependency**: Tận dụng bảng `conversations` (với `model = "vikini-novelcrafter"`) và bảng `messages` hiện hữu trên Supabase PostgreSQL. Không cần chạy SQL migration.
- **Model Registry & Rank Gating Dependency (`src/lib/core/modelRegistry.ts`, `src/lib/core/limits.ts`)**:
  - Hàm `doSaveConversation` (`[SRC] src/lib/features/chat/conversations.ts:368-371`) gọi `coerceStoredModel(payload?.model)` và `await assertModelAllowedForUser(userId, model)`.
  - Nếu không thêm `MODEL_IDS.NOVELCRAFTER` vào `isSelectableModelId` / `normalizeModelForApi` trong `src/lib/core/modelRegistry.ts`, model sẽ bị ép về `"gemini-2.5-flash"`.
  - Đồng thời, trong `src/lib/core/limits.ts:463-511`, `isModelAllowedForUser` và `assertModelAllowedForUser` phải cho phép các pseudo-model định danh không gian làm việc (`MODEL_IDS.IMAGE_STUDIO`, `MODEL_IDS.NOVELCRAFTER`) đối với mọi tài khoản đã được duyệt (`limits.rank !== "not_whitelisted"`), trong khi tại `/api/novelcrafter/stream` và `/api/novelcrafter/state` (`state.selectedModel`), hệ thống bắt buộc kiểm tra model AI thực thi nằm trong `MODEL_REGISTRY` (không phải pseudo-model) VÀ gọi `await assertModelAllowedForUser(userId, selectedModel)` để ngăn chặn user hạng `basic` gọi trái phép các model hạng `pro`/`admin`.
- **Direct Message Persistence Dependency (`storyPersistence.server.ts`)**: Không gọi `upsertMessage` (`[SRC] src/lib/features/chat/messages.ts:224`) để lưu JSON state của Novelcrafter vì `balanceThinkTags(content)` sẽ phá hỏng cấu trúc JSON nếu trong nội dung chương hoặc lịch sử thẻ AI có chuỗi `<think>`. Bản ghi `story_state` trong bảng `messages` luôn gắn `meta: { novelcrafterType: "story_state", isContextOnly: true, version, updatedAt }`.
- **Standalone Multi-Provider Stream Runner Dependency (`novelcrafterStreamRunner.server.ts`)**: Tuyệt đối không gọi `createChatReadableStream`, `createAnthropicStream`, `createOpenAICompatibleStream`, hay `createDeepSeekStream` trong `src/app/api/chat-stream/streaming/` để tránh vi phạm chiều phụ thuộc kiến trúc (`lib/features/` -> `app/`) và tránh các side-effects `savePartialOnce()` / `processPostStream()` / `setConversationAutoTitle()` ghi bẩn bảng `messages` và `conversations`.

#### 3.2. Mental Simulation (S1–S6) & Adversarial Timelines

| Kịch bản                                                                        | Mô phỏng Luồng Thực Thi & Thiết Kế Phòng Thủ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 — Happy Path**                                                             | Người dùng mở `/novelcrafter`, bấm `+ New chat` trên Sidebar -> tạo `conversation` có `model = "vikini-novelcrafter"`. Mở Modal **⚙️ GEM & Persona Routing**, chọn Master GEM và Master Persona. Cuộn xuống phần **Story Bible** (persistent bên dưới Chapter Prose), nhập `Braindump`, `Genre`, `Style`, rồi bấm `Generate` tuần tự cho `Synopsis` -> `Characters` -> `Worldbuilding` -> `Outline` -> `Scenes (Chapter Beats)` -> `Draft (Prose)`. Khi chuyển sang `Chapter 2` ở cột trái, toàn bộ `Story Bible` giữ nguyên bên dưới, chỉ có `Chapter Prose` và `Scenes` đổi sang `Chapter 2` (với `Chapter Continuity` lấy ngữ cảnh cuối `Chapter 1`).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **S2 — Interrupted / Cancelled / Switched Mid-Flight**                          | Khi luồng SSE `/api/novelcrafter/stream` đang chạy hoặc bộ đếm auto-save debounce (1200ms) đang chờ, người dùng bấm chuyển sang bộ truyện khác trên Sidebar hoặc rời trang `/novelcrafter`:<br>1. `abortControllerRef.current?.abort()` lập tức hủy kết nối fetch SSE.<br>2. Server (`novelcrafterStreamRunner.server.ts`) lắng nghe `req.signal` (`abort`), dừng ngay vòng lặp đọc provider stream và đóng `ReadableStream` mà **không gọi `savePartialOnce()` hay ghi bất kỳ bản ghi nào vào DB**.<br>3. Bộ đếm debounce auto-save lưu kèm `targetConversationId` tại thời điểm khởi tạo và hủy/cô lập hoàn toàn khi chuyển `selectedConversationId`, đảm bảo state của Truyện A không bao giờ ghi đè sang Truyện B.                                                                                                                                                                                                                                                                                                                                                                                              |
| **S3 — Concurrent / Duplicate Action & Stale Overwrite (Adversarial Timeline)** | **Timeline**: Người dùng vừa sửa nội dung chương ở thời điểm `T1` (`updatedAt = 1000`, `version = 2`), rồi sửa tiếp ở `T2` (`updatedAt = 2000`, `version = 3`). Request `PUT #1` bị trễ mạng đến server sau `PUT #2`.<br>**Giải pháp kỹ thuật trong `saveStoryState`**:<br>1. Truy vấn tất cả các row trong `messages` có `conversation_id = conversationId` và `meta->>novelcrafterType = 'story_state'` sắp xếp theo `created_at DESC`.<br>2. Giải mã row hiện có mới nhất (`existingState`): nếu `state.updatedAt < existingState.updatedAt` hoặc `state.version < existingState.version`, từ chối ghi đè bằng `ValidationError("Stale story state rejected")` (`400 VALIDATION_ERROR`).<br>3. Khi hợp lệ, tăng `version = Math.max(state.version, existingState?.version ?? 0) + 1`, cập nhật row mới nhất (hoặc `INSERT` nếu chưa có) với `meta: { novelcrafterType: "story_state", isContextOnly: true, version, updatedAt }`, xóa ngay các row `story_state` cũ dư thừa nếu `rows.length > 1`, và cập nhật `conversations.updated_at = new Date().toISOString()` kèm `invalidateConversationsCache(userId)`. |
| **S4 — Partial Failure / Dependency Down**                                      | Nếu `/api/novelcrafter/stream` gặp lỗi giữa chừng từ AI provider (rate limit 429, timeout, hoặc mất kết nối), `novelcrafterStreamRunner.server.ts` phát khung SSE chuẩn `event: error\ndata: {"message":"...","code":"STREAM_ERROR"}\n\n` và đóng stream. Client (`useNovelcrafterStream.ts`) giữ nguyên toàn bộ văn bản trong `Chapter Editor` và `Story Bible`, bảo lưu phần văn bản đã stream được (nếu có) và hiển thị thông báo qua `useToastStore`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **S5 — Untrusted / Boundary Input & 3-Tier Auth / Rank Gating**                 | - Chưa đăng nhập (`!session?.user?.email`) -> `401 UNAUTHORIZED`.<br>- Vượt rate limit (`!rl.allowed`) -> `429 RATE_LIMITED` kèm `Retry-After`.<br>- Tài khoản `messageLimit.rank === "not_whitelisted"` -> `403 ACCESS_PENDING`.<br>- Hết lượt ngày (`!messageLimit.canSend`) -> `429 DAILY_LIMIT_EXCEEDED`.<br>- Model gửi lên `/api/novelcrafter/stream` hoặc `selectedModel` trong `/api/novelcrafter/state` không thuộc quyền hạn rank của user -> `assertModelAllowedForUser` ném `ForbiddenError` -> `403 FORBIDDEN`.<br>- `conversationId` không khớp `UUID_REGEX`, thuộc về user khác, hoặc không có `model === "vikini-novelcrafter"` -> `400 VALIDATION_ERROR` hoặc `404 NOT_FOUND`.<br>- Gọi `/api/chat-stream` với `conversationId` của Novelcrafter -> `conversationLoader.ts` ném `ValidationError` (`400 VALIDATION_ERROR`).<br>- Mảng `chapters` giới hạn `.min(1).max(100)` và `historyCards` giới hạn `.max(50)` trong Zod schema.                                                                                                                                                               |
| **S6 — Regression Audit & Serverless Execution Cap**                            | - `useConversationSelectors.ts` loại bỏ `MODEL_IDS.NOVELCRAFTER` khỏi cả `filteredConversations` và `currentConversation`, đảm bảo truy cập `/?id=<novelcrafter-id>` trên Main Chat không bao giờ mở nhầm bộ truyện Novelcrafter.<br>- Khai báo tường minh `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;` trên `/api/novelcrafter/state/route.ts` và `export const maxDuration = 300;` trên `/api/novelcrafter/stream/route.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### 3.3. Domain Inquiry (Tư duy Chuyên gia Sudowrite Story Bible & Kịch Bản)

- **Tách bạch `System Instruction` (GEM + Persona) và `Story Bible Dependency Context`**:
  - Trong `systemInstruction`, **Master GEM (`<task_instructions>`)** đóng vai trò bộ luật biên tập tối cao và **Feature Persona (`<style_preferences>`)** điều chỉnh giọng điệu thực thi cho từng công cụ thông qua `buildPersonaSystemPrompt` (`[SRC] src/lib/features/personas/prompt-builder.ts:22-28`).
  - Trong `contents` (User Prompt), hàm `buildNovelcrafterUserPrompt` **chỉ đóng gói đúng các nút nguồn trong Đồ thị Phụ thuộc 8 Thành phần của Sudowrite** cho từng hành động cụ thể:
    1. **Generate/Rewrite `Synopsis`**: Nguồn = `Braindump + Genre` (+ bản nháp `Synopsis` hiện tại & `rewriteInstruction` nếu là `Rewrite`).
    2. **Generate/Rewrite `Characters`**: Nguồn = `Synopsis` _(hoặc fallback sang `Braindump` nếu `Synopsis` trống)_ (+ `Characters` hiện tại & `rewriteInstruction` nếu là `Rewrite`).
    3. **Generate/Rewrite `Worldbuilding`**: Nguồn = `Synopsis` _(hoặc fallback sang `Braindump` nếu `Synopsis` trống)_ (+ `Worldbuilding` hiện tại & `rewriteInstruction` nếu là `Rewrite`).
    4. **Generate/Rewrite `Outline`**: Nguồn = `Genre + Synopsis (hoặc Braindump fallback) + Characters (nếu charactersVisibleToAI) + Worldbuilding (nếu worldbuildingVisibleToAI)`.
    5. **Generate/Rewrite `Scenes (Chapter Beats)`**: Nguồn = `Genre + Style + Synopsis (hoặc Braindump fallback) + Outline + Characters (nếu charactersVisibleToAI) + Worldbuilding (nếu worldbuildingVisibleToAI) + Previous Chapter Continuity (1.500 ký tự cuối của chương liền trước nếu có)`.
    6. **Generate `Draft (Chapter Prose)` & `Write (Auto/Guided)`**: Nguồn = `Style + Genre + Characters (nếu charactersVisibleToAI) + Worldbuilding (nếu worldbuildingVisibleToAI) + Scenes (Chapter Beats của chương hiện tại)` (+ cửa sổ `8.000` ký tự cuối của `Chapter Prose` hiện tại khi chạy `Write`).

---

### 4. Bảng Verified Versions (Online Grounding 2026)

| Thư viện / Công nghệ                          | Phiên bản trong `package.json` (`[SRC]`)  | Xác minh Tài liệu Chính thức 2026 (`[URL]`)                                                                          | Ghi chú Tương thích & Áp dụng                                                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Next.js (App Router)**                      | `^16.4.0` (`[SRC] package.json:79`)       | `[URL] https://nextjs.org/docs/app/building-your-application/routing/route-handlers`                                 | Sử dụng `NextRequest`, `ReadableStream`, khai báo `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60` (`/state`) và `maxDuration = 300` (`/stream`).                                             |
| **React**                                     | `^19.2.3` (`[SRC] package.json:83`)       | `[URL] https://react.dev/blog/2024/12/05/react-19`                                                                   | Sử dụng chuẩn hooks React 19 (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`), tránh mọi API deprecated.                                                                                              |
| **Google Gen AI SDK**                         | `^2.10.0` (`[SRC] package.json:59`)       | `[URL] https://www.npmjs.com/package/@google/genai`                                                                  | Gọi trực tiếp singleton `getGenAIClient().models.generateContentStream` (`[SRC] src/lib/core/genaiClient.ts:48`) trong `novelcrafterStreamRunner.server.ts`.                                                       |
| **Anthropic SDK**                             | `^0.71.2` (`[SRC] package.json:58`)       | `[URL] https://www.npmjs.com/package/@anthropic-ai/sdk`                                                              | Gọi trực tiếp singleton `getClaudeClient().messages.create({ stream: true, ... })` (`[SRC] src/lib/core/claudeClient.ts:19`), không tiêm `code_execution` hay `web_fetch`.                                         |
| **OpenAI SDK (Groq / OpenRouter / DeepSeek)** | `^6.15.0` (`[SRC] package.json:81`)       | `[URL] https://www.npmjs.com/package/openai`                                                                         | Gọi trực tiếp `getGroqClient()` (`[SRC] src/lib/core/groqClient.ts:7`), `getOpenRouterClient()` (`[SRC] src/lib/core/openRouterClient.ts:3`), và `getDeepSeekClient()` (`[SRC] src/lib/core/deepseekClient.ts:3`). |
| **Supabase JS**                               | `^2.89.0` (`[SRC] package.json:66`)       | `[URL] https://supabase.com/docs/reference/javascript/introduction`                                                  | Truy vấn bảng `conversations` và `messages` qua `getSupabaseAdmin()` với JSONB filter `.contains("meta", { novelcrafterType: "story_state" })`.                                                                    |
| **NextAuth v5**                               | `5.0.0-beta.32` (`[SRC] package.json:80`) | `[URL] https://authjs.dev/getting-started/migrating-to-v5`                                                           | Xác thực phiên người dùng qua `auth()` từ `@/lib/features/auth/auth`.                                                                                                                                              |
| **Zod v4**                                    | `^4.2.1` (`[SRC] package.json:94`)        | `[URL] https://zod.dev/v4`                                                                                           | Validate payload của `PUT /api/novelcrafter/state` và `POST /api/novelcrafter/stream`; đọc danh sách lỗi qua `parsed.error.issues` (Zod v4).                                                                       |
| **Tailwind CSS**                              | `^4.1.18` (`[SRC] package.json:122`)      | `[URL] https://tailwindcss.com/docs/functions-and-directives`                                                        | Tuân thủ tuyệt đối cú pháp biến CSS v4 trong `.agents/rules/03-ui.md`: `bg-(--surface)`, `border-(--border)`, `text-(--text-primary)`, v.v.                                                                        |
| **Sudowrite Story Bible Spec**                | Cập nhật `2026-01-13`                     | `[URL] https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC` | Chuẩn hóa 8 nút Story Bible (`Braindump`, `Genre`, `Style`, `Synopsis`, `Characters`, `Worldbuilding`, `Outline`, `Scenes & Draft`), quy tắc fallback `Synopsis -> Braindump`, và `Visibility Settings`.           |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

Mỗi file được thiết kế nghiêm ngặt trong ngưỡng **150–400 dòng/file** theo `.agents/rules/01-coding.md`:

#### 5.1. Core, Limits, Bilingual i18n & Living Docs (`[MODIFY]`)

- `[MODIFY]` `src/lib/utils/constants.ts` (dòng 17–21):
  - Thêm `NOVELCRAFTER: "vikini-novelcrafter"` vào `MODEL_IDS`.
- `[MODIFY]` `src/lib/core/modelRegistry.ts` (dòng 368–397):
  - Cập nhật `isSelectableModelId(modelId: unknown)` (dòng 370) và `normalizeModelForApi(modelId: unknown)` (dòng 383) để chấp nhận và giữ nguyên `MODEL_IDS.NOVELCRAFTER` tương tự `MODEL_IDS.IMAGE_STUDIO`.
- `[MODIFY]` `src/lib/core/modelRegistry.test.ts`:
  - Bổ sung unit test xác minh `isSelectableModelId(MODEL_IDS.NOVELCRAFTER) === true`, `normalizeModelForApi(MODEL_IDS.NOVELCRAFTER) === MODEL_IDS.NOVELCRAFTER`, và `coerceStoredModel(MODEL_IDS.NOVELCRAFTER) === MODEL_IDS.NOVELCRAFTER`.
- `[MODIFY]` `src/lib/core/limits.ts` (dòng 463–511):
  - Trong `isModelAllowedForUser` và `assertModelAllowedForUser`: sau khi kiểm tra `limits.rank !== "not_whitelisted"`, cho phép pseudo-model container `MODEL_IDS.IMAGE_STUDIO` và `MODEL_IDS.NOVELCRAFTER` để `doSaveConversation` (`src/lib/features/chat/conversations.ts:370`) có thể tạo conversation container cho user đã được duyệt (`basic`, `pro`, `admin`), trong khi vẫn chặn `not_whitelisted` (`403 ForbiddenError`).
- `[MODIFY]` `src/lib/core/limits.test.ts`:
  - Bổ sung unit tests xác minh `isModelAllowedForUser` và `assertModelAllowedForUser` với `MODEL_IDS.NOVELCRAFTER` (cho phép với `basic`/`pro`/`admin`, ném `ForbiddenError` với `not_whitelisted`) và chặn model hạng cao (`claude-sonnet-4.5`, `gemini-4-argon`) đối với user hạng `basic`.
- `[MODIFY]` `src/lib/utils/translations/vi.ts` & `[MODIFY]` `src/lib/utils/translations/en.ts`:
  - Bổ sung đầy đủ các khóa dịch song ngữ (`novelcrafter`, `novelcrafterStoryBible`, `novelcrafterChapters`, `novelcrafterAddChapter`, `novelcrafterDeleteChapterConfirm`, `novelcrafterRoutingTitle`, `novelcrafterGenerate`, `novelcrafterRewrite`, `novelcrafterWrite`, `novelcrafterExpand`, `novelcrafterBrainstorm`, v.v.) đảm bảo 100% key parity.
- `[MODIFY]` `docs/CHANGELOG.md`:
  - Cập nhật mục phát hành mới nhất trên đỉnh file `docs/CHANGELOG.md` ghi nhận tính năng Novelcrafter (Story & Script Studio).

#### 5.2. Sidebar & Chat Isolation (`[MODIFY]`)

- `[MODIFY]` `src/app/features/sidebar/components/Sidebar.tsx` (dòng 285–442):
  - Import `BookOpen` từ `lucide-react`.
  - Thêm nút `SidebarButton` cho **Novelcrafter** (`/novelcrafter`) dùng `label={t("novelcrafter")}` nằm **ngay phía trên nút `Image Studio`** (giữa khối `Chat` kết thúc ở dòng 328 và nút `Image Studio` ở dòng 329).
  - Cập nhật điều kiện ẩn `Projects` section và thanh phân cách (dòng 388 và 439) từ `!pathname?.includes("/images")` thành `!pathname?.includes("/images") && !pathname?.includes("/novelcrafter")`.
- `[MODIFY]` `src/app/features/chat/components/hooks/useConversationSelectors.ts` (dòng 31–40):
  - Cập nhật cả `filteredConversations` (dòng 31–35) và `currentConversation` (dòng 37–40) để loại bỏ `c.model !== MODEL_IDS.IMAGE_STUDIO && c.model !== MODEL_IDS.NOVELCRAFTER`, ngăn chặn việc mở nhầm conversation Novelcrafter qua URL `/?id=<novelcrafter-id>` trên trang Chat.
- `[MODIFY]` `src/app/features/chat/components/ChatApp.tsx` (dòng 387):
  - Truyền `conversations={filteredConversations}` thay vì `conversations={conversations || []}` vào `ChatOverlays` để Command Palette trong trang Chat không hiển thị nhầm các item của Image Studio và Novelcrafter.
- `[MODIFY]` `src/app/api/chat-stream/conversationLoader.ts` (dòng 23–35):
  - Bảo toàn `if (err instanceof AppError) throw err;` trong khối `catch`, và nếu `convo && (convo.model === MODEL_IDS.NOVELCRAFTER || convo.model === MODEL_IDS.IMAGE_STUDIO)` thì ném `new ValidationError("Studio conversations cannot be used in chat-stream")` (`400 VALIDATION_ERROR`).

#### 5.3. Business Logic Domain: `src/lib/features/novelcrafter/` (`[NEW]`)

- `[NEW]` `src/lib/features/novelcrafter/types.ts` (~210 dòng):
  - Định nghĩa toàn bộ kiểu dữ liệu TypeScript và Zod v4 schemas chuẩn Sudowrite:
    - `NovelcrafterFeatureKey`: `"bible" | "write" | "rewrite" | "expand" | "brainstorm"` (5 Slot tính năng).
    - `StoryBibleTargetKey`: `"synopsis" | "characters" | "worldbuilding" | "outline" | "scenes" | "draft"` (6 mục có thể Generate/Rewrite trong Slot 1 `bible`).
    - `StoryBibleActionMode`: `"generate" | "rewrite"`.
    - `WriteModeKey`: `"auto" | "guided"` (Slot 2 `write`).
    - `RewritePresetKey`: `"rephrase" | "shorter" | "more_descriptive" | "show_dont_tell" | "more_inner_conflict" | "custom"` (Slot 3 `rewrite`).
    - `ExpandModeKey`: `"expand" | "describe"` và `DescribeSenseKey`: `"sight" | "sound" | "smell" | "taste" | "touch" | "metaphor"` (Slot 4 `expand`).
    - `BrainstormCategoryKey`: `"plot_twists" | "character_names" | "world_objects" | "dialogue" | "scene_ideas"` (Slot 5 `brainstorm`).
    - `StoryBibleData`, `NovelcrafterChapter` (`chapters: z.array(NovelcrafterChapterSchema).min(1).max(100)`), `NovelcrafterRoutingConfig`, `NovelcrafterHistoryCard` (`historyCards: z.array(NovelcrafterHistoryCardSchema).max(50)`), `NovelcrafterStoryState`.
    - Hàm `createDefaultStoryState(defaultModel?: string)` và `sanitizeStoryState(raw: unknown)`.
- `[NEW]` `src/lib/features/novelcrafter/promptBuilder.ts` (~280 dòng):
  - Chứa logic cốt lõi cho **Layered Mode** và **Đồ thị Phụ thuộc 8 Thành phần của Story Bible**:
    - `resolveEffectivePersonaId(feature: NovelcrafterFeatureKey, routing: NovelcrafterRoutingConfig): string | null`
    - `buildNovelcrafterSystemInstruction(params: { masterGemInstructions?: string | null; persona?: PersonaPromptInput | null }): string` — ghép Tầng 1 `<task_instructions>` (Master GEM) và Tầng 2 `<style_preferences>` (Feature Persona qua `buildPersonaSystemPrompt` từ `src/lib/features/personas/prompt-builder.ts:22`), **không cắt ngắn 12.000 ký tự**.
    - `selectStoryBibleDependencies(...)` — trích xuất chính xác các trường nguồn theo Đồ thị Phụ thuộc 8 Thành phần của Sudowrite, tự động áp dụng quy tắc **Fallback `Synopsis -> Braindump`** khi `Synopsis` trống và tôn trọng cờ `charactersVisibleToAI` / `worldbuildingVisibleToAI`.
    - `buildNovelcrafterUserPrompt(params: BuildNovelcrafterUserPromptParams): string` — đóng gói XML `<story_bible>`, `<chapter_context>`, `<selected_text>`, và `<feature_instruction>` cho cả 5 Slot tính năng.
- `[NEW]` `src/lib/features/novelcrafter/storyPersistence.server.ts` (~220 dòng):
  - Server-only persistence cho trạng thái bộ truyện:
    - `verifyNovelcrafterConversationOwnership(userId: string, conversationId: string)`
    - `getStoryState(userId: string, conversationId: string): Promise<NovelcrafterStoryState>`
    - `saveStoryState(userId: string, conversationId: string, state: NovelcrafterStoryState): Promise<NovelcrafterStoryState>` (mã hóa AES-256-GCM 3 phần hex `iv:authTag:encryptedData`, gắn `meta: { novelcrafterType: "story_state", isContextOnly: true, version, updatedAt }`, kiểm tra chống stale overwrite `updatedAt`/`version`, xóa duplicate rows nếu có, và cập nhật `conversations.updated_at` + `invalidateConversationsCache(userId)`).
- `[NEW]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts` (~250 dòng):
  - Stream runner độc lập cho Novelcrafter gọi trực tiếp các singleton clients trong `src/lib/core/` (`getGenAIClient`, `getClaudeClient`, `getGroqClient`, `getOpenRouterClient`, `getDeepSeekClient`), **không import từ `src/app/api/chat-stream/`**, không ghi message phụ vào DB, và phát khung SSE thống nhất (`event: meta|thinking|token|done|error\ndata: {...}\n\n`).
- `[NEW]` `src/lib/features/novelcrafter/promptBuilder.test.ts` (~260 dòng):
  - Co-located unit tests kiểm thử toàn diện Layered Mode, `PersonaPromptInput`, Đồ thị Phụ thuộc 8 Thành phần của Story Bible, quy tắc fallback `Synopsis -> Braindump`, cờ `isVisibleToAI`, và cả 5 Slot tính năng.
- `[NEW]` `src/lib/features/novelcrafter/storyPersistence.server.test.ts` (~220 dòng):
  - Co-located unit tests (khai báo `// @vitest-environment node` ở dòng 1 và khởi tạo `process.env.DATA_ENCRYPTION_KEY` 64 ký tự hex trong `vi.hoisted()`) kiểm thử quyền sở hữu bộ truyện, mã hóa AES-256-GCM thật (`iv:authTag:encryptedData`), bảo toàn JSON khi có thẻ `<think>`, chặn stale overwrite (`updatedAt` lùi), và dọn dẹp duplicate rows.
- `[NEW]` `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts` (~210 dòng):
  - Co-located unit tests (khai báo `// @vitest-environment node`) kiểm thử định tuyến multi-provider (`Gemini`, `Claude`, `DeepSeek`, `Groq`, `OpenRouter`), lắp ghép Master GEM + Feature Persona (bao gồm fallback khi GEM/Persona đã bị xóa), khung SSE wire format (`meta`, `thinking`, `token`, `done`, `error`), và dọn dẹp khi `AbortSignal` kích hoạt mà không ghi bẩn DB.

#### 5.4. API Routes & Co-Located Route Tests (`[NEW]`)

- `[NEW]` `src/app/api/novelcrafter/state/route.ts` (~160 dòng):
  - Khai báo `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;`.
  - `GET /api/novelcrafter/state?conversationId=...` và `PUT /api/novelcrafter/state` (kiểm tra `auth()`, `consumeRateLimit`, `content-length`, Zod v4 `.issues`, `assertModelAllowedForUser(userId, state.selectedModel)`).
- `[NEW]` `src/app/api/novelcrafter/state/route.test.ts` (~190 dòng):
  - Integration tests cho `GET` và `PUT /api/novelcrafter/state`: kiểm thử `401 UNAUTHORIZED`, `429 RATE_LIMITED`, `400 VALIDATION_ERROR` (sai UUID, vượt 100 chapters, stale `updatedAt`), `403 FORBIDDEN` (chọn model vượt rank), và `200 OK`.
- `[NEW]` `src/app/api/novelcrafter/stream/route.ts` (~190 dòng):
  - Khai báo `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 300;`.
  - `POST /api/novelcrafter/stream` (kiểm tra `content-length`, `auth()`, `consumeRateLimit`, `checkDailyMessageLimit` với `403 ACCESS_PENDING` cho `not_whitelisted` và `429 DAILY_LIMIT_EXCEEDED` khi `!canSend`, Zod v4 `.issues`, kiểm tra model thực thi không phải pseudo-model và `assertModelAllowedForUser(userId, model)`, gọi `runNovelcrafterStream` và `incrementDailyMessageCount(userId)`).
- `[NEW]` `src/app/api/novelcrafter/stream/route.test.ts` (~210 dòng):
  - Integration tests cho `POST /api/novelcrafter/stream`: kiểm thử `401 UNAUTHORIZED`, `403 ACCESS_PENDING` (`not_whitelisted`), `429 DAILY_LIMIT_EXCEEDED`, `429 RATE_LIMITED`, `403 FORBIDDEN` (user rank `basic` gửi model `pro`), `400 VALIDATION_ERROR` (thiếu `selectedText` khi `rewrite`/`expand` hoặc gửi `model = "vikini-novelcrafter"`), và `200 OK` SSE stream + `incrementDailyMessageCount`.

#### 5.5. Frontend Feature Module & Route (`[NEW]`)

- `[NEW]` `src/app/novelcrafter/page.tsx` (~25 dòng):
  - Trang Next.js App Router bọc `<Suspense>` và render `<NovelcrafterStudioApp />`.
- `[NEW]` `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts` (~280 dòng):
  - Quản lý danh sách bộ truyện, CRUD Chapters (xóa chương/truyện qua `await confirm({ ... })` từ `@/lib/store/confirmStore`), Story Bible, Routing Config, History Cards, thao tác `applyHistoryCardToStory`, và auto-save debounced (1200ms) cô lập theo `conversationId`.
- `[NEW]` `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts` (~240 dòng):
  - Quản lý kết nối SSE `POST /api/novelcrafter/stream`, parser khung SSE `event: meta|thinking|token|done|error\ndata: {...}\n\n`, `AbortController`, và tạo thẻ `NovelcrafterHistoryCard`.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx` (~280 dòng):
  - Layout tổng thể gồm `Sidebar` (trái), `NovelcrafterTopBar` (trên), và khung 3-Pane Sudowrite sử dụng `useLanguage()` (`t("...")`) và `useConfirmStore`.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx` (~190 dòng):
  - Tiêu đề bộ truyện, AI Model Selector (lọc qua `useAllowedModels`), huy hiệu **👑 Master GEM**, huy hiệu **🎭 Master Persona**, trạng thái lưu, và nút mở Modal **⚙️ GEM & Persona Routing**.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx` (~230 dòng):
  - Quản lý danh sách `Chapters (Documents)` (thêm, chọn, đổi tên, xóa qua `await confirm({ ... })` từ `@/lib/store/confirmStore`, đếm từ) và thanh bật/tắt **📘 Story Bible** nằm ngay dưới danh sách tài liệu kèm danh mục nhảy nhanh tới 7 trường của Story Bible (`Braindump`, `Genre`, `Style`, `Synopsis`, `Characters`, `Worldbuilding`, `Outline`).
- `[NEW]` `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx` (~290 dòng):
  - Hiển thị persistent bên dưới phần Prose của chương khi `isStoryBibleOpen = true`:
    - Các trường nhập thủ công: **Braindump**, **Genre**, **Style (POV / Tense / Tone)**.
    - Các trường có cặp nút **✨ Generate** & **🔄 Rewrite**: **Synopsis** (`Braindump + Genre`), **Characters** (`Synopsis` + nút bật/tắt mắt `Visible to AI`), **Worldbuilding** (`Synopsis` + nút bật/tắt mắt `Visible to AI`), và **Outline** (`Genre + Synopsis + Characters + Worldbuilding`).
- `[NEW]` `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx` (~330 dòng):
  - Phần đầu của Center Pane cho Chapter đang chọn:
    - Thanh **Sudowrite AI Toolbar** cho 4 công cụ biên tập chương:
      - **Slot 2 (`✍️ Write`)**: _Auto Write_ & _Guided Write_.
      - **Slot 3 (`🛠️ Rewrite`)**: Selection menu khi bôi đen (_Rephrase_, _Shorter_, _More descriptive_, _Show don't tell_, _More inner conflict_, _Customize_).
      - **Slot 4 (`🔍 Expand & Describe`)**: _Expand_ đoạn ngắn; hoặc _Describe_ với bộ chọn đa giác quan (_Sight, Sound, Smell, Taste, Touch, Metaphor_).
      - **Slot 5 (`💡 Brainstorm`)**: Chọn chủ đề (_Plot twists_, _Character names_, _World objects_, _Dialogue_, _Scene ideas_) kèm định hướng tùy chọn.
    - Trình soạn thảo **Chapter Prose Editor** (theo dõi bôi đen văn bản, đếm số từ).
    - Khung **🎬 Scenes (Chapter Beats) & First Draft** nằm ngay dưới Chapter Prose (và ngay trên Story Bible): có nút **✨ Generate Scenes** & **🔄 Rewrite Scenes** và nút **📝 Generate First Draft**.
- `[NEW]` `src/app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx` (~250 dòng):
  - Hiển thị thẻ đang stream và danh sách thẻ lịch sử AI với các nút `[⬅️ Append to Chapter]`, `[🔄 Replace Selection]`, `[📥 Apply to Target Section]` (khi thẻ thuộc Slot 1 `bible`), `[📋 Copy]`, `[🗑️ Delete Card]`.
- `[NEW]` `src/app/features/novelcrafter/components/GemPersonaRoutingModal.tsx` (~260 dòng):
  - Cấu hình **👑 Master GEM**, **🎭 Master Persona**, và **5 Feature Persona Slots** (`bible`, `write`, `rewrite`, `expand`, `brainstorm`).

---

### 6. Các Bước Thực Hiện Tuần Tự (Step-by-Step Implementation Checklist)

#### Bước 1: Mở rộng Hằng số, Model Registry & Rank Model Guard cho `MODEL_IDS.NOVELCRAFTER`

- [ ] **1.1.** Trong `src/lib/utils/constants.ts` (dòng 17–21), thêm `NOVELCRAFTER: "vikini-novelcrafter"` vào object `MODEL_IDS`.
- [ ] **1.2.** Trong `src/lib/core/modelRegistry.ts`:
  - Tại `isSelectableModelId(modelId: unknown)` (dòng 368–372): cập nhật thành `if (m === MODEL_IDS.IMAGE_STUDIO || m === MODEL_IDS.NOVELCRAFTER) return true;`.
  - Tại `normalizeModelForApi(modelId: unknown)` (dòng 379–385): cập nhật thành `if (raw === MODEL_IDS.IMAGE_STUDIO || raw === MODEL_IDS.NOVELCRAFTER) return raw;`.
- [ ] **1.3.** Trong `src/lib/core/limits.ts` (dòng 463–511):
  - Tại `isModelAllowedForUser(userId, model)` và `assertModelAllowedForUser(userId, model)`: sau khi kiểm tra `limits.rank === "not_whitelisted"` (trả `false` hoặc ném `ForbiddenError`), bổ sung kiểm tra:
    ```ts
    if (normalizedModel === MODEL_IDS.IMAGE_STUDIO || normalizedModel === MODEL_IDS.NOVELCRAFTER) {
      return; // (hoặc return true trong isModelAllowedForUser)
    }
    ```
    để `doSaveConversation` (`src/lib/features/chat/conversations.ts:370`) cho phép user đã được duyệt (`basic`, `pro`, `admin`) tạo conversation container của Novelcrafter, đồng thời vẫn chặn `not_whitelisted` (`403 ForbiddenError`).
- [ ] **1.4.** Cập nhật `src/lib/core/modelRegistry.test.ts` và `src/lib/core/limits.test.ts` để kiểm thử đầy đủ `MODEL_IDS.NOVELCRAFTER`.

#### Bước 2: Cập nhật Sidebar, Cô lập Lịch sử Chat & Hệ thống Dịch Song ngữ (`vi.ts` / `en.ts`)

- [ ] **2.1.** Trong `src/app/features/sidebar/components/Sidebar.tsx`:
  - Import `BookOpen` từ `lucide-react`.
  - Chèn `SidebarButton` cho **Novelcrafter** (`label={t("novelcrafter")}`) ngay trước nút `Image Studio` (dòng 329).
  - Cập nhật điều kiện ẩn `Projects` section (dòng 388) và divider (dòng 439) thành `!pathname?.includes("/images") && !pathname?.includes("/novelcrafter")`.
- [ ] **2.2.** Trong `src/app/features/chat/components/hooks/useConversationSelectors.ts` (dòng 31–40):
  - Cập nhật `filteredConversations` để loại bỏ cả `MODEL_IDS.IMAGE_STUDIO` và `MODEL_IDS.NOVELCRAFTER`.
  - Cập nhật `currentConversation` để loại bỏ cả `MODEL_IDS.IMAGE_STUDIO` và `MODEL_IDS.NOVELCRAFTER` (tránh mở nhầm conversation Novelcrafter qua `/?id=<novelcrafter-id>` trên Main Chat).
- [ ] **2.3.** Trong `src/app/features/chat/components/ChatApp.tsx` (dòng 387), truyền `conversations={filteredConversations}` vào `<ChatOverlays />`.
- [ ] **2.4.** Trong `src/app/api/chat-stream/conversationLoader.ts` (dòng 23–35):
  - Đảm bảo `if (err instanceof AppError) throw err;` trong khối `catch`, và nếu `convo && (convo.model === MODEL_IDS.NOVELCRAFTER || convo.model === MODEL_IDS.IMAGE_STUDIO)` thì ném `new ValidationError("Studio conversations cannot be used in chat-stream")` (`400 VALIDATION_ERROR`).
- [ ] **2.5.** Trong `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`:
  - Bổ sung đồng bộ 100% các khóa dịch song ngữ cho Novelcrafter (Sidebar label, TopBar badges, Story Bible sections, Generate/Rewrite buttons, Chapter Editor toolbar, History Cards actions, Routing Modal, và thông báo lỗi/xác nhận xóa).

#### Bước 3: Xây dựng Domain Types & Zod v4 Schemas (`src/lib/features/novelcrafter/types.ts`)

- [ ] **3.1.** Tạo `src/lib/features/novelcrafter/types.ts` định nghĩa đầy đủ 8 thành phần của Story Bible & Chapter theo tài liệu Sudowrite và Zod v4:
  - `StoryBibleSchema`:
    ```ts
    {
      braindump: z.string().max(50_000),
      genre: z.string().max(2_000),
      style: z.string().max(10_000),
      synopsis: z.string().max(30_000),
      characters: z.string().max(50_000),
      charactersVisibleToAI: z.boolean().default(true),
      worldbuilding: z.string().max(50_000),
      worldbuildingVisibleToAI: z.boolean().default(true),
      outline: z.string().max(50_000),
    }
    ```
  - `NovelcrafterChapterSchema`:
    ```ts
    {
      id: z.string().min(1).max(100),
      title: z.string().min(1).max(200),
      scenes: z.string().max(30_000),  // Chapter Beats / Scene Outline
      content: z.string().max(150_000), // Chapter Prose / Draft
      updatedAt: z.number().int().nonnegative(),
    }
    ```
  - `NovelcrafterStoryStateSchema`:
    - `version: z.number().int().nonnegative()`
    - `selectedModel: z.string().min(1).max(100)`
    - `isStoryBibleOpen: z.boolean().default(true)`
    - `activeChapterId: z.string().min(1).max(100)`
    - `storyBible: StoryBibleSchema`
    - `chapters: z.array(NovelcrafterChapterSchema).min(1).max(100)` _(giới hạn cứng tối đa 100 chương)_
    - `routing: NovelcrafterRoutingConfigSchema` (1 Master GEM + 1 Master Persona + 5 Feature Slots: `bible`, `write`, `rewrite`, `expand`, `brainstorm`)
    - `historyCards: z.array(NovelcrafterHistoryCardSchema).max(50)` _(giới hạn cứng tối đa 50 thẻ)_
    - `updatedAt: z.number().int().nonnegative()`

#### Bước 4: Xây dựng Layered Mode & Đồ thị Phụ thuộc 8 Thành phần (`src/lib/features/novelcrafter/promptBuilder.ts`)

- [ ] **4.1.** Triển khai `resolveEffectivePersonaId(feature, routing)` và `buildNovelcrafterSystemInstruction({ masterGemInstructions, persona })`:
  - Tầng 1 (`<task_instructions>`): Lệnh hệ thống từ Master GEM (hoặc hướng dẫn mặc định của Novelcrafter Studio nếu `masterGemInstructions` trống).
  - Tầng 2 (`<style_preferences>`): Nếu có `persona` (kiểu `PersonaPromptInput`: `{ tone, useEmojis, useHeadersLists, userContext, customInstructions }` từ `src/lib/features/personas/prompt-builder.ts:22-28`), gọi `buildPersonaSystemPrompt(persona)` và bọc trong `<style_preferences>` kèm chỉ dẫn ưu tiên `<task_instructions>`.
  - **Không áp dụng cắt ngắn 12.000 ký tự (`MAX_SYSTEM_PROMPT_CHARS`)**.
- [ ] **4.2.** Triển khai `selectStoryBibleDependencies` và `buildNovelcrafterUserPrompt` tuân thủ chính xác **Đồ thị Phụ thuộc 8 Thành phần của Sudowrite**:
  - **Quy tắc Fallback `Synopsis -> Braindump`**: `effectiveSynopsis = storyBible.synopsis.trim() || storyBible.braindump.trim()`. Mọi bước cần `Synopsis` (`Characters`, `Worldbuilding`, `Outline`, `Scenes`) nếu `synopsis` trống sẽ tự động dùng `braindump` với nhãn `<synopsis fallback="braindump">`.
  - **Quy tắc `Visibility Settings`**: Chỉ đưa `characters` vào prompt khi `storyBible.charactersVisibleToAI !== false` và chỉ đưa `worldbuilding` vào prompt khi `storyBible.worldbuildingVisibleToAI !== false`.
  - **Ánh xạ nguồn dữ liệu cho từng hành động**:
    - **Slot 1 (`bible`)**:
      - `bibleTarget = "synopsis"`: Chỉ truyền `Braindump + Genre` (+ `Synopsis` hiện tại nếu `actionMode === "rewrite"`).
      - `bibleTarget = "characters"`: Chỉ truyền `effectiveSynopsis` (+ `Characters` hiện tại nếu `actionMode === "rewrite"`).
      - `bibleTarget = "worldbuilding"`: Chỉ truyền `effectiveSynopsis` (+ `Worldbuilding` hiện tại nếu `actionMode === "rewrite"`).
      - `bibleTarget = "outline"`: Truyền `Genre + effectiveSynopsis + Characters (visible) + Worldbuilding (visible)` (+ `Outline` hiện tại nếu `actionMode === "rewrite"`).
      - `bibleTarget = "scenes"` (Chapter Beats): Truyền `Genre + Style + effectiveSynopsis + Outline + Characters (visible) + Worldbuilding (visible) + Previous Chapter Continuity` (+ `Scenes` hiện tại của chương nếu `actionMode === "rewrite"`).
      - `bibleTarget = "draft"` (First Draft Prose): Truyền `Style + Genre + Characters (visible) + Worldbuilding (visible) + Chapter Scenes` (+ chỉ dẫn bổ sung nếu có).
    - **Slot 2 (`write` — Auto Write / Guided Write)**: Truyền `Style + Genre + Characters (visible) + Worldbuilding (visible) + Chapter Scenes` + cửa sổ `8.000` ký tự cuối của `Chapter Prose` hiện tại + chỉ dẫn `guided`.
    - **Slot 3 (`rewrite` — Selection Menu)**: Truyền `Style + Genre` + ngữ cảnh chương xung quanh đoạn bôi đen + `<selected_text>` + chỉ dẫn theo đúng 6 chế độ Sudowrite (`rephrase`, `shorter`, `more_descriptive`, `show_dont_tell`, `more_inner_conflict`, `custom`).
    - **Slot 4 (`expand` — Expand & Describe)**: Truyền `Style + Genre + Characters (visible) + Worldbuilding (visible)` + ngữ cảnh chương + `<selected_text>` + chỉ dẫn _Expand_ hoặc _Describe_ (`sight`, `sound`, `smell`, `taste`, `touch`, `metaphor`).
    - **Slot 5 (`brainstorm`)**: Truyền `Genre + effectiveSynopsis + Characters (visible) + Worldbuilding (visible) + Chapter Scenes` + yêu cầu gợi ý 5 ý tưởng theo danh mục (`plot_twists`, `character_names`, `world_objects`, `dialogue`, `scene_ideas`).

#### Bước 5: Xây dựng Encrypted Story State Persistence & Standalone Multi-Provider Stream Runner

- [ ] **5.1.** Tạo `src/lib/features/novelcrafter/storyPersistence.server.ts`:
  - Sử dụng `getSupabaseAdmin()` (`src/lib/core/supabase.server.ts`), `encryptText` / `decryptText` (`src/lib/core/encryption.ts:52,75`, định dạng `iv:authTag:encryptedData`), và `invalidateConversationsCache` (`src/lib/features/chat/conversations.ts:116`).
  - Trong `saveStoryState(userId, conversationId, state)`:
    - Kiểm tra `verifyNovelcrafterConversationOwnership(userId, conversationId)`.
    - Đọc các bản ghi `messages` có `conversation_id = conversationId` và `meta->>novelcrafterType = 'story_state'` sắp xếp theo `created_at DESC`.
    - Giải mã bản ghi mới nhất (`existingState`): nếu `state.updatedAt < existingState.updatedAt` hoặc `state.version < existingState.version`, ném `ValidationError("Stale story state rejected")` để chống ghi đè lùi.
    - Gán `nextVersion = Math.max(state.version, existingState?.version ?? 0) + 1`, `nextUpdatedAt = Math.max(state.updatedAt, Date.now())`, cắt `historyCards` tối đa 50 thẻ, mã hóa bằng `encryptText(JSON.stringify(nextState))`, lưu với `role = "system"`, `meta = { novelcrafterType: "story_state", isContextOnly: true, version: nextVersion, updatedAt: nextUpdatedAt }`.
    - Xóa các row `story_state` cũ dư thừa nếu `rows.length > 1`, cập nhật `conversations.updated_at = new Date().toISOString()`, và gọi `await invalidateConversationsCache(userId)`.
- [ ] **5.2.** Tạo `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`:
  - **Tuyệt đối không import từ `src/app/api/chat-stream/`**. Gọi trực tiếp các singleton clients trong `src/lib/core/`:
    - Gemini (`getGenAIClient().models.generateContentStream` từ `@/lib/core/genaiClient`)
    - Claude (`getClaudeClient().messages.create({ stream: true, ... })` từ `@/lib/core/claudeClient`, không tiêm `code_execution` hay `web_fetch`)
    - DeepSeek (`getDeepSeekClient().chat.completions.create({ stream: true, ... })` từ `@/lib/core/deepseekClient`)
    - Groq (`getGroqClient().chat.completions.create({ stream: true, ... })` từ `@/lib/core/groqClient`)
    - OpenRouter (`getOpenRouterClient().chat.completions.create({ stream: true, ... })` từ `@/lib/core/openRouterClient`)
  - Tải `Master GEM` từ `getGemsForUser(userId)` và `Persona` từ `getPersonasForUser(userId)`, ánh xạ `Persona` sang `PersonaPromptInput` (`{ tone: p.tone, useEmojis: p.useEmojis, useHeadersLists: p.useHeadersLists, userContext: p.userContext, customInstructions: p.customInstructions }`). Nếu ID không tồn tại, fallback về `null`.
  - Định nghĩa helper `formatSseEvent(event: string, data: unknown): Uint8Array` xuất đúng khung chuẩn:
    - `event: meta\ndata: {"model":"...","gemName":...,"personaName":...,"feature":"..."}\n\n`
    - `event: thinking\ndata: {"t":"..."}\n\n`
    - `event: token\ndata: {"t":"..."}\n\n`
    - `event: done\ndata: {"model":"...","feature":"..."}\n\n`
    - `event: error\ndata: {"message":"...","code":"..."}\n\n`
  - Lắng nghe `signal?.aborted` để dừng vòng lặp đọc stream ngay lập tức mà không ghi bất kỳ message nào vào DB.

#### Bước 6: Xây dựng API Routes (`/api/novelcrafter/state` và `/api/novelcrafter/stream`)

- [ ] **6.1.** Tạo `src/app/api/novelcrafter/state/route.ts`:
  - Khai báo `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;`.
  - `GET` & `PUT`: kiểm tra `auth()`, `consumeRateLimit(\`novelcrafter-state:\${userId}\`)`, `content-length`(tối đa`2MB`trên`PUT`), parse Zod v4 schema (dùng `parsed.error.issues`), kiểm tra `state.selectedModel`không phải pseudo-model và gọi`await assertModelAllowedForUser(userId, state.selectedModel)`trước khi gọi`saveStoryState`.
- [ ] **6.2.** Tạo `src/app/api/novelcrafter/stream/route.ts`:
  - Khai báo `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 300;`.
  - `POST`: kiểm tra `content-length` (tối đa `1MB`), `auth()`, `consumeRateLimit(\`novelcrafter-stream:\${userId}\`)`, `checkDailyMessageLimit(userId)`(nếu`rank === "not_whitelisted"`trả`403 ACCESS_PENDING`; nếu `!canSend`trả`429 DAILY_LIMIT_EXCEEDED`), validate body bằng Zod v4 (`parsed.error.issues`), kiểm tra `requestedModel`nằm trong`MODEL_REGISTRY`(không phải`MODEL_IDS.NOVELCRAFTER`hay`MODEL_IDS.IMAGE_STUDIO`) và gọi `await assertModelAllowedForUser(userId, requestedModel)`, kiểm tra `verifyNovelcrafterConversationOwnership(userId, conversationId)`, khởi tạo `ReadableStream`qua`runNovelcrafterStream`và gọi`await incrementDailyMessageCount(userId)` khi khởi tạo thành công.

#### Bước 7: Xây dựng Giao diện 3-Pane & Persistent Story Bible (`src/app/features/novelcrafter/` & `src/app/novelcrafter/page.tsx`)

- [ ] **7.1.** Tạo `useNovelcrafterStory.ts` (sử dụng `useConfirmStore` từ `@/lib/store/confirmStore` khi xóa chương/bộ truyện, auto-save debounced cô lập theo `conversationId`) và `useNovelcrafterStream.ts` (parse khung SSE `event: meta|thinking|token|done|error\ndata: {...}\n\n`).
- [ ] **7.2.** Tạo bộ components chuẩn `.agents/rules/03-ui.md` và `.agents/rules/04-bilingual.md` (`useLanguage()`):
  - `NovelcrafterTopBar.tsx`
  - `NovelcrafterLeftNavigator.tsx`
  - `ChapterEditorWorkspace.tsx`
  - `StoryBibleWorkspace.tsx`
  - `NovelcrafterHistoryPane.tsx`
  - `GemPersonaRoutingModal.tsx`
  - `NovelcrafterStudioApp.tsx`
- [ ] **7.3.** Tạo route page `src/app/novelcrafter/page.tsx`.

#### Bước 8: Viết Co-Located Unit/Integration Tests, Cập nhật Living Docs & Kiểm định Chất lượng

- [ ] **8.1.** Viết đầy đủ co-located unit tests và API integration tests:
  - `src/lib/core/modelRegistry.test.ts` (`[MODIFY]`)
  - `src/lib/core/limits.test.ts` (`[MODIFY]`)
  - `src/lib/features/novelcrafter/promptBuilder.test.ts` (`[NEW]`)
  - `src/lib/features/novelcrafter/storyPersistence.server.test.ts` (`[NEW]` — có `// @vitest-environment node` và `vi.hoisted()` thiết lập `process.env.DATA_ENCRYPTION_KEY`)
  - `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts` (`[NEW]` — có `// @vitest-environment node`)
  - `src/app/api/novelcrafter/state/route.test.ts` (`[NEW]`)
  - `src/app/api/novelcrafter/stream/route.test.ts` (`[NEW]`)
- [ ] **8.2.** Cập nhật `docs/CHANGELOG.md` ghi nhận tính năng Novelcrafter Studio.
- [ ] **8.3.** Chạy `npm run verify` (`type-check && lint && test:run`) đảm bảo 0 lỗi TypeScript, 0 lỗi ESLint, và 100% test suites pass.

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Để `@qa` kiểm chứng độc lập và chống _specification gaming_, hệ thống phải thỏa mãn hợp đồng kiểm thử sau:

| ID        | Thành phần / Hàm mục tiêu                                                                                                                                  | Input (Đầu vào)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Expected Output (Đầu ra mong đợi)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Failure Modes / Error Messages & Boundary Conditions                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01** | `modelRegistry.ts` & `limits.ts`: `isSelectableModelId`, `normalizeModelForApi`, `coerceStoredModel`, `isModelAllowedForUser`, `assertModelAllowedForUser` | `MODEL_IDS.NOVELCRAFTER` (`"vikini-novelcrafter"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                 | - `isSelectableModelId`, `normalizeModelForApi`, `coerceStoredModel` giữ nguyên `"vikini-novelcrafter"`.<br>- `isModelAllowedForUser` / `assertModelAllowedForUser` cho phép `"vikini-novelcrafter"` với user hạng `basic`, `pro`, `admin`.                                                                                                                                                                                                                                                                                                                                                                                                              | - User có `rank === "not_whitelisted"` gọi `assertModelAllowedForUser(userId, "vikini-novelcrafter")` -> ném `ForbiddenError`.<br>- User hạng `basic` gọi `assertModelAllowedForUser(userId, "claude-sonnet-4.5")` -> ném `ForbiddenError`.                                                                                                                                                                                                                      |
| **TC-02** | `promptBuilder.ts`: `resolveEffectivePersonaId(feature, routing)`                                                                                          | - Case A: `slot = "inherit"`, `masterPersonaId = "p-master"`<br>- Case B: `slot = "none"`, `masterPersonaId = "p-master"`<br>- Case C: `slot = "p-custom"`, `masterPersonaId = "p-master"`                                                                                                                                                                                                                                                                                                         | - Case A: `"p-master"`<br>- Case B: `null`<br>- Case C: `"p-custom"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Nếu `slot = "inherit"` nhưng `masterPersonaId = null` hoặc `""`, phải trả về `null`.                                                                                                                                                                                                                                                                                                                                                                             |
| **TC-03** | `promptBuilder.ts`: `buildNovelcrafterSystemInstruction`                                                                                                   | `masterGemInstructions` dài 15.000 ký tự + `persona: PersonaPromptInput` hợp lệ (`{ tone: "candid", useEmojis: false, useHeadersLists: true, userContext: "Sci-fi novelist", customInstructions: "Use vivid sensory verbs" }`).                                                                                                                                                                                                                                                                    | Chuỗi trả về chứa đầy đủ `<task_instructions>` (nằm trước) và `<style_preferences>` (nằm sau, chứa đầu ra của `buildPersonaSystemPrompt(persona)` kèm câu cảnh báo không được ghi đè `<task_instructions>`). Tổng độ dài `> 15.000` ký tự (không bị cắt ở 12.000 ký tự).                                                                                                                                                                                                                                                                                                                                                                                 | Nếu `persona = null`, không sinh thẻ `<style_preferences>`. Nếu `masterGemInstructions` rỗng/null, vẫn sinh `<task_instructions>` chứa hướng dẫn mặc định của Novelcrafter Studio.                                                                                                                                                                                                                                                                               |
| **TC-04** | `promptBuilder.ts`: `selectStoryBibleDependencies` & `buildNovelcrafterUserPrompt` (Sudowrite 8-Node Dependency Graph)                                     | - **Case 4A (`bibleTarget = "synopsis"`, `generate`)**: `storyBible` có cả 7 trường.<br>- **Case 4B (`bibleTarget = "characters"`, `generate`, `synopsis = ""`, `braindump = "Seed idea"`)**: Kiểm tra fallback.<br>- **Case 4C (`bibleTarget = "outline"`, `charactersVisibleToAI = false`)**: Kiểm tra Visibility Settings.<br>- **Case 4D (`bibleTarget = "draft"`)**: Kiểm tra nguồn sinh Draft.<br>- **Case 4E (`feature = "rewrite"` hoặc `"expand"`)**: Đoạn văn bôi đen + ngữ cảnh chương. | - **Case 4A**: `<story_bible>` chỉ chứa `braindump` và `genre` (không chứa `characters`/`worldbuilding`/`outline`).<br>- **Case 4B**: Tự động fallback lấy `braindump` ("Seed idea") làm nguồn thay cho `synopsis` trống.<br>- **Case 4C**: `<story_bible>` chứa `genre`, `synopsis`, `worldbuilding`, nhưng **tuyệt đối không chứa `characters`** vì `charactersVisibleToAI === false`.<br>- **Case 4D**: `<story_bible>` chứa `style`, `genre`, `characters`, `worldbuilding` và `<chapter_context>` chứa `scenes` (không chứa `braindump` hay `outline`).<br>- **Case 4E**: Chứa `<selected_text>` và `<chapter_context>` (cắt tối đa `8.000` ký tự). | Khi `feature === "rewrite"` hoặc `"expand"` (hoặc `actionMode === "rewrite"` trong Story Bible mà nội dung mục đích đang trống và không có `rewriteInstruction`) -> ném lỗi `ValidationError` rõ ràng.                                                                                                                                                                                                                                                           |
| **TC-05** | `storyPersistence.server.ts`: `getStoryState` & `saveStoryState` (chạy trên `// @vitest-environment node`)                                                 | - `userId`, `conversationId` hợp lệ.<br>- `state` có nội dung chương chứa thẻ `<think>unclosed thought` và ký tự Unicode tiếng Việt.                                                                                                                                                                                                                                                                                                                                                               | - `saveStoryState` mã hóa AES-256-GCM qua `encryptText()` thành chuỗi 3 phần hex `iv:authTag:encryptedData` (`parts.length === 3`, `parts[0].length === 24`, `parts[1].length === 32`) và lưu vào bảng `messages` với `meta: { novelcrafterType: "story_state", isContextOnly: true, version, updatedAt }`.<br>- `getStoryState` giải mã qua `decryptText()` và trả về đúng object ban đầu 100%, không bị nối thêm `</think>` làm hỏng `JSON.parse()`.                                                                                                                                                                                                   | - `conversationId` sai định dạng UUID -> ném `ValidationError("Invalid conversationId")`.<br>- `conversation.user_id !== userId` hoặc `conversation.model !== "vikini-novelcrafter"` -> ném `NotFoundError("Story not found")`.<br>- Request lưu state cũ (`state.updatedAt < existing.updatedAt`) -> ném `ValidationError("Stale story state rejected")`.<br>- Nếu DB có 2 bản ghi `story_state` trùng lặp -> cập nhật bản ghi mới nhất và xóa bản ghi dư thừa. |
| **TC-06** | `novelcrafterStreamRunner.server.ts` (`novelcrafterStreamRunner.server.test.ts` trên `// @vitest-environment node`)                                        | Yêu cầu stream với model Gemini / Claude / OpenAI-compatible + `AbortSignal`.                                                                                                                                                                                                                                                                                                                                                                                                                      | Phát đúng trình tự khung SSE `event: meta\ndata: {...}\n\n`, `event: thinking\ndata: {"t":"..."}\n\n`, `event: token\ndata: {"t":"..."}\n\n`, `event: done\ndata: {...}\n\n`. Không gọi bất kỳ lệnh ghi bảng `messages` hay đổi tên `conversations` nào.                                                                                                                                                                                                                                                                                                                                                                                                 | Khi `AbortSignal` kích hoạt giữa chừng -> dừng vòng lặp stream ngay lập tức và đóng stream sạch sẽ. Khi provider ném lỗi -> phát `event: error\ndata: {"message":"...","code":"STREAM_ERROR"}\n\n`.                                                                                                                                                                                                                                                              |
| **TC-07** | API `/api/novelcrafter/state` & `/api/novelcrafter/stream` (`route.test.ts`)                                                                               | Request từ client với các trạng thái auth, rank, quota và Zod payload khác nhau.                                                                                                                                                                                                                                                                                                                                                                                                                   | - Chưa đăng nhập -> `401 UNAUTHORIZED`.<br>- `rank === "not_whitelisted"` -> `403 ACCESS_PENDING`.<br>- Hết quota ngày (`!canSend`) -> `429 DAILY_LIMIT_EXCEEDED`.<br>- Vượt rate limit -> `429 RATE_LIMITED`.<br>- User hạng `basic` gửi model hạng `pro` -> `403 FORBIDDEN`.<br>- Sai UUID, vượt 100 chapters, hoặc thiếu `selectedText` khi `rewrite`/`expand` -> `400 VALIDATION_ERROR` (đọc từ `zodError.issues`).<br>- Hợp lệ -> `200 OK` (JSON cho `/state`, `text/event-stream` cho `/stream` kèm `incrementDailyMessageCount`).                                                                                                                 | Gửi `model = "vikini-novelcrafter"` làm model sinh văn bản vào `/api/novelcrafter/stream` -> bị chặn với `400 VALIDATION_ERROR`.                                                                                                                                                                                                                                                                                                                                 |

**Tiêu chí Pass/Fail Chống Specification Gaming cho `@qa`**:

1. Mọi test case phải import và gọi trực tiếp hàm thật trong `src/lib/core/modelRegistry.ts`, `src/lib/core/limits.ts`, `src/lib/features/novelcrafter/promptBuilder.ts`, `src/lib/features/novelcrafter/storyPersistence.server.ts`, `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`, và 2 route handlers (cấm tạo hàm giả lập kết quả).
2. Kiểm tra `storyPersistence.server.test.ts` xác nhận sử dụng `encryptText` / `decryptText` thật từ `src/lib/core/encryption.ts` trên môi trường `// @vitest-environment node` (cấm mock `encryptText` trả về plaintext).
3. Kiểm tra `novelcrafterStreamRunner.server.ts` xác nhận không có câu lệnh `import` nào trỏ vào `src/app/api/chat-stream/`.
4. Kiểm tra `src/lib/utils/translations/index.test.ts` pass 100% key parity giữa `vi.ts` và `en.ts`.
5. Kiểm tra mã nguồn xác nhận không có bất kỳ tham chiếu nào tới tính năng `Image Prompt` trong `src/lib/features/novelcrafter/` hay `src/app/features/novelcrafter/`, không dùng `window.confirm()`, và nút `Novelcrafter` trên `Sidebar.tsx` nằm ngay phía trên `Image Studio`.

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 8.1. Danh sách File Test Co-Located

1. `src/lib/core/modelRegistry.test.ts` (`[MODIFY]`): Kiểm thử đăng ký `MODEL_IDS.NOVELCRAFTER`.
2. `src/lib/core/limits.test.ts` (`[MODIFY]`): Kiểm thử `isModelAllowedForUser` & `assertModelAllowedForUser` cho `MODEL_IDS.NOVELCRAFTER` và chặn vượt quyền model theo rank.
3. `src/lib/utils/translations/index.test.ts` (Existing test): Kiểm thử key parity giữa `vi.ts` và `en.ts`.
4. `src/lib/features/novelcrafter/promptBuilder.test.ts` (`[NEW]`): Kiểm thử toàn diện Layered Mode (`resolveEffectivePersonaId`, `buildNovelcrafterSystemInstruction` với `PersonaPromptInput`) và Đồ thị Phụ thuộc 8 Thành phần của Story Bible (`selectStoryBibleDependencies`, `buildNovelcrafterUserPrompt`, `sanitizeStoryState`).
5. `src/lib/features/novelcrafter/storyPersistence.server.test.ts` (`[NEW]`, `// @vitest-environment node`): Kiểm thử quyền sở hữu bộ truyện, mã hóa/giải mã AES-256-GCM thật (`iv:authTag:encryptedData`), bảo toàn JSON khi nội dung có thẻ `<think>`, chặn stale overwrite (`updatedAt` lùi), và tự động dọn dẹp duplicate rows.
6. `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts` (`[NEW]`, `// @vitest-environment node`): Kiểm thử stream runner độc lập với các singleton clients, khung SSE wire format, và hủy stream qua `AbortSignal`.
7. `src/app/api/novelcrafter/state/route.test.ts` (`[NEW]`): Integration tests cho `GET` và `PUT /api/novelcrafter/state`.
8. `src/app/api/novelcrafter/stream/route.test.ts` (`[NEW]`): Integration tests cho `POST /api/novelcrafter/stream`.

#### 8.2. Lệnh Chạy Kiểm Thử & Xác Minh Chất Lượng

- Chạy bộ unit & integration tests của Novelcrafter:
  ```powershell
  npx vitest run src/lib/core/modelRegistry.test.ts src/lib/core/limits.test.ts src/lib/utils/translations/index.test.ts src/lib/features/novelcrafter/promptBuilder.test.ts src/lib/features/novelcrafter/storyPersistence.server.test.ts src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts src/app/api/novelcrafter/state/route.test.ts src/app/api/novelcrafter/stream/route.test.ts
  ```
- Chạy toàn bộ cổng kiểm định chất lượng bắt buộc của dự án:
  ```powershell
  npm run verify
  ```
  _(Thực thi tuần tự `npm run type-check && npm run lint && npm run test:run`)._

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro tiềm ẩn                                                                                                                                                               | Mức độ     | Phương án phòng ngừa & Kiểm soát kỹ thuật trong Code (Technical Control)                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1. `saveConversation` hoặc `mapConversationRow` ghi đè `model = "vikini-novelcrafter"` thành `"gemini-2.5-flash"`, hoặc `assertModelAllowedForUser` chặn tạo truyện mới** | Cao        | Bổ sung `MODEL_IDS.NOVELCRAFTER` vào `isSelectableModelId` (`src/lib/core/modelRegistry.ts:370`), `normalizeModelForApi` (`src/lib/core/modelRegistry.ts:383`), và `isModelAllowedForUser` / `assertModelAllowedForUser` (`src/lib/core/limits.ts:463-511`).                                                    |
| **R2. Chuỗi JSON trạng thái truyện bị hỏng khi chứa thẻ `<think>` chưa đóng hoặc rò rỉ vào luồng Chat**                                                                      | Cao        | Không dùng `upsertMessage` của Chat. Sử dụng `storyPersistence.server.ts` mã hóa AES-256-GCM trực tiếp (`iv:authTag:encryptedData`) với `meta: { novelcrafterType: "story_state", isContextOnly: true }`, đồng thời chặn `MODEL_IDS.NOVELCRAFTER` tại `useConversationSelectors.ts` và `conversationLoader.ts`. |
| **R3. Vi phạm kiến trúc và side-effects ghi bẩn DB nếu dùng chung stream handler của `/api/chat-stream`**                                                                    | Cao        | Xây dựng `novelcrafterStreamRunner.server.ts` độc lập trong `src/lib/features/novelcrafter/` gọi trực tiếp các singleton clients trong `src/lib/core/`, không gọi `savePartialOnce()` hay `processPostStream()`.                                                                                                |
| **R4. User hạng `basic` hoặc `not_whitelisted` gọi trái phép model cao cấp qua API Novelcrafter**                                                                            | Cao        | Cưỡng chế kiểm tra `checkDailyMessageLimit(userId)` (`403 ACCESS_PENDING` / `429 DAILY_LIMIT_EXCEEDED`), `consumeRateLimit`, và `assertModelAllowedForUser(userId, model)` trên cả `/api/novelcrafter/stream` lẫn `/api/novelcrafter/state`.                                                                    |
| **R5. Request lưu trễ (stale network request) ghi đè lùi dữ liệu mới hơn hoặc ghi nhầm khi chuyển truyện**                                                                   | Cao        | Kiểm tra `state.updatedAt < existingState.updatedAt` trong `saveStoryState` (ném `ValidationError("Stale story state rejected")`), dọn dẹp duplicate rows, và cô lập auto-save timer theo `targetConversationId` trong `useNovelcrafterStory.ts`.                                                               |
| **R6. Kích thước payload `NovelcrafterStoryState` phình to vượt bộ nhớ Serverless**                                                                                          | Trung bình | Giới hạn `chapters: z.array(...).min(1).max(100)`, `historyCards: z.array(...).max(50)`, kiểm tra `content-length` trên API routes, và khai báo `maxDuration = 60` (`/state`) & `maxDuration = 300` (`/stream`).                                                                                                |

## Audit History

### Audit Run 1

`[REVIEWER_MODEL: gemini-4-argon]`

#### 1. Kiểm Chứng Lỗi Cũ

- Đây là lượt thẩm định đầu tiên (`Audit Run 1`), chưa có danh sách lỗi từ lượt trước.

#### 2. Phát Hiện Mới

1. **`[BLOCKER]` F-01 — Vi phạm ranh giới kiến trúc, side-effects ghi bẩn DB và lệch giao thức SSE khi `novelcrafterStreamRunner.server.ts` tái sử dụng trực tiếp các hàm stream của `/api/chat-stream`**:
   - **Bằng chứng**:
     - Mục 4 (dòng 119–121) chỉ định `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts` gọi `createChatReadableStream`, `createAnthropicStream`, `createOpenAICompatibleStream`, `createDeepSeekStream` từ `src/app/api/chat-stream/streaming/index.ts`, đồng thời trích dẫn sai tên file `geminiStream.ts` và `anthropicStream.ts` (kiểm chứng `[SRC] src/app/api/chat-stream/streaming/index.ts:4-7`: tên file thực tế là `gemini-stream.ts`, `anthropic-stream.ts`, `openai-stream.ts`, `deepseek-stream.ts`).
     - **Vi phạm chiều phụ thuộc kiến trúc**: Module trong `src/lib/features/novelcrafter/` import ngược vào `src/app/api/chat-stream/streaming/` vi phạm quy tắc phân tầng `app/` (thin route/UI) -> `lib/features/` (domain logic) -> `lib/core/` (singletons) tại `.agents/rules/01-coding.md:77-82` và `.agents/agents/reviewer/agent.md:69`.
     - **Side-effects làm hỏng dữ liệu bộ truyện**: Kiểm chứng `[SRC] src/app/api/chat-stream/streaming/gemini-stream.ts:711-737,759-765,821-840`, `[SRC] src/app/api/chat-stream/streaming/anthropic-stream.ts:76-102,184-194`, `[SRC] src/app/api/chat-stream/streaming/openai-stream.ts:92-118`, và `[SRC] src/app/api/chat-stream/streaming/post-processing.ts:194-250` cho thấy các hàm stream của Chat tự động gọi `savePartialOnce()` (lưu message `role: "assistant"`, `isPartial: true` kèm `balanceThinkTags` vào bảng `messages` khi hủy stream), gọi `processPostStream()` (lưu tin nhắn chat và gọi `setConversationAutoTitle` ghi đè tiêu đề conversation), và trong `anthropic-stream.ts:184-194` luôn tự động tiêm beta tools `code_execution_20250522` và `web_fetch_20250910`.
     - **Lệch định dạng SSE wire format**: Hàm `sendEvent` (`[SRC] src/app/api/chat-stream/streaming/utils.ts:53-64`) phát khung `event: <event>\ndata: <json>\n\n`, trong đó sự kiện `token` có payload `{ t: text }` (`[SRC] src/app/api/chat-stream/streaming/openai-stream.ts:319`, `[SRC] src/app/features/chat/components/hooks/useChatStreamController.ts:631`) và `thinking` có payload `{ thinking: string }` (`useChatStreamController.ts:644`), nhưng Mục 3.2 S4 của plan (dòng 96) lại mô tả `server gửi SSE event type: "error"`.
   - **Yêu cầu sửa**: Định nghĩa rõ cơ chế streaming trong `novelcrafterStreamRunner.server.ts`: hoặc xây dựng stream runner độc lập trong `src/lib/features/novelcrafter/` gọi trực tiếp các singleton client tại `src/lib/core/` (`getGenAIClient`, `getClaudeClient`, `getOpenRouterClient`, `getGroqClient`, `getDeepSeekClient`), hoặc nếu trích xuất/dùng chung helper thì phải đặt ở tầng `lib/` với `saveMessage: async () => null`, `appendToContext: async () => {}`, `setConversationAutoTitle: async () => {}`, `shouldGenerateTitle: false`, tắt `code_execution`/`web_fetch`, và thống nhất tường minh định dạng khung SSE giữa server (`novelcrafterStreamRunner.server.ts`) với client (`useNovelcrafterStream.ts`).

2. **`[BLOCKER]` F-02 — Thiếu kiểm tra phân quyền Model theo Rank (`assertModelAllowedForUser`), trạng thái `not_whitelisted` và Rate Limit phía Server**:
   - **Bằng chứng**:
     - Kiểm chứng `[SRC] src/lib/core/limits.ts:488-511`: hệ thống cung cấp `assertModelAllowedForUser(userId, model)` (và `isModelAllowedForUser` tại dòng 463) để chặn người dùng rank `basic` gọi các model cao cấp không nằm trong `rank_configs.allowed_models`. Trong `[SRC] src/lib/features/chat/conversations.ts:489`, `setConversationModel` bắt buộc gọi `await assertModelAllowedForUser(userId, finalModel)`.
     - Kiểm chứng `[SRC] src/app/api/chat-stream/route.ts:66-95`: route streaming bắt buộc kiểm tra (a) `messageLimit.rank === "not_whitelisted"` -> trả `403` (`ACCESS_PENDING`), (b) `!messageLimit.canSend` -> trả `429` với mã lỗi `"DAILY_LIMIT_EXCEEDED"` (lưu ý `TC-06` dòng 348 trong plan đang ghi sai mã lỗi thành `DAILY_LIMIT_REACHED`), và (c) `consumeRateLimit` (`[SRC] src/lib/core/rateLimit.ts:187`).
     - Kế hoạch hiện chỉ lọc model ở UI qua `useAllowedModels` (dòng 18), chưa kiểm tra `assertModelAllowedForUser(userId, model)` tại `POST /api/novelcrafter/stream` (và khi lưu `selectedModel` trong `PUT /api/novelcrafter/state`), tạo lỗ hổng cho phép client gửi trực tiếp model ID cao cấp lên API để vượt rào phân quyền rank.
   - **Yêu cầu sửa**: Bổ sung kiểm tra `assertModelAllowedForUser(userId, requestedModel)`, `checkDailyMessageLimit(userId)` (kèm xử lý `rank === "not_whitelisted"` trả `403 ACCESS_PENDING` và `!canSend` trả `429 DAILY_LIMIT_EXCEEDED`), `consumeRateLimit`, và `incrementDailyMessageCount(userId)` vào `/api/novelcrafter/stream/route.ts`; đồng bộ mã lỗi trong `TC-06`.

3. **`[MAJOR]` F-03 — Bỏ sót cập nhật hệ thống dịch song ngữ (`src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`)**:
   - **Bằng chứng**:
     - `.agents/rules/04-bilingual.md:10-20` và `.agents/agents/reviewer/mental-simulation.md:61` bắt buộc mọi chuỗi hiển thị trên UI phải qua hook `useLanguage()` (`[SRC] src/app/features/chat/hooks/useLanguage.ts:12-34`) và khai báo đồng bộ khóa trong cả `[SRC] src/lib/utils/translations/vi.ts` lẫn `[SRC] src/lib/utils/translations/en.ts` (được kiểm tra parity kiểu biên dịch tại `[SRC] src/lib/utils/translations/index.ts:24-34`).
     - Trong `[SRC] src/app/features/sidebar/components/Sidebar.tsx:290,332,348`, mọi `SidebarButton` đều dùng `label={t("...")}`.
     - Mục 5 và Mục 6 của plan không liệt kê `[MODIFY] src/lib/utils/translations/vi.ts` và `[MODIFY] src/lib/utils/translations/en.ts`, đồng thời mô tả nhiều chuỗi giao diện cố định bằng tiếng Anh trong 7 components mới.
   - **Yêu cầu sửa**: Bổ sung `[MODIFY] src/lib/utils/translations/vi.ts` và `[MODIFY] src/lib/utils/translations/en.ts` vào Mục 5 và Mục 6; yêu cầu mọi UI component mới của Novelcrafter và nút điều hướng trên `Sidebar.tsx` sử dụng `useLanguage()` + `t("...")`, và chạy `src/lib/utils/translations/index.test.ts` trong bước verify.

4. **`[MAJOR]` F-04 — Thiếu Co-Located Unit Tests cho `novelcrafterStreamRunner.server.ts` và thiếu API Route Integration Tests cho `/api/novelcrafter/state` & `/api/novelcrafter/stream`**:
   - **Bằng chứng**:
     - `.agents/rules/01-coding.md:64-70` và `.agents/agents/reviewer/agent.md:70,87` bắt buộc: (a) mọi file logic trong `src/lib/features/` phải có file `*.test.ts` co-located đi kèm, và (b) mọi API route mới phải có integration test kiểm tra xác thực, validate đầu vào và mã lỗi.
     - Bằng chứng `[CMD] npx vitest list --filesOnly` (exit code 0) cho thấy quy chuẩn thực tế của dự án: các route trong `src/app/api/` đều có `route.test.ts` (`src/app/api/chat-stream/route.test.ts`, `src/app/api/conversations/route.test.ts`, `src/app/api/gems/route.test.ts`, `src/app/api/personas/route.test.ts`...) và các file `.server.ts` trong `src/lib/features/` đều có `*.server.test.ts` (`src/lib/features/research/researchService.server.test.ts`, `src/lib/features/files/fileService.server.test.ts`...).
     - Mục 5.3, 5.4 và Mục 8.1–8.2 của plan chưa có `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`, `src/app/api/novelcrafter/state/route.test.ts`, và `src/app/api/novelcrafter/stream/route.test.ts` (dù `TC-06` dòng 348 có mô tả kịch bản test cho 2 route này).
   - **Yêu cầu sửa**: Bổ sung `[NEW] src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`, `[NEW] src/app/api/novelcrafter/state/route.test.ts`, và `[NEW] src/app/api/novelcrafter/stream/route.test.ts` vào Mục 5, Bước 8.1 và lệnh chạy test tại Mục 8.2.

5. **`[MAJOR]` F-05 — Sai lệch đặc tả kỹ thuật trong Test Contract (`TC-03`, `TC-05`) so với code thật của `encryption.ts`, `prompt-builder.ts`, Zod v4 và môi trường Vitest**:
   - **Bằng chứng**:
     - **Sai định dạng mã hóa trong `TC-05` (dòng 347)**: Plan ghi `saveStoryState mã hóa AES-256-GCM (v1:iv:tag:cipher)`. Kiểm chứng `[SRC] src/lib/core/encryption.ts:68,89,114-125` cho thấy `encryptText()` xuất chuỗi 3 phần `iv:authTag:encryptedData` (không có tiền tố `v1:`). Nếu truyền chuỗi 4 phần `v1:iv:tag:cipher` vào `decryptText()`, kiểm tra `parts.length === 3` ở dòng 89 sẽ thất bại và hàm ném lỗi `"Invalid encryption format"` ở dòng 115.
     - **Xung đột môi trường `happy-dom` khi kiểm thử `encryptText`/`decryptText` thật**: Kiểm chứng `[SRC] vitest.config.ts:8` cho thấy Vitest cấu hình mặc định `environment: "happy-dom"` (`typeof window !== "undefined"`), và `[SRC] tests/setup.ts:1-24` không thiết lập `DATA_ENCRYPTION_KEY`. Trong khi đó `[SRC] src/lib/core/encryption.ts:11,55-57,78-81` ném lỗi `"encryptText must only be called on server-side"` và `decryptText` trả về `""` khi `typeof window !== "undefined"`.
     - **Sai cấu trúc `PersonaPromptInput` và `ZodError` (`TC-03` dòng 345)**: `TC-03` ghi `persona hợp lệ (name, tone, styleRules)`. Kiểm chứng `[SRC] src/lib/features/personas/prompt-builder.ts:22-28` và probe `[CMD] npx tsx -e` cho thấy `PersonaPromptInput` nhận `{ tone, useEmojis, useHeadersLists, userContext, customInstructions }` (không có `name` hay `styleRules`), và `ZodError` của Zod v4 (`^4.2.1` tại `[SRC] package.json:80`) dùng mảng `.issues` (`errors exists: false`).
   - **Yêu cầu sửa**:
     - Sửa `TC-05` theo đúng định dạng `iv:authTag:encryptedData` (3 đoạn hex, segment đầu 24 ký tự hex, segment thứ hai 32 ký tự hex) của `src/lib/core/encryption.ts:68`.
     - Ghi rõ trong kế hoạch kiểm thử `storyPersistence.server.test.ts` việc sử dụng `// @vitest-environment node` và khởi tạo `process.env.DATA_ENCRYPTION_KEY` (64 ký tự hex) trong `vi.hoisted()` trước khi import module mã hóa.
     - Sửa `TC-03` khớp với `PersonaPromptInput` (`tone`, `useEmojis`, `useHeadersLists`, `userContext`, `customInstructions`) và dùng `zodError.issues` khi xử lý lỗi validate Zod v4.

6. **`[MAJOR]` F-06 — Sót cô lập cuộc hội thoại Novelcrafter trên `/api/chat-stream`, thiếu giới hạn số lượng chương (`chapters.max(...)`), thiếu cấu hình `maxDuration`, thiếu Living Docs (`docs/CHANGELOG.md`) và ghi sai đường dẫn tài liệu ở Mục 2**:
   - **Bằng chứng**:
     - **Cô lập luồng Chat & `messages`**: Khi `normalizeModelForApi` giữ nguyên `"vikini-novelcrafter"`, nếu client mở `/?id=<novelcrafter-conv-id>` hoặc gọi `/api/chat-stream` với ID của bộ truyện Novelcrafter, `loadOrCreateConversation` (`[SRC] src/app/api/chat-stream/conversationLoader.ts:59-60`) sẽ truyền `model = "vikini-novelcrafter"` thẳng sang Gemini SDK gây lỗi, và `useChatStreamController.ts:144-148` sẽ hiển thị bản ghi `story_state` như một tin nhắn chat nếu `meta.isContextOnly` không được đặt là `true`. Ngoài ra, `saveStoryState` cần kiểm tra chống ghi đè lùi phiên bản (`state.updatedAt` / `version`) và cập nhật `conversations.updated_at` để danh sách truyện trên Sidebar sắp xếp đúng thứ tự sửa đổi gần nhất (`[SRC] src/lib/features/chat/conversations.ts:224`).
     - **Giới hạn kích thước State & Serverless `maxDuration`**: Trong Bước 3.1 (dòng 267–291), `NovelcrafterStoryStateSchema` chưa giới hạn số lượng phần tử tối đa của mảng `chapters` (ví dụ `.max(100)`), dẫn đến nguy cơ phình payload vượt ngưỡng bộ nhớ khi mã hóa hex. Hai route `/api/novelcrafter/state/route.ts` và `/api/novelcrafter/stream/route.ts` chưa khai báo `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, và `export const maxDuration` theo kịch bản S6 (`mental-simulation.md:50-54`).
     - **Thiếu Living Docs & sai tên file Pre-Work**: Kế hoạch thiếu bước cập nhật `docs/CHANGELOG.md` (bắt buộc theo `.agents/rules/02-quality.md:52` và `.agents/agents/reviewer/agent.md:87`). Tại Mục 2 (dòng 72), plan liệt kê `docs/01-architecture.md`, `docs/02-api-reference.md`, `docs/05-security-and-ops.md` — kiểm chứng bằng `view_file` cho thấy các file này không tồn tại (tên file thực tế trong repo là `docs/architecture.md`, `docs/contracts.md`, `docs/security.md`).
   - **Yêu cầu sửa**:
     - Đặt `meta: { novelcrafterType: "story_state", isContextOnly: true }` khi lưu state vào `messages`; chặn hoặc fallback an toàn nếu `/api/chat-stream` hoặc `useConversationSelectors.ts` (`currentConversation`) gặp conversation có `model === MODEL_IDS.NOVELCRAFTER`.
     - Thêm `.max(100)` cho mảng `chapters` trong `NovelcrafterStoryStateSchema`, kiểm tra giới hạn `content-length` trên `PUT /api/novelcrafter/state`, kiểm tra chống stale overwrite trong `saveStoryState`, và khai báo `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration` cho cả 2 API routes.
     - Bổ sung cập nhật `docs/CHANGELOG.md` vào Mục 5 & Mục 6 và sửa lại tên file tài liệu tại Mục 2.

7. **`[MINOR]` F-07 — Làm rõ việc sử dụng `confirm()` từ `@/lib/store/confirmStore`**:
   - **Bằng chứng**: `.agents/rules/03-ui.md:80-82` cấm dùng `window.confirm()` gốc của trình duyệt và bắt buộc dùng `confirm()` từ `src/lib/store/confirmStore.ts` (như tại `[SRC] src/app/features/image-gen/components/hooks/useImageGenStudio.ts:17`).
   - **Yêu cầu sửa**: Ghi rõ trong Mục 1.3, 5.5 và Bước 7 là sử dụng `await confirm({ ... })` từ `@/lib/store/confirmStore`.

---

#### 3. Mental Simulation Verification Matrix

| Kịch bản                                               | Trạng thái | Loại bằng chứng           | Chi tiết kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1: Cold-start & Build**                             | `FAIL`     | `[CMD]`, `[SRC]`          | - Chạy `[CMD] npm run type-check`: phát hiện cache `.next/types/validator.ts` tham chiếu route cũ đã xóa; các file trong `src/` hiện có 4 file đang có unstaged diff từ task Gemini 4 Argon (`[CMD] git status`).<br>- Kiểm tra `[SRC] package.json:1-140`: các dependencies (`next ^16.4.0`, `react ^19.2.3`, `@google/genai ^2.10.0`, `@anthropic-ai/sdk ^0.71.2`, `openai ^6.15.0`, `@supabase/supabase-js ^2.89.0`, `zod ^4.2.1`) khớp với bảng Verified Versions.<br>- **Lý do FAIL**: Mục 4 (dòng 119–120) ghi sai đường dẫn `geminiStream.ts` / `anthropicStream.ts` (thực tế là `gemini-stream.ts` / `anthropic-stream.ts` tại `[SRC] src/app/api/chat-stream/streaming/index.ts:4-7`); Mục 2 (dòng 72) trích dẫn 3 file `docs/01-architecture.md`, `docs/02-api-reference.md`, `docs/05-security-and-ops.md` không tồn tại. |
| **S2: Runner Lifecycle & Teardown**                    | `FAIL`     | `[SRC]`                   | - Plan có thiết kế hủy `AbortController` phía client (`useNovelcrafterStream.ts`) và cô lập timer auto-save theo `targetConversationId`.<br>- **Lý do FAIL**: Việc tái sử dụng trực tiếp `createChatReadableStream` / `createAnthropicStream` / `createOpenAICompatibleStream` (`[SRC] src/app/api/chat-stream/streaming/gemini-stream.ts:711-737,821-840`) sẽ kích hoạt `savePartialOnce()` khi abort và `processPostStream()` khi hoàn tất, tự động chèn bản ghi chat `role: "assistant"` vào bảng `messages` và đổi tên bộ truyện. Ngoài ra `storyPersistence.server.test.ts` thiếu cấu hình `// @vitest-environment node` nên sẽ lỗi khi chạy `encryptText` thật trong môi trường mặc định `happy-dom` (`[SRC] vitest.config.ts:8`, `[SRC] src/lib/core/encryption.ts:55-57`).                                                   |
| **S3: Database & Temporal Logic**                      | `FAIL`     | `[SRC]`, `[ADV]`          | - Kiểm chứng `[SRC] docs/database-schema.md:47-67,438-440`: bảng `conversations` và `messages` bật RLS chỉ cho phép `service_role` truy cập qua `getSupabaseAdmin()`.<br>- **Lý do FAIL**: (1) `TC-05` (dòng 347) mô tả định dạng mã hóa `v1:iv:tag:cipher` mâu thuẫn với `[SRC] src/lib/core/encryption.ts:68,89` (`iv:authTag:encryptedData`, 3 phần); (2) `saveStoryState` chưa kiểm tra `updatedAt`/`version` để chặn request lưu trễ ghi đè lên state mới hơn và chưa cập nhật `conversations.updated_at`; (3) Bản ghi `story_state` trong `messages` chưa đặt `meta.isContextOnly = true`.                                                                                                                                                                                                                                     |
| **S4: Cross-Task State Flow**                          | `FAIL`     | `[SRC]`                   | - Đã kiểm chứng `[SRC] src/app/features/chat/components/hooks/useConversationSelectors.ts:31-40`, `[SRC] src/app/features/chat/components/ChatApp.tsx:84-91,387`, `[SRC] src/app/features/chat/components/hooks/useUrlSync.ts:47-54`, và `[SRC] src/app/api/chat-stream/conversationLoader.ts:59-60`.<br>- **Lý do FAIL**: Dù `filteredConversations` lọc bỏ `MODEL_IDS.NOVELCRAFTER`, nhưng nếu người dùng truy cập `/?id=<novelcrafter-id>` hoặc gửi `conversationId` của Novelcrafter vào `/api/chat-stream`, `currentConversation` trong `useConversationSelectors.ts:37` và `loadOrCreateConversation` trong `conversationLoader.ts:60` vẫn chấp nhận conversation đó và gửi `model = "vikini-novelcrafter"` tới provider AI.                                                                                                   |
| **S5: Security Boundary & 3-Tier Auth**                | `FAIL`     | `[SRC]`, `[ADV]`          | - Plan sử dụng `getSupabaseAdmin()` trong file `.server.ts` (`storyPersistence.server.ts`, `novelcrafterStreamRunner.server.ts`) và kiểm tra quyền sở hữu `conversation.userId === userId`.<br>- **Lý do FAIL**: (1) Thiếu gọi `assertModelAllowedForUser(userId, model)` (`[SRC] src/lib/core/limits.ts:488`) trên `/api/novelcrafter/stream` và `/api/novelcrafter/state`, cho phép user rank `basic` bypass giới hạn model; (2) Thiếu kiểm tra `messageLimit.rank === "not_whitelisted"` (`403 ACCESS_PENDING`) và `consumeRateLimit` (`[SRC] src/app/api/chat-stream/route.ts:69-95`); (3) Thiếu giới hạn `.max()` cho số lượng phần tử mảng `chapters` trong `NovelcrafterStoryStateSchema`.                                                                                                                                    |
| **S6: External Resilience & Serverless Execution Cap** | `FAIL`     | `[SRC]`                   | - Plan đã dự phòng fallback khi GEM/Persona bị xóa (`getGemsForUser` / `getPersonasForUser` trả về không có ID thì fallback về `null`).<br>- **Lý do FAIL**: Hai route `/api/novelcrafter/stream/route.ts` và `/api/novelcrafter/state/route.ts` chưa khai báo `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, và `export const maxDuration` theo quy chuẩn S6 (`mental-simulation.md:50-54`).                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Domain: Open Inquiry (Vikini & Sudowrite)**          | `FAIL`     | `[SRC]`, `[CMD]`, `[URL]` | - Đồ thị Phụ thuộc 8 Thành phần của Sudowrite (`Braindump`, `Genre`, `Style`, `Synopsis`, `Characters`, `Worldbuilding`, `Outline`, `Scenes & Draft`), quy tắc fallback `Synopsis -> Braindump`, và `Visibility Settings` khớp với tài liệu Sudowrite (`[URL] https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC`).<br>- **Lý do FAIL**: (1) Vi phạm `.agents/rules/04-bilingual.md` do thiếu cập nhật `src/lib/utils/translations/vi.ts` và `en.ts` (F-03); (2) Thiếu co-located tests cho `novelcrafterStreamRunner.server.ts` và 2 API routes (F-04); (3) Sai cấu trúc `PersonaPromptInput` trong `TC-03` (F-05); (4) Thiếu cập nhật `docs/CHANGELOG.md` (F-06).                                                                                                        |

---

#### 4. Claim Verification

1. **Khẳng định của Plan**: "`upsertMessage` gọi `balanceThinkTags(content)` sẽ tự động nối `</think>` vào cuối chuỗi JSON nếu nội dung truyện chứa thẻ `<think>` chưa đóng, làm hỏng `JSON.parse()`."
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/lib/features/chat/messages.ts:224` (`const balancedContent = balanceThinkTags(content);`). Việc tách `storyPersistence.server.ts` không đi qua `upsertMessage` là có cơ sở kỹ thuật.
2. **Khẳng định của Plan**: "`saveStoryState` mã hóa AES-256-GCM (`v1:iv:tag:cipher`)." (`TC-05`, dòng 347).
   - **Xác minh**: `FAIL` — Kiểm chứng tại `[SRC] src/lib/core/encryption.ts:68` (`return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");`) và dòng 89 (`if (parts.length === 3 && parts[0].length === GCM_IV_LENGTH * 2)`). Hàm `encryptText` không có tiền tố `v1:`; nếu có tiền tố `v1:`, `decryptText` sẽ ném lỗi tại dòng 115.
3. **Khẳng định của Plan**: "`buildPersonaSystemPrompt` nhận `persona` hợp lệ (`name`, `tone`, `styleRules`)." (`TC-03`, dòng 345).
   - **Xác minh**: `FAIL` — Kiểm chứng tại `[SRC] src/lib/features/personas/prompt-builder.ts:22-28` và chạy probe `[CMD] npx tsx -e`: interface `PersonaPromptInput` gồm `{ tone, useEmojis, useHeadersLists, userContext, customInstructions }`, không có `name` hay `styleRules`.
4. **Khẳng định của Plan**: "Tái sử dụng `createChatReadableStream` (`src/app/api/chat-stream/streaming/geminiStream.ts`) và `createAnthropicStream` (`src/app/api/chat-stream/streaming/anthropicStream.ts`)." (Mục 4, dòng 119–120).
   - **Xác minh**: `FAIL` — Kiểm chứng tại `[SRC] src/app/api/chat-stream/streaming/index.ts:4-7`: tên file thực tế là `gemini-stream.ts` và `anthropic-stream.ts`, đồng thời các hàm này chứa side-effect `savePartialOnce` và `processPostStream` ghi trực tiếp vào bảng `messages` và `conversations` (`[SRC] src/app/api/chat-stream/streaming/gemini-stream.ts:719,821`).

---

#### 5. Adversarial Timelines

##### Timeline 1 (S3 — Đồng thời & Stale Overwrite trên `saveStoryState`)

```
Cơ chế: Lưu trạng thái bộ truyện qua PUT /api/novelcrafter/state (saveStoryState)
- Trục 1 (Đồng thời):
  T1: Client gửi PUT #1 (state updatedAt = 1000) và PUT #2 (state updatedAt = 2000) gần như cùng lúc cho bộ truyện mới.
  T2: Cả 2 instance serverless cùng SELECT bảng messages không thấy row story_state nào -> cùng INSERT 2 row.
  T3: Ở lần gọi tiếp theo, saveStoryState SELECT theo created_at DESC và xóa row cũ hơn. Tuy nhiên nếu ở T2, request PUT #1 (updatedAt = 1000) bị delay mạng đến DB sau PUT #2 (updatedAt = 2000), row của PUT #1 có created_at lớn hơn nên ghi đè mất dữ liệu mới hơn của PUT #2.
- Trục 2 (TOCTOU):
  T1: saveStoryState kiểm tra verifyNovelcrafterConversationOwnership thấy hợp lệ, đọc existingRow (updatedAt = 2000).
  T2: Request trễ mang payload cũ (updatedAt = 1000) thực thi UPDATE mà không so sánh state.updatedAt / version với dữ liệu hiện có trong DB.
  T3: Dữ liệu chương mới (updatedAt = 2000) bị ghi đè lùi về bản cũ (updatedAt = 1000).
- Trục 3 (Thất bại giữa chừng & dọn dẹp):
  T1: Người dùng hủy stream SSE giữa chừng khi novelcrafterStreamRunner đang chạy qua createChatReadableStream.
  T2: Listener abort trong gemini-stream.ts:711 gọi savePartialOnce() -> gọi saveMessage() chèn một row role="assistant" thông thường vào bảng messages của bộ truyện Novelcrafter.
  T3: Bảng messages của bộ truyện bị lẫn bản ghi chat thường và tiêu đề truyện có nguy cơ bị ghi đè bởi auto-title.
- Trục 4 (Môi trường serverless):
  T1: Route /api/novelcrafter/stream không khai báo maxDuration, chạy model suy luận sâu (DeepSeek / Gemini Pro / Argon) vượt quá timeout mặc định của hàm serverless.
  T2: Instance bị đóng ngắt đột ngột mà không gửi SSE error event.
Kết cục: LỖI (BLOCKER F-01 / MAJOR F-06) → Cần tách stream runner không gọi saveMessage/processPostStream của Chat, kiểm tra chống ghi đè lùi updatedAt/version trong saveStoryState, và cấu hình maxDuration.
```

##### Timeline 2 (S5 — TOCTOU & Vượt rào phân quyền Model theo Rank trên `/api/novelcrafter/stream`)

```
Cơ chế: Kiểm soát quyền sử dụng Model AI và hạn ngạch tin nhắn trên POST /api/novelcrafter/stream
- Trục 1 (Đồng thời):
  T1: Người dùng rank "basic" (chỉ còn 1 lượt daily_message_limit) bắn đồng thời 2 request POST /api/novelcrafter/stream.
  T2: Nếu route không gọi consumeRateLimit và checkDailyMessageLimit + incrementDailyMessageCount chuẩn xác, các request vượt rào rate limit.
- Trục 2 (TOCTOU / Bypass Auth & Rank Gating):
  T1: UI NovelcrafterTopBar ẩn các model Pro/Claude đối với user rank "basic" nhờ hook useAllowedModels.
  T2: User rank "basic" gọi trực tiếp POST /api/novelcrafter/stream (hoặc sửa selectedModel qua PUT /api/novelcrafter/state) với payload model = "claude-sonnet-4.5" hoặc "gemini-3.1-pro-preview".
  T3: Server không gọi assertModelAllowedForUser(userId, model) (src/lib/core/limits.ts:488) nên thực thi stream bằng model trả phí.
- Trục 3 (Thất bại giữa chừng & dọn dẹp):
  T1: User có rank = "not_whitelisted" gọi POST /api/novelcrafter/stream.
  T2: Nếu chỉ kiểm tra !messageLimit.canSend mà không chặn riêng messageLimit.rank === "not_whitelisted" (403 ACCESS_PENDING), hệ thống trả sai mã trạng thái (429 thay vì 403).
- Trục 4 (Môi trường serverless):
  T1: Client gửi mảng chapters gồm 1.000 phần tử vào PUT /api/novelcrafter/state vì NovelcrafterStoryStateSchema thiếu giới hạn .max() trên mảng chapters.
  T2: encryptText() cấp phát bộ nhớ lớn để mã hóa hex trên serverless instance gây nghẽn bộ nhớ.
Kết cục: LỖI (BLOCKER F-02 / MAJOR F-06) → Bắt buộc gọi assertModelAllowedForUser, chặn rank "not_whitelisted" (403), áp dụng consumeRateLimit, và giới hạn .max() cho mảng chapters.
```

---

#### 6. Commands Executed

1. `npm run type-check` -> Exit code: `1` (phát hiện `.next/types/validator.ts` và `.next/dev/types/validator.ts` lưu cache tham chiếu tới route cũ `src/app/api/files/[id]/analyze/route.js`; không có lỗi type trong `src/`).
2. `npx vitest list --filesOnly` -> Exit code: `0` (liệt kê 106 test files hiện có trong dự án, xác nhận quy chuẩn co-located tests cho `src/lib/features/` và `src/app/api/*/route.test.ts`).
3. `git status` -> Exit code: `0` (xác nhận trạng thái working tree hiện tại).
4. `npx vitest run src/lib/core/modelRegistry.test.ts src/app/features/sidebar/components/Sidebar.test.tsx` -> Exit code: `0` (2 test files passed, 24 tests passed).
5. `git diff src/` -> Exit code: `0` (kiểm tra các thay đổi unstaged hiện có trên `src/lib/core/modelRegistry.ts`, `src/lib/core/limits.ts`, `src/lib/utils/constants.ts`).
6. `git show --stat 093d2d2` -> Exit code: `0` (đối chiếu lịch sử xử lý lỗi reasoning token truncation).
7. `npx vitest run src/lib/core/encryption.test.ts src/lib/utils/translations/index.test.ts` -> Exit code: `0` (2 test files passed, 13 tests passed).
8. `npx tsx -e "import { z } from 'zod'; import { buildPersonaSystemPrompt } from './src/lib/features/personas/prompt-builder'; const res = z.object({ a: z.string() }).safeParse({ a: 123 }); console.log('zod issues exists:', !res.success && Array.isArray(res.error.issues), 'errors exists:', !res.success && 'errors' in res.error); console.log('persona output:', JSON.stringify(buildPersonaSystemPrompt({ tone: 'candid', useEmojis: false, useHeadersLists: false, userContext: 'ctx', customInstructions: 'rules' })));"` -> Exit code: `0` (xác nhận `zod issues exists: true errors exists: false` trên Zod v4 và xác nhận đầu ra của `buildPersonaSystemPrompt`).

---

#### 7. Kết Luận

Đề nghị `@planner` cập nhật bản kế hoạch để giải quyết 2 lỗi `[BLOCKER]`, 4 lỗi `[MAJOR]` và 1 lỗi `[MINOR]` nêu trên trước khi trình duyệt lại ở `Audit Run 2`.

- **Verdict (Run 1)**: `CHANGES_REQUESTED`

---

### Audit Run 2

**[REVIEWER_MODEL: gemini-4-argon]**

- **Ngày thẩm định**: 2026-10-14
- **Người thực hiện**: `@reviewer` (Lead Code & Architecture Reviewer — Independent Verification Run 2)
- **Phạm vi**: Thẩm định độc lập Revision 2 của `docs/plans/2026-10-14-novelcrafter-studio-implementation-plan.md` đối chiếu trực tiếp với mã nguồn thực tế (`[SRC]`) và lệnh kiểm chứng read-only (`[CMD]`).

#### 1. Kiểm Chứng Lỗi Cũ (Audit Run 1 -> Audit Run 2)

| Mã lỗi   | Mức độ cũ   | Trạng thái | Bằng chứng xác minh trên mã nguồn & lệnh thực thi (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :------- | :---------- | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-01** | `[BLOCKER]` | `ĐÃ SỬA`   | - Plan (Mục 4 dòng 130–145, Bước 5.2 dòng 351–365) đã tách rời `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`, không import từ `src/app/api/chat-stream/streaming/gemini-stream.ts` hay `anthropic-stream.ts` (vốn chứa `savePartialOnce` và `processPostStream` tại `[SRC] src/app/api/chat-stream/streaming/gemini-stream.ts:719,821`).<br>- Kiểm chứng các singleton clients được gọi trực tiếp: `getGenAIClient()` (`[SRC] src/lib/core/genaiClient.ts:48`), `getClaudeClient()` (`[SRC] src/lib/core/claudeClient.ts:19`), `getGroqClient()` (`[SRC] src/lib/core/groqClient.ts:7`), `getOpenRouterClient()` (`[SRC] src/lib/core/openRouterClient.ts:3`), `getDeepSeekClient()` (`[SRC] src/lib/core/deepseekClient.ts:3`).<br>- Định dạng khung SSE (`event: meta\|thinking\|token\|done\|error\ndata: {...}\n\n`) được định nghĩa tường minh qua `formatSseEvent` để khớp với parser của `useNovelcrafterStream.ts`. |
| **F-02** | `[BLOCKER]` | `ĐÃ SỬA`   | - Kiểm chứng `[SRC] src/lib/core/limits.ts:463-511`: `isModelAllowedForUser` và `assertModelAllowedForUser` hiện chỉ đối chiếu `limits.allowed_models`. Bước 1.3 (dòng 296–299) bổ sung `[MODIFY] src/lib/core/limits.ts` cho phép pseudo-model `MODEL_IDS.IMAGE_STUDIO` và `MODEL_IDS.NOVELCRAFTER` khi `limits.rank !== "not_whitelisted"`.<br>- Bước 6.1 & 6.2 (dòng 370–373) đã cưỡng chế `await assertModelAllowedForUser(userId, requestedModel)`, kiểm tra `messageLimit.rank === "not_whitelisted"` trả `403 ACCESS_PENDING` (khớp `[SRC] src/app/api/chat-stream/route.ts:68-73`), kiểm tra `!messageLimit.canSend` trả `429 DAILY_LIMIT_EXCEEDED`, và gọi `consumeRateLimit` (`[SRC] src/lib/core/rateLimit.ts:72`).                                                                                                                                                                                                                   |
| **F-03** | `[MAJOR]`   | `ĐÃ SỬA`   | - Bước 2 (dòng 302–316) và Bảng Tác Động File (dòng 248–249) đã bổ sung `[MODIFY] src/lib/utils/translations/vi.ts` và `[MODIFY] src/lib/utils/translations/en.ts` với cùng tập khóa `novelcrafter*`.<br>- Bước 9.10 & Mục 8.1 chạy `src/lib/utils/translations/index.test.ts` để kiểm chứng đồng bộ key giữa 2 ngôn ngữ (`[CMD] npx vitest run src/lib/utils/translations/index.test.ts` -> Exit code `0`, 6 tests passed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **F-04** | `[MAJOR]`   | `ĐÃ SỬA`   | - Bảng Tác Động File (dòng 250, 260, 262, 264) và Bước 9 (dòng 397–405) đã bổ sung đầy đủ co-located unit tests: `src/lib/core/limits.test.ts`, `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`, `src/app/api/novelcrafter/state/route.test.ts`, và `src/app/api/novelcrafter/stream/route.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **F-05** | `[MAJOR]`   | `ĐÃ SỬA`   | - Kiểm chứng `[SRC] src/lib/core/encryption.ts:68,89` và `[CMD] npx vitest run src/lib/core/encryption.test.ts` (Exit code `0`, 7 tests passed): `TC-05` (dòng 447) và Bước 9.5 (dòng 400) đã sửa sang định dạng 3 phần hex `iv:authTag:encryptedData` (`parts.length === 3`, `parts[0].length === 24`, `parts[1].length === 32`), kèm `// @vitest-environment node` và `vi.hoisted()` gán `process.env.DATA_ENCRYPTION_KEY`.<br>- Kiểm chứng `[SRC] src/lib/features/personas/prompt-builder.ts:22-28` và `[CMD] npx tsx -e`: `TC-03` (dòng 445) đã sửa sang `PersonaPromptInput` (`{ tone, useEmojis, useHeadersLists, userContext, customInstructions }`), và các route dùng `parsed.error.issues` của Zod v4 (`4.1.12`).                                                                                                                                                                                                                     |
| **F-06** | `[MAJOR]`   | `ĐÃ SỬA`   | - Kiểm chứng `[SRC] src/lib/features/chat/messages.ts:390,415`: `meta.isContextOnly = true` được `getAllMessages` và `getRecentMessages` lọc bỏ khi tải lịch sử chat.<br>- Kiểm chứng `[SRC] src/app/features/chat/hooks/useConversationSelectors.ts:22-28` và `[SRC] src/app/api/chat-stream/conversationLoader.ts:21-31`: Bước 1.5 & 1.6 đã bổ sung chặn hội thoại Studio khỏi khung Chat thường.<br>- Bước 3.1 giới hạn `chapters.min(1).max(100)`; Bước 5.1 kiểm tra chống ghi đè lùi `state.updatedAt < existingState.updatedAt \|\| state.version < existingState.version`; Bước 6.1 & 6.2 khai báo `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60` / `300`; Mục 2 sửa tên file tài liệu kiến trúc và bổ sung `[MODIFY] docs/CHANGELOG.md` (Bước 10.3).                                                                                                                                                              |
| **F-07** | `[MINOR]`   | `ĐÃ SỬA`   | - Kiểm chứng `[SRC] src/lib/store/confirmStore.ts:32,71`: Bước 7.2 (dòng 383) và Bước 8 (dòng 394) đã chỉ định rõ việc import `confirm` / `useConfirmStore` từ `@/lib/store/confirmStore`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

#### 2. Phát Hiện Mới & Các Tấn Công Đã Thử

##### 2.1. Phát Hiện Mới (Phân loại `[MINOR]` — Advisory Recommendations khi triển khai code)

Không phát hiện lỗi `[BLOCKER]` hoặc `[MAJOR]` mới trong Revision 2. Có 3 điểm lệch nhỏ ở mức chi tiết gọi hàm (`[MINOR]` — trình biên dịch TypeScript hoặc unit test sẽ cảnh báo ngay khi viết code) cần lưu ý trong quá trình triển khai:

1. **`[MINOR] A-01` — Tên thuộc tính `snake_case` của `PersonaRow` khi gọi `getPersonasForUser(userId)`**:
   - **Vị trí trong Plan**: Bước 5.2 (dòng 358) viết: `ánh xạ Persona sang PersonaPromptInput ({ tone: p.tone, useEmojis: p.useEmojis, useHeadersLists: p.useHeadersLists, userContext: p.userContext, customInstructions: p.customInstructions })`.
   - **Đối chiếu Codebase (`[SRC]`)**: Trong `[SRC] src/lib/features/personas/personas.ts:11-26,72-84`, hàm `getPersonasForUser(userId)` trả về `Promise<PersonaRow[]>` với các cột DB dạng `snake_case`: `use_emojis`, `use_headers_lists`, `user_context`, `custom_instructions` (xem cách map chuẩn tại `[SRC] src/lib/features/personas/personas.ts:236-242`).
   - **Khuyến nghị khi code**: Trong `novelcrafterStreamRunner.server.ts`, ánh xạ từ `PersonaRow` sang `PersonaPromptInput` bằng `{ tone: isValidTone(p.tone) ? p.tone : "default", useEmojis: p.use_emojis ?? true, useHeadersLists: p.use_headers_lists ?? true, userContext: p.user_context ?? "", customInstructions: p.custom_instructions ?? "" }`.

2. **`[MINOR] A-02` — Tên hằng số export trong `src/lib/core/modelRegistry.ts`**:
   - **Vị trí trong Plan**: Bước 6.2 (dòng 373) viết: `kiểm tra requestedModel nằm trong MODEL_REGISTRY (không phải MODEL_IDS.NOVELCRAFTER hay MODEL_IDS.IMAGE_STUDIO)`.
   - **Đối chiếu Codebase (`[SRC]` & `[CMD]`)**: Kiểm chứng tại `[SRC] src/lib/core/modelRegistry.ts:34,387` và chạy `[CMD] npx tsx -e "import * as mr from './src/lib/core/modelRegistry'; console.log('exports of modelRegistry:', Object.keys(mr));"`: module `modelRegistry.ts` export `SELECTABLE_MODELS` và helper `isSelectableModelId(modelId)` (không có hằng số tên `MODEL_REGISTRY`).
   - **Khuyến nghị khi code**: Tại `/api/novelcrafter/stream` và `/api/novelcrafter/state`, sử dụng `isSelectableModelId(requestedModel) && requestedModel !== MODEL_IDS.NOVELCRAFTER && requestedModel !== MODEL_IDS.IMAGE_STUDIO` (hoặc kiểm tra trên `SELECTABLE_MODELS`).

3. **`[MINOR] A-03` — Ánh xạ mã model Claude qua `CLAUDE_API_MODELS` khi gọi trực tiếp SDK**:
   - **Vị trí trong Plan**: Bước 5.2 (dòng 354) gọi trực tiếp `getClaudeClient().messages.create({ stream: true, ... })`.
   - **Đối chiếu Codebase (`[SRC]`)**: Trong `[SRC] src/lib/utils/constants.ts:40-51` và `[SRC] src/app/api/chat-stream/streaming/anthropic-stream.ts:34-43`, mã lưu trong UI/DB là `"claude-sonnet-4.5"` / `"claude-haiku-4.5"`, nhưng khi gửi tới Anthropic API hoặc OpenRouter cần ánh xạ qua `CLAUDE_API_MODELS.ANTHROPIC` (`"claude-sonnet-4-6"`, `"claude-haiku-4-5"`) hoặc `CLAUDE_API_MODELS.OPENROUTER`.
   - **Khuyến nghị khi code**: Áp dụng `CLAUDE_API_MODELS.ANTHROPIC[model]` (và fallback `CLAUDE_API_MODELS.OPENROUTER[model]`) trong `novelcrafterStreamRunner.server.ts`.

##### 2.2. Các Tấn Công Đã Thử (Adversarial Probes trên Revision 2)

1. **Tấn công 1 — Giả mạo `conversationId` của hội thoại Chat thường hoặc Image Studio vào `/api/novelcrafter/state` và `/api/novelcrafter/stream`**:
   - **Kịch bản**: Người dùng đã đăng nhập lấy `conversationId` hợp lệ của chính họ nhưng thuộc hội thoại Chat thường (`model = "gemini-2.5-flash"`) hoặc Image Studio (`model = "vikini-image-studio"`) để gọi `PUT /api/novelcrafter/state` nhằm tiêm bản ghi `story_state` vào hội thoại chat.
   - **Kiểm chứng (`[SRC]`)**: Đối chiếu `[SRC] src/lib/features/chat/conversations.ts:276-305` (`getConversation` trả về `convo.userId` và `convo.model`). Hàm `verifyNovelcrafterConversationOwnership(userId, conversationId)` trong `storyPersistence.server.ts` kiểm tra cả `convo.userId === userId` lẫn `convo.model === MODEL_IDS.NOVELCRAFTER`; nếu `convo.model !== MODEL_IDS.NOVELCRAFTER` thì ném `ValidationError` (HTTP 400). Ngược lại, nếu truyền `conversationId` của Novelcrafter vào `POST /api/chat-stream`, Bước 1.6 trong `loadOrCreateConversation` (`[SRC] src/app/api/chat-stream/conversationLoader.ts:21-31`) chặn các hội thoại có `convo.model === MODEL_IDS.NOVELCRAFTER || convo.model === MODEL_IDS.IMAGE_STUDIO`.
2. **Tấn công 2 — Gửi `selectedModel = "vikini-novelcrafter"` hoặc `"vikini-image-studio"` vào `PUT /api/novelcrafter/state` hoặc `POST /api/novelcrafter/stream` sau khi mở quyền pseudo-model trong `limits.ts`**:
   - **Kịch bản**: Vì Bước 1.3 mở `isModelAllowedForUser` / `assertModelAllowedForUser` cho `MODEL_IDS.NOVELCRAFTER` và `MODEL_IDS.IMAGE_STUDIO` để `saveConversation` tạo được hội thoại Studio, attacker truyền chính `MODEL_IDS.NOVELCRAFTER` làm model sinh văn bản trong `POST /api/novelcrafter/stream` hoặc `state.selectedModel` trong `PUT /api/novelcrafter/state`.
   - **Kiểm chứng (`[SRC]` & `[CMD]`)**: Chạy probe `[CMD] npx tsx -e` trên `src/lib/core/modelRegistry.ts`: `SELECTABLE_MODELS` chỉ chứa 20 model thực thi thực tế. Bước 6.1 (dòng 370) và Bước 6.2 (dòng 373) của Plan đã tách rõ 2 lớp kiểm tra: (1) từ chối tường minh nếu `selectedModel` / `requestedModel` là pseudo-model (`MODEL_IDS.NOVELCRAFTER` hoặc `MODEL_IDS.IMAGE_STUDIO`), sau đó (2) gọi `await assertModelAllowedForUser(userId, model)` để kiểm tra phân quyền theo rank.
3. **Tấn công 3 — Tràn bộ nhớ hoặc vỡ cấu trúc mã hóa AES-256-GCM khi lưu `NovelcrafterStoryState` qua `encryptText` / `decryptText`**:
   - **Kịch bản**: Gửi mảng `chapters` lớn hoặc ký tự Unicode tiếng Việt / thẻ `<think>` chưa đóng trong `braindump` và `draftProse` qua `saveStoryState`, kiểm tra xem `encryptText` / `decryptText` có làm hỏng JSON hoặc bị can thiệp bởi `balanceThinkTags` không.
   - **Kiểm chứng (`[SRC]` & `[CMD]`)**: Kiểm chứng tại `[SRC] src/lib/core/encryption.ts:52-119` và chạy `[CMD] npx vitest run src/lib/core/encryption.test.ts` (Exit code `0`, 7/7 tests passed): `encryptText` mã hóa UTF-8 trực tiếp bằng `aes-256-gcm` (`iv:authTag:encryptedData`) và `storyPersistence.server.ts` ghi thẳng qua `getSupabaseAdmin().from("messages")` mà không đi qua `upsertMessage` (`[SRC] src/lib/features/chat/messages.ts:224`), đồng thời Zod schema giới hạn `chapters.min(1).max(100)`, `scenes.max(100)`, `draftProse.max(200000)` và `content-length <= 2MB`.

---

#### 3. Mental Simulation Verification Matrix

| Kịch bản                                      | Trạng thái | Loại bằng chứng           | Chi tiết kiểm chứng độc lập                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :-------------------------------------------- | :--------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                    | `PASS`     | `[CMD]`, `[SRC]`          | - Kiểm chứng `package.json` (`[SRC] package.json:18-100`): đầy đủ dependencies (`next: ^16.1.6`, `react: 19.2.3`, `@google/genai: ^1.33.0`, `@anthropic-ai/sdk: ^0.71.0`, `zod: ^4.1.12`), không dùng Prisma.<br>- Kiểm chứng unit tests hiện hành: `[CMD] npx vitest run src/lib/core/encryption.test.ts src/lib/core/modelRegistry.test.ts src/lib/utils/translations/index.test.ts` (Exit code `0`, 29/29 tests passed).<br>- Không phát sinh biến môi trường mới ngoài `DATA_ENCRYPTION_KEY` (`[SRC] src/lib/core/encryption.ts:27`) và các API key hiện có (`[SRC] src/lib/core/genaiClient.ts:49`, `claudeClient.ts:20`, `groqClient.ts:8`, `openRouterClient.ts:4`, `deepseekClient.ts:4`). |
| **S2: Runner Lifecycle & Teardown**           | `PASS`     | `[SRC]`                   | - Kiểm chứng teardown phía client và server: `useNovelcrafterStream` quản lý `AbortController` (`abortRef.current?.abort()` khi unmount/đổi truyện/nhấn Stop), còn `novelcrafterStreamRunner.server.ts` (Bước 5.2, dòng 351–365) gọi trực tiếp các SDK clients và kiểm tra `signal?.aborted` trong vòng lặp đọc chunk mà không gọi `savePartialOnce` hay `processPostStream` của Chat.                                                                                                                                                                                                                                                                                                             |
| **S3: Database & Temporal Logic**             | `PASS`     | `[SRC]`, `[ADV]`          | - Kiểm chứng `[SRC] database-migrations/001-initial-schema.sql:25-32` (`messages.conversation_id REFERENCES conversations(id) ON DELETE CASCADE`, cột `meta JSONB`) và `[SRC] src/lib/features/chat/messages.ts:390,415` (lọc bỏ `meta.isContextOnly === true`).<br>- Kiểm chứng cơ chế chống ghi đè lùi trong `saveStoryState` (Bước 5.1, dòng 348): từ chối bản ghi nếu `state.updatedAt < existingState.updatedAt \|\| state.version < existingState.version` (xem Timeline 1 mục 5).                                                                                                                                                                                                           |
| **S4: Cross-Task State Flow**                 | `PASS`     | `[SRC]`                   | - Kiểm chứng `[SRC] src/app/features/sidebar/components/Sidebar.tsx:101,192-198`, `[SRC] src/app/features/chat/components/WelcomeScreen.tsx:222-244`, `[SRC] src/app/features/chat/hooks/useConversationSelectors.ts:22-28`, `[SRC] src/lib/features/chat/conversations.ts:116`, và `[SRC] src/lib/store/confirmStore.ts:32,71`.<br>- Hội thoại có `model === MODEL_IDS.NOVELCRAFTER` được lọc khỏi danh sách chat thường và khỏi `currentConversation` trong `useConversationSelectors.ts`.                                                                                                                                                                                                       |
| **S5: Security Boundary & 3-Tier Auth**       | `PASS`     | `[SRC]`, `[CMD]`, `[ADV]` | - Kiểm chứng `[SRC] src/lib/core/limits.ts:463-511`, `[SRC] src/lib/core/rateLimit.ts:72`, `[SRC] src/app/api/chat-stream/route.ts:68-73`.<br>- Cả 2 route `/api/novelcrafter/state` và `/api/novelcrafter/stream` đều xác thực `auth()`, kiểm tra `consumeRateLimit`, kiểm tra `verifyNovelcrafterConversationOwnership`, và kiểm tra phân quyền model theo rank qua `assertModelAllowedForUser` (xem Timeline 2 mục 5).                                                                                                                                                                                                                                                                          |
| **S6: External Resilience & Serverless Cap**  | `PASS`     | `[SRC]`, `[URL]`          | - Cả 2 route khai báo tường minh `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, `export const maxDuration = 60` (`/api/novelcrafter/state`) và `export const maxDuration = 300` (`/api/novelcrafter/stream`).<br>- Trần token đầu ra trong `novelcrafterStreamRunner.server.ts` được giới hạn `Math.min(getModelMaxOutputTokens(model) ?? 8192, 16384)` (`[SRC] src/lib/core/modelRegistry.ts:439`).                                                                                                                                                                                                                                                                 |
| **Domain: Open Inquiry (Vikini & Sudowrite)** | `PASS`     | `[SRC]`, `[CMD]`, `[URL]` | - Đồ thị phụ thuộc 8 thành phần (`Braindump`, `Genre`, `Style`, `Synopsis`, `Characters`, `Worldbuilding`, `Outline`, `Scenes & Draft`), quy tắc fallback `Synopsis -> Braindump`, và `Visibility Settings` khớp với tài liệu Sudowrite (`[URL] https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC`).<br>- Đã bổ sung đầy đủ bản dịch song ngữ `vi.ts`/`en.ts`, co-located tests, và cập nhật `docs/CHANGELOG.md`.                                                                                                                                                                                                                       |

---

#### 4. Claim Verification

1. **Khẳng định của Plan**: "`upsertMessage` gọi `balanceThinkTags(content)` sẽ tự động nối `</think>` vào cuối chuỗi JSON nếu nội dung truyện chứa thẻ `<think>` chưa đóng, làm hỏng `JSON.parse()`."
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/lib/features/chat/messages.ts:224` (`const balancedContent = balanceThinkTags(content);`).
2. **Khẳng định của Plan**: "`encryptText` / `decryptText` (`src/lib/core/encryption.ts:52,75`) xuất định dạng `iv:authTag:encryptedData` (3 phần hex, `parts[0].length === 24`, `parts[1].length === 32`)." (Bước 5.1 dòng 344 & Bước 9.5 dòng 400).
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/lib/core/encryption.ts:68,89` và chạy `[CMD] npx vitest run src/lib/core/encryption.test.ts` (Exit code `0`, 7 tests passed).
3. **Khẳng định của Plan**: "Bản ghi `messages` có `meta.isContextOnly = true` được tự động lọc bỏ khỏi `getAllMessages` và `getRecentMessages`." (Mục 4.3 dòng 154).
   - **Xác minh**: `PASS` — Kiểm chứng tại `[SRC] src/lib/features/chat/messages.ts:390,415` (`if (meta?.isContextOnly) return false;`).
4. **Khẳng định của Plan**: "Zod v4 (`^4.1.12`) sử dụng `parsed.error.issues` thay vì `.errors`." (Bước 6.1 dòng 370 & Bước 6.2 dòng 373).
   - **Xác minh**: `PASS` — Chạy probe `[CMD] npx tsx -e` với `zod` đang cài trong dự án: `parsed.error.issues.length` trả về `1`.

---

#### 5. Adversarial Timelines

##### Timeline 1 (S3 — Đồng thời & Chống ghi đè lùi trên `saveStoryState`)

```
Cơ chế: Lưu trạng thái bộ truyện qua PUT /api/novelcrafter/state (saveStoryState)
- Trục 1 (Đồng thời):
  T1: Client gửi PUT #1 (version = 2, updatedAt = 1000) và PUT #2 (version = 3, updatedAt = 2000) song song.
  T2: PUT #2 hoàn tất trước, lưu row story_state với version = 4, updatedAt >= 2000.
  T3: PUT #1 đến sau, đọc existingState (version = 4, updatedAt >= 2000), phát hiện state.updatedAt (1000) < existingState.updatedAt (2000) -> ném ValidationError("Stale story state rejected") (HTTP 400).
- Trục 2 (TOCTOU):
  T1: Attacker gửi conversationId của hội thoại Chat thường vào PUT /api/novelcrafter/state.
  T2: verifyNovelcrafterConversationOwnership đọc getConversation(conversationId) thấy convo.model !== MODEL_IDS.NOVELCRAFTER.
  T3: Hệ thống ném ValidationError trước khi chạm vào bảng messages.
- Trục 3 (Thất bại giữa chừng & dọn dẹp):
  T1: Người dùng hủy stream SSE giữa chừng khi novelcrafterStreamRunner đang chạy.
  T2: Vòng lặp stream trong novelcrafterStreamRunner phát hiện signal.aborted === true và thoát ngay lập tức, không ghi bất kỳ row nào vào bảng messages.
  T3: Bản ghi story_state mã hóa trong bảng messages giữ nguyên tính toàn vẹn.
- Trục 4 (Môi trường serverless):
  T1: Route /api/novelcrafter/stream cấu hình maxDuration = 300 và giới hạn maxOutputTokens <= 16384.
  T2: Stream hoàn tất hoặc đóng có kiểm soát trong hạn mức thực thi của serverless function.
Kết cục: Trạng thái bộ truyện trong DB không bị ghi đè lùi và không bị trộn lẫn message chat thường → AN TOÀN.
```

##### Timeline 2 (S5 — Phân quyền Model theo Rank & Rate Limit trên `/api/novelcrafter/stream`)

```
Cơ chế: Kiểm soát quyền sử dụng Model AI và hạn ngạch tin nhắn trên POST /api/novelcrafter/stream
- Trục 1 (Đồng thời):
  T1: Người dùng bắn song song nhiều request POST /api/novelcrafter/stream.
  T2: consumeRateLimit("novelcrafter-stream:" + userId) và checkDailyMessageLimit(userId) kiểm tra qua Upstash Redis / Supabase.
  T3: Các request vượt ngưỡng nhận HTTP 429 kèm rateLimitHeaders.
- Trục 2 (TOCTOU / Bypass Auth & Rank Gating):
  T1: Người dùng rank "basic" gửi trực tiếp POST /api/novelcrafter/stream với model = "claude-sonnet-4.5" hoặc "gemini-3.1-pro-preview".
  T2: Route gọi await assertModelAllowedForUser(userId, requestedModel) (src/lib/core/limits.ts:488).
  T3: assertModelAllowedForUser ném ForbiddenError -> Route trả về HTTP 403 FORBIDDEN trước khi khởi tạo SDK stream.
- Trục 3 (Thất bại giữa chừng & dọn dẹp):
  T1: Người dùng có rank = "not_whitelisted" gọi POST /api/novelcrafter/stream.
  T2: Route kiểm tra messageLimit.rank === "not_whitelisted" và trả về ngay HTTP 403 ACCESS_PENDING.
- Trục 4 (Môi trường serverless):
  T1: Client gửi mảng chapters vượt quá 100 phần tử vào PUT /api/novelcrafter/state.
  T2: NovelcrafterStoryStateSchema (.min(1).max(100)) chặn ngay ở bước parse Zod và trả về HTTP 400 trước khi gọi encryptText.
Kết cục: Mọi truy cập trái phép hoặc vượt hạn ngạch đều bị chặn ở tầng API server → AN TOÀN.
```

---

#### 6. Commands Executed

1. `npx vitest run src/lib/core/modelRegistry.test.ts src/lib/core/encryption.test.ts src/lib/utils/translations/index.test.ts` -> Exit code: `0` (3 test files passed, 29 tests passed).
2. `npx tsx -e "import { z } from 'zod'; import { MODEL_IDS, MODEL_REGISTRY, normalizeModelForApi } from './src/lib/core/modelRegistry'; import { buildPersonaSystemPrompt } from './src/lib/features/personas/prompt-builder'; ..."` -> Exit code: `1` (phát hiện `MODEL_IDS` nằm ở `src/lib/utils/constants.ts` chứ không re-export từ `modelRegistry.ts`).
3. `"const x: any = 1; export default x;" | npx eslint --stdin --stdin-filename src/lib/features/novelcrafter/types.ts` -> Exit code: `1` (xác nhận `@typescript-eslint/parser` kiểm tra `parserOptions.project` `./tsconfig.json`).
4. `npx tsx -e "import { z } from 'zod'; import { MODEL_IDS } from './src/lib/utils/constants'; import { MODEL_REGISTRY, normalizeModelForApi, coerceStoredModel } from './src/lib/core/modelRegistry'; ..."` -> Exit code: `1` (phát hiện `src/lib/core/modelRegistry.ts` không export hằng số tên `MODEL_REGISTRY` — ghi nhận tại `[MINOR] A-02`).
5. `"const x: any = 1; export default x;" | npx eslint --stdin --stdin-filename src/lib/features/personas/prompt-builder.ts` -> Exit code: `0` (kiểm tra hành vi pipe stdin của PowerShell vào `npx.cmd`).
6. `npx tsx -e "import * as mr from './src/lib/core/modelRegistry'; console.log('exports of modelRegistry:', Object.keys(mr));"` -> Exit code: `0` (xác nhận danh sách exports thực tế của `src/lib/core/modelRegistry.ts` gồm `SELECTABLE_MODELS`, `isSelectableModelId`, `normalizeModelForApi`, `coerceStoredModel`...).
7. `npx eslint --print-config src/lib/features/personas/prompt-builder.ts` -> Exit code: `0` (xác nhận cấu hình ESLint áp dụng cho `src/lib/features/**`).
8. `"console.log(1)" | npx eslint --stdin --stdin-filename src/lib/features/personas/prompt-builder.ts` -> Exit code: `0` (xác nhận đặc thù stdin của wrapper `npx.cmd` trên Windows PowerShell).
9. `npx tsx -e "import { MODEL_IDS } from './src/lib/utils/constants'; import { SELECTABLE_MODELS, isSelectableModelId, normalizeModelForApi, coerceStoredModel } from './src/lib/core/modelRegistry'; console.log('SELECTABLE_MODELS count:', SELECTABLE_MODELS.length, 'isSelectable(NOVELCRAFTER):', isSelectableModelId(MODEL_IDS.NOVELCRAFTER), 'normalize(NOVELCRAFTER):', normalizeModelForApi(MODEL_IDS.NOVELCRAFTER), 'coerce(NOVELCRAFTER):', coerceStoredModel(MODEL_IDS.NOVELCRAFTER));"` -> Exit code: `0` (xác nhận `SELECTABLE_MODELS count: 20` và hành vi hiện tại trước khi áp dụng Bước 1.1–1.2).

---

#### 7. Kết Luận

Revision 2 của bản kế hoạch đã giải quyết toàn bộ 7 phát hiện từ `Audit Run 1` (`F-01`..`F-07`). Trong quá trình triển khai code ở Pha Thực Thi, lưu ý áp dụng 3 khuyến nghị `[MINOR]` (`A-01`, `A-02`, `A-03`) tại Mục 2.1.

[PLAN_APPROVED]
