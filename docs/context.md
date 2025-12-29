# docs/context.md

1. Quy mô & Phạm vi dự án (Scale & Scope)
   Quy mô người dùng: Project nội bộ (Private Tool), phục vụ nhóm nhỏ từ 5-10 users (hiện tại và trong 1 năm tới).

Tính chất: Không phải sản phẩm thương mại đại chúng (SaaS). Đây là công cụ chuyên dụng cho một nhóm "Power Users".

Hệ quả kỹ thuật:

Không cần over-optimize cho khả năng mở rộng (Scaling) lên hàng nghìn user.

Ưu tiên sự ổn định, chính xác và chất lượng phản hồi AI hơn là tốc độ tải trang cực nhanh.

Rate Limit có thể nới lỏng hơn so với public app, nhưng vẫn cần để bảo vệ API Cost.

2. Mục đích sử dụng chính (Core Use Cases)
   Dự án được xây dựng để phục vụ các nhu cầu chuyên sâu sau:

A. Sáng tạo nội dung & Viết lách (Creative Writing)
Hoạt động: Viết tiểu thuyết, xây dựng outline (đề cương), phát triển nhân vật, brainstorming ý tưởng cốt truyện.

Yêu cầu kỹ thuật:

Hỗ trợ Context Window lớn (để nhớ cốt truyện dài).

Khả năng xử lý Markdown tốt (để trình bày outline rõ ràng).

GEMs cần có system prompt linh hoạt để đóng vai "Editor" hoặc "Co-author".

B. Nghiên cứu & Phát triển (R&D)
Hoạt động: Brainstorming giải pháp kỹ thuật, nghiên cứu tài liệu dự án, tóm tắt thông tin từ file đính kèm.

Yêu cầu kỹ thuật:

Tính năng Attachments cực kỳ quan trọng: AI phải đọc được PDF/Docx chính xác để hỗ trợ research.

Bảo mật dữ liệu (Encryption) là bắt buộc vì chứa ý tưởng dự án nội bộ.

C. Tư vấn & Giải trí (Gaming/Lifestyle)
Hoạt động: Tra cứu hướng dẫn chơi game (Game Guides), tư vấn chiến thuật, build nhân vật game.

Yêu cầu kỹ thuật:

Cần các System GEMs chuyên biệt (ví dụ: "Elden Ring Guide", "D&D Master").

3. Các luồng nghiệp vụ chính (Workflows)
   Luồng Chat & Streaming
   User gửi tin nhắn (thường là prompt dài hoặc kèm file).

Hệ thống mã hóa tin nhắn -> Lưu DB.

Gọi Google Gemini API với context đầy đủ nhất có thể.

Stream câu trả lời về Client.

Luồng Quản lý GEMs (AI Personas)
User sẽ tạo nhiều Custom GEMs để phục vụ các mục đích khác nhau (1 GEM cho viết truyện, 1 GEM cho Code, 1 GEM cho Game).

Versioning rất quan trọng: User không muốn mất đi "tính cách" của AI mà họ đã dày công tinh chỉnh (prompt engineering).

Luồng Attachments
File upload chủ yếu là tài liệu tham khảo (Lore books, Technical docs).

Vòng đời 36h là hợp lý để giữ chi phí thấp, nhưng quy trình trích xuất text (Parsing) phải cực kỳ chính xác.

4. Hướng dẫn hành vi cho Agent
   Ưu tiên chất lượng nội dung: Khi xử lý prompt hoặc response, hãy đảm bảo định dạng Markdown đẹp, dễ đọc (dùng headings, bullet points).

Đừng phức tạp hóa hạ tầng: Với 10 users, chúng ta không cần Microservices hay Kubernetes. Hãy giữ kiến trúc Monolith trên Next.js đơn giản và hiệu quả.

Bảo mật: Dù là team nhỏ, dữ liệu (truyện, ý tưởng) là tài sản trí tuệ. Luôn luôn mã hóa.
