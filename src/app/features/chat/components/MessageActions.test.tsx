// src/app/features/chat/components/MessageActions.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MessageActions from "./MessageActions";

// Mock useLanguage hook
vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        copy: "Copy",
        copied: "Copied",
        edit: "Edit",
        regenerate: "Regenerate",
        delete: "Delete",
        stopSpeaking: "Stop",
        readAloud: "Read aloud",
      };
      return dict[key] || key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

describe("MessageActions", () => {
  describe("Copy button", () => {
    it("renders copy button for bot message and triggers onCopy when clicked", () => {
      const onCopy = vi.fn();
      render(<MessageActions isBot={true} copied={false} onCopy={onCopy} />);

      const copyBtn = screen.getByRole("button", { name: /copy/i });
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn).toHaveAttribute("title", "Copy");
      fireEvent.click(copyBtn);
      expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it("displays copied state when copied is true", () => {
      render(<MessageActions isBot={true} copied={true} onCopy={vi.fn()} />);

      const copiedBtn = screen.getByRole("button", { name: /copied/i });
      expect(copiedBtn).toBeInTheDocument();
      expect(copiedBtn).toHaveAttribute("title", "Copied");
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });

  describe("Edit button", () => {
    it("renders and triggers onEdit for user message", () => {
      const onEdit = vi.fn();
      render(<MessageActions isBot={false} copied={false} onCopy={vi.fn()} onEdit={onEdit} />);

      const editBtn = screen.getByRole("button", { name: /edit/i });
      expect(editBtn).toBeInTheDocument();
      expect(editBtn).toHaveAttribute("title", "Edit");
      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("does not render edit button for bot message", () => {
      render(<MessageActions isBot={true} copied={false} onCopy={vi.fn()} onEdit={vi.fn()} />);

      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    });

    it("does not render edit button when onEdit is not provided", () => {
      render(<MessageActions isBot={false} copied={false} onCopy={vi.fn()} />);

      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe("Regenerate button", () => {
    it("renders regenerate button for assistant message when canRegenerate is true", () => {
      const onRegenerate = vi.fn();
      render(
        <MessageActions
          isBot={true}
          copied={false}
          canRegenerate={true}
          onCopy={vi.fn()}
          onRegenerate={onRegenerate}
        />
      );

      const regenBtn = screen.getByRole("button", { name: /regenerate/i });
      expect(regenBtn).toBeInTheDocument();
      expect(regenBtn).toHaveAttribute("title", "Regenerate");
      fireEvent.click(regenBtn);
      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });

    it("does not render regenerate button for user message", () => {
      render(
        <MessageActions
          isBot={false}
          copied={false}
          canRegenerate={true}
          onCopy={vi.fn()}
          onRegenerate={vi.fn()}
        />
      );

      expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
    });

    it("does not render regenerate button when canRegenerate is falsy", () => {
      render(
        <MessageActions
          isBot={true}
          copied={false}
          canRegenerate={false}
          onCopy={vi.fn()}
          onRegenerate={vi.fn()}
        />
      );

      expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
    });

    it("disables regenerate button when regenerating is true", () => {
      render(
        <MessageActions
          isBot={true}
          copied={false}
          canRegenerate={true}
          regenerating={true}
          onCopy={vi.fn()}
          onRegenerate={vi.fn()}
        />
      );

      const regenBtn = screen.getByRole("button", { name: /regenerate/i });
      expect(regenBtn).toBeDisabled();
    });
  });

  describe("TTS Speak button", () => {
    it("renders TTS button for bot message and triggers onSpeak when clicked", () => {
      const onSpeak = vi.fn();
      render(<MessageActions isBot={true} copied={false} onCopy={vi.fn()} onSpeak={onSpeak} />);

      const speakBtn = screen.getByRole("button", { name: /read aloud/i });
      expect(speakBtn).toBeInTheDocument();
      expect(speakBtn).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(speakBtn);
      expect(onSpeak).toHaveBeenCalledTimes(1);
    });

    it("shows active speaking state when isSpeaking is true", () => {
      render(
        <MessageActions
          isBot={true}
          copied={false}
          isSpeaking={true}
          onCopy={vi.fn()}
          onSpeak={vi.fn()}
        />
      );

      const speakBtn = screen.getByRole("button", { name: /stop/i });
      expect(speakBtn).toBeInTheDocument();
      expect(speakBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("does not render TTS button for user message", () => {
      render(<MessageActions isBot={false} copied={false} onCopy={vi.fn()} onSpeak={vi.fn()} />);

      expect(screen.queryByRole("button", { name: /read aloud|stop/i })).not.toBeInTheDocument();
    });
  });

  describe("Delete button", () => {
    it("renders delete button and triggers onDelete with messageId", () => {
      const onDelete = vi.fn();
      render(
        <MessageActions
          isBot={true}
          messageId="msg-123"
          copied={false}
          onCopy={vi.fn()}
          onDelete={onDelete}
        />
      );

      const deleteBtn = screen.getByRole("button", { name: /delete/i });
      expect(deleteBtn).toBeInTheDocument();
      expect(deleteBtn).toHaveAttribute("title", "Delete");
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledWith("msg-123");
    });

    it("does not render delete button when messageId or onDelete is missing", () => {
      render(<MessageActions isBot={true} copied={false} onCopy={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe("Floating Glass Dock styling, tokens, and touch targets", () => {
    it("renders container with floating glass dock classes", () => {
      const { container } = render(<MessageActions isBot={true} copied={false} onCopy={vi.fn()} />);

      const dock = container.firstChild as HTMLElement;
      expect(dock).toHaveClass(
        "backdrop-blur-md",
        "bg-(--surface-elevated)/80",
        "border",
        "border-(--border)",
        "shadow-sm",
        "rounded-full",
        "px-2.5",
        "py-1",
        "flex",
        "items-center",
        "gap-2"
      );
    });

    it("renders reverse flex order for user messages", () => {
      const { container } = render(
        <MessageActions isBot={false} copied={false} onCopy={vi.fn()} />
      );

      const dock = container.firstChild as HTMLElement;
      expect(dock).toHaveClass("flex-row-reverse");
    });

    it("ensures all buttons have type='button', >= 28px touch targets, and active micro-interactions", () => {
      const { container } = render(
        <MessageActions
          isBot={true}
          messageId="msg-1"
          copied={false}
          canRegenerate={true}
          onCopy={vi.fn()}
          onRegenerate={vi.fn()}
          onDelete={vi.fn()}
          onSpeak={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((btn) => {
        // type="button" attribute
        expect(btn).toHaveAttribute("type", "button");

        // Touch target >= 28px
        expect(btn).toHaveClass("min-h-[28px]", "min-w-[28px]");

        // Micro-interactions and focus rings
        expect(btn).toHaveClass(
          "active:scale-[0.92]",
          "transition-transform",
          "duration-150",
          "ease-out",
          "focus-visible:ring-2",
          "focus-visible:ring-(--ring)",
          "focus-visible:outline-none"
        );

        // No dead tokens
        expect(btn).not.toHaveClass("text-secondary");

        // No sub-12px font sizes
        expect(btn).not.toHaveClass("text-[10px]");
      });
    });
  });
});
