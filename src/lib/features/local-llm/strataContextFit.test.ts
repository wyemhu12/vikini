import { describe, it, expect, vi } from "vitest";
import { selectAnchoredWindow, fitStrataPrompt, type StrataHistoryTurn } from "./strataContextFit";
import { StrataContextOverflowError, StrataUnsupportedInputError } from "./errors";

describe("strataContextFit", () => {
  it("selectAnchoredWindow drops oldest non-anchor messages and keeps anchor-aligned prefix (TC-21, TC-22)", () => {
    const turns: StrataHistoryTurn[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Turn ${i}`,
      messageId: `msg-id-${i}`,
      estimatedTokens: 50,
    }));

    const fullWindow = selectAnchoredWindow(turns, 2000);
    expect(fullWindow.length).toBeGreaterThan(0);

    const trimmedWindow = selectAnchoredWindow(turns, 350);
    expect(trimmedWindow.length).toBeGreaterThan(0);
    expect(trimmedWindow.length).toBeLessThanOrEqual(7);
    expect(trimmedWindow[0]?.role).toBe("user");
  });

  it("fitStrataPrompt fits prompt using exact countTokens callback when under budget (TC-17)", async () => {
    const countTokens = vi.fn().mockResolvedValue(1200);

    const result = await fitStrataPrompt({
      systemPrompt: "You are helpful.",
      contents: [
        { role: "user", parts: [{ text: "Old message" }] },
        { role: "model", parts: [{ text: "<think>secret</think>Old answer" }] },
        { role: "user", parts: [{ text: "New question" }] },
      ],
      contentsMeta: [{ messageId: "m1" }, { messageId: "m2" }, { messageId: "m3" }],
      promptBudgetTokens: 20000,
      countTokens,
    });

    expect(result.exact).toBe(true);
    expect(result.droppedHistoryCount).toBe(0);
    expect(result.promptTokens).toBe(1200);
    expect(result.messages[0]).toEqual({ role: "system", content: "You are helpful." });
    expect(result.messages[2]).toEqual({ role: "assistant", content: "Old answer" });
  });

  it("drops oldest turns when initial window exceeds promptBudgetTokens (TC-18)", async () => {
    const countTokens = vi.fn().mockResolvedValueOnce(29000).mockResolvedValue(8000);

    const contents = [
      ...Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "model",
        parts: [{ text: `History message ${i} `.repeat(20) }],
      })),
      { role: "user", parts: [{ text: "Latest question" }] },
    ];

    const result = await fitStrataPrompt({
      systemPrompt: "System",
      contents,
      promptBudgetTokens: 20000,
      countTokens,
    });

    expect(countTokens.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.droppedHistoryCount).toBeGreaterThan(0);
    expect(result.promptTokens).toBe(8000);
  });

  it("falls back to conservative estimate when countTokens rejects (TC-19)", async () => {
    const countTokens = vi.fn().mockRejectedValue(new Error("Endpoint offline"));

    const result = await fitStrataPrompt({
      systemPrompt: "System",
      contents: [
        { role: "user", parts: [{ text: "Hello world" }] },
        { role: "user", parts: [{ text: "How are you?" }] },
      ],
      promptBudgetTokens: 20000,
      countTokens,
    });

    expect(result.exact).toBe(false);
    expect(result.promptTokens).toBeGreaterThan(0);
  });

  it("throws StrataContextOverflowError when single user message exceeds available budget (TC-20)", async () => {
    const countTokens = vi.fn().mockResolvedValue(32000);

    await expect(
      fitStrataPrompt({
        systemPrompt: "System",
        contents: [{ role: "user", parts: [{ text: "Huge message" }] }],
        promptBudgetTokens: 20000,
        countTokens,
      })
    ).rejects.toBeInstanceOf(StrataContextOverflowError);
  });

  it("throws StrataUnsupportedInputError when current message contains inlineData (TC-23)", async () => {
    await expect(
      fitStrataPrompt({
        systemPrompt: "System",
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType: "image/png", data: "base64..." } }],
          },
        ],
        promptBudgetTokens: 20000,
      })
    ).rejects.toBeInstanceOf(StrataUnsupportedInputError);
  });
});
