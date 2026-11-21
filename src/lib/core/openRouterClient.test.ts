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

import { getOpenRouterClient, resetOpenRouterClientForTests } from "./openRouterClient";

describe("openRouterClient (TC-W2A-14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOpenRouterClientForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetOpenRouterClientForTests();
  });

  it("throws when OPENROUTER_API_KEY is missing or blank", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(() => getOpenRouterClient()).toThrow(
      "OpenRouter API configuration is missing (OPENROUTER_API_KEY)"
    );
  });

  it("reuses singleton instance for identical API key and configures OpenRouter headers", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key-1");

    const client1 = getOpenRouterClient();
    const client2 = getOpenRouterClient();

    expect(client1).toBe(client2);
    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(1);
    expect(mockOpenAIConstructor).toHaveBeenCalledWith({
      apiKey: "or-key-1",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://vikini.app",
        "X-Title": "Vikini",
      },
    });
  });

  it("recreates singleton when API key rotates", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key-1");
    const client1 = getOpenRouterClient();

    vi.stubEnv("OPENROUTER_API_KEY", "or-key-2");
    const client2 = getOpenRouterClient();

    expect(client1).not.toBe(client2);
    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(2);
  });
});
