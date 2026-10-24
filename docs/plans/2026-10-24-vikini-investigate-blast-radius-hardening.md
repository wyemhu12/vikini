# Kế Hoạch Triển Khai: Hardening Mode 4 `/blast-radius` trong `vikini-investigate` SKILL.md

- **Revision**: 1
- **Status**: Completed
- **Date**: 2026-10-24
- **Author**: Claude Code CLI (`[PLANNER_MODEL: claude-code-cli]`)

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope

**Mục tiêu**: Bổ sung 5 bước khảo sát (A–E) vào Mode 4 `/blast-radius` của `.agents/skills/vikini-investigate/SKILL.md` để loại bỏ các điểm mù hiện tại của quy trình "grep import site + call site" một bước, và mở rộng bảng Required Output với 2 cột `Tầng (1/2/3)` và `Cách tham chiếu`. Kèm 1 entry ngắn trong `docs/lessons-learned.md` và 1 entry trong `docs/CHANGELOG.md`.

Các điểm mù đã chứng minh bằng mã nguồn thật (xem §3):

- **Dynamic import**: `getSupabaseAdmin` được nạp qua `await import("@/lib/core/supabase.server")`, nên grep `from "@/lib/core/supabase.server"` không bắt được.
- **DI qua interface**: `upsertAssistantMessage` không được import ở đâu cả. Nó được truyền qua thuộc tính `ChatStreamParams["upsertAssistantMessage"]` tới 5 stream engine và `post-processing.ts`.
- **Alias / trùng tên**: `saveMessage` được import với alias `insertUserMessage` tại `chatStreamCore.ts:27`, nên grep `saveMessage(` bỏ sót call site `chatStreamCore.ts:156`.
- **Transitive callers**: thay đổi `saveMessage` lan qua `upsertMessage` → `handleChatStreamCore` → `POST /api/chat-stream`, nhưng quy trình hiện tại chỉ dừng ở tầng 1.
- **Mock sites**: các `route.test.ts` dùng `vi.mock("@/lib/features/chat/messages")` sẽ gãy khi chữ ký đổi, dù chúng không gọi hàm thật.

**Out of Scope (What We're NOT Doing)**:

- KHÔNG chạm `src/`, `package.json`, `tests/` hay bất kỳ dependency nào.
- KHÔNG sửa Mode 1/2/3 hay phần `Output Contract & Anti-Patterns` của SKILL.md.
- KHÔNG viết script tự động (ví dụ `blast-radius.mjs`). Quy trình vẫn thủ công và read-only (`grep_search`, `view_file`).
- KHÔNG sửa `.agents/rules/*.md` (02-quality.md đã trỏ đúng tới `/blast-radius` tại dòng 27).
- KHÔNG chạy blast-radius thật cho một thay đổi cụ thể. Các probe chỉ dùng để kiểm chứng rằng hướng dẫn mới bắt được các điểm mù.

### 2. Tài Liệu Cần Tham Chiếu & Skills Loaded & Applied

| File đã đọc                                    | Mục đích                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.agents/rules/00-core.md`                     | Ranh giới 4 tầng, cấm git mutating, Token Efficiency (locate before reading)                           |
| `.agents/rules/01-coding.md`                   | Co-located tests (không áp dụng: không có logic mới), quy ước đặt tên                                  |
| `.agents/rules/02-quality.md`                  | Pre-Work table dòng 27 (`Shared module change → /blast-radius`), Post-Change Checklist, PowerShell `;` |
| `.agents/rules/05-plan-review.md`              | §1 khóa `.agents/**` (danh mục (e)), cấu trúc `## Technical Plan` / `## Audit History`                 |
| `.agents/agents/reviewer/evidence-bar.md`      | §4.5.3 Negative Probe, §4.5.4 Risk Table Audit                                                         |
| `.agents/skills/vikini-investigate/SKILL.md`   | File mục tiêu (Mode 4 tại dòng 78–95)                                                                  |
| `docs/CHANGELOG.md`, `docs/lessons-learned.md` | Định dạng entry (newest-first; category `## API and Streaming`)                                        |

**Skills Loaded & Applied**:

| SKILL.md                                     | Quyết định kỹ thuật chịu ảnh hưởng                                                                                                                                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/vikini-investigate/SKILL.md` | (1) Giữ Hard Rule read-only (dòng 8). Các bước A–E chỉ dùng `grep_search`/`view_file`. (2) Giữ Output Contract `[SRC]` (dòng 100) cho mọi dòng trong bảng mới. (3) Áp dụng chính Mode 4 hiện tại khi khảo sát 3 symbol probe, và đó là cách phát hiện các điểm mù ở §1. |
| `.agents/skills/streaming-patterns/SKILL.md` | Không nạp. Task không sửa SSE logic, chỉ dùng `streaming/*.ts` làm dữ liệu probe.                                                                                                                                                                                       |

### 3. Assumptions & Cross-Task Dependencies

| #   | Giả định / Sự kiện                                                                                                                                                                                                                                                                                | Dẫn chứng                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Mode 4 hiện chỉ có 2 bước (grep import/call site + tìm co-located tests) và bảng 4 cột                                                                                                                                                                                                            | `[SRC] .agents/skills/vikini-investigate/SKILL.md:82-94`                                                                                                                                                                                  |
| A2  | `getSupabaseAdmin` được nạp qua dynamic import tại attachment processor và deep-research stream                                                                                                                                                                                                   | `[SRC] src/app/api/chat-stream/attachmentProcessor.ts:139`; `[SRC] src/app/api/deep-research/[taskId]/stream/route.ts:143,174`                                                                                                            |
| A3  | `upsertAssistantMessage` được định nghĩa cục bộ (không export) tại `chatStreamCore.ts:237`, gói `upsertMessage` (`:254`), và được tiêm vào `sharedParams` tại `:290`                                                                                                                              | `[SRC] src/app/api/chat-stream/chatStreamCore.ts:237,254,290`                                                                                                                                                                             |
| A4  | Kiểu của thuộc tính được khai báo trong `interface ChatStreamParams`                                                                                                                                                                                                                              | `[SRC] src/app/api/chat-stream/streaming/types.ts:113,176-182`                                                                                                                                                                            |
| A5  | 5 stream engine + post-processing tiêu thụ thuộc tính qua `ChatStreamParams["upsertAssistantMessage"]` hoặc `createChatReadableStream(params: ChatStreamParams)`                                                                                                                                  | `[SRC] gemini-stream.ts:700,722,760`; `openai-stream.ts:35,100`; `deepseek-stream.ts:42,106`; `anthropic-stream.ts:48,84`; `strata-stream.ts:58,274`; `post-processing.ts:136,199,237` (tất cả dưới `src/app/api/chat-stream/streaming/`) |
| A6  | `saveMessage` (`messages.ts:121`) có caller nội bộ `upsertMessage` (`messages.ts:283`), và bị alias thành `insertUserMessage` tại `chatStreamCore.ts:27`, được gọi tại `:156`                                                                                                                     | `[SRC] src/lib/features/chat/messages.ts:121,197,283`; `[SRC] src/app/api/chat-stream/chatStreamCore.ts:27,156`                                                                                                                           |
| A7  | Chuỗi tầng 2–3: `handleChatStreamCore` (`chatStreamCore.ts:61`) ← `POST /api/chat-stream` (`route.ts:37,100`); `upsertMessage` ← `POST /api/messages` (`route.ts:50,79`)                                                                                                                          | `[SRC] src/app/api/chat-stream/route.ts:37,100`; `[SRC] src/app/api/messages/route.ts:50,79`                                                                                                                                              |
| A8  | Mock sites: `src/app/api/chat-stream/route.test.ts:23` mock `handleChatStreamCore`; `src/app/api/messages/route.test.ts:10` mock `upsertMessage`; `edit-image{,-multi}`, `generate-image` `route.test.ts` mock `saveMessage`. Có 24 file `vi.mock` trỏ tới `chat/messages` hoặc `supabase.server` | `[CMD] grep_search 'vi\.mock\("@/lib/(features/chat/messages\|core/supabase\.server)"' src` → 24 files                                                                                                                                    |
| A9  | `.agents/**` thuộc danh mục file nhạy cảm luôn bị khóa (`ask`) kể cả khi đã có `[PLAN_APPROVED]`. Implementer phải chấp nhận prompt khi sửa SKILL.md                                                                                                                                              | `[SRC] .agents/scripts/code-freeze-guard.js:376-383,659-663`; `[SRC] .agents/rules/05-plan-review.md:15`                                                                                                                                  |
| A10 | Skill files không có giới hạn ký tự Governance (chỉ `rules/*.md` ≤ 12,000 và `agents/*/agent.md` ≤ 10,000). Vẫn giữ diff ~15–30 dòng theo brief                                                                                                                                                   | `[SRC] .agents/rules/02-quality.md:86-89`                                                                                                                                                                                                 |

**Cross-Task Dependencies**: Không có. Plan `2026-10-24-refactor-chat-stream-save-message-naming.md` đã hoàn tất (CHANGELOG `docs/CHANGELOG.md:29-35`), và tên `insertUserMessage`/`upsertAssistantMessage` mà các probe dùng đến từ refactor đó.

**[NEEDS_PRODUCT_DECISION]**: Không có.

### 4. Bảng Verified Versions

| Công cụ                         | Phiên bản (`package.json`)           | Ghi chú tài liệu 2026                                                                                                                           |
| ------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest (`vi.mock`, `vi.mocked`) | `^4.1.12` (`[SRC] package.json:117`) | `vi.mock` được hoist và nhận cả Vite alias trong path, nên bước E phải grep cả dạng `@/lib/...` lẫn relative. `[URL] https://vitest.dev/api/vi` |
| TypeScript                      | `^5.9.3` (`[SRC] package.json:115`)  | Indexed access type `Interface["prop"]` là cơ chế mà bước B lần theo. Không đổi gì.                                                             |
| Next.js                         | `^16.4.0` (`[SRC] package.json:64`)  | Điểm dừng của bước C: `route.ts` (`export async function POST`) và `page.tsx`. Không đổi gì.                                                    |
| Dynamic `import()` (ECMAScript) | n/a                                  | `[URL] https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import`                                                      |

Không thêm hay nâng cấp dependency nào.

### 5. Files Cần Chỉnh Sửa / Tạo Mới

| Loại       | File                                         | Thay đổi                                                                                            |
| ---------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `[MODIFY]` | `.agents/skills/vikini-investigate/SKILL.md` | Thay khối Mode 4 `### Procedure` + `### Required Output` (dòng 82–94). Thêm khoảng 15–25 dòng ròng. |
| `[MODIFY]` | `docs/lessons-learned.md`                    | Thêm 1 entry (4 bullet) dưới `## API and Streaming`                                                 |
| `[MODIFY]` | `docs/CHANGELOG.md`                          | Thêm 1 entry `## 2026-10-24: Governance -- ...` ở đầu danh sách (trên dòng 11)                      |

Không có `[NEW]` / `[DELETE]`.

### 6. Caller-First Design Sketch

"Caller" ở đây là agent (Planner/Reviewer/Implementer) thực thi `/blast-radius`. Nội dung đích dự kiến cho Mode 4 (thay dòng 82–94):

```markdown
### Procedure

1. **Static imports**: `grep_search` across `src/` and `tests/` for import sites and call sites of the target symbol (`@/lib/...` aliases and relative imports).
2. **(A) Dynamic imports**: Grep `import\(["'][^"']*<module-tail>["']\)` (alias + relative) and `const \{[^}]*<symbol>` near `await import(`. Probe: `getSupabaseAdmin` → `src/app/api/chat-stream/attachmentProcessor.ts:139`, `src/app/api/deep-research/[taskId]/stream/route.ts:143,174`.
3. **(B) DI / interface properties**: If the symbol is passed as a parameter or assigned to an object property, find the owning interface/type and grep `<Interface>\["<prop>"\]` plus `<prop>` destructuring. Probe: `upsertAssistantMessage` (`chatStreamCore.ts:237,290`) → `ChatStreamParams` (`streaming/types.ts:176`) → gemini, openai, deepseek, anthropic, strata streams + `post-processing.ts`.
4. **(C) Transitive callers (max 3 tiers)**: Repeat steps 1–3 for each caller's enclosing exported function. Stop at `route.ts`, `page.tsx`, a `*.tsx` component, or tier 3.
5. **(D) Same-name disambiguation**: Open each hit and confirm it resolves to the target module. Discard shadowed locals and unrelated object properties, and grep `<symbol> as ` for import aliases. Probe: `saveMessage as insertUserMessage` (`chatStreamCore.ts:27`) → call at `:156`.
6. **(E) Mocked tests**: Grep `vi\.mock\(["'][^"']*<module-tail>["']` and `vi\.mocked\(<symbol>\)`. Mock factories break on signature or shape changes even without real calls.
7. **Co-located tests**: Locate all `*.test.ts(x)` covering the module and every tier-1–3 caller.

### Required Output

| Caller | `file:line` | Tầng (1/2/3) | Cách tham chiếu (static import / dynamic import / qua interface / mock) | Usage Pattern | Compatible? (`Yes` / `No` + Reason) |
| ------ | ----------- | ------------ | ----------------------------------------------------------------------- | ------------- | ----------------------------------- |

- **Co-Located Tests Affected**: every `*.test.ts` from steps 6–7, including mock-only files.
- **Migration Rule**: unchanged (any `No` row ⇒ explicit migration steps).
```

Ví dụ hàng đầu ra (dùng làm acceptance fixture cho probe `saveMessage`):

| Caller                      | `file:line`                | Tầng | Cách tham chiếu                           |
| --------------------------- | -------------------------- | ---- | ----------------------------------------- |
| `upsertMessage`             | `messages.ts:283`          | 1    | static (same module)                      |
| `handleChatStreamCore`      | `chatStreamCore.ts:156`    | 1    | static import (alias `insertUserMessage`) |
| `handleChatStreamCore`      | `chatStreamCore.ts:254`    | 2    | static import (`upsertMessage`)           |
| `POST /api/messages`        | `messages/route.ts:79`     | 2    | static import (`upsertMessage`)           |
| `POST /api/chat-stream`     | `chat-stream/route.ts:100` | 2→3  | static import (`handleChatStreamCore`)    |
| `messages/route.test.ts`    | `:10`                      | 2    | mock                                      |
| `chat-stream/route.test.ts` | `:23`                      | 3    | mock                                      |

### 7. Các Bước Thực Hiện Tuần Tự

- [ ] **S1**: Chờ `[PLAN_APPROVED]` + `Status: Approved`. Sửa SKILL.md sẽ kích hoạt prompt `ask` của `code-freeze-guard.js` (danh mục `.agents/**`), và Implementer xác nhận khi được hỏi.
- [ ] **S2**: Dùng `edit_file`/`Edit` thay khối `.agents/skills/vikini-investigate/SKILL.md:82-94` bằng nội dung §6. Giữ nguyên dòng 78–80 (tiêu đề + câu MANDATORY) và mọi thứ từ dòng 96 trở đi.
- [ ] **S3**: Tự kiểm tra diff: `git diff --stat -- .agents/skills/vikini-investigate/SKILL.md` phải cho ròng `+15..+30` dòng, và không có thay đổi ngoài Mode 4 (`git diff -U0` chỉ hiện hunk trong khoảng dòng 82–120).
- [ ] **S4**: Thêm entry `docs/lessons-learned.md` dưới `## API and Streaming` với tiêu đề `### 2026-10-24: Single-pass grep misses dynamic imports, DI properties, aliases and mocks in blast-radius`. Gồm 4 bullet Symptom / Root Cause / Fix / Prevention, mỗi bullet 1 dòng, trỏ về Mode 4 bước A–E.
- [ ] **S5**: Thêm entry `docs/CHANGELOG.md` ngay dưới dòng `---` thứ nhất (trước dòng 11): `## 2026-10-24: Governance -- Hardening Mode 4 /blast-radius (vikini-investigate)` với 1–2 bullet mô tả bước A–E và 2 cột mới.
- [ ] **S6**: Chạy Verification Plan §9 (probes + baseline). Dán output `[CMD]` vào báo cáo hoàn tất.
- [ ] **S7**: Đổi Header plan sang `- **Status**: Completed`.

### 8. Test Contract

Task chỉ sửa tài liệu Markdown và không có logic runtime, nên **không có unit test mới**. Hợp đồng kiểm thử là tập probe có thể tái lập mà `@qa` chạy độc lập:

| ID  | Input (thao tác)                                                          | Expected Output (PASS)                                                                                                                                                                                                 | Failure mode (FAIL)                                         |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| T1  | SKILL.md Mode 4 chứa 7 bước đánh số, trong đó 5 bước gắn nhãn `(A)`…`(E)` | `grep_search '\*\*\((A\|B\|C\|D\|E)\)' SKILL.md` → đúng 5 dòng                                                                                                                                                         | < 5 hoặc > 5 nhãn                                           |
| T2  | Header bảng Required Output                                               | Chứa literal `Tầng (1/2/3)` và `Cách tham chiếu (static import / dynamic import / qua interface / mock)`                                                                                                               | Thiếu cột hoặc sai bộ giá trị                               |
| T3  | Probe A: theo bước A với `supabase.server`                                | Bắt được đúng `attachmentProcessor.ts:139`, `deep-research/[taskId]/stream/route.ts:143` và `:174`                                                                                                                     | Thiếu bất kỳ dòng nào                                       |
| T4  | Probe B: theo bước B với `upsertAssistantMessage`                         | Liệt kê `types.ts:176` + 6 consumer (`gemini`, `openai`, `deepseek`, `anthropic`, `strata`, `post-processing`)                                                                                                         | < 6 consumer                                                |
| T5  | Probe C+D+E: `saveMessage`                                                | Có `chatStreamCore.ts:156` (alias), `messages.ts:283`, tầng 2 `messages/route.ts:79` + `chatStreamCore.ts:254`, tầng 3 `chat-stream/route.ts:100`, và mock `messages/route.test.ts:10`, `chat-stream/route.test.ts:23` | Thiếu alias site hoặc thiếu bất kỳ route/test tầng 2–3 nào  |
| T6  | Scope guard                                                               | `git diff --name-only` chỉ gồm 3 file §5 (+ plan file, + `run-claude.ps1` đã M sẵn trước task)                                                                                                                         | Có bất kỳ file `src/`, `package.json`, `.agents/rules/` nào |
| T7  | Kích thước                                                                | `git diff --numstat -- .agents/skills/vikini-investigate/SKILL.md` → added − deleted ∈ [15, 30]                                                                                                                        | Ngoài khoảng                                                |

**Boundary conditions**: (a) Bước C phải dừng ở tầng 3 dù chuỗi còn tiếp. (b) Bước D phải loại bỏ match là thuộc tính object không liên quan, ví dụ `saveMessage: vi.fn()` trong test mock không phải call site thật mà phải được phân loại `mock`. (c) Path chứa `[taskId]` phải được trích dẫn nguyên văn.

**Chống specification gaming**: Các probe phải được chạy bằng grep thật trên HEAD. Không được chép kết quả từ plan này. Nếu số dòng trong `src/` thay đổi trước khi thực thi, cập nhật số dòng theo `[CMD]` mới nhưng tập file phải khớp.

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

**Co-located tests**: Không áp dụng vì không có logic mới trong `src/lib/core/`, `src/lib/features/` hay `.agents/scripts/`.

**Baseline (Tier 2 không đổi)** (PowerShell, dùng `;`):

```powershell
npm run type-check; npm run lint; npm run test:run
```

Kỳ vọng: kết quả giống hệt trước task, vì không có file TS/JS nào bị sửa.

**Wiring Probes** (chứng minh hướng dẫn mới trỏ đúng mã thật):

```powershell
rg -n 'import\(["''][^"'']*supabase\.server["'']\)' src/app/api/chat-stream/attachmentProcessor.ts "src/app/api/deep-research/[taskId]/stream/route.ts"   # expect :139, :143, :174
rg -n 'ChatStreamParams\["upsertAssistantMessage"\]|params: ChatStreamParams' src/app/api/chat-stream/streaming   # expect 6 files
rg -n 'saveMessage as ' src   # expect chatStreamCore.ts:27
rg -n 'vi\.mock\(["'']@/lib/features/chat/messages["'']|handleChatStreamCore: vi\.fn' src/app/api/messages/route.test.ts src/app/api/chat-stream/route.test.ts
```

**Negative Probes** (§4.5.3: chứng minh quy trình cũ bỏ sót, quy trình mới bắt được):

| Probe | Lệnh (quy trình CŨ, chỉ static import)                                                     | Kết quả mong đợi CŨ                       | Bước mới bắt được |
| ----- | ------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------------- |
| N1    | `rg -n 'from "@/lib/core/supabase.server"' src/app/api/chat-stream/attachmentProcessor.ts` | 0 dòng (bỏ sót :139)                      | A                 |
| N2    | `rg -n 'import .*upsertAssistantMessage' src`                                              | 0 dòng (symbol không bao giờ được import) | B                 |
| N3    | `rg -n '\bsaveMessage\(' src/app/api/chat-stream/chatStreamCore.ts`                        | 0 dòng (bỏ sót call :156)                 | D                 |
| N4    | `rg -n '\bsaveMessage\b' src/app/api/chat-stream/route.ts src/app/api/messages/route.ts`   | 0 dòng (route tầng 2–3 vô hình)           | C                 |

PASS khi N1–N4 cho 0 dòng VÀ Wiring Probes tương ứng trả đúng các dòng đã liệt kê. Nếu N1–N4 trả > 0 dòng thì tiền đề của task sai, cần dừng lại và báo Reviewer.

**Scope probe**: `git diff --name-only -- src package.json .agents/rules` phải rỗng.

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

| Rủi ro                                                                        | Mức        | Control / Kiểm chứng                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementer vô tình sửa file ngoài phạm vi (`src/`, rules)                    | Trung bình | `[SRC] .agents/scripts/code-freeze-guard.js:376-383,659-663` (`.agents/**` luôn `ask`) + Code Freeze cho `src/**`; Scope probe `git diff --name-only -- src package.json .agents/rules` rỗng (T6) |
| Hướng dẫn mới có regex sai, không bắt được điểm mù (false negative)           | Trung bình | Wiring Probes + Negative Probes N1–N4 (§9) chạy trên mã thật; T3–T5 đối chiếu từng `file:line`                                                                                                    |
| SKILL.md phình to, tăng token cho mọi lần nạp skill                           | Trung bình | T7: `git diff --numstat` ròng ∈ [15, 30]; bảng Required Output giữ một header duy nhất, không thêm ví dụ dài vào SKILL.md (ví dụ chỉ nằm trong plan)                                              |
| Bước C bùng nổ số caller (fan-out lớn với symbol core như `getSupabaseAdmin`) | Thấp       | Giới hạn cứng 3 tầng + điểm dừng `route.ts`/`page.tsx`/component; hướng dẫn cho phép dùng Parallel Subagent của Mode 1 (`SKILL.md:21`)                                                            |
| Số dòng `src/` trôi trước khi thực thi làm probe lệch                         | Thấp       | Test Contract cho phép cập nhật số dòng theo `[CMD]` mới, miễn tập file khớp                                                                                                                      |
| Trích dẫn path có `[taskId]` bị shell glob hiểu sai                           | Thấp       | Probe đặt path trong dấu ngoặc kép (§9)                                                                                                                                                           |

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

- **Date**: 2026-10-24
- **Reviewer**: Primary Lead Reviewer (`@reviewer`)
- **Status**: Approved

#### 1. Kiểm Chứng Lỗi Cũ

| Mã Lỗi | Mô Tả                                                             | Trạng Thái | Dẫn Chứng Kiểm Tra (`[SRC]` / `[CMD]`) |
| :----- | :---------------------------------------------------------------- | :--------- | :------------------------------------- |
| N/A    | Không có lỗi từ run trước (Audit Run 1 là lượt đánh giá đầu tiên) | ĐÃ SỬA     | Không áp dụng                          |

#### 2. Phát Hiện Mới

Không phát hiện lỗi mới thuộc các phân loại `[BLOCKER]`, `[MAJOR]`, hay `[MINOR]`. Kế hoạch định nghĩa rõ phạm vi read-only, khống chế blast radius, có đầy đủ wiring probes và negative probes dựa trên mã nguồn thực tế.

#### 3. Các Tấn Công Đã Thử (Attack Probes)

1. **Probe 1: Kiểm tra rủi ro false negative của regex dynamic import**
   - _Kịch bản_: Thử nghiệm xem cú pháp regex `import\(["'][^"']*<module-tail>["']\)` ở bước A (§6 dòng 97) có bỏ sót các dạng import đường dẫn tương đối (relative path) hoặc ngắt dòng không.
   - _Kết quả_: Thử nghiệm trên mã nguồn thật cho thấy các vị trí dynamic import trong dự án (`src/app/api/chat-stream/attachmentProcessor.ts:139`, `src/app/api/deep-research/[taskId]/stream/route.ts:143,174`) đều sử dụng dạng inline `await import("@/lib/core/supabase.server")`. Biểu thức `[^"']*` khớp an toàn với mọi ký tự nằm giữa dấu ngoặc kép, bao gồm cả `./` hay `../`. Không làm vỡ regex.
   - _Dẫn chứng_: `[SRC] src/app/api/chat-stream/attachmentProcessor.ts:139`; `[SRC] src/app/api/deep-research/[taskId]/stream/route.ts:143,174`.

2. **Probe 2: Kiểm tra nguy cơ bùng nổ fan-out không giới hạn ở bước C (Transitive Callers)**
   - _Kịch bản_: Thử nghiệm khả năng lan truyền vô hạn khi áp dụng Mode 4 cho các symbol tầng core có lượng caller lớn như `getSupabaseAdmin`.
   - _Kết quả_: Kế hoạch đã thiết lập 2 cơ chế dừng tường minh: dừng tại trần tối đa 3 tầng (`max 3 tiers`) và dừng ngay khi gặp file đích (`route.ts`, `page.tsx`, hoặc component `*.tsx`). Đồng thời hướng dẫn cho phép sử dụng Subagent song song của Mode 1 khi trace mở rộng. Nguy cơ bùng nổ fan-out được kiểm soát.
   - _Dẫn chứng_: `[SRC] docs/plans/2026-10-24-vikini-investigate-blast-radius-hardening.md:99,194`.

3. **Probe 3: Kiểm tra nguy cơ xung đột chốt chặn Code Freeze Guard khi sửa SKILL.md**
   - _Kịch bản_: Kiểm tra xem việc sửa đổi `.agents/skills/vikini-investigate/SKILL.md` có bị `code-freeze-guard.js` chặn cứng (`block`) gây ách tắc tiến trình hay không.
   - _Kết quả_: Kiểm tra trực tiếp mã nguồn `code-freeze-guard.js` xác nhận hàm `isGovernanceFile` phân loại đường dẫn `.agents/**` vào danh mục hỏi tương tác (`ask`), không phải chặn cứng (`block`). Bước S1 (§7) và mục Rủi ro (§10) của kế hoạch đã chuẩn bị chỉ dẫn cho Implementer xác nhận prompt tương tác khi được hỏi. Quy trình thực thi không bị gián đoạn.
   - _Dẫn chứng_: `[SRC] .agents/scripts/code-freeze-guard.js:381-383,659-663`.

4. **Probe 4: Kiểm tra nguy cơ phá vỡ tương thích dữ liệu đầu ra bảng Required Output**
   - _Kịch bản_: Kiểm tra xem việc bổ sung 2 cột `Tầng (1/2/3)` và `Cách tham chiếu` vào bảng Required Output có làm hỏng bất kỳ công cụ hoặc script tự động nào đang parse kết quả `/blast-radius` hay không.
   - _Kết quả_: Khảo sát codebase xác nhận không có script hay parser tự động nào tiêu thụ bảng này. Tài liệu `.agents/rules/02-quality.md:27` chỉ trích dẫn `/blast-radius` như một workflow định hướng cho agent. Việc bổ sung 2 cột tăng cường độ tường minh phân định giữa direct/transitive callers và mock tests mà không gây tác dụng phụ.
   - _Dẫn chứng_: `[SRC] .agents/rules/02-quality.md:27`.

#### 4. Plan Completeness Gate & Mental Simulation Matrix

##### Plan Completeness Gate (7 Hạng Mục Bắt Buộc)

| Hạng Mục                    | Kết Quả | Loại Bằng Chứng  | Chi Tiết Đánh Giá                                                                                                                                                           |
| :-------------------------- | :------ | :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Bảng Verified Versions   | PASS    | `[SRC]`, `[URL]` | Vitest `^4.1.12` (`package.json:117`), TypeScript `^5.9.3` (`package.json:115`), Next.js `^16.4.0` (`package.json:64`), dynamic `import()`. Không bổ sung dependency ngoài. |
| 2. Checklist Tuần Tự        | PASS    | `[SRC]`          | Gồm 7 bước tuần tự S1–S7 với phân định nhãn `[MODIFY]` cho 3 files tại §5.                                                                                                  |
| 3. Kế Hoạch Kiểm Thử        | PASS    | `[CMD]`, `[SRC]` | Baseline Tier 2 (`npm run type-check; npm run lint; npm run test:run`), 4 Wiring Probes, 4 Negative Probes N1–N4, và Scope probe `git diff --name-only`.                    |
| 4. Test Contract            | PASS    | `[SRC]`          | Định nghĩa cụ thể từ T1–T7 (Input, Expected Output, Failure Mode, Boundary Conditions, Anti-gaming rules).                                                                  |
| 5. Assumptions & Cross-Task | PASS    | `[SRC]`          | Giả định A1–A10 kèm trích dẫn chính xác dòng code thật trên HEAD. Không có xung đột cross-task.                                                                             |
| 6. Out of Scope             | PASS    | `[SRC]`          | Định nghĩa 5 ranh giới không làm rõ ràng (§1): không chạm `src/`, không sửa Mode 1/2/3, không viết automation script.                                                       |
| 7. Skills Loaded & Applied  | PASS    | `[SRC]`          | Nạp và ánh xạ các quy tắc cốt lõi của `.agents/skills/vikini-investigate/SKILL.md` (giữ nguyên Hard Rule read-only và Output Contract `[SRC]`).                             |

##### Mental Simulation Matrix (S1–S6 + Domain)

| Kịch Bản                             | Kết Quả | Loại Bằng Chứng | Chi Tiết Đánh Giá                                                                                                                             |
| :----------------------------------- | :------ | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| S1: Cold-start & Build               | PASS    | `[CMD]`         | `npm run type-check` đạt exit code 0 (`[CMD]`). Không có dependency mới hay thay đổi cấu hình runtime.                                        |
| S2: Runner Lifecycle & Teardown      | PASS    | `[SRC]`         | Task chỉ sửa tài liệu và kỹ năng điều tra; không tạo ra socket, stream, timer hay tài nguyên rò rỉ (`SKILL.md:8`).                            |
| S3: Database & Temporal Logic        | PASS    | N/A             | Không tạo hoặc sửa bảng DB, RLS policy hay logic thời gian.                                                                                   |
| S4: Cross-Task State Flow            | PASS    | `[SRC]`         | Khảo sát trực tiếp các symbol từ task hoàn tất gần nhất (`insertUserMessage`, `upsertAssistantMessage`), đối soát khớp với code thực tế.      |
| S5: Security Boundary & 3-Tier Auth  | PASS    | `[SRC]`         | Duy trì quy tắc Hard Rule strictly read-only của kỹ năng; bảo vệ file nhạy cảm `.agents/**` qua cơ chế `ask` của `code-freeze-guard.js`.      |
| S6: External Resilience & Serverless | PASS    | N/A             | Không gọi API ngoài, không sửa các API route serverless.                                                                                      |
| Domain: Open Inquiry                 | PASS    | `[SRC]`         | Loại bỏ 5 điểm mù thực tế trong quy trình blast-radius của Vikini. Tôn trọng ngân sách dòng (diff ròng +15 đến +30 dòng) và quy tắc song ngữ. |

#### 5. Adversarial Timelines & Commands Executed

##### Adversarial Timelines (4 Trục)

- **Trục 1 (Đồng thời)**: `N/A`. Task là chỉnh sửa tài liệu nội bộ (SKILL.md, lessons-learned, changelog), không có luồng thực thi đồng thời hoặc race condition ở tầng ứng dụng.
- **Trục 2 (TOCTOU)**: `N/A`. Kỹ năng `vikini-investigate` hoạt động theo chế độ read-only thuần túy (`grep_search`, `view_file`), không có logic kiểm tra điều kiện rồi sửa đổi trạng thái.
- **Trục 3 (Thất bại giữa chừng & dọn dẹp)**: `N/A`. Không mở transaction, SSE stream hay kết nối mạng ngoài; việc đọc file không để lại trạng thái dở dang cần rollback.
- **Trục 4 (Môi trường serverless)**: `N/A`. Không ảnh hưởng đến kiến trúc serverless, biến môi trường hay state in-memory của Next.js instance.

##### Commands Executed

- `npm run type-check` (exit 0) — Xác lập baseline kiểm tra kiểu tĩnh của codebase.
- `git status` (exit 0) — Xác nhận working tree sạch ngoại trừ file plan mới và file `run-claude.ps1` đã sửa trước task.
- `git diff -- .agents/scripts/run-claude.ps1` (exit 0) — Kiểm tra thay đổi native CLI argument escape cho PowerShell 5.1.
- `grep_search` — Kiểm chứng các vị trí `supabase.server`, `upsertAssistantMessage`, `saveMessage`, `insertUserMessage`, và `vi.mock` trên toàn bộ cây thư mục `src/`.
- `view_file` — Đọc và đối chiếu cấu trúc `package.json`, `attachmentProcessor.ts`, `route.ts`, `chatStreamCore.ts`, `messages.ts`, `code-freeze-guard.js`.
- `search_web` — Kiểm chứng tài liệu Vitest 4 liên quan đến `vi.mock`, hoisting, và dynamic imports.

#### 6. Kết Luận

Kế hoạch `docs/plans/2026-10-24-vikini-investigate-blast-radius-hardening.md` (Revision 1) đáp ứng đầy đủ các tiêu chuẩn kiểm chứng độc lập, có cơ sở kỹ thuật vững chắc từ mã nguồn thực tế và đã vượt qua tất cả các bài kiểm tra tấn công đối kháng. Kế hoạch được phê duyệt để tiến hành triển khai.

[PLAN_APPROVED]
