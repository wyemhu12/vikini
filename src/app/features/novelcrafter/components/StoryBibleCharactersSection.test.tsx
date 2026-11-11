// /app/features/novelcrafter/components/StoryBibleCharactersSection.test.tsx
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryBibleSchema } from "@/lib/features/novelcrafter/types";
import { StoryBibleCharacterCardsList } from "./StoryBibleCharactersSection";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("StoryBibleCharactersSection & CharacterPanel (5C TC-05)", () => {
  it("selects character card with aria-pressed, toggles per-field visibility, and opens mentioned chapter", () => {
    const onUpdateStoryBible = vi.fn();
    const onOpenChapter = vi.fn();
    const onSelectCharacter = vi.fn();
    const storyBible = StoryBibleSchema.parse({
      characterCards: [
        {
          id: "c1",
          name: "Lam",
          role: "Nhân vật chính",
          traits: "Kiệm lời",
          visibleToAI: true,
        },
        {
          id: "c2",
          name: "Ông Tư",
          role: "Lái đò",
          appearance: "Gầy, da sạm",
          traits: "Chậm rãi",
          secret: "Người gửi thư",
          visibleToAI: true,
        },
      ],
    });

    const chapters = [
      {
        id: "chap-1",
        title: "Chương 1",
        content: "Ông Tư chèo đò qua sông.",
        scenes: "",
        summary: "",
      },
    ];

    const { rerender } = render(
      <StoryBibleCharacterCardsList
        storyBible={storyBible}
        onUpdateStoryBible={onUpdateStoryBible}
        chapters={chapters}
        selectedCharacterId="c1"
        onSelectCharacter={onSelectCharacter}
        onOpenChapter={onOpenChapter}
        renderInlinePanel
      />
    );

    const card1 = screen.getByTestId("character-card-c1");
    const card2 = screen.getByTestId("character-card-c2");
    expect(card1).toHaveAttribute("aria-pressed", "true");
    expect(card2).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(card2);
    expect(onSelectCharacter).toHaveBeenCalledWith("c2");

    rerender(
      <StoryBibleCharacterCardsList
        storyBible={storyBible}
        onUpdateStoryBible={onUpdateStoryBible}
        chapters={chapters}
        selectedCharacterId="c2"
        onSelectCharacter={onSelectCharacter}
        onOpenChapter={onOpenChapter}
        renderInlinePanel
      />
    );

    expect(screen.getByTestId("character-card-c2")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("character-card-c2").className).toContain("border-(--accent)");

    const appearanceField = screen.getByTestId("character-field-appearance");
    const toggleBtn = within(appearanceField).getByRole("switch");
    expect(toggleBtn).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggleBtn);

    expect(onUpdateStoryBible).toHaveBeenCalledWith({
      characterCards: expect.arrayContaining([
        expect.objectContaining({
          id: "c2",
          appearanceVisibleToAI: false,
        }),
      ]),
    });

    // Secret field defaults to hidden from AI (aria-checked="false")
    const secretField = screen.getByTestId("character-field-secret");
    expect(within(secretField).getByRole("switch")).toHaveAttribute("aria-checked", "false");

    // Clicking chapter mention chip invokes onOpenChapter
    const mentionBtn = screen.getByTestId("character-mention-prose-chap-1");
    fireEvent.click(mentionBtn);
    expect(onOpenChapter).toHaveBeenCalledWith("chap-1");
  });
});
