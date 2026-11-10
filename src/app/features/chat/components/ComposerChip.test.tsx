// src/app/features/chat/components/ComposerChip.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Globe } from "lucide-react";
import { ComposerChip } from "./ComposerChip";

describe("ComposerChip", () => {
  it("reflects pressed state through aria-pressed and token classes (TC-01)", () => {
    const { rerender } = render(
      <ComposerChip icon={Globe} pressed>
        Web search
      </ComposerChip>
    );
    const chip = screen.getByRole("button", { name: "Web search" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.className).toContain("bg-(--soft)");
    expect(chip.className).toContain("border-(--accent)");
    expect(chip.className).not.toContain("uppercase");
    const icon = chip.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");

    rerender(
      <ComposerChip icon={Globe} pressed={false}>
        Web search
      </ComposerChip>
    );
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip.className).toContain("border-(--line)");
    expect(chip.className).not.toContain("bg-(--soft)");
  });

  it("omits aria-pressed when pressed is not provided and forwards ref (TC-02)", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<ComposerChip ref={ref}>Gem</ComposerChip>);
    const chip = screen.getByRole("button", { name: "Gem" });
    expect(chip).not.toHaveAttribute("aria-pressed");
    expect(chip).toHaveAttribute("type", "button");
    expect(ref.current).toBe(chip);
  });

  it("uses accent text without fill for active menu triggers", () => {
    render(<ComposerChip active>Gem: Coder</ComposerChip>);
    const chip = screen.getByRole("button", { name: "Gem: Coder" });
    expect(chip).not.toHaveAttribute("aria-pressed");
    expect(chip.className).toContain("text-(--accent)");
    expect(chip.className).not.toContain("bg-(--soft)");
  });
});
