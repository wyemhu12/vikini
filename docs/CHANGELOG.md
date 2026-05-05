# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

---

## 2026-05-05: File System Refactor — Dual Storage (Gemini Files API + Supabase)

- **What changed**: Complete refactor of the attachment/file upload system:
  1. **Dual Storage Architecture**: Files are now uploaded to both Gemini Files API (48h, free, native multimodal processing) and Supabase Storage (permanent fallback). Gemini models use `fileUri` references (zero re-download), non-Gemini models (DeepSeek, Claude) use base64/text extraction from Supabase.
  2. **New DB Table**: `files` table replaces `attachments` with Gemini-specific columns (`gemini_file_name`, `gemini_file_uri`, `gemini_expires_at`), text extraction cache (`extracted_text`), and file classification (`kind`).
  3. **Simplified Upload Flow**: Replaced 3-step signed URL upload (sign → PUT → complete) with single FormData POST to `/api/files/upload`. Updated both `AttachmentsPanel.tsx` and `InputForm.tsx`.
  4. **Provider-Aware Chat Integration**: `chatStreamCore.ts` `processAttachments()` now detects model provider and routes files accordingly: Gemini → Files API URI (`fileData`), others → download + `inlineData`/text. Streaming converters already handle `inlineData` → `image_url` (DeepSeek) and → `base64` (Claude).
  5. **Auto-Refresh**: `refreshGeminiUri()` automatically re-uploads to Gemini when 48h expiry is reached, downloading from Supabase transparently.
  6. **Video/Audio Support**: New file types now supported for Gemini models (mp4, mov, webm, mp3, wav, ogg). Non-Gemini models see descriptive notes. File input accept list updated.
  7. **Lazy Text Caching**: When text content is downloaded for non-Gemini providers, it's automatically cached in `extracted_text` column for future requests (non-blocking).
  8. **Inline File Chips (UI)**: New `FileChips.tsx` component renders uploaded files as color-coded chips inside the input box (ChatGPT-style). Icons per file type, ⚡ Gemini-ready badge, animated entry/exit, hover-to-remove.
  9. **Backward Compatible**: Legacy `/api/attachments` routes still work. UI reads from both tables and deduplicates.
- **Files changed**: `types/files.ts` (NEW), `fileService.server.ts` (NEW), `FileChips.tsx` (NEW), `/api/files/*` routes (NEW), `chatStreamCore.ts`, `AttachmentsPanel.tsx`, `InputForm.tsx`, `020_create_files_table.sql` (migration)

---

## 2026-05-05: Phase 2 — Agentic Capabilities (Function Registry + Embedding 2)

- **What changed**: 3 improvements from Phase 2 of the Architecture Gap plan:
  1. **Function Calling Registry** (`functionRegistry.ts` NEW): Replaced static `BUILT_IN_FUNCTIONS` array with extensible Map-based registry. `registerFunction()` auto-registers declarations + async handlers. Added 2 new built-in functions: `get_weather` (redirects to web search), `calculate` (server-side math). Old `functions.ts` preserved for backward compat but no longer imported.
  2. **Tool Combination Engine**: Already completed (Gemini 3 Tool Context Circulation). Verified all paths properly forward `allResponseParts` and `functionCall.id`.
  3. **Gemini Embedding 2**: Added `gemini-embedding-2` (multimodal, text+image+video+audio embedding) to `EmbeddingModel` type. All tiers now have access. Implemented task-prefix formatting (`formatQueryForRAG`, `formatDocumentForRAG`) per official docs — queries use `task: question answering | query: X`, documents use `title: X | text: Y`. Added `outputDimensionality` config support. Updated `searchKnowledge()` and `uploadDocument()` to auto-format when model is embedding-2.
- **Files changed**: `functionRegistry.ts` (NEW), `streaming.ts`, `chatStreamCore.ts`, `embedding.server.ts`, `knowledge.server.ts`, `projects.ts` (types)

## 2026-05-05: Phase 1 — Architecture Gap Closure (Model Registry + Context Caching)

- **What changed**: 3 improvements from the Gemini API Architecture Gap Analysis (Part 5):
  1. **Model Registry**: Added `gemini-3.1-flash-lite-preview` (cheapest/fastest in 3.1 series) to selectable models, API_ALLOWED, aliases, `isGemini3Model()`, and bilingual translations (VI/EN).
  2. **Explicit Context Caching**: New `contextCache.ts` module that caches GEM system instructions via `ai.caches.create()` for 50-90% token cost savings. Integrated into Gemini native stream path in `chatStreamCore.ts` → `streaming.ts`. Uses in-memory dedup map with TTL tracking. Falls back gracefully if caching fails (non-fatal). Only activates for prompts ≥ 4096 chars.
  3. **ChatStreamParams**: Extended with `cachedContent` field, threaded through `runStreamWithFallback` → `executeStream` → `generateContentStream` config. When cache is active, `systemInstruction` is omitted (already in cache).
- **Files changed**: `modelRegistry.ts`, `streaming.ts`, `chatStreamCore.ts`, `contextCache.ts` (NEW), `config.ts`, `useChatTranslations.ts`

## 2026-05-05: Gemini 3 Tool Context Circulation — Combined Web Search + Function Calling

- **What changed**: Gemini 3+ models can now use `googleSearch` + `codeExecution` + `functionDeclarations` simultaneously in a single request.
- **Why**: Gemini 3 supports [Tool Context Circulation](https://ai.google.dev/gemini-api/docs/tool-combination) — mixing built-in tools with custom functions. Gemini 2.5 does NOT support this and keeps `googleSearch` isolated.
- **Details**:
  - `chatStreamCore.ts`: `setupToolsAndSafety()` now returns `toolConfig` with `includeServerSideToolInvocations: true` for Gemini 3 + web search ON
  - `streaming.ts`: `executeStream()` passes `toolConfig` to `generateContentStream` config
  - `streaming.ts`: Collects ALL response parts (`toolCall`, `toolResponse`, `functionCall`) for context circulation in function call continuations
  - `streaming.ts`: Fixed `functionCall.id` — now properly passed in `functionResponse` for correct call-response mapping
  - `streaming.ts`: `runStreamWithFallback()` forwards `toolConfig` through the pipeline

## 2026-05-05: DeepSeek Web Search — V4 Disabled, V3.2 Enabled via OpenRouter

- **What changed**: WEB search disabled for DeepSeek V4 (direct API). Enabled for V3.2 via OpenRouter `openrouter:web_search` server tool.
- **Why**: V4 has no web search capability. V3.2 via OpenRouter supports the new server tools API for real-time grounding (~$0.02/query via Exa).
- **Details**:
  - `modelRegistry.ts`: `modelSupportsWebSearch()` now returns `true` for V3.2, `false` only for V4 direct
  - `modelRegistry.ts`: New `isDeepSeekV32Model()` helper
  - `constants.ts`: Added `MODEL_IDS.DEEPSEEK_V32`
  - `streaming.ts`: Injects `{ type: "openrouter:web_search", parameters: { max_results: 5, search_context_size: "low" } }` into V3.2 request when WEB ON
  - `ChatControls.tsx`: Shows amber pricing note `~$0.02/search query` when V3.2 + WEB ON
  - `config.ts`: Bilingual `webSearchPricingNote` key

## 2026-05-05: Fix Gemini Web Search Not Working (Critical)

- **What changed**: Removed `googleMaps` tool from default tools array; updated `@google/genai` SDK 1.38→1.52.
- **Why**: `googleMaps` tool only supports Gemini 3 family. When sent to Gemini 2.5 or 3.1 Pro models, the entire API call **failed**, triggering the fallback which silently retried **without ANY tools** — including `googleSearch`. This made web search appear broken for ALL Gemini models.
- **Root cause**: `setupToolsAndSafety()` always injected `{ googleMaps: {} }` when web search was enabled, regardless of model family.
- **Details**:
  - Removed `googleMaps` from `chatStreamCore.ts` `setupToolsAndSafety()`
  - Hardened `envFlag()` to strip surrounding quotes from env values
  - Added `[WEB SEARCH]` debug logging for easier diagnosis
  - Updated `@google/genai` SDK from 1.38.0 → 1.52.0

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
