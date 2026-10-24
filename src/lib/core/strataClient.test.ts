// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getStrataClient,
  checkStrataHealth,
  countStrataPromptTokens,
  resetStrataClientCacheForTests,
} from "./strataClient";
import { resolveStrataThinkingPlan } from "@/lib/features/local-llm/strataThinking";

describe("strataClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STRATA_ENABLED: "true",
      STRATA_BASE_URL: "http://127.0.0.1:8080/v1",
      STRATA_MODEL_ID: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
    };
    resetStrataClientCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("configures OpenAI singleton with maxRetries: 0 (TC-31)", () => {
    const client = getStrataClient();
    expect(client.maxRetries).toBe(0);
    expect(client.baseURL).toBe("http://127.0.0.1:8080/v1");
  });

  it("caches checkStrataHealth for 5 seconds and deduplicates concurrent calls (TC-36)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            loaded: true,
            model: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
            max_context: 32768,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );

    const [r1, r2] = await Promise.all([checkStrataHealth(), checkStrataHealth()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(r1).toEqual({
      online: true,
      loaded: true,
      model: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      maxContext: 32768,
    });
    expect(r2).toEqual(r1);

    await checkStrataHealth();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await checkStrataHealth({ forceRefresh: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("sends output_config.effort when thinking is enabled and disabled thinking when 'off' (TC-43)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ input_tokens: 42 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );

    const planLow = resolveStrataThinkingPlan("low");
    const tokensLow = await countStrataPromptTokens(
      [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hi" },
      ],
      { plan: planLow }
    );
    expect(tokensLow).toBe(42);

    const firstCallInit = fetchSpy.mock.calls[0]?.[1];
    const firstBody = JSON.parse(String(firstCallInit?.body));
    expect(firstBody.output_config).toEqual({ effort: "low" });
    expect(firstBody.thinking).toEqual({ type: "enabled", budget_tokens: 4096 });
    expect(firstBody.system).toBe("System prompt");

    const planOff = resolveStrataThinkingPlan("off");
    await countStrataPromptTokens([{ role: "user", content: "Hi" }], { plan: planOff });
    const secondCallInit = fetchSpy.mock.calls[1]?.[1];
    const secondBody = JSON.parse(String(secondCallInit?.body));
    expect(secondBody.output_config).toBeUndefined();
    expect(secondBody.thinking).toEqual({ type: "disabled" });
  });
});
