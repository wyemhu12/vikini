import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  appendUserMessageWithTruncate,
  countContextOnlyMessages,
  parseSSEEvent,
  splitSSEFrames,
  findMessageIndex,
  normalizeFrontendMessages,
  readStoredThinkingLevel,
  buildChatStreamPayload,
  extractStreamHttpError,
  generateClientMessageId,
  requestChatStream,
  resetStreamExecutionRefs,
  type ChatFrontendMessage,
  type StreamExecutionRefs,
} from "./streamProtocol";

describe("streamProtocol (CT-6C-01)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
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

  it("TC-W2B-04: splitSSEFrames and parseSSEEvent support CRLF (\\r\\n\\r\\n), multi-line data, and trailing fragments", () => {
    const raw =
      'event: token\r\ndata: {"t":"Xin "}\r\n\r\nevent: token\r\ndata: {"t":\r\ndata: "chào"}\r\n\r\nevent: done\r\ndata: {"ok":true}';
    const { frames, remainder } = splitSSEFrames(raw);
    expect(frames).toHaveLength(2);
    expect(parseSSEEvent(frames[0])).toEqual({ event: "token", data: { t: "Xin " } });
    expect(parseSSEEvent(frames[1])).toEqual({ event: "token", data: { t: "chào" } });
    expect(parseSSEEvent(remainder)).toEqual({ event: "done", data: { ok: true } });
  });

  it("TC-W2B-05: countContextOnlyMessages counts hidden context messages from raw API payload", () => {
    const raw: ChatFrontendMessage[] = [
      { id: "1", role: "user", content: "Ctx 1", meta: { isContextOnly: true } },
      { id: "2", role: "assistant", content: "Ctx 2", meta: { isContextOnly: true } },
      { id: "3", role: "user", content: "Visible 1" },
      { id: "4", role: "assistant", content: "Visible 2" },
    ];
    expect(countContextOnlyMessages(raw)).toBe(2);
    expect(normalizeFrontendMessages(raw)).toHaveLength(2);
    expect(countContextOnlyMessages(null)).toBe(0);
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

  it("TC-HF-01 & NP-2: resetStreamExecutionRefs aborts previous controller and resets all dirty refs", () => {
    const prevAc = new AbortController();
    const refs: StreamExecutionRefs = {
      abortControllerRef: { current: prevAc },
      currentClientMessageIdRef: { current: "old-id" },
      currentTruncateClientMessageIdRef: { current: "old-trunc" },
      localSourcesRef: { current: [{ a: 1 }] },
      localRagSourcesRef: { current: [{ b: 2 }] },
      localUrlContextRef: { current: [{ c: 3 }] },
      hasStreamErrorRef: { current: true },
      lastStreamErrorRef: { current: { message: "boom", status: 500 } },
      accumulatedAssistantRef: { current: "old text" },
      accumulatedThinkingRef: { current: "old think" },
      emptyAnswerReasonRef: { current: "length" },
    };

    const signal = resetStreamExecutionRefs(refs, "trunc-1");

    expect(prevAc.signal.aborted).toBe(true);
    expect(refs.abortControllerRef.current).not.toBe(prevAc);
    expect(refs.abortControllerRef.current).not.toBeNull();
    expect(signal).toBe(refs.abortControllerRef.current?.signal);
    expect(signal.aborted).toBe(false);
    expect(refs.currentClientMessageIdRef.current).toBeTruthy();
    expect(refs.currentClientMessageIdRef.current).not.toBe("old-id");
    expect(refs.currentTruncateClientMessageIdRef.current).toBe("trunc-1");
    expect(refs.localSourcesRef.current).toEqual([]);
    expect(refs.localRagSourcesRef.current).toEqual([]);
    expect(refs.localUrlContextRef.current).toEqual([]);
    expect(refs.hasStreamErrorRef.current).toBe(false);
    expect(refs.lastStreamErrorRef.current).toBeNull();
    expect(refs.accumulatedAssistantRef.current).toBe("");
    expect(refs.accumulatedThinkingRef.current).toBe("");
    expect(refs.emptyAnswerReasonRef.current).toBeNull();
  });

  it("TC-HF-02: resetStreamExecutionRefs handles null controller and normalizes empty truncate id to null", () => {
    const makeEmptyRefs = (): StreamExecutionRefs => ({
      abortControllerRef: { current: null },
      currentClientMessageIdRef: { current: null },
      currentTruncateClientMessageIdRef: { current: "prev" },
      localSourcesRef: { current: [] },
      localRagSourcesRef: { current: [] },
      localUrlContextRef: { current: [] },
      hasStreamErrorRef: { current: false },
      lastStreamErrorRef: { current: null },
      accumulatedAssistantRef: { current: "" },
      accumulatedThinkingRef: { current: "" },
      emptyAnswerReasonRef: { current: null },
    });

    const refsUndef = makeEmptyRefs();
    resetStreamExecutionRefs(refsUndef, undefined);
    expect(refsUndef.currentTruncateClientMessageIdRef.current).toBeNull();

    const refsEmpty = makeEmptyRefs();
    resetStreamExecutionRefs(refsEmpty, "");
    expect(refsEmpty.currentTruncateClientMessageIdRef.current).toBeNull();
  });

  it("TC-HF-03: requestChatStream sends sanitized JSON payload without signal and returns stream reader", async () => {
    const mockReader = { read: vi.fn() } as unknown as ReadableStreamDefaultReader<Uint8Array>;
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    });
    vi.stubGlobal("fetch", fetchMock);

    const ac = new AbortController();
    const res = await requestChatStream({
      conversationId: "conv-1",
      content: "Hello",
      clientMessageId: "cm-1",
      regenerate: false,
      thinkingLevel: "high",
      strataSampling: { mode: "creative" },
      fileIds: ["f1"],
      signal: ac.signal,
    });

    expect(res).toEqual({ ok: true, reader: mockReader });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat-stream",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: ac.signal,
      })
    );
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<
      string,
      unknown
    >;
    expect(sentBody).not.toHaveProperty("signal");
    expect(sentBody.fileIds).toEqual(["f1"]);
    expect(sentBody.strataSampling).toEqual({ mode: "creative" });
  });

  it("TC-HF-04 & NP-1: requestChatStream handles HTTP 429, null body, and propagates AbortError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Rate limited", code: "RATE_LIMIT" } }), {
          status: 429,
        })
      )
    );
    const rateLimited = await requestChatStream({
      conversationId: "c1",
      content: "hi",
      clientMessageId: "cm-1",
      regenerate: false,
      thinkingLevel: "off",
      signal: new AbortController().signal,
    });
    expect(rateLimited).toEqual({
      ok: false,
      error: { message: "Rate limited", code: "RATE_LIMIT", status: 429 },
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 })));
    const nullBody = await requestChatStream({
      conversationId: "c1",
      content: "hi",
      clientMessageId: "cm-2",
      regenerate: false,
      thinkingLevel: "off",
      signal: new AbortController().signal,
    });
    expect(nullBody).toEqual({
      ok: false,
      error: { message: "Stream failed", code: undefined, status: 200 },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new DOMException("Aborted", "AbortError"))
    );
    await expect(
      requestChatStream({
        conversationId: "c1",
        content: "hi",
        clientMessageId: "cm-3",
        regenerate: false,
        thinkingLevel: "off",
        signal: new AbortController().signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
