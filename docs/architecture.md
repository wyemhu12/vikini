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

- **Real-time Streaming**: Custom implementation for streaming AI responses.
- **Component Architecture**:
  - `ChatApp.tsx`: Main container and state orchestrator (~450 lines).
  - `ChatControls.tsx`: Isolated input and model selection UI.
  - `ChatBubble.tsx`: Message rendering (~400 lines, refactored).
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
