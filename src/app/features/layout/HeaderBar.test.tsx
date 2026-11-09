import { render, screen, fireEvent } from "@testing-library/react";
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

// Mock next-themes (Vikini's useTheme wraps it; real theme-config is used)
let mockTheme = "muc-light";
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({
    theme: mockTheme,
    setTheme: vi.fn(),
  }),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  Check: (props: Record<string, unknown>) => <svg data-testid="check" {...props} />,
  Settings: (props: Record<string, unknown>) => <svg data-testid="settings" {...props} />,
  Menu: (props: Record<string, unknown>) => <svg data-testid="menu" {...props} />,
  Moon: (props: Record<string, unknown>) => <svg data-testid="moon" {...props} />,
  Sun: (props: Record<string, unknown>) => <svg data-testid="sun" {...props} />,
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
  DropdownMenuRadioGroup: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div role="group" data-value={value}>
      {children}
    </div>
  ),
  DropdownMenuRadioItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div role="menuitemradio" data-radio-value={value}>
      {children}
    </div>
  ),
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
        themes: "Giao diện",
        themeHoangHon: "Hoàng Hôn",
        themeMuc: "Mực",
        themeReu: "Rêu",
        themeSen: "Sen",
        themeThan: "Than",
        themeMode: "Chế độ",
        themeModeDark: "Tối",
        themeModeLight: "Sáng",
        openSidebar: "Mở thanh bên",
        openMenu: "Mở menu điều hướng",
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

  it("TC-15: lists the 5 themes and both modes in desktop and mobile menus, without legacy groups", () => {
    renderHeader();
    for (const label of ["Hoàng Hôn", "Rêu", "Sen", "Than", "Tối", "Sáng"]) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
    // "Mực" also appears once in the desktop trigger label
    expect(screen.getAllByText("Mực")).toHaveLength(3);
    expect(screen.queryByText("Tập trung")).toBeNull();
    expect(screen.queryByText("Báo động đỏ (RA2)")).toBeNull();
  });

  it("TC-16: radio groups reflect the stored theme key family and mode", () => {
    mockTheme = "muc-light";
    renderHeader();
    const groups = screen.getAllByRole("group");
    const values = groups.map((g) => g.getAttribute("data-value"));
    expect(values.filter((v) => v === "muc")).toHaveLength(2);
    expect(values.filter((v) => v === "light")).toHaveLength(2);
  });

  it("TC-16: a legacy stored id resolves to its migrated family and mode", () => {
    mockTheme = "orchid";
    renderHeader();
    const values = screen.getAllByRole("group").map((g) => g.getAttribute("data-value"));
    expect(values.filter((v) => v === "sen")).toHaveLength(2);
    expect(values.filter((v) => v === "light")).toHaveLength(2);
    mockTheme = "muc-light";
  });

  it("TC-05: shows a 44px mobile menu button that opens the sidebar", () => {
    const onToggleSidebar = vi.fn();
    render(<HeaderBar onToggleSidebar={onToggleSidebar} />);
    const button = screen.getByRole("button", { name: "Mở menu điều hướng" });
    expect(button.className).toContain("md:hidden");
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-11");
    expect(button.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    fireEvent.click(button);
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("TC-06: renders no menu button without a handler and uses a solid header background", () => {
    const { container } = render(<HeaderBar />);
    expect(screen.queryByRole("button", { name: "Mở menu điều hướng" })).toBeNull();
    const header = container.querySelector("header");
    expect(header?.className).toContain("bg-(--bg)/85");
    expect(header?.className).not.toContain("bg-transparent");
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

  it("adds md:hidden class when hideOnDesktop is true (Step C7)", () => {
    const { container } = renderHeader({ hideOnDesktop: true });
    const header = container.querySelector("header");
    expect(header?.className).toContain("md:hidden");
  });
});
