// /app/api/chat-stream/streaming/anthropic-stream.ts
import Anthropic from "@anthropic-ai/sdk";
import { isClaude55Model, modelSupportsClaudeThinking } from "@/lib/core/modelRegistry";
import { executeFunction } from "@/lib/features/chat/functionRegistry";

import { StreamTimeoutError, type ChatStreamParams } from "./types";
import { sendEvent, getStreamTimeout, withTimeout, withIdleTimeout, streamLogger } from "./utils";
import { sendInitialMetaEvents, generateAndSendOptimisticTitle } from "./gemini-stream";
import { processPostStream } from "./post-processing";
import { balanceThinkTags } from "@/lib/features/chat/thinkTags";
import { sendThinkingChunk, accumulateReasoning } from "./reasoningStreamHelper.server";
import { createAnthropicToolTracker } from "./anthropic-tool-helpers";
import {
  mapContentsToAnthropicMessages,
  type IncomingContentMessage,
} from "./anthropic-message-mapper";

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
  upsertAssistantMessage,
  setConversationAutoTitle,
  generateOptimisticTitle,
  generateFinalTitle,
  thinkingLevel,
  clientMessageId,
  signal,
  ragSources,
  initialUrlContext,
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
  upsertAssistantMessage: ChatStreamParams["upsertAssistantMessage"];
  setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
  generateFinalTitle: ChatStreamParams["generateFinalTitle"];
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal" | "xhigh";
  clientMessageId?: string;
  signal?: AbortSignal;
}): ReadableStream {
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
        await upsertAssistantMessage({
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
            ...(initialUrlContext && initialUrlContext.length > 0
              ? { urlContext: initialUrlContext }
              : {}),
          },
        });
      } catch (saveErr) {
        streamLogger.error("Failed to save partial message in Anthropic safety net:", saveErr);
      }
    }
  };

  return new ReadableStream({
    cancel() {
      isCancelled = true;
      ac.abort();
    },
    async start(controller) {
      // 1. Send Initial Metadata (consistent schema with Gemini/OpenAI/DeepSeek)
      sendInitialMetaEvents(controller, {
        createdConversation,
        enableWebSearch,
        WEB_SEARCH_AVAILABLE,
        cookieWeb,
        gemMeta,
        modelMeta,
        model,
        ragSources,
        initialUrlContext,
      });

      // 2. Optimistic Title (instant UX)
      await generateAndSendOptimisticTitle(
        controller,
        shouldGenerateTitle,
        content,
        conversationId,
        generateOptimisticTitle
      );

      let full = "";
      let fullReasoning = "";
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      // Collect sources from web search results for persistence
      const collectedSources: Array<{ uri: string; title: string }> = [];
      let streamFailed = false;
      try {
        // Map contents to Anthropic format with Native PDF document + multimodal image support
        const anthropicMessages = mapContentsToAnthropicMessages(
          contents as IncomingContentMessage[]
        );

        // Build tools array for Beta API - code execution, web fetch, web search, function calling
        const anthropicTools: Array<Record<string, unknown>> = [];

        // Code Execution - Claude runs Python/JS in a sandboxed container
        anthropicTools.push({
          type: "code_execution_20250522",
          name: "code_execution",
        });

        // Web Fetch - Claude can fetch URLs for real-time data
        anthropicTools.push({
          type: "web_fetch_20250910",
          name: "web_fetch",
        });

        // Web Search - native web search
        if (enableWebSearch && WEB_SEARCH_AVAILABLE) {
          anthropicTools.push({
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          });
        }

        // Function Calling - get_current_time
        anthropicTools.push({
          name: "get_current_time",
          description:
            "Get the current date and time. Use this when the user asks about the current time, date, day of week, or anything time-related.",
          input_schema: {
            type: "object",
            properties: {
              timezone: {
                type: "string",
                description:
                  'IANA timezone identifier (e.g. "Asia/Ho_Chi_Minh", "America/New_York"). Defaults to UTC.',
              },
            },
          },
        });

        // Build thinking config for Claude Thinking
        // Claude 5.5 uses Adaptive Thinking ({ type: "adaptive" }, NO budget_tokens).
        // Legacy Claude 4.x uses Extended Thinking ({ type: "enabled", budget_tokens }).
        const isClaudeThinking =
          modelSupportsClaudeThinking(model) && Boolean(thinkingLevel) && thinkingLevel !== "off";
        const isAdaptiveThinking = isClaude55Model(model);
        const claudeMaxTokens = isClaudeThinking ? 16384 : 8192;
        const claudeBudgetTokens = 10240; // Legacy 4.x only

        const timeoutMs = getStreamTimeout(model, thinkingLevel);

        const streamPromise = ai.beta.messages.create(
          {
            model: model,
            // Prompt caching: wrap system prompt with cache_control for cost savings (~90%)
            system: [
              {
                type: "text" as const,
                text: sysPrompt,
                cache_control: { type: "ephemeral" as const },
              },
            ],
            messages: anthropicMessages,
            stream: true,
            max_tokens: claudeMaxTokens,
            // Thinking requires temperature = 1 (Anthropic requirement)
            ...(isClaudeThinking
              ? isAdaptiveThinking
                ? {
                    thinking: { type: "adaptive" as const },
                    temperature: 1,
                  }
                : {
                    thinking: { type: "enabled" as const, budget_tokens: claudeBudgetTokens },
                    temperature: 1,
                  }
              : { temperature: 0.7 }),
            tools: anthropicTools,
            // Beta API types don't fully cover dynamic tool types (code_execution, web_fetch)
            // and conditional thinking config spread. Using narrowed assertion instead of `any`.
          } as unknown as Parameters<typeof ai.beta.messages.create>[0],
          { signal: ac.signal }
        );

        const stream = (await withTimeout(streamPromise, timeoutMs)) as unknown as AsyncIterable<{
          type: string;
          delta?: { type: string; text?: string; thinking?: string; partial_json?: string };
          content_block?: Record<string, unknown>;
          message?: {
            usage?: {
              input_tokens?: number;
              cache_creation_input_tokens?: number;
              cache_read_input_tokens?: number;
            };
          };
          usage?: { output_tokens?: number };
        }>;

        const idleTimeoutMs = Math.max(timeoutMs / 2, 30_000);
        const guardedStream = withIdleTimeout(stream, idleTimeoutMs);

        // Track both server_tool_use and client tool_use blocks cleanly without input leaks
        const toolTracker = createAnthropicToolTracker();

        for await (const chunk of guardedStream) {
          if (isCancelled || ac.signal.aborted) {
            break;
          }

          // Handle initial input/cache token usage from message_start event
          if (chunk.type === "message_start" && chunk.message?.usage) {
            const u = chunk.message.usage;
            inputTokens =
              (u.input_tokens || 0) +
              (u.cache_creation_input_tokens || 0) +
              (u.cache_read_input_tokens || 0);
          }

          // Handle text token deltas
          if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
            const text = chunk.delta.text;
            if (text) {
              full += text;
              acc.full = full;
              sendEvent(controller, "token", { t: text });
            }
          }

          // Handle thinking deltas (Claude Extended Thinking)
          if (chunk.type === "content_block_delta" && chunk.delta?.type === "thinking_delta") {
            const thinkingText = chunk.delta.thinking;
            if (thinkingText) {
              fullReasoning = accumulateReasoning(fullReasoning, thinkingText);
              acc.reasoning = fullReasoning;
              sendThinkingChunk(controller, thinkingText);
            }
          }

          // Handle content_block_start (client tool_use, server_tool_use, tool results)
          if (chunk.type === "content_block_start" && chunk.content_block) {
            const startOutcome = toolTracker.handleBlockStart(chunk.content_block, Date.now());
            for (const metaEvt of startOutcome.metaEvents) {
              sendEvent(controller, "meta", metaEvt);
            }
            if (startOutcome.codeResultMarkdown) {
              full += startOutcome.codeResultMarkdown;
              acc.full = full;
              sendEvent(controller, "token", { t: startOutcome.codeResultMarkdown });
            }
            if (startOutcome.webSources.length > 0) {
              collectedSources.push(...startOutcome.webSources);
            }
          }

          // Handle input_json_delta (client JSON buffering + throttled server code_execution progress)
          if (chunk.type === "content_block_delta" && chunk.delta?.type === "input_json_delta") {
            const partial = chunk.delta.partial_json;
            if (partial) {
              const deltaMeta = toolTracker.handleInputJsonDelta(partial, Date.now());
              if (deltaMeta) {
                sendEvent(controller, "meta", deltaMeta);
              }
            }
          }

          // Handle content_block_stop (server tool running transition + client function execution)
          if (chunk.type === "content_block_stop") {
            const stopOutcome = toolTracker.handleBlockStop();
            if (stopOutcome.metaEvent) {
              sendEvent(controller, "meta", stopOutcome.metaEvent);
            }
            if (stopOutcome.clientToolCall?.name === "get_current_time") {
              const { id: toolUseId, name: toolName, inputJson } = stopOutcome.clientToolCall;
              try {
                const args = inputJson ? JSON.parse(inputJson) : {};
                sendEvent(controller, "meta", {
                  type: "functionCall",
                  name: toolName,
                  args,
                });
                const result = await executeFunction(toolName, args);

                // Resume conversation with tool result
                const resumeMessages = [
                  ...anthropicMessages,
                  {
                    role: "assistant" as const,
                    content: [
                      {
                        type: "tool_use" as const,
                        id: toolUseId,
                        name: toolName,
                        input: args,
                      },
                    ],
                  },
                  {
                    role: "user" as const,
                    content: [
                      {
                        type: "tool_result" as const,
                        tool_use_id: toolUseId,
                        content: result.error || result.result,
                      },
                    ],
                  },
                ];

                const resumeStream = await ai.beta.messages.create(
                  {
                    model,
                    system: [
                      {
                        type: "text" as const,
                        text: sysPrompt,
                        cache_control: { type: "ephemeral" as const },
                      },
                    ],
                    messages: resumeMessages as unknown[],
                    stream: true,
                    max_tokens: 4096,
                    temperature: 0.7,
                    tools: anthropicTools,
                  } as unknown as Parameters<typeof ai.beta.messages.create>[0],
                  { signal: ac.signal }
                );

                for await (const rChunk of resumeStream as unknown as AsyncIterable<{
                  type: string;
                  delta: { type: string; text?: string };
                }>) {
                  if (isCancelled || ac.signal.aborted) {
                    break;
                  }
                  if (rChunk.type === "content_block_delta" && rChunk.delta.type === "text_delta") {
                    const t = (rChunk.delta as { text?: string }).text;
                    if (t) {
                      full += t;
                      acc.full = full;
                      sendEvent(controller, "token", { t });
                    }
                  }
                }
              } catch (fnErr: unknown) {
                streamLogger.error("Claude function call error:", fnErr);
              }
            }
          }

          // Handle token usage from message_delta event
          if (chunk.type === "message_delta") {
            const usage = chunk.usage;
            if (usage) {
              outputTokens = usage.output_tokens || 0;
              const totalTokens = (inputTokens || 0) + outputTokens;
              sendEvent(controller, "meta", {
                type: "usageMetadata",
                outputTokens,
                ...(inputTokens !== undefined ? { promptTokenCount: inputTokens } : {}),
                candidatesTokenCount: outputTokens,
                totalTokenCount: totalTokens,
              });
            }
          }
        }

        // Send collected sources as SSE event (same format as Gemini grounding)
        if (collectedSources.length > 0) {
          // Deduplicate sources by URL
          const seen = new Set<string>();
          const uniqueSources = collectedSources.filter((s) => {
            if (seen.has(s.uri)) return false;
            seen.add(s.uri);
            return true;
          });

          sendEvent(controller, "meta", { type: "sources", sources: uniqueSources });
        }
      } catch (e: unknown) {
        streamFailed = true;
        if (isCancelled || ac.signal.aborted) {
          await savePartialOnce();
        } else {
          // If stream failed unexpectedly but accumulated some content, save it too
          await savePartialOnce();
          // Handle timeout specifically
          if (e instanceof StreamTimeoutError) {
            const effectiveTimeoutMs = getStreamTimeout(model, thinkingLevel);
            streamLogger.error(`Anthropic stream timeout after ${effectiveTimeoutMs}ms`);
            sendEvent(controller, "error", {
              message: `Request timed out after ${Math.round(effectiveTimeoutMs / 1000)} seconds. Please try again.`,
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

      // 3. Post Stream Processing — skip on failure (partial content already saved in catch)
      if (!streamFailed) {
        // Deduplicate sources before persisting
        const seen = new Set<string>();
        const uniqueSources = collectedSources.filter((s) => {
          if (seen.has(s.uri)) return false;
          seen.add(s.uri);
          return true;
        });

        const usageMetadata =
          inputTokens !== undefined || outputTokens !== undefined
            ? {
                promptTokenCount: inputTokens,
                candidatesTokenCount: outputTokens,
                totalTokenCount: (inputTokens || 0) + (outputTokens || 0),
              }
            : undefined;

        await processPostStream(controller, {
          full,
          reasoning: fullReasoning || undefined,
          ragSources,
          usageMetadata,
          isActuallyBlocked: false,
          shouldGenerateTitle,
          conversationId,
          userId,
          contextMessages,
          content,
          appendToContext,
          upsertAssistantMessage,
          setConversationAutoTitle,
          generateFinalTitle,
          sources: uniqueSources.length > 0 ? uniqueSources : undefined,
          urlContext:
            initialUrlContext && initialUrlContext.length > 0 ? initialUrlContext : undefined,
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
