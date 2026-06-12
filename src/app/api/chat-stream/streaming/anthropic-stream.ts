// /app/api/chat-stream/streaming/anthropic-stream.ts
import Anthropic from "@anthropic-ai/sdk";
import { modelSupportsClaudeThinking } from "@/lib/core/modelRegistry";
import { executeFunction } from "@/lib/features/chat/functionRegistry";

import { StreamTimeoutError, type ChatStreamParams, type CreatedConversation } from "./types";
import { sendEvent, getStreamTimeout, withTimeout, streamLogger } from "./utils";
import { processPostStream } from "./post-processing";

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
  thinkingLevel,
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
  saveMessage: ChatStreamParams["saveMessage"];
  setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
  generateFinalTitle: ChatStreamParams["generateFinalTitle"];
  thinkingLevel?: "off" | "low" | "medium" | "high" | "minimal";
}): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      // 1. Send Initial Metadata
      const conv = createdConversation as CreatedConversation | null;
      const meta = {
        conversationId,
        title: conv?.title ?? null,
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
      // Collect sources from web search results for persistence
      const collectedSources: Array<{ uri: string; title: string }> = [];
      // Track Claude Extended Thinking state for <think> tag injection
      let isInThinkingBlock = false;
      try {
        // Map contents to Anthropic format with multimodal support
        // contents: [{ role: "user", parts: [{text: ""}, {inlineData: {data, mimeType}}] }]
        // Anthropic: [{ role: "user", content: [{type: "text", text: ""}, {type: "image", source: {...}}] }]
        type AnthropicMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        type GeminiPartA = { text?: string; inlineData?: { data: string; mimeType: string } };
        const anthropicMessages = (contents as Array<{ role: string; parts: GeminiPartA[] }>).map(
          (m) => {
            const hasImages = m.parts.some((p) => p.inlineData);
            if (hasImages) {
              const contentBlocks: Array<
                | { type: "text"; text: string }
                | {
                    type: "image";
                    source: { type: "base64"; media_type: AnthropicMediaType; data: string };
                  }
              > = [];
              for (const p of m.parts) {
                if (p.inlineData) {
                  contentBlocks.push({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: p.inlineData.mimeType as AnthropicMediaType,
                      data: p.inlineData.data,
                    },
                  });
                } else if (p.text) {
                  contentBlocks.push({ type: "text" as const, text: p.text });
                }
              }
              return {
                role: (m.role === "model" ? "assistant" : m.role) as "user" | "assistant",
                content: contentBlocks,
              };
            }
            return {
              role: (m.role === "model" ? "assistant" : m.role) as "user" | "assistant",
              content: m.parts.map((p) => p.text || "").join(""),
            };
          }
        );

        // Build tools array for Beta API — code execution, web fetch, web search, function calling
        const anthropicTools: Array<Record<string, unknown>> = [];

        // Code Execution — Claude runs Python/JS in a sandboxed container
        anthropicTools.push({
          type: "code_execution_20250522",
          name: "code_execution",
        });

        // Web Fetch — Claude can fetch URLs for real-time data
        anthropicTools.push({
          type: "web_fetch_20250910",
          name: "web_fetch",
        });

        // Web Search — native web search
        if (enableWebSearch && WEB_SEARCH_AVAILABLE) {
          anthropicTools.push({
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          });
        }

        // Function Calling — get_current_time
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

        // Build thinking config for Claude Extended Thinking
        const isClaudeThinking =
          modelSupportsClaudeThinking(model) && thinkingLevel && thinkingLevel !== "off";
        // Budget tokens: min 1024, must be less than max_tokens
        const claudeMaxTokens = isClaudeThinking ? 16384 : 8192;
        const claudeBudgetTokens = 10240; // ~10K thinking budget

        const timeoutMs = getStreamTimeout(model, thinkingLevel);

        // Use Beta API for code execution + web fetch support
        const streamPromise = ai.beta.messages.create({
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
          // Extended thinking requires temperature = 1 (Anthropic requirement)
          ...(isClaudeThinking
            ? {
                thinking: { type: "enabled" as const, budget_tokens: claudeBudgetTokens },
                temperature: 1,
              }
            : { temperature: 0.7 }),
          tools: anthropicTools,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const stream = (await withTimeout(streamPromise, timeoutMs)) as unknown as AsyncIterable<{
          type: string;
          delta: { type: string; text?: string; thinking?: string; partial_json?: string };
          content_block: Record<string, unknown>;
          usage?: { output_tokens?: number };
        }>;

        // Track tool_use blocks for function calling
        let currentToolUseId = "";
        let currentToolName = "";
        let currentToolInput = "";

        for await (const chunk of stream) {
          // Handle text token deltas
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            const text = (chunk.delta as { text?: string }).text;
            if (text) {
              full += text;
              sendEvent(controller, "token", { t: text });
            }
          }

          // Handle thinking deltas (Claude Extended Thinking)
          // Inject as <think> tags so existing frontend ThinkingBlock renders it
          if (chunk.type === "content_block_delta" && chunk.delta.type === "thinking_delta") {
            const thinkingText = (chunk.delta as { thinking?: string }).thinking;
            if (thinkingText) {
              if (!isInThinkingBlock) {
                isInThinkingBlock = true;
                const openTag = "<think>";
                full += openTag;
                sendEvent(controller, "token", { t: openTag });
              }
              full += thinkingText;
              sendEvent(controller, "token", { t: thinkingText });
            }
          }

          // Close thinking block when a text block starts
          if (
            chunk.type === "content_block_start" &&
            (chunk.content_block as { type?: string })?.type === "text" &&
            isInThinkingBlock
          ) {
            isInThinkingBlock = false;
            const closeTag = "</think>";
            full += closeTag;
            sendEvent(controller, "token", { t: closeTag });
          }

          // Handle tool_use blocks for function calling (get_current_time)
          if (chunk.type === "content_block_start") {
            const block = chunk.content_block as { type?: string; id?: string; name?: string };
            if (block.type === "tool_use") {
              currentToolUseId = block.id || "";
              currentToolName = block.name || "";
              currentToolInput = "";
            }
          }

          // Accumulate tool input JSON
          if (chunk.type === "content_block_delta" && chunk.delta.type === "input_json_delta") {
            const partial = (chunk.delta as { partial_json?: string }).partial_json;
            if (partial) currentToolInput += partial;
          }

          // Tool use complete — execute and resume
          if (chunk.type === "content_block_stop" && currentToolName && currentToolUseId) {
            // Only handle our custom functions (not server tools like web_search)
            if (currentToolName === "get_current_time") {
              try {
                const args = currentToolInput ? JSON.parse(currentToolInput) : {};
                sendEvent(controller, "meta", {
                  type: "functionCall",
                  name: currentToolName,
                  args,
                });
                const result = await executeFunction(currentToolName, args);

                // Resume conversation with tool result
                const resumeMessages = [
                  ...anthropicMessages,
                  {
                    role: "assistant" as const,
                    content: [
                      {
                        type: "tool_use" as const,
                        id: currentToolUseId,
                        name: currentToolName,
                        input: args,
                      },
                    ],
                  },
                  {
                    role: "user" as const,
                    content: [
                      {
                        type: "tool_result" as const,
                        tool_use_id: currentToolUseId,
                        content: result.error || result.result,
                      },
                    ],
                  },
                ];

                const resumeStream = await ai.beta.messages.create({
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);

                for await (const rChunk of resumeStream as unknown as AsyncIterable<{
                  type: string;
                  delta: { type: string; text?: string };
                }>) {
                  if (rChunk.type === "content_block_delta" && rChunk.delta.type === "text_delta") {
                    const t = (rChunk.delta as { text?: string }).text;
                    if (t) {
                      full += t;
                      sendEvent(controller, "token", { t });
                    }
                  }
                }
              } catch (fnErr: unknown) {
                streamLogger.error("Claude function call error:", fnErr);
              }
            }
            // Reset
            currentToolUseId = "";
            currentToolName = "";
            currentToolInput = "";
          }

          // Handle token usage from message_delta event
          if (chunk.type === "message_delta") {
            const usage = (chunk as { usage?: { output_tokens?: number } }).usage;
            if (usage) {
              sendEvent(controller, "meta", {
                type: "usageMetadata",
                outputTokens: usage.output_tokens || 0,
              });
            }
          }

          // Handle content_block_start — extract web search results + code execution results
          if (chunk.type === "content_block_start") {
            const block = chunk.content_block as Record<string, unknown>;

            // web_search_tool_result contains the actual search results with URLs
            if (block.type === "web_search_tool_result") {
              const resultBlock = block as {
                type: "web_search_tool_result";
                content:
                  | Array<{
                      type: "web_search_result";
                      url: string;
                      title: string;
                      page_age?: string | null;
                      encrypted_content?: string;
                    }>
                  | { type: "web_search_tool_result_error"; error_code: string };
              };

              // Only process successful results (array), not errors (object)
              if (Array.isArray(resultBlock.content)) {
                for (const result of resultBlock.content) {
                  if (result.type === "web_search_result" && result.url) {
                    collectedSources.push({
                      uri: result.url,
                      title: result.title || result.url,
                    });
                  }
                }
              }
            }

            // Code execution result — extract stdout/stderr and render as code blocks
            if (block.type === "code_execution_result") {
              const ceResult = block as {
                type: "code_execution_result";
                stdout?: string;
                stderr?: string;
                return_code?: number;
              };
              if (ceResult.stdout) {
                const output = `\n**Code Output:**\n\`\`\`\n${ceResult.stdout}\n\`\`\`\n`;
                full += output;
                sendEvent(controller, "token", { t: output });
              }
              if (ceResult.stderr) {
                const errOutput = `\n**Error Output:**\n\`\`\`\n${ceResult.stderr}\n\`\`\`\n`;
                full += errOutput;
                sendEvent(controller, "token", { t: errOutput });
              }
            }

            // server_tool_use — Claude deciding to use a tool (log for debugging)
            if (block.type === "server_tool_use") {
              const toolName = (block as { name?: string }).name;
              if (toolName === "web_search") {
                sendEvent(controller, "meta", {
                  type: "webSearchStatus",
                  status: "searching",
                });
              } else if (toolName === "code_execution") {
                sendEvent(controller, "meta", {
                  type: "codeExecutionStatus",
                  status: "running",
                });
              } else if (toolName === "web_fetch") {
                sendEvent(controller, "meta", {
                  type: "webFetchStatus",
                  status: "fetching",
                });
              }
            }
          }
        }

        // Close any still-open thinking block
        if (isInThinkingBlock) {
          isInThinkingBlock = false;
          const closeTag = "</think>";
          full += closeTag;
          sendEvent(controller, "token", { t: closeTag });
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
        // Handle timeout specifically
        if (e instanceof StreamTimeoutError) {
          const timeoutMs = getStreamTimeout();
          streamLogger.error(`Anthropic stream timeout after ${timeoutMs}ms`);
          sendEvent(controller, "error", {
            message: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
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

      // 3. Post Stream Processing — include sources for DB persistence
      // Deduplicate sources before persisting
      const seen = new Set<string>();
      const uniqueSources = collectedSources.filter((s) => {
        if (seen.has(s.uri)) return false;
        seen.add(s.uri);
        return true;
      });

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
        sources: uniqueSources.length > 0 ? uniqueSources : undefined,
        model,
      });

      sendEvent(controller, "done", { ok: true });
      controller.close();
    },
  });
}
