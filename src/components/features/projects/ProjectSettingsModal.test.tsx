import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectSettingsModal } from "./ProjectSettingsModal";

const mockDeleteProject = vi.fn();
const mockFetchProjects = vi.fn();
const mockDeleteConversation = vi.fn();
const mockRefreshConversations = vi.fn();
const mockConfirm = vi.fn();
const mockToastError = vi.fn();

const STABLE_PROJECTS = [
  {
    id: "proj-1",
    name: "Alpha Project",
    description: "",
    icon: "folder",
    color: "#ff8a4c",
    storage_bytes: 1024 * 1024,
    document_count: 1,
    conversation_count: 1,
    embedding_model: "gemini-embedding-2",
    created_at: "2026-11-01T00:00:00Z",
  },
];
const STABLE_LIMITS = { maxStorageBytesPerProject: 50 * 1024 * 1024 };
const STABLE_CONVS = [{ id: "chat-1", title: "Project Chat 1" }];
const stableT = (k: string) => k;

const stableProjectSettingsStore = {
  projects: STABLE_PROJECTS,
  limits: STABLE_LIMITS,
  deleteProject: mockDeleteProject,
  fetchProjects: mockFetchProjects,
};
vi.mock("@/lib/store/projectStore", () => ({
  useProjectStore: (selector?: (s: typeof stableProjectSettingsStore) => unknown) =>
    selector ? selector(stableProjectSettingsStore) : stableProjectSettingsStore,
}));

vi.mock("@/app/features/chat/hooks/useConversation", () => ({
  useConversation: () => ({
    getProjectConversations: () => STABLE_CONVS,
    deleteConversation: mockDeleteConversation,
    refreshConversations: mockRefreshConversations,
  }),
}));

vi.mock("@/app/features/chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: stableT,
    language: "vi",
  }),
}));

vi.mock("@/lib/store/confirmStore", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

describe("ProjectSettingsModal (TC-W3-05, TC-W3-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { documents: [] } }),
    }) as unknown as typeof fetch;
  });

  it("renders inside Radix Dialog with limits.maxStorageBytesPerProject, bilingual labels, sibling buttons, and closes on Escape", async () => {
    const onClose = vi.fn();
    const onSelectChat = vi.fn();
    render(
      <ProjectSettingsModal
        projectId="proj-1"
        isOpen={true}
        onClose={onClose}
        onSelectChat={onSelectChat}
      />
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("projectEmbeddingModel")).toBeInTheDocument();
    expect(screen.getByText(/\/ 50 MB/)).toBeInTheDocument();

    // Sibling buttons (no nested interactive)
    const chatBtn = screen.getByRole("button", { name: "Project Chat 1" });
    expect(chatBtn.querySelector("button")).toBeNull();
    fireEvent.click(chatBtn);
    expect(onSelectChat).toHaveBeenCalledWith("chat-1");

    // ESC closes via Radix Dialog
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("toasts error when project deletion fails", async () => {
    mockConfirm.mockResolvedValue(true);
    mockDeleteProject.mockRejectedValue(new Error("boom"));

    render(<ProjectSettingsModal projectId="proj-1" isOpen={true} onClose={vi.fn()} />);

    const deleteBtn = await screen.findByRole("button", { name: "deleteProject" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("projectDeleteFailed");
    });
  });
});
