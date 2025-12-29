---
trigger: always_on
---

# Core Rules & Context Routing (Vikini)

## Technology Stack (Immutable)

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4, Framer Motion
- **Database & Auth**: Supabase (PostgreSQL)
- **AI**: Google Gemini (via @google/genai)
- **State**: Zustand
- **Cache/Rate Limit**: Upstash Redis

## Non-Negotiables

- **No refactoring outside scope**: Do not touch unrelated files unless explicitly required by the task.
- **Minimal diffs**: Prefer the smallest change that solves the problem. Avoid reformatting/renaming unrelated code.
- **Respect boundaries**:
  - `app/` = routing, UI composition, API routes (thin orchestration)
  - `lib/core/` = clients/wrappers (Supabase, Gemini, rate limit, cache)
  - `lib/features/` = use-cases / feature logic (chat, gems, attachments, conversations)
- **No guesswork**: If required context is missing, request up to **3** specific files/infos and proceed.

## Documentation Routing Table (Context Loading)

Before starting a task, identify which domain it touches and load only the relevant docs.

| Domain               | Likely Files/Paths                                           | Required Docs                                                  |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| **Streaming / Chat** | `app/api/chat-stream/`, `lib/features/chat/`                 | `docs/contracts.md` (Streaming/Chat protocol)                  |
| **Conversations**    | `app/api/conversations/`, `lib/features/conversations/`      | `docs/contracts.md` (Conversation/message shapes)              |
| **GEMs**             | `app/api/gems/`, `lib/features/gems/`                        | `docs/contracts.md` (GEMs CRUD + prompt composition rules)     |
| **Attachments**      | `app/api/attachments/`, `lib/features/attachments/`          | `docs/contracts.md` (Attachment lifecycle + parsing)           |
| **Auth & Security**  | `app/auth/`, `lib/core/rateLimit.ts`, auth middleware        | `docs/security.md`                                             |
| **Database**         | `database-schema.md`, migrations                             | `database-schema.md` + relevant section in `docs/contracts.md` |
| **UI Components**    | feature UI under `app/`, `components/ui/`, `components.json` | `.agent/rules/20-ui-standards.md`                              |
| **Testing**          | `tests/`, `vitest.config.ts`                                 | `docs/testing.md`                                              |

**Rule**: Do NOT read all docs. Only load what the current task needs.

## Source of Truth Priority (When Unsure)

1. Existing types/schemas in code (Zod/TS types if present)
2. `docs/contracts.md`
3. `database-schema.md`
4. README notes only if not contradicted by code
