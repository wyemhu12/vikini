---
trigger: always_on
description: Pre-work skill triggers, verification tiers, test triage, and post-fix protocols.
---

# Quality Gates

## Pre-Work Protocol (MANDATORY Skill Triggers)

Before writing any code, identify the task domain and read relevant documentation/skills:

- **Chat / Streaming**: `docs/contracts.md`, `.agents/skills/streaming-patterns/SKILL.md`
- **Database / Schema**: `docs/database-schema.md`, `.agents/skills/database-migration/SKILL.md`
- **Auth / Security**: `docs/security.md`
- **UI Components**: `.agents/rules/03-ui.md`
- **UI text / Translations**: `.agents/skills/add-translation/SKILL.md`, `.agents/rules/04-bilingual.md`
- **Bug fixing**: `docs/lessons-learned.md` → **.agents/skills/vikini-debug/SKILL.md**
- **API routes**: `.agents/skills/api-patterns/SKILL.md`
- **Projects / Knowledge Base**: `docs/features.md` (§2.10), `docs/contracts.md`
- **Image Studio / Gallery / Voice**: `docs/features.md` (§2.5–2.7)
- **New feature / Overview**: `docs/features.md`, `docs/architecture.md`, `.agents/skills/add-feature/SKILL.md`
- **Architecture / Blast-radius (`lib/core`, `lib/features`)**: `.agents/skills/vikini-investigate/SKILL.md`
- **Simplify / Dead code cleanup**: `.agents/skills/vikini-simplify/SKILL.md`
- **Feature / Task Planning**: `docs/plans/`, **.agents/rules/05-plan-review.md**
- **Code quality review / Refactoring**: `.agents/rules/01-coding.md` → **.agents/skills/vikini-audit/SKILL.md**

<important>
When a rule or skill is listed above, you MUST read and follow it step-by-step.
Strict code freeze applies to new features and non-trivial tasks until `[PLAN_APPROVED]` is issued by Lead Reviewer (`@reviewer` or Claude CLI; see `.agents/rules/05-plan-review.md`).
</important>

## Skill Precedence Hierarchy (Vikini-First, Superpowers-Complementary)

- **Tầng 1 — Vikini Internal Governance & Skills (Primary)**: `.agents/rules/`, `.agents/skills/*/SKILL.md`, và chuỗi Planner → Reviewer → `@qa` luôn áp dụng trước tiên.
- **Tầng 2 — Superpowers Plugin (Secondary)**: Chỉ dùng bổ trợ (`brainstorming`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`) sau Tầng 1. Khi xung đột, Tầng 1 luôn thắng.

<important>
Các skill `superpowers` (`using-git-worktrees`, `writing-plans`, `executing-plans`, `finishing-a-development-branch`) CẤM ghi đè luật cấm git mutating tự động (`.agents/rules/00-core.md`) hay quy trình duyệt plan (`.agents/rules/05-plan-review.md`).
</important>

## Post-Change Checklist (MANDATORY)

- **Tier 1 (After each edit)**: `npm run type-check` — bắt lỗi kiểu sớm.
- **Tier 2 (Task completion)**: `npm run verify` (type-check + lint + tests), cập nhật co-located tests, `docs/CHANGELOG.md` và docs liên quan.
- **Visual QA Gate (UI / CSS changes)**: Bắt buộc bật `next dev`, dùng Playwright `page.screenshot()` chụp `.png` ở Desktop (`1440px`) & Mobile (`375px`) × Dark/Light rồi gọi `read_file` đọc trực tiếp từng ảnh để tự soi bố cục/chữ/tương phản bằng mắt trước khi nghiệm thu (`.agents/rules/03-ui.md`).
- **Tier 3 (Before merge/deploy)**: CI pipeline độc lập.

## Windows PowerShell 5.1 Terminal Guidance

<important>
Trong PowerShell 5.1, **CẤM** dùng `&&`; **BẮT BUỘC** dùng `;`: `npm run type-check; npm run lint; npm run test:run`.
</important>

## Test Failure Triage Protocol

Khi test thất bại, BẮT BUỘC phân loại:

- **Loại A (Code Bug)**: Code sai đặc tả ➔ **SỬA CODE ỨNG DỤNG**, cấm chạm vào test file.
- **Loại B (Test Harness Issue)**: Mock/import lỗi thời do refactor ➔ **SỬA HARNESS/MOCK**, cấm giảm `expect()` hay nới lỏng matcher.
- **Loại C (Approved Spec Change)**: Đặc tả đổi theo Test Contract có `[PLAN_APPROVED]` ➔ **CẬP NHẬT TEST CASES** theo Test Contract mới.

<important>
CẤM HẠ CHUẨN TEST: Cấm xóa `expect()`, comment-out test, nới lỏng matcher (`toEqual` → `toBeDefined`), hoặc thêm `.skip`, `.only`, `xit`, `fit`, `.skipIf`, `.fails` khi không có căn cứ Loại C (`[BLOCKER]`).
</important>

## Audit Định Kỳ vs. Nghiệm Thu @qa

- **Audit Định Kỳ (`.agents/skills/vikini-audit/SKILL.md`)**: Rà soát chất lượng code, kiến trúc và dead code theo file/feature.
- **Nghiệm Thu On-Demand (`@qa`)**: Kích hoạt khi user gọi `@qa` để nghiệm thu 7 bước (`[QA_PASSED]` / `[QA_FAILED]`).

## Governance Character Limits

- Rules (`.agents/rules/*.md`): `<= 12,000` ký tự (tổng `always_on < 18,000`).
- Agents (`.agents/agents/*/agent.md`): `<= 10,000` ký tự.
- Đường dẫn nội bộ dùng relative path từ repo root (`src/lib/core/...`).

## Debugging & Post-Fix Protocol (`.agents/skills/vikini-debug/SKILL.md`)

- **Debugging 6 bước (cấm sửa khi chưa rõ root cause)**: (1) `docs/lessons-learned.md`, (2) Root Cause, (3) Pattern Analysis, (4) Hypothesis & minimal test, (5) Implementation, (6) **Circuit Breaker**: 3 lần sửa thất bại ➔ DỪNG và xuất `"ARCHITECTURAL ALERT: 3 fixes failed. Recommendation: Discuss refactoring."`
- **Post-Fix 5 bước**: (1) `npm run verify`, (2) Ghi `docs/lessons-learned.md` (Symptom, Root Cause, Fix, Prevention Rule), (3) Lặp 3+ lần thì rút thành rule `.agents/rules/`, (4) Cập nhật `docs/CHANGELOG.md`, (5) Kết thúc: `Lesson recorded in docs/lessons-learned.md: [one-line description]`.

## Bilingual & Minimal Diffs

- **Bilingual**: Văn bản UI mới BẮT BUỘC dùng `.agents/rules/04-bilingual.md` & `.agents/skills/add-translation/SKILL.md`.
- **Minimal Diffs**: Chỉ sửa đúng phạm vi, không format lại vùng không liên quan.
