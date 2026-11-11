// src/app/features/image-gen/components/StyleSelector.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StyleSelector from "./StyleSelector";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("StyleSelector (4B TC-07)", () => {
  it("exposes the selected style with aria-pressed and theme tokens", () => {
    const onSelect = vi.fn();
    const { container } = render(<StyleSelector selectedStyle="anime" onSelect={onSelect} />);

    const anime = screen.getByRole("button", { name: "styleAnime" });
    expect(anime).toHaveAttribute("aria-pressed", "true");
    expect(anime.className).toContain("border-(--accent)");
    const photo = screen.getByRole("button", { name: "stylePhoto" });
    expect(photo).toHaveAttribute("aria-pressed", "false");

    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(
      classes.filter((c) => /(text-\[(10|11)px\]|purple|border-primary|ring-primary)/.test(c))
    ).toEqual([]);

    fireEvent.click(photo);
    expect(onSelect).toHaveBeenCalledWith("photorealistic");
  });
});
