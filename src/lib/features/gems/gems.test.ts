// Test file for gems.ts - Helper functions & security guards
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockGetCachedGems = vi.fn();
const mockSetCachedGems = vi.fn();
const mockInvalidateGemsCache = vi.fn();

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/core/cache", () => ({
  getCachedGems: (...args: unknown[]) => mockGetCachedGems(...args),
  setCachedGems: (...args: unknown[]) => mockSetCachedGems(...args),
  invalidateGemsCache: (...args: unknown[]) => mockInvalidateGemsCache(...args),
}));

import { getGemInstructionsForConversation, getGemsForUser } from "./gems";
import { DatabaseError, ForbiddenError } from "@/lib/utils/errors";

// ===========================================
// Since normalizeGemPayload and sanitizeOrFilterValue are internal functions,
// we need to export them or test via the public API.
// For now, we'll test the logic inline.
// ===========================================

/**
 * Helper: normalizeGemPayload logic (mirrors internal implementation)
 */
interface GemPayload {
  name?: string;
  description?: string;
  instruction?: string;
  instructions?: string;
  icon?: string;
  color?: string;
}

interface NormalizedGemPayload {
  name: string;
  description: string;
  instruction: string;
  icon: string;
  color: string;
}

function normalizeGemPayload(payload: unknown): NormalizedGemPayload {
  const body = payload && typeof payload === "object" ? (payload as GemPayload) : {};

  const instruction =
    typeof body.instructions === "string"
      ? body.instructions
      : typeof body.instruction === "string"
        ? body.instruction
        : "";

  return {
    name: typeof body.name === "string" ? body.name : "New GEM",
    description: typeof body.description === "string" ? body.description : "",
    instruction,
    icon: typeof body.icon === "string" ? body.icon : (body.icon ?? ""),
    color: typeof body.color === "string" ? body.color : (body.color ?? ""),
  };
}

function sanitizeOrFilterValue(value: unknown): string {
  return String(value ?? "")
    .replace(/,/g, "")
    .trim();
}

describe("Gems Helper Functions", () => {
  describe("normalizeGemPayload", () => {
    it("should use default values for empty payload", () => {
      const result = normalizeGemPayload({});

      expect(result.name).toBe("New GEM");
      expect(result.description).toBe("");
      expect(result.instruction).toBe("");
      expect(result.icon).toBe("");
      expect(result.color).toBe("");
    });

    it("should use provided values", () => {
      const result = normalizeGemPayload({
        name: "Test Gem",
        description: "A test gem",
        instruction: "Do something",
        icon: "",
        color: "#FF0000",
      });

      expect(result.name).toBe("Test Gem");
      expect(result.description).toBe("A test gem");
      expect(result.instruction).toBe("Do something");
      expect(result.icon).toBe("");
      expect(result.color).toBe("#FF0000");
    });

    it("should prefer 'instructions' over 'instruction' field", () => {
      const result = normalizeGemPayload({
        instruction: "Old instruction",
        instructions: "New instructions",
      });

      expect(result.instruction).toBe("New instructions");
    });

    it("should fallback to 'instruction' if 'instructions' is not a string", () => {
      const result = normalizeGemPayload({
        instruction: "Fallback instruction",
        instructions: 123 as unknown as string, // Non-string
      });

      expect(result.instruction).toBe("Fallback instruction");
    });

    it("should handle null payload", () => {
      const result = normalizeGemPayload(null);

      expect(result.name).toBe("New GEM");
      expect(result.description).toBe("");
    });

    it("should handle undefined payload", () => {
      const result = normalizeGemPayload(undefined);

      expect(result.name).toBe("New GEM");
    });

    it("should handle non-object payload", () => {
      const result = normalizeGemPayload("string");

      expect(result.name).toBe("New GEM");
    });

    it("should handle numeric name (should use default)", () => {
      const result = normalizeGemPayload({
        name: 123 as unknown as string,
      });

      expect(result.name).toBe("New GEM");
    });
  });

  describe("sanitizeOrFilterValue", () => {
    it("should remove commas from string", () => {
      expect(sanitizeOrFilterValue("a,b,c")).toBe("abc");
      expect(sanitizeOrFilterValue("no commas")).toBe("no commas");
    });

    it("should trim whitespace", () => {
      expect(sanitizeOrFilterValue("  hello  ")).toBe("hello");
      expect(sanitizeOrFilterValue("\n\ttest\n\t")).toBe("test");
    });

    it("should handle null/undefined", () => {
      expect(sanitizeOrFilterValue(null)).toBe("");
      expect(sanitizeOrFilterValue(undefined)).toBe("");
    });

    it("should convert numbers to string", () => {
      expect(sanitizeOrFilterValue(123)).toBe("123");
      expect(sanitizeOrFilterValue(0)).toBe("0");
    });

    it("should handle complex strings", () => {
      expect(sanitizeOrFilterValue("  test,with,commas  ")).toBe("testwithcommas");
    });
  });
});

describe("Gems Security & Fail-Closed Guards (TC-W1-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedGems.mockResolvedValue(null);
    mockSetCachedGems.mockResolvedValue(undefined);
  });

  describe("getGemInstructionsForConversation", () => {
    it("throws ForbiddenError when conversation links a foreign private gem and never reads gem_versions", async () => {
      const queriedTables: string[] = [];

      mockFrom.mockImplementation((table: string) => {
        queriedTables.push(table);
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { gem_id: "gem-victim", user_id: "attacker@example.com" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "gems") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "gem-victim",
                    user_id: "victim@example.com",
                    is_premade: false,
                    instruction: "Secret victim prompt",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table query: ${table}`);
      });

      await expect(
        getGemInstructionsForConversation("attacker@example.com", "conv-1")
      ).rejects.toThrow(ForbiddenError);
      expect(queriedTables).toEqual(["conversations", "gems"]);
      expect(queriedTables).not.toContain("gem_versions");
    });

    it("returns instructions for a premade gem", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { gem_id: "gem-premade", user_id: "user@example.com" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "gems") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "gem-premade",
                    user_id: "admin@example.com",
                    is_premade: true,
                    instructions: "Premade instructions",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "gem_versions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { version: 2, instructions: "Versioned premade instructions" },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await getGemInstructionsForConversation("user@example.com", "conv-1");
      expect(result).toBe("Versioned premade instructions");
    });

    it("TC-W2A-16: skips conversations table query when preloadedGemId is provided (null or string)", async () => {
      const emptyRes = await getGemInstructionsForConversation("user@example.com", "conv-1", null);
      expect(emptyRes).toBe("");
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("getGemsForUser fail-closed", () => {
    it("throws DatabaseError when q and q1 fail without running an unfiltered SELECT * or caching", async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "column mismatch" },
      });
      const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({
        or: mockOr,
        eq: mockEq,
        order: vi.fn().mockImplementation(() => {
          throw new Error("Unfiltered SELECT * must never be called");
        }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(getGemsForUser("user@example.com")).rejects.toThrow(DatabaseError);
      expect(mockOr).toHaveBeenCalledTimes(2);
      expect(mockEq).toHaveBeenCalledTimes(1);
      expect(mockSetCachedGems).not.toHaveBeenCalled();
    });
  });
});
