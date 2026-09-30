import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    t: (k: string) => k,
  }),
}));

describe("KeyboardShortcutsModal", () => {
  it("does not render content when isOpen is false", () => {
    render(<KeyboardShortcutsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText("keyboardShortcuts")).toBeNull();
  });

  it("renders shortcuts dialog when isOpen is true", () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("keyboardShortcuts")).toBeInTheDocument();
    expect(screen.getByText("shortcutNewChat")).toBeInTheDocument();
    expect(screen.getByText("shortcutCommandPalette")).toBeInTheDocument();
  });
});
