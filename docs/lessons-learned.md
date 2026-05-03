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

---
