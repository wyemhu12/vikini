---
name: vikini-debug
description: "MANDATORY when debugging complex or recurring bugs (/debug) or executing the post-fix verification and lesson-recording protocol (/post-fix)."
---

# Vikini Systematic Debugging & Post-Fix Protocol (`/debug` & `/post-fix`)

Use this skill for complex or recurring bugs (`/debug`) and after every bug fix (`/post-fix`). Core rule: **no fixes without a confirmed root cause**.

---

## Part 1: Systematic Debugging Protocol (`/debug`)

### Phase 1: Preparation

1. Read `docs/lessons-learned.md` — check if this bug pattern has been seen before.
2. Read relevant domain docs (`docs/contracts.md`, `docs/database-schema.md`, `docs/security.md`).

### Phase 2: Root Cause Investigation

> **Do not propose code changes yet. Gather evidence first.**

1. Analyze stack traces and logs. Identify file paths and line numbers.
2. Attempt to reproduce. Ask: "Can we reproduce this consistently?"
3. If multi-component: add diagnostic logging at component boundaries to trace data flow.

**CHECKPOINT**: Root cause identified?

- **YES** → proceed to Phase 3
- **NO** → return to Phase 2 (max 2 retries, then escalate to Circuit Breaker)

### Phase 3: Pattern Analysis

1. Find a working example of this pattern elsewhere in the codebase.
2. List the differences between the working example and the broken code.

### Phase 4: Hypothesis

1. Formulate: "I think X is broken because Y."
2. Perform a minimal test (co-located unit test or targeted reproduction) to verify.

**CHECKPOINT**: Hypothesis verified by minimal test?

- **YES** → proceed to Phase 5
- **NO** → return to Phase 3 (max 2 retries, then escalate to Circuit Breaker)

### Phase 5: Implementation

> **Only proceed if Phase 4 passed.**

1. Implement the single minimal fix and add/update a co-located unit test.
2. Run `npm run verify`.
3. Execute **Part 2: Post-Fix Protocol (`/post-fix`)** below to record the lesson.

### Circuit Breaker (3-Strike Rule)

> If 3 fix attempts fail: **STOP**. Output:
> "ARCHITECTURAL ALERT: 3 fixes failed. We are treating symptoms, not the root cause. Recommendation: Discuss refactoring."

---

## Part 2: Post-Fix Protocol (`/post-fix`)

Run this protocol after **every** bug fix to build institutional memory and verify quality:

1. **Run verification** — Confirm the fix works:

   ```bash
   npm run verify
   ```

2. **Record the lesson** — Add a new entry to `docs/lessons-learned.md` under the appropriate category:

   ```markdown
   ### YYYY-MM-DD: [Short description]

   - **Symptom**: What went wrong
   - **Root Cause**: Why it happened
   - **Fix**: What was changed
   - **Prevention Rule**: How to avoid this in the future
   ```

3. **Check for pattern promotion** — If the same category of mistake appears 3 or more times:
   - Extract a formal rule into the appropriate `.agents/rules/` file:
     - Type safety issues go to `.agents/rules/01-coding.md`
     - UI/styling issues go to `.agents/rules/03-ui.md`
     - API/streaming issues go to `.agents/rules/00-core.md`
     - Translation issues go to `.agents/rules/04-bilingual.md`

4. **Update CHANGELOG** — Add the fix to `docs/CHANGELOG.md`.

5. **Confirm** — End with:
   > Lesson recorded in `docs/lessons-learned.md`: [one-line description]
