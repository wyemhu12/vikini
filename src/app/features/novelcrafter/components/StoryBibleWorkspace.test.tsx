// /app/features/novelcrafter/components/StoryBibleWorkspace.test.tsx
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StoryBibleSchema } from "@/lib/features/novelcrafter/types";
import StoryBibleWorkspace from "./StoryBibleWorkspace";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("StoryBibleWorkspace full page (5B TC-08)", () => {
  it("renders under the page h1: title h2, sections h3", () => {
    render(
      <StoryBibleWorkspace
        storyBible={StoryBibleSchema.parse({})}
        onUpdateStoryBible={vi.fn()}
        embedded={false}
        onClose={vi.fn()}
        isStreaming={false}
        onTriggerStream={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
    expect(
      screen.getByRole("heading", { level: 2, name: "novelcrafterStoryBibleTitle" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(1);
  });

  it("5C TC-06: renders TOC aside with item counts and hidden-from-AI indicator, and opens character detail aside without adding h2", () => {
    const storyBible = StoryBibleSchema.parse({
      braindumpVisibleToAI: false,
      characterCards: [
        {
          id: "c1",
          name: "Ông Tư",
          role: "Lái đò",
          traits: "Chậm rãi",
          visibleToAI: true,
        },
      ],
    });

    render(
      <StoryBibleWorkspace
        storyBible={storyBible}
        onUpdateStoryBible={vi.fn()}
        embedded={false}
        onClose={vi.fn()}
        isStreaming={false}
        onTriggerStream={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const toc = screen.getByRole("complementary", { name: "novelcrafterBibleTocAria" });
    expect(within(toc).getByTestId("bible-toc-hidden-braindump")).toBeInTheDocument();
    expect(within(toc).getByTestId("bible-toc-count-characters")).toHaveTextContent("1");

    // Clicking character card opens right character detail aside while keeping exact heading contract (0 h1, 1 h2)
    fireEvent.click(screen.getByTestId("character-card-c1"));
    expect(
      screen.getByRole("complementary", { name: "novelcrafterCharacterDetailLabel Ông Tư" })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });
});
