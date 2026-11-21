// /app/api/admin/gems/route.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/requireApprovedUser", () => ({
  requireAdminUser: vi.fn(),
}));

const mockInvalidateAllGemsCache = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/core/cache", () => ({
  invalidateAllGemsCache: () => mockInvalidateAllGemsCache(),
}));

const mockSupabaseChain: Record<string, Mock> = {};

function resetChain() {
  mockSupabaseChain.from = vi.fn();
  mockSupabaseChain.select = vi.fn();
  mockSupabaseChain.insert = vi.fn();
  mockSupabaseChain.update = vi.fn();
  mockSupabaseChain.delete = vi.fn();
  mockSupabaseChain.eq = vi.fn();
  mockSupabaseChain.in = vi.fn();
  mockSupabaseChain.order = vi.fn();
  mockSupabaseChain.limit = vi.fn();
  mockSupabaseChain.single = vi.fn();
  mockSupabaseChain.maybeSingle = vi.fn();
}

resetChain();

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => {
      mockSupabaseChain.from(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSupabaseChain.select(...sArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockSupabaseChain.eq(...eArgs);
              return {
                order: (...oArgs: unknown[]) => {
                  mockSupabaseChain.order(...oArgs);
                  return mockSupabaseChain.order.mock.results[
                    mockSupabaseChain.order.mock.results.length - 1
                  ]?.value;
                },
                eq: (...e2Args: unknown[]) => {
                  mockSupabaseChain.eq(...e2Args);
                  return mockSupabaseChain.eq.mock.results[
                    mockSupabaseChain.eq.mock.results.length - 1
                  ]?.value;
                },
              };
            },
            in: (...iArgs: unknown[]) => {
              mockSupabaseChain.in(...iArgs);
              return {
                order: (...oArgs: unknown[]) => {
                  mockSupabaseChain.order(...oArgs);
                  return mockSupabaseChain.order.mock.results[
                    mockSupabaseChain.order.mock.results.length - 1
                  ]?.value;
                },
              };
            },
            order: (...oArgs: unknown[]) => {
              mockSupabaseChain.order(...oArgs);
              return mockSupabaseChain.order.mock.results[
                mockSupabaseChain.order.mock.results.length - 1
              ]?.value;
            },
          };
        },
        insert: (...iArgs: unknown[]) => {
          mockSupabaseChain.insert(...iArgs);
          return {
            select: () => ({
              single: () => mockSupabaseChain.single(),
            }),
          };
        },
        update: (...uArgs: unknown[]) => {
          mockSupabaseChain.update(...uArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockSupabaseChain.eq(...eArgs);
              return {
                eq: (...e2Args: unknown[]) => {
                  mockSupabaseChain.eq(...e2Args);
                  return {
                    select: () => ({
                      single: () => mockSupabaseChain.single(),
                    }),
                  };
                },
              };
            },
          };
        },
        delete: () => ({
          eq: (...eArgs: unknown[]) => {
            mockSupabaseChain.eq(...eArgs);
            return {
              eq: () => mockSupabaseChain.delete(),
            };
          },
        }),
      };
    },
  })),
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

import { GET, POST, PUT, DELETE } from "./route";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { ForbiddenError, ServiceUnavailableError, UnauthorizedError } from "@/lib/utils/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAdmin() {
  vi.mocked(requireAdminUser).mockResolvedValue({
    userId: "admin@test.com",
    rank: "admin",
  });
}

function mockNonAdmin() {
  vi.mocked(requireAdminUser).mockRejectedValue(new ForbiddenError("Admin access required"));
}

function mockUnauthenticated() {
  vi.mocked(requireAdminUser).mockRejectedValue(new UnauthorizedError());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/admin/gems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  // ======================== GET ========================
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();
      const res = await GET();
      expect(res.status).toBe(401);
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

    it("should return 503 if DB verification fails", async () => {
      vi.mocked(requireAdminUser).mockRejectedValueOnce(new ServiceUnavailableError());
      const res = await GET();
      expect(res.status).toBe(503);
    });

    it("should return gems list on success", async () => {
      mockAdmin();
      const mockGems = [
        { id: "gem-1", name: "Helper", is_premade: true, instructions: "Be helpful" },
      ];
      // First call: gems.select().eq().order() → gems data
      mockSupabaseChain.order.mockReturnValueOnce({ data: mockGems, error: null });
      // Second call: gem_versions.select().in().order() → versions
      mockSupabaseChain.order.mockReturnValueOnce({
        data: [{ gem_id: "gem-1", version: 1, instructions: "Latest instructions" }],
        error: null,
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.gems).toBeDefined();
      expect(Array.isArray(json.data.gems)).toBe(true);
    });

    it("should return 500 on database error", async () => {
      mockAdmin();
      mockSupabaseChain.order.mockReturnValueOnce({
        data: null,
        error: { message: "DB connection failed" },
      });

      const res = await GET();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== POST ========================
  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();
      const req = createRequest("POST", "/api/admin/gems", {
        name: "Test",
        instructions: "Do things",
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not admin", async () => {
      mockNonAdmin();
      const req = createRequest("POST", "/api/admin/gems", {
        name: "Test",
        instructions: "Do things",
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("should return 400 when name or instructions missing", async () => {
      mockAdmin();
      const req = createRequest("POST", "/api/admin/gems", { name: "" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should create a gem successfully", async () => {
      mockAdmin();
      const gemData = { id: "gem-new", name: "Test Gem", is_premade: true };

      // insert().select().single() for gems table
      mockSupabaseChain.single
        .mockResolvedValueOnce({ data: gemData, error: null })
        // insert().select().single() for gem_versions table
        .mockResolvedValueOnce({
          data: { gem_id: "gem-new", version: 1, instructions: "Do things" },
          error: null,
        });

      const req = createRequest("POST", "/api/admin/gems", {
        name: "Test Gem",
        instructions: "Do things",
        description: "A test gem",
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.gem).toBeDefined();
      expect(mockInvalidateAllGemsCache).toHaveBeenCalledTimes(1);
    });

    it("should return 400 on malformed JSON and rollback parent gem when initial gem_versions insert fails (TC-W2A-03)", async () => {
      mockAdmin();
      const badReq = new NextRequest(new URL("/api/admin/gems", "http://localhost:3000"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      });
      const badRes = await POST(badReq);
      expect(badRes.status).toBe(400);

      mockSupabaseChain.single
        .mockResolvedValueOnce({
          data: { id: "gem-orphan", name: "Orphan", is_premade: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "gem_versions insert failed" },
        });
      mockSupabaseChain.delete.mockResolvedValueOnce({ error: null });

      const req = createRequest("POST", "/api/admin/gems", {
        name: "Orphan",
        instructions: "Instructions",
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      expect(mockSupabaseChain.delete).toHaveBeenCalledTimes(1);
      expect(mockInvalidateAllGemsCache).not.toHaveBeenCalled();
    });

    it("should return 500 on database error", async () => {
      mockAdmin();
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      const req = createRequest("POST", "/api/admin/gems", {
        name: "Test",
        instructions: "Do things",
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });

  // ======================== PUT ========================
  describe("PUT", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();
      const req = createRequest("PUT", "/api/admin/gems", {
        id: "gem-1",
        name: "Updated",
        instructions: "New instructions",
      });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });

    it("should return 400 when required fields are missing", async () => {
      mockAdmin();
      const req = createRequest("PUT", "/api/admin/gems", { id: "gem-1" });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should update a gem successfully", async () => {
      mockAdmin();
      const updatedGem = { id: "gem-1", name: "Updated Gem", is_premade: true };

      // update().eq().eq().select().single()
      mockSupabaseChain.single.mockResolvedValueOnce({ data: updatedGem, error: null });
      // select versions: .order().limit().maybeSingle()
      mockSupabaseChain.order.mockReturnValueOnce({
        limit: () => ({
          maybeSingle: () => Promise.resolve({ data: { version: 2 }, error: null }),
        }),
      });
      // insert version: .insert().select().single()
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: { instructions: "New instructions", version: 3 },
        error: null,
      });

      const req = createRequest("PUT", "/api/admin/gems", {
        id: "gem-1",
        name: "Updated Gem",
        instructions: "New instructions",
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.gem).toBeDefined();
      expect(mockInvalidateAllGemsCache).toHaveBeenCalledTimes(1);
    });

    it("should return 400 on malformed JSON and invalidate cache in finally even if gem_versions fails after gems.update (TC-W2A-03)", async () => {
      mockAdmin();
      const badReq = new NextRequest(new URL("/api/admin/gems", "http://localhost:3000"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      });
      expect((await PUT(badReq)).status).toBe(400);

      mockSupabaseChain.single.mockResolvedValueOnce({
        data: { id: "gem-1", name: "Updated", is_premade: true },
        error: null,
      });
      mockSupabaseChain.order.mockReturnValueOnce({
        limit: () => ({
          maybeSingle: () => Promise.resolve({ data: { version: 2 }, error: null }),
        }),
      });
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "version insert failed" },
      });

      const req = createRequest("PUT", "/api/admin/gems", {
        id: "gem-1",
        name: "Updated",
        instructions: "New instructions",
      });
      const res = await PUT(req);
      expect(res.status).toBe(500);
      expect(mockInvalidateAllGemsCache).toHaveBeenCalledTimes(1);
    });
  });

  // ======================== DELETE ========================
  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();
      const req = createRequest("DELETE", "/api/admin/gems?id=gem-1");
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it("should return 400 when gem ID is missing", async () => {
      mockAdmin();
      const req = createRequest("DELETE", "/api/admin/gems");
      const res = await DELETE(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should delete a gem successfully", async () => {
      mockAdmin();
      mockSupabaseChain.delete.mockResolvedValueOnce({ error: null });

      const req = createRequest("DELETE", "/api/admin/gems?id=gem-1");
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockInvalidateAllGemsCache).toHaveBeenCalledTimes(1);
    });

    it("should return 500 on database error", async () => {
      mockAdmin();
      mockSupabaseChain.delete.mockResolvedValueOnce({
        error: { message: "Delete failed" },
      });

      const req = createRequest("DELETE", "/api/admin/gems?id=gem-1");
      const res = await DELETE(req);
      expect(res.status).toBe(500);
    });
  });
});
