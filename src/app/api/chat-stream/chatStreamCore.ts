// /app/api/chat-stream/chatStreamCore.ts
// Thin orchestrator — delegates to extracted modules

import { z } from "zod";
import type OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import { getGenAIClient } from "@/lib/core/genaiClient";
import { getGroqClient } from "@/lib/core/groqClient";
import { getOpenRouterClient } from "@/lib/core/openRouterClient";
import { getClaudeClient } from "@/lib/core/claudeClient";
import {
  DEFAULT_MODEL,
  normalizeModelForApi,
  coerceStoredModel,
  isDeepSeekV4ProModel,
  isDeepSeekV41FlashModel,
  isGroqModel,
  isStrataLocalModel,
} from "@/lib/core/modelRegistry";
import { CLAUDE_API_MODELS, MODEL_IDS, STRATA_DEFAULTS } from "@/lib/utils/constants";
import { getStrataAdmission } from "@/lib/core/strataQueue";
import type { StrataSamplingInput } from "@/lib/features/local-llm/strataThinking";
import { getOrCreateCompositeCache } from "@/lib/core/contextCache";
import { assertModelAllowedForUser, getUserLimits } from "@/lib/core/limits";
import { error } from "@/lib/utils/apiResponse";
import { AppError } from "@/lib/utils/errors";
import { saveMessage as insertUserMessage, upsertMessage } from "@/lib/features/chat/messages";
import { linkFilesToMessage } from "@/lib/features/files/fileService.server";
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
  createStrataStream,
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
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return error("Invalid JSON body", 400, "VALIDATION_ERROR");
  }

  let body: ChatStreamRequest;
  try {
    body = chatStreamRequestSchema.parse(rawBody);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      const firstIssue = e.issues[0];
      const field = firstIssue?.path.join(".");
      const msg = field
        ? `Validation error: ${field} - ${firstIssue.message}`
        : `Validation error: ${firstIssue?.message || "Invalid request body"}`;
      return error(msg, 400, "VALIDATION_ERROR");
    }
    return error("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const {
    conversationId: conversationIdRaw,
    content,
    regenerate,
    truncateMessageId,
    truncateClientMessageId,
    clientMessageId,
    skipSaveUserMessage,
    thinkingLevel,
    strataSampling,
    fileIds,
  } = body;

  // Load user limits BEFORE loadOrCreateConversation so rejected (403/503) requests
  // never create orphan conversation rows, and reuse limits for model + web search checks.
  const userLimits = await getUserLimits(userId);

  // Load or create conversation
  let convContext: ConversationContext;
  try {
    convContext = await loadOrCreateConversation(userId, conversationIdRaw);
  } catch (e) {
    if (e instanceof AppError) throw e;
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

  // Enforce rank-based model access using preloaded limits (avoids duplicate DB lookup)
  await assertModelAllowedForUser(userId, model, userLimits);

  // Pre-DB admission check for Local Strata LLM (M-1):
  // Reject with 503 LOCAL_LLM_DISABLED or 429 LOCAL_LLM_BUSY before mutating DB or messages.
  const isLocalModel = isStrataLocalModel(model);
  if (isLocalModel) {
    const admission = getStrataAdmission();
    if (!admission.ok) {
      return error(admission.message, admission.status, admission.code);
    }
  }

  const createdConversation = convContext.isNew ? conversation : null;
  const finalShouldGenerateTitle = shouldGenerateTitle && !regenerate;

  // Handle message truncation/regeneration
  await handleMessageTruncation(
    userId,
    conversationId,
    truncateMessageId,
    regenerate,
    truncateClientMessageId
  );

  // Save user message (with fileIds in meta if present)
  if (!skipSaveUserMessage) {
    try {
      const userMeta = fileIds && fileIds.length > 0 ? { fileIds } : undefined;
      const savedUserMsg = await insertUserMessage(
        userId,
        conversationId,
        "user",
        content,
        userMeta
      );
      if (fileIds && fileIds.length > 0 && savedUserMsg?.id) {
        await linkFilesToMessage(userId, conversationId, fileIds, savedUserMsg.id);
      }
    } catch (e) {
      const errorMsg = e as Error;
      return error(errorMsg?.message || "Failed to save user message", 500, "MESSAGE_SAVE_ERROR");
    }
  }

  // Load system prompt - GEM always takes priority (parallelized with preloaded IDs)
  const { sysPrompt, gemLoadError, ragSources } = await buildSystemPrompt(
    userId,
    conversationId,
    content,
    {
      gemId: conversation?.gemId,
      personaId: conversation?.personaId,
      projectId: conversation?.projectId,
    }
  );

  // Build message context with smart token window
  const messageContext = await buildMessageContext(
    conversationId,
    content,
    sysPrompt,
    modelLimitTokens,
    { skipSlidingTrim: isLocalModel }
  );

  // Process files + attachments (provider-aware, with priority for newly attached files)
  const { contents, sysPrompt: finalSysPrompt } = await processAttachments(
    userId,
    conversationId,
    messageContext.contents,
    sysPrompt,
    messageContext.currentTokenCount,
    isLocalModel ? STRATA_DEFAULTS.RAW_CONTEXT_CEILING_TOKENS : modelLimitTokens,
    model,
    fileIds,
    messageContext.contentsMeta,
    req?.signal
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

  // Setup web search (server-enforced against preloaded user rank limits) and safety settings
  const cookies = parseCookieHeader(req?.headers?.get?.("cookie") || undefined);
  const { enableWebSearch, WEB_SEARCH_AVAILABLE } = getWebSearchConfig(
    cookies,
    userLimits.features.web_search === true
  );
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
  const upsertAssistantMessage = async ({
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
    const enrichedMeta: Record<string, unknown> = {
      ...(meta || {}),
      ...(clientMessageId ? { clientMessageId } : {}),
    };
    const res = await upsertMessage(
      userId,
      conversationId,
      role,
      content,
      enrichedMeta,
      clientMessageId || undefined
    );
    return res.message;
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
    upsertAssistantMessage,
    setConversationAutoTitle: async (userId: string, conversationId: string, title: string) => {
      await setConversationAutoTitle(userId, conversationId, title);
    },
    generateOptimisticTitle,
    generateFinalTitle,
    clientMessageId: clientMessageId || undefined,
    signal: req.signal,
    ragSources,
  };

  // Route to provider-specific stream
  const stream = await createProviderStream({
    model,
    requestedModel,
    finalSysPromptWithCharts,
    contents,
    contentsMeta: messageContext.contentsMeta,
    tools,
    safetySettings,
    toolConfig,
    gemMeta,
    modelMeta,
    sharedParams,
    thinkingLevel,
    strataSampling,
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
  content: string,
  preloaded?: {
    gemId?: string | null;
    personaId?: string | null;
    projectId?: string | null;
  }
): Promise<{
  sysPrompt: string;
  gemLoadError: string;
  ragSources: Array<{ filename: string; documentId: string; chunkId: string; similarity: number }>;
}> {
  let sysPrompt = "";
  let gemLoadError = "";
  let ragSources: Array<{
    filename: string;
    documentId: string;
    chunkId: string;
    similarity: number;
  }> = [];

  // Run independent read queries (GEM, Persona, RAG) concurrently to reduce TTFT
  const [gemResult, personaResult, ragResult] = await Promise.all([
    getGemInstructionsForConversation(userId, conversationId, preloaded?.gemId)
      .then((prompt) => ({ ok: true as const, prompt }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    getPersonaInstructionsForConversation(userId, conversationId, preloaded?.personaId)
      .then((prompt) => ({ ok: true as const, prompt }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    buildRAGContext(
      userId,
      conversationId,
      content,
      preloaded?.projectId !== undefined ? { projectId: preloaded.projectId } : undefined
    )
      .then((ragContext) => ({ ok: true as const, ragContext }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
  ]);

  // Step 1: GEM instructions (highest priority)
  let gemPrompt = "";
  if (gemResult.ok) {
    gemPrompt = gemResult.prompt;
    if (gemPrompt) {
      coreLogger.info(
        `[GEM ACTIVE] Conversation ${conversationId} has gem instructions (${gemPrompt.length} chars)`
      );
    } else {
      coreLogger.info(`[GEM NONE] Conversation ${conversationId} has no gem applied`);
    }
  } else {
    const err = gemResult.error as Error;
    gemLoadError = String(err?.message || "");
  }

  // Step 2: Persona instructions (supplementary - lower priority than GEM)
  let personaPrompt = "";
  if (personaResult.ok) {
    personaPrompt = personaResult.prompt;
    if (personaPrompt) {
      coreLogger.info(
        `[PERSONA ACTIVE] Conversation ${conversationId} has persona instructions (${personaPrompt.length} chars)`
      );
    }
  } else {
    const personaError = personaResult.error as Error;
    coreLogger.error("Persona load failed (non-blocking):", personaError?.message);
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

  // Step 5: Inject RAG project knowledge base context
  if (ragResult.ok) {
    const { ragContext } = ragResult;
    if (ragContext.ragEnabled && ragContext.sources.length > 0) {
      ragSources = ragContext.sources;
      coreLogger.info(
        `[RAG ACTIVE] ${ragContext.sources.length} KB chunks injected for conversation ${conversationId}`
      );
      sysPrompt = injectRAGIntoSystemPrompt(sysPrompt, ragContext);
    }
  } else {
    coreLogger.error("RAG context injection failed:", ragResult.error);
  }

  return { sysPrompt, gemLoadError, ragSources };
}

interface CreateProviderStreamParams {
  model: string;
  requestedModel: string;
  finalSysPromptWithCharts: string;
  contents: Array<{ role: string; parts: unknown[] }>;
  contentsMeta?: Array<{ messageId?: string; fileIds?: string[] }>;
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
  strataSampling?: StrataSamplingInput;
  regenerate: boolean;
}

async function createProviderStream(
  params: CreateProviderStreamParams
): Promise<ReadableStream | Response> {
  const {
    model,
    finalSysPromptWithCharts,
    contents,
    contentsMeta,
    tools,
    safetySettings,
    toolConfig,
    gemMeta,
    modelMeta,
    sharedParams,
    thinkingLevel,
    strataSampling,
    regenerate,
  } = params;

  if (isStrataLocalModel(model)) {
    return createStrataStream({
      ...sharedParams,
      model,
      sysPrompt: finalSysPromptWithCharts,
      contents,
      contentsMeta,
      gemMeta,
      modelMeta: { ...modelMeta, apiModel: model },
      thinkingLevel: thinkingLevel as
        | "off"
        | "low"
        | "medium"
        | "high"
        | "minimal"
        | "xhigh"
        | undefined,
      strataSampling,
      regenerate,
    } as unknown as Parameters<typeof createStrataStream>[0]);
  }

  const isGroq = isGroqModel(model);
  const isDeepSeekV4Pro = isDeepSeekV4ProModel(model);
  const isDeepSeekV41Flash = isDeepSeekV41FlashModel(model);
  const isOpenRouter = !isGroq && (model.includes("/") || model.includes(":free"));
  const isClaude = model.startsWith("claude-");
  const useDirectAnthropic = isClaude && Boolean(process.env.ANTHROPIC_API_KEY);

  // Map Claude model IDs to OpenRouter format when falling back to OpenRouter
  const apiModel =
    isClaude && !useDirectAnthropic
      ? CLAUDE_API_MODELS.OPENROUTER[model as keyof typeof CLAUDE_API_MODELS.OPENROUTER] ||
        CLAUDE_API_MODELS.OPENROUTER[MODEL_IDS.CLAUDE_HAIKU_55]
      : model;

  const streamParams = {
    ...sharedParams,
    contents,
    sysPrompt: finalSysPromptWithCharts,
    gemMeta,
    modelMeta: { ...modelMeta, apiModel },
  };

  // Direct Anthropic Claude takes precedence over OpenRouter (does not require OPENROUTER_API_KEY)
  if (useDirectAnthropic) {
    let claudeClient: Anthropic;
    try {
      claudeClient = getClaudeClient();
    } catch (e: unknown) {
      coreLogger.error("Claude Init Error:", e);
      return error("Claude configuration missing", 500, "CONFIG_ERROR");
    }

    const claudeModel =
      CLAUDE_API_MODELS.ANTHROPIC[model as keyof typeof CLAUDE_API_MODELS.ANTHROPIC] ||
      CLAUDE_API_MODELS.ANTHROPIC[MODEL_IDS.CLAUDE_HAIKU_55];

    return createAnthropicStream({
      ...streamParams,
      ai: claudeClient,
      model: claudeModel,
      modelMeta: { ...modelMeta, apiModel: claudeModel },
      tools: [],
      safetySettings: null,
      regenerate,
      thinkingLevel,
    } as unknown as Parameters<typeof createAnthropicStream>[0]);
  }

  // DeepSeek V4 Pro / V4.1 Flash (via OpenRouter)
  if (isDeepSeekV4Pro || isDeepSeekV41Flash) {
    let deepSeekClient: OpenAI;
    try {
      deepSeekClient = getOpenRouterClient();
    } catch (e: unknown) {
      coreLogger.error("OpenRouter Init Error (for DeepSeek V4):", e);
      return error(
        "OpenRouter configuration missing. Add OPENROUTER_API_KEY to .env",
        500,
        "CONFIG_ERROR"
      );
    }

    return createDeepSeekStream({
      ...streamParams,
      ai: deepSeekClient,
      model: apiModel,
      thinkingLevel,
    } as unknown as Parameters<typeof createDeepSeekStream>[0]);
  }

  // OpenRouter / Groq / Claude-via-OpenRouter
  if (isOpenRouter || isGroq || isClaude) {
    let openAiClient: OpenAI;
    try {
      openAiClient = isGroq ? getGroqClient() : getOpenRouterClient();
    } catch (e: unknown) {
      coreLogger.error(isGroq ? "Groq Init Error:" : "OpenRouter Init Error:", e);
      return error(
        isClaude
          ? "Claude via OpenRouter configuration missing. Add OPENROUTER_API_KEY to .env"
          : isGroq
            ? "Groq configuration missing"
            : "OpenRouter configuration missing",
        500,
        "CONFIG_ERROR"
      );
    }

    return createOpenAICompatibleStream({
      ...streamParams,
      ai: openAiClient,
      model: apiModel,
      thinkingLevel,
    } as unknown as Parameters<typeof createOpenAICompatibleStream>[0]);
  }

  // Gemini Native — initialize GenAI client lazily only when a Gemini model is requested
  let ai: ReturnType<typeof getGenAIClient>;
  try {
    ai = getGenAIClient();
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "AI service unavailable";
    return error(errorMsg || "AI service unavailable", 500, "AI_SERVICE_ERROR");
  }

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
  // Skip composite caching when per-query RAG chunks are injected into the system prompt
  const ragSourcesList = Array.isArray(sharedParams.ragSources) ? sharedParams.ragSources : [];
  const cacheUserId = typeof sharedParams.userId === "string" ? sharedParams.userId : "";
  if (ragSourcesList.length === 0 && cacheUserId) {
    try {
      const cacheResult = await getOrCreateCompositeCache({
        userId: cacheUserId,
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
