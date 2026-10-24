// /app/features/novelcrafter/utils/novelcrafterSseParser.ts
// SSE frame parser helper for Novelcrafter stream hook

import type { NovelcrafterFinishReason } from "@/lib/features/novelcrafter/types";

export interface ParsedNovelcrafterSseFrame {
  eventType: string;
  parsedData: Record<string, unknown>;
}

export function parseNovelcrafterSseFrame(frame: string): ParsedNovelcrafterSseFrame | null {
  let eventType = "message";
  let dataRaw = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) eventType = line.slice(6).trim();
    else if (line.startsWith("data:")) dataRaw += line.slice(5).trim();
  }
  if (!dataRaw) return null;
  try {
    const parsedData = JSON.parse(dataRaw) as Record<string, unknown>;
    return { eventType, parsedData };
  } catch {
    return null;
  }
}

export function parseFinishReason(raw: unknown): NovelcrafterFinishReason | undefined {
  if (
    raw === "stop" ||
    raw === "length" ||
    raw === "safety" ||
    raw === "error" ||
    raw === "aborted"
  ) {
    return raw;
  }
  return undefined;
}

export async function readNovelcrafterSseStream(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) onFrame(frame);
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    for (const frame of buffer.split("\n\n")) {
      if (frame.trim()) onFrame(frame);
    }
  }
}
