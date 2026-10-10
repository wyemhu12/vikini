import { describe, it, expect, vi } from "vitest";
import { sendThinkingChunk, accumulateReasoning } from "./reasoningStreamHelper.server";

describe("reasoningStreamHelper.server", () => {
  it("sends thinking SSE event with chunk", () => {
    const enqueue = vi.fn();
    const controller = {
      enqueue,
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    sendThinkingChunk(controller, "Thinking step 1");

    expect(enqueue).toHaveBeenCalledTimes(1);
    const decoder = new TextDecoder();
    const enqueuedBytes = enqueue.mock.calls[0][0];
    const text = decoder.decode(enqueuedBytes);
    expect(text).toBe('event: thinking\ndata: {"thinking":"Thinking step 1"}\n\n');
  });

  it("does not enqueue when chunk is empty", () => {
    const enqueue = vi.fn();
    const controller = {
      enqueue,
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    sendThinkingChunk(controller, "");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("accumulates reasoning strings correctly", () => {
    let buffer = "";
    buffer = accumulateReasoning(buffer, "Step 1: ");
    buffer = accumulateReasoning(buffer, "analyze problem\n");
    buffer = accumulateReasoning(buffer, "Step 2: solve");
    expect(buffer).toBe("Step 1: analyze problem\nStep 2: solve");
  });

  it("handles empty chunks in accumulateReasoning safely", () => {
    expect(accumulateReasoning("initial", "")).toBe("initial");
    expect(accumulateReasoning("", "")).toBe("");
  });
});
