# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

> [!NOTE]
> Các bản ghi lịch sử phát hành từ ngày 2026-10-17 trở về trước (<= 2026-10-17) được lưu trữ nguyên vẹn tại [CHANGELOG Legacy Archive](./archive/CHANGELOG-legacy.md).

---

## 2026-10-25: Refactor & UI/UX -- Novelcrafter Rich Manuscript Editor, 4-Tier Responsive Layout & Chat/Bilingual UI Audit (`P1` / `P2` / `P3`)

- **P1 — Zero-Dependency Rich Manuscript Editor (`src/lib/features/novelcrafter/{manuscriptMarkup,manuscriptDecorations,manuscriptHistory,manuscriptTypography,selectionBubblePlacement,quoteScrollPositioning,codexMatcher}.ts`, `src/app/features/novelcrafter/{utils/manuscriptDomOffsets,utils/manuscriptSheetClasses,hooks/useManuscriptEditor,hooks/useManuscriptTypography,hooks/useChapterEditorController,components/ChapterManuscriptEditor,components/ManuscriptTypographyMenu,components/CodexEntityPreview,components/ChapterSelectionToolbar,components/SheetSubToolbar,components/ChapterEditorWorkspace}.ts(x)`)**:
  - Thay thế hoàn toàn `<textarea>` thuần trong `ChapterEditorWorkspace.tsx` bằng trình soạn thảo bản thảo `contentEditable="plaintext-only"` không phụ thuộc thư viện ngoài (`ChapterManuscriptEditor.tsx` + `useManuscriptEditor.ts` + `manuscriptDomOffsets.ts`), bảo toàn bất biến `1:1` chỉ số ký tự giữa chuỗi Markdown gốc và các nút văn bản DOM (kể cả tiếng Việt Telex/VNI, CJK IME composition, và emoji surrogate pairs).
  - Hỗ trợ định dạng trực tiếp trong dòng chữ (`H1`, `H2`, **in đậm**, _in nghiêng_, ~~gạch ngang~~, ngắt cảnh `***`, danh sách), bộ chọn kiểu chữ & trang giấy (`ManuscriptTypographyMenu.tsx`: `serif`/`sans`/`mono`, cỡ chữ `sm`–`xl`, giãn dòng, thụt lề dòng đầu đoạn văn lưu trong `localStorage`), và ngăn xếp Undo/Redo độc lập có gộp phím gõ (`manuscriptHistory.ts`).
  - Triển khai bộ cắt đoạn trang trí nguyên tử không lồng nhau (`manuscriptDecorations.ts`): gạch chân màu hổ phách `<mark data-feedback-id>` cho câu trích dẫn nhận xét mở (click nhảy tới thẻ nhận xét bên lề), tô sáng thực thể `<span data-codex-id>` cho nhân vật/thế giới trong Story Bible (`findCodexMentionRanges` + popover `CodexEntityPreview.tsx`), và giữ vùng chọn `.nc-selection` khi người dùng chuyển tiêu điểm sang menu AI hoặc ô nhập lệnh.
  - Nâng cấp thanh công cụ nổi theo vùng chọn (`ChapterSelectionToolbar.tsx` + `selectionBubblePlacement.ts`) với menu Rewrite 6 chế độ, Describe, Expand, Feedback, và ô nhập Quick Edit `Ctrl+K` ngay tại chỗ; định vị cuộn thẳng tới phần tử DOM `[data-feedback-id]` qua `getBoundingClientRect()` (xóa bỏ hoàn toàn cơ chế đo gương tạm `measureCaretOffsetTop` và `useAutoResizeTextarea.ts`).
- **P2 — Novelcrafter 4-Tier Responsive Layout (`src/lib/features/novelcrafter/studioLayout.ts`, `src/app/features/novelcrafter/{hooks/useDockedPanes,components/NovelcrafterStudioApp,components/ChapterAiToolbar,components/ChapterEmptyStateActions,components/NovelcrafterTopBar,components/NovelcrafterLeftNavigator,components/NovelcrafterHistoryPane,components/ChapterFeedbackGutter}.ts(x)`, `src/app/features/layout/components/HeaderBar.tsx`, `src/app/features/sidebar/components/Sidebar.tsx`)**:
  - Tự động thu gọn Sidebar chính khi vào `/novelcrafter` và ẩn `HeaderBar` toàn cục trên desktop (`hideOnDesktop`); đưa `ChapterAiToolbar` lên toàn chiều rộng phía trên các cột (`flex-nowrap` kèm `DropdownMenu` gom nút tràn trên màn hình nhỏ).
  - Bổ sung `maxDockedSidePanes` (`0` ở `<1180px`, `1` ở `1180–1535px`, `2` ở `1536–1919px`, `3` ở `>=1920px`) và `useDockedPanes` tự động đóng bảng cũ theo thứ tự LRU để trang giấy bản thảo luôn đạt độ rộng tối ưu và căn giữa (`mx-auto`); tự động đóng ngăn `Scenes` khi chương đã có nội dung và thu gọn `ChapterEmptyStateActions` thành 1 hàng chip; khắc phục lỗi cắt chữ tiêu đề truyện trên mobile và lỗi nút đóng `✕` của `Sheet` đè lên nút header (`isInSheet` -> `pr-10`).
- **P3 — Chat Layout, UI Token & Bilingual/A11y Audit (`src/app/features/chat/components/{ChatApp,ChatMessagesArea,ChatConversationView,ChatBubble,ChatDeepResearch,ChatControls,InputForm,TokenBadge}.tsx`, `src/app/features/layout/components/FloatingMenuTrigger.tsx`, `src/app/features/personas/components/PersonaQuickSwitch.tsx`, `src/app/features/novelcrafter/components/{StoryBibleWorkspace,StoryBibleSectionCard,InlineStoryBibleSection}.tsx`, `src/lib/utils/translations/{vi,en}.ts`)**:
  - Mở rộng khung hiển thị tin nhắn và thanh điều khiển Chat (`max-w-3xl xl:max-w-4xl 2xl:max-w-5xl`, gỡ bỏ `lg:max-w-[90%]`); gom mảng `controls` và `ControlDivider` có điều kiện trong `ChatControls.tsx` (1 hàng trên desktop, cuộn ngang trên mobile); đưa `<textarea>` trong `InputForm.tsx` lên hàng riêng rộng 100% trên mobile (`order-first basis-full md:order-none md:basis-auto md:flex-1`).
  - Khắc phục lỗi nối chuỗi class `"undefined"` và chuyển `FloatingMenuTrigger` sang mép phải giữa màn hình (`top-[45dvh] right-[calc(0.5rem+var(--sar,0px))]`); sửa các class CSS token trong `TokenBadge.tsx` và `PersonaQuickSwitch.tsx` (kèm xử lý lỗi `toast.error` + `logger.error`); thêm skip link `#main-content`, liên kết `htmlFor`/`useId` trong `StoryBibleWorkspace`, phân cấp thẻ tiêu đề `h2`/`h3`, thay thế chuỗi `"Sudowrite"` hiển thị cho người dùng bằng `"Novelcrafter"`, bổ sung đầy đủ các khóa dịch song ngữ Việt/Anh và 11 file unit test co-located (`1625/1625` tests pass).

---

## 2026-10-24: Security & Governance -- Agent Harness Security Hardening (`P0` / `P1` / `P2`)

- **Token-Level Command Whitelist & Secret Path Guard (`.agents/scripts/{command-policy,guard-paths,code-freeze-guard}.js`, `.agents/hooks.json`, `.agents/scripts/run-claude.ps1`)**:
  - **P0-1 (Token Whitelist)**: Thay thế cơ chế blacklist ký tự (`SHELL_ESCAPE_HATCHES`) và regex `\S+` bằng trình phân tích token `command-policy.js` (`tokenizeSegment`, `isSafeUnquotedToken`, `evaluateCommand`), chặn hoàn toàn PowerShell grouping/subexpressions/scriptblocks/splatting (`(...)`, `$(...)`, `@(...)`, `{...}`), Bash process substitution (`<(...)`, `>(...)`), Unicode smart quotes (U+2018–U+201F), và tham số tiêm lệnh trong `run-claude.ps1 -Task`.
  - **P0-3 (Protected Harness & Infra Guard)**: Bổ sung `PROTECTED_INFRA_FILES` (`scripts/code-freeze-guard.js`, `.claude/settings.json`, `.claude/settings.local.json`, `.husky/install.mjs`, `next.config.ts`, `package-lock.json`, `.npmrc`, `AGENTS.md`, `CLAUDE.md`) và `PROTECTED_INFRA_PREFIXES` (`.claude/`, `.husky/`) cùng chuẩn hóa không phân biệt hoa thường (`normalizeForCompare`) trên NTFS.
  - **P1-5 (`.env*` Secret Protection)**: Chặn truy cập `.env*` qua đối số `git status|diff|log|show|blame` (bao gồm `<rev>:<path>`, `--no-index`, và ký tự glob `*?[]`), bổ sung kiểm tra `Grep` (`path` + `glob`) trong `decide()`, và thêm `view_file|read_file` vào matcher của `.agents/hooks.json`.
- **Plan Scope Guard, Always-On Rule Budget & Claude Code Surface (`.agents/scripts/plan-scope.js`, `.agents/rules/{00-core,02-quality,05-plan-review}.md`, `CLAUDE.md`, `.claude/settings.json`, `.claude/settings.local.json`, `.claude/skills/vikini-*/SKILL.md`, `.gitignore`)**:
  - **P1-7 (Plan Scope Guard)**: Trích xuất `extractDeclaredFiles`, `getActiveApprovedPlans`, `getApprovedPlanScope` trong `plan-scope.js` để khi plan đạt `Approved`, hệ thống chỉ tự động mở khóa đúng các file được khai báo `[NEW]`/`[MODIFY]`/`[DELETE]` trong `## Technical Plan` và trả `ask` cho mọi file ngoài phạm vi.
  - **P0-4 (TC-08 Character Budget Fix)**: Chuyển các bảng markdown bị Prettier pad khoảng trắng trong `.agents/rules/02-quality.md` sang danh sách bullet, đưa tổng ký tự 3 tệp `always_on` xuống `< 15,000` ký tự (dưới ngưỡng `< 18,000` của `TC-08`) đồng thời bảo toàn đầy đủ 15 mục bắt buộc trong Normative Preservation Matrix (M5).
  - **P1-6 (Claude Code Governance Surface)**: Thêm `CLAUDE.md` nạp `@AGENTS.md`, `@.agents/rules/00-core.md`, `@.agents/rules/05-plan-review.md`; thêm `.claude/settings.json` gắn `PreToolUse` hook với `"onFailure": "block"` và deny list cho `.env*` / git mutating; dọn dẹp `.claude/settings.local.json`; thêm 4 stub skill `.claude/skills/vikini-{debug,audit,investigate,simplify}/SKILL.md`.
  - **P2 (Fail-Closed Exit Code 2, Fast-Track `.tsx` Hardening, `$PSScriptRoot` & Docs Sync)**: Bổ sung `runHook` + `installCrashHandlers` thoát mã `2` khi có lỗi nội bộ; mở rộng `FAST_TRACK_FORBIDDEN_CONTENT_TSX` chặn các API mạng/storage/eval trên `.tsx`; cố định `$repoRoot` từ `$PSScriptRoot` kèm `Push-Location`/`Pop-Location` trong `run-claude.ps1`; cập nhật đường dẫn trong `streaming-patterns/SKILL.md` và `mental-simulation.md`; thêm 3 file test co-located mới (`guard-paths.test.ts`, `plan-scope.test.ts`, `command-policy.test.ts` — `151/151` tests pass).

---

## 2026-10-24: Bugfix -- Khắc Phục 8 Lỗi Novelcrafter Studio & Bảo Toàn `thoughtSignatures` Trong Chat (`B1`–`B8`)

- **Novelcrafter Prompt Builder, XML Escaping & System Context (`src/lib/features/novelcrafter/{promptBuilder,featureDirectives,storyBibleSerializer,pruneStoryBibleForStream,feedbackParser}.ts`)**:
  - **B1 (Rough Draft Synopsis/Outline Dependencies)**: Bổ sung tham số `writeMode` vào `selectStoryBibleDependencies` và `pruneStoryBibleForStream` (`needsBraindumpForStream`), gửi đầy đủ `<synopsis>` (kèm fallback `<synopsis fallback="braindump">` khi synopsis trống) và `<outline>` cho chế độ `writeMode: "first_draft_rough"`.
  - **B2 (Empty Chapter Write Continuity)**: Mở rộng điều kiện `<previous_chapter_continuity>` trong `buildNovelcrafterUserPrompt` cho cả trường hợp viết chương mới còn trống (`feature === "write" && !chapterProse?.trim()`), cắt cửa sổ `MAX_PREVIOUS_CHAPTER_TAIL_CHARS` (`2,000` ký tự) trước khi escape XML.
  - **B3 (Boundary XML Escaping & Feedback Entity Decoding)**: Giữ nguyên văn dữ liệu thô tại `serializeStoryBibleWithStructuredCards` để không làm hỏng file xuất bản thảo (`manuscriptExporter.ts`), áp dụng `escapeXmlPromptText` một lần duy nhất tại toàn bộ ranh giới ghép thẻ XML trong `promptBuilder.ts` (`xmlNode`) và `featureDirectives.ts` kèm chỉ dẫn có điều kiện `XML_ESCAPE_NOTICE`, và giải mã thực thể XML bằng `unescapeXmlPromptText` trong `parseFeedbackItems`.
  - **B4 (Remove `<studio_context>`)**: Xóa bỏ khối `NOVELCRAFTER_STUDIO_CONTEXT_BLOCK` (`<studio_context>...</studio_context>`) khỏi `buildNovelcrafterSystemInstruction`.
- **Strata Local Provider Routing, Feedback Reply Limit & SSE Cutoff Handling (`src/lib/features/novelcrafter/{novelcrafterStrataProvider.server,novelcrafterStreamRunner.server,types,streamTargetGuard}.ts`, `src/app/api/novelcrafter/stream/route.ts`, `src/app/features/novelcrafter/{utils/novelcrafterSseParser.ts,hooks/useNovelcrafterStream.ts,components/NovelcrafterStudioApp.tsx,components/ChapterEditorWorkspace.tsx,components/ChapterFeedbackGutter.tsx}`, `src/lib/utils/translations/{vi,en}.ts`)**:
  - **B5 (Strata Local Model Support)**: Tạo `novelcrafterStrataProvider.server.ts` (`streamStrataProvider` với quản lý hàng đợi FIFO `release()` trong `finally`, `fitStrataPrompt` 32K, `NOVELCRAFTER_STRATA_THINKING_LEVEL = "low"`, `NOVELCRAFTER_STRATA_SAMPLING = { mode: "creative" }`, và ánh xạ lỗi kết nối sang `StrataOfflineError`), trích xuất `consumeOpenAICompatibleChunks` và nối nhánh `providerId === "local"` trong `novelcrafterStreamRunner.server.ts`, đồng thời kiểm tra `getStrataAdmission()` trước khi giữ chỗ quota tại `POST /api/novelcrafter/stream`.
  - **B6 (Feedback Reply 400 Defense)**: Nâng trần `MAX_CUSTOM_INSTRUCTION_CHARS` lên `15,000` trong `NovelcrafterStreamRequestSchema`, bổ sung helper `buildFeedbackReplyInstruction` cắt an toàn `comment` + `replyText`, và gắn `maxLength={FIELD_MAX_LENGTHS.feedbackReply}` (`2,000`) cho ô nhập phản hồi trong `ChapterFeedbackGutter.tsx`.
  - **B7 (SSE Stream Cutoff without `done` Event)**: Trích xuất `readNovelcrafterSseStream` (flush cả frame cuối chưa có `\n\n`) và `resolveStreamCloseOutcome` (`finishReason: "length"`, `closedWithoutDone: true`), giữ lại phần văn bản đã stream và hiển thị cảnh báo song ngữ `novelcrafterStreamCutoffWarning` khi luồng SSE đóng đột ngột không có sự kiện `done`.
  - _Ghi chú nợ kỹ thuật (Tech Debt)_: Các file hiện hữu `promptBuilder.ts`, `novelcrafterStreamRunner.server.ts`, và `useNovelcrafterStream.ts` đã vượt ngưỡng khuyến nghị 350–400 dòng từ trước; trong phạm vi sửa lỗi này đã trích xuất logic mới sang `novelcrafterStrataProvider.server.ts` và `novelcrafterSseParser.ts` để giảm dòng ròng và ghi nhận tách module nhỏ hơn ở đợt refactor tiếp theo.
- **Chat Multi-Turn `thoughtSignatures` Preservation (`src/app/api/chat-stream/{chatStreamHelpers,contextBuilder}.ts`)**:
  - **B8**: Bổ sung kiểu `ContextMessage` và hàm `extractThoughtSignatures(meta)` lọc an toàn dữ liệu JSONB để truyền `thoughtSignatures` / `thoughtSignature` của các lượt `assistant` trước đó vào `mapMessages`, đảm bảo Gemini 3 và Gemini 4 Argon nhận đầy đủ chữ ký suy luận qua nhiều lượt hội thoại.

---

## 2026-10-24: Governance -- Hardening Mode 4 /blast-radius (`vikini-investigate`)

- **Blast-Radius & Claude CLI (`.agents/skills/vikini-investigate/SKILL.md`, `.agents/scripts/run-claude.ps1`, `docs/lessons-learned.md`)**:
  - Bổ sung 5 bước (A–E: dynamic import, DI/interface, transitive 3 tầng, disambiguation/alias, mocked tests) cùng 2 cột `Tầng (1/2/3)` và `Cách tham chiếu` vào Mode 4 `/blast-radius`; thêm `Escape-NativeArg` trong `run-claude.ps1` cho PowerShell 5.1.

---

## 2026-10-24: Feature -- Tích Hợp Local LLM (Strata Engine - 32K Context, Story Sampling & FIFO Queue)

- **Strata Core & Queue Infrastructure (`src/lib/utils/constants.ts`, `src/lib/core/{strataConfig,strataClient,strataQueue,modelRegistry}.ts`, `env.local.example`)**:
  - Đăng ký mô hình cục bộ `Orcarouter-qwen3.8-flash-next-uncensored-iq3` (`id: "strata-local"`, `providerId: "local"`, `category: "local"`, `tokenLimit: 32768`, `maxOutputTokens: 16384`) trong nhóm riêng **Local Models** (`PROVIDER_LABELS.local`), tắt tìm kiếm web (`modelSupportsWebSearch = false`).
  - Xây dựng `strataConfig.ts` (chốt chặn bảo mật SSRF chỉ cho phép loopback `127.0.0.1` / `localhost` / `::1`), `strataClient.ts` (OpenAI SDK singleton với `maxRetries: 0`, `checkStrataHealth` có bộ nhớ đệm 5s + in-flight dedupe, và `countStrataPromptTokens` truyền `output_config.effort` khớp Jinja template Qwen3.8), và `strataQueue.ts` (hàng đợi FIFO tuần tự `concurrency = 1`, `maxPending = 2`, kèm cổng kiểm tra `getStrataAdmission()` trước khi ghi DB).
- **Thinking Budget, Sampling Presets & 32K Anchor-Window Context Fitter (`src/lib/features/local-llm/{strataThinking,strataContextFit,errors}.ts`, `src/app/api/chat-stream/{validators,contextBuilder}.ts`)**:
  - Thiết lập bảng ngân sách suy luận `STRATA_THINKING_TABLE` (`off`: tắt thinking, `low`: 4K, `medium`: 8K, `high`: 12K) tuân thủ quy tắc dự trữ câu trả lời `#984` của Strata (`serve/server.py:5022-5029`).
  - Bổ sung 3 chế độ thông số sinh văn bản (`STRATA_SAMPLING_PRESETS`: `default` chuẩn Qwen, `creative` tối ưu viết truyện chống lặp từ/liệt kê, và `custom` có `sanitizeStrataSampling` ép miền hợp lệ cho `temperature`, `top_p`, `top_k`, `min_p`, `presence_penalty`) cùng schema kiểm tra `strataSamplingSchema`.
  - Triển khai `strataContextFit.ts` cắt tỉa lịch sử hội thoại theo điểm neo cố định (`fnv1aHash(id) % 4 === 0`) kết hợp `skipSlidingTrim: true` trong `contextBuilder.ts` để giữ nguyên tiền tố KV cache (`Prompt Reuse > 90%`) và loại bỏ hoàn toàn `<think>` khỏi lịch sử các lượt trước.
- **SSE Streaming Engine & Health Endpoint (`src/app/api/chat-stream/streaming/{strata-stream,strata-stream-reader,post-processing,types,utils,index}.ts`, `src/app/api/chat-stream/chatStreamCore.ts`, `src/app/api/local-llm/health/route.ts`)**:
  - Xây dựng `createStrataStream` và `consumeStrataChunks` tách biệt luồng `reasoning_content` (`event: thinking`) và `content` (`event: token`), điều tiết sự kiện `localPromptProgress` tối đa 1 lần/giây, tự động gắn `TIMEOUT_CONFIG.STRATA_LOCAL = 300,000ms` (5 phút) ưu tiên trước `STREAM_TIMEOUT_MS`, hủy kết nối upstream tức thì qua `AbortSignal`, và lưu `extraMeta.thinkingStats` vào cơ sở dữ liệu.
  - Bổ sung route `GET /api/local-llm/health` bảo vệ bởi `await auth()` + `UnauthorizedError`.
- **Chat UI Controls, Live Thinking Telemetry & Bilingual Support (`src/app/features/chat/components/{ModelSelector,ThinkingLevelSelector,LocalSamplingSettings,LocalLlmStatusDot,ChatControls,BubbleHelpers,ChatBubble,ChatConversationView,ChatMessagesArea,StreamErrorBanner}.tsx`, `src/app/features/chat/components/hooks/{useThinkingLevel,useThinkingStats,useStrataSampling,useChatStreamController}.ts`, `src/app/features/chat/hooks/{useLocalLlmHealth,useConversation}.ts`, `src/lib/features/chat/thinkingStats.ts`, `src/lib/utils/translations/{vi,en}.ts`)**:
  - Thêm mục **Local Models** kèm đèn báo trạng thái `LocalLlmStatusDot` trong `ModelSelector.tsx` (tự động ẩn khi `STRATA_ENABLED=false` và khóa chọn khi server offline).
  - Thêm nút & popover **Thông số sinh văn bản (`LocalSamplingSettings.tsx`)** cạnh nút mức độ suy nghĩ trên thanh công cụ chat khi chọn model local; hiển thị tiến độ nạp prompt / vị trí hàng đợi trong `TypingDots` và số token + thời gian suy nghĩ trực tiếp trong `ThinkingBlock`; bổ sung 29 khóa dịch song ngữ Việt/Anh và 15 file unit test (`94/94` tests pass).

---

## 2026-10-24: Refactor -- Đồng Bộ Định Danh Lưu Trữ Tin Nhắn Trong Chat Stream (`insertUserMessage` & `upsertAssistantMessage`)

- **Chat Stream Message Persistence Naming (`src/app/api/chat-stream/chatStreamCore.ts`, `src/app/api/chat-stream/streaming/{types,post-processing,gemini-stream,openai-stream,deepseek-stream,anthropic-stream}.ts`)**:
  - Đổi tên import `saveMessage` thành alias `insertUserMessage` tại `chatStreamCore.ts` để phản ánh rõ hành vi `INSERT` một chiều cho tin nhắn của User (không gắn `clientMessageId` của Assistant).
  - Đổi tên hàm `saveMessageCompat` và thuộc tính `ChatStreamParams.saveMessage` thành `upsertAssistantMessage` xuyên suốt `chatStreamCore.ts`, `types.ts`, `post-processing.ts` và 4 provider stream engines (`gemini-stream.ts`, `openai-stream.ts`, `deepseek-stream.ts`, `anthropic-stream.ts`).
- **Co-Located Stream Unit Tests (`src/app/api/chat-stream/streaming/{gemini-stream,openai-stream,deepseek-stream,anthropic-stream,post-processing}.test.ts`)**:
  - Đồng bộ thuộc tính mock sang `upsertAssistantMessage` theo Test Contract (Loại C — Approved Spec Change), bảo toàn 100% số lượng `expect()` và độ chặt của matcher.

---

## 2026-10-19: Governance -- Remake Hệ Thống Governance 2.0 (Rules, Subagents, Hooks & Skills)

- **Workflows-to-Skills Migration (`.agents/skills/vikini-debug/SKILL.md`, `.agents/skills/vikini-audit/SKILL.md`, `.gitignore`, `scripts/verify-docs.mjs`)**:
  - Di trú toàn bộ 3 file trong `.agents/workflows/` (`debug.md`, `post-fix.md`, `audit.md` — ngừng hỗ trợ từ Antigravity v2.19+) sang 2 skill tự động kích hoạt `.agents/skills/vikini-debug/SKILL.md` (hợp nhất `/debug` 5 pha + 3-Strike Circuit Breaker và `/post-fix` 5 bước) và `.agents/skills/vikini-audit/SKILL.md` (`/audit`).
  - Xóa thư mục `.agents/workflows/`, cập nhật `.gitignore`, và nâng cấp `scripts/verify-docs.mjs` chặn hồi quy `.agents/workflows/`.
- **Subagents Schema Standardization & Deduplication (`.agents/agents/{planner,reviewer,qa}/agent.md`, `.agents/agents/reviewer/{allowlist,evidence-bar}.md`)**:
  - Chuẩn hóa YAML frontmatter của `@planner`, `@reviewer`, `@qa` sang `model: pro` và xóa trường `role:` thừa; xóa `claude-4.6-opus` khỏi `@qa` và cập nhật cơ chế runtime model (`claude-opus-5-5` / `gemini-4-argon`).
  - Loại bỏ việc tự đọc lại chính `agent.md` ở Bước 0 của `@planner` và `@reviewer`, xóa `write_to_file` khỏi `@reviewer` (chỉ dùng `replace_file_content`/`edit_file`), tinh gọn `reviewer/agent.md` xuống `< 7,500 chars`, và đồng bộ `allowlist.md` / `evidence-bar.md` với `READ_ONLY_COMMANDS`.
- **Progressive Disclosure Rules & Context Budget Optimization (`.agents/rules/00-core.md`..`05-plan-review.md`)**:
  - Chuyển `01-coding.md` và `03-ui.md` sang `trigger: glob` (`*.ext, **/*.ext`), tích hợp `Core Coding & Testing Invariants` và phân tách `BANNED Mutating Git Commands` vs `ALLOWED Read-Only Git Inspection` trong `00-core.md`.
  - Tinh giản `02-quality.md` và `05-plan-review.md` theo Ma trận bảo toàn quy chuẩn 15 mục, giảm tổng dung lượng `always_on` xuống `< 18,000 chars` (~4,000 tokens/turn).
- **4-Layer Security Hardening for `run-claude.ps1` & `code-freeze-guard.js` (`.agents/hooks.json`, `.agents/scripts/run-claude.ps1`, `.agents/scripts/code-freeze-guard.js`, `.agents/scripts/code-freeze-guard.test.ts`)**:
  - Xóa bỏ `--dangerously-skip-permissions` trong `run-claude.ps1`; triển khai 4 lớp bảo vệ với `--permission-mode dontAsk`, `--settings` gắn `code-freeze-guard.js` làm `PreToolUse` hook (`"onFailure": "block"`), `--allowedTools` (`Edit(docs/plans/*.md)` và danh sách lệnh Bash read-only có dấu cách trước `*`), `--disallowedTools` (chặn `Write` cho reviewer, chặn `Read(.env*)`, `Edit(src/**)`, gọi đệ quy CLI, `git difftool`, cờ config/output và git mutating), kèm kiểm tra `IsPathRooted` cho `-ArtifactFile` (`exit 43`).
  - Nâng cấp `code-freeze-guard.js`: xóa bỏ hoàn toàn nhánh legacy `.agents/.plan-approved` để `docs/plans/*.md` làm Single Source of Truth duy nhất; bổ sung `evaluateLatestDateGroupPlans` (sắp xếp theo tiền tố `YYYY-MM-DD`, lọc bỏ ngày tương lai `> UTC today + 1 day`, khóa fail-safe khi có kế hoạch cùng ngày chưa duyệt, đóng băng khi `Status: Completed`), `isSelfForgedPlanWrite` (Single-Step Pre-Approved Plan Guard), `.md`-only guard trên toàn bộ `docs/**`, Read Guard cho `.env*`, và `formatHookOutput` chuẩn hóa giao thức `PreToolUse` (trả `null` / exit `0` không stdout khi `allow`, trả `"deny"` dưới `dontAsk` khi chặn).
- **Documentation Sync & Changelog Archival (`.agents/README.md`, `.agents/skills/**`, `docs/CHANGELOG.md`, `docs/archive/CHANGELOG-legacy.md`)\*\*:
  - Sửa toàn bộ đường dẫn thiếu `src/` trong `.agents/skills/` và `04-bilingual.md`, đồng bộ mô tả xác thực API route (`await auth()` + `UnauthorizedError` và `requireUser()`), và lưu trữ 32 mục changelog cũ (`<= 2026-10-15`) sang `docs/archive/CHANGELOG-legacy.md` (đạt `PASS 5/5` trên `scripts/verify-docs.mjs`).

---

## 2026-10-19: Maintenance -- Vitest 4.1.12 & add-model SKILL.md

- **Vitest 4.1.12 Upgrade (`package.json`, `package-lock.json`)**:
  - Nâng cấp đồng thời 3 gói devDependencies trực tiếp (`vitest`, `@vitest/coverage-v8`, `@vitest/ui`) từ `^4.1.11` lên `^4.1.12` và tái sinh `package-lock.json` để toàn bộ 10 node (`vitest` và 9 gói `@vitest/*`) resolve về `4.1.12`.
  - Ghi nhận trung thực: lỗ hổng `CVE-2026-84373` (`GHSA-82fw-gwwq-j7x9`, path traversal trong `@vitest/mocker`) đã được vá từ bản `4.1.11` (`npm audit` có 0 cảnh báo cho `vitest`/`@vitest/*` cả trước và sau nâng cấp); bản `4.1.12` bổ sung hardening cho manual/redirect mocks (`vitest` PR #11580) và nâng sàn semver trong `package.json`.
- **Standardize `add-model` Skill (`.agents/skills/add-model/SKILL.md`, `.agents/skills/README.md`, `.gitignore`)**:
  - Di chuyển `.agents/skills/add-model.md` sang cấu trúc thư mục `.agents/skills/add-model/SKILL.md` với YAML frontmatter chuẩn (`name: add-model`, `description: "MANDATORY when..."`) và giữ nguyên văn nội dung hướng dẫn, đồng bộ 8/8 skill nội bộ Vikini sang cấu trúc thư mục có trigger tự động.
  - Cập nhật whitelist trong `.gitignore` từ `!.agents/skills/add-model.md` sang `!.agents/skills/add-model/`, cập nhật 2 liên kết định tuyến tại `.agents/skills/README.md`, và xóa file cũ `.agents/skills/add-model.md`.

---

## 2026-10-19: Governance -- Swap Planner & Reviewer Execution Channels (Dual-Planner Claude CLI Primary + Dual-Reviewer @reviewer Primary)

- **Dual-Planner Architecture (`.agents/scripts/claude-planner-prompt.md`, `.agents/scripts/run-claude.ps1`, `.agents/agents/planner/agent.md`)**:
  - Thiết lập **Claude Code CLI** làm **Primary Technical Planner** (`.agents/scripts/run-claude.ps1 -Role planner`) nạp prompt template mới `.agents/scripts/claude-planner-prompt.md` chứa đầy đủ 10 mục bắt buộc, 8 nguyên lý `pstack`, Tech Stack bất biến của Vikini, quy tắc Online Grounding 2026, và quy trình _In-Place Plan Updating_ cho Revision Loop.
  - Cấu hình **Subagent `@planner`** (`gemini-4-argon` max thinking) làm **Fallback Technical Planner** tự động kích hoạt khi Claude Code CLI hết quota Claude Pro (`exit code 42` / `[CLAUDE_PRO_QUOTA_EXCEEDED]`) hoặc lỗi kết nối (`exit code 40/41`).
  - Nâng cấp `.agents/scripts/run-claude.ps1` hỗ trợ đa chế độ `-Role planner|reviewer` (alias `-Mode`, hỗ trợ `plan|review`), `-Task` (alias `-Prompt`), `-PlanFile`, `-ArtifactFile`; bổ sung hàm `Normalize-PlanPath` xử lý an toàn đường dẫn file kế hoạch mới chưa tồn tại trên đĩa và chặn đường dẫn ngoài `docs/plans/*.md`; phân tách `--allowedTools` theo nguyên tắc Least Privilege (`Write,Edit` cho `planner`, chỉ `Edit` cho `reviewer`); tự động đồng bộ sang `-ArtifactFile`.
- **Dual-Reviewer Architecture Đảo Chiều (`.agents/agents/reviewer/agent.md`, `.agents/scripts/claude-reviewer-prompt.md`, `.agents/rules/05-plan-review.md`)**:
  - Thiết lập **Subagent `@reviewer`** (`gemini-4-argon` max thinking) làm **Primary Lead Architecture Reviewer**; bổ sung công cụ `write_to_file` và `replace_file_content` vào YAML frontmatter kèm ràng buộc **Audit-Only Write Scope** (chỉ được phép append `### Audit Run [X+1]` vào `## Audit History`, cập nhật dòng `- **Status**: Approved` / `Changes Requested` ở phần Header, và ghi thẻ `[PLAN_APPROVED]` ở dòng cuối cùng của file kế hoạch tại `docs/plans/*.md` cùng `implementation_plan.md`).
  - Cập nhật **Claude Code CLI** (`.agents/scripts/run-claude.ps1 -Role reviewer` + `.agents/scripts/claude-reviewer-prompt.md`) làm **Fallback Reviewer** đồng bộ đủ 7 hạng mục Plan Completeness Gate, mục _Các Tấn Công Đã Thử_ và quy tắc cập nhật `- **Status**:` ở Header.
- **Code Freeze Guard & Governance Docs Sync (`.agents/scripts/code-freeze-guard.js`, `.agents/scripts/code-freeze-guard.test.ts`, `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/README.md`, `docs/architecture.md`, `docs/plans/README.md`)**:
  - Mở rộng regex `READ_ONLY_COMMANDS` trong `.agents/scripts/code-freeze-guard.js` hỗ trợ cờ `-NoProfile` và đường dẫn bọc ngoặc kép cho `run-claude.ps1`; bổ sung 8 unit tests mới (`SW-G1..SW-G8`, nâng tổng số lên 92/92 tests pass) trong `.agents/scripts/code-freeze-guard.test.ts`.
  - Đồng bộ hóa toàn bộ tài liệu Governance và Living Docs, tuân thủ nghiêm ngặt trần ký tự Governance (`.agents/rules/*.md <= 12,000` ký tự, `.agents/agents/*/agent.md <= 10,000` ký tự).

---

## 2026-10-19: Governance -- Vikini Skills Standardization (SKILL.md), pstack/fstack/AAS Curation & Fast-Track Mode

- **Foreign Skills Cleanup (`.agents/skills/`, `.claude/skills/`, `skills-lock.json`, `.gitignore`)**:
  - Gỡ bỏ 3 bộ skill bên thứ ba gây xung đột và tốn context (`redesign-existing-projects`, `design-taste-frontend`, `ux-ui-agent-skills`), xóa 2 NTFS junction tương ứng trong `.claude/skills/` và 2 entry trong `skills-lock.json`.
  - Cập nhật `.gitignore` sang `.agents/skills/*` kèm danh sách whitelist `!` để git theo dõi chính thức các skill do Vikini sở hữu.
- **Vikini Internal Skills Standardization (`.agents/skills/<name>/SKILL.md`, `.agents/skills/README.md`)**:
  - Chuẩn hóa 5 skill kỹ thuật cốt lõi (`api-patterns`, `streaming-patterns`, `database-migration`, `add-feature`, `add-translation`) sang định dạng thư mục `.agents/skills/<name>/SKILL.md` với YAML frontmatter `name` và `description` dạng trigger bắt buộc (`MANDATORY when...`).
  - Cập nhật toàn bộ đường dẫn tham chiếu trong `.agents/rules/`, `.agents/workflows/audit.md`, `.agents/agents/reviewer/mental-simulation.md`, `.agents/skills/add-model.md`, và bảng định tuyến tại `.agents/skills/README.md`.
- **New Curated Workflow Skills (`.agents/skills/vikini-investigate/SKILL.md`, `.agents/skills/vikini-simplify/SKILL.md`)**:
  - Bổ sung skill read-only `vikini-investigate` với 4 chế độ điều tra kiến trúc (`/how`, `/why`, `/recall`, `/blast-radius`) và skill rút gọn mã nguồn giữ nguyên hành vi `vikini-simplify` (`<= 150` dòng/file).
- **4-Tier Skill Enforcement & Engineering Discipline (`.agents/rules/00-core.md`, `.agents/rules/02-quality.md`, `.agents/rules/03-ui.md`, `.agents/agents/planner/agent.md`, `.agents/agents/reviewer/agent.md`, `.agents/scripts/claude-reviewer-prompt.md`)**:
  - Thiết lập cơ chế **Skill Precedence Hierarchy (`Vikini-First, Superpowers-Complementary`)** trong `02-quality.md`, quy tắc **Token Efficiency (`tokenleak` discipline)** trong `00-core.md`, và **4 UI States (`Loading`, `Empty`, `Error`, `Success`)** trong `03-ui.md`.
  - Bổ sung các mục bắt buộc `Out of Scope`, `Skills Loaded & Applied`, `Caller-First Design Sketch`, và `8 Nguyên Lý Kỹ Thuật Cốt Lõi (pstack)` vào `@planner`, đồng thời tích hợp cổng kiểm tra tương ứng vào `@reviewer` và `claude-reviewer-prompt.md`.
- **Fast-Track Mode for Micro-UI Edits (`.agents/rules/05-plan-review.md`, `.agents/scripts/code-freeze-guard.js`, `.agents/scripts/code-freeze-guard.test.ts`)**:
  - Hỗ trợ **Fast-Track Mode (§1.1)**: cho phép `replace_file_content` `<= 40` dòng trên bề mặt UI/translation/styling (`src/lib/utils/translations/{vi,en}.ts`, `src/app/styles/**/*.css`, `src/app/**/*.tsx` trừ `api/`, `src/components/**/*.tsx`) khi chưa có `[PLAN_APPROVED]`, đặt sau toàn bộ các chốt chặn Scoped Protection và chặn nội dung nhạy cảm (`"use server"`, `process.env`, `*.server`).
  - Bổ sung bộ unit test đầy đủ (`countLines`, `isFastTrackEligible`, `decide — Fast-Track Mode`, các case `FT-C1..C4`, `FT-H1..H7`, `FT-N1..N18`, `FT-R1..R3`) trong `.agents/scripts/code-freeze-guard.test.ts`.

---

## 2026-10-18: Feature & UX Upgrade -- Novelcrafter Studio Phase 3: Codex Alias Auto-Matching, Rolling Chapter Summary (<story_so_far>), Chapter Snapshots with Word-Level Diff, Inline Selection Action Bar & Manuscript Export (.md / .txt)

- **Codex Alias & Context Auto-Matching (`src/lib/features/novelcrafter/codexMatcher.ts`, `src/lib/features/novelcrafter/storyBibleSerializer.ts`, `src/lib/features/novelcrafter/pruneStoryBibleForStream.ts`, `src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx`)**:
  - Hỗ trợ `aliases` (tối đa 10 biệt danh/thẻ) và cờ `alwaysInclude` trên `StoryBibleCharacterCard` và `StoryBibleWorldElement`.
  - Xây dựng bộ khớp ngữ cảnh thông minh `codexMatcher.ts` hỗ trợ ranh giới từ Unicode tiếng Việt (`(?<![\p{L}\p{N}_])...(?![\p{L}\p{N}_])` với cờ `iu`) và CJK fallback, tự động chỉ đưa các thẻ Codex xuất hiện trong chương hiện tại (hoặc được ghim `alwaysInclude: true`) vào prompt AI để tiết kiệm token context.
  - Bổ sung hàm `escapeXmlPromptText` bảo vệ toàn bộ trường văn bản người dùng trước khi nhúng vào các khối XML trong `promptBuilder.ts`.
- **Rolling Chapter Summary & Multi-Chapter Memory (`src/lib/features/novelcrafter/types.ts`, `src/lib/features/novelcrafter/featureDirectives.ts`, `src/lib/features/novelcrafter/promptBuilder.ts`, `src/lib/features/novelcrafter/streamTargetGuard.ts`, `src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx`)**:
  - Bổ sung trường `chapter.summary` (`MAX_CHAPTER_SUMMARY_CHARS = 4,000`) và đích stream trực tiếp `bibleTarget: "chapter_summary"` với nút **"Tóm tắt chương bằng AI"** ngay trong `ChapterDraftBeatsCard.tsx`.
  - Tự động tổng hợp tóm tắt của các chương trước (`buildPreviousChapterSummariesText`, giới hạn `MAX_STORY_SO_FAR_CHARS = 6,000`) và bơm vào khối `<story_so_far>` bên trong `<chapter_context>` cho các tác vụ `write`, `rewrite`, `expand`, `feedback`, `brainstorm` và `bible (scenes/draft)`.
- **Chapter Snapshots & Word-Level Diff Viewer (`src/lib/features/novelcrafter/draftStorage.ts`, `src/lib/features/novelcrafter/feedbackParser.ts`, `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts`, `src/app/features/novelcrafter/components/ChapterSnapshotsModal.tsx`, `src/app/features/novelcrafter/components/SheetSubToolbar.tsx`)**:
  - Hỗ trợ lưu tối đa 5 phiên bản Snapshot (`MAX_CHAPTER_SNAPSHOTS = 5`) cho mỗi chương với cơ chế chống trùng lặp nội dung, tự động sao lưu trước khi khôi phục, và **Tier 2 Payload Budget Trimming** trong `enforceStatePayloadBudget` (tự động cắt giảm các snapshot cũ nhất nếu tổng dung lượng vượt ngân sách 1.8MB mà không chạm vào văn xuôi chính).
  - Nâng cấp `computeWordDiff` với bước cắt tiền tố và hậu tố chung $O(N)$ trước khi chạy LCS DP, giúp so sánh tức thì các chương dài trong `ChapterSnapshotsModal.tsx`.
- **Inline Selection Action Bar (`src/app/features/novelcrafter/components/ChapterSelectionToolbar.tsx`, `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`)**:
  - Hiển thị thanh công cụ nổi 1-click ngay khi bôi đen văn bản trong chương (`Rephrase`, `Show, Don't Tell`, `Shorter`, `Expand`, `Describe`, `Line Edit Feedback`, `Quick Edit Ctrl+K`).
- **Manuscript Export (`src/lib/features/novelcrafter/manuscriptExporter.ts`, `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`)**:
  - Hỗ trợ xuất toàn bộ bản thảo truyện ra file Markdown (`.md`) hoặc Plain Text (`.txt`) với tùy chọn đính kèm Hồ sơ Truyện (`includeStoryBible`) và Tóm tắt Chương (`includeChapterSummaries`).
- **Co-Located Unit Tests (TC-301..TC-308)**:
  - Tạo mới `codexMatcher.test.ts` và `manuscriptExporter.test.ts`, đồng thời mở rộng 7 bộ unit test hiện có (`storyBibleSerializer.test.ts`, `featureDirectives.test.ts`, `promptBuilder.test.ts`, `stateLimits.test.ts`, `draftStorage.test.ts`, `feedbackParser.test.ts`, `streamTargetGuard.test.ts`).
