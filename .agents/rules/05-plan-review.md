---
trigger: always_on
description: Multi-agent Plan-Review-Revise Loop protocol, strict code freeze, zero-self-execution, uninterrupted chain, pre-flight gate, severity rubric, and runtime fallback.
---

# Giao Thức Plan - Review - Revise Loop & Cơ Chế Cưỡng Chế Thực Thi

## 1. Quy Tắc Đóng Băng Mã Nguồn (Strict Code Freeze)

- TUYỆT ĐỐI KHÔNG MỘT AGENT NÀO (`@planner`, `@reviewer`, hay Orchestrator) được phép tạo mới, chỉnh sửa, thay thế hoặc xóa bất kỳ file source code nào trong dự án (`src/`, `app/`, `lib/`, `components/`, `package.json`, cấu hình hạ tầng,...) khi chưa nhận được thẻ `[PLAN_APPROVED]` từ `@reviewer`.
- Mọi thao tác ghi file trước khi được phê duyệt CHỈ ĐƯỢC GIỚI HẠN trong file kế hoạch nằm tại thư mục `docs/plans/` (ví dụ: `docs/plans/YYYY-MM-DD-<task-name>-implementation-plan.md`) và file artifact `implementation_plan.md`.

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

- **Thẩm định trực tuyến (BẮT BUỘC)**: `@reviewer` (Claude Opus 4.6) BẮT BUỘC phải thực hiện tra cứu web (`search_web`, `read_url_content`) để kiểm tra tính cập nhật của các package/API mà `@planner` đề xuất trong năm 2026.
- **Khảo sát cấu trúc repo (Read-Only)**: `@reviewer` được trang bị các công cụ `list_dir`, `find_by_name`, `grep_search`, `view_file` để kiểm tra sự tồn tại của file, module, import paths và ranh giới kiến trúc Vikini (`app/`, `lib/core/`, `lib/features/`, `components/ui/`). CẤM các công cụ ghi/sửa hoặc chạy lệnh shell.
- **Thang đo phân loại lỗi (Severity Rubric)**:
  - **`[BLOCKER]`**: Vi phạm kiến trúc cốt lõi, sai layer boundary (nhúng logic vào `components/ui/`), dùng thư viện deprecated, lỗi bảo mật Supabase/Auth. ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
  - **`[MAJOR]`**: Thiếu co-located test plan cho `lib/`, sót edge cases nghiêm trọng, vi phạm cấm `any`, thiếu cập nhật living docs (`CHANGELOG.md`, `architecture.md`). ➔ **Bắt buộc** trả `[CHANGES_REQUESTED]` & kích hoạt Revision Loop.
  - **`[MINOR]`**: Góp ý cú pháp code style, đặt tên biến, tối ưu vi mô không ảnh hưởng logic hay kiến trúc. ➔ **Không chặn kế hoạch**. `@reviewer` được phép cấp `[PLAN_APPROVED]` kèm ghi chú `[Advisory Recommendations]` để tránh làm chậm tiến độ (Binary Review Friction).

## 5. Quy Trình Thực Thi, Runtime Fallback & Pre-Flight Gate

### Chuỗi 4 Giai Đoạn

1. **Giai đoạn Soạn thảo (Drafting)**:
   - Tự động ủy quyền (delegate) cho `@planner` (Gemini 3.8 Flash) khảo sát mã nguồn, tra cứu trực tuyến (`search_web`, `read_url_content`), tuân thủ nguyên tắc Minimal Diffs và xuất kế hoạch vào `docs/plans/` và artifact `implementation_plan.md`.
2. **Giai đoạn Đánh giá Trực tuyến (Grounding & Review)**:
   - Chuyển tiếp ngay lập tức cho `@reviewer` (Claude Opus 4.6) tra cứu web, đánh giá toàn diện kế hoạch và trả về kết quả `[CHANGES_REQUESTED]` hoặc `[PLAN_APPROVED]`.
3. **Vòng lặp Sửa chữa (Revision Loop)**:
   - Nếu nhận thẻ `[CHANGES_REQUESTED]` (chỉ khi có lỗi `[BLOCKER]` hoặc `[MAJOR]`), gửi lại phản hồi cho `@planner`. `@planner` ưu tiên xử lý dứt điểm `[BLOCKER]` và `[MAJOR]`, cập nhật trực tiếp tại chỗ (in-place) trên file kế hoạch trong `docs/plans/`. Lặp lại bước 2 (tối đa **3 lần**).
4. **Mở khóa Code (Unfreeze & Implementation)**:
   - Chuỗi chỉ dừng lại khi xuất hiện thẻ `[PLAN_APPROVED]`. Sau đó xuất báo cáo tóm tắt cho Product Manager (User) để xin phê duyệt cuối cùng trước khi viết code thực tế.

### Cơ Chế Runtime Fallback Model

- Khi Orchestrator dispatch `@reviewer` hoặc `@qa` (chạy model Claude Opus) gặp lỗi Rate Limit / Quota Exceeded (HTTP 429), Orchestrator **tự động bắt ngoại lệ** và **tái triệu hồi ngay lập tức** subagent đó với `Model: flash` (`gemini-3.8-flash`). Subagent tái triệu hồi kế thừa 100% prompt và ràng buộc bất biến, bảo đảm chuỗi Uninterrupted Execution Chain không bao giờ bị đứt gãy.

### Checklist Bắt Buộc: Pre-Flight Gate

Trước khi xuất bất kỳ phản hồi nào tuyên bố kế hoạch hoàn thành hoặc xin phép mở khóa viết code, Orchestrator BẮT BUỘC phải tự kiểm tra 3 cổng:

- [ ] **Gate 1 - Plan Persistence**: File kế hoạch đã được ghi đầy đủ và hợp lệ vào `docs/plans/`?
- [ ] **Gate 2 - Independent Review Dispatch**: Kế hoạch đã được chuyển giao cho `@reviewer` tra cứu trực tuyến và đánh giá chưa?
- [ ] **Gate 3 - Reviewer Approval Token**: Ngữ cảnh có chứa thẻ `[PLAN_APPROVED]` được cấp trực tiếp từ subagent `@reviewer` chưa?

> ⚠️ **Chế tài**: Nếu THIẾU thẻ `[PLAN_APPROVED]` từ `@reviewer`, mọi phản hồi xin phép code hoặc tuyên bố xong plan đều bị coi là vi phạm chất lượng nghiêm trọng. Cấm Orchestrator tự sinh ra thẻ `[PLAN_APPROVED]`.

## 6. Agent Thẩm Định & Nghiệm Thu Thủ Công (@qa)

- Agent `@qa` đóng vai trò là bên thứ ba độc lập chuyên: **Nghiệm thu đối chiếu**, **Săn lỗi chuyên sâu**, và **Đề xuất cải tiến**.
- Orchestrator TUYỆT ĐỐI KHÔNG tự động gọi `@qa`. Chỉ kích hoạt khi người dùng gõ `@qa` trong chat (chế độ On-Demand).
- Báo cáo của `@qa` xuất ra định dạng chuẩn hóa kèm thẻ `[QA_PASSED]` hoặc `[QA_FAILED]`, phân cấp lỗi `[Critical]`, `[Major]`, `[Minor]`, và gợi ý cải tiến (Quick Wins vs. Long-term).
- `@qa` tuyệt đối không tự ý chỉnh sửa source code dự án khi người dùng chưa phê duyệt.
