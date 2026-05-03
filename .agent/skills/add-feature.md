---
description: Checklist for adding a new feature end-to-end. Read when building something new.
---

# Adding a New Feature

Read this skill when adding a completely new feature (not a bug fix or refactor).

## Step 1: Plan Structure

Create the required directories:

- `src/lib/features/<feature-name>/` — business logic, server functions
- `src/app/features/<feature-name>/` — UI components, hooks
- `src/app/api/<feature-name>/route.ts` — API route (if needed)

## Step 2: Types

- Add interfaces to `src/types/<feature>.d.ts` or an existing declaration file
- Follow naming: PascalCase for interfaces, camelCase for fields
- Prefer `interface` over `type` for object shapes

## Step 3: Business Logic

- Server-only files: use `.server.ts` suffix (prevents client bundling)
- Error handling: use `AppError` classes from `lib/utils/errors.ts`
- DB queries: use `getSupabaseAdmin()` from `lib/core/supabase.server.ts`
- No `any` — use `unknown` with type narrowing

## Step 4: API Route

Follow the pattern in `skills/api-patterns.md`:

```typescript
import { auth } from "@/lib/features/auth/auth";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();
    const userId = session.user.email.toLowerCase();

    const data = await fetchData(userId);
    return success({ data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Operation failed", 500);
  }
}
```

- Input validation: use `zod` schemas
- Response: always use `success()` / `errorFromAppError()`

## Step 5: UI Components

- Follow `rules/03-ui.md` (semantic colors, responsive, hover/focus states)
- Check `components/ui/` for existing Shadcn/UI primitives before creating new ones
- Icons: Lucide only
- Animations: Framer Motion (`< 300ms` for feedback, `< 500ms` for transitions)
- If component > 500 lines: extract logic into a custom hook in `hooks/` subdirectory

## Step 6: Bilingual

- Add ALL user-facing text to `lib/utils/config.ts` translations
- Add keys to both `translations.vi` and `translations.en` simultaneously
- Follow `skills/add-translation.md` for the full workflow
- Run `npm run type-check` to verify key parity

## Step 7: Update Docs

| Doc                       | When to update                                           |
| ------------------------- | -------------------------------------------------------- |
| `docs/features.md`        | Always — add feature section with files list             |
| `docs/contracts.md`       | If new API endpoints or data models                      |
| `docs/database-schema.md` | If new tables (see `skills/database-migration.md`)       |
| `docs/architecture.md`    | If new `lib/core/` clients or major structural additions |
| `docs/CHANGELOG.md`       | Always — add entry at top                                |

## Step 8: Verify

```bash
npm run type-check && npm run lint && npm test
```

- Add or update tests for new business logic
- Manually test the feature in the browser
