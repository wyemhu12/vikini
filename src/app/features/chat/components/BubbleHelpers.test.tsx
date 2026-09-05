import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TypingDots, TypingCursor, ThinkingBlock } from "./BubbleHelpers";

describe("BubbleHelpers", () => {
  describe("TypingDots", () => {
    it("renders loading dots container and 3 dots with correct design tokens", () => {
      const { container } = render(<TypingDots />);

      const dotsContainer = container.querySelector(".typing-dots");
      expect(dotsContainer).toBeInTheDocument();
      expect(dotsContainer).toHaveClass("flex", "items-center", "gap-1.5");

      const dots = dotsContainer?.querySelectorAll("span");
      expect(dots?.length).toBe(3);

      dots?.forEach((dot) => {
        expect(dot).toHaveClass("w-1.5", "h-1.5", "bg-(--accent)", "rounded-full");
        expect(dot).not.toHaveClass("bg-secondary");
      });
    });
  });

  describe("TypingCursor", () => {
    it("renders with aria-hidden and anti-orphan inline-block classes", () => {
      const { container } = render(<TypingCursor />);

      const cursor = container.querySelector("span");
      expect(cursor).toBeInTheDocument();
      expect(cursor).toHaveAttribute("aria-hidden", "true");
      expect(cursor).toHaveClass(
        "inline-block",
        "whitespace-nowrap",
        "ml-1",
        "align-middle",
        "w-0.5",
        "h-4",
        "bg-(--primary)",
        "rounded-sm"
      );
    });
  });

  describe("ThinkingBlock", () => {
    const mockT = vi.fn((key: string) => {
      if (key === "thinkingProcess") return "Thinking Process";
      return key;
    });

    it("renders collapsed by default with aria-expanded=false and proper design tokens", () => {
      render(<ThinkingBlock content="This is reasoning steps." t={mockT} />);

      const button = screen.getByRole("button", { name: /thinking process/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-expanded", "false");

      // Verify a11y focus and active classes
      expect(button).toHaveClass(
        "focus-visible:ring-2",
        "focus-visible:ring-(--ring)",
        "focus-visible:outline-none",
        "active:scale-[0.98]"
      );

      // Verify token fixes (no dead text-secondary)
      expect(button).toHaveClass("text-(--text-secondary)", "hover:text-(--text-primary)");
      expect(button).not.toHaveClass("text-secondary");

      // Content should not be visible when collapsed
      expect(screen.queryByText("This is reasoning steps.")).not.toBeInTheDocument();
    });

    it("toggles content and aria-expanded when button is clicked", () => {
      const contentText = "First step: analyze user query.\nSecond step: solve problem.";
      render(<ThinkingBlock content={contentText} t={mockT} />);

      const button = screen.getByRole("button", { name: /thinking process/i });
      expect(button).toHaveAttribute("aria-expanded", "false");

      // Click to expand
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");

      const content = screen.getByText(/analyze user query/i);
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass("text-(--text-secondary)");
      expect(content).not.toHaveClass("text-secondary");

      // Click to collapse
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("uses control-bg and border design tokens for wrapper", () => {
      const { container } = render(<ThinkingBlock content="Test content" t={mockT} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("bg-(--control-bg)", "border-(--border)", "border", "rounded-lg");
    });

    it("uses fallback text if translation returns empty", () => {
      render(<ThinkingBlock content="Test content" t={() => ""} />);
      expect(screen.getByText("Thinking Process")).toBeInTheDocument();
    });

    it("displays localized translation string when provided", () => {
      render(<ThinkingBlock content="Test content" t={() => "Quá trình suy nghĩ"} />);
      expect(screen.getByText("Quá trình suy nghĩ")).toBeInTheDocument();
    });
  });
});
