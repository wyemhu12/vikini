// /app/api/chat-stream/streaming/gemini-stream.ts
import {
  getModelMaxOutputTokens,
  modelSupportsThinking,
  normalizeModelForApi,
} from "@/lib/core/modelRegistry";
import { executeFunction } from "@/lib/features/chat/functionRegistry";

import {
  StreamTimeoutError,
  type ChatStreamParams,
  type SystemInstruction,
  type UsageMetadata,
  type StreamResult,
} from "./types";
import { sendEvent, safeText, pick, getStreamTimeout, withTimeout, streamLogger } from "./utils";
import { extractAllThoughtSignatures } from "./thought-signatures";
import {
  handleSafetyBlocking,
  processGroundingMetadata,
  processUrlContextMetadata,
  processPostStream,
} from "./post-processing";

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

async function executeStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  params: {
    ai: ChatStreamParams["ai"];
    model: string;
    contents: unknown[];
    sysPrompt: string;
    tools: unknown[];
    safetySettings: unknown[] | null;
    toolConfig?: Record<string, unknown>;
    useTools: boolean;
    thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
    cachedContent?: string;
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
  // Collect all response parts for Gemini 3 tool context circulation
  const allResponseParts: unknown[] = [];

  const maxTokens = getModelMaxOutputTokens(model);
  const timeoutMs = getStreamTimeout(model, thinkingLevel);
  streamLogger.info(
    `Executing stream for model: ${model} with maxTokens: ${maxTokens}, timeout: ${timeoutMs}ms, thinkingLevel: ${thinkingLevel || "off"}`
  );

  let systemInstruction: SystemInstruction | undefined = undefined;
  // When cachedContent is active, system instruction + tools + toolConfig
  // are already in the cache (Strategy B: Composite Cache) - skip them all
  if (!params.cachedContent && sysPrompt && sysPrompt.trim()) {
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
        // When cachedContent is active, tools + toolConfig are IN the cache - don't send separately
        tools:
          !params.cachedContent &&
          params.useTools &&
          Array.isArray(params.tools) &&
          params.tools.length > 0
            ? params.tools
            : undefined,
        toolConfig: !params.cachedContent && params.useTools ? params.toolConfig : undefined,
        // Explicit context caching: reference composite cache (sysInstruction + tools)
        cachedContent: params.cachedContent,
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

  // State machine for thinking/text separation.
  // Ensures thoughts are emitted BEFORE text, never interleaved.
  let isInThinkingBlock = false;

  for await (const chunk of stream) {
    const pf = pick(chunk, ["promptFeedback", "prompt_feedback"]);
    if (pf) promptFeedback = pf;

    // Extract thought and text parts separately from the chunk
    const candidates = (chunk as { candidates?: unknown[] })?.candidates;
    const parts = (candidates?.[0] as { content?: { parts?: unknown[] } } | undefined)?.content
      ?.parts;

    if (Array.isArray(parts)) {
      for (const rawPart of parts) {
        const part = rawPart as {
          text?: string;
          thought?: boolean | string;
          functionCall?: unknown;
          functionResponse?: unknown;
        };

        // Skip function call/response - handled separately below
        if (part.functionCall || part.functionResponse) continue;

        // Handle THOUGHT parts
        if (
          (part.thought === true && typeof part.text === "string") ||
          typeof part.thought === "string"
        ) {
          const thoughtText =
            typeof part.thought === "string" ? part.thought : (part.text as string);
          if (!isInThinkingBlock) {
            isInThinkingBlock = true;
            full += "<think>";
            sendEvent(controller, "token", { t: "<think>" });
          }
          full += thoughtText;
          sendEvent(controller, "token", { t: thoughtText });
          continue;
        }

        // Handle TEXT parts - close thinking block first if open
        if (typeof part.text === "string") {
          if (isInThinkingBlock) {
            isInThinkingBlock = false;
            full += "</think>";
            sendEvent(controller, "token", { t: "</think>" });
          }
          full += part.text;
          sendEvent(controller, "token", { t: part.text });
        }
      }
    } else {
      // Fallback for non-candidates responses (v2 direct text, etc.)
      const t = safeText(chunk);
      if (t) {
        if (isInThinkingBlock) {
          isInThinkingBlock = false;
          full += "</think>";
          sendEvent(controller, "token", { t: "</think>" });
        }
        full += t;
        sendEvent(controller, "token", { t });
      }
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
          grounding_metadata?: unknown;
          urlContextMetadata?: unknown;
          url_context_metadata?: unknown;
          finishReason?: string;
          finish_reason?: string;
          safetyRatings?: unknown;
          safety_ratings?: unknown;
        }
      | undefined;

    if (cand) {
      if (cand.groundingMetadata || cand.grounding_metadata) {
        groundingMetadata = cand.groundingMetadata || cand.grounding_metadata;
      }
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

    // Detect function calls from Gemini
    const fcCand = (chunk as { candidates?: unknown[] })?.candidates?.[0] as
      | { content?: { parts?: unknown[] }; finishReason?: string }
      | undefined;

    // Collect ALL parts from response for Gemini 3 tool context circulation
    // Parts may include: text, toolCall, toolResponse, functionCall, thought_signature, etc.
    if (fcCand?.content?.parts) {
      for (const part of fcCand.content.parts) {
        allResponseParts.push(part);
      }
    }

    const fcFinish = fcCand?.finishReason;

    // Detect function calls: primary via finishReason, fallback via parts content.
    // Some models (e.g., Flash-Lite) may return functionCall parts with finishReason "STOP"
    // instead of "FUNCTION_CALL".
    const fcParts = (fcCand?.content?.parts || []) as Array<{
      functionCall?: { name: string; args: Record<string, unknown>; id?: string };
    }>;
    const hasFunctionCalls = fcParts.some((p) => p.functionCall);

    if (fcFinish === "FUNCTION_CALL" || fcFinish === "function_call" || hasFunctionCalls) {
      if (hasFunctionCalls && fcFinish !== "FUNCTION_CALL" && fcFinish !== "function_call") {
        streamLogger.info(
          `Function call detected via parts content (finishReason was "${fcFinish || "undefined"}")`
        );
      }
      const functionResponses: Array<{
        name: string;
        id?: string;
        response: Record<string, unknown>;
      }> = [];

      for (const part of fcParts) {
        if (part.functionCall) {
          const { name, args, id } = part.functionCall;
          streamLogger.info(`Function call: ${name}${id ? ` (id: ${id})` : ""}`);
          sendEvent(controller, "meta", { type: "functionCall", name, args });
          const result = await executeFunction(name, args || {});
          functionResponses.push({
            name,
            // Critical: id must match functionCall.id for tool context circulation
            ...(id ? { id } : {}),
            response: result.error ? { error: result.error } : { result: result.result },
          });
        }
      }

      // Make continuation call with function responses
      if (functionResponses.length > 0) {
        try {
          // For Gemini 3 tool context circulation, include ALL response parts (toolCall,
          // toolResponse, text, functionCall) in the model turn, not just functionCall parts.
          // This preserves the context of server-side tool invocations (e.g., googleSearch).
          const modelParts = allResponseParts.length > 0 ? allResponseParts : fcParts;
          const contContents = [
            ...contents,
            { role: "model", parts: modelParts },
            { role: "user", parts: functionResponses.map((fr) => ({ functionResponse: fr })) },
          ];
          const contResult = params.ai.models.generateContentStream({
            model: params.model,
            contents: contContents as unknown[],
            config: {
              systemInstruction,
              tools:
                params.useTools && Array.isArray(params.tools) && params.tools.length > 0
                  ? params.tools
                  : undefined,
              // Preserve toolConfig for continuation calls
              toolConfig: params.useTools ? params.toolConfig : undefined,
            },
          });
          const contStream = contResult instanceof Promise ? await contResult : contResult;
          for await (const contChunk of contStream) {
            const ct = safeText(contChunk);
            if (ct) {
              full += ct;
              sendEvent(controller, "token", { t: ct });
            }
          }
        } catch (contErr: unknown) {
          streamLogger.error("Function call continuation error:", contErr);
        }
      }
    }
  }

  // Close any remaining thinking block
  if (isInThinkingBlock) {
    full += "</think>";
    sendEvent(controller, "token", { t: "</think>" });
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
    allResponseParts: allResponseParts.length > 0 ? allResponseParts : undefined,
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
    toolConfig?: Record<string, unknown>;
    thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
    cachedContent?: string;
  }
): Promise<StreamResult> {
  const {
    ai,
    model,
    contents,
    sysPrompt,
    tools,
    safetySettings,
    toolConfig,
    thinkingLevel,
    cachedContent,
  } = params;

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
      toolConfig,
      useTools: true,
      thinkingLevel,
      cachedContent,
    });
  } catch (err) {
    const toolNames = (tools as Array<Record<string, unknown>>)
      .map((t) => Object.keys(t).join(","))
      .join("; ");
    streamLogger.error(`[TOOLS FALLBACK] model=${model} tools=[${toolNames}] error:`, err);

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

export function createChatReadableStream(params: ChatStreamParams): ReadableStream<Uint8Array> {
  const {
    ai,
    model,
    contents,
    sysPrompt,
    tools,
    safetySettings,
    toolConfig,
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
          toolConfig,
          thinkingLevel,
          cachedContent: params.cachedContent,
        });

        // Handle safety blocking
        const { full: finalFull, isActuallyBlocked } = handleSafetyBlocking(
          controller,
          streamResult.full,
          streamResult.promptFeedback,
          streamResult.finishReason,
          streamResult.safetyRatings
        );

        // Process metadata - collect sources/urlContext for DB persistence
        const sources = processGroundingMetadata(controller, streamResult.groundingMetadata);
        const urlContext = processUrlContextMetadata(controller, streamResult.urlContextMetadata);

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
          sources,
          urlContext,
          model,
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

// Export internal functions used by other stream modules
export { sendInitialMetaEvents, generateAndSendOptimisticTitle };
