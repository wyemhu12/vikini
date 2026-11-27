# Kế Hoạch Triển Khai: Nâng Ngân Sách Ký Tự & Trần UTF-8 Bytes Cho Quy Tắc Governance Vikini

- **Revision**: 2
- **Status**: Completed
- **Date**: 2026-11-27
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục Tiêu (Goal)

Nâng có kiểm soát ngân sách ký tự cho hệ thống quy tắc Governance của **Vikini** (thay đổi đặc tả **Loại C** theo `.agents/rules/02-quality.md:61`) và bổ sung chốt chặn trần byte UTF-8 khớp đặc tả thực tế của Google Antigravity 2026:

1. **Nâng tổng ngân sách `always_on` lên ngưỡng thống nhất `<= 28,000` ký tự** (thay cho hai ngưỡng cũ lệch nhau `< 18,000` tại `.agents/rules/02-quality.md:74`, `.agents/README.md:61`, `.agents/scripts/code-freeze-guard.test.ts:1531` và `<= 17,000` tại `.agents/scripts/code-freeze-guard.test.ts:1919,2069-2070`):
   - Căn cứ vào đặc tả Google Antigravity (`C:\Users\wyemh\.gemini\antigravity\builtin\skills\agy-customizations\docs\rules.md`, mục _Size Limits and Context Budget_, dòng 34–40): nhóm quy tắc `always_on` và global rules có riêng ngân sách `20,000` tokens (`defaultRulesBudget`), độc lập với ngân sách skills, workflows, subagents và MCP tools.
   - Văn bản kỹ thuật tiếng Việt UTF-8 kết hợp Markdown đạt mật độ khoảng `2.0–2.6` ký tự/token, nên `28,000` ký tự tương đương `~10,800–14,000` tokens (**54%–70%** của `20,000` tokens), giữ khoảng dư **30%–46%** cho global rules và biến thiên tokenizer để Antigravity không giáng cấp rule `always_on` xuống dạng con trỏ tệp.
   - Trần `28,000` ký tự vẫn thấp hơn nhiều so với tổng 7 tệp rule (`~46,844` ký tự), nên cơ chế **Progressive Disclosure** (`trigger: glob` và `trigger: model_decision`) tiếp tục bắt buộc về mặt toán học.
2. **Nâng trần từng tệp rule từ `<= 12,000` lên `<= 16,000` ký tự VÀ cưỡng chế trần cứng `<= 24,000` UTF-8 bytes**:
   - Căn cứ vào trần cắt ngắn theo dòng `24 KB` / `24,000` bytes mỗi tệp rule của Antigravity (`rules.md`, mục _Size Limits and Context Budget_, dòng 31–33).
   - Ký tự tiếng Việt có dấu chiếm 2–3 UTF-8 bytes (`Buffer.byteLength(content, "utf8")`), nên một tệp `<= 16,000` ký tự vẫn có thể vượt `24,000` bytes nếu không kiểm tra song song cả ký tự lẫn byte UTF-8.
   - Cưỡng chế đồng thời cả hai chốt chặn (`<= 16,000` ký tự, `<= 24,000` UTF-8 bytes, và tổng `always_on <= 28,000` ký tự) trong `scripts/verify-docs.mjs` và `.agents/scripts/code-freeze-guard.test.ts`, kèm bộ co-located test mới `scripts/verify-docs.test.ts`.
3. **Đồng bộ mọi tài liệu Governance hiện hành & giữ nguyên trần Subagents**:
   - Giữ nguyên giới hạn `.agents/agents/*/agent.md <= 10,000` ký tự (`.agents/rules/02-quality.md:75`, `scripts/verify-docs.mjs:224`, `.agents/scripts/code-freeze-guard.test.ts:1536`) và `.agents/agents/reviewer/agent.md < 7,500` ký tự (`.agents/scripts/code-freeze-guard.test.ts:1540`).
   - Đồng bộ toàn bộ tham chiếu cũ `12,000` / `17,000` / `18,000` trên các tệp hoạt động gồm `.agents/rules/02-quality.md:74`, `.agents/README.md:61`, `.agents/agents/reviewer/agent.md:45`, `scripts/verify-docs.mjs:211-236`, và `.agents/scripts/code-freeze-guard.test.ts`.

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** chỉnh sửa các bản kế hoạch lịch sử trong `docs/plans/*.md` (kể cả hàng lịch sử cũ trong bảng của `docs/plans/README.md`), các mục lịch sử cũ trong `docs/CHANGELOG.md`, `docs/lessons-learned.md` (dòng `782-799`), hay `docs/archive/` (bảo toàn Untouchables theo `.agents/rules/06-writing-style.md:37`).
- **KHÔNG** thay đổi nội dung quy tắc trong `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md`, `.agents/rules/05-plan-review.md`, `.agents/rules/06-writing-style.md`, hay các `SKILL.md` (đã khảo sát xác nhận không chứa giá trị ngân sách cũ).
- **KHÔNG** thay đổi trần `.agents/agents/*/agent.md <= 10,000` ký tự hoặc `.agents/agents/reviewer/agent.md < 7,500` ký tự.
- **KHÔNG** sửa `.agents/scripts/code-freeze-guard.js`, `.agents/scripts/command-policy.js`, `.agents/scripts/plan-scope.js`, hoặc `scripts/verify-plan.mjs`.
- **KHÔNG** cắt gọn/lưu trữ `docs/CHANGELOG.md` sang `docs/archive/` (nợ kỹ thuật kích thước `>= 35,000` bytes tại `scripts/verify-docs.mjs:272-274` nằm ngoài phạm vi task này).
- **KHÔNG** cài thêm dependency npm và **KHÔNG** chạy lệnh git biến đổi (`git add`, `git commit`, `git push`, ... theo `.agents/rules/00-core.md:62`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Tài Liệu & Mã Nguồn Đã Khảo Sát Trực Tiếp

- Governance rules: `.agents/rules/00-core.md:1-74`, `.agents/rules/01-coding.md:1-143`, `.agents/rules/02-quality.md:1-86`, `.agents/rules/03-ui.md:1-128`, `.agents/rules/04-bilingual.md:1-95`, `.agents/rules/05-plan-review.md:1-61`, `.agents/rules/06-writing-style.md:1-48`.
- Agents & Reviewer docs: `.agents/README.md:1-119`, `.agents/agents/planner/agent.md:1-100`, `.agents/agents/reviewer/agent.md:1-116`, `.agents/agents/reviewer/evidence-bar.md:1-61`, `.agents/agents/reviewer/allowlist.md:1-36`, `.agents/agents/reviewer/mental-simulation.md:1-70`, `.agents/agents/qa/agent.md:1-166`.
- Skills: `.agents/skills/vikini-investigate/SKILL.md:1-120`, `.agents/skills/vikini-audit/SKILL.md:1-56`, `.agents/skills/vikini-debug/SKILL.md:1-93`, `.agents/skills/vikini-simplify/SKILL.md:1-71`, `.agents/skills/README.md:1-58`, cùng 6 domain skills (`add-feature`, `add-model`, `add-translation`, `api-patterns`, `streaming-patterns`, `database-migration`).
- Scripts & tests: `scripts/verify-docs.mjs:1-308`, `scripts/verify-plan.mjs:1-414`, `scripts/verify-plan.test.ts:1-305`, `.agents/scripts/code-freeze-guard.js:1-800`, `.agents/scripts/code-freeze-guard.test.ts:1-2211`, `.agents/scripts/command-policy.js:1-474`, `.agents/scripts/plan-scope.js:1-276`, `.agents/scripts/guard-paths.js:1-93`.
- Config & active docs: `package.json:1-140`, `.prettierrc:1-10`, `tsconfig.json:1-36`, `eslint.config.mjs:1-167`, `vitest.config.ts:1-31`, `docs/architecture.md:1-341`, `docs/README.md:1-28`, `docs/overview.md:1-78`, `docs/security.md:1-150`, `docs/CHANGELOG.md:1-120`, `docs/lessons-learned.md:782-844`, `docs/plans/README.md`.
- Đặc tả Antigravity nội bộ: `C:\Users\wyemh\.gemini\antigravity\builtin\skills\agy-customizations\docs\rules.md` (mục _Size Limits and Context Budget_).

#### Skills Loaded & Applied

| Skill / Rule Đã Đọc (`read_file`)                   | Miền Áp Dụng                                          | Quyết Định Kỹ Thuật Chịu Ảnh Hưởng Trực Tiếp                                                                                                                                                                                           |
| :-------------------------------------------------- | :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/02-quality.md:55-76`                 | Test Failure Triage (Loại C) & Governance Char Limits | Phân loại chính thức các cập nhật assertion ngân sách trong `.agents/scripts/code-freeze-guard.test.ts` là **Loại C (Approved Spec Change)**; giữ nguyên không dùng bảng Markdown trong `02-quality.md`; dùng `;` trên PowerShell 5.1. |
| `.agents/rules/05-plan-review.md:15,37-39,50-56`    | Code Freeze, Plan Scope Guard & Independent Critic    | Khai báo đủ tệp chạm `.agents/**` kích hoạt `CRITIC_REQUIRED yes` (`scripts/verify-plan.mjs:209`); tuyệt đối không ghi sẵn `Status: Approved` hoặc `[PLAN_APPROVED]`; ghi rõ tệp nào trả `ask` vs `allow` sau khi duyệt.               |
| `.agents/rules/06-writing-style.md:15-48`           | STE-Lite Technical Writing Style                      | Tách rõ bước thủ tục mở đầu bằng 1 động từ mệnh lệnh ở Mục 7 và văn xuôi chủ động có chủ thể cụ thể; giữ nguyên Untouchables (`docs/CHANGELOG.md` cũ, `docs/lessons-learned.md`, historical plans); không dùng từ đệm sáo rỗng.        |
| `.agents/skills/vikini-investigate/SKILL.md:78-111` | Blast-Radius Analysis trên Governance & Scripts       | Quét toàn bộ 25+ tệp hoạt động trong `.agents/`, `scripts/`, và `docs/`; phát hiện thêm tham chiếu cũ `rules <= 12,000` tại `.agents/agents/reviewer/agent.md:45` và xác nhận `docs/architecture.md` không chứa tham chiếu cũ.         |
| `.agents/skills/vikini-audit/SKILL.md:14-56`        | Code Quality & Modularity Audit                       | Thiết kế `scripts/verify-docs.mjs` xuất hàm thuần có JSDoc `@ts-check`, giữ kích thước `~340` dòng (`<= 400`), 0 `any` và 0 `console.log` trong `scripts/verify-docs.test.ts`, kiểm `npx prettier --check` trước `npm run verify`.     |

---

### 3. Assumptions & Cross-Task Dependencies

#### Giả Định Đã Xác Minh (Verified Assumptions)

1. **A1 — Kết quả quét toàn codebase cho tham chiếu `12,000` / `17,000` / `18,000` (`[SRC]`)**:
   - Đã rà soát toàn bộ 7 tệp `.agents/rules/*.md`, 3 tệp `.agents/agents/*/agent.md`, 3 tài liệu vệ tinh của `@reviewer`, 10 `SKILL.md` + `.agents/skills/README.md`, `.agents/README.md`, `scripts/verify-docs.mjs`, `.agents/scripts/*`, và các tài liệu hoạt động trong `docs/` (`README.md`, `architecture.md`, `overview.md`, `security.md`).
   - Toàn bộ tham chiếu ngân sách cũ đang hoạt động tập trung tại đúng **5 tệp nguồn/tài liệu**:
     1. `.agents/rules/02-quality.md:74` (`<= 12,000`, `always_on < 18,000`).
     2. `.agents/README.md:61` (`<= 12,000`, `< 18,000`).
     3. `.agents/agents/reviewer/agent.md:45` (`rules <= 12,000`) — phát hiện quan trọng giúp đồng bộ Fail Criterion #6 của `@reviewer`.
     4. `scripts/verify-docs.mjs:211-212,236` (`len > 12000`, `limit 12,000`, `<= 12,000`).
     5. `.agents/scripts/code-freeze-guard.test.ts:1525,1531,1589,1919,1923-1926,2056,2069-2071,2171-2172` (`12000`, `"12,000"`, `17000`, `18000`).
   - `docs/architecture.md:1-341` không chứa tham chiếu `12,000`, `17,000` hay `18,000`, nên không cần chỉnh sửa.
2. **A2 — Số học ký tự & UTF-8 bytes thực tế trên `.agents/rules/*.md` và `.agents/agents/reviewer/agent.md` (`[SRC]`)**:
   - Sửa `.agents/rules/02-quality.md:74` chỉ thêm đúng **`+27` ký tự** (cả LF lẫn CRLF, `+0` dòng, không chèn bảng Markdown nên bảo toàn `expect(r02).not.toContain("| :---")` tại `.agents/scripts/code-freeze-guard.test.ts:1928`).
   - Tổng 3 tệp `always_on` (`00-core.md` + `02-quality.md` + `05-plan-review.md`) tăng từ `~16,751` (LF) / `~16,972` (CRLF) lên `~16,778` (LF) / `~16,999` (CRLF), thấp hơn `<= 28,000` hơn `11,000` ký tự; tổng toàn bộ 7 tệp rule khi giả lập bật hết `always_on` đạt `~46,844 > 28,000`, bảo đảm Negative Probe cô lập Progressive Disclosure vẫn hoạt động.
   - Sửa `.agents/agents/reviewer/agent.md:45` chỉ thêm chính xác **`+43` ký tự** (`~6,400–6,500` ký tự tổng), giữ biên an toàn `~850–1,000` ký tự dưới trần `< 7,500` (`.agents/scripts/code-freeze-guard.test.ts:1540`) và giữ nguyên không có bảng Markdown thừa cho `lint-staged` Prettier (`.prettierrc:1-10`, `docs/lessons-learned.md:838-844`).
3. **A3 — Mô hình kiểm thử co-located cho `scripts/*.mjs`, biên dịch chặt `// @ts-check`, và hiện trạng `docs/CHANGELOG.md` (`[SRC]`)**:
   - `tsconfig.json:4,6,10,26-34` bật `allowJs: true`, `strict: true` (`noImplicitAny: true`, `strictNullChecks: true`), và `moduleResolution: "bundler"`. Hiện `scripts/verify-docs.mjs:1` bật `// @ts-check` nhưng chưa nằm trong đồ thị `tsc --noEmit` vì chưa có tệp `.ts` nào import nó; ngay khi `scripts/verify-docs.test.ts` import `./verify-docs.mjs` (giống mẫu `scripts/verify-plan.test.ts:14`), TypeScript sẽ kiểm tra chặt toàn bộ tệp `.mjs`.
   - Do đó bắt buộc bổ sung `import { fileURLToPath } from "node:url";` cho `isMainModule()` và chú thích JSDoc `@param`/`@returns`/`@type` đầy đủ (tương tự `scripts/verify-plan.mjs:73,100-103,355`) cho toàn bộ vị trí chưa khai báo kiểu trong mã cũ của `scripts/verify-docs.mjs`: `walk(dir, repoRoot)` + `results` (`:13-14,25`), `brokenLinks` (`:51`), `match` (`:60`), `resolved` (`:80`), `legacyMatches` (`:121`), `shorthandMatches` (`:171`), `limitErrors` (`:205`), `expectedHeadings` (`/** @type {number | null} */` tại `:245,254`), và các hàm tách mới (`extractYamlFrontmatter`, `isAlwaysOnRule`, `checkGovernanceLimits`, `isMainModule`, `runCli`).
   - `scripts/verify-docs.mjs:18-23` có bộ lọc `.claude/worktrees` bị khóa bởi `.agents/scripts/code-freeze-guard.test.ts:1639-1649`; việc tách `checkGovernanceLimits()` và bọc `runCli()` bằng `isMainModule()` giữ nguyên 100% chuỗi và logic `.claude/worktrees`.
   - Nợ kỹ thuật có sẵn: `docs/CHANGELOG.md` hiện vượt `35,000` bytes (`scripts/verify-docs.mjs:272-274`), nên khi chạy `node scripts/verify-docs.mjs --strict-shorthand` trên repo gốc, các mục `[1/5]`–`[4/5]` sẽ báo `PASS` còn `[5/5]` sẽ báo lỗi dung lượng CHANGELOG có sẵn; `scripts/verify-docs.test.ts` chứng minh cả mã thoát `0` và `1` của CLI trong thư mục `tmpRoot` cô lập.
4. **A4 — Quyền ghi dưới `code-freeze-guard.js` khi triển khai (`[SRC]`)**:
   - Sau khi nhận `[PLAN_APPROVED]`: `docs/plans/README.md` và `docs/CHANGELOG.md` đi qua Gate 3 (`allow`, `.agents/scripts/code-freeze-guard.js:455-477`); `scripts/verify-docs.mjs` đi qua Gate 9 Plan Scope Guard (`allow`, `.agents/scripts/code-freeze-guard.js:570-573`); 3 tệp trong `.agents/**` dừng ở Gate 7 (`ask`, `.agents/scripts/code-freeze-guard.js:543-551`); `.agents/scripts/code-freeze-guard.test.ts` và `scripts/verify-docs.test.ts` dừng ở Gate 4 Test Integrity Guard (`ask`, `.agents/scripts/code-freeze-guard.js:502-518`) để PM xác nhận thay đổi Loại C.

#### Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies)

- **Independent Critic Pass (`CRITIC_REQUIRED yes`)**: Vì danh sách Mục 5 chạm 4 tệp dưới `.agents/**`, `scripts/verify-plan.mjs:206-242` xuất `CRITIC_REQUIRED yes`. Sau khi Primary `@reviewer` hoàn tất Audit Run và đặt `- **Status**: Awaiting Critic` + `[AWAITING_CRITIC]`, Orchestrator bắt buộc khởi chạy một phiên `@reviewer` độc lập mới hoàn toàn (zero shared history) ở Independent Critic Mode (`.agents/rules/05-plan-review.md:37-39`, `.agents/agents/reviewer/agent.md:70-76`) để cấp `[PLAN_APPROVED]`.
- **Thứ tự sửa đổi đồng bộ**: Cập nhật `.agents/rules/02-quality.md`, `.agents/README.md`, `.agents/agents/reviewer/agent.md`, và `scripts/verify-docs.mjs` **trước** khi cập nhật `.agents/scripts/code-freeze-guard.test.ts` và tạo `scripts/verify-docs.test.ts`, rồi chạy `npx prettier --check` trước `npm run verify` để `lint-staged` không làm lệch số ký tự khi commit.

---

### 4. Bảng Verified Versions

| Thành phần / Tiêu chuẩn                | Phiên bản / Phát hành (`[SRC]` / `[URL]`)                             | Xác minh 2026 & Nguồn đối chiếu                                                                                                                                                                                                                           | Vai trò trong kế hoạch                                                                                                    |
| :------------------------------------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Google Antigravity Workspace Rules** | Spec 2026 (`24,000` bytes/file; `20,000` tokens `defaultRulesBudget`) | Xác minh trực tiếp tại `C:\Users\wyemh\.gemini\antigravity\builtin\skills\agy-customizations\docs\rules.md` (mục _Size Limits and Context Budget_) và tài liệu chính thức [Antigravity Rules Docs](https://antigravity.google/docs/rules) `[URL]`         | Căn cứ định lượng cho trần `<= 16,000` ký tự, `<= 24,000` UTF-8 bytes mỗi tệp rule và `<= 28,000` ký tự tổng `always_on`. |
| **Node.js & `Buffer.byteLength`**      | `24.x` (`package.json:121`)                                           | `Buffer.byteLength(string, "utf8")` trả về số nguyên byte UTF-8 chính xác cho chuỗi đa byte (khác UTF-16 `.length`), xác minh tại [Node.js Buffer Docs](https://nodejs.org/api/buffer.html#static-method-bufferbytelengthstring-encoding) `[URL]` `[SRC]` | Cưỡng chế trần `<= 24,000` UTF-8 bytes trong `scripts/verify-docs.mjs` và bộ test Vitest.                                 |
| **Vitest**                             | `4.1.12` (`package.json:118`, `vitest.config.ts:1-31`)                | Chạy `npm run test:run` (`package.json:20`) với `happy-dom` và hỗ trợ import `.mjs` trực tiếp như `scripts/verify-plan.test.ts:14` `[SRC]`                                                                                                                | Thực thi `.agents/scripts/code-freeze-guard.test.ts` và `scripts/verify-docs.test.ts`.                                    |
| **TypeScript**                         | `5.9.3` (`package.json:116`, `tsconfig.json:4-11`)                    | `strict: true`, `allowJs: true`, `noEmit: true` (`npm run type-check` tại `package.json:17`) `[SRC]`                                                                                                                                                      | Kiểm tra kiểu tĩnh cho `scripts/verify-docs.test.ts` và `.agents/scripts/code-freeze-guard.test.ts`.                      |
| **ESLint**                             | `9.39.2` (`package.json:102`, `eslint.config.mjs:1-167`)              | Áp dụng `js.configs.recommended` cho `.mjs` và bộ quy tắc TypeScript strict (`no-explicit-any`, `no-console`) cho `**/*.{js,jsx,ts,tsx}` `[SRC]`                                                                                                          | Bảo đảm 0 lỗi lint và 0 cảnh báo trên các tệp script/test sửa đổi và tạo mới.                                             |
| **Prettier**                           | `3.7.4` (`package.json:112`, `.prettierrc:1-10`)                      | `printWidth: 100`, `endOfLine: "lf"`, chạy qua `lint-staged` trên `*.md` (`package.json:136-138`) `[SRC]`                                                                                                                                                 | Kiểm định `npx prettier --check` trước khi đo ký tự và chạy test Governance.                                              |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### Tạo mới

- [NEW] `scripts/verify-docs.test.ts` — Bộ co-located unit test (`VD-01`..`VD-06`) kiểm chứng hàm `checkGovernanceLimits()` và CLI `scripts/verify-docs.mjs` cho giới hạn `16,000` ký tự, `24,000` UTF-8 bytes (Negative Probe tiếng Việt đa byte), `28,000` tổng `always_on`, `10,000` agents, và cô lập side-effect khi import.

#### Chỉnh sửa

- [MODIFY] `.agents/rules/02-quality.md` — Cập nhật dòng `74` trong `## Governance Character Limits` sang `<= 16,000` ký tự & `<= 24,000` UTF-8 bytes (tổng `always_on <= 28,000`); giữ nguyên dòng `75` (`<= 10,000` cho agents) và không chèn bảng Markdown.
- [MODIFY] `.agents/README.md` — Cập nhật dòng `61` trong `## 2. Bản Đồ Quy Tắc Quản Trị (Rules Catalog)` sang `<= 16,000` ký tự, `<= 24,000` UTF-8 bytes mỗi tệp và `<= 28,000` ký tự tổng `always_on` (kèm tham chiếu `defaultRulesBudget` `20,000` tokens).
- [MODIFY] `.agents/agents/reviewer/agent.md` — Đồng bộ Fail Criterion #6 tại dòng `45` từ `rules <= 12,000` sang `rules <= 16,000` & `<= 24,000` bytes; `always_on <= 28,000`; giữ nguyên `agents <= 10,000` và tổng độ dài `< 7,500` ký tự.
- [MODIFY] `scripts/verify-docs.mjs` — Thêm `import { fileURLToPath } from "node:url"`, bổ sung chú thích JSDoc `@ts-check` chuẩn strict cho toàn bộ biến/hàm cũ và mới (`walk`, `results`, `brokenLinks`, `match`, `resolved`, `legacyMatches`, `shorthandMatches`, `expectedHeadings`, `extractYamlFrontmatter`, `isAlwaysOnRule`, `checkGovernanceLimits`, `isMainModule`, `runCli`), tách hằng số (`RULE_MAX_CHARS = 16000`, `RULE_MAX_BYTES = 24000`, `ALWAYS_ON_MAX_CHARS = 28000`, `AGENT_MAX_CHARS = 10000`), kiểm `trigger: always_on` giới hạn trong khối YAML frontmatter đầu tệp, xuất `checkGovernanceLimits(repoRoot)` & `isAlwaysOnRule(content)`, bọc luồng CLI vào `runCli()` sau chốt `isMainModule()`, và cập nhật thông điệp `[4/5]` trong khi bảo toàn `.claude/worktrees` cùng `[1/5]`..`[3/5]`, `[5/5]`.
- [MODIFY] `.agents/scripts/code-freeze-guard.test.ts` — Cập nhật **Loại C (Approved Spec Change)** cho `TC-08` (ngưỡng `16,000` chars / `24,000` UTF-8 bytes / `28,000` `always_on` + ma trận M5), `TC-H` (`realTotal <= 28000` và `overBudgetFixture` cộng `12000` vượt `28,000`), `TC-STE-01` (LF & CRLF `<= 28,000` + UTF-8 bytes `<= 24,000`), và `TC-STE-04` (nâng NP-1 lật toàn bộ rule non-`always_on` cho tổng `> 28,000`, thêm NP-4 UTF-8 multi-byte tiếng Việt và NP-5 chống tham chiếu cũ `12,000`/`17,000`/`18,000`).
- [MODIFY] `docs/plans/README.md` — Thêm 1 hàng mới ở đầu bảng `## Ma Trận Kế Hoạch Triển Khai` ghi nhận kế hoạch này (giữ nguyên toàn bộ các hàng lịch sử bên dưới).
- [MODIFY] `docs/CHANGELOG.md` — Thêm 1 mục phát hành mới ở đầu tệp tóm tắt việc nâng ngân sách Governance và bổ sung chốt chặn UTF-8 bytes theo chuẩn STE-lite (giữ nguyên toàn bộ lịch sử cũ).

---

### 6. Caller-First Design Sketch

#### 6.1. Giao Diện Xuất Của `scripts/verify-docs.mjs` (Caller & Test Call Site)

```javascript
// scripts/verify-docs.mjs — Strict // @ts-check imports, constants & pure checkers
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RULE_MAX_CHARS = 16000;
export const RULE_MAX_BYTES = 24000;
export const ALWAYS_ON_MAX_CHARS = 28000;
export const AGENT_MAX_CHARS = 10000;

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * @typedef {{ errors: string[], ruleCount: number, alwaysOnChars: number, agentCount: number }} GovernanceLimitReport
 * @typedef {{ file: string, text: string, target: string, resolved: string }} BrokenLinkEntry
 * @typedef {{ file: string, pattern: string }} LegacyMatchEntry
 * @typedef {{ file: string, line: number, content: string }} ShorthandMatchEntry
 */

/**
 * Extracts the leading YAML frontmatter block, or `""` when absent.
 *
 * @param {string} content
 * @returns {string}
 */
function extractYamlFrontmatter(content) {
  const match = FRONTMATTER_REGEX.exec(content);
  return match ? match[1] : "";
}

/**
 * Checks whether a rule file declares `trigger: always_on` strictly inside
 * its leading YAML frontmatter block (ignoring code examples in the body).
 *
 * @param {string} content
 * @returns {boolean}
 */
export function isAlwaysOnRule(content) {
  return /^trigger:\s*always_on\s*$/m.test(extractYamlFrontmatter(content));
}

/**
 * Checks `.agents/rules/*.md` (sorted; chars <= 16,000, UTF-8 bytes <= 24,000,
 * always_on total <= 28,000 via `isAlwaysOnRule`) and `.agents/agents/<name>/agent.md`
 * (sorted; <= 10,000 chars).
 *
 * @param {string} [repoRoot]
 * @returns {GovernanceLimitReport}
 */
export function checkGovernanceLimits(repoRoot = REPO_ROOT) {
  /* ... */
}
```

```javascript
// Strict // @ts-check JSDoc annotations required on legacy code inside runCli():
// - /** @param {string} dir @param {string} [repoRoot] @returns {string[]} */ function walk(dir, repoRoot = REPO_ROOT)
//   with /** @type {string[]} */ const results = [];
// - /** @type {BrokenLinkEntry[]} */ const brokenLinks = [];
// - /** @type {RegExpExecArray | null} */ let match;
// - /** @type {string} */ let resolved;
// - /** @type {LegacyMatchEntry[]} */ const legacyMatches = [];
// - /** @type {ShorthandMatchEntry[]} */ const shorthandMatches = [];
// - /** @type {number | null} */ let expectedHeadings = null; (and val = expectedHeadingsArg.slice("--expected-headings=".length))

/** @returns {boolean} */
function isMainModule() {
  if (typeof process.argv[1] !== "string" || !process.argv[1]) return false;
  const entry = path.resolve(process.argv[1]);
  const self = fileURLToPath(import.meta.url);
  return process.platform === "win32" ? entry.toLowerCase() === self.toLowerCase() : entry === self;
}

/**
 * @param {string} [repoRoot]
 * @param {string[]} [argv]
 * @returns {void}
 */
function runCli(repoRoot = REPO_ROOT, argv = process.argv) {
  /* ... */
}

if (isMainModule()) {
  runCli();
}
```

#### 6.2. Nội Dung Chính Xác Cập Nhật Trong 3 Tệp Governance Markdown

1. **`.agents/rules/02-quality.md:74`** (`+27` chars LF/CRLF, `+0` dòng, không bảng):

```markdown
- Rules (`.agents/rules/*.md`): `<= 16,000` ký tự & `<= 24,000` UTF-8 bytes (tổng `always_on <= 28,000`).
```

2. **`.agents/README.md:61`**:

```markdown
Mọi hoạt động trên codebase đều bị ràng buộc bởi 7 bộ quy tắc với giới hạn nghiêm ngặt **<= 16,000 ký tự** và **<= 24,000 UTF-8 bytes** mỗi tệp (3 tệp `always_on` `<= 28,000 ký tự` tổng cộng, tương đương ~54%–70% ngân sách `20,000` tokens `defaultRulesBudget` của Antigravity, kết hợp Progressive Disclosure qua `trigger: glob` và `trigger: model_decision`):
```

3. **`.agents/agents/reviewer/agent.md:45`** (`+43` chars, tổng `< 7,500`):

```markdown
6. Vượt giới hạn ký tự Governance (`rules <= 16,000` & `<= 24,000` bytes; `always_on <= 28,000`; `agents <= 10,000`) hoặc sai chuẩn song ngữ (`.agents/rules/04-bilingual.md`), vì vượt ngưỡng làm vỡ context budget.
```

#### 6.3. Call Site Kiểm Thử Co-Located (`scripts/verify-docs.test.ts` & `.agents/scripts/code-freeze-guard.test.ts`)

```typescript
// scripts/verify-docs.test.ts
import { pathToFileURL } from "node:url";
import {
  AGENT_MAX_CHARS,
  ALWAYS_ON_MAX_CHARS,
  RULE_MAX_BYTES,
  RULE_MAX_CHARS,
  checkGovernanceLimits,
  isAlwaysOnRule,
} from "./verify-docs.mjs";

// VD-01: exact boundaries (always_on 16,000 & 12,000 ASCII chars -> total 28,000;
//        glob "---\ntrigger: glob\n---\n" (22B) + "ệ".repeat(7992) (23,976B) + "aa" (2B) => 8,016 chars / 24,000B;
//        agent.md 10,000 chars) -> errors: []
// VD-02 (NP): 16,001 ASCII chars -> errors contains "has 16001 chars (limit 16,000)"
// VD-03 (NP): "---\ntrigger: glob\n---\n" (22B) + "ệ".repeat(7993) (23,979B) => 8,015 <= 16,000 chars, 24,001 > 24,000B
//        -> errors contains "has 24001 UTF-8 bytes (limit 24,000)"
// VD-04 (NP): two always_on rules of 14,001 chars -> "always_on rules total 28002 chars (limit 28,000)";
//        switching one to trigger: glob (even with a body snippet containing "trigger: always_on")
//        -> isAlwaysOnRule(globWithSnippet) === false && errors: []
// VD-05 (NP): agent.md 10,001 chars -> "limit 10,000"
// VD-06 (Wiring + Import Probe): spawnSync node scripts/verify-docs.mjs on compliant tmpRoot (exit 0)
//        vs over-byte tmpRoot (exit 1); dynamic import using pathToFileURL(SCRIPT_ABS).href with cwd: REPO_ROOT
//        exits 0 with stdout === "" and stderr === ""
```

```typescript
// .agents/scripts/code-freeze-guard.test.ts (Type C Approved Spec Change updates)
// 1. TC-08: per-rule content.length <= 16000 && Buffer.byteLength(content, "utf8") <= 24000;
//           alwaysOnTotal <= 28000; agents <= 10000; reviewer < 7500;
//           M5 asserts r02 contains "16,000", "24,000", "28,000", "10,000"
//           and reviewer/agent.md contains "16,000", "24,000", "28,000", "10,000"
// 2. TC-H:  realTotal <= 28000; overBudgetFixture uses r02 + "x".repeat(12000) > 28000;
//           r02 still forbids "| :---"
// 3. TC-STE-01: r06.length <= 16000 && Buffer.byteLength(r06, "utf8") <= 24000;
//           totalLf <= 28000 && totalCrlf <= 28000; always_on UTF-8 bytes <= 24000;
//           agentsReadme contains "16,000", "24,000", "28,000"
// 4. TC-STE-04:
//    - NP-1: flipping ALL non-always_on rules (trigger: glob | model_decision -> trigger: always_on)
//            yields syntheticAllAlwaysOnTotal > 28000
//    - NP-4: Vietnamese fixture "ệ".repeat(8001) passes length <= 16000 yet fails Buffer.byteLength > 24000
//    - NP-5: Active governance policy/validator files (02-quality.md, .agents/README.md,
//            reviewer/agent.md, scripts/verify-docs.mjs) contain zero matches for /\b(?:12,?000|17,?000|18,?000)\b/
```

---

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **Bước 1 — Cập nhật `.agents/rules/02-quality.md`**: Sửa dòng `74` theo §6.2 sang `<= 16,000` ký tự & `<= 24,000` UTF-8 bytes (tổng `always_on <= 28,000`), giữ nguyên dòng `75` (`<= 10,000`) và không chèn bảng Markdown.
- [ ] **Bước 2 — Cập nhật `.agents/README.md`**: Sửa dòng `61` theo §6.2 sang `<= 16,000` ký tự, `<= 24,000` UTF-8 bytes mỗi tệp và `<= 28,000` ký tự tổng `always_on` (kèm tham chiếu `20,000` tokens `defaultRulesBudget`), giữ nguyên chuỗi `"7 bộ quy tắc"`, `"./rules/06-writing-style.md"`, và `"**/docs/**/*.md"`.
- [ ] **Bước 3 — Cập nhật `.agents/agents/reviewer/agent.md`**: Sửa dòng `45` (Fail Criterion #6) theo §6.2 để đồng bộ trần `16,000` ký tự, `24,000` bytes và `always_on <= 28,000`, giữ tổng số ký tự `< 7,500`.
- [ ] **Bước 4 — Nâng cấp `scripts/verify-docs.mjs`**: Thêm `import { fileURLToPath } from "node:url"`; bổ sung chú thích JSDoc `@param`/`@returns`/`@type` chuẩn strict `// @ts-check` cho `walk` (`:13-14,25`), `brokenLinks` (`:51`), `match` (`:60`), `resolved` (`:80`), `legacyMatches` (`:121`), `shorthandMatches` (`:171`), `expectedHeadings` (`:245,254`) và các hàm tách mới; xuất `RULE_MAX_CHARS`, `RULE_MAX_BYTES`, `ALWAYS_ON_MAX_CHARS`, `AGENT_MAX_CHARS`, `isAlwaysOnRule(content)` (chỉ kiểm `trigger: always_on` trong khối YAML frontmatter đầu tệp), và `checkGovernanceLimits(repoRoot)`; bọc thân CLI vào `runCli()` sau chốt `isMainModule()`; giữ nguyên `.claude/worktrees` cùng `[1/5]`..`[3/5]`, `[5/5]`; cập nhật thông điệp `[4/5]`.
- [ ] **Bước 5 — Tạo bộ kiểm thử co-located `scripts/verify-docs.test.ts`**: Viết đủ 6 ca kiểm thử `VD-01`..`VD-06` theo §6.3 và §8, sử dụng thư mục tạm `fs.mkdtempSync` và dọn sạch trong `afterEach`.
- [ ] **Bước 6 — Cập nhật `.agents/scripts/code-freeze-guard.test.ts` (Loại C)**: Cập nhật `TC-08`, `TC-H`, `TC-STE-01`, và `TC-STE-04` theo §6.3 và §8 (tổng số lời gọi `expect()` tăng thêm, không xóa ca kiểm thử và không thêm `.skip`/`.only`).
- [ ] **Bước 7 — Cập nhật Living Docs**: Thêm hàng kế hoạch mới ở đầu bảng `## Ma Trận Kế Hoạch Triển Khai` trong `docs/plans/README.md` và thêm mục phát hành ngày `2026-11-27` ở đầu `docs/CHANGELOG.md` theo chuẩn STE-lite.
- [ ] **Bước 8 — Kiểm định Prettier & Verification Suite**: Chạy `npx prettier --check` trên tất cả tệp đã sửa/tạo mới (nếu lệch định dạng thì chạy `npx prettier --write` trước), sau đó chạy `npm run type-check; npm run lint; npm run test:run` và `node scripts/verify-docs.mjs --strict-shorthand`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Mã TC                            | Mô tả hành vi mong đợi                                                               | Đầu vào / Điều kiện biên                                                                                                                                                                                                                                                                                                         | Tiêu chí PASS / FAIL bắt buộc                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **VD-01**                        | Biên trên hợp lệ của `checkGovernanceLimits()`                                       | `tmpRoot` chứa 2 rule `always_on` dài đúng `16,000` và `12,000` ASCII chars (đã tính frontmatter `27` ký tự, tổng `always_on = 28,000`), 1 rule `glob` gồm `---\ntrigger: glob\n---\n` (`22`B) + `"ệ".repeat(7992)` (`23,976`B) + `"aa"` (`2`B) = `8,016` chars / đúng `24,000` UTF-8 bytes, và 1 `agent.md` đúng `10,000` chars | **PASS**: `errors` bằng `[]`, `ruleCount === 3`, `alwaysOnChars === 28000`, `agentCount === 1`. **FAIL** nếu phát sinh bất kỳ lỗi biên nào (off-by-one `>=` thay vì `>`).                                                                                                                                                                                           |
| **VD-02 (NP)**                   | Chặn rule vượt `16,000` ký tự                                                        | `tmpRoot` chứa `.agents/rules/over-chars.md` dài `16,001` ký tự ASCII (`16,001 <= 24,000` bytes)                                                                                                                                                                                                                                 | **PASS**: `errors` chứa `.agents/rules/over-chars.md has 16001 chars (limit 16,000)` và không chứa lỗi UTF-8 bytes. **FAIL** nếu trả `errors: []`.                                                                                                                                                                                                                  |
| **VD-03 (NP)**                   | Chặn rule tiếng Việt đa byte vượt `24,000` UTF-8 bytes dù `<= 16,000` ký tự          | `tmpRoot` chứa `.agents/rules/vi-bytes.md` gồm `---\ntrigger: glob\n---\n` (`22`B) + `"ệ".repeat(7993)` (`23,979`B) => `length === 8015 <= 16000`, `Buffer.byteLength === 24001 > 24000`                                                                                                                                         | **PASS**: `errors` chứa `.agents/rules/vi-bytes.md has 24001 UTF-8 bytes (limit 24,000)` và không báo lỗi `limit 16,000`. **FAIL** nếu bỏ lọt tệp vượt byte.                                                                                                                                                                                                        |
| **VD-04 (NP)**                   | Chặn tổng `always_on > 28,000` ký tự & xác minh cô lập frontmatter `glob`            | `tmpRoot` chứa 2 rule `trigger: always_on` mỗi tệp `14,001` ký tự (`<= 16,000` chars, `<= 24,000` bytes, tổng `28,002`); sau đó đổi 1 tệp sang `trigger: glob` kèm đoạn ví dụ `trigger: always_on` trong phần thân Markdown                                                                                                      | **PASS**: Trường hợp 1 trả lỗi `always_on rules total 28002 chars (limit 28,000)`; trường hợp 2 xác nhận `isAlwaysOnRule(globWithBodyExample) === false` và trả `errors: []`. **FAIL** nếu bỏ lọt tổng `always_on` hoặc nhận nhầm `trigger: always_on` ngoài frontmatter.                                                                                           |
| **VD-05 (NP)**                   | Bảo toàn trần `agent.md <= 10,000` ký tự                                             | `tmpRoot` chứa `.agents/agents/sample/agent.md` dài `10,001` ký tự                                                                                                                                                                                                                                                               | **PASS**: `errors` chứa `.agents/agents/sample/agent.md has 10001 chars (limit 10,000)`. **FAIL** nếu nới lỏng giới hạn agent.                                                                                                                                                                                                                                      |
| **VD-06 (WP)**                   | CLI exit code & import sạch side-effect của `scripts/verify-docs.mjs`                | (a) `spawnSync` chạy `node scripts/verify-docs.mjs` trên `tmpRoot` hợp lệ; (b) `spawnSync` trên `tmpRoot` chứa `vi-bytes.md` `24,001` bytes; (c) `spawnSync(process.execPath, ["--input-type=module", "-e", \`await import(${JSON.stringify(pathToFileURL(SCRIPT_ABS).href)})\`], { cwd: REPO_ROOT, encoding: "utf8" })`         | **PASS**: (a) `status === 0` và stdout chứa `PASS: All rules <= 16,000 chars & <= 24,000 UTF-8 bytes, always_on <= 28,000 chars, and all agents <= 10,000 chars.`; (b) `status === 1` và stderr chứa `UTF-8 bytes (limit 24,000)`; (c) `status === 0`, `stdout === ""` và `stderr === ""`. **FAIL** nếu sai mã thoát, chạy CLI khi import, hoặc in lỗi ra `stderr`. |
| **TC-08 & M5 (Loại C)**          | Ngân sách thực tế & Ma trận bảo toàn 15 mục trong `code-freeze-guard.test.ts`        | Quét toàn bộ `.agents/rules/*.md`, `.agents/agents/*/agent.md` trên repo thật                                                                                                                                                                                                                                                    | **PASS**: Mọi rule `<= 16,000` chars VÀ `Buffer.byteLength <= 24,000`; tổng `always_on <= 28,000`; mọi agent `<= 10,000`; `reviewer/agent.md < 7,500`; `02-quality.md` và `reviewer/agent.md` đều chứa `"16,000"`, `"24,000"`, `"28,000"`, `"10,000"`. **FAIL** nếu bất kỳ tệp nào vượt trần hoặc thiếu khóa M5.                                                    |
| **TC-H & TC-STE-01 (Loại C)**    | Ngân sách LF & CRLF + fixture vượt ngưỡng `28,000`                                   | Đọc `00-core.md`, `02-quality.md`, `05-plan-review.md`, `06-writing-style.md`, `.agents/README.md`                                                                                                                                                                                                                               | **PASS**: `realTotal <= 28000`; `totalLf <= 28000`; `totalCrlf <= 28000`; mọi tệp `always_on` và `06-writing-style.md` đều `<= 24,000` UTF-8 bytes; `overBudgetFixture` (`r02 + "x".repeat(12000)`) đạt `> 28000`; `02-quality.md` không chứa `"                                                                                                                    | :---"`; `.agents/README.md`chứa`"16,000"`, `"24,000"`, `"28,000"`. **FAIL** nếu fixture không vượt `28,000`hoặc`02-quality.md` chứa bảng. |
| **TC-STE-04 (NP-1, NP-4, NP-5)** | 3 Negative Probes cho Progressive Disclosure, UTF-8 multi-byte & chống tham chiếu cũ | (NP-1) Lật mọi rule `glob`/`model_decision` thành `always_on`; (NP-4) `"ệ".repeat(8001)`; (NP-5) Quét regex `/\b(?:12,?000                                                                                                                                                                                                       | 17,?000                                                                                                                                                                                                                                                                                                                                                             | 18,?000)\b/` trên 4 tệp Governance hoạt động (`02-quality.md`, `.agents/README.md`, `reviewer/agent.md`, `scripts/verify-docs.mjs`)       | **PASS**: (NP-1) `syntheticAllAlwaysOnTotal > 28000` (`~46,844`); (NP-4) `fixture.length <= 16000` và `Buffer.byteLength(fixture, "utf8") > 24000`; (NP-5) `0` kết quả khớp trên cả 4 tệp. **FAIL** nếu bất kỳ Negative Probe nào lọt qua. |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### File Kiểm Thử Co-Located

- `scripts/verify-docs.test.ts` (đặt cạnh `scripts/verify-docs.mjs`): kiểm thử `VD-01`..`VD-06` (biên hợp lệ, 4 Negative Probes, CLI Wiring Probe, và Import Side-Effect Probe), dọn `tmpRoot` bằng `fs.rmSync(tmpRoot, { recursive: true, force: true })` trong `afterEach`.
- `.agents/scripts/code-freeze-guard.test.ts` (đặt cạnh `.agents/scripts/code-freeze-guard.js`): cập nhật Loại C cho `TC-08`, `TC-H`, `TC-STE-01`, và `TC-STE-04` (bảo toàn 100% các nhóm test khác `TC-01`..`TC-07`, `TC-C`..`TC-G5`, `WP1`..`WP3`, `TC-STE-02`, `TC-STE-03`).

#### Lệnh Kiểm Chứng Tuần Tự (PowerShell 5.1 — Dùng `;`, Cấm `&&`)

1. **Kiểm tra Prettier trước khi chạy test Governance** (ngăn `lint-staged` phình ký tự khi commit):

```powershell
npx prettier --check .agents/rules/02-quality.md .agents/README.md .agents/agents/reviewer/agent.md scripts/verify-docs.mjs scripts/verify-docs.test.ts .agents/scripts/code-freeze-guard.test.ts docs/plans/README.md docs/CHANGELOG.md
```

2. **Chạy tập trung 2 bộ test Governance & Docs (bao gồm toàn bộ Wiring Probes & Negative Probes)**:

```powershell
npx vitest run scripts/verify-docs.test.ts .agents/scripts/code-freeze-guard.test.ts --reporter=verbose
```

3. **Wiring Probe trên CLI `verify-docs.mjs`**:

```powershell
node scripts/verify-docs.mjs --strict-shorthand
```

- Kỳ vọng trực tiếp trên output: `[1/5]` PASS, `[2/5]` PASS, `[3/5]` PASS, và `[4/5]` in `PASS: All rules <= 16,000 chars & <= 24,000 UTF-8 bytes, always_on <= 28,000 chars, and all agents <= 10,000 chars.` (lưu ý `[5/5]` CHANGELOG `>= 35,000` bytes là nợ kỹ thuật có sẵn ngoài phạm vi; mã thoát `0`/`1` của CLI đã được chứng minh trọn vẹn trong `VD-06`).

4. **Verification Suite Tier 2 toàn repo**:

```powershell
npm run type-check; npm run lint; npm run test:run
```

- Tiêu chí đạt: `type-check` exit `0`, `lint` exit `0` (0 errors, 0 warnings trên các tệp chạm tới), `test:run` pass 100% (tăng thêm `6` test cases từ `scripts/verify-docs.test.ts`).

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                                                                                                             | Mức độ         | Technical Control & Bằng Chứng Xác Minh (`[SRC]` / Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tệp rule tiếng Việt `<= 16,000` ký tự vượt trần `24,000` UTF-8 bytes khiến Antigravity âm thầm cắt cụt cuối tệp ở runtime                                                          | **Cao**        | Cưỡng chế song song `Buffer.byteLength(content, "utf8") <= 24000` tại `scripts/verify-docs.mjs` (`checkGovernanceLimits`) và `.agents/scripts/code-freeze-guard.test.ts:1524-1526` (`TC-08`) + `:2056` (`TC-STE-01`); chứng minh bằng Negative Probe tiếng Việt đa byte (`VD-03` đạt `8,015` chars / `24,001` bytes và `TC-STE-04 NP-4` dùng `"ệ".repeat(8001)` đạt `8,001` chars / `24,003` bytes).                                                                                                                                                                  |
| 2   | Sót tham chiếu cũ `12,000` / `17,000` / `18,000` trong tài liệu Governance đang hoạt động (như `.agents/agents/reviewer/agent.md:45`) làm `@reviewer` áp sai Fail Criterion #6     | **Cao**        | Đồng bộ tất cả 5 tệp đang hoạt động và khóa vĩnh viễn bằng Negative Probe `NP-5` (quét `/\b(?:12,?000                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 17,?000                                                                                                                               | 18,?000)\b/`trả`0`kết quả trên`02-quality.md`, `.agents/README.md`, `reviewer/agent.md`, và `scripts/verify-docs.mjs`) cùng `M5`trong`.agents/scripts/code-freeze-guard.test.ts:1589-1590`. |
| 3   | Chỉnh sửa `.agents/agents/reviewer/agent.md:45` hoặc `lint-staged` Prettier làm tệp vượt `< 7,500` ký tự hoặc chèn bảng Markdown vào `02-quality.md`                               | **Trung bình** | Delta `reviewer/agent.md` chính xác `+43` ký tự (`~6,400–6,500 < 7,500`), khóa cứng bởi `.agents/scripts/code-freeze-guard.test.ts:1540` và `:1928` (`expect(r02).not.toContain("                                                                                                                                                                                                                                                                                                                                                                                     | :---")`); bắt buộc chạy `npx prettier --check`ở Bước 8 trước`npm run verify` (`.prettierrc:1-10`, `docs/lessons-learned.md:838-844`). |
| 4   | Nhập `scripts/verify-docs.mjs` trong Vitest gây lỗi biên dịch `tsc --noEmit` (`// @ts-check` strict), vô tình thực thi CLI gọi `process.exit(1)`, hoặc làm gãy `.claude/worktrees` | **Trung bình** | Thêm `import { fileURLToPath } from "node:url"` và chú thích JSDoc strict đầy đủ (`walk`, `results`, `brokenLinks`, `match`, `resolved`, `legacyMatches`, `shorthandMatches`, `expectedHeadings` tại `scripts/verify-docs.mjs:13-14,51,60,80,121,171,245`), bọc CLI vào `runCli()` sau chốt `isMainModule()`, giữ bộ lọc `.claude/worktrees` (`scripts/verify-docs.mjs:18-23`, khóa tại `.agents/scripts/code-freeze-guard.test.ts:1639-1649`), và chứng minh bằng `npm run type-check` cùng Wiring Probe `VD-06` (`status === 0`, `stdout === ""`, `stderr === ""`). |
| 5   | Nới lỏng kiểm thử sai quy chuẩn (Type C bị nhầm thành hạ chuẩn test / specification gaming) hoặc `overBudgetFixture` trở thành vô nghĩa dưới ngưỡng `28,000`                       | **Trung bình** | Khai báo tường minh Test Contract Loại C ở Mục 8; nâng `overBudgetFixture` sang `r02 + "x".repeat(12000)` (`> 28,000`, `.agents/scripts/code-freeze-guard.test.ts:1921-1926`), nâng `NP-1` lật toàn bộ rule non-`always_on` (`~46,844 > 28,000`), và tăng tổng số `expect()` (không giảm) để vượt qua Test Integrity Guard (`.agents/scripts/code-freeze-guard.js:245-318`).                                                                                                                                                                                          |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-27-raise-governance-rule-budgets.md` (exit `0`):
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ trích dẫn `file:line` (`95/95`) đạt `[PASS] LINE_REF`
  - `[INFO] CRITIC_REQUIRED yes (.agents/agents/reviewer/agent.md, .agents/README.md, .agents/rules/02-quality.md, .agents/scripts/code-freeze-guard.test.ts)`
  - `[INFO] CRITIC_FLOOR skipped (no audit run)`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`
- Kiểm chứng lỗi cũ: Không áp dụng (Revision 1 — lượt thẩm định đầu tiên).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                         | Bằng chứng  | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------- | ------- | ----------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `scripts/verify-docs.mjs:1,13-14,51,60,80,121,171,245`                              | [SRC] [CMD] | `scripts/verify-docs.mjs:1` bật `// @ts-check`, nhưng `npx tsc --showConfig` (`tsconfig.json:4,6,26-34`) cho thấy file `.mjs` này hiện chưa nằm trong đồ thị biên dịch của `tsc --noEmit` vì chưa có file `.ts` nào import nó. Ngay khi `[NEW] scripts/verify-docs.test.ts` import `./verify-docs.mjs`, TypeScript (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`) sẽ kiểm tra toàn bộ `scripts/verify-docs.mjs` và báo lỗi biên dịch ngay trên mã cũ chưa có JSDoc: `function walk(dir)` + `let results = []` (`:13-14,25` gây `TS7006`/`TS7023`/`TS7034`), `let expectedHeadings = null` gán lại `parseInt(val, 10)` (`:245,254`), và các biến/mảng `brokenLinks`, `match`, `resolved`, `legacyMatches`, `shorthandMatches` (`:51,60,80,121,171`). Ngoài ra Bước 4 chưa liệt kê `import { fileURLToPath } from "node:url"` cho `isMainModule()`. Cần bổ sung rõ phạm vi chú thích JSDoc `@param`/`@returns`/`@type` (tương tự `scripts/verify-plan.mjs:73,100-103,355`) và import `node:url` vào Mục 3 (A3), Mục 5, Mục 6.1 và Mục 7 (Bước 4). |
| 2   | DEFECT         | [MINOR] | `.agents/agents/reviewer/agent.md:45`                                               | [SRC]       | Độ lệch ký tự thực tế của đoạn chèn ở dòng 45 (` & \`<= 24,000\` bytes; \`always_on <= 28,000\``) là `+43`ký tự chứ không phải`+42`ký tự (tổng độ dài vẫn dưới ngưỡng`< 7,500`tại`.agents/scripts/code-freeze-guard.test.ts:1540`với khoảng dư lớn). Đồng thời, trong`checkGovernanceLimits()` nên bóc tách riêng khối YAML frontmatter đầu tệp (`/^---\r?\n([\s\S]\*?)\r?\n---(?:\r?\n                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | $)/`) trước khi kiểm `/^trigger:\s*always_on\s*$/m`để tránh nhận nhầm nếu rule`glob`tương lai chứa ví dụ code có dòng`trigger: always_on`, và ở `VD-06 (c)`nên chốt rõ`cwd: REPO_ROOT`(hoặc`pathToFileURL(SCRIPT_ABS).href`) cùng kiểm chứng `stderr === ""`. |
| 3   | RISK_DISMISSED | [MINOR] | `.agents/scripts/code-freeze-guard.test.ts:1524-1544,1914-1928,2053-2072,2151-2209` | [SRC] [CMD] | Đã đối chiếu trực tiếp toàn bộ ca kiểm thử Loại C: tổng số `expect()` tăng ròng (`+13`), không thêm `.skip`/`.only`/`try` hay nới matcher theo `assessTestIntegrity` (`.agents/scripts/code-freeze-guard.js:245-318`); `overBudgetFixture` (`r02 + "x".repeat(12000)`) vượt `28,000` trên cả LF (`~28,778`) lẫn CRLF (`~28,999`); `NP-1` lật cả 4 rule non-`always_on` (`01-coding.md`, `03-ui.md`, `04-bilingual.md`, `06-writing-style.md`) vượt `28,000`; số học UTF-8 đa byte tiếng Việt của `VD-01` (`22 + 7992*3 + 2 = 24,000`B), `VD-03` (`22 + 7993*3 = 24,001`B), `NP-4` (`8001*3 = 24,003`B) chuẩn xác; `.agents/rules/02-quality.md:74` tăng đúng `+27` ký tự và không chứa bảng Markdown (`:1928`). Baseline `npx vitest run .agents/scripts/code-freeze-guard.test.ts` đạt `132/132` pass.                                                                                                                                                                                                                                                            |
| 4   | RISK_DISMISSED | [MINOR] | `.agents/rules/02-quality.md:74`                                                    | [SRC] [CMD] | Đã đọc độc lập toàn bộ 7 tệp `.agents/rules/*.md`, 3 tệp `.agents/agents/*/agent.md`, 3 tài liệu vệ tinh của `@reviewer`, `.agents/README.md`, `.agents/skills/README.md`, 10 tệp `SKILL.md`, và `docs/{README,architecture,overview,security}.md`: không còn tham chiếu ngân sách cũ `12,000`/`17,000`/`18,000` ngoài 5 tệp mục tiêu đã khai báo. Bộ lọc `.claude/worktrees` (`scripts/verify-docs.mjs:18-23`, khóa tại `.agents/scripts/code-freeze-guard.test.ts:1639-1649`) và các mục `[1/5]`..`[3/5]`, `[5/5]` được giữ nguyên tương thích ngược; `node scripts/verify-docs.mjs --strict-shorthand` xác nhận `[1/5]`..`[4/5]` PASS và `[5/5]` là nợ dung lượng `docs/CHANGELOG.md` có sẵn (`128,575` bytes).                                                                                                                                                                                                                                                                                                                                                 |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                   | Kết quả | Bằng chứng  | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7/7 mục)                      | PASS    | [CMD] [SRC] | `node scripts/verify-plan.mjs` trả `[PASS] SECTIONS 7/7`, `0 failures, 0 warnings`; bảng `Skills Loaded & Applied` ánh xạ đủ các quy tắc/skill miền Governance (`02-quality.md`, `05-plan-review.md`, `06-writing-style.md`, `vikini-investigate`, `vikini-audit`).                                                                                                                                                                                                                                                                                                                                     |
| S1: Cold-start & Build                                | FAIL    | [SRC] [CMD] | Baseline `npm run type-check` & `npm run lint` hiện exit `0`, `npx eslint --print-config scripts/verify-docs.mjs` xác nhận `no-undef: 2` khớp `/* global process, console, Buffer */` (`scripts/verify-docs.mjs:2`), không thêm dependency hay biến `.env`. Tuy nhiên Defect #1 (`[MAJOR]`): thêm `scripts/verify-docs.test.ts` sẽ đưa `scripts/verify-docs.mjs` (`// @ts-check`) vào `tsc --noEmit` (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true` qua `npx tsc --showConfig`), gây lỗi biên dịch ngay trên `walk(dir)` (`:13-14`) và `expectedHeadings` (`:245,254`) chưa có JSDoc. |
| S2: Runner Lifecycle & Teardown                       | PASS    | [SRC]       | `scripts/verify-docs.test.ts` cô lập filesystem qua `fs.mkdtempSync` và dọn sạch trong `afterEach` theo mẫu `scripts/verify-plan.test.ts:52-57`; chốt `isMainModule()` + `runCli()` ngăn side-effect `process.exit(1)` khi Vitest import module, có kiểm chứng trực tiếp ở `VD-06`. Không chạm SSE/AudioContext/Redis.                                                                                                                                                                                                                                                                                  |
| S3: Database & Temporal Logic                         | N/A     | [SRC]       | Kế hoạch chỉ sửa tài liệu Governance, script CLI `scripts/verify-docs.mjs` và test Vitest; không chạm Supabase PostgreSQL, schema hay RLS.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| S4: Cross-Task State Flow                             | N/A     | [SRC]       | Không sửa Zustand store, SWR cache hay URL query hooks dưới `src/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| S5: Security Boundary & Code Freeze Harness           | PASS    | [SRC] [ADV] | Không đọc/ghi `.env*`, không sửa `code-freeze-guard.js`/`command-policy.js`/`plan-scope.js`, không thêm quyền lệnh nguy hiểm. Gate 4 (`code-freeze-guard.js:502-518`) và Gate 7 (`:543-551`) tiếp tục trả `ask` cho test và `.agents/**`; `CRITIC_REQUIRED yes` buộc qua Independent Critic Pass; Test Integrity Guard nhận net `+13` `expect()` (`:245-318`).                                                                                                                                                                                                                                          |
| S6: External Resilience & Serverless Cap              | N/A     | [SRC]       | Không gọi nhà cung cấp AI ngoài hay sửa route API Next.js (`maxDuration`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Domain: Governance, Antigravity 2026 Spec & Bilingual | PASS    | [SRC] [URL] | Đã xác minh thông số Antigravity 2026 (`24,000` bytes/file, `20,000` tokens `defaultRulesBudget`) qua cả tệp đặc tả nội bộ `rules.md` và tra cứu trực tuyến `antigravity.google` (`[URL]`). Không sửa chuỗi UI trong `src/lib/utils/translations/`, nên `04-bilingual.md` không áp dụng. Rủi ro Cao/Trung bình đều gắn technical control và Negative Probe (`VD-02`..`VD-05`, `NP-1`, `NP-4`, `NP-5`).                                                                                                                                                                                                  |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Đồng thời**: `N/A` — Công cụ CLI và bộ test cục bộ dùng thư mục tạm tách biệt (`fs.mkdtempSync`), không có trạng thái dùng chung hoặc cạnh tranh quota đồng thời.
  2. **Khoảng trống check→use (TOCTOU)**:
     - _Cơ chế: `lint-staged` Prettier commit-time padding & Same-Date Plan Scope (`plan-scope.js:170-212`)_
     - `T1`: Dev chỉnh `.agents/agents/reviewer/agent.md:45` và chạy `vitest` trước khi định dạng | `T2`: Khi commit, Husky `lint-staged` chạy `prettier --write` trên `*.md` có thể đệm bảng Markdown làm tăng ký tự; đồng thời thư mục `docs/plans/` cùng ngày `2026-11-27` có sẵn `2026-11-27-asd-ste100-writing-rules.md` | `T3`: Kế hoạch buộc chạy `npx prettier --check` ở Bước 8 trước `npm run verify`, giữ `reviewer/agent.md` biên dư `~850–1,000` ký tự dưới `< 7,500`, cấm bảng trong `02-quality.md` (`TC-H:1928`), và đã xác minh `2026-11-27-asd-ste100-writing-rules.md:4` ở trạng thái `Status: Completed` (`hasCompletedPlanHeader` cho qua tại `.agents/scripts/plan-scope.js:206`).
     - _Kết cục_: Không vượt trần lúc commit và không bị kẹt nhóm ngày tại `plan-scope.js` -> **An toàn**.
  3. **Thất bại giữa chừng & thất bại của chính bước dọn dẹp**:
     - _Cơ chế: Vitest import `scripts/verify-docs.mjs` & teardown `tmpRoot`_
     - `T1`: `scripts/verify-docs.test.ts` import `checkGovernanceLimits` từ `./verify-docs.mjs` trong tiến trình worker Vitest hoặc một test case ném `AssertionError` giữa chừng | `T2`: Nếu CLI không được bọc bởi `isMainModule()`, `verify-docs.mjs` sẽ chạy `runCli()` trên repo thật và gọi `process.exit(1)` tại `[5/5]` CHANGELOG `128,575` bytes làm sập toàn bộ Vitest worker; nếu thiếu `afterEach`, `tmpRoot` sẽ rò rỉ đĩa | `T3`: `isMainModule()` so sánh `path.resolve(process.argv[1])` với `fileURLToPath(import.meta.url)` (không phân biệt hoa/thường trên `win32`) trả `false` khi import, và `afterEach` chạy `fs.rmSync(tmpRoot, { recursive: true, force: true })` bất kể assertion fail.
     - _Kết cục_: Worker Vitest không bị `process.exit(1)` và `tmpRoot` luôn được dọn sạch -> **An toàn**.
  4. **Môi trường serverless**: `N/A` — Phạm vi chỉ gồm tệp Governance `.md`, script CLI `scripts/verify-docs.mjs` và unit test; không được đóng gói vào Vercel serverless runtime.
- **Commands Executed** (toàn bộ thuộc allowlist `.agents/agents/reviewer/allowlist.md`):
  - `node scripts/verify-plan.mjs docs/plans/2026-11-27-raise-governance-rule-budgets.md` ➔ exit `0` (`SECTIONS 7/7`, `CRITIC_REQUIRED yes`, `0 failures, 0 warnings`)
  - `npm run type-check` ➔ exit `0`
  - `npx tsc --showConfig` ➔ exit `0` (`allowJs: true`, `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`; `scripts/verify-docs.mjs` chưa thuộc `"files"`)
  - `npm run lint` ➔ exit `0`
  - `npx eslint --print-config scripts/verify-docs.mjs` ➔ exit `0` (`no-undef: [2]`, `ecmaVersion: 2026`, `sourceType: "module"`)
  - `npx eslint --print-config scripts/verify-plan.test.ts` ➔ exit `0` (`@typescript-eslint/no-explicit-any: [2]`, `no-console: [2]`)
  - `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` ➔ exit `0` (`132 passed`)
  - `node scripts/verify-docs.mjs --strict-shorthand` ➔ exit `1` (`[1/5]`–`[4/5]` PASS; `[5/5]` FAIL do nợ sẵn `CHANGELOG.md` `128,575` bytes >= `35,000`)
  - `git status` ➔ exit `0`
  - `git log --oneline -n 5` ➔ exit `0`

#### 4. Kết Luận

Còn 1 lỗi `[MAJOR]` ở S1 (Cold-start & Build): kế hoạch chưa xử lý việc `scripts/verify-docs.test.ts` kéo `scripts/verify-docs.mjs` (`// @ts-check`) vào `tsc --noEmit` (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`), dẫn tới lỗi biên dịch trên `walk(dir)` (`scripts/verify-docs.mjs:13-14`) và các biến/mảng cũ chưa có JSDoc (`:51,60,80,121,171,245`), đồng thời Bước 4 chưa liệt kê `import { fileURLToPath } from "node:url"`. Yêu cầu `@planner` bổ sung đặc tả chú thích JSDoc `@ts-check` và import `node:url` cho `scripts/verify-docs.mjs` (kèm khuyến nghị `[MINOR]` về `+43` ký tự, parse frontmatter cho `always_on`, và `cwd: REPO_ROOT` + `stderr === ""` ở `VD-06 (c)`) trong Revision 2.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-27-raise-governance-rule-budgets.md` (trước khi nối Audit Run 2, exit `0`):
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ trích dẫn `file:line` (`106/106`) đạt `[PASS] LINE_REF`
  - `[INFO] CRITIC_REQUIRED yes (.agents/agents/reviewer/agent.md, .agents/README.md, .agents/rules/02-quality.md, .agents/scripts/code-freeze-guard.test.ts)`
  - `[PASS] CRITIC_FLOOR 4 findings with valid file:line`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`
- Kiểm chứng lỗi cũ từ Audit Run 1:

| #   | Lỗi cũ (Audit Run 1)                                                                                                                                                                                                                                                     | Trạng thái | Bằng chứng đối chiếu (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `[MAJOR]` Thiếu chú thích JSDoc strict `// @ts-check` trên mã cũ `scripts/verify-docs.mjs` (`walk`, `results`, `brokenLinks`, `match`, `resolved`, `legacyMatches`, `shorthandMatches`, `expectedHeadings`) và thiếu `import { fileURLToPath } from "node:url"` ở Bước 4 | **ĐÃ SỬA** | Đã đối chiếu `scripts/verify-docs.mjs:1,13-14,51,60,80,121,171,245`, `tsconfig.json:4,6,10,26-34` (`npx tsc --showConfig`) và `scripts/verify-plan.mjs:73,100-103,355`: Revision 2 đã bổ sung đầy đủ `import { fileURLToPath } from "node:url"`, `@typedef` và JSDoc `@param`/`@returns`/`@type` trên toàn bộ biến/hàm cũ và mới tại Mục 3 (A3), Mục 5, Mục 6.1, Mục 7 (Bước 4) và Mục 10 (Risk #4), đồng thời dùng `slice("--expected-headings=".length)` tránh kiểu `string \| undefined`. |
| 2   | `[MINOR]` Sai lệch `+42` vs `+43` ký tự trên `.agents/agents/reviewer/agent.md:45`; nên giới hạn nhận diện `trigger: always_on` trong khối YAML frontmatter; `VD-06 (c)` cần chốt `cwd: REPO_ROOT` / `pathToFileURL` và `stderr === ""`                                  | **ĐÃ SỬA** | Đã đối chiếu `.agents/agents/reviewer/agent.md:45` (`+43` ký tự), `.agents/rules/00-core.md:1-4` & `02-quality.md:1-4` & `05-plan-review.md:1-4` (`FRONTMATTER_REGEX` không cờ `m`/`g` trong `extractYamlFrontmatter` / `isAlwaysOnRule`, có Negative Probe trong `VD-04`), và `VD-06 (c)` dùng `JSON.stringify(pathToFileURL(SCRIPT_ABS).href)` với `cwd: REPO_ROOT`, kiểm cả `stdout === ""` lẫn `stderr === ""`.                                                                          |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                            | Bằng chứng  | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------- | ------- | ------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | RISK_DISMISSED | [MINOR] | `scripts/verify-docs.mjs:1,13-14,51,60,80,121,171,245` | [SRC] [CMD] | Đã rà soát lại toàn bộ 308 dòng của `scripts/verify-docs.mjs` dưới `strict: true` (`noImplicitAny`, `strictNullChecks` từ `npx tsc --showConfig`) và `no-undef: 2` (`npx eslint --print-config scripts/verify-docs.mjs`): tập JSDoc `@param`/`@returns`/`@type` + `import { fileURLToPath } from "node:url"` trong Revision 2 bao phủ hết mọi vị trí biên dịch strict. Khi triển khai lưu ý truyền tiếp `repoRoot` trong lời gọi đệ quy `walk(fullPath, repoRoot)` (`scripts/verify-docs.mjs:25`) và sử dụng đủ 4 hằng số import trong `scripts/verify-docs.test.ts` để giữ `0` lỗi `@typescript-eslint/no-unused-vars` (`eslint.config.mjs:59-66`). |
| 2   | RISK_DISMISSED | [MINOR] | `.agents/rules/00-core.md:1-4`                         | [SRC]       | Biểu thức `FRONTMATTER_REGEX = /^---\r?\n([\s\S]\*?)\r?\n---(?:\r?\n                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | $)/`không dùng cờ`m`/`g`(không mang trạng thái`lastIndex`), khớp đúng khối YAML frontmatter đầu tệp trên cả LF và CRLF cho 3 rule `always_on` (`.agents/rules/00-core.md:1-4`, `02-quality.md:1-4`, `05-plan-review.md:1-4`), trả `false`cho 4 rule`glob`/`model_decision` và tệp không có frontmatter (`VD-02`), đồng thời chặn false positive khi thân Markdown chứa ví dụ `trigger: always_on` (`VD-04`). |
| 3   | RISK_DISMISSED | [MINOR] | `.agents/agents/reviewer/agent.md:45`                  | [SRC] [CMD] | Delta ký tự tại `.agents/agents/reviewer/agent.md:45` đã chuẩn hóa thành `+43` ký tự (tổng dưới `< 7,500` theo `.agents/scripts/code-freeze-guard.test.ts:1540`); `VD-06 (c)` dùng `JSON.stringify(pathToFileURL(SCRIPT_ABS).href)` với `cwd: REPO_ROOT` và kiểm `stdout === ""` cùng `stderr === ""`, hoạt động đồng nhất trên Windows và Linux CI. Baseline `code-freeze-guard.test.ts` (`132/132`), `npm run type-check`, `npm run lint` đều exit `0`.                                                                                                                                                                                            |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                   | Kết quả | Bằng chứng  | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan Completeness Gate (7/7 mục)                      | PASS    | [CMD] [SRC] | `node scripts/verify-plan.mjs` trả `[PASS] SECTIONS 7/7`, `106/106` `LINE_REF` hợp lệ, `0 failures, 0 warnings`; `Skills Loaded & Applied` ánh xạ đủ quy tắc và skill Governance.                                                                                                                                                                                                                                  |
| S1: Cold-start & Build                                | PASS    | [SRC] [CMD] | Baseline `npm run type-check` & `npm run lint` exit `0`; Revision 2 bổ sung đủ `import { fileURLToPath } from "node:url"` và chú thích JSDoc strict cho toàn bộ biến/hàm cũ và mới trong `scripts/verify-docs.mjs:1-308`, tương thích `tsconfig.json:4,6,10,26-34` (`npx tsc --showConfig`) và `eslint.config.mjs:9` (`npx eslint --print-config scripts/verify-docs.mjs`). Không thêm dependency hay biến `.env`. |
| S2: Runner Lifecycle & Teardown                       | PASS    | [SRC]       | `scripts/verify-docs.test.ts` tạo `tmpRoot` bằng `fs.mkdtempSync` và dọn sạch trong `afterEach` (`scripts/verify-plan.test.ts:52-57`); `isMainModule()` + `runCli()` cô lập side-effect khi import, kiểm chứng bằng `VD-06 (c)` (`stdout === ""`, `stderr === ""`).                                                                                                                                                |
| S3: Database & Temporal Logic                         | N/A     | [SRC]       | Không chỉnh sửa bảng, migration, RPC hay RLS của Supabase PostgreSQL.                                                                                                                                                                                                                                                                                                                                              |
| S4: Cross-Task State Flow                             | N/A     | [SRC]       | Không chỉnh sửa Zustand store, SWR cache hay URL sync hook trong `src/`.                                                                                                                                                                                                                                                                                                                                           |
| S5: Security Boundary & Code Freeze Harness           | PASS    | [SRC] [ADV] | Không chạm `.env*` hoặc mã thực thi hook (`code-freeze-guard.js`, `command-policy.js`, `plan-scope.js`); Gate 4 (`code-freeze-guard.js:502-518`) và Gate 7 (`:543-551`) giữ nguyên trạng thái `ask`; `assessTestIntegrity` (`:245-318`) ghi nhận tăng ròng `+13` `expect()`; `CRITIC_REQUIRED yes` khóa repo dưới trạng thái `Awaiting Critic` (`plan-scope.js:206-207`) chờ Independent Critic Pass.              |
| S6: External Resilience & Serverless Cap              | N/A     | [SRC]       | Không tích hợp AI provider ngoài hay chỉnh sửa API route Next.js (`maxDuration`).                                                                                                                                                                                                                                                                                                                                  |
| Domain: Governance, Antigravity 2026 Spec & Bilingual | PASS    | [SRC] [URL] | Đã xác minh ngưỡng Antigravity 2026 (`24,000` bytes/file, `20,000` tokens `defaultRulesBudget`) qua tệp nội bộ `rules.md` và tài liệu `antigravity.google` (`[URL]`); không chạm văn bản UI `src/lib/utils/translations/` nên `04-bilingual.md` không áp dụng; không còn tham chiếu cũ `12,000`/`17,000`/`18,000` ngoài 5 tệp mục tiêu.                                                                            |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Đồng thời**: `N/A` — Script CLI và test cô lập thư mục tạm (`fs.mkdtempSync`), không chia sẻ trạng thái mutable giữa các yêu cầu đồng thời.
  2. **Khoảng trống check→use (TOCTOU)**:
     - _Cơ chế: `lint-staged` Prettier padding & Same-Date Plan Scope (`plan-scope.js:170-212`)_
     - `T1`: Cập nhật `.agents/agents/reviewer/agent.md:45` (`+43` ký tự) và `.agents/rules/02-quality.md:74` (`+27` ký tự) | `T2`: `lint-staged` chạy `prettier --write` khi commit hoặc `plan-scope.js` đọc cùng ngày `2026-11-27` gồm `2026-11-27-asd-ste100-writing-rules.md` | `T3`: Bước 8 chạy `npx prettier --check` trước `npm run verify`, `reviewer/agent.md` còn biên dư `~850–1,000` ký tự dưới `< 7,500`, `02-quality.md` không dùng bảng (`:1928`), và `2026-11-27-asd-ste100-writing-rules.md:4` đã đóng `Status: Completed` (`plan-scope.js:206`).
     - _Kết cục_: Không trượt trần ký tự khi commit và khóa fail-safe hoạt động đúng cho đến khi Independent Critic cấp `[PLAN_APPROVED]` -> **An toàn**.
  3. **Thất bại giữa chừng & thất bại của chính bước dọn dẹp**:
     - _Cơ chế: Vitest import `scripts/verify-docs.mjs` & `isAlwaysOnRule` frontmatter parsing_
     - `T1`: Vitest worker import `checkGovernanceLimits`/`isAlwaysOnRule` từ `scripts/verify-docs.mjs` hoặc một ca kiểm thử thất bại giữa chừng | `T2`: CLI có thể gọi `process.exit(1)` tại `[5/5]` CHANGELOG `128,575` bytes nếu thiếu guard, hoặc `tmpRoot` tồn đọng trên đĩa | `T3`: `isMainModule()` so khớp `path.resolve(process.argv[1])` và `fileURLToPath(import.meta.url)` (case-insensitive trên `win32`) trả `false` khi import (xác minh bởi `VD-06 (c)` với `stdout === ""`, `stderr === ""`), còn `afterEach` chạy `fs.rmSync(tmpRoot, { recursive: true, force: true })`.
     - _Kết cục_: Không sập worker Vitest và không rò rỉ thư mục tạm -> **An toàn**.
  4. **Môi trường serverless**: `N/A` — Không thay đổi mã chạy trong Next.js App Router serverless runtime.
- **Commands Executed** (thuộc allowlist `.agents/agents/reviewer/allowlist.md`):
  - `node scripts/verify-plan.mjs docs/plans/2026-11-27-raise-governance-rule-budgets.md` ➔ exit `0` (`SECTIONS 7/7`, `106/106` `LINE_REF`, `CRITIC_REQUIRED yes`, `0 failures, 0 warnings`)
  - Kế thừa kiểm chứng baseline cùng phiên chưa đổi mã nguồn (`npm run type-check` exit `0`, `npx tsc --showConfig` exit `0`, `npm run lint` exit `0`, `npx eslint --print-config scripts/verify-docs.mjs` exit `0`, `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` exit `0` `132/132`, `node scripts/verify-docs.mjs --strict-shorthand` `[1/5]`–`[4/5]` PASS).

#### 4. Kết Luận

Toàn bộ lỗi `[MAJOR]` và góp ý `[MINOR]` từ Audit Run 1 đã được xử lý triệt để trong Revision 2; không còn lỗi `[BLOCKER]` hoặc `[MAJOR]`. Do `CRITIC_REQUIRED yes` (chạm 4 tệp dưới `.agents/**`), Primary `@reviewer` chuyển trạng thái sang `- **Status**: Awaiting Critic` và bàn giao cho phiên `@reviewer` độc lập mới (Independent Critic Pass, zero shared history) thẩm định trước khi cấp `[PLAN_APPROVED]`.

[AWAITING_CRITIC]

---

### Audit Run 3 (Independent Critic Pass)

[REVIEWER_MODEL: gemini-4-argon (critic)]

CRITIC_VERDICT: AGREE

#### 1. Output verify-plan.mjs & Kiểm Chứng Độc Lập

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-27-raise-governance-rule-budgets.md` (trước khi ghi Audit Run 3, exit `0`):
  - `[PASS] SECTIONS 7/7`
  - `106/106` trích dẫn `file:line` đạt `[PASS] LINE_REF`
  - `[INFO] CRITIC_REQUIRED yes (.agents/agents/reviewer/agent.md, .agents/README.md, .agents/rules/02-quality.md, .agents/scripts/code-freeze-guard.test.ts)`
  - `[PASS] CRITIC_FLOOR 3 findings with valid file:line`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`
- Đối chiếu độc lập (zero shared history) trên codebase thật và lỗi Audit Run 1 (`[MAJOR]` JSDoc `// @ts-check` trên `scripts/verify-docs.mjs` + `import { fileURLToPath } from "node:url"`; `[MINOR]` delta `+43` ký tự trên `reviewer/agent.md:45`, bóc tách YAML frontmatter cho `isAlwaysOnRule`, và `VD-06 (c)` với `pathToFileURL` + `cwd: REPO_ROOT` + `stderr === ""`): xác nhận cả hai mục đều **ĐÃ SỬA** khớp mã nguồn thực tế (`scripts/verify-docs.mjs:1-308`, `tsconfig.json:4-11,26-34`, `.agents/agents/reviewer/agent.md:45`, `.agents/rules/00-core.md:1-4`).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                                                   | Bằng chứng  | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------- | ------- | --------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | [MINOR] | `scripts/verify-docs.mjs:1,13-29,51,60,80,121,171,205-237,245-256`                            | [SRC] [CMD] | Đã rà soát độc lập toàn bộ 308 dòng của `scripts/verify-docs.mjs` dưới `tsconfig.json:4-11,26-34` (`npx tsc --showConfig`: `strict: true`, `allowJs: true`, `noImplicitAny: true`, `strictNullChecks: true`) và `eslint.config.mjs:9,11` (`npx eslint --print-config scripts/verify-docs.mjs`: `no-undef: 2`, `no-unused-vars: 2`, `ecmaVersion: 2026`). Bộ JSDoc `@typedef`/`@param`/`@returns`/`@type`, `import { fileURLToPath } from "node:url"`, và `expectedHeadingsArg.slice("--expected-headings=".length)` phủ kín mọi vị trí strict; `isMainModule()` xử lý cả hoa/thường ổ đĩa trên `win32` lẫn đường dẫn POSIX chính xác trên Linux CI; bộ lọc `.claude/worktrees` (`:18-23`, khóa tại `.agents/scripts/code-freeze-guard.test.ts:1639-1649`) được bảo toàn. Lưu ý triển khai (`[MINOR]`): tách hai nhánh `if (len > RULE_MAX_CHARS)` và `if (bytes > RULE_MAX_BYTES)` độc lập (không dùng `else if`) trong `checkGovernanceLimits()`, và truyền `repoRoot` xuyên suốt `walk` cùng `[1/5]`–`[5/5]` bên trong `runCli(repoRoot, argv)`. |
| 2   | RISK_DISMISSED | [MINOR] | `.agents/scripts/code-freeze-guard.test.ts:1517-1544,1589-1590,1914-1928,2053-2072,2151-2209` | [SRC] [CMD] | Đã đối chiếu độc lập toàn bộ thay đổi Loại C với `assessTestIntegrity()` (`.agents/scripts/code-freeze-guard.js:245-318`) và thứ tự Gate 4 (`:502-518`) / Gate 7 (`:543-551`): tổng số `expect()` tăng ròng `+13` (`TC-08` `+1`, `M5` `+6`, `TC-H` `0`, `TC-STE-01` `+4`, `TC-STE-04` `+2`), không thêm `.skip`/`.only`/`try` và không nới matcher; `overBudgetFixture` (`r02 + "x".repeat(12000)`) đạt `~28,778` (LF) / `~28,999` (CRLF) `> 28,000`; `NP-1` lật toàn bộ rule `glob`/`model_decision` đạt `~46,844 > 28,000`; phép tính UTF-8 đa byte của `VD-01` (`22 + 7992*3 + 2 = 24,000`B), `VD-03` (`22 + 7993*3 = 24,001`B), `NP-4` (`8001*3 = 24,003`B) khớp đặc tả. Lưu ý triển khai (`[MINOR]`): áp dụng mỗi cụm `TC-STE-01` và `TC-STE-04` trong một lần gọi `edit_file` liên tục để `assessTestIntegrity()` ghi nhận chênh lệch `expect()` dương ngay trên từng thao tác sửa.                                                                                                                                                          |
| 3   | RISK_DISMISSED | [MINOR] | `.agents/rules/02-quality.md:72-76`                                                           | [SRC] [URL] | Đã xác minh độc lập đặc tả Google Antigravity 2026 (`24,000` bytes/file và `20,000` tokens `defaultRulesBudget`) qua cả tệp nội bộ `rules.md:31-40` lẫn truy vấn web `antigravity.google` (`[URL]`). Đã đọc trực tiếp toàn bộ 7 tệp `.agents/rules/*.md`, 3 tệp `.agents/agents/*/agent.md`, 3 tài liệu vệ tinh của `@reviewer`, `.agents/README.md`, `.agents/skills/README.md`, 10 tệp `SKILL.md` và `docs/{README,architecture,overview,security}.md`: không phát hiện tham chiếu ngân sách cũ `12,000`/`17,000`/`18,000` nào ngoài 5 tệp mục tiêu đã khai báo. Delta `+27` ký tự trên `02-quality.md:74` không chèn bảng Markdown (`:1928`) và delta `+43` ký tự trên `.agents/agents/reviewer/agent.md:45` giữ tổng ký tự dưới `< 7,500` (`:1540`).                                                                                                                                                                                                                                                                                           |
| 4   | RISK_DISMISSED | [MINOR] | `.agents/scripts/plan-scope.js:170-212`                                                       | [SRC] [CMD] | Đã kiểm chứng độc lập nhóm ngày `2026-11-27` qua `git status` và đọc đầu tệp kế hoạch cùng ngày `2026-11-27-asd-ste100-writing-rules.md`: trạng thái đã đóng `Status: Completed` nên `hasCompletedPlanHeader` (`plan-scope.js:206`) bỏ qua đúng quy tắc; sau khi duyệt, `Plan Scope Guard` mở khóa riêng `scripts/verify-docs.mjs` tại Gate 9 trong khi giữ `ask` cho `.agents/**` (Gate 7) và `*.test.ts` (Gate 4). Đồng thời xác nhận chèn 1 hàng vào đầu bảng trong `docs/plans/README.md:14-18` bảo toàn `activeGuidancePart` và mốc `"2026-10-24"` trong `historicalMatrixPart` (`.agents/scripts/code-freeze-guard.test.ts:1960-1975`).                                                                                                                                                                                                                                                                                                                                                                                                      |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                   | Kết quả | Bằng chứng  | Chi tiết                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7/7 mục)                      | PASS    | [CMD] [SRC] | `node scripts/verify-plan.mjs` trả `[PASS] SECTIONS 7/7`, `106/106` `LINE_REF` hợp lệ, `0 failures, 0 warnings`; bảng `Skills Loaded & Applied` ánh xạ đủ quy tắc và skill Governance (`02-quality.md`, `05-plan-review.md`, `06-writing-style.md`, `vikini-investigate`, `vikini-audit`).                                                                                             |
| S1: Cold-start & Build                                | PASS    | [SRC] [CMD] | Chạy độc lập `npm run type-check`, `npx tsc --showConfig`, `npm run lint`, và `npx eslint --print-config scripts/verify-docs.mjs` đều exit `0`; phạm vi JSDoc `// @ts-check` và `import { fileURLToPath } from "node:url"` trong Revision 2 bao phủ toàn bộ mã cũ và mới của `scripts/verify-docs.mjs:1-308`; không thêm dependency trong `package.json` hay biến `.env`.              |
| S2: Runner Lifecycle & Teardown                       | PASS    | [SRC]       | `scripts/verify-docs.test.ts` cô lập filesystem bằng `fs.mkdtempSync` và dọn sạch qua `afterEach` theo mẫu `scripts/verify-plan.test.ts:52-57`; `isMainModule()` + `runCli()` ngăn gọi `process.exit(1)` khi import, kiểm chứng trực tiếp qua `VD-06 (c)`.                                                                                                                             |
| S3: Database & Temporal Logic                         | N/A     | [SRC]       | Phạm vi kế hoạch không chạm bảng, migration, RPC hay RLS của Supabase PostgreSQL.                                                                                                                                                                                                                                                                                                      |
| S4: Cross-Task State Flow                             | N/A     | [SRC]       | Không chỉnh sửa file nào trong `src/` (không đụng Zustand store, SWR cache hay URL sync hook).                                                                                                                                                                                                                                                                                         |
| S5: Security Boundary & Code Freeze Harness           | PASS    | [SRC] [ADV] | Không đọc/ghi `.env*`, không sửa mã thực thi hook (`code-freeze-guard.js`, `command-policy.js`, `plan-scope.js`), bảo toàn Gate 4 (`:502-518`) và Gate 7 (`:543-551`) ở chế độ `ask`, tăng ròng `+13` `expect()` cho `assessTestIntegrity` (`:245-318`), và giữ fail-safe `Awaiting Critic` tại `plan-scope.js:206-207` cho đến khi Critic Pass kết luận.                              |
| S6: External Resilience & Serverless Cap              | N/A     | [SRC]       | Không gọi AI provider bên ngoài và không chỉnh sửa Next.js API route (`maxDuration`).                                                                                                                                                                                                                                                                                                  |
| Domain: Governance, Antigravity 2026 Spec & Bilingual | PASS    | [SRC] [URL] | Đặc tả Antigravity 2026 (`24,000` bytes/file, `20,000` tokens `defaultRulesBudget`) được kiểm chứng độc lập qua `rules.md:31-40` và `antigravity.google` (`[URL]`); không sửa khóa UI trong `src/lib/utils/translations/` nên `04-bilingual.md` không áp dụng; toàn bộ 5 rủi ro Cao/Trung bình đều gắn technical control và Negative Probe (`VD-02`..`VD-05`, `NP-1`, `NP-4`, `NP-5`). |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Đồng thời**: `N/A` — Script CLI và unit test dùng thư mục tạm riêng (`fs.mkdtempSync`), không có trạng thái dùng chung hoặc tranh chấp ghi đồng thời.
  2. **Khoảng trống check→use (TOCTOU)**:
     - _Cơ chế: `lint-staged` Prettier padding lúc commit & `plan-scope.js:170-212` nhóm ngày `2026-11-27`_
     - `T1`: Triển khai cập nhật `02-quality.md:74` (`+27` chars), `reviewer/agent.md:45` (`+43` chars), `.agents/README.md:61` và chạy `vitest` | `T2`: `lint-staged` chạy `prettier --write` trên `*.md` lúc commit hoặc `plan-scope.js` quét đồng thời cả hai kế hoạch ngày `2026-11-27` | `T3`: Bước 8 chạy `npx prettier --check` trước `npm run verify`, `.prettierrc:1-10` giữ nguyên dòng đơn không wrap, `02-quality.md` không chứa bảng (`:1928`), `reviewer/agent.md` còn biên dư `~850–1,000` chars dưới `< 7,500`, và kế hoạch cùng ngày `2026-11-27-asd-ste100-writing-rules.md` đã đóng `Status: Completed` (`plan-scope.js:206`).
     - _Kết cục_: Không trượt ngân sách lúc commit và `Plan Scope Guard` hoạt động đúng sau khi phê duyệt -> **An toàn**.
  3. **Thất bại giữa chừng & thất bại của chính bước dọn dẹp**:
     - _Cơ chế: Import `scripts/verify-docs.mjs` từ Vitest & cleanup `tmpRoot`_
     - `T1`: `scripts/verify-docs.test.ts` import các hàm xuất từ `./verify-docs.mjs` trong worker Vitest hoặc một test case ném `AssertionError` | `T2`: Nếu CLI tự chạy khi import, `[5/5]` CHANGELOG (`128,575 >= 35,000` bytes) sẽ gọi `process.exit(1)` làm sập tiến trình Vitest; nếu thiếu teardown, `tmpRoot` tồn đọng trên đĩa | `T3`: `isMainModule()` trả `false` khi import (được khóa bằng Wiring Probe `VD-06 (c)` với `status === 0`, `stdout === ""`, `stderr === ""`), và `afterEach` dọn `tmpRoot` bằng `fs.rmSync(tmpRoot, { recursive: true, force: true })` kể cả khi assertion thất bại.
     - _Kết cục_: Worker Vitest an toàn trước side-effect CLI và không rò rỉ thư mục tạm -> **An toàn**.
  4. **Môi trường serverless**: `N/A` — Không thay đổi mã chạy trong Next.js App Router serverless runtime.
- **Commands Executed** (chạy độc lập trong phiên Critic, thuộc allowlist `.agents/agents/reviewer/allowlist.md`):
  - `node scripts/verify-plan.mjs docs/plans/2026-11-27-raise-governance-rule-budgets.md` ➔ exit `0` (`SECTIONS 7/7`, `106/106` `LINE_REF`, `CRITIC_REQUIRED yes`, `CRITIC_FLOOR 3 findings`, `0 failures, 0 warnings`)
  - `npm run type-check` ➔ exit `0`
  - `npx tsc --showConfig` ➔ exit `0` (`allowJs: true`, `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`)
  - `npm run lint` ➔ exit `0`
  - `npx eslint --print-config scripts/verify-docs.mjs` ➔ exit `0` (`no-undef: [2]`, `no-unused-vars: [2]`, `ecmaVersion: 2026`)
  - `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` ➔ exit `0` (`132 passed`)
  - `node scripts/verify-docs.mjs --strict-shorthand` ➔ exit `1` (`[1/5]`–`[4/5]` PASS; `[5/5]` FAIL do nợ dung lượng `CHANGELOG.md` có sẵn `128,575` bytes)
  - `git status` ➔ exit `0`
  - `git log --oneline -n 5` ➔ exit `0`

#### 4. Kết Luận

Phiên Independent Critic Pass đã đối chiếu độc lập toàn bộ mã nguồn, cấu hình biên dịch/lint, test harness, và đặc tả Antigravity 2026; không phát hiện lỗi `[BLOCKER]` hoặc `[MAJOR]` còn sót (chỉ có 2 lưu ý triển khai mức `[MINOR]` ở Critic Findings #1 và #2). Xác nhận `CRITIC_VERDICT: AGREE`, cập nhật Header sang `- **Status**: Approved`, và cấp thẻ phê duyệt triển khai.

[PLAN_APPROVED]
