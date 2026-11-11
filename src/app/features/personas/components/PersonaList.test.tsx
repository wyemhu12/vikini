// src/app/features/personas/components/PersonaList.test.tsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PersonaList from "./PersonaList";
import type { PersonaForUI } from "./PersonaPreview";

const DICT: Record<string, string> = {
  personaUse: "Dùng Persona",
  libraryInUse: "Đang dùng",
  libraryBuiltIn: "Có sẵn",
  preview: "Xem trước",
  personaEdit: "Sửa Persona",
  personaDelete: "Xóa Persona",
  messageMoreActions: "Thêm thao tác",
  personaNoPersonas: "Chưa có persona nào.",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("@/components/ui/DynamicIcon", () => ({
  DynamicIcon: () => <svg data-testid="icon" />,
}));

function persona(id: string, name: string, isPremade: boolean): PersonaForUI {
  return {
    id,
    name,
    description: "Mô tả",
    tone: "friendly",
    useEmojis: false,
    useHeadersLists: false,
    userContext: "",
    customInstructions: "",
    icon: "",
    color: "",
    isPremade,
  };
}

const PREMADE = persona("p1", "Mentor", true);
const MINE = persona("m1", "Nhà văn miền Tây", false);

function setup(overrides: Partial<React.ComponentProps<typeof PersonaList>> = {}) {
  const props = {
    loading: false,
    personas: [PREMADE, MINE],
    selectedPersonaId: null,
    canApply: true,
    onSelect: vi.fn(),
    onPreview: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const view = render(<PersonaList {...props} />);
  return { props, ...view };
}

describe("PersonaList (6A)", () => {
  it("uses translated badges, tokens and a labelled primary action (TC-06)", () => {
    const { container, props } = setup();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Có sẵn")).toBeInTheDocument();
    expect(screen.queryByText("Premade")).toBeNull();

    const primary = within(cards[1]).getByRole("button", { name: "Dùng Persona" });
    expect(primary).toHaveTextContent("Dùng Persona");
    fireEvent.click(primary);
    expect(props.onSelect).toHaveBeenCalledWith(MINE);

    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => /(purple|text-\[10px\]|(^|\s)uppercase(\s|$))/.test(c))).toEqual(
      []
    );
    expect(container.innerHTML).toContain("minmax(280px,1fr)");
  });

  it("deletes from the menu and shows an empty message without cards (TC-07)", () => {
    const { props, unmount } = setup();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Thêm thao tác: Nhà văn miền Tây" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Xóa Persona" }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledWith(MINE);
    unmount();

    setup({ personas: [] });
    expect(screen.getByText("Chưa có persona nào.")).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("previews instead of applying when there is no conversation (TC-08)", () => {
    const { props } = setup({ canApply: false });
    const cards = screen.getAllByRole("article");
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Xem trước" }));
    expect(props.onPreview).toHaveBeenCalledWith(PREMADE);
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(within(cards[0]).getAllByRole("button")).toHaveLength(1);
  });
});
