---
trigger: always_on
description: Quality checklist and minimal diffs policy for all tasks.
---

# Quality Gates

## 1. Quality Checklist (Must Pass)

Before finishing ANY task, you must verify:

- **Scope**: Only touched files declared in the plan (or necessary dependencies)?
- **Type Safety**:
  pm run type-check passed?
- **Linting**:
  pm run lint passed?
- **Tests**:
  - If logic changed: Added/Updated unit tests?
  - pm test passed?
- **Visuals**: Code is clean, no "console.log" spam.

## 2. Minimal Diffs Policy

- **Atomic Changes**: Change only what is necessary.
- **No Formatting Noise**: Do NOT reformat code that you didn't modify logic for (unless it's a dedicated cleanup task).
- **Respect Existing Patterns**: Follow the coding style of the file you are editing.

## 3. Output Format

Start your final response with a clear summary:
**"Summarize what was done in 1 sentence."**

Then list changes:

- Modified: ...
- Created: ...

Finally, confirm standard checks:
**Verification:**

- Type check
- Lint
