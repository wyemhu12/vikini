// lib/core/encryption.ts
// NOTE: This module is server-only (uses Node.js crypto)
// It should only be imported in server-side code (API routes, server components)

import crypto from "crypto";
import { logger } from "@/lib/utils/logger";

const encryptionLogger = logger.withContext("encryption");

// SECURITY: Encryption key MUST be a 64-character hex string (32 bytes)
const RAW_KEY = typeof window === "undefined" ? process.env.DATA_ENCRYPTION_KEY : undefined;

/**
 * Validates that a key is a 64-character hexadecimal string (32 bytes).
 */
export function isValidHexKey(key: string | undefined): key is string {
  if (!key) return false;
  return /^[0-9a-fA-F]{64}$/.test(key);
}

if (typeof window === "undefined") {
  if (!isValidHexKey(RAW_KEY)) {
    const error = new Error(
      "DATA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: openssl rand -hex 32"
    );
    encryptionLogger.error("Invalid DATA_ENCRYPTION_KEY", error);
    throw error;
  }
}

const GCM_IV_LENGTH = 12;
const CBC_IV_LENGTH = 16;

// Cache the key buffer
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (!RAW_KEY) {
    throw new Error("DATA_ENCRYPTION_KEY is not available");
  }
  // Use the hex key directly – no SHA-256 derivation
  cachedKey = Buffer.from(RAW_KEY, "hex");
  return cachedKey;
}

/**
 * Encrypts text using AES-256-GCM (Authenticated Encryption).
 * Returns format: iv:authTag:encryptedData (hex)
 */
export function encryptText(text: string | null | undefined): string {
  if (!text) return "";

  if (typeof window !== "undefined") {
    throw new Error("encryptText must only be called on server-side");
  }

  const textStr = String(text);
  const key = getKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(textStr, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypts text. Supports both new AES-256-GCM and legacy AES-256-CBC format.
 * Throws error if decryption fails (no silent failure to plain text).
 */
export function decryptText(text: string | null | undefined): string {
  if (!text) return "";

  if (typeof window !== "undefined") {
    // Return empty on client to avoid leakage if accidentally called
    return "";
  }

  const textStr = String(text);
  const parts = textStr.split(":");
  const key = getKey();

  try {
    // Format 1: GCM (New) -> iv:authTag:encrypted
    if (parts.length === 3 && parts[0].length === GCM_IV_LENGTH * 2) {
      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encryptedText = Buffer.from(parts[2], "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString("utf8");
    }

    // Format 2: CBC (Legacy) -> iv:encrypted
    if (parts.length === 2 && parts[0].length === CBC_IV_LENGTH * 2) {
      const iv = Buffer.from(parts[0], "hex");
      const encryptedText = Buffer.from(parts[1], "hex");

      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString("utf8");
    }

    // Invalid format OR plain text (which or should not be allowed anymore)
    if (textStr.includes(":")) {
      throw new Error("Invalid encryption format");
    }

    // If it's pure plain text, we return it but log a warning (transition period)
    // In strict mode later, we should throw error here too.
    encryptionLogger.warn("Attempted to decrypt non-encrypted text");
    return textStr;
  } catch (e) {
    encryptionLogger.error("Decryption failed:", e);
    throw new Error("Failed to decrypt data. Key might be invalid or data corrupted.");
  }
}
