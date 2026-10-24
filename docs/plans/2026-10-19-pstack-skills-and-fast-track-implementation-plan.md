# Kế Hoạch Triển Khai: Chuẩn Hóa Skills Vikini, Tinh Tuyển pstack/fstack/AAS & Fast-Track Mode

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-19
- **Author**: Claude Code CLI (@planner)

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope

#### 1.1 Mục Tiêu

1. **Dọn rác skill ngoại lai**: Xóa 3 bộ skill bên thứ ba không còn dùng (`redesign-existing-projects`, `design-taste-frontend`, `ux-ui-agent-skills`) khỏi `.agents/skills/`, kèm 2 junction trỏ tới chúng trong `.claude/skills/` và 2 entry trong `skills-lock.json`.
2. **Chuẩn hóa 5 skill nội bộ** sang cấu trúc `.agents/skills/<name>/SKILL.md` với YAML frontmatter `name` + `description` dạng trigger cưỡng bức (`MANDATORY when ...`). Nội dung hướng dẫn giữ nguyên; chỉ đổi frontmatter và đường dẫn tham chiếu nội bộ.
3. **Thêm 2 skill mới gọn nhẹ (≤ 150 dòng/file)**: `vikini-investigate` (4 mode read-only `/how`, `/why`, `/recall`, `/blast-radius`) và `vikini-simplify` (rút gọn code, giữ nguyên hành vi).
4. **4 tầng bảo đảm dùng đúng skill**: (a) frontmatter trigger trong `SKILL.md`; (b) bảng Pre-Work Protocol + Skill Precedence Hierarchy trong `.agents/rules/02-quality.md`; (c) mục bắt buộc **Skills Loaded & Applied** trong plan (`@planner`); (d) Reviewer kiểm tra mục này ở Plan Completeness Gate (`[MAJOR]` nếu thiếu). Bổ sung thêm quy tắc Token Efficiency (`00-core.md`) và 4 UI States (`03-ui.md`).
5. **Fast-Track Mode** cho chỉnh sửa vi mô UI/translation/CSS: hook `.agents/scripts/code-freeze-guard.js` cho phép (`allow`) `replace_file_content` ≤ 40 dòng trên bề mặt UI thuần túy khi chưa có `[PLAN_APPROVED]`, đặt sau mọi chốt chặn an toàn hiện có. Có unit test đầy đủ cho biên 40/41 dòng và các đường âm (negative paths).

#### 1.2 Out of Scope (What We're NOT Doing)

- **Không** di chuyển `.agents/skills/add-model.md` sang `add-model/SKILL.md` (brief chỉ liệt kê 5 skill). Chỉ sửa 1 đường dẫn tham chiếu bên trong nó (dòng 46) tới `add-translation/SKILL.md`. Xem `[NEEDS_PRODUCT_DECISION] D3`.
- **Không** đụng `.agents/skills/emil-design-eng/`, `.agents/skills/animation-vocabulary/`, `.agents/skills/review-animations/`. Các junction tương ứng trong `.claude/skills/` cũng giữ nguyên.
- **Không** sửa `docs/archive/**`, các plan cũ trong `docs/plans/**`, và `docs/specs/2026-09-04-chat-core-ux-ui-augmentation-design.md:31` (có nhắc `skills/redesign-existing-projects`, đây là bản ghi lịch sử).
- **Không** sửa root proxy `scripts/code-freeze-guard.js` (6 dòng, chỉ `import "../.agents/scripts/code-freeze-guard.js"`) và **không** sửa `.agents/hooks.json`.
- **Không** xử lý lỗi `[5/5] CHANGELOG.md exceeds 35,000 bytes` của `scripts/verify-docs.mjs`. Lỗi này đã có từ trước (baseline: 122,849 bytes) và không thuộc task này.
- **Không** mở rộng Fast-Track cho `write_to_file`, file `.ts` logic (hooks, stores, `lib/**`), `src/app/globals.css`, `src/app/features/styles/*.css`, hay bất kỳ file nào ngoài 3 regex ở §6.
- **Không** tạo junction `.claude/skills/` cho 7 skill Vikini (Claude CLI reviewer đọc trực tiếp bằng Read). Có thể làm ở task sau.
- **Không** chạy bất kỳ lệnh git nào (`00-core.md` §Git). User tự commit.
- **Không** thay đổi mã nguồn ứng dụng trong `src/**`.

### 2. Tài Liệu Cần Tham Chiếu & Skills Loaded (Pre-Work Reading)

#### 2.1 Tài liệu governance đã đọc khi khảo sát (số dòng / số ký tự đo bằng `fs.readFileSync(...).length`)

| File                                           | Dòng |  Ký tự |                  Giới hạn | Vai trò trong plan                                                |
| ---------------------------------------------- | ---: | -----: | ------------------------: | ----------------------------------------------------------------- |
| `.agents/rules/00-core.md`                     |   60 |  2,804 |                    12,000 | `[MODIFY]` Token Efficiency                                       |
| `.agents/rules/01-coding.md`                   |  142 |  9,587 |                    12,000 | `[MODIFY]` dòng 44 (đường dẫn)                                    |
| `.agents/rules/02-quality.md`                  |  146 |  8,862 |                    12,000 | `[MODIFY]` Pre-Work table, Precedence, dòng 93–95                 |
| `.agents/rules/03-ui.md`                       |   88 |  5,386 |                    12,000 | `[MODIFY]` 4 UI States                                            |
| `.agents/rules/04-bilingual.md`                |   56 |  1,707 |                    12,000 | `[MODIFY]` dòng 55 (đường dẫn)                                    |
| `.agents/rules/05-plan-review.md`              |   84 |  7,399 |                    12,000 | `[MODIFY]` Fast-Track Mode                                        |
| `.agents/agents/planner/agent.md`              |   84 |  6,484 |                    10,000 | `[MODIFY]` mục bắt buộc + 8 nguyên lý                             |
| `.agents/agents/reviewer/agent.md`             |  118 |  8,559 | 10,000 (mục tiêu ≤ 9,500) | `[MODIFY]` Gate + Dismissed Findings, kèm cô đọng                 |
| `.agents/agents/reviewer/mental-simulation.md` |    — |  5,495 |                         — | `[MODIFY]` dòng 16, 23, 37 (đường dẫn)                            |
| `.agents/workflows/audit.md`                   |   54 |  1,578 |                         — | `[MODIFY]` dòng 21 (đường dẫn)                                    |
| `.agents/scripts/claude-reviewer-prompt.md`    |   39 |  2,944 |                         — | `[MODIFY]` Gate + Dismissed Findings                              |
| `.agents/scripts/code-freeze-guard.js`         |  671 | 22,701 |                         — | `[MODIFY]` Fast-Track                                             |
| `.agents/scripts/code-freeze-guard.test.ts`    |  597 |      — |                         — | `[MODIFY]` thêm test (hiện có 66 test, đo bằng `npx vitest list`) |
| `.agents/skills/README.md`                     |   48 |  3,888 |                         — | `[MODIFY]` catalog + routing table                                |
| `scripts/verify-docs.mjs`                      |    — |      — |                         — | Chỉ đọc. Dùng làm cổng kiểm tra link, shorthand và giới hạn ký tự |

#### 2.2 Skills Loaded & Applied (Skill Citation Proof)

| Skill / tài liệu đã đọc                                                                                                                                   | Quyết định trong plan được định hình                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/02-quality.md` §Pre-Work Protocol (dòng 8–33)                                                                                              | Task chạm governance + hook script, không chạm domain API route / SSE / DB / translation UI, nên **không có domain SKILL.md bắt buộc** cho chính plan này. |
| `.agents/rules/02-quality.md` §Governance-Only Changes (dòng 97–106)                                                                                      | Đặt ngân sách ký tự cho từng file ở §9.3.                                                                                                                  |
| `.agents/rules/05-plan-review.md` §1, §5                                                                                                                  | Fast-Track đặt **sau** mọi chốt Scoped Protection. Header `Status: Ready for Review`, không ghi `[PLAN_APPROVED]`.                                         |
| `.agents/rules/01-coding.md` §Testing Requirements (dòng 61–71)                                                                                           | Test co-located `.agents/scripts/code-freeze-guard.test.ts` cho mọi hàm export mới (`countLines`, `isFastTrackEligible`).                                  |
| `.agents/skills/{api-patterns,streaming-patterns,database-migration,add-feature,add-translation}.md` (đọc frontmatter dòng 1–8 và grep tham chiếu nội bộ) | Đây là nguồn để migrate. Phát hiện `add-feature.md` có 3 tham chiếu nội bộ (dòng 32, 70, 79) và `add-model.md` có 1 (dòng 46) cần cập nhật.                |

> Plan này không dùng skill `superpowers` nào để thay quy trình Vikini.

### 3. Assumptions & Cross-Task Dependencies

**Assumptions (đã kiểm chứng `[SRC]`/`[CMD]` khi khảo sát):**

- **A1 `[CMD]`**: `.gitignore:40` chứa `.agents/skills`, nên **mọi file mới trong `.agents/skills/` sẽ bị git bỏ qua**. `git ls-files .agents/skills` hiện chỉ track 5 file: `animation-vocabulary/SKILL.md`, `emil-design-eng/SKILL.md`, `redesign-existing-projects/SKILL.md`, `review-animations/{SKILL,STANDARDS}.md`. Các file `api-patterns.md`… và `README.md` **chưa bao giờ được track**. Nếu không sửa `.gitignore`, 7 `SKILL.md` mới sẽ không được commit. Xem `D1`.
- **A2 `[CMD]`**: `.claude/skills/{design-taste-frontend,redesign-existing-projects}` là **NTFS junction** trỏ vào `.agents/skills/...` (`dir /AL`). Phải gỡ junction **trước** khi xóa thư mục đích. Lý do: `Remove-Item -Recurse` trên junction trong PowerShell 5.1 có thể xóa nội dung đích, và junction mồ côi sẽ làm Claude Code load skill lỗi.
- **A3 `[CMD]`**: `.agents/skills/ux-ui-agent-skills/` chứa repo git lồng (`.git/` với pack file read-only) và ~330 file (`.md`, `.json`, `.mjs`, `.py`, `.html`, `.tsx`, `.css`). Cần `Remove-Item -Recurse -Force`.
- **A4 `[SRC]`**: `.agents/hooks.json` chạy `node scripts/code-freeze-guard.js`. File root này là proxy import module `.agents/scripts/code-freeze-guard.js`. Guard `main()` chạy được vì `process.argv[1]` kết thúc bằng `code-freeze-guard.js` (`.agents/scripts/code-freeze-guard.js:669`). Vì vậy chỉ cần sửa file trong `.agents/scripts/`.
- **A5 `[SRC]`**: `tsconfig.json` có `allowJs: true` và `include: ["**/*.js", ...]`, và guard có `// @ts-check`. JSDoc của hàm mới phải đúng kiểu để `npm run type-check` pass. `eslint.config.mjs:109` ignore `.agents/**`, nên lint không quét guard.
- **A6 `[CMD]`**: `npx vitest list .agents/scripts/code-freeze-guard.test.ts` liệt kê 66 test, tức Vitest gốc tự phát hiện file test này qua `npm run test:run`.
- **A7 `[SRC]`**: `extractInput()` gộp nhiều `ReplacementChunks` bằng `"\n"` (`code-freeze-guard.js:609-610`). Fast-Track vì vậy đếm **tổng** dòng của mọi chunk trong một lần gọi.
- **A8 `[SRC]`**: `isPlanApproved()` chỉ xét file plan mới nhất theo mtime (`code-freeze-guard.js:201`). Khi file plan này được ghi với `Status: Ready for Review`, repo vào trạng thái code freeze cho tới khi Reviewer cấp `[PLAN_APPROVED]`.
- **A9 `[CMD]`**: Không có file `.tsx` nào trong `src/` chứa directive `"use server"` (server action duy nhất là `src/app/auth/signin/actions.ts`). Hiện có 24 file `*.test.tsx`/`*.server.tsx` trong `src/app`.
- **A10 `[ADV]`**: Antigravity nhận diện skill qua `.agents/skills/<name>/SKILL.md` có frontmatter `name` + `description`. Brief nêu điều này, và 3 skill đang track (`emil-design-eng`, …) đã dùng định dạng này. Plan không tra cứu online. Reviewer nên kiểm chứng nếu cần.
- **A11 `[ADV]`**: Plugin `superpowers` nằm ở môi trường agent, không ở repo (`grep -rn superpowers .agents` cho kết quả rỗng).
- **A12 `[CMD]`**: Baseline `node scripts/verify-docs.mjs`: `[1/5]`–`[4/5]` PASS, `[5/5]` FAIL (CHANGELOG size, có từ trước).

**Cross-Task Dependencies:**

- Bước 2 (migrate skill) phải xong trước Bước 4 (cập nhật đường dẫn). Nếu làm ngược, link checker `verify-docs.mjs [1/5]` sẽ fail giữa chừng.
- Bước 6 (guard + test) độc lập với Bước 1–5 và có thể làm song song.
- Toàn bộ `.agents/**` bị guard luôn `ask` (`isGovernanceFile`), nên mỗi lần ghi user phải xác nhận. Đây là hành vi đúng, không phải lỗi.

**`[NEEDS_PRODUCT_DECISION]` (đã chọn Default Assumption để chuỗi không nghẽn):**

- **D1 – `.gitignore`**: Default là **sửa** để whitelist skill do Vikini sở hữu (xem Bước 1.4). Phương án khác: giữ nguyên, khi đó user tự `git add -f`, dễ sót.
- **D2 – Fast-Track content hardening**: Default là **bật** thêm điều kiện (d): từ chối nếu `newContent` khớp `/["']use server["']|\bprocess\.env\b|\.server["']/`. Đây là điều kiện chặt hơn brief và không làm hỏng test case nào của brief. Lý do: `.tsx` trong `src/app/` có thể là Server Component. Một micro-edit 40 dòng không được phép đưa vào server action, đọc secret từ env, hay import module `*.server`. Phương án khác: bỏ (d) để khớp brief 1:1.
- **D3 – `add-model.md`**: Default là **giữ nguyên vị trí** (Out of Scope). Phương án khác: migrate thành `add-model/SKILL.md` với `description: "MANDATORY when adding or modifying an AI model in modelRegistry.ts or a provider client in src/lib/core/."`.
- **D4 – `skills-lock.json`**: Default là **xóa** 2 entry `design-taste-frontend` và `redesign-existing-projects`, để lock khớp thực tế.

### 4. Bảng Verified Versions (từ `package.json` thực tế)

| Package                                 | Version (`package.json`) | Liên quan task                                            |
| --------------------------------------- | ------------------------ | --------------------------------------------------------- |
| `next`                                  | `^16.4.0`                | Không (chỉ bối cảnh regex `src/app/`)                     |
| `react` / `react-dom`                   | `^19.2.3`                | Không                                                     |
| `typescript`                            | `^5.9.3`                 | Có: `tsc --noEmit` type-check JSDoc của guard (`allowJs`) |
| `vitest`                                | `^4.1.11`                | Có: chạy `code-freeze-guard.test.ts`                      |
| `happy-dom`                             | `^20.0.11`               | Gián tiếp (environment Vitest)                            |
| `eslint`                                | `^9.39.2`                | Gián tiếp (`.agents/**` bị ignore)                        |
| `prettier`                              | `^3.7.4`                 | Gián tiếp (lint-staged lúc commit)                        |
| `tailwindcss`                           | `^4.1.18`                | Không                                                     |
| `framer-motion`                         | `^12.23.26`              | Không                                                     |
| `@supabase/supabase-js`                 | `^2.89.0`                | Không                                                     |
| `next-auth`                             | `^5.0.0-beta.32`         | Không                                                     |
| `@upstash/redis`                        | `^1.36.0`                | Không                                                     |
| `@google/genai`                         | `^2.10.0`                | Không                                                     |
| `@anthropic-ai/sdk`                     | `^0.71.2`                | Không                                                     |
| `zod`                                   | `^4.2.1`                 | Không                                                     |
| Node built-ins (`node:fs`, `node:path`) | runtime                  | Có: guard (không thêm import mới)                         |

Task không thêm dependency và không dùng API thư viện mới. Hàm mới chỉ dùng `String.prototype.split`, `RegExp.test` và `Array.some`.

### 5. Danh Sách Files

#### `[DELETE]`

| Đường dẫn                                    | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/design-taste-frontend`       | Junction, gỡ bằng `cmd /c rmdir` (không `-Recurse`)                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.claude/skills/redesign-existing-projects`  | Junction, như trên                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `.agents/skills/redesign-existing-projects/` | 1 file: `SKILL.md` (đang tracked, sẽ hiện là deletion khi user commit)                                                                                                                                                                                                                                                                                                                                                                                           |
| `.agents/skills/design-taste-frontend/`      | 1 file: `SKILL.md` (untracked)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `.agents/skills/ux-ui-agent-skills/`         | Toàn bộ cây: `.claude/` (commands, `settings.json`, 18 sub-skill `SKILL.md`), `.git/`, `.github/workflows/`, `accessibility/`, `bin/`, `components/`, `content/`, `design-systems/` (crosswalk, interop, `library/*/DESIGN.md` ~140 thư mục), `docs/`, `examples/`, `frameworks/`, `reference/`, `scripts/`, `taste/`, `tokens/`, `workflows/`, cùng `CLAUDE.md`, `CONTEXT.md`, `README.md`, `SKILL.md`, `cover.html`, `package.json`, `.gitignore`, `.mcp.json` |
| `.agents/skills/api-patterns.md`             | Sau khi đã tạo `api-patterns/SKILL.md`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `.agents/skills/streaming-patterns.md`       | Như trên                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `.agents/skills/database-migration.md`       | Như trên                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `.agents/skills/add-feature.md`              | Như trên                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `.agents/skills/add-translation.md`          | Như trên                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### `[NEW]`

| Đường dẫn                                    | Ghi chú                                            |
| -------------------------------------------- | -------------------------------------------------- |
| `.agents/skills/api-patterns/SKILL.md`       | Body = `api-patterns.md` dòng 4–103                |
| `.agents/skills/streaming-patterns/SKILL.md` | Body = `streaming-patterns.md` dòng 4–116          |
| `.agents/skills/database-migration/SKILL.md` | Body = `database-migration.md` dòng 4–92           |
| `.agents/skills/add-feature/SKILL.md`        | Body = `add-feature.md` dòng 4–90, sửa 3 đường dẫn |
| `.agents/skills/add-translation/SKILL.md`    | Body = `add-translation.md` dòng 4–76              |
| `.agents/skills/vikini-investigate/SKILL.md` | Mới, ≤ 150 dòng                                    |
| `.agents/skills/vikini-simplify/SKILL.md`    | Mới, ≤ 150 dòng                                    |

#### `[MODIFY]`

`.gitignore`, `skills-lock.json`, `.agents/skills/README.md`, `.agents/skills/add-model.md`, `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`, `.agents/rules/03-ui.md`, `.agents/rules/04-bilingual.md`, `.agents/rules/05-plan-review.md`, `.agents/workflows/audit.md`, `.agents/agents/planner/agent.md`, `.agents/agents/reviewer/agent.md`, `.agents/agents/reviewer/mental-simulation.md`, `.agents/scripts/claude-reviewer-prompt.md`, `.agents/scripts/code-freeze-guard.js`, `.agents/scripts/code-freeze-guard.test.ts`, `docs/CHANGELOG.md`.

### 6. Caller-First Design Sketch (`code-freeze-guard.js`)

**6.1 Phía gọi: `decide()` sau khi chèn (thứ tự gate cuối cùng):**

```js
// ... 1. external  2. prohibited  3. unfrozen docs/  3b. TEST_INFRA_FILES
// ... 4. isTestFile  5. isSensitiveServerFile  6. isMigrationFile  7. isGovernanceFile

// 8. Fast-Track Mode: micro UI / translation / styling edits (05-plan-review.md §1.1)
if (isFastTrackEligible(relative, input)) {
  return { decision: "allow", reason: FAST_TRACK_REASON };
}

// 9. General application / UI files: Scoped Protection (unchanged)
const planApproved = options.planApproved !== undefined ? options.planApproved : isPlanApproved();
```

- Fast-Track chạy **trước** `isPlanApproved()`. Khi eligible, guard không đọc đĩa. Khi `planApproved: true`, kết quả vẫn là `allow` như trước, nên không có hồi quy.
- `FAST_TRACK_REASON = "Fast-Track Mode: micro-edit (<= 40 lines) on UI/translation/styling surface."`. `GuardDecision.reason` vốn là optional nên không đổi typedef. Test assert `reason` để chứng minh nhánh Fast-Track đã chạy (khác nhánh `planApproved`).
- Đánh lại số comment `// 8.` → `// 9.` cho khối Scoped Protection. Sửa comment trùng `// 3.` (dòng 423) thành `// 3b.` nếu đang sửa vùng đó. Không reformat gì khác (Minimal Diffs).

**6.2 Phía test: cách gọi kỳ vọng:**

```ts
const edit = (targetFile: string, lines = 5, toolName = "replace_file_content") => ({
  toolName,
  targetFile,
  oldContent: makeLines(lines),
  newContent: makeLines(lines),
});
expect(decide(edit("src/lib/utils/translations/vi.ts"), { planApproved: false }).decision).toBe(
  "allow"
);
expect(isFastTrackEligible("src/app/api/x/page.tsx", edit("src/app/api/x/page.tsx"))).toBe(false);
```

`makeLines(n) = Array.from({ length: n }, (_, i) => \`line ${i}\`).join("\n")`, nên `countLines(makeLines(n)) === n`.

**6.3 Phía định nghĩa (đặt ngay trước `decide()`, sau `assessTestIntegrity`):**

```js
/** Maximum lines on either side of a Fast-Track edit. */
export const FAST_TRACK_MAX_LINES = 40;

/** Pure UI / translation / styling surfaces eligible for Fast-Track Mode. */
const FAST_TRACK_PATHS = [
  /^src\/lib\/utils\/translations\/(?:vi|en)\.ts$/,
  /^src\/app\/styles\/.+\.css$/,
  /^src\/(?:app\/(?!api\/)|components\/).+\.tsx$/,
];

/** Defence in depth: test/spec/server components are blocked by earlier gates too. */
const FAST_TRACK_EXCLUDED_PATHS = /\.(?:test|spec|server)\.tsx$/;

/** Content that must never ride the Fast-Track lane (D2). */
const FAST_TRACK_FORBIDDEN_CONTENT = /["']use server["']|\bprocess\.env\b|\.server["']/;

/**
 * Counts lines the way editors do for a replacement chunk.
 * @param {string} value
 * @returns {number}
 */
export function countLines(value) {
  return value.split(/\r?\n/).length;
}

/**
 * Fast-Track Mode: a small replace_file_content edit on a pure UI surface may
 * proceed without [PLAN_APPROVED]. Must run AFTER every Scoped Protection gate.
 * @param {string} relative repo-relative POSIX path
 * @param {GuardInput} input
 * @returns {boolean}
 */
export function isFastTrackEligible(relative, input) {
  if (input.toolName !== "replace_file_content") return false;
  if (FAST_TRACK_EXCLUDED_PATHS.test(relative)) return false;
  if (!FAST_TRACK_PATHS.some((pattern) => pattern.test(relative))) return false;
  const { oldContent, newContent } = input;
  if (typeof oldContent !== "string" || typeof newContent !== "string") return false;
  if (oldContent === "" || newContent === "") return false;
  if (countLines(oldContent) > FAST_TRACK_MAX_LINES) return false;
  if (countLines(newContent) > FAST_TRACK_MAX_LINES) return false;
  return !FAST_TRACK_FORBIDDEN_CONTENT.test(newContent);
}
```

- So sánh `toolName` bằng `===` tuyệt đối. Các tên như `multi_replace_file_content` hay `Edit` không eligible.
- Cập nhật JSDoc header của file (dòng 5–13): thêm 1 bullet `ALLOW Fast-Track micro-edits (replace_file_content, <= 40 lines) on UI/translation/styling surfaces without an approved plan.`

### 7. Các Bước Thực Hiện Tuần Tự

> Mọi ghi vào `.agents/**`, `.gitignore`, `skills-lock.json` đều qua guard và sẽ `ask` user. Chạy `npm run type-check` (Tier 1) sau mỗi bước có chạm `.js`/`.ts`.

**Bước 1 – Dọn skill ngoại lai**

- [ ] 1.1 Gỡ junction (PowerShell 5.1, mỗi lệnh riêng): `cmd /c rmdir .claude\skills\design-taste-frontend` rồi `cmd /c rmdir .claude\skills\redesign-existing-projects`. Kiểm tra: `Test-Path .agents/skills/design-taste-frontend/SKILL.md` vẫn là `True`, tức đích chưa bị xóa.
- [ ] 1.2 `Remove-Item -Recurse -Force .agents/skills/redesign-existing-projects`, `.agents/skills/design-taste-frontend`, `.agents/skills/ux-ui-agent-skills` (3 lệnh riêng).
- [ ] 1.3 `skills-lock.json`: xóa 2 object `"design-taste-frontend"` và `"redesign-existing-projects"`, giữ đúng JSON hợp lệ (3 entry còn lại: `animation-vocabulary`, `emil-design-eng`, `review-animations`).
- [ ] 1.4 `.gitignore` dòng 38–42 (D1), thay `.agents/skills` bằng:
  ```gitignore
  # Agent Skills (third-party installs ignored; Vikini-owned skills tracked)
  .agents/skill
  .agents/skills/*
  !.agents/skills/README.md
  !.agents/skills/add-model.md
  !.agents/skills/api-patterns/
  !.agents/skills/streaming-patterns/
  !.agents/skills/database-migration/
  !.agents/skills/add-feature/
  !.agents/skills/add-translation/
  !.agents/skills/vikini-investigate/
  !.agents/skills/vikini-simplify/
  .claude/skill
  .claude/skills
  ```
  Phải dùng `.agents/skills/*` (không phải `.agents/skills`), vì git không thể un-ignore file con khi thư mục cha bị ignore.

**Bước 2 – Migrate 5 skill nội bộ**

- [ ] 2.1 Với mỗi skill, tạo `.agents/skills/<name>/SKILL.md` = frontmatter mới + body cũ **nguyên văn** (từ dòng 4, tức sau `---` đóng frontmatter cũ, tới hết file). Frontmatter đúng như sau (giá trị `description` đặt trong nháy kép):

  | name                 | description                                                                                                                                                           |
  | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `api-patterns`       | `"MANDATORY when creating or modifying any Next.js API route in src/app/api/**. Contains required AppError classes, response helpers, and auth validation patterns."` |
  | `streaming-patterns` | `"MANDATORY when modifying SSE chat streaming logic, ReadableStream, event types, or useChatStreamController."`                                                       |
  | `database-migration` | `"MANDATORY when adding or modifying Supabase database tables, columns, indexes, SQL migrations, or RLS policies."`                                                   |
  | `add-feature`        | `"MANDATORY when scaffolding a completely new feature end-to-end across src/lib/features/, src/app/features/, and src/app/api/."`                                     |
  | `add-translation`    | `"MANDATORY when adding or modifying any user-visible UI text in src/lib/utils/translations/ (vi.ts and en.ts)."`                                                     |

  Mẫu:

  ```yaml
  ---
  name: api-patterns
  description: "MANDATORY when creating or modifying any Next.js API route in src/app/api/**. Contains required AppError classes, response helpers, and auth validation patterns."
  ---
  ```

- [ ] 2.2 Trong `add-feature/SKILL.md`, đổi 3 tham chiếu (gốc ở dòng 32, 70, 79): `.agents/skills/api-patterns.md` → `.agents/skills/api-patterns/SKILL.md`; `.agents/skills/add-translation.md` → `.agents/skills/add-translation/SKILL.md`; `.agents/skills/database-migration.md` → `.agents/skills/database-migration/SKILL.md`.
- [ ] 2.3 Kiểm tra body giữ nguyên: số dòng mỗi `SKILL.md` = số dòng file cũ + 1 (frontmatter cũ có 1 dòng `description`, mới có 2 dòng `name` + `description`). Mục tiêu: api-patterns 104, streaming-patterns 117, database-migration 93, add-feature 91, add-translation 77.
- [ ] 2.4 Xóa 5 file `.md` cũ (`Remove-Item .agents/skills/api-patterns.md`, v.v.).

**Bước 3 – Tạo 2 skill mới (mỗi file ≤ 150 dòng)**

- [ ] 3.1 `.agents/skills/vikini-investigate/SKILL.md`:
  ```yaml
  ---
  name: vikini-investigate
  description: "MANDATORY when answering read-only architecture questions (/how, /why), recovering session context (/recall), or analyzing blast-radius before modifying shared modules in src/lib/core/ or src/lib/features/."
  ---
  ```
  Cấu trúc bắt buộc:
  - `# Vikini Investigate (Read-Only)`, kèm câu hard rule: không ghi file, không chạy lệnh mutating; chỉ dùng `view_file`/`grep_search`/`list_dir` và lệnh trong `.agents/agents/reviewer/allowlist.md` (`git status|diff|log|show|blame` khớp `READ_ONLY_COMMANDS` của guard).
  - `## Mode 1: /how — Runtime & Architecture Trace`: entry point (UI component / `src/app/api/**/route.ts`), qua `src/lib/features/**`, tới `src/lib/core/**` (Supabase/Redis/AI client). Output bắt buộc: call chain có `file:line`, data shape ở mỗi ranh giới, ai sở hữu state (Zustand / SWR / server), sharp edges. Hệ thống lớn: chia 2–3 subagent `research` đọc song song theo layer rồi gộp thành một mental model.
  - `## Mode 2: /why — Historical & Intent Evidence`: `git log --oneline -n 20 -- <path>`, `git blame -L <a>,<b> <path>`, `git show <sha>`; đối chiếu `docs/plans/`, `docs/lessons-learned.md`, `docs/CHANGELOG.md`. Output tách 2 cột **Fact** (có `[CMD]`/`[SRC]`) và **Inference**. Kết luận phải thuộc một trong: Intentional design / Regression / Unknown.
  - `## Mode 3: /recall — Context Recovery`: đọc plan mới nhất trong `docs/plans/` (theo mtime), mục mới nhất của `docs/CHANGELOG.md`, `git status`, `git log --oneline -n 5`. Output 3 mục: Đã xong / Đang dở / Bước tiếp theo, kèm trạng thái `Status:` và có hay không `[PLAN_APPROVED]` của plan.
  - `## Mode 4: /blast-radius — Impact Analysis`: trước khi sửa export dùng chung trong `src/lib/core/` hoặc `src/lib/features/`, `grep_search` mọi import/call site (tên symbol + đường dẫn module, cả alias `@/lib/...`), lập bảng `Caller | file:line | Dùng thế nào | Tương thích? (Yes/No + lý do)`, liệt kê test co-located bị ảnh hưởng. Có caller `No` thì plan phải có bước migrate caller đó.
  - `## Output Contract` (chung 4 mode) và `## Anti-Patterns` (đoán khi không có evidence; đọc lặp cùng một vùng file; dump log không giới hạn).
- [ ] 3.2 `.agents/skills/vikini-simplify/SKILL.md`:
  ```yaml
  ---
  name: vikini-simplify
  description: "MANDATORY when asked to simplify code, clean up dead code, or reduce complexity (/simplify) without changing runtime behavior. Deletions and flattening only."
  ---
  ```
  Cấu trúc bắt buộc:
  - `## Principles`: _Subtract Before You Add_, _Laziness Protocol_ (cách đúng nào ít code nhất thì chọn cách đó; không thêm abstraction), behavior-preserving tuyệt đối.
  - `## Allowed Operations` (chỉ 4 loại): xóa dead code (export/import/biến/nhánh không được tham chiếu, chứng minh bằng `grep_search`); inline wrapper chỉ có 1 caller; gỡ state/props dư thừa (derived state → tính trực tiếp, prop không dùng); làm phẳng điều kiện lồng nhau (early return / guard clause).
  - `## Forbidden`: thêm tính năng, đổi public API/signature export mà không có `/blast-radius` (`vikini-investigate`), đổi output UI/text, sửa test để "cho xanh" (theo Test Failure Triage, `02-quality.md`), reformat ngoài vùng sửa.
  - `## Procedure`: (1) `npm run verify` baseline, ghi kết quả; (2) với mỗi đề xuất xóa, có bằng chứng grep 0 tham chiếu; (3) sửa; (4) `npm run type-check` sau mỗi file; (5) `npm run verify` sau cùng và so với baseline (số test pass không giảm); (6) báo cáo bảng `File | Thao tác | Dòng trước → sau | Evidence`.
  - `## Governance`: simplify vẫn là thay đổi `src/**`, nên vẫn chịu code freeze `05-plan-review.md`. Chỉ edit thỏa Fast-Track mới không cần plan.
- [ ] 3.3 Đo số dòng: `(Get-Content .agents/skills/vikini-investigate/SKILL.md).Count` và tương tự cho simplify, phải ≤ 150.

**Bước 4 – Cập nhật đường dẫn tham chiếu**

- [ ] 4.1 `.agents/rules/01-coding.md:44`: `.agents/skills/api-patterns.md` → `.agents/skills/api-patterns/SKILL.md`.
- [ ] 4.2 `.agents/rules/04-bilingual.md:55`: `.agents/skills/add-translation.md` → `.agents/skills/add-translation/SKILL.md`.
- [ ] 4.3 `.agents/workflows/audit.md:21`: `.agents/skills/api-patterns.md` → `.agents/skills/api-patterns/SKILL.md`.
- [ ] 4.4 `.agents/agents/reviewer/mental-simulation.md` dòng 16 (`streaming-patterns`), 23 (`database-migration`), 37 (`api-patterns`): đổi sang `.agents/skills/<name>/SKILL.md`.
- [ ] 4.5 `.agents/skills/add-model.md:46`: `.agents/skills/add-translation.md` → `.agents/skills/add-translation/SKILL.md`.
- [ ] 4.6 `.agents/rules/02-quality.md` dòng 93–95: đổi 3 đường dẫn sang `/SKILL.md` (bảng dòng 12–27 xử lý ở Bước 5.2).
- [ ] 4.7 `.agents/skills/README.md`: viết lại
  - §A: 5 link thành `./<name>/SKILL.md`; giữ `add-model.md`.
  - §B: xóa dòng `design-taste-frontend` và `redesign-existing-projects`; giữ `animation-vocabulary`, `emil-design-eng`, `review-animations`.
  - §C (`ux-ui-agent-skills`): xóa toàn bộ, thay bằng **§C. Nhóm Vikini Workflow Skills**: `vikini-investigate`, `vikini-simplify`.
  - Câu "3 phân nhóm" giữ nguyên số lượng (A/B/C).
  - Bảng routing §2: cập nhật 4 link, thêm 3 dòng: **Câu hỏi kiến trúc / lịch sử / khôi phục ngữ cảnh** → `vikini-investigate`; **Sửa module dùng chung `src/lib/core/`, `src/lib/features/`** → `vikini-investigate` (`/blast-radius`); **Rút gọn / dọn dead code** → `vikini-simplify`.
  - Thêm 1 dòng ở đầu §2: "Thứ tự ưu tiên: Vikini-First, Superpowers-Complementary (xem `.agents/rules/02-quality.md`)."
- [ ] 4.8 Negative grep phải ra 0 kết quả (ngoài `docs/plans/`, `docs/archive/`, `docs/CHANGELOG.md`): regex `\.agents/skills/(api-patterns|streaming-patterns|database-migration|add-feature|add-translation)\.md` và `design-taste-frontend|redesign-existing-projects|ux-ui-agent-skills` trên `.agents/`, `docs/`, `scripts/`, `skills-lock.json`. Ngoại lệ được ghi nhận: `scripts/verify-docs.mjs:155` còn chuỗi `ux-ui-agent-skills` (điều kiện loại trừ trở thành no-op và vô hại; theo Out of Scope không sửa script).

**Bước 5 – Governance: 4 tầng bảo đảm + AAS**

- [ ] 5.1 `.agents/rules/00-core.md`: thêm section `## Token Efficiency (tokenleak discipline)` sau `## Non-Negotiables` (khoảng ≤ 700 ký tự):
  - Dùng `grep_search` xác định dòng trước, rồi `view_file` với `StartLine`/`EndLine` cho file > 400 dòng.
  - Không đọc lại cùng một vùng file trong một phiên nếu file chưa đổi.
  - Giới hạn output lệnh/log (ví dụ `--reporter=dot`, scope test theo đường dẫn, `git log -n <N>`); không dump toàn bộ log.
  - Ưu tiên một subagent đọc rộng thay vì nhiều lượt đọc tuần tự trên luồng chính.
- [ ] 5.2 `.agents/rules/02-quality.md`:
  - Bảng Pre-Work (dòng 12–27): đổi cột "Read first" của Chat/Streaming, Database, API routes, Adding a new feature sang `.agents/skills/<name>/SKILL.md`. Thêm các dòng: `UI text / Translations | .agents/skills/add-translation/SKILL.md, .agents/rules/04-bilingual.md`; `Architecture question / context recovery | .agents/skills/vikini-investigate/SKILL.md`; `Shared module change (lib/core, lib/features) | .agents/skills/vikini-investigate/SKILL.md (/blast-radius)`; `Simplify / dead code cleanup | .agents/skills/vikini-simplify/SKILL.md`. Đổi heading thành `## Pre-Work Protocol (MANDATORY Skill Triggers)`. Giữ căn cột markdown theo prettier.
  - Thêm section `## Skill Precedence Hierarchy (Vikini-First, Superpowers-Complementary)` ngay sau block `<important>` của Pre-Work (khoảng ≤ 1,000 ký tự):
    - **Tầng 1 (Primary / Mandatory)**: `.agents/rules/`, `.agents/workflows/`, chuỗi `@planner` → Reviewer → `@qa`, và `.agents/skills/*/SKILL.md`. Luôn nạp trước.
    - **Tầng 2 (Secondary / Complementary)**: sau Tầng 1, agent mới tự cân nhắc skill `superpowers` (`brainstorming`, `test-driven-development`, `systematic-debugging`…). Khi xung đột, Tầng 1 thắng.
    - `<important>`: skill `superpowers` (`using-git-worktrees`, `writing-plans`, `finishing-a-development-branch`…) KHÔNG được ghi đè luật cấm git tự động (`00-core.md`) hay quy trình duyệt plan (`05-plan-review.md`). `writing-plans` chỉ được dùng để hỗ trợ trình bày plan theo đúng format `@planner`.
  - Ngân sách sau sửa: ≤ 11,500 ký tự.
- [ ] 5.3 `.agents/rules/03-ui.md`: thêm section `## 4 UI States (MANDATORY)` sau `## Component Usage` (khoảng ≤ 800 ký tự). Mọi màn hình/component có tải hoặc mutate dữ liệu phải xử lý đủ:
  - _Loading_: `Skeleton` (`components/ui/skeleton.tsx`).
  - _Empty_: empty state có hướng dẫn hành động kế tiếp và text qua `t("key")`; ví dụ có sẵn `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx`.
  - _Error_: `toast.error()` (`lib/store/toastStore.ts`) hoặc inline message rõ ràng; không nuốt lỗi.
  - _Success_: phản hồi thị giác hoặc toast.
- [ ] 5.4 `.agents/agents/planner/agent.md` (mục tiêu ≤ 9,500 ký tự):
  - Danh sách "mục BẮT BUỘC" (dòng 28–41) đổi thành 10 mục, khớp format plan này: 1 Goal **& Out of Scope (What We're NOT Doing)**; 2 Pre-Work Reading **& Skills Loaded & Applied** (bảng: `SKILL.md` đã đọc bằng `view_file` trong phiên → quyết định kỹ thuật chịu ảnh hưởng; chạm domain có skill bắt buộc mà không trích dẫn thì Reviewer đánh `[MAJOR]`); 3 Assumptions; 4 Verified Versions; 5 Files; 6 **Caller-First Design Sketch** (phác thảo call site / interface trước khi định nghĩa bên trong); 7 Checklist; 8 Test Contract; 9 Co-Located Tests & Verification; 10 Risks.
  - Thêm section `## 8 Nguyên Lý Kỹ Thuật Cốt Lõi (pstack)`, mỗi nguyên lý 1 dòng ≤ 120 ký tự: _Subtract Before You Add_, _Model the Domain_, _Boundary Discipline_, _Type System Discipline_, _Make Operations Idempotent_, _Prove It Works_, _Fix Root Causes_, _Minimize Reader Load_.
- [ ] 5.5 `.agents/agents/reviewer/agent.md` (**bắt buộc ≤ 9,500 ký tự**, hiện 8,559):
  - Bước 2: đổi "đủ 5 phần" thành "đủ 7 phần", thêm `6. Out of Scope (What We're NOT Doing)` và `7. Skills Loaded & Applied`, kèm luật: nếu plan chạm API route / SSE streaming / DB migration / UI translation / shared module `lib/core`/`lib/features` mà không nạp và trích dẫn `SKILL.md` tương ứng thì `[MAJOR]` và `[CHANGES_REQUESTED]`.
  - Bước 6: thêm mục tùy chọn `8. Dismissed Findings (Noise Filtered)`: các nghi vấn đã kiểm và loại bỏ, kèm lý do và evidence.
  - Cô đọng bù ký tự (tiết kiệm ≥ 600 ký tự):
    - (a) Bước 5: thay 3 bullet Severity Rubric (dòng 86–88) bằng 1 dòng tham chiếu `.agents/rules/05-plan-review.md` §4. Rubric đã có nguyên văn ở đó.
    - (b) `## Cơ Chế Phân Công Reviewer` (dòng 108–112): rút còn 2 bullet, giữ nguyên yêu cầu nhãn `[REVIEWER_MODEL: gemini-4-argon]`.
    - (c) Bước 3: gộp danh sách thư viện thành "các thư viện trong bảng Verified Versions của plan".
  - Không được xóa: Nguyên Tắc Thẩm Định Độc Lập, Luật Bằng Chứng Bổ Sung, Quy Tắc Cấp Thẻ Phê Duyệt, STRICT CONSTRAINTS.
- [ ] 5.6 `.agents/scripts/claude-reviewer-prompt.md`: ở mục 2.4, thêm bullet **Plan Completeness Gate**: kiểm `Out of Scope` + `Skills Loaded & Applied` (cùng luật `[MAJOR]` như 5.5) và bullet tùy chọn **Dismissed Findings (Noise Filtered)**. Ở mục `[MAJOR]` (dòng 33), thêm "thiếu Out of Scope / Skills Loaded & Applied".
- [ ] 5.7 `.agents/rules/05-plan-review.md`: thêm `### 1.1 Fast-Track Mode (Micro-UI & Translation Edits)` ngay sau danh sách §1 (khoảng ≤ 1,600 ký tự):
  - Điều kiện (khớp 1:1 `isFastTrackEligible`): (a) tool `replace_file_content` (`write_to_file` luôn cần plan); (b) đường dẫn khớp một trong `src/lib/utils/translations/{vi,en}.ts`, `src/app/styles/**/*.css`, `src/app/**/*.tsx` (trừ `src/app/api/`) hoặc `src/components/**/*.tsx`, và không phải `*.test|spec|server.tsx`; (c) `TargetContent` và `ReplacementContent` đều không rỗng, mỗi bên ≤ 40 dòng (tính tổng mọi chunk của một lần gọi); (d) nội dung mới không chứa `"use server"`, `process.env`, hay import `*.server`.
  - Mọi file trong §1.3 (file nhạy cảm) vẫn luôn `ask`, vì Fast-Track chạy sau các chốt đó.
  - Nghĩa vụ của agent: (1) `view_file` `SKILL.md` liên quan (ví dụ `.agents/skills/add-translation/SKILL.md` khi sửa `vi.ts`/`en.ts`); (2) dòng đầu phản hồi: `📌 [Fast-Track | Skills: <tên-skill>]`; (3) `npm run type-check` ngay sau khi sửa; (4) chỉ dùng cho một thay đổi vi mô, độc lập và đúng yêu cầu user. Cấm chia nhỏ một tính năng thành nhiều lần gọi ≤ 40 dòng để lách plan. `@qa`/Reviewer coi đó là vi phạm `[BLOCKER]`.
  - Đồng thời thêm ở §1 Scoped Protection bullet 1: "…bị hook chặn lại và hỏi người dùng (`ask`), **trừ Fast-Track §1.1**".

**Bước 6 – Guard & Tests**

- [ ] 6.1 `.agents/scripts/code-freeze-guard.js`: thêm hằng số, `countLines` và `isFastTrackEligible` đúng §6.3 (đặt sau `assessTestIntegrity`, khoảng dòng 378). Chèn gate §6.1 vào `decide()` giữa khối `isGovernanceFile` (dòng 476–484) và khối `planApproved` (dòng 486–491). Cập nhật JSDoc header.
- [ ] 6.2 `.agents/scripts/code-freeze-guard.test.ts`: thêm `countLines`, `isFastTrackEligible`, `FAST_TRACK_MAX_LINES` vào import (dòng 3–13). Thêm 3 `describe` mới ở cuối file: `"countLines"`, `"isFastTrackEligible"`, `"decide — Fast-Track Mode"`, theo Test Contract §8. **Không sửa hay xóa test hiện có** (Loại C chỉ thêm mới).
- [ ] 6.3 `npx vitest run .agents/scripts/code-freeze-guard.test.ts`, rồi `npm run type-check`.

**Bước 7 – Living docs & Verify**

- [ ] 7.1 `docs/CHANGELOG.md`: thêm entry đầu file `## 2026-10-19: Governance -- Vikini Skills Standardization (SKILL.md), pstack/fstack/AAS Curation & Fast-Track Mode`, liệt kê 5 hạng mục và file chính.
- [ ] 7.2 Chạy toàn bộ Verification Plan §9.

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Ký hiệu: `L(n)` = `makeLines(n)`, chuỗi gồm đúng `n` dòng nối bằng `"\n"`. `R` = `"replace_file_content"`, `W` = `"write_to_file"`. Mọi case `decide()` truyền `{ planApproved: false }` trừ khi ghi khác.

#### 8.1 `countLines`

| ID    | Input                      | Expected                                 |
| ----- | -------------------------- | ---------------------------------------- |
| FT-C1 | `"a"`                      | `1`                                      |
| FT-C2 | `L(40)`                    | `40`                                     |
| FT-C3 | `"a\r\nb\r\nc"` (CRLF)     | `3`                                      |
| FT-C4 | `"a\n"` (trailing newline) | `2` (bảo thủ: dòng trống cuối được tính) |

#### 8.2 `isFastTrackEligible` / `decide()`: Happy paths (`allow`, `reason` chứa `"Fast-Track Mode"`)

| ID    | targetFile                                                                                                                                                                | tool | old / new                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| FT-H1 | `src/lib/utils/translations/vi.ts`                                                                                                                                        | R    | `L(5)` / `L(5)`                                  |
| FT-H2 | `src/lib/utils/translations/en.ts`                                                                                                                                        | R    | `L(5)` / `L(5)`                                  |
| FT-H3 | `src/app/styles/themes/focus/amber.css` (file có thật; brief ghi `themes/focus.css` nhưng `focus/` là thư mục)                                                            | R    | `L(5)` / `L(5)`                                  |
| FT-H4 | `src/app/features/chat/components/ChatBubble.tsx`                                                                                                                         | R    | `L(40)` / `L(40)` (**biên trên**)                |
| FT-H5 | `src/components/ui/button.tsx`                                                                                                                                            | R    | `L(1)` / `L(3)`                                  |
| FT-H6 | Windows path `src\\app\\features\\chat\\components\\ChatBubble.tsx`                                                                                                       | R    | `L(5)` / `L(5)` (chuẩn hóa qua `toRepoRelative`) |
| FT-H7 | Payload thật qua `decide(extractInput({ toolCall: { name: "replace_file_content", args: { TargetFile, ReplacementChunks: [2 chunk × L(20)] } } }))` trên `ChatBubble.tsx` | R    | tổng 40 dòng mỗi bên, nên `allow`                |

#### 8.3 Negative paths (`ask`; khi `isFastTrackEligible` được gọi trực tiếp thì `false`)

| ID          | Kịch bản                                                                                                                                              | Expected `reason` chứa                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| FT-N1       | `W` trên 4 file của FT-H1/H3/H4/H5, `L(5)`                                                                                                            | `"write targets a frozen path"`         |
| FT-N2       | `toolName` undefined trên `ChatBubble.tsx`                                                                                                            | `"write targets a frozen path"`         |
| FT-N3       | `toolName: "multi_replace_file_content"`                                                                                                              | `"write targets a frozen path"`         |
| FT-N4       | `ChatBubble.tsx`, old `L(41)` / new `L(5)` (**biên 41**)                                                                                              | `"write targets a frozen path"`         |
| FT-N5       | `ChatBubble.tsx`, old `L(5)` / new `L(41)`                                                                                                            | như trên                                |
| FT-N6       | FT-H7 với 2 chunk × `L(21)` (tổng 42)                                                                                                                 | như trên                                |
| FT-N7       | `oldContent` undefined; riêng case `newContent` undefined; riêng case `oldContent: ""`                                                                | như trên                                |
| FT-N8       | `src/app/api/chat-stream/route.ts` (file có thật, `.ts`)                                                                                              | `"write targets a frozen path"`         |
| FT-N9       | `src/app/api/foo/page.tsx` (tổng hợp, kiểm `(?!api\/)`)                                                                                               | như trên                                |
| FT-N10      | `src/lib/features/chat/conversations.ts` và `src/lib/core/genaiClient.ts` (file có thật; brief ghi `chat/service.ts`, `core/gemini.ts` không tồn tại) | như trên                                |
| FT-N11      | `src/lib/core/supabase.server.ts` và `src/app/features/x/Panel.server.tsx`                                                                            | `"sensitive server file (*.server.ts)"` |
| FT-N12      | `src/app/features/chat/components/ChatBubble.test.tsx` (`L(5)`/`L(5)`)                                                                                | `"Test Integrity Guard"`                |
| FT-N13      | `.agents/rules/00-core.md`                                                                                                                            | `"governance file in .agents/"`         |
| FT-N14      | `src/app/../lib/core/x.tsx` (traversal, chuẩn hóa thành `src/lib/core/x.tsx`)                                                                         | `"write targets a frozen path"`         |
| FT-N15      | `src/lib/utils/translations/index.ts` (cùng thư mục nhưng không phải `vi`/`en`)                                                                       | như trên                                |
| FT-N16      | `src/app/globals.css` (ngoài `src/app/styles/`)                                                                                                       | như trên                                |
| FT-N17 (D2) | `ChatBubble.tsx`, new chứa `"use server";` / `process.env.SECRET` / `import x from "@/lib/core/supabase.server"` (3 case)                             | như trên                                |
| FT-N18      | `isFastTrackEligible("src/app/features/x/A.test.tsx", R + L(5))` gọi trực tiếp                                                                        | `false` (exclusion phòng thủ)           |

#### 8.4 Regression (không đổi hành vi cũ)

| ID    | Kịch bản                                                                  | Expected                                 |
| ----- | ------------------------------------------------------------------------- | ---------------------------------------- |
| FT-R1 | 66 test hiện có                                                           | Tất cả pass, không sửa                   |
| FT-R2 | `decide(R + L(41) trên ChatBubble.tsx, { planApproved: true })`           | `allow` (nhánh plan, `reason` undefined) |
| FT-R3 | `decide(R + L(5) trên supabase/migrations/x.sql, { planApproved: true })` | `ask` (`migration`)                      |

#### 8.5 Boundary của tài liệu governance

| ID   | Đối tượng                                                 | Pass                                                                                                      | Fail                                         |
| ---- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| GB-1 | `.agents/rules/*.md`                                      | mỗi file ≤ 12,000 ký tự (`02-quality.md` mục tiêu ≤ 11,500)                                               | > 12,000                                     |
| GB-2 | `.agents/agents/planner/agent.md`                         | ≤ 9,500 (cứng ≤ 10,000)                                                                                   | > 10,000                                     |
| GB-3 | `.agents/agents/reviewer/agent.md`                        | **≤ 9,500**                                                                                               | > 9,500 (biên an toàn của brief)             |
| GB-4 | `vikini-investigate/SKILL.md`, `vikini-simplify/SKILL.md` | ≤ 150 dòng                                                                                                | ≥ 151                                        |
| GB-5 | 5 `SKILL.md` migrate                                      | frontmatter có đúng `name` = tên thư mục và `description` bắt đầu bằng `MANDATORY when`; số dòng = cũ + 1 | lệch                                         |
| GB-6 | `verify-docs.mjs` `[1/5]`–`[4/5]`                         | PASS                                                                                                      | bất kỳ FAIL nào (`[5/5]` được miễn theo A12) |

Tiêu chí pass/fail cho `@qa`: mọi ID ở §8.1–§8.5 phải có test hoặc lệnh tương ứng với kết quả khớp đúng. Không được dùng matcher lỏng (`toBeTruthy`, `toBeDefined`) cho `decision`/`reason`. Dùng `toBe("allow"|"ask")` và `toContain(<chuỗi>)`.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

**9.1 Test co-located**: `.agents/scripts/code-freeze-guard.test.ts` nằm cạnh `.agents/scripts/code-freeze-guard.js`. Không có business logic mới trong `src/lib/**`.

**9.2 Lệnh** (PowerShell 5.1, nối bằng `;`, không dùng `&&`):

```powershell
npx vitest run .agents/scripts/code-freeze-guard.test.ts
npx vitest list .agents/scripts/code-freeze-guard.test.ts --reporter=dot   # số test >= 66 + test mới
npm run verify
node scripts/verify-docs.mjs                                              # [1/5]-[4/5] PASS
```

**9.3 Kiểm tra ký tự / dòng** (bắt buộc `-Encoding UTF8` trên PS 5.1; `.Length` đếm UTF-16 code unit, cùng đơn vị với `verify-docs.mjs`):

```powershell
Get-ChildItem .agents/rules/*.md, .agents/agents/*/agent.md | ForEach-Object { "{0,6}  {1}" -f (Get-Content $_.FullName -Raw -Encoding UTF8).Length, $_.FullName }
Get-ChildItem .agents/skills/*/SKILL.md | ForEach-Object { "{0,4}  {1}" -f (Get-Content $_.FullName -Encoding UTF8).Count, $_.FullName }
```

**9.4 Probe cấu trúc**:

- `Test-Path .agents/skills/ux-ui-agent-skills`, `.agents/skills/design-taste-frontend`, `.agents/skills/redesign-existing-projects`, `.claude/skills/design-taste-frontend`, `.claude/skills/redesign-existing-projects`, `.agents/skills/api-patterns.md`: tất cả `False`.
- `Test-Path .agents/skills/emil-design-eng/SKILL.md`, `.agents/skills/animation-vocabulary/SKILL.md`, `.claude/skills/emil-design-eng/SKILL.md`: tất cả `True` (junction còn sống).
- `git status --short --untracked-files=all .agents/skills` phải liệt kê 7 `SKILL.md` mới và `README.md` là untracked (`??`), tức đã thoát khỏi ignore (D1), và `D .agents/skills/redesign-existing-projects/SKILL.md`.
- `node -e "JSON.parse(require('fs').readFileSync('skills-lock.json','utf8'))"`: không lỗi.
- Negative grep ở Bước 4.8: 0 kết quả.

**9.5 Wiring probe hook thật** (sau khi plan được duyệt, không có `.agents/.plan-approved`):

```powershell
'{"toolCall":{"name":"replace_file_content","args":{"TargetFile":"src/lib/utils/translations/vi.ts","TargetContent":"a","ReplacementContent":"b"}}}' | node scripts/code-freeze-guard.js
```

Kỳ vọng `{"decision":"allow","reason":"Fast-Track Mode: ..."}`. Đổi `name` thành `write_to_file` thì kỳ vọng `"decision":"ask"` nếu plan mới nhất chưa approved, hoặc `allow` nếu đã approved. Chỉ dùng probe này để xác nhận đường proxy root → `.agents/scripts`.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                   | Technical control                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Fast-Track trở thành cửa sau: agent chia một tính năng thành nhiều lần gọi ≤ 40 dòng     | Hook stateless nên không đếm được tích lũy. Control: (1) phạm vi path hẹp, chỉ `.tsx`/`.css`/`vi.ts`/`en.ts`, không có `.ts` logic, `lib/**`, `api/`; (2) điều kiện D2 chặn server action, env và import `*.server`; (3) `05-plan-review.md §1.1` cấm chia nhỏ, coi là `[BLOCKER]`; (4) banner `📌 [Fast-Track ...]` bắt buộc giúp `@qa` audit được. |
| R2  | `.tsx` trong `src/app/` là Server Component, edit nhỏ có thể lộ dữ liệu server           | D2 (`FAST_TRACK_FORBIDDEN_CONTENT`) cùng FT-N17. Chặn `*.server.tsx` ở gate 5 và FT-N11.                                                                                                                                                                                                                                                             |
| R3  | Fast-Track bỏ qua các chốt an toàn                                                       | Gate đặt **sau** gate 1–7 (§6.1). FT-N11/N12/N13 chứng minh `*.server`, test và `.agents/` vẫn `ask`.                                                                                                                                                                                                                                                |
| R4  | `Remove-Item -Recurse` trên junction xóa nhầm nội dung đích                              | Bước 1.1 gỡ junction bằng `cmd /c rmdir` **trước**, rồi probe `Test-Path` đích còn `True`. `emil-design-eng`, `animation-vocabulary`, `review-animations` không bị đụng. Probe 9.4 xác nhận.                                                                                                                                                         |
| R5  | `SKILL.md` mới bị `.gitignore` nuốt, mất khi clone                                       | D1 whitelist cùng probe `git status --short --untracked-files=all` (9.4).                                                                                                                                                                                                                                                                            |
| R6  | Link gãy sau khi migrate (`verify-docs [1/5]`)                                           | Bước 4.7 cập nhật README, Bước 4.8 negative grep, chạy `verify-docs.mjs`.                                                                                                                                                                                                                                                                            |
| R7  | `reviewer/agent.md` vượt 10,000 ký tự                                                    | Ngân sách ≤ 9,500, kế hoạch cô đọng (a)(b)(c) tiết kiệm ≥ 600 ký tự, đo bằng 9.3. GB-3 fail thì phải cô đọng tiếp trước khi kết thúc.                                                                                                                                                                                                                |
| R8  | JSDoc sai kiểu làm `tsc --noEmit` fail (`allowJs` + `@ts-check`)                         | `@param {GuardInput} input`, dùng `typeof ... !== "string"` để narrowing. Chạy Tier 1 sau Bước 6.1.                                                                                                                                                                                                                                                  |
| R9  | Đếm dòng lệch do CRLF / trailing newline                                                 | Dùng `/\r?\n/` (FT-C3). Trailing newline được tính là thêm 1 dòng (FT-C4), sai lệch theo hướng bảo thủ (`ask`).                                                                                                                                                                                                                                      |
| R10 | `ReplacementChunks` gộp làm vượt ngưỡng dù từng chunk nhỏ                                | Hành vi có chủ đích: ngân sách 40 dòng/lần gọi (A7, FT-H7/FT-N6).                                                                                                                                                                                                                                                                                    |
| R11 | Skill `superpowers` ghi đè quy trình (tự tạo worktree/branch, tự viết plan ngoài format) | Section Skill Precedence trong `02-quality.md` với `<important>` cấm ghi đè `00-core.md` (git) và `05-plan-review.md`. Hook vẫn chặn lệnh `git` mutating vì `git (?:status\|diff\|log\|show\|blame)` là allowlist duy nhất.                                                                                                                          |
| R12 | Viết lại body skill làm sai lệch nội dung kỹ thuật gốc                                   | Bước 2.3 đối chiếu số dòng = cũ + 1. Body copy nguyên văn từ dòng 4. Chỉ `add-feature` có 3 dòng đổi đường dẫn.                                                                                                                                                                                                                                      |
| R13 | Plan mới làm repo freeze (mtime mới nhất, `Ready for Review`)                            | Đây là hành vi mong đợi (A8). Fast-Track không phụ thuộc trạng thái plan, nên sau triển khai các micro-edit vẫn dùng được trong lúc freeze.                                                                                                                                                                                                          |

---

## Audit History

### Audit Run 1

`[REVIEWER_MODEL: gemini-4-argon]`

- **Reviewer**: Fallback Subagent `@reviewer` (`gemini-4-argon`)
- **Ngày**: 2026-10-19
- **Đối tượng**: Revision 1 (`2026-10-19-pstack-skills-and-fast-track-implementation-plan.md`)

#### 1. Kiểm Chứng Lỗi Cũ

- `N/A` (Đây là lượt thẩm định đầu tiên — Audit Run 1).

#### 2. Phát Hiện Mới

- Không phát hiện lỗi `[BLOCKER]`, `[MAJOR]`, hay `[MINOR]`.
- **Plan Completeness Gate**: Đạt đủ 7 phần bắt buộc:
  1. Bảng Verified Versions (§4, đối chiếu khớp `package.json:38-118`).
  2. Checklist tuần tự gắn nhãn `[DELETE]`, `[NEW]`, `[MODIFY]` (§5 & §7).
  3. Verification Plan (§9, kèm wiring probe và negative probes).
  4. Test Contract (§8, định nghĩa rõ input/output/boundary cho `countLines`, `isFastTrackEligible`, `decide`, và giới hạn ký tự governance).
  5. Assumptions & Cross-Task Dependencies (§3, A1–A12).
  6. Out of Scope (§1.2).
  7. Skills Loaded & Applied (§2.2).

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Tấn công 1 — Bypass chốt chặn file nhạy cảm hoặc test qua Fast-Track Mode (Gate Ordering & Path Traversal)**:
   - _Giả thuyết tấn công_: Agent gọi `replace_file_content` ≤ 40 dòng vào `src/app/features/x/Panel.server.tsx`, `src/app/features/chat/components/ChatBubble.test.tsx`, `src/app/__tests__/helper.tsx`, hoặc dùng đường dẫn leo thư mục `src/app/../lib/core/genaiClient.ts` để lách qua `FAST_TRACK_PATHS`.
   - _Kết quả kiểm chứng_: Không làm vỡ được kế hoạch.
   - _Bằng chứng_: `[SRC]` Trong `.agents/scripts/code-freeze-guard.js:403`, `toRepoRelative()` dùng `path.resolve(REPO_ROOT, toPosix(targetFile))` (`code-freeze-guard.js:106-107`) nên `src/app/../lib/core/genaiClient.ts` được chuẩn hóa thành `src/lib/core/genaiClient.ts` trước khi xét điều kiện, không khớp `FAST_TRACK_PATHS` (FT-N14). Trong `decide()` (`code-freeze-guard.js:435-484`), các cổng `isTestFile` (Gate 4, bắt cả `*.test.tsx` và `__tests__/`), `isSensitiveServerFile` (Gate 5, bắt `*.server.tsx`), `isMigrationFile` (Gate 6), và `isGovernanceFile` (Gate 7) đều chạy **trước** cổng Fast-Track (Gate 8, §6.1). Ngoài ra, `isFastTrackEligible` còn có lớp chặn thứ hai `FAST_TRACK_EXCLUDED_PATHS = /\.(?:test|spec|server)\.tsx$/` (FT-N18).

2. **Tấn công 2 — Lách giới hạn 40 dòng bằng mảng `ReplacementChunks` hoặc truyền nội dung rỗng / khác kiểu**:
   - _Giả thuyết tấn công_: Agent gửi 2 chunk mỗi chunk 21 dòng trong một lần gọi `replace_file_content` (từng chunk ≤ 40 nhưng tổng 42 dòng), hoặc gửi `TargetContent: ""` / `ReplacementContent: ""` để xóa trắng hoặc chèn khối không đối xứng, hoặc dùng tool `write_to_file` / `multi_replace_file_content`.
   - _Kết quả kiểm chứng_: Không làm vỡ được kế hoạch.
   - _Bằng chứng_: `[SRC]` `.agents/scripts/code-freeze-guard.js:600-611` (`extractInput`) nối toàn bộ `TargetContent` và `ReplacementContent` của mọi phần tử trong `ReplacementChunks` bằng `"\n"` trước khi truyền vào `decide()`. Do đó `countLines(oldContent)` và `countLines(newContent)` trong `isFastTrackEligible` (§6.3) đếm tổng số dòng của toàn bộ lần gọi (42 > 40 ➔ trả về `false`, FT-N6). Điều kiện `input.toolName !== "replace_file_content"` chặn `write_to_file` và `multi_replace_file_content` (FT-N1, FT-N3); điều kiện `oldContent === "" || newContent === ""` và `typeof !== "string"` chặn payload rỗng hoặc thiếu trường (FT-N7).

3. **Tấn công 3 — Tiêm mã phía server (`"use server"`, `process.env`, `*.server`) vào Server Component `.tsx` qua Fast-Track**:
   - _Giả thuyết tấn công_: Vì Next.js App Router cho phép Server Component trong `src/app/**/*.tsx`, một chỉnh sửa ≤ 40 dòng có thể chèn directive `"use server"`, đọc biến môi trường `process.env.SUPABASE_SERVICE_ROLE_KEY`, hoặc import `@/lib/core/supabase.server` khi chưa có plan được duyệt.
   - _Kết quả kiểm chứng_: Không làm vỡ được kế hoạch.
   - _Bằng chứng_: `[SRC]` Thiết kế ở §6.3 (quyết định D2) kiểm tra `!FAST_TRACK_FORBIDDEN_CONTENT.test(newContent)` với regex `/["']use server["']|\bprocess\.env\b|\.server["']/`, kết hợp kiểm thử âm FT-N17 cho cả 3 mẫu payload.

4. **Tấn công 4 — Vỡ liên kết Markdown (`verify-docs.mjs [1/5]`), vi phạm shorthand (`[3/5]`) hoặc vượt trần ký tự (`[4/5]`) sau khi di chuyển 5 skill**:
   - _Giả thuyết tấn công_: Sau khi xóa `.agents/skills/{api-patterns,streaming-patterns,database-migration,add-feature,add-translation}.md`, các file governance hoặc skill khác còn giữ đường dẫn cũ làm `node scripts/verify-docs.mjs` báo lỗi ở bước `[1/5]` hoặc `[3/5]`, hoặc việc thêm quy tắc mới làm `.agents/agents/reviewer/agent.md` vượt trần 10,000 ký tự ở bước `[4/5]`.
   - _Kết quả kiểm chứng_: Không làm vỡ được kế hoạch.
   - _Bằng chứng_: `[SRC]` Đã đọc trực tiếp `scripts/verify-docs.mjs:34-231` và toàn bộ các file sẽ sửa: `.agents/rules/01-coding.md:44`, `.agents/rules/02-quality.md:14-27,93-95`, `.agents/rules/04-bilingual.md:55`, `.agents/workflows/audit.md:21`, `.agents/agents/reviewer/mental-simulation.md:16,23,37`, `.agents/skills/add-model.md:46`, `.agents/skills/add-feature.md:32,70,79`, `.agents/skills/README.md:14-48`. Tất cả điểm tham chiếu đều đã được liệt kê trong Bước 2.2, Bước 4.1–4.7 và Bước 5.2. Về dung lượng ký tự, `verify-docs.mjs:217` đo `fs.readFileSync(agentMd, "utf8").length` (UTF-16 code units = 8,559 cho `reviewer/agent.md`, còn dư 1,441 ký tự so với trần 10,000 và kế hoạch còn rút gọn ≥ 600 ký tự ở Bước 5.5 để giữ dưới 9,500).

#### 4. Dismissed Findings (Noise Filtered)

- **DF-1 (UTF-8 byte length vs. UTF-16 code unit length của `reviewer/agent.md`)**: `view_file` hiển thị `Total Bytes: 10213` cho `.agents/agents/reviewer/agent.md` do tiếng Việt có dấu chiếm 2–3 byte UTF-8. Tuy nhiên `scripts/verify-docs.mjs:204,217` kiểm tra bằng `fs.readFileSync(..., "utf8").length` (đếm UTF-16 code units, hiện tại là 8,559). Không phải lỗi.
- **DF-2 (`scripts/verify-docs.mjs:155` chứa chuỗi `!rel.includes("ux-ui-agent-skills")`)**: Sau khi xóa thư mục `.agents/skills/ux-ui-agent-skills/`, điều kiện lọc loại trừ này không còn khớp file nào và trở thành no-op an toàn, không ảnh hưởng kết quả chạy script.

#### 5. Mental Simulation Verification Matrix

| Kịch bản                                     | Trạng thái | Loại bằng chứng   | Chi tiết kiểm chứng                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                   | `PASS`     | `[CMD]` / `[SRC]` | `npm run type-check` pass (exit code 0). `package.json:38-118` khớp bảng Verified Versions (§4). `tsconfig.json:4,31` bật `allowJs: true` và quét `**/*.js`; hàm mới trong `.agents/scripts/code-freeze-guard.js` có đầy đủ JSDoc `@param`/`@returns` hợp lệ cho `// @ts-check`.                                                              |
| **S2: Runner Lifecycle & Teardown**          | `PASS`     | `[CMD]` / `[SRC]` | `npx vitest run .agents/scripts/code-freeze-guard.test.ts` pass 66/66 tests (exit code 0). Các hàm `countLines`, `isFastTrackEligible`, `decide` là hàm thuần (pure, synchronous, không giữ timer/stream hay kết nối ngoài).                                                                                                                  |
| **S3: Database & Temporal Logic**            | `PASS`     | `[SRC]` / `[ADV]` | Task không thay đổi schema DB. Cổng `isMigrationFile` (`.agents/scripts/code-freeze-guard.js:273-280,465-473`) nằm ở Gate 6, chạy trước Fast-Track (Gate 8), bảo đảm mọi file `.sql` và `supabase/migrations/` luôn bị chặn `ask` (FT-R3).                                                                                                    |
| **S4: Cross-Task State Flow**                | `PASS`     | `[SRC]` / `[CMD]` | Khảo sát `.agents/hooks.json:9` và `scripts/code-freeze-guard.js:6` xác nhận root proxy import `../.agents/scripts/code-freeze-guard.js`. Khảo sát `.gitignore:38-43` và `git status --short --untracked-files=all .agents/skills` xác nhận `.agents/skills` đang bị ignore, cần sửa thành `.agents/skills/*` kèm `!` whitelist như Bước 1.4. |
| **S5: Security Boundary & 3-Tier Auth**      | `PASS`     | `[SRC]` / `[ADV]` | Cổng `isSensitiveServerFile` (`code-freeze-guard.js:259-265,454-462`), `isGovernanceFile` (`code-freeze-guard.js:288-291,476-484`), regex loại trừ `^(?!api\/)` cho `src/app/` và `FAST_TRACK_FORBIDDEN_CONTENT` (§6.3) ngăn việc chỉnh sửa route API, file `*.server.*`, hoặc đọc `process.env` qua Fast-Track.                              |
| **S6: External Resilience & Serverless Cap** | `PASS`     | `[SRC]`           | Hook `code-freeze-guard.js` chạy cục bộ với timeout 5 giây (`.agents/hooks.json:10`). Nhánh Fast-Track chỉ thực thi kiểm tra chuỗi/regex trong bộ nhớ và chạy trước `isPlanApproved()`, không phát sinh đọc đĩa bổ sung.                                                                                                                      |
| **Domain: Open Inquiry (Vikini)**            | `PASS`     | `[SRC]`           | Đã đối chiếu `.agents/rules/04-bilingual.md:14,55`, `.agents/skills/add-translation.md:11-38`, `.agents/skills/add-model.md:46`, và `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx:1-5`. Các tham chiếu đường dẫn skill và quy tắc song ngữ khớp với codebase thực tế.                                                |

#### 6. Claim Verification

- **Claim 1 (`.agents/scripts/code-freeze-guard.js` line numbers & structure)**: Plan nêu `extractInput()` nối `ReplacementChunks` bằng `"\n"` ở dòng 609–610 và `main()` kiểm tra `process.argv[1]` ở dòng 669. ➔ **Xác minh `[SRC]`**: Khớp `.agents/scripts/code-freeze-guard.js:600-611` và `669-671`.
- **Claim 2 (Số lượng test hiện có trong `code-freeze-guard.test.ts`)**: Plan nêu hiện có 66 test. ➔ **Xác minh `[CMD]`**: `npx vitest run .agents/scripts/code-freeze-guard.test.ts` chạy và pass đúng 66 tests (1 file).
- **Claim 3 (Số dòng của 5 file skill nội bộ trước khi migrate)**: Plan nêu body của `api-patterns.md` là dòng 4–103, `streaming-patterns.md` dòng 4–116, `database-migration.md` dòng 4–92, `add-feature.md` dòng 4–90 (có 3 tham chiếu ở dòng 32, 70, 79), `add-translation.md` dòng 4–76. ➔ **Xác minh `[SRC]`**: Đã `view_file` cả 5 file, số dòng và vị trí tham chiếu khớp chính xác.
- **Claim 4 (Sự tồn tại của các file thật dùng trong Test Contract §8.2–8.3 & Bước 5.3)**: Plan dùng `src/app/styles/themes/focus/amber.css`, `src/app/features/chat/components/ChatBubble.tsx`, `src/components/ui/button.tsx`, `src/lib/features/chat/conversations.ts`, `src/lib/core/genaiClient.ts`, `src/app/features/novelcrafter/components/ChapterEmptyStateActions.tsx`. ➔ **Xác minh `[SRC]`**: Đã `view_file` từng file, tất cả đều tồn tại trong codebase.

#### 7. Adversarial Timelines (S3, S5)

```text
Cơ chế: Fast-Track Mode & Scoped Protection trong PreToolUse Hook (code-freeze-guard.js)
- Trục 1 (Đồng thời / Lách qua nhiều chunk trong 1 payload):
  T1: Agent gửi replace_file_content trên ChatBubble.tsx với ReplacementChunks gồm 2 chunk, mỗi chunk 25 dòng (từng chunk <= 40 dòng) khi chưa có [PLAN_APPROVED].
  T2: extractInput() (code-freeze-guard.js:609-610) gộp oldParts.join("\n") và newParts.join("\n") thành chuỗi 50 dòng.
  T3: isFastTrackEligible() gọi countLines() trả về 50 > FAST_TRACK_MAX_LINES (40) -> trả về false -> rơi xuống nhánh Scoped Protection -> trả về { decision: "ask" }.
  Kết cục: Bị chặn lại hỏi người dùng -> AN TOÀN.

- Trục 2 (Khoảng trống check->use / Path Traversal & Server Injection):
  T1: Agent gửi replace_file_content (10 dòng) tới targetFile = "src/app/../lib/core/supabase.server.ts" hoặc chèn process.env.SECRET vào "src/app/page.tsx".
  T2: toRepoRelative() chuẩn hóa đường dẫn đầu thành "src/lib/core/supabase.server.ts", bị Gate 5 (isSensitiveServerFile) chặn trước khi tới Gate 8. Với "src/app/page.tsx", FAST_TRACK_FORBIDDEN_CONTENT phát hiện "\bprocess\.env\b" và trả về false.
  T3: decide() trả về { decision: "ask" } ở cả hai trường hợp.
  Kết cục: Không thể leo quyền đọc/ghi tầng server qua Fast-Track -> AN TOÀN.

- Trục 3 (Thất bại giữa chừng khi xóa NTFS Junction trong Bước 1.1–1.2):
  T1: Thực thi gỡ junction .claude/skills/{design-taste-frontend,redesign-existing-projects} bằng `cmd /c rmdir` trước khi chạy `Remove-Item -Recurse -Force` trên .agents/skills/*.
  T2: Kiểm tra `Test-Path .agents/skills/design-taste-frontend/SKILL.md` xác nhận liên kết junction đã tách rời khỏi thư mục đích, và các junction còn lại (`emil-design-eng`, `animation-vocabulary`, `review-animations`) không bị chạm tới.
  T3: Xóa 3 thư mục skill ngoại lai mà không để lại dangling junction làm lỗi `fs.readdirSync` của `verify-docs.mjs`.
  Kết cục: Cây thư mục `.agents/skills/` và `.claude/skills/` nhất quán -> AN TOÀN.

- Trục 4 (Môi trường thực thi / Hook Fail-Closed):
  T1: Payload JSON truyền qua stdin vào `node scripts/code-freeze-guard.js` bị lỗi cú pháp hoặc thiếu trường `TargetContent`/`ReplacementContent`.
  T2: `main()` bắt lỗi `catch` (code-freeze-guard.js:657) hoặc `isFastTrackEligible()` kiểm tra `typeof oldContent !== "string"` trả về `false`.
  T3: Hook xuất `{"decision":"ask"}` (fail-closed), không mở khóa repo.
  Kết cục: Luôn đóng an toàn khi dữ liệu đầu vào bất thường -> AN TOÀN.
```

#### 8. Commands Executed

1. `npm run type-check` ➔ Exit code `0` (`tsc --noEmit` sạch lỗi).
2. `npx vitest run .agents/scripts/code-freeze-guard.test.ts` ➔ Exit code `0` (`1 passed`, `66 passed`).
3. `npx vitest list .agents/scripts/code-freeze-guard.test.ts` ➔ Exit code `0` (liệt kê 66 test cases hiện hữu).
4. `git status --short --untracked-files=all .agents/skills` ➔ Exit code `0` (output rỗng, xác nhận `.gitignore:40` hiện đang ignore `.agents/skills`).

#### 9. Kết Luận

Bản kế hoạch đáp ứng đầy đủ các tiêu chuẩn kỹ thuật, ranh giới kiến trúc và yêu cầu kiểm thử của dự án Vikini. Phê duyệt triển khai.

[PLAN_APPROVED]
