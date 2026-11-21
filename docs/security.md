# docs/security.md

## Supabase & Row Level Security (RLS)

### Current Setup

- **All server-side queries use `service_role` key** via `getSupabaseAdmin()` in `src/lib/core/supabase.server.ts`
- `service_role` key **bypasses RLS** completely
- App handles authorization in application code (checking `userId` before operations)

### RLS Status (Updated 2026-10-12 — Audit Cycle 2)

RLS has been **enabled and hardened** across all tables. Most user data tables have **no SELECT/INSERT/UPDATE/DELETE policies** for `authenticated` or `anon` roles — only `service_role` can access them (server-side authorization model).

In Audit Cycle 2 (2026-10-12), 4 `SECURITY DEFINER` RPC functions and 4 sensitive tables were hardened via migration `20261012000000_rls_security_audit_cycle_2.sql`:

1. `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on:
   - `increment_daily_message_count(TEXT, DATE)`
   - `increment_daily_research_count(TEXT, DATE)` _(legacy — không còn code ứng dụng dùng; chờ D1)_
   - `match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER)` (protects against cross-tenant knowledge base exfiltration; preserves `search_path = public, extensions, pg_temp` for pgvector `<=>` operator)
   - `get_project_storage_bytes(UUID)`
2. Direct client permissions revoked on `daily_message_counts`, `daily_research_counts` _(legacy)_, `research_tasks` _(legacy)_, and `personas`.

Config table `rank_configs` has a read-only policy for authenticated users (legacy table `allowed_mime_types` was dropped in migration 021).

> [!WARNING]
> **If you add client-side Supabase calls with `anon` key in the future, you MUST add RLS policies for the affected tables.** Without policies, `anon`/`authenticated` users will get zero access (blocked by RLS, error code 42501).

### Tables with RLS Status

| Table                   | Has Policies | Notes                                                                                        |
| ----------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `profiles`              | ❌           | Access via service_role only                                                                 |
| `conversations`         | ❌           | Access via service_role only                                                                 |
| `messages`              | ❌           | Access via service_role only                                                                 |
| `files`                 | ❌           | Access via service_role only                                                                 |
| `gems`                  | ❌           | Access via service_role only                                                                 |
| `gem_versions`          | ❌           | Access via service_role only                                                                 |
| `gem_runs`              | ❌           | Access via service_role only                                                                 |
| `daily_message_counts`  | ❌ (REVOKED) | Deny-by-default, service_role only (Cycle 2)                                                 |
| `daily_research_counts` | ❌ (REVOKED) | Legacy (không còn code ứng dụng dùng; chờ D1) — Deny-by-default, service_role only (Cycle 2) |
| `research_tasks`        | ❌ (REVOKED) | Legacy (không còn code ứng dụng dùng; chờ D1) — Deny-by-default, service_role only (Cycle 2) |
| `personas`              | ❌ (REVOKED) | Deny-by-default, service_role only (Cycle 2)                                                 |
| `admin_audit_logs`      | ❌           | Access via service_role only                                                                 |
| `temp_user_ranks`       | ❌           | Access via service_role only                                                                 |
| `projects`              | ✅           | Users manage own projects                                                                    |
| `knowledge_documents`   | ✅           | Users manage own knowledge docs                                                              |
| `knowledge_chunks`      | ✅           | Users manage own knowledge chunks                                                            |
| `rank_configs`          | ✅           | Read-only for authenticated                                                                  |

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

All message `content` and `meta.reasoning` are encrypted before storing in DB via AES-256-GCM with mandatory 16-byte authentication tag validation (`authTagLength: 16`, strict hex/byte-length checks, legacy AES-256-CBC decryption support). Encryption in `messages.ts` (`saveMessage`, `upsertMessage`, `encryptMetaReasoning`) is strictly **fail-closed** (`500 ENCRYPTION_ERROR`, never falling back to plaintext), and `validateEnv()` enforces a 64-character hex `DATA_ENCRYPTION_KEY`. See `src/lib/core/encryption.ts`.

## Rate Limiting

Atomic 1-RTT Lua sliding-window rate limiting via shared Upstash Redis singleton (`src/lib/core/redis.server.ts`, `src/lib/core/rateLimit.ts`):

- Rejected requests never call `ZADD` (preventing lockout extension), and Redis network errors fail over to an OOM-capped in-memory store (`MAX_MEM_STORE_ENTRIES = 10000`).
- Authenticated API routes (`/api/gems`, `/api/personas`, image routes) authenticate **before** rate limiting and key by canonical `userId` rather than spoofable `x-forwarded-for`.
- `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_SECONDS` are configured as **Vercel Environment Variables**.
- Additional per-rank daily message limits are configured via the Admin Dashboard (`/admin` → Limits tab) and stored in the `rank_configs` DB table.

## Hardening Controls (Updated 2026-11-21 — Code Audit Wave 1)

- **DB-Backed Admin & Approval Gates**: All 6 `/api/admin/*` routes call `requireAdminUser()` (`src/lib/features/auth/requireApprovedUser.ts`), verifying `rank === "admin"` and `!is_blocked` directly against `profiles` (fail-closed `503` on DB failure); `PATCH /api/admin/users` forbids self-modification. `/api/local-llm/health` enforces `requireApprovedUser()`, and `getUserTier()` fails closed (`UserBlockedError` / `AccessPendingError`).
- **Blocked Session Teardown**: `auth.ts` strips `id`/`email`/`name`/`image` when `token.blocked` is set, returning `rank: "__blocked__"`, handles `23505` concurrent first sign-in races, and distinguishes deleted (`not_found`) vs transient DB errors (`error`) in `refreshTokenFromDBDetailed()`.
- **Cross-Tenant IDOR & Cache Isolation**: `conversations.ts` verifies ownership/premade status before attaching gems, personas, or projects; `gems.ts` and `personas.ts` enforce defense-in-depth owner/premade checks and parameterized dual-`.eq()` queries; `contextCache.ts` uses SHA-256 keys scoped by `userId`, skips composite caching when RAG chunks are present, and bounds `activeCacheNames` to 500 entries.
- **XSS, Stored File & Cron Safety**: `isValidImageUrl` restricts `data:` URIs to raster base64 only; `openSafeExternalUrl` enforces `http(s)` + `noopener,noreferrer`; `/api/messages` uses a strict allowlist schema without `.passthrough()`; `fileService.server.ts` stores active web MIMEs (`image/svg+xml`, `text/html`, XML) as `text/plain; charset=utf-8` and signs downloads with `{ download: filename }`; `/api/cron/cleanup` compares SHA-256 secret digests with `crypto.timingSafeEqual` and sanitizes 500 errors.

## Hardening Controls (Updated 2026-11-21 — Code Audit Wave 2A)

- **OOXML Zip-Bomb DoS Guard (`src/lib/features/files/documentParsers.ts`)**: Before passing untrusted `.docx` or `.xlsx` archives into `mammoth` or `exceljs`, `validateZipArchiveSafety()` inspects the ZIP End of Central Directory (EOCD) and Central Directory headers (`0x02014b50`), rejecting ZIP64 sentinels (`0xffffffff`), out-of-bounds directory ranges (`cdOffset + cdSize > eocdOffset`), `> 1,000` entries, `> 50 MB` total uncompressed size, zero-compressed non-empty entries, and compression ratios `> 100:1` (for archives `> 1 MB`).
- **Raster-Only Image Allowlist (`src/lib/core/ssrfGuard.server.ts`, `edit-image`, `edit-image-multi`)**: Exported `ALLOWED_IMAGE_MIME_TYPES` (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`, `image/bmp`, `image/tiff`) explicitly excluding `image/svg+xml` across SSRF fetches and base64/`data:` image editing endpoints (validating both case-insensitive `data:` prefixes and explicit `imageMimeType` headers alongside `10 MB` decoded / `14 MB` base64 payload caps).
- **Cross-Project Document Isolation & Atomic Mutation Guards (`knowledge.server.ts`, `admin/rank-configs`, `admin/gems`, `storyPersistence.server.ts`)**: `deleteDocument(userId, documentId, projectId?)` scopes deletion with `.eq("project_id", projectId)` when called from `/api/projects/[id]/knowledge`, preventing cross-project document deletion; `PATCH /api/admin/rank-configs` validates every entry upfront before writing any row and invalidates cache in `finally`; `getStoryState()` is strictly read-only and duplicate `story_state` rows are pruned only after a successful CAS `.update()`.

## Environment Variables & Secrets (Vercel)

> [!IMPORTANT]
> All API keys and secrets are managed exclusively through the **Vercel Dashboard** (`Project Settings → Environment Variables`). Never commit secrets to the repository.

### Security Rules

1. **Sensitive variables** (e.g., `DEEPSEEK_API_KEY`) should be marked as `Sensitive` in Vercel — they won't be readable after creation.
2. **Scope control**: Use `Production and Preview` for keys that should not leak to development builds.
3. **"Needs Attention" flag**: Vercel flags variables that may have issues (e.g., expired, empty). Monitor these in the dashboard regularly.
4. **Rotation**: When rotating API keys, update via Vercel Dashboard and trigger a redeployment.

### What is NOT on Vercel

- **Per-rank limits** (daily messages, file size, features, allowed models) → managed via Admin Dashboard UI → stored in Supabase `rank_configs` table
- **User management** (ranks, block/unblock) → managed via Admin Dashboard UI → stored in Supabase `profiles` table

## Authentication (NextAuth v5)

> [!IMPORTANT]
> Tất cả API routes đều yêu cầu authentication. Mỗi route **PHẢI** gọi `await auth()` để kiểm tra session.

### Cách hoạt động

- Auth config tại `lib/features/auth/auth.ts` — export `{ handlers, auth, signIn, signOut }` từ NextAuth v5
- Mỗi API route gọi `const session = await auth()` và kiểm tra `session?.user?.email`
- Auth routes handler: `app/api/auth/[...nextauth]/route.ts`
- Google OAuth là provider duy nhất

### Public Routes (không yêu cầu auth)

| Route           | Mô tả             |
| --------------- | ----------------- |
| `/auth/signin`  | Trang đăng nhập   |
| `/auth/error`   | Trang lỗi auth    |
| `/auth/signout` | Trang đăng xuất   |
| `/api/auth/*`   | NextAuth handlers |

### Lưu ý khi thêm route mới

- **API routes**: PHẢI gọi `await auth()` từ `@/lib/features/auth/auth` trong mỗi handler
- **Session access**: `const session = await auth(); const email = session?.user?.email`
- **Helper**: Một số routes dùng `requireUser()` helper từ `app/api/conversations/auth.ts`

## Server-Only Files Convention

> [!CAUTION]
> Các file chứa secrets (service_role key, admin credentials) PHẢI đặt tên với suffix `.server.ts` để ngăn bundling vào client.

| File                              | Mô tả                                    |
| --------------------------------- | ---------------------------------------- |
| `src/lib/core/supabase.server.ts` | Supabase admin client (service_role key) |

### Tại sao quan trọng?

- Next.js có thể vô tình bundle server code vào client nếu import sai
- Suffix `.server.ts` giúp:
  1. Next.js tự động ngăn import từ client components
  2. Developer dễ nhận biết file chỉ dùng server-side
  3. Giảm rủi ro leak credentials
