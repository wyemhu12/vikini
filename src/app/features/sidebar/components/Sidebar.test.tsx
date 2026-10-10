import { render, screen } from "@testing-library/react";
import React from "react";
import Sidebar from "./Sidebar";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useLanguageStore } from "@/lib/store/languageStore";

interface MockSidebarItemProps {
  conversation: { id: string; title?: string };
  isActive?: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

// Spy to capture props passed into SidebarItem for TC-PERF-01
export let latestSidebarItemProps: MockSidebarItemProps | null = null;

vi.mock("./SidebarItem", () => ({
  default: (props: MockSidebarItemProps) => {
    latestSidebarItemProps = props;
    return (
      <div data-testid={`sidebar-item-${props.conversation.id}`}>{props.conversation.title}</div>
    );
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/",
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

// Captured props from motion.aside for drag behavior verification
export let latestAsideProps: Record<string, unknown> = {};

// Mock framer-motion
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    aside: React.forwardRef(function MockAside(
      props: Record<string, unknown>,
      ref: React.Ref<HTMLElement>
    ) {
      latestAsideProps = props;
      const {
        drag: _drag,
        dragDirectionLock: _dragDirectionLock,
        dragConstraints: _dragConstraints,
        dragElastic: _dragElastic,
        dragSnapToOrigin: _dragSnapToOrigin,
        onDragEnd: _onDragEnd,
        ...htmlProps
      } = props;
      return <aside ref={ref} {...htmlProps} />;
    }),
    div: React.forwardRef(function MockDiv(
      props: React.HTMLAttributes<HTMLDivElement>,
      ref: React.Ref<HTMLDivElement>
    ) {
      return <div ref={ref} {...props} />;
    }),
  },
}));

// Mock project store
vi.mock("@/lib/store/projectStore", () => ({
  useProjectStore: () => ({
    projects: [],
    fetchProjects: vi.fn(),
    currentProject: null,
  }),
}));

// Mock gem store
vi.mock("../../gems/stores/useGemStore", () => ({
  useGemStore: () => ({
    openManager: vi.fn(),
  }),
}));

// Mock persona store
vi.mock("../../personas/stores/usePersonaStore", () => ({
  usePersonaStore: () => ({
    openManager: vi.fn(),
  }),
}));

// Mock CreateProjectModal
vi.mock("@/components/features/projects", () => ({
  CreateProjectModal: () => null,
}));

describe("Sidebar component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestSidebarItemProps = null;
    useLanguageStore.setState({ language: "en" });
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "en" });
  });

  it("renders desktop sidebar with unified custom-scrollbar container", () => {
    const { container } = render(<Sidebar chats={[]} collapsed={false} allConversations={[]} />);

    // Desktop aside is present
    const desktopAside = container.querySelector("aside.hidden.md\\:flex");
    expect(desktopAside).not.toBeNull();

    // Verify middle scroll area exists with expected flex and scrollbar classes
    const scrollContainer = desktopAside?.querySelector(".custom-scrollbar");
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.className).toContain("flex-1");
    expect(scrollContainer?.className).toContain("min-h-0");
    expect(scrollContainer?.className).toContain("overflow-y-auto");
  });

  it("does not render flex-1 placeholder when collapsed on desktop", () => {
    const { container } = render(<Sidebar chats={[]} collapsed={true} allConversations={[]} />);

    const desktopAside = container.querySelector("aside.hidden.md\\:flex");
    expect(desktopAside).not.toBeNull();

    // Old placeholder was: "flex-1 flex flex-col items-center pt-4 border-t"
    const oldPlaceholder = desktopAside?.querySelector(".flex-1.flex-col.items-center.pt-4");
    expect(oldPlaceholder).toBeNull();

    // Footer container still has border-t
    const footer = desktopAside?.querySelector(".shrink-0.pt-3");
    expect(footer).not.toBeNull();
    expect(footer?.className).toContain("border-t");
  });

  it("renders mobile drawer with X icon on close button and unified scroll container", () => {
    render(<Sidebar chats={[]} mobileOpen={true} allConversations={[]} />);

    // Close button has aria-label="Close sidebar" and contains an SVG icon
    const closeBtn = screen.getByLabelText("Close sidebar");
    expect(closeBtn).not.toBeNull();
    const svgIcon = closeBtn.querySelector("svg");
    expect(svgIcon).not.toBeNull();

    // Mobile aside is portaled to document.body, has z-(--z-drawer) and pb-[calc(4rem+var(--sab,0px))]
    const mobileAside = document.body.querySelector("aside.md\\:hidden");
    expect(mobileAside).not.toBeNull();
    expect(mobileAside?.className).toContain("z-(--z-drawer)");
    expect(mobileAside?.className).toContain("pb-[calc(4rem+var(--sab,0px))]");

    // Inside mobile aside, the custom-scrollbar is present
    const mobileScrollContainer = mobileAside?.querySelector(".custom-scrollbar");
    expect(mobileScrollContainer).not.toBeNull();
    expect(mobileScrollContainer?.className).toContain("flex-1");
    expect(mobileScrollContainer?.className).toContain("min-h-0");
    expect(mobileScrollContainer?.className).toContain("overflow-y-auto");
  });

  it("attaches drag gesture props to mobile drawer motion.aside with snap-to-origin", () => {
    render(<Sidebar chats={[]} mobileOpen={true} allConversations={[]} />);

    expect(latestAsideProps.drag).toBe("x");
    expect(latestAsideProps.dragDirectionLock).toBe(true);
    expect(latestAsideProps.dragConstraints).toEqual({ left: 0, right: 0 });
    expect(latestAsideProps.dragElastic).toEqual({ left: 0.5, right: 0 });
    expect(latestAsideProps.dragSnapToOrigin).toBe(true);
    expect(typeof latestAsideProps.onDragEnd).toBe("function");
  });

  it("calls onCloseMobile when user drags beyond close threshold (-120px)", () => {
    const onCloseMobileMock = vi.fn();
    render(
      <Sidebar
        chats={[]}
        mobileOpen={true}
        allConversations={[]}
        onCloseMobile={onCloseMobileMock}
      />
    );

    const onDragEnd = latestAsideProps.onDragEnd as (
      event: unknown,
      info: { offset: { x: number }; velocity: { x: number } }
    ) => void;

    expect(onDragEnd).toBeDefined();

    // Drag beyond threshold (-120px)
    onDragEnd(undefined, { offset: { x: -120 }, velocity: { x: 0 } });
    expect(onCloseMobileMock).toHaveBeenCalledTimes(1);
  });

  it("does not call onCloseMobile when user drags below threshold (-50px)", () => {
    const onCloseMobileMock = vi.fn();
    render(
      <Sidebar
        chats={[]}
        mobileOpen={true}
        allConversations={[]}
        onCloseMobile={onCloseMobileMock}
      />
    );

    const onDragEnd = latestAsideProps.onDragEnd as (
      event: unknown,
      info: { offset: { x: number }; velocity: { x: number } }
    ) => void;

    expect(onDragEnd).toBeDefined();

    // Drag below threshold (-50px)
    onDragEnd(undefined, { offset: { x: -50 }, velocity: { x: 0 } });
    expect(onCloseMobileMock).not.toHaveBeenCalled();
  });

  it("maintains stable callback references passed to SidebarItem across re-renders (TC-PERF-01)", () => {
    const mockChats = [{ id: "conv-1", title: "Chat 1" }];
    const onSelectChat = vi.fn();
    const onRenameChat = vi.fn();
    const onDeleteChat = vi.fn();

    const { rerender } = render(
      <Sidebar
        chats={mockChats}
        onSelectChat={onSelectChat}
        onRenameChat={onRenameChat}
        onDeleteChat={onDeleteChat}
        session={{ user: { rank: "basic", email: "user1@example.com" } }}
      />
    );

    const props1 = latestSidebarItemProps;
    expect(props1).not.toBeNull();
    expect(props1?.conversation.id).toBe("conv-1");

    // Re-render with dummy prop change (unrelated prop session)
    rerender(
      <Sidebar
        chats={mockChats}
        onSelectChat={onSelectChat}
        onRenameChat={onRenameChat}
        onDeleteChat={onDeleteChat}
        session={{ user: { rank: "basic", email: "user2@example.com" } }}
      />
    );

    const props2 = latestSidebarItemProps;
    expect(props2).not.toBeNull();

    // Affirmation: callback instances MUST remain strictly identical (toBe)
    expect(props2?.onSelect).toBe(props1?.onSelect);
    expect(props2?.onRename).toBe(props1?.onRename);
    expect(props2?.onDelete).toBe(props1?.onDelete);

    // Counter-factual: changing callback prop MUST change the memoized reference (not.toBe)
    const newOnSelectChat = vi.fn();
    rerender(
      <Sidebar
        chats={mockChats}
        onSelectChat={newOnSelectChat}
        onRenameChat={onRenameChat}
        onDeleteChat={onDeleteChat}
        session={{ user: { rank: "basic", email: "user2@example.com" } }}
      />
    );

    const props3 = latestSidebarItemProps;
    expect(props3?.onSelect).not.toBe(props1?.onSelect);
    // Other callbacks whose inputs didn't change remain stable
    expect(props3?.onRename).toBe(props1?.onRename);
    expect(props3?.onDelete).toBe(props1?.onDelete);
  });

  it("renders localized UI labels in Vietnamese without prop drilling (TC-I18N-02)", () => {
    useLanguageStore.setState({ language: "vi" });

    render(
      <Sidebar
        chats={[]}
        mobileOpen={true}
        session={{ user: { rank: "admin", email: "admin@example.com" } }}
      />
    );

    // Admin management label localized in vi.ts (rendered in desktop & mobile)
    expect(screen.getAllByText("Quản lý hệ thống").length).toBeGreaterThanOrEqual(1);

    // Close button localized aria-label
    expect(screen.getByLabelText("Đóng thanh bên")).toBeInTheDocument();

    // Empty state hint localized in vi.ts
    expect(
      screen.getAllByText("Bắt đầu cuộc trò chuyện mới để trải nghiệm").length
    ).toBeGreaterThanOrEqual(1);
  });
});
