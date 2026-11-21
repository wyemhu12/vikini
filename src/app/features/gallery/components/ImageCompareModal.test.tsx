import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ImageCompareModal from "./ImageCompareModal";
import { useLanguageStore } from "@/lib/store/languageStore";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    style,
    className,
  }: {
    src: string;
    alt: string;
    style?: React.CSSProperties;
    className?: string;
  }) => <img src={src} alt={alt} style={style} className={className} />,
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  ZoomIn: () => <span data-testid="zoom-in" />,
  ZoomOut: () => <span data-testid="zoom-out" />,
  RotateCcw: () => <span data-testid="reset-zoom" />,
  ArrowLeftRight: () => <span data-testid="swap-images" />,
  X: () => <span data-testid="close-modal" />,
  Columns2: () => <span data-testid="split-mode" />,
  Layers: () => <span data-testid="overlay-mode" />,
}));

describe("ImageCompareModal Component - Touch & Slider Events (UI-03, TC-GAL-02)", () => {
  const mockLeftImage = {
    id: "left-img",
    url: "https://example.com/left.png",
    prompt: "Prompt for Left Image",
  };
  const mockRightImage = {
    id: "right-img",
    url: "https://example.com/right.png",
    prompt: "Prompt for Right Image",
  };

  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
    // Stub getBoundingClientRect on HTMLDivElement prototype so happy-dom returns 400px width
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 400,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "en" });
    vi.restoreAllMocks();
  });

  it("renders comparison modal and switches to overlay slider mode", () => {
    render(
      <ImageCompareModal
        isOpen={true}
        onClose={vi.fn()}
        onSwap={vi.fn()}
        leftImage={mockLeftImage}
        rightImage={mockRightImage}
      />
    );

    // Initial Side-by-side mode has mode switch button
    const switchModeBtn = screen.getByRole("button", { name: /side by side/i });
    expect(switchModeBtn).toBeInTheDocument();

    // Click switch to Overlay Mode
    fireEvent.click(switchModeBtn);

    // Find slider container by touch-none and cursor-ew-resize class
    const sliderContainer = document.querySelector(".cursor-ew-resize");
    expect(sliderContainer).toBeInTheDocument();
    expect(sliderContainer?.className).toContain("touch-none");
  });

  it("updates slider position on touch events (onTouchStart and onTouchMove)", () => {
    render(
      <ImageCompareModal
        isOpen={true}
        onClose={vi.fn()}
        onSwap={vi.fn()}
        leftImage={mockLeftImage}
        rightImage={mockRightImage}
      />
    );

    // Switch to overlay mode
    const switchModeBtn = screen.getByRole("button", { name: /side by side/i });
    fireEvent.click(switchModeBtn);

    const sliderContainer = document.querySelector(".cursor-ew-resize") as HTMLDivElement;
    expect(sliderContainer).not.toBeNull();

    // Fire touchMove at clientX = 200 (200 / 400 = 50%)
    const touchObj1 = { clientX: 200, clientY: 200 };
    fireEvent.touchMove(sliderContainer, {
      touches: [touchObj1],
      changedTouches: [touchObj1],
      targetTouches: [touchObj1],
    });

    // Verify clip-path has inset(0 50% 0 0)
    const clippedDiv = sliderContainer.querySelector("div[style*='clip-path']");
    expect(clippedDiv).not.toBeNull();
    expect(clippedDiv?.getAttribute("style")).toContain("50%");

    // Fire touchMove at clientX = 300 (300 / 400 = 75%, so clip remaining is 25%)
    const touchObj2 = { clientX: 300, clientY: 200 };
    fireEvent.touchMove(sliderContainer, {
      touches: [touchObj2],
      changedTouches: [touchObj2],
      targetTouches: [touchObj2],
    });

    expect(clippedDiv?.getAttribute("style")).toContain("25%");
  });

  it("updates slider position on mouse movement", () => {
    render(
      <ImageCompareModal
        isOpen={true}
        onClose={vi.fn()}
        onSwap={vi.fn()}
        leftImage={mockLeftImage}
        rightImage={mockRightImage}
      />
    );

    // Switch to overlay mode
    const switchModeBtn = screen.getByRole("button", { name: /side by side/i });
    fireEvent.click(switchModeBtn);

    const sliderContainer = document.querySelector(".cursor-ew-resize") as HTMLDivElement;
    expect(sliderContainer).not.toBeNull();

    // Fire mouseMove at clientX = 100 (100 / 400 = 25%, clip remaining is 75%)
    fireEvent.mouseMove(sliderContainer, {
      clientX: 100,
    });

    const clippedDiv = sliderContainer.querySelector("div[style*='clip-path']");
    expect(clippedDiv?.getAttribute("style")).toContain("75%");
  });

  it("TC-P5-03: uses semantic z-(--z-modal), bilingual aria-labels for icon-only buttons, aria-pressed on mode toggle, and localized Image A/B fallback", () => {
    useLanguageStore.setState({ language: "vi" });
    render(
      <ImageCompareModal
        isOpen={true}
        onClose={vi.fn()}
        onSwap={vi.fn()}
        leftImage={mockLeftImage}
        rightImage={mockRightImage}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "So sánh hình ảnh" });
    expect(dialog.className).toContain("z-(--z-modal)");
    expect(dialog.className).not.toContain("z-50");
    expect(dialog.getAttribute("aria-describedby")).toBeNull();

    const overlay = document.body.querySelector("[data-state='open'].fixed.inset-0");
    expect(overlay?.className).toContain("z-(--z-modal)");
    expect(overlay?.className).not.toContain("z-50");

    // 5 icon-only buttons have localized aria-labels and type="button"
    for (const label of ["Thu nhỏ", "Phóng to", "Đặt lại zoom", "Hoán đổi", "Đóng"]) {
      const btn = screen.getByRole("button", { name: label });
      expect(btn).toHaveAttribute("type", "button");
    }

    // Mode toggle preserves visible text and exposes aria-pressed
    const modeToggle = screen.getByRole("button", { name: "Song song" });
    expect(modeToggle).toHaveAttribute("type", "button");
    expect(modeToggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(modeToggle);
    expect(screen.getByRole("button", { name: "Chồng lớp" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Localized fallback labels
    expect(screen.getByText("Ảnh A")).toBeInTheDocument();
    expect(screen.getByText("Ảnh B")).toBeInTheDocument();
  });
});
