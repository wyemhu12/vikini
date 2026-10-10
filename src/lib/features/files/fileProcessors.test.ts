import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeWithAI } from "./fileProcessors";

const mockGenerateContent = vi.fn();

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => ({
    models: {
      generateContent: mockGenerateContent,
    },
  }),
}));

describe("fileProcessors - AI file analysis & sampling parameter sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateContent with maxOutputTokens: 2048 and excludes sampling parameters", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "Tóm tắt nội dung file phân tích.",
    });

    const fileContent = "This is a test plain text document.";
    const buffer = Buffer.from(fileContent);

    const result = await analyzeWithAI(buffer, "text/plain", "document.txt", {
      prompt: "Tóm tắt file này",
      systemInstruction: "Bạn là trợ lý phân tích tài liệu",
    });

    expect(result).toBe("Tóm tắt nội dung file phân tích.");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config).toEqual({
      systemInstruction: "Bạn là trợ lý phân tích tài liệu",
      maxOutputTokens: 2048,
    });
    expect(callArgs.config).not.toHaveProperty("temperature");
    expect(callArgs.config).not.toHaveProperty("top_p");
    expect(callArgs.config).not.toHaveProperty("top_k");
  });

  it("propagates error when generateContent throws exception", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("AI service unavailable"));

    const buffer = Buffer.from("content");

    await expect(
      analyzeWithAI(buffer, "text/plain", "test.txt", { prompt: "Analyze" })
    ).rejects.toThrow("AI service unavailable");
  });
});
