# Kế Hoạch Triển Khai: Thiết Lập Supabase CLI Automation, Tự Động Hóa Type Generation và Khóa Bất Biến Embedding Model của Project

**Ngày lập**: 2026-09-28  
**Phiên bản**: Revision 2 (Cập nhật toàn diện dựa trên phản hồi từ Product Manager & QA)  
**Tác giả**: @planner  
**Trạng thái**: Ready for Review (Đã giải quyết 3/3 Blocking Issues, 5/5 Should Fix, 3/3 Minor)  
**Môi trường thực thi**: Local Workspace (`wyemh/vikini` trên Windows PowerShell)  
**Mục tiêu chính**: Supabase CLI Typegen Automation + 100% Immutable Project Embedding Model Consistency

---

## 1. Mục Tiêu (Goal)

1. **Khóa bất biến 100% `embedding_model` của Project trên toàn bộ hệ thống (End-to-End Immutability)**:
   - **Vấn đề cốt lõi**: Khóa `PATCH /api/projects/[id]` là chưa đủ nếu endpoint tải tài liệu `POST /api/projects/[id]/knowledge` vẫn cho phép override `embedding_model`, hoặc nếu backend fallback sang model khác với cấu hình ban đầu của project. Điều này gây thảm họa lệch chiều vector (vector dimension mismatch giữa 768d của `text-embedding-004` và 3072d của `gemini-embedding-2`) trong hệ thống RAG, làm crash hàm RPC cosine search hoặc tạo kết quả truy xuất rỗng.
   - **Giải pháp triệt để 3 lớp**:
     - _Tầng API Route Handlers_:
       - `PATCH /api/projects/[id]`: Chặn cập nhật `embedding_model` bằng Zod schema loại trừ trường này và explicit check `if ("embedding_model" in body)` ném lỗi HTTP 400 `ValidationError("embedding_model is immutable and cannot be updated")`.
       - `POST /api/projects/[id]/knowledge`: Loại bỏ override `embedding_model` khỏi `uploadSchema`. Nếu client cố tình gửi `embedding_model` khác với `project.embedding_model`, ném ngay HTTP 400 `ValidationError("Project embedding_model cannot be overridden during upload")`.
     - _Tầng Domain / Business Logic_:
       - [`projects.server.ts`](src/lib/features/projects/projects.server.ts): Loại bỏ logic cập nhật `embedding_model` trong `updateProject()`. Thao tác cập nhật SQL chỉ chạm tới các trường `name`, `description`, `icon`, `color`, `updated_at`.
       - [`knowledge.server.ts`](src/lib/features/projects/knowledge.server.ts):
         - `uploadDocument()` bắt buộc sử dụng `project.embedding_model`, tuyệt đối KHÔNG fallback sang tier default trong `getValidatedEmbeddingModel()`.
         - `searchKnowledge()` sửa default fallback từ `"gemini-embedding-2"` thành `"text-embedding-004"` đồng bộ với giá trị mặc định của `createProject()`.
     - _Tầng Types & Store_:
       - [`src/types/projects.ts`](src/types/projects.ts): Loại bỏ `embedding_model` khỏi `UpdateProjectInput`.
       - [`src/lib/store/projectStore.ts`](src/lib/store/projectStore.ts): Đồng bộ chữ ký `updateProject()`, giữ `description?: string | null` khớp với `UpdateProjectInput`.
       - _UI_: `ProjectSettingsModal` và [`src/app/projects/[id]/page.tsx`](src/app/projects/[id]/page.tsx) chỉ đọc `embedding_model` để hiển thị nhãn read-only, không có form chỉnh sửa model nên **không cần thay đổi mã nguồn UI**.

2. **Scoped Typed-Client Rollout & Tự Động Hóa Supabase CLI Type Generation**:
   - **Định vị phạm vi an toàn**: Codebase hiện có 145 call sites đang sử dụng `getSupabaseAdmin(): SupabaseClient`. Việc cưỡng bức refactor toàn bộ 145 vị trí trong cùng một task nhỏ sẽ dẫn tới rủi ro gãy hàng loạt truy vấn RPC, payload `Record<string, unknown>`, hoặc bảng ngoài schema `public`.
   - **Hủy bỏ generic không an toàn**: Không áp dụng `getSupabaseAdmin<T = Database>()` kèm escape hatch `<any>` vì vi phạm trực tiếp quy chuẩn TypeScript strict mode cấm `any` tại [`.agents/rules/01-coding.md`](.agents/rules/01-coding.md).
   - **Kiến trúc hai client song song**:
     - Giữ nguyên chữ ký hiện tại `getSupabaseAdmin(): SupabaseClient` để bảo toàn 145 call sites hiện có mà không gây regression.
     - Cung cấp export mới `getTypedSupabaseAdmin(): SupabaseClient<Database>` trong [`src/lib/core/supabase.server.ts`](src/lib/core/supabase.server.ts) dành cho module `projects` và các tính năng mới cần autocompletion, type safety mức compile-time.
     - Đưa việc di chuyển 145 call sites cũ sang typed client thành một task refactor riêng biệt có kế hoạch kiểm thử độc lập.
   - **Tự động hóa CLI scripts trong [`package.json`](package.json)**:
     - Bổ sung bước chuẩn bị môi trường: `supabase init` và `supabase link --project-ref otqhztwogsvsfeuwhrom` (tạo `supabase/config.toml`).
     - Reconcile migration history trước khi thực thi `db:push` do định dạng tên migration lịch sử không đồng nhất (`20260625_add_personas.sql` [8 chữ số] so với timestamp chuẩn 14 chữ số).
     - Bổ sung 3 scripts: `db:types`, `db:pull`, `db:push`. Xử lý lưu ý mã hóa UTF-16 trên Windows PowerShell 5.1.
     - Sinh file kiểu dữ liệu chuẩn: `[NEW] src/types/database.types.ts`.

3. **Cập Nhật Tài Liệu Kỹ Thuật (Living Documentation) & Token Hygiene**:
   - Cập nhật [`docs/database-schema.md`](docs/database-schema.md):
     - Dòng 334: Sửa giá trị mặc định của `embedding_model` từ `'gemini-embedding-001'` (tài liệu cũ/legacy) thành `'text-embedding-004'` để phản ánh đúng schema thực tế.
     - Ghi nhận tính bất biến của `embedding_model` trong bảng `projects`.
     - Tài liệu hóa Connection Pooler Supavisor (Port 6543, Transaction mode cho backend serverless runtime) và Direct Connection (cho DDL CLI migrations).
   - Cập nhật [`.agents/skills/database-migration.md`](.agents/skills/database-migration.md): Bổ sung hướng dẫn 3 lệnh CLI và quy trình reconcile migration history.
   - Cập nhật [`docs/CHANGELOG.md`](docs/CHANGELOG.md): Ghi nhận chi tiết bản phát hành 2026-09-28.
   - **Token Sanitization**: Xác nhận token truy cập chỉ được CLI đọc từ `$env:SUPABASE_ACCESS_TOKEN` hoặc phiên `supabase login`, tuyệt đối cấm lưu vào git-tracked files. Nhắc nhở người dùng revoke token cũ trên Supabase Dashboard.

4. **Bổ Sung Bộ Kiểm Thử Co-Located Đạt Chuẩn Quality Gates**:
   - Xây dựng file unit test co-located: `[NEW] src/lib/features/projects/projects.server.test.ts` bao phủ toàn bộ 8 hàm export (`getUserTier`, `getTierLimits`, `getUserProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `canAddStorageToProject`).
   - Bổ sung test cases trong [`src/app/api/projects/[id]/route.test.ts`](src/app/api/projects/[id]/route.test.ts) và route knowledge kiểm chứng việc chặn sửa/override `embedding_model`.

---

## 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Tuân thủ nghiêm ngặt bảng Pre-Work Protocol tại [`.agents/rules/02-quality.md`](.agents/rules/02-quality.md):

| Tài liệu / Quy chuẩn         | Đường dẫn tương đối                                                            | Trọng tâm kiểm tra                                                                                                               |
| :--------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| **Database Schema**          | [`docs/database-schema.md`](docs/database-schema.md)                           | Cấu trúc bảng `projects` (line 334 default model, immutability), quan hệ 1-N với `knowledge_documents` và `conversations`.       |
| **Database Migration Skill** | [`.agents/skills/database-migration.md`](.agents/skills/database-migration.md) | Quy chuẩn migration Supabase, tính lũy tiến (idempotency), RLS policies, connection settings và reconcile migration history.     |
| **API Patterns Skill**       | [`.agents/skills/api-patterns.md`](.agents/skills/api-patterns.md)             | Kiến trúc chuẩn API Route (Validate → Execute → Respond), session check, Zod parsing, `AppError` handling và error sanitization. |
| **Contracts Specification**  | [`docs/contracts.md`](docs/contracts.md)                                       | Đặc tả Request/Response payload của các endpoints `/api/projects`, `/api/projects/[id]`, `/api/projects/[id]/knowledge`.         |
| **Features Specification**   | [`docs/features.md`](docs/features.md) (§ 2.10)                                | Nghiệp vụ Projects, giới hạn tier lưu trữ (Storage bytes), ràng buộc embedding models.                                           |
| **Coding Standards**         | [`.agents/rules/01-coding.md`](.agents/rules/01-coding.md)                     | TypeScript strict mode, cấm `any`, unknown narrowing, type guard, ranh giới kiến trúc module.                                    |
| **Quality Gates**            | [`.agents/rules/02-quality.md`](.agents/rules/02-quality.md)                   | Verification Tier 2 (`npm run verify`), cú pháp PowerShell terminal (dùng `;`), Test Failure Triage.                             |
| **Plan Review Rules**        | [`.agents/rules/05-plan-review.md`](.agents/rules/05-plan-review.md)           | Scoped protection, chuỗi phân công không ngắt quãng (Uninterrupted Execution Chain).                                             |

---

## 3. Assumptions & Cross-Task Dependencies

### 3.1. Các Giả Định Kỹ Thuật (Assumptions)

1. **Supabase Environment & Token Sanitization (BẢO MẬT TUYỆT ĐỐI)**:
   - `SUPABASE_PROJECT_ID`: `otqhztwogsvsfeuwhrom`.
   - **Xử lý Access Token**: CLI đọc token tự động thông qua biến môi trường `$env:SUPABASE_ACCESS_TOKEN` / `process.env.SUPABASE_ACCESS_TOKEN` hoặc phiên đăng nhập cục bộ từ `supabase login` (`~/.supabase/access-token`).
   - **TUYỆT ĐỐI KHÔNG** được hardcode chuỗi token `sbp_...` vào bất kỳ file nào được theo dõi bởi Git (`package.json`, `.sql`, `.ts`, `.md`).
   - **Khuyến cáo người dùng**: Nếu token `sbp_...` từng được dán vào bất kỳ kênh trao đổi hoặc cấu hình tạm nào trước đây, người dùng cần truy cập Supabase Dashboard (`Account -> Access Tokens`) để **Revoke** token cũ và tạo token mới nhằm bảo đảm an toàn dữ liệu.

2. **Phân Định Kết Nối Database (Connection Architecture)**:
   - **Connection Pooler (Supavisor Transaction mode)**: Host `aws-1-eu-west-1.pooler.supabase.com`, Port `6543`, User `postgres.otqhztwogsvsfeuwhrom`, Database `postgres`. Dành riêng cho ứng dụng backend serverless (Next.js server runtime / PgBouncer pool) để tối ưu concurrent connections.
   - **Direct Connection / Linked CLI Project**: Dành cho tác vụ DDL / migration (`supabase db pull`, `supabase db push`) vì transaction pooling không hỗ trợ session-level locking và prepared statements dùng trong migration tools.

3. **Môi Trường Shell Windows PowerShell 5.1**:
   - Khi chạy lệnh redirect `>` trực tiếp trong PowerShell 5.1 (mặc định của Windows), file xuất ra sẽ bị mã hóa `UTF-16 LE BOM`, gây lỗi biên dịch TypeScript (`tsc`) và Next.js build.
   - Giải pháp: Cấu hình script trong `package.json` hoặc thực thi lệnh typegen bằng cách chạy qua `cmd.exe /c` hoặc sử dụng output flag tích hợp sẵn của Supabase CLI / thiết lập UTF-8 chuẩn.

4. **Database Nullable Types vs Domain Models & Hàm Ánh Xạ `toProject()`**:
   - Cột `icon`, `color`, `embedding_model`, `created_at`, `updated_at` trong database row có thể mang giá trị null ở mức kiểu dữ liệu PostgREST.
   - Để bảo toàn TypeScript strict mode không dùng `as any` hay `as EmbeddingModel`, xây dựng hàm `toProject(row)` với các nguyên tắc:
     - Dùng type guard an toàn: `isEmbeddingModel(val: unknown): val is EmbeddingModel`.
     - Không tự ý tạo ngày tháng giả mạo `new Date().toISOString()` nếu `created_at`/`updated_at` null; giữ nguyên giá trị row hoặc fallback chuỗi rỗng an toàn theo domain model.
     - Thống nhất giá trị mặc định của `icon`: Dùng icon của row nếu có, fallback về `"📁"` nếu rỗng/falsy.
     - Thống nhất giá trị mặc định của `color`: Dùng color của row nếu có, fallback về `"#6366f1"`.

5. **Quyết Định Kiến Trúc Typed-Client (Scoped Rollout)**:
   - 145 call sites của `getSupabaseAdmin()` trên toàn codebase giữ nguyên kiểu trả về `SupabaseClient` hiện tại, ngăn chặn 100% rủi ro regression.
   - Bổ sung export mới: `getTypedSupabaseAdmin(): SupabaseClient<Database>` dùng chung singleton instance bên dưới, ép kiểu an toàn thông qua unknown narrowing nội bộ. Module `projects` và các tính năng mới sẽ sử dụng `getTypedSupabaseAdmin()` hoặc types rõ ràng.
   - Việc di chuyển 145 call sites cũ sang typed client được tách thành một task refactor độc lập.

### 3.2. Quan Hệ Phụ Thuộc Chéo (Cross-Task Dependencies)

- **API `PATCH /api/projects/[id]`**: Phụ thuộc vào `updateProjectSchema` trong [`src/app/api/projects/[id]/route.ts`](src/app/api/projects/[id]/route.ts) và hàm `updateProject` trong [`src/lib/features/projects/projects.server.ts`](src/lib/features/projects/projects.server.ts).
- **API `POST /api/projects/[id]/knowledge`**: Phụ thuộc vào `uploadSchema` trong [`src/app/api/projects/[id]/knowledge/route.ts`](src/app/api/projects/[id]/knowledge/route.ts) và `uploadDocument()` trong [`src/lib/features/projects/knowledge.server.ts`](src/lib/features/projects/knowledge.server.ts).
- **Zustand Store ([`src/lib/store/projectStore.ts`](src/lib/store/projectStore.ts))**: `updateProject` trong store đồng bộ kiểu `UpdateProjectInput`.
- **Knowledge Base RAG Ingestion & Search ([`src/lib/features/projects/knowledge.server.ts`](src/lib/features/projects/knowledge.server.ts))**: Bảo đảm 100% tài liệu nạp vào và query tìm kiếm dùng chung model và dimension vector của chính project đó.

---

## 4. Bảng Verified Versions (Tra Cứu Thực Tế 2026)

Đối soát và xác thực tương thích từ môi trường phát triển năm 2026:

| Thư viện / Công cụ          | Phiên bản thực tế                                 | Trạng thái tương thích & Ghi chú kỹ thuật 2026                                                                       |
| :-------------------------- | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------- |
| **`supabase` (CLI)**        | `^2.70.5` (Cục bộ: `2.89.1`, Registry: `2.118.0`) | Hỗ trợ lệnh `gen types typescript --project-id ... --schema public`. PostgREST 14.5 type generator.                  |
| **`@supabase/supabase-js`** | `^2.89.0`                                         | Cung cấp generic `SupabaseClient<Database>`. Khởi tạo `createClient(url, key, { auth: { persistSession: false } })`. |
| **`next`**                  | `^16.1.1` (App Router)                            | Tương thích Route Handlers, Node.js 24 runtime, Edge/Serverless execution.                                           |
| **`react`**                 | `^19.2.3`                                         | React 19 production mode, server functions, batched state reconciliation.                                            |
| **`typescript`**            | `^5.9.3`                                          | TypeScript 5.9 strict mode (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).                        |
| **`zod`**                   | `^4.2.1`                                          | Zod 4 runtime schema parser, hỗ trợ `.strict()`, `.refine()` và custom validation errors.                            |
| **`vitest`**                | `^4.0.17`                                         | Framework test co-located, hỗ trợ mock modules, in-memory execution.                                                 |

---

## 5. Files Cần Chỉnh Sửa / Tạo Mới

Phân loại chi tiết theo quy chuẩn `[NEW]`, `[MODIFY]`, `[DELETE]`:

| Trạng thái     | Đường dẫn file                                                                                           | Mô tả thay đổi kỹ thuật                                                                                                                                                                                                                     |
| :------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **`[NEW]`**    | [`src/types/database.types.ts`](src/types/database.types.ts)                                             | File TypeScript định nghĩa types của toàn bộ bảng, view, enum và hàm RPC trong CSDL Supabase được sinh tự động bởi Supabase CLI.                                                                                                            |
| **`[NEW]`**    | [`src/lib/features/projects/projects.server.test.ts`](src/lib/features/projects/projects.server.test.ts) | Bộ unit test co-located cho `projects.server.ts` bao phủ toàn bộ 8 hàm export nghiệp vụ và kiểm chứng tính bất biến của `embedding_model`.                                                                                                  |
| **`[MODIFY]`** | [`package.json`](package.json)                                                                           | Bổ sung 3 scripts quản trị CSDL: `"db:types"`, `"db:pull"`, `"db:push"`.                                                                                                                                                                    |
| **`[MODIFY]`** | [`src/lib/core/supabase.server.ts`](src/lib/core/supabase.server.ts)                                     | Giữ nguyên chữ ký `getSupabaseAdmin(): SupabaseClient`. Bổ sung export `getTypedSupabaseAdmin(): SupabaseClient<Database>` song song cho các module mới.                                                                                    |
| **`[MODIFY]`** | [`src/types/projects.ts`](src/types/projects.ts)                                                         | Loại bỏ trường `embedding_model?: EmbeddingModel;` khỏi interface `UpdateProjectInput`.                                                                                                                                                     |
| **`[MODIFY]`** | [`src/app/api/projects/[id]/route.ts`](src/app/api/projects/[id]/route.ts)                               | Loại bỏ `embedding_model` khỏi `updateProjectSchema`. Bổ sung kiểm tra `if (body && typeof body === "object" && "embedding_model" in body)` ném `ValidationError` HTTP 400.                                                                 |
| **`[MODIFY]`** | [`src/app/api/projects/[id]/knowledge/route.ts`](src/app/api/projects/[id]/knowledge/route.ts)           | Loại bỏ `embedding_model` khỏi `uploadSchema`. Kiểm tra nếu body gửi `embedding_model` khác `project.embedding_model` thì ném `ValidationError` HTTP 400. Truyền `embeddingModel: project.embedding_model` vào `uploadDocument()`.          |
| **`[MODIFY]`** | [`src/lib/features/projects/projects.server.ts`](src/lib/features/projects/projects.server.ts)           | Loại bỏ cập nhật `embedding_model` trong `updateProject()`. Thêm helper `toProject(row)` với type guard `isEmbeddingModel()`, chuẩn hóa icon `"📁"`, không tự bịa `new Date()`.                                                             |
| **`[MODIFY]`** | [`src/lib/features/projects/knowledge.server.ts`](src/lib/features/projects/knowledge.server.ts)         | Trong `uploadDocument()`: Bắt buộc sử dụng `project.embedding_model`, không fallback sang tier default. Trong `searchKnowledge()`: Sửa fallback model từ `"gemini-embedding-2"` thành `"text-embedding-004"` đồng bộ với `createProject()`. |
| **`[MODIFY]`** | [`src/lib/store/projectStore.ts`](src/lib/store/projectStore.ts)                                         | Cập nhật chữ ký hàm `updateProject()` loại bỏ `embedding_model` khỏi input, giữ `description?: string                                                                                                                                       | null`khớp với`UpdateProjectInput`. |
| **`[MODIFY]`** | [`src/app/api/projects/[id]/route.test.ts`](src/app/api/projects/[id]/route.test.ts)                     | Bổ sung test cases kiểm tra khi gửi payload PATCH chứa `embedding_model` thì route trả về HTTP 400 `ValidationError`.                                                                                                                       |
| **`[MODIFY]`** | [`docs/database-schema.md`](docs/database-schema.md)                                                     | Sửa dòng 334 default model từ `'gemini-embedding-001'` thành `'text-embedding-004'`. Bổ sung cảnh báo bất biến cho cột `embedding_model` tại mục 2.10 và mục cấu hình Supabase CLI & Connection Pooler.                                     |
| **`[MODIFY]`** | [`.agents/skills/database-migration.md`](.agents/skills/database-migration.md)                           | Cập nhật tài liệu quy trình migration với CLI (`db:pull`, `db:push`, `db:types`), reconcile migration history, phân định Pooler vs Direct Connection.                                                                                       |
| **`[MODIFY]`** | [`docs/CHANGELOG.md`](docs/CHANGELOG.md)                                                                 | Thêm entry `2026-09-28: Supabase CLI Automation, Database Typegen & Immutable Project Embedding Model`.                                                                                                                                     |

---

## 6. Các Bước Thực Hiện Tuần Tự

Sau khi kế hoạch nhận phê duyệt `[PLAN_APPROVED]`, các bước sẽ được thực thi tuần tự theo checklist:

### Giai đoạn 1: Chuẩn Bị Supabase CLI, Link Project & Scoped Type Generation

- [ ] **Bước 1.1: Khởi tạo cấu hình và liên kết dự án CLI**:
  - Kiểm tra file `supabase/config.toml`. Nếu chưa tồn tại, thực thi:
    ```powershell
    npx supabase init
    ```
  - Liên kết với project remote bằng project ref chính thức:
    ```powershell
    npx supabase link --project-ref otqhztwogsvsfeuwhrom
    ```
- [ ] **Bước 1.2: Kiểm tra và Reconcile Migration History**:
  - Liệt kê trạng thái migration hiện tại:
    ```powershell
    npx supabase migration list
    ```
  - Đối soát migration `supabase/migrations/20260625_add_personas.sql` (8 chữ số). Nếu remote database đã đánh dấu migration này dưới format timestamp chuẩn hoặc có sai lệch lịch sử migration, thực hiện lệnh `supabase migration repair` phù hợp để đồng bộ history trước khi thực hiện bất kỳ lệnh `db:push` nào.
- [ ] **Bước 1.3: Cập nhật scripts trong [`package.json`](package.json)**:
  - Bổ sung 3 scripts với xử lý output an toàn cho môi trường Windows:
    ```json
    "db:types": "supabase gen types typescript --project-id otqhztwogsvsfeuwhrom --schema public > src/types/database.types.ts",
    "db:pull": "supabase db pull",
    "db:push": "supabase db push"
    ```
  - _Lưu ý Windows PowerShell_: Chạy `npm run db:types` thông qua npm/cmd wrapper để bảo đảm file xuất ra là `UTF-8` (tránh UTF-16 LE BOM làm hỏng `tsc`).
- [ ] **Bước 1.4: Sinh file định nghĩa kiểu dữ liệu chính thức**:
  - Chạy lệnh: `npm run db:types`.
  - Xác nhận file [`src/types/database.types.ts`](src/types/database.types.ts) đã được tạo mới thành công, chứa interface `Database` với đầy đủ định nghĩa các bảng `projects`, `knowledge_documents`, `knowledge_chunks`, `conversations`, `messages`,...
- [ ] **Bước 1.5: Cập nhật [`src/lib/core/supabase.server.ts`](src/lib/core/supabase.server.ts) cung cấp Typed Client song song**:
  - Giữ nguyên chữ ký `getSupabaseAdmin(): SupabaseClient` hiện tại để bảo toàn 145 call sites.
  - Bổ sung export `getTypedSupabaseAdmin(): SupabaseClient<Database>`:

    ```typescript
    import "@/lib/env";
    import { createClient, SupabaseClient } from "@supabase/supabase-js";
    import type { Database } from "@/types/database.types";

    export type TypedSupabaseClient = SupabaseClient<Database>;

    let cachedAdminClient: SupabaseClient | null = null;

    function pickFirstEnv(keys: string[]): string {
      for (const k of keys) {
        const v = process.env[k];
        if (v && String(v).trim()) return String(v).trim();
      }
      return "";
    }

    export function getSupabaseAdmin(): SupabaseClient {
      if (cachedAdminClient) return cachedAdminClient;

      const url = pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
      const serviceKey = pickFirstEnv([
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_SERVICE_ROLE",
        "SUPABASE_SERVICE",
      ]);

      if (!url) throw new Error("Missing Supabase URL");
      if (!serviceKey) throw new Error("Missing Supabase service role key");

      cachedAdminClient = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });

      return cachedAdminClient;
    }

    export function getTypedSupabaseAdmin(): SupabaseClient<Database> {
      return getSupabaseAdmin() as unknown as SupabaseClient<Database>;
    }
    ```

### Giai đoạn 2: Khóa Bất Biến 100% Embedding Model (Route + Service + Store)

- [ ] **Bước 2.1: Cập nhật Type Definitions trong [`src/types/projects.ts`](src/types/projects.ts)**:
  - Loại bỏ `embedding_model` khỏi `UpdateProjectInput`:
    ```typescript
    export interface UpdateProjectInput {
      name?: string;
      description?: string | null;
      icon?: string;
      color?: string;
    }
    ```
- [ ] **Bước 2.2: Khóa Route Handlers Cập Nhật Project [`src/app/api/projects/[id]/route.ts`](src/app/api/projects/[id]/route.ts)**:
  - Loại bỏ `embedding_model` khỏi `updateProjectSchema`.
  - Trong handler `PATCH`, kiểm tra chặt chẽ:
    ```typescript
    const body = await req.json();
    if (body && typeof body === "object" && "embedding_model" in body) {
      throw new ValidationError("embedding_model is immutable and cannot be updated");
    }
    ```
- [ ] **Bước 2.3: Khóa Route Handlers Upload Knowledge [`src/app/api/projects/[id]/knowledge/route.ts`](src/app/api/projects/[id]/knowledge/route.ts)**:
  - Loại bỏ trường `embedding_model` khỏi `uploadSchema`.
  - Kiểm tra ràng buộc model: Nếu client cố tình gửi `embedding_model` trong body và giá trị đó khác với `project.embedding_model`, ném ngay `ValidationError("Project embedding_model cannot be overridden during upload")`.
  - Truyền `embeddingModel: project.embedding_model` vào `uploadDocument()`:
    ```typescript
    const document = await uploadDocument({
      projectId,
      userId,
      filename: parsed.filename,
      content: parsed.content,
      mimeType: parsed.mimeType,
      embeddingModel: project.embedding_model,
    });
    ```
- [ ] **Bước 2.4: Hoàn thiện Logic trong [`src/lib/features/projects/projects.server.ts`](src/lib/features/projects/projects.server.ts)**:
  - Xây dựng type guard và hàm chuyển đổi an toàn `toProject(row)`:

    ```typescript
    import type { Database } from "@/types/database.types";
    type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

    function isEmbeddingModel(val: unknown): val is EmbeddingModel {
      return val === "text-embedding-004" || val === "gemini-embedding-2";
    }

    function toProject(row: ProjectRow): Project {
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        description: row.description,
        icon: row.icon || "📁",
        color: row.color || "#6366f1",
        embedding_model: isEmbeddingModel(row.embedding_model)
          ? row.embedding_model
          : "text-embedding-004",
        created_at: row.created_at || "",
        updated_at: row.updated_at || "",
      };
    }
    ```

  - Trong `getUserProjects`: map từng row qua `toProject`.
  - Trong `getProject`: map row qua `toProject`.
  - Trong `createProject`: trả về `toProject(data)`.
  - Trong `updateProject`:
    - Xóa bỏ khối kiểm tra tier embedding model.
    - Xóa bỏ hoàn toàn code gán `updates.embedding_model`.
    - Trả về `toProject(data)`.

- [ ] **Bước 2.5: Đảm bảo tính nhất quán trong [`src/lib/features/projects/knowledge.server.ts`](src/lib/features/projects/knowledge.server.ts)**:
  - Trong `uploadDocument()`:
    - Bỏ fallback sang tier default của `getValidatedEmbeddingModel()`. Bắt buộc gán `embedding_model = input.embeddingModel || project.embedding_model`.
  - Trong `searchKnowledge()`:
    - Sửa fallback model từ `"gemini-embedding-2"` thành `"text-embedding-004"`:
      ```typescript
      const embeddingModel = (project?.embedding_model ||
        options?.embeddingModel ||
        "text-embedding-004") as EmbeddingModel;
      ```
- [ ] **Bước 2.6: Đồng bộ Zustand Store trong [`src/lib/store/projectStore.ts`](src/lib/store/projectStore.ts)**:
  - Cập nhật chữ ký hàm `updateProject`:
    ```typescript
    updateProject: (
      projectId: string,
      input: {
        name?: string;
        description?: string | null;
        icon?: string;
        color?: string;
      }
    ) => Promise<ProjectWithStats>;
    ```

### Giai đoạn 3: Kiểm Thử Co-Located & Unit Tests

- [ ] **Bước 3.1: Cập nhật Unit Tests cho Route [`src/app/api/projects/[id]/route.test.ts`](src/app/api/projects/[id]/route.test.ts)**:
  - Thêm test case kiểm tra: Gửi payload PATCH `{ embedding_model: "gemini-embedding-2" }` trả về HTTP 400 `ValidationError`.
  - Xác minh `updateProject` không bao giờ được gọi khi có trường `embedding_model`.
- [ ] **Bước 3.2: Xây dựng Unit Tests Co-Located [`src/lib/features/projects/projects.server.test.ts`](src/lib/features/projects/projects.server.test.ts)**:
  - Đặt file ngay cạnh file nghiệp vụ `projects.server.ts`.
  - Mock module `@/lib/core/supabase.server`.
  - Bao phủ toàn bộ 8 hàm export:
    1. `getUserTier`: Test phân hạng basic, pro, admin chính xác dựa trên profile rank.
    2. `getTierLimits`: Test trả về đúng cấu hình hạn mức `PROJECT_LIMITS` cho từng tier.
    3. `getUserProjects`: Test tính toán thống kê tài liệu, hội thoại, dung lượng bytes chính xác.
    4. `getProject`: Test lấy chi tiết dự án và test trường hợp trả về `null`.
    5. `createProject`: Test chặn quota khi đạt giới hạn; test chặn model không thuộc tier; test xử lý lỗi trùng tên (code `23505`); test insert thành công với model mặc định `"text-embedding-004"`.
    6. `updateProject`: Test cập nhật name, description, icon, color; test **KHÔNG** đưa `embedding_model` vào payload updates.
    7. `deleteProject`: Test unlinking conversations (`project_id = null`) trước khi xóa cascade project.
    8. `canAddStorageToProject`: Test kiểm tra hạn mức dung lượng cho phép.
- [ ] **Bước 3.3: Chạy Verification Chain đầy đủ**:
  - `npm run type-check` (Phải đạt 0 lỗi TypeScript).
  - `npm run lint` (Phải đạt 0 lỗi ESLint).
  - `npm run test:run` (Toàn bộ test suite phải PASS).

### Giai đoạn 4: Cập Nhật Living Documentation & Token Revocation

- [ ] **Bước 4.1: Cập nhật [`docs/database-schema.md`](docs/database-schema.md)**:
  - Sửa dòng 334 cột `embedding_model` từ default `'gemini-embedding-001'` thành `'text-embedding-004'`.
  - Ghi chú tính chất bất biến (immutable) của `embedding_model` tại mục 2.10.
  - Thêm mục tài liệu hướng dẫn Supabase CLI và phân định Connection Pooler vs Direct Connection.
- [ ] **Bước 4.2: Cập nhật [`.agents/skills/database-migration.md`](.agents/skills/database-migration.md)**:
  - Hướng dẫn chi tiết quy trình 3 lệnh CLI (`db:pull`, `db:push`, `db:types`).
  - Hướng dẫn reconcile migration history khi gặp sai lệch định dạng tên file migration.
- [ ] **Bước 4.3: Cập nhật [`docs/CHANGELOG.md`](docs/CHANGELOG.md)**:
  - Ghi nhận chi tiết bản phát hành ngày 2026-09-28.
- [ ] **Bước 4.4: Nhắc nhở người dùng bảo mật**:
  - Ghi chú thông báo trong báo cáo tóm tắt để người dùng thực hiện kiểm tra và revoke token cũ trên Supabase Dashboard nếu cần thiết.

---

## 7. Test Contract (Hợp Đồng Kiểm Thử Bắt Buộc)

Bảng ma trận nghiệm thu dành cho Tác Tử Kiểm Thử và `@qa`:

| Mã Contract   | Điểm kích hoạt (Endpoint / Method)                | Đầu vào (Input Payload / Args)                                                                                        | Trạng thái mong đợi               | Đầu ra mong đợi (Expected Output)                                                                                                                                                                     | Failure Mode / Boundary Condition                                                     | Tiêu chí Pass/Fail                                                                                 |
| :------------ | :------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| **TC-EMB-01** | `PATCH /api/projects/[id]`                        | `{ name: "New Name", embedding_model: "gemini-embedding-2" }`                                                         | `400 Bad Request`                 | `{ success: false, error: { message: "embedding_model is immutable and cannot be updated" } }` _(Lưu ý: Thông điệp chi tiết hiển thị tại test/dev; production được sanitize bởi `errorFromAppError`)_ | Client cố tình gửi `embedding_model` trong body PATCH                                 | **PASS**: Status 400, `success: false`, `updateProject` không được gọi.                            |
| **TC-EMB-02** | `PATCH /api/projects/[id]`                        | `{ name: "Valid Project", color: "#10b981", icon: "🚀" }`                                                             | `200 OK`                          | `{ success: true, data: { project: { id, name: "Valid Project", color: "#10b981", icon: "🚀" } } }`                                                                                                   | Cập nhật các trường được phép bình thường                                             | **PASS**: Status 200, `updateProject` được gọi với đúng payload hợp lệ.                            |
| **TC-EMB-03** | `POST /api/projects/[id]/knowledge`               | Form/JSON upload với `embedding_model: "gemini-embedding-2"` trong khi project dùng `text-embedding-004`              | `400 Bad Request`                 | `{ success: false, error: { message: "Project embedding_model cannot be overridden during upload" } }`                                                                                                | Client cố tình override embedding model khi upload tài liệu                           | **PASS**: Status 400, tài liệu bị từ chối trước khi chia chunk và sinh vector.                     |
| **TC-EMB-04** | `uploadDocument()` in `knowledge.server.ts`       | Upload document vào project có `embedding_model = "text-embedding-004"` bởi user rank pro                             | Resolve `KnowledgeDocument`       | Document được lưu với `embedding_model = "text-embedding-004"`, chunks sinh với dimension 768                                                                                                         | Model bắt buộc theo project, không bị fallback sang `gemini-embedding-2` của pro tier | **PASS**: DB insert `knowledge_documents` chứa đúng model của project; dimension embedding là 768. |
| **TC-EMB-05** | `searchKnowledge()` in `knowledge.server.ts`      | Tìm kiếm trên project không có `embedding_model` trong DB row                                                         | Resolve `KnowledgeSearchResult[]` | Fallback sử dụng `"text-embedding-004"` (768 dimensions), tạo vector query 768d                                                                                                                       | Dự án thiếu giá trị model trong CSDL                                                  | **PASS**: Không fallback về `"gemini-embedding-2"`, khớp với mặc định của `createProject()`.       |
| **TC-EMB-06** | `updateProject()` in `projects.server.ts`         | Caller ép truyền `embedding_model` qua type bypass: `({ name: "New", embedding_model: "gemini-embedding-2" } as any)` | Resolve `Project`                 | SQL update payload gửi tới Supabase `.update(updates)` KHÔNG chứa key `embedding_model`                                                                                                               | Caller cố tình bypass TypeScript interface                                            | **PASS**: Key `embedding_model` không bao giờ xuất hiện trong object `updates`.                    |
| **TC-CLI-01** | `npm run db:types`                                | CLI command                                                                                                           | `0 Exit Code`                     | File `src/types/database.types.ts` được tạo mới, mã hóa UTF-8 hợp lệ, chứa export `Database`                                                                                                          | CLI kết nối tới Supabase qua `otqhztwogsvsfeuwhrom`                                   | **PASS**: File được tạo thành công, cú pháp TypeScript chuẩn, không lỗi encoding UTF-16.           |
| **TC-CLI-02** | `npm run type-check`                              | Toàn bộ codebase sau khi tích hợp typegen và typed client                                                             | `0 Exit Code`                     | `tsc --noEmit` hoàn thành với 0 lỗi                                                                                                                                                                   | Strict type-check trên Next.js 16 và Supabase JS v2                                   | **PASS**: Không có bất kỳ lỗi TS2322, TS2304 hay regression nào trên 145 call sites cũ.            |
| **TC-CLI-03** | `getTypedSupabaseAdmin()` vs `getSupabaseAdmin()` | Kiểm tra chữ ký hàm của 2 exports trong `supabase.server.ts`                                                          | Resolve clients                   | `getTypedSupabaseAdmin()` trả về `SupabaseClient<Database>`; `getSupabaseAdmin()` giữ nguyên `SupabaseClient`                                                                                         | Khả năng tương thích ngược và mở rộng                                                 | **PASS**: 145 call sites cũ biên dịch bình thường, tính năng mới có autocompletion đầy đủ.         |
| **TC-PRJ-01** | `createProject()` in `projects.server.ts`         | Input không truyền `embedding_model`                                                                                  | Resolve `Project`                 | Tạo project thành công với `embedding_model = "text-embedding-004"`                                                                                                                                   | Giá trị mặc định khi tạo mới                                                          | **PASS**: `embedding_model` nhận giá trị `"text-embedding-004"`, không phụ thuộc vào tier.         |
| **TC-PRJ-02** | `createProject()` in `projects.server.ts`         | Người dùng đã đạt tối đa số dự án của tier (basic = 5)                                                                | Reject Error                      | `Error("Project limit reached. basic tier allows 5 projects.")`                                                                                                                                       | Vượt quota giới hạn của tier                                                          | **PASS**: Bị chặn với thông điệp lỗi rõ ràng trước khi gọi DB insert.                              |

---

## 8. Kế Hoạch Kiểm Thử Co-Located & Verification Plan

### 8.1. Cấu Trúc File Test Co-Located

Tuân thủ nguyên tắc bắt buộc tại [`.agents/rules/02-quality.md`](.agents/rules/02-quality.md): Mọi business logic trong `src/lib/features/` đều phải có file test co-located `*.test.ts` đặt cùng thư mục:

- **File**: `[NEW] src/lib/features/projects/projects.server.test.ts`
  - Đặt tại `src/lib/features/projects/`.
  - Khung mock: Mock toàn bộ `@/lib/core/supabase.server` (giả lập các hàm `.from()`, `.select()`, `.insert()`, `.update()`, `.delete()`, `.single()`, `.eq()`, `.order()`).
  - Bao phủ toàn bộ 8 hàm export:
    1. `describe("getUserTier")`: Kiểm tra fallback `"basic"` khi không có profile; trả về `"admin"`, `"pro"`, `"basic"` chính xác theo rank.
    2. `describe("getTierLimits")`: Kiểm tra lấy đúng cấu hình `PROJECT_LIMITS` cho từng hạng.
    3. `describe("getUserProjects")`: Giả lập danh sách project, kiểm tra tính toán tổng hợp `conversation_count`, `document_count`, và `storage_bytes`.
    4. `describe("getProject")`: Giả lập lấy chi tiết 1 project; kiểm tra trường hợp trả về `null`.
    5. `describe("createProject")`: Kiểm tra chặn quota tier; kiểm tra chặn embedding model không thuộc tier; kiểm tra lỗi trùng tên (code `23505`); kiểm tra insert thành công với default model.
    6. `describe("updateProject")`: Kiểm tra cập nhật name, description, icon, color; kiểm tra loại bỏ hoàn toàn `embedding_model` khỏi query update; kiểm tra cập nhật timestamp `updated_at`.
    7. `describe("deleteProject")`: Kiểm tra unlinking conversations (`project_id = null`) trước khi xóa cascade project.
    8. `describe("canAddStorageToProject")`: Kiểm tra cho phép hoặc từ chối dung lượng dựa trên `maxStorageBytesPerProject`.

### 8.2. Cập Nhật Test Route Handlers

- **File**: [`src/app/api/projects/[id]/route.test.ts`](src/app/api/projects/[id]/route.test.ts)
  - Bổ sung test case vào block `describe("PATCH")`:

    ```typescript
    it("should return 400 when attempting to update embedding_model", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", `/api/projects/${TEST_PROJECT_ID}`, {
        embedding_model: "gemini-embedding-2",
      });
      const res = await PATCH(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("embedding_model is immutable");
      expect(updateProject).not.toHaveBeenCalled();
    });
    ```

### 8.3. Chuỗi Lệnh Kiểm Chứng Verification Gate

Thực thi đúng chuẩn Windows PowerShell trên workspace (`npm run type-check; npm run lint; npm run test:run`):

1. **Tier 1 (Kiểm tra kiểu dữ liệu sau từng thay đổi)**:
   ```powershell
   npm run type-check
   ```
2. **Tier 2 (Chốt chặn nghiệm thu toàn bộ dự án trước khi báo cáo hoàn thành)**:
   ```powershell
   npm run verify
   ```
   _(Tương đương: `npm run type-check && npm run lint && npm run test:run` chạy qua cmd wrapper)_.

---

## 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa

|  STT  | Rủi ro tiềm ẩn (Risk)                                                                                             | Tác động (Impact)                                                                                               | Technical Control trong Code (Phòng ngừa)                                                                                                                                                                                                                                                                                                                                                              |
| :---: | :---------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Client cố tình gửi `embedding_model` qua PATCH API hoặc Knowledge Upload API để đổi model                         | Phá hủy RAG retrieval; crash khi cosine search do vector dimensions lệch (768d vs 3072d); mất liên kết tri thức | **Phòng vệ 3 lớp**: <br>1. _Route Handlers_: Chặn tại cả `PATCH /api/projects/[id]` và `POST /api/projects/[id]/knowledge`, ném HTTP 400 `ValidationError`.<br>2. _Type System_: Loại bỏ `embedding_model` khỏi `UpdateProjectInput` và `uploadSchema`.<br>3. _Database Functions_: Xóa code gán `updates.embedding_model` trong `updateProject()`; ép buộc `uploadDocument()` dùng model của project. |
| **2** | PowerShell 5.1 xuất file UTF-16 LE BOM khi chạy lệnh redirect `>` trong script `db:types`                         | Làm hỏng `tsc` và Next.js build với lỗi parsing header file lạ                                                  | Cấu hình script npm chạy qua shell tiêu chuẩn hoặc cmd wrapper; kiểm tra encoding UTF-8 sau khi sinh typegen.                                                                                                                                                                                                                                                                                          |
| **3** | Thay đổi chữ ký của `getSupabaseAdmin()` gây lỗi compile hoặc runtime trên 145 call sites cũ                      | Gãy hàng loạt chức năng chat, auth, personas, billing trên toàn bộ ứng dụng                                     | **Kiến trúc Scoped Rollout**: Giữ nguyên `getSupabaseAdmin(): SupabaseClient` hiện tại. Cung cấp export mới `getTypedSupabaseAdmin(): SupabaseClient<Database>` song song cho các module mới. Tách task di chuyển 145 vị trí cũ thành nhiệm vụ refactor riêng.                                                                                                                                         |
| **4** | Lịch sử migration bị lệch do định dạng tên migration không chuẩn (`20260625_add_personas.sql` vs timestamp 14 số) | Lệnh `supabase db push` cố chạy lại migration cũ hoặc báo lỗi reconcile migration history                       | Thực hiện `supabase migration list` và `supabase migration repair` (nếu cần) trước khi chạy lệnh `db:push`.                                                                                                                                                                                                                                                                                            |
| **5** | Cột CSDL là Nullable (`string \| null`), trong khi Domain Model `Project` yêu cầu các trường non-null             | Gây lỗi Type check strict mode hoặc crash ứng dụng khi truy cập thuộc tính                                      | Sử dụng hàm `toProject(row)` với type guard `isEmbeddingModel()`. Chuẩn hóa icon `"📁"`, giữ nguyên timestamp row hoặc chuỗi rỗng an toàn, không tự bịa `new Date()`.                                                                                                                                                                                                                                  |
| **6** | Rò rỉ token truy cập `SUPABASE_ACCESS_TOKEN` vào kho mã nguồn Git                                                 | Nguy cơ bảo mật nghiêm trọng nếu token bị lộ vào repo public/shared                                             | Scripts trong `package.json` chỉ sử dụng `--project-id otqhztwogsvsfeuwhrom`. Tuyệt đối không nhúng token vào code/docs. CLI tự động đọc từ biến môi trường. Nhắc nhở người dùng revoke token cũ trên Supabase Dashboard.                                                                                                                                                                              |
| **7** | Chạy DDL migration qua Connection Pooler Supavisor (Port 6543, Transaction mode) thất bại                         | Báo lỗi prepared statement hoặc transaction block do PgBouncer không hỗ trợ DDL locks                           | Phân định rõ ràng trong tài liệu: Connection Pooler Port 6543 chỉ dùng cho backend query runtime. Migration DDL bắt buộc dùng Direct Connection hoặc Supabase CLI link.                                                                                                                                                                                                                                |
