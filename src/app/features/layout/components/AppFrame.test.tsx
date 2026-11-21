import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AppFrame from "./AppFrame";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
  signOut: vi.fn(),
}));

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({ t: (k: string) => k, language: "vi" }),
}));

const mockSelectProject = vi.fn();
const mockCreateProjectChat = vi.fn();
const mockCreateStudioProject = vi.fn();
const mockDeleteChat = vi.fn();
const mockConfirmRename = vi.fn();
let mockSection: "chat" | "images" | "novelcrafter" | "pages" = "pages";
let mockMainChats: Array<{ id: string; title?: string; model?: string }> = [];
let mockStudioProjects: Array<{ id: string; title?: string; model?: string }> = [];

vi.mock("../hooks/useAppFrameState", async () => {
  const { useState } = await import("react");
  return {
    useAppFrameState: () => {
      const [mobileOpen, setMobileOpen] = useState(false);
      const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
      const [renameValue, setRenameValue] = useState("");
      return {
        section: mockSection,
        allConversations: [...mockMainChats, ...mockStudioProjects],
        mainChats: mockMainChats,
        studioProjects: mockStudioProjects,
        mobileOpen,
        sidebarCollapsed: false,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
        toggleCollapsed: vi.fn(),
        handleSelectProject: mockSelectProject,
        handleCreateProjectChat: mockCreateProjectChat,
        handleCreateStudioProject: mockCreateStudioProject,
        handleDeleteChat: mockDeleteChat,
        renamingChatId,
        renameValue,
        setRenameValue,
        openRenameChat: (id: string) => {
          setRenamingChatId(id);
          setRenameValue("Initial title");
        },
        closeRenameChat: () => {
          setRenamingChatId(null);
          setRenameValue("");
        },
        confirmRenameChat: mockConfirmRename,
      };
    },
  };
});

let capturedSidebarProps: Record<string, unknown> = {};

vi.mock("../../sidebar/components/Sidebar", () => ({
  default: (props: Record<string, unknown>) => {
    capturedSidebarProps = props;
    return (
      <nav aria-label="sidebar-mock" data-mobile-open={String(Boolean(props.mobileOpen))}>
        <button
          type="button"
          onClick={() => (props.onRenameChat as ((id: string) => void) | undefined)?.("c1")}
        >
          trigger-rename
        </button>
      </nav>
    );
  },
}));

vi.mock("./HeaderBar", () => ({
  default: ({ onToggleSidebar }: { onToggleSidebar?: () => void }) => (
    <header>
      <button type="button" onClick={onToggleSidebar}>
        open-menu
      </button>
    </header>
  ),
}));

describe("AppFrame", () => {
  beforeEach(() => {
    capturedSidebarProps = {};
    mockSection = "pages";
    mockMainChats = [];
    mockStudioProjects = [];
    mockPush.mockReset();
    mockSelectProject.mockReset();
    mockCreateProjectChat.mockReset();
    mockCreateStudioProject.mockReset();
    mockDeleteChat.mockReset();
    mockConfirmRename.mockReset();
  });

  it("TC-08: renders a hidden h1 and children inside #page-content without a nested main", () => {
    const { container } = render(
      <AppFrame title="Gems">
        <p>page body</p>
      </AppFrame>
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Gems" });
    expect(heading.className).toContain("sr-only");
    const content = container.querySelector("#page-content");
    expect(content).toContainElement(screen.getByText("page body"));
    expect(container.querySelector("main")).toBeNull();
  });

  it("TC-08: omits the hidden h1 when no title is given", () => {
    render(
      <AppFrame>
        <p>page body</p>
      </AppFrame>
    );
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("wires the header menu button to the sidebar drawer", () => {
    render(
      <AppFrame>
        <p>page body</p>
      </AppFrame>
    );
    const nav = screen.getByRole("navigation", { name: "sidebar-mock" });
    expect(nav).toHaveAttribute("data-mobile-open", "false");
    fireEvent.click(screen.getByRole("button", { name: "open-menu" }));
    expect(nav).toHaveAttribute("data-mobile-open", "true");
  });

  it("TC-P1-05: passes all 6 project/chat handlers to Sidebar and opens rename dialog", () => {
    render(
      <AppFrame>
        <p>page body</p>
      </AppFrame>
    );

    expect(typeof capturedSidebarProps.onSelectProject).toBe("function");
    expect(typeof capturedSidebarProps.onCreateProjectChat).toBe("function");
    expect(typeof capturedSidebarProps.onRenameChat).toBe("function");
    expect(typeof capturedSidebarProps.onDeleteChat).toBe("function");
    expect(typeof capturedSidebarProps.onRenameProjectConversation).toBe("function");
    expect(typeof capturedSidebarProps.onDeleteProjectConversation).toBe("function");

    fireEvent.click(screen.getByRole("button", { name: "trigger-rename" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const input = screen.getByDisplayValue("Initial title");
    fireEvent.change(input, { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(mockConfirmRename).toHaveBeenCalledTimes(1);
  });

  it("WP-1: syncs Sidebar with studioProjects and routes to /images?projectId= inside images section", () => {
    mockSection = "images";
    mockMainChats = [{ id: "chat-1", title: "Regular Chat" }];
    mockStudioProjects = [
      { id: "studio-1", title: "Portrait Project", model: "vikini-image-studio" },
    ];

    render(
      <AppFrame>
        <p>gallery body</p>
      </AppFrame>
    );

    expect(capturedSidebarProps.conversations).toEqual(mockStudioProjects);
    expect(capturedSidebarProps.conversationsLabel).toBe("studioProjectsLabel");
    expect(capturedSidebarProps.sectionActionLabel).toBe("studioNewProject");

    (capturedSidebarProps.onSelectConversation as (id: string) => void)("studio-1");
    expect(mockPush).toHaveBeenCalledWith("/images?projectId=studio-1");

    (capturedSidebarProps.onSectionAction as () => void)();
    expect(mockCreateStudioProject).toHaveBeenCalledTimes(1);
  });
});
