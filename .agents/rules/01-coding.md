---
trigger: always_on
description: TypeScript enforcement, project structure, and naming conventions.
---

# Coding Standards

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

<important>
BANNED: Silent `catch` blocks that only call `console.error()` or `logger.error()`.
REQUIRED: Every user-initiated action (delete, export, save, upload) MUST show
`toast.error()` on failure. Log the error AND notify the user.
</important>

```typescript
// REQUIRED pattern for UI error feedback
catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("[Component] action failed:", message);
  toast.error(t("actionFailed") || message); // User sees feedback
}
```

## Testing Requirements

<important>
When creating or modifying business logic in `lib/features/` or `lib/core/`, you MUST create or update a co-located test file (e.g., `feature.test.ts` next to `feature.ts`).
Tests are NOT optional for server-side logic, utilities, and API helpers.
</important>

- **Co-locate tests**: Place `*.test.ts` next to the source file, not in a separate `tests/` tree.
- **Minimum coverage**: Every exported function in `lib/features/` and `lib/core/` must have at least one test covering the happy path and one error case.
- **API route tests**: When creating a new API route, add integration tests verifying auth checks, input validation, and error responses.
- **Skip UI component tests** unless the component contains significant logic (state machines, complex calculations). Pure render components don't need tests.

## Project Structure

> All paths below are relative to `src/`.

- **Feature logic**: `lib/features/<feature-name>/`
- **Feature UI**: `app/features/<feature-name>/`
- **Shared UI**: `components/ui/` -- generic primitives only, no business logic
- **State stores**: `lib/store/` or `lib/features/<feature>/store.ts`
- **Types**: `types/`
- Features must not import heavily from other features. Use `lib/core/` for shared logic.

## Naming

- **Components**: PascalCase.tsx
- **Hooks**: useCamelCase.ts
- **Functions/Vars**: camelCase
- **Constants**: UPPER_SNAKE_CASE

## File Size & Modularity Guidelines

> Optimized for AI agent comprehension (Claude Opus 4.6, Gemini 3.1 Pro).
> Industry consensus (2026): **150–500 lines/file** is the sweet spot.
> Primary metric: **Single Responsibility Principle**. Line count is a heuristic, not a hard rule.

### Size Targets by File Type

| File Type                   | Target (lines) | Hard Max | When to split                                            |
| --------------------------- | -------------- | -------- | -------------------------------------------------------- |
| **UI Component**            | 200–400        | 500      | > 3 concerns, or mixes data fetching + state + render    |
| **Custom Hook**             | 150–250        | 350      | > 1 state concern, or > 3-4 interacting `useState` calls |
| **API Route**               | 100–200        | 300      | Not following Validate → Execute → Respond pattern       |
| **Business Logic** (`lib/`) | 200–300        | 400      | > 1 domain responsibility                                |
| **Individual Function**     | < 50           | 100      | Cannot describe purpose in a single sentence             |

### Why These Limits Matter for AI Agents

1. **Single-pass comprehension**: Agent reads the entire file in one view → understands state flow, side effects, imports completely.
2. **Edit precision**: Smaller files mean fewer duplicate patterns → `TargetContent` matching in edit tools is more accurate.
3. **Context efficiency**: ~200-400 lines ≈ 2,000-5,000 tokens — leaves room for instructions, conversation, and tool outputs.
4. **Parallel safety**: Smaller files reduce merge conflicts when multiple agents or developers work concurrently.

### Splitting Strategies

- **Components > 400 lines**: Extract sub-components (`Header`, `Content`, `Footer`) and/or a controller hook (`useFeatureController.ts`) in a `hooks/` subdirectory.
- **Hooks > 250 lines**: Split by lifecycle phase (`useStreamLifecycle.ts`) or concern (`useStreamEventHandlers.ts`).
- **API routes > 200 lines**: Extract validation (`requestValidation.ts`), business logic into `lib/features/`, keep route as thin orchestrator.
- **Business logic > 300 lines**: Split by sub-domain or operation type (e.g., `conversationCRUD.ts`, `conversationSearch.ts`).
- **Functions > 100 lines**: This is a code smell regardless of file size. Refactor into smaller, composable functions.

### Heuristics (Quick Checks)

- **Scroll test**: If you scroll > 2-3 screens to find a specific logic block → too large.
- **Import test**: If a file imports > 15 modules → likely doing too much.
- **Describe test**: If you cannot describe the file's purpose in one sentence → split it.

### Exemptions

- **Translation files** (`vi.ts`, `en.ts`): Data files, no logic — exempt from size limits.
- **Test files** (`.test.ts`): Coverage is more important than file size — exempt.
- **Type declaration files** (`types/`): Grouping related types together is acceptable.
- **Configuration files** (`modelRegistry.ts`, `constants.ts`): Data-driven files may exceed limits if well-organized.

### Hardcoded Literals

- Avoid hardcoded literals for IDs, URLs, or model names. Centralize in `lib/utils/constants.ts`.

## Infrastructure vs UI Separation

- Infrastructure hooks (e.g., `useSpeechRecognition`, `useWebSocket`) must NOT import i18n or UI stores.
- They should return error codes or throw typed errors. The calling UI component is responsible for translating errors and showing feedback (toast, banner, etc.).
