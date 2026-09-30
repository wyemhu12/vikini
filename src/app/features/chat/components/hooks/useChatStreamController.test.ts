import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatStreamController } from "./useChatStreamController";

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
});
