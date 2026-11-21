import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockOpenAIConstructor } = vi.hoisted(() => ({
  mockOpenAIConstructor: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function (config: Record<string, unknown>) {
    mockOpenAIConstructor(config);
    return { config };
  }),
}));

import { getDeepSeekClient, resetDeepSeekClientForTests } from "./deepseekClient";

describe("deepseekClient (TC-W2A-14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDeepSeekClientForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDeepSeekClientForTests();
  });

  it("throws when DEEPSEEK_API_KEY is missing or blank", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(() => getDeepSeekClient()).toThrow(
      "DeepSeek API configuration missing (DEEPSEEK_API_KEY)"
    );
  });

  it("reuses singleton instance for identical API key and configures DeepSeek baseURL", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "ds-key-1");

    const client1 = getDeepSeekClient();
    const client2 = getDeepSeekClient();

    expect(client1).toBe(client2);
    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(1);
    expect(mockOpenAIConstructor).toHaveBeenCalledWith({
      apiKey: "ds-key-1",
      baseURL: "https://api.deepseek.com",
    });
  });

  it("recreates singleton when API key rotates", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "ds-key-1");
    const client1 = getDeepSeekClient();

    vi.stubEnv("DEEPSEEK_API_KEY", "ds-key-2");
    const client2 = getDeepSeekClient();

    expect(client1).not.toBe(client2);
    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(2);
  });
});
