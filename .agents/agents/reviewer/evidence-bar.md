# Evidence Bar — Tiêu Chuẩn Bằng Chứng Cho @reviewer (Vikini)

> Tài liệu tham chiếu bắt buộc của `@reviewer`. Đọc bằng `view_file` ở Bước 0 trước mọi review. Không áp dụng cho agent khác.

## Áp Dụng Cho MỌI Kết Luận PASS

> **Nguyên tắc cốt lõi**: Diễn giải lại nội dung plan KHÔNG phải evidence. Code/plan "trông có vẻ đúng" (đủ từ khóa, đủ comment giải thích ý đồ) KHÔNG phải evidence. Một PASS không có evidence hợp lệ = `UNVERIFIED`. Mọi kịch bản `UNVERIFIED` trong S1–S5 đều dẫn đến `[CHANGES_REQUESTED]`.

Evidence hợp lệ CHỈ gồm 4 loại (ghi rõ loại trong ma trận):

- **`[CMD]`** — Lệnh đã chạy (trong ALLOWLIST) + exit code + trích đoạn output liên quan.
- **`[SRC]`** — `file:line` trong source dự án HOẶC `node_modules/<lib>` đã `view_file`, kèm tóm tắt hành vi đọc được.
- **`[ADV]`** — Kịch bản đối kháng dạng timeline (xem 4.5.2) đã được lần theo đến kết cục cụ thể.
- **`[URL]`** — Tài liệu chính thức / changelog / advisory năm 2026 (chỉ đủ cho version & API surface, KHÔNG đủ cho hành vi runtime tinh vi).

### 4.5.1 Library Claim Verification (Bắt buộc)

Với MỌI hành vi thư viện mà plan dựa vào để đảm bảo tính đúng (ví dụ: Supabase client transaction/RPC, NextAuth `auth()` session validation, Upstash Redis rate limit pipeline, `@google/genai` model streaming, SSE chat response format):

- `view_file` trực tiếp vào `node_modules/<lib>` hoặc `src/lib/core/` và trích dẫn `file:line`.
- Khi hành vi kiểm được bằng code thuần không cần DB/network → chạy probe `node -e`/`npx tsx -e` (xem ALLOWLIST) để xác nhận.
- Mô tả của `@planner` về hành vi thư viện LUÔN bị coi là **chưa xác minh** cho đến khi có `[SRC]` hoặc `[CMD]`.

### 4.5.2 Adversarial Timeline (Bắt buộc cho S3, S5 và mọi cơ chế đồng thời / bất đồng bộ)

Với MỖI cơ chế thuộc loại: Supabase RPC/transaction, check-then-act, Upstash Redis rate limit/cache, deadline/timeout, SSE chat stream controller, idempotency — viết ít nhất một timeline theo mẫu:

```
Cơ chế: <tên cơ chế>
T1: <actor A làm gì> | T2: <actor B / lỗi / mạng làm gì> | T3: <hệ thống xử lý gì>
Kết cục: <trạng thái cuối cụ thể> → AN TOÀN / LỖI (<severity>)
```

BẮT BUỘC phủ tối thiểu 4 trục đối kháng (trục không áp dụng ghi `N/A` + lý do):

1. **Đồng thời**: 2 request gọi song song (ví dụ: 2 request trừ quota AI cùng thời điểm, retry stream chồng nhau).
2. **Khoảng trống check→use (TOCTOU)**: trạng thái đổi giữa lúc kiểm tra và lúc dùng (ví dụ: SSRF qua Image Studio download URL, bypass auth qua URL query injection, quota check pass nhưng token vượt budget).
3. **Thất bại giữa chừng & thất bại của chính bước dọn dẹp**: SSE chat stream abort listener ném exception; client đóng tab giữa stream thì kết nối LLM và Supabase connection đi đâu?
4. **Môi trường serverless**: state in-memory không chia sẻ giữa các instance Next.js App Router, instance bị đóng ngắt khi hết `maxDuration`, Upstash Redis fallback in-memory behavior.

Đánh giá theo **thời điểm thực thi**, không theo thời điểm khai báo.

### 4.5.3 Enforcement Claim Verification (Bắt buộc)

Khi plan khẳng định một chính sách "được enforce" bằng công cụ (ESLint rule, `tsconfig` flag, hook, script CI, Zod schema, Supabase RLS policy):

- **Chứng minh wiring**: rule/flag thực sự có hiệu lực trên path mục tiêu (ví dụ: `npx eslint --print-config <path>` cho thấy rule ở mức `error`; `npx tsc --showConfig` cho compiler flag).
- **Chứng minh bắt lỗi (Negative Probe)**: đưa một đoạn code VI PHẠM vào qua stdin, xác nhận exit code ≠ 0 kèm đúng rule id. Ví dụ:
  `"const x: any = 1; export default x;" | npx eslint --stdin --stdin-filename src/__probe__.ts`
- "Chạy sạch trên codebase hiện tại" CHỈ chứng minh trạng thái hiện tại sạch, KHÔNG chứng minh rule hoạt động → tự nó KHÔNG đủ cho PASS.
- Nếu rule chưa tồn tại trong config mà plan chỉ _dự định_ thêm → plan phải có bước Verification chứa chính Negative Probe đó; thiếu → `[MAJOR]`.

### 4.5.4 Risk Table Audit (Bắt buộc)

Mọi rủi ro trong plan xếp hạng **Cao/Trung bình** PHẢI ánh xạ tới một technical control đã xác minh bằng `[CMD]`/`[SRC]` (hoặc bước Verification có Negative Probe cho control sẽ được thêm) trong `src/lib/core/` hoặc `src/lib/features/`. Rủi ro Cao không có control → `[BLOCKER]`; rủi ro Trung bình → `[MAJOR]`.
