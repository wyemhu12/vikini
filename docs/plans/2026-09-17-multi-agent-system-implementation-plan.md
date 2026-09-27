# Kế Hoạch Triển Khai: Tiếp Thu Hệ Thống Subagents (Planner, Reviewer, QA) Từ Project AURORA Vào Vikini

## 1. Mục Tiêu (Goal)

Thiết lập và tích hợp trọn vẹn hệ thống phối hợp đa tác tử chuẩn Antigravity 2.0 kế thừa từ Project AURORA vào Vikini:

- Khởi tạo 3 subagents: `@planner` (Gemini 3.8 Flash), `@reviewer` (Claude Opus 4.6), `@qa` (Claude Opus 4.6).
- Ban hành quy tắc điều phối cưỡng chế `.agents/rules/05-plan-review.md`.
- Cập nhật `.agents/rules/00-core.md` và `.agents/rules/02-quality.md`.
- Khởi tạo thư mục `docs/plans/` cho việc lưu vết kế hoạch dài hạn.
- Cập nhật tài liệu kiến trúc `docs/architecture.md` và `docs/CHANGELOG.md`.

## 2. Ranh Giới Kiến Trúc & Stack (Vikini Alignment)

- Framework: Next.js 16 (App Router), React 19, TypeScript strict mode.
- Database & Auth: Supabase (PostgreSQL + Auth), NextAuth.
- AI Providers: Google Gemini (`@google/genai`), Anthropic Claude (`@anthropic-ai/sdk`), Groq, OpenRouter.
- State: Zustand (client), SWR (server).
- Shared UI: shadcn/ui, Radix primitives, Lucide Icons, Tailwind CSS v4.
- Quality Gate: `npm run verify` (`npm run type-check && npm run lint && npm run test:run`).

## 3. Danh Mục Files

- `[NEW]` `.agents/agents/planner/agent.md`
- `[NEW]` `.agents/agents/reviewer/agent.md`
- `[NEW]` `.agents/agents/qa/agent.md`
- `[NEW]` `.agents/rules/05-plan-review.md`
- `[NEW]` `docs/plans/README.md`
- `[NEW]` `docs/plans/2026-09-17-multi-agent-system-implementation-plan.md`
- `[MODIFY]` `.agents/rules/00-core.md`
- `[MODIFY]` `.agents/rules/02-quality.md`
- `[MODIFY]` `docs/architecture.md`
- `[MODIFY]` `docs/CHANGELOG.md`

## 4. Checklist Thực Hiện

- [x] Khởi tạo `.agents/agents/planner/agent.md` với 7 công cụ chuẩn.
- [x] Khởi tạo `.agents/agents/reviewer/agent.md` với 6 công cụ read-only và Severity Rubric.
- [x] Khởi tạo `.agents/agents/qa/agent.md` với quy trình 4 giai đoạn on-demand.
- [x] Khởi tạo `.agents/rules/05-plan-review.md`.
- [x] Cập nhật Non-Negotiables trong `.agents/rules/00-core.md`.
- [x] Cập nhật Pre-Work Protocol trong `.agents/rules/02-quality.md`.
- [x] Khởi tạo thư mục lưu trữ `docs/plans/`.
- [ ] Cập nhật `docs/architecture.md` bổ sung Mục Kiến Trúc Điều Phối Đa Tác Tử.
- [ ] Cập nhật `docs/CHANGELOG.md`.
- [ ] Chạy Quality Gate `npm run verify`.
- [ ] Kiểm thử nạp subagents qua runtime Antigravity.
