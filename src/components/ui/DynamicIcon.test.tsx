import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { DynamicIcon } from "./DynamicIcon";

describe("DynamicIcon", () => {
  it("renders a Lucide icon when given a valid PascalCase icon name", () => {
    const { container } = render(<DynamicIcon name="Lightbulb" className="w-5 h-5" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.classList.contains("lucide-lightbulb")).toBe(true);
  });

  it("renders a Lucide icon when given lowercase icon name", () => {
    const { container } = render(<DynamicIcon name="sparkles" className="w-4 h-4" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.classList.contains("lucide-sparkles")).toBe(true);
  });

  it("renders text or emoji when name is not a Lucide icon", () => {
    const { container, getByText } = render(<DynamicIcon name="💡" className="text-xl" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(getByText("💡")).toBeTruthy();
  });

  it("renders custom string symbol when provided", () => {
    const { getByText } = render(<DynamicIcon name="◆" />);
    expect(getByText("◆")).toBeTruthy();
  });

  it("renders fallback when name is null or undefined", () => {
    const { getByText } = render(<DynamicIcon name={null} fallback={<span>FallbackIcon</span>} />);
    expect(getByText("FallbackIcon")).toBeTruthy();
  });

  it("renders fallback when name is empty whitespace", () => {
    const { getByText } = render(<DynamicIcon name="   " fallback={<span>FallbackIcon</span>} />);
    expect(getByText("FallbackIcon")).toBeTruthy();
  });

  it("renders null when name is missing and no fallback provided", () => {
    const { container } = render(<DynamicIcon name="" />);
    expect(container.firstChild).toBeNull();
  });
});
