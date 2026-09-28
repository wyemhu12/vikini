import { describe, it, expect } from "vitest";
import { balanceThinkTags } from "./thinkTags";

describe("balanceThinkTags", () => {
  it("returns empty or falsy strings unchanged", () => {
    expect(balanceThinkTags("")).toBe("");
  });

  it("returns content without think tags unchanged", () => {
    const text = "Hello world! This is a standard response.";
    expect(balanceThinkTags(text)).toBe(text);
  });

  it("balances a single unclosed <think> tag", () => {
    const text = "<think>Analyzing user query...";
    expect(balanceThinkTags(text)).toBe("<think>Analyzing user query...</think>");
  });

  it("balances multiple unclosed <think> tags", () => {
    const text = "<think>Step 1<think>Step 2";
    expect(balanceThinkTags(text)).toBe("<think>Step 1<think>Step 2</think></think>");
  });

  it("leaves already balanced <think> tags unchanged", () => {
    const text = "<think>Thoughts here</think>\nFinal answer.";
    expect(balanceThinkTags(text)).toBe(text);
  });

  it("balances only the unclosed tag when one is closed and one is open", () => {
    const text = "<think>Thoughts 1</think>\nAnswer 1\n<think>Thoughts 2";
    expect(balanceThinkTags(text)).toBe(
      "<think>Thoughts 1</think>\nAnswer 1\n<think>Thoughts 2</think>"
    );
  });

  it("handles extra closing tags gracefully without modifying content", () => {
    const text = "<think>Thoughts</think></think>";
    expect(balanceThinkTags(text)).toBe(text);
  });
});
