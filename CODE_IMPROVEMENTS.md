# Code Improvements & Best Practices

Tài liệu này liệt kê các đề xuất cải thiện code để tăng chất lượng, maintainability, và performance.

## 🔴 HIGH Priority - Nên làm ngay

### 1. Schema Format Detection Cache

**Vấn đề**: Code thử nhiều schema formats (snake_case vs camelCase) mỗi lần query, gây overhead không cần thiết.

**File**: `lib/features/chat/conversations.js`, `lib/features/gems/gems.js`

**Hiện tại**:
```javascript
// Thử user_id, nếu fail thì thử userId
const q1 = await supabase.from("conversations").eq("user_id", userId)...
if (!q1.error) return ...;
const q2 = await supabase.from("conversations").eq("userId", userId)...
```

**Cải thiện**:
```javascript
// Cache schema format sau lần detect đầu tiên
let detectedSchemaFormat = null; // 'snake_case' | 'camelCase' | null

async function detectSchemaFormat() {
  if (detectedSchemaFormat) return detectedSchemaFormat;
  
  // Test với một query đơn giản
  const test = await supabase.from("conversations").select("id").limit(1);
  // Check error hoặc data structure để detect format
  // Cache kết quả
  detectedSchemaFormat = 'snake_case'; // hoặc 'camelCase'
  return detectedSchemaFormat;
}
```

**Impact**: Giảm 50% số queries trong một số functions

---

### 2. Reduce Console.log Statements

**Vấn đề**: Có 97 console.log/error/warn statements trong codebase. Trong production, nên sử dụng logging library.

**Cải thiện**:
- Tạo utility function cho logging
- Support log levels (debug, info, warn, error)
- Chỉ log errors/warnings trong production
- Consider sử dụng logging service (Vercel Logs, Sentry, etc.)

**File mới**: `lib/utils/logger.js`
```javascript
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (...args) => isDev && LOG_LEVEL === 'debug' && console.log('[DEBUG]', ...args),
  info: (...args) => LOG_LEVEL !== 'error' && console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};
```

**Impact**: Better debugging, cleaner production logs

---

### 3. Error Handling Consistency

**Vấn đề**: Error handling không consistent - một số nơi throw Error, một số return null, một số console.error.

**Cải thiện**:
- Tạo custom error classes
- Standardize error responses trong API routes
- Centralize error handling

**File mới**: `lib/utils/errors.js`
```javascript
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}
```

**Impact**: Better error tracking, consistent user experience

---

### 4. Extract Magic Strings/Numbers

**Vấn đề**: Magic strings và numbers rải rác trong code.

**Cải thiện**: Tạo constants file

**File mới**: `lib/constants/index.js`
```javascript
// Message roles
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

// Default limits
export const DEFAULT_LIMITS = {
  RECENT_MESSAGES: 50,
  CONTEXT_MESSAGES: 100,
  MAX_TITLE_LENGTH: 100,
} as const;

// Cache TTLs (seconds)
export const CACHE_TTL = {
  CONVERSATIONS_LIST: 60,
  GEMS_LIST: 300,
  GEM_INSTRUCTIONS: 3600,
} as const;
```

**Impact**: Easier maintenance, prevent typos

---

## 🟡 MEDIUM Priority - Nên làm trong thời gian tới

### 5. Type Safety với JSDoc hoặc TypeScript

**Vấn đề**: Đang dùng JavaScript thuần, không có type checking.

**Cải thiện**:
- Option A: Thêm JSDoc comments cho type hints
- Option B: Migrate sang TypeScript (recommended)

**Ví dụ JSDoc**:
```javascript
/**
 * @param {string} userId
 * @param {string} conversationId
 * @param {'user' | 'assistant'} role
 * @param {string} content
 * @param {Record<string, any>} [meta={}]
 * @returns {Promise<{id: string, conversationId: string, role: string, content: string, createdAt: string, meta: Record<string, any>}>}
 */
export async function saveMessage(userId, conversationId, role, content, meta = {}) {
  // ...
}
```

**Impact**: Catch bugs early, better IDE support, self-documenting code

---

### 6. Extract Long Functions

**Vấn đề**: Một số functions quá dài (ví dụ: `handleChatStreamCore` ~300 lines, `createChatReadableStream` ~250 lines).

**Cải thiện**: Break down thành smaller, focused functions.

**Ví dụ**: `app/api/chat-stream/chatStreamCore.js`
```javascript
// Extract conversation loading logic
async function loadOrCreateConversation(userId, conversationIdRaw) {
  // ...
}

// Extract message context building
async function buildMessageContext(conversationId, sysPrompt, modelLimitTokens) {
  // ...
}

// Extract streaming setup
function setupStreaming(params) {
  // ...
}
```

**Impact**: Easier to test, easier to maintain, better readability

---

### 7. Input Validation với Zod

**Vấn đề**: Input validation được làm thủ công, dễ miss edge cases.

**Cải thiện**: Sử dụng Zod schema validation.

**Example**:
```javascript
import { z } from 'zod';

const chatStreamRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1).max(100000),
  regenerate: z.boolean().optional(),
  truncateMessageId: z.string().uuid().optional(),
  skipSaveUserMessage: z.boolean().optional(),
});

// Trong route handler
const body = await req.json();
const validated = chatStreamRequestSchema.parse(body);
```

**Impact**: Better validation, type safety, clear error messages

---

### 8. API Response Standardization

**Vấn đề**: API responses không consistent format.

**Cải thiện**: Tạo helper functions cho standard responses.

**File mới**: `lib/utils/apiResponse.js`
```javascript
export function success(data, statusCode = 200) {
  return NextResponse.json({ success: true, data }, { status: statusCode });
}

export function error(message, statusCode = 500, code = 'INTERNAL_ERROR') {
  return NextResponse.json({ 
    success: false, 
    error: { message, code } 
  }, { status: statusCode });
}
```

**Impact**: Consistent API, easier frontend integration

---

### 9. Environment Variables Validation

**Vấn đề**: Environment variables được check rải rác, dễ miss validation.

**Cải thiện**: Validate env vars khi app start.

**File mới**: `lib/utils/envValidation.js`
```javascript
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  // ... other required vars
});

export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Invalid environment variables:', error);
    throw new Error('Missing or invalid environment variables');
  }
}
```

**Impact**: Fail fast, clear error messages

---

## 🟢 LOW Priority - Nice to have

### 10. Testing Setup

**Cải thiện**: Thêm unit tests và integration tests.

**Recommendations**:
- Jest + React Testing Library cho frontend
- Vitest cho backend/utils
- Supertest cho API route testing

**Impact**: Catch regressions, safer refactoring

---

### 11. Code Documentation

**Cải thiện**: 
- Add JSDoc comments cho public APIs
- README với architecture overview
- API documentation

**Impact**: Easier onboarding, better maintainability

---

### 12. Performance Monitoring

**Cải thiện**: 
- Add performance monitoring (Vercel Analytics, Sentry Performance)
- Track slow queries
- Monitor API response times

**Impact**: Identify bottlenecks, improve UX

---

### 13. Security Improvements

**Cải thiện**:
- Input sanitization (đã có một số, cần review)
- Rate limiting đã có, good!
- Consider CSRF protection
- Security headers

**Impact**: Better security posture

---

## 📋 Implementation Checklist

### Immediate (1-2 weeks):
- [ ] Schema format detection cache
- [ ] Logger utility
- [ ] Constants file
- [ ] Error classes

### Short-term (1 month):
- [ ] JSDoc comments hoặc TypeScript migration
- [ ] Extract long functions
- [ ] Zod validation
- [ ] API response standardization

### Long-term (2-3 months):
- [ ] Testing setup
- [ ] Documentation
- [ ] Performance monitoring
- [ ] Security audit

---

## 🔍 Code Review Guidelines

Khi review code, check:
1. ✅ Error handling có đầy đủ không?
2. ✅ Input validation có chưa?
3. ✅ Console.log có được replace bằng logger không?
4. ✅ Magic strings/numbers có được extract không?
5. ✅ Functions có quá dài không (>100 lines)?
6. ✅ Type safety có được đảm bảo không?
7. ✅ API responses có consistent không?
8. ✅ Comments có giải thích "why" không (không chỉ "what")?

---

## 📚 Resources

- [Next.js Best Practices](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [TypeScript Migration Guide](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)
- [Zod Documentation](https://zod.dev/)
- [Error Handling Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)

