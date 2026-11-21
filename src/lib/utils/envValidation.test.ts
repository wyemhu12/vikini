import { describe, it, expect, afterEach, vi } from "vitest";
import { validateEnv, validateEnvSafe } from "./envValidation";

const VALID_HEX_KEY = "0123456789abcdef".repeat(4);

function stubValidEnv(overrides: Record<string, string | undefined> = {}) {
  const base: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    NEXTAUTH_SECRET: "nextauth-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    GEMINI_API_KEY: "gemini-api-key",
    DATA_ENCRYPTION_KEY: VALID_HEX_KEY,
  };

  const merged = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    vi.stubEnv(key, value ?? "");
  }
}

describe("envValidation (TC-W1-02)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes with valid required environment variables and 64-char hex DATA_ENCRYPTION_KEY", () => {
    stubValidEnv();
    const env = validateEnv();
    expect(env.dataEncryptionKey).toBe(VALID_HEX_KEY);
    expect(validateEnvSafe()).toBe(true);
  });

  it("rejects DATA_ENCRYPTION_KEY that is only 32 characters (non-hex or short)", () => {
    stubValidEnv({ DATA_ENCRYPTION_KEY: "a".repeat(32) });
    expect(() => validateEnv()).toThrow(/DATA_ENCRYPTION_KEY must be a 64-character hex string/);
    expect(validateEnvSafe()).toBe(false);
  });

  it("rejects DATA_ENCRYPTION_KEY that is 64 non-hex characters", () => {
    stubValidEnv({ DATA_ENCRYPTION_KEY: "z".repeat(64) });
    expect(() => validateEnv()).toThrow(/DATA_ENCRYPTION_KEY must be a 64-character hex string/);
  });

  it("throws formatted error message listing missing required variables", () => {
    stubValidEnv({ GEMINI_API_KEY: "", GOOGLE_API_KEY: "" });
    expect(() => validateEnv()).toThrow(/Missing or invalid required environment variables/);
  });
});
