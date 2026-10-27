---
trigger: always_on
description: Plan-Review-Revise loop, Code Freeze enforcement, Fast-Track mode, and Dual-Planner/Reviewer architecture.
---

# Giao Thức Plan - Review - Revise Loop & Cơ Chế Cưỡng Chế Thực Thi

## 1. Quy Tắc Đóng Băng Mã Nguồn & Chốt Chặn Hook (Code Freeze)

- **Nguyên Tắc**: Cấm mọi agent tạo/sửa/xóa file mã nguồn/cấu hình (`src/`, `scripts/`, `package.json`,...) khi chưa có `[PLAN_APPROVED]`.
- **Ngoại Lệ**: Chỉ ghi trên `docs/plans/*.md` (đuôi `.md` trên `docs/**` và root planning artifacts) và `~/.gemini/antigravity/brain/`.
- **Chính Sách Scoped Protection (Hook `PreToolUse` tại `.agents/scripts/code-freeze-guard.js`)**:
  1. _Chưa có `[PLAN_APPROVED]`_: Chặn và hỏi (`ask`) mọi thao tác ghi `src/**` hoặc lệnh ngoài allowlist, **trừ Fast-Track §1.1**.
  2. _Đã có `[PLAN_APPROVED]` (**Plan Scope Guard**)_: Chỉ cho phép (`allow`) ghi vào file không nhạy cảm đã khai báo `[NEW]`/`[MODIFY]`/`[DELETE]` trong `## Technical Plan` đang Approved; ngoài danh sách trả `ask`.
  3. _6 Danh Mục Nhạy Cảm Luôn Khóa (`ask`)_: (a) `*.server.ts`, (b) migrations (`supabase/migrations/`, `database-migrations/`, `*.sql`), (c) `TEST_INFRA_FILES` (`vitest.config.ts`, `eslint.config.mjs`, `package.json`, `tests/setup.ts`, `tsconfig.json`), (d) test files (`*.test.ts(x)`, `*.spec.ts(x)`), (e) `.agents/**`, (f) `PROTECTED_INFRA_FILES` (`scripts/code-freeze-guard.js`, `.claude/**`, `.husky/**`, `next.config.ts`, `package-lock.json`, `.npmrc`, `AGENTS.md`, `CLAUDE.md`).

### 1.1 Fast-Track Mode (Micro-UI & Translation Edits)

Cho phép thực thi trực tiếp (`allow`) không cần plan khi thỏa đồng thời 4 điều kiện `isFastTrackEligible`:

- **(a) Công cụ**: Chỉ `replace_file_content` hoặc `edit_file` (`write_to_file`/`write_file` luôn cần plan).
- **(b) Bề mặt**: `src/lib/utils/translations/{vi,en}.ts`, `src/app/styles/**/*.css`, `src/app/**/*.tsx` (trừ `src/app/api/`), `src/components/**/*.tsx`; không phải `*.test.tsx`, `*.spec.tsx`, `*.server.tsx`.
- **(c) Quy mô**: `TargetContent` và `ReplacementContent` không rỗng, mỗi bên `<= 40` dòng.
- **(d) Nội dung**: Không chứa `"use server"`, `process.env`, `*.server`, hoặc API có side-effect trên `.tsx` (`fetch`, `WebSocket`, `eval`, `Function`, `localStorage`, `sessionStorage`, `document.cookie`, `window.location`, `import(`, `dangerouslySetInnerHTML`).

**4 Nghĩa vụ**: (1) Đọc `SKILL.md` (`.agents/skills/add-translation/SKILL.md`), (2) Dòng đầu ghi: `📌 [Fast-Track | Skills: <tên-skill>]`, (3) Chạy `npm run type-check`, (4) Cấm chia nhỏ tính năng lớn thành nhiều lần gọi `<= 40` dòng (`[BLOCKER]`).

## 2. Nguyên Tắc "Zero-Self-Execution" & Kiến Trúc Dual-Planner 2 Kênh

- Orchestrator chỉ điều phối, cấm tự viết plan hay tự cấp `[PLAN_APPROVED]`:
  1. **Primary Planner (Claude CLI)**: `.agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/<task>.md -Task "<yêu cầu>"`.
  2. **Fallback Planner (`@planner`)**: Chuyển sang `.agents/agents/planner/agent.md` khi Claude CLI báo `exit 40/41/42` (`[CLAUDE_PRO_QUOTA_EXCEEDED]`).

## 3. Kiến Trúc Dual-Reviewer 2 Kênh & Chuỗi Chuyển Tiếp

1. **Primary Reviewer (`@reviewer`)**: Thẩm định theo Objective/Fail Criteria tại `.agents/agents/reviewer/agent.md`; chạy `node scripts/verify-plan.mjs <plan>` và nêu `>= 3` mục `#### Critic Findings` (`file:line`); dùng `replace_file_content`/`edit_file` nối `### Audit Run [X+1]` vào `## Audit History` và cập nhật `- **Status**:`.
2. **Fallback Reviewer (Claude CLI)**: Khi `@reviewer` chạm quota, gọi `.agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/<task>.md` (`--permission-mode dontAsk`, gắn hook `code-freeze-guard.js` với `"onFailure": "block"`, chỉ cấp `Edit(docs/plans/*.md)` và chặn `Write`).
3. **Uninterrupted Execution Chain**: Vòng lặp Planner ↔ Reviewer chạy tự động liên tục, tối đa **10 vòng lặp revision** trước khi bật Circuit Breaker trình User.
4. **Cross-Model Critic Pass**: Khi plan chạm Bảo mật (`*.server.ts`, auth, proxy/middleware, `next.config.ts`), Governance (`.agents/**`, `.claude/**`, `.husky/**`, `AGENTS.md`, `CLAUDE.md`, `scripts/code-freeze-guard.js`), hoặc Database (`supabase/`, `database-migrations/`, `*.sql`) — phát hiện qua `CRITIC_REQUIRED yes`:
   - Khi đạt chuẩn, `@reviewer` đặt `- **Status**: Awaiting Critic` (giữ khóa repo) và kết thúc bằng `[AWAITING_CRITIC]`.
   - Orchestrator gọi `.agents/scripts/run-claude.ps1 -Role critic -PlanFile docs/plans/<task>.md`: `AGREE` ➔ `- **Status**: Approved` + `[PLAN_APPROVED]` dòng cuối; `DISAGREE_EVIDENCE` (`>= 1` lỗi `[BLOCKER]`/`[MAJOR]` kèm `[SRC]`/`[CMD]`) ➔ `- **Status**: Changes Requested` + `[CHANGES_REQUESTED]`.
   - Nếu `-Role critic` chạm quota (`exit 42`) ➔ bật Circuit Breaker. Nếu Claude Fallback Reviewer duyệt sơ bộ (`Awaiting Critic`), gọi `@reviewer` ở Cross-Model Critic Mode.

## 4. Tiêu Chuẩn Thẩm Định & Thang Đo Lỗi (Severity Rubric)

Đối chiếu `.agents/agents/reviewer/{allowlist,evidence-bar,mental-simulation}.md`:

- **`[BLOCKER]`**: Vi phạm kiến trúc, sai layer boundary, công nghệ ngoại lai (Prisma, Better Auth), lỗi bảo mật ➔ `[CHANGES_REQUESTED]`.
- **`[MAJOR]`**: Thiếu co-located test plan, sót edge cases, dùng `any`, thiếu Test Contract / living docs, hoặc S1–S5 `UNVERIFIED` ➔ `[CHANGES_REQUESTED]`.
- **`[MINOR]`**: Góp ý code style, đặt tên, tối ưu vi mô ➔ Không chặn; được cấp `[PLAN_APPROVED]`.
- **When in doubt, escalate**: Phân vân giữa 2 mức severity hoặc `PASS`/`FAIL` thì chọn mức cao hơn vì sửa plan rẻ hơn rollback code.

## 5. Cấu Trúc Plan & Vòng Đời `Status: Completed`

Mọi file `docs/plans/*.md` (**Single Source of Truth**) gồm `## Technical Plan` và `## Audit History`.

- **Điều Kiện Mở Khóa (`isPlanApproved()` / `plan-scope.js`)**: Trong nhóm ngày `YYYY-MM-DD` mới nhất, nếu có plan chờ duyệt (gồm cả `Awaiting Critic`, giữ khóa fail-safe) thì trả `false`; chỉ mở khóa (`true`) cho file khai báo `[NEW]`/`[MODIFY]`/`[DELETE]` khi có plan đạt `- **Status**: Approved` ở 30 dòng đầu VÀ dòng không rỗng cuối cùng `=== "[PLAN_APPROVED]"`.
- **Single-Step Pre-Approved Plan Guard**: Chặn `write_to_file`/`write_file`/`Write` tạo/ghi đè 1 bước file trong `docs/plans/` đã gắn sẵn `Status: Approved` hoặc `[PLAN_APPROVED]`.
- **Đóng `Status: Completed`**: Sau khi hoàn tất task, đổi Header sang `- **Status**: Completed` để khóa lại repo.

## 6. Checklist Pre-Flight Gate & Nghiệm Thu @qa (§7)

- **Pre-Flight Gate**: (1) **Gate 1 - Plan Persistence** (`docs/plans/`), (2) **Gate 2 - Reviewer Dispatch** (`@reviewer` / Claude CLI + `-Role critic`), (3) **Gate 3 - Reviewer Approval Token** (`Status: Approved` + `[PLAN_APPROVED]` + `node scripts/verify-plan.mjs <plan>` exit 0).
- **Tác Tử `@qa` (On-Demand)**: Kích hoạt khi user gõ `@qa`; xuất `[QA_PASSED]` hoặc `[QA_FAILED]`.
