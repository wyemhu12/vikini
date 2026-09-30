# Vikini Documentation Hub

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật và kiến trúc của dự án **Vikini** (AI-Powered Monolithic Workspace). Tài liệu được cấu trúc theo khung tiêu chuẩn **Diátaxis (2026)** và nguyên tắc **Agent-Ready Documentation (GEO)** nhằm phục vụ tối ưu cho cả lập trình viên và các AI coding agents.

---

## 1. Documentation Navigation Map

Hệ thống tài liệu được phân loại thành 4 trụ cột thông tin rõ ràng:

| Trụ Cột                                             | Mục Đích                                                                                  | Tài Liệu Trọng Tâm                                                                                                                                                                                                                                                            | Đối Tượng Phục Vụ          |
| :-------------------------------------------------- | :---------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- |
| **Bối Cảnh & Sản Phẩm** (Explanation)               | Bối cảnh dự án, triết lý thiết kế, phạm vi người dùng và tính năng cốt lõi.               | • [Tổng quan hệ thống](./overview.md)<br>• [Catalog AI Models](./models.md)                                                                                                                                                                                                   | PM, Dev, Onboarding Agents |
| **Kiến Trúc & Dữ Liệu** (Architecture & Reference)  | Cấu trúc hệ thống monolithic, lược đồ cơ sở dữ liệu Supabase, bảo mật và hợp đồng API.    | • [Kiến trúc kỹ thuật & MAS](./architecture.md)<br>• [Database Schema & RLS](./database-schema.md)<br>• [Data Contracts & API](./contracts.md)<br>• [Bảo mật & Phân quyền](./security.md)                                                                                     | Lead Dev, Architects, DBAs |
| **Quy Trình & Kỹ Năng** (How-To Guides & Tutorials) | Quy tắc lập trình, giao thức kiểm thử, quy chuẩn giao tiếp tác tử và skills thực thi.     | • [Trung tâm Quản trị Tác tử](../.agents/README.md)<br>• [Quy tắc cốt lõi](../.agents/rules/00-core.md)<br>• [Tiêu chuẩn mã nguồn](../.agents/rules/01-coding.md)<br>• [Cổng chất lượng](../.agents/rules/02-quality.md)<br>• [Danh mục Kỹ năng](../.agents/skills/README.md) | AI Agents, Developers      |
| **Kế Hoạch & Lịch Sử** (Plans & Archive)            | Kế hoạch triển khai kỹ thuật, lịch sử phát hành, bài học kinh nghiệm và tài liệu lưu trữ. | • [Ma trận Kế hoạch](./plans/README.md)<br>• [CHANGELOG Hiện hành](./CHANGELOG.md)<br>• [CHANGELOG Archive](./archive/CHANGELOG-legacy.md)<br>• [Bài học kinh nghiệm](./lessons-learned.md)                                                                                   | QA, Reviewers, Maintenance |

---

## 2. Lộ Trình Đọc Tài Liệu Cho AI Agents & Dev Mới

Khi bắt đầu làm việc trên codebase Vikini, hãy tuân thủ lộ trình định hướng sau:

1. **Bước 1 - Nắm bắt bối cảnh chung**: Đọc [Tổng quan hệ thống](./overview.md) để hiểu phạm vi private tool (5-10 users), cấu trúc monolith và triết lý sản phẩm.
2. **Bước 2 - Hiểu ranh giới kiến trúc**: Đọc [Kiến trúc kỹ thuật](./architecture.md) để nắm ranh giới giữa `app/` (routing mỏng), `lib/core/` (singletons), `lib/features/` (domain logic), và `components/ui/` (shared primitives).
3. **Bước 3 - Nạp quy tắc quản trị**: Đọc [.agents/rules/00-core.md](../.agents/rules/00-core.md), [.agents/rules/01-coding.md](../.agents/rules/01-coding.md), và [.agents/rules/02-quality.md](../.agents/rules/02-quality.md) trước khi thực hiện bất kỳ thay đổi nào.
4. **Bước 4 - Tra cứu hợp đồng trước khi code**: Tra cứu [Data Contracts](./contracts.md) và [Database Schema](./database-schema.md) để không suy đoán kiểu dữ liệu hay API schema.
5. **Bước 5 - Đối soát sau khi hoàn thành**: Cập nhật [CHANGELOG](./CHANGELOG.md) và ghi nhận bài học mới vào [lessons-learned.md](./lessons-learned.md) theo đúng quy trình hậu kiểm.
