// src/app/features/chat/components/BubbleAvatar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { BubbleAvatar } from "./BubbleAvatar";
import { BubbleMarkdown } from "./BubbleMarkdown";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (k: string) => (k === "me" ? "ME" : k),
    language: "en",
  }),
}));

vi.mock("./ModelAvatar", () => ({
  ModelAvatar: ({ modelName }: { modelName?: string }) => (
    <div data-testid="model-avatar">{modelName || "AI"}</div>
  ),
}));

describe("BubbleAvatar", () => {
  it("renders user avatar when isBot is false", () => {
    render(<BubbleAvatar isBot={false} isLoading={false} />);
    expect(screen.getByText("ME")).toBeDefined();
  });

  it("renders model avatar when isBot is true and not loading", () => {
    render(<BubbleAvatar isBot={true} isLoading={false} modelName="gemini-2.5-pro" />);
    expect(screen.getByTestId("model-avatar")).toBeDefined();
    expect(screen.getByText("gemini-2.5-pro")).toBeDefined();
  });

  it("renders shimmer pulse when isBot is true and loading", () => {
    const { container } = render(<BubbleAvatar isBot={true} isLoading={true} />);
    expect(container.querySelector("svg")).toBeDefined();
  });

  it("applies standard design tokens and no dead classes", () => {
    const { container: userContainer } = render(<BubbleAvatar isBot={false} />);
    const userDiv = userContainer.firstChild as HTMLElement;
    expect(userDiv.className).toContain("bg-(--accent)");
    expect(userDiv.className).toContain("text-(--accent-foreground)");
    expect(userDiv.className).not.toContain("border-token");
    expect(userDiv.className).not.toContain("bg-surface-elevated");
    expect(userDiv.className).not.toContain("text-[10px]");
    expect(userDiv.className).not.toContain("text-[8px]");

    const { container: botContainer } = render(<BubbleAvatar isBot={true} isLoading={false} />);
    const botDiv = botContainer.firstChild as HTMLElement;
    expect(botDiv.className).toContain("bg-(--surface-elevated)");
    expect(botDiv.className).toContain("border-(--border)");
    expect(botDiv.className).toContain("text-(--text-primary)");
    expect(botDiv.className).not.toContain("border-token");
    expect(botDiv.className.split(" ")).not.toContain("text-primary");
  });

  it("renders loading pulse with accent tokens rather than hardcoded blue", () => {
    const { container } = render(<BubbleAvatar isBot={true} isLoading={true} />);
    const botDiv = container.firstChild as HTMLElement;
    expect(botDiv.className).toContain("bg-(--accent)/10");
    expect(botDiv.className).toContain("border-(--accent)/30");
    expect(botDiv.className).not.toContain("border-blue-500");
    expect(botDiv.className).not.toContain("bg-blue-500");
  });
});

describe("BubbleMarkdown", () => {
  it("renders markdown content for bot messages", () => {
    render(<BubbleMarkdown content={`# Heading 1\n\nParagraph text`} isBot={true} />);
    expect(screen.getByText("Heading 1")).toBeDefined();
    expect(screen.getByText("Paragraph text")).toBeDefined();
  });

  it("renders plain text when isBot is false", () => {
    render(<BubbleMarkdown content="User raw text" isBot={false} />);
    expect(screen.getByText("User raw text")).toBeDefined();
  });

  it("renders list items and quotes with design tokens", () => {
    render(<BubbleMarkdown content={`> Quote block\n\n- Item 1\n- Item 2`} isBot={true} />);
    const quote = screen.getByText("Quote block");
    expect(quote).toBeDefined();
    expect(quote.closest("blockquote")?.className).toContain("border-(--accent)/60");
    expect(quote.closest("blockquote")?.className).toContain("text-(--text-secondary)");
    expect(quote.closest("blockquote")?.className).not.toContain("border-token");
    expect(quote.closest("blockquote")?.className.split(" ")).not.toContain("text-secondary");

    expect(screen.getByText("Item 1")).toBeDefined();
    expect(screen.getByText("Item 2")).toBeDefined();
  });

  it("renders links with target blank and accent style", () => {
    render(<BubbleMarkdown content="[Link](https://example.com)" isBot={true} />);
    const link = screen.getByRole("link", { name: "Link" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.className).toContain("text-(--accent)");
    expect(link.className).not.toContain("text-(--primary-light)");
  });

  it("renders tables with modern tokens", () => {
    const tableMd = `| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |`;
    const { container } = render(<BubbleMarkdown content={tableMd} isBot={true} />);
    const wrapper = container.querySelector(".overflow-x-auto");
    expect(wrapper?.className).toContain("border-(--border)");
    expect(wrapper?.className).toContain("bg-(--surface-elevated)");
    expect(wrapper?.className).not.toContain("border-token");
    expect(wrapper?.className.split(" ")).not.toContain("bg-surface-elevated");
  });

  it("renders typing cursor when streaming for last assistant", () => {
    const { container } = render(
      <BubbleMarkdown
        content="Streaming text"
        isBot={true}
        isStreaming={true}
        isLastAssistant={true}
      />
    );
    expect(container.querySelector("[aria-hidden='true']")).toBeDefined();
  });
});
