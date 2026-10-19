// /lib/features/novelcrafter/pruneStoryBibleForStream.ts
// Strips unused Story Bible fields before POST /api/novelcrafter/stream to save bandwidth (NC-38)

import { isCodexCardMatchedInContext } from "./codexMatcher";
import type { NovelcrafterBibleTarget, NovelcrafterFeatureSlot, StoryBible } from "./types";

export function pruneStoryBibleForStream(
  storyBible: StoryBible,
  feature: NovelcrafterFeatureSlot,
  bibleTarget?: NovelcrafterBibleTarget,
  activeContextText?: string
): StoryBible {
  const needsBraindump =
    feature === "bible" && (bibleTarget === "synopsis" || bibleTarget === "outline");
  const isGlobalBibleTarget =
    feature === "bible" &&
    (bibleTarget === "synopsis" ||
      bibleTarget === "characters" ||
      bibleTarget === "worldbuilding" ||
      bibleTarget === "outline");
  const effectiveContext =
    isGlobalBibleTarget || activeContextText === undefined ? undefined : activeContextText;

  return {
    ...storyBible,
    braindump: needsBraindump ? storyBible.braindump : "",
    characters: storyBible.charactersVisibleToAI ? storyBible.characters : "",
    characterCards: storyBible.charactersVisibleToAI
      ? (storyBible.characterCards || []).filter((c) =>
          effectiveContext !== undefined
            ? isCodexCardMatchedInContext(c, effectiveContext)
            : c.visibleToAI !== false
        )
      : [],
    worldbuilding: storyBible.worldbuildingVisibleToAI ? storyBible.worldbuilding : "",
    worldElements: storyBible.worldbuildingVisibleToAI
      ? (storyBible.worldElements || []).filter((w) =>
          effectiveContext !== undefined
            ? isCodexCardMatchedInContext(w, effectiveContext)
            : w.visibleToAI !== false
        )
      : [],
  };
}
