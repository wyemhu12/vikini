-- ============================================
-- VIKINI - SUPABASE MIGRATION SCRIPT
-- Thêm cột model vào bảng conversations
-- ============================================

-- Bước 1: Thêm cột model với giá trị mặc định
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS model VARCHAR(64) DEFAULT 'gemini-2.5-flash';

-- Bước 2: Tạo index để tối ưu query (optional nhưng recommended)
CREATE INDEX IF NOT EXISTS idx_conversations_model ON conversations(model);

-- Bước 3: Cập nhật các conversation cũ (nếu có) để có giá trị model mặc định
UPDATE conversations 
SET model = 'gemini-2.5-flash' 
WHERE model IS NULL;

-- ============================================
-- KIỂM TRA SAU KHI CHẠY
-- ============================================

-- Chạy query sau để xác nhận migration thành công:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'conversations' AND column_name = 'model';

-- Kết quả mong đợi:
-- column_name | data_type         | column_default
-- model       | character varying | 'gemini-2.5-flash'::character varying
