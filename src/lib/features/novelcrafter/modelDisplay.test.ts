// /lib/features/novelcrafter/modelDisplay.test.ts
import { describe, expect, it, vi } from "vitest";
import { normalizeModelForApi } from "@/lib/core/modelRegistry";
import { resolveModelDisplayInfo } from "./modelDisplay";

vi.mock("@/lib/core/modelRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/core/modelRegistry")>();
  return {
    ...actual,
    normalizeModelForApi: vi.fn(actual.normalizeModelForApi),
  };
});

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

  it("TC-MD-01: resolves registered legacy Gemini 2.5 aliases symmetrically to their replacement models", () => {
    const flash25 = resolveModelDisplayInfo("gemini-2.5-flash");
    expect(flash25.id).toBe("gemini-3.5-flash-lite");
    expect(flash25.providerId).toBe("gemini");
    expect(flash25.displayName).toBe("Gemini 3.5 Flash-Lite");

    const pro25 = resolveModelDisplayInfo("gemini-2.5-pro");
    expect(pro25.id).toBe("gemini-3.8-flash");
    expect(pro25.providerId).toBe("gemini");
    expect(pro25.displayName).toBe("Gemini 3.8 Flash");
  });

  it.each(["gemini-unknown-xyz", "constructor", "__proto__", "toString"])(
    "TC-MD-02: keeps unknown ID or prototype key %s as Custom and passes string argument to normalizeModelForApi",
    (key) => {
      const info = resolveModelDisplayInfo(key);
      expect(info.providerId).toBe("custom");
      expect(info.id).toBe(key);
      expect(info.displayName).toBe(key);
      expect(typeof info.id).toBe("string");
      expect(typeof info.displayName).toBe("string");
      expect(normalizeModelForApi).toHaveBeenLastCalledWith(key);
    }
  );
});
