// /app/api/chat-stream/streaming/openai-stream.ts
import OpenAI from "openai";
import { isDeepSeekV32Model, isOpenRouterReasoningModel } from "@/lib/core/modelRegistry";

import { StreamTimeoutError, type ChatStreamParams, type Message } from "./types";
import { sendEvent, getStreamTimeout, withTimeout, withIdleTimeout, streamLogger } from "./utils";
import { sendInitialMetaEvents, generateAndSendOptimisticTitle } from "./gemini-stream";
import { processPostStream } from "./post-processing";
import { balanceThinkTags } from "@/lib/features/chat/thinkTags";

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

  const acc = { full: "" };
  let savedPartial = false;

  const savePartialOnce = async () => {
    if (savedPartial) return;
    savedPartial = true;
    const trimmed = acc.full.trim();
    if (trimmed) {
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
      let streamFailed = false;

      try {
        // Map contents to OpenAI format with multimodal support
        // contents from chatStreamCore is [{ role: "user", parts: [{text: ""}, {inlineData: {data, mimeType}}] }]
        // OpenAI expects: [{ role: "user", content: [{type: "text", text: ""}, {type: "image_url", image_url: {url: "data:..."}}] }]
        type GeminiPart = { text?: string; inlineData?: { data: string; mimeType: string } };

        // Handle OpenRouter reasoning models (e.g. Grok 4.3)
        // Extract <think> from assistant messages and map to reasoning_details if needed
        const isOrReasoning = isOpenRouterReasoningModel(model);

        const openAIMessages = [
          { role: "system" as const, content: sysPrompt },
          ...(contents as Array<{ role: string; parts: GeminiPart[] }>)
            .map((m) => {
              const hasImages = m.parts.some((p) => p.inlineData);

              let messageContent = m.parts.map((p) => p.text || "").join("");
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let reasoningDetails: any = undefined;

              // If it's an OpenRouter reasoning model and an assistant message,
              // extract the <think>...</think> tag and put it in reasoning_details
              if (isOrReasoning && m.role === "model" && messageContent.includes("<think>")) {
                const thinkMatch = messageContent.match(/<think>([\s\S]*?)<\/think>/);
                if (thinkMatch) {
                  // OpenRouter accepts reasoning_details as a string or array?
                  // The safest is sending it as it came out or as string. We'll pass it as text.
                  // Or maybe just leave the <think> tags. Actually OpenRouter recommends passing them back in reasoning_details array.
                  reasoningDetails = [{ type: "text", text: thinkMatch[1].trim() }];
                  messageContent = messageContent
                    .replace(/<think>[\s\S]*?<\/think>\n?/g, "")
                    .trim();
                }
              }

              if (hasImages) {
                // Multimodal message: use content array format
                const contentParts: Array<
                  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
                > = [];
                if (messageContent) {
                  contentParts.push({ type: "text" as const, text: messageContent });
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
                const msg: Record<string, unknown> = {
                  role: "assistant" as const,
                  content: contentParts,
                };
                if (reasoningDetails) msg.reasoning_details = reasoningDetails;
                return msg;
              }
              const msg: Record<string, unknown> = {
                role: m.role === "model" ? "assistant" : m.role,
                content: messageContent,
              };
              if (reasoningDetails) msg.reasoning_details = reasoningDetails;
              return msg;
            })
            .filter((m): m is Record<string, unknown> => {
              if (m.role === "assistant") {
                if (typeof m.content === "string") {
                  return m.content.trim().length > 0;
                }
                if (Array.isArray(m.content)) {
                  return m.content.length > 0;
                }
              }
              return true;
            }),
        ] as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

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

        if (isOrReasoning && thinkingLevel) {
          createParams.reasoning = {
            effort: thinkingLevel === "high" ? "high" : "low",
          };
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
          createParams as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
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

        let inReasoningMode = false;

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
            // It's likely an array of objects like [{ type: "text", text: "..." }]
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
            if (!inReasoningMode) {
              inReasoningMode = true;
              full += "<think>\n";
              acc.full = full;
              sendEvent(controller, "token", { t: "<think>\n" });
            }
            full += reasoningDelta;
            acc.full = full;
            sendEvent(controller, "token", { t: reasoningDelta });
          }

          const text = (delta.content || "") as string;
          if (text) {
            if (inReasoningMode) {
              inReasoningMode = false;
              full += "\n</think>\n\n";
              acc.full = full;
              sendEvent(controller, "token", { t: "\n</think>\n\n" });
            }
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

      // 3. Post Stream Processing — skip if stream failed with no content
      if (!streamFailed || full.trim()) {
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
