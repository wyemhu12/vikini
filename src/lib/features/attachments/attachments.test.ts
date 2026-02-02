// Test file for attachments.ts - Helper functions
import { describe, it, expect } from "vitest";

// ===========================================
// Helper functions extracted for testing
// ===========================================

function safeLower(v: unknown): string {
  return String(v ?? "").toLowerCase();
}

function sanitizeFilename(name: unknown): string {
  const raw = String(name || "file").trim();
  const cleaned = raw
    .replace(/[\\/]+/g, "_")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, 200)
    .trim();
  return cleaned || "file";
}

function getExt(filename: string): string {
  const n = safeLower(filename);
  const idx = n.lastIndexOf(".");
  if (idx === -1) return "";
  return n.slice(idx + 1);
}

function determineFileKind(ext: string, mime: string): "text" | "image" | "doc" | "zip" | "other" {
  const textExts = [
    "txt",
    "js",
    "ts",
    "tsx",
    "jsx",
    "json",
    "md",
    "csv",
    "xml",
    "yaml",
    "yml",
    "html",
    "css",
    "scss",
    "less",
  ];
  const imageExts = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"];
  const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  const archiveExts = ["zip", "tar", "gz", "7z", "rar"];

  if (textExts.includes(ext)) return "text";
  if (imageExts.includes(ext)) return "image";
  if (docExts.includes(ext)) return "doc";
  if (archiveExts.includes(ext)) return "zip";

  if (mime.startsWith("text/")) return "text";
  if (mime.startsWith("image/")) return "image";
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation")
  ) {
    return "doc";
  }
  if (mime.includes("zip") || mime.includes("archive") || mime.includes("compressed")) return "zip";

  return "other";
}

describe("Attachments Helper Functions", () => {
  describe("sanitizeFilename", () => {
    it("should return cleaned filename", () => {
      expect(sanitizeFilename("test.txt")).toBe("test.txt");
      expect(sanitizeFilename("hello world.pdf")).toBe("hello world.pdf");
    });

    it("should replace slashes with underscores", () => {
      expect(sanitizeFilename("path/to/file.txt")).toBe("path_to_file.txt");
      expect(sanitizeFilename("path\\to\\file.txt")).toBe("path_to_file.txt");
    });

    it("should remove control characters", () => {
      expect(sanitizeFilename("test\x00file.txt")).toBe("testfile.txt");
      expect(sanitizeFilename("test\x1Ffile.txt")).toBe("testfile.txt");
    });

    it("should truncate long filenames to 200 chars", () => {
      const longName = "a".repeat(250) + ".txt";
      expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
    });

    it("should return 'file' for empty/invalid input", () => {
      expect(sanitizeFilename("")).toBe("file");
      expect(sanitizeFilename(null)).toBe("file");
      expect(sanitizeFilename(undefined)).toBe("file");
    });

    it("should trim whitespace", () => {
      expect(sanitizeFilename("  test.txt  ")).toBe("test.txt");
    });
  });

  describe("getExt", () => {
    it("should extract file extension", () => {
      expect(getExt("file.txt")).toBe("txt");
      expect(getExt("image.png")).toBe("png");
      expect(getExt("document.PDF")).toBe("pdf"); // Lowercase
    });

    it("should handle multiple dots", () => {
      expect(getExt("file.test.txt")).toBe("txt");
      expect(getExt("archive.tar.gz")).toBe("gz");
    });

    it("should return empty string for no extension", () => {
      expect(getExt("filename")).toBe("");
      expect(getExt("README")).toBe("");
    });

    it("should handle edge cases", () => {
      expect(getExt(".gitignore")).toBe("gitignore");
      expect(getExt("file.")).toBe("");
    });
  });

  describe("determineFileKind", () => {
    describe("text files", () => {
      it("should identify text extensions", () => {
        expect(determineFileKind("txt", "text/plain")).toBe("text");
        expect(determineFileKind("js", "application/javascript")).toBe("text");
        expect(determineFileKind("ts", "text/typescript")).toBe("text");
        expect(determineFileKind("json", "application/json")).toBe("text");
        expect(determineFileKind("md", "text/markdown")).toBe("text");
        expect(determineFileKind("csv", "text/csv")).toBe("text");
      });

      it("should identify text by MIME type fallback", () => {
        expect(determineFileKind("unknown", "text/plain")).toBe("text");
        expect(determineFileKind("unknown", "text/html")).toBe("text");
      });
    });

    describe("image files", () => {
      it("should identify image extensions", () => {
        expect(determineFileKind("png", "image/png")).toBe("image");
        expect(determineFileKind("jpg", "image/jpeg")).toBe("image");
        expect(determineFileKind("jpeg", "image/jpeg")).toBe("image");
        expect(determineFileKind("webp", "image/webp")).toBe("image");
        expect(determineFileKind("gif", "image/gif")).toBe("image");
        expect(determineFileKind("svg", "image/svg+xml")).toBe("image");
      });

      it("should identify image by MIME type fallback", () => {
        expect(determineFileKind("unknown", "image/png")).toBe("image");
      });
    });

    describe("document files", () => {
      it("should identify document extensions", () => {
        expect(determineFileKind("pdf", "application/pdf")).toBe("doc");
        expect(determineFileKind("doc", "application/msword")).toBe("doc");
        expect(determineFileKind("docx", "application/vnd.openxmlformats")).toBe("doc");
        expect(determineFileKind("xls", "application/vnd.ms-excel")).toBe("doc");
        expect(determineFileKind("xlsx", "application/vnd.openxmlformats")).toBe("doc");
        expect(determineFileKind("ppt", "application/vnd.ms-powerpoint")).toBe("doc");
      });

      it("should identify document by MIME type fallback", () => {
        expect(determineFileKind("unknown", "application/pdf")).toBe("doc");
        expect(determineFileKind("unknown", "application/vnd.document")).toBe("doc");
      });
    });

    describe("archive files", () => {
      it("should identify archive extensions", () => {
        expect(determineFileKind("zip", "application/zip")).toBe("zip");
        expect(determineFileKind("tar", "application/x-tar")).toBe("zip");
        expect(determineFileKind("gz", "application/gzip")).toBe("zip");
        expect(determineFileKind("7z", "application/x-7z-compressed")).toBe("zip");
        expect(determineFileKind("rar", "application/x-rar-compressed")).toBe("zip");
      });

      it("should identify archive by MIME type fallback", () => {
        expect(determineFileKind("unknown", "application/zip")).toBe("zip");
        expect(determineFileKind("unknown", "application/x-compressed")).toBe("zip");
      });
    });

    describe("other files", () => {
      it("should return 'other' for unknown types", () => {
        expect(determineFileKind("unknown", "application/octet-stream")).toBe("other");
        expect(determineFileKind("bin", "application/octet-stream")).toBe("other");
        expect(determineFileKind("dat", "application/unknown")).toBe("other");
      });
    });
  });
});
