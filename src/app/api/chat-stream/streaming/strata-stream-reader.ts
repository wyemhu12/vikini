export interface StrataPromptProgressEvent {
  total: number;
  cache: number;
  processed: number;
  time_ms: number;
}

export interface StrataStreamUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
}

export interface StrataChunkHandlers {
  onReasoning: (text: string) => void;
  onContent: (text: string) => void;
  onProgress?: (progress: StrataPromptProgressEvent) => void;
  onUsage?: (usage: StrataStreamUsage) => void;
  onFinish?: (finishReason: string) => void;
  isCancelled: () => boolean;
  progressThrottleMs?: number;
  now?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePromptProgress(raw: unknown): StrataPromptProgressEvent | null {
  if (!isRecord(raw)) return null;
  const total = typeof raw.total === "number" ? raw.total : 0;
  const cache = typeof raw.cache === "number" ? raw.cache : 0;
  const processed = typeof raw.processed === "number" ? raw.processed : 0;
  const time_ms = typeof raw.time_ms === "number" ? raw.time_ms : 0;
  if (total <= 0) return null;
  return { total, cache, processed, time_ms };
}

function parseUsage(raw: unknown): StrataStreamUsage | null {
  if (!isRecord(raw)) return null;
  const promptTokens = typeof raw.prompt_tokens === "number" ? raw.prompt_tokens : 0;
  const completionTokens = typeof raw.completion_tokens === "number" ? raw.completion_tokens : 0;
  const totalTokens =
    typeof raw.total_tokens === "number" ? raw.total_tokens : promptTokens + completionTokens;

  let cachedTokens = 0;
  if (
    isRecord(raw.prompt_tokens_details) &&
    typeof raw.prompt_tokens_details.cached_tokens === "number"
  ) {
    cachedTokens = raw.prompt_tokens_details.cached_tokens;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
  };
}

/**
 * Consumes an async iterable of OpenAI-compatible SSE chunks from Strata,
 * routing `reasoning_content`, `content`, `prompt_progress` (throttled >= 1s), and `usage`.
 */
export async function consumeStrataChunks(
  iterable: AsyncIterable<unknown>,
  handlers: StrataChunkHandlers
): Promise<void> {
  const throttleMs = handlers.progressThrottleMs ?? 1000;
  const nowFn = handlers.now ?? (() => Date.now());
  let lastProgressAt = -Infinity;

  for await (const chunk of iterable) {
    if (handlers.isCancelled()) {
      break;
    }

    if (!isRecord(chunk)) continue;

    if (handlers.onProgress && chunk.prompt_progress !== undefined) {
      const progress = parsePromptProgress(chunk.prompt_progress);
      if (progress) {
        const currentNow = nowFn();
        if (currentNow - lastProgressAt >= throttleMs) {
          lastProgressAt = currentNow;
          handlers.onProgress(progress);
        }
      }
    }

    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
      const firstChoice: unknown = chunk.choices[0];
      if (isRecord(firstChoice)) {
        if (typeof firstChoice.finish_reason === "string" && firstChoice.finish_reason) {
          handlers.onFinish?.(firstChoice.finish_reason);
        }

        if (isRecord(firstChoice.delta)) {
          const delta = firstChoice.delta;
          const reasoningText =
            typeof delta.reasoning_content === "string"
              ? delta.reasoning_content
              : typeof delta.reasoning === "string"
                ? delta.reasoning
                : "";

          if (reasoningText.length > 0) {
            handlers.onReasoning(reasoningText);
          }

          if (typeof delta.content === "string" && delta.content.length > 0) {
            handlers.onContent(delta.content);
          }
        }
      }
    }

    if (handlers.onUsage && chunk.usage !== undefined) {
      const usage = parseUsage(chunk.usage);
      if (usage) {
        handlers.onUsage(usage);
      }
    }
  }
}
