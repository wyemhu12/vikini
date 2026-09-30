import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadFile, linkFilesToMessage, getFilesConfig } from "./fileService.server";

// Mock Supabase admin
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      }),
    },
  }),
}));

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => ({
    files: {
      upload: vi.fn(),
      delete: vi.fn(),
    },
  }),
}));

vi.mock("@/lib/core/limits", () => ({
  getConversationStorageLimit: vi.fn().mockResolvedValue(100 * 1024 * 1024),
  checkFileSize: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("./geminiFiles.server", () => ({
  uploadToGemini: vi.fn().mockResolvedValue({
    name: "files/mock-gemini-name",
    uri: "https://generativelanguage.googleapis.com/v1beta/files/mock-gemini-name",
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  }),
  refreshGeminiUri: vi.fn().mockResolvedValue(null),
}));

vi.mock("./documentParsers", () => ({
  extractDocumentText: vi.fn().mockImplementation(async (bytes, mime, filename) => {
    if (filename.endsWith(".docx")) return "Mock extracted DOCX text";
    if (filename.endsWith(".txt")) return "Mock text file content";
    return null;
  }),
}));

describe("fileService.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFilesConfig", () => {
    it("returns default configuration", () => {
      const config = getFilesConfig();
      expect(config.bucket).toBeDefined();
      expect(config.maxFilesPerConversation).toBe(30);
      expect(config.maxTotalBytesPerConversation).toBe(100 * 1024 * 1024);
      expect(config.ttlDays).toBe(30);
    });
  });

  describe("linkFilesToMessage", () => {
    it("does nothing if fileIds is empty or messageId is empty", async () => {
      await linkFilesToMessage("user-1", "conv-1", [], "msg-1");
      expect(mockFrom).not.toHaveBeenCalled();

      await linkFilesToMessage("user-1", "conv-1", ["file-1"], "");
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("applies strict tenant filtering when linking files", async () => {
      const inMock = vi.fn().mockResolvedValue({ error: null });
      const isMock = vi.fn().mockReturnValue({ in: inMock });
      const eqConvMock = vi.fn().mockReturnValue({ is: isMock });
      const eqUserMock = vi.fn().mockReturnValue({ eq: eqConvMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqUserMock });

      mockFrom.mockReturnValue({ update: updateMock });

      await linkFilesToMessage("user-1", "conv-1", ["file-1", "file-2"], "msg-123");

      expect(mockFrom).toHaveBeenCalledWith("files");
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message_id: "msg-123",
        })
      );
      expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
      expect(eqConvMock).toHaveBeenCalledWith("conversation_id", "conv-1");
      expect(isMock).toHaveBeenCalledWith("message_id", null);
      expect(inMock).toHaveBeenCalledWith("id", ["file-1", "file-2"]);
    });
  });

  describe("uploadFile", () => {
    it("uploads file with ASCII storage path and parses document text", async () => {
      // 1. Mock quota check
      const quotaSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });

      // 2. Mock storage upload success
      mockStorageUpload.mockResolvedValue({ error: null });

      // 3. Mock DB insert
      const insertSingle = vi.fn().mockResolvedValue({
        data: {
          id: "file-uuid-1",
          user_id: "user-1",
          conversation_id: "conv-1",
          filename: "Báo cáo tài chính.docx",
          storage_path: "user-1/conv-1/mock.docx",
          extracted_text: "Mock extracted DOCX text",
          token_count: 6,
        },
        error: null,
      });

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: insertSingle,
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "files") {
          return {
            select: quotaSelect,
            insert: insertMock,
          };
        }
        return {};
      });

      // Prepare file
      const content = new TextEncoder().encode("docx binary bytes");
      const file = new File([content], "Báo cáo tài chính.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const result = await uploadFile({
        userId: "user-1",
        conversationId: "conv-1",
        file,
        filename: "Báo cáo tài chính.docx",
      });

      expect(result.file).toBeDefined();
      expect(result.geminiReady).toBe(true);
      expect(mockStorageUpload).toHaveBeenCalled();

      // Verify storage path uses ASCII format: user-1/conv-1/<uuid>.docx
      const uploadedPath = mockStorageUpload.mock.calls[0][0] as string;
      expect(uploadedPath).toMatch(/^user-1\/conv-1\/[a-f0-9-]+\.docx$/);
      expect(uploadedPath).not.toContain("Báo cáo");

      // Verify DB insert contains extracted text and token count
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "Báo cáo tài chính.docx",
          extracted_text: "Mock extracted DOCX text",
          token_count: expect.any(Number),
        })
      );
    });
  });
});
