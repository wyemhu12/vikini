import { render, screen } from "@testing-library/react";
import React from "react";
import Sidebar from "./Sidebar";
import { vi, describe, it, expect, beforeEach } from "vitest";

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

// Mock framer-motion
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    aside: React.forwardRef(function MockAside(
      props: React.HTMLAttributes<HTMLElement>,
      ref: React.Ref<HTMLElement>
    ) {
      return <aside ref={ref} {...props} />;
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

    // Mobile aside is portaled to document.body, has z-(--z-drawer) and pb-16
    const mobileAside = document.body.querySelector("aside.md\\:hidden");
    expect(mobileAside).not.toBeNull();
    expect(mobileAside?.className).toContain("z-(--z-drawer)");
    expect(mobileAside?.className).toContain("pb-16");

    // Inside mobile aside, the custom-scrollbar is present
    const mobileScrollContainer = mobileAside?.querySelector(".custom-scrollbar");
    expect(mobileScrollContainer).not.toBeNull();
    expect(mobileScrollContainer?.className).toContain("flex-1");
    expect(mobileScrollContainer?.className).toContain("min-h-0");
    expect(mobileScrollContainer?.className).toContain("overflow-y-auto");
  });
});
