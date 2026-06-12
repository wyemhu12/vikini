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

// Mock useLanguage hook
const mockSetLanguage = vi.fn();
vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: mockSetLanguage,
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
    return render(
      <ThemeProvider>
        <HeaderBar onToggleSidebar={vi.fn()} {...props} />
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
    renderHeader();
    // Mock language is "vi", so should show "VN"
    expect(screen.getByText("VN")).toBeInTheDocument();
  });

  it("calls onToggleSidebar when hamburger button is clicked", () => {
    const onToggleSidebar = vi.fn();
    renderHeader({ onToggleSidebar });

    const sidebarBtn = screen.getByLabelText("Mở thanh bên");
    expect(sidebarBtn).toBeInTheDocument();
    fireEvent.click(sidebarBtn);
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });
});
