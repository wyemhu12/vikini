import { describe, it, expect, beforeEach, vi } from "vitest";
import { sanitizeRecentModelIds, useRecentModelsStore } from "./recentModelsStore";

describe("recentModelsStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useRecentModelsStore.setState({ recentModelIds: [] });
  });

  it("TC-05: keeps at most 3 unique ids, most recent first", () => {
    const { pushRecentModel } = useRecentModelsStore.getState();
    for (const id of ["A", "B", "C", "D", "B"]) pushRecentModel(id);
    expect(useRecentModelsStore.getState().recentModelIds).toEqual(["B", "D", "C"]);
  });

  it("TC-05: sanitizes untrusted stored values", () => {
    expect(sanitizeRecentModelIds(["a", 1, "", "a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(sanitizeRecentModelIds("a")).toEqual([]);
    expect(sanitizeRecentModelIds(null)).toEqual([]);
  });

  it("TC-05: corrupted storage rehydrates to an empty list", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem("vikini-recent-models", "{broken");
    await useRecentModelsStore.persist.rehydrate();
    expect(useRecentModelsStore.getState().recentModelIds).toEqual([]);
  });

  it("loads persisted ids on rehydrate", async () => {
    window.localStorage.setItem(
      "vikini-recent-models",
      JSON.stringify({ state: { recentModelIds: ["x", 5, "y"] }, version: 1 })
    );
    await useRecentModelsStore.persist.rehydrate();
    expect(useRecentModelsStore.getState().recentModelIds).toEqual(["x", "y"]);
  });
});
