import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for supabase & embedding
const {
  mockSupabaseFrom,
  mockSupabaseRpc,
  mockGenerateEmbedding,
  mockGenerateEmbeddingsBatch,
  mockFormatQueryForRAG,
  mockFormatDocumentForRAG,
  mockChunkContent,
} = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockSupabaseRpc: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
  mockGenerateEmbeddingsBatch: vi.fn(),
  mockFormatQueryForRAG: vi.fn((q: string) => `formatted:${q}`),
  mockFormatDocumentForRAG: vi.fn((c: string, t?: string) => `formatted:${t}:${c}`),
  mockChunkContent: vi.fn(),
}));

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
  })),
}));

vi.mock("./embedding.server", () => ({
  generateEmbedding: mockGenerateEmbedding,
  generateEmbeddingsBatch: mockGenerateEmbeddingsBatch,
  formatQueryForRAG: mockFormatQueryForRAG,
  formatDocumentForRAG: mockFormatDocumentForRAG,
}));

vi.mock("./chunking", () => ({
  chunkContent: mockChunkContent,
}));

vi.mock("./projects.server", () => ({
  getUserTier: vi.fn().mockResolvedValue("pro"),
  getTierLimits: vi.fn().mockReturnValue({
    maxDocsPerProject: 50,
    maxStorageBytesPerProject: 50 * 1024 * 1024,
  }),
  canAddStorageToProject: vi.fn().mockResolvedValue({
    allowed: true,
    currentBytes: 1000,
    maxBytes: 50 * 1024 * 1024,
  }),
}));

import {
  getProjectDocuments,
  getDocument,
  deleteDocument,
  uploadDocument,
  cleanupStuckProcessingDocuments,
  searchKnowledge,
} from "./knowledge.server";
import { canAddStorageToProject } from "./projects.server";
import { ValidationError } from "@/lib/utils/errors";

describe("knowledge.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProjectDocuments, getDocument, deleteDocument", () => {
    it("should fetch all project documents ordered by created_at desc", async () => {
      const mockDocs = [{ id: "doc-1", filename: "test.md" }];
      const orderMock = vi.fn().mockResolvedValue({ data: mockDocs, error: null });
      const eqUserMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqProjectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqProjectMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      const result = await getProjectDocuments("prj-1", "user-1");

      expect(mockSupabaseFrom).toHaveBeenCalledWith("knowledge_documents");
      expect(selectMock).toHaveBeenCalledWith("*");
      expect(eqProjectMock).toHaveBeenCalledWith("project_id", "prj-1");
      expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
      expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(result).toEqual(mockDocs);
    });

    it("should return single document or null", async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { id: "doc-1" }, error: null });
      const eqUserMock = vi.fn().mockReturnValue({ single: singleMock });
      const eqDocMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqDocMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      const doc = await getDocument("doc-1", "user-1");
      expect(doc).toEqual({ id: "doc-1" });

      singleMock.mockResolvedValueOnce({ data: null, error: new Error("Not found") });
      const nullDoc = await getDocument("doc-not-found", "user-1");
      expect(nullDoc).toBeNull();
    });

    it("should delete document by id and user_id", async () => {
      const eqUserMock = vi.fn().mockResolvedValue({ error: null });
      const eqDocMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqDocMock });
      mockSupabaseFrom.mockReturnValue({ delete: deleteMock });

      await deleteDocument("doc-1", "user-1");

      expect(mockSupabaseFrom).toHaveBeenCalledWith("knowledge_documents");
      expect(deleteMock).toHaveBeenCalled();
      expect(eqDocMock).toHaveBeenCalledWith("id", "doc-1");
      expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
    });
  });

  describe("uploadDocument & Pre-Insert Validation (TC-EMB-10)", () => {
    it("should reject unsupported file types before DB operations", async () => {
      await expect(
        uploadDocument({
          projectId: "prj-1",
          userId: "user-1",
          filename: "malicious.exe",
          content: "binary content",
        })
      ).rejects.toThrow(ValidationError);

      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it("should reject files exceeding 5MB limit before DB operations", async () => {
      const largeContent = "a".repeat(5 * 1024 * 1024 + 1);

      await expect(
        uploadDocument({
          projectId: "prj-1",
          userId: "user-1",
          filename: "huge.txt",
          content: largeContent,
        })
      ).rejects.toThrow("File size exceeds 5MB limit");

      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it("should reject when storage limit is exceeded", async () => {
      vi.mocked(canAddStorageToProject).mockResolvedValueOnce({
        allowed: false,
        currentBytes: 50 * 1024 * 1024,
        maxBytes: 50 * 1024 * 1024,
      });

      await expect(
        uploadDocument({
          projectId: "prj-1",
          userId: "user-1",
          filename: "test.txt",
          content: "sample text",
        })
      ).rejects.toThrow("Storage limit exceeded");
    });

    it("should reject empty chunks before inserting document record", async () => {
      // Mock existing documents query for limit check
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqUserMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqProjectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqProjectMock }),
      });

      mockChunkContent.mockReturnValueOnce([]);

      await expect(
        uploadDocument({
          projectId: "prj-1",
          userId: "user-1",
          filename: "empty.md",
          content: "   ",
        })
      ).rejects.toThrow("No content to process");

      // Verify no document was inserted
      expect(mockSupabaseFrom).not.toHaveBeenCalledWith(
        expect.stringMatching(/knowledge_documents/),
        expect.anything()
      );
    });

    it("should reject chunks count > 500 BEFORE creating document in DB (TC-EMB-10)", async () => {
      // Mock existing documents query for limit check
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqUserMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqProjectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqProjectMock }),
      });

      // 501 chunks
      const fakeChunks = Array.from({ length: 501 }, (_, i) => ({
        index: i,
        content: `chunk ${i}`,
        metadata: {},
      }));
      mockChunkContent.mockReturnValueOnce(fakeChunks);

      await expect(
        uploadDocument({
          projectId: "prj-1",
          userId: "user-1",
          filename: "huge-document.md",
          content: "lots of text",
        })
      ).rejects.toThrow("Document exceeds maximum 500 chunks limit (~350–400 KB text)");

      // Assert that knowledge_documents.insert was NEVER called
      const insertCalls = mockSupabaseFrom.mock.calls.filter(
        (call) => call[0] === "knowledge_documents"
      );
      // Only getProjectDocuments select call occurred
      expect(insertCalls.length).toBe(1); // from("knowledge_documents").select()
    });

    it("should successfully upload, embed in native batch, insert chunks, and finalize to ready", async () => {
      // 1. Existing docs query
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqUserMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqProjectMock = vi.fn().mockReturnValue({ eq: eqUserMock });

      // 2. Doc insert
      const docSingleMock = vi.fn().mockResolvedValue({
        data: { id: "doc-123", filename: "guide.md" },
        error: null,
      });
      const docSelectMock = vi.fn().mockReturnValue({ single: docSingleMock });
      const docInsertMock = vi.fn().mockReturnValue({ select: docSelectMock });

      // 3. Chunks insert
      const chunkInsertMock = vi.fn().mockResolvedValue({ error: null });

      // 4. Doc update to ready
      const updateSingleMock = vi.fn().mockResolvedValue({
        data: { id: "doc-123", filename: "guide.md", status: "ready", total_chunks: 2 },
        error: null,
      });
      const updateSelectMock = vi.fn().mockReturnValue({ single: updateSingleMock });
      const updateEqMock = vi.fn().mockReturnValue({ select: updateSelectMock });
      const docUpdateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "knowledge_documents") {
          return {
            select: vi.fn().mockReturnValue({ eq: eqProjectMock }),
            insert: docInsertMock,
            update: docUpdateMock,
          };
        }
        if (table === "knowledge_chunks") {
          return {
            insert: chunkInsertMock,
          };
        }
        return {};
      });

      mockChunkContent.mockReturnValueOnce([
        { index: 0, content: "chunk 0", metadata: { section: "A" } },
        { index: 1, content: "chunk 1", metadata: { section: "B" } },
      ]);

      const mockVectors = [new Array(3072).fill(0.1), new Array(3072).fill(0.2)];
      mockGenerateEmbeddingsBatch.mockResolvedValueOnce(mockVectors);

      const result = await uploadDocument({
        projectId: "prj-1",
        userId: "user-1",
        filename: "guide.md",
        content: "Guide content",
      });

      // Verify document was inserted with gemini-embedding-2
      expect(docInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: "prj-1",
          user_id: "user-1",
          filename: "guide.md",
          embedding_model: "gemini-embedding-2",
          status: "processing",
        })
      );

      // Verify native batch embeddings called
      expect(mockGenerateEmbeddingsBatch).toHaveBeenCalledWith([
        "formatted:guide.md:chunk 0",
        "formatted:guide.md:chunk 1",
      ]);

      // Verify chunk inserts format embedding as [0.1,0.1,...]
      expect(chunkInsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            document_id: "doc-123",
            chunk_index: 0,
            content: "chunk 0",
            embedding: expect.stringMatching(/^\[0\.1,0\.1/),
          }),
          expect.objectContaining({
            document_id: "doc-123",
            chunk_index: 1,
            content: "chunk 1",
            embedding: expect.stringMatching(/^\[0\.2,0\.2/),
          }),
        ])
      );

      // Verify doc updated to ready
      expect(docUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ready",
          total_chunks: 2,
        })
      );

      expect(result.status).toBe("ready");
    });

    it("should update document status to error if chunk embedding fails", async () => {
      // 1. Existing docs query
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const eqUserMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqProjectMock = vi.fn().mockReturnValue({ eq: eqUserMock });

      // 2. Doc insert
      const docSingleMock = vi.fn().mockResolvedValue({
        data: { id: "doc-failed", filename: "fail.md" },
        error: null,
      });
      const docSelectMock = vi.fn().mockReturnValue({ single: docSingleMock });
      const docInsertMock = vi.fn().mockReturnValue({ select: docSelectMock });

      // 3. Error update mock
      const errorEqMock = vi.fn().mockResolvedValue({ error: null });
      const docUpdateMock = vi.fn().mockReturnValue({ eq: errorEqMock });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "knowledge_documents") {
          return {
            select: vi.fn().mockReturnValue({ eq: eqProjectMock }),
            insert: docInsertMock,
            update: docUpdateMock,
          };
        }
        return {};
      });

      mockChunkContent.mockReturnValueOnce([{ index: 0, content: "chunk 0", metadata: {} }]);

      mockGenerateEmbeddingsBatch.mockRejectedValueOnce(new Error("Gemini API connection error"));

      await expect(
        uploadDocument({
          projectId: "prj-1",
          userId: "user-1",
          filename: "fail.md",
          content: "Content that fails embedding",
        })
      ).rejects.toThrow("Gemini API connection error");

      expect(docUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
          error_message: "Gemini API connection error",
        })
      );
      expect(errorEqMock).toHaveBeenCalledWith("id", "doc-failed");
    });
  });

  describe("cleanupStuckProcessingDocuments (TC-EMB-12)", () => {
    it("should update stuck processing documents older than 15 minutes globally", async () => {
      const selectMock = vi.fn().mockResolvedValue({
        data: [{ id: "stuck-1" }, { id: "stuck-2" }],
        error: null,
      });
      const ltMock = vi.fn().mockReturnValue({ select: selectMock });
      const eqMock = vi.fn().mockReturnValue({ lt: ltMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseFrom.mockReturnValue({ update: updateMock });

      const cleanedCount = await cleanupStuckProcessingDocuments();

      expect(mockSupabaseFrom).toHaveBeenCalledWith("knowledge_documents");
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
          error_message: "Upload processing timed out (exceeded 15 minutes)",
        })
      );
      expect(eqMock).toHaveBeenCalledWith("status", "processing");
      expect(ltMock).toHaveBeenCalledWith("updated_at", expect.any(String));
      expect(cleanedCount).toBe(2);
    });

    it("should filter by projectId when provided", async () => {
      const selectMock = vi.fn().mockResolvedValue({
        data: [{ id: "stuck-1" }],
        error: null,
      });
      const eqProjectMock = vi.fn().mockReturnValue({ select: selectMock });
      const ltMock = vi.fn().mockReturnValue({ eq: eqProjectMock });
      const eqStatusMock = vi.fn().mockReturnValue({ lt: ltMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqStatusMock });
      mockSupabaseFrom.mockReturnValue({ update: updateMock });

      const cleanedCount = await cleanupStuckProcessingDocuments("prj-specific");

      expect(eqProjectMock).toHaveBeenCalledWith("project_id", "prj-specific");
      expect(cleanedCount).toBe(1);
    });

    it("should return 0 when query errors", async () => {
      const selectMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("DB Connection Error"),
      });
      const ltMock = vi.fn().mockReturnValue({ select: selectMock });
      const eqMock = vi.fn().mockReturnValue({ lt: ltMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseFrom.mockReturnValue({ update: updateMock });

      const cleanedCount = await cleanupStuckProcessingDocuments();
      expect(cleanedCount).toBe(0);
    });
  });

  describe("searchKnowledge (TC-EMB-11)", () => {
    it("should execute zero-sample search calling RPC match_project_knowledge directly without projects lookup", async () => {
      const mockVector = new Array(3072).fill(0.123);
      mockGenerateEmbedding.mockResolvedValueOnce(mockVector);

      const mockSearchResults = [
        {
          id: "chunk-1",
          content: "matched content",
          similarity: 0.89,
          filename: "doc.md",
          chunk_index: 0,
          metadata: {},
        },
      ];
      mockSupabaseRpc.mockResolvedValueOnce({
        data: mockSearchResults,
        error: null,
      });

      const results = await searchKnowledge("prj-123", "user-456", "How does auth work?", {
        threshold: 0.75,
        limit: 10,
      });

      // 1. Assert NO call to supabase.from("projects") or sample chunk lookup
      expect(mockSupabaseFrom).not.toHaveBeenCalledWith("projects");
      expect(mockSupabaseFrom).not.toHaveBeenCalledWith("knowledge_chunks");

      // 2. Assert query formatted and embedded
      expect(mockFormatQueryForRAG).toHaveBeenCalledWith("How does auth work?");
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("formatted:How does auth work?");

      // 3. Assert RPC called with 3072d vector and params
      expect(mockSupabaseRpc).toHaveBeenCalledWith("match_project_knowledge", {
        p_project_id: "prj-123",
        query_embedding: expect.stringMatching(/^\[0\.123,0\.123/),
        match_threshold: 0.75,
        match_count: 10,
      });

      expect(results).toEqual(mockSearchResults);
    });

    it("should use default threshold 0.7 and limit 5 when options omitted", async () => {
      const mockVector = new Array(3072).fill(0.5);
      mockGenerateEmbedding.mockResolvedValueOnce(mockVector);
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await searchKnowledge("prj-1", "user-1", "test query");

      expect(mockSupabaseRpc).toHaveBeenCalledWith("match_project_knowledge", {
        p_project_id: "prj-1",
        query_embedding: expect.any(String),
        match_threshold: 0.7,
        match_count: 5,
      });
    });

    it("should throw error if RPC fails", async () => {
      mockGenerateEmbedding.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockSupabaseRpc.mockResolvedValueOnce({
        data: null,
        error: new Error("RPC match_project_knowledge failed"),
      });

      await expect(searchKnowledge("prj-1", "user-1", "query")).rejects.toThrow("Search failed");
    });
  });
});
