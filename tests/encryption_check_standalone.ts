// tests/encryption_check.ts
// Chạy bằng: npx tsx tests/encryption_check.ts
import crypto from "crypto";

// Giả lập logic từ encryption.ts để test thuật toán
const RAW_KEY = "test-key-must-be-at-least-32-chars-long-12345";
const GCM_IV_LENGTH = 12;
/* eslint-disable no-console */

function getKey(): Buffer {
  return crypto.createHash("sha256").update(String(RAW_KEY)).digest();
}

function encryptText(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptText(text: string): string {
  const parts = text.split(":");
  const key = getKey();
  try {
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encryptedText = Buffer.from(parts[2], "hex");
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString("utf8");
    }
    throw new Error("Invalid format");
  } catch {
    throw new Error("Decryption failed");
  }
}

async function test() {
  console.log("--- Testing AES-256-GCM Logic ---");
  const secret = "Dữ liệu tuyệt mật của Vikini!";
  const encrypted = encryptText(secret);
  console.log("Encrypted:", encrypted);
  const decrypted = decryptText(encrypted);
  console.log("Decrypted:", decrypted);
  if (secret === decrypted) {
    console.log("✅ GCM Logic: PASSED");
  } else {
    throw new Error("GCM Logic: FAILED");
  }
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
