# Implementation Plan: Fix Linux CI Failures (`VQ-04`, `VQ-15`) in `visual-qa-runner.mjs` & ESLint `curly` Warning in `googleDocsResolver.server.ts`

- **Date**: 2026-11-22
- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Status**: Completed
- **Revision**: 2
- **Target Branch / Scope**: Cross-platform path handling in `scripts/visual-qa-runner.mjs` + co-located tests (`scripts/visual-qa-runner.test.ts`), ESLint `curly` compliance in `src/lib/features/chat/googleDocsResolver.server.ts` + co-located test (`src/lib/features/chat/googleDocsResolver.server.test.ts`), and `/post-fix` documentation (`docs/lessons-learned.md`, `docs/CHANGELOG.md`).
- **Independent Critic Gate**: Plan declares `[MODIFY]` on `src/lib/features/chat/googleDocsResolver.server.ts` (`*.server.ts`), which triggers `CRITIC_REQUIRED yes` (`scripts/verify-plan.mjs:225`). After Primary `@reviewer` completes Audit Run, Status transitions to `Awaiting Critic` pending a fresh Independent Critic Pass.

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục Tiêu (Goal)

Khắc phục triệt để 2 lỗi unit test thất bại trên GitHub Actions `ubuntu-latest` CI (`.github/workflows/ci.yml:12,34`), 2 khiếm khuyết tiềm ẩn phụ thuộc OS liên đới trong `scripts/visual-qa-runner.mjs`, và 1 cảnh báo ESLint `curly` trong `src/lib/features/chat/googleDocsResolver.server.ts`:

1. **Sửa tận gốc lỗi `VQ-04` (`scripts/visual-qa-runner.test.ts:221-230`) & dotfile-backslash trên Linux**:
   - Chuẩn hóa phân cách đường dẫn sang POSIX (`toPosix(s)`) trước khi gọi `checkSecretAndExt`, `path.isAbsolute`, và `path.resolve` trong `validateScriptPath` (`scripts/visual-qa-runner.mjs:163-189`), khớp hoàn toàn với mẫu đã hoạt động ổn định tại `.agents/scripts/guard-paths.js:47`.
   - Đổi `path.extname(p)` sang `path.posix.extname(toPosix(p))` trong `checkSecretAndExt` (`scripts/visual-qa-runner.mjs:141-148`) để chặn nhất quán cả dotfile kiểu Windows (`"tests\\.js"`) trên Linux.
2. **Sửa tận gốc lỗi `VQ-15` (`scripts/visual-qa-runner.test.ts:771-777`) & đối xứng cross-platform trong `isMainModule`**:
   - Cập nhật JSDoc `@param {string | undefined} metaUrl` (`scripts/visual-qa-runner.mjs:526`) và hàm `isMainModule(metaUrl, argv1, platform)` (`scripts/visual-qa-runner.mjs:527-533`) để tôn trọng tuyệt đối tham số `platform`: chọn `path.win32` + kiểm tra gốc tuyệt đối Windows (`/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/`) + `pathToFileURL(normalized, { windows: true })` khi `platform === "win32"`, và chặn tiền tố ổ đĩa `/^[A-Za-z]:[\\/]/` + chọn `path.posix` + kiểm tra `resolved.startsWith("/")` + `pathToFileURL(normalized, { windows: false })` khi `platform !== "win32"`, bọc `try/catch` fail-closed.
3. **Sửa đường dẫn trộn phân cách trong `killProcessTree` (`scripts/visual-qa-runner.mjs:260-265`)**:
   - Đổi `path.join(...)` thành `path.win32.join(...)` trong nhánh `platform === "win32"` để trên Linux CI khi giả lập `win32` không sinh chuỗi sai chuẩn `"C:\\Windows/System32/taskkill.exe"`, đồng thời siết chặt assertion `VQ-09` (`scripts/visual-qa-runner.test.ts:418-422`).
4. **Sửa cảnh báo ESLint `curly` (`src/lib/features/chat/googleDocsResolver.server.ts:420-421`)**:
   - Bọc khối `{ ... }` cho câu lệnh `if (isHtmlPayload(xlsxRes.contentType, xlsxRes.bytes))` nhiều dòng để đạt 0 ESLint warnings (`.agents/rules/01-coding.md:17`, `eslint.config.mjs:91`) và tương thích 100% với `prettier --check` (`printWidth: 100`, `.prettierrc:5`), kèm bổ sung test case co-located chứng minh hành vi nhánh này không đổi.
5. **Hoàn tất `/post-fix` theo `.agents/skills/vikini-debug/SKILL.md`**:
   - Mở rộng unit tests co-located phủ hai chiều cross-platform (simulated `win32` trên Linux & simulated `linux` trên Windows, ký tự đặc biệt/khoảng trắng, backslash attacks), ghi bài học vào `docs/lessons-learned.md` và cập nhật `docs/CHANGELOG.md`.

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** hạ chuẩn, xóa, skip, hoặc nới lỏng bất kỳ assertion nào của `VQ-04`, `VQ-15`, `VQ-01..VQ-15`, hay `TC-GD-04..TC-GD-12` (sửa hoàn toàn theo **Loại A — Code Bug**).
- **KHÔNG** thay đổi cấu hình ESLint (`eslint.config.mjs`), TypeScript (`tsconfig.json`), Vitest (`vitest.config.ts`), Prettier (`.prettierrc`), hay GitHub Actions workflow (`.github/workflows/ci.yml`).
- **KHÔNG** sửa đổi bất kỳ quy tắc quản trị nào trong `.agents/**` (chưa đạt ngưỡng 3 lần lặp cùng pattern `path`/`pathToFileURL` để promote rule).
- **KHÔNG** sửa đổi logic nghiệp vụ, chính sách SSRF, byte caps, hay interface công khai của `googleDocsResolver.server.ts` ngoài việc thêm dấu `{}` tại dòng `420-421`.
- **KHÔNG** đụng tới `scripts/verify-plan.mjs` (đã chuẩn hóa `replace(/\\/g, "/")` tại `scripts/verify-plan.mjs:339` và `isMain` không nhận tham số `platform`).
- **KHÔNG** thực thi bất kỳ lệnh Git mutating nào (`git add`, `git commit`, `git push`, ...).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Tài Liệu Đã Đọc Trực Tiếp

- `.agents/rules/02-quality.md` (Pre-Work Protocol, Post-Change Checklist, Test Failure Triage Protocol, PowerShell `;` guidance)
- `.agents/rules/01-coding.md` (`:17` kỷ luật 0 ESLint warnings, `:64-70` bắt buộc co-located tests cho `src/lib/features/`)
- `.agents/skills/vikini-debug/SKILL.md` (`:12-60` Systematic Debugging 6 bước, `:62-93` Post-Fix Protocol 5 bước)
- `.agents/agents/reviewer/evidence-bar.md` (`:1-61` Evidence Bar, Adversarial Timeline §4.5.2, Enforcement Claim §4.5.3, Risk Table Audit §4.5.4)
- `.agents/agents/reviewer/mental-simulation.md` (`:1-70` S1–S6)
- `docs/lessons-learned.md` (`:44-49` Linux CI path order, `:414-438` Configuration & Playwright Visual QA runner, `:793-806` CI checkout, `:896-901` Prettier `lint-staged` prevention rule)
- `docs/security.md` (`:89` Google Workspace Resolver defense invariants)
- `docs/CHANGELOG.md` (`:11-20` định dạng ghi nhận thay đổi)
- Mã nguồn khảo sát: `scripts/visual-qa-runner.mjs`, `scripts/visual-qa-runner.test.ts`, `.agents/scripts/guard-paths.js`, `src/lib/features/chat/googleDocsResolver.server.ts`, `src/lib/features/chat/googleDocsResolver.server.test.ts`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `package.json`, `.prettierrc`, `.nvmrc`, `scripts/verify-plan.mjs`, `node_modules/@types/node/url.d.ts`, `node_modules/@types/node/path.d.ts`.

#### Skills Loaded & Applied

| Skill / Rule Đã Đọc (`read_file`)      | Phạm Vi Áp Dụng                                                                           | Quyết Định Kỹ Thuật Chịu Ảnh Hưởng                                                                                                                                                                                |
| :------------------------------------- | :---------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-debug/SKILL.md` | Bug fixing & `/post-fix` (`scripts/visual-qa-runner.mjs`, `googleDocsResolver.server.ts`) | Truy nguyên tận gốc qua Phase 1–4 trước khi đề xuất sửa; đối chiếu mẫu hoạt động `.agents/scripts/guard-paths.js:47`; bắt buộc ghi `docs/lessons-learned.md` + `docs/CHANGELOG.md`.                               |
| `.agents/rules/02-quality.md`          | Test Failure Triage, Verification, PowerShell 5.1                                         | Phân loại `VQ-04`/`VQ-15` là **Loại A (Code Bug)** → sửa mã nguồn, cấm nới lỏng test; dùng dấu `;` thay `&&` trong lệnh kiểm chứng Windows PowerShell 5.1.                                                        |
| `.agents/rules/01-coding.md`           | 0 lint warnings & Co-located tests                                                        | Sửa cảnh báo `curly` tại `src/lib/features/chat/googleDocsResolver.server.ts:420-421` và bổ sung test co-located bao phủ đúng nhánh HTML-on-XLSX trong `src/lib/features/chat/googleDocsResolver.server.test.ts`. |
| `.agents/rules/05-plan-review.md`      | Code Freeze, Plan Scope Guard, Independent Critic Pass                                    | Khai báo tường minh toàn bộ 6 tệp thay đổi tại Mục 5, giữ Status `Ready for Review` (không tự duyệt), chuẩn bị cho Independent Critic Pass do chạm `src/lib/features/chat/googleDocsResolver.server.ts`.          |

---

### 3. Assumptions & Cross-Task Dependencies

#### Root Cause Analysis (Theo `vikini-debug` Phase 2–4)

1. **Lỗi 1 (`VQ-04` tại `scripts/visual-qa-runner.test.ts:221-230`)**:
   - `[SRC] scripts/visual-qa-runner.mjs:171`: `const cand = path.isAbsolute(s) ? path.resolve(s) : path.resolve(repoRoot, s);` truyền nguyên chuỗi `s = "scripts\\check.mjs"` vào `path.resolve`.
   - Trên Linux (`ubuntu-latest`, `.github/workflows/ci.yml:12`), `\` không phải ký tự phân cách thư mục nên `path.resolve("/tmp/.../repo", "scripts\\check.mjs")` trả về `"/tmp/.../repo/scripts\\check.mjs"`, khiến `fs.statSync(cand)` ném `ENOENT`.
   - Mẫu đang hoạt động đúng trong cùng codebase: `[SRC] .agents/scripts/guard-paths.js:47` dùng `path.resolve(REPO_ROOT, toPosix(trimmed))`.
   - Hệ quả liên đới phát hiện khi kiểm tra toàn tệp: `[SRC] scripts/visual-qa-runner.mjs:144` dùng `path.extname(p)` trực tiếp trên `p` chưa chuẩn hóa. Trên Linux, `path.extname("tests\\.js")` trả về `".js"` (vì `\` bị coi là tên tệp), khác với Windows trả về `""` (dotfile không có phần mở rộng). Dùng `path.posix.extname(toPosix(p))` khắc phục triệt để cả 2 OS.
2. **Lỗi 2 (`VQ-15` tại `scripts/visual-qa-runner.test.ts:771-777`) & bẫy cross-OS driveless fallback / JSDoc strict**:
   - `[SRC] scripts/visual-qa-runner.mjs:527-533`: `isMainModule(metaUrl, argv1, platform = process.platform)` gọi `path.resolve(argv1)` và `pathToFileURL(...)` theo `process.platform` của máy chủ, bỏ qua tham số `platform`.
   - Trên Linux CI, `path.resolve("c:\\Users\\wyemh\\vikini\\scripts\\visual-qa-runner.mjs")` coi chuỗi không bắt đầu bằng `/` là đường dẫn tương đối nên ghép `process.cwd()` vào đầu và `pathToFileURL` mã hóa `\` thành `%5C`, làm kết quả trả về `false`.
   - Ngược lại trên Windows, nếu gọi `isMainModule("file:///home/runner/.../visual-qa-runner.mjs", "/home/runner/.../visual-qa-runner.mjs", "linux")`, `path.resolve` theo Windows lại ghép ổ đĩa `C:` vào đầu (`file:///C:/home/...`), cũng trả về `false`.
   - **Bẫy cross-OS driveless fallback (phát hiện từ Audit Run 1)**: Trên Linux CI (`process.cwd()` không có ổ đĩa), `path.win32.resolve("/home/runner/...")` trả về đường dẫn không ổ đĩa `"\\home\\runner\\..."`, và `pathToFileURL("\\home\\runner\\...", { windows: true })` không ném lỗi mà chuẩn hóa thành `"file:///home/runner/..."`, gây false-positive cho Negative Probe cross-platform. Ở chiều ngược lại, `path.posix.resolve("C:\\...")` coi `"C:\\..."` là đường dẫn tương đối nên ghép `process.cwd()` vào đầu (`"/cwd/C:\\..."` trên Linux hoặc `"C:\\cwd/C:\\..."` trên Windows). Vì vậy bắt buộc kiểm tra gốc tuyệt đối theo `isWin` (`/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/` cho `win32`; chặn tiền tố `/^[A-Za-z]:[\\/]/` trước `resolve` và yêu cầu `resolved.startsWith("/")` cho `!isWin`) trước khi gọi `pathToFileURL`.
   - **Hợp đồng kiểu `// @ts-check`**: `[SRC] scripts/visual-qa-runner.mjs:1,526` kết hợp `[SRC] tsconfig.json:4,6` (`allowJs: true`, `strict: true`) đang khai báo `@param {string} metaUrl`; cần mở rộng thành `@param {string | undefined} metaUrl` để guard runtime `typeof metaUrl !== "string" || !metaUrl` khớp kiểu khi unit test truyền `undefined` cho `metaUrl` mà không phát sinh `TS2345`.
3. **Khiếm khuyết OS-dependent phát hiện bổ sung tại `killProcessTree` (`scripts/visual-qa-runner.mjs:260-265`)**:
   - `[SRC] scripts/visual-qa-runner.mjs:261-265`: Nhánh `if ((deps.platform ?? process.platform) === "win32")` dùng `path.join(...)` theo OS máy chủ, khiến khi giả lập `platform: "win32"` trên Linux tạo ra chuỗi phân cách lẫn lộn `"C:\\Windows/System32/taskkill.exe"`. Đổi sang `path.win32.join(...)` giúp đường dẫn chuẩn Windows trên mọi OS.
4. **Cảnh báo ESLint `curly` (`src/lib/features/chat/googleDocsResolver.server.ts:420-421`)**:
   - `[SRC] eslint.config.mjs:11,91`: Luật `curly: ["warn", "multi-line"]` áp dụng cho `**/*.{js,jsx,ts,tsx}`.
   - `[SRC] src/lib/features/chat/googleDocsResolver.server.ts:420-421`: Dòng `if (isHtmlPayload(xlsxRes.contentType, xlsxRes.bytes))` dài 103 ký tự nếu gộp 1 dòng (`> printWidth: 100` tại `.prettierrc:5`), nên Prettier tách thành 2 dòng không có `{}` và kích hoạt cảnh báo `Expected { after 'if' condition`.

#### Giả Định (Assumptions)

- **A1 (Node.js 24 Runtime)**: Cả local lẫn CI đều chạy Node.js `24.x` (`[SRC] package.json:121`, `[SRC] .nvmrc:1`, `[SRC] .github/workflows/ci.yml:21`), hỗ trợ sẵn `pathToFileURL(path, { windows?: boolean })` (`@since v22.1.0`, `[SRC] node_modules/@types/node/url.d.ts:57-64,370`) và `path.win32` / `path.posix` (`[SRC] node_modules/@types/node/path.d.ts:178-183`).
- **A2 (Host Filesystem cho `validateScriptPath`)**: Khi `validateScriptPath` gọi `fs.statSync(cand)` / `fs.realpathSync(cand)` không mock (như trong `VQ-04`, `VQ-11`, `VQ-12`), `cand` phải là đường dẫn hợp lệ của OS máy chủ, do đó giữ `path.resolve(repoRoot, norm)` trên host `path` sau khi đã chuẩn hóa `norm = toPosix(s)`. Trên Windows, `path.isAbsolute("C:/...")` là `true` và `path.resolve("C:/...")` chuẩn hóa về `"C:\\..."` khớp tuyệt đối với `path.resolve(smokeFile)` trong các DI mock của `VQ-05` (`scripts/visual-qa-runner.test.ts:286-311`).
- **A3 (Không phụ thuộc chéo với task đang mở khác)**: Không thay đổi schema DB, không thay đổi chữ ký export công khai của bất kỳ module nào trong `src/` hoặc `scripts/`.
- **A4 (Prettier Idempotency)**: Toàn bộ 6 tệp chỉnh sửa phải vượt qua `npx prettier --check` trước khi chạy `npm run verify` để tránh lặp lại sự cố `lint-staged` làm lệch định dạng khi commit (`[SRC] docs/lessons-learned.md:896-901`).

#### Cross-Task Dependencies

- Không có phụ thuộc chéo ngoài phạm vi 6 tệp khai báo. Vì chạm `src/lib/features/chat/googleDocsResolver.server.ts`, luồng duyệt kế hoạch phụ thuộc vào bước **Independent Critic Pass** của `@reviewer` theo `.agents/rules/05-plan-review.md` §3.

---

### 4. Bảng Verified Versions

| Công Cụ / Thư Viện                  | Phiên Bản Thực Tế                         | Nguồn Xác Minh (`[SRC]` / `[URL]`)                                                                                                                                                      | Ghi Chú Tương Thích 2026                                                                                                              |
| :---------------------------------- | :---------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **Node.js**                         | `24.x` (`24`)                             | `[SRC] package.json:121`, `[SRC] .nvmrc:1`, `[SRC] node_modules/@types/node/url.d.ts:57-64,370`, `[URL] https://nodejs.org/docs/latest-v24.x/api/url.html#urlpathtofileurlpath-options` | `pathToFileURL(path, { windows?: boolean })` có từ Node.js v22.1.0; ổn định đầy đủ trên Node 24 LTS.                                  |
| **`node:path` (`win32` / `posix`)** | Node 24 built-in (`@types/node ^24.10.4`) | `[SRC] package.json:91`, `[SRC] node_modules/@types/node/path.d.ts:178-183`, `[URL] https://nodejs.org/docs/latest-v24.x/api/path.html#windows-vs-posix`                                | `path.win32.resolve`, `path.win32.join`, `path.posix.resolve`, `path.posix.extname` cho kết quả nhất quán bất kể host OS.             |
| **ESLint**                          | `^9.39.2` (Flat Config)                   | `[SRC] package.json:102`, `[SRC] eslint.config.mjs:91`, `[URL] https://eslint.org/docs/latest/rules/curly`                                                                              | `curly: ["warn", "multi-line"]` yêu cầu `{}` cho mọi lệnh `if` nhiều dòng; hỗ trợ `--max-warnings 0` và `--print-config`.             |
| **Vitest**                          | `^4.1.12`                                 | `[SRC] package.json:118`, `[SRC] vitest.config.ts:1-31`                                                                                                                                 | Chạy cả `scripts/visual-qa-runner.test.ts` (`@vitest-environment node`) và `src/lib/features/chat/googleDocsResolver.server.test.ts`. |
| **TypeScript**                      | `^5.9.3`                                  | `[SRC] package.json:116`, `[SRC] tsconfig.json:1-36`                                                                                                                                    | `strict: true`, `allowJs: true`, `noEmit: true`; `scripts/visual-qa-runner.mjs` dùng `// @ts-check`.                                  |
| **Prettier**                        | `^3.7.4`                                  | `[SRC] package.json:112`, `[SRC] .prettierrc:1-10`                                                                                                                                      | `printWidth: 100`, `semi: true`, `endOfLine: "lf"`.                                                                                   |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

- `[MODIFY]` `scripts/visual-qa-runner.mjs` — Sửa tận gốc `checkSecretAndExt` (`path.posix.extname(toPosix(p))`), `validateScriptPath` (`norm = toPosix(s)` trước `path.isAbsolute`/`path.resolve`), `killProcessTree` (`path.win32.join` cho nhánh `win32`), và `isMainModule` (mở rộng JSDoc `@param {string | undefined} metaUrl` tại `scripts/visual-qa-runner.mjs:526`, chọn `path.win32`/`path.posix`, kiểm tra chặt gốc tuyệt đối theo `isWin` chặn driveless/cross-OS fallback, rồi gọi `pathToFileURL(normalized, { windows: isWin })` trong `try/catch`).
- `[MODIFY]` `scripts/visual-qa-runner.test.ts` — Giữ nguyên 100% các assertion của `VQ-01..VQ-15`, siết chặt `VQ-09` với `path.win32.join`, mở rộng `VQ-04`/`VQ-05` cho các đường dẫn backslash (hợp lệ & tấn công dotfile/traversal/`.env`), và bổ sung test `VQ-16` phủ chéo hai chiều `win32` ↔ `linux` + ký tự khoảng trắng/đặc biệt (`#`, `%`, UNC, dot-segments) + Negative Probes cho `isMainModule` (bao gồm driveless backslash `"\\home\\runner\\..."` dưới `win32`, đường dẫn Windows `"C:\\..."` dưới `linux`, và `metaUrl: undefined`).
- `[MODIFY]` `src/lib/features/chat/googleDocsResolver.server.ts` — Bọc `{ ... }` cho lệnh `if (isHtmlPayload(xlsxRes.contentType, xlsxRes.bytes))` tại dòng `420-421` để xử lý dứt điểm cảnh báo ESLint `curly`.
- `[MODIFY]` `src/lib/features/chat/googleDocsResolver.server.test.ts` — Bổ sung test case co-located trong `TC-GD-09` (hoặc `TC-GD-13`) bao phủ đúng nhánh `resolveSheetLink` gặp HTTP 200 `text/html` trả về `GOOGLE_DOC_PRIVATE` mà không parse XLSX hay fallback CSV.
- `[MODIFY]` `docs/lessons-learned.md` — Ghi nhận bài học `/post-fix` mới dưới mục `## Configuration and Environment` (`docs/lessons-learned.md:414-438`) về chuẩn hóa đường dẫn cross-platform (`toPosix`, `path.win32`/`path.posix`, `pathToFileURL(..., { windows })`) và ESLint `curly` sau khi Prettier xuống dòng.
- `[MODIFY]` `docs/CHANGELOG.md` — Ghi nhận bản vá CI Linux (`VQ-04`, `VQ-15`) & ESLint `curly` vào đầu tệp (`docs/CHANGELOG.md:11`).

---

### 6. Caller-First Design Sketch

Không thay đổi bất kỳ chữ ký public export nào — toàn bộ caller hiện hữu giữ nguyên cách gọi, đồng thời các call site cross-platform hoạt động đồng nhất trên cả Windows và Linux:

```ts
// 1. Caller & Test Call Sites cho validateScriptPath (scripts/visual-qa-runner.mjs)
// Hoạt động đồng nhất trên CẢ Linux CI (/tmp/.../repo) lẫn Windows (C:\...\repo):
validateScriptPath("scripts\\check.mjs", { repoRoot: "/tmp/x/repo", artifactRoot: "/tmp/x/brain" });
// => { ok: true, resolvedPath: "/tmp/x/repo/scripts/check.mjs" }

validateScriptPath("tests\\.js", { repoRoot: "/tmp/x/repo", artifactRoot: "/tmp/x/brain" });
// => { ok: false, reason: "Script path extension must be .js, .mjs, or .cjs." } (chặn đồng nhất trên Linux & Windows)

// 2. Caller & Test Call Sites cho isMainModule (scripts/visual-qa-runner.mjs)
// (a) Simulated win32 trên Linux CI:
isMainModule(
  "file:///C:/Users/wyemh/vikini/scripts/visual-qa-runner.mjs",
  "c:\\Users\\wyemh\\vikini\\scripts\\visual-qa-runner.mjs",
  "win32"
); // => true

// (b) Simulated win32 có khoảng trắng và ký tự đặc biệt (#, %):
isMainModule(
  "file:///C:/Users/my%20user/vikini%20%231/100%25/visual-qa-runner.mjs",
  "c:\\Users\\my user\\vikini #1\\100%\\visual-qa-runner.mjs",
  "win32"
); // => true

// (c) Simulated linux trên máy Windows:
isMainModule(
  "file:///home/runner/work/vikini/scripts/visual-qa-runner.mjs",
  "/home/runner/work/vikini/scripts/visual-qa-runner.mjs",
  "linux"
); // => true

// (d) Case-sensitive mismatch & cross-OS driveless/drive mismatches (Negative Probes):
isMainModule(
  "file:///home/runner/Vikini/scripts/visual-qa-runner.mjs",
  "/home/runner/vikini/scripts/visual-qa-runner.mjs",
  "linux"
); // => false
isMainModule(
  "file:///home/runner/work/vikini/scripts/visual-qa-runner.mjs",
  "/home/runner/work/vikini/scripts/visual-qa-runner.mjs",
  "win32"
); // => false (bị chặn driveless trên Linux CI & lệch ổ đĩa trên Windows)
isMainModule(
  "file:///home/runner/work/vikini/scripts/visual-qa-runner.mjs",
  "\\home\\runner\\work\\vikini\\scripts\\visual-qa-runner.mjs",
  "win32"
); // => false (driveless backslash không đạt gốc Windows hợp lệ)
isMainModule(
  "file:///C:/Users/wyemh/vikini/scripts/visual-qa-runner.mjs",
  "C:\\Users\\wyemh\\vikini\\scripts\\visual-qa-runner.mjs",
  "linux"
); // => false (chặn tiền tố ổ đĩa Windows trước path.posix.resolve)
isMainModule(undefined, "/home/runner/work/vikini/scripts/visual-qa-runner.mjs", "linux"); // => false (hợp lệ kiểu TS nhờ @param {string | undefined} metaUrl)

// 3. Caller & Test Call Sites cho killProcessTree (scripts/visual-qa-runner.mjs)
killProcessTree(child, { platform: "win32", systemRoot: "C:\\Windows", spawnSync: mockSpawnSync });
// => gọi mockSpawnSync("C:\\Windows\\System32\\taskkill.exe", ["/F", "/T", "/PID", ...], ...) trên CẢ Linux & Windows

// 4. Internal Sketch (scripts/visual-qa-runner.mjs)
// checkSecretAndExt(p, label):
//   if (isEnvSecretPath(p)) return ...;
//   if (!ALLOWED_EXTS.has(path.posix.extname(toPosix(p)).toLowerCase())) return ...;
//
// validateScriptPath(rawScriptPath, opts = {}):
//   const norm = toPosix(s);
//   if (norm.split("/").includes("..")) return { ok: false, reason: "Traversal forbidden." };
//   const pre = checkSecretAndExt(norm, "Script path");
//   ...
//   const cand = path.isAbsolute(norm) ? path.resolve(norm) : path.resolve(repoRoot, norm);
//
// /** @param {string | undefined} metaUrl @param {string | undefined} argv1 @param {NodeJS.Platform} [platform] */
// isMainModule(metaUrl, argv1, platform = process.platform):
//   if (typeof metaUrl !== "string" || !metaUrl || typeof argv1 !== "string" || !argv1) return false;
//   const isWin = platform === "win32";
//   if (!isWin && /^[A-Za-z]:[\\/]/.test(argv1)) return false;
//   const pathImpl = isWin ? path.win32 : path.posix;
//   const resolved = pathImpl.resolve(argv1);
//   if (isWin) {
//     if (!/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/.test(resolved)) return false;
//   } else if (!resolved.startsWith("/") || /^[A-Za-z]:[\\/]/.test(resolved)) {
//     return false;
//   }
//   const normalized = isWin ? canonicalizeWindowsPath(resolved) : resolved;
//   try {
//     const expected = pathToFileURL(normalized, { windows: isWin }).href;
//     return isWin ? metaUrl.toLowerCase() === expected.toLowerCase() : metaUrl === expected;
//   } catch {
//     return false;
//   }

// 5. Internal Sketch (src/lib/features/chat/googleDocsResolver.server.ts:419-422)
//   if (xlsxRes.ok) {
//     if (isHtmlPayload(xlsxRes.contentType, xlsxRes.bytes)) {
//       return buildFailureOutcome(link, "private");
//     }
//     if (hasZipMagic(xlsxRes.bytes)) { ... }
//   }
```

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

- [x] **Bước 1 — Sửa cross-platform path logic trong `scripts/visual-qa-runner.mjs`**:
  - Tại `checkSecretAndExt` (`scripts/visual-qa-runner.mjs:141-148`): thay `path.extname(p)` bằng `path.posix.extname(toPosix(p))`.
  - Tại `validateScriptPath` (`scripts/visual-qa-runner.mjs:163-172`): tính `const norm = toPosix(s);`, dùng `norm` cho kiểm tra `".."`, `checkSecretAndExt(norm, "Script path")`, và `const cand = path.isAbsolute(norm) ? path.resolve(norm) : path.resolve(repoRoot, norm);` (giữ nguyên thông báo lỗi hiển thị `${s}` để bảo toàn hợp đồng thông báo lỗi).
  - Tại `killProcessTree` (`scripts/visual-qa-runner.mjs:260-265`): đổi `path.join(...)` thành `path.win32.join(...)` trong nhánh `win32`.
  - Tại `isMainModule` (`scripts/visual-qa-runner.mjs:526-533`):
    - Cập nhật JSDoc dòng `526` từ `@param {string} metaUrl` sang `/** @param {string | undefined} metaUrl @param {string | undefined} argv1 @param {NodeJS.Platform} [platform] */` để tương thích tuyệt đối với `// @ts-check` (`scripts/visual-qa-runner.mjs:1`) và `tsconfig.json:4,6` (`allowJs: true`, `strict: true`).
    - Kiểm tra sớm `typeof metaUrl !== "string" || !metaUrl || typeof argv1 !== "string" || !argv1` trả `false`; với `const isWin = platform === "win32"`, nếu `!isWin && /^[A-Za-z]:[\\/]/.test(argv1)` trả `false` ngay trước khi gọi `path.posix.resolve`.
    - Tính `const resolved = (isWin ? path.win32 : path.posix).resolve(argv1);` rồi xác thực chặt gốc tuyệt đối: nếu `isWin` bắt buộc `/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/.test(resolved)` (chặn đường dẫn driveless `"\\home\\..."` sinh ra trên Linux CI); nếu `!isWin` bắt buộc `resolved.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(resolved)`.
    - Chuẩn hóa `const normalized = isWin ? canonicalizeWindowsPath(resolved) : resolved;`, gọi `pathToFileURL(normalized, { windows: isWin }).href` trong `try/catch` (trả `false` nếu lỗi), rồi so sánh case-insensitive khi `isWin` và exact `===` khi POSIX.
- [x] **Bước 2 — Sửa cảnh báo ESLint `curly` trong `src/lib/features/chat/googleDocsResolver.server.ts`**:
  - Tại `src/lib/features/chat/googleDocsResolver.server.ts:420-421`: thêm cặp dấu ngoặc nhọn `{ ... }` cho nhánh `if (isHtmlPayload(xlsxRes.contentType, xlsxRes.bytes))`. Không chỉnh sửa bất kỳ dòng nào khác trong tệp.
- [x] **Bước 3 — Mở rộng co-located tests trong `scripts/visual-qa-runner.test.ts`**:
  - Giữ nguyên 100% assertions gốc trong `VQ-04`, `VQ-05`, `VQ-15`.
  - Trong `VQ-04`: bổ sung thêm đường dẫn phân cách Windows nhiều cấp (`"tests\\e2e\\smoke.js"`) và trộn phân cách (`"tests\\e2e/smoke.js"`).
  - Trong `VQ-05`: bổ sung Negative Probes với backslash: `"tests\\.env.js"`, `"tests\\..\\..\\outside.js"`, `"tests\\.js"` (dotfile), `"scripts\\bad.ps1"`.
  - Trong `VQ-09`: siết chặt kỳ vọng thành `path.win32.join("C:\\Windows", "System32", "taskkill.exe")` (`"C:\\Windows\\System32\\taskkill.exe"`) và bổ sung case `systemRoot: "C:/Windows"`.
  - Bổ sung `VQ-16` (cập nhật tiêu đề `describe` thành `VQ-01..VQ-16`) kiểm thử `isMainModule` hai chiều cross-platform: simulated `win32` (ổ đĩa chữ thường, đường dẫn phân cách trộn + dot-segments, case-insensitive, khoảng trắng + `#` + `%`, UNC path), simulated `linux` (đường dẫn POSIX chuẩn, khoảng trắng + `#` + `%`, dot-segments), và Negative Probes (lệch chữ hoa/thường trên `linux`, sai tên tệp, `undefined`/rỗng cho cả `argv1` lẫn `metaUrl`, đường dẫn POSIX `"/home/runner/..."` và driveless backslash `"\\home\\runner\\..."` với `platform: "win32"`, đường dẫn Windows `"C:\\Users\\..."` và `"c:/Users/..."` với `platform: "linux"`, và URL Windows kèm `platform: "linux"`).
- [x] **Bước 4 — Bổ sung co-located test trong `src/lib/features/chat/googleDocsResolver.server.test.ts`**:
  - Thêm test case (trong `TC-GD-09` hoặc `TC-GD-13`) gửi link Google Sheet trả HTTP 200 `text/html` (`<!DOCTYPE html><html><body>Sign in</body></html>`), xác minh đi qua đúng `src/lib/features/chat/googleDocsResolver.server.ts:420-422`: trả `GOOGLE_DOC_PRIVATE`, `mockFetch` chỉ gọi 1 lần (không fallback CSV), `mockParseXlsxWithExcelJs` không được gọi.
- [x] **Bước 5 — Cập nhật Living Docs theo `/post-fix` (`docs/lessons-learned.md` & `docs/CHANGELOG.md`)**:
  - Thêm mục mới dưới `## Configuration and Environment` trong `docs/lessons-learned.md` theo đúng mẫu 4 trường (`Symptom`, `Root Cause`, `Fix`, `Prevention Rule`).
  - Thêm mục tóm tắt bản vá lên đầu `docs/CHANGELOG.md`.
- [x] **Bước 6 — Kiểm định Prettier, Wiring/Negative Probes & `npm run verify`**:
  - Chạy toàn bộ lệnh tại Mục 9 (Prettier check, ESLint `--print-config` không dùng pipe + negative stdin probe + `--max-warnings 0`, Vitest targeted tests, và `npm run type-check; npm run lint; npm run test:run`).
  - Đổi `- **Status**: Completed` trong header kế hoạch sau khi hoàn tất toàn bộ triển khai và nghiệm thu.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Mọi test case dưới đây là hợp đồng cứng (Loại A) để `@qa` và CI đối soát — cấm bỏ qua, cấm nới lỏng matcher:

| ID                             | Hàm / Module Mục Tiêu                                                                        | Input & Điều Kiện Biên                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Output Mong Đợi (Pass Criteria)                                                                                                                              | Failure Mode / Error Message                                                                                                                                            |
| :----------------------------- | :------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-VQ-04a**                  | `validateScriptPath` (`scripts/visual-qa-runner.mjs:163-189`)                                | `"scripts\\check.mjs"`, `"tests\\e2e\\smoke.js"`, `"tests\\e2e/smoke.js"` với `repoRoot: tmpRepo` (POSIX `/tmp/...` trên Linux hoặc `C:\...` trên Windows)                                                                                                                                                                                                                                                                                                                                 | `{ ok: true, resolvedPath: canonicalizeWindowsPath(fs.realpathSync(...)) }`                                                                                  | Không được trả `Script file does not exist` khi tệp tồn tại trong `scripts/` hoặc `tests/`.                                                                             |
| **TC-VQ-05a (NP-1)**           | `validateScriptPath` + `checkSecretAndExt` (`scripts/visual-qa-runner.mjs:141-148`)          | `"tests\\.js"`, `"tests\\.env.js"`, `"tests\\..\\..\\outside.js"`, `"scripts\\bad.ps1"`                                                                                                                                                                                                                                                                                                                                                                                                    | `{ ok: false, reason }` tương ứng khớp `/extension/i`, `/\.env/i`, `/traversal/i`, `/extension/i`                                                            | Phải từ chối trên CẢ Linux lẫn Windows (không được để `"tests\\.js"` lọt `extname === ".js"` trên Linux).                                                               |
| **TC-VQ-09a**                  | `killProcessTree` (`scripts/visual-qa-runner.mjs:257-278`)                                   | `platform: "win32"`, `systemRoot: "C:\\Windows"` và `systemRoot: "C:/Windows"`                                                                                                                                                                                                                                                                                                                                                                                                             | Gọi `spawnSync("C:\\Windows\\System32\\taskkill.exe", ["/F", "/T", "/PID", "<pid>"], { stdio: "ignore", windowsHide: true, shell: false, timeout: 10_000 })` | Không được chứa phân cách trộn `"C:\\Windows/System32/taskkill.exe"` trên Linux.                                                                                        |
| **TC-VQ-15a**                  | `isMainModule` (`scripts/visual-qa-runner.mjs:527-533`)                                      | `("file:///C:/Users/wyemh/vikini/scripts/visual-qa-runner.mjs", "c:\\Users\\wyemh\\vikini\\scripts\\visual-qa-runner.mjs", "win32")`                                                                                                                                                                                                                                                                                                                                                       | `true` trên CẢ Linux CI lẫn Windows                                                                                                                          | Không được trả `false` do dùng `path.posix.resolve` hay `pathToFileURL` mặc định của Linux.                                                                             |
| **TC-VQ-16a**                  | `isMainModule` (cross-platform happy paths)                                                  | Simulated `win32`: case-insensitive, mixed `/` + `..`/`.`, spaces + `#` + `%` (`c:\Users\my user\vikini #1\100%\visual-qa-runner.mjs`), UNC (`\\server\share\scripts\visual-qa-runner.mjs`); Simulated `linux`: POSIX chuẩn, spaces + `#` + `%`, dot-segments                                                                                                                                                                                                                              | Tất cả trả về `true` trên CẢ Windows và Linux                                                                                                                | Sai lệch percent-encoding (`%20`, `%23`, `%25`) hoặc ghép nhầm ổ đĩa `C:` vào đường dẫn POSIX.                                                                          |
| **TC-VQ-16b (NP-2)**           | `isMainModule` (`scripts/visual-qa-runner.mjs:526-533`) — Negative Probes                    | (1) Case mismatch dưới `platform: "linux"`, (2) sai tên tệp trên `win32` & `linux`, (3) `argv1: undefined` / `""` và `metaUrl: undefined` / `""` (không phát sinh `TS2345` dưới `tsc --noEmit`), (4) chéo nền tảng & driveless: đường dẫn POSIX `"/home/runner/..."` kèm `platform: "win32"`, đường dẫn driveless `"\\home\\runner\\..."` kèm `platform: "win32"`, đường dẫn Windows `"C:\\Users\\..."` & `"c:/Users/..."` kèm `platform: "linux"`, và URL Windows kèm `platform: "linux"` | Tất cả trả về `false` trên CẢ Windows và Linux CI, KHÔNG ném exception và vượt qua `tsc --noEmit`                                                            | Không được false-positive từ driveless `"\\home\\..."` trên Linux CI, không ghép `cwd` + `"C:\\..."` dưới `linux`, không `TS2345`, không crash `ERR_INVALID_ARG_VALUE`. |
| **TC-GD-09-Sheet (NP-4)**      | `resolveGoogleWorkspaceLinks` (`src/lib/features/chat/googleDocsResolver.server.ts:419-422`) | Link Google Sheet (`docs.google.com/spreadsheets/d/.../edit`), HTTP 200 `content-type: text/html; charset=utf-8` với body HTML sign-in                                                                                                                                                                                                                                                                                                                                                     | `urlContext[0].status === "GOOGLE_DOC_PRIVATE"`, `mockFetch` gọi đúng `1` lần (không thử CSV), `mockParseXlsxWithExcelJs` không gọi                          | Không được fallback sang CSV hoặc parse HTML như XLSX.                                                                                                                  |
| **TC-LINT-CURLY (WP-1, NP-3)** | ESLint `curly` trên `src/lib/features/chat/googleDocsResolver.server.ts`                     | File thật sau khi thêm `{}` vs stdin snippet vi phạm `if (a)\n  return 1;`                                                                                                                                                                                                                                                                                                                                                                                                                 | File thật: exit `0` với `--max-warnings 0`; Stdin snippet vi phạm: exit `1` kèm cảnh báo `curly`                                                             | Không được còn bất kỳ cảnh báo `curly` nào khi chạy `npm run lint`.                                                                                                     |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Co-Located Tests

1. `scripts/visual-qa-runner.test.ts` (đặt cạnh `scripts/visual-qa-runner.mjs`) — kiểm thử `VQ-01..VQ-16` bao gồm happy paths cross-platform, boundary cases, và Negative Probes `NP-1`, `NP-2`.
2. `src/lib/features/chat/googleDocsResolver.server.test.ts` (đặt cạnh `src/lib/features/chat/googleDocsResolver.server.ts`) — kiểm thử `TC-GD-04..TC-GD-12` + bổ sung nhánh private Sheet HTML (`NP-4`).

#### Lệnh Kiểm Chứng Tuần Tự (PowerShell 5.1 dùng `;`, cấm `&&`)

1. **Prettier Idempotency Check (`WP-2`)**:

   ```powershell
   npx prettier --check scripts/visual-qa-runner.mjs scripts/visual-qa-runner.test.ts src/lib/features/chat/googleDocsResolver.server.ts src/lib/features/chat/googleDocsResolver.server.test.ts docs/lessons-learned.md docs/CHANGELOG.md
   ```

   - Kỳ vọng: exit `0` (mọi tệp khớp hoàn toàn chuẩn Prettier, `lint-staged` khi commit là no-op).

2. **ESLint Wiring Probe (`WP-1`, 100% tương thích read-only allowlist `.agents/scripts/command-policy.js:336-349`, không dùng pipe `|`) & Negative Probe (`NP-3`)** (theo `.agents/agents/reviewer/evidence-bar.md` §4.5.3):

   ```powershell
   npx eslint --print-config src/lib/features/chat/googleDocsResolver.server.ts; npx eslint --print-config scripts/visual-qa-runner.mjs
   ```

   ```powershell
   npx eslint src/lib/features/chat/googleDocsResolver.server.ts --max-warnings 0
   ```

   - Kỳ vọng `WP-1`: `--print-config` trên `googleDocsResolver.server.ts` trả về `"curly": [1, "multi-line"]` (và xác nhận `js.configs.recommended` hoạt động trên `scripts/visual-qa-runner.mjs`), đồng thời `eslint --max-warnings 0` trên `src/lib/features/chat/googleDocsResolver.server.ts` exit `0`.

   ```powershell
   "export function probe(a: boolean) {`n  if (a)`n    return 1;`n  return 0;`n}`n" | npx eslint --stdin --stdin-filename src/lib/features/chat/googleDocsResolver.server.ts --max-warnings 0
   ```

   - Kỳ vọng `NP-3`: exit code khác `0` (`1`) với thông báo `Expected { after 'if' condition  curly`, chứng minh luật thực sự đang hoạt động trên đường dẫn mục tiêu (lưu ý: `NP-3` dùng `|` nên chỉ chạy sau khi plan đã duyệt ở bước xác minh thực thi).

3. **Targeted Co-Located Tests (`NP-1`, `NP-2`, `NP-4`)**:

   ```powershell
   npx vitest run scripts/visual-qa-runner.test.ts src/lib/features/chat/googleDocsResolver.server.test.ts --reporter=dot
   ```

   - Kỳ vọng: exit `0`, 100% test cases (`VQ-01..VQ-16` & `TC-GD-04..12` + Sheet HTML) PASS.

4. **Full Verification Suite (`WP-3`, đối ứng `.github/workflows/ci.yml:27-34`)**:

   ```powershell
   npm run type-check; npm run lint; npm run test:run
   ```

   ```powershell
   npx eslint . --max-warnings 0
   ```

   - Kỳ vọng: `tsc --noEmit` exit `0`, `npm run lint` & `npx eslint . --max-warnings 0` exit `0` (0 errors, 0 warnings), `vitest run` exit `0`.

5. **Visual QA Gate**: `N/A` — Không chỉnh sửa bất kỳ UI component hay tệp CSS nào (`src/app/`, `src/components/` không nằm trong phạm vi).

---

### 10. Rủi Ro Tiềm Ẩn, Adversarial Timelines & Phương Án Phòng Ngừa

#### Bảng Rủi Ro & Technical Control

| #      | Rủi Ro                                                                                                                                                                                                                                                                                                                            |     Mức Độ     | Technical Control Cụ Thể (`[SRC]` / Probe)                                                                                                                                                                                                                                                                                                                                               |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | `validateScriptPath` chuẩn hóa `\` thành `/` trên Linux nhưng bỏ lọt đường dẫn Windows dotfile (`"tests\\.js"`), traversal (`"tests\\..\\..\\outside.js"`), hoặc symlink trỏ ra ngoài / vào file bí mật                                                                                                                           |    **Cao**     | `norm = toPosix(s)` chạy trước kiểm tra `".."` (`scripts/visual-qa-runner.mjs:166`), `checkSecretAndExt` dùng `isEnvSecretPath` (`.agents/scripts/guard-paths.js:69-93`) + `path.posix.extname(toPosix(p))` (`scripts/visual-qa-runner.mjs:141-148`), và kiểm tra hậu-`realpathSync` + `isInsideAllowedRoots` (`scripts/visual-qa-runner.mjs:179-187`). Kiểm chứng bởi `VQ-05` + `NP-1`. |
| **R2** | `isMainModule` gặp bẫy cross-OS driveless fallback trên Linux CI (`path.win32.resolve("/home/...")` → `"\\home\\..."` → `pathToFileURL` trả `file:///home/...` gây false-positive), trộn `cwd` + `"C:\\..."` dưới `linux`, ném `ERR_INVALID_ARG_VALUE`, hoặc gây lỗi `TS2345` dưới `// @ts-check` khi truyền `metaUrl: undefined` |    **Cao**     | Mở rộng JSDoc `@param {string                                                                                                                                                                                                                                                                                                                                                            | undefined} metaUrl` (`scripts/visual-qa-runner.mjs:526`); chặn `/^[A-Za-z]:[\\/]/`khi`!isWin`trước`resolve`; kiểm tra chặt gốc tuyệt đối sau `pathImpl.resolve(argv1)` (`/^(?:[A-Za-z]:\\ | \\\\[^\\]+\\[^\\]+)/`cho`win32`; `resolved.startsWith("/")`cho`!isWin`) trước khi gọi `pathToFileURL(normalized, { windows: isWin })` (`node_modules/@types/node/url.d.ts:57-64,370`) bọc `try/catch`fail-closed; giữ nguyên`isMainModule(import.meta.url, process.argv[1])`tại`scripts/visual-qa-runner.mjs:549`. Kiểm chứng bởi `VQ-15`(real child`spawnSync`) + `VQ-16`+`TC-VQ-16b (NP-2)`+`npm run type-check`. |
| **R3** | Phá vỡ DI mock `p === path.resolve(smokeFile)` trong `VQ-05` (`scripts/visual-qa-runner.test.ts:286-311`) khi thay đổi cách tính `cand` trong `validateScriptPath`                                                                                                                                                                | **Trung bình** | Dùng `path.isAbsolute(norm) ? path.resolve(norm) : path.resolve(repoRoot, norm)` đảm bảo trên Windows `path.resolve("C:/...") === path.resolve("C:\\...") === path.resolve(smokeFile)` và trên Linux giữ nguyên `"/tmp/..."`. Kiểm chứng trực tiếp bởi `VQ-05` không sửa mock trong `WP-3`.                                                                                              |
| **R4** | Thay đổi trong `src/lib/features/chat/googleDocsResolver.server.ts:420-421` làm thay đổi luồng fallback Google Sheets hoặc Prettier `lint-staged` lại bẻ dòng tạo cảnh báo mới khi commit                                                                                                                                         | **Trung bình** | Chỉ bọc cặp `{}` bao quanh duy nhất lệnh `return buildFailureOutcome(link, "private");` (mỗi dòng `<= 60` ký tự, thấp hơn `printWidth: 100` tại `.prettierrc:5`). Kiểm chứng bởi `NP-4` (`googleDocsResolver.server.test.ts`), `WP-1`, `NP-3`, và `WP-2` (`npx prettier --check`).                                                                                                       |
| **R5** | Chỉnh sửa `killProcessTree` sang `path.win32.join` nhưng bỏ quên test `VQ-09` hoặc gây lỗi khi `systemRoot` chứa `/`                                                                                                                                                                                                              |    **Thấp**    | `path.win32.join` chuẩn hóa cả `/` và `\` về `\` trên mọi OS (`node_modules/@types/node/path.d.ts:183`); cập nhật đồng bộ `VQ-09` (`scripts/visual-qa-runner.test.ts:418-422`) kiểm chứng cả `"C:\\Windows"` lẫn `"C:/Windows"`.                                                                                                                                                         |

#### Adversarial Timelines (Theo `.agents/agents/reviewer/evidence-bar.md` §4.5.2)

1. **Trục 1 — Đồng thời**: `N/A` — `validateScriptPath`, `checkSecretAndExt`, `killProcessTree`, `isMainModule` là các hàm đồng bộ không dùng shared mutable state; bản vá tại `src/lib/features/chat/googleDocsResolver.server.ts:420-421` là thay đổi cú pháp AST tương đương (chỉ thêm `{}`), không thay đổi bất kỳ luồng bất đồng bộ hay quản lý state nào.
2. **Trục 2 — Khoảng trống check→use (TOCTOU) & Path Traversal / Dotfile Bypass qua Backslash**:
   - **Cơ chế**: `validateScriptPath` (`scripts/visual-qa-runner.mjs:163-189`)
   - `T1`: Người gọi trên Linux truyền `--script "tests\\.js"` hoặc `--script "tests\\..\\..\\outside.js"` hoặc đường dẫn chứa symlink trong `tests/` trỏ ra `/tmp/outside/escape.js` hay `.env.local`.
   - `T2`: `norm = toPosix(s)` chuẩn hóa `\` thành `/`; nhánh `".."` bị `norm.split("/").includes("..")` chặn ngay; `"tests/.js"` bị `path.posix.extname` trả về `""` và bị từ chối ở pre-check; symlink hợp lệ ở pre-check tiếp tục qua `safeRealpath` (`fs.realpathSync`), `checkSecretAndExt(real)` và `isInsideAllowedRoots(real, realRepo, realArt, platform)`.
   - `T3`: `validateScriptPath` trả `{ ok: false, reason }` → `runVisualQa` ghi `stderr` và thoát mã `2` trước khi bất kỳ `spawn()` nào được thực thi.
   - **Kết cục**: Không thể vượt rào root allowlist hay chèn tệp không hợp lệ trên Linux lẫn Windows → **An toàn** (`VQ-05`, `NP-1`).
3. **Trục 3 — Thất bại giữa chừng / Malformed Input & Private Sheet HTML Guard**:
   - **Cơ chế A (`isMainModule`, `scripts/visual-qa-runner.mjs:526-533`)**:
     - `T1`: Trên Linux CI (`process.cwd() = "/home/runner/work/vikini"`), caller truyền đường dẫn POSIX `"/home/runner/..."` hoặc driveless `"\\home\\runner\\..."` kèm `platform: "win32"`, hoặc truyền `"C:\\Users\\..."` kèm `platform: "linux"`, hoặc truyền `metaUrl: undefined` / chuỗi lỗi làm `pathToFileURL` ném `ERR_INVALID_ARG_VALUE`.
     - `T2`: Guard đầu hàm chặn `undefined`/rỗng; tiền kiểm `!isWin && /^[A-Za-z]:[\\/]/.test(argv1)` chặn đường dẫn Windows dưới `linux`; sau `pathImpl.resolve(argv1)`, kiểm tra gốc tuyệt đối (`/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/` cho `win32`, `resolved.startsWith("/")` cho `!isWin`) từ chối ngay `"\\home\\..."` driveless trước khi gọi `pathToFileURL`; khối `try/catch` bắt mọi lỗi ngoại lệ còn lại.
     - `T3`: Hàm trả về `false` nhất quán trên cả Linux CI lẫn Windows, vượt qua `tsc --noEmit`, và không kích hoạt `runCli()` khi module bị `import()`.
     - **Kết cục**: Loại bỏ triệt để false-positive cross-OS driveless và không gây crash module import → **An toàn** (`VQ-15`, `VQ-16`, `TC-VQ-16b (NP-2)`).
   - **Cơ chế B (`resolveSheetLink`, `src/lib/features/chat/googleDocsResolver.server.ts:419-422`)**:
     - `T1`: Link Google Sheet riêng tư trả HTTP `200` kèm payload `text/html` trang đăng nhập Google.
     - `T2`: Nhánh `if (xlsxRes.ok)` đánh giá `if (isHtmlPayload(xlsxRes.contentType, xlsxRes.bytes)) { return buildFailureOutcome(link, "private"); }`.
     - `T3`: Dừng ngay tại hop XLSX, trả trạng thái `GOOGLE_DOC_PRIVATE`, không truyền HTML vào `parseXlsxWithExcelJs` và không gọi thêm request CSV.
     - **Kết cục**: Bảo toàn nguyên vẹn hành vi phát hiện tài liệu riêng tư → **An toàn** (`NP-4`).
4. **Trục 4 — Môi trường Serverless / Khác Biệt Hệ Điều Hành CI (`ubuntu-latest` vs Windows)**:
   - **Cơ chế**: GitHub Actions Linux CI (`.github/workflows/ci.yml:12`) vs Windows dev machine & Husky `lint-staged` Prettier (`.prettierrc:5`).
   - `T1`: Mã nguồn được phát triển và chạy test trên Windows (`process.platform === "win32"`), sau đó `git commit` chạy Prettier (`printWidth: 100`) và CI chạy trên `ubuntu-latest` (`process.platform === "linux"`).
   - `T2`: Mọi hàm nhận tham số `platform` (`isMainModule`, `killProcessTree`) sử dụng tường minh `path.win32` / `path.posix` và `{ windows: isWin }`; `validateScriptPath` chuẩn hóa `toPosix(s)`; `src/lib/features/chat/googleDocsResolver.server.ts:420-422` dùng khối `{}` không bị Prettier gộp/tách gây cảnh báo `curly`.
   - `T3`: `npx prettier --check`, `npx eslint . --max-warnings 0`, và bộ test cross-platform hai chiều (`VQ-04`, `VQ-05`, `VQ-09`, `VQ-15`, `VQ-16`) chạy xanh nhất quán trên cả Windows và Linux CI.
   - **Kết cục**: Loại bỏ hoàn toàn hiện tượng "pass local Windows, fail Ubuntu CI" → **An toàn** (`WP-1`, `WP-2`, `WP-3`).

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision 1 — không có lỗi lượt trước để đối soát.
- Output `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-visual-qa-runner-linux-ci-and-lint.md` (exit `0`):

```text
[PASS] SECTIONS 7/7
[PASS] LINE_REF .github/workflows/ci.yml:12
[PASS] LINE_REF .github/workflows/ci.yml:34
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:221-230
[PASS] LINE_REF scripts/visual-qa-runner.mjs:163-189
[PASS] LINE_REF .agents/scripts/guard-paths.js:47
[PASS] LINE_REF scripts/visual-qa-runner.mjs:141-148
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:771-777
[PASS] LINE_REF scripts/visual-qa-runner.mjs:527-533
[PASS] LINE_REF scripts/visual-qa-runner.mjs:260-265
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:418-422
[PASS] LINE_REF src/lib/features/chat/googleDocsResolver.server.ts:420-421
[PASS] LINE_REF .agents/rules/01-coding.md:17
[PASS] LINE_REF eslint.config.mjs:91
[PASS] LINE_REF scripts/verify-plan.mjs:339
[PASS] LINE_REF scripts/visual-qa-runner.mjs:171
[PASS] LINE_REF scripts/visual-qa-runner.mjs:144
[PASS] LINE_REF scripts/visual-qa-runner.mjs:261-265
[PASS] LINE_REF eslint.config.mjs:11
[PASS] LINE_REF package.json:121
[PASS] LINE_REF .github/workflows/ci.yml:21
[PASS] LINE_REF node_modules/@types/node/url.d.ts:57-64
[PASS] LINE_REF node_modules/@types/node/url.d.ts:370
[PASS] LINE_REF node_modules/@types/node/path.d.ts:178-183
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:286-311
[PASS] LINE_REF docs/lessons-learned.md:896-901
[PASS] LINE_REF package.json:91
[PASS] LINE_REF package.json:102
[PASS] LINE_REF package.json:118
[PASS] LINE_REF vitest.config.ts:1-31
[PASS] LINE_REF package.json:116
[PASS] LINE_REF tsconfig.json:1-36
[PASS] LINE_REF package.json:112
[PASS] LINE_REF docs/lessons-learned.md:414-438
[PASS] LINE_REF docs/CHANGELOG.md:11
[PASS] LINE_REF src/lib/features/chat/googleDocsResolver.server.ts:419-422
[PASS] LINE_REF scripts/visual-qa-runner.mjs:163-172
[PASS] LINE_REF src/lib/features/chat/googleDocsResolver.server.ts:420-422
[PASS] LINE_REF scripts/visual-qa-runner.mjs:257-278
[PASS] LINE_REF .github/workflows/ci.yml:27-34
[PASS] LINE_REF scripts/visual-qa-runner.mjs:166
[PASS] LINE_REF .agents/scripts/guard-paths.js:69-93
[PASS] LINE_REF scripts/visual-qa-runner.mjs:179-187
[PASS] LINE_REF scripts/visual-qa-runner.mjs:549
[PASS] LINE_REF node_modules/@types/node/path.d.ts:183
[INFO] CRITIC_REQUIRED yes (src/lib/features/chat/googleDocsResolver.server.ts)
[INFO] CRITIC_FLOOR skipped (no audit run)
VERIFY_PLAN: PASS (0 failures, 0 warnings)
```

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                | Bằng chứng          | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------- | ------- | ------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | DEFECT         | [MAJOR] | `scripts/visual-qa-runner.mjs:527-533`     | [SRC], [URL], [ADV] | Thiết kế đề xuất cho `isMainModule` gọi `path.win32.resolve(argv1)` rồi truyền thẳng vào `pathToFileURL(resolved, { windows: true })` sẽ **lỗi ngay trên Linux CI (`ubuntu-latest`)** với chính Negative Probe `TC-VQ-16b (NP-2)` mục (4) (đường dẫn POSIX `/home/runner/...` kèm `platform: "win32"`). Trên Windows, `path.win32.resolve("/home/...")` lấy ổ đĩa `C:` từ `process.cwd()` tạo `"C:\\home\\..."` → `"file:///C:/home/..."` ≠ `metaUrl` (`false`, xanh trên Windows). Nhưng trên Linux, `process.cwd()` là `"/home/runner/..."` không có ổ đĩa nên `path.win32.resolve("/home/...")` trả về đường dẫn không ổ đĩa `"\\home\\..."`, và `pathToFileURL("\\home\\...", { windows: true })` không ném lỗi mà chuẩn hóa thành `"file:///home/..."` trùng khớp `metaUrl` → trả về `true` (sai hợp đồng `TC-VQ-16b` trên Linux CI). Tương tự ở chiều ngược lại, `path.posix.resolve` khi nhận chuỗi tương đối/Windows trên máy Windows trộn `process.cwd()` kiểu `C:\...` không bắt đầu bằng `/`. **Yêu cầu sửa**: Sau `pathImpl.resolve(argv1)`, kiểm tra chặt gốc tuyệt đối theo `isWin`: nhánh `isWin` bắt buộc khớp ổ đĩa hoặc UNC (`/^(?:[A-Za-z]:\\ | \\\\[^\\]+\\[^\\]+)/.test(resolved)`), nhánh `!isWin`bắt buộc`resolved.startsWith("/")`, nếu không đạt thì trả `false`ngay trước khi gọi`pathToFileURL`; đồng thời cập nhật R2 và bổ sung test probe trong `VQ-16` mô phỏng đầu vào không ổ đĩa (`"\\home\\runner\\..."`) dưới `platform: "win32"`. |
| 2   | DEFECT         | [MAJOR] | `scripts/visual-qa-runner.mjs:526`         | [SRC]               | Hợp đồng JSDoc dưới `// @ts-check` (`scripts/visual-qa-runner.mjs:1`) + `tsconfig.json:4,6` (`allowJs: true`, `strict: true`) hiện khai báo `/\*\* @param {string} metaUrl @param {string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | undefined} argv1 @param {NodeJS.Platform} [platform] \*/`. Kế hoạch bổ sung guard runtime `typeof metaUrl !== "string"                                                                                                                                                                              |                                                                                                                                                                        | !metaUrl`ở Bước 1 nhưng không khai báo mở rộng JSDoc`@param {string                | undefined} metaUrl`tại`scripts/visual-qa-runner.mjs:526`, trong khi Bước 3 yêu cầu viết test truyền `undefined`cho`metaUrl` (`scripts/visual-qa-runner.test.ts:15`import trực tiếp từ`./visual-qa-runner.mjs`). Nếu triển khai đúng Bước 1 + Bước 3, `tsc --noEmit`sẽ thất bại với lỗi`TS2345` (`undefined`không gán được cho`string`). **Yêu cầu sửa**: Cập nhật rõ Bước 1 và Mục 6 mở rộng JSDoc dòng `526`thành`@param {string | undefined} metaUrl`(và đồng bộ bảng`TC-VQ-16b`). |
| 3   | DEFECT         | [MINOR] | `eslint.config.mjs:11,91`                  | [SRC], [CMD]        | Lệnh kiểm chứng `WP-1` dùng toán tử ống dẫn PowerShell `                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Select-String` (`command-policy.js:18`xếp`                                                                                                                                                                                                                                                          | `vào`SHELL_OPERATOR_CHARS`buộc hỏi người dùng không cần thiết), trong khi lệnh`npx eslint --print-config src/lib/features/chat/googleDocsResolver.server.ts`không cần` | `đã xác nhận trực tiếp`"curly": [1, "multi-line"]`. Đề xuất đơn giản hóa `WP-1`bỏ` | Select-String`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | RISK_DISMISSED | [MINOR] | `node_modules/@types/node/url.d.ts:57-64`  | [SRC], [URL], [CMD] | Đã xác minh trực tiếp tương thích `pathToFileURL(path, { windows: boolean })` trên CI và `tsc --noEmit`: `.github/workflows/ci.yml:12,21` chạy `ubuntu-latest` với `node-version-file: .nvmrc` (`.nvmrc:1` = `24`, `package.json:121` = `24.x`); `package.json:91` dùng `@types/node ^24.10.4`; `node_modules/@types/node/url.d.ts:57-64,370,1055-1057` khai báo `PathToFileUrlOptions { windows?: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | undefined }` (`@since v22.1.0`) và `pathToFileURL(path: string, options?: PathToFileUrlOptions): URL`cho`node:url`. `npm run type-check`baseline thoát mã`0`.                                                                                                                                       |
| 5   | RISK_DISMISSED | [MINOR] | `scripts/visual-qa-runner.test.ts:286-311` | [SRC], [CMD]        | Đã kiểm chứng hai rủi ro hồi quy: (a) trong `validateScriptPath` (`scripts/visual-qa-runner.mjs:163-189`), `path.isAbsolute(norm) ? path.resolve(norm) : path.resolve(repoRoot, norm)` với `norm = toPosix(s)` vẫn trả về đúng `path.resolve(smokeFile)` trên cả Windows lẫn Linux nên giữ nguyên DI mock `VQ-05` (`scripts/visual-qa-runner.test.ts:286-311`) và khớp mẫu `.agents/scripts/guard-paths.js:47`; (b) bọc `{ ... }` tại `src/lib/features/chat/googleDocsResolver.server.ts:420-421` không đổi luồng `resolveSheetLink` (`src/lib/features/chat/googleDocsResolver.server.ts:405-454`), xóa duy nhất cảnh báo `curly` ghi nhận bởi `npm run lint` (`421:7 warning Expected { after 'if' condition  curly`), và mỗi dòng `<= 60` ký tự dưới ngưỡng `printWidth: 100` (`.prettierrc:5`).                                                                                                                                                                                                                                                                                                                                                             |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                    | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Plan Completeness Gate (7/7 mục + Skills)**          | PASS    | [CMD], [SRC] | `verify-plan.mjs` đạt `SECTIONS 7/7`, 44/44 `LINE_REF` hợp lệ; đã ánh xạ đầy đủ `.agents/skills/vikini-debug/SKILL.md` và các rules liên quan tại Mục 2.                                                                                                                                                                                                                                                                                                       |
| **S1: Cold-start & Build**                             | FAIL    | [SRC], [CMD] | Baseline `npm run type-check` exit `0`, `npm run lint` xác nhận 1 warning tại `googleDocsResolver.server.ts:421`, `eslint --print-config` xác nhận `"curly": [1, "multi-line"]`, `pathToFileURL(..., { windows })` hợp lệ với Node 24 & `@types/node ^24.10.4` (`url.d.ts:57-64,370`). Tuy nhiên **Finding #2 (`[MAJOR]`)**: thiếu cập nhật JSDoc `@param {string                                                                                              | undefined} metaUrl`tại`scripts/visual-qa-runner.mjs:526`sẽ làm`tsc --noEmit`thất bại khi Bước 3 truyền`undefined`cho`metaUrl`. |
| **S2: Runner Lifecycle & Teardown**                    | FAIL    | [SRC], [ADV] | `afterEach` dọn `tmpBase` (`scripts/visual-qa-runner.test.ts:128-133`) và `killProcessTree` dùng `path.win32.join` (`scripts/visual-qa-runner.mjs:260-265`) đạt chuẩn. Tuy nhiên **Finding #1 (`[MAJOR]`)**: `isMainModule` (`scripts/visual-qa-runner.mjs:527-533`) chưa chặn đường dẫn thiếu ổ đĩa sau `path.win32.resolve` trên Linux CI, khiến Negative Probe `TC-VQ-16b (NP-2)` mục (4) trượt trên `ubuntu-latest`.                                       |
| **S3: Database & Temporal Logic**                      | N/A     | —            | Kế hoạch không chỉnh sửa bảng Supabase, SQL migration, RLS policy hay logic thời gian/múi giờ.                                                                                                                                                                                                                                                                                                                                                                 |
| **S4: Cross-Task State Flow**                          | PASS    | [SRC]        | Không đụng Zustand/SWR/URL state; chữ ký export hiện hữu của `scripts/visual-qa-runner.mjs` và `src/lib/features/chat/googleDocsResolver.server.ts` được giữ tương thích ngược, DI mock `VQ-05` (`scripts/visual-qa-runner.test.ts:286-311`) bảo toàn.                                                                                                                                                                                                         |
| **S5: Security Boundary & 3-Tier Auth**                | PASS    | [SRC]        | `norm = toPosix(s)` + `path.posix.extname(toPosix(p))` tại `scripts/visual-qa-runner.mjs:141-189` chặn nhất quán dotfile (`"tests\\.js"`), traversal (`"tests\\..\\..\\outside.js"`), `.env*` (`.agents/scripts/guard-paths.js:69-93`) và post-realpath symlink escape trên cả Linux & Windows. `src/lib/features/chat/googleDocsResolver.server.ts:420-421` giữ nguyên ranh giới `.server.ts`, SSRF guard và phát hiện HTML riêng tư (`docs/security.md:89`). |
| **S6: External Resilience & Serverless Execution Cap** | PASS    | [SRC]        | Không thay đổi `PER_REQUEST_TIMEOUT_MS` (`12_000`), `TOTAL_RESOLVE_TIMEOUT_MS` (`20_000`), `MAX_REDIRECTS` (`5`), `AbortSignal` hay fallback nhánh XLSX→CSV trong `src/lib/features/chat/googleDocsResolver.server.ts:36-38,405-454`.                                                                                                                                                                                                                          |
| **Domain: Open Inquiry (Vikini)**                      | PASS    | [SRC], [CMD] | Không chỉnh sửa UI text song ngữ, `modelRegistry.ts`, quota/context window hay vòng đời attachments; đáp ứng kỷ luật 0 lint warnings (`.agents/rules/01-coding.md:17`), `TC-13` không áp dụng cho `googleDocsResolver.server.ts` (`src/lib/config/theme-config.test.ts:453-479`), và đủ bước `/post-fix` (`docs/lessons-learned.md`, `docs/CHANGELOG.md`).                                                                                                     |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Trục 1 — Đồng thời**: `N/A` — Các hàm sửa đổi trong `scripts/visual-qa-runner.mjs` là hàm đồng bộ thuần không dùng shared mutable state; thay đổi tại `src/lib/features/chat/googleDocsResolver.server.ts:420-421` chỉ thêm `{}` không thay đổi luồng bất đồng bộ.
  2. **Trục 2 — Khoảng trống check→use (TOCTOU) & Path Traversal / Dotfile Bypass**:
     - Cơ chế: `validateScriptPath` (`scripts/visual-qa-runner.mjs:163-189`).
     - `T1`: Caller trên Linux truyền `"tests\\.js"` hoặc `"tests\\..\\..\\outside.js"` hoặc symlink tới `.env.local` / `/tmp/outside/escape.js`.
     - `T2`: `norm = toPosix(s)` biến `\` thành `/`; nhánh `".."` chặn traversal; `checkSecretAndExt(norm)` gọi `isEnvSecretPath` + `path.posix.extname("tests/.js") === ""` chặn dotfile trước `statSync`; nhánh hậu-`realpathSync` kiểm tra lại `checkSecretAndExt(real)` và `isInsideAllowedRoots`.
     - `T3`: Hàm trả `{ ok: false, reason }` trước mọi lệnh `spawn`.
     - Kết cục: Không thể vượt rào allowlist trên Linux lẫn Windows -> **An toàn**.
  3. **Trục 3 — Thất bại giữa chừng / Malformed Input & Cross-OS Fallback**:
     - Cơ chế: `isMainModule` (`scripts/visual-qa-runner.mjs:527-533`) chạy trên Linux CI (`ubuntu-latest`, `process.cwd() = "/home/runner/work/vikini"`).
     - `T1`: Test `TC-VQ-16b (NP-2)` mục (4) gọi `isMainModule("file:///home/runner/work/vikini/scripts/visual-qa-runner.mjs", "/home/runner/work/vikini/scripts/visual-qa-runner.mjs", "win32")`.
     - `T2`: `path.win32.resolve("/home/...")` thấy `resolvedDevice === ""` nên gọi `process.cwd()` của Linux (không có ổ đĩa) → trả `"\\home\\runner\\work\\vikini\\scripts\\visual-qa-runner.mjs"`. `pathToFileURL("\\home\\...", { windows: true })` không ném ngoại lệ mà chuẩn hóa thành `"file:///home/runner/work/vikini/scripts/visual-qa-runner.mjs"`.
     - `T3`: `metaUrl.toLowerCase() === expected.toLowerCase()` trả `true` trên Linux CI trong khi trả `false` trên Windows (nơi `process.cwd()` ghép `C:`).
     - Kết cục: Sai hợp đồng `TC-VQ-16b (NP-2)` trên Linux CI -> **Lỗi (`[MAJOR]`, Finding #1)**.
  4. **Trục 4 — Môi trường Serverless / Khác Biệt OS CI (`ubuntu-latest` vs Windows)**:
     - Cơ chế: GitHub Actions Linux CI (`.github/workflows/ci.yml:12,21`) chạy Node 24 (`ubuntu-latest`) và `lint-staged` Prettier (`.prettierrc:5`, `package.json:131-138`).
     - `T1`: Code được kiểm thử trên Windows dev, commit qua `lint-staged`, sau đó chạy `type-check`, `lint`, `test:run` trên `ubuntu-latest`.
     - `T2`: Nhánh `googleDocsResolver.server.ts:420-421` sau khi bọc `{}` giữ định dạng ổn định với Prettier và đạt 0 warnings; `validateScriptPath` và `killProcessTree` nhất quán giữa Windows/Linux. Riêng `isMainModule` còn lệ thuộc ngầm vào `process.cwd()` của OS chủ khi đường dẫn thiếu gốc tuyệt đối của `platform` mục tiêu (Finding #1) và thiếu mở rộng JSDoc `metaUrl` dưới `// @ts-check` (Finding #2).
     - `T3`: Nếu không bổ sung kiểm tra gốc tuyệt đối + JSDoc `string | undefined`, pipeline sẽ thất bại tại `tsc --noEmit` hoặc `vitest run` trên `ubuntu-latest`.
     - Kết cục: Cần sửa 2 lỗi `[MAJOR]` ở Revision 2 trước khi chuyển sang Independent Critic Pass -> **Lỗi (`[MAJOR]`)**.

- **Commands Executed (Read-Only Allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-visual-qa-runner-linux-ci-and-lint.md` — exit `0` (`VERIFY_PLAN: PASS`, `CRITIC_REQUIRED yes`).
  2. `npm run type-check` — exit `0` (`tsc --noEmit` sạch baseline).
  3. `npm run lint` — exit `0`, xác nhận 1 warning duy nhất: `src/lib/features/chat/googleDocsResolver.server.ts:421:7 warning Expected { after 'if' condition  curly`.
  4. `npx eslint --print-config src/lib/features/chat/googleDocsResolver.server.ts` — exit `0`, xác nhận `"curly": [1, "multi-line"]`.
  5. `npx vitest run scripts/visual-qa-runner.test.ts src/lib/features/chat/googleDocsResolver.server.test.ts --reporter=dot` — exit `0` (`2 passed`, `24 passed` trên Windows baseline).
  6. `git status` — exit `0` (workspace sạch, chỉ có kế hoạch chưa theo dõi và `tsconfig.tsbuildinfo`).

#### 4. Kết Luận

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-visual-qa-runner-linux-ci-and-lint.md` (exit `0`):

```text
[PASS] SECTIONS 7/7
[PASS] LINE_REF .github/workflows/ci.yml:12
[PASS] LINE_REF .github/workflows/ci.yml:34
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:221-230
[PASS] LINE_REF scripts/visual-qa-runner.mjs:163-189
[PASS] LINE_REF .agents/scripts/guard-paths.js:47
[PASS] LINE_REF scripts/visual-qa-runner.mjs:141-148
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:771-777
[PASS] LINE_REF scripts/visual-qa-runner.mjs:526
[PASS] LINE_REF scripts/visual-qa-runner.mjs:527-533
[PASS] LINE_REF scripts/visual-qa-runner.mjs:260-265
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:418-422
[PASS] LINE_REF src/lib/features/chat/googleDocsResolver.server.ts:420-421
[PASS] LINE_REF .agents/rules/01-coding.md:17
[PASS] LINE_REF eslint.config.mjs:91
[PASS] LINE_REF scripts/verify-plan.mjs:339
[PASS] LINE_REF scripts/visual-qa-runner.mjs:171
[PASS] LINE_REF scripts/visual-qa-runner.mjs:144
[PASS] LINE_REF scripts/visual-qa-runner.mjs:1
[PASS] LINE_REF tsconfig.json:4
[PASS] LINE_REF tsconfig.json:6
[PASS] LINE_REF scripts/visual-qa-runner.mjs:261-265
[PASS] LINE_REF eslint.config.mjs:11
[PASS] LINE_REF package.json:121
[PASS] LINE_REF .github/workflows/ci.yml:21
[PASS] LINE_REF node_modules/@types/node/url.d.ts:57-64
[PASS] LINE_REF node_modules/@types/node/url.d.ts:370
[PASS] LINE_REF node_modules/@types/node/path.d.ts:178-183
[PASS] LINE_REF scripts/visual-qa-runner.test.ts:286-311
[PASS] LINE_REF docs/lessons-learned.md:896-901
[PASS] LINE_REF package.json:91
[PASS] LINE_REF package.json:102
[PASS] LINE_REF package.json:118
[PASS] LINE_REF vitest.config.ts:1-31
[PASS] LINE_REF package.json:116
[PASS] LINE_REF tsconfig.json:1-36
[PASS] LINE_REF package.json:112
[PASS] LINE_REF docs/lessons-learned.md:414-438
[PASS] LINE_REF docs/CHANGELOG.md:11
[PASS] LINE_REF src/lib/features/chat/googleDocsResolver.server.ts:419-422
[PASS] LINE_REF scripts/visual-qa-runner.mjs:163-172
[PASS] LINE_REF scripts/visual-qa-runner.mjs:526-533
[PASS] LINE_REF src/lib/features/chat/googleDocsResolver.server.ts:420-422
[PASS] LINE_REF scripts/visual-qa-runner.mjs:257-278
[PASS] LINE_REF .agents/scripts/command-policy.js:336-349
[PASS] LINE_REF .github/workflows/ci.yml:27-34
[PASS] LINE_REF scripts/visual-qa-runner.mjs:166
[PASS] LINE_REF .agents/scripts/guard-paths.js:69-93
[PASS] LINE_REF scripts/visual-qa-runner.mjs:179-187
[PASS] LINE_REF scripts/visual-qa-runner.mjs:549
[PASS] LINE_REF node_modules/@types/node/path.d.ts:183
[INFO] CRITIC_REQUIRED yes (src/lib/features/chat/googleDocsResolver.server.ts)
[PASS] CRITIC_FLOOR 5 findings with valid file:line
VERIFY_PLAN: PASS (0 failures, 0 warnings)
```

- **Đối soát lỗi Audit Run 1 (Revision 2)**:

| Lỗi Audit Run 1                                                                                                                      | Mức                                        | Trạng thái | Bằng chứng đối soát                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| #1: Driveless `path.win32.resolve` / cross-OS `process.cwd()` fallback trong `isMainModule` (`scripts/visual-qa-runner.mjs:527-533`) | `[MAJOR]`                                  | **ĐÃ SỬA** | `[SRC]` `scripts/visual-qa-runner.mjs:527-533`, `node_modules/@types/node/url.d.ts:57-64,370`, `[ADV]`: Revision 2 thêm tiền kiểm `!isWin && /^[A-Za-z]:[\\/]/.test(argv1)` trước `resolve`, xác thực gốc tuyệt đối sau `pathImpl.resolve(argv1)` (`/^(?:[A-Za-z]:\\ | \\\\[^\\]+\\[^\\]+)/`cho`win32`; `resolved.startsWith("/")`cho`!isWin`), nâng R2 lên Cao kèm technical control, và bổ sung probe driveless `"\\home\\runner\\..."`+`"C:\\Users\\..."`/`"c:/Users/..."`tại`VQ-16`/`TC-VQ-16b (NP-2)`. |
| #2: Lệch JSDoc `@param {string} metaUrl` dưới `// @ts-check` (`scripts/visual-qa-runner.mjs:526`)                                    | `[MAJOR]`                                  | **ĐÃ SỬA** | `[SRC]` `scripts/visual-qa-runner.mjs:1,526`, `tsconfig.json:4,6`: Revision 2 mở rộng rõ ràng JSDoc dòng `526` thành `@param {string                                                                                                                                 | undefined} metaUrl`ở Mục 1, 3, 5, 6, Bước 1 và`TC-VQ-16b (NP-2)`, khớp với guard runtime và đảm bảo `isMainModule(undefined, ...)`không phát sinh`TS2345`khi chạy`tsc --noEmit`.                                                     |
| #3: Lệnh `WP-1` dùng pipe `                                                                                                          | Select-String` (`eslint.config.mjs:11,91`) | `[MINOR]`  | **ĐÃ SỬA**                                                                                                                                                                                                                                                           | `[SRC]` `.agents/scripts/command-policy.js:336-349`, `[CMD]` `npx eslint --print-config`: Revision 2 bỏ `                                                                                                                            | Select-String`khỏi`WP-1`, gọi trực tiếp `npx eslint --print-config`cho cả`googleDocsResolver.server.ts`và`visual-qa-runner.mjs`. |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                  | Bằng chứng          | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------- | ------- | ------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `scripts/visual-qa-runner.mjs:527-533`                       | [SRC]               | Trong nhánh POSIX `else if (!resolved.startsWith("/")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |     | /^[A-Za-z]:[\\/]/.test(resolved))`ở thiết kế`isMainModule`(Mục 6 & Bước 1), vế sau`/^[A-Za-z]:[\\/]/.test(resolved)`dư thừa về mặt logic vì chuỗi bắt đầu bằng`"/"`không thể bắt đầu bằng ký tự ổ đĩa`[A-Za-z]:`. Có thể rút gọn thành `else if (!resolved.startsWith("/")) return false;` khi triển khai (không gây lỗi runtime hay hồi quy; không chặn phê duyệt). |
| 2   | RISK_DISMISSED | [MINOR] | `scripts/visual-qa-runner.mjs:526-533`                       | [SRC], [ADV], [URL] | Bác bỏ rủi ro rò rỉ `process.cwd()` cross-OS và lỗi biên dịch `TS2345`: đã lần theo đầy đủ 10 kịch bản hai chiều Windows ↔ Linux (ổ đĩa thường `c:\`, mixed `/` + dot-segments, spaces + `#` + `%`, UNC `\\server\share\...`, POSIX chuẩn, POSIX `"/home/..."` & driveless `"\\home\\..."` dưới `win32`, `"C:\\Users\\..."` & `"c:/Users/..."` & relative `"foo\\bar.mjs"` dưới `linux`, malformed extended UNC `\\?\UNC\` bắt bởi `try/catch`, và `metaUrl: undefined`). Kết quả đồng nhất trên cả Windows lẫn Linux CI và khớp chữ ký `node_modules/@types/node/url.d.ts:57-64,370` + `tsconfig.json:4,6`. |
| 3   | RISK_DISMISSED | [MINOR] | `.agents/scripts/command-policy.js:336-349`                  | [SRC], [CMD]        | Bác bỏ rủi ro lệnh `WP-1` bị chặn hoặc lệch ESLint config giữa `.ts` và `.mjs`: đã chạy thực tế `npx eslint --print-config src/lib/features/chat/googleDocsResolver.server.ts` (exit `0`, `"curly": [1, "multi-line"]`) và `npx eslint --print-config scripts/visual-qa-runner.mjs` (exit `0`, `js.configs.recommended`, `no-undef: [2]`, `no-unused-vars: [2]`), khớp chính xác quy tắc 4 token tại `.agents/scripts/command-policy.js:336-349` và `eslint.config.mjs:9,11,91`.                                                                                                                             |
| 4   | RISK_DISMISSED | [MINOR] | `src/lib/features/chat/googleDocsResolver.server.ts:419-422` | [SRC], [CMD]        | Bác bỏ rủi ro lệch luồng fallback Google Sheets hoặc Prettier rewrap gây warning mới: chỉ bọc `{ ... }` quanh lệnh `return buildFailureOutcome(link, "private");` (dòng `<= 60` ký tự `< printWidth: 100` tại `.prettierrc:5`), giữ nguyên nhánh HTML-on-XLSX (`src/lib/features/chat/googleDocsResolver.server.ts:405-454`), không chạm `TC-13` (`src/lib/config/theme-config.test.ts:453-479`), và có test co-located `TC-GD-09-Sheet (NP-4)` tại `src/lib/features/chat/googleDocsResolver.server.test.ts:341-393`.                                                                                       |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                    | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Plan Completeness Gate (7/7 mục + Skills)**          | PASS    | [CMD], [SRC] | `verify-plan.mjs` đạt `SECTIONS 7/7`, 51/51 `LINE_REF` hợp lệ, `0 failures, 0 warnings`; ánh xạ đầy đủ `.agents/skills/vikini-debug/SKILL.md` và các rules liên quan.                                                                                                                                                                                                                                                                          |
| **S1: Cold-start & Build**                             | PASS    | [CMD], [SRC] | Baseline `npm run type-check` exit `0`; `npm run lint` xác nhận đúng 1 warning tại `googleDocsResolver.server.ts:421`; `eslint --print-config` trên cả 2 tệp nguồn exit `0`; `node_modules/@types/node/url.d.ts:57-64,370` + `.github/workflows/ci.yml:21` + `.nvmrc:1` (`24`) xác nhận tương thích `pathToFileURL(..., { windows })`; JSDoc `@param {string                                                                                   | undefined} metaUrl` (`scripts/visual-qa-runner.mjs:526`) đã đồng bộ cho `tsc --noEmit`. |
| **S2: Runner Lifecycle & Teardown**                    | PASS    | [SRC], [ADV] | `afterEach` dọn `tmpBase` (`scripts/visual-qa-runner.test.ts:128-133`), `killProcessTree` dùng `path.win32.join` (`scripts/visual-qa-runner.mjs:260-265`), và `isMainModule` (`scripts/visual-qa-runner.mjs:526-533`) kiểm tra chặt gốc tuyệt đối hai chiều trước `pathToFileURL` trong `try/catch` fail-closed.                                                                                                                               |
| **S3: Database & Temporal Logic**                      | N/A     | —            | Kế hoạch không chỉnh sửa bảng Supabase, SQL migration, RLS policy hay logic múi giờ.                                                                                                                                                                                                                                                                                                                                                           |
| **S4: Cross-Task State Flow**                          | PASS    | [SRC]        | Không đụng Zustand/SWR/URL state; chữ ký public export tương thích ngược (mở rộng `metaUrl` chấp nhận `undefined` là widening an toàn) và giữ nguyên DI mock `p === path.resolve(smokeFile)` của `VQ-05` (`scripts/visual-qa-runner.test.ts:286-311`).                                                                                                                                                                                         |
| **S5: Security Boundary & 3-Tier Auth**                | PASS    | [SRC]        | `norm = toPosix(s)` + `path.posix.extname(toPosix(p))` tại `scripts/visual-qa-runner.mjs:141-189` chặn nhất quán dotfile (`"tests\\.js"`), traversal (`"tests\\..\\..\\outside.js"`), `.env*` (`.agents/scripts/guard-paths.js:69-93`) và symlink escape trên cả Linux & Windows; `src/lib/features/chat/googleDocsResolver.server.ts:420-421` giữ nguyên ranh giới `.server.ts`, SSRF và phát hiện tài liệu riêng tư (`docs/security.md:89`). |
| **S6: External Resilience & Serverless Execution Cap** | PASS    | [SRC]        | Giữ nguyên timeouts `12_000`/`20_000`, `MAX_REDIRECTS = 5`, `AbortSignal` và fallback XLSX→CSV tại `src/lib/features/chat/googleDocsResolver.server.ts:36-38,405-454`.                                                                                                                                                                                                                                                                         |
| **Domain: Open Inquiry (Vikini)**                      | PASS    | [SRC], [CMD] | Không đụng UI text song ngữ, `modelRegistry.ts`, quota/context window hay attachments; đạt chuẩn 0 ESLint warnings (`.agents/rules/01-coding.md:17`), tuân thủ `/post-fix` (`docs/lessons-learned.md`, `docs/CHANGELOG.md`), và giữ nguyên phạm vi không chạm `.agents/**` hay git mutating.                                                                                                                                                   |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Trục 1 — Đồng thời**: `N/A` — Các hàm sửa đổi trong `scripts/visual-qa-runner.mjs` đồng bộ thuần không dùng shared mutable state; thay đổi tại `src/lib/features/chat/googleDocsResolver.server.ts:420-421` chỉ thêm `{}` không đổi luồng bất đồng bộ.
  2. **Trục 2 — Khoảng trống check→use (TOCTOU) & Path Traversal / Dotfile Bypass**:
     - Cơ chế: `validateScriptPath` (`scripts/visual-qa-runner.mjs:163-189`).
     - `T1`: Caller trên Linux truyền `"tests\\.js"`, `"tests\\..\\..\\outside.js"`, hoặc symlink trong `tests/` trỏ ra `.env.local` / `/tmp/outside/escape.js`.
     - `T2`: `norm = toPosix(s)` biến `\` thành `/`; nhánh `".."` chặn traversal; `checkSecretAndExt(norm)` gọi `isEnvSecretPath` + `path.posix.extname("tests/.js") === ""` chặn dotfile trước `statSync`; nhánh hậu-`realpathSync` kiểm tra lại `checkSecretAndExt(real)` và `isInsideAllowedRoots`.
     - `T3`: Hàm trả `{ ok: false, reason }` trước bất kỳ `spawn()` nào.
     - Kết cục: Không thể vượt rào allowlist trên Linux lẫn Windows -> **An toàn**.
  3. **Trục 3 — Thất bại giữa chừng / Malformed Input & Cross-OS Root Guard**:
     - Cơ chế: `isMainModule` (`scripts/visual-qa-runner.mjs:526-533`) chạy trên cả Linux CI (`process.cwd() = "/home/runner/work/vikini"`) và Windows (`process.cwd() = "C:\\Users\\wyemh\\vikini"`).
     - `T1`: Caller truyền `("/home/runner/...", "win32")`, `("\\home\\runner\\...", "win32")`, `("C:\\Users\\...", "linux")`, `("\\\\?\\UNC\\", "win32")`, hoặc `metaUrl: undefined`.
     - `T2`: Guard đầu hàm trả `false` cho `undefined`/rỗng; tiền kiểm `!isWin && /^[A-Za-z]:[\\/]/.test(argv1)` chặn đường dẫn Windows dưới `linux`; sau `pathImpl.resolve(argv1)`, kiểm tra `/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/` chặn đường dẫn driveless `"\\home\\..."` trên Linux CI và `!resolved.startsWith("/")` chặn rò rỉ `C:\` trên Windows; `try/catch` quanh `pathToFileURL` bắt `ERR_INVALID_ARG_VALUE` từ `\\?\UNC\`.
     - `T3`: Hàm trả `false` nhất quán trên cả hai OS, không kích hoạt `runCli()` khi bị `import()`.
     - Kết cục: Loại bỏ hoàn toàn false-positive cross-OS và crash import -> **An toàn**.
  4. **Trục 4 — Môi trường Serverless / Khác Biệt OS CI (`ubuntu-latest` vs Windows)**:
     - Cơ chế: GitHub Actions Linux CI (`.github/workflows/ci.yml:12,21`) chạy Node 24 (`ubuntu-latest`) và Husky `lint-staged` Prettier (`.prettierrc:5`, `package.json:131-138`).
     - `T1`: Triển khai và chạy test trên Windows, commit qua `lint-staged`, sau đó chạy `type-check`, `lint`, `test:run` trên `ubuntu-latest`.
     - `T2`: `validateScriptPath`, `checkSecretAndExt`, `killProcessTree`, `isMainModule` tách biệt hoàn toàn khỏi `process.platform` và `process.cwd()` của OS chủ khi giả lập nền tảng đối nghịch; nhánh `googleDocsResolver.server.ts:420-422` bọc `{}` ổn định với `prettier --check` và `eslint --max-warnings 0`.
     - `T3`: Toàn bộ pipeline xanh đồng nhất trên Windows và `ubuntu-latest`.
     - Kết cục: Khắc phục triệt để lệch hành vi giữa Windows local và Linux CI -> **An toàn**.

- **Commands Executed (Read-Only Allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-visual-qa-runner-linux-ci-and-lint.md` — exit `0` (`VERIFY_PLAN: PASS`, `SECTIONS 7/7`, 51/51 `LINE_REF`, `CRITIC_REQUIRED yes`).
  2. `npx eslint --print-config scripts/visual-qa-runner.mjs` — exit `0`, xác nhận `js.configs.recommended` (`no-undef: [2]`, `no-unused-vars: [2]`).
  3. (Tái sử dụng kết quả baseline không đổi từ Audit Run 1 trên cùng trạng thái working tree chưa sửa mã nguồn): `npm run type-check` (exit `0`), `npm run lint` (1 warning duy nhất `googleDocsResolver.server.ts:421`), `npx eslint --print-config src/lib/features/chat/googleDocsResolver.server.ts` (`"curly": [1, "multi-line"]`), `npx vitest run scripts/visual-qa-runner.test.ts src/lib/features/chat/googleDocsResolver.server.test.ts --reporter=dot` (`2 passed`, `24 passed`).

#### 4. Kết Luận

Hết lỗi `[BLOCKER]`/`[MAJOR]` (còn 1 góp ý `[MINOR]` không chặn). Do kế hoạch chạm tệp nhạy cảm `src/lib/features/chat/googleDocsResolver.server.ts` (`CRITIC_REQUIRED yes`), chuyển `- **Status**: Awaiting Critic` và chờ phiên **Independent Critic Pass** độc lập.

[AWAITING_CRITIC]

---

### Audit Run 3 (Independent Critic Pass)

[REVIEWER_MODEL: gemini-4-argon (critic)]

CRITIC_VERDICT: AGREE

#### 1. Output verify-plan.mjs & Kiểm Chứng Độc Lập

- Phiên `@reviewer` độc lập (zero shared history) cho bề mặt nhạy cảm `src/lib/features/chat/googleDocsResolver.server.ts` (`CRITIC_REQUIRED yes`).
- Output `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-visual-qa-runner-linux-ci-and-lint.md` (exit `0`):

```text
[PASS] SECTIONS 7/7
[PASS] LINE_REF (51/51 refs verified: .github/workflows/ci.yml, scripts/visual-qa-runner.mjs, scripts/visual-qa-runner.test.ts, .agents/scripts/guard-paths.js, .agents/scripts/command-policy.js, src/lib/features/chat/googleDocsResolver.server.ts, eslint.config.mjs, tsconfig.json, package.json, vitest.config.ts, node_modules/@types/node/{url,path}.d.ts, docs/{lessons-learned,CHANGELOG}.md)
[INFO] CRITIC_REQUIRED yes (src/lib/features/chat/googleDocsResolver.server.ts)
[PASS] CRITIC_FLOOR 4 findings with valid file:line
VERIFY_PLAN: PASS (0 failures, 0 warnings)
```

- **Xác minh độc lập các lỗi Audit Run 1–2**:
  - Lỗi #1 Audit Run 1 (driveless `path.win32.resolve` / cross-OS `process.cwd()` fallback tại `scripts/visual-qa-runner.mjs:527-533`): **ĐÃ SỬA** (`[SRC]` `scripts/visual-qa-runner.mjs:526-533`, `node_modules/@types/node/url.d.ts:57-64,370`, `[ADV]`).
  - Lỗi #2 Audit Run 1 (lệch JSDoc `@param {string} metaUrl` dưới `// @ts-check` tại `scripts/visual-qa-runner.mjs:526`): **ĐÃ SỬA** (`[SRC]` `scripts/visual-qa-runner.mjs:1,526`, `tsconfig.json:4,6`).
  - Lỗi #3 Audit Run 1 (`WP-1` dùng pipe `| Select-String`): **ĐÃ SỬA** (`[SRC]` `.agents/scripts/command-policy.js:336-349`, `[CMD]` `npx eslint --print-config`).
  - Góp ý `[MINOR]` Audit Run 2 (vế dư `/^[A-Za-z]:[\\/]/` sau `!resolved.startsWith("/")` trong nhánh POSIX `isMainModule`): giữ ở mức `[MINOR]` không chặn.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                  | Bằng chứng          | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------- | ------- | ------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `scripts/visual-qa-runner.test.ts:120`                       | [SRC]               | Trong Bước 3 và `TC-VQ-05a (NP-1)`, kế hoạch dùng `"scripts\\bad.ps1"` làm probe phần mở rộng với backslash, trong khi `beforeEach` (`scripts/visual-qa-runner.test.ts:120`) chỉ tạo tệp thật `tests/bad.ps1` (không tạo `scripts/bad.ps1`). Dù `checkSecretAndExt` từ chối ở bước pre-check trước `fs.statSync` nên test vẫn đạt, dùng hoặc bổ sung `"tests\\bad.ps1"` (tệp tồn tại trên đĩa) sẽ kiểm chứng chặt hơn việc từ chối phần mở rộng ngay cả khi tệp đích có thật (không chặn phê duyệt).                                                                                                                                                                                                                                                                                                                                                                            |
| 2   | RISK_DISMISSED | [MINOR] | `src/lib/features/chat/googleDocsResolver.server.ts:419-454` | [SRC], [CMD]        | Bác bỏ rủi ro SSRF/redirect/fallback regression trên bề mặt nhạy cảm `*.server.ts`: thay đổi chỉ bọc `{ ... }` quanh lệnh `return buildFailureOutcome(link, "private");` tại dòng `420-421` (độ dài dòng sau khi bọc là 60 và 50 ký tự, thấp hơn `printWidth: 100` tại `.prettierrc:5`). Toàn bộ chốt chặn SSRF/redirect (`fetchGoogleExportSafely`, `193-300`), giới hạn byte stream (`readStreamWithCap`, `158-191`), kiểm tra magic bytes / Zip-Bomb (`142-150,422-425`), thoát delimiter prompt-injection (`108-110`), và dọn tệp tạm Gemini (`599-623`) giữ nguyên vẹn. Chạy trực tiếp `npm run lint` xác nhận `googleDocsResolver.server.ts:421:7` là cảnh báo duy nhất toàn repo; `npx eslint --print-config` xác nhận `"curly": [1, "multi-line"]`; ba nhánh `isHtmlPayload` còn lại (`438`, `465`, `526`) đều dài 97 ký tự (`<= 100`) nên không bị Prettier tách dòng. |
| 3   | RISK_DISMISSED | [MINOR] | `scripts/visual-qa-runner.mjs:141-189`                       | [SRC], [ADV]        | Bác bỏ rủi ro vượt rào allowlist hoặc phá vỡ DI mock `VQ-05`: chuẩn hóa `norm = toPosix(s)` trước kiểm tra `".."`, `checkSecretAndExt(norm)` (`path.posix.extname(toPosix(p))`), và `path.isAbsolute(norm) ? path.resolve(norm) : path.resolve(repoRoot, norm)` khớp mẫu `.agents/scripts/guard-paths.js:47`, chặn nhất quán dotfile `"tests\\.js"`, traversal `"tests\\..\\..\\outside.js"`, `.env*` (`.agents/scripts/guard-paths.js:69-93`), đường dẫn drive-relative, và symlink/junction escape hậu-`realpathSync` (`179-187`) trên cả Windows và Linux; đồng thời bảo toàn khớp chuỗi `p === path.resolve(smokeFile)` trong `VQ-05` (`scripts/visual-qa-runner.test.ts:286-311`).                                                                                                                                                                                         |
| 4   | RISK_DISMISSED | [MINOR] | `scripts/visual-qa-runner.mjs:526-533`                       | [SRC], [ADV], [CMD] | Bác bỏ rủi ro lệch hành vi cross-OS trên `isMainModule` và `killProcessTree` (`scripts/visual-qa-runner.mjs:260-265`): mở rộng JSDoc `@param {string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | undefined} metaUrl` (`526`) khớp `// @ts-check` (`1`) + `tsconfig.json:4,6`; tiền kiểm `!isWin && /^[A-Za-z]:[\\/]/.test(argv1)` và kiểm tra gốc tuyệt đối hậu-`resolve` (`/^(?:[A-Za-z]:\\ | \\\\[^\\]+\\[^\\]+)/`cho`win32`; `resolved.startsWith("/")`cho`!isWin`) loại bỏ cả driveless `"\\home\\..."`, drive-relative `"c:foo\\bar.mjs"`, lẫn rò rỉ `C:\` của `process.cwd()` khi giả lập `linux` trên Windows; `pathToFileURL(normalized, { windows: isWin })` (`node_modules/@types/node/url.d.ts:57-64,370`) bọc `try/catch` fail-closed và không có regex useless escape dưới `js.configs.recommended` (`npx eslint --print-config scripts/visual-qa-runner.mjs`). Lưu ý triển khai cho `TC-VQ-16a` nhánh UNC: `pathToFileURL("\\\\server\\share\\scripts\\visual-qa-runner.mjs", { windows: true }).href` trả `"file://server/share/scripts/visual-qa-runner.mjs"` (2 gạch chéo, `server` là host). |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                    | Kết quả | Bằng chứng   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Plan Completeness Gate (7/7 mục + Skills)**          | PASS    | [CMD], [SRC] | `verify-plan.mjs` đạt `SECTIONS 7/7`, 51/51 `LINE_REF` hợp lệ; ánh xạ đúng `.agents/skills/vikini-debug/SKILL.md` và các rules `.agents/rules/{01-coding,02-quality,05-plan-review}.md`.                                                                                                                                                                                                        |
| **S1: Cold-start & Build**                             | PASS    | [CMD], [SRC] | Độc lập chạy `npm run type-check` (exit `0`), `npm run lint` (1 warning duy nhất tại `googleDocsResolver.server.ts:421:7`), `npx eslint --print-config` trên cả 2 tệp mục tiêu (exit `0`); `node_modules/@types/node/url.d.ts:57-64,370`, `path.d.ts:178-183`, `package.json:91,121`, `.github/workflows/ci.yml:12,21` xác nhận Node 24 + `@types/node ^24.10.4`; JSDoc `@param {string         | undefined} metaUrl` (`scripts/visual-qa-runner.mjs:526`) khớp `tsconfig.json:4,6`.      |
| **S2: Runner Lifecycle & Teardown**                    | PASS    | [SRC], [ADV] | `afterEach` dọn `tmpBase` (`scripts/visual-qa-runner.test.ts:128-133`), `killProcessTree` chuyển sang `path.win32.join` (`scripts/visual-qa-runner.mjs:260-265`), `detached: platform !== "win32"` (`407`) và `createLifecycleGuard` (`365-397`) giữ nguyên; `isMainModule` (`526-533`) fail-closed trên mọi đầu vào cross-OS/malformed.                                                        |
| **S3: Database & Temporal Logic**                      | N/A     | —            | Kế hoạch không thay đổi bảng Supabase, SQL migration, RLS policy hay logic múi giờ.                                                                                                                                                                                                                                                                                                             |
| **S4: Cross-Task State Flow**                          | PASS    | [SRC]        | Không đụng Zustand/SWR/URL state; chữ ký public export tương thích ngược (`metaUrl` mở rộng sang `string                                                                                                                                                                                                                                                                                        | undefined`), không phá vỡ DI mock `VQ-05` (`scripts/visual-qa-runner.test.ts:286-311`). |
| **S5: Security Boundary & 3-Tier Auth**                | PASS    | [SRC], [ADV] | `validateScriptPath` + `checkSecretAndExt` (`scripts/visual-qa-runner.mjs:141-189`) bảo toàn rào chắn `.env*`, traversal, dotfile, và post-realpath allowlist trên cả Linux lẫn Windows; `src/lib/features/chat/googleDocsResolver.server.ts:420-421` giữ nguyên ranh giới `.server.ts`, SSRF/redirect hop-by-hop guard, Zip-Bomb guard và phát hiện tài liệu riêng tư (`docs/security.md:89`). |
| **S6: External Resilience & Serverless Execution Cap** | PASS    | [SRC]        | Không thay đổi `PER_REQUEST_TIMEOUT_MS` (`12_000`), `TOTAL_RESOLVE_TIMEOUT_MS` (`20_000`), `MAX_REDIRECTS` (`5`), `AbortSignal` cleanup (`297-298`) hay luồng fallback XLSX→CSV (`405-454`) trong `src/lib/features/chat/googleDocsResolver.server.ts`.                                                                                                                                         |
| **Domain: Open Inquiry (Vikini)**                      | PASS    | [SRC], [CMD] | Không sửa UI text song ngữ, `modelRegistry.ts`, giới hạn token/quota, hay vòng đời attachments; thỏa kỷ luật 0 lint warnings (`.agents/rules/01-coding.md:17`), đủ bước `/post-fix` (`docs/lessons-learned.md`, `docs/CHANGELOG.md`), không chạm tệp governance `.agents/**`.                                                                                                                   |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục)**:
  1. **Trục 1 — Đồng thời**: `N/A` — Các hàm sửa trong `scripts/visual-qa-runner.mjs` đồng bộ thuần không dùng shared mutable state; chỉnh sửa tại `src/lib/features/chat/googleDocsResolver.server.ts:420-421` chỉ thêm cặp `{}` tương đương AST, không đổi luồng bất đồng bộ.
  2. **Trục 2 — Khoảng trống check→use (TOCTOU) & Path Traversal / Dotfile / SSRF**:
     - Cơ chế A (`validateScriptPath`, `scripts/visual-qa-runner.mjs:163-189`): `T1` caller trên Linux truyền `"tests\\.js"`, `"tests\\..\\..\\outside.js"`, hoặc symlink trỏ `.env.local` / `/tmp/outside/escape.js` | `T2` `norm = toPosix(s)` chạy trước `".."` và `checkSecretAndExt(norm)` (`path.posix.extname`), sau `statSync` tiếp tục chạy `realpathSync` → `checkSecretAndExt(real)` → `isInsideAllowedRoots` | `T3` trả `{ ok: false, reason }` trước khi gọi `spawn()`. Kết cục: Không thể vượt rào allowlist -> **An toàn**.
     - Cơ chế B (`resolveSheetLink`, `src/lib/features/chat/googleDocsResolver.server.ts:405-454`): `T1` link Google Sheet riêng tư trả HTTP `200` `text/html` (hoặc redirect sang host ngoài / metadata IP) | `T2` `fetchGoogleExportSafely` chặn redirect/SSRF từng hop (`219-262`), còn HTTP 200 HTML bị nhánh `if (isHtmlPayload(xlsxRes.contentType, xlsxRes.bytes)) { return buildFailureOutcome(link, "private"); }` chặn ngay | `T3` trả `GOOGLE_DOC_PRIVATE` sau đúng 1 lần `fetch`, không gọi `parseXlsxWithExcelJs` và không fallback CSV. Kết cục: Không có hồi quy bảo mật hay fallback sai -> **An toàn**.
  3. **Trục 3 — Thất bại giữa chừng / Malformed Input & Cross-OS Root Guard**:
     - Cơ chế (`isMainModule`, `scripts/visual-qa-runner.mjs:526-533`): `T1` caller truyền đường dẫn POSIX `"/home/runner/..."`, driveless `"\\home\\runner\\..."`, drive-relative `"c:foo\\bar.mjs"`, hoặc malformed `"\\\\?\\UNC\\"` với `platform: "win32"` trên Linux CI, hoặc truyền `"C:\\Users\\..."` / relative `"foo\\bar.mjs"` với `platform: "linux"` trên Windows, hoặc `metaUrl: undefined` | `T2` guard kiểu chặn `undefined`/rỗng, tiền kiểm chặn ổ đĩa dưới `!isWin`, kiểm tra gốc tuyệt đối hậu-`resolve` chặn driveless/drive-relative và rò rỉ `C:\`, khối `try/catch` bắt `ERR_INVALID_ARG_VALUE` từ `pathToFileURL` | `T3` trả `false` nhất quán trên cả hai OS và không kích hoạt `runCli()` khi `import()`. Kết cục: Fail-closed trên mọi đầu vào bất thường -> **An toàn**.
  4. **Trục 4 — Môi trường Serverless / Khác Biệt OS CI (`ubuntu-latest` vs Windows)**:
     - Cơ chế: GitHub Actions `ubuntu-latest` (`.github/workflows/ci.yml:12,21`) chạy Node 24 + `lint-staged` Prettier (`package.json:131-138`, `.prettierrc:5`). `T1` sửa code trên Windows, commit qua `lint-staged`, chạy CI trên Linux | `T2` mọi hàm giả lập OS (`isMainModule`, `killProcessTree`) dùng tường minh `path.win32`/`path.posix` và `{ windows: isWin }`; `validateScriptPath` dùng `toPosix`; dòng `420-422` của `googleDocsResolver.server.ts` ổn định dưới Prettier (`<= 60` ký tự) | `T3` `type-check`, `lint`, `test:run` đồng nhất giữa Windows và `ubuntu-latest`. Kết cục: Khắc phục triệt để sai lệch giữa Windows local và Linux CI -> **An toàn**.

- **Commands Executed (Read-Only Allowlist)**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-22-fix-visual-qa-runner-linux-ci-and-lint.md` — exit `0` (`VERIFY_PLAN: PASS`, `SECTIONS 7/7`, `CRITIC_REQUIRED yes`, `CRITIC_FLOOR` PASS).
  2. `npm run type-check` — exit `0` (`tsc --noEmit` sạch baseline).
  3. `npm run lint` — exit `0`, xác nhận đúng 1 warning toàn repo: `src/lib/features/chat/googleDocsResolver.server.ts:421:7 warning Expected { after 'if' condition  curly`.
  4. `npx vitest run scripts/visual-qa-runner.test.ts src/lib/features/chat/googleDocsResolver.server.test.ts --reporter=dot` — exit `0` (`2 passed`, `24 passed` trên Windows baseline).
  5. `git status` — exit `0` (working tree sạch ngoại trừ file plan chưa theo dõi và `tsconfig.tsbuildinfo`).
  6. `npx eslint --print-config src/lib/features/chat/googleDocsResolver.server.ts` — exit `0`, xác nhận `"curly": [1, "multi-line"]`.
  7. `npx eslint --print-config scripts/visual-qa-runner.mjs` — exit `0`, xác nhận `js.configs.recommended` (`no-undef: [2]`, `no-unused-vars: [2]`, `no-useless-escape: [2]`).

#### 4. Kết Luận

`CRITIC_VERDICT: AGREE` — Không phát hiện thêm lỗi `[BLOCKER]` hoặc `[MAJOR]` sau thẩm định độc lập trên mã nguồn thật (chỉ ghi nhận 1 góp ý `[MINOR]` về fixture `"tests\\bad.ps1"` và 1 lưu ý định dạng URL UNC `file://server/share/...` cho `VQ-16`). Đã cập nhật Header sang `- **Status**: Approved`.

[PLAN_APPROVED]
