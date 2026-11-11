// /lib/features/novelcrafter/storyBibleLimits.ts
// Story Bible field-level clamping and visibility normalization (Vikini 3.0 Phase 5C)

import {
  MAX_CHARACTER_CARDS,
  MAX_CODEX_ALIASES,
  MAX_CODEX_ALIAS_CHARS,
  MAX_OUTLINE_ITEMS,
  MAX_WORLD_ELEMENTS,
  NOVELCRAFTER_POV_OPTIONS,
  NOVELCRAFTER_STYLE_MODES,
  NOVELCRAFTER_TENSE_OPTIONS,
  type StoryBible,
  type StoryBibleCharacterCard,
  type StoryBibleOutlineItem,
  type StoryBibleWorldElement,
} from "./types";

export const CHARACTER_DETAIL_MAX_CHARS = 2_000 as const;

const BIBLE_TEXT_LIMITS = {
  braindump: 50_000,
  genre: 2_000,
  style: 10_000,
  synopsis: 30_000,
  characters: 50_000,
  worldbuilding: 50_000,
  outline: 50_000,
} as const;

function clampText(val: unknown, max: number, fallback = ""): string {
  if (typeof val !== "string") return fallback;
  return val.length > max ? val.slice(0, max) : val;
}

function pickEnumValue<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === "string" && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

export function normalizeBibleCodexAliases(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length && result.length < MAX_CODEX_ALIASES; i += 1) {
    const trimmed = clampText(raw[i], MAX_CODEX_ALIAS_CHARS).trim();
    if (!trimmed) continue;
    const key = trimmed.normalize("NFC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result.length > 0 ? result : undefined;
}

export function normalizeCharacterCards(raw: unknown): StoryBibleCharacterCard[] {
  if (!Array.isArray(raw)) return [];
  const cards: StoryBibleCharacterCard[] = [];
  for (let i = 0; i < raw.length && cards.length < MAX_CHARACTER_CARDS; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const name = clampText(obj.name, 150).trim();
    if (!name) continue;
    const aliases = normalizeBibleCodexAliases(obj.aliases);
    cards.push({
      id: clampText(obj.id, 100, `char-${i + 1}`).trim() || `char-${i + 1}`,
      name,
      role: clampText(obj.role, 150),
      traits: clampText(obj.traits, CHARACTER_DETAIL_MAX_CHARS),
      ...(typeof obj.traitsVisibleToAI === "boolean"
        ? { traitsVisibleToAI: obj.traitsVisibleToAI }
        : {}),
      ...(typeof obj.appearance === "string"
        ? { appearance: clampText(obj.appearance, CHARACTER_DETAIL_MAX_CHARS) }
        : {}),
      ...(typeof obj.appearanceVisibleToAI === "boolean"
        ? { appearanceVisibleToAI: obj.appearanceVisibleToAI }
        : {}),
      ...(typeof obj.relationships === "string"
        ? { relationships: clampText(obj.relationships, CHARACTER_DETAIL_MAX_CHARS) }
        : {}),
      ...(typeof obj.relationshipsVisibleToAI === "boolean"
        ? { relationshipsVisibleToAI: obj.relationshipsVisibleToAI }
        : {}),
      ...(typeof obj.secret === "string"
        ? { secret: clampText(obj.secret, CHARACTER_DETAIL_MAX_CHARS) }
        : {}),
      ...(typeof obj.secretVisibleToAI === "boolean"
        ? { secretVisibleToAI: obj.secretVisibleToAI }
        : {}),
      visibleToAI: obj.visibleToAI !== false,
      ...(aliases ? { aliases } : {}),
      ...(typeof obj.alwaysInclude === "boolean" ? { alwaysInclude: obj.alwaysInclude } : {}),
    });
  }
  return cards;
}

export function normalizeWorldElements(raw: unknown): StoryBibleWorldElement[] {
  if (!Array.isArray(raw)) return [];
  const elements: StoryBibleWorldElement[] = [];
  for (let i = 0; i < raw.length && elements.length < MAX_WORLD_ELEMENTS; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const name = clampText(obj.name, 150).trim();
    if (!name) continue;
    const aliases = normalizeBibleCodexAliases(obj.aliases);
    elements.push({
      id: clampText(obj.id, 100, `world-${i + 1}`).trim() || `world-${i + 1}`,
      name,
      category: clampText(obj.category, 100),
      description: clampText(obj.description, 4_000),
      visibleToAI: obj.visibleToAI !== false,
      ...(aliases ? { aliases } : {}),
      ...(typeof obj.alwaysInclude === "boolean" ? { alwaysInclude: obj.alwaysInclude } : {}),
    });
  }
  return elements;
}

export function normalizeOutlineItems(raw: unknown): StoryBibleOutlineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: StoryBibleOutlineItem[] = [];
  for (let i = 0; i < raw.length && items.length < MAX_OUTLINE_ITEMS; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const title = clampText(obj.title, 200).trim();
    if (!title) continue;
    const linked = clampText(obj.linkedChapterId, 100).trim();
    items.push({
      id: clampText(obj.id, 100, `out-${i + 1}`).trim() || `out-${i + 1}`,
      type: obj.type === "act" ? "act" : "chapter",
      title,
      summary: clampText(obj.summary, 4_000),
      ...(linked ? { linkedChapterId: linked } : {}),
    });
  }
  return items;
}

export function normalizeStoryBible(raw: unknown): StoryBible {
  const rawBible = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    braindump: clampText(rawBible.braindump, BIBLE_TEXT_LIMITS.braindump),
    ...(typeof rawBible.braindumpVisibleToAI === "boolean"
      ? { braindumpVisibleToAI: rawBible.braindumpVisibleToAI }
      : {}),
    genre: clampText(rawBible.genre, BIBLE_TEXT_LIMITS.genre),
    ...(typeof rawBible.genreVisibleToAI === "boolean"
      ? { genreVisibleToAI: rawBible.genreVisibleToAI }
      : {}),
    style: clampText(rawBible.style, BIBLE_TEXT_LIMITS.style),
    ...(typeof rawBible.styleVisibleToAI === "boolean"
      ? { styleVisibleToAI: rawBible.styleVisibleToAI }
      : {}),
    styleMode: pickEnumValue(rawBible.styleMode, NOVELCRAFTER_STYLE_MODES, "custom"),
    pov: pickEnumValue(rawBible.pov, NOVELCRAFTER_POV_OPTIONS, "third_person_limited"),
    tense: pickEnumValue(rawBible.tense, NOVELCRAFTER_TENSE_OPTIONS, "past"),
    synopsis: clampText(rawBible.synopsis, BIBLE_TEXT_LIMITS.synopsis),
    ...(typeof rawBible.synopsisVisibleToAI === "boolean"
      ? { synopsisVisibleToAI: rawBible.synopsisVisibleToAI }
      : {}),
    characters: clampText(rawBible.characters, BIBLE_TEXT_LIMITS.characters),
    charactersVisibleToAI: rawBible.charactersVisibleToAI !== false,
    characterCards: normalizeCharacterCards(rawBible.characterCards),
    worldbuilding: clampText(rawBible.worldbuilding, BIBLE_TEXT_LIMITS.worldbuilding),
    worldbuildingVisibleToAI: rawBible.worldbuildingVisibleToAI !== false,
    worldElements: normalizeWorldElements(rawBible.worldElements),
    outline: clampText(rawBible.outline, BIBLE_TEXT_LIMITS.outline),
    ...(typeof rawBible.outlineVisibleToAI === "boolean"
      ? { outlineVisibleToAI: rawBible.outlineVisibleToAI }
      : {}),
    outlineItems: normalizeOutlineItems(rawBible.outlineItems),
  };
}
