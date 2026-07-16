// /app/api/chat-stream/chatStreamCore.ts
// Thin orchestrator — delegates to extracted modules

import type OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import { getGenAIClient } from "@/lib/core/genaiClient";
import { getGroqClient } from "@/lib/core/groqClient";
import { getOpenRouterClient } from "@/lib/core/openRouterClient";
import { getClaudeClient } from "@/lib/core/claudeClient";
import { getDeepSeekClient } from "@/lib/core/deepseekClient";
import {
  DEFAULT_MODEL,
  normalizeModelForApi,
  coerceStoredModel,
  isDeepSeekDirectModel,
} from "@/lib/core/modelRegistry";
import { CLAUDE_API_MODELS, MODEL_IDS } from "@/lib/utils/constants";
import { getOrCreateCompositeCache } from "@/lib/core/contextCache";
import { error } from "@/lib/utils/apiResponse";

import { saveMessage } from "@/lib/features/chat/messages";
import { setConversationAutoTitle } from "@/lib/features/chat/conversations";
import { getGemInstructionsForConversation } from "@/lib/features/gems/gems";
import { getPersonaInstructionsForConversation } from "@/lib/features/personas/personas";
import {
  buildRAGContext,
  injectRAGIntoSystemPrompt,
} from "@/lib/features/projects/ragContext.server";
import { generateOptimisticTitle, generateFinalTitle } from "@/lib/core/autoTitleEngine";

import {
  createChatReadableStream,
  createOpenAICompatibleStream,
  createDeepSeekStream,
  createAnthropicStream,
  type ChatStreamParams,
} from "./streaming";
import { chatStreamRequestSchema, type ChatStreamRequest } from "./validators";

// Extracted modules
import {
  coreLogger,
  parseCookieHeader,
  type HandleChatStreamCoreParams,
  type ConversationContext,
} from "./chatStreamHelpers";
import { loadOrCreateConversation, handleMessageTruncation } from "./conversationLoader";
import { buildMessageContext, getWebSearchConfig, setupToolsAndSafety } from "./contextBuilder";
import { processAttachments } from "./attachmentProcessor";

// AttachmentBytes interface removed - now using batchDownloadAttachments which returns Buffer directly

export async function handleChatStreamCore({
  req,
  userId,
}: HandleChatStreamCoreParams): Promise<Response> {
  // Parse and validate request body
  let body: ChatStreamRequest;
  try {
    const rawBody = await req.json();
    body = chatStreamRequestSchema.parse(rawBody);
  } catch (e) {
    const errorMsg = e as { errors?: Array<{ path: string[]; message: string }>; message?: string };
    if (errorMsg.errors) {
      const firstError = errorMsg.errors[0];
      const field = firstError.path.join(".");
      return error(`Validation error: ${field} - ${firstError.message}`, 400, "VALIDATION_ERROR");
    }
    return error(errorMsg?.message || "Invalid request body", 400, "VALIDATION_ERROR");
  }

  const {
    conversationId: conversationIdRaw,
    content,
    regenerate,
    truncateMessageId,
    skipSaveUserMessage,
    thinkingLevel,
    fileIds,
  } = body;

  // Initialize AI client
  let ai: ReturnType<typeof getGenAIClient>;
  try {
    ai = getGenAIClient();
  } catch (e) {
    const errorMsg = e as Error;
    // error helper will automatically sanitize the message in production
    return error(errorMsg?.message || "AI service unavailable", 500, "AI_SERVICE_ERROR");
  }

  // Load or create conversation
  let convContext: ConversationContext;
  try {
    convContext = await loadOrCreateConversation(userId, conversationIdRaw);
  } catch (e) {
    const errorMsg = e as Error;
    return error(
      errorMsg?.message || "Failed to load/create conversation",
      500,
      "CONVERSATION_ERROR"
    );
  }

  const {
    conversation,
    conversationId,
    shouldGenerateTitle,
    requestedModel,
    model,
    modelLimitTokens,
  } = convContext;
  const createdConversation = convContext.isNew ? conversation : null;
  const finalShouldGenerateTitle = shouldGenerateTitle && !regenerate;

  // Handle message truncation/regeneration
  await handleMessageTruncation(userId, conversationId, truncateMessageId, regenerate);

  // Save user message (with fileIds in meta if present)
  if (!skipSaveUserMessage) {
    try {
      const userMeta = fileIds && fileIds.length > 0 ? { fileIds } : undefined;
      await saveMessage(userId, conversationId, "user", content, userMeta);
    } catch (e) {
      const errorMsg = e as Error;
      return error(errorMsg?.message || "Failed to save user message", 500, "MESSAGE_SAVE_ERROR");
    }
  }

  // Load system prompt - GEM always takes priority
  const { sysPrompt, gemLoadError } = await buildSystemPrompt(userId, conversationId, content);

  // Build message context with smart token window
  const messageContext = await buildMessageContext(
    conversationId,
    content,
    sysPrompt,
    modelLimitTokens
  );

  // Process files + attachments (provider-aware, with priority for newly attached files)
  const { contents, sysPrompt: finalSysPrompt } = await processAttachments(
    userId,
    conversationId,
    messageContext.contents,
    sysPrompt,
    messageContext.currentTokenCount,
    modelLimitTokens,
    model,
    fileIds
  );

  // Inject Chart Generation Protocol
  const chartProtocol = `
\n\n[CHART GENERATION PROTOCOL]
If the user asks to visualize data, output a JSON code block (language="json").
The JSON must follow this schema exactly:
{
  "type": "chart",
  "chartType": "bar" | "line" | "area" | "pie",
  "title": "Chart Title",
  "data": [{ "name": "Category A", "value": 100 }, ...],
  "xKey": "name",
  "yKeys": ["value"],
  "colors": ["#3b82f6", "#ef4444", ...] (optional)
}
DO NOT output the chart as an image or ASCII art. Use this JSON format ONLY when specifically asked for a chart or visualization.
`;

  const finalSysPromptWithCharts = (finalSysPrompt || "") + chartProtocol;

  // Setup web search and safety settings
  const cookies = parseCookieHeader(req?.headers?.get?.("cookie") || undefined);
  const { enableWebSearch, WEB_SEARCH_AVAILABLE } = getWebSearchConfig(cookies);
  const cookieWeb = cookies?.webSearchEnabled ?? cookies?.webSearch ?? "";
  const { tools, safetySettings, toolConfig } = setupToolsAndSafety(
    enableWebSearch,
    WEB_SEARCH_AVAILABLE,
    model
  );

  // Debug: Log web search configuration
  coreLogger.info(
    `[WEB SEARCH] env.WEB_SEARCH_ENABLED=${JSON.stringify(process.env.WEB_SEARCH_ENABLED)} | available=${WEB_SEARCH_AVAILABLE} | enabled=${enableWebSearch} | cookie=${cookieWeb} | tools=${tools.map((t) => Object.keys(t).join(",")).join("; ")}`
  );

  // Create stream
  const saveMessageCompat = async ({
    conversationId,
    userId,
    role,
    content,
    meta,
  }: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    meta?: Record<string, unknown>;
  }) => {
    return saveMessage(userId, conversationId, role, content, meta);
  };

  // Build shared meta objects
  const gemMeta = {
    gemId: conversation?.gemId ?? null,
    hasSystemInstruction: Boolean(finalSysPrompt && String(finalSysPrompt).trim()),
    systemInstructionChars: typeof finalSysPrompt === "string" ? finalSysPrompt.length : 0,
    error: gemLoadError || "",
  };
  const modelMeta = {
    model: coerceStoredModel(requestedModel),
    requestedModel,
    apiModel: model,
    normalized: normalizeModelForApi(requestedModel) !== coerceStoredModel(requestedModel),
    isDefault: normalizeModelForApi(requestedModel) === normalizeModelForApi(DEFAULT_MODEL),
  };
  const sharedParams = {
    createdConversation,
    shouldGenerateTitle: finalShouldGenerateTitle,
    enableWebSearch,
    WEB_SEARCH_AVAILABLE,
    cookieWeb,
    userId,
    conversationId,
    content,
    contextMessages: messageContext.contextMessages,
    appendToContext: async () => {},
    saveMessage: saveMessageCompat,
    setConversationAutoTitle: async (userId: string, conversationId: string, title: string) => {
      await setConversationAutoTitle(userId, conversationId, title);
    },
    generateOptimisticTitle,
    generateFinalTitle,
  };

  // Route to provider-specific stream
  const stream = await createProviderStream({
    model,
    ai,
    requestedModel,
    finalSysPromptWithCharts,
    contents,
    tools,
    safetySettings,
    toolConfig,
    gemMeta,
    modelMeta,
    sharedParams,
    thinkingLevel,
    regenerate: Boolean(regenerate),
  });

  if (stream instanceof Response) {
    return stream; // Error response from provider init
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}

// --- INTERNAL HELPERS ---

const MAX_SYSTEM_PROMPT_CHARS = 12000;

async function buildSystemPrompt(
  userId: string,
  conversationId: string,
  content: string
): Promise<{ sysPrompt: string; gemLoadError: string }> {
  let sysPrompt = "";
  let gemLoadError = "";

  // Step 1: Load GEM instructions FIRST (highest priority)
  let gemPrompt = "";
  try {
    gemPrompt = await getGemInstructionsForConversation(userId, conversationId);
    if (gemPrompt) {
      coreLogger.info(
        `[GEM ACTIVE] Conversation ${conversationId} has gem instructions (${gemPrompt.length} chars)`
      );
    } else {
      coreLogger.info(`[GEM NONE] Conversation ${conversationId} has no gem applied`);
    }
  } catch (e) {
    const error = e as Error;
    gemLoadError = String(error?.message || "");
  }

  // Step 2: Load Persona instructions (supplementary - lower priority than GEM)
  let personaPrompt = "";
  try {
    personaPrompt = await getPersonaInstructionsForConversation(userId, conversationId);
    if (personaPrompt) {
      coreLogger.info(
        `[PERSONA ACTIVE] Conversation ${conversationId} has persona instructions (${personaPrompt.length} chars)`
      );
    }
  } catch (e) {
    const personaError = e as Error;
    coreLogger.error("Persona load failed (non-blocking):", personaError?.message);
    // Continue without persona - non-blocking
  }

  // Step 3: Compose final system prompt using XML tags (Gemini best practice)
  // Priority order: GEM (task/role) > Persona (style/preferences)
  const promptParts: string[] = [];

  if (gemPrompt) {
    promptParts.push(`<task_instructions>\n${gemPrompt}\n</task_instructions>`);
  }

  if (personaPrompt) {
    promptParts.push(`<style_preferences>\n${personaPrompt}\n</style_preferences>`);
  }

  sysPrompt = promptParts.join("\n\n");

  // Step 4: Token budget guard
  if (sysPrompt.length > MAX_SYSTEM_PROMPT_CHARS) {
    coreLogger.warn(
      `[PROMPT BUDGET] System prompt exceeds ${MAX_SYSTEM_PROMPT_CHARS} chars (${sysPrompt.length}). Truncating persona.`
    );
    // Keep GEM intact (priority), truncate persona
    if (gemPrompt && personaPrompt) {
      const remaining = MAX_SYSTEM_PROMPT_CHARS - gemPrompt.length - 80; // 80 for XML tags
      const truncatedPersona =
        remaining > 100 ? personaPrompt.slice(0, remaining) + "\n[...truncated]" : "";
      sysPrompt = `<task_instructions>\n${gemPrompt}\n</task_instructions>`;
      if (truncatedPersona) {
        sysPrompt += `\n\n<style_preferences>\n${truncatedPersona}\n</style_preferences>`;
      }
    } else {
      sysPrompt = sysPrompt.slice(0, MAX_SYSTEM_PROMPT_CHARS);
    }
  }

  // === RAG: Inject project knowledge base context ===
  try {
    const ragContext = await buildRAGContext(userId, conversationId, content);
    if (ragContext.ragEnabled && ragContext.sources.length > 0) {
      coreLogger.info(
        `[RAG ACTIVE] ${ragContext.sources.length} KB chunks injected for conversation ${conversationId}`
      );
      sysPrompt = injectRAGIntoSystemPrompt(sysPrompt, ragContext);
    }
  } catch (ragError) {
    coreLogger.error("RAG context injection failed:", ragError);
    // Continue without RAG - non-blocking
  }

  return { sysPrompt, gemLoadError };
}

interface CreateProviderStreamParams {
  model: string;
  ai: ReturnType<typeof getGenAIClient>;
  requestedModel: string;
  finalSysPromptWithCharts: string;
  contents: Array<{ role: string; parts: unknown[] }>;
  tools: Array<Record<string, unknown>>;
  safetySettings: unknown[] | null;
  toolConfig: Record<string, unknown> | undefined;
  gemMeta: {
    gemId: string | null;
    hasSystemInstruction: boolean;
    systemInstructionChars: number;
    error: string;
  };
  modelMeta: {
    model: string;
    requestedModel: string;
    apiModel: string;
    normalized: boolean;
    isDefault: boolean;
  };
  sharedParams: Record<string, unknown>;
  thinkingLevel?: string;
  regenerate: boolean;
}

async function createProviderStream(
  params: CreateProviderStreamParams
): Promise<ReadableStream | Response> {
  const {
    model,
    ai,
    finalSysPromptWithCharts,
    contents,
    tools,
    safetySettings,
    toolConfig,
    gemMeta,
    modelMeta,
    sharedParams,
    thinkingLevel,
    regenerate,
  } = params;

  const isDeepSeekDirect = isDeepSeekDirectModel(model);
  const isStandardGroq = model.includes("llama") && !model.includes("/");
  const isOpenRouter = model.includes("/") || model.includes(":free");
  const isClaude = model.startsWith("claude-");

  // AI clients have incompatible interfaces - we use unknown with explicit casts
  // at each streaming call site for type safety without losing flexibility
  let aiClient: unknown = ai;

  if (isDeepSeekDirect) {
    try {
      aiClient = getDeepSeekClient();
    } catch (e) {
      coreLogger.error("DeepSeek Init Error:", e);
      return error(
        "DeepSeek API configuration missing. Add DEEPSEEK_API_KEY to .env",
        500,
        "CONFIG_ERROR"
      );
    }
  } else if (isClaude) {
    try {
      aiClient = getOpenRouterClient();
    } catch (e) {
      coreLogger.error("OpenRouter Init Error (for Claude):", e);
      return error(
        "Claude via OpenRouter configuration missing. Add OPENROUTER_API_KEY to .env",
        500,
        "CONFIG_ERROR"
      );
    }
  } else if (isOpenRouter) {
    try {
      aiClient = getOpenRouterClient();
    } catch (e) {
      coreLogger.error("OpenRouter Init Error:", e);
      return error("OpenRouter configuration missing", 500, "CONFIG_ERROR");
    }
  } else if (isStandardGroq) {
    try {
      aiClient = getGroqClient();
    } catch (e) {
      coreLogger.error("Groq Init Error:", e);
      return error("Groq configuration missing", 500, "CONFIG_ERROR");
    }
  }

  // Map Claude model IDs to OpenRouter format
  const apiModel = isClaude
    ? CLAUDE_API_MODELS.OPENROUTER[model as keyof typeof CLAUDE_API_MODELS.OPENROUTER] ||
      CLAUDE_API_MODELS.OPENROUTER[MODEL_IDS.CLAUDE_HAIKU_45]
    : model;

  const streamParams = {
    ...sharedParams,
    contents,
    sysPrompt: finalSysPromptWithCharts,
    gemMeta,
    modelMeta: { ...modelMeta, apiModel },
  };

  if (isDeepSeekDirect) {
    return createDeepSeekStream({
      ...streamParams,
      ai: aiClient as unknown as OpenAI,
      model: apiModel,
      thinkingLevel,
    } as unknown as Parameters<typeof createDeepSeekStream>[0]);
  }

  if (isClaude && process.env.ANTHROPIC_API_KEY) {
    try {
      aiClient = getClaudeClient();
    } catch (e) {
      coreLogger.error("Claude Init Error:", e);
      return error("Claude configuration missing", 500, "CONFIG_ERROR");
    }

    const claudeModel =
      CLAUDE_API_MODELS.ANTHROPIC[model as keyof typeof CLAUDE_API_MODELS.ANTHROPIC] ||
      CLAUDE_API_MODELS.ANTHROPIC[MODEL_IDS.CLAUDE_HAIKU_45];

    return createAnthropicStream({
      ...streamParams,
      ai: aiClient as unknown as Anthropic,
      model: claudeModel,
      modelMeta: { ...modelMeta, apiModel: claudeModel },
      tools: [],
      safetySettings: null,
      regenerate,
      thinkingLevel,
    } as unknown as Parameters<typeof createAnthropicStream>[0]);
  }

  if (isOpenRouter || isStandardGroq || isClaude) {
    return createOpenAICompatibleStream({
      ...streamParams,
      ai: aiClient as unknown as OpenAI,
      model: apiModel,
      thinkingLevel,
    } as unknown as Parameters<typeof createOpenAICompatibleStream>[0]);
  }

  // Gemini Native — with caching strategies
  return createGeminiStream({
    ai: ai as unknown as ChatStreamParams["ai"],
    model,
    contents,
    finalSysPromptWithCharts,
    tools,
    safetySettings,
    toolConfig,
    gemMeta,
    modelMeta,
    sharedParams,
    thinkingLevel,
    regenerate,
  });
}

interface GeminiStreamParams {
  ai: ChatStreamParams["ai"];
  model: string;
  contents: Array<{ role: string; parts: unknown[] }>;
  finalSysPromptWithCharts: string;
  tools: Array<Record<string, unknown>>;
  safetySettings: unknown[] | null;
  toolConfig: Record<string, unknown> | undefined;
  gemMeta: CreateProviderStreamParams["gemMeta"];
  modelMeta: CreateProviderStreamParams["modelMeta"];
  sharedParams: Record<string, unknown>;
  thinkingLevel?: string;
  regenerate: boolean;
}

async function createGeminiStream(params: GeminiStreamParams): Promise<ReadableStream> {
  const {
    ai,
    model,
    contents,
    finalSysPromptWithCharts,
    tools,
    safetySettings,
    toolConfig,
    gemMeta,
    modelMeta,
    sharedParams,
    thinkingLevel,
    regenerate,
  } = params;

  // ================================================================
  // Strategy B: Composite Cache - cache sysInstruction + tools together
  // Strategy D: KB Cache - cache large project KB documents
  // ================================================================
  let cachedContent: string | undefined;

  // Strategy B: Composite cache (system instruction + tools + toolConfig)
  try {
    const cacheResult = await getOrCreateCompositeCache({
      model,
      systemInstruction: finalSysPromptWithCharts,
      tools: tools.length > 0 ? tools : undefined,
      toolConfig,
    });
    if (cacheResult) {
      cachedContent = cacheResult.cacheName;
      coreLogger.info(
        `[COMPOSITE CACHE] ${cacheResult.cacheHit ? "HIT" : "CREATED"}: ${cachedContent}`
      );
    }
  } catch (cacheErr) {
    coreLogger.error("Composite cache error (non-fatal):", cacheErr);
    // Continue without cache - standard request
  }

  return createChatReadableStream({
    ai,
    model,
    contents,
    sysPrompt: finalSysPromptWithCharts,
    tools,
    safetySettings,
    toolConfig,
    cachedContent,
    gemMeta,
    modelMeta: { ...modelMeta, apiModel: model },
    ...sharedParams,
    regenerate,
    thinkingLevel,
  } as unknown as Parameters<typeof createChatReadableStream>[0]);
}
