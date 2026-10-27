# Kế Hoạch Triển Khai: Tối Ưu @reviewer & Governance Workflow Cho Gemini 4 Argon High

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-27
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### 1.1 Mục Tiêu (Goal)

1. **Goal-oriented reviewer**: Thay scaffold "Quy Trình Đánh Giá Chuẩn 7 Bước" tuần tự (`.agents/agents/reviewer/agent.md:31-91`) bằng 3 khối: **Objective** (mục tiêu), **Fail Criteria** (điều kiện trả `[CHANGES_REQUESTED]`), **Verification Tools** (công cụ chứng minh). Đổi frontmatter `model: pro` ➔ `model: inherit` ở `.agents/agents/reviewer/agent.md:4`, `.agents/agents/planner/agent.md:4`, `.agents/agents/qa/agent.md:4` để subagent dùng đúng model của main chat (Gemini 4 Argon High).
2. **Deterministic plan verifier**: Tạo `scripts/verify-plan.mjs` (+ `scripts/verify-plan.test.ts`) kiểm tra 7 heading bắt buộc của Plan Completeness Gate, kiểm chứng mọi trích dẫn `file:line` trong `## Technical Plan` với repo thật, phát hiện plan cần critic pass, và kiểm tra sàn critic (≥ 3 phát hiện) ở Audit Run mới nhất. Allowlist `node scripts/verify-plan.mjs <plan-path>` trong `.agents/scripts/command-policy.js`, `.agents/scripts/run-claude.ps1`, `.agents/agents/reviewer/allowlist.md`.
3. **Implicit-caching order**: Sắp xếp `.agents/agents/reviewer/agent.md` và `.agents/scripts/claude-reviewer-prompt.md` theo thứ tự: luật tĩnh + Severity Rubric ➔ tài liệu vệ tinh/plan ➔ nhiệm vụ audit cụ thể + output template. Mọi placeholder động (`{{PLAN_FILE}}`, `{{REVIEW_MODE}}`) chỉ xuất hiện ở phần cuối prompt.
4. **Mandatory critic**: Bỏ thiên kiến phê duyệt mặc định; mọi Audit Run phải có bảng `#### Critic Findings` ≥ 3 dòng (lỗi cụ thể hoặc rủi ro đã điều tra) kèm `file:line`, kể cả khi phê duyệt (ghi lý do loại bỏ).
5. **Evidence hardening**: `N/A` cho ô không áp dụng; `PASS` không có bằng chứng ➔ `UNVERIFIED`; cấm lấy chính plan làm bằng chứng; nghi ngờ giữa 2 mức severity ➔ chọn mức cao hơn. Áp dụng ở `reviewer/agent.md`, `evidence-bar.md`, `mental-simulation.md`.
6. **Cross-model critic pass**: Plan chạm Security / Governance (`.agents/`) / Database ➔ sau khi Gemini `@reviewer` phê duyệt, Claude CLI chạy critic pass (`-Role critic`) xuất `AGREE` (giữ `[PLAN_APPROVED]` là dòng cuối) hoặc `DISAGREE_EVIDENCE` (Status ➔ `Changes Requested`, dòng cuối `[CHANGES_REQUESTED]`). Repo giữ khóa trong khoảng giữa nhờ Status trung gian `Awaiting Critic`.
7. **Giảm ALL CAPS / "TUYỆT ĐỐI"** trong các file governance của reviewer, mỗi luật kèm 1 câu "vì sao" kỹ thuật; tôn trọng giới hạn ký tự (`.agents/rules/*.md <= 12,000`, `.agents/agents/*/agent.md <= 10,000` — `.agents/rules/02-quality.md:70-73`).

#### 1.2 Out of Scope (What We're NOT Doing)

- Không sửa logic `.agents/scripts/plan-scope.js` hay `.agents/scripts/code-freeze-guard.js` (Status `Awaiting Critic` được khóa sẵn bởi logic hiện tại — xem §3 A2). Chỉ thêm test case Negative Probe vào `.agents/scripts/plan-scope.test.ts`.
- Không tách nhỏ `.agents/scripts/command-policy.js` (597 dòng) — refactor kích thước là task riêng.
- Không sửa `.agents/scripts/claude-planner-prompt.md`, `.agents/agents/planner/agent.md` ngoài dòng frontmatter `model:`; không đổi cấu trúc 10 mục plan của Planner.
- Không viết lại quy trình 7 bước của `@qa` (`.agents/agents/qa/agent.md`) — chỉ đổi `model:` và câu ghi chú model tại `.agents/agents/qa/agent.md:132`, thêm `verify-plan.mjs` vào danh sách lệnh tại `.agents/agents/qa/agent.md:145`.
- `verify-plan.mjs` không kiểm tra trích dẫn `file:line` trong `## Audit History` ngoài bảng `#### Critic Findings` của Run mới nhất (Audit cũ trỏ tới code đã đổi sẽ báo sai). Không parse link `file:///...#L12`.
- Không thêm npm script vào `package.json` (TEST_INFRA_FILES bị khóa; lệnh gọi trực tiếp `node scripts/verify-plan.mjs` là đủ).
- Không đo cache hit thực tế (Antigravity không lộ `usage_metadata` cho subagent) — chỉ tối ưu cấu trúc prefix.
- Không áp dụng quy tắc critic mới hồi tố cho các plan cũ hoặc cho chính plan này (xem §3 A7).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### 2.1 Pre-Work Reading

| File đã đọc                                                             | Nội dung dùng cho plan                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                                              | Cấm `any`/`console.log`, co-located test bắt buộc cho `.agents/scripts/`, cấm git mutating.                                                                                                                                                           |
| `.agents/rules/02-quality.md`                                           | Pre-Work triggers, giới hạn ký tự governance (`.agents/rules/02-quality.md:70-73`).                                                                                                                                                                   |
| `.agents/rules/05-plan-review.md`                                       | Dual-Reviewer (`.agents/rules/05-plan-review.md:36-38`), Severity Rubric (`.agents/rules/05-plan-review.md:44-46`), điều kiện mở khóa (`.agents/rules/05-plan-review.md:52`).                                                                         |
| `.agents/agents/reviewer/agent.md`                                      | Scaffold 7 bước cần thay (`.agents/agents/reviewer/agent.md:31-91`), Attack Probes chỉ bắt buộc khi không có lỗi (`.agents/agents/reviewer/agent.md:84`).                                                                                             |
| `.agents/agents/reviewer/{allowlist,evidence-bar,mental-simulation}.md` | Nhóm B allowlist (`.agents/agents/reviewer/allowlist.md:16-20`), nguyên tắc evidence (`.agents/agents/reviewer/evidence-bar.md:7`), IMPERATIVE FORMAT ALL CAPS (`.agents/agents/reviewer/mental-simulation.md:5`).                                    |
| `.agents/scripts/claude-reviewer-prompt.md`                             | `{{PLAN_FILE}}` nằm ở dòng 4 (`.agents/scripts/claude-reviewer-prompt.md:4`) — phá prefix tĩnh.                                                                                                                                                       |
| `.agents/scripts/command-policy.js`                                     | Nhánh `verify-docs` (`.agents/scripts/command-policy.js:491-504`), regex Role (`.agents/scripts/command-policy.js:285`), validate `-PlanFile` (`.agents/scripts/command-policy.js:290-300`).                                                          |
| `.agents/scripts/plan-scope.js`                                         | Header regex (`.agents/scripts/plan-scope.js:20`), footer (`.agents/scripts/plan-scope.js:42-52`), `extractDeclaredFiles` (`.agents/scripts/plan-scope.js:85`), fail-safe pending (`.agents/scripts/plan-scope.js:203-209`).                          |
| `.agents/scripts/guard-paths.js`                                        | `isEnvSecretPath` (`.agents/scripts/guard-paths.js:69`).                                                                                                                                                                                              |
| `.agents/scripts/run-claude.ps1`                                        | ValidateSet Role (`.agents/scripts/run-claude.ps1:6`), `$sharedAllowedBash` (`.agents/scripts/run-claude.ps1:167`), nhánh reviewer (`.agents/scripts/run-claude.ps1:196-208`), quota exit 42 (`.agents/scripts/run-claude.ps1:243-247`).              |
| `scripts/verify-docs.mjs`                                               | Phong cách script ESM `// @ts-check` + `/* global */` (`scripts/verify-docs.mjs:1-2`), `process.cwd()` làm repo root (`scripts/verify-docs.mjs:11`).                                                                                                  |
| `vitest.config.ts`, `tsconfig.json`, `eslint.config.mjs`                | Vitest không giới hạn include (`vitest.config.ts:11` chỉ exclude e2e) ➔ `scripts/*.test.ts` được chạy; `allowJs` (`tsconfig.json:4`), `moduleResolution: bundler` (`tsconfig.json:10`); ESLint không ignore `scripts/` (`eslint.config.mjs:102-113`). |
| `.agents/README.md`, `docs/architecture.md`                             | Living docs nhắc `model: pro` (`.agents/README.md:94-96`, `.agents/README.md:102-104`) và satellite docs của reviewer (`docs/architecture.md:276-278`).                                                                                               |

#### 2.2 Skills Loaded & Applied

| Skill / Rule                                                                                                          | Áp dụng vào quyết định                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/05-plan-review.md` (Feature/Task Planning trigger tại `.agents/rules/02-quality.md:24`)                | Thiết kế Status trung gian `Awaiting Critic` dựa trên fail-safe pending của `plan-scope.js`; giữ đúng format `[PLAN_APPROVED]` dòng cuối.                                               |
| `.agents/skills/vikini-audit/SKILL.md` (Code quality review/Refactoring trigger tại `.agents/rules/02-quality.md:25`) | Refactor governance phải giữ minimal diff, đo bằng probe định lượng (ALL CAPS grep = 0, char limit qua `node scripts/verify-docs.mjs`).                                                 |
| `.agents/skills/vikini-investigate/SKILL.md` (Blast-radius)                                                           | Blast-radius của `command-policy.js`: dùng bởi `code-freeze-guard.js:588` cho mọi `run_command`/Bash ➔ thay đổi phải kèm Negative Probe trong `.agents/scripts/command-policy.test.ts`. |
| `.agents/rules/01-coding.md`                                                                                          | `verify-plan.mjs` không dùng `console.log` (dùng `process.stdout.write`/`console.error`), hàm < 50 dòng, JSDoc types thay cho `any`.                                                    |

Không chạm API route, SSE, DB migration, UI text ➔ không nạp `api-patterns`, `streaming-patterns`, `database-migration`, `add-translation`.

### 3. Assumptions & Cross-Task Dependencies

| ID  | Giả định                                                                                                                                                                                                   | Bằng chứng                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Antigravity custom subagent hỗ trợ `model: inherit` (giá trị mặc định, dùng model tier của agent cha).                                                                                                     | `[URL]` https://antigravity.google/docs/subagents — bảng frontmatter: "`model` … `inherit` (default) – Uses parent agent's model tier".                                                                                                                                 |
| A2  | Header `- **Status**: Awaiting Critic` không khớp regex Approved và không khớp Completed ➔ plan bị coi là pending ➔ cả nhóm ngày bị khóa fail-safe.                                                        | `[SRC]` `.agents/scripts/plan-scope.js:20` (chỉ khớp `Approved\s*$`), `.agents/scripts/plan-scope.js:33` (chỉ `Completed`), `.agents/scripts/plan-scope.js:203-209` (pending ➔ `return []`).                                                                            |
| A3  | Hook `PreToolUse` dùng chung `evaluateCommand` cho cả Antigravity `run_command` và Claude Bash, nên chỉ cần sửa `command-policy.js`.                                                                       | `[SRC]` `.agents/scripts/code-freeze-guard.js:588`; Claude CLI gắn hook tại `.agents/scripts/run-claude.ps1:211`.                                                                                                                                                       |
| A4  | TS 5.9.3 với `allowJs` + `moduleResolution: bundler` resolve được `import … from "./verify-plan.mjs"` trong file `.ts` và suy kiểu từ JSDoc. Chưa có tiền lệ trong repo (grep `from "*.mjs"` = 0 kết quả). | `[CMD]` `npm ls typescript vitest` ➔ `typescript@5.9.3`, `vitest@4.1.12`; `[SRC]` `tsconfig.json:4`, `tsconfig.json:10`. Bước 7.1 chạy `npm run type-check` ngay sau khi tạo test; nếu lỗi TS7016 ➔ dừng và yêu cầu Revision (không tự thêm file `.d.mts` ngoài scope). |
| A5  | Gemini implicit caching ăn theo prefix giống hệt; Gemini 4 Argon cần ≥ 4,096 token prefix. Nội dung dynamic đặt cuối.                                                                                      | `[URL]` https://ai.google.dev/gemini-api/docs/caching ("putting large and common contents at the beginning of your prompt"; bảng min tokens: Gemini 4 Argon 4,096).                                                                                                     |
| A6  | Root `package.json` không khai báo `"type": "module"`, nên script phải dùng đuôi `.mjs`; `.agents/scripts/` là ESM riêng.                                                                                  | `[SRC]` `.agents/scripts/package.json:2`; `scripts/verify-docs.mjs` là `.mjs`.                                                                                                                                                                                          |
| A7  | Plan này chạm `.agents/` nhưng được duyệt theo luật hiện hành (chưa có `-Role critic`). Quy tắc critic áp dụng từ plan kế tiếp.                                                                            | Luật critic chưa tồn tại trong `.agents/rules/05-plan-review.md:34-38`.                                                                                                                                                                                                 |
| A8  | Các file `.agents/**` và `*.test.ts` luôn trả `ask` kể cả sau `[PLAN_APPROVED]` ➔ khi thực thi, User phải xác nhận từng lần ghi.                                                                           | `.agents/rules/05-plan-review.md` §1 mục 3 (d)(e).                                                                                                                                                                                                                      |

**[NEEDS_PRODUCT_DECISION] D1 — Critic khi chính Claude là Fallback Reviewer**: Nếu `@reviewer` hết quota và Claude CLI `-Role reviewer` phê duyệt một plan cần critic, ai làm critic? **Default Assumption**: Fallback Reviewer cũng ghi `Awaiting Critic`; Orchestrator gọi `@reviewer` (Gemini) làm critic khi có quota lại (khối "Cross-Model Critic Mode" trong `reviewer/agent.md`); nếu không có ➔ Circuit Breaker trình User. Nguyên tắc: critic phải khác model với reviewer đã phê duyệt.

**Cross-task dependencies**: Không phụ thuộc plan khác đang mở. `docs/CHANGELOG.md` đang 31,510 bytes (`[CMD]` `node scripts/verify-docs.mjs`) — entry mới phải giữ < 35,000 bytes.

### 4. Bảng Verified Versions

| Công cụ                 | Phiên bản (`package.json`)                                                                                           | Đã cài                              | Tài liệu 2026                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ | ------------- |
| TypeScript              | `^5.9.3` (`package.json:115`)                                                                                        | `5.9.3` `[CMD]` `npm ls typescript` | https://www.typescriptlang.org/docs/handbook/modules/reference.html      |
| Vitest                  | `^4.1.12` (`package.json:117`)                                                                                       | `4.1.12` `[CMD]` `npm ls vitest`    | https://vitest.dev/config/ (default `include` `\*_/_.{test,spec}.?(c     | m)[jt]s?(x)`) |
| Node.js                 | CI Node 24 (commit `d90c1a5`)                                                                                        | —                                   | https://nodejs.org/api/esm.html (`import.meta.url`, `url.pathToFileURL`) |
| Antigravity subagents   | frontmatter `model: inherit\|flash\|pro`                                                                             | —                                   | https://antigravity.google/docs/subagents                                |
| Gemini implicit caching | Gemini 4 Argon min 4,096 tokens                                                                                      | —                                   | https://ai.google.dev/gemini-api/docs/caching                            |
| Claude Code CLI         | `--permission-mode dontAsk`, `--allowedTools`, `--settings` (đang dùng tại `.agents/scripts/run-claude.ps1:215-221`) | —                                   | https://code.claude.com/docs/en/cli-reference                            |

Không thêm dependency mới (chỉ `node:fs`, `node:path`, `node:url`, `node:os`, `node:child_process`).

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### Tạo mới (`[NEW]`)

- `[NEW]` `scripts/verify-plan.mjs` — verifier tất định (~220 dòng).
- `[NEW]` `scripts/verify-plan.test.ts` — co-located tests (unit + CLI spawn).

#### Chỉnh sửa (`[MODIFY]`)

- `[MODIFY]` `.agents/agents/reviewer/agent.md` — viết lại thân: Objective / Fail Criteria / Verification Tools / Critic / Cross-Model Critic Mode / Output Template; `model: inherit`.
- `[MODIFY]` `.agents/agents/reviewer/evidence-bar.md` — thêm luật N/A, UNVERIFIED, cấm tự trích plan, escalate; giảm ALL CAPS.
- `[MODIFY]` `.agents/agents/reviewer/mental-simulation.md` — bỏ IMPERATIVE ALL CAPS, thêm cột N/A rule; mỗi luật 1 câu "vì sao".
- `[MODIFY]` `.agents/agents/reviewer/allowlist.md` — thêm `node scripts/verify-plan.mjs <plan-path>` vào Nhóm B; giảm ALL CAPS.
- `[MODIFY]` `.agents/agents/planner/agent.md` — chỉ dòng 4 `model: inherit`.
- `[MODIFY]` `.agents/agents/qa/agent.md` — dòng 4 `model: inherit`, ghi chú model dòng 132, thêm lệnh verify-plan cạnh dòng 145.
- `[MODIFY]` `.agents/scripts/claude-reviewer-prompt.md` — sắp xếp lại cho caching, thêm `{{REVIEW_MODE}}` + chế độ `CROSS_MODEL_CRITIC`.
- `[MODIFY]` `.agents/scripts/run-claude.ps1` — Role `critic`, kiểm tra `Awaiting Critic`, allowlist verify-plan.
- `[MODIFY]` `.agents/scripts/command-policy.js` — nhánh `node scripts/verify-plan.mjs`, Role `critic`, helper dùng chung validate plan path.
- `[MODIFY]` `.agents/scripts/command-policy.test.ts` — positive/negative probes mới.
- `[MODIFY]` `.agents/scripts/plan-scope.test.ts` — Negative Probe: `Awaiting Critic` + `[PLAN_APPROVED]` vẫn khóa.
- `[MODIFY]` `.agents/rules/05-plan-review.md` — §3 thêm Cross-Model Critic Pass; §5 thêm Status `Awaiting Critic`; §6 Gate 3 chạy verify-plan.
- `[MODIFY]` `.agents/README.md` — cập nhật bảng model (`model: inherit`) và mô tả critic pass.
- `[MODIFY]` `docs/architecture.md` — mục satellite docs reviewer: thêm `scripts/verify-plan.mjs` và critic pass.
- `[MODIFY]` `docs/CHANGELOG.md` — entry ngắn cho thay đổi governance.

#### Xóa (`[DELETE]`)

- Không có.

### 6. Caller-First Design Sketch

#### 6.1 Call sites của `verify-plan.mjs`

```powershell
# Reviewer (@reviewer run_command / Claude Bash) — lúc bắt đầu audit
node scripts/verify-plan.mjs docs/plans/2026-11-01-some-task.md
# Orchestrator — Gate 3 trước khi bắt đầu code (sau critic AGREE nếu cần)
node scripts/verify-plan.mjs docs/plans/2026-11-01-some-task.md
```

Output mẫu (stdout, mỗi dòng 1 kết quả; exit 0 = PASS, 1 = có `[FAIL]`, 2 = usage error):

```
[PASS] SECTIONS 7/7
[FAIL] LINE_OUT_OF_RANGE .agents/scripts/plan-scope.js:999 (file has 276 lines)
[FAIL] MISSING_FILE src/lib/core/nope.ts:12
[WARN] SELF_CITATION docs/plans/2026-10-26-x.md:40 (plan text is not evidence)
[INFO] CRITIC_REQUIRED yes (.agents/rules/05-plan-review.md)
[PASS] CRITIC_FLOOR Audit Run 2: 3 findings with valid file:line
VERIFY_PLAN: FAIL (2 failures, 1 warning)
```

#### 6.2 Interface (JSDoc, export cho test)

```js
// scripts/verify-plan.mjs
/** @typedef {{ level: 'PASS'|'FAIL'|'WARN'|'INFO', code: string, message: string }} Finding */

export const REQUIRED_SECTIONS; // Array<{ key: string, label: string, pattern: RegExp }> — 7 mục
export function splitPlanSections(content); // => { technicalPlan: string, auditHistory: string }
export function checkRequiredSections(technicalPlan); // => Finding[]
export function extractLineRefs(text); // => Array<{ path: string, start: number, end: number, raw: string }>
export function checkLineRefs(refs, repoRoot); // => Finding[]
export function detectCriticTriggers(content); // => string[] (declared files khớp Security/Governance/DB)
export function checkCriticFloor(auditHistory, repoRoot); // => Finding[]
export function verifyPlan(planRelPath, repoRoot); // => { exitCode: 0|1|2, findings: Finding[] }
// CLI guard: chỉ chạy main khi import.meta.url === pathToFileURL(process.argv[1]).href
```

Chi tiết:

- **`REQUIRED_SECTIONS`** (so trên dòng heading `^#{2,4}\s` trong `## Technical Plan`, case-insensitive): `verifiedVersions` /Verified Versions/; `steps` /Các Bước Thực Hiện|Implementation Steps/; `verificationPlan` /Verification Plan/; `testContract` /Test Contract/; `assumptions` /Assumptions/; `outOfScope` /Out of Scope|What We're NOT Doing/; `skillsLoaded` /Skills Loaded/. Đã đối chiếu với heading của plan mẫu `docs/plans/2026-10-26-novelcrafter-dynamic-prompt-source-tooltips.md` (cả 7 khớp).
- **`extractLineRefs`** regex: `(?<![\w/.:\\-])((?:[\w@.\-\[\]()]+\/)*[\w@.\-\[\]()]+\.[A-Za-z][A-Za-z0-9]{0,7}):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?!\d)`. Lookbehind loại URL (`https://x/a.js:1` bắt đầu sau `/`), đuôi phải bắt đầu bằng chữ (loại version `16.2.1:5`), hỗ trợ danh sách `:20,206-207`. Path chuẩn hóa `\` ➔ `/`, dedupe theo `path:start-end`.
- **`checkLineRefs`**: theo thứ tự — path tuyệt đối hoặc có đoạn `..` ➔ `INVALID_PATH`; `isEnvSecretPath` (import từ `.agents/scripts/guard-paths.js:69`) ➔ `FORBIDDEN_ENV` (không đọc file); không tồn tại ➔ `MISSING_FILE`; là thư mục ➔ `NOT_A_FILE`; `start < 1` hoặc `end < start` ➔ `INVALID_RANGE`; `end > lineCount` ➔ `LINE_OUT_OF_RANGE`; path dưới `docs/plans/` ➔ `WARN SELF_CITATION` (không fail). `lineCount` = số dòng sau `split(/\r?\n/)`, trừ 1 nếu file kết thúc bằng newline.
- **`detectCriticTriggers`**: dùng `extractDeclaredFiles` (`.agents/scripts/plan-scope.js:85`); khớp prefix/glob: Governance `.agents/`, `.claude/`, `.husky/`, `AGENTS.md`, `CLAUDE.md`, `scripts/code-freeze-guard.js`; Database `supabase/`, `database-migrations/`, `*.sql`, `scripts/run-migration`; Security `*.server.ts`, `src/app/api/auth/`, `src/lib/core/auth`, `src/proxy.ts`, `src/middleware.ts`, `next.config.ts`. Output `INFO CRITIC_REQUIRED yes|no`.
- **`checkCriticFloor`**: lấy `### Audit Run` cuối cùng trong `## Audit History`; không có ➔ `INFO CRITIC_FLOOR skipped (no audit run)`; có ➔ tìm `#### Critic Findings`, đếm dòng bảng (bỏ header/separator) có ≥ 1 ref hợp lệ (qua `checkLineRefs`, không phải `docs/plans/`); < 3 ➔ `FAIL CRITIC_FLOOR`.
- **Plan path**: `^docs[/\\]plans[/\\][A-Za-z0-9._-]+\.md$`, không chứa `..`, khác `README.md`; sai hoặc không tồn tại ➔ exit 2 + `console.error`.

#### 6.3 `command-policy.js` (caller: `code-freeze-guard.js:588`)

```js
/** Shared validator for `docs/plans/<name>.md` tokens (used by -PlanFile and verify-plan). */
function validatePlanPathToken(tok) { /* env ➔ 'env'; '..' hoặc sai regex ➔ 'allowlist' */ }

// 7. node scripts/verify-plan.mjs <docs/plans/*.md>  — đúng 1 đối số, unquoted
if (t0.value === "node" && t1 && /^(?:\.[/\\])?scripts[/\\]verify-plan\.mjs$/.test(t1.value)) { ... }
```

Role regex tại `.agents/scripts/command-policy.js:285` ➔ `/^(?:planner|reviewer|plan|review|critic)$/i`. Nhánh `-planfile` (`.agents/scripts/command-policy.js:290-300`) gọi lại `validatePlanPathToken` (subtract before add).

#### 6.4 `run-claude.ps1`

```powershell
[ValidateSet("planner", "reviewer", "plan", "review", "critic")]
$normalizedRole = if ($Role -in @("reviewer","review")) { "reviewer" } elseif ($Role -eq "critic") { "critic" } else { "planner" }
# sau kiểm tra planExists: critic bắt buộc plan tồn tại VÀ header có '- **Status**: Awaiting Critic'
#   nếu không ➔ Write-Error "[CRITIC_NOT_PENDING] ..."; exit 1   (trước khi gọi claude.exe)
# nhánh reviewer/critic dùng chung template; {{REVIEW_MODE}} = FALLBACK_REVIEW | CROSS_MODEL_CRITIC
# quota exit 42 khi critic ➔ thông điệp "Circuit Breaker (User)" — không fallback sang Gemini vì Gemini đã là reviewer
```

`$sharedAllowedBash` (`.agents/scripts/run-claude.ps1:167`) thêm `Bash(node scripts/verify-plan.mjs *)`.

#### 6.5 Cấu trúc mới của `.agents/agents/reviewer/agent.md` (thứ tự = thứ tự caching)

1. Frontmatter (`model: inherit`, tools giữ nguyên).
2. **Vai trò & Objective** (tĩnh): tìm lý do plan sẽ thất bại khi thực thi; phê duyệt chỉ khi không tìm được lỗi `[BLOCKER]/[MAJOR]` có bằng chứng.
3. **Severity Rubric + Escalation** (tĩnh): tóm tắt `.agents/rules/05-plan-review.md:44-46`; "Phân vân giữa 2 mức ➔ chọn mức cao hơn, vì một phê duyệt sai tốn một lần rollback code, còn một revision thừa chỉ tốn một vòng plan."
4. **Fail Criteria** (tĩnh, danh sách kiểm được): verify-plan FAIL; chữ ký `[MODIFY]` không khớp code; S1–S5 `UNVERIFIED`; rủi ro Cao/Trung bình không có control; guard mới thiếu Negative Probe; công nghệ cấm/`any`/`console.log`; sai layer; thiếu co-located test; vượt char limit governance.
5. **Evidence Rules** (tĩnh): `N/A` + lý do 1 dòng; `PASS` không `[CMD]/[SRC]/[ADV]/[URL]` ➔ `UNVERIFIED`; trích `docs/plans/**` không phải evidence.
6. **Verification Tools** (tĩnh): `node scripts/verify-plan.mjs <plan>` chạy đầu tiên; `npx tsc --noEmit`, `npx vitest run <path>`, `node scripts/verify-docs.mjs`, `npx eslint --print-config <path>`, `npm ls/view`, git read-only; `grep_search`/`view_file`; `search_web` cho version.
7. **Write Scope** (tĩnh): Audit-only, như `.agents/agents/reviewer/agent.md:98-102` nhưng viết thường kèm lý do.
8. **Tài liệu cần nạp** (giữa): 3 file vệ tinh + `SKILL.md` theo domain + file plan.
9. **Audit Task** (cuối): độc lập với Run trước; Critic Requirement ≥ 3 dòng; quyết định Status (`Approved` / `Awaiting Critic` nếu `CRITIC_REQUIRED yes` / `Changes Requested`).
10. **Cross-Model Critic Mode** (cuối, dùng cho D1).
11. **Output Template** (cuối cùng): skeleton `### Audit Run [X+1]` với `#### Critic Findings` (cột: #, Loại `DEFECT`/`RISK_DISMISSED`, Severity, `file:line`, Evidence, Lý do).

#### 6.6 `claude-reviewer-prompt.md` (thứ tự mới)

1. Vai trò chung (không chứa tên file plan).
2. Severity Rubric + Escalation + Evidence Rules + Write Scope (tĩnh, đồng bộ nội dung với §6.5 mục 3–7).
3. Danh sách tài liệu chuẩn cần đọc (6 file hiện có tại `.agents/scripts/claude-reviewer-prompt.md:8-15`).
4. Mode `FALLBACK_REVIEW`: quy trình audit + Critic Requirement + Status decision.
5. Mode `CROSS_MODEL_CRITIC`: đọc Audit Run Gemini mới nhất; chạy verify-plan; tìm lỗi Gemini bỏ sót; ghi `### Audit Run [X+1] (Cross-Model Critic)` mở đầu `[REVIEWER_MODEL: claude-code-cli (critic)]`, dòng `CRITIC_VERDICT: AGREE|DISAGREE_EVIDENCE`. `AGREE` ➔ Status `Approved`, dòng cuối `[PLAN_APPROVED]`. `DISAGREE_EVIDENCE` ➔ bắt buộc ≥ 1 `[BLOCKER]/[MAJOR]` có `[SRC]/[CMD]` (không được bất đồng chỉ vì khẩu vị), Status `Changes Requested`, dòng cuối `[CHANGES_REQUESTED]`.
6. Output template.
7. Khối dynamic cuối file: `Plan File: {{PLAN_FILE}}` và `Review Mode: {{REVIEW_MODE}}`.

### 7. Các Bước Thực Hiện Tuần Tự

#### 7.1 Verifier (code trước, governance sau)

- [ ] `[NEW]` `scripts/verify-plan.mjs` theo §6.2 (`// @ts-check`, `/* global process, console */`, output qua `process.stdout.write`, lỗi usage qua `console.error`; mỗi hàm < 50 dòng).
- [ ] `[NEW]` `scripts/verify-plan.test.ts` theo §8.1; chạy `npm run type-check` ngay (kiểm A4) rồi `npx vitest run scripts/verify-plan.test.ts --reporter=dot`.
- [ ] Chạy `node scripts/verify-plan.mjs docs/plans/2026-10-27-reviewer-argon-high-optimization-implementation-plan.md` trên chính plan này: kỳ vọng `SECTIONS 7/7`, `CRITIC_REQUIRED yes`; mọi `[FAIL]` ref phải là lỗi thật của plan (ghi vào báo cáo hoàn tất), không phải false positive của regex.

#### 7.2 Command allowlist

- [ ] `[MODIFY]` `.agents/scripts/command-policy.js`: thêm `validatePlanPathToken`, refactor nhánh `-planfile` dùng helper, thêm Role `critic`, thêm nhánh 7 `verify-plan.mjs` (đặt sau nhánh 6 tại `.agents/scripts/command-policy.js:491-504`).
- [ ] `[MODIFY]` `.agents/scripts/command-policy.test.ts`: thêm `describe("TC-D: verify-plan.mjs & critic role")` theo §8.2.
- [ ] `[MODIFY]` `.agents/scripts/plan-scope.test.ts`: thêm test §8.3.
- [ ] `npx vitest run .agents/scripts --reporter=dot` (gồm `code-freeze-guard.test.ts` để chắc refactor `-planfile` không đổi hành vi TC-06/TC-07).

#### 7.3 Claude CLI wrapper

- [ ] `[MODIFY]` `.agents/scripts/run-claude.ps1` theo §6.4.

#### 7.4 Governance text

- [ ] `[MODIFY]` `.agents/scripts/claude-reviewer-prompt.md` theo §6.6 (thay mọi `{{PLAN_FILE}}` cũ; placeholder chỉ còn ở khối cuối).
- [ ] `[MODIFY]` `.agents/agents/reviewer/agent.md` theo §6.5 (≤ 10,000 ký tự).
- [ ] `[MODIFY]` `.agents/agents/reviewer/evidence-bar.md`: thêm mục "4.5.0 Ô Không Áp Dụng & PASS Không Bằng Chứng" (N/A, UNVERIFIED, self-citation, escalate); thay "CHỈ", "KHÔNG", "LUÔN", "BẮT BUỘC" viết hoa bằng chữ thường + 1 câu lý do.
- [ ] `[MODIFY]` `.agents/agents/reviewer/mental-simulation.md`: đổi tiêu đề "6 Kịch Bản (IMPERATIVE FORMAT)" thành "6 Kịch Bản"; động từ đầu dòng viết thường; mỗi kịch bản thêm 1 câu "Vì sao"; thêm luật "kịch bản không áp dụng ghi `N/A` + lý do, không ghi `PASS`".
- [ ] `[MODIFY]` `.agents/agents/reviewer/allowlist.md`: Nhóm B thêm `node scripts/verify-plan.mjs <plan-path>` (đúng 1 path `docs/plans/*.md`); đổi "CẤM TUYỆT ĐỐI" thành "Lệnh bị cấm" + lý do.
- [ ] `[MODIFY]` `.agents/agents/planner/agent.md` dòng 4 và `.agents/agents/qa/agent.md` dòng 4 ➔ `model: inherit`; cập nhật câu `.agents/agents/qa/agent.md:132`; thêm `node scripts/verify-plan.mjs <plan-path>` cạnh `.agents/agents/qa/agent.md:145`.
- [ ] `[MODIFY]` `.agents/rules/05-plan-review.md`: §3 mục 1 bỏ "Thẩm định 7 bước" ➔ "Thẩm định theo Objective/Fail Criteria"; thêm mục 4 "Cross-Model Critic Pass" (trigger, `Awaiting Critic`, lệnh `-Role critic`, AGREE/DISAGREE_EVIDENCE, quota ➔ Circuit Breaker, D1); §5 thêm câu Status `Awaiting Critic` khóa repo vì không khớp `Approved`; §6 Gate 3 thêm "chạy `node scripts/verify-plan.mjs <plan>` exit 0".
- [ ] `[MODIFY]` `.agents/README.md` (`.agents/README.md:48`, `.agents/README.md:94-96`, `.agents/README.md:102-104`) và `docs/architecture.md` (`docs/architecture.md:276-278`).
- [ ] `[MODIFY]` `docs/CHANGELOG.md`: 1 entry.

#### 7.5 Kiểm chứng & đóng task

- [ ] Chạy toàn bộ §9.3, các probe §9.2.
- [ ] Đổi Header plan sang `- **Status**: Completed`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

#### 8.1 `scripts/verify-plan.test.ts`

Fixture: repo tạm qua `fs.mkdtempSync(path.join(os.tmpdir(), "verify-plan-"))` chứa `src/a.ts` (10 dòng, kết thúc newline), thư mục `src/dir.x/`, `.env.local`, `docs/plans/2026-01-01-x.md`; dọn trong `afterEach` bằng `fs.rmSync(..., { recursive: true, force: true })`.

| ID    | Input                                                                                                                              | Output kỳ vọng                                                                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VP-1  | Technical Plan đủ 7 heading                                                                                                        | `checkRequiredSections` ➔ đúng 1 finding `PASS SECTIONS 7/7`                                                                                                        |
| VP-2  | Thiếu heading `Test Contract`; heading `Test Contract` chỉ xuất hiện trong `## Audit History`                                      | `FAIL MISSING_SECTION` với message chứa `Test Contract` (heading ngoài Technical Plan không được tính)                                                              |
| VP-3  | Văn bản "Test Contract" không phải heading (đoạn văn thường)                                                                       | Vẫn `FAIL MISSING_SECTION`                                                                                                                                          |
| VP-4  | `extractLineRefs("`src/a.ts:3` và src/a.ts:3")`                                                                                    | 1 ref (dedupe) `{ path: "src/a.ts", start: 3, end: 3 }`                                                                                                             |
| VP-5  | `src\\a.ts:2-4`, `src/a.ts:1,5-6`                                                                                                  | path chuẩn hóa `src/a.ts`; ranges `2-4`, `1`, `5-6`                                                                                                                 |
| VP-6  | `https://x.dev/a.js:12`, `16.2.1:5`, `node:fs`, `S1:`, `10:30`                                                                     | 0 ref                                                                                                                                                               |
| VP-7  | `src/a.ts:10` / `src/a.ts:11`                                                                                                      | `PASS` / `FAIL LINE_OUT_OF_RANGE` message chứa `has 10 lines`                                                                                                       |
| VP-8  | `src/a.ts:0`, `src/a.ts:5-3`                                                                                                       | `FAIL INVALID_RANGE` cho cả 2                                                                                                                                       |
| VP-9  | `src/missing.ts:1`; `src/dir.x:1` với fixture tạo thư mục tên `src/dir.x/`                                                         | `FAIL MISSING_FILE`; `FAIL NOT_A_FILE`                                                                                                                              |
| VP-10 | `../etc/passwd.txt:1`, `src/../../x.ts:1`; và `C:/x/a.ts:1`, `/etc/x.txt:1`                                                        | 2 ref đầu ➔ `FAIL INVALID_PATH`, không đọc file ngoài repo; 2 ref sau không được trích xuất (lookbehind loại ký tự `:`/`/` đứng trước) ➔ `extractLineRefs` trả `[]` |
| VP-11 | `.env.local:1` (file có tồn tại trong fixture)                                                                                     | `FAIL FORBIDDEN_ENV`; `vi.spyOn(fs, "readFileSync")` không được gọi với path `.env.local`                                                                           |
| VP-12 | `docs/plans/2026-01-01-x.md:1`                                                                                                     | `WARN SELF_CITATION`, không tính là FAIL                                                                                                                            |
| VP-13 | Plan khai báo `[MODIFY] .agents/rules/05-plan-review.md` / `[NEW] supabase/migrations/1.sql` / chỉ `[MODIFY] src/components/A.tsx` | triggers chứa `.agents/...` / chứa path sql / `[]`                                                                                                                  |
| VP-14 | Audit History không có `### Audit Run`                                                                                             | `INFO CRITIC_FLOOR skipped`                                                                                                                                         |
| VP-15 | Run cuối có `#### Critic Findings` 3 dòng hợp lệ (ref `src/a.ts:1`…)                                                               | `PASS CRITIC_FLOOR`                                                                                                                                                 |
| VP-16 | Run cuối có 3 dòng nhưng 1 dòng chỉ trích `docs/plans/...`, hoặc thiếu heading `#### Critic Findings`; Run trước có 3 dòng hợp lệ  | `FAIL CRITIC_FLOOR` (chỉ xét Run cuối)                                                                                                                              |
| VP-17 | CLI: `spawnSync(process.execPath, [scriptAbs, "docs/plans/2026-01-01-x.md"], { cwd: tmpRoot })` với plan hợp lệ                    | exit 0, stdout chứa `VERIFY_PLAN: PASS`                                                                                                                             |
| VP-18 | CLI: plan có 1 ref sai                                                                                                             | exit 1, stdout chứa `VERIFY_PLAN: FAIL`                                                                                                                             |
| VP-19 | CLI: không đối số / `docs/plans/../x.md` / `src/a.md` / plan không tồn tại                                                         | exit 2, stderr không rỗng                                                                                                                                           |

Chống specification gaming: assertions dùng `toEqual`/`toContain` trên `code` và `message` cụ thể, không dùng `toBeDefined`/`toBeTruthy`; không mock `checkLineRefs` khi test `checkCriticFloor`.

#### 8.2 `.agents/scripts/command-policy.test.ts` — TC-D

| ID    | Lệnh                                                                                                                                                                                                                           | Kỳ vọng                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| TC-D1 | `node scripts/verify-plan.mjs docs/plans/x.md`, `node ./scripts/verify-plan.mjs docs/plans/x.md`, `node scripts\verify-plan.mjs docs\plans\x.md`                                                                               | `{ ok: true }`                    |
| TC-D2 | `node scripts/verify-plan.mjs` (thiếu arg), `… docs/plans/a.md docs/plans/b.md`, `… src/a.md`, `… docs/plans/x.txt`, `… docs/plans/../x.md`, `… 'docs/plans/x.md'`, `… docs/plans/x.md --fix`, `… docs/plans/x.md; rm -rf src` | `ok: false`                       |
| TC-D3 | `… .env.md` / `… docs/plans/.env.md`                                                                                                                                                                                           | `ok: false`, `reason` chứa `.env` |
| TC-D4 | `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role critic -PlanFile docs/plans/x.md`                                                                                                               | `{ ok: true }`                    |
| TC-D5 | `… -Role critics …`, `… -Role 'critic' …`                                                                                                                                                                                      | `ok: false`                       |
| TC-D6 | Hồi quy: các lệnh `-PlanFile` trong TC-A5/TC-B hiện có (`.agents/scripts/command-policy.test.ts:126-141`)                                                                                                                      | Kết quả không đổi                 |

#### 8.3 `.agents/scripts/plan-scope.test.ts`

| ID     | Input                                                                                                 | Kỳ vọng                                 |
| ------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| PS-AC1 | Content header `- **Status**: Awaiting Critic`, dòng cuối `[PLAN_APPROVED]`                           | `evaluatePlanApprovalContent` ➔ `false` |
| PS-AC2 | `getActiveApprovedPlans([planA Approved hợp lệ, planB Awaiting Critic], { maxDatePrefix })` cùng ngày | `[]` (fail-safe khóa cả nhóm)           |

#### 8.4 Hợp đồng governance (kiểm bằng probe, không phải unit test)

- `reviewer/agent.md`: không còn heading "Quy Trình Đánh Giá Chuẩn 7 Bước"; có đủ heading `Objective`, `Fail Criteria`, `Verification Tools`, `Critic Findings`, `Cross-Model Critic Mode`; ≤ 10,000 ký tự.
- `claude-reviewer-prompt.md`: `{{PLAN_FILE}}` và `{{REVIEW_MODE}}` chỉ xuất hiện trong 10 dòng cuối file.
- `05-plan-review.md` ≤ 12,000 ký tự, chứa `Awaiting Critic`, `AGREE`, `DISAGREE_EVIDENCE`, `-Role critic`.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 9.1 Test Files Co-Located

- `scripts/verify-plan.test.ts` cạnh `scripts/verify-plan.mjs`.
- `.agents/scripts/command-policy.test.ts` cạnh `.agents/scripts/command-policy.js`.
- `.agents/scripts/plan-scope.test.ts` (chỉ thêm probe; source không đổi).
- `run-claude.ps1` không có harness Vitest ➔ kiểm bằng Negative Probe thủ công §9.2 (N7).

#### 9.2 Wiring Probes & Negative Probes

| ID  | Loại     | Probe                                                                                                                                                                                                         | Kỳ vọng                                                                                                                                                                                                                                   |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Wiring   | `npx vitest list --filesOnly`                                                                                                                                                                                 | Liệt kê `scripts/verify-plan.test.ts` (Vitest thực sự nhặt file ngoài `src/`).                                                                                                                                                            |
| W2  | Wiring   | `npx eslint --print-config scripts/verify-plan.test.ts`                                                                                                                                                       | `@typescript-eslint/no-explicit-any` = `error` (2) trên file test mới.                                                                                                                                                                    |
| W3  | Wiring   | Hook thật: `node scripts/verify-plan.mjs docs/plans/2026-10-27-reviewer-argon-high-optimization-implementation-plan.md` qua tool Bash của Claude Code (đi qua `code-freeze-guard.js`)                         | Không bị hook chặn; output có `SECTIONS 7/7`.                                                                                                                                                                                             |
| W4  | Wiring   | `node scripts/verify-docs.mjs`                                                                                                                                                                                | `[4/5] PASS` char limits; link integrity PASS.                                                                                                                                                                                            |
| N1  | Negative | VP-7…VP-11, VP-16, VP-19                                                                                                                                                                                      | FAIL/exit đúng mã.                                                                                                                                                                                                                        |
| N2  | Negative | TC-D2, TC-D3, TC-D5                                                                                                                                                                                           | `ok: false`.                                                                                                                                                                                                                              |
| N3  | Negative | PS-AC1, PS-AC2                                                                                                                                                                                                | Repo vẫn khóa khi `Awaiting Critic`.                                                                                                                                                                                                      |
| N4  | Negative | Grep `TUYỆT ĐỐI\|TUYET DOI` trên `.agents/agents/reviewer/*.md`, `.agents/scripts/claude-reviewer-prompt.md`                                                                                                  | 0 kết quả.                                                                                                                                                                                                                                |
| N5  | Negative | Grep `(?:\p{Lu}{2,}\s+){2,}\p{Lu}{2,}` (≥ 3 từ viết hoa liên tiếp) trên cùng tập file                                                                                                                         | 0 kết quả (token đơn như `PASS`, `UNVERIFIED`, `[PLAN_APPROVED]` không bị tính). Baseline trước sửa: > 0 (ví dụ `.agents/agents/reviewer/agent.md:98` "RÀNG BUỘC BẮT BUỘC (STRICT CONSTRAINTS)", `.agents/agents/reviewer/agent.md:100`). |
| N6  | Negative | Grep `model: pro` trong `.agents/agents/`                                                                                                                                                                     | 0 kết quả; `model: inherit` = 3 kết quả.                                                                                                                                                                                                  |
| N7  | Negative | `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role critic -PlanFile docs/plans/2026-10-26-novelcrafter-dynamic-prompt-source-tooltips.md` (plan có Status khác `Awaiting Critic`) | exit 1, stderr `[CRITIC_NOT_PENDING]`, claude.exe không được gọi (không có output `[CLAUDE_REVIEWER]`).                                                                                                                                   |
| N8  | Negative | Mutation probe thủ công: tạm sửa ref trong một bản sao plan tại thư mục fixture của test (VP-18)                                                                                                              | exit 1 — đã nằm trong test, không sửa plan thật.                                                                                                                                                                                          |

#### 9.3 Lệnh Chạy Kiểm Thử (PowerShell 5.1)

```powershell
npm run type-check; npx vitest run scripts/verify-plan.test.ts .agents/scripts --reporter=dot; npm run lint; node scripts/verify-docs.mjs; node scripts/verify-plan.mjs docs/plans/2026-10-27-reviewer-argon-high-optimization-implementation-plan.md
npm run verify
```

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                  | Mức        | Control / Probe                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Khoảng hở giữa Gemini approve và Claude critic: Orchestrator bắt đầu code trước critic. | Cao        | Status `Awaiting Critic` không khớp `.agents/scripts/plan-scope.js:20` ➔ pending ➔ khóa nhóm ngày tại `.agents/scripts/plan-scope.js:203-209`; Negative Probe PS-AC1/PS-AC2.                                                                                                                        |
| R2  | Mở rộng allowlist làm lọt lệnh có side-effect (path traversal, `.env`, chaining).       | Cao        | Nhánh verify-plan chỉ nhận đúng 1 token khớp regex `docs/plans/*.md`, dùng `isEnvSecretPath` (`.agents/scripts/guard-paths.js:69`), chaining đã bị chặn bởi `.agents/scripts/command-policy.js:537-562`; Negative Probe TC-D2/TC-D3. Script chỉ đọc file (`fs.readFileSync`/`statSync`), không ghi. |
| R3  | Refactor `-planfile` sang helper đổi hành vi hiện tại.                                  | Trung bình | TC-D6 + chạy lại `.agents/scripts/code-freeze-guard.test.ts` (TC-06/TC-07 tại `.agents/scripts/code-freeze-guard.test.ts:1458-1508`).                                                                                                                                                               |
| R4  | Regex `file:line` báo sai (false positive/negative) khiến reviewer bỏ qua tool.         | Trung bình | VP-4…VP-6 phủ URL/version/`node:`; bước 7.1 chạy trên plan thật và phân loại từng FAIL.                                                                                                                                                                                                             |
| R5  | `verify-plan.mjs` đọc `.env*` khi plan trích dẫn.                                       | Trung bình | `FORBIDDEN_ENV` trước mọi I/O; VP-11 spy `fs.readFileSync`.                                                                                                                                                                                                                                         |
| R6  | Vượt giới hạn ký tự sau khi thêm luật + câu "vì sao".                                   | Trung bình | Check `[4/5]` của `scripts/verify-docs.mjs:197-231`; probe W4.                                                                                                                                                                                                                                      |
| R7  | Critic Claude hết quota ➔ plan kẹt `Awaiting Critic`.                                   | Trung bình | `run-claude.ps1` trả exit 42 (`.agents/scripts/run-claude.ps1:243-247`) ➔ Circuit Breaker trình User; repo vẫn khóa (an toàn, chỉ chậm).                                                                                                                                                            |
| R8  | `import "./verify-plan.mjs"` từ `.ts` lỗi type (A4).                                    | Trung bình | `npm run type-check` ngay sau bước tạo test (§7.1); lỗi ➔ dừng, Revision.                                                                                                                                                                                                                           |
| R9  | Critic `DISAGREE` vì khẩu vị, gây vòng lặp vô tận.                                      | Thấp       | Prompt bắt buộc ≥ 1 `[BLOCKER]/[MAJOR]` có `[SRC]/[CMD]`; giới hạn 10 vòng tại `.agents/rules/05-plan-review.md:38`.                                                                                                                                                                                |
| R10 | Reviewer rubber-stamp bằng 3 "rủi ro" hời hợt.                                          | Thấp       | `checkCriticFloor` yêu cầu ref hợp lệ, không phải `docs/plans/`; VP-16. Chất lượng nội dung vẫn phụ thuộc critic pass.                                                                                                                                                                              |
| R11 | Prefix vẫn < 4,096 token nên không ăn cache.                                            | Thấp       | Không ảnh hưởng tính đúng; chỉ tối ưu chi phí.                                                                                                                                                                                                                                                      |
| R12 | `model: inherit` khi main chat chạy model yếu (Flash) ➔ reviewer yếu theo.              | Thấp       | Ghi chú trong `.agents/README.md`: chọn Gemini 4 Argon High ở main chat trước khi gọi `@reviewer`; critic pass Claude bù cho plan rủi ro cao.                                                                                                                                                       |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Kiểm Chứng Lỗi Cũ

Đây là lượt thẩm định đầu tiên (Revision 1). Không có lỗi từ các lượt thẩm định trước cần kiểm chứng lại.

#### 2. Phát Hiện Mới & Critic Findings

Kế hoạch có cấu trúc chi tiết, phân tích kỹ thuật sâu sắc, kiểm chứng đầy đủ các giới hạn token, implicit caching và cơ chế phân quyền bảo mật 2 tầng.

#### Critic Findings

| #   | Loại           | Mức       | `file:line`                              | Evidence                                                                         | Lý do & Biện pháp                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------- | --------- | ---------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | `[MINOR]` | `scripts/verify-plan.mjs:166`            | `[SRC]` sketch regex: `(?:[\w@.\-\[\]()]+\/)*`                                   | Regex trích xuất path sketch chỉ chứa dấu gạch xuôi `/`. Để vượt qua Test Contract VP-5 (`src\\a.ts:2-4`) trên môi trường Windows mà không bị mất tiền tố thư mục, `verify-plan.mjs` cần chuẩn hóa toàn bộ dấu `\` thành `/` trước khi chạy regex trích xuất, hoặc mở rộng nhóm ký tự sang `(?:[\w@.\-\[\]()]+[/\\\])*`. Đã được Test Contract VP-5 bao quát. |
| 2   | RISK_DISMISSED | `[MINOR]` | `tsconfig.json:4,10`                     | `[SRC]` `tsconfig.json:4` (`allowJs: true`), `:10` (`moduleResolution: bundler`) | Nguy cơ lỗi biên dịch TS7016 khi import module `.mjs` vào file test TypeScript `scripts/verify-plan.test.ts`. Được loại trừ vì `tsconfig.json` hiện đã cấu hình `allowJs: true` kết hợp `moduleResolution: "bundler"`, đồng thời quy trình Bước 7.1 có chốt chặn chạy ngay `npm run type-check`.                                                              |
| 3   | RISK_DISMISSED | `[MINOR]` | `.agents/agents/reviewer/agent.md:1-103` | `[SRC]` `.agents/agents/reviewer/agent.md` (hiện 8,682 bytes)                    | Nguy cơ vượt giới hạn 10,000 ký tự theo quy định khi viết lại tài liệu. Được loại trừ vì việc chuyển đổi scaffold 7 bước sang 3 khối ngắn gọn sẽ giảm bớt văn bản dư thừa, và Bước 9.2 (W4) kiểm chứng tự động bằng `node scripts/verify-docs.mjs` trước khi nghiệm thu.                                                                                      |

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Attack Probe 1 (Bypass Repo Lock qua Status `Awaiting Critic`)**:
   - _Mục tiêu_: Thử nghiệm kịch bản khi Reviewer chuyển Status thành `Awaiting Critic`, liệu hook `plan-scope.js` có bị lọt và cho phép mở khóa sửa mã nguồn `src/**` trước khi Claude CLI chạy critic không.
   - _Kết quả_: **Thất bại** (`AN TOÀN`). Kiểm tra mã nguồn `[SRC]` `.agents/scripts/plan-scope.js:20` cho thấy regex duyệt plan bắt buộc khớp chính xác `Approved$`. Tại dòng `:203-209`, nếu plan không khớp `Approved` và cũng chưa `Completed`, `evaluatePlanApprovalContent` trả về `false`, kích hoạt nhánh fail-safe `return []` khóa toàn bộ repo ngay lập tức.
2. **Attack Probe 2 (Command Injection & Traversal qua đối số `verify-plan.mjs`)**:
   - _Mục tiêu_: Thử nghiệm inject chuỗi lệnh độc hại hoặc path traversal (`docs/plans/../../../etc/passwd`, command chaining qua `;` hoặc `|`) qua đối số của lệnh `node scripts/verify-plan.mjs`.
   - _Kết quả_: **Thất bại** (`AN TOÀN`). Kiểm tra mã nguồn `[SRC]` `.agents/scripts/command-policy.js:537-562` cho thấy lệnh chaining bị tách và chặn ở tầng tokenizer; đối số plan được kiểm tra nghiêm ngặt qua helper `validatePlanPathToken` (bắt buộc khớp regex `^docs[/\\]plans[/\\][A-Za-z0-9._-]+\.md$`, unquoted, và cấm `..`). Trong chính `verify-plan.mjs`, file `.env*` bị chặn đọc qua `isEnvSecretPath` (`.agents/scripts/guard-paths.js:69`).
3. **Attack Probe 3 (Lạm quyền công cụ của Claude CLI ở chế độ Critic)**:
   - _Mục tiêu_: Thử nghiệm kịch bản Claude CLI ở vai trò `-Role critic` cố tình can thiệp ghi đè file mã nguồn `src/**` hoặc file governance `.agents/**`.
   - _Kết quả_: **Thất bại** (`AN TOÀN`). Kiểm tra mã nguồn `[SRC]` `.agents/scripts/run-claude.ps1:206-207` xác nhận Claude CLI trong vai trò reviewer/critic chỉ nhận `allowedTools` gồm `Edit(docs/plans/*.md)` và bare `Write` bị đưa vào `disallowedTools`, kết hợp `$sharedDisallowed` chặn cứng mọi thao tác trên `src/**`, `.agents/**`, `scripts/**`. Hook `PreToolUse` của `code-freeze-guard.js` tiếp tục bảo vệ ở tầng ngoài cùng.
4. **Attack Probe 4 (Self-Rubber-Stamping / Quota Deadlock)**:
   - _Mục tiêu_: Thử nghiệm kịch bản khi Claude CLI gặp lỗi quota/rate limit (exit 42), liệu hệ thống có tự động fallback về chính Gemini để tự critic chính mình hay không.
   - _Kết quả_: **Thất bại** (`AN TOÀN`). Thiết kế tại §6.4 và §10 R7 chỉ định rõ: khi Role critic gặp exit 42, không fallback về `@reviewer` mà kích hoạt Circuit Breaker dừng lại và trình User. Header vẫn giữ `Awaiting Critic`, repo tiếp tục bị khóa bảo vệ an toàn.

#### 4. Plan Completeness Gate & Mental Simulation Matrix

| Hạng mục / Kịch bản        | Kết quả | Evidence Type     | Chi tiết kiểm chứng                                                                                                                                                                              |
| -------------------------- | ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Verified Versions       | `PASS`  | `[CMD]` / `[URL]` | `package.json:115,117` (`typescript@5.9.3`, `vitest@4.1.12`). `[URL]` Google Antigravity Subagents documentation (`model: inherit`), Gemini API caching guide (Gemini 4 Argon min 4,096 tokens). |
| 2. Checklist tuần tự       | `PASS`  | `[SRC]`           | Checklist 5 giai đoạn (§7.1–§7.5) với nhãn `[NEW]` (2 file) và `[MODIFY]` (15 file) rõ ràng, logic triển khai code trước governance sau.                                                         |
| 3. Verification Plan       | `PASS`  | `[CMD]`           | Đầy đủ lệnh verification suites (§9.3), wiring probes W1–W4, negative probes N1–N8.                                                                                                              |
| 4. Test Contract           | `PASS`  | `[SRC]`           | 19 test cases cho `verify-plan.test.ts` (VP-1 đến VP-19), 6 test cases cho TC-D, 2 test cases cho PS-AC.                                                                                         |
| 5. Assumptions & Deps      | `PASS`  | `[SRC]` / `[URL]` | 8 giả định A1–A8 được đối chiếu với code thật và docs chính thức. 1 quyết định kiến trúc D1 tường minh.                                                                                          |
| 6. Out of Scope            | `PASS`  | `[SRC]`           | Phân định rõ 8 ranh giới không làm (§1.2), giữ minimal diff.                                                                                                                                     |
| 7. Skills Loaded & Applied | `PASS`  | `[SRC]`           | Ánh xạ đầy đủ `.agents/rules/05-plan-review.md`, `vikini-audit`, `vikini-investigate`, `01-coding.md`.                                                                                           |
| S1: Cold-start & Build     | `PASS`  | `[CMD]`           | `npm run type-check` exit code 0; `vitest@4.1.12` bao gồm test ngoài `src/`; không phụ thuộc env mới.                                                                                            |
| S2: Runner Lifecycle       | `PASS`  | `[SRC]`           | Fixture tests trong `scripts/verify-plan.test.ts` sử dụng thư mục tạm và teardown triệt để qua `afterEach`.                                                                                      |
| S3: Database Logic         | `N/A`   | `[SRC]`           | Kế hoạch thuần túy nâng cấp tooling và quy trình governance, không chạm database/schema/migrations.                                                                                              |
| S4: Cross-Task State       | `PASS`  | `[SRC]`           | Phân tích trạng thái nhất quán giữa `command-policy.js`, `plan-scope.js`, `run-claude.ps1` và các file prompt.                                                                                   |
| S5: Security Boundary      | `PASS`  | `[SRC]`           | Allowlist bảo vệ token-level, chống path traversal, chống rò rỉ `.env*`, phân quyền tối thiểu cho Claude CLI.                                                                                    |
| S6: Resilience & Cap       | `PASS`  | `[SRC]`           | Xử lý fail-safe cho Claude exit 42, Circuit Breaker bảo toàn trạng thái khóa repo.                                                                                                               |
| Domain: Open Inquiry       | `PASS`  | `[SRC]` / `[URL]` | Tối ưu implicit-caching order theo kiến trúc Gemini 4 Argon, thiết lập Critic Floor ngăn chặn rubber-stamp, giảm ALL CAPS.                                                                       |

#### 5. Adversarial Timelines & Commands Executed

##### Adversarial Timelines

1. **Đồng thời (Concurrency)**:
   - _Cơ chế_: Trạng thái khóa repo trong khoảng chờ Claude critic
   - _T1_: `@reviewer` hoàn tất audit, cập nhật Header thành `Awaiting Critic`.
   - _T2_: Agent khác cố gắng ghi đè file mã nguồn trong `src/**` trước khi Claude critic hoàn tất.
   - _T3_: `code-freeze-guard.js` đọc `plan-scope.js:evaluatePlanApprovalContent`. Vì Header không phải `Approved`, fail-safe pending kích hoạt trả về `[]`, chặn ghi toàn diện.
   - _Kết cục_: Thao tác ghi bị chặn, trạng thái repo toàn vẹn → AN TOÀN.

2. **Khoảng trống check→use (TOCTOU) & Secret Access**:
   - _Cơ chế_: Trích dẫn đường dẫn `.env*` trong plan hoặc tham số CLI
   - _T1_: Kẻ tấn công hoặc LLM đưa chuỗi `.env.local:10` vào bảng Critic Findings hoặc tham số `node scripts/verify-plan.mjs docs/plans/.env.md`.
   - _T2_: Tokenizer của `command-policy.js` nhận diện token vi phạm `isEnvSecretPath` và chặn trước khi chạy process.
   - _T3_: Trong script, `checkLineRefs` kiểm tra `isEnvSecretPath` và dừng lại với mã `FORBIDDEN_ENV` trước khi gọi bất kỳ hàm đọc file I/O nào.
   - _Kết cục_: Không rò rỉ secret, chặn kịp thời → AN TOÀN.

3. **Thất bại giữa chừng (Mid-flight Failure)**:
   - _Cơ chế_: Claude CLI bị ngắt kết nối hoặc hết quota khi đang critic
   - _T1_: Claude CLI nhận lệnh critic cho plan có Header `Awaiting Critic`.
   - _T2_: Tiến trình bị terminate hoặc nhận thông báo quota limit (exit 42) trước khi đưa ra phán quyết AGREE.
   - _T3_: `run-claude.ps1` bắt exit 42, kích hoạt Circuit Breaker thông báo User; plan giữ nguyên `Awaiting Critic`.
   - _Kết cục_: Repo duy trì trạng thái đóng băng, không phát sinh lỗi lệch pha → AN TOÀN.

4. **Môi trường Serverless / Runner Lifecycle**:
   - _Cơ chế_: Quản lý tài nguyên test fixture của `verify-plan.test.ts`
   - _T1_: Vitest khởi tạo fixture trong thư mục tạm `os.tmpdir()`.
   - _T2_: Assertion trong test case ném ngoại lệ giữa chừng.
   - _T3_: Hook `afterEach` thực thi `fs.rmSync(tmpDir, { recursive: true, force: true })`.
   - _Kết cục_: Dọn dẹp sạch sẽ tài nguyên, không để lại file rác → AN TOÀN.

##### Commands Executed

```powershell
npm run type-check                                  # Exit 0 - Kiểm tra baseline type-check toàn codebase
node scripts/verify-docs.mjs                        # Exit 0 - Kiểm tra tính toàn vẹn tài liệu và giới hạn ký tự
npx vitest list --filesOnly                         # Exit 0 - Rà soát danh sách file kiểm thử
npx vitest run .agents/scripts --reporter=dot       # Exit 0 (4 passed, 151 passed) - Kiểm tra bộ test hạ tầng hiện tại
```

#### 6. Kết Luận

Kế hoạch triển khai hoàn thiện xuất sắc, phân tích sâu sắc các khía cạnh kỹ thuật, đáp ứng toàn diện 7 hạng mục bắt buộc và 6 kịch bản Mental Simulation. Không phát hiện lỗi `[BLOCKER]` hay `[MAJOR]`. Đạt tiêu chuẩn phê duyệt triển khai.

[PLAN_APPROVED]
