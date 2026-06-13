// Tests for /api/batch-gen-quota route
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies BEFORE importing the route ──────────────────────
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/core/limits", () => ({
  getUserProfile: vi.fn(),
}));

const mockRedisGet = vi.fn();
vi.mock("@/lib/core/batchGenQuota", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/core/batchGenQuota")>();
  return {
    ...actual,
    getRedis: vi.fn(() => ({
      get: mockRedisGet,
    })),
  };
});

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

// ── Import route handlers AFTER mocks ─────────────────────────────────
import { GET } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { getUserProfile } from "@/lib/core/limits";
import { getRedis } from "@/lib/core/batchGenQuota";

// ── Helpers ───────────────────────────────────────────────────────────
const TEST_EMAIL = "test@example.com";
const TEST_USER_ID = "user-123";

function mockAuthenticated() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: TEST_EMAIL, id: TEST_USER_ID },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

// ── Tests ─────────────────────────────────────────────────────────────
describe("/api/batch-gen-quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────
  // GET
  // ────────────────────────────────────────────────────────────────────
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("should return 401 if session has no email", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: TEST_USER_ID },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const res = await GET();

      expect(res.status).toBe(401);
    });

    it("should return 401 if session has no id", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: TEST_EMAIL },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const res = await GET();

      expect(res.status).toBe(401);
    });

    it("should return quota data on success for basic rank", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockResolvedValue({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        rank: "basic",
        is_blocked: false,
      });
      mockRedisGet.mockResolvedValue(3);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.rank).toBe("basic");
      expect(json.data.maxBatchSize).toBe(2);
      expect(json.data.quotas).toBeDefined();
      // Basic has quota for batch size 2 with limit 10
      expect(json.data.quotas["2"].limit).toBe(10);
      expect(json.data.quotas["2"].used).toBe(3);
      expect(json.data.quotas["2"].remaining).toBe(7);
    });

    it("should return quota data for pro rank", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockResolvedValue({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        rank: "pro",
        is_blocked: false,
      });
      mockRedisGet.mockResolvedValue(0);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.rank).toBe("pro");
      expect(json.data.maxBatchSize).toBe(3);
      expect(json.data.quotas["2"]).toBeDefined();
      expect(json.data.quotas["3"]).toBeDefined();
    });

    it("should default to basic rank when profile has no rank", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockResolvedValue(null);
      mockRedisGet.mockResolvedValue(null);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.rank).toBe("basic");
    });

    it("should handle Redis returning null (no usage yet)", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockResolvedValue({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        rank: "basic",
        is_blocked: false,
      });
      mockRedisGet.mockResolvedValue(null);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.quotas["2"].used).toBe(0);
      expect(json.data.quotas["2"].remaining).toBe(10);
    });

    it("should handle Redis errors gracefully and return used=0", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockResolvedValue({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        rank: "basic",
        is_blocked: false,
      });
      mockRedisGet.mockRejectedValue(new Error("Redis down"));

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      // Should fallback to used=0 when Redis fails
      expect(json.data.quotas["2"].used).toBe(0);
    });

    it("should return remaining=0 when usage exceeds limit", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockResolvedValue({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        rank: "basic",
        is_blocked: false,
      });
      mockRedisGet.mockResolvedValue(15);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.quotas["2"].remaining).toBe(0);
      expect(json.data.quotas["2"].used).toBe(15);
    });

    it("should return 500 on unexpected error", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockRejectedValue(new Error("DB down"));

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should lowercase the email for Redis key", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: "TEST@EXAMPLE.COM", id: TEST_USER_ID },
      } as unknown as Awaited<ReturnType<typeof auth>>);
      vi.mocked(getUserProfile).mockResolvedValue({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        rank: "basic",
        is_blocked: false,
      });
      mockRedisGet.mockResolvedValue(0);

      const res = await GET();

      expect(res.status).toBe(200);
      // The Redis key should use the lowercased email
      expect(mockRedisGet).toHaveBeenCalledWith(expect.stringContaining("test@example.com"));
    });

    // This test overrides getRedis so it must run last to avoid affecting other tests
    it("should handle Redis being unavailable (getRedis returns null)", async () => {
      mockAuthenticated();
      vi.mocked(getUserProfile).mockResolvedValue({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        rank: "basic",
        is_blocked: false,
      });
      vi.mocked(getRedis).mockReturnValueOnce(null);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.quotas["2"].used).toBe(0);
      expect(json.data.quotas["2"].remaining).toBe(10);
    });
  });
});
