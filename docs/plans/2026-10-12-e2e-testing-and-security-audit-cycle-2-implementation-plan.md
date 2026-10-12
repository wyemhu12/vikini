# Kế Hoạch Triển Khai: Đợt Audit Mới (Chu Kỳ 2) & Tự Động Hóa E2E Testing (Playwright)

> **Mã Tài Liệu**: `docs/plans/2026-10-12-e2e-testing-and-security-audit-cycle-2-implementation-plan.md`  
> **Ngày Lập**: 12/10/2026  
> **Phiên Bản (Revision)**: 8 (Cập nhật xử lý triệt để 100% phản hồi từ Audit Run 8 của Lead Reviewer: 0 BLOCKER, 1 MAJOR M19, 2 MINOR m32-m33; fixture sample message SVG cho Image Studio & floating-promises lint fix)  
> **Trạng Thái**: Approved (Phê duyệt bởi Lead Reviewer Claude Code CLI - Audit Run 9)  
> **Tác Giả**: Technical Planner (Vikini Antigravity)  
> **Tài Liệu Căn Cứ**: [`docs/audit-report-2026-10-01.md`](../audit-report-2026-10-01.md), [`docs/database-schema.md`](../database-schema.md), [`docs/contracts.md`](../contracts.md), [`docs/security.md`](../security.md), [`.agents/rules/00-core.md`](../../.agents/rules/00-core.md), [`.agents/rules/01-coding.md`](../../.agents/rules/01-coding.md), [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md), [`.agents/rules/05-plan-review.md`](../../.agents/rules/05-plan-review.md), [`.agents/skills/streaming-patterns.md`](../../.agents/skills/streaming-patterns.md), [`.agents/skills/database-migration.md`](../../.agents/skills/database-migration.md)

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Tiến hành Đợt Audit Toàn Diện Chu Kỳ 2 (Cycle 2 Audit) và thiết lập hoàn chỉnh Hạ tầng Kiểm thử Tự động Hóa Đầu-Cuối (End-to-End E2E Testing) với Playwright cho toàn bộ nền tảng Vikini. Kế hoạch Revision 8 kế thừa toàn bộ các kết quả đã được Lead Reviewer (Claude Code CLI Audit Run 8) kiểm chứng thực tế độc lập (0 BLOCKER, M18 đã được verify và pass 100% với `npm run type-check` exit 0, m29–m31 đã khắc phục hoàn hảo). Kế hoạch Revision 8 tập trung giải quyết dứt điểm 1 MAJOR (M19) và 2 MINOR (m32, m33):

1. **Khắc Phục Nguồn Dữ Liệu Ảnh SVG Cho Canvas Image Studio (M19)**:
   - **Cơ chế hoạt động thực tế**: Trong `src/app/features/image-gen/components/hooks/useImageGenStudio.ts:113-142`, Canvas lấy danh sách ảnh hiển thị (`generatedImages`) trực tiếp từ mảng `messages` của hook `useConversation` (thông qua bộ lọc `role === "assistant" && msg.meta?.imageUrl`). Sau khi `POST /api/generate-image` thành công, client gọi `loadConversation(targetId)` (`:361`) để nạp tin nhắn qua endpoint `GET /api/conversations*?id=...`.
   - **Mở Rộng Chữ Ký `setupMockChat`**: Bổ sung tham số `messages?: FrontendMessage[]` (mặc định `[]`) với kiểu nhập chỉ-kiểu `import type { FrontendMessage } from "@/app/features/chat/hooks/useConversation"`. Khi nhận request `GET **/api/conversations*?id=...`, handler trả về `{ id: convId, title: "New Conversation", messages }`.
   - **Export Fixture Message Ảnh SVG Trong `mock-image-gen.ts`**: Khai báo và export hằng số `SAMPLE_IMAGE_SVG` (data URI SVG) cùng `SAMPLE_IMAGE_MESSAGE: FrontendMessage` chứa trường `meta: { imageUrl: SAMPLE_IMAGE_SVG, prompt: "Cyberpunk city neon", originalOptions: { model: "gemini-3.1-flash-image", aspectRatio: "1:1" } }`.
   - **Truyền Fixture Vào Chặng 4 & Assert Tất Định**: Chặng 4 gọi `setupMockChat(page, { conversationId: "conv-image-123", messages: [SAMPLE_IMAGE_MESSAGE] })`, bảo đảm Canvas nạp thành công ảnh và assert `await expect(page.locator('img[src^="data:image/svg+xml"]')).toBeVisible()` đạt kết quả xanh tất định.

2. **Khắc Phục Cảnh Báo Floating Promises Trong ESLint (m32)**:
   - Toàn bộ các helper Playwright trong `tests/e2e/**` nằm trong phạm vi quét của `eslint.config.mjs` với quy tắc `@typescript-eslint/no-floating-promises: "error"`.
   - Bổ sung tường minh từ khóa `return` hoặc `await` cho toàn bộ các lời gọi `route.fulfill(...)` và `route.fallback()` trong thân hàm handler async của `page.route`. Loại bỏ 100% nguy cơ lỗi linting tại Cổng 2 và Bước 20.

3. **Chuẩn Hóa Thứ Tự Thực Thi Trong TC-E2E-04 (m33)**:
   - Điều chỉnh thứ tự các bước trong kịch bản kiểm thử Image Studio: Ngay sau khi điều hướng tới `/images`, thực hiện ngay bước hủy route cũ và đăng ký route hội thoại mới:
     ```ts
     await page.unroute("**/api/conversations*");
     await setupMockChat(page, {
       conversationId: "conv-image-123",
       messages: [SAMPLE_IMAGE_MESSAGE],
     });
     ```
     **TRƯỚC KHI** thực hiện gõ prompt và click nút "Tạo ảnh", bảo đảm khi người dùng click tạo ảnh, request `POST /api/conversations*` được đón đúng bởi handler `conv-image-123`.

4. **Bảo Toàn Các Kết Quả Đã Được Xác Minh (Runs 1–8)**:
   - Bảo toàn devDependency `"postcss": "^8.5.23"` kết hợp override `"postcss": "$postcss"` (M16).
   - Bảo toàn lệnh `npm update postcss sharp ws source-map-js minimatch brace-expansion nanoid` và gate `npm audit --omit=dev --audit-level=high` exit code 0 tuyệt đối (M15).
   - Bảo toàn import chuẩn `import type { Conversation } from "@/lib/features/chat/conversations"` và thuộc tính camelCase `createdAt` / `updatedAt` (M18).
   - Bảo toàn import chuẩn `import type { BatchQuotaInfo } from "@/app/features/image-gen/components/ControlPanel"` (m29).
   - Bảo toàn assertion URL: `await expect(page).toHaveURL(/[?&]id=conv-e2e-123/)` (m30).
   - Bảo toàn khóa 4 RPC SECURITY DEFINER, deny RLS và di dời file rollback ra ngoài `supabase/migrations/` (B4, B5, M12).

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ nghiêm ngặt Giao thức Pre-Work trong [`.agents/rules/02-quality.md`](../../.agents/rules/02-quality.md):

| Miền Nghiệp Vụ (Domain)   | Tài Liệu Bắt Buộc Đọc                                                                       | Mục Tiêu Kỹ Thuật Áp Dụng                                                                                                                                                                                                                                                          |
| :------------------------ | :------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E2E & Mocking**         | `docs/contracts.md`, `.agents/skills/streaming-patterns.md`                                 | Định dạng khung SSE Wire format thực tế (`event: token`, `data: {"t": "..."}`, `event: thinking`, `data: {"thinking": "..."}`), contracts cho Messages, Conversations (`data.conversation` với `createdAt`/`updatedAt`), FrontendMessage fixture cho Image Studio Canvas, Projects |
| **Auth & Security**       | `docs/security.md`, `src/lib/features/auth/auth.ts`, `src/lib/env.ts`                       | Cơ chế xác thực NextAuth v5 + Supabase RLS + Upstash Redis, client session mocking (null vs truthy), dummy envs setup, dummy anon key                                                                                                                                              |
| **Database & Schema**     | `docs/database-schema.md`, `.agents/skills/database-migration.md`                           | Lược đồ 16 tables Supabase, khóa RPC SECURITY DEFINER, extension pgvector search_path, quy trình di dời file rollback                                                                                                                                                              |
| **Code Quality & Freeze** | `.agents/rules/00-core.md`, `.agents/rules/01-coding.md`, `.agents/rules/05-plan-review.md` | Cấm sửa code trước approval, quy tắc cấm `any`, cấu trúc 2 phân khu, bảo toàn Audit History                                                                                                                                                                                        |
| **Audit Protocol**        | `docs/audit-report-2026-10-01.md`, `.agents/workflows/audit.md`                             | Đối chiếu kết quả Chu kỳ 1 (SEC-01 -> SEC-06, ADM-01 -> ADM-03, STR-01 -> STR-03) để rà soát Chu kỳ 2                                                                                                                                                                              |
| **Mental Simulation**     | `.agents/agents/reviewer/mental-simulation.md`                                              | 6 kịch bản đối kháng S1–S6 (Cold-start, Lifecycle, Database, State, Security, External Resilience)                                                                                                                                                                                 |

---

### 3. Assumptions & Cross-Task Dependencies

1. **Môi Trường Runtime & Dependencies**:
   - Dự án vận hành trên **Next.js 16 (App Router)** và **React 19** trên nền **Node.js 24.x** (m27).
   - CSDL: Supabase PostgreSQL (truy cập server-side qua `getSupabaseAdmin()` sử dụng Service Role Key).
   - Xác thực: NextAuth v5 (`5.0.0-beta.32` kéo theo `@auth/core@0.41.3`). Phiên đăng nhập trên browser được quản lý qua NextAuth Session Provider (`GET /api/auth/session`).
   - Thư viện E2E: `@playwright/test` (`^1.62.1`), gỡ bỏ gói phụ thuộc trùng lặp `playwright`, bổ sung `"tsx": "^4.19.3"` vào `devDependencies` để chạy scripts TypeScript cục bộ (M12).
2. **Nguyên Tắc Test Isolation & Cổng 3100 Độc Lập (M3, M14, m7, m19)**:
   - Toàn bộ E2E tests trong `tests/e2e/` phải chạy độc lập, 100% deterministic, không gọi trực tiếp các API bên ngoài.
   - Cấu hình hằng số `E2E_BASE_URL = "http://127.0.0.1:3100"` dùng chung cho cả `use.baseURL` và `webServer.url` trong `playwright.config.ts`, không phụ thuộc `process.env.PORT` của máy host (M14).
   - Cơ chế Fail-Closed Network Guard: Chặn toàn bộ network calls bằng catch-all route `**/api/**` trả về HTTP 501 nếu chưa được mock; assert `unhandledRequests == []` trong khối teardown của fixture (m17).
   - Cấu hình `webServer.env` trỏ biến môi trường DB/Redis tới dummy endpoints, ghi đè `AUTH_URL`/`NEXTAUTH_URL` và đặt rỗng provider keys, chạy trên cổng riêng `3100` tạo lớp phòng thủ đa lớp (defense-in-depth), bảo đảm không làm ô nhiễm DB/Redis live (m19).
3. **Cross-Task Compatibility & Baseline Pre-condition (m28)**:
   - **Baseline Pre-condition (m28)**: Đảm bảo working tree đạt `npm run verify` (Type-check, Lint, Test) xanh 100% (112 test files / 1178 tests passed) trước khi thực hiện Giai Đoạn A.
   - Bắt buộc giữ nguyên thư viện `recharts` để bảo toàn chức năng vẽ biểu đồ tại `ChartTool.tsx` và `BubbleMarkdown.tsx` (B1).

---

### 4. Bảng Verified Versions (Năm 2026)

_Được tra cứu và xác thực trực tuyến theo chuẩn công nghệ quý 4/2026 và đã được Lead Reviewer kiểm chứng độc lập (Runs 7–8):_

| Gói Thư Viện (Package)      | Phiên Bản Hiện Tại (`npm ls`) | Phiên Bản Mục Tiêu 2026                  | Đánh Giá Tính Tương Thích & Ghi Chú                                                                     |
| :-------------------------- | :---------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **`next`**                  | `^16.1.1` (cài `16.1.4`)      | `^16.4.0` (tối thiểu `>=16.3.8`)         | Vá 2 Critical CVEs (`GHSA-p293-qw3h-jr36`, `GHSA-2xp9-vwfh-vxw4`) và các advisory High (B2).            |
| **`eslint-config-next`**    | `^16.1.1`                     | `^16.4.0`                                | Nâng cấp đồng bộ với `next@16.4.0` (m10).                                                               |
| **`react` / `react-dom`**   | `^19.2.3`                     | `^19.2.3`                                | Chuẩn React 19 stable (Actions, Server Components).                                                     |
| **`next-auth`**             | `^5.0.0-beta.30`              | `^5.0.0-beta.32`                         | Kéo theo `@auth/core@0.41.3` vá 2 Critical CVEs (`GHSA-8fpg-xm3f-6cx3`, `GHSA-7rqj-j65f-68wh`) (B2).    |
| **`protobufjs`**            | `7.5.4` (từ `@google/genai`)  | `^7.6.5` (overrides)                     | Vá Critical CVE `GHSA-xq3m-2v4x-88gg` qua `package.json overrides` (gộp với uuid - m16).                |
| **`@playwright/test`**      | `^1.62.1`                     | `^1.62.1`                                | Thư viện chính thức cho E2E, gỡ bỏ gói phụ thuộc trùng lặp `playwright` (m4).                           |
| **`tsx`**                   | _Chưa cài_                    | `^4.19.3`                                | Thêm vào `devDependencies` để thực thi negative probe và scripts an toàn (M12).                         |
| **`@next/bundle-analyzer`** | `^16.3.3`                     | `^16.3.3`                                | Cần cờ `--webpack` khi chạy `next build` trên Next.js 16 do mặc định Turbopack.                         |
| **`@supabase/supabase-js`** | `^2.91.0` (cài `2.91.0`)      | `^2.91.0`                                | Cập nhật số liệu thực tế (m22). Hỗ trợ PostgREST v14.5, Auth helpers, vector embeddings `VECTOR(3072)`. |
| **`recharts`**              | `^3.6.0`                      | `^3.6.0`                                 | **GIỮ LẠI BẮT BUỘC** cho `ChartTool.tsx` và `BubbleMarkdown.tsx:40,81` (B1).                            |
| **`pg`**                    | `^8.16.3`                     | **[DELETE]**                             | Gỡ bỏ hoàn toàn khỏi production dependencies vì không dùng trong codebase (B1).                         |
| **`vitest`**                | `^4.0.16` (cài `4.0.17`)      | `^4.1.11`                                | Cập nhật lên `>=4.1.11` để vá lỗ hổng Critical GHSA-5xrq-8626-4rwp (B2).                                |
| **`ws`**                    | `8.19.0` (cài `8.19.0`)       | `^8.21.0` (overrides)                    | Vá lỗ hổng DoS High qua overrides (M15).                                                                |
| **`postcss`**               | `8.5.6` (devDep)              | devDep `^8.5.23` & override `"$postcss"` | **Tránh lỗi EOVERRIDE** (M16). Nâng trực tiếp devDep và trỏ override `"$postcss"`.                      |
| **`nanoid`**                | `3.3.11` (từ postcss)         | `>=3.3.18` (resolve `3.3.20`)            | Cập nhật mục tiêu an toàn (m26). `postcss@8.5.23` kéo `nanoid@3.3.20`.                                  |
| **`sharp`**                 | `0.34.5` (từ next)            | `^0.35.5` (overrides)                    | Next 16.4 khai `^0.35.4` nhưng cần `>=0.35.5` để vá advisory (M15).                                     |
| **`source-map-js`**         | `1.2.1` (từ postcss)          | `^1.2.2` (overrides)                     | Vá lỗ hổng High qua overrides (M15).                                                                    |
| **`minimatch`**             | `3.1.2` / `9.0.5`             | `3.1.5` / `9.0.9` (in-major update)      | Nâng cấp bằng `npm update minimatch`, không dùng overrides tránh ép major (M15).                        |
| **`brace-expansion`**       | `1.1.12` / `2.0.2`            | `1.1.21` / `2.1.7` (in-major update)     | Nâng cấp bằng `npm update brace-expansion`, không dùng overrides tránh ép major (M15).                  |

> **Rủi Ro Được Chấp Nhận Còn Lại (Accepted Remaining Risks - m10, M15)**:
>
> 1. _ESLint Dev Toolchain_: Một số advisory moderate/low trong các dev plugins cũ của eslint được chấp nhận vì chỉ chạy trong môi trường phát triển cục bộ và không đóng gói vào production bundle.
> 2. _`mammoth` -> `argparse` / `sprintf-js`_: Giữ nguyên `mammoth@^1.8.0` phục vụ đọc file docx, chấp nhận advisory gián tiếp này để ngăn chặn triệt để hành vi phá hủy của `npm audit fix --force` (vốn ép hạ cấp mammoth xuống bản cổ `0.3.29`).
>    _(Lưu ý: Không còn bất kỳ rủi ro High nào cần chấp nhận; toàn bộ 7 advisory High đều được vá dứt điểm 100% - M15)._

---

### 5. Files Cần Chỉnh Sửa / Tạo Mới

```
[NEW]
- tests/e2e/helpers/network-guard.ts                                                   # [NEW] Network Isolation Guard & Discovery Probe (Record Mode) (M3, M9)
- tests/e2e/helpers/mock-session.ts                                                    # [NEW] Mock client session (/api/auth/session) authed & unauthed null (M4, M7, M9, m18)
- tests/e2e/helpers/mock-chat.ts                                                       # [NEW] Mock handler duy nhất luồng hội thoại: POST/GET **/api/conversations* với payload data.conversation (createdAt/updatedAt), hỗ trợ options.messages cho Image Studio, POST /api/messages (M9, M17, M18, M19, m23, m24, m32)
- tests/e2e/helpers/mock-ai-stream.ts                                                  # [NEW] In-browser streaming mock qua window.fetch hook, early abort check & AbortError (M1, M2, M13, m16)
- tests/e2e/helpers/mock-image-gen.ts                                                  # [NEW] Mock Image Studio: generate-image, prompt-suggest, BatchQuotaInfo từ ControlPanel & export SAMPLE_IMAGE_MESSAGE SVG fixture (M5, M9, M19, m8, m24, m29)
- tests/e2e/helpers/mock-projects.ts                                                   # [NEW] Mock typed payloads cho /api/projects CRUD khớp ProjectLimits (M6, M10, m16)
- tests/e2e/fixtures/test-fixtures.ts                                                  # [NEW] Playwright custom test fixture đóng gói authedPage, network-guard & teardown unhandled check (m17)
- tests/e2e/auth-flow.spec.ts                                                          # [NEW] E2E test: UI Login Warm Noir, i18n VI/EN, Google Sign-in redirect (@online tag) (M4, M10, M11, m14, m18)
- tests/e2e/user-journey.spec.ts                                                       # [NEW] E2E test: Full User Journey 5 chặng với assert toHaveURL(/[?&]id=conv-e2e-123/), Canvas SVG visibility & page.unroute (M9, M13, M17, M18, M19, m30, m31, m33)
- supabase/migrations/20261012000000_rls_security_audit_cycle_2.sql                      # [NEW] Migration khóa 4 RPC SECURITY DEFINER, deny RLS & drop personas policies (B4, m9, m15)
- database-migrations/rollback/20261012000000_rollback_rls_security_audit_cycle_2.sql # [NEW] Script rollback di dời ra ngoài supabase/migrations/ tránh auto-apply (B5)
- scripts/introspect-rls.sql                                                           # [NEW] SQL query introspection chạy trên Supabase SQL Editor / CLI (M12, m15)
- scripts/verify-rls-negative-probe.ts                                                 # [NEW] PostgREST negative probe kiểm tra SQLSTATE 42501 với 4 RPCs thực tế và vector 3072 chiều (M12, m20, m25)
- docs/audit-report-2026-10-12-cycle-2.md                                              # [NEW] Báo cáo Audit Chu kỳ 2 chi tiết (Dependencies, Bundle, RLS, E2E)

[MODIFY]
- package.json                                                                         # [MODIFY] Nâng devDep postcss ^8.5.23, thêm tsx, gộp overrides uuid, protobufjs, sharp, ws, source-map-js, postcss: "$postcss"; bump next, next-auth, vitest (B1, B2, M12, M15, M16)
- env.local.example                                                                    # [MODIFY] Khai báo NEXT_PUBLIC_SUPABASE_ANON_KEY mẫu cho probe (M12)
- playwright.config.ts                                                                 # [MODIFY] E2E_BASE_URL="http://127.0.0.1:3100", command CI build & start, dummy envs gồm AUTH_URL/provider keys (M14, m13, m14, m19, m21)
- src/app/features/chat/components/ChatApp.tsx                                         # [MODIFY] Dynamic imports + conditional mount cho CommandPalette/KeyboardShortcuts (m1, m11)
- src/components/features/projects/CreateProjectModal.tsx                               # [MODIFY] Sửa bug i18n production: t("createProject") -> t("createProjectBtn") (M10)
- src/lib/store/projectStore.ts                                                        # [MODIFY] Export interface ProjectLimits cho E2E typed fixtures (M10)
- docs/contracts.md                                                                    # [MODIFY] Cập nhật SSE Chat Stream wire format living doc & conversation/message payload contract (M1, M17, M18, M19, m23)
- docs/database-schema.md                                                              # [MODIFY] Cập nhật mục 3 (RLS) phản ánh đầy đủ 16 bảng & khóa 4 RPC sau Chu kỳ 2 (B4, M8)
- docs/security.md                                                                     # [MODIFY] Cập nhật bảng kiểm soát truy cập RLS, RPC Security Definer hardening & anon key doc (M12, m10)
- docs/CHANGELOG.md                                                                    # [MODIFY] Ghi nhận các nâng cấp bảo mật và hạ tầng E2E của Chu kỳ 2 (m10)
```

---

### 6. Các Bước Thực Hiện Tuần Tự

#### Giai Đoạn A: Security & Dependency Remediation (Khắc phục Lỗ hổng & Nợ Kỹ Thuật)

- [ ] **Bước 1 (B1)**: Cập nhật `package.json` để loại bỏ dead dependency `pg`, **BẢO TOÀN `recharts`**:
  - Gỡ bỏ `"pg": "^8.16.3"`.
  - Giữ nguyên `"recharts": "^3.6.0"` phục vụ `ChartTool.tsx` và `BubbleMarkdown.tsx:40,81`.
- [ ] **Bước 2 (B2, M15, M16, m4, m10, M12, m16, m22, m26)**: Khắc phục triệt để các lỗ hổng bảo mật Runtime Production và Test Tooling:
  - Cập nhật `"next": "^16.4.0"` (vá 2 CVEs Critical và các lỗi High).
  - Cập nhật `"eslint-config-next": "^16.4.0"` đồng bộ với `next`.
  - Cập nhật `"next-auth": "^5.0.0-beta.32"` (kéo theo `@auth/core@0.41.3`, vá 2 CVEs Critical).
  - Cập nhật trực tiếp trong `devDependencies`: `"postcss": "^8.5.23"` (M16).
  - **Gộp cấu hình `overrides` trong `package.json` với tham chiếu an toàn tránh `EOVERRIDE`** (M16):
    ```json
    "overrides": {
      "uuid": "^11.1.1",
      "protobufjs": "^7.6.5",
      "sharp": "^0.35.5",
      "ws": "^8.21.0",
      "source-map-js": "^1.2.2",
      "postcss": "$postcss"
    }
    ```
  - Cập nhật `"vitest": "^4.1.11"`, `"@vitest/ui": "^4.1.11"`, `"@vitest/coverage-v8": "^4.1.11"` (vá CVE Critical GHSA-5xrq-8626-4rwp).
  - Gỡ bỏ gói trùng lặp `"playwright": "^1.61.1"` khỏi `devDependencies` (m4).
  - Bổ sung `"tsx": "^4.19.3"` vào `devDependencies` để thực thi negative probe không cần tải từ mạng (M12).
  - **CẤM TUYỆT ĐỐI `npm audit fix --force` và CẤM TUYỆT ĐỐI `npm audit fix --omit=dev`** (lệnh này sẽ xóa sạch toàn bộ devDependencies!).
  - Thực thi cập nhật lockfile an toàn:
    ```bash
    npm update postcss sharp ws source-map-js minimatch brace-expansion nanoid
    npm install
    ```
  - Chạy kiểm tra gate:
    ```bash
    npm audit --omit=dev --audit-level=high
    ```
    _(Bắt buộc exit code 0 tuyệt đối 100%, không còn bất kỳ lỗi High hay Critical nào trong production dependencies - M15)._
- [ ] **Bước 3 (B2, m5)**: Cập nhật scripts trong `package.json`:
  - `"analyze": "cross-env ANALYZE=true next build --webpack"` (kích hoạt Webpack analyzer trên Next.js 16).
  - `"test:e2e": "playwright test"`
  - `"test:e2e:ui": "playwright test --ui"`
  - `"test:e2e:debug": "playwright test --debug"`
  - `"test:e2e:report": "playwright show-report"`
- [ ] **Bước 4 (M10)**: Sửa bug giao diện và chuẩn hóa TypeScript types:
  - Sửa `src/components/features/projects/CreateProjectModal.tsx:227`: Đổi `{t("createProject")}` thành `{t("createProjectBtn")}` để nút hiển thị đúng văn bản "Tạo dự án" / "Create Project".
  - Sửa `src/lib/store/projectStore.ts:8`: Thêm từ khóa `export` cho `export interface ProjectLimits`.
- [ ] **Bước 5 (m1, m11)**: Tối ưu Bundle Size trong `src/app/features/chat/components/ChatApp.tsx`:
  - Đo lường First Load JS baseline bằng `npm run analyze`.
  - Áp dụng `React.lazy` / `dynamic` kết hợp `Suspense` cho các heavy panels: `ChatDeepResearch`, `ResearchReportPanel`, `ResearchThinkingPanel`, `EditPlanModal`, `ProjectChatView`.
  - Bọc điều kiện render mount: `{isCommandPaletteOpen && <CommandPalette ... />}` và `{isShortcutsModalOpen && <KeyboardShortcutsModal ... />}` (cả hai dùng Radix Dialog nên unmount sạch sẽ).
  - Đo lường First Load JS sau tối ưu, ghi nhận mức giảm dung lượng chunk chính vào báo cáo.

#### Giai Đoạn B: Supabase RLS Policies Hardening & Khóa Toàn Bộ 4 RPC (B4, B5, M12, m9, m15, m20, m25)

- [ ] **Bước 6 (M12, m15)**: Soạn thảo script Introspection `scripts/introspect-rls.sql`:
  - Truy vấn `pg_proc WHERE prosecdef` và `pg_policies`, `storage.buckets`, `pg_extension` (để lấy schema chính xác của pgvector) trên Supabase SQL Editor / CLI.
  - Xuất ground truth hiện trạng trước khi áp dụng migration. Nếu phát hiện hàm `prosecdef` nào khác ngoài 4 hàm đã biết, bổ sung ngay vào migration (m15).
- [ ] **Bước 7 (B4, M8, m9, M12)**: Tạo migration file `supabase/migrations/20261012000000_rls_security_audit_cycle_2.sql` và **Apply Migration qua Supabase Dashboard SQL Editor**:
  - Bọc toàn bộ migration trong `BEGIN; ... COMMIT;`:

    ```sql
    BEGIN;

    -- 1. Khóa chặt 4 RPC SECURITY DEFINER
    REVOKE EXECUTE ON FUNCTION increment_daily_message_count(TEXT, DATE) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION increment_daily_message_count(TEXT, DATE) TO service_role;
    ALTER FUNCTION increment_daily_message_count(TEXT, DATE) SET search_path = public, pg_temp;

    REVOKE EXECUTE ON FUNCTION increment_daily_research_count(TEXT, DATE) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION increment_daily_research_count(TEXT, DATE) TO service_role;
    ALTER FUNCTION increment_daily_research_count(TEXT, DATE) SET search_path = public, pg_temp;

    -- match_project_knowledge: BẮT BUỘC giữ extensions trong search_path cho pgvector (<=>, vector)
    REVOKE EXECUTE ON FUNCTION match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER) TO service_role;
    ALTER FUNCTION match_project_knowledge(UUID, VECTOR, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions, pg_temp;

    REVOKE EXECUTE ON FUNCTION get_project_storage_bytes(UUID) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION get_project_storage_bytes(UUID) TO service_role;
    ALTER FUNCTION get_project_storage_bytes(UUID) SET search_path = public, pg_temp;

    -- 2. Củng cố Deny-by-Default cho các bảng nhạy cảm
    ALTER TABLE daily_message_counts ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE daily_message_counts FROM anon, authenticated;

    ALTER TABLE daily_research_counts ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE daily_research_counts FROM anon, authenticated;

    ALTER TABLE research_tasks ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE research_tasks FROM anon, authenticated;

    -- 3. Xóa bỏ toàn bộ 5 permissive policies trên personas
    DROP POLICY IF EXISTS "Users can view own personas" ON personas;
    DROP POLICY IF EXISTS "Users can insert own personas" ON personas;
    DROP POLICY IF EXISTS "Users can update own personas" ON personas;
    DROP POLICY IF EXISTS "Users can delete own personas" ON personas;
    DROP POLICY IF EXISTS "Anyone can view premade personas" ON personas;
    REVOKE ALL ON TABLE personas FROM anon, authenticated;

    COMMIT;
    ```

- [ ] **Bước 8 (B5)**: Tạo rollback migration file đặt ngoài `supabase/migrations/` tại `database-migrations/rollback/20261012000000_rollback_rls_security_audit_cycle_2.sql`:
  - Khôi phục tường minh `GRANT EXECUTE` cho `PUBLIC, anon, authenticated` trên 4 hàm RPC.
  - Khôi phục nguyên văn 5 `CREATE POLICY` trên `personas` từ `20260625_add_personas.sql:24-27` và `20260626_add_premade_personas.sql:5`.
- [ ] **Bước 9 (M12, m20, m25)**: Tạo script kiểm thử tự động `scripts/verify-rls-negative-probe.ts`:
  - Khai báo mẫu `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong `env.local.example` và `docs/security.md`.
  - Script đọc `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY`, fail-fast nếu thiếu biến môi trường này khi chạy kiểm chứng live.
  - Gửi HTTP request tới PostgREST `/rest/v1/` với role `anon`.
  - **Assert chuẩn xác**: PostgREST trả HTTP 401 với `{ code: "42501" }` cho role `anon`, probe assert `body.code === "42501"` (không assert HTTP 403 - m20).
  - **Kiểm thử 4 RPCs thực tế và truyền đúng kiểu/tên tham số** (m20, m25):
    - `match_project_knowledge`: truyền vector 3072 chiều hợp lệ:
      `{ p_project_id: "00000000-0000-0000-0000-000000000000", query_embedding: JSON.stringify(new Array(3072).fill(0)), match_threshold: 0.5, match_count: 5 }`
    - `increment_daily_message_count`: `{ p_user_id: "dummy-user", p_date: "2026-10-12" }`
    - `increment_daily_research_count`: `{ p_user_id: "dummy-user", p_date: "2026-10-12" }`
    - `get_project_storage_bytes`: `{ p_project_id: "00000000-0000-0000-0000-000000000000" }`
    - _(Tuyệt đối không kiểm tra RPC ảo không tồn tại `get_daily_usage` - m25)._
- [ ] **Bước 10 (M1, M8, m10)**: Đồng bộ tài liệu kỹ thuật:
  - Cập nhật `docs/database-schema.md` mục 3 phản ánh đầy đủ chính sách RLS của 16 tables.
  - Cập nhật `docs/contracts.md` mục Chat Stream Events phản ánh đúng wire format thực tế.
  - Cập nhật `docs/security.md` và `docs/CHANGELOG.md`.

#### Giai Đoạn C: Xây Dựng Hạ Tầng Playwright & Mocking Isolation

- [ ] **Bước 11 (M14, m13, m14, m19, m21)**: Cập nhật `playwright.config.ts`:
  - Định nghĩa hằng số duy nhất:
    ```ts
    const E2E_PORT = 3100;
    const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
    ```
  - Cấu hình `use: { baseURL: E2E_BASE_URL }` và `grepInvert: /@online/`.
  - Cấu hình `webServer` thích ứng CI và nạp dummy provider keys (m19, m21):
    ```ts
    webServer: {
      command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
      url: E2E_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(E2E_PORT),
        NEXTAUTH_URL: E2E_BASE_URL,
        AUTH_URL: E2E_BASE_URL,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "dummy-e2e-service-key",
        UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8079",
        UPSTASH_REDIS_REST_TOKEN: "dummy-redis-token",
        AUTH_SECRET: "dummy-auth-secret-for-e2e-testing-32-chars-minimum",
        NEXTAUTH_SECRET: "dummy-auth-secret-for-e2e-testing-32-chars-minimum",
        AUTH_TRUST_HOST: "true",
        GOOGLE_CLIENT_ID: "dummy-google-client-id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "dummy-google-client-secret",
        GEMINI_API_KEY: "dummy-gemini-key-for-e2e",
        DATA_ENCRYPTION_KEY: "dummy-encryption-key-32-chars-long",
        OPENROUTER_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        DEEPSEEK_API_KEY: "",
        WHITELIST_EMAILS: "",
        ATTACHMENTS_CRON_SECRET: "dummy-cron-secret",
      },
    }
    ```
  - _Lưu ý (m19)_: Với `reuseExistingServer: !CI`, nếu cổng 3100 đã có tiến trình khác chạy thì Playwright sẽ dùng lại server đó. Người thực thi cần đảm bảo cổng 3100 được giải phóng trước khi test.
- [ ] **Bước 12 (M3, M9, M17, M18, M19, m17, m23, m24) [Discovery Probe & Network Guard]**: Xây dựng Network Isolation Guard & Discovery Probe `tests/e2e/helpers/network-guard.ts`:
  - Hàm `setupNetworkGuard(page, options?: { mode: "record" | "enforce" })`:
    - Chế độ `record`: Lắng nghe `page.on("request")` trên các routes `/auth/signin`, `/`, và `/images` để ghi nhận và xuất danh sách request mount-time thực tế.
    - Chế độ `enforce` (mặc định cho test runs): Đăng ký catch-all `page.route("**/api/**")` trả về 501 Not Implemented, lưu URL vào `unhandledRequests`.
  - Cung cấp hàm `assertNoUnhandledRequests(unhandledRequests)` kiểm tra mảng rỗng.
  - **Chốt Bảng Endpoint Inventory Table (M9, M17, M18, M19, m23, m24)**:

| HTTP Method | URL Glob Pattern               | Helper Sở Hữu       | Mô Tả & Payload                                                                                                                       | Thời Điểm Kích Hoạt                                      |
| :---------- | :----------------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------- |
| `GET`       | `**/api/auth/session`          | `mock-session.ts`   | Session Object (authed) hoặc `null` (unauthed - m18)                                                                                  | Mount-time (`<SessionProvider>`)                         |
| `GET`       | `**/api/projects`              | `mock-projects.ts`  | `{ success: true, data: { projects: [], tier: "pro", limits: { ... } } }`                                                             | Mount-time (`Sidebar.tsx:200`)                           |
| `GET`       | `**/api/files*`                | `mock-projects.ts`  | `{ success: true, data: { files: [] } }`                                                                                              | Runtime (`useFiles.ts:37` khi chọn conv)                 |
| `GET`       | `**/api/user/allowed-models`   | `mock-session.ts`   | `{ success: true, data: { allowed_models: ["gemini-2.5-flash", ...], features: {} } }`                                                | Mount-time (`useAllowedModels.ts`)                       |
| `GET`       | `**/api/batch-gen-quota`       | `mock-image-gen.ts` | `{ success: true, data: { rank: "pro", maxBatchSize: 4, quotas: { ... } } }`                                                          | Mount-time (`/images`)                                   |
| `GET`       | `**/api/conversations*` (list) | `mock-chat.ts`      | `{ success: true, data: { conversations: [] } }` (khi không có query `?id=`)                                                          | Mount-time (`Sidebar.tsx`)                               |
| `GET`       | `**/api/conversations*?id=*`   | `mock-chat.ts`      | `{ success: true, data: { id: conversationId, title: "New Conversation", messages } }` (M19)                                          | Runtime (`useChatStreamController` & `loadConversation`) |
| `POST`      | `**/api/conversations*`        | `mock-chat.ts`      | `{ success: true, data: { conversation: { id: conversationId, title: "...", createdAt: "...", updatedAt: "..." } } }` (M17, M18, m24) | Runtime (tạo hội thoại mới khi gửi prompt)               |
| `POST`      | `**/api/messages`              | `mock-chat.ts`      | `{ success: true, data: { message: { id: "msg-partial-123", ... }, alreadyComplete: false } }` (m23)                                  | Runtime (`syncPartialMessage` khi abort/xong)            |
| `POST`      | `**/api/prompt-suggest`        | `mock-image-gen.ts` | `{ success: true, data: { suggestions: [] } }`                                                                                        | Runtime (khi gõ prompt trong Image Studio)               |
| `POST`      | `**/api/chat-stream`           | `mock-ai-stream.ts` | SSE Stream: frames `meta`, `thinking`, `token`, `done`                                                                                | Runtime (gửi tin nhắn chat)                              |
| `POST`      | `**/api/generate-image`        | `mock-image-gen.ts` | `{ success: true, data: { images: [...] } }`                                                                                          | Runtime (tạo ảnh)                                        |

- [ ] **Bước 13 (M4, M7, M9, m12, m18)**: Xây dựng Session Mock Helper `tests/e2e/helpers/mock-session.ts`:
  - Hàm `mockAuthenticatedSession(page)`: Chặn `GET **/api/auth/session` trả về Session Object hợp lệ (`user: { id: "test-e2e@vikini.dev", email: "test-e2e@vikini.dev", name: "E2E Tester", rank: "pro" }`, `expires: new Date(Date.now() + 86400000).toISOString()`).
  - Hàm `mockUnauthenticatedSession(page)`: Chặn `GET **/api/auth/session` trả về `null` (`body: JSON.stringify(null)` với HTTP 200) cho `auth-flow.spec.ts` (m18).
  - Chặn `GET **/api/user/allowed-models` trả về `{ success: true, data: { allowed_models: ["gemini-2.5-flash", "gemini-3.1-flash-image", "claude-3-5-sonnet"], features: {} } }` (M9).
  - Không mock `/api/user/rank` (M9).
- [ ] **Bước 14 (M9, M13, M17, M18, M19, m16, m23, m24, m32)**: Xây dựng Mock Chat & Real Streaming Helpers:
  - **Xây dựng `tests/e2e/helpers/mock-chat.ts` (M9, M17, M18, M19, m23, m24, m32)**:
    - Nhập kiểu dữ liệu chuẩn:

      ```ts
      import type { Page } from "@playwright/test";
      import type { Conversation } from "@/lib/features/chat/conversations";
      import type { FrontendMessage } from "@/app/features/chat/hooks/useConversation";

      export interface SetupMockChatOptions {
        conversationId?: string;
        messages?: FrontendMessage[];
      }
      ```

    - Xuất hàm `setupMockChat(page: Page, options?: SetupMockChatOptions)`:
      - Gán ID và mảng messages mặc định:
        ```ts
        const convId = options?.conversationId || "conv-e2e-123";
        const messages = options?.messages ?? [];
        ```
      - Chặn `**/api/conversations*` với return/await để tuân thủ quy tắc `@typescript-eslint/no-floating-promises` (m32):

        ```ts
        await page.route("**/api/conversations*", async (route, request) => {
          if (request.method() === "POST") {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                success: true,
                data: {
                  conversation: {
                    id: convId,
                    title: "New Conversation",
                    model: "gemini-2.5-flash",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  } satisfies Partial<Conversation>,
                },
              }),
            });
          }

          if (request.method() === "GET" && request.url().includes("?id=")) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                success: true,
                data: { id: convId, title: "New Conversation", messages },
              }),
            });
          }

          if (request.method() === "GET") {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ success: true, data: { conversations: [] } }),
            });
          }

          return route.fallback();
        });
        ```

      - Chặn `POST **/api/messages` với return để tuân thủ floating promises (m23, m32):
        ```ts
        await page.route("**/api/messages", async (route) => {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                message: {
                  id: "msg-partial-123",
                  conversation_id: convId,
                  role: "assistant",
                  content: "...",
                  created_at: new Date().toISOString(),
                },
                alreadyComplete: false,
              },
            }),
          });
        });
        ```

  - **Xây dựng `tests/e2e/helpers/mock-ai-stream.ts` (M1, M2, M13, m16)**:
    - Xây dựng mảng frames strongly-typed phía Node và nạp vào `page.addInitScript(fn, frames)`.
    - Can thiệp `window.fetch` cho endpoint `/api/chat-stream`:
      - **Kiểm tra early abort**: `if (req.signal.aborted) throw new DOMException("The user aborted a request.", "AbortError");` (m16).
      - Trả về `ReadableStream` phát tuần tự các events có typewriter delay (`meta`, `thinking`, `token`, `done`).
      - Lắng nghe `req.signal.addEventListener("abort", ...)`: Gọi `controller.error(new DOMException("The user aborted a request.", "AbortError"))` để reject `reader.read()` bằng `AbortError`, giúp UI dọn dẹp sạch mà không ném lỗi unhandled (M13).

- [ ] **Bước 15 (M5, M6, M9, M10, M19, m8, m16, m24, m29)**: Xây dựng Media & Projects Mock Helpers:
  - `tests/e2e/helpers/mock-image-gen.ts`:
    - Import kiểu dữ liệu chuẩn (m29):
      ```ts
      import type { BatchQuotaInfo } from "@/app/features/image-gen/components/ControlPanel";
      import type { FrontendMessage } from "@/app/features/chat/hooks/useConversation";
      ```
    - Khai báo và export sample SVG message fixture (M19):

      ```ts
      export const SAMPLE_IMAGE_SVG =
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'><rect width='512' height='512' fill='%23222'/><text x='50%' y='50%' fill='%23fff' font-size='24' text-anchor='middle' dominant-baseline='middle'>Cyberpunk Neon</text></svg>";

      export const SAMPLE_IMAGE_MESSAGE: FrontendMessage = {
        id: "msg-img-123",
        conversationId: "conv-image-123",
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        meta: {
          imageUrl: SAMPLE_IMAGE_SVG,
          prompt: "Cyberpunk city neon",
          originalOptions: {
            model: "gemini-3.1-flash-image",
            aspectRatio: "1:1",
          },
        },
      };
      ```

    - Mock `POST **/api/prompt-suggest` trả về `{ success: true, data: { suggestions: [] } }` (M9).
    - Mock `GET **/api/batch-gen-quota` trả về `{ success: true, data: { rank: "pro", maxBatchSize: 4, quotas: { 1: { limit: 100, used: 0, remaining: 100 }, 2: { limit: 50, used: 0, remaining: 50 }, 4: { limit: 25, used: 0, remaining: 25 } } } satisfies BatchQuotaInfo}` (M9, m29).
    - Mock `POST **/api/generate-image` với model `gemini-3.1-flash-image` (m8).

  - `tests/e2e/helpers/mock-projects.ts`:
    - Dùng `import type { ProjectLimits } from "@/lib/store/projectStore"` và `import type { ProjectWithStats } from "@/types/projects"` (m16).
    - Mock `GET **/api/projects` trả về `{ success: true, data: { projects: [], tier: "pro", limits: { maxProjects: 10, currentProjects: 0, maxStorageBytesPerProject: 5242880 } satisfies ProjectLimits } }`.
    - Mock `POST **/api/projects` trả về `{ success: true, data: { project: { id: "proj-e2e-123", name: "Workspace E2E", ... } } }`.
    - Mock `GET **/api/files*`: Trả về `{ success: true, data: { files: [] } }` (M9).

- [ ] **Bước 16 (m17, m24)**: Xây dựng Custom Fixture `tests/e2e/fixtures/test-fixtures.ts`:
  - Đóng gói fixture `authedPage`:
    1. Đăng ký Network Isolation Guard (catch-all 501 ở chế độ enforce).
    2. Đăng ký session mock (`mockAuthenticatedSession`), `allowed-models`, `GET /api/projects`, `GET /api/files*`, và gọi `setupMockChat(page)` (mặc định `conv-e2e-123`).
    3. Đăng ký error collector (`pageerror` và console errors).
    4. Chuyển quyền cho test: `await use(page);`
    5. **Teardown check**: `assertNoUnhandledRequests(unhandledRequests);` (tự động kiểm tra trên 100% test cases - m17).

#### Giai Đoạn D: Soạn Thảo E2E Test Specs & User Journey

- [ ] **Bước 17 (M4, M9, M10, M11, m14, m18)**: Soạn thảo `tests/e2e/auth-flow.spec.ts`:
  - Mock session unauthenticated `GET **/api/auth/session` trả về `null` (m18).
  - Đăng ký `page.route("https://accounts.google.com/**", r => r.abort())` bảo vệ mọi test (m14).
  - Test 1: Truy cập `/auth/signin` kiểm tra layout Warm Noir, logo V, nút "Sign in with Google" và badge mã hóa.
  - Test 2: Chuyển đổi ngôn ngữ VI ↔ EN kiểm tra nút cập nhật chuỗi từ từ điển dịch: `"ĐĂNG NHẬP VỚI GOOGLE"` / `"SIGN IN WITH GOOGLE"` (M10).
  - Test 3 (`@online`): Click "Sign in with Google" kích hoạt Server Action `handleGoogleSignIn`, dùng `page.waitForRequest(/accounts\.google\.com/)` kiểm tra điều hướng Google OAuth có các tham số `client_id`, `redirect_uri` (M11).
  - Test 4 (Offline): Click "Sign in with Google" gửi request `POST /auth/signin` chứa header `Next-Action` và xử lý graceful failure khi không có kết nối ra ngoài (m14).
- [ ] **Bước 18 (M1, M2, M5, M6, M9, M10, M13, M17, M18, M19, m24, m30, m31, m33)**: Soạn thảo `tests/e2e/user-journey.spec.ts`:
  - Chặng 1: Mở `/` với authed session, xác nhận render `ChatApp`, mock `GET **/api/conversations*` và `GET **/api/projects` mount-time được đáp ứng sạch sẽ (M9).
  - Chặng 2: Nhập prompt `"Giải thích kiến trúc Vikini"`, bấm Send ➔ Kích hoạt `POST **/api/conversations*` trả về `data.conversation.id = "conv-e2e-123"`, **assert kiểm tra điều hướng URL chuyển sang hội thoại mới** (m30):
    ```ts
    await expect(page).toHaveURL(/[?&]id=conv-e2e-123/);
    ```
    (`useConversation.ts` nhận diện conversation hợp lệ - M17, M18). `useFiles` gọi `GET **/api/files?conversationId=conv-e2e-123` được mock sạch sẽ.
  - Chặng 3: Xác nhận `ThinkingBlock` ban đầu có `aria-expanded="false"`. Click button mở rộng thành `aria-expanded="true"` và kiểm tra text thinking (M10). Các token text stream vào Bubble chat, Send đổi thành Stop. Stream xong kích hoạt `GET **/api/conversations*?id=conv-e2e-123` và Send hiển thị lại (M9).
  - Test case phụ Stop/Abort: Gửi tin nhắn, bấm Stop ➔ Mock reject `AbortError`, kích hoạt `POST /api/messages` lưu partial content (trả về đúng shape `data.message` - m23), kiểm tra `pageErrors.length === 0` (M9, M13).
  - Chặng 4 (Image Studio):
    1. Điều hướng tới `/images`.
    2. **Đăng ký lại route hội thoại cho Image Studio trước khi gửi request** (m31, m33):
       ```ts
       await page.unroute("**/api/conversations*");
       await setupMockChat(page, {
         conversationId: "conv-image-123",
         messages: [SAMPLE_IMAGE_MESSAGE],
       });
       ```
    3. Gõ prompt `"Cyberpunk city neon"` (kích hoạt `POST /api/prompt-suggest` trả về rỗng - M9).
    4. Bấm "Tạo ảnh", mock `POST /api/generate-image` thành công.
    5. Client gọi `loadConversation("conv-image-123")`, nhận `messages: [SAMPLE_IMAGE_MESSAGE]`.
    6. **Assert kiểm tra Canvas hiển thị ảnh SVG fixture thành công** (M19):
       ```ts
       await expect(page.locator('img[src^="data:image/svg+xml"]')).toBeVisible();
       ```
  - Chặng 5: Mở Sidebar, bấm New Project (`+`), điền form `CreateProjectModal` (Tên: `"Workspace E2E"`), bấm nút `{t("createProjectBtn")}` ("Tạo dự án"). Xác nhận `"Workspace E2E"` xuất hiện trong Sidebar.
- [ ] **Bước 19 (m10, m11, M15)**: Soạn thảo Báo cáo Audit Chu Kỳ 2 `docs/audit-report-2026-10-12-cycle-2.md`:
  - Tổng hợp kết quả audit dependencies (100% 0 High / 0 Critical), bundle size, Supabase RLS hardening, kết quả E2E test runs.
  - Ghi nhận danh sách rủi ro chấp nhận còn lại (chỉ gồm ESLint dev toolchain và mammoth moderate - M15).
  - Ghi nhận technical debt kích thước file `ChatApp.tsx` (1100 dòng).

#### Giai Đoạn E: Verification Gate & Quality Check

- [ ] **Bước 20 (m10, M12, M15, M16, M18, m20, m25, m32)**: Thực thi toàn bộ kiểm thử chất lượng:
  - `npm audit --omit=dev --audit-level=high` (**bắt buộc exit code 0 tuyệt đối 100%** - M15)
  - `npm run type-check` (**bắt buộc 0 errors**, lưu ý `tsconfig.json` bao phủ cả `tests/e2e/**` - M18)
  - `npm run lint` (**bắt buộc 0 errors**, các handler async Playwright có return/await đầy đủ tuân thủ no-floating-promises - m32)
  - `npm run test:run` (112 test files / 1178 tests pass 100%)
  - `npm run build` (Next.js 16 build thành công không lỗi type/turbopack - m10)
  - `npx tsx scripts/verify-rls-negative-probe.ts` (Assert SQLSTATE 42501 trên toàn bộ 4 tables và 4 RPCs - M12, m20, m25)
  - `npm run test:e2e` (toàn bộ smoke, auth-flow, user-journey specs pass)

---

### 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

#### TC-E2E-01: Giao Diện Đăng Nhập & Chuyển Đổi Song Ngữ (`auth-flow.spec.ts` - M9, M10, m18)

- **Input**: User điều hướng tới `/auth/signin`.
- **Hành vi mong đợi**:
  - `GET /api/auth/session` trả về `null` (`body: JSON.stringify(null)` với HTTP 200) ➔ NextAuth client nhận diện đúng unauthenticated mà không bị catch-all 501 (m18).
  - Giao diện render thẻ chứa logo V với gradient vàng amber, nút Google Sign-In có icon SVG đa màu.
  - Nhấp vào nút "VI" ➔ Văn bản nút đăng nhập hiển thị chính xác `"ĐĂNG NHẬP VỚI GOOGLE"` (`vi.signInWithGoogle`).
  - Nhấp vào nút "EN" ➔ Văn bản nút đăng nhập hiển thị chính xác `"SIGN IN WITH GOOGLE"` (`en.signInWithGoogle`).
- **Failure modes**: Nếu hydration bị lỗi hoặc thiếu translation keys, nút hiển thị key thô `t("signInWithGoogle")` hoặc sai chữ hoa thường ➔ Test FAIL.

#### TC-E2E-02: Server Action Chuyển Hướng Google OAuth (`auth-flow.spec.ts` - M4, M11, m14)

- **Input**: User nhấp chuột vào nút Google Sign-In trên trang `/auth/signin`.
- **Hành vi mong đợi (Gắn tag `@online`)**:
  - Trình duyệt kích hoạt Server Action `handleGoogleSignIn`.
  - Sử dụng `page.waitForRequest(req => req.url().includes("accounts.google.com"))` để bắt request chuyển hướng OAuth.
  - Assert URL chứa các query parameters bắt buộc: `client_id` và `redirect_uri`.
  - Playwright route chặn và abort navigation an toàn để không truy cập Google live.
- **Hành vi mong đợi (Môi trường Offline CI)**:
  - Khi chạy offline với cờ bỏ qua `@online`, test case xác minh request `POST /auth/signin` chứa header `Next-Action` được gửi đi mà không làm crash ứng dụng (m14).
- **Failure modes**: Không có request OAuth hoặc Server Action văng exception unhandled 500 ➔ Test FAIL.

#### TC-E2E-03: Gửi Prompt, Stream Câu Trả Lời AI, Khớp Contract & Stop Abort (`user-journey.spec.ts` - M1, M2, M9, M10, M13, M17, M18, m16, m23, m30)

- **Input**: Nhập prompt `"Giải thích kiến trúc Vikini"` vào `textarea`, nhấn Enter hoặc click nút Send.
- **Hành vi mong đợi**:
  - Gửi `POST /api/conversations*` nhận `{ success: true, data: { conversation: { id: "conv-e2e-123", title: "New Conversation", createdAt: "...", updatedAt: "..." } } }` qua `mock-chat.ts` (M17, M18).
  - Client `useConversation.ts` parse thành công `backendConv.id`, cập nhật `activeId = "conv-e2e-123"`.
  - **Assert kiểm tra**: Điều hướng URL chuyển đổi thành công (m30):
    ```ts
    await expect(page).toHaveURL(/[?&]id=conv-e2e-123/);
    ```
  - Mock `GET /api/files?conversationId=conv-e2e-123` trả về danh sách files rỗng (M9).
  - Tin nhắn User xuất hiện trong `ChatMessagesArea` với vai trò `user`.
  - Stream phát event `thinking` ➔ Khối `ThinkingBlock` xuất hiện với thuộc tính `aria-expanded="false"` (thu gọn mặc định). Người dùng click nút mở rộng ➔ Thuộc tính chuyển thành `aria-expanded="true"` và hiển thị nội dung suy nghĩ `"Đang phân tích yêu cầu kiến trúc..."`.
  - Stream phát các chunks `token` (`t: "..."`) ➔ Typewriter buffer hiển thị ký tự dần theo thời gian; nút Send chuyển thành nút Stop.
  - Stream phát event `done` (`ok: true`) ➔ Quá trình stream kết thúc, gọi `GET /api/conversations*?id=conv-e2e-123` để đồng bộ tin nhắn (khớp glob `**/api/conversations*` qua `mock-chat.ts`), nút Send hiển thị trở lại (M9).
- **Test case phụ (Stop/Abort - M9, M13, m16, m23)**:
  - Gửi tin nhắn, khi stream đang phát token, click nút Stop.
  - Mock ném `DOMException("The user aborted a request.", "AbortError")`.
  - Hàm `syncPartialMessage` gọi `POST /api/messages` nhận phản hồi contract chuẩn `{ success: true, data: { message: { id: "msg-partial-123", ... }, alreadyComplete: false } }` từ `mock-chat.ts`, lưu trữ an toàn phần tin nhắn đã nhận (m23).
  - Trình duyệt không có bất kỳ `pageerror` hoặc console error nào văng ra (`expect(pageErrors).toEqual([])`).

#### TC-E2E-04: Image Studio với Prompt Autocomplete, Quota & Local SVG Fixture (`user-journey.spec.ts` - M5, M9, M19, m8, m24, m29, m31, m33)

- **Input**: Điều hướng tới `/images`, gõ prompt `"Cyberpunk city neon"`, click nút `"Tạo ảnh"` (`t("studioGenerate")`).
- **Thứ tự thực thi & Hành vi mong đợi (m33)**:
  1. Ngay khi trang `/images` được nạp, test suite gọi hủy route cũ và đăng ký handler Image Studio (m31, m33):
     ```ts
     await page.unroute("**/api/conversations*");
     await setupMockChat(page, {
       conversationId: "conv-image-123",
       messages: [SAMPLE_IMAGE_MESSAGE],
     });
     ```
  2. `Sidebar` mount kích hoạt `GET /api/projects` nhận data typed hợp lệ (M9).
  3. Gõ prompt `"Cyberpunk city neon"`, request `POST /api/prompt-suggest` được kích hoạt và nhận kết quả rỗng (không hiện dropdown che giao diện - M9).
  4. Mock `GET /api/batch-gen-quota` trả về đúng shape `BatchQuotaInfo` (từ `@/app/features/image-gen/components/ControlPanel`) có `maxBatchSize: 4` (M9, m29).
  5. Click nút `"Tạo ảnh"` (`t("studioGenerate")`) ➔ Nút chuyển trạng thái thành `"Đang tạo..."` (`t("studioGenerating")`) kèm loading spinner.
  6. Request `POST /api/conversations*` được gửi và nhận `data.conversation.id = "conv-image-123"` từ handler vừa đăng ký (M17, M18, m24).
  7. Mock API `POST /api/generate-image` với model `gemini-3.1-flash-image` trả về JSON thành công.
  8. Client gọi `loadConversation("conv-image-123")` kích hoạt `GET /api/conversations*?id=conv-image-123`, handler trả về `messages: [SAMPLE_IMAGE_MESSAGE]` (M19).
  9. `useImageGenStudio.ts:113-142` đồng bộ `SAMPLE_IMAGE_MESSAGE` vào `generatedImages`, Canvas hiển thị ảnh kết quả trên giao diện:
     ```ts
     await expect(page.locator('img[src^="data:image/svg+xml"]')).toBeVisible();
     ```
- **Failure modes**: Bị lỗi API Key modal, ảnh bị vỡ do CDN không kết nối được, hoặc Canvas trống không hiển thị ảnh SVG ➔ Test FAIL.

#### TC-E2E-05: Tạo & Lưu Workspace Dự Án với Typed Payload (`user-journey.spec.ts` - M6, M10, m16)

- **Input**: Trong Sidebar, nhấp nút `+` tại mục Projects, điền Form (Tên: `"Workspace E2E"`, Mô tả: `"Test project"`, Chọn Icon: `"folder"`), click nút `"Tạo dự án"` (`t("createProjectBtn")`).
- **Hành vi mong đợi**:
  - `CreateProjectModal` unmount (đóng lại).
  - Mock API `POST /api/projects` nhận payload đúng schema và trả về `{ success: true, data: { project: { id: "proj-e2e-123", name: "Workspace E2E", ... } } }`.
  - Mục `"Workspace E2E"` lập tức xuất hiện trong cây thư mục Projects của Sidebar.
  - Toast thông báo thành công hiển thị trên màn hình.
- **Failure modes**: Nút hiển thị chữ thô "createProject" do bug i18n hoặc mock payload sai kiểu `ProjectLimits` ➔ Test FAIL.

#### TC-SEC-01: Post-Migration Negative Probes Xác Minh SQLSTATE 42501 (`verify-rls-negative-probe.ts` - B4, M12, m20, m25)

- **Input**: Gửi HTTP request qua PostgREST API `/rest/v1/` sử dụng role `anon` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **Hành vi mong đợi**:
  - Gọi 4 RPCs thực tế (`increment_daily_message_count`, `increment_daily_research_count`, `match_project_knowledge`, `get_project_storage_bytes`) với đúng tên tham số (`p_project_id`, `p_user_id`, `p_date`, vector 3072 chiều `JSON.stringify(new Array(3072).fill(0))`, `match_threshold`, `match_count`) ➔ PostgREST trả HTTP 401 với `body.code === "42501"` (`permission denied for function`) (m20, m25).
  - Truy vấn 4 tables nhạy cảm (`daily_message_counts`, `daily_research_counts`, `research_tasks`, `personas`) ➔ PostgREST trả HTTP 401/403 với `body.code === "42501"` (`permission denied for table`).
  - Chỉ có `service_role` mới được phép thực thi các RPC và truy vấn các bảng trên.
- **Failure modes**: Nếu bất kỳ hàm hoặc bảng nào cho phép role `anon` truy cập hoặc trả về mã lỗi khác `42501` (hoặc `PGRST202` do sai tên tham số) ➔ Probe FAIL.

---

### 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

#### 1. Cấu Trúc Thư Mục Kiểm Thử & Công Cụ Hỗ Trợ:

```
tests/e2e/
├── fixtures/
│   └── test-fixtures.ts          # Fixtures Playwright mở rộng: authedPage, network-guard, teardown unhandled check (m17)
├── helpers/
│   ├── network-guard.ts          # [NEW] Catch-all 501 handler, record mode & unhandled tracker (M3, M9)
│   ├── mock-session.ts           # [NEW] Client session mock cho authed & unauthed null, allowed-models (M4, M7, M9, m18)
│   ├── mock-chat.ts              # [NEW] Mock handler duy nhất luồng hội thoại: POST/GET **/api/conversations* với payload data.conversation, hỗ trợ options.messages cho Image Studio, POST /api/messages với data.message (M9, M17, M18, M19, m23, m24, m32)
│   ├── mock-ai-stream.ts         # [NEW] Real streaming mock qua window.fetch hook, early abort & AbortError (M1, M2, M13, m16)
│   ├── mock-image-gen.ts         # [NEW] Mock Image Studio: prompt-suggest, BatchQuotaInfo từ ControlPanel & export SAMPLE_IMAGE_MESSAGE SVG fixture (M5, M9, M19, m8, m24, m29)
│   └── mock-projects.ts          # [NEW] Typed projects mock handlers khớp ProjectLimits (M6, M10, m16)
├── smoke.test.ts                 # Sanity smoke tests (đã có sẵn)
├── auth-flow.spec.ts             # [NEW] Kiểm thử chi tiết luồng Auth & i18n (@online tag) (M4, M9, M10, M11, m14, m18)
└── user-journey.spec.ts          # [NEW] Kiểm thử Full User Journey 5 chặng (M1, M2, M5, M6, M9, M10, M13, M17, M18, M19, m30, m31, m33)
scripts/
├── introspect-rls.sql            # [NEW] Introspection query chạy trên Supabase SQL Editor / CLI (M12, m15)
└── verify-rls-negative-probe.ts  # [NEW] PostgREST negative probe kiểm tra SQLSTATE 42501 với 4 RPCs thực tế và vector 3072 chiều (M12, m20, m25)
database-migrations/rollback/
└── 20261012000000_rollback_rls_security_audit_cycle_2.sql # [NEW] Rollback script di dời ra ngoài supabase/migrations/ (B5)
```

#### 2. Verification Commands & Quality Gates:

- **Cổng 1: Kiểm Tra Bảo Mật Dependencies**:
  ```bash
  npm audit --omit=dev --audit-level=high
  ```
  _(Bắt buộc exit code 0 tuyệt đối 100%, 0 Critical, 0 High - M15)._
- **Cổng 2: Kiểm Tra Toàn Bộ Mã Nguồn (Tier 2 Verification)**:
  ```bash
  npm run verify
  ```
  _(Chạy đồng thời `type-check`, `lint` và `test:run` với 112 test files / 1178 unit tests pass 100%. `npm run type-check` và `npm run lint` bao phủ toàn bộ `tests/e2e/**` - M18, m32)._
- **Cổng 3: Kiểm Tra Build Production**:
  ```bash
  npm run build
  ```
  _(Xác minh Next.js 16 build thành công sạch sẽ sau khi nâng cấp core packages - m10)._
- **Cổng 4: Xác Minh An Toàn CSDL Sau Migration (Negative Probe)**:
  ```bash
  npx tsx scripts/verify-rls-negative-probe.ts
  ```
  _(Xác minh tất định toàn bộ 4 tables và 4 RPCs trả về mã lỗi 42501 với role anon - M12, m20, m25)._
- **Cổng 5: Kiểm Tra Tự Động Hóa E2E Testing**:
  ```bash
  npm run test:e2e
  ```
  _(Chạy toàn bộ test suites: smoke, auth-flow, user-journey)._
- **Cổng 6: Đo Lường Bundle Size**:
  ```bash
  npm run analyze
  ```
  _(Kiểm tra báo cáo Webpack bundle analyzer, đối soát First Load JS)._

#### 3. Mô Hình Reference CI Pipeline (`.github/workflows/ci.yml` - m21, m27):

Để tuân thủ nghiêm ngặt Code Freeze và phạm vi task hiện tại, file `.github/workflows/ci.yml` được ghi nhận tài liệu cấu hình tham chiếu:

```yaml
# Reference pipeline configuration for CI E2E execution
name: CI
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run verify

  e2e:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run E2E Tests (Playwright automatically runs build & start via webServer)
        env:
          CI: true
        run: npm run test:e2e
```

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Technical Controls)

Tuân thủ nghiêm ngặt Giao thức Mental Simulation (S1–S6) trong [`.agents/agents/reviewer/mental-simulation.md`](../../.agents/agents/reviewer/mental-simulation.md):

| Kịch Bản Đối Kháng                                                | Xếp Hạng Rủi Ro | Rủi Ro Tiềm Ẩn                                                                                                                                                                                                                                                                                                                                  | Technical Control (Phương Án Phòng Ngừa Trong Code)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :---------------------------------------------------------------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1: Cold-start, Type Checking, Linting & Dependency Gate**      | **Cao**         | Playwright transpile bỏ qua type-check khiến lỗi cú pháp/type trong helper không bị phát hiện cho đến khi `npm run type-check` chạy (M18); handler không await/return gây lỗi `@typescript-eslint/no-floating-promises` trong `npm run lint` (m32); lỗi `EOVERRIDE` hoặc dependencies đỏ (M15, M16).                                            | Nhập đúng `Conversation` từ `@/lib/features/chat/conversations` với trường camelCase `createdAt`/`updatedAt` (M18); nhập `BatchQuotaInfo` từ `@/app/features/image-gen/components/ControlPanel` (m29); thêm `return`/`await` cho mọi `route.fulfill`/`route.fallback` (m32); nâng devDep `postcss: ^8.5.23` và override `"$postcss"` (M16); cập nhật in-major `minimatch`/`brace-expansion`/`nanoid` đạt gate exit 0 tuyệt đối (M15).                                       |
| **S2: Runner Lifecycle & SSE Early/Late Abort**                   | **Cao**         | Bấm Stop gọi `cancelStream(true)` kích hoạt `syncPartialMessage` gọi `POST /api/messages` bị catch-all 501 chặn hoặc payload sai contract (M9, M13, m23); mock abort không ném đúng `AbortError` dẫn đến UI nhảy vào nhánh complete và gọi `reloadMessagesAfterStream` sai hành vi (M9, M13); signal bị abort từ trước khi fetch bắt đầu (m16). | `mock-chat.ts` đăng ký `POST /api/messages` trả về payload chuẩn `{ message: { id, ... }, alreadyComplete: false }` (m23); trong `mock-ai-stream.ts`, kiểm tra `if (req.signal.aborted)` ném `AbortError` ngay từ đầu; khi signal abort trong khi stream, gọi `controller.error(new DOMException("The user aborted a request.", "AbortError"))` để `reader.read()` reject `AbortError` chuẩn; đăng ký `pageerror` collector assert mảng rỗng.                               |
| **S3: Database RLS, Probe Vector & Rollback Auto-apply**          | **Cao**         | File rollback đặt trong `supabase/migrations/` bị auto-apply hoàn tác bản vá B4 (Timeline 1 - B5); search_path thiếu schema `extensions` làm vỡ kiểu `VECTOR` (B4); gọi probe sai tên tham số hoặc vector 0 chiều bị lỗi định dạng trước khi check quyền (m20, m25).                                                                            | Di dời file rollback sang `database-migrations/rollback/20261012000000_rollback_rls_security_audit_cycle_2.sql`; `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` cho toàn bộ 4 RPCs; giữ `extensions` trong search_path cho `match_project_knowledge`; probe gửi đúng các tên tham số, truyền vector 3072 chiều toàn số 0 (`new Array(3072).fill(0)`), bỏ RPC ảo `get_daily_usage`, và assert `body.code === "42501"` (m20, m25). |
| **S4: Cross-Task State Flow, Image Studio Canvas & Route Timing** | **Cao**         | Chuyển sang Image Studio trên cùng page vẫn giữ handler của Chat hoặc handler `GET ?id=` luôn trả `messages: []` khiến Canvas trống và test fail tất định (Timeline 1 - M19); re-route muộn sau khi click tạo ảnh khiến POST rơi vào handler cũ (m33); mock trả sai shape (M17, M18).                                                           | Mở rộng `setupMockChat` nhận `messages: [SAMPLE_IMAGE_MESSAGE]` (M19); xuất fixture message SVG trong `mock-image-gen.ts` (M19); assert `expect(page.locator('img[src^="data:image/svg+xml"]')).toBeVisible()` (M19); thực hiện `page.unroute` và gọi `setupMockChat` Image Studio **ngay từ đầu** TC-E2E-04 trước khi gõ prompt/click tạo ảnh (m31, m33); assert `expect(page).toHaveURL(/[?&]id=conv-e2e-123/)` (m30).                                                    |
| **S5: Security Boundary & Network Leak**                          | **Cao**         | Traffic từ E2E tests lọt xuống Supabase/Redis live tạo dữ liệu rác nếu dev server tái sử dụng port 3000 (Timeline 3 - M14, m7); các provider key trong `.env.local` rò rỉ vào server test nếu không được ghi đè (m19).                                                                                                                          | Cài đặt Network Isolation Guard với catch-all `page.route("**/api/**")` trả về 501; đưa `assertNoUnhandledRequests` vào teardown của fixture `authedPage`; nạp dummy credentials cho cả `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_URL` trong `webServer.env`; bổ sung ghi đè `AUTH_URL`/`NEXTAUTH_URL` và đặt rỗng toàn bộ AI provider keys trong `webServer.env` (m19).                                                                                                      |
| **S6: External Resilience & OIDC Discovery**                      | **Trung bình**  | Server Action `signIn("google")` thực hiện OIDC discovery tới `accounts.google.com` từ phía server Node.js không thể intercept qua `page.route`, gây lỗi 500 khi chạy trong môi trường CI sandbox hoàn toàn offline (M11, m14).                                                                                                                 | Gắn tag `@online` cho test case kiểm tra điều hướng Google OAuth; cấu hình `grepInvert: /@online/` mặc định trong `playwright.config.ts`; cung cấp kịch bản offline riêng biệt xác minh request Server Action `POST /auth/signin` được gửi an toàn; đăng ký abort route Google cho mọi test auth.                                                                                                                                                                           |

---

## Audit History

> Khu vực dành riêng cho Lead Reviewer ghi nhận xét theo từng lượt audit. Antigravity duy trì code freeze cho tới khi có phê duyệt chính thức.

### Audit Run 1

- **Reviewer**: Pending Dispatch (Claude Code CLI / Fallback Reviewer)
- **Status**: Pending Review
- **Findings**: N/A

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 1
- **Kết luận**: `[CHANGES_REQUESTED]` — 3 `[BLOCKER]`, 8 `[MAJOR]`, 6 `[MINOR]`

#### Kiểm chứng lỗi cũ

`### Audit Run 1` chỉ là placeholder (`Status: Pending Review`, `Findings: N/A`), không có finding nào để đối chiếu. Đây là lượt thẩm định thực chất đầu tiên trên Revision 1.

#### Baseline đã xác minh

| Hạng mục               | Bằng chứng                                                                                                                                                      | Kết quả                                                    |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| Type-check             | `[CMD]` `npm run type-check` → exit 0                                                                                                                           | ✅                                                         |
| Unit tests             | `[CMD]` `npx vitest run` → exit 0, `Test Files 112 passed`, `Tests 1178 passed`                                                                                 | ✅ Khớp số liệu plan                                       |
| Lint wiring cho e2e    | `[CMD]` `npx eslint --print-config tests/e2e/smoke.test.ts` → `no-explicit-any: 2`, `no-console: [2,{allow:[warn,error]}]`, `no-floating-promises: 2`           | ✅ Rule áp dụng cho `tests/e2e/**`                         |
| `npm audit`            | `[CMD]` `npm audit --json` → `{"low":1,"moderate":10,"high":20,"critical":7,"total":38}`                                                                        | ✅ Tổng số khớp, ❌ phân loại/phương án sai (xem B2)       |
| `pg` không dùng        | `[CMD]` grep `from "pg"` / `require("pg")` toàn repo (trừ `node_modules`) → 0 kết quả                                                                           | ✅ Gỡ `pg` hợp lệ                                          |
| `next build --webpack` | `[SRC]` `node_modules/next/dist/bin/next:89` có `.option('--webpack', ...)`; `next.config.ts:99-100` dùng `withBundleAnalyzer({ enabled: ANALYZE === "true" })` | ✅ Bước 3 hợp lệ                                           |
| Phiên bản cài thực tế  | `[CMD]` `next@16.1.4`, `next-auth@5.0.0-beta.30`, `@playwright/test@1.62.1`, `vitest@4.0.17`                                                                    | ℹ️ Plan ghi `@playwright/test` "1.64.0" chưa được xác minh |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả  | Bằng chứng chính                                                                                                                                                                                                                                                                              |
| :--------------------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **FAIL** | `[SRC]` `src/app/features/chat/components/ChartTool.tsx:5-21` import `recharts`, được nạp qua `BubbleMarkdown.tsx:40` (`dynamic(() => import("./ChartTool"))`) và render ở `:81` → Bước 1 gỡ `recharts` sẽ làm build vỡ (B1). Cấu hình `webServer` trong Bước 7 có cả `port` lẫn `url` (m2).  |
| **S2** Runner Lifecycle & Teardown | **FAIL** | `[SRC]` `node_modules/playwright-core/types/types.d.ts:22605`: `route.fulfill({ body?: string\|Buffer })`, không có API stream → không thể phát chunk có delay, nên control S2 `route.request().frame().page().on('close')` không có tác dụng (M2).                                           |
| **S3** Database & Temporal         | **FAIL** | `[SRC]` `supabase/migrations/20260627000000_add_deep_research.sql:26,46` đã bật RLS và không có policy (deny-all); Bước 5 lại mở CRUD cho owner (B3). `[SRC]` `20260109083435_remote_schema.sql` dài 0 dòng → không có ground truth RLS (M8).                                                 |
| **S4** Cross-Task State Flow       | **FAIL** | `[SRC]` Parser SSE `useChatStreamController.ts:532-547` bắt buộc có dòng `event:`; `:631` đọc `data.t`; `:644` đọc `data.thinking` → mock ở Bước 9 sai định dạng (M1). `[SRC]` `projectStore.ts:82-92,105-121` cần `{success,data:{projects,tier,limits}}` / `{success,data:{project}}` (M6). |
| **S5** Security Boundary           | **FAIL** | `[CMD]` `npm audit` còn critical runtime ở `next` và `next-auth` mà plan không xử lý (B2). Mint JWT bằng secret thật, cookie name/salt sai trong CI (M7). Traffic không được mock rơi vào Supabase/Redis live (M3). RPC `SECURITY DEFINER` chưa `REVOKE EXECUTE` (B3).                        |
| **S6** External Resilience         | **FAIL** | Mock ảnh trỏ tới CDN Unsplash/Picsum (§8.2) → phụ thuộc mạng ngoài, đi ngược cam kết "offline hoàn toàn"; `next/image` optimizer fetch phía server, `page.route` không chặn được (M5). Sign-in là Server Action redirect sang Google phía server (M4).                                        |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: Cách ly E2E khỏi DB live (trục: thất bại giữa chừng / TOCTOU)
T1: Test inject cookie hợp lệ, mở "/" | T2: ChatApp fetch /api/gems, /api/personas, /api/user, /api/files... (không mock)
    → dev server auth() decode cookie OK → getSupabaseAdmin() (service_role, .env.local) query DB live
T3: Gửi prompt → ensureConversationExists() (useChatStreamController.ts:431-443) → POST /api/conversations;
    glob "**/api/conversations/**" của Bước 10 KHÔNG khớp "/api/conversations" → INSERT thật vào bảng conversations
Kết cục: Dữ liệu rác "test-e2e@vikini.dev" trong production DB, đồng thời jwt callback chạm Upstash live
         (authRevocation.ts:60-66) → LỖI (MAJOR, M3)
```

```
Cơ chế: Session cookie trong CI (trục: môi trường)
T1: CI=1 → playwright.config.ts:27 chạy "npm run start" (NODE_ENV=production)
T2: helper encode với salt "next-auth.session-token" và set cookie cùng tên
T3: auth.ts:35 đọc "__Secure-next-auth.session-token"; @auth/core lib/actions/session.js:23 decode với salt = tên cookie đó
Kết cục: session = null → mọi spec cần đăng nhập FAIL trên CI → LỖI (MAJOR, M7)
```

```
Cơ chế: RPC quota SECURITY DEFINER (trục: đồng thời + TOCTOU) — PLAUSIBLE, cần xác minh trên DB live
T1: Kẻ tấn công có anon key (theo thiết kế Supabase, anon key không phải bí mật) gọi
    POST /rest/v1/rpc/increment_daily_research_count {p_user_id:"victim@x", p_date: today} × N song song
T2: Hàm SECURITY DEFINER (database-migrations/013_increment_daily_research_count.sql:11) chạy với quyền owner, bỏ qua RLS;
    `grep -i revoke` trên mọi migration → 0 kết quả (không REVOKE EXECUTE FROM anon/authenticated), cũng không SET search_path
T3: daily_research_counts của nạn nhân vượt ngưỡng
Kết cục: Nạn nhân bị khóa Deep Research/chat quota (DoS logic) → LỖI (BLOCKER nếu xác nhận grant mặc định còn hiệu lực)
```

- **Trục Serverless**: N/A cho chính bộ E2E (chạy trên dev server local). Riêng việc `fullyParallel: true` cùng một email `test-e2e@vikini.dev` sẽ race trên dữ liệu live nếu không giải quyết M3.

#### Phân loại lỗi

**[BLOCKER]**

- **B1 — Gỡ `recharts` làm vỡ tính năng chart đang chạy.** Khẳng định "Hoàn toàn không được import ở bất kỳ đâu trong `src/`" (§1, Bước 1) là sai: `[SRC]` `src/app/features/chat/components/ChartTool.tsx:5-21` → `BubbleMarkdown.tsx:40,81`. **Yêu cầu**: giữ `recharts` và sửa lại §1/Bước 1/§5 (chỉ gỡ `pg`).
- **B2 — Bỏ sót CVE critical ở runtime production.** Plan khẳng định "khắc phục triệt để 38 lỗ hổng" nhưng chỉ xử lý vitest/vite/source-map-js/ws (chủ yếu là dev tooling). `[CMD]` `npm audit` cho thấy còn:
  - `next@16.1.4`: critical `GHSA-p293-qw3h-jr36` và `GHSA-2xp9-vwfh-vxw4` (<16.3.3), cùng hơn 15 advisory high; muốn hết sạch cần ≥16.3.8 (`npm view next dist-tags.latest` → `16.4.0`).
  - `next-auth@5.0.0-beta.30`: critical `GHSA-8fpg-xm3f-6cx3` và `GHSA-7rqj-j65f-68wh` (≤beta.31); bản vá là `5.0.0-beta.32` (kéo theo `@auth/core@0.41.3`, `[CMD]` `npm view`).
  - `protobufjs@7.5.4` (đến từ `@google/genai`): critical `GHSA-xq3m-2v4x-88gg`, ngưỡng vá cao nhất là `>7.6.4`.
  - `sharp@0.34.5` (đến từ `next`, image optimizer runtime): high; `postcss`, `happy-dom` (test): high.

  Bảng §4 còn ghi `next 16.1.x` là "tương thích hoàn toàn". **Yêu cầu**:
  1. Bump `next` ≥16.3.8 và `next-auth` → `5.0.0-beta.32`; thêm `overrides` cho `protobufjs`.
  2. Cấm `npm audit fix --force`, vì "fix" của `eslint-config-next` là hạ xuống `14.2.35` và của `mammoth` là hạ xuống `0.3.29`, đều semver-major downgrade.
  3. Ghi các rủi ro chấp nhận còn lại (ESLint toolchain, `mammoth→argparse/sprintf-js`) vào báo cáo audit kèm lý do.
  4. Thêm Verification `npm audit --omit=dev --audit-level=high` (exit 0) và chạy lại toàn bộ suite sau khi bump next-auth.

- **B3 — Hardening RLS đi sai hướng và bỏ sót lớp RPC.**
  1. `research_tasks` hiện đã deny-all (RLS bật, không có policy). Bước 5 thêm policy CRUD cho owner, tức là **mở thêm** quyền cho role `authenticated`, trong khi Vikini không dùng Supabase Auth phía client (`[CMD]` grep `createClient(` / `NEXT_PUBLIC_SUPABASE_ANON` trong `src/` → 0; `env.local.example:48-52` chỉ có service role). Việc này trái với chuẩn "Chỉ service_role truy cập" ở `docs/database-schema.md:436-450`.
  2. Postgres không có "deny policy" như Bước 5 mô tả cho `daily_*_counts`. Control đúng là bật RLS, không thêm permissive policy, và `REVOKE ALL ... FROM anon, authenticated`.
  3. Hai RPC `increment_daily_message_count` / `increment_daily_research_count` là `SECURITY DEFINER`, nhận `p_user_id` tùy ý, không `SET search_path` và không `REVOKE EXECUTE` (xem timeline 3).

  **Yêu cầu**: thay Bước 5 bằng "giữ deny-by-default + REVOKE table privileges + `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role` + `SET search_path = public, pg_temp`". `personas` có thể chuẩn hóa sang `auth.jwt() ->> 'email'` hoặc tốt hơn là drop policy để nhất quán với chuẩn service_role-only.

**[MAJOR]**

- **M1 — Mock SSE sai wire format thực tế; `docs/contracts.md` đã lỗi thời.** Server phát `event: <name>\ndata: <json>\n\n` (`[SRC]` `src/app/api/chat-stream/streaming/utils.ts:60`). Payload thực là token `{t}` (`anthropic-stream.ts:285`), thinking `{thinking}` (`reasoningStreamHelper.server.ts:14`), done `{ok}` (`anthropic-stream.ts:575`). Client bỏ qua mọi frame không có `event:` (`useChatStreamController.ts:539`), và meta xử lý theo `data.type === "conversationCreated" | "optimisticTitle" | ...` (`:556-560`). Bước 9 phát meta/done thiếu `event:` và thinking dùng `content`, nên TC-E2E-03 sẽ fail hoặc pass rỗng. **Yêu cầu**: định nghĩa frame mock theo đúng `sendEvent`, typed bằng type dùng chung (không `any`), và đưa `docs/contracts.md` §Chat Stream Events vào `[MODIFY]` (living docs).
- **M2 — Không thể stream bằng `route.fulfill`.** `[SRC]` `types.d.ts:22605`: `body?: string|Buffer`. Toàn bộ body đến một lần, nên typewriter delay và assertion "Send → Stop" trở nên flaky hoặc không quan sát được. **Yêu cầu**: chọn một cơ chế cụ thể, ví dụ `page.addInitScript` stub `window.fetch` cho `/api/chat-stream` trả về `ReadableStream` enqueue theo timer, hoặc một SSE mock server cục bộ. Thay control S2 trong §9 cho phù hợp và thêm test case Stop/Abort giữa stream.
- **M3 — Không có cơ chế fail-closed cho network, nên DB và Redis live bị chạm.** Client gọi ít nhất 20 nhóm endpoint (`/api/conversations`, `gems`, `personas`, `user`, `files`, `messages`, `batch-gen-quota`, `gallery`, `admin`...) trong khi plan chỉ mock 4. Giả định 3.2 "DB không bị ô nhiễm" không có technical control, vi phạm 4.5.4. **Yêu cầu**:
  1. Fixture đăng ký catch-all `page.route("**/api/**")` trả 501 và ghi lại URL, đăng ký **trước** các mock cụ thể (route đăng ký sau được ưu tiên).
  2. Mỗi spec assert danh sách request không được mock là rỗng.
  3. `webServer.env` trỏ `SUPABASE_URL` / `UPSTASH_*` tới giá trị dummy, làm lớp phòng thủ thứ hai.
  4. Sửa glob để khớp cả `/api/conversations`.
- **M4 — TC-E2E-02 không khả thi như đang mô tả.** Nút đăng nhập gọi Server Action `handleGoogleSignIn` (`[SRC]` `src/app/auth/signin/actions.ts:5-7`), tức `signIn("google")` chạy phía server rồi redirect thẳng sang Google, không có request trình duyệt nào tới `/api/auth/signin/google`. Hoàn tất OAuth đòi hỏi trao đổi token phía server (không intercept được), và callback `signIn` sẽ INSERT vào `profiles` live (`auth.ts:97-102`). **Yêu cầu**: TC-E2E-02 chỉ assert điều hướng tới `accounts.google.com/**` (dùng `page.route` để abort hoặc fulfill), còn việc "đã đăng nhập" kiểm ở TC riêng bằng session mock.
- **M5 — Hành trình Image Studio mock chưa đủ.** Sau khi generate thành công, ảnh được render từ `loadConversation(targetId)` (`[SRC]` `useImageGenStudio.ts:360-361`) chứ không từ response của `/api/generate-image`. Luồng này còn cần `createConversation` (`:224-239`), và với model `gpt-image`/`flux` cần `x-api-key` từ localStorage (`:213-220`, `:192-199`). **Yêu cầu**:
  - mock GET conversation/messages có payload ảnh;
  - cố định model mặc định trong test;
  - phục vụ ảnh fixture cục bộ (data URI hoặc `route.fulfill({ path })`) thay vì Unsplash/Picsum.
- **M6 — Thiếu hợp đồng payload cho mock Projects; control S4 hàm ý sửa code production.** Store yêu cầu `{success:true,data:{projects,tier,limits}}` và `{success:true,data:{project}}` (`[SRC]` `src/lib/store/projectStore.ts:82-92,105-121`). Câu "Kích hoạt `refreshConversations()` / `fetchProjects()` sau khi tạo" (§9 S4) là thay đổi hành vi production nhưng không có trong `[MODIFY]`. Thực tế `createProject` đã tự cập nhật store (`:115-123`). **Yêu cầu**: mock fixtures typed theo `src/types`, để type drift làm `type-check` fail; bỏ hoặc làm rõ control S4.
- **M7 — Chiến lược synthetic JWT rủi ro và sai trong CI.**
  - Salt bắt buộc bằng tên cookie (`[SRC]` `@auth/core/jwt.js:86`, `lib/actions/session.js:23`), mà tên cookie đổi theo `NODE_ENV` (`auth.ts:35`). Timeline 2 cho thấy CI sẽ fail.
  - Bước 7 đặt cứng `command: "npm run dev"` và `reuseExistingServer: true`, mâu thuẫn với §9 (`!process.env.CI`) và hồi quy logic CI ở `playwright.config.ts:27-28`.
  - Mint token bằng `NEXTAUTH_SECRET` của `.env.local` (có thể là secret thật) biến helper test thành công cụ giả mạo session. Phương án "fallback test secret khi `NODE_ENV === 'test'`" lại vô hiệu vì dev server chạy `development`.
  - `[SRC]` Chỉ `src/app/admin/page.tsx` gọi `await auth()` phía server; `/` và `/images` là client component dùng `useSession()` (`ChatApp.tsx:96`, `ImageGenStudio.tsx:33`).

  **Yêu cầu**: ưu tiên mock `/api/auth/session` ở tầng trình duyệt cộng với catch-all M3 (không cần secret). Nếu vẫn mint, chỉ dùng secret E2E riêng nạp qua `webServer.env`, tính tên cookie theo `NODE_ENV`, và fail-fast khi thiếu secret.

- **M8 — Audit RLS thiếu ground truth và sai tên bucket.**
  - `[CMD]` `remote_schema.sql` dài 0 dòng; `daily_message_counts` không có `ENABLE ROW LEVEL SECURITY` trong bất kỳ migration nào trong repo (`database-migrations/001_admin_system.sql:61`); `docs/database-schema.md` §3 mới liệt kê 10/16 bảng.
  - Bucket thực tế là `attachments` (`generate-image/route.ts:257`, `edit-image/route.ts:188`), `images` và `vikini-files` (`fileService.server.ts:54-56`). Không có bucket `chat-attachments`.

  **Yêu cầu**:
  1. Thêm bước introspection read-only trên DB live (`pg_class.relrowsecurity`, `pg_policies`, `has_function_privilege('anon', ...)`, `storage.buckets.public`) và ghi kết quả vào báo cáo.
  2. Thêm Verification negative cho migration: query bằng role `anon`/`authenticated` phải bị từ chối, gọi RPC bằng anon phải trả `permission denied`.
  3. Sửa tên bucket.

**[MINOR]** (không chặn, cần sửa khi revise)

- **m1** — Bước 4 không có tiêu chí đo: cần số liệu First Load JS trước và sau. `CommandPalette` và `KeyboardShortcutsModal` luôn được mount (`ChatApp.tsx:1084,1094`), nên `lazy()` chỉ có tác dụng nếu bọc `{isOpen && ...}`; cũng cần kiểm tra hotkey listener không nằm trong các component này.
- **m2** — Bước 7 khai báo cả `port: 3000` lẫn `url`: Playwright không cho phép đồng thời hai trường này. Nên giữ `url`.
- **m3** — Tên project không nhất quán giữa Bước 13 ("Dự Án Thử Nghiệm") và TC-E2E-05 ("Workspace E2E").
- **m4** — `devDependencies` có cả `playwright@^1.61.1` lẫn `@playwright/test@^1.62.1`, dễ lệch phiên bản. Nên gỡ `playwright` hoặc đồng bộ phiên bản; bảng §4 ghi "1.64.0" chưa có `[URL]`/`[CMD]` xác minh.
- **m5** — Script `test:e2e:debug` và `test:e2e:report` có trong §1 nhưng không có bước nào ở §6 thực hiện.
- **m6** — Bảng rủi ro §9 không xếp hạng Cao/Trung bình như 4.5.4 yêu cầu; TC-E2E-03 "ThinkingBlock có thể thu gọn" chưa phải assertion xác định.

#### Việc cần làm cho Revision 2

1. Sửa B1 (giữ `recharts`), B2 (bump `next` ≥16.3.8, `next-auth@5.0.0-beta.32`, override `protobufjs`, cấm `--force`, thêm Verification `npm audit --omit=dev --audit-level=high`) và B3 (deny-by-default + REVOKE table/function privileges + `SET search_path`).
2. Viết lại hạ tầng mock: wire format SSE đúng `sendEvent` (M1), cơ chế stream thật (M2), catch-all fail-closed và env dummy (M3), session mock thay cho JWT mint hoặc mint an toàn (M7).
3. Viết lại TC-E2E-02 (M4), TC-E2E-04 (M5), TC-E2E-05 cùng typed payload (M6).
4. Bổ sung bước introspection RLS live và negative probe, sửa tên bucket (M8); đưa `docs/contracts.md` vào `[MODIFY]`.
5. Cập nhật bảng rủi ro §9 có xếp hạng và ánh xạ mỗi rủi ro tới control đã xác minh.

**Trạng thái**: `[CHANGES_REQUESTED]` — Code freeze tiếp tục có hiệu lực. Không cấp thẻ phê duyệt cho Revision 1.

### Audit Run 3

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 2
- **Kết luận**: `[CHANGES_REQUESTED]` — 1 `[BLOCKER]`, 5 `[MAJOR]`, 6 `[MINOR]`

#### Kiểm chứng lỗi cũ (Audit Run 2 → Revision 2)

| ID         | Trạng thái                 | Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :--------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1         | ✅ Đã sửa                  | Plan giữ `recharts` (§1, Bước 1). `pg`: grep import/require toàn repo vẫn ra 0. Lưu ý: việc gỡ `pg` lại xung đột với Bước 5, xem M12.                                                                                                                                                                                                                                                                                                                       |
| B2         | ✅ Đã sửa (còn 1 điểm nhỏ) | `[CMD]` `npm view`: `next@16.4.0` tồn tại, `next-auth@5.0.0-beta.32` kéo `@auth/core: 0.41.3`, `protobufjs@7.6.5`, `vitest@4.1.11`, `eslint-config-next@16.4.0` đều tồn tại. `npm ls protobufjs` → `@google/genai@2.10.0 › protobufjs@7.5.4`, nên override là đúng chỗ. Đã cấm `--force` và có gate `npm audit --omit=dev`. Còn thiếu: yêu cầu 3 của Run 2 (ghi rủi ro chấp nhận còn lại cho ESLint toolchain và `mammoth`) chưa có trong Bước 16, xem m10. |
| B3         | ⚠️ Một phần                | 2 RPC quota, `research_tasks`, `daily_*_counts` và 4 policy `personas` đã xử lý đúng. Còn bỏ sót 2 hàm `SECURITY DEFINER` khác, trong đó 1 hàm làm lộ dữ liệu giữa các tenant, xem **B4**.                                                                                                                                                                                                                                                                  |
| M1         | ✅ Đã sửa                  | `[SRC]` Wire format mock khớp parser: `useChatStreamController.ts:534-539` (bắt buộc có `event:`), `:631` đọc `data.t`, `:644` đọc `data.thinking`, `:651-652` xử lý meta. `docs/contracts.md` đã nằm trong `[MODIFY]`.                                                                                                                                                                                                                                     |
| M2         | ⚠️ Một phần                | Đã chọn `addInitScript` + `ReadableStream`, cơ chế hợp lệ. Ngữ nghĩa abort của mock chưa đúng hành vi thật, xem M13.                                                                                                                                                                                                                                                                                                                                        |
| M3         | ⚠️ Một phần                | Catch-all đăng ký trước và mock cụ thể đăng ký sau là đúng (route đăng ký sau được ưu tiên); glob đã sửa. Nhưng thiếu inventory endpoint, nên guard sẽ làm spec đỏ (M9). Lớp phòng thủ `webServer.env` có kẽ hở (m7).                                                                                                                                                                                                                                       |
| M4         | ⚠️ Một phần                | Đã bỏ việc hoàn tất OAuth. Khẳng định "offline 100%" vẫn sai, xem M11.                                                                                                                                                                                                                                                                                                                                                                                      |
| M5         | ⚠️ Một phần                | Đã có `loadConversation` và fixture cục bộ. Model id sai (m8), thiếu mock `/api/prompt-suggest` (M9).                                                                                                                                                                                                                                                                                                                                                       |
| M6         | ❌ Chưa đạt                | Shape `limits` trong mock sai so với store, và type không export nên không "typed" được, xem M10.                                                                                                                                                                                                                                                                                                                                                           |
| M7         | ✅ Đã sửa                  | Đã bỏ phương án mint JWT. `[SRC]` `src/app/features/layout/providers.tsx:21` dùng `<SessionProvider>` không truyền prop `session`, nên client sẽ fetch `/api/auth/session` và mock có hiệu lực.                                                                                                                                                                                                                                                             |
| M8         | ⚠️ Một phần                | Tên bucket đã sửa. Bước introspection không thực thi được như mô tả, xem M12.                                                                                                                                                                                                                                                                                                                                                                               |
| m1         | ✅                         | `[SRC]` Listener `Ctrl+K` nằm ở `ChatApp.tsx:638-645` (component cha); `CommandPalette`/`KeyboardShortcutsModal` đang luôn được mount (`:1084`, `:1094`).                                                                                                                                                                                                                                                                                                   |
| m2         | ✅                         | `[SRC]` `playwright.config.ts:24-29` hiện đã đúng cấu hình đích (chỉ `url`, `reuseExistingServer: !CI`, `timeout: 120_000`).                                                                                                                                                                                                                                                                                                                                |
| m3, m4, m5 | ✅                         | Tên project thống nhất "Workspace E2E"; gỡ `playwright`; đủ 4 script e2e.                                                                                                                                                                                                                                                                                                                                                                                   |
| m6         | ❌ Chưa đạt                | TC-E2E-03 vẫn dùng "`data-state` **hoặc** `aria-expanded`", và trạng thái kỳ vọng sai với source, xem M10.                                                                                                                                                                                                                                                                                                                                                  |

#### Baseline đã xác minh (Run 3)

| Hạng mục                                                 | Bằng chứng                                                                                                                                                                                                                                                                                                                | Kết quả                                                                   |
| :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------ |
| Type-check                                               | `[CMD]` `npm run type-check` → exit 0                                                                                                                                                                                                                                                                                     | ✅                                                                        |
| ESLint áp dụng cho `tests/e2e/**` (negative probe 4.5.3) | `[CMD]` Tạo tạm `tests/e2e/__probe__.ts` (`any` + `console.log` + `page.goto` không await) → `npx eslint` exit 1 với `no-explicit-any`, `no-console`, `no-floating-promises`; file probe đã xóa ngay sau đó. Ghi chú: `eslint --stdin` trên máy này luôn trả exit 0 kể cả với `src/`, nên probe qua stdin không đáng tin. | ✅ Rule có hiệu lực                                                       |
| `tests/e2e` nằm trong type-check và bị loại khỏi vitest  | `[SRC]` `tsconfig.json` include `**/*.ts`; `vitest.config.ts` có `exclude: ["tests/e2e/**"]`                                                                                                                                                                                                                              | ✅ File `.spec.ts` mới sẽ được tsc kiểm tra và không bị vitest chạy nhầm  |
| `webServer.env` có ghi đè `.env.local` không             | `[SRC]` `node_modules/@next/env/dist/index.js` (`processEnv`): chỉ gán giá trị từ file khi `typeof initialEnv[key] === "undefined"`                                                                                                                                                                                       | ✅ Biến truyền qua process env thắng `.env.local` (kèm điều kiện, xem m7) |
| Caller của RPC                                           | `[SRC]` `limits.ts:245,344,386` và `knowledge.server.ts:292` đều chạy qua `getSupabaseAdmin()` (service role)                                                                                                                                                                                                             | ✅ REVOKE khỏi anon/authenticated không làm hỏng app                      |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả  | Bằng chứng chính                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :--------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **FAIL** | Type-check xanh, các version đích đều tồn tại (`[CMD]`). Tuy nhiên Bước 5 và TC-SEC-01 phụ thuộc kết nối Postgres trực tiếp hoặc anon key, mà cả hai chưa được khai báo trong `env.local.example` hay `.env.local` (chỉ có `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`), đồng thời `pg` bị gỡ ở Bước 1 (M12). Gate thiếu `npm run build` (Turbopack mặc định) sau khi bump `next` (m10).                                                           |
| **S2** Runner Lifecycle & Teardown | **FAIL** | `[SRC]` Bấm Stop → `handleStop` → `cancelStream(true)` (`useChatStreamController.ts:896-899`) → commit partial → `syncPartialMessage` gọi `POST /api/messages` (`:165-168`), endpoint này chưa được mock (M9). Ngoài ra mock phải reject bằng `AbortError` thì mới đi đúng nhánh `:740-745` (M13).                                                                                                                                                   |
| **S3** Database & Temporal         | **FAIL** | `[SRC]` `20260202130000_projects_knowledge_base.sql:104-139` và `20260928180000_unify_gemini_embedding_2.sql:49-84`: `match_project_knowledge` là `SECURITY DEFINER`, nhận `p_project_id` tùy ý, trả về `kc.content`. `:144-158`: `get_project_storage_bytes` cũng là `SECURITY DEFINER`. `[CMD]` grep `REVOKE\|GRANT` trên mọi migration → 0 kết quả. Plan chỉ khóa 2 hàm (B4).                                                                     |
| **S4** Cross-Task State Flow       | **FAIL** | `[SRC]` `projectStore.ts:8-12`: `ProjectLimits { maxProjects, currentProjects, maxStorageBytesPerProject }`, khác với mock trong plan (`maxDocumentsPerProject`, `maxStorageMb`). Interface này không được export. Chat flow tạo conversation qua `POST /api/conversations` trước khi stream (`:431-443`, `:689`) rồi mới nhận meta `conversationCreated` với id khác (`conv-e2e-123`), nên `setSelectedConversationId` bị đổi giữa chừng (M9, M10). |
| **S5** Security Boundary           | **FAIL** | Thiết kế guard client-side đạt: catch-all fail-closed và session mock không cần secret (`[SRC]` `providers.tsx:21`). Nhưng lớp RPC `SECURITY DEFINER` vẫn hở cross-tenant (B4), và lớp phòng thủ thứ hai `webServer.env` bị vô hiệu khi reuse dev server (m7).                                                                                                                                                                                       |
| **S6** External Resilience         | **FAIL** | `[SRC]` `node_modules/@auth/core/lib/actions/signin/authorization-url.js:14-22`: khi provider không có `authorization.url`, `signIn` sẽ gọi `o.discoveryRequest(issuer)` **phía server**. Google provider có `issuer: "https://accounts.google.com"` (`providers/google.js:113`), còn `auth.ts:15-18` chỉ cấu hình `clientId`/`clientSecret`. `page.route` không chặn được request này, nên khẳng định "offline 100%" không đúng (M11).              |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: RPC match_project_knowledge SECURITY DEFINER (trục TOCTOU / phân quyền)
T1: Kẻ tấn công có anon key + UUID project của nạn nhân gọi
    POST /rest/v1/rpc/match_project_knowledge
    {p_project_id:"<victim>", query_embedding:[3072 số bất kỳ], match_threshold:-2, match_count:100000}
T2: Hàm chạy với quyền owner, bỏ qua RLS của knowledge_chunks/knowledge_documents; similarity ∈ [-1,1] > -2 luôn đúng
T3: Trả về toàn bộ content chunk của knowledge base nạn nhân
Kết cục: Rò rỉ dữ liệu giữa các tenant → LỖI (BLOCKER, cùng threat model mà plan đã chấp nhận cho B3; còn tệ hơn
         vì lộ nội dung chứ không chỉ DoS quota). Migration Rev 2 không chạm tới hàm này.
```

```
Cơ chế: Fail-closed guard × Stop/Abort (trục: thất bại giữa chừng + dọn dẹp)
T1: Mock phát token, user bấm Stop → abortControllerRef.abort()
T2: cancelStream(true) commit partial → syncPartialMessage → fetch("POST /api/messages")
T3: Catch-all trả 501 → unhandledRequests = ["POST /api/messages"]; UI hiện trạng thái lưu lỗi
Kết cục: assertNoUnhandledRequests() FAIL một cách tất định → LỖI (MAJOR, M9).
         Nếu mock chỉ controller.close() thay vì reject AbortError, coreSend đi nhánh "complete"
         (:728-739) và gọi thêm reloadMessagesAfterStream, tức kiểm thử một luồng production không bao giờ đi (M13).
```

```
Cơ chế: Lớp phòng thủ thứ hai webServer.env (trục: môi trường)
T1: Dev đang chạy `npm run dev` (nạp .env.local live) ở cổng 3000
T2: `npx playwright test`, reuseExistingServer = !CI = true → Playwright dùng lại server đó, webServer.env bị bỏ qua
T3: Request nào lọt qua guard trình duyệt (Server Action, server component fetch trong tương lai) đi thẳng tới Supabase/Upstash live
Kết cục: Lớp thứ hai vô hiệu trong đúng kịch bản local phổ biến nhất → LỖI (MINOR, m7; lớp 1 vẫn còn).
```

- **Trục đồng thời**: `fullyParallel: true` dùng chung một dev server, nhưng mọi mock là per-page (`page.route` / `addInitScript`), nên AN TOÀN. Với migration: REVOKE có hiệu lực ngay, mà mọi caller đều dùng service role (`[SRC]` ở trên), nên AN TOÀN.
- **Trục serverless**: N/A cho bộ E2E (server local). Migration không phụ thuộc state in-memory.

#### Phân loại lỗi

**[BLOCKER]**

- **B4 — Khóa RPC `SECURITY DEFINER` chưa đầy đủ, `match_project_knowledge` làm lộ dữ liệu giữa các tenant.** Plan tuyên bố (§1, §9 S3) đã triệt tiêu rủi ro `SECURITY DEFINER`, nhưng chỉ khóa 2/4 hàm có trong repo. `match_project_knowledge(UUID, VECTOR(3072), FLOAT, INT)` để attacker kiểm soát cả `match_threshold` lẫn `match_count` (timeline 1); `get_project_storage_bytes(UUID)` lộ metadata. **Yêu cầu**:
  1. Thêm vào migration `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` cho cả `match_project_knowledge(uuid, vector, double precision, integer)` và `get_project_storage_bytes(uuid)`.
  2. Không áp dụng máy móc `SET search_path = public, pg_temp` cho `match_project_knowledge`: hàm dùng type `VECTOR` và toán tử `<=>`, mà extension được tạo không chỉ định schema (`20260202130000_projects_knowledge_base.sql:5`). Trên Supabase, extension có thể nằm ở `extensions`. Cần introspect `pg_extension`/`pg_namespace` trước, rồi dùng `public, extensions, pg_temp` (hoặc schema thực tế) để tránh làm vỡ RAG.
  3. Bước 5 phải liệt kê **toàn bộ** `pg_proc WHERE prosecdef` trong schema `public` cùng `has_function_privilege('anon', oid, 'EXECUTE')`. Migration phải phủ hết danh sách đó, không dừng ở danh sách hard-code.

**[MAJOR]**

- **M9 — Fail-closed guard sẽ làm spec đỏ một cách tất định vì thiếu inventory endpoint.** Các request có thật nhưng plan chưa mock:
  - `GET /api/conversations` (list, `useConversation.ts:52`), gọi khi mount `/` và `/images`.
  - `POST /api/conversations` trong **chat flow** (`useChatStreamController.ts:431-443,689`). Plan chỉ đặt mock này trong `mock-image-gen.ts`.
  - `GET /api/conversations?id=` sau khi stream xong (`:304`).
  - `POST /api/messages` khi bấm Stop (`:165-168`, timeline 2).
  - `POST /api/prompt-suggest` khi gõ prompt ≥5 ký tự trong Image Studio (`usePromptAutocomplete.ts:26-37`). "Cyberpunk city neon" chắc chắn kích hoạt request này, và dropdown gợi ý có thể che nút Generate.
  - Ngược lại, plan mock `GET /api/user/rank`, nhưng route này **không tồn tại** (`src/app/api/user/` chỉ có `allowed-models`).

  **Yêu cầu**:
  - Thêm bước "record mode": chạy từng trang với guard ở chế độ ghi nhận, xuất danh sách request thực tế, rồi chốt bảng inventory endpoint → mock → payload theo từng chặng.
  - Thống nhất id conversation: id mà `POST /api/conversations` trả về phải trùng id trong meta `conversationCreated`, hoặc bỏ hẳn frame `conversationCreated` vì conversation đã tồn tại từ trước.
  - Bỏ mock `/api/user/rank`.

- **M10 — Test Contract mâu thuẫn với source (gồm cả m6 và M6 chưa đạt).**
  1. TC-E2E-01: chuỗi thực tế là `"ĐĂNG NHẬP VỚI GOOGLE"` / `"SIGN IN WITH GOOGLE"` (`vi.ts:18`, `en.ts:18`), không phải "Đăng nhập bằng Google" / "Sign in with Google".
  2. TC-E2E-03: `ThinkingBlock` mặc định **thu gọn** (`BubbleHelpers.tsx:71` `useState(true)`, `:86` `aria-expanded={!isCollapsed}`) và không có `data-state`. Assertion "expanded" sẽ FAIL. Cần chốt một assertion duy nhất, ví dụ `aria-expanded="false"`, sau đó click và kiểm tra nội dung thinking.
  3. TC-E2E-05: key `t("createProject")` **không tồn tại** trong `vi.ts`/`en.ts` (chỉ có `createProjectBtn`, `vi.ts:657`, `en.ts:648`). Vì `useLanguage.ts:27` fallback `String(key)`, nút trong `CreateProjectModal.tsx:227` đang hiển thị nguyên chuỗi "createProject" trên production. Đây là bug i18n thật: cần đưa `src/components/features/projects/CreateProjectModal.tsx` vào `[MODIFY]` (đổi sang `createProjectBtn`), không viết test để hợp thức hóa bug.
  4. M6: `limits` thực tế là `{ maxProjects, currentProjects, maxStorageBytesPerProject }` (`projectStore.ts:8-12`). Cần export `ProjectLimits`/`ProjectWithStats` và để fixture dùng `satisfies` các type đó, khi đó type drift mới làm `type-check` fail.

  **Yêu cầu chung**: chuỗi kỳ vọng phải import từ `@/lib/utils/translations/{vi,en}`, không hard-code.

- **M11 — TC-E2E-02 và §9 S6 "offline 100%" không đúng.** Server Action `signIn("google")` thực hiện OIDC discovery tới `accounts.google.com` phía server (`[SRC]` ở S6). `page.route` không chặn được, nên CI offline hoặc sandbox sẽ nhận 500. Ngoài ra CI không có `.env.local`, mà `webServer.env` lại không khai báo `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXTAUTH_SECRET`. **Yêu cầu**:
  - Gắn tag `@online` cho TC-E2E-02 (mặc định skip bằng `grepInvert`) và sửa §9 S6 cho trung thực, **hoặc** giới hạn assertion ở việc Server Action được gọi (`POST /auth/signin` có header `Next-Action`).
  - Dùng `page.waitForRequest(/accounts\.google\.com/)` để assert `client_id`/`redirect_uri`, thay vì đọc `page.url()` sau khi đã abort.
  - Khai báo dummy Google/NextAuth env trong `webServer.env`.
- **M12 — Bước 5 (introspection) và TC-SEC-01 không thực thi được như đặc tả.**
  - `pg_class`/`pg_policies`/`has_function_privilege` không truy cập được qua `@supabase/supabase-js`/PostgREST.
  - Bước 1 lại gỡ `pg`.
  - Không có `DATABASE_URL` hay anon key được khai báo (`env.local.example`; `.env.local` chỉ có `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`).
  - `tsx` không nằm trong `devDependencies` (`scripts/run-migration.ts:2` vẫn dùng `node --loader tsx`).
  - TC-SEC-01 chấp nhận kết quả "hoặc trả 0 rows", nên RLS deny-all sẽ **che mất** trường hợp REVOKE chưa chạy.
  - §6/§8 không có bước apply migration, không có rollback, và không có gate chạy negative probe sau migration.

  **Yêu cầu**:
  - Chọn một cơ chế cụ thể: (a) file `.sql` read-only chạy trên Supabase SQL Editor, kết quả dán vào báo cáo; hoặc (b) giữ `pg` ở `devDependencies` kèm `SUPABASE_DB_URL` khai báo trong `docs/security.md` và `env.local.example`.
  - Kỳ vọng phải tất định: SQLSTATE `42501` cho cả bảng lẫn RPC.
  - Thêm "Cổng 5: post-migration negative probe" và script rollback (`GRANT` trả lại như hiện trạng introspect được).

- **M13 — Mock abort không phản ánh hành vi `fetch` thật, và thiếu bộ thu lỗi để assert "không unhandled rejection".** `fetch` thật khi bị abort sẽ reject `reader.read()` bằng `DOMException("…","AbortError")`, và `coreSend` dựa vào `error.name !== "AbortError"` (`:741-745`). **Yêu cầu**:
  - Trong hook, lắng nghe `init.signal`, gọi `controller.error(new DOMException("Aborted","AbortError"))` và reject promise `fetch` nếu signal đã aborted từ trước.
  - Đăng ký `page.on("pageerror")` cùng collector `console` mức error, rồi assert rỗng trong TC-E2E-03.

**[MINOR]**

- **m7 — Lớp phòng thủ thứ hai chưa kín.**
  - `supabase.server.ts:27` ưu tiên `NEXT_PUBLIC_SUPABASE_URL` trước `SUPABASE_URL`, nên cần đặt dummy cho cả hai.
  - Dùng cổng E2E riêng (ví dụ `PORT=3100`) hoặc `reuseExistingServer: false` để không bao giờ reuse dev server đang chạy với env live (timeline 3).
  - Nhánh CI `npm run start` cần `next build` trước, và cần đủ env dummy vì `src/lib/env.ts:20` throw khi `NODE_ENV=production`.
  - Sửa câu "ngăn chặn 100%".
- **m8** — "Cố định model `gemini-native`" sai: `gemini-native` là tên provider phía server (`generate-image/route.ts:207`). Model client mặc định là `gemini-3.1-flash-image` (`useImageGenStudio.ts:72`), cũng là model không cần API key (`:216-222`). Cần sửa đúng model id.
- **m9** — `personas` còn policy thứ 5 `"Anyone can view premade personas"` (`20260626_add_premade_personas.sql:5`): nên drop luôn cho nhất quán. Tên bucket attachments cấu hình qua env (`fileService.server.ts:55`, `env.local.example` có `ATTACHMENTS_BUCKET=vikini-attachments`), nên phải introspect `storage.buckets` thay vì hard-code 3 tên, và nêu rõ tiêu chí (`public = false`). Nên bọc migration trong `BEGIN; … COMMIT;`.
- **m10** — Theo `.agents/skills/database-migration.md` (bước cập nhật docs), cần thêm `docs/security.md` (bảng RLS) và `docs/CHANGELOG.md` vào `[MODIFY]`. Bump `eslint-config-next` lên `^16.4.0` đồng bộ với `next`. Thêm `npm run build` vào Bước 17. Bước 16 cần ghi danh sách rủi ro chấp nhận còn lại (ESLint toolchain, `mammoth`) theo yêu cầu 3 của B2/Run 2.
- **m11** — Cần xác nhận `CommandPalette`/`KeyboardShortcutsModal` không dùng `AnimatePresence` nội bộ cho exit animation trước khi chuyển sang mount có điều kiện; nếu có thì phải đặt `AnimatePresence` ở `ChatApp`. `ChatApp.tsx` đang dài 1100 dòng (vượt hard max 500): không bắt buộc refactor trong scope này, nhưng nên ghi nhận vào báo cáo audit.
- **m12** — Session mock nên có `expires` (ISO) và `user.id` theo đúng ngữ nghĩa `token.userId` (`auth.ts:201`). Frame SSE nên được build từ một type dùng chung phía Node rồi truyền vào `addInitScript(fn, frames)`, vì hàm init bị serialize và không import được type.

#### Việc cần làm cho Revision 3

1. **B4**: mở rộng migration sang mọi hàm `SECURITY DEFINER` (tối thiểu `match_project_knowledge`, `get_project_storage_bytes`); xử lý `search_path` theo schema thực tế của pgvector; Bước 5 phải enumerate `pg_proc.prosecdef`.
2. **M9**: lập inventory endpoint theo từng chặng (record mode), bổ sung mock `conversations` (list/POST/GET id) cho chat flow, `POST /api/messages`, `POST /api/prompt-suggest`; bỏ `/api/user/rank`; thống nhất id conversation.
3. **M10**: sửa toàn bộ assertion theo source và import từ dictionary dịch; sửa bug `t("createProject")` trong `CreateProjectModal.tsx`; export và dùng `ProjectLimits`/`ProjectWithStats` với `satisfies`.
4. **M11**: TC-E2E-02 gắn `@online` hoặc thu hẹp assertion; khai báo dummy env cho auth; sửa §9 S6.
5. **M12**: chốt cơ chế introspection và negative probe khả thi (SQL Editor hoặc `pg` dev dependency + env đã khai báo); kỳ vọng `42501` tất định; thêm bước apply migration, gate post-migration và rollback.
6. **M13**: mock abort reject `AbortError`; thêm collector `pageerror`/console error.
7. Xử lý các MINOR m7–m12 (không chặn nhưng nên làm cùng đợt).

**Trạng thái**: `[CHANGES_REQUESTED]` — Code freeze tiếp tục có hiệu lực. Không cấp thẻ phê duyệt cho Revision 2.

### Audit Run 4

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 3
- **Kết luận**: `[CHANGES_REQUESTED]` — 1 `[BLOCKER]`, 3 `[MAJOR]`, 5 `[MINOR]`

#### Kiểm chứng lỗi cũ (Audit Run 3 → Revision 3)

| ID  | Trạng thái                 | Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :-- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B4  | ✅ Đã sửa (còn 1 điểm nhỏ) | `[CMD]` grep `SECURITY DEFINER` trên `supabase/` và `database-migrations/` → đúng 4 hàm: `012:4-7` `(text, date)`, `013:5-8` `(TEXT, DATE)`, `20260928180000_unify_gemini_embedding_2.sql:51-55` `(UUID, VECTOR(3072), FLOAT, INT)`, `20260202130000_projects_knowledge_base.sql:145` `(UUID)`. Chữ ký trong migration (typmod bị bỏ qua) khớp cả 4. `match_project_knowledge` giữ `extensions` trong `search_path`. Còn thiếu quy tắc "phủ hết kết quả introspection", xem m15. Script rollback mới thêm lại sinh ra **B5**. |
| M9  | ⚠️ Một phần                | Đã bổ sung `POST/GET /api/conversations`, `POST /api/messages`, `POST /api/prompt-suggest`, bỏ `/api/user/rank`, thống nhất `conv-e2e-123`. Vẫn thiếu bước record mode và còn **3 request mount-time chưa có mock**, xem M9 bên dưới.                                                                                                                                                                                                                                                                                         |
| M10 | ✅ Đã sửa                  | `[SRC]` `vi.ts:18`/`en.ts:18` khớp chuỗi; `BubbleHelpers.tsx:71` `useState(true)`, `:85` toggle; `CreateProjectModal.tsx:227` vẫn là `t("createProject")` và đã nằm trong `[MODIFY]`; `projectStore.ts:8` chưa export và đã nằm trong Bước 4; `tsconfig.json:22` có `@/*` nên spec import được từ điển dịch; `ProjectWithStats` đã export sẵn ở `src/types/projects.ts:47`.                                                                                                                                                   |
| M11 | ✅ Đã sửa (còn điểm nhỏ)   | Đã gắn tag `@online`, dùng `waitForRequest`, khai báo dummy Google/NextAuth env, viết lại §9 S6 trung thực. Còn thiếu cấu hình `grepInvert`, và Test 4 offline sẽ sinh `pageerror`, xem m14.                                                                                                                                                                                                                                                                                                                                  |
| M12 | ⚠️ Một phần                | Đã chọn SQL Editor cho introspection, kỳ vọng `42501` tất định, có rollback và gate probe. Nhưng probe chưa chạy được: thiếu anon key và `tsx`, chưa có bước apply migration, xem M12 bên dưới.                                                                                                                                                                                                                                                                                                                               |
| M13 | ✅ Đã sửa                  | `[SRC]` `useChatStreamController.ts:740-745`: `controller.error(new DOMException(..., "AbortError"))` đi đúng nhánh im lặng `error.name !== "AbortError"`; Stop → `syncPartialMessage` → `POST /api/messages` (`:165-168`) đã được mock; đã có collector `pageerror`/console. Còn thiếu nhánh signal đã aborted từ trước, xem m16.                                                                                                                                                                                            |
| m7  | ⚠️ Một phần                | Cổng 3100 và dummy cho cả `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` là đúng. Nhưng `use.baseURL` không được cập nhật (xem **M14**), và nhánh CI vẫn thiếu bước build cùng env bắt buộc (m13).                                                                                                                                                                                                                                                                                                                                 |
| m8  | ✅                         | `[SRC]` `useImageGenStudio.ts:72` `useState("gemini-3.1-flash-image")`.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| m9  | ✅                         | Đã drop policy thứ 5, có `BEGIN; … COMMIT;`, introspect `storage.buckets`.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| m10 | ✅                         | `docs/security.md` và `docs/CHANGELOG.md` đã nằm trong `[MODIFY]`; đã có `eslint-config-next@^16.4.0`, `npm run build` và danh sách rủi ro chấp nhận.                                                                                                                                                                                                                                                                                                                                                                         |
| m11 | ✅                         | `[CMD]` grep `AnimatePresence` trên `CommandPalette.tsx` và `KeyboardShortcutsModal.tsx` → 0/0, nên mount có điều kiện là an toàn. Đã ghi nhận nợ 1100 dòng.                                                                                                                                                                                                                                                                                                                                                                  |
| m12 | ✅                         | Session mock đã có `expires` ISO và `user.id`; frame được truyền qua `addInitScript(fn, frames)`.                                                                                                                                                                                                                                                                                                                                                                                                                             |

#### Baseline đã xác minh (Run 4)

| Hạng mục                                   | Bằng chứng                                                                                                                                                                                        | Kết quả                                                                     |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------- |
| Type-check                                 | `[CMD]` `npm run type-check` → exit 0                                                                                                                                                             | ✅                                                                          |
| Phiên bản Playwright                       | `[CMD]` `require('@playwright/test/package.json').version` → `1.62.1`                                                                                                                             | ✅ Khớp §4                                                                  |
| Không có middleware/proxy chặn server-side | `[CMD]` `ls src/middleware.ts src/proxy.ts middleware.ts proxy.ts` → không tồn tại                                                                                                                | ✅ Session mock phía trình duyệt đủ để vào `/` và `/images`                 |
| Env bắt buộc của server                    | `[SRC]` `src/lib/utils/envValidation.ts:20-32`: bắt buộc `GEMINI_API_KEY`, `DATA_ENCRYPTION_KEY` (≥32 ký tự); `src/lib/env.ts:20` throw khi `NODE_ENV=production`; `auth.ts:2` import `@/lib/env` | ⚠️ `webServer.env` chưa có 2 biến này (m13)                                 |
| Cơ chế apply migration                     | `[SRC]` `.agents/skills/database-migration.md:90`: "Supabase Dashboard SQL Editor **hoặc `supabase db push`**"                                                                                    | ⚠️ Xem B5                                                                   |
| CI có chạy E2E không                       | `[SRC]` `.github/workflows/ci.yml`: chỉ chạy `type-check`, `lint`, `test:run`                                                                                                                     | ℹ️ Nhánh `process.env.CI` của Playwright hiện chưa có pipeline nào dùng tới |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả            | Bằng chứng chính                                                                                                                                                                                                                                                                                                        |
| :--------------------------------- | :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **FAIL**           | `[CMD]` type-check xanh. Tuy nhiên gate Bước 20 `npx tsx scripts/verify-rls-negative-probe.ts` cần anon key, mà key này không được khai báo ở `env.local.example:48-52` hay `docs/security.md`; `tsx` cũng không có trong `node_modules/.bin` (M12).                                                                    |
| **S2** Runner Lifecycle & Teardown | **PASS**           | `[SRC]` Ngữ nghĩa abort của mock khớp `useChatStreamController.ts:740-745`; partial sync `:165-168` đã được mock; collector `pageerror` có sẵn. Mock là per-page nên không cần teardown chung.                                                                                                                          |
| **S3** Database & Temporal         | **FAIL**           | Migration khóa đủ 4 RPC (`[SRC]` ở trên). Nhưng rollback đặt trong `supabase/migrations/` với timestamp lớn hơn, nên sẽ được `supabase db push` áp dụng ngay sau đó (B5, timeline 1).                                                                                                                                   |
| **S4** Cross-Task State Flow       | **FAIL**           | `[SRC]` `Sidebar.tsx:200-202` gọi `fetchProjects()` khi mount, và Sidebar được render ở cả ChatApp lẫn `ImageGenStudio.tsx:141`; `ChatApp.tsx:395` gọi `useFiles(selectedConversationId)` → `GET /api/files?conversationId=…` (`useFiles.ts:37-38`). Cả hai đều chưa có trong inventory của chặng 1–4 (M9, timeline 2). |
| **S5** Security Boundary           | **FAIL**           | `[SRC]` `playwright.config.ts:3-4,14`: `baseURL` được tính trong process runner từ `process.env.PORT \|\| 3000`, và `webServer.env.PORT` không ảnh hưởng tới giá trị này. Plan chỉ đổi `webServer.url`, nên lớp phòng thủ "cổng 3100" bị vô hiệu (M14, timeline 3). Cộng thêm B5.                                       |
| **S6** External Resilience         | **PASS** (kèm m14) | Tag `@online` và §9 S6 đã mô tả trung thực OIDC discovery phía server (`[SRC]` `@auth/core/.../authorization-url.js:14-22`, đã xác minh ở Run 3); có dummy Google env.                                                                                                                                                  |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: Rollback nằm trong thư mục migration tự động (trục: thất bại của chính bước dọn dẹp)
T1: Dev apply theo .agents/skills/database-migration.md:90 bằng `supabase db push`
T2: CLI áp dụng tuần tự mọi file <timestamp>_*.sql chưa chạy: 20261012000000_rls_security_audit_cycle_2.sql
    rồi 20261012000001_rollback_rls_security_audit_cycle_2.sql ("Khôi phục lại các lệnh GRANT EXECUTE và policies")
T3: anon/authenticated lấy lại EXECUTE trên 4 hàm SECURITY DEFINER; personas có lại 5 policy
Kết cục: B4 bị mở lại ngay trong lần deploy hardening; lịch sử migration ghi nhận "đã áp dụng" → LỖI (BLOCKER, B5).
         Gate probe có thể bắt được, nhưng hiện chưa chạy được (M12).
```

```
Cơ chế: Fail-closed guard × request mount-time (trục: TOCTOU giữa inventory khai báo và request thực tế)
T1: authedPage (guard + session mock) mở "/" → Sidebar mount → fetchProjects() → GET /api/projects
T2: mock-projects.ts chỉ được đăng ký ở chặng 5 → catch-all trả 501 → unhandledRequests = ["GET /api/projects"]
T3: Chặng 2 chọn conv-e2e-123 → useFiles → GET /api/files?conversationId=conv-e2e-123 → 501
Kết cục: assertNoUnhandledRequests() FAIL tất định ngay chặng 1 → LỖI (MAJOR, M9). Lặp lại ở /images (ImageGenStudio.tsx:141).
```

```
Cơ chế: Cách ly cổng 3100 (trục: môi trường)
T1: Dev đang chạy `npm run dev` ở cổng 3000 với .env.local live
T2: `npx playwright test` → webServer khởi động 127.0.0.1:3100 với env dummy;
    use.baseURL vẫn là http://localhost:3000 (playwright.config.ts:3-4,14, không đổi trong Bước 11)
T3: page.goto("/") đi tới server 3000 (env live); Server Action signIn và mọi request lọt guard chạy với credentials thật
Kết cục: Toàn bộ lớp phòng thủ thứ hai vô hiệu một cách im lặng, test vẫn xanh → LỖI (MAJOR, M14).
         Nếu không có server 3000 thì nhận ECONNREFUSED.
```

- **Trục đồng thời**: `fullyParallel: true`, nhưng mọi mock là per-page (`page.route` / `addInitScript`) nên AN TOÀN. REVOKE trong migration có hiệu lực ngay, mọi caller đều dùng service role (`limits.ts:245,344,386`, `knowledge.server.ts:292`, đã xác minh ở Run 3) nên AN TOÀN.
- **Trục serverless**: N/A. Bộ E2E chạy trên server local, migration không dùng state in-memory.

#### Phân loại lỗi

**[BLOCKER]**

- **B5 — Script rollback đặt trong `supabase/migrations/` sẽ bị auto-apply và hoàn tác chính bản vá B4.** File `20261012000001_rollback_rls_security_audit_cycle_2.sql` khớp quy ước `<timestamp>_name.sql` và có timestamp lớn hơn migration hardening. Theo cơ chế `supabase db push` mà `.agents/skills/database-migration.md:90` cho phép, hai file sẽ chạy liền nhau (timeline 1). **Yêu cầu**:
  1. Chuyển rollback ra thư mục không được auto-apply, ví dụ `supabase/rollback/` hoặc `scripts/rollback-rls-security-audit-cycle-2.sql`, và cập nhật §1, §5, Bước 8.
  2. Nội dung rollback phải ghi rõ, không viết kiểu "khôi phục nếu cần": `GRANT EXECUTE` trả lại đúng như hiện trạng introspect được, cùng nguyên văn 5 `CREATE POLICY` từ `20260625_add_personas.sql:24-27` và `20260626_add_premade_personas.sql:5`.

**[MAJOR]**

- **M9 (còn lại) — Inventory endpoint vẫn thiếu request mount-time, nên guard fail-closed làm spec đỏ tất định.**
  - `GET /api/projects`: `Sidebar.tsx:200-202` gọi khi mount, cả ở `/` và `/images`. Plan chỉ đặt mock này trong `mock-projects.ts` cho chặng 5. Cần đăng ký từ đầu trong `authedPage`, trả `{ projects: [], tier, limits }`.
  - `GET /api/files?conversationId=conv-e2e-123`: `ChatApp.tsx:395` và `InputForm.tsx:73` qua `useFiles` (`useFiles.ts:37-38`) sau khi chọn conversation.
  - `GET /api/auth/session` trong `auth-flow.spec.ts`: `<SessionProvider>` bọc mọi trang (`providers.tsx:21`), nhưng spec này không dùng `authedPage`. Cần mock session rỗng (unauthenticated).
  - Shape payload chưa chốt: `/api/user/allowed-models` phải là `{ allowed_models: string[], features }` (`useAllowedModels.ts:27-29`), đồng thời phải chứa model chat mặc định. Mock `batch-gen-quota` `{remaining,total}` thiếu `maxBatchSize` nên bị bỏ qua (`useImageGenStudio.ts:155`); cần dùng `satisfies BatchQuotaInfo` (`ControlPanel.tsx:55`).
  - **Yêu cầu**: thêm bước record mode (chạy guard ở chế độ ghi nhận cho `/auth/signin`, `/`, `/images`, rồi chốt bảng inventory trước khi viết spec), như đã yêu cầu ở Run 3.
- **M12 (còn lại) — Gate negative probe chưa thực thi được.**
  - Probe gọi PostgREST bằng role `anon` cần anon key của project live, nhưng plan không khai báo biến nào (ví dụ `SUPABASE_ANON_KEY`) trong `env.local.example` hoặc `docs/security.md`, và cũng không có cơ chế fail-fast khi thiếu.
  - `tsx` không có trong `devDependencies`/`node_modules/.bin`, nên `npx tsx` sẽ tải một bản không ghim phiên bản lúc chạy. Cần thêm `tsx` vào `devDependencies` hoặc viết probe bằng `.mjs` chạy bằng `node`.
  - Chưa có bước apply migration rõ ràng. Thứ tự bắt buộc là: Bước 6 introspect → **apply qua SQL Editor** → chạy probe → ghi kết quả vào báo cáo. Hiện Bước 7 chỉ "tạo file".
- **M14 — `use.baseURL` không theo cổng 3100, lớp cách ly môi trường bị vô hiệu một cách im lặng.** `[SRC]` `playwright.config.ts:3-4,14` tính `BASE_URL` từ `process.env.PORT || 3000` trong process runner. Bước 11 chỉ đổi `webServer.url`. **Yêu cầu**: dùng một hằng `E2E_BASE_URL = "http://127.0.0.1:3100"` cho cả `use.baseURL` lẫn `webServer.url`, và không đọc `process.env.PORT` của shell (timeline 3). Đây là control của rủi ro S5 xếp hạng **Cao** (mục 4.5.4).

**[MINOR]**

- **m13** — Nhánh CI `npm run start` cần `next build` trước. `webServer.env` thiếu `GEMINI_API_KEY` và `DATA_ENCRYPTION_KEY` (≥32 ký tự), trong khi `env.ts:20` throw ở production và `auth.ts:2` import env, nên Server Action sẽ crash. Có thể cần thêm `AUTH_TRUST_HOST=true` cho `next start`. Ngay cả ở local, dev server cổng 3100 vẫn nạp `GEMINI_API_KEY` thật từ `.env.local`, nên cần đặt dummy. Ngoài ra `ci.yml` chưa chạy E2E: plan cần nói rõ là có thêm job hay không.
- **m14** — Bước 11 chưa liệt kê `grepInvert: /@online/`. Test 4 offline: `onClick={() => handleGoogleSignIn()}` (`signin/page.tsx`) không await/catch, nên khi Server Action lỗi sẽ sinh `unhandledrejection` → `pageerror`. Test 4 không được dùng assertion `pageErrors` rỗng, hoặc phải kỳ vọng lỗi này. Trên máy online, Test 4 vẫn redirect thật sang Google, nên mọi test auth cần `page.route("https://accounts.google.com/**", r => r.abort())`.
- **m15** — Bước 6/7 cần ghi quy tắc: nếu introspection live trả thêm hàm `prosecdef` nào ngoài 4 hàm trong repo, phải bổ sung vào migration trước khi apply (yêu cầu B4.3 của Run 3). Nên dùng schema pgvector thực tế lấy từ `pg_extension` thay vì giả định `extensions`.
- **m16** — Fixture phải dùng `import type { ProjectLimits }`, vì `projectStore.ts` nạp `zustand/middleware` `persist`. Khi thêm override `protobufjs` phải gộp với `"uuid": "^11.1.1"` đang có (`package.json:114-116`), không ghi đè. Mock fetch cần reject ngay nếu `init.signal.aborted === true` trước khi stream (yêu cầu M13 Run 3).
- **m17** — `assertNoUnhandledRequests()` chỉ đặt ở "cuối spec" (Bước 18). Nên chuyển vào teardown của fixture `authedPage` (sau `use(page)`), để mọi test, kể cả test Stop/Abort, đều được kiểm tra.

#### Việc cần làm cho Revision 4

1. **B5**: chuyển rollback ra khỏi `supabase/migrations/`; viết nội dung rollback tường minh.
2. **M9**: thêm bước record mode; đăng ký `GET /api/projects` và `GET /api/files?conversationId=*` ngay trong `authedPage`; mock session rỗng cho `auth-flow.spec.ts`; chốt shape `allowed-models` và `batch-gen-quota` bằng `satisfies`.
3. **M12**: khai báo anon key (env doc + fail-fast), thêm `tsx` vào `devDependencies` (hoặc dùng `.mjs`), thêm bước apply migration giữa introspect và probe.
4. **M14**: đồng bộ `use.baseURL` với `webServer.url` qua một hằng duy nhất `http://127.0.0.1:3100`.
5. Xử lý m13–m17 trong cùng đợt.

**Trạng thái**: `[CHANGES_REQUESTED]` — Code freeze tiếp tục có hiệu lực. Không cấp thẻ phê duyệt cho Revision 3.

### Audit Run 5

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 4
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 2 `[MAJOR]`, 5 `[MINOR]`

#### Kiểm chứng lỗi cũ (Audit Run 4 → Revision 4)

| ID  | Trạng thái  | Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :-- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B5  | ✅ Đã sửa   | Rollback đã chuyển sang `database-migrations/rollback/`. `[CMD]` `ls supabase/` → chỉ có `migrations/`, không có `config.toml`; grep `database-migrations` trên `*.js/*.ts/*.yml` → chỉ `scripts/run-migration*.ts` (hard-code `001_admin_system.sql`) và `.agents/scripts/code-freeze-guard.js:277`. Không có cơ chế nào tự áp dụng thư mục này. `[SRC]` `database-migrations/README.md`: quy trình thủ công qua SQL Editor. Bước 8 đã ghi rõ nội dung rollback (GRANT cho 4 hàm, 5 `CREATE POLICY` nguyên văn).                                                                     |
| M9  | ⚠️ Một phần | Đã bổ sung đúng 3 request mount-time. `[SRC]` `projectStore.ts:82-92` đọc `data.data.{projects,tier,limits}`, khớp mock. `useFiles.ts:27` chấp nhận `{ files: [] }`. `useAllowedModels.ts:27-29` đọc `json.data.allowed_models`, và mock có `DEFAULT_MODEL = "gemini-2.5-flash"` (`modelRegistry.ts:4`). `useImageGenStudio.ts:154-155` đọc `json.data.maxBatchSize`, mock khớp `BatchQuotaInfo` (`ControlPanel.tsx:55-59`). **Tuy nhiên** các mock của luồng chat không còn được bước nào trong §6 đăng ký, và bước record mode chỉ có ở §1, không có trong §6. Xem **M9** bên dưới. |
| M12 | ✅ Đã sửa   | Đã khai báo anon key và có fail-fast (Bước 9). `tsx@4.19.3` đã có trong Bước 2 (`[CMD]` `npm view tsx@4.19.3 version` → `4.19.3`). Thứ tự introspect → apply qua SQL Editor → probe → báo cáo đã có ở §1. `[CMD]` `ls env.local.example` → tồn tại (`:48-52` hiện chưa có anon key, đúng như `[MODIFY]` đã liệt kê).                                                                                                                                                                                                                                                                  |
| M14 | ✅ Đã sửa   | Bước 11 dùng một hằng `E2E_BASE_URL` cho cả `use.baseURL` và `webServer.url`. `[SRC]` `package.json:6` `"dev": "next dev"` không ép `-p`, nên `PORT=3100` có hiệu lực. `[SRC]` `node_modules/playwright/lib/runner/index.js:859-861`: `env = { ...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env, ...options.env }`, nên dummy env ghi đè được env của shell.                                                                                                                                                                                                                          |
| m13 | ⚠️ Một phần | Dummy `GEMINI_API_KEY` và `DATA_ENCRYPTION_KEY` (34 ký tự ≥ 32, `[SRC]` `envValidation.ts:31`) cùng `AUTH_TRUST_HOST` đã có. Nhánh CI `npm run start` vẫn thiếu bước `next build`, và plan vẫn chưa nói `ci.yml` có chạy E2E hay không. Xem m21.                                                                                                                                                                                                                                                                                                                                      |
| m14 | ✅          | Đã có `grepInvert: /@online/`, route abort Google cho mọi test auth, và Test 4 không còn bắt buộc `pageErrors` rỗng.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| m15 | ✅          | Bước 6 đã có quy tắc "bổ sung mọi hàm `prosecdef`" và truy vấn schema pgvector từ `pg_extension`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| m16 | ✅          | Có `import type`, gộp override với `uuid` (`[SRC]` `package.json:114-116`), mock kiểm tra `signal.aborted` trước khi stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| m17 | ✅          | `assertNoUnhandledRequests` đã nằm trong teardown của `authedPage`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

#### Baseline đã xác minh (Run 5)

| Hạng mục                                              | Bằng chứng                                                                                                                                                                                                                                                                                 | Kết quả                             |
| :---------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| Type-check                                            | `[CMD]` `npm run type-check` → exit 0                                                                                                                                                                                                                                                      | ✅                                  |
| Phiên bản mục tiêu tồn tại                            | `[CMD]` `npm view`: `next@16.4.0`, `eslint-config-next@16.4.0`, `next-auth@5.0.0-beta.32` (dep `@auth/core` = `0.41.3`), `vitest`/`@vitest/ui`/`@vitest/coverage-v8@4.1.11`, `protobufjs@7.6.5`, `tsx@4.19.3` → tồn tại đủ                                                                 | ✅                                  |
| Vitest không quét spec Playwright                     | `[SRC]` `vitest.config.ts:11` `exclude: ["tests/e2e/**", ...]`                                                                                                                                                                                                                             | ✅                                  |
| Wire format SSE                                       | `[SRC]` `useChatStreamController.ts:630-652`: `token` → `data.t`, `thinking` → `data.thinking`, `meta`                                                                                                                                                                                     | ✅ Khớp §2                          |
| ThinkingBlock                                         | `[SRC]` `BubbleHelpers.tsx:71` `useState(true)` (thu gọn), `:86` `aria-expanded={!isCollapsed}`                                                                                                                                                                                            | ✅ Khớp TC-E2E-03                   |
| Bug i18n                                              | `[SRC]` `CreateProjectModal.tsx:227` vẫn là `t("createProject")`; `vi.ts:657`/`en.ts:648` có `createProjectBtn`                                                                                                                                                                            | ✅ Bước 4 đúng                      |
| Các bảng bị REVOKE chỉ được truy cập qua service role | `[CMD]` grep `.from("personas"\|"research_tasks"\|"daily_*_counts")` → `admin/personas/route.ts`, `deep-research/[taskId]/stream/route.ts`, `limits.ts`, `personas.ts`, `researchService.server.ts`, đều dùng `getSupabaseAdmin`. Không có `createBrowserClient`/anon key nào trong `src/` | ✅ Migration không làm vỡ tính năng |
| Request mount-time khác trên `/`                      | `[SRC]` `GemQuickSwitch.tsx:25-27` và `PersonaQuickSwitch.tsx:28-30` chỉ fetch khi `open === true`                                                                                                                                                                                         | ✅ Không cần mock thêm              |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả            | Bằng chứng chính                                                                                                                                                                                                                                                                                                                                                                                                        |
| :--------------------------------- | :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **FAIL**           | `[CMD]` Type-check xanh, phiên bản mục tiêu tồn tại. Nhưng gate `npm audit --omit=dev --audit-level=high` (Bước 2, Bước 20, Cổng 1) **không đạt được** với cơ chế "chỉ `npm install`" của plan: còn 7 advisory High trong cây production mà §4 không liệt kê (M15).                                                                                                                                                     |
| **S2** Runner Lifecycle & Teardown | **PASS**           | `[SRC]` Ngữ nghĩa abort khớp `useChatStreamController.ts:740-745` (đã xác minh ở Run 4). Có kiểm tra `signal.aborted` sớm. Teardown nằm trong fixture. Mock là per-page nên cô lập giữa các test.                                                                                                                                                                                                                       |
| **S3** Database & Temporal         | **PASS**           | B5 đã đóng (bảng ở trên). 4 chữ ký RPC đã khớp ở Run 4. Mọi caller dùng service role (`[CMD]` ở trên), nên REVOKE không làm vỡ runtime. Rollback nằm ngoài luồng tự động.                                                                                                                                                                                                                                               |
| **S4** Cross-Task State Flow       | **FAIL**           | `[CMD]` Probe glob của Playwright 1.62.1 (`globToRegexPattern` trong `playwright-core/lib/coreBundle.js`): `**/api/conversations` **không** khớp `/api/conversations?id=conv-e2e-123` (→ `false`); `**/api/files**` có khớp `?conversationId=…` (→ `true`). Luồng chat gọi `GET ?id=` (`useChatStreamController.ts:304,380`) và `POST /api/messages` (`:168`), nhưng không bước nào trong §6 đăng ký hai mock này (M9). |
| **S5** Security Boundary           | **PASS** (kèm m19) | M14 đã đóng (`[SRC]` ở trên). Guard catch-all và teardown đã có. Lưu ý: `.env.local` vẫn nạp các key không bị ghi đè vào server cổng 3100 (m19).                                                                                                                                                                                                                                                                        |
| **S6** External Resilience         | **PASS**           | Tag `@online`, `grepInvert`, route abort Google, và Test 4 offline chấp nhận lỗi Server Action.                                                                                                                                                                                                                                                                                                                         |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: Gate audit dependency (trục: thất bại của chính bước kiểm soát)
T1: Bước 2 bump next/next-auth/vitest + override protobufjs, chạy `npm install` (không `audit fix`)
T2: npm giữ nguyên các transitive đã lock nếu vẫn thỏa range: postcss@8.5.6 (@tailwindcss/postcss), nanoid@3.3.11,
    brace-expansion@1.1.12/2.0.2 + minimatch@3.1.2/9.0.5 (exceljs→archiver, @google/genai→rimraf), ws@8.19.0, source-map-js@1.2.1;
    sharp có thể resolve 0.35.4 (range ^0.35.4 của next@16.4.0, vẫn trong ngưỡng lỗ hổng <=0.35.5-rc.1)
T3: `npm audit --omit=dev --audit-level=high` → exit 1
Kết cục: Gate Bước 2/Bước 20 đỏ. Người thực thi phải tự ứng biến, có thể gõ `npm audit fix --omit=dev`;
         [CMD] dry-run lệnh này cho thấy npm GỠ BỎ toàn bộ devDependencies (@vitest/*, @typescript-eslint/*, @testing-library/*…) → LỖI (MAJOR, M15).
```

```
Cơ chế: Fail-closed guard × mock luồng chat không có chủ sở hữu (trục: TOCTOU giữa inventory và request thực tế)
T1: authedPage đăng ký guard + `GET **/api/conversations` (list) theo Bước 16
T2: Chặng 2 gửi prompt → POST /api/conversations (glob list khớp URL, nhưng handler list trả shape của list, không phải conv-e2e-123)
T3: Stream xong → GET /api/conversations?id=conv-e2e-123 → glob list không khớp (probe → false) → catch-all 501;
    test Stop → POST /api/messages → 501
Kết cục: teardown assertNoUnhandledRequests() FAIL tất định ở TC-E2E-03 → LỖI (MAJOR, M9).
```

- **Trục đồng thời**: mock per-page và `fullyParallel` → AN TOÀN. REVOKE có hiệu lực ngay, caller dùng service role → AN TOÀN.
- **Trục serverless**: N/A. E2E chạy server local, migration không có state in-memory.

#### Phân loại lỗi

**[MAJOR]**

- **M15 — Gate `npm audit --omit=dev --audit-level=high` không đạt được theo đúng các bước plan mô tả.** `[CMD]` `npm audit --omit=dev --json` hiện báo 4 critical và 7 high. 4 critical (`next`, `next-auth`/`@auth/core`, `protobufjs`) đã được Bước 2 xử lý. Còn 7 high thì §4 không liệt kê, và Bước 2 không có cơ chế nâng cấp. `[CMD]` `npm ls … --omit=dev` cho thấy:
  - `postcss@8.5.6` + `nanoid@3.3.11` qua `@tailwindcss/postcss@4.1.18` (production dependency). `next@16.4.0` tự pin `postcss@8.5.23`, nhưng bản postcss của Tailwind thì không đổi.
  - `sharp@0.34.5` qua `next`. `next@16.4.0` khai `sharp: ^0.35.4`, mà ngưỡng lỗ hổng là `<=0.35.5-rc.1`, nên phải bảo đảm lock ra `>=0.35.5`.
  - `brace-expansion`/`minimatch` qua `exceljs→archiver` và `@google/genai→google-auth-library→gaxios→rimraf→glob`.
  - `ws@8.19.0` (§4 ghi sai là `8.20.1`) và `source-map-js@1.2.1`.
  - `npm install` không tự nâng các transitive đã lock khi chúng vẫn thỏa range.
  - **Yêu cầu**:
    1. Bổ sung 5 package (`postcss`, `nanoid`, `sharp`, `brace-expansion`, `minimatch`) vào §4, sửa phiên bản `ws` cho đúng.
    2. Bước 2 phải chỉ rõ cơ chế nâng cấp: `npm audit fix` **không kèm `--force` và không kèm `--omit=dev`**, hoặc `npm update <pkg>` có chỉ định, hoặc thêm `overrides` (gộp với `uuid`/`protobufjs`).
    3. Ghi rõ cấm `npm audit fix --omit=dev`, vì `[CMD]` dry-run cho thấy lệnh này gỡ toàn bộ devDependencies.
    4. Nếu có advisory nào không vá được mà không breaking (ví dụ `minimatch@3` qua `archiver@5` của `exceljs`), phải đưa vào mục Accepted Remaining Risks, kèm lý do khả năng khai thác (pattern có phải do người dùng kiểm soát không), và hạ gate tương ứng một cách tường minh.
- **M9 (còn lại) — Mock luồng chat không có bước nào chịu trách nhiệm đăng ký, và record mode chưa thành bước thực thi.**
  - TC-E2E-03 kỳ vọng `POST /api/conversations` → `conv-e2e-123`, `GET /api/conversations?id=conv-e2e-123` và `POST /api/messages`. Tuy nhiên Bước 14 chỉ hook `window.fetch` cho `/api/chat-stream`, Bước 15 chỉ có `conv-image-123`, còn Bước 16 chỉ có `GET /api/conversations` (list). `[CMD]` probe glob xác nhận list glob không khớp URL có `?id=`. §9 S2 nhắc tới "endpoint inventory", nhưng §6 không có artifact inventory nào.
  - **Yêu cầu**:
    1. Gán các mock này cho một file cụ thể (ví dụ `mock-chat.ts` mới, hoặc mở rộng `mock-ai-stream.ts`) trong §5/§6.
    2. Handler `**/api/conversations**` phải rẽ nhánh theo `request.method()` và `?id=`.
    3. Thêm một bước đánh số cho record mode, ví dụ `setupNetworkGuard(page, { mode: "record" | "enforce" })` ở Bước 12, chạy trên `/auth/signin`, `/`, `/images`, sau đó chốt bảng inventory (method, URL glob, helper sở hữu, payload) trước Bước 17.

**[MINOR]**

- **m18** — Mock session chưa đăng nhập nên trả `null`, không phải `{}`. `[SRC]` `next-auth/react.js:331-335` coi mọi giá trị truthy là `"authenticated"`, nên `{}` sẽ bị hiểu là đã đăng nhập. Server thật trả `body: null` (`@auth/core/lib/actions/session.js:7`). Hiện chưa gây lỗi, vì `signin/page.tsx` không dùng `useSession`. Nhưng `{}` không mô phỏng đúng trạng thái chưa đăng nhập.
- **m19** — `[CMD]` `.env.local` còn các key không bị ghi đè: `NEXTAUTH_URL`, `WHITELIST_EMAILS`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `ATTACHMENTS_CRON_SECRET`… Next.js không ghi đè biến đã có trong `process.env`, nên chỉ những key được liệt kê mới thành dummy. Nên thêm `NEXTAUTH_URL`/`AUTH_URL: E2E_BASE_URL` (nếu không, `redirect_uri` ở Test 3 sẽ trỏ về URL trong `.env.local`), và đặt dummy hoặc rỗng cho các provider key. Ngoài ra, với `reuseExistingServer: !CI`, nếu cổng 3100 đã có server chạy env live thì Playwright sẽ dùng lại server đó. Nên ghi rõ điều này trong báo cáo hoặc README E2E.
- **m20** — TC-SEC-01: PostgREST trả `42501` kèm **HTTP 401** cho role `anon` (403 chỉ áp dụng cho role đã xác thực). Probe chỉ nên assert `code === "42501"`, không assert 403. Khi gọi RPC phải truyền đúng tên tham số, vì sai tham số sẽ nhận `PGRST202` thay vì `42501`.
- **m21** — Còn lại từ m13: nhánh `process.env.CI ? "npm run start"` cần `next build` trước (ví dụ `"npm run build && npm run start"`), và plan cần nói rõ có thêm job E2E vào `.github/workflows/ci.yml` hay không.
- **m22** — Cột "Phiên Bản Hiện Tại" ở §4 cần đối chiếu lại với `npm ls`. Ví dụ `ws` thực tế là `8.19.0`, và `@supabase/supabase-js` đã cài là `2.91.0`.

#### Việc cần làm cho Revision 5

1. **M15**: liệt kê đủ 7 advisory High còn lại. Chỉ rõ cơ chế nâng cấp an toàn (`npm audit fix` không kèm `--force`/`--omit=dev`, `npm update` có chỉ định, hoặc `overrides`). Cấm `--omit=dev` khi fix. Đưa phần không vá được vào Accepted Risks và điều chỉnh gate cho tường minh.
2. **M9**: gán chủ sở hữu cho các mock `POST /api/conversations`, `GET /api/conversations?id=conv-e2e-123` và `POST /api/messages`, có rẽ nhánh theo method/query. Đưa record mode thành bước đánh số và thêm bảng inventory.
3. Xử lý m18–m22 trong cùng đợt (không chặn).

**Trạng thái**: `[CHANGES_REQUESTED]` — Code freeze tiếp tục có hiệu lực. Không cấp thẻ phê duyệt cho Revision 4.

### Audit Run 6

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 5
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 3 `[MAJOR]`, 6 `[MINOR]`

#### Kiểm chứng lỗi cũ (Audit Run 5 → Revision 5)

| ID  | Trạng thái   | Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :-- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M15 | ❌ Chưa đạt  | Đã thêm `overrides` và cấm `npm audit fix --omit=dev`/`--force`. Tuy nhiên `[CMD]` dry-run Bước 2 trong thư mục tạm (bản sao `package.json` + `package-lock.json`, áp đúng các chỉnh sửa của plan) → `npm install` **exit 1, `EOVERRIDE`: "Override for postcss@^8.5.6 conflicts with direct dependency"** (`package.json:103` khai `postcss` là devDependency trực tiếp). Accepted Risk cho `minimatch`/`brace-expansion` dựa trên tiền đề sai. Xem **M16**, **M15** bên dưới. |
| M9  | ⚠️ Một phần  | Đã sửa glob: `[SRC]` `playwright-core/lib/coreBundle.js:4451`, một dấu `*` được dịch thành `([^/]*)`, nên `**/api/conversations*` khớp `?id=conv-e2e-123` (không có `/`). Đã có chủ sở hữu `mock-chat.ts`, rẽ nhánh theo method/`?id=`, Bước 12 record mode và bảng Inventory. **Nhưng** payload `POST /api/conversations` sai shape, nên luồng chat vẫn hỏng tất định. Xem **M17**.                                                                                            |
| m18 | ✅           | Bước 13 dùng `body: JSON.stringify(null)`.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| m19 | ✅           | `[SRC]` `node_modules/@next/env/dist/index.js` `processEnv`: chỉ nạp key từ `.env.local` khi `typeof l[t]==="undefined"` (l là bản chụp `process.env` ban đầu). Giá trị `""` khác `undefined`, nên `OPENROUTER_API_KEY: ""` đúng là chặn được rò rỉ. Đã có `NEXTAUTH_URL`/`AUTH_URL` và ghi chú về `reuseExistingServer`.                                                                                                                                                       |
| m20 | ✅ (kèm m25) | Chỉ assert `code === "42501"`. Tên tham số khớp `[SRC]` `database-migrations/012_increment_daily_message_count.sql:4-6` (`p_user_id`, `p_date`) và `match_project_knowledge(p_project_id, query_embedding VECTOR(3072), match_threshold, match_count)`. Còn sót `get_daily_usage` (m25).                                                                                                                                                                                        |
| m21 | ✅ (kèm m27) | Đã có `npm run build && npm run start`, và nói rõ `ci.yml` chỉ là reference, không sửa.                                                                                                                                                                                                                                                                                                                                                                                         |
| m22 | ✅ (kèm m26) | `ws 8.19.0` và `supabase-js 2.91.0` đã đúng. Mục tiêu của `nanoid` vẫn là phiên bản có lỗ hổng (m26).                                                                                                                                                                                                                                                                                                                                                                           |

#### Baseline đã xác minh (Run 6)

| Hạng mục                                    | Bằng chứng                                                                                                                                                                                                                                                            | Kết quả                                |
| :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| Audit production hiện tại                   | `[CMD]` `npm audit --omit=dev --json` → `critical 4, high 7, moderate 5`                                                                                                                                                                                              | Khớp Run 5                             |
| Bước 2 nguyên văn                           | `[CMD]` dry-run `npm install --package-lock-only --ignore-scripts` với overrides của plan → `EOVERRIDE`, exit 1                                                                                                                                                       | ❌ M16                                 |
| Bước 2 đã sửa `postcss`                     | `[CMD]` devDependency `postcss: ^8.5.23` + override `"postcss": "$postcss"` → install exit 0. `npm update postcss sharp ws source-map-js` → gate `npm audit --omit=dev --audit-level=high` **exit 1** (còn `minimatch` 3.1.2/9.0.5 và `brace-expansion` 1.1.12/2.0.2) | ❌ M15                                 |
| Bản vá cùng major tồn tại                   | `[CMD]` `npm view`: `minimatch@3.1.5`, `minimatch@9.0.9`, `brace-expansion@1.1.21`, `brace-expansion@2.1.7`, `nanoid@3.3.20`. Advisory: minimatch `<=3.1.3 \|\| 9.0.0-9.0.6`, brace-expansion `<=1.1.20 \|\| 2.0.0-2.1.6`                                             | Có bản vá non-breaking                 |
| Thêm `npm update minimatch brace-expansion` | `[CMD]` → gate **exit 0**, `{"high":0,"critical":0,"moderate":3}` (còn lại chỉ `mammoth`/`argparse`/`sprintf-js` moderate, đã nằm trong Accepted Risk #2). Cây sau cập nhật: `minimatch@3.1.5 ×3`, `9.0.9`, `brace-expansion@1.1.21`, `2.1.7 ×2`, `nanoid@3.3.20`     | ✅ Gate đạt được mà không cần ngoại lệ |
| Cách dùng `exceljs`                         | `[CMD]` `grep -rn exceljs src` → chỉ có `src/lib/features/files/documentParsers.ts:110` (`await import("exceljs")`) để **parse file XLSX do người dùng upload**. `grep exportToExcel src` → **0 kết quả**                                                             | ❌ Lý do của Accepted Risk sai         |
| Server-side auth gate                       | `[CMD]` `ls src/middleware.ts src/proxy.ts middleware.ts proxy.ts` → không tồn tại                                                                                                                                                                                    | ✅ (như Run 4)                         |
| Type-check                                  | `[CMD]` `npm run type-check` → **exit 1**: `useThinkingLevel.ts(121,12) TS2367 ... '"off"'`. `git diff --stat` cho thấy lỗi đến từ phần việc GLM-5.2 chưa commit (`useThinkingLevel.ts`, `modelRegistry.ts`), không phải từ plan này                                  | ⚠️ m28                                 |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả  | Bằng chứng chính                                                                                                                                                                                                                                                                               |
| :--------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **FAIL** | `[CMD]` Bước 2 nguyên văn → `npm install` `EOVERRIDE` (M16). Sau khi sửa `postcss`, gate Bước 2/20/Cổng 1 vẫn exit 1 vì `minimatch`/`brace-expansion` (M15). Type-check của working tree hiện đang đỏ do công việc song song (m28).                                                            |
| **S2** Runner Lifecycle & Teardown | **PASS** | Ngữ nghĩa abort và kiểm tra `signal.aborted` sớm đã được xác minh ở Run 4–5. Teardown `assertNoUnhandledRequests` nằm trong fixture. `syncPartialMessage` không vỡ khi shape sai (`useChatStreamController.ts:178-205` dùng `savedMsg?.id \|\| m.id`). Shape chưa đúng thực tế được ghi ở m23. |
| **S3** Database & Temporal         | **PASS** | Chữ ký 4 RPC khớp migration (`[SRC]` ở trên). Rollback nằm ngoài luồng tự động (Run 5). Mọi caller dùng service role (Run 5).                                                                                                                                                                  |
| **S4** Cross-Task State Flow       | **FAIL** | `[SRC]` `useConversation.ts:388` đọc `json.data?.conversation \|\| json.conversation`. Route thật trả `success({ conversation })` (`api/conversations/route.ts:140`). Mock của plan trả `data: { id, ... }`, nên `createConversation` trả `null` (M17).                                        |
| **S5** Security Boundary           | **PASS** | m19 đã đóng (`[SRC]` `@next/env`). Guard catch-all 501 và teardown đã có. Không có middleware server-side.                                                                                                                                                                                     |
| **S6** External Resilience         | **PASS** | `@online` + `grepInvert`, route abort Google, và Test 4 offline (giữ nguyên từ Run 5).                                                                                                                                                                                                         |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: Gate audit dependency (trục: thất bại của chính bước kiểm soát)
T1: Người thực thi áp đúng Bước 2: overrides { ..., "postcss": "^8.5.23" }, devDependency postcss vẫn "^8.5.6"
T2: npm install → [CMD] EOVERRIDE "Override for postcss@^8.5.6 conflicts with direct dependency", exit 1
T3: Giả sử đã tự sửa postcss → npm update postcss sharp ws source-map-js → gate audit vẫn exit 1 (minimatch/brace-expansion)
Kết cục: Bước 2 dừng ngay ở install. Nếu vượt qua được thì gate vẫn đỏ, và plan chỉ đưa ra "ngoại lệ" mơ hồ dựa trên
         lý do sai (exportToExcel không tồn tại; exceljs parse XLSX của user) → LỖI (MAJOR, M15/M16)
```

```
Cơ chế: Tạo hội thoại trong luồng chat (trục: TOCTOU giữa contract mock và parser của client)
T1: Chặng 2 bấm Send → ensureConversationExists() (useChatStreamController.ts:431-443) → createConversation → POST /api/conversations
T2: mock-chat.ts trả { success: true, data: { id: "conv-e2e-123", ... } }
T3: useConversation.ts:388 đọc json.data?.conversation → undefined → `if (!backendConv?.id) return null` (không toast)
T4: convId = null → chat-stream vẫn chạy (fetch mock trong trình duyệt) → reloadMessagesAfterStream(null) return sớm (:301)
Kết cục: không bao giờ có GET /api/conversations?id=conv-e2e-123, URL/selectedConversationId không đổi.
         Mọi assert gắn với conv-e2e-123 trong TC-E2E-03 FAIL tất định. Image Studio dùng chung createConversation
         (useImageGenStudio.ts:203,226), nên conv-image-123 trong TC-E2E-04 cũng hỏng → LỖI (MAJOR, M17)
```

- **Trục đồng thời**: mock là per-page, REVOKE có hiệu lực ngay, caller dùng service role → AN TOÀN (giữ nguyên từ Run 5).
- **Trục serverless**: N/A. E2E chạy server local, migration không có state in-memory.

#### Phân loại lỗi

**[MAJOR]**

- **M16 — Override `postcss` xung đột với dependency trực tiếp, khiến `npm install` thất bại.** `[CMD]` dry-run → `EOVERRIDE`. npm không cho phép override một package mà dự án đã khai báo trực tiếp với range khác.
  - **Yêu cầu**:
    1. Bước 2 nâng devDependency thành `"postcss": "^8.5.23"`.
    2. Trong `overrides`, dùng tham chiếu `"postcss": "$postcss"` thay vì một range riêng. `[CMD]` biến thể này cho install exit 0.
    3. Cập nhật §4, §5 (`package.json [MODIFY]`) và rủi ro S1 ở §9 cho khớp.
- **M15 (còn lại) — Accepted Risk cho `minimatch`/`brace-expansion` không có cơ sở, và gate không tất định.**
  - (a) Có bản vá cùng major: `minimatch@3.1.5`/`9.0.9`, `brace-expansion@1.1.21`/`2.1.7`. `[CMD]` `npm update minimatch brace-expansion` cho gate exit 0, nên luận điểm "phải lên v9/v10, làm vỡ `archiver@5`" là sai.
  - (b) `exceljs` không dùng cho admin `exportToExcel` (hàm này không tồn tại). Nó parse file XLSX do người dùng upload (`documentParsers.ts:110`), nên phân tích khả năng khai thác dựa trên dữ kiện sai.
  - (c) Accepted Risk bỏ sót nhánh `minimatch@9.0.5`/`brace-expansion@2.0.2` (qua `@google/genai`).
  - (d) Bước 2, Bước 20 và Cổng 1 vừa chạy `npm audit --audit-level=high` (sẽ exit 1), vừa ghi "0 Exploitable High, có ngoại lệ". Không có cơ chế lọc nào tất định.
  - **Yêu cầu**:
    1. Đổi lệnh thành `npm update postcss sharp ws source-map-js minimatch brace-expansion nanoid`.
    2. Xóa Accepted Risk #3 ở §1, §4 và Bước 19.
    3. Đặt gate tuyệt đối: `npm audit --omit=dev --audit-level=high` **phải exit 0**, không có ngoại lệ.
    4. Không dùng `overrides` cho `minimatch`/`brace-expansion`, vì một range override duy nhất sẽ ép cả hai major về cùng một nhánh.
- **M17 (M9 còn lại) — Payload mock `POST /api/conversations` sai contract, làm hỏng TC-E2E-03 và TC-E2E-04.** Client đọc `json.data?.conversation` (`useConversation.ts:388`). API thật trả `success({ conversation })` (`api/conversations/route.ts:140`). Mock ở §1, Bước 14, bảng Inventory và Bước 15 (`conv-image-123`) đều trả `data: { id, ... }` (xem Timeline 2).
  - **Yêu cầu**:
    1. Sửa mọi mock POST thành `{ success: true, data: { conversation: { id, title, model, created_at, updated_at, ... } } }`, có kiểu tham chiếu tới type `Conversation` của backend qua `import type` + `satisfies` (giống `ProjectLimits`).
    2. Thêm assert trong TC-E2E-03 rằng URL/`selectedConversationId` chuyển sang `conv-e2e-123`, để bắt các hồi quy contract kiểu này.

**[MINOR]**

- **m23** — Mock `POST /api/messages` nên trả đúng contract `{ success: true, data: { message: { id: "msg-partial-123", ... }, alreadyComplete: false } }` (`api/messages/route.ts:91-94`, client `useChatStreamController.ts:178-180`). Shape `{ messageId }` hiện tại không làm crash, nhưng không mô phỏng đúng.
- **m24** — Chủ sở hữu bị chồng: cả `mock-chat.ts` (Bước 14) và `mock-image-gen.ts` (Bước 15) cùng đăng ký `POST **/api/conversations*`, trái với bảng Inventory. Playwright chạy handler đăng ký sau trước. Cần quy định rõ:
  - mỗi handler gọi `route.fallback()` khi không khớp method/query, không bỏ treo request và không dùng `route.continue()`;
  - hoặc tham số hóa `mock-chat.ts` bằng `conversationId` thay vì đăng ký trùng.
- **m25** — Bước 9 liệt kê `get_daily_usage`, nhưng `[CMD]` grep trên `database-migrations/`, `supabase/` và `src/` → 0 kết quả, nên sẽ nhận `PGRST202`. Cần xóa. Ngoài ra, `query_embedding: "[]"` (0 chiều) cho `VECTOR(3072)` có thể bị pgvector báo lỗi input trước khi kiểm tra quyền EXECUTE, tùy thứ tự đánh giá. Nên dùng vector 3072 chiều toàn `0`, hoặc ghi rõ cách xử lý mã lỗi khác `42501`.
- **m26** — Mục tiêu `nanoid` ở §4 là `^3.3.11`, nhưng advisory áp dụng cho `<=3.3.17`. Thực tế `postcss@8.5.23` yêu cầu `nanoid ^3.3.16` và resolve ra `3.3.20` (`[CMD]`). Cần ghi mục tiêu `>=3.3.18`.
- **m27** — CI reference (§8.3):
  - thiếu `npx playwright install --with-deps chromium`;
  - `node-version: 20` lệch với `ci.yml` thật (`24`);
  - bước `npm run build` riêng cộng với `npm run build && npm run start` trong webServer khiến build hai lần, và lần build đầu chạy không có dummy env.
- **m28** — `[CMD]` Type-check của working tree hiện đỏ (`useThinkingLevel.ts:121` TS2367) do phần việc GLM-5.2 song song chưa commit. Đây không phải lỗi của plan. Tuy nhiên giả định baseline xanh ở §3.3 và Cổng 2 cần được kiểm tra lại: phải có `npm run verify` xanh trước khi bắt đầu Giai Đoạn A.

#### Việc cần làm cho Revision 6

1. **M16**: `postcss` devDependency `^8.5.23` + override `"$postcss"`.
2. **M15**: thêm `minimatch brace-expansion nanoid` vào `npm update`, xóa Accepted Risk #3, gate `npm audit --omit=dev --audit-level=high` phải exit 0 tuyệt đối.
3. **M17**: sửa payload mock `POST /api/conversations` (cả `conv-e2e-123` và `conv-image-123`) thành `data.conversation`, có `satisfies` theo type backend. Thêm assert chuyển hội thoại trong TC-E2E-03.
4. Xử lý m23–m28 trong cùng đợt (không chặn).

**Trạng thái**: `[CHANGES_REQUESTED]` — Code freeze tiếp tục có hiệu lực. Không cấp thẻ phê duyệt cho Revision 5.

### Audit Run 7

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 6
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 1 `[MAJOR]`, 3 `[MINOR]`

#### Kiểm chứng lỗi cũ (Audit Run 6 → Revision 6)

| ID  | Trạng thái   | Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                      |
| :-- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M16 | ✅           | §4, Bước 2 và §9 S1 đã đổi sang devDep `postcss: ^8.5.23` + override `"postcss": "$postcss"`. `[CMD]` dry-run trong thư mục tạm (áp **toàn bộ** chỉnh sửa Bước 1–2: bỏ `pg`/`playwright`, bump `next`/`eslint-config-next`/`next-auth`/`vitest*`, thêm `tsx`, overrides nguyên văn) → `npm install --package-lock-only --ignore-scripts` **exit 0**, không có `EOVERRIDE`. |
| M15 | ✅           | `[CMD]` `npm update postcss sharp ws source-map-js minimatch brace-expansion nanoid` exit 0, sau đó `npm audit --omit=dev --audit-level=high` **exit 0** (chỉ còn `3 moderate`, thuộc Accepted Risk #2). Accepted Risk #3 đã bị xóa ở §1, §4 và Bước 19. Không có override cho `minimatch`/`brace-expansion`. Mô tả `exceljs` đã được đính chính.                          |
| M17 | ⚠️ Một phần  | Shape runtime đã đúng: `data.conversation.id` khớp `useConversation.ts:386-388` và `api/conversations/route.ts:140`. Đã có assert chuyển hội thoại. **Nhưng** đoạn mã typed ở §1 và Bước 14 không biên dịch được (xem **M18**).                                                                                                                                            |
| m23 | ✅           | Mock `POST /api/messages` trả `data.message` + `alreadyComplete`.                                                                                                                                                                                                                                                                                                          |
| m24 | ✅ (kèm m31) | Route hội thoại do `mock-chat.ts` sở hữu, có tham số `conversationId` và gọi `route.fallback()`. `mock-image-gen.ts` không đăng ký lại.                                                                                                                                                                                                                                    |
| m25 | ✅           | Đã bỏ `get_daily_usage`. Probe dùng vector 3072 chiều toàn `0`.                                                                                                                                                                                                                                                                                                            |
| m26 | ✅           | Mục tiêu `nanoid` là `>=3.3.18`.                                                                                                                                                                                                                                                                                                                                           |
| m27 | ✅           | CI reference dùng `node-version: 24`, có `npx playwright install --with-deps chromium`, không còn build riêng.                                                                                                                                                                                                                                                             |
| m28 | ✅           | `[CMD]` `npm run type-check` hiện **exit 0** trên working tree. Pre-condition `npm run verify` xanh đã được ghi ở §3.3.                                                                                                                                                                                                                                                    |

#### Baseline đã xác minh (Run 7)

| Hạng mục                              | Bằng chứng                                                                                                                                                                                                                                                                            | Kết quả                                       |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------- |
| Bước 1–2 nguyên văn                   | `[CMD]` dry-run trong thư mục tạm: overrides `{"uuid":"^11.1.1","protobufjs":"^7.6.5","sharp":"^0.35.5","ws":"^8.21.0","source-map-js":"^1.2.2","postcss":"$postcss"}` → `update exit=0`, `install exit=0`, `audit exit=0`                                                            | ✅                                            |
| Type-check baseline                   | `[CMD]` `npm run type-check` (`tsc --noEmit`) → exit 0                                                                                                                                                                                                                                | ✅                                            |
| Phạm vi type-check                    | `[SRC]` `tsconfig.json` `include: ["**/*.ts", ...]`, chỉ `exclude: ["node_modules"]`. Nghĩa là `tests/e2e/**/*.ts` **nằm trong** `npm run type-check`, Cổng 2 và Bước 20                                                                                                              | Áp dụng cho M18                               |
| Module `@/types/database`             | `[CMD]` `ls src/types` → `chat.ts database.types.ts files.ts image-gen.ts next-auth.d.ts persona.ts projects.ts web-speech.d.ts`. Không có `database.ts`. `Conversation` được export tại `src/lib/features/chat/conversations.ts:57` (cũng là nguồn mà `useConversation.ts:6` import) | ❌ M18                                        |
| Probe biên dịch snippet M17           | `[CMD]` `tsc` trên bản sao nguyên văn snippet Bước 14 → `TS2307: Cannot find module '@/types/database'`. Khi đổi sang `@/lib/features/chat/conversations` → `TS2561: 'created_at' does not exist in type 'Partial<Conversation>'. Did you mean 'createdAt'?`                          | ❌ M18                                        |
| Cách client tiêu thụ trường thời gian | `[SRC]` `useConversation.ts:80-81` đọc `conv.createdAt`/`conv.updatedAt`. `conversations.ts:61,138` (`mapConversationRow`) trả camelCase cho route thật                                                                                                                               | Snake_case trong mock cũng sai so với runtime |
| URL sync                              | `[SRC]` `ChatApp.tsx:268` truyền `setSelectedConversationIdAndUrl` vào stream controller. `useUrlSync.ts:56-66` gọi `router.push(?id=...)`. `ensureConversationExists` (`useChatStreamController.ts:431-443`) gọi setter đó                                                           | Assert URL khả thi                            |
| Reload sau stream với `messages: []`  | `[SRC]` `useChatStreamController.ts:304-310` đọc `json.data.messages`. `messageMerge.ts:27-31`: khi remote rỗng thì giữ nguyên local                                                                                                                                                  | ✅ Bubble không bị xóa                        |
| Vị trí `BatchQuotaInfo`               | `[CMD]` grep → chỉ export tại `src/app/features/image-gen/components/ControlPanel.tsx:55`                                                                                                                                                                                             | m29                                           |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả            | Bằng chứng chính                                                                                                                                                                                                                                                                             |
| :--------------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **FAIL**           | Phần dependency đã PASS (`[CMD]` install/update/audit đều exit 0). Nhưng `mock-chat.ts` viết đúng theo plan sẽ làm `npm run type-check` exit ≠ 0: TS2307 + TS2561 (`[CMD]` probe), vì `tests/e2e` nằm trong `include` của `tsconfig.json` (`[SRC]`). Cổng 2 và Bước 20 sẽ đỏ tất định (M18). |
| **S2** Runner Lifecycle & Teardown | **PASS**           | Abort sớm/muộn và `AbortError` đã được xác minh ở Run 4–5. `syncPartialMessage` nhận `data.message` (m23). Teardown `assertNoUnhandledRequests` nằm trong fixture.                                                                                                                           |
| **S3** Database & Temporal         | **PASS**           | Chữ ký 4 RPC khớp migration (Run 6). Probe dùng vector 3072 chiều và đúng tên tham số. Rollback nằm ngoài `supabase/migrations/`.                                                                                                                                                            |
| **S4** Cross-Task State Flow       | **PASS** (runtime) | `[ADV]` Timeline 1 bên dưới: `data.conversation.id` → `setActiveId` → `setSelectedConversationIdAndUrl` → `?id=conv-e2e-123` → reload với `messages: []` không xóa local (`messageMerge.ts:30`). Lỗi kiểu dữ liệu được tính ở S1.                                                            |
| **S5** Security Boundary           | **PASS**           | Không đổi so với Run 6: guard catch-all 501, dummy env, provider keys rỗng (`@next/env` đã xác minh), không có middleware server-side.                                                                                                                                                       |
| **S6** External Resilience         | **PASS**           | `@online` + `grepInvert`, abort route Google, Test 4 offline.                                                                                                                                                                                                                                |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: Tạo hội thoại trong luồng chat (trục: TOCTOU giữa contract mock và parser của client)
T1: Chặng 2 bấm Send → ensureConversationExists() → createConversation → POST /api/conversations
T2: mock-chat.ts trả { success: true, data: { conversation: { id: "conv-e2e-123", ... } } }
T3: useConversation.ts:386 đọc json.data?.conversation → backendConv.id hợp lệ → setActiveId, rồi
    setSelectedConversationIdAndUrl → router.push("/?id=conv-e2e-123")
T4: stream done → reloadMessagesAfterStream("conv-e2e-123") → GET ?id= → data.messages = [] →
    mergeMessages([], local) trả local
Kết cục: URL chuyển sang ?id=conv-e2e-123, bubble giữ nguyên → AN TOÀN (M17 runtime đã đóng)
```

```
Cơ chế: Gate type-check (trục: thất bại của chính bước kiểm soát)
T1: Người thực thi chép nguyên văn snippet Bước 14 vào tests/e2e/helpers/mock-chat.ts
T2: Bước 20 / Cổng 2 → npm run type-check (tsc --noEmit, include "**/*.ts")
T3: [CMD] TS2307 '@/types/database'. Nếu tự sửa đường dẫn → TS2561 'created_at' không thuộc Partial<Conversation>
Kết cục: Gate verify đỏ tất định. Lưu ý: Playwright transpile bằng Babel và bỏ qua lỗi kiểu, nên
         `npm run test:e2e` vẫn có thể xanh và che giấu lỗi này → LỖI (MAJOR, M18)
```

- **Trục đồng thời**: mock là per-page, REVOKE có hiệu lực ngay, caller dùng service role → AN TOÀN (giữ nguyên từ Run 5–6).
- **Trục thất bại giữa chừng**: abort trong stream → `AbortError` → `POST /api/messages` có mock → AN TOÀN (Run 5–6).
- **Trục serverless**: N/A. E2E chạy server local, migration không có state in-memory.

#### Phân loại lỗi

**[MAJOR]**

- **M18 (M17 còn lại) — Đoạn mã typed của mock `POST /api/conversations` không biên dịch được, làm đỏ Cổng 2 và Bước 20.**
  - (a) `import type { Conversation } from "@/types/database"` (§1 dòng 41) trỏ tới một module không tồn tại → `[CMD]` TS2307. `Conversation` nằm ở `@/lib/features/chat/conversations` (`conversations.ts:57`).
  - (b) Snippet Bước 14 dùng `created_at`/`updated_at` kèm `satisfies Partial<Conversation>`. Interface này dùng camelCase (`createdAt`/`updatedAt`, `conversations.ts:61-62`) → `[CMD]` TS2561. Snake_case cũng sai về runtime: `useConversation.ts:80-81` đọc `conv.createdAt`, nên ngày tạo trong mock sẽ là `undefined`.
  - (c) `tsconfig.json` include `**/*.ts`, nên lỗi này nằm trong `npm run type-check`. Playwright không type-check, nên lỗi sẽ không lộ ra ở Cổng 5.
  - **Yêu cầu**:
    1. Đổi thành `import type { Conversation } from "@/lib/features/chat/conversations";` ở §1 và Bước 14.
    2. Đổi các key thành `createdAt`/`updatedAt` trong snippet Bước 14, payload mẫu ở §1, bảng Inventory, §9 S4 và TC-E2E-03.
    3. Thêm vào Bước 20 ghi chú rằng `npm run type-check` bao phủ cả `tests/e2e/**` và là cổng duy nhất kiểm tra kiểu cho các helper Playwright.

**[MINOR]**

- **m29** — Bước 15 dùng `satisfies BatchQuotaInfo` nhưng không chỉ rõ nguồn import. Type này chỉ được export từ component `src/app/features/image-gen/components/ControlPanel.tsx:55`. Cần ghi rõ `import type { BatchQuotaInfo } from "@/app/features/image-gen/components/ControlPanel"`. Đây là import chỉ-kiểu nên an toàn với Babel.
- **m30** — TC-E2E-03 ghi "URL hoặc UI state". Nên chốt một assert tất định: `await expect(page).toHaveURL(/[?&]id=conv-e2e-123/)` (`useUrlSync.ts:65` dùng `router.push`).
- **m31** — Fixture `authedPage` đã gọi `setupMockChat(page)` (mặc định `conv-e2e-123`). Chặng 4 gọi thêm `setupMockChat(page, { conversationId: "conv-image-123" })` trên cùng page, nên glob `**/api/conversations*` vẫn có hai handler. Hành vi vẫn tất định (handler đăng ký sau chạy trước và luôn `fulfill` với GET/POST), nhưng ghi chú "Không đăng ký trùng lặp" ở §1 không còn chính xác. Cần ghi rõ quy tắc LIFO này, hoặc gọi `page.unroute("**/api/conversations*")` trước khi đăng ký lại.

#### Việc cần làm cho Revision 7

1. **M18**: sửa nguồn import `Conversation` thành `@/lib/features/chat/conversations` và đổi key sang camelCase `createdAt`/`updatedAt` ở mọi chỗ trong Technical Plan. Ghi rõ type-check bao phủ `tests/e2e`.
2. Xử lý m29–m31 trong cùng đợt (không chặn).

**Trạng thái**: `[CHANGES_REQUESTED]` — Code freeze tiếp tục có hiệu lực. Không cấp thẻ phê duyệt cho Revision 6.

### Audit Run 8

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 7
- **Kết luận**: `[CHANGES_REQUESTED]` — 0 `[BLOCKER]`, 1 `[MAJOR]`, 2 `[MINOR]`

#### Kiểm chứng lỗi cũ (Audit Run 7 → Revision 7)

| ID  | Trạng thái   | Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                                          |
| :-- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M18 | ✅           | Đã đổi import thành `@/lib/features/chat/conversations` ở §1 và Bước 14. Payload dùng `createdAt`/`updatedAt` ở §1, §2, Inventory, Bước 14, TC-E2E-03 và §9 S4. Bước 20 và Cổng 2 đã ghi rõ type-check bao phủ `tests/e2e/**`. `[CMD]` Chép nguyên văn snippet Bước 14 vào `tests/e2e/__probe_run8__.ts` rồi chạy `npx tsc --noEmit -p tsconfig.json` → **exit 0**. Probe đã xóa sau khi chạy. |
| m29 | ✅           | `import type { BatchQuotaInfo } from "@/app/features/image-gen/components/ControlPanel"`. `[SRC]` `ControlPanel.tsx:55-59` có `quotas: Record<number, {...}>`. Payload Bước 15 với `satisfies BatchQuotaInfo` vượt qua cùng probe `tsc` ở trên (exit 0).                                                                                                                                       |
| m30 | ✅           | Bước 18 và TC-E2E-03 đã chốt assert `await expect(page).toHaveURL(/[?&]id=conv-e2e-123/)`.                                                                                                                                                                                                                                                                                                     |
| m31 | ✅ (kèm m33) | `page.unroute("**/api/conversations*")` trước khi gọi `setupMockChat(..., "conv-image-123")`. `[SRC]` `playwright-core/lib/coreBundle.js:62115-62124`: `unroute` gỡ mọi handler có `urlMatchesEqual(route.url, url)`. Glob giống hệt nhau nên handler `conv-e2e-123` bị gỡ sạch. Handler catch-all `**/api/**` không bị ảnh hưởng.                                                             |

#### Baseline đã xác minh (Run 8)

| Hạng mục                               | Bằng chứng                                                                                                                                                                                                                                                                         | Kết quả                                                    |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| Type-check toàn dự án + snippet E2E    | `[CMD]` `npx tsc --noEmit -p tsconfig.json` (có file probe) → exit 0                                                                                                                                                                                                               | ✅                                                         |
| Lint snippet E2E                       | `[CMD]` `npx eslint tests/e2e/__probe_run8__.ts` → **exit 1**, 2 lỗi `@typescript-eslint/no-floating-promises` tại `route.fulfill(...)` và `route.fallback()` viết dạng câu lệnh trần như trong Bước 14                                                                            | ❌ m32                                                     |
| Wiring lint cho `tests/e2e`            | `[SRC]` `eslint.config.mjs`: `files: ["**/*.{js,jsx,ts,tsx}"]`, `no-floating-promises: "error"`. Chỉ ignore `*.config.{js,mjs,ts}`, nên `tests/e2e/**` bị lint (còn `playwright.config.ts` thì không)                                                                              | Áp dụng cho m32                                            |
| Vitest không quét spec Playwright      | `[SRC]` `vitest.config.ts`: `exclude: ["tests/e2e/**", ...]`                                                                                                                                                                                                                       | ✅ `*.spec.ts` mới không lọt vào `test:run`                |
| Nguồn ảnh của Canvas Image Studio      | `[SRC]` `useImageGenStudio.ts:113-142`: `generatedImages` chỉ lấy từ `messages` (lọc `role === "assistant" && meta?.imageUrl`). `:356-361`: sau khi `generate-image` thành công thì `loadConversation(targetId)`. `useConversation.ts:342-351`: `setMessages(json.data?.messages)` | Ảnh chỉ hiện khi `GET ?id=` trả message có `meta.imageUrl` |
| Payload `GET ?id=` của `setupMockChat` | Bước 14: luôn trả `messages: []`. API chỉ nhận `{ conversationId?: string }`                                                                                                                                                                                                       | ❌ M19                                                     |
| Cách render ảnh                        | `[SRC]` `Canvas.tsx:212,408` dùng `<img>` thuần (không qua `next/image`), nên data URI SVG hiển thị được                                                                                                                                                                           | ✅ (khi đã có message)                                     |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả            | Bằng chứng chính                                                                                                                                                                                                       |
| :--------------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **PASS** (kèm m32) | `[CMD]` tsc exit 0 với snippet nguyên văn. Phần dependency đã xác minh ở Run 7 (install/update/audit exit 0). Lỗi lint `no-floating-promises` sẽ do chính Cổng 2 bắt và sửa máy móc bằng `await`/`return` (m32).       |
| **S2** Runner Lifecycle & Teardown | **PASS**           | Không đổi so với Run 7: abort sớm/muộn, `AbortError`, `syncPartialMessage` nhận `data.message`, teardown `assertNoUnhandledRequests`. `[SRC]` `unroute` không gỡ catch-all guard.                                      |
| **S3** Database & Temporal         | **PASS**           | Migration, rollback và probe 4 RPC không đổi so với Run 6–7. Đã xác minh chữ ký và vector 3072 chiều.                                                                                                                  |
| **S4** Cross-Task State Flow       | **FAIL**           | `[ADV]` Timeline 1 bên dưới: `conv-image-123` được tạo đúng, nhưng `loadConversation` nhận `messages: []`, nên `generatedImages = []` và Canvas không bao giờ hiện ảnh. Assert cuối của TC-E2E-04 FAIL tất định (M19). |
| **S5** Security Boundary           | **PASS**           | Không đổi: catch-all 501, dummy env, provider keys rỗng, không có middleware server-side.                                                                                                                              |
| **S6** External Resilience         | **PASS**           | `@online` + `grepInvert`, abort route Google, Test 4 offline. Data URI SVG cục bộ, không gọi CDN.                                                                                                                      |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: Hiển thị ảnh trong Image Studio (trục: TOCTOU giữa contract mock và nguồn dữ liệu của UI)
T1: Chặng 4 → page.unroute("**/api/conversations*") → setupMockChat(page, { conversationId: "conv-image-123" })
T2: Bấm "Tạo ảnh" → selectedConversationId null → createConversation → POST trả data.conversation.id = conv-image-123 ✅
T3: POST /api/generate-image (mock) → json.success = true → loadConversation("conv-image-123") (useImageGenStudio.ts:358-361)
T4: GET ?id=conv-image-123 → setupMockChat trả { data: { id, title, messages: [] } } (Bước 14, không có tham số messages)
T5: setMessages([]) → generatedImages = [] (useImageGenStudio.ts:113-142) → Canvas trống
Kết cục: Assert "Canvas hiển thị ảnh SVG fixture" (Bước 18 Chặng 4, TC-E2E-04) FAIL tất định. Trước Revision 6,
         mock-image-gen.ts tự sở hữu route hội thoại. Sau khi gộp vào mock-chat.ts (m24/m31), payload ảnh không còn
         đường đi nào vào GET ?id= → LỖI (MAJOR, M19)
```

```
Cơ chế: Gate lint của helper Playwright (trục: thất bại của chính bước kiểm soát)
T1: Người thực thi chép nguyên văn Bước 14: `route.fulfill({...});` và `route.fallback();` dạng câu lệnh trần trong handler async
T2: Cổng 2 → npm run verify → eslint . (tests/e2e nằm trong files của config)
T3: [CMD] 2× @typescript-eslint/no-floating-promises, exit 1
Kết cục: Gate đỏ nhưng tự phát hiện, sửa máy móc (await/return) và không đổi ngữ nghĩa → LỖI NHẸ (MINOR, m32)
```

- **Trục đồng thời**: mock là per-page, `unroute` được await trước khi đăng ký lại, REVOKE có hiệu lực ngay → AN TOÀN.
- **Trục thất bại giữa chừng**: abort trong stream → `AbortError` → `POST /api/messages` có mock → AN TOÀN (Run 5–7).
- **Trục serverless**: N/A. E2E chạy server local, migration không có state in-memory.

#### Phân loại lỗi

**[MAJOR]**

- **M19 — Không có đường nào để payload ảnh vào `GET /api/conversations?id=conv-image-123`, nên TC-E2E-04 FAIL tất định.**
  - (a) Canvas lấy ảnh hoàn toàn từ `messages` của `useConversation` (`useImageGenStudio.ts:113-142`), sau `loadConversation` (`:361`). Ảnh không lấy từ response của `generate-image`.
  - (b) `setupMockChat` (Bước 14) chỉ nhận `{ conversationId }` và luôn trả `messages: []`. Bước 15 đã cấm `mock-image-gen.ts` đăng ký route hội thoại.
  - (c) Vì vậy TC-E2E-04 ("`GET ?id=conv-image-123` trả messages chứa ảnh SVG data URI", "Canvas hiển thị ảnh") mâu thuẫn với API helper được đặc tả.
  - **Yêu cầu**:
    1. Mở rộng chữ ký thành `setupMockChat(page, options?: { conversationId?: string; messages?: FrontendMessage[] })`, với `import type { FrontendMessage } from "@/app/features/chat/hooks/useConversation"` (`[SRC]` export tại `useConversation.ts:31`; import chỉ-kiểu nên an toàn với Babel). Handler `GET ?id=` trả `messages: options?.messages ?? []`.
    2. `mock-image-gen.ts` export một fixture message có kiểu (`role: "assistant"`, `meta: { imageUrl: "data:image/svg+xml;...", prompt: "Cyberpunk city neon", originalOptions: { model: "gemini-3.1-flash-image", aspectRatio: "1:1" } }`). Chặng 4 truyền fixture này vào `setupMockChat(page, { conversationId: "conv-image-123", messages: [IMAGE_FIXTURE_MESSAGE] })`.
    3. Cập nhật Bước 14, Bước 15, Bước 18 (Chặng 4), bảng Inventory (dòng `GET ?id=`) và TC-E2E-04 cho khớp. Thêm assert tất định, ví dụ `await expect(page.locator('img[src^="data:image/svg+xml"]')).toBeVisible()`.

**[MINOR]**

- **m32** — Snippet Bước 14 viết `route.fulfill({...});` và "gọi `route.fallback()`" dạng câu lệnh trần. `[CMD]` ESLint (`no-floating-promises: error`, áp cho `tests/e2e/**`) → exit 1. Cần ghi rõ `return route.fulfill(...)` / `return route.fallback()` (hoặc `await`), và `await page.route(...)` cho mọi helper.
- **m33** — Thứ tự trong TC-E2E-04 đặt `page.unroute` + `setupMockChat("conv-image-123")` **sau** bước "Nút chuyển trạng thái thành Đang tạo...", trong khi `createConversation` chạy ngay khi bấm "Tạo ảnh" (`useImageGenStudio.ts:224-235`). Nếu làm theo thứ tự này, POST sẽ trúng handler `conv-e2e-123`. Cần đưa bước re-route lên đầu TC-E2E-04, trước khi gõ prompt (giống Bước 18). Ngoài ra, gọi lại `setupMockChat` cũng đăng ký thêm một handler `**/api/messages`. Hành vi vẫn tất định (LIFO, cùng payload), nhưng nên ghi chú điều này hoặc tách `setupMockConversations` khỏi phần mock messages.

#### Việc cần làm cho Revision 8

1. **M19**: thêm tham số `messages` có kiểu cho `setupMockChat`, tạo fixture message ảnh SVG trong `mock-image-gen.ts`, cập nhật Bước 14/15/18, Inventory, TC-E2E-04, và thêm assert `img[src^="data:image/svg+xml"]`.
2. Xử lý m32–m33 trong cùng đợt (không chặn).

**Trạng thái**: `[CHANGES_REQUESTED]` — Code freeze tiếp tục có hiệu lực. Không cấp thẻ phê duyệt cho Revision 7.

### Audit Run 9

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5[1m]`)
- **Ngày**: 2026-10-12
- **Đối tượng**: Technical Plan — Revision 8
- **Kết luận**: `APPROVED` — 0 `[BLOCKER]`, 0 `[MAJOR]`, 3 `[MINOR]`

#### Kiểm chứng lỗi cũ (Audit Run 8 → Revision 8)

| ID  | Trạng thái    | Bằng chứng kiểm chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :-- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M19 | ✅            | `setupMockChat(page, options?: { conversationId?; messages?: FrontendMessage[] })`. Handler `GET ?id=` trả `messages` (Bước 14). `mock-image-gen.ts` export `SAMPLE_IMAGE_SVG` và `SAMPLE_IMAGE_MESSAGE` (Bước 15). Chặng 4 truyền `messages: [SAMPLE_IMAGE_MESSAGE]` và assert `img[src^="data:image/svg+xml"]`. Bước 14/15/18, Inventory và TC-E2E-04 khớp nhau. `[CMD]` Chép nguyên văn snippet Bước 14 và Bước 15 (kèm `satisfies BatchQuotaInfo`) vào `tests/e2e/__probe_run9__.ts`, chạy `npx tsc --noEmit -p tsconfig.json` → **exit 0**. `[SRC]` `useConversation.ts:31-49`: `FrontendMessage` có index signature `[key: string]: unknown`, nên `conversationId`/`createdAt` hợp lệ. `useImageGenStudio.ts:115` lọc theo `role === "assistant" && meta?.imageUrl`, và fixture thỏa điều kiện này. `Canvas.tsx:212-217` render `<img src={item.url}>` thuần. |
| m32 | ✅            | Mọi `route.fulfill`/`route.fallback` đều có `return`, và mọi `page.route` đều có `await`. `[CMD]` `npx eslint tests/e2e/__probe_run9__.ts` → **exit 0** (Run 8 trên cùng snippet dạng câu lệnh trần thì exit 1). Đã xóa probe sau khi chạy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| m33 | ✅ (một phần) | Bước 18 Chặng 4 và TC-E2E-04 đã đưa `unroute` + `setupMockChat("conv-image-123")` lên trước bước gõ prompt/bấm "Tạo ảnh". Ghi chú phụ của Run 8 (gọi lại `setupMockChat` thì đăng ký thêm một handler `**/api/messages`) chưa được ghi nhận. Hành vi vẫn tất định (LIFO, cùng payload), nên không chặn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

#### Baseline đã xác minh (Run 9)

| Hạng mục                                      | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Kết quả |
| :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| Type-check toàn dự án + snippet E2E Rev 8     | `[CMD]` `npx tsc --noEmit -p tsconfig.json` (có file probe) → exit 0                                                                                                                                                                                                                                                                                                                                                                                         | ✅      |
| Lint snippet E2E Rev 8                        | `[CMD]` `npx eslint tests/e2e/__probe_run9__.ts` → exit 0                                                                                                                                                                                                                                                                                                                                                                                                    | ✅      |
| Data URI SVG có decode thành SVG hợp lệ không | `[CMD]` `node -e "fetch(SAMPLE_IMAGE_SVG)"` (bộ xử lý `data:` URL theo chuẩn WHATWG, cùng thuật toán với Chromium) → `content-type: image/svg+xml`. `%23` decode thành `#`. Chuỗi `50%'` không phải escape hợp lệ nên được giữ nguyên, đúng như mong muốn. Kết quả là XML well-formed, có `width/height=512`, nên `<img>` có kích thước nội tại và `toBeVisible()` khả thi. (Máy reviewer chưa cài Chromium của Playwright nên không render trực tiếp được.) | ✅      |
| Locator có bị trùng với ảnh template không    | `[SRC]` `templates.ts:32,45,58`: `previewUrl` là `/templates/*.png`. `[CMD]` grep `data:image/svg` trong `src/` → 0 kết quả ngoài test. Locator không match nhầm.                                                                                                                                                                                                                                                                                            | ✅      |
| Unit test baseline                            | `[CMD]` `npx vitest run` → exit 0, **112 files / 1201 tests** passed. Plan ghi 1178 tests (§3.3, Bước 20, Cổng 2). Chênh lệch do working tree đang có thay đổi chưa commit (GLM-5.2).                                                                                                                                                                                                                                                                        | ⚠️ m36  |
| Cơ chế `page.unroute`                         | `[SRC]` `playwright-core/lib/coreBundle.js:62115-62133`: `unroute` gán `this._routes = remaining` **đồng bộ**, rồi `await _updateInterceptionPatterns`. `route()` (`:62086-62089`) chỉ `unshift` handler mới sau khi lời gọi trước hoàn tất.                                                                                                                                                                                                                 | ⚠️ m34  |
| Luồng chọn hội thoại trong Image Studio       | `[SRC]` `useConversation.ts:491` `selectedConversationId = activeId`. `createConversation` (`:381-385`) gọi `setActiveId(conv.id)`. `useImageGenStudio.ts:145-147` có effect `loadConversation(selectedConversationId)` chạy ngay khi id đổi, **trước** khi `POST /api/generate-image` trả về.                                                                                                                                                               | ⚠️ m35  |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                           | Kết quả            | Bằng chứng chính                                                                                                                                                                                                                                                                                                                   |
| :--------------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** Cold-start & Build          | **PASS**           | `[CMD]` tsc exit 0 và eslint exit 0 trên snippet nguyên văn của Rev 8. Phần dependency (install/update/audit đều exit 0) đã xác minh ở Run 7 và không đổi. Không có import tới module chưa tồn tại: `FrontendMessage` (`useConversation.ts:31`), `BatchQuotaInfo` (`ControlPanel.tsx:55`), `Conversation` (`conversations.ts:57`). |
| **S2** Runner Lifecycle & Teardown | **PASS** (kèm m35) | Abort sớm/muộn, `AbortError`, `syncPartialMessage` nhận `data.message` và teardown `assertNoUnhandledRequests` không đổi so với Run 5–8. Assert Canvas của TC-E2E-04 có phần tự pass (m35, xem Timeline 2).                                                                                                                        |
| **S3** Database & Temporal         | **PASS**           | Migration, rollback và probe 4 RPC không đổi so với Run 6–8. Chữ ký và vector 3072 chiều đã được xác minh trước đó.                                                                                                                                                                                                                |
| **S4** Cross-Task State Flow       | **PASS** (kèm m34) | `[ADV]` Timeline 1: `conv-image-123` được tạo, rồi `GET ?id=` trả `SAMPLE_IMAGE_MESSAGE`, `generatedImages` có 1 phần tử và Canvas hiện `<img src="data:image/svg+xml...">`. M19 đã đóng. Có một khe race nhỏ giữa `unroute` và `route` (m34).                                                                                     |
| **S5** Security Boundary           | **PASS**           | Không đổi: catch-all 501, dummy env, provider keys rỗng, không có middleware server-side. Fixture ảnh là data URI cục bộ, không tạo network egress.                                                                                                                                                                                |
| **S6** External Resilience         | **PASS**           | `@online` + `grepInvert`, abort route Google, Test 4 offline. Không phụ thuộc CDN.                                                                                                                                                                                                                                                 |

#### Adversarial Timelines (mục 4.5.2)

```
Cơ chế: Hiển thị ảnh trong Image Studio sau khi đã re-route (trục: TOCTOU giữa contract mock và nguồn dữ liệu UI)
T1: Chặng 4 → goto("/images") → unroute("**/api/conversations*") → setupMockChat({ conversationId: "conv-image-123", messages: [SAMPLE_IMAGE_MESSAGE] })
T2: Gõ prompt → bấm "Tạo ảnh" → createConversation → POST trả data.conversation.id = conv-image-123 → setActiveId
T3: effect useImageGenStudio.ts:145 → loadConversation → GET ?id= → messages = [SAMPLE_IMAGE_MESSAGE]
T4: useMemo :113-142 → generatedImages = [{ url: data:image/svg+xml... }] → Canvas.tsx:212 <img>
Kết cục: img[src^="data:image/svg+xml"] hiển thị → AN TOÀN (M19 đã đóng)
```

```
Cơ chế: Assert Canvas so với kết quả generate-image (trục: thất bại giữa chừng / mock tự pass)
T1: Bấm "Tạo ảnh" → createConversation → setActiveId("conv-image-123")
T2: Effect loadConversation chạy ngay → GET ?id= trả SAMPLE_IMAGE_MESSAGE → Canvas đã có ảnh
T3: POST /api/generate-image bị lỗi (ví dụ quên mock, nên catch-all trả 501) → handleGenerate rơi vào catch → setShowError
Kết cục: Assert `img[src^="data:image/svg+xml"]` vẫn XANH dù bước generate thất bại. Teardown
         assertNoUnhandledRequests chỉ bắt được trường hợp "quên mock", không bắt được trường hợp mock trả sai
         contract. Đây là hệ quả của mock luôn trả ảnh → LỖI NHẸ (MINOR, m35)
```

```
Cơ chế: Khe hở khi re-route route hội thoại (trục: đồng thời)
T1: goto("/images") resolve tại sự kiện load. Hydration/SWR có thể vẫn đang chạy (đặc biệt ở `npm run dev`)
T2: page.unroute → _routes bỏ handler conv-e2e-123 ngay lập tức → await RPC setNetworkInterceptionPatterns
T3: SWR GET /api/conversations (list) đến đúng trong khe này → chỉ còn catch-all **/api/** → 501 + ghi vào unhandledRequests
T4: page.route(conv-image-123) mới được đăng ký
Kết cục: Teardown assertNoUnhandledRequests FAIL không tất định (flaky). Xác suất thấp vì khe chỉ kéo dài
         vài ms, nhưng có thật → LỖI NHẸ (MINOR, m34)
```

- **Trục serverless**: N/A. E2E chạy server local, migration không có state in-memory.

#### Phân loại lỗi

**[MINOR]** (không chặn phê duyệt, xử lý khi triển khai)

- **m34 — Khe race giữa `page.unroute` và `setupMockChat` ở Chặng 4.** `[SRC]` `coreBundle.js:62115-62133`. Có thể chọn một trong hai cách:
  - Thực hiện `unroute` + `setupMockChat("conv-image-123")` **trước** `page.goto("/images")`.
  - Hoặc cho `setupMockChat` trả về một controller có state mutable (`{ setConversationId, setMessages }`) và chỉ đăng ký route một lần. Cách này cũng xử lý luôn phần còn lại của m33 (handler `**/api/messages` bị đăng ký trùng).
- **m35 — Assert Canvas của TC-E2E-04 không chứng minh được nhánh generate-image → reload.** Ảnh xuất hiện nhờ effect `loadConversation` ngay sau khi tạo hội thoại (`useImageGenStudio.ts:145-147`), độc lập với kết quả `POST /api/generate-image`. Cần bổ sung ít nhất một trong các cách sau:
  - `await page.waitForResponse(r => r.url().includes("/api/generate-image") && r.status() === 200)`.
  - Assert modal lỗi (`studioGenerateFailed`) **không** hiển thị.
  - Cho handler `GET ?id=` trả `[]` cho tới khi mock generate-image đã được fulfill.
- **m36 — Số lượng test baseline đã lỗi thời.** `[CMD]` hiện là 112 files / **1201** tests (plan ghi 1178 ở §3.3, Bước 20, Cổng 2). Nên đổi điều kiện thành "100% pass, số test ≥ baseline đo tại thời điểm bắt đầu Giai Đoạn A" thay vì hardcode số lượng.

#### Kết luận

Revision 8 đã khắc phục dứt điểm M19 (MAJOR cuối cùng) cùng m32 và m33. Bằng chứng `[CMD]` cho thấy snippet nguyên văn vượt qua cả `tsc` lẫn `eslint`, và data URI SVG decode thành ảnh hợp lệ. S1–S6 đều PASS, không còn `[BLOCKER]` hay `[MAJOR]`. Ba lỗi m34–m36 là MINOR, có thể xử lý trong lúc triển khai mà không cần thêm vòng review.

**Trạng thái**: `APPROVED` — Revision 8 được phê duyệt. Gỡ code freeze cho kế hoạch này.

[PLAN_APPROVED]
