import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for @google/genai
const { mockEmbedContent } = vi.hoisted(() => ({
  mockEmbedContent: vi.fn(),
}));

vi.mock("@google/genai", () => {
  class MockApiError extends Error {
    status: number;
    constructor(options: { status: number; message?: string }) {
      super(options.message || `API Error ${options.status}`);
      this.status = options.status;
      this.name = "ApiError";
    }
  }

  class MockGoogleGenAI {
    models = {
      embedContent: mockEmbedContent,
    };
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
    ApiError: MockApiError,
  };
});

import { ApiError } from "@google/genai";
import {
  GEMINI_EMBEDDING_API_MODEL,
  EMBEDDING_DIMENSION,
  NATIVE_BATCH_SIZE,
  UPLOAD_MAX_RETRIES,
  SEARCH_MAX_RETRIES,
  formatQueryForRAG,
  formatDocumentForRAG,
  isRetryableApiError,
  generateEmbedding,
  generateEmbeddingsBatch,
} from "./embedding.server";

describe("embedding.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-api-key";
  });

  describe("Constants & Configuration", () => {
    it("should export correct constants matching Gemini Embedding 2 specs", () => {
      expect(GEMINI_EMBEDDING_API_MODEL).toBe("gemini-embedding-2-preview");
      expect(EMBEDDING_DIMENSION).toBe(3072);
      expect(NATIVE_BATCH_SIZE).toBe(50);
      expect(UPLOAD_MAX_RETRIES).toBe(3);
      expect(SEARCH_MAX_RETRIES).toBe(1);
    });
  });

  describe("Asymmetric Retrieval Formatting", () => {
    it("should format search query with task prefix", () => {
      expect(formatQueryForRAG("How to configure Vikini?")).toBe(
        "task: question answering | query: How to configure Vikini?"
      );
    });

    it("should format document chunk with title prefix", () => {
      expect(formatDocumentForRAG("content text", "readme.md")).toBe(
        "title: readme.md | text: content text"
      );
    });

    it("should handle document formatting with undefined title", () => {
      expect(formatDocumentForRAG("content text")).toBe("title: none | text: content text");
    });
  });

  describe("isRetryableApiError", () => {
    it("should identify 429, 503, 500 as retryable", () => {
      expect(isRetryableApiError(new ApiError({ status: 429, message: "Rate limit" }))).toBe(true);
      expect(
        isRetryableApiError(new ApiError({ status: 503, message: "Service unavailable" }))
      ).toBe(true);
      expect(isRetryableApiError(new ApiError({ status: 500, message: "Server error" }))).toBe(
        true
      );
    });

    it("should reject non-retryable errors (400, 401, 403, 404, generic Error)", () => {
      expect(isRetryableApiError(new ApiError({ status: 400, message: "Bad request" }))).toBe(
        false
      );
      expect(isRetryableApiError(new ApiError({ status: 401, message: "Unauthorized" }))).toBe(
        false
      );
      expect(isRetryableApiError(new ApiError({ status: 403, message: "Forbidden" }))).toBe(false);
      expect(isRetryableApiError(new ApiError({ status: 404, message: "Not found" }))).toBe(false);
      expect(isRetryableApiError(new Error("Generic network error"))).toBe(false);
      expect(isRetryableApiError("string error")).toBe(false);
      expect(isRetryableApiError(null)).toBe(false);
    });
  });

  describe("generateEmbedding (TC-EMB-05, TC-EMB-06, TC-EMB-09)", () => {
    it("should return a 3072-dimensional vector on success (TC-EMB-05)", async () => {
      const mockVector = new Array(3072).fill(0.123);
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: mockVector }],
      });

      const vector = await generateEmbedding("Test query text", { initialDelayMs: 0 });

      expect(vector.length).toBe(3072);
      expect(vector).toEqual(mockVector);
      expect(mockEmbedContent).toHaveBeenCalledWith({
        model: "gemini-embedding-2-preview",
        contents: "Test query text",
        config: { outputDimensionality: 3072 },
      });
    });

    it("should throw when API returns vector with wrong dimensions (TC-EMB-06)", async () => {
      const wrongVector = new Array(768).fill(0.456);
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: wrongVector }],
      });

      await expect(generateEmbedding("Test query", { initialDelayMs: 0 })).rejects.toThrow(
        "expected 3072 dimensions, got 768"
      );
    });

    it("should retry search query at most 1 time on 429 and succeed (TC-EMB-09)", async () => {
      const mockVector = new Array(3072).fill(0.789);
      mockEmbedContent
        .mockRejectedValueOnce(new ApiError({ status: 429, message: "Rate limit" }))
        .mockResolvedValueOnce({
          embeddings: [{ values: mockVector }],
        });

      const vector = await generateEmbedding("Query with retry", { initialDelayMs: 0 });

      expect(vector.length).toBe(3072);
      expect(mockEmbedContent).toHaveBeenCalledTimes(2);
    });

    it("should fail after exceeding 1 retry for search query (TC-EMB-09)", async () => {
      mockEmbedContent
        .mockRejectedValueOnce(new ApiError({ status: 429, message: "Rate limit 1" }))
        .mockRejectedValueOnce(new ApiError({ status: 429, message: "Rate limit 2" }));

      await expect(
        generateEmbedding("Query failing after 1 retry", { initialDelayMs: 0 })
      ).rejects.toThrow("Rate limit 2");

      expect(mockEmbedContent).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe("generateEmbeddingsBatch (TC-EMB-07, TC-EMB-09)", () => {
    it("should return empty array for empty contents input", async () => {
      const res = await generateEmbeddingsBatch([]);
      expect(res).toEqual([]);
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it("should call API with Content objects array format (TC-EMB-07)", async () => {
      const texts = ["Chunk 1", "Chunk 2", "Chunk 3"];
      const mockVectors = texts.map((_, i) => new Array(3072).fill(i * 0.1));

      mockEmbedContent.mockResolvedValueOnce({
        embeddings: mockVectors.map((v) => ({ values: v })),
      });

      const results = await generateEmbeddingsBatch(texts, { initialDelayMs: 0 });

      expect(results.length).toBe(3);
      expect(results[0].length).toBe(3072);
      expect(results[1].length).toBe(3072);
      expect(results[2].length).toBe(3072);

      // Verify the critical format: contents MUST be Array of { role: "user", parts: [{ text }] }
      expect(mockEmbedContent).toHaveBeenCalledWith({
        model: "gemini-embedding-2-preview",
        contents: [
          { role: "user", parts: [{ text: "Chunk 1" }] },
          { role: "user", parts: [{ text: "Chunk 2" }] },
          { role: "user", parts: [{ text: "Chunk 3" }] },
        ],
        config: { outputDimensionality: 3072 },
      });
    });

    it("should batch in chunks of 50 for large uploads (TC-EMB-07)", async () => {
      const texts = Array.from({ length: 120 }, (_, i) => `Text chunk ${i}`);
      const makeBatchResponse = (count: number) => ({
        embeddings: Array.from({ length: count }, () => ({
          values: new Array(3072).fill(0.1),
        })),
      });

      mockEmbedContent
        .mockResolvedValueOnce(makeBatchResponse(50)) // Sub-batch 1: 0..50
        .mockResolvedValueOnce(makeBatchResponse(50)) // Sub-batch 2: 50..100
        .mockResolvedValueOnce(makeBatchResponse(20)); // Sub-batch 3: 100..120

      const results = await generateEmbeddingsBatch(texts, { initialDelayMs: 0 });

      expect(results.length).toBe(120);
      expect(mockEmbedContent).toHaveBeenCalledTimes(3);
    });

    it("should retry upload batch up to 3 times on 429 and succeed (TC-EMB-09)", async () => {
      const texts = ["Text A", "Text B"];
      const makeBatchResponse = (count: number) => ({
        embeddings: Array.from({ length: count }, () => ({
          values: new Array(3072).fill(0.2),
        })),
      });

      mockEmbedContent
        .mockRejectedValueOnce(new ApiError({ status: 429, message: "Rate limit 1" }))
        .mockRejectedValueOnce(new ApiError({ status: 503, message: "Service unavailable" }))
        .mockRejectedValueOnce(new ApiError({ status: 429, message: "Rate limit 2" }))
        .mockResolvedValueOnce(makeBatchResponse(2));

      const results = await generateEmbeddingsBatch(texts, { initialDelayMs: 0 });

      expect(results.length).toBe(2);
      expect(mockEmbedContent).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it("should fail immediately on non-retryable errors like 400 Bad Request", async () => {
      mockEmbedContent.mockRejectedValueOnce(
        new ApiError({ status: 400, message: "Invalid argument" })
      );

      await expect(generateEmbeddingsBatch(["Sample"], { initialDelayMs: 0 })).rejects.toThrow(
        "Invalid argument"
      );

      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    });
  });
});
