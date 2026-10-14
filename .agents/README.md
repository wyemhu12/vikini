# Vikini Multi-Agent Governance Hub (`.agents/`)

Thư mục `.agents/` là trung tâm điều hành, cấu hình và quản trị hệ thống đa tác tử (**Multi-Agent System - MAS**) của dự án **Vikini**, tuân thủ nguyên tắc Antigravity 2.0 và quy chuẩn quản trị nghiêm ngặt năm 2026.

---

## 1. Kiến Trúc Phối Hợp Đa Tác Tử (MAS Workflow)

Hệ thống phân định rõ ràng trách nhiệm giữa người dùng và các tác tử chuyên biệt:

```text
User (PM / QA) ──[Task]──▶ Orchestrator (Main Thread / Dispatcher)
                                  │
                        (Zero-Self-Execution)
                                  │
                                  ▼
                          [ @planner Subagent ]
                           (Khảo sát & Lập Kế hoạch)
                                  │
                      (Uninterrupted Auto-Loop: Tối đa 10 vòng)
                                  │
                                  ▼
                         [ Lead Architecture Reviewer ]
                   (Claude Opus 5.5 CLI / Fallback Gemini 4 Argon)
                                  │
                        ┌─────────┴─────────┐
                        │                   │
               [CHANGES_REQUESTED]    [PLAN_APPROVED]
                        │                   │
                        ▼                   ▼
             (Gửi lại @planner sửa)   [ Pre-Flight Gate ]
                                            │
                                            ▼
                                   [ Trình PM Duyệt Code ]
                                            │
                                            ▼
                                   [ Unfreeze & Triển Khai ]
                                            │
                                            ▼
                                   [ npm run verify ]
```

### Các Vai Trò Cốt Lõi:

1. **User (Product Manager & QA)**: Đặt yêu cầu, định hướng sản phẩm, nghiệm thu chất lượng. Không chạm vào mã nguồn (Zero code touch).
2. **Orchestrator (Dispatcher & Lead Developer)**: Điều phối viên luồng chính. Tuyệt đối không tự lập kế hoạch (Zero-Self-Execution), bắt buộc dispatch sang subagent `@planner` và Lead Reviewer. Sau khi plan được duyệt, Orchestrator đóng vai trò Lead Developer thực thi code.
3. **Subagent `@planner`**: Khảo sát codebase, tra cứu công nghệ trực tuyến năm 2026, soạn thảo kế hoạch triển khai chi tiết vào `docs/plans/`.
4. **Lead Reviewer (Claude Code CLI / Subagent `@reviewer`)**: Thẩm định độc lập 7 bước, đối chiếu 6 kịch bản Mental Simulation (S1–S6), kiểm chứng lệnh read-only, cấp thẻ `[PLAN_APPROVED]`.
5. **Subagent Nghiệm Thu Độc Lập (`@qa`)**: Hoạt động On-Demand (khi người dùng gọi `@qa`), thi hành 7 bước nghiệm thu đối chiếu, Verification Gate, Test Integrity Audit và xuất báo cáo `[QA_PASSED]`.

---

## 2. Bản Đồ Quy Tắc Quản Trị (Rules Catalog)

Mọi hoạt động trên codebase đều bị ràng buộc bởi 6 bộ quy tắc với giới hạn nghiêm ngặt **<= 12,000 ký tự** mỗi tệp:

| Quy Tắc | Tên Tệp                                        | Trọng Tâm & Ràng Buộc Kỹ Thuật                                                                                     |
| :------ | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **00**  | [00-core.md](./rules/00-core.md)               | Giao thức giao tiếp (Tiếng Việt), Technology Stack bất biến, Zero-Self-Execution, cấm tự ý git.                    |
| **01**  | [01-coding.md](./rules/01-coding.md)           | TypeScript strict (cấm `any`), xử lý lỗi với `toast.error()`, cấu trúc dự án, chuẩn kích thước tệp (150–400 dòng). |
| **02**  | [02-quality.md](./rules/02-quality.md)         | Quy trình Pre-Work, Verification Tiers (1-2-3), Test Failure Triage (Type A/B/C), quy chuẩn Governance.            |
| **03**  | [03-ui.md](./rules/03-ui.md)                   | Hệ thống Design Tokens, Tailwind v4 arbitrary syntax `bg-(--surface)`, cấm class shadcn chết, Framer Motion.       |
| **04**  | [04-bilingual.md](./rules/04-bilingual.md)     | Bắt buộc song ngữ đồng bộ (VI/EN) cho 100% văn bản giao diện người dùng và thông báo lỗi.                          |
| **05**  | [05-plan-review.md](./rules/05-plan-review.md) | Cơ chế Code Freeze Guard, Dual-Reviewer Architecture, Uninterrupted Auto-Loop (tối đa 10 vòng lặp).                |

---

## 3. Cơ Chế Chốt Chặn Tầng Nền Tảng (Code Freeze Guard)

Hệ thống sử dụng Hook tự động `PreToolUse` tại [code-freeze-guard.js](./scripts/code-freeze-guard.js) được kích hoạt qua [hooks.json](./hooks.json), áp dụng chính sách **Scoped Protection (Phương án 2)**:

- **Trước khi có `[PLAN_APPROVED]`**:
  - Tự động cho phép (`allow`) ghi vào `docs/**` và các artifacts lập kế hoạch.
  - Chặn lại và hỏi xác nhận (`ask`) với mọi thao tác ghi vào `src/**` hoặc lệnh ngoài allowlist.
- **Sau khi có `[PLAN_APPROVED]`**:
  - Tự động cho phép (`allow`) ghi vào các tệp UI components, hooks, và business logic thông thường.
  - **Luôn Luôn Khóa Chặt (`ask`)**: Đối với các tệp nhạy cảm cốt lõi:
    - Tệp server chứa secret: `*.server.ts`.
    - Tệp cơ sở dữ liệu: `supabase/migrations/`, `*.sql`.
    - Hạ tầng kiểm thử: `vitest.config.ts`, `eslint.config.mjs`, `package.json`, `tsconfig.json`.
    - Tệp kiểm thử chịu Test Integrity Guard và cấu hình quản trị `.agents/**`.

---

## 4. Agent Task-to-Model Routing Guide

Hướng dẫn lựa chọn mô hình trí tuệ nhân tạo tối ưu chi phí và năng lực cho từng nhóm tác vụ của agent theo kiến trúc **Orchestrator–Worker Split**:

### 4.1. Ma Trận Phân Bổ Tác Vụ Sang Model Tier

| Nhóm Tác Vụ                                   | Khuyến Nghị Model Tier | Mô Hình Cụ Thể (2026)                                           | Cơ Sở Lựa Chọn                                                                         |
| :-------------------------------------------- | :--------------------: | :-------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **Lập kế hoạch kiến trúc (Planning)**         |    High / Thinking     | `gemini-4-argon` (max thinking) / `claude-opus-5-5`             | Cần khả năng tổng hợp ngữ cảnh rộng (1M context) và suy luận chiến lược sâu đa tầng.   |
| **Thẩm định & Review (Reviewing)**            |     Premium / Full     | `claude-opus-5-5` (Claude Pro CLI) / Fallback: `gemini-4-argon` | Yêu cầu đối kháng logic khắt khe (S1–S6), phát hiện edge cases và lỗi kiến trúc.       |
| **Phát triển tính năng & Debug phức tạp**     |       Full Model       | `gemini-4-argon` / `claude-sonnet-5-5` / `gemini-3.8-flash`     | Cần phân tích luồng dữ liệu đa tệp, xử lý race conditions và logic nghiệp vụ phức tạp. |
| **Viết Unit Tests & Integration Tests**       |       Full Model       | `gemini-4-argon` / `gemini-3.8-flash` / `claude-sonnet-5-5`     | Đòi hỏi hiểu sâu boundary conditions, Test Contract và chống specification gaming.     |
| **Sửa lỗi chính tả, format, rename đơn giản** |    Smaller / Light     | `gemini-3.8-flash` (Fast Worker — low/minimal thinking)         | Thao tác tất định, có khuôn mẫu rõ ràng, phản hồi tức thì, không cần suy luận sâu.     |
| **Cập nhật tài liệu văn bản thông thường**    |     Smaller Model      | `gemini-3.8-flash` (Fast Worker)                                | Sinh văn bản mô tả chuẩn hóa, độ phức tạp logic thấp, tối ưu chi phí token.            |

### 4.2. Nguyên Tắc Orchestrator–Worker Split & Nhận Thức Chi Phí (Cost Awareness)

- **Phân tách Orchestrator / Deep Reasoning vs. Fast Worker**: Sử dụng `gemini-4-argon` (hoặc `claude-opus-5-5`) cho các tác vụ đòi hỏi suy luận kiến trúc, thẩm định kế hoạch (`@reviewer` fallback) và kiểm toán chất lượng (`@qa` fallback); sử dụng `gemini-3.8-flash` làm Fast Worker cho các tác vụ thực thi nhẹ, có tính tất định cao.
- **Mặc định dùng Full Model khi chưa rõ ràng**: Tính đúng đắn của giải pháp luôn được ưu tiên hơn tiết kiệm chi phí (`Correctness > Cost savings`).
- **Chi phí phát sinh chủ yếu từ vòng lặp retry**: Việc chọn mô hình quá yếu dẫn đến thất bại kiểm thử nhiều lần (fix ➔ verify ➔ fail ➔ fix) sẽ tốn kém token và thời gian gấp nhiều lần so với việc hoàn thành chuẩn xác ngay từ lượt đầu bằng Full Model (`gemini-4-argon`).
- **Tuyệt đối không dùng mô hình yếu cho phần nhạy cảm**: Các tác vụ liên quan đến bảo mật (Auth, RLS, Crypto, Migration) bắt buộc phải sử dụng Full Model.
