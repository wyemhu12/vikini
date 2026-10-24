---
name: vikini-audit
description: "MANDATORY when performing a focused code quality, architecture boundary, UI token, or bilingual compliance audit (/audit) on a file or feature area."
---

# Vikini Code Quality & Architecture Audit (`/audit`)

Use this skill to perform a focused code quality, architecture boundary, UI token, or bilingual compliance audit on a specific file, feature area, or pull request scope.

## Audit Steps

1. **Identify scope** — Determine which file(s) or feature area (`src/lib/features/*`, `src/app/features/*`, `src/app/api/*`, `src/components/ui/*`) to audit.

2. **Check coding standards** (from `.agents/rules/01-coding.md` and `.agents/rules/00-core.md`):
   - Zero `any` types (`unknown` with type narrowing required)
   - Proper error handling (`toast.error()` on user-initiated actions + `logger.error()`)
   - Co-located unit tests (`*.test.ts`) for logic in `src/lib/core/` and `src/lib/features/`
   - Correct naming conventions and file size limits (components < 500 lines, business logic < 400 lines)

3. **Check API patterns** (if API route in `src/app/api/**`):
   - Uses standardized error classes (`AppError`, `UnauthorizedError`, `ValidationError`, etc.) from `src/lib/utils/errors.ts`
   - Follows Validate → Execute → Respond pattern from `.agents/skills/api-patterns/SKILL.md`
   - Uses `await auth()` + `UnauthorizedError` (or `requireUser()`) consistently
   - No raw unformatted error leaks in production

4. **Check UI standards** (if UI component in `src/app/**` or `src/components/**`, from `.agents/rules/03-ui.md`):
   - Semantic theme tokens (`bg-background`, `text-foreground`, etc.), no raw hardcoded palette classes
   - Responsive design (mobile-first) and accessible focus/hover states
   - No browser `alert()` or `confirm()`
   - Zero business logic inside `src/components/ui/`

5. **Check bilingual compliance** (if user-facing, from `.agents/rules/04-bilingual.md` and `.agents/skills/add-translation/SKILL.md`):
   - All user-visible text uses `t("key")`
   - Keys exist in both `src/lib/utils/translations/vi.ts` and `src/lib/utils/translations/en.ts`

6. **Check for stale patterns & dead code**:
   - Deprecated API usage
   - Unused imports or dead exports (see `.agents/skills/vikini-simplify/SKILL.md`)
   - `console.log` left in code (only `console.warn` / `console.error` or `logger.*` allowed)

7. **Run verification**:

   ```bash
   npm run verify
   ```

8. **Report** — Summarize findings with severity (`Critical`, `Warning`, `Info`) and exact file/line references.

## Exit Criteria (ALL must pass for audit to PASS)

- [ ] Zero `any` types in audited scope (verified by `npm run lint`)
- [ ] All error handlers show `toast.error()` on user-initiated actions
- [ ] All UI text uses `t("key")` — no hardcoded strings
- [ ] No `console.log` statements
- [ ] All components < 500 lines
- [ ] `npm run verify` passes with zero errors
