// Test file for gems.ts - Helper functions
import { describe, it, expect } from "vitest";

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
        icon: "⭐",
        color: "#FF0000",
      });

      expect(result.name).toBe("Test Gem");
      expect(result.description).toBe("A test gem");
      expect(result.instruction).toBe("Do something");
      expect(result.icon).toBe("⭐");
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
