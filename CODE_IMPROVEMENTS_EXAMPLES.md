# Code Improvements - Usage Examples

Các ví dụ cụ thể về cách sử dụng các utilities mới để cải thiện code.

## 1. Sử dụng Logger

### Before:
```javascript
console.log("Loading conversations for user:", userId);
console.error("Failed to load conversation:", error);
console.warn("Rate limit approaching");
```

### After:
```javascript
import { logger } from "@/lib/utils/logger";

// Info log (shown in all environments)
logger.info("Loading conversations for user:", userId);

// Error log (always shown)
logger.error("Failed to load conversation:", error);

// Warning log
logger.warn("Rate limit approaching");

// Debug log (only in development)
logger.debug("Detailed debug info:", { userId, conversationId });

// With context (useful for API routes)
const routeLogger = logger.withContext("POST /api/conversations");
routeLogger.info("Processing request");
routeLogger.error("Request failed:", error);
```

**File cần update**: Tất cả files có `console.log/error/warn` (97 instances)

---

## 2. Sử dụng Constants

### Before:
```javascript
if (role === "user") { ... }
if (role === "assistant") { ... }
const limit = 50;
if (convo?.title === "New Chat") { ... }
```

### After:
```javascript
import { MESSAGE_ROLES, DEFAULT_LIMITS, CONVERSATION_DEFAULTS } from "@/lib/utils/constants";

if (role === MESSAGE_ROLES.USER) { ... }
if (role === MESSAGE_ROLES.ASSISTANT) { ... }
const limit = DEFAULT_LIMITS.RECENT_MESSAGES;
if (convo?.title === CONVERSATION_DEFAULTS.TITLE) { ... }
```

**Files cần update**:
- `lib/features/chat/messages.js`
- `lib/features/chat/conversations.js`
- `app/api/chat-stream/chatStreamCore.js`
- Và nhiều files khác

---

## 3. Sử dụng Error Classes

### Before:
```javascript
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
if (!conversation) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
throw new Error("Database error");
```

### After:
```javascript
import { UnauthorizedError, NotFoundError, DatabaseError } from "@/lib/utils/errors";

if (!userId) {
  throw new UnauthorizedError();
}
if (!conversation) {
  throw new NotFoundError("Conversation");
}
throw new DatabaseError("Failed to save conversation", originalError);

// Trong route handler:
try {
  // ... code
} catch (error) {
  if (error instanceof AppError) {
    return errorFromAppError(error);
  }
  logger.error("Unexpected error:", error);
  return error("Internal server error");
}
```

**Files cần update**:
- `app/api/conversations/route.js`
- `app/api/gems/route.js`
- `app/api/chat-stream/route.js`
- Và các API routes khác

---

## 4. Sử dụng API Response Helpers

### Before:
```javascript
return NextResponse.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
return NextResponse.json({ error: "Not found" }, { status: 404 });
```

### After:
```javascript
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";

// Success response
return success({ conversations });
return success({ conversation }, HTTP_STATUS.CREATED); // 201

// Error response
return error("Not found", HTTP_STATUS.NOT_FOUND, "NOT_FOUND");

// From AppError
try {
  // ... code
} catch (err) {
  if (err instanceof AppError) {
    return errorFromAppError(err);
  }
  return error("Internal error");
}
```

**Files cần update**: Tất cả API route files

---

## 5. Schema Format Detection Cache

### Before (lib/features/chat/conversations.js):
```javascript
async function listConversationsSafe(userId) {
  // Try user_id
  const q1 = await supabase.from("conversations").eq("user_id", userId)...
  if (!q1.error) return ...;
  
  // Fallback: userId
  const q2 = await supabase.from("conversations").eq("userId", userId)...
  if (q2.error) throw ...;
  return ...;
}
```

### After:
```javascript
// lib/features/chat/schemaCache.js
let detectedFormat = null; // 'snake_case' | 'camelCase'

export async function detectSchemaFormat(supabase) {
  if (detectedFormat) return detectedFormat;
  
  // Quick test query
  const test = await supabase
    .from("conversations")
    .select("id")
    .limit(1);
  
  // Check if query worked (indicates snake_case)
  if (!test.error) {
    detectedFormat = 'snake_case';
    return detectedFormat;
  }
  
  // Assume camelCase if snake_case fails
  detectedFormat = 'camelCase';
  return detectedFormat;
}

export function getUserColumnName() {
  return detectedFormat === 'camelCase' ? 'userId' : 'user_id';
}

// Usage in conversations.js:
import { detectSchemaFormat, getUserColumnName } from "./schemaCache";

async function listConversationsSafe(userId) {
  const supabase = getSupabaseAdmin();
  await detectSchemaFormat(supabase);
  const userCol = getUserColumnName();
  
  const q = await supabase
    .from("conversations")
    .select("*,gems(name,icon,color)")
    .eq(userCol, userId)
    .order("updated_at", { ascending: false });
    
  if (q.error) throw new Error(`listConversations failed: ${q.error.message}`);
  return (q.data || []).map(mapConversationRow);
}
```

**Impact**: Giảm 50% queries trong `listConversationsSafe`, `getGemsForUser`, etc.

---

## 6. Input Validation với Zod

### Before:
```javascript
const { conversationId, content } = body || {};
if (typeof content !== "string" || !content.trim()) {
  return jsonError("Missing content", 400);
}
```

### After:
```javascript
import { z } from 'zod';

const chatStreamSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1).max(100000),
  regenerate: z.boolean().optional(),
  truncateMessageId: z.string().uuid().optional(),
  skipSaveUserMessage: z.boolean().optional(),
});

// In route handler:
try {
  const body = await req.json();
  const validated = chatStreamSchema.parse(body);
  // Use validated.content, validated.conversationId, etc.
} catch (error) {
  if (error instanceof z.ZodError) {
    return error(
      `Validation failed: ${error.errors.map(e => e.message).join(', ')}`,
      HTTP_STATUS.BAD_REQUEST,
      'VALIDATION_ERROR'
    );
  }
  throw error;
}
```

**Files cần update**: Tất cả API route handlers

---

## 7. Refactor Long Functions

### Example: chatStreamCore.js

**Before**: Function ~300 lines

**After**: Break into smaller functions:

```javascript
// Load or create conversation
async function loadOrCreateConversation(userId, conversationIdRaw) {
  if (!conversationIdRaw) {
    return await saveConversation(userId, { title: CONVERSATION_DEFAULTS.TITLE });
  }
  
  try {
    return await getConversation(conversationIdRaw);
  } catch {
    return await saveConversation(userId, { title: CONVERSATION_DEFAULTS.TITLE });
  }
}

// Build message context
async function buildMessageContext(conversationId, sysPrompt, modelLimitTokens) {
  // ... context building logic
}

// Main handler (now much shorter)
export async function handleChatStreamCore({ req, userId }) {
  const body = await validateRequestBody(req);
  const conversation = await loadOrCreateConversation(userId, body.conversationId);
  const context = await buildMessageContext(conversation.id, sysPrompt, modelLimitTokens);
  // ... rest of logic
}
```

---

## Implementation Priority

### Week 1:
1. ✅ Create utilities (constants.js, logger.js, errors.js, apiResponse.js)
2. Replace console.log with logger in critical paths
3. Extract constants in frequently used files

### Week 2:
4. Implement schema format cache
5. Replace error handling với error classes
6. Replace API responses với helpers

### Week 3-4:
7. Add Zod validation
8. Refactor long functions
9. Add JSDoc comments

---

## Migration Strategy

### Step-by-step approach:

1. **Add utilities first** (✅ Done)
2. **Update one file at a time** - Start with most critical/frequently used
3. **Test thoroughly** after each change
4. **Gradually replace** old patterns with new ones

### Example migration order:

1. `app/api/chat-stream/route.js` - Most critical API
2. `lib/features/chat/conversations.js` - Frequently used
3. `app/api/conversations/route.js` - Common API
4. Rest of API routes
5. Frontend components (logger only)

---

## Testing After Changes

Sau mỗi change, test:
- ✅ API routes vẫn hoạt động
- ✅ Error handling vẫn correct
- ✅ Logs vẫn được output (check Vercel logs)
- ✅ No regressions trong functionality

