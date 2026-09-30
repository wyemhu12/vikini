# Kế Hoạch Tái Cấu Trúc & Tối Ưu Hóa Docs, Rules và Agents

> **Trạng thái**: Approved  
> **Revision**: 6 (Khắc phục triệt để Audit Run 5: Sandbox Negative Probe 6b cho Contract 8.3, Chặn regex hậu tố rác --expected-headings, Chuẩn hóa relative link NOTE/badge, và sẵn sàng phê duyệt tuyệt đối [PLAN_APPROVED])  
> **Tác giả**: @planner (Technical Planner)  
> **Ngày lập**: 2026-09-29  
> **Phạm vi tác động**: Toàn bộ thư mục `docs/`, `.agents/rules/`, `.agents/agents/`, `.agents/skills/`, `.agents/workflows/`, `.superpowers/`, và script kiểm tra độc lập `scripts/verify-docs.mjs` (KHÔNG sửa đổi source code ứng dụng `src/`).

---

## Technical Plan

### 1. Mục Tiêu (Goal)

Tái cấu trúc, chuẩn hóa và tối ưu hóa toàn bộ hệ thống tài liệu kỹ thuật (`docs/`) và hạ tầng quản trị tác tử (`.agents/`), giải quyết triệt để các khiếm khuyết cốt lõi và đáp ứng đầy đủ yêu cầu thẩm định kỹ thuật của Audit Run 5:

1. **Khắc phục tình trạng thiếu bản đồ điều hướng (Navigation Hub)**: Bổ sung các tệp chỉ mục trung tâm (`docs/README.md`, `.agents/README.md`, `.agents/skills/README.md`) giúp lập trình viên và AI coding agents tra cứu ngữ cảnh tức thì theo chuẩn **Agent-Ready Documentation (GEO Principles 2026)** và Diátaxis Framework.
2. **Phân định ranh giới & chuẩn hóa liên kết tương đối (Relative Link Resolution)**:
   - Hợp nhất nội dung bị phân mảnh giữa `docs/context.md` và `docs/overview.md`.
   - Phân định rõ ràng hai miền tri thức: `docs/models.md` thuần túy là catalog các AI Models của ứng dụng Vikini (Gemini, Claude, DeepSeek); còn hướng dẫn lựa chọn mô hình cho tác tử (`Agent Task-to-Model Routing Guide`) được đặt độc lập tại `.agents/README.md#agent-task-to-model-routing`.
   - Chuẩn hóa liên kết tương đối theo chuẩn CommonMark/GitHub: Mọi liên kết từ `docs/*.md` trỏ sang `.agents/...` bắt buộc dùng tiền tố `../.agents/...` (ví dụ `[Agent Routing Guide](../.agents/README.md#agent-task-to-model-routing)` trong `docs/models.md`, `[01-coding.md](../.agents/rules/01-coding.md)` trong `docs/lessons-learned.md`).
   - Chuẩn hóa liên kết nội bộ trong `docs/`: Liên kết từ `docs/CHANGELOG.md` trỏ tới archive dùng chuẩn file-relative `./archive/CHANGELOG-legacy.md`.
   - Quy chuẩn liên kết trong các hub tác tử: Các liên kết Markdown trong `.agents/README.md` trỏ tới file nội bộ cùng cấp dùng tiền tố `./rules/...`, `./skills/...`, `./workflows/...`; liên kết từ `.agents/skills/README.md` trỏ tới rules dùng `../rules/...` nhằm tương thích hoàn hảo với negative shorthand regex.
   - Giữ `docs/plans/README.md` trong phạm vi kiểm tra liên kết của link checker (chỉ loại trừ các file plan cụ thể `docs/plans/*.md` khác `README.md`).
3. **Giải quyết vấn đề phình to ngữ cảnh có định lượng (Context Bloat & Token Waste)**:
   - Cắt phân đoạn `docs/CHANGELOG.md` tại mốc ngày **2026-09-10**: Giữ lại 8 bản ghi gần nhất từ 2026-09-10 đến 2026-09-29 (~31,977 bytes cơ sở, cộng NOTE và living docs entry mới đạt ~33.5 KB, đảm bảo mục tiêu `< 35,000 bytes`). Chuyển toàn bộ 74 bản ghi cũ hơn sang `docs/archive/CHANGELOG-legacy.md`.
   - Kiểm chứng bảo toàn headings tự động bằng cờ CLI `--expected-headings=<N+1>` trong `scripts/verify-docs.mjs` (với $N=82$ đo ở Bước 2.1 ➔ tổng kỳ vọng sau khi thêm entry mới là 83 headings).
   - **Vá triệt để lỗ hổng false-PASS (MAJOR-H/I)**: Script bắt buộc kiểm tra sự tồn tại của cả 2 tệp `CHANGELOG.md` và `CHANGELOG-legacy.md` khi có `--expected-headings` và từ chối các chuỗi không phải số nguyên thuần túy qua regex `/^\d+$/`. Bổ sung Sandbox Negative Probe 6b kiểm chứng tự động việc bắt lỗi khi thiếu archive.
   - Bổ sung Mục Lục Tra Cứu Nhanh (Anchor-based Table of Contents) cho đúng **13 nhóm H2** thực tế trong `docs/lessons-learned.md` (48.9 KB).
4. **Triệt để thống nhất quy chuẩn đường dẫn `.agents/` trên 20 tệp [MODIFY]**:
   - Áp dụng 100% quy chuẩn đường dẫn tương đối từ project root với tiền tố đầy đủ `.agents/rules/...`, `.agents/skills/...`, `.agents/workflows/...` trên toàn bộ **16 tệp active governance** có tham chiếu (3 agent definitions, 1 mental simulation, 4 rule files, 3 skills, 2 workflows, và 2 core docs: architecture & lessons-learned) cùng 3 navigation hubs mới.
   - Sửa dòng quy ước trong `.agents/rules/02-quality.md`: _"Đường dẫn file nội bộ viết dạng relative path từ repo root (`.agents/rules/01-coding.md`, `src/lib/core/...`)."_
   - Sửa triệt để 4 lỗi typo `.agent/rules/` (thiếu `s`) thành `.agents/rules/`.
   - Đảm bảo 100% tệp rules tuân thủ nghiêm ngặt giới hạn `<= 12,000` ký tự và tệp agents `<= 10,000` ký tự.
5. **Dọn dẹp tàn dư cấu trúc & bảo toàn liên kết liên thư mục**:
   - Loại bỏ thư mục untracked rác `.agents/agents/reviewer.backup/` (sau khi người điều phối chấp thuận xác nhận từ hook `ask`).
   - Di dời plan từ `docs/superpowers/plans/` sang thư mục chuẩn `docs/archive/plans/`, di dời spec sang `docs/specs/`, và cập nhật đường dẫn tại dòng 4 của `.superpowers/sdd/progress.md` thành `docs/archive/plans/2026-09-04-chat-core-ux-ui-augmentation.md`.
   - Cập nhật `docs/architecture.md` để đồng bộ sơ đồ tài liệu và kiến trúc đa tác tử mới.
   - Thêm Living Docs entry cho chính đợt tái cấu trúc này vào đầu `docs/CHANGELOG.md` bằng câu từ kỹ thuật mô tả gián tiếp (tránh chứa chuỗi cấm thô gây false positive).
6. **Xây dựng Script Kiểm Chứng Độc Lập `scripts/verify-docs.mjs` Đạt Chuẩn Linter & Đa Nền Tảng**:
   - Khai báo header `/* global process, console, Buffer */` đảm bảo `npx eslint scripts/verify-docs.mjs` đạt exit code 0 sạch sẽ mà không sửa `eslint.config.mjs`.
   - Xử lý link relative trên Windows: Kiểm tra `targetPath.startsWith("/")` trước `path.isAbsolute(targetPath)` để không bị Windows resolve nhầm thành ổ đĩa `C:\...`.
   - Bổ sung cờ CLI `--strict-shorthand` và `--expected-headings=<N>` (kiểm tra chặt chẽ `/^\d+$/`, bắt buộc archive tồn tại), thông điệp kết thúc trung tính: `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`.
7. **Quy Trình Định Dạng Scoped Prettier Format Tường Minh**:
   - Định nghĩa danh sách tường minh đúng **23 tệp markdown và 1 tệp script** thuộc phạm vi task (loại trừ các tệp archive lưu trữ nguyên văn lịch sử `docs/archive/**` và `docs/specs/**`).
   - Sắp xếp quy trình Verification Gate: Thực thi `npx prettier --write <files>` trước, sau đó chạy `npx prettier --check <files>`, rồi mới chạy script kiểm chứng nghiêm ngặt (`--strict-shorthand --expected-headings=83`) để đảm bảo các assert headings, shorthand và character limit chạy trên mã nguồn đã format.

---

### 2. Tài Liệu Cần Tham Chiếu (Pre-Work Reading)

Trước khi thực hiện bất kỳ thao tác nào, bắt buộc đọc và nắm vững các tài liệu sau:

| STT | Tài liệu tham chiếu                         | Mục đích & Trọng tâm                                                                              |
| :-- | :------------------------------------------ | :------------------------------------------------------------------------------------------------ |
| 1   | `.agents/rules/00-core.md`                  | Nguyên tắc cốt lõi, vai trò các bên, ranh giới hành vi.                                           |
| 2   | `.agents/rules/02-quality.md`               | Tiêu chuẩn Governance-Only (giới hạn ký tự, Frontmatter YAML, relative links, pre-work protocol). |
| 3   | `.agents/rules/05-plan-review.md`           | Quy trình Plan - Review - Revise Loop, cơ chế Code Freeze Guard, ranh giới Zero-Self-Execution.   |
| 4   | `.agents/scripts/code-freeze-guard.js`      | Cơ chế quét `docs/plans/` để tìm thẻ `[PLAN_APPROVED]` và allowlist paths của PreToolUse hook.    |
| 5   | `.agents/scripts/code-freeze-guard.test.ts` | 66 unit tests bảo vệ tính toàn vẹn của cơ chế Code Freeze Guard.                                  |
| 6   | `docs/architecture.md` (§ 7)                | Sơ đồ Multi-Agent Governance Architecture của Vikini.                                             |
| 7   | `.superpowers/sdd/progress.md`              | Bản ghi tiến độ SDD cũ chứa liên kết trỏ tới tài liệu trong superpowers cần cập nhật.             |
| 8   | `scripts/verify-docs.mjs`                   | Script kiểm chứng tự động toàn diện tài liệu, liên kết và quy chuẩn governance.                   |

---

### 3. Đánh Giá Hiện Trạng & Đề Xuất Cải Tiến (Current State Audit & Proposed Improvements)

#### 3.1. Bảng Kiểm Kê & Đo Lường Hiện Trạng Codebase

| Phân Vùng                | Tệp / Thư Mục Hiện Tại                                 | Kích Thước / Dung Lượng     | Đánh Giá Hiện Trạng                                                                                   | Đề Xuất Xử Lý Cho Revision 6                                                                                                                                                            |
| :----------------------- | :----------------------------------------------------- | :-------------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`docs/` Root**         | `docs/README.md`                                       | _Chưa tồn tại_              | Thiếu trang mục lục trung tâm, người đọc/agent bị lạc.                                                | **[NEW]** Tạo file mục lục điều hướng toàn diện chuẩn Diátaxis 2026. Nằm trong shorthand scope.                                                                                         |
| **`docs/` Root**         | `docs/overview.md`                                     | 6,204 bytes / Tiếng Việt    | Giới thiệu tổng quan hệ thống, tính năng, UX/UI rất tốt.                                              | **[MODIFY]** Bổ sung section Scope & Context (từ context.md) để hợp nhất.                                                                                                               |
| **`docs/` Root**         | `docs/context.md`                                      | 2,044 bytes / Tiếng Anh     | Trùng lặp mục tiêu với overview.md (phạm vi, quy mô 5-10 users).                                      | **[DELETE]** Sau khi sáp nhập vào overview.md, chuyển bản gốc vào archive.                                                                                                              |
| **`docs/` Root**         | `docs/models.md`                                       | 11,903 bytes                | Danh mục AI models của ứng dụng Vikini (Gemini, Claude, DeepSeek).                                    | **[MODIFY]** Bổ sung note link file-relative sang `../.agents/README.md#agent-task-to-model-routing`.                                                                                   |
| **`docs/` Root**         | `docs/model-routing.md`                                | 1,695 bytes                 | Hướng dẫn chọn model cho dev/agent, dễ gây nhầm lẫn với models.md.                                    | **[DELETE]** Chuyển toàn bộ nội dung sang `.agents/README.md`.                                                                                                                          |
| **`docs/` Root**         | `docs/CHANGELOG.md`                                    | 138,134 bytes / 82 headings | 82 headings trước khi cắt (80 năm 2026, 2 năm 2025).                                                  | **[MODIFY]** Cắt tại mốc **2026-09-10**, giữ 8 mục gần nhất (31,977 bytes cơ sở, dự kiến ~33.5 KB < 35 KB), chuyển 74 mục sang archive. NOTE dùng link `./archive/CHANGELOG-legacy.md`. |
| **`docs/` Root**         | `docs/lessons-learned.md`                              | 48,901 bytes / 409 dòng     | 13 nhóm H2 thực tế, thiếu TOC, có typo `.agent/rules/` tại dòng ~10, chứa 3 shorthand refs.           | **[MODIFY]** Thêm TOC anchor 13 nhóm H2, đặt badge Promoted với link `../.agents/rules/01-coding.md`, sửa typo, chuẩn hóa 3 shorthand refs sang `.agents/`. Nằm trong shorthand scope.  |
| **`docs/` Root**         | `docs/architecture.md`                                 | 15,436 bytes                | Kiến trúc kỹ thuật và MAS chuẩn xác, chứa 2 shorthand refs.                                           | **[MODIFY]** Cập nhật sơ đồ cấu trúc tài liệu mới và chuẩn hóa 2 shorthand refs sang `.agents/`. Nằm trong shorthand scope.                                                             |
| **`docs/` Root**         | `docs/contracts.md`                                    | 15,342 bytes                | Single source of truth cho data models & API protocols.                                               | **[KEEP]** Giữ nguyên cấu trúc chuẩn.                                                                                                                                                   |
| **`docs/` Root**         | `docs/database-schema.md`                              | 22,997 bytes                | ERD và chi tiết Supabase Schema, RLS, indexes.                                                        | **[KEEP]** Giữ nguyên cấu trúc chuẩn (loại khỏi scoped format để tránh chạm ngoài phạm vi).                                                                                             |
| **`docs/` Root**         | `docs/security.md`                                     | 5,875 bytes                 | Bảo mật, Supabase Auth, RLS, API key rotation.                                                        | **[KEEP]** Giữ nguyên cấu trúc chuẩn.                                                                                                                                                   |
| **`docs/` Con**          | `docs/superpowers/`                                    | 2 files (plan & spec)       | Tàn dư thư mục dị biệt từ 04/09/2026, phá vỡ cấu trúc docs chuẩn.                                     | **[MOVE & DELETE]** Chuyển plan về `docs/archive/plans/`, spec về `docs/specs/`, xóa folder.                                                                                            |
| **`docs/` Con**          | `docs/plans/`                                          | 5 plans + README.md         | Quản lý plans triển khai tốt, nhưng README thiếu ma trận trạng thái.                                  | **[MODIFY]** Cập nhật `docs/plans/README.md` với Ma trận Index Matrix. Nằm trong link checker scope.                                                                                    |
| **`.superpowers/`**      | `progress.md`                                          | 895 bytes                   | Dòng 4 tham chiếu tới `docs/superpowers/plans/...`.                                                   | **[MODIFY]** Cập nhật link dòng 4 trỏ tới `docs/archive/plans/...`.                                                                                                                     |
| **`.agents/rules/`**     | 6 rule files (00 -> 05)                                | 1,699 đến 9,404 chars       | Tất cả <= 12,000 ký tự (Đạt chuẩn Governance).                                                        | **[MODIFY 00, 01, 02, 04]** Thống nhất tiền tố `.agents/`, sửa typo `.agent/rules/` tại dòng ~120 của `02-quality.md`. Nằm trong shorthand scope.                                       |
| **`.agents/agents/`**    | 3 agent files + mental-sim                             | 4,887 đến 7,272 chars       | Chứa 10 tham chiếu shorthand `rules/...`, `skills/...`.                                               | **[MODIFY planner, qa, reviewer, mental-sim]** Chuẩn hóa toàn bộ sang tiền tố `.agents/`. Nằm trong shorthand scope.                                                                    |
| **`.agents/agents/`**    | `reviewer.backup/`                                     | 4 files untracked           | Thư mục rác tồn đọng sau đợt refactor trước (khác 7 dòng so với bản chính).                           | **[DELETE]** Xóa sạch toàn bộ thư mục `reviewer.backup/` (User xác nhận khi hook ask).                                                                                                  |
| **`.agents/` Root**      | `.agents/README.md`                                    | _Chưa tồn tại_              | Thiếu tài liệu tổng quan hệ sinh thái tác tử Vikini (AGENTS context).                                 | **[NEW]** Tạo tệp tổng quan kiến trúc MAS, rules map, hooks, Agent Model Routing Guide. Link nội bộ dùng `./`. Nằm trong shorthand scope.                                               |
| **`.agents/skills/`**    | `.agents/skills/README.md`                             | _Chưa tồn tại_              | Thiếu danh mục định tuyến kỹ năng (Skills Catalog).                                                   | **[NEW]** Tạo index catalog phân loại 6 Core skills và 19 tài nguyên của `ux-ui-agent-skills`. Link rules dùng `../rules/`. Nằm trong shorthand scope.                                  |
| **`.agents/skills/`**    | `add-feature.md`, `add-model.md`, `add-translation.md` | 1,695 đến 3,248 bytes       | Chứa 7 tham chiếu shorthand.                                                                          | **[MODIFY]** Chuẩn hóa toàn bộ sang tiền tố `.agents/`. Nằm trong shorthand scope.                                                                                                      |
| **`.agents/workflows/`** | `audit.md`, `post-fix.md`                              | 1,119 đến 1,562 chars       | Chứa 2 tham chiếu shorthand và 1 typo `.agent/rules/`.                                                | **[MODIFY]** Chuẩn hóa sang `.agents/` và sửa typo dòng ~29. Nằm trong shorthand scope.                                                                                                 |
| **`scripts/` Root**      | `scripts/verify-docs.mjs`                              | 303 lines / 10.5 KB         | Script kiểm chứng tự động độc lập cho task, có header globals, bắt lỗi thiếu archive, chặn `/^\d+$/`. | **[NEW]** Quản lý chính thức trong bảng files của task, tuân thủ ESLint & Prettier.                                                                                                     |

---

### 4. Assumptions & Cross-Task Dependencies

1. **Zero-Code Mutation Guarantee**: Tuyệt đối không chỉnh sửa bất kỳ file mã nguồn ứng dụng nào (`src/**`, `app/**`, `components/**`, `lib/**`, `supabase/migrations/**`). Mọi thay đổi 100% thuộc phân vùng tài liệu (`docs/`), cấu hình tác tử (`.agents/`), tệp tiến độ legacy (`.superpowers/sdd/progress.md`), và tệp script kiểm chứng `scripts/verify-docs.mjs`.
2. **Code Freeze Guard Compatibility & Hook Interaction**:
   - `scripts/code-freeze-guard.js` và `.agents/scripts/code-freeze-guard.js` quét thư mục `docs/plans/` bằng lệnh `fs.readdirSync(plansDir).filter(file => file.endsWith('.md') && file !== 'README.md')`.
   - Thư mục lưu trữ kế hoạch cũ được đặt tại `docs/archive/plans/` (nằm hoàn toàn ngoài `plansDir`), vì vậy tuyệt đối không ảnh hưởng đến logic quét plan mới nhất của guard.
   - **Tương tác Hook**: Các thao tác ghi vào `.agents/**`, tạo mới `scripts/verify-docs.mjs`, xóa thư mục rác untracked `.agents/agents/reviewer.backup/`, cũng như các lệnh `node scripts/verify-docs.mjs`, `npx prettier ...`, `npx eslint ...` trong Giai đoạn 6 sẽ kích hoạt phản hồi `ask` từ hook `code-freeze-guard` theo đúng chính sách Scoped Protection (do nằm ngoài `READ_ONLY_COMMANDS` hoặc chứa cờ mutating `--write`). Người điều phối (Orchestrator) hoặc User cần bấm Chấp thuận (`approve`) khi hook yêu cầu.
   - **Header Trạng Thái Khi Phê Duyệt**: Header hiện tại là `> **Trạng thái**: In Review` để guard nhận diện là pending (bỏ qua token cho tới khi hoàn tất review). Khi Lead Reviewer cấp thẻ `[PLAN_APPROVED]`, Orchestrator/implementer sẽ cập nhật header sang `> **Trạng thái**: Approved` trước khi tiến hành viết code.
3. **Quy Chuẩn Đường Dẫn Nhất Quán (Triệt Để Phương Án B)**:
   - Thống nhất duy nhất một quy chuẩn: Mọi tham chiếu tới các tệp nội bộ của hệ thống tác tử trong văn xuôi và code span (backtick) đều sử dụng đường dẫn tương đối từ project root với đầy đủ tiền tố: `.agents/rules/...`, `.agents/skills/...`, `.agents/workflows/...`.
   - Đối với Markdown links trong các hub: Các liên kết trong `.agents/README.md` trỏ tới file cùng cấp dùng `./rules/...`, `./skills/...`; liên kết trong `.agents/skills/README.md` trỏ tới rules dùng `../rules/...` để tương thích hoàn toàn với negative shorthand regex.
   - Đối với Markdown links trong `docs/`: Liên kết trỏ tới archive dùng `./archive/...`; liên kết trỏ sang `.agents/` dùng `../.agents/...`.
   - Sửa dòng quy ước trong `.agents/rules/02-quality.md`: _"Đường dẫn file nội bộ viết dạng relative path từ repo root (`.agents/rules/01-coding.md`, `src/lib/core/...`)."_
   - Bảng biến thiên kích thước ký tự dự kiến của các rules và agents khi áp dụng tiền tố `.agents/`:
     - `00-core.md`: 2,788 ➔ ~2,804 ký tự (giới hạn: 12,000)
     - `01-coding.md`: 9,404 ➔ ~9,375 ký tự (sau format Prettier, giới hạn: 12,000)
     - `02-quality.md`: 8,541 ➔ ~8,690 ký tự (giới hạn: 12,000)
     - `04-bilingual.md`: 1,699 ➔ ~1,707 ký tự (giới hạn: 12,000)
     - `planner/agent.md`: 6,271 ➔ ~6,287 ký tự (giới hạn: 10,000)
     - `qa/agent.md`: 7,272 ➔ ~7,296 ký tự (giới hạn: 10,000)
     - `reviewer/agent.md`: 4,977 ➔ ~4,985 ký tự (giới hạn: 10,000)
     - `reviewer/mental-simulation.md`: 4,887 ➔ ~4,919 ký tự (giới hạn: 10,000)
       ➔ 100% file rules và agents đều nằm sâu dưới ngưỡng quy định.
4. **Chính Sách Lưu Trữ Luân Phiên CHANGELOG (Rolling Archive Policy)**:
   - File `docs/CHANGELOG.md` luôn được duy trì với dung lượng `< 35,000 bytes`, chứa các bản phát hành trong vòng 30 ngày gần nhất (tối đa 10 mục phát hành gần nhất).
   - Khi `CHANGELOG.md` vượt ngưỡng 35 KB do các task mới thêm vào, các mục phát hành cũ hơn 30 ngày sẽ được di chuyển append vào đầu phần thân của `docs/archive/CHANGELOG-legacy.md`.
   - File `docs/archive/CHANGELOG-legacy.md` sử dụng heading bậc 1 `#` cho tiêu đề và blockquote cho lời giới thiệu, tuyệt đối không tạo thêm heading `## ` phụ để tránh làm lệch biến đếm số lượng bản ghi phát hành.
5. **Thống Nhất Danh Mục Archive Duy Nhất**:
   - Thống nhất sử dụng cấu trúc `docs/archive/plans/` (thay vì lẫn lộn với `docs/plans/archive/`).
6. **Scoped Prettier Baseline Distinction**:
   - Do baseline hiện tại có sẵn 9 file `.md` không đúng chuẩn format (nằm ngoài phạm vi của task như `docs/database-schema.md`, `05-plan-review.md`, v.v.), task TUYỆT ĐỐI không dùng glob rộng `"docs/**/*.md"` vì sẽ vi phạm nguyên tắc "Only touch files required by the task" (`00-core.md`). Thay vào đó, task quy định danh sách tường minh đúng **23 tệp markdown và 1 tệp script** thuộc phạm vi task để chạy Prettier format.

---

### 5. Bảng Verified Versions / Tech Specs (2026)

Hạ tầng và công nghệ chuẩn hóa cho tài liệu và tác tử trong năm 2026:

| Công Nghệ / Tiêu Chuẩn        | Phiên Bản / Định Dạng                | Vai Trò & Ràng Buộc Kỹ Thuật                                                                                                                                                                                                                                                                                                           |
| :---------------------------- | :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Markdown Standard**         | GitHub Flavored Markdown (GFM)       | Bắt buộc cho toàn bộ tài liệu; hỗ trợ alerts (`[!NOTE]`, `[!WARNING]`,...), tables, checkboxes.                                                                                                                                                                                                                                        |
| **Relative Links Resolution** | CommonMark / GitHub Specs            | Liên kết tương đối giữa các thư mục phải chuẩn xác (`../.agents/README.md#...` từ `docs/`). Link checker đảo thứ tự `startsWith("/")` trước `path.isAbsolute(targetPath)` để đảm bảo tương thích hoàn hảo trên Windows. Link trong hub dùng `./` cho file cùng thư mục `.agents/`. Link trong NOTE của CHANGELOG dùng `./archive/...`. |
| **Diagram Tool**              | Mermaid.js 11.x (fenced `mermaid`)   | Sơ đồ kiến trúc, luồng tác tử (`flowchart TD/LR`), ERD (`erDiagram`), State (`stateDiagram-v2`).                                                                                                                                                                                                                                       |
| **Agent Governance Limits**   | Quy Chuẩn Vikini (2026)              | • File Rule: **<= 12,000 ký tự**.<br>• File Agent: **<= 10,000 ký tự**.<br>• Frontmatter YAML chuẩn xác (`trigger`, `description`,...).                                                                                                                                                                                                |
| **Information Architecture**  | Diátaxis Framework 2026              | Phân tách 4 nhóm nội dung: Tutorials (Hướng dẫn), How-To Guides (Quy trình tác vụ), Reference (Đặc tả tra cứu), Explanation (Kiến trúc & Bối cảnh).                                                                                                                                                                                    |
| **Context Optimization**      | Low-Noise High-Context               | Giới hạn dung lượng các tệp thường đọc (`CHANGELOG.md` < 35 KB, `README.md` cô đọng, TOC anchor-based).                                                                                                                                                                                                                                |
| **Prettier Formatting**       | Prettier 3.x (Explicit Scoped Files) | Định dạng tường minh danh sách **23 tệp markdown và 1 tệp script** thuộc phạm vi task; không chạy glob rộng lên baseline repository.                                                                                                                                                                                                   |
| **ESLint Global Headers**     | ESLint Flat Config 9.x               | File `.mjs` trong `scripts/` nằm ngoài glob TypeScript cần có header `/* global process, console, Buffer */` để pass `no-undef`.                                                                                                                                                                                                       |
| **Node.js Runtime**           | Node.js v24.12.0 LTS                 | Sử dụng cho verification scripts và PreToolUse hooks.                                                                                                                                                                                                                                                                                  |
| **Test Framework**            | Vitest v4.0.17                       | Chạy kiểm thử tự động cho `code-freeze-guard.test.ts`.                                                                                                                                                                                                                                                                                 |

---

### 6. Bảng Files Cần Chỉnh Sửa / Tạo Mới / Di Chuyển / Xóa

#### A. Nhóm Tạo Mới `[NEW]` (8 tệp/thư mục)

1. `docs/README.md` [NEW]: Bản đồ điều hướng tài liệu toàn diện cho Vikini (Diátaxis layout, bảng tra cứu theo nhu cầu).
2. `docs/archive/CHANGELOG-legacy.md` [NEW]: Lưu trữ toàn bộ 74 mục changelog cũ hơn ngày 2026-09-10 (dùng heading `#` cho title, không tạo `## ` phụ). Bản lưu trữ nguyên văn lịch sử.
3. `docs/archive/context-legacy.md` [NEW]: Bản lưu trữ nguyên văn của `context.md` phục vụ tham chiếu lịch sử.
4. `docs/archive/plans/2026-09-04-chat-core-ux-ui-augmentation.md` [NEW]: Di dời plan từ superpowers sang archive plans (bản lưu trữ nguyên văn).
5. `docs/specs/2026-09-04-chat-core-ux-ui-augmentation-design.md` [NEW]: Di dời bản spec thiết kế từ superpowers sang thư mục specs chuẩn (bản lưu trữ nguyên văn).
6. `.agents/README.md` [NEW]: Bản đồ kiến trúc hệ thống tác tử Vikini, quy chuẩn giao tiếp, bảng tra cứu rules, cơ chế hooks, và phần **Agent Task-to-Model Routing Guide**. Các link nội bộ dùng tiền tố `./`.
7. `.agents/skills/README.md` [NEW]: Thư mục danh mục kỹ năng (Skills Catalog), phân loại 6 Core skills và 19 thư mục/tài nguyên của `ux-ui-agent-skills`. Link tới rules dùng `../rules/`.
8. `scripts/verify-docs.mjs` [NEW]: Script Node.js kiểm chứng tự động toàn diện link, shorthand grep, negative grep và changelog dynamic headings integrity. Có header globals cho ESLint, bắt lỗi thiếu archive, chặn `/^\d+$/`.

#### B. Nhóm Chỉnh Sửa `[MODIFY]` (20 tệp tường minh)

_Phân loại: Gồm 16 tệp active governance có shorthand refs và 4 tệp docs/superpowers không chứa shorthand:_

1. `docs/overview.md` [MODIFY]: Tích hợp mục "Bối Cảnh & Phạm Vi Sản Phẩm (Scope & Context)" từ `context.md`, bổ sung song ngữ chú thích, hoàn thiện cấu trúc.
2. `docs/models.md` [MODIFY]: Thêm ghi chú định tuyến dẫn link file-relative chuẩn: `../.agents/README.md#agent-task-to-model-routing`.
3. `docs/architecture.md` [MODIFY]: Cập nhật sơ đồ cây thư mục documentation và agent governance mới; chuẩn hóa 2 shorthand refs sang `.agents/rules/03-ui.md` và `.agents/rules/01-coding.md`. _(Thuộc shorthandScope)_
4. `docs/CHANGELOG.md` [MODIFY]: Cắt giảm từ 138 KB xuống ~33.5 KB (< 35,000 bytes) bằng cách giữ lại 8 bản phát hành từ 2026-09-10 đến nay; thêm link file-relative trỏ tới `./archive/CHANGELOG-legacy.md`; bổ sung Living Docs entry cho đợt tái cấu trúc (viết gián tiếp không chứa chuỗi cấm).
5. `docs/lessons-learned.md` [MODIFY]: Thêm TOC anchor-based cho đúng 13 nhóm H2 thực tế; sửa typo chuỗi `.agent/rules/` thành `.agents/rules/` tại dòng ~10; gắn badge Promoted với link `../.agents/rules/01-coding.md`; chuẩn hóa 3 shorthand refs sang `.agents/`. _(Thuộc shorthandScope)_
6. `docs/plans/README.md` [MODIFY]: Cập nhật bảng ma trận theo dõi trạng thái các implementation plans (Active / Completed / Archived). _(Thuộc link checking scope)_
7. `.superpowers/sdd/progress.md` [MODIFY]: Cập nhật dòng 4 sửa đường dẫn thành `docs/archive/plans/2026-09-04-chat-core-ux-ui-augmentation.md`.
8. `.agents/rules/00-core.md` [MODIFY]: Chuẩn hóa các đường dẫn shorthand sang `.agents/rules/02-quality.md` và `.agents/rules/05-plan-review.md`. _(Thuộc shorthandScope)_
9. `.agents/rules/01-coding.md` [MODIFY]: Chuẩn hóa đường dẫn shorthand sang `.agents/rules/04-bilingual.md` và `.agents/skills/api-patterns.md`. _(Thuộc shorthandScope)_
10. `.agents/rules/02-quality.md` [MODIFY]: Sửa typo chuỗi `.agent/rules/` thành `.agents/rules/` tại dòng ~120; sửa dòng quy ước thành `.agents/rules/01-coding.md`; chuẩn hóa toàn bộ 19 đường dẫn trong bảng Pre-Work và văn xuôi sang prefix `.agents/...`. _(Thuộc shorthandScope)_
11. `.agents/rules/04-bilingual.md` [MODIFY]: Chuẩn hóa đường dẫn shorthand sang `.agents/skills/add-translation.md`. _(Thuộc shorthandScope)_
12. `.agents/agents/planner/agent.md` [MODIFY]: Chuẩn hóa 2 đường dẫn shorthand sang `.agents/rules/02-quality.md` và `.agents/rules/01-coding.md`. _(Thuộc shorthandScope)_
13. `.agents/agents/qa/agent.md` [MODIFY]: Chuẩn hóa 3 đường dẫn shorthand sang `.agents/rules/04-bilingual.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md`. _(Thuộc shorthandScope)_
14. `.agents/agents/reviewer/agent.md` [MODIFY]: Chuẩn hóa 1 đường dẫn shorthand sang `.agents/rules/04-bilingual.md`. _(Thuộc shorthandScope)_
15. `.agents/agents/reviewer/mental-simulation.md` [MODIFY]: Chuẩn hóa 4 đường dẫn shorthand sang `.agents/skills/...` và `.agents/rules/...`. _(Thuộc shorthandScope)_
16. `.agents/skills/add-feature.md` [MODIFY]: Chuẩn hóa 5 đường dẫn shorthand sang `.agents/skills/...` và `.agents/rules/...`. _(Thuộc shorthandScope)_
17. `.agents/skills/add-model.md` [MODIFY]: Chuẩn hóa 1 đường dẫn shorthand sang `.agents/skills/add-translation.md`. _(Thuộc shorthandScope)_
18. `.agents/skills/add-translation.md` [MODIFY]: Chuẩn hóa 1 đường dẫn shorthand sang `.agents/rules/04-bilingual.md`. _(Thuộc shorthandScope)_
19. `.agents/workflows/audit.md` [MODIFY]: Chuẩn hóa 2 đường dẫn shorthand sang `.agents/rules/01-coding.md` và `.agents/skills/api-patterns.md`. _(Thuộc shorthandScope)_
20. `.agents/workflows/post-fix.md` [MODIFY]: Sửa typo chuỗi `.agent/rules/` thành `.agents/rules/` tại dòng ~29. _(Thuộc shorthandScope)_

#### C. Nhóm Xóa Bỏ / Dọn Dẹp `[DELETE]` (4 mục)

1. `docs/context.md` [DELETE]: Đã sáp nhập vào `docs/overview.md` và lưu vết tại `docs/archive/context-legacy.md`.
2. `docs/model-routing.md` [DELETE]: Đã chuyển nội dung sang `.agents/README.md#agent-task-to-model-routing`.
3. `docs/superpowers/` [DELETE]: Xóa toàn bộ thư mục sau khi đã chuyển tệp sang `docs/specs/` và `docs/archive/plans/`.
4. `.agents/agents/reviewer.backup/` [DELETE]: Xóa sạch thư mục untracked rác và 4 tệp bên trong (User bấm approve khi hook ask).

---

### 7. Các Bước Triển Khai Tuần Tự (Step-by-Step Execution Plan)

```text
Giai Đoạn 1: Chuẩn Bị & Khởi Tạo Thư Mục Archive/Specs & Script Kiểm Chứng (có header globals, bắt lỗi thiếu archive, chặn /^\d+$/)
      │
      ▼
Giai Đoạn 2: Lưu Trữ Lịch Sử (Archiving) & Di Chuyển Tệp Phân Mảnh
      │
      ▼
Giai Đoạn 3: Tái Cấu Trúc & Tối Ưu Hóa Tài Liệu `docs/` (Link CHANGELOG ./archive/, Badge ../.agents/rules/)
      │
      ▼
Giai Đoạn 4: Chuẩn Hóa Quản Trị Tác Tử `.agents/` (100% 16 active files sang .agents/ prefix, link hub dùng ./)
      │
      ▼
Giai Đoạn 5: Xóa Bỏ Tệp Thừa & Dọn Dẹp Rác Workspace (Chấp thuận hook ask)
      │
      ▼
Giai Đoạn 6: Kiểm Chứng Toàn Diện (Prettier Write -> Check -> ESLint Script -> verify-docs.mjs Gate -> Vitest Guard -> Verify)
```

#### Giai Đoạn 1: Chuẩn Bị & Khởi Tạo Thư Mục Mới & Script Kiểm Chứng

- [ ] **Bước 1.1**: Tạo các thư mục mới phục vụ lưu trữ và phân loại tài liệu:
  - `docs/archive/`
  - `docs/archive/plans/`
  - `docs/specs/`
  - Khởi tạo/cập nhật `scripts/verify-docs.mjs` với header `/* global process, console, Buffer */`, đảo thứ tự kiểm tra `targetPath.startsWith("/")` trước `path.isAbsolute(targetPath)`, giữ `docs/plans/README.md` trong phạm vi link checker, bổ sung các hubs mới vào `shorthandScope`, hỗ trợ cờ CLI `--expected-headings=<N>` (kiểm tra chặt chẽ `/^\d+$/`), và bắt buộc báo lỗi FAIL (exit 1) khi thiếu archive trong chế độ có cờ. (Lưu ý: ghi file ngoài `docs/` kích hoạt hook `ask`).

#### Giai Đoạn 2: Lưu Trữ Lịch Sử & Di Chuyển Tệp Phân Mảnh

- [ ] **Bước 2.1**: Đo và ghi nhận số headings hiện tại $N$ của `docs/CHANGELOG.md` bằng lệnh node:
  ```bash
  node -e "console.log('N =', fs.readFileSync('docs/CHANGELOG.md','utf8').split('\n').filter(l=>l.startsWith('## ')).length)"
  ```
  _(Baseline hiện tại $N = 82$)._
- [ ] **Bước 2.2**: Trích xuất lịch sử cũ từ `docs/CHANGELOG.md` tại mốc ngày **2026-09-10**:
  - Lưu 74 mục từ `2026-09-05` trở về trước vào `docs/archive/CHANGELOG-legacy.md` (chỉ dùng `#` cho tiêu đề và blockquote cho phần giới thiệu, không thêm `## ` phụ).
  - Giữ lại 8 mục từ `2026-09-10` đến `2026-09-29` trong `docs/CHANGELOG.md` (~31,977 bytes cơ sở).
- [ ] **Bước 2.3**: Sao chép nguyên văn `docs/context.md` vào `docs/archive/context-legacy.md` để lưu vết lịch sử trước khi gộp.
- [ ] **Bước 2.4**: Di chuyển `docs/superpowers/plans/2026-09-04-chat-core-ux-ui-augmentation.md` vào `docs/archive/plans/2026-09-04-chat-core-ux-ui-augmentation.md`.
- [ ] **Bước 2.5**: Di chuyển `docs/superpowers/specs/2026-09-04-chat-core-ux-ui-augmentation-design.md` vào `docs/specs/2026-09-04-chat-core-ux-ui-augmentation-design.md`.
- [ ] **Bước 2.6**: Chỉnh sửa dòng 4 của `.superpowers/sdd/progress.md`: Thay thế đường dẫn cũ `docs/superpowers/plans/2026-09-04-chat-core-ux-ui-augmentation.md` thành `docs/archive/plans/2026-09-04-chat-core-ux-ui-augmentation.md`.

#### Giai Đoạn 3: Tái Cấu Trúc & Tối Ưu Hóa Tài Liệu `docs/`

- [ ] **Bước 3.1**: Tạo mới `docs/README.md` theo chuẩn Diátaxis 2026:
  - Header & Purpose của trung tâm tài liệu Vikini.
  - Bảng "Documentation Navigation Map" phân loại 4 nhóm: Bối cảnh & Sản phẩm, Kiến trúc & Kỹ thuật, Hướng dẫn & Vận hành, Kế hoạch & Lưu trữ.
  - Hướng dẫn "Lộ trình đọc tài liệu cho AI Agents và Dev mới".
- [ ] **Bước 3.2**: Chỉnh sửa `docs/overview.md`:
  - Tích hợp thêm section: `## 5. Bối Cảnh & Phạm Vi Sản Phẩm (Scale, Scope & Core Use Cases)` kế thừa đầy đủ nội dung từ `context.md` (giới hạn 5-10 users, private tool, Creative Writing, R&D, Gaming, Architecture Principle "Keep It Simple Monolith").
  - Đảm bảo tính nhất quán ngôn ngữ tiếng Việt làm chính, có thuật ngữ tiếng Anh đối chiếu.
- [ ] **Bước 3.3**: Chỉnh sửa `docs/models.md`:
  - Giữ thuần túy là catalog các AI Models của ứng dụng.
  - Bổ sung ghi chú dẫn link tương đối chuẩn CommonMark: `> [!NOTE] Để tham khảo hướng dẫn phân bổ model cho AI Coding Agents, xem [Agent Task-to-Model Routing Guide](../.agents/README.md#agent-task-to-model-routing).`
- [ ] **Bước 3.4**: Hoàn thiện `docs/CHANGELOG.md`:
  - Đặt thông báo `[!NOTE]` dẫn link file-relative chuẩn trỏ tới `./archive/CHANGELOG-legacy.md` ở đầu file:
    ```markdown
    > [!NOTE]
    > Các bản ghi lịch sử phát hành cũ hơn ngày 2026-09-10 được lưu trữ nguyên vẹn tại [CHANGELOG Legacy Archive](./archive/CHANGELOG-legacy.md).
    ```
  - Thêm Living Docs entry cho đợt tái cấu trúc (dùng câu từ gián tiếp tránh chuỗi cấm):
    ```markdown
    ## 2026-09-29: Docs, Rules & Agents Restructuring (Revision 6)

    - Tái cấu trúc toàn diện thư mục docs và hạ tầng tác tử theo chuẩn Diátaxis và Agent-Ready 2026.
    - Tạo mới navigation hubs: docs/README.md, .agents/README.md, .agents/skills/README.md.
    - Cắt giảm dung lượng CHANGELOG.md từ 138 KB xuống ~33.5 KB; lưu trữ 74 mục cũ sang docs/archive/CHANGELOG-legacy.md.
    - Hợp nhất context.md vào overview.md; chuyển model routing guide sang .agents/README.md.
    - Chuẩn hóa toàn bộ tham chiếu nội bộ sang tiền tố .agents/ và sửa lỗi chính tả trong tiền tố quy tắc tác tử.
    - Dọn dẹp thư mục rác reviewer backup và chuẩn hóa tài liệu superpowers cũ sang docs/specs/ và docs/archive/plans/.
    ```
  - Kiểm tra dung lượng: Nếu vượt quá 35,000 bytes, chuyển thêm mục `2026-09-10` sang archive để đảm bảo nghiêm ngặt `< 35,000 bytes`.
- [ ] **Bước 3.5**: Tối ưu hóa `docs/lessons-learned.md`:
  - Bổ sung Mục Lục Tra Cứu Nhanh (Anchor-based Table of Contents) cho đúng 13 nhóm H2 thực tế.
  - Sửa chuỗi typo tại dòng ~10: `promote it to a formal rule in .agent/rules/` ➔ `promote it to a formal rule in .agents/rules/`.
  - Chuẩn hóa 3 tham chiếu shorthand sang tiền tố `.agents/rules/01-coding.md` và `.agents/rules/03-ui.md`.
  - Gắn badge với file-relative link chuẩn: `> [!NOTE] Promoted to Rule: [01-coding.md](../.agents/rules/01-coding.md)` ở dòng đầu thân bài học tương ứng (không thay đổi text heading).
- [ ] **Bước 3.6**: Cập nhật `docs/plans/README.md`:
  - Bổ sung Bảng Ma Trận Kế Hoạch Triển Khai (Implementation Plans Status Matrix) gồm các cột: Ngày, Tên Plan, Trạng Thái (`Approved`, `Active`, `Completed`, `Archived`), Mô Tả Tóm Tắt. Giữ file trong diện link checking.
- [ ] **Bước 3.7**: Cập nhật `docs/architecture.md`:
  - Cập nhật sơ đồ cây thư mục documentation và agent governance mới; chuẩn hóa 2 tham chiếu shorthand sang `.agents/rules/03-ui.md` và `.agents/rules/01-coding.md`.

#### Giai Đoạn 4: Chuẩn Hóa Quản Trị Tác Tử `.agents/` (100% 16 active files)

_(Lưu ý: Mọi thao tác ghi trong giai đoạn này sẽ kích hoạt phản hồi `ask` từ hook `code-freeze-guard` theo chính sách Scoped Protection, User/Orchestrator bấm approve để tiếp tục)_

- [ ] **Bước 4.1**: Tạo mới `.agents/README.md` (Agent Ecosystem Hub):
  - Định nghĩa kiến trúc Multi-Agent phối hợp chuẩn Antigravity 2.0 (Planner, Reviewer, Orchestrator/Developer, QA).
  - Bản đồ 6 bộ quy tắc (`00-core` đến `05-plan-review`) và kích thước ký tự thực tế.
  - Cơ chế chốt chặn tự động `code-freeze-guard` và chính sách Scoped Protection (Phương án 2).
  - Mục `## Agent Task-to-Model Routing Guide`: Tích hợp toàn bộ nội dung từ `model-routing.md` (bảng phân bổ tier, nguyên tắc chọn model, cost awareness).
  - **Quy tắc liên kết nội bộ**: Các liên kết Markdown trong file này trỏ tới rules, skills, workflows cùng cấp bắt buộc dùng tiền tố `./` (ví dụ `[00-core](./rules/00-core.md)`, `[streaming-patterns](./skills/streaming-patterns.md)`); văn xuôi và backtick dùng `.agents/...`.
- [ ] **Bước 4.2**: Tạo mới `.agents/skills/README.md` (Skills Catalog):
  - Phân loại rõ ràng danh mục kỹ năng:
    - _Nhóm Core Vikini Backend & Fullstack_: `streaming-patterns.md`, `database-migration.md`, `api-patterns.md`, `add-feature.md`, `add-model.md`, `add-translation.md`.
    - _Nhóm Frontend Taste & Motion_: `animation-vocabulary`, `design-taste-frontend`, `emil-design-eng`, `review-animations`, `redesign-existing-projects`.
    - _Nhóm Toàn Diện UI/UX Design System_: `ux-ui-agent-skills/` (chỉ rõ 19 thư mục/tài nguyên thực tế).
  - Bảng chỉ dẫn định tuyến: "Khi thực hiện tác vụ X, agent BẮT BUỘC nạp skill Y".
  - **Quy tắc liên kết**: Liên kết trỏ tới rules dùng `../rules/01-coding.md`; liên kết cùng cấp dùng `./`; văn xuôi và backtick dùng `.agents/...`.
- [ ] **Bước 4.3**: Chỉnh sửa `.agents/rules/02-quality.md`:
  - Sửa chuỗi typo tại dòng ~120: `extract a formal rule into the appropriate .agent/rules/ file` ➔ `extract a formal rule into the appropriate .agents/rules/ file`.
  - Sửa dòng quy ước trong mục Governance-Only Changes: `Đường dẫn file nội bộ viết dạng relative path từ repo root (.agents/rules/01-coding.md, src/lib/core/...).`
  - Chuẩn hóa toàn bộ 19 đường dẫn sang tiền tố `.agents/`:
    - Bảng Pre-Work: `.agents/skills/streaming-patterns.md`, `.agents/skills/database-migration.md`, `.agents/rules/03-ui.md`, `.agents/workflows/debug.md`, `.agents/skills/api-patterns.md`, `.agents/skills/add-feature.md`, `.agents/rules/05-plan-review.md`, `.agents/workflows/audit.md`, `.agents/rules/01-coding.md`.
    - Khối `<important>` sau bảng: `(see .agents/rules/05-plan-review.md)`.
    - Mục "Phân Định Ranh Giới": `.agents/workflows/audit.md`, `.agents/skills/streaming-patterns.md`, `.agents/skills/database-migration.md`, `.agents/skills/api-patterns.md`.
    - Mục "Debugging Protocol": `.agents/workflows/debug.md`.
    - Mục "Bilingual Enforcement": `.agents/rules/04-bilingual.md`.
  - Xác nhận tổng dung lượng ký tự sau chỉnh sửa: ~8,690 ký tự `<= 12,000` ký tự.
- [ ] **Bước 4.4**: Chỉnh sửa `.agents/rules/00-core.md`:
  - Chuẩn hóa dòng 40: `See .agents/rules/02-quality.md for full policy.`
  - Chuẩn hóa dòng 43: `See .agents/rules/05-plan-review.md.`
  - Xác nhận dung lượng: ~2,804 ký tự `<= 12,000` ký tự.
- [ ] **Bước 4.5**: Chỉnh sửa `.agents/rules/01-coding.md`:
  - Chuẩn hóa bảng dòng 16: `Chuẩn song ngữ .agents/rules/04-bilingual.md`.
  - Chuẩn hóa dòng 44: `Read .agents/skills/api-patterns.md for full patterns and examples.`
  - Xác nhận dung lượng: ~9,375 ký tự (sau Prettier) `<= 12,000` ký tự.
- [ ] **Bước 4.6**: Chỉnh sửa `.agents/rules/04-bilingual.md`:
  - Chuẩn hóa dòng 55: `read .agents/skills/add-translation.md for the full workflow.`
  - Xác nhận dung lượng: ~1,707 ký tự `<= 12,000` ký tự.
- [ ] **Bước 4.7**: Chỉnh sửa 3 agent files:
  - `.agents/agents/planner/agent.md`: Chuẩn hóa 2 refs sang `.agents/rules/02-quality.md` và `.agents/rules/01-coding.md` (~6,287 chars <= 10,000 chars).
  - `.agents/agents/qa/agent.md`: Chuẩn hóa 3 refs sang `.agents/rules/04-bilingual.md`, `.agents/rules/01-coding.md`, `.agents/rules/02-quality.md` (~7,296 chars <= 10,000 chars).
  - `.agents/agents/reviewer/agent.md`: Chuẩn hóa 1 ref sang `.agents/rules/04-bilingual.md` (~4,985 chars <= 10,000 chars).
- [ ] **Bước 4.8**: Chỉnh sửa `.agents/agents/reviewer/mental-simulation.md`:
  - Chuẩn hóa 4 refs sang `.agents/skills/streaming-patterns.md`, `.agents/skills/database-migration.md`, `.agents/skills/api-patterns.md`, `.agents/rules/04-bilingual.md` (~4,919 chars <= 10,000 chars).
- [ ] **Bước 4.9**: Chỉnh sửa 3 skills:
  - `.agents/skills/add-feature.md`: Chuẩn hóa 5 refs sang `.agents/skills/...` và `.agents/rules/...`.
  - `.agents/skills/add-model.md`: Chuẩn hóa 1 ref sang `.agents/skills/add-translation.md`.
  - `.agents/skills/add-translation.md`: Chuẩn hóa 1 ref sang `.agents/rules/04-bilingual.md`.
- [ ] **Bước 4.10**: Chỉnh sửa 2 workflows:
  - `.agents/workflows/audit.md`: Chuẩn hóa 2 refs sang `.agents/rules/01-coding.md` và `.agents/skills/api-patterns.md`.
  - `.agents/workflows/post-fix.md`: Sửa chuỗi typo tại dòng ~29: `extract a formal rule into the appropriate .agent/rules/ file` ➔ `extract a formal rule into the appropriate .agents/rules/ file`.

#### Giai Đoạn 5: Xóa Bỏ Tệp Thừa & Dọn Dẹp Rác Workspace

_(Lưu ý: Thao tác xóa `.agents/agents/reviewer.backup/` sẽ kích hoạt phản hồi `ask` từ hook, User/Orchestrator bấm approve để tiếp tục)_

- [ ] **Bước 5.1**: Xóa tệp `docs/context.md` (đã hợp nhất vào `overview.md` và lưu bản cũ trong `docs/archive/context-legacy.md`).
- [ ] **Bước 5.2**: Xóa tệp `docs/model-routing.md` (đã chuyển nội dung sang `.agents/README.md`).
- [ ] **Bước 5.3**: Xóa toàn bộ thư mục `docs/superpowers/` (các tệp bên trong đã chuyển vào `docs/specs/` và `docs/archive/plans/`).
- [ ] **Bước 5.4**: Xóa sạch thư mục untracked rác `.agents/agents/reviewer.backup/` khỏi ổ đĩa.

#### Giai Đoạn 6: Kiểm Chứng Toàn Diện (Verification Gate & Test Integrity)

_(Lưu ý: Các lệnh trong giai đoạn này như `npx prettier ...`, `npx eslint ...`, `node scripts/verify-docs.mjs` sẽ kích hoạt phản hồi `ask` từ hook `code-freeze-guard` theo chính sách Scoped Protection do chứa cờ mutating `--write` hoặc không thuộc `READ_ONLY_COMMANDS`. Người điều phối hoặc User cần bấm Chấp thuận (`approve`) khi hook yêu cầu)_

- [ ] **Bước 6.1**: Thực thi Prettier Write định dạng trước toàn bộ danh sách tường minh 23 tệp Markdown và 1 script:
  ```bash
  npx prettier --write docs/README.md docs/overview.md docs/models.md docs/architecture.md docs/CHANGELOG.md docs/lessons-learned.md docs/plans/README.md .superpowers/sdd/progress.md .agents/README.md .agents/skills/README.md .agents/rules/00-core.md .agents/rules/01-coding.md .agents/rules/02-quality.md .agents/rules/04-bilingual.md .agents/agents/planner/agent.md .agents/agents/qa/agent.md .agents/agents/reviewer/agent.md .agents/agents/reviewer/mental-simulation.md .agents/skills/add-feature.md .agents/skills/add-model.md .agents/skills/add-translation.md .agents/workflows/audit.md .agents/workflows/post-fix.md scripts/verify-docs.mjs
  ```
- [ ] **Bước 6.2**: Kiểm tra định dạng Prettier Check trên chính danh sách tường minh:
  ```bash
  npx prettier --check docs/README.md docs/overview.md docs/models.md docs/architecture.md docs/CHANGELOG.md docs/lessons-learned.md docs/plans/README.md .superpowers/sdd/progress.md .agents/README.md .agents/skills/README.md .agents/rules/00-core.md .agents/rules/01-coding.md .agents/rules/02-quality.md .agents/rules/04-bilingual.md .agents/agents/planner/agent.md .agents/agents/qa/agent.md .agents/agents/reviewer/agent.md .agents/agents/reviewer/mental-simulation.md .agents/skills/add-feature.md .agents/skills/add-model.md .agents/skills/add-translation.md .agents/workflows/audit.md .agents/workflows/post-fix.md scripts/verify-docs.mjs
  ```
  Xác nhận exit code 0 (`All matched files use Prettier code style!`).
- [ ] **Bước 6.3**: Chạy ESLint kiểm chứng script `scripts/verify-docs.mjs`:
  ```bash
  npx eslint scripts/verify-docs.mjs
  ```
  Xác nhận exit code 0 sạch sẽ không có cảnh báo/lỗi `no-undef`.
- [ ] **Bước 6.4**: Chạy script kiểm chứng toàn diện độc lập với đầy đủ cờ nghiêm ngặt (chạy trên mã nguồn đã format):
  ```bash
  node scripts/verify-docs.mjs --strict-shorthand --expected-headings=83
  ```
  Xác nhận đạt 100%:
  - [1/5] Zero broken links (CommonMark relative resolution, bao gồm cả `docs/plans/README.md`, link NOTE `./archive/...`, link badge `../.agents/...`).
  - [2/5] Zero legacy references (`docs/context.md`, `docs/model-routing.md`, `docs/superpowers/`, `.agent/rules/`).
  - [3/5] Zero shorthand prefixes (`rules/`, `skills/`, `workflows/` không có `.agents/`) trên toàn bộ 16 active governance files và 3 hubs mới.
  - [4/5] All rules <= 12,000 chars và all agents <= 10,000 chars (xác nhận lại sau Prettier format).
  - [5/5] `docs/CHANGELOG.md` < 35,000 bytes VÀ tổng số headings khớp chính xác 83.
  - Kết thúc với thông điệp: `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<` (Exit code 0).
- [ ] **Bước 6.5**: Chạy kiểm thử tự động của Code Freeze Guard:
  ```bash
  npm run test:run -- .agents/scripts/code-freeze-guard.test.ts
  ```
  Xác nhận 66/66 test cases tiếp tục PASS tuyệt đối.
- [ ] **Bước 6.6**: Chạy bộ kiểm chứng toàn diện của dự án:
  ```bash
  npm run verify
  ```
  (Gồm `npm run type-check`, `npm run lint`, `npm run test:run`). Xác nhận toàn bộ hệ thống xanh sạch.

---

### 8. Verification Plan & Test Contract

#### 8.1. Kiểm Tra Toàn Vẹn Liên Kết, Negative Legacy Grep, Shorthand Grep & Dynamic Headings (Contract 8.1)

- **Mục tiêu**:
  - Thực thi thông qua script độc lập `scripts/verify-docs.mjs` nhằm loại bỏ 100% rủi ro quoting/escaping trên bash và PowerShell 5.1.
  - Bóc tách toàn bộ inline code span (`` `...` ``) và fenced code blocks (` ```...``` `) trước khi match link Markdown `[text](href)`.
  - Phân giải liên kết tương đối chuẩn xác theo thư mục chứa file: kiểm tra `targetPath.startsWith("/")` trước `path.isAbsolute(targetPath)` để tương thích hoàn toàn trên môi trường Windows.
  - Quét liên kết bao gồm cả `docs/plans/README.md`, liên kết NOTE `./archive/CHANGELOG-legacy.md` trong `docs/CHANGELOG.md`, và liên kết badge `../.agents/rules/01-coding.md` trong `docs/lessons-learned.md`. Các tệp trong `docs/archive/**` được coi là tài liệu đóng băng lịch sử, không tham gia link checking.
  - **Negative Grep (Legacy Paths)**: Quét toàn bộ repo (trừ `docs/archive/**`, `docs/CHANGELOG.md`, và chính file plan) khẳng định KHÔNG CÒN bất kỳ tham chiếu nào tới 4 đường dẫn cũ:
    1. `docs/context.md`
    2. `docs/model-routing.md`
    3. `docs/superpowers/`
    4. `.agent/rules/` (typo thiếu `s`)
  - **Negative Grep (Shorthand Prefixes)**: Với cờ `--strict-shorthand`, quét toàn bộ 16 active governance files và 3 navigation hubs mới khẳng định KHÔNG CÒN bất kỳ tham chiếu dạng rút gọn nào (`rules/...`, `skills/...`, `workflows/...` đứng đầu không có `.agents/`). Link nội bộ trong hub dùng tiền tố `./` không bị vi phạm.
  - **Dynamic Headings Assert & Archive Existence**: Với cờ `--expected-headings=83` (chặn hậu tố rác bằng `/^\d+$/`), assert trực tiếp tổng số headings của CHANGELOG hiện tại và legacy changelog phải khớp chính xác 83. Nếu thiếu bất kỳ tệp nào trong 2 tệp, script bắt buộc báo lỗi FAIL và thoát mã 1.
- **Lệnh thực thi**:
  ```bash
  node scripts/verify-docs.mjs --strict-shorthand --expected-headings=83
  ```
- **Tiêu chí Đạt**: Script in `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<` và thoát mã 0.

#### 8.2. Kiểm Tra Ràng Buộc Governance Ký Tự (Contract 8.2)

- **Mục tiêu**: Bắt buộc mọi file rule `<= 12,000` ký tự; file agent `<= 10,000` ký tự. Tích hợp sẵn trong mục `[4/5]` của `scripts/verify-docs.mjs`.
- **Lệnh thực thi**:
  ```bash
  node scripts/verify-docs.mjs
  ```
- **Tiêu chí Đạt**: Không có file nào vượt ngưỡng; in `PASS: All rules <= 12,000 chars and all agents <= 10,000 chars.` và mã thoát 0.

#### 8.3. Kiểm Tra Dung Lượng CHANGELOG, Bảo Toàn Headings & Sandbox Negative Probe Khi Thiếu Archive (Contract 8.3)

- **Mục tiêu**:
  - `docs/CHANGELOG.md` có dung lượng `< 35,000 bytes`.
  - Tổng số heading `^## ` của (`docs/CHANGELOG.md` + `docs/archive/CHANGELOG-legacy.md`) bằng chính xác $N + 1 = 83$ headings.
  - **Sandbox Negative Probe 6b (Khẳng định bắt lỗi khi thiếu archive cô lập)**: Tạo môi trường sandbox tạm thời chỉ gồm `scripts/verify-docs.mjs` và `docs/CHANGELOG.md` (cố tình không có archive), chạy với `--expected-headings=83` và assert mã thoát là 1 đồng thời stderr chứa thông điệp `must exist`, rồi tự động dọn dẹp thư mục tạm.
- **Lệnh thực thi chính**:
  ```bash
  node scripts/verify-docs.mjs --expected-headings=83
  ```
- **Lệnh thực thi Sandbox Negative Probe 6b (Đã kiểm chứng trên Git Bash và PowerShell 5.1)**:
  ```bash
  node -e "const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');const d=fs.mkdtempSync(path.join(os.tmpdir(),'vd-'));fs.mkdirSync(path.join(d,'docs'),{recursive:true});fs.cpSync('scripts/verify-docs.mjs',path.join(d,'scripts','verify-docs.mjs'));fs.copyFileSync('docs/CHANGELOG.md',path.join(d,'docs','CHANGELOG.md'));const r=spawnSync(process.execPath,['scripts/verify-docs.mjs','--expected-headings=83'],{cwd:d,encoding:'utf8'});fs.rmSync(d,{recursive:true,force:true});const ok=r.status===1&&r.stderr.includes('must exist');console.log('Exit Code:',r.status,'| archive-missing FAIL detected:',ok);process.exit(ok?0:1);"
  ```
- **Tiêu chí Đạt**:
  - Lệnh chính: Thoát mã 0 khi cả 2 file tồn tại và tổng heading bằng 83.
  - Lệnh Sandbox Negative Probe 6b: Thoát mã **0** (in `Exit Code: 1 | archive-missing FAIL detected: true`). Chạy an toàn ở cả trạng thái trước và sau khi triển khai mà không gây mâu thuẫn hay phụ thuộc vào cây làm việc hiện tại.

#### 8.4. Kiểm Tra Đảm Bảo Không Làm Gãy Hook / Code Freeze Guard (Contract 8.4)

- **Mục tiêu**: Đảm bảo 66/66 test cases của `code-freeze-guard.test.ts` giữ nguyên trạng thái xanh (PASS).
- **Lệnh thực thi**:
  ```bash
  npm run test:run -- .agents/scripts/code-freeze-guard.test.ts
  ```
- **Tiêu chí Đạt**: 66 passed, 0 failed.

#### 8.5. Scoped Format Check, Script ESLint & Full Verification (Contract 8.5)

- **Mục tiêu**: Đảm bảo toàn bộ 23 tệp markdown và 1 tệp script đạt chuẩn Prettier, script verify đạt chuẩn ESLint, và toàn bộ codebase đạt `npm run verify` sạch sẽ.
- **Lệnh thực thi**:
  ```bash
  npx prettier --check docs/README.md docs/overview.md docs/models.md docs/architecture.md docs/CHANGELOG.md docs/lessons-learned.md docs/plans/README.md .superpowers/sdd/progress.md .agents/README.md .agents/skills/README.md .agents/rules/00-core.md .agents/rules/01-coding.md .agents/rules/02-quality.md .agents/rules/04-bilingual.md .agents/agents/planner/agent.md .agents/agents/qa/agent.md .agents/agents/reviewer/agent.md .agents/agents/reviewer/mental-simulation.md .agents/skills/add-feature.md .agents/skills/add-model.md .agents/skills/add-translation.md .agents/workflows/audit.md .agents/workflows/post-fix.md scripts/verify-docs.mjs
  npx eslint scripts/verify-docs.mjs
  npm run verify
  ```
- **Tiêu chí Đạt**: Cả 3 lệnh thoát mã 0, không có lỗi linter, không có lỗi type-check, toàn bộ test suite chạy thành công.

---

### 9. Rủi Ro Tiềm Ẩn & Phương Án Phòng Ngừa (Risks & Mitigations)

| #   | Rủi Ro Tiềm Ẩn                                                                  | Mức Độ     | Phương Án Phòng Ngừa & Xử Lý                                                                                                                                                                                                                                                                                                                                                                     |
| :-- | :------------------------------------------------------------------------------ | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Gãy Hook Code Freeze Guard do thay đổi cấu trúc `docs/plans/`**               | Cao        | Thư mục `docs/plans/` được bảo tồn nguyên vị trí. Thư mục archive kế hoạch cũ được đặt tại `docs/archive/plans/` (nằm ngoài phạm vi quét `plansDir` của guard). Không thay đổi mtime của các plan active.                                                                                                                                                                                        |
| 2   | **Làm hỏng các unit tests của `code-freeze-guard.test.ts`**                     | Cao        | Không chỉnh sửa cấu trúc logic của `.agents/scripts/code-freeze-guard.js` và `scripts/code-freeze-guard.js`. Chạy test suite sau mỗi thao tác.                                                                                                                                                                                                                                                   |
| 3   | **Gãy liên kết nội bộ khi di chuyển superpowers và hợp nhất docs**              | Trung bình | Đã bổ sung Bước 2.6 cập nhật dòng 4 của `.superpowers/sdd/progress.md`. Chạy script Contract 8.1 lọc code block và kiểm tra Negative Grep đảm bảo zero broken link và zero leftover reference.                                                                                                                                                                                                   |
| 4   | **Bị chặn thao tác bởi PreToolUse Hook khi sửa `.agents/**` hoặc ghi script\*\* | Trung bình | Theo chính sách Scoped Protection (Phương án 2), mọi thao tác ghi `.agents/**`, ghi `scripts/verify-docs.mjs`, lệnh xóa file ngoài allowlist, hoặc các lệnh format/lint trong Giai đoạn 6 sẽ kích hoạt prompt `ask`. Người điều phối hoặc User bấm Chấp thuận (`approve`) để hoàn tất.                                                                                                           |
| 5   | **Mất mát thông tin lịch sử của dự án khi cắt CHANGELOG**                       | Thấp       | Toàn bộ 74 mục cũ được lưu trữ nguyên vẹn vào `docs/archive/CHANGELOG-legacy.md`. Script Contract 8.1 / 8.3 kiểm chứng tổng số headings trước và sau cắt bằng đúng 83 để khẳng định không mất bất kỳ mục nào.                                                                                                                                                                                    |
| 6   | **ESLint báo lỗi `no-undef` trên `scripts/verify-docs.mjs`**                    | Cao        | File `.mjs` không thuộc glob TypeScript trong `eslint.config.mjs`. Đã phòng ngừa triệt để bằng header `/* global process, console, Buffer */`, đã kiểm chứng `npx eslint scripts/verify-docs.mjs` exit 0.                                                                                                                                                                                        |
| 7   | **Prettier check thất bại do ô nhiễm baseline ngoài phạm vi**                   | Trung bình | Baseline repo có sẵn 9 file `.md` không đúng style. Phòng ngừa triệt để bằng cách chỉ định danh sách tường minh đúng 23 tệp `.md` và 1 script, thực hiện `prettier --write` trước rồi mới `prettier --check`.                                                                                                                                                                                    |
| 8   | **False-PASS khi thiếu tệp archive trong script kiểm chứng (MAJOR-H/I)**        | Cao        | Script trước đây in NOTE và exit 0 khi thiếu archive. Đã khắc phục triệt để: khi có `--expected-headings`, thiếu archive lập tức báo FAIL và exit 1 (chặn cả hậu tố rác bằng `/^\d+$/`). Contract 8.3 sử dụng Negative Probe 6b sandbox cô lập (tự tạo thư mục tạm và assert 'must exist') với tiêu chí đạt exit 0, chạy an toàn ở mọi thời điểm mà không phụ thuộc vào trạng thái cây làm việc. |

---

## Audit History

_(Khu vực dành riêng cho Lead Reviewer ghi nhận xét thẩm định)_

### Audit Run 1

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 1 (bản đầu tiên, chưa đánh số revision)
- **Kiểm chứng lỗi cũ**: N/A — đây là lượt thẩm định đầu tiên.

#### Commands Executed

| #   | Lệnh                                                                                            |    Exit     | Kết quả liên quan                                                                                                                                                    |
| :-- | :---------------------------------------------------------------------------------------------- | :---------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npx vitest run .agents/scripts/code-freeze-guard.test.ts`                                      |      0      | `Tests 66 passed (66)` — khớp claim 66/66 của plan.                                                                                                                  |
| 2   | `npm run verify` (baseline)                                                                     |      0      | type-check + lint sạch; `Test Files 59 passed`, `Tests 760 passed`.                                                                                                  |
| 3   | Script 8.1 của plan (link checker, chỉ đọc file) chạy trên cây hiện tại                         | xem ghi chú | `271 files; broken=1` → `docs/plans/2026-09-29-...-plan.md -> path`. Script gốc gọi `process.exit(1)` khi có broken → **Test Contract 8.1 FAIL ngay trên baseline**. |
| 4   | Script 8.2 (đếm ký tự, chỉ đọc)                                                                 |      0      | Rules: 00=2788, 01=9404, 02=8541, 03=5386, 04=1699, 05=6938. Agents: planner=6271, qa=7272, reviewer=4977, reviewer.backup=4857. Khớp số liệu plan.                  |
| 5   | `node -e` probe regex status của guard với header `> **Trạng thái**: Chờ Thẩm Định (In Review)` |      0      | `false` — guard KHÔNG nhận diện header này là pending.                                                                                                               |
| 6   | `git diff --no-index --stat` reviewer.backup/agent.md ↔ reviewer/agent.md                       |      0      | Khác 7 dòng; 3 file vệ tinh còn lại `cmp` identical.                                                                                                                 |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     |      Kết quả      | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :--------------------------- | :---------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    |       PASS        | [CMD #2] baseline `npm run verify` exit 0. Plan không chạm `package.json`, tsconfig, ESLint; không có import module mới; không phụ thuộc `.env`.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **S2 Lifecycle & Teardown**  |    N/A (PASS)     | Docs-only, không có tài nguyên runtime. Tính toàn vẹn guard: [CMD #1] 66/66 pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **S3 Database & Temporal**   |        N/A        | Plan cam kết Zero-Code Mutation (§4.1), không chạm `supabase/migrations/**`, không đổi schema.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **S4 Cross-Task State Flow** |       PASS        | [SRC] `.agents/scripts/code-freeze-guard.js:192-229`: `readdirSync(docs/plans)` không đệ quy + filter `.md` & `!== README.md`, chọn plan mới nhất theo `mtimeMs`. [ADV] T1: implementer tạo `docs/archive/plans/*.md` \| T2: guard quét `docs/plans/` \| T3: file archive nằm ngoài `plansDir` → không bị xét → AN TOÀN. T1: sửa `docs/plans/README.md` → bị filter loại → AN TOÀN.                                                                                                                                                                                                 |
| **S5 Security Boundary**     | PASS (có ghi chú) | [SRC] guard.js:38 `UNFROZEN_PREFIXES = ["docs/"]` → ghi `docs/` luôn allow; guard.js:283-290, 475-479 → mọi ghi `.agents/**` luôn `ask`. [ADV-TOCTOU] T1: header plan là "Chờ Thẩm Định (In Review)" \| T2: guard regex (guard.js:208) test header \| T3: [CMD #5] trả `false` → plan không bị coi là pending; nếu sau này có Revision mới mà token cũ còn ở dòng cuối, guard sẽ **không** vô hiệu hóa token như `05-plan-review.md §5` mô tả → rủi ro thấp với plan này (vì `docs/` vốn unfrozen, `.agents/` vốn luôn ask), xem MINOR-4. Không có secret/credential trong phạm vi. |
| **S6 External Resilience**   |        N/A        | Không có lời gọi AI provider / serverless route.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Domain Inquiry**           |      Xem lỗi      | Link integrity, token budget của CHANGELOG, tính nhất quán quy ước đường dẫn governance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

#### Phân Loại Lỗi

**[MAJOR-1] Tiêu chí cắt CHANGELOG mâu thuẫn với mục tiêu dung lượng; thiếu kiểm chứng không-mất-dữ-liệu.**

- Bước 2.1/3.4 cắt "từ khởi đầu đến hết 31/12/2025" và "giữ lại đầy đủ các bản ghi của năm 2026", đồng thời cam kết file mới `< 35 KB` (~25 KB).
- [CMD] `grep "^## "` trên `docs/CHANGELOG.md`: 83 heading năm 2026 và chỉ 2 heading năm 2025 (dòng 1730, 1740 — ~20 dòng cuối file). Cắt theo mốc 2025 chỉ giảm ~1 KB → file vẫn ~137 KB. [CMD] `head -n 300 docs/CHANGELOG.md | wc -c` = 38,271 bytes (mới tới mục 2026-09-05) → muốn `< 35 KB` thì chỉ giữ được khoảng từ ~2026-09-10 trở đi.
- **Yêu cầu**: (a) Định nghĩa lại mốc cắt cụ thể, đo được (ví dụ giữ các mục từ `2026-09-10` trở đi, hoặc "N mục gần nhất") và đặt tên archive đúng nội dung; (b) Thêm bước Verification bằng script khẳng định `CHANGELOG.md < 35,000 bytes` VÀ tổng số heading `^## ` của (current + legacy) bằng số heading ban đầu (85) để chứng minh không mất mục nào; (c) Nêu policy rolling-archive cho các lần sau, vì `02-quality.md` bắt buộc append CHANGELOG sau mỗi task.

**[MAJOR-2] Test Contract 8.1 (link checker) không đạt được ngay trên baseline và có lỗ hổng phát hiện.**

- [CMD #3] Script phát hiện chính file plan này là broken (chuỗi ví dụ markdown-link `text`/`path` trong văn xuôi §8.1) → `process.exit(1)` → Bước 6.2 không thể PASS nếu không sửa plan hoặc script. Mọi file có ví dụ markdown link trong code span/fenced block đều gây false positive.
- Script chỉ bắt cú pháp markdown link, không bắt tham chiếu dạng backtick — trong khi tài liệu Vikini chủ yếu tham chiếu file bằng backtick. [SRC] `.superpowers/sdd/progress.md:4` còn trỏ `docs/superpowers/plans/2026-09-04-chat-core-ux-ui-augmentation.md` — sẽ thành tham chiếu treo sau Bước 5.3 mà script không phát hiện (và thư mục `.superpowers/` cũng nằm ngoài phạm vi quét).
- Fallback `path.resolve(process.cwd(), t)` che giấu link relative sai theo vị trí file (GitHub render relative theo file chứa link, không theo repo root).
- **Yêu cầu**: (a) Script phải loại bỏ fenced code block và inline code trước khi match; (b) Bổ sung bước grep negative cho các đường dẫn bị xóa/di chuyển (`docs/context.md`, `docs/model-routing.md`, `docs/superpowers/`, `.agent/rules/`) trên `docs/`, `.agents/`, `.superpowers/` (loại trừ `docs/archive/**`, các mục CHANGELOG lịch sử và chính file plan), tiêu chí 0 kết quả; (c) Xử lý `.superpowers/sdd/progress.md` (cập nhật đường dẫn hoặc ghi rõ out-of-scope).

**[MAJOR-3] Chuẩn hóa đường dẫn trong `02-quality.md` tự mâu thuẫn với quy ước của chính file đó và để lại 2 quy ước song song.**

- [SRC] `.agents/rules/02-quality.md` mục "Governance-Only Changes": _"Đường dẫn file nội bộ viết dạng relative path từ repo root (`rules/01-coding.md`, ...)"_ — quy ước hiện hành là dạng rút gọn `rules/...`. Bước 4.3 đổi bảng Pre-Work sang `.agents/...` nhưng không sửa dòng quy ước này.
- Bước 4.3 chỉ đổi bảng Pre-Work, bỏ sót trong cùng file: `rules/05-plan-review.md` (khối `<important>` sau bảng), `skills/streaming-patterns.md` / `skills/database-migration.md` / `skills/api-patterns.md` (mục "Tham Chiếu Tài Sản Kỹ Thuật"), `workflows/audit.md`, `workflows/debug.md` (Debugging Protocol), `rules/04-bilingual.md` (Bilingual Enforcement). Ngoài file: [SRC] `.agents/rules/00-core.md:40,43`, `.agents/rules/01-coding.md:16,44` vẫn dùng dạng rút gọn.
- **Yêu cầu**: Chọn MỘT quy ước và áp dụng nhất quán: (A) giữ dạng rút gọn và chỉ sửa typo `.agent/`, hoặc (B) chuyển toàn bộ sang `.agents/...` — khi đó phải liệt kê đầy đủ mọi vị trí trong rules/workflows/skills, sửa luôn dòng quy ước ở mục Governance-Only, bổ sung grep negative cho tiền tố rút gọn vào Verification, và ghi số ký tự dự kiến sau sửa của từng rule bị chạm.

**[MAJOR-4] Thiếu nhất quán danh mục file & thiếu living docs.**

- §3.1 đánh dấu `docs/architecture.md` là **[MODIFY]** ("cập nhật sơ đồ thư mục docs & agents mới"), nhưng §6.B (7 tệp) và §7 không có bước nào cho `architecture.md` → implementer không biết có sửa hay không.
- `02-quality.md` Post-Change Checklist bắt buộc "Update `docs/CHANGELOG.md` with a summary of what changed"; plan chỉ cắt CHANGELOG, không có bước thêm entry cho chính đợt tái cấu trúc này (thiếu living docs theo rubric `05-plan-review.md §4`).
- **Yêu cầu**: Đồng bộ `architecture.md` giữa §3.1, §6, §7 (thêm bước cụ thể hoặc đổi thành KEEP); thêm bước ghi entry CHANGELOG `2026-09-29: Docs/Rules/Agents Restructuring` sau khi cắt.

**[MINOR-1] Số dòng typo sai.** [SRC] Grep thực tế: `docs/lessons-learned.md:10` (plan ghi 11), `.agents/rules/02-quality.md:120` (plan ghi 103), `.agents/workflows/post-fix.md:29` (plan ghi 32). Nên chỉ định theo nội dung chuỗi thay vì số dòng.

**[MINOR-2] TOC `lessons-learned.md` không khớp cấu trúc thực.** [SRC] File có 13 nhóm H2 (TypeScript and Type Safety, CSS and Theming, i18n, UI and Styling, API and Streaming, Database and Queries, Translation and Bilingual, Configuration and Environment, Gemini API, API Response Parsing, UI Conditional Rendering, AI Streaming and Thinking Mode, Vector Embeddings & Supabase TypeGen Lifecycle), khác 8 nhóm plan liệt kê ("File System", "Testing/Mocks", "Next.js App Router" không tồn tại). TOC nên sinh từ H2 thực tế. Chèn tiền tố `[Promoted to Rule: ...]` vào heading sẽ đổi slug anchor → đặt badge ở dòng đầu thân mục thay vì trong heading.

**[MINOR-3] Số liệu skill catalog.** [CMD] `ls .agents/skills/ux-ui-agent-skills | wc -l` = 19 mục (không phải "24 modules"). Kiểm đếm lại khi viết `.agents/skills/README.md`.

**[MINOR-4] Header trạng thái không được guard nhận diện.** [CMD #5] `Chờ Thẩm Định (In Review)` không khớp regex guard.js:208. Đề xuất dùng `> **Trạng thái**: In Review` (hoặc `Chờ Duyệt`) cho các Revision sau để cơ chế vô hiệu hóa token theo `05-plan-review.md §5` hoạt động đúng.

**[MINOR-5] Kỳ vọng tương tác hook.** Mọi thao tác ghi `.agents/**` (Bước 4.1–4.4) và xóa `.agents/agents/reviewer.backup/` (Bước 5.4, `rm` ngoài allowlist) luôn bị guard trả `ask` bất kể `[PLAN_APPROVED]` [SRC guard.js:475-479] — nên ghi rõ là cần User xác nhận. Trước khi xóa, lưu ý `reviewer.backup/agent.md` khác bản hiện hành 7 dòng [CMD #6] — xác nhận phần khác biệt không cần giữ.

**[MINOR-6] Bất nhất tên thư mục archive.** §6/§7 dùng `docs/archive/plans/` nhưng Assumption 4.2 và Risk #1 nói về `docs/plans/archive/`. Thống nhất một tên.

**[MINOR-7] Ranh giới `models.md`.** Mục tiêu 2 là "phân định rõ" model ứng dụng vs model routing cho agent, nhưng Bước 3.3 lại gộp routing guide vào `docs/models.md` (registry model của app). Cân nhắc đặt routing guide ở `.agents/README.md` và để `models.md` chỉ link sang.

**[MINOR-8] `format:check` baseline chưa xác minh.** `package.json:16` `prettier --check "**/*.{...,md}"` bao phủ toàn bộ docs; lệnh không nằm trong allowlist nên reviewer không chạy → `UNVERIFIED`. Đề nghị User chạy `npm run format:check` trước khi triển khai để tách lỗi baseline khỏi lỗi do plan gây ra.

#### Kết Luận

**[CHANGES_REQUESTED]** — Còn 4 lỗi `[MAJOR]`. Việc cần làm cho Revision 2:

1. MAJOR-1: Định nghĩa lại mốc cắt CHANGELOG đo được + script kiểm tra `< 35,000 bytes` và bảo toàn toàn bộ heading.
2. MAJOR-2: Sửa link checker (bỏ qua code span/fenced block), thêm grep negative cho đường dẫn bị xóa/di chuyển, xử lý `.superpowers/sdd/progress.md`.
3. MAJOR-3: Chọn một quy ước đường dẫn duy nhất và áp dụng đầy đủ (kể cả dòng quy ước trong `02-quality.md`), có grep kiểm chứng.
4. MAJOR-4: Đồng bộ `architecture.md` giữa §3.1/§6/§7; thêm bước ghi CHANGELOG cho đợt tái cấu trúc.

### Audit Run 2

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 2

#### Kiểm Chứng Lỗi Cũ (so với Audit Run 1)

| Lỗi Run 1                                               | Trạng thái | Ghi chú                                                                                                                                                                                                                                                                                        |
| :------------------------------------------------------ | :--------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-1 (mốc cắt CHANGELOG, bảo toàn heading)           |   ĐÃ SỬA   | Mốc 2026-09-10 đo được; Contract 8.3 kiểm `< 35,000 bytes` + tổng heading; có Rolling Archive Policy. [CMD #3] `grep -c "^## " docs/CHANGELOG.md` = 82 (con số 85 ở Run 1 là sai của reviewer — plan dùng 82 là đúng). 8 mục đầu = dòng 1–255 = 31,977 bytes (plan ghi ~29,162 — xem MINOR-2). |
| MAJOR-2 (link checker + negative grep + `.superpowers`) |  CHƯA ĐẠT  | Đã thêm strip code, negative grep và Bước 2.5 cho `progress.md:4`, nhưng script mới không chạy được và negative grep tự fail — xem MAJOR-A, B, C, E.                                                                                                                                           |
| MAJOR-3 (một quy ước đường dẫn duy nhất)                |  CHƯA ĐẠT  | Chọn Phương án B nhưng chỉ phủ 4 rule + 1 workflow, không có grep negative cho tiền tố rút gọn — xem MAJOR-D.                                                                                                                                                                                  |
| MAJOR-4 (`architecture.md` + living docs)               |   ĐÃ SỬA   | Bước 3.7 + Bước 3.4 (entry CHANGELOG).                                                                                                                                                                                                                                                         |
| MINOR-1 → MINOR-7                                       |   ĐÃ SỬA   | Chỉ định typo theo chuỗi; TOC 13 H2 thực tế, badge ngoài heading; 19 mục `ux-ui-agent-skills`; header `In Review` khớp regex guard; ghi rõ tương tác hook `ask`; thống nhất `docs/archive/plans/`; routing guide chuyển sang `.agents/README.md`.                                              |
| MINOR-8 (baseline prettier)                             | UNVERIFIED | Lệnh prettier ngoài allowlist — xem MINOR-5.                                                                                                                                                                                                                                                   |

#### Commands Executed

| #   | Lệnh                                                                                                                               | Exit | Kết quả liên quan                                                                                                                                                                                                                                                                                                                          |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------- | :--: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npx vitest run .agents/scripts/code-freeze-guard.test.ts`                                                                         |  0   | `Tests 66 passed (66)`.                                                                                                                                                                                                                                                                                                                    |
| 2   | `npm run type-check`                                                                                                               |  0   | `tsc --noEmit` sạch.                                                                                                                                                                                                                                                                                                                       |
| 3   | `grep -c "^## "` + `head -n 255 docs/CHANGELOG.md \| wc -c`                                                                        |  0   | 82 heading; 8 mục giữ lại (dòng 1–255) = 31,977 bytes; tổng file 138,134 bytes.                                                                                                                                                                                                                                                            |
| 4   | `grep -rnE` 4 đường dẫn cũ trên toàn repo (cả file `.md` và non-`.md`, trừ `node_modules`/`.git`)                                  |  0   | Chỉ 6 vị trí: `02-quality.md:120`, `post-fix.md:29`, `lessons-learned.md:10`, `.superpowers/sdd/progress.md:4`, `CHANGELOG.md:931,1703` (2 dòng cuối thuộc phần chuyển sang archive). Không có tham chiếu non-md → phạm vi sửa của plan ĐỦ cho baseline.                                                                                   |
| 5   | `node -e` probe: cùng regex `/docs\/superpowers\//g` gọi `.test()` trên chuỗi A (match ở offset 41) rồi chuỗi B (match ở offset 0) |  0   | `fileA true lastIndex 58` → `fileB false` — **false negative**.                                                                                                                                                                                                                                                                            |
| 6   | `node -e` probe: 2 dòng cuối của Living Docs entry Bước 3.4 với regex `.agent/rules/` và `docs/superpowers/`                       |  0   | `true true` → entry mới tự vi phạm negative grep.                                                                                                                                                                                                                                                                                          |
| 7   | `bash -n` trên thân lệnh Contract 8.1 (dòng 320–397 của plan)                                                                      |  2   | `unexpected EOF while looking for matching` backtick → lệnh không parse được.                                                                                                                                                                                                                                                              |
| 8   | `grep -rnoE` tham chiếu dạng rút gọn `(rules\|skills\|workflows)/<name>.md` trong `.agents/**` và `docs/*.md`                      |  0   | Ngoài 4 rule plan liệt kê còn: `agents/planner/agent.md` (2), `agents/qa/agent.md` (3), `agents/reviewer/agent.md` (1), `reviewer/mental-simulation.md` (4), `skills/add-feature.md` (5), `skills/add-model.md` (1), `skills/add-translation.md` (1), `workflows/audit.md` (2), `docs/architecture.md` (2), `docs/lessons-learned.md` (3). |
| 9   | `grep -rnoE` link markdown có `/` trong `docs/*.md`                                                                                |  0   | Quy ước link thực tế là file-relative: `docs/contracts.md:491-494` → `(./database-schema.md)`…, `docs/models.md:284` → `(./contracts.md)`.                                                                                                                                                                                                 |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     |  Kết quả   | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                           |
| :--------------------------- | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    |    PASS    | [CMD #2] type-check sạch. Plan không chạm `package.json`, tsconfig, ESLint, không import module mới; §4.1 Zero-Code Mutation.                                                                                                                                                                                                                                                                                        |
| **S2 Lifecycle & Teardown**  | N/A (PASS) | Docs-only; không có tài nguyên runtime. Toàn vẹn guard: [CMD #1] 66/66.                                                                                                                                                                                                                                                                                                                                              |
| **S3 Database & Temporal**   |    N/A     | Không chạm `supabase/migrations/**` hay schema.                                                                                                                                                                                                                                                                                                                                                                      |
| **S4 Cross-Task State Flow** |    PASS    | [SRC] `.agents/scripts/code-freeze-guard.js:192-198` `readdirSync(docs/plans)` không đệ quy, loại `README.md`. [ADV] T1: tạo `docs/archive/plans/*.md` \| T2: guard quét `docs/plans/` \| T3: file nằm ngoài `plansDir` → AN TOÀN. Lưu ý: Contract 8.3 cố định `=== 83`; nếu plan `2026-09-28-supabase-cli-typegen…` (CHANGELOG đang ở trạng thái `M`) thêm entry trước khi task này chạy, số kỳ vọng sai → MINOR-3. |
| **S5 Security Boundary**     |    PASS    | [SRC] guard.js:38 `UNFROZEN_PREFIXES = ["docs/"]`, guard.js:415-421 → ghi/xóa `docs/**` luôn `allow`; guard.js:474-484 `.agents/**` luôn `ask` (plan đã ghi rõ). [ADV-TOCTOU] T1: header `**Trạng thái**: In Review` \| T2: guard.js:206-212 regex test header \| T3: `isPending = true` → token bị bỏ qua cho tới khi header đổi → đúng thiết kế §5 `05-plan-review.md`. Không có secret trong phạm vi.             |
| **S6 External Resilience**   |    N/A     | Không có lời gọi AI provider / route serverless.                                                                                                                                                                                                                                                                                                                                                                     |
| **Domain Inquiry**           |  Xem lỗi   | Tính thực thi của Test Contract, nhất quán quy ước đường dẫn, link rendering trên GitHub/IDE.                                                                                                                                                                                                                                                                                                                        |

#### Phân Loại Lỗi

**[MAJOR-A] Contract 8.1 không thực thi được như đã viết (lỗi quoting shell).**

- [CMD #7] Thân script nằm trong `node -e "..."` nháy kép nhưng chứa backtick (regex strip fenced block và inline code). Trong bash, backtick trong nháy kép là command substitution → `bash -n` exit 2. Trong PowerShell 5.1 (shell mặc định theo `02-quality.md`), backtick là ký tự escape và `$1` (trong `.replace(..., '$1')`) bị nội suy biến → regex biến dạng âm thầm.
- **Yêu cầu**: Đưa script ra file `.mjs` cố định (khai báo trong §6; nếu đặt ngoài `docs/` thì ghi rõ hook `ask`), hoặc dùng heredoc nháy đơn (`node - <<'EOF'`) và chỉ định shell bắt buộc (Git Bash). Contract phải chạy được nguyên văn. Áp dụng tương tự cho 8.2/8.3 (hiện không chứa backtick nhưng nên thống nhất cách chạy).

**[MAJOR-B] Negative grep dùng regex cờ `/g` với `.test()` → bỏ sót vi phạm.**

- [CMD #5] `RegExp.prototype.test` với cờ `g` giữ `lastIndex` giữa các file; sau một match ở file trước, file sau có thể bị báo sạch sai (false PASS của chính cổng kiểm chứng).
- **Yêu cầu**: Bỏ cờ `g` trong `negativePatterns` (hoặc reset `pat.reg.lastIndex = 0` trước mỗi `.test`).

**[MAJOR-C] Living Docs entry (Bước 3.4) tự làm fail negative grep → Bước 6.2 không thể PASS.**

- [CMD #6] Entry chứa `.agent/rules/` và `docs/superpowers/`; `docs/CHANGELOG.md` KHÔNG bị loại khỏi `files` (script chỉ loại `docs/archive` và file plan), trái với mô tả §8.1 "loại trừ … các mục CHANGELOG cũ".
- **Yêu cầu**: Hoặc (a) viết lại entry không chứa chuỗi cấm (ví dụ "sửa typo thiếu `s` trong tiền tố thư mục rules", "thư mục superpowers cũ"), hoặc (b) loại trừ rõ ràng `docs/CHANGELOG.md` trong script. Đồng bộ mô tả §8.1 với code.

**[MAJOR-D] Phương án B tuyên bố "100%" nhưng phạm vi thực thi chỉ phủ 4 rule + 1 workflow; không có kiểm chứng tiền tố rút gọn.**

- [CMD #8] Còn ~24 tham chiếu dạng rút gọn `rules/…`, `skills/…`, `workflows/…` trong 10 file ngoài phạm vi §6 (3 `agent.md`, `mental-simulation.md`, 3 skills, `workflows/audit.md`, `docs/architecture.md`, `docs/lessons-learned.md`). Sau task, dòng quy ước mới trong `02-quality.md` sẽ mâu thuẫn với chính các file governance này — đúng vấn đề "2 quy ước song song" của MAJOR-3 Run 1.
- Yêu cầu Run 1 "bổ sung grep negative cho tiền tố rút gọn vào Verification" chưa được thực hiện.
- **Yêu cầu**: Hoặc (a) mở rộng §6/§7 liệt kê đầy đủ các file trên (kèm số ký tự dự kiến cho 3 `agent.md`, giới hạn 10,000; hiện planner=6,271, qa=7,272, reviewer=4,977), hoặc (b) thu hẹp tuyên bố: chỉ chuẩn hóa `.agents/rules/**` + `workflows/post-fix.md`, ghi rõ phần còn lại là follow-up. Trong cả hai trường hợp, thêm vào Contract 8.1 một negative grep cho dạng rút gọn (ví dụ `/(^|[^./\w-])(rules|skills|workflows)\/[\w-]+\.md/`) trên đúng phạm vi đã cam kết, tiêu chí 0 match.

**[MAJOR-E] Contract 8.1 vẫn resolve link có `/` theo repo root, che giấu link hỏng — và Bước 3.3 tạo đúng loại link hỏng đó.**

- §8.1 "Mục tiêu" nói link relative resolve theo `path.dirname(file)`, nhưng code chỉ làm vậy khi link bắt đầu `./`, `../` hoặc không chứa `/`; mọi link còn lại (ví dụ `.agents/README.md`) resolve theo `process.cwd()` — điểm này đã nêu ở MAJOR-2 Run 1.
- Bước 3.3 thêm vào `docs/models.md` link `(.agents/README.md#agent-task-to-model-routing)`: GitHub/VS Code render theo thư mục của file → `docs/.agents/README.md` → **hỏng**, nhưng script báo PASS. [CMD #9] Quy ước hiện hữu của `docs/` là file-relative (`./contracts.md`).
- **Yêu cầu**: Sửa link Bước 3.3 thành `../.agents/README.md#agent-task-to-model-routing`; checker resolve mọi link không tuyệt đối theo `path.dirname(file)` (chỉ link bắt đầu `/` mới theo repo root). Áp dụng cùng quy ước cho mọi link trong `docs/README.md`, `.agents/README.md`, `.agents/skills/README.md` mới.

**[MINOR-1] Số liệu nội bộ plan**: §6.B tiêu đề "11 tệp" nhưng liệt kê 12; §3.1 dòng CHANGELOG ghi "83 headings năm 2026, 2 headings năm 2025" mâu thuẫn với "82 headings".

**[MINOR-2] Ước lượng dung lượng CHANGELOG**: [CMD #3] 8 mục giữ lại = 31,977 bytes (không phải ~29,162); cộng NOTE + entry mới (~1–1.5 KB UTF-8) ≈ 33.5 KB — vẫn `< 35,000` nhưng biên chỉ ~1.5 KB. Nếu vượt, chuyển thêm mục `2026-09-10` sang archive (tổng heading không đổi).

**[MINOR-3] Kỳ vọng `=== 83` cứng**: Nên ghi "đếm N heading ngay trước Bước 2.1, kỳ vọng N + 1" để không vỡ nếu task khác thêm entry CHANGELOG trước khi triển khai. Lưu ý `docs/archive/CHANGELOG-legacy.md` không được có heading `## ` phụ (lời mở đầu dùng `#` hoặc blockquote).

**[MINOR-4] `docs/archive/**` bị loại khỏi link checker\*\*: các link bên trong plan/spec di dời (nếu có) sẽ không được kiểm. [CMD #4] hiện không có tham chiếu nào — chấp nhận được, nên ghi rõ trong §8.1.

**[MINOR-5] Prettier baseline (tiếp MINOR-8 Run 1)**: `UNVERIFIED` — đề nghị User chạy `npx prettier --check "docs/**/*.md" ".agents/**/*.md"` trước khi triển khai; nếu baseline không sạch, Bước 6.5 phải giới hạn vào danh sách file thực sự bị chạm.

**[MINOR-6] Header trạng thái khi phê duyệt**: [SRC] guard.js:206-212 — khi header còn `In Review`, guard bỏ qua `[PLAN_APPROVED]`. Khi đạt approve ở Run sau, cần đổi header sang trạng thái không-pending (ví dụ `Approved`) để token có hiệu lực.

#### Kết Luận

**[CHANGES_REQUESTED]** — Còn 5 lỗi `[MAJOR]`, tập trung ở tính đúng/thực thi được của Verification Plan và phạm vi quy ước đường dẫn; phần tái cấu trúc cốt lõi (MAJOR-1, MAJOR-4 của Run 1) đã đạt. Việc cần làm cho Revision 3:

1. MAJOR-A: Làm Contract 8.1 chạy được nguyên văn (file script hoặc heredoc nháy đơn, chỉ định shell).
2. MAJOR-B: Bỏ cờ `g` khỏi regex negative grep.
3. MAJOR-C: Xử lý xung đột giữa Living Docs entry và negative grep; đồng bộ mô tả §8.1 với code.
4. MAJOR-D: Phủ đủ mọi tham chiếu rút gọn hoặc thu hẹp tuyên bố; thêm negative grep cho dạng rút gọn.
5. MAJOR-E: Link file-relative (`../.agents/README.md#…`) và checker resolve theo `path.dirname(file)`.

### Audit Run 3

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 3

#### Kiểm Chứng Lỗi Cũ (so với Audit Run 2)

| Lỗi Run 2                                             |     Trạng thái     | Ghi chú                                                                                                                                                                                                                                                                                    |
| :---------------------------------------------------- | :----------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-A (Contract 8.1 lỗi quoting shell)              |       ĐÃ SỬA       | Logic chuyển sang file `scripts/verify-docs.mjs` [CMD #1 chạy nguyên văn được]. Contract 8.3 vẫn là `node -e "..."` nhưng không còn backtick/`$` → parse được trên cả bash và PowerShell.                                                                                                  |
| MAJOR-B (regex `/g` + `.test()`)                      |       ĐÃ SỬA       | [SRC] `scripts/verify-docs.mjs:98-103,132` — `legacyPatterns` và `shorthandRegex` không có cờ `g`. `linkRegex` (dòng 41) có `g` nhưng dùng vòng `exec` tới `null` trên từng file → `lastIndex` tự về 0, không rò trạng thái giữa các file.                                                 |
| MAJOR-C (Living Docs entry tự fail negative grep)     |       ĐÃ SỬA       | Entry Bước 3.4 viết gián tiếp; đồng thời [SRC] `verify-docs.mjs:109` loại `docs/CHANGELOG.md` khỏi legacy grep, khớp mô tả §8.1.                                                                                                                                                           |
| MAJOR-D (phạm vi Phương án B + negative grep rút gọn) |       ĐÃ SỬA       | [CMD #2] 51 dòng rút gọn trên baseline phân bố đúng 16 file governance/docs mà §6.B liệt kê + `reviewer.backup/` (bị xóa ở Bước 5.4). Không có file nào ngoài danh sách. `03-ui.md`, `05-plan-review.md` sạch. Negative grep `--strict-shorthand` đã có ([SRC] `verify-docs.mjs:130-175`). |
| MAJOR-E (link resolve theo repo root)                 |       ĐÃ SỬA       | [SRC] `verify-docs.mjs:65-73` — link không tuyệt đối resolve theo `path.dirname(file)`; Bước 3.3 dùng `../.agents/README.md#…`. (Xem MINOR-4 về nhánh `/` trên Windows.)                                                                                                                   |
| MINOR-1 → MINOR-4, MINOR-6                            | ĐÃ SỬA / CHẤP NHẬN | Số liệu 82 heading, ~33.5 KB, header `Approved` khi duyệt (§4.2) đã ghi rõ. Riêng MINOR-3 (kỳ vọng động N+1) chỉ sửa ở §1 — xem MINOR-1 dưới đây.                                                                                                                                          |
| MINOR-5 (Prettier baseline)                           | ĐÃ XÁC MINH → FAIL | Lần này đã chạy được — baseline KHÔNG sạch, nâng thành MAJOR-G.                                                                                                                                                                                                                            |

#### Commands Executed

| #   | Lệnh                                                                                                                                     | Exit  | Kết quả liên quan                                                                                                                                                                                                                                                                                                                                             |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------- | :---: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `node scripts/verify-docs.mjs` (baseline)                                                                                                |   1   | `[1/5] PASS 277 files, zero broken links`; `[2/5] FAIL` đúng 4 vị trí dự kiến (`02-quality.md`, `post-fix.md`, `.superpowers/sdd/progress.md`, `lessons-learned.md`); `[3/5] NOTE 51 shorthand`; `[4/5] PASS`; `[5/5] NOTE archive chưa tồn tại`. Hành vi baseline đúng thiết kế.                                                                             |
| 2   | `node -e` đếm dòng rút gọn theo file bằng chính `shorthandRegex` của script                                                              |   0   | `00-core 2, 01-coding 2, 02-quality 17, 04-bilingual 1, planner 2, qa 3, reviewer 1, mental-simulation 4, reviewer.backup 1+4, add-feature 5, add-model 1, add-translation 1, audit 2, architecture 2, lessons-learned 3` = 51.                                                                                                                               |
| 3   | `grep -c "^## "` + `head -n 255 \| wc -c` + awk dò `## ` trong fenced block của `docs/CHANGELOG.md`                                      |   0   | 82 heading; 8 mục giữ lại = 31,977 bytes; không có `## ` nằm trong code fence → phép đếm heading không bị nhiễu.                                                                                                                                                                                                                                              |
| 4   | `grep -rn` `model-routing` / `context.md` / `superpowers/` trên mọi `.md` (trừ CHANGELOG, plan này) + mọi `.json/.js/.ts/.mjs/.ps1/.yml` |   0   | Chỉ còn `.superpowers/sdd/progress.md:4` (Bước 2.6 xử lý). Spec/plan di dời không chứa link markdown nào → không vỡ link sau khi chuyển.                                                                                                                                                                                                                      |
| 5   | `npx eslint scripts/verify-docs.mjs`                                                                                                     | **1** | **31 errors `no-undef`** (`process`, `console`, `Buffer`).                                                                                                                                                                                                                                                                                                    |
| 6   | `npm run lint` (`eslint .`)                                                                                                              | **1** | Lỗi duy nhất của toàn repo đến từ `scripts/verify-docs.mjs` (31 errors) → `npm run verify` đang ĐỎ ngay trên baseline.                                                                                                                                                                                                                                        |
| 7   | Probe: `/* global process, console, Buffer */` + nội dung script qua `npx eslint --stdin --stdin-filename scripts/verify-docs.mjs`       |   0   | Sửa 1 dòng header là đủ để lint sạch.                                                                                                                                                                                                                                                                                                                         |
| 8   | `npx prettier --check scripts/verify-docs.mjs`                                                                                           | **1** | Script chưa được format.                                                                                                                                                                                                                                                                                                                                      |
| 9   | `npx prettier --check "docs/**/*.md" ".agents/**/*.md"` (baseline)                                                                       | **1** | 9 file lỗi: `docs/CHANGELOG.md`, `docs/database-schema.md`, `docs/lessons-learned.md`, `docs/plans/2026-09-28-supabase-cli-typegen…md`, `docs/plans/2026-09-29-docs-rules-agents…md` (chính plan này), `docs/superpowers/plans/2026-09-04-…md`, `.agents/rules/01-coding.md`, `.agents/rules/05-plan-review.md`, `.agents/scripts/claude-reviewer-prompt.md`. |
| 10  | `npx prettier <file>` đo độ dài trước/sau cho `01-coding.md`, `CHANGELOG.md`, `lessons-learned.md`                                       |   0   | `01-coding.md` 9,404 → 9,375 ký tự; hai file còn lại gần như không đổi → format không đe dọa giới hạn ký tự.                                                                                                                                                                                                                                                  |
| 11  | `npx vitest run .agents/scripts/code-freeze-guard.test.ts`                                                                               |   0   | `Tests 66 passed (66)`.                                                                                                                                                                                                                                                                                                                                       |
| 12  | `npm run type-check` / `npm run test:run`                                                                                                | 0 / 0 | tsc sạch; `Test Files 59 passed`, `Tests 760 passed`.                                                                                                                                                                                                                                                                                                         |
| 13  | `node -e "path.isAbsolute('/docs/x.md')"`                                                                                                |   0   | `true` → xem MINOR-4.                                                                                                                                                                                                                                                                                                                                         |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     |  Kết quả   | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :--------------------------- | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S1 Cold-start & Build**    |  **FAIL**  | [CMD #12] type-check sạch, nhưng [CMD #5, #6] `npm run lint` exit 1 do script mới của chính task (`scripts/verify-docs.mjs` không khớp glob `**/*.{js,jsx,ts,tsx}` tại [SRC] `eslint.config.mjs:9` nên không nhận `globals.node`; chỉ `js.configs.recommended` áp dụng → `no-undef`). Bước 6.5 / Contract 8.5 không thể PASS → MAJOR-F.                                                                                         |
| **S2 Lifecycle & Teardown**  | N/A (PASS) | Docs-only, không có tài nguyên runtime. Script đọc file đồng bộ, không mở handle dài hạn. Guard: [CMD #11] 66/66.                                                                                                                                                                                                                                                                                                               |
| **S3 Database & Temporal**   |    N/A     | Không chạm `supabase/migrations/**` hay schema (§4.1).                                                                                                                                                                                                                                                                                                                                                                          |
| **S4 Cross-Task State Flow** |    PASS    | [SRC] `.agents/scripts/code-freeze-guard.js:196` `readdirSync(plansDir)` không đệ quy → `docs/archive/plans/*.md` nằm ngoài phạm vi quét. [ADV] T1: task Supabase TypeGen (`docs/CHANGELOG.md` đang `M`) đã thêm entry `2026-09-29` ở dòng 8 \| T2: plan này đếm N \| T3: [CMD #3] N = 82 đã bao gồm entry đó → kỳ vọng 83 hiện đúng; rủi ro chỉ còn nếu có entry mới chen vào trước khi triển khai (MINOR-1).                  |
| **S5 Security Boundary**     |    PASS    | [SRC] guard.js:38,417 `UNFROZEN_PREFIXES = ["docs/"]` → ghi/xóa `docs/**` allow; ghi `.agents/**`, `scripts/**`, `.superpowers/**` và xóa `reviewer.backup/` → `ask` (plan đã ghi rõ ở §4.2, Giai đoạn 4–5). [ADV-TOCTOU] T1: header `In Review` \| T2: guard.js:207-208 regex pending khớp `In Review` \| T3: token bị bỏ qua tới khi header đổi sang `Approved` → đúng §5 `05-plan-review.md`. Không có secret trong phạm vi. |
| **S6 External Resilience**   |    N/A     | Không có lời gọi AI provider / route serverless.                                                                                                                                                                                                                                                                                                                                                                                |
| **Domain Inquiry**           |  Xem lỗi   | Tính khả thi của Verification Gate (lint/prettier), độ phủ link checker cho `docs/plans/README.md` và các hub mới, tính di động Windows của script.                                                                                                                                                                                                                                                                             |

#### Phân Loại Lỗi

**[MAJOR-F] `scripts/verify-docs.mjs` làm `npm run lint` / `npm run verify` fail → Bước 6.5 và Contract 8.5 không thể đạt.**

- [CMD #5, #6] `eslint .` quét cả `scripts/`; file `.mjs` không khớp block `files: ["**/*.{js,jsx,ts,tsx}"]` ([SRC] `eslint.config.mjs:9`) nên không có `globals.node` → 31 lỗi `no-undef`. Đây là lỗi duy nhất của toàn repo, tức baseline `npm run verify` hiện đỏ vì chính tệp `[NEW]` của task.
- **Yêu cầu**: (a) Thêm vào Bước 1.1 (hoặc bước riêng) thao tác sửa script: dòng đầu `/* global process, console, Buffer */` — [CMD #7] đã probe exit 0 — hoặc `import process from "node:process"; import { Buffer } from "node:buffer";` + khai báo `console`. KHÔNG sửa `eslint.config.mjs` (ngoài phạm vi Zero-Code §4.1). (b) Bổ sung vào Contract 8.5 lệnh `npx eslint scripts/verify-docs.mjs` với tiêu chí exit 0. (c) Ghi rõ việc ghi `scripts/verify-docs.mjs` sẽ kích hoạt hook `ask`.

**[MAJOR-G] Contract 8.5 / Bước 6.4 (`prettier --check "docs/**/_.md" ".agents/\*\*/_.md" "scripts/verify-docs.mjs"`) không thể PASS mà không sửa file ngoài phạm vi.\*\*

- [CMD #8, #9] Baseline đã có 9 file `.md` + chính `scripts/verify-docs.mjs` lỗi format. Trong đó ≥5 file nằm NGOÀI danh sách §6 (`docs/database-schema.md` — §3.1 ghi KEEP, `docs/plans/2026-09-28-…md`, chính plan này, `.agents/rules/05-plan-review.md`, `.agents/scripts/claude-reviewer-prompt.md`), và bản plan superpowers sẽ được di dời nguyên văn vào `docs/archive/plans/`. Để đạt lệnh như đã viết, implementer buộc phải format file ngoài phạm vi — vi phạm "Only touch files required by the task" (`00-core.md` Non-Negotiables) — hoặc Contract fail.
- Đây chính là rủi ro đã cảnh báo ở MINOR-8 Run 1 / MINOR-5 Run 2 ("nếu baseline không sạch, phải giới hạn vào danh sách file thực sự bị chạm") nhưng §7/§8 chưa điều chỉnh.
- **Yêu cầu**: Thay glob bằng danh sách tường minh các file `[NEW]`/`[MODIFY]` của §6 (loại trừ các bản di dời/lưu trữ nguyên văn trong `docs/archive/**` và `docs/specs/…` để bảo toàn lịch sử), thêm bước `npx prettier --write <danh sách đó>` trước khi check. Đã xác minh [CMD #10] việc format các file bị chạm không làm vượt giới hạn ký tự (`01-coding.md` giảm còn 9,375). Sau format, chạy lại Contract 8.2 để xác nhận ký tự.

**[MINOR-1] Kỳ vọng heading vẫn cứng và không nhất quán.** §1.3 nói "N + 1 động", nhưng Bước 6.2 dùng `< 83`, Contract 8.3 dùng `!== 83`; mục `[5/5]` của script có tiêu đề "Headings Integrity" nhưng chỉ in số, không assert. Đề xuất: script nhận `--expected-headings=<N+1>` (N ghi lại ở Bước 2.1) và fail khi lệch; bỏ Bước 6.2 trùng lặp. Hiện [CMD #3] N = 82 nên 83 đang đúng.

**[MINOR-2] Số đếm file bất nhất.** Mục tiêu 4 và tiêu đề Giai đoạn 4 nói "16 active files"; tiêu đề §6.B ghi "(16 tệp)" nhưng liệt kê 20 mục, ghi chú dưới bảng lại nói 20. Nên ghi rõ: 20 tệp MODIFY, trong đó 16 tệp thuộc phạm vi negative grep rút gọn.

**[MINOR-3] Link checker bỏ qua toàn bộ `docs/plans/`** ([SRC] `verify-docs.mjs:38`) → các link trong Ma trận Index mới của `docs/plans/README.md` (Bước 3.6) sẽ không được kiểm. Nên chỉ loại các file plan, giữ `docs/plans/README.md` trong phạm vi. Tương tự, nên đưa `docs/README.md`, `.agents/README.md`, `.agents/skills/README.md` vào `shorthandScope` để các hub mới cũng tuân thủ quy ước `.agents/`.

**[MINOR-4] Nhánh link root-relative không chạy được trên Windows.** [CMD #13] `path.isAbsolute("/docs/x.md") === true` trên win32 → nhánh `startsWith("/")` (dòng 68) không bao giờ tới; link `/docs/...` sẽ bị resolve thành `C:\docs\...` và báo hỏng sai. Đảo thứ tự hai điều kiện. Hiện chưa có link dạng này nên không chặn.

**[MINOR-5] Thông điệp kết thúc** của script luôn in "ALL PRE-IMPLEMENTATION VERIFICATION CHECKS PASSED" — trong khi Contract 8.1 dùng chính chuỗi này làm tiêu chí đạt sau triển khai. Nên đổi thành chuỗi trung tính (và cập nhật tiêu chí 8.1 tương ứng).

#### Kết Luận

**[CHANGES_REQUESTED]** — Toàn bộ 5 lỗi `[MAJOR]` của Run 2 đã được khắc phục và được xác minh bằng lệnh; phần tái cấu trúc và phạm vi chuẩn hóa đường dẫn đã chính xác. Còn 2 lỗi `[MAJOR]` mới, đều nằm ở Verification Gate (Contract 8.5 không thể đạt trên trạng thái thực tế). Việc cần làm cho Revision 4:

1. MAJOR-F: Sửa `scripts/verify-docs.mjs` để lint sạch (header `/* global process, console, Buffer */` hoặc import `node:process`/`node:buffer`), thêm `npx eslint scripts/verify-docs.mjs` vào Contract 8.5.
2. MAJOR-G: Giới hạn Prettier vào danh sách file tường minh bị chạm (trừ bản lưu trữ nguyên văn), thêm bước `prettier --write` trước khi check, chạy lại Contract 8.2 sau format.

### Audit Run 4

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 4

#### Kiểm Chứng Lỗi Cũ (so với Audit Run 3)

| Lỗi Run 3                                                     |       Trạng thái        | Ghi chú                                                                                                                                                                                                                                                                                                                                                      |
| :------------------------------------------------------------ | :---------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-F (`verify-docs.mjs` fail ESLint → `npm run verify` đỏ) |         ĐÃ SỬA          | [SRC] `scripts/verify-docs.mjs:2` có `/* global process, console, Buffer */`. [CMD #1] `npx eslint scripts/verify-docs.mjs` exit 0; [CMD #3] `npm run lint` exit 0 (toàn repo sạch). Contract 8.5 đã có lệnh eslint riêng; `eslint.config.mjs` không bị chạm.                                                                                                |
| MAJOR-G (Prettier glob chạm file ngoài phạm vi)               |         ĐÃ SỬA          | Bước 6.3/6.4 và Contract 8.5 dùng danh sách tường minh (23 `.md` + 1 script), loại `docs/archive/**`, `docs/specs/**`, `docs/database-schema.md`, `05-plan-review.md`; có `--write` trước `--check`; Bước 6.6 chạy lại kiểm tra ký tự. [CMD #2] script đã đạt Prettier. [SRC] `.prettierignore` không loại file nào trong danh sách (kể cả `.superpowers/`). |
| MINOR-1 (kỳ vọng heading cứng, không assert)                  | ĐÃ SỬA (có lỗ hổng mới) | [SRC] `verify-docs.mjs:238-275` nhận `--expected-headings=<N>` và FAIL khi lệch — [CMD #6a] probe xác nhận exit 1 khi lệch. Bước 2.1 đo N = 82 [CMD #5]. Tuy nhiên nhánh thiếu archive bỏ qua toàn bộ [5/5] → MAJOR-H.                                                                                                                                       |
| MINOR-2 (số đếm file)                                         |         ĐÃ SỬA          | §6.B ghi "20 tệp tường minh", tách rõ 16 tệp shorthand scope + 4 tệp khác.                                                                                                                                                                                                                                                                                   |
| MINOR-3 (`docs/plans/README.md` + hubs ngoài phạm vi)         |         ĐÃ SỬA          | [SRC] `verify-docs.mjs:37-42` chỉ loại plan khác README; `:159-161` thêm 3 hub vào `shorthandScope`.                                                                                                                                                                                                                                                         |
| MINOR-4 (nhánh `/` trên Windows)                              |         ĐÃ SỬA          | [SRC] `verify-docs.mjs:75-81` kiểm `startsWith("/")` trước `path.isAbsolute`.                                                                                                                                                                                                                                                                                |
| MINOR-5 (thông điệp kết thúc)                                 |         ĐÃ SỬA          | [SRC] `verify-docs.mjs:285` in `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`, khớp tiêu chí 8.1.                                                                                                                                                                                                                                                   |

#### Commands Executed

| #   | Lệnh                                                                                                                                    | Exit  | Kết quả liên quan                                                                                                                                                                                                                                                |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------- | :---: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npx eslint scripts/verify-docs.mjs`                                                                                                    |   0   | Không có lỗi `no-undef`.                                                                                                                                                                                                                                         |
| 2   | `npx prettier --check scripts/verify-docs.mjs`                                                                                          |   0   | `All matched files use Prettier code style!`                                                                                                                                                                                                                     |
| 3   | `npm run lint`                                                                                                                          |   0   | `eslint .` sạch toàn repo.                                                                                                                                                                                                                                       |
| 4   | `node scripts/verify-docs.mjs` (baseline)                                                                                               |   1   | `[1/5] PASS 278 files`; `[2/5] FAIL` đúng 4 vị trí dự kiến (`02-quality.md`, `post-fix.md`, `.superpowers/sdd/progress.md`, `lessons-learned.md`); `[3/5] NOTE 51 shorthand`; `[4/5] PASS`; `[5/5] NOTE archive chưa tồn tại`. Đúng thiết kế pre-implementation. |
| 5   | Lệnh Bước 2.1 nguyên văn (`node -e "console.log('N =', fs.readFileSync(...)...)"`)                                                      |   0   | `N = 82` — builtin `fs` khả dụng trong `node -e`; lệnh chạy được nguyên văn.                                                                                                                                                                                     |
| 6a  | Probe thư mục tạm: `CHANGELOG.md` (2 `## `) + `archive/CHANGELOG-legacy.md` (1 `## `), chạy script với `--expected-headings=4` rồi `=3` | 1 / 0 | `FAIL: Headings count mismatch! Expected 4, got 3` → exit 1; `=3` → PASS. Assertion hoạt động (Negative Probe đạt).                                                                                                                                              |
| 6b  | Probe cùng thư mục nhưng **xóa** `docs/archive/CHANGELOG-legacy.md`, chạy `--strict-shorthand --expected-headings=83`                   | **0** | `NOTE: Legacy changelog archive does not exist yet (pre-implementation)` → `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`. Cả kiểm tra dung lượng lẫn heading bị bỏ qua → **false PASS** (MAJOR-H).                                                     |
| 7   | `npx vitest run .agents/scripts/code-freeze-guard.test.ts`                                                                              |   0   | `Tests 66 passed (66)`.                                                                                                                                                                                                                                          |
| 8   | `grep -n "^## " docs/CHANGELOG.md \| head`                                                                                              |   0   | Mục 8 = `2026-09-10` ở dòng 235, mục 9 = `2026-09-05` ở dòng 256 → mốc cắt khớp §1.3 và Bước 2.2.                                                                                                                                                                |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     |  Kết quả   | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :--------------------------- | :--------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    |    PASS    | [CMD #1, #3] ESLint script và toàn repo exit 0; [CMD #2] Prettier đạt; [CMD #7] guard 66/66. Plan không chạm `package.json`, tsconfig, `eslint.config.mjs`, không thêm dependency; §4.1 Zero-Code Mutation.                                                                                                                                                                                                                    |
| **S2 Lifecycle & Teardown**  | N/A (PASS) | Docs-only; script đọc file đồng bộ, không mở handle/timer dài hạn, thoát bằng `process.exit` rõ ràng.                                                                                                                                                                                                                                                                                                                          |
| **S3 Database & Temporal**   |    N/A     | Không chạm `supabase/migrations/**` hay schema.                                                                                                                                                                                                                                                                                                                                                                                |
| **S4 Cross-Task State Flow** |    PASS    | [SRC] `.agents/scripts/code-freeze-guard.js` quét `docs/plans/` không đệ quy → `docs/archive/plans/*.md` ngoài phạm vi. [ADV] T1: task Supabase TypeGen (CHANGELOG đang `M`) đã chèn entry dòng 8 \| T2: Bước 2.1 đo N tại thời điểm triển khai \| T3: [CMD #5] N = 82 đã gồm entry đó, kỳ vọng `N+1` được truyền qua cờ → AN TOÀN; nếu có entry khác chen vào, implementer truyền `--expected-headings=<N+1>` theo số đo mới. |
| **S5 Security Boundary**     |    PASS    | [SRC] guard.js:38 `UNFROZEN_PREFIXES = ["docs/"]` → ghi `docs/**` allow; ghi `.agents/**`, `scripts/**`, `.superpowers/**`, xóa `reviewer.backup/` → `ask` (plan ghi rõ §4.2, Giai đoạn 4–5). [ADV-TOCTOU] T1: header `In Review` \| T2: regex pending của guard khớp \| T3: token bị bỏ qua tới khi header đổi sang `Approved` (§4.2) → đúng `05-plan-review.md §5`. Không có secret trong phạm vi.                           |
| **S6 External Resilience**   |    N/A     | Không có lời gọi AI provider / route serverless.                                                                                                                                                                                                                                                                                                                                                                               |
| **Domain Inquiry**           |  Xem lỗi   | Tính đúng đắn (không false-PASS) của Verification Gate khi triển khai thiếu bước; tương thích quy ước link file-relative của hub với negative grep shorthand.                                                                                                                                                                                                                                                                  |

#### Phân Loại Lỗi

**[MAJOR-H] Mục `[5/5]` của `scripts/verify-docs.mjs` âm thầm bỏ qua cả kiểm tra dung lượng lẫn assertion heading khi thiếu archive — kể cả khi đã truyền `--expected-headings` → cổng Bước 6.1 / Contract 8.1 báo PASS sai.**

- [SRC] `scripts/verify-docs.mjs:243` điều kiện `fs.existsSync(changelogPath) && fs.existsSync(legacyChangelogPath)`; nhánh `else` (`:276-280`) chỉ in `NOTE` và không đặt `hasError`.
- [CMD #6b] Với archive không tồn tại, `--strict-shorthand --expected-headings=83` trả exit 0 và in thông điệp PASS toàn phần. [ADV] T1: implementer đặt tên archive khác (`docs/archive/CHANGELOG-2026-legacy.md`) hoặc quên Bước 2.2 \| T2: Bước 6.1 chạy \| T3: `[5/5]` rơi vào nhánh NOTE → `docs/CHANGELOG.md` vẫn 138 KB nhưng gate xanh → LỖI. Contract 8.3 dạng `node -e` sẽ bắt được (`readFileSync` ném lỗi) nhưng plan ghi nó là tùy chọn ("Cũng có thể chạy độc lập"), còn tiêu chí đạt chính thức của 8.1/8.3 là exit 0 của script.
- Cùng lớp lỗi với MAJOR-B Run 2 (cổng kiểm chứng tự báo sạch sai) — theo `evidence-bar.md §4.5.3`, control phải được chứng minh bắt được vi phạm.
- **Yêu cầu**: Trong Bước 1.1 (và mô tả Contract 8.1/8.3), quy định: khi có `--expected-headings` (hoặc `--strict-shorthand`), thiếu `docs/CHANGELOG.md` hoặc `docs/archive/CHANGELOG-legacy.md` → `console.error` + `hasError = true`. Ví dụ ở nhánh `else`: `if (expectedHeadings !== null) { console.error("FAIL: ... archive missing"); hasError = true; } else { console.log("NOTE: ..."); }`. Có thể thêm `Number.isNaN(expectedHeadings)` → FAIL để chặn cờ nhập sai (`--expected-headings=`). Sau sửa, chạy lại probe 6b với tiêu chí exit 1.

**[MINOR-1] Link file-relative trong `.agents/README.md` va chạm negative grep shorthand.** [SRC] `verify-docs.mjs:147` `shorthandRegex = /(?:^|[^\w./-])(rules|skills|workflows)\/…\.md/` — link `[00-core](rules/00-core.md)` trong `.agents/README.md` (dạng file-relative đúng theo MAJOR-E Run 2) bị ký tự `(` đứng trước → bị báo shorthand; `(./rules/00-core.md)` thì không. Gate sẽ fail (không phải false PASS) nhưng nên ghi rõ trong Bước 4.1/4.2: link trong hub dùng tiền tố `./` (`./rules/…`, `./skills/…`, `../rules/…`), còn tham chiếu văn xuôi/backtick dùng `.agents/…`.

**[MINOR-2] Thứ tự Giai đoạn 6.** Bước 6.1 (strict gate) chạy trước Prettier `--write` (6.3), còn Bước 6.6 chạy lại script **không có cờ** → sau format, shorthand/heading không được tái kiểm nghiêm ngặt. Đề nghị: đưa `prettier --write` lên trước 6.1, hoặc để 6.6 dùng `node scripts/verify-docs.mjs --strict-shorthand --expected-headings=83`.

**[MINOR-3] Số liệu §5.** Dòng "Prettier Formatting" ghi "19 markdown files + 1 script", thực tế danh sách Bước 6.3 có 23 `.md` + 1 script. Đồng bộ con số.

**[MINOR-4] Kỳ vọng tương tác hook cho lệnh Giai đoạn 6.** [SRC] guard.js:50-64 `READ_ONLY_COMMANDS` không chứa `node scripts/verify-docs.mjs`, `npx prettier …`, `npx eslint <file>`; `--write` khớp `MUTATING_FLAGS` (guard.js:70) → mọi lệnh 6.1, 6.3–6.6 đều kích hoạt `ask`. Nên ghi chú như đã làm cho Giai đoạn 4–5 để Orchestrator không hiểu nhầm là bị chặn.

**[MINOR-5] Nhắc lại**: Khi Revision sau được duyệt, đổi header `> **Trạng thái**: In Review` → `Approved` trước khi viết code (§4.2) để guard công nhận token.

#### Kết Luận

**[CHANGES_REQUESTED]** — Cả 2 lỗi `[MAJOR]` của Run 3 (ESLint, Scoped Prettier) và toàn bộ MINOR đã được khắc phục và xác minh bằng lệnh; kiến trúc tái cấu trúc, phạm vi file và quy ước đường dẫn đã đúng. Còn 1 lỗi `[MAJOR]` mới, cục bộ và sửa được trong vài dòng. Việc cần làm cho Revision 5:

1. MAJOR-H: Khi có `--expected-headings`/`--strict-shorthand`, thiếu archive hoặc CHANGELOG phải FAIL (không phải NOTE); bổ sung probe 6b (xóa archive → exit 1) vào Verification.
2. (Khuyến nghị) MINOR-1 → MINOR-4: quy ước `./` cho link trong hub, sắp lại thứ tự Giai đoạn 6, đồng bộ số file, ghi chú hook `ask` cho lệnh kiểm chứng.

### Audit Run 5

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 5

#### Kiểm Chứng Lỗi Cũ (so với Audit Run 4)

| Lỗi Run 4                                    |              Trạng thái               | Ghi chú                                                                                                                                                                                                                                                                                                                                                     |
| :------------------------------------------- | :-----------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-H (thiếu archive → false PASS)         | ĐÃ SỬA (script) / CHƯA ĐẠT (contract) | [SRC] `scripts/verify-docs.mjs:286-291` — khi có `--expected-headings` mà thiếu 1 trong 2 file → `console.error("FAIL: Both … must exist …")` + `hasError = true`; `:243-247` chặn `NaN`. [CMD #4-C] xác nhận exit 1 với đúng thông điệp. Tuy nhiên lệnh Negative Probe 6b mới thêm vào Contract 8.3 không tạo ra trạng thái "thiếu archive" → xem MAJOR-I. |
| MINOR-1 (link hub dùng `./`)                 |                ĐÃ SỬA                 | Bước 4.1/4.2 và §4.3 quy định `./rules/…`, `../rules/…`. [SRC] `verify-docs.mjs:147` ký tự trước `rules` là `/` → không bị `shorthandRegex` bắt.                                                                                                                                                                                                            |
| MINOR-2 (thứ tự Giai đoạn 6)                 |                ĐÃ SỬA                 | 6.1 `prettier --write` → 6.2 `--check` → 6.3 ESLint → 6.4 strict gate `--strict-shorthand --expected-headings=83` → 6.5 guard → 6.6 `npm run verify`.                                                                                                                                                                                                       |
| MINOR-3 (số liệu §5)                         |                ĐÃ SỬA                 | §5 ghi 23 `.md` + 1 script; [CMD #5] danh sách Bước 6.1 đếm được đúng 23 tệp `.md`.                                                                                                                                                                                                                                                                         |
| MINOR-4 (ghi chú hook `ask` cho Giai đoạn 6) |                ĐÃ SỬA                 | Ghi chú đầu Giai đoạn 6 và Risk #4.                                                                                                                                                                                                                                                                                                                         |
| MINOR-5 (header `Approved`)                  |               GHI NHẬN                | §4.2 đã quy định; nhắc lại ở MINOR-C.                                                                                                                                                                                                                                                                                                                       |

#### Commands Executed

| #   | Lệnh                                                                                                                                                                                                                                                                                           |           Exit            | Kết quả liên quan                                                                                                                                                                                                                                                               |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `npx eslint scripts/verify-docs.mjs` / `npx prettier --check scripts/verify-docs.mjs` / `npm run lint`                                                                                                                                                                                         |         0 / 0 / 0         | Script sạch lint + format; toàn repo lint sạch.                                                                                                                                                                                                                                 |
| 2   | `npx vitest run .agents/scripts/code-freeze-guard.test.ts`                                                                                                                                                                                                                                     |             0             | `Tests 66 passed (66)`.                                                                                                                                                                                                                                                         |
| 3   | `node scripts/verify-docs.mjs` (baseline) + `grep -c "^## " docs/CHANGELOG.md`                                                                                                                                                                                                                 |           1 / 0           | `[1/5] PASS 278 files`; `[2/5] FAIL` đúng 4 vị trí dự kiến; `[3/5] NOTE 51 shorthand`; `[4/5] PASS`; `[5/5] NOTE` (không cờ). N = 82. Đúng thiết kế pre-implementation.                                                                                                         |
| 4   | Sandbox tạm (copy script; `docs/CHANGELOG.md` 2 `## ` + `docs/archive/CHANGELOG-legacy.md` 81 `## `): **A** lệnh chính `--strict-shorthand --expected-headings=83`; **B** lệnh Probe 6b nguyên văn; **C** xóa archive rồi chạy lại Probe 6b; **D** archive có mặt, `--expected-headings=83abc` | A 0 / **B 1** / C 0 / D 0 | A: `83 == 83` → PASS. **B: ở trạng thái hậu triển khai hợp lệ, probe in `Exit Code: 0` rồi `process.exit(1)` → Contract 8.3 FAIL.** C: chỉ khi archive thực sự bị xóa thì probe mới đạt, kèm `FAIL: Both … must exist`. D: `parseInt("83abc") = 83` → được chấp nhận (MINOR-A). |
| 5   | Đếm token `.md` ở dòng lệnh Bước 6.1                                                                                                                                                                                                                                                           |             0             | 23.                                                                                                                                                                                                                                                                             |
| 6   | Probe thay thế (sandbox `os.tmpdir()` chỉ chứa script + `CHANGELOG.md`, assert `status === 1` và `stderr` chứa `must exist`) chạy trên cây thật trong Git Bash **và** PowerShell 5.1                                                                                                           |           0 / 0           | `Exit Code: 1 \| archive-missing FAIL detected: true` — chạy nguyên văn trên cả hai shell, không đụng cây làm việc.                                                                                                                                                             |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     |  Kết quả   | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                          |
| :--------------------------- | :--------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    |    PASS    | [CMD #1, #2] ESLint, Prettier, `npm run lint`, guard 66/66 đều exit 0. Không chạm `package.json`, tsconfig, `eslint.config.mjs`, không thêm dependency (§4.1).                                                                                                                                                                                                                      |
| **S2 Lifecycle & Teardown**  | N/A (PASS) | Docs-only; script đọc đồng bộ, thoát tường minh. Probe thay thế đề xuất tự dọn thư mục tạm bằng `fs.rmSync`.                                                                                                                                                                                                                                                                        |
| **S3 Database & Temporal**   |    N/A     | Không chạm `supabase/migrations/**` hay schema.                                                                                                                                                                                                                                                                                                                                     |
| **S4 Cross-Task State Flow** |    PASS    | [SRC] guard quét `docs/plans/` không đệ quy → `docs/archive/plans/*.md` ngoài phạm vi. [ADV] T1: task Supabase TypeGen (CHANGELOG `M`) đã chèn entry `2026-09-29` \| T2: Bước 2.1 đo N lúc triển khai \| T3: [CMD #3] N = 82 đã gồm entry đó; kỳ vọng `N+1` truyền qua cờ → AN TOÀN.                                                                                                |
| **S5 Security Boundary**     |    PASS    | [SRC] guard `UNFROZEN_PREFIXES = ["docs/"]` → ghi `docs/**` allow; ghi `.agents/**`, `scripts/**`, `.superpowers/**`, xóa `reviewer.backup/` (hiện còn 4 file), lệnh Giai đoạn 6 → `ask` (đã ghi chú). [ADV-TOCTOU] T1: header `In Review` \| T2: regex pending của guard khớp \| T3: token bị bỏ qua tới khi header đổi `Approved` → đúng `05-plan-review.md §5`. Không có secret. |
| **S6 External Resilience**   |    N/A     | Không có lời gọi AI provider / route serverless.                                                                                                                                                                                                                                                                                                                                    |
| **Domain Inquiry**           |  Xem lỗi   | Tính đúng của Negative Probe: control phải được chứng minh bắt đúng vi phạm, cô lập khỏi các lỗi khác (`evidence-bar.md §4.5.3`).                                                                                                                                                                                                                                                   |

#### Phân Loại Lỗi

**[MAJOR-I] Negative Probe 6b (Contract 8.3) không tạo trạng thái "thiếu archive" → mâu thuẫn trực tiếp với lệnh chính và không cô lập được lỗi cần chứng minh.**

- Lệnh probe chạy `scripts/verify-docs.mjs --expected-headings=83` trên **chính cây làm việc** và kỳ vọng exit 1; lệnh chính của cùng Contract chạy đúng lệnh đó trên cùng cây và kỳ vọng exit 0. Hai tiêu chí không thể cùng đạt.
- [CMD #4-B] Ở trạng thái hậu triển khai hợp lệ (archive tồn tại, 83 headings) probe trả exit 1 → Contract 8.3 FAIL dù script đúng. Ngược lại, chạy trước triển khai (hoặc khi có bất kỳ lỗi nào khác, ví dụ `[2/5]` legacy refs) probe "PASS" vì exit 1 do lý do khác → không chứng minh được nhánh thiếu archive (cùng lớp lỗi "control chưa được chứng minh bắt vi phạm" với MAJOR-B/MAJOR-H).
- **Yêu cầu**: Probe phải tự dựng trạng thái thiếu archive trong sandbox tách biệt và assert đúng thông điệp. Lệnh thay thế đã kiểm chứng [CMD #6] trên Git Bash và PowerShell 5.1 (không có backtick/`$`):

  ```bash
  node -e "const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');const d=fs.mkdtempSync(path.join(os.tmpdir(),'vd-'));fs.mkdirSync(path.join(d,'docs'),{recursive:true});fs.cpSync('scripts/verify-docs.mjs',path.join(d,'scripts','verify-docs.mjs'));fs.copyFileSync('docs/CHANGELOG.md',path.join(d,'docs','CHANGELOG.md'));const r=spawnSync(process.execPath,['scripts/verify-docs.mjs','--expected-headings=83'],{cwd:d,encoding:'utf8'});fs.rmSync(d,{recursive:true,force:true});const ok=r.status===1&&r.stderr.includes('must exist');console.log('Exit Code:',r.status,'| archive-missing FAIL detected:',ok);process.exit(ok?0:1);"
  ```

  Tiêu chí đạt: lệnh probe thoát mã **0** (in `archive-missing FAIL detected: true`), chạy được cả trước lẫn sau triển khai. Cập nhật "Tiêu chí Đạt" của §8.3 và Risk #8 tương ứng.

**[MINOR-A] `parseInt` chấp nhận hậu tố rác.** [CMD #4-D] `--expected-headings=83abc` được hiểu là 83. Nên dùng `/^\d+$/.test(val)` hoặc `Number(val)` + `Number.isInteger`. Không chặn vì giá trị do implementer nhập tường minh.

**[MINOR-B] Link tới archive trong NOTE của `docs/CHANGELOG.md` (Bước 3.4) và badge trong `docs/lessons-learned.md` (Bước 3.5).** Nếu viết dạng markdown link, phải dùng file-relative `./archive/CHANGELOG-legacy.md` và `../.agents/rules/01-coding.md` (không phải `docs/archive/…` / `.agents/…`). Link checker `[1/5]` sẽ báo hỏng nếu viết theo repo root (fail chứ không false-PASS), nhưng nên ghi rõ trong bước để tránh vòng sửa.

**[MINOR-C] Nhắc lại**: Khi được duyệt, đổi header `> **Trạng thái**: In Review` → `Approved` trước khi viết code (§4.2) để guard công nhận token.

#### Kết Luận

**[CHANGES_REQUESTED]** — Logic script cho MAJOR-H đã đúng và được xác minh (thiếu archive → `FAIL … must exist`, exit 1; `NaN` bị chặn); toàn bộ MINOR của Run 4 đã được khắc phục. Còn 1 lỗi `[MAJOR]` duy nhất, nằm ở Test Contract chứ không ở script. Việc cần làm cho Revision 6:

1. MAJOR-I: Thay lệnh Negative Probe 6b trong §8.3 bằng probe sandbox cô lập (lệnh đề xuất ở trên, đã kiểm chứng trên cả hai shell), tiêu chí đạt = exit 0 + phát hiện thông điệp `must exist`; đồng bộ Risk #8.
2. (Khuyến nghị) MINOR-A → MINOR-C.

### Audit Run 6

- **Reviewer**: Claude Code CLI (Claude Opus 5.5 — `claude-opus-5-5`)
- **Ngày**: 2026-09-29
- **Đối tượng**: Technical Plan — Revision 6

#### Kiểm Chứng Lỗi Cũ (so với Audit Run 5)

| Lỗi Run 5                                                         | Trạng thái | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                |
| :---------------------------------------------------------------- | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR-I (Negative Probe 6b không cô lập trạng thái thiếu archive) |   ĐÃ SỬA   | §8.3 dùng probe sandbox `os.tmpdir()` chỉ chứa script + `CHANGELOG.md`, assert `status === 1` và `stderr` chứa `must exist`, tự dọn thư mục tạm; tiêu chí đạt = exit 0. Risk #8 đã đồng bộ. [CMD #1] chạy nguyên văn trên cây thật: `Exit Code: 1 \| archive-missing FAIL detected: true`, exit 0. Probe không phụ thuộc trạng thái cây làm việc → không còn mâu thuẫn với lệnh chính. |
| MINOR-A (`parseInt` chấp nhận hậu tố rác)                         |   ĐÃ SỬA   | [SRC] `scripts/verify-docs.mjs:242` `/^\d+$/.test(val)` trước `parseInt`. [CMD #5] `=83abc` và `=` (rỗng) → `FAIL: Invalid value …`, exit 1.                                                                                                                                                                                                                                           |
| MINOR-B (link NOTE/badge phải file-relative)                      |   ĐÃ SỬA   | Bước 3.4 dùng `./archive/CHANGELOG-legacy.md`; Bước 3.5 dùng `../.agents/rules/01-coding.md`; §1.2, §4.3, §8.1 đồng bộ.                                                                                                                                                                                                                                                                |
| MINOR-C (header `Approved` khi duyệt)                             |  GHI NHẬN  | §4.2 quy định rõ; nhắc lại ở MINOR-1 dưới đây.                                                                                                                                                                                                                                                                                                                                         |

#### Commands Executed

| #   | Lệnh                                                                                                                                              |     Exit      | Kết quả liên quan                                                                                                                                        |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :-----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lệnh Sandbox Negative Probe 6b của §8.3 (nguyên văn, Git Bash) trên cây hiện tại                                                                  |       0       | `Exit Code: 1 \| archive-missing FAIL detected: true`.                                                                                                   |
| 2   | `npx eslint scripts/verify-docs.mjs` / `npx prettier --check scripts/verify-docs.mjs`                                                             |     0 / 0     | Sạch lint và format.                                                                                                                                     |
| 3   | `grep -c "^## " docs/CHANGELOG.md`; `head -n 255 \| wc -c`; `grep -n "^## " \| sed -n 8,9p`                                                       |       0       | N = 82; 8 mục giữ lại = 31,977 bytes; mục 8 = `2026-09-10` (dòng 235), mục 9 = `2026-09-05` (dòng 256) → mốc cắt khớp Bước 2.2.                          |
| 4   | `node scripts/verify-docs.mjs` (baseline, không cờ)                                                                                               |       1       | `[1/5] PASS 278 files`; `[2/5] FAIL` (4 vị trí legacy dự kiến); `[3/5] NOTE 51 shorthand`; `[4/5] PASS`; `[5/5] NOTE`. Đúng thiết kế pre-implementation. |
| 5   | Sandbox mô phỏng hậu triển khai (`CHANGELOG.md` 2 `## ` + archive 81 `## `): `--strict-shorthand --expected-headings=83` / `=83abc` / `=` / `=84` | 0 / 1 / 1 / 1 | `83 == 83` → `>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<`; hậu tố rác và giá trị rỗng bị chặn; lệch số heading bị bắt.                        |
| 6   | `npx vitest run .agents/scripts/code-freeze-guard.test.ts`                                                                                        |       0       | `Tests 66 passed (66)`.                                                                                                                                  |
| 7   | `sed -n 195,230p .agents/scripts/code-freeze-guard.js`                                                                                            |       0       | Regex pending (dòng 208) khớp header `In Review`; token chỉ được xét ở dòng non-blank cuối cùng (dòng 215-226).                                          |

#### Mental Simulation Matrix (S1–S6)

| Kịch bản                     |  Kết quả   | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :--------------------------- | :--------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 Cold-start & Build**    |    PASS    | [CMD #2, #6] ESLint, Prettier, guard 66/66 đều exit 0. Plan không chạm `package.json`, tsconfig, `eslint.config.mjs`, không thêm dependency, không chạm `src/**` (§4.1).                                                                                                                                                                                                                                                                                                      |
| **S2 Lifecycle & Teardown**  | N/A (PASS) | Docs-only; script đọc đồng bộ, thoát tường minh; probe 6b tự `fs.rmSync` thư mục tạm.                                                                                                                                                                                                                                                                                                                                                                                         |
| **S3 Database & Temporal**   |    N/A     | Không chạm `supabase/migrations/**` hay schema.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **S4 Cross-Task State Flow** |    PASS    | [SRC] guard `readdirSync(plansDir)` không đệ quy → `docs/archive/plans/*.md` ngoài phạm vi quét. [ADV] T1: task khác chèn entry CHANGELOG trước khi triển khai \| T2: Bước 2.1 đo lại N \| T3: implementer truyền `--expected-headings=<N+1>` theo số đo mới → AN TOÀN. [CMD #3] hiện N = 82.                                                                                                                                                                                 |
| **S5 Security Boundary**     |    PASS    | [SRC] guard `UNFROZEN_PREFIXES = ["docs/"]` → ghi `docs/**` allow; ghi `.agents/**`, `scripts/**`, `.superpowers/**`, xóa `reviewer.backup/` (hiện 4 file), lệnh Giai đoạn 6 → `ask` (đã ghi chú). [ADV-TOCTOU] T1: header `In Review` \| T2: [CMD #7] regex pending khớp \| T3: token bị bỏ qua tới khi header đổi `Approved` → đúng `05-plan-review.md §5`. Chuỗi token xuất hiện trong dòng Revision (dòng 4) không ảnh hưởng vì guard chỉ xét dòng cuối. Không có secret. |
| **S6 External Resilience**   |    N/A     | Không có lời gọi AI provider / route serverless.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Domain Inquiry**           |    PASS    | Mọi control của Verification Gate đã được chứng minh bắt đúng vi phạm, cô lập (`evidence-bar.md §4.5.3`): legacy grep không cờ `g` (Run 3), thiếu archive → FAIL (Run 5 + [CMD #1]), lệch heading và giá trị cờ sai → FAIL ([CMD #5]).                                                                                                                                                                                                                                        |

#### Phân Loại Lỗi

Không còn `[BLOCKER]` hay `[MAJOR]`.

**[MINOR-1] Kích hoạt token.** Guard bỏ qua `[PLAN_APPROVED]` khi header còn `In Review` ([CMD #7]). Orchestrator phải đổi dòng 3 thành `> **Trạng thái**: Approved` (§4.2) trước khi bắt đầu Giai đoạn 1; không thêm nội dung nào sau dòng token cuối file.

**[MINOR-2] Dòng Revision (dòng 4) chứa chuỗi token.** Vô hại với guard hiện tại (chỉ xét dòng cuối) nhưng dễ gây nhầm lẫn khi grep token thủ công; có thể bỏ ở lần sửa sau.

**[MINOR-3] Rolling Archive Policy (§4.4).** Policy "append vào đầu phần thân" archive là đúng thứ tự thời gian; khi áp dụng lần sau nhớ chạy lại script với `--expected-headings=<tổng mới>` để giữ bằng chứng bảo toàn heading.

#### Kết Luận

**APPROVED** — Lỗi `[MAJOR]` duy nhất của Run 5 (MAJOR-I) và toàn bộ MINOR-A → MINOR-C đã được khắc phục và xác minh bằng lệnh. Kế hoạch tuân thủ ranh giới Zero-Code Mutation, không đưa công nghệ ngoài stack, Verification Gate chạy được nguyên văn trên cả Git Bash và PowerShell 5.1 và đã được chứng minh không false-PASS. Chỉ còn góp ý `[MINOR]`, không chặn triển khai.

[PLAN_APPROVED]
