import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectNode } from "./ProjectNode";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { downloadConversationById } from "@/lib/utils/download";
import type { ProjectWithStats } from "@/types/projects";
import type { FrontendConversation } from "@/app/features/chat/hooks/useConversation";

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/download", () => ({
  downloadConversationById: vi.fn(),
}));

vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Item: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Separator: () => <hr />,
}));

describe("ProjectNode Export (TC-06)", () => {
  const mockProject: ProjectWithStats = {
    id: "proj-1",
    user_id: "user-1",
    name: "Test Project",
    description: null,
    icon: "Folder",
    color: "#60a5fa",
    embedding_model: "gemini-embedding-2",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    conversation_count: 1,
    document_count: 0,
    storage_bytes: 0,
  };

  const mockConversations: FrontendConversation[] = [
    {
      id: "conv-1",
      title: "Conversation 1",
      project_id: "proj-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls downloadConversationById and successfully exports", async () => {
    vi.mocked(downloadConversationById).mockResolvedValue(true);

    // Expand project by default
    localStorage.setItem("project-expanded-proj-1", "true");

    render(
      <ProjectNode
        project={mockProject}
        conversations={mockConversations}
        activeConversationId={null}
        onSelect={vi.fn()}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        onRenameConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
      />
    );

    // Open dropdown menu
    const menuBtn = screen.getByRole("button", { name: "Conversation options" });
    fireEvent.click(menuBtn);

    // Find export option
    const exportBtn = screen.getByText(/Xuất|Export/i);
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadConversationById).toHaveBeenCalledWith("conv-1", "Conversation 1");
    });
  });

  it("shows toast.error and logs error when downloadConversationById fails", async () => {
    vi.mocked(downloadConversationById).mockRejectedValue(new Error("Network export timeout"));

    localStorage.setItem("project-expanded-proj-1", "true");

    render(
      <ProjectNode
        project={mockProject}
        conversations={mockConversations}
        activeConversationId={null}
        onSelect={vi.fn()}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        onRenameConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
      />
    );

    const menuBtn = screen.getByRole("button", { name: "Conversation options" });
    fireEvent.click(menuBtn);

    const exportBtn = screen.getByText(/Xuất|Export/i);
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadConversationById).toHaveBeenCalledWith("conv-1", "Conversation 1");
      expect(logger.error).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
