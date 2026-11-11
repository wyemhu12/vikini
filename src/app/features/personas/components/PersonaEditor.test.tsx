import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PersonaEditor from "./PersonaEditor";
import type { PersonaForUI } from "./PersonaPreview";

vi.mock("@/components/ui/IconPicker", () => ({
  default: ({ value }: { value: string }) => <div data-testid="icon-picker">{value}</div>,
}));

const basePersona: PersonaForUI = {
  id: "persona-1",
  name: "Editor Alpha",
  description: "Original description",
  tone: "professional",
  useEmojis: false,
  useHeadersLists: true,
  userContext: "Frontend dev",
  customInstructions: "Keep code concise",
  icon: "Sparkles",
  color: "#d97757",
};

describe("PersonaEditor draft preservation (TC-6E-05)", () => {
  it("preserves in-progress edits when parent re-renders with a cloned persona sharing the same id, and reloads when id changes", () => {
    const onSave = vi.fn();
    const { rerender } = render(<PersonaEditor persona={basePersona} onSave={onSave} />);

    const nameInput = screen.getByDisplayValue("Editor Alpha");
    fireEvent.change(nameInput, { target: { value: "Editor Alpha (Edited)" } });
    expect(screen.getByDisplayValue("Editor Alpha (Edited)")).toBeInTheDocument();

    // Re-render with a fresh object reference that still has id="persona-1"
    rerender(
      <PersonaEditor
        persona={{ ...basePersona, description: "Parent clone should not clobber draft" }}
        onSave={onSave}
      />
    );
    expect(screen.getByDisplayValue("Editor Alpha (Edited)")).toBeInTheDocument();

    // Switch to a different persona id -> loads all 10 fields cleanly
    const secondPersona: PersonaForUI = {
      id: "persona-2",
      name: "Lawyer Beta",
      description: "Legal counsel",
      tone: "lawyer",
      useEmojis: true,
      useHeadersLists: false,
      userContext: "Contract review",
      customInstructions: "Cite clauses",
      icon: "Shield",
      color: "#6b7280",
    };
    rerender(<PersonaEditor persona={secondPersona} onSave={onSave} />);
    expect(screen.getByDisplayValue("Lawyer Beta")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Legal counsel")).toBeInTheDocument();
  });
});
