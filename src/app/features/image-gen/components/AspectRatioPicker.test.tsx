// src/app/features/image-gen/components/AspectRatioPicker.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AspectRatioPicker } from "./AspectRatioPicker";

const COMMON = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const EXTENDED = ["3:2", "2:3", "21:9", "5:4", "4:5", "1:4", "4:1", "1:8", "8:1"];

function setup(value: string, onChange = vi.fn()) {
  render(
    <AspectRatioPicker
      value={value}
      onChange={onChange}
      ratios={COMMON}
      extendedRatios={EXTENDED}
      label="Tỷ lệ khung hình"
      extendedLabel="Mở rộng"
    />
  );
  return onChange;
}

describe("AspectRatioPicker", () => {
  it("renders a named radiogroup with the selected ratio checked (TC-01)", () => {
    const onChange = setup("16:9");
    expect(screen.getByRole("radiogroup", { name: "Tỷ lệ khung hình" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);

    const selected = screen.getByRole("radio", { name: "16:9" });
    expect(selected).toHaveAttribute("aria-checked", "true");
    expect(selected).toHaveAttribute("tabindex", "0");
    expect(selected.className).toContain("bg-(--soft)");
    for (const radio of radios.filter((r) => r !== selected)) {
      expect(radio).toHaveAttribute("aria-checked", "false");
      expect(radio).toHaveAttribute("tabindex", "-1");
    }

    fireEvent.click(screen.getByRole("radio", { name: "1:1" }));
    expect(onChange).toHaveBeenCalledWith("1:1");
  });

  it("moves the selection with arrow keys and wraps around (TC-02)", () => {
    const onChange = setup("1:1");
    const first = screen.getByRole("radio", { name: "1:1" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("16:9");
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("3:4");
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith("16:9");
  });

  it("keeps extended ratios collapsed until asked (TC-03)", () => {
    setup("1:1");
    expect(screen.queryByRole("radio", { name: "21:9" })).toBeNull();
    const toggle = screen.getByRole("button", { name: /Mở rộng/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("radio")).toHaveLength(14);
  });

  it("opens the extended group when the current value lives there (TC-03)", () => {
    setup("21:9");
    expect(screen.getByRole("radio", { name: "21:9" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /Mở rộng/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });
});
