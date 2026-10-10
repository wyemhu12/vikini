import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import IconPicker from "./IconPicker";
import { useLanguageStore } from "@/lib/store/languageStore";

describe("IconPicker Accessibility & Semantics (TC-A11Y-01)", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
  });

  it("renders with a semantic native button trigger instead of a div with role='combobox'", () => {
    render(<IconPicker onSelect={vi.fn()} />);

    // Trigger button should be a native button
    const trigger = screen.getByRole("button", { name: /select icon/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName.toLowerCase()).toBe("button");
    expect(trigger.getAttribute("type")).toBe("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("applies consumer className and focus-visible indicators to the trigger button", () => {
    render(<IconPicker className="my-custom-class" onSelect={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /select icon/i });
    expect(trigger.className).toContain("my-custom-class");
    expect(trigger.className).toContain("focus-visible:ring-2");
    expect(trigger.className).toContain("focus-visible:ring-(--ring)");
    expect(trigger.className).toContain("focus-visible:outline-none");
  });

  it("displays icon value and adds pr-14 padding when a value is provided", () => {
    render(<IconPicker value="Sparkles" onSelect={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /icon:\s*sparkles/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("pr-14");
    expect(screen.getByText("Sparkles")).toBeInTheDocument();
  });

  it("renders a separate sibling Clear button when value is present and calls onSelect('') on click", () => {
    const handleSelect = vi.fn();
    render(<IconPicker value="Lightbulb" onSelect={handleSelect} />);

    const clearButton = screen.getByRole("button", { name: /clear icon/i });
    expect(clearButton).toBeInTheDocument();
    expect(clearButton.tagName.toLowerCase()).toBe("button");
    expect(clearButton.getAttribute("type")).toBe("button");
    expect(clearButton.className).toContain("absolute right-8");

    fireEvent.click(clearButton);
    expect(handleSelect).toHaveBeenCalledWith("");
  });

  it("respects the disabled prop by disabling the trigger button and hiding the clear button", () => {
    render(<IconPicker value="Sparkles" disabled onSelect={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /icon:\s*sparkles/i });
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole("button", { name: /clear icon/i })).not.toBeInTheDocument();
  });

  it("renders localized aria-label when language is switched to Vietnamese", () => {
    useLanguageStore.setState({ language: "vi" });
    render(<IconPicker value="Sparkles" onSelect={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /biểu tượng:\s*sparkles/i });
    expect(trigger).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /xóa biểu tượng/i });
    expect(clearButton).toBeInTheDocument();
  });
});
