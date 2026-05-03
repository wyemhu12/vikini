---
description: API error handling patterns, response helpers, and examples for Vikini API routes.
---

# API Error Handling Patterns

Read this skill when writing or modifying API routes in `app/api/`.

## Required Response Format

```typescript
// SUCCESS
{ "success": true, "data": { ... } }

// ERROR
{ "success": false, "error": { "message": "...", "code": "ERROR_CODE" } }
```

## Error Classes (from `lib/utils/errors.ts`)

| Class             | Status | Code                | Usage                    |
| ----------------- | ------ | ------------------- | ------------------------ |
| ValidationError   | 400    | VALIDATION_ERROR    | Missing or invalid input |
| UnauthorizedError | 401    | UNAUTHORIZED        | Not logged in            |
| ForbiddenError    | 403    | FORBIDDEN           | No permission            |
| NotFoundError     | 404    | NOT_FOUND           | Resource not found       |
| RateLimitError    | 429    | RATE_LIMIT_EXCEEDED | Too many requests        |
| AppError          | 500    | INTERNAL_ERROR      | Generic server error     |

## Required Imports

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

## REQUIRED Pattern

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

## BANNED Pattern

```typescript
// NEVER: Inconsistent format, leaks error details
return NextResponse.json({ error: err.message }, { status: 500 });
```

## Response Helpers (from `lib/utils/apiResponse.ts`)

| Helper                            | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| `success(data)`                   | Returns `{ success: true, data }` with 200             |
| `error(msg, status)`              | Returns `{ success: false, error: { message, code } }` |
| `errorFromAppError(err)`          | Converts AppError to proper response                   |
| `rateLimitError(msg, retryAfter)` | Returns 429 with Retry-After header                    |

## Input Validation Pattern

```typescript
const VALID_RANKS = ["basic", "pro", "admin"] as const;
type UserRank = (typeof VALID_RANKS)[number];

function isValidRank(rank: unknown): rank is UserRank {
  return typeof rank === "string" && VALID_RANKS.includes(rank as UserRank);
}

// Always validate before using
if (!isValidRank(input.rank)) {
  return error("Invalid rank", 400);
}
```

## Production Safety

```typescript
function getSafeErrorMessage(error: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return "Internal server error";
  }
  return error instanceof Error ? error.message : "Internal error";
}
```
