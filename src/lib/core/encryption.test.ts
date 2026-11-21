// @vitest-environment node
import crypto from "crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const TEST_HEX_KEY = "0123456789abcdef".repeat(4);

type EncryptionModule = typeof import("@/lib/core/encryption");
let encryption: EncryptionModule;

beforeAll(async () => {
  vi.stubEnv("DATA_ENCRYPTION_KEY", TEST_HEX_KEY);
  vi.resetModules();
  encryption = await import("@/lib/core/encryption");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("isValidHexKey", () => {
  it("accepts a valid 64-char lowercase hex key", () => {
    const key = "0123456789abcdef".repeat(4);
    expect(encryption.isValidHexKey(key)).toBe(true);
  });

  it("accepts a valid 64-char uppercase hex key", () => {
    const key = "0123456789ABCDEF".repeat(4);
    expect(encryption.isValidHexKey(key)).toBe(true);
  });

  it("rejects undefined", () => {
    expect(encryption.isValidHexKey(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(encryption.isValidHexKey("")).toBe(false);
  });

  it("rejects key that is too short", () => {
    expect(encryption.isValidHexKey("abc123")).toBe(false);
  });

  it("rejects key that is too long", () => {
    const key = "0".repeat(65);
    expect(encryption.isValidHexKey(key)).toBe(false);
  });

  it("rejects key with non-hex characters", () => {
    const key = "z".repeat(64);
    expect(encryption.isValidHexKey(key)).toBe(false);
  });
});

describe("AES-256-GCM strict authTag & CBC legacy compatibility (TC-W1-02)", () => {
  it("roundtrips AES-256-GCM encryption and decryption with 16-byte authTag", () => {
    const plaintext = "Sensitive message payload 🔐 — line 2";
    const encrypted = encryption.encryptText(plaintext);
    const parts = encrypted.split(":");

    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12-byte IV
    expect(parts[1]).toHaveLength(32); // 16-byte auth tag
    expect(encryption.decryptText(encrypted)).toBe(plaintext);
  });

  it("rejects truncated GCM auth tags (4, 8, 12, 15 bytes)", () => {
    const encrypted = encryption.encryptText("Secret payload");
    const [ivHex, authTagHex, cipherHex] = encrypted.split(":");

    for (const byteLen of [4, 8, 12, 15]) {
      const truncatedTag = authTagHex.slice(0, byteLen * 2);
      const tampered = `${ivHex}:${truncatedTag}:${cipherHex}`;
      expect(() => encryption.decryptText(tampered)).toThrow(/Failed to decrypt data/);
    }
  });

  it("rejects oversized or non-hex GCM IV/authTag/ciphertext", () => {
    const encrypted = encryption.encryptText("Secret payload");
    const [ivHex, authTagHex, cipherHex] = encrypted.split(":");

    // Oversized auth tag (17 bytes)
    expect(() => encryption.decryptText(`${ivHex}:${authTagHex}aa:${cipherHex}`)).toThrow(
      /Failed to decrypt data/
    );
    // Non-hex characters in IV
    expect(() => encryption.decryptText(`${"z".repeat(24)}:${authTagHex}:${cipherHex}`)).toThrow(
      /Failed to decrypt data/
    );
    // Non-hex characters in auth tag
    expect(() => encryption.decryptText(`${ivHex}:${"g".repeat(32)}:${cipherHex}`)).toThrow(
      /Failed to decrypt data/
    );
    // Odd-length ciphertext hex
    expect(() => encryption.decryptText(`${ivHex}:${authTagHex}:${cipherHex}a`)).toThrow(
      /Failed to decrypt data/
    );
  });

  it("remains backward-compatible with legacy AES-256-CBC ciphertext", () => {
    const key = Buffer.from(TEST_HEX_KEY, "hex");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const enc = Buffer.concat([cipher.update("Legacy CBC message", "utf8"), cipher.final()]);
    const legacyPayload = `${iv.toString("hex")}:${enc.toString("hex")}`;

    expect(encryption.decryptText(legacyPayload)).toBe("Legacy CBC message");
  });
});
