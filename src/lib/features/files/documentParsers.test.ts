// @vitest-environment node
// src/lib/features/files/documentParsers.test.ts
import { describe, it, expect } from "vitest";
import {
  stripNulCharacters,
  isOle2Binary,
  isBinaryCorruptText,
  sanitizeExtractedText,
  extractDocumentText,
} from "./documentParsers";

describe("documentParsers", () => {
  describe("stripNulCharacters", () => {
    it("strips NUL bytes and trims text", () => {
      const input = "Hello\u0000World\u0000 ";
      expect(stripNulCharacters(input)).toBe("HelloWorld");
    });

    it("returns empty string for null or empty input", () => {
      expect(stripNulCharacters(null)).toBe("");
      expect(stripNulCharacters("")).toBe("");
    });
  });

  describe("isOle2Binary", () => {
    it("identifies OLE2 header (D0 CF 11 E0)", () => {
      const oleHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x01]);
      expect(isOle2Binary(oleHeader)).toBe(true);
    });

    it("rejects non-OLE2 bytes", () => {
      const nonOle = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      expect(isOle2Binary(nonOle)).toBe(false);
    });
  });

  describe("isBinaryCorruptText", () => {
    it("flags ZIP/DOCX binary signature PK\\x03\\x04", () => {
      expect(isBinaryCorruptText("PK\x03\x04\x14\x00...")).toBe(true);
    });

    it("flags raw PDF binary header %PDF-", () => {
      expect(isBinaryCorruptText("%PDF-1.4\n%...\x01\x02")).toBe(true);
    });

    it("flags high unprintable control character density (>1%)", () => {
      const corrupt = "\x01\x02\x03\x04\x05\x06\x07Hello World";
      expect(isBinaryCorruptText(corrupt)).toBe(true);
    });

    it("DOES NOT flag valid CSV starting with PK", () => {
      const validCsv = "PK,Name,Score\n1,Alice,100\n2,Bob,95";
      expect(isBinaryCorruptText(validCsv)).toBe(false);
    });

    it("DOES NOT flag normal Vietnamese or English text", () => {
      const validText = "Cộng hòa Xã hội Chủ nghĩa Việt Nam - Độc lập Tự do Hạnh phúc";
      expect(isBinaryCorruptText(validText)).toBe(false);
    });
  });

  describe("sanitizeExtractedText", () => {
    it("returns null for corrupt binary text", () => {
      expect(sanitizeExtractedText("PK\x03\x04\x14\x00...")).toBeNull();
    });

    it("returns cleaned string for valid text", () => {
      expect(sanitizeExtractedText("  Valid content \u0000 here  ")).toBe("Valid content  here");
    });
  });

  describe("extractDocumentText routing", () => {
    it("immediately rejects legacy OLE2 formats (.doc, .xls, .ppt)", async () => {
      const dummyOle = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x12, 0x34]);
      const res = await extractDocumentText(dummyOle, "application/msword", "legacy.doc");
      expect(res).toBeNull();
    });

    it("extracts plain UTF-8 text for markdown or csv", async () => {
      const text = "# Heading\nSome content";
      const bytes = new TextEncoder().encode(text);
      const res = await extractDocumentText(bytes, "text/markdown", "readme.md");
      expect(res).toBe(text);
    });
  });
});
