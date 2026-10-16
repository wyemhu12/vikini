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
