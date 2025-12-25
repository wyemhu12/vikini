// /app/api/chat-stream/streaming.js

export function mapMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export function sendEvent(controller, event, data) {
  const encoder = new TextEncoder();
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
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
        try {
          sendEvent(controller, "meta", {
            type: "conversationCreated",
            conversation: createdConversation,
          });
        } catch {}
      }

      // ✅ Debug meta: let client see if server *actually* enabled tools
      try {
        sendEvent(controller, "meta", {
          type: "webSearch",
          enabled: enableWebSearch,
          available: WEB_SEARCH_AVAILABLE,
          cookie: cookieWeb === "1" ? "1" : cookieWeb === "0" ? "0" : "",
        });
      } catch {}

      // ✅ Debug meta: GEM status for this conversation
      try {
        sendEvent(controller, "meta", {
          type: "gem",
          gemId: gemMeta?.gemId ?? null,
          hasSystemInstruction: Boolean(gemMeta?.hasSystemInstruction),
          systemInstructionChars:
            typeof gemMeta?.systemInstructionChars === "number"
              ? gemMeta.systemInstructionChars
              : 0,
          error: typeof gemMeta?.error === "string" ? gemMeta.error : "",
        });
      } catch {}

      // ✅ NEW: Model meta for client display
      try {
        sendEvent(controller, "meta", {
          type: "model",
          model: modelMeta?.model ?? model,
          isDefault: Boolean(modelMeta?.isDefault),
        });
      } catch {}

      if (createdConversation) {
        if (!regenerate) {
          try {
            const optimisticTitle = await generateOptimisticTitle(content);
            if (optimisticTitle) {
              sendEvent(controller, "meta", {
                type: "optimisticTitle",
                conversationId,
                title: optimisticTitle,
              });
            }
          } catch {}
        }
      }

      let full = "";
      let groundingMetadata = null;
      let urlContextMetadata = null;

      // ✅ Safety diagnostics (for UX + debugging)
      let promptFeedback = null;
      let finishReason = "";
      let safetyRatings = null;

      const runStream = async ({ useTools }) => {
        const config = {
          systemInstruction: sysPrompt,
          temperature: 0,
          ...(useTools && Array.isArray(tools) && tools.length > 0 ? { tools } :
 {}),
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
          // Capture prompt feedback if present
          try {
            const pf = pick(chunk, ["promptFeedback", "prompt_feedback"]);
            if (pf) promptFeedback = pf;
          } catch {}

          const t = safeText(chunk);
          if (t) {
            full += t;
            sendEvent(controller, "token", { t });
          }

          try {
            const cand = chunk?.candidates?.[0];
            if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetad
ata;
            if (cand?.urlContextMetadata) urlContextMetadata = cand.urlContextMe
tadata;
            if (cand?.url_context_metadata) urlContextMetadata = cand.url_contex
t_metadata;

            const fr = pick(cand, ["finishReason", "finish_reason"]);
            if (typeof fr === "string" && fr) finishReason = fr;

            const sr = pick(cand, ["safetyRatings", "safety_ratings"]);
            if (sr) safetyRatings = sr;
          } catch {}
        }
      };

      try {
        // ✅ First try with tools (if any)
        await runStream({ useTools: true });
      } catch (err) {
        console.error("stream error (with tools):", err);

        // ✅ Fallback: retry without tools to avoid breaking chat if tool unsupp
orted
        try {
          if (Array.isArray(tools) && tools.length > 0) {
            sendEvent(controller, "meta", {
              type: "webSearchFallback",
              message: "Tools not supported by current SDK/model. Retrying without web search.",
            });
            await runStream({ useTools: false });
          } else {
            sendEvent(controller, "error", { message: "Stream error" });
          }
        } catch (err2) {
          console.error("stream error (without tools):", err2);
          try {
            sendEvent(controller, "error", { message: "Stream error" });
          } catch {}
        }
      }

      // ✅ If blocked by safety, Gemini may return no content at all.
      // Gemini docs: promptFeedback.blockReason or Candidate.finishReason=SAFET
Y and safetyRatings for details.
      // We convert "silent" into a clear assistant message.
      try {
        const blockReason = pick(promptFeedback, ["blockReason", "block_reason"]
);
        const isBlocked =
          Boolean(blockReason) ||
          String(finishReason || "").toUpperCase() === "SAFETY";

        if (!full.trim() && isBlocked) {
          sendEvent(controller, "meta", {
            type: "safety",
            blocked: true,
            blockReason: blockReason || "",
            finishReason: finishReason || "",
            safetyRatings: safetyRatings || null,
          });

          const msg =
            "Nội dung bị chặn bởi safety filter. Hãy thử đổi tên GEM hoặc viết l
ại yêu cầu theo hướng trung lập.";
          full = msg;
          sendEvent(controller, "token", { t: msg });
        }
      } catch {}

      try {
        if (groundingMetadata) {
          const chunks = groundingMetadata?.groundingChunks || [];
          const sources = chunks
            .map((c) =>
              c?.web?.uri ? { uri: c.web.uri, title: c.web.title || c.web.uri }
: null
            )
            .filter(Boolean);

          sendEvent(controller, "meta", {
            type: "sources",
            sources,
          });
        }
      } catch {}

      try {
        if (urlContextMetadata) {
          const urlMeta =
            urlContextMetadata?.urlMetadata || urlContextMetadata?.url_metadata
|| [];
          sendEvent(controller, "meta", {
            type: "urlContext",
            urls: urlMeta.map((u) => ({
              retrievedUrl: u.retrievedUrl || u.retrieved_url,
              status: u.urlRetrievalStatus || u.url_retrieval_status,
            })),
          });
        }
      } catch {}

      try {
        const trimmed = full.trim();
        if (trimmed) {
          await appendToContext(conversationId, {
            role: "assistant",
            content: trimmed,
          });

          await saveMessage({
            conversationId,
            userId,
            role: "assistant",
            content: trimmed,
          });

          // Nếu response chỉ là message blocked, tránh auto-title (giảm spam ti
tle)
          const isBlockedMsg = trimmed.startsWith("Nội dung bị chặn bởi safety f
ilter");
          if (createdConversation) {
            if (!regenerate && !isBlockedMsg) {
              const finalTitle = await generateFinalTitle({
                userId,
                conversationId,
                messages: [...contextMessages, { role: "assistant", content: tr
immed }],
              });

              if (finalTitle?.trim()) {
                await setConversationAutoTitle(userId, conversationId, finalTit
le.trim());
                sendEvent(controller, "meta", {
                  type: "finalTitle",
                  conversationId,
                  title: finalTitle.trim(),
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("post-stream error:", err);
      }

      try {
        sendEvent(controller, "done", { ok: true });
      } catch {}
      controller.close();
    },
  });
}
