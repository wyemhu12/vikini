// /lib/features/novelcrafter/modelGuards.server.test.ts
import { describe, expect, it } from "vitest";
import { MODEL_IDS } from "@/lib/utils/constants";
import { isValidGenerationModel } from "./modelGuards.server";

describe("isValidGenerationModel", () => {
  it("accepts valid selectable generation models and rejects pseudo-models or blank IDs (TC-09)", () => {
    expect(isValidGenerationModel("gemini-2.5-flash")).toBe(true);
    expect(isValidGenerationModel("claude-sonnet-4.5")).toBe(true);
    expect(isValidGenerationModel(MODEL_IDS.NOVELCRAFTER)).toBe(false);
    expect(isValidGenerationModel(MODEL_IDS.IMAGE_STUDIO)).toBe(false);
    expect(isValidGenerationModel("")).toBe(false);
    expect(isValidGenerationModel("   ")).toBe(false);
    expect(isValidGenerationModel("non-existent-model-id-xyz")).toBe(false);
  });
});
