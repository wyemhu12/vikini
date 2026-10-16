// /lib/features/novelcrafter/stateLimits.ts
// Field-level sanitization and non-destructive clamping to prevent whole-story resets (NC-01)

import { DEFAULT_MODEL } from "@/lib/core/modelRegistry";
import {
  MAX_CHAPTERS,
  MAX_CHARACTER_CARDS,
  MAX_FEEDBACK_ITEMS_PER_CHAPTER,
  MAX_HISTORY_CARDS,
  MAX_OUTLINE_ITEMS,
  MAX_WORLD_ELEMENTS,
  NOVELCRAFTER_BIBLE_TARGETS,
  NOVELCRAFTER_FEATURE_SLOTS,
  NOVELCRAFTER_HISTORY_CARD_FEATURE_SLOTS,
  NOVELCRAFTER_POV_OPTIONS,
  NOVELCRAFTER_STYLE_MODES,
  NOVELCRAFTER_TENSE_OPTIONS,
  type NovelcrafterFeedbackItem,
  type StoryBibleCharacterCard,
  type StoryBibleOutlineItem,
  type StoryBibleWorldElement,
} from "./types";

export const FIELD_MAX_LENGTHS = {
  braindump: 50_000,
  genre: 2_000,
  style: 10_000,
  synopsis: 30_000,
  characters: 50_000,
  worldbuilding: 50_000,
  outline: 50_000,
  chapterTitle: 200,
  chapterScenes: 30_000,
  chapterExtraInstructions: 4_000,
  chapterContent: 150_000,
  feedbackQuote: 10_000,
  feedbackComment: 10_000,
  feedbackSuggestion: 15_000,
  feedbackReply: 2_000,
  historyCardContent: 150_000,
  historyCardThinking: 100_000,
} as const;

export function truncateText(val: unknown, max: number, fallback = ""): string {
  if (typeof val !== "string") return fallback;
  return val.length > max ? val.slice(0, max) : val;
}

export const CARD_TRUNCATION_NOTICE =
  "\n\n[⚠️ Đã cắt bớt do vượt giới hạn độ dài thẻ (150.000 ký tự)]";

export function truncateTextWithNotice(
  val: string,
  max: number,
  notice = CARD_TRUNCATION_NOTICE
): string {
  if (val.length <= max) return val;
  return val.slice(0, Math.max(0, max - notice.length)) + notice;
}

export function stripCardTruncationNotice(val: string): string {
  if (!val) return "";
  return val.replace(/\n\n\[⚠️ Đã cắt bớt[^\]]*\]\s*$/u, "");
}

export function normalizeFeedbackItems(raw: unknown): NovelcrafterFeedbackItem[] {
  if (!Array.isArray(raw)) return [];
  const items: NovelcrafterFeedbackItem[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const comment = truncateText(obj.comment, FIELD_MAX_LENGTHS.feedbackComment).trim();
    if (!comment) continue;
    const id = truncateText(obj.id, 100, `fb-${i + 1}`).trim() || `fb-${i + 1}`;
    const category = truncateText(obj.category, 80, "Editorial").trim() || "Editorial";
    const status = obj.status === "resolved" ? "resolved" : "open";
    const rating = obj.rating === "up" || obj.rating === "down" ? obj.rating : undefined;
    const userReplyRaw = truncateText(obj.userReply, FIELD_MAX_LENGTHS.feedbackReply).trim();
    items.push({
      id,
      category,
      quote: truncateText(obj.quote, FIELD_MAX_LENGTHS.feedbackQuote),
      comment,
      suggestion: truncateText(obj.suggestion, FIELD_MAX_LENGTHS.feedbackSuggestion),
      status,
      ...(rating ? { rating } : {}),
      ...(userReplyRaw ? { userReply: userReplyRaw } : {}),
      createdAt:
        typeof obj.createdAt === "number" && Number.isFinite(obj.createdAt) && obj.createdAt >= 0
          ? Math.floor(obj.createdAt)
          : 0,
    });
  }
  if (items.length <= MAX_FEEDBACK_ITEMS_PER_CHAPTER) return items;
  const openItems = items.filter((item) => item.status === "open");
  const resolvedItems = items.filter((item) => item.status === "resolved");
  return [...openItems, ...resolvedItems].slice(0, MAX_FEEDBACK_ITEMS_PER_CHAPTER);
}

function normalizeCharacterCards(raw: unknown): StoryBibleCharacterCard[] {
  if (!Array.isArray(raw)) return [];
  const cards: StoryBibleCharacterCard[] = [];
  for (let i = 0; i < raw.length && cards.length < MAX_CHARACTER_CARDS; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const name = truncateText(obj.name, 150).trim();
    if (!name) continue;
    cards.push({
      id: truncateText(obj.id, 100, `char-${i + 1}`).trim() || `char-${i + 1}`,
      name,
      role: truncateText(obj.role, 150),
      traits: truncateText(obj.traits, 4_000),
      visibleToAI: obj.visibleToAI !== false,
    });
  }
  return cards;
}

function normalizeWorldElements(raw: unknown): StoryBibleWorldElement[] {
  if (!Array.isArray(raw)) return [];
  const elements: StoryBibleWorldElement[] = [];
  for (let i = 0; i < raw.length && elements.length < MAX_WORLD_ELEMENTS; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const name = truncateText(obj.name, 150).trim();
    if (!name) continue;
    elements.push({
      id: truncateText(obj.id, 100, `world-${i + 1}`).trim() || `world-${i + 1}`,
      name,
      category: truncateText(obj.category, 100),
      description: truncateText(obj.description, 4_000),
      visibleToAI: obj.visibleToAI !== false,
    });
  }
  return elements;
}

function normalizeOutlineItems(raw: unknown): StoryBibleOutlineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: StoryBibleOutlineItem[] = [];
  for (let i = 0; i < raw.length && items.length < MAX_OUTLINE_ITEMS; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const title = truncateText(obj.title, 200).trim();
    if (!title) continue;
    const linked = truncateText(obj.linkedChapterId, 100).trim();
    items.push({
      id: truncateText(obj.id, 100, `out-${i + 1}`).trim() || `out-${i + 1}`,
      type: obj.type === "act" ? "act" : "chapter",
      title,
      summary: truncateText(obj.summary, 4_000),
      ...(linked ? { linkedChapterId: linked } : {}),
    });
  }
  return items;
}

function pickEnum<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === "string" && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

export function coerceStoryStateToLimits(
  raw: unknown,
  defaultChapterTitle = "Chapter 1"
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const now = Date.now();

  const rawBible =
    root.storyBible && typeof root.storyBible === "object"
      ? (root.storyBible as Record<string, unknown>)
      : {};

  const storyBible = {
    braindump: truncateText(rawBible.braindump, FIELD_MAX_LENGTHS.braindump),
    genre: truncateText(rawBible.genre, FIELD_MAX_LENGTHS.genre),
    style: truncateText(rawBible.style, FIELD_MAX_LENGTHS.style),
    styleMode: pickEnum(rawBible.styleMode, NOVELCRAFTER_STYLE_MODES, "custom"),
    pov: pickEnum(rawBible.pov, NOVELCRAFTER_POV_OPTIONS, "third_person_limited"),
    tense: pickEnum(rawBible.tense, NOVELCRAFTER_TENSE_OPTIONS, "past"),
    synopsis: truncateText(rawBible.synopsis, FIELD_MAX_LENGTHS.synopsis),
    characters: truncateText(rawBible.characters, FIELD_MAX_LENGTHS.characters),
    charactersVisibleToAI: rawBible.charactersVisibleToAI !== false,
    characterCards: normalizeCharacterCards(rawBible.characterCards),
    worldbuilding: truncateText(rawBible.worldbuilding, FIELD_MAX_LENGTHS.worldbuilding),
    worldbuildingVisibleToAI: rawBible.worldbuildingVisibleToAI !== false,
    worldElements: normalizeWorldElements(rawBible.worldElements),
    outline: truncateText(rawBible.outline, FIELD_MAX_LENGTHS.outline),
    outlineItems: normalizeOutlineItems(rawBible.outlineItems),
  };

  const rawChapters = Array.isArray(root.chapters) ? root.chapters : [];
  const chapters: Array<Record<string, unknown>> = [];
  for (let i = 0; i < rawChapters.length && chapters.length < MAX_CHAPTERS; i += 1) {
    const ch = rawChapters[i];
    if (!ch || typeof ch !== "object") continue;
    const c = ch as Record<string, unknown>;
    const fallbackTitle = `${defaultChapterTitle} ${i + 1}`;
    const id = truncateText(c.id, 100, `ch-${i + 1}`).trim() || `ch-${i + 1}`;
    const title =
      truncateText(c.title, FIELD_MAX_LENGTHS.chapterTitle, fallbackTitle).trim() || fallbackTitle;
    chapters.push({
      id,
      title,
      scenes: truncateText(c.scenes, FIELD_MAX_LENGTHS.chapterScenes),
      extraInstructions: truncateText(
        c.extraInstructions,
        FIELD_MAX_LENGTHS.chapterExtraInstructions
      ),
      content: truncateText(c.content, FIELD_MAX_LENGTHS.chapterContent),
      feedbackItems: normalizeFeedbackItems(c.feedbackItems),
      updatedAt:
        typeof c.updatedAt === "number" && Number.isFinite(c.updatedAt) && c.updatedAt >= 0
          ? Math.floor(c.updatedAt)
          : now,
    });
  }

  if (chapters.length === 0) {
    chapters.push({
      id: "ch-1",
      title: defaultChapterTitle,
      scenes: "",
      extraInstructions: "",
      content: "",
      feedbackItems: [],
      updatedAt: now,
    });
  }

  const rawCards = Array.isArray(root.historyCards) ? root.historyCards : [];
  const historyCards: Array<Record<string, unknown>> = [];
  for (let i = 0; i < rawCards.length && historyCards.length < MAX_HISTORY_CARDS; i += 1) {
    const card = rawCards[i];
    if (!card || typeof card !== "object") continue;
    const hc = card as Record<string, unknown>;
    if (
      typeof hc.feature !== "string" ||
      !(NOVELCRAFTER_HISTORY_CARD_FEATURE_SLOTS as readonly string[]).includes(hc.feature)
    ) {
      continue;
    }
    const feature = hc.feature as (typeof NOVELCRAFTER_HISTORY_CARD_FEATURE_SLOTS)[number];
    const subSlot =
      typeof hc.subSlot === "string" &&
      (NOVELCRAFTER_FEATURE_SLOTS as readonly string[]).includes(hc.subSlot)
        ? hc.subSlot
        : undefined;
    const bibleTarget =
      typeof hc.bibleTarget === "string" &&
      (NOVELCRAFTER_BIBLE_TARGETS as readonly string[]).includes(hc.bibleTarget)
        ? hc.bibleTarget
        : undefined;
    const finishReason =
      hc.finishReason === "stop" ||
      hc.finishReason === "length" ||
      hc.finishReason === "safety" ||
      hc.finishReason === "error" ||
      hc.finishReason === "aborted"
        ? hc.finishReason
        : undefined;
    const rawContent = typeof hc.content === "string" ? hc.content : "";
    const rawThinking =
      typeof hc.thinking === "string"
        ? truncateText(hc.thinking, FIELD_MAX_LENGTHS.historyCardThinking)
        : undefined;

    historyCards.push({
      id: truncateText(hc.id, 100, `card-${i + 1}`).trim() || `card-${i + 1}`,
      feature,
      ...(subSlot ? { subSlot } : {}),
      ...(typeof hc.subLabel === "string" ? { subLabel: truncateText(hc.subLabel, 200) } : {}),
      ...(typeof hc.actionLabel === "string"
        ? { actionLabel: truncateText(hc.actionLabel, 200) }
        : {}),
      ...(bibleTarget ? { bibleTarget } : {}),
      ...(typeof hc.chapterId === "string" ? { chapterId: truncateText(hc.chapterId, 100) } : {}),
      content: truncateTextWithNotice(rawContent, FIELD_MAX_LENGTHS.historyCardContent),
      ...(rawThinking ? { thinking: rawThinking } : {}),
      model: truncateText(hc.model, 100, DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      ...(typeof hc.routedModel === "string" && hc.routedModel.trim()
        ? { routedModel: truncateText(hc.routedModel, 150).trim() }
        : {}),
      ...(finishReason ? { finishReason } : {}),
      gemName: typeof hc.gemName === "string" ? truncateText(hc.gemName, 200) : null,
      personaName: typeof hc.personaName === "string" ? truncateText(hc.personaName, 200) : null,
      createdAt:
        typeof hc.createdAt === "number" && Number.isFinite(hc.createdAt) && hc.createdAt >= 0
          ? Math.floor(hc.createdAt)
          : now,
    });
  }

  const rawRouting =
    root.routing && typeof root.routing === "object"
      ? (root.routing as Record<string, unknown>)
      : {};
  const rawFp =
    rawRouting.featurePersonas && typeof rawRouting.featurePersonas === "object"
      ? (rawRouting.featurePersonas as Record<string, unknown>)
      : {};
  const normSlot = (val: unknown) => truncateText(val, 100, "inherit").trim() || "inherit";

  const firstChapterId = String(chapters[0].id);
  const requestedActiveId = truncateText(root.activeChapterId, 100, firstChapterId).trim();
  const activeChapterId = chapters.some((c) => c.id === requestedActiveId)
    ? requestedActiveId
    : firstChapterId;

  return {
    version:
      typeof root.version === "number" && Number.isFinite(root.version) && root.version >= 1
        ? Math.floor(root.version)
        : 1,
    selectedModel: truncateText(root.selectedModel, 100, DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    isStoryBibleOpen: typeof root.isStoryBibleOpen === "boolean" ? root.isStoryBibleOpen : true,
    activeChapterId,
    storyBible,
    chapters,
    routing: {
      masterGemId:
        typeof rawRouting.masterGemId === "string" && rawRouting.masterGemId.trim()
          ? truncateText(rawRouting.masterGemId, 100).trim()
          : null,
      masterPersonaId:
        typeof rawRouting.masterPersonaId === "string" && rawRouting.masterPersonaId.trim()
          ? truncateText(rawRouting.masterPersonaId, 100).trim()
          : null,
      featurePersonas: {
        bible: normSlot(rawFp.bible),
        write: normSlot(rawFp.write),
        rewrite: normSlot(rawFp.rewrite),
        feedback: normSlot(rawFp.feedback),
        expand: normSlot(rawFp.expand),
        brainstorm: normSlot(rawFp.brainstorm),
      },
    },
    historyCards,
    updatedAt:
      typeof root.updatedAt === "number" && Number.isFinite(root.updatedAt) && root.updatedAt >= 0
        ? Math.floor(root.updatedAt)
        : now,
  };
}
