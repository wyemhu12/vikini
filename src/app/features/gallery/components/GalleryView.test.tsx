import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GalleryView } from "./GalleryView";

const mockSetSelectedImage = vi.fn();
const SAMPLE_IMAGE = {
  id: "img-1",
  url: "https://example.com/test.png",
  prompt: "A beautiful mountain",
  createdAt: "2026-06-01T00:00:00Z",
  model: "gemini-3.1-flash-image",
};
let mockImages: (typeof SAMPLE_IMAGE)[] = [SAMPLE_IMAGE];
let mockSelectedImage: typeof SAMPLE_IMAGE | null = SAMPLE_IMAGE;

vi.mock("./hooks/useGalleryController", () => ({
  useGalleryController: () => ({
    t: (key: string) => key,
    language: "en",
    router: { push: vi.fn() },
    images: mockImages,
    filteredImages: mockImages,
    availableModels: [],
    selectedImage: mockSelectedImage,
    setSelectedImage: mockSetSelectedImage,
    loading: false,
    loadingMore: false,
    hasMore: false,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    dateFilter: "all",
    setDateFilter: vi.fn(),
    modelFilter: "all",
    setModelFilter: vi.fn(),
    showFavoritesOnly: false,
    setShowFavoritesOnly: vi.fn(),
    deleting: null,
    compareMode: false,
    compareImages: [],
    showCompareModal: false,
    setShowCompareModal: vi.fn(),
    handleToggleCompareMode: vi.fn(),
    handleToggleCompareImage: vi.fn(),
    handleOpenCompare: vi.fn(),
    handleSwapCompareImages: vi.fn(),
    isImageSelectedForCompare: vi.fn().mockReturnValue(false),
    currentImageIndex: 0,
    handlePrevImage: vi.fn(),
    handleNextImage: vi.fn(),
    handleRemix: vi.fn(),
    handleDelete: vi.fn(),
    loadMoreRef: { current: null },
  }),
  DATE_FILTER_OPTIONS: [],
}));

vi.mock("../../chat/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "muc-dark",
    toggleMode: vi.fn(),
  }),
}));

vi.mock("../../layout/components/AppFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-frame-mock">{children}</div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("./ImageCompareModal", () => ({
  default: () => <div data-testid="compare-modal-mock" />,
}));

describe("GalleryView - Modal Close Button & Tokens (UI-02, M5, M8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImages = [SAMPLE_IMAGE];
    mockSelectedImage = SAMPLE_IMAGE;
  });

  it("renders inside the shared AppFrame with a single page h1", () => {
    mockSelectedImage = null;
    render(<GalleryView />);
    expect(screen.getByTestId("app-frame-mock")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("TC-10: shows an empty state linking to Image Studio when there are no images", () => {
    mockImages = [];
    mockSelectedImage = null;
    render(<GalleryView />);
    expect(screen.getByRole("status")).toHaveTextContent("galleryNoImages");
    expect(screen.getByRole("link", { name: "galleryEmptyAction" })).toHaveAttribute(
      "href",
      "/images"
    );
  });

  it("renders image details modal with accessible close buttons", () => {
    render(<GalleryView />);

    expect(screen.getAllByText("galleryImageDetails").length).toBeGreaterThanOrEqual(1);

    const closeButtons = screen.getAllByRole("button", { name: "closeImageDetails" });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    expect(closeButtons[0].getAttribute("aria-label")).toBe("closeImageDetails");
  });

  it("calls setSelectedImage(null) when close button is clicked", () => {
    render(<GalleryView />);

    const closeButtons = screen.getAllByRole("button", { name: "closeImageDetails" });
    fireEvent.click(closeButtons[0]);

    expect(mockSetSelectedImage).toHaveBeenCalledWith(null);
  });

  it("uses text-(--accent-foreground) on Remix button rather than raw text-white", () => {
    render(<GalleryView />);

    const remixBtn = screen.getByRole("button", { name: /galleryRemix/i });
    expect(remixBtn).toBeInTheDocument();
    expect(remixBtn.className).toContain("text-(--accent-foreground)");
    expect(remixBtn.className).not.toContain("text-white");
  });
});
