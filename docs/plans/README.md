# Task Implementation Plans (`docs/plans/`)

Thư mục này lưu trữ các bản kế hoạch thực thi (Implementation Plans) cho mọi task phát triển tính năng, tái cấu trúc hoặc sửa lỗi phức tạp trong dự án **Vikini**.

## Quy Định Đặt Tên File

- Định dạng: `YYYY-MM-DD-<task-name>-implementation-plan.md`
- Ví dụ: `2026-09-17-multi-agent-system-implementation-plan.md`

## Chu Trình Plan - Review - Revise Loop

Tất cả các bản kế hoạch trong thư mục này được khởi tạo bởi subagent `@planner` và phê duyệt bởi subagent `@reviewer` trước khi được lập trình viên triển khai (xem chi tiết tại `.agents/rules/05-plan-review.md`).
