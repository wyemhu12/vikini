---
trigger: always_on
---

# Quality Gates (Vikini)

## 1. Quality Checklist (Must Pass)

Before finishing ANY task, you must verify:

- [ ] **Scope**: Only touched files declared in the plan (or necessary dependencies)?
- [ ] **Type Safety**: `npm run type-check` passed?
- [ ] **Linting**: `npm run lint` passed?
- [ ] **Tests**:
  - If logic changed: Added/Updated unit tests?
  - `npm test` passed?
- [ ] **Visuals**: Code is clean, no "console.log" spam.

## 2. Minimal Diffs Policy

- **Atomic Changes**: Change only what is necessary.
- **No Formatting Noise**: Do NOT reformat code that you didn't modify logic for (unless it's a dedicated cleanup task).
- **Respect Existing Patterns**: Follow the coding style of the file you are editing.

## 3. Output Format

Start your final response with a clear summary:
**"Summarize what was done in 1 sentence."**

Then list changes:

- `Modified: ...`
- `Created: ...`

Finally, confirm standard checks:
**Verification:**

- [x] Type check
- [x] Lint
