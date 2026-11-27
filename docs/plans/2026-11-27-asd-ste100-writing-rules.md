# Kế Hoạch Triển Khai: Chuẩn Viết ASD-STE100 ("STE-lite") Song Ngữ Anh–Việt Cho Governance Vikini

- **Revision**: 2
- **Status**: Completed
- **Date**: 2026-11-27
- **Author**: Subagent @planner (`[PLANNER_MODEL: gemini-4-argon]`)

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Mục Tiêu (Goal)

Bổ sung chuẩn viết thích ứng từ **ASD-STE100 Issue 9** (**"STE-lite"**) cho cả tiếng Việt và tiếng Anh trên 3 tầng quy tắc quản trị của **Vikini**, tuân thủ nghiêm ngặt kiến trúc Progressive Disclosure và ngân sách ký tự Governance:

1. **Tầng Cốt Lõi (`.agents/rules/00-core.md`, `trigger: always_on`)**:
   - Thêm mục con `STE-lite (VI & EN)` dài chính xác **408 ký tự LF / 411 ký tự CRLF** (3 dòng, nằm trong dải yêu cầu `350–550` ký tự) ngay dưới `## Communication Protocol` (`.agents/rules/00-core.md:8-12`), giữ nguyên nguyên vẹn dòng `Tone: Professional, friendly.` (`.agents/rules/00-core.md:12`).
   - Cô đọng đủ 5 nguyên tắc không phụ thuộc ngôn ngữ (1 khái niệm = 1 thuật ngữ cố định; thể chủ động kèm chủ thể tường minh; 1 câu = 1 ý hoặc 1 hành động; cấm từ đệm/ẩn dụ sáo rỗng thiếu căn cứ như `"mượt mà"`, `"mạnh mẽ"`, `"toàn diện"`, `"seamlessly"`, `"robust"`, `"crucial"`; ngoại lệ Untouchables giữ nguyên code/đường dẫn/symbol/CLI/chuỗi lỗi gốc) và tuyên bố rõ tính chất khuyến nghị (không phải `[BLOCKER]`, không áp từ điển 900 từ tiếng Anh hay giới hạn cứng 20 từ cho tiếng Việt).
   - Bảo đảm tổng ký tự `always_on` (`.agents/rules/00-core.md` + `.agents/rules/02-quality.md` + `.agents/rules/05-plan-review.md`) duy trì **`<= 17,000`** (`TC-H` tại `.agents/scripts/code-freeze-guard.test.ts:1919`) và **`< 18,000`** (`TC-08` tại `.agents/scripts/code-freeze-guard.test.ts:1531`) dưới **cả hai chế độ LF (`16,751`) lẫn Windows CRLF (`16,972`)**.

2. **Tầng Song Ngữ UI (`.agents/rules/04-bilingual.md`, `trigger: model_decision`)**:
   - Bổ sung hướng dẫn microcopy STE-lite cho nhãn nút, empty state và thông báo toast/lỗi (chủ động, ngắn gọn, hướng hành động, diễn đạt tự nhiên thay vì dịch từng từ).
   - Bổ sung **Fixed Bilingual UI Glossary (Bảng thuật ngữ cố định Anh–Việt)** gồm 22 cặp thuật ngữ chuẩn hóa, neo 100% vào các khóa đang dùng thực tế trong `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts`.
   - Thêm 1 dòng tham chiếu ngắn vào `## Validation Checklist` trong `.agents/skills/add-translation/SKILL.md:71-77` để luồng Fast-Track cũng đối chiếu bảng thuật ngữ này.

3. **Tầng Tài Liệu & Kế Hoạch (`.agents/rules/06-writing-style.md`, `trigger: glob`)**:
   - Tạo mới tệp quy tắc với YAML frontmatter khớp chuẩn `.agents/rules/01-coding.md:1-5` và `.agents/rules/03-ui.md:1-5`: `trigger: glob` và `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"`.
   - Quy định rõ chuẩn STE-lite cho tài liệu kỹ thuật, kế hoạch (`docs/plans/*.md`), changelog và bài học kinh nghiệm (tách bạch bước thủ tục vs văn xuôi mô tả, nhất quán thuật ngữ kiến trúc, cấm AI-slop/ẩn dụ, bảo vệ Untouchables, và chốt chặn chống bắt bẻ vụn vặt cho `@reviewer`/`@qa`).
   - Liên kết vào Pre-Work Protocol của `.agents/rules/02-quality.md:8-26`, mục lục Rules Catalog của `.agents/README.md:59-71`, bổ sung kiểm thử tự động trong `.agents/scripts/code-freeze-guard.test.ts`, và cập nhật living docs (`docs/plans/README.md`, `docs/CHANGELOG.md`).

#### Out of Scope (What We're NOT Doing)

- **KHÔNG** viết lại hoặc sửa hàng loạt chuỗi dịch cũ trong `src/lib/utils/translations/vi.ts` và `src/lib/utils/translations/en.ts` (giữ minimal diff; bảng thuật ngữ áp dụng cho khóa thêm mới và khóa sửa theo task).
- **KHÔNG** viết lại các tài liệu lịch sử trong `docs/plans/`, `docs/lessons-learned.md`, `docs/archive/`, hoặc các mục phát hành cũ trong `docs/CHANGELOG.md`.
- **KHÔNG** xây dựng linter tự động chặn từ cấm hoặc đếm số từ trên CI/ESLint — STE-lite là chuẩn hướng dẫn soạn thảo, không tạo hard gate hay `[BLOCKER]`.
- **KHÔNG** sửa `.agents/rules/05-plan-review.md`, `.agents/agents/*/agent.md`, `.agents/scripts/code-freeze-guard.js`, `scripts/verify-plan.mjs`, hoặc `scripts/verify-docs.mjs` (các script hiện hữu đã tự động quét động `.agents/rules/*.md` và chặn `.agents/**`).
- **KHÔNG** lưu trữ/cắt bớt `docs/CHANGELOG.md` sang archive (tồn đọng kích thước `>= 35,000` bytes tại `scripts/verify-docs.mjs:272-274` là nợ kỹ thuật có sẵn ngoài phạm vi; chỉ thêm 1 mục phát hành mới ngắn gọn ở đầu tệp).
- **KHÔNG** thêm dependency npm mới và **KHÔNG** tự ý chạy lệnh git biến đổi (`git add`, `git commit`, `git push`, ... theo `.agents/rules/00-core.md:59-61`).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

#### Tài Liệu & Mã Nguồn Đã Đọc Trực Tiếp

- `.agents/rules/00-core.md:1-71`, `.agents/rules/01-coding.md:1-143`, `.agents/rules/02-quality.md:1-85`, `.agents/rules/03-ui.md:1-128`, `.agents/rules/04-bilingual.md:1-56`, `.agents/rules/05-plan-review.md:1-61`.
- `.agents/skills/add-translation/SKILL.md:1-77`, `.agents/skills/vikini-investigate/SKILL.md:1-120`, `.agents/skills/vikini-audit/SKILL.md:1-56`, `.agents/skills/README.md:1-58`.
- `.agents/README.md:1-118`, `.agents/agents/planner/agent.md:1-100`, `.agents/agents/reviewer/agent.md:1-116`, `.agents/agents/reviewer/evidence-bar.md:1-61`, `.agents/agents/reviewer/allowlist.md:1-36`, `.agents/agents/reviewer/mental-simulation.md:1-70`, `.agents/agents/qa/agent.md:1-166`.
- `.agents/scripts/code-freeze-guard.js:1-800`, `.agents/scripts/code-freeze-guard.test.ts:1-2035`, `.agents/scripts/plan-scope.js:1-276`.
- `scripts/verify-plan.mjs:1-414`, `scripts/verify-plan.test.ts:1-305`, `scripts/verify-docs.mjs:1-308`.
- `src/lib/utils/translations/vi.ts:1-1853`, `src/lib/utils/translations/en.ts:1-1845`, `src/lib/utils/translations/index.ts:1-34`.
- `package.json:1-140`, `.prettierrc:1-10`, `docs/architecture.md:1-341`, `docs/CHANGELOG.md:1-150`, `docs/lessons-learned.md:1-80,780-957`, `docs/plans/README.md`.

#### Skills Loaded & Applied

| Skill / Rule Đã Đọc (`read_file`)                   | Miền Áp Dụng                                         | Quyết Định Kỹ Thuật Chịu Ảnh Hưởng Trực Tiếp                                                                                                                                                                                                                                                            |
| :-------------------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.agents/rules/02-quality.md:8-85`                  | Pre-Work Protocol, Governance Char Limits & Triage   | Gắn `.agents/rules/06-writing-style.md` vào Pre-Work Protocol (`+64` ký tự LF / `+65` CRLF); khóa chặt trần `<= 12,000` ký tự/rule và tổng `always_on <= 17,000` cả LF lẫn CRLF (`TC-H`) / `< 18,000` (`TC-08`); dùng `;` thay `&&` trên PowerShell 5.1; chỉ bổ sung test mới (không làm yếu test cũ).  |
| `.agents/rules/04-bilingual.md:1-56`                | Bilingual UI Translation                             | Giữ nguyên 100% quy tắc `useLanguage()` + `t("key")`, danh sách cấm và đường dẫn `src/lib/utils/translations/` (khớp khẳng định M5 tại `.agents/scripts/code-freeze-guard.test.ts:1576`); bổ sung hướng dẫn microcopy STE-lite và Fixed Bilingual UI Glossary ngay phía dưới.                           |
| `.agents/skills/add-translation/SKILL.md:1-77`      | Workflow Thêm Khóa Dịch (kể cả Fast-Track)           | Nối 1 dòng kiểm tra vào `## Validation Checklist` (`.agents/skills/add-translation/SKILL.md:71-77`) nhắc đối chiếu microcopy STE-lite & Fixed Bilingual UI Glossary tại `.agents/rules/04-bilingual.md` mà không đổi quy trình đồng bộ `vi.ts`/`en.ts` hay `src/lib/utils/translations/index.ts:22-34`. |
| `.agents/rules/05-plan-review.md:1-61`              | Plan-Review-Revise, Code Freeze & Independent Critic | Mọi tệp trong `.agents/**` kích hoạt `CRITIC_REQUIRED yes` (`scripts/verify-plan.mjs:209`) và bị khóa `ask` ở Gate 7 (`.agents/scripts/code-freeze-guard.js:542-551`); tuyệt đối không ghi sẵn `Status: Approved` hay `[PLAN_APPROVED]`.                                                                |
| `.agents/skills/vikini-investigate/SKILL.md:78-111` | Blast-Radius Analysis trên Governance & Scripts      | Quét toàn bộ người tiêu thụ `.agents/rules/*.md`: `scripts/verify-docs.mjs:150-237`, `.agents/scripts/code-freeze-guard.test.ts:1516-1603,1897-1982`, `.agents/README.md:59-71`, `.prettierrc:1-10` để ngăn tràn ngân sách ký tự và lỗi shorthand `--strict-shorthand`.                                 |
| `.agents/skills/vikini-audit/SKILL.md:32-56`        | Quality & Bilingual Compliance Audit                 | Xác nhận kiểm thử co-located bổ sung vào `.agents/scripts/code-freeze-guard.test.ts` tuân thủ 0 `any`, 0 `console.log`, kiểm chứng `npx prettier --check` trước `npm run verify`, và giữ nguyên tính chính xác song ngữ.                                                                                |

---

### 3. Assumptions & Cross-Task Dependencies

#### Giả Định Đã Xác Minh (Verified Assumptions)

1. **A1 — Hai tầng kiểm tra ngân sách `always_on` & biên an toàn Windows CRLF trong `code-freeze-guard.test.ts` (`[SRC]`)**:
   - `.agents/scripts/code-freeze-guard.test.ts:1517-1531` (`TC-08`) quét động mọi `*.md` trong `.agents/rules/`, kiểm từng tệp `<= 12,000` ký tự và tổng các tệp khớp `/^trigger:\s*always_on\s*$/m` phải `< 18,000`.
   - `.agents/scripts/code-freeze-guard.test.ts:1900-1919` (`TC-H`) cộng thô `content.length` (regex khớp cả `\r\n`) của `00-core.md` + `02-quality.md` + `05-plan-review.md` và yêu cầu **`<= 17,000`**. Do repo không có `.gitattributes` cố định LF, trên Windows checkout với `core.autocrlf=true`, `217` dòng hiện tại (`71 + 85 + 61`) làm tổng tăng từ **`16,279` (LF)** lên **`16,496` (CRLF)** (còn dư `504` ký tự trước `17,000`).
   - Do đó, phần thêm mới được khống chế chặt ở **`+408` LF / `+411` CRLF** (`00-core.md`, `+3` dòng) và **`+64` LF / `+65` CRLF** (`02-quality.md`, `+1` dòng), tổng cộng **`+472` LF / `+476` CRLF** (`221` dòng), đưa `always_on` dự kiến đạt **`16,751` LF** (dư `249` dưới `17,000`) và **`16,972` CRLF** (dư `28` dưới `17,000`, `1,028` dưới `18,000`). Cả `04-bilingual.md` (`trigger: model_decision`) và `06-writing-style.md` (`trigger: glob`) cộng **`0`** ký tự vào `always_on`.

2. **A2 — Không dùng bảng Markdown trong `always_on` rules & khóa Prettier `lint-staged` (`[SRC]`)**:
   - `package.json:136-138` cấu hình `lint-staged` chạy `prettier --write` trên `*.md` với `.prettierrc:4-5,9` (`singleQuote: false`, `printWidth: 100`, `endOfLine: "lf"`).
   - `docs/lessons-learned.md:782-798` và `:838-843` ghi nhận bảng Markdown bị Prettier đệm khoảng trắng làm phình ký tự lúc commit, và `.agents/scripts/code-freeze-guard.test.ts:1928` cấm bảng trong `02-quality.md` (`expect(r02).not.toContain("| :---")`).
   - Do đó `00-core.md` và `02-quality.md` chỉ dùng danh sách gạch đầu dòng (0 ký tự phình do Prettier); bảng Fixed Bilingual UI Glossary chỉ đặt trong `04-bilingual.md` (`trigger: model_decision`, còn dư `~6,800` ký tự dưới `12,000`), và khung §6.5 đặt sẵn dòng trống sau các tiêu đề `## 1.`–`## 7.` khớp chuẩn Prettier.

3. **A3 — Chuẩn YAML Frontmatter cho `trigger: glob` với tiền tố `**/` trong Antigravity & Vikini (`[SRC]`+`[URL]`)\*\*:
   - Hai quy tắc `glob` hiện hữu của Vikini dùng khóa số nhiều `globs:` bọc ngoặc kép và ghép cặp mẫu nông với mẫu tiền tố `**/`: `.agents/rules/01-coding.md:1-5` (`globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"`) và `.agents/rules/03-ui.md:1-5` (`globs: "*.tsx, *.css, **/*.tsx, **/*.css"`), được khóa tại `.agents/scripts/code-freeze-guard.test.ts:1569-1572`.
   - Theo tài liệu Google Antigravity Rules 2026 (`antigravity.google/docs/rules`, `google.dev`), bộ khớp glob đối chiếu với đường dẫn đầy đủ đã phân giải (chuẩn hóa `/`), nên mẫu tương đối trần thiếu `**/` có thể không khớp đường dẫn tuyệt đối. Tệp mới `.agents/rules/06-writing-style.md` dùng `trigger: glob` và `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"` để bao phủ chắc chắn cả đường dẫn tương đối lẫn tuyệt đối cho tệp cấp 1 (`docs/CHANGELOG.md`, `docs/lessons-learned.md`) và tệp lồng nhau (`docs/plans/*.md`).

4. **A4 — Kiểm soát tiền tố đường dẫn đầy đủ cho `scripts/verify-docs.mjs --strict-shorthand` (`[SRC]`)**:
   - `scripts/verify-docs.mjs:154-169` quét regex `/(?:^|[^\w./-])(rules|skills|workflows)\/([\w.-]+\.md)/` trên toàn bộ `.agents/rules/*.md`, `.agents/skills/*.md` và `.agents/README.md`.
   - Mọi tham chiếu nội bộ trong `00-core.md`, `02-quality.md`, `04-bilingual.md`, `06-writing-style.md` và `add-translation/SKILL.md` bắt buộc dùng tiền tố đầy đủ `.agents/rules/...` hoặc `.agents/skills/...` (riêng liên kết tương đối Markdown `./rules/06-writing-style.md` trong `.agents/README.md:65-70` đã có `/` ngay trước `rules/` nên vượt qua cả `[1/5]` lẫn `[3/5]`).

5. **A5 — Căn cứ ngữ liệu thực tế cho Fixed Bilingual UI Glossary (`[SRC]`)**:
   - Đã khảo sát toàn bộ `src/lib/utils/translations/vi.ts:1-1853` và `src/lib/utils/translations/en.ts:1-1845` (khóa đối xứng ép kiểu biên dịch tại `src/lib/utils/translations/index.ts:22-34`).
   - Phát hiện vài điểm trôi thuật ngữ nhẹ giữa mã cũ và Vikini 3.0 cần chốt chuẩn cho khóa mới: `Cuộc trò chuyện` (`src/lib/utils/translations/vi.ts:3,966,1733`) vs `Cuộc hội thoại` (`src/lib/utils/translations/vi.ts:96,729`); `Kho kiến thức` (`src/lib/utils/translations/vi.ts:696`) vs `cơ sở tri thức` (`src/lib/utils/translations/vi.ts:1833`); `Tệp` (`src/lib/utils/translations/vi.ts:205,842,1798`) vs `file` (`src/lib/utils/translations/vi.ts:217`); `Hủy` (`src/lib/utils/translations/vi.ts:44,752`) vs `Huỷ` (`src/lib/utils/translations/vi.ts:611`); `Model` (`src/lib/utils/translations/vi.ts:69-88,101,1594`) vs `Mô hình` (`src/lib/utils/translations/vi.ts:229`). Glossary trong `04-bilingual.md` chốt đúng thuật ngữ Vikini 3.0 đang chiếm ưu thế và có kiểm thử tự động xác minh sự tồn tại trong `vi.ts`/`en.ts`.

6. **A6 — Bảo toàn M5 & tự động bảo vệ rule mới dưới Code Freeze Guard (`[SRC]`)**:
   - `.agents/scripts/code-freeze-guard.js:217-220,542-551` kiểm `normalizeForCompare(relative).startsWith(".agents/")`, nên `.agents/rules/06-writing-style.md` tự động được bảo vệ `ask` không cần sửa `code-freeze-guard.js`.
   - `scripts/verify-docs.mjs:206-216` đọc động `fs.readdirSync(rulesDir)`, nên tự động kiểm trần `12,000` ký tự cho `06-writing-style.md`.
   - Toàn bộ các chuỗi bắt buộc trong Ma trận M5 (`.agents/scripts/code-freeze-guard.test.ts:1546-1603`) được bảo toàn nguyên vẹn.

#### Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies)

- **Chốt chặn Independent Critic Pass**: Do kế hoạch chạm 7 tệp dưới `.agents/**`, `scripts/verify-plan.mjs:206-242` xuất `CRITIC_REQUIRED yes`. Khi Primary `@reviewer` xác nhận đạt chuẩn sẽ đặt `- **Status**: Awaiting Critic` và chờ phiên `@reviewer` độc lập mới hoàn toàn phê duyệt cuối cùng theo `.agents/rules/05-plan-review.md:37-39`.
- **Thứ tự triển khai nội bộ**: Tạo `.agents/rules/06-writing-style.md` trước hoặc cùng lúc với cập nhật `.agents/rules/00-core.md`, `.agents/rules/02-quality.md`, `.agents/README.md` và `.agents/scripts/code-freeze-guard.test.ts` để liên kết Markdown `[06-writing-style.md](./rules/06-writing-style.md)` và các test đọc tệp luôn tồn tại khi chạy `verify-docs.mjs` và `vitest`.

---

### 4. Bảng Verified Versions

| Thành phần / Tiêu chuẩn      | Phiên bản / Phát hành (`[SRC]` / `[URL]`)            | Xác minh 2026 & Nguồn đối chiếu                                                                                                                                                                                                                                                          | Vai trò trong kế hoạch                                                                          |
| :--------------------------- | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| **ASD-STE100**               | **Issue 9** (phát hành `2025-01-15`)                 | Chuyển trạng thái chính thức thành chuẩn quốc tế; gồm 53 quy tắc viết (9 phần) và từ điển ~900 từ duyệt; bản STE-lite của Vikini rút trích 5 nguyên tắc bất biến ngôn ngữ cho cả VI & EN ([ASD-STE100 Official](https://www.asd-ste100.org/)) `[URL]`                                    | Nền tảng lý thuyết cho 3 tầng quy tắc STE-lite (`00-core`, `04-bilingual`, `06-writing-style`). |
| **Google Antigravity Rules** | Modular `.agents/rules/*.md` YAML Frontmatter (2026) | Hỗ trợ `trigger: always_on`, `trigger: model_decision`, `trigger: glob` kèm khóa `globs: "..."` dùng dấu `/` ([Antigravity Rules Docs](https://antigravity.google/docs/rules)) `[URL]`; xác nhận trực tiếp trên `.agents/rules/01-coding.md:1-5` và `.agents/rules/03-ui.md:1-5` `[SRC]` | Cấu hình Progressive Disclosure cho `.agents/rules/06-writing-style.md`.                        |
| **Node.js**                  | `24.x` (`package.json:121`)                          | Active LTS 2026 `[SRC]`                                                                                                                                                                                                                                                                  | Chạy `scripts/verify-plan.mjs`, `scripts/verify-docs.mjs`, và Vitest.                           |
| **Vitest**                   | `4.1.12` (`package.json:118`)                        | Chạy `npm run test:run` (`package.json:20`) bao gồm `.agents/scripts/code-freeze-guard.test.ts` `[SRC]`                                                                                                                                                                                  | Thực thi bộ test governance `TC-08`, `TC-H`, và nhóm mới `TC-STE-01..04`.                       |
| **Prettier**                 | `3.7.4` (`package.json:112`, `.prettierrc:1-10`)     | `printWidth: 100`, `singleQuote: false`, `endOfLine: "lf"`; kích hoạt bởi `lint-staged` trên `*.md` (`package.json:136-138`) `[SRC]`                                                                                                                                                     | Chạy `npx prettier --check` trước khi đo ký tự Governance và chạy test.                         |
| **TypeScript**               | `5.9.3` (`package.json:116`)                         | `npm run type-check` (`tsc --noEmit`) và kiểm parity khóa dịch tại `src/lib/utils/translations/index.ts:22-34` `[SRC]`                                                                                                                                                                   | Xác minh 0 lỗi kiểu trên toàn repo và bộ test mới.                                              |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### Tạo mới

- [NEW] `.agents/rules/06-writing-style.md` — Quy tắc STE-lite (`trigger: glob`, `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"`) cho tài liệu kỹ thuật, kế hoạch, changelog và bài học kinh nghiệm (dự kiến `~3,100` ký tự LF / `~3,155` CRLF, `<= 12,000`).

#### Chỉnh sửa

- [MODIFY] `.agents/rules/00-core.md` — Thêm mục con `STE-lite (VI & EN)` (`+408` ký tự LF / `+411` CRLF, 3 dòng) dưới `## Communication Protocol` (dòng `8-12`), giữ nguyên `Tone: Professional, friendly.` và tổng `always_on <= 17,000` cả LF lẫn CRLF.
- [MODIFY] `.agents/rules/02-quality.md` — Thêm 1 dòng vào `## Pre-Work Protocol` (dòng `25-26`) trỏ tới `.agents/rules/06-writing-style.md` (`+64` ký tự LF / `+65` CRLF, không dùng bảng Markdown).
- [MODIFY] `.agents/rules/04-bilingual.md` — Bổ sung mục `## STE-Lite Microcopy Guidelines (VI & EN)` và `## Fixed Bilingual UI Glossary (Bảng thuật ngữ cố định Anh–Việt)` (22 cặp thuật ngữ chuẩn hóa từ `vi.ts`/`en.ts`; dự kiến tổng `~5,190` ký tự LF / `~5,296` CRLF, `<= 12,000`).
- [MODIFY] `.agents/skills/add-translation/SKILL.md` — Thêm 1 dòng vào `## Validation Checklist` (dòng `71-77`) nhắc đối chiếu STE-lite microcopy và Fixed Bilingual UI Glossary tại `.agents/rules/04-bilingual.md`.
- [MODIFY] `.agents/README.md` — Cập nhật dòng `61` (`6 bộ quy tắc` → `7 bộ quy tắc`), bổ sung mô tả STE-lite cho hàng `04`, và thêm hàng `06` (`[06-writing-style.md](./rules/06-writing-style.md)`, `glob` với `docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md`) vào bảng Rules Catalog (dòng `63-70`).
- [MODIFY] `.agents/scripts/code-freeze-guard.test.ts` — Bổ sung khối kiểm thử `TC-STE-01..TC-STE-04` (chỉ thêm mới, không xóa/làm yếu bất kỳ `expect()` hiện có) xác minh frontmatter/glob, nội dung bảo toàn STE-lite, ngân sách `always_on <= 17,000` / `< 18,000`, neo thực tế Glossary với `vi.ts`/`en.ts`, và 3 Negative Probes.
- [MODIFY] `docs/plans/README.md` — Thêm dòng đầu bảng trong `## Ma Trận Kế Hoạch Triển Khai` ghi nhận kế hoạch `2026-11-27-asd-ste100-writing-rules.md`.
- [MODIFY] `docs/CHANGELOG.md` — Thêm mục phát hành mới ngày `2026-11-27` ở đầu tệp tóm tắt việc triển khai chuẩn viết STE-lite trên 3 tầng quy tắc Governance.

---

### 6. Caller-First Design Sketch

#### 6.1. Bảng Dự Toán Ngân Sách Ký Tự Governance (Post-Prettier, LF & Windows CRLF)

| Tệp quy tắc                         | Trigger          | Dòng (Hiện ➔ Mới) |    Hiện tại (LF / CRLF) |       Delta (LF / CRLF) | Sau triển khai (LF / CRLF) |                                        Giới hạn |                          Tác động `always_on` |
| :---------------------------------- | :--------------- | ----------------: | ----------------------: | ----------------------: | -------------------------: | ----------------------------------------------: | --------------------------------------------: |
| `.agents/rules/00-core.md`          | `always_on`      |       `71` ➔ `74` |       `4,436` / `4,507` | **`+408`** / **`+411`** |          `4,844` / `4,918` |                                     `<= 12,000` |                       `+408` LF / `+411` CRLF |
| `.agents/rules/02-quality.md`       | `always_on`      |       `85` ➔ `86` |       `5,465` / `5,550` |   **`+64`** / **`+65`** |          `5,529` / `5,615` |                                     `<= 12,000` |                         `+64` LF / `+65` CRLF |
| `.agents/rules/05-plan-review.md`   | `always_on`      |       `61` ➔ `61` |       `6,378` / `6,439` |               `0` / `0` |          `6,378` / `6,439` |                                     `<= 12,000` |                                           `0` |
| **Tổng `always_on` (3 tệp)**        | `always_on`      | **`217` ➔ `221`** | **`16,279` / `16,496`** |     **`+472` / `+476`** |    **`16,751` / `16,972`** | **`<= 17,000` (`TC-H`) / `< 18,000` (`TC-08`)** | **Dư `249` (LF) / `28` (CRLF) dưới `17,000`** |
| `.agents/rules/04-bilingual.md`     | `model_decision` |     `56` ➔ ~`108` |     ~`1,640` / ~`1,696` |   ~`+3,550` / ~`+3,602` |        ~`5,190` / ~`5,298` |                                     `<= 12,000` |                                           `0` |
| `.agents/rules/06-writing-style.md` | `glob`           |       `0` ➔ ~`55` |               `0` / `0` |   ~`+3,100` / ~`+3,155` |        ~`3,100` / ~`3,155` |                                     `<= 12,000` |                                           `0` |

> **Xác minh số học `always_on`**: Tổng hiện tại đo thực tế trên repo là **`16,279` ký tự (LF)** trên **`217` dòng** (`71 + 85 + 61`) ➔ **`16,496` ký tự (CRLF)** (`16,279 + 217`); tổng delta xác định chính xác từng ký tự là **`+472` LF** (`408 + 64`) / **`+476` CRLF** (`411 + 65`) ➔ tổng sau sửa là **`16,751` LF** và **`16,972` CRLF**, đều thỏa mãn `<= 17,000` (`TC-H`) và `< 18,000` (`TC-08`) bất kể `core.autocrlf`. Ở Bước 8, `TC-08` và `TC-H` đối chiếu trực tiếp `content.length` thực tế trên đĩa sau khi chạy Prettier.

#### 6.2. Nội Dung Chính Xác Bổ Sung Vào `.agents/rules/00-core.md` (`+408` LF / `+411` CRLF)

Chèn ngay sau dòng `12` (`- **Tone**: ...`) trong `## Communication Protocol` (3 dòng: `113 + 1`, `93 + 1`, `199 + 1` = `408` ký tự LF; thêm `3` `\r` = `411` ký tự CRLF):

```markdown
- **STE-lite (VI & EN)**: **1 concept = 1 term**; **Active voice** (named actor); **1 sentence = 1 idea/action**.
  - **Zero fluff**: ban "mượt mà", "mạnh mẽ", "toàn diện", "seamlessly", "robust", "crucial".
  - **Untouchables**: keep code, paths, symbols, CLI, exact errors. Not `[BLOCKER]`; no 900-word EN dictionary / 20-word VI cap (`.agents/rules/04-bilingual.md`, `.agents/rules/06-writing-style.md`).
```

#### 6.3. Nội Dung Chính Xác Bổ Sung Vào `.agents/rules/02-quality.md` (`+64` LF / `+65` CRLF)

Chèn ngay sau dòng `25` trong `## Pre-Work Protocol` (1 dòng: `63 + 1` = `64` ký tự LF; `65` ký tự CRLF):

```markdown
- **Docs / Writing Style**: `.agents/rules/06-writing-style.md`
```

#### 6.4. Thiết Kế Mở Rộng `.agents/rules/04-bilingual.md` (STE-Lite Microcopy & Fixed Bilingual UI Glossary)

Giữ nguyên 100% dòng `1-56` hiện có; bổ sung 2 mục mới sau `## Enforcement`:

1. **`## STE-Lite Microcopy Guidelines (VI & EN)`**:
   - **Buttons & CTAs**: Mở đầu bằng động từ trực tiếp, ngắn 1–3 từ (`Lưu`, `Xóa`, `Tạo ảnh`, `Thử lại` / `Save`, `Delete`, `Generate`, `Retry`).
   - **Empty States**: Nêu 1 câu sự thật (đang trống gì) + 1 câu/nút hành động tiếp theo (`"Chưa có ảnh nào"` + `"Nhập prompt và nhấn Tạo ảnh để bắt đầu."`).
   - **Toast & Error Messages**: Theo mẫu `[Chuyện gì lỗi] + [Bước kế tiếp]` bằng thể chủ động, ngôn ngữ rõ ràng (ví dụ: `"Không thể tải lên ảnh tham chiếu. Vui lòng thử lại."` / `"Failed to upload reference image. Please try again."`); tránh lời xin lỗi sáo rỗng hoặc biệt ngữ nội bộ.
   - **Natural Phrasing (No Literal Word-for-Word Translation)**: Dịch theo ngữ cảnh và cách diễn đạt tự nhiên của từng ngôn ngữ thay vì dịch máy từng từ (`"Branch in new chat"` → `"Tách sang chat mới"`, không dịch `"Phân nhánh trong trò chuyện mới"`).
   - **Untouchables & Scope**: Không dịch tên sản phẩm/nhà cung cấp (`Vikini`, `Gemini`, `Claude`, `DeepSeek`, `Grok`, `Strata`, `Gem`, `Persona`, `Image Studio`, `Novelcrafter`, `Prompt Studio`), phím tắt (`Ctrl+K`, `Esc`), đuôi tệp (`.md`, `.txt`, `.pdf`), hay biến nội suy (`{count}`, `{{limit}}`). Áp dụng cho khóa mới và khóa đang sửa; không sửa dây chuyền khóa cũ ngoài phạm vi task.

2. **`## Fixed Bilingual UI Glossary (Bảng thuật ngữ cố định Anh–Việt)`** (22 cặp neo trực tiếp vào `src/lib/utils/translations/vi.ts` và `en.ts`):

| Concept / EN                              | Canonical VI                                    | Nguồn xác minh thực tế (`[SRC]`)                                                                                    | Ghi chú nhất quán (cho khóa mới)                                                                                                                                   |
| :---------------------------------------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Conversation`                            | `Cuộc trò chuyện`                               | `src/lib/utils/translations/vi.ts:3,966,1733`; `src/lib/utils/translations/en.ts:3,956,1726`                        | Ưu tiên hơn `Cuộc hội thoại`; dùng `Chat` ở nút hẹp                                                                                                                |
| `Message`                                 | `Tin nhắn`                                      | `src/lib/utils/translations/vi.ts:279,321,1795`; `src/lib/utils/translations/en.ts:267,309,1787`                    | Thống nhất toàn app                                                                                                                                                |
| `Project`                                 | `Dự án`                                         | `src/lib/utils/translations/vi.ts:94,690-691`; `src/lib/utils/translations/en.ts:96,678-679`                        | Thống nhất toàn app                                                                                                                                                |
| `Knowledge Base`                          | `Kho kiến thức`                                 | `src/lib/utils/translations/vi.ts:696`; `src/lib/utils/translations/en.ts:684`                                      | Tránh `cơ sở kiến thức` / `cơ sở tri thức` (`src/lib/utils/translations/vi.ts:733,1833`)                                                                           |
| `Document`                                | `Tài liệu`                                      | `src/lib/utils/translations/vi.ts:698,728`; `src/lib/utils/translations/en.ts:686,716`                              | Dùng cho tài liệu RAG/Google Docs                                                                                                                                  |
| `File` / `Attachments`                    | `Tệp` / `Tệp đính kèm`                          | `src/lib/utils/translations/vi.ts:205-206,842`; `src/lib/utils/translations/en.ts:195-196,831`                      | Tránh dùng `file` thô trong chuỗi VI mới                                                                                                                           |
| `Model`                                   | `Model`                                         | `src/lib/utils/translations/vi.ts:69,101,423`; `src/lib/utils/translations/en.ts:71,101,411`                        | Giữ nguyên; viết thường `model` giữa câu, tránh xen `Mô hình`                                                                                                      |
| `Thinking` / `Reasoning`                  | `Suy luận`                                      | `src/lib/utils/translations/vi.ts:74,149,1816`; `src/lib/utils/translations/en.ts:76,142,1808`                      | Chuẩn bộ chọn mức suy luận & trạng thái stream                                                                                                                     |
| `Context`                                 | `Ngữ cảnh`                                      | `src/lib/utils/translations/vi.ts:87,329`; `src/lib/utils/translations/en.ts:89,317`                                | Dùng cho cửa sổ ngữ cảnh / token                                                                                                                                   |
| `Web Search`                              | `Tìm kiếm web`                                  | `src/lib/utils/translations/vi.ts:141,169,1814`; `src/lib/utils/translations/en.ts:134,162,1806`                    | Nút ngắn trên thanh công cụ: `Tìm web`                                                                                                                             |
| `Gem` / `Persona`                         | `Gem` / `Persona`                               | `src/lib/utils/translations/vi.ts:158-159,164-165`; `src/lib/utils/translations/en.ts:151-152,157-158`              | Giữ nguyên tên tính năng                                                                                                                                           |
| `Prompt`                                  | `Prompt`                                        | `src/lib/utils/translations/vi.ts:439,654,1634`; `src/lib/utils/translations/en.ts:427,642,1627`                    | Giữ nguyên                                                                                                                                                         |
| `Image Studio` / `Gallery`                | `Image Studio` / `Thư viện`                     | `src/lib/utils/translations/vi.ts:632,643,981`; `src/lib/utils/translations/en.ts:620,631,968`                      | Tab/tiêu đề trang thư viện dùng `Thư viện`                                                                                                                         |
| `Reference Image`                         | `Ảnh tham chiếu`                                | `src/lib/utils/translations/vi.ts:565,602`; `src/lib/utils/translations/en.ts:553,590`                              | Thống nhất toàn Image Studio                                                                                                                                       |
| `Aspect Ratio` / `Resolution`             | `Tỷ lệ khung hình` / `Độ phân giải`             | `src/lib/utils/translations/vi.ts:429-430,571`; `src/lib/utils/translations/en.ts:417-418,559`                      | Nhãn hẹp dùng `Tỷ lệ`                                                                                                                                              |
| `Story Bible` / `Outline` / `Scene Beats` | `Hồ sơ Truyện` / `Dàn ý` / `Phân cảnh`          | `src/lib/utils/translations/vi.ts:1063,1100,1558,1618`; `src/lib/utils/translations/en.ts:1051,1472,1475,1549,1675` | Cố định trong Novelcrafter Studio (`Chương` / `Hồi`: `src/lib/utils/translations/vi.ts:1065-1066`, `src/lib/utils/translations/en.ts:1053-1054`)                   |
| `Settings` / `Theme`                      | `Cài đặt` / `Giao diện`                         | `src/lib/utils/translations/vi.ts:47,64,838-839`; `src/lib/utils/translations/en.ts:47,66,827-828`                  | Thống nhất thanh điều hướng & header                                                                                                                               |
| `Delete` vs `Remove`                      | `Xóa` vs `Gỡ`                                   | `src/lib/utils/translations/vi.ts:166,237,954,1429,1746`; `src/lib/utils/translations/en.ts:159,225,944,1418,1739`  | `Xóa` = xóa vĩnh viễn; `Gỡ` = tháo gắn kết/ngừng áp dụng                                                                                                           |
| `Cancel`                                  | `Hủy`                                           | `src/lib/utils/translations/vi.ts:44`; `src/lib/utils/translations/en.ts:44`                                        | Chuẩn hóa dấu thanh `Hủy` (tránh `Huỷ` ở `src/lib/utils/translations/vi.ts:611`)                                                                                   |
| `Copy` / `Retry`                          | `Sao chép` / `Thử lại`                          | `src/lib/utils/translations/vi.ts:38,609,718,808`; `src/lib/utils/translations/en.ts:38,597,706,797`                | Nhất quán trên mọi nút hành động & lỗi                                                                                                                             |
| `Upload` / `Download`                     | `Tải lên` / `Tải xuống`                         | `src/lib/utils/translations/vi.ts:206,440,713`; `src/lib/utils/translations/en.ts:196,428,701`                      | Nhất quán tệp & ảnh                                                                                                                                                |
| `Sign in` / `Sign out` / `Rank` / `Block` | `Đăng nhập` / `Đăng xuất` / `Xếp hạng` / `Khóa` | `src/lib/utils/translations/vi.ts:9,18,249,259-260`; `src/lib/utils/translations/en.ts:9,18,237,247-248`            | Nhất quán Auth & Admin (`Mở khóa` = `Unblock`, `Máy cục bộ` = `Local` tại `src/lib/utils/translations/vi.ts:76,82`, `src/lib/utils/translations/en.ts:78,84,1373`) |

> **Lưu ý khi ghi vào `.agents/rules/04-bilingual.md`**: Bảng Glossary trong tệp rule chỉ gồm 3 cột gọn (`EN`, `Canonical VI`, `Usage`) để không nhúng số dòng `vi.ts`/`en.ts` dễ trôi khi thêm khóa dịch mới; dẫn chứng `file:line` đã cố định trong kế hoạch này và được kiểm chứng động bởi `TC-STE-03`.

#### 6.5. Khung Cấu Trúc Tệp Mới `.agents/rules/06-writing-style.md` (`~3,100` ký tự LF, chuẩn Prettier)

```markdown
---
trigger: glob
globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"
description: Adapted ASD-STE100 (STE-lite) writing rules for Vietnamese and English technical docs, plans, changelogs, and lessons learned.
---

# Technical Writing Style (STE-Lite — VI & EN)

## 1. Scope & Non-Goals

- Applies to `docs/*.md`, `docs/plans/*.md`, `docs/CHANGELOG.md`, and `docs/lessons-learned.md` in both Vietnamese and English.
- Adapted from ASD-STE100 Issue 9 for clarity and precision — NOT a 900-word English-only dictionary and NOT a rigid 20-word cap for Vietnamese sentences.
- Advisory quality guide: NEVER a `[BLOCKER]` in plan review or QA unless wording ambiguity causes concrete technical risk.

## 2. Procedural vs. Descriptive Rules

- **Procedural steps** (checklists `- [ ]`, runbooks, migration/verification steps):
  - Use numbered steps or `- [ ]` lists.
  - Start each step with one imperative verb (`Create`, `Update`, `Run` / `Tạo`, `Cập nhật`, `Chạy`).
  - Keep 1 action per step; place conditions before the action (`When X fails, run Y` / `Khi X lỗi, chạy Y`).
- **Descriptive prose** (goals, architecture explanations, root causes, risk descriptions):
  - Keep 1 main idea per sentence.
  - Use active voice and name the concrete technical actor (`code-freeze-guard.js blocks...`, `verify-plan.mjs validates...` instead of vague passive `the system is protected...`).

## 3. Lexical Consistency

- Use 1 canonical term per technical or domain concept across the entire document; do not rotate synonyms (`Code Freeze Guard`, `Plan Scope Guard`, `Independent Critic Pass`, `Fast-Track Mode`, `co-located test`, `Negative Probe`, `Wiring Probe`, `Server-Only`).
- When referencing user-facing UI labels, match the Fixed Bilingual UI Glossary in `.agents/rules/04-bilingual.md`.

## 4. Zero AI-Slop, Hedges & Fluff Metaphors

- Ban unbacked marketing adjectives, vague intensifiers, and decorative metaphors: `"mượt mà"`, `"mạnh mẽ"`, `"toàn diện"`, `"tối ưu hóa tối đa"`, `"đột phá"`, `"seamlessly"`, `"robust"`, `"comprehensive"`, `"crucial"`, `"leverage"`, `"delve"`, `"streamline"`.
- Replace subjective adjectives with verifiable metrics, bounds, or `[SRC]`/`[CMD]` facts (e.g., `"adds 408 LF chars"` instead of `"significantly leaner"`).

## 5. Untouchables (Never Rewrite)

- Preserve verbatim: fenced/inline code blocks, file paths, symbol and API identifiers, CLI commands, regexes, SQL/JSON/YAML schemas, exact error/log strings, governance tokens (`[PLAN_APPROVED]`, `[CHANGES_REQUESTED]`, `[AWAITING_CRITIC]`, `[BLOCKER]`, `[MAJOR]`, `[MINOR]`), and historical records in `docs/CHANGELOG.md`, `docs/lessons-learned.md`, and `docs/archive/`.

## 6. Document-Type Conventions

- **Plans (`docs/plans/*.md`)**: Name exact files, symbols, failure modes, and verifiable pass/fail checks.
- **Changelogs (`docs/CHANGELOG.md`)**: Lead every bullet with the concrete change verb + affected file/module.
- **Lessons Learned (`docs/lessons-learned.md`)**: Keep `Symptom`, `Root Cause`, `Fix`, and `Prevention Rule` factual and causal.

## 7. Reviewer Guidance (Anti-Nitpick Rule)

- `@reviewer` and `@qa` only flag writing-style findings when ambiguous actors, missing conditions, or conflicting terminology create real implementation or security risk.
- Never issue `[BLOCKER]` or `[MAJOR]` findings for word-count nitpicks, stylistic phrasing preferences, or Vietnamese sentence length.
```

#### 6.6. Phác Thảo Call Site Kiểm Thử Co-Located (`.agents/scripts/code-freeze-guard.test.ts`)

```typescript
describe("ASD-STE100 (STE-lite) Governance Rules — TC-STE-01..TC-STE-04", () => {
  it("TC-STE-01: validates 06-writing-style.md glob frontmatter, size budget, and governance indexes", () => {
    // Reads .agents/rules/06-writing-style.md, .agents/README.md, .agents/rules/02-quality.md
    // Asserts trigger: glob (NOT always_on), globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md", length <= 12000, indexed in README & 02-quality
  });

  it("TC-STE-02: preserves core STE-lite clauses across 00-core.md, 04-bilingual.md, 06-writing-style.md, and add-translation/SKILL.md Validation Checklist", () => {
    // Verifies Professional, friendly tone retained; 5 STE-lite principles + non-BLOCKER + no 900-word/20-word cap
    // Verifies 04-bilingual.md keeps src/lib/utils/translations/ + STE-lite microcopy + Fixed Bilingual UI Glossary
    // Verifies 06-writing-style.md enforces procedural/descriptive split, untouchables, anti-nitpick guidance
    // Non-tautological check: slices add-translation/SKILL.md strictly AFTER "## Validation Checklist" and asserts .agents/rules/04-bilingual.md + STE-lite + Fixed Bilingual UI Glossary
  });

  it("TC-STE-03: grounds Fixed Bilingual UI Glossary entries against real src/lib/utils/translations/{vi,en}.ts", () => {
    // Reads vi.ts and en.ts; asserts canonical pairs referenced in 04-bilingual.md (including exact casing "Scene Beats") exist verbatim in vi.ts and en.ts
  });

  it("TC-STE-04 (Negative Probes): proves always_on budget isolation, Code Freeze ask-protection, and zero shorthand/legacy violations", () => {
    // NP-1: Synthetic 06-writing-style.md flipped to trigger: always_on breaches 17,000 / 18,000 budget
    // NP-2: decide({ targetFile: ".agents/rules/06-writing-style.md" }, { planApproved: true, approvedFiles: [".agents/rules/06-writing-style.md"] }) -> ask (governance file)
    // NP-3: None of 00-core, 02-quality, 04-bilingual, 06-writing-style, add-translation/SKILL.md match shorthandRegex or bannedClaudeCliPatterns
  });
});
```

---

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **Bước 1 — Tạo tệp quy tắc mới `.agents/rules/06-writing-style.md`**: Tạo tệp với frontmatter `trigger: glob` và `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"`, trình bày đủ 7 mục kèm dòng trống sau heading theo §6.5 (giữ `~2,900–3,300` ký tự, không dùng đường dẫn viết tắt `rules/` hoặc `skills/`).
- [ ] **Bước 2 — Cập nhật `.agents/rules/00-core.md`**: Chèn khối 3 dòng `STE-lite (VI & EN)` (`+408` ký tự LF / `+411` CRLF) ngay sau dòng `12` theo §6.2; giữ nguyên 100% nội dung hiện có và các chuỗi M5.
- [ ] **Bước 3 — Cập nhật `.agents/rules/02-quality.md`**: Thêm 1 dòng `- **Docs / Writing Style**: \`.agents/rules/06-writing-style.md\`` (`+64`ký tự LF /`+65`CRLF) vào cuối danh sách`## Pre-Work Protocol`(dòng`25-26`); không chèn bảng Markdown.
- [ ] **Bước 4 — Cập nhật `.agents/rules/04-bilingual.md` và `.agents/skills/add-translation/SKILL.md`**:
  - Nối `## STE-Lite Microcopy Guidelines (VI & EN)` và `## Fixed Bilingual UI Glossary (Bảng thuật ngữ cố định Anh–Việt)` (22 cặp chuẩn hóa theo §6.4, giữ chính tả `Scene Beats`) vào `.agents/rules/04-bilingual.md`, giữ nguyên dòng `1-56`.
  - Thêm 1 dòng vào `## Validation Checklist` của `.agents/skills/add-translation/SKILL.md:71-77`: `- Follow STE-lite microcopy rules and the Fixed Bilingual UI Glossary in \`.agents/rules/04-bilingual.md\``.
- [ ] **Bước 5 — Cập nhật mục lục `.agents/README.md`**: Sửa `6 bộ quy tắc` → `7 bộ quy tắc` tại dòng `61`, cập nhật mô tả hàng `04` (thêm microcopy STE-lite & bảng thuật ngữ), và thêm hàng `06` trỏ tới `[06-writing-style.md](./rules/06-writing-style.md)` kèm `glob` (`docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md`).
- [ ] **Bước 6 — Bổ sung kiểm thử co-located vào `.agents/scripts/code-freeze-guard.test.ts`**: Thêm nhóm `TC-STE-01..TC-STE-04` theo §6.6 và §8 (tuyệt đối không xóa hay làm yếu bất kỳ `expect()` cũ nào).
- [ ] **Bước 7 — Cập nhật Living Docs**: Thêm dòng trạng thái kế hoạch vào `docs/plans/README.md` và thêm mục phát hành mới ở đầu `docs/CHANGELOG.md`.
- [ ] **Bước 8 — Định dạng Prettier & chạy toàn bộ Verification Suite**: Chạy `npx prettier --write` (nếu cần) rồi `npx prettier --check` trên tất cả tệp đã sửa/tạo mới (lưu ý hook `command-policy.js` sẽ hỏi xác nhận `ask`), tiếp theo chạy `npm run type-check; npm run lint; npm run test:run` và `node scripts/verify-docs.mjs --strict-shorthand`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Mã TC                                     | Mô tả hành vi mong đợi                                       | Đầu vào / Điều kiện biên                                                                                                                                                                                                                                                                                                 | Tiêu chí PASS / FAIL bắt buộc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :---------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **TC-STE-01**                             | Frontmatter, ngân sách và chỉ mục của `06-writing-style.md`  | Đọc `.agents/rules/06-writing-style.md`, `.agents/README.md`, `.agents/rules/02-quality.md`                                                                                                                                                                                                                              | **PASS**: Có `trigger: glob`, không khớp `/^trigger:\s*always_on\s*$/m`, có `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"`, `length <= 12000`, được liên kết trong `.agents/README.md` (`./rules/06-writing-style.md`, `7 bộ quy tắc`, mẫu `**/docs/**/*.md`) và `.agents/rules/02-quality.md` (`.agents/rules/06-writing-style.md`). **FAIL** nếu thiếu bất kỳ điều kiện nào.                                                                                                                                                                                                                                                  |
| **TC-STE-02**                             | Bảo toàn quy tắc STE-lite & không hồi quy M5 (chống tự đúng) | Đọc `00-core.md`, `04-bilingual.md`, `06-writing-style.md`, lát cắt sau `## Validation Checklist` trong `add-translation/SKILL.md`                                                                                                                                                                                       | **PASS**: `00-core.md` giữ `Professional, friendly`, chứa `STE-lite`, `1 concept = 1 term`, `Active voice`, `Untouchables`, `900-word`, `[BLOCKER]`; `04-bilingual.md` giữ `src/lib/utils/translations/`, chứa `STE-Lite Microcopy Guidelines` và `Fixed Bilingual UI Glossary`; `06-writing-style.md` chứa `Procedural`, `Descriptive`, `Untouchables`, và cảnh báo không gắn `[BLOCKER]` cho word-count; lát cắt sau `## Validation Checklist` trong `add-translation/SKILL.md` (không khớp dòng `43` có sẵn) chứa đồng thời `.agents/rules/04-bilingual.md`, `STE-lite` và `Fixed Bilingual UI Glossary`. **FAIL** nếu thiếu khóa nội dung nào. |
| **TC-STE-03**                             | Neo thực tế Fixed Bilingual UI Glossary vào `vi.ts`/`en.ts`  | Đọc `04-bilingual.md`, `src/lib/utils/translations/vi.ts`, `src/lib/utils/translations/en.ts`                                                                                                                                                                                                                            | **PASS**: Tối thiểu 10 cặp thuật ngữ đại diện trong bảng Glossary của `04-bilingual.md` (`Cuộc trò chuyện` / `Conversation`, `Kho kiến thức` / `Knowledge Base`, `Tệp đính kèm` / `Attachments`, `Ảnh tham chiếu` / `Reference Image`, `Suy luận` / `Reasoning`, `Hồ sơ Truyện` / `Story Bible`, `Phân cảnh` / `Scene Beats`, `Thư viện` / `Gallery`, `Xếp hạng` / `Rank`, `Tải xuống` / `Download`) đều xuất hiện nguyên văn trong `04-bilingual.md` **và** khớp chuỗi thật trong `vi.ts` / `en.ts` (đặc biệt `"Scene Beats"` khớp `src/lib/utils/translations/en.ts:1472,1475,1675`). **FAIL** nếu bất kỳ cặp nào lệch codebase.                 |
| **TC-STE-04**                             | 3 Negative Probes (Ngân sách, Code Freeze, Shorthand/Legacy) | (1) Fixture giả lập đổi `06-writing-style.md` thành `trigger: always_on`; (2) `decide()` ghi vào `.agents/rules/06-writing-style.md` dù `planApproved: true` và nằm trong `approvedFiles`; (3) Quét regex `shorthandRegex` (`scripts/verify-docs.mjs:154`) & `bannedClaudeCliPatterns` trên 5 tệp governance sửa/tạo mới | **PASS**: (1) Tổng `always_on` với fixture giả lập vượt ngưỡng `> 17,000` (chứng minh lý do bắt buộc `trigger: glob`); (2) `decide()` trả `{ decision: "ask" }` kèm `"governance file in .agents/"`; (3) `0` kết quả khớp `shorthandRegex` và `0` kết quả khớp `bannedClaudeCliPatterns`. **FAIL** nếu bất kỳ Negative Probe nào lọt qua.                                                                                                                                                                                                                                                                                                          |
| **TC-BUDGET (Existing `TC-08` & `TC-H`)** | Ngân sách ký tự sau Prettier cả LF lẫn Windows CRLF          | Toàn bộ `.agents/rules/*.md` sau `npx prettier --check` (và kiểm tra bổ sung quy đổi CRLF `<= 17,000`)                                                                                                                                                                                                                   | **PASS**: Mọi rule `<= 12,000` ký tự; tổng `always_on <= 17,000` cả LF (`16,751`) lẫn CRLF (`16,972`, `.agents/scripts/code-freeze-guard.test.ts:1919`) và `< 18,000` (`:1531`); `overBudgetFixture >= 18,000` (`:1926`); `02-quality.md` không chứa `"                                                                                                                                                                                                                                                                                                                                                                                            | :---"` (`:1928`). **FAIL** nếu vượt trần ở LF hoặc CRLF, hoặc lỗi Prettier. |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Co-Located Test Suite

- **Tệp kiểm thử**: `.agents/scripts/code-freeze-guard.test.ts` (đặt cùng thư mục `.agents/scripts/` với `code-freeze-guard.js`; giữ nguyên 100% các test hiện có, bổ sung `TC-STE-01..TC-STE-04`).

#### Lệnh Kiểm Chứng Tuần Tự (PowerShell 5.1 — Dùng `;`, Cấm `&&`)

1. **Wiring Probe 1 — Prettier Parity (chống phình ký tự khi `lint-staged` chạy)**:

   ```powershell
   npx prettier --check .agents/rules/00-core.md .agents/rules/02-quality.md .agents/rules/04-bilingual.md .agents/rules/06-writing-style.md .agents/skills/add-translation/SKILL.md .agents/README.md .agents/scripts/code-freeze-guard.test.ts docs/plans/README.md docs/CHANGELOG.md
   ```

   - Yêu cầu: Exit `0` (mọi tệp khớp chuẩn Prettier, bảo đảm `lint-staged` là no-op).
   - _Lưu ý Code Freeze Hook_: `npx prettier --check` không thuộc read-only allowlist của `.agents/scripts/command-policy.js:320-352` (chỉ mở `npx vitest|tsc|eslint`), nên ở giai đoạn triển khai lệnh này sẽ kích hoạt hộp thoại `ask` để User/PM xác nhận tường minh (`@reviewer` không chạy lệnh này trong bước review read-only).

2. **Wiring Probe 2 — Governance & Docs Integrity (`scripts/verify-docs.mjs`)**:

   ```powershell
   node scripts/verify-docs.mjs --strict-shorthand
   ```

   - Tiêu chí nghiệm thu: 4 bước `[1/5]` (0 broken links, bao gồm `./rules/06-writing-style.md` trong `.agents/README.md`), `[2/5]` (0 legacy paths), `[3/5]` (0 shorthand prefixes), và `[4/5]` (mọi rules `<= 12,000` ký tự và agents `<= 10,000` ký tự) **BẮT BUỘC `PASS`**. Exit code `1` **chỉ do** bước `[5/5]` (`FAIL: CHANGELOG.md exceeds 35,000 bytes` tại `scripts/verify-docs.mjs:272-274`, hiện `126,892` bytes pre-existing) được dự kiến và chấp nhận vì lưu trữ CHANGELOG nằm ngoài phạm vi (Out of Scope).

3. **Wiring Probe 3 — Scoped Governance & Plan Verification Tests (gồm Negative Probes `TC-STE-04`)**:

   ```powershell
   npx vitest run .agents/scripts/code-freeze-guard.test.ts scripts/verify-plan.test.ts --reporter=dot
   ```

   - Yêu cầu: Exit `0`, toàn bộ `TC-08`, `TC-H`, `M5`, và `TC-STE-01..TC-STE-04` đạt `PASS`.

4. **Tier 2 Full Verification Suite (Bắt buộc trước khi đóng task)**:

   ```powershell
   npm run type-check; npm run lint; npm run test:run
   ```

   - Yêu cầu: `0` TypeScript errors, `0` ESLint errors/warnings, 100% Vitest tests pass.

5. **Kiểm tra plan hiện tại (chạy ngay sau khi viết/cập nhật kế hoạch)**:
   ```powershell
   node scripts/verify-plan.mjs docs/plans/2026-11-27-asd-ste100-writing-rules.md
   ```

   - Yêu cầu: Exit `0`, `[PASS] SECTIONS 7/7`, `0 failures, 0 warnings`, `[INFO] CRITIC_REQUIRED yes (...)`.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| #   | Rủi ro                                                                                                                                                                                                                                  |     Mức độ     | Technical Control Đã Xác Minh (`[SRC]` / Negative Probe)                                                                                                                                                                                                                                                                                                                                                                           |
| --- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Tràn ngân sách `always_on` (`> 17,000` ở `TC-H` hoặc `>= 18,000` ở `TC-08`) trên LF hoặc Windows CRLF (`core.autocrlf=true`)** do mở rộng `00-core.md` + `02-quality.md` hoặc gán nhầm `trigger: always_on` cho `06-writing-style.md` |    **Cao**     | Khống chế cứng diff `00-core.md` (`+408` LF / `+411` CRLF) + `02-quality.md` (`+64` LF / `+65` CRLF) ➔ tổng dự kiến **`16,751` LF** và **`16,972` CRLF** (cả hai `<= 17,000`, bất kể thiếu `.gitattributes`); cưỡng chế trực tiếp bởi `.agents/scripts/code-freeze-guard.test.ts:1517-1531,1900-1919` (`TC-08`, `TC-H`) và Negative Probe `NP-1` trong `TC-STE-04` (xác minh `06-writing-style.md` bắt buộc dùng `trigger: glob`). |
| 2   | **`lint-staged` Prettier đệm bảng Markdown làm vượt trần ký tự lúc commit** (tái diễn bài học `docs/lessons-learned.md:782-798,838-843`)                                                                                                | **Trung bình** | Cấm bảng Markdown trong `00-core.md` và `02-quality.md` (cưỡng chế tại `.agents/scripts/code-freeze-guard.test.ts:1928`); đặt bảng Glossary chỉ trong `04-bilingual.md` (`trigger: model_decision`, dư `~6,800` ký tự dưới `12,000`); chạy bắt buộc Wiring Probe 1 (`npx prettier --check`) trước `vitest` theo `package.json:136-138` và `.prettierrc:1-10`.                                                                      |
| 3   | **Gãy `scripts/verify-docs.mjs --strict-shorthand` hoặc broken link** khi tham chiếu `06-writing-style.md` bằng đường dẫn rút gọn `rules/...`                                                                                           | **Trung bình** | Bắt buộc dùng tiền tố đầy đủ `.agents/rules/...` và `.agents/skills/...` ở mọi rule/skill (và `./rules/06-writing-style.md` trong `.agents/README.md`); kiểm chứng bằng Wiring Probe 2 (`scripts/verify-docs.mjs:39-109,150-201`) và Negative Probe `NP-3` trong `TC-STE-04`.                                                                                                                                                      |
| 4   | **Bảng Fixed Bilingual UI Glossary lệch khỏi thuật ngữ thật trong `vi.ts`/`en.ts`**, gây mâu thuẫn khi dev thêm khóa mới                                                                                                                | **Trung bình** | Mọi cặp thuật ngữ đều đã khảo sát đối chiếu `src/lib/utils/translations/vi.ts:1-1853` và `src/lib/utils/translations/en.ts:1-1845` (khóa parity bởi `src/lib/utils/translations/index.ts:22-34`), và được khóa tự động bằng bài test `TC-STE-03` đọc trực tiếp `vi.ts`/`en.ts`.                                                                                                                                                    |
| 5   | **Tác tử `@reviewer` áp dụng máy móc STE-lite làm `[BLOCKER]`** (bắt bẻ độ dài câu tiếng Việt hoặc từ điển 900 từ tiếng Anh), gây nghẽn vòng lặp duyệt kế hoạch                                                                         | **Trung bình** | Khẳng định tường minh "Not a `[BLOCKER]`; no 900-word EN dictionary or 20-word VI cap" trong `.agents/rules/00-core.md` và mục `§7 Reviewer Guidance (Anti-Nitpick Rule)` trong `.agents/rules/06-writing-style.md`, khóa hồi quy bằng `TC-STE-02`.                                                                                                                                                                                |
| 6   | **Tệp quy tắc mới `06-writing-style.md` lọt khỏi Code Freeze Guard** cho phép agent tự ý sửa khi chưa xin phép                                                                                                                          |    **Cao**     | Bảo vệ tự động ở Gate 7 qua `isGovernanceFile()` (`.agents/scripts/code-freeze-guard.js:217-220,542-551`) và `CRITIC_REQUIRED yes` (`scripts/verify-plan.mjs:209`); kiểm chứng bằng Negative Probe `NP-2` trong `TC-STE-04` (`decision: "ask"` dù `planApproved: true`).                                                                                                                                                           |

---

## Audit History

<!-- Lead Reviewer (@reviewer) sẽ nối các Audit Run vào đây -->

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Revision 1 (chưa có lỗi lượt trước để đối soát).
- Output `node scripts/verify-plan.mjs docs/plans/2026-11-27-asd-ste100-writing-rules.md`:
  - Exit code: `0`
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ `LINE_REF` trong phần Technical Plan đạt `PASS` (`0 failures, 0 warnings`)
  - `[INFO] CRITIC_REQUIRED yes (.agents/README.md, .agents/rules/00-core.md, .agents/rules/02-quality.md, .agents/rules/04-bilingual.md, .agents/rules/06-writing-style.md, .agents/scripts/code-freeze-guard.test.ts, .agents/skills/add-translation/SKILL.md)`
  - `[INFO] CRITIC_FLOOR skipped (no audit run)`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                           | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | :------------- | :------ | :---------------------------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/lib/utils/translations/en.ts:1609`               | [SRC]        | Xung đột trực tiếp giữa §6.4 Hàng 16 (`Scene Beats`, chữ `B` hoa) và §8 Test Contract `TC-STE-03` (`Scene beats`, chữ `b` thường, yêu cầu xuất hiện nguyên văn trong `04-bilingual.md` và khớp `en.ts`), gây thất bại tất định khi triển khai test. Ngoài ra §6.4 Hàng 16 dẫn `src/lib/utils/translations/en.ts:1088` (`"Scenes (Chapter Beats)"`) và `:1609` (`"Scene beats"`) thay vì `:1472`, `:1475`, `:1675` (`"Scene Beats"`), và Hàng 22 dẫn `src/lib/utils/translations/vi.ts:1384-1385` / `src/lib/utils/translations/en.ts:1375-1376` (`localLlmOnline`/`localLlmOffline`) thay vì `src/lib/utils/translations/vi.ts:76` & `:82` (`"Máy cục bộ"`) / `src/lib/utils/translations/en.ts:78`, `:84`, `:1373` (`"Local"`). Cần đồng nhất chính tả `Scene Beats` giữa §6.4 và `TC-STE-03` và sửa các số dòng dẫn chiếu sai ngữ nghĩa.                                                                                                                                                                 |
| 2   | DEFECT         | [MAJOR] | `.agents/rules/01-coding.md:3`                        | [SRC], [URL] | Tệp mới `.agents/rules/06-writing-style.md` khai báo `globs: "docs/*.md, docs/**/*.md"` thiếu mẫu tiền tố `**/`. Theo tài liệu Google Antigravity Rules 2026 (`antigravity.google/docs/rules`, `google.dev`), bộ khớp glob đối chiếu với đường dẫn đầy đủ đã phân giải (chuẩn hóa `/`), nên mẫu tương đối trần thiếu `**/` không khớp đường dẫn tuyệt đối (tương tự lý do `.agents/rules/01-coding.md:3` và `.agents/rules/03-ui.md:3` ghép cặp mẫu nông với `**/*`, khóa tại `.agents/scripts/code-freeze-guard.test.ts:1569-1572`). Cần đổi sang `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"` đồng bộ trong §1, §3 (A3), §5, §6.5, §7, `TC-STE-01` và `.agents/README.md`.                                                                                                                                                                                                                                                                                                          |
| 3   | DEFECT         | [MAJOR] | `.agents/skills/add-translation/SKILL.md:43`          | [SRC]        | Khẳng định trong `TC-STE-02` (§8: `add-translation/SKILL.md dẫn chiếu .agents/rules/04-bilingual.md`) mang tính tự đúng (tautological): `.agents/skills/add-translation/SKILL.md:43` vốn đã chứa sẵn `.agents/rules/04-bilingual.md`, trong khi mục cần sửa là `## Validation Checklist` (`.agents/skills/add-translation/SKILL.md:71-77`) hiện chưa có nhắc tới STE-lite hay Glossary. Vi phạm tiêu chí S2 (`.agents/agents/reviewer/mental-simulation.md:24`). Cần khoanh vùng kiểm tra `TC-STE-02` vào lát cắt từ `## Validation Checklist` trở đi và khẳng định cả `.agents/rules/04-bilingual.md` lẫn `STE-lite` / `Fixed Bilingual UI Glossary`.                                                                                                                                                                                                                                                                                                                                                     |
| 4   | DEFECT         | [MAJOR] | `.agents/scripts/code-freeze-guard.test.ts:1900-1919` | [SRC]        | Rủi ro vỡ ngân sách `TC-H` (`realTotal <= 17,000`) trên Windows CRLF: `.agents/scripts/code-freeze-guard.test.ts:1900-1919` cộng thô `content.length` (regex `/^trigger:\s*always_on\s*$/m` khớp cả `\r\n`), repo chưa có `.gitattributes` cố định LF (tệp gốc như `package.json:1` và `.prettierrc:1` đang mang CRLF dù `.prettierrc:9` cấu hình `"endOfLine": "lf"`). Hiện tại 3 tệp `always_on` có `217` dòng (`~16,279` LF / `~16,496` CRLF, đều `<= 17,000`); sau khi thêm `+526` (`00-core.md`, §6.2 thực tế dài `526` ký tự gồm 5 `\n`, kế hoạch ghi `527`) và `+72` (`02-quality.md`), tổng đạt `~16,877` LF (chỉ dư `123` ký tự) và tăng lên `~17,100 > 17,000` nếu Windows checkout với `core.autocrlf=true` (`+223` dòng). Cần rút gọn khối §6.2 trong `00-core.md` xuống `~390–420` ký tự (vẫn nằm trong dải `350–550` và giữ đủ 5 nguyên tắc + không `[BLOCKER]` + 2 đường dẫn) để tổng `always_on <= 17,000` an toàn cả LF lẫn CRLF, đồng thời ghi rõ số ký tự đo chính xác từng tệp ở §6.1. |
| 5   | DEFECT         | [MINOR] | `scripts/verify-docs.mjs:272-274`                     | [CMD], [SRC] | `node scripts/verify-docs.mjs --strict-shorthand` hiện trả exit code `1` do bước `[5/5]` (`CHANGELOG.md` `126,892 >= 35,000` bytes); §9 Wiring Probe 2 nên ghi rõ tiêu chí nghiệm thu là `[1/5]..[4/5]` `PASS` và chấp nhận exit `1` chỉ do `[5/5]` pre-existing. Ngoài ra, khung §6.5 thiếu dòng trống sau heading `## 1.`–`## 7.` sẽ được `prettier --write` chèn thêm (`.prettierrc:1-10`, `package.json:136-138`), và `npx prettier --check` không thuộc allowlist của `.agents/scripts/command-policy.js:283-350` nên sẽ kích hoạt `ask` khi triển khai.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | RISK_DISMISSED | [MINOR] | `.agents/scripts/code-freeze-guard.js:542-551`        | [SRC], [CMD] | Đã bác bỏ rủi ro tệp quy tắc mới `.agents/rules/06-writing-style.md` lọt khỏi bảo vệ Code Freeze: Gate 7 (`isGovernanceFile()` tại `.agents/scripts/code-freeze-guard.js:217-220,542-551`) chặn trước Plan Scope Guard (Gate 9), và `scripts/verify-plan.mjs:206-242` tự động bật `CRITIC_REQUIRED yes` cho mọi tệp `.agents/**`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | RISK_DISMISSED | [MINOR] | `scripts/verify-docs.mjs:206-216`                     | [SRC], [CMD] | Đã bác bỏ rủi ro thiếu kiểm soát kích thước hoặc shorthand prefix trên tệp mới: cả `scripts/verify-docs.mjs:154-216` lẫn `.agents/scripts/code-freeze-guard.test.ts:1518-1531` đều quét động thư mục `.agents/rules/`, và mọi đường dẫn đề xuất trong §6.2–§6.5 đều dùng tiền tố đầy đủ `.agents/rules/...` hoặc `./rules/...`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                         | Kết quả | Bằng chứng          | Chi tiết                                                                                                                                                                                                                                                                      |
| :------------------------------------------ | :------ | :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate 1: Goal & Out of Scope                 | PASS    | [CMD]               | `node scripts/verify-plan.mjs` trả `[PASS] SECTIONS 7/7`; phạm vi loại trừ rõ ràng, không sửa dây chuyền `vi.ts`/`en.ts` hay lịch sử cũ.                                                                                                                                      |
| Gate 2: Pre-Work & Skills Loaded            | PASS    | [SRC]               | Ánh xạ đủ các rule/skill kích hoạt từ `.agents/rules/02-quality.md:8-26` (`04-bilingual.md`, `add-translation/SKILL.md`, `05-plan-review.md`, `vikini-investigate`, `vikini-audit`).                                                                                          |
| Gate 3: Assumptions & Dependencies          | FAIL    | [SRC], [URL]        | A1 bỏ sót biên CRLF (`+223` ký tự khi thiếu `.gitattributes`) đối với `TC-H` (`.agents/scripts/code-freeze-guard.test.ts:1919`); A3 bỏ sót tiền tố `**/` trong `globs:` cho đường dẫn tuyệt đối theo tài liệu Antigravity 2026 (`google.dev`).                                |
| Gate 4: Verified Versions                   | PASS    | [SRC], [URL]        | Khớp `package.json:112,116,118,121` (Node `24.x`, Vitest `4.1.12`, Prettier `3.7.4`, TypeScript `5.9.3`); ASD-STE100 Issue 9 phát hành `2025-01-15` xác minh qua `asd-ste100.org`.                                                                                            |
| Gate 5: Files `[NEW]`/`[MODIFY]`/`[DELETE]` | PASS    | [SRC]               | Toàn bộ 8 tệp `[MODIFY]` tồn tại, 1 tệp `[NEW]` `.agents/rules/06-writing-style.md` nằm đúng tầng governance, không đụng `src/`.                                                                                                                                              |
| Gate 6: Test Contract & Co-Located Plan     | FAIL    | [SRC]               | `TC-STE-03` mâu thuẫn chính tả với §6.4 (`Scene beats` vs `Scene Beats`, `src/lib/utils/translations/en.ts:1472,1609`); `TC-STE-02` tự đúng trên `.agents/skills/add-translation/SKILL.md:43`.                                                                                |
| Gate 7: Risk Table & Controls               | FAIL    | [SRC]               | Rủi ro #1 chưa kiểm soát vỡ trần `17,000` dưới CRLF Windows; Rủi ro #4 bỏ sót trích sai số dòng ở §6.4 Hàng 16 & Hàng 22 (`src/lib/utils/translations/vi.ts:1384-1385`, `src/lib/utils/translations/en.ts:1375-1376`).                                                        |
| S1: Cold-start & Build                      | PASS    | [CMD], [SRC]        | `npm run type-check` exit `0`, `npm run lint` exit `0`, `npx vitest run` `147/147` PASS; `package.json:1-140` không thêm dependency hay biến `.env`.                                                                                                                          |
| S2: Runner Lifecycle & Teardown             | FAIL    | [SRC]               | Không có tài nguyên SSE/timer cần cleanup, nhưng `TC-STE-02` vi phạm tiêu chí chống test tự đúng (`.agents/agents/reviewer/mental-simulation.md:24`) do `.agents/skills/add-translation/SKILL.md:43` đã chứa `.agents/rules/04-bilingual.md`.                                 |
| S3: Database & Temporal Logic               | N/A     | N/A                 | Kế hoạch chỉ thay đổi tệp quy tắc `.agents/**`, test governance và `docs/**`, không chạm Supabase schema, migration hay logic thời gian.                                                                                                                                      |
| S4: Cross-Task State Flow                   | FAIL    | [SRC], [URL]        | Lệch hợp đồng dữ liệu giữa §6.4 (`Scene Beats`) với `TC-STE-03` (`Scene beats`) và giữa `globs: "docs/*.md, docs/**/*.md"` với hành vi khớp đường dẫn đầy đủ của Antigravity (`google.dev`).                                                                                  |
| S5: Security Boundary & 3-Tier Auth         | PASS    | [SRC], [CMD], [ADV] | Không chạm API/auth/`.env*`; tệp mới `.agents/rules/06-writing-style.md` được Gate 7 (`isGovernanceFile()` tại `.agents/scripts/code-freeze-guard.js:217-220,542-551`) khóa `ask` và kích hoạt `CRITIC_REQUIRED yes` (`scripts/verify-plan.mjs:209`).                         |
| S6: External Resilience & Serverless Cap    | N/A     | N/A                 | Không chạm nhà cung cấp AI ngoài, route API hay cấu hình `maxDuration`.                                                                                                                                                                                                       |
| Domain: Governance, Bilingual & Docs        | FAIL    | [SRC], [CMD]        | `TC-H` (`.agents/scripts/code-freeze-guard.test.ts:1919`) có nguy cơ thất bại trên Windows CRLF (`~17,100 > 17,000`) do tổng LF dự kiến `16,877` chỉ dư `123` ký tự; `verify-docs.mjs --strict-shorthand` pass `[1/5]..[4/5]` và fail `[5/5]` pre-existing (`126,892` bytes). |

#### 3. Adversarial Timelines & Commands Executed

- **Trục 1 — Đồng thời**: `N/A` (Thay đổi thuần tệp Markdown governance và unit test đồng bộ đọc file tĩnh, không có luồng ghi đồng thời runtime).
- **Trục 2 — Khoảng trống check→use (TOCTOU)**:
  - Cơ chế: Ngân sách `always_on` (`TC-H`) giữa thời điểm kiểm thử LF cục bộ và checkout Windows CRLF
    T1: Implementer sửa `.agents/rules/00-core.md` (`+526`) và `.agents/rules/02-quality.md` (`+72`), định dạng LF qua Prettier (`16,877 <= 17,000`) và pass Vitest | T2: Môi trường Windows khác `git clone` với `core.autocrlf=true` (do repo không có `.gitattributes`) hoặc editor ghi CRLF làm tăng `+223` ký tự `\r` trên 3 tệp `always_on` | T3: `.agents/scripts/code-freeze-guard.test.ts:1900-1919` đọc `content.length` thô và khớp `/^trigger:\s*always_on\s*$/m`
    Kết cục: `realTotal` đạt `~17,100 > 17,000`, làm hỏng `TC-H` trên Windows -> Lỗi (`[MAJOR]`)
  - Cơ chế: Bảo vệ Code Freeze Gate 7 trên tệp quy tắc mới `.agents/rules/06-writing-style.md`
    T1: Plan được phê duyệt `[PLAN_APPROVED]` với `[NEW] .agents/rules/06-writing-style.md` | T2: Agent thực thi thao tác ghi tệp quy tắc mới này | T3: `.agents/scripts/code-freeze-guard.js:543` đánh giá `isGovernanceFile()` ở Gate 7 trước khi xét Plan Scope Guard ở Gate 9 (`:559`)
    Kết cục: Trả `{ decision: "ask" }` yêu cầu người dùng xác nhận tường minh -> An toàn
- **Trục 3 — Thất bại giữa chừng & dọn dẹp**:
  - Cơ chế: Liên kết chéo giữa `.agents/README.md` và `.agents/rules/06-writing-style.md`
    T1: Tác vụ dừng giữa chừng sau khi cập nhật `.agents/README.md` trước khi tạo `06-writing-style.md` | T2: Chạy `node scripts/verify-docs.mjs --strict-shorthand` | T3: Bước `[1/5]` (`scripts/verify-docs.mjs:87-106`) báo broken link và trả exit `1`
    Kết cục: Kế hoạch đặt tạo `06-writing-style.md` ở Bước 1 trước cập nhật `.agents/README.md` ở Bước 5 -> An toàn
- **Trục 4 — Môi trường serverless**: `N/A` (Không tác động runtime Next.js App Router serverless hay bộ nhớ tiến trình server).

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-27-asd-ste100-writing-rules.md` ➔ exit `0` (`[PASS] SECTIONS 7/7`, `CRITIC_REQUIRED yes`, `0 failures, 0 warnings`)
  2. `npm run type-check` ➔ exit `0` (`tsc --noEmit` sạch)
  3. `npm run lint` ➔ exit `0` (`eslint .` sạch)
  4. `npx vitest run .agents/scripts/code-freeze-guard.test.ts scripts/verify-plan.test.ts --reporter=dot` ➔ exit `0` (`2 passed (2)`, `147 passed (147)`)
  5. `node scripts/verify-docs.mjs --strict-shorthand` ➔ exit `1` (`[1/5]..[4/5]` `PASS`; `[5/5]` `FAIL: CHANGELOG.md exceeds 35,000 bytes (126892 bytes)` pre-existing)
  6. `git status` ➔ exit `0` (chỉ có 1 file untracked `docs/plans/2026-11-27-asd-ste100-writing-rules.md`)
  7. `git log -n 5` ➔ exit `0` (xác nhận HEAD `71bb20fa`, governance ổn định từ `8f2a63c4`)

#### 4. Kết Luận

Còn 4 lỗi `[MAJOR]` có bằng chứng trực tiếp từ codebase và tài liệu 2026 (mâu thuẫn Test Contract `TC-STE-03` vs §6.4 + sai dòng dẫn chiếu `vi.ts`/`en.ts`, thiếu tiền tố `**/` trong `globs:` của `06-writing-style.md`, khẳng định tự đúng của `TC-STE-02` trên `add-translation/SKILL.md:43`, và biên ngân sách `always_on` không chịu được Windows CRLF dưới `TC-H <= 17,000`). Chuyển về `@planner` khắc phục triệt để trước khi thẩm định lại.

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-27-asd-ste100-writing-rules.md`:
  - Exit code: `0`
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ `LINE_REF` trong phần Technical Plan (bao gồm các dòng cập nhật `src/lib/utils/translations/en.ts:1472`, `:1475`, `:1675`, `:78`, `:84`, `:1373`, `src/lib/utils/translations/vi.ts:76`, `:82`, `.agents/scripts/command-policy.js:320-352`) đạt `PASS` (`0 failures, 0 warnings`)
  - `[INFO] CRITIC_REQUIRED yes (.agents/README.md, .agents/rules/00-core.md, .agents/rules/02-quality.md, .agents/rules/04-bilingual.md, .agents/rules/06-writing-style.md, .agents/scripts/code-freeze-guard.test.ts, .agents/skills/add-translation/SKILL.md)`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`

| # Lỗi Audit Run 1                                                                                      | Mức       | Trạng thái | Bằng chứng đối chiếu thực tế                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :----------------------------------------------------------------------------------------------------- | :-------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #1 Xung đột `TC-STE-03` vs §6.4 (`Scene beats` vs `Scene Beats`) & sai dòng dẫn chiếu Hàng 16, Hàng 22 | `[MAJOR]` | **ĐÃ SỬA** | `[SRC]` §6.4 Hàng 16, §6.6, §7 Bước 4 và §8 `TC-STE-03` đã đồng nhất nguyên văn `Scene Beats` khớp `src/lib/utils/translations/en.ts:1472`, `:1475`, `:1675` và `src/lib/utils/translations/vi.ts:1063`, `:1618`; Hàng 22 sửa đúng sang `src/lib/utils/translations/vi.ts:76`, `:82` (`"Máy cục bộ"`) và `src/lib/utils/translations/en.ts:78`, `:84`, `:1373` (`"Local"`).                                                                             |
| #2 `globs:` thiếu tiền tố `**/` cho Antigravity resolved-path matching                                 | `[MAJOR]` | **ĐÃ SỬA** | `[SRC]`, `[URL]` Đã đồng bộ `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"` trên §1, §3 (A3), §5, §6.5, §6.6, §7 (Bước 1 & Bước 5) và §8 `TC-STE-01`, khớp cặp mẫu nông/sâu của `.agents/rules/01-coding.md:3`, `.agents/rules/03-ui.md:3` và tài liệu Antigravity 2026 (`google.dev`).                                                                                                                                               |
| #3 Khẳng định tự đúng của `TC-STE-02` trên `.agents/skills/add-translation/SKILL.md:43`                | `[MAJOR]` | **ĐÃ SỬA** | `[SRC]` §6.6, §7 Bước 4b và §8 `TC-STE-02` đã khoanh vùng kiểm tra vào lát cắt sau `## Validation Checklist` (`.agents/skills/add-translation/SKILL.md:71-77`, hiện chưa chứa 3 chuỗi này) và khẳng định đồng thời `.agents/rules/04-bilingual.md`, `STE-lite` và `Fixed Bilingual UI Glossary`.                                                                                                                                                        |
| #4 Biên ngân sách `always_on` vỡ `TC-H` (`<= 17,000`) dưới Windows CRLF & lệch số học §6.2             | `[MAJOR]` | **ĐÃ SỬA** | `[SRC]` Đã đếm từng ký tự §6.2 (`113+1 + 93+1 + 199+1 = 408` LF / `411` CRLF, 3 dòng, trong dải `350–550`) và §6.3 (`63+1 = 64` LF / `65` CRLF, 1 dòng); tổng `always_on` đạt `16,279 + 472 = 16,751` LF (dư `249` dưới `17,000`) và `16,496 + 476 = 16,972` CRLF (dư `28` dưới `17,000`), thỏa cả `TC-H` (`.agents/scripts/code-freeze-guard.test.ts:1900-1919`) lẫn `TC-08` (`:1517-1531`) trên cả LF và Windows CRLF; §6.1 đã kê chính xác từng tệp. |
| #5 Làm rõ exit `1` của `verify-docs.mjs`, dòng trống heading §6.5 và `command-policy.js`               | `[MINOR]` | **ĐÃ SỬA** | `[SRC]`, `[CMD]` §9 Wiring Probe 1 dẫn đúng `.agents/scripts/command-policy.js:320-352` (`ask` với `npx prettier`); Wiring Probe 2 tách bạch `[1/5]..[4/5]` `PASS` và exit `1` chỉ do `[5/5]` (`scripts/verify-docs.mjs:272-274`); §6.5 đã thêm dòng trống sau các heading `## 1.`–`## 7.` khớp `.prettierrc:1-10`.                                                                                                                                     |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                           | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | :------------- | :------ | :---------------------------------------------------- | :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `.agents/rules/00-core.md:12`                         | [SRC]        | Trong §10 Rủi ro #5, câu trích dẫn mô tả vẫn ghi cụm cũ `"Not a [BLOCKER]; no 900-word EN dictionary or 20-word VI cap"` trong khi nội dung thực tế tại §6.2 chèn sau `.agents/rules/00-core.md:12` đã rút gọn thành ``Not `[BLOCKER]`; no 900-word EN dictionary / 20-word VI cap``. Không gây lỗi thực thi hay hỏng test vì §8 `TC-STE-02` kiểm tra theo token (`900-word`, `[BLOCKER]`); chỉ là góp ý đồng bộ văn bản nhỏ (không chặn duyệt).                                                                  |
| 2   | RISK_DISMISSED | [MINOR] | `.agents/scripts/code-freeze-guard.test.ts:1900-1919` | [SRC], [CMD] | Đã tái kiểm số học ký tự `always_on` trên cả LF và CRLF sau rút gọn: `00-core.md` (`4,436 + 408 = 4,844` LF / `4,918` CRLF) + `02-quality.md` (`5,465 + 64 = 5,529` LF / `5,615` CRLF) + `05-plan-review.md` (`6,378` LF / `6,439` CRLF) = `16,751` LF / `16,972` CRLF, đều `<= 17,000` (`TC-H`) và `< 18,000` (`TC-08` tại `:1517-1531`). Prettier giữ `proseWrap: "preserve"` mặc định (`.prettierrc:1-10`) nên không làm phình danh sách gạch đầu dòng trong `00-core.md` và `02-quality.md` (`not.toContain(" | :---")`tại`:1928`). Bác bỏ rủi ro tràn ngân sách ở cả Linux CI lẫn Windows CRLF. |
| 3   | RISK_DISMISSED | [MINOR] | `.agents/scripts/code-freeze-guard.test.ts:1546-1603` | [SRC], [CMD] | Đã đối chiếu Ma trận M5 (`:1546-1603`) và kiểm tra phần hướng dẫn `docs/plans/README.md` (`:1960-1975`): kế hoạch giữ nguyên toàn bộ nội dung hiện có của `00-core.md`, `02-quality.md`, `04-bilingual.md` (`src/lib/utils/translations/`), không sửa `01-coding.md`/`03-ui.md`/`05-plan-review.md`, và chỉ thêm dòng vào đầu bảng `## Ma Trận Kế Hoạch Triển Khai` của `docs/plans/README.md` (giữ nguyên phần hướng dẫn và mốc `2026-10-24`). Bác bỏ rủi ro hồi quy M5/TC-H.                                    |
| 4   | RISK_DISMISSED | [MINOR] | `.agents/scripts/code-freeze-guard.js:542-551`        | [SRC], [CMD] | Đã xác minh cơ chế bảo vệ đa tầng cho tệp mới `.agents/rules/06-writing-style.md` và 6 tệp `.agents/**` sửa đổi: Gate 7 (`isGovernanceFile()` tại `.agents/scripts/code-freeze-guard.js:217-220,542-551`) luôn yêu cầu `ask` kể cả khi `planApproved: true`; `scripts/verify-plan.mjs:206-242` xuất `CRITIC_REQUIRED yes` buộc qua Independent Critic Pass; `scripts/verify-docs.mjs:154-216` quét động toàn bộ `.agents/rules/*.md`. Bác bỏ rủi ro lọt chốt chặn governance.                                     |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                         | Kết quả | Bằng chứng          | Chi tiết                                                                                                                                                                                                                                                                                                     |
| :------------------------------------------ | :------ | :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate 1: Goal & Out of Scope                 | PASS    | [CMD]               | `node scripts/verify-plan.mjs` trả `[PASS] SECTIONS 7/7`; mục tiêu 3 tầng STE-lite và phạm vi loại trừ rõ ràng, không sửa dây chuyền `vi.ts`/`en.ts` hay tài liệu lịch sử.                                                                                                                                   |
| Gate 2: Pre-Work & Skills Loaded            | PASS    | [SRC]               | Ánh xạ đầy đủ các rule/skill kích hoạt từ `.agents/rules/02-quality.md:8-26` (`04-bilingual.md`, `add-translation/SKILL.md`, `05-plan-review.md`, `vikini-investigate`, `vikini-audit`).                                                                                                                     |
| Gate 3: Assumptions & Dependencies          | PASS    | [SRC], [URL]        | A1 xác minh ngân sách `always_on` cả LF (`16,751`) lẫn CRLF (`16,972 <= 17,000`); A3 áp dụng `globs: "docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md"` theo tài liệu Antigravity 2026 (`google.dev`) và `.agents/rules/01-coding.md:3`, `.agents/rules/03-ui.md:3`.                                  |
| Gate 4: Verified Versions                   | PASS    | [SRC], [URL]        | Khớp `package.json:112`, `:116`, `:118`, `:121` (Prettier `3.7.4`, TS `5.9.3`, Vitest `4.1.12`, Node `24.x`); ASD-STE100 Issue 9 (`2025-01-15`) xác minh qua `asd-ste100.org`.                                                                                                                               |
| Gate 5: Files `[NEW]`/`[MODIFY]`/`[DELETE]` | PASS    | [SRC]               | 1 `[NEW]` (`.agents/rules/06-writing-style.md`) + 8 `[MODIFY]` tồn tại, đúng ranh giới governance/docs, không đụng `src/`.                                                                                                                                                                                   |
| Gate 6: Test Contract & Co-Located Plan     | PASS    | [SRC]               | `TC-STE-01..TC-STE-04` + `TC-BUDGET` đầy đủ điều kiện biên và 3 Negative Probes; `TC-STE-02` khoanh vùng lát cắt sau `## Validation Checklist` (`.agents/skills/add-translation/SKILL.md:71-77`); `TC-STE-03` đồng nhất `Scene Beats` với §6.4 và `src/lib/utils/translations/en.ts:1472`, `:1475`, `:1675`. |
| Gate 7: Risk Table & Controls               | PASS    | [SRC]               | Tất cả 6 rủi ro Cao/Trung bình đều ánh xạ technical control có `[SRC]` và Negative Probe (`TC-08`, `TC-H`, `TC-STE-02..04`, `isGovernanceFile()`, `verify-docs.mjs`, `npx prettier --check`).                                                                                                                |
| S1: Cold-start & Build                      | PASS    | [CMD], [SRC]        | Baseline `npm run type-check` exit `0`, `npm run lint` exit `0`, `npx vitest run` `147/147` PASS; `package.json:1-140` không thêm dependency hay `.env`.                                                                                                                                                     |
| S2: Runner Lifecycle & Teardown             | PASS    | [SRC]               | Không có tài nguyên bất đồng bộ/SSE/timer cần cleanup; `TC-STE-02` đã loại bỏ khẳng định tự đúng trên `.agents/skills/add-translation/SKILL.md:43` bằng lát cắt sau `## Validation Checklist` (`:71-77`).                                                                                                    |
| S3: Database & Temporal Logic               | N/A     | N/A                 | Kế hoạch chỉ sửa tệp governance `.agents/**` và `docs/**`, không chạm Supabase schema, migration hay logic múi giờ.                                                                                                                                                                                          |
| S4: Cross-Task State Flow                   | PASS    | [SRC], [URL]        | Hợp đồng giữa §6.2–§6.5, §7, §8 và codebase (`src/lib/utils/translations/vi.ts`, `en.ts`, `.agents/rules/01-coding.md:3`, `.agents/rules/03-ui.md:3`, `.agents/scripts/code-freeze-guard.test.ts:1546-1603,1900-1975`) nhất quán; mẫu `globs:` khớp cả tương đối lẫn đường dẫn tuyệt đối của Antigravity.    |
| S5: Security Boundary & 3-Tier Auth         | PASS    | [SRC], [CMD], [ADV] | Không chạm API/auth/`.env*`; mọi tệp `.agents/**` bị khóa `ask` ở Gate 7 (`.agents/scripts/code-freeze-guard.js:217-220,542-551`) và `npx prettier` ngoài `.agents/scripts/command-policy.js:320-352` cũng yêu cầu `ask`; kích hoạt `CRITIC_REQUIRED yes` (`scripts/verify-plan.mjs:206-242`).               |
| S6: External Resilience & Serverless Cap    | N/A     | N/A                 | Không chạm dịch vụ AI bên ngoài, API route hay cấu hình `maxDuration`.                                                                                                                                                                                                                                       |
| Domain: Governance, Bilingual & Docs        | PASS    | [SRC], [CMD]        | Tổng `always_on` đạt `16,751` LF / `16,972` CRLF (`<= 17,000` ở `TC-H` và `< 18,000` ở `TC-08`); 22 cặp Glossary bám sát `vi.ts`/`en.ts`; Wiring Probe 2 xác định rõ `[1/5]..[4/5]` `PASS` và exit `1` chỉ do `[5/5]` `CHANGELOG.md` pre-existing (`scripts/verify-docs.mjs:272-274`).                       |

#### 3. Adversarial Timelines & Commands Executed

- **Trục 1 — Đồng thời**: `N/A` (Thay đổi thuần tệp Markdown governance và unit test đồng bộ đọc file tĩnh, không có trạng thái ghi đồng thời runtime).
- **Trục 2 — Khoảng trống check→use (TOCTOU)**:
  - Cơ chế: Ngân sách `always_on` (`TC-H`) giữa kiểm thử LF sau Prettier và checkout Windows CRLF (`core.autocrlf=true`)
    T1: Implementer áp dụng §6.2 (`+408` LF / `+411` CRLF) và §6.3 (`+64` LF / `+65` CRLF), chạy Prettier (`endOfLine: "lf"` tại `.prettierrc:9`) đạt `16,751 <= 17,000` | T2: Một máy Windows mới `git clone` với `core.autocrlf=true` chuyển `221` dòng sang CRLF (`+221` ký tự `\r`) | T3: `.agents/scripts/code-freeze-guard.test.ts:1900-1919` cộng `content.length` thô
    Kết cục: `realTotal = 16,972 <= 17,000` (dư `28` ký tự dưới `17,000` và `1,028` dưới `18,000`) -> An toàn
  - Cơ chế: Code Freeze Guard Gate 7 trên `.agents/rules/06-writing-style.md` và `npx prettier --check`
    T1: Plan đạt `[PLAN_APPROVED]` với `[NEW] .agents/rules/06-writing-style.md` | T2: Agent ghi tệp quy tắc mới hoặc chạy `npx prettier --check` | T3: `.agents/scripts/code-freeze-guard.js:543` đánh giá `isGovernanceFile()` (Gate 7) trước Plan Scope Guard (`:559`); `.agents/scripts/command-policy.js:320-352` không cho phép `npx prettier` tự động chạy
    Kết cục: Cả hai thao tác đều trả `{ decision: "ask" }` buộc User/PM phê duyệt tường minh -> An toàn
- **Trục 3 — Thất bại giữa chừng & dọn dẹp**:
  - Cơ chế: Thứ tự tạo `.agents/rules/06-writing-style.md` và cập nhật liên kết trong `.agents/README.md`
    T1: Quá trình triển khai dừng sau Bước 1 (`06-writing-style.md` đã tạo) trước Bước 5 (`.agents/README.md`) | T2: Chạy `node scripts/verify-docs.mjs --strict-shorthand` | T3: `[1/5]` (`scripts/verify-docs.mjs:87-106`) kiểm tra không có broken link, `[4/5]` (`:206-216`) kiểm tra `<= 12,000` ký tự
    Kết cục: Không phát sinh broken link hay tràn ngân sách dù dừng giữa chừng -> An toàn
- **Trục 4 — Môi trường serverless**: `N/A` (Không tác động runtime Next.js App Router serverless hay bộ nhớ tiến trình server).

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-27-asd-ste100-writing-rules.md` ➔ exit `0` (`[PASS] SECTIONS 7/7`, `CRITIC_REQUIRED yes`, `0 failures, 0 warnings`)
  2. `npx vitest run .agents/scripts/code-freeze-guard.test.ts scripts/verify-plan.test.ts --reporter=dot` ➔ exit `0` (`2 passed (2)`, `147 passed (147)`)
  3. Đối chiếu baseline từ lượt 1 (working tree không đổi mã nguồn): `npm run type-check` (exit `0`), `npm run lint` (exit `0`), `node scripts/verify-docs.mjs --strict-shorthand` (exit `1`, `[1/5]..[4/5]` `PASS`, `[5/5]` `CHANGELOG.md` `126,892` bytes pre-existing).

#### 4. Kết Luận

Toàn bộ 4 lỗi `[MAJOR]` và 1 lỗi `[MINOR]` từ Audit Run 1 đều đã được sửa đầy đủ và xác minh trực tiếp trên mã nguồn, không phát hiện lỗi `[BLOCKER]` hay `[MAJOR]` mới (chỉ còn 1 ghi chú `[MINOR]` không chặn duyệt về văn bản trích dẫn tại §10 Rủi ro #5). Do kế hoạch chạm 7 tệp quản trị dưới `.agents/**` (`CRITIC_REQUIRED yes`), chuyển trạng thái sang `- **Status**: Awaiting Critic` (giữ khóa repo fail-safe) chờ phiên `@reviewer` độc lập mới thực hiện **Independent Critic Pass** theo `.agents/rules/05-plan-review.md:37-39`.

[AWAITING_CRITIC]

---

### Audit Run 3 (Independent Critic Pass)

[REVIEWER_MODEL: gemini-4-argon (critic)]

CRITIC_VERDICT: AGREE

#### 1. Output verify-plan.mjs & Kiểm Chứng Độc Lập

- Output `node scripts/verify-plan.mjs docs/plans/2026-11-27-asd-ste100-writing-rules.md`:
  - Exit code: `0`
  - `[PASS] SECTIONS 7/7`
  - Toàn bộ `LINE_REF` trong `## Technical Plan` đạt `PASS` (`0 failures, 0 warnings`)
  - `[INFO] CRITIC_REQUIRED yes (.agents/README.md, .agents/rules/00-core.md, .agents/rules/02-quality.md, .agents/rules/04-bilingual.md, .agents/rules/06-writing-style.md, .agents/scripts/code-freeze-guard.test.ts, .agents/skills/add-translation/SKILL.md)`
  - `[PASS] CRITIC_FLOOR 4 findings with valid file:line`
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`
- Đã kiểm tra độc lập toàn bộ tệp codebase mục tiêu (`.agents/rules/00-core.md`, `01-coding.md`, `02-quality.md`, `03-ui.md`, `04-bilingual.md`, `05-plan-review.md`, `.agents/README.md`, `.agents/skills/add-translation/SKILL.md`, `.agents/scripts/code-freeze-guard.js`, `command-policy.js`, `plan-scope.js`, `code-freeze-guard.test.ts`, `scripts/verify-docs.mjs`, `scripts/verify-plan.mjs`, `scripts/verify-plan.test.ts`, `src/lib/utils/translations/{vi,en,index}.ts`, `docs/plans/README.md`, `docs/CHANGELOG.md`, `docs/architecture.md`, `docs/README.md`, `docs/lessons-learned.md`, `package.json`, `.prettierrc`, `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts`) cùng nguồn trực tuyến 2026 (ASD-STE100 Issue 9 & Google Antigravity Rules `trigger: glob`). Toàn bộ 4 lỗi `[MAJOR]` và 1 lỗi `[MINOR]` từ Audit Run 1 đã được xử lý triệt để, không phát hiện lỗi `[BLOCKER]` hay `[MAJOR]` mới.

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                      | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | :------------- | :------ | :----------------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MINOR] | `eslint.config.mjs:160`                          | [SRC]        | `eslint.config.mjs:160` loại trừ `.agents/**` khỏi phạm vi ESLint, nên `npm run lint` không kiểm tra `@typescript-eslint/no-explicit-any` hay `no-console` trên `.agents/scripts/code-freeze-guard.test.ts`. Tệp test vẫn được kiểm kiểu bởi `tsconfig.json:6,28` (`strict: true`, `**/*.ts` qua `npm run type-check`) và thực thi bởi `vitest.config.ts:11`; khi triển khai `TC-STE-01..04` cần tự rà không dùng `any`/`console.log` (không chặn duyệt).                                                                                                                                                                                                                                                                  |
| 2   | DEFECT         | [MINOR] | `.agents/scripts/code-freeze-guard.test.ts:1919` | [SRC]        | Sau khi chèn §6.2 (`113+1 + 93+1 + 199+1 = 408` LF / `411` CRLF) và §6.3 (`63+1 = 64` LF / `65` CRLF), tổng `always_on` đạt `16,751` LF (dư `249` ký tự) nhưng dưới Windows CRLF (`16,972`) chỉ còn biên dự phòng `28` ký tự trước ngưỡng `17,000` của `TC-H` (`.agents/scripts/code-freeze-guard.test.ts:1919`). Kế hoạch thỏa ngưỡng trên cả LF lẫn CRLF (có kiểm thử quy đổi CRLF trong `TC-BUDGET` và không dùng bảng Markdown gây phình do Prettier theo `.prettierrc:1-10` và `.agents/rules/05-plan-review.md:30-31`), song các lượt sửa `always_on` về sau cần cắt gọn nội dung cũ hoặc thêm `.gitattributes` cố định LF (không chặn duyệt).                                                                       |
| 3   | RISK_DISMISSED | [MINOR] | `.agents/scripts/code-freeze-guard.js:455-551`   | [SRC], [CMD] | Đã đối chiếu độc lập thứ tự đánh giá Gate 3–Gate 7 trong `.agents/scripts/code-freeze-guard.js:455-551`: tệp mới `.agents/rules/06-writing-style.md` không thuộc `UNFROZEN_PREFIXES` (`docs/`), không khớp `isTestFile` (Gate 4), `isSensitiveServerFile` (Gate 5) hay `isMigrationFile` (Gate 6), và đi tới Gate 7 (`isGovernanceFile()` tại `:217-220,543`) trả `ask` kèm `"governance file in .agents/"` khớp `NP-2` trong `TC-STE-04`. Bác bỏ rủi ro lệch nhánh bảo vệ Code Freeze.                                                                                                                                                                                                                                    |
| 4   | RISK_DISMISSED | [MINOR] | `src/lib/utils/translations/en.ts:1472`          | [SRC]        | Đã đối chiếu trực tiếp toàn bộ 22 hàng Glossary và 10 cặp đại diện của `TC-STE-03` trên `src/lib/utils/translations/vi.ts` và `en.ts` (như `Cuộc trò chuyện`/`Conversation` tại `vi.ts:966`/`en.ts:222`, `Kho kiến thức`/`Knowledge Base` tại `vi.ts:696`/`en.ts:684`, `Phân cảnh`/`Scene Beats` tại `vi.ts:1618`/`en.ts:1472,1475,1675`, `Thư viện`/`Gallery` tại `vi.ts:632`/`en.ts:620`, `Xếp hạng`/`Rank` tại `vi.ts:249`/`en.ts:237`) và parity tại `src/lib/utils/translations/index.ts:22-34`. Toàn bộ xuất hiện nguyên văn và không chứa mẫu khớp `bannedClaudeCliPatterns` (`.agents/scripts/code-freeze-guard.test.ts:1934-1940`). Bác bỏ rủi ro hỏng `TC-STE-03`.                                               |
| 5   | RISK_DISMISSED | [MINOR] | `.agents/scripts/plan-scope.js:170-212`          | [SRC], [CMD] | Đã kiểm chứng độc lập tương thích tên tệp plan, liên kết Markdown và các test neo số dòng: `2026-11-27-asd-ste100-writing-rules.md` khớp `^(\d{4}-\d{2}-\d{2})-` tại `.agents/scripts/plan-scope.js:181`; liên kết `./2026-11-27-asd-ste100-writing-rules.md` trong `docs/plans/README.md` và `./rules/06-writing-style.md` trong `.agents/README.md` hợp lệ dưới `scripts/verify-docs.mjs:46,87-98`; mọi đường dẫn mới dùng tiền tố `.agents/rules/...` hoặc `./rules/...` nên vượt qua `shorthandRegex` (`scripts/verify-docs.mjs:154-216`); và `TC-G5` (`.agents/scripts/code-freeze-guard.test.ts:1874-1895`) không neo số dòng vào `00-core.md` hay `02-quality.md`. Bác bỏ rủi ro hồi quy kiểm thử hoặc broken link. |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                         | Kết quả | Bằng chứng          | Chi tiết                                                                                                                                                                                                                                                                                                                                                 |
| :------------------------------------------ | :------ | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate 1: Goal & Out of Scope                 | PASS    | [CMD]               | `node scripts/verify-plan.mjs` trả `[PASS] SECTIONS 7/7`; phạm vi 3 tầng STE-lite và danh sách Out of Scope (không sửa dây chuyền `vi.ts`/`en.ts`, không archive `CHANGELOG.md`, không tạo hard-gate linter) tách bạch.                                                                                                                                  |
| Gate 2: Pre-Work & Skills Loaded            | PASS    | [SRC]               | Ánh xạ đầy đủ rule/skill bắt buộc theo `.agents/rules/02-quality.md:8-26` (`04-bilingual.md`, `add-translation/SKILL.md`, `05-plan-review.md`, `vikini-investigate`, `vikini-audit`).                                                                                                                                                                    |
| Gate 3: Assumptions & Dependencies          | PASS    | [SRC], [URL]        | Đã kiểm chứng độc lập ngân sách `always_on` (`16,751` LF / `16,972` CRLF `<= 17,000` tại `.agents/scripts/code-freeze-guard.test.ts:1919`), quy tắc glob `docs/*.md, docs/**/*.md, **/docs/*.md, **/docs/**/*.md` khớp `.agents/rules/01-coding.md:1-5`, `.agents/rules/03-ui.md:1-5` và tài liệu Antigravity 2026 (`antigravity.google`, `google.dev`). |
| Gate 4: Verified Versions                   | PASS    | [SRC], [URL]        | Đối chiếu `package.json:112,116,118,121` (Prettier `3.7.4`, TS `5.9.3`, Vitest `4.1.12`, Node `24.x`) và tra cứu độc lập ASD-STE100 Issue 9 phát hành `2025-01-15` (53 quy tắc / 9 phần / ~900 từ duyệt, `asd-ste100.org`).                                                                                                                              |
| Gate 5: Files `[NEW]`/`[MODIFY]`/`[DELETE]` | PASS    | [SRC]               | 1 `[NEW]` (`.agents/rules/06-writing-style.md`) + 8 `[MODIFY]` tồn tại thực tế, tách khỏi `src/`, không vi phạm kiến trúc 4 tầng.                                                                                                                                                                                                                        |
| Gate 6: Test Contract & Co-Located Plan     | PASS    | [SRC]               | `TC-STE-01..TC-STE-04` + `TC-BUDGET` đầy đủ điều kiện biên và 3 Negative Probes; `TC-STE-02` khoanh lát cắt sau `## Validation Checklist` (`.agents/skills/add-translation/SKILL.md:71-77`) chống tự đúng; `TC-STE-03` khớp nguyên văn `vi.ts`/`en.ts`.                                                                                                  |
| Gate 7: Risk Table & Controls               | PASS    | [SRC]               | Toàn bộ 6 rủi ro Cao/Trung bình gắn technical control thực tế (`code-freeze-guard.js:217-220,542-551`, `code-freeze-guard.test.ts:1517-1531,1900-1919`, `verify-docs.mjs:154-216`, `package.json:136-138`) và Negative Probes.                                                                                                                           |
| S1: Cold-start & Build                      | PASS    | [CMD], [SRC]        | `npm run type-check` exit `0`, `npm run lint` exit `0`, `npx vitest run` `147/147` PASS; `package.json` không thêm dependency hay biến `.env`; `tsconfig.json:6,28` kiểm kiểu trực tiếp `.agents/scripts/code-freeze-guard.test.ts`.                                                                                                                     |
| S2: Runner Lifecycle & Teardown             | PASS    | [SRC]               | Không phát sinh tài nguyên bất đồng bộ/SSE/timer/thư mục tạm; `TC-STE-02` đã cắt đúng vùng `## Validation Checklist` (`.agents/skills/add-translation/SKILL.md:71-77`) loại bỏ assertion tự đúng.                                                                                                                                                        |
| S3: Database & Temporal Logic               | N/A     | N/A                 | Kế hoạch chỉ sửa tệp governance `.agents/**` và `docs/**`, không chạm Supabase schema, migration, RLS hay logic thời gian.                                                                                                                                                                                                                               |
| S4: Cross-Task State Flow                   | PASS    | [SRC], [URL]        | Đã xác nhận nhất quán chéo giữa 5 tệp governance, `.agents/README.md`, `docs/plans/README.md`, `src/lib/utils/translations/{vi,en,index}.ts`, Ma trận M5 (`.agents/scripts/code-freeze-guard.test.ts:1546-1603`) và hành vi glob đường dẫn tuyệt đối của Antigravity (`google.dev`).                                                                     |
| S5: Security Boundary & 3-Tier Auth         | PASS    | [SRC], [CMD], [ADV] | Không chạm API/auth/`.env*`; Gate 7 (`.agents/scripts/code-freeze-guard.js:455-551`) khóa `ask` cho toàn bộ `.agents/**` (kể cả `06-writing-style.md` khi `planApproved: true`); `.agents/scripts/command-policy.js:320-352` giữ `npx prettier` ở mức `ask`; `scripts/verify-plan.mjs:206-242` cưỡng chế `CRITIC_REQUIRED yes`.                          |
| S6: External Resilience & Serverless Cap    | N/A     | N/A                 | Không chạm dịch vụ AI bên ngoài, API route hay cấu hình `maxDuration`.                                                                                                                                                                                                                                                                                   |
| Domain: Governance, Bilingual & Docs        | PASS    | [SRC], [CMD], [URL] | Ngân sách `always_on` đạt `16,751` LF / `16,972` CRLF (`<= 17,000` ở `TC-H` và `< 18,000` ở `TC-08`); mọi rule `<= 12,000`; Glossary khớp `vi.ts`/`en.ts`; `node scripts/verify-docs.mjs --strict-shorthand` xác nhận `[1/5]..[4/5]` `PASS` và `[5/5]` fail pre-existing `126,892 >= 35,000` bytes (`scripts/verify-docs.mjs:272-274`).                  |

#### 3. Adversarial Timelines & Commands Executed

- **Trục 1 — Đồng thời**: `N/A` (Thay đổi thuần tài liệu Markdown governance và unit test đọc file đồng bộ, không có trạng thái ghi đồng thời runtime).
- **Trục 2 — Khoảng trống check→use (TOCTOU)**:
  - Cơ chế: Ngân sách `always_on` (`TC-H`) giữa LF sau Prettier và Windows checkout `core.autocrlf=true`
    T1: Triển khai chèn §6.2 (`+408` LF) vào `.agents/rules/00-core.md` và §6.3 (`+64` LF) vào `.agents/rules/02-quality.md`, kiểm chứng `npx prettier --check` (`.prettierrc:9` `endOfLine: "lf"`) đạt `16,751 <= 17,000` | T2: Máy Windows khác checkout bằng `core.autocrlf=true` cộng thêm `221` ký tự `\r` trên 3 tệp `always_on` | T3: `.agents/scripts/code-freeze-guard.test.ts:1900-1919` cộng `content.length` thô
    Kết cục: `realTotal = 16,972 <= 17,000` (còn dư `28` ký tự) và `< 18,000` (`:1531`) -> An toàn
  - Cơ chế: Thứ tự Gate 3–Gate 7 trên tệp quy tắc mới `.agents/rules/06-writing-style.md` sau khi plan được duyệt
    T1: Plan chuyển sang `Status: Approved` + `[PLAN_APPROVED]` kèm `[NEW] .agents/rules/06-writing-style.md` | T2: Agent ghi vào `.agents/rules/06-writing-style.md` | T3: `.agents/scripts/code-freeze-guard.js:455-551` kiểm `UNFROZEN_PREFIXES` (`false`), Gate 4–6 (`false`), rồi dừng ở Gate 7 `isGovernanceFile()` (`:543`) trước Gate 9 Plan Scope Guard (`:559`)
    Kết cục: Trả `{ decision: "ask" }` kèm `"governance file in .agents/"` buộc người dùng xác nhận -> An toàn
- **Trục 3 — Thất bại giữa chừng & dọn dẹp**:
  - Cơ chế: Dừng giữa chừng giữa Bước 1 (tạo `06-writing-style.md`) và Bước 5 (cập nhật `.agents/README.md`)
    T1: Đã tạo `.agents/rules/06-writing-style.md` với `trigger: glob`, quá trình dừng trước khi sửa `.agents/README.md` | T2: Chạy `node scripts/verify-docs.mjs --strict-shorthand` và `npx vitest run .agents/scripts/code-freeze-guard.test.ts` | T3: `[1/5]` không phát sinh broken link, `[4/5]` và `TC-08`/`TC-H` giữ `always_on` không đổi
    Kết cục: Không làm hỏng pipeline kiểm chứng dù dừng giữa chừng -> An toàn
- **Trục 4 — Môi trường serverless**: `N/A` (Không tác động runtime Next.js App Router serverless hay bộ nhớ tiến trình server).

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-27-asd-ste100-writing-rules.md` ➔ exit `0` (`[PASS] SECTIONS 7/7`, `[PASS] CRITIC_FLOOR 4 findings with valid file:line`, `CRITIC_REQUIRED yes`, `VERIFY_PLAN: PASS (0 failures, 0 warnings)`)
  2. `npm run type-check` ➔ exit `0` (`tsc --noEmit` không lỗi)
  3. `npm run lint` ➔ exit `0` (`eslint .` không lỗi)
  4. `npx vitest run .agents/scripts/code-freeze-guard.test.ts scripts/verify-plan.test.ts --reporter=dot` ➔ exit `0` (`2 passed (2)`, `147 passed (147)`)
  5. `node scripts/verify-docs.mjs --strict-shorthand` ➔ exit `1` (`[1/5]` PASS 45 files, `[2/5]` PASS, `[3/5]` PASS, `[4/5]` PASS; `[5/5]` FAIL `CHANGELOG.md exceeds 35,000 bytes (126892 bytes)` pre-existing)
  6. `git status` ➔ exit `0` (working tree chỉ có `docs/plans/2026-11-27-asd-ste100-writing-rules.md` untracked)
  7. `git log -n 5` ➔ exit `0` (HEAD `71bb20fa`)

#### 4. Kết Luận

Kết quả phản biện độc lập **Independent Critic Pass**: `CRITIC_VERDICT: AGREE`. Không phát hiện lỗi `[BLOCKER]` hay `[MAJOR]` (chỉ ghi nhận 2 lưu ý `[MINOR]` về phạm vi ignore ESLint trên `.agents/**` và biên dự phòng `28` ký tự CRLF của `TC-H`). Đủ điều kiện mở khóa phê duyệt theo `.agents/agents/reviewer/agent.md` §8 và `.agents/rules/05-plan-review.md` §3.3.

[PLAN_APPROVED]
