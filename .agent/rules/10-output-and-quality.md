---
trigger: always_on
---

# Quality Gates & Output Standards

## Quality Gates (Apply Before Finalizing Work)

1. **Scope Check**
   - Only touch files within the declared scope.
   - If you had to touch a new file, justify why it was necessary.

2. **Type Safety**
   - If any TS/logic changed: run `npm run type-check` (or the project’s equivalent).

3. **Lint**
   - If TS/logic changed OR before merge-quality output: run `npm run lint`.

4. **Tests**
   - If you introduced new behavior or fixed a regression:
     - add/adjust tests under `tests/` (unit/integration as appropriate)
     - run `npm test` (or the project’s equivalent).
   - If the change is purely UI styling with no logic changes, tests are optional but verification steps are still required.

5. **Risk-Based Verification**
   - **Low risk (UI copy/style only)**: manual verification steps required.
   - **Medium risk (UI behavior/state, caching, minor API logic)**: type-check + relevant tests if available + manual.
   - **High risk (auth, rate limit, DB writes, streaming, uploads)**: type-check + tests (or explain why not feasible) + explicit manual checklist.

> Package manager: this file uses **npm**. If the repo uses pnpm/yarn, replace commands accordingly.

## Output Format (Final Response)

Every completion response must follow this format:

### Summary

1–2 sentences describing what changed and why.

### Changes

- Modified: `path/to/file`
- Created: `path/to/file`
- Deleted: `path/to/file` (only if explicitly required)

### Verification

- **Automated**:
  - `npm run type-check` (if TS/logic changed)
  - `npm run lint` (if TS/logic changed or before merge-quality output)
  - `npm test` (if behavior changed and tests exist/added)
- **Manual**:
  - Step-by-step checklist a user can follow in the UI/API to confirm behavior.

### Risks/Notes

- List any edge cases, follow-ups, or potential side effects.
