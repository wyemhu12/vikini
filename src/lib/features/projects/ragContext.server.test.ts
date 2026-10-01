import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSupabaseFrom, mockSearchKnowledge } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockSearchKnowledge: vi.fn(),
}));

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

vi.mock("@/lib/features/projects/knowledge.server", () => ({
  searchKnowledge: mockSearchKnowledge,
}));

import {
  getConversationProjectId,
  buildRAGContext,
  injectRAGIntoSystemPrompt,
} from "./ragContext.server";

describe("ragContext.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConversationProjectId", () => {
    it("should return project_id when conversation belongs to user", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { project_id: "prj-owned" },
        error: null,
      });
      const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqConvoMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      const result = await getConversationProjectId("conv-1", "user-1");

      expect(mockSupabaseFrom).toHaveBeenCalledWith("conversations");
      expect(selectMock).toHaveBeenCalledWith("project_id");
      expect(eqConvoMock).toHaveBeenCalledWith("id", "conv-1");
      expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
      expect(result).toBe("prj-owned");
    });

    it("should return null when conversation does not belong to user (cross-user isolation)", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqConvoMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      const result = await getConversationProjectId("conv-1", "attacker-user");

      expect(eqUserMock).toHaveBeenCalledWith("user_id", "attacker-user");
      expect(result).toBeNull();
    });

    it("should query without user_id filter if userId is omitted", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { project_id: "prj-legacy" },
        error: null,
      });
      const eqConvoMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      const result = await getConversationProjectId("conv-1");

      expect(eqConvoMock).toHaveBeenCalledWith("id", "conv-1");
      expect(result).toBe("prj-legacy");
    });

    it("should return null on database error", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("DB failure"),
      });
      const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqConvoMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      const result = await getConversationProjectId("conv-1", "user-1");
      expect(result).toBeNull();
    });
  });

  describe("buildRAGContext", () => {
    it("should return emptyContext and NOT call searchKnowledge when conversation does not belong to user", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqConvoMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      const context = await buildRAGContext("victim-user", "conv-unowned", "Hello RAG");

      expect(context).toEqual({
        contextChunks: "",
        sources: [],
        ragEnabled: false,
        projectId: null,
      });
      expect(mockSearchKnowledge).not.toHaveBeenCalled();
    });

    it("should search knowledge base and format chunks when conversation has project owned by user", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { project_id: "prj-123" },
        error: null,
      });
      const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqConvoMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      mockSearchKnowledge.mockResolvedValueOnce([
        {
          id: "chunk-1",
          document_id: "doc-1",
          filename: "architecture.md",
          content: "Next.js App Router with TypeScript",
          similarity: 0.92,
        },
      ]);

      const context = await buildRAGContext("user-1", "conv-1", "How is the app built?");

      expect(mockSearchKnowledge).toHaveBeenCalledWith(
        "prj-123",
        "user-1",
        "How is the app built?",
        {
          threshold: 0.5,
          limit: 5,
        }
      );
      expect(context.ragEnabled).toBe(true);
      expect(context.projectId).toBe("prj-123");
      expect(context.contextChunks).toContain("[KNOWLEDGE BASE CONTEXT]");
      expect(context.contextChunks).toContain("[Source 1: architecture.md]");
      expect(context.contextChunks).toContain("Next.js App Router with TypeScript");
      expect(context.sources).toEqual([
        {
          filename: "architecture.md",
          documentId: "doc-1",
          chunkId: "chunk-1",
          similarity: 0.92,
        },
      ]);
    });

    it("should return ragEnabled: true with empty chunks when search returns no results", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { project_id: "prj-123" },
        error: null,
      });
      const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqConvoMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      mockSearchKnowledge.mockResolvedValueOnce([]);

      const context = await buildRAGContext("user-1", "conv-1", "Something unknown");

      expect(context).toEqual({
        contextChunks: "",
        sources: [],
        ragEnabled: true,
        projectId: "prj-123",
      });
    });

    it("should catch errors and return emptyContext gracefully", async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { project_id: "prj-123" },
        error: null,
      });
      const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqConvoMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqConvoMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      mockSearchKnowledge.mockRejectedValueOnce(new Error("RPC failed"));

      const context = await buildRAGContext("user-1", "conv-1", "Query");

      expect(context).toEqual({
        contextChunks: "",
        sources: [],
        ragEnabled: false,
        projectId: null,
      });
    });
  });

  describe("injectRAGIntoSystemPrompt", () => {
    it("should append contextChunks when ragEnabled is true", () => {
      const prompt = "You are a helpful assistant.";
      const ragContext = {
        contextChunks: "[KNOWLEDGE BASE CONTEXT]\nsome data\n[END KNOWLEDGE BASE CONTEXT]\n",
        sources: [],
        ragEnabled: true,
        projectId: "prj-1",
      };

      const result = injectRAGIntoSystemPrompt(prompt, ragContext);
      expect(result).toBe(`${prompt}\n\n${ragContext.contextChunks}`);
    });

    it("should return sysPrompt unchanged if ragEnabled is false", () => {
      const prompt = "You are a helpful assistant.";
      const ragContext = {
        contextChunks: "[KNOWLEDGE BASE CONTEXT]",
        sources: [],
        ragEnabled: false,
        projectId: null,
      };

      expect(injectRAGIntoSystemPrompt(prompt, ragContext)).toBe(prompt);
    });

    it("should return sysPrompt unchanged if contextChunks is empty", () => {
      const prompt = "You are a helpful assistant.";
      const ragContext = {
        contextChunks: "",
        sources: [],
        ragEnabled: true,
        projectId: "prj-1",
      };

      expect(injectRAGIntoSystemPrompt(prompt, ragContext)).toBe(prompt);
    });
  });
});
