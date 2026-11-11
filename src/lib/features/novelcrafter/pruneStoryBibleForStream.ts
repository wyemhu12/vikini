// /lib/features/novelcrafter/pruneStoryBibleForStream.ts
// Strips unused or hidden Story Bible fields before POST /api/novelcrafter/stream (NC-38 / 5C)

import { isCodexCardMatchedInContext } from "./codexMatcher";
import type { NovelcrafterContextNode } from "./contextNodes";
import { isCharacterFieldVisibleToAi } from "./storyBibleSerializer";
import type {
  NovelcrafterBibleTarget,
  NovelcrafterFeatureSlot,
  NovelcrafterWriteMode,
  StoryBible,
  StoryBibleCharacterCard,
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

function pruneCharacterCardFields(card: StoryBibleCharacterCard): StoryBibleCharacterCard {
  const next: StoryBibleCharacterCard = {
    ...card,
    traits: isCharacterFieldVisibleToAi(card, "traits") ? card.traits : "",
  };
  if (!isCharacterFieldVisibleToAi(card, "appearance")) {
    delete next.appearance;
  }
  if (!isCharacterFieldVisibleToAi(card, "relationships")) {
    delete next.relationships;
  }
  if (!isCharacterFieldVisibleToAi(card, "secret")) {
    delete next.secret;
  }
  return next;
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

  const allowSynopsis = storyBible.synopsisVisibleToAI !== false;
  const keepBraindump =
    storyBible.braindumpVisibleToAI !== false &&
    needsBraindump &&
    (isTarget("synopsis") || isTarget("outline") || allowSynopsis);
  const keepSynopsis =
    isTarget("synopsis") || (allowSynopsis && (!nodeSet || nodeSet.has("synopsis")));
  const keepOutline =
    isTarget("outline") ||
    (storyBible.outlineVisibleToAI !== false && (!nodeSet || nodeSet.has("outline")));
  const keepStyle = storyBible.styleVisibleToAI !== false && (!nodeSet || nodeSet.has("style"));
  const keepGenre = storyBible.genreVisibleToAI !== false && (!nodeSet || nodeSet.has("genre"));
  const keepCharacters =
    storyBible.charactersVisibleToAI !== false &&
    (!nodeSet || nodeSet.has("characters") || isTarget("characters"));
  const keepWorldbuilding =
    storyBible.worldbuildingVisibleToAI !== false &&
    (!nodeSet || nodeSet.has("worldbuilding") || isTarget("worldbuilding"));

  return {
    ...storyBible,
    braindump: keepBraindump ? storyBible.braindump : "",
    synopsis: keepSynopsis ? storyBible.synopsis : "",
    outline: keepOutline ? storyBible.outline : "",
    outlineItems: keepOutline ? storyBible.outlineItems : [],
    style: keepStyle ? storyBible.style : "",
    genre: keepGenre ? storyBible.genre : "",
    characters: keepCharacters ? storyBible.characters : "",
    characterCards: keepCharacters
      ? (storyBible.characterCards || [])
          .filter((c) =>
            effectiveContext !== undefined
              ? isCodexCardMatchedInContext(c, effectiveContext)
              : c.visibleToAI !== false
          )
          .map(pruneCharacterCardFields)
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
