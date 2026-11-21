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

const mockToggleMode = vi.fn();

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({
    mode: "dark",
    toggleMode: mockToggleMode,
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

  it("calls toggleMode when switch-theme item is clicked (UI-01, TC-18)", () => {
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

    expect(mockToggleMode).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("TC-12: has no duplicate Esc label and names the target language", () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />
    );
    expect(screen.queryByText("Esc")).toBeNull();
    expect(screen.getByText("switchLanguageTo targetLanguageLabel")).toBeInTheDocument();
  });

  it("TC-W4-03 / WP-2: exposes WAI-ARIA 1.2 combobox/listbox/group/option semantics, empty status outside listbox, and scrollIntoView", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onOpenShortcuts={vi.fn()}
        extraCommands={[
          {
            id: "go-gallery",
            title: "Go to Library",
            category: "navigation",
            icon: null,
            perform: vi.fn(),
          },
        ]}
        conversations={[{ id: "c1", title: "My Chat" }]}
      />
    );

    const combobox = screen.getByRole("combobox", { name: "commandPalette" });
    const listbox = screen.getByRole("listbox", { name: "commandPalette" });
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    expect(combobox).toHaveAttribute("aria-autocomplete", "list");
    expect(combobox).toHaveAttribute("aria-controls", listbox.id);

    // Category headings rendered inside groups
    expect(screen.getByText("commandCategoryActions")).toBeInTheDocument();
    expect(screen.getByText("commandCategoryNavigation")).toBeInTheDocument();
    expect(screen.getByText("commandCategoryPreferences")).toBeInTheDocument();
    expect(screen.getByText("commandCategoryConversations")).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(5);
    expect(combobox).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    // ArrowDown updates active option and calls scrollIntoView
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(combobox).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });

    // Empty state removes listbox and renders role="status" outside listbox
    fireEvent.change(combobox, { target: { value: "zzzz-no-match" } });
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(combobox.getAttribute("aria-controls")).toBeNull();
    expect(combobox.getAttribute("aria-activedescendant")).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("commandPaletteNoResults");
  });

  it("renders extra navigation commands and omits shortcuts without a handler", () => {
    const go = vi.fn();
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        extraCommands={[
          { id: "go-gallery", title: "Gallery", category: "navigation", icon: null, perform: go },
        ]}
      />
    );
    expect(screen.queryByText("shortcutOpenShortcuts")).toBeNull();
    fireEvent.click(screen.getByText("Gallery"));
    expect(go).toHaveBeenCalledTimes(1);
  });

  it("Negative Probe #5: opens/closes instantly on both DialogContent & DialogOverlay and reserves pr-10 for close X", () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("animate-none");
    expect(dialog.className).toContain("duration-0");
    expect(dialog.className).not.toContain("animate-in");
    expect(dialog.className).not.toContain("animate-out");

    const overlay = document.body.querySelector("[data-state='open'].fixed.inset-0");
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("animate-none");
    expect(overlay?.className).toContain("duration-0");
    expect(overlay?.className).not.toContain("animate-in");
    expect(overlay?.className).not.toContain("animate-out");

    const input = screen.getByPlaceholderText("commandPalettePlaceholder");
    expect(input.parentElement?.className).toContain("pr-10");
  });
});
