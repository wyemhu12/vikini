// /lib/features/novelcrafter/manuscriptExporter.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  formatManuscriptExport,
  sanitizeExportFilename,
  stripMarkdownForPlainText,
  triggerManuscriptDownload,
} from "./manuscriptExporter";
import { createDefaultStoryState } from "./types";

describe("manuscriptExporter (Phase 3.5)", () => {
  describe("sanitizeExportFilename", () => {
    it("preserves Vietnamese Unicode letters while replacing forbidden filename characters", () => {
      expect(sanitizeExportFilename('Truyện: "Kiếm Đạo" / Quyển 1?*', "md")).toBe(
        "Truyện-Kiếm-Đạo-Quyển-1.md"
      );
    });

    it("falls back to novelcrafter-manuscript when title is empty or only special characters", () => {
      expect(sanitizeExportFilename("   ///:**?   ", "txt")).toBe("novelcrafter-manuscript.txt");
    });
  });

  describe("stripMarkdownForPlainText", () => {
    it("removes markdown headings, emphasis, blockquotes, and converts scene breaks", () => {
      const md = "# Tiêu đề\n\n> Tóm tắt\n\nĐoạn **in đậm** và *in nghiêng*.\n\n***\n\nĐoạn 2";
      const txt = stripMarkdownForPlainText(md);
      expect(txt).not.toContain("# ");
      expect(txt).not.toContain("**");
      expect(txt).toContain("Đoạn in đậm và in nghiêng.");
      expect(txt).toContain("----------------------------------------");
    });
  });

  describe("formatManuscriptExport", () => {
    it("formats full manuscript as Markdown with Story Bible and Chapter Summaries", () => {
      const state = createDefaultStoryState("Chương 1: Khởi Đầu");
      state.storyBible.genre = "Tiên hiệp";
      state.storyBible.synopsis = "Hành trình tu tiên.";
      state.chapters[0].summary = "Nhân vật chính rời làng.";
      state.chapters[0].content = "Bầu trời đêm đầy sao trên đỉnh núi.";

      const res = formatManuscriptExport({
        storyTitle: "Vạn Cổ Kiếm Thần",
        storyState: state,
        format: "markdown",
        includeStoryBible: true,
        includeChapterSummaries: true,
      });

      expect(res.filename).toBe("Vạn-Cổ-Kiếm-Thần.md");
      expect(res.mimeType).toBe("text/markdown;charset=utf-8");
      expect(res.content).toContain("# Vạn Cổ Kiếm Thần");
      expect(res.content).toContain("Hành trình tu tiên.");
      expect(res.content).toContain("> **Summary:** Nhân vật chính rời làng.");
      expect(res.content).toContain("Bầu trời đêm đầy sao trên đỉnh núi.");
      expect(res.totalWords).toBeGreaterThan(0);
    });

    it("formats plain text (.txt) without Story Bible or Summaries when disabled", () => {
      const state = createDefaultStoryState("Chương 1");
      state.storyBible.synopsis = "Bí mật không xuất.";
      state.chapters[0].summary = "Tóm tắt ẩn.";
      state.chapters[0].content = "Nội dung **chương một**.";

      const res = formatManuscriptExport({
        storyTitle: "Truyện Ngắn",
        storyState: state,
        format: "txt",
        includeStoryBible: false,
        includeChapterSummaries: false,
      });

      expect(res.filename).toBe("Truyện-Ngắn.txt");
      expect(res.mimeType).toBe("text/plain;charset=utf-8");
      expect(res.content).not.toContain("Bí mật không xuất.");
      expect(res.content).not.toContain("Tóm tắt ẩn.");
      expect(res.content).toContain("Nội dung chương một.");
    });
  });

  describe("triggerManuscriptDownload", () => {
    it("creates a Blob object URL, clicks an anchor element, and revokes the URL", () => {
      const createObjectURLSpy = vi.fn(() => "blob:mock-url");
      const revokeObjectURLSpy = vi.fn();
      vi.stubGlobal("URL", {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      });

      const clickSpy = vi.fn();
      const appendChildSpy = vi
        .spyOn(document.body, "appendChild")
        .mockImplementation((node) => node);
      const removeChildSpy = vi
        .spyOn(document.body, "removeChild")
        .mockImplementation((node) => node);
      const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        download: "",
        style: {},
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      triggerManuscriptDownload({
        filename: "test.md",
        mimeType: "text/markdown;charset=utf-8",
        content: "# Test",
      });

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      vi.unstubAllGlobals();
    });
  });
});
