# Giới Thiệu Tổng Quan Về Vikini

## 1. Vikini Là Gì?

Vikini là một nền tảng Web AI tiên tiến, cung cấp trải nghiệm làm việc và trò chuyện thông minh. Với mục tiêu mang đến một không gian làm việc tích hợp (Workspace-first layout), Vikini kết hợp sức mạnh của nhiều mô hình trí tuệ nhân tạo hàng đầu như Google Gemini, Anthropic Claude, và các mô hình thông qua OpenRouter để hỗ trợ người dùng xử lý văn bản, tệp tin, hình ảnh và âm thanh.

## 2. Các Tính Năng Nổi Bật

### 💬 Hệ Thống Chat & Trải Nghiệm Streaming

- **Real-time Streaming**: Trải nghiệm chat mượt mà chuẩn chuyên nghiệp với hiệu ứng Typewriter, tự động cuộn (smart auto-scroll) và hiển thị tiến trình tư duy "Thinking" của AI (dành cho Gemini 3).
- **Đa Năng & Đa Mô Hình**: Tích hợp các AI mạnh mẽ, hiển thị chi tiết số lượng token sử dụng (Token Count Display) và bảo mật tin nhắn bằng chuẩn mã hóa AES-256-GCM.
- **Voice Features**: Hỗ trợ nhập liệu bằng giọng nói (Speech-to-Text) kèm biểu đồ sóng âm và tính năng đọc phản hồi của AI (Text-to-Speech) tự động nhận diện ngôn ngữ.

### 📚 Projects & Knowledge Base (RAG)

- **Quản lý theo dự án**: Tổ chức các cuộc hội thoại và dữ liệu theo từng Project riêng biệt với giao diện tập trung.
- **Tương tác tài liệu**: Người dùng có thể tải lên các tài liệu để xây dựng kho kiến thức riêng (Knowledge Base). Hệ thống sẽ tự động phân mảnh (auto-chunking) và sử dụng công nghệ RAG (Retrieval-Augmented Generation) để AI có thể trả lời dựa trên ngữ cảnh tài liệu chuẩn xác.

### 🎨 Image Studio & Gallery

- **AI Image Generation**: Công cụ tạo ảnh chuyên nghiệp hỗ trợ nhiều model như Gemini Image Flash, DALL-E 3, Flux Pro. Có sẵn các phong cách (style presets), tùy chỉnh tỷ lệ ảnh và tính năng AI cải thiện câu lệnh (prompt enhancement).
- **Gallery**: Thư viện quản lý ảnh với cuộn vô hạn (Infinite scroll), chế độ xem toàn màn hình (Image Lightbox), và tính năng so sánh hai ảnh (Image Compare) bằng overlay slider hoặc side-by-side.

### 🤖 Hệ Thống GEMs (AI Personas)

- Cho phép tạo và sử dụng các "Nhân vật AI" (GEMs) với các hướng dẫn hệ thống (system instructions) riêng biệt, phục vụ cho các quy trình làm việc chuyên sâu hoặc nhập vai. Hỗ trợ lưu trữ phiên bản (versioning) khi có sự thay đổi.

### 📁 Quản Lý File Tiện Lợi

- Hỗ trợ tải lên và trích xuất nội dung từ nhiều định dạng tệp (PDF, tài liệu văn bản, hình ảnh, video, âm thanh). Giao diện xem trước nội tuyến (inline-first UX) và cơ chế dọn dẹp tự động (TTL 30 ngày) giúp tối ưu lưu trữ.

### ⚙️ Quản Trị Hệ Thống (Admin Dashboard)

- Cung cấp giao diện quản lý tập trung cho Admin: kiểm soát người dùng, phân quyền (Rank Limits), cấu hình giới hạn Rate Limiting và quản lý các GEM hệ thống.

## 3. Nền Tảng Công Nghệ

Vikini được xây dựng dựa trên một kiến trúc hiện đại, đảm bảo tính bảo mật, hiệu suất tối đa và khả năng dễ dàng mở rộng:

- **Core & Frontend**: Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4.
- **Giao Diện (UI/UX)**: Shadcn/UI, Radix UI, Framer Motion (xử lý animation), Lucide Icons. Thiết kế tuân theo hệ thống Theme linh hoạt và phong cách Glassmorphism.
- **State Management**: Zustand (Client state), SWR (Server state).
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Storage).
- **Cache & Rate Limit**: Upstash Redis.
- **AI Integration**: `@google/genai` (Gemini), kết hợp với cấu trúc Provider linh hoạt hỗ trợ Claude, Groq, OpenRouter và các dịch vụ tạo ảnh Replicate, OpenAI.

## 4. Trải Nghiệm Người Dùng (UX/UI) & Điểm Nhấn Thiết Kế

Vikini đặt trọng tâm vào việc xây dựng một giao diện **Minimal & Premium** (Tối giản & Cao cấp), ưu tiên không gian làm việc (Workspace-first) với các tiêu chuẩn thiết kế khắt khe:

- **Hệ Thống Theme & Glassmorphism**: Sử dụng Tailwind CSS 4 với kiến trúc thiết kế Design Tokens. Giao diện mang đậm phong cách kính mờ (Glassmorphism) như _Starry Sky_, kết hợp linh hoạt với các lớp phủ mờ (Opaque Overlays) đảm bảo độ tương phản và khả năng đọc tốt trên hơn 15 theme khác nhau.
- **Micro-Interactions & Animations**: Tích hợp **Framer Motion** để mang lại các hiệu ứng chuyển động mượt mà (dưới 300ms cho phản hồi UI). Các chi tiết tinh tế như hiệu ứng nhấp nháy con trỏ khi AI gõ (Typing Cursor), khối hiển thị tiến trình tư duy "Thinking" mở rộng mượt mà, hay tin nhắn trượt vào màn hình đều được chăm chút kỹ lưỡng.
- **Thành Phần Giao Diện Chuẩn Xác**: Xây dựng dựa trên các component của **Shadcn/UI** và **Radix UI**, đảm bảo tính nhất quán. Các thành phần tương tác tuân thủ nguyên tắc Mobile First, hỗ trợ Focus Trap, điều hướng bằng bàn phím (ESC) và chuẩn Accessibility (ARIA).
- **Phản Hồi Trạng Thái Thông Minh**: Loại bỏ hoàn toàn các popup native (`alert`/`confirm`) của trình duyệt. Hệ thống sử dụng **Toast Notifications** cho các thông báo không gián đoạn và **ConfirmDialogHost** toàn cục cho các thao tác quan trọng (như xóa dữ liệu), tạo trải nghiệm liền mạch và an toàn.
- **Giao Diện Song Ngữ Đồng Bộ (Bilingual UI)**: Hệ thống dịch thuật an toàn kiểu (Type Safety), hỗ trợ chuyển đổi hoàn chỉnh toàn bộ giao diện và các thông báo lỗi giữa Tiếng Việt và Tiếng Anh mà không cần tải lại trang.
