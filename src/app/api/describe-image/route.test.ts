// Tests for /api/describe-image route
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies BEFORE importing the route ──────────────────────
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: vi.fn(),
}));

const mockGenerateContent = vi.fn();

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => ({
    models: {
      generateContent: mockGenerateContent,
    },
  }),
}));

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
import { POST } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";

// ── Helpers ───────────────────────────────────────────────────────────
const TEST_EMAIL = "test@example.com";
const TEST_USER_ID = "user-123";

function createRequest(body?: unknown): NextRequest {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL("/api/describe-image", "http://localhost:3000"), init);
}

function mockAuthenticated() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: TEST_EMAIL, id: TEST_USER_ID },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockRateLimitAllowed() {
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    limit: 20,
    remaining: 19,
    resetInMs: 60000,
    retryAfterSeconds: 60,
    backend: "memory",
  });
}

function mockRateLimitExceeded() {
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: false,
    limit: 20,
    remaining: 0,
    resetInMs: 30000,
    retryAfterSeconds: 30,
    backend: "memory",
  });
}

// ── Tests ─────────────────────────────────────────────────────────────
describe("/api/describe-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ─────────────────────────────────────────────────────────────
  describe("POST - Auth", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest({ imageUrl: "data:image/png;base64,abc" });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });
  });

  // ── Rate Limiting ───────────────────────────────────────────────────
  describe("POST - Rate Limiting", () => {
    it("should return 429 when rate limited", async () => {
      mockAuthenticated();
      mockRateLimitExceeded();

      const req = createRequest({ imageUrl: "data:image/png;base64,abc" });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.success).toBe(false);
    });
  });

  // ── Validation ──────────────────────────────────────────────────────
  describe("POST - Validation", () => {
    it("should return 400 if imageUrl is missing", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest({});
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 if imageUrl is empty string", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest({ imageUrl: "" });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  // ── Happy Path ──────────────────────────────────────────────────────
  describe("POST - Success", () => {
    it("should return description for data URL image", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();
      mockGenerateContent.mockResolvedValue({
        text: "A stunning sunset over the ocean with warm golden light",
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "A stunning sunset over the ocean with warm golden light",
                },
              ],
            },
          },
        ],
      });

      const req = createRequest({
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.description).toBe("A stunning sunset over the ocean with warm golden light");

      // Verify Gemini was called with correct params
      expect(mockGenerateContent).toHaveBeenCalledOnce();
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.model).toBe("gemini-2.5-flash");
      expect(callArgs.contents[0].parts[0].inlineData.mimeType).toBe("image/png");
    });

    it("should handle function-type text response", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();
      mockGenerateContent.mockResolvedValue({
        text: () => "Description from function",
        candidates: [],
      });

      const req = createRequest({
        imageUrl: "data:image/jpeg;base64,/9j/4AAQ",
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.description).toBe("Description from function");
    });
  });

  // ── Error Handling ──────────────────────────────────────────────────
  describe("POST - Error handling", () => {
    it("should return 500 when Gemini call fails", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();
      mockGenerateContent.mockRejectedValue(new Error("Gemini API error"));

      const req = createRequest({
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
