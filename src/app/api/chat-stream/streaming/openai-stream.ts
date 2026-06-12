// /app/api/chat-stream/streaming/openai-stream.ts
import OpenAI from "openai";
import { isDeepSeekV32Model } from "@/lib/core/modelRegistry";

import { StreamTimeoutError, type ChatStreamParams, type Message } from "./types";
import { sendEvent, getStreamTimeout, withTimeout, streamLogger } from "./utils";
import { sendInitialMetaEvents, generateAndSendOptimisticTitle } from "./gemini-stream";
import { processPostStream } from "./post-processing";

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
        // Map contents to OpenAI format with multimodal support
        // contents from chatStreamCore is [{ role: "user", parts: [{text: ""}, {inlineData: {data, mimeType}}] }]
        // OpenAI expects: [{ role: "user", content: [{type: "text", text: ""}, {type: "image_url", image_url: {url: "data:..."}}] }]
        type GeminiPart = { text?: string; inlineData?: { data: string; mimeType: string } };
        const openAIMessages = [
          { role: "system" as const, content: sysPrompt },
          ...(contents as Array<{ role: string; parts: GeminiPart[] }>).map((m) => {
            const hasImages = m.parts.some((p) => p.inlineData);
            if (hasImages) {
              // Multimodal message: use content array format
              const contentParts: Array<
                { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
              > = [];
              for (const p of m.parts) {
                if (p.inlineData) {
                  contentParts.push({
                    type: "image_url" as const,
                    image_url: {
                      url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
                    },
                  });
                } else if (p.text) {
                  contentParts.push({ type: "text" as const, text: p.text });
                }
              }
              return {
                role: m.role === "model" ? "assistant" : m.role,
                content: contentParts,
              };
            }
            // Text-only message: use simple string content
            return {
              role: m.role === "model" ? "assistant" : m.role,
              content: m.parts.map((p) => p.text || "").join(""),
            };
          }),
        ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

        const timeoutMs = getStreamTimeout(model);

        // Inject OpenRouter web_search server tool for DeepSeek V3.2
        const useOpenRouterWebSearch = isDeepSeekV32Model(model) && enableWebSearch;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createParams: Record<string, any> = {
          model: model,
          messages: openAIMessages,
          stream: true,
          stream_options: { include_usage: true },
          temperature: 0.7,
          max_tokens: 8192,
        };

        if (useOpenRouterWebSearch) {
          createParams.tools = [
            {
              type: "openrouter:web_search",
              parameters: {
                max_results: 5,
                search_context_size: "low",
              },
            },
          ];
          streamLogger.info(`[WEB SEARCH] OpenRouter web_search tool injected for model: ${model}`);
        }

        const streamPromise = ai.chat.completions.create(
          createParams as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
        );

        const stream = await withTimeout(streamPromise, timeoutMs);

        // Track usage from final chunk
        let promptTokens: number | undefined;
        let completionTokens: number | undefined;
        let totalTokens: number | undefined;

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            full += text;
            sendEvent(controller, "token", { t: text });
          }

          // OpenAI/OpenRouter returns usage in final chunk when stream_options.include_usage is true
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens;
            completionTokens = chunk.usage.completion_tokens;
            totalTokens = chunk.usage.total_tokens;
          }
        }

        // Send usage metadata if available
        if (totalTokens !== undefined) {
          sendEvent(controller, "meta", {
            type: "usageMetadata",
            promptTokenCount: promptTokens,
            candidatesTokenCount: completionTokens,
            totalTokenCount: totalTokens,
          });
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
        model,
      });

      sendEvent(controller, "done", { ok: true });
      controller.close();
    },
  });
}
