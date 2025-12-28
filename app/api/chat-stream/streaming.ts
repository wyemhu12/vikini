// /app/api/chat-stream/streaming.ts

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
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );
  } catch (e) {
    console.error(`Failed to send event ${event}:`, e);
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

interface ChatStreamParams {
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
      }) => AsyncIterable<unknown>;
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
  appendToContext: (conversationId: string, message: { role: string; content: string }) => Promise<void>;
  saveMessage: (params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
  }) => Promise<unknown>;
  setConversationAutoTitle: (userId: string, conversationId: string, title: string) => Promise<void>;
  generateOptimisticTitle: (content: string) => Promise<string | null>;
  generateFinalTitle: (params: {
    userId: string;
    conversationId: string;
    messages: Message[];
  }) => Promise<string | null>;
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

    regenerate,
    content,
    conversationId,
    userId,
    contextMessages,

    appendToContext,
    saveMessage,
    setConversationAutoTitle,
    generateOptimisticTitle,
    generateFinalTitle,
  } = params;

  return new ReadableStream({
    async start(controller) {
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

      // --- LOGIC TỐI ƯU ---
      // Optimistic Title: Chỉ chạy khi shouldGenerateTitle là true
      if (shouldGenerateTitle) {
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
          console.error("Optimistic title error:", err);
        }
      }
      // --- KẾT THÚC LOGIC TỐI ƯU ---

      let full = "";
      let groundingMetadata: unknown = null;
      let urlContextMetadata: unknown = null;
      let promptFeedback: unknown = null;
      let finishReason = "";
      let safetyRatings: unknown = null;

      const runStream = async ({ useTools }: { useTools: boolean }): Promise<void> => {
        full = "";
        const config = {
          systemInstruction: sysPrompt,
          temperature: 0,
          ...(useTools && Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
          ...(Array.isArray(safetySettings) && safetySettings.length > 0
            ? { safetySettings }
            : {}),
        };

        const res = await ai.models.generateContentStream({
          model,
          contents,
          config,
        });

        for await (const chunk of res) {
          const pf = pick(chunk, ["promptFeedback", "prompt_feedback"]);
          if (pf) promptFeedback = pf;

          const t = safeText(chunk);
          if (t) {
            full += t;
            sendEvent(controller, "token", { t });
          }

          const cand = (chunk as { candidates?: unknown[] })?.candidates?.[0] as {
            groundingMetadata?: unknown;
            urlContextMetadata?: unknown;
            url_context_metadata?: unknown;
            finishReason?: string;
            finish_reason?: string;
            safetyRatings?: unknown;
            safety_ratings?: unknown;
          } | undefined;
          
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
      };

      try {
        await runStream({ useTools: true });
      } catch (err) {
        console.error("stream error (with tools):", err);
        try {
          if (Array.isArray(tools) && tools.length > 0) {
            sendEvent(controller, "meta", {
              type: "webSearchFallback",
              message: "Tools not supported. Retrying without web search.",
            });
            await runStream({ useTools: false });
          } else {
            sendEvent(controller, "error", { message: "Stream error" });
          }
        } catch (err2) {
          console.error("stream error (fallback):", err2);
          sendEvent(controller, "error", { message: "Stream error" });
        }
      }

      const blockReason = pick<string>(promptFeedback, ["blockReason", "block_reason"]);
      const isBlocked =
        Boolean(blockReason) ||
        String(finishReason || "").toUpperCase() === "SAFETY";
      
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

        const msg = "Nội dung bị chặn bởi safety filter. Hãy thử đổi tên GEM hoặc viết lại yêu cầu theo hướng trung lập.";
        full = msg;
        sendEvent(controller, "token", { t: msg });
      }

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
          .map((c) =>
            c?.web?.uri
              ? { uri: c.web.uri, title: c.web.title || c.web.uri }
              : null
          )
          .filter((s): s is { uri: string; title: string } => s !== null);
        
        if (sources.length) {
          sendEvent(controller, "meta", { type: "sources", sources });
        }
      }

      if (urlContextMetadata) {
        const urlMeta =
          (urlContextMetadata as {
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
          })?.urlMetadata ||
          (urlContextMetadata as {
            url_metadata?: Array<{
              retrievedUrl?: string;
              retrieved_url?: string;
              urlRetrievalStatus?: string;
              url_retrieval_status?: string;
            }>;
          })?.url_metadata ||
          [];
        sendEvent(controller, "meta", {
          type: "urlContext",
          urls: urlMeta.map((u) => ({
            retrievedUrl: u.retrievedUrl || u.retrieved_url || "",
            status: u.urlRetrievalStatus || u.url_retrieval_status || "",
          })),
        });
      }

      const trimmed = full.trim();
      if (trimmed) {
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

          // --- LOGIC TỐI ƯU: Dùng flag shouldGenerateTitle
          if (shouldGenerateTitle && !isActuallyBlocked) {
            const messagesForTitle: Message[] = [
              ...contextMessages,
              { role: "user", content: content },
              { role: "assistant", content: trimmed }
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
          console.error("post-stream processing error:", err);
        }
      }

      sendEvent(controller, "done", { ok: true });
      controller.close();
    },
  });
}
