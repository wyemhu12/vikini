// /lib/core/modelAccess.test.ts
import { describe, expect, it } from "vitest";
import { isModelAllowedById, reconcileAllowedStoryModel } from "./modelAccess";
import { DEFAULT_MODEL } from "./modelRegistry";
import { MODEL_IDS } from "../utils/constants";

describe("isModelAllowedById (TC-04)", () => {
  it("allows model with exact match in allowed list", () => {
    expect(isModelAllowedById(DEFAULT_MODEL, [DEFAULT_MODEL])).toBe(true);
    expect(isModelAllowedById(MODEL_IDS.GEMINI_4_NEON, [MODEL_IDS.GEMINI_4_NEON])).toBe(true);
  });

  it("allows model via alias and preview normalization (2-way)", () => {
    // Legacy Argon ↔ Neon 2-way
    expect(isModelAllowedById("gemini-4-argon", [MODEL_IDS.GEMINI_4_NEON])).toBe(true);
    expect(isModelAllowedById(MODEL_IDS.GEMINI_4_NEON, ["gemini-4-argon"])).toBe(true);
    expect(isModelAllowedById("gemini-4-argon-preview", ["gemini-4-argon"])).toBe(true);
    // Legacy Claude 4.5 ↔ Claude 5.5 2-way
    expect(isModelAllowedById("claude-sonnet-4.5", [MODEL_IDS.CLAUDE_SONNET_55])).toBe(true);
    expect(isModelAllowedById(MODEL_IDS.CLAUDE_SONNET_55, ["claude-sonnet-4.5"])).toBe(true);
  });

  it("denies model not in allowed list", () => {
    expect(isModelAllowedById("claude-sonnet-5-5", [DEFAULT_MODEL])).toBe(false);
  });

  it("denies unknown, garbage or prototype string attacks", () => {
    expect(isModelAllowedById("unknown-nonexistent-model", [DEFAULT_MODEL])).toBe(false);
    expect(isModelAllowedById("toString", [DEFAULT_MODEL])).toBe(false);
    expect(isModelAllowedById("constructor", [DEFAULT_MODEL])).toBe(false);
    expect(isModelAllowedById("", [DEFAULT_MODEL])).toBe(false);
  });

  it("permits selectable models when allowed list is empty (unconstrained / loading)", () => {
    expect(isModelAllowedById(DEFAULT_MODEL, [])).toBe(true);
    expect(isModelAllowedById(MODEL_IDS.GEMINI_4_NEON, new Set())).toBe(true);
    expect(isModelAllowedById("unknown-model", [])).toBe(false);
  });

  it("always permits studio model IDs", () => {
    expect(isModelAllowedById(MODEL_IDS.NOVELCRAFTER, [DEFAULT_MODEL])).toBe(true);
    expect(isModelAllowedById(MODEL_IDS.IMAGE_STUDIO, [DEFAULT_MODEL])).toBe(true);
  });

  it("TC-07: reconcileAllowedStoryModel preserves selection on network error (!isPermissionsResolved) or loading, and falls back safely when resolved", () => {
    const basicAllowed = new Set(["gemini-2.5-flash", "gemini-2.5-pro"]);

    // 1. Network error (!isPermissionsResolved) -> never overwrite author's selection
    expect(
      reconcileAllowedStoryModel("gemini-4-argon", new Set([DEFAULT_MODEL]), false, false)
    ).toEqual({
      model: "gemini-4-argon",
      didFallback: false,
    });

    // 2. Still loading -> never overwrite
    expect(reconcileAllowedStoryModel("gemini-4-argon", basicAllowed, true, true)).toEqual({
      model: "gemini-4-argon",
      didFallback: false,
    });

    // 3. Resolved and disallowed -> falls back to DEFAULT_MODEL if allowed, else first allowed selectable model
    expect(
      reconcileAllowedStoryModel(
        "gemini-4-argon",
        new Set([DEFAULT_MODEL]),
        false,
        true,
        DEFAULT_MODEL
      )
    ).toEqual({
      model: DEFAULT_MODEL,
      didFallback: true,
    });

    expect(
      reconcileAllowedStoryModel("gemini-4-argon", basicAllowed, false, true, "claude-sonnet-5-5")
    ).toEqual({
      model: "gemini-3.5-flash-lite",
      didFallback: true,
    });

    // 4. No selectable models in allowlist -> do not force invalid fallback
    expect(
      reconcileAllowedStoryModel("gemini-4-argon", new Set(["non-existent-id"]), false, true)
    ).toEqual({
      model: "gemini-4-argon",
      didFallback: false,
    });
  });

  it("TC-MA-01: prevents privilege escalation across legacy Gemini 2.5 aliases", () => {
    expect(isModelAllowedById("gemini-4-hydrogen", ["gemini-2.5-flash"])).toBe(false);
    expect(isModelAllowedById("gemini-4-hydrogen", ["gemini-2.5-pro"])).toBe(true);
    expect(isModelAllowedById("gemini-3.5-flash-lite", ["gemini-2.5-flash"])).toBe(true);
  });
});
