// /app/api/chat-stream/streaming/thought-signatures.test.ts
import { describe, expect, it } from "vitest";
import { DUMMY_THOUGHT_SIGNATURE } from "./types";
import { buildFunctionResponse, ensureFunctionCallSignature } from "./thought-signatures";

describe("thought-signatures - Function Call & Signature Helpers (TC-SIG-01..07)", () => {
  it("TC-SIG-01: buildFunctionResponse preserves name, id, and result payload", () => {
    expect(buildFunctionResponse({ name: "getWeather", id: "call-1" }, { result: "ok" })).toEqual({
      name: "getWeather",
      id: "call-1",
      response: { result: "ok" },
    });
  });

  it("TC-SIG-02: buildFunctionResponse omits id when functionCall has no id and formats error payload", () => {
    const res = buildFunctionResponse({ name: "x" }, { result: "", error: "boom" });
    expect(res).toEqual({
      name: "x",
      response: { error: "boom" },
    });
    expect(res).not.toHaveProperty("id");
  });

  it("TC-SIG-03: ensureFunctionCallSignature injects DUMMY_THOUGHT_SIGNATURE only on the first functionCall part when none has a signature", () => {
    const parts = [{ text: "t" }, { functionCall: { name: "a" } }, { functionCall: { name: "b" } }];
    const out = ensureFunctionCallSignature(parts);
    expect(out[0]).toEqual({ text: "t" });
    expect(out[1]).toEqual({
      functionCall: { name: "a" },
      thoughtSignature: DUMMY_THOUGHT_SIGNATURE,
    });
    expect(out[2]).toEqual({ functionCall: { name: "b" } });
    expect(out[2]).not.toHaveProperty("thoughtSignature");
  });

  it("TC-SIG-04: ensureFunctionCallSignature preserves existing real thoughtSignature without overwriting", () => {
    const parts = [
      { functionCall: { name: "a" }, thoughtSignature: "real" },
      { functionCall: { name: "b" } },
    ];
    expect(ensureFunctionCallSignature(parts)).toEqual(parts);
  });

  it("TC-SIG-05: ensureFunctionCallSignature returns parts unchanged when no functionCall is present", () => {
    const parts = [{ text: "hello" }];
    expect(ensureFunctionCallSignature(parts)).toEqual(parts);
  });

  it("TC-SIG-06: ensureFunctionCallSignature does not mutate deeply frozen input and returns a new array", () => {
    const firstPart = Object.freeze({
      functionCall: Object.freeze({ name: "frozenTool" }),
    });
    const input = Object.freeze([firstPart]);
    const out = ensureFunctionCallSignature(input);
    expect(out).not.toBe(input);
    expect(firstPart).not.toHaveProperty("thoughtSignature");
    expect(out[0]).toEqual({
      functionCall: { name: "frozenTool" },
      thoughtSignature: DUMMY_THOUGHT_SIGNATURE,
    });
  });

  it("TC-SIG-07: ensureFunctionCallSignature handles null, primitives, and null functionCall safely", () => {
    const malformed = [null, 42, "s", { functionCall: null }];
    expect(ensureFunctionCallSignature(malformed)).toEqual(malformed);
  });
});
