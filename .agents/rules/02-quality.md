---
trigger: always_on
description: Mandatory pre-work, post-change checklist, workflow enforcement, test triage, and quality protocols.
---

# Quality Gates

## Pre-Work Protocol (MANDATORY)

Before writing any code, identify the task domain and read relevant documentation:

| Domain                    | Read first                                                    | Workflow to follow                  |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Chat / Streaming          | docs/contracts.md, .agents/skills/streaming-patterns.md       |                                     |
| Database / Schema         | docs/database-schema.md, .agents/skills/database-migration.md |                                     |
| Auth / Security           | docs/security.md                                              |                                     |
| UI Components             | .agents/rules/03-ui.md                                        |                                     |
| Bug fixing                | docs/lessons-learned.md                                       | **.agents/workflows/debug.md**      |
| API routes                | .agents/skills/api-patterns.md                                |                                     |
| Projects / Knowledge Base | docs/features.md (section 2.10), docs/contracts.md            |                                     |
| Image Studio / Gallery    | docs/features.md (sections 2.5, 2.6)                          |                                     |
| Voice / Audio             | docs/features.md (section 2.7)                                |                                     |
| New feature overview      | docs/features.md, docs/architecture.md                        |                                     |
| Adding a new feature      | .agents/skills/add-feature.md                                 |                                     |
| Feature / Task Planning   | docs/plans/, .agents/rules/05-plan-review.md                  | **.agents/rules/05-plan-review.md** |
| Code quality review       | .agents/rules/01-coding.md                                    | **.agents/workflows/audit.md**      |
| Refactoring / File split  | .agents/rules/01-coding.md (§ File Size & Modularity)         |                                     |

<important>
When a workflow or rule is listed in the table above, you MUST read and follow it step-by-step.
Do NOT skip workflows. They are mandatory procedures, not optional references.
For any new feature or non-trivial task, strict code freeze applies until token `[PLAN_APPROVED]` is issued by Lead Reviewer (Claude CLI hoặc `@reviewer` fallback) (see `.agents/rules/05-plan-review.md`).
</important>

## Post-Change Checklist (MANDATORY)

Use the appropriate verification tier:

| Tier  | When                    | Command              | Purpose                                          |
| ----- | ----------------------- | -------------------- | ------------------------------------------------ |
| **1** | After each edit         | `npm run type-check` | Instant sanity check — catches type errors early |
| **2** | After completing a task | `npm run verify`     | Full quality gate (type-check + lint + tests)    |
| **3** | Before merge/deploy     | CI pipeline          | Independent verification in clean environment    |

<important>
Tier 1 after every edit. Tier 2 before declaring a task done. Never skip Tier 2.
If logic changed, add or update tests before running Tier 2.
</important>

After verification, also:

- Update `docs/CHANGELOG.md` with a summary of what changed
- Update related docs if any interface, API, models or schema changed

## Windows PowerShell 5.1 Terminal Guidance

<important>
Khi chạy thủ công chuỗi lệnh kiểm thử trong terminal Windows (PowerShell 5.1):
- **CẤM** dùng toán tử `&&` giữa các lệnh (PowerShell 5.1 sẽ ném lỗi cú pháp parser).
- **BẮT BUỘC** dùng dấu chấm phẩy `;` để nối lệnh:
  `npm run type-check; npm run lint; npm run test:run`
- Lưu ý: Lệnh `npm run verify` trong `package.json` vẫn sử dụng `&&` an toàn vì npm thực thi scripts thông qua shell `cmd.exe`.
</important>

## Test Failure Triage Protocol (Giao Thức Xử Lý Lỗi Test)

Khi một test case thất bại trong quá trình verify, agent BẮT BUỘC phân loại nguyên nhân theo 3 loại:

- **Loại A (Code Bug)**: Mã nguồn ứng dụng có lỗi logic so với đặc tả.
  ➔ **SỬA CODE ỨNG DỤNG**. Tuyệt đối không chạm vào test file.
- **Loại B (Test Harness Issue)**: Cấu hình mock, test harness hoặc import path bị lỗi thời do refactor, nhưng đặc tả nghiệp vụ không đổi.
  ➔ **ĐƯỢC PHÉP SỬA TEST HARNESS/MOCK**, nhưng KHÔNG được giảm số lượng `expect()` hay nới lỏng matcher.
- **Loại C (Approved Spec Change)**: Đặc tả nghiệp vụ chính thức thay đổi theo Test Contract trong kế hoạch đã được Lead Reviewer (Claude CLI hoặc `@reviewer`) cấp thẻ `[PLAN_APPROVED]`.
  ➔ **ĐƯỢC PHÉP CẬP NHẬT TEST CASES** tương ứng với Test Contract mới.

<important>
NGHIÊM CẤM HẠ THẤP TIÊU CHUẨN TEST:
- CẤM xóa `expect()` hoặc comment-out test cases.
- CẤM nới lỏng matcher (ví dụ: đổi `toEqual` thành `toBeDefined`).
- CẤM thêm `.skip`, `.only`, `xit`, `fit`, `.skipIf`, `.fails` mà không có căn cứ Loại C.
- Mọi hành vi làm yếu test sẽ bị Test Integrity Guard ở tầng platform phát hiện và @qa đánh lỗi [BLOCKER].
</important>

## Phân Định Ranh Giới: Audit Định Kỳ vs. Nghiệm Thu @qa

- **Quy trình Audit Định Kỳ (`.agents/workflows/audit.md`)**:
  - Dành cho việc rà soát mã nguồn toàn diện theo chu kỳ (sprint/release) hoặc trước khi merge PR lớn.
  - Quét dead code, phân tích dependencies, kiểm tra kiến trúc tổng thể.
- **Tác Tử Nghiệm Thu On-Demand (`@qa`)**:
  - Tác tử độc lập chỉ kích hoạt khi người dùng (Product Manager) trực tiếp gọi `@qa` trong chat.
  - Nghiệm thu đối chiếu từng task cụ thể theo 7 bước, thi hành Verification Gate, săn lỗi chuyên sâu và Test Integrity Audit.
- **Tham Chiếu Tài Sản Kỹ Thuật Sẵn Có**:
  - Chuẩn SSE Stream: `.agents/skills/streaming-patterns.md` (events `token`, `meta`, `thinking`, `done`, `error`).
  - Chuẩn Database Migrations: `.agents/skills/database-migration.md` (Supabase schema, RLS, cascade).
  - Chuẩn API Route Architecture: `.agents/skills/api-patterns.md` (Validate → Execute → Respond, `requireUser()`).

## Governance-Only Changes (Quy Chuẩn Quản Trị)

Khi tạo mới hoặc cập nhật các tài liệu governance (`.agents/rules/`, `.agents/agents/`, `docs/plans/`):

- Bắt buộc có Frontmatter YAML chuẩn xác (`trigger`, `description`, `tools`, `model`...).
- Tuân thủ chuẩn GitHub Flavored Markdown (GFM).
- Đường dẫn file nội bộ viết dạng relative path từ repo root (`.agents/rules/01-coding.md`, `src/lib/core/...`).
- Giới hạn dung lượng ký tự nghiêm ngặt (Character Limit):
  - File Rules (`.agents/rules/*.md`): BẮT BUỘC `≤ 12,000` ký tự.
  - File Agents (`.agents/agents/*/agent.md`): BẮT BUỘC `≤ 10,000` ký tự.

## After Fixing a Bug (MANDATORY Post-Fix Protocol)

<important>
After EVERY bug fix, you MUST execute ALL of the following steps in order:
</important>

1. **Verify** -- Run `npm run verify`
2. **Record the lesson** -- Add entry to `docs/lessons-learned.md`:
   - Symptom: What went wrong
   - Root Cause: Why it happened
   - Fix: What was changed
   - Prevention Rule: How to avoid this in the future
3. **Check for pattern promotion** -- If the same category of mistake appears 3+ times in lessons-learned, extract a formal rule into the appropriate `.agents/rules/` file
4. **Update CHANGELOG** -- Add the fix to `docs/CHANGELOG.md`
5. **Confirm** -- End with: `Lesson recorded in docs/lessons-learned.md: [one-line description]`

## Debugging Protocol (MANDATORY for complex/recurring bugs)

<important>
For any bug that is not trivially obvious, you MUST follow the debug workflow in `.agents/workflows/debug.md`.
Do NOT propose fixes without a confirmed root cause.
</important>

1. **Preparation** -- Read `docs/lessons-learned.md` to check if the pattern was seen before
2. **Root Cause** -- Gather evidence first. No code changes until root cause is identified
3. **Pattern Analysis** -- Find a working example of the same pattern in the codebase
4. **Hypothesis** -- Formulate "X is broken because Y" and verify with a minimal test
5. **Implementation** -- Only fix after hypothesis is proven. Then run post-fix protocol above
6. **Circuit Breaker** -- If 3 fix attempts fail: STOP. Output: "ARCHITECTURAL ALERT: 3 fixes failed. Recommendation: Discuss refactoring."

## Bilingual Enforcement

See `.agents/rules/04-bilingual.md` for full requirements. In short: every new UI-facing text MUST use the translation system.

## Minimal Diffs Policy

- Change only what is necessary. No formatting noise.
- Follow the coding style of the file being edited.
- Do not reformat code where logic was not modified.
