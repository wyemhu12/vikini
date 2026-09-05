// /app/api/chat-stream/streaming/deepseek-stream.ts
import OpenAI from "openai";

import { isDeepSeekV4ProModel, getModelMaxOutputTokens } from "@/lib/core/modelRegistry";
import { StreamTimeoutError, type ChatStreamParams, type Message } from "./types";
import { sendEvent, getStreamTimeout, withTimeout, withIdleTimeout, streamLogger } from "./utils";
import { sendInitialMetaEvents, generateAndSendOptimisticTitle } from "./gemini-stream";
import { processPostStream } from "./post-processing";

/**
 * DeepSeek V4 streaming with native thinking mode support.
 *
 * Key differences from createOpenAICompatibleStream:
 * 1. Adds `thinking: { type: "enabled/disabled" }` to request
 * 2. Maps thinkingLevel → reasoning_effort ("high" | "max")
 * 3. Parses `delta.reasoning_content` → injects <think> tags
 * 4. Doesn't set temperature/top_p when thinking is enabled
 * 5. Tracks reasoning tokens separately
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
      let isInThinkingBlock = false;
      let streamFailed = false;

      try {
        // Determine thinking mode configuration
        const isThinkingEnabled = thinkingLevel !== "off";
        // Map Vikini thinkingLevel → DeepSeek reasoning_effort
        // DeepSeek V4 has 3 modes: Non-think, Think High, Think Max
        // Think Max requires a special system prompt prefix (per official docs)
        let reasoningEffort: "high" | "max" = "high";
        if (thinkingLevel === "high") {
          reasoningEffort = "max";
        }

        // Prepend Think Max system prompt prefix (per DeepSeek V4 encoding/README.md)
        let effectiveSysPrompt = sysPrompt;
        if (reasoningEffort === "max" && isThinkingEnabled) {
          const thinkMaxPrefix =
            "Reasoning Effort: High depth deliberation.\n" +
            "Be thorough and rigorous in your analysis: decompose the problem, address the root cause, " +
            "and verify logic against relevant edge cases.\n" +
            "Maintain focused deliberation and proceed directly to producing a complete, high-quality final response without redundant looping.\n\n";
          effectiveSysPrompt = thinkMaxPrefix + sysPrompt;
        }

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

        // Calculate max_tokens budget:
        // DeepSeek V4 Pro supports 16384 output tokens.
        // When thinking is enabled, thinking tokens consume the output token budget.
        // Guarantee at least 16384 tokens to prevent reasoning token exhaustion from truncating responses.
        const registeredMaxOutput = getModelMaxOutputTokens(model);
        const effectiveMaxTokens = Math.max(
          registeredMaxOutput || modelMeta?.maxOutputTokens || 8192,
          isThinkingEnabled ? 16384 : 8192
        );

        // Build request body with DeepSeek-specific params
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestBody: Record<string, any> = {
          model: model,
          messages: openAIMessages,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: effectiveMaxTokens,
        };

        // Add OpenRouter provider routing for DeepSeek V4 Pro via StreamLake
        if (isDeepSeekV4ProModel(model)) {
          requestBody.provider = {
            order: ["StreamLake"],
            allow_fallbacks: true,
          };
        }

        // Add thinking mode config
        // OpenRouter uses `include_reasoning` + `reasoning: { effort }`
        // DeepSeek Direct API uses `thinking: { type }` + `reasoning_effort`
        const isOpenRouterRoute = isDeepSeekV4ProModel(model);
        if (isThinkingEnabled) {
          if (isOpenRouterRoute) {
            requestBody.include_reasoning = true;
            requestBody.reasoning = { effort: reasoningEffort };
          } else {
            requestBody.thinking = { type: "enabled" };
          }
          requestBody.reasoning_effort = reasoningEffort;
        } else {
          if (isOpenRouterRoute) {
            requestBody.include_reasoning = false;
            requestBody.reasoning = { effort: "none" };
          } else {
            requestBody.thinking = { type: "disabled" };
          }
          requestBody.temperature = 0.7;
        }

        const streamPromise = ai.chat.completions.create(
          requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
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
              sendEvent(controller, "token", { t: openTag });
            }
            full += reasoningText;
            sendEvent(controller, "token", { t: reasoningText });
          }

          // Handle regular content
          if (delta?.content) {
            // Close thinking block when content starts
            if (isInThinkingBlock) {
              isInThinkingBlock = false;
              const closeTag = "</think>";
              full += closeTag;
              sendEvent(controller, "token", { t: closeTag });
            }
            full += delta.content;
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
          sendEvent(controller, "token", { t: closeTag });
        }

        // Check if response contains any actual answer content outside thinking tags
        const nonThinkingContent = full.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        if (!nonThinkingContent) {
          streamLogger.warn(
            `DeepSeek stream ended without answer content. finish_reason: "${lastFinishReason}", fullLength: ${full.length}`
          );

          const notice =
            lastFinishReason === "length"
              ? "\n\n*(Quá trình suy nghĩ đã đạt giới hạn độ dài token trước khi tạo câu trả lời. Bạn có thể thử chuyển mức suy nghĩ sang Trung bình/Thấp hoặc yêu cầu câu trả lời ngắn gọn hơn.)*"
              : "\n\n*(Mô hình đã hoàn tất suy nghĩ nhưng chưa xuất nội dung trả lời. Vui lòng bấm 'Tạo lại'.)*";

          full += notice;
          sendEvent(controller, "token", { t: notice });
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
      controller.close();
    },
  });
}
