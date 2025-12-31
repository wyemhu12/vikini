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
