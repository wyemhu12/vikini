// /app/api/chat-stream/streaming/post-processing.ts
import type { ChatStreamParams, Message, UsageMetadata } from "./types";
import { sendEvent, pick, streamLogger } from "./utils";

function handleSafetyBlocking(
  controller: ReadableStreamDefaultController<Uint8Array>,
  full: string,
  promptFeedback: unknown,
  finishReason: string,
  safetyRatings: unknown
): { full: string; isActuallyBlocked: boolean } {
  const blockReason = pick<string>(promptFeedback, ["blockReason", "block_reason"]);
  const isBlocked = Boolean(blockReason) || String(finishReason || "").toUpperCase() === "SAFETY";
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

    const msg =
      "Nội dung bị chặn bởi safety filter. Hãy thử đổi tên GEM hoặc viết lại yêu cầu theo hướng trung lập.";
    full = msg;
    sendEvent(controller, "token", { t: msg });
  }

  return { full, isActuallyBlocked };
}

function processGroundingMetadata(
  controller: ReadableStreamDefaultController<Uint8Array>,
  groundingMetadata: unknown
): Array<{ uri: string; title: string }> {
  const grounding = groundingMetadata as {
    groundingChunks?: Array<{
      web?: {
        uri?: string;
        title?: string;
      };
    }>;
    // snake_case variant from some SDK versions
    grounding_chunks?: Array<{
      web?: {
        uri?: string;
        title?: string;
      };
    }>;
  } | null;

  const chunks = grounding?.groundingChunks || grounding?.grounding_chunks;

  if (chunks) {
    const sources = chunks
      .map((c) => (c?.web?.uri ? { uri: c.web.uri, title: c.web.title || c.web.uri } : null))
      .filter((s): s is { uri: string; title: string } => s !== null);

    if (sources.length) {
      sendEvent(controller, "meta", { type: "sources", sources });
      return sources;
    }
  }

  // Debug: log when grounding metadata exists but no chunks found
  if (groundingMetadata) {
    const keys = Object.keys(groundingMetadata as Record<string, unknown>);
    streamLogger.info(`Grounding metadata keys: ${keys.join(", ")}`);
  }

  return [];
}

function processUrlContextMetadata(
  controller: ReadableStreamDefaultController<Uint8Array>,
  urlContextMetadata: unknown
): Array<{ retrievedUrl: string; status: string }> {
  if (!urlContextMetadata) return [];

  const urlMeta =
    (
      urlContextMetadata as {
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
      }
    )?.urlMetadata ||
    (
      urlContextMetadata as {
        url_metadata?: Array<{
          retrievedUrl?: string;
          retrieved_url?: string;
          urlRetrievalStatus?: string;
          url_retrieval_status?: string;
        }>;
      }
    )?.url_metadata ||
    [];

  const urls = urlMeta.map((u) => ({
    retrievedUrl: u.retrievedUrl || u.retrieved_url || "",
    status: u.urlRetrievalStatus || u.url_retrieval_status || "",
  }));

  sendEvent(controller, "meta", {
    type: "urlContext",
    urls,
  });

  return urls;
}

async function processPostStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  params: {
    full: string;
    isActuallyBlocked: boolean;
    shouldGenerateTitle: boolean;
    conversationId: string;
    userId: string;
    contextMessages: Message[];
    content: string;
    appendToContext: ChatStreamParams["appendToContext"];
    saveMessage: ChatStreamParams["saveMessage"];
    setConversationAutoTitle: ChatStreamParams["setConversationAutoTitle"];
    generateFinalTitle: ChatStreamParams["generateFinalTitle"];
    /** @deprecated Use thoughtSignatures instead */
    thoughtSignature?: string;
    /** All collected signatures from the stream */
    thoughtSignatures?: string[];
    /** Token usage metadata from Gemini API */
    usageMetadata?: UsageMetadata;
    /** Web search sources from grounding metadata */
    sources?: Array<{ uri: string; title: string }>;
    /** URL context metadata */
    urlContext?: Array<{ retrievedUrl: string; status: string }>;
    /** Model used for the generation */
    model?: string;
  }
): Promise<void> {
  const {
    full,
    isActuallyBlocked,
    shouldGenerateTitle,
    conversationId,
    userId,
    contextMessages,
    content,
    appendToContext,
    saveMessage,
    setConversationAutoTitle,
    generateFinalTitle,
    thoughtSignature,
    thoughtSignatures,
    usageMetadata,
    sources,
    urlContext,
    model,
  } = params;

  const trimmed = full.trim();
  if (!trimmed) return;

  // Use array if available, fallback to single signature
  const signatures =
    thoughtSignatures && thoughtSignatures.length > 0
      ? thoughtSignatures
      : thoughtSignature
        ? [thoughtSignature]
        : undefined;

  try {
    await Promise.all([
      appendToContext(conversationId, {
        role: "assistant",
        content: trimmed,
        ...(signatures && signatures.length > 0 ? { thoughtSignatures: signatures } : {}),
      }),
      saveMessage({
        conversationId,
        userId,
        role: "assistant",
        content: trimmed,
        meta: {
          ...(signatures && signatures.length > 0 ? { thoughtSignatures: signatures } : {}),
          // Include token usage metadata if available
          ...(usageMetadata?.promptTokenCount !== undefined
            ? { promptTokenCount: usageMetadata.promptTokenCount }
            : {}),
          ...(usageMetadata?.candidatesTokenCount !== undefined
            ? { candidatesTokenCount: usageMetadata.candidatesTokenCount }
            : {}),
          ...(usageMetadata?.thoughtsTokenCount !== undefined
            ? { thoughtsTokenCount: usageMetadata.thoughtsTokenCount }
            : {}),
          ...(usageMetadata?.totalTokenCount !== undefined
            ? { totalTokenCount: usageMetadata.totalTokenCount }
            : {}),
          // Persist web search sources and URL context so they survive page reload
          ...(sources && sources.length > 0 ? { sources } : {}),
          ...(urlContext && urlContext.length > 0 ? { urlContext } : {}),
          ...(model ? { model } : {}),
        },
      }),
    ]);

    if (shouldGenerateTitle && !isActuallyBlocked) {
      const messagesForTitle: Message[] = [
        ...contextMessages,
        { role: "user", content: content },
        { role: "assistant", content: trimmed },
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
    streamLogger.error("post-stream processing error:", err);
  }
}

export {
  handleSafetyBlocking,
  processGroundingMetadata,
  processUrlContextMetadata,
  processPostStream,
};
