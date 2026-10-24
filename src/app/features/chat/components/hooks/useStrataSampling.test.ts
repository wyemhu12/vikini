import { describe, it, expect } from "vitest";
import { parseStoredStrataSampling } from "./useStrataSampling";
import { STRATA_SAMPLING_PRESETS } from "@/lib/features/local-llm/strataThinking";

describe("parseStoredStrataSampling", () => {
  it("falls back to default mode preset on null or malformed JSON", () => {
    expect(parseStoredStrataSampling(null, false)).toEqual({
      mode: "default",
      ...STRATA_SAMPLING_PRESETS.default.thinkingOff,
    });
    expect(parseStoredStrataSampling("{bad-json", false)).toEqual({
      mode: "default",
      ...STRATA_SAMPLING_PRESETS.default.thinkingOff,
    });
    expect(parseStoredStrataSampling(JSON.stringify({ mode: "unknown" }), true)).toEqual({
      mode: "default",
      ...STRATA_SAMPLING_PRESETS.default.thinkingOn,
    });
  });

  it("parses creative and custom modes with clamped numeric values", () => {
    expect(parseStoredStrataSampling(JSON.stringify({ mode: "creative" }), false)).toEqual({
      mode: "creative",
      ...STRATA_SAMPLING_PRESETS.creative.thinkingOff,
    });

    const parsed = parseStoredStrataSampling(
      JSON.stringify({
        mode: "custom",
        temperature: 0.9,
        top_p: 0.92,
        top_k: 45,
        min_p: 0.05,
        presence_penalty: 0.7,
      }),
      false
    );
    expect(parsed).toEqual({
      mode: "custom",
      temperature: 0.9,
      top_p: 0.92,
      top_k: 45,
      min_p: 0.05,
      presence_penalty: 0.7,
    });
  });
});
