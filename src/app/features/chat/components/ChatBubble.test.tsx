// src/app/features/chat/components/ChatBubble.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatBubble, { type ChatMessage } from "./ChatBubble";

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

    it("renders user message content and avatar", () => {
      render(<ChatBubble message={userMsg} />);

      expect(screen.getByText("Hello from the user!")).toBeInTheDocument();
      expect(screen.getByText("ME")).toBeInTheDocument();
    });

    it("renders edit button for user message", () => {
      const onEdit = vi.fn();
      render(<ChatBubble message={userMsg} onEdit={onEdit} />);

      const editBtn = screen.getByRole("button", { name: /edit/i });
      expect(editBtn).toBeInTheDocument();
    });

    it("applies accent design tokens to user bubble and no dead classes", () => {
      const { container } = render(<ChatBubble message={userMsg} />);

      const bubbleDiv = container.querySelector(".rounded-2xl");
      expect(bubbleDiv).toBeInTheDocument();
      expect(bubbleDiv).toHaveClass(
        "bg-(--accent)",
        "px-4",
        "py-2.5",
        "text-(--accent-foreground)",
        "shadow-lg"
      );

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

    it("renders assistant markdown display", () => {
      render(<ChatBubble message={assistantMsg} />);

      expect(screen.getByRole("heading", { level: 1, name: "Hello World" })).toBeInTheDocument();
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
          "Response only contains thinking deliberation without answer content. Please click Regenerate."
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
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /read aloud/i })).toBeInTheDocument();

      // Edit button must NOT be present on assistant message
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
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

    it("applies text-(--text-primary) to assistant text container and no dead text-primary", () => {
      const { container } = render(<ChatBubble message={assistantMsg} />);

      const botBubble = container.querySelector(".rounded-2xl");
      expect(botBubble).toBeInTheDocument();
      expect(botBubble).toHaveClass("text-(--text-primary)");
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
});
