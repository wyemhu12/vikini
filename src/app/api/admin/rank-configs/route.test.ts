// /app/api/admin/rank-configs/route.test.ts
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
const mockFrom = vi.fn();

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
          };
        },
        update: (...uArgs: unknown[]) => {
          mockUpdate(...uArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return mockEq.mock.results[mockEq.mock.results.length - 1]?.value;
            },
          };
        },
      };
    },
  })),
}));

vi.mock("@/lib/core/limits", () => ({
  invalidateRankConfigsCache: vi.fn().mockResolvedValue(undefined),
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

describe("/api/admin/rank-configs", () => {
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

    it("should return rank configs on success", async () => {
      mockAdmin();
      const mockConfigs = [
        { rank: "basic", daily_message_limit: 50, max_file_size_mb: 10 },
        { rank: "pro", daily_message_limit: 200, max_file_size_mb: 50 },
      ];
      mockOrder.mockReturnValueOnce({ data: mockConfigs, error: null });

      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.configs).toEqual(mockConfigs);
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
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(403);
    });

    it("should return 403 if user is not admin", async () => {
      mockNonAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(403);
    });

    it("should return 400 when configs is not an array", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: "not-array",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 for invalid rank value", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "superadmin",
            daily_message_limit: 100,
            max_file_size_mb: 10,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 for negative daily_message_limit", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "basic",
            daily_message_limit: -1,
            max_file_size_mb: 10,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 for negative max_file_size_mb", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "basic",
            daily_message_limit: 100,
            max_file_size_mb: -5,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 for float/decimal daily_message_limit (e.g. 3.14)", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "basic",
            daily_message_limit: 3.14,
            max_file_size_mb: 10,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain(
        "daily_message_limit must be an integer between 0 and 2147483647"
      );
    });

    it("should return 400 for integer overflow exceeding 2147483647", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "basic",
            daily_message_limit: 2147483648,
            max_file_size_mb: 10,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain(
        "daily_message_limit must be an integer between 0 and 2147483647"
      );
    });

    it("should return 400 for string numeric values (prevent NaN)", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "basic",
            daily_message_limit: "100",
            max_file_size_mb: 10,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain(
        "daily_message_limit must be an integer between 0 and 2147483647"
      );
    });

    it("should return 400 for invalid daily_research_limit", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "basic",
            daily_message_limit: 100,
            max_file_size_mb: 10,
            daily_research_limit: -1,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain(
        "daily_research_limit must be an integer between 0 and 2147483647"
      );
    });

    it("should update configs successfully including daily_research_limit", async () => {
      mockAdmin();
      mockEq.mockResolvedValue({ error: null });

      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "basic",
            daily_message_limit: 100,
            max_file_size_mb: 20,
            daily_research_limit: 5,
            features: { imageGen: true },
            allowed_models: ["gemini-2.5-flash"],
          },
        ],
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updated).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          daily_research_limit: 5,
        })
      );
    });

    it("should return 500 on database error during update", async () => {
      mockAdmin();
      mockEq.mockResolvedValue({ error: { message: "Update failed" } });

      const req = createRequest("PATCH", "/api/admin/rank-configs", {
        configs: [
          {
            rank: "pro",
            daily_message_limit: 200,
            max_file_size_mb: 50,
          },
        ],
      });
      const res = await PATCH(req);
      expect(res.status).toBe(500);
    });
  });
});
