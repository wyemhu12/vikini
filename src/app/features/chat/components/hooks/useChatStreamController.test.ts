import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
});
