# docs/contracts.md

Vikini Data Contracts & Protocols
Tài liệu này định nghĩa các cấu trúc dữ liệu (Interfaces) và giao thức truyền tải giữa các thành phần của hệ thống Vikini.

1. Core Models (Thực thể chính)
   Conversation (Cuộc hội thoại)
   Đại diện cho một phiên chat của người dùng.

id: UUID (String)

userId: Email hoặc ID người dùng (String)

title: Tiêu đề chat (Mặc định: "New Chat")

model: Model AI đang sử dụng (ví dụ: gemini-1.5-flash)

gemId: ID của GEM đang áp dụng (có thể null)

updatedAt: Thời gian cập nhật cuối cùng (ISO String)

Message (Tin nhắn)
id: UUID (String)

role: "user" hoặc "assistant"

content: Nội dung tin nhắn (Lưu ý: Nội dung này được mã hóa khi lưu vào DB)

meta: Dữ liệu bổ sung (JSON) như nguồn Web Search hoặc ID tệp đính kèm.

GEM (AI Persona)
id: UUID (String)

name: Tên của GEM

instructions: Chỉ dẫn hệ thống (System Prompt) cho AI.

latestVersion: Phiên bản mới nhất của chỉ dẫn.

2. API Communication (Giao tiếp API)
   Chat Stream Request (/api/chat-stream)
   Giao thức khi gửi tin nhắn mới:

TypeScript

{
"conversationId": string (optional),
"content": string (min: 1),
"regenerate": boolean (optional),
"truncateMessageId": string (uuid, optional),
"skipSaveUserMessage": boolean (optional)
}
GEM Operations (/api/gems)
Create: Yêu cầu name, description, instructions, icon, color.

Update: Yêu cầu id và các trường cần thay đổi.

3. Attachment Lifecycle (Vòng đời tệp đính kèm)
   Định dạng hỗ trợ:
   Ảnh: png, jpg, jpeg, webp (Max 10MB)

Văn bản: txt, js, jsx, json (Max 2MB)

Tài liệu: pdf, doc, docx, xls, xlsx (Max 20MB)

Nén: zip (Max 20MB)

Quy trình xử lý:
Upload: Tệp được đẩy lên Supabase Storage theo đường dẫn: {userId}/{conversationId}/{uuid}-{filename}.

Metadata: Thông tin tệp được lưu vào bảng attachments kèm theo expires_at (Mặc định hết hạn sau 36 giờ).

Context: Khi chat, nội dung tệp (nếu là văn bản) sẽ được đọc và đưa vào Prompt của AI.

4. Security & Performance (Bảo mật & Hiệu suất)
   Encryption: Mọi nội dung tin nhắn (content) BẮT BUỘC phải đi qua hàm encryptText trước khi vào DB và decryptText khi lấy ra.

Caching: Danh sách Conversations và Gems của người dùng được lưu trong Redis (Upstash) để tăng tốc độ phản hồi.

Rate Limit: Áp dụng giới hạn số lượng yêu cầu dựa trên địa chỉ IP để bảo vệ tài nguyên hệ thống.
