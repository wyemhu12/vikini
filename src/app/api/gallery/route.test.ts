import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mocks — declared BEFORE importing the route
// ============================================================================

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

// Chainable Supabase query builder mock
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
};

const mockFrom = vi.fn(() => mockSupabaseQuery);

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: mockFrom })),
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

import { GET } from "./route";
import { auth } from "@/lib/features/auth/auth";

// ============================================================================
// Helpers
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

/** Reset the chainable mock so each call to `from()` starts fresh. */
function resetSupabaseMock() {
  mockFrom.mockClear();
  for (const method of Object.values(mockSupabaseQuery)) {
    (method as ReturnType<typeof vi.fn>).mockClear().mockReturnThis();
  }
}

// Convenience: simulate a Supabase response at the end of the chain
type SupabaseResult<T> = { data: T | null; error: unknown };

/**
 * Configure the Supabase chain to resolve with the given result.
 * The result is returned by the **last** chained method (order / eq / etc.).
 * We use `order` for the messages query and `eq` for the conversations query.
 */
function _mockSupabaseChainResult(result: SupabaseResult<unknown>) {
  // Because the route does two separate `from()` calls the mock needs to
  // return different results for each call.  We track this via `mockFrom`.
  // Default: the terminal method (order / eq) resolves with the result.
  mockSupabaseQuery.eq.mockReturnValue(result);
  mockSupabaseQuery.order.mockReturnValue(result);
}

/**
 * Helper to configure **both** Supabase queries the route performs:
 *   1. conversations query  (from → select → eq)
 *   2. messages query        (from → select → in → not → order)
 */
function mockBothQueries(convResult: SupabaseResult<unknown>, msgResult: SupabaseResult<unknown>) {
  // First call to from() → conversations, second → messages
  let callCount = 0;
  mockFrom.mockImplementation((() => {
    callCount++;
    if (callCount === 1) {
      // Conversations chain – terminal method is `eq`
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(convResult),
        }),
      };
    }
    // Messages chain – terminal method is `order`
    return {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(msgResult),
          }),
        }),
      }),
    };
  }) as typeof mockFrom);
}

// ============================================================================
// Fixtures
// ============================================================================

const AUTHENTICATED_SESSION = {
  user: { email: "Test@Example.com", id: "user-1" },
};

const SAMPLE_CONVERSATIONS = [
  { id: "conv-1", model: "gemini-2.5-flash" },
  { id: "conv-2", model: "vikini-image-studio" }, // should be filtered out
  { id: "conv-3", model: null },
];

const SAMPLE_MESSAGES = [
  {
    id: "msg-1",
    content: "A sunset over mountains",
    role: "assistant",
    created_at: "2026-06-01T00:00:00Z",
    meta: {
      type: "image_gen",
      imageUrl: "https://cdn.example.com/img1.png",
      prompt: "sunset mountains",
      originalOptions: { aspectRatio: "16:9", style: "vivid", model: "imagen-4" },
    },
  },
  {
    id: "msg-2",
    content: "Photo of a cat",
    role: "assistant",
    created_at: "2026-06-02T00:00:00Z",
    meta: {
      imageUrl: "https://cdn.example.com/img2.png",
      prompt: "cute cat",
    },
  },
  {
    id: "msg-3",
    content: "Attachment image",
    role: "user",
    created_at: "2026-06-03T00:00:00Z",
    meta: {
      attachment: { url: "https://cdn.example.com/img3.png" },
    },
  },
  {
    id: "msg-no-url",
    content: "No image here",
    role: "assistant",
    created_at: "2026-06-04T00:00:00Z",
    meta: { type: "text" },
  },
];

// ============================================================================
// Tests
// ============================================================================

describe("/api/gallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseMock();
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe("GET — Auth", () => {
    it("should return 401 when session is null", async () => {
      vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("should return 401 when session has no user", async () => {
      vi.mocked(auth).mockResolvedValue({ user: undefined } as unknown as ReturnType<
        typeof auth
      > extends Promise<infer T>
        ? T
        : never);

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));

      expect(res.status).toBe(401);
    });

    it("should return 401 when user has no email", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as unknown as ReturnType<
        typeof auth
      > extends Promise<infer T>
        ? T
        : never);

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));

      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("GET — Validation", () => {
    it("should return 400 for invalid limit (negative)", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );

      const res = await GET(createRequest("/api/gallery?limit=-1&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 for limit exceeding max (101)", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );

      const res = await GET(createRequest("/api/gallery?limit=101&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 for negative offset", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=-5"));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should use default limit=20 and offset=0 when no query params provided", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries({ data: [], error: null }, { data: [], error: null });

      const res = await GET(createRequest("/api/gallery"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("should accept valid limit and offset without error", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: [{ id: "c1", model: "gemini" }], error: null },
        { data: [], error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=50&offset=10"));

      expect(res.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // Empty states
  // --------------------------------------------------------------------------
  describe("GET — Empty states", () => {
    it("should return empty images when user has no conversations", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries({ data: [], error: null }, { data: [], error: null });

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.images).toEqual([]);
      expect(json.data.hasMore).toBe(false);
    });

    it("should return empty images when all conversations are Image Studio", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: [{ id: "c1", model: "vikini-image-studio" }], error: null },
        { data: [], error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.images).toEqual([]);
      expect(json.data.hasMore).toBe(false);
    });

    it("should return empty images when conversations data is null", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries({ data: null, error: null }, { data: [], error: null });

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.images).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------
  describe("GET — Happy path", () => {
    it("should return gallery images with correct shape", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: SAMPLE_CONVERSATIONS, error: null },
        { data: SAMPLE_MESSAGES, error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // 3 messages have valid URLs (msg-1, msg-2, msg-3). msg-no-url is filtered out.
      expect(json.data.images).toHaveLength(3);
    });

    it("should map image fields correctly from meta", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: [{ id: "c1", model: "gemini" }], error: null },
        { data: [SAMPLE_MESSAGES[0]], error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();
      const img = json.data.images[0];

      expect(img.id).toBe("msg-1");
      expect(img.url).toBe("https://cdn.example.com/img1.png");
      expect(img.prompt).toBe("sunset mountains");
      expect(img.createdAt).toBe("2026-06-01T00:00:00Z");
      expect(img.aspectRatio).toBe("16:9");
      expect(img.style).toBe("vivid");
      expect(img.model).toBe("imagen-4");
    });

    it("should use attachment URL when imageUrl is absent", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: [{ id: "c1", model: "gemini" }], error: null },
        { data: [SAMPLE_MESSAGES[2]], error: null } // attachment-only message
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(json.data.images[0].url).toBe("https://cdn.example.com/img3.png");
    });

    it("should lowercase user email for querying", async () => {
      // Session has mixed-case email "Test@Example.com"
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );

      // Capture the eq() call to verify the lowercased user_id
      const eqSpy = vi.fn().mockReturnValue({ data: [], error: null });
      mockFrom.mockImplementation((() => ({
        select: vi.fn().mockReturnValue({
          eq: eqSpy,
        }),
      })) as typeof mockFrom);

      await GET(createRequest("/api/gallery?limit=20&offset=0"));

      // Verify conversations query used lowercased email
      expect(eqSpy).toHaveBeenCalledWith("user_id", "test@example.com");
    });

    it("should paginate a large set correctly with explicit limit", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );

      // Create 25 image messages to test pagination
      const manyMessages = Array.from({ length: 25 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Image ${i}`,
        role: "assistant",
        created_at: `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        meta: {
          type: "image_gen",
          imageUrl: `https://cdn.example.com/img${i}.png`,
          prompt: `prompt ${i}`,
        },
      }));

      mockBothQueries(
        { data: [{ id: "c1", model: "gemini" }], error: null },
        { data: manyMessages, error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(json.data.images).toHaveLength(20);
      expect(json.data.hasMore).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Pagination
  // --------------------------------------------------------------------------
  describe("GET — Pagination", () => {
    it("should respect limit parameter", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: SAMPLE_CONVERSATIONS, error: null },
        { data: SAMPLE_MESSAGES, error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=2"));
      const json = await res.json();

      expect(json.data.images).toHaveLength(2);
      expect(json.data.hasMore).toBe(true);
    });

    it("should respect offset parameter", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: SAMPLE_CONVERSATIONS, error: null },
        { data: SAMPLE_MESSAGES, error: null }
      );

      // 3 valid images total, offset=2 → 1 remaining
      const res = await GET(createRequest("/api/gallery?offset=2&limit=20"));
      const json = await res.json();

      expect(json.data.images).toHaveLength(1);
      expect(json.data.hasMore).toBe(false);
    });

    it("should return hasMore=false when all images fit within limit", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: SAMPLE_CONVERSATIONS, error: null },
        { data: SAMPLE_MESSAGES, error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=100"));
      const json = await res.json();

      expect(json.data.hasMore).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe("GET — Error handling", () => {
    it("should return 500 when conversations query fails", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: null, error: { message: "DB connection failed" } },
        { data: [], error: null }
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should return 500 when messages query fails", async () => {
      vi.mocked(auth).mockResolvedValue(
        AUTHENTICATED_SESSION as unknown as ReturnType<typeof auth> extends Promise<infer T>
          ? T
          : never
      );
      mockBothQueries(
        { data: SAMPLE_CONVERSATIONS, error: null },
        { data: null, error: { message: "Messages table unavailable" } }
      );

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should return 500 when auth throws an unexpected error", async () => {
      vi.mocked(auth).mockRejectedValue(new Error("Auth service down"));

      const res = await GET(createRequest("/api/gallery?limit=20&offset=0"));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
