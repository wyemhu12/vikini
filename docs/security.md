# docs/security.md

## Supabase & Row Level Security (RLS)

### Current Setup

- **All server-side queries use `service_role` key** via `getSupabaseAdmin()` in `/lib/core/supabase.ts`
- `service_role` key **bypasses RLS** completely
- App handles authorization in application code (checking `userId` before operations)

### RLS Status (Updated 2025-12-31)

RLS has been **enabled** on all tables. However, most user data tables have **no SELECT/INSERT/UPDATE/DELETE policies** for `authenticated` or `anon` roles - only `service_role` can access them.

Config tables (`allowed_mime_types`, `rank_configs`) have read-only policies for authenticated users.

> [!WARNING]
> **If you add client-side Supabase calls with `anon` key in the future, you MUST add RLS policies for the affected tables.** Without policies, `anon`/`authenticated` users will get zero access (blocked by RLS).

### Tables with RLS Enabled

| Table                  | Has Policies | Notes                        |
| ---------------------- | ------------ | ---------------------------- |
| `profiles`             | ❌           | Access via service_role only |
| `conversations`        | ❌           | Access via service_role only |
| `messages`             | ❌           | Access via service_role only |
| `gems`                 | ❌           | Access via service_role only |
| `gem_versions`         | ❌           | Access via service_role only |
| `gem_runs`             | ❌           | Access via service_role only |
| `daily_message_counts` | ❌           | Access via service_role only |
| `temp_user_ranks`      | ❌           | Access via service_role only |
| `allowed_mime_types`   | ✅           | Read-only for authenticated  |
| `rank_configs`         | ✅           | Read-only for authenticated  |

### Adding Client-Side Supabase Access

If you need to add browser-side Supabase queries:

1. Create a client-side Supabase client with `anon` key
2. Add RLS policies for each table the client needs to access
3. Example policy for user-owned data:
   ```sql
   CREATE POLICY "Users can access own data" ON public.conversations
     FOR ALL TO authenticated
     USING (user_id = auth.uid()::text);
   ```

## Encryption

All message `content` is encrypted before storing in DB. See `encryptText`/`decryptText` in `/lib/core/encryption.ts`.

## Rate Limiting

IP-based rate limiting via Upstash Redis. See `/lib/core/rateLimit.ts`.

## Global Authentication Proxy (formerly Middleware)

> [!IMPORTANT]
> Tất cả routes đều yêu cầu authentication mặc định (default-deny policy).

### Cách hoạt động

- File `/proxy.ts` (Next.js 16 convention) wrap NextAuth `auth()` để kiểm tra session trước mỗi request
- Người dùng chưa xác thực sẽ được redirect về `/auth/signin`
- Proxy tự động gắn session vào request

### Public Routes (không yêu cầu auth)

| Route           | Mô tả             |
| --------------- | ----------------- |
| `/auth/signin`  | Trang đăng nhập   |
| `/auth/error`   | Trang lỗi auth    |
| `/auth/signout` | Trang đăng xuất   |
| `/api/auth/*`   | NextAuth handlers |

### Excluded Paths

- `/_next/*` (static files, images)
- `/favicon.ico`, `/robots.txt`, `/sitemap.xml`

### Lưu ý khi thêm route mới

- **API routes**: Không cần gọi `await auth()` thủ công nữa - proxy đã xử lý
- **Thêm public route**: Cập nhật `PUBLIC_ROUTES` array trong `/proxy.ts`
- **Session access**: Trong API route, dùng `req.auth` để lấy session (đã được inject bởi proxy)

## Server-Only Files Convention

> [!CAUTION]
> Các file chứa secrets (service_role key, admin credentials) PHẢI đặt tên với suffix `.server.ts` để ngăn bundling vào client.

| File                          | Mô tả                                    |
| ----------------------------- | ---------------------------------------- |
| `lib/core/supabase.server.ts` | Supabase admin client (service_role key) |

### Tại sao quan trọng?

- Next.js có thể vô tình bundle server code vào client nếu import sai
- Suffix `.server.ts` giúp:
  1. Next.js tự động ngăn import từ client components
  2. Developer dễ nhận biết file chỉ dùng server-side
  3. Giảm rủi ro leak credentials
