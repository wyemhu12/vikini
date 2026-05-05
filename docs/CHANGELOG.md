# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

---

## 2026-05-05: Disable Web Search for DeepSeek Models

- **What changed**: WEB search button is now disabled when a DeepSeek model (V4 Flash, V4 Pro, V3.2) is selected.
- **Why**: DeepSeek API has no built-in web search tool (unlike Gemini's `googleSearch` or Claude's `web_search`). Previously, users could toggle WEB ON but it had no effect — misleading UX.
- **Details**:
  - New helper: `modelSupportsWebSearch()` in `modelRegistry.ts` — returns `false` for all `deepseek*` model IDs
  - `ChatControls.tsx`: WEB button disabled with `opacity-40` + `cursor-not-allowed` + tooltip; Always Search hidden
  - Bilingual tooltip: `webSearchNotSupported` key added to `config.ts` + `useChatTranslations.ts`

---

## 2026-05-03: Admin Dashboard Major Overhaul

- **What changed**: Comprehensive upgrade to Admin Management panel with 8 new features.
- **Why**: Admin panel needed better UX for user management and system monitoring.
- **Details**:
  - **Search & Filter**: Email search with rank/status dropdown filters in User Manager
  - **Self-protection**: Admin cannot modify their own rank or block themselves (disabled controls + badge)
  - **Bulk Actions**: Select multiple users + bulk set rank/block/unblock
  - **User Detail Modal**: Click email → modal with user stats (conversations, messages, joined date)
  - **Statistics Tab**: Cards showing total/active/blocked users, conversations, messages + rank distribution bar
  - **Audit Log Tab**: Admin action history viewer with color-coded events + migration hint
  - **Vercel/Supabase Quick Links**: External links to Vercel and Supabase dashboards in header
  - New API routes: `/api/admin/stats`, `/api/admin/audit-log`
  - Audit logger helper: `lib/features/admin/auditLog.ts` (writes to DB + console)
  - DB migration: `supabase/migrations/20260503_add_audit_logs.sql`
  - 35+ new bilingual translation keys
  - Docs updated: architecture.md, security.md, features.md

---

## 2026-05-03: Admin Dashboard UX + Docs Infrastructure Update

- **What changed**: Added "Back to Home" navigation button to Admin Dashboard header; updated architecture, security, and features docs with Vercel deployment and environment variable management details.
- **Why**: Admin panel had no way to navigate back to vikini.net; docs lacked documentation about where env vars and limits are managed.
- **Details**:
  - `AdminDashboard.tsx`: Added `Link` to `/` with `ArrowLeft` icon, bilingual translation
  - `config.ts`: Added `adminBackToHome` key (VN: "Trang chủ", EN: "Home")
  - `architecture.md`: New section 5 "Deployment & Infrastructure" (Vercel, env vars table, limits config)
  - `security.md`: New "Environment Variables & Secrets (Vercel)" section with security rules
  - `features.md`: Expanded Admin Dashboard section with operational boundaries table

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
