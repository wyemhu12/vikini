// /app/api/chat-stream/streaming.js

export function mapMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export function sendEvent(controller, event, data) {
  try {
    const encoder = new TextEncoder();
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );
  } catch (e) {
    console.error(`Failed to send event ${event}:`, e);
  }
}

export function safeText(respOrChunk) {
  try {
    if (typeof respOrChunk === "string") return respOrChunk;
    if (respOrChunk?.text) return respOrChunk.text;
    if (respOrChunk?.candidates?.[0]?.content?.parts?.[0]?.text)
      return respOrChunk.candidates[0].content.parts[0].text;
  } catch {}
  return "";
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

export function createChatReadableStream(params) {
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
    shouldGenerateTitle, // NHẬN BIẾN NÀY

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
      let groundingMetadata = null;
      let urlContextMetadata = null;
      let promptFeedback = null;
      let finishReason = "";
      let safetyRatings = null;

      const runStream = async ({ useTools }) => {
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

          const cand = chunk?.candidates?.[0];
          if (cand) {
            if (cand.groundingMetadata) groundingMetadata = cand.groundingMetadata;
            if (cand.urlContextMetadata || cand.url_context_metadata) {
              urlContextMetadata =
                cand.urlContextMetadata || cand.url_context_metadata;
            }

            const fr = pick(cand, ["finishReason", "finish_reason"]);
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

      const blockReason = pick(promptFeedback, ["blockReason", "block_reason"]);
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

      if (groundingMetadata?.groundingChunks) {
        const sources = groundingMetadata.groundingChunks
          .map((c) =>
            c?.web?.uri
              ? { uri: c.web.uri, title: c.web.title || c.web.uri }
              : null
          )
          .filter(Boolean);
        
        if (sources.length) {
          sendEvent(controller, "meta", { type: "sources", sources });
        }
      }

      if (urlContextMetadata) {
        const urlMeta =
          urlContextMetadata?.urlMetadata ||
          urlContextMetadata?.url_metadata ||
          [];
        sendEvent(controller, "meta", {
          type: "urlContext",
          urls: urlMeta.map((u) => ({
            retrievedUrl: u.retrievedUrl || u.retrieved_url,
            status: u.urlRetrievalStatus || u.url_retrieval_status,
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
            const messagesForTitle = [
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

    