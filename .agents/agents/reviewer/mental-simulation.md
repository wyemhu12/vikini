# Mental Simulation Protocol — 6 Kịch Bản Đối Kháng (Vikini)

> Tài liệu tham chiếu của `@reviewer`. Đọc bằng `view_file` trước mỗi lượt thẩm định.

## 6 Kịch Bản

> **Nguyên tắc Sàn Tối Thiểu (Non-Exhaustive Baseline)**: 6 kịch bản dưới đây là điều kiện cần tối thiểu chứ không phải giới hạn trên; reviewer cần chủ động truy quét thêm rủi ro nghiệp vụ, thuật toán LLM, streaming SSE và edge cases đặc thù ngoài danh sách này.
> **Quy tắc `N/A`**: Kịch bản không áp dụng cho phạm vi task phải ghi `N/A` kèm lý do 1 dòng, không ghi `PASS` vì đánh dấu `PASS` cho hạng mục không liên quan sẽ làm nhiễu ma trận kiểm định.

**S1: Cold-start & Build**
_(Vì sao: Kế hoạch tham chiếu module ảo hoặc biến môi trường thiếu sẽ làm hỏng toàn bộ pipeline CI/build ngay từ bước khởi động.)_

- Chạy `npm run type-check` (baseline). Nếu kế hoạch chạm tới toolchain/config (ESLint, tsconfig, Next config) ➔ chạy thêm `npm run verify` và áp dụng mục 4.5.3 của `evidence-bar.md` cho mọi rule/flag liên quan.
- Mở `package.json` kiểm tra dependencies và scripts (Vikini không dùng Prisma).
- Kiểm tra kế hoạch có import module chưa tồn tại không (đối chiếu với danh sách `[NEW]` files).
- Xác nhận kế hoạch không phụ thuộc biến môi trường (`.env`) chưa được khai báo trong `docs/architecture.md` hoặc `docs/security.md`.

**S2: Runner Lifecycle & Teardown (Tham chiếu `.agents/skills/streaming-patterns/SKILL.md`)**
_(Vì sao: Kết nối SSE, timer hoặc thư mục tạm trong test không được giải phóng khi đóng luồng sẽ gây rò rỉ bộ nhớ và làm treo tiến trình.)_

- Tìm trong kế hoạch mọi tài nguyên cần cleanup: Supabase connection pool, Upstash Redis client, browser EventSource / AudioContext, hoặc thư mục tạm trong test.
- Kiểm tra xử lý ngắt kết nối mạng và dọn dẹp SSE Chat Stream: cần lắng nghe `req.signal.addEventListener('abort', ...)` và hủy AbortController tương ứng.
- Xác nhận kế hoạch đề cập cleanup/teardown hoặc chiến lược cô lập test (`afterEach`).
- Kiểm tra test cases không dùng circular/tautological mock tự pass.

**S3: Database & Temporal Logic (Supabase PostgreSQL, Tham chiếu `.agents/skills/database-migration/SKILL.md`)**
_(Vì sao: Thiếu RLS policy, thiếu ràng buộc khóa ngoại hoặc lệch múi giờ sẽ dẫn tới rò rỉ dữ liệu chéo giữa người dùng và bản ghi mồ côi.)_

- Khảo sát các bảng dữ liệu qua `docs/database-schema.md` và migration scripts (`supabase/migrations/` hoặc `database-migrations/`).
- Kiểm tra RLS policies: bảng có mở cho `authenticated`/`anon` không, hay chỉ `service_role`?
- Ràng buộc quan hệ: xác nhận `ON DELETE CASCADE` tránh mồ côi bản ghi (`conversations` -> `messages`, `projects` -> `knowledge_documents`).
- Xử lý thời gian: chuẩn ISO 8601 UTC trong DB so với múi giờ hiển thị của người dùng (GMT+7).
- Lập Adversarial Timeline (mục 4.5.2 của `evidence-bar.md`) cho giao dịch Supabase, RPC batching, và connection affinity (hoặc ghi `N/A` nếu task không đụng DB).

**S4: Cross-Task State Flow (Soi Code Thực Tế)**
_(Vì sao: Chỉ đọc kế hoạch mà không soi store/hook thực tế sẽ bỏ sót xung đột trạng thái giữa Zustand, SWR cache và URL query.)_

- Dùng `view_file`/`grep_search` soi trực tiếp các file state liên quan (`src/lib/store/`, `src/app/features/*/hooks/`).
- Kiểm tra tính tương thích giữa Zustand stores, SWR cache keys, và URL query parameters (`useUrlSync`).
- Đối chiếu chữ ký hàm và kiểu dữ liệu trực tiếp trên source code thực tế thay vì chỉ tin vào mô tả trong kế hoạch.

**S5: Security Boundary & 3-Tier Auth (NextAuth + Supabase RLS + Redis, Tham chiếu `.agents/skills/api-patterns/SKILL.md`)**
_(Vì sao: Lộ `service_role` sang client hoặc thiếu xác thực/rate-limit ở API route sẽ cho phép vượt quyền và lạm dụng quota AI.)_

- Kiểm tra xác thực API route: phải gọi `const session = await auth()` hoặc `requireUser()`.
- Phân tách Server-Only: client `service_role` chỉ được nằm trong file `.server.ts` (`src/lib/core/supabase.server.ts`), nghiêm cấm import vào Client Component.
- Client-side Supabase query (nếu có) phải dùng anon key và có policy RLS tương ứng.
- Rate limiting: kiểm tra Upstash Redis rate limit trước khi gọi LLM hoặc tác vụ nặng.
- Lập Adversarial Timeline cho TOCTOU (SSRF qua image download/web search url, bypass auth qua URL query injection, hoặc path traversal/command injection).

**S6: External Resilience & Serverless Execution Cap**
_(Vì sao: Dịch vụ AI bên ngoài thường xuyên timeout hoặc quá tải; thiếu cơ chế giới hạn thời gian và thông báo lỗi sẽ làm treo serverless function.)_

- Xử lý lỗi dịch vụ AI ngoài: Google Gemini (`@google/genai`), Anthropic Claude, OpenRouter, Groq.
- Thiết lập timeout, retry, fallback giữa các provider, và thông báo lỗi rõ ràng qua UI (`StreamErrorBanner`, `toast.error()`).
- Không ghi log credentials, API keys hoặc bearer tokens khi bắt exception vì log hệ thống có thể bị thu thập bởi bên thứ ba.
- Kiểm soát thời gian thực thi serverless phù hợp từng loại route:
  - Chat stream (SSE): `maxDuration = 800` (`src/app/api/chat-stream/route.ts:6`).
  - Image generation & editing: `maxDuration = 60` (`src/app/api/edit-image/route.ts:36`).
  - Cron jobs: `maxDuration = 60` (`src/app/api/cron/cleanup/route.ts:9`).
  - Image description & standard APIs: `maxDuration = 30` (`src/app/api/describe-image/route.ts:18`).

**Domain: Open Inquiry (Đặc thù Vikini)**
_(Vì sao: Các quy ước nội bộ của Vikini về định tuyến model, trần token suy luận và song ngữ không nằm trong kiến thức chung của LLM nên cần kiểm tra riêng.)_

- _Model Registry & Multi-Provider_: Khảo sát `src/lib/core/modelRegistry.ts`, kiểm tra mapping định danh mô hình, provider order.
- _Context Window & Quota Budget_: Đối soát token context (1M tokens) và trần output tokens (`effectiveMaxTokens`) tại `src/lib/core/limits.ts` và `src/lib/core/batchGenQuota.ts`.
- _Reasoning Token Truncation Risk_: Phòng ngừa sự cố cắt ngắn chuỗi tư duy AI (bài học kinh nghiệm từ commit `093d2d2` khi token reasoning `<think>` chiếm trọn `max_tokens` khiến câu trả lời bị rỗng).
- _Hệ Thống Dịch Song Ngữ_: Kiểm tra tuân thủ `.agents/rules/04-bilingual.md`, không hardcode text thô, bảo đảm tính đồng bộ giữa `vi.ts` và `en.ts`.
- _Vòng Đời Quản Lý Attachments_: Quản lý vòng đời file 30 ngày TTL, hàm RPC dọn dẹp, và xử lý stream đa phương tiện (ảnh, tài liệu PDF, audio).
