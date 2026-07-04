// /app/api/chat-stream/streaming/utils.ts
import { logger } from "@/lib/utils/logger";
import { TIMEOUT_CONFIG, StreamTimeoutError, type ThinkingLevel } from "./types";

export const streamLogger = logger.withContext("/api/chat-stream");

function getStreamTimeout(model?: string, thinkingLevel?: ThinkingLevel): number {
  // Environment variable override takes priority
  const envTimeout = process.env.STREAM_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Deep thinking requires longer timeouts (high = maximum reasoning depth)
  const isDeepThinking = thinkingLevel === "high";

  // Model-specific timeouts with thinking level consideration
  if (model) {
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
 * Wraps an async operation with a timeout.
 * If the operation doesn't complete within the timeout, throws StreamTimeoutError.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([promise, createTimeoutPromise<T>(timeoutMs)]);
}

export function sendEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: unknown
): void {
  try {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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
    // Handle direct thought content (if thought is boolean true, text contains the thought)
    if (obj?.thought === true && typeof obj?.text === "string") {
      return `<think>${obj.text}</think>`;
    }
    // Legacy: thought as string
    if (typeof obj?.thought === "string") return `<think>${obj.thought}</think>`;

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
 * Check if a model is Gemini 3 series (requires thoughtSignature handling)
 */
export function isGemini3Model(model: string): boolean {
  const gemini3Identifiers = [
    "gemini-3-pro",
    "gemini-3-flash",
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3-pro-image",
    "gemini-3-pro-image-preview",
    "gemini-3-pro-thinking",
    "gemini-3-flash-thinking",
    // Gemini 3.1 series (March 2026)
    "gemini-3.1-pro",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
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

export { getStreamTimeout, createTimeoutPromise, withTimeout };
