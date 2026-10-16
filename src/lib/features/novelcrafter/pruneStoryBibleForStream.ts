// /lib/features/novelcrafter/pruneStoryBibleForStream.ts
// Strips unused Story Bible fields before POST /api/novelcrafter/stream to save bandwidth (NC-38)

import type { NovelcrafterBibleTarget, NovelcrafterFeatureSlot, StoryBible } from "./types";

export function pruneStoryBibleForStream(
  storyBible: StoryBible,
  feature: NovelcrafterFeatureSlot,
  bibleTarget?: NovelcrafterBibleTarget
): StoryBible {
  const needsBraindump =
    feature === "bible" && (bibleTarget === "synopsis" || bibleTarget === "outline");

  return {
    ...storyBible,
    braindump: needsBraindump ? storyBible.braindump : "",
    characters: storyBible.charactersVisibleToAI ? storyBible.characters : "",
    characterCards: storyBible.charactersVisibleToAI
      ? (storyBible.characterCards || []).filter((c) => c.visibleToAI !== false)
      : [],
    worldbuilding: storyBible.worldbuildingVisibleToAI ? storyBible.worldbuilding : "",
    worldElements: storyBible.worldbuildingVisibleToAI
      ? (storyBible.worldElements || []).filter((w) => w.visibleToAI !== false)
      : [],
  };
}
