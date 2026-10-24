# Kế Hoạch Triển Khai: Đảo Vai Trò Thực Thi Planner & Reviewer (Dual-Planner Claude CLI Primary & Dual-Reviewer @reviewer Primary)

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-19
- **Author**: Subagent `@planner` (`[PLANNER_MODEL: gemini-4-argon]`)

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### 1.1 Mục Tiêu (Goal)

1. **Thiết lập kiến trúc Dual-Planner (Claude Code CLI Primary + Subagent `@planner` Fallback)**:
   - **Primary Planner**: Sử dụng **Claude Code CLI** qua script `.agents/scripts/run-claude.ps1 -Role planner` nạp prompt template chuẩn hóa mới `.agents/scripts/claude-planner-prompt.md` (chứa đầy đủ 10 mục bắt buộc của kế hoạch, 8 nguyên lý kỹ thuật `pstack`, Tech Stack bất biến của Vikini, quy tắc Online Grounding 2026, và quy trình cập nhật tại chỗ _In-Place Plan Updating_ khi nhận `[CHANGES_REQUESTED]` trong Revision Loop).
   - **Fallback Planner**: Khi Claude Code CLI chạm trần quota Claude Pro (`exit code 42` / `[CLAUDE_PRO_QUOTA_EXCEEDED]`) hoặc lỗi kết nối / chưa xác thực (`exit code 40/41`), Orchestrator tự động chuyển giao ngay lập tức sang **Subagent `@planner`** (chạy mô hình `gemini-4-argon` với thinking budget tối đa).
2. **Thiết lập kiến trúc Dual-Reviewer đảo chiều (Subagent `@reviewer` Primary + Claude Code CLI Fallback)**:
   - **Primary Reviewer**: Sử dụng **Subagent `@reviewer`** (`gemini-4-argon` với thinking budget tối đa) làm kênh thẩm định ưu tiên 1. Bổ sung quyền công cụ `write_to_file` và `replace_file_content` vào YAML frontmatter của `.agents/agents/reviewer/agent.md` kèm ràng buộc **Audit-Only Write Scope** (chỉ được phép append báo cáo `### Audit Run [X+1]` vào mục `## Audit History`, cập nhật dòng `- **Status**:` ở header và ghi thẻ `[PLAN_APPROVED]` ở dòng cuối cùng của file kế hoạch tại `docs/plans/*.md` cùng bản đồng bộ `implementation_plan.md`; nghiêm cấm sửa `## Technical Plan` hay bất kỳ file mã nguồn nào).
   - **Fallback Reviewer**: Khi Subagent `@reviewer` chạm giới hạn quota/rate limit (HTTP 429) hoặc gặp sự cố hệ thống, Orchestrator tự động chuyển giao sang **Claude Code CLI** qua `.agents/scripts/run-claude.ps1 -Role reviewer` nạp `.agents/scripts/claude-reviewer-prompt.md`.
3. **Nâng cấp `.agents/scripts/run-claude.ps1` và hệ thống chốt chặn `.agents/scripts/code-freeze-guard.js`**:
   - Mở rộng `run-claude.ps1` hỗ trợ đa chế độ `-Role planner|reviewer` (kèm alias `-Mode` và hỗ trợ giá trị `plan|review`), tham số `-Task` (alias `-Prompt`), `-PlanFile`, `-ArtifactFile`, `-Model`, `-CheckOnly`; xử lý an toàn đường dẫn file kế hoạch chưa tồn tại trên đĩa khi tạo plan mới (`Normalize-PlanPath`); phân tách `--allowedTools` theo từng role (`Write,Edit` cho `planner`, chỉ `Edit` cho `reviewer`); tự động đồng bộ sang `-ArtifactFile` (nếu truyền vào) và bảo toàn cơ chế phát hiện hết quota `exit 42`.
   - Cập nhật regex allowlist và thông báo trong `.agents/scripts/code-freeze-guard.js` cùng bộ unit test co-located `.agents/scripts/code-freeze-guard.test.ts`.
4. **Đồng bộ hóa tài liệu Governance & Living Docs**:
   - Cập nhật `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/rules/05-plan-review.md`, `.agents/agents/planner/agent.md`, `.agents/agents/reviewer/agent.md`, `.agents/README.md`, `docs/architecture.md`, `docs/plans/README.md`, và `docs/CHANGELOG.md` tuân thủ nghiêm ngặt giới hạn ký tự Governance (`.agents/rules/*.md <= 12,000` ký tự, `.agents/agents/*/agent.md <= 10,000` ký tự).

#### 1.2 Out of Scope (What We're NOT Doing)

- **Không** thay đổi bất kỳ mã nguồn ứng dụng nào trong `src/` (`src/app/`, `src/lib/`, `src/components/`, `src/types/`).
- **Không** thay đổi cấu hình hạ tầng kiểm thử (`package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `.agents/hooks.json`, `scripts/code-freeze-guard.js`).
- **Không** sửa nội dung 3 tài liệu vệ tinh của Reviewer (`.agents/agents/reviewer/allowlist.md`, `.agents/agents/reviewer/evidence-bar.md`, `.agents/agents/reviewer/mental-simulation.md`) và không sửa `.agents/agents/qa/agent.md` vì các quy chuẩn kiểm chứng S1–S6, Evidence Bar và QA On-Demand giữ nguyên.
- **Không** sửa các bản kế hoạch lịch sử đã hoàn thành trong `docs/plans/` hoặc `docs/archive/`.
- **Không** cấp quyền ghi vào `src/**` hay `.agents/**` cho `@reviewer` hoặc `@planner` ở tầng Code Freeze Guard (`code-freeze-guard.js` vẫn giữ nguyên Scoped Protection Phương án 2).
- **Không** tự động chạy các lệnh `git` mutating (`git add`, `git commit`, `git push`, `git branch`) theo `.agents/rules/00-core.md` §Git Operations.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### 2.1 Tài Liệu Governance & Codebase Đã Đọc Bằng `view_file` Trong Phiên Khảo Sát

| File                                        | Số dòng hiện tại | UTF-8 Bytes | UTF-16 Chars (`verify-docs.mjs`) | Trần Ký Tự (`verify-docs.mjs`) | Vai trò trong Task                                                                                                                   |
| :------------------------------------------ | ---------------: | ----------: | -------------------------------: | -----------------------------: | :----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                  |               68 |       3,423 |                           ~2,850 |                    `<= 12,000` | `[MODIFY]` Cập nhật mục Non-Negotiables (Zero-Self-Execution & Uninterrupted Chain)                                                  |
| `.agents/rules/01-coding.md`                |              143 |       9,846 |                           ~7,850 |                    `<= 12,000` | `[MODIFY]` Cập nhật bảng Trạng Thái Cưỡng Chế (Kỷ Luật Agent & Reviewer)                                                             |
| `.agents/rules/02-quality.md`               |              160 |      11,588 |                           ~9,250 |                    `<= 12,000` | `[MODIFY]` Cập nhật Pre-Work Protocol note, Skill Precedence Tầng 1, Test Failure Triage Loại C                                      |
| `.agents/rules/05-plan-review.md`           |              100 |      10,381 |                           ~8,250 |                    `<= 12,000` | `[MODIFY]` Cập nhật Dual-Planner Architecture (§2), Dual-Reviewer đảo chiều (§3), §1, §5, §6                                         |
| `.agents/agents/planner/agent.md`           |               97 |       9,185 |                           ~7,300 |                    `<= 10,000` | `[MODIFY]` Chuyển vai trò thành Fallback Technical Planner (`gemini-4-argon`), giữ đủ 10 mục & pstack                                |
| `.agents/agents/reviewer/agent.md`          |              116 |       9,751 |                           ~7,800 |                    `<= 10,000` | `[MODIFY]` Chuyển thành Primary Lead Architecture Reviewer, thêm `write_to_file` & `replace_file_content` kèm Audit-Only Write Scope |
| `.agents/scripts/run-claude.ps1`            |              111 |       3,744 |                           ~3,150 |                            N/A | `[MODIFY]` Hỗ trợ `-Role planner                                                                                                     | reviewer`, `-Task`, `-PlanFile`, `-ArtifactFile`, `Normalize-PlanPath`, `--allowedTools` theo role |
| `.agents/scripts/claude-reviewer-prompt.md` |               42 |       4,034 |                           ~3,200 |                            N/A | `[MODIFY]` Cập nhật vai trò Fallback Reviewer, đồng bộ cổng 7 mục & cập nhật `- **Status**:` header                                  |
| `.agents/scripts/code-freeze-guard.js`      |              726 |      25,012 |                          ~24,800 |                            N/A | `[MODIFY]` Mở rộng regex `READ_ONLY_COMMANDS` cho `run-claude.ps1` (`-NoProfile`, quoted path) và cập nhật comment/reason            |
| `.agents/scripts/code-freeze-guard.test.ts` |              910 |      32,734 |                          ~32,600 |                            N/A | `[MODIFY]` Bổ sung unit tests cho lệnh `run-claude.ps1 -Role planner                                                                 | reviewer` và negative shell-escape probes                                                          |
| `.agents/README.md`                         |              106 |       9,686 |                           ~7,750 |                            N/A | `[MODIFY]` Cập nhật sơ đồ MAS Workflow, vai trò cốt lõi và bảng Task-to-Model Routing                                                |
| `docs/architecture.md`                      |              290 |      15,453 |                          ~13,800 |                            N/A | `[MODIFY]` Cập nhật mục `## 7. Multi-Agent Governance Architecture`                                                                  |
| `docs/plans/README.md`                      |               26 |       3,043 |                           ~2,450 |                            N/A | `[MODIFY]` Cập nhật mô tả chu trình Plan-Review-Revise và thêm dòng vào Status Matrix                                                |
| `scripts/verify-docs.mjs`                   |              303 |      10,433 |                          ~10,400 |                            N/A | Chỉ đọc (Dùng để đối chiếu logic kiểm tra link `[1/5]`, shorthand `[3/5]`, giới hạn ký tự `[4/5]`)                                   |

#### 2.2 Skills Loaded & Applied (Bằng Chứng Nạp & Áp Dụng Skill)

| Skill / Quy chuẩn đã đọc bằng `view_file`                                                                                         | Quyết định kỹ thuật trong kế hoạch chịu ảnh hưởng trực tiếp                                                                                                                                                                                                                                                                                    |
| :-------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` (dòng 1–97)                                                                          | Áp dụng Mode 1 (`/how`) và Mode 4 (`/blast-radius`) để lần theo luồng thực thi `hooks.json` ➔ `scripts/code-freeze-guard.js` ➔ `.agents/scripts/code-freeze-guard.js` (`isPlanApproved`, `READ_ONLY_COMMANDS`, `decide`) và xác định mọi file tham chiếu tới `@planner`/`@reviewer`/`run-claude.ps1`.                                          |
| `.agents/rules/02-quality.md` §Pre-Work Protocol & §Governance-Only Changes (dòng 8–37, 110–120)                                  | Xác định task thuộc miền Governance & Hook Script (không chạm API Route, SSE Streaming, DB Migration hay UI Component nên không kích hoạt các skill miền ứng dụng đó). Áp đặt kiểm tra dung lượng ký tự nghiêm ngặt cho mọi file `.agents/rules/*.md` (`<= 12,000`) và `.agents/agents/*/agent.md` (`<= 10,000`, mục tiêu an toàn `<= 9,200`). |
| `.agents/rules/05-plan-review.md` §1–§6 (dòng 1–100)                                                                              | Thiết kế quy trình phê duyệt sao cho khi `@reviewer` ghi `[PLAN_APPROVED]` ở dòng cuối cùng, `@reviewer` đồng thời cập nhật dòng `- **Status**: Approved` trên phần đầu file (dòng 1–30) để vượt qua chốt kiểm tra `isPending` tại `.agents/scripts/code-freeze-guard.js:207-214`.                                                             |
| `.agents/rules/01-coding.md` §Testing Requirements (dòng 61–71) & `.agents/rules/02-quality.md` §Test Failure Triage (dòng 78–95) | Bổ sung unit tests mới vào file test co-located `.agents/scripts/code-freeze-guard.test.ts` (tuân thủ phân loại Loại C — chỉ thêm test cases mới, giữ nguyên 84/84 test cases hiện hữu, không xóa `expect()` hay nới lỏng matcher).                                                                                                            |

---

### 3. Assumptions & Cross-Task Dependencies

#### 3.1 Assumptions (Giả Định Kỹ Thuật Kèm Dẫn Chứng `[SRC]` / `[CMD]`)

- **A1 `[SRC]` (Cơ chế kiểm tra `isPlanApproved()` trong `code-freeze-guard.js`)**: Trong `.agents/scripts/code-freeze-guard.js:206-228`, hàm `isPlanApproved()` đọc file kế hoạch có `mtimeMs` mới nhất trong `docs/plans/` (loại trừ `README.md`) và thực hiện 2 kiểm tra:
  1. Kiểm tra 30 dòng đầu (`headerLines`): nếu khớp regex `/(?:\*\*|\b)(?:Status|Trạng thái)(?:\*\*|\b)?\s*:\s*(?:Draft|In Review|Ready for Review|Changes Requested|Chờ Duyệt)/i` thì trả về `false` ngay lập tức (`code-freeze-guard.js:208-214`).
  2. Kiểm tra dòng văn bản không rỗng cuối cùng (`lastLine`): phải bằng hoặc kết thúc bằng `"[PLAN_APPROVED]"` (`code-freeze-guard.js:225-228`).
     ➔ **Hệ quả thiết kế**: Khi `@reviewer` (hoặc Fallback Claude CLI Reviewer) phê duyệt kế hoạch, ngoài việc ghi `[PLAN_APPROVED]` ở dòng cuối cùng, Reviewer BẮT BUỘC phải dùng `replace_file_content` cập nhật dòng header `- **Status**: Ready for Review` (hoặc `Changes Requested`) thành `- **Status**: Approved`. Ngược lại, khi trả `[CHANGES_REQUESTED]`, Reviewer cập nhật header thành `- **Status**: Changes Requested`.
- **A2 `[SRC]` (Lỗi tiềm ẩn của `Resolve-Path -Relative` khi tạo file plan mới trong `run-claude.ps1`)**: Trong `.agents/scripts/run-claude.ps1:72` hiện tại, lệnh `$relPlanFile = Resolve-Path -Relative $PlanFile` đòi hỏi đường dẫn `$PlanFile` phải tồn tại sẵn trên đĩa. Khi Claude CLI đóng vai trò **Primary Planner** để khởi tạo một file kế hoạch `[NEW]` chưa từng tồn tại trên đĩa, `Resolve-Path` sẽ ném lỗi `PathNotFound` và trả về `$null`.
  ➔ **Hệ quả thiết kế**: Trong `run-claude.ps1`, phải thay thế `Resolve-Path -Relative` trực tiếp bằng hàm `Normalize-PlanPath` chuẩn hóa đường dẫn tương đối POSIX (`docs/plans/...`) hoạt động an toàn cả khi file đã tồn tại (Revision Loop / Reviewer mode) lẫn khi file chưa tồn tại (New Plan mode), kèm kiểm tra regex đường dẫn hợp lệ thuộc `docs/plans/*.md` (khác `README.md`).
- **A3 `[SRC]` (Quyền ghi file kế hoạch của `@reviewer` dưới sự kiểm soát của `code-freeze-guard.js`)**: Trong `.agents/scripts/code-freeze-guard.js:39-42,445-470`, mọi thao tác `write_to_file` và `replace_file_content` nhắm vào `docs/**`, `implementation_plan.md`, hoặc `~/.gemini/antigravity/brain/**` đều được Gate 1 và Gate 3 cho phép (`{ decision: "allow" }`), trong khi mọi thao tác ghi vào `src/**` (ngoài Fast-Track) hoặc `.agents/**` đều bị chặn (`{ decision: "ask" }`). Do đó, khi thêm `write_to_file` và `replace_file_content` vào frontmatter `tools:` của `.agents/agents/reviewer/agent.md`, `@reviewer` có thể ghi trực tiếp vào `docs/plans/*.md` và `implementation_plan.md` mà không bị hook chặn, đồng thời vẫn bị tầng platform khóa chặt nếu cố tình ghi vào `.agents/**` hay `src/**`.
- **A4 `[CMD]` (Trạng thái Baseline của Type-Check và Test Suite)**: Chạy lệnh `npm run type-check; npx vitest run .agents/scripts/code-freeze-guard.test.ts` đạt exit code `0`, pass `84/84` tests trong `.agents/scripts/code-freeze-guard.test.ts`.
- **A5 `[SRC]` (Cơ chế kiểm tra giới hạn ký tự của `scripts/verify-docs.mjs`)**: Trong `scripts/verify-docs.mjs:198-231`, giới hạn ký tự được đo bằng `fs.readFileSync(filePath, "utf8").length` (đơn vị UTF-16 code units: `.agents/rules/*.md <= 12000`, `.agents/agents/*/agent.md <= 10000`). Ngoài ra, mục `[5/5]` của `scripts/verify-docs.mjs:266` kiểm tra `CHANGELOG.md < 35,000 bytes` hiện đang vượt từ các task trước (126,157 bytes).

#### 3.2 Cross-Task Dependencies

- File `.agents/scripts/claude-planner-prompt.md` (`[NEW]`) phải được tạo trước khi chạy hoặc kiểm thử `.agents/scripts/run-claude.ps1 -Role planner` (vì `run-claude.ps1` kiểm tra `Test-Path $templatePath` trước khi gọi `claude.exe`).
- Mọi thao tác chỉnh sửa các file trong `.agents/**` sẽ đi qua Gate 7 (`isGovernanceFile`) của `.agents/scripts/code-freeze-guard.js:525-533` và hiển thị hộp thoại xác nhận `ask` cho người dùng — đây là hành vi bảo mật có chủ đích của hệ thống.

#### 3.3 Các Điểm Quyết Định Sản Phẩm (`[NEEDS_PRODUCT_DECISION]` — Đã Chọn Default Assumption)

- **D1 — Giá trị mặc định của tham số `-Role` trong `.agents/scripts/run-claude.ps1`**:
  - _Phương án A (Default Assumption)_: Đặt mặc định `[string]$Role = "planner"` (kèm `[Alias("Mode")]` và chấp nhận cả `"planner"`, `"plan"`, `"reviewer"`, `"review"`), vì trong kiến trúc mới Claude Code CLI có vai trò chính (Primary) là **Planner**, còn khi dùng làm Fallback Reviewer thì Orchestrator gọi tường minh `-Role reviewer`.
  - _Phương án B_: Bắt buộc truyền `-Role` (`Mandatory = $true`) ở mọi lần gọi trừ khi có `-CheckOnly`. (Không chọn làm mặc định vì có thể làm gãy các lệnh gọi nhanh không truyền `-Role`).
- **D2 — Tập quyền `--allowedTools` của Claude Code CLI theo từng Role trong `run-claude.ps1`**:
  - _Phương án A (Default Assumption)_: Phân권 tách biệt theo nguyên tắc Least Privilege:
    - Khi `-Role planner`: `--allowedTools "Read,Write,Edit,Glob,Grep,LS,WebSearch,WebFetch,Bash(npm:*,git:*,npx:*,node:*)"` (cần cả `Write` để tạo file kế hoạch mới và `Edit` để cập nhật Revision Loop, cộng thêm `WebSearch,WebFetch` để tra cứu trực tuyến 2026).
    - Khi `-Role reviewer`: `--allowedTools "Read,Edit,Glob,Grep,LS,WebSearch,WebFetch,Bash(npm:*,git:*,npx:*,node:*)"` (chỉ cấp `Edit` trên file kế hoạch đã tồn tại, không cấp `Write` tạo file mới).
  - _Phương án B_: Dùng chung một chuỗi `--allowedTools` cho cả 2 role. (Không chọn vì cấp `Write` cho Reviewer là dư thừa so với nhu cầu chỉ sửa file plan hiện hữu).

---

### 4. Bảng Verified Versions (Xác Minh Thực Tế Năm 2026)

Đối chiếu trực tiếp từ `package.json:38-121` (`[SRC]`) và tài liệu chính thức năm 2026 (`[URL]`):

| Thành Phần / Thư Viện          | Phiên Bản Trong `package.json` / Hệ Thống | Trạng Thái Tương Thích (2026)                                                                  | Vai Trò Trong Task Này                                                                   |
| :----------------------------- | :---------------------------------------- | :--------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| `node` (Runtime)               | `24.x` (`package.json:120`)               | Active LTS (2026), hỗ trợ native ESM `node:fs`, `node:path`, `node:url`                        | Chạy `.agents/scripts/code-freeze-guard.js` và `scripts/verify-docs.mjs`                 |
| `typescript`                   | `^5.9.3` (`package.json:115`)             | Stable (2026), kiểm tra kiểu JSDoc qua `allowJs: true` + `// @ts-check` (`tsconfig.json:4,31`) | Chạy `npm run type-check` xác minh `code-freeze-guard.js` và `code-freeze-guard.test.ts` |
| `vitest`                       | `^4.1.11` (`package.json:117`)            | Stable v4 (2026)                                                                               | Chạy unit tests tại `.agents/scripts/code-freeze-guard.test.ts`                          |
| `eslint`                       | `^9.39.2` (`package.json:101`)            | Stable v9 Flat Config (`eslint.config.mjs`)                                                    | Chạy `npm run lint` trong cổng `npm run verify`                                          |
| `next`                         | `^16.4.0` (`package.json:64`)             | Stable App Router (2026)                                                                       | Quy chiếu trong Tech Stack bất biến của `claude-planner-prompt.md`                       |
| `@google/genai`                | `^2.10.0` (`package.json:40`)             | Stable SDK (2026)                                                                              | Quy chiếu trong Tech Stack bất biến của `claude-planner-prompt.md`                       |
| `@anthropic-ai/sdk`            | `^0.71.2` (`package.json:39`)             | Stable SDK (2026)                                                                              | Quy chiếu trong Tech Stack bất biến của `claude-planner-prompt.md`                       |
| Claude Code CLI (`claude.exe`) | Cài đặt tại `~/.local/bin/claude.exe`     | Hỗ trợ cờ `-p` (print mode), `--allowedTools`, `--model`, `--dangerously-skip-permissions`     | Công cụ thực thi Primary Planner và Fallback Reviewer qua `run-claude.ps1`               |
| Windows PowerShell             | `5.1` (Windows OS)                        | Mặc định trên Windows; dùng `;` nối lệnh thay vì `&&`                                          | Thực thi `.agents/scripts/run-claude.ps1`                                                |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### `[NEW]` (1 file)

| File Path                                  | Mô Tả Chi Tiết                                                                                                                                                             |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/scripts/claude-planner-prompt.md` | Prompt template chuẩn hóa dành cho Claude Code CLI khi vận hành ở chế độ Primary Technical Planner (bao gồm cả tạo kế hoạch mới và cập nhật In-Place trong Revision Loop). |

#### `[MODIFY]` (12 files)

| File Path                                                           | Mô Tả Chi Tiết                                                                                                                                                                                                                                                                                                                                                   |
| :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/scripts/run-claude.ps1`                                    | Nâng cấp hỗ trợ tham số `-Role` (`planner`/`reviewer`, alias `-Mode`), `-Task` (alias `-Prompt`), `-PlanFile`, `-ArtifactFile`, `-Model`, `-CheckOnly`; bổ sung hàm `Normalize-PlanPath`; nạp prompt template theo role; phân quyền `--allowedTools` riêng cho `planner` vs `reviewer`; tự động đồng bộ `-ArtifactFile`; giữ cơ chế bắt lỗi quota `exit 42`.     |
| `.agents/scripts/claude-reviewer-prompt.md`                         | Cập nhật định danh thành Fallback Lead Code & Architecture Reviewer (`[REVIEWER_MODEL: claude-code-cli (fallback)]`), đồng bộ đủ 7 mục Plan Completeness Gate, quy tắc "Các Tấn Công Đã Thử" và bắt buộc cập nhật dòng `- **Status**: Approved` / `Changes Requested` ở phần header của file kế hoạch.                                                           |
| `.agents/agents/planner/agent.md`                                   | Cập nhật vai trò thành Fallback Technical Planner (`gemini-4-argon`, thinking budget tối đa) kích hoạt khi Claude CLI Planner trả mã lỗi `42` hoặc lỗi kết nối; cập nhật hướng dẫn Uninterrupted Chain Transfer sang Primary Reviewer `@reviewer`.                                                                                                               |
| `.agents/agents/reviewer/agent.md`                                  | Cập nhật vai trò thành Primary Lead Architecture Reviewer (`gemini-4-argon`, thinking budget tối đa); bổ sung `write_to_file` và `replace_file_content` vào `tools:` frontmatter; quy định rõ quy trình ghi trực tiếp `### Audit Run [X+1]`, cập nhật `- **Status**:` header và ghi `[PLAN_APPROVED]` ở dòng cuối cùng kèm ràng buộc **Audit-Only Write Scope**. |
| `.agents/rules/00-core.md`                                          | Cập nhật mục `Zero-Self-Execution & Uninterrupted Chain` (dòng 43) phản ánh đúng Primary Planner (Claude Code CLI) + Fallback `@planner` và Primary Reviewer (`@reviewer`) + Fallback Claude Code CLI.                                                                                                                                                           |
| `.agents/rules/01-coding.md`                                        | Cập nhật bảng `Trạng Thái Cưỡng Chế` (dòng 16) phản ánh Lead Reviewer (`@reviewer` primary / Claude CLI fallback) và thinking budget max cho `@reviewer` / `@planner` fallback.                                                                                                                                                                                  |
| `.agents/rules/02-quality.md`                                       | Cập nhật dòng 36 (Pre-Work Protocol), dòng 41 (Skill Precedence Tầng 1), và dòng 86 (Test Failure Triage Loại C) khớp với kiến trúc Dual-Planner & Dual-Reviewer mới.                                                                                                                                                                                            |
| `.agents/rules/05-plan-review.md`                                   | Cập nhật toàn diện §1 (Code Freeze), §2 (Zero-Self-Execution & Dual-Planner Architecture), §3 (Dual-Reviewer Architecture đảo chiều & Uninterrupted Execution Chain), §5 (Cấu trúc file kế hoạch & cập nhật header `Status`), và §6 (Pre-Flight Gate).                                                                                                           |
| `.agents/scripts/code-freeze-guard.js`                              | Cập nhật regex `READ_ONLY_COMMANDS` (hỗ trợ thêm cờ `-NoProfile` và dấu ngoặc kép quanh đường dẫn `.agents/scripts/run-claude.ps1`) cùng JSDoc/reason message phản ánh Dual-Reviewer mới.                                                                                                                                                                        |
| `.agents/scripts/code-freeze-guard.test.ts`                         | Bổ sung các unit test cases kiểm chứng lệnh `run-claude.ps1` với `-Role planner`, `-Role reviewer`, `-Mode`, `-Task`, `-ArtifactFile`, `-NoProfile`, và các negative test cases chặn shell injection trên `run-claude.ps1`.                                                                                                                                      |
| `.agents/README.md`                                                 | Cập nhật sơ đồ luồng MAS Workflow (§1), mô tả 5 vai trò cốt lõi, và bảng Agent Task-to-Model Routing (§4).                                                                                                                                                                                                                                                       |
| `docs/architecture.md`, `docs/plans/README.md`, `docs/CHANGELOG.md` | Cập nhật mục `## 7. Multi-Agent Governance Architecture` trong `docs/architecture.md`, cập nhật `docs/plans/README.md`, và ghi nhận bản phát hành mới vào `docs/CHANGELOG.md`.                                                                                                                                                                                   |

#### `[DELETE]` (0 files)

- Không xóa file nào trong dự án.

---

### 6. Caller-First Design Sketch

#### 6.1 Phía Người Gọi (Orchestrator Call Sites qua `run_command`)

```powershell
# 1. Pre-flight check cài đặt & xác thực Claude Code CLI
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -CheckOnly

# 2. Primary Planner — Khởi tạo kế hoạch mới (file chưa tồn tại trên đĩa)
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/2026-10-19-feature-x-implementation-plan.md -Task "Thiết kế tính năng X tuân thủ ranh giới lib/features"

# 3. Primary Planner — Cập nhật kế hoạch tại chỗ trong Revision Loop (file đã tồn tại và có [CHANGES_REQUESTED])
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/2026-10-19-feature-x-implementation-plan.md -Task "Khắc phục toàn bộ lỗi [BLOCKER] và [MAJOR] trong Audit Run 1"

# 4. Fallback Reviewer — Chỉ gọi khi Primary Subagent @reviewer chạm quota / lỗi hệ thống
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/2026-10-19-feature-x-implementation-plan.md
```

#### 6.2 Phía Script Điều Phối (`.agents/scripts/run-claude.ps1` Interface & Dispatch Sketch)

```powershell
# @ts-check
param(
    [Parameter(Position=0)]
    [string]$PlanFile = "",

    [ValidateSet("planner", "reviewer", "plan", "review")]
    [Alias("Mode")]
    [string]$Role = "planner",

    [Alias("Prompt")]
    [string]$Task = "",

    [string]$ArtifactFile = "",

    [string]$Model = "",

    [switch]$CheckOnly
)

$normalizedRole = if ($Role -in @("reviewer", "review")) { "reviewer" } else { "planner" }

function Normalize-PlanPath([string]$RawPath) {
    $repoRoot = (Get-Location).Path
    $candidate = $RawPath.Trim()
    if ([System.IO.Path]::IsPathRooted($candidate)) {
        if ($candidate.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            $candidate = $candidate.Substring($repoRoot.Length)
        } else {
            return ""
        }
    }
    $candidate = ($candidate -replace '^[.][\\/]+', '') -replace '^[\\/]+', '' -replace '\\', '/'
    return $candidate
}
```

- **Ràng buộc an toàn đường dẫn trong `run-claude.ps1`**:
  - Nếu `-not $PlanFile`: tự động tìm file `.md` mới nhất trong `docs/plans/` (trừ `README.md`). Nếu không tìm thấy file nào ➔ báo lỗi `[PLAN_NOT_FOUND]` và `exit 1`.
  - Chuẩn hóa `$relPlanFile = Normalize-PlanPath $PlanFile`.
  - Kiểm tra `$relPlanFile`: bắt buộc khớp `^docs/plans/[A-Za-z0-9._-]+\.md$`, không chứa `..`, và khác `docs/plans/README.md`. Nếu vi phạm ➔ báo lỗi `[INVALID_PLAN_PATH]` và `exit 1`.
  - Nếu `$normalizedRole -eq "reviewer"` mà `-not (Test-Path -LiteralPath $relPlanFile)` ➔ báo lỗi `[PLAN_NOT_FOUND]` và `exit 1`.
  - Nếu `$normalizedRole -eq "planner"`:
    - Nạp `.agents/scripts/claude-planner-prompt.md`.
    - Thay thế các placeholder `{{PLAN_FILE}}`, `{{ARTIFACT_FILE}}`, `{{PLAN_MODE}}`, `{{TASK_BRIEF}}`.
    - Cấu hình `--allowedTools "Read,Write,Edit,Glob,Grep,LS,WebSearch,WebFetch,Bash(npm:*,git:*,npx:*,node:*)"`.
  - Nếu `$normalizedRole -eq "reviewer"`:
    - Nạp `.agents/scripts/claude-reviewer-prompt.md`.
    - Thay thế `{{PLAN_FILE}}`.
    - Cấu hình `--allowedTools "Read,Edit,Glob,Grep,LS,WebSearch,WebFetch,Bash(npm:*,git:*,npx:*,node:*)"`.
  - Sau khi chạy `& $claudeExe @cliArgs`:
    - Nếu `$LASTEXITCODE -eq 0` và `$ArtifactFile` được truyền vào và `Test-Path -LiteralPath $relPlanFile`: tự động đồng bộ `Copy-Item -LiteralPath $relPlanFile -Destination $ArtifactFile -Force`.
    - Nếu phát hiện lỗi quota (`Usage limit reached`, `Rate limit reached`, `Failed to authenticate`, `API Error: 429`, `overloaded_error`, `credit balance is too low`) ➔ in cảnh báo `[CLAUDE_PRO_QUOTA_EXCEEDED]` và `exit 42`.

#### 6.3 Phía Guard & Unit Test (`.agents/scripts/code-freeze-guard.js` & `.test.ts`)

```js
// Trong .agents/scripts/code-freeze-guard.js (dòng 63):
/^powershell(?:\.exe)?\s+(?:-(?:NoProfile|ExecutionPolicy\s+\w+)\s+)*-File\s+["']?\.agents[/\\]scripts[/\\]run-claude\.ps1["']?(?:\s+.*)?$/,
```

```ts
// Trong .agents/scripts/code-freeze-guard.test.ts:
expect(
  decide({
    command:
      'powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/2026-10-19-x.md -Task "Create plan"',
  }).decision
).toBe("allow");

expect(
  decide({
    command:
      "powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/2026-10-19-x.md",
  }).decision
).toBe("allow");

expect(
  decide({
    command:
      "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner && rm -rf src",
  }).decision
).toBe("ask");
```

---

### 7. Các Bước Thực Hiện Tuần Tự

> **Lưu ý thực thi**: Mọi chỉnh sửa trên `.agents/**` đều được `code-freeze-guard.js` bảo vệ ở chế độ `ask`. Sau khi sửa `.agents/scripts/code-freeze-guard.js` và `.agents/scripts/code-freeze-guard.test.ts`, chạy ngay `npm run type-check; npx vitest run .agents/scripts/code-freeze-guard.test.ts` (Tier 1).

#### Bước 1 — Tạo mới Prompt Template cho Primary Planner (`.agents/scripts/claude-planner-prompt.md`)

- [ ] **1.1 `[NEW]` Tạo file `.agents/scripts/claude-planner-prompt.md`**:
  - Định nghĩa vai trò **Primary Technical Planner (Claude Code CLI)** cho dự án Vikini.
  - Khai báo 4 biến ngữ cảnh nhận từ `run-claude.ps1`: `{{PLAN_FILE}}`, `{{ARTIFACT_FILE}}`, `{{PLAN_MODE}}`, `{{TASK_BRIEF}}`.
  - Quy định **Bước 0 (Pre-Work Reading & Mandatory Skill Triggers)**: bắt buộc đọc `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/rules/05-plan-review.md` và nạp các file `.agents/skills/<name>/SKILL.md` tương ứng với miền nghiệp vụ của task.
  - Quy định rõ cấu trúc file kế hoạch tại `{{PLAN_FILE}}` gồm phần Header (`Revision`, `Status: Ready for Review`, `Date`, `Author: Claude Code CLI (Primary Technical Planner)`) và 2 phân khu bắt buộc:
    - `## Technical Plan` với **đầy đủ 10 mục bắt buộc**:
      1. `Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)`
      2. `Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied`
      3. `Assumptions & Cross-Task Dependencies` (kèm `[SRC]`/`[CMD]` và `[NEEDS_PRODUCT_DECISION]` nếu có)
      4. `Bảng Verified Versions` (đối chiếu `package.json` và tra cứu web năm 2026)
      5. `Files Cần Chỉnh Sửa / Tạo Mới` (`[NEW]`, `[MODIFY]`, `[DELETE]`)
      6. `Caller-First Design Sketch`
      7. `Các Bước Thực Hiện Tuần Tự` (checklist `- [ ]`)
      8. `Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)`
      9. `Kế Hoạch Kiểm Thử Co-Located & Verification Plan`
      10. `Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa`
    - `## Audit History` (để trống khi tạo mới; bảo toàn nguyên vẹn 100% khi cập nhật ở Revision Loop).
  - Nhúng đầy đủ **8 Nguyên Lý Kỹ Thuật Cốt Lõi (`pstack`)**, **Tech Stack & Ranh Giới Kiến Trúc Bất Biến Của Vikini** (cấm `any`, cấm Prisma/Better Auth, chuẩn token Tailwind v4, giới hạn ký tự Governance `<= 12,000` / `<= 10,000`), và **Quy Trình In-Place Plan Updating** khi xử lý `[CHANGES_REQUESTED]`.
  - Nhúng **Ràng Buộc Bắt Buộc (Strict Constraints)**: chỉ được phép ghi vào `{{PLAN_FILE}}` (và `{{ARTIFACT_FILE}}` nếu có); tuyệt đối cấm chạm vào `src/`, `app/`, `lib/`, `components/`, `package.json`, `.agents/`; tuyệt đối cấm tự ghi `[PLAN_APPROVED]`.

#### Bước 2 — Cập nhật Prompt Template cho Fallback Reviewer và nâng cấp `run-claude.ps1`

- [ ] **2.1 `[MODIFY]` Cập nhật `.agents/scripts/claude-reviewer-prompt.md`**:
  - Cập nhật tiêu đề và phần mở đầu: xác định vai trò **Fallback Lead Code & Architecture Reviewer (Claude Code CLI)** kích hoạt khi Primary Subagent `@reviewer` (`gemini-4-argon`) chạm giới hạn quota/rate limit hoặc gặp lỗi hệ thống.
  - Bổ sung `.agents/rules/02-quality.md`, `.agents/rules/05-plan-review.md`, và `.agents/agents/reviewer/allowlist.md` vào danh sách tài liệu chuẩn bắt buộc ở Mục 1.
  - Tại Mục 2.4 (`Cấu Trúc Nhận Xét Trong ### Audit Run [X+1]`):
    - Yêu cầu ghi nhãn `[REVIEWER_MODEL: claude-code-cli (fallback)]` ở dòng đầu của `### Audit Run [X+1]`.
    - Đồng bộ đủ **7 hạng mục Plan Completeness Gate** (1. Bảng Verified Versions, 2. Checklist `[NEW]`/`[MODIFY]`/`[DELETE]`, 3. Verification Plan, 4. Test Contract, 5. Assumptions & Cross-Task Dependencies, 6. Out of Scope, 7. Skills Loaded & Applied).
    - Bổ sung yêu cầu mục **Các Tấn Công Đã Thử (Attack Probes)** (tối thiểu 3 kịch bản tấn công kèm `[SRC]`/`[CMD]` nếu phê duyệt sạch không có lỗi mới).
  - Tại Mục 2.5 (`Quy Tắc Cấp Thẻ Phê Duyệt & Cập Nhật Trạng Thái Header`):
    - Khi trả `[CHANGES_REQUESTED]`: cập nhật dòng `- **Status**: Changes Requested` ở phần header của `{{PLAN_FILE}}` và không ghi thẻ approve.
    - Khi đạt chuẩn phê duyệt: cập nhật dòng `- **Status**: Approved` ở phần header của `{{PLAN_FILE}}` (để thỏa mãn `isPlanApproved()` trong `code-freeze-guard.js:207-214`) và ghi đúng thẻ `[PLAN_APPROVED]` ở **dòng văn bản cuối cùng** của file kế hoạch.
- [ ] **2.2 `[MODIFY]` Nâng cấp `.agents/scripts/run-claude.ps1`**:
  - Mở rộng khối `param(...)` nhận `$PlanFile`, `[ValidateSet("planner", "reviewer", "plan", "review")][Alias("Mode")][string]$Role = "planner"`, `[Alias("Prompt")][string]$Task = ""`, `[string]$ArtifactFile = ""`, `[string]$Model = ""`, `[switch]$CheckOnly`.
  - Chuẩn hóa `$normalizedRole = if ($Role -in @("reviewer", "review")) { "reviewer" } else { "planner" }`.
  - Bổ sung hàm `Normalize-PlanPath` để xử lý cả đường dẫn tương đối lẫn tuyệt đối trong repo thành dạng POSIX `docs/plans/...` mà không cần file phải tồn tại sẵn trên đĩa.
  - Kiểm tra tính hợp lệ của `$relPlanFile` (`^docs/plans/[A-Za-z0-9._-]+\.md$`, không chứa `..`, khác `docs/plans/README.md`). Nếu không hợp lệ thì `Write-Error "[INVALID_PLAN_PATH] ..."` và `exit 1`.
  - Nếu `$normalizedRole -eq "reviewer"` (hoặc `$normalizedRole -eq "planner"` khi không truyền `-PlanFile` và không truyền `-Task`), kiểm tra file phải tồn tại trên đĩa (`Test-Path -LiteralPath $relPlanFile`), nếu không tồn tại thì `Write-Error "[PLAN_NOT_FOUND] ..."` và `exit 1`.
  - Nhánh `$normalizedRole -eq "planner"`:
    - Nạp `.agents/scripts/claude-planner-prompt.md`.
    - Xác định `$planMode` (`CREATE_NEW` nếu file chưa tồn tại, `REVISION_OR_UPDATE` nếu file đã tồn tại).
    - Thay thế `{{PLAN_FILE}}`, `{{ARTIFACT_FILE}}`, `{{PLAN_MODE}}`, `{{TASK_BRIEF}}`.
    - Đặt `$allowedTools = "Read,Write,Edit,Glob,Grep,LS,WebSearch,WebFetch,Bash(npm:*,git:*,npx:*,node:*)"`.
  - Nhánh `$normalizedRole -eq "reviewer"`:
    - Nạp `.agents/scripts/claude-reviewer-prompt.md`.
    - Thay thế `{{PLAN_FILE}}`.
    - Đặt `$allowedTools = "Read,Edit,Glob,Grep,LS,WebSearch,WebFetch,Bash(npm:*,git:*,npx:*,node:*)"`.
  - Sau khi thực thi `& $claudeExe`:
    - Nếu `$LASTEXITCODE -eq 0` và `$ArtifactFile` không rỗng và `Test-Path -LiteralPath $relPlanFile`: tự động đồng bộ `Copy-Item -LiteralPath $relPlanFile -Destination $ArtifactFile -Force`.
    - Mở rộng bộ nhận diện hết quota (`Usage limit reached`, `Rate limit reached`, `Failed to authenticate`, `API Error: 429`, `overloaded_error`, `credit balance is too low`) và xuất thông báo `[CLAUDE_PRO_QUOTA_EXCEEDED]` phù hợp với từng role trước khi `exit 42`.

#### Bước 3 — Cập nhật cấu hình Subagents (`.agents/agents/planner/agent.md` & `.agents/agents/reviewer/agent.md`)

- [ ] **3.1 `[MODIFY]` Cập nhật `.agents/agents/planner/agent.md` (Ngân sách ký tự mục tiêu `<= 8,500` UTF-16 chars, trần cứng `<= 10,000`)**:
  - Cập nhật YAML frontmatter:
    - `description: Fallback Technical Planner agent (Gemini 4 Argon) for codebase survey, online tech research, and task implementation planning when Primary Claude CLI Planner exceeds quota.`
    - `role: Fallback Technical Planner`
  - Bổ sung mục **Cơ Chế Phân Công Planner (Dual-Planner Architecture)**:
    - Xác định `@planner` (`gemini-4-argon` với thinking budget tối đa) là **Fallback Technical Planner**, được Orchestrator kích hoạt tự động ngay khi Primary Planner (Claude Code CLI qua `.agents/scripts/run-claude.ps1 -Role planner`) trả mã thoát `42` (`[CLAUDE_PRO_QUOTA_EXCEEDED]`) hoặc lỗi kết nối CLI (`exit 40/41`).
    - Bắt buộc ghi rõ `- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])` ở phần mở đầu file kế hoạch.
  - Cập nhật mục **Quy Trình Phản Hồi Revision Loop & Circuit Breaker** (dòng 76, 86) và **RÀNG BUỘC BẮT BUỘC — Uninterrupted Chain Transfer** (dòng 96):
    - Khi nhận `[CHANGES_REQUESTED]` từ Lead Reviewer (Primary Subagent `@reviewer` hoặc Fallback Claude Code CLI), cập nhật tại chỗ `## Technical Plan`, giữ nguyên `## Audit History`, đặt lại `- **Status**: Ready for Review`.
    - Sau khi ghi xong file kế hoạch tại `docs/plans/` và đồng bộ `implementation_plan.md`, báo cáo tóm tắt để Orchestrator lập tức gọi **Primary Reviewer (`@reviewer`)** (hoặc Fallback Claude Code CLI nếu `@reviewer` chạm quota).
- [ ] **3.2 `[MODIFY]` Cập nhật `.agents/agents/reviewer/agent.md` (Ngân sách ký tự mục tiêu `<= 9,000` UTF-16 chars, trần cứng `<= 10,000`)**:
  - Cập nhật YAML frontmatter:
    - `description: Primary Lead Architecture Reviewer agent (Gemini 4 Argon) for independent plan auditing, mental simulation, and [PLAN_APPROVED] gatekeeping in Vikini.`
    - `role: Primary Lead Architecture Reviewer`
    - Bổ sung `write_to_file` và `replace_file_content` vào danh sách `tools:`:
      ```yaml
      tools:
        - view_file
        - list_dir
        - find_by_name
        - grep_search
        - search_web
        - read_url_content
        - run_command
        - write_to_file
        - replace_file_content
      ```
  - Tại **Bước 6 (`Phản Hồi Chuẩn Hóa & Ghi Trực Tiếp Vào File Kế Hoạch`)**:
    - Quy định rõ trách nhiệm của `@reviewer`: dùng `replace_file_content` (và `write_to_file` khi đồng bộ sang artifact `implementation_plan.md`) để:
      1. Ghi trực tiếp mục `### Audit Run [X+1]` (mở đầu bằng `[REVIEWER_MODEL: gemini-4-argon]`) vào cuối phần `## Audit History` của file kế hoạch `docs/plans/YYYY-MM-DD-<task>-implementation-plan.md`.
      2. Cập nhật dòng trạng thái `- **Status**:` ở phần header (30 dòng đầu của file kế hoạch):
         - Nếu còn lỗi `[BLOCKER]` hoặc `[MAJOR]`: đặt `- **Status**: Changes Requested`, kết luận `[CHANGES_REQUESTED]` và tuyệt đối không ghi thẻ approve.
         - Nếu đạt chuẩn phê duyệt: đặt `- **Status**: Approved` và ghi thẻ `[PLAN_APPROVED]` ở **dòng văn bản không rỗng cuối cùng** của file kế hoạch.
      3. Đồng bộ nội dung file kế hoạch đã cập nhật sang artifact `implementation_plan.md` (khi Orchestrator cung cấp đường dẫn artifact).
  - Tại **Cơ Chế Phân Công Reviewer (Dual-Reviewer Architecture)**:
    - `@reviewer` (`gemini-4-argon`, thinking budget Max) là **Primary Reviewer** (Kênh Thẩm Định Ưu Tiên 1).
    - Khi `@reviewer` chạm giới hạn quota/rate limit (HTTP 429) hoặc gặp sự cố hệ thống, Orchestrator tự động chuyển giao sang **Fallback Reviewer** là **Claude Code CLI** (`.agents/scripts/run-claude.ps1 -Role reviewer`).
  - Tại **RÀNG BUỘC BẮT BUỘC (STRICT CONSTRAINTS)**:
    - Thay câu cấm ghi file kế hoạch cũ bằng quy tắc **GIỚI HẠN GHI FILE NGHIÊM NGẶT (AUDIT-ONLY WRITE SCOPE)**: Công cụ `write_to_file` và `replace_file_content` CHỈ ĐƯỢC PHÉP thao tác trên file kế hoạch tại `docs/plans/*.md` và artifact `implementation_plan.md` để append `### Audit Run [X+1]` vào `## Audit History`, cập nhật dòng `- **Status**:` ở phần header, và ghi thẻ `[PLAN_APPROVED]` ở dòng cuối cùng.
    - **TUYỆT ĐỐI CẤM SỬA `## Technical Plan` HAY SOURCE CODE**: Nghiêm cấm chỉnh sửa nội dung giải pháp kỹ thuật trong `## Technical Plan`, xóa lịch sử Audit Run cũ, hoặc chạm vào bất kỳ file mã nguồn/cấu hình nào của dự án (`src/`, `app/`, `lib/`, `components/`, `package.json`, `.agents/`...).

#### Bước 4 — Cập nhật hệ thống Rules Quản Trị (`.agents/rules/00-core.md`, `01-coding.md`, `02-quality.md`, `05-plan-review.md`)

- [ ] **4.1 `[MODIFY]` `.agents/rules/00-core.md` (dòng 43)**:
  - Cập nhật bullet `Zero-Self-Execution & Uninterrupted Chain`:
    `- **Zero-Self-Execution & Uninterrupted Chain**: Orchestrator never self-plans and never pauses between planning and reviewing. Planning requires Primary Planner (Claude Code CLI via .agents/scripts/run-claude.ps1 -Role planner or fallback subagent @planner) and approval requires Lead Reviewer (Primary subagent @reviewer or fallback Claude Code CLI via .agents/scripts/run-claude.ps1 -Role reviewer) with [PLAN_APPROVED]. See .agents/rules/05-plan-review.md.`
- [ ] **4.2 `[MODIFY]` `.agents/rules/01-coding.md` (dòng 16)**:
  - Trong bảng `Trạng Thái Cưỡng Chế`, hàng `Kỷ Luật Agent & Reviewer`: cập nhật thành `Thinking budget max cho @reviewer / @planner fallback` và `Lead Reviewer (@reviewer primary / Claude CLI fallback) thẩm định độc lập`.
- [ ] **4.3 `[MODIFY]` `.agents/rules/02-quality.md` (dòng 36, 41, 86)**:
  - Dòng 36: đổi `(Claude CLI hoặc @reviewer fallback)` thành `(Primary @reviewer hoặc Fallback Claude CLI)`.
  - Dòng 41: đổi `chuỗi @planner → Reviewer → @qa` thành `chuỗi Planner (Claude CLI / @planner) → Reviewer (@reviewer / Claude CLI) → @qa`.
  - Dòng 86 (Loại C): đổi `Lead Reviewer (Claude CLI hoặc @reviewer)` thành `Lead Reviewer (@reviewer hoặc Fallback Claude CLI)`.
- [ ] **4.4 `[MODIFY]` `.agents/rules/05-plan-review.md` (Ngân sách ký tự mục tiêu `<= 9,500` UTF-16 chars, trần cứng `<= 12,000`)**:
  - Cập nhật `description` trong YAML frontmatter phản ánh cả **Dual-Planner Architecture** (Claude CLI primary + Gemini 4 Argon `@planner` fallback) và **Dual-Reviewer Architecture** (Gemini 4 Argon `@reviewer` primary + Claude CLI fallback).
  - Cập nhật **§1 (Code Freeze)**: đổi tham chiếu sang `Lead Reviewer (Primary Subagent @reviewer hoặc Fallback Claude Code CLI)`.
  - Cập nhật **§2 (`Nguyên Tắc "Zero-Self-Execution" & Kiến Trúc Dual-Planner 2 Kênh`)**:
    1. **Kênh Lập Kế Hoạch Ưu Tiên 1 (Primary Planner - Claude Code CLI)**: Thực thi qua `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/<task>.md -Task "<yêu cầu>"`, tự động nạp `.agents/scripts/claude-planner-prompt.md` (soạn thảo mới hoặc cập nhật In-Place trong Revision Loop) và đồng bộ sang artifact `implementation_plan.md`.
    2. **Kênh Lập Kế Hoạch Dự Phòng (Fallback Planner - Subagent `@planner`)**: Khi `run-claude.ps1 -Role planner` trả về `exit code 42` (`[CLAUDE_PRO_QUOTA_EXCEEDED]`) hoặc lỗi kết nối/xác thực (`exit 40/41`), Orchestrator tự động chuyển giao ngay lập tức sang subagent `@planner` (`gemini-4-argon` với thinking budget tối đa).
  - Cập nhật **§3 (`Kiến Trúc Dual-Reviewer 2 Kênh (Đảo Chiều) & Chuỗi Chuyển Tiếp Không Ngắt Quãng`)**:
    1. **Kênh Thẩm Định Ưu Tiên 1 (Primary Reviewer - Subagent `@reviewer`)**: Chạy mô hình `gemini-4-argon` với thinking budget tối đa, thực hiện thẩm định độc lập 7 bước theo bộ 3 tài liệu vệ tinh (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md`), dùng `replace_file_content` / `write_to_file` ghi trực tiếp `### Audit Run [X+1]` vào `## Audit History`, cập nhật dòng `- **Status**:` ở header và (khi đạt chuẩn) ghi thẻ `[PLAN_APPROVED]` ở dòng cuối cùng của file kế hoạch tại `docs/plans/<task>.md` và `implementation_plan.md`.
    2. **Kênh Thẩm Định Dự Phòng (Fallback Reviewer - Claude Code CLI)**: Khi subagent `@reviewer` chạm quota/rate limit (HTTP 429) hoặc gặp sự cố hệ thống, Orchestrator tự động chuyển giao ngay lập tức sang Claude Code CLI qua lệnh `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/<task>.md` (nạp `.agents/scripts/claude-reviewer-prompt.md`).
    3. **Nguyên Tắc "Uninterrupted Execution Chain" & Tự Động Hóa Hoàn Toàn**: Chuỗi `Planner (Claude CLI ➔ fallback @planner)` ⇄ `Reviewer (@reviewer ➔ fallback Claude CLI)` chạy tự động liên tục tối đa **10 vòng lặp revision** không ngắt quãng hỏi người dùng giữa chừng.
  - Cập nhật **§5 (`Cấu Trúc File Kế Hoạch & Cơ Chế Phê Duyệt An Toàn`)**: nêu rõ trách nhiệm của Planner trên `## Technical Plan` và trách nhiệm của Reviewer trên `## Audit History` + cập nhật dòng `- **Status**: Approved` / `Changes Requested` ở phần header + ghi thẻ `[PLAN_APPROVED]` ở dòng cuối cùng.
  - Cập nhật **§6 (`Checklist Bắt Buộc: Pre-Flight Gate`)**: cập nhật Gate 1, Gate 2, Gate 3 khớp với thứ tự Primary/Fallback mới.

#### Bước 5 — Cập nhật Code Freeze Guard & Co-Located Unit Tests (`.agents/scripts/code-freeze-guard.js` & `.test.ts`)

- [ ] **5.1 `[MODIFY]` `.agents/scripts/code-freeze-guard.js`**:
  - Dòng 50: cập nhật comment `READ_ONLY_COMMANDS` thành `/** Read-only verification and multi-agent CLI dispatch commands mirroring the @planner / @reviewer / @qa ALLOWLIST for Vikini. */`.
  - Dòng 63: mở rộng regex `run-claude.ps1` trong `READ_ONLY_COMMANDS` để hỗ trợ thêm cờ `-NoProfile` và dấu ngoặc kép quanh đường dẫn script:
    `/^powershell(?:\.exe)?\s+(?:-(?:NoProfile|ExecutionPolicy\s+\w+)\s+)*-File\s+["']?\.agents[/\\]scripts[/\\]run-claude\.ps1["']?(?:\s+.*)?$/,`
  - Dòng 164: cập nhật JSDoc của `isPlanApproved()` thành `* Checks if the current active plan has been approved by Lead Reviewer (@reviewer primary or Claude CLI fallback).`.
  - Dòng 551: cập nhật thông báo trong `decide()` thành `"Approve only if [PLAN_APPROVED] has been granted by Lead Reviewer (@reviewer or Claude CLI fallback)."` (vẫn giữ chuỗi `"@reviewer"` và `"write targets a frozen path"` để tương thích ngược 100% với toàn bộ unit test hiện có).
- [ ] **5.2 `[MODIFY]` `.agents/scripts/code-freeze-guard.test.ts`**:
  - Trong block `describe("decide — run_command", ...)`: mở rộng hoặc thêm test block kiểm chứng đầy đủ các mẫu lệnh gọi `run-claude.ps1` cho cả 2 chế độ Planner & Reviewer (`SW-G1..SW-G8` trong Test Contract §8.1), giữ nguyên 100% 84 unit tests hiện hữu.
- [ ] **5.3 Chạy kiểm thử Tier 1**:
  - Thực thi `npm run type-check; npx vitest run .agents/scripts/code-freeze-guard.test.ts` đảm bảo 0 lỗi TypeScript và 100% unit tests pass.

#### Bước 6 — Cập nhật Living Docs (`.agents/README.md`, `docs/architecture.md`, `docs/plans/README.md`, `docs/CHANGELOG.md`) & Full Verification

- [ ] **6.1 `[MODIFY]` `.agents/README.md`**:
  - Cập nhật sơ đồ ASCII tại §1 (`Kiến Trúc Phối Hợp Đa Tác Tử`): `[ Primary Planner: Claude Code CLI / Fallback: @planner (Gemini 4 Argon) ]` ➔ `[ Primary Reviewer: @reviewer (Gemini 4 Argon) / Fallback: Claude Code CLI ]`.
  - Cập nhật mô tả mục 3 & 4 trong `Các Vai Trò Cốt Lõi`, dòng `05` trong bảng `Rules Catalog` (§2), và bảng `Ma Trận Phân Bổ Tác Vụ Sang Model Tier` + nguyên tắc `Orchestrator–Worker Split` (§4.1, §4.2).
- [ ] **6.2 `[MODIFY]` `docs/architecture.md`**:
  - Cập nhật sơ đồ ASCII và các mục 2, 3, 4 trong `## 7. Multi-Agent Governance Architecture` (dòng 222–272) phản ánh kiến trúc Dual-Planner (Claude Code CLI Primary + `@planner` `gemini-4-argon` Fallback), Dual-Reviewer (`@reviewer` `gemini-4-argon` Primary + Claude Code CLI Fallback), và tối đa 10 vòng lặp Revision Loop.
- [ ] **6.3 `[MODIFY]` `docs/plans/README.md`**:
  - Cập nhật dòng 12 phản ánh cơ chế khởi tạo bởi Primary Planner (Claude Code CLI / Fallback `@planner`) và phê duyệt bởi Lead Reviewer (Primary `@reviewer` / Fallback Claude Code CLI).
  - Bổ sung kế hoạch `2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md` và `2026-10-19-pstack-skills-and-fast-track-implementation-plan.md` vào bảng `Implementation Plans Status Matrix`.
- [ ] **6.4 `[MODIFY]` `docs/CHANGELOG.md`**:
  - Thêm mục mới ở đầu file: `## 2026-10-19: Governance -- Swap Planner & Reviewer Execution Channels (Dual-Planner Claude CLI Primary + Dual-Reviewer @reviewer Primary)`.
- [ ] **6.5 Chạy toàn bộ Verification Plan (§9)**:
  - Thực thi `npm run verify`, kiểm tra dung lượng ký tự Governance và chạy `scripts/verify-docs.mjs`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

#### 8.1 Unit Tests Cho `decide()` Trong `.agents/scripts/code-freeze-guard.test.ts`

| Test ID   | Input (`GuardInput`)                                                                                                                                                                                                                        | Options                   | Kết Quả Mong Đợi (`GuardDecision`)                                            | Ghi Chú Kiểm Chứng                                                                                    |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------ | :---------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **SW-G1** | `{ command: 'powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md -Task "Draft plan"' }`                             | `{}`                      | `{ decision: "allow" }`                                                       | Cho phép gọi Primary Planner qua `run-claude.ps1 -Role planner` kèm `-PlanFile` và `-Task`            |
| **SW-G2** | `{ command: "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md" }`                                | `{}`                      | `{ decision: "allow" }`                                                       | Cho phép gọi Fallback Reviewer qua `run-claude.ps1 -Role reviewer` kèm cờ `-NoProfile`                |
| **SW-G3** | `{ command: 'powershell -ExecutionPolicy Bypass -File ".agents/scripts/run-claude.ps1" -Mode plan -PlanFile docs/plans/task.md -Prompt "Revise plan" -ArtifactFile C:/Users/wyemh/.gemini/antigravity/brain/conv/implementation_plan.md' }` | `{}`                      | `{ decision: "allow" }`                                                       | Cho phép dùng alias `-Mode plan`, `-Prompt`, `-ArtifactFile` và đường dẫn script bọc ngoặc kép        |
| **SW-G4** | `{ command: "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner && rm -rf src" }`                                                                                                                        | `{}`                      | `decision: "ask"`, `reason` chứa `"redirection, chaining or a mutating flag"` | Chặn nối lệnh `&&` mutating sau `run-claude.ps1`                                                      |
| **SW-G5** | `{ command: "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer; rm -rf src" }`                                                                                                                         | `{}`                      | `decision: "ask"`, `reason` chứa `"segment outside the read-only ALLOWLIST"`  | Chặn nối lệnh `;` chứa đoạn mutating sau `run-claude.ps1`                                             |
| **SW-G6** | `{ command: "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner > src/evil.ts" }`                                                                                                                        | `{}`                      | `decision: "ask"`, `reason` chứa `"redirection, chaining or a mutating flag"` | Chặn chuyển hướng output `>` ra file                                                                  |
| **SW-G7** | `{ command: "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner --fix" }`                                                                                                                                | `{}`                      | `decision: "ask"`, `reason` chứa `"redirection, chaining or a mutating flag"` | Chặn cờ mutating `--fix`                                                                              |
| **SW-G8** | `{ targetFile: "docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md", toolName: "replace_file_content", oldContent: "- **Status**: Ready for Review", newContent: "- **Status**: Approved" }`                       | `{ planApproved: false }` | `{ decision: "allow" }`                                                       | Cho phép `@reviewer` dùng `replace_file_content` cập nhật `docs/plans/*.md` khi repo đang code freeze |

#### 8.2 Hợp Đồng Hành Vi Của Script `.agents/scripts/run-claude.ps1`

| Test ID   | Kịch Bản Gọi Script                                                            | Đầu Vào                                                                                                                                                                                     | Hành Vi & Exit Code Mong Đợi                                                                                                                                                                                |
| :-------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SW-S1** | Pre-flight check                                                               | `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -CheckOnly`                                                                                                        | Nếu máy có `claude.exe` và `~/.claude.json` ➔ in `[CLAUDE_READY]` và thoát với `exit code 0` (hoặc `40`/`41` nếu thiếu).                                                                                    |
| **SW-S2** | Truyền `-Role` không hợp lệ                                                    | `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role invalid`                                                                                                     | PowerShell `ValidateSet` từ chối tham số ngay ở tầng parser với exit code `!= 0`.                                                                                                                           |
| **SW-S3** | Truyền `-PlanFile` ngoài `docs/plans/*.md` hoặc trỏ vào `docs/plans/README.md` | `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile src/app/page.tsx` hoặc `-PlanFile docs/plans/README.md`                                    | Hàm kiểm tra đường dẫn báo lỗi `[INVALID_PLAN_PATH]` và thoát ngay với `exit code 1`, không gọi `claude.exe`.                                                                                               |
| **SW-S4** | Gọi `-Role reviewer` với file plan không tồn tại                               | `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/non-existent-plan.md`                                                          | Báo lỗi `[PLAN_NOT_FOUND]` và thoát ngay với `exit code 1`, không gọi `claude.exe`.                                                                                                                         |
| **SW-S5** | Gọi `-Role planner` với đường dẫn plan mới chưa tồn tại trên đĩa               | `-Role planner -PlanFile docs/plans/2026-10-19-new-task-implementation-plan.md -Task "..."`                                                                                                 | `Normalize-PlanPath` chuẩn hóa thành `docs/plans/2026-10-19-new-task-implementation-plan.md` không ném lỗi `Resolve-Path`, nạp `.agents/scripts/claude-planner-prompt.md` với `{{PLAN_MODE}} = CREATE_NEW`. |
| **SW-S6** | Phát hiện hết quota Claude Pro                                                 | Output từ `claude.exe` có `exit code != 0` và khớp `Usage limit reached \| Rate limit reached \| Failed to authenticate \| API Error: 429 \| overloaded_error \| credit balance is too low` | In cảnh báo `[CLAUDE_PRO_QUOTA_EXCEEDED]` tương ứng với role và thoát với `exit code 42`.                                                                                                                   |

#### 8.3 Hợp Đồng Giới Hạn Ký Tự & Cấu Trúc Governance

| Test ID   | Đối Tượng Kiểm Tra                                                                                  | Tiêu Chí PASS                                                                                                                                                         | Tiêu Chí FAIL                                        |
| :-------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| **SW-B1** | Tất cả các file `.agents/rules/*.md` (`00` đến `05`)                                                | Dung lượng `fs.readFileSync(f, "utf8").length <= 12,000` ký tự mỗi file                                                                                               | Bất kỳ file nào `> 12,000` ký tự                     |
| **SW-B2** | `.agents/agents/planner/agent.md`, `.agents/agents/reviewer/agent.md`, `.agents/agents/qa/agent.md` | Dung lượng `fs.readFileSync(f, "utf8").length <= 10,000` ký tự mỗi file (mục tiêu `<= 9,200`)                                                                         | Bất kỳ file nào `> 10,000` ký tự                     |
| **SW-B3** | Frontmatter `tools:` của `.agents/agents/reviewer/agent.md`                                         | Chứa đầy đủ `write_to_file` và `replace_file_content` cùng 7 tool read-only sẵn có; phần thân có mục `AUDIT-ONLY WRITE SCOPE` cấm sửa `## Technical Plan` và `src/**` | Thiếu tool hoặc thiếu ràng buộc giới hạn phạm vi ghi |
| **SW-B4** | `.agents/scripts/claude-planner-prompt.md`                                                          | Tồn tại trên đĩa, chứa đủ 10 mục bắt buộc của `@planner`, 8 nguyên lý `pstack`, Tech Stack Vikini, quy trình In-Place Plan Updating, và cấm tự ghi `[PLAN_APPROVED]`  | Thiếu bất kỳ thành phần nào                          |
| **SW-B5** | `scripts/verify-docs.mjs` các cổng `[1/5]` đến `[4/5]`                                              | `[1/5]` (Markdown Link Integrity), `[2/5]` (Legacy paths), `[3/5]` (Shorthand prefixes), `[4/5]` (Character limits) đều `PASS`                                        | Bất kỳ cổng nào trong `[1/5]`–`[4/5]` báo `FAIL`     |

**Tiêu chí Pass/Fail bắt buộc cho `@qa`**:

- Toàn bộ test hiện có (84 tests) cộng với các test mới (`SW-G1..SW-G8`) trong `.agents/scripts/code-freeze-guard.test.ts` phải pass 100%.
- Nghiêm cấm xóa `expect()`, thêm `.skip`/`.only` hoặc nới lỏng matcher (`toBe("allow")` / `toBe("ask")` / `toContain(...)`).

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1 File Test Co-Located

- `.agents/scripts/code-freeze-guard.test.ts` (đặt cạnh `.agents/scripts/code-freeze-guard.js`).
- Task không thêm/sửa file nào trong `src/lib/core/` hay `src/lib/features/`.

#### 9.2 Chuỗi Lệnh Kiểm Thử & Chất Lượng (PowerShell 5.1 — Nối Lệnh Bằng `;`)

```powershell
# 1. Chạy unit test co-located của Code Freeze Guard
npx vitest run .agents/scripts/code-freeze-guard.test.ts

# 2. Chạy cổng chất lượng toàn diện Tier 2 (type-check + lint + full vitest suite)
npm run type-check; npm run lint; npm run test:run

# 3. Chạy kiểm tra tài liệu và giới hạn ký tự Governance ([1/5] đến [4/5] phải PASS)
node scripts/verify-docs.mjs
```

#### 9.3 Wiring Probes & Negative Probes

```powershell
# Probe 1: Kiểm tra pre-flight của run-claude.ps1
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -CheckOnly

# Probe 2 (Negative Probe): Kiểm tra run-claude.ps1 chặn đường dẫn ngoài docs/plans/*.md (kỳ vọng exit code 1 + [INVALID_PLAN_PATH])
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile src/app/page.tsx

# Probe 3 (Negative Probe): Kiểm tra run-claude.ps1 chặn ghi đè docs/plans/README.md (kỳ vọng exit code 1 + [INVALID_PLAN_PATH])
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/README.md

# Probe 4 (Negative Probe): Kiểm tra run-claude.ps1 -Role reviewer chặn file plan không tồn tại (kỳ vọng exit code 1 + [PLAN_NOT_FOUND])
powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/2026-10-19-nonexistent-plan.md

# Probe 5: Đo chính xác số ký tự UTF-16 của toàn bộ file Rules (<= 12,000) và Agents (<= 10,000)
node -e 'const fs = require("fs"), path = require("path"); for (const dir of [".agents/rules", ".agents/agents"]) { for (const entry of fs.readdirSync(dir)) { const p = dir.endsWith("rules") ? path.join(dir, entry) : path.join(dir, entry, "agent.md"); if (fs.existsSync(p) && p.endsWith(".md")) console.log(fs.readFileSync(p, "utf8").length.toString().padStart(6), p); } }'
```

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #      | Rủi Ro Tiềm Ẩn                                                                                                                                                                                                                                                  |     Mức Độ     | Phương Án Phòng Ngừa & Technical Control Cụ Thể                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | `@reviewer` được cấp thêm công cụ `write_to_file` và `replace_file_content` có thể vô tình sửa nhầm phần `## Technical Plan` hoặc chạm vào mã nguồn `src/**`, `.agents/**`.                                                                                     |    **Cao**     | **Control 2 lớp**: (1) **Tầng Platform Hook** (`.agents/scripts/code-freeze-guard.js:443-554`): khi chưa có `[PLAN_APPROVED]`, mọi thao tác ghi vào `src/**` (ngoài Fast-Track UI) và `.agents/**` đều bị chặn cứng bằng `{ decision: "ask" }`; chỉ `docs/**` và `implementation_plan.md` mới được `"allow"`. (2) **Tầng Prompt Governance** (`.agents/agents/reviewer/agent.md` §Strict Constraints): quy định rõ **Audit-Only Write Scope** — chỉ được phép append `### Audit Run [X+1]` vào `## Audit History`, cập nhật dòng `- **Status**:` ở header và ghi `[PLAN_APPROVED]` ở dòng cuối cùng; nghiêm cấm sửa `## Technical Plan`. |
| **R2** | `@reviewer` (hoặc Fallback Claude CLI Reviewer) ghi `[PLAN_APPROVED]` ở dòng cuối cùng nhưng quên đổi dòng `- **Status**: Ready for Review` ở đầu file kế hoạch, khiến `isPlanApproved()` trong `code-freeze-guard.js:207-214` vẫn trả về `false` và khóa repo. |    **Cao**     | **Control**: Quy định bắt buộc trong Bước 6 của `.agents/agents/reviewer/agent.md`, Mục 2.5 của `.agents/scripts/claude-reviewer-prompt.md`, và §5 của `.agents/rules/05-plan-review.md`: khi cấp `[PLAN_APPROVED]`, Reviewer bắt buộc cập nhật đồng thời dòng header `- **Status**: Approved` (và khi từ chối thì cập nhật thành `- **Status**: Changes Requested`).                                                                                                                                                                                                                                                                    |
| **R3** | Khi gọi `.agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/<new-plan>.md` cho một bản kế hoạch mới chưa tồn tại trên đĩa, lệnh `Resolve-Path -Relative` của PowerShell 5.1 ném lỗi `PathNotFound` làm hỏng prompt truyền vào Claude CLI.        |    **Cao**     | **Control**: Thay thế `Resolve-Path -Relative` bằng hàm thuần `Normalize-PlanPath` trong `.agents/scripts/run-claude.ps1` kết hợp kiểm tra regex `^docs/plans/[A-Za-z0-9._-]+\.md$` (loại trừ `README.md` và chặn `..`). Có Negative Probes 2, 3, 4 tại §9.3 và Test Contract `SW-S3..SW-S5` tại §8.2.                                                                                                                                                                                                                                                                                                                                   |
| **R4** | Lệnh gọi `run-claude.ps1` trong `READ_ONLY_COMMANDS` bị lợi dụng để nối lệnh shell độc hại (`&&`, `;`, `\|`, `>`, `$(...)`) hoặc truyền đường dẫn `-PlanFile` trỏ vào mã nguồn `src/`.                                                                          |    **Cao**     | **Control**: (1) Trong `.agents/scripts/code-freeze-guard.js:560-585`, bộ lọc tách `;` và kiểm tra `SHELL_ESCAPE_HATCHES` / `MUTATING_FLAGS` luôn chạy **trước** `READ_ONLY_COMMANDS` (được kiểm chứng bởi unit tests `SW-G4..SW-G7`). (2) Trong `.agents/scripts/run-claude.ps1`, kiểm tra đường dẫn `$relPlanFile` bắt buộc thuộc `docs/plans/*.md` trước khi khởi chạy `claude.exe`.                                                                                                                                                                                                                                                  |
| **R5** | Việc bổ sung hướng dẫn vào `.agents/rules/05-plan-review.md` hoặc `.agents/agents/reviewer/agent.md` làm vượt giới hạn ký tự Governance (`12,000` ký tự cho rules, `10,000` ký tự cho agents) khiến `node scripts/verify-docs.mjs` thất bại ở bước `[4/5]`.     | **Trung bình** | **Control**: Thiết kế ngân sách ký tự chặt chẽ (`05-plan-review.md <= 9,500` ký tự; `reviewer/agent.md <= 9,000` ký tự; `planner/agent.md <= 8,500` ký tự) và bắt buộc chạy Probe 5 cùng `node scripts/verify-docs.mjs` tại §9.2–9.3 để xác nhận `[4/5] PASS`.                                                                                                                                                                                                                                                                                                                                                                           |
| **R6** | Hết quota ở cả kênh Primary lẫn kênh Fallback hoặc lặp vô hạn giữa Planner và Reviewer khi có xung đột quan điểm thiết kế.                                                                                                                                      | **Trung bình** | **Control**: (1) `run-claude.ps1` bắt đầy đủ các mẫu lỗi quota/rate-limit và trả về `exit code 42` (`[CLAUDE_PRO_QUOTA_EXCEEDED]`) để Orchestrator tự động chuyển kênh ngay lập tức. (2) Cơ chế `[NEEDS_PRODUCT_DECISION]` kèm Default Assumption và **Circuit Breaker tối đa 10 vòng lặp** trong `.agents/rules/05-plan-review.md` §3.3 bảo đảm chuỗi không bao giờ treo vô hạn.                                                                                                                                                                                                                                                        |

---

## Audit History

### Audit Run 1

`[REVIEWER_MODEL: gemini-4-argon]`

- **Reviewer**: Subagent `@reviewer` (`gemini-4-argon`, thinking budget Max)
- **Ngày**: 2026-10-19
- **Đối tượng thẩm định**: Revision 1 (`docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md`)
- **Tài liệu vệ tinh đã nạp ở Bước 0**:
  - `.agents/agents/reviewer/allowlist.md` (dòng 1–39)
  - `.agents/agents/reviewer/evidence-bar.md` (dòng 1–56)
  - `.agents/agents/reviewer/mental-simulation.md` (dòng 1–63)
  - `.agents/agents/reviewer/agent.md` (dòng 1–116)

#### 1. Kiểm Chứng Lỗi Cũ

- Đây là lượt thẩm định đầu tiên (`Audit Run 1` cho `Revision 1`), chưa có lỗi tồn đọng từ lượt trước.

#### 2. Phát Hiện Mới

- **`[BLOCKER]`**: 0
- **`[MAJOR]`**: 0
- **`[MINOR]`**: 0

Không phát hiện lỗi kiến trúc, ranh giới phân tầng, hay lỗ hổng thực thi trong kế hoạch Revision 1.

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Tấn công 1 — Path Traversal, Subdirectory Bypass và Ghi Đè `README.md` qua tham số `-PlanFile` của `.agents/scripts/run-claude.ps1`**:
   - _Giả thuyết tấn công_: Khi thay thế `Resolve-Path -Relative` (`.agents/scripts/run-claude.ps1:72`) bằng hàm `Normalize-PlanPath` để hỗ trợ tạo file plan mới chưa tồn tại trên đĩa, kẻ tấn công hoặc lời gọi sai có thể truyền `-PlanFile "docs/plans/../../src/app/page.tsx"`, `-PlanFile "docs/plans/sub/nested.md"`, hoặc `-PlanFile "docs/plans/README.md"` để ép Claude Code CLI ghi đè file ngoài bề mặt kế hoạch.
   - _Kiểm chứng trên code & thiết kế (`[SRC]`)_: Tại `.agents/scripts/run-claude.ps1:58-73` và phác thảo Mục 6.2 / Bước 2.2 của kế hoạch, sau khi `Normalize-PlanPath` cắt tiền tố `$repoRoot` (hoặc trả chuỗi rỗng nếu đường dẫn tuyệt đối nằm ngoài repo) và chuẩn hóa dấu phân cách sang `/`, chuỗi `$relPlanFile` bị kiểm tra bởi biểu thức chính quy `^docs/plans/[A-Za-z0-9._-]+\.md$`, kết hợp điều kiện cấm chứa `..` và cấm bằng `docs/plans/README.md`. Vì tập ký tự `[A-Za-z0-9._-]+` không cho phép ký tự `/` hay `\`, mọi đường dẫn con hoặc chuỗi thoát thư mục đều bị chặn với mã thoát `exit 1` (`[INVALID_PLAN_PATH]`) trước khi tiến trình `claude.exe` được khởi chạy. Ngoài ra, ở chế độ `-Role reviewer`, script kiểm tra thêm `Test-Path -LiteralPath $relPlanFile` (`SW-S4`).
   - _Kết quả_: Không xuyên thủng được ranh giới đường dẫn.

2. **Tấn công 2 — Shell Injection & Mutating Flags qua biểu thức chính quy `READ_ONLY_COMMANDS` mở rộng cho `run-claude.ps1`**:
   - _Giả thuyết tấn công_: Biểu thức chính quy `/^powershell(?:\.exe)?\s+(?:-(?:NoProfile|ExecutionPolicy\s+\w+)\s+)*-File\s+["']?\.agents[/\\]scripts[/\\]run-claude\.ps1["']?(?:\s+.*)?$/` kết thúc bằng `(?:\s+.*)?$`. Liệu một lệnh truyền `-Task "Draft && rm -rf src"`, `-Task "Draft; rm -rf src"`, `> src/evil.ts`, hoặc `--fix` có lọt qua `READ_ONLY_COMMANDS` và được `decide()` trả về `{ decision: "allow" }` không?
   - _Kiểm chứng trên code thật (`[SRC]` & `[CMD]`)_: Đối chiếu trực tiếp `.agents/scripts/code-freeze-guard.js:556-595`:
     - Tại dòng `560-577`: Mọi lệnh chứa dấu `;` đều bị tách thành mảng `segments` và gọi đệ quy `decide({ command: segment }, options)` cho từng phần tử. Nếu bất kỳ phần tử nào không khớp `READ_ONLY_COMMANDS`, hàm trả về ngay `{ decision: "ask" }` với lý do `"command chain contains a segment outside the read-only ALLOWLIST"` (`SW-G5`).
     - Tại dòng `578-585`: Bộ lọc `SHELL_ESCAPE_HATCHES` (`/[;|&`]|\$\(|>>?|\btee\b/`, dòng 68) và `MUTATING_FLAGS` (`/--fix\b|--write\b|--force\b|--output\b|-i\b/`, dòng 71) luôn thực thi **trước** vòng lặp `READ_ONLY_COMMANDS.some(...)`ở dòng 586. Do đó, mọi toán tử`&&`, `||`, `|`, `` ` ``, `$(...)`, `>`, `>>`, `tee`, `--fix`, `--write`, `--force`, `--output`, `-i` xuất hiện ở bất kỳ vị trí nào trong chuỗi lệnh đều bị chặn ở dòng 578 (`SW-G4`, `SW-G6`, `SW-G7`).
     - Chạy kiểm thử thực tế `npx vitest run .agents/scripts/code-freeze-guard.test.ts` (`[CMD]`, exit code `0`, `84/84` tests pass).
   - _Kết quả_: Không vượt qua được chốt chặn `SHELL_ESCAPE_HATCHES`, `MUTATING_FLAGS` và bộ tách `;`.

3. **Tấn công 3 — Lạm quyền ghi file của `@reviewer` khi thêm `write_to_file` / `replace_file_content` và nguy cơ kẹt khóa `isPlanApproved()`**:
   - _Giả thuyết tấn công_: (a) Khi bổ sung `write_to_file` và `replace_file_content` vào YAML frontmatter của `.agents/agents/reviewer/agent.md`, liệu `@reviewer` có thể ghi đè `src/**`, `.agents/**`, hoặc `*.test.ts` khi kế hoạch chưa được duyệt không? (b) Nếu `@reviewer` chỉ ghi `[PLAN_APPROVED]` ở dòng cuối cùng mà giữ nguyên `- **Status**: Ready for Review` ở phần đầu file, hàm `isPlanApproved()` sẽ xử lý ra sao?
   - _Kiểm chứng trên code thật (`[SRC]`)_:
     - Đối với (a): Tại `.agents/scripts/code-freeze-guard.js:443-554`, khi `isPlanApproved()` đang là `false`, chỉ Gate 1 (`isAntigravityArtifact`, dòng 446) và Gate 3 (`UNFROZEN_PREFIXES = ["docs/"]`, `UNFROZEN_FILES = ["implementation_plan.md", "task.md", "walkthrough.md"]`, dòng 39–42, 465–470) trả về `{ decision: "allow" }`. Các đường dẫn `.agents/**` bị chặn tại Gate 7 (`isGovernanceFile`, dòng 525), `*.test.ts` bị chặn tại Gate 4 (dòng 484), `*.server.ts` bị chặn tại Gate 5 (dòng 503), và `src/**` (ngoài phạm vi Fast-Track) bị chặn tại Gate 9 (dòng 547).
     - Đối với (b): Tại `.agents/scripts/code-freeze-guard.js:206-214`, `isPlanApproved()` kiểm tra 30 dòng đầu của file plan mới nhất bằng biểu thức `/(?:\*\*|\b)(?:Status|Trạng thái)(?:\*\*|\b)?\s*:\s*(?:Draft|In Review|Ready for Review|Changes Requested|Chờ Duyệt)/i`. Nếu khớp, hàm trả về `false` ngay lập tức trước khi đọc dòng cuối (dòng 216–228). Bản kế hoạch đã nhận diện đúng cơ chế này tại Giả định `A1`, Rủi ro `R2`, Bước `2.1`, Bước `3.2` và Bước `4.4`, bắt buộc cả `@reviewer` lẫn Fallback Claude CLI Reviewer cập nhật dòng header thành `- **Status**: Approved` đồng thời với việc ghi `[PLAN_APPROVED]` ở dòng cuối cùng.
   - _Kết quả_: Ranh giới ghi file và điều kiện mở khóa `isPlanApproved()` khớp với logic trong `.agents/scripts/code-freeze-guard.js`.

4. **Tấn công 4 — Nguy cơ vượt trần ký tự Governance (`scripts/verify-docs.mjs` cổng `[4/5]`) khi mở rộng `.agents/rules/05-plan-review.md` và `.agents/agents/*/agent.md`**:
   - _Giả thuyết tấn công_: Việc bổ sung mô tả kiến trúc Dual-Planner và Dual-Reviewer vào `.agents/rules/05-plan-review.md`, `.agents/agents/planner/agent.md`, và `.agents/agents/reviewer/agent.md` có thể làm độ dài UTF-16 (`fs.readFileSync(f, "utf8").length`) vượt ngưỡng `12,000` ký tự (cho rules) hoặc `10,000` ký tự (cho agents) tại `scripts/verify-docs.mjs:198-231`.
   - _Kiểm chứng trên code thật (`[SRC]`)_: Đo lường thực tế các file hiện tại qua `view_file` và đối chiếu với `scripts/verify-docs.mjs:204,218`:
     - `.agents/rules/05-plan-review.md`: hiện có 10,381 UTF-8 bytes (~8,250 UTF-16 chars) so với trần `12,000` (dư ~3,750 chars).
     - `.agents/agents/planner/agent.md`: hiện có 9,185 UTF-8 bytes (~7,300 UTF-16 chars) so với trần `10,000` (dư ~2,700 chars).
     - `.agents/agents/reviewer/agent.md`: hiện có 9,751 UTF-8 bytes (~7,800 UTF-16 chars) so với trần `10,000` (dư ~2,200 chars).
     - Kế hoạch đã đặt ngân sách mục tiêu (`<= 9,500`, `<= 8,500`, `<= 9,000` UTF-16 chars) kèm lệnh kiểm tra tự động ở Probe 5 (§9.3) và Test Contract `SW-B1`, `SW-B2`, `SW-B5` (§8.3).
   - _Kết quả_: Có chốt kiểm tra định lượng rõ ràng trong Verification Plan.

#### 4. Plan Completeness Gate (Kiểm Tra 7 Hạng Mục Cốt Lõi)

| #   | Hạng Mục Bắt Buộc                                            | Trạng Thái | Dẫn Chứng Trong Kế Hoạch                                                                              |
| :-- | :----------------------------------------------------------- | :--------: | :---------------------------------------------------------------------------------------------------- |
| 1   | Bảng Verified Versions (2026)                                |   `PASS`   | Mục 4 (dòng 103–118) đối chiếu `package.json` và công cụ CLI thực tế năm 2026                         |
| 2   | Checklist các bước tuần tự (`[NEW]`, `[MODIFY]`, `[DELETE]`) |   `PASS`   | Mục 5 (dòng 121–149) và Mục 7 (dòng 259–410)                                                          |
| 3   | Kế hoạch kiểm thử (Verification Plan & Negative Probes)      |   `PASS`   | Mục 9 (dòng 455–492) gồm lệnh verify và 5 probes (Probes 1–5)                                         |
| 4   | Test Contract                                                |   `PASS`   | Mục 8 (dòng 413–451) gồm `SW-G1..SW-G8`, `SW-S1..SW-S6`, `SW-B1..SW-B5`                               |
| 5   | Assumptions & Cross-Task Dependencies                        |   `PASS`   | Mục 3 (dòng 71–100) gồm `A1..A5`, dependencies và `D1..D2` (`[NEEDS_PRODUCT_DECISION]`)               |
| 6   | Out of Scope (What We're NOT Doing)                          |   `PASS`   | Mục 1.2 (dòng 28–35)                                                                                  |
| 7   | Skills Loaded & Applied                                      |   `PASS`   | Mục 2.2 (dòng 60–67) trích dẫn `.agents/skills/vikini-investigate/SKILL.md` và các quy chuẩn quản trị |

#### 5. Mental Simulation Verification Matrix (S1–S6 + Domain)

| Kịch Bản                                     | Trạng Thái |      Loại Bằng Chứng      | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------------------------------------------- | :--------: | :-----------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   |   `PASS`   | `[CMD]`, `[SRC]`, `[URL]` | Chạy `npm run type-check` và `npm run lint` đạt exit code `0` (`[CMD]`). Kiểm tra `package.json:1-140` và `tsconfig.json:1-37` (`allowJs: true`, `strict: true`, `noEmit: true`) (`[SRC]`). Không thêm dependency ngoài hay biến môi trường `.env` mới.                                                                                                                                                                                                                                                                                                                      |
| **S2: Runner Lifecycle & Teardown**          |   `PASS`   |     `[SRC]`, `[CMD]`      | Trong `.agents/scripts/run-claude.ps1:91`, tiến trình `claude.exe` được gọi với stdin đóng (`$null \| & $claudeExe @cliArgs 2>&1 \| Out-String`) để tránh treo chờ input tương tác (`[SRC]`). Chạy `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -CheckOnly` trả về `[CLAUDE_READY]` với exit code `0` (`[CMD]`). Unit tests trong `.agents/scripts/code-freeze-guard.test.ts` kiểm tra hàm thuần `decide()` không dùng circular mock (`84/84` pass).                                                                                             |
| **S3: Database & Temporal Logic**            |   `PASS`   |     `[SRC]`, `[ADV]`      | Task thuộc miền Governance & Hook Script, không tác động tới schema PostgreSQL hay Supabase migrations (`.agents/scripts/code-freeze-guard.js:514` vẫn khóa `isMigrationFile` ở trạng thái `ask`). Trong `isPlanApproved()` (`.agents/scripts/code-freeze-guard.js:202`), thứ tự thời gian của các bản kế hoạch được sắp xếp theo `fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs` và trong `run-claude.ps1:61` theo `Sort-Object LastWriteTime -Descending` (`[SRC]`). Đã lập Adversarial Timeline cho cơ chế đồng bộ trạng thái file kế hoạch ở Mục 7 bên dưới (`[ADV]`). |
| **S4: Cross-Task State Flow**                |   `PASS`   |     `[SRC]`, `[CMD]`      | Đối chiếu trực tiếp `.agents/scripts/code-freeze-guard.js:1-726` và `.agents/scripts/code-freeze-guard.test.ts:1-910` từ task trước (`2026-10-19-pstack-skills-and-fast-track-implementation-plan.md`). Các hàm `isFastTrackEligible`, `countLines`, `FAST_TRACK_MAX_LINES` và 84 unit tests hiện hữu được giữ nguyên (`[SRC]`, `[CMD]`).                                                                                                                                                                                                                                    |
| **S5: Security Boundary & 3-Tier Auth**      |   `PASS`   |     `[SRC]`, `[ADV]`      | Kiểm chứng ranh giới bảo vệ nhiều lớp tại `.agents/scripts/code-freeze-guard.js:443-595` (`[SRC]`): khóa `.env*`, `.git/`, `.gemini/` (dòng 455–462), `TEST_INFRA_FILES` (dòng 473), `isTestFile` (dòng 484), `*.server.ts` (dòng 503), migrations (dòng 514), `.agents/**` (dòng 525). Phân tách `--allowedTools` theo nguyên tắc tối thiểu hóa đặc quyền giữa `-Role planner` (`Write,Edit`) và `-Role reviewer` (chỉ `Edit`). Đã lập Adversarial Timeline 4 trục ở Mục 7 (`[ADV]`).                                                                                       |
| **S6: External Resilience & Serverless Cap** |   `PASS`   |     `[SRC]`, `[URL]`      | Trong `.agents/scripts/run-claude.ps1:24-26,97-108`, script xóa các biến proxy/key môi trường cục bộ (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`) để tránh rò rỉ hoặc xung đột xác thực, đồng thời bắt các mẫu lỗi giới hạn tốc độ / hết quota (`Usage limit reached`, `Rate limit reached`, `Failed to authenticate`, `API Error: 429`, `overloaded_error`, `credit balance is too low`) và trả mã thoát `42` để kích hoạt kênh Fallback (`[SRC]`).                                                                                                  |
| **Domain: Open Inquiry (Vikini Governance)** |   `PASS`   |     `[SRC]`, `[CMD]`      | Kiểm tra sự tương thích với `scripts/verify-docs.mjs:1-303` (`[SRC]`): kiểm tra liên kết Markdown `[1/5]`, đường dẫn cũ `[2/5]`, tiền tố `.agents/` đầy đủ `[3/5]`, và giới hạn ký tự UTF-16 `[4/5]` (`<= 12,000` cho `.agents/rules/*.md`, `<= 10,000` cho `.agents/agents/*/agent.md`).                                                                                                                                                                                                                                                                                    |

#### 6. Claim Verification & Risk Table Audit (4.5.1, 4.5.3, 4.5.4)

- **Xác minh khẳng định về công cụ & phiên bản 2026 (`[URL]` & `[SRC]`)**:
  - **Claude Code CLI flags (`-p`, `--allowedTools`, `--dangerously-skip-permissions`)**: Xác minh qua tài liệu Claude Code CLI năm 2026 (`[URL]`: https://docs.anthropic.com/en/docs/claude-code/cli-usage và https://code.claude.com/docs/en/settings) — cờ `-p` chạy ở chế độ non-interactive print mode, `--allowedTools` giới hạn danh sách công cụ theo mẫu `Bash(npm:*,git:*,npx:*,node:*)`, và `--dangerously-skip-permissions` kết hợp với `-p` giúp tiến trình con không bị treo chờ prompt tương tác.
  - **Node.js 24 LTS, Vitest 4.1.11, TypeScript 5.9.3**: Xác minh qua `package.json:91,115,117,120` (`[SRC]`) và lịch phát hành chính thức năm 2026 (`[URL]`: https://nodejs.org/en/about/previous-releases, https://vitest.dev/blog/vitest-4, https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html).
- **Risk Table Audit (4.5.4)**:
  - **R1 (Cao)**: Ánh xạ tới Gate 1–9 trong `.agents/scripts/code-freeze-guard.js:443-554` (`[SRC]`) và quy định `AUDIT-ONLY WRITE SCOPE` trong `.agents/agents/reviewer/agent.md` + Test Contract `SW-G8`.
  - **R2 (Cao)**: Ánh xạ tới logic kiểm tra `isPending` trong `.agents/scripts/code-freeze-guard.js:207-214` (`[SRC]`) và quy trình cập nhật `- **Status**: Approved` ở Bước 2.1, 3.2, 4.4.
  - **R3 (Cao)**: Ánh xạ tới hàm `Normalize-PlanPath` trong `.agents/scripts/run-claude.ps1` thay thế `Resolve-Path -Relative` (`.agents/scripts/run-claude.ps1:72`, `[SRC]`), kèm Negative Probes 2, 3, 4 (§9.3) và Test Contract `SW-S3..SW-S5` (§8.2).
  - **R4 (Cao)**: Ánh xạ tới bộ lọc `SHELL_ESCAPE_HATCHES` và `MUTATING_FLAGS` tại `.agents/scripts/code-freeze-guard.js:560-585` (`[SRC]`) cùng unit tests `SW-G4..SW-G7` (§8.1).
  - **R5 (Trung bình)**: Ánh xạ tới cổng `[4/5]` của `scripts/verify-docs.mjs:198-231` (`[SRC]`), Probe 5 (§9.3) và Test Contract `SW-B1..SW-B5` (§8.3).
  - **R6 (Trung bình)**: Ánh xạ tới cơ chế bắt mã lỗi `exit 42` tại `.agents/scripts/run-claude.ps1:97-108` (`[SRC]`) và giới hạn 10 vòng lặp tại `.agents/rules/05-plan-review.md:60` (`[SRC]`).

#### 7. Adversarial Timelines (4.5.2)

```text
Cơ chế 1 (Trục 1 — Đồng thời / Multi-File Plan Sorting): Nhiều bản kế hoạch cùng tồn tại trong docs/plans/ khi chạy Revision Loop
T1: Trong docs/plans/ đã có bản kế hoạch cũ A có thẻ [PLAN_APPROVED] ở dòng cuối | T2: Primary Planner tạo bản kế hoạch mới B cho task hiện tại với "- **Status**: Ready for Review" (mtimeMs của B > A) | T3: Agent thử gọi write_to_file vào src/lib/features/x.ts trước khi B được duyệt
Kết cục: isPlanApproved() (.agents/scripts/code-freeze-guard.js:202-214) sắp xếp giảm dần theo mtimeMs, chỉ đọc entries[0] (bản kế hoạch B), phát hiện Status "Ready for Review" khớp regex isPending và trả về false → chặn thao tác ghi bằng decision: "ask" → AN TOÀN
```

```text
Cơ chế 2 (Trục 2 — Khoảng trống check→use / TOCTOU giữa [PLAN_APPROVED] và Header Status): Reviewer ghi thẻ phê duyệt vào file kế hoạch
T1: Reviewer ghi [PLAN_APPROVED] vào dòng cuối của file kế hoạch nhưng chưa cập nhật dòng "- **Status**: Ready for Review" ở 30 dòng đầu | T2: Orchestrator gọi công cụ sửa file trong src/ | T3: code-freeze-guard.js chạy isPlanApproved() kiểm tra Check 1 (headerLines) trước Check 2 (lastLine)
Kết cục: Nếu thiếu bước cập nhật header thì isPlanApproved() trả về false (fail-closed, không mở khóa nhầm); kế hoạch đã bắt buộc Reviewer cập nhật đồng thời "- **Status**: Approved" ở header và "[PLAN_APPROVED]" ở dòng cuối (Bước 2.1, 3.2, 4.4) → AN TOÀN
```

```text
Cơ chế 3 (Trục 3 — Thất bại giữa chừng & kích hoạt Fallback): Kênh Primary chạm trần quota hoặc lỗi tiến trình giữa phiên
T1: Orchestrator gọi run-claude.ps1 -Role planner để tạo hoặc cập nhật kế hoạch | T2: Tiến trình claude.exe trả về exit code != 0 kèm thông báo "Usage limit reached" hoặc "API Error: 429" | T3: run-claude.ps1 bắt mẫu lỗi tại dòng 98-108, in "[CLAUDE_PRO_QUOTA_EXCEEDED]" và thoát với exit code 42 (không đồng bộ file lỗi sang ArtifactFile vì $LASTEXITCODE != 0)
Kết cục: Orchestrator nhận mã thoát 42 và chuyển giao sang Fallback Subagent @planner (gemini-4-argon) để tiếp tục chuỗi lập kế hoạch không làm hỏng trạng thái repo → AN TOÀN
```

```text
Cơ chế 4 (Trục 4 — Môi trường thực thi độc lập của Hook Process): Mỗi lần gọi công cụ khởi chạy một tiến trình Node.js riêng cho code-freeze-guard.js
T1: Tiến trình hook thứ nhất kiểm tra lệnh run_command gọi run-claude.ps1 | T2: Tiến trình hook thứ hai kiểm tra lệnh write_to_file hoặc replace_file_content sau khi Reviewer cập nhật file kế hoạch trên đĩa | T3: isPlanApproved() đọc trực tiếp trạng thái thực tế từ hệ thống tệp (fs.readdirSync / fs.readFileSync) thay vì dựa vào bộ nhớ đệm in-memory giữa các lần gọi
Kết cục: Trạng thái đóng/mở băng mã nguồn luôn phản ánh đúng nội dung mới nhất trên đĩa tại thời điểm thực thi → AN TOÀN
```

#### 8. Commands Executed

1. `npm run type-check; npx vitest run .agents/scripts/code-freeze-guard.test.ts; git status --short` ➔ Exit code: `0` (`tsc --noEmit` 0 errors; Vitest `84 passed (84)`).
2. `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -CheckOnly; npm run lint` ➔ Exit code: `0` (`[CLAUDE_READY]`; ESLint 0 errors, 0 warnings).

#### 9. Kết Luận

Bản kế hoạch đáp ứng đầy đủ các tiêu chuẩn kỹ thuật, cổng kiểm chứng và ranh giới an toàn của dự án Vikini. Cấp thẻ phê duyệt triển khai:

[PLAN_APPROVED]
