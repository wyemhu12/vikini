import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PromptStudioApp from "./PromptStudioApp";

let mockStatus: "loading" | "authenticated" | "unauthenticated" = "authenticated";
const mockSignIn = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: mockStatus === "authenticated" ? { user: { id: "u1", email: "a@b.com" } } : null,
    status: mockStatus,
  }),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../../chat/hooks/useTheme", () => ({
  useTheme: () => ({}),
}));

vi.mock("../../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({ t: (k: string) => k, language: "vi" }),
}));

vi.mock("../../../chat/components/hooks/useAllowedModels", () => ({
  useAllowedModels: () => ({
    allowedModelIds: new Set<string>(),
    loading: false,
    isResolved: true,
  }),
}));

vi.mock("../../hooks/useNovelcrafterStory", () => ({
  useNovelcrafterStory: () => ({
    stories: [],
    validStoryId: null,
    isLoadingState: false,
    creatingConversation: false,
    storyState: {
      selectedModel: "gemini-3.8-flash",
      storyBible: {},
      routing: {},
    },
    activeChapter: { title: "Ch 1", content: "", scenes: "", summary: "", extraInstructions: "" },
    previousChapterProseTail: "",
    previousChapterSummaries: "",
    gems: [],
    personas: [],
    setSelectedModel: vi.fn(),
    setSelectedConversationId: vi.fn(),
    handleCreateStory: vi.fn(),
    handleDeleteStory: vi.fn(),
    updateRouting: vi.fn(),
    updateFeaturePersonaSlot: vi.fn(),
    updateFeatureModelSlot: vi.fn(),
    destructivePrompt: null,
    confirmDestructiveSave: vi.fn(),
    reloadAfterDestructiveRejection: vi.fn(),
  }),
}));

vi.mock("../../hooks/useNovelcrafterModelGuard", () => ({
  useNovelcrafterModelGuard: vi.fn(),
}));

vi.mock("../../../sidebar/components/Sidebar", () => ({
  default: () => <div data-testid="sidebar-mock" />,
}));

vi.mock("../../../layout/components/HeaderBar", () => ({
  default: () => <div data-testid="header-mock" />,
}));

vi.mock("../NovelcrafterAiSettingsWorkspace", () => ({
  default: () => <div data-testid="ai-settings-mock" />,
}));

vi.mock("../DestructiveSaveConfirmModal", () => ({
  default: () => null,
}));

describe("PromptStudioApp auth guard & skip-link (TC-W4-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus = "authenticated";
  });

  it("renders loading view when session is loading without calling signIn", () => {
    mockStatus = "loading";
    render(<PromptStudioApp />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("triggers signIn inside useEffect when unauthenticated and renders nothing", async () => {
    mockStatus = "unauthenticated";
    const { container } = render(<PromptStudioApp />);
    expect(container.firstChild).toBeNull();
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });
  });

  it("renders workspace with z-(--z-banner) skip-link when authenticated", () => {
    mockStatus = "authenticated";
    render(<PromptStudioApp />);
    expect(screen.getByTestId("ai-settings-mock")).toBeInTheDocument();
    const skipLink = screen.getByRole("link", { name: "skipToMainContent" });
    expect(skipLink.className).toContain("focus:z-(--z-banner)");
    expect(skipLink.className).not.toContain("focus:z-50");
  });
});
