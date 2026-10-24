---
trigger: always_on
description: Plan-Review-Revise loop, Code Freeze enforcement, Fast-Track mode, and Dual-Planner/Reviewer architecture.
---

# Giao Thức Plan - Review - Revise Loop & Cơ Chế Cưỡng Chế Thực Thi

## 1. Quy Tắc Đóng Băng Mã Nguồn & Chốt Chặn Hook Tự Động (Code Freeze)

- **Nguyên Tắc Cốt Lõi**: CẤM mọi agent (`@planner`, `@reviewer`, Claude CLI, Orchestrator) tạo, sửa hoặc xóa bất kỳ file mã nguồn/cấu hình nào (`src/`, `scripts/`, `package.json`,...) khi chưa có thẻ `[PLAN_APPROVED]` hợp lệ từ Lead Reviewer (`@reviewer` hoặc Claude CLI).
- **Ngoại Lệ Trước Khi Duyệt Plan**: Chỉ được ghi trên bề mặt kế hoạch (`docs/plans/*.md`, chỉ nhận đuôi `.md` trên toàn bộ `docs/**` và root planning artifacts) và `~/.gemini/antigravity/brain/`.
- **Chính Sách Scoped Protection (Hook `PreToolUse` tại `.agents/scripts/code-freeze-guard.js`)**:
  1. _Chưa có `[PLAN_APPROVED]`_: Chặn và hỏi (`ask`) mọi thao tác ghi `src/**` hoặc lệnh ngoài allowlist, **trừ Fast-Track §1.1**.
  2. _Đã có `[PLAN_APPROVED]` (**Plan Scope Guard**)_: Chỉ tự động cho phép (`allow`) ghi vào các file không nhạy cảm đã được khai báo rõ với nhãn `[NEW]`/`[MODIFY]`/`[DELETE]` trong `## Technical Plan` của plan đang Approved; mọi file ngoài danh sách khai báo trả `ask`.
  3. _6 Danh Mục File Nhạy Cảm Luôn Bị Khóa (`ask`)_: (a) `*.server.ts` (`src/lib/core/supabase.server.ts`), (b) database migrations (`supabase/migrations/`, `database-migrations/`, `*.sql`), (c) `TEST_INFRA_FILES` (`vitest.config.ts`, `eslint.config.mjs`, `package.json`, `tests/setup.ts`, `tsconfig.json`), (d) test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`), (e) `.agents/**`, (f) `PROTECTED_INFRA_FILES` (`scripts/code-freeze-guard.js`, `.claude/**`, `.husky/**`, `next.config.ts`, `package-lock.json`, `.npmrc`, `AGENTS.md`, `CLAUDE.md`).

### 1.1 Fast-Track Mode (Micro-UI & Translation Edits)

Cho phép thực thi trực tiếp (`allow`) không cần plan khi thỏa mãn **đồng thời** 4 điều kiện trong `isFastTrackEligible` (`.agents/scripts/code-freeze-guard.js`):

- **(a) Công cụ**: Chỉ `replace_file_content` hoặc `edit_file` (`write_to_file`/`write_file` luôn cần plan).
- **(b) Bề mặt**: Khớp `src/lib/utils/translations/{vi,en}.ts`, `src/app/styles/**/*.css`, `src/app/**/*.tsx` (trừ `src/app/api/`), hoặc `src/components/**/*.tsx`; không phải `*.test.tsx`, `*.spec.tsx`, `*.server.tsx`.
- **(c) Quy mô**: `TargetContent` và `ReplacementContent` không rỗng, mỗi bên `<= 40` dòng.
- **(d) Nội dung**: Không chứa `"use server"`, `process.env`, `*.server`, hoặc các API có side-effect trên `.tsx` (`fetch`, `WebSocket`, `eval`, `Function`, `localStorage`, `sessionStorage`, `document.cookie`, `window.location`, `import(`, `dangerouslySetInnerHTML`).

**4 Nghĩa vụ bắt buộc**: (1) Đọc `SKILL.md` liên quan (`.agents/skills/add-translation/SKILL.md`), (2) Ghi ở dòng đầu phản hồi: `📌 [Fast-Track | Skills: <tên-skill>]`, (3) Chạy `npm run type-check`, (4) Cấm chia nhỏ tính năng lớn thành nhiều lần gọi `<= 40` dòng (`[BLOCKER]`).

## 2. Nguyên Tắc "Zero-Self-Execution" & Kiến Trúc Dual-Planner 2 Kênh

- Orchestrator chỉ điều phối, **CẤM** tự viết plan hay tự cấp `[PLAN_APPROVED]`:
  1. **Primary Planner (Claude CLI)**: `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/<task>.md -Task "<yêu cầu>"`.
  2. **Fallback Planner (`@planner`)**: Tự động chuyển sang `.agents/agents/planner/agent.md` khi Claude CLI báo `exit 40/41/42` (`[CLAUDE_PRO_QUOTA_EXCEEDED]`).

## 3. Kiến Trúc Dual-Reviewer 2 Kênh & Chuỗi Chuyển Tiếp Không Ngắt Quãng

1. **Primary Reviewer (`@reviewer`)**: Thẩm định 7 bước theo `.agents/agents/reviewer/agent.md`; chỉ dùng `replace_file_content` / `edit_file` (Audit-Only Write Scope) nối `### Audit Run [X+1]` vào `## Audit History`, cập nhật `- **Status**:` ở Header, và ghi `[PLAN_APPROVED]` ở dòng cuối `docs/plans/<task>.md`.
2. **Fallback Reviewer (Claude CLI)**: Khi `@reviewer` chạm quota, gọi `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/<task>.md` (`--permission-mode dontAsk`, gắn `PreToolUse` hook `code-freeze-guard.js` qua `--settings` với `"onFailure": "block"`, chỉ cấp `Edit(docs/plans/*.md)` và chặn `Write` trong `--disallowedTools`).
3. **Uninterrupted Execution Chain**: Vòng lặp Planner ↔ Reviewer chạy tự động liên tục không ngắt quãng, tối đa **10 vòng lặp revision** trước khi bật Circuit Breaker trình User.

## 4. Tiêu Chuẩn Thẩm Định & Thang Đo Phân Loại Lỗi (Severity Rubric)

Đối chiếu 3 tài liệu vệ tinh (`.agents/agents/reviewer/allowlist.md`, `.agents/agents/reviewer/evidence-bar.md`, `.agents/agents/reviewer/mental-simulation.md` S1–S6):

- **`[BLOCKER]`**: Vi phạm kiến trúc, sai layer boundary, công nghệ ngoại lai (Prisma, Better Auth), lỗi bảo mật ➔ `[CHANGES_REQUESTED]`.
- **`[MAJOR]`**: Thiếu co-located test plan, sót edge cases, dùng `any`, thiếu Test Contract / living docs, hoặc S1–S5 `UNVERIFIED` ➔ `[CHANGES_REQUESTED]`.
- **`[MINOR]`**: Góp ý code style, đặt tên, tối ưu vi mô ➔ Không chặn; được cấp `[PLAN_APPROVED]`.

## 5. Cấu Trúc Plan, Sắp Xếp Tiền Tố Ngày & Vòng Đời `Status: Completed`

Mọi file trong `docs/plans/*.md` (**Single Source of Truth duy nhất**) gồm `## Technical Plan` (Planner) và `## Audit History` (Reviewer).

- **Điều Kiện Mở Khóa (`isPlanApproved()` / `plan-scope.js`)**: Trong nhóm ngày `YYYY-MM-DD` mới nhất (`<= UTC today + 1 day`), nếu có plan đang chờ duyệt thì khóa fail-safe (`false`); chỉ mở khóa (`true`) cho đúng các file khai báo `[NEW]`/`[MODIFY]`/`[DELETE]` khi có ít nhất 1 plan đạt `- **Status**: Approved` ở 30 dòng đầu VÀ dòng không rỗng cuối cùng `=== "[PLAN_APPROVED]"`.
- **Single-Step Pre-Approved Plan Guard**: Chặn `write_to_file`/`write_file`/`Write` tạo/ghi đè 1 bước file trong `docs/plans/` đã gắn sẵn `Status: Approved` hoặc `[PLAN_APPROVED]`.
- **Đóng `Status: Completed`**: Ở bước cuối sau khi hoàn tất task, bắt buộc đổi Header sang `- **Status**: Completed` để tự động khóa lại repo.

## 6. Checklist Pre-Flight Gate & Nghiệm Thu @qa (§7)

- **Pre-Flight Gate**: (1) **Gate 1 - Plan Persistence** (`docs/plans/`), (2) **Gate 2 - Reviewer Dispatch** (`@reviewer` / Claude CLI), (3) **Gate 3 - Reviewer Approval Token** (`Status: Approved` + `[PLAN_APPROVED]`).
- **Tác Tử `@qa` (On-Demand)**: Kích hoạt khi user gõ `@qa`; xuất `[QA_PASSED]` hoặc `[QA_FAILED]`.
