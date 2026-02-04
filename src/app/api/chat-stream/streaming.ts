// /app/api/chat-stream/streaming.ts
import { logger } from "@/lib/utils/logger";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
  getModelMaxOutputTokens,
  modelSupportsThinking,
  normalizeModelForApi,
} from "@/lib/core/modelRegistry";

// Type definitions for conversation objects
interface CreatedConversation {
  id: string;
  title?: string;
  model?: string;
  gemId?: string | null;
  [key: string]: unknown;
}

// System instruction type for Gemini API
interface SystemInstruction {
  role: "system";
  parts: { text: string }[];
}

const streamLogger = logger.withContext("/api/chat-stream");

// =====================================================
// TIMEOUT CONFIGURATION
// =====================================================

/**
 * Model-specific timeouts for AI API calls in milliseconds.
 * Pro models need more time for complex reasoning.
 * Deep Thinking (thinkingLevel: "high") requires significantly longer timeouts.
 * Can be overridden via STREAM_TIMEOUT_MS environment variable.
 */
const TIMEOUT_CONFIG = {
  PRO: 300000, // 5 minutes for Pro models
  PRO_DEEP_THINKING: 600000, // 10 minutes for Pro + Deep Thinking
  FLASH: 240000, // 4 minutes for Flash models
  FLASH_DEEP_THINKING: 480000, // 8 minutes for Flash + Deep Thinking
  DEFAULT: 180000, // 3 minutes for other models
} as const;

type ThinkingLevel = "off" | "low" | "medium" | "high" | "minimal";

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
 * Custom error for stream timeout
 */
class StreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AI stream timed out after ${timeoutMs}ms`);
    this.name = "StreamTimeoutError";
  }
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

/**
 * Dummy signature for model migration scenarios.
 * Per Gemini 3 docs: use this when migrating from Gemini 2.5 or injecting custom function calls.
 * @see https://ai.google.dev/gemini-api/docs/gemini-3#thought_signatures
 */
export const DUMMY_THOUGHT_SIGNATURE = "context_engineering_is_the_way_to_go";

interface Message {
  role: string;
  content: string;
  /** @deprecated Use thoughtSignatures array instead */
  thoughtSignature?: string;
  /** Gemini 3 thought signatures for multi-step reasoning */
  thoughtSignatures?: string[];
  [key: string]: unknown;
}

interface MessagePart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
  thoughtSignature?: string;
}

interface MappedMessage {
  role: "user" | "model";
  parts: MessagePart[];
}

/**
 * Maps context messages to Gemini API format.
 * Handles Gemini 3 thought signatures for multi-turn reasoning continuity.
 *
 * Per Gemini 3 docs:
 * - Text/Chat: signatures not strictly validated but improve reasoning quality
 * - Function Calling: strictly validated, missing = 400 error
 * - Image Generation: strictly validated on all parts
 */
export function mapMessages(
  messages: Message[],
  useGemini3Fallback: boolean = false
): MappedMessage[] {
  return messages.map((m) => {
    const part: MessagePart = { text: m.content };

    // Only inject signatures for model/assistant messages
    if (m.role === "assistant") {
      // Priority: new array format > legacy single > fallback dummy
      const signatures =
        m.thoughtSignatures ?? (m.thoughtSignature ? [m.thoughtSignature] : undefined);

      if (signatures && signatures.length > 0) {
        // Use the last signature for the text part (most recent reasoning chain)
        part.thoughtSignature = signatures[signatures.length - 1];
      } else if (useGemini3Fallback) {
        // Fallback for model migration: inject dummy signature to bypass strict validation
        part.thoughtSignature = DUMMY_THOUGHT_SIGNATURE;
      }
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [part],
    };
  });
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
    };

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
          const p = part as { text?: string; thought?: boolean | string };
          // Gemini API: thought is boolean, text contains the thought content
          if (p.thought === true && typeof p.text === "string") {
            result += `<think>${p.text}</think>`;
          } else if (typeof p.thought === "string") {
            // Legacy format: thought as string
            result += `<think>${p.thought}</think>`;
          } else if (typeof p.text === "string") {
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
  ];
  return gemini3Identifiers.some((id) => model.includes(id) || model.startsWith(id));
}

/**
 * Extract thoughtSignature from Gemini API response.
 * For streaming, the signature may come in the final chunk.
 * Returns the last found signature (most recent).
 * @deprecated Use extractAllThoughtSignatures for multi-step function calling support
 */
export function extractThoughtSignature(respOrChunk: unknown): string | undefined {
  try {
    const obj = respOrChunk as {
      thoughtSignature?: string;
      candidates?: unknown[];
    };

    // Direct signature on response
    if (typeof obj?.thoughtSignature === "string" && obj.thoughtSignature) {
      return obj.thoughtSignature;
    }

    // Check in candidates -> content -> parts
    const candidates = obj?.candidates;
    if (Array.isArray(candidates) && candidates[0]) {
      const candidate = candidates[0] as { content?: { parts?: unknown[] } };
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        // Get the last signature found in parts
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i] as { thoughtSignature?: string };
          if (typeof p.thoughtSignature === "string" && p.thoughtSignature) {
            return p.thoughtSignature;
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Extract ALL thoughtSignatures from Gemini API response chunk.
 * For multi-step function calling (sequential), multiple signatures may exist.
 * Per Gemini 3 docs: parallel calls only have signature on first functionCall,
 * but sequential calls have signatures on each step.
 *
 * @returns Array of unique signatures found in the chunk (preserves order)
 */
export function extractAllThoughtSignatures(respOrChunk: unknown): string[] {
  const signatures: string[] = [];
  const seen = new Set<string>();

  try {
    const obj = respOrChunk as {
      thoughtSignature?: string;
      candidates?: unknown[];
    };

    // Direct signature on response
    if (
      typeof obj?.thoughtSignature === "string" &&
      obj.thoughtSignature &&
      !seen.has(obj.thoughtSignature)
    ) {
      signatures.push(obj.thoughtSignature);
      seen.add(obj.thoughtSignature);
    }

    // Check in candidates -> content -> parts (collect ALL signatures)
    const candidates = obj?.candidates;
    if (Array.isArray(candidates) && candidates[0]) {
      const candidate = candidates[0] as { content?: { parts?: unknown[] } };
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const p = part as { thoughtSignature?: string };
          if (
            typeof p.thoughtSignature === "string" &&
            p.thoughtSignature &&
            !seen.has(p.thoughtSignature)
          ) {
            signatures.push(p.thoughtSignature);
            seen.add(p.thoughtSignature);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return signatures;
}

function pick<T = unknown>(obj: unknown, keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const objRecord = obj as Record<string, unknown>;
  for (const k of keys) {
    if (objRecord[k] !== undefined) return objRecord[k] as T;
  }
  return undefined;
}

export interface ChatStreamParams {
  ai: {
    models: {
      generateContentStream: (params: {
        model: string;
        contents: unknown[];
        config: {
          systemInstruction?: string | unknown;
          temperature?: number;
          tools?: unknown[];
          safetySettings?: unknown[];
          maxOutputTokens?: number;
          thinkingConfig?: unknown;
        };
      }) => Promise<AsyncGenerator<unknown, unknown, unknown>> | AsyncIterable<unknown>;
    };
  };
  model: string;
  contents: unknown[];
  sysPrompt: string;
  tools: unknown[];
  safetySettings: unknown[] | null;
  gemMeta: {
    gemId?: string | null;
    hasSystemInstruction?: boolean;
    systemInstructionChars?: number;
    error?: string;
  };
  modelMeta: {
    model?: string;
    requestedModel?: string;
    apiModel?: string;
    normalized?: boolean;
    isDefault?: boolean;
  };
  createdConversation: unknown | null;
  shouldGenerateTitle: boolean;
  enableWebSearch: boolean;
  WEB_SEARCH_AVAILABLE: boolean;
  cookieWeb: string;
  regenerate: boolean;
  content: string;
  conversationId: string;
  userId: string;
  contextMessages: Message[];
  appendToContext: (
    conversationId: string,
    message: {
      role: string;
      content: string;
      thoughtSignature?: string;
      thoughtSignatures?: string[];
    }
  ) => Promise<void>;
  saveMessage: (params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    meta?: Record<string, unknown>;
  }) => Promise<unknown>;
  setConversationAutoTitle: (
    userId: string,
    conversationId: string,
    title: string
  ) => Promise<void>;
  generateOptimisticTitle: (content: string) => Promise<string | null>;
  generateFinalTitle: (params: {
    userId: string;
    conversationId: string;
    messages: Message[];
  }) => Promise<string | null>;
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
}

// --- EXTRACTED FUNCTIONS ---

function sendInitialMetaEvents(
  controller: ReadableStreamDefaultController<Uint8Array>,
  params: {
    createdConversation: unknown | null;
    enableWebSearch: boolean;
    WEB_SEARCH_AVAILABLE: boolean;
    cookieWeb: string;
    gemMeta: ChatStreamParams["gemMeta"];
    modelMeta: ChatStreamParams["modelMeta"];
    model: string;
  }
): void {
  const {
    createdConversation,
    enableWebSearch,
    WEB_SEARCH_AVAILABLE,
    cookieWeb,
    gemMeta,
    modelMeta,
    model,
  } = params;

  if (createdConversation) {
    sendEvent(controller, "meta", {
      type: "conversationCreated",
      conversation: createdConversation,
    });
  }

  sendEvent(controller, "meta", {
    type: "webSearch",
    enabled: enableWebSearch,
    available: WEB_SEARCH_AVAILABLE,
    cookie: cookieWeb === "1" ? "1" : cookieWeb === "0" ? "0" : "",
  });

  sendEvent(controller, "meta", {
    type: "gem",
    gemId: gemMeta?.gemId ?? null,
    hasSystemInstruction: Boolean(gemMeta?.hasSystemInstruction),
    systemInstructionChars: gemMeta?.systemInstructionChars || 0,
    error: gemMeta?.error || "",
  });

  sendEvent(controller, "meta", {
    type: "model",
    model: modelMeta?.model ?? model,
    isDefault: Boolean(modelMeta?.isDefault),
  });
}

async function generateAndSendOptimisticTitle(
  controller: ReadableStreamDefaultController<Uint8Array>,
  shouldGenerateTitle: boolean,
  content: string,
  conversationId: string,
  generateOptimisticTitle: (content: string) => Promise<string | null>
): Promise<void> {
  if (!shouldGenerateTitle) return;

  try {
    const optimisticTitle = await generateOptimisticTitle(content);
    if (optimisticTitle) {
      sendEvent(controller, "meta", {
        type: "optimisticTitle",
        conversationId,
        title: optimisticTitle,
      });
    }
  } catch (err) {
    streamLogger.error("Optimistic title error:", err);
  }
}

/**
 * Token usage metadata from Gemini API response.
 * @see https://ai.google.dev/gemini-api/docs/gemini-3
 */
interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

interface StreamResult {
  full: string;
  groundingMetadata: unknown;
  urlContextMetadata: unknown;
  promptFeedback: unknown;
  finishReason: string;
  safetyRatings: unknown;
  /** @deprecated Use thoughtSignatures array instead */
  thoughtSignature?: string;
  /** All thought signatures collected during streaming (for multi-step function calling) */
  thoughtSignatures: string[];
  /** Token usage metadata from Gemini API */
  usageMetadata?: UsageMetadata;
}

async function executeStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  params: {
    ai: ChatStreamParams["ai"];
    model: string;
    contents: unknown[];
    sysPrompt: string;
    tools: unknown[];
    safetySettings: unknown[] | null;
    useTools: boolean;
    thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
  }
): Promise<StreamResult> {
  const { ai, model, contents, sysPrompt, safetySettings, thinkingLevel } = params;

  // Resolve Thinking Models
  const apiModel = model;
  const normalized = normalizeModelForApi(model);

  // Thinking config - different API format for different model families
  // Gemini 3: uses thinkingLevel (string: "low", "medium", "high")
  // Gemini 2.5: uses thinkingBudget (number: 0 = off, -1 = dynamic, or specific token count)
  let thinkingConfig:
    | { thinkingLevel?: string; thinkingBudget?: number; includeThoughts?: boolean }
    | undefined;

  if (thinkingLevel && thinkingLevel !== "off") {
    if (modelSupportsThinking(model)) {
      // Gemini 3+: use thinkingLevel (string)
      thinkingConfig = { thinkingLevel, includeThoughts: true };
    } else if (normalized.startsWith("gemini-2.5")) {
      // Gemini 2.5: use thinkingBudget (number)
      // Map thinkingLevel to thinkingBudget: -1 = dynamic (auto-adjust based on complexity)
      thinkingConfig = { thinkingBudget: -1, includeThoughts: true };
    }
    // Other models: no thinking config (would cause API error)
  }

  let full = "";
  let groundingMetadata: unknown = null;
  let urlContextMetadata: unknown = null;
  let promptFeedback: unknown = null;
  let finishReason = "";
  let safetyRatings: unknown = null;
  // Collect ALL signatures during streaming for multi-step function calling
  const thoughtSignatures: string[] = [];
  const seenSignatures = new Set<string>();
  // Token usage metadata (usually in final chunk)
  let usageMetadata: UsageMetadata | undefined;

  const maxTokens = getModelMaxOutputTokens(model);
  const timeoutMs = getStreamTimeout(model, thinkingLevel);
  streamLogger.info(
    `Executing stream for model: ${model} with maxTokens: ${maxTokens}, timeout: ${timeoutMs}ms, thinkingLevel: ${thinkingLevel || "off"}`
  );

  let systemInstruction: SystemInstruction | undefined = undefined;
  if (sysPrompt && sysPrompt.trim()) {
    systemInstruction = {
      role: "system",
      parts: [{ text: sysPrompt }],
    };
  }

  let stream: AsyncIterable<unknown>;
  try {
    // Call the API and handle both Promise and direct AsyncIterable returns
    const streamResult = ai.models.generateContentStream({
      model: apiModel,
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: typeof maxTokens === "number" && !isNaN(maxTokens) ? maxTokens : undefined,
        safetySettings:
          Array.isArray(safetySettings) && safetySettings.length > 0 ? safetySettings : undefined,
        thinkingConfig,
        tools:
          params.useTools && Array.isArray(params.tools) && params.tools.length > 0
            ? params.tools
            : undefined,
      },
    });

    // If it's a Promise, wrap with timeout. Otherwise use directly.
    if (streamResult instanceof Promise) {
      stream = await withTimeout(streamResult, timeoutMs);
    } else {
      // For direct AsyncIterable, we can't timeout the initial call,
      // but we'll get fast failure if the service is down
      stream = streamResult;
    }
  } catch (err: unknown) {
    // Handle timeout specifically
    if (err instanceof StreamTimeoutError) {
      streamLogger.error(`Stream timeout after ${timeoutMs}ms for model: ${apiModel}`);
      sendEvent(controller, "error", {
        message: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
        code: "STREAM_TIMEOUT",
        isTimeout: true,
      });
    } else {
      streamLogger.error("generateContentStream top-level error:", err);
    }
    // Rethrow to be caught by runStreamWithFallback
    throw err;
  }
  for await (const chunk of stream) {
    const pf = pick(chunk, ["promptFeedback", "prompt_feedback"]);
    if (pf) promptFeedback = pf;

    const t = safeText(chunk);
    if (t) {
      full += t;
      sendEvent(controller, "token", { t });
    }

    // Extract ALL thoughtSignatures from chunk (Gemini 3 multi-step support)
    const chunkSignatures = extractAllThoughtSignatures(chunk);
    for (const sig of chunkSignatures) {
      if (!seenSignatures.has(sig)) {
        thoughtSignatures.push(sig);
        seenSignatures.add(sig);
      }
    }

    const cand = (chunk as { candidates?: unknown[] })?.candidates?.[0] as
      | {
          groundingMetadata?: unknown;
          urlContextMetadata?: unknown;
          url_context_metadata?: unknown;
          finishReason?: string;
          finish_reason?: string;
          safetyRatings?: unknown;
          safety_ratings?: unknown;
        }
      | undefined;

    if (cand) {
      if (cand.groundingMetadata) groundingMetadata = cand.groundingMetadata;
      if (cand.urlContextMetadata || cand.url_context_metadata) {
        urlContextMetadata = cand.urlContextMetadata || cand.url_context_metadata;
      }

      const fr = pick<string>(cand, ["finishReason", "finish_reason"]);
      if (fr) finishReason = fr;

      const sr = pick(cand, ["safetyRatings", "safety_ratings"]);
      if (sr) safetyRatings = sr;
    }

    // Extract usageMetadata (typically in final chunk)
    const rawUsage = (chunk as { usageMetadata?: unknown })?.usageMetadata as
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          thoughtsTokenCount?: number;
          totalTokenCount?: number;
        }
      | undefined;
    if (rawUsage) {
      usageMetadata = {
        promptTokenCount: rawUsage.promptTokenCount,
        candidatesTokenCount: rawUsage.candidatesTokenCount,
        thoughtsTokenCount: rawUsage.thoughtsTokenCount,
        totalTokenCount: rawUsage.totalTokenCount,
      };
    }
  }

  return {
    full,
    groundingMetadata,
    urlContextMetadata,
    promptFeedback,
    finishReason,
    safetyRatings,
    // Legacy: provide last signature for backward compatibility
    thoughtSignature:
      thoughtSignatures.length > 0 ? thoughtSignatures[thoughtSignatures.length - 1] : undefined,
    thoughtSignatures,
    usageMetadata,
  };
}

async function runStreamWithFallback(
  controller: ReadableStreamDefaultController<Uint8Array>,
  params: {
    ai: ChatStreamParams["ai"];
    model: string;
    contents: unknown[];
    sysPrompt: string;
    tools: unknown[];
    safetySettings: unknown[] | null;
    thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
  }
): Promise<StreamResult> {
  const { ai, model, contents, sysPrompt, tools, safetySettings, thinkingLevel } = params;

  // Helper to extract detailed error info from Gemini API errors
  const extractGeminiErrorInfo = (
    err: unknown
  ): {
    message: string;
    code: string;
    status: number;
    isRateLimit: boolean;
    retryAfter?: number;
  } => {
    const e = err as {
      status?: number;
      code?: number;
      message?: string;
      error?: { message?: string; code?: number; status?: string };
    };

    // Try to extract status code
    const status = e.status || e.code || e.error?.code || 500;
    const isRateLimit = status === 429;

    // Try to extract message
    const message = e.message || e.error?.message || "Stream error";

    // For 429 errors, try to parse the nested JSON message
    if (isRateLimit && message.includes("exceeded your current quota")) {
      // Extract retry delay if present
      const retryMatch = message.match(/retry in ([\d.]+)s/i);
      const retryAfter = retryMatch ? parseFloat(retryMatch[1]) : undefined;

      return {
        message: "API quota exceeded. Please try again later or switch to a different model.",
        code: "RATE_LIMIT_EXCEEDED",
        status: 429,
        isRateLimit: true,
        retryAfter,
      };
    }

    // For other errors
    return {
      message: message.length > 200 ? message.substring(0, 200) + "..." : message,
      code: isRateLimit ? "RATE_LIMIT_EXCEEDED" : "STREAM_ERROR",
      status,
      isRateLimit,
    };
  };

  try {
    return await executeStream(controller, {
      ai,
      model,
      contents,
      sysPrompt,
      tools,
      safetySettings,
      useTools: true,
      thinkingLevel,
    });
  } catch (err) {
    streamLogger.error("stream error (with tools):", err);

    // Extract error info before trying fallback
    const errorInfo = extractGeminiErrorInfo(err);

    // For rate limit errors, don't retry - just send error immediately
    if (errorInfo.isRateLimit) {
      sendEvent(controller, "error", {
        message: errorInfo.message,
        code: errorInfo.code,
        status: errorInfo.status,
        isRateLimit: true,
        retryAfter: errorInfo.retryAfter,
      });
      throw err;
    }

    try {
      // If we failed with tools, retry without tools (BUT keep thinking config if present)
      if (Array.isArray(tools) && tools.length > 0) {
        sendEvent(controller, "meta", {
          type: "webSearchFallback",
          message: "Tools not supported. Retrying without web search.",
        });
        return await executeStream(controller, {
          ai,
          model,
          contents,
          sysPrompt,
          tools,
          safetySettings,
          useTools: false,
          thinkingLevel,
        });
      } else {
        sendEvent(controller, "error", {
          message: errorInfo.message,
          code: errorInfo.code,
          status: errorInfo.status,
        });
        throw err;
      }
    } catch (err2) {
      streamLogger.error("stream error (fallback):", err2);
      const fallbackErrorInfo = extractGeminiErrorInfo(err2);
      sendEvent(controller, "error", {
        message: fallbackErrorInfo.message,
        code: fallbackErrorInfo.code,
        status: fallbackErrorInfo.status,
        isRateLimit: fallbackErrorInfo.isRateLimit,
        retryAfter: fallbackErrorInfo.retryAfter,
      });
      throw err2;
    }
  }
}

function handleSafetyBlocking(
  controller: ReadableStreamDefaultController<Uint8Array>,
  full: string,
  promptFeedback: unknown,
  finishReason: string,
  safetyRatings: unknown
): { full: string; isActuallyBlocked: boolean } {
  const blockReason = pick<string>(promptFeedback, ["blockReason", "block_reason"]);
  const isBlocked = Boolean(blockReason) || String(finishReason || "").toUpperCase() === "SAFETY";
  let isActuallyBlocked = false;

  if (!full.trim() && isBlocked) {
    isActuallyBlocked = true;
    sendEvent(controller, "meta", {
      type: "safety",
      blocked: true,
      blockReason: blockReason || "",
      finishReason: finishReason || "",
      safetyRatings: safetyRatings || null,
    });

    const msg =
      "Nội dung bị chặn bởi safety filter. Hãy thử đổi tên GEM hoặc viết lại yêu cầu theo hướng trung lập.";
    full = msg;
    sendEvent(controller, "token", { t: msg });
  }

  return { full, isActuallyBlocked };
}

function processGroundingMetadata(
  controller: ReadableStreamDefaultController<Uint8Array>,
  groundingMetadata: unknown
): void {
  const grounding = groundingMetadata as {
    groundingChunks?: Array<{
      web?: {
        uri?: string;
        title?: string;
      };
    }>;
  } | null;

  if (grounding?.groundingChunks) {
    const sources = grounding.groundingChunks
      .map((c) => (c?.web?.uri ? { uri: c.web.uri, title: c.web.title || c.web.uri } : null))
      .filter((s): s is { uri: string; title: string } => s !== null);

    if (sources.length) {
      sendEvent(controller, "meta", { type: "sources", sources });
    }
  }
}

function processUrlContextMetadata(
  controller: ReadableStreamDefaultController<Uint8Array>,
  urlContextMetadata: unknown
): void {
  if (!urlContextMetadata) return;

  const urlMeta =
    (
      urlContextMetadata as {
        urlMetadata?: Array<{
          retrievedUrl?: string;
          retrieved_url?: string;
          urlRetrievalStatus?: string;
          url_retrieval_status?: string;
        }>;
        url_metadata?: Array<{
          retrievedUrl?: string;
          retrieved_url?: string;
          urlRetrievalStatus?: string;
          url_retrieval_status?: string;
        }>;
      }
    )?.urlMetadata ||
    (
      urlContextMetadata as {
        url_metadata?: Array<{
          retrievedUrl?: string;
          retrieved_url?: string;
          urlRetrievalStatus?: string;
          url_retrieval_status?: string;
        }>;
      }
    )?.url_metadata ||
    [];

  sendEvent(controller, "meta", {
    type: "urlContext",
    urls: urlMeta.map((u) => ({
      retrievedUrl: u.retrievedUrl || u.retrieved_url || "",
      status: u.urlRetrievalStatus || u.url_retrieval_status || "",
    })),
  });
}

async function processPostStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  params: {
    full: string;
    isActuallyBlocked: boolean;
    shouldGenerateTitle: boolean;
    conversationId: string;
    userId: string;
    contextMessages: Message[];
    content: string;
    appendToContext: ChatStreamParams["appendToContext"];
    saveMessage: ChatStreamParams["saveMessage"];
    setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
    generateFinalTitle: ChatStreamParams["generateFinalTitle"];
    /** @deprecated Use thoughtSignatures instead */
    thoughtSignature?: string;
    /** All collected signatures from the stream */
    thoughtSignatures?: string[];
    /** Token usage metadata from Gemini API */
    usageMetadata?: UsageMetadata;
  }
): Promise<void> {
  const {
    full,
    isActuallyBlocked,
    shouldGenerateTitle,
    conversationId,
    userId,
    contextMessages,
    content,
    appendToContext,
    saveMessage,
    setConversationAutoTitle,
    generateFinalTitle,
    thoughtSignature,
    thoughtSignatures,
    usageMetadata,
  } = params;

  const trimmed = full.trim();
  if (!trimmed) return;

  // Use array if available, fallback to single signature
  const signatures =
    thoughtSignatures && thoughtSignatures.length > 0
      ? thoughtSignatures
      : thoughtSignature
        ? [thoughtSignature]
        : undefined;

  try {
    await Promise.all([
      appendToContext(conversationId, {
        role: "assistant",
        content: trimmed,
        ...(signatures && signatures.length > 0 ? { thoughtSignatures: signatures } : {}),
      }),
      saveMessage({
        conversationId,
        userId,
        role: "assistant",
        content: trimmed,
        meta: {
          ...(signatures && signatures.length > 0 ? { thoughtSignatures: signatures } : {}),
          // Include token usage metadata if available
          ...(usageMetadata?.promptTokenCount !== undefined
            ? { promptTokenCount: usageMetadata.promptTokenCount }
            : {}),
          ...(usageMetadata?.candidatesTokenCount !== undefined
            ? { candidatesTokenCount: usageMetadata.candidatesTokenCount }
            : {}),
          ...(usageMetadata?.thoughtsTokenCount !== undefined
            ? { thoughtsTokenCount: usageMetadata.thoughtsTokenCount }
            : {}),
          ...(usageMetadata?.totalTokenCount !== undefined
            ? { totalTokenCount: usageMetadata.totalTokenCount }
            : {}),
        },
      }),
    ]);

    if (shouldGenerateTitle && !isActuallyBlocked) {
      const messagesForTitle: Message[] = [
        ...contextMessages,
        { role: "user", content: content },
        { role: "assistant", content: trimmed },
      ];

      const finalTitle = await generateFinalTitle({
        userId,
        conversationId,
        messages: messagesForTitle,
      });

      if (finalTitle?.trim()) {
        await setConversationAutoTitle(userId, conversationId, finalTitle.trim());
        sendEvent(controller, "meta", {
          type: "finalTitle",
          conversationId,
          title: finalTitle.trim(),
        });
      }
    }
  } catch (err) {
    streamLogger.error("post-stream processing error:", err);
  }
}

export function createChatReadableStream(params: ChatStreamParams): ReadableStream<Uint8Array> {
  const {
    ai,
    model,
    contents,
    sysPrompt,
    tools,
    safetySettings,
    gemMeta,
    modelMeta,
    createdConversation,
    shouldGenerateTitle,
    enableWebSearch,
    WEB_SEARCH_AVAILABLE,
    cookieWeb,
    regenerate: _regenerate,
    content,
    conversationId,
    userId,
    contextMessages,
    appendToContext,
    saveMessage,
    setConversationAutoTitle,
    generateOptimisticTitle,
    generateFinalTitle,
    thinkingLevel,
  } = params;

  return new ReadableStream({
    async start(controller) {
      try {
        // Send initial meta events
        sendInitialMetaEvents(controller, {
          createdConversation,
          enableWebSearch,
          WEB_SEARCH_AVAILABLE,
          cookieWeb,
          gemMeta,
          modelMeta,
          model,
        });

        // Generate optimistic title if needed
        await generateAndSendOptimisticTitle(
          controller,
          shouldGenerateTitle,
          content,
          conversationId,
          generateOptimisticTitle
        );

        // Execute stream with fallback
        const streamResult = await runStreamWithFallback(controller, {
          ai,
          model,
          contents,
          sysPrompt,
          tools,
          safetySettings,
          thinkingLevel,
        });

        // Handle safety blocking
        const { full: finalFull, isActuallyBlocked } = handleSafetyBlocking(
          controller,
          streamResult.full,
          streamResult.promptFeedback,
          streamResult.finishReason,
          streamResult.safetyRatings
        );

        // Process metadata
        processGroundingMetadata(controller, streamResult.groundingMetadata);
        processUrlContextMetadata(controller, streamResult.urlContextMetadata);

        // Post-stream processing
        await processPostStream(controller, {
          full: finalFull,
          isActuallyBlocked,
          shouldGenerateTitle,
          conversationId,
          userId,
          contextMessages,
          content,
          appendToContext,
          saveMessage,
          setConversationAutoTitle,
          generateFinalTitle,
          thoughtSignatures: streamResult.thoughtSignatures,
          usageMetadata: streamResult.usageMetadata,
        });

        // Send usage metadata SSE event (for client display)
        if (streamResult.usageMetadata) {
          sendEvent(controller, "meta", {
            type: "usageMetadata",
            promptTokenCount: streamResult.usageMetadata.promptTokenCount,
            candidatesTokenCount: streamResult.usageMetadata.candidatesTokenCount,
            thoughtsTokenCount: streamResult.usageMetadata.thoughtsTokenCount,
            totalTokenCount: streamResult.usageMetadata.totalTokenCount,
          });
        }

        sendEvent(controller, "done", { ok: true });
      } catch (err) {
        // Error event was already sent by runStreamWithFallback
        // Just log and close the stream gracefully
        streamLogger.error("createChatReadableStream error:", err);
        sendEvent(controller, "done", { ok: false });
      } finally {
        controller.close();
      }
    },
  });
}

export function createOpenAICompatibleStream(params: {
  ai: OpenAI;
  model: string;
  contents: unknown[]; // This will need to be mapped to OpenAI format
  sysPrompt: string;
  // Common params
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
  saveMessage: ChatStreamParams["saveMessage"];
  setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
  generateOptimisticTitle: ChatStreamParams["generateOptimisticTitle"];
  generateFinalTitle: ChatStreamParams["generateFinalTitle"];
}): ReadableStream<Uint8Array> {
  const {
    ai,
    model,
    contents,
    sysPrompt,
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
    saveMessage,
    setConversationAutoTitle,
    generateOptimisticTitle,
    generateFinalTitle,
  } = params;

  return new ReadableStream({
    async start(controller) {
      // 1. Send Initial Meta
      sendInitialMetaEvents(controller, {
        createdConversation,
        enableWebSearch,
        WEB_SEARCH_AVAILABLE,
        cookieWeb,
        gemMeta,
        modelMeta,
        model,
      });

      // 2. Optimistic Title
      await generateAndSendOptimisticTitle(
        controller,
        shouldGenerateTitle,
        content,
        conversationId,
        generateOptimisticTitle
      );

      let full = "";

      try {
        // Map contents to OpenAI format
        // contents from chatStreamCore is [{ role: "user", parts: [{text: ""}] }]
        // OpenAI expects: [{ role: "user", content: "" }]
        const openAIMessages = [
          { role: "system", content: sysPrompt },
          ...(contents as Array<{ role: string; parts: Array<{ text?: string }> }>).map((m) => ({
            role: m.role === "model" ? "assistant" : m.role,
            content: m.parts.map((p) => p.text || "").join(""),
          })),
        ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

        const timeoutMs = getStreamTimeout(model);
        const streamPromise = ai.chat.completions.create({
          model: model,
          messages: openAIMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 8192,
        });

        const stream = await withTimeout(streamPromise, timeoutMs);

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            full += text;
            sendEvent(controller, "token", { t: text });
          }
        }
      } catch (e) {
        // Handle timeout specifically
        if (e instanceof StreamTimeoutError) {
          const timeoutMs = getStreamTimeout();
          streamLogger.error(`OpenAI/Groq stream timeout after ${timeoutMs}ms`);
          sendEvent(controller, "error", {
            message: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
            code: "STREAM_TIMEOUT",
            isTimeout: true,
          });
        } else {
          streamLogger.error("OpenAI/Groq stream error:", e);

          // Extract detailed error info for frontend
          const err = e as {
            status?: number;
            code?: string;
            message?: string;
            error?: { message?: string };
          };

          const isTokenLimit = err.status === 413 || err.code === "rate_limit_exceeded";
          const errorMessage = err.error?.message || err.message || "Stream error";

          // Parse token info from error message if available
          let tokenInfo: { limit?: number; requested?: number } | null = null;
          if (isTokenLimit && errorMessage) {
            const limitMatch = errorMessage.match(/Limit (\d+)/);
            const requestedMatch = errorMessage.match(/Requested (\d+)/);
            if (limitMatch || requestedMatch) {
              tokenInfo = {
                limit: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
                requested: requestedMatch ? parseInt(requestedMatch[1], 10) : undefined,
              };
            }
          }

          sendEvent(controller, "error", {
            message: errorMessage,
            code: err.code || (isTokenLimit ? "token_limit_exceeded" : "stream_error"),
            status: err.status || 500,
            isTokenLimit,
            tokenInfo,
          });
        }
      }

      // 3. Post Stream Processing
      await processPostStream(controller, {
        full,
        isActuallyBlocked: false,
        shouldGenerateTitle,
        conversationId,
        userId,
        contextMessages,
        content,
        appendToContext,
        saveMessage,
        setConversationAutoTitle,
        generateFinalTitle,
      });

      sendEvent(controller, "done", { ok: true });
      controller.close();
    },
  });
}

export function createAnthropicStream({
  ai,
  model,
  contents,
  sysPrompt,
  gemMeta,
  modelMeta,
  createdConversation,
  shouldGenerateTitle,
  enableWebSearch,
  WEB_SEARCH_AVAILABLE,
  cookieWeb,
  regenerate: _regenerate,
  content,
  conversationId,
  userId,
  contextMessages,
  appendToContext,
  saveMessage,
  setConversationAutoTitle,
  generateFinalTitle,
}: Omit<ChatStreamParams, "ai"> & {
  ai: Anthropic;
  enableWebSearch: boolean;
  WEB_SEARCH_AVAILABLE: boolean;
  cookieWeb: string;
  regenerate?: boolean;
  content: string;
  conversationId: string;
  userId: string;
  contextMessages: { role: string; content: string }[];
  appendToContext: ChatStreamParams["appendToContext"];
  saveMessage: ChatStreamParams["saveMessage"];
  setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
  generateFinalTitle: ChatStreamParams["generateFinalTitle"];
}): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      // 1. Send Initial Metadata
      const conv = createdConversation as CreatedConversation | null;
      const meta = {
        conversationId,
        title: conv?.title ?? null,
        isNew: Boolean(createdConversation),
        model: modelMeta,
        gem: gemMeta,
        webSearch: {
          enabled: enableWebSearch,
          available: WEB_SEARCH_AVAILABLE,
          cookie: cookieWeb,
        },
      };
      sendEvent(controller, "meta", meta);

      let full = "";

      try {
        // Map contents to Anthropic format
        // contents: [{ role: "user", parts: [{text: ""}] }]
        // Anthropic: [{ role: "user" | "assistant", content: string }]
        const anthropicMessages = (
          contents as Array<{ role: string; parts: Array<{ text?: string }> }>
        ).map((m) => ({
          role: (m.role === "model" ? "assistant" : m.role) as "user" | "assistant",
          content: m.parts.map((p) => p.text || "").join(""),
        }));

        const timeoutMs = getStreamTimeout(model);
        const streamPromise = ai.messages.create({
          model: model, // e.g. "claude-3-5-sonnet-20240620"
          system: sysPrompt,
          messages: anthropicMessages,
          stream: true,
          max_tokens: 8192,
          temperature: 0.7,
        });

        const stream = await withTimeout(streamPromise, timeoutMs);

        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            const text = chunk.delta.text;
            if (text) {
              full += text;
              sendEvent(controller, "token", { t: text });
            }
          }
        }
      } catch (e: unknown) {
        // Handle timeout specifically
        if (e instanceof StreamTimeoutError) {
          const timeoutMs = getStreamTimeout();
          streamLogger.error(`Anthropic stream timeout after ${timeoutMs}ms`);
          sendEvent(controller, "error", {
            message: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
            code: "STREAM_TIMEOUT",
            isTimeout: true,
          });
        } else {
          streamLogger.error("Anthropic stream error:", e);

          // Extract detailed error info
          const err = e as { status?: number; message?: string; code?: string };
          const status = err.status || 500;
          const errorMessage = err.message || "Stream error";
          const isTokenLimit = status === 429 || errorMessage.includes("rate_limit");

          sendEvent(controller, "error", {
            message: errorMessage,
            code: err.code || (isTokenLimit ? "rate_limit_exceeded" : "stream_error"),
            status: status,
            isTokenLimit,
          });
        }
      }

      // 3. Post Stream Processing
      await processPostStream(controller, {
        full,
        isActuallyBlocked: false,
        shouldGenerateTitle,
        conversationId,
        userId,
        contextMessages,
        content,
        appendToContext,
        saveMessage,
        setConversationAutoTitle,
        generateFinalTitle,
      });

      sendEvent(controller, "done", { ok: true });
      controller.close();
    },
  });
}
