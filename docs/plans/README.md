# Task Implementation Plans (`docs/plans/`)

Thư mục này lưu trữ các bản kế hoạch thực thi (Implementation Plans) cho mọi task phát triển tính năng, tái cấu trúc hoặc sửa lỗi phức tạp trong dự án **Vikini**.

## Quy Định Đặt Tên File

- Định dạng: `YYYY-MM-DD-<task-name>-implementation-plan.md`
- Ví dụ: `2026-09-17-multi-agent-system-implementation-plan.md`

## Chu Trình Plan - Review - Revise Loop

Tất cả các bản kế hoạch trong thư mục này được khởi tạo bởi subagent `@planner` và phê duyệt bởi Lead Reviewer trước khi triển khai (xem chi tiết tại `../../.agents/rules/05-plan-review.md`).

## Ma Trận Kế Hoạch Triển Khai (Implementation Plans Status Matrix)

| Ngày | Kế Hoạch Triển Khai | Trạng Thái | Mô Tả Tóm Tắt |
| 2026-10-12 | [Z.ai GLM 5.2 Model Integration](./2026-10-12-glm-5-2-model-integration-plan.md) | `Completed` | Tích hợp mô hình Z.ai GLM 5.2 (OpenRouter/CoreWeave FP4, 1.05M context), điều khiển reasoning hai chiều, scoped token limit và logo avatar. |
| 2026-10-12 | [E2E Testing & Cycle 2 Security Audit](./2026-10-12-e2e-testing-and-security-audit-cycle-2-implementation-plan.md) | `Approved` | Tự động hóa E2E (Playwright), rà soát bảo mật dependencies (npm audit), hardening 4 hàm RPC SECURITY DEFINER và tối ưu hóa Supabase RLS. |
| 2026-09-29 | [Docs, Rules & Agents Restructuring](./2026-09-29-docs-rules-agents-restructuring-implementation-plan.md) | `Completed` | Tái cấu trúc thư mục docs và hạ tầng tác tử theo chuẩn Diátaxis 2026, tối ưu CHANGELOG và chuẩn hóa đường dẫn. |
| 2026-09-28 | [Supabase CLI TypeGen Automation](./2026-09-28-supabase-cli-typegen-and-immutable-embedding-plan.md) | `Completed` | Thiết lập type generation tự động từ Supabase và thống nhất mô hình embedding `gemini-embedding-2` 3072d. |
| 2026-09-28 | [Fix Streaming Abort Text Loss](./2026-09-28-fix-streaming-abort-text-loss-implementation-plan.md) | `Completed` | Khắc phục mất text khi ngắt stream giữa chừng bằng cơ chế Partial Persistence. |
| 2026-09-27 | [Mobile Sidebar Scroll Fix](./2026-09-27-mobile-sidebar-scroll-fix-implementation-plan.md) | `Completed` | Hợp nhất container cuộn sidebar, khắc phục lỗi không cuộn được trên thiết bị di động. |
| 2026-09-27 | [Adopt Aurora Subagent Rules](./2026-09-27-adopt-aurora-subagent-rules-implementation-plan.md) | `Completed` | Cập nhật quy tắc quản trị đa tác tử và Code Freeze Guard từ Project AURORA. |
| 2026-09-17 | [Multi-Agent Subagent Architecture](./2026-09-17-multi-agent-system-implementation-plan.md) | `Completed` | Triển khai kiến trúc đa tác tử phân tầng (Planner, Reviewer, QA). |
| 2026-09-04 | [Chat Core UX/UI Augmentation](../archive/plans/2026-09-04-chat-core-ux-ui-augmentation.md) | `Archived` | Tinh chỉnh giao diện chat craft-grade và phân tách module ChatBubble. |
