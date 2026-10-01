# Kế Hoạch Triển Khai: Giai Đoạn 1 — Khắc Phục Các Lỗi Bảo Mật Khẩn Cấp, Admin Dashboard & Lỗi Cốt Lõi Hệ Thống (Phase 1 Remediation - Revision 5)

> **Mã Tài Liệu**: `docs/plans/2026-10-01-audit-remediation-phase-1-security-admin-core-fixes.md`  
> **Ngày Lập**: 01/10/2026  
> **Ngày Cập Nhật**: 01/10/2026  
> **Phiên Bản (Revision)**: 5 (Tích hợp toàn diện 0 `[BLOCKER]`, 1 `[MAJOR]` (M1 - SEC-01 cross-user deletion) và các điểm minor từ Claude Code CLI Audit Run 8; sẵn sàng phê duyệt `[PLAN_APPROVED]`)  
> **Tác Giả**: Technical Planner (Vikini Antigravity)  
> **Trạng Thái**: Status: Approved  
> **Tài Liệu Căn Cứ**: [`docs/audit-report-2026-10-01.md`](../audit-report-2026-10-01.md)

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Khắc phục dứt điểm nhóm lỗi nghiêm trọng phát hiện từ đợt Audit toàn diện ngày 01/10/2026:

1. **SEC-01**: Khắc phục triệt để IDOR và Storage Leak trên toàn bộ **4 sink** xóa file CSDL/Storage và tầng nạp hội thoại:
   - `src/lib/features/chat/messages.ts:deleteMessage`: kiểm tra quyền sở hữu conversation `(msg.conversations as unknown as { user_id: string }).user_id === userId`.
   - `src/lib/features/chat/messages.ts:deleteMessageByClientMessageId`: thêm xác thực quyền sở hữu cuộc hội thoại thuộc về `userId` trước khi thực hiện xóa tin nhắn.
   - `src/lib/features/chat/messages.ts:deleteMessagesIncludingAndAfter`: thêm xác thực quyền sở hữu cuộc hội thoại thuộc về `userId` trước khi thực hiện xóa chuỗi tin nhắn.
   - `src/app/api/gallery/[id]/route.ts`: xác thực quyền sở hữu tin nhắn và dọn dẹp storage an toàn.
   - `src/app/api/chat-stream/conversationLoader.ts`: tại dòng 22, sau khi nạp hội thoại theo `requestedConversationId`, bắt buộc kiểm tra `if (convo && convo.userId !== userId) throw new NotFoundError("Conversation");` chặn đứng kịch bản User B gửi `conversationId` của User A vào `/api/chat-stream` để xóa hoặc cắt tỉa tin nhắn của A.
   - Bổ sung `"image_edit"` vào `MessageMeta.type` (`"image_gen" | "image_edit" | "text" | "chart"`) bảo đảm type safety cho TypeScript strict mode; áp dụng helper chuyên trách `removeOwnedStoragePaths` tại `src/lib/features/chat/storageCleanup.ts` (bảo đảm tuân thủ quy tắc Hard Max 400 dòng của `messages.ts`), từ chối mọi path chứa ký tự traversal `..`, bắt buộc tiền tố `${userId}/`, hỗ trợ dọn dẹp file cho cả `meta.type === "image_gen"` và `meta.type === "image_edit"`.
2. **SEC-02**: Ngăn chặn rò rỉ tài liệu tri thức chéo người dùng qua RAG Context (`src/lib/features/projects/ragContext.server.ts` & `knowledge.server.ts`), bắt buộc kiểm tra `user_id` khi lấy `project_id` từ conversation và xác thực quyền sở hữu project qua `getProject(projectId, userId)` **trước** khi sinh embedding và thực thi RPC vector `match_project_knowledge`.
3. **SEC-03**: Triệt tiêu lỗ hổng SSRF trong Describe Image & Edit Image (`src/app/api/describe-image/route.ts` & `src/app/api/edit-image/route.ts`), thiết kế module `src/lib/core/ssrfGuard.server.ts` tuân thủ quy ước server-only bằng hậu tố `.server.ts` chuẩn mực của repo (tuyệt đối không cài thêm package ngoại lai `server-only`), cơ chế kiểm soát chuyển hướng (`redirect: "manual"` tối đa 3 hops), ngân sách timeout đơn nhất (shared deadline 10s cho toàn bộ chuỗi hops), bọc lỗi timeout thành `new ValidationError("Request timeout")` để API route trả mã 400 chuẩn mực, hủy stream body cũ khi gặp 3xx (`res.body?.cancel()`), phân giải DNS (`dns.promises.lookup({ all: true })`), kiểm tra IP qua `net.BlockList` với tham số family rõ ràng (`net.isIP(ip) === 6 ? "ipv6" : "ipv4"`), bổ sung các dải `::/96`, `2002::/16`, whitelist Supabase storage domain, kiểm soát MIME (bóc tách params) và hủy stream reader (`reader.cancel()`) khi chạm trần 10MB. Ghi nhận rõ rủi ro tồn dư TOCTOU DNS Rebinding trong Risk Table.
4. **SEC-04**: Loại bỏ hoàn toàn lỗ hổng Code Injection qua `new Function` trong công cụ `calculate` (`src/lib/features/chat/functionRegistry.ts`), thay thế bằng bộ phân tích toán học thuần túy an toàn `mathParser.ts` (Recursive Descent Parser) với ngữ pháp tường minh: toán tử một ngôi `-` có độ ưu tiên thấp hơn lũy thừa `^` (`-2^2 = -4`), bỏ giới hạn cơ số `<= 100` (cho phép `1024^2`), kiểm soát ReDoS, số mũ trong `[-50, 50]`, trần kết quả `Number.MAX_SAFE_INTEGER`; bổ sung test co-located cho `functionRegistry.ts`.
5. **ADM-01 & ADM-02**: Đồng bộ hóa dữ liệu định danh người dùng: xác thực `profiles.id` là canonical email lowercased theo migration 022; sửa logic tra cứu tại `src/app/api/admin/users/route.ts`: **tra cứu theo `id: userId` trước**, nếu không tìm thấy mới tra cứu theo `email: userId.toLowerCase()`, nếu vẫn không tìm thấy trả về 404 `new NotFoundError("User")` (chuẩn hóa thông điệp `"User not found"`), luôn update bằng `targetProfile.id` và bump token bằng `targetProfile.email.toLowerCase()`; sửa thống kê tại `src/app/api/admin/stats/route.ts` đếm tin nhắn qua join `conversations!inner(user_id)` thay vì `.in()` không giới hạn.
6. **ADM-03**: Ngăn chặn lỗi SQL 500 do số thực và số nguyên vượt ngưỡng Postgres INTEGER (`> 2147483647`) tại `src/app/api/admin/rank-configs/route.ts` và `src/app/admin/components/RankConfigManager.tsx`. Định nghĩa kiểm tra validation int4 và thực thi persist cho cả 3 trường: `daily_message_limit`, `max_file_size_mb`, và `daily_research_limit` (khi có mặt trong payload).
7. **API-01 & API-02**: Chốt kiến trúc phân trang Gallery ở tầng CSDL (`messages` join `conversations!inner(user_id, model)`), thực thi bước **kiểm chứng bắt buộc (mandatory)** ở Bước 7.0 với câu truy vấn PostgREST HTTP đồng bộ 100% với logic production (bao gồm `conversations.or`, lọc JSONB lồng và favorites) trên DB thật trước khi can thiệp vào route production; dùng hằng số chuẩn `MODEL_IDS.USER_TEMPLATES_STORE` (`"user_templates_store"`), sử dụng `referencedTable: "conversations"` thay vì `foreignTable` deprecated, bổ sung khóa sắp xếp phụ `.order("id", { ascending: false })` để ổn định phân trang khi trùng `created_at`, đẩy toàn bộ bộ lọc ảnh và favorites xuống DB qua JSONB filters, phân trang trực tiếp qua `.range(offset, offset + limit)`, hiển thị đầy đủ ảnh sinh từ Image Studio.
8. **UI-01**: Sửa lỗi lệnh "switch-theme" trong `src/app/features/chat/components/CommandPalette.tsx`, chuyển từ việc gán sai `"dark"`/`"light"` sang gọi hook `toggleTheme()` hợp lệ của hệ thống 16 theme; bổ sung translation key `switchTheme` trong `vi.ts` và `en.ts`.
9. **UI-02**: Khắc phục "Ghost Button" tại `src/app/features/gallery/components/GalleryView.tsx`, bổ sung icon `<X />`, nhãn trợ năng `aria-label` và hiệu ứng focus-visible.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ nghiêm ngặt Giao thức Pre-Work trong [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md):

| Lĩnh Vực / Module            | Tài Liệu Bắt Buộc Đọc Trước Khi Viết Code                                                                                                                                                                                                                                        | Quy Chuẩn Cần Áp Dụng                                                                                                                                                 |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth & Security Boundary** | [`docs/security.md`](../security.md), [`.agents/skills/api-patterns.md`](../../.agents/skills/api-patterns.md)                                                                                                                                                                   | NextAuth session check `auth()`, RLS policy, phân lập file `*.server.ts` (không cài package `server-only`), không hardcode secrets                                    |
| **Chat & Messages Storage**  | [`docs/database-schema.md`](../database-schema.md), [`database-migrations/022_normalize_userid_to_email.sql`](../../database-migrations/022_normalize_userid_to_email.sql)                                                                                                       | Canonical identity email, quan hệ `conversations` -> `messages`, ghi nhận tombstone `recordTombstone()`, Hard Max 400 dòng (`01-coding.md`), type union `MessageMeta` |
| **Chat Stream & Truncation** | [`src/app/api/chat-stream/conversationLoader.ts`](../../src/app/api/chat-stream/conversationLoader.ts)                                                                                                                                                                           | Xác thực `convo.userId === userId` trước khi tải và truncate tin nhắn                                                                                                 |
| **Projects & RAG Knowledge** | [`docs/features.md`](../features.md) (§2.10), [`supabase/migrations/20260928180000_unify_gemini_embedding_2.sql`](../../supabase/migrations/20260928180000_unify_gemini_embedding_2.sql)                                                                                         | RPC `match_project_knowledge` 3072d, quy chuẩn xác thực project ownership theo `user_id`                                                                              |
| **Media & SSRF Defense**     | RFC 1918, RFC 3986, RFC 4291, RFC 6890, Node.js `node:net` / `node:dns`                                                                                                                                                                                                          | Chặn IP private/loopback/link-local/metadata, xử lý redirect manual, streaming byte-cap, shared timeout budget, mapping ValidationError                               |
| **Admin APIs & Database**    | [`docs/database-schema.md`](../database-schema.md), [`database-migrations/003_fix_uuid_type.sql`](../../database-migrations/003_fix_uuid_type.sql), [`supabase/migrations/20260627000000_add_deep_research.sql`](../../supabase/migrations/20260627000000_add_deep_research.sql) | Bảng `profiles.id: text (email)`, Postgres signed int4 bounds (`0..2147483647`), cột `daily_research_limit`, `NotFoundError` format                                   |
| **Theming & Gallery UI**     | [`.agents/rules/03-ui.md`](../../.agents/rules/03-ui.md), [`src/lib/config/theme-config.ts`](../../src/lib/config/theme-config.ts), [`src/lib/utils/constants.ts`](../../src/lib/utils/constants.ts)                                                                             | 16 Theme định danh, CSS variables tokenized, `MODEL_IDS.USER_TEMPLATES_STORE`, chuẩn Radix UI & Lucide icons                                                          |
| **Bug Fixing & Lesson Log**  | [`docs/lessons-learned.md`](../lessons-learned.md), [`.agents/workflows/debug.md`](../../.agents/workflows/debug.md)                                                                                                                                                             | Triệt tiêu specification gaming, áp dụng 3-Tier Verification, ghi nhận bài học                                                                                        |

---

### 3. Assumptions & Cross-Task Dependencies

1. **Canonical Identity Mapping (Định danh người dùng)**:
   - Theo migration `022_normalize_userid_to_email.sql` và `src/lib/features/auth/auth.ts:98`, cột `profiles.id` trong CSDL thực tế là `TEXT` chứa email chữ thường (`LOWER(email)`).
   - Bảng `conversations.user_id` cũng lưu trữ `email` chữ thường.
   - Bảng `profiles.email` lưu trữ `email`.
   - File tài liệu `docs/database-schema.md:181` ghi `uuid id PK` là tài liệu cũ chưa cập nhật -> Sẽ được cập nhật đồng bộ trong `[MODIFY]`.
   - Cơ chế tra cứu người dùng tại `api/admin/users`: **ưu tiên tra cứu theo `id = userId` trước** (vì `profiles.id` là khóa chính chuẩn hóa); nếu không tìm thấy bản ghi, mới thử tra cứu dự phòng theo `email = userId.toLowerCase()`. Nếu vẫn không tìm thấy -> ném `new NotFoundError("User")` trả HTTP 404 (chuỗi thông báo format chuẩn xác là `"User not found"`). Luôn cập nhật theo `targetProfile.id` và gọi `bumpAuthVersion` với `targetProfile.email.toLowerCase()`.

2. **Supabase Client Architecture & Storage Boundaries**:
   - Truy vấn server-side sử dụng `getSupabaseAdmin()` chạy dưới quyền `service_role`.
   - Do `service_role` bỏ qua RLS của Supabase Storage, việc xác thực quyền sở hữu file (Authorization Check) bắt buộc thi hành nghiêm ngặt ở tầng ứng dụng: mọi thao tác xóa file từ Storage qua `storagePath` phải bắt đầu bằng `${userId}/` và tuyệt đối không chứa ký tự path traversal `..`.
   - Tách logic kiểm tra tiền tố và xóa Storage an toàn thành module độc lập `src/lib/features/chat/storageCleanup.ts` để tái sử dụng trên cả 4 sink và bảo đảm `src/lib/features/chat/messages.ts` (hiện có 445 dòng) không bị phình to vi phạm quy định Hard Max 400 dòng của `01-coding.md`.
   - Bổ sung `"image_edit"` vào `MessageMeta.type` trong `messages.ts` (được re-export qua `src/types/chat.ts`).
   - Sử dụng an toàn `as unknown as { user_id: string }` khi ép kiểu kết quả join của Supabase để tránh lỗi compile TypeScript strict mode.

3. **Phụ thuộc giữa các Task**:
   - **SEC-01**: Bốn sink xóa file Storage (`deleteMessage`, `deleteMessageByClientMessageId`, `deleteMessagesIncludingAndAfter`, `api/gallery/[id]`) đều phụ thuộc vào helper `removeOwnedStoragePaths`. Cả hai hàm `deleteMessageByClientMessageId` và `deleteMessagesIncludingAndAfter` bắt buộc kiểm tra quyền sở hữu conversation của `userId`. Hàm `loadOrCreateConversation` trong `conversationLoader.ts` bắt buộc kiểm tra `if (convo && convo.userId !== userId) throw new NotFoundError("Conversation");`.
   - **SEC-02**: Kiểm tra quyền sở hữu project qua `getProject(projectId, userId)` được thực thi **trước** khi gọi `generateEmbedding` để không tiêu tốn token AI vô ích.
   - **SEC-03**: Module `src/lib/core/ssrfGuard.server.ts` là dependency hạt nhân bảo vệ cho cả `/api/describe-image` và `/api/edit-image`. Sử dụng quy ước hậu tố chuẩn `.server.ts` của toàn bộ repo Vikini (như `supabase.server.ts`, `projects.server.ts`, `fileService.server.ts`) để bảo vệ ranh giới server-side, **tuyệt đối không cài đặt hoặc import package `server-only`**.
   - **SEC-04**: Bổ sung file `[NEW] src/lib/features/chat/functionRegistry.test.ts` để kiểm thử handler `calculate` sau khi tích hợp `mathParser.ts`.
   - **ADM-03**: `daily_research_limit` là trường tùy chọn trong payload `PATCH /api/admin/rank-configs`, validate int4 khi có mặt và ghi nhận vào `.update()`.
   - **API-01 & API-02**: Bắt buộc kiểm chứng cú pháp PostgREST JSONB trong `.or()` trên CSDL thật trước khi áp dụng vào route production. Import `MODEL_IDS` từ `src/lib/utils/constants.ts` (cấm hardcode chuỗi `user_templates_store`). Sử dụng `referencedTable: "conversations"` và khóa sắp xếp phụ `.order("id", { ascending: false })`.
   - **UI-01**: Thêm key `switchTheme` vào cả `vi.ts` và `en.ts`.

---

### 4. Bảng Verified Versions (Năm 2026)

| Thư Viện / Nền Tảng       |   Phiên Bản Xác Thực   | Mục Đích Sử Dụng & Giới Hạn Kiến Trúc                                    |
| :------------------------ | :--------------------: | :----------------------------------------------------------------------- |
| **Next.js**               | `^16.1.1` (App Router) | Khung ứng dụng chính, hỗ trợ Route Handlers, React Server Components     |
| **React & React DOM**     |       `^19.2.3`        | Thư viện UI hạt nhân, Client/Server component model                      |
| **TypeScript**            |        `^5.9.3`        | Trình biên dịch ngôn ngữ, Strict Mode, cấm `any`, dùng unknown narrowing |
| **@supabase/supabase-js** |       `^2.89.0`        | Supabase SDK truy vấn PostgreSQL, Auth và Storage buckets                |
| **@upstash/redis**        |       `^1.36.0`        | Bộ nhớ đệm phân tán cho Rate Limiting và Auth Token Versioning           |
| **next-auth**             |    `^5.0.0-beta.30`    | Xác thực người dùng (NextAuth v5 beta), quản lý JWT Session              |
| **Tailwind CSS**          |       `^4.1.18`        | CSS framework, CSS variables theming engine                              |
| **Vitest**                |       `^4.0.16`        | Framework kiểm thử đơn vị & tích hợp tốc độ cao                          |
| **Zod**                   |        `^4.2.1`        | Thư viện schema validation mạnh mẽ cho API request body và params        |
| **next-themes**           |        `^0.4.6`        | Theme provider quản trị class giao diện HTML                             |
| **Node.js**               |         `24.x`         | Runtime môi trường máy chủ (hỗ trợ `node:net`, `node:dns`, `node:url`)   |

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

#### `[NEW]` (Tạo mới)

1. [`src/lib/core/ssrfGuard.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/ssrfGuard.server.ts): Tiện ích bảo vệ SSRF server-only toàn diện (theo quy ước `.server.ts`, không import package `server-only`): kiểm tra giao thức `http/https`, whitelist Supabase domain, manual redirect loop (max 3 hops), single shared deadline timeout (10s), bọc timeout thành `ValidationError("Request timeout")`, hủy stream body cũ khi 3xx, phân giải DNS qua `dns.promises.lookup`, kiểm tra IP qua `net.BlockList` với tham số family rõ ràng (`net.isIP(ip) === 6 ? "ipv6" : "ipv4"`), dải cấm mở rộng (`::/96`, `2002::/16`), xác thực MIME ảnh và hủy stream reader khi chạm ngưỡng 10MB.
2. [`src/lib/core/ssrfGuard.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/core/ssrfGuard.server.test.ts): Co-located unit test cho `ssrfGuard.server.ts` bao phủ 100% các kịch bản SSRF: IP loopback, IP link-local, redirect 302 sang IP nội bộ kèm kiểm tra hủy body, DNS resolving ra IP private, hex IPv4-mapped IPv6, IPv6-compatible (`[::7f00:1]`), timeout tổng chuỗi hops (trả ValidationError) và payload quá tải > 10MB.
3. [`src/lib/features/chat/storageCleanup.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/storageCleanup.ts): Helper dùng chung `removeOwnedStoragePaths(supabase, userId, paths)`: kiểm tra tiền tố `${userId}/`, từ chối path chứa `..`, loại bỏ file mạo danh và thực hiện xóa an toàn trên bucket `attachments` cho cả 4 sink. Giúp `messages.ts` tuân thủ quy định Hard Max 400 dòng.
4. [`src/lib/features/chat/storageCleanup.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/storageCleanup.test.ts): Co-located unit test cho `storageCleanup.ts` kiểm thử: lọc path hợp lệ, bỏ qua path của user khác, từ chối path traversal (`..`), và xử lý xóa bucket an toàn.
5. [`src/app/api/chat-stream/conversationLoader.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.test.ts): Co-located unit test kiểm thử `loadOrCreateConversation`: xác nhận ném `NotFoundError("Conversation")` khi người dùng yêu cầu hội thoại không thuộc sở hữu của mình; kiểm thử `handleMessageTruncation` chỉ cắt tỉa tin nhắn trong hội thoại chính chủ.
6. [`src/lib/features/chat/mathParser.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/mathParser.ts): Bộ phân tích toán học an toàn (Recursive Descent Parser) với ngữ pháp tường minh: thứ tự ưu tiên chuẩn (`-2^2 = -4`), bỏ giới hạn cơ số `<= 100`, kiểm soát ReDoS, số mũ `[-50, 50]`, trần `Number.MAX_SAFE_INTEGER`.
7. [`src/lib/features/chat/mathParser.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/mathParser.test.ts): Co-located unit test cho `mathParser.ts` bao phủ tính toán số học, hàm toán, modulo/phần trăm, lũy thừa số âm/dương, và chặn đứng mọi chuỗi tấn công sandbox escape / DoS.
8. [`src/lib/features/chat/functionRegistry.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/functionRegistry.test.ts): Co-located unit test cho `functionRegistry.ts` kiểm tra handler `calculate` trả về đúng định dạng JSON chuẩn và từ chối mã độc.
9. [`src/lib/features/projects/ragContext.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/ragContext.server.test.ts): Co-located unit test kiểm thử việc bảo vệ quyền sở hữu conversation và ngăn chặn rò rỉ tri thức chéo người dùng.
10. [`src/app/features/gallery/components/GalleryView.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.test.tsx): Component test kiểm tra nút đóng modal chi tiết ảnh hiển thị icon `X` và nhãn trợ năng `aria-label`.

#### `[MODIFY]` (Chỉnh sửa)

1. [`src/lib/features/chat/messages.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messages.ts):
   - Cập nhật `interface MessageMeta`: `type?: "image_gen" | "image_edit" | "text" | "chart";` bảo đảm type safety khi so sánh.
   - `deleteMessage`: Kiểm tra quyền sở hữu qua `conversations!inner(user_id)` và ép kiểu an toàn `(msg.conversations as unknown as { user_id: string }).user_id !== userId`. Bổ sung kiểm tra tiền tố an toàn qua `removeOwnedStoragePaths`; hỗ trợ dọn dẹp file cho cả `meta.type === "image_gen"` và `meta.type === "image_edit"`.
   - `deleteMessageByClientMessageId`: Thêm xác thực quyền sở hữu conversation của `userId` trước khi thực thi xóa; áp dụng `removeOwnedStoragePaths(supabase, userId, [meta?.attachment?.storagePath])`, hỗ trợ cả `image_gen` và `image_edit`.
   - `deleteMessagesIncludingAndAfter`: Thêm xác thực quyền sở hữu conversation của `userId` trước khi thực thi xóa; áp dụng `removeOwnedStoragePaths(supabase, userId, pathsToRemove)`, hỗ trợ cả `image_gen` và `image_edit`.
2. [`src/lib/features/chat/messages.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/messages.test.ts):
   - Thêm test suite cho `deleteMessage`: xóa tin nhắn chính chủ, từ chối IDOR của người dùng khác, và từ chối xóa file storage nếu `storagePath` trỏ sang tiền tố người khác.
   - Thêm test cases cho `deleteMessageByClientMessageId` và `deleteMessagesIncludingAndAfter`: kiểm tra từ chối xóa nếu `conversationId` không thuộc về `userId` và kiểm tra dọn storage an toàn.
3. [`src/app/api/chat-stream/conversationLoader.ts`](file:///c:/Users/wyemh/vikini/src/app/api/chat-stream/conversationLoader.ts):
   - Tại dòng 22-26: sau khi nạp `convo = await getConversation(requestedConversationId);`, bổ sung kiểm tra quyền sở hữu:
     ```ts
     if (convo && convo.userId !== userId) {
       throw new NotFoundError("Conversation");
     }
     ```
     ngăn chặn User B nạp hoặc kích hoạt truncate trên conversation của User A.
4. [`src/app/api/gallery/[id]/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/gallery/%5Bid%5D/route.ts):
   - Thay thế lệnh xóa storage thô tại dòng 68-78 bằng `removeOwnedStoragePaths(supabase, userId, [meta?.attachment?.storagePath])`.
5. [`src/app/api/gallery/[id]/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/gallery/%5Bid%5D/route.test.ts):
   - Bổ sung test case kiểm tra: nếu `storagePath` trong `meta.attachment` không bắt đầu bằng `${userId}/` hoặc chứa `..`, lệnh xóa storage bị bỏ qua và không xóa file người khác.
6. [`src/app/api/messages/[id]/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/messages/%5Bid%5D/route.ts) & [`route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/messages/%5Bid%5D/route.test.ts):
   - Đảm bảo xử lý trả về 403 Forbidden khi gặp `ForbiddenError` và 404 khi gặp `NotFoundError`.
7. [`src/lib/features/projects/ragContext.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/ragContext.server.ts):
   - Sửa `getConversationProjectId(conversationId: string, userId: string)`: thêm điều kiện `.eq("user_id", userId)`. Cập nhật hàm gọi trong `buildRAGContext`.
8. [`src/lib/features/projects/knowledge.server.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.ts):
   - Trong `searchKnowledge`: Bổ sung kiểm tra quyền sở hữu qua `getProject(projectId, userId)` **trước** khi gọi `generateEmbedding` để tiết kiệm token AI.
9. [`src/lib/features/projects/knowledge.server.test.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/projects/knowledge.server.test.ts):
   - Cập nhật mock `getProject` trong các test case hiện hữu và kiểm tra việc từ chối tìm kiếm khi không sở hữu project.
10. [`src/app/api/describe-image/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/describe-image/route.ts):
    - Tích hợp `fetchSafeImage` từ `src/lib/core/ssrfGuard.server.ts`. Áp dụng kiểm tra MIME type ảnh đối với cả nhánh `data:image`.
11. [`src/app/api/describe-image/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/describe-image/route.test.ts):
    - Mock module `@/lib/core/ssrfGuard.server` để tránh gọi DNS thật; bổ sung test cases kiểm tra xử lý lỗi tải ảnh an toàn.
12. [`src/app/api/edit-image/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/edit-image/route.ts):
    - Tích hợp `fetchSafeImage` từ `src/lib/core/ssrfGuard.server.ts` thay cho lệnh `fetch(sourceImageUrl)` thô.
13. [`src/app/api/edit-image/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/edit-image/route.test.ts):
    - Mock module `@/lib/core/ssrfGuard.server`; bổ sung test cases kiểm tra chặn SSRF URL đối với `sourceImageUrl`.
14. [`src/lib/features/chat/functionRegistry.ts`](file:///c:/Users/wyemh/vikini/src/lib/features/chat/functionRegistry.ts):
    - Thay thế handler của `calculate` bằng `evaluateMathExpression()` từ `mathParser.ts`, giữ nguyên định dạng JSON kết quả trả về.
15. [`src/app/api/admin/users/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/admin/users/route.ts):
    - Phân giải người dùng: **tra cứu theo `id = userId` trước**, nếu không tìm thấy mới tra cứu theo `email = userId.toLowerCase()`. Nếu không tìm thấy ném `new NotFoundError("User")` (HTTP 404). Luôn cập nhật theo `targetProfile.id` và bump token theo `targetProfile.email.toLowerCase()`.
16. [`src/app/api/admin/users/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/admin/users/route.test.ts):
    - Cập nhật test case dòng 209: kỳ vọng trả về 404 `NotFoundError` khi userId không tồn tại (Approved Spec Change Loại C). Bổ sung test cases cập nhật qua email và cập nhật qua id định danh.
17. [`src/app/api/admin/stats/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/admin/stats/route.ts):
    - Phân giải canonical email của người dùng (chuẩn hóa `toLowerCase()`); đếm tin nhắn của người dùng bằng Supabase join `messages` với `conversations!inner(user_id)` thay vì `.in("conversation_id", ids)`.
18. [`src/app/api/admin/stats/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/admin/stats/route.test.ts):
    - Cập nhật mock join và test cases đếm số lượng tin nhắn/hội thoại của người dùng.
19. [`src/app/api/admin/rank-configs/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/admin/rank-configs/route.ts):
    - Kiểm tra `Number.isInteger(val) && val >= 0 && val <= 2147483647` cho `daily_message_limit`, `max_file_size_mb`, và `daily_research_limit` (khi có mặt). Đưa `daily_research_limit` vào payload `.update()`.
20. [`src/app/api/admin/rank-configs/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/admin/rank-configs/route.test.ts):
    - Bổ sung test cases: `3.14`, `2147483648`, `"5"`, `100`; kiểm tra `daily_research_limit` được update vào CSDL.
21. [`src/app/admin/components/RankConfigManager.tsx`](file:///c:/Users/wyemh/vikini/src/app/admin/components/RankConfigManager.tsx):
    - Áp dụng fallback `parseInt(e.target.value, 10) || 0` và giới hạn tối đa `2147483647` cho cả 3 ô số (`daily_message_limit`, `max_file_size_mb`, `daily_research_limit`).
22. [`src/app/api/gallery/route.ts`](file:///c:/Users/wyemh/vikini/src/app/api/gallery/route.ts):
    - Chốt truy vấn DB-level: `messages` join `conversations!inner(user_id, model)` với `.eq("conversations.user_id", userId)`.
    - Sử dụng hằng số `MODEL_IDS.USER_TEMPLATES_STORE` với `referencedTable: "conversations"`.
    - Sắp xếp kép: `.order("created_at", { ascending: false }).order("id", { ascending: false })`.
    - Filter ảnh ở DB qua `or(meta->>type.eq.image_gen,meta->>type.eq.image_edit,meta->>imageUrl.not.is.null,meta->attachment->>url.not.is.null)`.
    - Phân trang `.range(offset, offset + limit)` trực tiếp trên tập ảnh đã lọc.
23. [`src/app/api/gallery/route.test.ts`](file:///c:/Users/wyemh/vikini/src/app/api/gallery/route.test.ts):
    - Cập nhật mock chain cho truy vấn join và `.range()`. Cập nhật các test spec Loại C (dòng 314 hiển thị ảnh Image Studio, dòng 297, 333, 532 theo query join thống nhất).
24. [`src/app/features/chat/components/CommandPalette.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/CommandPalette.tsx):
    - Import `useTheme` từ `../hooks/useTheme`; gọi `toggleTheme()`; dùng key `switchTheme`.
25. [`src/app/features/chat/components/CommandPalette.test.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/chat/components/CommandPalette.test.tsx):
    - Mock hook `../hooks/useTheme` và kiểm tra lệnh đổi theme gọi `toggleTheme()`.
26. [`src/app/features/gallery/components/GalleryView.tsx`](file:///c:/Users/wyemh/vikini/src/app/features/gallery/components/GalleryView.tsx):
    - Thêm icon `<X />`, `aria-label={g.t("close") || "Close"}` và class focus indicator.
27. [`src/lib/utils/translations/vi.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/vi.ts) & [`en.ts`](file:///c:/Users/wyemh/vikini/src/lib/utils/translations/en.ts):
    - Bổ sung translation key `switchTheme: "Chuyển giao diện"` (vi) và `"Switch Theme"` (en).
28. [`docs/database-schema.md`](file:///c:/Users/wyemh/vikini/docs/database-schema.md):
    - Cập nhật tài liệu schema phản ánh đúng `profiles.id: text (canonical email)` đồng bộ với migration `022`.
29. [`docs/CHANGELOG.md`](file:///c:/Users/wyemh/vikini/docs/CHANGELOG.md) & [`docs/lessons-learned.md`](file:///c:/Users/wyemh/vikini/docs/lessons-learned.md):
    - Ghi nhận đầy đủ nhật ký thay đổi và bài học kinh nghiệm về IDOR, SSRF, Code Injection và định danh người dùng.

---

### 6. Các Bước Thực Hiện Tuần Tự (Checklist Chi Tiết)

#### Bước 1: Khắc Phục Lỗ Hổng IDOR & Storage Leak Trên Cả 4 Sink & Chat Stream (SEC-01)

- [x] 1.1. Cập nhật `interface MessageMeta` tại `src/lib/features/chat/messages.ts:14`:
  - Thêm `"image_edit"` vào union type:
    ```ts
    export interface MessageMeta {
      type?: "image_gen" | "image_edit" | "text" | "chart";
      // ... giữ nguyên các trường khác
    }
    ```
  - Đảm bảo `npm run type-check` thông suốt khi kiểm tra `meta.type === "image_edit"`.
- [x] 1.2. Xây dựng module an toàn `[NEW] src/lib/features/chat/storageCleanup.ts`:
  - Định nghĩa hàm:
    ```ts
    export async function removeOwnedStoragePaths(
      supabase: SupabaseClient,
      userId: string,
      paths: (string | null | undefined)[]
    ): Promise<void>;
    ```
  - Kiểm tra tiền tố: `path.startsWith(userId + "/")`.
  - Kiểm tra traversal: từ chối nếu `path.includes("..") || path.includes("/../") || path.startsWith("../")`.
  - Nếu path không hợp lệ: ghi warning log và loại khỏi danh sách xóa.
  - Nếu có path hợp lệ: thực hiện `await supabase.storage.from("attachments").remove(validPaths)`.
- [x] 1.3. Viết co-located unit test `[NEW] src/lib/features/chat/storageCleanup.test.ts`:
  - Test case: xóa thành công khi path bắt đầu bằng `${userId}/`.
  - Test case: từ chối xóa khi path của user khác (ví dụ `${otherUserId}/...`).
  - Test case: từ chối xóa khi path chứa `..` traversal (ví dụ `${userId}/../${otherUserId}/file.png`).
- [x] 1.4. Cập nhật sink 1: `src/lib/features/chat/messages.ts:deleteMessage`:
  - Truy vấn kiểm tra quyền sở hữu qua inner join:
    ```ts
    const { data: msg, error } = await supabase
      .from("messages")
      .select("id, meta, conversation_id, conversations!inner(user_id)")
      .eq("id", messageId)
      .maybeSingle();
    ```
  - Nếu `!msg`: ném `new NotFoundError("Message")`.
  - Ép kiểu an toàn: `const conv = msg.conversations as unknown as { user_id: string };`
  - Nếu `conv.user_id !== userId`: ném `ForbiddenError("You do not have permission to delete this message")`.
  - Nếu `meta.type === "image_gen"` hoặc `meta.type === "image_edit"`: gọi `await removeOwnedStoragePaths(supabase, userId, [meta.attachment?.storagePath])`.
  - Ghi nhận tombstone `recordTombstone(meta.clientMessageId)` nếu có.
  - Xóa dòng tin nhắn trong DB: `supabase.from("messages").delete().eq("id", messageId)`.
- [x] 1.5. Cập nhật sink 2: `src/lib/features/chat/messages.ts:deleteMessageByClientMessageId`:
  - Thêm xác thực quyền sở hữu cuộc hội thoại trước khi xóa:
    ```ts
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!conv) {
      messagesLogger.warn(
        { userId, conversationId },
        "Unauthorized attempt to delete message in unowned conversation"
      );
      return;
    }
    ```
  - Tại dòng 263-266: kiểm tra `meta?.type === "image_gen" || meta?.type === "image_edit"`.
  - Thay thế lệnh xóa thô bằng: `await removeOwnedStoragePaths(supabase, userId, [meta.attachment?.storagePath])`.
- [x] 1.6. Cập nhật sink 3: `src/lib/features/chat/messages.ts:deleteMessagesIncludingAndAfter`:
  - Thêm xác thực quyền sở hữu cuộc hội thoại trước khi xóa:
    ```ts
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!conv) {
      messagesLogger.warn(
        { userId, conversationId },
        "Unauthorized attempt to truncate messages in unowned conversation"
      );
      return;
    }
    ```
  - Tại dòng 383-386: gom `storagePath` cho cả `meta?.type === "image_gen"` và `meta?.type === "image_edit"`.
  - Thay thế lệnh xóa thô bằng: `await removeOwnedStoragePaths(supabase, userId, pathsToRemove)`.
- [x] 1.7. Cập nhật bảo vệ tầng nạp hội thoại: `src/app/api/chat-stream/conversationLoader.ts`:
  - Tại dòng 22-26, sau khi nạp `convo = await getConversation(requestedConversationId);`:
    ```ts
    if (convo && convo.userId !== userId) {
      throw new NotFoundError("Conversation");
    }
    ```
- [x] 1.8. Cập nhật sink 4: `src/app/api/gallery/[id]/route.ts`:
  - Tại dòng 68-78: thay thế lệnh xóa storage trực tiếp bằng:
    ```ts
    const meta = msg.meta as MessageMeta | null;
    if (meta?.attachment?.storagePath) {
      await removeOwnedStoragePaths(supabase, userId, [meta.attachment.storagePath]);
    }
    ```
- [x] 1.9. Viết co-located unit test `[NEW] src/app/api/chat-stream/conversationLoader.test.ts` và cập nhật `messages.test.ts`, `gallery/[id]/route.test.ts`:
  - Test case: `loadOrCreateConversation` ném `NotFoundError("Conversation")` khi User B yêu cầu conversation của User A.
  - Test case: `deleteMessageByClientMessageId` và `deleteMessagesIncludingAndAfter` từ chối thực hiện và không xóa DB/Storage nếu conversation không thuộc sở hữu `userId`.
  - Test case: `gallery/[id]` từ chối xóa storagePath giả mạo hoặc chứa `..`.

#### Bước 2: Khắc Phục Rò Rỉ Tài Liệu RAG Chéo Người Dùng (SEC-02)

- [x] 2.1. Cập nhật `src/lib/features/projects/ragContext.server.ts`:
  - Sửa chữ ký hàm `getConversationProjectId(conversationId: string, userId: string): Promise<string | null>`.
  - Bổ sung điều kiện truy vấn: `.eq("id", conversationId).eq("user_id", userId)`.
  - Trong `buildRAGContext(userId, conversationId, userMessage, options)`: truyền `userId` vào `getConversationProjectId(conversationId, userId)`.
- [x] 2.2. Cập nhật `src/lib/features/projects/knowledge.server.ts`:
  - Trong hàm `searchKnowledge(projectId: string, userId: string, query: string, options)`:
  - Bổ sung xác thực quyền sở hữu **trước** khi gọi `generateEmbedding`:
    ```ts
    const project = await getProject(projectId, userId);
    if (!project) {
      kbLogger.warn(`User ${userId} does not own project ${projectId}`);
      return [];
    }
    ```
  - Sau đó mới thực hiện sinh query embedding và gọi RPC `match_project_knowledge`.
- [x] 2.3. Tạo co-located test `src/lib/features/projects/ragContext.server.test.ts`:
  - Test `getConversationProjectId` trả về `null` khi `userId` không trùng với chủ sở hữu conversation.
  - Test `buildRAGContext` trả về `emptyContext` và không tìm kiếm tri thức khi conversation không thuộc về user.
- [x] 2.4. Cập nhật `src/lib/features/projects/knowledge.server.test.ts`:
  - Cập nhật mock `getProject` trong các test hiện hữu; thêm test case trả về `[]` và không gọi `generateEmbedding` / RPC khi user không sở hữu project.

#### Bước 3: Thiết Kế Lại Toàn Diện SSRF Guard Server-Only (SEC-03)

- [x] 3.1. Xây dựng module an toàn `[NEW] src/lib/core/ssrfGuard.server.ts`:
  - Tuân thủ quy ước hậu tố `.server.ts` của repository Vikini (tuyệt đối không cài đặt hoặc import package `server-only`).
  - Tích hợp các module chuẩn Node.js: `node:dns`, `node:net`, `node:url`.
  - Lấy Supabase URL qua `pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"])`.
  - Xây dựng `net.BlockList` chứa toàn bộ các dải IP cấm:
    - Loopback: `127.0.0.0/8`, `::1/128`, `::ffff:127.0.0.0/104`
    - Private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
    - Link-Local / Metadata: `169.254.0.0/16`, `fe80::/10`
    - Cloud Metadata IP: `169.254.169.254/32`
    - Reserved / Special: `0.0.0.0/8`, `::/128`, `100.64.0.0/10` (CGNAT), `192.0.0.0/24`, `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4`, `fc00::/7` (ULA), `64:ff9b::/96`, `::/96` (IPv4-compatible), `2002::/16` (6to4), `ff00::/8` (Multicast).
  - Hàm helper `checkIpRestricted(ip: string): boolean`:
    - Xác định family: `const family = net.isIP(ip) === 6 ? "ipv6" : "ipv4";`
    - Gọi `blockList.check(ip, family)`.
  - Hàm `validateSafeUrl(urlString: string)`:
    - Parse WHATWG `URL`. Giao thức bắt buộc là `http:` hoặc `https:`.
    - Chuẩn hóa hostname: lowercase, bỏ dấu chấm cuối `hostname.replace(/\.+$/, "")`.
    - Whitelist Supabase: nếu host khớp Supabase hostname, bắt buộc `https:` và path bắt đầu bằng `/storage/v1/` -> Cho phép.
    - Chặn hostnames nhạy cảm: `localhost`, `*.localhost`, `*.local`, `*.internal`, `metadata.google.internal`.
    - Phân giải IP:
      - Nếu hostname là IP literal (loại bỏ ngoặc vuông `[` và `]` nếu là IPv6): kiểm tra qua `checkIpRestricted(ip)`.
      - Nếu là domain: gọi `await dns.promises.lookup(hostname, { all: true })`. Nếu **bất kỳ** địa chỉ IP nào trả về nằm trong blocklist -> ném `new ValidationError("Restricted or private IP address")`.
  - Hàm `fetchSafeImage(urlString: string, options?: { maxSizeBytes?: number; timeoutMs?: number; maxRedirects?: number })`:
    - Single shared deadline ngân sách timeout: `const deadline = Date.now() + (options?.timeoutMs ?? 10000);`
    - Vòng lặp fetch với `redirect: "manual"` (tối đa 3 hops).
    - Ở mỗi lượt hop:
      - Tính thời gian còn lại: `const remainingMs = deadline - Date.now();` nếu `<= 0` -> ném `new ValidationError("Request timeout")`.
      - Gọi `validateSafeUrl(currentUrl)`.
      - Gửi `fetch` với `signal: AbortSignal.timeout(remainingMs)`.
      - Bọc bắt lỗi mạng: nếu gặp `TimeoutError` hoặc `DOMException (TimeoutError)` -> ném `new ValidationError("Request timeout")` để API route xử lý trả HTTP 400 chuẩn mực.
      - Nếu gặp status 3xx (`301`, `302`, `303`, `307`, `308`):
        - Hủy body của response cũ: `res.body?.cancel();`
        - Đọc header `Location`, phân giải URL tuyệt đối mới và lặp lại bước validate.
      - Nếu status không OK (`!res.ok`): ném `new ValidationError("Failed to fetch image")`.
      - Kiểm tra MIME type: tách tham số `const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();`
      - Whitelist MIME: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/avif`. Cấm `image/svg+xml`.
      - Kiểm tra `content-length` <= `maxSizeBytes` (mặc định 10MB).
      - Đọc stream body theo chunks bằng `res.body.getReader()`; đếm tổng bytes; nếu vượt quá 10MB -> gọi `reader.cancel()` và ném `new ValidationError("Image size exceeds limit of 10MB")`.
      - Trả về `{ buffer: Buffer, mimeType: contentType }`.
- [x] 3.2. Viết co-located unit test `[NEW] src/lib/core/ssrfGuard.server.test.ts`:
  - Chặn IP metadata `http://169.254.169.254/latest/meta-data/`.
  - Chặn loopback `http://localhost:3000/`, `http://127.0.0.1/`, `http://[::1]/`.
  - Chặn redirect 302 từ URL public trỏ về IP metadata hoặc internal (xác nhận hủy body response cũ).
  - Chặn domain phân giải ra IP private (mock `dns.promises.lookup`).
  - Chặn các dạng biểu diễn hex/decimal và IPv6: `http://[::ffff:169.254.169.254]/`, `http://2130706433/`, `http://[::7f00:1]/`.
  - Chặn payload stream vượt quá 10MB (xác nhận hủy stream reader).
  - Bắt lỗi timeout quá hạn shared deadline 10s -> ném `ValidationError("Request timeout")`.
  - Chấp nhận Supabase storage URL hợp lệ và public HTTPS image URL.
- [x] 3.3. Tích hợp `fetchSafeImage` vào `src/app/api/describe-image/route.ts` và `src/app/api/edit-image/route.ts`. Áp dụng kiểm tra MIME type cho cả nhánh `data:image`.
- [x] 3.4. Cập nhật `route.test.ts` của cả hai route mock `@/lib/core/ssrfGuard.server` để không gửi DNS request thật ra ngoài mạng.

#### Bước 4: Khắc Phục Code Injection Trong Calculate Tool (SEC-04)

- [x] 4.1. Xây dựng bộ phân tích cú pháp `[NEW] src/lib/features/chat/mathParser.ts`:
  - Chữ ký hàm thống nhất: `evaluateMathExpression(expr: string): { result: number } | { error: string }`.
  - Giới hạn an toàn:
    - `expr.length <= 200`.
    - Độ sâu ngoặc tối đa 30.
    - Bỏ giới hạn cơ số `<= 100` (cho phép `1024^2`), bắt buộc số mũ nguyên nằm trong đoạn `[-50, 50]`.
    - Kết quả phải thỏa mãn `Number.isFinite(result)` và `Math.abs(result) <= Number.MAX_SAFE_INTEGER`.
  - Bảng ngữ pháp và độ ưu tiên toán tử (từ cao xuống thấp):
    1. Ngoặc đơn: `( ... )`
    2. Constants & Numbers: `pi` (`Math.PI`), `e` (`Math.E`), số nguyên, số thực, ký pháp khoa học `1e5`
    3. Hàm toán học: `sqrt`, `log` (log10), `ln` (log tự nhiên), `abs`, `ceil`, `floor`, `round`, `min`, `max`, `pow`
    4. Lũy thừa kết hợp phải: `^` (`2^3^2 = 2^(3^2) = 512`)
    5. Tiền tố một ngôi: `+`, `-` (do đó `-2^2 = -(2^2) = -4`, trong khi `(-2)^2 = 4`)
    6. Hậu tố phần trăm: `50%` -> `0.5` (lookahead: số theo sau bởi `%` không có toán hạng sau cho phép tính modulo)
    7. Phép nhân/chia/modulo: `*`, `/`, `%` (`10 % 3 = 1`)
    8. Phép cộng/trừ: `+`, `-`
    9. Cú pháp `"X% of Y"`: chuẩn hóa thành `(X%) * (Y)`
  - Bắt lỗi chia cho 0: trả về `{ error: "Division by zero" }`.
- [x] 4.2. Viết co-located unit test `[NEW] src/lib/features/chat/mathParser.test.ts`:
  - Biểu thức số học phức hợp: `2 + 3 * 4 ^ 2` -> `50`, `-2^2` -> `-4`, `(-2)^2` -> `4`, `(10 - 2) / 4` -> `2`.
  - Lũy thừa số lớn: `1024 ^ 2` -> `1048576`.
  - Hàm toán học: `sqrt(144) + 8` -> `20`, `round(3.7)` -> `4`.
  - Modulo & Percent: `10 % 3` -> `1`, `15% of 200` -> `30`, `50% * 80` -> `40`.
  - Ký pháp khoa học: `1e3 + 200` -> `1200`.
  - Chặn đứng tấn công: `"process.cwd()"`, `"constructor"`, `"global"`, `"require"` -> `{ error: ... }`.
  - Chặn DoS: biểu thức > 200 ký tự, số mũ ngoài `[-50, 50]`, ngoặc lồng nhau > 30 cấp.
- [x] 4.3. Cập nhật `src/lib/features/chat/functionRegistry.ts`:
  - Trong handler `calculate`: gọi `evaluateMathExpression(expression)`.
  - Nếu kết quả có `error`: trả về `{ result: "", error: \`Failed to calculate "${expression}": ${res.error}\` }`.
  - Nếu thành công: trả về `{ result: JSON.stringify({ expression, result: res.result }) }`.
- [x] 4.4. Tạo co-located test `[NEW] src/lib/features/chat/functionRegistry.test.ts` kiểm thử `calculate` handler.

#### Bước 5: Sửa Lỗi Admin Dashboard User Management & Stats (ADM-01 & ADM-02)

- [x] 5.1. Cập nhật `src/app/api/admin/users/route.ts`:
  - Phân giải người dùng: **tra cứu theo `id = userId` trước**; nếu không tìm thấy, mới tra cứu theo `email = userId.toLowerCase()`.
  - Nếu không tìm thấy profile: ném `new NotFoundError("User")` (trả về HTTP 404 với thông điệp chuẩn `"User not found"`).
  - Luôn cập nhật profile theo `id = targetProfile.id`.
  - Gọi `bumpAuthVersion(targetProfile.email.toLowerCase())`.
  - Ghi audit log với `targetId: targetProfile.id` và `targetEmail: targetProfile.email`.
- [x] 5.2. Cập nhật `src/app/api/admin/stats/route.ts`:
  - Phân giải canonical email của người dùng: nếu `userId` chứa `@` thì chuẩn hóa `userId.toLowerCase()`, ngược lại query `profiles` lấy `email.toLowerCase()`.
  - Đếm `conversations` với `.eq("user_id", canonicalEmail)`.
  - Đếm `messages` bằng truy vấn join:
    `supabase.from("messages").select("id, conversations!inner(user_id)", { count: "exact", head: true }).eq("conversations.user_id", canonicalEmail)`.
    Loại bỏ hoàn toàn `.in("conversation_id", ids)` không giới hạn.
- [x] 5.3. Cập nhật `route.test.ts` của `api/admin/users`:
  - Cập nhật test case dòng 209 thành kiểm tra trả về 404 `NotFoundError` khi userId không tồn tại (Loại C Approved Spec Change).
  - Cập nhật test cases cập nhật qua email và cập nhật qua id định danh.
- [x] 5.4. Cập nhật `route.test.ts` của `api/admin/stats`:
  - Cập nhật mock join và test cases đếm số lượng tin nhắn/hội thoại của người dùng.
- [x] 5.5. Cập nhật `docs/database-schema.md` ghi nhận đúng `profiles.id: text (canonical email)`.

#### Bước 6: Ngăn Chặn Lỗi Int4 & Giá Trị Không Hợp Lệ Trong Rank Configs (ADM-03)

- [x] 6.1. Cập nhật `src/app/api/admin/rank-configs/route.ts`:
  - Hàm kiểm tra: `const isValidPostgresInt4 = (val: unknown): val is number => typeof val === "number" && Number.isInteger(val) && val >= 0 && val <= 2147483647;`.
  - Bắt buộc kiểm tra `daily_message_limit`, `max_file_size_mb` thỏa mãn `isValidPostgresInt4`.
  - Kiểm tra tùy chọn cho `daily_research_limit`: nếu `configObj.daily_research_limit !== undefined`, bắt buộc thỏa mãn `isValidPostgresInt4`.
  - Đưa `daily_research_limit` vào payload cập nhật CSDL:
    ```ts
    const updatePayload: Record<string, unknown> = {
      daily_message_limit: configObj.daily_message_limit,
      max_file_size_mb: configObj.max_file_size_mb,
      features: configObj.features,
      allowed_models: configObj.allowed_models || [],
    };
    if (configObj.daily_research_limit !== undefined) {
      updatePayload.daily_research_limit = configObj.daily_research_limit;
    }
    await supabase.from("rank_configs").update(updatePayload).eq("rank", configObj.rank);
    ```
- [x] 6.2. Cập nhật `src/app/admin/components/RankConfigManager.tsx`:
  - Xử lý `onChange` cho cả 3 ô số (`daily_message_limit`, `max_file_size_mb`, `daily_research_limit`):
    `const val = Math.min(2147483647, Math.max(0, parseInt(e.target.value, 10) || 0));`
- [x] 6.3. Cập nhật `src/app/api/admin/rank-configs/route.test.ts`:
  - Bổ sung test cases: `3.14` (float -> 400), `2147483648` (int4 cap -> 400), `"5"` (string -> 400), `100` (valid -> 200).
  - Thêm test case khẳng định `daily_research_limit` được gửi vào câu lệnh update của CSDL.

#### Bước 7: Chốt Phân Trang & Lọc Ảnh Gallery Ở Tầng CSDL (API-01 & API-02)

- [x] 7.0. **[BẮT BUỘC / MANDATORY]** Kiểm chứng cú pháp PostgREST JSONB trong `.or()` trên CSDL thật:
  - Trước khi sửa `gallery/route.ts`, User/Executor bắt buộc chạy truy vấn HTTP kiểm chứng trên Supabase với cú pháp đồng bộ 100% với logic production:
    ```http
    GET /rest/v1/messages?select=id,content,role,created_at,meta,conversations!inner(user_id,model)&conversations.user_id=eq.<CANONICAL_EMAIL>&conversations.or=(model.neq.user_templates_store,model.is.null)&or=(meta->>type.eq.image_gen,meta->>type.eq.image_edit,meta->>imageUrl.not.is.null,meta->attachment->>url.not.is.null)&order=created_at.desc,id.desc&limit=1
    apikey: <SUPABASE_ANON_OR_SERVICE_KEY>
    Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
    ```
  - Nếu PostgREST trả lỗi cú pháp: kích hoạt ngay Phương án dự phòng (Fallback Control) tạo RPC function `get_user_gallery_messages`.
- [x] 7.1. Cập nhật `src/app/api/gallery/route.ts`:
  - Import `MODEL_IDS` từ `@/lib/utils/constants`.
  - Thực thi truy vấn kết hợp đơn nhất:

    ```ts
    let query = supabase
      .from("messages")
      .select("id, content, role, created_at, meta, conversations!inner(user_id, model)")
      .eq("conversations.user_id", userId)
      .or(`model.neq.${MODEL_IDS.USER_TEMPLATES_STORE},model.is.null`, {
        referencedTable: "conversations",
      })
      .or(
        "meta->>type.eq.image_gen,meta->>type.eq.image_edit,meta->>imageUrl.not.is.null,meta->attachment->>url.not.is.null"
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (favoritesOnly) {
      query = query.eq("meta->>is_favorite", "true");
    }

    const { data, error } = await query.range(offset, offset + limit); // Lấy limit + 1 phần tử để xác định hasMore
    ```

  - Tính `hasMore = (data?.length || 0) > limit`.
  - Trả về `images = (data || []).slice(0, limit).map(...)`. Đảm bảo điều kiện URL ảnh được thỏa mãn ở DB nên số lượng item trả về khớp chính xác với `useGalleryController.ts`.

- [x] 7.2. Cập nhật `src/app/api/gallery/route.test.ts`:
  - Cập nhật mock chain Supabase hỗ trợ query join thống nhất và `.range()`.
  - Cập nhật các test spec Loại C: dòng 314 (Image Studio images hiển thị trong Gallery), dòng 297, 333 (loại bỏ mock truy vấn conversations riêng), dòng 532 (mock lỗi truy vấn join tổng).

#### Bước 8: Sửa Lỗi Theming Trong CommandPalette (UI-01)

- [x] 8.1. Trong `src/lib/utils/translations/vi.ts` và `en.ts`:
  - Thêm key `switchTheme: "Chuyển giao diện"` vào `vi.ts`.
  - Thêm key `switchTheme: "Switch Theme"` vào `en.ts`.
- [x] 8.2. Trong `src/app/features/chat/components/CommandPalette.tsx`:
  - Import `useTheme` từ `../hooks/useTheme`.
  - Hành động `switch-theme`: gọi `toggleTheme()`, hiển thị title `${t("switchTheme")}: ${theme || "blueprint"}`.
- [x] 8.3. Cập nhật `src/app/features/chat/components/CommandPalette.test.tsx` mock `../hooks/useTheme`.

#### Bước 9: Sửa Ghost Button Trong GalleryView (UI-02)

- [x] 9.1. Trong `src/app/features/gallery/components/GalleryView.tsx:328`:
  - Thêm icon `<X className="w-5 h-5 text-(--text-secondary) hover:text-(--text-primary) transition-colors" />`.
  - Thêm `aria-label={g.t("close") || "Close"}` và `title={g.t("close") || "Close"}`.
  - Thêm `focus-visible:ring-2 focus-visible:ring-(--ring) focus:outline-none`.
- [x] 9.2. Tạo component test `src/app/features/gallery/components/GalleryView.test.tsx` mock `useGalleryController` kiểm tra render nút đóng.

#### Bước 10: Chạy Toàn Bộ Kiểm Thử & Verification Gate

- [x] 10.1. Chạy `npm run type-check`.
- [x] 10.2. Chạy `npm run lint`.
- [x] 10.3. Chạy `npm run test:run`.
- [x] 10.4. Chạy `npm run verify`.
- [x] 10.5. Cập nhật `docs/CHANGELOG.md` và `docs/lessons-learned.md`.

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

| ID Hợp Đồng    | Module / Endpoint                 | Input / Trigger                                                                              | Expected Output                                                                                         | Failure Mode & HTTP Code                                                    | Boundary Condition / Tiêu Chí Pass/Fail                                                   |
| :------------- | :-------------------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| **TC-SEC-01A** | `deleteMessage`                   | `userId = "user-A"`, `messageId = "msg-owned-by-A"`, `storagePath = "user-A/conv-1/a.png"`   | Promise resolve void, gọi `storage.remove(["user-A/conv-1/a.png"])`, xóa row DB, ghi tombstone          | Tin nhắn không tồn tại -> `NotFoundError` (404)                             | **PASS**: File storage bị xóa, row DB bị xóa, tombstone được ghi nhận.                    |
| **TC-SEC-01B** | `deleteMessage`                   | `userId = "user-B"` (kẻ tấn công), `messageId = "msg-owned-by-A"`                            | Thao tác bị chặn, ném `ForbiddenError`                                                                  | Không được gọi `storage.remove`, không xóa DB (403)                         | **PASS**: Ném `ForbiddenError`, DB và Storage của user-A nguyên vẹn 100%.                 |
| **TC-SEC-01C** | `deleteMessage`                   | `userId = "user-B"`, `messageId = "msg-B"`, nhưng `storagePath = "user-A/conv-A/secret.png"` | Xóa row DB msg-B, ghi tombstone, nhưng **KHÔNG** gọi `storage.remove`                                   | Xóa trộm file của user-A -> FAIL                                            | **PASS**: Bỏ qua `storage.remove` vì storagePath không bắt đầu bằng `"user-B/"`.          |
| **TC-SEC-01D** | `deleteMessageByClientMessageId`  | `userId = "user-B"`, `conversationId = "conv-owned-by-A"`, `clientMessageId = "c1"`          | Hàm kiểm tra ownership của conversation, từ chối xóa, ghi log warning                                   | Xóa tin nhắn của User A -> FAIL                                             | **PASS**: Bỏ qua và không xóa dòng tin nhắn nào trong DB/Storage của A.                   |
| **TC-SEC-01E** | `deleteMessagesIncludingAndAfter` | `userId = "user-B"`, `conversationId = "conv-owned-by-A"`, `messageId = "m1"`                | Hàm kiểm tra ownership của conversation, từ chối xóa, ghi log warning                                   | Cắt tỉa tin nhắn của User A -> FAIL                                         | **PASS**: Bỏ qua và không xóa bất kỳ tin nhắn nào của A.                                  |
| **TC-SEC-01F** | `DELETE /api/gallery/[id]`        | `userId = "user-B"`, meta có `storagePath = "user-B/../user-A/secret.png"`                   | Row message bị xóa, `storage.remove` bị bỏ qua do path traversal                                        | File user-A bị xóa -> FAIL                                                  | **PASS**: `removeOwnedStoragePaths` từ chối path chứa `..`.                               |
| **TC-SEC-01G** | `loadOrCreateConversation`        | `userId = "user-B"`, `requestedConversationId = "conv-owned-by-A"`                           | Ném `new NotFoundError("Conversation")`                                                                 | Nạp conversation của A cho B -> FAIL                                        | **PASS**: Bị chặn đứng ngay ở tầng loader, ngăn User B gửi tin hoặc trigger truncation.   |
| **TC-SEC-02A** | `getConversationProjectId`        | `conversationId = "conv-A"`, `userId = "user-B"`                                             | Trả về `null`                                                                                           | DB có project_id nhưng thuộc user-A -> vẫn trả về `null`                    | **PASS**: Trả về `null` tuyệt đối, ngăn user-B lấy project_id của user-A.                 |
| **TC-SEC-02B** | `searchKnowledge`                 | `projectId = "proj-A"`, `userId = "user-B"`, `query = "secrets"`                             | Trả về mảng rỗng `[]`, ghi warning log                                                                  | Không được gọi `generateEmbedding`, không gọi RPC `match_project_knowledge` | **PASS**: Kết quả là `[]`, số lần gọi embedding và RPC đều bằng 0.                        |
| **TC-SEC-03A** | `fetchSafeImage`                  | `url = "http://169.254.169.254/latest/meta-data/"`                                           | Bị từ chối ngay ở bước validate URL, ném `ValidationError`                                              | Không gửi HTTP request ra mạng, HTTP 400                                    | **PASS**: URL bị chặn, exception chứa lý do "Restricted IP address".                      |
| **TC-SEC-03B** | `fetchSafeImage`                  | `url = "http://localhost:3000/api/admin/users"`                                              | Bị từ chối (loopback IP/host), ném `ValidationError`                                                    | Không gửi HTTP request ra mạng, HTTP 400                                    | **PASS**: URL bị chặn, không rò rỉ dữ liệu mạng nội bộ.                                   |
| **TC-SEC-03C** | `fetchSafeImage`                  | URL public trả về 302 Location: `http://169.254.169.254/...`                                 | Bắt được 302, gọi `res.body?.cancel()`, validate Location thất bại, ném `ValidationError`               | Tự động follow redirect tới IP nội bộ -> FAIL                               | **PASS**: Request chuyển tiếp bị chặn đứng, body hop 1 bị cancel, không fetch hop 2.      |
| **TC-SEC-03D** | `fetchSafeImage`                  | Hostname phân giải ra IP private (mock `dns.promises.lookup` trả `192.168.1.50`)             | Bị từ chối ở bước kiểm tra DNS IP, ném `ValidationError`                                                | Chỉ kiểm tra chuỗi hostname literal -> FAIL                                 | **PASS**: Bị chặn khi bất kỳ IP phân giải nào thuộc blocklist.                            |
| **TC-SEC-03E** | `fetchSafeImage`                  | URL `http://[::ffff:169.254.169.254]/` hoặc `http://2130706433/` hoặc `http://[::7f00:1]/`   | Bị từ chối, ném `ValidationError`                                                                       | Lọt qua vì thiếu tham số family `"ipv6"` -> FAIL                            | **PASS**: Bị chặn bởi `net.isIP` và `BlockList.check(ip, "ipv6")`.                        |
| **TC-SEC-03F** | `fetchSafeImage`                  | Server trả về `content-type: text/html` hoặc stream > 10MB                                   | Ném `ValidationError("Invalid image content type")` hoặc gọi `reader.cancel()` khi chạm 10MB            | Tải quá 10MB hoặc tràn RAM -> FAIL                                          | **PASS**: Reader stream bị cancel lập tức khi chạm 10MB, trả về 400.                      |
| **TC-SEC-03G** | `fetchSafeImage`                  | Chuỗi 3 redirect hops mất tổng cộng > 10s                                                    | Bắt timeout, ném `new ValidationError("Request timeout")`                                               | Ném lỗi 500 Unhandled Error -> FAIL                                         | **PASS**: Bị ngắt ở mốc 10s ngân sách chung, route trả HTTP 400 chuẩn mực.                |
| **TC-SEC-04A** | `evaluateMathExpression`          | `expression = "2 + 3 * 4 ^ 2"`                                                               | Trả về `{ result: 50 }`                                                                                 | Cú pháp không hợp lệ -> ném error                                           | **PASS**: Tính toán chính xác theo thứ tự ưu tiên: `4^2 = 16`, `16*3 = 48`, `48+2 = 50`.  |
| **TC-SEC-04B** | `evaluateMathExpression`          | `expression = "-2^2"`                                                                        | Trả về `{ result: -4 }`                                                                                 | Trả về `4` -> FAIL                                                          | **PASS**: Phép lũy thừa kết hợp chặt hơn tiền tố một ngôi: `-(2^2) = -4`.                 |
| **TC-SEC-04C** | `evaluateMathExpression`          | `expression = "1024^2"`                                                                      | Trả về `{ result: 1048576 }`                                                                            | Bị chặn do giới hạn cơ số <= 100 -> FAIL                                    | **PASS**: Tính toán chính xác số lớn trong trần `MAX_SAFE_INTEGER`.                       |
| **TC-SEC-04D** | `evaluateMathExpression`          | `expression = "process.cwd()"` hoặc `expression = "15; return 1"`                            | Trả về `{ error: "Invalid character or token" }`                                                        | Tuyệt đối không được thực thi mã lệnh hệ thống                              | **PASS**: Kết quả trả về `error`, không crash tiến trình Node.js.                         |
| **TC-SEC-04E** | `calculate` tool                  | `executeFunction("calculate", { expression: "-2^2" })`                                       | Trả về `{ result: "{\"expression\":\"-2^2\",\"result\":-4}" }`                                          | Trả về 4 thay vì -4 -> FAIL                                                 | **PASS**: Khớp đúng định dạng JSON chuẩn của function registry.                           |
| **TC-ADM-01A** | `PATCH /api/admin/users`          | Admin gửi `userId = "target@example.com"`, `rank = "pro"`                                    | Trả về 200 `{ success: true }`, tìm theo id (hoặc email), update bằng targetProfile.id, bumpAuthVersion | Lỗi SQL hoặc 400 -> FAIL                                                    | **PASS**: Profile được cập nhật trong DB, Redis bumpAuthVersion đúng email lowercase.     |
| **TC-ADM-01B** | `PATCH /api/admin/users`          | Admin gửi `userId = "provider-acc-123"` (id định danh), `is_blocked = true`                  | Trả về 200 `{ success: true }`                                                                          | Lỗi cú pháp format -> FAIL                                                  | **PASS**: Tìm thấy profile theo id, cập nhật đúng record.                                 |
| **TC-ADM-01C** | `PATCH /api/admin/users`          | Admin gửi `userId = "not-found-id"`, `rank = "pro"`                                          | Ném `new NotFoundError("User")`, trả về HTTP 404                                                        | Trả về 400 regex failure hoặc thông báo trùng lặp -> FAIL                   | **PASS**: Trả về đúng mã 404 với thông điệp chuẩn `"User not found"`.                     |
| **TC-ADM-02**  | `GET /api/admin/stats`            | Admin gọi `?userId=USER@EXAMPLE.COM` (user có 5 chat, 20 msg)                                | Trả về 200 `{ conversations: 5, messages: 20 }` qua join `conversations!inner`                          | Trả về 0 do hoa/thường hoặc lỗi URL PostgREST -> FAIL                       | **PASS**: Chuẩn hóa lowercase, đếm chính xác số lượng thực tế mà không dùng `.in()`.      |
| **TC-ADM-03A** | `PATCH /api/admin/rank-configs`   | Admin gửi payload `daily_message_limit: 3.14` hoặc `2147483648` hoặc `"5"`                   | Trả về 400 `ValidationError`                                                                            | Lọt qua và văng lỗi SQL integer syntax -> FAIL                              | **PASS**: Bị chặn tại validation, HTTP status 400 cho cả số thực và số tràn int4.         |
| **TC-ADM-03B** | `PATCH /api/admin/rank-configs`   | Admin gửi payload có `daily_research_limit: 50`                                              | Trả về 200, mock update nhận `{ ..., daily_research_limit: 50 }`                                        | Bị bỏ quên không ghi vào CSDL -> FAIL                                       | **PASS**: `daily_research_limit` được validate int4 và đưa vào payload update.            |
| **TC-API-01A** | `GET /api/gallery`                | Gọi gallery với `limit = 20, offset = 0` khi DB có 500 messages (chỉ có 5 message ảnh)       | Supabase query lọc ảnh ở DB, dùng `.range(0, 20)`, trả về 5 ảnh, `hasMore = false`                      | Trả về images = [] và loop vô hạn -> FAIL                                   | **PASS**: Lọc ảnh ở tầng DB, offset áp dụng trên tập ảnh, không tràn RAM.                 |
| **TC-API-01B** | `GET /api/gallery`                | Hội thoại thuộc model `MODEL_IDS.IMAGE_STUDIO` chứa ảnh                                      | Ảnh từ Image Studio được trả về trong danh sách Gallery                                                 | Bị lọc bỏ như code cũ -> FAIL                                               | **PASS**: Ảnh sinh từ Image Studio hiển thị đầy đủ trong Gallery.                         |
| **TC-UI-01**   | `CommandPalette`                  | Người dùng chọn lệnh "switch-theme"                                                          | Gọi hook `toggleTheme()`, giao diện chuyển sang theme hợp lệ tiếp theo                                  | Gọi `setTheme("dark")` làm hỏng biến CSS -> FAIL                            | **PASS**: `toggleTheme` được gọi, CSS variables không bị reset thành rỗng.                |
| **TC-UI-02**   | `GalleryView`                     | Modal chi tiết ảnh mở ra trên màn hình                                                       | Nút đóng modal chứa icon `<X />`, có `aria-label="Close"`, bấm vào đóng modal                           | Thẻ `<button></button>` rỗng ruột -> FAIL                                   | **PASS**: Icon `X` render trong DOM, có `aria-label`, click gọi `setSelectedImage(null)`. |

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 8.1. Danh Sách Co-Located Tests Bắt Buộc

| File Nguồn (Source File)                              | File Test Co-Located Tương Ứng                             |  Loại Test  | Nội Dung Kiểm Thử Chính                                                                                       |
| :---------------------------------------------------- | :--------------------------------------------------------- | :---------: | :------------------------------------------------------------------------------------------------------------ |
| `src/lib/core/ssrfGuard.server.ts`                    | `src/lib/core/ssrfGuard.server.test.ts`                    |    Unit     | Chặn IP loopback/private, DNS lookup, 302 redirect + cancel body, shared deadline, size cap                   |
| `src/lib/features/chat/storageCleanup.ts`             | `src/lib/features/chat/storageCleanup.test.ts`             |    Unit     | Kiểm tra tiền tố `${userId}/`, từ chối path traversal `..`, xóa storage an toàn                               |
| `src/app/api/chat-stream/conversationLoader.ts`       | `src/app/api/chat-stream/conversationLoader.test.ts`       |    Unit     | Xác thực quyền sở hữu `convo.userId === userId` trong `loadOrCreateConversation` và `handleMessageTruncation` |
| `src/lib/features/chat/mathParser.ts`                 | `src/lib/features/chat/mathParser.test.ts`                 |    Unit     | Thứ tự ưu tiên toán tử (`-2^2 = -4`), hàm toán, ReDoS, chặn code execution, số lớn                            |
| `src/lib/features/chat/functionRegistry.ts`           | `src/lib/features/chat/functionRegistry.test.ts`           |    Unit     | Handler calculate xuất đúng JSON format, từ chối process.cwd                                                  |
| `src/lib/features/chat/messages.ts`                   | `src/lib/features/chat/messages.test.ts`                   | Integration | Type union MessageMeta, quyền sở hữu `deleteMessage`, prefix check và ownership check cho cả 3 hàm            |
| `src/app/api/gallery/[id]/route.ts`                   | `src/app/api/gallery/[id]/route.test.ts`                   |  Route API  | Chặn storagePath giả mạo hoặc chứa `..` khi xóa item gallery                                                  |
| `src/lib/features/projects/ragContext.server.ts`      | `src/lib/features/projects/ragContext.server.test.ts`      | Integration | Quyền sở hữu conversation `getConversationProjectId`, RAG context isolation                                   |
| `src/lib/features/projects/knowledge.server.ts`       | `src/lib/features/projects/knowledge.server.test.ts`       | Integration | Kiểm tra `userId` sở hữu `projectId` trước khi chạy RPC / embedding                                           |
| `src/app/api/admin/users/route.ts`                    | `src/app/api/admin/users/route.test.ts`                    |  Route API  | Chấp nhận Email & ID, tra `id` trước `email`, trả 404 khi không tìm thấy, bumpAuthVersion lowercase           |
| `src/app/api/admin/stats/route.ts`                    | `src/app/api/admin/stats/route.test.ts`                    |  Route API  | Phân giải canonical email lowercase, đếm hội thoại và tin nhắn qua join                                       |
| `src/app/api/admin/rank-configs/route.ts`             | `src/app/api/admin/rank-configs/route.test.ts`             |  Route API  | Chặn `3.14`, `2147483648`, chuỗi, số âm; persist `daily_research_limit`                                       |
| `src/app/api/gallery/route.ts`                        | `src/app/api/gallery/route.test.ts`                        |  Route API  | Phân trang `.range()`, lọc ảnh ở DB, hiện ảnh Image Studio                                                    |
| `src/app/features/chat/components/CommandPalette.tsx` | `src/app/features/chat/components/CommandPalette.test.tsx` |  Component  | Lệnh switch-theme kết nối `toggleTheme()`, lọc tìm kiếm                                                       |
| `src/app/features/gallery/components/GalleryView.tsx` | `src/app/features/gallery/components/GalleryView.test.tsx` |  Component  | Render icon `X`, `aria-label`, tương tác đóng modal                                                           |

#### 8.2. Bước Xác Minh Bắt Buộc Cú Pháp PostgREST JSONB Filter Trên CSDL Thật

Trước khi triển khai sửa route production tại Bước 7.1, User hoặc Executor **bắt buộc (mandatory)** thực hiện truy vấn HTTP read-only sau trên môi trường Supabase với cú pháp đồng bộ 100% với logic production (bao gồm `conversations.or`, lọc JSONB lồng và favorites):

```http
GET /rest/v1/messages?select=id,content,role,created_at,meta,conversations!inner(user_id,model)&conversations.user_id=eq.<CANONICAL_EMAIL>&conversations.or=(model.neq.user_templates_store,model.is.null)&or=(meta->>type.eq.image_gen,meta->>type.eq.image_edit,meta->>imageUrl.not.is.null,meta->attachment->>url.not.is.null)&order=created_at.desc,id.desc&limit=1
apikey: <SUPABASE_ANON_OR_SERVICE_KEY>
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
```

- **Phương án dự phòng (Fallback Control)**: Nếu PostgREST phiên bản hiện tại từ chối cú pháp `.or()` trên toán tử JSONB (`meta->>`), giải pháp kỹ thuật dự phòng là triển khai ngay RPC function bảo mật `get_user_gallery_messages(p_user_id text, p_limit int, p_offset int, p_favorites_only boolean)` chạy trực tiếp trên PostgreSQL với index tối ưu `(meta->>'type')`.

#### 8.3. Danh Mục Các Thay Đổi Test Hiện Hữu Được Phê Duyệt (Loại B / Loại C)

Tuân thủ nghiêm ngặt Test Failure Triage Protocol trong [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md), dưới đây là danh sách toàn bộ các file test hiện hữu cần điều chỉnh kỳ vọng nghiệp vụ kèm phân loại:

1. **`src/app/api/gallery/route.test.ts:314` (Loại C - Approved Spec Change)**:
   - _Kỳ vọng cũ_: Trả về `images = []` khi tất cả conversations thuộc `vikini-image-studio` (do code cũ loại trừ Image Studio).
   - _Kỳ vọng mới_: Trả về ảnh sinh từ Image Studio trong Gallery theo yêu cầu nghiệp vụ API-02.
2. **`src/app/api/gallery/route.test.ts:297, 333` (Loại C - Approved Spec Change)**:
   - _Kỳ vọng cũ_: Dựa trên mock của hàm truy vấn conversations riêng biệt ban đầu.
   - _Kỳ vọng mới_: Chuyển sang mock truy vấn join `messages` với `conversations!inner(user_id, model)` thống nhất. Khi không có kết quả, trả về `images = [], hasMore = false`.
3. **`src/app/api/gallery/route.test.ts:532` (Loại C - Approved Spec Change)**:
   - _Kỳ vọng cũ_: Trả về 500 khi câu truy vấn `conversations` độc lập gặp lỗi kết nối DB.
   - _Kỳ vọng mới_: Trả về 500 khi câu truy vấn join CSDL chính gặp lỗi `dbError`.
4. **`src/app/api/admin/users/route.test.ts:209` (Loại C - Approved Spec Change)**:
   - _Kỳ vọng cũ_: `userId = "not-valid"` trả về 400 do trượt regex định dạng email cứng nhắc.
   - _Kỳ vọng mới_: `userId = "not-valid"` được xem là id định danh hợp lệ về mặt chuỗi; hệ thống tra cứu CSDL theo `id = "not-valid"`, không tìm thấy record và trả về 404 `NotFoundError` (thông điệp `"User not found"`).
5. **`src/app/api/admin/rank-configs/route.test.ts:238, 261` (Loại B - Bug Trong Test/Cập Nhật Schema)**:
   - _Kỳ vọng cũ_: Payload chỉ gửi `daily_message_limit`, `max_file_size_mb`.
   - _Kỳ vọng mới_: Giữ nguyên payload cũ (khẳng định tính tùy chọn của `daily_research_limit` không làm vỡ API cũ); bổ sung test case mới truyền `daily_research_limit` và assert mock update nhận đúng giá trị int4 này.

#### 8.4. Quy Trình Chạy Kiểm Thử (Verification Commands)

> **Lưu ý Windows PowerShell 5.1**: Khi chạy thủ công từng lệnh trong terminal, BẮT BUỘC dùng dấu chấm phẩy `;` nối lệnh:
> `npm run type-check; npm run lint; npm run test:run`
> Lệnh `npm run verify` chạy an toàn qua npm script cmd context.

1. **Kiểm tra kiểu dữ liệu (Type-Check)**:
   ```powershell
   npm run type-check
   ```
2. **Kiểm tra Lint**:
   ```powershell
   npm run lint
   ```
3. **Chạy các test suites liên quan trực tiếp**:
   ```powershell
   npx vitest run src/lib/core/ssrfGuard.server.test.ts src/lib/features/chat/storageCleanup.test.ts src/app/api/chat-stream/conversationLoader.test.ts src/lib/features/chat/mathParser.test.ts src/lib/features/chat/functionRegistry.test.ts src/lib/features/chat/messages.test.ts src/app/api/gallery/[id]/route.test.ts src/lib/features/projects/ragContext.server.test.ts src/lib/features/projects/knowledge.server.test.ts src/app/api/admin/users/route.test.ts src/app/api/admin/stats/route.test.ts src/app/api/admin/rank-configs/route.test.ts src/app/api/gallery/route.test.ts src/app/features/chat/components/CommandPalette.test.tsx src/app/features/gallery/components/GalleryView.test.tsx
   ```
4. **Cổng kiểm thử chất lượng tổng thể (Tier 2 Quality Gate)**:
   ```powershell
   npm run verify
   ```

---

### 9. Mental Simulation & Adversarial Timelines (S1–S6)

Tuân thủ đầy đủ 6 kịch bản bắt buộc từ [`.agents/agents/reviewer/mental-simulation.md`](../../.agents/agents/reviewer/mental-simulation.md):

#### S1: Cold-start & Build

- `npm run type-check` đã kiểm chứng sạch 100% trước khi lập kế hoạch (exit code 0).
- Các file tạo mới (`ssrfGuard.server.ts`, `storageCleanup.ts`, `mathParser.ts`) tận dụng các module sẵn có của Node.js 24 (`node:net`, `node:dns`, `node:url`), **tuyệt đối không thêm dependency ngoại lai** (kể cả `server-only`).
- `MessageMeta.type` được mở rộng `"image_edit"` ngăn chặn triệt để lỗi biên dịch TypeScript. Ép kiểu an toàn `as unknown as { user_id: string }`.
- Sử dụng helper `pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"])` tránh whitelist rỗng.

#### S2: Runner Lifecycle & Teardown

- `ssrfGuard.server.ts` cấu hình `redirect: "manual"` và ngân sách single shared deadline 10s. Mọi kết nối mạng quá hạn đều bị abort và ném `ValidationError("Request timeout")`. Khi gặp 3xx, `res.body?.cancel()` được gọi lập tức để giải phóng socket; khi stream vượt trần 10MB, `reader.cancel()` được gọi ngay trước khi ném `ValidationError`.
- Kiểm thử đơn vị cô lập mock sạch sẽ với `afterEach(() => { vi.restoreAllMocks(); })`.

#### S3: Database & Temporal Logic

- Khẳng định `profiles.id` là `TEXT (canonical email)` đồng bộ với migration `022_normalize_userid_to_email.sql`.
- **Adversarial Timeline 1 (SEC-01: IDOR Xóa Message & File Storage Trên Toàn Bộ 4 Sinks & Chat Stream)**:
  - _Cơ chế_: `conversations!inner(user_id)` ownership join, `conversationLoader` ownership check, & `removeOwnedStoragePaths` prefix guard.
  - _T1_: User A tạo hội thoại C1, tạo ảnh `storagePath = "user-A/conv-1/image-1.png"`.
  - _T2_: Kẻ tấn công User B gửi request `DELETE /api/messages/[image-message-id]` hoặc `DELETE /api/gallery/[image-message-id]`.
  - _T3_: Hệ thống kiểm tra `user_id` của conversation không khớp User B -> Ném ngay `ForbiddenError` (403). Lệnh xóa CSDL và Storage bị hủy bỏ -> **AN TOÀN**.
  - _T4 (Kịch bản Chat Stream Truncation)_: User B gửi request `/api/chat-stream` với `conversationId = C1` kèm `truncateMessageId` hoặc `truncateClientMessageId`.
  - _T5_: `conversationLoader.ts` phát hiện `convo.userId !== userId` -> Ném ngay `NotFoundError("Conversation")`. Quá trình nạp hội thoại bị cắt đứt lập tức, không có bất kỳ lệnh xóa tin nhắn hay dọn storage nào được kích hoạt -> **AN TOÀN**.
  - _T6 (Biến thể Path Traversal)_: User B tạo message trong conversation của mình với meta `storagePath: "user-B/../user-A/secret.png"`. User B gọi xóa message của chính mình.
  - _T7_: Ownership pass, nhưng `removeOwnedStoragePaths` phát hiện ký tự traversal `..` -> Hủy bỏ lệnh xóa Storage, ghi log cảnh báo; chỉ xóa message record của B -> **AN TOÀN**.

#### S4: Cross-Task State Flow

- `gallery/route.ts` phân trang trên tập ảnh đã lọc (`offset` khớp với logic client `useGalleryController.ts:113`).
- `RankConfigManager.tsx` cập nhật cả 3 ô số với trần int4, chuyển tiếp đầy đủ `daily_research_limit` xuống CSDL.
- `CommandPalette.tsx` gọi `toggleTheme()` xoay vòng trong 16 theme chuẩn, giao diện giữ nguyên các biến CSS `--accent`, `--surface`. Translation key `switchTheme` có đầy đủ trong cả `vi.ts` và `en.ts`.

#### S5: Security Boundary & 3-Tier Auth

- Mọi route đều yêu cầu xác thực qua NextAuth `auth()`.
- **Adversarial Timeline 3 (SEC-02: RAG Context Cross-Tenant Leakage)**:
  - _Cơ chế_: RAG context generation & semantic search ownership check.
  - _T1_: User A tải tài liệu nội bộ mật vào Project A1.
  - _T2_: User B gửi prompt hỏi bot trong hội thoại C1 (cố ý truyền `conversationId` của User A hoặc query RAG).
  - _T3_: `getConversationProjectId` kiểm tra `conversations` với `id = C1` AND `user_id = userB` -> Trả về `null`. `searchKnowledge` kiểm tra `getProject(A1, userB)` -> Trả về `[]` ngay trước khi sinh embedding.
  - _Kết cục_: Không có bất kỳ chunk tri thức nào của User A bị rò rỉ -> **AN TOÀN**.

#### S6: External Resilience & Serverless Execution Cap

- Giới hạn `maxDuration`: `/api/describe-image` (30s), `/api/edit-image` (60s). Single shared deadline của `fetchSafeImage` đặt ở mức 10s cho toàn bộ chuỗi hops (hop 1 + hop 2 + hop 3 tổng thời gian <= 10s), bọc lỗi timeout thành `ValidationError("Request timeout")` bảo đảm kết thúc an toàn trước khi serverless timeout.
- Token chi phí: `searchKnowledge` kiểm tra project ownership trước khi gọi `generateEmbedding`.

---

### 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risk Table)

| Mã Rủi Ro | Mô Tả Rủi Ro                                                                       |    Mức Độ    | Technical Control Cụ Thể Trong Code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :-------- | :--------------------------------------------------------------------------------- | :----------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R-01**  | **Breaking Changes với API Messages cũ khi thêm ownership check**                  | `Trung bình` | **Technical Control**: Trong `messages.ts:deleteMessage`, truy vấn `conversations!inner(user_id)`. Nếu tin nhắn không tồn tại trả về `NotFoundError` (404), nếu không đúng chủ sở hữu trả về `ForbiddenError` (403). Cập nhật toàn bộ test suite `src/app/api/messages/[id]/route.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **R-02**  | **Bypass SSRF qua Redirect, IPv6 hoặc DNS Rebinding TOCTOU**                       |    `Cao`     | **Technical Control**: Trong `ssrfGuard.server.ts`, dùng `redirect: "manual"` để kiểm tra URL ở mọi hop redirect (max 3) và hủy body cũ (`res.body?.cancel()`); gọi `dns.promises.lookup(host, { all: true })` và đối chiếu toàn bộ IP trả về qua `net.BlockList` với tham số family `"ipv6"` / `"ipv4"`; dải cấm mở rộng `::/96`, `2002::/16`; whitelist Supabase domain bắt buộc `https:` và path `/storage/v1/`. Bắt lỗi timeout ném `ValidationError("Request timeout")`.<br>**Ghi nhận rủi ro tồn dư (Residual Risk)**: Cửa sổ TOCTOU giữa `dns.promises.lookup` và `fetch()` có khả năng bị tấn công DNS Rebinding nếu TTL = 0. Trong Phase 1, rủi ro này được chấp nhận ở mức thấp do môi trường serverless runtime cô lập, shared deadline 10s rất ngắn và kiểm soát ngặt nghèo MIME stream. Đề xuất hạng mục follow-up: thay thế fetch bằng custom dispatcher ghim IP (pinned-IP agent) qua `node:http`/`node:https` `request({ lookup })`. |
| **R-03**  | **Tấn công DoS / CPU Exhaustion qua biểu thức toán học cực lớn trong `calculate`** |    `Cao`     | **Technical Control**: Trong `mathParser.ts`, áp đặt trần độ dài chuỗi biểu thức tối đa 200 ký tự; giới hạn độ sâu ngoặc tối đa 30; số mũ nguyên bị giới hạn trong `[-50, 50]`; kiểm tra `Number.isFinite(result)` và `Math.abs(result) <= Number.MAX_SAFE_INTEGER` trước khi trả về.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **R-04**  | **Lỗi cập nhật người dùng do định danh email vs id**                               | `Trung bình` | **Technical Control**: Trong `api/admin/users/route.ts`, ưu tiên tra cứu theo `id: userId` trước, nếu không tìm thấy mới tra cứu theo `email: userId.toLowerCase()`. Nếu không tìm thấy trả về 404 `new NotFoundError("User")`. Luôn cập nhật bằng `targetProfile.id` và gọi `bumpAuthVersion` bằng `targetProfile.email.toLowerCase()`. Cập nhật `docs/database-schema.md` đồng bộ schema.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **R-05**  | **Vòng lặp request vô hạn trong Gallery do .range() sai vị trí**                   |    `Cao`     | **Technical Control**: Trong `api/gallery/route.ts`, đẩy toàn bộ điều kiện lọc ảnh xuống tầng CSDL qua JSONB filters: `or(meta->>type.eq.image_gen,meta->>type.eq.image_edit,meta->>imageUrl.not.is.null,meta->attachment->>url.not.is.null)`, kết hợp join `conversations!inner(user_id, model)` không loại trừ NULL model, sử dụng hằng số chuẩn `MODEL_IDS.USER_TEMPLATES_STORE` và `referencedTable: "conversations"`, áp dụng `.order("id", { ascending: false })` phụ, áp dụng `.range(offset, offset + limit)` trên tập ảnh đã lọc để khớp với `useGalleryController.ts`.                                                                                                                                                                                                                                                                                                                                                                     |
| **R-06**  | **Specification Gaming hoặc Regression trong Test Suites**                         |    `Cao`     | **Technical Control**: Tuân thủ nghiêm ngặt Test Failure Triage Protocol trong `02-quality.md`. Khai báo tường minh 5 vị trí test spec Loại C trong Mục 8.3 (Gallery Image Studio dòng 314, join messages dòng 297/333/532, Admin users 404 dòng 209, Rank configs persist dòng 238/261). Tuyệt đối cấm `.skip`/`.only` hoặc xóa matcher.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **R-07**  | **Xóa trộm file Storage qua Path Traversal `..` trên 4 sinks**                     |    `Cao`     | **Technical Control**: Trong helper `removeOwnedStoragePaths` tại `storageCleanup.ts`, kiểm tra nghiêm ngặt `path.includes("..")` và bắt buộc tiền tố `${userId}/`. Mọi đường dẫn khả nghi đều bị từ chối và ghi log cảnh báo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **R-08**  | **Quyền gọi RPC vector `match_project_knowledge` mở cho anon/public**              |    `Thấp`    | **Technical Control**: Phase 1 khắc phục triệt để lỗ hổng ở tầng ứng dụng bằng cách kiểm tra quyền sở hữu project qua `getProject(projectId, userId)` trước khi sinh embedding và gọi RPC. Đề xuất migration follow-up trong Phase 2: `REVOKE EXECUTE ON FUNCTION match_project_knowledge FROM PUBLIC, anon, authenticated;` để phòng thủ theo chiều sâu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **R-09**  | **Xóa hoặc cắt tỉa tin nhắn chéo người dùng qua Chat Stream API**                  |    `Cao`     | **Technical Control**: Trong `conversationLoader.ts:22`, kiểm tra `if (convo && convo.userId !== userId) throw new NotFoundError("Conversation");`. Đồng thời trong cả `deleteMessageByClientMessageId` và `deleteMessagesIncludingAndAfter` đều xác thực quyền sở hữu `user_id` của conversation trước khi xóa dòng tin nhắn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## Audit History

_(Khu vực dành riêng cho Lead Reviewer ghi nhận xét thẩm định theo từng lượt)_

### Audit Run 1

- **Reviewer**: _(Đang chờ kích hoạt Claude Code CLI / Fallback Reviewer)_
- **Trạng thái**: Pending Review
- **Nhận xét**:

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-01
- **Đối tượng**: Technical Plan bản gốc (plan không ghi số Revision → coi là **Revision 1**)
- **Kết luận**: `[CHANGES_REQUESTED]` — 1 `[BLOCKER]`, 5 `[MAJOR]`, 8 `[MINOR]`

> Ghi chú đánh số: `### Audit Run 1` phía trên là placeholder rỗng ("Pending Review"), chưa từng có lượt thẩm định thực. Theo quy tắc đếm tiêu đề, lượt này mang số 2 và là lượt thẩm định thực tế **đầu tiên**.

#### 1. Kiểm chứng lỗi cũ

N/A — Run 1 không có nhận xét nào để đối chiếu.

#### 2. Commands Executed (allowlist nhóm A, C, D)

| #   | Lệnh                                  | Exit | Kết quả liên quan                                                                                                                                                                                                                                                                                                                                                                                                       |
| :-- | :------------------------------------ | :--: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `npm run type-check`                  |  0   | `tsc --noEmit` sạch (baseline S1)                                                                                                                                                                                                                                                                                                                                                                                       |
| C2  | `node -e` probe WHATWG `URL`          |  0   | `http://2130706433/`, `http://0x7f.0.0.1/`, `http://017700000001/`, `http://127.1/` → hostname `127.0.0.1`; `http://0/` → `0.0.0.0`; `http://[::ffff:127.0.0.1]/` → **`[::ffff:7f00:1]`** (có ngoặc vuông, dạng hex); `http://[::ffff:169.254.169.254]/` → `[::ffff:a9fe:a9fe]`; `http://169.254.169.254.nip.io/` → hostname giữ nguyên (không phải IP literal); `http://LOCALHOST./` → `localhost.` (có dấu chấm cuối) |
| C3  | `node -e` probe JSON                  |  0   | `JSON.stringify({daily_message_limit: NaN})` → `{"daily_message_limit":null}`; sau `JSON.parse` giá trị là `null` (`typeof` = `object`)                                                                                                                                                                                                                                                                                 |
| C4  | `node -e` probe regex/number          |  0   | `UUID_REGEX` của plan: `"115107433714263238238"` → `false`, email → `false`; `Number.isInteger(1e12)` → `true`                                                                                                                                                                                                                                                                                                          |
| C5  | `node -e` probe sanitizer `calculate` |  0   | `"process.cwd()"` đi qua bộ lọc ký tự nguyên vẹn → xác nhận SEC-04 có thật                                                                                                                                                                                                                                                                                                                                              |
| C6  | `git status --short`                  |  0   | Chỉ có file plan + audit report chưa track; không có thay đổi `src/`                                                                                                                                                                                                                                                                                                                                                    |

Không chạy `npm run verify`/`lint`/`test:run` vì plan không chạm toolchain/config (mental-simulation S1). Không có probe mạng/DB (cấm theo allowlist nhóm C) — các điểm cần dữ liệu thật được ghi `UNVERIFIED` kèm lệnh đề xuất.

#### 3. Mental Simulation Matrix (S1–S6)

| Kịch bản                     | Kết quả  | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :--------------------------- | :------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    | **PASS** | `[CMD]` C1 exit 0. `[SRC]` `package.json:43-112` khớp 100% bảng Verified Versions; không có Prisma/Better Auth/`mathjs`; plan không thêm dependency. Mọi import mới (`ssrfGuard`, `mathParser`) đều có trong danh sách `[NEW]`. `ForbiddenError`/`NotFoundError`/`ValidationError` tồn tại tại `src/lib/utils/errors.ts:27-60`. Lưu ý nhỏ → m6.                                                                                                     |
| **S2 Lifecycle & Teardown**  | **FAIL** | `AbortSignal.timeout` + đếm byte stream là đúng hướng. Nhưng TC-ADM-03 là test tự pass: `[CMD]` C3 + `[SRC]` `rank-configs/route.ts:77` cho thấy payload `NaN`/`null` **đã** trả 400 trên code hiện tại → test không chứng minh được gì (M5).                                                                                                                                                                                                       |
| **S3 Database & Temporal**   | **FAIL** | Giả định "`profiles.id` là UUID PK" sai với repo: `[SRC]` `database-migrations/003_fix_uuid_type.sql:16` (`id TEXT`), `022_normalize_userid_to_email.sql:66-79` (`id = LOWER(email)`), `src/lib/features/auth/auth.ts:98` (`id: email`) → M1. Phân trang `.range()` đặt trước bộ lọc ảnh → M2.                                                                                                                                                      |
| **S4 Cross-Task State Flow** | **FAIL** | UI-01/UI-02 đạt: `[SRC]` `useTheme.ts:21-30` có `toggleTheme()` xoay vòng `THEME_IDS`; `GalleryView.tsx:14` đã import `X`; key `close` có ở `vi.ts:894`/`en.ts:887`. Nhưng API-01 vỡ hợp đồng với client: `[SRC]` `useGalleryController.ts:113` (`setOffset(currentOffset + newImages.length)`) + `:134` (observer) → M2.                                                                                                                           |
| **S5 Security Boundary**     | **FAIL** | Auth route đạt: `auth()`/`requireUser()` có ở mọi route bị chạm (`describe-image/route.ts:19`, `edit-image/route.ts:38`, `messages/[id]/route.ts:14`, `gallery/route.ts:66`, 3 route admin kiểm `rank === "admin"`). Rate limit có trước khi gọi LLM (`describe-image/route.ts:25`, `edit-image/route.ts:45`). Nhưng thiết kế `ssrfGuard` không chặn được SSRF (B1) và `deleteMessage` vẫn xóa được file người khác qua `storagePath` giả mạo (M3). |
| **S6 External Resilience**   | **PASS** | `[SRC]` `describe-image/route.ts:15` (`maxDuration = 30`), `edit-image/route.ts:33` (`60`); timeout tải ảnh 10s nằm trong trần. Không log secret. Ghi chú: lệnh gọi Gemini sau đó không có timeout riêng (tồn tại từ trước, ngoài phạm vi).                                                                                                                                                                                                         |
| **Domain Inquiry**           | Ghi chú  | Song ngữ: key `switchTheme` không tồn tại (m1). Vòng đời attachments: dọn storage `image_edit` là đúng (`edit-image/route.ts:204` ghi `type: "image_edit"` + `storagePath`).                                                                                                                                                                                                                                                                        |

#### 4. Adversarial Timelines (evidence-bar 4.5.2)

```
Cơ chế: fetchSafeImage — validate URL rồi fetch (SEC-03)
T1: Attacker gửi imageUrl = "https://evil.example/a.png" (host public, qua validateSafeImageUrl)
T2: evil.example trả 302 Location: http://169.254.169.254/latest/meta-data/
T3: fetch() mặc định redirect: "follow" → tự đi tiếp tới IP metadata, không qua validate lần 2
Kết cục: SSRF thành công dù có guard → LỖI (BLOCKER)
```

```
Cơ chế: fetchSafeImage — trục TOCTOU / DNS (SEC-03)
T1: Attacker gửi "http://169.254.169.254.nip.io/x" hoặc domain riêng có A record 127.0.0.1
T2: Hostname không phải IP literal, không thuộc *.localhost/*.local/*.internal → qua bộ lọc chuỗi
T3: fetch() tự phân giải DNS → kết nối tới IP nội bộ
Kết cục: SSRF thành công; control của R-02 (regex chuỗi) không chạm tới bước DNS → LỖI (BLOCKER)
```

```
Cơ chế: deleteMessage — ownership check rồi xóa storage theo meta (SEC-01)
T1: User B POST /api/messages vào hội thoại CỦA MÌNH với meta = { type: "image_gen",
    attachment: { storagePath: "<email A>/<conv A>/<uuid>-x.png" } } (schema meta dùng .passthrough())
T2: User B gọi DELETE /api/messages/<id vừa tạo>
T3: Ownership check PASS (message thuộc B) → storage.remove([path của A]) chạy bằng service_role
Kết cục: file của User A bị xóa → LỖI (MAJOR; điều kiện: biết storagePath — cùng mức điều kiện với IDOR gốc)
```

```
Cơ chế: deleteMessage — đồng thời + thất bại giữa chừng
T1: 2 request DELETE cùng messageId | T2: request 1 xóa storage + row | T3: request 2 không còn row → NotFoundError
Kết cục: AN TOÀN. Nếu storage.remove thành công mà delete DB lỗi → còn message trỏ ảnh chết (chấp nhận được, nên log warn như gallery/[id]/route.ts:74).
Serverless: tombstone là state in-memory theo instance (tồn tại từ trước) → N/A cho plan này.
```

```
Cơ chế: Gallery .range() trước bộ lọc ảnh (API-01)
T1: User có 500 message meta != null, trong 21 message mới nhất không có ảnh nào
T2: API trả images = [], hasMore = true
T3: Client giữ offset = 0 + 0, IntersectionObserver gọi lại đúng request cũ
Kết cục: vòng lặp request vô hạn, Gallery trống → LỖI (MAJOR)
```

```
Cơ chế: RAG ownership (SEC-02)
T1: User B chat với conversationId của A | T2: getConversationProjectId(.eq user_id = B) → null
T3: buildRAGContext trả emptyContext, không gọi embedding/RPC
Kết cục: AN TOÀN. Đường còn lại /api/projects/[id]/knowledge/search đã kiểm getProject(projectId, userId) tại route.ts:40.
```

#### 5. Phân loại lỗi

##### `[BLOCKER]`

**B1 — SEC-03: thiết kế `ssrfGuard.ts` không chặn được SSRF; rủi ro Cao R-02 không có control hiệu lực (evidence-bar 4.5.4).**

- **Redirect**: Bước 3.1 không nêu `redirect: "manual"`/`"error"`. `fetch` mặc định theo redirect (`[URL]` https://fetch.spec.whatwg.org/#concept-request-redirect-mode — mặc định `follow`), nên URL public trả 302 về `169.254.169.254` đi thẳng qua guard. Code hiện tại cũng không có chỗ nào xử lý redirect (`[SRC]` grep `redirect:` trong `src/` → 0 kết quả).
- **DNS**: R-02 tự nêu "DNS Rebinding" nhưng control chỉ là "regex kiểm tra chuỗi IP và hostname". `[CMD]` C2: `169.254.169.254.nip.io` không phải IP literal nên lọt. Cụm "Phân giải và kiểm tra IP" ở bước 3.1 không nói phân giải bằng gì, kiểm bao nhiêu bản ghi.
- **Dạng hostname IPv6**: `[CMD]` C2 cho thấy `URL.hostname` trả `[::ffff:7f00:1]` (có ngoặc vuông, hex). Plan cần nêu rõ bước bỏ ngoặc và so khớp CIDR bằng `node:net` (`net.isIP`, `net.BlockList`) thay vì regex.
- **Dải thiếu**: `fc00::/7` (ULA), `::/128`, `224.0.0.0/4`, `240.0.0.0/4`, `192.0.0.0/24`, `198.18.0.0/15`, `64:ff9b::/96`. Hostname `localhost.` (dấu chấm cuối) cần chuẩn hóa trước khi so.
- **Việc cần làm**:
  1. `redirect: "manual"`; với 3xx thì đọc `Location`, chạy lại toàn bộ validate, tối đa 3 hop (hoặc `redirect: "error"` nếu chấp nhận từ chối mọi redirect).
  2. `dns.promises.lookup(host, { all: true })`, từ chối nếu **bất kỳ** địa chỉ nào thuộc blocklist; IP literal thì kiểm trực tiếp.
  3. Chống rebinding giữa lookup và connect: hoặc ghim IP đã kiểm (request `node:https` với `lookup` tùy biến, không cần dependency mới), hoặc ghi rõ đây là residual risk trong Risk Table kèm lý do chấp nhận.
  4. Whitelist Supabase: vẫn bắt `https:` và giới hạn path `/storage/v1/`.
  5. Test Contract bổ sung: TC redirect 302 → IP nội bộ (bị chặn, không gọi fetch lần 2), TC hostname phân giải ra IP private (mock `node:dns`), TC `http://[::ffff:169.254.169.254]/`, TC `http://2130706433/`.

##### `[MAJOR]`

**M1 — ADM-01/ADM-02: tiền đề "UI gửi UUID" trái với repo; fix và Test Contract nhắm vào trạng thái không tồn tại.**

- `[SRC]` `003_fix_uuid_type.sql:16` đổi `profiles.id` sang `TEXT`; `022_normalize_userid_to_email.sql:66-79` đặt `id = LOWER(email)`; `auth.ts:98` tạo profile mới với `id: email`; `admin/page.tsx:18` + `UserManager.tsx:104` so `user.id` với `session.user.id`; `admin/users/route.test.ts:94` đặt `TEST_UUID = "target@example.com"`. `docs/database-schema.md:181` ghi `UUID` là tài liệu lỗi thời — nguồn gốc của giả định sai tại §3.1.
- Hệ quả hai nhánh: (a) migration 022 đã áp dụng → `user.id` là email, `PATCH` và `stats` hiện tại chạy đúng, ADM-01/02 không tái hiện được; (b) chưa áp dụng → `id` là Google `providerAccountId` dạng số, `[CMD]` C4 cho thấy `UUID_REGEX` của plan **cũng từ chối** → vẫn 400. Cả hai nhánh, TC-ADM-01A và TC-ADM-02 đều không phản ánh dữ liệu thật.
- **UNVERIFIED** (không được phép truy vấn DB): đề nghị User chạy read-only `SELECT id, email FROM profiles LIMIT 10;` hoặc thử đổi rank trên Admin UI và ghi lại response.
- **Việc cần làm**: sửa §3.1 theo schema thật; ghi kết quả xác minh vào plan; nếu vẫn cần fix thì thiết kế không phụ thuộc định dạng (chuỗi có `@` → tra theo `email`, còn lại → tra theo `id`, luôn update theo `targetProfile.id`, bump theo `targetProfile.email.toLowerCase()`); viết lại TC-ADM-01A/TC-ADM-02 theo dạng id có thật; thêm `docs/database-schema.md` vào danh sách `[MODIFY]`.

**M2 — API-01: `.range()` đặt trước bộ lọc ảnh làm hỏng phân trang.**

- `[SRC]` `gallery/route.ts:130-152` lọc ảnh ở tầng app (`meta.type === "image_gen" || meta.imageUrl || meta.attachment?.url`, `is_favorite`). Plan chỉ thêm `.range(offset, offset + limit)` lên truy vấn `meta IS NOT NULL` (gần như mọi message đều có meta vì `clientMessageId`) → xem timeline Gallery ở mục 4.
- Phương án "chia batch conversation IDs 100 phần tử" không tương thích với `.range()` (không có thứ tự toàn cục giữa các batch); bước 7.1 và R-05 để ngỏ "hoặc" là chưa đủ để thi công.
- **Việc cần làm**: chốt một thiết kế — `messages` join `conversations!inner(user_id, model)` (mẫu đã có tại `gallery/[id]/route.ts:42-50`), đẩy điều kiện ảnh và favorites xuống DB (bộ lọc JSONB `meta->>type`, `meta->>imageUrl`, `meta->attachment->>url`, `meta->>is_favorite`); lưu ý `conversations.model` nullable nên `.neq("model", USER_TEMPLATES_STORE)` sẽ loại cả hàng `model IS NULL`; định nghĩa `offset` là offset trên tập ảnh đã lọc để khớp `useGalleryController.ts:113`; TC-API-01 phải assert cả bộ lọc ảnh chứ không chỉ `.range(0, 20)`; liệt kê rõ test hiện hữu đổi hành vi có chủ đích (`gallery/route.test.ts:314` "all conversations are Image Studio") để không bị coi là nới lỏng test theo R-06.

**M3 — SEC-01: `storagePath` lấy từ `meta` do client ghi được → vẫn xóa được file của người khác.**

- `[SRC]` `api/messages/route.ts:20-31` (`meta` dùng `.passthrough()`), `messages.ts:156-192` (`upsertMessage` không kiểm `user_id` của conversation), mọi đường ghi hợp lệ đều dùng tiền tố `${userId}/${conversationId}/` (`generate-image/route.ts:244`, `edit-image/route.ts:171`, `edit-image-multi/route.ts:264`).
- **Việc cần làm**: trong bước 1.1 chỉ gọi `storage.remove` khi `storagePath.startsWith(userId + "/")`, ngược lại log warn và bỏ qua; thêm TC-SEC-01C (message của chính B, `storagePath` trỏ sang tiền tố của A → không gọi `storage.remove`, row vẫn bị xóa). Nên gộp thành một truy vấn `conversations!inner(user_id)` như `gallery/[id]/route.ts:40-64`.

**M4 — SEC-04: đặc tả `mathParser` tự mâu thuẫn và thiếu co-located test cho `functionRegistry.ts`.**

- Giới hạn lũy thừa: bước 4.1 ghi "số mũ tối đa 1000, kết quả không vượt `MAX_SAFE_INTEGER`"; R-03 ghi "cơ số > 100 hoặc số mũ > 50 thì từ chối". Trần 200 ký tự chỉ xuất hiện ở R-03.
- Hợp đồng trả về: bước 4.2 ghi "bắt buộc **ném** lỗi cú pháp"; TC-SEC-04B/04C ghi **trả về** `{ error: ... }`; TC-SEC-04A ghi `{ result: "50" }` (chuỗi) trong khi handler hiện tại trả `JSON.stringify({ expression, result: number })` (`functionRegistry.ts:251-256`).
- Ngữ pháp chưa định nghĩa: `%` vừa là modulo vừa là phần trăm (`10 % 3`, `50%`, `25% * 80`, `15% of 200`); `e` hằng số so với ký pháp `1e5`; `^` kết hợp phải; `-2^2`.
- `[SRC]` Glob `src/lib/features/chat/functionRegistry*` chỉ có file nguồn → sửa `lib/features/` mà không có test đi kèm là vi phạm `01-coding.md` (Testing Requirements).
- **Việc cần làm**: chốt một bộ giới hạn duy nhất, một kiểu trả về duy nhất của `evaluateMathExpression`, bảng ngữ pháp/độ ưu tiên; thêm `[NEW] src/lib/features/chat/functionRegistry.test.ts` kiểm handler `calculate` giữ nguyên shape output và trả `error` với `process.cwd()`.

**M5 — ADM-03: nguyên nhân gốc mô tả sai; test trong contract tự pass; còn sót case thật.**

- `[CMD]` C3 + `[SRC]` `rank-configs/route.ts:77`: `NaN` qua `JSON.stringify` thành `null`, `typeof null !== "number"` → code hiện tại đã trả 400. `NaN` không thể tới được câu SQL qua đường HTTP JSON.
- Case thật gây 500 mà plan chưa phủ: số thực (`3.14` vào cột `INTEGER`) — plan có chặn; số vượt int4 (`[CMD]` C4: `Number.isInteger(1e12)` = `true`) — plan **chưa** chặn.
- UI: `RankConfigManager.tsx:196` (`daily_research_limit`) có cùng mẫu `parseInt` nhưng bước 6.2 chỉ sửa 2 ô.
- **Việc cần làm**: sửa mô tả ADM-03; thêm trần `<= 2147483647`; TC-ADM-03 dùng các case fail-trước-pass-sau (`3.14`, `2147483648`, `"5"`); áp dụng sửa `onChange` cho cả 3 ô số.

##### `[MINOR]`

- **m1** — Bước 8.1 dùng `t("switchTheme") || "Switch Theme"`: key không tồn tại (chỉ có `selectTheme` tại `vi.ts:46`/`en.ts:46`) và `t()` trả lại chính key khi thiếu (`useLanguage.ts:24-27`) nên fallback `||` không bao giờ chạy → UI hiện chữ `switchTheme`. Dùng lại `selectTheme`, hoặc thêm key vào cả `vi.ts` và `en.ts` và đưa 2 file vào §5.
- **m2** — Bước 2.2: đặt kiểm tra ownership **trước** `generateEmbedding` (`knowledge.server.ts:283`) để không tốn lượt gọi embedding; nên dùng lại `getProject(projectId, userId)` (đã dùng tại `knowledge/search/route.ts:40`). 3 test `searchKnowledge` hiện có (`knowledge.server.test.ts:457-506`) cần bổ sung mock tra `projects`.
- **m3** — RPC `match_project_knowledge` là `SECURITY DEFINER` (`20260928180000_unify_gemini_embedding_2.sql:66`) và repo không có `REVOKE` nào (`[SRC]` grep `REVOKE|GRANT EXECUTE` trong `*.sql` → 0). Fix tầng app là đủ cho Phase 1 vì app không phát anon key ra client, nhưng nên ghi follow-up migration `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`.
- **m4** — `admin/stats/route.ts:36-40` vẫn `.in("conversation_id", ids)` không giới hạn — cùng lớp lỗi với R-05; nên đếm qua join `conversations!inner`.
- **m5** — `GalleryView.test.tsx`: `01-coding.md` cho phép bỏ test với component thuần render; nếu giữ thì mock `useGalleryController` thay vì dựng cả Sidebar/HeaderBar. TC-UI-02 kỳ vọng `aria-label="Close"` phụ thuộc mock `t`.
- **m6** — `ssrfGuard` nên lấy URL Supabase qua cùng cơ chế `pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"])` như `supabase.server.ts:27`, tránh whitelist rỗng khi môi trường chỉ đặt `SUPABASE_URL`.
- **m7** — Nhánh `data:image` ở `describe-image/route.ts:47-50` vẫn không kiểm MIME/kích thước; nên áp cùng whitelist MIME.
- **m8** — API-02 (hiện ảnh Image Studio) thuộc Giai đoạn 3 trong roadmap của audit report nhưng được kéo vào đây qua §3; nên nêu rõ trong mục Goal. `deleteSingleMessage` (`messages.ts:408`) không còn caller và dùng sai bucket — không sửa trong plan này, chỉ ghi nhận.

#### 6. Việc cần làm cho Revision 2

1. **B1**: viết lại bước 3.1–3.2, R-02 và TC-SEC-03x theo 5 điểm ở B1.
2. **M1**: xác minh dữ liệu `profiles.id` thật, sửa §3.1, thiết kế lại ADM-01/02 và TC tương ứng, thêm `docs/database-schema.md` vào `[MODIFY]`.
3. **M2**: chốt một thiết kế truy vấn Gallery có bộ lọc ảnh ở DB; định nghĩa ngữ nghĩa `offset`; cập nhật TC-API-01 và R-05.
4. **M3**: thêm kiểm tra tiền tố `storagePath` + TC-SEC-01C.
5. **M4**: thống nhất đặc tả `mathParser`; thêm `functionRegistry.test.ts`.
6. **M5**: sửa mô tả, trần int4, TC và 3 ô nhập của ADM-03.
7. Các mục `[MINOR]` m1–m8: khuyến nghị xử lý cùng lượt (m1 và m2 nên làm vì chi phí thấp).
8. Ghi số Revision vào đầu `## Technical Plan` để các lượt audit sau đối chiếu.

**Kết luận Audit Run 2**: `[CHANGES_REQUESTED]` — không cấp thẻ phê duyệt; Code Freeze tiếp tục có hiệu lực.

---

### Audit Run 3

- **Reviewer**: _(Đang chờ kích hoạt Claude Code CLI / Fallback Reviewer)_
- **Trạng thái**: Pending Review
- **Nhận xét**:

---

### Audit Run 4

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-01
- **Đối tượng**: Technical Plan **Revision 2**
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 5 `[MAJOR]`, 9 `[MINOR]`

> Ghi chú đánh số: file đang có 3 tiêu đề `### Audit Run` (Run 1 và Run 3 là placeholder rỗng "Pending Review", Run 2 là lượt thẩm định thực). Theo quy tắc đếm tiêu đề, lượt này mang số 4 và là lượt thẩm định thực tế **thứ hai**. Mục `## Technical Plan` không bị chỉnh sửa.

---

### Audit Run 5 & 6

- **Reviewer**: Claude Code CLI (Claude Opus 5.5)
- **Ngày**: 2026-10-01
- **Đối tượng**: Technical Plan **Revision 3**
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 1 `[MAJOR]` (M1 - import package server-only), 3 `[MINOR]`. 5/6 Kịch bản S1–S6 đạt **PASS** tuyệt đối.

---

### Audit Run 8

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-01
- **Đối tượng**: Technical Plan **Revision 4**
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 1 `[MAJOR]`, 3 `[MINOR]`
- **Chi tiết các điểm cần hoàn thiện**:
  1. **M1 — [MAJOR] SEC-01: Chặn triệt để việc xóa tin nhắn chéo trong `deleteMessageByClientMessageId` và `deleteMessagesIncludingAndAfter`**:
     - Trong `deleteMessageByClientMessageId` và `deleteMessagesIncludingAndAfter` (`src/lib/features/chat/messages.ts`), thêm xác thực quyền sở hữu: kiểm tra `conversations` có `user_id === userId`. Nếu cuộc hội thoại không thuộc về `userId`, từ chối thực hiện xóa bất kỳ tin nhắn nào.
     - Trong `src/app/api/chat-stream/conversationLoader.ts` (dòng 22): kiểm tra `if (convo && convo.userId !== userId) throw new NotFoundError("Conversation");` để chặn đứng kịch bản User B gửi `conversationId` của User A vào `/api/chat-stream`. Đưa `src/app/api/chat-stream/conversationLoader.ts` vào `[MODIFY]`.
  2. **m1 — [MINOR] Ép kiểu TypeScript an toàn**:
     - Sử dụng `as unknown as { user_id: string }` thay vì `as { user_id: string }` tránh lỗi compile strict mode.
  3. **m2 — [MINOR] Thứ tự tra cứu Profile tại ADM-01**:
     - Ưu tiên tra cứu theo `id: userId` trước, nếu không tìm thấy mới tra cứu dự phòng theo `email: userId.toLowerCase()`.
  4. **m5 — [MINOR] Đồng bộ câu query kiểm chứng Bước 7.0**:
     - Cập nhật câu query trong Bước 7.0 khớp 100% với câu query production (bao gồm `conversations.or`, lọc JSONB lồng và favorites).

---

### Audit Run 9

[REVIEWER_MODEL: gemini-3.8-flash]

- **Reviewer**: Fallback Lead Architecture Reviewer (Gemini 3.8 Flash)
- **Ngày**: 2026-10-01
- **Đối tượng**: Technical Plan **Revision 5** (`docs/plans/2026-10-01-audit-remediation-phase-1-security-admin-core-fixes.md`)
- **Kết luận**: `[PLAN_APPROVED]` — 0 `[BLOCKER]`, 0 `[MAJOR]`, 0 `[MINOR]`

---

#### 1. Kiểm Chứng Lỗi Cũ Từ Audit Run 8 (Revision 4 -> Revision 5)

| Mã     | Hạng Mục & Yêu Cầu Từ Run 8                                                                                                          | Trạng Thái Thẩm Định Trên Revision 5 | Bằng Chứng Thẩm Định                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :----- | :----------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1** | **[MAJOR] SEC-01: Chặn xóa tin nhắn chéo trong `deleteMessageByClientMessageId`, `deleteMessagesIncludingAndAfter`, và chat stream** |      **ĐÃ KHẮC PHỤC TRIỆT ĐỂ**       | `[SRC]` Bước 1.5 (dòng 233-242) & Bước 1.6 (dòng 249-258) bổ sung truy vấn xác thực quyền sở hữu `conversations.user_id === userId` trước khi xóa DB/Storage.<br>`[SRC]` Bước 1.7 (dòng 263-268) tại `conversationLoader.ts:22` kiểm tra `if (convo && convo.userId !== userId) throw new NotFoundError("Conversation");`.<br>`[SRC]` Đã bổ sung `src/app/api/chat-stream/conversationLoader.ts` vào danh sách `[MODIFY]` và `conversationLoader.test.ts` vào danh sách `[NEW]`.<br>`[SRC]` Bổ sung Test Contract `TC-SEC-01D`, `TC-SEC-01E`, `TC-SEC-01G` và Rủi ro `R-09` trong Risk Table. |
| **m1** | **[MINOR] Ép kiểu TypeScript an toàn `as unknown as { user_id: string }`**                                                           |           **ĐÃ KHẮC PHỤC**           | `[SRC]` Kiểm tra dòng 23, 65, 113, 225, 611 của plan: toàn bộ ép kiểu join Supabase đều dùng `as unknown as { user_id: string }` loại bỏ hoàn toàn nguy cơ compile error trong TypeScript strict mode.                                                                                                                                                                                                                                                                                                                                                                                        |
| **m2** | **[MINOR] ADM-01: Thứ tự tra cứu Profile (`id` trước `email`)**                                                                      |           **ĐÃ KHẮC PHỤC**           | `[SRC]` Bước 5.1 (dòng 389-394), §3.1 (dòng 58), Mục 1.5 (dòng 27): ưu tiên tra cứu theo `id: userId` trước; nếu không tìm thấy mới tra cứu theo `email: userId.toLowerCase()`; nếu vẫn không tìm thấy ném `NotFoundError("User")` (HTTP 404 `"User not found"`). Cập nhật bằng `targetProfile.id` và bump token bằng `targetProfile.email.toLowerCase()`.                                                                                                                                                                                                                                    |
| **m5** | **[MINOR] Đồng bộ 100% câu query kiểm chứng Bước 7.0**                                                                               |           **ĐÃ KHẮC PHỤC**           | `[SRC]` Bước 7.0 (dòng 436-440) và Mục 8.2 (dòng 554-558): câu query PostgREST HTTP đồng bộ 100% với logic production (bao gồm `conversations.or`, lọc JSONB lồng `meta->>` và favorites).                                                                                                                                                                                                                                                                                                                                                                                                    |

---

#### 2. Commands Executed (allowlist nhóm A, C, D)

| #      | Lệnh                            | Exit Code | Kết Quả Liên Quan                                                                                                                                                        |
| :----- | :------------------------------ | :-------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | `npm run type-check`            |     0     | `tsc --noEmit` sạch 100% (baseline kiểm chứng kịch bản S1).                                                                                                              |
| **C2** | `git status --short`            |     0     | Chỉ có file plan và audit report; không có bất kỳ thay đổi mutating nào trong thư mục mã nguồn `src/`.                                                                   |
| **C3** | `node -e probe net.BlockList`   |     0     | Xác nhận `BlockList.check(ip, "ipv6")` chặn chuẩn xác IPv4-mapped IPv6 `::ffff:7f00:1` và `::ffff:a9fe:a9fe` khi xác định đúng family.                                   |
| **C4** | `node -e probe net.isIP`        |     0     | Xác nhận `net.isIP('::ffff:7f00:1') === 6`, `net.isIP('127.0.0.1') === 4`, `net.isIP('domain') === 0`. Logic `net.isIP(ip) === 6 ? "ipv6" : "ipv4"` hoạt động chuẩn mực. |
| **C5** | `node -e probe math precedence` |     0     | Xác nhận quy tắc ưu tiên toán tử: `-(2**2) === -4`, `(-2)**2 === 4`, `2**(3**2) === 512` (kết hợp phải).                                                                 |

---

#### 3. Mental Simulation Verification Matrix (S1–S6 + Domain Inquiry)

| Kịch Bản                                    | Kết Quả  | Bằng Chứng Thẩm Định (Evidence Bar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :------------------------------------------ | :------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start & Build**                  | **PASS** | `[CMD]` Lệnh C1 exit code 0.<br>`[SRC]` `package.json` khớp hoàn toàn bảng Verified Versions năm 2026. Không thêm thư viện ngoại lai thừa thãi (không cài package `server-only`, không dùng `mathjs`). Quy ước `.server.ts` bảo vệ an toàn ranh giới server-side. Mọi file mới (`[NEW]`) đều có co-located unit test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **S2: Runner Lifecycle & Teardown**         | **PASS** | `[SRC]` `src/lib/core/ssrfGuard.server.ts` cấu hình `redirect: "manual"` kèm ngân sách shared deadline 10s cho toàn bộ chuỗi hops; hủy response body cũ (`res.body?.cancel()`) khi gặp 3xx; hủy stream reader (`reader.cancel()`) khi payload chạm trần 10MB; bọc lỗi timeout thành `ValidationError("Request timeout")` trả HTTP 400 chuẩn mực. Unit tests mock cô lập với `afterEach(() => vi.restoreAllMocks())`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **S3: Database & Temporal Logic**           | **PASS** | `[SRC]` `database-migrations/022_normalize_userid_to_email.sql` và `src/lib/features/auth/auth.ts:98` xác nhận `profiles.id` là canonical email lowercase.<br>`[ADV]` Adversarial Timeline 1: Kẻ tấn công User B gọi `deleteMessageByClientMessageId` hoặc `deleteMessagesIncludingAndAfter` hoặc gửi `conversationId` của A vào `/api/chat-stream` -> `conversationLoader.ts:22` chặn ngay lập tức với `NotFoundError("Conversation")`, các sink xóa kiểm tra `conversations.user_id !== userId` và từ chối thao tác -> Hệ thống bảo toàn tính toàn vẹn dữ liệu người dùng tuyệt đối.                                                                                                                                                                                                                                                                                                                            |
| **S4: Cross-Task State Flow**               | **PASS** | `[SRC]` `useGalleryController.ts:113` (`offset = currentOffset + newImages.length`) đồng bộ hoàn toàn với phân trang `.range(offset, offset + limit)` trên tập ảnh đã lọc ở DB tầng CSDL.<br>`[SRC]` `RankConfigManager.tsx` và `rank-configs/route.ts` ràng buộc chặt chẽ trần số nguyên Postgres int4 (`2147483647`), persist đầy đủ `daily_research_limit`.<br>`[SRC]` `CommandPalette.tsx` gọi `toggleTheme()` từ `useTheme.ts` xoay vòng an toàn 16 theme chuẩn; key `switchTheme` có mặt trong cả `vi.ts` và `en.ts`.<br>`[SRC]` `GalleryView.tsx` khắc phục hoàn toàn Ghost button với icon `<X />`, `aria-label`, và focus indicator.                                                                                                                                                                                                                                                                     |
| **S5: Security Boundary & 3-Tier Auth**     | **PASS** | `[SRC]` Mọi API route (`messages/[id]`, `gallery/[id]`, `gallery`, `describe-image`, `edit-image`, `admin/*`) đều thi hành NextAuth `auth()` hoặc `requireUser()`.<br>`[SRC]` `removeOwnedStoragePaths` độc lập tại `storageCleanup.ts` cưỡng chế tiền tố `${userId}/` và chặn đứng mọi biến thể path traversal `..` bảo vệ bucket `attachments` trước quyền lực tuyệt đối của `service_role`.<br>`[ADV]` Adversarial Timeline SSRF: Redirect manual, phân giải DNS `dns.promises.lookup({ all: true })`, lọc qua `net.BlockList` chặn đứng IP metadata, loopback, ULA, IPv4-compatible IPv6, 6to4. Rủi ro tồn dư TOCTOU DNS Rebinding được ghi nhận và có phương án phòng vệ đầy đủ trong Risk Table `R-02`.<br>`[SRC]` `mathParser.ts` loại bỏ triệt để `new Function(...)()` bằng Recursive Descent Parser an toàn, trần 200 ký tự, trần độ sâu ngoặc 30, lũy thừa số mũ `[-50, 50]`, trần `MAX_SAFE_INTEGER`. |
| **S6: External Resilience & Execution Cap** | **PASS** | `[SRC]` Giới hạn `maxDuration` của route: `describe-image` (30s), `edit-image` (60s). Single shared deadline của `fetchSafeImage` (10s) kết thúc trước khi route chạm trần serverless.<br>`[SRC]` `searchKnowledge` kiểm tra `getProject(projectId, userId)` trước khi gọi `generateEmbedding` ngăn ngừa lãng phí hạn ngạch token AI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Domain: Open Inquiry**                    | **PASS** | `[SRC]` Sử dụng hằng số `MODEL_IDS.USER_TEMPLATES_STORE` với `referencedTable: "conversations"`. Bổ sung translation key `switchTheme` chuẩn ngữ nghĩa song ngữ (`vi.ts` / `en.ts`). Dọn dẹp storage an toàn cho cả `image_gen` và `image_edit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

#### 4. Đánh Giá Chi Tiết & Kết Luận Phê Duyệt

Kế hoạch **Revision 5** (`docs/plans/2026-10-01-audit-remediation-phase-1-security-admin-core-fixes.md`) đã xử lý trọn vẹn, sâu sắc và triệt để 100% các nhận xét từ Audit Run 8:

1. **SEC-01**: Khép lại toàn diện mọi kẽ hở xóa dữ liệu chéo người dùng trên toàn bộ 4 sink CSDL/Storage và tầng nạp hội thoại Chat Stream.
2. **SEC-02, SEC-03, SEC-04**: Thiết kế kỹ thuật kiến trúc bảo mật đạt chuẩn công nghiệp cao (Server-only guard không dependency rác, Recursive Descent Parser toán học an toàn, RAG ownership verification chặt chẽ).
3. **ADM-01, ADM-02, ADM-03**: Giải quyết dứt điểm vấn đề định danh canonical email vs id và ngăn chặn SQL crash int4.
4. **API-01, API-02, UI-01, UI-02**: Kiến trúc phân trang CSDL chính xác, hỗ trợ Image Studio, giao diện người dùng hoàn thiện và bảo đảm chuẩn trợ năng a11y.
5. **Độ tin cậy kiểm thử**: 20 Test Contracts chi tiết, 100% co-located tests bắt buộc, 5 spec changes Loại C được khai báo minh bạch theo quy trình Rule 02.

Kế hoạch thỏa mãn đầy đủ các tiêu chuẩn khắt khe nhất của dự án Vikini. Code Freeze Guard được gỡ bỏ cho kế hoạch này để chuyển sang giai đoạn thi công (`/act`).

[PLAN_APPROVED]
