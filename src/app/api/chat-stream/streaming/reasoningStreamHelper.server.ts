import { sendEvent } from "./utils";

/**
 * Sends a thinking / reasoning token chunk over SSE stream.
 * Format:
 * event: thinking
 * data: {"thinking":"..."}
 */
export function sendThinkingChunk(
  controller: ReadableStreamDefaultController<Uint8Array>,
  chunk: string
): void {
  if (!chunk) return;
  sendEvent(controller, "thinking", { thinking: chunk });
}

/**
 * Accumulates reasoning chunks into a single string buffer.
 */
export function accumulateReasoning(buffer: string, chunk: string): string {
  if (!chunk) return buffer || "";
  return (buffer || "") + chunk;
}
