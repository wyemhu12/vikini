import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  appendUserMessageWithTruncate,
  parseSSEEvent,
  findMessageIndex,
  normalizeFrontendMessages,
  readStoredThinkingLevel,
  buildChatStreamPayload,
  extractStreamHttpError,
  generateClientMessageId,
  type ChatFrontendMessage,
} from "./streamProtocol";

describe("streamProtocol (CT-6C-01)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("parses valid SSE frames and safely ignores malformed or incomplete frames", () => {
    expect(parseSSEEvent('event: token\ndata: {"t":"Hello"}')).toEqual({
      event: "token",
      data: { t: "Hello" },
    });
    expect(parseSSEEvent("event: token\ndata: {broken-json")).toBeNull();
    expect(parseSSEEvent('data: {"t":"no-event"}')).toBeNull();
    expect(parseSSEEvent("event: ping")).toBeNull();
  });

  it("normalizes messages, pulls sources from meta, and filters context-only/system messages", () => {
    const raw: ChatFrontendMessage[] = [
      { id: "1", role: "user", content: "Hi" },
      { id: "2", role: "system", content: "Ignored" },
      {
        id: "3",
        role: "assistant",
        content: "Hidden context",
        meta: { isContextOnly: true },
      },
      {
        id: "4",
        role: "assistant",
        content: "Answer",
        meta: { sources: [{ title: "Src" }], urlContext: [{ url: "https://a.com" }] },
      },
    ];

    const normalized = normalizeFrontendMessages(raw);
    expect(normalized).toHaveLength(2);
    expect(normalized[1].sources).toEqual([{ title: "Src" }]);
    expect(normalized[1].urlContext).toEqual([{ url: "https://a.com" }]);
  });

  it("finds message index by reference, id, and reverse role+content fallback", () => {
    const m1: ChatFrontendMessage = { id: "id-1", role: "user", content: "first" };
    const m2: ChatFrontendMessage = { role: "assistant", content: "same" };
    const m3: ChatFrontendMessage = { id: "id-3", role: "assistant", content: "same" };
    const list = [m1, m2, m3];

    expect(findMessageIndex(list, m1)).toBe(0);
    expect(findMessageIndex(list, { id: "id-3", role: "assistant", content: "other" })).toBe(2);
    // Unsaved duplicate matches the matching unsaved entry first
    expect(findMessageIndex(list, { role: "assistant", content: "same" })).toBe(1);
    // When all entries have IDs, unsaved target falls back to last matching role+content
    const allSaved: ChatFrontendMessage[] = [
      { id: "a", role: "assistant", content: "dup" },
      { id: "b", role: "assistant", content: "dup" },
    ];
    expect(findMessageIndex(allSaved, { role: "assistant", content: "dup" })).toBe(1);
    expect(findMessageIndex(allSaved, { id: "missing", role: "user", content: "x" })).toBe(-1);
  });

  it("reads valid stored thinkingLevel and falls back to 'off'", () => {
    expect(readStoredThinkingLevel()).toBe("off");
    window.localStorage.setItem("vikini.thinkingLevel", "high");
    expect(readStoredThinkingLevel()).toBe("high");
    window.localStorage.setItem("vikini.thinkingLevel", "invalid-val");
    expect(readStoredThinkingLevel()).toBe("off");
  });

  it("builds stream payload with optional strataSampling and fileIds omitted when empty", () => {
    const minimal = buildChatStreamPayload({
      conversationId: "c-1",
      content: "hi",
      clientMessageId: "cm-1",
      regenerate: false,
      thinkingLevel: "off",
      fileIds: [],
    });
    expect(minimal).not.toHaveProperty("fileIds");
    expect(minimal).not.toHaveProperty("strataSampling");

    const full = buildChatStreamPayload({
      conversationId: "c-1",
      content: "hi",
      clientMessageId: "cm-1",
      regenerate: true,
      thinkingLevel: "high",
      strataSampling: { temperature: 0.7 },
      fileIds: ["f-1"],
    });
    expect(full.fileIds).toEqual(["f-1"]);
    expect(full.strataSampling).toEqual({ temperature: 0.7 });
  });

  it("extracts structured, string, and non-JSON HTTP errors safely", async () => {
    const structuredRes = new Response(
      JSON.stringify({ error: { message: "Rate limited", code: "RATE_LIMIT" } }),
      { status: 429 }
    );
    expect(await extractStreamHttpError(structuredRes)).toEqual({
      message: "Rate limited",
      code: "RATE_LIMIT",
      status: 429,
    });

    const stringRes = new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    expect(await extractStreamHttpError(stringRes)).toEqual({
      message: "Bad request",
      code: undefined,
      status: 400,
    });

    const htmlRes = new Response("<html>502</html>", { status: 502 });
    expect(await extractStreamHttpError(htmlRes)).toEqual({
      message: "Stream failed",
      code: undefined,
      status: 502,
    });
  });

  it("generates non-empty unique clientMessageIds", () => {
    const a = generateClientMessageId();
    const b = generateClientMessageId();
    expect(a.length).toBeGreaterThan(5);
    expect(a).not.toBe(b);
  });

  it("appendUserMessageWithTruncate slices history and attaches fileIds metadata", () => {
    const prev: ChatFrontendMessage[] = [
      { id: "1", role: "user", content: "first" },
      { id: "2", role: "assistant", content: "reply" },
    ];
    const next = appendUserMessageWithTruncate(prev, "edited", {
      truncateFromIndex: 1,
      fileIds: ["file-1"],
    });
    expect(next).toEqual([
      { id: "1", role: "user", content: "first", meta: undefined, sources: [], urlContext: [] },
      { role: "user", content: "edited", meta: { fileIds: ["file-1"] } },
    ]);
  });
});
