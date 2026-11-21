import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { DynamicIcon, hasCuratedIcon } from "./DynamicIcon";

const ICON_PICKER_NAMES = [
  "Lightbulb",
  "Target",
  "Palette",
  "Flame",
  "Diamond",
  "Sparkles",
  "Rocket",
  "BookOpen",
  "Laptop",
  "Music",
  "Gamepad2",
  "Star",
  "Zap",
  "Wand2",
  "Drama",
  "Camera",
  "Clapperboard",
  "Rainbow",
  "Gift",
  "FileEdit",
  "Wrench",
  "Settings",
  "GraduationCap",
  "Globe",
  "Heart",
  "Brain",
  "Bot",
  "MessageCircle",
  "BarChart3",
  "Dice5",
];

const PROJECT_ICON_AND_ALIASES = [
  "folder",
  "folder-open",
  "briefcase",
  "code",
  "book-open",
  "book",
  "flask-conical",
  "flask",
  "bar-chart-3",
  "chart",
  "sparkles",
  "rocket",
  "globe",
  "heart",
  "star",
  "lightbulb",
];

describe("DynamicIcon (CT-6B-01, NP-4)", () => {
  it("renders a Lucide icon when given a valid PascalCase icon name", () => {
    const { container } = render(<DynamicIcon name="Lightbulb" className="w-5 h-5" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.classList.contains("lucide-lightbulb")).toBe(true);
  });

  it("renders a Lucide icon when given lowercase icon name", () => {
    const { container } = render(<DynamicIcon name="sparkles" className="w-4 h-4" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.classList.contains("lucide-sparkles")).toBe(true);
  });

  it("renders a Lucide icon when given kebab-case, snake_case, and camelCase names", () => {
    for (const name of ["pen-tool", "bar_chart_3", "bookOpen", "FileEdit"]) {
      const { container, queryByText } = render(<DynamicIcon name={name} className="w-5 h-5" />);
      expect(container.querySelector("svg"), `Expected SVG for ${name}`).toBeTruthy();
      expect(queryByText(name)).toBeNull();
    }
  });

  it("resolves all 30 IconPicker icons and all ProjectIcon names/aliases from curated registry", () => {
    for (const iconName of [...ICON_PICKER_NAMES, ...PROJECT_ICON_AND_ALIASES]) {
      expect(hasCuratedIcon(iconName), `Missing curated icon: ${iconName}`).toBe(true);
      const { container, queryByText } = render(<DynamicIcon name={iconName} />);
      expect(container.querySelector("svg"), `Failed to render SVG for ${iconName}`).toBeTruthy();
      expect(queryByText(iconName)).toBeNull();
    }
  });

  it("Negative Probe NP-4: falls back safely for unknown multi-char ASCII slugs without spilling raw text", () => {
    expect(hasCuratedIcon("unknown-long-slug")).toBe(false);
    const { container, queryByText } = render(
      <DynamicIcon name="unknown-long-slug" className="w-4 h-4" />
    );
    expect(queryByText("unknown-long-slug")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders emoji inside an overflow-hidden span", () => {
    const { container, getByText } = render(<DynamicIcon name="💡" className="text-xl" />);
    expect(container.querySelector("svg")).toBeNull();
    const el = getByText("💡");
    expect(el).toBeTruthy();
    expect(el.className).toContain("overflow-hidden");
  });

  it("renders custom string symbol when provided", () => {
    const { getByText } = render(<DynamicIcon name="◆" />);
    expect(getByText("◆")).toBeTruthy();
  });

  it("renders fallback when name is null or undefined", () => {
    const { getByText } = render(<DynamicIcon name={null} fallback={<span>FallbackIcon</span>} />);
    expect(getByText("FallbackIcon")).toBeTruthy();
  });

  it("renders fallback when name is empty whitespace", () => {
    const { getByText } = render(<DynamicIcon name="   " fallback={<span>FallbackIcon</span>} />);
    expect(getByText("FallbackIcon")).toBeTruthy();
  });

  it("renders null when name is missing and no fallback provided", () => {
    const { container } = render(<DynamicIcon name="" />);
    expect(container.firstChild).toBeNull();
  });
});
