// /app/api/chat-stream/streaming/utils.ts
import { logger } from "@/lib/utils/logger";
import { normalizeModelForApi, isStrataLocalModel } from "@/lib/core/modelRegistry";
import { getStrataConfig } from "@/lib/core/strataConfig";
import { TIMEOUT_CONFIG, StreamTimeoutError, type ThinkingLevel } from "./types";

export const streamLogger = logger.withContext("/api/chat-stream");
const textEncoder = new TextEncoder();

function getStreamTimeout(model?: string, thinkingLevel?: ThinkingLevel): number {
  if (model && isStrataLocalModel(model)) {
    try {
      return getStrataConfig().requestTimeoutMs;
    } catch {
      return TIMEOUT_CONFIG.STRATA_LOCAL;
    }
  }

  // Environment variable override takes priority
  const envTimeout = process.env.STREAM_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Deep thinking requires longer timeouts (high / xhigh = maximum reasoning depth)
  const isDeepThinking = thinkingLevel === "high" || thinkingLevel === "xhigh";

  // Model-specific timeouts with thinking level consideration
  if (model) {
    const normalized = normalizeModelForApi(model);
    if (normalized.startsWith("gemini-4") || model.includes("argon")) {
      return TIMEOUT_CONFIG.ARGON;
    }
    if (model.includes("claude")) {
      return isDeepThinking ? TIMEOUT_CONFIG.CLAUDE_DEEP_THINKING : TIMEOUT_CONFIG.CLAUDE;
    }
    if (model.includes("pro")) {
      return isDeepThinking ? TIMEOUT_CONFIG.PRO_DEEP_THINKING : TIMEOUT_CONFIG.PRO;
    }
    if (model.includes("flash")) {
      return isDeepThinking ? TIMEOUT_CONFIG.FLASH_DEEP_THINKING : TIMEOUT_CONFIG.FLASH;
    }
  }

  return TIMEOUT_CONFIG.DEFAULT;
}

/**
 * Creates a promise that rejects after the specified timeout.
 * Used to race against async operations.
 */
function createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new StreamTimeoutError(timeoutMs));
    }, timeoutMs);
  });
}

/**
 * Wraps an async operation with a timeout and always clears the timer on settle.
 * If the operation doesn't complete within the timeout, throws StreamTimeoutError.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new StreamTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function sendEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: unknown
): void {
  try {
    controller.enqueue(textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  } catch (e) {
    streamLogger.error(`Failed to send event ${event}:`, e);
  }
}

export function safeText(respOrChunk: unknown): string {
  try {
    if (typeof respOrChunk === "string") return respOrChunk;

    const obj = respOrChunk as {
      text?: string | (() => string);
      thought?: boolean | string;
      candidates?: unknown[];
      functionCalls?: unknown[];
    };

    // Guard: skip chunks that contain functionCall parts BEFORE accessing .text
    // The @google/genai SDK logs a noisy warning when .text is accessed on
    // responses containing non-text parts (functionCall, codeExecution result, etc.)
    if (Array.isArray(obj?.functionCalls) && obj.functionCalls.length > 0) {
      return "";
    }
    // Also check candidates[0] for functionCall finishReason
    const firstCandidate = (obj?.candidates as Array<{ finishReason?: string }> | undefined)?.[0];
    if (
      firstCandidate?.finishReason === "FUNCTION_CALL" ||
      firstCandidate?.finishReason === "function_call"
    ) {
      // Let the caller handle function calls - don't extract text
      return "";
    }

    // Handle v2 direct text
    if (typeof obj?.text === "function") return obj.text();
    if (typeof obj?.text === "string" && !obj?.thought) return obj.text;
    // Handle direct thought content: thought parts must never leak into answer text (m-22)
    if (obj?.thought === true || typeof obj?.thought === "string") {
      return "";
    }

    const candidates = obj?.candidates;
    if (Array.isArray(candidates) && candidates[0]) {
      const candidate = candidates[0] as { content?: { parts?: unknown[] } };
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        let result = "";
        for (const part of parts) {
          const p = part as {
            text?: string;
            thought?: boolean | string;
            functionCall?: unknown;
            functionResponse?: unknown;
            executableCode?: { code?: string; language?: string };
            codeExecutionResult?: { output?: string; outcome?: string };
          };

          // Skip function call/response parts - they contain raw metadata, not display text
          if (p.functionCall || p.functionResponse) continue;

          // Handle Gemini Code Execution parts (render as markdown)
          if (p.executableCode?.code) {
            const lang = p.executableCode.language?.toLowerCase() || "python";
            result += `\n\`\`\`${lang}\n${p.executableCode.code}\n\`\`\`\n`;
            continue;
          }
          if (p.codeExecutionResult?.output) {
            result += `\n**Output:**\n\`\`\`\n${p.codeExecutionResult.output}\n\`\`\`\n`;
            continue;
          }

          // Skip thought parts here - they are handled by executeStream's
          // state machine to ensure correct ordering (thoughts before text)
          if (p.thought === true) continue;
          if (typeof p.thought === "string") continue;

          if (typeof p.text === "string") {
            result += p.text;
          }
        }
        return result;
      }
    }
  } catch {
    // Ignore errors
  }
  return "";
}

/**
 * Check if a model is Gemini 3/4 series (requires thoughtSignature handling)
 */
export function isGemini3Model(model: string): boolean {
  if (model.startsWith("gemini-4")) return true;
  const gemini3Identifiers = [
    "gemini-4-argon",
    "gemini-4-argon-preview",
    "gemini-4-hydrogen",
    "gemini-4-neon",
    "gemini-3-pro",
    "gemini-3-flash",
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3-pro-image",
    "gemini-3-pro-image-preview",
    "gemini-3-pro-thinking",
    "gemini-3-flash-thinking",
  ];
  return gemini3Identifiers.some((id) => model.includes(id) || model.startsWith(id));
}

export function pick<T = unknown>(obj: unknown, keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const objRecord = obj as Record<string, unknown>;
  for (const k of keys) {
    if (objRecord[k] !== undefined) return objRecord[k] as T;
  }
  return undefined;
}

/**
 * Wraps an async iterable with an idle timeout.
 * Throws StreamTimeoutError if no chunk is received within `idleMs`.
 * Resets the timer on every chunk.
 */
async function* withIdleTimeout<T>(stream: AsyncIterable<T>, idleMs: number): AsyncGenerator<T> {
  const iterator = stream[Symbol.asyncIterator]();
  let activeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingNext: Promise<IteratorResult<T>> | null = null;

  try {
    while (true) {
      const nextPromise = iterator.next();
      pendingNext = nextPromise;

      const idlePromise = new Promise<never>((_, reject) => {
        activeTimer = setTimeout(() => {
          reject(new StreamTimeoutError(idleMs));
        }, idleMs);
      });

      let result: IteratorResult<T>;
      try {
        result = await Promise.race([nextPromise, idlePromise]);
        pendingNext = null;
      } catch (err: unknown) {
        if (pendingNext) {
          pendingNext.catch(() => {});
          pendingNext = null;
        }
        throw err;
      } finally {
        if (activeTimer !== null) {
          clearTimeout(activeTimer);
          activeTimer = null;
        }
      }

      if (result.done) break;
      yield result.value;
    }
  } finally {
    if (activeTimer !== null) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    if (pendingNext) {
      pendingNext.catch(() => {});
      pendingNext = null;
    }
    if (typeof iterator.return === "function") {
      await Promise.resolve(iterator.return()).catch(() => {});
    }
  }
}

export { getStreamTimeout, createTimeoutPromise, withTimeout, withIdleTimeout };
