// /app/features/novelcrafter/utils/novelcrafterStreamHelpers.ts
// Pure & async helpers extracted from useNovelcrafterStream for SSE parsing, target resolution, and run finalization

import type { MutableRefObject } from "react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import {
  useNovelcrafterStreamStore,
  type createRafStreamBatcher,
} from "@/lib/features/novelcrafter/novelcrafterStreamStore";
import {
  ensurePromptStudioHydrated,
  usePromptStudioStore,
} from "@/lib/features/novelcrafter/promptStudioStore";
import { buildNovelcrafterStreamRequestBody } from "@/lib/features/novelcrafter/streamRequestBody";
import type { NovelcrafterStreamRunRegistry } from "@/lib/features/novelcrafter/streamRunRegistry";
import {
  isLikelyModelRefusalOutput,
  resolveStreamCloseOutcome,
  type StreamTerminationReason,
} from "@/lib/features/novelcrafter/streamTargetGuard";
import type {
  NovelcrafterFinishReason,
  NovelcrafterHistoryCard,
} from "@/lib/features/novelcrafter/types";
import {
  parseFinishReason,
  parseNovelcrafterSseFrame,
  readNovelcrafterSseStream,
} from "./novelcrafterSseParser";
import type {
  StreamingCardMeta,
  TriggerNovelcrafterStreamParams,
  UseNovelcrafterStreamOptions,
} from "./novelcrafterStreamTypes";

const streamHelperLogger = logger.withContext("novelcrafterStreamHelpers");

export interface NovelcrafterStreamRunResult {
  fullContent: string;
  fullThinking: string;
  resolvedModel: string;
  routedModel?: string;
  resolvedGemName: string | null;
  resolvedPersonaName: string | null;
  finishReason?: NovelcrafterFinishReason;
  terminationReason: StreamTerminationReason;
  pendingErrorToast: string | null;
  pendingWarningToast: string | null;
}

export function createInitialStreamingMeta(
  model: string,
  params: Pick<TriggerNovelcrafterStreamParams, "feature" | "subLabel" | "bibleTarget">
): StreamingCardMeta {
  return {
    model,
    gemName: null,
    personaName: null,
    feature: params.feature,
    subLabel: params.subLabel,
    bibleTarget: params.bibleTarget,
  };
}

export function applyMetaSseEvent(
  parsedData: Record<string, unknown>,
  fallbackModel: string,
  params: Pick<TriggerNovelcrafterStreamParams, "feature" | "subLabel" | "bibleTarget">
): {
  resolvedModel: string;
  routedModel?: string;
  resolvedGemName: string | null;
  resolvedPersonaName: string | null;
  nextMeta: StreamingCardMeta;
} {
  const resolvedModel = typeof parsedData.model === "string" ? parsedData.model : fallbackModel;
  const routedModel =
    typeof parsedData.routedModel === "string" && parsedData.routedModel.trim()
      ? parsedData.routedModel.trim()
      : undefined;
  const resolvedGemName = typeof parsedData.gemName === "string" ? parsedData.gemName : null;
  const resolvedPersonaName =
    typeof parsedData.personaName === "string" ? parsedData.personaName : null;
  return {
    resolvedModel,
    routedModel,
    resolvedGemName,
    resolvedPersonaName,
    nextMeta: {
      model: resolvedModel,
      routedModel,
      gemName: resolvedGemName,
      personaName: resolvedPersonaName,
      feature: params.feature,
      subLabel: params.subLabel,
      bibleTarget: params.bibleTarget,
    },
  };
}

export async function parseStreamHttpError(res: Response): Promise<string> {
  const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return errJson.error?.message || `HTTP ${res.status}`;
}

export function createNovelcrafterHistoryCard(params: {
  triggerParams: TriggerNovelcrafterStreamParams;
  activeChapterId: string;
  content: string;
  thinking: string;
  model: string;
  routedModel?: string;
  finishReason?: NovelcrafterFinishReason;
  gemName: string | null;
  personaName: string | null;
  nowMs?: number;
}): NovelcrafterHistoryCard {
  const { triggerParams } = params;
  const now = params.nowMs ?? Date.now();
  const cardFeature: NovelcrafterHistoryCard["feature"] =
    triggerParams.feature === "feedback" ? "rewrite" : triggerParams.feature;
  return {
    id: `card-${now}-${Math.random().toString(36).slice(2, 7)}`,
    feature: cardFeature,
    subSlot: triggerParams.feature === "feedback" ? "feedback" : undefined,
    actionLabel: triggerParams.subLabel,
    subLabel: triggerParams.subLabel,
    bibleTarget: triggerParams.bibleTarget,
    chapterId: params.activeChapterId,
    content: params.content.trim(),
    thinking: params.thinking.trim() || undefined,
    model: params.model,
    ...(params.routedModel ? { routedModel: params.routedModel } : {}),
    ...(params.finishReason ? { finishReason: params.finishReason } : {}),
    gemName: params.gemName,
    personaName: params.personaName,
    createdAt: now,
  };
}

export async function resolveNovelcrafterTargetStory(params: {
  runId: string;
  initialStoryId: string | null;
  ensureStoryConversation: () => Promise<string | null>;
  registry: NovelcrafterStreamRunRegistry;
  isPromotingStoryRef: MutableRefObject<boolean>;
}): Promise<string | null> {
  const { runId, initialStoryId, ensureStoryConversation, registry, isPromotingStoryRef } = params;
  if (initialStoryId) {
    registry.promotePendingRunStory(runId, initialStoryId);
    return initialStoryId;
  }
  try {
    isPromotingStoryRef.current = true;
    const ensuredId = await ensureStoryConversation();
    if (ensuredId) registry.promotePendingRunStory(runId, ensuredId);
    return ensuredId;
  } catch (err: unknown) {
    streamHelperLogger.error("Failed to ensure story conversation:", err);
    return null;
  } finally {
    isPromotingStoryRef.current = false;
  }
}

export async function runNovelcrafterSseStream(params: {
  runId: string;
  targetConversationId: string;
  effectiveSlotModel: string;
  controller: AbortController;
  options: UseNovelcrafterStreamOptions;
  triggerParams: TriggerNovelcrafterStreamParams;
  registry: NovelcrafterStreamRunRegistry;
  batcher: ReturnType<typeof createRafStreamBatcher>;
  onMetaUpdated?: (meta: StreamingCardMeta) => void;
}): Promise<NovelcrafterStreamRunResult> {
  const {
    runId,
    targetConversationId,
    effectiveSlotModel,
    controller,
    options,
    triggerParams,
    registry,
    batcher,
    onMetaUpdated,
  } = params;

  const state: NovelcrafterStreamRunResult = {
    fullContent: "",
    fullThinking: "",
    resolvedModel: effectiveSlotModel,
    routedModel: undefined,
    resolvedGemName: null,
    resolvedPersonaName: null,
    finishReason: undefined,
    terminationReason: "completed",
    pendingErrorToast: null,
    pendingWarningToast: null,
  };
  let sawDoneEvent = false;

  const processFrame = (frame: string) => {
    const parsed = parseNovelcrafterSseFrame(frame);
    if (!parsed) return;
    const { eventType, parsedData } = parsed;
    if (eventType === "meta") {
      const applied = applyMetaSseEvent(parsedData, effectiveSlotModel, triggerParams);
      state.resolvedModel = applied.resolvedModel;
      state.routedModel = applied.routedModel;
      state.resolvedGemName = applied.resolvedGemName;
      state.resolvedPersonaName = applied.resolvedPersonaName;
      if (registry.getActiveRunId() === runId) {
        onMetaUpdated?.(applied.nextMeta);
        useNovelcrafterStreamStore.getState().updateStreamMeta(runId, applied.nextMeta);
      }
    } else if (eventType === "thinking") {
      const tChunk = typeof parsedData.t === "string" ? parsedData.t : "";
      if (tChunk) {
        state.fullThinking += tChunk;
        batcher.scheduleUpdate(state.fullContent, state.fullThinking);
      }
    } else if (eventType === "token") {
      const tChunk = typeof parsedData.t === "string" ? parsedData.t : "";
      if (tChunk) {
        state.fullContent += tChunk;
        batcher.scheduleUpdate(state.fullContent, state.fullThinking);
      }
    } else if (eventType === "done") {
      sawDoneEvent = true;
      state.finishReason = parseFinishReason(parsedData.finishReason) ?? state.finishReason;
    } else if (eventType === "error") {
      throw new Error(
        typeof parsedData.message === "string" ? parsedData.message : "Stream error occurred"
      );
    }
  };

  try {
    await ensurePromptStudioHydrated();
    const body = buildNovelcrafterStreamRequestBody({
      conversationId: targetConversationId,
      options,
      params: triggerParams,
      promptSettings: usePromptStudioStore.getState().settings,
    });
    const res = await fetch("/api/novelcrafter/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      throw new Error(await parseStreamHttpError(res));
    }
    await readNovelcrafterSseStream(res.body, processFrame);
    const closure = resolveStreamCloseOutcome({
      sawDoneEvent,
      aborted: controller.signal.aborted,
      finishReason: state.finishReason,
    });
    state.finishReason = closure.finishReason;
    if (closure.closedWithoutDone) {
      state.pendingWarningToast = options.streamCutoffWarning ?? null;
    }
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      state.terminationReason = "stopped";
      state.finishReason = "aborted";
    } else {
      state.terminationReason = "error";
      state.finishReason = "error";
      const msg = err instanceof Error ? err.message : "Failed to run AI tool";
      streamHelperLogger.error("Novelcrafter stream failed:", msg);
      state.pendingErrorToast = msg;
    }
  }

  return state;
}

export function finalizeNovelcrafterStreamRun(params: {
  runId: string;
  targetConversationId: string;
  controller: AbortController;
  registry: NovelcrafterStreamRunRegistry;
  batcher: ReturnType<typeof createRafStreamBatcher>;
  options: UseNovelcrafterStreamOptions;
  triggerParams: TriggerNovelcrafterStreamParams;
  result: NovelcrafterStreamRunResult;
  setIsStreaming: (v: boolean) => void;
}): void {
  const {
    runId,
    targetConversationId,
    controller,
    registry,
    batcher,
    options,
    triggerParams,
    result,
    setIsStreaming,
  } = params;

  batcher.flushNow();
  const wasCurrentRun = registry.endRun(runId);
  if (wasCurrentRun || !registry.isBusy()) {
    setIsStreaming(false);
    useNovelcrafterStreamStore.getState().finishStreamRun(runId);
  }

  let terminationReason = result.terminationReason;
  let finishReason = result.finishReason;
  if (controller.signal.aborted && terminationReason === "completed") {
    terminationReason = "stopped";
    finishReason = "aborted";
  }

  if (!wasCurrentRun) return;

  const termResult = options.onStreamTerminated?.({
    storyId: targetConversationId,
    reason: terminationReason,
    fullContent: result.fullContent,
    fullThinking: result.fullThinking,
    resolvedModel: result.resolvedModel,
    routedModel: result.routedModel,
    finishReason,
    resolvedGemName: result.resolvedGemName,
    resolvedPersonaName: result.resolvedPersonaName,
    params: triggerParams,
  });

  if (result.pendingErrorToast && !termResult?.handledRefusal) {
    toast.error(result.pendingErrorToast);
  }
  if (result.pendingWarningToast && !termResult?.handledRefusal) {
    toast.warning(result.pendingWarningToast);
  }

  if (
    result.fullContent.trim().length > 0 &&
    !termResult?.handledRefusal &&
    !isLikelyModelRefusalOutput(result.fullContent)
  ) {
    options.onCardCompleted(
      createNovelcrafterHistoryCard({
        triggerParams,
        activeChapterId: options.activeChapterId,
        content: result.fullContent,
        thinking: result.fullThinking,
        model: result.resolvedModel,
        routedModel: result.routedModel,
        finishReason,
        gemName: result.resolvedGemName,
        personaName: result.resolvedPersonaName,
      })
    );
  }
}
