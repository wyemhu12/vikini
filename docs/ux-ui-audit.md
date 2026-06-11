# Phân tích UX/UI & Kế hoạch Cải thiện — Vikini

> Tài liệu audit. Ngày: 2026-06-11. Phạm vi: toàn bộ web app (chat, image studio, gallery, gems, projects, auth, admin).

## 0. Cảm nhận tổng quan

Vikini đẹp và tham vọng về thị giác (15 theme, glassmorphism, gradient động, nhiều micro-interaction). Vấn đề **không** phải thiếu trau chuốt ở từng chỗ, mà là **sự trau chuốt không nhất quán** — như một ngôi nhà mỗi phòng do một người giỏi xây nhưng không chung bản vẽ. Đây là thứ khiến app cảm thấy "chưa thật chuyên nghiệp".

**Kết luận cốt lõi:** Đầu tư cao nhất là **chuẩn hoá nhất quán ở tầng nền móng**, KHÔNG phải đập đi xây lại. Bản sắc thị giác hiện tại đủ tốt để giữ.

---

## 1. Vấn đề mang tính hệ thống (lợi ích lớn nhất)

### 1.1. Bốn cách giải quyết khác nhau cho cùng một thành phần

| Thành phần | Các cách đang tồn tại                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Confirm    | `confirm()` trình duyệt (`projects/[id]/page.tsx:104`) · `DeleteConfirmModal` · nút 2 bước inline (gallery) · modal tự chế (ChatApp) |
| Modal      | Radix `Dialog` · `div fixed inset-0` tự dựng (không focus trap, không ESC, không `role="dialog"`)                                    |
| Loading    | spinner `Loader2` · skeleton shimmer (chỉ image-gen) · chữ "Loading…" · màn hình trống                                               |
| Error      | `toast` · banner cố định · hộp màu inline · trang lỗi hardcode                                                                       |
| Ngôn ngữ   | hook `useLanguage` · admin local state + localStorage · ternary hardcode (`auth/error/page.tsx:72-92`)                               |

**Tại sao quan trọng:** trải nghiệm không đoán trước được; chi phí bảo trì nhân lên; lỗ hổng a11y lặp lại.

**Hướng xử lý:** xây MỘT component chuẩn cho mỗi loại (`<ConfirmDialog>`, `<Modal>` trên Radix tích hợp focus trap + ESC, `<Skeleton>`, một kênh lỗi toast) rồi thay toàn bộ nơi gọi. Xoá `confirm()` và mọi modal `div` tự chế.

### 1.2. Lỗ hổng Accessibility

- Modal tự chế không bẫy focus, không đóng bằng ESC, thiếu `role="dialog"`/`aria-modal`.
- Nút mở dropdown tự chế thiếu `aria-haspopup`/`aria-expanded`.
- Không có focus ring nhất quán.
- Trạng thái chỉ phân biệt bằng màu (nút ngôn ngữ).
- Nút chỉ-icon (Gems, admin) chỉ có `title`, thiếu `aria-label`.

Phần lớn tự biến mất khi chuẩn hoá modal/dropdown sang Radix → lý do nên làm 1.1 trước.

### 1.3. Lệch chuẩn Design Token

- Hai token viền dùng lẫn lộn: `--border` vs `--control-border`.
- Màu hardcode bỏ qua theme: gradient tím→xanh Image Studio (cố định, không theo `--accent`); `#d97706` trong HeaderBar; `#020617` trong trang auth; scrollbar `bg-neutral-800`.
- Cỡ chữ siêu nhỏ (`text-[10px]`, `text-[11px]`) dùng cho nhãn/nút thật.

**Hướng xử lý:** quét hex thô / `neutral-*` / `white/X` route qua token; gộp về một token viền; cỡ chữ tối thiểu ~12px; thang typography 12/14/16/20/24; gradient suy từ `--accent`.

---

## 2. Sửa lỗi đáng chú ý theo màn hình

- **Auth/Error:** ternary VI/EN hardcode + `@ts-ignore` thay vì hệ dịch; `window.location.href` thay vì router; `AccessPendingScreen` trộn VI title + EN body.
- **Gallery:** tìm kiếm không debounce; không nút "xoá bộ lọc"; bộ lọc không lưu; mũi tên chuyển ảnh chỉ hiện khi hover (vô hình trên mobile); không có vuốt.
- **Image Studio:** cảnh báo "model không hỗ trợ ảnh tham chiếu" hiện sau khi upload; hạn mức batch giấu trong tooltip hover.
- **Admin:** log audit JSON một dòng (không đọc được); bảng user không phân trang; `<select>` native hack `colorScheme:"dark"`.
- **Chat:** nút thao tác `opacity-60` mobile vs `opacity-0`→hover desktop; `ThinkingLevelSelector` nhãn khác nhau theo provider; URL dài phá layout (thiếu `break-all`).
- **Theme:** đã có hạ tầng light mode (`base.css:62`) nhưng cả 15 theme đều dark — chưa ship theme sáng nào.

---

## 3. Lộ trình triển khai (chia giai đoạn, rủi ro thấp)

1. **Primitives** (ROI cao nhất): `<Modal>`, `<ConfirmDialog>`, `<Skeleton>`, toast/lỗi thống nhất, nút-icon chuẩn. → xoá phần lớn lỗi a11y.
2. **Củng cố Token:** một token viền, bỏ hex thô, cỡ chữ tối thiểu, gradient theo `--accent`, ship một theme sáng.
3. **Di chuyển từng màn hình:** thay nơi gọi cũ sang primitives, sửa mục Phần 2 khi đụng tới.
4. **Rà soát A11y:** focus ring, ARIA, bàn phím — phần lớn miễn phí nhờ GĐ1.

---

## 4. Ba hướng thị giác đề xuất

Cả 3 dùng chung tầng nền móng (Phần 1–3); chỉ khác ngôn ngữ thị giác.

### Hướng A — Tinh chỉnh hiện trạng

Giữ DNA tối/gradient/glass nhưng làm dịu: giảm gradient, bỏ cỡ chữ 10–11px, một accent từ theme, motion nhẹ. Rủi ro thấp, người dùng cũ không sốc. Đánh đổi: vẫn dáng dấp cũ.

### Hướng B — SaaS điềm tĩnh (Linear/Vercel/ChatGPT)

Trung tính, viền mảnh, bỏ phần lớn gradient/glow, accent rất tiết chế, hỗ trợ light+dark, nhiều whitespace, ưu tiên chữ. Cảm giác chuyên nghiệp cao nhất, dễ dùng lâu. Đánh đổi: mất cá tính glass; công sức trung bình.

### Hướng C — Bản sắc đậm, hệ thống hoá

Tận dụng glass + theme rực rỡ làm chữ ký, nhưng chuẩn hoá thành thang độ sâu (L1/L2/L3) + motion token-hoá. Khác biệt, dễ nhớ. Đánh đổi: công sức cao nhất để giữ nhất quán; glass giảm dễ đọc & nặng máy yếu.

### So sánh

| Tiêu chí      | A        | B          | C        |
| ------------- | -------- | ---------- | -------- |
| Công sức      | Thấp     | Trung bình | Cao      |
| Rủi ro        | Thấp     | Trung bình | TB–cao   |
| Chuyên nghiệp | Tốt      | Cao nhất   | Cao      |
| Cá tính       | Vừa      | Thấp       | Cao nhất |
| Dễ dùng lâu   | Tốt      | Tốt nhất   | Khá      |
| Light mode    | Tuỳ chọn | Có sẵn     | Khó      |

**Gợi ý:** Mục tiêu "mượt & chuyên nghiệp" → **Hướng B**. Muốn giữ chất Vikini → **A cho khung chính + C cho điểm nhấn** (đăng nhập, empty state, gallery).
