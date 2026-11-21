import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatStreamController } from "./useChatStreamController";
import { toast } from "@/lib/store/toastStore";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useChatStreamController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default empty state", () => {
    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingAssistant).toBeNull();
  });

  it("cancelStream(true) creates partial message with temp- id and triggers POST /api/messages", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          message: {
            id: "real-saved-id",
            role: "assistant",
            content: "Partial response...",
            meta: { isPartial: true, aborted: true },
          },
          alreadyComplete: false,
        },
      }),
    });

    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    // Simulate sending message to start stream
    let streamBody = "";
    mockFetch.mockImplementationOnce((url, options) => {
      streamBody = options?.body as string;
      return Promise.resolve({
        ok: true,
        body: {
          getReader: () => {
            let done = false;
            return {
              read: () => {
                if (!done) {
                  done = true;
                  const encoder = new TextEncoder();
                  return Promise.resolve({
                    done: false,
                    value: encoder.encode('event: token\ndata: {"t":"Partial response..."}\n\n'),
                  });
                }
                return new Promise(() => {}); // hold open
              },
            };
          },
        },
      });
    });

    await act(async () => {
      result.current.handleSend("Hello");
    });

    // Verify stream was initiated with clientMessageId
    expect(streamBody).toContain("clientMessageId");

    // Cancel stream with commitPartial = true (equivalent to handleStop)
    await act(async () => {
      result.current.handleStop();
    });

    // Check that partial message is stored in local messages
    const msgs = result.current.messages;
    const partialMsg = msgs.find((m) => m.role === "assistant");
    expect(partialMsg).toBeDefined();
    expect(partialMsg?.content).toBe("Partial response...");
    expect((partialMsg?.meta as Record<string, unknown>)?.isPartial).toBe(true);
    expect((partialMsg?.meta as Record<string, unknown>)?.aborted).toBe(true);

    // Verify POST /api/messages was called to sync the partial message
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/messages",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Partial response..."),
      })
    );
  });

  it("cancelStream(false) cancels stream without committing partial message", async () => {
    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: () => new Promise(() => {}), // hold open
          }),
        },
      })
    );

    await act(async () => {
      result.current.handleSend("Hello");
    });

    // Reset chat UI calls cancelStream(false)
    await act(async () => {
      result.current.resetChatUI();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
  });

  it("flushes typewriter buffer and finalizes assistant message on complete stream (done/flush)", async () => {
    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    const encoder = new TextEncoder();
    let step = 0;
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/chat")) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (step === 0) {
                  step++;
                  return Promise.resolve({
                    done: false,
                    value: encoder.encode('event: token\ndata: {"t":"Complete answer"}\n\n'),
                  });
                }
                return Promise.resolve({ done: true, value: undefined });
              },
              cancel: () => Promise.resolve(),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { messages: [] } }),
      });
    });

    await act(async () => {
      await result.current.handleSend("Test prompt");
    });

    await waitFor(() => {
      const msgs = result.current.messages;
      const assistantMsg = msgs.find((m) => m.role === "assistant");
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.content).toBe("Complete answer");
      expect(result.current.isStreaming).toBe(false);
    });
  });

  it("handles typewriter token streaming and buffers chunks smoothly", async () => {
    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    const encoder = new TextEncoder();
    let emitted = false;

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/chat")) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (!emitted) {
                  emitted = true;
                  return Promise.resolve({
                    done: false,
                    value: encoder.encode('event: token\ndata: {"t":"Smooth typing"}\n\n'),
                  });
                }
                return new Promise(() => {}); // hold until cancel
              },
              cancel: () => Promise.resolve(),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { messages: [] } }),
      });
    });

    await act(async () => {
      result.current.handleSend("Start stream");
    });

    expect(result.current.isStreaming).toBe(true);

    // Clean up active stream to prevent leaks
    await act(async () => {
      result.current.resetChatUI();
    });
  });

  it("handles backend error event and populates streamError state (error rollback)", async () => {
    const onStreamError = vi.fn();
    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
        onStreamError,
      })
    );

    const encoder = new TextEncoder();
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/chat")) {
        let sent = false;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (!sent) {
                  sent = true;
                  return Promise.resolve({
                    done: false,
                    value: encoder.encode(
                      'event: error\ndata: {"error":"Rate limit exceeded","code":"RATE_LIMIT"}\n\n'
                    ),
                  });
                }
                return Promise.resolve({ done: true, value: undefined });
              },
              cancel: () => Promise.resolve(),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { messages: [] } }),
      });
    });

    await act(async () => {
      await result.current.handleSend("Trigger error");
    });

    await waitFor(() => {
      expect(onStreamError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Rate limit exceeded",
          code: "RATE_LIMIT",
        })
      );
    });
  });

  it("balances think tags when aborting partial message (abort partial persistence)", async () => {
    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    const encoder = new TextEncoder();
    let sent = false;
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/chat")) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (!sent) {
                  sent = true;
                  return Promise.resolve({
                    done: false,
                    value: encoder.encode(
                      'event: token\ndata: {"t":"<think>Internal thought"}\n\n'
                    ),
                  });
                }
                return new Promise(() => {}); // hold until stop
              },
              cancel: () => Promise.resolve(),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { message: { id: "p-1" } } }),
      });
    });

    await act(async () => {
      result.current.handleSend("Think test");
    });

    await act(async () => {
      result.current.handleStop();
    });

    const msgs = result.current.messages;
    const assistantMsg = msgs.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    // Think tags should be balanced automatically
    expect(assistantMsg?.content).toContain("</think>");
  });

  it("handles thinking event and ragSources meta event during stream", async () => {
    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    const encoder = new TextEncoder();
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/chat")) {
        const streamData = [
          'event: meta\ndata: {"type":"ragSources","sources":[{"filename":"doc1.pdf","similarity":0.85}]}\n\n',
          'event: thinking\ndata: {"thinking":"Suy nghĩ bước 1..."}\n\n',
          'event: token\ndata: {"t":"Xin chào"}\n\n',
        ];
        let idx = 0;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (idx < streamData.length) {
                  const chunk = streamData[idx++];
                  return Promise.resolve({
                    done: false,
                    value: encoder.encode(chunk),
                  });
                }
                return Promise.resolve({ done: true, value: undefined });
              },
              cancel: () => Promise.resolve(),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { message: { id: "p-2" } } }),
      });
    });

    await act(async () => {
      await result.current.handleSend("Test thinking stream");
    });

    await waitFor(() => {
      const msgs = result.current.messages;
      const assistantMsg = msgs.find((m) => m.role === "assistant");
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.content).toContain("Xin chào");
      const meta = assistantMsg?.meta as Record<string, unknown> | undefined;
      expect(meta?.reasoning).toBe("Suy nghĩ bước 1...");
      expect(meta?.ragSources).toEqual([{ filename: "doc1.pdf", similarity: 0.85 }]);
    });
  });

  it("TC-W4-05: fires toast.error when loading conversation history fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "DB unavailable" }),
    });

    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: null,
      })
    );

    await act(async () => {
      await result.current.handleSelectConversation("conv-err");
    });

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toEqual([]);
  });

  it("CT-6C-01 (#10): aborts active fetch and skips partial persistence/finalize when unmounted mid-stream", async () => {
    let capturedSignal: AbortSignal | undefined;
    const encoder = new TextEncoder();
    let chunkSent = false;

    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/api/chat-stream")) {
        capturedSignal = init?.signal ?? undefined;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (!chunkSent) {
                  chunkSent = true;
                  return Promise.resolve({
                    done: false,
                    value: encoder.encode('event: token\ndata: {"t":"Partial chunk"}\n\n'),
                  });
                }
                // Resolve cleanly right after unmount to also exercise the 30ms post-stream guard
                return new Promise<{ done: boolean; value?: Uint8Array }>((resolve) => {
                  capturedSignal?.addEventListener("abort", () =>
                    resolve({ done: true, value: undefined })
                  );
                });
              },
              cancel: () => Promise.resolve(),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });
    });

    const { result, unmount } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-unmount",
      })
    );

    await act(async () => {
      result.current.handleSend("Hello before unmount");
    });

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
    // Allow 30ms post-stream timer to flush; isUnmountedRef must block POST /api/messages
    await new Promise((r) => setTimeout(r, 60));

    const postMessageCalls = mockFetch.mock.calls.filter(
      ([url, init]) =>
        typeof url === "string" && url.includes("/api/messages") && init?.method === "POST"
    );
    expect(postMessageCalls).toHaveLength(0);
  });

  it("TC-W2B-01: avoids double-fetch on conversation selection and aborts stale slow loads without clobbering newer conversation or showing false error toasts", async () => {
    let resolveConvA!: (val: unknown) => void;
    let signalA: AbortSignal | undefined;

    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("conv-A")) {
        signalA = init?.signal ?? undefined;
        return new Promise((resolve) => {
          resolveConvA = resolve;
        });
      }
      if (url.includes("conv-B")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              messages: [
                { id: "c1", role: "user", content: "Ctx", meta: { isContextOnly: true } },
                { id: "b1", role: "user", content: "Message from B" },
              ],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: { messages: [] } }) });
    });

    let selectedId: string | null = null;
    const { result, rerender } = renderHook(
      ({ id }) =>
        useChatStreamController({
          isAuthed: true,
          selectedConversationId: id,
          setSelectedConversationId: (next) => {
            selectedId = next;
          },
        }),
      { initialProps: { id: null as string | null } }
    );

    // Start slow load for Conv A, then immediately switch to Conv B
    let loadAPromise!: Promise<void>;
    await act(async () => {
      loadAPromise = result.current.handleSelectConversation("conv-A");
      rerender({ id: selectedId });
    });

    await act(async () => {
      await result.current.handleSelectConversation("conv-B");
      rerender({ id: selectedId });
    });

    // Request A must have been aborted
    expect(signalA?.aborted).toBe(true);

    // Late resolution of A must NOT overwrite B's messages
    await act(async () => {
      resolveConvA({
        ok: true,
        json: async () => ({
          data: { messages: [{ id: "a1", role: "user", content: "Stale A" }] },
        }),
      });
      await loadAPromise;
    });

    expect(result.current.renderedMessages).toHaveLength(1);
    expect(result.current.renderedMessages[0].content).toBe("Message from B");
    expect(result.current.contextMessagesCount).toBe(1);
    expect(toast.error).not.toHaveBeenCalled();

    // Selecting Conv B must have fetched conv-B exactly ONCE (no double-fetch from auto-load effect)
    const convBFetches = mockFetch.mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("conv-B")
    );
    expect(convBFetches).toHaveLength(1);
  });

  it("TC-W2B-02 / NP-4: protects overlapping streams in finally, preserves input when createConversation fails/returns null, and prevents New Chat hijack on switch", async () => {
    // (a) Overlapping streams: stream 1 finally must NOT reset stream 2's isStreaming
    let rejectStream1!: (err: unknown) => void;
    let stream2ReadCount = 0;
    let callIdx = 0;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/chat-stream")) {
        callIdx += 1;
        if (callIdx === 1) {
          return new Promise((_resolve, reject) => {
            rejectStream1 = reject;
          });
        }
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                stream2ReadCount += 1;
                if (stream2ReadCount === 1) {
                  return Promise.resolve({
                    done: false,
                    value: new TextEncoder().encode('event: token\ndata: {"t":"Stream 2"}\n\n'),
                  });
                }
                return new Promise(() => {});
              },
            }),
          },
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: { messages: [] } }) });
    });

    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-1",
      })
    );

    await act(async () => {
      result.current.handleSend("Prompt 1");
    });
    await act(async () => {
      result.current.handleSend("Prompt 2");
    });
    await act(async () => {
      rejectStream1(new DOMException("Aborted", "AbortError"));
      await Promise.resolve();
    });
    expect(result.current.isStreaming).toBe(true);
    await act(async () => {
      result.current.resetChatUI();
    });

    // (b) New Chat: createConversation returns null -> keeps input intact and resets isStreaming=false
    const createNullMock = vi.fn().mockResolvedValue(null);
    const { result: nullResult } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: null,
        createConversation: createNullMock,
      })
    );

    await act(async () => {
      nullResult.current.setInput("Keep my draft");
    });
    await act(async () => {
      await nullResult.current.handleSend("Keep my draft");
    });
    expect(nullResult.current.isStreaming).toBe(false);
    expect(nullResult.current.input).toBe("Keep my draft");
    expect(nullResult.current.messages).toHaveLength(0);

    // (c) New Chat: user switches to Conv A while createConversation() is pending -> late conv-new must NOT hijack
    let resolveNewConv!: (val: { id: string } | null) => void;
    const setSelectedMock = vi.fn();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { messages: [{ id: "a1", role: "user", content: "Conv A" }] } }),
    });

    const { result: hijackResult } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: null,
        setSelectedConversationId: setSelectedMock,
        createConversation: () =>
          new Promise((resolve) => {
            resolveNewConv = resolve;
          }),
      })
    );

    await act(async () => {
      hijackResult.current.setInput("New chat draft");
    });
    await act(async () => {
      hijackResult.current.handleSend("New chat draft");
    });
    await act(async () => {
      await hijackResult.current.handleSelectConversation("conv-A");
    });
    await act(async () => {
      resolveNewConv({ id: "conv-new" });
      await Promise.resolve();
    });

    expect(setSelectedMock).not.toHaveBeenCalledWith("conv-new");
    const streamCalls = mockFetch.mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("/api/chat-stream")
    );
    expect(streamCalls).toHaveLength(0);
  });

  it("TC-W2B-03, TC-W2B-04 & TC-W2B-05: surfaces network error before first token, serializes cancelStream(true), flushes CRLF/UTF-8 trailing SSE frame, and forwards finalTitle", async () => {
    // 1. Network error before first token -> sets streamError(NETWORK_ERROR) + onStreamError + toast.error
    const onStreamError = vi.fn();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/chat-stream")) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: { messages: [] } }) });
    });
    const { result: netErrResult } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-net",
        onStreamError,
      })
    );

    await act(async () => {
      await netErrResult.current.handleSend("Hello network");
    });
    expect(netErrResult.current.streamError).toMatchObject({ code: "NETWORK_ERROR" });
    expect(onStreamError).toHaveBeenCalledWith(expect.objectContaining({ code: "NETWORK_ERROR" }));
    expect(toast.error).toHaveBeenCalled();

    // 2. cancelStream(true) serializes POST /api/messages BEFORE GET /api/conversations
    const callOrder: string[] = [];
    let resolveSync!: (val: unknown) => void;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/chat-stream")) {
        let emitted = false;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (!emitted) {
                  emitted = true;
                  return Promise.resolve({
                    done: false,
                    value: new TextEncoder().encode('event: token\ndata: {"t":"Stop me"}\n\n'),
                  });
                }
                return new Promise(() => {});
              },
            }),
          },
        });
      }
      if (url.includes("/api/messages") && init?.method === "POST") {
        callOrder.push("POST /api/messages:start");
        return new Promise((resolve) => {
          resolveSync = resolve;
        });
      }
      if (url.includes("/api/conversations?id=")) {
        callOrder.push("GET /api/conversations");
        return Promise.resolve({ ok: true, json: async () => ({ data: { messages: [] } }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { result: stopResult } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-stop",
      })
    );
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    callOrder.length = 0;

    await act(async () => {
      stopResult.current.handleSend("Start");
    });
    await act(async () => {
      stopResult.current.handleStop();
    });
    // GET /api/conversations must NOT have fired while POST /api/messages is still pending
    expect(callOrder).toEqual(["POST /api/messages:start"]);

    await act(async () => {
      resolveSync({
        ok: true,
        json: async () => ({ data: { message: { id: "saved-1" } } }),
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(callOrder).toEqual(["POST /api/messages:start", "GET /api/conversations"]);
    });

    // 3. CRLF + split UTF-8 bytes + trailing frame without \n\n + finalTitle meta
    const renameFinal = vi.fn();
    const fullBytes = new TextEncoder().encode(
      'event: token\r\ndata: {"t":"Tiếng Việt"}\r\n\r\nevent: meta\r\ndata: {"type":"finalTitle","conversationId":"conv-utf8","title":"Chủ đề mới"}'
    );
    // Split mid-UTF-8 character ("ế" starts around byte 26)
    const chunk1 = fullBytes.slice(0, 27);
    const chunk2 = fullBytes.slice(27);
    let idx = 0;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/chat-stream")) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (idx === 0) {
                  idx += 1;
                  return Promise.resolve({ done: false, value: chunk1 });
                }
                if (idx === 1) {
                  idx += 1;
                  return Promise.resolve({ done: false, value: chunk2 });
                }
                return Promise.resolve({ done: true, value: undefined });
              },
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            messages: [
              { id: "ctx-1", role: "user", content: "Hidden", meta: { isContextOnly: true } },
              { id: "ctx-2", role: "assistant", content: "Hidden", meta: { isContextOnly: true } },
              { id: "u-1", role: "user", content: "Hi" },
              { id: "a-1", role: "assistant", content: "Tiếng Việt" },
            ],
          },
        }),
      });
    });

    const { result: utf8Result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-utf8",
        renameConversationFinal: renameFinal,
      })
    );

    await act(async () => {
      await utf8Result.current.handleSend("Hi");
    });

    await waitFor(() => {
      expect(renameFinal).toHaveBeenCalledWith("conv-utf8", "Chủ đề mới");
      expect(utf8Result.current.renderedMessages).toHaveLength(2);
      expect(utf8Result.current.contextMessagesCount).toBe(2);
    });
  });

  it("TC-SU-03: tracks streamingActivity across codeExecutionStatus and clears thinkingStats.live after interleaved thinking", async () => {
    const encoder = new TextEncoder();
    const queue: Array<string | null> = [];
    let pendingResolve: ((res: { done: boolean; value?: Uint8Array }) => void) | null = null;

    const pushFrame = (frame: string | null) => {
      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        if (frame === null) resolve({ done: true });
        else resolve({ done: false, value: encoder.encode(frame) });
      } else {
        queue.push(frame);
      }
    };

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/chat")) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: () => {
                if (queue.length > 0) {
                  const next = queue.shift()!;
                  return Promise.resolve(
                    next === null ? { done: true } : { done: false, value: encoder.encode(next) }
                  );
                }
                return new Promise<{ done: boolean; value?: Uint8Array }>((resolve) => {
                  pendingResolve = resolve;
                });
              },
              cancel: () => Promise.resolve(),
            }),
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { messages: [] } }),
      });
    });

    const { result } = renderHook(() =>
      useChatStreamController({
        isAuthed: true,
        selectedConversationId: "conv-activity",
      })
    );

    await act(async () => {
      result.current.handleSend("Draw room diagram");
    });

    await waitFor(() => expect(result.current.streamingActivity?.phase).toBe("connecting"));

    await act(async () => {
      pushFrame('event: thinking\ndata: {"thinking":"First plan"}\n\n');
    });
    await waitFor(() => {
      expect(result.current.streamingActivity?.phase).toBe("thinking");
      expect(result.current.streamingThinkingStats?.live).toBe(true);
    });

    await act(async () => {
      pushFrame('event: token\ndata: {"t":"Intro"}\n\n');
    });
    await waitFor(() => {
      expect(result.current.streamingActivity?.phase).toBe("responding");
      expect(result.current.streamingThinkingStats?.live).toBe(false);
    });

    await act(async () => {
      pushFrame(
        'event: meta\ndata: {"type":"codeExecutionStatus","status":"writing","chars":420}\n\n'
      );
    });
    await waitFor(() => {
      expect(result.current.streamingActivity?.phase).toBe("code_writing");
      expect(result.current.streamingActivity?.chars).toBe(420);
    });

    await act(async () => {
      pushFrame('event: meta\ndata: {"type":"codeExecutionStatus","status":"running"}\n\n');
    });
    await waitFor(() => expect(result.current.streamingActivity?.phase).toBe("code_running"));

    await act(async () => {
      pushFrame('event: meta\ndata: {"type":"codeExecutionStatus","status":"done"}\n\n');
    });
    await waitFor(() => expect(result.current.streamingActivity?.phase).toBe("responding"));

    // Interleaved thinking round 2 -> live turns true again, then post-tool token MUST turn live back to false!
    await act(async () => {
      pushFrame('event: thinking\ndata: {"thinking":"Reviewing result"}\n\n');
    });
    await waitFor(() => {
      expect(result.current.streamingActivity?.phase).toBe("thinking");
      expect(result.current.streamingThinkingStats?.live).toBe(true);
    });

    await act(async () => {
      pushFrame('event: token\ndata: {"t":" Final"}\n\n');
    });
    await waitFor(() => {
      expect(result.current.streamingActivity?.phase).toBe("responding");
      expect(result.current.streamingThinkingStats?.live).toBe(false);
    });

    await act(async () => {
      pushFrame('event: done\ndata: {"ok":true}\n\n');
      pushFrame(null);
    });
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.streamingActivity).toBeNull();
    });
  });
});
