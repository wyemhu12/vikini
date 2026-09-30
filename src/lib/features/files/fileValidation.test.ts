// src/lib/features/files/fileValidation.test.ts
import { describe, it, expect } from "vitest";
import {
  getSafeExtension,
  normalizeMimeType,
  isGeminiNativeMime,
  sanitizeFilename,
  classifyFile,
} from "./fileValidation";

describe("fileValidation", () => {
  describe("getSafeExtension", () => {
    it("returns clean ASCII extension", () => {
      expect(getSafeExtension("report.pdf")).toBe("pdf");
      expect(getSafeExtension("image.PNG")).toBe("png");
      expect(getSafeExtension("archive.tar.gz")).toBe("gz");
    });

    it("sanitizes dangerous or unicode characters", () => {
      expect(getSafeExtension("báo_cáo.đocx")).toBe("ocx");
      expect(getSafeExtension("weird.p#d%f")).toBe("pdf");
    });

    it("returns 'bin' fallback when extension is missing or empty", () => {
      expect(getSafeExtension("no_extension")).toBe("bin");
      expect(getSafeExtension(".")).toBe("bin");
      expect(getSafeExtension("")).toBe("bin");
    });
  });

  describe("isGeminiNativeMime", () => {
    it("accepts supported image types", () => {
      expect(isGeminiNativeMime("image/png")).toBe(true);
      expect(isGeminiNativeMime("image/jpeg")).toBe(true);
      expect(isGeminiNativeMime("image/webp")).toBe(true);
      expect(isGeminiNativeMime("image/gif")).toBe(true);
    });

    it("accepts supported audio/video types", () => {
      expect(isGeminiNativeMime("audio/mpeg")).toBe(true);
      expect(isGeminiNativeMime("audio/mp4")).toBe(true);
      expect(isGeminiNativeMime("video/mp4")).toBe(true);
      expect(isGeminiNativeMime("video/quicktime")).toBe(true);
      expect(isGeminiNativeMime("video/webm")).toBe(true);
    });

    it("accepts PDF and plain text", () => {
      expect(isGeminiNativeMime("application/pdf")).toBe(true);
      expect(isGeminiNativeMime("text/plain")).toBe(true);
    });

    it("REJECTS non-native documents and archives (DOCX, XLSX, ZIP, etc.)", () => {
      expect(
        isGeminiNativeMime(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe(false);
      expect(
        isGeminiNativeMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      ).toBe(false);
      expect(isGeminiNativeMime("application/zip")).toBe(false);
      expect(isGeminiNativeMime("application/x-yaml")).toBe(false);
      expect(isGeminiNativeMime("application/json")).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(isGeminiNativeMime(null)).toBe(false);
      expect(isGeminiNativeMime(undefined)).toBe(false);
    });
  });

  describe("normalizeMimeType", () => {
    it("maps audio and video extensions accurately", () => {
      expect(normalizeMimeType("mp3", "")).toBe("audio/mpeg");
      expect(normalizeMimeType("mov", "")).toBe("video/quicktime");
      expect(normalizeMimeType("m4a", "")).toBe("audio/mp4");
      expect(normalizeMimeType("avi", "")).toBe("video/x-msvideo");
      expect(normalizeMimeType("mkv", "")).toBe("video/x-matroska");
    });
  });

  describe("sanitizeFilename", () => {
    it("sanitizes path traversal and control characters", () => {
      expect(sanitizeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
      expect(sanitizeFilename("file\x00\x1fname.txt")).toBe("filename.txt");
    });

    it("clamps length to 200 chars", () => {
      const long = "a".repeat(300);
      expect(sanitizeFilename(long).length).toBe(200);
    });
  });

  describe("classifyFile", () => {
    it("classifies kinds accurately", () => {
      expect(classifyFile("png", "image/png")).toBe("image");
      expect(classifyFile("mp4", "video/mp4")).toBe("video");
      expect(classifyFile("mp3", "audio/mpeg")).toBe("audio");
      expect(classifyFile("pdf", "application/pdf")).toBe("document");
      expect(
        classifyFile(
          "docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe("document");
      expect(classifyFile("zip", "application/zip")).toBe("archive");
      expect(classifyFile("ts", "text/typescript")).toBe("text");
    });
  });
});
