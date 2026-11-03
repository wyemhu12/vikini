// /lib/features/novelcrafter/modelGuards.server.test.ts
import { describe, expect, it } from "vitest";
import { MODEL_IDS } from "@/lib/utils/constants";
import { isValidGenerationModel } from "./modelGuards.server";

describe("isValidGenerationModel", () => {
  it("accepts valid selectable generation models and rejects pseudo-models or blank IDs (TC-09)", () => {
    expect(isValidGenerationModel("gemini-3.5-flash-lite")).toBe(true);
    expect(isValidGenerationModel("claude-sonnet-4.5")).toBe(true);
    expect(isValidGenerationModel(MODEL_IDS.NOVELCRAFTER)).toBe(false);
    expect(isValidGenerationModel(MODEL_IDS.IMAGE_STUDIO)).toBe(false);
    expect(isValidGenerationModel("")).toBe(false);
    expect(isValidGenerationModel("   ")).toBe(false);
    expect(isValidGenerationModel("non-existent-model-id-xyz")).toBe(false);
  });

  it("TC-NCG-01: accepts registered legacy model aliases stored in older stories", () => {
    expect(isValidGenerationModel("gemini-2.5-flash")).toBe(true);
    expect(isValidGenerationModel("gemini-2.5-pro")).toBe(true);
    expect(isValidGenerationModel("gemini-1.5-pro")).toBe(true);
  });

  it("TC-NCG-02: rejects unknown IDs, prototype keys, and pseudo-models", () => {
    expect(isValidGenerationModel("non-existent-model-id-xyz")).toBe(false);
    expect(isValidGenerationModel("constructor")).toBe(false);
    expect(isValidGenerationModel("__proto__")).toBe(false);
    expect(isValidGenerationModel(MODEL_IDS.NOVELCRAFTER)).toBe(false);
  });
});
