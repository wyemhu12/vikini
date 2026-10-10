import { render, screen } from "@testing-library/react";
import React from "react";
import HeaderBar from "@/app/features/layout/components/HeaderBar";
import { vi, describe, it, expect } from "vitest";

// Mock next/dynamic to render components synchronously
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let Component: React.ComponentType<Record<string, unknown>> | null = null;
    void fn().then((mod) => {
      Component = mod.default;
    });
    return function DynamicComponent(props: Record<string, unknown>) {
      return Component ? <Component {...props} /> : null;
    };
  },
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    header: React.forwardRef(function MockHeader(
      props: React.HTMLAttributes<HTMLElement>,
      ref: React.Ref<HTMLElement>
    ) {
      return <header ref={ref} {...props} />;
    }),
  },
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({
    theme: "blueprint",
    setTheme: vi.fn(),
  }),
}));

// Mock theme config
vi.mock("@/lib/config/theme-config", () => ({
  THEME_CONFIG: [
    { id: "focus-dark", labelKey: "focusDark", swatch: "#000000", group: "Focus" },
    { id: "custom-theme", labelKey: "customTheme", swatch: "#ffffff", group: "Custom" },
  ],
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  Check: (props: Record<string, unknown>) => <svg data-testid="check" {...props} />,
  Settings: (props: Record<string, unknown>) => <svg data-testid="settings" {...props} />,
  Menu: (props: Record<string, unknown>) => <svg data-testid="menu" {...props} />,
}));

// Mock Radix DropdownMenu
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: { children: React.ReactNode }) => (
    <div role="menuitem" {...props}>
      {children}
    </div>
  ),
  DropdownMenuLabel: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock useLanguage hook with absolute module id (@ alias - MAJOR-9)
vi.mock("@/app/features/chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        vi: "Tiếng Việt",
        en: "English",
        language: "Ngôn ngữ",
        theme: "Giao diện",
        themeFocus: "Tập trung",
        themeGlassmorphism: "Thủy tinh mờ",
        themeRa2: "Báo động đỏ (RA2)",
        focusDark: "Tập trung tối",
        customTheme: "Tùy biến",
        openSidebar: "Mở thanh bên",
        selectLanguage: "Chọn ngôn ngữ",
        selectTheme: "Chọn giao diện",
        appName: "Vikini Chat",
        settings: "Cài đặt",
      };
      return translations[key] || key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

describe("HeaderBar", () => {
  const renderHeader = (props = {}) => {
    return render(<HeaderBar onToggleSidebar={vi.fn()} {...props} />);
  };

  it("renders correctly with app name", () => {
    renderHeader();
    expect(screen.getByText("Vikini Chat")).toBeInTheDocument();
  });

  it("renders language selector with VN label", () => {
    renderHeader();
    // Language button shows "VN" when language is "vi"
    const vnLabels = screen.getAllByText("VN");
    expect(vnLabels.length).toBeGreaterThan(0);
  });

  it("renders theme selector with localized aria-label (TC-I18N-04)", () => {
    renderHeader();
    expect(screen.getByLabelText("Chọn giao diện")).toBeInTheDocument();
  });

  it("renders translated theme group label 'Tập trung' at both desktop and mobile menus (MAJOR-10)", () => {
    renderHeader();
    // Both desktop (:165) and mobile (:239) dropdown menus render the mapped label
    expect(screen.getAllByText("Tập trung")).toHaveLength(2);
  });

  it("renders verbatim fallback for unmapped theme group 'Custom' at both desktop and mobile menus (MAJOR-10 counter-test)", () => {
    renderHeader();
    // Groups not in THEME_GROUP_LABELS fall back to rendering the verbatim group name
    expect(screen.getAllByText("Custom")).toHaveLength(2);
  });

  it("renders the V logo brand element", () => {
    renderHeader();
    expect(screen.getByText("V")).toBeInTheDocument();
  });

  it("includes safe-area horizontal insets with md:px-6 reset for landscape viewport", () => {
    const { container } = renderHeader();
    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain("pl-[calc(1rem+var(--sal,0px))]");
    expect(header?.className).toContain("pr-[calc(1rem+var(--sar,0px))]");
    expect(header?.className).toContain("md:px-6");
  });

  it("does not contain obsolete focus:ring-opacity-50 class and uses focus-visible:ring-2", () => {
    const { container } = renderHeader();
    expect(container.querySelector(".focus\\:ring-opacity-50")).toBeNull();
    const focusVisibleBtn = container.querySelector(".focus-visible\\:ring-2");
    expect(focusVisibleBtn).not.toBeNull();
  });
});
