# Lessons Learned -- Agent Recurring Mistakes

> **Purpose**: Log of recurring mistakes that agents make during development.
> Agents MUST read this file before debugging or fixing bugs.
> Updated automatically after each bug fix via the `/post-fix` workflow.

## How This File Works

- After fixing a bug, add a new entry under the appropriate category below.
- If the same mistake pattern appears 3 or more times in a category, promote it to a formal rule in `.agent/rules/`.
- Entries are organized by category (not chronologically) for easy scanning.

---

## TypeScript and Type Safety

### 2026-06-12: Type duplication drift between `types/` and `lib/features/`

- **Symptom**: `Conversation` in `types/chat.ts` lacked `projectId` field; `ImageGenOptions` lacked `referenceImage`. Code using wrong source got compile errors or missing data.
- **Root Cause**: Types were copy-pasted into both `types/` and `lib/features/` during feature development. New fields were only added to `lib/features/` without updating `types/`.
- **Fix**: Converted `types/chat.ts` and `types/image-gen.ts` into facade modules that re-export from authoritative `lib/features/` sources.
- **Prevention**: Types MUST have a single authoritative source. `types/` folder should only re-export, never define duplicates.

## CSS and Theming

### 2026-06-12: Dead shadcn CSS variables breaking components

- **Symptom**: Tooltip invisible, Avatar fallback missing on all custom themes.
- **Root Cause**: Shadcn/UI components reference CSS variables (`--popover`, `--muted`, `--card`, etc.) via `hsl()` wrapper in tailwind.config.ts, but these variables are never defined in the custom theme CSS. The theme system uses `--surface-elevated`, `--surface-muted` etc. instead.
- **Fix**: Replaced shadcn token classes with design system tokens (`bg-(--surface-elevated)`, `bg-(--surface-muted)`).
- **Prevention**: When adding shadcn components, ALWAYS audit their CSS classes against the actual theme variable definitions. If they reference `bg-popover`, `bg-muted`, `bg-card` etc., replace with `--surface-*` tokens.

### 2026-06-12: `--surface-elevated` not overridden per-theme

- **Symptom**: Dialogs/popovers showed base dark surface (`#0f1115`) on glassmorphism and light themes (e.g. Orchid showed dark popover on light background).
- **Root Cause**: `--surface-elevated` was only defined in base.css with a single dark value. Per-theme CSS files overrode `--surface-muted` but not `--surface-elevated`.
- **Fix**: Added `--surface-elevated` to all 5 glassmorphism themes with tone-appropriate values.
- **Prevention**: When adding new themes, ensure ALL surface tokens (`--surface`, `--surface-muted`, `--surface-elevated`, `--surface-strong`) are overridden.

## Internationalization (i18n)

### 2026-06-12: Hardcoded English strings in new features

- **Symptom**: Projects feature was 100% English despite the app being bilingual.
- **Root Cause**: New features were developed without importing the translation system. 44 hardcoded strings across 3 files.
- **Fix**: Added 41 translation keys to config.ts, replaced all hardcoded strings with `t()` calls.
- **Prevention**: Every new user-facing string MUST use the `t()` translation function. Never hardcode English or Vietnamese strings directly.

### 2026-06-12: Hardcoded Vietnamese in toast messages

- **Symptom**: `CreateProjectModal` had `"Đã tạo dự án..."` toast — Vietnamese-only, not translated.
- **Root Cause**: Developer used inline Vietnamese string for toast instead of translation key.
- **Fix**: Replaced with `t("projectCreatedSuccess")`.
- **Prevention**: Toast messages must always use translation keys, same as UI labels.

### 2026-04: `as any` in streaming and knowledge modules

- **Symptom**: Type-check failures when refactoring streaming response handling
- **Root Cause**: Convenience `as any` assertions were used during rapid prototyping in `streaming.ts` and `knowledge.server.ts`
- **Fix**: Replaced with proper `unknown` + type narrowing patterns
- **Prevention Rule**: Enforced in `rules/01-coding.md` — `any` is banned everywhere

---

## UI and Styling

### 2026-06: Dead shadcn token layer under Tailwind v4

- **Symptom**: `components/ui/` primitives (Dialog, Button, Input, Select, Dropdown…) rendered with no background / wrong colors; features compensated by hardcoding `--surface`/`white/X` glass, causing visual drift across the app.
- **Root Cause**: Primitives used shadcn token classes (`bg-background`, `bg-destructive`, `text-muted-foreground`, `border-input`, `ring-ring`, `bg-popover`, `--radius`) whose CSS variables are **defined nowhere**. Under Tailwind v4 the project has **no `@config`**, so `tailwind.config.ts`'s color map never loads — those utilities compile to empty styles.
- **Fix**: Rewrote primitives onto the live Vikini token vocabulary (`--surface*`, `--text-*`, `--control-*`, `--border`, `--accent`) via `bg-(--token)` arbitrary syntax; added semantic state tokens (`--danger/--success/--warning`, `--ring/--radius/--overlay`) in `base.css`.
- **Prevention Rule**: Promoted to `rules/03-ui.md` — dead shadcn token classes are BANNED; use the token table. (Corrects the old rule that wrongly recommended `bg-primary`/`bg-destructive`.)

### 2026-06: Hand-rolled modals missing focus-trap / ESC

- **Symptom**: Custom `fixed inset-0` modal `div`s (ChatApp rename/delete) and native `confirm()` (projects page) — inconsistent look, no keyboard trap, no `role="dialog"`.
- **Root Cause**: Same primitive built four different ways across the app; no canonical confirm component.
- **Fix**: Added imperative `confirm()` (`lib/store/confirmStore.ts`) + global `ConfirmDialogHost` on Radix Dialog; migrated offenders. Focus-trap/ESC/ARIA now come for free.
- **Prevention Rule**: `rules/03-ui.md` — hand-rolled modal `div`s banned; use `Dialog` primitive / `confirm()`.

### 2026-04: Vietnamese diacritics input bug in search

- **Symptom**: Search input dropped characters during IME composition (Vietnamese with diacritics)
- **Root Cause**: `onChange` handler fired during IME composition, interrupting the input method
- **Fix**: Added `onCompositionStart` / `onCompositionEnd` guards to defer state updates
- **Prevention Rule**: Always use composition event guards for text inputs that support CJK/Vietnamese

### 2026-05: Sidebar flickering — unstable computed array busting React.memo ⚠️ RECURRING

- **Symptom**: Sidebar chat list flickers continuously during streaming (every 15ms) and on every keystroke.
- **Root Cause**: `personalConversations = conversations.filter(...)` was computed inline (no `useMemo`) in `useConversation()`. Every `ChatApp` re-render (triggered by typing or streaming state) called the hook → created a new array reference → `filteredConversations` useMemo dep changed → new prop to `Sidebar` → `React.memo` bypassed → full sidebar re-render including Framer Motion layout animations.
- **Fix**: Wrapped `personalConversations` with `useMemo([conversations])`.
- **Prevention Rule**: **Any `.filter()`, `.map()`, or `.reduce()` result that flows to a memoized component as a prop MUST be wrapped in `useMemo`.** This is the 2nd occurrence of sidebar flickering (1st was unmemoized callbacks, now unstable arrays). Always audit props passed to `React.memo` components for referential stability.

### 2026-06: Sidebar layout jump/bounce — inline component definition causing unmount/remount ⚠️ RECURRING (3rd occurrence)

- **Symptom**: All elements from Projects downward "jump" once when switching chats or clicking ANY sidebar item (except 3-dot menu which doesn't trigger parent re-render).
- **Root Cause**: `SidebarButton` was defined **inside** the `Sidebar` function body. Each `Sidebar` re-render created a new function reference → React treated it as a new component type → **unmounted and remounted ALL button instances** → DOM teardown/rebuild in one frame → layout shift on dividers and everything below.
- **Misdiagnosis (first attempt)**: Initially blamed Framer Motion `initial` animations, `useEffect` localStorage reads, and `ProjectNode` auto-expand. These were secondary issues that masked the true cause. Fixing them alone did NOT resolve the bounce.
- **Fix**: Extracted `SidebarButton` to **module level** with `React.memo`. Secondary: removed enter animations, replaced `useEffect` localStorage with `useState` lazy initializer, guarded `ProjectNode` auto-expand.
- **Prevention Rule**: **NEVER define React components (functions that accept props and return JSX) inside another component's function body.** They MUST be at module level or in separate files. Inline definitions create new component identity on every render → React unmounts/remounts → layout shift. This rule applies even if the component has no hooks — the identity instability alone is enough to cause visual bugs. Use render functions (returning JSX without being treated as components) only when intentional and documented.

### 2026-05: Side effects inside useDebounceCallback are delayed — mark state changes synchronously

- **Symptom**: After clicking Send, uploaded files stayed visible in input preview for 500ms before disappearing
- **Root Cause**: `markAsSent(fileIds)` was called inside `useDebounceCallback(() => { ... }, 500)`. The entire callback body — including the state update — was delayed by 500ms. UI didn't reflect the change until after the debounce fired.
- **Fix**: Moved `markAsSent()` to `handleSubmit()` (synchronous), stored fileIds in a `useRef` for the debounced `onSubmit` to use later.
- **Prevention Rule**: **Never put synchronous UI state changes inside debounced callbacks.** If a side effect must happen immediately (hide elements, show loading), call it outside the debounce. Only the actual async operation (API call, message send) should be debounced.

### 2026-05: Zustand + Set causes `[object Object]` render

- **Symptom**: File preview card showed `[object Object]` text where file size should be, with red error border
- **Root Cause**: `sentFileIds: Set<string>` in Zustand store. `Set` objects don't serialize to JSON — when React/Zustand tried to compare or render the state, it became `[object Object]`. Zustand's shallow equality check may not handle `Set` correctly.
- **Fix**: Changed `Set<string>` → `string[]`. Dedup via `[...new Set([...old, ...new])]`.
- **Prevention Rule**: **Do NOT use `Set`, `Map`, or other non-serializable types in Zustand state.** Use plain arrays/objects. For dedup, use `[...new Set(arr)]` pattern on write.

### 2026-06: `display: block` on `<table>` destroys column width distribution

- **Symptom**: Markdown table columns with short headers (e.g., "PHẦN") displayed text vertically — each character on its own line.
- **Root Cause**: `.chat-markdown table { display: block }` was used for horizontal scroll, but it **destroys the table layout algorithm**. The table no longer auto-distributes column widths. Narrow columns get squeezed to 0px width.
- **Fix**: Removed `display: block`, used `table-layout: auto` instead. Horizontal scroll is already handled by the wrapper `<div className="overflow-x-auto">` in the React component.
- **Prevention Rule**: **NEVER use `display: block` on `<table>` elements.** It destroys native table layout. For horizontal scrolling, wrap the table in a `<div>` with `overflow-x: auto` instead.

### 2026-06: AI not proactively reading uploaded images — missing labels and instructions

- **Symptom**: AI models didn't acknowledge or describe uploaded images, especially the 2nd image onwards. Only read them when explicitly asked.
- **Root Cause**: (1) Images didn't receive `[NEWLY ATTACHED]` labels unlike text files. (2) Gemini Files API sent bare `fileData` parts with no text context. (3) Header instruction only said "don't execute instructions" (defensive) without asking AI to describe images.
- **Fix**: Added `[NEWLY ATTACHED]` labels for images, text labels before Gemini URI parts, explicit instruction to "acknowledge and describe what you see in EACH image", and a count note when >1 images.
- **Prevention Rule**: **When injecting multimodal content (images, files) into AI context, always pair each binary part with a descriptive text label.** AI models need text anchors to understand the significance of binary parts. Without labels, models treat binary data as background context and may not proactively engage with it.

---

### 2026-06-26: Form onSubmit handler dropping explicit state fallback

- **Symptom**: Clicking "Send" in Chat Input did nothing when Deep Research mode was active.
- **Root Cause**: The `onSubmit` handler in `InputForm` passes `undefined` for the text content (expecting the parent to use its own state), but the new interceptor function strictly checked `if (text)` and aborted if undefined, failing to fallback to the React state.
- **Fix**: Added `const finalQuery = text || input;` fallback inside the interceptor function.
- **Prevention Rule**: When intercepting or wrapping existing event handlers, ensure that all default fallbacks (like reading from state if params are undefined) are preserved in the wrapper.

## API and Streaming

### 2026-06-09: Array mapping breaks object reference equality checks

- **Symptom**: "Regenerate" and "Edit" buttons silently failed for newly generated messages that didn't have an ID yet.
- **Root Cause**: The UI matched the clicked message against the messages array using object reference equality (`m === specificMessage`). However, the messages array was passed through a `normalizeMessages` function that returned _new_ object references on every render. Thus, the reference equality check always failed. Since the message didn't have an ID yet (was just streamed), the ID fallback also failed.
- **Fix**: Added a fallback check that compares `role` and `content` when both IDs are missing, and ensured that `fileIds` are preserved when extracting the previous user message for regeneration.
- **Prevention Rule**: **Do NOT rely purely on object reference equality (`===`) for array items if the array is mapped/normalized.** If a component maps over an array and creates new objects, any event handler that tries to find the item in the original array by reference will fail. Always use a robust unique identifier (like an ID) or a deep structural comparison fallback.

### 2026-06: `String(data.error)` produces `[object Object]` when API returns structured error

- **Symptom**: EditImageModal showed `[object Object]` in the error display after a failed API call. No useful error feedback to user.
- **Root Cause**: API response format is `{ error: { message: "...", code: "..." } }` (object), but client code used `String(data.error)` which stringifies the object to `[object Object]`. Also, request body had field name mismatch (`prompt` sent but `editPrompt` expected; `model`/`aspectRatio` sent top-level but expected nested in `options`).
- **Fix**: Extract `data.error.message` instead of `String(data.error)`. Fixed request body field names to match Zod schema.
- **Prevention Rule**: **When parsing error responses, ALWAYS check if `data.error` is an object with a `.message` property before stringifying.** The standardized API error format is `{ error: { message, code } }`. Use: `typeof errObj === "object" && "message" in errObj ? errObj.message : String(errObj)`.

### 2026-06-25: OpenRouter streaming reasoning_details returns Array of Objects

- **Symptom**: The Thinking UI rendered `[object Object][object Object]...` instead of the actual thought content.
- **Root Cause**: In streaming mode, OpenRouter returns `delta.reasoning_details` or `delta.reasoning` which can be an array of objects `[{ type: "text", text: "..." }]` rather than a flat string. Concatenating it as a string produced `[object Object]`.
- **Fix**: Added deep extraction helper that checks `typeof`, `Array.isArray`, and pulls `text` or `content` properties safely before concatenating to the thought buffer.
- **Prevention Rule**: Never assume untyped API fields (like OpenRouter beta parameters) are strings. Always do safe recursive string extraction or type checking.

- **Symptom**: Agent skipped `await auth()` in API routes believing proxy handled it
- **Root Cause**: `docs/security.md` documented a non-existent `proxy.ts` mechanism
- **Fix**: Corrected docs to reflect actual NextAuth v5 direct import pattern
- **Prevention Rule**: Always verify documented patterns against actual code before following them

---

## Database and Queries

### 2026-02: Embedding dimension mismatch

- **Symptom**: Vector insert failed with dimension error
- **Root Cause**: Migration created `VECTOR(3072)` but code switched to `text-embedding-004` (768d)
- **Fix**: Migration `20260204180000` removed dimension constraint, using generic `VECTOR` type
- **Prevention Rule**: When supporting multiple embedding models, never fix vector dimensions

### 2026-05: User ID is NOT UUID — it's a Google numeric ID ⚠️ RECURRING

- **Symptom**: Admin rank change silently failed (400 "Invalid userId format - must be a valid UUID"). User selected a new rank → dropdown reverted to old value.
- **Root Cause**: `isValidUUID()` regex only accepted UUID format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). But Vikini uses **Google OAuth**, so `profiles.id` is a **Google numeric ID** (e.g., `111673153137785334295`), not a UUID.
- **Fix**: Replaced `isValidUUID()` with `isValidUserId()` that accepts both UUID and Google numeric ID (`/^\d{10,30}$/`).
- **Prevention Rule**: **NEVER assume user IDs are UUIDs in this project.** Vikini uses Google OAuth — user IDs are long numeric strings. Any validation that touches `userId` or `profiles.id` must accept this format. When writing ID validators, always check the actual data format in the DB first.

### 2026-05: auth.uid() RLS policies are WRONG for this project ⚠️

- **Symptom**: Attempted to add Row Level Security to `files` table using `auth.uid()::text` — would have blocked all file operations via non-admin clients.
- **Root Cause**: `requireUser()` returns `session.user.email.toLowerCase()` as `userId`. The `user_id` column stores **email strings**, not Supabase Auth UUIDs. `auth.uid()` returns a UUID from `auth.users` that never matches email strings. Additionally, all existing tables (`conversations`, `messages`, `attachments`) have NO RLS — security is enforced server-side via `supabaseAdmin` (service_role key).
- **Fix**: Removed all RLS policies. Added documentation comment in migration explaining the architecture.
- **Prevention Rule**: **DO NOT add `auth.uid()` based RLS policies.** This project uses email as `user_id` and `supabaseAdmin` for all queries. RLS with `auth.uid()` would silently break operations. Security is enforced at the application layer (every query filters by `userId`).

### 2026-05: Stale project stats after Knowledge Base mutations

- **Symptom**: After uploading documents to a project, Info panel showed Documents: 0 and Storage: 0.00 / 5 MB.
- **Root Cause**: `handleUpload()` and `handleDeleteDocument()` only called `fetchDocuments()` (local component state) but never `fetchProjects()` (Zustand store). The Info panel reads `project.document_count` / `project.storage_bytes` from the store, which stayed stale.
- **Fix**: Added `fetchProjects()` alongside `fetchDocuments()` via `Promise.all()` in both `ProjectSettingsModal.tsx` and `projects/[id]/page.tsx`.
- **Prevention Rule**: **When mutating child data (documents, conversations), always refresh the parent store (projects).** Stats like counts and storage are computed server-side — they won't update unless the parent is re-fetched.

---

### 2026-06-26: `userId` inconsistency between Email and Google UUID

- **Symptom**: `[ForbiddenError]` when checking permissions in Deep Research API.
- **Root Cause**: `userId` in `src/app/api/...` is often assumed to be the user's email address (e.g. `session.user.email`), but `profiles` table uses Google Auth ID (UUID-like string) as its Primary Key. `getUserProfile` strictly searched by `id`, failing to find profiles when an email was passed.
- **Fix**: Modified `getUserProfile` to accept both formats by using Supabase `.or('id.eq.${userId},email.eq.${userId}')`.
- **Prevention Rule**: Always check whether a DB lookup function expects an Email or an ID, and when possible, design core lookup functions to safely handle either if the system has inconsistent ID representations.

## Translation and Bilingual

<!-- Add entries here using the template below:
### YYYY-MM-DD: [Short description]
- **Symptom**: What went wrong
- **Root Cause**: Why it happened
- **Fix**: What was changed
- **Prevention Rule**: How to avoid this in the future
-->

---

## Configuration and Environment

### 2026-05: Incompatible tool combinations silently broke web search ⚠️ RECURRING

- **Symptom**: Gemini 2.5 models said "I can't search the internet" despite WEB ON and `googleSearch` tool being injected. No visible error in UI.
- **Root Cause (Layer 1)**: `googleMaps` tool (Gemini 3 only) was always injected → API 400 error → fallback stripped ALL tools.
- **Root Cause (Layer 2)**: Even after removing `googleMaps`, combining `googleSearch` + `codeExecution` + `functionDeclarations` is **NOT supported on Gemini 2.5**. Gemini 3+ CAN mix them, but ONLY with `toolConfig: { includeServerSideToolInvocations: true }` ([docs](https://ai.google.dev/gemini-api/docs/tool-combination)). Without this flag, the API silently fails → fallback retries without any tools.
- **Fix**: Gemini 2.5: send `googleSearch` ALONE. Gemini 3+: send all tools combined WITH `includeServerSideToolInvocations: true` flag. Also fixed `functionCall.id` passthrough in `functionResponse` for proper tool context mapping.
- **Prevention Rule**: **Gemini 2.5 only supports ONE tool category at a time.** Gemini 3+ supports mixing but REQUIRES `includeServerSideToolInvocations: true` and proper `functionCall.id` → `functionResponse.id` mapping. Always check the [tool combination docs](https://ai.google.dev/gemini-api/docs/tool-combination) before adding tools.

### 2026-05: CachedContent cannot coexist with tools/tool_config ⚠️

- **Symptom**: All Gemini requests with GEM personas (>4096 chars system instruction) failed with 400 `INVALID_ARGUMENT`: "CachedContent can not be used with GenerateContent request setting system_instruction, tools or tool_config."
- **Root Cause**: Context cache was created with only `systemInstruction`, but the `generateContentStream` call also sent `tools` and `toolConfig` alongside `cachedContent`. Gemini API requires ALL of these to be inside the cache or none at all.
- **Fix (Strategy B: Composite Cache)**: Include `tools` + `toolConfig` in `ai.caches.create()` alongside `systemInstruction`. Cache key includes tools fingerprint so different tool combos (web search on/off) get separate caches. At request time, when `cachedContent` is active, `system_instruction`, `tools`, AND `toolConfig` are ALL omitted — they're in the cache.
- **Prevention Rule**: **NEVER send `tools`, `tool_config`, or `system_instruction` in a `generateContentStream` request that references `cachedContent`.** Always include them in the cache object via `ai.caches.create()`. Use a composite cache key that hashes the tool configuration to handle dynamic tool changes.
- **Additional (Strategy D: KB Cache)**: For project conversations, large KB documents can also be cached separately via `getOrCreateKBCache()` to reduce token costs on repeated queries.

---

## Gemini API

### 2026-06-20: Multi-turn image editing requires `thought_signature` passthrough

- **Symptom**: ANY edit in multi-turn conversation fails with 400: "Image part is missing a thought_signature in content position 2, part position 1."
- **Root Cause**: TWO issues. (1) EditPanel initialized history with a **fake model turn** containing the source image — but this image was not generated by Gemini in this session, so it had no `thought_signature`. Gemini 3.x requires `thought_signature` on ALL model image parts. (2) Even for real model responses, the code didn't extract or pass through `thought_signature`.
- **Fix**: (1) Removed fake model turn from init. First edit now sends a **single user turn** with `[source image + edit text]` — no model history needed. (2) For subsequent edits, extract `thought_signature` from response parts and pass it through the full round-trip: API → Client (EditTurn) → API next call → `buildGeminiContents()`.
- **Prevention Rule**: **NEVER fabricate model turns with images.** Gemini requires `thought_signature` on all model image parts — these tokens are generated server-side and cannot be forged. For the first edit of an external image, send it as a user turn. Also: always capture ALL fields from model response parts (especially `thought_signature`) when implementing manual multi-turn conversations.
