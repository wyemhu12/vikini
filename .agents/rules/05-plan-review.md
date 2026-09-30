---
trigger: always_on
description: Multi-agent Plan-Review-Revise Loop protocol, strict code freeze, platform hook guard, zero-self-execution, uninterrupted chain, pre-flight gate, severity rubric, and dual-reviewer architecture (Claude CLI primary + Gemini Flash subagent fallback).
---

# Giao Thức Plan - Review - Revise Loop & Cơ Chế Cưỡng Chế Thực Thi

## 1. Quy Tắc Đóng Băng Mã Nguồn & Chốt Chặn Hook Tự Động (Code Freeze)

- **Nguyên Tắc Cốt Lõi**: TUYỆT ĐỐI KHÔNG MỘT AGENT NÀO (`@planner`, `@reviewer`, hay Orchestrator) được phép tạo mới, chỉnh sửa, thay thế hoặc xóa bất kỳ file source code nào trong dự án (`src/`, `app/`, `lib/`, `components/`, `package.json`, cấu hình hạ tầng,...) khi chưa nhận được thẻ `[PLAN_APPROVED]` từ Lead Reviewer (Claude Code CLI hoặc Fallback Subagent `@reviewer`).
- **Ngoại Lệ Cho Phép Trước Khi Duyệt Plan**: Mọi thao tác ghi file trước khi được phê duyệt CHỈ ĐƯỢC PHÉP trên bề mặt kế hoạch (`docs/plans/` và artifact ngoài repo tại `~/.gemini/antigravity/brain/`).
- **Cơ Chế Cưỡng Chế Tầng Platform (Platform Hook Guard)**:
  - Hook tự động `PreToolUse` (`.agents/scripts/code-freeze-guard.js`) bảo vệ mọi thao tác `write_to_file`, `replace_file_content` và `run_command`.
  - **Chính Sách Scoped Protection (Phương án 2)**:
    1. _Trước khi có `[PLAN_APPROVED]`_: Mọi thao tác ghi vào `src/**` hoặc lệnh ngoài allowlist đều bị hook chặn lại và hỏi người dùng (`ask`).
    2. _Sau khi có `[PLAN_APPROVED]`_: Tự động cho phép (`allow`) ghi vào các file UI components, hooks, và business logic thông thường.
    3. _File Nhạy Cảm Luôn Bị Khóa_: Hook LUÔN LUÔN chặn và hỏi xác nhận người dùng (`ask`) đối với các file cốt lõi:
       - File server chứa secret/auth: `*.server.ts` (ví dụ `src/lib/core/supabase.server.ts`).
       - File database migrations (`supabase/migrations/`, `database-migrations/`, `*.sql`).
       - Cấu hình hạ tầng kiểm thử (`TEST_INFRA_FILES`: `vitest.config.ts`, `eslint.config.mjs`, `package.json`, `tests/setup.ts`, `tsconfig.json`).
       - File test chịu sự bảo vệ của Test Integrity Guard.
       - File cấu hình quản trị tác tử (`.agents/**`).

## 2. Nguyên Tắc "Zero-Self-Execution" (Chống Tự Kiêm Nhiệm)

- Orchestrator (luồng chính) chỉ đóng vai trò Điều Phối Viên (Workflow Orchestrator & Dispatcher). Orchestrator **TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ KIÊM NHIỆM** công việc của Subagent.
- Khi nhận yêu cầu lập kế hoạch mới, Orchestrator **BẮT BUỘC 100%** phải ủy quyền (dispatch) thông qua lệnh gọi subagent `@planner`.
- Hành vi bị cấm: Tự khảo sát codebase rồi tự viết kế hoạch trên luồng chính, hoặc tự sinh ra thẻ `[PLAN_APPROVED]`.

## 3. Kiến Trúc Reviewer 2 Kênh & Chuỗi Chuyển Tiếp Không Ngắt Quãng

Hệ thống thẩm định kiến trúc tại Vikini vận hành theo mô hình **Dual-Reviewer Architecture**:

1. **Kênh Thẩm Định Ưu Tiên 1 (Primary Reviewer - Claude Code CLI)**:
   - Sử dụng Claude Code CLI (`claude-opus-5-5` hoặc `claude-sonnet-5-5`) tận dụng tài khoản Claude Pro của người dùng, không phụ thuộc vào token quota của Antigravity.
   - Orchestrator thực thi qua script PowerShell:
     `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -PlanFile docs/plans/<task>.md`
   - Script tự động nạp prompt template chuẩn hóa (`.agents/scripts/claude-reviewer-prompt.md`) kèm đầy đủ bộ tài liệu vệ tinh (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md`).
2. **Kênh Thẩm Định Dự Phòng (Fallback Reviewer - Subagent `@reviewer`)**:
   - Khi Claude CLI hết quota Claude Pro (script trả về exit code `42` hoặc `[CLAUDE_PRO_QUOTA_EXCEEDED]`) hoặc gặp sự cố kết nối:
   - Orchestrator **tự động chuyển giao ngay lập tức** sang subagent `@reviewer` (chạy mô hình `gemini-3.8-flash` với thinking budget tối đa).
   - Subagent `@reviewer` thực hiện thẩm định 7 bước chuẩn mực theo đúng bộ 3 tài liệu vệ tinh trong `.agents/agents/reviewer/`.
3. **Nguyên Tắc "Uninterrupted Execution Chain" & Tự Động Hóa Hoàn Toàn**:
   - Sau khi `@planner` hoàn thành soạn thảo, Orchestrator lập tức gọi Reviewer (Claude CLI trước, nếu fail exit 42 thì gọi `@reviewer`). Chuỗi chạy hoàn toàn tự động, không dừng lại xin phép hay hỏi quyền người dùng giữa chừng.
   - **Tối đa 10 vòng lặp revision (Revision Loop)**: Toàn bộ quá trình lập kế hoạch, phản biện và cập nhật kế hoạch giữa `@planner` và Reviewer vận hành tự động liên tục lên tới 10 vòng lặp. Nếu sau vòng 10 vẫn chưa đạt `[PLAN_APPROVED]`, Circuit Breaker mới kích hoạt để dừng chuỗi và trình User quyết định.

## 4. Tiêu Chuẩn Thẩm Định & Thang Đo Phân Loại Lỗi (Severity Rubric)

Mọi lượt review (dù qua Claude CLI hay Subagent `@reviewer`) đều bắt buộc đối chiếu theo 3 tài liệu vệ tinh:

- `allowlist.md`: Allowlist lệnh read-only được phép chạy.
- `evidence-bar.md`: Tiêu chuẩn dẫn chứng kỹ thuật (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`).
- `mental-simulation.md`: 6 kịch bản đối kháng S1–S6 (Cold-start, Lifecycle, Database, State, Security, External Resilience) và Domain Inquiry.

**Thang đo phân loại lỗi**:

- **`[BLOCKER]`**: Vi phạm kiến trúc cốt lõi, sai layer boundary (nhúng logic vào `components/ui/`), đưa công nghệ ngoại lai (Prisma, Better Auth) vào Vikini, lỗi bảo mật. ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
- **`[MAJOR]`**: Thiếu co-located test plan cho `lib/`, sót edge cases nghiêm trọng, vi phạm cấm `any`, thiếu Test Contract, thiếu living docs, hoặc kịch bản S1–S5 bị `UNVERIFIED`. ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
- **`[MINOR]`**: Góp ý cú pháp code style, đặt tên biến, tối ưu vi mô. ➔ Không chặn kế hoạch. Reviewer được phép cấp `[PLAN_APPROVED]` kèm `[Advisory Recommendations]`.

## 5. Cấu Trúc File Kế Hoạch & Cơ Chế Phê Duyệt An Toàn

Mọi file kế hoạch trong `docs/plans/*.md` bắt buộc tuân theo cấu trúc phân khu kép:

1. `## Technical Plan`: Antigravity soạn thảo và cập nhật giải pháp kỹ thuật.
2. `## Audit History`: Khu vực dành riêng cho Reviewer ghi nhận xét theo từng lượt (`### Audit Run 1`, `### Audit Run 2`...). Reviewer chỉ append vào mục này, không sửa `## Technical Plan`.

**Cơ Chế Phê Duyệt Của Code Freeze Guard**:

- Thẻ phê duyệt `[PLAN_APPROVED]` **BẮT BUỘC nằm ở dòng văn bản cuối cùng** của file kế hoạch.
- Khi kế hoạch có Revision mới hoặc đang ở trạng thái pending (`Ready for Review`, `In Review`, `Draft`, `Changes Requested`), thẻ phê duyệt cũ từ Revision trước **tự động vô hiệu hóa** và hệ thống duy trì code freeze cho tới khi Audit Run mới nhất hoàn tất.

## 6. Checklist Bắt Buộc: Pre-Flight Gate

Trước khi xuất bất kỳ phản hồi nào tuyên bố kế hoạch hoàn thành hoặc xin phép mở khóa viết code, Orchestrator BẮT BUỘC tự kiểm tra 3 cổng:

- [ ] **Gate 1 - Plan Persistence**: File kế hoạch đã được ghi đầy đủ vào `docs/plans/`?
- [ ] **Gate 2 - Reviewer Dispatch**: Kế hoạch đã được thẩm định qua Claude Code CLI (hoặc Fallback Reviewer `@reviewer`) chưa?
- [ ] **Gate 3 - Reviewer Approval Token**: File plan có chứa thẻ `[PLAN_APPROVED]` ở dòng cuối cùng do Reviewer cấp chưa?

## 7. Agent Thẩm Định & Nghiệm Thu Thủ Công (@qa)

- Agent `@qa` đóng vai trò là bên thứ ba độc lập chuyên: **Nghiệm thu đối chiếu**, **Verification Gate fail-fast**, **Săn lỗi chuyên sâu**, **Test Integrity Audit**, và **Đề xuất cải tiến**.
- Chỉ kích hoạt khi người dùng gõ `@qa` trong chat (On-Demand). Báo cáo xuất thẻ `[QA_PASSED]` hoặc `[QA_FAILED]`.
