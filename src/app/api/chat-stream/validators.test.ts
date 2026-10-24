import { describe, it, expect } from "vitest";
import { strataSamplingSchema, chatStreamRequestSchema } from "./validators";

describe("strataSamplingSchema & chatStreamRequestSchema (TC-48)", () => {
  it("accepts valid default, creative, and custom sampling configurations", () => {
    expect(strataSamplingSchema.safeParse({ mode: "default" }).success).toBe(true);
    expect(strataSamplingSchema.safeParse({ mode: "creative" }).success).toBe(true);
    expect(
      strataSamplingSchema.safeParse({
        mode: "custom",
        temperature: 0.85,
        top_p: 0.9,
        top_k: 40,
        min_p: 0.05,
        presence_penalty: 0.6,
      }).success
    ).toBe(true);
  });

  it("rejects out-of-range sampling parameters and invalid modes", () => {
    expect(
      strataSamplingSchema.safeParse({
        mode: "custom",
        temperature: 2.5,
      }).success
    ).toBe(false);

    expect(
      strataSamplingSchema.safeParse({
        mode: "custom",
        top_k: 500,
      }).success
    ).toBe(false);

    expect(
      strataSamplingSchema.safeParse({
        mode: "custom",
        presence_penalty: 3.0,
      }).success
    ).toBe(false);
  });

  it("validates chatStreamRequestSchema with optional strataSampling", () => {
    const parsed = chatStreamRequestSchema.safeParse({
      content: "Write a story",
      thinkingLevel: "off",
      strataSampling: { mode: "creative" },
    });
    expect(parsed.success).toBe(true);
  });
});
