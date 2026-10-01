import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ChatMessagesArea } from "./ChatMessagesArea";
import type { FrontendMessage, FrontendConversation } from "../hooks/useConversation";

// Mock ChatBubble to simplify DOM assertions
vi.mock("./ChatBubble", () => ({
  default: ({
    message,
    isStreaming,
    regenerating,
  }: {
    message: FrontendMessage;
    isStreaming?: boolean;
    regenerating?: boolean;
  }) => (
    <div
      data-testid="chat-bubble"
      data-role={message.role}
      data-is-streaming={String(Boolean(isStreaming))}
      data-regenerating={String(Boolean(regenerating))}
      data-model={(message.meta as Record<string, unknown> | undefined)?.model || ""}
    >
      {message.content}
    </div>
  ),
  ChatBubble: ({
    message,
    isStreaming,
    regenerating,
  }: {
    message: FrontendMessage;
    isStreaming?: boolean;
    regenerating?: boolean;
  }) => (
    <div
      data-testid="chat-bubble"
      data-role={message.role}
      data-is-streaming={String(Boolean(isStreaming))}
      data-regenerating={String(Boolean(regenerating))}
      data-model={(message.meta as Record<string, unknown> | undefined)?.model || ""}
    >
      {message.content}
    </div>
  ),
}));

describe("ChatMessagesArea", () => {
  const defaultProps = {
    renderedMessages: [
      { id: "m1", role: "user", content: "Hello world" },
      { id: "m2", role: "assistant", content: "Hi there!" },
    ] as FrontendMessage[],
    currentConversation: {
      id: "conv-1",
      title: "Test Chat",
      model: "deepseek/deepseek-v4.1-flash",
    } as FrontendConversation,
    parentConversation: null,
    contextMessagesCount: 0,
    selectedConversationId: "conv-1",
    currentModel: "deepseek/deepseek-v4.1-flash",
    regenerating: false,
    isStreaming: false,
    streamingAssistant: null,
    branchingMessageId: null,
    handleRegenerate: vi.fn(),
    handleContinue: vi.fn(),
    retrySave: vi.fn(),
    handleEdit: vi.fn(),
    openDeleteMessageModal: vi.fn(),
    handleImageRegenerate: vi.fn(),
    handleImageEdit: vi.fn(),
    handleBranchMessage: vi.fn(),
    setSelectedConversationIdAndUrl: vi.fn(),
    tts: {
      speakMessage: vi.fn(),
      isMessageSpeaking: vi.fn().mockReturnValue(false),
    },
    tRaw: (key: string) => key,
  };

  it("renders messages list properly", () => {
    render(<ChatMessagesArea {...defaultProps} />);

    const bubbles = screen.getAllByTestId("chat-bubble");
    expect(bubbles.length).toBe(2);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("renders origin breadcrumb when conversation has parentConversationId", () => {
    const props = {
      ...defaultProps,
      currentConversation: {
        id: "conv-2",
        title: "Branched Chat",
        parentConversationId: "conv-1",
        model: "deepseek/deepseek-v4.1-flash",
      } as FrontendConversation,
      parentConversation: {
        id: "conv-1",
        title: "Parent Chat",
      } as FrontendConversation,
    };

    render(<ChatMessagesArea {...props} />);

    expect(screen.getByText("Parent Chat")).toBeInTheDocument();
  });

  it("renders context messages notice when contextMessagesCount > 0", () => {
    const props = {
      ...defaultProps,
      contextMessagesCount: 3,
    };

    render(<ChatMessagesArea {...props} />);

    expect(screen.getByText("priorContextForAi")).toBeInTheDocument();
  });

  it("renders active streaming bubble when isStreaming is true and streamingAssistant is present", () => {
    const props = {
      ...defaultProps,
      isStreaming: true,
      streamingAssistant: "Streaming chunk...",
    };

    render(<ChatMessagesArea {...props} />);

    const bubbles = screen.getAllByTestId("chat-bubble");
    expect(bubbles.length).toBe(3);
    expect(screen.getByText("Streaming chunk...")).toBeInTheDocument();

    // Stream bubble receives isStreaming=true and meta.model
    const streamBubble = bubbles[2];
    expect(streamBubble.getAttribute("data-is-streaming")).toBe("true");
    expect(streamBubble.getAttribute("data-model")).toBe("deepseek/deepseek-v4.1-flash");

    // Historical assistant bubble receives isStreaming=false and regenerating=false
    const historicalBubble = bubbles[1];
    expect(historicalBubble.getAttribute("data-is-streaming")).toBe("false");
    expect(historicalBubble.getAttribute("data-regenerating")).toBe("false");
  });
});
