// src/app/features/personas/components/PersonaQuickSwitch.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PersonaQuickSwitch from "./PersonaQuickSwitch";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        personaChip: "Persona",
        selectPersona: "Chọn Persona",
      };
      return dict[key] ?? key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("../stores/usePersonaStore", () => ({
  usePersonaStore: () => ({ openPersonaModal: vi.fn(), triggerPersonaApplied: vi.fn() }),
}));

vi.mock("@/components/ui/DynamicIcon", () => ({
  DynamicIcon: () => <svg data-testid="persona-icon" />,
}));

describe("PersonaQuickSwitch trigger (TC-18)", () => {
  it("prefixes the active persona name with 'Persona:'", () => {
    render(
      <PersonaQuickSwitch
        currentPersona={{ name: "Mentor", icon: null, color: null }}
        conversationId="c1"
      />
    );
    const trigger = screen.getByRole("button", { name: "Persona: Mentor" });
    expect(trigger).not.toHaveAttribute("aria-pressed");
    expect(trigger.className).not.toContain("uppercase");
  });

  it("shows the plain 'Persona' label when none is applied", () => {
    render(<PersonaQuickSwitch currentPersona={null} conversationId="c1" />);
    expect(screen.getByRole("button", { name: "Persona" })).toBeInTheDocument();
  });

  it("drops the prefix when showPrefix is false", () => {
    render(
      <PersonaQuickSwitch
        currentPersona={{ name: "Mentor", icon: null, color: null }}
        conversationId="c1"
        showPrefix={false}
      />
    );
    expect(screen.getByRole("button", { name: "Mentor" })).toBeInTheDocument();
  });
});
