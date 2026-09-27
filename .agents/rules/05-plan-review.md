---
trigger: always_on
description: Multi-agent Plan-Review-Revise Loop protocol, strict code freeze, platform hook guard, zero-self-execution, uninterrupted chain, pre-flight gate, severity rubric, and runtime fallback.
---

# Giao Thức Plan - Review - Revise Loop & Cơ Chế Cưỡng Chế Thực Thi

## 1. Quy Tắc Đóng Băng Mã Nguồn & Chốt Chặn Hook Tự Động (Code Freeze)

- **Nguyên Tắc Cốt Lõi**: TUYỆT ĐỐI KHÔNG MỘT AGENT NÀO (`@planner`, `@reviewer`, hay Orchestrator) được phép tạo mới, chỉnh sửa, thay thế hoặc xóa bất kỳ file source code nào trong dự án (`src/`, `app/`, `lib/`, `components/`, `package.json`, cấu hình hạ tầng,...) khi chưa nhận được thẻ `[PLAN_APPROVED]` từ `@reviewer`.
- **Ngoại Lệ Cho Phép Trước Khi Duyệt Plan**: Mọi thao tác ghi file trước khi được phê duyệt CHỈ ĐƯỢC PHÉP trên bề mặt kế hoạch (`docs/plans/` và artifact ngoài repo tại `~/.gemini/antigravity/brain/`).
- **Cơ Chế Cưỡng Chế Tầng Platform (Platform Hook Guard)**:
  - Hệ thống trang bị hook tự động `PreToolUse` (`.agents/scripts/code-freeze-guard.js`) bắt mọi thao tác `write_to_file`, `replace_file_content` và `run_command`.
  - **Chính Sách Scoped Protection (Phương án 2 đã chọn)**:
    1. _Trước khi có `[PLAN_APPROVED]`_: Mọi thao tác ghi vào `src/**` hoặc lệnh ngoài allowlist đều bị hook chặn lại và hỏi người dùng (`ask`).
    2. _Sau khi có `[PLAN_APPROVED]`_: Tự động cho phép (`allow`) ghi vào các file UI components, hooks, và business logic thông thường để giảm thiểu friction phát triển.
    3. _File Nhạy Cảm Luôn Bị Khóa_: Hook LUÔN LUÔN chặn và hỏi xác nhận người dùng (`ask`) đối với các file cốt lõi:
       - File server chứa secret/auth: `*.server.ts` (ví dụ `src/lib/core/supabase.server.ts`).
       - File database migrations (`supabase/migrations/`, `database-migrations/`, `*.sql`).
       - Cấu hình hạ tầng kiểm thử (`TEST_INFRA_FILES`: `vitest.config.ts`, `eslint.config.mjs`, `package.json`, `tests/setup.ts`, `tsconfig.json`).
       - File test chịu sự bảo vệ của Test Integrity Guard.
       - File cấu hình quản trị tác tử (`.agents/**`).

## 2. Nguyên Tắc "Zero-Self-Execution" (Chống Tự Kiêm Nhiệm)

- Orchestrator (luồng chính) chỉ đóng vai trò Điều Phối Viên (Workflow Orchestrator & Dispatcher). Orchestrator **TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ KIÊM NHIỆM** công việc của Subagent.
- **Ràng buộc bắt buộc**: Bất kể Orchestrator đang chạy mô hình nào (Gemini Flash, Pro, hay Claude Opus,...), khi nhận yêu cầu lập kế hoạch hoặc khảo sát task mới, Orchestrator **BẮT BUỘC 100%** phải ủy quyền (dispatch) thông qua lệnh gọi subagent `@planner`.
- **Hành vi bị cấm**:
  - Tự khảo sát codebase rồi tự viết kế hoạch trên luồng chính.
  - Tự đóng vai `@planner` để ghi file kế hoạch mà không dispatch subagent.

## 3. Nguyên Tắc "Uninterrupted Execution Chain" (Chuỗi Phân Công Không Ngắt Quãng)

- Quy trình phân công lập và duyệt kế hoạch là một luồng thực thi tự động, khép kín và liên tục:
  $$\text{Task nhận} \longrightarrow \text{Dispatch } @\text{planner} \longrightarrow \text{Nhận plan nháp} \longrightarrow \text{Lập tức Dispatch } @\text{reviewer} \longrightarrow \text{Thẩm định online}$$
- **Ràng buộc bắt buộc**: Sau khi subagent `@planner` hoàn thành soạn thảo kế hoạch, Orchestrator **TUYỆT ĐỐI KHÔNG ĐƯỢC TẠM DỪNG** để xin ý kiến người dùng hay yêu cầu xác nhận bản thảo.
- **Quy tắc chuyển tiếp**: Orchestrator phải lập tức chuyển giao kế hoạch sang subagent `@reviewer` (Claude Opus 4.6). Chuỗi chỉ được phép dừng lại xin ý kiến Product Manager (User) **KHI VÀ CHỈ KHI** subagent `@reviewer` đã chính thức cấp thẻ `[PLAN_APPROVED]`.

## 4. Thẩm Định Trực Tuyến & Thang Đo Phân Loại Lỗi (Severity Rubric)

- **Thẩm định trực tuyến (BẮT BUỘC)**: `@reviewer` BẮT BUỘC thực hiện tra cứu web (`search_web`, `read_url_content`) kiểm tra tính cập nhật của các package/API năm 2026.
- **Tiêu chuẩn Bằng chứng & Mô phỏng đối kháng**:
  - Bắt buộc nạp đủ 3 tài liệu vệ tinh: `allowlist.md`, `evidence-bar.md` (chứng cứ `[CMD]`, `[SRC]`, `[ADV]`, `[URL]`), và `mental-simulation.md` (kịch bản S1–S6 + Domain).
  - Được phép chạy các lệnh kiểm chứng read-only trong `allowlist.md` qua `run_command`. CẤM TUYỆT ĐỐI lệnh mutating.
- **Thang đo phân loại lỗi (Severity Rubric)**:
  - **`[BLOCKER]`**: Vi phạm kiến trúc cốt lõi, sai layer boundary (nhúng logic vào `components/ui/`), đưa công nghệ ngoại lai (Prisma, Better Auth) vào Vikini, lỗi bảo mật Supabase/Auth. ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
  - **`[MAJOR]`**: Thiếu co-located test plan cho `lib/`, sót edge cases nghiêm trọng, vi phạm cấm `any`, thiếu Test Contract, thiếu living docs (`CHANGELOG.md`, `architecture.md`), hoặc kịch bản S1–S5 bị `UNVERIFIED`. ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
  - **`[MINOR]`**: Góp ý cú pháp code style, đặt tên biến, tối ưu vi mô không ảnh hưởng logic hay kiến trúc. ➔ **Không chặn kế hoạch**. `@reviewer` được phép cấp `[PLAN_APPROVED]` kèm ghi chú `[Advisory Recommendations]`.

## 5. Quy Trình Thực Thi, Runtime Fallback, Circuit Breaker & Pre-Flight Gate

### Chuỗi 4 Giai Đoạn

1. **Giai đoạn Soạn thảo (Drafting)**:
   - Tự động ủy quyền (delegate) cho `@planner` (Gemini 3.8 Flash) khảo sát mã nguồn, tra cứu trực tuyến (`search_web`, `read_url_content`), tuân thủ nguyên tắc Minimal Diffs và xuất kế hoạch vào `docs/plans/` và artifact `implementation_plan.md`.
2. **Giai đoạn Đánh giá Trực tuyến (Grounding & Review)**:
   - Chuyển tiếp ngay lập tức cho `@reviewer` (Claude Opus 4.6) tra cứu web, chạy lệnh verification và trả về kết quả `[CHANGES_REQUESTED]` hoặc `[PLAN_APPROVED]`.
3. **Vòng lặp Sửa chữa (Revision Loop) & Circuit Breaker**:
   - Nếu nhận thẻ `[CHANGES_REQUESTED]` (khi có lỗi `[BLOCKER]` hoặc `[MAJOR]`), gửi lại phản hồi cho `@planner`. `@planner` cập nhật in-place trên file kế hoạch. Lặp lại bước 2 (tối đa **3 vòng lặp**).
   - **Circuit Breaker Khi Thất Bại Vòng 3**: Nếu sau vòng thứ 3 `@reviewer` vẫn trả về `[CHANGES_REQUESTED]`, Orchestrator **BẮT BUỘC DỪNG CHUỖI TỰ ĐỘNG NGAY LẬP TỨC**. Orchestrator tổng hợp bản kế hoạch hiện tại cùng toàn bộ danh sách lỗi `[BLOCKER]`/`[MAJOR]` tồn đọng, xuất báo cáo chi tiết trình Product Manager (User) để xin định hướng xử lý tiếp theo.
4. **Mở khóa Code (Unfreeze & Implementation)**:
   - Chuỗi chỉ hoàn thành khi xuất hiện thẻ `[PLAN_APPROVED]`. Sau đó xuất báo cáo tóm tắt cho Product Manager (User) để xin phê duyệt cuối cùng trước khi viết code thực tế.

### Cơ Chế Runtime Fallback Model

- Khi Orchestrator dispatch `@reviewer` hoặc `@qa` (chạy model Claude Opus) gặp lỗi Rate Limit / Quota Exceeded (HTTP 429), Orchestrator **tự động bắt ngoại lệ** và **tái triệu hồi ngay lập tức** subagent đó với `Model: flash` (`gemini-3.8-flash`) với thinking budget tối đa (High/Max).
- Subagent chạy chế độ fallback **BẮT BUỘC hiển thị nhãn `[FALLBACK_MODEL: gemini-3.8-flash]`** ở đầu báo cáo để bảo đảm tính minh bạch.

### Checklist Bắt Buộc: Pre-Flight Gate

Trước khi xuất bất kỳ phản hồi nào tuyên bố kế hoạch hoàn thành hoặc xin phép mở khóa viết code, Orchestrator BẮT BUỘC phải tự kiểm tra 3 cổng:

- [ ] **Gate 1 - Plan Persistence**: File kế hoạch đã được ghi đầy đủ và hợp lệ vào `docs/plans/`?
- [ ] **Gate 2 - Independent Review Dispatch**: Kế hoạch đã được chuyển giao cho `@reviewer` tra cứu trực tuyến và đánh giá chưa?
- [ ] **Gate 3 - Reviewer Approval Token**: Ngữ cảnh có chứa thẻ `[PLAN_APPROVED]` được cấp trực tiếp từ subagent `@reviewer` chưa?

> ⚠️ **Chế tài**: Nếu THIẾU thẻ `[PLAN_APPROVED]` từ `@reviewer`, mọi phản hồi xin phép code hoặc tuyên bố xong plan đều bị coi là vi phạm chất lượng nghiêm trọng. Cấm Orchestrator tự sinh ra thẻ `[PLAN_APPROVED]`.

## 6. Agent Thẩm Định & Nghiệm Thu Thủ Công (@qa)

- Agent `@qa` đóng vai trò là bên thứ ba độc lập chuyên: **Nghiệm thu đối chiếu**, **Verification Gate fail-fast**, **Săn lỗi chuyên sâu**, **Test Integrity Audit** (chống specification gaming), và **Đề xuất cải tiến**.
- Orchestrator TUYỆT ĐỐI KHÔNG tự động gọi `@qa`. Chỉ kích hoạt khi người dùng gõ `@qa` trong chat (chế độ On-Demand).
- Báo cáo của `@qa` xuất ra định dạng chuẩn hóa kèm thẻ `[QA_PASSED]` hoặc `[QA_FAILED]`, phân cấp lỗi `[BLOCKER]`, `[MAJOR]`, `[MINOR]`, và gợi ý cải tiến (Quick Wins vs. Long-term).
- `@qa` tuyệt đối không tự ý chỉnh sửa source code dự án khi người dùng chưa phê duyệt.
