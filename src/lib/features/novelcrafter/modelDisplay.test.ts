// /lib/features/novelcrafter/modelDisplay.test.ts
import { describe, expect, it } from "vitest";
import { resolveModelDisplayInfo } from "./modelDisplay";

describe("modelDisplay", () => {
  it("TC-12: resolves known model display info and routedModel fallback metadata", () => {
    const geminiInfo = resolveModelDisplayInfo("gemini-4-argon");
    expect(geminiInfo.id).toBe("gemini-4-argon");
    expect(geminiInfo.providerId).toBe("gemini");
    expect(geminiInfo.displayName.length).toBeGreaterThan(0);
    expect(geminiInfo.routedVia).toBeUndefined();

    const claudeRouted = resolveModelDisplayInfo(
      "claude-sonnet-4-6",
      "anthropic/claude-sonnet-4.6"
    );
    expect(claudeRouted.providerId).toBe("anthropic");
    expect(claudeRouted.routedVia).toBe("anthropic/claude-sonnet-4.6");
  });

  it("handles unknown or legacy model IDs gracefully without throwing", () => {
    const unknownInfo = resolveModelDisplayInfo("custom-provider/experimental-v9");
    expect(unknownInfo.providerId).toBe("custom");
    expect(unknownInfo.displayName).toBe("custom-provider/experimental-v9");
    expect(unknownInfo.id).toBe("custom-provider/experimental-v9");
  });
});
