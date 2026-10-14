import { describe, it, expect } from "vitest";
import { setupToolsAndSafety } from "./contextBuilder";

describe("contextBuilder - setupToolsAndSafety", () => {
  it("enables googleSearch + codeExecution + functionDeclarations + includeServerSideToolInvocations for gemini-4-argon when web search is enabled (TC-ARGON-08)", () => {
    const { tools, toolConfig } = setupToolsAndSafety(true, true, "gemini-4-argon");

    expect(tools).toEqual(
      expect.arrayContaining([
        { googleSearch: {} },
        { codeExecution: {} },
        expect.objectContaining({ functionDeclarations: expect.any(Array) }),
      ])
    );
    expect(toolConfig).toEqual({ includeServerSideToolInvocations: true });
  });

  it("enables full tool combination for gemini-3-flash-preview when web search is enabled", () => {
    const { tools, toolConfig } = setupToolsAndSafety(true, true, "gemini-3-flash-preview");

    expect(tools).toEqual(
      expect.arrayContaining([
        { googleSearch: {} },
        { codeExecution: {} },
        expect.objectContaining({ functionDeclarations: expect.any(Array) }),
      ])
    );
    expect(toolConfig).toEqual({ includeServerSideToolInvocations: true });
  });

  it("sends only googleSearch and undefined toolConfig for gemini-2.5-flash when web search is enabled", () => {
    const { tools, toolConfig } = setupToolsAndSafety(true, true, "gemini-2.5-flash");

    expect(tools).toEqual([{ googleSearch: {} }]);
    expect(toolConfig).toBeUndefined();
  });

  it("sends codeExecution + functionDeclarations without googleSearch when web search is disabled", () => {
    const { tools, toolConfig } = setupToolsAndSafety(false, true, "gemini-4-argon");

    expect(tools).not.toContainEqual({ googleSearch: {} });
    expect(tools).toEqual(
      expect.arrayContaining([
        { codeExecution: {} },
        expect.objectContaining({ functionDeclarations: expect.any(Array) }),
      ])
    );
    expect(toolConfig).toBeUndefined();
  });
});
