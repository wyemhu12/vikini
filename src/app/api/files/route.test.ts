// Tests for /api/files route (GET + DELETE)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { FileRow } from "@/types/files";

// Mock dependencies BEFORE importing the route
vi.mock("@/app/api/conversations/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/features/files/fileService.server", () => ({
  listFiles: vi.fn(),
  deleteFile: vi.fn(),
  deleteFilesByConversation: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

// Import route handlers AFTER mocks
import { GET, DELETE } from "./route";
import { requireUser } from "@/app/api/conversations/auth";
import {
  listFiles,
  deleteFile,
  deleteFilesByConversation,
} from "@/lib/features/files/fileService.server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "a1b2c3d4-e5f6-1234-9abc-def012345678";
const VALID_FILE_ID = "f0e1d2c3-b4a5-1678-9012-abcdef012345";

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockUnauthorized() {
  vi.mocked(requireUser).mockResolvedValue({
    ok: false,
    response: new Response(
      JSON.stringify({ success: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }),
      { status: 401 }
    ) as unknown as import("next/server").NextResponse,
  });
}

function mockAuthorized(userId = "test@test.com") {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId,
    session: {},
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET
  // =========================================================================
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthorized();

      const req = createRequest("GET", "/api/files?conversationId=" + VALID_UUID);
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("should return 400 when conversationId is missing", async () => {
      mockAuthorized();

      const req = createRequest("GET", "/api/files");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 when conversationId is invalid UUID", async () => {
      mockAuthorized();

      const req = createRequest("GET", "/api/files?conversationId=not-a-uuid");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return files on success", async () => {
      mockAuthorized();

      const mockFiles = [
        {
          id: VALID_FILE_ID,
          filename: "photo.png",
          size_bytes: 1024,
          mime_type: "image/png",
          kind: "image",
          created_at: "2026-01-01T00:00:00Z",
          conversation_id: VALID_UUID,
          gemini_file_uri: "https://generativelanguage.googleapis.com/file/abc",
          // Extra fields that should NOT leak to client
          storage_path: "secret/path",
        },
        {
          id: "b0000000-0000-1000-a000-000000000002",
          filename: "doc.pdf",
          size_bytes: 2048,
          mime_type: "application/pdf",
          kind: "document",
          created_at: "2026-01-02T00:00:00Z",
          conversation_id: VALID_UUID,
          gemini_file_uri: null,
        },
      ];

      vi.mocked(listFiles).mockResolvedValue(mockFiles as unknown as FileRow[]);

      const req = createRequest("GET", `/api/files?conversationId=${VALID_UUID}`);
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.files).toHaveLength(2);

      // Verify client-safe mapping
      const first = json.data.files[0];
      expect(first).toEqual({
        id: VALID_FILE_ID,
        filename: "photo.png",
        size_bytes: 1024,
        mime_type: "image/png",
        kind: "image",
        created_at: "2026-01-01T00:00:00Z",
        conversation_id: VALID_UUID,
        gemini_ready: true,
      });

      // Second file should have gemini_ready = false
      expect(json.data.files[1].gemini_ready).toBe(false);

      // storage_path should NOT be in the response
      expect(first).not.toHaveProperty("storage_path");
      expect(first).not.toHaveProperty("gemini_file_uri");

      expect(listFiles).toHaveBeenCalledWith({
        userId: "test@test.com",
        conversationId: VALID_UUID,
      });
    });

    it("should return empty array when no files exist", async () => {
      mockAuthorized();
      vi.mocked(listFiles).mockResolvedValue([]);

      const req = createRequest("GET", `/api/files?conversationId=${VALID_UUID}`);
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.files).toEqual([]);
    });

    it("should return 500 when listFiles throws unexpected error", async () => {
      mockAuthorized();
      vi.mocked(listFiles).mockRejectedValue(new Error("DB connection lost"));

      const req = createRequest("GET", `/api/files?conversationId=${VALID_UUID}`);
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  // =========================================================================
  // DELETE
  // =========================================================================
  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthorized();

      const req = createRequest("DELETE", `/api/files?id=${VALID_FILE_ID}`);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    // --- Delete single file by id ---
    it("should delete a single file by id", async () => {
      mockAuthorized();
      vi.mocked(deleteFile).mockResolvedValue({ ok: true });

      const req = createRequest("DELETE", `/api/files?id=${VALID_FILE_ID}`);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.ok).toBe(true);
      expect(deleteFile).toHaveBeenCalledWith({
        userId: "test@test.com",
        id: VALID_FILE_ID,
      });
    });

    it("should return 400 when id is invalid UUID", async () => {
      mockAuthorized();

      const req = createRequest("DELETE", "/api/files?id=bad-id");
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    // --- Delete all files by conversationId ---
    it("should delete all files by conversationId", async () => {
      mockAuthorized();
      vi.mocked(deleteFilesByConversation).mockResolvedValue({ ok: true, deleted: 3 });

      const req = createRequest("DELETE", `/api/files?conversationId=${VALID_UUID}`);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(3);
      expect(deleteFilesByConversation).toHaveBeenCalledWith("test@test.com", VALID_UUID);
    });

    it("should return 400 when conversationId is invalid UUID for DELETE", async () => {
      mockAuthorized();

      const req = createRequest("DELETE", "/api/files?conversationId=not-uuid");
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    // --- Fallback: read id from body ---
    it("should read id from request body when not in query params", async () => {
      mockAuthorized();
      vi.mocked(deleteFile).mockResolvedValue({ ok: true });

      const req = createRequest("DELETE", "/api/files", { id: VALID_FILE_ID });
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(deleteFile).toHaveBeenCalledWith({
        userId: "test@test.com",
        id: VALID_FILE_ID,
      });
    });

    // --- No id and no conversationId ---
    it("should return 400 when neither id nor conversationId is provided", async () => {
      mockAuthorized();

      // Need to create a request with an empty body to avoid json parse error path
      const req = createRequest("DELETE", "/api/files", {});
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 500 when deleteFile throws unexpected error", async () => {
      mockAuthorized();
      vi.mocked(deleteFile).mockRejectedValue(new Error("Storage failure"));

      const req = createRequest("DELETE", `/api/files?id=${VALID_FILE_ID}`);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
