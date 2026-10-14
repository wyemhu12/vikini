import { describe, it, expect, vi } from "vitest";
import {
  isCiphertextHex,
  resolveMessageContent,
  paginateAndMapGalleryRows,
  type GalleryMessageRow,
} from "./galleryMapper";

describe("galleryMapper", () => {
  describe("isCiphertextHex", () => {
    it("detects valid AES-256-GCM and legacy AES-256-CBC ciphertext hex strings", () => {
      const gcmCipher = "0123456789abcdef01234567:0123456789abcdef0123456789abcdef:deadbeef01";
      const cbcCipher = "0123456789abcdef0123456789abcdef:deadbeef0123456789abcdef";

      expect(isCiphertextHex(gcmCipher)).toBe(true);
      expect(isCiphertextHex(cbcCipher)).toBe(true);
    });

    it("returns false for plaintext strings including colons", () => {
      expect(isCiphertextHex("Attachment image")).toBe(false);
      expect(isCiphertextHex("Edited Image: Sunset 16:9")).toBe(false);
      expect(isCiphertextHex("Generated Image: Cyberpunk city")).toBe(false);
      expect(isCiphertextHex("")).toBe(false);
    });
  });

  describe("resolveMessageContent", () => {
    it("returns empty string for null or undefined content", () => {
      expect(resolveMessageContent(null)).toBe("");
      expect(resolveMessageContent(undefined)).toBe("");
      expect(resolveMessageContent("")).toBe("");
    });

    it("preserves plaintext directly without calling decryptFn (even with colons)", () => {
      const decryptFn = vi.fn(() => "");
      expect(resolveMessageContent("Attachment image", decryptFn)).toBe("Attachment image");
      expect(resolveMessageContent("Edited Image: Make it sunset", decryptFn)).toBe(
        "Edited Image: Make it sunset"
      );
      expect(decryptFn).not.toHaveBeenCalled();
    });

    it("decrypts valid ciphertext hex and hides raw hex if decryptFn throws or returns empty", () => {
      const gcmCipher = "0123456789abcdef01234567:0123456789abcdef0123456789abcdef:deadbeef";

      expect(resolveMessageContent(gcmCipher, () => "Decrypted prompt")).toBe("Decrypted prompt");
      expect(resolveMessageContent(gcmCipher, () => "")).toBe("");
      expect(
        resolveMessageContent(gcmCipher, () => {
          throw new Error("Decryption failed");
        })
      ).toBe("");
      expect(resolveMessageContent(gcmCipher)).toBe("");
    });
  });

  describe("paginateAndMapGalleryRows", () => {
    it("TC-01: extracts images from meta.imageUrl and meta.attachment.url and filters out rows without url", () => {
      const rows: GalleryMessageRow[] = [
        {
          id: "msg-1",
          content: "Generated Image",
          created_at: "2026-10-14T10:00:00Z",
          meta: {
            type: "image_gen",
            imageUrl: "https://cdn/1.png",
            prompt: "Cyberpunk city",
            originalOptions: {
              aspectRatio: "16:9",
              style: "vivid",
              model: "gemini-3.1-flash-image",
            },
          },
        },
        {
          id: "msg-2",
          content: "Attachment image",
          created_at: "2026-10-14T09:00:00Z",
          meta: {
            attachment: { url: "https://cdn/2.png" },
          },
        },
        {
          id: "msg-no-url",
          content: "Plain text message",
          created_at: "2026-10-14T08:00:00Z",
          meta: {
            type: "text",
          },
        },
      ];

      const result = paginateAndMapGalleryRows(rows, 20);

      expect(result.hasMore).toBe(false);
      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toEqual({
        id: "msg-1",
        url: "https://cdn/1.png",
        prompt: "Cyberpunk city",
        createdAt: "2026-10-14T10:00:00Z",
        aspectRatio: "16:9",
        style: "vivid",
        model: "gemini-3.1-flash-image",
      });
      expect(result.images[1]).toEqual({
        id: "msg-2",
        url: "https://cdn/2.png",
        prompt: "Attachment image",
        createdAt: "2026-10-14T09:00:00Z",
        aspectRatio: undefined,
        style: undefined,
        model: undefined,
      });
    });

    it("TC-02: resolves prompt priority meta.prompt -> meta.editPrompt -> resolveMessageContent(msg.content)", () => {
      const gcmCipher = "0123456789abcdef01234567:0123456789abcdef0123456789abcdef:deadbeef";
      const rows: GalleryMessageRow[] = [
        {
          id: "msg-edit",
          content: "Edited Image: Make it sunset",
          created_at: "2026-10-14T11:00:00Z",
          meta: {
            type: "image_edit",
            imageUrl: "https://cdn/edit.png",
            editPrompt: "Make it sunset",
          },
        },
        {
          id: "msg-cipher",
          content: gcmCipher,
          created_at: "2026-10-14T10:00:00Z",
          meta: {
            attachment: { url: "https://cdn/cipher.png" },
          },
        },
      ];

      const okResult = paginateAndMapGalleryRows(rows, 20, () => "Decrypted prompt");
      expect(okResult.images[0].prompt).toBe("Make it sunset");
      expect(okResult.images[1].prompt).toBe("Decrypted prompt");

      const failedDecryptResult = paginateAndMapGalleryRows(rows, 20, () => {
        throw new Error("Bad key");
      });
      expect(failedDecryptResult.images[1].prompt).toBe("");
    });

    it("TC-03: computes hasMore = rawRows.length > limit and slices to limit items", () => {
      const makeRows = (count: number): GalleryMessageRow[] =>
        Array.from({ length: count }, (_, idx) => ({
          id: `msg-${idx + 1}`,
          content: `Prompt ${idx + 1}`,
          created_at: "2026-10-14T10:00:00Z",
          meta: {
            imageUrl: `https://cdn/${idx + 1}.png`,
            prompt: `Prompt ${idx + 1}`,
          },
        }));

      // Case A: 21 rows with limit 20 -> hasMore = true, images.length = 20
      const caseA = paginateAndMapGalleryRows(makeRows(21), 20);
      expect(caseA.hasMore).toBe(true);
      expect(caseA.images).toHaveLength(20);
      expect(caseA.images[19].id).toBe("msg-20");

      // Case B: 20 rows with limit 20 -> hasMore = false, images.length = 20
      const caseB = paginateAndMapGalleryRows(makeRows(20), 20);
      expect(caseB.hasMore).toBe(false);
      expect(caseB.images).toHaveLength(20);

      // Case C: 0 rows with limit 20 -> hasMore = false, images.length = 0
      const caseC = paginateAndMapGalleryRows([], 20);
      expect(caseC.hasMore).toBe(false);
      expect(caseC.images).toHaveLength(0);
    });
  });
});
