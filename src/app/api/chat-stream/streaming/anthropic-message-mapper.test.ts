import { describe, it, expect } from "vitest";
import { mapContentsToAnthropicMessages } from "./anthropic-message-mapper";

describe("anthropic-message-mapper (TC-CL-01)", () => {
  it("maps user PDF inlineData to BetaRequestDocumentBlock with title and valid raster images to image blocks", () => {
    const result = mapContentsToAnthropicMessages([
      {
        role: "user",
        parts: [
          { text: "Analyze this proposal" },
          {
            inlineData: { data: "JVBERi0xLjQ=", mimeType: "application/pdf" },
            filename: "Proposal.pdf",
          },
          {
            inlineData: { data: "iVBORw0KGgo=", mimeType: "image/png" },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toEqual([
      { type: "text", text: "Analyze this proposal" },
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: "JVBERi0xLjQ=",
        },
        title: "Proposal.pdf",
      },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "iVBORw0KGgo=",
        },
      },
    ]);
  });

  it("omits unsupported binary MIME types (e.g. image/avif) safely without breaking content array", () => {
    const result = mapContentsToAnthropicMessages([
      {
        role: "user",
        parts: [{ inlineData: { data: "AAAA", mimeType: "image/avif" } }],
      },
    ]);

    expect(result[0].content).toEqual([
      { type: "text", text: "[Unsupported binary attachment omitted: image/avif]" },
    ]);
  });

  it("degrades model/assistant turns containing inlineData to plain text", () => {
    const result = mapContentsToAnthropicMessages([
      {
        role: "model",
        parts: [
          { text: "Assistant response" },
          { inlineData: { data: "JVBERi0xLjQ=", mimeType: "application/pdf" } },
        ],
      },
    ]);

    expect(result).toEqual([{ role: "assistant", content: "Assistant response" }]);
  });

  it("keeps plain text user messages as string content and never emits empty content arrays", () => {
    const result = mapContentsToAnthropicMessages([
      { role: "user", parts: [{ text: "Hello" }, { text: " world" }] },
      { role: "user", parts: [] },
    ]);

    expect(result).toEqual([
      { role: "user", content: "Hello world" },
      { role: "user", content: "" },
    ]);
  });
});
