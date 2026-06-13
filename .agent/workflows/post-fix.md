---
description: After fixing a bug, record the lesson and run verification.
---

# /post-fix Workflow

Run this after every bug fix to build institutional memory and verify quality.

## Steps

1. **Run verification** -- Confirm the fix works:

   ```bash
   npm run verify
   ```

2. **Record the lesson** -- Add a new entry to `docs/lessons-learned.md` under the appropriate category:

   ```markdown
   ### YYYY-MM-DD: [Short description]

   - **Symptom**: What went wrong
   - **Root Cause**: Why it happened
   - **Fix**: What was changed
   - **Prevention Rule**: How to avoid this in the future
   ```

3. **Check for pattern promotion** -- If the same category of mistake appears 3 or more times:
   - Extract a formal rule into the appropriate `.agent/rules/` file
   - Type safety issues go to `01-coding.md`
   - UI/styling issues go to `03-ui.md`
   - API/streaming issues go to `00-core.md`
   - Translation issues go to `04-bilingual.md`

4. **Update CHANGELOG** -- Add the fix to `docs/CHANGELOG.md`

5. **Confirm** -- End with:
   > Lesson recorded in `docs/lessons-learned.md`: [one-line description]
