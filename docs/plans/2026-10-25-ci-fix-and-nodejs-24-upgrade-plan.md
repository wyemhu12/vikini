# Kế Hoạch Triển Khai: Sửa Lỗi CI ENOENT `.claude/settings.local.json` & Nâng Cấp GitHub Actions Lên Runtime Node.js 24

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-25
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

**Mục tiêu**

1. **G1 — Sửa lỗi CI**: Test `TC-H & TC-I` trong `.agents/scripts/code-freeze-guard.test.ts:1878` ném `ENOENT: no such file or directory, open '.../.claude/settings.local.json'` tại dòng `1925–1928` trên runner `ubuntu-latest`. Root cause: file này là cấu hình **per-developer, bị gitignore** (`git status --ignored` trả `!! .claude/settings.local.json`) nên không tồn tại sau `actions/checkout`. Sửa bằng cách đọc file theo kiểu _optional_ (vắng mặt ⇒ nội dung rỗng, tức không chứa quyền bị cấm), **giữ nguyên số `expect()` và độ mạnh matcher** (Test Failure Triage **Loại B — Test Harness Issue**).
2. **G2 — Nâng cấp GitHub Actions**: `actions/checkout@v4` và `actions/setup-node@v4` đều khai báo `runs.using: node20`; GitHub đã gỡ Node 20 khỏi runner từ 2026-09-23. Nâng lên `actions/checkout@v5` và `actions/setup-node@v5` (`runs.using: node24`).
3. **G3 — Một nguồn sự thật cho phiên bản Node.js dự án**: Thay `node-version: 24` hard-code trong `ci.yml` bằng `node-version-file: .nvmrc` (`.nvmrc` đã là `24`), để CI, máy dev và `engines.node: "24.x"` không lệch nhau.
4. **G4 — Living docs**: Cập nhật `docs/CHANGELOG.md` và `docs/lessons-learned.md` (Post-Fix Protocol).

**Out of Scope (KHÔNG làm)**

- **KHÔNG** sửa `tsconfig.json` (`target: "ES2017"`, `lib: ["dom","dom.iterable","esnext"]`): `noEmit: true` + Next.js 16 dùng SWC/Turbopack để transpile, nên `target` chỉ ảnh hưởng type-check; `lib` đã là `esnext` (bao trùm mọi API Node 24 / ES2024). Đổi `target` không mang lại lợi ích chức năng, là `TEST_INFRA_FILES` nhạy cảm, và nằm ngoài root cause → "if applicable" được đánh giá là **không áp dụng**.
- **KHÔNG** sửa `.nvmrc` (đã là `24`), `package.json` (`engines.node: "24.x"`, `@types/node: ^24.10.4` đã đúng), `docs/architecture.md` (đã ghi `Runtime: Node.js 24.x`).
- **KHÔNG** sửa `.claude/settings.local.json`, `.gitignore`, `.claude/**` (PROTECTED_INFRA) và **KHÔNG** commit file local settings vào repo (nó chứa allowlist riêng của từng dev).
- **KHÔNG** nâng lên `actions/checkout@v6` / `setup-node@v6`: Task Brief chỉ định `@v5`; v5 đã chạy `node24` nên đủ giải quyết G2 với rủi ro nhỏ nhất. (Ghi nhận ở §10 như hướng nâng cấp sau.)
- **KHÔNG** sửa `.agents/scripts/code-freeze-guard.js` hay bất kỳ logic guard nào; **KHÔNG** thêm `.skip`/`.skipIf`/`.runIf`/`try {}` vào test.
- **KHÔNG** thêm bước `npm run build` hay matrix nhiều phiên bản Node vào CI.

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                                                                                               | Nội dung rút ra                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                                                                                                | Cấm mutating git; co-located tests bắt buộc cho `.agents/scripts/`; Knowledge Freshness.                                                      |
| `.agents/rules/02-quality.md:53-63`                                                                                       | Test Failure Triage: lỗi này là **Loại B** ⇒ được sửa harness, cấm giảm `expect()`/nới matcher/thêm `.skipIf`.                                |
| `.agents/rules/02-quality.md:76-79`                                                                                       | Post-Fix 5 bước: `npm run verify`, ghi `docs/lessons-learned.md`, cập nhật `docs/CHANGELOG.md`.                                               |
| `.agents/rules/05-plan-review.md`                                                                                         | Test files + `.agents/**` là danh mục nhạy cảm (luôn `ask`) ⇒ bước sửa test cần user xác nhận dù plan đã Approved.                            |
| `.agents/agents/reviewer/evidence-bar.md` §4.5.3–4.5.4                                                                    | Cần Wiring + Negative Probe; rủi ro Cao/TB phải map tới control có `[SRC]`/`[CMD]`.                                                           |
| `.agents/scripts/code-freeze-guard.test.ts:1878-1962`                                                                     | Test `TC-H & TC-I`, đoạn đọc `settings.local.json` tại `1925-1931`.                                                                           |
| `.agents/scripts/code-freeze-guard.js:248-321`                                                                            | `assessTestIntegrity` — các tín hiệu "weakening" (fewer `expect`, `.skip/.only/.todo/xit/fit/.skipIf/.runIf/.fails`, relax matcher, `try {`). |
| `.github/workflows/ci.yml:1-35`                                                                                           | `checkout@v4`, `setup-node@v4`, `node-version: 24`, `cache: npm`.                                                                             |
| `.nvmrc:1`, `tsconfig.json:3,24`, `package.json:91,119-120`                                                               | Đã ở Node 24; `target: ES2017`, `lib: esnext`.                                                                                                |
| `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:98`                                                 | Next.js 16 yêu cầu Node ≥ 20.9 ⇒ Node 24 hợp lệ.                                                                                              |
| `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopackPluginRuntimeStrategy.md:41-49` | Lỗi worker-thread teardown trên Node ≥ 24.13.1 chỉ ảnh hưởng `workerThreads` (mặc định là `childProcesses`).                                  |
| `docs/lessons-learned.md:46`                                                                                              | Tiền lệ: test pass trên Windows nhưng fail trên Ubuntu CI ⇒ bài học "local-only state".                                                       |

**Skills Loaded & Applied**

| SKILL.md                                                                   | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/skills/vikini-debug/SKILL.md` (Part 1 Phase 1–5, Part 2 Post-Fix) | Xác nhận root cause trước khi sửa (file bị gitignore ⇒ vắng trên clean checkout); fix tận gốc ở harness thay vì commit file local; bắt buộc ghi `docs/lessons-learned.md` + `docs/CHANGELOG.md`. |

Không chạm API route / SSE / migration / translation / feature mới ⇒ không nạp `api-patterns`, `streaming-patterns`, `database-migration`, `add-translation`, `add-feature`.

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định                                                                                                                                                                   | Dẫn chứng                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | `.claude/settings.local.json` bị gitignore ⇒ không có trên CI.                                                                                                             | `[CMD]` `git status --ignored --short .claude` ⇒ `!! .claude/settings.local.json`                                                                                                    |
| A2  | Mọi file khác mà test `TC-H & TC-I` đọc (`.claude/settings.json`, `.claude/skills/vikini-*/SKILL.md`, `CLAUDE.md`, `.gitignore`) đều được track.                           | `[CMD]` cùng lệnh trên chỉ liệt kê `settings.local.json` và 3 skill không phải `vikini-*` là ignored; `[SRC]` `.gitignore:53-54` (`.claude/skills/*` + `!.claude/skills/vikini-*/`). |
| A3  | Biểu thức ternary + `fs.existsSync` không kích hoạt tín hiệu nào của `assessTestIntegrity`.                                                                                | `[SRC]` `.agents/scripts/code-freeze-guard.js:260-319` — chỉ đếm `expect(`, `.skip/.only/.todo/.skipIf/.runIf/.fails`, `xit/fit`, matcher strict/loose, `try {`.                     |
| A4  | `actions/checkout@v4` và `actions/setup-node@v4` chạy `node20`; `@v5` chạy `node24`.                                                                                       | `[URL]` `raw.githubusercontent.com/actions/{checkout,setup-node}/{v4,v5}/action.yml` (`runs.using`).                                                                                 |
| A5  | `setup-node@v5` bật auto-cache chỉ khi `package.json` có trường `packageManager`; Vikini không có ⇒ hành vi cache không đổi, vẫn dùng `cache: npm` tường minh.             | `[URL]` setup-node v5 `action.yml` input `package-manager-cache`; `[CMD]` Grep `packageManager` trong `package.json` ⇒ 0 kết quả.                                                    |
| A6  | `setup-node` hỗ trợ `node-version-file: .nvmrc`.                                                                                                                           | `[URL]` setup-node v5 `action.yml` / README.                                                                                                                                         |
| A7  | `REPO_ROOT` trong test được suy ra từ vị trí `code-freeze-guard.js` ⇒ chạy test trong một bản clone tạm sẽ đọc `.claude/` **của bản clone** (dùng cho CI-parity probe §9). | `[SRC]` `.agents/scripts/code-freeze-guard.test.ts:13` import `REPO_ROOT` từ `./code-freeze-guard.js`.                                                                               |

**Cross-Task Dependencies**: Không phụ thuộc plan nào khác. Plan `2026-10-25-novelcrafter-sudowrite-refactor-and-ui-audit-implementation-plan.md` cùng nhóm ngày: Reviewer/Orchestrator cần đảm bảo plan đó đã `Completed` hoặc `Approved` để Plan Scope Guard không bị khóa fail-safe (§5 `05-plan-review.md`).

**`[NEEDS_PRODUCT_DECISION]`**: Không có.

### 4. Bảng Verified Versions

| Công cụ               | Hiện tại (`[SRC]`)                                           | Mục tiêu            | Nguồn 2026 (`[URL]`)                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions/checkout`    | `@v4` (`ci.yml:16`, `node20`)                                | `@v5` (`node24`)    | https://github.com/actions/checkout/releases · https://raw.githubusercontent.com/actions/checkout/v5/action.yml                                                                         |
| `actions/setup-node`  | `@v4` (`ci.yml:19`, `node20`)                                | `@v5` (`node24`)    | https://github.com/actions/setup-node/releases · https://raw.githubusercontent.com/actions/setup-node/v5/action.yml                                                                     |
| GitHub runner Node 20 | —                                                            | Đã bị gỡ 2026-09-23 | https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/ · https://github.blog/changelog/2026-09-23-deprecation-of-node-20-on-github-actions-runners/ |
| Node.js (dự án)       | `.nvmrc:1` = `24`; `package.json:120` `engines.node: "24.x"` | Giữ nguyên          | https://nodejs.org/en/about/previous-releases                                                                                                                                           |
| `@types/node`         | `^24.10.4` (`package.json:91`)                               | Giữ nguyên          | —                                                                                                                                                                                       |
| Next.js               | `^16.4.0` (`package.json:64`), min Node 20.9                 | Giữ nguyên          | `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:98`                                                                                                               |
| TypeScript            | `^5.9.3` (`package.json:115`)                                | Giữ nguyên          | —                                                                                                                                                                                       |
| Vitest                | `^4.1.12` (`package.json:117`)                               | Giữ nguyên          | —                                                                                                                                                                                       |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `.agents/scripts/code-freeze-guard.test.ts` — đọc optional `.claude/settings.local.json` (dòng `1925-1931`) + 1 assertion tự kiểm cho helper. _(Danh mục nhạy cảm (d)+(e) ⇒ hook trả `ask`, cần user xác nhận.)_
- `[MODIFY]` `.github/workflows/ci.yml` — `checkout@v5`, `setup-node@v5`, `node-version-file: .nvmrc`.
- `[MODIFY]` `docs/CHANGELOG.md` — entry mới ở đầu.
- `[MODIFY]` `docs/lessons-learned.md` — entry "gitignored local-only file read in test".

### 6. Caller-First Design Sketch

**Phía test (`.agents/scripts/code-freeze-guard.test.ts`, thay thế dòng `1925-1931`)**

```ts
// .claude/settings.local.json is a gitignored, per-developer file: absent on clean CI checkouts.
const readOptionalText = (filePath: string): string =>
  fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

expect(readOptionalText(path.join(REPO_ROOT, ".claude", "__missing__.json"))).toBe("");

const localSettings = readOptionalText(path.join(REPO_ROOT, ".claude", "settings.local.json"));
for (const banned of ["git add", "git commit", "git push", "git checkout", "deep-research"]) {
  expect(localSettings).not.toContain(banned);
}
```

- Ngữ nghĩa giữ nguyên: "nếu dev có local settings, nó KHÔNG được cấp quyền mutating git / deep-research". File vắng ⇒ không cấp quyền nào ⇒ assertion đúng một cách hợp lệ (không phải bypass).
- `expect()` count: tăng +1 (không giảm); matcher `not.toContain` giữ nguyên; thêm `toBe` (strict) ⇒ `assessTestIntegrity` không phát tín hiệu.

**Phía CI (`.github/workflows/ci.yml`)**

```yaml
- name: Checkout
  uses: actions/checkout@v5

- name: Setup Node.js
  uses: actions/setup-node@v5
  with:
    node-version-file: .nvmrc
    cache: npm
```

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **S1** Baseline: `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` (local, file có mặt) ⇒ ghi nhận PASS.
- [ ] **S2** CI-parity reproduce (trước khi sửa, xem §9 Probe P1) ⇒ ghi nhận đúng lỗi `ENOENT ... settings.local.json`.
- [ ] **S3** Sửa `.agents/scripts/code-freeze-guard.test.ts:1925-1931` theo §6 (user xác nhận prompt `ask` của Test Integrity Guard; header hook phải không liệt kê weakening signal).
- [ ] **S4** Sửa `.github/workflows/ci.yml:16,19-21` theo §6.
- [ ] **S5** Chạy lại P1 (clone tạm, không có local settings) ⇒ PASS; chạy P2 (Negative Probe) ⇒ FAIL đúng chỗ.
- [ ] **S6** `npm run type-check; npm run lint; npm run test:run` (= `npm run verify`).
- [ ] **S7** Cập nhật `docs/lessons-learned.md` + `docs/CHANGELOG.md`.
- [ ] **S8** Dọn bản clone tạm (`Remove-Item -Recurse -Force $env:TEMP\vikini-ci-probe`, xóa junction trước — xem §10 R3).
- [ ] **S9** Đổi Header plan sang `- **Status**: Completed`.
- [ ] **S10** (Sau khi user commit/push) Xác nhận GitHub Actions run `Verify` xanh và log không còn cảnh báo Node 20 cho `checkout`/`setup-node`.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID   | Input / Trạng thái                                                                                                                        | Output mong đợi                                                                                                              | Pass / Fail                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| TC-1 | `.claude/settings.local.json` **vắng** (clean checkout / CI)                                                                              | Test `TC-H & TC-I` PASS, không `ENOENT`                                                                                      | Fail nếu ném `ENOENT` hoặc test bị skip        |
| TC-2 | File **có mặt**, không chứa chuỗi cấm (máy dev hiện tại)                                                                                  | PASS                                                                                                                         | Fail nếu đổi hành vi so với baseline S1        |
| TC-3 | File **có mặt**, chứa `"Bash(git push:*)"` (hoặc bất kỳ chuỗi trong `["git add","git commit","git push","git checkout","deep-research"]`) | FAIL với thông báo `expected '…' not to contain 'git push'`                                                                  | Probe thất bại (spec gaming) nếu test vẫn PASS |
| TC-4 | `readOptionalText` với path không tồn tại                                                                                                 | Trả `""` (strict `toBe("")`)                                                                                                 | Fail nếu ném lỗi                               |
| TC-5 | Diff của test file qua `assessTestIntegrity(old, new)`                                                                                    | `[]` (không fewer-expect, không `.skip/.skipIf/.runIf/.fails`, không `try {`)                                                | Fail nếu có bất kỳ signal                      |
| TC-6 | `ci.yml`                                                                                                                                  | Chỉ `checkout@v5`, `setup-node@v5`, `node-version-file: .nvmrc`, `cache: npm`; không còn `@v4`, không còn `node-version: 24` | Fail nếu còn tham chiếu `@v4`                  |
| TC-7 | CI run trên GitHub                                                                                                                        | Job `Type Check + Lint + Test` xanh; `node --version` trong bước setup in `v24.x`                                            | Fail nếu đỏ hoặc Node khác 24                  |

**Boundary**: file local tồn tại nhưng rỗng ⇒ PASS (rỗng không cấp quyền). File là thư mục/không đọc được ⇒ `readFileSync` ném lỗi (giữ fail-loud, không nuốt lỗi — không dùng `try/catch`).

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

- **Co-located test**: Chính `.agents/scripts/code-freeze-guard.test.ts` (không có logic production mới trong `.agents/scripts/`; chỉ sửa harness).
- **Lệnh tổng**: `npm run type-check; npm run lint; npm run test:run`.
- **Lệnh scoped**: `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot`.

**Wiring Probes**

- **W1 (TC-2)**: Lệnh scoped trên repo thật ⇒ exit 0.
- **W2 (TC-6)**: `Select-String -Path .github/workflows/ci.yml -Pattern '@v4','node-version:'` ⇒ không khớp; `Select-String ... -Pattern 'checkout@v5','setup-node@v5','node-version-file: .nvmrc'` ⇒ 3 khớp.
- **W3 (TC-5)**: Header của hook Test Integrity Guard khi ghi file test ở S3 không liệt kê signal nào (hook gọi `assessTestIntegrity`).

**CI-Parity Probe P1 (TC-1)** — mô phỏng clean checkout mà **không** đụng file local thật (lệnh ngoài allowlist ⇒ user xác nhận):

```powershell
git clone --quiet . "$env:TEMP\vikini-ci-probe"
Copy-Item .agents/scripts/code-freeze-guard.test.ts "$env:TEMP\vikini-ci-probe\.agents\scripts\" -Force   # chỉ sau S3
New-Item -ItemType Junction -Path "$env:TEMP\vikini-ci-probe\node_modules" -Target "$PWD\node_modules"
Push-Location "$env:TEMP\vikini-ci-probe"; npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot; Pop-Location
```

- Trước S3 (không Copy-Item): kỳ vọng FAIL `ENOENT … settings.local.json` (tái hiện lỗi CI).
- Sau S3: kỳ vọng PASS. (Clone không mang theo file gitignored ⇒ đúng điều kiện CI — A1, A7.)
- Lưu ý: clone lấy `HEAD`; các file đang sửa dở khác trong working tree (UI novelcrafter/chat) không ảnh hưởng test này.

**Negative Probe P2 (TC-3)** — chứng minh guard vẫn bắt quyền cấm:

```powershell
Set-Content -Encoding utf8 "$env:TEMP\vikini-ci-probe\.claude\settings.local.json" '{"permissions":{"allow":["Bash(git push:*)"]}}'
Push-Location "$env:TEMP\vikini-ci-probe"; npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot; Pop-Location
```

- Kỳ vọng: exit ≠ 0, `TC-H & TC-I` fail với `not to contain 'git push'`. Nếu PASS ⇒ fix bị spec gaming ⇒ `[QA_FAILED]`.

**Negative Probe P3 (TC-4)**: assertion `readOptionalText(.../__missing__.json) === ""` nằm trong test, chạy ở W1/P1.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                          | Mức        | Phòng ngừa / Control                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Fix "optional read" bị coi là hạ chuẩn test (bỏ qua kiểm tra quyền cấm).                        | Trung bình | Giữ nguyên vòng lặp `not.toContain` + thêm `toBe("")`; control `assessTestIntegrity` (`[SRC]` `.agents/scripts/code-freeze-guard.js:248-321`) kiểm qua W3/TC-5; Negative Probe P2 chứng minh vẫn bắt `git push`. |
| R2  | Sau khi hết lỗi ENOENT, test khác trong cùng file lại đọc file local-only khác và fail trên CI. | Trung bình | A2 (`[CMD]` `git status --ignored` chỉ liệt kê `settings.local.json` + skill không phải `vikini-*`; `[SRC]` `.gitignore:53-54`); CI-Parity Probe P1 chạy **toàn bộ** file test trong clone sạch trước khi push.  |
| R3  | `Remove-Item -Recurse` trên clone tạm đi theo junction và xóa `node_modules` thật.              | Trung bình | S8: xóa junction trước bằng `(Get-Item "$env:TEMP\vikini-ci-probe\node_modules").Delete()` rồi mới `Remove-Item -Recurse -Force`; xác minh `Test-Path .\node_modules\vitest` = `True` sau dọn dẹp.               |
| R4  | `setup-node@v5` thay đổi hành vi cache (auto-cache theo `packageManager`).                      | Thấp       | A5: không có `packageManager` trong `package.json`; vẫn giữ `cache: npm` tường minh.                                                                                                                             |
| R5  | `node-version-file: .nvmrc` resolve khác `24.x` (ví dụ file rỗng/sai).                          | Thấp       | `.nvmrc:1` = `24`; TC-7 kiểm `v24.x` trong log CI.                                                                                                                                                               |
| R6  | Node ≥ 24.13.1 worker-thread teardown abort trong Turbopack.                                    | Thấp       | CI không chạy `next build`; `next.config.ts` không đặt `turbopackPluginRuntimeStrategy` (`[CMD]` Grep = 0) ⇒ mặc định `childProcesses`, không bị ảnh hưởng (`turbopackPluginRuntimeStrategy.md:41-49`).          |
| R7  | Bỏ lỡ `checkout@v6`/`setup-node@v6` mới hơn.                                                    | Thấp       | Ngoài scope theo Task Brief; v5 đã giải quyết Node 20 removal. Đề xuất task riêng nếu cần.                                                                                                                       |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Kiểm Chứng Lỗi Cũ

Không có lỗi cũ từ Audit Run trước; đây là lượt thẩm định đầu tiên (Audit Run 1).

#### 2. Phát Hiện Mới

- `[MINOR]` **Lưu ý kích thước `docs/CHANGELOG.md` khi cập nhật S7**:
  - **Mô tả**: Kiểm tra bằng lệnh cho thấy `docs/CHANGELOG.md` hiện tại có kích thước 36,510 bytes, vượt ngưỡng 35,000 bytes trong script kiểm thử `scripts/verify-docs.mjs:266` (`[CMD]` `node scripts/verify-docs.mjs` trả mã lỗi 1).
  - **Khuyến nghị**: Khi executor thực hiện bước S7 (cập nhật `docs/CHANGELOG.md`), nên chuyển các entry cũ (trước ngày 2026-10-19) sang `docs/archive/CHANGELOG-legacy.md` để đưa kích thước file về dưới 35,000 bytes, bảo đảm `node scripts/verify-docs.mjs` pass.

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Probe 1 — Tấn công làm suy yếu bài test (Spec Gaming qua Optional Read)**:
   - _Mục tiêu_: Thử nghiệm việc thay `fs.readFileSync` trực tiếp bằng helper `readOptionalText` (trả về `""` khi vắng file) có tạo lỗ hổng cho phép bỏ qua kiểm tra quyền cấm trên môi trường dev hay CI không.
   - _Kết quả_: Thất bại. Trên CI sạch (`ubuntu-latest`), file `.claude/settings.local.json` bị gitignore (`[CMD]` `git status --ignored --short .claude` trả `!! .claude/settings.local.json`), do đó runner CI không hề có file cấu hình local này. Khi file vắng mặt, nội dung `""` không chứa bất kỳ chuỗi cấm nào trong `["git add", "git commit", "git push", "git checkout", "deep-research"]`. Trên máy dev, file tồn tại (`[SRC]` `.claude/settings.local.json:1-14`), assertion vẫn chạy đầy đủ. Negative Probe P2 chứng minh nếu file chứa quyền bị cấm như `Bash(git push:*)`, test lập tức ném lỗi AssertionError.
2. **Probe 2 — Tấn công kích hoạt tín hiệu suy yếu của Test Integrity Guard (`assessTestIntegrity`)**:
   - _Mục tiêu_: Thử nghiệm xem diff của test file có vi phạm các quy tắc suy yếu test tại `assessTestIntegrity` trong `.agents/scripts/code-freeze-guard.js:248-321` không.
   - _Kết quả_: Thất bại. Đoạn code sửa đổi không làm giảm số lượng `expect` (`expectDelta = +1` do bổ sung `expect(readOptionalText(...)).toBe("")`), không bổ sung cờ bỏ qua (`.skip`, `.only`, `.todo`, `xit`, `fit`, `.skipIf`, `.runIf`, `.fails`), không nới lỏng matcher sang loose, và không sử dụng `try/catch` (dùng toán tử ba ngôi `fs.existsSync(...) ? ... : ...`). Diff thỏa mãn 100% tiêu chuẩn toàn vẹn test.
3. **Probe 3 — Tấn công xung đột runtime Node 24 và tính năng auto-cache của `setup-node@v5`**:
   - _Mục tiêu_: Thử nghiệm nâng cấp `actions/checkout@v5` và `actions/setup-node@v5` kèm `node-version-file: .nvmrc` có gây xung đột phiên bản hoặc lỗi cache trên CI không.
   - _Kết quả_: Thất bại. Tra cứu tài liệu và changelog chính thức (`[URL]`) xác nhận GitHub đã gỡ bỏ hoàn toàn runtime Node 20 trên GitHub-hosted runners vào tháng 09/2026. `actions/checkout@v5` và `actions/setup-node@v5` chạy nội bộ trên Node 24 (`runs.using: node24`). File `.nvmrc:1` chứa `24` đồng bộ với `package.json:120` (`engines.node: "24.x"`). Việc giữ nguyên `cache: npm` tường minh ngăn chặn mọi thay đổi ngoài ý muốn từ cơ chế tự động phát hiện cache của `v5`.
4. **Probe 4 — Tấn công xóa đệ quy junction trên Windows làm mất `node_modules` gốc**:
   - _Mục tiêu_: Thử nghiệm việc chạy CI-Parity Probe P1 tạo junction `$env:TEMP\vikini-ci-probe\node_modules` trỏ tới `node_modules` gốc có nguy cơ làm xóa thư mục `node_modules` thật khi dọn dẹp không.
   - _Kết quả_: Thất bại. Kế hoạch đã có rào chắn kỹ thuật tại §7 S8 và §10 R3: yêu cầu xóa junction bằng `(Get-Item ...\node_modules).Delete()` trước khi gọi `Remove-Item -Recurse -Force`, kèm bước kiểm tra xác nhận `Test-Path .\node_modules\vitest` trả về `True`.

#### 4. Plan Completeness Gate & Mental Simulation Matrix

| Hạng mục / Kịch bản                      | Trạng thái | Loại bằng chứng | Chi tiết kiểm chứng                                                                            |
| :--------------------------------------- | :--------: | :-------------: | :--------------------------------------------------------------------------------------------- |
| **G1: Verified Versions**                |   `PASS`   |     `[URL]`     | `actions/checkout@v5` và `actions/setup-node@v5` chạy `node24`; GitHub gỡ Node 20 từ 2026-09.  |
| **G2: Sequential Checklist**             |   `PASS`   |     `[SRC]`     | Checklist tuần tự từ S1 tới S10 với đầy đủ nhãn `[MODIFY]` tại §5 và §7.                       |
| **G3: Verification Plan**                |   `PASS`   |     `[CMD]`     | Đầy đủ lệnh verify tổng, scoped, wiring probes (W1–W3) và negative probes (P1–P3).             |
| **G4: Test Contract**                    |   `PASS`   |     `[SRC]`     | 7 test contract (TC-1 tới TC-7) định nghĩa rõ input, output, fail mode và boundary.            |
| **G5: Assumptions & Dependencies**       |   `PASS`   | `[CMD]`/`[SRC]` | 7 giả định A1–A7 kiểm chứng qua git và code; không có giả định treo.                           |
| **G6: Out of Scope**                     |   `PASS`   |     `[SRC]`     | Liệt kê rõ ràng những gì không làm tại §1 (không đổi tsconfig, không commit settings.local).   |
| **G7: Skills Loaded & Applied**          |   `PASS`   |     `[SRC]`     | Áp dụng `.agents/skills/vikini-debug/SKILL.md` (chu trình 5 bước xác định root cause).         |
| **S1: Cold-start & Build**               |   `PASS`   |     `[CMD]`     | `npm run type-check` exit code 0 (`tsc --noEmit`). Không phụ thuộc env mới.                    |
| **S2: Runner Lifecycle & Teardown**      |   `PASS`   |     `[SRC]`     | Cơ chế dọn dẹp junction an toàn trong probe P1 được đặc tả chi tiết tại S8 & R3.               |
| **S3: Database & Temporal Logic**        |   `N/A`    |     `[SRC]`     | Không có can thiệp hoặc thay đổi tới cơ sở dữ liệu Supabase hay thời gian.                     |
| **S4: Cross-Task State Flow**            |   `PASS`   |     `[SRC]`     | Plan cùng ngày `2026-10-25-novelcrafter...` đã có trạng thái `Completed`, không kẹt fail-safe. |
| **S5: Security Boundary & 3-Tier Auth**  |   `PASS`   |     `[ADV]`     | Assertion kiểm soát quyền cấm giữ nguyên độ chặt; không bypass được `git push`.                |
| **S6: External Resilience & Serverless** |   `PASS`   |     `[URL]`     | Cấu hình GitHub Actions CI tương thích với chính sách deprecation Node 20 của GitHub.          |
| **Domain: CI & Governance Guard**        |   `PASS`   | `[SRC]`/`[CMD]` | Thay đổi test file được gắn nhãn nhạy cảm, hook Test Integrity Guard không báo lỗi.            |

#### 5. Adversarial Timelines & Commands Executed

##### Adversarial Timelines (4 Trục Đối Kháng)

- **Trục 1 (Đồng thời)**: `N/A` — Quy trình CI GitHub Actions chạy độc lập theo từng commit/PR; test runner Vitest chạy đơn lập; thao tác đọc cấu hình local là đồng bộ (`readFileSync`/`existsSync`).
- **Trục 2 (Khoảng trống check→use / TOCTOU)**:
  - _Cơ chế_: `fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : ""`
  - _Timeline_: T1: Vitest kiểm tra `existsSync` của `.claude/settings.local.json` trả về true | T2: File bị tiến trình ngoài xóa ngay trước dòng đọc | T3: `readFileSync` lập tức ném lỗi `ENOENT` (fail-loud), bài test báo đỏ rõ ràng thay vì bỏ qua âm thầm.
  - _Kết cục_: AN TOÀN (Fail-loud).
- **Trục 3 (Thất bại giữa chừng & dọn dẹp)**:
  - _Cơ chế_: Dọn dẹp bản clone tạm `$env:TEMP\vikini-ci-probe`
  - _Timeline_: T1: Runner tạo bản clone tạm và junction trỏ vào `node_modules` gốc | T2: Quá trình kiểm thử bị ngắt đột ngột (abort/crash) trước khi tới bước S8 | T3: Thư mục repo chính vẫn nguyên vẹn không bị ảnh hưởng do junction chỉ đọc; bản clone tạm nằm trong `$env:TEMP` sẽ được OS hoặc phiên sau dọn dẹp.
  - _Kết cục_: AN TOÀN.
- **Trục 4 (Môi trường serverless)**: `N/A` — Luồng kiểm thử CI thực thi trên máy ảo Ubuntu (`ubuntu-latest`), không phải môi trường serverless runtime.

##### Commands Executed

1. `git status --ignored --short .claude` (exit 0 — xác nhận `.claude/settings.local.json` bị gitignore)
2. `npm run type-check` (exit 0 — xác nhận baseline TypeScript biên dịch sạch)
3. `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` (exit 0 — 128/128 tests pass trên máy dev hiện tại)
4. `git ls-files .claude/settings.json` (exit 0 — xác nhận `settings.json` được track)
5. `git ls-files CLAUDE.md` (exit 0 — xác nhận `CLAUDE.md` được track)
6. `git ls-files .claude/skills` (exit 0 — xác nhận 4 stub skills được track)
7. `node scripts/verify-docs.mjs` (exit 1 — phát hiện kích thước `CHANGELOG.md` hiện tại vượt 35,000 bytes, đã lập khuyến nghị MINOR)

#### 6. Kết Luận & Quyết Định Phê Duyệt

Kế hoạch đáp ứng đầy đủ 7 hạng mục Completeness Gate, vượt qua 4 Attack Probes đối kháng và 6 kịch bản Mental Simulation. Không có lỗi `[BLOCKER]` hoặc `[MAJOR]`.

Căn cứ quy chế tại `.agents/rules/05-plan-review.md`, bản kế hoạch chính thức được phê duyệt để tiến hành triển khai.

[PLAN_APPROVED]
