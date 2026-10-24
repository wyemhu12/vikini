import OpenAI from "openai";
import { balanceThinkTags } from "@/lib/features/chat/thinkTags";
import { estimateTokens } from "@/lib/utils/tokenEstimate";
import { getStrataConfig } from "@/lib/core/strataConfig";
import { getStrataClient, countStrataPromptTokens } from "@/lib/core/strataClient";
import { getStrataQueue, type StrataQueue } from "@/lib/core/strataQueue";
import {
  resolveStrataThinkingPlan,
  buildStrataRequestBody,
  type StrataSamplingInput,
  type StrataThinkingPlan,
} from "@/lib/features/local-llm/strataThinking";
import {
  fitStrataPrompt,
  type StrataContentMeta,
  type StrataInputContent,
} from "@/lib/features/local-llm/strataContextFit";
import {
  StrataContextOverflowError,
  StrataDisabledError,
  StrataOfflineError,
  StrataQueueFullError,
  StrataQueueTimeoutError,
  StrataUnsupportedInputError,
} from "@/lib/features/local-llm/errors";
import { StreamTimeoutError, type ChatStreamParams, type Message } from "./types";
import { sendEvent, withIdleTimeout, streamLogger } from "./utils";
import { sendInitialMetaEvents, generateAndSendOptimisticTitle } from "./gemini-stream";
import { processPostStream } from "./post-processing";
import { sendThinkingChunk, accumulateReasoning } from "./reasoningStreamHelper.server";
import { consumeStrataChunks, type StrataStreamUsage } from "./strata-stream-reader";

export interface CreateStrataStreamParams {
  ai?: OpenAI;
  queue?: StrataQueue;
  countTokensFn?: (
    messages: Parameters<typeof countStrataPromptTokens>[0],
    options: { plan: StrataThinkingPlan; signal?: AbortSignal }
  ) => Promise<number>;
  model: string;
  contents: unknown[];
  contentsMeta?: StrataContentMeta[];
  sysPrompt: string;
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
  strataSampling?: StrataSamplingInput;
  gemMeta: ChatStreamParams["gemMeta"];
  modelMeta: ChatStreamParams["modelMeta"];
  createdConversation: unknown | null;
  shouldGenerateTitle: boolean;
  enableWebSearch: boolean;
  WEB_SEARCH_AVAILABLE: boolean;
  cookieWeb: string;
  userId: string;
  conversationId: string;
  content: string;
  contextMessages: Message[];
  appendToContext: ChatStreamParams["appendToContext"];
  upsertAssistantMessage: ChatStreamParams["upsertAssistantMessage"];
  setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
  generateOptimisticTitle: ChatStreamParams["generateOptimisticTitle"];
  generateFinalTitle: ChatStreamParams["generateFinalTitle"];
  clientMessageId?: string;
  signal?: AbortSignal;
  ragSources?: Array<{ filename: string; documentId: string; chunkId: string; similarity: number }>;
  regenerate?: boolean;
}

interface DeadlineHandle {
  clear: () => void;
  didTimeout: () => boolean;
}

function armDeadline(ac: AbortController, timeoutMs: number): DeadlineHandle {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort(new StreamTimeoutError(timeoutMs));
  }, timeoutMs);

  return {
    clear: () => clearTimeout(timer),
    didTimeout: () => timedOut,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface MappedStrataError {
  code: string;
  message: string;
  status: number;
  isTimeout?: boolean;
  isTokenLimit?: boolean;
  tokenInfo?: { limit: number; requested: number } | null;
}

function mapStrataStreamError(err: unknown, requestTimeoutMs: number): MappedStrataError {
  if (err instanceof StreamTimeoutError) {
    return {
      code: "STREAM_TIMEOUT",
      message: `Request timed out after ${Math.round(requestTimeoutMs / 1000)} seconds`,
      status: 504,
      isTimeout: true,
    };
  }

  if (err instanceof StrataContextOverflowError) {
    return {
      code: "LOCAL_CONTEXT_OVERFLOW",
      message: err.message,
      status: 400,
      isTokenLimit: true,
      tokenInfo: err.tokenInfo,
    };
  }

  if (err instanceof StrataUnsupportedInputError) {
    return {
      code: err.code,
      message: err.message,
      status: 400,
    };
  }

  if (err instanceof StrataQueueFullError) {
    return {
      code: "LOCAL_LLM_BUSY",
      message: err.message,
      status: 429,
    };
  }

  if (err instanceof StrataQueueTimeoutError) {
    return {
      code: "LOCAL_QUEUE_TIMEOUT",
      message: err.message,
      status: 504,
    };
  }

  if (err instanceof StrataDisabledError) {
    return {
      code: "LOCAL_LLM_DISABLED",
      message: err.message,
      status: 503,
    };
  }

  if (err instanceof StrataOfflineError) {
    return {
      code: "LOCAL_LLM_OFFLINE",
      message: err.message,
      status: 503,
    };
  }

  const rawMessage =
    err instanceof Error
      ? err.message
      : isRecord(err) && typeof err.message === "string"
        ? err.message
        : "Local LLM stream error";

  const status = isRecord(err) && typeof err.status === "number" ? err.status : 500;
  const codeProp = isRecord(err) && typeof err.code === "string" ? err.code : "";
  const causeCode =
    isRecord(err) && isRecord(err.cause) && typeof err.cause.code === "string"
      ? err.cause.code
      : "";

  const lowerMsg = rawMessage.toLowerCase();

  if (
    codeProp === "ECONNREFUSED" ||
    causeCode === "ECONNREFUSED" ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("fetch failed") ||
    lowerMsg.includes("connection error")
  ) {
    return {
      code: "LOCAL_LLM_OFFLINE",
      message: "Local Strata server is offline",
      status: 503,
    };
  }

  if (status === 503 && lowerMsg.includes("engine is starting")) {
    return {
      code: "LOCAL_LLM_STARTING",
      message: "Strata engine is starting",
      status: 503,
    };
  }

  if (status === 400 && lowerMsg.includes("exceeds the context window")) {
    return {
      code: "LOCAL_CONTEXT_OVERFLOW",
      message: rawMessage,
      status: 400,
      isTokenLimit: true,
    };
  }

  return {
    code: "stream_error",
    message: process.env.NODE_ENV === "production" ? "Local LLM stream failed" : rawMessage,
    status,
  };
}

export function createStrataStream(params: CreateStrataStreamParams): ReadableStream<Uint8Array> {
  const {
    ai,
    queue,
    countTokensFn,
    model,
    contents,
    contentsMeta,
    sysPrompt,
    thinkingLevel,
    strataSampling,
    gemMeta,
    modelMeta,
    createdConversation,
    shouldGenerateTitle,
    enableWebSearch,
    WEB_SEARCH_AVAILABLE,
    cookieWeb,
    userId,
    conversationId,
    content,
    contextMessages,
    appendToContext,
    upsertAssistantMessage,
    setConversationAutoTitle,
    generateOptimisticTitle,
    generateFinalTitle,
    clientMessageId,
    signal,
    ragSources,
  } = params;

  const ac = new AbortController();
  let isCancelled = false;
  if (signal) {
    if (signal.aborted) {
      isCancelled = true;
      ac.abort();
    } else {
      signal.addEventListener(
        "abort",
        () => {
          isCancelled = true;
          ac.abort();
        },
        { once: true }
      );
    }
  }

  const acc = { full: "", reasoning: "" };
  let savedPartial = false;

  const savePartialOnce = async () => {
    if (savedPartial) return;
    savedPartial = true;
    const trimmed = acc.full.trim();
    const trimmedReasoning = acc.reasoning.trim();
    if (trimmed || trimmedReasoning) {
      const balanced = balanceThinkTags(trimmed);
      try {
        await upsertAssistantMessage({
          conversationId,
          userId,
          role: "assistant",
          content: balanced,
          meta: {
            isPartial: true,
            aborted: true,
            status: "aborted",
            model,
            clientMessageId,
            ...(trimmedReasoning ? { reasoning: trimmedReasoning } : {}),
          },
        });
      } catch (saveErr: unknown) {
        streamLogger.error("Failed to save partial message in Strata safety net:", saveErr);
      }
    }
  };

  return new ReadableStream<Uint8Array>({
    cancel() {
      isCancelled = true;
      ac.abort();
    },
    async start(controller) {
      sendInitialMetaEvents(controller, {
        createdConversation,
        enableWebSearch,
        WEB_SEARCH_AVAILABLE,
        cookieWeb,
        gemMeta,
        modelMeta,
        model,
        ragSources,
      });

      await generateAndSendOptimisticTitle(
        controller,
        shouldGenerateTitle,
        content,
        conversationId,
        generateOptimisticTitle
      );

      const cfg = getStrataConfig();
      const targetQueue = queue ?? getStrataQueue();
      let release: (() => void) | null = null;
      let deadline: DeadlineHandle | null = null;

      let full = "";
      let fullReasoning = "";
      let streamFailed = false;
      let emptyAnswerReason: "length" | "no_content" | undefined;
      let usage: StrataStreamUsage | undefined;
      let lastFinishReason: string | undefined;
      let thinkingStartedAt: number | null = null;
      let thinkingEndedAt: number | null = null;

      try {
        release = await targetQueue.acquire({
          signal: ac.signal,
          maxWaitMs: cfg.queueMaxWaitMs,
          onQueued: (position) => {
            sendEvent(controller, "meta", { type: "localQueue", position });
          },
        });

        const plan = resolveStrataThinkingPlan(thinkingLevel, cfg.contextWindow);
        const countFn = countTokensFn ?? countStrataPromptTokens;

        const fit = await fitStrataPrompt({
          systemPrompt: sysPrompt,
          contents: contents as StrataInputContent[],
          contentsMeta,
          promptBudgetTokens: plan.promptBudgetTokens,
          countTokens: (msgs) => countFn(msgs, { plan, signal: ac.signal }),
        });

        const requestBody = buildStrataRequestBody({
          apiModel: cfg.modelId,
          messages: fit.messages,
          plan,
          samplingConfig: strataSampling,
        });

        const client = ai ?? getStrataClient();
        deadline = armDeadline(ac, cfg.requestTimeoutMs);

        const stream = await client.chat.completions.create(
          requestBody as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
          { signal: ac.signal }
        );

        const guardedStream = withIdleTimeout(stream, cfg.idleTimeoutMs);

        await consumeStrataChunks(guardedStream, {
          isCancelled: () => isCancelled || (ac.signal.aborted && !deadline?.didTimeout()),
          onProgress: (progress) => {
            sendEvent(controller, "meta", {
              type: "localPromptProgress",
              ...progress,
            });
          },
          onReasoning: (text) => {
            if (thinkingStartedAt === null) {
              thinkingStartedAt = Date.now();
            }
            fullReasoning = accumulateReasoning(fullReasoning, text);
            acc.reasoning = fullReasoning;
            sendThinkingChunk(controller, text);
          },
          onContent: (text) => {
            if (thinkingStartedAt !== null && thinkingEndedAt === null) {
              thinkingEndedAt = Date.now();
            }
            full += text;
            acc.full = full;
            sendEvent(controller, "token", { t: text });
          },
          onFinish: (reason) => {
            lastFinishReason = reason;
          },
          onUsage: (u) => {
            usage = u;
          },
        });

        if (deadline.didTimeout()) {
          throw new StreamTimeoutError(cfg.requestTimeoutMs);
        }

        if (thinkingStartedAt !== null && thinkingEndedAt === null) {
          thinkingEndedAt = Date.now();
        }

        if (usage) {
          const reuseRatio =
            usage.promptTokens > 0
              ? Math.round((usage.cachedTokens / usage.promptTokens) * 100)
              : 0;
          streamLogger.info(
            `[Strata] reuse=${usage.cachedTokens}/${usage.promptTokens} (${reuseRatio}%), completion=${usage.completionTokens}, finish=${lastFinishReason ?? "unknown"}`
          );

          sendEvent(controller, "meta", {
            type: "usageMetadata",
            promptTokenCount: usage.promptTokens,
            candidatesTokenCount: usage.completionTokens,
            cachedContentTokenCount: usage.cachedTokens,
            totalTokenCount: usage.totalTokens,
          });
        }

        if (!full.trim() && fullReasoning.trim() && !isCancelled && !ac.signal.aborted) {
          emptyAnswerReason = lastFinishReason === "length" ? "length" : "no_content";
          sendEvent(controller, "meta", {
            type: "emptyAnswerNotice",
            reason: emptyAnswerReason,
          });
        }
      } catch (err: unknown) {
        streamFailed = true;
        const timedOut = deadline?.didTimeout() === true || err instanceof StreamTimeoutError;
        const userAborted = (isCancelled || ac.signal.aborted) && !timedOut;

        await savePartialOnce();

        if (!userAborted) {
          const effectiveErr = timedOut ? new StreamTimeoutError(cfg.requestTimeoutMs) : err;
          streamLogger.error("[Strata Stream] error:", effectiveErr);
          const mapped = mapStrataStreamError(effectiveErr, cfg.requestTimeoutMs);

          sendEvent(controller, "error", {
            message: mapped.message,
            code: mapped.code,
            status: mapped.status,
            ...(mapped.isTimeout ? { isTimeout: true } : {}),
            ...(mapped.isTokenLimit ? { isTokenLimit: true } : {}),
            ...(mapped.tokenInfo ? { tokenInfo: mapped.tokenInfo } : {}),
          });
        }
      } finally {
        deadline?.clear();
        release?.();
      }

      const timedOut = deadline?.didTimeout() === true;
      if ((isCancelled || ac.signal.aborted) && !timedOut) {
        await savePartialOnce();
        sendEvent(controller, "done", { ok: false });
        try {
          controller.close();
        } catch {
          // Ignore if already closed
        }
        return;
      }

      if (!streamFailed || full.trim() || fullReasoning.trim()) {
        const extraMeta: Record<string, unknown> = {};
        if (fullReasoning.trim()) {
          const elapsedMs =
            thinkingStartedAt !== null
              ? Math.max(0, (thinkingEndedAt ?? Date.now()) - thinkingStartedAt)
              : 0;
          extraMeta.thinkingStats = {
            tokens: Math.max(1, estimateTokens(fullReasoning)),
            elapsedMs,
          };
        }
        if (usage) {
          extraMeta.localUsage = usage;
        }

        await processPostStream(controller, {
          full,
          reasoning: fullReasoning || undefined,
          ragSources,
          isActuallyBlocked: false,
          shouldGenerateTitle,
          conversationId,
          userId,
          contextMessages,
          content,
          appendToContext,
          upsertAssistantMessage,
          setConversationAutoTitle,
          generateFinalTitle,
          model,
          emptyAnswerReason,
          usageMetadata: usage
            ? {
                promptTokenCount: usage.promptTokens,
                candidatesTokenCount: usage.completionTokens,
                totalTokenCount: usage.totalTokens,
              }
            : undefined,
          ...(Object.keys(extraMeta).length > 0 ? { extraMeta } : {}),
        });
      }

      sendEvent(controller, "done", { ok: !streamFailed });
      try {
        controller.close();
      } catch {
        // Ignore if already closed
      }
    },
  });
}
