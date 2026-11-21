import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppFrameState } from "./useAppFrameState";
import { DEFAULT_PANEL_COLLAPSED, useLayoutStore } from "@/lib/store/layoutStore";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/features/gems",
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({ t: (k: string) => k, language: "vi" }),
}));

const mockConfirm = vi.fn();
vi.mock("@/lib/store/confirmStore", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

let mockConversations:
  | Array<{ id: string; model?: string; projectId?: string | null; title?: string }>
  | undefined;
const mockCreateConversation = vi.fn();
const mockRenameConversation = vi.fn();
const mockRenameConversationOptimistic = vi.fn();
const mockDeleteConversation = vi.fn();

vi.mock("../../chat/hooks/useConversation", () => ({
  useConversation: () => ({
    conversations: mockConversations,
    createConversation: mockCreateConversation,
    renameConversation: mockRenameConversation,
    renameConversationOptimistic: mockRenameConversationOptimistic,
    deleteConversation: mockDeleteConversation,
  }),
}));

describe("useAppFrameState", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockConfirm.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockCreateConversation.mockReset();
    mockRenameConversation.mockReset();
    mockRenameConversationOptimistic.mockReset();
    mockDeleteConversation.mockReset();
  });

  it("TC-07: keeps only standalone main chats (filters storage containers & project chats)", () => {
    mockConversations = [
      { id: "a", model: "gemini-3.5-flash-lite" },
      { id: "b", model: "vikini-image-studio" },
      { id: "c", model: "user_templates_store" },
      { id: "n", model: "vikini-novelcrafter" },
      { id: "p", model: "gemini-3.5-flash-lite", projectId: "proj-1" },
      { id: "d" },
    ];
    const { result } = renderHook(() => useAppFrameState());
    expect(result.current.mainChats.map((c) => c.id)).toEqual(["a", "d"]);
    expect(result.current.studioProjects.map((c) => c.id)).toEqual(["b"]);
    expect(result.current.section).toBe("pages");
    expect(result.current.allConversations).toHaveLength(6);
  });

  it("TC-W4-03: creates a studio project and navigates to /images?projectId=", async () => {
    mockConversations = [];
    mockCreateConversation.mockResolvedValue({ id: "studio-99" });
    const { result } = renderHook(() => useAppFrameState());

    act(() => result.current.openMobile());
    await act(async () => {
      await result.current.handleCreateStudioProject();
    });
    expect(mockCreateConversation).toHaveBeenCalledWith({
      title: "studioNewProject",
      model: "vikini-image-studio",
    });
    expect(result.current.mobileOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/images?projectId=studio-99");
  });

  it("TC-07: handles missing conversations", () => {
    mockConversations = undefined;
    const { result } = renderHook(() => useAppFrameState());
    expect(result.current.mainChats).toEqual([]);
    expect(result.current.allConversations).toEqual([]);
  });

  it("TC-07: opens/closes the mobile drawer and toggles collapse", () => {
    useLayoutStore.setState({ panelCollapsedBySection: { ...DEFAULT_PANEL_COLLAPSED } });
    mockConversations = [];
    const { result } = renderHook(() => useAppFrameState());
    expect(result.current.mobileOpen).toBe(false);
    act(() => result.current.openMobile());
    expect(result.current.mobileOpen).toBe(true);
    act(() => result.current.closeMobile());
    expect(result.current.mobileOpen).toBe(false);

    expect(result.current.sidebarCollapsed).toBe(false);
    act(() => result.current.toggleCollapsed());
    expect(result.current.sidebarCollapsed).toBe(true);
    expect(useLayoutStore.getState().panelCollapsedBySection).toEqual({
      ...DEFAULT_PANEL_COLLAPSED,
      pages: true,
    });
    act(() => result.current.toggleCollapsed());
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it("navigates to project and creates project chat with closeMobile()", async () => {
    mockConversations = [];
    mockCreateConversation.mockResolvedValue({ id: "conv-new" });
    const { result } = renderHook(() => useAppFrameState());

    act(() => result.current.openMobile());
    act(() => result.current.handleSelectProject("proj-1"));
    expect(result.current.mobileOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1");

    act(() => result.current.openMobile());
    await act(async () => {
      await result.current.handleCreateProjectChat("proj-1");
    });
    expect(result.current.mobileOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/?id=conv-new");
  });

  it("Negative Probe #6: guards null createConversation and delegates toast/mutate without duplicating", async () => {
    mockConversations = [{ id: "c1", title: "Old" }];
    mockCreateConversation.mockResolvedValue(null);
    mockConfirm.mockResolvedValue(true);
    mockRenameConversation.mockResolvedValue(undefined);
    mockDeleteConversation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAppFrameState());
    act(() => result.current.openMobile());
    await act(async () => {
      await result.current.handleCreateProjectChat("proj-1");
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.mobileOpen).toBe(true);

    act(() => result.current.openRenameChat("c1"));
    act(() => result.current.setRenameValue("Renamed"));
    await act(async () => {
      await result.current.confirmRenameChat();
    });
    expect(mockRenameConversationOptimistic).toHaveBeenCalledWith("c1", "Renamed");
    expect(mockRenameConversation).toHaveBeenCalledWith("c1", "Renamed");

    await act(async () => {
      await result.current.handleDeleteChat("c1");
    });
    expect(mockDeleteConversation).toHaveBeenCalledWith("c1");
    // No duplicate direct toast calls from useAppFrameState
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
