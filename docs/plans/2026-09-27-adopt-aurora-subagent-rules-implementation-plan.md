# Kế Hoạch Triển Khai: Nâng Cấp Hệ Thống Subagents & Rules (Kế Thừa Tinh Hoa Project AURORA Cho Vikini) — Revision 5 (Deep Localization & Domain Alignment)

> **Ghi Chú Bản Sửa Đổi (Revision 5 — Deep Localization & Domain Alignment)**:
> Cập nhật theo kết quả thẩm định đối soát trực tiếp trên codebase Vikini từ Product Manager & QA (User):
>
> 1. **Bổ sung Ma Trận Bản Địa Hóa (Localization Matrix)** ở đầu Mục 4: Bảng 4 cột đối soát 100% hạng mục kế thừa từ AURORA với thực trạng và bằng chứng `file:line` tại Vikini.
> 2. **Sửa mục 800s**: Xác nhận Vikini **CÓ** sử dụng `maxDuration = 800` tại `src/app/api/deep-research/[taskId]/stream/route.ts:8`. Xóa khỏi danh sách REJECT và đưa vào kịch bản S6 để kiểm soát trần thời gian chạy serverless phù hợp từng loại route.
> 3. **Bảo tồn toàn diện kiểm tra đặc thù của `@qa` Vikini**: Gộp 100% tiêu chí riêng (co-located tests, bilingual, `toast.error()`, file size 150–400 dòng, race conditions Zustand/SWR, SSE abort cleanup) vào Bước 4 (Deep Bug Hunting), tuyệt đối không ghi đè hay làm mất.
> 4. **Bảng Enforcement Status chính xác 100% cho Vikini (`01-coding.md`)**: Phản ánh trung thực cấu hình `eslint.config.mjs` và `tsconfig.json` hiện hành của Vikini; làm rõ "0 warnings" hiện chỉ là kỷ luật agent do `npm run lint` thiếu `--max-warnings 0`; ghi nhận `lint-staged` tự động chạy `eslint --fix` khi commit.
> 5. **Bổ sung mục `[NEEDS_PRODUCT_DECISION]` về chính sách Hook**: Phân tích trade-off về tần suất duyệt hộp thoại trên nhịp commit dày của Vikini; đề xuất 3 phương án (Strict, Scoped Protection, Lifecycle) với default assumption là Phương án 1 (Strict).
> 6. **Viết lại Domain Open Inquiry cho Vikini**: Thay logic tài chính của AURORA bằng các vùng rủi ro thực tế: Model Registry multi-provider (`modelRegistry.ts`), Quota & Context window (`limits.ts`), Cắt xén reasoning token (bài học sự cố commit `093d2d2`), i18n song ngữ, và vòng đời attachments 30 ngày TTL.
> 7. **Bản địa hóa toàn bộ ví dụ trong `evidence-bar.md`**: Thay ví dụ Prisma/undici bằng Supabase RPC/RLS, Upstash Redis rate limit, và xử lý `req.signal` abort khi SSE streaming.
> 8. **Kết nối tài sản kỹ thuật sẵn có**: Tham chiếu `skills/streaming-patterns.md` (S2), `skills/database-migration.md` (S3), `skills/api-patterns.md` (S5); phân định rõ ranh giới giữa quy trình audit định kỳ `workflows/audit.md` và tác tử nghiệm thu on-demand `@qa`.
> 9. **Chính xác hóa Circuit Breaker**: Làm rõ điểm bổ sung mới duy nhất là hành động sau vòng 3 thất bại (Orchestrator dừng tự động, tổng hợp plan và lỗi tồn đọng, trình User quyết định).

---

## 1. Mục Tiêu (Goal)

Nâng cấp toàn diện kiến trúc quản trị đa tác tử (Multi-Agent Governance System) và bộ quy tắc kiểm soát chất lượng của dự án **Vikini** lên chuẩn **Antigravity 2.0**, thông qua việc tiếp thu có chọn lọc và bản địa hóa sâu sắc các cơ chế kiểm soát tối tân từ **Project AURORA**:

1. **Chuyển hóa Code Freeze thành Machine Enforcement**: Thiết lập Hook tự động ở tầng platform (`.agents/hooks.json` và `.agents/scripts/code-freeze-guard.js`) chặn đứng mọi hành vi sửa code trái phép trước khi có thẻ `[PLAN_APPROVED]`.
2. **Nâng cấp Thẩm quyền & Tiêu chuẩn của `@reviewer`**: Trang bị quyền chạy lệnh có kiểm soát (`run_command` qua allowlist), cùng 3 tài liệu vệ tinh chuyên biệt (`allowlist.md`, `evidence-bar.md`, `mental-simulation.md`) được bản địa hóa 100% cho tech stack Vikini (Supabase RLS, NextAuth v5, Upstash Redis, SSE chat streaming).
3. **Chuẩn hóa Quy trình Nghiệm thu & Chống Gaming của `@qa`**: Thiết lập Verification Gate (fail-fast), thủ tục Test Integrity Audit (phát hiện specification gaming qua `git diff`), thống nhất taxonomy lỗi (`[BLOCKER]`, `[MAJOR]`, `[MINOR]`), đồng thời bảo tồn trọn vẹn các tiêu chuẩn nghiệm thu chất lượng đặc thù của Vikini.
4. **Cập nhật & Tối ưu hóa Bộ Rules (`01-coding.md`, `02-quality.md`, `05-plan-review.md`)**:
   - `01-coding.md`: Bổ sung Bảng Trạng Thái Cưỡng Chế (Enforcement Status: máy chặn vs máy hỏi vs kỷ luật) phản ánh trung thực 100% cấu hình linter/compiler của Vikini.
   - `02-quality.md`: Bổ sung chỉ dẫn lệnh PowerShell 5.1 (dùng `;` thay vì `&&` khi chạy chuỗi lệnh thủ công), quy chuẩn Governance-only changes, và Giao thức phân loại lỗi test Type A/B/C.
   - `05-plan-review.md`: Thiết lập Circuit Breaker với cơ chế dừng và báo cáo sau 3 vòng lặp revision, quy định công bố model fallback bắt buộc, và tích hợp cơ chế Hook Code Freeze Guard.
5. **Bảo toàn Tuyệt đối Tech Stack Vikini (IMMUTABLE)**: Giữ nguyên Next.js 16, Supabase PostgreSQL/Auth, NextAuth v5, Upstash Redis, Tailwind CSS v4, Zustand, SWR. Tuyệt đối KHÔNG đưa vào các công nghệ ngoại lai của AURORA (Prisma, Better Auth, yahoo-finance2).

---

## 2. Tài Liệu Tham Chiếu (Pre-Work Reading & References)

### 2.1 Dự Án Nguồn — Project AURORA (`C:\Users\wyemh\Documents\antigravity\Project-AURORA`)

- `.agents/hooks.json`: Cấu hình hook `PreToolUse` bắt matcher `write_to_file|replace_file_content|run_command`.
- `.agents/scripts/code-freeze-guard.js` & `code-freeze-guard.test.ts`: Bộ lọc fail-closed, Test Integrity Guard, và bộ test mẫu.
- `.agents/agents/reviewer/` (`agent.md`, `allowlist.md`, `evidence-bar.md`, `mental-simulation.md`): Cấu trúc tách vệ tinh giữ file `≤ 10,000` ký tự.
- `.agents/agents/qa/agent.md`: Quy trình 7 bước, Verification Gate, Test Integrity Audit.
- `.agents/agents/planner/agent.md`: Quy trình lập kế hoạch chuẩn, Test Contract, tự kiểm tra completeness.
- `.agents/rules/` (`00-core.md`, `01-coding.md`, `02-quality.md`, `05-plan-review.md`): Các điều khoản kỷ luật và quản trị.

### 2.2 Dự Án Đích — Vikini (`c:\Users\wyemh\vikini`)

- `docs/architecture.md`: Cấu trúc phân lớp Next.js 16 App Router (`src/app/`, `src/lib/core/`, `src/lib/features/`, `src/components/ui/`).
- `docs/security.md`: Kiến trúc bảo mật Supabase RLS, NextAuth v5, Upstash Redis rate limit, quy ước `.server.ts`.
- `docs/database-schema.md`: Mô hình cơ sở dữ liệu Supabase PostgreSQL.
- `docs/lessons-learned.md`: Bài học kinh nghiệm từ các sự cố trước đây.
- `skills/streaming-patterns.md`: Cấu trúc chuẩn SSE stream, event types (`token`, `meta`, `thinking`, `done`, `error`) và client/server implementation.
- `skills/database-migration.md`: Quy trình tạo và áp dụng migration trên Supabase.
- `skills/api-patterns.md`: Chuẩn hóa API route (Validate -> Execute -> Respond), error classes, và `requireUser()`.
- `workflows/audit.md`: Quy trình audit mã nguồn tổng thể theo chu kỳ/PR (phân định rõ với `@qa` on-demand).
- `package.json`, `vitest.config.ts`, `tests/setup.ts`, `tsconfig.json`, `eslint.config.mjs`: Cấu hình kiểm thử, typecheck và linter hiện tại.

---

## 3. Assumptions & Cross-Task Dependencies

- **Task tiền đề**: Kế hoạch `docs/plans/2026-09-17-multi-agent-system-implementation-plan.md` đã thiết lập khung 3 subagents cơ bản. Bản kế hoạch này là bước nâng cấp tiến hóa trực tiếp (Evolutionary Upgrade).
- **Môi trường Runtime Antigravity**:
  - _Giả định quan sát thực nghiệm_: Dựa trên thực nghiệm vận hành từ Project AURORA, khi Antigravity thực thi hook cấu hình trong `.agents/hooks.json`, **working directory (`cwd`) là thư mục `.agents/`** (lưu ý: đây là quan sát thực nghiệm, chưa phải tài liệu chính thức từ platform; do đó bản kế hoạch có bổ sung Live Probe tại Bước 6.6 để kiểm chứng thực tế).
  - Lệnh gọi script guard trong `hooks.json` được định tuyến là `"command": "node scripts/code-freeze-guard.js"`.
  - Schema hook yêu cầu bọc ngoài bởi key định danh: `{"code-freeze-guard": { "PreToolUse": [ ... ] } }`.
- **Node.js & Module System**:
  - Phiên bản Node.js 24.x đang hoạt động trong môi trường (`package.json` engines: `node: 24.x`).
  - Do `package.json` ở root Vikini không bật `"type": "module"`, script hook `.agents/scripts/code-freeze-guard.js` (dùng cú pháp ESM `import`/`export`) sẽ được cấp một file `.agents/scripts/package.json` riêng chứa `{"type": "module"}`. Điều này giúp chạy trực tiếp siêu tốc qua Node CLI mà không gây xung đột với root Next.js project.
- **Type-Check & Linter Scope**:
  - `tsconfig.json` của Vikini cấu hình `allowJs: true`, `strict: true`, nhưng KHÔNG có `checkJs: true`. Do đó, script `.agents/scripts/code-freeze-guard.js` bắt buộc đặt directive `// @ts-check` ở ngay dòng đầu tiên để `npm run type-check` (`tsc --noEmit`) thực sự type-check script này qua chú giải JSDoc strict mode.
  - `eslint.config.mjs` của Vikini đã có `.agents/**` trong mảng `ignores: [...]`, vì vậy `npm run lint` bỏ qua `.agents/**`. Chất lượng của script được đảm bảo bởi `tsc --noEmit` và Vitest test suite.
- **Vitest Test Discovery**:
  - Trong Vitest 4.0.17 (`globFiles`), mặc định quét test files với cờ `dot: true`. File `vitest.config.ts` của Vikini chỉ cấu hình `exclude: ["tests/e2e/**", "node_modules/**"]` và không hề loại trừ `.agents/`. Do đó Vitest sẽ tự động phát hiện và chạy test suite tại `.agents/scripts/code-freeze-guard.test.ts` mà KHÔNG cần chỉnh sửa `vitest.config.ts`.
- **Không thay đổi dependency ngoài (No external dependencies added)**: Dự án tái sử dụng 100% các công cụ hiện có (`vitest`, `typescript`, `eslint`). Không bổ sung bất kỳ package npm mới nào vào root `package.json`.

---

## 4. Ma Trận Bản Địa Hóa & Ranh Giới Kỹ Thuật (Localization Matrix & Boundaries)

### 4.1 Ma Trận Bản Địa Hóa (Localization Matrix)

| Tính Năng Tiếp Thu Từ AURORA                   | Hiện Trạng Của Vikini                                                         | Quyết Định (Giữ / Gộp / Bỏ / Sửa)                                                                               | Bằng Chứng Thực Tế (`file:line`)                                                             |
| :--------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Hook PreToolUse Code Freeze**                | Chỉ có code freeze bằng kỷ luật trong `05-plan-review.md:9`                   | **Giữ & Sửa**: Tạo hook machine-enforced fail-closed; chuẩn hóa `cwd = .agents/` và schema bọc                  | `c:\Users\wyemh\vikini\.agents\rules\05-plan-review.md:9-11`                                 |
| **Xác thực Artifact ngoài repo**               | Artifact Antigravity nằm ở `~/.gemini/antigravity/brain/`                     | **Sửa**: Xác thực 2 lớp, bắt buộc đường dẫn tuyệt đối (`path.isAbsolute`), cấm traversal và spoofing            | User workspace configuration metadata                                                        |
| **Vitest Test Discovery cho `.agents/`**       | `vitest.config.ts` chỉ exclude `tests/e2e/**`, `node_modules/**`              | **Bỏ (Không sửa config)**: Vitest mặc định `dot: true` tự quét `.agents/scripts/`                               | `c:\Users\wyemh\vikini\vitest.config.ts:11`                                                  |
| **Vercel maxDuration 800s**                    | Đã sử dụng trên Deep Research SSE stream; các route khác 30s-60s              | **Sửa**: Xóa khỏi REJECT; tích hợp vào S6 để đối soát tải serverless từng route                                 | `src/app/api/deep-research/[taskId]/stream/route.ts:8`, `src/app/api/edit-image/route.ts:33` |
| **Quy trình `@reviewer` 7 bước & Vệ tinh**     | Reviewer chỉ có 6 tool read-only, chưa có vệ tinh và evidence bar             | **Giữ & Sửa**: Thêm `run_command` allowlist; bản địa hóa 3 vệ tinh cho Supabase, NextAuth, Redis                | `c:\Users\wyemh\vikini\.agents\agents\reviewer\agent.md:9-15`                                |
| **Quy trình `@qa` 7 bước & Verification Gate** | Đã có kiểm tra co-located test, bilingual, file size, Zustand race conditions | **Gộp**: Bảo tồn 100% tiêu chuẩn Vikini, lồng vào Bước 4 (Deep Bug Hunting); thêm Bước 3 Gate fail-fast         | `c:\Users\wyemh\vikini\.agents\agents\qa\agent.md:32-52`                                     |
| **Thủ tục Test Integrity Audit**               | Chưa có kiểm tra `git diff` test vs code, dễ bị specification gaming          | **Giữ**: Tích hợp Bước 6 kiểm tra `git diff --stat` và phân loại lỗi Type A/B/C                                 | `c:\Users\wyemh\vikini\.agents\agents\qa\agent.md:58-67`                                     |
| **Bảng Enforcement Status**                    | Chưa có bảng phân định máy chặn vs kỷ luật trong `01-coding.md`               | **Sửa**: Viết lại chính xác theo `eslint.config.mjs` (cấm `any`, cấm console trừ warn/error, floating promises) | `c:\Users\wyemh\vikini\eslint.config.mjs:29-64`                                              |
| **Chỉ dẫn lệnh Windows PowerShell 5.1**        | Đã có lỗi parser khi agent chạy chuỗi lệnh `&&` trong terminal                | **Giữ**: Mandate dùng `;` khi chạy manual; làm rõ script `"verify"` trong `package.json` chạy qua cmd.exe       | `c:\Users\wyemh\vikini\package.json:24`                                                      |
| **Circuit Breaker Revision Loop**              | Đã có câu "tối đa 3 lần" nhưng thiếu hành vi cụ thể sau thất bại              | **Sửa**: Giữ nguyên chu kỳ 3 lần; bổ sung hành động dừng tự động, tổng hợp lỗi tồn đọng, trình User             | `c:\Users\wyemh\vikini\.agents\rules\05-plan-review.md:41`                                   |

---

### 4.2 Bảng Phân Định Ranh Giới Kỹ Thuật (Adopt vs. Reject)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHÂN ĐỊNH RANH GIỚI KỸ THUẬT KẾ THỪA                     │
├──────────────────────────────────────┬──────────────────────────────────────┤
│    ĐƯỢC TIẾP THU TỪ AURORA (ADOPT)   │   TUYỆT ĐỐI KHÔNG TIẾP THU (REJECT)  │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 1. Hook tự động Code Freeze Guard     │ 1. Prisma ORM & @prisma/adapter-pg   │
│    (.agents/hooks.json, script, test)│    (Vikini dùng Supabase JS & pg)    │
│ 2. @reviewer vệ tinh (allowlist,      │ 2. Better Auth & Admin Plugin        │
│    evidence-bar, mental-simulation)  │    (Vikini dùng NextAuth v5)         │
│ 3. Quyền run_command có kiểm soát     │ 3. Thư viện yahoo-finance2           │
│    cho @reviewer                     │    (Vikini là chat/studio/rag AI)    │
│ 4. @qa Verification Gate (fail-fast)  │ 4. Logic tài chính của AURORA        │
│ 5. @qa Test Integrity Audit          │    (thay bằng AI multi-provider,     │
│ 6. Thống nhất taxonomy [BLOCKER]...   │     reasoning tokens, quota chat)    │
│ 7. Circuit Breaker dừng sau 3 vòng   │ 5. Đổi "type": "module" root         │
│ 8. Bảng Enforcement Status Vikini    │    (dùng .agents/scripts/package.json│
│ 9. Chỉ dẫn PowerShell 5.1 (dùng ;)   │    cách ly để không phá Next.js 16)  │
│ 10. Test Failure Triage Type A/B/C   │ 6. Sửa vitest.config.ts không cần    │
│ 11. Bắt buộc công bố model fallback  │    thiết (Vitest tự quét .agents)    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

### 4.3 Chi Tiết Bản Địa Hóa Mental Simulation S1–S6 & Domain Cho Vikini:

- **S1: Cold-start & Build**:
  - Chạy `npm run type-check` (baseline).
  - Kiểm tra `package.json` và dependencies. (KHÔNG kiểm tra `prisma generate`).
  - Xác nhận plan không phụ thuộc biến môi trường chưa khai báo trong `docs/architecture.md` hoặc `docs/security.md`.
- **S2: Runner Lifecycle & Teardown (Tham chiếu `skills/streaming-patterns.md`)**:
  - Quản lý giải phóng tài nguyên: connection Supabase/pg pool, Upstash Redis client.
  - Xử lý ngắt kết nối mạng và dọn dẹp SSE Chat Stream: lắng nghe `req.signal.addEventListener('abort', ...)` và hủy controller.
  - Cleanup timer, audio/speech context, browser EventSource. Tránh mock vòng tròn tự pass.
- **S3: Database & Temporal Logic (Supabase PostgreSQL, Tham chiếu `skills/database-migration.md`)**:
  - Khảo sát các bảng dữ liệu qua `docs/database-schema.md` và migration scripts (`supabase/migrations/` hoặc `database-migrations/`).
  - Kiểm tra RLS policies: Bảng có mở cho `authenticated`/`anon` không, hay chỉ `service_role`?
  - Ràng buộc quan hệ: `ON DELETE CASCADE` tránh mồ côi bản ghi (`conversations` -> `messages`, `projects` -> `knowledge_documents`).
  - Xử lý thời gian: Chuẩn ISO 8601 UTC trong DB vs múi giờ hiển thị của người dùng (GMT+7).
  - Adversarial Timeline cho giao dịch Supabase, RPC batching, và connection affinity.
- **S4: Cross-Task State Flow**:
  - Dùng `view_file` soi trực tiếp các file state từ task trước (`src/lib/store/`, `src/app/features/*/hooks/`).
  - Kiểm tra tính tương thích giữa Zustand stores, SWR cache keys, và URL query parameters (`useUrlSync`).
- **S5: Security Boundary & 3-Tier Auth (NextAuth + Supabase RLS + Redis, Tham chiếu `skills/api-patterns.md`)**:
  - Kiểm tra xác thực API route: BẮT BUỘC gọi `const session = await auth()` hoặc `requireUser()`.
  - Phân tách Server-Only: Client `service_role` chỉ được nằm trong file `.server.ts` (`src/lib/core/supabase.server.ts`), TUYỆT ĐỐI CẤM import vào Client Component.
  - Client-side Supabase query (nếu có) bắt buộc dùng anon key và phải có policy RLS tương ứng.
  - Rate limiting: Kiểm tra Upstash Redis rate limit trước khi gọi LLM hoặc Deep Research.
  - Adversarial Timeline cho TOCTOU (SSRF qua image download/web search url, bypass auth qua URL query injection).
- **S6: External Resilience & Serverless Execution Cap**:
  - Xử lý lỗi dịch vụ AI ngoài: Google Gemini (`@google/genai`), Anthropic Claude, OpenRouter, Groq.
  - Thiết lập timeout, retry, fallback giữa các provider, và thông báo lỗi rõ ràng qua UI (`StreamErrorBanner`, `toast.error()`).
  - Tuyệt đối không log credentials, API keys hoặc bearer tokens khi bắt exception.
  - **Kiểm soát thời gian thực thi serverless phù hợp từng loại route**:
    - Deep Research stream: `maxDuration = 800` (`src/app/api/deep-research/[taskId]/stream/route.ts:8`).
    - Image generation & editing: `maxDuration = 60` (`src/app/api/edit-image/route.ts:33`).
    - Cron jobs: `maxDuration = 60` (`src/app/api/cron/cleanup/route.ts:9`).
    - Image description & standard APIs: `maxDuration = 30` (`src/app/api/describe-image/route.ts:15`).
- **Domain: Open Inquiry (Viết lại 100% cho Vikini)**:
  - _Model Registry & Multi-Provider_: Khảo sát `src/lib/core/modelRegistry.ts`, kiểm tra mapping định danh mô hình, provider order (Relace / Fireworks / StreamLake / Direct API).
  - _Context Window & Quota Budget_: Đối soát token context (1M tokens) và trần output tokens (`effectiveMaxTokens`) tại `src/lib/core/limits.ts` và `src/lib/features/chat/batchGenQuota.ts`.
  - _Reasoning Token Truncation Risk_: Phòng ngừa sự cố cắt ngắn chuỗi tư duy AI (bài học kinh nghiệm từ commit `093d2d2` khi token reasoning `<think>` chiếm trọn `max_tokens: 8192` khiến câu trả lời bị rỗng).
  - _Hệ Thống Dịch Song Ngữ_: Kiểm tra tuân thủ `04-bilingual.md`, không hardcode text thô, bảo đảm tính đồng bộ giữa `vi.ts` và `en.ts`.
  - _Vòng Đời Quản Lý Attachments_: Quản lý vòng đời file 30 ngày TTL, hàm RPC dọn dẹp, và xử lý stream đa phương tiện (ảnh, tài liệu PDF, audio).

---

## 5. Phân Tích Trade-Off & `[NEEDS_PRODUCT_DECISION]` Về Chính Sách Hook

### Bối Cảnh Thực Tế Tại Vikini

Vikini là một sản phẩm AI Chat & Studio phát triển năng động với nhịp độ commit rất dày (hơn 384 commits), bao gồm nhiều đợt refactor UI, tinh chỉnh tokens, và sửa lỗi đa file. Nếu áp dụng cơ chế Hook Code Freeze Guard ở mức **Strict / Fail-Closed** (hỏi xác nhận người dùng với TỪNG thao tác ghi vào `src/**`), trong các task phát triển lớn chạm tới 15–20 file UI/hooks, người dùng sẽ phải bấm nút **Approve** hàng chục lần liên tục, gây gián đoạn và ức chế trải nghiệm phát triển.

### 3 Phương Án Chính Sách Hook Được Đề Xuất

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    3 PHƯƠNG ÁN CƠ CHẾ HOOK CODE FREEZE                      │
├───────────────────┬─────────────────────────────────────────────────────────┤
│ Phương Án         │ Đặc Điểm, Ưu Điểm & Nhược Điểm                          │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ **Phương Án 1**   │ • Đặc điểm: Chặn và hỏi User mọi thao tác ghi ngoài docs│
│ *(Strict /        │ • Ưu điểm: An toàn tuyệt đối, ngăn 100% việc tự ý sửa   │
│ Fail-Closed)*     │   code khi chưa có lệnh phê duyệt rõ ràng.              │
│ [DEFAULT DE XUẤT] │ • Nhược điểm: Friction cao khi sửa nhiều file UI nhỏ.   │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ **Phương Án 2**   │ • Đặc điểm: Sau khi có [PLAN_APPROVED], chỉ bắt buộc    │
│ *(Scoped          │   hỏi User với các file cốt lõi (*.server.ts, migration,│
│ Protection)*      │   TEST_INFRA_FILES); tự động cho phép ghi vào UI.       │
│                   │ • Ưu điểm: Giảm friction cho lập trình frontend.        │
│                   │ • Nhược điểm: Phức tạp hóa logic nhận diện trạng thái.  │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ **Phương Án 3**   │ • Đặc điểm: Kích hoạt hook trong pha planning/review,   │
│ *(Lifecycle       │   User tắt/tạm dừng hook khi chuyển sang pha code.      │
│ Control)*         │ • Ưu điểm: Linh hoạt cao nhất, không bị hỏi khi code.   │
│                   │ • Nhược điểm: Dễ bị quên bật lại hook ở task tiếp theo. │
└───────────────────┴─────────────────────────────────────────────────────────┘
```

> **`[NEEDS_PRODUCT_DECISION]`**:
>
> - **Câu hỏi cho User (Product Manager)**: _Bạn muốn áp dụng chính sách Hook Code Freeze Guard theo Phương Án 1 (Strict — An toàn tuyệt đối), Phương Án 2 (Scoped Protection — Chỉ khóa file nhạy cảm), hay Phương Án 3 (Lifecycle — Bật/tắt theo pha)?_
> - **Default Assumption của Planner**: Kế hoạch tạm thời cấu hình theo **Phương Án 1 (Strict / Fail-Closed)** nhằm bảo đảm tiêu chuẩn an toàn cao nhất của chuẩn Antigravity 2.0. Chuỗi lập kế hoạch vẫn tiếp tục bình thường; Orchestrator sẽ trình câu hỏi này để User quyết định cấu hình cuối cùng sau khi `[PLAN_APPROVED]`.

---

## 6. Files Cần Chỉnh Sửa / Tạo Mới

### 6.1 Files Tạo Mới (`[NEW]`)

1. `[NEW]` `.agents/scripts/package.json`:
   - Nội dung: `{"type": "module"}` nhằm cô lập phạm vi ESM cho các file script nội bộ của AI Platform.
2. `[NEW]` `.agents/scripts/code-freeze-guard.js`:
   - Dòng 1: Đặt `// @ts-check` để ép `tsc` type-check toàn diện file JS.
   - Hằng số unfrozen trong repo: `UNFROZEN_PREFIXES = ['docs/']` (loại bỏ `brain/` vì Vikini không có `brain/` ở root repo).
   - **Xác thực an toàn tuyệt đối cho Artifact Antigravity (`isAntigravityArtifact`) (R1)**:
     - _Ràng buộc 1_: Bắt buộc `toRepoRelative(targetFile) === null` (đường dẫn đã thoát hoàn toàn khỏi repo).
     - _Ràng buộc 2 (Chống lệch pha cwd)_: Đường dẫn `targetFile` **BẮT BUỘC là đường dẫn tuyệt đối** (`path.isAbsolute(toPosix(targetFile))`). Mọi đường dẫn tương đối (kể cả có chứa `../../.gemini/...`) đều bị từ chối (`return false` -> `ask`).
     - _Ràng buộc 3_: Chuẩn hóa `targetAbsolute = path.resolve(toPosix(targetFile))` và so khớp với `ARTIFACT_ROOT = path.resolve(os.homedir(), '.gemini/antigravity/brain')`. Biến `rel = toPosix(path.relative(ARTIFACT_ROOT, targetAbsolute))` bắt buộc thỏa mãn: `rel !== '' && !rel.startsWith('../') && !path.isAbsolute(rel)`.
     - _Ràng buộc 4 (Phạm vi tệp)_: File hợp lệ có đuôi `.md`, `.json`, hoặc nằm trong thư mục `scratch/` với đuôi an toàn (`.md`, `.json`, `.ts`, `.js`, `.txt`, `.csv`, `.sql`). Tuyệt đối cấm các file thực thi (`.exe`, `.dll`, `.bat`, `.cmd`, `.ps1`).
     - Chặn đứng 100% path traversal `..` và artifact giả mạo trong repo (`src/...`).
   - **Thứ tự ưu tiên trong `decide()`**:
     - Kiểm tra `TEST_INFRA_FILES` TRƯỚC `isTestFile` (đảm bảo `tests/setup.ts`, `vitest.config.ts`, `package.json`... luôn được định danh chính xác là Test Infrastructure Guard).
     - Kiểm tra `isTestFile` sau test infra: Nhận diện `\.test\.(ts|tsx)$`, `\.spec\.(ts|tsx)$`, `(?:^|\/)__tests__\/`, `(?:^|\/)tests\/`.
     - Kiểm tra frozen application paths: Trả về `decision: ask` cho toàn bộ mã nguồn `src/**`.
   - Nhận diện các lệnh kiểm thử của Vikini (`npm run type-check`, `npm run lint`, `npm run test:run`, `npm run verify`, `git` read-only, probe in-memory). Loại bỏ triệt để `prisma validate`.
   - Kế thừa cơ chế phân tách chuỗi lệnh PowerShell 5.1 nối bằng dấu chấm phẩy (`;`) từ AURORA: Cho phép khi mọi phân đoạn đều thuộc allowlist.
   - Tích hợp Test Integrity Guard kiểm tra việc nới lỏng test (`assessTestIntegrity` phát hiện giảm expect, thêm `.skip`/`.only`/`.todo`/`xit`/`fit`/`.skipIf`/`.runIf`/`.fails`, nới lỏng matcher, bọc `try/catch`).
   - Xử lý an toàn payload Antigravity (`unwrapJsonString`, giải nén `ReplacementChunks`).
   - **Chuẩn hóa JSDoc Type Annotations (khắc phục 4 lỗi TS khi thêm `// @ts-check`)**:
     - Gán kiểu cho hàm `countMatches`: `/** @type {(str: string, regex: RegExp) => number} */ const countMatches = ...` (khắc phục TS7006 implicit any).
     - Gán kiểu và thu hẹp kiểu an toàn trong `extractInput`: Thu hẹp `const targetFile = typeof rawTarget === 'string' ? rawTarget : undefined;` và `const command = typeof rawCommand === 'string' ? rawCommand : undefined;` (khắc phục TS2322 unknown to string).
3. `[NEW]` `.agents/scripts/code-freeze-guard.test.ts`:
   - Bộ unit tests toàn diện chạy bằng Vitest kiểm thử cụ thể:
     - _toRepoRelative_: Chuẩn hóa relative POSIX path, chuẩn hóa Windows path, trả về null khi path escape repo.
     - _Antigravity artifacts (R1 & N1)_:
       - Cho phép đường dẫn tuyệt đối artifact hợp lệ trong `~/.gemini/antigravity/brain/conv-id/plan.md`.
       - Cho phép file scratch hợp lệ trong `~/.gemini/antigravity/brain/conv-id/scratch/data.sql`.
       - Chặn đường dẫn tương đối trỏ ra artifact `../../.gemini/antigravity/brain/...` -> `ask`.
       - Chặn đường dẫn path traversal: `.../brain/x/../../../../vikini/package.json` -> `ask`.
       - Chặn artifact giả nằm trong repo: `src/.gemini/antigravity/brain/evil.json` -> `ask`.
       - Chặn file đuôi không hợp lệ / nguy hiểm trong scratch: `.../brain/conv-id/scratch/run.bat` -> `ask`.
     - _Priority Ordering (N2)_: `tests/setup.ts` BẮT BUỘC trả về lý do chứa `Test Infrastructure Guard` (không phải Test Integrity Guard).
     - _decide write targets_: Cho phép `docs/plans/*.md`; Hỏi khi ghi vào `src/lib/...`, `.agents/rules/...`, path ngoài repo, và chặn bypass substring (`src/features/docs/secret.ts`, `src/lib/task.md`).
     - _decide commands_: Cho phép verification suite (`npm run type-check`, `npm run lint`, `npm run test:run`, `npm run verify`, `git status`); Cho phép scoped Vitest run; Cho phép cờ `--reporter` an toàn; Hỏi khi kèm cờ snapshot/mutating (`-u`, `--coverage`, `--fix`, `--write`); Cho phép chuỗi lệnh `;` hợp lệ; Hỏi khi chuỗi `;` chứa phân đoạn nguy hiểm; Hỏi khi có redirection (`>`) hoặc chaining (`&&`).
     - _decide test files (Test Integrity Guard)_: Nhận diện test file và xuất cảnh báo Test Integrity Guard; Phát hiện giảm expect; Phát hiện thêm `.skip`, `.only`, `.todo`, `xit`, `fit`, `.skipIf`, `.fails`; Không gắn cờ từ tiếng Anh thông thường ('only', 'fit'); Phát hiện nới matcher (`toEqual` -> `toBeDefined`); Phát hiện bọc `try/catch`; Không cờ lỗi Type B; Trả về unavailable khi thiếu một vế content.
     - _extractInput_: Giải nén chính xác payload Antigravity, unwrap JSON string escaped, giải nén `ReplacementChunks[]`.
4. `[NEW]` `.agents/agents/reviewer/allowlist.md`:
   - Tài liệu vệ tinh quy định chi tiết 4 nhóm lệnh `run_command` được phép chạy: Nhóm A (Verification suite), Nhóm B (Wiring & Negative Probes), Nhóm C (Runtime In-memory Probes), Nhóm D (Git read-only).
   - Danh sách cấm tuyệt đối các lệnh mutating, side-effect, và leak secrets.
5. `[NEW]` `.agents/agents/reviewer/evidence-bar.md`:
   - Quy chuẩn bằng chứng bắt buộc (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`).
   - **Ví dụ kỹ thuật bản địa hóa 100% cho Vikini**:
     - Library Claim Verification: Soi trực tiếp Supabase client, NextAuth handlers, `@google/genai` models call.
     - Adversarial Timeline 4 trục: Đồng thời (2 request mutate đồng thời), TOCTOU (SSRF image download / verify auth), Thất bại dọn dẹp (SSE stream abort listener throw exception), Môi trường serverless (affinity connection pool, Upstash in-memory fallback).
     - Enforcement Claim Verification: Negative probe cho Zod validator, Supabase RLS policy, Redis rate limit key format.
     - Audit Bảng Rủi Ro: Map rủi ro với technical control trong `src/lib/core/` và `src/lib/features/`.
6. `[NEW]` `.agents/agents/reviewer/mental-simulation.md`:
   - 6 kịch bản mô phỏng đối kháng bắt buộc (S1–S6 + Domain) đã được thiết kế riêng cho tech stack của Vikini (đã nêu chi tiết tại Mục 4.3).
7. `[NEW]` `.agents/hooks.json` _(Tạo ở Bước 5.3 cuối cùng)_:
   - Cấu hình hook `PreToolUse` cho `write_to_file|replace_file_content|run_command`.
   - Key bọc chuẩn hóa `{"code-freeze-guard": { "PreToolUse": [ ... ] } }`.
   - Command `"node scripts/code-freeze-guard.js"` thực thi từ `cwd` là `.agents/`.

### 6.2 Files Chỉnh Sửa (`[MODIFY]`)

1. `[MODIFY]` `.agents/agents/reviewer/agent.md`:
   - Bổ sung `run_command` vào danh sách `tools` frontmatter.
   - Thêm quy trình đánh giá chuẩn 7 bước (Bước 0 đến Bước 6).
   - Bước 0: Bắt buộc `view_file` nạp đủ 3 file vệ tinh (`evidence-bar.md`, `mental-simulation.md`, `allowlist.md`).
   - Bước 2: Plan Completeness Gate.
   - Bước 3: Tra cứu chéo phiên bản online bắt buộc.
   - Bước 6: Định dạng báo cáo bắt buộc với `Mental Simulation Verification Matrix`, `Claim Verification`, `Adversarial Timelines`, và `Commands Executed`.
   - Bổ sung yêu cầu công bố model fallback.
   - Giữ dung lượng file `≤ 10,000` ký tự.
2. `[MODIFY]` `.agents/agents/qa/agent.md`:
   - Thống nhất thang đo lỗi sang `[BLOCKER]`, `[MAJOR]`, `[MINOR]`.
   - Thiết lập Bước 3: Verification Gate — Nếu verify FAIL thì xuất ngay `[QA_FAILED]`, không đọc code.
   - **Bảo tồn toàn diện kiểm tra đặc thù Vikini ở Bước 4 (Deep Bug Hunting)**:
     - Co-located test: bắt buộc mọi exported function trong `src/lib/core/` và `src/lib/features/` có test `*.test.ts` đặt cạnh.
     - Bilingual: kiểm tra theo `rules/04-bilingual.md`, cấm hardcode UI string.
     - User feedback: bắt buộc `toast.error()` cho mọi action thất bại.
     - Modularity: cảnh báo file vượt 150–400 dòng (`rules/01-coding.md`).
     - State & Concurrency: kiểm tra race conditions Zustand stores, SWR mutate không đồng bộ, và abort cleanup cho SSE streams.
   - Thiết lập Bước 6: Test Integrity Audit — Phát hiện specification gaming qua `git diff --stat` và phân loại lỗi A/B/C.
   - Chuẩn hóa định dạng báo cáo với các bảng biểu: Plan Compliance Matrix, Verification Results, Tested Scenarios, Bug Report, Đề xuất cải tiến.
   - Bổ sung ALLOWLIST lệnh `run_command` tường minh và Post-[QA_FAILED] Flow.
   - Giữ dung lượng file `≤ 10,000` ký tự.
3. `[MODIFY]` `.agents/agents/planner/agent.md`:
   - Bổ sung tool `replace_file_content` vào frontmatter.
   - Bổ sung mục Test Contract bắt buộc vào cấu trúc plan.
   - Bổ sung nhận diện Circuit Breaker (dừng sau 3 vòng lặp revision) và cơ chế `[NEEDS_PRODUCT_DECISION]`.
   - Giữ dung lượng file `≤ 10,000` ký tự.
4. `[MODIFY]` `.agents/rules/01-coding.md`:
   - **Bổ sung Bảng Trạng Thái Cưỡng Chế (Enforcement Status table) phản ánh đúng 100% thực tế Vikini**:
     - _Máy chặn_: `@typescript-eslint/no-explicit-any: error`, `no-console: error` (trừ warn/error), `@typescript-eslint/no-floating-promises: error`, `@typescript-eslint/no-dupe-class-members: error`, `no-var: error`, `tsconfig.json` `strict: true`, `noEmit: true`.
     - _Máy hỏi_: Code Freeze Guard (`.agents/scripts/code-freeze-guard.js`) chặn ghi file ngoài `docs/` và lệnh ngoài allowlist.
     - _Kỷ luật agent + `@reviewer`_: "0 warnings" (do lệnh `npm run lint` hiện thiếu cờ `--max-warnings 0`), file size 150–400 dòng, co-located tests, `toast.error()`, bilingual `04-bilingual.md`, thinking budget max khi fallback.
     - _Lưu ý công cụ_: `lint-staged` trong `package.json` tự động áp dụng `eslint --fix` và `prettier --write` khi commit file `*.{ts,tsx,js,jsx}`.
   - Giữ dung lượng file `≤ 12,000` ký tự.
5. `[MODIFY]` `.agents/rules/02-quality.md`:
   - Bổ sung chỉ dẫn thực thi lệnh Windows PowerShell 5.1: CẤM dùng `&&`, bắt buộc dùng `;` khi chạy chuỗi lệnh thủ công trong terminal Windows (lưu ý: script `"verify"` trong `package.json` vẫn dùng `&&` hợp lệ vì npm chạy qua `cmd.exe`).
   - Bổ sung quy chuẩn Governance-only changes (Frontmatter, GFM, link tương đối từ repo root, char limits `≤ 12,000` cho rules và `≤ 10,000` cho agent.md).
   - Bổ sung Giao thức phân loại lỗi kiểm thử (Test Failure Triage Protocol: Loại A - Code sai, Loại B - Hạ tầng test sai, Loại C - Đặc tả đổi) và nghiêm cấm hạ thấp tiêu chuẩn test.
   - Làm rõ mối quan hệ tài liệu: Tham chiếu `skills/streaming-patterns.md`, `skills/database-migration.md`, `skills/api-patterns.md`; phân định ranh giới giữa quy trình audit định kỳ `workflows/audit.md` và tác tử nghiệm thu on-demand `@qa`.
   - Giữ dung lượng file `≤ 12,000` ký tự.
6. `[MODIFY]` `.agents/rules/05-plan-review.md`:
   - Mục 1: Bổ sung mô tả cơ chế hook tự động `.agents/scripts/code-freeze-guard.js`. Làm rõ hook là "máy hỏi" (fail-closed prompt) với mọi thao tác ghi ngoài `docs/` và thư mục artifact ngoài repo (`~/.gemini/antigravity/brain/`), bất kể task đã có `[PLAN_APPROVED]` hay chưa, nhằm bắt buộc có sự phê duyệt của người dùng trước khi chạm vào mã nguồn.
   - Mục 4: Bổ sung chỉ dẫn Evidence Bar và Mental Simulation vệ tinh, cho phép `run_command` theo allowlist.
   - Mục 5: **Chính xác hóa Circuit Breaker**: Làm rõ hành động cụ thể sau vòng thứ 3 thất bại (Orchestrator dừng chuỗi tự động, tổng hợp plan hiện tại và các lỗi `[BLOCKER]`/`[MAJOR]` tồn đọng, xuất báo cáo cho User quyết định hướng xử lý). Bắt buộc công bố model fallback.
   - Mục 6: Thống nhất taxonomy lỗi `@qa` thành `[BLOCKER]`, `[MAJOR]`, `[MINOR]`.
   - Đo lường dung lượng thực tế qua PowerShell: Duy trì nghiêm ngặt `≤ 12,000` ký tự.
7. `[MODIFY]` `docs/architecture.md`:
   - Cập nhật Section 7 (Multi-Agent Governance Architecture) bổ sung: Platform Hook Code Freeze Guard, Reviewer Evidence Bar & Mental Simulation, QA Verification Gate & Test Integrity Audit.
8. `[MODIFY]` `docs/CHANGELOG.md`:
   - Thêm mục ghi nhận đợt nâng cấp quản trị ngày 2026-09-27 (Revision 5).

---

## 7. Các Bước Thực Hiện Tuần Tự (Checklist Chi Tiết)

### Bước 0: Baseline Working Tree Inspection (HARD GATE — BẮT BUỘC)

- [ ] **Bước 0.1**: Chạy `git status` kiểm tra trạng thái working directory.
- [ ] **Bước 0.2 (HARD GATE)**:
  - Kiểm tra danh sách file bị sửa đổi (modified) hoặc chưa được theo dõi (untracked).
  - _Ngoại lệ hợp lệ duy nhất_: File kế hoạch hiện tại (`docs/plans/2026-09-27-adopt-aurora-subagent-rules-implementation-plan.md`) và file build cache `tsconfig.tsbuildinfo` (do `tsc` tự động sinh ra khi kiểm tra kiểu).
  - Nếu phát hiện BẤT KỲ file nào khác bị sửa đổi hoặc untracked: **BẮT BUỘC DỪNG LẠI NGAY LẬP TỨC**.
  - Báo cáo và yêu cầu User commit hoặc dọn dẹp sạch sẽ working tree trước khi bắt đầu Giai đoạn 1. Điều này đảm bảo Test Integrity Audit (`git diff --stat`) của `@qa` không bị sai lệch do rác từ các task trước. _(Tuân thủ `rules/00-core.md`: Agent không tự động commit)._

### Giai đoạn 1: Nền Tảng Scripts Code Freeze Guard & Kiểm Thử

- [ ] **Bước 1.1**: Tạo file `.agents/scripts/package.json` với nội dung `{"type": "module"}` để kích hoạt chế độ ESM biệt lập cho thư mục scripts.
- [ ] **Bước 1.2**: Tạo file `.agents/scripts/code-freeze-guard.js`:
  - Dòng 1: Đặt `// @ts-check`.
  - Khởi tạo `ARTIFACT_ROOT = path.resolve(os.homedir(), '.gemini/antigravity/brain')`.
  - Cấu hình `UNFROZEN_PREFIXES = ['docs/']` (loại bỏ `brain/`).
  - Thêm hàm xác thực an toàn `isAntigravityArtifact(targetFile)` yêu cầu đường dẫn tuyệt đối, chuẩn hóa `ARTIFACT_ROOT`, kiểm tra đuôi `.md`, `.json`, và cho phép thư mục `scratch/` với đuôi an toàn (`.md`, `.json`, `.ts`, `.js`, `.txt`, `.csv`, `.sql`).
  - Sắp xếp thứ tự kiểm tra trong `decide()`: `TEST_INFRA_FILES` TRƯỚC `isTestFile`.
  - Khắc phục 4 lỗi JSDoc typecheck: Typing cho `countMatches` và type narrowing cho `unwrapJsonString` trong `extractInput`.
- [ ] **Bước 1.3**: Tạo file `.agents/scripts/code-freeze-guard.test.ts` chứa đầy đủ danh mục test cases chi tiết đã định nghĩa ở Mục 6.1 (bao gồm test chặn đường dẫn tương đối R1, bypass probes N1, và priority test N2).
- [ ] **Bước 1.4**: Chạy `npm run type-check` (`tsc --noEmit`) ngay lập tức để kiểm chứng `code-freeze-guard.js` (dưới directive `// @ts-check`) đạt 0 lỗi typecheck ở strict mode.
- [ ] **Bước 1.5**: Chạy `npx vitest list --filesOnly` để kiểm chứng Vitest mặc định phát hiện file `.agents/scripts/code-freeze-guard.test.ts` mà không cần sửa `vitest.config.ts`.
- [ ] **Bước 1.6**: Chạy Vitest kiểm thử suite của guard:
  ```powershell
  npx vitest run .agents/scripts/code-freeze-guard.test.ts
  ```

### Giai đoạn 2: Nâng Cấp Subagent `@reviewer` & Tạo 3 Tài Liệu Vệ Tinh

- [ ] **Bước 2.1**: Tạo file `.agents/agents/reviewer/allowlist.md` định nghĩa 4 nhóm lệnh được phép chạy cho `@reviewer` (loại bỏ prisma, giữ lệnh probe và verification của Vikini).
- [ ] **Bước 2.2**: Tạo file `.agents/agents/reviewer/evidence-bar.md` thiết lập tiêu chuẩn chứng cứ `[CMD]`, `[SRC]`, `[ADV]`, `[URL]` và quy trình Negative Probe bản địa hóa cho Supabase RPC/RLS, Redis rate limit, và SSE stream abort.
- [ ] **Bước 2.3**: Tạo file `.agents/agents/reviewer/mental-simulation.md` thiết lập 6 kịch bản đối kháng S1–S6 bản địa hóa cho stack Vikini (Supabase RLS, NextAuth, Redis, SSE streaming) và Domain Open Inquiry viết lại cho AI Chat/Studio.
- [ ] **Bước 2.4**: Cập nhật `.agents/agents/reviewer/agent.md`:
  - Thêm `run_command` vào danh sách `tools`.
  - Thiết lập chuỗi đánh giá Bước 0 đến Bước 6 (Bước 0 nạp 3 file vệ tinh, Bước 2 completeness gate, Bước 6 output ma trận).
  - Bổ sung yêu cầu công bố model fallback.
  - Kiểm tra độ dài file `≤ 10,000` ký tự.

### Giai đoạn 3: Nâng Cấp Subagent `@qa` và `@planner`

- [ ] **Bước 3.1**: Cập nhật `.agents/agents/qa/agent.md`:
  - Thống nhất taxonomy lỗi thành `[BLOCKER]`, `[MAJOR]`, `[MINOR]`.
  - Bổ sung Bước 3: Verification Gate (fail-fast: dừng ngay và xuất `[QA_FAILED]` nếu verify thất bại).
  - Gộp trọn vẹn các tiêu chuẩn chất lượng đặc thù của Vikini vào Bước 4 (Deep Bug Hunting).
  - Bổ sung Bước 6: Test Integrity Audit (phân tích git diff test vs code, phân loại Type A/B/C).
  - Bổ sung mẫu báo cáo chuẩn hóa và allowlist lệnh `run_command`.
  - Kiểm tra độ dài file `≤ 10,000` ký tự.
- [ ] **Bước 3.2**: Cập nhật `.agents/agents/planner/agent.md`:
  - Thêm `replace_file_content` vào `tools`.
  - Bổ sung quy định mục Test Contract bắt buộc vào cấu trúc plan.
  - Nhận diện Circuit Breaker (dừng sau 3 vòng revision) và cơ chế `[NEEDS_PRODUCT_DECISION]`.
  - Kiểm tra độ dài file `≤ 10,000` ký tự.

### Giai đoạn 4: Cập Nhật Bộ Rules Quản Trị Cốt Lõi

- [ ] **Bước 4.1**: Cập nhật `.agents/rules/01-coding.md`:
  - Bổ sung Bảng Trạng Thái Cưỡng Chế (Enforcement Status table) phản ánh đúng 100% cấu hình linter/compiler Vikini.
  - Kiểm tra độ dài file `≤ 12,000` ký tự.
- [ ] **Bước 4.2**: Cập nhật `.agents/rules/02-quality.md`:
  - Bổ sung lưu ý PowerShell 5.1: CẤM nối lệnh bằng `&&`, bắt buộc dùng `;` khi chạy chuỗi lệnh thủ công trong terminal Windows.
  - Bổ sung quy chuẩn Governance-only changes (Frontmatter, GFM, link tương đối từ repo root, char limits).
  - Bổ sung Giao thức phân loại lỗi kiểm thử (Test Failure Triage Protocol) Loại A/B/C và điều khoản cấm nới test.
  - Tham chiếu các skills hiện có (`streaming-patterns.md`, `database-migration.md`, `api-patterns.md`) và phân định rõ với `workflows/audit.md`.
  - Kiểm tra độ dài file `≤ 12,000` ký tự.
- [ ] **Bước 4.3**: Cập nhật `.agents/rules/05-plan-review.md`:
  - Bổ sung quy tắc cưỡng chế Code Freeze Guard qua hook (máy hỏi fail-closed). Bổ sung ngoại lệ artifact ngoài repo `~/.gemini/antigravity/brain/` vào Mục 1.
  - Bổ sung chỉ dẫn Evidence Bar và Mental Simulation vệ tinh.
  - Bổ sung cơ chế dừng tự động và tổng hợp báo cáo sau vòng 3 của Circuit Breaker.
  - Bổ sung yêu cầu công bố model fallback.
  - Thống nhất taxonomy của `@qa`.
  - Đo thực tế độ dài file: `(Get-Content .agents/rules/05-plan-review.md -Raw).Length` để bảo đảm `≤ 12,000` ký tự.

### Giai đoạn 5: Cập Nhật Tài Liệu Hệ Thống & Kích Hoạt Hook

- [ ] **Bước 5.1**: Cập nhật `docs/architecture.md` (Section 7) phản ánh các cải tiến quản trị mới.
- [ ] **Bước 5.2**: Cập nhật `docs/CHANGELOG.md` ghi nhận toàn bộ các thay đổi governance của task.
- [ ] **Bước 5.3 (Kích hoạt Hook cuối cùng)**: Tạo file `.agents/hooks.json` kích hoạt hook `PreToolUse` cho `write_to_file|replace_file_content|run_command` gọi `node scripts/code-freeze-guard.js`. _(Thực hiện ở đây để không tự chặn các bước sửa governance trước đó)_.

### Giai đoạn 6: Thẩm Định Toàn Diện, Wiring Probe & Live Probe (R2)

- [ ] **Bước 6.1**: Chạy kiểm tra TypeScript: `npm run type-check`.
- [ ] **Bước 6.2**: Chạy kiểm tra Linter: `npm run lint`.
- [ ] **Bước 6.3**: Chạy kiểm tra Unit Tests: `npm run test:run` (xác nhận Vitest chạy cả test suite của guard lẫn app tests).
- [ ] **Bước 6.4**: Chạy tổng thể quality gate: `npm run verify`.
- [ ] **Bước 6.5**: Chạy Wiring Probe kiểm tra hook `code-freeze-guard.js` từ `.agents/` và Negative Probes.
- [ ] **Bước 6.6 (Live Probe sau khi kích hoạt Hook — An toàn tuyệt đối)**:
  - _Probe Write Blocked_: Thử gọi tool ghi vào một file giả định CHƯA TỒN TẠI: `src/__freeze_probe__.ts` -> Xác nhận hộp thoại yêu cầu người dùng xác nhận (`ask`) thực sự xuất hiện trên giao diện Antigravity. Người thử nghiệm **BẮT BUỘC BẤM DENY**. Chạy `git status` xác nhận file `src/__freeze_probe__.ts` KHÔNG hề được tạo ra.
  - _Probe Write Allowed_: Thử gọi tool ghi vào một file trong `docs/` (ví dụ `docs/plans/probe-test.md`) -> Xác nhận tool thực thi thành công ngay lập tức mà không hiện hộp thoại hỏi. Xóa file test sau khi thử nghiệm.
  - _Probe Command Allowed_: Chạy lệnh `git status` -> Thực thi ngay lập tức mà không bật hộp thoại.
  - _Probe Command Blocked_: Chạy lệnh `npm run lint -- --fix` -> Bắt buộc bật hộp thoại hỏi `ask`. Người thử nghiệm bấm **Deny**.

---

## 8. Test Contract (Hợp Đồng Kiểm Thử Cho Thay Đổi Hành Vi)

1. **Hành vi 1 (Code Freeze Enforcement)**: Thao tác gọi `write_to_file` hoặc `replace_file_content` vào file mã nguồn ứng dụng (`src/**`) LUÔN trả về `decision: ask` với reason chứa thông điệp `'Approve only if [PLAN_APPROVED] has been granted by @reviewer'`.
2. **Hành vi 2 (Unfrozen Surface & Antigravity Artifacts)**:
   - Thao tác ghi file vào `docs/**` BẮT BUỘC trả về `decision: allow`.
   - Thao tác ghi vào file artifact Antigravity ngoài repo (phải là đường dẫn tuyệt đối nằm trong `ARTIFACT_ROOT` với đuôi hợp lệ `.md`, `.json`, hoặc thư mục `scratch/*`) BẮT BUỘC trả về `decision: allow`.
3. **Hành vi 3 (Artifact Bypass Defense)**:
   - Đường dẫn tương đối trỏ ra artifact (kể cả có chứa `../../.gemini/...`) BẮT BUỘC trả về `decision: ask`.
   - Đường dẫn artifact chứa path traversal `..` thoát về repo root BẮT BUỘC trả về `decision: ask`.
   - Đường dẫn artifact giả lập nằm trong thư mục repo (`src/.gemini/antigravity/brain/...`) BẮT BUỘC trả về `decision: ask`.
   - File artifact ngoài repo có đuôi cấm/thực thi (`.exe`, `.dll`, `.bat`, `.cmd`, `.ps1`) BẮT BUỘC trả về `decision: ask`.
4. **Hành vi 4 (Priority: Test Infrastructure Guard)**: Thao tác ghi vào bất kỳ file nào trong danh sách `TEST_INFRA_FILES` của Vikini (`vitest.config.ts`, `eslint.config.mjs`, `package.json`, `.husky/pre-commit`, `.github/workflows/ci.yml`, `tests/setup.ts`, `playwright.config.ts`, `tsconfig.json`) BẮT BUỘC trả về `decision: ask` kèm thông điệp `Test Infrastructure Guard: this edit changes test configuration` (độ ưu tiên cao hơn `isTestFile`).
5. **Hành vi 5 (Test Integrity Guard)**: Thao tác chỉnh sửa file test (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `tests/**`) không thuộc infra làm giảm số lượng lệnh `expect()`, thêm `.skip`/`.only`/`.todo`/`xit`/`fit`/`.skipIf`/`.runIf`/`.fails`, hoặc nới lỏng matcher (`toEqual` -> `toBeDefined`) BẮT BUỘC trả về `decision: ask` kèm cờ báo động `Test Integrity Guard: this edit modifies a TEST file`.
6. **Hành vi 6 (Command Allowlist Enforcement)**: Lệnh `run_command` chứa cờ mutating (`--fix`, `--write`, `-i`), ký tự chuyển hướng (`>`, `>>`, `tee`), hoặc chuỗi lệnh nguy hiểm BẮT BUỘC bị chặn (`decision: ask`).
7. **Hành vi 7 (PowerShell 5.1 Semicolon Chain)**: Chuỗi lệnh nối bằng dấu chấm phẩy (`;`) BẮT BUỘC được cho phép (`decision: allow`) nếu và chỉ nếu MỌI phân đoạn trong chuỗi đều là lệnh read-only hợp lệ trong allowlist.
8. **Hành vi 8 (Reviewer Evidence Bar Gate)**: `@reviewer` BẮT BUỘC từ chối cấp thẻ `[PLAN_APPROVED]` (trả về `[CHANGES_REQUESTED]`) nếu bất kỳ kịch bản nào từ S1 đến S5 bị đánh dấu là `UNVERIFIED` hoặc thiếu bằng chứng xác thực (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`).
9. **Hành vi 9 (QA Verification Gate)**: `@qa` BẮT BUỘC xuất ngay kết luận `[QA_FAILED]` ở Bước 3 nếu `type-check`, `lint` hoặc `test:run` thất bại, và KHÔNG được tiếp tục phân tích mã nguồn.

---

## 9. Kế Hoạch Kiểm Thử & Nghiệm Thu (Verification Plan)

### 9.1 Lệnh Kiểm Thử Tự Động

```powershell
# 1. Chạy riêng test suite cho Code Freeze Guard
npx vitest run .agents/scripts/code-freeze-guard.test.ts

# 2. Chạy toàn bộ Verification Suite của dự án (PowerShell 5.1 compliant)
npm run type-check; npm run lint; npm run test:run

# 3. Chạy qua script verify tổng hợp (npm gọi qua cmd.exe nên chuỗi && chạy bình thường)
npm run verify
```

### 9.2 Wiring Probe Thực Tế (Kiểm tra Hook từ `.agents/`)

Mô phỏng chính xác cách Antigravity kích hoạt hook với `cwd = .agents/`:
_(Lưu ý: Do lệnh chứa pipe `|`, khi hook đã kích hoạt nó sẽ bị guard hỏi `ask`. Người thử nghiệm phê duyệt hộp thoại trên UI để kiểm tra kết quả)_

```powershell
cd .agents
'{"toolCall":{"name":"write_to_file","args":{"TargetFile":"src/app/page.tsx","CodeContent":"console.log(1);"}}}' | node scripts/code-freeze-guard.js
# Kỳ vọng output stdout chứa chuỗi con: '"decision":"ask"' và 'Code Freeze Guard' (không phụ thuộc ký tự emoji để tránh lỗi encoding PowerShell 5.1)
cd ..
```

### 9.3 Negative Probes Thủ Công (Kiểm tra phản xạ của Guard)

_(Lưu ý: Node 24 hỗ trợ `--input-type=module` khi chạy inline code ESM)_

- **Probe 1 (Chặn ghi source code)**:
  ```powershell
  node --input-type=module -e "import { decide } from './.agents/scripts/code-freeze-guard.js'; console.log(decide({ targetFile: 'src/lib/core/supabase.ts' }));"
  # Kỳ vọng: { decision: 'ask', reason: '...Code Freeze Guard: write targets a frozen path...' }
  ```
- **Probe 2 (Cho phép ghi plan)**:
  ```powershell
  node --input-type=module -e "import { decide } from './.agents/scripts/code-freeze-guard.js'; console.log(decide({ targetFile: 'docs/plans/test.md' }));"
  # Kỳ vọng: { decision: 'allow' }
  ```
- **Probe 3 (Cho phép ghi artifact Antigravity đường dẫn tuyệt đối)**:
  ```powershell
  node --input-type=module -e "import { decide } from './.agents/scripts/code-freeze-guard.js'; import os from 'node:os'; import path from 'node:path'; const p = path.resolve(os.homedir(), '.gemini/antigravity/brain/test-conv/implementation_plan.md'); console.log(decide({ targetFile: p }));"
  # Kỳ vọng: { decision: 'allow' }
  ```
- **Probe 4 (Chặn bypass artifact giả lập trong repo)**:
  ```powershell
  node --input-type=module -e "import { decide } from './.agents/scripts/code-freeze-guard.js'; console.log(decide({ targetFile: 'src/.gemini/antigravity/brain/evil.json' }));"
  # Kỳ vọng: { decision: 'ask' }
  ```
- **Probe 5 (Chặn đường dẫn tương đối trỏ ra artifact)**:
  ```powershell
  node --input-type=module -e "import { decide } from './.agents/scripts/code-freeze-guard.js'; console.log(decide({ targetFile: '../../.gemini/antigravity/brain/test/plan.md' }));"
  # Kỳ vọng: { decision: 'ask' }
  ```
- **Probe 6 (Chặn lệnh nguy hiểm)**:
  ```powershell
  node --input-type=module -e "import { decide } from './.agents/scripts/code-freeze-guard.js'; console.log(decide({ command: 'npm run lint --fix' }));"
  # Kỳ vọng: { decision: 'ask', reason: '...mutating flag...' }
  ```
- **Probe 7 (Cho phép chuỗi PowerShell hợp lệ)**:
  ```powershell
  node --input-type=module -e "import { decide } from './.agents/scripts/code-freeze-guard.js'; console.log(decide({ command: 'npm run type-check; npm run lint; npm run test:run' }));"
  # Kỳ vọng: { decision: 'allow' }
  ```

### 9.4 Kiểm Tra Quy Chuẩn Governance

- Kiểm tra tính hợp lệ của Frontmatter YAML trên tất cả file rule và agent.
- Kiểm tra số lượng ký tự:
  - Mọi file rule (`.agents/rules/*.md`) BẮT BUỘC `≤ 12,000` ký tự.
  - Mọi file chỉ dẫn agent (`.agents/agents/*/agent.md`) BẮT BUỘC `≤ 10,000` ký tự.
- Kiểm tra đường dẫn liên kết chéo: Mọi đường dẫn nội bộ phải viết tương đối từ repo root.

---

## 10. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risks & Mitigations)

| Rủi Ro Tiềm Ẩn                                                                                          | Mức Độ     | Phương Án Phòng Ngừa & Kiểm Soát Kỹ Thuật                                                                                                                                                                                                                                                                                      |
| :------------------------------------------------------------------------------------------------------ | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lỗ hổng bypass artifact qua path traversal, relative path hoặc path trong repo**                      | Cao        | Áp dụng cơ chế xác thực nghiêm ngặt: (1) Bắt buộc là đường dẫn tuyệt đối `path.isAbsolute`, (2) `toRepoRelative === null`, (3) `path.relative(ARTIFACT_ROOT, targetAbsolute)` không chứa `..`, (4) Kiểm tra đuôi file an toàn `.md`, `.json`, hoặc `scratch/*` với đuôi hợp lệ. Viết test bao phủ toàn bộ các vector tấn công. |
| **Xung đột ưu tiên giữa `TEST_INFRA_FILES` và `isTestFile`**                                            | Cao        | Trong hàm `decide()`, đặt kiểm tra `TEST_INFRA_FILES` ở vị trí ưu tiên cao hơn `isTestFile`. File `tests/setup.ts` luôn được gán đúng nhãn Test Infrastructure Guard.                                                                                                                                                          |
| **Xung đột module ESM trong script hook** do root `package.json` của Vikini không có `"type": "module"` | Cao        | Tạo file độc lập `.agents/scripts/package.json` chứa `{"type": "module"}`. Giúp Node CLI chạy `code-freeze-guard.js` dưới dạng native ESM siêu tốc mà không ảnh hưởng tới cấu trúc module của dự án Next.js chính.                                                                                                             |
| **`tsc --noEmit` bỏ qua typecheck hoặc báo lỗi trong `code-freeze-guard.js`**                           | Cao        | Thêm directive `// @ts-check` ở dòng 1 của script để kích hoạt typecheck cấp file. Chuẩn hóa 100% chú giải JSDoc strict mode (sửa 4 lỗi TS đã ghi nhận trong Bước 1.2). Đặt bước chạy `npm run type-check` ngay sau khi tạo script.                                                                                            |
| **Hook tự chặn các bước tạo file governance trong `.agents/`**                                          | Cao        | Chuyển bước tạo `.agents/hooks.json` xuống Bước 5.3 cuối cùng (sau khi đã hoàn thành toàn bộ file vệ tinh và rules). Hook chỉ được kích hoạt sau khi cấu trúc governance đã hoàn thiện.                                                                                                                                        |
| **Working tree bị nhiễu làm sai lệch Test Integrity Audit của `@qa`**                                   | Cao        | Thiết lập Bước 0 thành Cổng Chặn Cứng (Hard Gate): Ngoại trừ file plan và `tsconfig.tsbuildinfo`, nếu `git status` còn file uncommitted, bắt buộc dừng quy trình để User commit hoặc dọn dẹp trước khi bắt đầu.                                                                                                                |
| **Lỗi cú pháp terminal Windows khi chạy chuỗi lệnh `&&`**                                               | Trung bình | Ghi rõ chỉ dẫn trong `rules/02-quality.md`: Terminal Windows mặc định là PowerShell 5.1, bắt buộc dùng dấu `;` thay cho `&&` khi chạy thủ công. Script `"verify"` trong `package.json` vẫn giữ `&&` an toàn vì npm chạy lệnh qua `cmd.exe`. Script guard hỗ trợ phân tích chuỗi lệnh `;` để cho phép chạy hợp lệ.              |
| **Giả định `cwd = .agents/` không đúng trên một số môi trường runtime**                                 | Trung bình | Ghi nhận rõ tính chất giả định thực nghiệm. Bổ sung Bước 6.6 Live Probe an toàn (dùng `src/__freeze_probe__.ts`) để kiểm tra trực tiếp phản xạ của hook trên UI Antigravity trước khi bàn giao.                                                                                                                                |
| **Lách kiểm tra đường dẫn bằng Directory Junction hoặc Symlink**                                        | Thấp       | Rủi ro tạo junction/symlink là cực thấp vì để tạo junction/symlink cần thực thi lệnh shell hệ thống (`mklink`, `New-Item -ItemType Junction`), vốn đã bị chốt chặn `run_command` của `code-freeze-guard.js` chặn và yêu cầu User phê duyệt thủ công (`ask`).                                                                   |
| **Claude Opus bị nghẽn quota hoặc rate limit (HTTP 429)**                                               | Trung bình | Tự động kích hoạt cơ chế Fallback sang `gemini-3.8-flash` với thinking budget high/max. Bắt buộc hiển thị nhãn cảnh báo `[FALLBACK_MODEL]` trong báo cáo để bảo đảm tính minh bạch.                                                                                                                                            |
| **Giảm tính đa dạng phản biện khi `@reviewer` fallback sang cùng họ model với `@planner`**              | Trung bình | Ghi nhận rõ rủi ro này trong `05-plan-review.md`. Yêu cầu khi fallback sang `gemini-3.8-flash`, reviewer phải chạy ở mức thinking budget tối đa (High/Max) và tuân thủ nghiêm ngặt 100% Evidence Bar (`evidence-bar.md`) để bù đắp khác biệt mô hình.                                                                          |
| **Vòng lặp revision vô tận giữa `@planner` và `@reviewer`**                                             | Thấp       | Thiết lập Circuit Breaker tại `rules/05-plan-review.md`: Sau 3 vòng lặp nếu vẫn chưa đạt `[PLAN_APPROVED]`, Orchestrator bắt buộc dừng chuỗi và trình báo cáo lên User (PM) quyết định.                                                                                                                                        |
