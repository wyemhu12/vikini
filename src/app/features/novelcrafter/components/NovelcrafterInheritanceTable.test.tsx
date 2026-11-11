// /app/features/novelcrafter/components/NovelcrafterInheritanceTable.test.tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { vi as viTranslations } from "@/lib/utils/translations/vi";
import type { NovelcrafterRoutingConfig } from "@/lib/features/novelcrafter/types";
import NovelcrafterInheritanceTable from "./NovelcrafterInheritanceTable";

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

describe("NovelcrafterInheritanceTable (Phase 5D TC-04)", () => {
  const baseRouting: NovelcrafterRoutingConfig = {
    masterGemId: "g1",
    masterPersonaId: "p1",
    featurePersonas: {
      bible: "inherit",
      write: "inherit",
      rewrite: "inherit",
      feedback: "p2",
      expand: "inherit",
      brainstorm: "none",
    },
    featureModels: {
      bible: "inherit",
      write: "inherit",
      rewrite: "inherit",
      feedback: "inherit",
      expand: "inherit",
      brainstorm: "inherit",
    },
  };

  it("renders a single h1, 2 master summary cards, 6 inheritance rows with override highlight, and updates persona/model slots", () => {
    const onUpdateRouting = vi.fn();
    const onUpdateFeaturePersonaSlot = vi.fn();
    const onUpdateFeatureModelSlot = vi.fn();

    render(
      <NovelcrafterInheritanceTable
        storyTitle="Gió mùa cuối"
        selectedModel="gemini-3.5-flash-lite"
        allowedModelIds={new Set(["gemini-3.5-flash-lite", "gemini-3.8-flash"])}
        routing={baseRouting}
        gems={[
          { id: "g1", name: "Văn xuôi trữ tình" },
          { id: "g2", name: "Trinh thám cổ điển" },
        ]}
        personas={[
          { id: "p1", name: "Nhà văn miền Tây" },
          { id: "p2", name: "Biên tập viên khó tính" },
        ]}
        onUpdateRouting={onUpdateRouting}
        onUpdateFeaturePersonaSlot={onUpdateFeaturePersonaSlot}
        onUpdateFeatureModelSlot={onUpdateFeatureModelSlot}
      />
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Gió mùa cuối")).toBeInTheDocument();

    // Master GEM card dropdown
    fireEvent.pointerDown(screen.getByRole("button", { name: /GEM tổng.*Văn xuôi trữ tình/i }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Trinh thám cổ điển" }));
    expect(onUpdateRouting).toHaveBeenCalledWith({ masterGemId: "g2" });

    // Overridden rows have bg-(--soft), inherited rows do not
    const writeRow = screen.getByTestId("inheritance-row-write");
    const feedbackRow = screen.getByTestId("inheritance-row-feedback");
    const brainstormRow = screen.getByTestId("inheritance-row-brainstorm");

    expect(writeRow.className).not.toContain("bg-(--soft)");
    expect(feedbackRow.className).toContain("bg-(--soft)");
    expect(brainstormRow.className).toContain("bg-(--soft)");

    // "AI sẽ nhận" column summaries
    expect(writeRow).toHaveTextContent("GEM tổng + Nhà văn miền Tây");
    expect(feedbackRow).toHaveTextContent("GEM tổng + Biên tập viên khó tính (ghi đè)");
    expect(brainstormRow).toHaveTextContent("Chỉ GEM tổng (tắt Persona)");

    // Change Persona and Model on Write slot
    fireEvent.change(screen.getByRole("combobox", { name: /Viết tiếp: Persona/i }), {
      target: { value: "none" },
    });
    expect(onUpdateFeaturePersonaSlot).toHaveBeenCalledWith("write", "none");

    fireEvent.change(screen.getByRole("combobox", { name: /Viết tiếp: Model/i }), {
      target: { value: "gemini-3.8-flash" },
    });
    expect(onUpdateFeatureModelSlot).toHaveBeenCalledWith("write", "gemini-3.8-flash");
  });
});
