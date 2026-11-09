import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AppRail from "./AppRail";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLanguageStore } from "@/lib/store/languageStore";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: React.forwardRef(function MockLink(
    { children, ...props }: { children: React.ReactNode; href: string },
    ref: React.Ref<HTMLAnchorElement>
  ) {
    return (
      <a ref={ref} {...props}>
        {children}
      </a>
    );
  }),
}));

vi.mock("@/lib/store/layoutStore", () => ({ rehydrateLayoutStore: vi.fn() }));

function renderRail(props: Partial<React.ComponentProps<typeof AppRail>> = {}) {
  return render(
    <TooltipProvider>
      <AppRail panelCollapsed={false} {...props} />
    </TooltipProvider>
  );
}

describe("AppRail", () => {
  beforeEach(() => {
    mockPathname = "/";
    useLanguageStore.setState({ language: "vi" });
  });

  it("TC-06: marks only the current section with aria-current", () => {
    mockPathname = "/gallery";
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(nav.tagName).toBe("NAV");
    expect(screen.getByRole("link", { name: "Ảnh" })).toHaveAttribute("aria-current", "page");
    for (const name of ["Trò chuyện", "Gems & Persona", "Novelcrafter"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
    }
  });

  it("TC-06: every rail control has an accessible name", () => {
    renderRail({ onOpenCommandPalette: vi.fn(), onTogglePanel: vi.fn(), onLogout: vi.fn() });
    for (const control of [...screen.getAllByRole("button"), ...screen.getAllByRole("link")]) {
      expect(control.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("TC-07: the new chat button always starts a chat and hides the palette button without a handler", () => {
    const onNewChat = vi.fn();
    renderRail({ onNewChat });
    fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Lệnh nhanh (Ctrl K)" })).toBeNull();
  });

  it("shows the palette button and toggles the panel with the right state", () => {
    const onOpenCommandPalette = vi.fn();
    const onTogglePanel = vi.fn();
    renderRail({ onOpenCommandPalette, onTogglePanel, panelCollapsed: true });
    fireEvent.click(screen.getByRole("button", { name: "Lệnh nhanh (Ctrl K)" }));
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
    const toggle = screen.getByRole("button", { name: "Hiện danh sách" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(onTogglePanel).toHaveBeenCalledTimes(1);
  });
});
