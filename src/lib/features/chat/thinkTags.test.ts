import { describe, it, expect } from "vitest";
import { balanceThinkTags, stripThinkTags } from "./thinkTags";

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

describe("stripThinkTags", () => {
  it("returns empty or falsy strings unchanged", () => {
    expect(stripThinkTags("")).toBe("");
  });

  it("returns content without think tags unchanged", () => {
    const text = "Hello world! This is a standard response.";
    expect(stripThinkTags(text)).toBe(text);
  });

  it("strips closed <think> tags completely", () => {
    const text = "<think>old thought</think>answer";
    expect(stripThinkTags(text)).toBe("answer");
  });

  it("strips multiline think tags and trims whitespace", () => {
    const text = "<think>\nStep 1: thinking\nStep 2: done\n</think>\n\nFinal answer.";
    expect(stripThinkTags(text)).toBe("Final answer.");
  });

  it("strips unclosed think tags safely", () => {
    const text = "<think>interrupted thinking...";
    expect(stripThinkTags(text)).toBe("");
  });
});
