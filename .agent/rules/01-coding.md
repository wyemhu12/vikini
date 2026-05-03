---
trigger: always_on
description: TypeScript enforcement, project structure, and naming conventions.
---

# Coding Standards

## Project Structure

> All paths below are relative to `src/`.

- **Feature logic**: `lib/features/<feature-name>/`
- **Feature UI**: `app/features/<feature-name>/`
- **Shared UI**: `components/ui/` -- generic primitives only, no business logic
- **State stores**: `lib/store/` or `lib/features/<feature>/store.ts`
- **Types**: `types/`
- Features must not import heavily from other features. Use `lib/core/` for shared logic.

## TypeScript (Strict)

- Files must be `.ts` or `.tsx`. No `.js` files.
- Prefer `interface` over `type` for object shapes.
- Use `unknown` for uncertain types. Validate before use.

<important>
BANNED: Using `any` type anywhere -- catch blocks, variables, function params, type assertions.
REQUIRED: Use `unknown` with type narrowing.
</important>

```typescript
// REQUIRED pattern for error handling
catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
}
```

## Error Handling

- Never expose raw error messages in production.
- All API routes must use standardized error classes from `lib/utils/errors.ts`.
- Read `skills/api-patterns.md` for full patterns and examples.

## Naming

- **Components**: PascalCase.tsx
- **Hooks**: useCamelCase.ts
- **Functions/Vars**: camelCase
- **Constants**: UPPER_SNAKE_CASE

## Component Size

- If a component exceeds 500 lines or manages complex state plus API calls, extract logic into a custom hook (e.g., `useFeatureController.ts`) in a `hooks/` subdirectory.
- Avoid hardcoded literals for IDs, URLs, or model names. Centralize in `lib/utils/constants.ts`.
