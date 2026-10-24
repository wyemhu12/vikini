# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

> [!NOTE]
> Các bản ghi lịch sử phát hành từ ngày 2026-10-15 trở về trước (<= 2026-10-15) được lưu trữ nguyên vẹn tại [CHANGELOG Legacy Archive](./archive/CHANGELOG-legacy.md).

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

---

## 2026-10-17: Bug Fix & Hardening -- Novelcrafter Studio: Phase 1 & Phase 2 Comprehensive Audit Fixes, Stream Lifecycle Guard, Corrupted State Backup & Co-Located Test Suite

- **Stream Lifecycle, Pending Story Promotion & Refusal Card Guard (`src/lib/features/novelcrafter/streamRunRegistry.ts`, `src/app/features/novelcrafter/hooks/useNovelcrafterStream.ts`, `src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`, `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`, `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx`)**:
  - Sửa triệt để lỗi tự hủy stream (`abort()`) và kẹt `isStreaming = true` khi người dùng bấm công cụ AI lần đầu trên truyện mới (`selectedConversationId: null -> newStoryId`): khởi tạo `AbortController` và bật `isStreaming` trước khi `await ensureStoryConversation()`, bọc `try/catch/finally` với cờ `isPromotingStoryRef`, tách hàm thuần `shouldAbortStreamOnConversationChange` và tách riêng unmount cleanup effect.
  - Đồng bộ `selectedConversationId: story.validStoryId` cho `useDirectStreamBridge` trong `NovelcrafterStudioApp.tsx`.
  - Chặn tạo thẻ History rác khi mô hình phát văn bản từ chối (`isLikelyModelRefusalOutput` / `handledRefusal`) và hoãn hiển thị `toast.error` tới sau `onStreamTerminated` để tránh trùng lặp thông báo.
- **Feedback Stream Merge & Reply Preservation (`src/lib/features/novelcrafter/feedbackParser.ts`, `src/app/features/novelcrafter/hooks/useDirectStreamBridge.ts`, `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`)**:
  - Bổ sung hàm thuần `mergeStreamedFeedbackItems` và cố định `feedbackBaseItemsRef` khi bắt đầu stream `feedback`, bảo toàn nguyên vẹn các thẻ `resolved` và thẻ `open` đã có `userReply`/`rating` qua từng frame `requestAnimationFrame`, đồng thời truyền `replyToFeedbackId` khi phản hồi nhận xét.
- **Serverless Quota Guard, Token-Only Quota Commit & Corrupted State Backup (`src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`, `src/lib/features/novelcrafter/streamQuotaGuard.server.ts`, `src/lib/features/novelcrafter/storyPersistence.server.ts`, `src/lib/features/novelcrafter/draftStorage.ts`, `src/app/features/novelcrafter/hooks/useNovelcrafterCatalog.ts`, `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts`, `src/app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts`, `src/app/features/novelcrafter/components/DestructiveSaveConfirmModal.tsx`)**:
  - Chỉ gọi `onFirstModelOutput()` khi phát ra `token` chunk thực sự (không trừ hạn ngạch nếu mô hình chỉ phát `thinking` rồi lỗi), và làm sạch thông báo lỗi SSE qua `sanitizeError(err, true)`.
  - Gia hạn TTL có điều kiện `redis.expire(key, INFLIGHT_TTL_SECONDS, "NX")` khi `inFlight > 1` và giải phóng bộ đếm nguyên tử bằng Lua script `DECR_AND_CLEANUP_LUA` qua `redis.eval`.
  - Khi giải mã `story_state` thất bại, ném `AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED")` thay vì trả về state rỗng mặc định; cô lập state ở phía client (`resolveStoryLoadFailureState`), khóa autosave (`shouldBlockAutosaveForStory`) và khóa editor (`isLoadLocked`), phân biệt lỗi mạng/DB tạm thời với lỗi hỏng giải mã (`resolveLoadLockRecoveryAction`), bảo vệ owner sau `await` (`shouldApplyLoadLockRetryResult`), và lưu bản sao lưu dòng hỏng vào dòng `messages` riêng (`meta.novelcrafterType = "story_state_corrupted_backup"`) trước khi ghi đè.
- **Prompt Context Window, Structured Cards Rewrite, Parsers & UI/Bilingual Polish (`src/lib/features/novelcrafter/promptBuilder.ts`, `src/lib/features/novelcrafter/featureDirectives.ts`, `src/lib/features/novelcrafter/characterParser.ts`, `src/lib/features/novelcrafter/openingsParser.ts`, `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`)**:
  - Giữ 25% đầu chương (`4,500` ký tự) + 75% cuối chương (`13,500` ký tự) trong `<preceding_prose>` khi chương vượt quá `18,000` ký tự.
  - Tích hợp `serializeStoryBibleWithStructuredCards` vào `buildBibleDirective` và nối `chapterExtraInstructions` vào đủ 5 sub-mode của `write`, `rewrite`, và 2 sub-mode của `expand`.
  - Sửa regex `characterParser.ts` bảo toàn tên có dấu gạch nối (`Spider-Man`, `Jean-Luc Picard`, `T-800`) và sửa `openingsParser.ts` hỗ trợ tiêu đề bọc dấu `**`.
  - Chuẩn hóa toàn bộ 9 vị trí `text-[10px]`/`text-[11px]`/`py-0.2` sang `text-xs`/`py-0.5` và cập nhật chuỗi dịch thuật từ 5 tính năng sang 6 tính năng.
- **Co-located Unit Tests**:
  - Tạo mới 6 file unit test (`characterParser.test.ts`, `openingsParser.test.ts`, `pruneStoryBibleForStream.test.ts`, `streamRunRegistry.test.ts`, `modelGuards.server.test.ts`, `novelcrafterStreamStore.test.ts`) và mở rộng 9 file unit test hiện có theo Test Contract TC-01..TC-10 (21/21 files, 97/97 tests trong phân hệ Novelcrafter pass 100%).

---

## 2026-10-16: Feature, UX & Architecture Upgrade -- Novelcrafter Studio: Expandable History Cards with Model Badges, Sudowrite UX Parity, Foldable/Mobile Responsive Layout & Data Integrity Hardening

- **Expandable History Cards & Model Provenance Badge (`src/app/features/novelcrafter/components/NovelcrafterHistoryCardItem.tsx`, `src/app/features/novelcrafter/components/NovelcrafterCardMetaBadges.tsx`, `src/app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx`, `src/lib/features/novelcrafter/modelDisplay.ts`, `src/lib/features/novelcrafter/openingsParser.ts`)**:
  - Bổ sung nút **`[Đọc toàn bộ / Thu gọn]`** (`aria-expanded`, `aria-controls`) kèm hiệu ứng mờ dần đáy (`bg-linear-to-t`) cho các thẻ AI History dài hơn `180px`. Khi bấm mở rộng, thẻ giãn toàn bộ chiều cao tự nhiên trong luồng flex (`space-y-3`), đẩy mượt các thẻ phía dưới xuống mà không dùng thanh cuộn lồng bên trong thẻ; khi thu gọn, thẻ trở về đúng trạng thái ban đầu. Hỗ trợ thêm nút **`[Mở rộng tất cả / Thu gọn tất cả]`** trên thanh tiêu đề cột History.
  - Bổ sung **Model Badge** (`NovelcrafterCardMetaBadges.tsx` + `resolveModelDisplayInfo`) hiển thị rõ tên mô hình AI đã sử dụng (Gemini 4 Argon, Claude Sonnet 4.6, DeepSeek, Grok,...) kèm màu sắc theo nhà cung cấp, tooltip hiển thị đường dẫn định tuyến thực tế (`routedModel` qua OpenRouter), và huy hiệu cảnh báo khi luồng dừng sớm (`finishReason: length | safety | error | aborted`).
  - Tự động loại bỏ nhãn cảnh báo cắt bớt (`stripCardTruncationNotice`) trước khi chèn (`Append`), thay thế (`Replace`), hoặc sao chép (`Copy`) văn bản vào chương truyện, đồng thời hỗ trợ tách riêng 3 phương án mở đầu (`parseThreeOpenings`) thành các nút chèn nhanh độc lập.
- **Sudowrite UX Parity: Sheet Sub-Toolbar, Empty-Chapter Quick Starters & Structured Story Bible Cards (`src/app/features/novelcrafter/components/SheetSubToolbar.tsx`, `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx`, `src/app/features/novelcrafter/components/StoryBibleStructuredCards.tsx`, `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx`, `src/lib/features/novelcrafter/storyBibleSerializer.ts`, `src/lib/features/novelcrafter/characterParser.ts`)**:
  - Bổ sung thanh định dạng đầu trang giấy **`SheetSubToolbar`** (In đậm, In nghiêng, Gạch ngang, Tiêu đề H1/H2, Danh sách, Phân cảnh `***`, đổi cỡ chữ `A- / A / A+`, đếm từ, và nút **Chế độ tập trung / Focus Mode** ẩn toàn bộ thanh bên).
  - Bổ sung **3 thẻ khởi đầu nhanh kiểu Sudowrite (`ChapterEmptyStateActions`)** ngay trên trang giấy khi chương đang trống: _Tự động viết đoạn mở đầu_, _Gợi ý 3 cách mở đầu khác nhau_, và _Tạo bản nháp từ Phân cảnh (Scenes)_.
  - Nâng cấp **Story Bible** hỗ trợ song song **Thẻ cấu trúc (Structured Cards)** và **Khung ghi chú tự do (Free-form Notes)** cho _Characters_ (kèm trích xuất tự động từ Markdown `parseCharacterCardsFromMarkdown` và công tắc `Hiển thị cho AI` từng nhân vật), _Worldbuilding & Lore_, và _Outline_ (kèm nút **Đẩy sang Scenes chương đang mở** và chọn nhanh **POV / Tense** ngay trên đầu mục Outline).
- **Mobile, Tablet & Foldable Responsive Architecture — Galaxy Z Fold 8 / iPhone Fold (`src/lib/features/novelcrafter/studioLayout.ts`, `src/app/features/novelcrafter/hooks/useStudioLayout.ts`, `src/components/ui/sheet.tsx`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`, `src/app/features/novelcrafter/components/ChapterAiToolbar.tsx`, `src/app/features/novelcrafter/components/ChapterAiToolMenus.tsx`)**:
  - Thiết kế bộ tính toán bố cục thích ứng 3 tầng (`Compact <640px`, `Medium / Foldable Inner 640–1179px`, `Expanded >=1180px`): tự động chuyển cột Chapters/Bible trái và History phải sang ngăn kéo trượt (`Sheet` drawer) và chuyển cột nhận xét Feedback sang `bottom-sheet` trên màn hình hẹp hoặc màn hình gập, bảo đảm vùng soạn thảo văn xuôi luôn rộng rãi và rõ ràng.
  - Hỗ trợ thu gọn thanh công cụ AI (`[Thêm công cụ / Thu gọn]`) trên màn hình nhỏ, giới hạn chiều cao menu `max-h-[55dvh] overflow-y-auto`, mục tiêu chạm tối thiểu `36px–44px`, lắng nghe `visualViewport` bù trừ bàn phím ảo (`--nc-kb-offset`), và bảo vệ phím `Escape` (`shouldCancelStreamOnEscape`) không hủy nhầm luồng AI khi người dùng chỉ đóng menu/popover/drawer.
- **Data Integrity, Concurrency & Serverless Stream Quota Hardening (`src/lib/features/novelcrafter/stateLimits.ts`, `src/lib/features/novelcrafter/storyPersistence.server.ts`, `src/lib/features/novelcrafter/streamQuotaGuard.server.ts`, `src/lib/features/novelcrafter/modelGuards.server.ts`, `src/app/features/novelcrafter/components/DestructiveSaveConfirmModal.tsx`)**:
  - Thay thế cơ chế fallback xóa trắng truyện khi vượt giới hạn ký tự bằng `coerceStoryStateToLimits` (`stateLimits.ts`) cắt gọt an toàn từng trường độc lập.
  - Bổ sung chốt chặn **Chống ghi đè mất dữ liệu (`DESTRUCTIVE_SAVE_REJECTED` HTTP 409)** kèm hộp thoại xác nhận `DestructiveSaveConfirmModal.tsx` và kiểm tra CAS `.eq("meta->>version", ...)` tại `storyPersistence.server.ts`.
  - Xây dựng cơ chế giữ chỗ hạn ngạch đồng thời trên Upstash Redis (`reserveNovelcrafterStreamQuota`) kết hợp trừ lượt dùng hàng ngày trễ (`onFirstModelOutput`) để không làm mất lượt của người dùng nếu nhà cung cấp AI báo lỗi trước khi sinh chữ.
- **Co-located Unit & Component Tests & Bilingual Polish (`src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`)**:
  - Đồng bộ toàn bộ khóa dịch thuật của các component mới (`NovelcrafterHistoryCardItem`, `NovelcrafterCardMetaBadges`, `StoryBibleStructuredCards`, `SheetSubToolbar`, `ChapterEmptyStateActions`, `DestructiveSaveConfirmModal`, `ChapterEditorWorkspace`, `useNovelcrafterStateMutators`, `useStoryBibleMutators`), khắc phục triệt để lỗi hiển thị tên biến thô (codenames) trên nút bấm.
  - Làm sạch toàn bộ chuỗi tiếng Việt trong `vi.ts`, loại bỏ phần mở ngoặc tiếng Anh dư thừa để giao diện tiếng Việt tự nhiên và nhất quán.
  - Bổ sung kiểm thử cho `stateLimits.test.ts`, `modelDisplay.test.ts`, `studioLayout.test.ts`, `storyBibleSerializer.test.ts`, `streamQuotaGuard.server.test.ts`, và `NovelcrafterHistoryCardItem.test.tsx`.
