// /lib/features/novelcrafter/storyBibleDependencies.ts
// Story Bible dependency selector (Sudowrite 8-Node Dependency Graph + Prompt Studio contextNodes)

import type { NovelcrafterContextNode } from "./contextNodes";
import { serializeStoryBibleWithStructuredCards } from "./storyBibleSerializer";
import type {
  NovelcrafterBibleTarget,
  NovelcrafterFeatureSlot,
  NovelcrafterPovOption,
  NovelcrafterTenseOption,
  NovelcrafterWriteMode,
  StoryBible,
} from "./types";

export interface SelectedBibleDependencies {
  braindump?: string;
  genre?: string;
  style?: string;
  pov?: NovelcrafterPovOption;
  tense?: NovelcrafterTenseOption;
  synopsis?: string;
  synopsisIsBraindumpFallback?: boolean;
  characters?: string;
  worldbuilding?: string;
  outline?: string;
}

/**
 * Select the exact Story Bible nodes required for a given feature/target
 * according to Sudowrite's 8-Node Dependency Graph, Braindump fallback rule,
 * Visibility Settings (charactersVisibleToAI, worldbuildingVisibleToAI),
 * or custom Prompt Studio contextNodes when provided.
 */
export function selectStoryBibleDependencies(
  feature: NovelcrafterFeatureSlot,
  storyBible: StoryBible,
  bibleTarget?: NovelcrafterBibleTarget,
  activeContextText?: string,
  writeMode?: NovelcrafterWriteMode,
  contextNodes?: readonly NovelcrafterContextNode[]
): SelectedBibleDependencies {
  const braindump = storyBible.braindump.trim();
  const genre = storyBible.genre.trim();
  const style = storyBible.style.trim();
  const pov = storyBible.pov || "third_person_limited";
  const tense = storyBible.tense || "past";
  const rawSynopsis = storyBible.synopsis.trim();
  const effectiveSynopsis = rawSynopsis || braindump;
  const synopsisIsBraindumpFallback = !rawSynopsis && Boolean(braindump);

  const isGlobalBibleTarget =
    feature === "bible" &&
    (bibleTarget === "synopsis" ||
      bibleTarget === "characters" ||
      bibleTarget === "worldbuilding" ||
      bibleTarget === "outline");
  const serialized = serializeStoryBibleWithStructuredCards(
    storyBible,
    isGlobalBibleTarget ? undefined : { activeContextText }
  );
  const visibleCharacters =
    storyBible.charactersVisibleToAI !== false ? serialized.charactersText : "";
  const visibleWorldbuilding =
    storyBible.worldbuildingVisibleToAI !== false ? serialized.worldbuildingText : "";
  const outline = serialized.outlineText;

  if (contextNodes !== undefined) {
    const nodeSet = new Set<NovelcrafterContextNode>(contextNodes);
    const includeBraindump =
      feature === "bible" && bibleTarget === "synopsis" && Boolean(braindump);
    return {
      ...(includeBraindump ? { braindump } : {}),
      ...(nodeSet.has("genre") && genre ? { genre } : {}),
      ...(nodeSet.has("style") && style ? { style } : {}),
      ...(nodeSet.has("pov_tense") ? { pov, tense } : {}),
      ...(nodeSet.has("synopsis") && effectiveSynopsis
        ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
        : {}),
      ...(nodeSet.has("characters") && visibleCharacters ? { characters: visibleCharacters } : {}),
      ...(nodeSet.has("worldbuilding") && visibleWorldbuilding
        ? { worldbuilding: visibleWorldbuilding }
        : {}),
      ...(nodeSet.has("outline") && outline ? { outline } : {}),
    };
  }

  if (feature === "bible") {
    switch (bibleTarget) {
      case "synopsis":
        return {
          ...(braindump ? { braindump } : {}),
          ...(genre ? { genre } : {}),
        };
      case "characters":
      case "worldbuilding":
        return {
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
        };
      case "outline":
        return {
          ...(genre ? { genre } : {}),
          pov,
          tense,
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
      case "scenes":
        return {
          ...(genre ? { genre } : {}),
          ...(style ? { style } : {}),
          pov,
          tense,
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
          ...(outline ? { outline } : {}),
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
      case "chapter_summary":
        return {
          ...(genre ? { genre } : {}),
          pov,
          tense,
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
      case "draft":
      default:
        return {
          ...(style ? { style } : {}),
          ...(genre ? { genre } : {}),
          pov,
          tense,
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
          ...(outline ? { outline } : {}),
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
    }
  }

  if (feature === "write" || feature === "expand") {
    const isRoughDraft = feature === "write" && writeMode === "first_draft_rough";
    return {
      ...(style ? { style } : {}),
      ...(genre ? { genre } : {}),
      pov,
      tense,
      ...(isRoughDraft && effectiveSynopsis
        ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
        : {}),
      ...(isRoughDraft && outline ? { outline } : {}),
      ...(visibleCharacters ? { characters: visibleCharacters } : {}),
      ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
    };
  }

  if (feature === "rewrite") {
    return {
      ...(style ? { style } : {}),
      ...(genre ? { genre } : {}),
      pov,
      tense,
    };
  }

  if (feature === "feedback") {
    return {
      ...(genre ? { genre } : {}),
      ...(style ? { style } : {}),
      pov,
      tense,
      ...(effectiveSynopsis ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback } : {}),
      ...(visibleCharacters ? { characters: visibleCharacters } : {}),
      ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
      ...(outline ? { outline } : {}),
    };
  }

  // feature === "brainstorm"
  return {
    ...(genre ? { genre } : {}),
    ...(effectiveSynopsis ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback } : {}),
    ...(visibleCharacters ? { characters: visibleCharacters } : {}),
    ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
  };
}
