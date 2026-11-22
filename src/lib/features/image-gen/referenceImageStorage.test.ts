import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError, ValidationError } from "@/lib/utils/errors";
import {
  MAX_STUDIO_REF_IMAGE_BYTES,
  REFERENCE_IMAGE_BUCKET,
  buildReferenceImageStoragePath,
  validateReferenceImagePaths,
  detectImageMimeFromBytes,
  downloadReferenceImagesFromStorage,
  cleanupTempReferenceImages,
} from "./referenceImageStorage";

const USER_ID = "user+test@example.com";
const CONV_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_1 = "11111111-2222-3333-4444-555555555555";
const VALID_UUID_2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("referenceImageStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildReferenceImageStoragePath", () => {
    it("builds ASCII-only path scoped to userId/conversationId/ref-<uuid>.<ext>", () => {
      const pngPath = buildReferenceImageStoragePath(USER_ID, CONV_ID, "image/png");
      const jpgPath = buildReferenceImageStoragePath(USER_ID, CONV_ID, "image/jpeg");
      const webpPath = buildReferenceImageStoragePath(USER_ID, CONV_ID, "image/webp");
      const gifPath = buildReferenceImageStoragePath(USER_ID, CONV_ID, "image/gif");

      expect(pngPath.startsWith(`${USER_ID}/${CONV_ID}/ref-`)).toBe(true);
      expect(pngPath.endsWith(".png")).toBe(true);
      expect(jpgPath.endsWith(".jpg")).toBe(true);
      expect(webpPath.endsWith(".webp")).toBe(true);
      expect(gifPath.endsWith(".gif")).toBe(true);
      expect(
        validateReferenceImagePaths([pngPath, jpgPath, webpPath, gifPath], USER_ID, CONV_ID)
      ).toEqual([pngPath, jpgPath, webpPath, gifPath]);
    });
  });

  describe("validateReferenceImagePaths (TC-REF-03 & TC-REF-04)", () => {
    it("TC-REF-03: accepts valid trimmed paths and preserves order", () => {
      const p1 = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.webp`;
      const p2 = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_2}.png`;

      const result = validateReferenceImagePaths([`  ${p1}  `, p2], USER_ID, CONV_ID);
      expect(result).toEqual([p1, p2]);
    });

    it("TC-REF-04 (NP-1): throws ForbiddenError for another user's or another conversation's path", () => {
      expect(() =>
        validateReferenceImagePaths(
          [`victim@example.com/${CONV_ID}/ref-${VALID_UUID_1}.png`],
          USER_ID,
          CONV_ID
        )
      ).toThrow(ForbiddenError);

      expect(() =>
        validateReferenceImagePaths(
          [`${USER_ID}/99999999-9999-9999-9999-999999999999/ref-${VALID_UUID_1}.png`],
          USER_ID,
          CONV_ID
        )
      ).toThrow(ForbiddenError);
    });

    it("TC-REF-04 (NP-2): throws ValidationError on traversal, backslash, control chars, non-ref prefix, bad ext, or >4 paths", () => {
      const badPaths = [
        `${USER_ID}/${CONV_ID}/../other/ref-${VALID_UUID_1}.png`,
        `${USER_ID}/${CONV_ID}\\ref-${VALID_UUID_1}.png`,
        `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png\u0000`,
        `${USER_ID}/${CONV_ID}/gen-123456.png`,
        `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.svg`,
        `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.exe`,
        `${USER_ID}/${CONV_ID}/sub/ref-${VALID_UUID_1}.png`,
        "",
      ];

      for (const bad of badPaths) {
        expect(() => validateReferenceImagePaths([bad], USER_ID, CONV_ID)).toThrow(ValidationError);
      }

      const fivePaths = Array.from(
        { length: 5 },
        () => `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`
      );
      expect(() => validateReferenceImagePaths(fivePaths, USER_ID, CONV_ID)).toThrow(
        ValidationError
      );
    });
  });

  describe("detectImageMimeFromBytes", () => {
    it("detects valid PNG, JPEG, WebP, and GIF magic bytes", () => {
      expect(detectImageMimeFromBytes(PNG_BYTES)).toBe("image/png");
      expect(detectImageMimeFromBytes(JPEG_BYTES)).toBe("image/jpeg");
      expect(detectImageMimeFromBytes(GIF_BYTES)).toBe("image/gif");
      expect(detectImageMimeFromBytes(WEBP_BYTES)).toBe("image/webp");
    });

    it("returns null for HTML, SVG, EXE, or truncated buffers", () => {
      expect(detectImageMimeFromBytes(Buffer.from("<html><script>alert(1)</script></html>"))).toBe(
        null
      );
      expect(
        detectImageMimeFromBytes(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))
      ).toBe(null);
      expect(detectImageMimeFromBytes(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBe(null);
      expect(detectImageMimeFromBytes(new Uint8Array([0x89, 0x50]))).toBe(null);
    });
  });

  describe("downloadReferenceImagesFromStorage (TC-REF-05 & NP-3a)", () => {
    function createMockSupabase(downloadImpl: ReturnType<typeof vi.fn>, removeImpl = vi.fn()) {
      return {
        storage: {
          from: vi.fn().mockReturnValue({
            download: downloadImpl,
            remove: removeImpl,
          }),
        },
      } as unknown as SupabaseClient;
    }

    it("downloads and verifies valid images with detected MIME type", async () => {
      const path = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`;
      const blob = {
        size: PNG_BYTES.byteLength,
        arrayBuffer: vi.fn().mockResolvedValue(PNG_BYTES.buffer.slice(0)),
      };
      const downloadMock = vi.fn().mockResolvedValue({ data: blob, error: null });
      const supabase = createMockSupabase(downloadMock);

      const resolved = await downloadReferenceImagesFromStorage(supabase, [path]);

      expect(downloadMock).toHaveBeenCalledWith(path);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].mimeType).toBe("image/png");
      expect(resolved[0].sizeBytes).toBe(PNG_BYTES.byteLength);
      expect(resolved[0].filename).toBe(`ref-${VALID_UUID_1}.png`);
    });

    it("TC-REF-05 (NP-3a): blocks blob > 40MB BEFORE calling blob.arrayBuffer() (OOM guard)", async () => {
      const path = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`;
      const arrayBufferSpy = vi.fn();
      const oversizedBlob = {
        size: MAX_STUDIO_REF_IMAGE_BYTES + 1,
        arrayBuffer: arrayBufferSpy,
      };
      const supabase = createMockSupabase(
        vi.fn().mockResolvedValue({ data: oversizedBlob, error: null })
      );

      await expect(downloadReferenceImagesFromStorage(supabase, [path])).rejects.toThrow(
        ValidationError
      );
      expect(arrayBufferSpy).not.toHaveBeenCalled();
    });

    it("TC-REF-05: rejects empty blob (size 0) before calling arrayBuffer()", async () => {
      const path = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`;
      const arrayBufferSpy = vi.fn();
      const supabase = createMockSupabase(
        vi.fn().mockResolvedValue({ data: { size: 0, arrayBuffer: arrayBufferSpy }, error: null })
      );

      await expect(downloadReferenceImagesFromStorage(supabase, [path])).rejects.toThrow(
        ValidationError
      );
      expect(arrayBufferSpy).not.toHaveBeenCalled();
    });

    it("TC-REF-05: rejects spoofed HTML/EXE content masquerading as .png", async () => {
      const path = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`;
      const htmlBytes = Buffer.from("<!DOCTYPE html><html>bad</html>");
      const fakeBlob = {
        size: htmlBytes.byteLength,
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(
            htmlBytes.buffer.slice(
              htmlBytes.byteOffset,
              htmlBytes.byteOffset + htmlBytes.byteLength
            )
          ),
      };
      const supabase = createMockSupabase(
        vi.fn().mockResolvedValue({ data: fakeBlob, error: null })
      );

      await expect(downloadReferenceImagesFromStorage(supabase, [path])).rejects.toThrow(
        ValidationError
      );
    });

    it("throws ValidationError when storage download fails", async () => {
      const path = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`;
      const supabase = createMockSupabase(
        vi.fn().mockResolvedValue({ data: null, error: { message: "Object not found" } })
      );

      await expect(downloadReferenceImagesFromStorage(supabase, [path])).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("cleanupTempReferenceImages", () => {
    it("removes only valid owned ref-* paths and silently skips foreign/traversal paths", async () => {
      const validPath = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`;
      const foreignPath = `victim@example.com/${CONV_ID}/ref-${VALID_UUID_2}.png`;
      const nonRefPath = `${USER_ID}/${CONV_ID}/gen-123.png`;
      const removeMock = vi.fn().mockResolvedValue({ error: null });
      const fromMock = vi.fn().mockReturnValue({ remove: removeMock });
      const supabase = { storage: { from: fromMock } } as unknown as SupabaseClient;

      await cleanupTempReferenceImages(supabase, USER_ID, CONV_ID, [
        validPath,
        foreignPath,
        nonRefPath,
      ]);

      expect(fromMock).toHaveBeenCalledWith(REFERENCE_IMAGE_BUCKET);
      expect(removeMock).toHaveBeenCalledTimes(1);
      expect(removeMock).toHaveBeenCalledWith([validPath]);
    });

    it("does not throw when supabase.storage.remove rejects", async () => {
      const validPath = `${USER_ID}/${CONV_ID}/ref-${VALID_UUID_1}.png`;
      const removeMock = vi.fn().mockRejectedValue(new Error("Storage down"));
      const supabase = {
        storage: { from: vi.fn().mockReturnValue({ remove: removeMock }) },
      } as unknown as SupabaseClient;

      await expect(
        cleanupTempReferenceImages(supabase, USER_ID, CONV_ID, [validPath])
      ).resolves.toBeUndefined();
    });
  });
});
