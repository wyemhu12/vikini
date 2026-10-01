// /app/api/chat-stream/streaming/deepseek-stream.ts
import OpenAI from "openai";

import { buildDeepSeekRequestBody, mapDeepSeekEffort } from "./deepseek-request-builder";
import { StreamTimeoutError, type ChatStreamParams, type Message } from "./types";
import { sendEvent, getStreamTimeout, withTimeout, withIdleTimeout, streamLogger } from "./utils";
import { sendInitialMetaEvents, generateAndSendOptimisticTitle } from "./gemini-stream";
import { processPostStream } from "./post-processing";
import { balanceThinkTags } from "@/lib/features/chat/thinkTags";

/**
 * DeepSeek V4 streaming with native thinking mode support.
 *
 * Key features:
 * 1. OpenRouter reasoning routing: Relace, Together, Novita, DeepSeek (allow_fallbacks)
 * 2. Maps thinkingLevel -> reasoning_effort (Flash: "high"/"low", Pro: "xhigh"/"high", Direct: "max"/"high")
 * 3. Token budget: Flash 384k, Pro 65k, Direct 16k
 * 4. Parses delta.reasoning_content -> injects <think> tags
 * 5. CoT deliberation vs Empty answer detection: sends meta event emptyAnswerNotice
 * 6. Completely empty stream detection: sends error event empty_response (502)
 */
export function createDeepSeekStream(params: {
  ai: OpenAI;
  model: string;
  contents: unknown[];
  sysPrompt: string;
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
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
  clientMessageId?: string;
  signal?: AbortSignal;
}): ReadableStream<Uint8Array> {
  const {
    ai,
    model,
    contents,
    sysPrompt,
    thinkingLevel,
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
        streamLogger.error("Failed to save partial message in DeepSeek safety net:", saveErr);
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
      let isInThinkingBlock = false;
      let streamFailed = false;
      let emptyAnswerReason: "length" | "no_content" | undefined;

      try {
        const { effectiveSysPromptPrefix } = mapDeepSeekEffort(model, thinkingLevel);
        const effectiveSysPrompt = effectiveSysPromptPrefix
          ? effectiveSysPromptPrefix + sysPrompt
          : sysPrompt;

        // Map contents to OpenAI format (same as createOpenAICompatibleStream)
        type GeminiPart = { text?: string; inlineData?: { data: string; mimeType: string } };
        const openAIMessages = [
          { role: "system" as const, content: effectiveSysPrompt },
          ...(contents as Array<{ role: string; parts: GeminiPart[] }>).map((m) => {
            const hasImages = m.parts.some((p) => p.inlineData);
            if (hasImages) {
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
            return {
              role: m.role === "model" ? "assistant" : m.role,
              content: m.parts.map((p) => p.text || "").join(""),
            };
          }),
        ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

        const timeoutMs = getStreamTimeout(model, thinkingLevel);

        const requestBody = buildDeepSeekRequestBody({
          model,
          messages: openAIMessages,
          thinkingLevel,
          modelMeta,
        });

        const streamPromise = ai.chat.completions.create(
          requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
          { signal: ac.signal }
        );

        const stream = await withTimeout(streamPromise, timeoutMs);
        // Wrap with idle timeout — if no chunk arrives within half the total timeout, abort
        const idleTimeoutMs = Math.max(timeoutMs / 2, 30_000);
        const guardedStream = withIdleTimeout(stream, idleTimeoutMs);

        // Track usage from final chunk
        let promptTokens: number | undefined;
        let completionTokens: number | undefined;
        let totalTokens: number | undefined;
        let reasoningTokens: number | undefined;
        let lastFinishReason: string | undefined;

        for await (const chunk of guardedStream) {
          if (isCancelled || ac.signal.aborted) {
            break;
          }

          const choice = chunk.choices[0];
          if (choice?.finish_reason) {
            lastFinishReason = choice.finish_reason;
          }

          // Cast delta to access reasoning_content (not in OpenAI SDK types)
          const delta = choice?.delta as
            | {
                content?: string | null;
                reasoning_content?: string | null;
                reasoning?: string | null;
              }
            | undefined;

          // Handle reasoning_content (thinking/CoT tokens)
          // OpenRouter may use `reasoning_content` or `reasoning` depending on version
          const reasoningText = delta?.reasoning_content || delta?.reasoning;
          if (reasoningText) {
            if (!isInThinkingBlock) {
              isInThinkingBlock = true;
              const openTag = "<think>";
              full += openTag;
              acc.full = full;
              sendEvent(controller, "token", { t: openTag });
            }
            full += reasoningText;
            acc.full = full;
            sendEvent(controller, "token", { t: reasoningText });
          }

          // Handle regular content
          if (delta?.content) {
            // Close thinking block when content starts
            if (isInThinkingBlock) {
              isInThinkingBlock = false;
              const closeTag = "</think>";
              full += closeTag;
              acc.full = full;
              sendEvent(controller, "token", { t: closeTag });
            }
            full += delta.content;
            acc.full = full;
            sendEvent(controller, "token", { t: delta.content });
          }

          // Track usage from final chunk
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens;
            completionTokens = chunk.usage.completion_tokens;
            totalTokens = chunk.usage.total_tokens;
            // DeepSeek includes reasoning tokens in completion_tokens_details
            const details = (
              chunk.usage as { completion_tokens_details?: { reasoning_tokens?: number } }
            ).completion_tokens_details;
            if (details?.reasoning_tokens) {
              reasoningTokens = details.reasoning_tokens;
            }
          }
        }

        // Close thinking block if stream ended during thinking
        if (isInThinkingBlock) {
          isInThinkingBlock = false;
          const closeTag = "</think>";
          full += closeTag;
          acc.full = full;
          sendEvent(controller, "token", { t: closeTag });
        }

        // Diagnostic logging of final stream state
        streamLogger.info(
          `[DeepSeek Stream] Completed chunks. Finish reason: "${lastFinishReason}", tokens: { prompt: ${promptTokens}, completion: ${completionTokens}, reasoning: ${reasoningTokens} }, fullLength: ${full.length}`
        );

        // Check if stream ended completely empty (no reasoning tokens, no answer tokens)
        if (!full.trim() && !isCancelled && !ac.signal.aborted) {
          streamLogger.warn(
            `DeepSeek stream ended completely empty. finish_reason: "${lastFinishReason}"`
          );
          sendEvent(controller, "error", {
            code: "empty_response",
            message: "Empty response from provider",
            status: 502,
          });
          sendEvent(controller, "done", { ok: false });
          try {
            controller.close();
          } catch {
            // Ignore if already closed
          }
          return;
        }

        // Check if response contains any actual answer content outside thinking tags
        const nonThinkingContent = full.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (full.includes("<think>") && !nonThinkingContent) {
          emptyAnswerReason = lastFinishReason === "length" ? "length" : "no_content";
          streamLogger.warn(
            `DeepSeek stream ended with thinking deliberation but without answer content. finish_reason: "${lastFinishReason}", fullLength: ${full.length}, reason: "${emptyAnswerReason}"`
          );

          if (!isCancelled && !ac.signal.aborted) {
            sendEvent(controller, "meta", {
              type: "emptyAnswerNotice",
              reason: emptyAnswerReason,
            });
          }
        }

        // Send usage metadata if available
        if (totalTokens !== undefined) {
          sendEvent(controller, "meta", {
            type: "usageMetadata",
            promptTokenCount: promptTokens,
            candidatesTokenCount: completionTokens,
            thoughtsTokenCount: reasoningTokens,
            totalTokenCount: totalTokens,
          });
        }
      } catch (e) {
        streamFailed = true;
        if (isCancelled || ac.signal.aborted) {
          await savePartialOnce();
        } else {
          // If stream failed unexpectedly but accumulated some content, save it too
          await savePartialOnce();
          if (e instanceof StreamTimeoutError) {
            const timeoutMs = getStreamTimeout();
            streamLogger.error(`DeepSeek stream timeout after ${timeoutMs}ms`);
            sendEvent(controller, "error", {
              message: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
              code: "STREAM_TIMEOUT",
              isTimeout: true,
            });
          } else {
            streamLogger.error("DeepSeek stream error:", e);

            const err = e as {
              status?: number;
              code?: string;
              message?: string;
              error?: { message?: string };
            };

            // Map DeepSeek-specific error codes
            const isRateLimit = err.status === 429;
            const isInsufficientBalance = err.status === 402;
            const isTokenLimit = err.status === 413 || err.code === "rate_limit_exceeded";
            const errorMessage = err.error?.message || err.message || "DeepSeek stream error";

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

            let code = err.code || "stream_error";
            if (isRateLimit) code = "rate_limit_exceeded";
            if (isInsufficientBalance) code = "insufficient_balance";
            if (isTokenLimit) code = "token_limit_exceeded";

            sendEvent(controller, "error", {
              message: errorMessage,
              code,
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
          emptyAnswerReason,
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
