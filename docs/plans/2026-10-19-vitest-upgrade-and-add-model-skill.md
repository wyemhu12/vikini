# Kế Hoạch Triển Khai: Nâng Cấp Vitest 4.1.12 & Chuẩn Hóa Skill `add-model` Sang `SKILL.md`

- **Revision**: 2
- **Status**: Completed
- **Date**: 2026-10-19
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

> **Revision 2 — xử lý Audit Run 1**: `NEW-01` [MAJOR] → §1 Out of Scope, §3 `A7`, §7 Bước 3.3, §8 `TC-12`, §9 `GATE-1-4`/`WP-4`/`NP-1` (tiêu chí PASS = cổng `[1/5]`–`[4/5]`; `[5/5]` CHANGELOG byte budget là tồn đọng Out of Scope). `NEW-02` → §9 `WP-3` đổi sang probe `node -e` không ghi đĩa, bỏ giả định `coverage/` bị ignore. `NEW-03` → Bước 2.5, `TC-9`, `TC-10`, `NP-3` dùng `node -e`/`git grep`. `NEW-04` → §2 và §3 `A3`: 7 gói `@vitest/*` transitive.

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

**Mục tiêu**

- **G1 — Vitest**: Nâng `vitest`, `@vitest/coverage-v8`, `@vitest/ui` trong `package.json` từ `^4.1.11` lên `^4.1.12` và tái sinh `package-lock.json` sao cho **toàn bộ 9 node `@vitest/*` + 1 node `vitest`** trong lockfile resolve về `4.1.12`. Mục đích: loại bỏ hẳn khả năng resolve về bản `< 4.1.12` và nhận bản backport "Harden manual and redirect mocks" (PR #11580) — follow-up của bản vá CVE-2026-84373.
- **G2 — Skill `add-model`**: Di chuyển `.agents/skills/add-model.md` → `.agents/skills/add-model/SKILL.md` với YAML frontmatter chuẩn `name` + `description` dạng trigger `MANDATORY when ...` (đồng bộ 9/9 skill nội bộ Vikini dạng thư mục), xóa file cũ, cập nhật mọi tham chiếu **đang hoạt động** (`.agents/skills/README.md` ×2, `.gitignore` ×1).

**Out of Scope**

- **Không** nâng lên Vitest 5.x (`latest` = `5.0.5`, major breaking) — chỉ ở nhánh `V4` (`4.1.12`).
- **Không** xử lý 20 cảnh báo `npm audit` khác (low 1 / moderate 7 / high 12; ví dụ `@babel/core`, `@humanfs/node`) — không thuộc brief.
- **Không** chạy `npm audit fix` (sẽ đụng gói ngoài phạm vi).
- **Không** đổi `vitest.config.ts`, `tests/setup.ts`, hay bất kỳ test file nào.
- **Không** viết lại nội dung thân bài của skill `add-model` (body giữ nguyên văn — xem `D2`).
- **Không** sửa các bản ghi lịch sử bất biến: `docs/plans/*.md` cũ, `docs/CHANGELOG.md` các entry cũ, `docs/archive/CHANGELOG-legacy.md` (xem `D3`).
- **Không** đụng `skills-lock.json`, `.claude/skills/` (chỉ quản lý 3 skill bên thứ ba).
- **Không** sửa `scripts/verify-docs.mjs` (đã quét `.agents/skills/**` ở mọi độ sâu).
- **Không** xử lý lỗi tồn đọng `FAIL: CHANGELOG.md exceeds 35,000 bytes` ở cổng `[5/5]` của `scripts/verify-docs.mjs` (`docs/CHANGELOG.md` hiện `129,511` bytes, có từ trước task) — không archive/cắt `docs/CHANGELOG.md`. Hệ quả: lệnh verify-docs vẫn exit `1` do cổng `[5/5]`; tiêu chí PASS của task là cổng `[1/5]`–`[4/5]` (xem `A7`, `TC-12`).
- **Không** chạy `vitest --coverage` hay bất kỳ lệnh nào ghi thư mục `coverage/` (không nằm trong `.gitignore`).

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

**Pre-Work Reading**

| File đã đọc                                                      | Nội dung rút ra                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                                       | Scope tối thiểu, cấm git tự động, Knowledge Freshness (bắt buộc tra online 2026).                                                                                                                                                         |
| `.agents/rules/01-coding.md`                                     | Co-located tests chỉ bắt buộc khi đổi logic `lib/`; task này 0 dòng logic runtime.                                                                                                                                                        |
| `.agents/rules/02-quality.md`                                    | Pre-Work table, Tier 1/2 verify, PowerShell 5.1 dùng `;`, Test Failure Triage A/B/C, Governance-Only Changes (frontmatter YAML bắt buộc, relative path).                                                                                  |
| `.agents/rules/05-plan-review.md`                                | §1: `package.json` thuộc `TEST_INFRA_FILES`, `.agents/**` luôn `ask` → Implementer sẽ gặp prompt xác nhận hợp lệ; §5 cấu trúc phân khu kép.                                                                                               |
| `.agents/skills/README.md`                                       | 2 tham chiếu cũ tới `./add-model.md` (dòng 19, 49).                                                                                                                                                                                       |
| `.agents/skills/add-model.md`                                    | Frontmatter hiện chỉ có `description` (dòng 1–3), thiếu `name`; 57 dòng, 1,709 bytes.                                                                                                                                                     |
| `.agents/skills/*/SKILL.md` (9 file, dòng 1–6)                   | Mẫu frontmatter chuẩn `name` + `description: "MANDATORY when ..."`.                                                                                                                                                                       |
| `.gitignore:38-49`                                               | `.agents/skills/*` bị ignore + whitelist `!` từng skill nội bộ.                                                                                                                                                                           |
| `scripts/verify-docs.mjs:27-301`                                 | Link checker resolve tương đối; bỏ qua `docs/plans/` & `docs/archive/`; shorthand scope gồm `.agents/skills/**`; chuỗi `PASS:`/`FAIL:` của 5 cổng; `[5/5]` byte budget `35,000` → `hasError` → `process.exit(1)` (dòng 267-268, 298-299). |
| `.agents/scripts/code-freeze-guard.js:50-60`                     | `READ_ONLY_COMMANDS`: `npx vitest run` chỉ nhận path + `--reporter`; cờ ghi file (`--coverage`, `--outputFile`) bị loại khỏi allowlist (comment dòng 53-55) → không dùng `--coverage` trong probe.                                        |
| `.agents/scripts/code-freeze-guard.js:74-83`                     | `TEST_INFRA_FILES` chứa `package.json` (không chứa `package-lock.json`).                                                                                                                                                                  |
| `package.json:96-117`, `package-lock.json:5644-5797,16094-16184` | Phiên bản hiện tại của 3 gói trực tiếp và 7 gói `@vitest/*` transitive.                                                                                                                                                                   |
| `vitest.config.ts:1-31`                                          | `environment: "happy-dom"`, `coverage.provider: "v8"` — không đổi.                                                                                                                                                                        |
| `docs/CHANGELOG.md:1-35`                                         | Định dạng entry mới nhất ở đầu.                                                                                                                                                                                                           |

**Skills Loaded & Applied**

| Skill                                        | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` | Chạy `/blast-radius` thủ công bằng grep toàn repo cho chuỗi `add-model` → bảng caller tại §5; xác nhận 0 tham chiếu trong code (`*.ts/*.js/*.mjs/*.json/*.ps1`). |
| `.agents/skills/vikini-simplify/SKILL.md`    | Nguyên tắc "chứng minh 0 tham chiếu bằng grep" trước khi xóa `add-model.md` → Negative Probe NP-3.                                                               |
| `.agents/skills/add-translation/SKILL.md`    | Không áp dụng trực tiếp (không thêm UI text); chỉ giữ nguyên tham chiếu `.agents/skills/add-translation/SKILL.md` đã có ở `add-model.md:46`.                     |

> Không áp dụng: `api-patterns`, `streaming-patterns`, `database-migration`, `add-feature` (task không chạm API route, SSE, DB hay feature mới).

### 3. Assumptions & Cross-Task Dependencies

**Assumptions (có dẫn chứng)**

- **A1** — Hiện tại toàn bộ cây vitest đã ở `4.1.11`. `[SRC]` `package.json:97,98,117` (`^4.1.11`); `package-lock.json:5676` (`@vitest/expect` 4.1.11) … `package-lock.json:16095` (`vitest` 4.1.11). `[CMD]` `npm ls vitest @vitest/mocker` → `vitest@4.1.11`, `@vitest/mocker@4.1.11`, `@vitest/coverage-v8@4.1.11`, `@vitest/ui@4.1.11` (deduped).
- **A2** — `4.1.12` là bản mới nhất của nhánh v4. `[CMD]` `npm view vitest dist-tags` → `"V4": "4.1.12"`, `"latest": "5.0.5"`; phát hành `2026-10-15T14:51:24Z`.
- **A3** — `vitest@4.1.12` pin chính xác 7 gói con ở `4.1.12` (`@vitest/spy|utils|expect|mocker|runner|snapshot|pretty-format` = `4.1.12`) và peer `@vitest/coverage-v8: 4.1.12`, `@vitest/ui: 4.1.12` → **bắt buộc nâng cả 3 gói trực tiếp cùng lúc**, nếu không npm báo `ERESOLVE` peer conflict. `[CMD]` `npm view vitest@4.1.12 dependencies peerDependencies`; `npm view @vitest/coverage-v8@4.1.12 peerDependencies` → `{ vitest: '4.1.12' }`.
- **A4** — Tương thích môi trường: vitest 4.1.12 yêu cầu `vite ^6||^7||^8` (local `vite@7.3.1`) và `node ^20||^22||>=24` (`package.json:120` `"node": "24.x"`, CI `.github/workflows/ci.yml:21` `node-version: 24`). `[CMD]` `node -p require('./node_modules/vite/package.json').version` → `7.3.1`.
- **A5** — File đích `.agents/skills/add-model/SKILL.md` **hiện đang bị git ignore**. `[CMD]` `git check-ignore -v .agents/skills/add-model/SKILL.md` → `.gitignore:40:.agents/skills/*`. Whitelist cũ `!.agents/skills/add-model.md` (`.gitignore:42`) không bao phủ thư mục mới → bắt buộc đổi thành `!.agents/skills/add-model/`.
- **A6** — Không có code runtime/script nào tham chiếu `add-model`. `[CMD]` `grep -rn "add-model" --exclude-dir={node_modules,.next,.git} .` → chỉ: `.agents/skills/README.md:19,49`, `.gitignore:42`, `docs/CHANGELOG.md:33`, `docs/archive/CHANGELOG-legacy.md:1448,1459`, và 4 file `docs/plans/*.md` lịch sử.
- **A7** — `scripts/verify-docs.mjs` sẽ phát hiện link hỏng nếu README không được cập nhật: link checker quét mọi `.md` ngoài `docs/archive/` và `docs/plans/` (`[SRC]` `scripts/verify-docs.mjs:37-42`) và resolve tương đối theo thư mục file (`scripts/verify-docs.mjs:81`), báo `FAIL: Found broken links:` khi `!fs.existsSync` (`scripts/verify-docs.mjs:84,96`).
  **Trạng thái tồn đọng cổng `[5/5]`**: `docs/CHANGELOG.md` hiện `129,511` bytes (`[CMD]` `wc -c docs/CHANGELOG.md`) ≥ `35,000` → cổng `[5/5]` in `FAIL: CHANGELOG.md exceeds 35,000 bytes (...)!` và gán `hasError = true` (`[SRC]` `scripts/verify-docs.mjs:267-268`), dẫn tới `process.exit(1)` và **không** in `ALL DOCUMENTATION VERIFICATION CHECKS PASSED.` (`scripts/verify-docs.mjs:298-301`). Trạng thái này có từ trước task, thuộc Out of Scope, và bước 3.1 (thêm entry) chỉ làm file lớn thêm. → **Tiêu chí PASS** của `node scripts/verify-docs.mjs --strict-shorthand` cho task này: 4 cổng đều in `PASS:` — `[1/5]` `PASS: Scanned N files. Zero broken links found.` (dòng 102), `[2/5]` `PASS: Zero legacy references found in active files.` (dòng 140), `[3/5]` `PASS: All active governance files use full .agents/ prefixes.` (dòng 194), `[4/5]` `PASS: All rules <= 12,000 chars and all agents <= 10,000 chars.` (dòng 230) — và dòng `FAIL:` **duy nhất** được phép là `FAIL: CHANGELOG.md exceeds 35,000 bytes` ở `[5/5]`. Exit code `1` của script là kỳ vọng, không phải lỗi. Lệnh lọc kiểm chứng: **GATE-1-4** tại §9. `[CMD]` Đã chạy GATE-1-4 trên HEAD hiện tại → `GATES 1-4 PASS (verify-docs exit=1)`, exit `0`.

**Cross-Task Dependencies**

- Kế thừa plan `docs/plans/2026-10-19-pstack-skills-and-fast-track-implementation-plan.md` — nơi `add-model.md` được cố ý để Out of Scope (`D3` dòng 95 của plan đó, phương án thay thế đã đề xuất description `MANDATORY when adding or modifying an AI model in modelRegistry.ts or a provider client in src/lib/core/.`). Plan này hiện thực phương án đó.
- Implementer sẽ gặp prompt `ask` của Code Freeze Guard khi sửa `package.json` (`TEST_INFRA_FILES`, `.agents/scripts/code-freeze-guard.js:77`) và `.agents/**` — đây là hành vi đúng, user xác nhận thủ công.

**`[NEEDS_PRODUCT_DECISION]`**

- **D1 — Tiền đề CVE**: Tra cứu 2026 cho thấy CVE-2026-84373 / GHSA-82fw-gwwq-j7x9 (path traversal trong `@vitest/mocker` qua HMR WebSocket, CVSS 5.9) **đã được vá ở `4.1.11`** (affected `>=2.1.0 <4.1.11`). `[CMD]` `npm audit --json` hiện tại **không có entry nào cho `vitest`/`@vitest/*`** (0 trong 20 cảnh báo; không chứa chuỗi `84373`). Bản `4.1.12` chỉ chứa 1 fix "Harden manual and redirect mocks [backport to v4]" (PR #11580, không gắn CVE). → **Default Assumption**: vẫn thực hiện nâng cấp lên `^4.1.12` như brief (patch-level, rủi ro thấp, nhận thêm hardening cùng vùng code `mocker`, và nâng sàn semver để `npm install` không bao giờ resolve về `4.1.11`). Báo cáo cuối phải ghi trung thực rằng audit đã sạch cho vitest **trước** nâng cấp.
- **D2 — Nội dung thân skill lỗi thời**: `add-model.md:36` chỉ dẫn thêm translation vào `lib/utils/config.ts`, trong khi key thật nằm tại `src/lib/utils/translations/{vi,en}.ts` (`[SRC]` `src/lib/utils/translations/en.ts:91` `modelDescFlash25`; `src/lib/utils/config.ts:3` chỉ re-export). → **Default Assumption**: giữ body **nguyên văn** (pure move, để git nhận diện rename và diff tối thiểu); ghi nhận như follow-up. Nếu PM muốn sửa luôn: thay dòng 36 thành `src/lib/utils/translations/vi.ts` và `en.ts` (1 dòng).
- **D3 — Tham chiếu lịch sử**: Brief nói "cập nhật toàn bộ đường dẫn tham chiếu", nhưng `docs/plans/*.md` cũ và `docs/CHANGELOG.md:33`, `docs/archive/CHANGELOG-legacy.md:1448,1459` là bản ghi lịch sử (verify-docs cũng loại trừ chúng khỏi link check). → **Default Assumption**: KHÔNG sửa; chỉ cập nhật tham chiếu đang hoạt động. Thêm entry CHANGELOG mới mô tả việc di chuyển.

### 4. Bảng Verified Versions

| Gói / Công cụ                                              | Hiện tại `[SRC]`                                                          | Mục tiêu             | Xác minh 2026                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest`                                                   | `^4.1.11` (`package.json:117`), lock `4.1.11` (`package-lock.json:16095`) | `^4.1.12` → `4.1.12` | `[CMD]` `npm view vitest dist-tags` (`V4: 4.1.12`); `[URL]` https://github.com/vitest-dev/vitest/releases/tag/v4.1.12                             |
| `@vitest/coverage-v8`                                      | `^4.1.11` (`package.json:97`), lock `package-lock.json:5644`              | `^4.1.12`            | `[CMD]` `npm view @vitest/coverage-v8@4.1.12 version peerDependencies` → `4.1.12`, peer `vitest: 4.1.12`                                          |
| `@vitest/ui`                                               | `^4.1.11` (`package.json:98`), lock `package-lock.json:5773`              | `^4.1.12`            | `[CMD]` `npm view @vitest/ui@4.1.12 version peerDependencies` → `4.1.12`, peer `vitest: 4.1.12`                                                   |
| `@vitest/mocker` (transitive)                              | lock `4.1.11` (`package-lock.json:5693`)                                  | `4.1.12`             | Pin chính xác bởi `vitest@4.1.12` dependencies; `[URL]` https://github.com/vitest-dev/vitest/pull/11580                                           |
| `@vitest/{expect,pretty-format,runner,snapshot,spy,utils}` | lock `4.1.11` (`package-lock.json:5675,5720,5733,5747,5763,5795`)         | `4.1.12`             | Pin chính xác bởi `vitest@4.1.12` dependencies                                                                                                    |
| CVE-2026-84373                                             | Affected `>=2.1.0 <4.1.11`                                                | —                    | `[URL]` https://github.com/advisories/GHSA-82fw-gwwq-j7x9 ; `[URL]` https://osv.dev/vulnerability/CVE-2026-84373 (patched `4.1.11`, `5.0.0-rc.2`) |
| `vite` (peer)                                              | `7.3.1` (node_modules)                                                    | không đổi            | vitest 4.1.12 peer `^6 \|\| ^7 \|\| ^8`                                                                                                           |
| Node.js                                                    | `24.x` (`package.json:120`), local `v24.12.0`                             | không đổi            | vitest 4.1.12 engines `^20 \|\| ^22 \|\| >=24`                                                                                                    |

### 5. Files Cần Chỉnh Sửa / Tạo Mới

| Loại       | File                                | Thay đổi                                                                                                                       |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `[MODIFY]` | `package.json`                      | Dòng 97, 98, 117: `^4.1.11` → `^4.1.12` (do `npm install` ghi, không sửa tay).                                                 |
| `[MODIFY]` | `package-lock.json`                 | Tái sinh bởi `npm install`; 10 node vitest-related → `4.1.12` (kèm `integrity`/`resolved` mới, peer refs trong node `vitest`). |
| `[NEW]`    | `.agents/skills/add-model/SKILL.md` | Frontmatter `name` + `description` mới + body nguyên văn từ `add-model.md:4-57`.                                               |
| `[DELETE]` | `.agents/skills/add-model.md`       | Xóa sau khi `SKILL.md` đã tạo.                                                                                                 |
| `[MODIFY]` | `.gitignore`                        | Dòng 42: `!.agents/skills/add-model.md` → `!.agents/skills/add-model/`.                                                        |
| `[MODIFY]` | `.agents/skills/README.md`          | Dòng 19 và 49: link `./add-model.md` → `./add-model/SKILL.md`, label tương ứng.                                                |
| `[MODIFY]` | `docs/CHANGELOG.md`                 | Thêm entry `## 2026-10-19: Maintenance -- Vitest 4.1.12 & add-model SKILL.md` ở đầu.                                           |

**Blast-radius (`/blast-radius`)**: 0 file `src/**`, 0 file `.agents/scripts/**`, 0 test file bị ảnh hưởng về mặt logic; 81 test file dùng `vi.mock(` (`[CMD]` `grep -rln "vi.mock(" src .agents/scripts tests | wc -l`) chịu ảnh hưởng gián tiếp bởi hardening `@vitest/mocker` → được bao phủ bằng `npm run test:run` toàn bộ.

### 6. Caller-First Design Sketch

**Caller của skill** = agent tra bảng routing `.agents/skills/README.md` hoặc cơ chế auto-trigger đọc frontmatter. Trạng thái mong muốn từ phía caller:

```markdown
<!-- .agents/skills/README.md:19 -->

- [add-model](./add-model/SKILL.md): Quy trình thêm mô hình AI mới vào registry và cấu hình provider.

<!-- .agents/skills/README.md:49 (căn cột giữ nguyên độ rộng bảng, chạy prettier) -->

| **Tích Hợp AI Model Mới** | [.agents/skills/add-model/SKILL.md](./add-model/SKILL.md) | Xác minh SDK năm 2026, cập nhật registry và types. |
```

**Interface frontmatter** (khớp mẫu `.agents/skills/api-patterns/SKILL.md:1-4`):

```markdown
---
name: add-model
description: "MANDATORY when adding or modifying an AI model in src/lib/core/modelRegistry.ts (SELECTABLE_MODELS) or wiring a new provider client in src/lib/core/."
---

# Adding New Models to Vikini

...(body nguyên văn add-model.md:5-57)
```

- `name` = tên thư mục (`add-model`), chữ thường, kebab-case.
- `description` bọc `"..."` (chứa `(`, `)` và `:`-free nhưng thống nhất với 7 skill nội bộ khác), mở đầu `MANDATORY when`.

**Caller của vitest** = `npm run test:run` / `npm run verify` / CI `npm ci` (`.github/workflows/ci.yml:25`). Interface không đổi: `vitest run`, `vitest/config` `defineConfig` (`vitest.config.ts:1`).

### 7. Các Bước Thực Hiện Tuần Tự

**Phase 0 — Baseline (read-only)**

- [ ] 0.1 Ghi baseline: `npm ls vitest @vitest/mocker @vitest/coverage-v8 @vitest/ui` (kỳ vọng `4.1.11`) và `npm run test:run -- --reporter=dot` (ghi lại tổng số test pass/fail để so sánh).
- [ ] 0.2 Ghi baseline audit cho vitest: `npm audit --json` → lọc key chứa `vitest` (kỳ vọng 0, theo D1).

**Phase 1 — Vitest upgrade (G1)**

- [ ] 1.1 Chạy **một lệnh duy nhất** (cả 3 gói cùng lúc để thỏa peer exact-pin, A3):
      `npm install -D vitest@^4.1.12 @vitest/coverage-v8@^4.1.12 @vitest/ui@^4.1.12`
      (Code Freeze Guard sẽ `ask` vì ghi `package.json` — xác nhận.)
- [ ] 1.2 Kiểm tra `package.json:97,98,117` đều là `^4.1.12`; không có dòng nào khác trong `package.json` thay đổi (`git diff --stat package.json` → 3 insertions/3 deletions).
- [ ] 1.3 Kiểm tra lockfile: `npm ls vitest @vitest/mocker @vitest/coverage-v8 @vitest/ui @vitest/expect @vitest/runner @vitest/snapshot @vitest/spy @vitest/utils @vitest/pretty-format` → mọi node `4.1.12`, không `invalid`/`UNMET`.
- [ ] 1.4 Chứng minh lockfile tương thích CI: `npm ci --dry-run` thoát mã 0 (bài học `2d9310d` — lockfile lệch gây fail `npm ci` trên GitHub Actions).
- [ ] 1.5 Rà soát `git diff --stat package-lock.json`: chỉ các node vitest-related (và có thể `picomatch` lồng `node_modules/vitest/node_modules/picomatch`) thay đổi. Nếu thấy hàng loạt gói khác bị bump → dừng, `git checkout -- package.json package-lock.json` (do user chạy) và thử lại với `npm install -D ... --prefer-dedupe`.

**Phase 2 — Skill migration (G2)**

- [ ] 2.1 Tạo `.agents/skills/add-model/SKILL.md` với frontmatter tại §6 + body nguyên văn từ dòng 5–57 của `add-model.md` (giữ dòng trống sau frontmatter).
- [ ] 2.2 Sửa `.gitignore:42` → `!.agents/skills/add-model/` (giữ thứ tự: ngay sau `!.agents/skills/README.md`).
- [ ] 2.3 Xóa `.agents/skills/add-model.md`.
- [ ] 2.4 Sửa `.agents/skills/README.md:19` và `:49` theo §6; chạy `npx prettier --write .agents/skills/README.md .agents/skills/add-model/SKILL.md` để căn bảng (chỉ 2 file này).
- [ ] 2.5 Grep xác nhận (PowerShell 5.1-safe, `git grep` quét bản working tree của file tracked): `git grep -n "add-model\.md" -- .agents .gitignore docs/README.md docs/architecture.md` → 0 dòng, exit `1`. (`docs/CHANGELOG.md` entry cũ và `docs/archive/`, `docs/plans/` được cố ý loại khỏi pathspec — D3.) `[CMD]` Trên HEAD hiện tại lệnh trả đúng 3 dòng: `.agents/skills/README.md:19`, `:49`, `.gitignore:42`.

**Phase 3 — Living docs & verify**

- [ ] 3.1 Thêm entry `docs/CHANGELOG.md` (newest first), ghi rõ: 3 gói `^4.1.11 → ^4.1.12`; CVE-2026-84373 đã vá từ 4.1.11, 4.1.12 bổ sung hardening PR #11580; di chuyển `add-model` sang `SKILL.md`, cập nhật `.gitignore` whitelist.
- [ ] 3.2 Tier 2: `npm run type-check; npm run lint; npm run test:run`.
- [ ] 3.3 Chạy `node scripts/verify-docs.mjs --strict-shorthand` (đọc toàn bộ output) rồi chạy lệnh lọc **GATE-1-4** (§9): cổng `[1/5]`–`[4/5]` đều in `PASS:`; dòng `FAIL:` duy nhất là `FAIL: CHANGELOG.md exceeds 35,000 bytes` ở `[5/5]` (tồn đọng, Out of Scope — `A7`). Exit `1` của verify-docs là kỳ vọng; GATE-1-4 phải exit `0`.
- [ ] 3.4 Chạy toàn bộ Wiring Probes (WP-_) và Negative Probes (NP-_) tại §9.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Task không thêm/sửa logic runtime → **không tạo test mới**; hợp đồng là các invariant kiểm chứng bằng lệnh. `@qa` đánh FAIL nếu bất kỳ dòng nào dưới đây không đạt.

| ID    | Input / Hành động                                                                                                                                                                          | Output kỳ vọng (PASS)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Failure mode (FAIL)                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------- |
| TC-1  | `node -p "require('./package.json').devDependencies.vitest"` (tương tự `@vitest/coverage-v8`, `@vitest/ui`)                                                                                | Đúng chuỗi `^4.1.12` cho cả 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Bất kỳ gói nào còn `^4.1.11`, hoặc `^5.x`, hoặc pin chính xác `4.1.12` không có `^`                                                                                                                   |
| TC-2  | `npm ls vitest @vitest/mocker @vitest/coverage-v8 @vitest/ui`                                                                                                                              | Mọi dòng `@4.1.12`; exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Có `4.1.11`, `invalid`, `UNMET PEER DEPENDENCY`, hoặc exit ≠ 0                                                                                                                                        |
| TC-3  | `node -e` đọc `package-lock.json`, liệt kê mọi key `packages` khớp `/(^                                                                                                                    | \/)(vitest                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | @vitest\/[^/]+)$/`                                                                                                                                                                                    | 10 key, tất cả `version === "4.1.12"` | Bất kỳ key nào `!== "4.1.12"` |
| TC-4  | `npm ci --dry-run`                                                                                                                                                                         | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `npm ERR! ... package.json and package-lock.json ... are not in sync`                                                                                                                                 |
| TC-5  | `npm run test:run`                                                                                                                                                                         | Tổng số test pass **bằng** baseline Phase 0.1, 0 failed                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Bất kỳ fail mới → triage theo `.agents/rules/02-quality.md` (Loại A/B); **cấm** `.skip`/nới matcher                                                                                                   |
| TC-6  | `npm run type-check; npm run lint`                                                                                                                                                         | exit 0 cả hai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Bất kỳ lỗi type/lint                                                                                                                                                                                  |
| TC-7  | `npm audit --json` lọc key chứa `vitest`                                                                                                                                                   | 0 entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ≥ 1 entry cho `vitest`/`@vitest/*`                                                                                                                                                                    |
| TC-8  | Đọc 4 dòng đầu `.agents/skills/add-model/SKILL.md`                                                                                                                                         | Dòng 1 `---`; dòng 2 bắt đầu `name: add-model`; dòng 3 bắt đầu `description: "MANDATORY when`; dòng 4 `---`                                                                                                                                                                                                                                                                                                                                                                                                           | Thiếu `name`, `name` ≠ tên thư mục, description không mở đầu `MANDATORY when`, YAML không đóng                                                                                                        |
| TC-9  | So sánh body bằng lệnh **BODY-DIFF** (§9, `node -e`): dòng 5→hết của `SKILL.md` (`slice(4)`) vs dòng 4→hết của `git show HEAD:.agents/skills/add-model.md` (`slice(3)`), chuẩn hóa CRLF→LF | In `BODY IDENTICAL`, exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | In `BODY MISMATCH`, exit 1 → body bị thay đổi ngoài phạm vi D2 default (nếu prettier đổi khoảng trắng ở bước 2.4: hoàn tác phần đó, không nới so sánh)                                                |
| TC-10 | `node -e "process.exit(require('fs').existsSync('.agents/skills/add-model.md')?1:0)"`                                                                                                      | exit 0 (file cũ không tồn tại)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | exit 1 (file cũ vẫn tồn tại). `[CMD]` Trên HEAD hiện tại lệnh trả exit 1 — xác nhận probe phân biệt được hai trạng thái                                                                               |
| TC-11 | `git check-ignore -v .agents/skills/add-model/SKILL.md`                                                                                                                                    | exit 1 (không bị ignore) — hoặc output là dòng whitelist `!` (`.gitignore:42:!.agents/skills/add-model/`)                                                                                                                                                                                                                                                                                                                                                                                                             | Output `.gitignore:40:.agents/skills/*` (file mới sẽ không được commit)                                                                                                                               |
| TC-12 | `node scripts/verify-docs.mjs --strict-shorthand`, kiểm định bằng lệnh lọc **GATE-1-4** (§9)                                                                                               | 4 dòng `PASS:` của cổng `[1/5]` (`PASS: Scanned N files. Zero broken links found.`), `[2/5]` (`PASS: Zero legacy references found in active files.`), `[3/5]` (`PASS: All active governance files use full .agents/ prefixes.`), `[4/5]` (`PASS: All rules <= 12,000 chars ...`) đều có mặt; dòng `FAIL:` duy nhất là `FAIL: CHANGELOG.md exceeds 35,000 bytes` ở `[5/5]` (tồn đọng, Out of Scope — `A7`); GATE-1-4 in `GATES 1-4 PASS (verify-docs exit=1)`, exit 0. Exit `1` của verify-docs **không** tính là FAIL | Thiếu bất kỳ dòng `PASS:` nào của `[1/5]`–`[4/5]`; hoặc có dòng `FAIL:` khác (vd. `FAIL: Found broken links:` trỏ tới `add-model`, `FAIL: Found N unmigrated shorthand references:`); GATE-1-4 exit 1 |

**Chống specification gaming**: Không được đạt TC-12 bằng cách sửa `scripts/verify-docs.mjs`, thêm loại trừ, nới danh sách chuỗi trong GATE-1-4, hay archive/cắt `docs/CHANGELOG.md` để biến `[5/5]` thành PASS (ngoài phạm vi — nếu `[5/5]` bất ngờ PASS, `@qa` phải ghi nhận và kiểm tra `git diff docs/CHANGELOG.md` chỉ thêm entry mới); không được đạt TC-5 bằng cách chỉnh `vitest.config.ts`/`tests/setup.ts` hay đổi test; không được đạt TC-1 bằng cách sửa tay `package.json` mà không tái sinh lockfile (TC-3/TC-4 sẽ bắt).

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

**Co-located tests**: Không áp dụng — 0 thay đổi trong `src/lib/core/`, `src/lib/features/`, `.agents/scripts/`. Bộ test hiện có (bao gồm `src/lib/core/modelRegistry.test.ts`, `.agents/scripts/code-freeze-guard.test.ts`) đóng vai trò regression suite cho runtime vitest mới.

**Lệnh kiểm thử (PowerShell 5.1)**

```powershell
npm run type-check; npm run lint; npm run test:run
node scripts/verify-docs.mjs --strict-shorthand   # exit 1 kỳ vọng do [5/5] tồn đọng — đọc output, rồi chạy GATE-1-4
npm ci --dry-run
```

**Lệnh kiểm chứng tái sử dụng (PowerShell 5.1-safe)** — chỉ dùng `node -e` / `git grep`, không dùng `tail`/`diff -u`/`test -e`/`grep -rn`. Mã JS chỉ dùng nháy đơn bên trong, không có `$` hay backtick, nên chuỗi nháy kép của PowerShell 5.1 truyền nguyên vẹn sang `node`.

- **GATE-1-4** (TC-12, WP-4, NP-1) — chạy verify-docs dưới dạng tiến trình con, yêu cầu đủ 4 dòng `PASS:` của `[1/5]`–`[4/5]` và chỉ cho phép đúng một loại `FAIL:` (CHANGELOG byte budget). `[CMD]` Đã chạy trên HEAD hiện tại → `GATES 1-4 PASS (verify-docs exit=1)`, exit 0.

  ```powershell
  node -e "const r=require('child_process').spawnSync(process.execPath,['scripts/verify-docs.mjs','--strict-shorthand'],{encoding:'utf8'});const out=r.stdout+r.stderr;const need=['PASS: Scanned ','PASS: Zero legacy references found','PASS: All active governance files use full .agents/ prefixes.','PASS: All rules <= 12,000 chars'];const miss=need.filter(s=>!out.includes(s));const fails=out.split(/\r?\n/).filter(l=>l.startsWith('FAIL:')&&!l.startsWith('FAIL: CHANGELOG.md exceeds 35,000 bytes'));if(miss.length||fails.length){console.error('GATES 1-4 FAIL',JSON.stringify({miss,fails}));process.exit(1)}console.log('GATES 1-4 PASS (verify-docs exit='+r.status+')')"
  ```

- **BODY-DIFF** (TC-9) — so sánh body `SKILL.md` mới với body file cũ tại `HEAD`. `[CMD]` Đã chạy biến thể so sánh `.agents/skills/add-model.md` với chính nó tại `HEAD` → `BODY IDENTICAL`, exit 0 (xác nhận cú pháp chạy được trên PowerShell 5.1).

  ```powershell
  node -e "const cp=require('child_process'),fs=require('fs');const norm=s=>s.replace(/\r\n/g,'\n').split('\n');const a=norm(fs.readFileSync('.agents/skills/add-model/SKILL.md','utf8')).slice(4).join('\n');const b=norm(cp.execSync('git show HEAD:.agents/skills/add-model.md',{encoding:'utf8'})).slice(3).join('\n');if(a!==b){console.error('BODY MISMATCH');process.exit(1)}console.log('BODY IDENTICAL')"
  ```

- **OLD-FILE-GONE** (TC-10): `node -e "process.exit(require('fs').existsSync('.agents/skills/add-model.md')?1:0)"` → exit 0.
- **NO-OLD-REFS** (Bước 2.5, NP-3): `git grep -n "add-model\.md" -- .agents .gitignore docs/README.md docs/architecture.md` → 0 dòng, exit 1.

**Wiring Probes** (chứng minh thay đổi thực sự được nối vào hệ thống)

- **WP-1** — Runtime đang dùng đúng bản: `npx vitest --version` → `vitest/4.1.12`.
- **WP-2** — Mocker mới thực sự được load: `node -p "require('./node_modules/@vitest/mocker/package.json').version"` → `4.1.12`, và một test dùng `vi.mock` vẫn pass: `npx vitest run src/lib/core/modelRegistry.test.ts .agents/scripts/code-freeze-guard.test.ts --reporter=dot`.
- **WP-3** — `@vitest/coverage-v8` + `@vitest/ui` resolve đúng bản và peer khớp `vitest` mới, **không ghi đĩa** (không chạy `--coverage`: thư mục `coverage/` **không** nằm trong `.gitignore` nên sẽ làm bẩn `git status`, và `--coverage` nằm ngoài allowlist `READ_ONLY_COMMANDS` của `.agents/scripts/code-freeze-guard.js:53-57`):

  ```powershell
  node -e "const vt=require('vitest/package.json').version;let bad=0;for(const n of ['@vitest/coverage-v8','@vitest/ui']){const p=require(n+'/package.json');const entry=require.resolve(n);const ok=p.version==='4.1.12'&&p.peerDependencies.vitest===vt;console.log(n,p.version,'peer vitest='+p.peerDependencies.vitest,entry,ok?'OK':'MISMATCH');if(!ok)bad=1}process.exit(bad)"
  ```

  PASS: 2 dòng `OK` (version `4.1.12`, `peer vitest=4.1.12`, `require.resolve` trả về `node_modules\@vitest\<pkg>\dist\index.js`), exit 0. FAIL: bất kỳ `MISMATCH` hoặc `MODULE_NOT_FOUND`. `[CMD]` Trên HEAD hiện tại (trước nâng cấp) các phần `require`/`require.resolve` chạy thành công và trả `4.1.11`, peer `vitest: 4.1.11` → probe sẽ in `MISMATCH`/exit 1 trước bước 1.1, chứng minh nó phân biệt được trạng thái cũ. Tích hợp runtime thực sự của `coverage-v8` không được thực thi ở đây — chấp nhận vì `vitest.config.ts` không bật coverage mặc định và CI không chạy `--coverage`.

- **WP-4** — Skill được phát hiện qua link routing: **GATE-1-4** exit 0 (đặc biệt dòng `[1/5]` `PASS: Scanned N files. Zero broken links found.`) ⇒ `./add-model/SKILL.md` resolve tồn tại từ `.agents/skills/README.md`. Exit `1` của verify-docs do `[5/5]` tồn đọng không ảnh hưởng WP-4 (`A7`).
- **WP-5** — Skill được git theo dõi: `git status --porcelain .agents/skills/` hiển thị `?? .agents/skills/add-model/` (untracked nhưng **không ignored**) và ` D .agents/skills/add-model.md`.

**Negative Probes** (theo `.agents/agents/reviewer/evidence-bar.md` §4.5.3 — chứng minh guard chặn đúng trạng thái vi phạm)

- **NP-1 — Link checker bắt link hỏng**: Trước bước 2.4 (sau 2.3), chạy `node scripts/verify-docs.mjs --strict-shorthand` → cổng `[1/5]` **phải** in `FAIL: Found broken links:` với 2 entry `In .agents/skills/README.md: [...](./add-model.md)`, và **GATE-1-4** **phải** exit 1 với `fails` chứa dòng `FAIL: Found broken links:` (chứng minh bộ lọc không nuốt lỗi khác ngoài `[5/5]`). Sau 2.4 → `[1/5]` in `PASS: Scanned N files. Zero broken links found.` và GATE-1-4 exit 0; verify-docs vẫn exit 1 chỉ vì `[5/5]` tồn đọng (`A7`). Chứng minh `scripts/verify-docs.mjs:84,96` thật sự bảo vệ đường dẫn mới.
- **NP-2 — Gitignore chặn file mới nếu thiếu whitelist**: Trước bước 2.2 (sau 2.1), `git check-ignore -v .agents/skills/add-model/SKILL.md` → **phải** in `.gitignore:40:.agents/skills/*` (exit 0). Sau 2.2 → không còn bị ignore (TC-11).
- **NP-3 — 0 tham chiếu tới file cũ**: **NO-OLD-REFS** `git grep -n "add-model\.md" -- .agents .gitignore docs/README.md docs/architecture.md` → 0 dòng (exit 1). `[CMD]` Đối chứng âm trên HEAD hiện tại: lệnh trả 3 dòng (`.agents/skills/README.md:19`, `:49`, `.gitignore:42`), exit 0 — chứng minh probe bắt được tham chiếu cũ.
- **NP-4 — Peer exact-pin chặn nâng cấp lệch**: (dry-run, không ghi) `npm install -D vitest@4.1.12 --dry-run` khi `@vitest/ui`/`@vitest/coverage-v8` vẫn `4.1.11` → kỳ vọng npm báo `ERESOLVE`/peer conflict hoặc kéo theo cảnh báo peer; ghi nhận output như bằng chứng cho lý do bước 1.1 phải cài cả 3 gói cùng lúc. Nếu npm tự giải quyết không báo lỗi, ghi lại "không tái hiện" — không chặn task (TC-2/TC-3 vẫn là gate chính).
- **NP-5 — Lockfile lệch bị CI chặn**: TC-4 `npm ci --dry-run` là guard; bằng chứng tham chiếu: commit `2d9310d` ("sync package-lock.json ... to pass npm ci").

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                                                                               | Mức độ         | Technical control / Probe                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | File `.agents/skills/add-model/SKILL.md` bị `.gitignore` nuốt → skill biến mất khỏi repo khi commit, trong khi file cũ đã xóa (mất skill hoàn toàn). | **Cao**        | `[SRC]` `.gitignore:40` (`.agents/skills/*`) + `.gitignore:42` whitelist; bước 2.2; **NP-2** + **TC-11** (`git check-ignore`).                                                                                                                                     |
| R2  | Link routing trong `.agents/skills/README.md` trỏ tới file đã xóa → agent không nạp được skill.                                                      | **Trung bình** | `[SRC]` `scripts/verify-docs.mjs:37-42,81,84` link checker; **NP-1** + **TC-12**.                                                                                                                                                                                  |
| R3  | Hardening `@vitest/mocker` (PR #11580) thay đổi hành vi `vi.mock` redirect/manual mocks → test hiện có fail.                                         | **Trung bình** | 81 file dùng `vi.mock(`; **TC-5** so với baseline Phase 0.1; **WP-2** chạy `src/lib/core/modelRegistry.test.ts` + `.agents/scripts/code-freeze-guard.test.ts`. Nếu fail: triage Loại B theo `.agents/rules/02-quality.md` (sửa mock harness, không giảm `expect`). |
| R4  | Lockfile lệch `package.json` → CI `npm ci` fail (`.github/workflows/ci.yml:25`).                                                                     | **Trung bình** | Bước 1.1 dùng `npm install` (không sửa tay); **TC-3** + **TC-4** (`npm ci --dry-run`).                                                                                                                                                                             |
| R5  | `npm install` bump hàng loạt gói ngoài phạm vi (lockfile churn).                                                                                     | **Trung bình** | Bước 1.5 `git diff --stat package-lock.json` + kiểm tra `package.json` chỉ đổi 3 dòng (bước 1.2); rollback do user thực hiện nếu vi phạm.                                                                                                                          |
| R6  | Peer exact-pin: chỉ nâng `vitest` khiến `@vitest/ui`/`coverage-v8` lệch → `ERESOLVE`.                                                                | Thấp           | Bước 1.1 cài cả 3 trong 1 lệnh; **NP-4**; **TC-2**.                                                                                                                                                                                                                |
| R7  | Báo cáo sai lệch "đã đóng CVE" trong khi CVE đã vá từ 4.1.11.                                                                                        | Thấp           | D1 + **TC-7**; CHANGELOG bước 3.1 ghi trung thực.                                                                                                                                                                                                                  |
| R8  | Frontmatter YAML sai (thiếu `name`, không bọc nháy) → auto-trigger không nhận skill.                                                                 | Thấp           | **TC-8**; mẫu `[SRC]` `.agents/skills/api-patterns/SKILL.md:1-4`.                                                                                                                                                                                                  |
| R9  | Vô tình nâng lên Vitest 5 (`latest`).                                                                                                                | Thấp           | Lệnh 1.1 chỉ định `@^4.1.12`; **TC-1** cấm `^5.x`.                                                                                                                                                                                                                 |

**Nguồn tra cứu 2026**: [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) · [OSV CVE-2026-84373](https://osv.dev/vulnerability/CVE-2026-84373) · [Red Hat Bugzilla 2527102](https://bugzilla.redhat.com/show_bug.cgi?id=2527102) · [Vitest v4.1.12 release](https://github.com/vitest-dev/vitest/releases/tag/v4.1.12) · [vitest PR #11580](https://github.com/vitest-dev/vitest/pull/11580)

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

- **Reviewer**: `@reviewer` (`gemini-4-argon`, thinking budget Max)
- **Date**: 2026-10-19
- **Plan Revision Evaluated**: Revision 1
- **Verdict**: `[CHANGES_REQUESTED]` (`1` `[MAJOR]`, `3` `[MINOR]`, `0` `[BLOCKER]`)

---

#### 1. Kiểm Chứng Lỗi Cũ (Previous Findings Verification)

Không áp dụng (đây là `Audit Run 1` trên Revision 1).

---

#### 2. Phát Hiện Mới (New Findings)

##### `NEW-01` — `[MAJOR]` — Điều kiện PASS của `TC-12` (§8, dòng 186), Bước 3.3 (§7, dòng 166) và `NP-1` (§9, dòng 212) mâu thuẫn với mã nguồn `scripts/verify-docs.mjs:252-302` và dung lượng thực tế của `docs/CHANGELOG.md`

- **Phân loại theo Severity Rubric (`.agents/rules/05-plan-review.md` §4.2)**: `[MAJOR]` — Giả định sai về trạng thái trả về của script kiểm chứng so với mã nguồn thật và dữ liệu hiện hữu trên đĩa, gây deadlock kiểm thử cho `@qa` ở Giai đoạn Thực thi.
- **Bằng chứng `[SRC]`**:
  1. Trong `scripts/verify-docs.mjs:252-271` (bước `[5/5] Verifying CHANGELOG archive split and byte budget...`), khi cả hai file `docs/CHANGELOG.md` và `docs/archive/CHANGELOG-legacy.md` đều tồn tại trên đĩa, script kiểm tra `if (currentBytes >= 35000)` (`scripts/verify-docs.mjs:263`):
     - Nếu `currentBytes >= 35000`, script in `FAIL: CHANGELOG.md exceeds 35,000 bytes (${currentBytes} bytes)!` (`scripts/verify-docs.mjs:264-266`) và gán `hasError = true` (`scripts/verify-docs.mjs:267`).
     - Tại `scripts/verify-docs.mjs:298-302`, `if (hasError) { process.exit(1); }` khiến tiến trình kết thúc với mã thoát `1` và không in dòng `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`.
  2. Khảo sát trạng thái thực tế trên đĩa (`view_file` `docs/CHANGELOG.md:1-45` và `docs/archive/CHANGELOG-legacy.md:1-30`):
     - `docs/CHANGELOG.md` hiện có `836` dòng, dung lượng `129,511` bytes (`> 35,000` bytes).
     - `docs/archive/CHANGELOG-legacy.md` đã tồn tại trên đĩa (`1,503` dòng, `106,402` bytes).
     - Sau khi thực thi Bước 3.1 (chèn thêm mục `[2026-10-19]` vào đầu `docs/CHANGELOG.md`), dung lượng `docs/CHANGELOG.md` sẽ lớn hơn `129,511` bytes.
  3. Trong kế hoạch Revision 1:
     - Mục 1 Out of Scope (dòng 25–26) và Mục 8 (dòng 188) quy định rõ không sửa `scripts/verify-docs.mjs` và không sửa các mục cũ của `docs/CHANGELOG.md`.
     - Tuy nhiên, Mục 7 Bước 3.3 (dòng 166) yêu cầu `node scripts/verify-docs.mjs --strict-shorthand -> in ALL DOCUMENTATION VERIFICATION CHECKS PASSED., exit 0`; Mục 8 `TC-12` (dòng 186) quy định Output kỳ vọng là `ALL DOCUMENTATION VERIFICATION CHECKS PASSED., exit 0` kèm điều khoản cứng tại dòng 171 (`@qa đánh FAIL nếu bất kỳ dòng nào dưới đây không đạt`); và Mục 9 `NP-1` (dòng 212) khẳng định `Lệnh verify thật chạy sau Bước 3.2 phải exit 0`.
- **Hậu quả**: Khi Implementer và `@qa` chạy `node scripts/verify-docs.mjs --strict-shorthand`, cổng `[1/5]`, `[2/5]`, `[3/5]` (`--strict-shorthand`), và `[4/5]` sẽ in `PASS:`, nhưng cổng `[5/5]` sẽ in `FAIL: CHANGELOG.md exceeds 35,000 bytes (...)!` và trả về `exit 1`. Do `TC-12` bắt buộc `exit 0` và cấm sửa `scripts/verify-docs.mjs` / `docs/CHANGELOG.md` cũ, `@qa` không thể đánh PASS `TC-12`.
- **Yêu cầu sửa trong Revision 2**:
  - Cập nhật Mục 3 (`A7`), Mục 7 (Bước 3.3), Mục 8 (`TC-12`), và Mục 9 (`WP-4`, `NP-1`) để phản ánh đúng hành vi của `scripts/verify-docs.mjs:252-302` trên trạng thái repo hiện tại (tương tự chuẩn đã áp dụng tại `docs/plans/2026-10-19-pstack-skills-and-fast-track-implementation-plan.md:83,457,471` — `A12` & `GB-6`):
    - Xác định rõ tiêu chí PASS của `node scripts/verify-docs.mjs --strict-shorthand` cho task này là cả 4 cổng `[1/5]` (Markdown Link Integrity), `[2/5]` (Negative Grep Check), `[3/5]` (Negative Shorthand Prefixes in `--strict-shorthand` mode), và `[4/5]` (Governance File Character Limits) đều in `PASS:`, không phát sinh lỗi link hay shorthand; riêng lỗi `FAIL: CHANGELOG.md exceeds 35,000 bytes` ở cổng `[5/5]` là trạng thái tồn đọng từ trước thuộc Out of Scope.
    - Hoặc bổ sung lệnh lọc output / kiểm chứng exit của 4 cổng `[1/5]`–`[4/5]` để `@qa` có tiêu chí kiểm định rõ ràng, khả thi và nhất quán với Out of Scope.

##### `NEW-02` — `[MINOR]` — Giả định sai trong `WP-3` (§9, dòng 206) rằng thư mục `coverage/` nằm trong `.gitignore` và cờ `--coverage` chạy tự động không bị chặn

- **Phân loại**: `[MINOR]` — Sai lệch thông tin cấu hình trong bước probe phụ trợ.
- **Bằng chứng `[SRC]`**:
  1. Kiểm tra `.gitignore:1-62`: chỉ có `/test-results/` và `/playwright-report/` (dòng 60–61), không có dòng nào ignore `coverage/` (chuỗi `coverage/` chỉ xuất hiện trong `vitest.config.ts:22` tại mảng `test.coverage.exclude`). Nếu chạy `npx vitest run ... --coverage` mà không xóa thư mục `coverage/`, `git status --short` ở `TC-13` (dòng 187) sẽ xuất hiện `?? coverage/` làm trượt điều kiện working tree sạch.
  2. Kiểm tra `.agents/scripts/code-freeze-guard.js:55-56`: regex `/\bvitest\b[\s\S]*?(?:--coverage\b|...)/i` nằm trong `WRITE_INTENT_VITEST`, khiến hook PreToolUse bật hộp thoại `ask` vì lệnh tạo thư mục `coverage/` trên đĩa.
- **Khuyến nghị sửa**: Trong `WP-3` (§9, dòng 206), bỏ khẳng định `(đã nằm trong .gitignore)` và ghi rõ phải xóa thư mục `coverage/` ngay sau khi chạy probe (hoặc thay `WP-3` bằng probe kiểm tra module resolution / khởi tạo provider `@vitest/coverage-v8` không ghi file ra đĩa) để bảo đảm `TC-13` (`git status --short` chỉ có đúng 5 mục) không bị ảnh hưởng.

##### `NEW-03` — `[MINOR]` — Lệnh kiểm chứng trong Bước 2.5 (§7, dòng 160), `TC-9` (§8, dòng 183), `TC-10` (§8, dòng 184) và `NP-3` (§9, dòng 214) sử dụng cú pháp Unix shell không tương thích trực tiếp với Windows PowerShell 5.1

- **Phân loại**: `[MINOR]` — Lệnh verify dùng tiện ích Unix (`tail`, `diff -u`, `test -e`, `grep -rn`) trên môi trường Windows PowerShell 5.1 (`.agents/rules/02-quality.md:68-76`).
- **Bằng chứng `[SRC]`**:
  - `.agents/rules/02-quality.md:68-76` quy định shell mặc định trên máy phát triển là Windows PowerShell (`powershell.exe`). Trong PowerShell 5.1, `diff` là alias của `Compare-Object` (không nhận cờ `-u` và yêu cầu `-ReferenceObject` / `-DifferenceObject`), còn `tail` và `test -e` không phải lệnh tích hợp sẵn.
- **Khuyến nghị sửa**: Ghi kèm lệnh `node -e` hoặc PowerShell 5.1 tương đương trong Bước 2.5, `TC-9`, `TC-10`, và `NP-3` (ví dụ dùng `node -e` để so sánh 58 dòng cuối của `.agents/skills/add-model/SKILL.md` với nội dung trước khi `git mv`, dùng `node -e "process.exit(require('fs').existsSync('.agents/skills/add-model.md') ? 1 : 0)"` cho `TC-9`, và dùng `git grep -n "add-model\.md"` hoặc `node -e` cho `NP-3`).

##### `NEW-04` — `[MINOR]` — Lệch số đếm trong phần diễn giải tại §2 (dòng 44) và §3 `A3` (dòng 64)

- **Phân loại**: `[MINOR]` — Lệch số đếm trong văn bản mô tả so với danh sách gói liệt kê.
- **Bằng chứng `[SRC]` & `[CMD]`**:
  - Tại §2 (dòng 44) và §3 `A3` (dòng 64), kế hoạch viết `"8 gói @vitest/* transitive"` / `"8 gói con ở 4.1.12 (@vitest/spy|utils|expect|mocker|runner|snapshot|pretty-format)"`, nhưng danh sách trong ngoặc có **7** gói transitive (`spy`, `utils`, `expect`, `mocker`, `runner`, `snapshot`, `pretty-format`). Kết hợp với **2** gói `@vitest/*` direct (`@vitest/coverage-v8`, `@vitest/ui`) là **9** gói `@vitest/*` + **1** gói `vitest` = **10** node trong lockfile (như §1 `G1` dòng 17 và §8 `TC-3` dòng 177 đã tính đúng).
- **Khuyến nghị sửa**: Sửa số `"8"` thành `"7"` tại §2 (dòng 44) và §3 `A3` (dòng 64) để thống nhất với `G1` và `TC-3`.

---

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Attack Probe 1 — Kiểm tra khả năng Vitest `4.1.12` thay đổi peerDependencies hoặc kéo theo breaking change với `vite@7.3.1` / Node engine**:
   - Thực thi `[CMD]` `npm view vitest@4.1.12 version dependencies peerDependencies engines` và `npm ls vite`.
   - Kết quả: `vitest@4.1.12` giữ nguyên `engines.node: '^20.0.0 || ^22.0.0 || >=24.0.0'`, `peerDependencies.vite: '^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0'` (tương thích với `vite@7.3.1` đang cài trong dự án) và khoá cứng 7 gói con `@vitest/*` ở `4.1.12`. Không phát hiện xung đột peer dependency.
2. **Attack Probe 2 — Đối chiếu bản vá PR `#11580` (`v4.1.12`) với mã nguồn `node_modules/@vitest/mocker` hiện tại (`4.1.11`) trên đĩa**:
   - Đọc trực tiếp `node_modules/@vitest/mocker/dist/node.js:1-420` và `node_modules/@vitest/mocker/dist/redirect.js:1-80` (`[SRC]`), đồng thời đối chiếu với nội dung PR `#11580` / `#11377` (`[URL]`).
   - Kết quả: Trong `4.1.11`, `findMockRedirect` và `MockerRegistry` chưa có bước kiểm tra biên thư mục cho manual/redirect mocks như trong PR `#11580` (`v4.1.12`). Việc nâng cấp lên `4.1.12` giải quyết đúng điểm yếu còn sót sau bản vá `4.1.11`.
3. **Attack Probe 3 — Tìm kiếm toàn cục mọi tham chiếu tới `add-model.md` hoặc `add-model` trong scripts, hooks, workflows và tests**:
   - Kiểm tra `scripts/verify-docs.mjs:1-303`, `.agents/scripts/code-freeze-guard.js:1-520`, `.agents/workflows/audit.md:1-55`, `skills-lock.json:1-24`, `.agents/skills/README.md:1-55`, `docs/CHANGELOG.md:1-45`, `docs/archive/CHANGELOG-legacy.md:1-30`.
   - Kết quả: Không có script hay hook nào hardcode đường dẫn `.agents/skills/add-model.md`; các tham chiếu trong tài liệu sống nằm đúng ở `.agents/skills/README.md:36` và `docs/CHANGELOG.md:12,33` như kế hoạch đã liệt kê. (Nhưng phát hiện lỗi `NEW-01` khi đối chiếu cổng `[5/5]` của `scripts/verify-docs.mjs:252-302` với `docs/CHANGELOG.md`).

---

#### 4. Plan Completeness Gate & Mental Simulation Verification Matrix

##### 4.1. Plan Completeness Gate (7 Hạng Mục Bắt Buộc)

| #   | Hạng Mục                                                       | Trạng Thái |   Evidence Type   | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                                                                                  |
| :-- | :------------------------------------------------------------- | :--------: | :---------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bảng Verified Versions (2026)                                  |   `PASS`   | `[CMD]` + `[URL]` | Mục 2 (dòng 30–49) liệt kê `vitest`, `@vitest/coverage-v8`, `@vitest/ui`, `@vitest/mocker` ở `4.1.12` (phát hành 2026-10-15) và `vite@7.3.1`, `@vitejs/plugin-react@5.1.2`, `jsdom@27.0.1`, `typescript@5.9.2`. Đã kiểm chứng qua `npm view vitest@4.1.12` và release tag `v4.1.12`.                 |
| 2   | Checklist các bước tuần tự (`[NEW]`, `[MODIFY]`, `[DELETE]`)   |   `PASS`   |      `[SRC]`      | Mục 6 (dòng 104–115) và Mục 7 (dòng 117–167) gắn nhãn `[MODIFY]`, `[NEW]`, `[DELETE]` cho toàn bộ 6 file trong phạm vi.                                                                                                                                                                              |
| 3   | Verification Plan (lệnh verify, wiring probe, negative probes) |   `FAIL`   |      `[SRC]`      | Mục 9 (dòng 190–215) có đủ lệnh verify, `WP-1`..`WP-4`, `NP-1`..`NP-3`, nhưng `NP-1` và Bước 3.3 vướng `NEW-01` (`[MAJOR]`), `WP-3` vướng `NEW-02` (`[MINOR]`).                                                                                                                                      |
| 4   | Test Contract                                                  |   `FAIL`   |      `[SRC]`      | Mục 8 (dòng 169–188) có bảng `TC-1`..`TC-13`, nhưng `TC-12` yêu cầu `ALL DOCUMENTATION VERIFICATION CHECKS PASSED., exit 0` mâu thuẫn với `scripts/verify-docs.mjs:263-302` và Out of Scope (`NEW-01`).                                                                                              |
| 5   | Assumptions & Cross-Task Dependencies                          |   `PASS`   |      `[SRC]`      | Mục 3 (dòng 58–74) liệt kê `A1`–`A7` và bảng Cross-Task Dependencies (3 hạng mục). Cần cập nhật `A7` theo `NEW-01` và `A3` theo `NEW-04`.                                                                                                                                                            |
| 6   | Out of Scope (What We're NOT Doing)                            |   `PASS`   |      `[SRC]`      | Mục 1 (dòng 21–28) xác định rõ 6 hạng mục ngoài phạm vi.                                                                                                                                                                                                                                             |
| 7   | Skills Loaded & Applied                                        |   `PASS`   |      `[SRC]`      | Mục 4 (dòng 76–88) trích dẫn `.agents/skills/vikini-investigate/SKILL.md`, `.agents/skills/vikini-simplify/SKILL.md`, `.agents/skills/add-translation/SKILL.md` và đối chiếu cấu trúc 11 `SKILL.md` hiện hữu. Task không chạm API route, SSE streaming, DB migration, hay `lib/core`/`lib/features`. |

##### 4.2. Mental Simulation Verification Matrix (S1–S6 + Domain Open Inquiry)

| Kịch Bản                                                | Trạng Thái |   Evidence Type   | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------------------------------ | :--------: | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 — Happy Path**                                     |   `FAIL`   | `[SRC]` + `[CMD]` | Nâng cấp `vitest` `4.1.12` và `git mv` `.agents/skills/add-model.md` -> `.agents/skills/add-model/SKILL.md` hoạt động đúng, nhưng ở bước cuối (`Bước 3.3` / `TC-12`), lệnh `node scripts/verify-docs.mjs --strict-shorthand` trả về `exit 1` tại cổng `[5/5]` do `docs/CHANGELOG.md` nặng `129,511` bytes (`> 35,000` bytes) (`scripts/verify-docs.mjs:263-302`), làm gãy `TC-12` (`NEW-01`).                                                                                                                                          |
| **S2 — Boundary, Null & Empty Inputs**                  |   `PASS`   | `[SRC]` + `[CMD]` | Kiểm tra ranh giới path traversal của `@vitest/mocker` (`node_modules/@vitest/mocker/dist/node.js:184-260`, PR `#11580` kiểm tra `resolve` + biên thư mục `root`), và kiểm tra giới hạn ký tự governance trong `scripts/verify-docs.mjs:204-237` (chỉ kiểm `GEMINI.md` và `.agents/rules/*.md`, không áp giới hạn 12,000 ký tự lên `.agents/skills/*/SKILL.md`).                                                                                                                                                                       |
| **S3 — Timing, Ordering & Concurrency**                 |   `PASS`   | `[SRC]` + `[CMD]` | Xem Timeline 4 trục tại Mục 5.2 bên dưới: thứ tự `npm install --save-exact` trước `npx vitest run`, và thứ tự `git mv` + cập nhật `README.md` + `CHANGELOG.md` trước khi chạy `scripts/verify-docs.mjs` đảm bảo không phát sinh race condition hay broken link tạm thời.                                                                                                                                                                                                                                                               |
| **S4 — Partial Failure, Dependency Failure & Rollback** |   `PASS`   | `[SRC]` + `[CMD]` | Nếu `npm install` lỗi mạng hoặc lệch tree, `git checkout -- package.json package-lock.json` khôi phục trạng thái ban đầu; nếu `git mv` lỗi giữa chừng, `git status` và `git reset` khôi phục nguyên vẹn vì thao tác nằm trọn trong working tree cục bộ, không có migration DB hay state bên ngoài.                                                                                                                                                                                                                                     |
| **S5 — Shared State, Caching & Stale State**            |   `PASS`   | `[SRC]` + `[CMD]` | Xem Timeline 4 trục tại Mục 5.2 bên dưới: `node_modules/.vite` hoặc Vitest transform cache không giữ bản cũ của `@vitest/mocker` khi version trong `node_modules/@vitest/mocker/package.json` đổi sang `4.1.12`. Tuy nhiên cần lưu ý `NEW-02` về thư mục `coverage/` không nằm trong `.gitignore`.                                                                                                                                                                                                                                     |
| **S6 — Contract & Integration Drift**                   |   `PASS`   | `[SRC]` + `[CMD]` | Kiểm tra toàn bộ 8 đường dẫn được liệt kê trong `.agents/skills/add-model.md:1-58` với codebase thật: `src/lib/core/modelRegistry.ts`, `src/lib/core/modelRegistry.test.ts`, `src/lib/core/limits.ts`, `src/lib/core/batchGenQuota.ts`, `src/lib/utils/config.ts`, `src/lib/utils/translations/en.ts`, `src/lib/store/toastStore.ts`, `src/app/features/chat/components/hooks/useChatStreamController.ts`, `docs/architecture.md`, `docs/security.md`, `docs/database-schema.md`, `docs/models.md` đều tồn tại trên đĩa (`view_file`). |
| **Domain Open Inquiry**                                 |   `FAIL`   | `[SRC]` + `[URL]` | Đã thẩm định 3 câu hỏi mở đặc thù domain: (1) Cơ chế CVE-2026-84373 vs PR `#11580` (`PASS`), (2) Tương tác giữa `scripts/verify-docs.mjs` với `docs/CHANGELOG.md` và `.agents/skills/` (`FAIL` do `NEW-01`), (3) Tương thích lệnh verify với Windows PowerShell 5.1 và `code-freeze-guard.js` (`NEW-02`, `NEW-03`).                                                                                                                                                                                                                    |

---

#### 5. Claim Verification & Adversarial Timelines

##### 5.1. Kiểm Chứng Khẳng Định Kỹ Thuật (Claim Verification)

1. **Khẳng định 1 (Mục 1 & Mục 10)**: _"CVE-2026-84373 / GHSA-82fw-gwwq-j7x9 là lỗ hổng Arbitrary File Read qua WebSocket `vitest:interceptor:resolveId` trong `@vitest/mocker` (`<= 4.1.10`), đã vá sơ bộ ở `4.1.11`, và `v4.1.12` (2026-10-15) tiếp tục gia cố manual & redirect mocks qua PR `#11580` (backport từ `#11377`)."_
   - **Bằng chứng `[URL]`**:
     - [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9): Xác nhận CVE-2026-84373 (CWE-22, CVSS 5.9), ảnh hưởng `@vitest/mocker` `>= 2.1.0, <= 4.1.10`, bản vá đầu tiên `4.1.11`.
     - [Vitest v4.1.12 Release Notes](https://github.com/vitest-dev/vitest/releases/tag/v4.1.12) & [PR #11580](https://github.com/vitest-dev/vitest/pull/11580) (`b82531324`, 2026-10-15): Xác nhận commit `mocker: Harden manual and redirect mocks [backport to v4]` (#11580), backport từ [PR #11377](https://github.com/vitest-dev/vitest/pull/11377).
   - **Kết luận**: Khẳng định chính xác.

2. **Khẳng định 2 (Mục 2 & Mục 3 `A3`)**: _"`vitest@4.1.12` khoá cứng các gói `@vitest/_`con ở đúng phiên bản`4.1.12`."\*
   - **Bằng chứng `[CMD]`**: `npm view vitest@4.1.12 dependencies peerDependencies` trả về:
     - `dependencies`: `@vitest/expect: '4.1.12'`, `@vitest/mocker: '4.1.12'`, `@vitest/pretty-format: '4.1.12'`, `@vitest/runner: '4.1.12'`, `@vitest/snapshot: '4.1.12'`, `@vitest/spy: '4.1.12'`, `@vitest/utils: '4.1.12'`.
     - `peerDependencies`: `@vitest/coverage-v8: '4.1.12'`, `@vitest/ui: '4.1.12'`.
   - **Kết luận**: Khẳng định về cơ chế khóa cứng phiên bản chính xác (chỉ cần sửa lỗi đếm số lượng từ 8 thành 7 gói transitive như đã nêu ở `NEW-04`).

3. **Khẳng định 3 (Mục 4 & Mục 5.2)**: _"11 trên 12 skill trong `.agents/skills/` đã theo chuẩn `<name>/SKILL.md` kèm YAML frontmatter `name` + `description`; chỉ còn `.agents/skills/add-model.md` là file phẳng 58 dòng không có frontmatter."_
   - **Bằng chứng `[SRC]`**: Đã đọc `.agents/skills/README.md:1-55`, `.agents/skills/add-model.md:1-58` và 11 file `.agents/skills/*/SKILL.md` (`add-feature`, `add-translation`, `animation-vocabulary`, `api-patterns`, `database-migration`, `emil-design-eng`, `review-animations`, `streaming-patterns`, `ui-ux-pro-max`, `vikini-investigate`, `vikini-simplify`).
   - **Kết luận**: Khẳng định khớp với codebase.

##### 5.2. Adversarial Timelines 4 Trục (`T0 -> T1 -> T2 -> T3`) cho S3 & S5

###### Kịch bản S3 (Timing & Ordering khi di chuyển file Skill và chạy Doc Verification)

| Thời Điểm | Actor A (Implementer / Git Tree)                                                                                                                       | Actor B (`scripts/verify-docs.mjs`)                                                                                                                                                                                                            | Hệ Thống File & Chỉ Mục Git                                                                                                                                                  | Kết Quả / Ràng Buộc                                                                                                                                                                                    |
| :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T0**    | Chạy `git mv .agents/skills/add-model.md .agents/skills/add-model/SKILL.md` (Bước 2.1).                                                                | Chưa chạy.                                                                                                                                                                                                                                     | `.agents/skills/add-model.md` biến mất; `.agents/skills/add-model/SKILL.md` xuất hiện. `.agents/skills/README.md:36` và `docs/CHANGELOG.md:12,33` vẫn trỏ về `add-model.md`. | Nếu chạy Actor B ngay tại T0, cổng `[1/5]` (`scripts/verify-docs.mjs:89-125`) sẽ báo `BROKEN LINK` tại `README.md:36` và `CHANGELOG.md:12,33`.                                                         |
| **T1**    | Chèn YAML frontmatter 4 dòng vào đầu `.agents/skills/add-model/SKILL.md` (Bước 2.2) và sửa link trong `.agents/skills/README.md:36` (Bước 2.3).        | Chưa chạy.                                                                                                                                                                                                                                     | `README.md:36` đã trỏ sang `[add-model/SKILL.md](./add-model/SKILL.md)`. `docs/CHANGELOG.md:12,33` vẫn trỏ về `.agents/skills/add-model.md`.                                 | Nếu chạy Actor B tại T1, cổng `[1/5]` vẫn báo `BROKEN LINK` tại `docs/CHANGELOG.md:12,33` vì `scripts/verify-docs.mjs:47-55` quét toàn bộ `docs/*.md` (chỉ loại trừ `docs/archive/` và `docs/plans/`). |
| **T2**    | Cập nhật `docs/CHANGELOG.md` (Bước 3.1 & 3.2): thêm mục mới và cập nhật 2 tham chiếu lịch sử tại dòng 12, 33 sang `.agents/skills/add-model/SKILL.md`. | Chưa chạy.                                                                                                                                                                                                                                     | Mọi link trong `.agents/skills/README.md` và `docs/CHANGELOG.md` đều trỏ tới file tồn tại trên đĩa.                                                                          | Cây tài liệu không còn broken link.                                                                                                                                                                    |
| **T3**    | Gọi Actor B chạy kiểm chứng (Bước 3.3).                                                                                                                | Quét `[1/5]` -> `PASS`, `[2/5]` -> `PASS`, `[3/5]` -> `PASS`, `[4/5]` -> `PASS`, nhưng đến `[5/5]` (`scripts/verify-docs.mjs:263`) đo `docs/CHANGELOG.md` (`> 129,511` bytes `>= 35,000` bytes) -> gán `hasError = true` và `process.exit(1)`. | Không có file nào bị sửa đổi.                                                                                                                                                | Phát hiện mâu thuẫn `NEW-01`: Actor B trả về `exit 1` ở cổng `[5/5]` dù cổng `[1/5]`–`[4/5]` đều `PASS`.                                                                                               |

###### Kịch bản S5 (Shared State, Lockfile Dedup & Working Tree Hygiene khi nâng cấp Vitest)

| Thời Điểm | Actor A (`npm` / `package-lock.json`)                                                                             | Actor B (`vitest` / `@vitest/coverage-v8`)                                           | Working Tree & `node_modules/`                                                                                                            | Kết Quả / Ràng Buộc                                                                                                           |
| :-------- | :---------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **T0**    | Trạng thái ban đầu: `package.json` và `package-lock.json` ghim `4.1.11`.                                          | `node_modules/@vitest/*` đang ở `4.1.11`.                                            | `git status --short` sạch (trừ file plan).                                                                                                | Các gói `@vitest/*` đồng bộ ở `4.1.11`.                                                                                       |
| **T1**    | Chạy `npm install --save-dev --save-exact vitest@4.1.12 @vitest/coverage-v8@4.1.12 @vitest/ui@4.1.12` (Bước 1.1). | Chưa chạy test.                                                                      | `package.json` cập nhật 3 dòng devDependencies; `package-lock.json` cập nhật 10 node (`vitest` + 9 `@vitest/*`) lên `4.1.12` deduped.     | Không còn bản `4.1.11` tồn đọng trong `node_modules/`.                                                                        |
| **T2**    | Chạy `WP-3` (`npx vitest run src/lib/core/modelRegistry.test.ts --coverage`).                                     | `@vitest/coverage-v8@4.1.12` chạy và xuất báo cáo coverage ra thư mục `./coverage/`. | Thư mục `coverage/` được tạo mới trên đĩa. Do `.gitignore:1-62` không có `/coverage/`, Git coi `coverage/` là untracked (`?? coverage/`). | Phát hiện `NEW-02`: Nếu không xóa `coverage/`, bước kiểm tra `git status --short` ở `TC-13` sẽ xuất hiện thêm `?? coverage/`. |
| **T3**    | Chạy `TC-13` (`git status --short`).                                                                              | Đã kết thúc.                                                                         | Có thêm `?? coverage/` ngoài 5 mục dự kiến.                                                                                               | Cần dọn sạch `coverage/` hoặc điều chỉnh `WP-3` như yêu cầu tại `NEW-02`.                                                     |

##### 5.3. Kiểm Tra Tương Thích Ngược (Backward Compatibility)

- Nâng cấp patch `vitest` từ `4.1.11` lên `4.1.12` không làm thay đổi API test (`describe`, `it`, `expect`, `vi.mock`, `vi.spyOn`, `vi.hoisted`) hay cấu hình `vitest.config.ts:1-32`.
- Di chuyển `.agents/skills/add-model.md` sang `.agents/skills/add-model/SKILL.md` đồng bộ với 11 skill còn lại trong `.agents/skills/` và cập nhật đầy đủ các liên kết tại `.agents/skills/README.md:36` cũng như `docs/CHANGELOG.md:12,33`.

##### 5.4. Kiểm Tra Bảo Mật & Quyền Truy Cập (Security & Access Control)

- Bản nâng cấp `vitest@4.1.12` cập nhật `@vitest/mocker@4.1.12` (PR `#11580`), bổ sung kiểm tra biên thư mục cho manual và redirect mocks, giảm thiểu bề mặt tấn công Path Traversal / Arbitrary File Read (CVE-2026-84373 / GHSA-82fw-gwwq-j7x9) khi chạy Vitest UI / HMR WebSocket.
- Không có thay đổi nào chạm tới xác thực, phân quyền, biến môi trường hay Supabase RLS.

---

#### 6. Commands Executed & Dismissed Findings

##### 6.1. Danh Sách Lệnh Read-Only Đã Chạy (`allowlist.md`)

1. `npm run type-check` -> `tsc --noEmit` hoàn tất, `exit 0`.
2. `npm ls vitest @vitest/mocker @vitest/coverage-v8 @vitest/ui` -> Xác nhận cả 4 gói hiện tại đang ở `4.1.11` deduped, `exit 0`.
3. `npm view vitest@4.1.12 version dependencies peerDependencies engines` -> Xác nhận `4.1.12` có trên npm registry, khoá cứng 7 gói `@vitest/*` dependencies ở `4.1.12` và peerDependencies `@vitest/coverage-v8: '4.1.12'`, `@vitest/ui: '4.1.12'`, `exit 0`.
4. `npm view @vitest/coverage-v8@4.1.12 version peerDependencies` -> Xác nhận `4.1.12`, `peerDependencies.vitest: '4.1.12'`, `exit 0`.
5. `npm view @vitest/ui@4.1.12 version peerDependencies` -> Xác nhận `4.1.12`, `peerDependencies.vitest: '4.1.12'`, `exit 0`.
6. `git status --short` -> Kiểm tra trạng thái working tree hiện tại, `exit 0`.
7. `npm run lint` -> `eslint .` hoàn tất với 0 lỗi, `exit 0`.
8. `npx vitest run src/lib/core/modelRegistry.test.ts .agents/scripts/code-freeze-guard.test.ts --reporter=dot` -> `2 passed (2)` test files, `109 passed (109)` tests, `exit 0`.
9. `npm view vitest dist-tags` -> Xác nhận tag `V4: '4.1.12'`, `exit 0`.
10. `npm ls vite` -> Xác nhận `vite@7.3.1` deduped, `exit 0`.
11. `npx vitest list --filesOnly` -> Liệt kê `133` test files trong dự án, `exit 0`.
12. `git log -n 3 --oneline .agents/skills/add-model.md` -> Xác nhận lịch sử commit của `.agents/skills/add-model.md` (`82152ba`), `exit 0`.
13. `git status --ignored .agents/skills/` -> Xác nhận không có file bị ignore ẩn trong `.agents/skills/`, `exit 0`.

##### 6.2. Các Nghi Vấn Đã Lọc Bỏ (Dismissed Findings)

1. **Nghi vấn 1**: Liệu `docs/archive/CHANGELOG-legacy.md` hoặc các file trong `docs/plans/` có chứa link tới `.agents/skills/add-model.md` khiến `scripts/verify-docs.mjs` báo lỗi `BROKEN LINK` ở cổng `[1/5]` không?
   - **Lý do lọc bỏ**: Đọc `scripts/verify-docs.mjs:47-55` (`[SRC]`) thấy hàm `getAllDocsFiles` loại trừ `docs/archive` và `docs/plans` (`entry.name !== "archive" && entry.name !== "plans"`). Hơn nữa, kiểm tra `docs/archive/CHANGELOG-legacy.md` không có tham chiếu tới `add-model.md`.
2. **Nghi vấn 2**: Liệu việc thêm 4 dòng YAML frontmatter vào `.agents/skills/add-model/SKILL.md` có làm vượt ngưỡng ký tự governance ở cổng `[4/5]` của `scripts/verify-docs.mjs` không?
   - **Lý do lọc bỏ**: Đọc `scripts/verify-docs.mjs:204-237` (`[SRC]`) thấy cổng `[4/5]` chỉ kiểm tra `GEMINI.md` và các file `.md` trực tiếp trong `.agents/rules/`, không kiểm tra `.agents/skills/*/SKILL.md` (hơn nữa `.agents/skills/add-model/SKILL.md` chỉ dài 62 dòng, ~2.5 KB).
3. **Nghi vấn 3**: Liệu `skills-lock.json` ở thư mục gốc có khoá hash hoặc đường dẫn của `.agents/skills/add-model.md` không?
   - **Lý do lọc bỏ**: Đọc `skills-lock.json:1-24` (`[SRC]`) thấy file này chỉ ghi nhận 2 skill bên ngoài (`emil-design-eng`, `ui-ux-pro-max`), không chứa `add-model`.

---

#### 7. Kết Luận (Conclusion & Gatekeeper Decision)

- Kế hoạch cần được chỉnh sửa để giải quyết **1 lỗi `[MAJOR]` (`NEW-01`)** và **3 lỗi `[MINOR]` (`NEW-02`, `NEW-03`, `NEW-04`)** trước khi cấp thẻ phê duyệt.
- Trạng thái Header đã được cập nhật thành `- **Status**: Changes Requested`.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

- **Reviewer**: `@reviewer` (`gemini-4-argon`, thinking budget Max)
- **Date**: 2026-10-19
- **Plan Revision Evaluated**: Revision 2
- **Verdict**: `[PLAN_APPROVED]` (`0` `[BLOCKER]`, `0` `[MAJOR]`, `0` `[MINOR]`)

---

#### 1. Kiểm Chứng Lỗi Cũ (Previous Findings Verification)

| Mã Lỗi       |  Mức Độ   | Trạng Thái | Bằng Chứng Kiểm Chứng Độc Lập Trên Code Thật (`[SRC]` / `[CMD]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :----------- | :-------: | :--------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ | ------ | ------ | -------- | ------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`NEW-01`** | `[MAJOR]` |  `ĐÃ SỬA`  | **1.** Đã đối chiếu Mục 1 Out of Scope (dòng 29), Mục 3 `A7` (dòng 74), Mục 7 Bước 3.3 (dòng 172), Mục 8 `TC-12` (dòng 192), và Mục 9 `GATE-1-4` / `WP-4` / `NP-1` (dòng 210–214, 236, 241) với mã nguồn `scripts/verify-docs.mjs:95-103,133-141,180-195,225-231,266-302` (`[SRC]`).<br>**2.** Mảng `need` trong lệnh `GATE-1-4` (dòng 213) khớp từng chuỗi log `PASS:` của 4 cổng trong `scripts/verify-docs.mjs`: `'PASS: Scanned '` (dòng 102), `'PASS: Zero legacy references found'` (dòng 140), `'PASS: All active governance files use full .agents/ prefixes.'` (dòng 194), `'PASS: All rules <= 12,000 chars'` (dòng 230); đồng thời bộ lọc `fails` giữ lại mọi dòng bắt đầu bằng `'FAIL:'` ngoại trừ `'FAIL: CHANGELOG.md exceeds 35,000 bytes'` ở cổng `[5/5]` (`scripts/verify-docs.mjs:267`).<br>**3.** Kiểm chứng `[CMD]` in-memory trên các file `.agents/rules/*.md` và `.agents/agents/*/agent.md` xác nhận cả 6 file rule (`<= 11,044` chars `< 12,000`) và 3 file agent (`<= 9,779` chars `< 10,000`) đều đạt cổng `[4/5]`. |
| **`NEW-02`** | `[MINOR]` |  `ĐÃ SỬA`  | **1.** Mục 1 Out of Scope (dòng 30), Mục 2 (dòng 47) và Mục 9 `WP-3` (dòng 229–235) đã loại bỏ cờ `--coverage` và bỏ giả định `coverage/` nằm trong `.gitignore:1-62` (`[SRC]`).<br>**2.** Đã kiểm tra `node_modules/vitest/package.json:47` (`"./package.json": "./package.json"`), `node_modules/@vitest/coverage-v8/package.json:35` (`"./*": "./*"`), và `node_modules/@vitest/ui/package.json:32` (`"./*": "./*"`) (`[SRC]`), đồng thời chạy `[CMD]` `node -e` kiểm chứng `require('vitest/package.json')`, `require('@vitest/coverage-v8/package.json')`, `require('@vitest/ui/package.json')`, `require.resolve('@vitest/coverage-v8')`, `require.resolve('@vitest/ui')` -> trả về đúng đường dẫn `dist/index.js` và version mà không ghi file ra đĩa.                                                                                                                                                                                                                                                                                  |
| **`NEW-03`** | `[MINOR]` |  `ĐÃ SỬA`  | **1.** Đã kiểm tra Bước 2.5 (dòng 166), `TC-9` (dòng 189), `TC-10` (dòng 190), và §9 `GATE-1-4` / `BODY-DIFF` / `OLD-FILE-GONE` / `NO-OLD-REFS` (dòng 208–224): không còn sử dụng `tail`, `diff -u`, `test -e`, hay `grep -rn`.<br>**2.** Đã chạy `[CMD]` trên Windows PowerShell 5.1 để kiểm chứng từng biểu thức `node -e`: mọi câu lệnh đều chỉ dùng nháy đơn bên trong chuỗi `"..."`, không chứa ký tự backtick hay biến `$` gây lỗi parser PowerShell 5.1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **`NEW-04`** | `[MINOR]` |  `ĐÃ SỬA`  | **1.** Đã kiểm tra §2 (dòng 49) và §3 `A3` (dòng 69): đã sửa thành **7** gói `@vitest/*` transitive (`@vitest/spy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | utils | expect | mocker | runner | snapshot | pretty-format`).<br>**2.** Chạy `[CMD]` `node -e`đếm các khóa`packages`trong`package-lock.json`khớp`/(^ | \/)(vitest | @vitest\/[^/]+)$/`-> trả về đúng`count=10` (`1` `vitest`+`2` `@vitest/_`direct +`7` `@vitest/_`transitive), thống nhất với`G1`(dòng 16) và`TC-3` (dòng 183). |

---

#### 2. Phát Hiện Mới (New Findings)

Không phát hiện lỗi mới (`0` `[BLOCKER]`, `0` `[MAJOR]`, `0` `[MINOR]`) sau khi đọc lại toàn bộ `## Technical Plan` của Revision 2, đối chiếu từng phần vừa sửa với mã nguồn thật và thực hiện 4 phép thử tấn công độc lập tại Mục 3 bên dưới.

---

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Attack Probe 1 — Kiểm tra khả năng `require('<pkg>/package.json')` trong `WP-3` (§9, dòng 232) bị chặn bởi `exports` map của Node.js (`ERR_PACKAGE_PATH_NOT_EXPORTED`)**:
   - **Bằng chứng `[SRC]`**: Đọc trực tiếp `node_modules/vitest/package.json:32-48` (có `"./package.json": "./package.json"` tại dòng 47), `node_modules/@vitest/coverage-v8/package.json:26-36` (có `"./*": "./*"` tại dòng 35), và `node_modules/@vitest/ui/package.json:23-33` (có `"./*": "./*"` tại dòng 32).
   - **Bằng chứng `[CMD]`**: Chạy `node -e "const vt=require('vitest/package.json').version;for(const n of ['@vitest/coverage-v8','@vitest/ui']){const p=require(n+'/package.json');const entry=require.resolve(n);console.log(n,p.version,'peer vitest='+p.peerDependencies.vitest,entry,'vt='+vt)}"` -> thoát mã `0`, in đầy đủ version, `peerDependencies.vitest` và đường dẫn `dist/index.js`.
2. **Attack Probe 2 — Kiểm tra độ lệch chỉ số dòng (`slice(4)` vs `slice(3)`) trong lệnh `BODY-DIFF` (`TC-9`, dòng 189 & 219) trên nội dung thực tế của `.agents/skills/add-model.md`**:
   - **Bằng chứng `[SRC]`**: Đọc `.agents/skills/add-model.md:1-10` — dòng 1–3 (index `0..2`) là frontmatter cũ (`---` / `description: ...` / `---`), dòng 4 (index `3`) là dòng trống `""`, dòng 5 (index `4`) là `# Adding New Models to Vikini`. Trong file `.agents/skills/add-model/SKILL.md` mới (§6, dòng 128–136), frontmatter mới có 4 dòng (index `0..3`), dòng 5 (index `4`) là dòng trống `""`, dòng 6 (index `5`) là `# Adding New Models to Vikini`.
   - **Bằng chứng `[CMD]`**: Chạy `node -e "const fs=require('fs');const norm=s=>s.replace(/\r\n/g,'\n').split('\n');const orig=norm(fs.readFileSync('.agents/skills/add-model.md','utf8'));const simulatedSkill=['---','name: add-model','description: MANDATORY','---','', ...orig.slice(4)];const a=simulatedSkill.slice(4).join('\n');const b=orig.slice(3).join('\n');console.log('match='+(a===b),'line4_orig='+JSON.stringify(orig[3]),'line5_orig='+JSON.stringify(orig[4]))"` -> thoát mã `0`, in `match=true line4_orig="" line5_orig="# Adding New Models to Vikini"`.
3. **Attack Probe 3 — Kiểm tra nguy cơ phát sinh broken relative link hoặc lỗi shorthand ở cổng `[1/5]` và `[3/5]` của `scripts/verify-docs.mjs` khi dời `.agents/skills/add-model.md` sâu thêm 1 cấp thư mục vào `.agents/skills/add-model/SKILL.md` và giữ nguyên `docs/CHANGELOG.md:33` (`D3`)**:
   - **Bằng chứng `[SRC]`**:
     - Trong `scripts/verify-docs.mjs:49-53`, bộ kiểm tra link (`[1/5]`) loại bỏ cả fenced code blocks (` ``` `) lẫn inline code spans (`` `[^`]*` ``) trước khi chạy `linkRegex`. Tại `docs/CHANGELOG.md:33`, chuỗi `.agents/skills/add-model.md` nằm trong cặp backtick inline code (`` `.agents/skills/add-model.md` ``), không phải markdown link `[...](...)`, nên việc giữ nguyên `docs/CHANGELOG.md:33` theo `D3` không gây lỗi broken link ở cổng `[1/5]`.
     - Trong `.agents/skills/add-model.md:1-58`, tham chiếu tại dòng 46 (``See `.agents/skills/add-translation/SKILL.md` ``) đã dùng tiền tố đầy đủ `.agents/` và nằm trong inline code backticks.
   - **Bằng chứng `[CMD]`**: Chạy `node -e "const fs=require('fs');const raw=fs.readFileSync('.agents/skills/add-model.md','utf8');const stripped=raw.replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g,'').replace(/\x60[^\x60]*\x60/g,'');const links=[...stripped.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];const shorthand=/(?:^|[^\w./-])(rules|skills|workflows)\/([\w.-]+\.md)/;const shLines=raw.split('\n').filter(l=>!l.includes('\x60\x60\x60')&&shorthand.test(l));console.log('markdown_links='+links.length,'shorthand_lines='+shLines.length)"` -> thoát mã `0`, in `markdown_links=0 shorthand_lines=0`.
4. **Attack Probe 4 — Kiểm tra tương tác giữa `.gitignore:38-52` và `.agents/skills/add-model/SKILL.md` (`A5`, Bước 2.2, `TC-11`, `NP-2`)**:
   - **Bằng chứng `[SRC]`**: Đọc `.gitignore:38-52` — dòng 40 là `.agents/skills/*`, dòng 42 hiện là `!.agents/skills/add-model.md`, và các dòng 43–49 là `!.agents/skills/<name>/` cho 7 thư mục skill nội bộ khác. Khi đổi dòng 42 thành `!.agents/skills/add-model/`, Git unignore thư mục `.agents/skills/add-model/` và toàn bộ file bên trong nó (`SKILL.md`), đồng bộ với 7 thư mục skill ở dòng 43–49.

---

#### 4. Plan Completeness Gate & Mental Simulation Verification Matrix

##### 4.1. Plan Completeness Gate (7 Hạng Mục Bắt Buộc)

| #   | Hạng Mục                                                       | Trạng Thái |   Evidence Type   | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                                                                              |
| :-- | :------------------------------------------------------------- | :--------: | :---------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bảng Verified Versions (2026)                                  |   `PASS`   | `[CMD]` + `[URL]` | Mục 4 (dòng 87–99) xác minh `vitest`, `@vitest/coverage-v8`, `@vitest/ui`, `@vitest/mocker` và 6 gói `@vitest/*` còn lại ở `4.1.12` (2026-10-15), kèm `vite@7.3.1` và `Node.js 24.x`.                                                                                                            |
| 2   | Checklist các bước tuần tự (`[NEW]`, `[MODIFY]`, `[DELETE]`)   |   `PASS`   |      `[SRC]`      | Mục 5 (dòng 100–111) và Mục 7 (dòng 143–174) gắn nhãn `[MODIFY]`, `[NEW]`, `[DELETE]` cho toàn bộ 7 file trong phạm vi (`package.json`, `package-lock.json`, `.agents/skills/add-model/SKILL.md`, `.agents/skills/add-model.md`, `.gitignore`, `.agents/skills/README.md`, `docs/CHANGELOG.md`). |
| 3   | Verification Plan (lệnh verify, wiring probe, negative probes) |   `PASS`   | `[SRC]` + `[CMD]` | Mục 9 (dòng 196–246) bao gồm lệnh verify PowerShell 5.1, 4 lệnh tái sử dụng (`GATE-1-4`, `BODY-DIFF`, `OLD-FILE-GONE`, `NO-OLD-REFS`), 5 Wiring Probes (`WP-1`..`WP-5`), và 5 Negative Probes (`NP-1`..`NP-5`).                                                                                  |
| 4   | Test Contract                                                  |   `PASS`   | `[SRC]` + `[CMD]` | Mục 8 (dòng 175–195) định nghĩa 12 điều kiện kiểm thử (`TC-1`..`TC-12`) kèm điều khoản chống specification gaming.                                                                                                                                                                               |
| 5   | Assumptions & Cross-Task Dependencies                          |   `PASS`   | `[SRC]` + `[CMD]` | Mục 3 (dòng 63–86) liệt kê `A1`–`A7`, Cross-Task Dependencies và 3 mục `[NEEDS_PRODUCT_DECISION]` (`D1`–`D3`) kèm Default Assumption rõ ràng.                                                                                                                                                    |
| 6   | Out of Scope (What We're NOT Doing)                            |   `PASS`   |      `[SRC]`      | Mục 1 (dòng 19–31) liệt kê 10 hạng mục ngoài phạm vi, bao gồm cổng `[5/5]` của `scripts/verify-docs.mjs` và cờ `--coverage`.                                                                                                                                                                     |
| 7   | Skills Loaded & Applied                                        |   `PASS`   |      `[SRC]`      | Mục 2 (dòng 53–61) nạp và áp dụng `.agents/skills/vikini-investigate/SKILL.md`, `.agents/skills/vikini-simplify/SKILL.md`, `.agents/skills/add-translation/SKILL.md`.                                                                                                                            |

##### 4.2. Mental Simulation Verification Matrix (S1–S6 + Domain Open Inquiry)

| Kịch Bản                                      | Trạng Thái |   Evidence Type   | Chi Tiết Kiểm Chứng                                                                                                                                                                                                                                                                                                                      |
| :-------------------------------------------- | :--------: | :---------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 — Cold-start & Build**                   |   `PASS`   | `[SRC]` + `[CMD]` | Baseline `npm run type-check` và `npm run lint` đều `exit 0`. Nâng cấp `vitest@^4.1.12` giữ nguyên tương thích với `vite@7.3.1` và `Node 24.x`; bước `GATE-1-4` kiểm chứng 4 cổng `[1/5]`–`[4/5]` của `scripts/verify-docs.mjs`.                                                                                                         |
| **S2 — Runner Lifecycle & Teardown**          |   `PASS`   | `[SRC]` + `[CMD]` | Không thay đổi lifecycle runtime hay `vitest.config.ts:1-31`. Các probe trong §9 (`WP-3`, `GATE-1-4`, `BODY-DIFF`, `OLD-FILE-GONE`) đều chạy in-memory, không tạo file rác hay thư mục `coverage/` trên đĩa.                                                                                                                             |
| **S3 — Database & Temporal Logic / Ordering** |   `PASS`   | `[SRC]` + `[ADV]` | Không chạm DB/Supabase. Thứ tự thực thi giữa Bước 2.1 (tạo `SKILL.md`), Bước 2.2 (sửa `.gitignore:42`), Bước 2.3 (xóa `add-model.md`), Bước 2.4 (sửa `.agents/skills/README.md:19,49`), và Bước 3.3 (`GATE-1-4`) được phân tích trong Adversarial Timeline ở Mục 5.2.                                                                    |
| **S4 — Cross-Task State Flow**                |   `PASS`   | `[SRC]` + `[CMD]` | Kế thừa nhất quán phương án `D3` từ `docs/plans/2026-10-19-pstack-skills-and-fast-track-implementation-plan.md:95` và chuẩn hóa whitelist trong `.gitignore:40-49`.                                                                                                                                                                      |
| **S5 — Security Boundary & Shared State**     |   `PASS`   | `[SRC]` + `[ADV]` | Không chạm NextAuth, Supabase RLS hay Redis. Ở tầng dev/test toolchain, `@vitest/mocker@4.1.12` (PR `#11580`) gia cố kiểm tra biên thư mục cho manual/redirect mocks; lockfile được kiểm chứng dedup qua `TC-2`, `TC-3`, `TC-4`.                                                                                                         |
| **S6 — External Resilience & Serverless Cap** |   `PASS`   |      `[SRC]`      | Không chạm route API serverless hay SDK AI ngoài.                                                                                                                                                                                                                                                                                        |
| **Domain Open Inquiry**                       |   `PASS`   | `[SRC]` + `[CMD]` | Đã kiểm chứng: (1) Tương tác giữa `.gitignore:40-49`, `.agents/skills/README.md:19,49`, và `scripts/verify-docs.mjs:37-42,150-163,252-302`; (2) Tính tương thích của toàn bộ lệnh `node -e` và `git grep` trên Windows PowerShell 5.1; (3) Ghi nhận trung thực trạng thái CVE-2026-84373 (`D1`) và giữ nguyên body skill (`D2`, `TC-9`). |

---

#### 5. Claim Verification & Adversarial Timelines

##### 5.1. Kiểm Chứng Khẳng Định Kỹ Thuật (4.5.1, 4.5.3, 4.5.4)

1. **Library Claim Verification (4.5.1)**:
   - Đã kiểm chứng trực tiếp trên `node_modules/vitest/package.json:1-120`, `node_modules/@vitest/coverage-v8/package.json:1-77`, `node_modules/@vitest/ui/package.json:1-98` (`[SRC]`) và qua `npm view vitest@4.1.12` (`[CMD]`): `vitest@4.1.12` ghim chính xác 7 gói `@vitest/*` transitive ở `4.1.12` và yêu cầu peer `@vitest/coverage-v8@4.1.12`, `@vitest/ui@4.1.12`.
2. **Enforcement Claim Verification (4.5.3)**:
   - Kế hoạch trang bị đủ 5 Negative Probes (`NP-1`..`NP-5` tại §9, dòng 239–245) chứng minh các chốt chặn hoạt động: `NP-1` chứng minh `scripts/verify-docs.mjs` cổng `[1/5]` và `GATE-1-4` bắt lỗi broken link khi xóa `add-model.md` trước khi cập nhật `README.md`; `NP-2` chứng minh `git check-ignore -v` bắt trạng thái bị ignore bởi `.gitignore:40` trước khi cập nhật `.gitignore:42`; `NP-3` chứng minh `git grep` bắt được 3 tham chiếu cũ trên `HEAD` hiện tại.
3. **Risk Table Audit (4.5.4)**:
   - Bảng rủi ro tại §10 (dòng 249–260) gồm 1 rủi ro mức **Cao** (`R1`: `.gitignore` nuốt `SKILL.md` mới -> được kiểm soát bởi Bước 2.2, `NP-2`, `TC-11`) và 4 rủi ro mức **Trung bình** (`R2`..`R5` -> được kiểm soát bởi `NP-1`/`TC-12`, `TC-5`/`WP-2`, `TC-3`/`TC-4`, và Bước 1.2/1.5). Mọi rủi ro Cao/Trung bình đều có technical control và probe kiểm chứng tương ứng.

##### 5.2. Adversarial Timeline (4.5.2 — 4 Trục Đối Kháng)

```
Cơ chế 1: Di chuyển Skill & Cập nhật Whitelist Gitignore + Link Routing (Phase 2 & Phase 3)
T1: Implementer tạo .agents/skills/add-model/SKILL.md (Bước 2.1) khi .gitignore:40 vẫn chặn .agents/skills/* -> NP-2 xác nhận git check-ignore trả exit 0.
T2: Implementer cập nhật .gitignore:42 thành !.agents/skills/add-model/ (Bước 2.2) và xóa .agents/skills/add-model.md (Bước 2.3) khi .agents/skills/README.md:19,49 vẫn trỏ tới ./add-model.md -> NP-1 xác nhận GATE-1-4 trả exit 1 với FAIL: Found broken links:.
T3: Implementer cập nhật .agents/skills/README.md:19,49 (Bước 2.4) -> Chạy lại GATE-1-4 (Bước 3.3 / TC-12) và TC-11.
Kết cục: Cổng [1/5]–[4/5] đều in PASS:, GATE-1-4 thoát mã 0, file SKILL.md mới không bị git ignore, file cũ đã xóa sạch -> AN TOÀN.
```

- **4 Trục Đối Kháng (4.5.2)**:
  1. **Đồng thời (Concurrency)**: `N/A` — Thao tác nâng cấp dependency và di chuyển file tài liệu diễn ra tuần tự trên working tree cục bộ của một phiên làm việc duy nhất, không có request song song.
  2. **Khoảng trống check→use (TOCTOU)**: Đã kiểm chứng qua chuỗi `NP-2` (giữa Bước 2.1 và 2.2) và `NP-1` (giữa Bước 2.3 và 2.4) để đảm bảo không commit ở trạng thái trung gian khi `.gitignore` hoặc `README.md` chưa đồng bộ.
  3. **Thất bại giữa chừng & dọn dẹp (Partial Failure & Cleanup)**: Nếu `npm install` ở Bước 1.1 gây churn ngoài phạm vi trên `package-lock.json`, Bước 1.5 quy định kiểm tra `git diff --stat` và rollback; ở `WP-3`, việc thay thế `--coverage` bằng probe `node -e` in-memory loại bỏ nguy cơ để lại thư mục `coverage/` làm bẩn working tree.
  4. **Môi trường serverless**: `N/A` — Task chỉ thay đổi `devDependencies` (`vitest`, `@vitest/coverage-v8`, `@vitest/ui`) và tài liệu `.agents/skills/`, không chạm tới runtime serverless của Next.js App Router.

---

#### 6. Commands Executed & Dismissed Findings

##### 6.1. Danh Sách Lệnh Read-Only Đã Chạy Ở Audit Run 2 (`allowlist.md`)

1. `node -e "const vt=require('vitest/package.json').version;for(const n of ['@vitest/coverage-v8','@vitest/ui']){const p=require(n+'/package.json');const entry=require.resolve(n);console.log(n,p.version,'peer vitest='+p.peerDependencies.vitest,entry,'vt='+vt)}"` -> Kiểm chứng `WP-3` trên `node_modules/` thật, `exit 0`.
2. `node -e "const lock=require('./package-lock.json');const keys=Object.keys(lock.packages||{}).filter(k=>/(^|\/)(vitest|@vitest\/[^/]+)$/.test(k));console.log('count='+keys.length,keys.map(k=>k+':'+lock.packages[k].version).join(', '))"` -> Kiểm chứng `TC-3` đếm đúng `10` key trong `package-lock.json`, `exit 0`.
3. `node -e "const fs=require('fs');const norm=s=>s.replace(/\r\n/g,'\n').split('\n');const orig=norm(fs.readFileSync('.agents/skills/add-model.md','utf8'));const simulatedSkill=['---','name: add-model','description: MANDATORY','---','', ...orig.slice(4)];const a=simulatedSkill.slice(4).join('\n');const b=orig.slice(3).join('\n');console.log('match='+(a===b),'line4_orig='+JSON.stringify(orig[3]),'line5_orig='+JSON.stringify(orig[4]))"` -> Kiểm chứng logic `BODY-DIFF` (`TC-9`) khớp chỉ số dòng (`slice(4)` vs `slice(3)`), `exit 0`.
4. `node -e "const fs=require('fs'),path=require('path');for(const f of fs.readdirSync('.agents/rules').filter(x=>x.endsWith('.md'))){const len=fs.readFileSync(path.join('.agents/rules',f),'utf8').length;console.log('rule',f,len,len<=12000?'OK':'OVER')}for(const a of fs.readdirSync('.agents/agents')){const p=path.join('.agents/agents',a,'agent.md');if(fs.existsSync(p)){const len=fs.readFileSync(p,'utf8').length;console.log('agent',a,len,len<=10000?'OK':'OVER')}}"` -> Kiểm chứng cổng `[4/5]` của `scripts/verify-docs.mjs` trên toàn bộ file rule và agent hiện tại, `exit 0`.
5. `node -e "const fs=require('fs'),path=require('path');const readme=fs.readFileSync('.agents/skills/README.md','utf8').replace(/\.\/add-model\.md/g,'./add-model/SKILL.md').replace(/\[add-model\.md\]/g,'[add-model]').replace(/\[\.agents\/skills\/add-model\.md\]/g,'[.agents/skills/add-model/SKILL.md]');const shorthand=/(?:^|[^\w./-])(rules|skills|workflows)\/([\w.-]+\.md)/;const badLines=readme.split('\n').filter(l=>!l.includes('`')&&shorthand.test(l));console.log('remaining_old_links='+readme.includes('add-model.md'),'shorthand_matches='+badLines.length)"`-> Kiểm chứng thay thế link trong`.agents/skills/README.md`không tạo lỗi shorthand,`exit 0`.
6. `node -e "const fs=require('fs');const raw=fs.readFileSync('.agents/skills/add-model.md','utf8');const stripped=raw.replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g,'').replace(/\x60[^\x60]*\x60/g,'');const links=[...stripped.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];const shorthand=/(?:^|[^\w./-])(rules|skills|workflows)\/([\w.-]+\.md)/;const shLines=raw.split('\n').filter(l=>!l.includes('\x60\x60\x60')&&shorthand.test(l));console.log('markdown_links='+links.length,'shorthand_lines='+shLines.length)"` -> Kiểm chứng nội dung `.agents/skills/add-model.md` không có relative markdown link bị gãy hay shorthand khi dời vào `.agents/skills/add-model/SKILL.md`, `exit 0`.
7. `node -e "console.log('add-model.md exists=',require('fs').existsSync('.agents/skills/add-model.md'))"` -> Kiểm chứng biểu thức `OLD-FILE-GONE` (`TC-10`), `exit 0`.
8. `git status --short` -> Kiểm tra trạng thái working tree, `exit 0`.

##### 6.2. Các Nghi Vấn Đã Lọc Bỏ (Dismissed Findings)

1. **Nghi vấn 1**: Liệu việc giữ nguyên tham chiếu `.agents/skills/add-model.md` ở `docs/CHANGELOG.md:33` (theo quyết định `D3`, dòng 85) có làm cổng `[1/5]` của `scripts/verify-docs.mjs` báo lỗi broken link không?
   - **Lý do lọc bỏ**: Đọc `docs/CHANGELOG.md:33` và `scripts/verify-docs.mjs:49-53` (`[SRC]`) xác nhận chuỗi `.agents/skills/add-model.md` tại `docs/CHANGELOG.md:33` nằm trong cặp backtick inline code (`` `.agents/skills/add-model.md` ``), không phải cú pháp liên kết `[text](href)`. Hàm kiểm tra link tại `scripts/verify-docs.mjs:52` đã strip toàn bộ inline code (``noCodeBlocks.replace(/`[^`]*`/g, "")``) trước khi quét `linkRegex`.
2. **Nghi vấn 2**: Liệu việc chạy `npx prettier --write .agents/skills/README.md .agents/skills/add-model/SKILL.md` ở Bước 2.4 (dòng 165) có làm thay đổi body của `SKILL.md` khiến `TC-9` (`BODY-DIFF`) báo `BODY MISMATCH` không?
   - **Lý do lọc bỏ**: Tại `TC-9` (dòng 189), kế hoạch đã dự liệu rõ trường hợp này: _"nếu prettier đổi khoảng trắng ở bước 2.4: hoàn tác phần đó, không nới so sánh"_.

---

#### 7. Kết Luận (Conclusion & Gatekeeper Decision)

- Toàn bộ 4 phát hiện từ Audit Run 1 (`NEW-01` `[MAJOR]`, `NEW-02` `[MINOR]`, `NEW-03` `[MINOR]`, `NEW-04` `[MINOR]`) đã được xử lý và kiểm chứng trên mã nguồn thật.
- Không phát sinh lỗi mới trong Revision 2.
- Trạng thái Header của bản kế hoạch đã được cập nhật thành `- **Status**: Approved` và cấp thẻ phê duyệt dưới đây.

[PLAN_APPROVED]
