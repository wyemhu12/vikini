---
trigger: always_on
description: Multi-agent Plan-Review-Revise Loop protocol, strict code freeze, platform hook guard, zero-self-execution, uninterrupted chain, pre-flight gate, severity rubric, dual-planner architecture (Claude CLI primary + Gemini 4 Argon @planner fallback), and dual-reviewer architecture (Gemini 4 Argon @reviewer primary + Claude CLI fallback).
---

# Giao Thức Plan - Review - Revise Loop & Cơ Chế Cưỡng Chế Thực Thi

## 1. Quy Tắc Đóng Băng Mã Nguồn & Chốt Chặn Hook Tự Động (Code Freeze)

- **Nguyên Tắc Cốt Lõi**: TUYỆT ĐỐI KHÔNG MỘT AGENT NÀO (`@planner`, `@reviewer`, Claude CLI, hay Orchestrator) được phép tạo mới, chỉnh sửa, thay thế hoặc xóa bất kỳ file source code nào trong dự án (`src/`, `app/`, `lib/`, `components/`, `package.json`, cấu hình hạ tầng,...) khi chưa nhận được thẻ `[PLAN_APPROVED]` từ Lead Reviewer (Primary Subagent `@reviewer` hoặc Fallback Claude Code CLI).
- **Ngoại Lệ Cho Phép Trước Khi Duyệt Plan**: Mọi thao tác ghi file trước khi được phê duyệt CHỈ ĐƯỢC PHÉP trên bề mặt kế hoạch (`docs/plans/` và artifact ngoài repo tại `~/.gemini/antigravity/brain/`).
- **Cơ Chế Cưỡng Chế Tầng Platform (Platform Hook Guard)**:
  - Hook tự động `PreToolUse` (`.agents/scripts/code-freeze-guard.js`) bảo vệ mọi thao tác `write_to_file`, `replace_file_content` và `run_command`.
  - **Chính Sách Scoped Protection (Phương án 2)**:
    1. _Trước khi có `[PLAN_APPROVED]`_: Mọi thao tác ghi vào `src/**` hoặc lệnh ngoài allowlist đều bị hook chặn lại và hỏi người dùng (`ask`), **trừ Fast-Track §1.1**.
    2. _Sau khi có `[PLAN_APPROVED]`_: Tự động cho phép (`allow`) ghi vào các file UI components, hooks, và business logic thông thường.
    3. _File Nhạy Cảm Luôn Bị Khóa_: Hook LUÔN LUÔN chặn và hỏi xác nhận người dùng (`ask`) đối với các file cốt lõi:
       - File server chứa secret/auth: `*.server.ts` (ví dụ `src/lib/core/supabase.server.ts`).
       - File database migrations (`supabase/migrations/`, `database-migrations/`, `*.sql`).
       - Cấu hình hạ tầng kiểm thử (`TEST_INFRA_FILES`: `vitest.config.ts`, `eslint.config.mjs`, `package.json`, `tests/setup.ts`, `tsconfig.json`).
       - File test chịu sự bảo vệ của Test Integrity Guard.
       - File cấu hình quản trị tác tử (`.agents/**`).

### 1.1 Fast-Track Mode (Micro-UI & Translation Edits)

Chỉnh sửa vi mô thuần giao diện được phép thực thi trực tiếp (`allow`) mà không cần lập kế hoạch hay chờ `[PLAN_APPROVED]` khi thỏa mãn **đồng thời** 4 điều kiện kỹ thuật trong `isFastTrackEligible` (`.agents/scripts/code-freeze-guard.js`):

- **(a) Công cụ**: Chỉ áp dụng cho `replace_file_content` (`write_to_file` luôn cần plan).
- **(b) Bề mặt cho phép**: Đường dẫn khớp `src/lib/utils/translations/{vi,en}.ts`, `src/app/styles/**/*.css`, `src/app/**/*.tsx` (trừ `src/app/api/`), hoặc `src/components/**/*.tsx`; và **không** phải `*.test.tsx`, `*.spec.tsx`, `*.server.tsx`.
- **(c) Quy mô vi mô**: `TargetContent` và `ReplacementContent` đều không rỗng và mỗi bên `<= 40` dòng (tính tổng mọi chunk trong một lần gọi).
- **(d) Nội dung an toàn**: Nội dung mới không chứa `"use server"`, `process.env`, hoặc tham chiếu `*.server`. Mọi file nhạy cảm tại §1.3 vẫn luôn bị chặn `ask` vì Fast-Track chạy sau các chốt chặn đó.

**Nghĩa vụ bắt buộc của Agent khi dùng Fast-Track**:

1. Dùng `view_file` đọc `SKILL.md` liên quan trước khi sửa (ví dụ `.agents/skills/add-translation/SKILL.md` khi sửa `vi.ts`/`en.ts`).
2. Ghi rõ ở dòng đầu phản hồi: `📌 [Fast-Track | Skills: <tên-skill>]`.
3. Chạy `npm run type-check` (Tier 1) ngay sau khi sửa.
4. Chỉ dùng cho một thay đổi vi mô, độc lập và đúng yêu cầu trực tiếp của user. **Nghiêm cấm** chia nhỏ một tính năng lớn thành nhiều lần gọi `<= 40` dòng để lách quy trình lập kế hoạch (`@qa`/Reviewer xử lý ở mức `[BLOCKER]`).

## 2. Nguyên Tắc "Zero-Self-Execution" & Kiến Trúc Dual-Planner 2 Kênh

- Orchestrator (luồng chính) chỉ đóng vai trò Điều Phối Viên (Workflow Orchestrator & Dispatcher). Orchestrator **TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ KIÊM NHIỆM** công việc của Planner hay Reviewer.
- Hành vi bị cấm: Tự khảo sát codebase rồi tự viết kế hoạch trên luồng chính, hoặc tự sinh ra thẻ `[PLAN_APPROVED]`.
- Khi nhận yêu cầu lập kế hoạch mới hoặc cập nhật kế hoạch trong Revision Loop, Orchestrator vận hành theo **Dual-Planner Architecture**:
  1. **Kênh Lập Kế Hoạch Ưu Tiên 1 (Primary Planner - Claude Code CLI)**:
     - Thực thi qua script PowerShell:
       `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/<task>.md -Task "<yêu cầu nhiệm vụ>"`
     - Script tự động nạp `.agents/scripts/claude-planner-prompt.md` (chứa đủ 10 mục bắt buộc, 8 nguyên lý `pstack`, Tech Stack Vikini, và quy trình _In-Place Plan Updating_) để ghi trực tiếp vào `docs/plans/<task>.md` và đồng bộ sang artifact `implementation_plan.md` (nếu truyền `-ArtifactFile`).
  2. **Kênh Lập Kế Hoạch Dự Phòng (Fallback Planner - Subagent `@planner`)**:
     - Khi Claude Code CLI hết quota Claude Pro (script trả về `exit code 42` / `[CLAUDE_PRO_QUOTA_EXCEEDED]`) hoặc gặp lỗi kết nối/xác thực (`exit 40/41`):
     - Orchestrator **tự động chuyển giao ngay lập tức** sang subagent `@planner` (chạy mô hình `gemini-4-argon` với thinking budget tối đa) theo định nghĩa tại `.agents/agents/planner/agent.md`.

## 3. Kiến Trúc Dual-Reviewer 2 Kênh & Chuỗi Chuyển Tiếp Không Ngắt Quãng

Hệ thống thẩm định kiến trúc tại Vikini vận hành theo mô hình **Dual-Reviewer Architecture**:

1. **Kênh Thẩm Định Ưu Tiên 1 (Primary Reviewer - Subagent `@reviewer`)**:
   - Sử dụng subagent `@reviewer` chạy mô hình `gemini-4-argon` với thinking budget tối đa (`.agents/agents/reviewer/agent.md`).
   - Thực hiện thẩm định độc lập 7 bước chuẩn mực theo bộ 3 tài liệu vệ tinh (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md`).
   - Dùng `replace_file_content` / `write_to_file` (trong phạm vi **Audit-Only Write Scope**) để ghi trực tiếp mục `### Audit Run [X+1]` vào `## Audit History`, cập nhật dòng `- **Status**:` ở phần Header, và (khi đạt chuẩn) ghi thẻ `[PLAN_APPROVED]` ở dòng cuối cùng của file kế hoạch tại `docs/plans/<task>.md`.
2. **Kênh Thẩm Định Dự Phòng (Fallback Reviewer - Claude Code CLI)**:
   - Khi subagent `@reviewer` chạm giới hạn quota/rate limit (HTTP 429) hoặc gặp sự cố hệ thống:
   - Orchestrator **tự động chuyển giao ngay lập tức** sang Claude Code CLI qua lệnh:
     `powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/<task>.md`
   - Script tự động nạp `.agents/scripts/claude-reviewer-prompt.md` kèm bộ tài liệu vệ tinh để thực hiện thẩm định và ghi kết quả vào `## Audit History`.
3. **Nguyên Tắc "Uninterrupted Execution Chain" & Tự Động Hóa Hoàn Toàn**:
   - Sau khi Planner (Primary Claude CLI hoặc Fallback `@planner`) hoàn thành soạn thảo/cập nhật kế hoạch, Orchestrator lập tức gọi Reviewer (Primary `@reviewer` trước, nếu chạm quota/lỗi thì gọi Fallback Claude CLI `-Role reviewer`). Chuỗi chạy hoàn toàn tự động, không dừng lại xin phép hay hỏi quyền người dùng giữa chừng.
   - **Tối đa 10 vòng lặp revision (Revision Loop)**: Toàn bộ quá trình lập kế hoạch, phản biện và cập nhật kế hoạch giữa Planner và Reviewer vận hành tự động liên tục lên tới 10 vòng lặp. Nếu sau vòng 10 vẫn chưa đạt `[PLAN_APPROVED]`, Circuit Breaker mới kích hoạt để dừng chuỗi và trình User quyết định.

## 4. Tiêu Chuẩn Thẩm Định & Thang Đo Phân Loại Lỗi (Severity Rubric)

Mọi lượt review (dù qua Primary Subagent `@reviewer` hay Fallback Claude CLI) đều bắt buộc đối chiếu theo 3 tài liệu vệ tinh:

- `allowlist.md`: Allowlist lệnh read-only được phép chạy.
- `evidence-bar.md`: Tiêu chuẩn dẫn chứng kỹ thuật (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`).
- `mental-simulation.md`: 6 kịch bản đối kháng S1–S6 (Cold-start, Lifecycle, Database, State, Security, External Resilience) và Domain Inquiry.

**Thang đo phân loại lỗi**:

- **`[BLOCKER]`**: Vi phạm kiến trúc cốt lõi, sai layer boundary (nhúng logic vào `components/ui/`), đưa công nghệ ngoại lai (Prisma, Better Auth) vào Vikini, lỗi bảo mật. ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
- **`[MAJOR]`**: Thiếu co-located test plan cho `lib/`, sót edge cases nghiêm trọng, vi phạm cấm `any`, thiếu Test Contract, thiếu living docs, hoặc kịch bản S1–S5 bị `UNVERIFIED`. ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
- **`[MINOR]`**: Góp ý cú pháp code style, đặt tên biến, tối ưu vi mô. ➔ Không chặn kế hoạch. Reviewer được phép cấp `[PLAN_APPROVED]` kèm `[Advisory Recommendations]`.

## 5. Cấu Trúc File Kế Hoạch & Cơ Chế Phê Duyệt An Toàn

Mọi file kế hoạch trong `docs/plans/*.md` bắt buộc tuân theo cấu trúc phân khu kép:

1. `## Technical Plan`: Khu vực dành cho Planner (Primary Claude CLI hoặc Fallback `@planner`) soạn thảo và cập nhật giải pháp kỹ thuật (khi tạo mới hoặc cập nhật Revision mới, đặt `- **Status**: Ready for Review` ở Header).
2. `## Audit History`: Khu vực dành riêng cho Reviewer (Primary `@reviewer` hoặc Fallback Claude CLI) ghi nhận xét theo từng lượt (`### Audit Run 1`, `### Audit Run 2`...). Reviewer chỉ append vào mục này, cập nhật dòng `- **Status**: Approved` (hoặc `Changes Requested`) ở Header, và tuyệt đối không sửa `## Technical Plan`.

**Cơ Chế Phê Duyệt Của Code Freeze Guard**:

- Thẻ phê duyệt `[PLAN_APPROVED]` **BẮT BUỘC nằm ở dòng văn bản cuối cùng** của file kế hoạch, đồng thời dòng trạng thái ở Header (30 dòng đầu) phải được cập nhật thành `- **Status**: Approved`.
- Khi kế hoạch có Revision mới hoặc đang ở trạng thái pending (`Ready for Review`, `In Review`, `Draft`, `Changes Requested`), thẻ phê duyệt cũ từ Revision trước **tự động vô hiệu hóa** và hệ thống duy trì code freeze cho tới khi Audit Run mới nhất hoàn tất.

## 6. Checklist Bắt Buộc: Pre-Flight Gate

Trước khi xuất bất kỳ phản hồi nào tuyên bố kế hoạch hoàn thành hoặc xin phép mở khóa viết code, Orchestrator BẮT BUỘC tự kiểm tra 3 cổng:

- [ ] **Gate 1 - Plan Persistence**: File kế hoạch đã được Planner (Claude Code CLI `-Role planner` hoặc Fallback `@planner`) ghi đầy đủ vào `docs/plans/`?
- [ ] **Gate 2 - Reviewer Dispatch**: Kế hoạch đã được thẩm định qua Primary Reviewer `@reviewer` (hoặc Fallback Claude Code CLI `-Role reviewer`) chưa?
- [ ] **Gate 3 - Reviewer Approval Token**: File plan đã có `- **Status**: Approved` ở Header và chứa thẻ `[PLAN_APPROVED]` ở dòng cuối cùng do Reviewer cấp chưa?

## 7. Agent Thẩm Định & Nghiệm Thu Thủ Công (@qa)

- Agent `@qa` đóng vai trò là bên thứ ba độc lập chuyên: **Nghiệm thu đối chiếu**, **Verification Gate fail-fast**, **Săn lỗi chuyên sâu**, **Test Integrity Audit**, và **Đề xuất cải tiến**.
- Chỉ kích hoạt khi người dùng gõ `@qa` trong chat (On-Demand). Báo cáo xuất thẻ `[QA_PASSED]` hoặc `[QA_FAILED]`.
