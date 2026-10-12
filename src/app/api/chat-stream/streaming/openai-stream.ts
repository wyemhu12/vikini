// /app/api/chat-stream/streaming/openai-stream.ts
import OpenAI from "openai";
import {
  isDeepSeekV32Model,
  isOpenRouterReasoningModel,
  isGLMModel,
  GLM_MAX_OUTPUT_TOKENS,
} from "@/lib/core/modelRegistry";

import { StreamTimeoutError, type ChatStreamParams, type Message } from "./types";
import { sendEvent, getStreamTimeout, withTimeout, withIdleTimeout, streamLogger } from "./utils";
import { sendInitialMetaEvents, generateAndSendOptimisticTitle } from "./gemini-stream";
import { processPostStream } from "./post-processing";
import { balanceThinkTags, stripThinkTags } from "@/lib/features/chat/thinkTags";
import { sendThinkingChunk, accumulateReasoning } from "./reasoningStreamHelper.server";

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
  thinkingLevel?: string;
  clientMessageId?: string;
  signal?: AbortSignal;
  ragSources?: Array<{ filename: string; documentId: string; chunkId: string; similarity: number }>;
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
    thinkingLevel,
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
    const trimmedReasoning = acc.reasoning?.trim() || "";
    if (trimmed || trimmedReasoning) {
      const balanced = balanceThinkTags(trimmed);
      try {
        await saveMessage({
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
      } catch (saveErr) {
        streamLogger.error("Failed to save partial message in OpenAI safety net:", saveErr);
      }
    }
  };

  return new ReadableStream({
    cancel() {
      isCancelled = true;
      ac.abort();
    },
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
        ragSources,
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
      let fullReasoning = "";
      let streamFailed = false;

      try {
        // Map contents to OpenAI format with multimodal support
        // contents from chatStreamCore is [{ role: "user", parts: [{text: ""}, {inlineData: {data, mimeType}}] }]
        // OpenAI expects: [{ role: "user", content: [{type: "text", text: ""}, {type: "image_url", image_url: {url: "data:..."}}] }]
        type GeminiPart = { text?: string; inlineData?: { data: string; mimeType: string } };

        // Handle OpenRouter reasoning models (e.g. Grok 4.3)
        const isOrReasoning = isOpenRouterReasoningModel(model);

        const openAIMessages = [
          { role: "system" as const, content: sysPrompt },
          ...(contents as Array<{ role: string; parts: GeminiPart[] }>)
            .map((m) => {
              const hasImages = m.parts.some((p) => p.inlineData);
              const rawContent = m.parts.map((p) => p.text || "").join("");
              const isModel = m.role === "model";
              // Strip <think> tags from old history to avoid sending raw thought blocks to model (m-16)
              const cleanContent = isModel ? stripThinkTags(rawContent) : rawContent;

              if (hasImages) {
                if (isModel) {
                  // OpenAI spec prohibits image_url in assistant role -> degrade to pure text (m-2)
                  return {
                    role: "assistant" as const,
                    content: cleanContent,
                  };
                }
                // Multimodal user message: use content array format
                const contentParts: Array<
                  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
                > = [];
                if (cleanContent) {
                  contentParts.push({ type: "text" as const, text: cleanContent });
                }
                for (const p of m.parts) {
                  if (p.inlineData) {
                    contentParts.push({
                      type: "image_url" as const,
                      image_url: {
                        url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
                      },
                    });
                  }
                }
                return {
                  role: "user" as const,
                  content: contentParts,
                };
              }

              return {
                role: isModel ? ("assistant" as const) : m.role,
                content: cleanContent,
              };
            })
            .filter((m) => {
              if (m.role === "assistant" && typeof m.content === "string") {
                return m.content.trim().length > 0;
              }
              return true;
            }),
        ] as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

        const timeoutMs = getStreamTimeout(model);

        // Inject OpenRouter web_search server tool for DeepSeek V3.2
        const useOpenRouterWebSearch = isDeepSeekV32Model(model) && enableWebSearch;

        const maxTokens = isGLMModel(model) ? GLM_MAX_OUTPUT_TOKENS : 8192;

        const createParams: Record<string, unknown> = {
          model: model,
          messages: openAIMessages,
          stream: true,
          stream_options: { include_usage: true },
          temperature: 0.7,
          max_tokens: maxTokens,
        };

        if (isGLMModel(model)) {
          createParams.provider = {
            order: ["CoreWeave"],
            quantizations: ["fp4"],
          };
        }

        if (isOrReasoning) {
          const isGlm = isGLMModel(model);
          const isThinkingOff = thinkingLevel === "off" || (isGlm && !thinkingLevel);

          if (isThinkingOff) {
            // Tắt suy luận cho GLM khi undefined hoặc "off"; cho Grok chỉ khi "off"
            createParams.reasoning = { enabled: false };
          } else if (thinkingLevel) {
            const effort = isGlm
              ? "high" // GLM 5.2 chỉ hỗ trợ ["xhigh", "high"]
              : thinkingLevel === "high"
                ? "high"
                : "low"; // Grok 4.3 hỗ trợ low/medium/high
            createParams.reasoning = { effort };
          }
          // Khi Grok 4.3 nhận thinkingLevel === undefined, không gắn createParams.reasoning,
          // bảo toàn mặc định của OpenRouter (effort: "low")
        }

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
          createParams as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
          { signal: ac.signal }
        );

        const stream = await withTimeout(streamPromise, timeoutMs);
        const idleTimeoutMs = Math.max(timeoutMs / 2, 30_000);
        const guardedStream = withIdleTimeout(stream, idleTimeoutMs);

        // Track usage from final chunk
        let promptTokens: number | undefined;
        let completionTokens: number | undefined;
        let totalTokens: number | undefined;
        let reasoningTokens: number | undefined;
        for await (const chunk of guardedStream) {
          if (isCancelled || ac.signal.aborted) {
            break;
          }

          // OpenRouter streams reasoning in delta.reasoning_details or delta.reasoning
          // We cast to access custom fields
          const delta = (chunk.choices[0]?.delta as Record<string, unknown>) || {};

          const reasoningDeltaRaw = delta.reasoning_details || delta.reasoning || "";
          let reasoningDelta = "";
          if (typeof reasoningDeltaRaw === "string") {
            reasoningDelta = reasoningDeltaRaw;
          } else if (Array.isArray(reasoningDeltaRaw)) {
            reasoningDelta = reasoningDeltaRaw
              .map((r: unknown) => {
                if (typeof r === "string") return r;
                const rec = r as Record<string, unknown>;
                return (rec?.text as string) || (rec?.content as string) || "";
              })
              .join("");
          } else if (typeof reasoningDeltaRaw === "object" && reasoningDeltaRaw !== null) {
            const rAny = reasoningDeltaRaw as Record<string, unknown>;
            reasoningDelta = (rAny.text as string) || (rAny.content as string) || "";
          }

          if (reasoningDelta) {
            fullReasoning = accumulateReasoning(fullReasoning, reasoningDelta);
            acc.reasoning = fullReasoning;
            sendThinkingChunk(controller, reasoningDelta);
          }

          const text = (delta.content || "") as string;
          if (text) {
            full += text;
            acc.full = full;
            sendEvent(controller, "token", { t: text });
          }

          // OpenAI/OpenRouter returns usage in final chunk when stream_options.include_usage is true
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens;
            completionTokens = chunk.usage.completion_tokens;
            totalTokens = chunk.usage.total_tokens;

            const usageAny = chunk.usage as unknown as Record<string, unknown>;
            if (usageAny.reasoningTokens) {
              reasoningTokens = usageAny.reasoningTokens as number;
            } else if (
              usageAny.completion_tokens_details &&
              typeof usageAny.completion_tokens_details === "object"
            ) {
              const details = usageAny.completion_tokens_details as Record<string, unknown>;
              reasoningTokens = details.reasoning_tokens as number;
            }
          }
        }

        // Send usage metadata if available
        if (totalTokens !== undefined) {
          sendEvent(controller, "meta", {
            type: "usageMetadata",
            promptTokenCount: promptTokens,
            candidatesTokenCount: completionTokens,
            totalTokenCount: totalTokens,
            thoughtsTokenCount: reasoningTokens,
          });
        }
      } catch (e) {
        streamFailed = true;
        if (isCancelled || ac.signal.aborted) {
          await savePartialOnce();
        } else {
          // If stream failed unexpectedly but accumulated some content, save it too
          await savePartialOnce();
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

            const errorMessage = err.error?.message || err.message || "Stream error";
            const isInsufficientCredits =
              err.status === 402 || /insufficient credits|credit balance/i.test(errorMessage);
            const isContextOverflow =
              err.status === 400 &&
              /context length|maximum context|context_length_exceeded/i.test(errorMessage);
            const isTokenLimit =
              err.status === 413 || err.code === "rate_limit_exceeded" || isContextOverflow;

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

            if (isInsufficientCredits) {
              sendEvent(controller, "error", {
                message: "OpenRouter account balance is insufficient. Please check credits.",
                code: "INSUFFICIENT_CREDITS",
                status: 402,
                isInsufficientCredits: true,
              });
            } else if (isTokenLimit) {
              sendEvent(controller, "error", {
                message: errorMessage,
                code: isContextOverflow
                  ? "CONTEXT_LENGTH_EXCEEDED"
                  : err.code || "token_limit_exceeded",
                status: err.status || 400,
                isTokenLimit: true,
                tokenInfo,
              });
            } else {
              sendEvent(controller, "error", {
                message: errorMessage,
                code: err.code || "stream_error",
                status: err.status || 500,
              });
            }
          }
        }
      }

      // Mandatory gate check right before processPostStream (S1)
      if (isCancelled || ac.signal.aborted) {
        await savePartialOnce();
        sendEvent(controller, "done", { ok: false });
        try {
          controller.close();
        } catch {
          // Ignore if already closed
        }
        return;
      }

      // 3. Post Stream Processing — skip if stream failed with no content and no reasoning
      if (!streamFailed || full.trim() || fullReasoning.trim()) {
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
          saveMessage,
          setConversationAutoTitle,
          generateFinalTitle,
          model,
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
