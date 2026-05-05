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

### 2026-04: `as any` in streaming and knowledge modules

- **Symptom**: Type-check failures when refactoring streaming response handling
- **Root Cause**: Convenience `as any` assertions were used during rapid prototyping in `streaming.ts` and `knowledge.server.ts`
- **Fix**: Replaced with proper `unknown` + type narrowing patterns
- **Prevention Rule**: Enforced in `rules/01-coding.md` — `any` is banned everywhere

---

## UI and Styling

### 2026-04: Vietnamese diacritics input bug in search

- **Symptom**: Search input dropped characters during IME composition (Vietnamese with diacritics)
- **Root Cause**: `onChange` handler fired during IME composition, interrupting the input method
- **Fix**: Added `onCompositionStart` / `onCompositionEnd` guards to defer state updates
- **Prevention Rule**: Always use composition event guards for text inputs that support CJK/Vietnamese

---

## API and Streaming

### 2026-03: Auth proxy documentation mismatch

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

---

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

### 2026-05: `googleMaps` tool silently broke web search for ALL models ⚠️

- **Symptom**: Gemini models said "I can't search the internet" despite WEB ON, `WEB_SEARCH_ENABLED=true`, and `googleSearch` tool being injected. No visible error in UI.
- **Root Cause**: `setupToolsAndSafety()` always injected `{ googleMaps: {} }` alongside `{ googleSearch: {} }`. But `googleMaps` only supports Gemini 3 family. When used with Gemini 2.5 or 3.1 Pro, the API call **failed** → `runStreamWithFallback` retried **without ANY tools** (including `googleSearch`) → model responded successfully but without search capability. The meta event `"webSearchFallback"` was sent but not prominently displayed in UI.
- **Fix**: Removed `googleMaps` from the default tools list. Only add model-specific tools after checking model compatibility.
- **Prevention Rule**: **NEVER add model-family-specific tools unconditionally.** Always gate tools behind model-family checks (e.g., `if (model.startsWith("gemini-3"))`) before adding them to the tools array. The fallback retry mechanism can silently mask tool incompatibility errors.

---
