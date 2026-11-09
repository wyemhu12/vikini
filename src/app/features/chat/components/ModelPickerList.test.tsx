import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import ModelPickerList from "./ModelPickerList";
import { useLanguageStore } from "@/lib/store/languageStore";
import { useRecentModelsStore } from "@/lib/store/recentModelsStore";

function renderList(props: Partial<React.ComponentProps<typeof ModelPickerList>> = {}) {
  const onSelect = vi.fn();
  render(
    <ModelPickerList
      currentModelId="gemini-3.5-flash-lite"
      isModelAllowed={() => true}
      isLocalVisible={false}
      localStatus="disabled"
      onSelect={onSelect}
      {...props}
    />
  );
  return onSelect;
}

const optionNames = () =>
  screen.getAllByRole("option").map((o) => o.querySelector("span.truncate")?.textContent ?? "");

describe("ModelPickerList", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "vi" });
    useRecentModelsStore.setState({ recentModelIds: [] });
  });

  it("TC-07: search + arrow keys + Enter select the highlighted result", () => {
    const onSelect = renderList();
    const search = screen.getByRole("combobox", { name: "Tìm model" });
    fireEvent.change(search, { target: { value: "gemini" } });

    const names = optionNames();
    expect(names.length).toBeGreaterThan(1);
    expect(names.every((n) => n.toLowerCase().includes("gemini"))).toBe(true);

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "false");

    fireEvent.keyDown(search, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatch(/^gemini/);
  });

  it("TC-08: locked models cannot be chosen and explain why", () => {
    const onSelect = renderList({ isModelAllowed: (id) => !id.startsWith("claude") });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "claude" } });
    const option = screen.getAllByRole("option")[0];
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(within(option).getByText("Cần nâng hạng")).toBeInTheDocument();
    fireEvent.click(option);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("TC-09: filter buttons expose aria-pressed and narrow the list", () => {
    renderList();
    const reasoning = screen.getByRole("button", { name: "Suy luận" });
    fireEvent.click(reasoning);
    expect(reasoning).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Tất cả", "Nhanh", "Miễn phí"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.queryByRole("button", { name: "Máy cục bộ" })).toBeNull();
    expect(optionNames()).not.toContain("Gemini 3.5 Flash-Lite");
  });

  it("shows the recent group first and an empty message when nothing matches", () => {
    useRecentModelsStore.setState({ recentModelIds: ["gemini-3.8-flash"] });
    renderList();
    const groups = screen.getAllByRole("group");
    expect(groups[0]).toHaveAccessibleName("Gần đây");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzz-none" } });
    expect(screen.getByText("Không tìm thấy model phù hợp")).toBeInTheDocument();
  });
});
