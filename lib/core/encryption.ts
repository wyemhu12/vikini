// lib/core/encryption.ts
// NOTE: This module is server-only (uses Node.js crypto)
// It should only be imported in server-side code (API routes, server components)

import crypto from "crypto";
import { logger } from "@/lib/utils/logger";

const encryptionLogger = logger.withContext("encryption");

// SECURITY: Encryption key MUST be set via environment variable
// No fallback key to prevent using insecure default encryption
// Only validate on server-side (this module should not be used on client)
const RAW_KEY = typeof window === "undefined" ? process.env.DATA_ENCRYPTION_KEY : undefined;

if (typeof window === "undefined") {
  if (!RAW_KEY || RAW_KEY.trim().length < 32) {
    const error = new Error(
      "DATA_ENCRYPTION_KEY is required and must be at least 32 characters. " +
      "Please set it in your environment variables. " +
      "Generate a secure key with: openssl rand -base64 32"
    );
    encryptionLogger.error("Missing or invalid DATA_ENCRYPTION_KEY", error);
    throw error;
  }
}

const IV_LENGTH = 16; 

// 3. Hàm tạo key chuẩn 32 bytes (SHA-256)
function getKey(): Buffer {
  if (!RAW_KEY) {
    throw new Error("DATA_ENCRYPTION_KEY is not available");
  }
  return crypto.createHash("sha256").update(String(RAW_KEY)).digest();
}

export function encryptText(text: string | null | undefined): string {
  if (!text) return text || "";
  
  // Server-only: This function should not be called on client-side
  if (typeof window !== "undefined") {
    encryptionLogger.warn("encryptText called on client-side - this should not happen");
    return String(text);
  }
  
  if (!RAW_KEY) {
    encryptionLogger.error("DATA_ENCRYPTION_KEY not available");
    return String(text);
  }
  
  // Ép kiểu về String để tránh lỗi nếu text là object/null
  const textStr = String(text);
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    
    let encrypted = cipher.update(textStr, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (e) {
    // QUAN TRỌNG: Nếu lỗi, chỉ in log và TRẢ VỀ TEXT GỐC (không làm sập app)
    encryptionLogger.error("Encrypt failed, using plain text:", e);
    return textStr;
  }
}

export function decryptText(text: string | null | undefined): string {
  if (!text) return text || "";
  
  // Server-only: This function should not be called on client-side
  if (typeof window !== "undefined") {
    // On client-side, return text as-is (decryption should happen server-side)
    return String(text);
  }
  
  if (!RAW_KEY) {
    encryptionLogger.error("DATA_ENCRYPTION_KEY not available");
    return String(text);
  }
  
  try {
    const textStr = String(text);
    const parts = textStr.split(":");
    
    // Kiểm tra format: Phải có 2 phần và phần IV phải đúng 32 ký tự hex
    if (parts.length !== 2 || parts[0].length !== 32) return textStr;

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    const key = getKey();
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString("utf8");
  } catch (e) {
    // Nếu giải mã lỗi (do sai key cũ/mới), trả về text gốc để UI vẫn hiện được
    // encryptionLogger.warn("Decrypt failed:", e);
    return String(text);
  }
}

