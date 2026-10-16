// /app/features/novelcrafter/components/NovelcrafterHistoryCardItem.test.tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NovelcrafterHistoryCard } from "@/lib/features/novelcrafter/types";
import { CARD_TRUNCATION_NOTICE } from "@/lib/features/novelcrafter/stateLimits";
import NovelcrafterHistoryCardItem from "./NovelcrafterHistoryCardItem";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

describe("NovelcrafterHistoryCardItem", () => {
  const baseCard: NovelcrafterHistoryCard = {
    id: "card-101",
    feature: "write",
    subLabel: "Auto Write",
    content: `${"Long generated chapter prose paragraph. ".repeat(30)}${CARD_TRUNCATION_NOTICE}`,
    model: "gemini-4-argon",
    routedModel: "google/gemini-4-argon",
    finishReason: "stop",
    gemName: "Master Storyteller",
    personaName: "Noir Detective",
    createdAt: 1700000000000,
  };

  it("TC-11, TC-12 & TC-23: renders model badge, toggles expand/collapse with aria-expanded, and strips truncation notice on append", () => {
    const onAppend = vi.fn();
    const onReplace = vi.fn();
    const onApplyBible = vi.fn();
    const onDelete = vi.fn();
    const onCopy = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <NovelcrafterHistoryCardItem
        card={baseCard}
        forceExpanded={false}
        hasActiveSelection={true}
        onAppendToChapter={onAppend}
        onReplaceSelection={onReplace}
        onApplyToBible={onApplyBible}
        onDeleteCard={onDelete}
        onCopy={onCopy}
      />
    );

    // Model badge is rendered
    expect(screen.getByText(/Gemini 4/i)).toBeDefined();

    // Expand toggle button has aria-expanded="false" (since content length > 380)
    const expandBtn = screen.getByRole("button", { name: "novelcrafterCardExpand" });
    expect(expandBtn.getAttribute("aria-expanded")).toBe("false");

    // Re-render with forceExpanded={true}
    rerender(
      <NovelcrafterHistoryCardItem
        card={baseCard}
        forceExpanded={true}
        hasActiveSelection={true}
        onAppendToChapter={onAppend}
        onReplaceSelection={onReplace}
        onApplyToBible={onApplyBible}
        onDeleteCard={onDelete}
        onCopy={onCopy}
      />
    );
    const collapseBtn = screen.getByRole("button", { name: "novelcrafterCardCollapse" });
    expect(collapseBtn.getAttribute("aria-expanded")).toBe("true");

    // Append strips truncation notice
    const appendBtn = screen.getByRole("button", { name: "novelcrafterAppendChapter" });
    fireEvent.click(appendBtn);
    expect(onAppend).toHaveBeenCalledTimes(1);
    const appendedText = onAppend.mock.calls[0][0] as string;
    expect(appendedText.includes(CARD_TRUNCATION_NOTICE.trim())).toBe(false);
  });
});
