// /lib/features/novelcrafter/contextNodes.ts
// Canonical context node identifiers and normalizer for Novelcrafter Prompt Studio

export const NOVELCRAFTER_CONTEXT_NODES = [
  "synopsis",
  "outline",
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "pov_tense",
  "story_so_far",
  "scenes",
  "previous_chapter_continuity",
  "preceding_prose",
] as const;

export type NovelcrafterContextNode = (typeof NOVELCRAFTER_CONTEXT_NODES)[number];

export const MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS = 4_000 as const;

const VALID_NODE_SET: ReadonlySet<string> = new Set(NOVELCRAFTER_CONTEXT_NODES);

export function isNovelcrafterContextNode(val: unknown): val is NovelcrafterContextNode {
  return typeof val === "string" && VALID_NODE_SET.has(val);
}

/**
 * Normalize an untrusted context-node array:
 * - Non-array returns undefined (meaning "use defaults").
 * - Array is filtered to known nodes, deduplicated, and ordered canonically.
 */
export function normalizeContextNodes(raw: unknown): NovelcrafterContextNode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const selected = new Set<NovelcrafterContextNode>();
  for (const item of raw) {
    if (isNovelcrafterContextNode(item)) {
      selected.add(item);
    }
  }
  return NOVELCRAFTER_CONTEXT_NODES.filter((node) => selected.has(node));
}
