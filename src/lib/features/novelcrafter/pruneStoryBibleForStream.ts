// /lib/features/novelcrafter/pruneStoryBibleForStream.ts
// Strips unused Story Bible fields before POST /api/novelcrafter/stream to save bandwidth (NC-38)

import { isCodexCardMatchedInContext } from "./codexMatcher";
import type {
  NovelcrafterBibleTarget,
  NovelcrafterFeatureSlot,
  NovelcrafterWriteMode,
  StoryBible,
} from "./types";

export function needsBraindumpForStream(
  feature: NovelcrafterFeatureSlot,
  bibleTarget: NovelcrafterBibleTarget | undefined,
  writeMode: NovelcrafterWriteMode | undefined,
  synopsis: string
): boolean {
  if (feature === "bible") {
    return bibleTarget === "synopsis" || bibleTarget === "outline";
  }
  return feature === "write" && writeMode === "first_draft_rough" && !synopsis.trim();
}

export function pruneStoryBibleForStream(
  storyBible: StoryBible,
  feature: NovelcrafterFeatureSlot,
  bibleTarget?: NovelcrafterBibleTarget,
  activeContextText?: string,
  writeMode?: NovelcrafterWriteMode
): StoryBible {
  const needsBraindump = needsBraindumpForStream(
    feature,
    bibleTarget,
    writeMode,
    storyBible.synopsis
  );
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
