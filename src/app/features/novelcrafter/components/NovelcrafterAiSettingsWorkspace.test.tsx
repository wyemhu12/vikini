// /app/features/novelcrafter/components/NovelcrafterAiSettingsWorkspace.test.tsx
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { vi as viTranslations } from "@/lib/utils/translations/vi";
import { createDefaultStoryState } from "@/lib/features/novelcrafter/types";
import NovelcrafterAiSettingsWorkspace from "./NovelcrafterAiSettingsWorkspace";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: keyof typeof viTranslations) => viTranslations[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("../../gems/stores/useGemStore", () => ({
  useGemStore: () => ({ openGemModal: vi.fn() }),
}));

vi.mock("../../personas/stores/usePersonaStore", () => ({
  usePersonaStore: () => ({ openPersonaModal: vi.fn() }),
}));

describe("NovelcrafterAiSettingsWorkspace (Phase 5D TC-05)", () => {
  it("renders inheritance table + Prompt Studio aside, navigates AI actions with keyboard, toggles context nodes, and closes on Escape", async () => {
    const onClose = vi.fn();
    const state = createDefaultStoryState();

    render(
      <NovelcrafterAiSettingsWorkspace
        storyTitle="Gió mùa cuối"
        selectedModel={state.selectedModel}
        allowedModelIds={new Set([state.selectedModel])}
        routing={state.routing}
        gems={[{ id: "g1", name: "Văn xuôi trữ tình" }]}
        personas={[{ id: "p1", name: "Nhà văn miền Tây" }]}
        onUpdateRouting={vi.fn()}
        onUpdateFeaturePersonaSlot={vi.fn()}
        onUpdateFeatureModelSlot={vi.fn()}
        onClose={onClose}
      />
    );

    const promptStudioAside = await screen.findByRole("complementary", {
      name: /Prompt Studio/i,
    });
    expect(promptStudioAside).toBeInTheDocument();

    const listbox = await screen.findByRole("listbox", { name: /Hành động AI/i });
    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBeGreaterThan(10);
    const initialIdx = options.findIndex((o) => o.getAttribute("aria-selected") === "true");
    expect(initialIdx).toBeGreaterThanOrEqual(0);

    // Keyboard navigation on listbox moves selection to next action and End
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    await waitFor(() => {
      expect(within(listbox).getAllByRole("option")[initialIdx + 1]).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });

    fireEvent.keyDown(listbox, { key: "End" });
    await waitFor(() => {
      const latestOptions = within(listbox).getAllByRole("option");
      expect(latestOptions[latestOptions.length - 1]).toHaveAttribute("aria-selected", "true");
    });

    // Token badge is rendered in XML preview
    expect(screen.getByText(/≈.*token/i)).toBeInTheDocument();

    // Toggle an optional context checkbox
    const checkboxes = promptStudioAside.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    expect(checkboxes.length).toBeGreaterThan(0);
    const firstOptional = checkboxes[0] as HTMLInputElement;
    const beforeChecked = firstOptional.checked;
    fireEvent.click(firstOptional);
    expect(firstOptional.checked).toBe(!beforeChecked);

    // Escape closes workspace when no modal/dropdown is open
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
