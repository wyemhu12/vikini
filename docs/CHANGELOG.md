# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

---

## 2026-05-03: DeepSeek V4 Flash & Pro Integration

- **What changed**: Added DeepSeek V4 Flash and V4 Pro models via direct DeepSeek API.
- **Why**: Native thinking mode support (reasoning_content) requires direct API access; OpenRouter can't guarantee pass-through.
- **Details**:
  - New client: `src/lib/core/deepseekClient.ts` (OpenAI SDK with DeepSeek base URL)
  - Model registry: 2 new models (`deepseek-v4-flash`, `deepseek-v4-pro`) + legacy aliases
  - Streaming: `createDeepSeekStream` with `<think>` tag injection for thinking mode
  - Thinking mode: Maps Vikini thinkingLevel → DeepSeek reasoning_effort (high/max)
  - Error handling: 429 rate limit, 402 insufficient balance, timeout
  - Bilingual translations for both models (Vietnamese + English)
  - Environment: `DEEPSEEK_API_KEY` added to `.env.local` and `env.local.example`

---

## 2026-05-03: Docs and Agent Rules Audit + Fixes

- **What changed**: Comprehensive audit and fix of all `.agent/` and `docs/` files.
- **Why**: Multiple inconsistencies found — wrong auth docs, stale model IDs, missing Project tables/contracts.
- **Details**:
  - Fixed `security.md`: Removed incorrect `proxy.ts` reference, corrected to NextAuth v5 direct import
  - Fixed `contracts.md`: Updated model ID example, added 7 missing API endpoints, added Project/KnowledgeDocument contracts
  - Fixed `architecture.md`: Added multi-provider support, Voice features, `lib/store/`, `components/features/`
  - Fixed `database-schema.md`: Added `projects`, `knowledge_documents`, `knowledge_chunks` tables + ERD
  - Fixed `00-core.md`: Updated AI Provider list, DRY minimal diffs
  - Fixed `01-coding.md`: Standardized path convention with `src/` note
  - Fixed `02-quality.md`: Added missing domains to pre-work table, DRY bilingual section
  - Fixed `add-model.md`: Added verification note
  - Fixed `debug.md`: Converted from custom XML to pure Markdown
  - Populated `lessons-learned.md` with retroactive entries
  - Backfilled CHANGELOG with major milestones

## 2026-05-03: Rules and Docs Restructure

- **What changed**: Complete restructure of `.agent/rules/`, `.agent/skills/`, `.agent/workflows/`, and `docs/`.
- **Why**: Previous system had overlapping content, rules too long for context budget, missing enforcement protocols.
- **Details**:
  - Rules rewritten: 5 focused files (00-core, 01-coding, 02-quality, 03-ui, 04-bilingual)
  - Skills created: api-patterns, add-model, add-translation
  - Workflows updated: post-fix (with test enforcement), debug (renamed), audit (new)
  - Docs: context.md rewritten, api-reference.md merged into contracts.md, lessons-learned.md created, CHANGELOG.md created
  - Deleted: testing.md (generic tutorial), add-new-models.md (moved to skill)

## 2026-02: Projects & Knowledge Base

- **What changed**: Full Project system with per-project Knowledge Base (RAG).
- **Details**:
  - 3 new DB tables: `projects`, `knowledge_documents`, `knowledge_chunks` (pgvector)
  - Auto-chunking + embedding via `text-embedding-004` / `gemini-embedding-001`
  - RAG similarity search via `match_project_knowledge()` PostgreSQL function
  - Project CRUD, KB document upload/delete, ChatGPT-style project view

## 2026-01: Image Studio & Gallery

- **What changed**: Multi-provider AI image generation + gallery management.
- **Details**:
  - Image Studio: Gemini Imagen 3, DALL-E 3, Flux Pro (BYOK)
  - Style presets, aspect ratio controls, prompt enhancement
  - Gallery: infinite scroll, search, filter, lightbox, image compare
  - Routes: `/image-studio`, `/gallery`

## 2025-12: Enhanced Streaming UX

- **What changed**: Professional streaming experience matching ChatGPT/Gemini quality.
- **Details**:
  - Typewriter buffer (333 chars/s drain rate)
  - Smart auto-scroll with user scroll detection
  - ThinkingBlock animation for Gemini 3 thinking mode
  - Typing cursor, message entry animations
  - Deep thinking extended timeouts

## 2025-11: Core Chat & GEMs System

- **What changed**: Foundation chat system with AI personas.
- **Details**:
  - SSE streaming with Gemini AI
  - Conversation CRUD + auto-title + URL sync
  - GEMs system with versioning
  - File attachments (upload, parse, 36h TTL)
  - Message encryption (AES-256-GCM)
  - Rate limiting via Upstash Redis
  - Admin dashboard, Google OAuth, bilingual UI
