Để tối ưu hóa việc quản lý và đưa toàn bộ cấu hình về "một mối" (Single Source of Truth), kế hoạch triển khai sẽ tập trung vào việc chuyển dịch các tham số từ ENV/Code sang bảng cấu hình trong Supabase. Điều này giúp Admin có thể thay đổi giới hạn ngay lập tức mà không cần can thiệp vào code hay redeploy.

Dưới đây là kế hoạch chi tiết dành cho Agent (Cursor/Windsurf) để bắt tay vào làm:

---

### 1. Phân bổ lại hệ thống Limit (Architecture Redesign)

Thay vì để rải rác, chúng ta sẽ quản lý theo mô hình sau:

- **Database (Supabase):** Lưu trữ định nghĩa của từng Rank (Messages, File Size, Features).
- **Admin UI:** Giao diện điều chỉnh các con số trong Database.
- **Middleware/Logic Code:** Chỉ đóng vai trò đọc dữ liệu từ DB và thực thi kiểm tra (Enforcement).

### 2. Bài viết ý tưởng & Hướng dẫn cho Agent (Prompt cho Cursor)

**Tiêu đề: Hợp nhất quản lý Limitation và Xây dựng Admin Dashboard cho Vikini**

**Bối cảnh:**
Hiện tại, các giới hạn (limits) đang nằm rải rác ở ENV (Whitelist), Code (File size), và Supabase. Tôi muốn đưa tất cả về Database để Admin có thể kiểm soát toàn diện thông qua một giao diện duy nhất.

**Yêu cầu Agent thực hiện theo các bước sau:**

#### Bước 1: Thiết lập Database Schema cho Quản trị

- **Tạo bảng `rank_configs`:** Để lưu giới hạn cho từng rank.
- `rank` (PK, text): 'basic', 'pro', 'admin'.
- `daily_message_limit` (int).
- `max_file_size_mb` (int).
- `features` (jsonb): Lưu `{ "web_search": true, "unlimited_gems": true }`.

- **Cập nhật bảng `profiles`:**
- `id` (uuid, references auth.users).
- `email` (text, unique).
- `rank` (text, default 'basic').
- `is_blocked` (boolean, default false).

- **Khởi tạo dữ liệu mẫu:** Chèn các giá trị Basic (20 tin, 5MB), Pro (100 tin, 50MB), Admin (9999, 100MB) vào `rank_configs`.

#### Bước 2: Hợp nhất Logic Authentication & Whitelist

- **Chỉnh sửa `lib/features/auth/auth.ts`:**
- Thay vì đọc `process.env.WHITELIST_EMAILS`, hãy thực hiện query vào bảng `profiles`.
- Nếu email tồn tại trong bảng `profiles` và không bị `is_blocked`, cho phép đăng nhập.
- Ghi đè `session` để trả về thông tin `rank` của user.

#### Bước 3: Xây dựng Hệ thống Kiểm soát Tập trung (Centralized Limit Checker)

- **Tạo `lib/core/limits.ts`:** Viết các hàm helper như `getUserLimits(userId)` và `checkCanSendMessage(userId)`.
- **Tích hợp vào Chat API:** Trong `app/api/chat-stream/route.ts`, gọi hàm kiểm tra trước khi stream tin nhắn.
- **Tích hợp vào Upload API:** Trong `app/api/attachments/upload/route.ts`, lấy `max_file_size_mb` từ rank của user để validate file upload.

#### Bước 4: Phát triển Admin Dashboard (Giao diện Glassmorphism)

- **Thiết kế trang `/admin`:**
- **Theme:** Sử dụng `backdrop-blur-3xl`, nền `bg-white/[0.03]`, viền `border-white/10` tương tự trang Login.
- **User Manager:** Danh sách user, thay đổi Rank (Basic/Pro/Admin), nút Block/Unblock.
- **Global Limit Manager:** Các ô Input để Admin sửa trực tiếp số tin nhắn/ngày hoặc dung lượng file cho từng Rank (lưu vào bảng `rank_configs`).
- **Global GEMs Editor:** Quản lý các GEM có `is_premade: true`.

#### Bước 5: Cập nhật Sidebar UI

- Thêm nút **"Admin Management"** với icon Shield phía trên nút Logout trong `Sidebar.jsx`.
- Chỉ hiển thị nút này nếu `session.user.rank === 'admin'`.

---

### 3. Đề xuất bảng Limit chi tiết (Dễ dàng nhập vào Admin Site)

| Tham số            | Basic        | Pro      | Admin            |
| ------------------ | ------------ | -------- | ---------------- |
| **Daily Messages** | 20           | 100      | 9999 (Unlimited) |
| **Max File Size**  | 5 MB         | 50 MB    | 100 MB           |
| **Models**         | Tất cả       | Tất cả   | Tất cả           |
| **Global GEMs**    | Chỉ xem/dùng | Xem/Dùng | Tạo/Sửa/Xóa      |
| **Web Search**     | Tắt          | Bật      | Bật              |

### 4. Cách gán quyền Admin thủ công (Query cho bạn)

Để bắt đầu, bạn hãy chạy lệnh SQL này trong Supabase Dashboard để tự cấp quyền cho mình:

```sql
-- Giả sử ID của bạn trong auth.users là '123-abc'
INSERT INTO profiles (id, email, rank)
VALUES ('ID_CỦA_BẠN', 'your-email@gmail.com', 'admin')
ON CONFLICT (id) DO UPDATE SET rank = 'admin';

```

**Lời khuyên cho Agent:** Hãy yêu cầu Agent sử dụng `shadcn/ui` (nếu dự án có sẵn) hoặc Tailwind CSS thuần để tạo các component "Glass" giúp giao diện trông đồng nhất với trang Login hiện tại của Vikini.
