---
description: After fixing a bug, record the lesson learned to prevent recurrence
---

# /post-fix Workflow

Run this after every bug fix to build institutional memory.

## Steps

1. **Identify the lesson** — Determine:
   - What was the symptom?
   - What was the root cause?
   - What rule would have prevented this?

2. **Update lessons file** — Add a new entry at the TOP of `.agent/rules/99-lessons-learned.md` (below the header) using this format:

   ```markdown
   ## YYYY-MM-DD: [Short description]

   - **Symptom**: [What went wrong]
   - **Root Cause**: [Why it happened]
   - **Fix**: [What was changed]
   - **Rule**: [Permanent rule to prevent recurrence]
   ```

3. **Check for rule promotion** — If the same category of mistake appears **3+ times**, extract a formal rule into the appropriate `.agent/rules/` file:
   - Type safety issues → `11-coding-standards.md`
   - UI/styling issues → `20-ui-standards.md`
   - API/streaming issues → `00-core.md` (or create a new domain-specific file)
   - Translation issues → `30-bilingual.md`

4. **Confirm** — End with a short summary:
   > ✅ Lesson recorded in `99-lessons-learned.md`: [one-line description]
