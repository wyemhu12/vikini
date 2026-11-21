import { describe, it, expect, vi, beforeEach } from "vitest";

interface CapturedNextAuthConfig {
  callbacks: {
    signIn: (args: { user?: { email?: string | null }; account?: unknown }) => Promise<boolean>;
    jwt: (args: {
      token: Record<string, unknown>;
      user?: { email?: string | null; name?: string | null; image?: string | null };
      account?: { providerAccountId?: string };
    }) => Promise<Record<string, unknown>>;
    session: (args: {
      session: { user: Record<string, unknown>; expires: string };
      token: Record<string, unknown>;
    }) => Promise<{ user: Record<string, unknown>; expires: string }>;
  };
}

const { mockSupabaseFrom, mockGetAuthVersion, mockRefreshTokenFromDBDetailed, state } = vi.hoisted(
  () => ({
    mockSupabaseFrom: vi.fn(),
    mockGetAuthVersion: vi.fn(),
    mockRefreshTokenFromDBDetailed: vi.fn(),
    state: { capturedConfig: null as CapturedNextAuthConfig | null },
  })
);

vi.mock("@/lib/env", () => ({}));
vi.mock("next-auth", () => ({
  default: (config: CapturedNextAuthConfig) => {
    state.capturedConfig = config;
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  },
}));
vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({ id: "google" })),
}));
vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({ from: mockSupabaseFrom }),
}));
vi.mock("@/lib/features/auth/authRevocation", () => ({
  getAuthVersion: (...args: unknown[]) => mockGetAuthVersion(...args),
  refreshTokenFromDBDetailed: (...args: unknown[]) => mockRefreshTokenFromDBDetailed(...args),
}));
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Import triggers NextAuth(config) and populates state.capturedConfig
import "./auth";

describe("auth.ts NextAuth callbacks (TC-W1-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getCallbacks() {
    if (!state.capturedConfig) {
      throw new Error("NextAuth config was not captured");
    }
    return state.capturedConfig.callbacks;
  }

  describe("signIn callback", () => {
    it("recovers from 23505 concurrent first-sign-in duplicate insert race when profile is not blocked", async () => {
      const maybeSingle = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { is_blocked: false }, error: null });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
        insert: vi.fn().mockResolvedValue({
          error: { code: "23505", message: "duplicate key value" },
        }),
      });

      const allowed = await getCallbacks().signIn({ user: { email: "RaceUser@Example.com" } });
      expect(allowed).toBe(true);
    });

    it("denies sign-in after 23505 race if existing profile is blocked", async () => {
      const maybeSingle = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { is_blocked: true }, error: null });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
        insert: vi.fn().mockResolvedValue({
          error: { code: "23505", message: "duplicate key value" },
        }),
      });

      const allowed = await getCallbacks().signIn({ user: { email: "blocked@example.com" } });
      expect(allowed).toBe(false);
    });
  });

  describe("jwt callback", () => {
    it("fails closed to { blocked: true } when refreshTokenFromDBDetailed returns not_found", async () => {
      mockGetAuthVersion.mockResolvedValue(Date.now() + 10_000);
      mockRefreshTokenFromDBDetailed.mockResolvedValue({ status: "not_found" });

      const result = await getCallbacks().jwt({
        token: {
          userId: "deleted@example.com",
          email: "deleted@example.com",
          rank: "pro",
          rankVersion: 1,
          rankRefreshedAt: Date.now(),
        },
      });

      expect(result).toEqual({ blocked: true });
    });

    it("downgrades admin rank on transient DB error and does not bump rankRefreshedAt", async () => {
      const oldRefresh = Date.now() - 10_000;
      mockGetAuthVersion.mockResolvedValue(Date.now() + 10_000);
      mockRefreshTokenFromDBDetailed.mockResolvedValue({ status: "error" });

      const result = await getCallbacks().jwt({
        token: {
          userId: "admin@example.com",
          email: "admin@example.com",
          rank: "admin",
          rankVersion: 1,
          rankRefreshedAt: oldRefresh,
        },
      });

      expect(result.rank).toBe("not_whitelisted");
      expect(result.rankRefreshedAt).toBe(oldRefresh);
    });

    it("fails closed for non-admin token when DB error occurs past 5-minute stale threshold", async () => {
      const staleRefresh = Date.now() - 6 * 60 * 1000;
      mockGetAuthVersion.mockResolvedValue(null);
      mockRefreshTokenFromDBDetailed.mockResolvedValue({ status: "error" });

      const result = await getCallbacks().jwt({
        token: {
          userId: "user@example.com",
          email: "user@example.com",
          rank: "pro",
          rankVersion: 1,
          rankRefreshedAt: staleRefresh,
        },
      });

      expect(result.rank).toBe("not_whitelisted");
      expect(result.rankRefreshedAt).toBe(staleRefresh);
    });
  });

  describe("session callback", () => {
    it("strips id/email/name/image and sets rank=__blocked__ when token.blocked is true", async () => {
      const session = await getCallbacks().session({
        session: {
          expires: "2030-01-01T00:00:00.000Z",
          user: {
            id: "victim@example.com",
            email: "victim@example.com",
            name: "Blocked User",
            image: "https://example.com/a.png",
            rank: "admin",
          },
        },
        token: { blocked: true },
      });

      expect(session.user).toEqual({
        id: "",
        rank: "__blocked__",
        email: undefined,
        name: undefined,
        image: undefined,
      });
    });
  });
});
