# Evidence Bar — Tiêu Chuẩn Bằng Chứng Cho @reviewer (Vikini)

> Tài liệu tham chiếu của `@reviewer`. Đọc bằng `view_file` trước mỗi lượt thẩm định.

## Áp dụng cho mọi kết luận PASS

> **Nguyên tắc cốt lõi**: Diễn giải lại nội dung kế hoạch không phải là bằng chứng. Kế hoạch "trông có vẻ hợp lý" nhưng thiếu kiểm chứng trên codebase thật thì kết luận `PASS` sẽ bị tính là `UNVERIFIED`, và mọi kịch bản `UNVERIFIED` trong S1–S5 đều dẫn đến `[CHANGES_REQUESTED]` vì không thể mở khóa repo trên giả định chưa xác thực.

### 4.5.0 Ô Không Áp Dụng & PASS Không Bằng Chứng

- **Ô không áp dụng ghi `N/A`**: Khi một kịch bản (như S3 Database cho task thuần UI/governance) hoặc một trục đối kháng không áp dụng, phải ghi `N/A` kèm lý do 1 dòng thay vì ghi `PASS`, vì đánh dấu `PASS` cho mục không kiểm tra sẽ làm sai lệch báo cáo kiểm toán.
- **`PASS` không có bằng chứng là `UNVERIFIED`**: Mọi ô ghi `PASS` phải đi kèm ít nhất một nhãn bằng chứng hợp lệ (`[CMD]`, `[SRC]`, `[ADV]`, `[URL]`); nếu thiếu phải hạ xuống `UNVERIFIED` vì kết luận không có nguồn dẫn chiếu không thể tái kiểm tra.
- **Cấm lấy chính kế hoạch làm bằng chứng**: Trích dẫn `docs/plans/*.md` chỉ phản ánh ý định của người lập kế hoạch chứ không chứng minh trạng thái thực tế của mã nguồn (`scripts/verify-plan.mjs` sẽ cảnh báo `SELF_CITATION`).
- **Quy tắc phân vân (When in doubt, escalate)**: Khi phân vân giữa `PASS` và `FAIL` hoặc giữa hai mức độ nghiêm trọng (`[MINOR]` vs `[MAJOR]`, `[MAJOR]` vs `[BLOCKER]`), phải chọn mức nghiêm trọng cao hơn vì chi phí sửa kế hoạch thấp hơn nhiều so với chi phí gỡ lỗi trên mã nguồn đã triển khai.

Bằng chứng hợp lệ chỉ gồm 4 loại (ghi rõ loại trong ma trận):

- **`[CMD]`** — Lệnh đã chạy (trong allowlist) + exit code + trích đoạn output liên quan, vì kết quả thực thi là bằng chứng tất định nhất.
- **`[SRC]`** — `file:line` trong mã nguồn dự án hoặc `node_modules/<lib>` đã đọc bằng `view_file` kèm tóm tắt hành vi, vì chỉ code thật mới xác nhận được chữ ký hàm và kiểu dữ liệu.
- **`[ADV]`** — Kịch bản đối kháng dạng timeline (xem 4.5.2) đã lần theo đến kết cục cụ thể, vì phân tích trình tự thời gian giúp phát hiện race condition và lỗi dọn dẹp tài nguyên.
- **`[URL]`** — Tài liệu chính thức / changelog / advisory năm 2026, vì cần xác nhận phiên bản và API surface mới nhất (lưu ý: `[URL]` không thay thế được `[SRC]`/`[CMD]` cho hành vi nội bộ của dự án).

### 4.5.1 Library Claim Verification

Với mọi hành vi thư viện mà kế hoạch dựa vào để đảm bảo tính đúng đắn (ví dụ: Supabase client transaction/RPC, NextAuth `auth()` session validation, Upstash Redis rate limit pipeline, `@google/genai` model streaming, SSE chat response format):

- Dùng `view_file` đọc trực tiếp `node_modules/<lib>` hoặc `src/lib/core/` và trích dẫn `file:line`, vì giả định theo trí nhớ về SDK thường sai lệch giữa các phiên bản.
- Khi hành vi kiểm chứng được qua unit test co-located sẵn có ➔ chạy `npx vitest run <path>` (xem `.agents/agents/reviewer/allowlist.md`) để xác nhận.
- Mô tả của `@planner` về hành vi thư viện luôn được coi là chưa xác minh cho đến khi có `[SRC]` hoặc `[CMD]`.

### 4.5.2 Adversarial Timeline (Áp dụng cho S3, S5 và cơ chế đồng thời / bất đồng bộ)

Với mỗi cơ chế thuộc loại: Supabase RPC/transaction, check-then-act, Upstash Redis rate limit/cache, deadline/timeout, SSE chat stream controller, idempotency — viết ít nhất một timeline theo mẫu:

```
Cơ chế: <tên cơ chế>
T1: <actor A làm gì> | T2: <actor B / lỗi / mạng làm gì> | T3: <hệ thống xử lý gì>
Kết cục: <trạng thái cuối cụ thể> -> An toàn / Lỗi (<severity>)
```

Cần phủ tối thiểu 4 trục đối kháng sau (trục không áp dụng ghi `N/A` + lý do) vì lỗi hệ thống phân tán thường chỉ lộ diện khi có va chạm thời gian hoặc ngắt kết nối đột ngột:

1. **Đồng thời**: 2 request gọi song song (ví dụ: 2 request trừ quota AI cùng thời điểm, retry stream chồng nhau).
2. **Khoảng trống check→use (TOCTOU)**: trạng thái đổi giữa lúc kiểm tra và lúc dùng (ví dụ: SSRF qua Image Studio download URL, bypass auth qua URL query injection, quota check pass nhưng token vượt budget).
3. **Thất bại giữa chừng & thất bại của chính bước dọn dẹp**: SSE chat stream abort listener ném exception; client đóng tab giữa stream thì kết nối LLM và Supabase connection đi đâu?
4. **Môi trường serverless**: state in-memory không chia sẻ giữa các instance Next.js App Router, instance bị đóng ngắt khi hết `maxDuration`, Upstash Redis fallback in-memory behavior.

Đánh giá theo **thời điểm thực thi**, không theo thời điểm khai báo.

### 4.5.3 Enforcement Claim Verification

Khi kế hoạch khẳng định một chính sách "được enforce" bằng công cụ (ESLint rule, `tsconfig` flag, hook, script CI, Zod schema, Supabase RLS policy):

- **Chứng minh Wiring & Baseline**: rule/flag thực sự có hiệu lực trên đường dẫn mục tiêu (ví dụ: `npx eslint --print-config <path>` cho thấy rule ở mức `error`; `npx tsc --showConfig` cho compiler flag; `npx tsc --noEmit` hoặc `node scripts/verify-docs.mjs` xác nhận baseline), vì cấu hình tồn tại trong file chưa chắc đã khớp glob áp dụng.
- **Chứng minh bắt lỗi (Negative Probe)**: thực thi các test case âm tính co-located qua `npx vitest run <path>` hoặc kiểm tra bước Negative Probe tường minh trong mục Verification Plan / Test Contract của kế hoạch, vì một chốt chặn chưa từng thử với dữ liệu vi phạm có thể luôn cho qua mọi trường hợp.
- "Chạy sạch trên codebase hiện tại" chỉ chứng minh trạng thái hiện tại sạch chứ không chứng minh rule hoạt động, nên tự nó không đủ cho `PASS`.
- Nếu rule/guard chưa tồn tại trong config mà kế hoạch dự định thêm ➔ kế hoạch phải có bước Verification chứa chính Negative Probe đó; thiếu ➔ `[MAJOR]`.

### 4.5.4 Risk Table Audit

Mọi rủi ro trong kế hoạch xếp hạng **Cao/Trung bình** phải ánh xạ tới một technical control đã xác minh bằng `[CMD]`/`[SRC]` (hoặc bước Verification có Negative Probe cho control sẽ được thêm) trong mã nguồn/cấu hình thực tế của dự án (`src/lib/core/`, `src/lib/features/`, `src/app/`, hoặc `.agents/scripts/`), vì liệt kê rủi ro trên giấy mà không gắn với chốt chặn trong code sẽ không ngăn được sự cố. Rủi ro Cao không có control ➔ `[BLOCKER]`; rủi ro Trung bình ➔ `[MAJOR]`.
