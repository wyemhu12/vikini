# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

---

## 2026-05-29: Audit Fix Batch — 16 issues resolved

### 🔴 Critical Bug Fixes

- **FileInMessage onClick not wired** — ChatBubble.tsx now passes `onClick={setLightboxFile}` + renders FileLightbox for in-message file preview
- **Duplicate `validateFile`** — Removed 63-line local copy from fileService.server.ts, imports from fileValidation.ts
- **PDF text extraction for non-Gemini** — Added `pdf-parse` for server-side PDF text extraction; non-Gemini providers (Claude, DeepSeek) can now read PDF content

### 🟡 UX Improvements

- **FileLightbox error state** — Signed URL fetch failure now shows error UI + retry button (was infinite spinner)
- **Filename truncation preserves extension** — `report-final-v2.pdf` → `report-fi…v2.pdf` (was `report-final-v...`)
- **File navigation in lightbox** — Prev/Next arrows + keyboard (←/→) + file counter "2 / 5"
- **Upload retry** — 1 automatic retry on network error/timeout with 1s delay

### ♿ Accessibility

- **FilePreviewCard** — Added keyboard handler (Enter/Space), aria-label on card
- **FileLightbox** — Focus trap, focusable container, Tab wrapping
- **FilePreviewCard aria-label** — Screen reader announces "Preview filename.pdf"

### 🔧 Code Quality

- **Shared utils** — Created `lib/utils/fileDisplayUtils.ts` with `formatFileSize`, `KIND_ICONS`, `KIND_COLORS`, `truncateFilename` (eliminated 4× duplication)
- **`pickFirstEnv` consolidated** — Removed 3 local copies, all import from `lib/utils/config.ts`
- **`toInt`/`toBytes` dedup** — Removed identical `toBytes()`, unified to `toInt()`
- **`token_count` populated** — File upload now estimates and stores token count
- **Bilingual strings** — FileLightbox translated, all hardcoded English replaced with `t?.key` pattern
- **FileInMessage colors** — Replaced hardcoded `bg-white/10` with theme-aware `bg-[var(--surface)]/15`
- **FileManagerPanel** — `console.error` → `logger.error`

### Files changed

- **New**: `lib/utils/fileDisplayUtils.ts`
- **Modified**: ChatBubble.tsx, FileLightbox.tsx, FilePreviewCard.tsx, FileInMessage.tsx, FileManagerPanel.tsx, useFileUpload.ts, fileService.server.ts, fileProcessors.ts, chatStreamCore.ts, config.ts
- **Deps**: Added `pdf-parse` + `@types/pdf-parse`

---

## 2026-05-29: Fix — Files persisting in input + File Manager dropdown redesign

- **Bug: Files stayed in input after send**
  - Root cause: `markAsSent()` was inside `useDebounceCallback` (500ms delay), so files remained visible during debounce window
  - Fix: Snapshot fileIds and call `markAsSent()` synchronously in `handleSubmit` before debounce fires
- **Bug: `[object Object]` rendering in file cards**
  - Root cause: Zustand store used `Set<string>` for `sentFileIds`. React can't serialize Sets properly → renders `[object Object]`
  - Fix: Changed `Set<string>` → `string[]` with `[...new Set([...old, ...new])]` for dedup
- **UX: File Manager redesigned as dropdown**
  - Replaced full-screen slide-out panel with compact dropdown anchored above "📁 Files" button
  - Click-outside and Escape to close, toggle behavior, mobile-friendly width
- **Files affected**: store.ts, InputForm.tsx, FileManagerPanel.tsx, ChatControls.tsx

## 2026-05-29: File UX Overhaul — Message-attached Files + File Manager

- **Files sent with messages** (Claude-style): Files now appear inside user message bubbles instead of persisting on the input bar. After sending, file preview clears and file chips appear inline in the bubble.
- **AI file priority**: Newly attached files are labeled `[NEWLY ATTACHED]` and sorted first in context. AI is instructed to prioritize reading them.
- **File Manager Panel**: New slide-out panel (📁 Files button in toolbar) lists all conversation files with kind icons, size, relative dates, and delete functionality.
- **Delete animations**: File cards now show a spinner when deleting, with smooth exit animations via Framer Motion.
- **Backend**: `fileIds` added to chat stream request schema, saved in user message meta, passed through to `processAttachments()` for priority ordering.
- **Files affected**: validators.ts, chatStreamCore.ts, useChatStreamController.ts, ChatControls.tsx, InputForm.tsx, ChatBubble.tsx, FileInMessage.tsx, FilePreviewCard.tsx, FileManagerPanel.tsx (new), ChatApp.tsx

## 2026-05-29: Fix — Files not showing in UI after upload

- **Root cause**: SWR fetcher expected plain array but API returned `{ data: { files: [...] } }`. `Array.isArray()` returned false → empty file list.
- **Fix**: Properly unwrap nested API response in `useFiles.ts` fetcher.
- **Also fixed**: Upload race condition — optimistic SWR update now passes file data from XHR response to prevent gap between queue removal and SWR refetch.

---

## 2026-05-28: Unified File System Refactor — Single Table + Inline-first UX

- **What changed**: Complete rewrite of the file upload system. Consolidated dual-table architecture (attachments + files) into a single unified `files` table with 30-day TTL. Replaced 903-line `AttachmentsPanel` with clean inline-first design.
- **Why**: Legacy system had 6 API routes, 2 DB tables, 3 separate upload paths, and an AttachmentsPanel that duplicated logic with InputForm. Users found the UX confusing compared to ChatGPT/Gemini.
- **Backend changes**:
  - New DB migration: `021_unify_files_system.sql` — drops legacy `attachments` table, adds `expires_at` column with 30-day TTL
  - Shared validation: `fileValidation.ts` — magic bytes, MIME normalization, blocked extensions
  - File processors: `fileProcessors.ts` — ZIP listing, text extraction, AI analysis
  - Unified service: `fileService.server.ts` — TTL, batch download, cleanup, Gemini URI refresh
  - New API routes: `/api/files/[id]/analyze`, `/api/files/cleanup` (cron)
  - `conversations.ts`: simplified `deleteConversation()` to use unified `deleteFilesByConversation`
  - `chatStreamCore.ts`: removed all legacy attachment code, uses static imports from `fileService.server`
- **Client state**:
  - `store.ts` (Zustand): per-file upload queue with progress tracking
  - `useFiles.ts` (SWR): single source of truth for file data
  - `useFileUpload.ts`: unified hook — drag/drop (1 window handler), paste (1 global handler), file picker, XHR progress
- **UI components**:
  - `FilePreviewCard.tsx`: thumbnail/icon card with upload progress animation
  - `FilePreviewArea.tsx`: horizontal scrolling inline preview above textarea
  - `FileLightbox.tsx`: full-screen file preview (images, video, audio, text, documents)
  - `FileInMessage.tsx`: collapsible file indicator in chat bubbles
  - `InputForm.tsx`: rewritten 513→280 lines, integrates all new hooks/components
  - `ChatControls.tsx`: removed FILES button, AttachmentsPanel import
  - `ChatApp.tsx`: removed useFileDragDrop, attachmentsRef, file state
- **Deleted files**: `AttachmentsPanel.tsx` (903 lines), `FileChips.tsx`, `FileTypesHelp.tsx`, `useFileDragDrop.ts`, `lib/features/attachments/` (entire directory), `app/api/attachments/` (6 routes), `app/api/cron/attachments-cleanup/`, `types/attachments.ts`, `lib/features/attachments/store.ts`
- **Verification**: `npm run type-check` ✅, `npm run lint` ✅ (0 errors, 0 warnings)

---

## 2026-05-08: Fix Sidebar Chat List Flickering During Streaming & Typing

- **What changed**: Chat list in sidebar no longer flickers continuously during streaming or when typing in the input field.
- **Why**: Despite `Sidebar` being wrapped with `React.memo` and all callback props being stabilized with `useCallback` (previous fix on 2026-05-07), the `personalConversations` array returned by `useConversation()` was computed inline without `useMemo`. Every re-render of `ChatApp` (triggered by typing/streaming state changes) created a new array reference → `filteredConversations` changed → `React.memo` on `Sidebar` was bypassed → entire sidebar re-rendered every 15ms during streaming (typewriter tick) and every keystroke.
- **Root cause**: `conversations.filter((c) => !c.projectId)` on line 489 of `useConversation.ts` was NOT wrapped in `useMemo`, creating a new array reference on every hook invocation.
- **Fix**: Wrapped `personalConversations` with `useMemo([conversations])` to stabilize the reference.
- **Files changed**: `useConversation.ts`

---

## 2026-05-07: Implement Composite Cache + KB Cache (Strategy B + D)

- **What changed**: Complete rewrite of context caching to properly support GEM personas + tools.
- **Strategy B (Composite Cache)**: System instruction, tools, and toolConfig are now cached _together_ in a single `ai.caches.create()` call. Cache key includes tools fingerprint, so different tool combinations (web search on/off) create separate cache entries. This eliminates the 400 error caused by sending `cachedContent` + `tools` in the same request.
- **Strategy D (KB Cache)**: Project knowledge base documents are now cached separately for monitoring and future cost optimization. Logging tracks cache hit rates per project (`[KB CACHE] HIT/CREATED`).
- **`executeStream` update**: When `cachedContent` is active, `system_instruction`, `tools`, AND `toolConfig` are ALL omitted from the request (they're inside the cache).
- **Token savings**: ~87% cost reduction on cached input tokens for GEM personas ≥4096 chars.
- **Files changed**: `contextCache.ts` (full rewrite), `chatStreamCore.ts`, `streaming.ts`

## 2026-05-07: Fix Project Info Panel Not Updating After Document Upload/Delete

- **What changed**: Project Info stats (Documents count, Storage) now refresh immediately after uploading or deleting knowledge documents.
- **Why**: After uploading files to a project's Knowledge Base, the Info panel still showed `Documents: 0` and `Storage: 0.00 / 5 MB` because `fetchProjects()` was never called to refresh the project stats in the Zustand store.
- **Root cause**: `handleUpload()` and `handleDeleteDocument()` only called `fetchDocuments()` (refreshing the file list), but did NOT call `fetchProjects()` to update `project.document_count` and `project.storage_bytes` in the store.
- **Fix**: Both `ProjectSettingsModal.tsx` and `projects/[id]/page.tsx` now call `Promise.all([fetchDocuments(), fetchProjects()])` after document mutations.
- **Files changed**: `ProjectSettingsModal.tsx`, `app/projects/[id]/page.tsx`

## 2026-05-07: Fix Sidebar Flickering on Every Keystroke

- **What changed**: Sidebar no longer re-renders when typing in the chat input.
- **Why**: Each keystroke changed `input` state in `ChatApp`, which re-rendered the entire component tree including `Sidebar`. Since `Sidebar` was not memoized and received inline arrow functions as props, it fully re-rendered on every character typed.
- **Root cause**: (1) `Sidebar` was not wrapped with `React.memo()`. (2) 10+ callbacks were passed as inline arrow functions → new references every render → memo would be useless anyway.
- **Fix**:
  1. Wrapped `Sidebar` with `React.memo()` for shallow prop comparison
  2. Extracted all 10 inline callbacks into `useCallback` hooks with stable dependencies
  3. Destructured `openRenameModal`/`openDeleteModal` from `modals` object to avoid unstable object reference in deps
- **Files changed**: `Sidebar.tsx`, `ChatApp.tsx`

---

## 2026-05-06: Post-Refactor Audit — Security, Cleanup & UX Polish

- **What changed**: Audit pass over the Dual Storage refactor, found and fixed 4 issues:
  1. **RLS Policy Fix**: Removed broken `auth.uid()::text` RLS policies from `files` table. The project uses **email** as `user_id` (not Supabase Auth UUID), and all other tables rely on server-side enforcement via `supabaseAdmin` (service_role). Added documentation comment explaining the pattern.
  2. **Conversation Delete Cleanup**: `deleteConversation()` now also calls `deleteFilesByConversation()` before removing the conversation row. Previously only legacy `attachments` were cleaned up, leaving orphaned `files` records.
  3. **Delete Animations**: Added smooth exit animations (Framer Motion) to:
     - `AttachmentsPanel`: Files slide left + fade on delete, spinner replaces trash icon during operation, optimistic removal with rollback on error.
     - `Sidebar`: Conversations fade + slide left when deleted, `AnimatePresence` wraps the list for proper exit transitions.
     - Both use `deletingIds`/`deletingId` state for visual feedback during async operations.
  4. **FileChips ↔ AttachmentsPanel Sync**: Replaced local-only `uploadedFiles` state in `InputForm` with API-synced fetch. Both components now listen to the shared `vikini:attachments-changed` event and fetch from `/api/files`, ensuring files appear in both places regardless of upload source.
- **Files changed**: `020_create_files_table.sql`, `conversations.ts`, `AttachmentsPanel.tsx`, `Sidebar.tsx`, `SidebarItem.tsx`, `InputForm.tsx`

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
