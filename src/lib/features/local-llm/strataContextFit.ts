import { stripThinkTags } from "@/lib/features/chat/thinkTags";
import { estimateTokens } from "@/lib/utils/tokenEstimate";
import { StrataContextOverflowError, StrataUnsupportedInputError } from "./errors";
import type { StrataChatMessage } from "./strataThinking";

export interface StrataContentPart {
  text?: string;
  inlineData?: unknown;
}

export interface StrataInputContent {
  role: string;
  parts: unknown[];
}

export interface StrataContentMeta {
  messageId?: string;
  fileIds?: string[];
}

export interface StrataHistoryTurn {
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  estimatedTokens: number;
}

export interface ParsedStrataMessages {
  systemMessage: StrataChatMessage | null;
  historyTurns: StrataHistoryTurn[];
  currentUserMessage: StrataChatMessage;
}

export interface FitStrataPromptParams {
  systemPrompt: string;
  contents: StrataInputContent[];
  contentsMeta?: StrataContentMeta[];
  promptBudgetTokens: number;
  countTokens?: (messages: StrataChatMessage[]) => Promise<number>;
}

export interface FitStrataPromptResult {
  messages: StrataChatMessage[];
  promptTokens: number;
  exact: boolean;
  keptHistoryCount: number;
  droppedHistoryCount: number;
}

/**
 * Computes 32-bit FNV-1a unsigned hash for deterministic anchor selection.
 */
export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function isAnchorMessageId(messageId?: string): boolean {
  if (!messageId) return false;
  return fnv1aHash(messageId) % 4 === 0;
}

function isPartObject(part: unknown): part is StrataContentPart {
  return typeof part === "object" && part !== null;
}

function extractPartsTextAndCheckImages(parts: unknown[], isCurrentTurn: boolean): string {
  const textFragments: string[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      textFragments.push(part);
      continue;
    }
    if (!isPartObject(part)) continue;

    if (part.inlineData !== undefined && part.inlineData !== null) {
      if (isCurrentTurn) {
        throw new StrataUnsupportedInputError("LOCAL_IMAGES_UNSUPPORTED");
      }
      // For historical turns (`0 .. N-2`), skip binary inlineData and keep text placeholders
      continue;
    }

    if (typeof part.text === "string" && part.text.length > 0) {
      textFragments.push(part.text);
    }
  }

  return textFragments.join("\n").trim();
}

/**
 * Converts Vikini `contents` (`0..N-1`) and `contentsMeta` into Strata OpenAI messages,
 * stripping `<think>` blocks from historical assistant turns and omitting `reasoning_content`.
 */
export function toStrataMessages(
  systemPrompt: string,
  contents: StrataInputContent[],
  contentsMeta?: StrataContentMeta[]
): ParsedStrataMessages {
  const trimmedSystem = systemPrompt.trim();
  const systemMessage: StrataChatMessage | null =
    trimmedSystem.length > 0 ? { role: "system", content: trimmedSystem } : null;

  if (contents.length === 0) {
    return {
      systemMessage,
      historyTurns: [],
      currentUserMessage: { role: "user", content: "" },
    };
  }

  const historyTurns: StrataHistoryTurn[] = [];
  const lastIdx = contents.length - 1;

  for (let i = 0; i < lastIdx; i++) {
    const item = contents[i];
    const rawRole = item.role === "model" || item.role === "assistant" ? "assistant" : "user";
    const rawText = extractPartsTextAndCheckImages(
      Array.isArray(item.parts) ? item.parts : [],
      false
    );
    const cleaned = rawRole === "assistant" ? stripThinkTags(rawText) : rawText;
    if (!cleaned) continue;

    historyTurns.push({
      role: rawRole,
      content: cleaned,
      messageId: contentsMeta?.[i]?.messageId,
      estimatedTokens: Math.max(1, estimateTokens(cleaned)),
    });
  }

  const lastItem = contents[lastIdx];
  const currentText = extractPartsTextAndCheckImages(
    Array.isArray(lastItem?.parts) ? lastItem.parts : [],
    true
  );

  return {
    systemMessage,
    historyTurns,
    currentUserMessage: {
      role: "user",
      content: currentText,
    },
  };
}

/**
 * Selects a suffix of `historyTurns` starting at a deterministic user anchor (`fnv1a(id) % 4 === 0`)
 * by scanning backwards from the newest turn to the oldest turn within `targetHistoryBudgetTokens`.
 */
export function selectAnchoredWindow(
  historyTurns: StrataHistoryTurn[],
  targetHistoryBudgetTokens: number,
  tokenScale: number = 1
): StrataHistoryTurn[] {
  if (historyTurns.length === 0 || targetHistoryBudgetTokens <= 0) {
    return [];
  }

  const safeScale = Number.isFinite(tokenScale) && tokenScale > 0 ? tokenScale : 1;
  let accumulated = 0;
  let earliestAnchorIdx: number | null = null;
  let earliestUserIdx: number | null = null;

  for (let i = historyTurns.length - 1; i >= 0; i--) {
    const turn = historyTurns[i];
    const scaledTokens = Math.max(1, Math.ceil(turn.estimatedTokens * safeScale));

    if (accumulated + scaledTokens > targetHistoryBudgetTokens) {
      break;
    }

    accumulated += scaledTokens;
    if (turn.role === "user") {
      earliestUserIdx = i;
      if (isAnchorMessageId(turn.messageId)) {
        earliestAnchorIdx = i;
      }
    }
  }

  const cutIdx = earliestAnchorIdx ?? earliestUserIdx;
  if (cutIdx === null) {
    return [];
  }

  return historyTurns.slice(cutIdx);
}

function buildCandidateMessages(
  systemMessage: StrataChatMessage | null,
  historyTurns: StrataHistoryTurn[],
  currentUserMessage: StrataChatMessage
): StrataChatMessage[] {
  const result: StrataChatMessage[] = [];
  if (systemMessage) {
    result.push({ role: "system", content: systemMessage.content });
  }
  for (const turn of historyTurns) {
    result.push({ role: turn.role, content: turn.content });
  }
  result.push({ role: "user", content: currentUserMessage.content });
  return result;
}

function estimateCandidateTokens(messages: StrataChatMessage[]): number {
  let total = 16; // Chat template framing overhead
  for (const msg of messages) {
    total += Math.max(1, estimateTokens(msg.content)) + 6;
  }
  return total;
}

/**
 * Fits the conversation into `promptBudgetTokens` using anchored suffix selection
 * and up to 3 exact token-count preflight checks against Strata's `/v1/messages/count_tokens`.
 */
export async function fitStrataPrompt({
  systemPrompt,
  contents,
  contentsMeta,
  promptBudgetTokens,
  countTokens,
}: FitStrataPromptParams): Promise<FitStrataPromptResult> {
  const { systemMessage, historyTurns, currentUserMessage } = toStrataMessages(
    systemPrompt,
    contents,
    contentsMeta
  );

  let countCalls = 0;
  let exact = Boolean(countTokens);

  const measureTokens = async (candidate: StrataChatMessage[]): Promise<number> => {
    const fallbackEstimate = Math.ceil(estimateCandidateTokens(candidate) * 1.25);
    if (!countTokens || !exact) {
      exact = false;
      return fallbackEstimate;
    }
    countCalls += 1;
    try {
      const counted = await countTokens(candidate);
      if (typeof counted === "number" && Number.isFinite(counted) && counted > 0) {
        return counted;
      }
      exact = false;
      return fallbackEstimate;
    } catch {
      exact = false;
      return fallbackEstimate;
    }
  };

  const baseMessages = buildCandidateMessages(systemMessage, [], currentUserMessage);
  const baseEstimate = Math.max(1, estimateCandidateTokens(baseMessages));

  let activeHistory = historyTurns;
  let candidate = buildCandidateMessages(systemMessage, activeHistory, currentUserMessage);
  let measuredTokens = await measureTokens(candidate);

  // If countTokens failed/omitted (exact === false) and raw heuristic exceeds budget, trim with 1.25x scale
  if (!exact && measuredTokens > promptBudgetTokens && activeHistory.length > 0) {
    const scaledBase = Math.ceil(baseEstimate * 1.25);
    const targetHistoryBudget = promptBudgetTokens - scaledBase;
    activeHistory =
      targetHistoryBudget > 0 ? selectAnchoredWindow(activeHistory, targetHistoryBudget, 1.25) : [];
    candidate = buildCandidateMessages(systemMessage, activeHistory, currentUserMessage);
    measuredTokens = Math.ceil(estimateCandidateTokens(candidate) * 1.25);
  }

  if (measuredTokens <= promptBudgetTokens) {
    return {
      messages: candidate,
      promptTokens: measuredTokens,
      exact,
      keptHistoryCount: activeHistory.length,
      droppedHistoryCount: historyTurns.length - activeHistory.length,
    };
  }

  // If there is no history left and base prompt already exceeds budget, fail immediately
  if (activeHistory.length === 0) {
    throw new StrataContextOverflowError({
      limit: promptBudgetTokens,
      requested: measuredTokens,
    });
  }

  while (measuredTokens > promptBudgetTokens && countCalls < 3 && activeHistory.length > 0) {
    const candidateEst = Math.max(1, estimateCandidateTokens(candidate));
    const tokenScale = Math.max(1, measuredTokens / candidateEst) * 1.05;
    const scaledBaseTokens = Math.ceil(baseEstimate * tokenScale);
    const targetHistoryBudget = promptBudgetTokens - scaledBaseTokens;

    if (targetHistoryBudget <= 0) {
      activeHistory = [];
    } else {
      const nextHistory = selectAnchoredWindow(activeHistory, targetHistoryBudget, tokenScale);
      // Guarantee monotonic progress if anchor selection kept the same window
      activeHistory =
        nextHistory.length < activeHistory.length ? nextHistory : activeHistory.slice(1);
    }

    candidate = buildCandidateMessages(systemMessage, activeHistory, currentUserMessage);
    measuredTokens = await measureTokens(candidate);

    if (measuredTokens <= promptBudgetTokens) {
      return {
        messages: candidate,
        promptTokens: measuredTokens,
        exact,
        keptHistoryCount: activeHistory.length,
        droppedHistoryCount: historyTurns.length - activeHistory.length,
      };
    }
  }

  throw new StrataContextOverflowError({
    limit: promptBudgetTokens,
    requested: measuredTokens,
  });
}
