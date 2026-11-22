// src/app/features/chat/components/BubbleMarkdown.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BubbleMarkdown } from "./BubbleMarkdown";

vi.mock("next/dynamic", () => ({
  default: () => {
    return function DynamicMock() {
      return null;
    };
  },
}));

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("BubbleMarkdown", () => {
  describe("User plain-text rendering (isBot={false})", () => {
    it("TC-UB-02/NP-1: uses whitespace-pre-wrap and wrap-anywhere without break-words or break-all", () => {
      const prose =
        "Đây là một đoạn văn bản thông thường nhiều từ tiếng Việt và English prose để kiểm tra xuống dòng tự nhiên theo ranh giới khoảng trắng.";

      render(<BubbleMarkdown isBot={false} content={prose} className="custom-user-cls" />);

      const span = screen.getByText(prose);
      expect(span.tagName).toBe("SPAN");
      expect(span).toHaveClass("whitespace-pre-wrap", "wrap-anywhere", "custom-user-cls");
      expect(span).not.toHaveClass("break-words");
      expect(span).not.toHaveClass("break-all");
    });

    it("TC-UB-03/TC-UB-04: preserves newlines and wraps mixed prose + long unbroken Google Docs URL", () => {
      const mixedContent =
        "Xem giúp mình link này:\nhttps://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit?usp=sharing&tab=t.0&very_long_param=" +
        "x".repeat(140);

      const { container } = render(<BubbleMarkdown isBot={false} content={mixedContent} />);

      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe(mixedContent);
      expect(span).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
      expect(span).not.toHaveClass("break-words");
    });
  });

  describe("Assistant markdown rendering (isBot={true})", () => {
    it("TC-UB-09: preserves .chat-markdown container classes and break-all on markdown links", () => {
      const url =
        "https://www.amazon.com/dp/B09V3KXJPB?dib=eyJ2IjoiMSJ9.very_long_token_without_spaces";
      const { container } = render(
        <BubbleMarkdown isBot={true} content={`Check [this link](${url}) and normal text.`} />
      );

      const wrapper = container.querySelector(".chat-markdown");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass("chat-markdown-container", "w-full", "overflow-hidden");

      const link = screen.getByRole("link", { name: "this link" });
      expect(link).toHaveAttribute("href", url);
      expect(link).toHaveClass("break-all");
    });
  });
});
