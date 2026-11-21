// src/app/features/chat/components/ChatBubble.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import ChatBubble, { type ChatMessage } from "./ChatBubble";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock next/dynamic
vi.mock("next/dynamic", () => ({
  default: () => {
    return function DynamicComponent() {
      return null;
    };
  },
}));

// Mock useLanguage
vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        me: "ME",
        cancel: "Cancel",
        save: "Save",
        copy: "Copy",
        copied: "Copied",
        edit: "Edit",
        regenerate: "Regenerate",
        delete: "Delete",
        stopSpeaking: "Stop",
        readAloud: "Read aloud",
        thinkingProcess: "Thinking Process",
        thinkingNoResponseContent:
          "Response only contains thinking deliberation without answer content. Please click Regenerate.",
        thinkingNoResponseAlert:
          "The model finished thinking deliberation without producing answer content.",
        thinkingExhaustedNotice:
          "Reasoning process reached token length limit before generating answer content.",
        regenerateWithLowerThinking: "Regenerate with lower thinking",
        aiIsTyping: "AI is typing...",
        describeCopyFailed: "Failed to copy to clipboard",
      };
      return dict[key] || key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

describe("ChatBubble", () => {
  describe("User message rendering", () => {
    const userMsg: ChatMessage = {
      id: "msg-user-1",
      role: "user",
      content: "Hello from the user!",
    };

    it("TC-02: renders user message content without a user avatar", () => {
      render(<ChatBubble message={userMsg} />);

      expect(screen.getByText("Hello from the user!")).toBeInTheDocument();
      expect(screen.queryByText("ME")).toBeNull();
    });

    it("renders edit button for user message", () => {
      const onEdit = vi.fn();
      render(<ChatBubble message={userMsg} onEdit={onEdit} />);

      const editBtn = screen.getByRole("button", { name: /edit/i });
      expect(editBtn).toBeInTheDocument();
    });

    it("TC-02: user bubble uses the raised surface token and no dead classes", () => {
      const { container } = render(<ChatBubble message={userMsg} />);

      const bubbleDiv = container.querySelector(".rounded-2xl");
      expect(bubbleDiv).toBeInTheDocument();
      expect(bubbleDiv).toHaveClass("bg-(--raised)", "px-4", "py-2.5", "text-(--text)");
      expect(bubbleDiv).not.toHaveClass("bg-(--accent)");

      // Verify no dead token classes
      expect(bubbleDiv?.className).not.toContain("bg-(--primary)");
      expect(bubbleDiv?.className).not.toContain("text-(--surface)");
    });
  });

  describe("Assistant message rendering", () => {
    const assistantMsg: ChatMessage = {
      id: "msg-bot-1",
      role: "assistant",
      content: "# Hello World\n\nThis is assistant markdown response.",
      meta: {
        model: "gemini-2.5-pro",
      },
    };

    it("TC-01: shows the resolved model name above an unbubbled assistant message", () => {
      const { container } = render(
        <ChatBubble message={{ ...assistantMsg, meta: { model: "gemini-2.5-flash" } }} />
      );
      expect(screen.getByText("Gemini 3.5 Flash-Lite modelLegacySuffix")).toBeInTheDocument();
      const content = container.querySelector(".rounded-2xl");
      expect(content).not.toHaveClass("bg-(--accent)");
      expect(content).not.toHaveClass("bg-(--raised)");
    });

    it("TC-03: uses the 28px message rhythm", () => {
      const { container } = render(<ChatBubble message={assistantMsg} />);
      const root = container.firstChild as HTMLElement;
      expect(root).toHaveClass("py-3.5");
      expect(root).not.toHaveClass("py-6");
    });

    it("renders assistant markdown display", () => {
      render(<ChatBubble message={assistantMsg} />);

      expect(screen.getByRole("heading", { level: 2, name: "Hello World" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
      expect(screen.getByText("This is assistant markdown response.")).toBeInTheDocument();
    });

    it("renders thinking block when thought is present", () => {
      const msgWithThought: ChatMessage = {
        id: "msg-bot-thought",
        role: "assistant",
        content: "<thought>Analyzing step 1, step 2.</thought>Final answer is here.",
      };

      render(<ChatBubble message={msgWithThought} />);

      // ThinkingBlock button should be present
      const thinkingBtn = screen.getByRole("button", { name: /thinking process/i });
      expect(thinkingBtn).toBeInTheDocument();

      // Content should render the rest
      expect(screen.getByText("Final answer is here.")).toBeInTheDocument();

      // Expanding thinking block shows inner thought
      fireEvent.click(thinkingBtn);
      expect(screen.getByText("Analyzing step 1, step 2.")).toBeInTheDocument();
    });

    it("renders fallback notice when thought is present but display content is empty", () => {
      const msgWithThoughtOnly: ChatMessage = {
        id: "msg-bot-thought-only",
        role: "assistant",
        content: "<thought>Deliberating only...</thought>",
      };

      render(<ChatBubble message={msgWithThoughtOnly} isStreaming={false} />);

      expect(screen.getByRole("button", { name: /thinking process/i })).toBeInTheDocument();
      expect(
        screen.getByText(
          "The model finished thinking deliberation without producing answer content."
        )
      ).toBeInTheDocument();
    });

    it("does not render recovery notice while streaming with thought only", () => {
      const msgWithThoughtOnly: ChatMessage = {
        id: "msg-bot-thought-only",
        role: "assistant",
        content: "<thought>Deliberating only...</thought>",
      };

      render(<ChatBubble message={msgWithThoughtOnly} isStreaming={true} />);

      expect(
        screen.queryByText(
          "The model finished thinking deliberation without producing answer content."
        )
      ).not.toBeInTheDocument();
    });

    it("parses legacy notice and renders recovery card for historical messages", () => {
      const legacyMsg: ChatMessage = {
        id: "msg-legacy",
        role: "assistant",
        content:
          "<thought>Legacy deliberation</thought>\n\n*(Quá trình suy nghĩ đã đạt giới hạn độ dài token trước khi tạo câu trả lời. Bạn có thể thử chuyển mức suy nghĩ sang Trung bình/Thấp hoặc yêu cầu câu trả lời ngắn gọn hơn.)*",
      };

      render(<ChatBubble message={legacyMsg} isStreaming={false} />);

      expect(
        screen.getByText(
          "Reasoning process reached token length limit before generating answer content."
        )
      ).toBeInTheDocument();
    });

    it("renders actions dock for assistant message", () => {
      const onRegenerate = vi.fn();
      const onDelete = vi.fn();
      const onSpeak = vi.fn();

      render(
        <ChatBubble
          message={assistantMsg}
          canRegenerate={true}
          onRegenerate={onRegenerate}
          onDelete={onDelete}
          onSpeak={onSpeak}
        />
      );

      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
      // Delete lives in the "More actions" menu (Phase 3B, H6)
      expect(
        screen.getByRole("button", { name: /messageMoreActions|more actions/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /read aloud/i })).toBeInTheDocument();

      // Edit button must NOT be present on assistant message
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    });

    it("TC-W2B-06: forwards (safeMessage), (safeMessage, level), and (id, content) via internal wrappers without leaking MouseEvent, and hides Read Aloud when message.id is missing", () => {
      const onRegenerate = vi.fn();
      const onRegenerateLowerThinking = vi.fn();
      const onSpeak = vi.fn();

      const { rerender } = render(
        <ChatBubble
          message={assistantMsg}
          canRegenerate={true}
          onRegenerate={onRegenerate}
          onSpeak={onSpeak}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
      expect(onRegenerate).toHaveBeenCalledTimes(1);
      expect(onRegenerate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg-bot-1", role: "assistant" })
      );

      fireEvent.click(screen.getByRole("button", { name: /read aloud/i }));
      expect(onSpeak).toHaveBeenCalledTimes(1);
      expect(onSpeak).toHaveBeenCalledWith("msg-bot-1", assistantMsg.content);

      // EmptyReasoningNotice: regenerate + lower thinking forwards (safeMessage, level)
      const thoughtOnlyMsg: ChatMessage = {
        id: "msg-empty-reason",
        role: "assistant",
        content: "<thought>Reasoning only</thought>",
        meta: { emptyAnswerReason: "length" },
      };
      rerender(
        <ChatBubble
          message={thoughtOnlyMsg}
          isStreaming={false}
          canRegenerate={true}
          lowerThinkingLevel="low"
          onRegenerate={onRegenerate}
          onRegenerateLowerThinking={onRegenerateLowerThinking}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /regenerate with lower thinking/i }));
      expect(onRegenerateLowerThinking).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg-empty-reason" }),
        "low"
      );

      // Unsaved message without id hides Read Aloud button even when onSpeak is provided
      rerender(
        <ChatBubble message={{ role: "assistant", content: "Unsaved reply" }} onSpeak={onSpeak} />
      );
      expect(screen.queryByRole("button", { name: /read aloud/i })).not.toBeInTheDocument();
    });

    it("shows typing dots when isLoading is true", () => {
      const emptyAssistantMsg: ChatMessage = {
        id: "msg-bot-empty",
        role: "assistant",
        content: "",
      };

      render(<ChatBubble message={emptyAssistantMsg} isLastAssistant={true} regenerating={true} />);

      expect(screen.getByRole("status", { name: /ai is typing/i })).toBeInTheDocument();
    });

    it("renders token badge when totalTokenCount is provided", () => {
      const msgWithTokens: ChatMessage = {
        id: "msg-tokens",
        role: "assistant",
        content: "Here is the response with tokens.",
        meta: {
          totalTokenCount: 1520,
          promptTokenCount: 500,
          candidatesTokenCount: 1020,
        },
      };

      render(<ChatBubble message={msgWithTokens} />);
      expect(screen.getByText(/1\.5K/)).toBeInTheDocument();
    });

    it("applies text-(--text) to assistant text container and no dead text-primary", () => {
      const { container } = render(<ChatBubble message={assistantMsg} />);

      const botBubble = container.querySelector(".rounded-2xl");
      expect(botBubble).toBeInTheDocument();
      expect(botBubble).toHaveClass("text-(--text)");
      expect(botBubble?.className.split(" ")).not.toContain("text-primary");
    });
  });

  describe("Edit mode", () => {
    const userMsg: ChatMessage = {
      id: "msg-edit-1",
      role: "user",
      content: "Initial question",
    };

    it("switches to edit mode on edit button click, allows modifying and saving", () => {
      const onEdit = vi.fn();
      render(<ChatBubble message={userMsg} onEdit={onEdit} />);

      // Initially shows user text
      expect(screen.getByText("Initial question")).toBeInTheDocument();

      // Click edit button
      const editBtn = screen.getByRole("button", { name: /edit/i });
      fireEvent.click(editBtn);

      // Textarea should now be visible with initial value
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      expect(textarea.value).toBe("Initial question");

      // Modify textarea
      fireEvent.change(textarea, { target: { value: "Updated question" } });
      expect(textarea.value).toBe("Updated question");

      // Save edit
      const saveBtn = screen.getByRole("button", { name: /save/i });
      fireEvent.click(saveBtn);

      // onEdit called with message and new content
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onEdit).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg-edit-1", content: "Initial question" }),
        "Updated question"
      );

      // Exits edit mode
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("cancels edit mode without saving when cancel button is clicked", () => {
      const onEdit = vi.fn();
      render(<ChatBubble message={userMsg} onEdit={onEdit} />);

      // Click edit
      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "Changed but cancelled" } });

      // Click cancel
      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelBtn);

      expect(onEdit).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.getByText("Initial question")).toBeInTheDocument();
    });

    it("does not trigger onEdit if saved content is unchanged", () => {
      const onEdit = vi.fn();
      render(<ChatBubble message={userMsg} onEdit={onEdit} />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      const saveBtn = screen.getByRole("button", { name: /save/i });
      fireEvent.click(saveBtn);

      expect(onEdit).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("Clipboard copy error handling (TC-P5-05, NP-4)", () => {
    const assistantMsg: ChatMessage = {
      id: "msg-copy-1",
      role: "assistant",
      content: "Copyable response text",
    };

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("copies content cleanly without calling toast.error on success", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      render(<ChatBubble message={assistantMsg} />);
      fireEvent.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("Copyable response text");
      });
      expect(toast.error).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("logs error and displays toast.error when clipboard rejects with Error", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      render(<ChatBubble message={assistantMsg} />);
      fireEvent.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith("Failed to copy to clipboard");
      });
    });

    it("handles non-Error clipboard rejection safely", async () => {
      const writeText = vi.fn().mockRejectedValue("denied");
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      render(<ChatBubble message={assistantMsg} />);
      fireEvent.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith("Failed to copy to clipboard");
      });
    });
  });
});
