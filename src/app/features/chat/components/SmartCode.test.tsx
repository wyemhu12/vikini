import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SmartCode, { extractText } from "./SmartCode";

// Mock useLanguage hook
vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        copy: "Copy",
        copied: "Copied",
        expand: "Expand",
        collapse: "Collapse",
        expandCode: "Expand code",
        collapseCode: "Collapse code",
      };
      return dict[key] || key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

describe("extractText utility", () => {
  it("extracts text from strings and numbers", () => {
    expect(extractText("hello")).toBe("hello");
    expect(extractText(123)).toBe("123");
  });

  it("extracts text from arrays", () => {
    expect(extractText(["foo", " ", "bar"])).toBe("foo bar");
  });

  it("extracts text from nested React elements", () => {
    const element = (
      <div>
        <span>const </span>
        <span>x = 10;</span>
      </div>
    );
    expect(extractText(element)).toBe("const x = 10;");
  });

  it("returns empty string for null or undefined", () => {
    expect(extractText(null)).toBe("");
    expect(extractText(undefined)).toBe("");
  });
});

describe("SmartCode component", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Inline rendering", () => {
    it("renders inline code with proper design tokens", () => {
      const { container } = render(
        <SmartCode inline className="text-red-500">
          const a = 1;
        </SmartCode>
      );

      const codeElement = container.querySelector("code");
      expect(codeElement).toBeInTheDocument();
      expect(codeElement?.textContent).toBe("const a = 1;");
      expect(codeElement?.className).toContain("bg-(--control-bg)");
      expect(codeElement?.className).toContain("text-(--accent)");
      expect(codeElement?.className).toContain("font-mono");
      expect(codeElement?.className).toContain("text-xs");

      // Should not render copy button or header
      expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
    });
  });

  describe("Block code rendering", () => {
    it("renders block code with language label and copy button", () => {
      render(
        <SmartCode inline={false} className="language-typescript">
          const greeting = "Hello world";
        </SmartCode>
      );

      // Monospace uppercase language badge
      const langBadge = screen.getByText("typescript");
      expect(langBadge).toBeInTheDocument();
      expect(langBadge.className).toContain("font-mono");
      expect(langBadge.className).toContain("text-xs");
      expect(langBadge.className).toContain("text-(--text-secondary)");

      // Copy button exists with Copy text
      const copyButton = screen.getByRole("button", { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
      expect(copyButton.className).toContain("active:scale-[0.95]");
      expect(copyButton.className).toContain("focus-visible:ring-2");

      // Code text rendered inside
      expect(screen.getByText('const greeting = "Hello world";')).toBeInTheDocument();

      // Mac 3-dot window buttons must NOT exist
      const dotButtons = document.querySelectorAll(
        ".bg-\\[\\#ff5f56\\], .bg-\\[\\#ffbd2e\\], .bg-\\[\\#27c93f\\]"
      );
      expect(dotButtons.length).toBe(0);
    });

    it("defaults language badge to TEXT if no language class is provided", () => {
      render(<SmartCode inline={false}>Plain text content</SmartCode>);

      expect(screen.getByText("text")).toBeInTheDocument();
    });

    it("uses surface-elevated and border tokens for container", () => {
      const { container } = render(
        <SmartCode inline={false} className="language-python">
          print("test")
        </SmartCode>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("bg-(--surface-elevated)");
      expect(wrapper.className).toContain("border-(--border)");
      expect(wrapper.className).not.toContain("card-surface");
      expect(wrapper.className).not.toContain("border-token");
    });
  });

  describe("Copy to clipboard action", () => {
    it("copies code to clipboard and shows morphing feedback", async () => {
      render(
        <SmartCode inline={false} className="language-javascript">
          console.log("vikini");
        </SmartCode>
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      expect(copyButton).toHaveTextContent(/copy/i);

      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(writeTextMock).toHaveBeenCalledWith('console.log("vikini");');

      // Morphing feedback: should now display Copied
      expect(screen.getByText(/copied/i)).toBeInTheDocument();

      // Fast-forward 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should revert back to Copy
      expect(screen.getByText(/copy/i)).toBeInTheDocument();
    });
  });

  describe("Collapse and expand behavior (> 20 lines)", () => {
    const generateLines = (count: number) =>
      Array.from({ length: count }, (_, i) => `const line${i + 1} = ${i + 1};`).join("\n");

    it("does not show expand button when lineCount <= 20", () => {
      const shortCode = generateLines(15);
      render(
        <SmartCode inline={false} className="language-typescript">
          {shortCode}
        </SmartCode>
      );

      expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /collapse/i })).not.toBeInTheDocument();
    });

    it("renders gradient fade mask and expand button when lineCount > 20", () => {
      const longCode = generateLines(25);
      const { container } = render(
        <SmartCode inline={false} className="language-typescript">
          {longCode}
        </SmartCode>
      );

      // Collapsed container should have max-h-[320px]
      const codeWrapper = container.querySelector(".max-h-\\[320px\\]");
      expect(codeWrapper).toBeInTheDocument();

      // Gradient fade mask
      const gradientMask = container.querySelector(".bg-gradient-to-t");
      expect(gradientMask).toBeInTheDocument();
      expect(gradientMask?.className).toContain("from-(--surface-elevated)");
      expect(gradientMask?.className).toContain("to-transparent");

      // Expand code button
      const expandButton = screen.getByRole("button", { name: /expand code/i });
      expect(expandButton).toBeInTheDocument();
      expect(expandButton.className).toContain("text-xs");
      expect(expandButton.className).toContain("text-(--text-secondary)");
      expect(expandButton.className).toContain("hover:text-(--text-primary)");
      expect(expandButton.className).toContain("active:scale-[0.95]");
      expect(expandButton.className).toContain("focus-visible:ring-2");
    });

    it("expands code when clicking Expand button and allows collapsing back", () => {
      const longCode = generateLines(30);
      const { container } = render(
        <SmartCode inline={false} className="language-typescript">
          {longCode}
        </SmartCode>
      );

      const expandButton = screen.getByRole("button", { name: /expand code/i });
      fireEvent.click(expandButton);

      // After expand, max-h-[320px] restriction and gradient mask should be gone
      expect(container.querySelector(".max-h-\\[320px\\]")).not.toBeInTheDocument();
      expect(container.querySelector(".bg-gradient-to-t")).not.toBeInTheDocument();

      // Collapse button should now appear
      const collapseButton = screen.getByRole("button", { name: /collapse code/i });
      expect(collapseButton).toBeInTheDocument();
      expect(collapseButton.className).toContain("text-xs");
      expect(collapseButton.className).toContain("text-(--text-secondary)");
      expect(collapseButton.className).toContain("hover:text-(--text-primary)");

      // Click Collapse button to collapse again
      fireEvent.click(collapseButton);

      // Should be collapsed again
      expect(container.querySelector(".max-h-\\[320px\\]")).toBeInTheDocument();
      expect(container.querySelector(".bg-gradient-to-t")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /expand code/i })).toBeInTheDocument();
    });
  });
});
