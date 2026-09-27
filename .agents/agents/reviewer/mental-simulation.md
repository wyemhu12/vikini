# Mental Simulation Protocol — 6 Kịch Bản Bắt Buộc (Vikini)

> Tài liệu tham chiếu bắt buộc của `@reviewer`. Đọc bằng `view_file` ở Bước 0 trước mọi review.

## 6 Kịch Bản (IMPERATIVE FORMAT)

> **Nguyên tắc Sàn Tối Thiểu (Non-Exhaustive Baseline)**: 6 kịch bản là điều kiện cần bắt buộc, không phải giới hạn trên. Reviewer BẮT BUỘC chủ động truy quét rủi ro nghiệp vụ, thuật toán LLM, streaming SSE và edge cases đặc thù ngoài 6 kịch bản này.

**S1: Cold-start & Build**

- CHẠY `npm run type-check` (baseline). Nếu plan chạm tới toolchain/config (ESLint, tsconfig, Next config) → CHẠY thêm `npm run verify` và áp dụng mục 4.5.3 của `evidence-bar.md` cho mọi rule/flag liên quan.
- MỞ `package.json`. KIỂM TRA dependencies và scripts (Vikini KHÔNG dùng Prisma).
- KIỂM TRA plan có import module chưa tồn tại không (cross-ref với danh sách `[NEW]` files).
- XÁC NHẬN plan không phụ thuộc biến môi trường (`.env`) chưa được khai báo trong `docs/architecture.md` hoặc `docs/security.md`.

**S2: Runner Lifecycle & Teardown (Tham chiếu `skills/streaming-patterns.md`)**

- TÌM trong plan mọi tài nguyên cần cleanup: Supabase connection pool, Upstash Redis client, browser EventSource / AudioContext.
- KIỂM TRA xử lý ngắt kết nối mạng và dọn dẹp SSE Chat Stream: bắt buộc lắng nghe `req.signal.addEventListener('abort', ...)` và hủy AbortController tương ứng.
- XÁC NHẬN plan đề cập cleanup/teardown hoặc test isolation strategy.
- KIỂM TRA test cases không dùng circular/tautological mock tự pass.

**S3: Database & Temporal Logic (Supabase PostgreSQL, Tham chiếu `skills/database-migration.md`)**

- KHẢO SÁT các bảng dữ liệu qua `docs/database-schema.md` và migration scripts (`supabase/migrations/` hoặc `database-migrations/`).
- KIỂM TRA RLS policies: Bảng có mở cho `authenticated`/`anon` không, hay chỉ `service_role`?
- RÀNG BUỘC quan hệ: XÁC NHẬN `ON DELETE CASCADE` tránh mồ côi bản ghi (`conversations` -> `messages`, `projects` -> `knowledge_documents`).
- XỬ LÝ thời gian: Chuẩn ISO 8601 UTC trong DB vs múi giờ hiển thị của người dùng (GMT+7).
- BẮT BUỘC Adversarial Timeline (mục 4.5.2 của `evidence-bar.md`) cho giao dịch Supabase, RPC batching, và connection affinity.

**S4: Cross-Task State Flow (Soi Code Thực Tế)**

- BẮT BUỘC dùng `view_file`/`grep_search` soi trực tiếp các file state từ task trước (`src/lib/store/`, `src/app/features/*/hooks/`).
- KIỂM TRA tính tương thích giữa Zustand stores, SWR cache keys, và URL query parameters (`useUrlSync`).
- KHÔNG chỉ đọc bản kế hoạch — phải kiểm tra source code thực tế.

**S5: Security Boundary & 3-Tier Auth (NextAuth + Supabase RLS + Redis, Tham chiếu `skills/api-patterns.md`)**

- KIỂM TRA xác thực API route: BẮT BUỘC gọi `const session = await auth()` hoặc `requireUser()`.
- PHÂN TÁCH Server-Only: Client `service_role` chỉ được nằm trong file `.server.ts` (`src/lib/core/supabase.server.ts`), TUYỆT ĐỐI CẤM import vào Client Component.
- Client-side Supabase query (nếu có) bắt buộc dùng anon key và phải có policy RLS tương ứng.
- RATE LIMITING: Kiểm tra Upstash Redis rate limit trước khi gọi LLM hoặc Deep Research.
- BẮT BUỘC Adversarial Timeline cho TOCTOU (SSRF qua image download/web search url, bypass auth qua URL query injection).

**S6: External Resilience & Serverless Execution Cap**

- XỬ LÝ lỗi dịch vụ AI ngoài: Google Gemini (`@google/genai`), Anthropic Claude, OpenRouter, Groq.
- THIẾT LẬP timeout, retry, fallback giữa các provider, và thông báo lỗi rõ ràng qua UI (`StreamErrorBanner`, `toast.error()`).
- TUYỆT ĐỐI không log credentials, API keys hoặc bearer tokens khi bắt exception.
- KIỂM SOÁT thời gian thực thi serverless phù hợp từng loại route:
  - Deep Research stream: `maxDuration = 800` (`src/app/api/deep-research/[taskId]/stream/route.ts:8`).
  - Image generation & editing: `maxDuration = 60` (`src/app/api/edit-image/route.ts:33`).
  - Cron jobs: `maxDuration = 60` (`src/app/api/cron/cleanup/route.ts:9`).
  - Image description & standard APIs: `maxDuration = 30` (`src/app/api/describe-image/route.ts:15`).

**Domain: Open Inquiry (Viết lại 100% cho Vikini)**

- _Model Registry & Multi-Provider_: Khảo sát `src/lib/core/modelRegistry.ts`, kiểm tra mapping định danh mô hình, provider order.
- _Context Window & Quota Budget_: Đối soát token context (1M tokens) và trần output tokens (`effectiveMaxTokens`) tại `src/lib/core/limits.ts` và `src/lib/features/chat/batchGenQuota.ts`.
- _Reasoning Token Truncation Risk_: Phòng ngừa sự cố cắt ngắn chuỗi tư duy AI (bài học kinh nghiệm từ commit `093d2d2` khi token reasoning `<think>` chiếm trọn `max_tokens` khiến câu trả lời bị rỗng).
- _Hệ Thống Dịch Song Ngữ_: Kiểm tra tuân thủ `rules/04-bilingual.md`, không hardcode text thô, bảo đảm tính đồng bộ giữa `vi.ts` và `en.ts`.
- _Vòng Đời Quản Lý Attachments_: Quản lý vòng đời file 30 ngày TTL, hàm RPC dọn dẹp, và xử lý stream đa phương tiện (ảnh, tài liệu PDF, audio).
