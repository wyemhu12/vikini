# Implementation Plan: Code Audit Wave 1 — Verified P0 Security & Core Runtime Bug Fixes

- **Author**: Subagent @planner ([PLANNER_MODEL: gemini-4-argon])
- **Date**: 2026-11-21
- **Revision**: 2
- **Status**: Completed
- **CRITIC_REQUIRED**: yes (touches `*.server.ts`, authentication/RBAC, cryptography, file storage, and API security gates)
- **Domain**: Security Hardening (IDOR, AES-256-GCM, RBAC/Auth, XSS/Storage, Rate Limiting, Cron) & Core Runtime Reliability (API Responses, Upstash Redis Lua, SSE Streaming, Zod v4, RAG Chunking, Zustand v5)

---

## Technical Plan

### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)

#### Goal

Khắc phục triệt để toàn bộ **lỗ hổng bảo mật P0 (Group A)** và **lỗi runtime / toàn vẹn dữ liệu P0 (Group B)** đã được kiểm chứng trực tiếp trên mã nguồn Vikini trong một đợt triển khai Wave 1 đồng nhất, kèm đầy đủ co-located unit tests, Wiring Probes và Negative Probes:

- **Group A — Verified P0 Security Fixes**:
  - **A.1 Cross-Tenant IDOR (Gems, Personas, Projects)**: Chặn liên kết chéo tenant trong `conversations.ts`, phòng thủ chiều sâu (defense-in-depth) trong `gems.ts` và `personas.ts`, xóa nhánh fallback `q2` fail-open rò rỉ toàn bộ gems các tenant và đầu độc Redis cache, loại bỏ raw `.or()` interpolation trên `personas.ts`, và khóa chỉnh sửa/xóa premade personas.
  - **A.2 AES-256-GCM Auth Tag (CWE-347 / Node DEP0182) & Plaintext Fail-Open**: Ép `{ authTagLength: 16 }` và xác thực hex/độ dài byte nghiêm ngặt trong `encryption.ts`; đồng bộ `envValidation.ts` yêu cầu đúng 64 ký tự hex và guard `instanceof z.ZodError`; fail-closed khi mã hóa thất bại trong `messages.ts` (cấm lưu plaintext âm thầm), kiểm tra quyền sở hữu conversation trong `deleteLastAssistantMessage`, và kiểm tra `{ error }` trên mọi lệnh `.delete()`.
  - **A.3 Gemini Context Cache Isolation & Memory Bound**: Thay `djb2` 32-bit bằng SHA-256, đưa `userId` vào `CompositeCacheConfig` và khóa cache, bỏ qua composite cache khi có RAG context động (`ragSources.length > 0`), và giới hạn bộ nhớ `activeCacheNames` (lazy expiration + hard cap 500 entries).
  - **A.4 Auth, Admin RBAC, Approval Gate & Model/Feature Gating**: Thêm `requireAdminUser()` đọc trực tiếp DB (`getUserProfileStrict`) và đấu nối vào cả 6 route `/api/admin/*`, bổ sung tự bảo vệ admin trong `PATCH /api/admin/users`; fail-closed khi `token.blocked` (trả `{ id: "", rank: "__blocked__", email: undefined, name: undefined, image: undefined }` khớp `src/types/next-auth.d.ts:5-10` và guard race `signIn()` trong `useAuthGate.ts`), phân biệt `not_found` vs `error` khi làm mới JWT và xử lý an toàn race insert `23505` lúc đăng nhập lần đầu; chuyển `/api/local-llm/health` sang `requireApprovedUser()`; chặn `is_blocked`/`not_whitelisted` trong `getUserTier()` (`src/lib/features/projects/projects.server.ts`); chặn cookie web search vượt quyền gói `basic` trong `chatStreamCore.ts`/`contextBuilder.ts`; khóa allowlist model ảnh & quyền `enhancerModel` + BYOK isolation + sửa safety check chết + đồng bộ camelCase `thoughtSignature` cả 2 chiều gửi/nhận + dọn storage mồ côi (`if (storagePath)`) cho 3 route ảnh (`generate-image`, `edit-image`, `edit-image-multi`).
  - **A.5 XSS, Stored File Safety, Rate-Limit Spoofing & Cron Security**: Khóa `data:` URL trong `isValidImageUrl` chỉ cho phép raster base64, bổ sung `openSafeExternalUrl()` thay `window.open` trần và hoãn `URL.revokeObjectURL` trong `GalleryView.tsx`, `Canvas.tsx`, `ImageLightbox.tsx`; bỏ `.passthrough()` khỏi `/api/messages`; vô hiệu hóa Stored XSS cho file SVG/HTML khi upload & `createSignedUrl`, chuyển `fileValidation.ts` sang `ValidationError` (400), `Object.hasOwn`, đọc 16 byte đầu bằng `file.slice(0, 16)`; xác thực trước khi rate-limit theo `userId` ở `/api/gems` và `/api/personas`; so sánh constant-time (`crypto.timingSafeEqual` trên SHA-256 digest), giữ nguyên contract 401 `{ error: "Unauthorized" }` và dùng `error()` helper cho nhánh 500 (không rò rỉ `err.message`) ở `/api/cron/cleanup`.
- **Group B — Verified P0 Core Runtime & Data-Integrity Bugs**:
  - **B.1 `apiResponse.ts` & `errors.ts`**: Sửa lỗi double-sanitization trong `errorFromAppError`, bảo toàn `Retry-After` cho `RateLimitError`, không để `metadata` ghi đè `message`/`code`, và bổ sung đầy đủ 10 provider/service env keys (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `LLAMA3_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `CRON_SECRET`, `ATTACHMENTS_CRON_SECRET`, `STRATA_API_KEY`) vào `envVarPatterns`.
  - **B.2 Shared Redis Singleton & Atomic Sliding-Window Rate Limit**: Tạo `src/lib/core/redis.server.ts` (`getSharedRedis()`), chuyển `rateLimit.ts` sang Lua script nguyên tử 1 RTT qua `redis.eval(...)` (sửa lỗi mảng phẳng `zrange(..., { withScores: true })` và lỗi kéo dài thời gian khóa), failover `try/catch` sang bộ nhớ có trần OOM cứng.
  - **B.3 Chat Streaming Core & Provider Reliability**: Sửa `withIdleTimeout` chống `UnhandledPromiseRejection` + gọi `iterator.return()` trong `finally`, sửa timer leak trong `withTimeout`, hoist `TextEncoder`; sửa lỗi Anthropic Claude trực tiếp không chạy được khi thiếu `OPENROUTER_API_KEY` và lazy-init `getGenAIClient()` chỉ cho Gemini; sửa lưu trùng mid-stream ở 4 provider (`openai`, `anthropic`, `deepseek`, `strata`), chuẩn hóa `sendInitialMetaEvents` + `optimisticTitle` ở `anthropic-stream.ts`, sửa `deepseek-stream.ts` phân loại nhầm HTTP 429; bọc `withIdleTimeout` + xử lý `executableCode`/`codeExecutionResult` + chống emit `error` SSE hai lần ở `gemini-stream.ts`; guard `decodeURIComponent` ở `chatStreamHelpers.ts`; ưu tiên `priorityFileIds` trước lịch sử (duyệt mới → cũ) ở `attachmentProcessor.ts`; loại bỏ double-count token tin nhắn hiện tại ở `contextBuilder.ts`.
  - **B.4 Zod v4 `.issues[0]`, Chunking $O(N)$ & Zustand v5 Stability**: Thay toàn bộ 9 điểm dùng Zod v3 `.errors[0]` sang `z.ZodError` `.issues[0]` + bắt lỗi JSON 400; sửa mất tail chunk, hard-split đoạn/code quá khổ, offset dòng $O(N)$ và trích xuất đuôi file an toàn trong `chunking.ts`; sửa vòng lặp re-render vô hạn Zustand v5 + React 19 trong `projectStore.ts` bằng `useShallow`, selector cô lập cho `useCurrentProject`, `parseApiResponse` an toàn và đồng bộ `limits.currentProjects`.

#### Out of Scope (What We're NOT Doing)

- **ZERO overlap với `docs/plans/2026-11-21-ux-ui-audit-phase-5-polish-hygiene-plan.md`**: TUYỆT ĐỐI KHÔNG chạm `ChatBubble.handleCopyMessage`, `ErrorBoundary`, `src/app/global-error.tsx`, dead hover tokens, `transition-all`, Z-Index tokens, hoặc `useChatTranslations`.
- **Defer sang Wave 2**: Tối ưu re-render frontend diện rộng, refactor toàn diện `useChatStreamController`, sửa lỗi phụ NovelCrafter, phân trang admin vượt ngưỡng 1.000 dòng, chuyển `cache.ts` và `authRevocation.ts` sang `getSharedRedis()` (giữ diff Wave 1 tối thiểu, tránh làm vỡ test mock `@upstash/redis` không liên quan).
- **Defer sang Wave 3**: Tách 33 God-files (như `conversations.ts`, `chatStreamCore.ts`, `gemini-stream.ts`), tái cấu trúc ranh giới `src/components/ui/`, triển khai CSP nonce `proxy.ts`, dọn dẹp unused dependencies trong `package.json`.
- **Không chạm DB migration SQL hoặc schema Supabase**: Toàn bộ Wave 1 xử lý ở tầng ứng dụng TypeScript; không thêm cột/bảng mới, không sửa `supabase/migrations/`.
- **Không chạm `src/app/api/describe-image/route.ts` và `src/app/api/chat-stream/route.ts`**: Tránh rủi ro không cần thiết lên các dòng `maxDuration` bị ghim bởi `code-freeze-guard.test.ts`.
- **Không đổi tên / bổ sung chuỗi giao diện người dùng cần dịch song ngữ**: Toàn bộ lỗi trả về là mã lỗi API/kỹ thuật chuẩn tiếng Anh theo `.agents/skills/api-patterns/SKILL.md` (không đụng `src/lib/utils/translations/{vi,en}.ts`).

---

### 2. Tài Liệu Tham Chiếu (Pre-Work Reading) & Skills Loaded & Applied

Mọi tài liệu quy tắc và `SKILL.md` dưới đây đã được đọc trực tiếp bằng `read_file` trong phiên trước khi lập kế hoạch:

| Tài liệu / Skill đã đọc (`read_file`)                              | Quyết định kỹ thuật chịu ảnh hưởng trong Wave 1                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/rules/00-core.md`                                         | Giữ bất biến stack (Next.js 16, React 19, Supabase + NextAuth v5 + Upstash Redis; cấm Prisma/Better Auth), cấm `any`, cấm `console.log`, bắt buộc co-located `*.test.ts` cho mọi logic trong `src/lib/core/` và `src/lib/features/`.                                                                      |
| `.agents/rules/01-coding.md`                                       | Thiết kế hàm ngắn `< 50` dòng, kiểm soát kích thước module, thu hẹp kiểu `unknown` (`error instanceof Error`, `e instanceof z.ZodError`), không sử dụng silent catch.                                                                                                                                     |
| `.agents/rules/02-quality.md`                                      | Áp dụng Test Failure Triage Protocol (Loại A/B/C — cấm hạ chuẩn assertion), PowerShell 5.1 dùng `;` thay `&&`, bắt buộc cập nhật `docs/CHANGELOG.md`, `docs/lessons-learned.md`, `docs/security.md`.                                                                                                      |
| `.agents/rules/03-ui.md`                                           | Chỉ thay `window.open` trần bằng `openSafeExternalUrl` và trì hoãn `URL.revokeObjectURL` trong `GalleryView.tsx`, `Canvas.tsx`, `ImageLightbox.tsx` — không thay đổi layout/CSS nên không làm vỡ Visual QA baseline.                                                                                      |
| `.agents/rules/05-plan-review.md`                                  | Gắn `CRITIC_REQUIRED: yes`, kê khai 100% đường dẫn `[NEW]`/`[MODIFY]` (kể cả test & docs) cho `plan-scope.js`, giữ `- **Status**: Pending Review` và `## Audit History` trống chờ `@reviewer` & Critic Pass.                                                                                              |
| `.agents/skills/api-patterns/SKILL.md`                             | Mọi API route dùng `AppError` subclasses (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `RateLimitError`, `ServiceUnavailableError`) + `success()`/`errorFromAppError()`/`error()` thống nhất; sửa lỗi double-sanitization trong `apiResponse.ts` để đúng contract skill.    |
| `.agents/skills/streaming-patterns/SKILL.md`                       | Giữ đúng SSE wire contract (`event: meta`, `event: thinking`, `event: token`, `event: error`, `event: done`), chuẩn hóa `anthropic-stream.ts` dùng `sendInitialMetaEvents` (`ragSources` key thống nhất), bảo vệ vòng đời stream bằng `withIdleTimeout` và `iterator.return()`.                           |
| `.agents/skills/vikini-debug/SKILL.md`                             | Sửa tận gốc root cause (Lua nguyên tử thay vì vá mảng `zrange`, `authTagLength: 16` thay vì chỉ kiểm tra độ dài string, `useShallow` thay vì memoize tạm) và ghi bài học vào `docs/lessons-learned.md` sau khi hoàn tất.                                                                                  |
| `.agents/skills/vikini-investigate/SKILL.md`                       | Thực hiện phân tích blast-radius đầy đủ (Mode 4) cho mọi module dùng chung (`apiResponse.ts`, `errors.ts`, `encryption.ts`, `contextCache.ts`, `rateLimit.ts`, `requireApprovedUser.ts`, `projects.server.ts`, `conversations.ts`, `messages.ts`) và đối soát toàn bộ unit test hiện hữu đang mock chúng. |
| `docs/security.md`, `docs/contracts.md`, `docs/lessons-learned.md` | Đối chiếu contract SSE (`docs/contracts.md:1-622`), mô hình bảo mật (`docs/security.md:1-134`), và đặc biệt quy tắc ghim chính xác số dòng `maxDuration` trong `code-freeze-guard.test.ts` (`docs/lessons-learned.md:811-817`).                                                                           |

---

### 3. Assumptions, Blast-Radius & Cross-Task Dependencies

#### Verified Assumptions (`[SRC]`)

1. **Canonical `userId` = lowercased email**: Xác minh tại `src/lib/features/auth/getUserId.ts:11-17` và `src/lib/features/auth/auth.ts:94-99`. Mọi kiểm tra quyền sở hữu (`user_id === userId`) và khóa rate-limit/cache dùng email viết thường này.
2. **Pinned `maxDuration` line invariants (CRITICAL)**: Theo `docs/lessons-learned.md:811-817` và `.agents/agents/reviewer/mental-simulation.md:58-61`, `code-freeze-guard.test.ts` ghim chính xác số dòng khai báo `maxDuration`:
   - `src/app/api/edit-image/route.ts:36` (`export const maxDuration = 60;`) — **BẮT BUỘC giữ đúng dòng 36** sau `prettier --write` (`printWidth: 100`) bằng cách import `ALLOWED_EDIT_IMAGE_MODELS` ngay trên dòng 20 sẵn có (`import { HTTP_STATUS, ALLOWED_EDIT_IMAGE_MODELS } from "@/lib/utils/constants";` — 79 ký tự) và dùng `z.enum(ALLOWED_EDIT_IMAGE_MODELS).optional()` tại dòng 30 (58 ký tự).
   - `src/app/api/cron/cleanup/route.ts:9` (`export const maxDuration = 60;`) — **BẮT BUỘC giữ đúng dòng 9**; mọi import mới (`crypto`, `error`) đặt từ dòng 11 trở xuống.
   - `src/app/api/chat-stream/route.ts:6` và `src/app/api/describe-image/route.ts:18` — **không chỉnh sửa trong Wave 1**.
3. **Backward-compatibility của `assertModelAllowedForUser`**: `src/lib/core/limits.test.ts:233,271,287,313` assert `resolves.toBeUndefined()`. Do đó **KHÔNG** thay đổi giá trị trả về `Promise<void>` của `assertModelAllowedForUser`; tại `src/app/api/chat-stream/chatStreamCore.ts:222-229` gọi `getUserLimits(userId)` (đã được cache Redis trong `src/lib/core/limits.ts`) để đọc `features.web_search`.
4. **Backward-compatibility của `refreshTokenFromDB`**: `src/lib/features/auth/authRevocation.test.ts:133-197` assert `refreshTokenFromDB(email)` trả `{ rank, isBlocked, userId } | null`. Do đó giữ nguyên chữ ký & hành vi `refreshTokenFromDB` và bổ sung hàm `refreshTokenFromDBDetailed(email)` trả discriminated union `{ status: "ok", ... } | { status: "not_found" } | { status: "error" }`, rồi để `refreshTokenFromDB` ủy quyền cho `refreshTokenFromDBDetailed` và `src/lib/features/auth/auth.ts:173` gọi trực tiếp `refreshTokenFromDBDetailed`.
5. **Client race khi strip `email` cho phiên `__blocked__`**: Tại `src/app/features/chat/components/hooks/useAuthGate.ts:23-35`, `isAuthed = status === "authenticated" && !!session?.user?.email` và `useEffect` dòng 33-35 gọi `signIn()` khi `!isAuthLoading && !isAuthed`. Khi `src/lib/features/auth/auth.ts:190-195` strip `email` lúc `token.blocked === true`, cần thêm `!isBlocked` vào điều kiện `src/app/features/chat/components/hooks/useAuthGate.ts:34` để chỉ chạy `signOut({ callbackUrl: "/auth/error?error=blocked" })` mà không race với `signIn()`.
6. **Legitimate fields gửi tới `POST /api/messages`**: `src/app/features/chat/components/hooks/useChatStreamController.ts:325-340` gửi `meta` chứa `clientMessageId`, `isPartial`, `aborted`, `status`, `isSaving`, `sources`, `urlContext`, `emptyAnswerReason`, `reasoning`, `thinkingStats`, `ragSources`. Bỏ `.passthrough()` ở `src/app/api/messages/route.ts:34` và khai báo rõ schema cho các field hợp lệ này (bỏ `isSaving` vốn chỉ là UI-only hoặc strip tự động theo mặc định Zod v4) bảo đảm dừng stream (Stop button) vẫn đồng bộ bình thường trong khi loại bỏ hoàn toàn `imageUrl`, `attachment`, `type`, `metadata`.
7. **Three plaintext fail-open sites trong `messages.ts`**: Ngoài `encryptMetaReasoning` (`src/lib/features/chat/messages.ts:61-71`) và `saveMessage` (`src/lib/features/chat/messages.ts:130-137`), kiểm tra mã nguồn phát hiện điểm thứ ba tại `upsertMessage` (`src/lib/features/chat/messages.ts:254-261`). Cả ba điểm đều phải fail-closed.
8. **Chín (9) vị trí Zod v3 `.errors[0]` cần chuyển sang Zod v4 `.issues[0]`**:
   - `src/app/api/chat-stream/chatStreamCore.ts:71-76` (1 vị trí)
   - `src/app/api/conversations/route.ts:179-185` (`PATCH`), `src/app/api/conversations/route.ts:270-276` (`DELETE`) + bổ sung bắt `z.ZodError` cho `POST` (`src/app/api/conversations/route.ts:127-128`) (2 vị trí `.errors[0]` + 1 vị trí thiếu catch Zod)
   - `src/app/api/gems/route.ts:134-138` (`POST`), `src/app/api/gems/route.ts:169-173` (`PATCH`), `src/app/api/gems/route.ts:206-210` (`DELETE`) (3 vị trí)
   - `src/app/api/personas/route.ts:112-116` (`POST`), `src/app/api/personas/route.ts:147-151` (`PATCH`), `src/app/api/personas/route.ts:184-188` (`DELETE`) (3 vị trí)
   - Tổng cộng: `1 + 2 + 3 + 3 = 9` vị trí khớp chính xác 100%.
9. **Type contract `Session["user"]["id"]: string` trong `src/types/next-auth.d.ts:5-10`**: Trường `id` của `Session["user"]` là bắt buộc (`string`, không optional) và ta không sửa `src/types/next-auth.d.ts`. Do đó nhánh `token.blocked === true` tại `src/lib/features/auth/auth.ts:190-195` BẮT BUỘC trả `user: { id: "", rank: "__blocked__", email: undefined, name: undefined, image: undefined }` — vừa vượt qua `tsc --noEmit`, vừa làm fail-closed cả `getUserId()` (`!session?.user?.email`) lẫn các route kiểm tra `!session?.user?.id || !session?.user?.email`.

#### Blast-Radius Analysis & Existing Test Triage (`vikini-investigate` Mode 4)

| Module sửa đổi                                                                            | Callers / Tests bị ảnh hưởng                                                                                                                             | Phân loại Triage & Cách xử lý không hạ chuẩn test                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/features/auth/requireApprovedUser.ts` (`requireAdminUser`)                       | 6 route `/api/admin/*` + 5 test `src/app/api/admin/{users,stats,audit-log,gems,rank-configs}/route.test.ts`                                              | **Loại B + C**: Các test cũ mock `@/lib/features/auth/auth` và assert unauth = `403`. Đổi sang mock `requireAdminUser`, cập nhật unauth `403` → `401` (`UnauthorizedError`), giữ toàn bộ assertion CRUD và bổ sung test 403 non-admin / 403 blocked / 503 DB error + tạo mới `admin/personas/route.test.ts`.                                                                                             |
| `src/app/api/local-llm/health/route.ts`                                                   | `src/app/api/local-llm/health/route.test.ts:8-26`                                                                                                        | **Loại B + C**: Đổi mock từ `auth` sang `requireApprovedUser`, thêm test 403 `UserBlockedError`, 403 `AccessPendingError`, 503 `ServiceUnavailableError`.                                                                                                                                                                                                                                                |
| `src/lib/features/projects/projects.server.ts` (`getUserTier`)                            | `src/lib/features/projects/projects.server.test.ts:85-103`                                                                                               | **Loại C**: Spec đổi từ fail-open `"basic"` khi profile `null`/rank lạ sang fail-closed `AccessPendingError` / `UserBlockedError`. Cập nhật test tương ứng và giữ nguyên các case `admin`/`pro`/`basic`.                                                                                                                                                                                                 |
| `src/lib/features/personas/personas.ts` (`getPersonasForUser`)                            | `src/lib/features/personas/personas.test.ts:90-127`                                                                                                      | **Loại B**: Test cũ mock `.or().order().order()`. Cập nhật mock harness cho 2 truy vấn `.eq()` song song (`Promise.all`), giữ nguyên toàn bộ `expect()` về dữ liệu trả về và thêm test dedup/sort/cấm `.or()`.                                                                                                                                                                                           |
| `src/app/api/gems/route.ts`                                                               | `src/app/api/gems/route.test.ts:312-332`                                                                                                                 | **Loại C**: Test cũ assert `200` khi gửi JSON lỗi `"not-json{{{"` (do `.catch(() => ({}))`). Spec mới yêu cầu trả `400 VALIDATION_ERROR`. Cập nhật kỳ vọng test đó thành `400` và bổ sung test rate-limit theo `userId`.                                                                                                                                                                                 |
| `src/app/api/generate-image/route.ts`, `edit-image/route.ts`, `edit-image-multi/route.ts` | `src/app/api/generate-image/route.test.ts:34-38,64-66`, `src/app/api/edit-image/route.test.ts:23-27`, `src/app/api/edit-image-multi/route.test.ts:28-33` | **Loại B**: Bổ sung `assertModelAllowedForUser: vi.fn().mockResolvedValue(undefined)` vào mock `@/lib/core/limits` của `generate-image/route.test.ts`, và bổ sung `remove: mockStorageRemove` vào mock `supabase.storage.from()` ở cả 3 file test ảnh để hỗ trợ kiểm thử cleanup storage mồ côi; giữ nguyên 100% assertion hiện hữu (`TC-GI-01..05`, v.v.).                                              |
| `src/app/api/cron/cleanup/route.ts`                                                       | `src/app/api/cron/cleanup/route.test.ts:64-91`                                                                                                           | **Backward-compatible 401 + New 500**: Giữ nguyên response 401 `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` tại `src/app/api/cron/cleanup/route.ts:27` (giữ xanh 100% 3 test `:65,76,90` mà không rò rỉ dữ liệu); chỉ đổi nhánh `catch` 500 (`:54`) sang `error("Cleanup failed", 500)` và bổ sung test mới cho constant-time different-length secret & 500 không lộ `err.message`.   |
| `src/lib/core/contextCache.ts`                                                            | `src/lib/core/contextCache.test.ts:34-88`, `src/lib/core/contextCache.ts:260,282-288`                                                                    | **Loại C**: `CompositeCacheConfig` thêm `userId: string`; cập nhật chữ ký deprecated `getOrCreateSystemCache(model, systemInstruction, userId, ttlSeconds)` để khớp `tsc --noEmit` và dùng chung helper `setBoundedCache` cho cả `getOrCreateCompositeCache` lẫn `getOrCreateKBCache`. Cập nhật lời gọi test cũ truyền `userId` và thêm test cô lập cross-tenant + trần 500 cho cả Composite & KB cache. |
| `src/lib/utils/apiResponse.ts`                                                            | Mọi API route & unit test dùng `errorFromAppError`                                                                                                       | Tương thích ngược hoàn toàn; trong production giữ nguyên `appError.message` thay vì phá hỏng bằng double-sanitization, và thêm header `Retry-After` cho `RateLimitError`.                                                                                                                                                                                                                                |
| `src/lib/features/files/fileValidation.ts`                                                | `src/app/api/files/upload/route.ts`, `src/lib/features/files/fileService.server.ts`, `src/lib/features/files/fileValidation.test.ts`                     | `ValidationError extends AppError extends Error`, nên mọi caller kiểm tra `instanceof Error` hoặc `instanceof AppError` hoạt động chính xác (API trả 400 thay vì 500).                                                                                                                                                                                                                                   |

#### Cross-Task Dependencies (Thứ tự thực hiện)

1. **Bước nền tảng trước**: `redis.server.ts` → `rateLimit.ts`; `constants.ts` → 3 route ảnh; `errors.ts` → `apiResponse.ts`; `xssProtection.ts` → `GalleryView.tsx` / `Canvas.tsx` / `ImageLightbox.tsx` / `messages/route.ts`; `requireApprovedUser.ts` (`requireAdminUser`) → 6 route admin; `authRevocation.ts` (`refreshTokenFromDBDetailed`) → `auth.ts` → `useAuthGate.ts`.
2. **Độc lập song song sau nền tảng**: IDOR (`conversations.ts`, `gems.ts`, `personas.ts`), Crypto (`encryption.ts`, `envValidation.ts`, `messages.ts`), Context Cache (`contextCache.ts`), Files (`fileValidation.ts`, `fileService.server.ts`), Cron (`cron/cleanup/route.ts`), Projects (`projects.server.ts`, `chunking.ts`, `projectStore.ts`), Chat Streaming (`utils.ts`, `chatStreamHelpers.ts`, `contextBuilder.ts`, `attachmentProcessor.ts`, 5 stream providers, `chatStreamCore.ts`, `conversations/route.ts`, `gems/route.ts`, `personas/route.ts`).

---

### 4. Bảng Verified Versions (2026 Grounding)

Mọi phiên bản và API spec đều được kiểm chứng trực tiếp từ `package.json`, `node_modules/*/package.json`, `.d.ts` nội bộ (`[SRC]`) và tài liệu chính thức năm 2026 (`[URL]`):

| Công nghệ / Thư viện    | Phiên bản cài đặt / Pin                | Nguồn xác minh `[SRC]` / `[URL]`                                                                                                                                                                    | Lưu ý tương thích / Breaking Change (2026)                                                                                                                                                                               |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js Runtime         | `24.x` (`@types/node ^24.10.4`)        | `[SRC]` `package.json:91,120-122`; `[URL]` https://nodejs.org/api/deprecations.html#dep0182-short-gcm-authentication-tags-without-explicit-authtaglength                                            | **DEP0182 / CWE-347**: `createDecipheriv("aes-256-gcm", ...)` không truyền `{ authTagLength: 16 }` chấp nhận auth tag bị cắt ngắn (`4..15` bytes) và phát cảnh báo deprecation; BẮT BUỘC truyền `{ authTagLength: 16 }`. |
| Next.js                 | `^16.4.0` (App Router)                 | `[SRC]` `package.json:103`                                                                                                                                                                          | App Router Route Handlers (`NextRequest`/`NextResponse`), `export const maxDuration` bị pin line trong `code-freeze-guard.test.ts` (`docs/lessons-learned.md:811-817`).                                                  |
| React                   | `^19.2.3` (`@types/react-dom ^19.2.3`) | `[SRC]` `package.json:93`                                                                                                                                                                           | `useSyncExternalStore` nghiêm ngặt: selector trả object literal mới mỗi render gây vòng lặp vô hạn (`Maximum update depth exceeded`).                                                                                    |
| Zustand                 | `5.0.10` (`package.json` `^5.0.9`)     | `[SRC]` `package.json:81`, `node_modules/zustand/react/shallow.d.ts:1`; `[URL]` https://zustand.docs.pmnd.rs/migrations/migrating-to-v5                                                             | Zustand v5 bỏ custom equality trên hook mặc định; BẮT BUỘC bọc selector trả object bằng `useShallow` từ `"zustand/react/shallow"`.                                                                                       |
| Zod                     | `4.3.5` (`package.json` `^4.2.1`)      | `[SRC]` `package.json:80`; `[URL]` https://zod.dev/v4/changelog                                                                                                                                     | Zod v4 loại bỏ `ZodError.prototype.errors`; chỉ còn `error.issues`. Dùng `e instanceof z.ZodError` và `e.issues[0]`. Object schema mặc định strip key thừa khi bỏ `.passthrough()`.                                      |
| `@upstash/redis`        | `1.36.1`                               | `[SRC]` `node_modules/@upstash/redis/nodejs.d.ts:48-79`, `node_modules/@upstash/redis/zmscore-0SAuWM0q.d.ts:3370,4105-4109`; `[URL]` https://upstash.com/docs/redis/sdks/ts/commands/scripting/eval | `zrange(..., { withScores: true })` trả mảng phẳng `[member, score]` (KHÔNG phải `[{ score }]`). `redis.eval<TArgs, TData>(script, keys, args)` hỗ trợ Lua atomic 1 RTT.                                                 |
| `@google/genai`         | `^2.10.0`                              | `[SRC]` `package.json:40`                                                                                                                                                                           | Explicit `ai.caches.create()` áp dụng cho Gemini 2.5/3.x (không dùng cho `gemini-4-*`). `part.executableCode` & `part.codeExecutionResult` nằm trực tiếp trong `candidates[0].content.parts`.                            |
| `@anthropic-ai/sdk`     | `^0.71.2`                              | `[SRC]` `package.json:39`                                                                                                                                                                           | Hỗ trợ streaming beta `ai.beta.messages.create({ stream: true })` khi `ANTHROPIC_API_KEY` được cấu hình.                                                                                                                 |
| `@supabase/supabase-js` | `v2` (Admin client)                    | `[SRC]` `src/lib/core/supabase.server.ts`, `src/lib/features/files/fileService.server.ts:402-404`; `[URL]` https://supabase.com/docs/reference/javascript/storage-from-createsignedurl              | `createSignedUrl(path, expiresIn, { download: filename })` trả URL kèm `Content-Disposition: attachment` ngăn trình duyệt thực thi inline HTML/SVG.                                                                      |
| Vitest & TypeScript     | Vitest `^4.1.12`, TS `^5.9.3`          | `[SRC]` `package.json:116,118`                                                                                                                                                                      | Chạy qua `npm run type-check; npm run lint; npm run test:run` trên Windows PowerShell 5.1.                                                                                                                               |

---

### 5. Files Cần Tạo Mới / Chỉnh Sửa / Xóa

Mọi file mã nguồn, file test co-located và tài liệu sống thuộc phạm vi Wave 1 được kê khai đầy đủ bên dưới (tương thích 100% với `plan-scope.js`):

#### Foundation, Core & Utilities (`src/lib/core/`, `src/lib/utils/`)

- [NEW] `src/lib/core/redis.server.ts`
- [NEW] `src/lib/core/redis.server.test.ts`
- [MODIFY] `src/lib/core/rateLimit.ts`
- [NEW] `src/lib/core/rateLimit.test.ts`
- [MODIFY] `src/lib/core/encryption.ts`
- [MODIFY] `src/lib/core/encryption.test.ts`
- [MODIFY] `src/lib/core/contextCache.ts`
- [MODIFY] `src/lib/core/contextCache.test.ts`
- [MODIFY] `src/lib/utils/envValidation.ts`
- [NEW] `src/lib/utils/envValidation.test.ts`
- [MODIFY] `src/lib/utils/constants.ts`
- [MODIFY] `src/lib/utils/errors.ts`
- [MODIFY] `src/lib/utils/errors.test.ts`
- [MODIFY] `src/lib/utils/apiResponse.ts`
- [NEW] `src/lib/utils/apiResponse.test.ts`
- [MODIFY] `src/lib/utils/xssProtection.ts`
- [MODIFY] `src/lib/utils/xssProtection.test.ts`

#### Auth, Admin RBAC & Gatekeeper (`src/lib/features/auth/`, `src/app/api/admin/`, `src/app/api/local-llm/`, `useAuthGate`)

- [MODIFY] `src/lib/features/auth/requireApprovedUser.ts`
- [MODIFY] `src/lib/features/auth/requireApprovedUser.test.ts`
- [MODIFY] `src/lib/features/auth/authRevocation.ts`
- [MODIFY] `src/lib/features/auth/authRevocation.test.ts`
- [MODIFY] `src/lib/features/auth/auth.ts`
- [NEW] `src/lib/features/auth/auth.test.ts`
- [MODIFY] `src/app/features/chat/components/hooks/useAuthGate.ts`
- [NEW] `src/app/features/chat/components/hooks/useAuthGate.test.ts`
- [MODIFY] `src/app/api/admin/users/route.ts`
- [MODIFY] `src/app/api/admin/users/route.test.ts`
- [MODIFY] `src/app/api/admin/stats/route.ts`
- [MODIFY] `src/app/api/admin/stats/route.test.ts`
- [MODIFY] `src/app/api/admin/audit-log/route.ts`
- [MODIFY] `src/app/api/admin/audit-log/route.test.ts`
- [MODIFY] `src/app/api/admin/gems/route.ts`
- [MODIFY] `src/app/api/admin/gems/route.test.ts`
- [MODIFY] `src/app/api/admin/personas/route.ts`
- [NEW] `src/app/api/admin/personas/route.test.ts`
- [MODIFY] `src/app/api/admin/rank-configs/route.ts`
- [MODIFY] `src/app/api/admin/rank-configs/route.test.ts`
- [MODIFY] `src/app/api/local-llm/health/route.ts`
- [MODIFY] `src/app/api/local-llm/health/route.test.ts`

#### Domain Features — IDOR, Messages, Projects, Chunking & Store

- [MODIFY] `src/lib/features/chat/conversations.ts`
- [MODIFY] `src/lib/features/chat/conversations.test.ts`
- [MODIFY] `src/lib/features/gems/gems.ts`
- [MODIFY] `src/lib/features/gems/gems.test.ts`
- [MODIFY] `src/lib/features/personas/personas.ts`
- [MODIFY] `src/lib/features/personas/personas.test.ts`
- [MODIFY] `src/lib/features/chat/messages.ts`
- [MODIFY] `src/lib/features/chat/messages.test.ts`
- [MODIFY] `src/lib/features/projects/projects.server.ts`
- [MODIFY] `src/lib/features/projects/projects.server.test.ts`
- [MODIFY] `src/lib/features/projects/chunking.ts`
- [NEW] `src/lib/features/projects/chunking.test.ts`
- [MODIFY] `src/lib/store/projectStore.ts`
- [NEW] `src/lib/store/projectStore.test.ts`

#### Image Routes, Messages API, Stored File Safety, XSS UI, Rate-Limit Spoofing & Cron

- [MODIFY] `src/app/api/generate-image/route.ts`
- [MODIFY] `src/app/api/generate-image/route.test.ts`
- [MODIFY] `src/app/api/edit-image/route.ts`
- [MODIFY] `src/app/api/edit-image/route.test.ts`
- [MODIFY] `src/app/api/edit-image-multi/route.ts`
- [MODIFY] `src/app/api/edit-image-multi/route.test.ts`
- [MODIFY] `src/app/api/messages/route.ts`
- [MODIFY] `src/app/api/messages/route.test.ts`
- [MODIFY] `src/app/features/gallery/components/GalleryView.tsx`
- [MODIFY] `src/app/features/image-gen/components/Canvas.tsx`
- [MODIFY] `src/app/features/image-gen/components/ImageLightbox.tsx`
- [MODIFY] `src/lib/features/files/fileValidation.ts`
- [MODIFY] `src/lib/features/files/fileValidation.test.ts`
- [MODIFY] `src/lib/features/files/fileService.server.ts`
- [MODIFY] `src/lib/features/files/fileService.server.test.ts`
- [MODIFY] `src/app/api/gems/route.ts`
- [MODIFY] `src/app/api/gems/route.test.ts`
- [MODIFY] `src/app/api/personas/route.ts`
- [MODIFY] `src/app/api/personas/route.test.ts`
- [MODIFY] `src/app/api/cron/cleanup/route.ts`
- [MODIFY] `src/app/api/cron/cleanup/route.test.ts`

#### Chat Streaming Core, Providers & Conversations Zod v4

- [MODIFY] `src/app/api/chat-stream/streaming/utils.ts`
- [NEW] `src/app/api/chat-stream/streaming/utils.test.ts`
- [MODIFY] `src/app/api/chat-stream/chatStreamCore.ts`
- [NEW] `src/app/api/chat-stream/chatStreamCore.test.ts`
- [MODIFY] `src/app/api/chat-stream/contextBuilder.ts`
- [MODIFY] `src/app/api/chat-stream/contextBuilder.test.ts`
- [MODIFY] `src/app/api/chat-stream/chatStreamHelpers.ts`
- [NEW] `src/app/api/chat-stream/chatStreamHelpers.test.ts`
- [MODIFY] `src/app/api/chat-stream/attachmentProcessor.ts`
- [MODIFY] `src/app/api/chat-stream/attachmentProcessor.test.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/openai-stream.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/openai-stream.test.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/anthropic-stream.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/anthropic-stream.test.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/deepseek-stream.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/deepseek-stream.test.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/strata-stream.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/strata-stream.test.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/gemini-stream.ts`
- [MODIFY] `src/app/api/chat-stream/streaming/gemini-stream.test.ts`
- [MODIFY] `src/app/api/conversations/route.ts`
- [MODIFY] `src/app/api/conversations/route.test.ts`

#### Living Documentation

- [MODIFY] `docs/security.md`
- [MODIFY] `docs/lessons-learned.md`
- [MODIFY] `docs/CHANGELOG.md`

_(Không có file `[DELETE]` trong Wave 1.)_

---

### 6. Caller-First Design Sketch

#### 6.1 Shared Redis & Atomic Sliding-Window Rate Limiter (`redis.server.ts`, `rateLimit.ts`)

```typescript
// src/lib/core/redis.server.ts
export function getSharedRedis(): Redis | null;
export function resetSharedRedisForTests(): void; // Test-only singleton reset

// src/lib/core/rateLimit.ts — Single atomic Lua script (1 RTT):
// KEYS[1] = "rl:<key>"
// ARGV = [nowMs, windowMs, limit, member, ttlSeconds]
// 1. ZREMRANGEBYSCORE KEYS[1] 0 (nowMs - windowMs)
// 2. count = ZCARD KEYS[1]
// 3. If count >= limit -> DO NOT ZADD (prevents lockout extension!), read oldest via ZRANGE KEYS[1] 0 0 WITHSCORES
//    return { 0, count, oldestScore }
// 4. Else -> ZADD KEYS[1] nowMs member; EXPIRE KEYS[1] ttlSeconds; read oldest via ZRANGE KEYS[1] 0 0 WITHSCORES
//    return { 1, count + 1, oldestScore }
```

- Caller `consumeRateLimit(key)` giữ nguyên return type `Promise<RateLimitResult>`.
- Bọc `r.eval<[number, number, number, string, number], [number, number, number | string]>(...)` trong `try/catch`; nếu Upstash lỗi mạng/timeout ➔ log `warn` và failover sang `consumeInMemory(key, cfg)`.
- Trong `consumeInMemory`, nếu `memStore.size >= MAX_MEM_STORE_ENTRIES` khi chèn key mới ➔ xóa mục cũ nhất ngay (tránh OOM giữa 2 chu kỳ `CLEANUP_INTERVAL_MS`).

#### 6.2 AES-256-GCM Strict Auth Tag & Plaintext Fail-Closed (`encryption.ts`, `envValidation.ts`, `messages.ts`)

```typescript
// src/lib/core/encryption.ts
const GCM_IV_LENGTH = 12;
const GCM_AUTH_TAG_LENGTH = 16;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;

// encryptText:
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
  authTagLength: GCM_AUTH_TAG_LENGTH,
});

// decryptText (Format 1 - GCM):
// Validate parts[0].length === 24 && HEX_PATTERN.test(parts[0])
// Validate parts[1].length === 32 && HEX_PATTERN.test(parts[1])
// Validate parts[2].length % 2 === 0 && (parts[2].length === 0 || HEX_PATTERN.test(parts[2]))
// Validate iv.length === 12 && authTag.length === 16
const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, {
  authTagLength: GCM_AUTH_TAG_LENGTH,
});
decipher.setAuthTag(authTag);
```

- `src/lib/utils/envValidation.ts:32`: Đổi thành `z.string().regex(/^[0-9a-fA-F]{64}$/, "DATA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")`; catch block (`:159-173`) kiểm tra `if (error instanceof z.ZodError)` trước khi đọc `error.issues`, nếu không phải `ZodError` thì rethrow lỗi gốc an toàn.
- `src/lib/features/chat/messages.ts`: Tạo helper nội bộ `encryptRequiredText(text: string): string` — nếu `text.length > 0`, gọi `encryptText(text)`; nếu throw hoặc trả chuỗi rỗng ➔ log `error` và `throw new AppError("Failed to encrypt message", 500, "ENCRYPTION_ERROR")`. Áp dụng cho `encryptMetaReasoning`, `saveMessage`, và `upsertMessage`.
- `deleteLastAssistantMessage(userId, conversationId)` (`src/lib/features/chat/messages.ts:366-387`): Truy vấn `conversations` bằng `.select("id, user_id").eq("id", conversationId).maybeSingle()` (KHÔNG lọc `.eq("user_id", userId)` để phân biệt được 403 vs không tồn tại):
  - Nếu `convError` ➔ `throw new DatabaseError(...)`;
  - Nếu `!conv` ➔ `return` (conversation không tồn tại, idempotent);
  - Nếu `conv.user_id !== userId` ➔ `throw new ForbiddenError("You do not have permission to delete messages in this conversation")` (khớp `TC-W1-02`);
  - Tiếp theo đọc tin nhắn assistant cuối cùng (check `{ error }` ➔ `DatabaseError`), ghi tombstone nếu có `clientMessageId`, và kiểm tra `{ error }` trên mọi lệnh `.delete()` trong `src/lib/features/chat/messages.ts` để ném `DatabaseError` khi thất bại.

#### 6.3 Cross-Tenant IDOR Guards (`conversations.ts`, `gems.ts`, `personas.ts`)

```typescript
// src/lib/features/chat/conversations.ts — internal helpers:
async function assertGemAccessible(
  supabase: SupabaseClient,
  userId: string,
  gemId: string
): Promise<void>;
// SELECT id, user_id, is_premade FROM gems WHERE id = gemId -> !row => NotFoundError("Gem"); !is_premade && user_id !== userId => ForbiddenError()

async function assertPersonaAccessible(
  supabase: SupabaseClient,
  userId: string,
  personaId: string
): Promise<void>;
// SELECT id, user_id, is_premade FROM personas WHERE id = personaId -> !row => NotFoundError("Persona"); !is_premade && user_id !== userId => ForbiddenError()

async function assertProjectOwned(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<void>;
// SELECT id, user_id FROM projects WHERE id = projectId -> !row => NotFoundError("Project"); user_id !== userId => ForbiddenError()
```

- Gọi trước khi mutate trong `doSaveConversation` (`projectId`, `gemId`), `setConversationGem`, `setConversationPersona`, `setConversationProject`.
- `src/lib/features/gems/gems.ts:162-212` (`getGemInstructionsForConversation`): Truy vấn bảng `gems` lấy `id, user_id, is_premade, instruction, instructions` TRƯỚC khi gọi `tryGetLatestGemVersion(supabase, gemId)`; nếu `!gem` trả `""`, nếu `!gem.is_premade && gem.user_id !== userId` throw `ForbiddenError()`.
- `src/lib/features/gems/gems.ts:245-258` (`getGemsForUser`): Xóa hoàn toàn `q2` (`supabase.from("gems").select("*")`); nếu cả `q` (snake_case/camelCase) lẫn `q1` lỗi ➔ `throw new DatabaseError(...)` (không lưu Redis cache).
- `src/lib/features/personas/personas.ts:72-84` (`getPersonasForUser`): Thay `.or(...)` bằng:
  ```typescript
  const [premadeRes, ownRes] = await Promise.all([
    supabase.from("personas").select("*").eq("is_premade", true),
    supabase.from("personas").select("*").eq("user_id", userId),
  ]);
  ```
  Nếu một trong hai trả `error` ➔ `throw new DatabaseError(...)`. Gộp qua `Map<string, PersonaRow>` theo `id`, rồi sort ổn định: `is_premade` (`true` trước) rồi `name.localeCompare` tăng dần.
- `updatePersona` (`:132-134`) & `deletePersona` (`:168-179`): Chọn thêm `is_premade` trong `deletePersona`, kiểm tra `if (existingRow.is_premade) throw new ForbiddenError("Cannot modify premade persona")` / `"Cannot delete premade persona"` trước khi check `user_id !== userId`.
- `getPersonaInstructionsForConversation` (`:231`): Sau khi lấy `personaRow`, kiểm tra `if (!personaRow.is_premade && personaRow.user_id !== userId) throw new ForbiddenError();`.

#### 6.4 Admin RBAC, Auth Fail-Closed & Gatekeeper (`requireApprovedUser.ts`, `authRevocation.ts`, `auth.ts`, `useAuthGate.ts`, `projects.server.ts`)

```typescript
// src/lib/features/auth/requireApprovedUser.ts
export interface AdminUser {
  userId: string;
  rank: "admin";
}

export async function requireAdminUser(): Promise<AdminUser> {
  const userId = await getUserId(); // 401 UnauthorizedError
  const profile = await getUserProfileStrict(userId); // 503 ServiceUnavailableError on DB failure
  if (!profile) throw new ForbiddenError("Admin access required");
  if (profile.is_blocked) throw new UserBlockedError();
  if (profile.rank !== "admin") throw new ForbiddenError("Admin access required");
  return { userId, rank: "admin" };
}
```

- **Tất cả 6 route `/api/admin/*`**: Gọi `const admin = await requireAdminUser();` ở đầu mỗi handler thay cho `session.user.rank !== "admin"`.
- **`PATCH /api/admin/users`** (`src/app/api/admin/users/route.ts:118-127`): Sau khi tìm `targetProfile`, kiểm tra:
  ```typescript
  if (
    targetProfile.id.toLowerCase() === admin.userId ||
    targetProfile.email?.toLowerCase() === admin.userId
  ) {
    throw new ForbiddenError("Cannot modify your own admin account");
  }
  ```
- **`src/lib/features/auth/authRevocation.ts`**:

  ```typescript
  export type RefreshTokenResult =
    | { status: "ok"; rank: string; isBlocked: boolean; userId: string }
    | { status: "not_found" }
    | { status: "error" };

  export async function refreshTokenFromDBDetailed(email: string): Promise<RefreshTokenResult>;
  ```

- **`src/lib/features/auth/auth.ts`**:
  - `signIn` (`:97-107`): Nếu `insertError?.code === "23505"` (concurrent first sign-in race), re-select profile theo `email`; nếu tìm thấy và `!existing.is_blocked` ➔ return `true`, nếu blocked hoặc lỗi ➔ return `false`.
  - `jwt` (`:172-184`): Gọi `refreshTokenFromDBDetailed(email)`:
    - `status === "ok"`: cập nhật `rank`, `userId`, `rankVersion`, `rankRefreshedAt` (hoặc trả `{ blocked: true }` nếu `isBlocked`).
    - `status === "not_found"`: tài khoản đã bị xóa ➔ fail-closed trả `{ blocked: true }`.
    - `status === "error"`: lỗi DB tạm thời — KHÔNG cập nhật `rankRefreshedAt`, và nếu `token.rank === "admin"` hoặc quá ngưỡng stale tối đa (`MAX_STALE_ERROR_MS = 5 * 60 * 1000`) ➔ hạ đặc quyền / fail-closed (xóa `token.rank = "not_whitelisted"` cho admin bị mất kết nối xác minh, giữ fail-safe tuyệt đối cùng lớp `requireAdminUser()` trên server).
  - `session` (`src/lib/features/auth/auth.ts:190-195`): Khi `token.blocked`, trả `{ ...session, user: { id: "", rank: "__blocked__", email: undefined, name: undefined, image: undefined } }` — vừa khớp hoàn toàn khai báo bắt buộc `Session["user"]["id"]: string` tại `src/types/next-auth.d.ts:5-10`, vừa loại bỏ `email`/`name`/`image` và đặt `id = ""` để cả `getUserId()` (`!session?.user?.email`) lẫn các route check `!session?.user?.id || !session?.user?.email` đều fail-closed 401 ngay lập tức.
- **`src/app/features/chat/components/hooks/useAuthGate.ts:20-36`**: Thêm `const isBlocked = session?.user?.rank === "__blocked__";` và đổi dòng 34 thành `if (!isAuthLoading && !isAuthed && !isBlocked) void signIn();`.
- **`src/lib/features/projects/projects.server.ts:42-60` (`getUserTier`)**: Select `"rank, is_blocked"`, throw `ServiceUnavailableError` khi DB lỗi, throw `AccessPendingError` khi `!data || !data.rank`, throw `UserBlockedError` khi `data.is_blocked === true`, map `admin`/`pro`/`basic`, và throw `AccessPendingError` với `not_whitelisted` hoặc mọi rank không hợp lệ khác.

#### 6.5 Gemini Context Cache, Image Routes, XSS & Stored Files

- **`src/lib/core/contextCache.ts`**:
  - `CompositeCacheConfig` thêm `userId: string`; bên trong `getOrCreateCompositeCache` bổ sung guard fail-closed `if (!config.userId?.trim()) return null;`.
  - Cập nhật hàm deprecated `getOrCreateSystemCache(model: string, systemInstruction: string, userId: string, ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS)` (`src/lib/core/contextCache.ts:282-288`) nhận thêm `userId: string` và truyền `{ userId, model, systemInstruction }` vào `getOrCreateCompositeCache` để đảm bảo biên dịch `tsc --noEmit` sạch (đã xác minh 0 caller ngoài gọi `getOrCreateSystemCache`).
  - `hashString(str)` dùng `crypto.createHash("sha256").update(str).digest("hex").slice(0, 32)` (128-bit cryptographic digest, không va chạm).
  - `buildCompositeCacheKey`: `comp:${hashString(config.userId)}:${config.model}:${sysHash}:${toolsHash}:${toolConfigHash}`.
  - Định nghĩa helper nội bộ dùng chung `setBoundedCache(cacheKey: string, name: string, expiresAt: number, now: number): void` với trần cứng `MAX_ACTIVE_CACHES = 500` (chạy lazy eviction mục hết hạn trước; nếu vẫn `>= 500` và `!activeCacheNames.has(cacheKey)` thì evict mục cũ nhất/hết hạn sớm nhất trước khi `set`). Gọi `setBoundedCache(...)` ở **CẢ HAI** nhánh: `getOrCreateCompositeCache` (`src/lib/core/contextCache.ts:168`) **VÀ** `getOrCreateKBCache` (`src/lib/core/contextCache.ts:260`).
  - Tại `src/app/api/chat-stream/chatStreamCore.ts:673-689`: chỉ gọi `getOrCreateCompositeCache` khi `ragSources.length === 0`, và truyền `userId` từ `sharedParams`.
- **Image Model Allowlists (`src/lib/utils/constants.ts`)**:

  ```typescript
  export const ALLOWED_GENERATE_IMAGE_MODELS = [
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
    "gemini-3-pro-image-preview",
    "black-forest-labs/flux-schnell",
    "gpt-image-2",
    "dall-e-3",
  ] as const;

  export const ALLOWED_EDIT_IMAGE_MODELS = [
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
    "gemini-3-pro-image-preview",
  ] as const;
  ```

  - `generate-image`: Validate `options.model` qua `z.enum(ALLOWED_GENERATE_IMAGE_MODELS).optional()`. Trước khi gọi enhancer, `await assertModelAllowedForUser(userId, enhancerModelId)` (ném `ForbiddenError` 403 ra ngoài `try/catch` của enhancer — KHÔNG nuốt lỗi 403 thành `enhancerFailed = true`!), và nếu `isByok` thì khởi tạo `new GoogleGenAI({ apiKey })` thay vì dùng server key `getGenAIClient()`. Bọc `saveMessage` (`src/app/api/generate-image/route.ts:364`) và cleanup mồ côi với guard `if (storagePath) { await supabase.storage.from(bucket).remove([storagePath]).catch(...); }` nếu `saveMessage` throw hoặc trả `null`.
  - `edit-image`: Import `ALLOWED_EDIT_IMAGE_MODELS` ngay dòng 20, validate `options.model` tại dòng 30 (**giữ nguyên `export const maxDuration = 60;` ở đúng dòng 36**), cleanup `storagePath` (`supabase.storage.from(bucket).remove([storagePath])`) nếu `saveMessage` lỗi/null.
  - `edit-image-multi`: Validate `options.model` qua `z.enum(ALLOWED_EDIT_IMAGE_MODELS).optional()`; đồng bộ chiều gửi lên Gemini tại `src/app/api/edit-image-multi/route.ts:137-139` sang camelCase `imagePart.thoughtSignature = turn.thoughtSignature;` (khớp `src/app/api/chat-stream/streaming/thought-signatures.ts:33,207`); khi `!Array.isArray(candidates) || candidates.length === 0` (`src/app/api/edit-image-multi/route.ts:252-262`), kiểm tra `(response as { promptFeedback?: { blockReason?: string } })?.promptFeedback?.blockReason` (nếu có ➔ `ValidationError` safety filter) thay vì đọc `candidates[0]` vốn luôn `undefined`; đọc response với `p.thoughtSignature ?? p.thought_signature` (`src/app/api/edit-image-multi/route.ts:287-296`); cleanup `storagePath` nếu `saveMessage` lỗi/null.

- **Cron Cleanup Security (`src/app/api/cron/cleanup/route.ts`)**:
  - Giữ nguyên `export const maxDuration = 60;` ở chính xác dòng 9 (`src/app/api/cron/cleanup/route.ts:9`); thêm `import crypto from "crypto";` và `import { error } from "@/lib/utils/apiResponse";` từ dòng 11 trở xuống.
  - `verifyCronSecret`: tạo helper `constantTimeEqual(a: string, b: string)` băm SHA-256 cho cả 2 chuỗi rồi so sánh `crypto.timingSafeEqual(digestA, digestB)` (tránh lộ độ dài secret và tránh `RangeError` của `timingSafeEqual` khi khác độ dài); kiểm tra `constantTimeEqual(provided, expected) || constantTimeEqual(provided, \`Bearer ${expected}\`)`.
  - **Contract 401 vs 500**: Giữ nguyên dòng 27 `return NextResponse.json({ error: "Unauthorized" }, { status: 401 });` (tương thích hoàn toàn scheduler & 3 test `src/app/api/cron/cleanup/route.test.ts:65,76,90`, không rò rỉ dữ liệu); đổi dòng 54 trong nhánh `catch` sang `return error("Cleanup failed", 500);` để không bao giờ lộ `err.message`.
- **XSS, `/api/messages` & Stored File Safety**:
  - `src/lib/utils/xssProtection.ts`:
    ```typescript
    const SAFE_DATA_IMAGE_REGEX =
      /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/i;
    export function isValidImageUrl(url: unknown): boolean; // http/https via URL parser, OR SAFE_DATA_IMAGE_REGEX
    export function openSafeExternalUrl(url: unknown): boolean; // if (!isValidUrl(url)) return false; window.open(url, "_blank", "noopener,noreferrer"); return true;
    ```
  - `src/app/api/messages/route.ts:17-48`: Bỏ `.passthrough()`. Khai báo chặt `content: z.string().max(500_000)` và `meta` chỉ cho phép `isPartial`, `aborted`, `status`, `model` (`max(120)`), `clientMessageId` (`max(128)`), `emptyAnswerReason` (`enum(["length", "no_content"])`), `reasoning` (`max(200_000)`), `thinkingStats` (`{ tokens: number, elapsedMs: number }`), `sources` (`array({ uri: string.refine(isValidUrl), title: string.max(500) }).max(100)`), `urlContext` (`array({ retrievedUrl: string.refine(isValidUrl), status: string.max(100) }).max(100)`), `ragSources` (`array({ filename, documentId, chunkId, similarity }).max(50)`).
  - `src/app/features/image-gen/components/Canvas.tsx:141-152` & `src/app/features/image-gen/components/ImageLightbox.tsx:190-201`: Kiểm tra `if (!response.ok) throw new Error(...)`, hoãn `setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)`, và thay `window.open(..., "_blank")` bằng `openSafeExternalUrl(...)`. `src/app/features/gallery/components/GalleryView.tsx:422` thay bằng `openSafeExternalUrl(g.selectedImage!.url)`.
  - `src/lib/features/files/fileValidation.ts` & `src/lib/features/files/fileService.server.ts`:
    - `src/lib/features/files/fileValidation.ts:217`: `if (Object.hasOwn(EXT_MIME_MAP, ext)) return EXT_MIME_MAP[ext];`.
    - `src/lib/features/files/fileValidation.ts:414-451`: Ném `ValidationError` thay vì `Error`; đọc magic bytes bằng `const headerBuf = new Uint8Array(await file.slice(0, 16).arrayBuffer());`.
    - `src/lib/features/files/fileService.server.ts`: Định nghĩa `ACTIVE_WEB_MIMES = new Set(["image/svg+xml", "text/html", "application/xhtml+xml", "text/xml", "application/xml"])`. Khi `uploadFile` upload lên Supabase Storage (`src/lib/features/files/fileService.server.ts:185-188`), nếu `ACTIVE_WEB_MIMES.has(v.mime.toLowerCase())` thì ghi `contentType: "text/plain; charset=utf-8"`. Khi `createSignedUrl` (`src/lib/features/files/fileService.server.ts:402-404`), nếu `ACTIVE_WEB_MIMES.has((row.mime_type || "").toLowerCase())` thì truyền `{ download: row.filename }`.

#### 6.6 API Response, Streaming Reliability, Chunking $O(N)$ & Zustand v5

- **`src/lib/utils/errors.ts:170-185`**:
  - Bổ sung chính xác **10 regex provider/service env keys** vào `envVarPatterns` (giữ nguyên toàn bộ pattern hiện có và không làm vỡ bất kỳ assertion nào trong `src/lib/utils/errors.test.ts`):
    `/ANTHROPIC_API_KEY/gi`, `/DEEPSEEK_API_KEY/gi`, `/OPENROUTER_API_KEY/gi`, `/GROQ_API_KEY/gi`, `/LLAMA3_API_KEY/gi`, `/OPENAI_API_KEY/gi`, `/REPLICATE_API_TOKEN/gi`, `/CRON_SECRET/gi`, `/ATTACHMENTS_CRON_SECRET/gi`, `/STRATA_API_KEY/gi`.
- **`src/lib/utils/apiResponse.ts`**:
  - `error(...)`: Trải `...(metadata || {})` TRƯỚC `message` và `code` để `metadata` không thể ghi đè.
  - `errorFromAppError(appError)`: Nếu `appError instanceof RateLimitError`, ủy quyền `rateLimitError(sanitizeError(appError, isProd), appError.retryAfterSeconds)`. Ngược lại, build `NextResponse.json` trực tiếp với `message: sanitizeError(appError, isProd)` (KHÔNG gọi lại `error(sanitizedMessage, ...)` vì `error()` bọc string vào `new Error()` khiến `sanitizeError` mất nhánh `instanceof AppError` và xóa nát thông điệp nghiệp vụ trong production!).
- **`src/app/api/chat-stream/streaming/utils.ts`**:
  - Hoist `const textEncoder = new TextEncoder();` lên module scope.
  - `withTimeout<T>(promise, timeoutMs)`: lưu `timer`, bọc `Promise.race` bằng `try/finally { clearTimeout(timer); }`.
  - `withIdleTimeout<T>(stream, idleMs)`: Mỗi vòng lặp tạo `nextPromise = iterator.next()` và `idlePromise` kèm timer riêng; trong `try/finally` luôn `clearTimeout(timer)` ngay khi `Promise.race` xong; nếu `idlePromise` thắng trước khi `nextPromise` settle thì gắn `nextPromise.catch(() => {})` để triệt tiêu `UnhandledPromiseRejection`, và trong `finally` của generator gọi `await iterator.return?.().catch(() => {})` để đóng kết nối SDK upstream!
- **`src/app/api/chat-stream/chatStreamCore.ts`**:
  - Xóa khởi tạo `getGenAIClient()` ở đầu `handleChatStreamCore` (`:94-101`). Khởi tạo `getGenAIClient()` chỉ bên trong nhánh Gemini của `createProviderStream` (trả 500 `AI_SERVICE_ERROR` nếu thiếu `GEMINI_API_KEY`).
  - Trong `createProviderStream` (`:535-607`), kiểm tra `if (isClaude && process.env.ANTHROPIC_API_KEY)` TRƯỚC nhánh `else if (isClaude)` dùng OpenRouter, giúp Direct Anthropic Claude hoạt động ngay cả khi `OPENROUTER_API_KEY` chưa đặt.
- **5 Streaming Providers**:
  - `src/app/api/chat-stream/streaming/openai-stream.ts:441`, `src/app/api/chat-stream/streaming/anthropic-stream.ts:547`, `src/app/api/chat-stream/streaming/deepseek-stream.ts:395`, `src/app/api/chat-stream/streaming/strata-stream.ts:473`: Đổi `if (!streamFailed || full.trim() || fullReasoning.trim())` thành `if (!streamFailed)` (vì `catch` đã gọi `savePartialOnce()`).
  - `src/app/api/chat-stream/streaming/anthropic-stream.ts:110-131`: Import & gọi `sendInitialMetaEvents` và `generateAndSendOptimisticTitle` từ `./gemini-stream` (đồng nhất schema với OpenAI/DeepSeek/Gemini).
  - `src/app/api/chat-stream/streaming/deepseek-stream.ts:349-370`: Tách rõ `isRateLimit = err.status === 429` và `isTokenLimit = err.status === 413 || /context_length_exceeded|maximum context length/i.test(errorMessage)`; gán `code` bằng chuỗi `if / else if`: `isInsufficientBalance` → `"insufficient_balance"`, `else if (isRateLimit)` → `"rate_limit_exceeded"`, `else if (isTokenLimit)` → `"token_limit_exceeded"`.
  - `src/app/api/chat-stream/streaming/gemini-stream.ts`:
    - Bổ sung import `withIdleTimeout` từ `./utils` tại `src/app/api/chat-stream/streaming/gemini-stream.ts:19`.
    - Ngay sau `const timeoutMs = getStreamTimeout(model, effectiveThinkingLevel);` (`src/app/api/chat-stream/streaming/gemini-stream.ts:204`), tính `const idleTimeoutMs = Math.max(timeoutMs / 2, 30_000);` (cùng quy ước chuẩn với `src/app/api/chat-stream/streaming/openai-stream.ts:275`).
    - Bọc toàn bộ vòng `for await (const chunk of withIdleTimeout(stream, idleTimeoutMs))` (`src/app/api/chat-stream/streaming/gemini-stream.ts:272-480`) trong khối `try/catch (streamErr: unknown)`: nếu `streamErr instanceof StreamTimeoutError`, log timeout, phát đúng 1 event SSE `sendEvent(controller, "error", { message: ..., code: "STREAM_TIMEOUT", isTimeout: true })`, rồi rethrow `streamErr` (mọi lỗi khác cũng rethrow lên `runStreamWithFallback`).
    - Trong nhánh continuation (`src/app/api/chat-stream/streaming/gemini-stream.ts:466-477`), bọc `for await (const contChunk of withIdleTimeout(contStream, idleTimeoutMs))` và trong `catch (contErr: unknown)` (`:475-477`) thêm `if (contErr instanceof StreamTimeoutError) throw contErr;` để timeout continuation lan ra khối `try/catch` ngoài, phát `STREAM_TIMEOUT` và KHÔNG bị nuốt thành `done { ok: true }`.
    - Xử lý `part.executableCode` và `part.codeExecutionResult` trong vòng `parts` (`src/app/api/chat-stream/streaming/gemini-stream.ts:284-316`).
    - Trong `runStreamWithFallback` (`src/app/api/chat-stream/streaming/gemini-stream.ts:631-693`), giữ nguyên rethrow tức thì cho `StreamTimeoutError` (`:632`), đưa nhánh `!Array.isArray(tools) || tools.length === 0` ra NGOÀI khối `try/catch` của fallback để không emit 2 sự kiện `error` SSE, và trong `catch (err2)` (`:682-693`) thêm `if (err2 instanceof StreamTimeoutError || abortSignal?.aborted) throw err2;` tránh phát trùng lỗi khi nhánh fallback cũng gặp timeout.
    - Trong `createChatReadableStream` khối `catch (err)` (`src/app/api/chat-stream/streaming/gemini-stream.ts:892-898`), gọi vô điều kiện `await savePartialOnce();` (đồng nhất với 4 provider còn lại — `savePartialOnce()` là idempotent và tự bỏ qua nếu `acc.full`/`acc.reasoning` rỗng) TRƯỚC khi phát `sendEvent(controller, "done", { ok: false })`, đảm bảo không mất nội dung partial khi xảy ra idle timeout hoặc lỗi giữa stream.
- **`src/lib/features/projects/chunking.ts`**:
  - Tạo helper `buildLineStartOffsets(text: string): number[]` ($O(N)$) và `offsetToLine(lineStarts, charPos): number` ($O(\log L)$ binary search) — thay hoàn toàn `fullText.slice(0, startChar).split("\n").length` ($O(N^2)$).
  - Thay `normalizedText.split(/\n\n+/)` + cộng cứng `+ 2` (`src/lib/features/projects/chunking.ts:48,78`) bằng quét offset thực tế theo match regex (duyệt `normalizedText.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)` hoặc lưu độ dài thực của từng separator `\n\n+`) để mỗi đoạn mang chính xác `{ text, startChar, endChar }` ngay cả khi ngăn cách bằng `\n\n\n`+, đảm bảo `line_start`/`line_end` luôn đúng 100%.
  - Hard-split bất kỳ đoạn văn bản đơn lẻ (hoặc khối code không có breakpoint) nào dài hơn `opts.maxChunkSize` theo bước `step = Math.max(1, opts.maxChunkSize - effectiveOverlap)` (bảo đảm `effectiveOverlap < opts.maxChunkSize`).
  - Bảo toàn tail chunk `< minChunkSize`: nếu đã có chunk trước đó và phần đuôi thực tế chứa nội dung mới vượt ngoài overlap ➔ gộp vào chunk cuối (nếu không vượt quá ngưỡng `maxChunkSize + minChunkSize`) hoặc emit thành chunk cuối riêng biệt (tuyệt đối KHÔNG bỏ rơi dữ liệu cuối tài liệu!).
  - `getChunkingStrategy(filename)`: Kiểm tra `const dotIdx = filename.lastIndexOf("."); if (dotIdx <= 0 || dotIdx === filename.length - 1) return "text";`.
- **`src/lib/store/projectStore.ts`**:
  - Helper `parseApiResponse<T>(res: Response, fallbackMsg: string): Promise<T>`: kiểm tra `let json; try { json = await res.json(); } catch { throw new Error(res.ok ? fallbackMsg : `${fallbackMsg} (HTTP ${res.status})`); }`, kiểm tra `!res.ok || !json?.success`.
  - `createProject`: cập nhật `limits: state.limits ? { ...state.limits, currentProjects: state.limits.currentProjects + 1 } : state.limits`.
  - `deleteProject`: cập nhật `limits: state.limits ? { ...state.limits, currentProjects: Math.max(0, state.limits.currentProjects - 1) } : state.limits`.
  - `useCurrentProject`: dùng targeted selector `useProjectStore((s) => (s.currentProjectId ? (s.projects.find((p) => p.id === s.currentProjectId) ?? null) : null))`.
  - `useProjectLimits`: import `useShallow` from `"zustand/react/shallow"` và dùng `useProjectStore(useShallow((state) => ({ tier: state.tier, limits: state.limits })))`.

---

### 7. Các Bước Thực Hiện Tuần Tự (Implementation Steps)

#### Phase 1 — Foundation (`redis.server`, `rateLimit`, `constants`, `errors`, `apiResponse`, `xssProtection`)

- [ ] **Step 1.1**: Tạo `src/lib/core/redis.server.ts` (`getSharedRedis()`, `resetSharedRedisForTests()`) + viết `src/lib/core/redis.server.test.ts`.
- [ ] **Step 1.2**: Cập nhật `src/lib/core/rateLimit.ts` dùng `getSharedRedis()`, Lua sliding-window nguyên tử 1 RTT (`redis.eval`), `try/catch` failover sang memory và ép trần `MAX_MEM_STORE_ENTRIES` ngay trong `consumeInMemory` + viết `src/lib/core/rateLimit.test.ts`.
- [ ] **Step 1.3**: Thêm `ALLOWED_GENERATE_IMAGE_MODELS` & `ALLOWED_EDIT_IMAGE_MODELS` vào `src/lib/utils/constants.ts`.
- [ ] **Step 1.4**: Bổ sung 10 provider/service env patterns (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `LLAMA3_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `CRON_SECRET`, `ATTACHMENTS_CRON_SECRET`, `STRATA_API_KEY`) vào `src/lib/utils/errors.ts` + cập nhật `src/lib/utils/errors.test.ts`.
- [ ] **Step 1.5**: Sửa `errorFromAppError` (không double-sanitize, bảo toàn `Retry-After`) và thứ tự spread `metadata` trong `src/lib/utils/apiResponse.ts` + tạo `src/lib/utils/apiResponse.test.ts`.
- [ ] **Step 1.6**: Khóa `isValidImageUrl` chỉ nhận raster base64 & thêm `openSafeExternalUrl()` trong `src/lib/utils/xssProtection.ts` + cập nhật `src/lib/utils/xssProtection.test.ts`.

#### Phase 2 — Group A Security Fixes (IDOR, Crypto, Context Cache, Auth/Admin RBAC, Image/File/Cron)

- [ ] **Step 2.1**: Bổ sung `assertGemAccessible`, `assertPersonaAccessible`, `assertProjectOwned` vào `src/lib/features/chat/conversations.ts` (`doSaveConversation`, `setConversationGem`, `setConversationPersona`, `setConversationProject`) + cập nhật `src/lib/features/chat/conversations.test.ts`.
- [ ] **Step 2.2**: Sửa `getGemInstructionsForConversation` (owner/premade check trước `gem_versions`) và xóa nhánh `q2` fail-open trong `src/lib/features/gems/gems.ts` + cập nhật `src/lib/features/gems/gems.test.ts`.
- [ ] **Step 2.3**: Sửa `getPersonaInstructionsForConversation` (owner/premade check), thay `.or()` bằng 2 truy vấn `.eq()` `Promise.all` trong `getPersonasForUser`, và chặn mutate premade trong `updatePersona`/`deletePersona` tại `src/lib/features/personas/personas.ts` + cập nhật `src/lib/features/personas/personas.test.ts` (Triage Loại B + tests mới).
- [ ] **Step 2.4**: Ép `{ authTagLength: 16 }` và xác thực hex/độ dài nghiêm ngặt trong `src/lib/core/encryption.ts` + cập nhật `src/lib/core/encryption.test.ts`; siết 64-char hex & `instanceof z.ZodError` trong `src/lib/utils/envValidation.ts` + tạo `src/lib/utils/envValidation.test.ts`.
- [ ] **Step 2.5**: Chuyển `saveMessage`, `upsertMessage`, `encryptMetaReasoning` sang fail-closed, thêm kiểm tra sở hữu trong `deleteLastAssistantMessage`, và kiểm tra `{ error }` trên toàn bộ lệnh `.delete()` trong `src/lib/features/chat/messages.ts` + cập nhật `src/lib/features/chat/messages.test.ts`.
- [ ] **Step 2.6**: Nâng cấp `src/lib/core/contextCache.ts` (SHA-256, `userId` trong `CompositeCacheConfig`, cập nhật `getOrCreateSystemCache` nhận `userId`, và dùng chung `setBoundedCache` trần 500 cho cả `getOrCreateCompositeCache` và `getOrCreateKBCache`) + cập nhật `src/lib/core/contextCache.test.ts` (Triage Loại C + isolation/cap tests cho cả Composite & KB cache).
- [ ] **Step 2.7**: Bổ sung `requireAdminUser()` trong `src/lib/features/auth/requireApprovedUser.ts` + cập nhật `src/lib/features/auth/requireApprovedUser.test.ts`; bổ sung `refreshTokenFromDBDetailed()` trong `src/lib/features/auth/authRevocation.ts` + cập nhật `src/lib/features/auth/authRevocation.test.ts`.
- [ ] **Step 2.8**: Sửa `src/lib/features/auth/auth.ts` (`23505` first-sign-in race, phân biệt `not_found`/`error` khi refresh JWT, trả `{ id: "", rank: "__blocked__", email: undefined, name: undefined, image: undefined }` khi `token.blocked` khớp `src/types/next-auth.d.ts:5-10`) + tạo `src/lib/features/auth/auth.test.ts`; thêm guard `!isBlocked` vào `src/app/features/chat/components/hooks/useAuthGate.ts` + tạo `src/app/features/chat/components/hooks/useAuthGate.test.ts`.
- [ ] **Step 2.9**: Đấu nối `requireAdminUser()` vào cả 6 route `src/app/api/admin/{users,stats,audit-log,gems,personas,rank-configs}/route.ts`, thêm tự bảo vệ admin & 400 JSON trong `PATCH /api/admin/users`, và cập nhật/tạo mới toàn bộ 6 file `route.test.ts` tương ứng (Triage Loại B/C).
- [ ] **Step 2.10**: Chuyển `src/app/api/local-llm/health/route.ts` sang `requireApprovedUser()` + cập nhật `src/app/api/local-llm/health/route.test.ts`; sửa `getUserTier()` trong `src/lib/features/projects/projects.server.ts` + cập nhật `src/lib/features/projects/projects.server.test.ts` (Triage Loại C).
- [ ] **Step 2.11**: Cập nhật 3 route ảnh (`src/app/api/generate-image/route.ts` có guard `if (storagePath)`, `src/app/api/edit-image/route.ts` — **KIỂM TRA GIỮ ĐÚNG DÒNG 36 cho `export const maxDuration = 60;`**, `src/app/api/edit-image-multi/route.ts` đồng bộ camelCase `thoughtSignature` cả 2 chiều gửi/nhận) + cập nhật cả 3 file `route.test.ts` (thêm `remove: mockStorageRemove` vào storage mock ở cả 3 file).
- [ ] **Step 2.12**: Bỏ `.passthrough()` và siết schema trong `src/app/api/messages/route.ts` + cập nhật `src/app/api/messages/route.test.ts`; thay `window.open` bằng `openSafeExternalUrl` và sửa `URL.revokeObjectURL` trong `GalleryView.tsx`, `Canvas.tsx`, `ImageLightbox.tsx`.
- [ ] **Step 2.13**: Sửa `src/lib/features/files/fileValidation.ts` (`ValidationError`, `Object.hasOwn`, `file.slice(0, 16)`) & `src/lib/features/files/fileService.server.ts` (trung hòa SVG/HTML upload sang `text/plain; charset=utf-8` và `{ download: row.filename }` ở `createSignedUrl`) + cập nhật cả 2 file test co-located.
- [ ] **Step 2.14**: Sửa `src/app/api/gems/route.ts` & `src/app/api/personas/route.ts` (auth trước rate-limit theo `userId`, Zod v4 `.issues[0]`, 400 invalid JSON) + cập nhật `gems/route.test.ts` (Triage Loại C) và `personas/route.test.ts`.
- [ ] **Step 2.15**: Sửa `src/app/api/cron/cleanup/route.ts` (constant-time SHA-256 `timingSafeEqual`, giữ 401 `{ error: "Unauthorized" }`, dùng `error("Cleanup failed", 500)` cho nhánh catch 500 — **KIỂM TRA GIỮ ĐÚNG DÒNG 9 cho `export const maxDuration = 60;`**) + cập nhật `src/app/api/cron/cleanup/route.test.ts`.

#### Phase 3 — Group B Core Runtime Fixes (Streaming, Zod v4, Chunking, Zustand v5)

- [ ] **Step 3.1**: Sửa `src/app/api/chat-stream/streaming/utils.ts` (hoist `TextEncoder`, `withTimeout` `clearTimeout`, `withIdleTimeout` chống `UnhandledPromiseRejection` & `iterator.return()`) + tạo `src/app/api/chat-stream/streaming/utils.test.ts`.
- [ ] **Step 3.2**: Sửa `src/app/api/chat-stream/chatStreamHelpers.ts` (guard `decodeURIComponent`) + tạo `src/app/api/chat-stream/chatStreamHelpers.test.ts`; sửa `src/app/api/chat-stream/contextBuilder.ts` (bỏ double-count token & thêm `webSearchAllowed` cho `getWebSearchConfig`) + cập nhật `contextBuilder.test.ts`; sửa `src/app/api/chat-stream/attachmentProcessor.ts` (ưu tiên `priorityFileIds` trước lịch sử mới → cũ) + cập nhật `attachmentProcessor.test.ts`.
- [ ] **Step 3.3**: Sửa 5 stream providers (`openai-stream.ts`, `anthropic-stream.ts`, `deepseek-stream.ts`, `strata-stream.ts`, `gemini-stream.ts` gồm import `withIdleTimeout`, tính `idleTimeoutMs`, bọc `try/catch` phát `STREAM_TIMEOUT` 1 lần + rethrow khỏi `contErr` + `savePartialOnce()` vô điều kiện trong `catch`) và cập nhật toàn bộ 5 file `*.test.ts` tương ứng.
- [ ] **Step 3.4**: Sửa `src/app/api/chat-stream/chatStreamCore.ts` (Zod v4 `.issues[0]`, lazy `getGenAIClient()`, Direct Anthropic Claude ưu tiên trước OpenRouter, ép `limits.features.web_search`, truyền `userId` & skip composite cache khi `ragSources.length > 0`) + tạo `src/app/api/chat-stream/chatStreamCore.test.ts`.
- [ ] **Step 3.5**: Sửa `src/app/api/conversations/route.ts` (Zod v4 `.issues[0]` + 400 invalid JSON cho `POST`/`PATCH`/`DELETE`/`PUT`) + cập nhật `src/app/api/conversations/route.test.ts`.
- [ ] **Step 3.6**: Sửa `src/lib/features/projects/chunking.ts` (bảo toàn tail chunk, hard-split quá khổ, theo dõi offset đoạn bằng regex match + line offset $O(N)$, safe ext lookup) + tạo `src/lib/features/projects/chunking.test.ts`.
- [ ] **Step 3.7**: Sửa `src/lib/store/projectStore.ts` (`useShallow`, targeted `useCurrentProject`, `parseApiResponse`, sync `limits.currentProjects`) + tạo `src/lib/store/projectStore.test.ts`.

#### Phase 4 — Living Docs & Full Verification

- [ ] **Step 4.1**: Cập nhật `docs/security.md`, `docs/lessons-learned.md` (theo Post-Fix Protocol `.agents/skills/vikini-debug/SKILL.md`), và `docs/CHANGELOG.md`.
- [ ] **Step 4.2**: Chạy kiểm định toàn bộ (`npm run type-check; npm run lint; npm run test:run`) và xác minh pin-line `maxDuration` qua `npx vitest run .agents/scripts/code-freeze-guard.test.ts`.

---

### 8. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| Test ID    | Target Module                                                                                                                                        | Input / Boundary Condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Expected Output / Failure Mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Tiêu chí Pass / Fail                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TC-W1-01` | `conversations.ts`, `gems.ts`, `personas.ts`                                                                                                         | User A gắn `gemId`/`personaId`/`projectId` private của User B; hoặc đọc `getGemInstructionsForConversation` / `getPersonaInstructionsForConversation` có bản ghi gắn cross-tenant; hoặc `getGemsForUser` lỗi query `q` & `q1`; hoặc User gọi `updatePersona`/`deletePersona` lên premade persona                                                                                                                                                                                                                                                                                          | Ném `ForbiddenError` (403) / `NotFoundError` (404) và KHÔNG gọi `.update()`/`.insert()`; `getGemsForUser` ném `DatabaseError` (KHÔNG gọi unfiltered `select("*")`, KHÔNG gọi `setCachedGems`); `getPersonasForUser` dùng 2 query `.eq()` song song (0 lần gọi `.or()`), dedup & sort đúng; premade persona bị từ chối với `ForbiddenError`                                                                                                                                                                                                                                                                                                                                                                                                                                | **PASS** nếu mọi hành vi cross-tenant/premade-mutation bị chặn trước khi ghi DB và 0 dữ liệu tenant khác bị trả về.                    |
| `TC-W1-02` | `encryption.ts`, `envValidation.ts`, `messages.ts`                                                                                                   | Auth tag bị cắt ngắn (`4`, `8`, `12`, `15` bytes); non-hex IV/tag; `DATA_ENCRYPTION_KEY` chỉ 32 ký tự non-hex; `encryptText` throw trong `saveMessage`/`upsertMessage`/`encryptMetaReasoning`; `deleteLastAssistantMessage` cho conversation không sở hữu; `.delete()` trả `{ error }`                                                                                                                                                                                                                                                                                                    | `decryptText` ném Error cho mọi tag `!== 16` bytes và vẫn giải mã thành công GCM 16-byte + CBC legacy hợp lệ; `validateEnv` ném Error khi key không khớp `/^[0-9a-fA-F]{64}$/`; `saveMessage`/`upsertMessage` ném `AppError` (500 `ENCRYPTION_ERROR`) và KHÔNG gọi `.insert()`/`.update()`; `deleteLastAssistantMessage` ném `ForbiddenError`; `.delete()` lỗi ném `DatabaseError`                                                                                                                                                                                                                                                                                                                                                                                        | **PASS** nếu tuyệt đối không lưu plaintext khi lỗi mã hóa và không chấp nhận GCM tag rút gọn.                                          |
| `TC-W1-03` | `contextCache.ts`, `chatStreamCore.ts`                                                                                                               | 2 user khác nhau gửi cùng `systemInstruction` dài `>= 4096` ký tự; gửi request có `ragSources.length > 0`; tạo `> 500` cache entries qua `getOrCreateCompositeCache` và `getOrCreateKBCache`                                                                                                                                                                                                                                                                                                                                                                                              | User A và User B tạo 2 cache key tách biệt (`ai.caches.create` gọi 2 lần); khi `ragSources.length > 0` thì `getOrCreateCompositeCache` KHÔNG được gọi; `getCacheStats().activeCaches <= 500` cho cả Composite và KB cache; `getOrCreateSystemCache` biên dịch sạch với `userId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **PASS** nếu 0 cache hit chéo tenant và bộ nhớ bị chặn cứng ở `<= 500` ở mọi nhánh ghi `activeCacheNames`.                             |
| `TC-W1-04` | `requireApprovedUser.ts`, 6 `/api/admin/*`, `auth.ts`, `authRevocation.ts`, `useAuthGate.ts`, `local-llm/health`, `projects.server.ts`               | Unauth gọi `/api/admin/*`; JWT còn `rank: "admin"` nhưng DB đã hạ cấp/block hoặc DB lỗi 503; Admin gửi `PATCH /api/admin/users` với `userId` là chính mình (ID hoặc email); `token.blocked = true` đi qua `session()`; `refreshTokenFromDBDetailed` gặp `not_found` / DB error; `signIn` gặp `23505` duplicate insert; blocked/`not_whitelisted` gọi `/api/local-llm/health` hoặc `getUserTier`                                                                                                                                                                                           | `/api/admin/*` trả `401` (unauth), `403` (non-admin/blocked/self-modify), `503` (DB error); `session()` trả `{ ...session, user: { id: "", rank: "__blocked__", email: undefined, name: undefined, image: undefined } }` khớp `src/types/next-auth.d.ts:5-10`; `useAuthGate` gọi `signOut` và KHÔNG gọi `signIn`; `local-llm/health` & `getUserTier` trả `403` (`USER_BLOCKED`/`ACCESS_PENDING`) và `503` khi DB lỗi                                                                                                                                                                                                                                                                                                                                                      | **PASS** nếu quyền admin & approval được cưỡng chế 100% từ DB trực tiếp, type `Session` xanh `tsc --noEmit`, và tự khóa admin bị chặn. |
| `TC-W1-05` | `generate-image`, `edit-image`, `edit-image-multi`, `constants.ts`                                                                                   | `options.model = "evil-model"` hoặc `"gemini-4-argon"`; user `basic` chọn `enhancerModel` chỉ dành cho `pro`; `isByok = true` + `enhancer = true`; `candidates: []` + `promptFeedback: { blockReason: "SAFETY" }`; lịch sử gửi lên có `thoughtSignature` và response trả `thoughtSignature` camelCase; `saveMessage` throw sau khi đã upload storage (và trường hợp `storagePath === ""` trong `generate-image`)                                                                                                                                                                          | Model ngoài allowlist trả `400 VALIDATION_ERROR`; enhancer không được phép trả `403 FORBIDDEN` (không nuốt lỗi); BYOK dùng `new GoogleGenAI({ apiKey })` thay `getGenAIClient()`; `promptFeedback.blockReason` trả `400 VALIDATION_ERROR`; gửi lên Gemini dùng `thoughtSignature` camelCase và đọc đúng `thoughtSignature` từ response; `supabase.storage.from("attachments").remove([storagePath])` được gọi khi `storagePath` có giá trị và bỏ qua khi rỗng                                                                                                                                                                                                                                                                                                             | **PASS** nếu không rò rỉ file mồ côi, không lạm dụng server key và giữ đúng line `maxDuration` (`src/app/api/edit-image/route.ts:36`). |
| `TC-W1-06` | `xssProtection.ts`, `messages/route.ts`, `fileValidation.ts`, `fileService.server.ts`, `gems/route.ts`, `personas/route.ts`, `cron/cleanup/route.ts` | `data:text/html;base64,...`, `data:image/svg+xml;base64,...`, `javascript:alert(1)` vào `isValidImageUrl` / `openSafeExternalUrl`; `POST /api/messages` kèm `meta: { imageUrl: "javascript:alert(1)", type: "image_gen" }` hoặc `sources: [{ uri: "javascript:alert(1)", title: "x" }]`; upload `.svg`/`.html` hoặc tên file `foo.toString` hoặc file `.exe`; giả mạo `x-forwarded-for` trên `/api/gems` & `/api/personas`; gọi `/api/cron/cleanup` với secret sai độ dài hoặc lỗi nội bộ 500                                                                                             | `isValidImageUrl` trả `false` cho HTML/SVG data URL và `true` cho raster base64; `openSafeExternalUrl` mở với `"noopener,noreferrer"` và trả `false` cho `javascript:`; `/api/messages` strip `imageUrl`/`type` và trả `400` cho `javascript:` source; `validateFile` ném `ValidationError` (400), `normalizeMimeType("toString", "")` trả `"text/plain"`, `uploadFile` lưu SVG/HTML với `contentType: "text/plain; charset=utf-8"` và `createSignedUrl` kèm `{ download: row.filename }`; `/api/gems` & `/api/personas` gọi `auth()` trước `consumeRateLimit` bằng `userId`; `/api/cron/cleanup` giữ `maxDuration` đúng dòng 9, giữ 401 `{ error: "Unauthorized" }`, dùng `timingSafeEqual` và nhánh catch 500 gọi `error("Cleanup failed", 500)` không lộ `err.message` | **PASS** nếu mọi vector XSS, MIME spoofing, IP spoofing và secret timing leak bị chặn và 3 test 401 hiện hữu giữ nguyên xanh.          |
| `TC-W1-07` | `apiResponse.ts`, `errors.ts`, `redis.server.ts`, `rateLimit.ts`                                                                                     | `NODE_ENV="production"` gọi `errorFromAppError(new ValidationError("Invalid email: a@b.com"))` và `errorFromAppError(new RateLimitError("Slow down", 45))`; `error("msg", 400, "CODE", { message: "hijack", code: "EVIL" })`; `sanitizeError` trên toàn bộ 10 env key mới (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `LLAMA3_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `CRON_SECRET`, `ATTACHMENTS_CRON_SECRET`, `STRATA_API_KEY`); `consumeRateLimit` khi đã chạm ngưỡng `limit` (gửi thêm 5 request liên tiếp) và khi Redis `eval` reject | `errorFromAppError` giữ nguyên message của `AppError` (không double-sanitize) và gắn header `Retry-After: 45` cho `RateLimitError`; `error()` giữ `code: "CODE"` không bị `metadata` ghi đè; tất cả 10 env key mới bị redact thành `[REDACTED]`; Lua script không `ZADD` khi đã quá hạn (không gia hạn lockout) và trả `retryAfterSeconds` đúng từ oldest score; Redis lỗi tự failover sang `backend: "memory"` với `memStore.size <= MAX_MEM_STORE_ENTRIES`                                                                                                                                                                                                                                                                                                              | **PASS** nếu không rò rỉ secret, không méo lỗi prod, không kéo dài khóa rate-limit và không rò rỉ RAM.                                 |
| `TC-W1-08` | `streaming/utils.ts`, `chatStreamCore.ts`, `chatStreamHelpers.ts`, `contextBuilder.ts`, `attachmentProcessor.ts`, 5 stream providers                 | Stream treo quá `idleMs` (gồm cả primary stream và `contStream` của Gemini); `iterator.next()` reject sau timeout; `GEMINI_API_KEY` trống khi gọi `claude-sonnet-4.5` với `ANTHROPIC_API_KEY` set & `OPENROUTER_API_KEY` unset; user `basic` gửi cookie `webSearchEnabled=1; alwaysSearch=1`; cookie chứa `%E0%A4%A`; stream lỗi giữa chừng sau khi đã nhận partial token ở 4 provider; DeepSeek trả HTTP 429; Gemini trả `executableCode` & `codeExecutionResult` trong `parts`, hoặc lỗi không có `tools`; đính kèm file mới khi lịch sử đã đầy token                                   | `withIdleTimeout` ném `StreamTimeoutError`, gọi `iterator.return()`, 0 `unhandledRejection`; trên Gemini, timeout giữa chừng (cả primary lẫn `contStream`) phát đúng 1 event `STREAM_TIMEOUT`, gọi `savePartialOnce()` lưu partial và kết thúc `done: { ok: false }` (không bị nuốt bởi `contErr`); Direct Anthropic được chọn và `getGenAIClient()` KHÔNG được gọi; `enableWebSearch === false` cho `basic`; `parseCookieHeader` không throw; `processPostStream` KHÔNG gọi khi `streamFailed === true` (lưu đúng 1 lần); DeepSeek 429 trả `code: "rate_limit_exceeded"`; Gemini stream render code & output và chỉ emit 1 event `error`; `priorityFileIds` được inject trước file cũ; `buildMessageContext` không double-count tin nhắn hiện tại                        | **PASS** nếu toàn bộ kịch bản streaming và tài nguyên vượt qua không rò rỉ timer/event/DB write và không mất partial khi timeout.      |
| `TC-W1-09` | `chatStreamCore.ts`, `conversations/route.ts`, `gems/route.ts`, `personas/route.ts`, `chunking.ts`, `projectStore.ts`                                | Gửi payload sai schema Zod v4 & JSON hỏng (`"{bad"`) vào cả 4 route; `chunkText` với tài liệu có đuôi 20 ký tự (`< minChunkSize`), đoạn văn 2500 ký tự không ngắt đoạn, nhiều dòng trống `\n\n\n`; `chunkCode` với hàm 2500 ký tự không breakpoint; `getChunkingStrategy("Makefile")`; render hook `useProjectLimits` trong React test, `createProject` & `deleteProject` cập nhật `limits`, fetch trả HTTP 502 HTML                                                                                                                                                                      | Cả 4 route trả `400 VALIDATION_ERROR` kèm thông báo field từ `.issues[0]` (không crash `Cannot read properties of undefined`); `chunkText`/`chunkCode` giữ 100% nội dung cuối (0 mất chữ), mọi chunk `<= maxChunkSize + overlap` hợp lệ, `line_start`/`line_end` chính xác, `Makefile` → `"text"`; `useProjectLimits` ổn định tham chiếu qua `useShallow` (0 infinite loop), `limits.currentProjects` tăng/giảm khớp, HTTP 502 HTML throw Error sạch thay vì `SyntaxError`                                                                                                                                                                                                                                                                                                | **PASS** nếu 0 crash Zod v4, 0 mất dữ liệu chunking và 0 vòng lặp render Zustand v5.                                                   |

---

### 9. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### Co-Located Unit Tests (Bắt buộc)

- **Tạo mới (12 file)**:
  1. `src/lib/core/redis.server.test.ts`
  2. `src/lib/core/rateLimit.test.ts`
  3. `src/lib/utils/envValidation.test.ts`
  4. `src/lib/utils/apiResponse.test.ts`
  5. `src/lib/features/auth/auth.test.ts`
  6. `src/app/features/chat/components/hooks/useAuthGate.test.ts`
  7. `src/app/api/admin/personas/route.test.ts`
  8. `src/app/api/chat-stream/streaming/utils.test.ts`
  9. `src/app/api/chat-stream/chatStreamCore.test.ts`
  10. `src/app/api/chat-stream/chatStreamHelpers.test.ts`
  11. `src/lib/features/projects/chunking.test.ts`
  12. `src/lib/store/projectStore.test.ts`
- **Cập nhật (34 file)**: Toàn bộ 34 file `*.test.ts` đã kê khai `[MODIFY]` trong Mục 5, tuân thủ nghiêm ngặt Test Failure Triage Protocol (không xóa `expect()`, không thêm `.skip`/`.only`).

#### Verification Commands (Windows PowerShell 5.1 — BẮT BUỘC dùng `;`)

```powershell
# 1. Baseline & Type-check + Lint
npm run type-check; npm run lint

# 2. Targeted Wave 1 Security & Core Test Suites (fast feedback)
npx vitest run src/lib/core/redis.server.test.ts src/lib/core/rateLimit.test.ts src/lib/core/encryption.test.ts src/lib/core/contextCache.test.ts src/lib/utils/envValidation.test.ts src/lib/utils/errors.test.ts src/lib/utils/apiResponse.test.ts src/lib/utils/xssProtection.test.ts --reporter=dot

npx vitest run src/lib/features/auth/ src/app/api/admin/ src/app/api/local-llm/health/ src/app/features/chat/components/hooks/useAuthGate.test.ts --reporter=dot

npx vitest run src/lib/features/chat/ src/lib/features/gems/ src/lib/features/personas/ src/lib/features/files/ src/lib/features/projects/ src/lib/store/projectStore.test.ts --reporter=dot

npx vitest run src/app/api/generate-image/ src/app/api/edit-image/ src/app/api/edit-image-multi/ src/app/api/messages/ src/app/api/gems/ src/app/api/personas/ src/app/api/cron/cleanup/ src/app/api/conversations/ src/app/api/chat-stream/ --reporter=dot

# 3. Pinned maxDuration & Code-Freeze Guard Regression Check
npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot

# 4. Full Repository Verification Suite
npm run type-check; npm run lint; npm run test:run
```

#### Wiring Probes & Negative Probes (`.agents/agents/reviewer/evidence-bar.md` §4.5.3)

1. **Wiring Probes**:
   - Xác minh không còn bất kỳ chuỗi `.errors[0]` hoặc `isZodLikeError` nào trong `src/app/api/chat-stream/chatStreamCore.ts`, `src/app/api/conversations/route.ts`, `src/app/api/gems/route.ts`, `src/app/api/personas/route.ts`.
   - Xác minh không còn kiểm tra `session.user.rank !== "admin"` trực tiếp trong 6 file `src/app/api/admin/*/route.ts` (tất cả đều gọi `requireAdminUser()`).
   - Xác minh không còn `window.open(` trực tiếp trong `GalleryView.tsx`, `Canvas.tsx`, `ImageLightbox.tsx`.
   - Xác minh `export const maxDuration = 60;` giữ chính xác dòng 36 ở `src/app/api/edit-image/route.ts` và dòng 9 ở `src/app/api/cron/cleanup/route.ts` sau `prettier --check`.
2. **Negative Probes (bắt buộc chạy xanh qua Vitest)**:
   - **IDOR Negative Probe**: `conversations.test.ts` + `gems.test.ts` + `personas.test.ts` truyền ID tài nguyên private của `victim@example.com` dưới phiên `attacker@example.com` ➔ assert `rejects.toThrow(ForbiddenError)` và `expect(mockUpdate).not.toHaveBeenCalled()`.
   - **Crypto Truncation Negative Probe**: `encryption.test.ts` cắt `authTag` xuống 8 ký tự hex (4 bytes) và 16 ký tự hex (8 bytes) ➔ assert `expect(() => decryptText(tampered)).toThrow()`.
   - **Plaintext Fail-Closed Negative Probe**: `messages.test.ts` mock `encryptText` ném lỗi ➔ assert `saveMessage` & `upsertMessage` reject và `expect(mockInsert).not.toHaveBeenCalled()`.
   - **Admin Self-Modification & Revoked Admin Negative Probe**: `admin/users/route.test.ts` gửi `PATCH` với `userId === admin.userId` ➔ `403 FORBIDDEN`; `requireApprovedUser.test.ts` mock DB trả `rank: "basic"` hoặc `is_blocked: true` ➔ `ForbiddenError` / `UserBlockedError`.
   - **XSS & Stored SVG Negative Probe**: `xssProtection.test.ts` truyền `data:image/svg+xml;base64,...` & `javascript:alert(1)` ➔ `false`; `messages/route.test.ts` gửi `meta.imageUrl = "javascript:alert(1)"` ➔ assert `upsertMessage` nhận `meta` KHÔNG chứa `imageUrl`; `fileService.server.test.ts` upload `evil.svg` ➔ assert storage upload dùng `contentType: "text/plain; charset=utf-8"` và `createSignedUrl` truyền `{ download: "evil.svg" }`.
   - **Rate-Limit Lockout & Spoof Negative Probe**: `rateLimit.test.ts` bắn vượt ngưỡng limit ➔ assert Lua script KHÔNG thêm phần tử mới vào sorted set; `gems/route.test.ts` thay đổi header `x-forwarded-for` ➔ assert `consumeRateLimit` vẫn nhận đúng khóa `api-gems:<userId>`.
   - **Web Search Privilege Escalation Negative Probe**: `chatStreamCore.test.ts` + `contextBuilder.test.ts` gửi cookie `webSearchEnabled=1; alwaysSearch=1` dưới user `rank: "basic"` (`features.web_search: false`) ➔ assert `tools` KHÔNG chứa `{ googleSearch: {} }`.
   - **Zustand v5 Infinite-Render Negative Probe**: `projectStore.test.ts` render component gọi `useProjectLimits()` ➔ assert render count ổn định (`<= 2`, không ném `Maximum update depth exceeded`).

#### Adversarial Timelines (4 Trục Đối Kháng — `evidence-bar.md` §4.5.2)

1. **Concurrency / Race Condition**:
   - _First Sign-In Duplicate Profile_: Hai request OAuth song song cùng `email` cùng pass `maybeSingle() === null` và cùng gọi `.insert()`. Request thứ hai nhận PostgreSQL `23505` ➔ `auth.ts` re-select profile và kiểm tra `!is_blocked` thay vì fail đăng nhập.
   - _Concurrent Rate-Limit Burst_: Nhiều serverless instance gọi đồng thời `consumeRateLimit(key)` ➔ Lua script chạy nguyên tử 1 RTT trong Redis, tránh race giữa `ZCARD` và `ZADD` và không kéo dài lockout khi bị từ chối.
2. **TOCTOU / Revocation Window**:
   - _Admin Demoted / Blocked Mid-Session_: Admin cũ vẫn giữ JWT có `rank: "admin"` gọi `PATCH /api/admin/users`. Thay vì tin JWT, `requireAdminUser()` đọc `getUserProfileStrict(userId)` từ DB trực tiếp và chặn 403 ngay lập tức; nếu DB gián đoạn thì fail-closed 503.
   - _Gem / Project Ownership Changed_: Cho dù một conversation cũ từng gắn `gem_id` hay `persona_id` của tenant khác, `getGemInstructionsForConversation` và `getPersonaInstructionsForConversation` kiểm tra lại `is_premade || user_id === userId` lúc đọc trước khi nạp prompt.
3. **Mid-Stream Failure & Orphan Cleanup**:
   - _Image Upload Succeeds, DB `saveMessage` Fails_: Cả 3 route ảnh (`generate-image`, `edit-image`, `edit-image-multi`) bắt lỗi quanh `saveMessage` và gọi `supabase.storage.from(bucket).remove([storagePath])` để không bỏ lại ảnh mồ côi trên bucket.
   - _LLM Stream Stalls or Errors Mid-Stream_: `withIdleTimeout` ném `StreamTimeoutError`, hủy timer, gắn `.catch(() => {})` lên `iterator.next()` treo và gọi `iterator.return()` đóng socket upstream; 4 stream providers gọi `savePartialOnce()` 1 lần duy nhất trong `catch` và bỏ qua `processPostStream` khi `streamFailed === true`.
4. **Serverless Cold-Start & Memory Ceilings**:
   - _Unbounded In-Memory Maps_: `activeCacheNames` (`contextCache.ts`) bị chặn cứng 500 entries với lazy eviction; `memStore` (`rateLimit.ts`) bị chặn cứng `MAX_MEM_STORE_ENTRIES` ngay thời điểm ghi khi failover; `getGenAIClient()` khởi tạo lười nên cold-start cho Claude/DeepSeek/Strata không crash nếu thiếu `GEMINI_API_KEY`.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risk-to-Control Mapping)

| #   | Rủi ro                                                                                                                      | Mức độ         | Technical Control (`[SRC]` / Negative Probe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dịch chuyển số dòng `export const maxDuration` làm fail `code-freeze-guard.test.ts`                                         | **Cao**        | Giữ `export const maxDuration = 60;` ở chính xác `src/app/api/edit-image/route.ts:36` (nhờ đặt allowlist ở `src/lib/utils/constants.ts`, import trên dòng 20 sẵn có) và `src/app/api/cron/cleanup/route.ts:9` (chỉ thêm import ở dòng 11+); kiểm chứng bằng `npx vitest run .agents/scripts/code-freeze-guard.test.ts` + `prettier --check`.                                                                                                                                                                                                 |
| 2   | Strip `email` khi `token.blocked === true` làm client `useAuthGate` gọi `signIn()` đua với `signOut()`                      | **Cao**        | Thêm guard `const isBlocked = session?.user?.rank === "__blocked__";` vào `src/app/features/chat/components/hooks/useAuthGate.ts:34` + kiểm chứng bằng co-located test `src/app/features/chat/components/hooks/useAuthGate.test.ts`.                                                                                                                                                                                                                                                                                                         |
| 3   | Đổi `requireAdminUser()` / `getUserTier()` / `getPersonasForUser()` / `gems` JSON validation gây hồi quy trên test hiện hữu | **Trung bình** | Rà soát đầy đủ 9 bộ test bị ảnh hưởng trong Mục 3 (Blast-Radius) và thực hiện đúng Test Failure Triage Protocol (Loại B cho mock harness, Loại C cho spec đã duyệt; giữ 100% assertion hiện có); xác minh qua `npm run test:run`.                                                                                                                                                                                                                                                                                                            |
| 4   | Siết `postMessageSchema.meta` trong `/api/messages` vô tình chặn luồng Stop-button partial sync từ frontend                 | **Cao**        | Đối chiếu trực tiếp caller tại `src/app/features/chat/components/hooks/useChatStreamController.ts:325-340` và cho phép toàn bộ field hợp lệ (`clientMessageId`, `isPartial`, `aborted`, `status`, `reasoning`, `thinkingStats`, `sources`, `urlContext`, `ragSources`, `emptyAnswerReason`, `model`); kiểm chứng cả happy-path partial sync lẫn negative probe `imageUrl: "javascript:..."` trong `src/app/api/messages/route.test.ts`.                                                                                                      |
| 5   | `errorFromAppError` không sanitize lỗi chứa secret nếu caller vô tình truyền message chứa env key vào `AppError`            | **Trung bình** | `errorFromAppError` vẫn đi qua `sanitizeError(appError, isProd)` (đảm bảo `AppError` giữ thông điệp nghiệp vụ mà không bị `new Error(...)` bọc lần 2); đồng thời bổ sung 10 provider/service env keys (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `LLAMA3_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `CRON_SECRET`, `ATTACHMENTS_CRON_SECRET`, `STRATA_API_KEY`) vào `src/lib/utils/errors.ts:170-185` và kiểm chứng trong `src/lib/utils/apiResponse.test.ts` + `src/lib/utils/errors.test.ts`. |
| 6   | Lua script Upstash Redis sai kiểu dữ liệu trả về hoặc bị lỗi mạng làm sập API thay vì rate-limit dự phòng                   | **Trung bình** | Kiểm chứng chữ ký `eval` tại `node_modules/@upstash/redis/zmscore-0SAuWM0q.d.ts:3370`, ép kiểu `Number(...)` phòng thủ cho `[allowed, count, oldestScore]`, bọc `try/catch` failover sang `consumeInMemory` kèm OOM cap; kiểm chứng trong `src/lib/core/rateLimit.test.ts`.                                                                                                                                                                                                                                                                  |
| 7   | `validateFile` đọc `file.slice(0, 16)` trên mock `File` cũ không cài `.slice()` trong môi trường unit test                  | **Trung bình** | Kiểm tra phòng thủ `const blob = typeof file.slice === "function" ? file.slice(0, 16) : file;` trước khi gọi `blob.arrayBuffer()` tại `src/lib/features/files/fileValidation.ts:446-448`; kiểm chứng qua `src/lib/features/files/fileValidation.test.ts` và `src/lib/features/files/fileService.server.test.ts`.                                                                                                                                                                                                                             |
| 8   | Thay đổi `enhancer` trong `generate-image` nuốt `ForbiddenError` (403) vào `catch` `enhancerFailed = true`                  | **Cao**        | Kiểm tra `await assertModelAllowedForUser(userId, enhancerModelId)` TRƯỚC khối `try/catch` mềm của enhancer (hoặc rethrow `if (e instanceof AppError) throw e;`) trong `src/app/api/generate-image/route.ts:152-201`; kiểm chứng bằng negative probe 403 trong `src/app/api/generate-image/route.test.ts`.                                                                                                                                                                                                                                   |

---

## Audit History

### Audit Run 1

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Lệnh đầu tiên: `node scripts/verify-plan.mjs docs/plans/2026-11-21-code-audit-wave-1-security-core-fixes-plan.md` → **exit code 0**:
  - `[PASS] SECTIONS 7/7`, toàn bộ 82 `LINE_REF` hợp lệ.
  - `[INFO] CRITIC_REQUIRED yes (src/lib/core/redis.server.ts, src/lib/features/files/fileService.server.ts, src/lib/features/projects/projects.server.ts)`.
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`.
- **Kiểm chứng lỗi cũ**: N/A (Revision 1, lượt thẩm định đầu tiên).

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                  | Bằng chứng   | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------- | ------- | ------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DEFECT         | [MAJOR] | `src/lib/core/contextCache.ts:282-288`                       | [SRC]        | Kế hoạch thêm trường bắt buộc `userId: string` vào `CompositeCacheConfig`, nhưng bỏ sót hàm nội bộ đang export `getOrCreateSystemCache` gọi `getOrCreateCompositeCache({ model, systemInstruction }, ttlSeconds)` không có `userId` tại dòng 287 (chắc chắn lỗi `tsc --noEmit`). Đồng thời `getOrCreateKBCache` (`src/lib/core/contextCache.ts:260`) ghi vào cùng `activeCacheNames` Map mà không dùng chung helper eviction trần `MAX_ACTIVE_CACHES = 500`. Cần cập nhật `getOrCreateSystemCache` (nhận thêm `userId: string` hoặc xóa nếu 0 caller) và áp dụng helper `setBoundedCache` chung cho cả Composite và KB cache.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | DEFECT         | [MAJOR] | `src/types/next-auth.d.ts:5-10`                              | [SRC]        | Kế hoạch yêu cầu `session()` tại `src/lib/features/auth/auth.ts:190-195` trả `{ ...session, user: { rank: "__blocked__" } }` khi `token.blocked === true`. Tuy nhiên `src/types/next-auth.d.ts:7` khai báo `Session["user"]["id"]: string` là trường bắt buộc (không optional) và file này không nằm trong danh sách `[MODIFY]`. Trả object thiếu `id` sẽ lỗi biên dịch `tsc --noEmit`. Cần đổi payload blocked thành `{ ...session, user: { id: "", rank: "__blocked__", email: undefined, name: undefined, image: undefined } }` (vừa khớp type, vừa làm fail cả `getUserId()` lẫn `!session?.user?.id \|\| !session?.user?.email`).                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3   | DEFECT         | [MAJOR] | `src/app/api/chat-stream/streaming/gemini-stream.ts:254-272` | [SRC]        | Kế hoạch bọc `withIdleTimeout(stream, idleTimeoutMs)` tại `:272` và `withIdleTimeout(contStream, idleTimeoutMs)` tại `:466`, nhưng: (a) `gemini-stream.ts:19` chưa import `withIdleTimeout` và `executeStream` (`:204`) chỉ có `timeoutMs`, chưa định nghĩa nguồn giá trị `idleTimeoutMs`; (b) vòng `for await` (`:272`) nằm NGOÀI `try/catch` (`:220-268`) vốn phát `STREAM_TIMEOUT`, còn `runStreamWithFallback` (`:632`) rethrow ngay `StreamTimeoutError` không gửi event `error` và `createChatReadableStream` (`:893`) chỉ gọi `savePartialOnce()` khi `isCancelled \|\| ac.signal.aborted` ➔ idle timeout giữa stream khiến client không nhận event `error` SSE và mất nội dung partial; (c) `:466` nằm trong `catch (contErr)` (`:475-477`) nuốt luôn `StreamTimeoutError` và kết thúc `done { ok: true }`. Cần bọc `try/catch` thống nhất xử lý `StreamTimeoutError` (phát đúng 1 event `STREAM_TIMEOUT`), rethrow `StreamTimeoutError` ra khỏi `contErr`, và gọi `savePartialOnce()` trong `createChatReadableStream` khi có nội dung partial trước lỗi/timeout. |
| 4   | DEFECT         | [MAJOR] | `src/lib/features/chat/messages.ts:366-387`                  | [SRC]        | Thiết kế `deleteLastAssistantMessage` tự mâu thuẫn: kế hoạch yêu cầu truy vấn `conversations` bằng `.eq("id", conversationId).eq("user_id", userId).maybeSingle()`, đồng thời yêu cầu ném `ForbiddenError` nếu conversation thuộc user khác và `return` nếu không tồn tại. Khi đã lọc `.eq("user_id", userId)`, cả hai trường hợp đều trả `{ data: null, error: null }` nên không thể phân biệt để đạt `TC-W1-02`. Phải đổi truy vấn thành `.select("id, user_id").eq("id", conversationId).maybeSingle()`, kiểm tra `error` ➔ `DatabaseError`, `!conv` ➔ `return`, và `conv.user_id !== userId` ➔ `throw new ForbiddenError()`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5   | DEFECT         | [MAJOR] | `src/app/api/cron/cleanup/route.test.ts:64-91`               | [SRC]        | Hai thiếu sót đặc tả & blast-radius: (a) Step 2.15 đổi `src/app/api/cron/cleanup/route.ts:27,54` sang dùng `error()` (`apiResponse.ts`), làm đổi định dạng JSON 401 từ `{ error: "Unauthorized" }` (string) sang `{ success: false, error: { message, code } }` (object), phá vỡ trực tiếp 3 test `expect(json.error).toBe("Unauthorized")` tại `src/app/api/cron/cleanup/route.test.ts:65,76,90`, nhưng file test này bị bỏ sót khỏi bảng Blast-Radius & Triage (Mục 3) và thiếu chốt rõ spec mới ở Mục 6; (b) Mục tiêu B.1, Step 1.4, `TC-W1-07` và Rủi ro #5 yêu cầu thêm "8 provider env keys mới" vào `src/lib/utils/errors.ts:170-185` nhưng không liệt kê danh sách cụ thể 8 biến môi trường nào (trên codebase thật có `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `LLAMA3_API_KEY`, `DEEPSEEK_API_KEY`, `REPLICATE_API_TOKEN`, `CRON_SECRET`, `ATTACHMENTS_CRON_SECRET`, `STRATA_API_KEY`).                                                                                                                                      |
| 6   | DEFECT         | [MINOR] | `src/app/api/edit-image-multi/route.ts:137-139`              | [SRC]        | Kế hoạch sửa đọc response sang `p.thoughtSignature ?? p.thought_signature` tại `:287-296`, nhưng bỏ sót chiều gửi lên Gemini tại `:138` vẫn ghi `imagePart.thought_signature = turn.thoughtSignature` (trong khi `src/app/api/chat-stream/streaming/thought-signatures.ts:33,207` dùng camelCase `thoughtSignature`). Ngoài ra: `src/lib/features/projects/chunking.ts:48,78` cần theo dõi offset đoạn bằng regex match thay vì `.split(/\n\n+/)` + `+ 2` cố định để `line_start`/`line_end` đúng với `\n\n\n` trong `TC-W1-09`; và `src/app/api/generate-image/route.ts:249,364` cần guard `if (storagePath)` trước khi gọi `.remove([storagePath])` cùng việc thêm `remove: mockStorageRemove` vào mock của cả 3 file test ảnh (`generate-image`, `edit-image`, `edit-image-multi`).                                                                                                                                                                                                                                                                                     |
| 7   | RISK_DISMISSED | [MINOR] | `src/app/api/edit-image/route.ts:20-36`                      | [SRC], [CMD] | Đã xác minh pin-line `maxDuration`: `code-freeze-guard.test.ts` (128/128 passed) kiểm tra dòng 36 ở `edit-image/route.ts` và dòng 9 ở `cron/cleanup/route.ts` (`code-freeze-guard.test.ts:1861-1880`). `import { HTTP_STATUS, ALLOWED_EDIT_IMAGE_MODELS } from "@/lib/utils/constants";` dài 79 ký tự (`<= 100` Prettier `printWidth`) giữ nguyên dòng 20, `model: z.enum(ALLOWED_EDIT_IMAGE_MODELS).optional(),` dài 58 ký tự giữ nguyên dòng 30, nên `export const maxDuration = 60;` giữ chính xác dòng 36; tương tự import mới ở `cron/cleanup/route.ts` đặt từ dòng 11 giữ nguyên dòng 9. Ngoài ra `ALLOWED_GENERATE_IMAGE_MODELS` phủ đủ 4 model UI trong `src/app/features/image-gen/components/ControlPanel.tsx:190-214`.                                                                                                                                                                                                                                                                                                                                          |
| 8   | RISK_DISMISSED | [MINOR] | `.agents/scripts/plan-scope.js:170-212`                      | [SRC]        | Đối chiếu với `docs/plans/2026-11-21-ux-ui-audit-phase-5-polish-hygiene-plan.md`: 0 file mã nguồn/test giao nhau (chỉ dùng chung living doc `docs/CHANGELOG.md`). Lưu ý vận hành: Phase 5 hiện vẫn đang `Status: Approved` cùng nhóm ngày `2026-11-21` và có chỉnh sửa chưa hoàn tất trong `git status`; theo `plan-scope.js:203-208`, trong khi Wave 1 ở trạng thái chưa duyệt (`Changes Requested` / `Awaiting Critic`), `getActiveApprovedPlans()` sẽ khóa fail-safe toàn bộ nhóm ngày `2026-11-21` cho tới khi Wave 1 được duyệt hoặc Phase 5 hoàn tất.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                         | Kết quả | Bằng chứng                                                                                                                                                                                                                                                                                                           | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Completeness Gate (7 mục + Skills + `verify-plan.mjs`) | FAIL    | [CMD] `verify-plan.mjs` exit 0; [SRC] `src/lib/utils/errors.ts:170-185`, `src/app/api/cron/cleanup/route.test.ts:65-90`                                                                                                                                                                                              | Đủ 7 mục và ánh xạ `SKILL.md`, nhưng đặc tả thiếu danh sách cụ thể 8 provider env keys cho `errors.ts` và thiếu mục Triage Loại C cho `cron/cleanup/route.test.ts` trong Mục 3.                                                                                                                                                                                                                                                       |
| S1: Cold-start & Build                                      | FAIL    | [CMD] `npm run type-check` exit 0 (baseline); [SRC] `src/lib/core/contextCache.ts:282-288`, `src/types/next-auth.d.ts:5-10`, `package.json:39-122`                                                                                                                                                                   | Baseline sạch, stack hợp lệ (0 Prisma/Better Auth). Tuy nhiên thiết kế Mục 6.4 (`session()` thiếu `id`) và Mục 6.5 (`getOrCreateSystemCache` thiếu `userId`) sẽ làm fail `tsc --noEmit` ngay khi triển khai (Findings #1, #2).                                                                                                                                                                                                        |
| S2: Runner Lifecycle & Teardown                             | FAIL    | [SRC] `src/app/api/chat-stream/streaming/utils.ts:196-224`, `src/app/api/chat-stream/streaming/gemini-stream.ts:254-272,466-477,631-634,892-897`                                                                                                                                                                     | Thiết kế `withIdleTimeout` ở `utils.ts` và bỏ lưu trùng ở 4 provider (`openai`, `anthropic`, `deepseek`, `strata`) khớp mã nguồn thật (cả 4 provider đều gọi `savePartialOnce()` trong `catch`). Tuy nhiên tích hợp `withIdleTimeout` vào `gemini-stream.ts` thiếu `idleTimeoutMs`/import, bỏ sót phát event `STREAM_TIMEOUT` + `savePartialOnce()` khi timeout giữa stream và bị `catch (contErr)` nuốt lỗi tại `:475` (Finding #3). |
| S3: Database & Temporal Logic                               | N/A     | [SRC] `src/types/database.types.ts:538-567`, `docs/security.md:29-49`                                                                                                                                                                                                                                                | Wave 1 không tạo/sửa bảng, cột, migration SQL hay RLS policy (xác minh `profiles.is_blocked: boolean` đã có sẵn trong `database.types.ts:543` cho `getUserTier()`).                                                                                                                                                                                                                                                                   |
| S4: Cross-Task State Flow                                   | PASS    | [SRC] `src/lib/store/projectStore.ts:203-213`, `node_modules/zustand/react/shallow.d.ts:1`, `src/app/features/chat/components/hooks/useAuthGate.ts:20-36`, `src/app/features/chat/components/hooks/useChatStreamController.ts:325-340,612-616`, `src/lib/features/chat/thinkingStats.ts:3-7`                         | `useShallow` khớp chữ ký Zustand 5; guard `!isBlocked` chặn race `signIn()`/`signOut()` trong `useAuthGate.ts`; `postMessageSchema.meta` tương thích với payload partial sync từ `useChatStreamController.ts` và `sendInitialMetaEvents` tại `gemini-stream.ts:73-78` giữ khóa `sources` khớp parser client `:612`.                                                                                                                   |
| S5: Security Boundary & 3-Tier Auth                         | FAIL    | [SRC] `src/lib/features/chat/messages.ts:366-387`, `src/lib/features/auth/requireApprovedUser.ts:1-35`, `src/lib/core/encryption.ts:62-125`, `src/lib/core/rateLimit.ts:128-182`, `node_modules/@upstash/redis/zmscore-0SAuWM0q.d.ts:3370,4105-4109`, `src/lib/features/files/fileService.server.ts:185-188,402-404` | Phần lớn chốt chặn IDOR, GCM `authTagLength: 16`, `requireAdminUser()`, Upstash Lua `eval`, SVG/HTML neutralization và auth-trước-rate-limit khớp mã nguồn và SDK `.d.ts`. Trượt do truy vấn `deleteLastAssistantMessage` tự mâu thuẫn không thể phân biệt 403 vs not-found (Finding #4) và `getOrCreateKBCache` chưa có trần bộ nhớ chung với `activeCacheNames` (Finding #1).                                                       |
| S6: External Resilience & Serverless Cap                    | FAIL    | [SRC] `src/app/api/chat-stream/streaming/gemini-stream.ts:254-272,466-477`, `src/app/api/edit-image/route.ts:36`, `src/app/api/cron/cleanup/route.ts:9`, `src/app/api/chat-stream/chatStreamCore.ts:94-101,535-607`; [CMD] `npx vitest run .agents/scripts/code-freeze-guard.test.ts` (128/128 pass)                 | `maxDuration` pin-line, lazy `getGenAIClient()`, ưu tiên Direct Anthropic và failover Redis sang memory đạt chuẩn. Trượt do xử lý `StreamTimeoutError` giữa stream trên Gemini không phát event `error` về client và nuốt timeout ở nhánh continuation (Finding #3).                                                                                                                                                                  |
| Domain: Vikini Specifics                                    | PASS    | [SRC] `src/lib/core/modelRegistry.ts:4-88`, `src/lib/core/limits.ts:366-404`, `src/app/api/chat-stream/streaming/deepseek-stream.ts:349-370`, `src/app/features/image-gen/components/ControlPanel.tsx:190-214`, `src/app/api/chat-stream/streaming/thought-signatures.ts:33,207`                                     | Tôn trọng bất biến `assertModelAllowedForUser` (`Promise<void>`), `ALLOWED_GENERATE_IMAGE_MODELS` khớp UI Image Studio, không động tới chuỗi dịch song ngữ, sửa phân loại HTTP 429 trên DeepSeek và giữ tương thích `refreshTokenFromDB` (chỉ có góp ý `[MINOR]` đồng bộ camelCase `thoughtSignature` ở `edit-image-multi/route.ts:138`).                                                                                             |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục đối kháng — `evidence-bar.md` §4.5.2)**:
  1. **Đồng thời (Concurrency)**:
     - Cơ chế: Upstash Redis Sliding-Window Lua (`src/lib/core/rateLimit.ts`)
     - T1: 2 serverless instances đồng thời gọi `consumeRateLimit("api-gems:u@x.com")` khi `ZCARD === limit - 1` | T2: Redis thực thi 2 Lua script tuần tự nguyên tử (1 RTT) | T3: Request A nhận `{ 1, limit, oldest }`, Request B thấy `count >= limit` nên KHÔNG `ZADD` và nhận `{ 0, limit, oldest }`
     - Kết cục: Không vượt limit và không gia hạn cửa sổ khóa ➔ **An toàn** (`[ADV]`, `[SRC]` `node_modules/@upstash/redis/zmscore-0SAuWM0q.d.ts:3370`).
  2. **Khoảng trống check→use (TOCTOU)**:
     - Cơ chế: `deleteLastAssistantMessage` ownership check (`src/lib/features/chat/messages.ts:366-387`)
     - T1: Attacker gọi `deleteLastAssistantMessage("attacker@x.com", victimConvId)` | T2: Code theo đúng kế hoạch hiện tại chạy `.eq("id", conversationId).eq("user_id", userId).maybeSingle()` ➔ nhận `{ data: null, error: null }` | T3: Hàm không phân biệt được unowned vs non-existent nên không thể ném `ForbiddenError` như `TC-W1-02` yêu cầu
     - Kết cục: Sai hợp đồng phân quyền / fail `TC-W1-02` ➔ **Lỗi `[MAJOR]`** (`[ADV]`, Finding #4).
  3. **Thất bại giữa chừng & dọn dẹp (Mid-stream Failure & Cleanup)**:
     - Cơ chế: Gemini stream idle timeout (`src/app/api/chat-stream/streaming/gemini-stream.ts:272,632,892`)
     - T1: Gemini trả 5 chunk token rồi treo quá `idleTimeoutMs` | T2: `withIdleTimeout` tại `:272` (ngoài `try/catch` `:220-268`) ném `StreamTimeoutError` | T3: `runStreamWithFallback` (`:632`) rethrow không phát event `error`; `createChatReadableStream` (`:893`) thấy `!isCancelled && !ac.signal.aborted` nên không gọi `savePartialOnce()`, chỉ gửi `done { ok: false }`
     - Kết cục: Client không nhận thông báo lỗi `STREAM_TIMEOUT` và mất toàn bộ partial response ➔ **Lỗi `[MAJOR]`** (`[ADV]`, Finding #3).
  4. **Môi trường serverless (Cold-start & Memory Ceiling)**:
     - Cơ chế: `activeCacheNames` Map trong `src/lib/core/contextCache.ts:45,168,260`
     - T1: Nhiều project gọi `getOrCreateKBCache` trên instance serverless sống lâu | T2: Kế hoạch chỉ nêu eviction trần 500 trong `getOrCreateCompositeCache`, không nêu cho `getOrCreateKBCache` (`:260`) | T3: `activeCacheNames` vẫn tăng vượt 500 entries qua nhánh KB cache
     - Kết cục: Lọt trần bộ nhớ khi dùng KB caching ➔ **Lỗi `[MAJOR]`** (`[ADV]`, Finding #1).

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-21-code-audit-wave-1-security-core-fixes-plan.md` → exit 0 (`PASS`, `CRITIC_REQUIRED yes`).
  2. `git status` → exit 0 (ghi nhận các thay đổi Phase 5 đang mở trong working tree, không giao nhau với source/test Wave 1).
  3. `npm run type-check` → exit 0 (baseline `tsc --noEmit` sạch).
  4. `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` → exit 0 (128/128 tests passed).
  5. `node scripts/verify-docs.mjs` → exit 1 (baseline có sẵn: broken links trong `.claude/worktrees/*` và `docs/CHANGELOG.md` 81,226 bytes > 35,000 bytes; governance rules/agents `[3/5]` & `[4/5]` PASS).

#### 4. Kết Luận

Tồn tại **5 lỗi `[MAJOR]`** có bằng chứng mã nguồn trực tiếp (`contextCache.ts` gãy biên dịch `getOrCreateSystemCache` + thiếu cap cho KB cache; `auth.ts` `session()` thiếu `id: string` theo `next-auth.d.ts`; `gemini-stream.ts` mất event `STREAM_TIMEOUT` + mất partial + nuốt timeout ở nhánh continuation; `messages.ts` `deleteLastAssistantMessage` query tự mâu thuẫn; thiếu danh sách 8 env key trong `errors.ts` và sót Triage Loại C cho `cron/cleanup/route.test.ts`). Đề nghị `@planner` cập nhật Revision 2 khắc phục dứt điểm 5 lỗi `[MAJOR]` (và xem xét 3 điểm `[MINOR]` tại Finding #6) trước khi thẩm định lại và chuyển sang Cross-Model Critic Pass (`CRITIC_REQUIRED: yes`).

[CHANGES_REQUESTED]

---

### Audit Run 2

[REVIEWER_MODEL: gemini-4-argon]

#### 1. Output verify-plan.mjs & Kiểm Chứng Lỗi Cũ

- Lệnh kiểm chứng: `node scripts/verify-plan.mjs docs/plans/2026-11-21-code-audit-wave-1-security-core-fixes-plan.md` → **exit code 0**:
  - `[PASS] SECTIONS 7/7`, toàn bộ 108 `LINE_REF` hợp lệ.
  - `[INFO] CRITIC_REQUIRED yes (src/lib/core/redis.server.ts, src/lib/features/files/fileService.server.ts, src/lib/features/projects/projects.server.ts)`.
  - `[PASS] CRITIC_FLOOR 8 findings with valid file:line`.
  - `VERIFY_PLAN: PASS (0 failures, 0 warnings)`.

| Lỗi Audit Run 1                                                                                                                                                             | Trạng thái | Bằng chứng đối chiếu mã nguồn (`[SRC]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 `[MAJOR]` `contextCache.ts:260,282-288` (`getOrCreateSystemCache` thiếu `userId` & `getOrCreateKBCache` thiếu cap)                                                       | **ĐÃ SỬA** | Đối chiếu `src/lib/core/contextCache.ts:168,260,282-288`: Revision 2 cập nhật `getOrCreateSystemCache(model, systemInstruction, userId, ttlSeconds)` khớp `CompositeCacheConfig`, thêm guard `!config.userId?.trim()`, và định nghĩa helper `setBoundedCache` trần `MAX_ACTIVE_CACHES = 500` áp dụng cho cả `:168` lẫn `:260`, kèm kiểm thử ở `TC-W1-03`.                                                                                                                                                                                                                                                                                           |
| #2 `[MAJOR]` `next-auth.d.ts:5-10` vs `auth.ts:190-195` (`session()` trả object thiếu `id: string`)                                                                         | **ĐÃ SỬA** | Đối chiếu `src/types/next-auth.d.ts:5-10`, `src/lib/features/auth/auth.ts:190-195`, `src/lib/features/auth/getUserId.ts:11-17`: Revision 2 đổi payload blocked thành `{ ...session, user: { id: "", rank: "__blocked__", email: undefined, name: undefined, image: undefined } }` — khớp type bắt buộc `id: string` và làm fail-closed cả `getUserId()` lẫn `!session?.user?.id \|\| !session?.user?.email`.                                                                                                                                                                                                                                        |
| #3 `[MAJOR]` `gemini-stream.ts:19,204,254-272,466-477,631-693,892-898` (thiếu import/giá trị `idleTimeoutMs`, mất `STREAM_TIMEOUT`, mất partial, nuốt timeout continuation) | **ĐÃ SỬA** | Đối chiếu `src/app/api/chat-stream/streaming/gemini-stream.ts:19,204,254-272,466-477,631-693,892-898`, `src/app/api/chat-stream/streaming/openai-stream.ts:275` và `src/app/api/chat-stream/streaming/gemini-stream.test.ts:1-690`: Revision 2 bổ sung import `withIdleTimeout`, tính `idleTimeoutMs = Math.max(timeoutMs / 2, 30_000)`, bọc `try/catch` phát 1 lần `STREAM_TIMEOUT`, rethrow `StreamTimeoutError` ra khỏi `catch (contErr)`, guard `catch (err2)` chống phát trùng, và gọi vô điều kiện `await savePartialOnce()` trong `createChatReadableStream` `catch` (tương thích hoàn toàn 13 test hiện hữu trong `gemini-stream.test.ts`). |
| #4 `[MAJOR]` `messages.ts:366-387` (`deleteLastAssistantMessage` query tự mâu thuẫn)                                                                                        | **ĐÃ SỬA** | Đối chiếu `src/lib/features/chat/messages.ts:366-387`: Revision 2 đổi sang `.select("id, user_id").eq("id", conversationId).maybeSingle()`, phân biệt rõ `convError` (`DatabaseError`), `!conv` (`return`), và `conv.user_id !== userId` (`ForbiddenError`), khớp `TC-W1-02`.                                                                                                                                                                                                                                                                                                                                                                       |
| #5 `[MAJOR]` `cron/cleanup/route.test.ts:64-91` & `errors.ts:170-185` (vỡ test 401 & thiếu danh sách env keys)                                                              | **ĐÃ SỬA** | Đối chiếu `src/app/api/cron/cleanup/route.ts:9,27,54`, `src/app/api/cron/cleanup/route.test.ts:64-91`, `src/lib/utils/errors.ts:170-185`, `src/lib/core/{claude,deepseek,openRouter,groq}Client.ts`, `src/lib/core/strataConfig.ts:92`: Revision 2 giữ contract 401 `{ error: "Unauthorized" }` (bảo toàn 3 test `:65,76,90`), chuyển nhánh 500 `:54` sang `error("Cleanup failed", 500)`, và liệt kê đủ 10 regex provider/service env keys.                                                                                                                                                                                                        |
| #6 `[MINOR]` `edit-image-multi:137-139`, `chunking.ts:48,78`, `generate-image:249,364`                                                                                      | **ĐÃ SỬA** | Đồng bộ `imagePart.thoughtSignature` camelCase ở chiều gửi (`:138`), chuyển `chunking.ts` sang quét regex offset thực, thêm guard `if (storagePath)` và bổ sung `remove: mockStorageRemove` cho cả 3 file test ảnh.                                                                                                                                                                                                                                                                                                                                                                                                                                 |

#### Critic Findings

| #   | Loại           | Mức     | `file:line`                                                  | Bằng chứng | Lý do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------- | ------- | ------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RISK_DISMISSED | [MINOR] | `src/app/api/chat-stream/streaming/gemini-stream.ts:272-480` | [SRC]      | Đã lần theo luồng lỗi cho cả primary stream (`:272`) và continuation stream (`:466-477`) cùng `runStreamWithFallback` (`:631-693`) và `createChatReadableStream` (`:892-898`): `withIdleTimeout` ném `StreamTimeoutError` được bắt 1 lần trong `executeStream` (gửi đúng 1 event `STREAM_TIMEOUT`), rethrow qua `:632` không retry tools fallback, `savePartialOnce()` lưu partial trước `done: { ok: false }`, và 13 test hiện hữu tại `src/app/api/chat-stream/streaming/gemini-stream.test.ts:1-690` không bị ảnh hưởng. |
| 2   | RISK_DISMISSED | [MINOR] | `src/lib/features/projects/chunking.ts:48-78`                | [SRC]      | Đã kiểm chứng biểu thức `/[^\n]+(?:\n(?!\n)[^\n]+)*/g` được nêu ở Revision 2: các nhóm ký tự `[^\n]+` và `\n` loại trừ nhau hoàn toàn nên thời gian khớp tuyến tính $O(N)$ (không rủi ro ReDoS) và xác định đúng `startChar`/`line_start` trên tài liệu chứa nhiều dòng trống `\n\n\n`+.                                                                                                                                                                                                                                    |
| 3   | RISK_DISMISSED | [MINOR] | `src/lib/utils/errors.ts:170-185`                            | [SRC]      | Đã đối soát 10 env key bổ sung với toàn bộ client/provider thực tế (`src/lib/core/claudeClient.ts:20`, `deepseekClient.ts:4`, `openRouterClient.ts:4`, `groqClient.ts:8`, `strataConfig.ts:92`, `OpenAIImageProvider.ts:15`, `ReplicateImageProvider.ts:16`, `cron/cleanup/route.ts:20`) và `src/lib/utils/errors.test.ts:133-274`: không có xung đột regex nào với các test sanitize hiện hữu.                                                                                                                             |
| 4   | DEFECT         | [MINOR] | `src/lib/core/contextCache.ts:282-288`                       | [SRC]      | Ghi chú nhỏ về số lượng hàng trong bảng Rủi ro #3 (vẫn ghi "9 bộ test" thay vì 10 hàng sau khi bổ sung `cron/cleanup/route.test.ts`) và giữ `getOrCreateSystemCache` ở dạng deprecated khi có thể xóa ở Wave 3; không chặn biên dịch, runtime hay bảo mật (`[MINOR]`).                                                                                                                                                                                                                                                      |

#### 2. Plan Completeness Gate & Mental Simulation Matrix

| Mục                                                         | Kết quả | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                              | Chi tiết                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan Completeness Gate (7 mục + Skills + `verify-plan.mjs`) | PASS    | [CMD] `verify-plan.mjs` exit 0 (7/7 sections, 108/108 `LINE_REF`, `CRITIC_REQUIRED yes`); [SRC] `src/lib/utils/errors.ts:170-185`, `src/app/api/cron/cleanup/route.test.ts:64-91`                                                                                                                                                                                                                       | Đủ 7 mục, Skills Loaded & Applied khớp `.agents/rules/02-quality.md`, đủ 10 env patterns và Blast-Radius/Triage cho toàn bộ test bị ảnh hưởng.                                                                                                                                                         |
| S1: Cold-start & Build                                      | PASS    | [CMD] `npm run type-check` exit 0; [SRC] `src/lib/core/contextCache.ts:282-288`, `src/types/next-auth.d.ts:5-10`, `package.json:39-122`                                                                                                                                                                                                                                                                 | Không còn lỗi biên dịch TypeScript trên `getOrCreateSystemCache` và `session()`; stack hợp lệ, không phát sinh dependency hay biến `.env` mới ngoài tài liệu.                                                                                                                                          |
| S2: Runner Lifecycle & Teardown                             | PASS    | [SRC] `src/app/api/chat-stream/streaming/utils.ts:196-224`, `src/app/api/chat-stream/streaming/gemini-stream.ts:19,204,254-272,466-477,631-693,892-898`, `src/app/api/chat-stream/streaming/openai-stream.ts:275,441`, `src/app/api/chat-stream/streaming/gemini-stream.test.ts:1-690`                                                                                                                  | `withIdleTimeout` dọn timer + chặn `UnhandledPromiseRejection` + gọi `iterator.return()`; Gemini primary & continuation timeout phát đúng 1 event `STREAM_TIMEOUT` và lưu partial; 4 provider còn lại bỏ ghi trùng mid-stream.                                                                         |
| S3: Database & Temporal Logic                               | N/A     | [SRC] `src/types/database.types.ts:538-567`, `docs/security.md:29-49`                                                                                                                                                                                                                                                                                                                                   | Wave 1 không thay đổi bảng, cột, migration SQL hay RLS policy (`profiles.is_blocked` đã tồn tại tại `database.types.ts:543`).                                                                                                                                                                          |
| S4: Cross-Task State Flow                                   | PASS    | [SRC] `src/lib/store/projectStore.ts:203-213`, `node_modules/zustand/react/shallow.d.ts:1`, `src/app/features/chat/components/hooks/useAuthGate.ts:20-36`, `src/app/features/chat/components/hooks/useChatStreamController.ts:325-340,612-616`, `src/lib/features/chat/thinkingStats.ts:3-7`                                                                                                            | `useShallow` khắc phục vòng lặp Zustand v5; guard `!isBlocked` chặn race `signIn()`/`signOut()`; `postMessageSchema.meta` tương thích Stop-button partial sync.                                                                                                                                        |
| S5: Security Boundary & 3-Tier Auth                         | PASS    | [SRC] `src/lib/features/chat/messages.ts:366-387`, `src/lib/features/auth/requireApprovedUser.ts:1-35`, `src/lib/core/encryption.ts:62-125`, `src/lib/core/contextCache.ts:168,260`, `src/lib/core/rateLimit.ts:128-182`, `node_modules/@upstash/redis/zmscore-0SAuWM0q.d.ts:3370,4105-4109`, `src/lib/features/files/fileService.server.ts:185-188,402-404`, `src/app/api/cron/cleanup/route.ts:18-55` | Truy vấn ownership `deleteLastAssistantMessage` phân biệt đúng 403 vs not-found; `setBoundedCache` giới hạn cả Composite & KB cache; GCM `{ authTagLength: 16 }`, `requireAdminUser()` đọc DB trực tiếp, Lua 1 RTT, SVG/HTML neutralization và constant-time SHA-256 cron check đều có Negative Probe. |
| S6: External Resilience & Serverless Cap                    | PASS    | [CMD] `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` (128/128 pass); [SRC] `src/app/api/edit-image/route.ts:20-36`, `src/app/api/cron/cleanup/route.ts:9,27,54`, `src/app/api/chat-stream/chatStreamCore.ts:94-101,535-607`, `src/app/api/chat-stream/streaming/gemini-stream.ts:272-480,631-693,892-898`                                                                    | Pin-line `maxDuration` bảo toàn sau Prettier; timeout Gemini nhất quán trên primary, continuation và fallback; Redis lỗi failover sang memory có trần; `getGenAIClient()` khởi tạo lười.                                                                                                               |
| Domain: Vikini Specifics                                    | PASS    | [SRC] `src/lib/core/modelRegistry.ts:4-88`, `src/lib/core/limits.ts:366-404`, `src/app/features/image-gen/components/ControlPanel.tsx:190-214`, `src/app/api/edit-image-multi/route.ts:137-139,287-296`, `src/app/api/chat-stream/streaming/thought-signatures.ts:33,207`, `src/app/api/chat-stream/streaming/deepseek-stream.ts:349-370`                                                               | Đồng bộ camelCase `thoughtSignature` cả hai chiều gửi/nhận, `ALLOWED_GENERATE_IMAGE_MODELS` khớp UI, không chạm chuỗi dịch song ngữ, bảo toàn `assertModelAllowedForUser` và `refreshTokenFromDB`.                                                                                                     |

#### 3. Adversarial Timelines & Commands Executed

- **Adversarial Timelines (4 trục đối kháng — `evidence-bar.md` §4.5.2)**:
  1. **Đồng thời (Concurrency)**:
     - Cơ chế: Upstash Redis Sliding-Window Lua (`src/lib/core/rateLimit.ts`) & first-sign-in `23505` (`src/lib/features/auth/auth.ts:97-107`)
     - T1: Hai request song song cùng chạm ngưỡng `limit` (hoặc hai OAuth callback cùng tạo profile) | T2: Redis chạy Lua 1 RTT tuần tự; PostgreSQL trả `23505` cho insert thứ hai | T3: Request vượt ngưỡng bị từ chối không `ZADD`; `auth.ts` re-select profile và kiểm tra `!existing.is_blocked`
     - Kết cục: Không gia hạn lockout và không lỗi đăng nhập race ➔ **An toàn** (`[ADV]`, `[SRC]` `node_modules/@upstash/redis/zmscore-0SAuWM0q.d.ts:3370`).
  2. **Khoảng trống check→use (TOCTOU)**:
     - Cơ chế: `deleteLastAssistantMessage` (`src/lib/features/chat/messages.ts:366-387`) & `requireAdminUser()` (`src/lib/features/auth/requireApprovedUser.ts`)
     - T1: Attacker gọi `deleteLastAssistantMessage` với `victimConvId` (hoặc admin bị thu hồi quyền vẫn cầm JWT cũ gọi `/api/admin/*`) | T2: `messages.ts` truy vấn `.select("id, user_id").eq("id", conversationId).maybeSingle()`; `requireAdminUser()` gọi `getUserProfileStrict(userId)` trực tiếp | T3: `conv.user_id !== userId` ném `ForbiddenError`; admin đã hạ cấp/block nhận 403 (hoặc 503 khi DB lỗi)
     - Kết cục: Chặn hoàn toàn vượt quyền theo trạng thái DB hiện thời ➔ **An toàn** (`[ADV]`, `[SRC]` `src/lib/features/chat/messages.ts:366-387`, `src/lib/features/auth/requireApprovedUser.ts:26-35`).
  3. **Thất bại giữa chừng & dọn dẹp (Mid-stream Failure & Cleanup)**:
     - Cơ chế: Gemini stream / continuation idle timeout (`src/app/api/chat-stream/streaming/gemini-stream.ts:272-480,631-693,892-898`) & image orphan cleanup (`generate-image`, `edit-image`, `edit-image-multi`)
     - T1: Stream Gemini treo giữa chừng sau khi nhận partial text (hoặc ở continuation sau tool call), hoặc `saveMessage` lỗi sau khi upload ảnh | T2: `withIdleTimeout` ném `StreamTimeoutError` + gọi `iterator.return()`; `catch (contErr)` rethrow `StreamTimeoutError`; `executeStream` gửi đúng 1 event `STREAM_TIMEOUT`; route ảnh bắt lỗi `saveMessage` | T3: `createChatReadableStream` gọi `savePartialOnce()` trước `done: { ok: false }`; route ảnh gọi `storage.from(bucket).remove([storagePath])` khi `storagePath` không rỗng
     - Kết cục: Không mất partial, đúng 1 event lỗi SSE, không rò rỉ socket/timer/storage mồ côi ➔ **An toàn** (`[ADV]`, `[SRC]` `src/app/api/chat-stream/streaming/gemini-stream.ts:272-480,892-898`).
  4. **Môi trường serverless (Cold-start & Memory Ceiling)**:
     - Cơ chế: `activeCacheNames` (`src/lib/core/contextCache.ts:168,260`) & `memStore` (`src/lib/core/rateLimit.ts`)
     - T1: Instance serverless sống lâu nhận nhiều khóa Composite Cache, KB Cache và fallback rate-limit | T2: Cả `getOrCreateCompositeCache` và `getOrCreateKBCache` đi qua `setBoundedCache` (trần 500); `consumeInMemory` evict ngay khi `>= MAX_MEM_STORE_ENTRIES` | T3: Kích thước cả hai Map bị chặn cứng trên mọi nhánh ghi
     - Kết cục: Không rò rỉ bộ nhớ OOM giữa các chu kỳ dọn dẹp ➔ **An toàn** (`[ADV]`, `[SRC]` `src/lib/core/contextCache.ts:45,168,260`).

- **Commands Executed**:
  1. `node scripts/verify-plan.mjs docs/plans/2026-11-21-code-audit-wave-1-security-core-fixes-plan.md` → exit 0 (`PASS`, 0 failures, 0 warnings, `CRITIC_REQUIRED yes`, `CRITIC_FLOOR 8 findings`).
  2. Baseline từ Audit Run 1 chưa thay đổi source code: `npm run type-check` (exit 0) và `npx vitest run .agents/scripts/code-freeze-guard.test.ts --reporter=dot` (128/128 pass).

#### 4. Kết Luận

Toàn bộ 5 lỗi `[MAJOR]` và 3 góp ý `[MINOR]` từ Audit Run 1 đã được khắc phục đầy đủ và đối chiếu khớp với mã nguồn thật (0 lỗi `[BLOCKER]`, 0 lỗi `[MAJOR]`). Do kế hoạch có `CRITIC_REQUIRED: yes` (chạm `*.server.ts`, auth/RBAC, cryptography, file storage, API security gates), chuyển trạng thái sang `- **Status**: Awaiting Critic` để chờ Cross-Model Critic Pass (Claude CLI `-Role critic`) trước khi mở khóa triển khai.

[AWAITING_CRITIC]

---

### Cross-Model Critic Circuit Breaker — Product Manager Override

- **Lý do**: `.agents/scripts/run-claude.ps1 -Role critic` trả lỗi `exit 1` do tổ chức khóa quyền subscription Claude Code (`Your organization has disabled Claude subscription access for Claude Code`).
- **Quyết định**: Product Manager (User) đã xác nhận trực tiếp (`"cách 2"`) phê duyệt triển khai kế hoạch Wave 1 sau khi kế hoạch đạt `0 [BLOCKER]`, `0 [MAJOR]` và `verify-plan.mjs` PASS (`0 failures, 0 warnings`) ở Audit Run 2 của `@reviewer`.

[PLAN_APPROVED]
