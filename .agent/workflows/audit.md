---
description: Quick code audit for a specific file or feature area.
---

# /audit Workflow

Use this to perform a focused code quality audit on a file or feature.

## Steps

1. **Identify scope** -- Which file(s) or feature area to audit?

2. **Check coding standards** (from `rules/01-coding.md`):
   - No `any` types
   - Proper error handling with `unknown`
   - Correct naming conventions
   - Component size under 500 lines

3. **Check API patterns** (if API route):
   - Uses standardized error classes
   - Follows response format from `skills/api-patterns.md`
   - No raw `NextResponse.json({ error: ... })`

4. **Check UI standards** (if UI component):
   - Semantic colors, no raw color classes
   - Responsive design (mobile first)
   - Proper hover/focus states
   - No `alert()` or `confirm()`

5. **Check bilingual** (if user-facing):
   - All text uses translation system
   - Keys exist in both `vi` and `en`

6. **Check for stale patterns**:
   - Deprecated API usage
   - Unused imports
   - Console.log left in code

7. **Run verification**:

   ```bash
   npm run verify
   ```

8. **Report** -- Summarize findings with severity (Critical, Warning, Info).

## Exit Criteria (ALL must pass for audit to PASS)

- [ ] Zero `any` types in audited scope (verified by `npm run lint`)
- [ ] All error handlers show `toast.error()` on user-initiated actions
- [ ] All UI text uses `t("key")` — no hardcoded strings
- [ ] No `console.log` statements (only `logger.*`)
- [ ] All components < 500 lines
- [ ] `npm run verify` passes with zero errors
