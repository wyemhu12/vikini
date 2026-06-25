# CHANGELOG -- Vikini

> Agent MUST update this file after every task that involves code changes.
> Format: newest entries first.

---

## 2026-06-25: Personas — IconPicker Fix & Chat Badge

### Bug Fix: IconPicker

- **`PersonaEditor.tsx`** — Added `IconPicker` component (from `@/components/ui/IconPicker`) to the Icon field, matching GemEditor pattern.

### New: Persona Badge in Chat Header

- **`ChatControls.tsx`** — Added purple persona badge (icon + name) next to gem badge in chat controls bar.
- **`ChatApp.tsx`** — Integrated persona store callback (`patchConversationPersona`) for optimistic UI updates.
- **`useConversation.ts`** — Added `patchConversationPersona` and `persona` field to `FrontendConversation`.
- **`conversations.ts`** — All Supabase queries now join `personas(name,icon,color)` alongside gems. Added `persona` to `Conversation` interface and row mapper.

---

## 2026-06-25: Manage Personas Feature (ChatGPT Personality + Gemini Custom Instructions)

### New Feature: AI Persona Management

Adds a full CRUD system for creating and managing custom AI personas, combining ChatGPT's "Base Style & Tone" preset system with Gemini's free-form "Custom Instructions" into a unified interface.

### Database

- **`supabase/migrations/20260625_add_personas.sql`** — New `personas` table with RLS policies. Added `persona_id` FK to `conversations`.

### Backend (API + Logic)

- **`src/lib/features/personas/personas.ts`** — CRUD business logic: `getPersonasForUser`, `createPersona`, `updatePersona`, `deletePersona`, `getPersonaInstructionsForConversation`.
- **`src/lib/features/personas/prompt-builder.ts`** — `buildPersonaSystemPrompt()` compiles tone + emoji/headers prefs + user context + custom instructions into a system prompt.
- **`src/app/api/personas/route.ts`** — GET/POST/PATCH/DELETE API routes with Zod validation.
- **`src/app/api/conversations/route.ts`** — Added `personaId` support in PATCH handler.
- **`src/lib/features/chat/conversations.ts`** — Added `setConversationPersona()`.
- **`src/app/api/chat-stream/chatStreamCore.ts`** — Persona prompt injected before GEM prompt in system instructions.

### Frontend (UI)

- **`src/app/features/personas/`** — PersonaManager, PersonaEditor (with tone cards, characteristic toggles, textareas), PersonaList, PersonaPreview, PersonaModal.
- **`src/app/features/personas/stores/usePersonaStore.ts`** — Zustand store for persona modal state.
- **`src/app/features/sidebar/components/Sidebar.tsx`** — Added "Manage Personas" button below "Explore Gems".
- **`src/app/features/layout/components/MainLayout.tsx`** — Added PersonaModal.

### Translations

- **`en.ts` / `vi.ts`** — Added 28 translation keys for persona management UI.

### Types

- **`src/types/persona.ts`** — `Persona`, `PersonaTone` (8 tones: default, professional, friendly, candid, quirky, efficient, cynical, lawyer), `PersonaForClient`.

---

## 2026-06-22: Image Studio — UI Polish

- **`ControlPanel.tsx`** — Free/Guided converted from toggle to 2-tab row. Exclude, Quick Add, Prompt History buttons restyled with colored backgrounds, borders, and icons. Added actual pixel resolution display below resolution selector. Quick Add gets sparkle icon. All 3 menu buttons get hover tooltips.
- **`Canvas.tsx`** — Reuse and Edit buttons now show descriptive tooltips on hover.
- **`TagInput.tsx`** — Add Tag button restyled with emerald color and tag icon; hover tooltip explains purpose.
- **`en.ts` / `vi.ts`** — Added 10 translation keys for tooltips and labels.

---

## 2026-06-22: Image Studio — Priority Improvements Batch

### P0-4: Cleanup Legacy EditImageModal

- **[DELETED] `EditImageModal.tsx`** — 261 lines dead code removed.

### P1-5: Style Preview Thumbnails

- **`StyleSelector.tsx`** — Rewritten with real AI-generated preview images (18 styles). `/public/styles/`.

### P2-1: Interleaved Text+Image Output

- **`GeminiNativeImageProvider.ts`** — `responseModalities: ["TEXT", "IMAGE"]`. Parses text as `aiComment`.
- **`Canvas.tsx`** — Shows 💬 AI comment below image.

### P2-2: Time Estimate

- **`ImageGenStudio.tsx`** — Shows elapsed seconds during generation.

### P2-7: Prompt Autocomplete

- **[NEW] `api/prompt-suggest/route.ts`** — `gemini-3.1-flash-lite-preview`, 4 completions, rate limited.
- **`ControlPanel.tsx`** — Debounced dropdown, keyboard nav.

### Other

- Remove Cancel (QW-F), prompt limit 2000→10000, ESLint no-undef fix, Describe Image bugs, Suspense boundary.

---

## 2026-06-18: Feature — Image Studio Quick Wins (7 enhancements)

### QW1: Negative Prompt Field

- **`ControlPanel.tsx`** — Collapsible "🚫 Exclude" section below suggestion tags. Appends `\nDo NOT include: {text}` to prompt. Red dot indicator when active.

### QW2: Enhanced Prompt Transparency

- **`generate-image/route.ts`** — Saves `originalPrompt` and `enhancedPrompt` in message meta JSONB when enhancer is enabled.
- **`Canvas.tsx`** — "Magic" badge → i18n "Enhanced" badge with tooltip showing enhanced prompt on hover.

### QW3: Image Variations

- **`Canvas.tsx`** — New emerald "Variation" button on image card hover overlay.
- **`ImageGenStudio.tsx`** — `handleVariation()`: fetches image → base64 → sends with variation prompt + reference to Gemini.

### QW4: Favorites / Bookmarks

- **[NEW] `/api/messages/[id]/favorite/route.ts`** — PATCH endpoint toggles `is_favorite` in messages.meta JSONB. No DB migration.
- **`Canvas.tsx`** — Heart icon toggle on image overlay. Filled pink when favorited.

### QW5: Prompt History (localStorage, max 30)

- **`ImageGenStudio.tsx`** — Saves successful prompts to localStorage, deduplicates, max 30.
- **`ControlPanel.tsx`** — Collapsible "🕐 Recent Prompts" section with click-to-fill.

### QW6: Parallel Batch Generation

- **`ImageGenStudio.tsx`** — Sequential `for` loop → `Promise.allSettled()`. 2-4x faster for batch > 1.

### QW7: Text Rendering Tip

- **`ControlPanel.tsx`** — Auto-detects quoted text + Flash model → amber tip to switch to Pro.

### Translation Keys

- **`en.ts` / `vi.ts`** — 22 new bilingual keys.

### Verification

- `type-check` ✅ | `lint` ✅ | `tests` ✅ (34 files, 409 tests, 0 failures)

---

## 2026-06-18: Fix — EditImageModal `[object Object]` + Request Body Mismatch

- **Symptom**: Clicking "Apply Edit" showed `[object Object]` in error field and edit never executed.
- **Root causes**: (1) Request body sent `prompt` but API schema expected `editPrompt`; `model`/`aspectRatio` sent top-level but expected in `options` object → Zod validation always failed. (2) Error parsing used `String(data.error)` but `data.error` is `{ message, code }` object → `[object Object]`.
- **Fix**: Corrected request body field names to match Zod schema. Fixed error extraction to check for nested `.message` property.
- **Files**: `EditImageModal.tsx`

---

## 2026-06-18: Feature — Image Studio Upgrade (5 Criteria Audit)

### 1. Suggestion Tags (ControlPanel)

- **`ControlPanel.tsx`** — Added 12 suggestion tags organized by category (Style: 🎬🌅📷🌑, Color: 🌈🎨⬛💜, Composition: 🔍🏞️🦅✨). Click-to-append into prompt textarea. Uses pill-button pattern consistent with EditImageModal.

### 2. Dynamic Loading State (Canvas)

- **`Canvas.tsx`** — Skeleton placeholder now matches the selected aspect ratio (was always `aspect-square`). Loading text cycles through 5 creative messages every 2.5s with fade animation (`Đang pha màu...` → `Đang vẽ chi tiết...` → etc.).

### 3. Enhanced Prompt Quality (API Route)

- **`route.ts`** — Upgraded AI enhancement system prompt from generic "100 words" to professional prompt engineering template with specific quality keywords (8K, volumetric lighting, depth of field, rule of thirds). Limit raised to 150 words.

### 4. User-Friendly Error Handling (ImageGenStudio)

- **`ImageGenStudio.tsx`** — Added `classifyError()` function that maps raw API error strings to i18n-friendly messages + helpful retry suggestions. Error modal now shows 💡 suggestion tip (amber highlight) for safety, rate-limit, and content-policy errors.

### 5. Quick Download (Canvas)

- **`Canvas.tsx`** — Always-visible download button (bottom-right corner) on image cards, no hover required. Download logic replaced from direct link to proper `fetch` → `Blob` → `URL.createObjectURL` to handle CORS with signed URLs.

### Translation Keys

- **`en.ts` / `vi.ts`** — Added 25 new bilingual keys: 12 suggestion tags, 5 loading messages, 6 error messages + suggestions, 1 label.

### Verification

- `type-check` ✅ | `lint` ✅ | `tests` ✅ (34 files, 409 tests, 0 failures)

---

## 2026-06-17: Feature — Model Descriptions in Image Studio + DALL-E 3 → GPT Image 2

### Model Descriptions (Bilingual)

- **`ControlPanel.tsx`** — Model selector now shows bilingual descriptions under each model name
- **`en.ts` / `vi.ts`** — Added 4 new translation keys: `studioModelFlashDesc`, `studioModelProDesc`, `studioModelFluxDesc`, `studioModelGptImageDesc`

### DALL-E 3 → GPT Image 2 Migration

DALL-E 3 API was deprecated and removed by OpenAI on 12/05/2026. Migrated to `gpt-image-2`.

- **`OpenAIImageProvider.ts`** — Complete rewrite: model `dall-e-3` → `gpt-image-2`, handles `b64_json` response format, updated size mappings
- **`ControlPanel.tsx`** — Model value `dall-e-3` → `gpt-image-2`, label `DALL-E 3` → `GPT Image 2`
- **`ImageGenStudio.tsx`** — Updated BYOK validation checks from `dall-e` → `gpt-image`
- **`generate-image/route.ts`** — Updated routing conditions and fallback label
- **`ImageGenPreview.tsx`** — Added `gpt-image` display name, kept legacy `dall-e` for old messages

---

## 2026-06-17: Migration — Imagen 4 + Nano Banana Preview → GA Models

### URGENT: Nano Banana Preview → GA (deadline 25/06/2026)

- **`GeminiNativeImageProvider.ts`** — Default model `gemini-3.1-flash-image-preview` → `gemini-3.1-flash-image` (GA)
- **`ImageGenStudio.tsx`** — Default state updated to GA model ID
- **`ControlPanel.tsx`** — Model selector values: `-preview` → GA for both Flash and Pro
- **`EditImageModal.tsx`** — Edit model list updated to GA IDs, labels standardized
- **`edit-image/route.ts`** — API default model updated to GA
- **`modelRegistry.ts`** — `API_ALLOWED` updated, preview IDs added as backward-compat aliases
- **`chat-stream/utils.ts`** — Gemini 3 model identifiers updated

### Imagen 4 Dead Code Removal (deadline 17/08/2026)

- **[DELETED] `GeminiImageProvider.ts`** — Removed dead provider using deprecated `imagen-4.0-generate-001` (alpha `generateImages` API)
- **`ImageGenFactory.ts`** — Removed import, redirected legacy `"gemini"` provider → `GeminiNativeImageProvider`
- **`generate-image/route.ts`** — Cleaned up model labels (`"Imagen 4"` → `"Gemini Image Flash"`)

### Cleanup

- **`ControlPanel.tsx`** — Removed dead `!model.includes("imagen")` condition
- **`gallery/route.test.ts`** — Updated test fixtures from `imagen-4` → `gemini-3.1-flash-image`
- **Docs** — Updated `contracts.md`, `architecture.md`, `features.md`, `overview.md` with current model names

---

## 2026-06-14: Improvement — Harness Engineering Audit v2 Actions

### CI/CD Pipeline (Tier 3 Verification)

- **[NEW] `.github/workflows/ci.yml`** — GitHub Actions workflow runs `npm run verify` (type-check + lint + test) on every push/PR to `main`/`develop`. Closes the Tier 3 verification gap.

### ESLint Enforcement Upgrades

- **`no-console`: `warn` → `error`** — Forces use of `logger.*` instead of `console.log`.
- **`no-floating-promises`: enabled** — Added `parserOptions.project` for type-aware linting. Fixed 46 fire-and-forget promises across 22 files with `void` operator.
- **`as any` violations fixed** — Replaced 2 `as any` casts in `anthropic-stream.ts` with narrowed type assertion.

### API Route Tests (+94 new tests)

- **[NEW]** `conversations/route.test.ts` (22 tests), `gems/route.test.ts` (31 tests), `gallery/route.test.ts` (22 tests), `files/route.test.ts` (14 tests), `user/allowed-models/route.test.ts` (5 tests)
- **Test total**: 102 → 196 tests (14 test files, all passing)

---

## 2026-06-13: Improvement — Harness Engineering D-G

- **D: Tiered verification** — Replaced single `npm run verify` in Post-Change Checklist with 3 tiers: Tier 1 (`type-check` after each edit), Tier 2 (`verify` after task), Tier 3 (CI before merge).
- **E: Workflow checkpoints** — Added structured CHECKPOINT gates with YES/NO branches and max 2 retries in `debug.md` after Phase 2 (root cause) and Phase 4 (hypothesis).
- **F: Model routing docs** — Created `docs/model-routing.md` with task-to-model tier mapping (7 task types) and cost awareness guidelines.
- **G: Token observability** — Added Section 6 to `architecture.md` documenting future token tracking metrics (per-task cost, verify overhead, efficiency ratio).

---

## 2026-06-13: Improvement — Workflow Efficiency Optimization (A+B+C)

- **A: `npm run verify` script** — Added to `package.json`. Combines type-check + lint + test:run into one command. Fixes PowerShell `&&` incompatibility. Updated all rules, workflows, and skills to use `npm run verify`.
- **B: `audit.md` exit criteria** — Added verifiable checklist (zero `any`, toast.error on actions, no hardcoded strings, no console.log, component size). Agent now knows when audit PASSES.
- **C: Reorder `01-coding.md`** — BANNED/critical rules (`any` ban, silent catch ban, test requirements) moved to TOP of file. Based on "Lost in the Middle" research (agents miss instructions in the middle of long files).

---

## 2026-06-13: Fix — Top 3 Harness Engineering Gaps

- **Fix #1: Test enforcement** — Added "Testing Requirements" section to `01-coding.md` with `<important>` tag. Co-located tests (`*.test.ts`) now mandatory for `lib/features/` and `lib/core/`.
- **Fix #2: `no-explicit-any` → error** — Changed from `"warn"` to `"error"` in `eslint.config.mjs`. CI now fails on `any` types. Verified: 0 errors.
- **Fix #3: `add-translation.md` rewrite** — Rewrote skill to match current system (`lib/utils/translations/`, `useLanguage()` + `t("key")`). Also fixed stale paths in `04-bilingual.md` and `add-feature.md`.

---

## 2026-06-13: Improvement — Enforce Workflow Usage in Agent Rules (Harness Engineering)

- **What changed**: Updated `02-quality.md` to embed workflow steps directly into rules instead of relying on weak references.
- **Why**: Agents rarely self-invoked workflows (`/debug`, `/post-fix`, `/audit`) because they were framed as optional slash commands, not mandatory procedures.
- **Changes**:
  1. Pre-Work Protocol table now has a "Workflow to follow" column mapping domains to mandatory workflows
  2. Added `<important>` blocks requiring agents to read and follow workflows step-by-step
  3. "After Fixing a Bug" section renamed from "ADDITIONAL" to "MANDATORY Post-Fix Protocol" with inline steps
  4. New "Debugging Protocol" section with inline steps from `/debug` workflow
  5. Circuit breaker rule (3 failed fixes → STOP) now visible directly in rules

---

## 2026-06-13: Fix — Sidebar Layout Jump/Bounce When Switching Chats (RECURRING)

- **What changed**: Elements from Projects section downward no longer "jump" when switching between chats or clicking sidebar items.
- **Actual root cause**: `SidebarButton` was defined **inside** the `Sidebar` function component. Every re-render created a new function reference → React treated it as a different component type → **unmounted and remounted ALL buttons** (New Chat, Chat, Image Studio, Gallery) every render → DOM teardown/rebuild in 1 frame → layout shift cascade on dividers and everything below.
- **Fix**: Extracted `SidebarButton` to **module level** with `React.memo`, ensuring stable component identity across re-renders.
- **Secondary fixes** (applied first, necessary but not sufficient alone):
  1. `SidebarItem`: removed `initial={{ opacity: 0, x: -10 }}` enter animation → `initial={false}`
  2. `SidebarSection`: replaced `useEffect` localStorage read with synchronous `useState` lazy initializer
  3. `ProjectNode`: replaced `useEffect` localStorage read with lazy initializer + guarded auto-expand with functional updater
  4. `AnimatePresence mode="sync"` → `initial={false}` in chat list wrapper
- **Files**: `Sidebar.tsx`, `SidebarItem.tsx`, `SidebarSection.tsx`, `ProjectNode.tsx`

## 2026-06-12: Fix — UX/UI Audit Minor Batch (27 issues)

### Animation

- **SidebarSection**: Replaced `max-h-[2000px]` CSS hack with Framer Motion `height: "auto"` for smooth collapse
- **SidebarItem**: Added enter animation (`opacity: 0, x: -10` → `1, 0`)

### Visual & A11y

- **Empty states**: Enhanced sidebar empty states with icons + descriptive text
- **Charcoal theme**: Accent color `#9ca3af` → `#8ba3be` (more visible blue-gray)
- **TokenBadge**: Reduced prominence with `opacity-50 hover:opacity-100`
- **ModelSelector**: Dropdown `w-[350px]` → `w-[min(350px,calc(100vw-2rem))]` (mobile safe)
- **SidebarItem**: `div[role="button"]` → native `<button>` for a11y
- **SidebarSection**: Added `<h2 className="sr-only">` + `aria-expanded`
- **Chat scroll**: Added `role="log"` + `aria-live="polite"`
- **HeaderBar**: Hid desktop Language/Theme controls on mobile (duplicate)
- **HeaderBar**: Custom `Bars3Icon` SVG → Lucide `Menu`

### UX Fixes

- **FileManager + Gallery**: Added `toast.error()` for delete failures (was silent)
- **ProjectChat export**: Fixed empty export — now uses `downloadConversationById()` with full messages
- **GEMs tooltip**: Added descriptive tooltip for collapsed sidebar

### i18n

- **ErrorBoundary**: 4 hardcoded English strings → translation keys
- **ConfirmDialog**: Inline ternaries → `t()` calls
- **Canvas.tsx**: 4 inline bilingual checks → translation keys
- **GemList**: `"---"` → `t("noDescription")`

### Code Quality

- Deleted redundant `functions.ts` (duplicate of `functionRegistry.ts`)
- Removed `.bat`, `.ps1` from `SUPPORTED_FILE_TYPES` (conflicts with BLOCKED list)

**Files**: 19 files changed (17 modified, 1 deleted, 1 CSS)

---

## 2026-06-12: Fix — UX/UI Audit Final Major Batch (13/13 remaining issues)

### CSS Foundation

- **tailwind.config.ts**: Redirected 14+ dead shadcn HSL variables to live custom properties (`--card` → `--surface-elevated`, `--destructive` → `--danger`, etc.). Removed `hsl()` wrappers. Deleted dead `chart.*` and `sidebar.*` mappings.
- **motion.ts** [NEW]: Centralized animation constants (`DURATION`, `EASE`, `TRANSITION` presets) for consistent motion across all components.

### Theme Token Migration (27 files, 80+ replacements)

- **AdminDashboard.tsx**: Full migration from hardcoded dark theme (`from-gray-900 via-black`, `text-white`, `bg-white/3`) → design system tokens.
- **27 component files**: Batch replaced `text-red-*` → `--danger`, `text-green-*` → `--success`, `text-amber-*` → `--warning`, `text-blue-*` → `--accent` across chat, gallery, image-gen, projects, sidebar, auth, admin.
- **ProjectSettingsModal**: Overlay `bg-black/60` → `bg-(--overlay)`.

### Accessibility (3 modals migrated to Radix Dialog)

- **ImageCompareModal**: `<div fixed>` → Radix Dialog with focus trap, ESC, `aria-label`, `sr-only` title.
- **GemsManager**: Custom modal → Radix Dialog + theme tokens.
- **UserManager**: Custom modal → Radix Dialog + theme tokens.

### UX Improvements

- **Mobile sidebar**: Added slide-in/slide-out animation (Framer Motion + AnimatePresence).
- **GEM indicator**: Upgraded from `text-[10px]` plain text → prominent accent badge with icon + name.
- **Breadcrumbs**: Added navigation breadcrumb to Project detail page (`Home / Projects / Name`).
- **Client-side file validation**: Added pre-upload checks for file size (50MB), blocked extensions, blocked MIME types with toast feedback.

### Code Quality

- **Cron route**: Moved `/api/files/cleanup` → `/api/cron/cleanup` (Next.js convention).
- **Typed errors**: Migrated 50 `throw new Error()` → `NotFoundError`, `ForbiddenError`, `ValidationError`, `DatabaseError` across conversations.ts, fileService.server.ts, gems.ts.

**Files**: 40 files changed (38 modified, 1 new, 1 moved)

---

## 2026-06-12: Fix — UX/UI Audit Major Batch (15+ issues)

### Theme Token Migration

- **ToastContainer**: Migrated from hardcoded dark (`bg-green-950/90` etc.) to semantic tokens (`--success`, `--danger`, `--warning`, `--accent`). Added `role="alert"` + `aria-live="polite"`.
- **Chat Markdown**: Replaced `text-white`, `bg-white/5`, `border-white/10`, `text-neutral-100/300` with `--text-primary`, `--control-bg`, `--border`, `--text-secondary`.
- **ThinkingBlock**: `border-white/10 bg-white/3` → `border-(--border) bg-(--control-bg)`.
- **StreamErrorBanner**: `bg-red-900/90 border-red-500/50 text-red-200` → `bg-(--danger)/10 border-(--danger)/30 text-(--text-primary)`.
- **Switch**: Thumb `bg-white` → `bg-(--text-primary)`.
- **Button island**: `bg-white/10 text-white border-white/20` → `bg-(--control-bg) text-(--text-primary) border-(--control-border)`.
- **IconPicker**: `bg-white/5 hover:bg-white/10 border-white/10` → `bg-(--control-bg) hover:bg-(--control-bg-hover)`.
- **Soviet theme**: Added distinct `--danger: #b91c1c` to differentiate from `--accent: #ef4444`.

### Bilingual (21 new keys, ~30 hardcoded strings replaced)

- **useConversation.ts**: 5 hardcoded Vietnamese toasts → `t()` calls.
- **InputForm.tsx**: 8 hardcoded English strings (IMAGE MODE, Add..., Stop, etc.) → `t?.key` pattern.
- **TokenBadge.tsx**: 4 hardcoded labels (Input/Output/Thinking/tokens) → `t()` calls.
- **ChatBubble.tsx**: "Thinking Process", "ME" → `t()` calls.

### UX Safety

- **KnowledgePanel**: Delete document now requires confirmation via `confirm()` store.
- **UserManager**: Rank change now requires confirmation dialog before executing.

### Accessibility

- **FloatingMenuTrigger**: Added `aria-label="Open menu"`.
- **ToastContainer**: Added `role="region" aria-label="Notifications" aria-live="polite"`, `role="alert"` per toast, `aria-label` on dismiss button.

**Files**: ToastContainer, utilities.css, ChatBubble, StreamErrorBanner, switch, button, IconPicker, soviet.css, FloatingMenuTrigger, useConversation, InputForm, TokenBadge, KnowledgePanel, UserManager, config.ts

---

## 2026-06-12: Fix — UX/UI Audit Critical Batch (10 issues)

### Phase 1: CSS/Theming

- **Tooltip broken**: `bg-popover text-popover-foreground` → `bg-(--surface-elevated) text-(--text-primary)` — `--popover` was never defined in any theme CSS.
- **Avatar fallback broken**: `bg-muted` → `bg-(--surface-muted)` — `--muted` never defined.
- **`--surface-elevated` per glassmorphism theme**: Added to nebula, aqua, holo, orchid, sunset — dialogs/popovers now match theme tone instead of showing base dark surface.
- **`prefers-reduced-motion`**: Added `<MotionConfig reducedMotion="user">` in providers.tsx + CSS `@media (prefers-reduced-motion: reduce)` fallback for non-Framer animations.

### Phase 2: Accessibility

- **Sidebar ARIA**: Added `aria-label="Main navigation" role="navigation"` on both desktop and mobile `<aside>`.
- **Mobile drawer → Radix Dialog**: Replaced custom overlay with `Dialog.Root/Portal/Overlay/Content` for automatic focus trap, ESC close, scroll lock. Added `Dialog.Title` (sr-only) and `aria-label` on close button.
- **Global `focus-visible`**: Added `:focus-visible { outline: 2px solid var(--accent) }` + `:focus:not(:focus-visible) { outline: none }` in utilities.css.
- **ThinkingLevelSelector → Radix DropdownMenu**: Replaced custom useState+backdrop dropdown with `DropdownMenu/Trigger/Content/MenuItem` for keyboard nav and ARIA.

### Phase 3: Types & Bilingual

- **Type deduplication (facade pattern)**: `types/chat.ts` and `types/image-gen.ts` now re-export from authoritative `lib/features/` sources. Eliminated `Conversation` drift (missing `projectId`), `ImageGenOptions` drift (missing `referenceImage`).
- **Projects bilingual**: Added 41 translation keys. Replaced 44 hardcoded English strings across `projects/[id]/page.tsx`, `CreateProjectModal.tsx`, `ProjectSwitcher.tsx` with `t()` calls. Fixed mixed Vietnamese toast.

**Files**: tooltip.tsx, avatar.tsx, 5× glassmorphism CSS, utilities.css, providers.tsx, Sidebar.tsx, ThinkingLevelSelector.tsx, types/chat.ts, types/image-gen.ts, config.ts, projects/[id]/page.tsx, CreateProjectModal.tsx, ProjectSwitcher.tsx

---

## 2026-06-12: Refactor — UX/UI Audit Phase 4 (Waves 1-2)

### Wave 1: Font Sizes & Token Cleanup

- **`text-[11px]` → `text-xs`**: Swept all 66 violations. Option B: kept `text-[10px]` on
  VN/EN toggles, group labels, dropdown headers, small badges.
- **`#d97706` × 4**: HeaderBar theme swatch fallback → `var(--accent)`.
- **`bg-neutral-800`**: `base.css` scrollbar thumb + `GemPreview` → `var(--control-border)`.
- **`text-[9px]`**: HeaderBar mobile group label → `text-[10px]` (below floor).
- **Files**: HeaderBar, ModelSelector, SmartCode, ThinkingLevelSelector, FileInMessage,
  FileManagerPanel, FilePreviewArea, Canvas, signin/page, GemPreview, base.css

### Wave 2: Modal Migration

- **`DeleteConfirmModal` → DELETED**: Replaced with imperative `confirm()` from `confirmStore`.
  - `ChatApp.tsx`: Removed lazy import + `<Suspense>` render block.
  - `useChatModals.ts`: `openDeleteModal` now calls `confirm({ variant: "danger" })` directly;
    removed 4 state variables (`showDeleteModal`, `conversationToDelete`, etc.).
  - `ProjectSettingsModal.tsx`: 2 × `<DeleteConfirmModal>` → 2 × `confirm()` calls; also
    fixed dead tokens (`bg-primary`, `text-primary-foreground`, `red-500`) → Vikini tokens.
  - **Deleted**: `src/app/components/DeleteConfirmModal.tsx` (124 lines).
- **`CreateProjectModal` → Radix Dialog**: Replaced `div fixed inset-0` with `<Dialog>` +
  `<DialogContent>`. Dead tokens (`bg-muted/50`, `text-muted-foreground`, `bg-primary`,
  `text-destructive`, `border-border`) → Vikini tokens. Now has focus trap + ESC.
- **Gallery Detail Modal → Dialog**: Wrapped with `<Dialog>` + `<DialogContent>`, added
  `<DialogTitle>` for accessibility. Focus trap + ESC free from Radix.

### Wave 3: Admin & Gallery Polish

- **UserManager**: 4 × native `<select>` → Radix `<Select>` primitive. Removed all
  `bg-[#1a1a1a]`, `colorScheme: "dark"` inline styles.
- **GalleryView compare mode**: `purple-500` → `--accent` token (border, ring, indicator).
- **ImageCompareModal**: `purple-500` → `--accent` token (overlay toggle, model badge).

### Wave 4: Auth Pages

- **@ts-ignore × 3 REMOVED**: signin/page.tsx, error/page.tsx, confirm-dialog.tsx.
- **`window.location.href`** → `useRouter().push()` in error/page.tsx.
- **AccessPendingScreen** → bilingual with `useLanguage()` + 7 new translation keys.
- **`#020617`**: Kept per decision (login pages always dark).

### Verification

- `type-check` ✅, `lint` ✅, `test` ✅ (2 pre-existing env failures).
- **Total files changed**: 22+ files modified, 1 file deleted across all 4 waves.

### Bug Fix (mid-wave)

- **CreateProjectModal color picker**: Fixed self-closing `<button />` + TW v4 arbitrary
  value syntax (`ring-offset-[var(--surface)]`).

---

## 2026-06-12: Fix — GemManager Scroll + Image Studio Delete Confirm + Token Cleanup

### Bug Fixes

- **GemManager scroll lost**: Gem list container used `lg:overflow-y-visible` which
  killed vertical scroll on desktop. Changed to keep `overflow-y-auto` with
  `max-h-[60vh]` at all breakpoints. Added `min-h-0` on flex parent for proper
  flex-scroll containment.
- **Image Studio delete without confirm**: Sidebar `onDeleteConversation` called
  `deleteConversation()` directly without user confirmation. Added `confirm({ variant: "danger" })`
  from `confirmStore`.

### Token & Standards Cleanup

- **GemList**: `red-900/50`, `red-300`, `red-950/40` → `--danger` tokens; `text-neutral-*`
  → `text-(--text-secondary)`; all `text-[10px]`/`text-[11px]` → `text-xs`.
- **GemManager**: `text-[10px]` on Reset Default button → `text-xs`.
- **ImageGenStudio**: Dead `bg-destructive text-destructive-foreground` → `bg-(--danger)
text-(--danger-foreground)`.

### Verification

- `type-check` ✅, `lint` ✅.

- **Files changed**: `GemManager.tsx`, `GemList.tsx`, `ImageGenStudio.tsx`

---

## 2026-06-12: Refactor — UI/UX Phase 3 (Migrate surfaces to canonical primitives)

> Builds on Phase 1. Unifies confirmation dialogs and loading states across features.

### Migrated confirmations → imperative `confirm()`

- `features/gems/components/GemManager.tsx` — removed `pendingDeleteGem` state + hand-rolled
  `fixed inset-0` modal; `onDelete` now calls `confirm({ variant: "danger" })`. Bilingual
  labels preserved via `t()`.
- `admin/components/GemsManager.tsx` — removed `pendingDeleteId` state + custom modal; same pattern.
- `features/gallery/components/GalleryView.tsx` — replaced the 2-step inline delete
  (`showDeleteConfirm`) with a single button + `confirm()`; removed the now-dead state and its
  resets in `handlePrev/NextImage`. Hardcoded `red-500` swapped for `--danger` token.

### Loading states → `Skeleton`

- `GalleryView` — initial grid load now shows a 10-cell `Skeleton` grid matching the image
  layout instead of a lone centered spinner.

### Verification

- `type-check` ✅, `lint` ✅, `build` ✅.
- Tests: 100 passed; 2 pre-existing env failures in `limits.test.ts`, unrelated.

- **Files changed**: `features/gems/components/GemManager.tsx`, `admin/components/GemsManager.tsx`, `features/gallery/components/GalleryView.tsx`

### Docs / standards

- Corrected `rules/03-ui.md`: documented the live token vocabulary; banned the dead shadcn
  token classes (`bg-primary`, `bg-destructive`, `bg-popover`, …) that compile to empty styles
  under Tailwind v4; added accessibility + min-font + no-hand-rolled-modal standards.
- `docs/architecture.md`: added a Design System (Tokens & Primitives) section + `confirmStore`.
- `docs/lessons-learned.md`: recorded the dead-token and hand-rolled-modal lessons.

---

## 2026-06-12: Refactor — UI/UX Phase 1 (Primitives + Design Tokens)

> Direction A (refine current look) with C accents (glow on destructive surfaces).
> Foundational pass from the UX/UI audit (`docs/ux-ui-audit.md`).

### Root cause fixed: dead shadcn token layer

- **Symptom**: `components/ui/` primitives (Button, Dialog, Input, Card, Select, Switch,
  Popover, Dropdown) referenced shadcn tokens (`--background`, `--destructive`, `--ring`,
  `--radius`, `--muted-foreground`, …) that are **defined nowhere**, and `tailwind.config.ts`
  is **not loaded** under Tailwind v4 (no `@config`). The utilities resolved to empty styles,
  so dialogs rendered transparent and dropdowns had no background. Features worked around this
  by hardcoding `--surface`/`white/X` glass on top — the source of the design drift.
- **Fix**: rewrote all primitives onto the live Vikini token vocabulary
  (`--surface`, `--surface-elevated`, `--text-primary`, `--border`, `--control-bg`,
  `--control-border`, `--accent`). Added semantic state tokens.

### Added — design tokens (`styles/themes/_shared/base.css`)

- `--danger` / `--danger-hover` / `--danger-foreground`, `--success`, `--warning`
- `--accent-foreground` (near-black, readable on all 15 theme accents)
- `--ring`, `--radius`, `--overlay`

### Added — primitives

- `components/ui/skeleton.tsx` — canonical loading placeholder.
- `lib/store/confirmStore.ts` + `components/ui/confirm-dialog.tsx` — imperative
  `confirm()` API (replaces `window.confirm()`), async in-dialog loading, `danger` glow
  variant. Host mounted globally in `MainLayout`. Focus-trap / ESC / `role="dialog"`
  come from Radix.

### Migrated

- `projects/[id]/page.tsx` — 2 native `confirm()` → `confirm()` store.
- `chat/components/ChatApp.tsx` — 2 hand-rolled modal `div`s (rename, delete message)
  → `Dialog` primitive (now with focus-trap + ESC).

### Verification

- `type-check` ✅, `lint` ✅, `build` ✅ (no errors/warnings).
- Tests: 100 passed; 2 pre-existing env failures in `limits.test.ts`
  ("Missing Supabase service role key"), unrelated to this change.

- **Files changed**: `styles/themes/_shared/base.css`, `components/ui/{button,dialog,alert-dialog,input,textarea,card,select,switch,popover,dropdown-menu,skeleton,confirm-dialog}.tsx`, `lib/store/confirmStore.ts`, `app/features/layout/components/MainLayout.tsx`, `app/projects/[id]/page.tsx`, `app/features/chat/components/ChatApp.tsx`

---

## 2026-06-11: Fix — AI Not Reading Uploaded Images + Table Format Breaking

### Bug 1: AI không chủ động đọc file ảnh upload

- **Symptom**: AI không mô tả/acknowledge ảnh upload, đặc biệt ảnh thứ 2 trở đi. Chỉ đọc khi user yêu cầu rõ ràng.
- **Root causes**:
  1. Ảnh thiếu label `[NEWLY ATTACHED]` — chỉ text files mới có
  2. Gemini Files API gửi `fileData` trần không kèm text label
  3. Header instruction chỉ nói "don't execute" (phòng thủ), không yêu cầu AI mô tả ảnh
- **Fixes**:
  1. Thêm `[NEWLY ATTACHED]` label cho ảnh (giống text files)
  2. Thêm text label trước Gemini Files API `fileData` parts
  3. Thêm instruction: "For IMAGE attachments: Always briefly acknowledge and describe what you see in EACH image"
  4. Thêm summary note khi >1 ảnh: `[NOTE: N images attached. Please acknowledge ALL images]`

### Bug 2: Format bảng bị vỡ trong chat

- **Symptom**: Cột header bị nén chữ dọc (mỗi ký tự 1 dòng), `<br>` hiển thị như text thay vì xuống dòng.
- **Root causes**:
  1. `display: block` trên `.chat-markdown table` phá vỡ table layout algorithm → cột ngắn bị nén tới 0px
  2. ReactMarkdown không bật `rehype-raw` → HTML tags (`<br>`) bị escape thành text
- **Fixes**:
  1. Thay `display: block` bằng `table-layout: auto` (wrapper div đã handle scroll)
  2. Thêm `white-space: nowrap` cho `thead th` + `min-width: 80px` cho `td`
  3. Thêm `rehype-raw` vào ReactMarkdown rehypePlugins (đã có trong package.json)

- **Files changed**: `chatStreamCore.ts`, `utilities.css`, `ChatBubble.tsx`

---

## 2026-06-11: Fix — IMAGE_SAFETY Error Not Surfaced to User

- **Symptom**: When Gemini blocks image generation due to safety filters (e.g., brand names like "Heineken"), user sees generic "Image generation failed" error instead of an actionable message.
- **Root cause**: `GeminiNativeImageProvider` didn't check `finishReason` on candidates. When `finishReason` was `IMAGE_SAFETY`, `content.parts` was empty, triggering generic "No image parts in Gemini response" error. Route handler then masked it with generic 500.
- **Fixes**:
  1. `GeminiNativeImageProvider.ts`: Check `finishReason` before parts — detect `IMAGE_SAFETY`, `SAFETY`, `RECITATION` and throw user-friendly messages with guidance.
  2. `route.ts`: Surface safety-related errors with 422 status instead of generic 500.
  3. `ImageGenStudio.tsx`: Display API error message in error modal instead of generic translation.
  4. `useImageGenController.ts`: Fix `data.error` extraction (was passing whole object → `[object Object]`).
  5. `constants.ts`: Added `UNPROCESSABLE_ENTITY: 422` to `HTTP_STATUS`.
- **Files changed**: `GeminiNativeImageProvider.ts`, `route.ts`, `ImageGenStudio.tsx`, `useImageGenController.ts`, `constants.ts`

---

## 2026-06-09: Fix Regenerate and Edit Buttons Failing Silently & Delete Modal Improvements

- **Symptom**:
  - The "Regenerate" and "Edit" buttons in the chat interface sometimes failed silently for newly generated messages.
  - The Delete Conversation modal had two overlapping "X" close buttons and lacked visual feedback when clicking "Delete".
- **Root causes**:
  1. `handleRegenerate` and `handleEdit` attempted to find the message index using object reference equality (`m === specificMessage`) on an array returned by `normalizeMessages`, which created new object references.
  2. Fallback matching logic relied on `specificMessage.id`, which could be missing if the background reload from the server hadn't finished.
  3. Original user message attachments (`fileIds`) were lost on regenerate/edit because they weren't passed down to `coreSend`.
  4. The custom `DeleteConfirmModal` card wrapper was inside `DialogContent` which rendered its own default close button underneath the custom one.
  5. The `onConfirm` action in `DeleteConfirmModal` lacked a loading state to show processing status.
- **Fixes**:
  1. Added fallback matching logic to compare `role` and `content` when the ID is missing for regenerate/edit.
  2. Extracted `fileIds` from the `meta` of the user message and passed them to `coreSend` to preserve attachments.
  3. Added `[&>button]:hidden` to `DialogContent` to hide the default unstyled close button.
  4. Added `isDeleting` state in `DeleteConfirmModal` with a `Loader2` spinner and disabled buttons during deletion.
- **Files changed**: `useChatStreamController.ts`, `DeleteConfirmModal.tsx`

---

## 2026-05-29: Fix — Sidebar Chat List Flicker on Every Interaction

- **Symptom**: Chat list flickered (flash/remount) on every click, button press, or window minimize/restore.
- **Root causes**:
  1. `SidebarContent` was an inline component inside `Sidebar` — React treated it as a new component type each render → full unmount/remount of all children including `AnimatePresence` + `SidebarItem` animations.
  2. `SidebarItem` `initial={{ opacity: 0, x: -10 }}` replayed on every remount.
  3. SWR `revalidateOnReconnect` was default `true` — refetched on window restore.
- **Fixes**:
  1. Converted `SidebarContent` from inline component to render function (`renderSidebarContent`) — React now reconciles stably by key.
  2. Added `hasMountedRef` to skip initial animation on re-renders (entrance animation still plays on first mount).
  3. Added `revalidateOnReconnect: false` to SWR config.
- **Files changed**: `Sidebar.tsx`, `SidebarItem.tsx`, `useConversation.ts`

---

## 2026-05-29: Image Studio — Major Augmentation (4 Phases)

### 🟢 Phase 1: Image Editing (Inpainting / Style Transfer / Extend)

- **New `/api/edit-image` endpoint** — Accepts source image + edit prompt → Gemini Native Image Gen → returns edited image saved as new message.
- **New `EditImageModal` component** — Dialog with source preview, edit prompt textarea, model selector (Flash/Pro), aspect ratio, 6 suggestion chips with stagger animation.
- **Canvas "Edit" button** — Blue pill button with Pencil icon appears on image hover overlay.

### 🟢 Phase 2: Image-to-Image (Reference Upload)

- **ControlPanel reference image section** — Drag-and-drop / click-to-upload with thumbnail preview + remove button.
- **Auto-routing** — When reference image present, generate-image API auto-routes to `gemini-native` provider.
- **GeminiNativeImageProvider update** — Supports `referenceImage` in options, sends as `inlineData` part alongside text prompt.

### 🟢 Phase 3: Lightbox trong Studio

- **New `ImageLightbox` component** — Fullscreen overlay (z-50) with zoom (scroll wheel, +/- buttons, 1x-5x), pan (mouse drag when zoomed), keyboard navigation (←→, Esc, +/-), mobile swipe via Framer Motion drag, bottom info bar with prompt/badges, action buttons (Remix/Edit/Download/Delete), double-click zoom toggle.
- **Canvas click handler** — Click image opens lightbox at that index.

### 🟢 Phase 4: Batch Generation

- **Rank-based quota system** — basic: 2 images/10 uses, pro: 2-3 images/10+10 uses, admin: 2-4 images/999 uses. Daily tracking via Upstash Redis.
- **New `batchGenQuota.ts` module** — Config, Redis helpers, `incrementBatchGenUsage()`.
- **New `/api/batch-gen-quota` endpoint** — Returns user's quota status per batch size.
- **ControlPanel batch selector** — 4-button grid with hover/longpress tooltip showing remaining daily uses, disabled state when exhausted.
- **Sequential batch generation** — ImageGenStudio generates N images sequentially with "Generating 2/4..." progress label, refreshes after each.
- **Quota refresh** — Auto-refetch after batch generation completes.

### 🔧 Code Quality

- 32 new bilingual translation keys (vi+en) for editing, reference, lightbox, batch gen.
- TypeScript strict: 0 errors. ESLint: 0 errors.
- New files: 5 (EditImageModal, ImageLightbox, edit-image route, batch-gen-quota route, batchGenQuota module).
- Modified: 6 (config.ts, Canvas.tsx, ControlPanel.tsx, ImageGenStudio.tsx, generate-image route, GeminiNativeImageProvider).

---

## 2026-05-29: Image Studio — Mobile Layout Fix + UX Overhaul

### 🔴 Critical Fix

- **Mobile layout completely broken** — ControlPanel used `w-full` on mobile, pushing Canvas (Results) off-screen. Added mobile tab system (Studio/Results) with animated indicator, auto-switch to Results after generation.

### 🟡 UX Improvements

- **Empty state redesigned** — Glassmorphism card with animated floating icon, gradient glow, prompt suggestions (rotating curated + recent prompts).
- **Framer Motion animations** — Image cards stagger in, shimmer skeleton loading, smooth empty state fade-in.
- **HeaderBar props fixed** — Was `t={}` + `language="en"` hardcoded, now receives proper translation dict and language handler.
- **Responsive padding** — Canvas `px-4 md:px-6 lg:px-8`, ControlPanel `px-4 md:px-6`.

### 🔧 Code Quality

- Removed `bg-black` hardcode → `bg-(--surface-elevated)`, removed broken `col-span-full` + decoration div.
- 7 new bilingual keys: `studioTabStudio/Results`, `studioEmptyTitle/Desc`, `studioTryPrompt`, `studioRecentPrompts`, `studioSuggestedPrompts`.

### Files changed

- **Modified**: ImageGenStudio.tsx, Canvas.tsx, ControlPanel.tsx, config.ts

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
