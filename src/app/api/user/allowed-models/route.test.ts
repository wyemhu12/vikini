// Tests for /api/user/allowed-models route
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the route
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/core/limits", () => ({
  getUserLimits: vi.fn(),
}));

// Import route handler AFTER mocks
import { GET } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { getUserLimits } from "@/lib/core/limits";

describe("/api/user/allowed-models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 if session has no user id", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { email: "a@b.com" } } as unknown as Awaited<
        ReturnType<typeof auth>
      >);

      const res = await GET();

      expect(res.status).toBe(401);
    });

    it("should return allowed models and rank on success", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@test.com" },
      } as unknown as Awaited<ReturnType<typeof auth>>);
      vi.mocked(getUserLimits).mockResolvedValue({
        userId: "user-123",
        email: "test@test.com",
        rank: "pro",
        daily_message_limit: 100,
        daily_research_limit: 5,
        max_file_size_mb: 50,
        features: { web_search: true, unlimited_gems: true, deep_research: true },
        allowed_models: ["gemini-2.5-pro", "claude-sonnet-4"],
      });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.allowed_models).toEqual(["gemini-2.5-pro", "claude-sonnet-4"]);
      expect(json.data.rank).toBe("pro");
      expect(getUserLimits).toHaveBeenCalledWith("user-123");
    });

    it("should return empty array when allowed_models is undefined", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@test.com" },
      } as unknown as Awaited<ReturnType<typeof auth>>);
      vi.mocked(getUserLimits).mockResolvedValue({
        userId: "user-123",
        email: "test@test.com",
        rank: "basic",
        daily_message_limit: 20,
        daily_research_limit: 0,
        max_file_size_mb: 5,
        features: { web_search: false, unlimited_gems: false, deep_research: false },
        // no allowed_models field
      });

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.allowed_models).toEqual([]);
      expect(json.data.rank).toBe("basic");
    });

    it("should return 500 when getUserLimits throws", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@test.com" },
      } as unknown as Awaited<ReturnType<typeof auth>>);
      vi.mocked(getUserLimits).mockRejectedValue(new Error("DB down"));

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
