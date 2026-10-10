import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThinkingLevel } from "@google/genai";
import { CONVERSATION_DEFAULTS } from "@/lib/utils/constants";
import { normalizeTitle, generateOptimisticTitle, generateFinalTitle } from "./autoTitleEngine";

const mockGenerateContent = vi.fn();

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => ({
    models: {
      generateContent: mockGenerateContent,
    },
  }),
}));

describe("autoTitleEngine - Title generation & sampling sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizeTitle", () => {
    it("handles null, undefined and empty strings by returning default title", () => {
      expect(normalizeTitle(null)).toBe(CONVERSATION_DEFAULTS.TITLE);
      expect(normalizeTitle(undefined)).toBe(CONVERSATION_DEFAULTS.TITLE);
      expect(normalizeTitle("")).toBe(CONVERSATION_DEFAULTS.TITLE);
      expect(normalizeTitle("   ")).toBe(CONVERSATION_DEFAULTS.TITLE);
    });

    it("cleans quotes, punctuation, capitalizes first letters and truncates to 6 words", () => {
      expect(normalizeTitle('"hello world, this is a very long test title with extra words"')).toBe(
        "Hello World This Is A Very"
      );
      expect(normalizeTitle("tổng quan kiến trúc vikini!")).toBe("Tổng Quan Kiến Trúc Vikini");
    });
  });

  describe("generateOptimisticTitle", () => {
    it("calls Gemini 3 with maxOutputTokens: 15, ThinkingLevel.MINIMAL, and no sampling parameters", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: () => "Hướng Dẫn Viết Code",
      });

      const title = await generateOptimisticTitle("Hãy hướng dẫn tôi viết code Next.js");

      expect(title).toBe("Hướng Dẫn Viết Code");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      const firstCall = mockGenerateContent.mock.calls[0][0];
      expect(firstCall.model).toBe("gemini-3-flash-preview");
      expect(firstCall.config).toEqual({
        maxOutputTokens: 15,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      });
      expect(firstCall.config).not.toHaveProperty("temperature");
      expect(firstCall.config).not.toHaveProperty("top_p");
      expect(firstCall.config).not.toHaveProperty("top_k");
    });

    it("falls back to user message slice on generation failure", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API rate limit"));

      const title = await generateOptimisticTitle("Thảo luận về cơ sở dữ liệu");
      expect(title).toBe("Thảo Luận Về Cơ Sở Dữ");
    });
  });

  describe("generateFinalTitle", () => {
    it("calls Gemini 3 with maxOutputTokens: 20, ThinkingLevel.MINIMAL, and no sampling parameters", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: () => "Kiến Trúc Hệ Thống Vikini",
      });

      const title = await generateFinalTitle({
        userId: "user-1",
        conversationId: "conv-1",
        messages: [
          { role: "user", content: "Hãy phân tích kiến trúc hệ thống Vikini" },
          { role: "assistant", content: "Vikini sử dụng Next.js 16 và Supabase..." },
        ],
      });

      expect(title).toBe("Kiến Trúc Hệ Thống Vikini");
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      const firstCall = mockGenerateContent.mock.calls[0][0];
      expect(firstCall.model).toBe("gemini-3-flash-preview");
      expect(firstCall.config).toEqual({
        maxOutputTokens: 20,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      });
      expect(firstCall.config).not.toHaveProperty("temperature");
    });

    it("falls back to FALLBACK_MODEL without thinkingConfig when PRIMARY_MODEL fails", async () => {
      // Primary model fails, fallback model succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error("Primary 503 error"))
        .mockResolvedValueOnce({
          text: () => "Tiêu Đề Dự Phòng",
        });

      const title = await generateFinalTitle({
        userId: "user-1",
        conversationId: "conv-1",
        messages: [{ role: "user", content: "Test fallback model" }],
      });

      expect(title).toBe("Tiêu Đề Dự Phòng");
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      // Verify all calls have no temperature
      expect(mockGenerateContent.mock.calls.every((c) => !("temperature" in c[0].config))).toBe(
        true
      );

      // Verify fallback model call has no thinkingConfig
      const fallbackCall = mockGenerateContent.mock.calls[1][0];
      expect(fallbackCall.model).toBe("gemini-2.5-flash");
      expect(fallbackCall.config).toEqual({ maxOutputTokens: 20 });
      expect(fallbackCall.config).not.toHaveProperty("thinkingConfig");
      expect(fallbackCall.config).not.toHaveProperty("temperature");
    });
  });
});
