import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  uploadFile,
  createSignedUrl,
  linkFilesToMessage,
  getFilesConfig,
  deleteFilesByConversation,
  cleanupExpiredFiles,
} from "./fileService.server";

// Mock Supabase admin
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockStorageUpload,
  remove: mockStorageRemove,
  createSignedUrl: mockStorageCreateSignedUrl,
}));
const mockFrom = vi.fn();
const mockGeminiDelete = vi.fn();
const mockGetGenAIClient = vi.fn(() => ({
  files: {
    upload: vi.fn(),
    delete: mockGeminiDelete,
  },
}));

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => mockGetGenAIClient(),
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

    it("neutralizes SVG/HTML uploads to text/plain; charset=utf-8 and forces download on createSignedUrl (TC-W1-06)", async () => {
      const quotaSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });
      mockStorageUpload.mockResolvedValue({ error: null });
      const insertSingle = vi.fn().mockResolvedValue({
        data: {
          id: "file-svg-1",
          user_id: "user-1",
          conversation_id: "conv-1",
          filename: "evil.svg",
          storage_path: "user-1/conv-1/evil.svg",
          mime_type: "image/svg+xml",
          bucket: "attachments",
        },
        error: null,
      });
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: insertSingle }),
      });

      mockFrom.mockReturnValue({
        select: quotaSelect,
        insert: insertMock,
      });

      const svgFile = new File(["<svg onload='alert(1)'></svg>"], "evil.svg", {
        type: "image/svg+xml",
      });

      await uploadFile({
        userId: "user-1",
        conversationId: "conv-1",
        file: svgFile,
        filename: "evil.svg",
      });

      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: "text/plain; charset=utf-8",
          upsert: false,
        })
      );

      // Verify createSignedUrl forces Content-Disposition attachment download for SVG
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "file-svg-1",
                  user_id: "user-1",
                  filename: "evil.svg",
                  storage_path: "user-1/conv-1/evil.svg",
                  mime_type: "image/svg+xml",
                  bucket: "attachments",
                },
                error: null,
              }),
            }),
          }),
        }),
      });
      mockStorageCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: "https://storage.supabase.co/signed/evil.svg?download=evil.svg" },
        error: null,
      });

      const signed = await createSignedUrl({ userId: "user-1", id: "file-svg-1" });
      expect(signed.signedUrl).toContain("evil.svg");
      expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith(
        "user-1/conv-1/evil.svg",
        expect.any(Number),
        { download: "evil.svg" }
      );
    });

    it("TC-W2A-05 & NP-08: cleans up Gemini file when storage upload rejects or DB insert fails", async () => {
      const quotaSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      });
      mockFrom.mockReturnValue({ select: quotaSelect });

      // (a) Storage upload rejects with network exception -> Gemini file MUST still be deleted
      mockStorageUpload.mockRejectedValueOnce(new Error("network timeout"));
      const file1 = new File(["hello"], "note.txt", { type: "text/plain" });
      await expect(
        uploadFile({
          userId: "user-1",
          conversationId: "conv-1",
          file: file1,
          filename: "note.txt",
        })
      ).rejects.toThrow("Storage upload failed");
      expect(mockGeminiDelete).toHaveBeenCalledWith({ name: "files/mock-gemini-name" });

      vi.clearAllMocks();

      // (b) Storage succeeds, DB insert fails -> both storagePath and Gemini file cleaned up
      mockStorageUpload.mockResolvedValueOnce({ error: null });
      const insertSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "db constraint" },
      });
      mockFrom.mockReturnValue({
        select: quotaSelect,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: insertSingle }),
        }),
      });

      const file2 = new File(["hello"], "note2.txt", { type: "text/plain" });
      await expect(
        uploadFile({
          userId: "user-1",
          conversationId: "conv-1",
          file: file2,
          filename: "note2.txt",
        })
      ).rejects.toThrow("DB insert failed");
      expect(mockStorageRemove).toHaveBeenCalledTimes(1);
      expect(mockGeminiDelete).toHaveBeenCalledWith({ name: "files/mock-gemini-name" });
    });
  });

  describe("deleteFilesByConversation & cleanupExpiredFiles (TC-W2A-05)", () => {
    it("groups storage deletes by row bucket and skips getGenAIClient when no gemini_file_name exists", async () => {
      const rows = [
        { id: "f1", storage_path: "u/c/1.png", bucket: "attachments", gemini_file_name: null },
        { id: "f2", storage_path: "u/c/2.png", bucket: "legacy-bucket", gemini_file_name: null },
      ];
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const res = await deleteFilesByConversation("user-1", "conv-1");
      expect(res).toEqual({ ok: true, deleted: 2 });
      expect(mockStorageFrom).toHaveBeenCalledWith("attachments");
      expect(mockStorageFrom).toHaveBeenCalledWith("legacy-bucket");
      expect(mockGetGenAIClient).not.toHaveBeenCalled();
    });

    it("breaks immediately on DB delete error (no spin-loop) and skips getGenAIClient when no gemini files", async () => {
      const expiredBatch = Array.from({ length: 200 }, (_, i) => ({
        id: `exp-${i}`,
        storage_path: `u/c/${i}.txt`,
        bucket: "attachments",
        gemini_file_name: null,
      }));
      const limitMock = vi.fn().mockResolvedValue({ data: expiredBatch, error: null });
      const deleteInMock = vi.fn().mockResolvedValue({ error: { message: "db outage" } });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({ limit: limitMock }),
        }),
        delete: vi.fn().mockReturnValue({
          in: deleteInMock,
        }),
      });

      const result = await cleanupExpiredFiles();
      expect(result).toEqual({ deleted: 0, errors: 1 });
      expect(limitMock).toHaveBeenCalledTimes(1);
      expect(deleteInMock).toHaveBeenCalledTimes(1);
      expect(mockGetGenAIClient).not.toHaveBeenCalled();
    });
  });
});
