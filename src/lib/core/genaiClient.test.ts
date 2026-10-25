import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const googleGenAIMock = vi.fn();

vi.mock("@/lib/env", () => ({}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    public apiKey: string;
    constructor(opts: { apiKey: string }) {
      googleGenAIMock(opts);
      this.apiKey = opts.apiKey;
    }
  },
}));

describe("genaiClient", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    googleGenAIMock.mockClear();
  });

  afterEach(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalGoogleKey === undefined) {
      delete process.env.GOOGLE_API_KEY;
    } else {
      process.env.GOOGLE_API_KEY = originalGoogleKey;
    }
  });

  it("caches client instance when GEMINI_API_KEY is unchanged (T7b)", async () => {
    process.env.GEMINI_API_KEY = "k";
    delete process.env.GOOGLE_API_KEY;

    const mod = await import("./genaiClient");
    const first = mod.getGenAIClient();
    const second = mod.getGenAIClient();

    expect(first).toBe(second);
    expect(googleGenAIMock).toHaveBeenCalledTimes(1);
    expect(googleGenAIMock).toHaveBeenCalledWith({ apiKey: "k" });

    const info = mod.getGenAIClientInfo();
    expect(info.cached).toBe(true);
    expect(info.createdAt).toBeGreaterThan(0);
  });

  it("throws generic error without leaking env var names when keys are missing (T7c)", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const mod = await import("./genaiClient");
    expect(() => mod.getGenAIClient()).toThrow("AI service configuration is missing");
  });

  it("does not export legacy interaction helpers (T7d)", async () => {
    const mod = await import("./genaiClient");
    const createKey = ["create", "Research", "Interaction"].join("");
    const getKey = ["get", "Research", "Interaction"].join("");
    expect(createKey in mod).toBe(false);
    expect(getKey in mod).toBe(false);
  });
});
