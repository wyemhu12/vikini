// /app/api/chat-stream/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handler
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/core/limits", () => ({
  checkDailyMessageLimit: vi.fn(),
  incrementDailyMessageCount: vi.fn(),
}));

vi.mock("@/app/api/chat-stream/chatStreamCore", () => ({
  handleChatStreamCore: vi.fn(),
}));

vi.mock("@/lib/utils/performance", () => ({
  createPerformanceMonitor: vi.fn(() => ({ end: vi.fn(), userId: "" })),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
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

import { POST } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { checkDailyMessageLimit, incrementDailyMessageCount } from "@/lib/core/limits";
import { handleChatStreamCore } from "@/app/api/chat-stream/chatStreamCore";
import { AppError } from "@/lib/utils/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = "test@example.com";

function createRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAuthenticated() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: TEST_USER_EMAIL },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

/** Set up all mocks for a successful (happy-path) request */
function mockAllPassing() {
  mockAuthenticated();
  vi.mocked(checkDailyMessageLimit).mockResolvedValue({
    canSend: true,
    count: 5,
    limit: 100,
    remaining: 95,
    rank: "free",
  });
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    retryAfterSeconds: 0,
    limit: 10,
    remaining: 9,
    resetInMs: 60000,
    backend: "upstash",
  });
  vi.mocked(handleChatStreamCore).mockResolvedValue(new Response("ok", { status: 200 }));
  vi.mocked(incrementDailyMessageCount).mockResolvedValue(undefined as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/chat-stream", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ======================== POST ========================
  describe("POST", () => {
    // ------ 1. Payload too large ------
    it("should return 400 PAYLOAD_TOO_LARGE when content-length exceeds limit", async () => {
      const twoMB = String(2 * 1024 * 1024); // 2 MB, exceeds default 1 MB
      // happy-dom's Request strips/recalculates content-length from the body.
      // Use headers.set() after construction to force the spoofed value.
      const req = new NextRequest(new URL("/api/chat-stream", "http://localhost:3000"), {
        method: "POST",
      });
      req.headers.set("content-length", twoMB);
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    });

    // ------ 2. Unauthorized - no session ------
    it("should return 401 if not authenticated (no session)", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", "/api/chat-stream", {
        content: "hi",
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    // ------ 3. Unauthorized - no email ------
    it("should return 401 if session has no email", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: null },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const req = createRequest("POST", "/api/chat-stream", {
        content: "hi",
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    // ------ 4. Access pending (not_whitelisted) ------
    it("should return 403 ACCESS_PENDING when user is not whitelisted", async () => {
      mockAuthenticated();
      vi.mocked(checkDailyMessageLimit).mockResolvedValue({
        canSend: false,
        count: 0,
        limit: 0,
        remaining: 0,
        rank: "not_whitelisted",
      });

      const req = createRequest("POST", "/api/chat-stream", {
        content: "hi",
      });
      const res = await POST(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ACCESS_PENDING");
      expect(json.error.rank).toBe("not_whitelisted");
    });

    // ------ 5. Daily limit exceeded ------
    it("should return 429 DAILY_LIMIT_EXCEEDED when canSend is false", async () => {
      mockAuthenticated();
      vi.mocked(checkDailyMessageLimit).mockResolvedValue({
        canSend: false,
        count: 100,
        limit: 100,
        remaining: 0,
        rank: "free",
      });

      const req = createRequest("POST", "/api/chat-stream", {
        content: "hi",
      });
      const res = await POST(req);

      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("DAILY_LIMIT_EXCEEDED");
      expect(json.error.count).toBe(100);
      expect(json.error.limit).toBe(100);
    });

    // ------ 6. Rate limit exceeded ------
    it("should return 429 when rate limit is exceeded", async () => {
      mockAuthenticated();
      vi.mocked(checkDailyMessageLimit).mockResolvedValue({
        canSend: true,
        count: 5,
        limit: 100,
        remaining: 95,
        rank: "free",
      });
      vi.mocked(consumeRateLimit).mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 30,
        limit: 10,
        remaining: 0,
        resetInMs: 30000,
        backend: "upstash",
      });

      const req = createRequest("POST", "/api/chat-stream", {
        content: "hi",
      });
      const res = await POST(req);

      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(json.error.retryAfterSeconds).toBe(30);
    });

    // ------ 7. Happy path ------
    it("should return 200 streaming response when all checks pass", async () => {
      mockAllPassing();

      const req = createRequest("POST", "/api/chat-stream", {
        content: "Hello!",
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("ok");
      expect(handleChatStreamCore).toHaveBeenCalledWith({
        req,
        userId: TEST_USER_EMAIL,
      });
      expect(incrementDailyMessageCount).toHaveBeenCalledWith(TEST_USER_EMAIL);
    });

    // ------ 8. Increment failure is silent ------
    it("should still return 200 even if incrementDailyMessageCount throws", async () => {
      mockAllPassing();
      vi.mocked(incrementDailyMessageCount).mockRejectedValue(new Error("Redis down"));

      const req = createRequest("POST", "/api/chat-stream", {
        content: "Hello!",
      });
      const res = await POST(req);

      // Response should still succeed despite increment failure
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("ok");
    });

    // ------ 9. AppError propagation ------
    it("should return the AppError status when handleChatStreamCore throws AppError", async () => {
      mockAuthenticated();
      vi.mocked(checkDailyMessageLimit).mockResolvedValue({
        canSend: true,
        count: 5,
        limit: 100,
        remaining: 95,
        rank: "free",
      });
      vi.mocked(consumeRateLimit).mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
        limit: 10,
        remaining: 9,
        resetInMs: 60000,
        backend: "upstash",
      });
      vi.mocked(handleChatStreamCore).mockRejectedValue(
        new AppError("Gem not found", 404, "NOT_FOUND")
      );

      const req = createRequest("POST", "/api/chat-stream", {
        content: "Hello!",
      });
      const res = await POST(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    // ------ 10. Internal error (generic) ------
    it("should return 500 when handleChatStreamCore throws a generic Error", async () => {
      mockAuthenticated();
      vi.mocked(checkDailyMessageLimit).mockResolvedValue({
        canSend: true,
        count: 5,
        limit: 100,
        remaining: 95,
        rank: "free",
      });
      vi.mocked(consumeRateLimit).mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
        limit: 10,
        remaining: 9,
        resetInMs: 60000,
        backend: "upstash",
      });
      vi.mocked(handleChatStreamCore).mockRejectedValue(new Error("Something broke"));

      const req = createRequest("POST", "/api/chat-stream", {
        content: "Hello!",
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    // ------ 11. Custom MAX_PAYLOAD_SIZE_MB env var ------
    it("should respect MAX_PAYLOAD_SIZE_MB env var for payload limit", async () => {
      // Set custom limit to 2 MB
      process.env.MAX_PAYLOAD_SIZE_MB = "2";

      // 1.5 MB should now be allowed (below 2 MB limit)
      const onePointFiveMB = String(Math.floor(1.5 * 1024 * 1024));
      mockAllPassing();

      const req = new NextRequest(new URL("/api/chat-stream", "http://localhost:3000"), {
        method: "POST",
      });
      req.headers.set("content-length", onePointFiveMB);
      const res = await POST(req);

      // Should NOT be rejected as too large
      expect(res.status).toBe(200);
    });

    it("should reject payload exceeding custom MAX_PAYLOAD_SIZE_MB", async () => {
      // Set custom limit to 0.5 MB
      process.env.MAX_PAYLOAD_SIZE_MB = "0.5";

      const oneMB = String(1 * 1024 * 1024);
      const req = new NextRequest(new URL("/api/chat-stream", "http://localhost:3000"), {
        method: "POST",
      });
      req.headers.set("content-length", oneMB);
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    });
  });
});
