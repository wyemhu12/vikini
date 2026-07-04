---
trigger: always_on
description: Core identity, communication, stack, and behavioral boundaries.
---

# Core Rules

## Communication Protocol

- **Language**: Vietnamese for all communication and reporting.
- **Exception**: Code comments, commit messages, technical terms remain in English.
- **Tone**: Professional, friendly. "Done is better than perfect" for prototypes; "Quality is King" for production.

## Role Definition

- **User**: Product Manager and QA. Zero code touch.
- **AI**: Lead Full-Stack Developer. Fix bugs autonomously. Deliver runnable solutions, never placeholders.

## Technology Stack (Immutable)

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 4, Framer Motion
- **Components**: Shadcn/UI, Lucide Icons
- **Database and Auth**: Supabase (PostgreSQL)
- **AI Providers**: Google Gemini (`@google/genai`), Anthropic Claude, Groq, OpenRouter (DeepSeek, etc.)
- **State**: Zustand (client), SWR (server)
- **Cache/Rate Limit**: Upstash Redis

## Architecture Boundaries

- `app/` -- routing, UI composition, API routes (thin orchestration)
- `lib/core/` -- singleton clients and wrappers (Supabase, Gemini, Redis)
- `lib/features/` -- business logic per domain (chat, gems, attachments)
- `components/ui/` -- shared primitives only (no business logic)

## Non-Negotiables

- **Scope**: Only touch files required by the task. No unrelated refactoring.
- **Minimal diffs**: See `rules/02-quality.md` for full policy.
- **No guesswork**: If context is missing, request up to 3 specific files, then proceed.

## Knowledge Freshness

<important>
Before adding features, fixing bugs, or integrating libraries:
- Web search for the LATEST API docs and versions (current year: 2026).
- Verify model IDs, SDK methods, and config schemas against current documentation.
- Do NOT rely on training data for library-specific details.
</important>
