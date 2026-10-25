# CHANGELOG Legacy Archive -- Vikini

> Lưu trữ lịch sử phát hành dự án Vikini cho các bản ghi từ ngày 2026-10-19 trở về trước (<= 2026-10-19).
> File này chỉ phục vụ mục đích tra cứu lịch sử, không chỉnh sửa trực tiếp.

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

---

## 2026-10-15: Bug Fix -- Novelcrafter Studio: Gemini 3+ Thinking & Safety Hardening, Rank Model Guard, Manuscript Refusal Protection & DOM Mirror Feedback Scroll Positioning

- **Gemini 3+ Stream Hardening, Pro Rank Sync & Model Guard (`src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`, `src/lib/core/modelAccess.ts`, `src/app/features/chat/components/hooks/useAllowedModels.ts`, `src/app/features/novelcrafter/hooks/useNovelcrafterModelGuard.ts`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`, `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`)**:
  - Đồng bộ cấu hình `rank_configs` trên Supabase bổ sung `"gemini-4-argon"` cho gói `pro` và xóa trực tiếp khóa cache Redis `rank_configs:all` (`exists === 0`).
  - Cấu hình `thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: true }` cho dòng model Gemini 3 (`gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`), đồng bộ 4 danh mục `safetySettings` (`HarmBlockThreshold.BLOCK_NONE`) và phát hiện stream rỗng/bị chặn (`emittedTokenCount === 0`) để gửi sự kiện SSE `event: error` minh bạch về client.
  - Xây dựng hook `useNovelcrafterModelGuard.ts` và hàm `reconcileAllowedStoryModel` (kèm cờ `isResolved` trong `useAllowedModels.ts` và khóa kiểm tra model hợp lệ trong vòng lặp reverse-match của `isModelAllowedById`) giúp chặn chọn model vượt cấp bậc tài khoản và tự động chuyển bản nháp cũ về model hợp lệ mà không bị ảnh hưởng khi lỗi mạng.
- **Creative Fiction `<studio_context>` Framing & Manuscript Refusal Protection (`src/lib/features/novelcrafter/promptBuilder.ts`, `src/lib/features/novelcrafter/streamTargetGuard.ts`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`)**:
  - Luôn gắn khối `<studio_context>` định danh không gian sáng tác tiểu thuyết hư cấu chuyên nghiệp trong `buildNovelcrafterSystemInstruction` ngay cả khi tác giả sử dụng `masterGemInstructions` tùy chỉnh.
  - Bổ sung `isLikelyModelRefusalOutput` trong `streamTargetGuard.ts`: khi mô hình phát văn bản từ chối ngắn ở luồng ghi trực tiếp vào bản thảo (`chapter_prose`, `chapter_scenes`, `bible_field`), hệ thống khôi phục nguyên vẹn `target.baseContent`, hủy lưu DB (`shouldPersistState: false`, `shouldSavePartialHistory: false`) và hiển thị `toast.error` thay vì nối câu từ chối vào chương truyện của tác giả.
- **DOM Mirror Feedback Quote Scroll Positioning (`src/lib/features/novelcrafter/quoteScrollPositioning.ts`, `src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`)**:
  - Thay thế công thức nội suy tỷ lệ ký tự sai lệch bằng module `quoteScrollPositioning.ts` (`measureCaretOffsetTop` sao chép 24 thuộc tính computed CSS sang phần tử DOM mirror ẩn với khối dọn dẹp `try ... finally`, kết hợp `computeQuoteScrollTop` đưa câu trích dẫn về vị trí 1/3 trên khung nhìn — Sudowrite Golden Third).
  - Trong `ChapterEditorWorkspace.tsx`, gọi `focus({ preventScroll: true })`, `setSelectionRange(start, end)` và thực thi phép đo + `scrollTo({ behavior: "smooth" })` bên trong `requestAnimationFrame` có quản lý vòng đời `scrollRafRef` để triệt tiêu hành vi tự động cuộn lệch của trình duyệt.
- **Co-located Unit Tests**:
  - Bổ sung và mở rộng kiểm thử tại `quoteScrollPositioning.test.ts`, `modelAccess.test.ts`, `promptBuilder.test.ts`, `streamTargetGuard.test.ts`, `feedbackParser.test.ts`, và `novelcrafterStreamRunner.server.test.ts` (129/129 test files, 1,349/1,349 tests passed).

---

## 2026-10-15: Feature & Bug Fix -- Novelcrafter Studio: Full-Width Document Canvas, Inline Unified Story Bible & Gemini 4 / Claude Model Stream Fix

- **Full-Width Responsive Document Canvas (`src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`, `src/app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx`, `src/app/features/novelcrafter/hooks/useAutoResizeTextarea.ts`)**:
  - Gỡ bỏ giới hạn cố định `max-w-[820px]` trên khung văn bản chính và thẻ phân cảnh (Scenes / Beats), thay bằng hệ thống container co giãn thông minh `w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl` kết hợp lề `px-6 md:px-12 lg:px-16` giúp loại bỏ hoàn toàn khoảng trống đen lãng phí ở nửa phải màn hình rộng.
  - Tách component chuyên biệt `ChapterDraftBeatsCard.tsx` cho thẻ phân cảnh chương và xây dựng hook `useAutoResizeTextarea.ts` hỗ trợ chuẩn CSS hiện đại `[field-sizing:content]` kết hợp JS fallback bảo toàn vị trí cuộn `scrollTop`.
- **Hợp nhất Story Bible vào Luồng Cuộn Liền Mạch (Inline Unified Scroll Canvas) (`src/app/features/novelcrafter/components/InlineStoryBibleSection.tsx`, `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx`, `src/app/features/novelcrafter/components/StoryBibleSectionCard.tsx`, `src/app/features/novelcrafter/components/NovelcrafterStudioApp.tsx`, `src/app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts`)**:
  - Thay thế cơ chế chuyển đổi cửa sổ độc quyền (`{isStoryBibleOpen ? <StoryBibleWorkspace /> : <ChapterEditorWorkspace />}`) bằng mô hình **Trang tài liệu thống nhất kiểu Sudowrite**: Khung truyện chính nằm trên, phân khu Hồ sơ Vũ trụ Truyện (Story Bible) dạng Accordion nằm ngay phía dưới, ngăn cách bởi đường viền mảnh và công tắc thu gọn/mở rộng linh hoạt.
  - Tích hợp điều hướng nhảy mục từ cột trái (`NovelcrafterLeftNavigator.tsx`) với cơ chế nonce (`jumpRequest: { section, nonce }`), tự động mở Story Bible nếu đang đóng và cuộn mượt (`scrollIntoView({ behavior: "smooth" })`) đến đúng mục mà không gây hiện tượng tự động nhảy trang khi khởi động (cold-start).
  - Tách thẻ `StoryBibleSectionCard.tsx` giảm kích thước `StoryBibleWorkspace.tsx` về dưới 370 dòng, tuân thủ nghiêm ngặt giới hạn file size.
- **Khắc phục lỗi chạy Gemini 4 Argon & Claude OpenRouter Fallback (`src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`, `src/lib/core/modelAccess.ts`, `src/app/features/novelcrafter/components/NovelcrafterTopBar.tsx`, `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.test.ts`, `src/lib/core/modelAccess.test.ts`)**:
  - Cấu hình bắt buộc `thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM, includeThoughts: true }` theo enum chữ hoa chuẩn của SDK `@google/genai` cho Gemini 4 Argon (`gemini-4-argon`), sửa lỗi không sinh dữ liệu hoặc ném lỗi tham số không hợp lệ.
  - Bổ sung cơ chế tự động định tuyến fallback sang OpenRouter cho các model Claude (`CLAUDE_API_MODELS.OPENROUTER`) khi môi trường server không trực tiếp khai báo `ANTHROPIC_API_KEY`.
  - Tách module client-safe `isModelAllowedById` trong `modelAccess.ts` hỗ trợ chuẩn hóa alias và tích hợp component `ModelSelector.tsx` chuẩn hóa của Vikini lên thanh TopBar Novelcrafter.
  - Bổ sung bộ kiểm thử co-located với 5/5 test case chạy xanh cho `novelcrafterStreamRunner.server.test.ts` và 6/6 test case cho `modelAccess.test.ts`.

---

## 2026-10-15: Feature & UX Upgrade -- Novelcrafter Studio: Silent Auto-Save, Sudowrite Document Sheet Typography, Accordion Story Bible, In-Document Feedback Margin Gutter & Complete Sudowrite Tool Suite

- **Silent Background Auto-Save, Single-Flight `PUT` Coordinator & Optimistic Concurrency (`src/lib/features/novelcrafter/storySyncCoordinator.ts`, `src/lib/features/novelcrafter/draftStorage.ts`, `src/lib/features/novelcrafter/storyPersistence.server.ts`, `src/app/api/novelcrafter/state/route.ts`, `src/app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts`, `src/app/features/novelcrafter/hooks/useNovelcrafterStory.ts`)**:
  - Loại bỏ hoàn toàn huy hiệu nhấp nháy `✨ Chưa lưu / 🔄 Đang lưu...` trên `NovelcrafterTopBar.tsx`, thay bằng chỉ báo tĩnh kiểu Sudowrite (`✓ Đã lưu · Từ: 1,240` / `✓ Saved · Words: 1,240`) kèm phím tắt `Ctrl+S` / `Cmd+S` và nút thử lại khi mất kết nối.
  - Khắc phục triệt để lỗi gọi nhầm `GET/PUT /api/novelcrafter/state` với ID của cuộc trò chuyện Chat thường khi chuyển từ `/` sang `/novelcrafter` thông qua `resolveValidNovelcrafterStoryId` và khóa chống tạo trùng `autoCreatePromise` (kèm callback `onBeforeActivate` trong `useConversation.ts`).
  - Lưu nháp tức thì 0ms vào `localStorage` (giới hạn 15 bản nháp LRU + tự động thu gọn History Cards khi chạm ngưỡng quota) kết hợp đồng bộ ngầm 3,000ms idle debounce qua hàng đợi `PUT` tuần tự (`enqueuePut` single-flight) có `storySwitchEpoch` fence và không gọi `setStoryState` sau khi `PUT` thành công để tránh giật con trỏ `<textarea>`.
  - Bổ sung kiểm tra `expectedVersion` tại `saveStoryStateForUser` (`storyPersistence.server.ts`) và trả về HTTP `409 Conflict` kèm `latestState` để client tự động khôi phục và lưu bản nháp lệch phiên bản vào thẻ `[Conflict Backup]`.
- **Unified Document Sheet Typography, Direct Live Streaming & Accordion Story Bible (`src/app/features/novelcrafter/components/ChapterEditorWorkspace.tsx`, `src/app/features/novelcrafter/components/StoryBibleWorkspace.tsx`, `src/lib/features/novelcrafter/streamTargetGuard.ts`)**:
  - Thiết kế lại `ChapterEditorWorkspace.tsx` theo bố cục **Tờ giấy sáng tác liền mạch (Unified Document Sheet)** của Sudowrite: tiêu đề chương sửa trực tiếp trên đầu trang giấy (`22px–24px`, `font-semibold`, `leading-[1.3]` + chặn chuỗi rỗng khi blur), thẻ `Chapter Beats / Scenes` đóng/mở linh hoạt (`14px`, `leading-[1.65]`) kèm ô `Extra Instructions` và nút nổi bật **✨ Tạo truyện từ Phân cảnh (`First Draft`)**, cùng vùng soạn thảo văn xuôi chính không viền hộp phụ (`16px–17px`, `leading-[1.8]`, `max-w-[820px]`).
  - Hỗ trợ **Direct Live Streaming** (`streamTargetGuard.ts` + `requestAnimationFrame` throttling) truyền trực tiếp chữ đang sinh vào khung truyện chính cho `Write` và `First Draft`, kèm thanh cảnh báo đang viết trực tiếp và hoàn trả nguyên trạng (`rollback`) khi bấm Dừng hoặc gặp lỗi mạng.
  - Nâng cấp `StoryBibleWorkspace.tsx` thành các thẻ **Collapsible Accordion Sections** sạch sẽ, dễ đọc với bộ đếm từ, công tắc `Hiển thị cho AI`, và thanh điều hướng nhảy nhanh từ cột trái (`NovelcrafterLeftNavigator.tsx`).
- **Standout AI Toolbar with Tooltips, In-Document Feedback Margin Gutter & Expanded Sudowrite Presets (`src/app/features/novelcrafter/components/ChapterAiToolbar.tsx`, `src/app/features/novelcrafter/components/ChapterAiToolMenus.tsx`, `src/app/features/novelcrafter/components/ChapterFeedbackGutter.tsx`, `src/lib/features/novelcrafter/feedbackParser.ts`, `src/lib/features/novelcrafter/featureDirectives.ts`)**:
  - Làm nổi bật các nút công cụ AI trên `ChapterAiToolbar.tsx` với thuyết minh tính năng trực quan (`Tooltip`) và phím tắt `Ctrl+K / Cmd+K` mở nhanh thanh **Quick Edit** ngay trên đoạn văn đang bôi đen.
  - Triển khai đầy đủ tính năng **💬 Feedback (Biên tập & Nhận xét)** kiểu Sudowrite: hỗ trợ 6 chế độ (_Developmental Edit_ với 5 tiêu chí _Consistency, Believability, Pacing, Clarity, Originality_, _Line Editing_, _Dialogue_, _Copy Editing_, _Beta Read_, _Custom Focus_), cột lề phải **In-Document Feedback Margin Gutter** (`ChapterFeedbackGutter.tsx`) hiển thị nhận xét theo trích dẫn câu gốc (`quote`), so sánh khác biệt từng từ (**Word-Level Inline Diff** xanh/đỏ gạch ngang), bấm **Áp dụng (`Accept`)** thay thế trực tiếp vào chương truyện, nhảy đến câu gốc trong văn bản, đánh giá 👍/👎, và **Trả lời AI (`Reply`)**.
  - Mở rộng bộ công cụ Sudowrite: **Write** (_Auto_, _Guided_, _Tone Shift_ với 8 sắc thái & tùy chọn độ dài `150 / 300 / 600 / 1,000` từ), **Rewrite** (7 chế độ gồm _Rephrase, Shorter, More Descriptive, Show Don't Tell, More Inner Conflict, More Intense, Custom_), **Expand & Describe** (chọn độc lập 6 giác quan _Thị giác, Thính giác, Khứu giác, Vị giác, Xúc giác, Ẩn dụ_), và **Brainstorm** (8 danh mục chuyên sâu).

---

## 2026-10-14: Feature -- Novelcrafter (Story & Script Studio) with Sudowrite 8-Node Story Bible & Layered GEM + Persona Routing

- **Navigation, Studio Isolation & Core Constants (`src/lib/utils/constants.ts`, `src/lib/core/modelRegistry.ts`, `src/lib/core/limits.ts`, `src/app/features/sidebar/components/Sidebar.tsx`, `src/app/features/chat/components/hooks/useConversationSelectors.ts`, `src/app/features/chat/components/ChatApp.tsx`, `src/app/api/chat-stream/conversationLoader.ts`)**:
  - Bổ sung `MODEL_IDS.NOVELCRAFTER = "vikini-novelcrafter"` vào `constants.ts`, cho phép bảo toàn model ID trong `normalizeModelForApi` (`modelRegistry.ts`) và cho phép user đã duyệt sử dụng các model nội bộ Studio (`IMAGE_STUDIO`, `NOVELCRAFTER`) trong `limits.ts`.
  - Thêm nút **Novelcrafter** (`BookOpen` icon) nằm ngay phía trên **Image Studio** trong `Sidebar.tsx`, ẩn mục `Projects` khi ở `/novelcrafter`, và tách biệt hoàn toàn các truyện Novelcrafter khỏi danh sách Chat thường (`useConversationSelectors.ts`, `ChatApp.tsx`, `conversationLoader.ts`).
- **Sudowrite 8-Node Story Bible & Layered GEM + Persona Prompt Engine (`src/lib/features/novelcrafter/types.ts`, `src/lib/features/novelcrafter/promptBuilder.ts`)**:
  - Định nghĩa Zod v4 schemas cho `StoryBible` (Braindump, Genre, Style, Synopsis, Characters kèm `charactersVisibleToAI`, Worldbuilding kèm `worldbuildingVisibleToAI`, Outline), `NovelcrafterChapter` (`beats`, `content`, `summary`), `NovelcrafterRoutingConfig` (`masterGemId`, `masterPersonaId`, 5 slot tính năng `bible`, `write`, `rewrite`, `expand`, `brainstorm`), và `NovelcrafterHistoryCard`.
  - Xây dựng `buildNovelcrafterSystemInstruction` theo kiến trúc **Ghép Tầng (Layered Mode)**: Tầng 1 `<task_instructions>` (GEM Tổng — ưu tiên số 1 tuyệt đối) + Tầng 2 `<style_preferences>` (Persona của tính năng hoặc kế thừa từ Persona Tổng qua `buildPersonaSystemPrompt`), không áp giới hạn cắt gọt 12,000 ký tự của Chat thường.
  - Xây dựng `selectStoryBibleDependencies` và `buildNovelcrafterUserPrompt` tuân thủ đồ thị phụ thuộc 8 nút của Sudowrite Story Bible (tự động fallback từ `Synopsis` sang `Braindump` khi Synopsis trống, tôn trọng cờ hiển thị AI `charactersVisibleToAI` / `worldbuildingVisibleToAI`, và đóng gói `<story_bible>`, `<chapter_context>`, `<selected_text>`, `<feature_instruction>` vào User Prompt).
- **Zero-Migration Encrypted Persistence & Multi-Provider SSE Stream Runner (`src/lib/features/novelcrafter/storyPersistence.server.ts`, `src/lib/features/novelcrafter/novelcrafterStreamRunner.server.ts`, `src/app/api/novelcrafter/state/route.ts`, `src/app/api/novelcrafter/stream/route.ts`)**:
  - Lưu trữ trạng thái truyện (`NovelcrafterStoryState`) dưới dạng JSON mã hóa AES-256-GCM trực tiếp (`encryptText` / `decryptText`) trong bảng `messages` (`role: "system"`, `meta.novelcrafterType = "story_state"`) kèm kiểm tra quyền sở hữu conversation (`user_id` & `model === "vikini-novelcrafter"`).
  - Hỗ trợ đầy đủ SSE streaming đa nhà cung cấp (Gemini, Claude, Groq, OpenRouter) cho 5 nhóm công cụ AI của Novelcrafter kèm kiểm tra xác thực 3 tầng (`requireUser`, `consumeRateLimit`, `checkDailyMessageLimit`, `assertModelAllowedForUser`) và xử lý `request.signal` abort.
- **3-Pane Sudowrite x Vikini Studio Workspace & Co-located Tests (`src/app/novelcrafter/page.tsx`, `src/app/features/novelcrafter/**`, `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`)\*\*:
  - Triển khai giao diện 3 cột (`NovelcrafterLeftNavigator`, `StoryBibleWorkspace` / `ChapterEditorWorkspace`, `NovelcrafterHistoryPane`), thanh công cụ `NovelcrafterTopBar` và hộp thoại `GemPersonaRoutingModal` hỗ trợ song ngữ Việt - Anh.
  - Bổ sung đầy đủ co-located unit & integration tests tại `promptBuilder.test.ts`, `storyPersistence.server.test.ts`, `novelcrafterStreamRunner.server.test.ts`, `state/route.test.ts`, `stream/route.test.ts`, `modelRegistry.test.ts`, và `limits.test.ts`.

---

## 2026-10-14: Bug Fix -- Fix Delete Confirmation Modal Scrollbar Overflow & Gallery `PGRST201` Infinite Loading Loop

- **Delete Confirmation Modal & Dialog Scrollport Fix (`src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/confirm-dialog.tsx`, `src/app/features/chat/components/ChatModalsSection.tsx`, `src/app/styles/themes/_shared/base.css`, `src/app/features/image-gen/components/hooks/useImageGenStudio.ts`)**:
  - Thêm `overflow-x-hidden` vào `DialogContent` và `AlertDialogContent` để ngăn trình duyệt tự động ép `overflow-x: auto` khi bật `overflow-y: auto`.
  - Loại bỏ phần tử con `<div className="pointer-events-none absolute -inset-px ...">` gây tràn 1px ở cạnh phải/dưới trong `ConfirmDialogHost` và `ChatModalsSection`, thay bằng hiệu ứng viền và đổ bóng trực tiếp trên `DialogContent` (`border-(--danger)/30 ring-(--danger)/20 shadow-[0_0_40px_-10px_color-mix(in_srgb,var(--danger)_25%,transparent)]`).
  - Bổ sung `height: 6px;` cho `::-webkit-scrollbar` và `::-webkit-scrollbar-corner { background: transparent; }` trong `base.css`.
  - Sửa `handleDeleteProject` trong `useImageGenStudio.ts` dùng khóa dịch `studioDeleteProjectTitle` (`"Delete this project?"` / `"Xóa dự án này?"`) thay vì `deleteConfirm`.
- **PostgREST `PGRST201` Disambiguation & Gallery Mapper (`src/lib/features/gallery/galleryMapper.ts`, `src/app/api/gallery/route.ts`, `src/app/api/gallery/[id]/route.ts`, `src/lib/features/chat/messages.ts`, `src/app/api/admin/stats/route.ts`)**:
  - Chỉ định tường minh khóa ngoại `conversations!messages_conversation_id_fkey!inner` tại toàn bộ 5 truy vấn join giữa `messages` và `conversations`, khắc phục lỗi `PGRST201` (HTTP 500) phát sinh sau khi bảng `conversations` có thêm khóa ngoại thứ hai `conversations_forked_from_message_id_fkey`.
  - Tách module `src/lib/features/gallery/galleryMapper.ts` (`isCiphertextHex`, `resolveMessageContent`, `paginateAndMapGalleryRows`) hỗ trợ `meta.editPrompt`, giải mã an toàn ciphertext hex mà không làm lộ chuỗi hex hay làm mất plaintext dưới `happy-dom`, kèm unit test co-located `galleryMapper.test.ts` và cập nhật `src/app/api/gallery/route.test.ts`.
- **Gallery Infinite Scroll Loop & Concurrency Guard (`src/app/features/gallery/components/hooks/useGalleryController.ts`, `src/app/features/gallery/components/GalleryView.tsx`, `src/lib/utils/translations/en.ts`, `src/lib/utils/translations/vi.ts`)**:
  - Khởi tạo `hasMore = false`, đặt `setHasMore(false)` kèm `toast.error(t("galleryLoadFailed"))` khi API lỗi, tách `isFetchingMoreRef` và `requestIdRef` để chống gọi trùng khi cuộn trang và chống race condition khi bật/tắt bộ lọc Favorites.
  - Chỉ render phần tử sentinel `loadMoreRef` khi `!g.loading && g.hasMore && g.filteredImages.length > 0`, chấm dứt hiện tượng vòng xoay loading lặp vô tận và nhấp nháy `"Scroll to load more..."`.

---

## 2026-10-14: Feature -- Integrate Gemini 4 Argon (`gemini-4-argon`) Model & Server-Side Model Rank Gating

- **Model Registry & Constants (`src/lib/utils/constants.ts`, `src/lib/core/modelRegistry.ts`)**:
  - Bổ sung `MODEL_IDS.GEMINI_4_ARGON = "gemini-4-argon"` vào `SELECTABLE_MODELS`, `API_ALLOWED` và alias `"gemini-4-argon-preview"` trong `MODEL_ALIASES`.
  - Cấu hình `tokenLimit: 1048576` (1M unified context window), `maxOutputTokens: 65536` (64K standard streaming cap), `supportedThinkingLevels: ["low", "medium", "high"]`, `providerId: "gemini"`, và helper `isGemini4Model()`.
- **Server-Side Model Rank Gating (`src/lib/core/limits.ts`, `src/lib/features/chat/conversations.ts`, `src/app/api/chat-stream/`)**:
  - Bổ sung `isModelAllowedForUser()` và `assertModelAllowedForUser()` trong `src/lib/core/limits.ts` (kèm `allowed_models: [DEFAULT_MODEL]` trong `BASIC_FALLBACK_CONFIG` và fail-closed `DEFAULT_MODEL` trong `useAllowedModels.ts`).
  - Cưỡng chế kiểm tra quyền hạn model theo rank tại `setConversationModel`, `doSaveConversation` và `handleChatStreamCore`; bảo toàn `AppError` qua `conversationLoader.ts` và chỉ tăng `incrementDailyMessageCount` khi `response.ok` là `true`.
- **Always-On Thinking, Implicit Caching Guard, Tool Context Circulation & 15m Timeout**:
  - `useThinkingLevel.ts` & `ThinkingLevelSelector.tsx`: Ẩn tùy chọn `"off"` đối với dòng model Gemini 4 và tự động kẹp `"off"`/`"minimal"` về `"low"`.
  - `gemini-stream.ts`: Đảm bảo `gemini-4-argon` luôn gửi `thinkingConfig: { thinkingLevel, includeThoughts: true }` (mặc định `"medium"` khi `undefined`, kẹp `"off"`/`"minimal"` về `"low"`). Xử lý lỗi HTTP 401/403/404 (`MODEL_TIER_RESTRICTED`) và `StreamTimeoutError` mà không retry nhánh `[TOOLS FALLBACK]`.
  - `contextCache.ts`: Bỏ qua Explicit Context Caching (`caches.create`) cho `gemini-4*` để tận dụng cơ chế Implicit Caching tự động của Gemini 4 Argon.
  - `contextBuilder.ts`: Bật Tool Context Circulation (`googleSearch` + `codeExecution` + `functionDeclarations` + `includeServerSideToolInvocations: true`) cho `gemini-4*`.
  - `streaming/types.ts`, `streaming/utils.ts`, `chat-stream/route.ts`: Thêm `TIMEOUT_CONFIG.ARGON = 900000` (15 phút) và `export const maxDuration = 800`.
- **Bilingual i18n, Database Migration & Co-located Tests**:
  - Cập nhật `en.ts`, `vi.ts`, `useChatTranslations.ts` (`"gemini-4-argon"`, `"modelDescArgon4"`).
  - Thêm migration `database-migrations/20261014000000_add_gemini_4_argon.sql` cấp quyền `gemini-4-argon` cho hạng `admin` và `pro`.
  - Bổ sung đầy đủ unit tests tại `modelRegistry.test.ts`, `limits.test.ts`, `conversations.test.ts`, `contextCache.test.ts`, `contextBuilder.test.ts`, `gemini-stream.test.ts`, và `useThinkingLevel.test.ts`.

---

## 2026-10-14: Siết chuẩn thẩm định của Fallback Reviewer (`@reviewer`)

- **`.agents/agents/reviewer/agent.md`**: Các lượt approve của `@reviewer` thời còn chạy `gemini-3.8-flash` từng bị lật lại 2/4 lần (`ui-audit` Run 3 → Claude Run 4 tìm ra 3 MAJOR; `phase-2` Run 3 bị PO thu hồi → Run 4 tìm ra 5 MAJOR). Các quy tắc dưới đây áp dụng cho fallback hiện tại (`gemini-4-argon`).
  - **Thẩm định độc lập**: không kế thừa kết luận Run trước; mỗi lỗi cũ kiểm lại trên code thật (`ĐÃ SỬA` / `SỬA MỘT PHẦN` / `CHƯA SỬA`); bắt buộc săn lỗi mới, báo cáo tách mục Kiểm Chứng Lỗi Cũ và Phát Hiện Mới.
  - **Luật bằng chứng**: `[SRC]` phải trỏ vào code thật, trích plan thành `UNVERIFIED`; probe `node -e` chỉ chép snippet của plan không được dùng làm evidence.
  - **Quy tắc approve**: approve không có phát hiện mới phải kèm mục Các Tấn Công Đã Thử (≥3, có bằng chứng); cấm từ ngữ tuyệt đối ("100%", "triệt để", "hoàn hảo"...).

---

## 2026-10-14: Governance -- Upgrade .agents/ Subagents & Task-to-Model Routing to Gemini 4 Argon (`gemini-4-argon`)

- **Subagent Model Upgrades (`.agents/agents/`)**:
  - Nâng cấp `@planner` (`.agents/agents/planner/agent.md`) lên `gemini-4-argon` nhằm tăng cường năng lực khảo sát kiến trúc đa tệp, thiết kế Test Contract và giảm số vòng lặp Revision Loop.
  - Nâng cấp Fallback Reviewer `@reviewer` (`.agents/agents/reviewer/agent.md`) từ `gemini-3.8-flash` lên `gemini-4-argon` (cập nhật YAML frontmatter `model`, `description`, mô tả kênh dự phòng Dual-Reviewer Architecture và nhãn minh bạch `[REVIEWER_MODEL: gemini-4-argon]`).
  - Nâng cấp Runtime Fallback Model của `@qa` (`.agents/agents/qa/agent.md`) khi chạm giới hạn quota (HTTP 429) từ `gemini-3.8-flash` lên `gemini-4-argon` (`[FALLBACK_MODEL: gemini-4-argon]`).
- **Governance Rules & Orchestrator–Worker Routing Guide (`.agents/rules/`, `.agents/README.md`)**:
  - Đồng bộ quy tắc `.agents/rules/05-plan-review.md` (YAML frontmatter `description` và mục 3.2 Kênh Thẩm Định Dự Phòng) sang `gemini-4-argon`.
  - Cập nhật `.agents/rules/01-coding.md` (§ File Size & Modularity Guidelines) bổ sung `Gemini 4 Argon`.
  - Cập nhật `.agents/README.md` (§1 MAS Workflow & §4 Agent Task-to-Model Routing Guide) áp dụng kiến trúc **Orchestrator–Worker Split**: phân bổ `gemini-4-argon` cho Planning, Reviewing fallback, Complex Feature/Debug, Unit/Integration Tests; giữ `gemini-3.8-flash` làm Fast Worker cho các tác vụ nhẹ, sửa lỗi chính tả, format và cập nhật tài liệu thông thường.

---

## 2026-10-12: Tooling & CI/Vercel Hardening -- Clean npm Install Warnings & Secure Husky Lifecycle

- **npm Install-Scripts Security Hardening (`package.json`)**:
  - Khai báo tường minh khối `"allowScripts"` trong `package.json` cho 5 thư viện tin cậy: `@google/genai`, `esbuild`, `fsevents`, `protobufjs`, `unrs-resolver`.
  - Khắc phục triệt để cảnh báo `npm warn install-scripts 5 packages have install scripts not yet covered by allowScripts` xuất hiện trên môi trường Vercel / CI chạy npm ≥ 11.16+ / npm 12+.
  - Đảm bảo các gói native compilation (`esbuild`, `unrs-resolver`, `fsevents`) tiếp tục biên dịch an toàn mà không làm gián đoạn pipeline build.

- **CI/Vercel-Aware Husky Lifecycle Script (`.husky/install.mjs`, `package.json`)**:
  - Thay thế script `"prepare": "husky"` bằng script hạ tầng `.husky/install.mjs` tuân thủ khuyến nghị từ tài liệu Husky v9.
  - Tự động bỏ qua việc cài đặt Git hooks khi phát hiện biến môi trường CI (`process.env.CI`) hoặc Vercel (`process.env.VERCEL`), kết thúc an toàn với mã `0`.
  - Bảo toàn chẩn đoán local dev: in trực tiếp thông điệp trạng thái của hàm `husky()` (`process.stdout.write`) ra terminal khi phát hiện cờ bỏ qua (`HUSKY=0`) thay vì nuốt lỗi âm thầm, bảo vệ cơ chế hook `pre-commit` (lint-staged) trên máy developer.
  - Tuân thủ quy chuẩn ESLint với comment `/* global process */`, 0 lỗi `no-undef`, 0 warnings.

- **Repository-Level npm Configuration (`.npmrc`)**:
  - Tạo file `.npmrc` cấp repository với `fund=false` và `audit=false`.
  - Dọn sạch các thông điệp `packages are looking for funding` và tắt audit ngầm làm chậm quá trình `npm install` trên Vercel build container.

- **Strict Non-Regression Boundary (ExcelJS Sub-dependencies)**:
  - Khóa cứng nguyên tắc cấm can thiệp ép đè `overrides` cho `glob`, `rimraf`, `inflight`, `fstream`, `lodash.isequal` (thuộc sub-dependencies của `exceljs@4.4.0`).
  - Ghi nhận các cảnh báo `npm warn deprecated` liên quan là residual warnings được chấp nhận có chủ đích (accepted trade-off) nhằm bảo vệ 100% tính toàn vẹn của API runtime trong parser tài liệu `src/lib/features/files/documentParsers.ts`.

- **Verification Gate**:
  - Chạy `npm run verify`: 112/112 test files passed, 1,201/1,201 unit tests passed, 0 TypeScript errors, 0 ESLint errors/warnings.
  - Kiểm thử `src/lib/features/files/documentParsers.test.ts` (13 tests) pass trơn tru.

---

## 2026-10-12: Audit Cycle 2 -- E2E Testing Automation (Playwright) & Security/Dependency Hardening

- **Pillar 1: End-to-End Testing Infrastructure (Playwright & Fail-Closed Sandbox)**:
  - **Playwright Configuration & WebServer Isolation (`playwright.config.ts`)**:
    - Thiết lập cổng độc lập `3100` (`http://127.0.0.1:3100`), tách biệt hoàn toàn khỏi dev server cổng `3000` của developer.
    - Cấu hình auto-spawn webServer (`npm run dev -- -p 3100`) với mock environment variables an toàn cho CI/CD.
    - Mặc định chạy offline với `grepInvert: /@online/`, bảo đảm không rò rỉ network ra bên ngoài.
  - **Fail-Closed Network Guard (`tests/e2e/helpers/network-guard.ts`)**:
    - Chốt chặn bắt mọi request `**/api/**` không được mock tường minh và trả HTTP 501 (`Not Implemented in E2E sandbox`), tự động fail test qua `assertNoUnhandledRequests()`.
  - **Comprehensive Mock Harnesses & Session Emulation**:
    - `mock-session.ts`: Giả lập NextAuth authenticated session kèm cookie `next-auth.session-token` và `authjs.session-token`, phân quyền user pro.
    - `mock-ai-stream.ts`: Giả lập SSE protocol (`meta`, `thinking`, `token`, `done`) qua `ReadableStream` injection trong `window.fetch`.
    - `mock-chat.ts`, `mock-projects.ts`, `mock-image-gen.ts`: Mock toàn bộ CRUD conversations, projects, files, SVG generation canvas, batch quotas và autocomplete suggestions.
  - **Production-Grade E2E Test Suites (7/7 Tests Passed 100%)**:
    - `smoke.test.ts`: Kiểm thử ứng dụng load không crash và kiểm tra trang 404.
    - `auth-flow.spec.ts`: TC-E2E-01 (giao diện đăng nhập Warm Noir, song ngữ VI/EN toggle cập nhật văn bản), TC-E2E-02 Offline (click nút Google kích hoạt luồng Server Action an toàn).
    - `user-journey.spec.ts`: TC-E2E-03 (luồng chat hoàn chỉnh: gửi prompt, stream token AI, thinking block, URL sync), TC-E2E-04 (Image Studio SVG generation & canvas render), TC-E2E-05 (tạo workspace project mới qua modal và hiển thị trên Sidebar).

- **Pillar 2: Security & Dependency Hardening (0 High/Critical Vulnerabilities)**:
  - **CVE & Package Audit (`package.json`)**:
    - Nâng cấp `next@^16.4.0`, `next-auth@^5.0.0-beta.32`, `vitest@^4.1.11`, `eslint-config-next@^16.4.0`, `postcss@^8.5.23`.
    - Cấu hình `overrides` an toàn cho `uuid`, `protobufjs`, `sharp`, `ws`, `source-map-js`, `postcss`.
    - Gỡ bỏ thư viện `pg` thừa. Giữ `recharts` theo yêu cầu dự án.
    - Kết quả `npm audit --omit=dev --audit-level=high`: **0 Critical, 0 High vulnerabilities**.
  - **Next.js 16 Security & Dev Configurations (`next.config.ts`)**:
    - Bổ sung `allowedDevOrigins: ["127.0.0.1", "localhost"]` giải quyết chặn cross-origin HMR của Next.js 16.
    - Cập nhật CSP `connect-src` thêm `ws:` và `wss:` cho dev mode hot-reload.
    - Tích hợp `@next/bundle-analyzer` kích hoạt độc lập qua script `npm run analyze`.
  - **Bundle Splitting & Lazy Loading (`ChatApp.tsx`)**:
    - Chuyển `ProjectChatView`, `ChatDeepResearch`, `ResearchReportPanel`, `ResearchThinkingPanel`, `EditPlanModal`, `CommandPalette`, `KeyboardShortcutsModal` sang `lazy()` kết hợp `Suspense`.

- **Pillar 3: Database & Supabase RLS Hardening**:
  - Migration bảo mật `supabase/migrations/20261012000000_rls_security_audit_cycle_2.sql` và rollback tương ứng:
    - Khóa 4 hàm RPC `SECURITY DEFINER` (`match_knowledge_chunks`, `cleanup_deleted_conversations_cron`, `get_user_conversations_with_stats`, `search_user_conversations`).
    - Thiết lập tường minh `SET search_path = public, extensions` bảo toàn tương thích `pgvector`.
    - Rà soát toàn diện RLS policies trên tất cả các tables (`conversations`, `messages`, `projects`, `gems`, `attachments`...).
    - Bổ sung script `scripts/introspect-rls.sql` và negative probe script `scripts/verify-rls-negative-probe.ts`.
  - Cập nhật tài liệu bảo mật `docs/security.md`.

- **Pillar 4: Production Fixes & Test Verification**:
  - Khắc phục lỗi i18n thiếu key `{t("createProjectBtn")}` trong `CreateProjectModal.tsx`.
  - Export interface `ProjectLimits` từ `src/lib/store/projectStore.ts`.
  - Verification Gate Tier 2 (`npm run verify`): 112/112 test files passed, 1,201/1,201 unit tests passed, 0 TypeScript errors, 0 ESLint warnings.
  - Verification E2E (`npx playwright test`): 7/7 e2e tests passed 100%.

---

## 2026-10-12: Fix -- CI Test Failure on Ubuntu Runner (theme-config.test.ts)

- **Root cause**: `theme-config.test.ts` duyệt toàn bộ file CSS đệ quy bao gồm cả thư mục `_shared/base.css`. Trên hệ thống file Linux (Ubuntu Runner), các thư mục bắt đầu bằng ký tự `_` được duyệt trước các chữ cái alphabet. Biểu thức chính quy `\.theme-${theme.id}\s*\{` đã vô tình khớp với `:root.theme-sunset { color-scheme: dark; }` và `:root.theme-orchid { color-scheme: light; }` trong `base.css` (vốn không chứa `--surface-elevated`), khiến test dừng sớm và báo lỗi sai.
- **Fix**: Loại bỏ thư mục `_shared` khỏi danh sách tìm kiếm file theme và neo đầu dòng `(?:^|\n)\.theme-${theme.id}\s*\{` để ngăn việc khớp nhầm các bộ chọn `:root.theme-*`.

---

## 2026-10-12: Feature -- Z.ai GLM 5.2 Model Integration (OpenRouter)

- **Core Model Integration & Registration**:
  - Đăng ký hằng số `GLM_52: "z-ai/glm-5.2"` vào `MODEL_IDS` (`src/lib/utils/constants.ts`).
  - Cấu hình model trong `SELECTABLE_MODELS` với context window 1,048,576 tokens (~1M), provider `openrouter`, pricing $0.06/M input và $7.00/M output (`src/lib/core/modelRegistry.ts`).
  - Đăng ký vào `API_ALLOWED`, `MODEL_ALIASES` (`glm-5.2`, `z-ai/glm-5.2-20260616`), và xây dựng hàm nhận diện SSOT `isGLMModel()`, đồng thời cập nhật `isOpenRouterReasoningModel()`.
- **Reasoning Control & Scoped Token Ceilings**:
  - **Scoped Output Token Limit**: Thiết lập trần `GLM_MAX_OUTPUT_TOKENS = 65536` riêng biệt cho GLM trong `src/app/api/chat-stream/streaming/openai-stream.ts`, bảo vệ các mô hình OpenAI-compatible khác (Haiku 64k, Grok 8k) không bị lỗi 400 do trần token không phù hợp.
  - **Bidirectional Reasoning Dispatch**: Gửi tường minh `{ reasoning: { enabled: false } }` khi `thinkingLevel` là `undefined` hoặc `"off"` (do GLM mặc định bật suy luận trên OpenRouter), nâng mức suy luận thành `"high"` khi bật (`["xhigh", "high"]`), đồng thời giữ nguyên hành vi không can thiệp reasoning cho Grok 4.3.
- **Error Handling & Resilient UX**:
  - Bắt lỗi HTTP 402 (`INSUFFICIENT_CREDITS`) từ OpenRouter và hiển thị banner nạp credit trực quan trên `StreamErrorBanner.tsx`.
  - Bắt lỗi HTTP 400 Context Overflow (`CONTEXT_LENGTH_EXCEEDED` kèm cờ `isTokenLimit: true`) để thông báo người dùng tối ưu hóa ngữ cảnh hội thoại.
- **UI Components & Branding**:
  - Thiết kế logo inline SVG `GlmLogo` gradient sapphire-to-cyan (`#1E40AF` → `#06B6D4`) với `React.useId()` chống xung đột SVG gradient ID trong `ModelAvatar.tsx`.
  - Cập nhật `useThinkingLevel.ts` và `ThinkingLevelSelector.tsx` hỗ trợ 2 mức suy luận `off` và `high` dành riêng cho GLM.
- **Database Migrations & Bilingual i18n**:
  - Migration idempotent `database-migrations/20261012000000_add_glm_5_2.sql` cấp quyền truy cập mô hình cho hạng người dùng `admin` và `pro`.
  - Bổ sung translation keys `modelDescGlm52` và `insufficientCredits` trong cả `en.ts` và `vi.ts` đạt 100% key parity.
  - Cập nhật tài liệu kỹ thuật `docs/models.md` phản ánh đầy đủ thông số GLM 5.2.
- **Comprehensive Co-located Test Suite & Verification**:
  - Bổ sung unit tests cho `modelRegistry.test.ts`, `openai-stream.test.ts` (14 test cases kiểm thử token limits, reasoning modes, error mappings), `useThinkingLevel.test.ts`, và `ModelAvatar.test.tsx`.
  - Verification Gate Tier 2 (`npm run verify`): 112/112 test files passed, 1199/1199 unit tests passed, 0 TypeScript errors, 0 ESLint warnings.

---

## 2026-10-11: Audit Remediation Phase 4 -- Bilingual i18n, WCAG 2.2 Accessibility, Performance Optimization & Co-located Tests

- **Pillar 1: Bilingual i18n Core Parity & Localization (I18N-01, I18N-02, Rule 04)**:
  - **100% Bidirectional Key Parity**: Bổ sung hơn 50 translation keys thiếu và mới trong `src/lib/utils/translations/vi.ts` và `en.ts` (`language`, `themes`, `loadingConfigs`, `adminManagement`, `icon`, `clearIcon`, `dismissNotification`, `notifications`, `chat`, `imageStudio`, `gallery`, `noProjects`, `createProjectHint`, `startChatHint`, `gemsDesc`, `navigation`, `closeSidebar`, `renameFallbackToast`, `deleteFallbackToast`, `downloadComplete`, `downloadFailed`, `conversationOptions`, `optionsFor`, `exportTxt`, `downloading`, `themeFocus`, `themeGlassmorphism`, `themeRa2`, các tone keys, `failedFetchUsers`, `failedLoadUsers`, `failedUpdateUser`, `failedUpdateUsers`, `userDetailAria`, `kbDeleteConfirmDesc`...).
  - **Compile-Time Parity Enforcement**: Tái cấu trúc type assertions trong `src/lib/utils/translations/index.ts` bằng generic tuple conditional types để compiler TypeScript tự động báo lỗi nếu có bất kỳ sự lệch key nào giữa `vi.ts` và `en.ts`.
  - **Zero Prop Drilling in Sidebar**: Xóa bỏ hoàn toàn prop `t` khỏi `Sidebar.tsx` và các component con (`SidebarItem`, `SidebarSection`, `ProjectNode`). Chuyển sang gọi trực tiếp hook `useLanguage()`, loại bỏ truyền prop `t` từ `ChatApp.tsx`, `GalleryView.tsx`, `DescribeImageView.tsx`.
  - **Comprehensive UI Localization**: Bản địa hóa toàn bộ các chuỗi văn bản hardcoded trong `Sidebar.tsx`, `SidebarItem.tsx`, `ProjectNode.tsx`, `ToastContainer.tsx`, `CreateProjectModal.tsx`, `HeaderBar.tsx`, `KnowledgePanel.tsx`, `PersonaEditor.tsx`, `UserManager.tsx`.
- **Pillar 2: WCAG 2.2 Accessibility Standards (A11Y-02, A11Y-03, WCAG 4.1.2)**:
  - **IconPicker Semantic Restructure (A11Y-02)**: Loại bỏ anti-pattern `<div role="combobox">` bọc `<button>`. Tái cấu trúc thành native semantic `<button type="button">` với `aria-haspopup="dialog"`, `aria-expanded`, và bản địa hóa `aria-label`.
  - **Independent Clear Icon Sibling Button**: Tách nút Clear icon trong `IconPicker.tsx` thành button sibling độc lập nằm tại `absolute right-8 top-1/2 -translate-y-1/2`, bổ sung `pr-14` trên trigger button để chống đè chữ, xử lý cả `stopPropagation` và `preventDefault`.
  - **Universal Accessible Focus Indicators (A11Y-03)**: Bổ sung lớp `focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none` đồng bộ trên toàn bộ các nút tương tác trong `Sidebar`, `SidebarItem`, `ProjectNode`, `ToastContainer`, `CreateProjectModal`, `HeaderBar`, `KnowledgePanel`, `PersonaEditor`, `UserManager`.
  - **Tailwind v3 Ring Opacity Cleanup**: Loại bỏ hoàn toàn lớp cũ `focus:ring-opacity-50` trong `HeaderBar.tsx`, thay thế bằng chuẩn CSS tokens `focus-visible:ring-2 focus-visible:ring-(--ring)`.
  - **Screen Reader Context for Toasts**: Bổ sung translation keys chuyên dụng `dismissNotification` ("Đóng thông báo") và `notifications` ("Thông báo") cho `ToastContainer.tsx` và `ToastItem`, đảm bảo ngữ cảnh trợ năng rõ ràng cho screen readers.
- **Pillar 3: Performance Optimization & Lucide Icons (PERF-01, PERF-02)**:
  - **Sidebar Callback Memoization (PERF-01)**: Hoist `handleNavigation` lên thân component `Sidebar.tsx` (tránh conditional hook trong helper) và bọc toàn bộ các hàm callback (`handleSelect`, `handleNew`, `handleOpenGems`, `handleOpenPersonas`, `renameFallback`, `deleteFallback`, `handleRename`, `handleDelete`) bằng `React.useCallback`, bảo vệ `React.memo` cho `SidebarItem` không bị re-render liên tục theo từng AI token stream về.
  - **Lucide Icons Standardization (PERF-02)**: Thay thế 4 hàm inline custom SVGs thủ công (`EllipsisVerticalIcon`, `PencilIcon`, `TrashIcon`, `DownloadIcon`) trong `SidebarItem.tsx` bằng icons chính thức từ `lucide-react` (`MoreVertical`, `Pencil`, `Trash2`, `Download`, `Loader2`).
- **Pillar 4: Comprehensive Co-located Test Suite**:
  - `src/lib/utils/translations/index.test.ts`: Kiểm tra 100% key parity giữa `viDict` và `enDict`, kiểm tra không có key rỗng, và kiểm tra toàn bộ 59/59 referenced UI keys qua mảng `readonly TranslationKey[]`.
  - `src/lib/features/image-gen/templates.test.ts`: Kiểm tra 18 templates, cấu trúc song ngữ `name`/`description`, và xác thực 6 ID mặc định đầu tiên `["anime", "cinematic", "clay", "neon", "headshot", "watercolor"]`.
  - `src/lib/features/image-gen/stylePrompts.test.ts`: Kiểm tra 18 styles (gồm `art-nouveau`), kiểm tra `getStyleInstruction` (happy path và edge cases), kiểm tra chéo 100% `template.style` tồn tại trong `STYLE_PROMPTS`.
  - `src/lib/features/image-gen/core/ImageGenFactory.test.ts`: Kiểm tra khởi tạo singleton providers, alias `"gemini-native"`, và ném lỗi khi provider không hợp lệ.
  - `src/components/ui/IconPicker.test.tsx`: Kiểm tra semantic trigger button, padding `pr-14`, nút Clear sibling độc lập, keyboard navigation, và disabled state.
  - `src/app/features/sidebar/components/SidebarItem.test.tsx`: Kiểm tra rendering, active state, onSelect, onRename, onDelete, conversation export download, focus rings, và 100% Lucide icon classes.
  - `src/app/features/sidebar/components/Sidebar.test.tsx`: Kiểm tra Reference Stability (TC-PERF-01) qua spy component (cả thuận và nghịch), kiểm tra hiển thị song ngữ tiếng Việt không prop drilling (TC-I18N-02).
  - `src/app/features/layout/HeaderBar.test.tsx`: Kiểm tra mock `@/app/features/chat/hooks/useLanguage`, ánh xạ `THEME_GROUP_LABELS` hiển thị nhãn dịch ở cả desktop và mobile (MAJOR-10), counter-test nhóm lạ fallback nguyên văn (MAJOR-10), và accessible theme selector.
- **Verification Gate**:
  - `npm run verify` (`npm run type-check && npm run lint && npm run test:run`) passed 100%.
  - 112 test files passed, 1178 tests passed (0 failures).
  - 0 TypeScript errors.
  - 0 ESLint warnings / errors.

---

## 2026-10-11: Fix -- Plain-text code blocks bị cắt chữ trong chat

- **Root cause**: `react-markdown` v10 không còn truyền prop `inline`, và phần tử con của `<pre>` có `type` là component `code` tùy biến (không phải chuỗi `"code"`). Fenced block không khai báo ngôn ngữ vì vậy rơi xuống nhánh `<pre>` thô, render như inline code (không xuống dòng) và bị `overflow-hidden` của container cắt mất.
- **Fix**: `BubbleMarkdown.tsx` tách `CodeRenderer` thành hàm có tên để `PreBlock` nhận diện được; `SmartCode.tsx` bật `whitespace-pre-wrap break-words` cho block `text` để prompt/template hiển thị trọn câu.

## 2026-10-11: Audit Remediation Phase 3 -- Theming, Mobile/Foldable & Gallery UX

- **Pillar 1: Theming System & WCAG AA Contrast Compliance (THEME-01, THEME-02)**:
  - **Orchid Theme Light Mode Alignment**: Cập nhật theme `orchid` thành tone `"light"` trong `src/lib/config/theme-config.ts` và thiết lập `color-scheme: light;` trong `src/app/styles/themes/_shared/base.css` và `src/app/styles/themes/glassmorphism/orchid.css` để đồng bộ trình duyệt, form controls và thanh cuộn.
  - **Surface Elevation CSS Tokens**: Bổ sung đầy đủ token `--surface-elevated` cho 10 theme bị thiếu (focus themes: `blueprint`, `amber`, `charcoal`, `gold`, `indigo`, `red`, `rose`; RA2 themes: `allied`, `soviet`, `yuri`), triệt tiêu hiện tượng card nền trong suốt hoặc chìm vào nền chính.
  - **Accent Contrast Compliance**: Chuẩn hóa màu chữ trên nút bấm hành động trong `ErrorBoundary.tsx` và `GalleryView.tsx` sang `text-(--accent-foreground)` thay vì raw color `text-white`, kết hợp `focus-visible:ring-2` accessible focus rings.
  - **Automated Mathematical WCAG AA Contrast Suite**: Bổ sung unit test `src/lib/config/theme-config.test.ts` tính toán độ chói tương đối (relative luminance) xác thực 100% (16/16) themes đều đạt tỷ lệ tương phản WCAG AA ≥ 4.5:1 giữa `--accent` và `--accent-foreground`.
- **Pillar 2: Mobile & Foldable Device Optimization (MOB-01, MOB-02, MOB-03, MOB-04)**:
  - **Virtual Keyboard Resizing**: Khai báo `interactiveWidget: "resizes-content"` trong export `viewport` của `src/app/layout.tsx` theo chuẩn W3C VirtualKeyboard API, ngăn bàn phím ảo che khuất thanh chat controls trên mobile/tablet.
  - **Landscape Safe-Area Insets**: Tích hợp các biến CSS safe-area-inset ngang (`--sal`, `--sar`) vào `HeaderBar.tsx` và nhánh non-landing của `ChatControls.tsx` khi xoay ngang máy, kết hợp `md:px-6` để triệt tiêu việc cộng dồn padding hai lần trên desktop.
  - **Foldable Responsive Popovers**: Thiết lập trần chiều rộng `max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]` trong `src/components/ui/popover.tsx`, bảo vệ popover không bị tràn viền màn hình ngoài của các thiết bị gập hẹp (như Galaxy Z Fold ~280px).
  - **Drawer Touch Swipe & Snap-to-Origin**: Xây dựng tiện ích cử chỉ `drawerGesture.ts` (9 test cases biên) và tích hợp Framer Motion drag gestures (`drag="x"`, `dragDirectionLock`, `dragConstraints`, `dragElastic`, `dragSnapToOrigin`, `onDragEnd`) cho `Sidebar.tsx`, cho phép vuốt đóng drawer mượt mà và tự động hồi vị về x = 0 nếu không vượt ngưỡng đóng (-80px hoặc vận tốc -300px/s).
- **Pillar 3: Gallery & Image Studio A11y & Interactions (UI-02, UI-03, API-02, A11Y-01)**:
  - **Accessible Floating Close & Bilingual Label (UI-02 / M8)**: Khắc phục lỗi nút đóng modal chi tiết ảnh rỗng icon trong `GalleryView.tsx`. Bổ sung nút floating close bọc trong `div` (`lg:hidden`) và sidebar close button với nhãn song ngữ `closeImageDetails` ("Đóng chi tiết hình ảnh" / "Close image details") trong `vi.ts` và `en.ts`.
  - **Touch Swipe Comparison Slider (UI-03)**: Bổ sung sự kiện vuốt chạm `onTouchStart`, `onTouchMove` và class `touch-none` cho thanh trượt so sánh ảnh trong `ImageCompareModal.tsx`, cho phép thao tác vuốt trơn tru trên màn hình cảm ứng di động.
  - **Image Studio Inclusion in Gallery (API-02 / TC-GAL-04)**: Xác thực API Gallery `/api/gallery` hiển thị ảnh từ Image Studio, loại trừ `USER_TEMPLATES_STORE`, hỗ trợ bộ lọc `favorites=true` và bổ sung test suite kiểm tra query builder trong `src/app/api/gallery/route.test.ts`.
  - **Canvas Keyboard Navigation (A11Y-01)**: Bổ sung `group-focus-within:opacity-100` và `group-focus-within:translate-y-0` cho lớp điều khiển ảnh trong `Canvas.tsx`, giúp người dùng khiếm thị hoặc điều hướng bằng bàn phím (Tab) hiển thị đầy đủ các nút chức năng.
- **Verification Gate**:
  - `npm run verify` (`npm run type-check; npm run lint; npm run test:run`) passed 100%.
  - 106 test files passed, 1138 tests passed (0 failures).
  - 0 TypeScript errors.
  - 0 ESLint warnings / errors.

---

## 2026-10-11: Fix IPv6 Literal Bracket Handling in SSRF Guard for Linux CI

- **SSRF Guard IPv6 Bracket Normalization**:
  - Khắc phục lỗi `ssrfGuard.server.test.ts` trên môi trường Linux CI (GitHub Actions) do `new URL("http://[::1]/status").hostname` trả về chuỗi có chứa ngoặc vuông `[::1]`, khiến `net.isIP("[::1]")` trả về `0` (false) và rơi xuống hàm `dns.promises.lookup("[::1]")` gây lỗi `EAI_NONAME` / `ENOTFOUND` trên Linux glibc `getaddrinfo`.
  - Cập nhật `isIpRestricted` và `validateSafeUrl` trong `src/lib/core/ssrfGuard.server.ts` tự động bóc tách ngoặc vuông cho IPv6 literals trước khi kiểm tra `net.isIP()`, nhận diện chính xác các địa chỉ restricted loopback (`::1`, `fe80::`, `::ffff:`) ngay tại tầng kiểm tra IP trực tiếp mà không cần phân giải DNS.
  - Bổ sung test assertions cho bracketed IPv6 trong `src/lib/core/ssrfGuard.server.test.ts`.
- **Verification Gate**:
  - `npm run verify` passed: 100/100 test files pass, 1088/1088 tests pass.

---

## 2026-10-08: Audit Remediation Phase 2 -- Streaming, RAG & Media Attachments

- **Pillar 1: Streaming Reliability & Provider Normalization (STR-01, STR-02, STR-03)**:
  - **OpenAI Vision Format & Think Tag Sanitization (STR-01)**: Chuẩn hóa tin nhắn có ảnh trong `openai-stream.ts` theo chuẩn OpenAI Vision Spec: chỉ ánh xạ ảnh cho tin nhắn `user`, hạ cấp tin nhắn ảnh của `assistant` trong lịch sử thành văn bản thuần. Lọc bỏ thẻ suy luận `<think>...</think>` khỏi lịch sử tin nhắn để tránh ô nhiễm context.
  - **Gemini Context Cache Preservation (STR-02)**: Bảo toàn tham số `cachedContent` khi thực hiện tool continuation call trong `gemini-stream.ts`.
  - **IME Telex Composition & Streaming Keyboard Guard (STR-03)**: Chặn submit ngoài ý muốn khi gõ Telex tiếng Việt (`isComposing` hoặc `keyCode === 229`) và ngăn ngắt stream khi nhấn phím Enter trên Desktop trong lúc model đang phản hồi.
- **Pillar 2: Reasoning Stream Separation & End-to-End Encryption (M-1, M-6, M-8, M-9, M-10, M-13, M-15)**:
  - **SSE Named Event Wire Protocol**: Tách biệt luồng suy luận thành event SSE chuẩn `event: thinking\ndata: {"type":"thinking","content":"..."}\n\n` trên cả 4 providers (`gemini-stream.ts`, `deepseek-stream.ts`, `anthropic-stream.ts`, `openai-stream.ts`).
  - **Empty Answer Resilience**: Bổ sung cờ `emptyAnswerReason: "length" | "no_content"` trong `post-processing.ts` cho các trường hợp model cạn token hoặc chỉ sinh suy luận mà không có câu trả lời; hiển thị banner hướng dẫn người dùng giảm thinking level.
  - **Data-at-Rest Encryption (AES-GCM)**: Tự động mã hóa `meta.reasoning` trước khi lưu vào CSDL qua `encryptMetaReasoning` và giải mã an toàn khi đọc qua `decryptMetaReasoning` (`messages.ts`, `/api/messages/route.ts`).
  - **UI/UX Reasoning & RAG Citations**: Tích hợp hiển thị khối suy luận thời gian thực và trích dẫn tài liệu Knowledge Base (`ragSources`) ngay trong streaming bubble (`ChatApp.tsx`, `ChatMessagesArea.tsx`, `ChatBubble.tsx`).
- **Pillar 3: RAG Knowledge Base Multipart Upload & Similarity Alignment (RAG-01, RAG-02)**:
  - **Multipart Document Upload (RAG-01)**: Hỗ trợ upload tài liệu trực tiếp qua FormData multipart cho Knowledge Base (`/api/projects/[id]/knowledge`), thiết lập trần payload an toàn 4.5MB (HTTP 413) trước khi đọc body, trích xuất text với giới hạn 400.000 ký tự và cảnh báo `documentTruncatedNotice` cho người dùng.
  - **Vector Similarity Threshold (RAG-02)**: Điều chỉnh ngưỡng tương đồng mặc định từ `0.7` về `0.5` trong `knowledge.server.ts` để cải thiện độ phủ truy hồi ngữ cảnh của RAG.
- **Pillar 4: Project Deletion IDOR Protection (SEC-05)**:
  - Kiểm tra quyền sở hữu project chặt chẽ trước khi xóa (`projects.server.ts`), giới hạn phạm vi xóa và hủy liên kết `conversations` chỉ áp dụng cho tài khoản người dùng hiện tại (`user_id = userId`).
- **Pillar 5: Batch Image Generation Quota & Gatekeeper (SEC-06 / B-1)**:
  - **Atomic Quota Claim-Then-Rollback**: Thiết kế lại `batchGenQuota.ts` với hàm nguyên tử `tryClaimBatchGenSlot` (kiểm tra hạn ngạch, tăng Redis counter và rollback khi provider ném lỗi). Hỗ trợ in-memory dev fallback khi môi trường dev không cấu hình Upstash Redis.
  - **Gatekeeper Hardening**: Bổ sung chốt chặn trạng thái tài khoản fail-closed trong `/api/generate-image`, `/api/edit-image`, `/api/edit-image-multi`, và `/api/describe-image` (503 `SERVICE_UNAVAILABLE` nếu không tra cứu được hồ sơ, 403 `USER_BLOCKED` nếu tài khoản bị khóa, 403 `ACCESS_PENDING` nếu rank `not_whitelisted`).
- **Pillar 6: Storage-Aware Image Editing & Lean Payloads (API-04 / B-2, M-4)**:
  - **Storage Path Validation**: Tạo `storageValidation.ts` ngăn chặn triệt để directory traversal (`%2e%2e`, `%`, `\`, ký tự điều khiển) và xác thực quyền sở hữu storagePath thông qua bản ghi tin nhắn trong CSDL.
  - **Lean Multi-Turn Payloads**: Loại bỏ hoàn toàn việc truyền chuỗi base64 nặng từ client lên server trong `/api/edit-image-multi` và `EditPanel.tsx`; server tự động tải ảnh nguồn qua Supabase Storage bằng `storagePath` và áp dụng sliding window tối đa 3 lượt ảnh.
- **Verification Gate**:
  - 100 test files passed, 1088 tests passed (0 failures).
  - `npm run type-check`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run verify`: PASS.

---

## 2026-10-08: Gemini Thinking Level Migration & Sampling Parameters Sanitization

- **Google Gemini API Migration (Deprecation Cleanup)**:
  - **Thinking Level Migration**:
    - Chuyển đổi toàn diện sang `thinkingLevel` (`minimal`, `low`, `medium`, `high`) cho họ mô hình Gemini 3+ (`gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`).
    - Bảo toàn 100% backward compatibility cho mô hình mặc định `gemini-2.5-flash` qua nhánh `thinkingBudget: -1` (dynamic thinking).
    - Thiết lập bất biến Mutual Exclusion: Tuyệt đối không gửi đồng thời `thinkingLevel` và `thinkingBudget` trong cùng một request config, triệt tiêu nguy cơ lỗi HTTP 400 INVALID_ARGUMENT.
    - Bổ sung hàm thuần `getSupportedGeminiThinkingLevels` và `clampGeminiThinkingLevel` trong `src/lib/core/modelRegistry.ts` làm Single Source of Truth; server tự động kẹp bậc suy luận không được model hỗ trợ (ví dụ `minimal` -> `low` trên `gemini-3.1-pro-preview`).
  - **Sampling Parameters Sanitization**:
    - Loại bỏ hoàn toàn `temperature`, `top_p`, `top_k` khỏi các request gửi tới Gemini API (`gemini-stream.ts`, `autoTitleEngine.ts`, `fileProcessors.ts`).
    - Xóa `temperature?: number` khỏi `ChatStreamParams.config` trong `types.ts` để kích hoạt TypeScript excess property check (Negative Probe).
    - Bảo toàn 100% cấu hình sampling của Anthropic Claude (`temperature: 1` khi thinking, `0.7` khi tắt), OpenAI/Groq (`temperature: 0.7`), và DeepSeek (`temperature: 0.7`).
    - Trong `autoTitleEngine.ts`: sử dụng enum `ThinkingLevel.MINIMAL` từ `@google/genai` cho Gemini 3 để chống tràn token suy luận (Reasoning Token Truncation) và bảo đảm type-check sạch.
  - **Cross-Model UI Harmonization & Pure Derived State**:
    - Trích xuất hàm thuần `getAvailableThinkingLevels` và `getEffectiveThinkingLevel` trong `useThinkingLevel.ts`: loại bỏ hoàn toàn `useEffect` auto-persist phá hủy state của người dùng khi reload trang hoặc ghé qua model không-thinking.
    - Cập nhật `ThinkingLevelSelector.tsx` dựng options theo năng lực model thật (hiển thị `medium` cho Gemini 3.1 Pro), đồng bộ checkmark và nhãn theo `effectiveLevel`.
    - Chuẩn hóa dropdown của Claude sang hiển thị `off/high` nhất quán với `anthropic-stream.ts`.
  - **Co-located Unit Tests & Verification**:
    - Viết mới: `src/lib/core/modelRegistry.test.ts` (10 tests), `src/lib/core/autoTitleEngine.test.ts` (6 tests), `src/lib/features/files/fileProcessors.test.ts` (2 tests).
    - Mở rộng: `src/app/api/chat-stream/streaming/gemini-stream.test.ts` (thêm 5 tests, tổng 6 tests), `src/app/features/chat/components/hooks/useThinkingLevel.test.ts` (thêm 11 tests, tổng 18 tests).
    - `npm run verify` sạch hoàn toàn (type-check + lint + test).

---

## 2026-10-01: Audit Remediation Phase 1 -- Security, Admin Dashboard & Core Fixes

- **Pillar 1: Security Hardening & Zero-Trust Tenant Isolation**:
  - **SEC-01 (IDOR & Storage Traversal)**: Bổ sung xác thực quyền sở hữu `userId` qua 4 điểm sink (`deleteMessage`, `deleteMessageByClientMessageId`, `deleteMessagesIncludingAndAfter`, `/api/gallery/[id]`) và `conversationLoader.ts`. Tạo module `src/lib/features/chat/storageCleanup.ts` kiểm tra nghiêm ngặt tiền tố `${userId}/` và loại trừ directory traversal `..` trước khi gọi `storage.remove()`. Co-located test: `storageCleanup.test.ts` (4 tests).
  - **SEC-02 (RAG Cross-Tenant Context Leak)**: Thêm `.eq("user_id", userId)` vào `getConversationProjectId` trong `ragContext.server.ts`. Bổ sung kiểm tra quyền sở hữu project trước khi gọi `generateEmbedding` và RPC `match_project_knowledge` trong `knowledge.server.ts`. Co-located test: `ragContext.server.test.ts` (11 tests), `knowledge.server.test.ts` (17 tests).
  - **SEC-03 (SSRF Defense)**: Tạo `src/lib/core/ssrfGuard.server.ts` với `fetchSafeImage`. Sử dụng `dns.promises.lookup` và `net.BlockList` ngăn chặn IP loopback, private RFC 1918, link-local, cloud metadata (`169.254.169.254`), CGNAT, ULA và IPv4-mapped IPv6. Manual redirect tối đa 3 hops, tổng deadline 10s, giới hạn streaming 10MB và hủy socket với `body.cancel()`. Bảo vệ `/api/describe-image` và `/api/edit-image`. Co-located test: `ssrfGuard.server.test.ts` (19 tests).
  - **SEC-04 (Safe Math Parsing & Injection Defense)**: Thay thế hoàn toàn `new Function` trong chat function registry `calculate` bằng `src/lib/features/chat/mathParser.ts` (Recursive Descent Parser). Hỗ trợ toán tử `+,-,*,/,%,^,**`, toán tử âm `-(2^2) = -4`, giới hạn lũy thừa `[-50, 50]` và danh sách allowlist hàm `Math`. Co-located test: `mathParser.test.ts` (20 tests), `functionRegistry.test.ts` (6 tests).
- **Pillar 2: Admin Dashboard Integrity & PostgREST Counting**:
  - **ADM-01 & ADM-02 (User Identity & Stats Counting)**: Hỗ trợ cả canonical email và UUID trong `/api/admin/users`. Tra cứu hồ sơ theo ID rồi fallback sang canonical email, cập nhật theo `targetProfile.id` và bump token version theo canonical email. Sửa `/api/admin/stats` chuẩn hóa email lowercase và đếm tin nhắn qua PostgREST join `messages` với `conversations!inner(user_id)`. Co-located test: `admin/users/route.test.ts` (15 tests), `admin/stats/route.test.ts` (5 tests).
  - **ADM-03 (Rank Configs Boundary Validation)**: Ràng buộc số nguyên `int4` `[0, 2147483647]` trên `daily_message_limit`, `max_file_size_mb`, `daily_research_limit` trong `/api/admin/rank-configs`. Đưa `daily_research_limit` vào payload update CSDL. Cập nhật `RankConfigManager.tsx` với fallback an toàn chống `NaN` và vượt ngưỡng int4. Co-located test: `admin/rank-configs/route.test.ts` (16 tests).
- **Pillar 3: Gallery Database Pagination & UI Polish**:
  - **API-01 & API-02 (Gallery Database-Level Pagination)**: Chuyển đổi truy vấn `/api/gallery` sang join PostgREST `messages` với `conversations!inner(user_id, model)` kèm lọc ảnh JSONB, sắp xếp `created_at.desc, id.desc` và phân trang `.range(offset, offset + limit)` trực tiếp tại CSDL, ngăn ngừa tải toàn bộ messages vào RAM. Bao gồm hình ảnh sinh từ Image Studio. Co-located test: `api/gallery/route.test.ts` (22 tests).
  - **UI-01 (CommandPalette Theming)**: Thêm key song ngữ `switchTheme` vào `vi.ts`/`en.ts`. Kết nối lệnh switch theme với hook `useTheme:toggleTheme()`, ngăn chặn reset biến màu CSS. Co-located test: `CommandPalette.test.tsx` (5 tests).
  - **UI-02 (GalleryView Modal Close Button)**: Bổ sung icon `<X />`, `aria-label`, tooltip và focus ring cho nút đóng modal chi tiết ảnh. Co-located test: `GalleryView.test.tsx` (2 tests).
- **Quality Gate & Verification**:
  - 89 test files passed, 975 tests passed (tăng từ 892 lên 975 tests, 0 failed).
  - `npm run type-check`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - Cập nhật living documentation `docs/database-schema.md` (mô tả `profiles.id` là canonical email).

---

## 2026-10-01: Foldable Responsive Design, DeepSeek Thinking Recovery & Avatar Enhancement

- **Pillar 1: Foldable & Special Aspect Ratio Responsive Overhaul**:
  - `viewportFit: "cover"` trong `src/app/layout.tsx`. Khai báo CSS custom properties cho Safe Area Insets (`--sat`, `--sar`, `--sab`, `--sal`) và `@media (max-height: 500px)` trong `src/app/styles/themes/_shared/base.css`.
  - Thay thế toàn bộ giả định `h-screen w-screen` bằng `h-dvh w-full overflow-hidden` trên `ChatApp.tsx`. Container query `@container/chat` và padding an toàn trên `scrollRef`, floating controls, `ScrollToBottomButton`, và `ChatControls`.
  - Đồng bộ safe area insets trục ngang (`calc(5rem + var(--sal, 0px))` và `calc(18rem + var(--sal, 0px))` kèm `pr-[var(--sar,0px)]`) cho cả 2 trạng thái aside desktop và mobile drawer trong `Sidebar.tsx`, cùng 3 view vệ tinh dùng chung (`GalleryView.tsx`, `ImageGenStudio.tsx`, `DescribeImageView.tsx`).
  - Cập nhật `dialog.tsx` và `alert-dialog.tsx` với `max-h-[calc(100dvh-2rem)] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full`.
- **Pillar 2: DeepSeek Stream Optimization & 1-Click Thinking Recovery**:
  - Nâng trần `maxOutputTokens` cho `deepseek-v4-pro` từ 16.384 lên `65536` trong `src/lib/core/modelRegistry.ts`.
  - Tạo mới module typed request builder `src/app/api/chat-stream/streaming/deepseek-request-builder.ts`: chuẩn hóa `reasoning.effort` sang `"high"` / `"xhigh"`, định tuyến OpenRouter fallback providers (`Relace`, `Together`, `Novita`, `DeepSeek`), và dọn sạch 100% `any`. Co-located test: `deepseek-request-builder.test.ts` (9 tests).
  - Khắc phục phản hồi rỗng hoàn toàn 0 delta: server phát event SSE `error` `{ code: "empty_response", status: 502 }`, hiển thị banner song ngữ qua `StreamErrorBanner.tsx`.
  - Cơ chế Thinking Recovery Card 1-Click: Khi stream cạn token chỉ có suy nghĩ mà không có câu trả lời, server phát meta event `emptyAnswerNotice` và lưu DB. Client render `EmptyReasoningNotice.tsx` với nút "Tạo lại" và "Tạo lại với suy nghĩ thấp hơn" (tính toán qua `getLowerThinkingLevel`). Backward-compatible với tin nhắn DB cũ qua `parseLegacyNotice`.
  - Co-located tests: `useThinkingLevel.test.ts` (7 tests), `EmptyReasoningNotice.test.tsx` (5 tests), `legacyNotice.test.ts` (4 tests).
- **Pillar 3: High-Fidelity Model Brand Icons & Thinking/Streaming Avatar Animations**:
  - Nâng cấp `ModelAvatar.tsx`: Bộ SVG nhận diện chính hãng với multi-stop brand gradients (Gemini 4-color, Claude Terracotta, DeepSeek Ocean Cyan, OpenAI Emerald, Groq Flame, Generic Brain Violet). Bảo vệ chống xung đột gradient DOM ID thông qua `React.useId()`. Co-located test: `ModelAvatar.test.tsx` (8 tests).
  - Nâng cấp `BubbleAvatar.tsx`: Áp dụng vật lý chuyển động Emil Kowalski, cấu trúc 4-state Precedence (`loading` > `thinking` > `streaming` > `idle`) với thuộc tính DOM `data-state`. Trạng thái suy nghĩ Breathing Pulse (chu kỳ 2.0s, scale [1, 1.05, 1], opacity [0.85, 1, 0.85], aura glow). Gating chống áp dụng hiệu ứng cho tin nhắn lịch sử. Co-located test: `BubbleAvatar.test.tsx` (17 tests).
- **Quality Gate & Verification**:
  - 82 test files passed, 892 tests passed (tăng từ 850 lên 892 tests, 0 failed).
  - `npm run type-check`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - Grep probe xác nhận 0 occurrences của `h-screen` trong `ChatApp.tsx`.

---

## 2026-10-01: Update DeepSeek V4.1 Flash Provider Metrics (Relace)

- **Provider Verification & Metrics Sync**: Xác thực cấu hình OpenRouter provider ưu tiên của DeepSeek V4.1 Flash (`deepseek/deepseek-v4.1-flash`) là Relace (`order: ["Relace"]`). Cập nhật thông số chi phí ($0.02/M input, $0.60/M output, $0.02/M cache read) và hiệu năng (latency 1.12s, throughput 51 tps, uptime 99.98%) trong tài liệu kỹ thuật `docs/models.md`. Toàn bộ 5/5 unit tests của `deepseek-stream.test.ts` và 850/850 tests toàn dự án đều pass.

---

## 2026-10-01: File Upload & Chat Attachments System Overhaul

- **Binary Storage Key Fix [C4]**: Chuẩn hóa đường dẫn Supabase Storage chỉ chứa pure ASCII: `${userId}/${conversationId}/${uuid}.${safeExt}`. Giữ nguyên 100% tên file tiếng Việt gốc có dấu trong bảng PostgreSQL `files.filename`.
- **Clean Document Text Extraction [C1 & M7]**:
  - Tích hợp bộ parser tài liệu sạch `src/lib/features/files/documentParsers.ts`: DOCX (`mammoth`), XLSX (`exceljs`), PDF (`pdf-parse` v2 với page cap 200 trang và parser cleanup trong `finally`), text UTF-8, loại bỏ ký tự rác nhị phân NUL (`\u0000`). Chặn hoàn toàn binary garbage / OLE2 (`.doc`, `.xls`, `.ppt`).
  - Tạo migration SQL `database-migrations/20261001000000_clean_corrupted_extracted_text.sql` dọn sạch cache rác nhị phân cũ.
- **Multi-turn Context Injection & Gemini ACTIVE Polling [C2, C3, C5]**:
  - Tái cấu trúc `attachmentProcessor.ts` và `contextBuilder.ts`: chấm dứt việc nhồi toàn bộ 30 file cũ vào `contents[0]`. File của từng message được định tuyến chính xác vào đúng turn tương ứng thông qua `contentsMeta` từ `messages.meta.fileIds`.
  - Phân luồng native multimodal cho Gemini models với Gemini Files API, polling trạng thái `ACTIVE` cho file lớn/video qua `waitForGeminiFileActive` với timeout 15s và AbortSignal. Fallback an toàn sang inline base64 cho hình ảnh và text cho tài liệu.
  - Tính toán token budget chính xác dựa trên `estimateTokens` (chuẩn hóa Unicode tiếng Việt). Chống IDOR triệt để qua kiểm tra `listFiles` theo tenant `userId` + `conversationId`.
- **Draft Conversation Coordinator cho New Chat [U1, MAJOR-7]**:
  - Tạo `src/lib/features/chat/draftConversation.ts` với predicate `shouldClearQueue` và `createDraftCoordinator`.
  - Cho phép người dùng chọn file / drag-drop / paste ngay khi ở trạng thái New Chat (`conversationId === null`). Hàng đợi upload không bị xóa oan khi conversationId chuyển từ `null -> newId`.
- **Database Relationship Synchronization [M1]**:
  - Bổ sung `linkFilesToMessage(userId, conversationId, fileIds, messageId)` trong `fileService.server.ts` với tenant filters an toàn, liên kết `files.message_id` với `messages.id` sau khi lưu user message.
- **Mobile Touch UX & Bilingual i18n [U2, U3, U4]**:
  - Sửa nút xóa file trên `FilePreviewCard.tsx`: bổ sung `pointer-coarse:opacity-100` và kích thước tối thiểu 24×24px tuân thủ WCAG 2.2 cho màn hình cảm ứng.
  - Bổ sung 6 translation keys thiếu vào `src/lib/utils/translations/vi.ts` và `en.ts` (`dropFilesHere`, `confirmClearAll`, `clearAllFiles`, `filesCleared`, `deleteFileFailed`, `noFilesUploaded`). Truyền `t` đối xứng cho `FileLightbox` và `FileManagerPanel`.
- **Co-located Test Suite & Verification**:
  - Bổ sung 5 file test co-located mới: `tokenEstimate.test.ts` (7 tests), `documentParsers.test.ts` (13 tests), `fileValidation.test.ts` (12 tests), `fileService.server.test.ts` (4 tests), `draftConversation.test.ts` (7 tests), `attachmentProcessor.test.ts` (4 tests).
  - Verification: 77 test files passed, 850 tests passed, 0 lint warnings, 0 type errors.

---

## 2026-09-30: Comprehensive UI/UX Audit & Modernization Implementation (Phases 0–3)

- **Phase 0 (Critical P0 Bug Fixes & UX Blockers)**:
  - **LazyModals & Modal Confirm Fix (TC-01)**: Tách `LazyModals.tsx` với latch pattern chống tải thừa modal bundle, chuyển `GemModal` và `PersonaModal` sang `confirm()` từ `confirmStore` với `variant: "danger"` và re-entrancy lock `isConfirmingRef`. Co-located unit tests: `GemModal.test.tsx` (3 tests), `PersonaModal.test.tsx` (3 tests).
  - **Semantic Z-Scale & Glassmorphism Theme Fixes**: Bổ sung thang z-index ngữ nghĩa (`--z-drawer: 60`, `--z-modal: 70`, `--z-popover: 75`, `--z-toast: 80`, `--z-banner: 90`), sửa lỗi các themes glassmorphism (`nebula`, `aqua`, `holo`, `orchid`, `sunset`) tách biệt solid fallback `--surface` và `--surface-gradient`. Đồng bộ z-index trên toàn bộ primitives (`dialog`, `popover`, `select`, `tooltip`, `dropdown-menu`, `alert-dialog`, `IconPicker`, `ToastContainer`, `StreamErrorBanner`, `Sidebar`).
  - **Dead Token Eradication (TC-04)**: Quét sạch 0 occurrences các CSS tokens chết trên toàn bộ `src/`: `--text-muted` -> `--text-secondary`, `--surface-base` -> `--surface`, `--surface-hover` -> `--control-bg-hover`, `--border-hover` -> `--control-border`, `--text-tertiary` -> `--text-secondary`, `--primary-hover` & `--primary-foreground` -> `bg-(--accent) text-(--accent-foreground) hover:brightness-110`.
  - **Language Hydration & Side-Effect Explosion Fix (TC-07)**: Sửa `LanguageUpdater.tsx` theo chuẩn read-first, write-after latch pattern `const [hasHydrated, setHasHydrated] = useState(false)` chống ghi đè cài đặt tiếng Việt thành tiếng Anh khi reload. Loại bỏ side-effect ghi đè `localStorage` trong `useLanguage.ts` (loại bỏ 71 re-writes trên mount). Co-located test: `LanguageUpdater.test.tsx` (2 tests).
  - **Navigation & Error Feedback (TC-06, TC-08, TC-09)**: Sửa điều hướng deep research gọi `setSelectedConversationIdAndUrl(id)`. Thêm `toast.error()` và `logger.error()` với symmetric translation keys vào `KnowledgePanel.tsx`, `ProjectNode.tsx`. Khóa `isSubmittingRef` chống double-submit trong `InputForm.tsx`.
- **Phase 1 (Safe P1 - Performance & Modular Extraction)**:
  - **Typewriter Module (TC-02)**: Tạo `src/lib/features/chat/typewriter.ts` với hàm thuần `computeCharsToTake`, hằng số `BASE_CHARS_PER_TICK = 2`, `MIN_INTERVAL_MS = 30`. Co-located test: `typewriter.test.ts` (5 tests). Tạo hook `useTypewriterBuffer.ts` tích hợp vào `useChatStreamController.ts`.
  - **Virtualization Module & useChatScroll (TC-03a,b,c,d)**: Tạo `src/lib/features/chat/virtualization.ts` (prefix-sum `createSizeCache`, `computeVisibleRange`, `calculateVirtualPadding`, conditional `computeScrollCompensation`). Feature flag: `ENABLE_VIRTUALIZED_CHAT = false` an toàn trong `constants.ts`. Co-located test: `virtualization.test.ts` (5 tests). Cập nhật `useChatScroll.ts` với `isAtBottom`, `unreadCount`, `scrollToBottom`.
  - **ChatMessagesArea Component Extraction**: Tách khối render danh sách tin nhắn từ `ChatApp.tsx` thành `src/app/features/chat/components/ChatMessagesArea.tsx` (280 dòng), hỗ trợ cả chế độ ảo hóa lẫn fallback map, bao bọc toàn bộ logic hiển thị tin nhắn, nhánh hội thoại, ngữ cảnh ẩn, và streaming bubble. Co-located test: `ChatMessagesArea.test.tsx` (4 tests).
  - **Markdown & HeaderBar Optimization**: Hoãn thực thi `rehypeHighlight` trong `BubbleMarkdown.tsx` khi `isStreaming` đang chạy để tránh lag main-thread. Thay thế `next/dynamic` bằng direct Lucide icon imports trong `HeaderBar.tsx` tránh layout shift FOIC.
- **Phase 2 (P2 - Accessibility & UI Polish)**:
  - Nâng cấp typography <12px thành `text-xs` (12px) trên `ChatApp.tsx`, `HeaderBar.tsx`.
  - Bổ sung `aria-expanded` và `aria-label` cho `SidebarSection.tsx` và `SidebarItem.tsx`.
  - Tạo `ScrollToBottomButton.tsx` với icon ChevronDown, badge số lượng tin nhắn chưa đọc, animation Framer Motion. Co-located test: `ScrollToBottomButton.test.tsx` (4 tests).
- **Phase 3 (P3 - Feature Enhancements)**:
  - **Command Palette (`Cmd+K` / `Ctrl+K`)**: Tạo `src/app/features/chat/components/CommandPalette.tsx` hỗ trợ tìm kiếm nhanh tác vụ (New chat, Switch theme, Change language, Keyboard shortcuts) và nhảy nhanh đến các cuộc trò chuyện gần đây qua bàn phím. Co-located test: `CommandPalette.test.tsx` (4 tests).
  - **Keyboard Shortcuts Modal (`?`)**: Tạo `src/app/features/chat/components/KeyboardShortcutsModal.tsx` hiển thị bảng phím tắt tiện ích chuẩn Vikini. Co-located test: `KeyboardShortcutsModal.test.tsx` (2 tests).
  - Bổ sung đầy đủ cặp từ khóa đa ngôn ngữ đối xứng (`commandPalette`, `keyboardShortcuts`, v.v.) trong `vi.ts` và `en.ts`.
- **Quality Gates Verification**:
  - `npm run type-check`: 0 errors.
  - `npm run lint`: 0 errors, 0 warnings.
  - `npm run test:run`: 71 test files passed, 803 tests passed, 0 failures.
  - `npm run build`: Production build thành công 100% (22 static/dynamic routes).

---

## 2026-09-29: Docs, Rules & Agents Restructuring (Revision 6)

- Tái cấu trúc toàn diện thư mục docs và hạ tầng tác tử theo chuẩn Diátaxis và Agent-Ready 2026.
- Tạo mới navigation hubs: docs/README.md, .agents/README.md, .agents/skills/README.md.
- Cắt giảm dung lượng CHANGELOG.md từ 138 KB xuống ~33.5 KB; lưu trữ 74 mục cũ sang docs/archive/CHANGELOG-legacy.md.
- Hợp nhất context.md vào overview.md; chuyển model routing guide sang .agents/README.md.
- Chuẩn hóa toàn bộ tham chiếu nội bộ sang tiền tố .agents/ và sửa lỗi chính tả trong tiền tố quy tắc tác tử.
- Dọn dẹp thư mục rác reviewer backup và chuẩn hóa tài liệu superpowers cũ sang docs/specs/ và docs/archive/plans/.

## 2026-09-29: Supabase CLI TypeGen Automation & Immutable Gemini Embedding 2 Migration

- **Supabase CLI & Type Generation Automation**:
  - Nâng cấp `supabase` CLI trong `devDependencies` lên `v2.118.0`.
  - Thiết lập lệnh `npm run db:types` tự động sinh file `src/types/database.types.ts` trực tiếp từ schema remote Supabase.
  - Cấu hình `.gitignore`, `.prettierignore`, và `eslint.config.mjs` bảo vệ file types tự sinh.
- **Thống Nhất Mô Hình Embedding Duy Nhất `gemini-embedding-2` (3072d)**:
  - Loại bỏ hoàn toàn `text-embedding-004` (đã deprecate/ngừng hỗ trợ), thống nhất duy nhất `gemini-embedding-2` (API endpoint: `gemini-embedding-2-preview`) với số chiều cố định 3072.
  - Tạo migration DDL `supabase/migrations/20260928180000_unify_gemini_embedding_2.sql` bọc trong transaction `BEGIN; ... COMMIT;`:
    - Đánh dấu `status = 'error'` cho các documents có chunks bị lệch số chiều.
    - Xóa sạch các chunks ≠ 3072 chiều.
    - Khóa cứng số chiều cột qua `ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE VECTOR(3072);`.
    - Đặt `NOT NULL`, `DEFAULT 'gemini-embedding-2'`, và `CHECK` constraint trên cả 2 bảng `projects` và `knowledge_documents`.
    - Cập nhật RPC `match_project_knowledge` giữ nguyên 100% chữ ký và cột trả về `filename TEXT`, bổ sung guard `vector_dims(kc.embedding) = 3072`.
- **Sửa Lỗi Native Batching Của Google GenAI SDK (`@google/genai` 2.10.0)**:
  - Khắc phục lỗi SDK tự động gộp mảng `string[]` thành 1 user Content duy nhất dẫn đến việc Gemini chỉ trả về 1 vector cho cả batch.
  - Chuyển sang định dạng Content parts chuẩn xác: `contents: subBatch.map((text) => ({ role: "user", parts: [{ text }] }))`.
  - Phân định rõ ràng chiến lược retry: Search query retry tối đa 1 lần, Batch upload retry tối đa 3 lần với exponential backoff.
- **Bảo Vệ Tính Bất Biến & Type Safety (Strict 400 Rejection)**:
  - Nghiêm cấm client truyền `embedding_model` qua API routes (`POST /api/projects`, `PATCH /api/projects/[id]`, `POST /api/projects/[id]/knowledge`), lập tức trả về HTTP 400 `ValidationError`.
  - Triển khai singleton typed client `getTypedSupabaseAdmin()` bảo toàn 100% fallback biến môi trường `pickFirstEnv`.
  - Xây dựng mapper function `toProject(row)` bảo vệ toàn bộ dữ liệu trả về khỏi kiểu `string | null` của Supabase CLI.
  - Giữ nguyên singleton client untyped `getSupabaseAdmin()` tại `knowledge.server.ts` để tương thích hoàn hảo với `ChunkMetadata`.
- **Pre-Insert Validation & 2 Tầng Hook Dọn Dẹp (Auto-Cleanup)**:
  - Giới hạn tải: File tối đa 5MB, tài liệu tối đa 500 chunks (~350–400 KB text) được validate TRƯỚC KHI insert DB nhằm tránh rò rỉ quota tài liệu.
  - Bổ sung hàm `cleanupStuckProcessingDocuments()` tự động đánh dấu lỗi các tài liệu kẹt trạng thái `processing` quá 15 phút.
  - Tích hợp 2 tầng dọn dẹp: Opportunistic cleanup trong handler GET `/api/projects/[id]/knowledge` (sau khi verify project) và Cron cleanup định kỳ trong `/api/cron/cleanup` qua `Promise.allSettled`.
- **Làm Sạch UI & Bộ Từ Điển Song Ngữ**:
  - Dọn sạch UI bộ chọn model tại `CreateProjectModal.tsx` và `projectStore.ts`.
  - Xóa bỏ 4 translation keys thừa không còn sử dụng trong `vi.ts` và `en.ts`.
- **Bộ Kiểm Thử Co-Located Đạt Chuẩn 100%**:
  - Bổ sung 3 file test co-located mới:
    - [`src/lib/features/projects/embedding.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/embedding.server.test.ts) (15 tests)
    - [`src/lib/features/projects/projects.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/projects.server.test.ts) (13 tests)
    - [`src/lib/features/projects/knowledge.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.test.ts) (16 tests)
  - Cập nhật 4 test suites API routes hiện hữu: `projects/route.test.ts`, `projects/[id]/route.test.ts`, `knowledge/route.test.ts`, `cleanup/route.test.ts`.
  - Vượt qua Verification Gate Tier 2 (`npm run verify`): 59/59 test files pass, 760/760 tests pass, 0 type errors, 0 lint errors.
- **Files Modified & Added**:
  - [NEW] [`supabase/migrations/20260928180000_unify_gemini_embedding_2.sql`](file:///c:/Users/wyemh/vikini/supabase/migrations/20260928180000_unify_gemini_embedding_2.sql)
  - [NEW] [`scripts/smoke-embedding.ts`](file:///c:/Users/wyemh/vikini/scripts/smoke-embedding.ts)
  - [NEW] [`src/types/database.types.ts`](file:///c:/Users/wyemh/vikini/src/types/database.types.ts)
  - [NEW] [`src/lib/features/projects/embedding.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/embedding.server.test.ts)
  - [NEW] [`src/lib/features/projects/projects.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/projects.server.test.ts)
  - [NEW] [`src/lib/features/projects/knowledge.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.test.ts)
  - [MODIFY] [`package.json`](file:///c:/Users/wyemh/vikini/package.json)
  - [MODIFY] [`.gitignore`](file:///c:/Users/wyemh/vikini/.gitignore)
  - [MODIFY] [`.prettierignore`](file:///c:/Users/wyemh/vikini/.prettierignore)
  - [MODIFY] [`eslint.config.mjs`](file:///c:/Users/wyemh/vikini/eslint.config.mjs)
  - [MODIFY] [`src/types/projects.ts`](file:///c:/Users/wyemh/vikini/src/types/projects.ts)
  - [MODIFY] [`src/lib/core/supabase.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/supabase.server.ts)
  - [MODIFY] [`src/lib/features/projects/embedding.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/embedding.server.ts)
  - [MODIFY] [`src/lib/features/projects/projects.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/projects.server.ts)
  - [MODIFY] [`src/lib/features/projects/knowledge.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.ts)
  - [MODIFY] [`src/app/api/cron/cleanup/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/cron/cleanup/route.ts)
  - [MODIFY] [`src/app/api/projects/[id]/knowledge/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/projects/[id]/knowledge/route.ts)
  - [MODIFY] [`src/app/api/projects/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/projects/route.ts)
  - [MODIFY] [`src/app/api/projects/[id]/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/projects/[id]/route.ts)
  - [MODIFY] [`src/components/features/projects/CreateProjectModal.tsx`](file:///c:/Users/wyemh/vikini/src/components/features/projects/CreateProjectModal.tsx)
  - [MODIFY] [`src/lib/store/projectStore.ts`](file:///c:/Users/wyemh/vikini/src/lib/store/projectStore.ts)
  - [MODIFY] [`src/lib/utils/translations/en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts)
  - [MODIFY] [`src/lib/utils/translations/vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts)
  - [MODIFY] [`docs/database-schema.md`](file:///c:/Users/wyemh/vikini/docs/database-schema.md)
  - [MODIFY] [`docs/contracts.md`](file:///c:/Users/wyemh/vikini/docs/contracts.md)
  - [MODIFY] [`docs/features.md`](file:///c:/Users/wyemh/vikini/docs/features.md)
  - [MODIFY] [`docs/lessons-learned.md`](file:///c:/Users/wyemh/vikini/docs/lessons-learned.md)

## 2026-09-28: Fix Streaming Abort and Interruption Text Loss with Partial Persistence

- **Streaming Abort & Disconnection Text Loss Fix**:
  - Resolved issue where clicking Stop (red square button) or experiencing connection drops/timeouts caused streamed response text to vanish from the chat interface.
  - Implemented client-side partial message finalization with state preservation (`isPartial: true`, `aborted: true`) and seamless background sync via `POST /api/messages`.
  - Added "Complete beats Partial" rule in `upsertMessage` to guarantee completed answers are never accidentally downgraded by delayed partial syncs.
  - Added an in-memory tombstone cache with 60-second TTL to prevent late-arriving stream chunks or aborted responses from resurrecting deleted or regenerated messages.
  - Added server-side stream abort detection across all 4 providers (Gemini, Anthropic, OpenAI, DeepSeek) with safety nets before `processPostStream` and in exception handlers.
  - Balanced `<think>` tags via `ensureBalancedThinkTags` so unclosed reasoning blocks do not corrupt Markdown rendering when interrupted.
  - Added "Tiếp tục" (Continue) action button and prompt extension for interrupted assistant messages, along with UI status badges ("Đã dừng", "Bị gián đoạn", "Đang lưu...", "Lưu thất bại — Thử lưu lại").
- **Files Modified & Added**:
  - [NEW] [`src/lib/features/chat/thinkTags.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/thinkTags.ts) & [`thinkTags.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/thinkTags.test.ts)
  - [NEW] [`src/lib/features/chat/messageMerge.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messageMerge.ts) & [`messageMerge.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messageMerge.test.ts)
  - [NEW] [`src/app/api/messages/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/messages/route.ts) & [`route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/messages/route.test.ts)
  - [NEW] [`src/app/api/chat-stream/streaming/gemini-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.test.ts)
  - [NEW] [`src/app/features/chat/components/hooks/useChatStreamController.test.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatStreamController.test.ts)
  - [MODIFY] [`src/lib/features/chat/messages.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messages.ts) & [`messages.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messages.test.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/gemini-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/gemini-stream.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/anthropic-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/anthropic-stream.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/openai-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/openai-stream.ts)
  - [MODIFY] [`src/app/api/chat-stream/streaming/deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts)
  - [MODIFY] [`src/app/features/chat/components/hooks/useChatStreamController.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useChatStreamController.ts)
  - [MODIFY] [`src/app/features/chat/components/ChatBubble.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx)
  - [MODIFY] [`src/app/features/chat/components/MessageActions.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/MessageActions.tsx)
  - [MODIFY] [`src/app/features/chat/components/ChatApp.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx)
  - [MODIFY] [`src/lib/utils/translations/vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts)

## 2026-09-27: Upgrade Multi-Agent Governance & Code Freeze Guard from Project AURORA (Revision 5)

- **Machine-Enforced Code Freeze Guard**:
  - Triển khai hook tự động `PreToolUse` tại `.agents/hooks.json` và `.agents/scripts/code-freeze-guard.js` (cô lập native ESM qua `.agents/scripts/package.json` và strict typing `// @ts-check`).
  - Áp dụng chính sách **Scoped Protection (Phương án 2)**: Sau khi plan được duyệt (`[PLAN_APPROVED]`), tự động cho phép ghi vào UI components/hooks và feature code; luôn khóa và yêu cầu xác nhận (`ask`) đối với các file nhạy cảm: `*.server.ts`, database migrations, cấu hình hạ tầng test `TEST_INFRA_FILES`, và file test chịu Test Integrity Guard.
  - Tích hợp Test Integrity Guard: Phát hiện và cảnh báo hành vi làm yếu test (giảm `expect()`, thêm `.skip`/`.only`/`xit`/`fit`/`.fails`, nới lỏng matcher, thêm `try/catch`).
  - Chống bypass artifact 4 lớp: Bắt buộc đường dẫn tuyệt đối `path.isAbsolute()`, kiểm tra thoát repo `toRepoRelative() === null`, chuẩn hóa `ARTIFACT_ROOT`, kiểm tra đuôi an toàn (`.md`, `.json`, `scratch/*`), cấm file thực thi.
  - Bổ sung bộ unit test toàn diện `.agents/scripts/code-freeze-guard.test.ts` (64 tests) bao phủ 100% kịch bản.
- **Nâng Cấp Thẩm Quyền & Bộ 3 Vệ Tinh Cho `@reviewer`**:
  - Thêm quyền `run_command` kiểm chứng read-only trong frontmatter `reviewer/agent.md`.
  - Tạo `.agents/agents/reviewer/allowlist.md`: Quy định 4 nhóm lệnh được phép (Verification suite, Wiring probes, Semantic probes in-memory, Git read-only).
  - Tạo `.agents/agents/reviewer/evidence-bar.md`: Quy chuẩn 4 loại bằng chứng bắt buộc (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`), quy trình Negative Probe cho Zod/RLS/Redis, Adversarial Timeline 4 trục.
  - Tạo `.agents/agents/reviewer/mental-simulation.md`: 6 kịch bản đối kháng S1–S6 (Cold-start, SSE streaming teardown, Supabase PostgreSQL temporal logic, cross-task state, 3-tier auth, external resilience & serverless execution cap 800s/60s/30s) và Domain Open Inquiry bản địa hóa 100% cho Vikini.
  - Cập nhật quy trình 7 bước tuần tự và cơ chế công bố `[FALLBACK_MODEL]`.
- **Nâng Cấp Subagent `@qa` và `@planner`**:
  - `@qa` (`qa/agent.md`): Thống nhất taxonomy lỗi `[BLOCKER]`, `[MAJOR]`, `[MINOR]`; thiết lập quy trình 7 bước; bổ sung Bước 3 Verification Gate (fail-fast: dừng ngay và xuất `[QA_FAILED]` nếu verify thất bại, không soi code); Bước 4 bảo tồn 100% tiêu chuẩn riêng của Vikini (co-located tests, bilingual `04-bilingual.md`, `toast.error()`, file size 150–400 dòng, SSE stream abort cleanup, Zustand/SWR race conditions); Bước 6 Test Integrity Audit chống specification gaming; bổ sung allowlist lệnh và Post-[QA_FAILED] Flow.
  - `@planner` (`planner/agent.md`): Thêm `replace_file_content` vào tools, quy định mục Test Contract bắt buộc, nhận diện Circuit Breaker dừng sau 3 vòng lặp, và cơ chế `[NEEDS_PRODUCT_DECISION]` với default assumption.
- **Cập Nhật Bộ Rules Quản Trị Cốt Lõi**:
  - `rules/01-coding.md`: Bổ sung Bảng Trạng Thái Cưỡng Chế (Enforcement Status: máy chặn vs máy hỏi vs kỷ luật) phản ánh trung thực cấu hình linter/compiler Vikini.
  - `rules/02-quality.md`: Bổ sung lưu ý PowerShell 5.1 (dùng `;` thay vì `&&` khi chạy chuỗi lệnh thủ công); quy chuẩn Governance-only changes; Giao thức phân loại lỗi test Loại A/B/C và cấm nới test; phân định ranh giới giữa `workflows/audit.md` và tác tử on-demand `@qa`.
  - `rules/05-plan-review.md`: Tích hợp hook Code Freeze Scoped Protection; chính xác hóa Circuit Breaker (Orchestrator dừng chuỗi sau 3 vòng lặp revision thất bại, tổng hợp lỗi tồn đọng trình User); bắt buộc công bố model fallback.
- **Cập Nhật Tài Liệu Hệ Thống**:
  - `docs/architecture.md`: Cập nhật Section 7 (Multi-Agent Governance Architecture) bổ sung đầy đủ các cơ chế mới.
- **Files Modified & Added**:
  - [NEW] [`.agents/scripts/package.json`](file:///c:/Users/wyemh/vikini/.agents/scripts/package.json)
  - [NEW] [`.agents/scripts/code-freeze-guard.js`](file:///c:/Users/wyemh/vikini/.agents/scripts/code-freeze-guard.js)
  - [NEW] [`.agents/scripts/code-freeze-guard.test.ts`](file:///c:/Users/wyemh/vikini/.agents/scripts/code-freeze-guard.test.ts)
  - [NEW] [`.agents/agents/reviewer/allowlist.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/allowlist.md)
  - [NEW] [`.agents/agents/reviewer/evidence-bar.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/evidence-bar.md)
  - [NEW] [`.agents/agents/reviewer/mental-simulation.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/mental-simulation.md)
  - [NEW] [`.agents/hooks.json`](file:///c:/Users/wyemh/vikini/.agents/hooks.json)
  - [MODIFY] [`.agents/agents/reviewer/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/agent.md)
  - [MODIFY] [`.agents/agents/qa/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/qa/agent.md)
  - [MODIFY] [`.agents/agents/planner/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/planner/agent.md)
  - [MODIFY] [`.agents/rules/01-coding.md`](file:///c:/Users/wyemh/vikini/.agents/rules/01-coding.md)
  - [MODIFY] [`.agents/rules/02-quality.md`](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md)
  - [MODIFY] [`.agents/rules/05-plan-review.md`](file:///c:/Users/wyemh/vikini/.agents/rules/05-plan-review.md)
  - [MODIFY] [`docs/architecture.md`](file:///c:/Users/wyemh/vikini/docs/architecture.md)
  - [MODIFY] [`docs/CHANGELOG.md`](file:///c:/Users/wyemh/vikini/docs/CHANGELOG.md)

## 2026-09-27: Fix Mobile & Short Viewport Sidebar Scroll Failure

- **Bug Fix**: Resolved issue where sidebar chat list and footer could not be scrolled down or accessed on mobile devices and short desktop windows.
- **Root Cause & Technical Highlights**:
  - **Single Scroll Flow Architecture (Option A)**:
    - Desktop: Kept navigation links (`+ New Chat`, `Chat`, `Explore Gems`, `Manage Personas`, `Image Studio`, `Gallery`) fixed at the top, while unifying Projects and Your chats into a single flexible scroll container (`flex-1 min-h-0 overflow-y-auto pr-1 pb-2 custom-scrollbar`).
    - Mobile: Unified all navigation items, Projects, and Your chats into a single continuous scroll area so users can swipe smoothly through the entire drawer without fragmentation or 0px container collapse.
  - **Mobile Drawer Polish**:
    - Reduced excessive drawer padding from `p-6 pb-24` (120px) to `p-5 pb-16` (80px), preserving safe spacing for iOS Safari bottom toolbar while reclaiming vertical space for chat history.
    - Added missing `X` icon inside the mobile drawer close button (`Dialog.Close`).
    - Raised mobile drawer to `z-[60]` and overlay to `z-[55]`, and hid `FloatingMenuTrigger` when `mobileOpen` is active to eliminate UI overlap.
  - **Cross-Browser Theme-Aware Custom Scrollbar**:
    - Added `.custom-scrollbar` utility in `src/app/styles/themes/_shared/utilities.css` using 5px Webkit scrollbars and `@supports not selector(::-webkit-scrollbar)` for Firefox, ensuring Chrome 121+ does not disregard custom width/color rules.
    - Supports the 8 components already referencing `.custom-scrollbar`.
  - **Collapsed Desktop Sidebar Cleanup**:
    - Removed redundant `flex-1` placeholder that split sidebar height 50/50 in collapsed mode; cleanly anchored border-t to the footer.
- **Testing & Verification**:
  - Added new unit test file [`Sidebar.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.test.tsx) testing desktop scroll container, collapsed mode, and mobile drawer.
  - Full Tier 2 quality gate (`npm run verify`: type-check + lint + 618 vitest tests) passed with 0 errors.
- **Files Modified & Added**:
  - [MODIFY] [`src/app/features/sidebar/components/Sidebar.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.tsx)
  - [MODIFY] [`src/app/features/chat/components/ChatApp.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx)
  - [MODIFY] [`src/app/styles/themes/_shared/utilities.css`](file:///c:/Users/wyemh/vikini/src/app/styles/themes/_shared/utilities.css)
  - [NEW] [`src/app/features/sidebar/components/Sidebar.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/sidebar/components/Sidebar.test.tsx)
  - [NEW] [`docs/plans/2026-09-27-mobile-sidebar-scroll-fix-implementation-plan.md`](file:///c:/Users/wyemh/vikini/docs/plans/2026-09-27-mobile-sidebar-scroll-fix-implementation-plan.md)
  - [MODIFY] [`docs/lessons-learned.md`](file:///c:/Users/wyemh/vikini/docs/lessons-learned.md)

## 2026-09-17: Adopt Multi-Agent Subagent Architecture (Planner, Reviewer, QA) from Project AURORA

- **Architecture & System Governance**: Tích hợp toàn diện hệ thống phối hợp đa tác tử (Multi-Agent System) chuẩn Antigravity 2.0 từ Project AURORA, thiết lập quy trình kiểm soát chất lượng khép kín với các cơ chế cưỡng chế bất biến:
  - **Subagent `@planner`** (`.agents/agents/planner/agent.md`): Sử dụng mô hình `gemini-3.8-flash`, trang bị 7 công cụ chuẩn bao gồm tra cứu trực tuyến (`search_web`, `read_url_content`) để cập nhật API năm 2026, thiết kế kế hoạch bám sát nguyên tắc Minimal Diffs, ghi kế hoạch vào `docs/plans/` và xử lý Revision Loop in-place.
  - **Subagent `@reviewer`** (`.agents/agents/reviewer/agent.md`): Sử dụng mô hình `claude-4.6-opus` (tự động Fallback sang `gemini-3.8-flash` khi chạm HTTP 429), trang bị 6 công cụ Read-Only & Online Grounding, áp dụng Severity Rubric 3 cấp độ (`[BLOCKER]`, `[MAJOR]`, `[MINOR]`), nắm giữ thẩm quyền Gatekeeper duy nhất cấp token `[PLAN_APPROVED]`.
  - **Subagent `@qa`** (`.agents/agents/qa/agent.md`): Sử dụng mô hình `claude-4.6-opus` (Fallback `gemini-3.8-flash`), hoạt động ở chế độ On-Demand (chỉ kích hoạt khi người dùng gõ `@qa`), thẩm định 4 giai đoạn độc lập: Plan Compliance, Deep Bug Hunting, Actionable Improvements và xuất báo cáo `[QA_PASSED]` / `[QA_FAILED]`.
  - **Quy tắc điều phối `05-plan-review.md`**: Ban hành quy tắc Plan-Review-Revise Loop với 3 cơ chế cưỡng chế cốt lõi:
    1. _Strict Code Freeze_: Cấm chạm source code trước khi có thẻ `[PLAN_APPROVED]`.
    2. _Zero-Self-Execution_: Orchestrator cấm tự lập kế hoạch trên luồng chính, bắt buộc 100% ủy quyền cho `@planner`.
    3. _Uninterrupted Execution Chain_: Chuỗi task ➔ planner ➔ reviewer chạy tự động liên tục, cấm ngắt quãng hỏi người dùng trước khi có thẻ phê duyệt.
    4. _Pre-Flight Gate_: Kiểm tra bắt buộc 3 cổng (Plan Persistence, Reviewer Dispatch, Approval Token) trước khi xin phép mở khóa code.
  - **Thư mục lưu trữ `docs/plans/`**: Khởi tạo cấu trúc lưu vết kế hoạch thực thi dài hạn.
  - **Tài liệu hóa**: Cập nhật `00-core.md`, `02-quality.md`, và bổ sung Section 7 vào `docs/architecture.md`.
- **Files Modified & Added**:
  - [NEW] [`.agents/agents/planner/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/planner/agent.md)
  - [NEW] [`.agents/agents/reviewer/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/reviewer/agent.md)
  - [NEW] [`.agents/agents/qa/agent.md`](file:///c:/Users/wyemh/vikini/.agents/agents/qa/agent.md)
  - [NEW] [`.agents/rules/05-plan-review.md`](file:///c:/Users/wyemh/vikini/.agents/rules/05-plan-review.md)
  - [NEW] [`docs/plans/README.md`](file:///c:/Users/wyemh/vikini/docs/plans/README.md)
  - [NEW] [`docs/plans/2026-09-17-multi-agent-system-implementation-plan.md`](file:///c:/Users/wyemh/vikini/docs/plans/2026-09-17-multi-agent-system-implementation-plan.md)
  - [MODIFY] [`.agents/rules/00-core.md`](file:///c:/Users/wyemh/vikini/.agents/rules/00-core.md)
  - [MODIFY] [`.agents/rules/02-quality.md`](file:///c:/Users/wyemh/vikini/.agents/rules/02-quality.md)
  - [MODIFY] [`docs/architecture.md`](file:///c:/Users/wyemh/vikini/docs/architecture.md)

## 2026-09-16: Implement "Branch In New Chat" (Conversation Branching) Feature

- **Feature**: Added **Branch In New Chat** capability to Vikini, allowing users to fork any conversation from a specific message node into an independent new conversation session.
- **Architecture & Technical Highlights**:
  - **Hybrid Snapshot Fork Model**: Clones conversation history up to the target message node ($M_1 \dots M_k$) directly at the database level, preserving AES encrypted content without plaintext exposure in memory.
  - **Turn Isolation & AI Context Retention**: Only the branched turn (user prompt + assistant answer) is displayed on the user's interface, keeping the view clean. All older prior messages are tagged with `isContextOnly: true` and fed seamlessly to the LLM backend, preserving 100% conversational intelligence and prefix KV cache reuse.
  - **Contextual Branch Title**: Auto-generates the branch conversation title from the branched user prompt for immediate topic recognition.
  - **Genealogy Tracking**: Added `parent_conversation_id` and `forked_from_message_id` columns with indexes on the `conversations` table.
  - **API Route**: Created `POST /api/conversations/[id]/branch` with RFC 4122 UUID validation, authentication checks, and cache invalidation.
  - **UI/UX**:
    - Added `GitFork` action button to `MessageActions.tsx` with loading state and bilingual tooltips.
    - Integrated with `ChatBubble.tsx` and `ChatApp.tsx`.
    - Implemented subtle **Origin Breadcrumb** at the top of branched conversations linking back to the parent conversation.
    - Added prior context notification badge indicating background context retained for AI.
  - **Bilingual**: Full English and Vietnamese translations added for action buttons, notifications, and breadcrumbs.
- **Files Modified & Added**:
  - [`20260916_add_conversation_branching.sql`](file:///c:/Users/wyemh/vikini/supabase/migrations/20260916_add_conversation_branching.sql): Added migration script for branching columns and index.
  - [`database-schema.md`](file:///c:/Users/wyemh/vikini/docs/database-schema.md): Updated ERD and Section 2.3 `conversations` documentation.
  - [`conversations.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.ts): Added `branchConversation` domain logic and updated `Conversation` types & mappers.
  - [`conversations.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/conversations.test.ts): Added unit tests for branching mappers.
  - [`branch/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/conversations/[id]/branch/route.ts): Created branching API handler.
  - [`branch/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/conversations/[id]/branch/route.test.ts): Added integration tests for branch API.
  - [`validators.ts`](file:///c:/Users/wyemh/vikini/src/app/api/conversations/validators.ts): Added `branchConversationSchema`.
  - [`MessageActions.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/MessageActions.tsx): Added branch button and loading state.
  - [`MessageActions.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/MessageActions.test.tsx): Added unit tests for branch button.
  - [`ChatBubble.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx): Forwarded `onBranch` and `isBranching` props and updated React.memo comparison.
  - [`ChatApp.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatApp.tsx): Added `handleBranchMessage`, origin breadcrumb, and navigation.
  - [`useConversation.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/hooks/useConversation.ts): Added `parentConversationId` and `forkedFromMessageId` to `FrontendConversation`.
  - [`vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts): Added bilingual translation keys.

## 2026-09-16: Switch DeepSeek V4.1 Flash Provider to Relace on OpenRouter

- **Improvement**: Switched DeepSeek V4.1 Flash (`deepseek/deepseek-v4.1-flash`) OpenRouter priority provider from Fireworks to **Relace** (`provider: { order: ["Relace"], allow_fallbacks: true }`).
- **Key Metrics with Relace**:
  - **Lower Cost**: Input reduced to $0.15/M (down from $0.22/M), Output reduced to $0.60/M (down from $0.66/M).
  - **Faster Latency**: TTFT reduced to 1.43s (down from 1.87s).
  - **Higher Availability**: 99.50% uptime with verified badge on OpenRouter.
- **Files Modified**:
  - [`deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts): Updated `order: ["Relace"]`.
  - [`modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts): Updated provider comment.
  - [`deepseek-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.test.ts): Updated unit test expectations to verify Relace routing.
  - [`models.md`](file:///c:/Users/wyemh/vikini/docs/models.md): Updated specifications table and benchmark details.

## 2026-09-10: Integrate DeepSeek V4.1 Flash via OpenRouter (Fireworks AI)

- **Feature**: Added **DeepSeek V4.1 Flash** (`deepseek/deepseek-v4.1-flash`) to the Vikini model registry with OpenRouter integration, prioritized on Fireworks AI infrastructure.
- **Key Capabilities**:
  - **Causal Encoder-Decoder (CED) MoE Architecture**: 552B total parameters with asymmetric activation (8B prefill, 16B decode) achieving ~70 tps throughput and 1.87s latency.
  - **Ultra-deep Context Window**: 1,048,576 tokens (1M tokens), on par with Gemini 3 Flash.
  - **Full Unconstrained Output Token Limit**: `384,000` completion tokens (no artificial cap), enabling end-to-end full codebase and long-form report generation.
  - **Multimodal Vision**: Enables native image understanding (`image_url` data URLs) for DeepSeek models in Vikini chat and file attachment pipelines.
  - **Thinking Mode**: Integrated OpenRouter reasoning parameter (`include_reasoning: true`, `reasoning.effort`) with real-time `<think>` tag streaming and `<ThinkingBlock>` UI render.
  - **Provider Routing**: Configured OpenRouter provider order `["Fireworks"]` with automatic fallbacks for maximum throughput and 96.8% cache discount ($0.007/M cached tokens).
- **Files Modified**:
  - [`constants.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/constants.ts): Added `MODEL_IDS.DEEPSEEK_V41_FLASH`.
  - [`modelRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/modelRegistry.ts): Registered model metadata, 1M context, 384k output tokens, `isDeepSeekV41FlashModel` helper, and aliases.
  - [`useThinkingLevel.ts`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/hooks/useThinkingLevel.ts): Enabled Thinking Level selector for DeepSeek V4.1 Flash.
  - [`chatStreamCore.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/chatStreamCore.ts): Dispatched to OpenRouter client and `createDeepSeekStream`.
  - [`deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts): Added Fireworks provider routing and full 384k token budget calculation.
  - [`vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts): Added bilingual model descriptions highlighting CED 1M context, multimodal, superior efficiency, and lowest cost.
  - [`models.md`](file:///c:/Users/wyemh/vikini/docs/models.md): Documented full technical specifications and comparison matrix.
  - [`005_add_deepseek_v4_1_flash.sql`](file:///c:/Users/wyemh/vikini/database-migrations/005_add_deepseek_v4_1_flash.sql): Added database migration script for rank configurations.
  - [`deepseek-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.test.ts): Added unit test verifying Fireworks routing, 384k tokens, thinking config, and multimodal image handling.

## 2026-09-05: Fix DeepSeek V4 Pro Reasoning Token Cutoff & Empty Response Fallback

- **Bug**: DeepSeek V4 Pro in Project chats occasionally output only the Thinking Process (`<think>...</think>`) and stopped abruptly without emitting any response content, leaving a blank message with action buttons.
- **Root Cause**:
  - `deepseek-stream.ts` hardcoded `max_tokens: 8192`. In reasoning models, thinking tokens count directly against the total output token limit.
  - In Project chats with extensive context (RAG chunks + GEM persona instructions + conversation history) and High Thinking Level, DeepSeek generated ~8,192 tokens of reasoning.
  - The stream was cut off by OpenRouter with `finish_reason: "length"` before any `content` tokens were emitted.
  - The backend closed the stream silently and the UI rendered an empty message.
- **Fix**:
  - In [`deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts):
    - Raised output token ceiling to `16,384` for thinking mode via `effectiveMaxTokens`.
    - Configured OpenRouter `reasoning: { effort: reasoningEffort }`.
    - Calibrated `thinkMaxPrefix` to prevent runaway deliberation loops on heavy project prompts.
    - Added backend fallback: if a stream finishes with zero answer content outside `<think>`, append a clear explanatory message outside the thinking block.
  - In [`ChatBubble.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatBubble.tsx):
    - Added UI fallback when a stored or finished message has `thought` but empty `displayContent`, rendering `t("thinkingNoResponseContent")`.
  - Added bilingual keys `thinkingNoResponseContent` to [`vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) and [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts).
  - Added unit test suite [`deepseek-stream.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.test.ts) covering token budgets, thinking blocks, and token limit / empty content fallbacks.

## 2026-09-05: Chat Core UX/UI Augmentation (Craft-Grade Polish & Modular Decomposition)

- **Architecture & Modularity**:
  - Decomposed monolithic `ChatBubble.tsx` (582 lines) into a focused shell controller (303 lines, pre-prettier 218 lines), strictly below the 400-line modularity threshold.
  - Extracted [`BubbleAvatar.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/BubbleAvatar.tsx) (73 lines) managing user and model avatars with animated halo pulse for AI loading states.
  - Extracted [`BubbleMarkdown.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/BubbleMarkdown.tsx) (187 lines) isolating the complete ReactMarkdown parsing and sanitization pipeline.
- **Design Tokens & Theme Harmony**:
  - Replaced 100% of dead Tailwind v4 classes across chat core (`border-token`, `bg-surface-elevated`, `bg-surface-muted`, `text-primary`, `text-secondary`, `bg-control`, `bg-surface/95`) with standardized Vikini tokens (`bg-(--surface-elevated)`, `border-(--border)`, `text-(--text-primary)`, `text-(--text-secondary)`, `bg-(--control-bg)`).
  - Ensured WCAG 2.2 contrast compliance across all 15 themes (Focus, Glassmorphism, RA2).
- **Typography & Accessibility**:
  - Eliminated all sub-12px text sizes (`text-[8px]`, `text-[9px]`, `text-[10px]`) in favor of standardized `text-xs font-semibold`.
  - Added visible focus rings (`focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none`) and active press feedback (`active:scale-[0.92]` or `0.95`) on all interactive buttons.
  - Added ARIA state attributes: `aria-expanded` on `ThinkingBlock`, `aria-pressed` on TTS speak button, and explicit `type="button"`.
- **Emil Kowalski Micro-Interactions**:
  - Upgraded [`SmartCode.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/SmartCode.tsx) to developer-grade: removed fake Mac window dots, added monospace language header, morphing copy check button, and gradient fade mask (`bg-gradient-to-t`) for code blocks over 20 lines with expand/collapse control.
  - Upgraded [`MessageActions.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/MessageActions.tsx) into a floating glass dock (`backdrop-blur-md bg-(--surface-elevated)/80 border border-(--border) rounded-full px-2.5 py-1`) with $\ge 28\text{px}$ tap targets.
  - Refactored [`BubbleHelpers.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/BubbleHelpers.tsx): made `TypingCursor` anti-orphan (`inline-block whitespace-nowrap align-middle`) and `ThinkingBlock` smooth spring accordion.
  - Upgraded [`InputForm.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/InputForm.tsx): replaced custom SVGs with `SendHorizontal` and `Square` from Lucide React, implemented smart Send/Stop button state machine, added desktop keyboard shortcut hints (`↵ Send`, `Shift+↵ New line`), and removed prop-drilling `t` to directly consume `useLanguage()`.
  - Polished [`ChatControls.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/ChatControls.tsx): integrated Radix `Popover` for the agent selector and tokenized `bg-(--surface)/95`.
- **Testing**:
  - Added 6 co-located test suites in `src/app/features/chat/components/` with 64 tests covering all components: `SmartCode.test.tsx`, `BubbleHelpers.test.tsx`, `MessageActions.test.tsx`, `BubbleAvatar.test.tsx`, `ChatBubble.test.tsx`, and `InputForm.test.tsx`.

- **Bug**: Selecting an icon (e.g., Lucide icon like "Lightbulb") for a GEM caused the raw string `"Lightbulb"` to render as plain text in the GEM list right beside the GEM name (`"Lightbulb  Smug Verre"`), in the preview box, quick switcher, and admin view. In the editor, a read-only input showed `"Lightbulb"` as text, and creating a new GEM incorrectly displayed the title "Edit Gem".
- **Root Cause**: `{gem.icon}` was rendered directly as raw text in JSX without resolving Lucide icon component names vs emojis. The editor lacked an interactive preview trigger and miscomputed new vs edit titles.
- **Fix**:
  - Created [`DynamicIcon.tsx`](file:///c:/Users/wyemh/vikini/src/components/ui/DynamicIcon.tsx) to resolve Lucide icons (case-insensitive) and unicode emojis with customizable fallbacks.
  - Upgraded [`IconPicker.tsx`](file:///c:/Users/wyemh/vikini/src/components/ui/IconPicker.tsx) with interactive icon/emoji trigger preview, active state highlight, clear button, and emoji grid.
  - Updated [`GemEditor.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/gems/components/GemEditor.tsx) to fix creation title (`!gem?.id`) and integrate upgraded `IconPicker`.
  - Updated [`GemList.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/gems/components/GemList.tsx), [`GemPreview.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/gems/components/GemPreview.tsx), [`GemQuickSwitch.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/gems/components/GemQuickSwitch.tsx), [`PersonaList.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/personas/components/PersonaList.tsx), [`PersonaPreview.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/personas/components/PersonaPreview.tsx), [`PersonaQuickSwitch.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/personas/components/PersonaQuickSwitch.tsx), [`GemsManager.tsx`](file:///c:/Users/wyemh/vikini/src/app/admin/components/GemsManager.tsx), and [`PersonasManager.tsx`](file:///c:/Users/wyemh/vikini/src/app/admin/components/PersonasManager.tsx) to use `DynamicIcon`.
  - Added unit test suite in [`DynamicIcon.test.tsx`](file:///c:/Users/wyemh/vikini/src/components/ui/DynamicIcon.test.tsx).

## 2026-08-28: Fix "Invalid color format" on Project Creation

- **Bug**: Creating a new project always failed with "color: Invalid color format" validation error.
- **Root Cause**: `CreateProjectModal.tsx` used CSS variables (`var(--color-indigo-500)`) for colors, but API validates hex format (`#xxxxxx`).
- **Fix**: Replaced CSS variable colors with hex values in `COLORS` array and default state in [`CreateProjectModal.tsx`](file:///c:/Users/wyemh/vikini/src/components/features/projects/CreateProjectModal.tsx).

## 2026-08-28: Switch DeepSeek V4 Pro Provider from Baidu to StreamLake

- **Change**: OpenRouter provider routing for DeepSeek V4 Pro switched from `Baidu` (Qianfan) to `StreamLake`.
- **Reason**: StreamLake offers 56% discount on input pricing (\$0.5795 vs \$1.32/M), lowest cache read cost (\$0.01932/M), and competitive latency (3.43s P50, 47 tps).
- **File**: [`deepseek-stream.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/streaming/deepseek-stream.ts) — removed `quantizations: ["fp8"]` constraint, changed `order: ["Baidu"]` → `order: ["StreamLake"]`.

---

## 2026-08-25: Frontend Audit — Production Readiness Fixes

### Based on [Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist) audit

#### Error Handling (App Router Conventions)

- Created `src/app/not-found.tsx` — Custom 404 page with bilingual support
- Created `src/app/error.tsx` — Client error boundary with retry/reload
- Created `src/app/global-error.tsx` — Last-resort root layout error boundary
- Created `src/app/_components/go-back-button.tsx` — Client component for router.back()
- Added translation keys: notFoundTitle, notFoundDescription, goHome, goBack, serverErrorTitle, serverErrorDescription

#### Image Optimization

- Added `formats: ['image/avif', 'image/webp']` to next.config.ts images config

#### CSS & Config Cleanup

- Migrated `tailwind.config.ts` (v3 style) → CSS `@theme` blocks in base.css (Tailwind v4)
- Deleted `tailwind.config.ts` (no longer needed with Tailwind v4 CSS-first architecture)
- Removed redundant `autoprefixer` from postcss.config.mjs (built into Tailwind v4)
- Cleaned CSP headers: removed unused fonts.googleapis.com and fonts.gstatic.com whitelists

#### Accessibility

- Added `aria-busy` attribute to streaming message container in ChatBubble.tsx
- Added `role="status"` with `aria-label` to TypingDots for screen reader announcements

#### Tooling

- Installed and configured `@next/bundle-analyzer` with `npm run analyze` script
- Installed `@playwright/test`, created `playwright.config.ts` and sample smoke tests
- Added scripts: `test:e2e`, `test:e2e:ui`, `analyze`
- Excluded `tests/e2e/` from Vitest runner to prevent test framework conflicts

### Files Changed

- `src/app/not-found.tsx` [NEW]
- `src/app/error.tsx` [NEW]
- `src/app/global-error.tsx` [NEW]
- `src/app/_components/go-back-button.tsx` [NEW]
- `playwright.config.ts` [NEW]
- `tests/e2e/smoke.test.ts` [NEW]
- `next.config.ts` [MODIFIED]
- `postcss.config.mjs` [MODIFIED]
- `vitest.config.ts` [MODIFIED]
- `package.json` [MODIFIED]
- `src/app/styles/themes/_shared/base.css` [MODIFIED]
- `src/app/features/chat/components/ChatBubble.tsx` [MODIFIED]
- `src/lib/utils/translations/en.ts` [MODIFIED]
- `src/lib/utils/translations/vi.ts` [MODIFIED]
- `tailwind.config.ts` [DELETED]

---

## 2026-08-13: UI — Chat message typography improvement

### Changes

- Increased chat bubble wrapper font-size from `text-sm` (14px) → `text-base` (16px) for better readability
- Increased AI markdown body font-size from `15px` → `16px` (text-base)
- Increased paragraph and list spacing from `mb-4` (16px) → `mb-5` (20px)
- Aligned typography closer to ChatGPT's sizing for comfortable reading

### Files Changed

- `app/features/chat/components/ChatBubble.tsx` — Wrapper font-size, paragraph/list spacing
- `app/styles/themes/_shared/utilities.css` — `.chat-markdown` font-size and paragraph spacing fallback

---

## 2026-08-12: Fix — Messages sent to wrong conversation after switching chats

### Bug Fix (Critical)

- **Race condition in `useUrlSync.ts`** — `selectedConversationId` in the URL→State `useEffect` dependency array caused a feedback loop: programmatic state changes triggered the effect, which read stale `searchParams` (async `router.push`) and reverted state to the old conversation. Fix: use `useRef` to read current state inside the effect without re-triggering it.

### Files Changed

- `app/features/chat/components/hooks/useUrlSync.ts` — Removed `selectedConversationId` from deps, added `selectedIdRef` for comparison

---

## 2026-08-12: Architecture — Normalize userId to Email (Identity Crisis Fix)

### Architecture (Critical)

- **Identity normalization** — Unified `userId` across the entire codebase to always be `email` (lowercased). Previously, `userId` could be Google `providerAccountId` (numeric string), email, or NextAuth `user.id` depending on the code path, creating fragmented identity for ownership, quota, rate limiting, and audit.
- **Auth flow** — `signIn` callback now creates profiles with `id = email`. JWT `token.userId` stores email. `session.user.id` = email.
- **Database migration** — `022_normalize_userid_to_email.sql` migrates `profiles.id` from providerAccountId to email, fixes `gems.user_id`/`gem_versions.created_by` for admin-created records, and updates `admin_audit_logs`.
- **Admin routes** — All admin audit logs and DB writes now use email consistently.
- **Simplified lookups** — `getUserProfile()` no longer needs double-lookup (by ID then by email). Single query by email.
- **New helper** — `getUserId()` in `lib/features/auth/getUserId.ts` provides canonical userId extraction.

### Files Changed

- `lib/features/auth/auth.ts` — Profile creation uses email, JWT stores email
- `lib/features/auth/authRevocation.ts` — `refreshTokenFromDB` returns email
- `lib/features/auth/getUserId.ts` — [NEW] Canonical userId helper
- `lib/core/limits.ts` — Simplified `getUserProfile()` to single email query
- `app/api/chat-stream/route.ts` — Removed mixed email/id fallback
- `app/api/batch-gen-quota/route.ts` — Uses email consistently
- `app/api/user/allowed-models/route.ts` — Uses email instead of session.user.id
- `app/api/admin/gems/route.ts` — Uses email for user_id, created_by, audit
- `app/api/admin/personas/route.ts` — Uses email for audit log
- `app/api/admin/users/route.ts` — Uses email for adminId, updated `isValidUserId` to accept email
- `types/next-auth.d.ts` — Added `profileId` to JWT interface (legacy reference)
- `database-migrations/022_normalize_userid_to_email.sql` — [NEW] DB migration

### ⚠️ Action Required

Run `database-migrations/022_normalize_userid_to_email.sql` on Supabase before deploying.

---

## 2026-08-12: Security — JWT Authorization Revocation Fix

### Security (Critical)

- **Authorization revocation** — Fixed vulnerability where rank/block changes had no effect on active JWT sessions (30-day `maxAge`). Admin could downgrade or block a user, but their existing JWT continued to grant full access.
- **Redis version check** — JWT callback now checks a Redis `auth:version:{userId}` stamp on every request (O(1), ~1ms). Only queries DB when rank actually changed.
- **Time-based fallback** — When Redis is unavailable, falls back to 2-minute interval DB refresh to ensure revocation still works.
- **Blocked user redirect** — Blocked users are immediately signed out and redirected to `/auth/error?error=blocked` with localized messaging (VI/EN).

### Files Changed

- `lib/features/auth/auth.ts` — JWT callback enhanced with version check + fallback
- `lib/features/auth/authRevocation.ts` — [NEW] Redis version management
- `app/api/admin/users/route.ts` — Calls `bumpAuthVersion()` after rank/block update
- `app/auth/error/page.tsx` — Added blocked-specific UI with lock icon
- `app/features/chat/components/ChatApp.tsx` — Client-side blocked detection + signOut redirect
- `types/next-auth.d.ts` — Added `rankVersion`, `rankRefreshedAt`, `blocked` to JWT type

---

## 2026-08-11: DeepSeek V4 Pro — Provider Migration to OpenRouter/Baidu Qianfan

### Infrastructure

- **Provider switch** — Migrated DeepSeek V4 Pro from Direct API (`api.deepseek.com`) to OpenRouter with Baidu Qianfan provider and FP8 quantization. ~75% cost reduction ($0.4225/$0.845 per 1M tokens vs $1.69/$3.38).
- **Model ID change** — `deepseek-v4-pro` → `deepseek/deepseek-v4-pro`. Backward-compat alias added for existing conversations.
- **Context window upgrade** — 128K → 1M tokens (OpenRouter supports full DeepSeek V4 Pro context).
- **Thinking mode preserved** — V4 Pro still uses `createDeepSeekStream()` for `reasoning_content` parsing via OpenRouter proxy.
- **V4 Flash unchanged** — Remains on Direct API with `DEEPSEEK_API_KEY`.

---

## 2026-07-15: Image Studio — Audit Fixes

### Type Safety (Critical)

- **Style union sync** — Aligned `ImageGenOptions.style` type with actual 18 styles from `stylePrompts.ts`. Removed orphaned values (`digital_art`, `sketch`, `cartoon`) that had no matching implementation.
- **Stale callback fix** — Added missing `onSuccess` to `useImageGenController.handleImageGen` dependency array.

### Error Handling (Warning)

- **Delete/Favorite toast feedback** — Added `toast.error()` to `handleDeleteConfirm` and `handleToggleFavorite` catch blocks in `ImageGenStudio.tsx`.
- **SettingsModal toast migration** — Replaced custom feedback state with standard `toast()` system, removed unused `CheckCircle`/`AlertCircle` imports.
- **Enhancer failure transparency** — API route now returns `enhancerFailed: true` when prompt enhancement fails silently, enabling future client-side notification.

### UX Improvements

- **Lightbox download fix** — Replaced direct `<a>.click()` download (fails with CORS signed URLs) with blob-based download matching Canvas pattern.
- **Template style alignment** — Set correct style IDs for `watercolor`, `oil-painting`, `pastel` templates (were `"none"`), enabling both system instruction AND prompt-based style guidance.
- **OpenAI model selection** — `OpenAIImageProvider` now respects `options.model` instead of hardcoding `gpt-image-2`.
- **Aspect ratio coverage** — Expanded `getAspectClass()` in Canvas to cover all 14 supported ratios (was only 5).

### SEO

- **Images page metadata** — Added `layout.tsx` with title/description metadata for the `/images` route.

---

## 2026-07-04: Design Redesign — Premium Polish Pass

### Typography

- **Font swap: Inter → Geist** — Replaced Inter (most common AI font) with Geist (sans + mono) via `next/font` for optimal loading. Updated `base.css`, `tailwind.config.ts`, and `layout.tsx`.
- **Headline tracking** — Tighter `-0.03em` letter-spacing on DashboardView greetings, `-0.02em` on chat-markdown headings.
- **Text-wrap: balance** — Applied to all headings to prevent orphaned words.
- **Tabular figures** — Added `font-variant-numeric: tabular-nums` to TokenBadge number displays.

### Color & Surfaces

- **Fixed pure #000000** — `--surface-dark-strong` changed from `#000000` to `#050505` (tinted near-black).
- **Theme-aware shimmer** — `shimmer.css` hardcoded colors (`#2a2a2a`) replaced with CSS variables (`var(--surface-muted)`).
- **Smooth scrolling** — Added `scroll-behavior: smooth` to html/body.

### Interactivity

- **Pressed feedback** — Added `active:scale-[0.97]` to SidebarButton, `active:scale-[0.95]` to DashboardView suggestion chips.
- **New utility classes** — `.press-scale`, `.hover-lift`, `.tabular-nums`, `.shadow-tinted` in `utilities.css`.

### Loading States

- **Branded skeleton** — Replaced generic "Loading..." text with V-logo pulse skeleton matching app layout shape.

### Login Page

- **Warm Noir redesign** — Replaced rainbow flowing gradient (indigo→gold→red→rose→amber→blue) with single amber/gold radial glow. V logo now uses gold→champagne gradient. Luxury editorial feel.

---

## 2026-07-03: Deep Research — Silent Hang Auto-Recovery + UX Fix

### Bug Fixes

- **Misleading progress card during initialization** — `getResearchInteraction` fallback was setting `currentStep = "analyzing"` when the Gemini agent hadn't started yet (only `user_input` echo step). This falsely showed "Searching the web ✓" (green check) when nothing had happened. Now `currentStep` stays `undefined` so all steps show as "pending" (gray).
- **Added initialization indicator** — `ResearchProgressCard` now shows a spinning "Initializing agent..." label when `currentStep` is undefined, giving clear feedback that the system is waiting for the Gemini agent to start.
- **Stale hang auto-recovery (improved)** — SSE stream route monitors for the known Gemini "silent hang" where the agent stays at `in_progress` with only `user_input` steps. Threshold reduced from 3 minutes → **90 seconds** for faster recovery. Max retries increased from 2 → **3**. Retry SSE events now include attempt count and expected wait time.
- **Enabled `thinking_summaries: "auto"`** — Added to `agent_config` in `createResearchInteraction`. Per Google docs, this makes the agent more reliably emit `thought` steps during polling, reducing the silent hang pattern.
- **Regression: `|| "analyzing"` fallback in ChatApp.tsx** — Despite the backend correctly sending `currentStep: undefined` during agent initialization, `ChatApp.tsx` overrode it with `currentStep={currentTask.currentStep || "analyzing"}`. This masked the "Initializing agent..." indicator and immediately showed "Analyzing results" as active. Removed the fallback for both `planning` and `executing` phases.
- **Duplicate SSE streams after approve** — Planning SSE stream didn't close when task reached `ready_to_execute`, causing 2 parallel streams during execution. Both triggered stale detection independently, exhausting retries 2x faster → premature failure. Fixed by adding `ready_to_execute` to the terminal status check. Also fixed client localStorage cleanup to not wipe active task on plan-ready.
- **Prompt lost on failure/cancellation** — When Deep Research failed (API error, stale hang) or was cancelled, `finalizeResearch` was never called. The user's prompt disappeared completely from chat history. Now `finalizeResearch(task, errorMsg, isFailed=true)` is called in all failure paths: `checkResearchStatus` failure, `cancelResearchTask`, and SSE stale detection give-up. Creates conversation + saves user prompt + saves error/cancel message. Skips KB indexing for failed tasks.
- **Dead UI gaps between research phases** — 1-2 second blank periods between clicking Send → Planning card appearing, and clicking Start Research → Executing card appearing. Added `pendingQuery` (optimistic query) and `isApproving` states. The UI now renders an instant placeholder card immediately on submit and transitions optimistically to the executing view on approve click, eliminating perceived latency.

### i18n

- Added `deepResearchInitializing` translation key (EN: "Initializing agent...", VI: "Đang khởi tạo agent...")
- Added `deepResearchExecutionInit` translation key (EN: "Starting research agent... this may take 1–2 minutes", VI: "Đang khởi động agent nghiên cứu... có thể mất 1–2 phút")

---

## 2026-07-03: Deep Research — DB Fix + UI/Backend Desync Resolution

### Critical Fixes

- **Missing `increment_daily_research_count` RPC** — The DB migration that created `daily_research_counts` table never included the corresponding PostgreSQL function. Applied migration to Supabase production. Without this, the fallback upsert always reset `count: 1` instead of incrementing, making rate limits completely ineffective.
- **Rate limit counter bypass** — Fixed fallback upsert in `limits.ts` (`incrementResearchCount` + `tryClaimResearchSlot`) to read current count and increment instead of resetting to 1.

### Bug Fixes

- **SSE stream killed by Vercel** — Added `maxDuration = 800` to stream route (Vercel Pro limit). Previously missing, causing Vercel to kill the function at default timeout while the client's EventSource silently auto-reconnected.
- **Server unaware of client disconnect** — Added `req.signal` abort listener in SSE stream route so the server stops polling when the client disconnects (closes tab, navigates away).
- **`cancel()` not stopping poll loop** — Fixed ReadableStream `cancel()` callback to set `running = false`, ensuring the poll loop exits when the stream is cancelled.
- **EventSource error event collision** — Renamed server SSE error event from `error` to `stream_error` to avoid collision with native EventSource connection errors. Previously, both custom server errors and connection drops triggered the same handler, causing unpredictable cleanup.
- **SSE infinite silent reconnection** — Added reconnect counter (max 3 retries) and 30s CONNECTING-state timeout guard. Previously, EventSource could silently reconnect indefinitely when the server kept dying, leaving the UI "stuck" with loading indicators.
- **Thinking panel skeleton on failed tasks** — `isCompleted` prop now also checks `failed` status, stopping the skeleton loader animation when a task fails (not just completes).

---

## 2026-07-03: Deep Research — Comprehensive Audit Fixes

### Breaking Changes

- **Removed Agent `deep-research-fast-04-2026`** — This agent ID was never documented in Google's official API. Only `deep-research-preview-04-2026` (Deep) and `deep-research-max-preview-04-2026` (Max) remain in `VALID_AGENTS`.

### Architecture

- **SSE Streaming Migration** — Added new SSE endpoint `GET /api/deep-research/[taskId]/stream` that polls Gemini server-side (2–5s) and forwards events to the client in real-time. The `useDeepResearchMode` hook now uses EventSource as primary update mechanism, with polling as automatic fallback for page reload resume or SSE failure. Reduces network overhead and provides near-instant UI updates.

### Bug Fixes

- **`onStop` Not Cancelling Server-Side** — Fixed critical bug where "Stop Research" button called `dismissTask()` (client-only cleanup) instead of `cancelResearch()`. Tasks now properly cancel on the server via `DELETE /api/deep-research/[taskId]`.
- **`window.prompt()` Replaced** — Replaced native `window.prompt()` with a custom `EditPlanModal` component using Framer Motion animations, textarea input, and bilingual i18n text.
- **Skeleton Loader Always Visible** — `ResearchThinkingPanel` now accepts `isCompleted` prop and hides the skeleton animation when the research task is complete.

### Features

- **Functional Report Panel Buttons** — Replaced 3 dummy buttons with working implementations:
  - **Contents**: ToC dropdown that parses markdown headings (h1–h3) and smooth-scrolls to them
  - **Share & Export**: Menu with Export Markdown (file download), Export PDF (print), and Copy to Clipboard
  - **Create Conversation**: Navigates to the conversation created by `finalizeResearch()`
- **Research Agent Selector in ChatControls** — Added compact badge + popover to switch between Deep and Max research modes directly from the chat controls bar.

### i18n Fixes

- Fixed 5 hardcoded text strings across `ResearchPlanCard`, `ResearchReportPanel`, and `ResearchThinkingPanel`.
- Added 10 new translation keys for both Vietnamese and English.
- Removed obsolete `deepResearchAgentFast` / `deepResearchAgentFastDesc` translation keys.

---

## 2026-07-01: Deep Research — Fix UI Not Rendering from Landing Page

### Bug Fixes

- **showLanding Blocking Research UI** — Fixed critical bug where starting Deep Research from the Landing page caused the frontend to stay on the "Good Morning" DashboardView while the backend polled successfully. Root cause: `showLanding` remained `true` because there was no selected conversation or messages, and the Research UI cards were only rendered in the `!showLanding` branch. Added `!hasActiveResearch` guard to `showLanding` so the Landing page is suppressed when a research task is active.
- **Edit Plan Button No-op** — Fixed bug where the "Edit Plan" button in the Research Plan card did nothing. Wired it up to a `window.prompt` to ask the user for feedback, which is then passed to the `approvePlan` backend API to seamlessly resume execution with modifications.
- **Deep Research UI Stuck at "Searching" during Planning** — Fixed bug where the progress card remained stuck at "Searching the web" forever during the `planning` phase. Removed the hardcoded `currentStep="searching"` state in `ChatApp.tsx` and replaced it with dynamic polling data `currentTask.currentStep || "analyzing"`.
- **Deep Research UI Frozen during Execution** — Fixed bug where the execution phase looked frozen at "Searching the web" and "Đang khởi tạo Agent" for 4+ minutes. Enhanced `genaiClient.ts` to catch unknown step types (like `tool_call`) to properly show `_Đang xử lý: [step_name]..._`. Improved fallback text to explicitly inform users that Deep Research can take 3-10 minutes, and changed the default fallback step to `"analyzing"` to prevent misleading web search spinners when the agent is initializing.
- **Deep Research UI Stuck at "Analyzing"** — Fixed bug where the research progress card remained stuck at "Analyzing results" indefinitely. Added step-deduction logic in `getResearchInteraction` to parse the latest step type (`google_search_call`, `thought`, `model_output`) and return `currentStep`, which is now assigned to the polling task state in `checkResearchStatus`.
- **AI Raw Text Plan Formatting** — Fixed bug where the Deep Research plan was displayed as a single massive paragraph with inline list markers like `(1) text (2) text`. Implemented `formatPlanText` utility in `ResearchPlanCard` to normalize inline text to proper markdown numbered lists (`\n1. `) and added `remarkGfm` support to `ReactMarkdown`, allowing the text to be correctly styled by the UI list styling rules.
- **Thinking Fallback Text** — Added fallback `thinkingText` in `genaiClient.ts` for when the Gemini agent is starting up and hasn't emitted any `thought` or `google_search_call` steps yet, preventing the Thinking Panel from appearing empty during the agent's initialization phase.

---

## 2026-06-28: Deep Research — Response Parsing & Error Feedback Fix

### Bug Fixes

- **API Response Parsing** — Fixed critical bug where `useDeepResearchMode` hook cast `res.json()` directly as `ResearchTask` instead of unwrapping the standardized `{ success, data: { task } }` envelope. This caused `task.id` to be `undefined`, triggering infinite `GET /api/deep-research/undefined` polling with 400 errors.
- **Poll Error Resilience** — Added consecutive error counter (max 5). Polling now stops and shows toast error after persistent failures instead of silently looping forever.
- **Error Feedback** — Added `toast.error()` for all Deep Research failure paths: poll timeout, poll persistent errors, research task failed status. Previously the UI would freeze with no feedback.
- **TaskId Guard** — Added validation in `pollTask()` to reject invalid/undefined task IDs immediately instead of making API calls.

### UI Flow Fix

- **Inverted Status Rendering** — Fixed critical UX bug where `planning` status showed `ResearchPlanCard` (with raw user query) and `ready_to_execute` showed `ResearchProgressCard`. Now correctly: `planning` → progress spinner ("Đang lên kế hoạch..."), `ready_to_execute` → plan card with AI-generated plan for review/approve, `executing` → progress card.
- **AI Plan Display** — Refactored `ResearchPlanCard` to accept `planText` (markdown string from Gemini) instead of hardcoded `ResearchPlan` object. Plan content is rendered via `ReactMarkdown`.
- **Phase-Aware Progress Header** — `ResearchProgressCard` now accepts `phase` prop to show "Đang lên kế hoạch..." during planning vs "Đang nghiên cứu..." during execution.

### New Feature

- **Thinking Panel (Deep Research)** — Implemented a real-time thinking UI similar to Gemini. Added `ResearchThinkingPanel` to show the AI's step-by-step reasoning and current websites being searched. The panel slides in from the right and auto-scrolls as new thoughts stream in.
- **Interactions API Extraction** — Modified `getResearchInteraction` in `genaiClient.ts` to parse the `steps` array returned by the Gemini Interactions API. Extracts `thought` steps for reasoning text and `google_search_call` steps for source websites.
- **Stop Research Button** — Added "Dừng nghiên cứu" / "Stop research" button to both `ResearchPlanCard` and `ResearchProgressCard`. Calls `dismissTask()` to stop polling, clear state, and clean up localStorage.

---

## 2026-06-26: Gemini Deep Research Integration

### New Feature: Deep Research Mode

- **SDK Upgrade** — Upgraded `@google/genai` to `v2.4.0` to support the Interactions API.
- **Backend & DB** — Created `research_tasks` and `daily_research_counts` tables via migration. Extended `rank_configs` to support `daily_research_limit` and `deep_research` feature flags.
- **Service Layer** — Implemented `researchService.server.ts` to manage async interaction states, polling, and integration with conversations and projects knowledge bases.
- **Admin Settings** — Added feature toggle UI and daily limit input in `RankConfigManager.tsx`.
- **Chat UI** — Added Deep Research toggle in `ChatControls.tsx` (only available for Gemini models). Created interactive UI cards: `ResearchPlanCard`, `ResearchProgressCard`, `ResearchReportCard`, and `ResearchReportPanel` to display the research lifecycle inside the chat stream.
- **Polling Hooks** — Built `useDeepResearchMode.ts` to handle the asynchronous polling of Deep Research task states.
- **Translations** — Added 28 bilingual UI keys to `vi.ts` and `en.ts`.

### Bug Fixes

- **Chat Input** — Fixed a bug where intercepting the Enter/Send button click for Deep Research dropped the text input because `text` parameter was passed as `undefined` but no fallback to `input` state was implemented.
- **Limit Checks** — Fixed `[ForbiddenError]` on backend by making `getUserProfile` robust enough to lookup users by either `id` (Google UUID) or `email`, as `userId` represents different formats across the system.

### Quality Audit Fixes (2026-06-27)

- **C1: incrementResearchCount** — Fixed critical bug where upsert reset count to 1 instead of incrementing (bypassed daily limits). Now uses RPC as primary mechanism.
- **C2: Quota ordering** — Moved `incrementResearchCount` to AFTER successful Gemini API call to prevent losing quota on API failures.
- **C3: VALID_AGENTS sync** — Added missing `deep-research-fast-04-2026` to API route validation.
- **C4: SQL injection** — Replaced `.or()` string interpolation in `getUserProfile` with two separate parameterized queries.
- **C5: Tests** — Created `researchService.server.test.ts` with 25 tests covering all exported functions.
- **M1: toast.error()** — Added user-facing error toasts in `useDeepResearchMode` hook for `startResearch` and `approvePlan` failures.
- **M3: Semantic CSS** — Replaced raw Tailwind colors (`emerald-400/500`, `amber-500`) with semantic tokens (`--accent`, `--warning`).
- **M4: Approve guard** — Restricted plan approval to only `ready_to_execute` status.
- **M5: Task persistence** — Added localStorage persistence for active research task ID to survive navigation.
- **M6: Accessibility** — Added Escape key handler and panel ref to `ResearchReportPanel`.
- **M7: Finalize safety** — Replaced fire-and-forget `.catch()` on `finalizeResearch` with proper `try/catch`.
- **L1-L12** — Centralized UUID_REGEX, extracted magic numbers, added encryption logging, locale-aware date formatting, better list keys, admin UI count fix, polling timeout (30min), SDK cast comment.

## 2026-06-26: Admin Personas Management

### New Feature: Pre-designed Personas (Admin)

- **DB Migration** — Added `is_premade` column to `personas` table + RLS policy for public read + index.
- **`/api/admin/personas`** — New admin API route with GET/POST/PUT/DELETE for premade personas. Audit logging enabled.
- **`PersonasManager.tsx`** — New admin UI component mirroring GemsManager pattern. Grid display with modal editor.
- **`AdminDashboard.tsx`** — Added "Personas" tab to admin navigation.
- **User-facing** — `getPersonasForUser()` now returns both user's own + premade personas. `PersonaList` split into "Premade Personas" (read-only) and "My Personas" sections.
- **Types** — Added `isPremade` to `Persona`, `PersonaForClient`, `PersonaForUI`, `PersonaRow`.
- **Translations** — 14 new EN/VI keys for admin personas management.

---

## 2026-06-25: Add Grok 4.3 and OpenRouter Reasoning Support

### New Feature: Grok 4.3 Support

- **`modelRegistry.ts`** — Added `x-ai/grok-4.3` to selectable models under the Grok tab. Added `isOpenRouterReasoningModel` helper.
- **`chatStreamCore.ts`** — Passed `thinkingLevel` to `createOpenAICompatibleStream` for handling Grok reasoning parameter.
- **`openai-stream.ts`** — Added dynamic injection of `<think>` tags into `reasoning_details` for previous assistant messages. Added streaming `reasoning_details` parsing from delta chunks into UI `<think>` tags for OpenRouter reasoning models.

### Bug Fix: OpenRouter Reasoning Stream Object Extraction

- **`openai-stream.ts`** — Fixed a bug where `delta.reasoning_details` (which can be an array of objects) was concatenated as a string, resulting in `[object Object]` rendering in the Thinking UI. Added robust recursive string extraction for array/object reasoning delta payloads.

## 2026-06-25: Personas — IconPicker Fix & Chat Badge

### Bug Fix: IconPicker

- **`PersonaEditor.tsx`** — Added `IconPicker` component (from `@/components/ui/IconPicker`) to the Icon field, matching GemEditor pattern.

### New: Persona Badge in Chat Header

- **`ChatControls.tsx`** — Added purple persona badge (icon + name) next to gem badge in chat controls bar.
- **`ChatApp.tsx`** — Integrated persona store callback (`patchConversationPersona`) for optimistic UI updates.
- **`useConversation.ts`** — Added `patchConversationPersona` and `persona` field to `FrontendConversation`.
- **`conversations.ts`** — All Supabase queries now join `personas(name,icon,color)` alongside gems. Added `persona` to `Conversation` interface and row mapper.

---

## 2026-06-25: Manage Personas Feature (ChatGPT Personality + Gemini Custom Instructions)

### New Feature: AI Persona Management

Adds a full CRUD system for creating and managing custom AI personas, combining ChatGPT's "Base Style & Tone" preset system with Gemini's free-form "Custom Instructions" into a unified interface.

### Database

- **`supabase/migrations/20260625_add_personas.sql`** — New `personas` table with RLS policies. Added `persona_id` FK to `conversations`.

### Backend (API + Logic)

- **`src/lib/features/personas/personas.ts`** — CRUD business logic: `getPersonasForUser`, `createPersona`, `updatePersona`, `deletePersona`, `getPersonaInstructionsForConversation`.
- **`src/lib/features/personas/prompt-builder.ts`** — `buildPersonaSystemPrompt()` compiles tone + emoji/headers prefs + user context + custom instructions into a system prompt.
- **`src/app/api/personas/route.ts`** — GET/POST/PATCH/DELETE API routes with Zod validation.
- **`src/app/api/conversations/route.ts`** — Added `personaId` support in PATCH handler.
- **`src/lib/features/chat/conversations.ts`** — Added `setConversationPersona()`.
- **`src/app/api/chat-stream/chatStreamCore.ts`** — Persona prompt injected before GEM prompt in system instructions.

### Frontend (UI)

- **`src/app/features/personas/`** — PersonaManager, PersonaEditor (with tone cards, characteristic toggles, textareas), PersonaList, PersonaPreview, PersonaModal.
- **`src/app/features/personas/stores/usePersonaStore.ts`** — Zustand store for persona modal state.
- **`src/app/features/sidebar/components/Sidebar.tsx`** — Added "Manage Personas" button below "Explore Gems".
- **`src/app/features/layout/components/MainLayout.tsx`** — Added PersonaModal.

### Translations

- **`en.ts` / `vi.ts`** — Added 28 translation keys for persona management UI.

### Types

- **`src/types/persona.ts`** — `Persona`, `PersonaTone` (8 tones: default, professional, friendly, candid, quirky, efficient, cynical, lawyer), `PersonaForClient`.

---

## 2026-06-22: Image Studio — UI Polish

- **`ControlPanel.tsx`** — Free/Guided converted from toggle to 2-tab row. Exclude, Quick Add, Prompt History buttons restyled with colored backgrounds, borders, and icons. Added actual pixel resolution display below resolution selector. Quick Add gets sparkle icon. All 3 menu buttons get hover tooltips.
- **`Canvas.tsx`** — Reuse and Edit buttons now show descriptive tooltips on hover.
- **`TagInput.tsx`** — Add Tag button restyled with emerald color and tag icon; hover tooltip explains purpose.
- **`en.ts` / `vi.ts`** — Added 10 translation keys for tooltips and labels.

---

## 2026-06-22: Image Studio — Priority Improvements Batch

### P0-4: Cleanup Legacy EditImageModal

- **[DELETED] `EditImageModal.tsx`** — 261 lines dead code removed.

### P1-5: Style Preview Thumbnails

- **`StyleSelector.tsx`** — Rewritten with real AI-generated preview images (18 styles). `/public/styles/`.

### P2-1: Interleaved Text+Image Output

- **`GeminiNativeImageProvider.ts`** — `responseModalities: ["TEXT", "IMAGE"]`. Parses text as `aiComment`.
- **`Canvas.tsx`** — Shows 💬 AI comment below image.

### P2-2: Time Estimate

- **`ImageGenStudio.tsx`** — Shows elapsed seconds during generation.

### P2-7: Prompt Autocomplete

- **[NEW] `api/prompt-suggest/route.ts`** — `gemini-3.1-flash-lite-preview`, 4 completions, rate limited.
- **`ControlPanel.tsx`** — Debounced dropdown, keyboard nav.

### Other

- Remove Cancel (QW-F), prompt limit 2000→10000, ESLint no-undef fix, Describe Image bugs, Suspense boundary.

---

## 2026-06-18: Feature — Image Studio Quick Wins (7 enhancements)

### QW1: Negative Prompt Field

- **`ControlPanel.tsx`** — Collapsible "🚫 Exclude" section below suggestion tags. Appends `\nDo NOT include: {text}` to prompt. Red dot indicator when active.

### QW2: Enhanced Prompt Transparency

- **`generate-image/route.ts`** — Saves `originalPrompt` and `enhancedPrompt` in message meta JSONB when enhancer is enabled.
- **`Canvas.tsx`** — "Magic" badge → i18n "Enhanced" badge with tooltip showing enhanced prompt on hover.

### QW3: Image Variations

- **`Canvas.tsx`** — New emerald "Variation" button on image card hover overlay.
- **`ImageGenStudio.tsx`** — `handleVariation()`: fetches image → base64 → sends with variation prompt + reference to Gemini.

### QW4: Favorites / Bookmarks

- **[NEW] `/api/messages/[id]/favorite/route.ts`** — PATCH endpoint toggles `is_favorite` in messages.meta JSONB. No DB migration.
- **`Canvas.tsx`** — Heart icon toggle on image overlay. Filled pink when favorited.

### QW5: Prompt History (localStorage, max 30)

- **`ImageGenStudio.tsx`** — Saves successful prompts to localStorage, deduplicates, max 30.
- **`ControlPanel.tsx`** — Collapsible "🕐 Recent Prompts" section with click-to-fill.

### QW6: Parallel Batch Generation

- **`ImageGenStudio.tsx`** — Sequential `for` loop → `Promise.allSettled()`. 2-4x faster for batch > 1.

### QW7: Text Rendering Tip

- **`ControlPanel.tsx`** — Auto-detects quoted text + Flash model → amber tip to switch to Pro.

### Translation Keys

- **`en.ts` / `vi.ts`** — 22 new bilingual keys.

### Verification

- `type-check` ✅ | `lint` ✅ | `tests` ✅ (34 files, 409 tests, 0 failures)

---

## 2026-06-18: Fix — EditImageModal `[object Object]` + Request Body Mismatch

- **Symptom**: Clicking "Apply Edit" showed `[object Object]` in error field and edit never executed.
- **Root causes**: (1) Request body sent `prompt` but API schema expected `editPrompt`; `model`/`aspectRatio` sent top-level but expected in `options` object → Zod validation always failed. (2) Error parsing used `String(data.error)` but `data.error` is `{ message, code }` object → `[object Object]`.
- **Fix**: Corrected request body field names to match Zod schema. Fixed error extraction to check for nested `.message` property.
- **Files**: `EditImageModal.tsx`

---

## 2026-06-18: Feature — Image Studio Upgrade (5 Criteria Audit)

### 1. Suggestion Tags (ControlPanel)

- **`ControlPanel.tsx`** — Added 12 suggestion tags organized by category (Style: 🎬🌅📷🌑, Color: 🌈🎨⬛💜, Composition: 🔍🏞️🦅✨). Click-to-append into prompt textarea. Uses pill-button pattern consistent with EditImageModal.

### 2. Dynamic Loading State (Canvas)

- **`Canvas.tsx`** — Skeleton placeholder now matches the selected aspect ratio (was always `aspect-square`). Loading text cycles through 5 creative messages every 2.5s with fade animation (`Đang pha màu...` → `Đang vẽ chi tiết...` → etc.).

### 3. Enhanced Prompt Quality (API Route)

- **`route.ts`** — Upgraded AI enhancement system prompt from generic "100 words" to professional prompt engineering template with specific quality keywords (8K, volumetric lighting, depth of field, rule of thirds). Limit raised to 150 words.

### 4. User-Friendly Error Handling (ImageGenStudio)

- **`ImageGenStudio.tsx`** — Added `classifyError()` function that maps raw API error strings to i18n-friendly messages + helpful retry suggestions. Error modal now shows 💡 suggestion tip (amber highlight) for safety, rate-limit, and content-policy errors.

### 5. Quick Download (Canvas)

- **`Canvas.tsx`** — Always-visible download button (bottom-right corner) on image cards, no hover required. Download logic replaced from direct link to proper `fetch` → `Blob` → `URL.createObjectURL` to handle CORS with signed URLs.

### Translation Keys

- **`en.ts` / `vi.ts`** — Added 25 new bilingual keys: 12 suggestion tags, 5 loading messages, 6 error messages + suggestions, 1 label.

### Verification

- `type-check` ✅ | `lint` ✅ | `tests` ✅ (34 files, 409 tests, 0 failures)

---

## 2026-06-17: Feature — Model Descriptions in Image Studio + DALL-E 3 → GPT Image 2

### Model Descriptions (Bilingual)

- **`ControlPanel.tsx`** — Model selector now shows bilingual descriptions under each model name
- **`en.ts` / `vi.ts`** — Added 4 new translation keys: `studioModelFlashDesc`, `studioModelProDesc`, `studioModelFluxDesc`, `studioModelGptImageDesc`

### DALL-E 3 → GPT Image 2 Migration

DALL-E 3 API was deprecated and removed by OpenAI on 12/05/2026. Migrated to `gpt-image-2`.

- **`OpenAIImageProvider.ts`** — Complete rewrite: model `dall-e-3` → `gpt-image-2`, handles `b64_json` response format, updated size mappings
- **`ControlPanel.tsx`** — Model value `dall-e-3` → `gpt-image-2`, label `DALL-E 3` → `GPT Image 2`
- **`ImageGenStudio.tsx`** — Updated BYOK validation checks from `dall-e` → `gpt-image`
- **`generate-image/route.ts`** — Updated routing conditions and fallback label
- **`ImageGenPreview.tsx`** — Added `gpt-image` display name, kept legacy `dall-e` for old messages

---

## 2026-06-17: Migration — Imagen 4 + Nano Banana Preview → GA Models

### URGENT: Nano Banana Preview → GA (deadline 25/06/2026)

- **`GeminiNativeImageProvider.ts`** — Default model `gemini-3.1-flash-image-preview` → `gemini-3.1-flash-image` (GA)
- **`ImageGenStudio.tsx`** — Default state updated to GA model ID
- **`ControlPanel.tsx`** — Model selector values: `-preview` → GA for both Flash and Pro
- **`EditImageModal.tsx`** — Edit model list updated to GA IDs, labels standardized
- **`edit-image/route.ts`** — API default model updated to GA
- **`modelRegistry.ts`** — `API_ALLOWED` updated, preview IDs added as backward-compat aliases
- **`chat-stream/utils.ts`** — Gemini 3 model identifiers updated

### Imagen 4 Dead Code Removal (deadline 17/08/2026)

- **[DELETED] `GeminiImageProvider.ts`** — Removed dead provider using deprecated `imagen-4.0-generate-001` (alpha `generateImages` API)
- **`ImageGenFactory.ts`** — Removed import, redirected legacy `"gemini"` provider → `GeminiNativeImageProvider`
- **`generate-image/route.ts`** — Cleaned up model labels (`"Imagen 4"` → `"Gemini Image Flash"`)

### Cleanup

- **`ControlPanel.tsx`** — Removed dead `!model.includes("imagen")` condition
- **`gallery/route.test.ts`** — Updated test fixtures from `imagen-4` → `gemini-3.1-flash-image`
- **Docs** — Updated `contracts.md`, `architecture.md`, `features.md`, `overview.md` with current model names

---

## 2026-06-14: Improvement — Harness Engineering Audit v2 Actions

### CI/CD Pipeline (Tier 3 Verification)

- **[NEW] `.github/workflows/ci.yml`** — GitHub Actions workflow runs `npm run verify` (type-check + lint + test) on every push/PR to `main`/`develop`. Closes the Tier 3 verification gap.

### ESLint Enforcement Upgrades

- **`no-console`: `warn` → `error`** — Forces use of `logger.*` instead of `console.log`.
- **`no-floating-promises`: enabled** — Added `parserOptions.project` for type-aware linting. Fixed 46 fire-and-forget promises across 22 files with `void` operator.
- **`as any` violations fixed** — Replaced 2 `as any` casts in `anthropic-stream.ts` with narrowed type assertion.

### API Route Tests (+94 new tests)

- **[NEW]** `conversations/route.test.ts` (22 tests), `gems/route.test.ts` (31 tests), `gallery/route.test.ts` (22 tests), `files/route.test.ts` (14 tests), `user/allowed-models/route.test.ts` (5 tests)
- **Test total**: 102 → 196 tests (14 test files, all passing)

---

## 2026-06-13: Improvement — Harness Engineering D-G

- **D: Tiered verification** — Replaced single `npm run verify` in Post-Change Checklist with 3 tiers: Tier 1 (`type-check` after each edit), Tier 2 (`verify` after task), Tier 3 (CI before merge).
- **E: Workflow checkpoints** — Added structured CHECKPOINT gates with YES/NO branches and max 2 retries in `debug.md` after Phase 2 (root cause) and Phase 4 (hypothesis).
- **F: Model routing docs** — Created `docs/model-routing.md` with task-to-model tier mapping (7 task types) and cost awareness guidelines.
- **G: Token observability** — Added Section 6 to `architecture.md` documenting future token tracking metrics (per-task cost, verify overhead, efficiency ratio).

---

## 2026-06-13: Improvement — Workflow Efficiency Optimization (A+B+C)

- **A: `npm run verify` script** — Added to `package.json`. Combines type-check + lint + test:run into one command. Fixes PowerShell `&&` incompatibility. Updated all rules, workflows, and skills to use `npm run verify`.
- **B: `audit.md` exit criteria** — Added verifiable checklist (zero `any`, toast.error on actions, no hardcoded strings, no console.log, component size). Agent now knows when audit PASSES.
- **C: Reorder `01-coding.md`** — BANNED/critical rules (`any` ban, silent catch ban, test requirements) moved to TOP of file. Based on "Lost in the Middle" research (agents miss instructions in the middle of long files).

---

## 2026-06-13: Fix — Top 3 Harness Engineering Gaps

- **Fix #1: Test enforcement** — Added "Testing Requirements" section to `01-coding.md` with `<important>` tag. Co-located tests (`*.test.ts`) now mandatory for `lib/features/` and `lib/core/`.
- **Fix #2: `no-explicit-any` → error** — Changed from `"warn"` to `"error"` in `eslint.config.mjs`. CI now fails on `any` types. Verified: 0 errors.
- **Fix #3: `add-translation.md` rewrite** — Rewrote skill to match current system (`lib/utils/translations/`, `useLanguage()` + `t("key")`). Also fixed stale paths in `04-bilingual.md` and `add-feature.md`.

---

## 2026-06-13: Improvement — Enforce Workflow Usage in Agent Rules (Harness Engineering)

- **What changed**: Updated `02-quality.md` to embed workflow steps directly into rules instead of relying on weak references.
- **Why**: Agents rarely self-invoked workflows (`/debug`, `/post-fix`, `/audit`) because they were framed as optional slash commands, not mandatory procedures.
- **Changes**:
  1. Pre-Work Protocol table now has a "Workflow to follow" column mapping domains to mandatory workflows
  2. Added `<important>` blocks requiring agents to read and follow workflows step-by-step
  3. "After Fixing a Bug" section renamed from "ADDITIONAL" to "MANDATORY Post-Fix Protocol" with inline steps
  4. New "Debugging Protocol" section with inline steps from `/debug` workflow
  5. Circuit breaker rule (3 failed fixes → STOP) now visible directly in rules

---

## 2026-06-13: Fix — Sidebar Layout Jump/Bounce When Switching Chats (RECURRING)

- **What changed**: Elements from Projects section downward no longer "jump" when switching between chats or clicking sidebar items.
- **Actual root cause**: `SidebarButton` was defined **inside** the `Sidebar` function component. Every re-render created a new function reference → React treated it as a different component type → **unmounted and remounted ALL buttons** (New Chat, Chat, Image Studio, Gallery) every render → DOM teardown/rebuild in 1 frame → layout shift cascade on dividers and everything below.
- **Fix**: Extracted `SidebarButton` to **module level** with `React.memo`, ensuring stable component identity across re-renders.
- **Secondary fixes** (applied first, necessary but not sufficient alone):
  1. `SidebarItem`: removed `initial={{ opacity: 0, x: -10 }}` enter animation → `initial={false}`
  2. `SidebarSection`: replaced `useEffect` localStorage read with synchronous `useState` lazy initializer
  3. `ProjectNode`: replaced `useEffect` localStorage read with lazy initializer + guarded auto-expand with functional updater
  4. `AnimatePresence mode="sync"` → `initial={false}` in chat list wrapper
- **Files**: `Sidebar.tsx`, `SidebarItem.tsx`, `SidebarSection.tsx`, `ProjectNode.tsx`

## 2026-06-12: Fix — UX/UI Audit Minor Batch (27 issues)

### Animation

- **SidebarSection**: Replaced `max-h-[2000px]` CSS hack with Framer Motion `height: "auto"` for smooth collapse
- **SidebarItem**: Added enter animation (`opacity: 0, x: -10` → `1, 0`)

### Visual & A11y

- **Empty states**: Enhanced sidebar empty states with icons + descriptive text
- **Charcoal theme**: Accent color `#9ca3af` → `#8ba3be` (more visible blue-gray)
- **TokenBadge**: Reduced prominence with `opacity-50 hover:opacity-100`
- **ModelSelector**: Dropdown `w-[350px]` → `w-[min(350px,calc(100vw-2rem))]` (mobile safe)
- **SidebarItem**: `div[role="button"]` → native `<button>` for a11y
- **SidebarSection**: Added `<h2 className="sr-only">` + `aria-expanded`
- **Chat scroll**: Added `role="log"` + `aria-live="polite"`
- **HeaderBar**: Hid desktop Language/Theme controls on mobile (duplicate)
- **HeaderBar**: Custom `Bars3Icon` SVG → Lucide `Menu`

### UX Fixes

- **FileManager + Gallery**: Added `toast.error()` for delete failures (was silent)
- **ProjectChat export**: Fixed empty export — now uses `downloadConversationById()` with full messages
- **GEMs tooltip**: Added descriptive tooltip for collapsed sidebar

### i18n

- **ErrorBoundary**: 4 hardcoded English strings → translation keys
- **ConfirmDialog**: Inline ternaries → `t()` calls
- **Canvas.tsx**: 4 inline bilingual checks → translation keys
- **GemList**: `"---"` → `t("noDescription")`

### Code Quality

- Deleted redundant `functions.ts` (duplicate of `functionRegistry.ts`)
- Removed `.bat`, `.ps1` from `SUPPORTED_FILE_TYPES` (conflicts with BLOCKED list)

**Files**: 19 files changed (17 modified, 1 deleted, 1 CSS)

---

## 2026-06-12: Fix — UX/UI Audit Final Major Batch (13/13 remaining issues)

### CSS Foundation

- **tailwind.config.ts**: Redirected 14+ dead shadcn HSL variables to live custom properties (`--card` → `--surface-elevated`, `--destructive` → `--danger`, etc.). Removed `hsl()` wrappers. Deleted dead `chart.*` and `sidebar.*` mappings.
- **motion.ts** [NEW]: Centralized animation constants (`DURATION`, `EASE`, `TRANSITION` presets) for consistent motion across all components.

### Theme Token Migration (27 files, 80+ replacements)

- **AdminDashboard.tsx**: Full migration from hardcoded dark theme (`from-gray-900 via-black`, `text-white`, `bg-white/3`) → design system tokens.
- **27 component files**: Batch replaced `text-red-*` → `--danger`, `text-green-*` → `--success`, `text-amber-*` → `--warning`, `text-blue-*` → `--accent` across chat, gallery, image-gen, projects, sidebar, auth, admin.
- **ProjectSettingsModal**: Overlay `bg-black/60` → `bg-(--overlay)`.

### Accessibility (3 modals migrated to Radix Dialog)

- **ImageCompareModal**: `<div fixed>` → Radix Dialog with focus trap, ESC, `aria-label`, `sr-only` title.
- **GemsManager**: Custom modal → Radix Dialog + theme tokens.
- **UserManager**: Custom modal → Radix Dialog + theme tokens.

### UX Improvements

- **Mobile sidebar**: Added slide-in/slide-out animation (Framer Motion + AnimatePresence).
- **GEM indicator**: Upgraded from `text-[10px]` plain text → prominent accent badge with icon + name.
- **Breadcrumbs**: Added navigation breadcrumb to Project detail page (`Home / Projects / Name`).
- **Client-side file validation**: Added pre-upload checks for file size (50MB), blocked extensions, blocked MIME types with toast feedback.

### Code Quality

- **Cron route**: Moved `/api/files/cleanup` → `/api/cron/cleanup` (Next.js convention).
- **Typed errors**: Migrated 50 `throw new Error()` → `NotFoundError`, `ForbiddenError`, `ValidationError`, `DatabaseError` across conversations.ts, fileService.server.ts, gems.ts.

**Files**: 40 files changed (38 modified, 1 new, 1 moved)

---

## 2026-06-12: Fix — UX/UI Audit Major Batch (15+ issues)

### Theme Token Migration

- **ToastContainer**: Migrated from hardcoded dark (`bg-green-950/90` etc.) to semantic tokens (`--success`, `--danger`, `--warning`, `--accent`). Added `role="alert"` + `aria-live="polite"`.
- **Chat Markdown**: Replaced `text-white`, `bg-white/5`, `border-white/10`, `text-neutral-100/300` with `--text-primary`, `--control-bg`, `--border`, `--text-secondary`.
- **ThinkingBlock**: `border-white/10 bg-white/3` → `border-(--border) bg-(--control-bg)`.
- **StreamErrorBanner**: `bg-red-900/90 border-red-500/50 text-red-200` → `bg-(--danger)/10 border-(--danger)/30 text-(--text-primary)`.
- **Switch**: Thumb `bg-white` → `bg-(--text-primary)`.
- **Button island**: `bg-white/10 text-white border-white/20` → `bg-(--control-bg) text-(--text-primary) border-(--control-border)`.
- **IconPicker**: `bg-white/5 hover:bg-white/10 border-white/10` → `bg-(--control-bg) hover:bg-(--control-bg-hover)`.
- **Soviet theme**: Added distinct `--danger: #b91c1c` to differentiate from `--accent: #ef4444`.

### Bilingual (21 new keys, ~30 hardcoded strings replaced)

- **useConversation.ts**: 5 hardcoded Vietnamese toasts → `t()` calls.
- **InputForm.tsx**: 8 hardcoded English strings (IMAGE MODE, Add..., Stop, etc.) → `t?.key` pattern.
- **TokenBadge.tsx**: 4 hardcoded labels (Input/Output/Thinking/tokens) → `t()` calls.
- **ChatBubble.tsx**: "Thinking Process", "ME" → `t()` calls.

### UX Safety

- **KnowledgePanel**: Delete document now requires confirmation via `confirm()` store.
- **UserManager**: Rank change now requires confirmation dialog before executing.

### Accessibility

- **FloatingMenuTrigger**: Added `aria-label="Open menu"`.
- **ToastContainer**: Added `role="region" aria-label="Notifications" aria-live="polite"`, `role="alert"` per toast, `aria-label` on dismiss button.

**Files**: ToastContainer, utilities.css, ChatBubble, StreamErrorBanner, switch, button, IconPicker, soviet.css, FloatingMenuTrigger, useConversation, InputForm, TokenBadge, KnowledgePanel, UserManager, config.ts

---

## 2026-06-12: Fix — UX/UI Audit Critical Batch (10 issues)

### Phase 1: CSS/Theming

- **Tooltip broken**: `bg-popover text-popover-foreground` → `bg-(--surface-elevated) text-(--text-primary)` — `--popover` was never defined in any theme CSS.
- **Avatar fallback broken**: `bg-muted` → `bg-(--surface-muted)` — `--muted` never defined.
- **`--surface-elevated` per glassmorphism theme**: Added to nebula, aqua, holo, orchid, sunset — dialogs/popovers now match theme tone instead of showing base dark surface.
- **`prefers-reduced-motion`**: Added `<MotionConfig reducedMotion="user">` in providers.tsx + CSS `@media (prefers-reduced-motion: reduce)` fallback for non-Framer animations.

### Phase 2: Accessibility

- **Sidebar ARIA**: Added `aria-label="Main navigation" role="navigation"` on both desktop and mobile `<aside>`.
- **Mobile drawer → Radix Dialog**: Replaced custom overlay with `Dialog.Root/Portal/Overlay/Content` for automatic focus trap, ESC close, scroll lock. Added `Dialog.Title` (sr-only) and `aria-label` on close button.
- **Global `focus-visible`**: Added `:focus-visible { outline: 2px solid var(--accent) }` + `:focus:not(:focus-visible) { outline: none }` in utilities.css.
- **ThinkingLevelSelector → Radix DropdownMenu**: Replaced custom useState+backdrop dropdown with `DropdownMenu/Trigger/Content/MenuItem` for keyboard nav and ARIA.

### Phase 3: Types & Bilingual

- **Type deduplication (facade pattern)**: `types/chat.ts` and `types/image-gen.ts` now re-export from authoritative `lib/features/` sources. Eliminated `Conversation` drift (missing `projectId`), `ImageGenOptions` drift (missing `referenceImage`).
- **Projects bilingual**: Added 41 translation keys. Replaced 44 hardcoded English strings across `projects/[id]/page.tsx`, `CreateProjectModal.tsx`, `ProjectSwitcher.tsx` with `t()` calls. Fixed mixed Vietnamese toast.

**Files**: tooltip.tsx, avatar.tsx, 5× glassmorphism CSS, utilities.css, providers.tsx, Sidebar.tsx, ThinkingLevelSelector.tsx, types/chat.ts, types/image-gen.ts, config.ts, projects/[id]/page.tsx, CreateProjectModal.tsx, ProjectSwitcher.tsx

---

## 2026-06-12: Refactor — UX/UI Audit Phase 4 (Waves 1-2)

### Wave 1: Font Sizes & Token Cleanup

- **`text-[11px]` → `text-xs`**: Swept all 66 violations. Option B: kept `text-[10px]` on
  VN/EN toggles, group labels, dropdown headers, small badges.
- **`#d97706` × 4**: HeaderBar theme swatch fallback → `var(--accent)`.
- **`bg-neutral-800`**: `base.css` scrollbar thumb + `GemPreview` → `var(--control-border)`.
- **`text-[9px]`**: HeaderBar mobile group label → `text-[10px]` (below floor).
- **Files**: HeaderBar, ModelSelector, SmartCode, ThinkingLevelSelector, FileInMessage,
  FileManagerPanel, FilePreviewArea, Canvas, signin/page, GemPreview, base.css

### Wave 2: Modal Migration

- **`DeleteConfirmModal` → DELETED**: Replaced with imperative `confirm()` from `confirmStore`.
  - `ChatApp.tsx`: Removed lazy import + `<Suspense>` render block.
  - `useChatModals.ts`: `openDeleteModal` now calls `confirm({ variant: "danger" })` directly;
    removed 4 state variables (`showDeleteModal`, `conversationToDelete`, etc.).
  - `ProjectSettingsModal.tsx`: 2 × `<DeleteConfirmModal>` → 2 × `confirm()` calls; also
    fixed dead tokens (`bg-primary`, `text-primary-foreground`, `red-500`) → Vikini tokens.
  - **Deleted**: `src/app/components/DeleteConfirmModal.tsx` (124 lines).
- **`CreateProjectModal` → Radix Dialog**: Replaced `div fixed inset-0` with `<Dialog>` +
  `<DialogContent>`. Dead tokens (`bg-muted/50`, `text-muted-foreground`, `bg-primary`,
  `text-destructive`, `border-border`) → Vikini tokens. Now has focus trap + ESC.
- **Gallery Detail Modal → Dialog**: Wrapped with `<Dialog>` + `<DialogContent>`, added
  `<DialogTitle>` for accessibility. Focus trap + ESC free from Radix.

### Wave 3: Admin & Gallery Polish

- **UserManager**: 4 × native `<select>` → Radix `<Select>` primitive. Removed all
  `bg-[#1a1a1a]`, `colorScheme: "dark"` inline styles.
- **GalleryView compare mode**: `purple-500` → `--accent` token (border, ring, indicator).
- **ImageCompareModal**: `purple-500` → `--accent` token (overlay toggle, model badge).

### Wave 4: Auth Pages

- **@ts-ignore × 3 REMOVED**: signin/page.tsx, error/page.tsx, confirm-dialog.tsx.
- **`window.location.href`** → `useRouter().push()` in error/page.tsx.
- **AccessPendingScreen** → bilingual with `useLanguage()` + 7 new translation keys.
- **`#020617`**: Kept per decision (login pages always dark).

### Verification

- `type-check` ✅, `lint` ✅, `test` ✅ (2 pre-existing env failures).
- **Total files changed**: 22+ files modified, 1 file deleted across all 4 waves.

### Bug Fix (mid-wave)

- **CreateProjectModal color picker**: Fixed self-closing `<button />` + TW v4 arbitrary
  value syntax (`ring-offset-[var(--surface)]`).

---

## 2026-06-12: Fix — GemManager Scroll + Image Studio Delete Confirm + Token Cleanup

### Bug Fixes

- **GemManager scroll lost**: Gem list container used `lg:overflow-y-visible` which
  killed vertical scroll on desktop. Changed to keep `overflow-y-auto` with
  `max-h-[60vh]` at all breakpoints. Added `min-h-0` on flex parent for proper
  flex-scroll containment.
- **Image Studio delete without confirm**: Sidebar `onDeleteConversation` called
  `deleteConversation()` directly without user confirmation. Added `confirm({ variant: "danger" })`
  from `confirmStore`.

### Token & Standards Cleanup

- **GemList**: `red-900/50`, `red-300`, `red-950/40` → `--danger` tokens; `text-neutral-*`
  → `text-(--text-secondary)`; all `text-[10px]`/`text-[11px]` → `text-xs`.
- **GemManager**: `text-[10px]` on Reset Default button → `text-xs`.
- **ImageGenStudio**: Dead `bg-destructive text-destructive-foreground` → `bg-(--danger)
text-(--danger-foreground)`.

### Verification

- `type-check` ✅, `lint` ✅.

- **Files changed**: `GemManager.tsx`, `GemList.tsx`, `ImageGenStudio.tsx`

---

## 2026-06-12: Refactor — UI/UX Phase 3 (Migrate surfaces to canonical primitives)

> Builds on Phase 1. Unifies confirmation dialogs and loading states across features.

### Migrated confirmations → imperative `confirm()`

- `features/gems/components/GemManager.tsx` — removed `pendingDeleteGem` state + hand-rolled
  `fixed inset-0` modal; `onDelete` now calls `confirm({ variant: "danger" })`. Bilingual
  labels preserved via `t()`.
- `admin/components/GemsManager.tsx` — removed `pendingDeleteId` state + custom modal; same pattern.
- `features/gallery/components/GalleryView.tsx` — replaced the 2-step inline delete
  (`showDeleteConfirm`) with a single button + `confirm()`; removed the now-dead state and its
  resets in `handlePrev/NextImage`. Hardcoded `red-500` swapped for `--danger` token.

### Loading states → `Skeleton`

- `GalleryView` — initial grid load now shows a 10-cell `Skeleton` grid matching the image
  layout instead of a lone centered spinner.

### Verification

- `type-check` ✅, `lint` ✅, `build` ✅.
- Tests: 100 passed; 2 pre-existing env failures in `limits.test.ts`, unrelated.

- **Files changed**: `features/gems/components/GemManager.tsx`, `admin/components/GemsManager.tsx`, `features/gallery/components/GalleryView.tsx`

### Docs / standards

- Corrected `rules/03-ui.md`: documented the live token vocabulary; banned the dead shadcn
  token classes (`bg-primary`, `bg-destructive`, `bg-popover`, …) that compile to empty styles
  under Tailwind v4; added accessibility + min-font + no-hand-rolled-modal standards.
- `docs/architecture.md`: added a Design System (Tokens & Primitives) section + `confirmStore`.
- `docs/lessons-learned.md`: recorded the dead-token and hand-rolled-modal lessons.

---

## 2026-06-12: Refactor — UI/UX Phase 1 (Primitives + Design Tokens)

> Direction A (refine current look) with C accents (glow on destructive surfaces).
> Foundational pass from the UX/UI audit (`docs/ux-ui-audit.md`).

### Root cause fixed: dead shadcn token layer

- **Symptom**: `components/ui/` primitives (Button, Dialog, Input, Card, Select, Switch,
  Popover, Dropdown) referenced shadcn tokens (`--background`, `--destructive`, `--ring`,
  `--radius`, `--muted-foreground`, …) that are **defined nowhere**, and `tailwind.config.ts`
  is **not loaded** under Tailwind v4 (no `@config`). The utilities resolved to empty styles,
  so dialogs rendered transparent and dropdowns had no background. Features worked around this
  by hardcoding `--surface`/`white/X` glass on top — the source of the design drift.
- **Fix**: rewrote all primitives onto the live Vikini token vocabulary
  (`--surface`, `--surface-elevated`, `--text-primary`, `--border`, `--control-bg`,
  `--control-border`, `--accent`). Added semantic state tokens.

### Added — design tokens (`styles/themes/_shared/base.css`)

- `--danger` / `--danger-hover` / `--danger-foreground`, `--success`, `--warning`
- `--accent-foreground` (near-black, readable on all 15 theme accents)
- `--ring`, `--radius`, `--overlay`

### Added — primitives

- `components/ui/skeleton.tsx` — canonical loading placeholder.
- `lib/store/confirmStore.ts` + `components/ui/confirm-dialog.tsx` — imperative
  `confirm()` API (replaces `window.confirm()`), async in-dialog loading, `danger` glow
  variant. Host mounted globally in `MainLayout`. Focus-trap / ESC / `role="dialog"`
  come from Radix.

### Migrated

- `projects/[id]/page.tsx` — 2 native `confirm()` → `confirm()` store.
- `chat/components/ChatApp.tsx` — 2 hand-rolled modal `div`s (rename, delete message)
  → `Dialog` primitive (now with focus-trap + ESC).

### Verification

- `type-check` ✅, `lint` ✅, `build` ✅ (no errors/warnings).
- Tests: 100 passed; 2 pre-existing env failures in `limits.test.ts`
  ("Missing Supabase service role key"), unrelated to this change.

- **Files changed**: `styles/themes/_shared/base.css`, `components/ui/{button,dialog,alert-dialog,input,textarea,card,select,switch,popover,dropdown-menu,skeleton,confirm-dialog}.tsx`, `lib/store/confirmStore.ts`, `app/features/layout/components/MainLayout.tsx`, `app/projects/[id]/page.tsx`, `app/features/chat/components/ChatApp.tsx`

---

## 2026-06-11: Fix — AI Not Reading Uploaded Images + Table Format Breaking

### Bug 1: AI không chủ động đọc file ảnh upload

- **Symptom**: AI không mô tả/acknowledge ảnh upload, đặc biệt ảnh thứ 2 trở đi. Chỉ đọc khi user yêu cầu rõ ràng.
- **Root causes**:
  1. Ảnh thiếu label `[NEWLY ATTACHED]` — chỉ text files mới có
  2. Gemini Files API gửi `fileData` trần không kèm text label
  3. Header instruction chỉ nói "don't execute" (phòng thủ), không yêu cầu AI mô tả ảnh
- **Fixes**:
  1. Thêm `[NEWLY ATTACHED]` label cho ảnh (giống text files)
  2. Thêm text label trước Gemini Files API `fileData` parts
  3. Thêm instruction: "For IMAGE attachments: Always briefly acknowledge and describe what you see in EACH image"
  4. Thêm summary note khi >1 ảnh: `[NOTE: N images attached. Please acknowledge ALL images]`

### Bug 2: Format bảng bị vỡ trong chat

- **Symptom**: Cột header bị nén chữ dọc (mỗi ký tự 1 dòng), `<br>` hiển thị như text thay vì xuống dòng.
- **Root causes**:
  1. `display: block` trên `.chat-markdown table` phá vỡ table layout algorithm → cột ngắn bị nén tới 0px
  2. ReactMarkdown không bật `rehype-raw` → HTML tags (`<br>`) bị escape thành text
- **Fixes**:
  1. Thay `display: block` bằng `table-layout: auto` (wrapper div đã handle scroll)
  2. Thêm `white-space: nowrap` cho `thead th` + `min-width: 80px` cho `td`
  3. Thêm `rehype-raw` vào ReactMarkdown rehypePlugins (đã có trong package.json)

- **Files changed**: `chatStreamCore.ts`, `utilities.css`, `ChatBubble.tsx`

---

## 2026-06-11: Fix — IMAGE_SAFETY Error Not Surfaced to User

- **Symptom**: When Gemini blocks image generation due to safety filters (e.g., brand names like "Heineken"), user sees generic "Image generation failed" error instead of an actionable message.
- **Root cause**: `GeminiNativeImageProvider` didn't check `finishReason` on candidates. When `finishReason` was `IMAGE_SAFETY`, `content.parts` was empty, triggering generic "No image parts in Gemini response" error. Route handler then masked it with generic 500.
- **Fixes**:
  1. `GeminiNativeImageProvider.ts`: Check `finishReason` before parts — detect `IMAGE_SAFETY`, `SAFETY`, `RECITATION` and throw user-friendly messages with guidance.
  2. `route.ts`: Surface safety-related errors with 422 status instead of generic 500.
  3. `ImageGenStudio.tsx`: Display API error message in error modal instead of generic translation.
  4. `useImageGenController.ts`: Fix `data.error` extraction (was passing whole object → `[object Object]`).
  5. `constants.ts`: Added `UNPROCESSABLE_ENTITY: 422` to `HTTP_STATUS`.
- **Files changed**: `GeminiNativeImageProvider.ts`, `route.ts`, `ImageGenStudio.tsx`, `useImageGenController.ts`, `constants.ts`

---

## 2026-06-09: Fix Regenerate and Edit Buttons Failing Silently & Delete Modal Improvements

- **Symptom**:
  - The "Regenerate" and "Edit" buttons in the chat interface sometimes failed silently for newly generated messages.
  - The Delete Conversation modal had two overlapping "X" close buttons and lacked visual feedback when clicking "Delete".
- **Root causes**:
  1. `handleRegenerate` and `handleEdit` attempted to find the message index using object reference equality (`m === specificMessage`) on an array returned by `normalizeMessages`, which created new object references.
  2. Fallback matching logic relied on `specificMessage.id`, which could be missing if the background reload from the server hadn't finished.
  3. Original user message attachments (`fileIds`) were lost on regenerate/edit because they weren't passed down to `coreSend`.
  4. The custom `DeleteConfirmModal` card wrapper was inside `DialogContent` which rendered its own default close button underneath the custom one.
  5. The `onConfirm` action in `DeleteConfirmModal` lacked a loading state to show processing status.
- **Fixes**:
  1. Added fallback matching logic to compare `role` and `content` when the ID is missing for regenerate/edit.
  2. Extracted `fileIds` from the `meta` of the user message and passed them to `coreSend` to preserve attachments.
  3. Added `[&>button]:hidden` to `DialogContent` to hide the default unstyled close button.
  4. Added `isDeleting` state in `DeleteConfirmModal` with a `Loader2` spinner and disabled buttons during deletion.
- **Files changed**: `useChatStreamController.ts`, `DeleteConfirmModal.tsx`

---

## 2026-05-29: Fix — Sidebar Chat List Flicker on Every Interaction

- **Symptom**: Chat list flickered (flash/remount) on every click, button press, or window minimize/restore.
- **Root causes**:
  1. `SidebarContent` was an inline component inside `Sidebar` — React treated it as a new component type each render → full unmount/remount of all children including `AnimatePresence` + `SidebarItem` animations.
  2. `SidebarItem` `initial={{ opacity: 0, x: -10 }}` replayed on every remount.
  3. SWR `revalidateOnReconnect` was default `true` — refetched on window restore.
- **Fixes**:
  1. Converted `SidebarContent` from inline component to render function (`renderSidebarContent`) — React now reconciles stably by key.
  2. Added `hasMountedRef` to skip initial animation on re-renders (entrance animation still plays on first mount).
  3. Added `revalidateOnReconnect: false` to SWR config.
- **Files changed**: `Sidebar.tsx`, `SidebarItem.tsx`, `useConversation.ts`

---

## 2026-05-29: Image Studio — Major Augmentation (4 Phases)

### 🟢 Phase 1: Image Editing (Inpainting / Style Transfer / Extend)

- **New `/api/edit-image` endpoint** — Accepts source image + edit prompt → Gemini Native Image Gen → returns edited image saved as new message.
- **New `EditImageModal` component** — Dialog with source preview, edit prompt textarea, model selector (Flash/Pro), aspect ratio, 6 suggestion chips with stagger animation.
- **Canvas "Edit" button** — Blue pill button with Pencil icon appears on image hover overlay.

### 🟢 Phase 2: Image-to-Image (Reference Upload)

- **ControlPanel reference image section** — Drag-and-drop / click-to-upload with thumbnail preview + remove button.
- **Auto-routing** — When reference image present, generate-image API auto-routes to `gemini-native` provider.
- **GeminiNativeImageProvider update** — Supports `referenceImage` in options, sends as `inlineData` part alongside text prompt.

### 🟢 Phase 3: Lightbox trong Studio

- **New `ImageLightbox` component** — Fullscreen overlay (z-50) with zoom (scroll wheel, +/- buttons, 1x-5x), pan (mouse drag when zoomed), keyboard navigation (←→, Esc, +/-), mobile swipe via Framer Motion drag, bottom info bar with prompt/badges, action buttons (Remix/Edit/Download/Delete), double-click zoom toggle.
- **Canvas click handler** — Click image opens lightbox at that index.

### 🟢 Phase 4: Batch Generation

- **Rank-based quota system** — basic: 2 images/10 uses, pro: 2-3 images/10+10 uses, admin: 2-4 images/999 uses. Daily tracking via Upstash Redis.
- **New `batchGenQuota.ts` module** — Config, Redis helpers, `incrementBatchGenUsage()`.
- **New `/api/batch-gen-quota` endpoint** — Returns user's quota status per batch size.
- **ControlPanel batch selector** — 4-button grid with hover/longpress tooltip showing remaining daily uses, disabled state when exhausted.
- **Sequential batch generation** — ImageGenStudio generates N images sequentially with "Generating 2/4..." progress label, refreshes after each.
- **Quota refresh** — Auto-refetch after batch generation completes.

### 🔧 Code Quality

- 32 new bilingual translation keys (vi+en) for editing, reference, lightbox, batch gen.
- TypeScript strict: 0 errors. ESLint: 0 errors.
- New files: 5 (EditImageModal, ImageLightbox, edit-image route, batch-gen-quota route, batchGenQuota module).
- Modified: 6 (config.ts, Canvas.tsx, ControlPanel.tsx, ImageGenStudio.tsx, generate-image route, GeminiNativeImageProvider).

---

## 2026-05-29: Image Studio — Mobile Layout Fix + UX Overhaul

### 🔴 Critical Fix

- **Mobile layout completely broken** — ControlPanel used `w-full` on mobile, pushing Canvas (Results) off-screen. Added mobile tab system (Studio/Results) with animated indicator, auto-switch to Results after generation.

### 🟡 UX Improvements

- **Empty state redesigned** — Glassmorphism card with animated floating icon, gradient glow, prompt suggestions (rotating curated + recent prompts).
- **Framer Motion animations** — Image cards stagger in, shimmer skeleton loading, smooth empty state fade-in.
- **HeaderBar props fixed** — Was `t={}` + `language="en"` hardcoded, now receives proper translation dict and language handler.
- **Responsive padding** — Canvas `px-4 md:px-6 lg:px-8`, ControlPanel `px-4 md:px-6`.

### 🔧 Code Quality

- Removed `bg-black` hardcode → `bg-(--surface-elevated)`, removed broken `col-span-full` + decoration div.
- 7 new bilingual keys: `studioTabStudio/Results`, `studioEmptyTitle/Desc`, `studioTryPrompt`, `studioRecentPrompts`, `studioSuggestedPrompts`.

### Files changed

- **Modified**: ImageGenStudio.tsx, Canvas.tsx, ControlPanel.tsx, config.ts

---

## 2026-05-29: Audit Fix Batch — 16 issues resolved

### 🔴 Critical Bug Fixes

- **FileInMessage onClick not wired** — ChatBubble.tsx now passes `onClick={setLightboxFile}` + renders FileLightbox for in-message file preview
- **Duplicate `validateFile`** — Removed 63-line local copy from fileService.server.ts, imports from fileValidation.ts
- **PDF text extraction for non-Gemini** — Added `pdf-parse` for server-side PDF text extraction; non-Gemini providers (Claude, DeepSeek) can now read PDF content

### 🟡 UX Improvements

- **FileLightbox error state** — Signed URL fetch failure now shows error UI + retry button (was infinite spinner)
- **Filename truncation preserves extension** — `report-final-v2.pdf` → `report-fi…v2.pdf` (was `report-final-v...`)
- **File navigation in lightbox** — Prev/Next arrows + keyboard (←/→) + file counter "2 / 5"
- **Upload retry** — 1 automatic retry on network error/timeout with 1s delay

### ♿ Accessibility

- **FilePreviewCard** — Added keyboard handler (Enter/Space), aria-label on card
- **FileLightbox** — Focus trap, focusable container, Tab wrapping
- **FilePreviewCard aria-label** — Screen reader announces "Preview filename.pdf"

### 🔧 Code Quality

- **Shared utils** — Created `lib/utils/fileDisplayUtils.ts` with `formatFileSize`, `KIND_ICONS`, `KIND_COLORS`, `truncateFilename` (eliminated 4× duplication)
- **`pickFirstEnv` consolidated** — Removed 3 local copies, all import from `lib/utils/config.ts`
- **`toInt`/`toBytes` dedup** — Removed identical `toBytes()`, unified to `toInt()`
- **`token_count` populated** — File upload now estimates and stores token count
- **Bilingual strings** — FileLightbox translated, all hardcoded English replaced with `t?.key` pattern
- **FileInMessage colors** — Replaced hardcoded `bg-white/10` with theme-aware `bg-[var(--surface)]/15`
- **FileManagerPanel** — `console.error` → `logger.error`

### Files changed

- **New**: `lib/utils/fileDisplayUtils.ts`
- **Modified**: ChatBubble.tsx, FileLightbox.tsx, FilePreviewCard.tsx, FileInMessage.tsx, FileManagerPanel.tsx, useFileUpload.ts, fileService.server.ts, fileProcessors.ts, chatStreamCore.ts, config.ts
- **Deps**: Added `pdf-parse` + `@types/pdf-parse`

---

## 2026-05-29: Fix — Files persisting in input + File Manager dropdown redesign

- **Bug: Files stayed in input after send**
  - Root cause: `markAsSent()` was inside `useDebounceCallback` (500ms delay), so files remained visible during debounce window
  - Fix: Snapshot fileIds and call `markAsSent()` synchronously in `handleSubmit` before debounce fires
- **Bug: `[object Object]` rendering in file cards**
  - Root cause: Zustand store used `Set<string>` for `sentFileIds`. React can't serialize Sets properly → renders `[object Object]`
  - Fix: Changed `Set<string>` → `string[]` with `[...new Set([...old, ...new])]` for dedup
- **UX: File Manager redesigned as dropdown**
  - Replaced full-screen slide-out panel with compact dropdown anchored above "📁 Files" button
  - Click-outside and Escape to close, toggle behavior, mobile-friendly width
- **Files affected**: store.ts, InputForm.tsx, FileManagerPanel.tsx, ChatControls.tsx

## 2026-05-29: File UX Overhaul — Message-attached Files + File Manager

- **Files sent with messages** (Claude-style): Files now appear inside user message bubbles instead of persisting on the input bar. After sending, file preview clears and file chips appear inline in the bubble.
- **AI file priority**: Newly attached files are labeled `[NEWLY ATTACHED]` and sorted first in context. AI is instructed to prioritize reading them.
- **File Manager Panel**: New slide-out panel (📁 Files button in toolbar) lists all conversation files with kind icons, size, relative dates, and delete functionality.
- **Delete animations**: File cards now show a spinner when deleting, with smooth exit animations via Framer Motion.
- **Backend**: `fileIds` added to chat stream request schema, saved in user message meta, passed through to `processAttachments()` for priority ordering.
- **Files affected**: validators.ts, chatStreamCore.ts, useChatStreamController.ts, ChatControls.tsx, InputForm.tsx, ChatBubble.tsx, FileInMessage.tsx, FilePreviewCard.tsx, FileManagerPanel.tsx (new), ChatApp.tsx

## 2026-05-29: Fix — Files not showing in UI after upload

- **Root cause**: SWR fetcher expected plain array but API returned `{ data: { files: [...] } }`. `Array.isArray()` returned false → empty file list.
- **Fix**: Properly unwrap nested API response in `useFiles.ts` fetcher.
- **Also fixed**: Upload race condition — optimistic SWR update now passes file data from XHR response to prevent gap between queue removal and SWR refetch.

---

## 2026-05-28: Unified File System Refactor — Single Table + Inline-first UX

- **What changed**: Complete rewrite of the file upload system. Consolidated dual-table architecture (attachments + files) into a single unified `files` table with 30-day TTL. Replaced 903-line `AttachmentsPanel` with clean inline-first design.
- **Why**: Legacy system had 6 API routes, 2 DB tables, 3 separate upload paths, and an AttachmentsPanel that duplicated logic with InputForm. Users found the UX confusing compared to ChatGPT/Gemini.
- **Backend changes**:
  - New DB migration: `021_unify_files_system.sql` — drops legacy `attachments` table, adds `expires_at` column with 30-day TTL
  - Shared validation: `fileValidation.ts` — magic bytes, MIME normalization, blocked extensions
  - File processors: `fileProcessors.ts` — ZIP listing, text extraction, AI analysis
  - Unified service: `fileService.server.ts` — TTL, batch download, cleanup, Gemini URI refresh
  - New API routes: `/api/files/[id]/analyze`, `/api/files/cleanup` (cron)
  - `conversations.ts`: simplified `deleteConversation()` to use unified `deleteFilesByConversation`
  - `chatStreamCore.ts`: removed all legacy attachment code, uses static imports from `fileService.server`
- **Client state**:
  - `store.ts` (Zustand): per-file upload queue with progress tracking
  - `useFiles.ts` (SWR): single source of truth for file data
  - `useFileUpload.ts`: unified hook — drag/drop (1 window handler), paste (1 global handler), file picker, XHR progress
- **UI components**:
  - `FilePreviewCard.tsx`: thumbnail/icon card with upload progress animation
  - `FilePreviewArea.tsx`: horizontal scrolling inline preview above textarea
  - `FileLightbox.tsx`: full-screen file preview (images, video, audio, text, documents)
  - `FileInMessage.tsx`: collapsible file indicator in chat bubbles
  - `InputForm.tsx`: rewritten 513→280 lines, integrates all new hooks/components
  - `ChatControls.tsx`: removed FILES button, AttachmentsPanel import
  - `ChatApp.tsx`: removed useFileDragDrop, attachmentsRef, file state
- **Deleted files**: `AttachmentsPanel.tsx` (903 lines), `FileChips.tsx`, `FileTypesHelp.tsx`, `useFileDragDrop.ts`, `lib/features/attachments/` (entire directory), `app/api/attachments/` (6 routes), `app/api/cron/attachments-cleanup/`, `types/attachments.ts`, `lib/features/attachments/store.ts`
- **Verification**: `npm run type-check` ✅, `npm run lint` ✅ (0 errors, 0 warnings)

---

## 2026-05-08: Fix Sidebar Chat List Flickering During Streaming & Typing

- **What changed**: Chat list in sidebar no longer flickers continuously during streaming or when typing in the input field.
- **Why**: Despite `Sidebar` being wrapped with `React.memo` and all callback props being stabilized with `useCallback` (previous fix on 2026-05-07), the `personalConversations` array returned by `useConversation()` was computed inline without `useMemo`. Every re-render of `ChatApp` (triggered by typing/streaming state changes) created a new array reference → `filteredConversations` changed → `React.memo` on `Sidebar` was bypassed → entire sidebar re-rendered every 15ms during streaming (typewriter tick) and every keystroke.
- **Root cause**: `conversations.filter((c) => !c.projectId)` on line 489 of `useConversation.ts` was NOT wrapped in `useMemo`, creating a new array reference on every hook invocation.
- **Fix**: Wrapped `personalConversations` with `useMemo([conversations])` to stabilize the reference.
- **Files changed**: `useConversation.ts`

---

## 2026-05-07: Implement Composite Cache + KB Cache (Strategy B + D)

- **What changed**: Complete rewrite of context caching to properly support GEM personas + tools.
- **Strategy B (Composite Cache)**: System instruction, tools, and toolConfig are now cached _together_ in a single `ai.caches.create()` call. Cache key includes tools fingerprint, so different tool combinations (web search on/off) create separate cache entries. This eliminates the 400 error caused by sending `cachedContent` + `tools` in the same request.
- **Strategy D (KB Cache)**: Project knowledge base documents are now cached separately for monitoring and future cost optimization. Logging tracks cache hit rates per project (`[KB CACHE] HIT/CREATED`).
- **`executeStream` update**: When `cachedContent` is active, `system_instruction`, `tools`, AND `toolConfig` are ALL omitted from the request (they're inside the cache).
- **Token savings**: ~87% cost reduction on cached input tokens for GEM personas ≥4096 chars.
- **Files changed**: `contextCache.ts` (full rewrite), `chatStreamCore.ts`, `streaming.ts`

## 2026-05-07: Fix Project Info Panel Not Updating After Document Upload/Delete

- **What changed**: Project Info stats (Documents count, Storage) now refresh immediately after uploading or deleting knowledge documents.
- **Why**: After uploading files to a project's Knowledge Base, the Info panel still showed `Documents: 0` and `Storage: 0.00 / 5 MB` because `fetchProjects()` was never called to refresh the project stats in the Zustand store.
- **Root cause**: `handleUpload()` and `handleDeleteDocument()` only called `fetchDocuments()` (refreshing the file list), but did NOT call `fetchProjects()` to update `project.document_count` and `project.storage_bytes` in the store.
- **Fix**: Both `ProjectSettingsModal.tsx` and `projects/[id]/page.tsx` now call `Promise.all([fetchDocuments(), fetchProjects()])` after document mutations.
- **Files changed**: `ProjectSettingsModal.tsx`, `app/projects/[id]/page.tsx`

## 2026-05-07: Fix Sidebar Flickering on Every Keystroke

- **What changed**: Sidebar no longer re-renders when typing in the chat input.
- **Why**: Each keystroke changed `input` state in `ChatApp`, which re-rendered the entire component tree including `Sidebar`. Since `Sidebar` was not memoized and received inline arrow functions as props, it fully re-rendered on every character typed.
- **Root cause**: (1) `Sidebar` was not wrapped with `React.memo()`. (2) 10+ callbacks were passed as inline arrow functions → new references every render → memo would be useless anyway.
- **Fix**:
  1. Wrapped `Sidebar` with `React.memo()` for shallow prop comparison
  2. Extracted all 10 inline callbacks into `useCallback` hooks with stable dependencies
  3. Destructured `openRenameModal`/`openDeleteModal` from `modals` object to avoid unstable object reference in deps
- **Files changed**: `Sidebar.tsx`, `ChatApp.tsx`

---

## 2026-05-06: Post-Refactor Audit — Security, Cleanup & UX Polish

- **What changed**: Audit pass over the Dual Storage refactor, found and fixed 4 issues:
  1. **RLS Policy Fix**: Removed broken `auth.uid()::text` RLS policies from `files` table. The project uses **email** as `user_id` (not Supabase Auth UUID), and all other tables rely on server-side enforcement via `supabaseAdmin` (service_role). Added documentation comment explaining the pattern.
  2. **Conversation Delete Cleanup**: `deleteConversation()` now also calls `deleteFilesByConversation()` before removing the conversation row. Previously only legacy `attachments` were cleaned up, leaving orphaned `files` records.
  3. **Delete Animations**: Added smooth exit animations (Framer Motion) to:
     - `AttachmentsPanel`: Files slide left + fade on delete, spinner replaces trash icon during operation, optimistic removal with rollback on error.
     - `Sidebar`: Conversations fade + slide left when deleted, `AnimatePresence` wraps the list for proper exit transitions.
     - Both use `deletingIds`/`deletingId` state for visual feedback during async operations.
  4. **FileChips ↔ AttachmentsPanel Sync**: Replaced local-only `uploadedFiles` state in `InputForm` with API-synced fetch. Both components now listen to the shared `vikini:attachments-changed` event and fetch from `/api/files`, ensuring files appear in both places regardless of upload source.
- **Files changed**: `020_create_files_table.sql`, `conversations.ts`, `AttachmentsPanel.tsx`, `Sidebar.tsx`, `SidebarItem.tsx`, `InputForm.tsx`

---

## 2026-05-05: File System Refactor — Dual Storage (Gemini Files API + Supabase)

- **What changed**: Complete refactor of the attachment/file upload system:
  1. **Dual Storage Architecture**: Files are now uploaded to both Gemini Files API (48h, free, native multimodal processing) and Supabase Storage (permanent fallback). Gemini models use `fileUri` references (zero re-download), non-Gemini models (DeepSeek, Claude) use base64/text extraction from Supabase.
  2. **New DB Table**: `files` table replaces `attachments` with Gemini-specific columns (`gemini_file_name`, `gemini_file_uri`, `gemini_expires_at`), text extraction cache (`extracted_text`), and file classification (`kind`).
  3. **Simplified Upload Flow**: Replaced 3-step signed URL upload (sign → PUT → complete) with single FormData POST to `/api/files/upload`. Updated both `AttachmentsPanel.tsx` and `InputForm.tsx`.
  4. **Provider-Aware Chat Integration**: `chatStreamCore.ts` `processAttachments()` now detects model provider and routes files accordingly: Gemini → Files API URI (`fileData`), others → download + `inlineData`/text. Streaming converters already handle `inlineData` → `image_url` (DeepSeek) and → `base64` (Claude).
  5. **Auto-Refresh**: `refreshGeminiUri()` automatically re-uploads to Gemini when 48h expiry is reached, downloading from Supabase transparently.
  6. **Video/Audio Support**: New file types now supported for Gemini models (mp4, mov, webm, mp3, wav, ogg). Non-Gemini models see descriptive notes. File input accept list updated.
  7. **Lazy Text Caching**: When text content is downloaded for non-Gemini providers, it's automatically cached in `extracted_text` column for future requests (non-blocking).
  8. **Inline File Chips (UI)**: New `FileChips.tsx` component renders uploaded files as color-coded chips inside the input box (ChatGPT-style). Icons per file type, ⚡ Gemini-ready badge, animated entry/exit, hover-to-remove.
  9. **Backward Compatible**: Legacy `/api/attachments` routes still work. UI reads from both tables and deduplicates.
- **Files changed**: `types/files.ts` (NEW), `fileService.server.ts` (NEW), `FileChips.tsx` (NEW), `/api/files/*` routes (NEW), `chatStreamCore.ts`, `AttachmentsPanel.tsx`, `InputForm.tsx`, `020_create_files_table.sql` (migration)

---

## 2026-05-05: Phase 2 — Agentic Capabilities (Function Registry + Embedding 2)

- **What changed**: 3 improvements from Phase 2 of the Architecture Gap plan:
  1. **Function Calling Registry** (`functionRegistry.ts` NEW): Replaced static `BUILT_IN_FUNCTIONS` array with extensible Map-based registry. `registerFunction()` auto-registers declarations + async handlers. Added 2 new built-in functions: `get_weather` (redirects to web search), `calculate` (server-side math). Old `functions.ts` preserved for backward compat but no longer imported.
  2. **Tool Combination Engine**: Already completed (Gemini 3 Tool Context Circulation). Verified all paths properly forward `allResponseParts` and `functionCall.id`.
  3. **Gemini Embedding 2**: Added `gemini-embedding-2` (multimodal, text+image+video+audio embedding) to `EmbeddingModel` type. All tiers now have access. Implemented task-prefix formatting (`formatQueryForRAG`, `formatDocumentForRAG`) per official docs — queries use `task: question answering | query: X`, documents use `title: X | text: Y`. Added `outputDimensionality` config support. Updated `searchKnowledge()` and `uploadDocument()` to auto-format when model is embedding-2.
- **Files changed**: `functionRegistry.ts` (NEW), `streaming.ts`, `chatStreamCore.ts`, `embedding.server.ts`, `knowledge.server.ts`, `projects.ts` (types)

## 2026-05-05: Phase 1 — Architecture Gap Closure (Model Registry + Context Caching)

- **What changed**: 3 improvements from the Gemini API Architecture Gap Analysis (Part 5):
  1. **Model Registry**: Added `gemini-3.1-flash-lite-preview` (cheapest/fastest in 3.1 series) to selectable models, API_ALLOWED, aliases, `isGemini3Model()`, and bilingual translations (VI/EN).
  2. **Explicit Context Caching**: New `contextCache.ts` module that caches GEM system instructions via `ai.caches.create()` for 50-90% token cost savings. Integrated into Gemini native stream path in `chatStreamCore.ts` → `streaming.ts`. Uses in-memory dedup map with TTL tracking. Falls back gracefully if caching fails (non-fatal). Only activates for prompts ≥ 4096 chars.
  3. **ChatStreamParams**: Extended with `cachedContent` field, threaded through `runStreamWithFallback` → `executeStream` → `generateContentStream` config. When cache is active, `systemInstruction` is omitted (already in cache).
- **Files changed**: `modelRegistry.ts`, `streaming.ts`, `chatStreamCore.ts`, `contextCache.ts` (NEW), `config.ts`, `useChatTranslations.ts`

## 2026-05-05: Gemini 3 Tool Context Circulation — Combined Web Search + Function Calling

- **What changed**: Gemini 3+ models can now use `googleSearch` + `codeExecution` + `functionDeclarations` simultaneously in a single request.
- **Why**: Gemini 3 supports [Tool Context Circulation](https://ai.google.dev/gemini-api/docs/tool-combination) — mixing built-in tools with custom functions. Gemini 2.5 does NOT support this and keeps `googleSearch` isolated.
- **Details**:
  - `chatStreamCore.ts`: `setupToolsAndSafety()` now returns `toolConfig` with `includeServerSideToolInvocations: true` for Gemini 3 + web search ON
  - `streaming.ts`: `executeStream()` passes `toolConfig` to `generateContentStream` config
  - `streaming.ts`: Collects ALL response parts (`toolCall`, `toolResponse`, `functionCall`) for context circulation in function call continuations
  - `streaming.ts`: Fixed `functionCall.id` — now properly passed in `functionResponse` for correct call-response mapping
  - `streaming.ts`: `runStreamWithFallback()` forwards `toolConfig` through the pipeline

## 2026-05-05: DeepSeek Web Search — V4 Disabled, V3.2 Enabled via OpenRouter

- **What changed**: WEB search disabled for DeepSeek V4 (direct API). Enabled for V3.2 via OpenRouter `openrouter:web_search` server tool.
- **Why**: V4 has no web search capability. V3.2 via OpenRouter supports the new server tools API for real-time grounding (~$0.02/query via Exa).
- **Details**:
  - `modelRegistry.ts`: `modelSupportsWebSearch()` now returns `true` for V3.2, `false` only for V4 direct
  - `modelRegistry.ts`: New `isDeepSeekV32Model()` helper
  - `constants.ts`: Added `MODEL_IDS.DEEPSEEK_V32`
  - `streaming.ts`: Injects `{ type: "openrouter:web_search", parameters: { max_results: 5, search_context_size: "low" } }` into V3.2 request when WEB ON
  - `ChatControls.tsx`: Shows amber pricing note `~$0.02/search query` when V3.2 + WEB ON
  - `config.ts`: Bilingual `webSearchPricingNote` key

## 2026-05-05: Fix Gemini Web Search Not Working (Critical)

- **What changed**: Removed `googleMaps` tool from default tools array; updated `@google/genai` SDK 1.38→1.52.
- **Why**: `googleMaps` tool only supports Gemini 3 family. When sent to Gemini 2.5 or 3.1 Pro models, the entire API call **failed**, triggering the fallback which silently retried **without ANY tools** — including `googleSearch`. This made web search appear broken for ALL Gemini models.
- **Root cause**: `setupToolsAndSafety()` always injected `{ googleMaps: {} }` when web search was enabled, regardless of model family.
- **Details**:
  - Removed `googleMaps` from `chatStreamCore.ts` `setupToolsAndSafety()`
  - Hardened `envFlag()` to strip surrounding quotes from env values
  - Added `[WEB SEARCH]` debug logging for easier diagnosis
  - Updated `@google/genai` SDK from 1.38.0 → 1.52.0

---

## 2026-05-03: Admin Dashboard Major Overhaul

- **What changed**: Comprehensive upgrade to Admin Management panel with 8 new features.
- **Why**: Admin panel needed better UX for user management and system monitoring.
- **Details**:
  - **Search & Filter**: Email search with rank/status dropdown filters in User Manager
  - **Self-protection**: Admin cannot modify their own rank or block themselves (disabled controls + badge)
  - **Bulk Actions**: Select multiple users + bulk set rank/block/unblock
  - **User Detail Modal**: Click email → modal with user stats (conversations, messages, joined date)
  - **Statistics Tab**: Cards showing total/active/blocked users, conversations, messages + rank distribution bar
  - **Audit Log Tab**: Admin action history viewer with color-coded events + migration hint
  - **Vercel/Supabase Quick Links**: External links to Vercel and Supabase dashboards in header
  - New API routes: `/api/admin/stats`, `/api/admin/audit-log`
  - Audit logger helper: `lib/features/admin/auditLog.ts` (writes to DB + console)
  - DB migration: `supabase/migrations/20260503_add_audit_logs.sql`
  - 35+ new bilingual translation keys
  - Docs updated: architecture.md, security.md, features.md

---

## 2026-05-03: Admin Dashboard UX + Docs Infrastructure Update

- **What changed**: Added "Back to Home" navigation button to Admin Dashboard header; updated architecture, security, and features docs with Vercel deployment and environment variable management details.
- **Why**: Admin panel had no way to navigate back to vikini.net; docs lacked documentation about where env vars and limits are managed.
- **Details**:
  - `AdminDashboard.tsx`: Added `Link` to `/` with `ArrowLeft` icon, bilingual translation
  - `config.ts`: Added `adminBackToHome` key (VN: "Trang chủ", EN: "Home")
  - `architecture.md`: New section 5 "Deployment & Infrastructure" (Vercel, env vars table, limits config)
  - `security.md`: New "Environment Variables & Secrets (Vercel)" section with security rules
  - `features.md`: Expanded Admin Dashboard section with operational boundaries table

---

## 2026-05-03: DeepSeek V4 Flash & Pro Integration

- **What changed**: Added DeepSeek V4 Flash and V4 Pro models via direct DeepSeek API.
- **Why**: Native thinking mode support (reasoning_content) requires direct API access; OpenRouter can't guarantee pass-through.
- **Details**:
  - New client: `src/lib/core/deepseekClient.ts` (OpenAI SDK with DeepSeek base URL)
  - Model registry: 2 new models (`deepseek-v4-flash`, `deepseek-v4-pro`) + legacy aliases
  - Streaming: `createDeepSeekStream` with `<think>` tag injection for thinking mode
  - Thinking mode: Maps Vikini thinkingLevel → DeepSeek reasoning_effort (high/max)
  - Error handling: 429 rate limit, 402 insufficient balance, timeout
  - Bilingual translations for both models (Vietnamese + English)
  - Environment: `DEEPSEEK_API_KEY` added to `.env.local` and `env.local.example`

---

## 2026-05-03: Docs and Agent Rules Audit + Fixes

- **What changed**: Comprehensive audit and fix of all `.agent/` and `docs/` files.
- **Why**: Multiple inconsistencies found — wrong auth docs, stale model IDs, missing Project tables/contracts.
- **Details**:
  - Fixed `security.md`: Removed incorrect `proxy.ts` reference, corrected to NextAuth v5 direct import
  - Fixed `contracts.md`: Updated model ID example, added 7 missing API endpoints, added Project/KnowledgeDocument contracts
  - Fixed `architecture.md`: Added multi-provider support, Voice features, `lib/store/`, `components/features/`
  - Fixed `database-schema.md`: Added `projects`, `knowledge_documents`, `knowledge_chunks` tables + ERD
  - Fixed `00-core.md`: Updated AI Provider list, DRY minimal diffs
  - Fixed `01-coding.md`: Standardized path convention with `src/` note
  - Fixed `02-quality.md`: Added missing domains to pre-work table, DRY bilingual section
  - Fixed `add-model.md`: Added verification note
  - Fixed `debug.md`: Converted from custom XML to pure Markdown
  - Populated `lessons-learned.md` with retroactive entries
  - Backfilled CHANGELOG with major milestones

## 2026-05-03: Rules and Docs Restructure

- **What changed**: Complete restructure of `.agent/rules/`, `.agent/skills/`, `.agent/workflows/`, and `docs/`.
- **Why**: Previous system had overlapping content, rules too long for context budget, missing enforcement protocols.
- **Details**:
  - Rules rewritten: 5 focused files (00-core, 01-coding, 02-quality, 03-ui, 04-bilingual)
  - Skills created: api-patterns, add-model, add-translation
  - Workflows updated: post-fix (with test enforcement), debug (renamed), audit (new)
  - Docs: context.md rewritten, api-reference.md merged into contracts.md, lessons-learned.md created, CHANGELOG.md created
  - Deleted: testing.md (generic tutorial), add-new-models.md (moved to skill)

## 2026-02: Projects & Knowledge Base

- **What changed**: Full Project system with per-project Knowledge Base (RAG).
- **Details**:
  - 3 new DB tables: `projects`, `knowledge_documents`, `knowledge_chunks` (pgvector)
  - Auto-chunking + embedding via `text-embedding-004` / `gemini-embedding-001`
  - RAG similarity search via `match_project_knowledge()` PostgreSQL function
  - Project CRUD, KB document upload/delete, ChatGPT-style project view

## 2026-01: Image Studio & Gallery

- **What changed**: Multi-provider AI image generation + gallery management.
- **Details**:
  - Image Studio: Gemini Imagen 3, DALL-E 3, Flux Pro (BYOK)
  - Style presets, aspect ratio controls, prompt enhancement
  - Gallery: infinite scroll, search, filter, lightbox, image compare
  - Routes: `/image-studio`, `/gallery`

## 2025-12: Enhanced Streaming UX

- **What changed**: Professional streaming experience matching ChatGPT/Gemini quality.
- **Details**:
  - Typewriter buffer (333 chars/s drain rate)
  - Smart auto-scroll with user scroll detection
  - ThinkingBlock animation for Gemini 3 thinking mode
  - Typing cursor, message entry animations
  - Deep thinking extended timeouts

## 2025-11: Core Chat & GEMs System

- **What changed**: Foundation chat system with AI personas.
- **Details**:
  - SSE streaming with Gemini AI
  - Conversation CRUD + auto-title + URL sync
  - GEMs system with versioning
  - File attachments (upload, parse, 36h TTL)
  - Message encryption (AES-256-GCM)
  - Rate limiting via Upstash Redis
  - Admin dashboard, Google OAuth, bilingual UI
