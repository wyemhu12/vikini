// Tests for DELETE /api/gallery/[id]
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mocks - declared BEFORE importing the route
// ============================================================================

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

// Chainable Supabase mock
const mockSingle = vi.fn();
const mockEqChain = vi.fn();
const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockStorageRemove = vi.fn();

const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: mockEqChain,
  single: mockSingle,
};

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "messages") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
          delete: mockDelete,
        };
      }
      return mockSupabaseQuery;
    }),
    storage: {
      from: vi.fn(() => ({
        remove: mockStorageRemove,
      })),
    },
  })),
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

import { DELETE } from "./route";
import { auth } from "@/lib/features/auth/auth";

// ============================================================================
// Helpers
// ============================================================================

function createRequest(method: string, url: string): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAuth(session: unknown) {
  vi.mocked(auth).mockResolvedValue(session as unknown as Awaited<ReturnType<typeof auth>>);
}

const VALID_MSG_ID = "a1b2c3d4-e5f6-7890-abcd-ef0123456789";
const AUTH_SESSION = { user: { email: "Test@Example.com", id: "user-1" } };

// ============================================================================
// Tests
// ============================================================================

describe("/api/gallery/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe("DELETE - Auth", () => {
    it("should return 401 when session is null", async () => {
      mockAuth(null);

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("should return 401 when session has no user", async () => {
      mockAuth({ user: undefined });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });

      expect(res.status).toBe(401);
    });

    it("should return 401 when user has no email", async () => {
      mockAuth({ user: { id: "u1" } });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("DELETE - Validation", () => {
    it("should return 400 when message ID is empty", async () => {
      mockAuth(AUTH_SESSION);

      const req = createRequest("DELETE", "/api/gallery/");
      const res = await DELETE(req, { params: Promise.resolve({ id: "" }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------
  describe("DELETE - Happy path", () => {
    it("should delete message and return success", async () => {
      mockAuth(AUTH_SESSION);
      mockSingle.mockResolvedValue({
        data: {
          id: VALID_MSG_ID,
          meta: null,
          conversation_id: "conv-1",
          conversations: { user_id: "test@example.com" },
        },
        error: null,
      });
      mockDeleteEq.mockResolvedValue({ error: null });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
    });

    it("should delete storage file when storagePath exists in meta", async () => {
      mockAuth(AUTH_SESSION);
      mockSingle.mockResolvedValue({
        data: {
          id: VALID_MSG_ID,
          meta: { attachment: { storagePath: "uploads/img.png" } },
          conversation_id: "conv-1",
          conversations: { user_id: "test@example.com" },
        },
        error: null,
      });
      mockStorageRemove.mockResolvedValue({ error: null });
      mockDeleteEq.mockResolvedValue({ error: null });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockStorageRemove).toHaveBeenCalledWith(["uploads/img.png"]);
    });

    it("should continue deletion even if storage removal fails", async () => {
      mockAuth(AUTH_SESSION);
      mockSingle.mockResolvedValue({
        data: {
          id: VALID_MSG_ID,
          meta: { attachment: { storagePath: "uploads/img.png" } },
          conversation_id: "conv-1",
          conversations: { user_id: "test@example.com" },
        },
        error: null,
      });
      mockStorageRemove.mockResolvedValue({ error: { message: "Storage error" } });
      mockDeleteEq.mockResolvedValue({ error: null });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      // Should still succeed because storage deletion is non-blocking
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Not found / Forbidden
  // --------------------------------------------------------------------------
  describe("DELETE - Not found / Forbidden", () => {
    it("should return 404 when message is not found", async () => {
      mockAuth(AUTH_SESSION);
      mockSingle.mockResolvedValue({ data: null, error: { message: "No rows" } });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("should return 403 when user does not own the conversation", async () => {
      mockAuth(AUTH_SESSION);
      mockSingle.mockResolvedValue({
        data: {
          id: VALID_MSG_ID,
          meta: null,
          conversation_id: "conv-1",
          conversations: { user_id: "other-user@example.com" },
        },
        error: null,
      });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FORBIDDEN");
    });
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe("DELETE - Error handling", () => {
    it("should return 500 when message delete query fails", async () => {
      mockAuth(AUTH_SESSION);
      mockSingle.mockResolvedValue({
        data: {
          id: VALID_MSG_ID,
          meta: null,
          conversation_id: "conv-1",
          conversations: { user_id: "test@example.com" },
        },
        error: null,
      });
      mockDeleteEq.mockResolvedValue({ error: { message: "DB error" } });

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should return 500 when auth throws unexpected error", async () => {
      vi.mocked(auth).mockRejectedValue(new Error("Auth service down"));

      const req = createRequest("DELETE", `/api/gallery/${VALID_MSG_ID}`);
      const res = await DELETE(req, { params: Promise.resolve({ id: VALID_MSG_ID }) });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
