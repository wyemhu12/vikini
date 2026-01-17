// tests/encryption_key_validation.test.ts
import { describe, it, expect } from "vitest";

/**
 * We import only the pure validation helper (no side effects).
 * The module-level validation in encryption.ts runs at import time,
 * which makes dynamic-import testing tricky. Instead we test the
 * pure helper directly.
 */
import { isValidHexKey } from "@/lib/core/encryption";

describe("isValidHexKey", () => {
  it("accepts a valid 64-char lowercase hex key", () => {
    const key = "0123456789abcdef".repeat(4);
    expect(isValidHexKey(key)).toBe(true);
  });

  it("accepts a valid 64-char uppercase hex key", () => {
    const key = "0123456789ABCDEF".repeat(4);
    expect(isValidHexKey(key)).toBe(true);
  });

  it("rejects undefined", () => {
    expect(isValidHexKey(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidHexKey("")).toBe(false);
  });

  it("rejects key that is too short", () => {
    expect(isValidHexKey("abc123")).toBe(false);
  });

  it("rejects key that is too long", () => {
    const key = "0".repeat(65);
    expect(isValidHexKey(key)).toBe(false);
  });

  it("rejects key with non-hex characters", () => {
    const key = "z".repeat(64);
    expect(isValidHexKey(key)).toBe(false);
  });
});
