import { describe, it, expect } from "vitest";
import { SELECTABLE_MODELS, type SelectableModel } from "@/lib/core/modelRegistry";
import {
  buildModelPickerSections,
  normalizeSearchText,
  resolveChatModelDisplay,
  type BuildSectionsOptions,
} from "./modelPicker";

const describeModel = (m: SelectableModel) => `desc ${m.id}`;
const base: BuildSectionsOptions = {
  recentIds: [],
  query: "",
  filter: "all",
  isLocalVisible: false,
  describe: describeModel,
};
const allIds = (sections: ReturnType<typeof buildModelPickerSections>) =>
  sections.flatMap((s) => s.models.map((m) => m.id));

const claude = SELECTABLE_MODELS.find((m) => m.providerId === "anthropic");

describe("modelPicker", () => {
  it("TC-01: recent group comes first and is not repeated in its provider group", () => {
    expect(claude).toBeDefined();
    const sections = buildModelPickerSections(SELECTABLE_MODELS, {
      ...base,
      recentIds: [claude!.id, "not-a-model"],
    });
    expect(sections[0].id).toBe("recent");
    expect(sections[0].models.map((m) => m.id)).toEqual([claude!.id]);
    const anthropic = sections.find((s) => s.id === "anthropic");
    expect(anthropic?.models.some((m) => m.id === claude!.id) ?? false).toBe(false);
    for (const section of sections) expect(section.models.length).toBeGreaterThan(0);
    // each model appears exactly once
    const ids = allIds(sections);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("TC-02: search ignores case and diacritics and hides the recent group", () => {
    const lite = buildModelPickerSections(SELECTABLE_MODELS, {
      ...base,
      recentIds: [claude!.id],
      query: "flash lite",
    });
    expect(lite.some((s) => s.id === "recent")).toBe(false);
    expect(allIds(lite)).toContain("gemini-3.5-flash-lite");

    const upper = allIds(buildModelPickerSections(SELECTABLE_MODELS, { ...base, query: "FLASH" }));
    const accented = allIds(
      buildModelPickerSections(SELECTABLE_MODELS, { ...base, query: "gémini" })
    );
    expect(upper.length).toBeGreaterThan(0);
    expect(accented.every((id) => id.startsWith("gemini"))).toBe(true);
    expect(accented.length).toBeGreaterThan(0);
    expect(normalizeSearchText("  Đọc Ảnh ")).toBe("doc anh");
  });

  it("TC-03: filters by category / provider and hides local models when unavailable", () => {
    const byId = (id: string) => SELECTABLE_MODELS.find((m) => m.id === id)!;
    const fast = allIds(buildModelPickerSections(SELECTABLE_MODELS, { ...base, filter: "fast" }));
    expect(fast.length).toBeGreaterThan(0);
    expect(fast.every((id) => byId(id).category === "low-latency")).toBe(true);

    const reasoning = allIds(
      buildModelPickerSections(SELECTABLE_MODELS, { ...base, filter: "reasoning" })
    );
    expect(reasoning.every((id) => byId(id).category === "reasoning")).toBe(true);

    const free = allIds(buildModelPickerSections(SELECTABLE_MODELS, { ...base, filter: "free" }));
    expect(free.every((id) => byId(id).providerId === "openrouter-free")).toBe(true);

    expect(buildModelPickerSections(SELECTABLE_MODELS, { ...base, filter: "local" })).toEqual([]);
    const local = allIds(
      buildModelPickerSections(SELECTABLE_MODELS, {
        ...base,
        filter: "local",
        isLocalVisible: true,
      })
    );
    expect(local.every((id) => byId(id).providerId === "local")).toBe(true);
  });

  it("TC-04: resolves current, legacy and retired model ids for messages", () => {
    expect(resolveChatModelDisplay("gemini-2.5-flash")).toEqual({
      name: "Gemini 3.5 Flash-Lite",
      providerLabel: "Gemini",
      status: "legacy",
    });
    expect(resolveChatModelDisplay("gemini-3.5-flash-lite").status).toBe("current");
    expect(resolveChatModelDisplay("gpt-9-x")).toEqual({
      name: "gpt-9-x",
      providerLabel: "AI",
      status: "retired",
    });
    expect(resolveChatModelDisplay("__proto__").status).toBe("retired");
    expect(resolveChatModelDisplay("constructor").status).toBe("retired");
    expect(resolveChatModelDisplay(undefined)).toEqual({
      name: "AI",
      providerLabel: "AI",
      status: "retired",
    });
  });
});
