// /lib/features/novelcrafter/pruneStoryBibleForStream.ts
// Strips unused Story Bible fields before POST /api/novelcrafter/stream to save bandwidth (NC-38)

import { isCodexCardMatchedInContext } from "./codexMatcher";
import type { NovelcrafterContextNode } from "./contextNodes";
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
  synopsis: string,
  contextNodes?: readonly NovelcrafterContextNode[]
): boolean {
  const synopsisEmpty = !synopsis.trim();
  if (feature === "bible") {
    if (bibleTarget === "synopsis" || bibleTarget === "outline") {
      return true;
    }
    if (bibleTarget === "draft" && synopsisEmpty) {
      return contextNodes === undefined || contextNodes.includes("synopsis");
    }
  }
  if (contextNodes !== undefined) {
    return contextNodes.includes("synopsis") && synopsisEmpty;
  }
  return feature === "write" && writeMode === "first_draft_rough" && synopsisEmpty;
}

export function pruneStoryBibleForStream(
  storyBible: StoryBible,
  feature: NovelcrafterFeatureSlot,
  bibleTarget?: NovelcrafterBibleTarget,
  activeContextText?: string,
  writeMode?: NovelcrafterWriteMode,
  contextNodes?: readonly NovelcrafterContextNode[]
): StoryBible {
  const needsBraindump = needsBraindumpForStream(
    feature,
    bibleTarget,
    writeMode,
    storyBible.synopsis,
    contextNodes
  );
  const isGlobalBibleTarget =
    feature === "bible" &&
    (bibleTarget === "synopsis" ||
      bibleTarget === "characters" ||
      bibleTarget === "worldbuilding" ||
      bibleTarget === "outline");
  const effectiveContext =
    isGlobalBibleTarget || activeContextText === undefined ? undefined : activeContextText;

  const nodeSet = contextNodes !== undefined ? new Set(contextNodes) : null;
  const isTarget = (target: NovelcrafterBibleTarget) =>
    feature === "bible" && bibleTarget === target;

  const keepSynopsis = !nodeSet || nodeSet.has("synopsis") || isTarget("synopsis");
  const keepOutline = !nodeSet || nodeSet.has("outline") || isTarget("outline");
  const keepStyle = !nodeSet || nodeSet.has("style");
  const keepGenre = !nodeSet || nodeSet.has("genre");
  const keepCharacters =
    storyBible.charactersVisibleToAI &&
    (!nodeSet || nodeSet.has("characters") || isTarget("characters"));
  const keepWorldbuilding =
    storyBible.worldbuildingVisibleToAI &&
    (!nodeSet || nodeSet.has("worldbuilding") || isTarget("worldbuilding"));

  return {
    ...storyBible,
    braindump: needsBraindump ? storyBible.braindump : "",
    synopsis: keepSynopsis ? storyBible.synopsis : "",
    outline: keepOutline ? storyBible.outline : "",
    outlineItems: keepOutline ? storyBible.outlineItems : [],
    style: keepStyle ? storyBible.style : "",
    genre: keepGenre ? storyBible.genre : "",
    characters: keepCharacters ? storyBible.characters : "",
    characterCards: keepCharacters
      ? (storyBible.characterCards || []).filter((c) =>
          effectiveContext !== undefined
            ? isCodexCardMatchedInContext(c, effectiveContext)
            : c.visibleToAI !== false
        )
      : [],
    worldbuilding: keepWorldbuilding ? storyBible.worldbuilding : "",
    worldElements: keepWorldbuilding
      ? (storyBible.worldElements || []).filter((w) =>
          effectiveContext !== undefined
            ? isCodexCardMatchedInContext(w, effectiveContext)
            : w.visibleToAI !== false
        )
      : [],
  };
}
