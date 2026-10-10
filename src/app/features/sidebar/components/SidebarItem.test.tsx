import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SidebarItem from "./SidebarItem";
import { downloadConversationById } from "@/lib/utils/download";
import { toast } from "@/lib/store/toastStore";
import { useLanguageStore } from "@/lib/store/languageStore";

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/download", () => ({
  downloadConversationById: vi.fn(),
}));

// Mock @radix-ui/react-dropdown-menu inline (Option 1 - MINOR-R2-2)
vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-root">{children}</div>
  ),
  Trigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  Portal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-portal">{children}</div>
  ),
  Content: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dropdown-content" className={className}>
      {children}
    </div>
  ),
  Item: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} type="button">
      {children}
    </button>
  ),
  Separator: () => <hr />,
}));

describe("SidebarItem Component & Accessibility (TC-PERF-02, TC-A11Y-02)", () => {
  const mockConversation = {
    id: "conv-123",
    title: "Project Alpha Discussion",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.setState({ language: "en" });
  });

  it("renders conversation title and calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(
      <SidebarItem
        conversation={mockConversation}
        isActive={false}
        onSelect={onSelect}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Project Alpha Discussion")).toBeInTheDocument();

    const mainButton = screen.getByRole("button", { name: "Project Alpha Discussion" });
    fireEvent.click(mainButton);
    expect(onSelect).toHaveBeenCalledWith("conv-123");
  });

  it("applies active styles when isActive is true", () => {
    const { container } = render(
      <SidebarItem
        conversation={mockConversation}
        isActive={true}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("sidebar-accent-active");
  });

  it("provides focus-visible indicators on main button and trigger button", () => {
    render(
      <SidebarItem
        conversation={mockConversation}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const mainButton = screen.getByRole("button", { name: "Project Alpha Discussion" });
    expect(mainButton.className).toContain("focus-visible:ring-2");
    expect(mainButton.className).toContain("focus-visible:ring-(--ring)");
    expect(mainButton.className).toContain("focus-visible:outline-none");

    const triggerButton = screen.getByRole("button", {
      name: /options for project alpha discussion/i,
    });
    expect(triggerButton.className).toContain("focus-visible:ring-2");
    expect(triggerButton.className).toContain("focus-visible:ring-(--ring)");
    expect(triggerButton.className).toContain("focus-visible:outline-none");
  });

  it("calls onRename when rename menu item is clicked", () => {
    const onRename = vi.fn();
    render(
      <SidebarItem
        conversation={mockConversation}
        isActive={false}
        onSelect={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />
    );

    const renameBtn = screen.getByRole("button", { name: /rename/i });
    fireEvent.click(renameBtn);
    expect(onRename).toHaveBeenCalledWith("conv-123");
  });

  it("calls onDelete when delete menu item is clicked", () => {
    const onDelete = vi.fn();
    render(
      <SidebarItem
        conversation={mockConversation}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith("conv-123");
  });

  it("handles conversation export download and shows success toast", async () => {
    vi.mocked(downloadConversationById).mockResolvedValue(true);

    render(
      <SidebarItem
        conversation={mockConversation}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const exportBtn = screen.getByRole("button", { name: /export \.txt/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadConversationById).toHaveBeenCalledWith("conv-123", "Project Alpha Discussion");
      expect(toast.success).toHaveBeenCalledWith("Download complete");
    });
  });

  it("uses Lucide icons for all iconography and has zero hand-rolled custom SVGs (TC-PERF-02)", () => {
    const { container } = render(
      <SidebarItem
        conversation={mockConversation}
        isActive={false}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Verify Lucide classes on SVGs
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);

    // Ellipsis vertical icon
    expect(container.querySelector(".lucide-ellipsis-vertical")).toBeInTheDocument();
    // Pencil icon
    expect(container.querySelector(".lucide-pencil")).toBeInTheDocument();
    // Download icon
    expect(container.querySelector(".lucide-download")).toBeInTheDocument();
    // Trash icon
    expect(container.querySelector(".lucide-trash-2")).toBeInTheDocument();

    // Anti-gaming: zero SVGs without .lucide class
    const nonLucideSvgs = container.querySelectorAll("svg:not(.lucide)");
    expect(nonLucideSvgs.length).toBe(0);
  });
});
