// /app/api/chat-stream/streaming.ts
import { logger } from "@/lib/utils/logger";
import OpenAI from "openai";

const streamLogger = logger.withContext("/api/chat-stream");

interface Message {
  role: string;
  content: string;
  [key: string]: unknown;
}

interface MessagePart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

interface MappedMessage {
  role: "user" | "model";
  parts: MessagePart[];
}

export function mapMessages(messages: Message[]): MappedMessage[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
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

    const obj = respOrChunk as { text?: string | (() => string); candidates?: unknown[] };
    if (typeof obj?.text === "function") {
      return obj.text();
    }
    if (typeof obj?.text === "string") {
      return obj.text;
    }

    const candidates = obj?.candidates;
    if (Array.isArray(candidates) && candidates[0]) {
      const candidate = candidates[0] as { content?: { parts?: unknown[] } };
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts) && parts[0]) {
        const part = parts[0] as { text?: string };
        if (typeof part.text === "string") {
          return part.text;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return "";
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
          systemInstruction?: string;
          temperature?: number;
          tools?: unknown[];
          safetySettings?: unknown[];
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
    message: { role: string; content: string }
  ) => Promise<void>;
  saveMessage: (params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
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
  thinkingLevel?: "low" | "medium" | "high" | "minimal";
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

interface StreamResult {
  full: string;
  groundingMetadata: unknown;
  urlContextMetadata: unknown;
  promptFeedback: unknown;
  finishReason: string;
  safetyRatings: unknown;
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
    thinkingLevel?: "low" | "medium" | "high" | "minimal";
  }
): Promise<StreamResult> {
  const { ai, model, contents, sysPrompt, tools, safetySettings, useTools, thinkingLevel } = params;

  // Resolve Thinking Models
  let apiModel = model;
  let thinkingConfig: { thinkingLevel: string } | undefined;

  if (model === "gemini-3-flash-thinking") {
    apiModel = "gemini-3-flash-preview";
    thinkingConfig = { thinkingLevel: "low" }; // Default for Flash Thinking variant
  } else if (model === "gemini-3-pro-thinking") {
    apiModel = "gemini-3-pro-preview";
    thinkingConfig = { thinkingLevel: "high" }; // Default for Pro Thinking variant
  } else if (model === "gemini-3-pro-research") {
    apiModel = "gemini-3-pro-preview";
    // Research mode uses forced tools (configured in chatStreamCore), no special thinking level needed by default,
    // unless we want to combine them. For now, just Thinking High + Search?
    // User requested "Thinking" model + Search. So let's enable thinking too.
    thinkingConfig = { thinkingLevel: "high" };
  }

  // Override if manually provided (future proofing)
  if (thinkingLevel) {
    thinkingConfig = { thinkingLevel };
  }

  let full = "";
  let groundingMetadata: unknown = null;
  let urlContextMetadata: unknown = null;
  let promptFeedback: unknown = null;
  let finishReason = "";
  let safetyRatings: unknown = null;

  const config = {
    systemInstruction: sysPrompt,
    temperature: 0,
    ...(useTools && Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
    ...(Array.isArray(safetySettings) && safetySettings.length > 0 ? { safetySettings } : {}),
    ...(thinkingConfig ? { thinkingConfig } : {}),
  };

  const res = await ai.models.generateContentStream({
    model: apiModel,
    contents,
    config,
  });

  const stream = res instanceof Promise ? await res : res;
  for await (const chunk of stream) {
    const pf = pick(chunk, ["promptFeedback", "prompt_feedback"]);
    if (pf) promptFeedback = pf;

    const t = safeText(chunk);
    if (t) {
      full += t;
      sendEvent(controller, "token", { t });
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
  }

  return {
    full,
    groundingMetadata,
    urlContextMetadata,
    promptFeedback,
    finishReason,
    safetyRatings,
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
    thinkingLevel?: "low" | "medium" | "high" | "minimal";
  }
): Promise<StreamResult> {
  const { ai, model, contents, sysPrompt, tools, safetySettings, thinkingLevel } = params;

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
        sendEvent(controller, "error", { message: "Stream error" });
        throw err;
      }
    } catch (err2) {
      streamLogger.error("stream error (fallback):", err2);
      sendEvent(controller, "error", { message: "Stream error" });
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
  } = params;

  const trimmed = full.trim();
  if (!trimmed) return;

  try {
    await Promise.all([
      appendToContext(conversationId, {
        role: "assistant",
        content: trimmed,
      }),
      saveMessage({
        conversationId,
        userId,
        role: "assistant",
        content: trimmed,
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
      });

      sendEvent(controller, "done", { ok: true });
      controller.close();
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

        const stream = await ai.chat.completions.create({
          model: model,
          messages: openAIMessages,
          stream: true,
          temperature: 0.7, // Slightly higher for creativity? Default is 1 usually. Ill stick to 0.7 for "average" or 0 as generic. Original code was 0.
          max_tokens: 8192,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            full += text;
            sendEvent(controller, "token", { t: text });
          }
        }
      } catch (e) {
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
}: ChatStreamParams & {
  ai: any;
  enableWebSearch: boolean;
  WEB_SEARCH_AVAILABLE: boolean;
  cookieWeb: string;
  regenerate?: boolean;
  content: string;
  conversationId: string;
  userId: string;
  contextMessages: { role: string; content: string }[];
  appendToContext: any;
  saveMessage: any;
  setConversationAutoTitle: any;
  generateFinalTitle: any;
}): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      // 1. Send Initial Metadata
      const convAny = createdConversation as any;
      const meta = {
        conversationId,
        title: convAny?.title ?? null,
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
          role: m.role === "model" ? "assistant" : m.role,
          content: m.parts.map((p) => p.text || "").join(""),
        }));

        const stream = await ai.messages.create({
          model: model, // e.g. "claude-3-5-sonnet-20240620"
          system: sysPrompt,
          messages: anthropicMessages,
          stream: true,
          max_tokens: 8192,
          temperature: 0.7,
        });

        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            const text = chunk.delta.text;
            if (text) {
              full += text;
              sendEvent(controller, "token", { t: text });
            }
          }
        }
      } catch (e: any) {
        streamLogger.error("Anthropic stream error:", e);

        // Extract detailed error info
        const status = e.status || 500;
        const errorMessage = e.message || "Stream error";
        const isTokenLimit = status === 429 || errorMessage.includes("rate_limit");

        sendEvent(controller, "error", {
          message: errorMessage,
          code: e.code || (isTokenLimit ? "rate_limit_exceeded" : "stream_error"),
          status: status,
          isTokenLimit,
        });
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
