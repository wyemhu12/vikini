// lib/core/encryption.js
import crypto from "crypto";

// 1. Key dự phòng: Giúp app chạy được ngay cả khi bạn quên set biến môi trường trên Vercel.
// (Lưu ý: Key này chỉ để chống crash, không bảo mật cao bằng Env Var)
const FALLBACK_KEY = "vibe-coding-fallback-key-32-chars!!"; 

// 2. Lấy key ưu tiên từ Env, nếu không có thì dùng Fallback
const RAW_KEY = process.env.DATA_ENCRYPTION_KEY || FALLBACK_KEY;
const IV_LENGTH = 16; 

// 3. Hàm tạo key chuẩn 32 bytes (SHA-256)
function getKey() {
  return crypto.createHash("sha256").update(String(RAW_KEY)).digest();
}

export function encryptText(text) {
  if (!text) return text;
  try {
    // Ép kiểu về String để tránh lỗi nếu text là object/null
    const textStr = String(text);
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    
    let encrypted = cipher.update(textStr);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (e) {
    // QUAN TRỌNG: Nếu lỗi, chỉ in log và TRẢ VỀ TEXT GỐC (không làm sập app)
    console.error("[Encryption] Encrypt failed, using plain text:", e.message);
    return text;
  }
}

export function decryptText(text) {
  if (!text) return text;
  try {
    const textStr = String(text);
    const parts = textStr.split(":");
    
    // Kiểm tra format: Phải có 2 phần và phần IV phải đúng 32 ký tự hex
    if (parts.length !== 2 || parts[0].length !== 32) return text;

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    const key = getKey();
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (e) {
    // Nếu giải mã lỗi (do sai key cũ/mới), trả về text gốc để UI vẫn hiện được
    // console.warn("[Encryption] Decrypt failed:", e.message);
    return text;
  }
}