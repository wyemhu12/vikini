# Kế Hoạch Triển Khai: Remake Hệ Thống Rules, Subagents, Hooks, Workflows & Skills (Vikini Governance 2.0 - Phương án A)

- **Revision**: 3
- **Status**: Approved
- **Date**: 2026-10-19
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### 1.1. Mục Tiêu (Goal)

Tái cấu trúc toàn diện hệ thống quản trị AI Agent của dự án **Vikini** (`.agents/`, `scripts/`, `docs/`) theo **Phương án A (Vikini Governance 2.0 — Clean Progressive Disclosure & Hardened Guard)** đã được đối chiếu độc lập bởi Claude Code CLI và tài liệu chính thức Google Antigravity tháng 10/2026 (`v2.24.0`), nhằm giải quyết triệt để 4 trụ cột:

1. **Chuẩn hóa Schema YAML Frontmatter, Model Roster Tháng 10/2026 & Khử Tự Đọc Thừa Cho Subagents (`.agents/agents/`)**:
   - Đổi `model: gemini-4-argon` / `model: claude-4.6-opus` sang giá trị hợp lệ `model: pro` của Antigravity 2026 và xóa trường `role:` không chuẩn trong YAML frontmatter của `.agents/agents/planner/agent.md`, `.agents/agents/reviewer/agent.md`, và `.agents/agents/qa/agent.md`.
   - **Xóa sổ hoàn toàn `claude-4.6-opus` và `Gemini 3.1 Pro`** trên toàn bộ `.agents/` theo `[URL]` `https://antigravity.google/docs/models.md` (tháng 10/2026 — `Claude Opus 4.6` và `Claude Sonnet 4.6` đã bị loại bỏ khỏi Google AI Ultra / Enterprise và ngừng hoạt động hoàn toàn vào 02/11/2026):
     - Chuẩn hóa bộ 4 model chủ lực trên toàn hệ thống `.agents/`: **`Gemini 4 Argon`** (`gemini-4-argon`), **`Gemini 3.8 Flash`** (`gemini-3.8-flash`), **`Claude Opus 5.5 (thinking)`** (`claude-opus-5-5`), và **`Claude Sonnet 5.5 (thinking)`** (`claude-sonnet-5-5`).
     - Trong `.agents/agents/qa/agent.md:131-137`: thay thế hoàn toàn `claude-4.6-opus` bằng `claude-opus-5-5` (`Claude Opus 5.5 (thinking)`) làm model mặc định (`[QA_MODEL: claude-opus-5-5]`) với fallback là `gemini-4-argon` (`[FALLBACK_MODEL: gemini-4-argon]`).
     - Trong `.agents/rules/01-coding.md:93`: đổi `(Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro)` thành `(Gemini 4 Argon, Claude Opus 5.5, Claude Sonnet 5.5, Gemini 3.8 Flash)`.
   - **Loại bỏ lệnh tự đọc dư thừa ở Bước 0**:
     - Theo Antigravity Changelog `v2.19.1` (30/09/2026 — _"Fixed an issue where custom agents ignored your global and project rules"_) và `subagents.md`, custom subagents đã tự động nhận nội dung `agent.md` làm system prompt VÀ tự động kế thừa toàn bộ project rules (`always_on`).
     - Do đó, tại Bước 0 của `.agents/agents/planner/agent.md:30`, loại bỏ hoàn toàn yêu cầu gọi `view_file` đọc lại `.agents/agents/planner/agent.md` **và** `.agents/rules/02-quality.md` (Planner chỉ cần khảo sát trực tiếp các file mã nguồn/tài liệu liên quan đến task và đọc `SKILL.md` theo bảng Pre-Work Protocol đã có sẵn trong context `always_on`).
     - Tại Bước 0 của `.agents/agents/reviewer/agent.md:39`, loại bỏ mục tự đọc `.agents/agents/reviewer/agent.md` (chỉ đọc 3 file vệ tinh `allowlist.md`, `evidence-bar.md`, `mental-simulation.md` và các `SKILL.md` liên quan).
   - Thu gọn `.agents/agents/reviewer/agent.md` từ `9,779 chars` (`11,602 bytes` — sát ngưỡng trần `10,000 chars`) xuống `< 7,500 chars`.
   - Thu hồi quyền `write_to_file` khỏi danh sách `tools:` của `.agents/agents/reviewer/agent.md` (chỉ giữ `replace_file_content` để Reviewer chỉ được phép sửa/append vào file kế hoạch đã tồn tại tại `docs/plans/*.md`, giữ nguyên `list_dir`, `find_by_name`, `grep_search`).

2. **Tối Ưu Context Engineering & Progressive Disclosure Cho `.agents/rules/`**:
   - Giảm tổng dung lượng `always_on` rules từ `34,912 chars` (`37,423 bytes`) xuống `< 18,000 chars` (giảm ~50% tải ngữ cảnh mặc định mọi turn):
     - Giữ `trigger: always_on` cho 3 file cốt lõi: `.agents/rules/00-core.md` (`~4,500 chars`), `.agents/rules/02-quality.md` (`~6,000 chars`), `.agents/rules/05-plan-review.md` (`~6,000 chars`).
     - Chuyển `.agents/rules/01-coding.md` từ `trigger: always_on` sang `trigger: glob` với `globs: "*.ts, *.tsx, *.js, *.mjs"` (đồng thời cập nhật danh sách model tại dòng 93). Tích hợp bản tóm tắt **Core Coding & Testing Invariants** (~1,000 ký tự: cấm `any`, dùng `unknown` narrowing, cấm `console.log`, bắt buộc co-located `*.test.ts` cho `src/lib/core/`, `src/lib/features/`, `.agents/scripts/`, giới hạn 150–400 dòng/file) vào `.agents/rules/00-core.md` để `@planner` và `@reviewer` vẫn nắm đầy đủ chuẩn code khi chỉ đọc file `.md`.
     - Chuyển `.agents/rules/03-ui.md` từ `trigger: model_decision` sang `trigger: glob` với `globs: "*.tsx, *.css"`, tích hợp các quy tắc cốt lõi của `.agents/rules/04-bilingual.md` vào `.agents/rules/03-ui.md` và sửa đường dẫn sai trong `.agents/rules/04-bilingual.md` (`lib/utils/translations/` ➔ `src/lib/utils/translations/`).
     - Chuẩn hóa quy tắc Git trong `.agents/rules/00-core.md`: phân biệt rõ **BANNED mutating git commands** (`add`, `commit`, `push`, `checkout`, `switch`, `branch`, `reset`, `stash`, `merge`, `rebase`) và **ALLOWED read-only git inspection** (`git status`, `git diff`, `git log -n <N>`, `git show`, `git blame`), đồng bộ 100% với `.agents/scripts/code-freeze-guard.js`.

3. **Gia Cố Bảo Mật `.agents/scripts/code-freeze-guard.js`, `.agents/hooks.json`, Allowlist & Unit Tests**:
   - Vá lỗ hổng **Stale/Completed Plan Unlock** trong `isPlanApproved()`: thay thế cơ chế blacklist (`isPending`) bằng **status whitelist** nghiêm ngặt trên 30 dòng Header đầu tiên (`/^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Approved\s*$/im`) kết hợp kiểm tra dòng văn bản cuối cùng khớp chính xác `lastLine === "[PLAN_APPROVED]"` (loại bỏ `lastLine.endsWith("[PLAN_APPROVED]")`). Khi task hoàn tất và chuyển sang `- **Status**: Completed`, repo tự động khóa lại cho task tiếp theo.
   - Bổ sung **Self-Forgery Guard** tại Gate 3 (`docs/plans/`) trong `decide()`: khi `input.toolName === "write_to_file"` nhắm vào `docs/plans/`, nếu nội dung mới có Header `Status: Approved` ở 30 dòng đầu HOẶC dòng không rỗng cuối cùng là `[PLAN_APPROVED]`, lập tức trả về `ask(...)` để chặn hành vi tạo mới/ghi đè toàn bộ file kế hoạch đã gắn sẵn thẻ phê duyệt (nhưng vẫn cho phép `write_to_file` tạo kế hoạch hợp lệ có nhắc tới chuỗi `[PLAN_APPROVED]` bên trong thân bài).
   - Thu hẹp regex `claude` trong `READ_ONLY_COMMANDS` của `.agents/scripts/code-freeze-guard.js` từ `/^claude(?:\.exe)?(?:\s+.*)?$/` (cho phép mọi tham số) xuống chỉ cho phép các cờ kiểm tra read-only (`/^(?:claude(?:\.exe)?)\s+(?:--version|-v|--help|-h|-p\s+["']?ping["']?)$/i`), ngăn chặn gọi trực tiếp `claude --permission-mode bypassPermissions` ngoài `.agents/scripts/run-claude.ps1`.
   - Bổ sung `node scripts/verify-docs.mjs` (cùng các cờ `--strict-shorthand`, `--expected-headings=<N>`) vào `READ_ONLY_COMMANDS` trong `.agents/scripts/code-freeze-guard.js`.
   - Bổ sung `multi_replace_file_content` vào `matcher` trong `.agents/hooks.json`.
   - Đồng bộ `.agents/agents/reviewer/allowlist.md` và `.agents/agents/reviewer/evidence-bar.md` với `.agents/scripts/code-freeze-guard.js` (loại bỏ các lệnh mẫu dùng pipe `| npx eslint --stdin` và `node -e` / `npx tsx -e` vốn bị guard chặn).
   - Bổ sung bộ unit test co-located trong `.agents/scripts/code-freeze-guard.test.ts` kiểm chứng đầy đủ các cơ chế mới.

4. **Hợp Nhất `.agents/workflows/` Vào `.agents/skills/`, Xử Lý Doc Drift & Đưa `scripts/verify-docs.mjs` Về PASS 5/5**:
   - Chuyển đổi `.agents/workflows/debug.md` + `.agents/workflows/post-fix.md` thành `.agents/skills/vikini-debug/SKILL.md` và `.agents/workflows/audit.md` thành `.agents/skills/vikini-audit/SKILL.md`; xóa thư mục `.agents/workflows/`.
   - Cập nhật `.gitignore` để bỏ chặn (`!`) đầy đủ cho các thư mục skill mới (`vikini-debug`, `vikini-audit`, `animation-vocabulary`, `emil-design-eng`, `review-animations`) và thêm `.agents/.plan-approved` vào danh sách ignore.
   - Sửa toàn bộ doc drift:
     - `.agents/skills/add-model/SKILL.md`: sửa đường dẫn `lib/core/modelRegistry.ts` (dòng 12, 28) thành `src/lib/core/modelRegistry.ts` và `lib/utils/config.ts` (dòng 37) thành `src/lib/utils/translations/vi.ts` cùng `src/lib/utils/translations/en.ts`.
     - `.agents/skills/add-translation/SKILL.md`: sửa đường dẫn `lib/utils/translations/` (dòng 12, 25, 31) thành `src/lib/utils/translations/`.
     - `.agents/rules/02-quality.md` và `.agents/skills/README.md`: chuẩn hóa tham chiếu auth từ `requireUser()` sang `await auth()` + `UnauthorizedError` (kèm chú thích helper nội bộ `requireUser()` tại `src/app/api/conversations/auth.ts`).
     - `.agents/README.md`: cập nhật bảng Rules Catalog (Section 2), bổ sung `@qa` (Primary `claude-opus-5-5` / Fallback `gemini-4-argon`) vào bảng Model Routing (Section 4.1) và đồng bộ toàn bộ tên model theo chuẩn tháng 10/2026 (`gemini-4-argon`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`).
     - `.agents/scripts/claude-planner-prompt.md` và `docs/lessons-learned.md`: cập nhật tham chiếu từ `.agents/workflows/debug.md` / `/post-fix workflow` sang `.agents/skills/vikini-debug/SKILL.md`.
   - Lưu trữ (archive) 32 mục changelog cũ (`<= 2026-10-15`, dòng 122–847) từ `docs/CHANGELOG.md` (`130,991 bytes`, 38 headings) sang đầu danh sách entries trong `docs/archive/CHANGELOG-legacy.md` (74 headings; đồng thời cập nhật dòng ghi chú mốc ngày lưu trữ tại `docs/CHANGELOG.md:7` và `docs/archive/CHANGELOG-legacy.md:3` sang `2026-10-15`) để dung lượng `docs/CHANGELOG.md` giảm xuống `~28,000 bytes` (`< 35,000 bytes`, còn 7 headings sau khi thêm 1 mục mới + 106 headings trong archive = 113 headings), giúp `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113` đạt **PASS 5/5 checks (`exit 0`)**.

#### 1.2. Out of Scope (What We're NOT Doing)

- **KHÔNG** thay đổi bất kỳ mã nguồn runtime hay logic nghiệp vụ nào trong `src/app/`, `src/lib/`, hoặc `src/components/`.
- **KHÔNG** gộp 3 file vệ tinh của Reviewer (`.agents/agents/reviewer/allowlist.md`, `.agents/agents/reviewer/evidence-bar.md`, `.agents/agents/reviewer/mental-simulation.md`) vào 1 file duy nhất (giữ nguyên kiến trúc 3 file tách biệt theo Phương án A để bảo toàn tính cô lập của từng quy chuẩn).
- **KHÔNG** xóa file `.agents/rules/04-bilingual.md` (giữ lại file với đường dẫn đã sửa để không làm gãy liên kết lịch sử, đồng thời tích hợp quy tắc cốt lõi vào `.agents/rules/03-ui.md`).
- **KHÔNG** cài đặt thêm hoặc nâng cấp bất kỳ dependency nào trong `package.json`.
- **KHÔNG** sửa đổi nội dung lịch sử trong `docs/plans/2026-*.md` của các task trước (ngoại trừ việc cập nhật dòng trạng thái `- **Status**: Completed` ở Header của `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` ở bước cuối cùng).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### 2.1. Bảng Tài Liệu Đã Đọc (Pre-Work Reading)

| Tài liệu / File                                              | Trạng thái | Ghi chú & Phát hiện chính                                                                                                                                                                                                                                                                                                                                                 |
| :----------------------------------------------------------- | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/rules/00-core.md`                                   |   Đã đọc   | `3,543 chars`. Chứa mâu thuẫn quy tắc Git (cấm mọi lệnh git ở dòng 42, 55 nhưng `code-freeze-guard.js:62` cho phép git read-only).                                                                                                                                                                                                                                        |
| `.agents/rules/01-coding.md`                                 |   Đã đọc   | `9,576 chars`. Đang để `trigger: always_on`; dòng 93 còn liệt kê model cũ `Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro`.                                                                                                                                                                                                                                        |
| `.agents/rules/02-quality.md`                                |   Đã đọc   | `11,044 chars`. Tham chiếu `.agents/workflows/` tại 5 vị trí: dòng 19 (`debug.md`), dòng 30 (`audit.md`), dòng 41 (`.agents/workflows/`), dòng 99 (`audit.md`), dòng 140 (`debug.md`); và `requireUser()` tại dòng 108.                                                                                                                                                   |
| `.agents/rules/03-ui.md`                                     |   Đã đọc   | `6,034 bytes`. Đang để `trigger: model_decision`, chưa tự động kích hoạt theo glob `*.tsx, *.css`.                                                                                                                                                                                                                                                                        |
| `.agents/rules/04-bilingual.md`                              |   Đã đọc   | `1,724 bytes`. Dòng 14 ghi sai đường dẫn `lib/utils/translations/` (thiếu tiền tố `src/`).                                                                                                                                                                                                                                                                                |
| `.agents/rules/05-plan-review.md`                            |   Đã đọc   | `10,749 chars`. Dòng 60 cấp `write_to_file` cho `@reviewer`; chưa quy định bước chuyển `Status: Completed` để khóa lại repo sau khi xong task.                                                                                                                                                                                                                            |
| `.agents/agents/planner/agent.md`                            |   Đã đọc   | `10,562 bytes`. Dòng 4–5 dùng `model: gemini-4-argon` và `role:`; dòng 30 bắt tự đọc lại `planner/agent.md` và `02-quality.md` (dư thừa từ Antigravity v2.19.1); dòng 57 trỏ vào `.agents/workflows/debug.md`.                                                                                                                                                            |
| `.agents/agents/reviewer/agent.md`                           |   Đã đọc   | `9,779 chars` (`11,602 bytes` — 97.8% ngưỡng trần `10,000 chars`). Dòng 4–5 sai schema YAML; dòng 16 cấp thừa `write_to_file`; dòng 39 bắt tự đọc lại `reviewer/agent.md`; dòng 82 gợi ý `node -e` / `npx tsx -e`.                                                                                                                                                        |
| `.agents/agents/reviewer/allowlist.md`                       |   Đã đọc   | Dòng 19 gợi ý pipe `\| npx eslint --stdin`; dòng 22–25 gợi ý `node -e` và `npx tsx -e` (đều bị `code-freeze-guard.js` chặn).                                                                                                                                                                                                                                              |
| `.agents/agents/reviewer/evidence-bar.md`                    |   Đã đọc   | Dòng 21 gợi ý `node -e` / `npx tsx -e`; dòng 49 gợi ý pipe `\| npx eslint --stdin`.                                                                                                                                                                                                                                                                                       |
| `.agents/agents/reviewer/mental-simulation.md`               |   Đã đọc   | 63 dòng, chuẩn xác, không có drift.                                                                                                                                                                                                                                                                                                                                       |
| `.agents/agents/qa/agent.md`                                 |   Đã đọc   | Dòng 4–5 dùng `model: claude-4.6-opus` và `role:` không hợp lệ trong YAML frontmatter; dòng 133 dùng model đã ngừng hỗ trợ `claude-4.6-opus` (thay bằng `claude-opus-5-5`).                                                                                                                                                                                               |
| `.agents/hooks.json`                                         |   Đã đọc   | Dòng 5 `matcher` thiếu `multi_replace_file_content`.                                                                                                                                                                                                                                                                                                                      |
| `.agents/scripts/code-freeze-guard.js`                       |   Đã đọc   | 726 dòng (ES Module). Lỗ hổng `isPlanApproved()` (dòng 176–236), thiếu Self-Forgery Guard tại Gate 3 (dòng 464–470), regex `claude` quá rộng (dòng 64), thiếu `node scripts/verify-docs.mjs` trong `READ_ONLY_COMMANDS` (dòng 51–65).                                                                                                                                     |
| `.agents/scripts/code-freeze-guard.test.ts`                  |   Đã đọc   | 987 dòng, 92 unit tests đang pass (`npx vitest run .agents/scripts/code-freeze-guard.test.ts`).                                                                                                                                                                                                                                                                           |
| `.agents/scripts/run-claude.ps1`                             |   Đã đọc   | 196 dòng. Wrapper PowerShell điều phối Claude Code CLI cho Planner và Fallback Reviewer.                                                                                                                                                                                                                                                                                  |
| `.agents/scripts/claude-planner-prompt.md`                   |   Đã đọc   | 84 dòng. Dòng 20 thiếu liệt kê `vikini-debug`, `vikini-audit`, `add-model`; dòng 64 tham chiếu `.agents/workflows/debug.md`.                                                                                                                                                                                                                                              |
| `.agents/scripts/claude-reviewer-prompt.md`                  |   Đã đọc   | 52 dòng. Chuẩn xác, đồng bộ với quy tắc `Status: Approved` và `[PLAN_APPROVED]`.                                                                                                                                                                                                                                                                                          |
| `.agents/workflows/*.md`                                     |   Đã đọc   | `debug.md` (54 dòng), `post-fix.md` (39 dòng), `audit.md` (55 dòng) — sẽ hợp nhất vào `.agents/skills/vikini-debug/SKILL.md` và `.agents/skills/vikini-audit/SKILL.md`.                                                                                                                                                                                                   |
| `scripts/verify-docs.mjs`                                    |   Đã đọc   | 303 dòng (ES Module). Kiểm tra 5 cổng chất lượng tài liệu (`[1/5]` Path Existence, `[2/5]` Zero Legacy Refs, `[3/5]` Strict Shorthand, `[4/5]` Character Limits, `[5/5]` CHANGELOG Size & Headings Integrity); hiện đang FAIL ở cổng `[5/5]` do `docs/CHANGELOG.md` vượt trần `35,000 bytes` (`130,991 bytes`).                                                           |
| `docs/CHANGELOG.md` & `docs/archive/CHANGELOG-legacy.md`     |   Đã đọc   | `docs/CHANGELOG.md` có 38 headings (`130,991 bytes`); `docs/archive/CHANGELOG-legacy.md` có 74 headings (`106,402 bytes`). Tổng cộng 112 headings hiện hữu (113 headings sau khi thêm mục changelog của task này).                                                                                                                                                        |
| `https://antigravity.google/docs/models.md` & `changelog.md` |   Đã đọc   | `Claude Opus 4.6` & `Claude Sonnet 4.6` bị loại bỏ khỏi Ultra/Enterprise và ngừng hoạt động 02/11/2026; bộ 4 model chủ lực là `Gemini 4 Argon`, `Gemini 3.8 Flash`, `Claude Opus 5.5 (thinking)`, `Claude Sonnet 5.5 (thinking)`. Bản `v2.19.1` đã sửa lỗi custom agents bỏ qua project rules; `v2.24.0` bổ sung `/compact` và chọn model `Flash Lite` / `Flash` / `Pro`. |

#### 2.2. Bảng Skills Loaded & Applied

| Skill (`SKILL.md` đã đọc bằng `view_file`)   | Lý do kích hoạt theo `.agents/rules/02-quality.md`                                                                                                           | Quyết định kỹ thuật chịu ảnh hưởng trực tiếp trong Kế hoạch                                                                                                                                                                                                                                                                                                                                                           |
| :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` | Khảo sát kiến trúc tổng thể hệ thống `.agents/`, `scripts/`, `docs/` trước khi tái cấu trúc.                                                                 | Áp dụng quy trình đối chiếu chéo toàn bộ callers/references của `.agents/workflows/`, `isPlanApproved()`, model names (`claude-4.6-opus`, `Gemini 3.1 Pro`) và `verify-docs.mjs` (phát hiện đủ 5 tham chiếu trong `.agents/rules/02-quality.md:19,30,41,99,140`, `.agents/scripts/claude-planner-prompt.md:64`, `.agents/rules/01-coding.md:93`, `.agents/agents/qa/agent.md:4,133`, và `docs/lessons-learned.md:5`). |
| `.agents/skills/vikini-simplify/SKILL.md`    | Tinh giản hệ thống Rules & Subagents (Subtract Before You Add) để giảm tải ngữ cảnh `always_on`.                                                             | Loại bỏ bước tự đọc lại chính mình và `02-quality.md` ở Bước 0 của `@planner` (nhờ bản vá kế thừa project rules ở Antigravity `v2.19.1`) và loại bỏ tự đọc `reviewer/agent.md` ở Bước 0 của `@reviewer`; thu gọn `.agents/agents/reviewer/agent.md` xuống `< 7,500 chars`; chuyển `01-coding.md` và `03-ui.md` sang `trigger: glob`; hợp nhất `.agents/workflows/` vào `.agents/skills/`.                             |
| `.agents/skills/api-patterns/SKILL.md`       | Đối chiếu chuẩn xác thực API route thực tế của dự án để xử lý doc drift trong `.agents/rules/02-quality.md` và `.agents/skills/README.md`.                   | Xác nhận chuẩn xác thực chuẩn của dự án là `await auth()` kết hợp `UnauthorizedError` (`.agents/skills/api-patterns/SKILL.md:49-50`), trong khi `requireUser()` chỉ là helper cục bộ tại `src/app/api/conversations/auth.ts:25`. Cập nhật `.agents/rules/02-quality.md:108` và `.agents/skills/README.md:17,47` khớp thực tế.                                                                                         |
| `.agents/skills/add-model/SKILL.md`          | Kiểm tra tính chính xác của skill vừa tạo trong working tree.                                                                                                | Phát hiện dòng 12 và 28 của `.agents/skills/add-model/SKILL.md` thiếu tiền tố `src/` (`lib/core/modelRegistry.ts`), và dòng 37 trỏ tới file không tồn tại `lib/utils/config.ts`. Đưa vào kế hoạch sửa thành `src/lib/core/modelRegistry.ts` và `src/lib/utils/translations/{vi,en}.ts`.                                                                                                                               |
| `.agents/skills/add-translation/SKILL.md`    | Đối chiếu kiến trúc đa ngôn ngữ thực tế khi cập nhật `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md` và `.agents/skills/add-translation/SKILL.md`. | Xác nhận đường dẫn cấu hình ngôn ngữ chính xác là `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`, và `src/lib/utils/translations/index.ts` (`[SRC]` `src/lib/utils/translations/index.ts:1-35`). Sửa cả `.agents/rules/04-bilingual.md:14` và `.agents/skills/add-translation/SKILL.md:12,25,31`.                                                                                             |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1. Giả Định Kỹ Thuật Đã Kiểm Chứng (Verified Assumptions)

1. **Hành vi nạp System Prompt & Kế thừa Project Rules của Antigravity Subagents (`v2.19.1+`)**:
   - **Giả định**: Khi Antigravity khởi chạy một subagent từ `.agents/agents/<name>/agent.md`, phần thân Markdown bên dưới YAML frontmatter được tiêm trực tiếp làm system prompt của subagent đó, VÀ kể từ bản `v2.19.1` (30/09/2026), custom subagents tự động kế thừa toàn bộ global và project rules (`always_on`).
   - **Dẫn chứng**: `[URL]` `https://antigravity.google/docs/subagents.md` ("The markdown body below the frontmatter becomes the subagent's system prompt") và `[URL]` `https://antigravity.google/changelog.md` (`v2.19.1`: _"Fixed an issue where custom agents ignored your global and project rules"_). Do đó, việc bắt `@planner` gọi `view_file` đọc lại `.agents/agents/planner/agent.md` và `.agents/rules/02-quality.md` (vốn là `always_on`) ở Bước 0 là dư thừa 100%.
2. **Cú pháp `trigger: glob` trong `.agents/rules/*.md`**:
   - **Giả định**: Antigravity hỗ trợ `trigger: glob` kèm thuộc tính `globs: "*.ts, *.tsx, *.js, *.mjs"` (chuỗi phân tách bằng dấu phẩy, bọc trong dấu ngoặc kép khi bắt đầu bằng `*`).
   - **Dẫn chứng**: `[URL]` `https://antigravity.google/docs/rules.md` ("File-pattern matching (`glob`): Activates automatically when working with files matching the specified `globs` pattern... Important: Always quote glob patterns starting with `*` in YAML frontmatter").
3. **Cơ chế hoạt động của `scripts/code-freeze-guard.js` ở cấp Root**:
   - **Giả định**: `.agents/hooks.json` gọi `node ./scripts/code-freeze-guard.js`, là một file proxy 7 dòng (ES Module) import trực tiếp `../.agents/scripts/code-freeze-guard.js`.
   - **Dẫn chứng**: `[SRC]` `scripts/code-freeze-guard.js:1-7` và `.agents/hooks.json:7`. Mọi chỉnh sửa logic và export hàm (`export function`) phục vụ unit test đều thực hiện tại `.agents/scripts/code-freeze-guard.js`.
4. **Cơ chế kiểm tra cổng `[4/5]` và `[5/5]` của `scripts/verify-docs.mjs`**:
   - **Giả định**:
     - Cổng **`[4/5]`** (`scripts/verify-docs.mjs:197-231`) kiểm tra giới hạn ký tự Governance (`.agents/rules/*.md <= 12,000 chars` và `.agents/agents/*/agent.md <= 10,000 chars`).
     - Cổng **`[5/5]`** (`scripts/verify-docs.mjs:233-296`) kiểm tra kích thước `docs/CHANGELOG.md` (`currentBytes < 35000`) và bảo toàn tổng số dòng bắt đầu bằng `## ` trên cả 2 file `docs/CHANGELOG.md` + `docs/archive/CHANGELOG-legacy.md`. Mặc định `expectedHeadings = null`; khi truyền cờ `--expected-headings=<N>`, dòng 274 kiểm tra **so sánh bằng nghiêm ngặt** (`totalHeadings !== expectedHeadings`). Nếu toàn bộ 5 cổng đạt chuẩn, dòng 301 in ra `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<` và thoát với `exit 0`.
   - **Dẫn chứng**: `[SRC]` `scripts/verify-docs.mjs:197-302`. Hiện tại `docs/CHANGELOG.md` có **38** headings (6 mục từ `2026-10-16` đến `2026-10-19` và 32 mục từ `2026-09-10` đến `2026-10-15`) và `docs/archive/CHANGELOG-legacy.md` có **74** headings (tổng = **112**). Khi di chuyển 32 mục cũ (`<= 2026-10-15`, dòng 122–847) từ `docs/CHANGELOG.md` sang `docs/archive/CHANGELOG-legacy.md` và thêm 1 mục changelog mới của task này vào đầu `docs/CHANGELOG.md`, số lượng headings sẽ là `7` (current) + `106` (legacy) = **113** (`--expected-headings=113`), và dung lượng `docs/CHANGELOG.md` giảm từ `130,991 bytes` xuống `< 35,000 bytes`, vượt qua cả cổng `[4/5]` lẫn `[5/5]`.

#### 3.2. Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies) & Thứ Tự Thời Gian (`mtimeMs`)

- **Tương tác với các thay đổi chưa commit từ task trước (`2026-10-19-vitest-upgrade-and-add-model-skill`)**:
  - Qua kiểm chứng `[CMD]` `git status`, working tree hiện có các thay đổi chưa commit từ task nâng cấp Vitest & tạo skill `add-model`: `.agents/skills/add-model/SKILL.md`, `.agents/skills/README.md`, `.gitignore`, `docs/CHANGELOG.md`, `package.json`, `package-lock.json`.
  - Kế hoạch này **tương thích hoàn toàn và nối tiếp trực tiếp** trên trạng thái working tree hiện tại:
    1. Giữ nguyên mục `add-model` đã có trong `.agents/skills/README.md` và `.gitignore`, chỉ bổ sung thêm `vikini-debug`, `vikini-audit`, `animation-vocabulary`, `emil-design-eng`, `review-animations` và sửa lỗi đường dẫn tại `.agents/skills/add-model/SKILL.md:12,28,37`.
    2. Giữ nguyên mục changelog `## 2026-10-19: Maintenance -- Vitest 4.1.12 & add-model SKILL.md` ở đầu `docs/CHANGELOG.md` (`[SRC]` `docs/CHANGELOG.md:11-19`), chỉ archive các mục cũ từ `## 2026-10-15` trở về trước (dòng 122–847) sang `docs/archive/CHANGELOG-legacy.md`.
    3. **Kiểm soát thứ tự `mtimeMs` khi đóng trạng thái `Completed`**: Theo `[SRC]` `.agents/scripts/code-freeze-guard.js:201-205`, `isPlanApproved()` sắp xếp `docs/plans/*.md` theo `mtimeMs` giảm dần và chỉ kiểm tra `entries[0]`. Do đó, trong suốt quá trình thực thi Bước 1–5, **TUYỆT ĐỐI KHÔNG** chạm vào `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` để giữ cho `docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md` (`Status: Approved`) luôn là `entries[0]`. Chỉ ở thao tác cuối cùng của Bước 5 (sau khi mọi chỉnh sửa và lệnh verify đã hoàn tất), mới cập nhật `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` sang `- **Status**: Completed` trước, rồi cập nhật `docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md` sang `- **Status**: Completed` sau cùng (kèm cập nhật bảng tại `docs/plans/README.md`).

---

### 4. Bảng Verified Versions (2026)

| Công nghệ / Thành phần                      | Phiên bản / Chuẩn                                                                            | Nguồn kiểm chứng (`[SRC]` / `[URL]`)                                                                     | Ghi chú áp dụng                                                                                                                                                                                                         |
| :------------------------------------------ | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Antigravity Platform & Changelog** | `v2.24.0` (15/10/2026) & `v2.19.1` (30/09/2026)                                              | `[URL]` `https://antigravity.google/changelog.md`                                                        | `v2.19.1` sửa lỗi custom agents bỏ qua project rules (tự động kế thừa `always_on` rules); `v2.24.0` bổ sung lệnh `/compact` và chọn model tier (`Flash Lite`, `Flash`, `Pro`).                                          |
| **Google Antigravity Models Roster**        | Tháng 10/2026 (`Gemini 4 Argon`, `Gemini 3.8 Flash`, `Claude Opus 5.5`, `Claude Sonnet 5.5`) | `[URL]` `https://antigravity.google/docs/models.md`                                                      | `Claude Opus 4.6` & `Claude Sonnet 4.6` đã bị loại khỏi Ultra/Enterprise và ngừng hoạt động 02/11/2026. Chuẩn hóa toàn bộ `.agents/` sang `gemini-4-argon`, `gemini-3.8-flash`, `claude-opus-5-5`, `claude-sonnet-5-5`. |
| **Google Antigravity Subagents**            | Schema 2026 (`model: inherit \| flash_lite \| flash \| pro`)                                 | `[URL]` `https://antigravity.google/docs/subagents.md`                                                   | YAML frontmatter hợp lệ: `name`, `description`, `tools`, `model` (`pro`), `subagent`. Không dùng `role:` hay tên model nội bộ trong YAML.                                                                               |
| **Google Antigravity Rules**                | Schema 2026 (`always_on`, `manual`, `model_decision`, `glob`)                                | `[URL]` `https://antigravity.google/docs/rules.md`                                                       | Trần 24,000 bytes/file; ngân sách `always_on` toàn cục 20,000 tokens; `globs` phải đặt trong ngoặc kép nếu bắt đầu bằng `*`.                                                                                            |
| **Google Antigravity Hooks**                | Schema 2026 (`PreToolUse`, exit `0` JSON `allow`/`deny`/`ask`, exit `2` block)               | `[URL]` `https://antigravity.google/docs/hooks.md`                                                       | Hỗ trợ regex `matcher` cho tên công cụ (`write_to_file\|replace_file_content\|multi_replace_file_content\|run_command`).                                                                                                |
| **Google Antigravity Skills**               | Schema 2026 (`.agents/skills/<name>/SKILL.md`)                                               | `[URL]` `https://antigravity.google/docs/skills.md`                                                      | Progressive disclosure: chỉ nạp `name` + `description` lúc khởi động, nạp thân `SKILL.md` khi kích hoạt.                                                                                                                |
| **Vitest**                                  | `^4.1.12`                                                                                    | `[SRC]` `package.json:117`                                                                               | Chạy unit test cho `.agents/scripts/code-freeze-guard.test.ts`.                                                                                                                                                         |
| **TypeScript**                              | `^5.9.3`                                                                                     | `[SRC]` `package.json:115`                                                                               | Kiểm tra `npm run type-check` (`tsc --noEmit`, bao gồm `// @ts-check` trên `.agents/scripts/code-freeze-guard.js`).                                                                                                     |
| **ESLint**                                  | `^9.39.2`                                                                                    | `[SRC]` `package.json:101`                                                                               | Kiểm tra `npm run lint` (bao gồm `.agents/scripts/`).                                                                                                                                                                   |
| **Node.js ES Modules (ESM)**                | `24.x`                                                                                       | `[SRC]` `package.json:120`, `.agents/scripts/code-freeze-guard.js:21-25`, `scripts/verify-docs.mjs:1-15` | Cả `.agents/scripts/code-freeze-guard.js`, `scripts/code-freeze-guard.js` và `scripts/verify-docs.mjs` đều sử dụng chuẩn **ES Modules (`import` / `export function`)**.                                                 |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### `[NEW]` Tạo Mới (2 files)

1. `.agents/skills/vikini-debug/SKILL.md` — Hợp nhất nội dung từ `.agents/workflows/debug.md` (`/debug`: quy trình 5 bước điều tra root-cause, 3-strike Circuit Breaker) và `.agents/workflows/post-fix.md` (`/post-fix`: chạy `npm run verify`, ghi `docs/lessons-learned.md`, cập nhật `docs/CHANGELOG.md`).
2. `.agents/skills/vikini-audit/SKILL.md` — Chuyển đổi nội dung từ `.agents/workflows/audit.md` (`/audit`: quy trình 5 bước kiểm toán kiến trúc, code discipline, UI tokens, bilingual, và báo cáo `[CRITICAL]`/`[WARNING]`/`[INFO]`).

#### `[DELETE]` Xóa Bỏ (3 files)

1. `.agents/workflows/debug.md` — Đã chuyển sang `.agents/skills/vikini-debug/SKILL.md`.
2. `.agents/workflows/post-fix.md` — Đã chuyển sang `.agents/skills/vikini-debug/SKILL.md`.
3. `.agents/workflows/audit.md` — Đã chuyển sang `.agents/skills/vikini-audit/SKILL.md`.

#### `[MODIFY]` Chỉnh Sửa (26 files)

1. `.agents/agents/planner/agent.md` — Sửa YAML frontmatter (`model: pro`, xóa `role:`), tại Bước 0 (dòng 30) bỏ hoàn toàn yêu cầu tự đọc lại `.agents/agents/planner/agent.md` và `.agents/rules/02-quality.md` (do đã kế thừa tự động từ Antigravity `v2.19.1`), chỉ giữ khảo sát mã nguồn liên quan và đọc `SKILL.md` theo Pre-Work Protocol; cập nhật `.agents/workflows/debug.md` (dòng 57) ➔ `.agents/skills/vikini-debug/SKILL.md`.
2. `.agents/agents/reviewer/agent.md` — Sửa YAML frontmatter (`model: pro`, xóa `role:`), xóa `write_to_file` khỏi `tools:`, bỏ tự đọc `reviewer/agent.md` ở Bước 0, xóa gợi ý `node -e` / `npx tsx -e` ở dòng 82, thu gọn nội dung xuống `< 7,500 chars` (giữ nguyên 100% quy tắc thẩm định S1–S6, Evidence Bar, Dual-Reviewer, và Approval Token).
3. `.agents/agents/qa/agent.md` — Sửa YAML frontmatter (`model: pro`, xóa `role:`); tại mục Cơ Chế Runtime Fallback Model (dòng 131–137), thay thế hoàn toàn `claude-4.6-opus` bằng `claude-opus-5-5` (`Claude Opus 5.5 (thinking)`, nhãn `[QA_MODEL: claude-opus-5-5]`) với fallback là `gemini-4-argon` (`[FALLBACK_MODEL: gemini-4-argon]`).
4. `.agents/agents/reviewer/allowlist.md` — Xóa lệnh mẫu dùng pipe `| npx eslint --stdin` (dòng 19) và mục 3 `node -e` / `npx tsx -e` (dòng 22–25); bổ sung `node scripts/verify-docs.mjs` vào danh sách lệnh allowlist hợp lệ.
5. `.agents/agents/reviewer/evidence-bar.md` — Tại §4.5.1 (dòng 21): thay gợi ý `node -e` / `npx tsx -e` bằng chạy unit test co-located qua `npx vitest run <path>`. Tại §4.5.3 (dòng 47–51): phân biệt rõ công cụ kiểm chứng **Wiring & Baseline** (`npx eslint --print-config <path>`, `npx tsc --showConfig`, `npx tsc --noEmit`) với **Negative Probe** hợp lệ (thực thi test case âm tính truyền dữ liệu/payload/command vi phạm trong `*.test.ts` qua `npx vitest run <path>`, hoặc bước Negative Probe tường minh trong Verification Plan / Test Contract) để đồng bộ hoàn toàn với dòng 50.
6. `.agents/rules/00-core.md` — Làm rõ quy tắc Git (BANNED mutating vs ALLOWED read-only inspection) và bổ sung mục **Core Coding & Testing Invariants** (~1,000 chars) để đảm bảo `@planner`/`@reviewer` luôn nắm các bất biến code khi `01-coding.md` chuyển sang `trigger: glob`.
7. `.agents/rules/01-coding.md` — Đổi YAML frontmatter từ `trigger: always_on` sang `trigger: glob` với `globs: "*.ts, *.tsx, *.js, *.mjs"`; tại dòng 93, đổi `> Optimized for AI agent comprehension (Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro).` thành `> Optimized for AI agent comprehension (Gemini 4 Argon, Claude Opus 5.5, Claude Sonnet 5.5, Gemini 3.8 Flash).`.
8. `.agents/rules/02-quality.md` — Cập nhật toàn bộ 5 vị trí tham chiếu `.agents/workflows/` (dòng 19, 30, 41, 99, 140) sang `.agents/skills/{vikini-debug,vikini-audit}/SKILL.md`; sửa `requireUser()` (dòng 108) thành `await auth()` + `UnauthorizedError`; thu gọn phần văn bản lặp lại xuống `~6,000 chars`.
9. `.agents/rules/03-ui.md` — Đổi YAML frontmatter từ `trigger: model_decision` sang `trigger: glob` với `globs: "*.tsx, *.css"`; tích hợp quy tắc song ngữ cốt lõi (`useLanguage()`, `t("key")`, `src/lib/utils/translations/{vi,en,index}.ts`).
10. `.agents/rules/04-bilingual.md` — Sửa đường dẫn dòng 14 từ `lib/utils/translations/` thành `src/lib/utils/translations/`.
11. `.agents/rules/05-plan-review.md` — Thu gọn văn bản xuống `~6,000 chars`; bỏ `write_to_file` khỏi quyền của `@reviewer` tại §3.1 (dòng 60); bổ sung quy định cập nhật `- **Status**: Completed` vào Header của file kế hoạch ở bước cuối cùng sau khi hoàn tất triển khai để tự động khóa lại Code Freeze Guard; cập nhật mô tả Self-Forgery Guard và Status Whitelist khớp với `.agents/scripts/code-freeze-guard.js`.
12. `.agents/hooks.json` — Cập nhật `matcher` thành `"write_to_file|replace_file_content|multi_replace_file_content|run_command"`.
13. `.agents/scripts/code-freeze-guard.js` — Cải tiến `isPlanApproved()` (Status Whitelist `Approved` + exact match `lastLine === "[PLAN_APPROVED]"`), export 2 hàm thuần ESM `export function evaluatePlanApprovalContent(content)` và `export function isSelfForgedPlanWrite(newContent)`, thêm Self-Forgery Guard tại Gate 3 (`docs/plans/`) bên trong nhánh `if (unfrozen)` (giữ nguyên `UNFROZEN_PREFIXES` và `UNFROZEN_FILES`), thu hẹp regex `claude` trong `READ_ONLY_COMMANDS`, và thêm `node scripts/verify-docs.mjs` vào `READ_ONLY_COMMANDS`.
14. `.agents/scripts/code-freeze-guard.test.ts` — Bổ sung bộ unit test kiểm chứng `evaluatePlanApprovalContent`, `isSelfForgedPlanWrite`, Gate 3 Self-Forgery Guard trên `decide({ toolName, targetFile, newContent }, { planApproved: false })`, regex `claude` read-only vs bypass flags, và `node scripts/verify-docs.mjs`.
15. `.agents/scripts/claude-planner-prompt.md` — Cập nhật dòng 20 (bổ sung `add-model`, `vikini-debug`, `vikini-audit`) và dòng 64 (`.agents/workflows/debug.md` ➔ `.agents/skills/vikini-debug/SKILL.md`).
16. `.agents/skills/add-model/SKILL.md` — Sửa dòng 12 và dòng 28 từ `lib/core/modelRegistry.ts` thành `src/lib/core/modelRegistry.ts`; sửa dòng 37 từ `lib/utils/config.ts` thành `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`.
17. `.agents/skills/add-translation/SKILL.md` — Sửa dòng 12, 25, 31 từ `lib/utils/translations/` thành `src/lib/utils/translations/`.
18. `.agents/skills/README.md` — Bổ sung `vikini-debug` và `vikini-audit` vào mục 1.C và bảng định tuyến mục 2; sửa `requireUser()` (dòng 17, 47) thành `await auth()` / `UnauthorizedError`.
19. `.agents/README.md` — Cập nhật bảng Rules Catalog (Mục 2) theo cơ chế trigger mới, bổ sung dòng `@qa` (Primary `claude-opus-5-5` / Fallback `gemini-4-argon`) vào bảng Model Routing (Mục 4.1), và đồng bộ toàn bộ tên model theo chuẩn tháng 10/2026 (`gemini-4-argon`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`).
20. `.gitignore` — Bổ sung `!.agents/skills/vikini-debug/`, `!.agents/skills/vikini-audit/`, `!.agents/skills/animation-vocabulary/`, `!.agents/skills/emil-design-eng/`, `!.agents/skills/review-animations/`, và thêm `.agents/.plan-approved` vào danh sách ignore.
21. `scripts/verify-docs.mjs` — Cập nhật kiểm tra `[2/5]` để phát hiện mọi tham chiếu sót tới `.agents/workflows/` (loại trừ `docs/plans/`, `docs/archive/`, `docs/CHANGELOG.md`) và loại bỏ tiền tố `.agents/workflows/` khỏi điều kiện quét của `[3/5]`.
22. `docs/lessons-learned.md` — Cập nhật dòng 5 từ `/post-fix workflow` sang skill `vikini-debug` (`/post-fix`).
23. `docs/CHANGELOG.md` — Cập nhật dòng ghi chú lưu trữ tại dòng 7 (`2026-09-10` ➔ `2026-10-15`), di chuyển 32 mục changelog cũ (`<= 2026-10-15`, dòng 122–847) sang `docs/archive/CHANGELOG-legacy.md`, và ghi mục changelog mới cho Vikini Governance 2.0 vào đầu file.
24. `docs/archive/CHANGELOG-legacy.md` — Cập nhật dòng ghi chú lưu trữ tại dòng 3 (`2026-09-10` ➔ `2026-10-15`) và nhận 32 mục changelog cũ (`<= 2026-10-15`) từ `docs/CHANGELOG.md`.
25. `docs/plans/README.md` — Cập nhật bảng danh mục kế hoạch với trạng thái `Completed` cho `2026-10-19-vitest-upgrade-and-add-model-skill.md` và `2026-10-19-remake-agents-governance-v2-implementation-plan.md`.
26. `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` — Cập nhật dòng trạng thái ở Header từ `- **Status**: Approved` sang `- **Status**: Completed` ở bước cuối cùng của quá trình triển khai (ngay trước khi đóng trạng thái `Completed` cho file kế hoạch hiện tại).

---

### 6. Caller-First Design Sketch

#### 6.1. Thiết Kế Hàm Kiểm Chứng Phê Duyệt & Chống Tự Cấp Quyền Trong `.agents/scripts/code-freeze-guard.js` (ES Module)

Từ phía caller (`decide(input, options)` và bộ test `.agents/scripts/code-freeze-guard.test.ts`), ta export 2 hàm thuần (pure functions) chuẩn ES Module không phụ thuộc filesystem để vừa dùng trực tiếp trong `isPlanApproved()` / `decide()`, vừa kiểm thử đơn vị (unit test) chính xác tuyệt đối mọi biên dữ liệu mà không cần chạm vào thư mục `docs/plans/` thật:

```javascript
/**
 * Evaluates raw markdown content of a plan file in docs/plans/*.md
 * to determine if it is currently in an active Approved state.
 *
 * Rules:
 * 1. Header Whitelist: Within the first 30 lines, there MUST be a status line
 *    explicitly matching `- **Status**: Approved` or `- **Trạng thái**: Approved`
 *    (case-insensitive). Any other status (`Completed`, `Ready for Review`,
 *    `Changes Requested`, `Draft`, `In Review`, or missing status) returns false.
 * 2. Footer Exact Token: The last non-blank line of the file (trimmed) MUST
 *    strictly equal `"[PLAN_APPROVED]"` (no trailing/leading prose allowed).
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function evaluatePlanApprovalContent(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  const lines = content.split(/\r?\n/);

  // 1. Strict Header Status Whitelist on the first 30 lines
  const headerLines = lines.slice(0, 30).join("\n");
  const isApprovedHeader = /^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Approved\s*$/im.test(
    headerLines
  );
  if (!isApprovedHeader) {
    return false;
  }

  // 2. Find last non-blank line and check exact token match
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      return trimmed === "[PLAN_APPROVED]";
    }
  }
  return false;
}

/**
 * Detects whether a full-file write (`write_to_file`) targeting `docs/plans/*.md`
 * attempts to self-forge approval status or the approval token.
 *
 * Checks the exact two approval conditions (Header Status: Approved in first 30 lines
 * OR last non-blank line === "[PLAN_APPROVED]") so that legitimate technical plans
 * discussing `[PLAN_APPROVED]` inside the markdown body are NOT falsely blocked.
 *
 * @param {string | undefined} newContent
 * @returns {boolean}
 */
export function isSelfForgedPlanWrite(newContent) {
  if (typeof newContent !== "string" || !newContent.trim()) return false;
  const lines = newContent.split(/\r?\n/);

  const headerLines = lines.slice(0, 30).join("\n");
  if (/^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Approved\s*$/im.test(headerLines)) {
    return true;
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      return trimmed === "[PLAN_APPROVED]";
    }
  }
  return false;
}
```

#### 6.2. Call Site Tại Gate 3 (`docs/` & Root Planning Artifacts) Trong `decide(input, options = {})` (`.agents/scripts/code-freeze-guard.js`)

```javascript
// 3. Unfrozen paths (docs/ and root planning artifacts)
const unfrozen =
  UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) ||
  UNFROZEN_FILES.includes(relative);
if (unfrozen) {
  // Self-Forgery Guard: block write_to_file on docs/plans/ if it pre-populates
  // Status: Approved in the header or [PLAN_APPROVED] on the last line.
  if (
    (relative === "docs/plans" || relative.startsWith("docs/plans/")) &&
    input.toolName === "write_to_file" &&
    isSelfForgedPlanWrite(input.newContent)
  ) {
    return ask(
      `\u26a0\ufe0f Plan Self-Forgery Guard: Không được phép dùng write_to_file để tạo mới hoặc ghi đè file kế hoạch (${relative}) đã gắn sẵn 'Status: Approved' hoặc thẻ '[PLAN_APPROVED]' ở dòng cuối. Kế hoạch mới phải có 'Status: Ready for Review' và chỉ được phê duyệt qua replace_file_content bởi Lead Reviewer.`
    );
  }
  return { decision: "allow" };
}
```

#### 6.3. Call Site Trong `.agents/scripts/code-freeze-guard.test.ts`

```typescript
import {
  decide,
  evaluatePlanApprovalContent,
  isSelfForgedPlanWrite,
  // ... existing imports
} from "./code-freeze-guard.js";

describe("evaluatePlanApprovalContent & Self-Forgery Guard", () => {
  it("allows plan only when Header Status is Approved AND last non-blank line is exact [PLAN_APPROVED]", () => {
    const validPlan = [
      "# Plan",
      "- **Revision**: 1",
      "- **Status**: Approved",
      "## Technical Plan",
      "Details...",
      "## Audit History",
      "[PLAN_APPROVED]",
      "",
    ].join("\n");
    expect(evaluatePlanApprovalContent(validPlan)).toBe(true);
  });

  it("rejects plan when Status is Completed even if [PLAN_APPROVED] is at the bottom", () => {
    const completedPlan = [
      "# Plan",
      "- **Status**: Completed",
      "## Audit History",
      "[PLAN_APPROVED]",
    ].join("\n");
    expect(evaluatePlanApprovalContent(completedPlan)).toBe(false);
  });

  it("rejects plan when last line only endsWith [PLAN_APPROVED] in a sentence", () => {
    const sentencePlan = [
      "# Plan",
      "- **Status**: Approved",
      "## Audit History",
      "Do lỗi trên nên chưa cấp [PLAN_APPROVED]",
    ].join("\n");
    expect(evaluatePlanApprovalContent(sentencePlan)).toBe(false);
  });

  it("blocks write_to_file on docs/plans/ with pre-populated [PLAN_APPROVED] at bottom", () => {
    const res = decide(
      {
        toolName: "write_to_file",
        targetFile: "docs/plans/2026-10-19-fake.md",
        newContent: "# Fake\n- **Status**: Ready for Review\n\n[PLAN_APPROVED]\n",
      },
      { planApproved: false }
    );
    expect(res.decision).toBe("ask");
    expect(res.reason).toContain("Plan Self-Forgery Guard");
  });

  it("allows write_to_file on docs/plans/ when [PLAN_APPROVED] is only mentioned in body text", () => {
    const res = decide(
      {
        toolName: "write_to_file",
        targetFile: "docs/plans/2026-10-19-gov.md",
        newContent:
          "# Governance Plan\n- **Status**: Ready for Review\nWe check `[PLAN_APPROVED]` in tests.\n## Audit History\n",
      },
      { planApproved: false }
    );
    expect(res.decision).toBe("allow");
  });
});
```

---

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **Bước 1 — Tạo mới 2 Skills từ Workflows và xóa thư mục `.agents/workflows/`**:
  - Tạo `.agents/skills/vikini-debug/SKILL.md` với YAML frontmatter (`name: vikini-debug`, `description: "MANDATORY when debugging complex or recurring bugs (/debug) or executing the post-fix verification and lesson-recording protocol (/post-fix)."`), hợp nhất đầy đủ quy trình 5 bước của `.agents/workflows/debug.md` (Check Past Lessons, Understand Before Touching, Trace Data Flow, Minimal Fix + Co-located Test, 3-Strike Circuit Breaker) và 4 bước của `.agents/workflows/post-fix.md` (`npm run verify`, ghi `docs/lessons-learned.md`, cập nhật `docs/CHANGELOG.md`, tóm tắt root cause).
  - Tạo `.agents/skills/vikini-audit/SKILL.md` với YAML frontmatter (`name: vikini-audit`, `description: "MANDATORY when performing a focused code quality, architecture boundary, UI token, or bilingual compliance audit (/audit) on a file or feature area."`), chuyển toàn bộ 5 bước kiểm toán từ `.agents/workflows/audit.md`.
  - Xóa 3 file `.agents/workflows/debug.md`, `.agents/workflows/post-fix.md`, `.agents/workflows/audit.md`.

- [ ] **Bước 2 — Chuẩn hóa 3 Subagents (`.agents/agents/*/agent.md`) & 2 File Vệ Tinh Reviewer**:
  - Cập nhật `.agents/agents/planner/agent.md`:
    - Sửa YAML frontmatter (dòng 1–18): đổi `model: gemini-4-argon` thành `model: pro`, xóa dòng `role: Fallback Technical Planner`. Giữ nguyên nhãn `[PLANNER_MODEL: gemini-4-argon]` ở dòng 21 và dòng 26.
    - Tại Bước 0 (dòng 30): xóa hoàn toàn yêu cầu gọi `view_file` đọc lại `.agents/agents/planner/agent.md` và `.agents/rules/02-quality.md` (do từ Antigravity `v2.19.1`, custom subagents đã tự động kế thừa project rules `always_on`); chỉ yêu cầu khảo sát trực tiếp các file mã nguồn/tài liệu liên quan đến task và đọc các `SKILL.md` theo bảng Pre-Work Protocol.
    - Tại dòng 57: đổi `.agents/workflows/debug.md` thành `.agents/skills/vikini-debug/SKILL.md`.
  - Cập nhật `.agents/agents/reviewer/agent.md`:
    - Sửa YAML frontmatter (dòng 1–20): đổi `model: gemini-4-argon` thành `model: pro`, xóa dòng `role: Primary Lead Architecture Reviewer`, xóa `- write_to_file` khỏi danh sách `tools:` (giữ `view_file`, `list_dir`, `grep_search`, `find_by_name`, `replace_file_content`, `run_command`, `search_web`, `read_url_content`).
    - Tại Bước 0 (dòng 35–42): xóa mục tự đọc `.agents/agents/reviewer/agent.md`, chỉ giữ đọc 3 file vệ tinh (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md`) và các `SKILL.md` thuộc domain của plan.
    - Tại dòng 82: thay gợi ý `node -e` / `npx tsx -e` bằng `npx tsc --noEmit`, `npx vitest run <path>`, hoặc `node scripts/verify-docs.mjs`.
    - Tại mục Ràng Buộc Bắt Buộc (dòng 120): ghi rõ chỉ dùng `replace_file_content` để cập nhật trạng thái Header và nối thêm `### Audit Run [X+1]` vào `docs/plans/*.md`.
    - Tinh giản câu chữ trùng lặp để tổng dung lượng `.agents/agents/reviewer/agent.md` đạt `< 7,500 chars` (giảm từ `9,779 chars`), giữ nguyên 100% logic thẩm định.
  - Cập nhật `.agents/agents/qa/agent.md`:
    - Sửa YAML frontmatter (dòng 1–17): đổi `model: claude-4.6-opus` thành `model: pro`, xóa dòng `role: Lead QA, Bug Hunter & Code Auditor`.
    - Tại mục Cơ Chế Runtime Fallback Model (dòng 131–137): thay thế hoàn toàn `claude-4.6-opus` bằng `claude-opus-5-5` (`Claude Opus 5.5 (thinking)`, nhãn `[QA_MODEL: claude-opus-5-5]`) với fallback sang `gemini-4-argon` (`[FALLBACK_MODEL: gemini-4-argon]`).
  - Cập nhật `.agents/agents/reviewer/allowlist.md` và `.agents/agents/reviewer/evidence-bar.md`:
    - Trong `.agents/agents/reviewer/allowlist.md`: xóa lệnh mẫu có pipe `| npx eslint --stdin` (dòng 19) và mục 3 `node -e` / `npx tsx -e` (dòng 22–25); bổ sung `node scripts/verify-docs.mjs` vào danh sách lệnh allowlist hợp lệ.
    - Trong `.agents/agents/reviewer/evidence-bar.md`: tại §4.5.1 (dòng 21) đổi gợi ý `node -e` / `npx tsx -e` thành chạy unit test co-located qua `npx vitest run <path>`; tại §4.5.3 (dòng 47–51) ghi rõ `npx eslint --print-config <path>`, `npx tsc --showConfig`, `npx tsc --noEmit` dùng để chứng minh **Wiring & Baseline**, còn **Negative Probe** hợp lệ là thực thi các test case âm tính (truyền dữ liệu/payload/command vi phạm vào hàm guard/validator/schema trong `*.test.ts`) qua `npx vitest run <path>` hoặc bước Negative Probe tường minh trong Verification Plan / Test Contract.

- [ ] **Bước 3 — Tái cấu trúc `.agents/rules/` theo Progressive Disclosure & Chuẩn hóa Model Roster Tháng 10/2026**:
  - Cập nhật `.agents/rules/00-core.md` (`trigger: always_on`, mục tiêu `~4,500 chars`):
    - Sửa mục Git Rules (dòng 42 và dòng 52–58): phân tách rõ **BANNED Mutating Git Commands** (`git add`, `git commit`, `git push`, `git checkout`, `git switch`, `git branch`, `git reset`, `git stash`, `git merge`, `git rebase`) và **ALLOWED Read-Only Git Inspection** (`git status`, `git diff`, `git log -n <N>`, `git show`, `git blame`).
    - Thêm mục **Core Coding & Testing Invariants** (~1,000 chars) tóm tắt các quy tắc bất biến từ `01-coding.md`: TypeScript strict mode (`any` bị cấm tuyệt đối, bắt buộc dùng `unknown` + type narrowing), cấm `console.log` (chỉ dùng `console.warn`/`console.error`), bắt buộc có co-located unit test (`*.test.ts`) khi thêm/sửa logic trong `src/lib/core/`, `src/lib/features/`, `.agents/scripts/`, hiển thị `toast.error()` cho lỗi tác vụ người dùng, và giới hạn kích thước file 150–400 dòng (tối đa 500 dòng).
  - Cập nhật `.agents/rules/01-coding.md`:
    - Đổi YAML frontmatter (dòng 1–4) sang:
      ```yaml
      ---
      trigger: glob
      globs: "*.ts, *.tsx, *.js, *.mjs"
      description: Coding standards, TypeScript discipline, error handling, testing, and code organization rules.
      ---
      ```
    - Tại dòng 93: đổi `> Optimized for AI agent comprehension (Claude Opus 4.6 / 5.5, Gemini 4 Argon, Gemini 3.1 Pro).` thành `> Optimized for AI agent comprehension (Gemini 4 Argon, Claude Opus 5.5, Claude Sonnet 5.5, Gemini 3.8 Flash).`.
  - Cập nhật `.agents/rules/02-quality.md` (`trigger: always_on`, thu gọn từ `11,044 chars` xuống `~6,000 chars`):
    - Cập nhật đầy đủ cả **5 vị trí** tham chiếu `.agents/workflows/`:
      1. Dòng 19 (Pre-Work table): `.agents/workflows/debug.md` ➔ `.agents/skills/vikini-debug/SKILL.md`.
      2. Dòng 30 (Pre-Work table): `.agents/workflows/audit.md` ➔ `.agents/skills/vikini-audit/SKILL.md`.
      3. Dòng 41 (How to Use note): `.agents/workflows/` ➔ `.agents/skills/`.
      4. Dòng 99 (Pre-Completion Gate): `.agents/workflows/audit.md` ➔ `.agents/skills/vikini-audit/SKILL.md`.
      5. Dòng 140 (Debugging Protocol): `.agents/workflows/debug.md` ➔ `.agents/skills/vikini-debug/SKILL.md`.
    - Sửa dòng 108: thay `Every new API route has requireUser() at the top` thành `Every new API route validates authentication at the top via await auth() + UnauthorizedError (or requireUser() in /api/conversations/**)`.
    - Tinh giản mục `After Fixing a Bug` & `Debugging Protocol` (dòng 121–150) bằng cách giữ các chốt chặn bất biến (`npm run verify`, `docs/lessons-learned.md`, `docs/CHANGELOG.md`, 3-strike Circuit Breaker) và trỏ chi tiết sang `.agents/skills/vikini-debug/SKILL.md`.
  - Cập nhật `.agents/rules/03-ui.md`:
    - Đổi YAML frontmatter (dòng 1–4) sang:
      ```yaml
      ---
      trigger: glob
      globs: "*.tsx, *.css"
      description: UI/UX design system, styling tokens, component conventions, and bilingual (VI/EN) standards.
      ---
      ```
    - Tích hợp mục **Bilingual Support (VI / EN)** chuẩn hóa (`useLanguage()`, `t("key")`, cấm inline ternary `language === 'vi' ? ...`, đường dẫn `src/lib/utils/translations/{vi,en,index}.ts`) vào cuối `.agents/rules/03-ui.md`.
  - Cập nhật `.agents/rules/04-bilingual.md`:
    - Sửa dòng 14 từ `lib/utils/translations/` thành `src/lib/utils/translations/`.
  - Cập nhật `.agents/rules/05-plan-review.md` (`trigger: always_on`, thu gọn từ `10,749 chars` xuống `~6,000 chars`):
    - Tại §3.1 (dòng 60): bỏ `write_to_file` khỏi công cụ của `@reviewer` (chỉ dùng `replace_file_content` trên file kế hoạch đã có).
    - Tại §3.3 (dòng 77–81): cập nhật cơ chế **Plan Lifecycle & Status Whitelist**: ghi rõ `code-freeze-guard.js` chỉ mở khóa khi Header có `- **Status**: Approved` VÀ dòng văn bản cuối cùng là `[PLAN_APPROVED]`; bổ sung trạng thái `- **Status**: Completed` (khi Main Agent hoàn tất Post-Change Checklist của một task, ở bước cuối cùng bắt buộc cập nhật Header của file kế hoạch sang `- **Status**: Completed` để khóa lại repo cho task tiếp theo).
    - Tinh giản diễn giải trùng lặp mà vẫn bảo toàn 100% quy tắc Dual-Planner, Dual-Reviewer, Fast-Track Exemption (§1.1), Uninterrupted Chain (tối đa 10 vòng), Severity Rubric, và `@qa`.

- [ ] **Bước 4 — Gia cố `.agents/scripts/code-freeze-guard.js`, `.agents/hooks.json` & Unit Tests**:
  - Cập nhật `.agents/hooks.json`: đổi `matcher` tại dòng 5 thành `"write_to_file|replace_file_content|multi_replace_file_content|run_command"`.
  - Cập nhật `.agents/scripts/code-freeze-guard.js` (ES Module):
    1. Trong `READ_ONLY_COMMANDS` (dòng 51–65):
       - Thêm `/^node scripts\/verify-docs\.mjs(?:\s+(?:--strict-shorthand|--expected-headings=\d+))*$/`.
       - Thay thế `/^claude(?:\.exe)?(?:\s+.*)?$/` (dòng 64) bằng `/^claude(?:\.exe)?\s+(?:--version|-v|--help|-h|-p\s+["']?ping["']?)$/i`.
    2. Cài đặt và export trực tiếp 2 hàm thuần ESM `export function evaluatePlanApprovalContent(content)` và `export function isSelfForgedPlanWrite(newContent)` như thiết kế ở Mục 6.1.
    3. Cập nhật `isPlanApproved()` (dòng 203–229): sau khi lấy file kế hoạch có `mtimeMs` mới nhất (`const latestPlanPath = entries[0]; const content = fs.readFileSync(latestPlanPath, "utf8");`), gọi `return evaluatePlanApprovalContent(content);`.
    4. Cập nhật Gate 3 trong `decide(input, options = {})` (dòng 464–470): giữ nguyên `const unfrozen = UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) || UNFROZEN_FILES.includes(relative);`, và bên trong `if (unfrozen)` kiểm tra `if ((relative === "docs/plans" || relative.startsWith("docs/plans/")) && input.toolName === "write_to_file" && isSelfForgedPlanWrite(input.newContent))` để trả về `ask(...)` nếu phát hiện tự cấp quyền (như Mục 6.2).
  - Cập nhật `.agents/scripts/code-freeze-guard.test.ts`:
    - Import `evaluatePlanApprovalContent` và `isSelfForgedPlanWrite` từ `./code-freeze-guard.js`.
    - Thêm các describe/test blocks kiểm tra `evaluatePlanApprovalContent`, `isSelfForgedPlanWrite`, Gate 3 Self-Forgery Guard trong `decide({ toolName, targetFile, newContent }, { planApproved: false })`, regex `claude` read-only vs bypass flags, và lệnh `node scripts/verify-docs.mjs`.

- [ ] **Bước 5 — Cập nhật `.gitignore`, `scripts/verify-docs.mjs`, Docs Drift, Archive `docs/CHANGELOG.md` & Đóng Trạng Thái Kế Hoạch**:
  - Cập nhật `.gitignore`:
    - Thêm `.agents/.plan-approved` vào nhóm ignore.
    - Đảm bảo danh sách unignore (`!`) cho `.agents/skills/` có đủ 13 thư mục skill hiện có: `add-feature`, `add-model`, `add-translation`, `animation-vocabulary`, `api-patterns`, `database-migration`, `emil-design-eng`, `review-animations`, `streaming-patterns`, `vikini-audit`, `vikini-debug`, `vikini-investigate`, `vikini-simplify`.
  - Cập nhật `scripts/verify-docs.mjs`:
    - Tại `[2/5]` (`legacyPatterns`, dòng 107–124): thêm `{ name: ".agents/workflows/ (deprecated)", regex: /\.agents\/workflows\// }` và bỏ qua các file lịch sử trong `docs/plans/` (trừ `docs/plans/README.md`) giống như cổng `[1/5]` (`if (rel.startsWith("docs/plans/") && rel !== "docs/plans/README.md") continue;`).
    - Tại `[3/5]` (dòng 145–149): xóa `rel.startsWith(".agents/workflows/") ||` khỏi điều kiện lọc file cần quét (vì thư mục `.agents/workflows/` đã xóa).
  - Sửa doc drift trong:
    - `.agents/skills/add-model/SKILL.md`: sửa dòng 12 và 28 (`lib/core/modelRegistry.ts` ➔ `src/lib/core/modelRegistry.ts`), sửa dòng 37 (`lib/utils/config.ts` ➔ `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`).
    - `.agents/skills/add-translation/SKILL.md`: sửa dòng 12, 25, 31 (`lib/utils/translations/` ➔ `src/lib/utils/translations/`).
    - `.agents/skills/README.md` (mục 1.C, mục 2, dòng 17, 47).
    - `.agents/README.md` (cập nhật Mục 2 Rules Catalog; bổ sung dòng `@qa` sử dụng Primary `claude-opus-5-5` / Fallback `gemini-4-argon` vào bảng Mục 4.1 Model Routing và đồng bộ toàn bộ tên model theo chuẩn tháng 10/2026: `gemini-4-argon`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`).
    - `.agents/scripts/claude-planner-prompt.md` (dòng 20, 64), và `docs/lessons-learned.md` (dòng 5).
  - Archive `docs/CHANGELOG.md` sang `docs/archive/CHANGELOG-legacy.md`:
    - Di chuyển 32 mục changelog cũ (`<= 2026-10-15`, dòng 122–847 của `docs/CHANGELOG.md`) sang đầu phần entries của `docs/archive/CHANGELOG-legacy.md`.
    - Cập nhật dòng ghi chú mốc ngày lưu trữ tại `docs/CHANGELOG.md:7` và `docs/archive/CHANGELOG-legacy.md:3` từ `2026-09-10` sang `2026-10-15`.
    - Thêm mục changelog mới `## 2026-10-19: Governance -- Remake Hệ Thống Governance 2.0 (Rules, Subagents, Hooks & Skills)` vào đầu `docs/CHANGELOG.md` (tổng số headings trên 2 file = `7` current + `106` legacy = `113`).
  - Chạy toàn bộ cổng kiểm chứng chất lượng (`npm run type-check`, `npm run lint`, `npm run test:run`, `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113`).
  - **Thao tác cuối cùng (Strict Temporal Ordering cho `mtimeMs`)**:
    1. Cập nhật `docs/plans/README.md` (đánh dấu `Completed` cho cả 2 kế hoạch ngày `2026-10-19`).
    2. Cập nhật Header của `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` sang `- **Status**: Completed`.
    3. Cuối cùng, cập nhật Header của `docs/plans/2026-10-19-remake-agents-governance-v2-implementation-plan.md` sang `- **Status**: Completed` để file kế hoạch hiện tại có `mtimeMs` mới nhất và tự động khóa lại Code Freeze Guard cho nhiệm vụ tiếp theo.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID        | Thành phần / Hàm                                                          | Input                                                                                                                                                                                                            | Expected Output                                                                                                                                          | Failure Modes / Boundary Conditions                                                                                                                                                                                                                             |
| :-------- | :------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01** | `evaluatePlanApprovalContent(content)`                                    | Markdown plan có `- **Status**: Approved` ở dòng 4 và dòng cuối cùng là `[PLAN_APPROVED]` (kèm dòng trống phía sau).                                                                                             | `true`                                                                                                                                                   | Chấp nhận cả `- **Status**: Approved` và `- **Trạng thái**: Approved` (không phân biệt hoa/thường), chịu được CRLF (`\r\n`) và LF (`\n`).                                                                                                                       |
| **TC-02** | `evaluatePlanApprovalContent(content)`                                    | Markdown plan có `- **Status**: Completed` (hoặc `Ready for Review`, `Changes Requested`, `Draft`, hoặc không có dòng Status) nhưng dòng cuối vẫn còn `[PLAN_APPROVED]`.                                         | `false`                                                                                                                                                  | **Boundary**: Ngăn chặn triệt để lỗi Stale/Completed Plan Unlock — ngay khi đổi Status sang `Completed`, hàm bắt buộc trả về `false`.                                                                                                                           |
| **TC-03** | `evaluatePlanApprovalContent(content)`                                    | Markdown plan có `- **Status**: Approved` nhưng dòng cuối là `"Do đó chưa cấp [PLAN_APPROVED]"` hoặc `"Kết luận: [PLAN_APPROVED]"` hoặc ``"`[PLAN_APPROVED]`"``.                                                 | `false`                                                                                                                                                  | **Boundary**: Dòng văn bản cuối cùng sau khi `.trim()` phải khớp chính xác `=== "[PLAN_APPROVED]"`, không chấp nhận `.endsWith("[PLAN_APPROVED]")`.                                                                                                             |
| **TC-04** | `isSelfForgedPlanWrite(newContent)` & Gate 3 `decide()`                   | `decide({ toolName: "write_to_file", targetFile: "docs/plans/2026-10-19-x.md", newContent }, { planApproved: false })` với `newContent` có `- **Status**: Approved` ở Header HOẶC `[PLAN_APPROVED]` ở dòng cuối. | `decide()` trả về `{ decision: "ask", reason: "⚠️ Plan Self-Forgery Guard: ..." }`.                                                                      | **Boundary**: Nếu `newContent` có `- **Status**: Ready for Review` và chuỗi `[PLAN_APPROVED]` chỉ xuất hiện ở giữa thân bài (không phải dòng không rỗng cuối cùng), `isSelfForgedPlanWrite` trả về `false` và `decide()` trả về `{ decision: "allow" }`.        |
| **TC-05** | Gate 3 `decide()` với `replace_file_content`                              | `decide({ toolName: "replace_file_content", targetFile: "docs/plans/2026-10-19-x.md", newContent }, { planApproved: false })` với `newContent` chứa `- **Status**: Approved` và `[PLAN_APPROVED]`.               | `{ decision: "allow" }`                                                                                                                                  | Cho phép Lead Reviewer (`@reviewer`) phê duyệt kế hoạch hợp lệ bằng `replace_file_content` mà không bị Self-Forgery Guard chặn; đồng thời `decide({ targetFile: "implementation_plan.md" })` vẫn trả về `{ decision: "allow" }` nhờ bảo toàn `UNFROZEN_FILES`.  |
| **TC-06** | `decide({ command })` cho `claude` CLI                                    | `decide({ command: "claude --version" })`, `decide({ command: "claude -v" })`, `decide({ command: "claude --help" })`, `decide({ command: "claude -p ping" })`.                                                  | `{ decision: "allow" }`                                                                                                                                  | **Negative**: `decide({ command: "claude -p \"edit file\" --permission-mode bypassPermissions" }, { planApproved: false })` hoặc `decide({ command: "claude --dangerously-skip-permissions" }, { planApproved: false })` bắt buộc trả về `{ decision: "ask" }`. |
| **TC-07** | `decide({ command })` cho `verify-docs.mjs`                               | `decide({ command: "node scripts/verify-docs.mjs" })` hoặc `decide({ command: "node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113" })`.                                                     | `{ decision: "allow" }`                                                                                                                                  | **Negative**: `decide({ command: "node scripts/verify-docs.mjs; rm -rf src" })` hoặc `decide({ command: "node scripts/other-script.mjs" })` bắt buộc trả về `{ decision: "ask" }`.                                                                              |
| **TC-08** | Giới hạn dung lượng Governance (`.agents/rules/` & `.agents/agents/`)     | Đọc dung lượng ký tự của toàn bộ `.agents/rules/*.md` và `.agents/agents/*/agent.md` (cổng `[4/5]` của `scripts/verify-docs.mjs`).                                                                               | Mọi file `rules/*.md <= 12,000 chars`; mọi file `agent.md <= 10,000 chars` (`reviewer/agent.md < 7,500 chars`); tổng `always_on` rules `< 18,000 chars`. | Không được cắt mất bất kỳ quy tắc bắt buộc nào trong S1–S6, Evidence Bar, hay Pre-Work Protocol; không còn chuỗi `claude-4.6-opus` hay `Gemini 3.1 Pro` trong `.agents/`.                                                                                       |
| **TC-09** | `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113` | Chạy kiểm định toàn bộ tài liệu trong repo.                                                                                                                                                                      | Exit code `0`, hiển thị `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`.                                                                         | Cả 5 cổng (`[1/5]` Path Existence, `[2/5]` Zero Legacy Refs bao gồm `.agents/workflows/`, `[3/5]` Strict Shorthand, `[4/5]` Character Limits, `[5/5]` `docs/CHANGELOG.md < 35,000 bytes` & `totalHeadings === 113`) đều phải PASS.                              |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1. File Test Co-Located

- **File test**: `.agents/scripts/code-freeze-guard.test.ts` (đặt cạnh `.agents/scripts/code-freeze-guard.js`).
- **Số lượng test cases dự kiến**: Hiện có 92 tests; bổ sung tối thiểu **12 test cases mới** (tổng `>= 104 tests`) bao phủ đầy đủ `TC-01` đến `TC-07`.

#### 9.2. Lệnh Kiểm Thử Tự Động (Verification Commands)

```powershell
npm run type-check
npm run lint
npx vitest run .agents/scripts/code-freeze-guard.test.ts
npm run test:run
node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113
```

#### 9.3. Wiring Probes & Negative Probes

1. **Wiring Probe 1 (Hooks Matcher & Root Proxy Wiring)**:
   - Kiểm tra `.agents/hooks.json` có đúng `"matcher": "write_to_file|replace_file_content|multi_replace_file_content|run_command"` và trỏ tới `node ./scripts/code-freeze-guard.js`.
   - Kiểm tra `scripts/code-freeze-guard.js` re-export đúng module ESM từ `.agents/scripts/code-freeze-guard.js`.
2. **Wiring Probe 2 (Governance Size, Schema & Model Roster Audit)**:
   - Chạy kiểm tra kích thước các file `.agents/rules/*.md` và `.agents/agents/*/agent.md` đảm bảo:
     - `00-core.md + 02-quality.md + 05-plan-review.md < 18,000 chars`.
     - `reviewer/agent.md < 7,500 chars`.
     - YAML frontmatter của cả 3 file `planner/agent.md`, `reviewer/agent.md`, `qa/agent.md` đều có `model: pro` và không còn trường `role:`.
     - Toàn bộ `.agents/` đã thay thế hoàn toàn `claude-4.6-opus` và `Gemini 3.1 Pro` bằng bộ 4 model chuẩn tháng 10/2026 (`gemini-4-argon`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gemini-3.8-flash`).
3. **Negative Probe 1 (Stale Completed Plan Rejection)**:
   - Trong `.agents/scripts/code-freeze-guard.test.ts`, truyền một plan có `- **Status**: Completed` và dòng cuối `[PLAN_APPROVED]` vào `evaluatePlanApprovalContent()` ➔ xác nhận trả về `false`.
4. **Negative Probe 2 (Trailing Prose Rejection)**:
   - Truyền một plan có `- **Status**: Approved` và dòng cuối `"Vì vậy chưa thể cấp [PLAN_APPROVED]"` vào `evaluatePlanApprovalContent()` ➔ xác nhận trả về `false`.
5. **Negative Probe 3 (Self-Forgery Block via `write_to_file`)**:
   - Gọi `decide({ toolName: "write_to_file", targetFile: "docs/plans/2026-10-19-attack.md", newContent: "# Plan\n- **Status**: Approved\n" }, { planApproved: false })` ➔ xác nhận trả về `{ decision: "ask" }` với `reason` chứa `"Plan Self-Forgery Guard"`.
6. **Negative Probe 4 (Direct Claude Bypass Prevention)**:
   - Gọi `decide({ command: "claude -p 'overwrite src' --permission-mode bypassPermissions" }, { planApproved: false })` ➔ xác nhận bị chặn (`decision: "ask"`), không lọt qua `READ_ONLY_COMMANDS`.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

|  #  | Rủi Ro Tiềm Ẩn                                                                                                                                                                                                                                                       |     Mức Độ     | Phương Án Phòng Ngừa & Technical Control Cụ Thể (`[SRC]` / Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :-: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Self-Forgery Guard chặn nhầm kế hoạch hợp lệ** có nhắc tới chuỗi `` `[PLAN_APPROVED]` `` trong phần mô tả kỹ thuật (như chính kế hoạch Governance 2.0 này).                                                                                                        |    **Cao**     | **Technical Control**: Trong `isSelfForgedPlanWrite(newContent)` tại `.agents/scripts/code-freeze-guard.js` (xem Mục 6.1), **KHÔNG** dùng regex `/\[PLAN_APPROVED\]/.test(newContent)` trên toàn văn bản; chỉ kiểm tra (a) 30 dòng đầu có `- **Status**: Approved` hoặc (b) dòng không rỗng cuối cùng `=== "[PLAN_APPROVED]"`. Kiểm chứng bằng `TC-04` trong `.agents/scripts/code-freeze-guard.test.ts`.                                                                                                                                                                           |
|  2  | **Chuyển `.agents/rules/01-coding.md` sang `trigger: glob` (`*.ts, *.tsx, *.js, *.mjs`)** làm `@planner` hoặc `@reviewer` thiếu ngữ cảnh chuẩn code khi chỉ đọc file `.md`.                                                                                          |    **Cao**     | **Technical Control**: Bổ sung mục **Core Coding & Testing Invariants** (~1,000 ký tự: cấm `any`, dùng `unknown` narrowing, cấm `console.log`, bắt buộc co-located `*.test.ts` cho `src/lib/core/`, `src/lib/features/`, `.agents/scripts/`, giới hạn 150–400 dòng/file) vào `.agents/rules/00-core.md` (`trigger: always_on`, được custom subagents kế thừa tự động từ `v2.19.1`). Đồng thời `.agents/scripts/claude-planner-prompt.md:17` và `claude-reviewer-prompt.md:11` vẫn chỉ định đọc tường minh `.agents/rules/01-coding.md`.                                             |
|  3  | **Xóa `.agents/workflows/` gây lỗi broken links** khi chạy `node scripts/verify-docs.mjs` do còn tham chiếu ẩn trong repo.                                                                                                                                           | **Trung bình** | **Technical Control**: Đã rà soát toàn bộ repo và cập nhật 100% các nơi tham chiếu: cả 5 vị trí tại `.agents/rules/02-quality.md:19,30,41,99,140`, `.agents/agents/planner/agent.md:57`, `.agents/scripts/claude-planner-prompt.md:64`, và `docs/lessons-learned.md:5`. Đồng thời bổ sung regex `/\.agents\/workflows\//` vào cổng `[2/5]` của `scripts/verify-docs.mjs:107-124` (bỏ qua các plan lịch sử trong `docs/plans/`) để tự động bắt mọi tham chiếu sót.                                                                                                                   |
|  4  | **Cập nhật `Status: Completed` cho file kế hoạch cũ (`2026-10-19-vitest-upgrade-and-add-model-skill.md`) giữa chừng** làm `mtimeMs` của file đó mới hơn file kế hoạch hiện tại (`entries[0]` tại `.agents/scripts/code-freeze-guard.js:201-205`), gây khóa repo sớm. | **Trung bình** | **Technical Control**: Quy định nghiêm ngặt tại Mục 3.2 và Bước 5: tuyệt đối không chạm vào `docs/plans/2026-10-19-vitest-upgrade-and-add-model-skill.md` trong suốt quá trình sửa code. Chỉ ở thao tác cuối cùng của Bước 5 (sau khi mọi chỉnh sửa và lệnh verify đã hoàn tất), mới cập nhật `2026-10-19-vitest-upgrade-and-add-model-skill.md` sang `Status: Completed` trước, rồi cập nhật `2026-10-19-remake-agents-governance-v2-implementation-plan.md` sang `Status: Completed` sau cùng.                                                                                    |
|  5  | **Di chuyển bớt mục cũ từ `docs/CHANGELOG.md` sang `docs/archive/CHANGELOG-legacy.md`** làm lệch tổng số heading `## ` khiến cổng `[5/5]` (`scripts/verify-docs.mjs:233-296`) báo lỗi khi truyền `--expected-headings`.                                              |    **Thấp**    | **Technical Control**: Cổng `[5/5]` (`scripts/verify-docs.mjs:274`) kiểm tra `totalHeadings === expectedHeadings` trên tổng số dòng `^## ` của cả 2 file cộng lại (`38 + 74 = 112` hiện tại + `1` mục mới = `113`: gồm `7` current + `106` legacy). Thực hiện cắt/dán nguyên vẹn khối dòng 122–847 từ `docs/CHANGELOG.md` sang `docs/archive/CHANGELOG-legacy.md`, cập nhật ngày lưu trữ ở `docs/CHANGELOG.md:7` & `docs/archive/CHANGELOG-legacy.md:3`, và chạy `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=113` để xác nhận khớp chính xác `113 == 113`. |

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

[PLAN_APPROVED]
