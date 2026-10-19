# Vikini Agent Skills Catalog (`.agents/skills/`)

Thư mục `.agents/skills/` chứa toàn bộ các bản hướng dẫn kỹ năng chuyên sâu (Domain Skills) được đóng gói sẵn để các AI coding agents nạp vào ngữ cảnh làm việc khi thực hiện các tác vụ kỹ thuật cụ thể trong dự án **Vikini**.

---

## 1. Phân Loại Danh Mục Kỹ Năng

Hệ thống kỹ năng được chia thành 3 phân nhóm chức năng rõ ràng:

### A. Nhóm Core Vikini Backend & Fullstack

Các kỹ năng phục vụ trực tiếp kiến trúc cốt lõi của Vikini (Next.js 16, Supabase, AI Streaming, API Routes):

- [streaming-patterns](./streaming-patterns/SKILL.md): Chuẩn giao tiếp SSE Stream, xử lý events (`token`, `meta`, `thinking`, `done`, `error`), cơ chế hủy stream (AbortSignal listener), và partial persistence.
- [database-migration](./database-migration/SKILL.md): Quy trình di chuyển cơ sở dữ liệu Supabase, kiểm tra RLS (Row Level Security), cascade constraints và indexes hiệu năng cao.
- [api-patterns](./api-patterns/SKILL.md): Cấu trúc API Route chuẩn mực (Validate ➔ Execute ➔ Respond), xử lý lỗi với `AppError`, xác thực bắt buộc qua `requireUser()`.
- [add-feature](./add-feature/SKILL.md): Quy trình thêm tính năng mới tuần tự theo đúng ranh giới kiến trúc.
- [add-model](./add-model/SKILL.md): Quy trình thêm mô hình AI mới vào registry và cấu hình provider.
- [add-translation](./add-translation/SKILL.md): Hướng dẫn bổ sung khóa dịch song ngữ an toàn kiểu (Type-safe i18n).

### B. Nhóm Frontend Taste & Motion Polish

Các kỹ năng nâng tầm trải nghiệm thị giác và vi tương tác:

- [animation-vocabulary](./animation-vocabulary/SKILL.md): Từ điển chuyển động (Spring, Ease, Stagger, Exit transitions).
- [emil-design-eng](./emil-design-eng/SKILL.md): Triết lý vi tương tác tinh tế, animation craft-grade và độ phản hồi tức thì.
- [review-animations](./review-animations/SKILL.md): Quy trình rà soát và tối ưu hóa hiệu năng render animation.

### C. Nhóm Vikini Workflow Skills

Các kỹ năng quy trình điều tra kiến trúc (read-only) và rút gọn mã nguồn (behavior-preserving):

- [vikini-investigate](./vikini-investigate/SKILL.md): 4 chế độ điều tra read-only (`/how`, `/why`, `/recall`, `/blast-radius`) trước khi sửa các module dùng chung.
- [vikini-simplify](./vikini-simplify/SKILL.md): Quy trình rút gọn code, xóa dead code và làm phẳng luồng điều khiển mà không thay đổi hành vi runtime.

---

## 2. Bảng Chỉ Dẫn Định Tuyến Kỹ Năng (Task-to-Skill Routing)

Thứ tự ưu tiên: **Vikini-First, Superpowers-Complementary** (xem [.agents/rules/02-quality.md](../rules/02-quality.md)). Trước khi viết mã nguồn, agent BẮT BUỘC tra cứu bảng dưới đây và nạp tài liệu kỹ năng tương ứng:

| Miền Nghiệp Vụ Cần Thao Tác                                      | Kỹ Năng Bắt Buộc Phải Đọc                                                   | Quy Chuẩn Ràng Buộc                                                                           |
| :--------------------------------------------------------------- | :-------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **Chat & AI Streaming**                                          | [.agents/skills/streaming-patterns/SKILL.md](./streaming-patterns/SKILL.md) | Bắt buộc hỗ trợ thinking block, abort listener và partial saving.                             |
| **Database, Schema, RLS**                                        | [.agents/skills/database-migration/SKILL.md](./database-migration/SKILL.md) | Bắt buộc bật RLS cho 100% bảng mới; cascade foreign keys.                                     |
| **API Route & Backend Helper**                                   | [.agents/skills/api-patterns/SKILL.md](./api-patterns/SKILL.md)             | Luôn dùng `requireUser()`, validate Zod schema trước khi execute.                             |
| **Thêm Tính Năng Mới**                                           | [.agents/skills/add-feature/SKILL.md](./add-feature/SKILL.md)               | Tuân thủ ranh giới layer: `app/` mỏng, logic tại `lib/features/`.                             |
| **Tích Hợp AI Model Mới**                                        | [.agents/skills/add-model/SKILL.md](./add-model/SKILL.md)                   | Xác minh SDK năm 2026, cập nhật registry và types.                                            |
| **Văn Bản UI / Thêm Khóa Dịch**                                  | [.agents/skills/add-translation/SKILL.md](./add-translation/SKILL.md)       | Đồng bộ cả `vi.ts` và `en.ts` theo [.agents/rules/04-bilingual.md](../rules/04-bilingual.md). |
| **Câu Hỏi Kiến Trúc / Lịch Sử / Khôi Phục Ngữ Cảnh**             | [.agents/skills/vikini-investigate/SKILL.md](./vikini-investigate/SKILL.md) | Read-only tuyệt đối (`/how`, `/why`, `/recall`), có dẫn chứng `[SRC]`/`[CMD]`.                |
| **Sửa Module Dùng Chung (`src/lib/core/`, `src/lib/features/`)** | [.agents/skills/vikini-investigate/SKILL.md](./vikini-investigate/SKILL.md) | Chạy `/blast-radius` lập bảng callers và co-located tests bị ảnh hưởng.                       |
| **Rút Gọn / Dọn Dead Code**                                      | [.agents/skills/vikini-simplify/SKILL.md](./vikini-simplify/SKILL.md)       | Giữ nguyên hành vi runtime; chứng minh 0 tham chiếu bằng `grep_search`.                       |
| **Chỉnh Sửa Giao Diện & Animation**                              | [.agents/skills/emil-design-eng/SKILL.md](./emil-design-eng/SKILL.md)       | Tuân thủ [.agents/rules/03-ui.md](../rules/03-ui.md) và hệ thống Design Tokens.               |
