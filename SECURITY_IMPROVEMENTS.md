# Security Improvements & Recommendations

Tài liệu này liệt kê các vấn đề bảo mật đã được phát hiện và đề xuất cải thiện cho project Vikini.

## 🔴 CRITICAL - Cần sửa ngay

### 1. Hardcoded Fallback Encryption Key ✅ FIXED

**File**: `lib/core/encryption.ts`

**Vấn đề**: Có hardcoded fallback key trong code, nếu không set `DATA_ENCRYPTION_KEY` trong env, sẽ dùng key không an toàn.

**Status**: ✅ **ĐÃ SỬA** - Xóa fallback key, app sẽ throw error nếu không có `DATA_ENCRYPTION_KEY` (minimum 32 characters)

**Changes**:
- Xóa `FALLBACK_KEY` constant
- Thêm validation: throw error nếu không có key hoặc key < 32 chars
- Thêm vào `envValidation.ts` để validate sớm
- Cập nhật `env.local.example` với hướng dẫn

**Impact**: Đảm bảo encryption key luôn được set đúng cách, không còn hardcoded key

---

### 2. Cron Endpoint Secret Exposure ✅ FIXED

**File**: `app/api/cron/attachments-cleanup/route.ts`

**Vấn đề**: Secret được truyền qua query parameter, có thể bị log trong server logs hoặc browser history.

**Status**: ✅ **ĐÃ SỬA** - Chỉ sử dụng header `x-cron-secret`, không còn query params

**Changes**:
- Xóa `url.searchParams.get("secret")` 
- Chỉ dùng `req.headers.get("x-cron-secret")`
- Thêm comment giải thích lý do security

**Impact**: Bảo vệ secret khỏi bị expose trong logs và browser history

---

### 3. Missing Security Headers ✅ FIXED

**File**: `next.config.ts`

**Vấn đề**: Không có security headers như CSP, X-Frame-Options, X-Content-Type-Options, etc.

**Status**: ✅ **ĐÃ SỬA** - Đã thêm đầy đủ security headers

**Changes**: Đã thêm vào `next.config.ts`:

Đã thêm các headers sau:
- `X-DNS-Prefetch-Control`: on
- `Strict-Transport-Security`: HSTS với max-age 2 năm
- `X-Frame-Options`: SAMEORIGIN (chống clickjacking)
- `X-Content-Type-Options`: nosniff (chống MIME sniffing)
- `X-XSS-Protection`: 1; mode=block
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Content-Security-Policy`: CSP policy với whitelist domains (Supabase, Google APIs)
- `Permissions-Policy`: Disable camera, microphone, geolocation

**Impact**: Bảo vệ khỏi XSS, clickjacking, MIME type sniffing attacks

---

## 🟡 HIGH Priority - Nên làm sớm

### 4. Request Size Limits

**Vấn đề**: Không có giới hạn rõ ràng cho request body size, có thể bị DoS.

**Rủi ro**:
- Attacker có thể gửi request body rất lớn
- Có thể làm server hết memory
- Rate limiting không đủ để bảo vệ

**Cải thiện**: Thêm middleware để limit request size:

```typescript
// lib/utils/requestLimits.ts
export const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB

export function checkRequestSize(req: NextRequest): boolean {
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_REQUEST_SIZE) {
      return false;
    }
  }
  return true;
}
```

**Impact**: Bảo vệ khỏi DoS attacks

---

### 5. Error Message Information Leakage

**Vấn đề**: Một số error messages có thể leak thông tin về hệ thống.

**Ví dụ**: 
- `"Missing GEMINI_API_KEY"` - leak về cấu trúc env vars
- Database error messages có thể leak schema info

**Cải thiện**: Sanitize error messages trong production:

```typescript
// lib/utils/errors.ts
export function sanitizeError(error: unknown, isProduction: boolean): string {
  if (isProduction) {
    // Trong production, chỉ trả về generic errors
    if (error instanceof AppError) {
      // Chỉ trả về user-friendly messages
      return error.message;
    }
    return "An error occurred. Please try again later.";
  }
  // Trong development, trả về full error
  return String(error);
}
```

**Impact**: Không leak thông tin nhạy cảm

---

### 6. File Upload Security Enhancements

**File**: `lib/features/attachments/attachments.ts`

**Vấn đề hiện tại**: 
- ✅ Đã có validation file type
- ✅ Đã có size limits
- ✅ Đã có MIME type checking
- ⚠️ Có thể cải thiện thêm

**Cải thiện bổ sung**:

1. **Virus scanning** (nếu có budget):
```typescript
// Optional: Integrate với virus scanning service
async function scanFileForVirus(file: File): Promise<boolean> {
  // Integrate với ClamAV hoặc cloud service
  return true; // Placeholder
}
```

2. **Content validation** cho images:
```typescript
// Verify image is actually valid image
import sharp from 'sharp';

async function validateImageContent(file: File): Promise<boolean> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await sharp(buffer).metadata();
    return true;
  } catch {
    return false; // Not a valid image
  }
}
```

3. **Filename sanitization** (đã có nhưng có thể cải thiện):
```typescript
// Thêm validation cho filename length và special chars
export function sanitizeFilename(name: unknown): string {
  const raw = String(name || "file").trim();
  // Remove path traversal attempts
  const safe = raw
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\/\\]/g, '_') // Replace path separators
    .replace(/[^\w\.\-]/g, '_') // Only allow alphanumeric, dots, hyphens
    .slice(0, 255); // Limit length
  return safe || "file";
}
```

**Impact**: Bảo vệ tốt hơn khỏi malicious files

---

### 7. CSRF Protection

**Vấn đề**: Không thấy CSRF protection cho POST/PATCH/DELETE requests.

**Rủi ro**: Cross-Site Request Forgery attacks

**Cải thiện**: Next.js có built-in CSRF protection, nhưng nên verify:

1. **Verify SameSite cookies** trong NextAuth config:
```typescript
// lib/features/auth/auth.ts
export const { handlers, auth } = NextAuth({
  // ... existing config
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});
```

2. **Thêm CSRF token** cho các API routes quan trọng (optional, NextAuth đã có protection):
```typescript
// Verify origin header
const origin = req.headers.get('origin');
const referer = req.headers.get('referer');
if (origin && !isAllowedOrigin(origin)) {
  return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
}
```

**Impact**: Bảo vệ khỏi CSRF attacks

---

### 8. Rate Limiting Improvements

**File**: `lib/core/rateLimit.ts`

**Vấn đề hiện tại**:
- ✅ Đã có rate limiting
- ⚠️ Có thể cải thiện với adaptive rate limiting
- ⚠️ Không có rate limiting cho file uploads

**Cải thiện**:

1. **Different limits cho different endpoints**:
```typescript
export const RATE_LIMITS = {
  'chat-stream': { windowSeconds: 60, limit: 20 },
  'attachments-upload': { windowSeconds: 60, limit: 5 },
  'attachments-analyze': { windowSeconds: 60, limit: 10 },
  'gems-create': { windowSeconds: 60, limit: 10 },
} as const;
```

2. **IP-based rate limiting** cho unauthenticated requests:
```typescript
// Thêm IP-based limiting cho public endpoints
const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
           req.headers.get('x-real-ip') || 
           'unknown';
```

3. **Exponential backoff** cho rate limit errors:
```typescript
// Thêm Retry-After header với exponential backoff
const retryAfter = Math.min(
  result.retryAfterSeconds * Math.pow(2, attemptCount),
  3600 // Max 1 hour
);
```

**Impact**: Bảo vệ tốt hơn khỏi abuse

---

## 🟢 MEDIUM Priority - Nên làm trong tương lai

### 9. Input Sanitization for XSS

**Vấn đề**: User input có thể chứa XSS payloads, cần sanitize trước khi hiển thị.

**Cải thiện**: Sử dụng DOMPurify hoặc tương tự:

```typescript
// lib/utils/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // Không cho phép HTML tags
    ALLOWED_ATTR: [],
  });
}

export function sanitizeText(text: string): string {
  // Escape HTML entities
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

**Impact**: Bảo vệ khỏi XSS attacks

---

### 10. SQL Injection Protection Review

**Vấn đề**: Đang dùng Supabase client (đã có protection), nhưng nên review các raw queries.

**Kiểm tra**:
- ✅ Supabase client tự động parameterize queries
- ⚠️ Không có raw SQL queries trong code (good!)
- ✅ Tất cả queries đều qua Supabase client

**Recommendation**: Tiếp tục sử dụng Supabase client, không dùng raw SQL.

---

### 11. Authentication Improvements

**File**: `lib/features/auth/auth.ts`

**Vấn đề hiện tại**:
- ✅ Đã có email whitelist
- ✅ Đã có Google OAuth
- ⚠️ Có thể thêm 2FA (optional)

**Cải thiện** (optional):

1. **Session timeout**:
```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
  updateAge: 24 * 60 * 60, // Update session every 24 hours
},
```

2. **Account lockout** sau nhiều failed attempts (cần database schema):
```typescript
// Track failed login attempts
// Lock account sau 5 failed attempts trong 15 phút
```

**Impact**: Bảo vệ tốt hơn authentication

---

### 12. Logging Security

**Vấn đề**: Logs có thể chứa sensitive data (API keys, user data, etc.)

**Cải thiện**: Sanitize logs:

```typescript
// lib/utils/logger.ts
const SENSITIVE_FIELDS = ['password', 'apiKey', 'secret', 'token', 'authorization'];

export function sanitizeForLogging(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized = { ...obj as Record<string, unknown> };
  for (const key in sanitized) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}
```

**Impact**: Không leak sensitive data trong logs

---

### 13. Environment Variables Security

**Vấn đề hiện tại**:
- ✅ Đã có env validation
- ⚠️ Có thể thêm rotation policy

**Cải thiện**:

1. **Secret rotation**:
```typescript
// Document rotation process
// - DATA_ENCRYPTION_KEY: Rotate và re-encrypt all data
// - NEXTAUTH_SECRET: Rotate và invalidate all sessions
// - API keys: Rotate và update env vars
```

2. **Separate env files** cho dev/staging/prod:
```typescript
// Không commit .env files
// Sử dụng secret management service (Vercel, AWS Secrets Manager, etc.)
```

**Impact**: Better secret management

---

### 14. API Response Headers

**Vấn đề**: Một số API responses không có security headers.

**Cải thiện**: Thêm headers cho API responses:

```typescript
// lib/utils/apiResponse.ts
export function secureHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };
}
```

**Impact**: Bảo vệ tốt hơn API responses

---

## 📋 Implementation Checklist

### Immediate (1-2 weeks):
- [ ] Xóa hardcoded fallback encryption key
- [ ] Sửa cron endpoint secret (chỉ dùng header)
- [ ] Thêm security headers vào next.config.ts
- [ ] Thêm request size limits
- [ ] Sanitize error messages trong production

### Short-term (1 month):
- [ ] Cải thiện file upload security
- [ ] Verify CSRF protection
- [ ] Cải thiện rate limiting
- [ ] Thêm input sanitization
- [ ] Sanitize logs

### Long-term (2-3 months):
- [ ] Consider 2FA (optional)
- [ ] Secret rotation policy
- [ ] Security audit
- [ ] Penetration testing

---

## 🔍 Security Best Practices

1. **Never commit secrets** - Sử dụng env vars hoặc secret management
2. **Validate all inputs** - Sử dụng Zod schemas
3. **Sanitize outputs** - Escape HTML, sanitize user content
4. **Use HTTPS** - Luôn luôn trong production
5. **Keep dependencies updated** - `npm audit` định kỳ
6. **Monitor logs** - Tìm suspicious activities
7. **Regular security reviews** - Code review với security focus

---

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

