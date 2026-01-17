---
trigger: always_on
---

# Coding Standards (Vikini)

## 1. Project Structure & Organization

### Feature Slices

- **Logic**: Place feature-specific logic in `lib/features/<feature-name>`.
- **UI**: Place feature-specific UI in `app/features/<feature-name>` (or `components/features/<feature-name>` if strictly enforced).
- **Isolation**: Features should not import heavily from other features. Use `lib/core` for shared logic.

### Shared UI

- **Location**: `components/ui/`
- **Rule**: Only generic, reusable primitives go here (Buttons, Cards, Inputs).
- **No Business Logic**: Shared components must be dumb (pure presentation).

### State Management

- **Zustand**: Use for global client state.
- **Location**: `lib/store/` or inside `lib/features/<feature>/store.ts`.

## 2. TypeScript Enforcement

### Strict Type Safety (NON-NEGOTIABLE)

- **Strict TypeScript**: `.ts` or `.tsx` only. No `.js`.
- **Interfaces**: Prefer `interface` over `type` for object definitions.

> [!CAUTION]
> **NEVER use `any` type** - This is a CRITICAL security and quality violation.

#### ❌ BANNED Patterns

```typescript
// BANNED: any type usage
catch (error: any) { ... }
const updates: any = {};
const data = response as any;
function process(input: any) { ... }
```

#### ✅ REQUIRED Patterns

```typescript
// REQUIRED: Use unknown for uncertain types
catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
}

// REQUIRED: Define explicit interfaces
interface ProfileUpdates {
  rank?: UserRank;
  is_blocked?: boolean;
}
const updates: ProfileUpdates = {};

// REQUIRED: Type assertions with validation
const body = (await req.json()) as { userId?: string; rank?: unknown };
if (typeof body.userId !== "string") {
  return error("Invalid userId", 400);
}
```

### Error Handling Patterns

- **Production Safety**: Never expose raw error messages in production
- **Pattern**: Use centralized safe error extractors

```typescript
function getSafeErrorMessage(error: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return "Internal server error";
  }
  return error instanceof Error ? error.message : "Internal error";
}
```

### Input Validation (Security)

- **Whitelist Validation**: Always validate against allowed values for sensitive fields
- **Pattern**: Define const arrays with type inference

```typescript
// Define whitelist with type inference
const VALID_RANKS = ["basic", "pro", "admin"] as const;
type UserRank = (typeof VALID_RANKS)[number];

// Type guard for validation
function isValidRank(rank: unknown): rank is UserRank {
  return typeof rank === "string" && VALID_RANKS.includes(rank as UserRank);
}

// Usage - ALWAYS validate before using
if (!isValidRank(input.rank)) {
  return error("Invalid rank", 400);
}
```

## 3. Naming Conventions

- **Components**: `PascalCase.tsx`
- **Hooks**: `useCamelCase.ts`
- **Functions/Vars**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Component Refactoring

- **Hook Extraction**: If a component exceeds ~500 lines or manages complex state + API calls (e.g., streaming, image gen), extract the logic into a custom hook (e.g., `useFeatureController.ts`) in a `hooks/` subdirectory.
- **Magic Strings**: Avoid hardcoded literals for IDs, URLs, or model names. Centralize them in `lib/utils/constants.ts`.

## 4. API Error Handling Standards (MANDATORY)

> [!IMPORTANT]
> All API routes MUST use the standardized error handling pattern. This ensures consistent response format and production-safe error handling.

### Required Response Format

```typescript
// SUCCESS Response
{ "success": true, "data": { ... } }

// ERROR Response
{ "success": false, "error": { "message": "...", "code": "ERROR_CODE" } }
```

### Core Error Classes (`lib/utils/errors.ts`)

| Class               | Status | Code                  | Usage                 |
| ------------------- | ------ | --------------------- | --------------------- |
| `ValidationError`   | 400    | `VALIDATION_ERROR`    | Missing/invalid input |
| `UnauthorizedError` | 401    | `UNAUTHORIZED`        | Not logged in         |
| `ForbiddenError`    | 403    | `FORBIDDEN`           | No permission         |
| `NotFoundError`     | 404    | `NOT_FOUND`           | Resource not found    |
| `RateLimitError`    | 429    | `RATE_LIMIT_EXCEEDED` | Too many requests     |
| `AppError`          | 500    | `INTERNAL_ERROR`      | Generic server error  |

### Required Imports

```typescript
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  AppError,
} from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
```

### ❌ BANNED Pattern

```typescript
// NEVER DO THIS - Inconsistent format, leaks error details
return NextResponse.json({ error: err.message }, { status: 500 });
```

### ✅ REQUIRED Pattern

```typescript
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) throw new UnauthorizedError();

    const data = await fetchData();
    if (!data) throw new NotFoundError("Resource");

    return success({ data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Operation failed", 500);
  }
}
```

### Response Helpers (`lib/utils/apiResponse.ts`)

| Helper                            | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| `success(data)`                   | Returns `{ success: true, data }` with 200             |
| `error(msg, status)`              | Returns `{ success: false, error: { message, code } }` |
| `errorFromAppError(err)`          | Converts AppError to proper response                   |
| `rateLimitError(msg, retryAfter)` | Returns 429 with Retry-After header                    |
