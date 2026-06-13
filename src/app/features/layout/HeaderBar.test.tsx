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
  THEME_CONFIG: [{ id: "blueprint", labelKey: "blueprint", swatch: "#3b82f6", group: "Cool" }],
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
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock useLanguage hook
vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        vi: "Tiếng Việt",
        en: "English",
        language: "Ngôn ngữ",
        theme: "Giao diện",
        openSidebar: "Mở thanh bên",
        selectLanguage: "Chọn ngôn ngữ",
        selectTheme: "Chọn giao diện",
        appName: "Vikini Chat",
        settings: "Cài đặt",
        blueprint: "Xanh Dịu",
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

  it("renders the V logo brand element", () => {
    renderHeader();
    expect(screen.getByText("V")).toBeInTheDocument();
  });
});
