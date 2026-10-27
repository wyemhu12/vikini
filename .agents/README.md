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
                  [ Primary Planner: Claude Code CLI ]
              (run-claude.ps1 -Role planner / Fallback: @planner)
                                  │
                      (Uninterrupted Auto-Loop: Tối đa 10 vòng)
                                  │
                                  ▼
                  [ Primary Reviewer: Subagent @reviewer ]
              (Gemini 4 Argon Max Thinking / Fallback: Claude CLI)
                                  │
                        ┌─────────┴─────────┐
                        │                   │
               [CHANGES_REQUESTED]    [PLAN_APPROVED]
                        │                   │
                        ▼                   ▼
              (Gửi lại Planner sửa)    [ Pre-Flight Gate ]
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
2. **Orchestrator (Dispatcher & Lead Developer)**: Điều phối viên luồng chính. Tuyệt đối không tự lập kế hoạch (Zero-Self-Execution), bắt buộc dispatch sang Planner và Lead Reviewer. Sau khi plan được duyệt, Orchestrator đóng vai trò Lead Developer thực thi code.
3. **Technical Planner (Primary: Claude Code CLI `-Role planner` / Fallback: Subagent `@planner` `gemini-4-argon`)**: Khảo sát codebase, tra cứu công nghệ trực tuyến năm 2026, soạn thảo và cập nhật kế hoạch triển khai chi tiết vào `docs/plans/`.
4. **Lead Reviewer (Primary: Subagent `@reviewer` `gemini-4-argon` / Fallback: Claude Code CLI `-Role reviewer` + Cross-Model Critic `-Role critic`)**: Thẩm định độc lập theo Objective, Fail Criteria và Verification Tools (`node scripts/verify-plan.mjs`), đối chiếu 6 kịch bản Mental Simulation (S1–S6), ghi trực tiếp `### Audit Run [X+1]` với tối thiểu 3 mục `#### Critic Findings` (`file:line`), cập nhật `- **Status**: Approved` (hoặc `Awaiting Critic` cho plan chạm Security/Governance/DB trước khi chạy Cross-Model Critic) và cấp thẻ `[PLAN_APPROVED]`.
5. **Subagent Nghiệm Thu Độc Lập (`@qa`)**: Hoạt động On-Demand (khi người dùng gọi `@qa`), thi hành 7 bước nghiệm thu đối chiếu, Verification Gate, Test Integrity Audit và xuất báo cáo `[QA_PASSED]`.

---

## 2. Bản Đồ Quy Tắc Quản Trị (Rules Catalog)

Mọi hoạt động trên codebase đều bị ràng buộc bởi 6 bộ quy tắc với giới hạn nghiêm ngặt **<= 12,000 ký tự** mỗi tệp (3 tệp `always_on` `< 18,000 ký tự` tổng cộng, kết hợp Progressive Disclosure qua `trigger: glob` và `trigger: model_decision`):

| Quy Tắc | Tên Tệp                                        | Cơ Chế Kích Hoạt (`trigger`)                                              | Trọng Tâm & Ràng Buộc Kỹ Thuật                                                                                             |
| :------ | :--------------------------------------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------- |
| **00**  | [00-core.md](./rules/00-core.md)               | `always_on`                                                               | Giao thức giao tiếp (Tiếng Việt), Tech Stack bất biến, Core Coding & Testing Invariants, Zero-Self-Execution, kỷ luật git. |
| **01**  | [01-coding.md](./rules/01-coding.md)           | `glob` (`*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs`) | TypeScript strict (cấm `any`), xử lý lỗi với `toast.error()`, cấu trúc dự án, chuẩn kích thước tệp (150–400 dòng).         |
| **02**  | [02-quality.md](./rules/02-quality.md)         | `always_on`                                                               | Quy trình Pre-Work, Verification Tiers (1-2-3), Test Failure Triage (Type A/B/C), quy chuẩn Governance.                    |
| **03**  | [03-ui.md](./rules/03-ui.md)                   | `glob` (`*.tsx, *.css, **/*.tsx, **/*.css`)                               | Hệ thống Design Tokens, Tailwind v4 arbitrary syntax `bg-(--surface)`, cấm class shadcn chết, Framer Motion.               |
| **04**  | [04-bilingual.md](./rules/04-bilingual.md)     | `model_decision`                                                          | Bắt buộc song ngữ đồng bộ (VI/EN) cho 100% văn bản giao diện người dùng và thông báo lỗi.                                  |
| **05**  | [05-plan-review.md](./rules/05-plan-review.md) | `always_on`                                                               | Cơ chế Code Freeze Guard, Dual-Planner & Dual-Reviewer Architecture, Uninterrupted Auto-Loop (tối đa 10 vòng lặp).         |

---

## 3. Cơ Chế Chốt Chặn Tầng Nền Tảng (Code Freeze Guard)

Hệ thống sử dụng Hook tự động `PreToolUse` tại [code-freeze-guard.js](./scripts/code-freeze-guard.js) được kích hoạt qua [hooks.json](./hooks.json) và `.claude/settings.json` (`"onFailure": "block"`), áp dụng chính sách **Scoped Protection (Phương án 2)** kết hợp **Plan Scope Guard** và **Token-Level Command Whitelist**:

- **Trước khi có `[PLAN_APPROVED]`**:
  - Tự động cho phép (`allow`) ghi vào `docs/**` (chỉ tệp `.md`) và các artifacts lập kế hoạch.
  - Chặn lại và hỏi xác nhận (`ask`) với mọi thao tác ghi vào `src/**` hoặc lệnh ngoài allowlist token-level (`command-policy.js`), trừ Fast-Track Mode §1.1 (không chứa API side-effect trên `.tsx`).
- **Sau khi có `[PLAN_APPROVED]` (`Plan Scope Guard`)**:
  - Chỉ tự động cho phép (`allow`) ghi vào các tệp không nhạy cảm đã được khai báo rõ với nhãn `[NEW]`/`[MODIFY]`/`[DELETE]` trong `## Technical Plan` của bản kế hoạch đang Approved (`plan-scope.js`); mọi tệp ngoài danh sách khai báo đều trả `ask`.
  - **Luôn Luôn Khóa Chặt (`ask`)**: Đối với 6 danh mục tệp nhạy cảm cốt lõi (so khớp không phân biệt hoa thường trên NTFS):
    - Tệp server chứa secret: `*.server.ts`.
    - Tệp cơ sở dữ liệu: `supabase/migrations/`, `*.sql`.
    - Hạ tầng kiểm thử (`TEST_INFRA_FILES`): `vitest.config.ts`, `eslint.config.mjs`, `package.json`, `tsconfig.json`, `.husky/pre-commit`, `.github/workflows/ci.yml`.
    - Hạ tầng harness & cấu hình (`PROTECTED_INFRA_FILES`): `scripts/code-freeze-guard.js`, `.claude/**`, `.husky/**`, `next.config.ts`, `package-lock.json`, `.npmrc`, `AGENTS.md`, `CLAUDE.md`.
    - Tệp kiểm thử chịu Test Integrity Guard và cấu hình quản trị `.agents/**`.

---

## 4. Agent Task-to-Model Routing Guide

Hướng dẫn lựa chọn mô hình trí tuệ nhân tạo tối ưu chi phí và năng lực cho từng nhóm tác vụ của agent theo kiến trúc **Orchestrator–Worker Split**:

### 4.1. Ma Trận Phân Bổ Tác Vụ Sang Model Tier

| Nhóm Tác Vụ                                   | Khuyến Nghị Model Tier | Mô Hình Cụ Thể (Tháng 10/2026)                                                                                                           | Cơ Sở Lựa Chọn                                                                                                                                                             |
| :-------------------------------------------- | :--------------------: | :--------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lập kế hoạch kiến trúc (Planning)**         |    High / Thinking     | Primary: Claude Code CLI (`run-claude.ps1 -Role planner`) / Fallback: `gemini-4-argon` (`@planner`, `model: inherit`)                    | Tận dụng Claude Pro CLI để khảo sát & viết kế hoạch 10 mục chuẩn xác; fallback sang `gemini-4-argon` max thinking khi chạm quota.                                          |
| **Thẩm định & Review (Reviewing)**            |     Premium / Full     | Primary: `gemini-4-argon` (`@reviewer`, `model: inherit`) / Fallback: Claude Code CLI (`run-claude.ps1 -Role reviewer` / `-Role critic`) | Sử dụng Subagent `@reviewer` kế thừa `Gemini 4 Argon (High)` từ phiên chính để đối kháng logic S1–S6 độc lập, kết hợp Cross-Model Critic bởi Claude CLI cho plan nhạy cảm. |
| **Nghiệm thu & Săn lỗi độc lập (`@qa`)**      |     Premium / Full     | On-Demand `@qa` (`model: inherit` — khuyến nghị chọn `claude-opus-5-5` hoặc `gemini-4-argon` trên thanh chọn model)                      | Nghiệm thu đối chiếu 7 bước, Verification Gate, Test Integrity Audit; báo cáo ghi rõ model thực tế `[QA_MODEL: <active-model>]`.                                           |
| **Phát triển tính năng & Debug phức tạp**     |       Full Model       | `gemini-4-argon` / `claude-opus-5-5` / `claude-sonnet-5-5`                                                                               | Cần phân tích luồng dữ liệu đa tệp, xử lý race conditions và logic nghiệp vụ phức tạp.                                                                                     |
| **Viết Unit Tests & Integration Tests**       |       Full Model       | `gemini-4-argon` / `claude-sonnet-5-5` / `gemini-3.8-flash`                                                                              | Đòi hỏi hiểu sâu boundary conditions, Test Contract và chống specification gaming.                                                                                         |
| **Sửa lỗi chính tả, format, rename đơn giản** |    Smaller / Light     | `gemini-3.8-flash` (Fast Worker — low/minimal thinking)                                                                                  | Thao tác tất định, có khuôn mẫu rõ ràng, phản hồi tức thì, không cần suy luận sâu.                                                                                         |
| **Cập nhật tài liệu văn bản thông thường**    |     Smaller Model      | `gemini-3.8-flash` (Fast Worker)                                                                                                         | Sinh văn bản mô tả chuẩn hóa, độ phức tạp logic thấp, tối ưu chi phí token.                                                                                                |

> **Lưu ý kỹ thuật về `model: inherit` và `Gemini 4 Argon (High)` (Tháng 10/2026)**:
>
> - Trường `model: inherit` trong YAML frontmatter của custom subagent (`.agents/agents/{reviewer,planner,qa}/agent.md`) giúp subagent kế thừa 100% model và mức độ suy luận (ví dụ `Gemini 4 Argon (High)`) đang được chọn ở phiên chat chính (PM cần chọn `Gemini 4 Argon (High)` trên thanh chọn model của main chat trước khi điều phối).
> - Theo tài liệu Google Antigravity Models (`https://antigravity.google/docs/models.md`), `Gemini 4 Argon` khả dụng trên Antigravity App, Antigravity CLI và IDE extensions (không khả dụng trên Antigravity IDE standalone).

### 4.2. Nguyên Tắc Orchestrator–Worker Split & Nhận Thức Chi Phí (Cost Awareness)

- **Phân tách Orchestrator / Deep Reasoning vs. Fast Worker**: Sử dụng Claude Code CLI (Primary Planner) kết hợp `gemini-4-argon` (Primary Reviewer `@reviewer`, Fallback Planner `@planner`, và Fallback `@qa`) cho các tác vụ đòi hỏi suy luận kiến trúc, thẩm định kế hoạch và kiểm toán chất lượng; sử dụng `gemini-3.8-flash` làm Fast Worker cho các tác vụ thực thi nhẹ, có tính tất định cao.
- **Mặc định dùng Full Model khi chưa rõ ràng**: Tính đúng đắn của giải pháp luôn được ưu tiên hơn tiết kiệm chi phí (`Correctness > Cost savings`).
- **Chi phí phát sinh chủ yếu từ vòng lặp retry**: Việc chọn mô hình quá yếu dẫn đến thất bại kiểm thử nhiều lần (fix ➔ verify ➔ fail ➔ fix) sẽ tốn kém token và thời gian gấp nhiều lần so với việc hoàn thành chuẩn xác ngay từ lượt đầu bằng Full Model (`gemini-4-argon`).
- **Tuyệt đối không dùng mô hình yếu cho phần nhạy cảm**: Các tác vụ liên quan đến bảo mật (Auth, RLS, Crypto, Migration) bắt buộc phải sử dụng Full Model.
