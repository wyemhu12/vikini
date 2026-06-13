// Tests for POST /api/gems/preview
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mocks — declared BEFORE importing the route
// ============================================================================

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
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
// Imports — AFTER mocks
// ============================================================================

import { POST } from "./route";
import { auth } from "@/lib/features/auth/auth";

// ============================================================================
// Helpers
// ============================================================================

function _createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAuth(session: unknown) {
  vi.mocked(auth).mockResolvedValue(session as unknown as Awaited<ReturnType<typeof auth>>);
}

const AUTH_SESSION = { user: { email: "test@example.com", id: "user-1" } };

// ============================================================================
// Tests
// ============================================================================

describe("/api/gems/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe("POST — Auth", () => {
    it("should return 401 when session is null", async () => {
      mockAuth(null);

      const res = await POST();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when session has no user", async () => {
      mockAuth({ user: undefined });

      const res = await POST();

      expect(res.status).toBe(401);
    });

    it("should return 401 when user has no email", async () => {
      mockAuth({ user: { id: "u1" } });

      const res = await POST();

      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------
  describe("POST — Happy path", () => {
    it("should return placeholder success response", async () => {
      mockAuth(AUTH_SESSION);

      const res = await POST();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.ok).toBe(true);
      expect(json.data.placeholder).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe("POST — Error handling", () => {
    it("should return 500 when auth throws unexpected error", async () => {
      vi.mocked(auth).mockRejectedValue(new Error("Auth service down"));

      const res = await POST();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
