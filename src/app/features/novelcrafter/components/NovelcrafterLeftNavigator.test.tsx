// /app/features/novelcrafter/components/NovelcrafterLeftNavigator.test.tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NovelcrafterLeftNavigator from "./NovelcrafterLeftNavigator";

const DICT: Record<string, string> = {
  novelcrafterStoryBibleTab: "Story Bible",
  novelcrafterCharactersLabel: "Nhân vật",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("NovelcrafterLeftNavigator (UX cleanup G4)", () => {
  it("TC-U07: Story Bible entries are links into the inline bible, without an on/off switch", () => {
    const onJumpToBibleSection = vi.fn();
    render(
      <NovelcrafterLeftNavigator
        isStoryBibleOpen={false}
        onToggleStoryBible={vi.fn()}
        onJumpToBibleSection={onJumpToBibleSection}
        chapters={[]}
        activeChapterId=""
        onSelectChapter={vi.fn()}
        onAddChapter={vi.fn()}
        onRenameChapter={vi.fn()}
        onDeleteChapter={vi.fn()}
      />
    );

    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Story Bible" }));
    expect(onJumpToBibleSection).toHaveBeenLastCalledWith("braindump");
    fireEvent.click(screen.getByRole("button", { name: "Nhân vật" }));
    expect(onJumpToBibleSection).toHaveBeenLastCalledWith("characters");
  });
});
