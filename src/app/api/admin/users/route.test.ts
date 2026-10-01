// /app/api/admin/users/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            order: (...oArgs: unknown[]) => {
              mockOrder(...oArgs);
              return mockOrder.mock.results[mockOrder.mock.results.length - 1]?.value;
            },
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                single: () => mockSingle(),
                maybeSingle: () => mockSingle(),
              };
            },
          };
        },
        update: (...uArgs: unknown[]) => {
          mockUpdate(...uArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return mockUpdateEq(...eArgs);
            },
          };
        },
      };
    },
  })),
}));

vi.mock("@/lib/features/admin/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/features/auth/authRevocation", () => ({
  bumpAuthVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      audit: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports - AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GET, PATCH } from "./route";
import { auth } from "@/lib/features/auth/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_UUID = "target@example.com";

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAdmin() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: "admin@test.com", id: "admin-id", rank: "admin" },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockNonAdmin() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: "user@test.com", id: "user-id", rank: "basic" },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== GET ========================
  describe("GET", () => {
    it("should return 403 if not authenticated", async () => {
      mockUnauthenticated();
      const res = await GET();
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 403 if user is not admin", async () => {
      mockNonAdmin();
      const res = await GET();
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return users list on success", async () => {
      mockAdmin();
      const mockUsers = [
        { id: "user-1", email: "a@test.com", rank: "basic", is_blocked: false },
        { id: "user-2", email: "b@test.com", rank: "pro", is_blocked: false },
      ];
      mockOrder.mockReturnValueOnce({ data: mockUsers, error: null });

      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.users).toEqual(mockUsers);
    });

    it("should return 500 on database error", async () => {
      mockAdmin();
      mockOrder.mockReturnValueOnce({
        data: null,
        error: { message: "DB error" },
      });

      const res = await GET();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== PATCH ========================
  describe("PATCH", () => {
    it("should return 403 if not authenticated", async () => {
      mockUnauthenticated();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(403);
    });

    it("should return 403 if user is not admin", async () => {
      mockNonAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(403);
    });

    it("should return 400 when userId is missing", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", { rank: "pro" });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 for invalid userId format", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: "not-valid",
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid rank value", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "superadmin",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when no valid fields to update", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("should update user rank successfully", async () => {
      mockAdmin();
      // select().eq().maybeSingle() for target profile lookup
      mockSingle.mockResolvedValueOnce({
        data: { id: TEST_UUID, email: "target@test.com" },
        error: null,
      });
      // update().eq() for profiles
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "pro",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should update user blocked status successfully", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({
        data: { id: TEST_UUID, email: "target@test.com" },
        error: null,
      });
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        is_blocked: true,
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should return 404 when user is not found by id or email (ADM-01)", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // by id
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // by email

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: "unknown@example.com",
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("User not found");
    });

    it("should update user successfully when userId is a valid UUID", async () => {
      mockAdmin();
      const testUuid = "12345678-1234-1234-1234-123456789abc";
      mockSingle.mockResolvedValueOnce({
        data: { id: testUuid, email: "uuid-user@example.com" },
        error: null,
      });
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: testUuid,
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should return 500 on database error during update", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({
        data: { id: TEST_UUID, email: "target@test.com" },
        error: null,
      });
      mockUpdateEq.mockResolvedValueOnce({
        error: { message: "Update failed" },
      });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "basic",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(500);
    });
  });
});
