import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import HeaderBar from "@/app/features/layout/components/HeaderBar";
import { ThemeProvider } from "next-themes";
import { vi, describe, it, expect } from "vitest";

// Mock dependencies
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let Component: React.ComponentType<Record<string, unknown>> | null = null;
    const load = async () => {
      Component = (await fn()).default;
    };
    load();
    return (props: Record<string, unknown>) => (Component ? <Component {...props} /> : null);
  },
}));

vi.mock("lucide-react", () => ({
  ChevronDown: () => <svg data-testid="chevron-down" />,
  Check: () => <svg data-testid="check" />,
  Circle: () => <svg data-testid="circle" />,
}));

// Mock translations
const mockT = {
  vi: "Tiếng Việt",
  en: "English",
  language: "Ngôn ngữ",
  themes: "Giao diện",
  openSidebar: "Mở thanh bên",
  selectLanguage: "Chọn ngôn ngữ",
  selectTheme: "Chọn giao diện",
  // Theme keys
  blueprint: "Xanh Dịu",
};

describe("HeaderBar", () => {
  const renderHeader = (props = {}) => {
    return render(
      <ThemeProvider>
        <HeaderBar
          t={mockT}
          language="en"
          onLanguageChange={vi.fn()}
          onToggleSidebar={vi.fn()}
          {...props}
        />
      </ThemeProvider>
    );
  };

  it("renders correctly with default props", () => {
    renderHeader();
    expect(screen.getByText("Vikini Chat")).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn ngôn ngữ")).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn giao diện")).toBeInTheDocument();
  });

  it("displays current language code", () => {
    renderHeader({ language: "vi" });
    expect(screen.getByText("VN")).toBeInTheDocument();
  });

  it("calls onToggleSidebar when hamburger button is clicked", () => {
    const onToggleSidebar = vi.fn();
    renderHeader({ onToggleSidebar });

    const sidebarBtn = screen.getByLabelText("Mở thanh bên"); // using mockT translation or fallback?
    // In our component logic: `aria-label={t?.openSidebar || "Open sidebar"}`
    // If we pass mockT, it should find "Mở thanh bên" if mapped correctly?
    // Wait, the component uses keys. Let's check if the aria-label is set correctly.
    // Actually, screen.getByLabelText looks for aria-label.
    // If t is passed, it uses t.openSidebar ("Mở thanh bên").

    // Note: The HeaderBar uses 't' as an object containing keys.
    // If we pass mockT as a map of key->value, we should expect "Mở thanh bên".

    expect(sidebarBtn).toBeInTheDocument();
    fireEvent.click(sidebarBtn);
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });
});
