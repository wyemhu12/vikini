import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectStore, useProjectLimits, useCurrentProject } from "./projectStore";

describe("projectStore (TC-W1-09)", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProjectId: null,
      tier: "basic",
      limits: { maxProjects: 5, currentProjects: 1, maxStorageBytesPerProject: 5_000_000 },
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("useProjectLimits returns referentially stable result via useShallow (prevents Zustand v5 infinite render loop)", () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useProjectLimits();
    });

    expect(renderCount).toBeLessThanOrEqual(2);
    expect(result.current.tier).toBe("basic");
    expect(result.current.limits?.currentProjects).toBe(1);

    // Updating an unrelated slice field (isLoading) must not trigger re-render
    const beforeCount = renderCount;
    act(() => {
      useProjectStore.getState().setLoading(true);
    });
    expect(renderCount).toBe(beforeCount);
  });

  it("useCurrentProject uses targeted selector and does not re-render on unrelated store updates", () => {
    useProjectStore.setState({
      projects: [
        {
          id: "p-1",
          user_id: "u1",
          name: "Alpha",
          description: null,
          icon: "📁",
          color: "#000",
          embedding_model: "gemini-embedding-2",
          created_at: "",
          updated_at: "",
          conversation_count: 0,
          document_count: 0,
          storage_bytes: 0,
        },
      ],
      currentProjectId: "p-1",
    });

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useCurrentProject();
    });

    expect(result.current?.name).toBe("Alpha");
    const beforeCount = renderCount;
    act(() => {
      useProjectStore.getState().setError("unrelated error");
    });
    expect(renderCount).toBe(beforeCount);
  });

  it("increments and decrements limits.currentProjects on createProject & deleteProject", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              project: {
                id: "p-new",
                user_id: "u1",
                name: "New Project",
                description: null,
                icon: "📁",
                color: "#000",
                embedding_model: "gemini-embedding-2",
                created_at: "",
                updated_at: "",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { deleted: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await useProjectStore.getState().createProject({ name: "New Project" });
    expect(useProjectStore.getState().limits?.currentProjects).toBe(2);

    await useProjectStore.getState().deleteProject("p-new");
    expect(useProjectStore.getState().limits?.currentProjects).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws clean HTTP error instead of SyntaxError when upstream returns HTTP 502 HTML", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );

    await expect(useProjectStore.getState().createProject({ name: "Fail" })).rejects.toThrow(
      "Failed to create project (HTTP 502)"
    );
    expect(useProjectStore.getState().error).toBe("Failed to create project (HTTP 502)");
    expect(useProjectStore.getState().isLoading).toBe(false);
  });
});
