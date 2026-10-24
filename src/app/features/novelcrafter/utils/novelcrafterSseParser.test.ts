import { describe, expect, it } from "vitest";
import {
  parseNovelcrafterSseFrame,
  readNovelcrafterSseStream,
  type ParsedNovelcrafterSseFrame,
} from "./novelcrafterSseParser";

describe("novelcrafterSseParser (TC-B7-03)", () => {
  it("TC-B7-03: parses split SSE frames across chunks and flushes trailing un-terminated frame on stream close", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: token\ndata: {"t":"A"}\n\nevent: tok',
      'en\ndata: {"t":"B"}\n\nevent: token\ndata: {"t":"Trailing without double newline"}',
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const frames: string[] = [];
    const parsed: Array<ParsedNovelcrafterSseFrame | null> = [];
    await readNovelcrafterSseStream(stream, (frame) => {
      frames.push(frame);
      parsed.push(parseNovelcrafterSseFrame(frame));
    });

    expect(frames).toHaveLength(3);
    expect(frames[1]).toContain('"t":"B"');
    expect(parsed).toEqual([
      {
        eventType: "token",
        parsedData: { t: "A" },
      },
      {
        eventType: "token",
        parsedData: { t: "B" },
      },
      {
        eventType: "token",
        parsedData: { t: "Trailing without double newline" },
      },
    ]);
  });
});
