// src/lib/features/chat/legacyNotice.test.ts
import { describe, it, expect } from "vitest";
import { parseLegacyNotice, LEGACY_NOTICE_LENGTH, LEGACY_NOTICE_NO_CONTENT } from "./legacyNotice";

describe("legacyNotice parser", () => {
  it("returns null for empty or standard messages", () => {
    expect(parseLegacyNotice("")).toBeNull();
    expect(parseLegacyNotice("Hello world, this is a normal response.")).toBeNull();
    expect(parseLegacyNotice("<think>I am thinking</think>\n\nHere is the answer.")).toBeNull();
  });

  it("detects and strips token length notice from content", () => {
    const rawContent = `<think>Step 1\nStep 2</think>\n\n${LEGACY_NOTICE_LENGTH}`;
    const result = parseLegacyNotice(rawContent);

    expect(result).not.toBeNull();
    expect(result?.reason).toBe("length");
    expect(result?.cleanContent).toBe("<think>Step 1\nStep 2</think>");
  });

  it("detects and strips no-content notice from content", () => {
    const rawContent = `<think>Finished deliberation</think>\n\n${LEGACY_NOTICE_NO_CONTENT}`;
    const result = parseLegacyNotice(rawContent);

    expect(result).not.toBeNull();
    expect(result?.reason).toBe("no_content");
    expect(result?.cleanContent).toBe("<think>Finished deliberation</think>");
  });

  it("handles standalone legacy notices without prior thinking", () => {
    const result = parseLegacyNotice(LEGACY_NOTICE_NO_CONTENT);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("no_content");
    expect(result?.cleanContent).toBe("");
  });
});
