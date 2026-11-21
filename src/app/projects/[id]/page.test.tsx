import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProjectPage from "./page";
import type { ProjectWithStats } from "@/types/projects";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";

vi.mock("@/lib/store/toastStore", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/store/confirmStore", () => ({
  confirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/features/layout/components/AppFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-frame">{children}</div>
  ),
}));

const mockProject: ProjectWithStats = {
  id: "p1",
  user_id: "u1",
  name: "Vikini Research",
  description: "Design system notes",
  color: "#FF8A4C",
  icon: "rocket",
  embedding_model: "gemini-embedding-2",
  document_count: 0,
  conversation_count: 0,
  storage_bytes: 0,
  created_at: "2026-11-11T00:00:00.000Z",
  updated_at: "2026-11-11T00:00:00.000Z",
};

const mockDeleteProject = vi.fn();
const mockFetchProjects = vi.fn();
const STABLE_PROJECT_LIST = [mockProject];
const stableProjectPageStore = {
  projects: STABLE_PROJECT_LIST,
  limits: undefined,
  deleteProject: mockDeleteProject,
  fetchProjects: mockFetchProjects,
};
let mockProjectConvs: Array<{ id: string; title?: string; createdAt?: string }> = [];

vi.mock("@/lib/store/projectStore", () => ({
  useProjectStore: (selector?: (s: typeof stableProjectPageStore) => unknown) =>
    selector ? selector(stableProjectPageStore) : stableProjectPageStore,
}));

vi.mock("@/app/features/chat/hooks/useConversation", () => ({
  useConversation: () => ({
    getProjectConversations: () => mockProjectConvs,
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
  }),
}));

describe("ProjectPage knowledge defense & New Chat tokens (TC-6E-02)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectConvs = [];
    mockDeleteProject.mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("does not crash when /api/projects/[id]/knowledge omits documents and styles New Chat with --accent tokens", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    }) as unknown as typeof fetch;

    render(<ProjectPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Vikini Research/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/no documents/i)).toBeInTheDocument();
    });

    const heading = screen.getByRole("heading", { level: 1, name: /Vikini Research/i });
    expect(heading.textContent).toBe("Vikini Research");

    const newChatBtn = screen.getByRole("button", { name: /new chat/i });
    expect(newChatBtn.className).toContain("bg-(--accent)");
    expect(newChatBtn.className).toContain("text-(--on-accent)");
    expect(newChatBtn.className).not.toContain("bg-primary");
  });

  it("TC-W3-06 & TC-W4-05: renders sibling buttons for project chats (no nested buttons) and shows toast.error when project deletion fails", async () => {
    mockProjectConvs = [
      { id: "c-1", title: "Project Chat Alpha", createdAt: "2026-06-01T00:00:00Z" },
    ];
    mockDeleteProject.mockRejectedValueOnce(new Error("Delete failed"));
    vi.mocked(confirm).mockResolvedValueOnce(true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { documents: [] } }),
    }) as unknown as typeof fetch;

    render(<ProjectPage />);

    const chatBtn = await screen.findByRole("button", { name: /Project Chat Alpha/i });
    expect(chatBtn.querySelector("button")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /delete project/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });
});
