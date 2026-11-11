// /lib/features/novelcrafter/aiInheritanceTable.test.ts
import { describe, expect, it } from "vitest";
import {
  estimatePromptTokens,
  formatApproxTokens,
  resolveEffectiveSlotModel,
  resolveFeatureInheritanceRows,
} from "./aiInheritanceTable";
import { sanitizeStoryState } from "./promptBuilder";
import { createDefaultStoryState, type NovelcrafterRoutingConfig } from "./types";

describe("aiInheritanceTable (Phase 5D TC-01 & TC-02)", () => {
  const baseRouting: NovelcrafterRoutingConfig = {
    masterGemId: "gem-1",
    masterPersonaId: "persona-1",
    featurePersonas: {
      bible: "inherit",
      write: "inherit",
      rewrite: "inherit",
      feedback: "persona-2",
      expand: "inherit",
      brainstorm: "none",
    },
    featureModels: {
      bible: "inherit",
      write: "inherit",
      rewrite: "inherit",
      feedback: "gemini-3.8-flash",
      expand: "inherit",
      brainstorm: "inherit",
    },
  };

  it("TC-01: resolves inherited model, valid overridden model, and falls back when override is internal/unknown/disallowed", () => {
    const allowed = new Set<string>(["gemini-3.5-flash-lite", "gemini-3.8-flash"]);

    const inherited = resolveEffectiveSlotModel(
      "write",
      "gemini-3.5-flash-lite",
      baseRouting,
      allowed
    );
    expect(inherited.modelId).toBe("gemini-3.5-flash-lite");
    expect(inherited.isOverridden).toBe(false);

    const overridden = resolveEffectiveSlotModel(
      "feedback",
      "gemini-3.5-flash-lite",
      baseRouting,
      allowed
    );
    expect(overridden.modelId).toBe("gemini-3.8-flash");
    expect(overridden.modelName).toBe("Gemini 3.8 Flash");
    expect(overridden.isOverridden).toBe(true);

    // Negative: disallowed model falls back to defaultModelId
    const disallowed = resolveEffectiveSlotModel(
      "feedback",
      "gemini-3.5-flash-lite",
      baseRouting,
      new Set<string>(["gemini-3.5-flash-lite"])
    );
    expect(disallowed.modelId).toBe("gemini-3.5-flash-lite");
    expect(disallowed.isOverridden).toBe(false);

    // Negative: internal studio marker or garbage model ID falls back to defaultModelId
    const internalStudio = resolveEffectiveSlotModel(
      "write",
      "gemini-3.5-flash-lite",
      {
        ...baseRouting,
        featureModels: {
          ...baseRouting.featureModels!,
          write: "novelcrafter-studio",
        },
      },
      allowed
    );
    expect(internalStudio.modelId).toBe("gemini-3.5-flash-lite");
    expect(internalStudio.isOverridden).toBe(false);
  });

  it("TC-02: computes all 6 inheritance rows accurately including deleted persona IDs and stateLimits normalization", () => {
    const rows = resolveFeatureInheritanceRows({
      routing: {
        ...baseRouting,
        featurePersonas: {
          ...baseRouting.featurePersonas,
          expand: "deleted-persona-id",
        },
      },
      defaultModelId: "gemini-3.5-flash-lite",
      gems: [{ id: "gem-1", name: "Văn xuôi trữ tình" }],
      personas: [
        { id: "persona-1", name: "Nhà văn miền Tây" },
        { id: "persona-2", name: "Biên tập viên khó tính" },
      ],
      allowedModelIds: new Set<string>(["gemini-3.5-flash-lite", "gemini-3.8-flash"]),
    });

    expect(rows).toHaveLength(6);

    const writeRow = rows.find((r) => r.slot === "write")!;
    expect(writeRow.personaSource).toBe("inherit");
    expect(writeRow.effectivePersonaName).toBe("Nhà văn miền Tây");
    expect(writeRow.isRowOverridden).toBe(false);
    expect(writeRow.masterGemName).toBe("Văn xuôi trữ tình");

    const feedbackRow = rows.find((r) => r.slot === "feedback")!;
    expect(feedbackRow.personaSource).toBe("override");
    expect(feedbackRow.effectivePersonaName).toBe("Biên tập viên khó tính");
    expect(feedbackRow.isPersonaOverridden).toBe(true);
    expect(feedbackRow.isModelOverridden).toBe(true);
    expect(feedbackRow.isRowOverridden).toBe(true);

    const brainstormRow = rows.find((r) => r.slot === "brainstorm")!;
    expect(brainstormRow.personaSource).toBe("disabled");
    expect(brainstormRow.effectivePersonaName).toBeNull();
    expect(brainstormRow.isRowOverridden).toBe(true);

    // Negative: deleted persona ID does not pretend Master Persona is active
    const expandRow = rows.find((r) => r.slot === "expand")!;
    expect(expandRow.personaSource).toBe("override");
    expect(expandRow.effectivePersonaName).toBeNull();
    expect(expandRow.isPersonaOverridden).toBe(true);

    // stateLimits preserves featureModels
    const state = createDefaultStoryState();
    const coerced = sanitizeStoryState({
      ...state,
      routing: baseRouting,
    });
    expect(coerced.routing.featureModels?.feedback).toBe("gemini-3.8-flash");
    expect(coerced.routing.featureModels?.write).toBe("inherit");
  });

  it("estimates and formats approximate token counts for XML previews", () => {
    expect(estimatePromptTokens("")).toBe(0);
    expect(estimatePromptTokens("abcd".repeat(600))).toBe(600);
    expect(formatApproxTokens(6800, "vi")).toBe("6,8k");
    expect(formatApproxTokens(6800, "en")).toBe("6.8k");
    expect(formatApproxTokens(320, "vi")).toBe("320");
  });
});
