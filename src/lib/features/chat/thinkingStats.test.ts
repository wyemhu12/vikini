import { describe, it, expect } from "vitest";
import { computeThinkingStats, formatThinkingDuration } from "./thinkingStats";

describe("thinkingStats", () => {
  it("estimates tokens via estimateTokens and computes elapsedMs cleanly (TC-41, TC-45)", () => {
    const empty = computeThinkingStats({
      startedAt: 1000,
      now: 3500,
      text: "",
    });
    expect(empty.tokens).toBe(0);
    expect(empty.elapsedMs).toBe(2500);

    const active = computeThinkingStats({
      startedAt: 1000,
      now: 4200,
      text: "1234567", // 7 chars / 3.5 = 2 tokens
      live: true,
    });
    expect(active.tokens).toBe(2);
    expect(active.elapsedMs).toBe(3200);
    expect(active.live).toBe(true);
  });

  it("formats duration cleanly in seconds with 1 decimal place", () => {
    expect(formatThinkingDuration(850)).toBe("0.8");
    expect(formatThinkingDuration(12400)).toBe("12.4");
    expect(formatThinkingDuration(125000)).toBe("125.0");
  });
});
