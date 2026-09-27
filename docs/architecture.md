# Architecture & System Overview

## 1. Technology Stack

### Core

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Runtime**: Node.js 24.x

### UI & Styling

- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

### Data & Backend

- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication**: Supabase Auth
- **Caching & Rate Limiting**: [Upstash Redis](https://upstash.com/)
- **ORM/Query**: Standard Postgres client / Supabase JS

### AI & Intelligence

- **Primary LLM**: [Google Gemini](https://ai.google.dev/) (`@google/genai`)
- **Additional Providers**: Anthropic Claude (`claudeClient.ts`), Groq (`groqClient.ts`), OpenRouter (`openRouterClient.ts`)
- **Orchestration**: Custom streaming implementation

### State Management

- **Client State**: [Zustand](https://github.com/pmndrs/zustand)
- **Server State**: [SWR](https://swr.vercel.app/)

## 2. Project Structure

All source code is organized under the `src/` directory.

### `src/app/` (Application Layer)

Follows the Next.js App Router conventions.

- `api/`: Backend API routes (Chat stream, Gems, etc.)
- `auth/`: Authentication related routes.
- `features/`: Feature-specific UI Layouts and Components (Chat, Gems, Sidebar).
- `globals.css`: Global styles and Tailwind directives.

### `src/lib/` (Logic Layer)

Separation of concerns between UI and business logic.

- `core/`: Singleton clients and core infrastructure (Supabase, Gemini, Redis wrappers).
- `features/`: Business logic, hooks, and types for specific domains (Chat, Files, Gems).
- `utils/`: Shared utility functions.

### `src/components/` (Shared UI)

- `ui/`: Reusable primitive components (shadcn/ui based, themed via Vikini tokens — see Design System below).
- `features/`: Feature-specific shared components (e.g., `projects/`).

### Design System (Tokens & Primitives)

> Single source of truth for the visual language. See `rules/03-ui.md` for the enforced standards.

- **Token vocabulary** (defined in `app/styles/themes/_shared/base.css`, overridden per theme in
  `app/styles/themes/`): surfaces (`--surface`, `--surface-muted`, `--surface-elevated`), text
  (`--text-primary`, `--text-secondary`), controls (`--control-bg`, `--control-bg-hover`,
  `--control-border`), `--border`, brand `--accent` (+ `--accent-foreground`), state colors
  (`--danger`, `--success`, `--warning`), and shared `--ring` / `--radius` / `--overlay`.
- **Tailwind v4 note**: there is **no `@config`**, so `tailwind.config.ts` color names
  (`bg-primary`, `bg-destructive`, `bg-background`, …) are **inert and must not be used**.
  Reference tokens with the arbitrary syntax instead: `bg-(--surface-elevated)`,
  `text-(--text-primary)`, `border-(--border)`, `ring-(--ring)`.
- **Canonical primitives** (`components/ui/`): `Button`, `Dialog`/`AlertDialog` (Radix —
  focus-trap + ESC built in), `Input`, `Textarea`, `Card`, `Select`, `Switch`, `Popover`,
  `DropdownMenu`, `Skeleton` (loading), and the global `ConfirmDialogHost`.
- **Feedback**: `toast` (`lib/store/toastStore.ts`) for non-blocking messages; `confirm()`
  (`lib/store/confirmStore.ts`) for confirmations. Native `alert()`/`confirm()` and hand-rolled
  modal `div`s are banned.

### `src/lib/store/` (Global State)

- `languageStore.ts`: Bilingual language preference.
- `projectStore.ts`: Active project state.
- `toastStore.ts`: Toast notification state (non-blocking feedback).
- `confirmStore.ts`: Imperative `confirm()` API backing the global confirm dialog (replaces `window.confirm()`).

### `src/types/` (Type Definitions)

- Centralized TypeScript interfaces and type declarations.

### Test Organization

Tests are colocated with source files using the `.test.ts` / `.test.tsx` suffix.

## 3. Key Features

### Chat System

> **File size policy**: See `rules/01-coding.md § File Size & Modularity Guidelines` for AI-agent-optimized targets.

- **Real-time Streaming**: Custom implementation for streaming AI responses.
- **Component Architecture**:
  - `ChatApp.tsx`: Main container and state orchestrator (~1050 lines — **needs refactoring**).
  - `ChatControls.tsx`: Isolated input and model selection UI.
  - `ChatBubble.tsx`: Message rendering (~676 lines — **needs refactoring**).
  - `StreamErrorBanner.tsx`: Error display with accessibility.
- **ChatBubble Sub-components** (extracted for maintainability):
  - `SmartCode.tsx`: Code blocks with syntax highlighting, copy, expand/collapse.
  - `MessageActions.tsx`: Copy, edit, regenerate, delete buttons.
  - `SourceLinks.tsx`: Web search source display.
  - `ImageGenPreview.tsx`: Generated image preview with actions.
- **Custom Hooks** (located in `app/features/chat/components/hooks/`):
  - `useChatStreamController`: Core streaming logic.
  - `useChatModals`: Modal state management (Upgrade, Delete, Rename).
  - `useChatTranslations`: Memoized translation lookup.
  - `useUrlSync`: URL ↔ state synchronization.
  - `useAllowedModels`: Model permission checking.
  - `useWebSearchPreference`: Web search toggle state.
  - `useImageGenController`: Image generation flow.
- **Message Handling**: Supports diverse content types (Text, Code, Files, Images).

### Gems (AI Assistants)

- Specialized AI personas or tools configured for specific tasks.
- CRUD operations for managing user-defined Gems.

### File System

- Single `files` table with 30-day TTL for automatic cleanup.
- Unified file service (`fileService.server.ts`) handles upload, parsing, and provider formatting.
- Inline-first UX via `FilePreviewArea` and `FileLightbox` components.
- Supports: images, video, audio, documents, text, archives.
- Provider-aware: Gemini uses `fileUri`, others use base64/text extraction.

### Image Generation (Image Studio)

- Multi-model support: Gemini Image Flash, Gemini Image Pro, DALL-E 3, Flux Pro
- BYOK (Bring Your Own Key) for third-party providers
- Style presets and aspect ratio controls
- Route: `/image-studio`

### Gallery

- Image management for generated images
- Infinite scroll pagination
- Search and filter capabilities
- Route: `/gallery`

### Voice Features

- **Speech-to-Text**: Web Speech API with waveform indicator (`lib/features/voice/useSpeechRecognition.ts`)
- **Text-to-Speech**: Read AI responses aloud (`lib/features/voice/useSpeechSynthesis.ts`)
- Auto language detection (VN/EN/DE)

## 4. Data Flow

1. **Client Request**: User interacts with UI (e.g., sends message).
2. **Next.js API Route**: request handled by `app/api/`.
3. **Logic Layer**: `lib/features/` handles validation and logic.
4. **Services**:
   - **Auth**: Verified via Supabase Proxy (NextAuth).
   - **Data**: Persisted to Supabase PostgreSQL.
   - **AI**: Prompt constructed and sent to Google Gemini.
5. **Response**: Streamed back to client and state updated via SWR/Zustand.

## 5. Deployment & Infrastructure

### Hosting

- **Platform**: [Vercel](https://vercel.com/) (Production & Preview)
- **Domain**: `vikini.net`
- **Runtime**: Serverless Functions (Node.js)

### Environment Variables (Managed via Vercel Dashboard)

All API keys, secrets, and configuration variables are managed through the **Vercel Environment Variables** UI at `Project Settings → Environment Variables`. They are NOT stored in `.env` files in production.

| Variable                                              | Category           | Scope                |
| ----------------------------------------------------- | ------------------ | -------------------- |
| `GEMINI_API_KEY`                                      | AI Provider        | All Environments     |
| `ANTHROPIC_API_KEY`                                   | AI Provider        | All Environments     |
| `OPENROUTER_API_KEY`                                  | AI Provider        | All Environments     |
| `DEEPSEEK_API_KEY`                                    | AI Provider        | Production & Preview |
| `LLAMA3_API_KEY`                                      | AI Provider (Groq) | All Environments     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`           | Auth               | All Environments     |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET`                    | Auth               | All Environments     |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`          | Database           | All Environments     |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Cache/Rate Limit   | All Environments     |
| `DATA_ENCRYPTION_KEY`                                 | Security           | All Environments     |
| `WHITELIST_EMAILS`                                    | Access Control     | All Environments     |
| `RATE_LIMIT_MAX`                                      | Rate Limiting      | All Environments     |
| `FILES_CRON_SECRET`                                   | Cron Jobs          | All Environments     |

> [!IMPORTANT]
> **Adding/rotating API keys**: Always use Vercel Dashboard. Never commit secrets to the repository. Local development uses `.env.local` (see `env.local.example`).

### Limits Configuration

Limits are managed at **two levels**:

1. **Vercel Environment Variables**: Rate limiting (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`), file limits (via `rank_configs.max_file_size_mb`)
2. **Admin Dashboard (`/admin` → Limits tab)**: Per-rank daily message limits, max file size, feature toggles, allowed models — stored in `rank_configs` table in Supabase

## 6. Token Observability

> **Status**: Not yet implemented. Currently no automated token tracking for agent workflows.

### Future Implementation

Track token usage per workflow type to identify optimization opportunities:

- **Tokens per task completion** — total input+output tokens from first edit to passing `npm run verify`
- **Verify command cost** — tokens spent on iterative type-check/lint/test cycles vs. actual code generation
- **Workflow efficiency ratio** — `(tokens for code generation) / (total tokens)` — lower ratio = too much iteration

### Why This Matters

Most token cost comes from retry loops (fix → verify → fix → verify), not from the initial generation. Tracking these metrics enables data-driven decisions on model routing and workflow improvements.

## 7. Multi-Agent Governance Architecture

Quy trình phát triển và kiểm soát chất lượng của Vikini được vận hành bởi hệ thống phối hợp đa tác tử (Multi-Agent System) tuân thủ chuẩn Antigravity 2.0:

```text
User (PM) ──[Task]──▶ Orchestrator (Dispatcher)
                              │
                    (Zero-Self-Execution)
                              │
                              ▼
                      [ @planner Subagent ]
                      (Gemini 3.8 Flash)
                              │
                  (Uninterrupted Chain - KHÔNG ngắt quãng hỏi PM)
                              │
                              ▼
                     [ @reviewer Subagent ]
                     (Claude Opus 4.6 / Fallback Flash)
                              │
                     [ Thẩm định trực tuyến 2026 ]
                              │
                    ┌─────────┴─────────┐
                    │                   │
           [CHANGES_REQUESTED]    [PLAN_APPROVED]
                    │                   │
                    ▼                   ▼
         (Gửi lại @planner sửa)   [ Pre-Flight Gate ]
         (Tối đa 3 vòng lặp)            │ (PASS)
                                        ▼
                               [ Trình User (PM) Duyệt ]
                                        │
                                        ▼
                               [ Unfreeze & Code ]
                                        │
                                        ▼
                               [ npm run verify ]
```

### Các Cơ Chế Cưỡng Chế Cốt Lõi:

1. **Platform Hook Code Freeze Guard**: Chốt chặn tầng máy chủ phát triển (`.agents/hooks.json` và `.agents/scripts/code-freeze-guard.js`). Áp dụng cơ chế **Scoped Protection (Phương án 2)**:
   - Tự động cho phép ghi vào UI components/hooks và feature logic sau khi plan được phê duyệt (`[PLAN_APPROVED]`).
   - Luôn luôn khóa và hỏi User (`ask`) với các file nhạy cảm: `*.server.ts`, database migrations, cấu hình hạ tầng kiểm thử `TEST_INFRA_FILES`, và file test chịu Test Integrity Guard.
2. **Zero-Self-Execution**: Orchestrator chỉ đóng vai trò điều phối viên; cấm tự lập kế hoạch trên luồng chính. Khâu lập kế hoạch bắt buộc 100% ủy quyền cho `@planner`.
3. **Uninterrupted Execution Chain**: Luồng `[Task]` ➔ `[@planner]` ➔ `[@reviewer]` chạy tự động, liên tục; cấm dừng giữa chừng để hỏi ý kiến người dùng khi chưa có thẻ `[PLAN_APPROVED]`.
4. **Pre-Flight Gate**: Chốt chặn 3 cổng bắt buộc trước khi xuất phản hồi xin mở khóa viết code:
   - **Gate 1 - Plan Persistence**: Kế hoạch được ghi vào `docs/plans/`.
   - **Gate 2 - Reviewer Dispatch**: Kế hoạch đã qua thẩm định trực tuyến độc lập bởi `@reviewer`.
   - **Gate 3 - Reviewer Approval Token**: Nhận thẻ `[PLAN_APPROVED]` trực tiếp từ `@reviewer`.
5. **Circuit Breaker**: Sau 3 vòng lặp revision không đạt phê duyệt, Orchestrator tự động ngắt chuỗi và trình báo cáo tổng hợp lỗi tồn đọng lên User (PM) quyết định.

### Bộ 3 Tài Liệu Vệ Tinh Của @reviewer:

- **`allowlist.md`**: Quy định 4 nhóm lệnh `run_command` read-only được phép chạy để kiểm chứng kết luận. Cấm tuyệt đối lệnh mutating.
- **`evidence-bar.md`**: Chuẩn hóa 4 loại bằng chứng bắt buộc (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`), quy trình Negative Probe cho Zod/RLS/Redis, và Adversarial Timeline 4 trục.
- **`mental-simulation.md`**: 6 kịch bản đối kháng bắt buộc S1–S6 (Cold-start, SSE streaming teardown, Supabase PostgreSQL temporal logic, cross-task state, 3-tier auth, external resilience & serverless cap 800s/60s/30s) và Domain Open Inquiry riêng cho Vikini.

### Subagent Nghiệm Thu Độc Lập (@qa)

- Hoạt động theo chế độ **ON-DEMAND** (chỉ kích hoạt khi người dùng gõ `@qa`).
- Thực hiện quy trình 7 bước tuần tự:
  1. Đọc plan tạo checklist.
  2. Chạy verification suite (`type-check`, `lint`, `test:run`).
  3. **Verification Gate (fail-fast)**: Dừng ngay và xuất `[QA_FAILED]` nếu verify thất bại, không soi code.
  4. Săn lỗi chuyên sâu (bảo tồn toàn diện tiêu chuẩn Vikini: co-located test, bilingual `04-bilingual.md`, `toast.error()`, file size 150–400 dòng, SSE stream abort listener, Zustand/SWR race conditions).
  5. Quét lỗ hổng online (`search_web` CVEs).
  6. **Test Integrity Audit**: Quét `git diff --stat` phát hiện specification gaming, đếm `expect(` bị giảm, rà matcher nới lỏng, phân loại lỗi Type A/B/C.
  7. Xuất báo cáo chuẩn hóa `[QA_PASSED]` / `[QA_FAILED]`.
