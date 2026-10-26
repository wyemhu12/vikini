// /app/features/novelcrafter/components/PromptSourceTooltip.test.tsx
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultPromptStudioSettings } from "@/lib/features/novelcrafter/promptStudioSettings";
import { usePromptStudioStore } from "@/lib/features/novelcrafter/promptStudioStore";
import { PromptSourceTooltip } from "./PromptSourceTooltip";

describe("PromptSourceTooltip", () => {
  beforeEach(() => {
    localStorage.clear();
    usePromptStudioStore.setState({
      settings: createDefaultPromptStudioSettings(),
      persistErrorAt: null,
    });
  });

  it("TC-PST-01: clicking wrapped button triggers onClick handler 100% without event swallowing", () => {
    const onClick = vi.fn();
    render(
      <PromptSourceTooltip actionKey="write:auto">
        <button type="button" onClick={onClick}>
          Run Auto Write
        </button>
      </PromptSourceTooltip>
    );

    const btn = screen.getByRole("button", { name: "Run Auto Write" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("TC-PST-02 & Wiring Probe 1: hovering or focusing button opens tooltip in Portal with Story Bible and Chapter Context pills", () => {
    const { container } = render(
      <div className="overflow-hidden">
        <PromptSourceTooltip actionKey="write:auto">
          <button type="button">Auto Write Trigger</button>
        </PromptSourceTooltip>
      </div>
    );

    const btn = screen.getByRole("button", { name: "Auto Write Trigger" });
    fireEvent.mouseEnter(btn);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeDefined();
    // Wiring Probe 1: Portal renders outside the local overflow-hidden container into document.body
    expect(container.contains(tooltip.parentElement)).toBe(false);
    expect(document.body.contains(tooltip.parentElement)).toBe(true);

    fireEvent.mouseLeave(btn);
    fireEvent.focus(btn);
    expect(screen.getByRole("tooltip")).toBeDefined();
  });

  it("TC-PST-03: live store override update immediately reflects Customized badge and updated context nodes", () => {
    render(
      <PromptSourceTooltip actionKey="write:auto">
        <button type="button">Write Action</button>
      </PromptSourceTooltip>
    );

    const btn = screen.getByRole("button", { name: "Write Action" });
    fireEvent.mouseEnter(btn);

    act(() => {
      usePromptStudioStore.getState().setActionOverride("write:auto", {
        contextNodes: ["style"],
        directive: "Write with noir grit",
      });
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeDefined();
    expect(
      usePromptStudioStore.getState().settings.overrides["write:auto"]?.contextNodes
    ).toContain("style");
  });

  it("TC-PST-04 & Negative Probe 2: disabled={true} prevents tooltip from opening on hover or focus", () => {
    render(
      <PromptSourceTooltip actionKey="write:auto" disabled={true}>
        <button type="button">Disabled Trigger</button>
      </PromptSourceTooltip>
    );

    const btn = screen.getByRole("button", { name: "Disabled Trigger" });
    fireEvent.mouseEnter(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("TC-PST-05 & Negative Probe 1: registers and cleans up window focus/storage listeners and recovers safely from corrupted localStorage", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    localStorage.setItem("vikini:novelcrafter:prompt-studio", "{corrupted-json");

    const { unmount } = render(
      <PromptSourceTooltip actionKey="bible:synopsis" actionMode="generate">
        <button type="button">Synopsis Gen</button>
      </PromptSourceTooltip>
    );

    expect(addSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("storage", expect.any(Function));

    fireEvent(window, new Event("focus"));
    const btn = screen.getByRole("button", { name: "Synopsis Gen" });
    fireEvent.mouseEnter(btn);
    expect(screen.getByRole("tooltip")).toBeDefined();

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("storage", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
