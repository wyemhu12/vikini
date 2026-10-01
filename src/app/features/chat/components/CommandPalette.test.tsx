import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: vi.fn(),
    t: (k: string) => k,
  }),
}));

const mockToggleTheme = vi.fn();

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "blueprint",
    toggleTheme: mockToggleTheme,
  }),
}));

describe("CommandPalette", () => {
  it("does not render dialog content when isOpen is false", () => {
    render(
      <CommandPalette
        isOpen={false}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />
    );
    expect(screen.queryByPlaceholderText("commandPalettePlaceholder")).toBeNull();
  });

  it("renders search input and actions when isOpen is true", () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onOpenShortcuts={vi.fn()}
        conversations={[{ id: "c1", title: "Conversation One" }]}
      />
    );

    expect(screen.getByPlaceholderText("commandPalettePlaceholder")).toBeInTheDocument();
    expect(screen.getByText("shortcutNewChat")).toBeInTheDocument();
    expect(screen.getByText("Conversation One")).toBeInTheDocument();
  });

  it("filters items based on user query", () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onOpenShortcuts={vi.fn()}
        conversations={[{ id: "c1", title: "Alpha Conversation" }]}
      />
    );

    const input = screen.getByPlaceholderText("commandPalettePlaceholder");
    fireEvent.change(input, { target: { value: "Alpha" } });

    expect(screen.getByText("Alpha Conversation")).toBeInTheDocument();
    expect(screen.queryByText("shortcutNewChat")).toBeNull();
  });

  it("triggers action on item click", () => {
    const onNewChat = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        isOpen={true}
        onClose={onClose}
        onNewChat={onNewChat}
        onOpenShortcuts={vi.fn()}
      />
    );

    const newChatBtn = screen.getByText("shortcutNewChat");
    fireEvent.click(newChatBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onNewChat).toHaveBeenCalled();
  });

  it("calls toggleTheme when switch-theme item is clicked (UI-01)", () => {
    const onClose = vi.fn();
    render(
      <CommandPalette
        isOpen={true}
        onClose={onClose}
        onNewChat={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />
    );

    const themeItem = screen.getByText(/switchTheme/i);
    fireEvent.click(themeItem);

    expect(mockToggleTheme).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
