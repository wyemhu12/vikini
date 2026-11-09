import { describe, it, expect, vi } from "vitest";
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

vi.mock("../hooks/useAppFrameState", async () => {
  const { useState } = await import("react");
  return {
    useAppFrameState: () => {
      const [mobileOpen, setMobileOpen] = useState(false);
      return {
        allConversations: [],
        mainChats: [],
        mobileOpen,
        sidebarCollapsed: false,
        openMobile: () => setMobileOpen(true),
        closeMobile: () => setMobileOpen(false),
        toggleCollapsed: vi.fn(),
      };
    },
  };
});

vi.mock("../../sidebar/components/Sidebar", () => ({
  default: ({ mobileOpen }: { mobileOpen?: boolean }) => (
    <nav aria-label="sidebar-mock" data-mobile-open={String(Boolean(mobileOpen))} />
  ),
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
});
