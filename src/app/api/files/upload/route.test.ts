// Tests for POST /api/files/upload
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mocks - declared BEFORE importing the route
// ============================================================================

vi.mock("@/app/api/conversations/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/features/chat/conversations", () => ({
  getConversation: vi.fn(),
}));

vi.mock("@/lib/features/files/fileService.server", () => ({
  uploadFile: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// ============================================================================
// Imports - AFTER mocks
// ============================================================================

import { POST } from "./route";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { uploadFile } from "@/lib/features/files/fileService.server";

// ============================================================================
// Helpers
// ============================================================================

const VALID_CONV_ID = "a1b2c3d4-e5f6-7890-abcd-ef0123456789";
const VALID_FILE_ID = "f0e1d2c3-b4a5-1678-9012-abcdef012345";

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

function createFormDataRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new NextRequest(new URL("/api/files/upload", "http://localhost:3000"), {
    method: "POST",
    body: formData,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("/api/files/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe("POST - Auth", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthorized();

      const req = createFormDataRequest({
        conversationId: VALID_CONV_ID,
        file: new File(["hello"], "test.txt", { type: "text/plain" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("POST - Validation", () => {
    it("should return 400 when conversationId is missing", async () => {
      mockAuthorized();

      const req = createFormDataRequest({
        file: new File(["hello"], "test.txt", { type: "text/plain" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 when file is missing", async () => {
      mockAuthorized();

      const req = createFormDataRequest({
        conversationId: VALID_CONV_ID,
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // --------------------------------------------------------------------------
  // Not found
  // --------------------------------------------------------------------------
  describe("POST - Not found", () => {
    it("should return 404 when conversation does not exist", async () => {
      mockAuthorized();
      vi.mocked(getConversation).mockResolvedValue(null);

      const req = createFormDataRequest({
        conversationId: VALID_CONV_ID,
        file: new File(["hello"], "test.txt", { type: "text/plain" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("should return 404 when conversation belongs to a different user", async () => {
      mockAuthorized("test@test.com");
      vi.mocked(getConversation).mockResolvedValue({
        id: VALID_CONV_ID,
        userId: "other-user@test.com",
      } as Awaited<ReturnType<typeof getConversation>>);

      const req = createFormDataRequest({
        conversationId: VALID_CONV_ID,
        file: new File(["hello"], "test.txt", { type: "text/plain" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------
  describe("POST - Happy path", () => {
    it("should upload file and return file data", async () => {
      mockAuthorized();
      vi.mocked(getConversation).mockResolvedValue({
        id: VALID_CONV_ID,
        userId: "test@test.com",
      } as Awaited<ReturnType<typeof getConversation>>);

      vi.mocked(uploadFile).mockResolvedValue({
        file: {
          id: VALID_FILE_ID,
          filename: "test.txt",
          size_bytes: 5,
          mime_type: "text/plain",
          kind: "document",
          created_at: "2026-01-01T00:00:00Z",
          conversation_id: VALID_CONV_ID,
          storage_path: "uploads/test.txt",
          user_id: "test@test.com",
          gemini_file_uri: null,
          message_id: null,
        },
        geminiReady: false,
      } as unknown as Awaited<ReturnType<typeof uploadFile>>);

      const req = createFormDataRequest({
        conversationId: VALID_CONV_ID,
        file: new File(["hello"], "test.txt", { type: "text/plain" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.file).toEqual({
        id: VALID_FILE_ID,
        filename: "test.txt",
        size_bytes: 5,
        mime_type: "text/plain",
        kind: "document",
        created_at: "2026-01-01T00:00:00Z",
        conversation_id: VALID_CONV_ID,
        gemini_ready: false,
      });

      // Verify uploadFile was called with correct params
      expect(uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "test@test.com",
          conversationId: VALID_CONV_ID,
          messageId: null,
          filename: "test.txt",
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe("POST - Error handling", () => {
    it("should return 500 when uploadFile throws unexpected error", async () => {
      mockAuthorized();
      vi.mocked(getConversation).mockResolvedValue({
        id: VALID_CONV_ID,
        userId: "test@test.com",
      } as Awaited<ReturnType<typeof getConversation>>);
      vi.mocked(uploadFile).mockRejectedValue(new Error("Storage failure"));

      const req = createFormDataRequest({
        conversationId: VALID_CONV_ID,
        file: new File(["hello"], "test.txt", { type: "text/plain" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
