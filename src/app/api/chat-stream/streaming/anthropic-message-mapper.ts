// src/app/api/chat-stream/streaming/anthropic-message-mapper.ts
import type Anthropic from "@anthropic-ai/sdk";

export type AnthropicImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const ANTHROPIC_IMAGE_MIMES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export interface IncomingContentPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
  filename?: string;
}

export interface IncomingContentMessage {
  role: string;
  parts: IncomingContentPart[];
}

function isAnthropicImageMime(mimeType: string): mimeType is AnthropicImageMediaType {
  return ANTHROPIC_IMAGE_MIMES.has(mimeType);
}

/**
 * Maps Vikini unified content messages into Anthropic BetaMessageParam[].
 * - Assistant ("model") turns always degrade to plain text.
 * - User turns map application/pdf inlineData to BetaRequestDocumentBlock (base64 PDF),
 *   whitelisted raster images to BetaImageBlockParam, and drop unsupported binary MIMEs safely.
 */
export function mapContentsToAnthropicMessages(
  contents: IncomingContentMessage[]
): Anthropic.Beta.Messages.BetaMessageParam[] {
  return contents.map((m) => {
    const role: "user" | "assistant" =
      m.role === "model" || m.role === "assistant" ? "assistant" : "user";
    const parts = Array.isArray(m.parts) ? m.parts : [];

    // Assistant role never supports image/document blocks in Anthropic Messages API
    if (role === "assistant") {
      return {
        role: "assistant",
        content: parts.map((p) => p.text || "").join(""),
      };
    }

    const hasInlineData = parts.some((p) => Boolean(p.inlineData));
    if (!hasInlineData) {
      return {
        role: "user",
        content: parts.map((p) => p.text || "").join(""),
      };
    }

    const contentBlocks: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];

    for (const p of parts) {
      if (p.inlineData) {
        const mime = (p.inlineData.mimeType || "").trim().toLowerCase();
        if (mime === "application/pdf") {
          const docBlock: Anthropic.Beta.Messages.BetaRequestDocumentBlock = {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: p.inlineData.data,
            },
            ...(p.filename ? { title: p.filename } : {}),
          };
          contentBlocks.push(docBlock);
        } else if (isAnthropicImageMime(mime)) {
          contentBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mime,
              data: p.inlineData.data,
            },
          });
        } else {
          contentBlocks.push({
            type: "text",
            text: `[Unsupported binary attachment omitted: ${mime || "unknown"}]`,
          });
        }
      } else if (p.text) {
        contentBlocks.push({ type: "text", text: p.text });
      }
    }

    if (contentBlocks.length === 0) {
      contentBlocks.push({ type: "text", text: "" });
    }

    return {
      role: "user",
      content: contentBlocks,
    };
  });
}
