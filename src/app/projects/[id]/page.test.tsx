import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProjectPage from "./page";
import type { ProjectWithStats } from "@/types/projects";

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

vi.mock("@/lib/store/projectStore", () => ({
  useProjectStore: () => ({
    projects: [mockProject],
    deleteProject: vi.fn(),
    fetchProjects: vi.fn(),
  }),
}));

vi.mock("@/app/features/chat/hooks/useConversation", () => ({
  useConversation: () => ({
    getProjectConversations: () => [],
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
  }),
}));

describe("ProjectPage knowledge defense & New Chat tokens (TC-6E-02)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
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
});
