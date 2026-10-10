import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GalleryView } from "./GalleryView";

const mockSetSelectedImage = vi.fn();

vi.mock("./hooks/useGalleryController", () => ({
  useGalleryController: () => ({
    t: (key: string) => key,
    language: "en",
    router: { push: vi.fn() },
    conversations: [],
    mainChats: [],
    images: [],
    filteredImages: [
      {
        id: "img-1",
        url: "https://example.com/test.png",
        prompt: "A beautiful mountain",
        createdAt: "2026-06-01T00:00:00Z",
        model: "gemini-3.1-flash-image",
      },
    ],
    availableModels: [],
    selectedImage: {
      id: "img-1",
      url: "https://example.com/test.png",
      prompt: "A beautiful mountain",
      createdAt: "2026-06-01T00:00:00Z",
      model: "gemini-3.1-flash-image",
    },
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
    mobileOpen: false,
    setMobileOpen: vi.fn(),
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
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
    theme: "blueprint",
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("../../sidebar/components/Sidebar", () => ({
  default: () => <div data-testid="sidebar-mock" />,
}));

vi.mock("../../layout/components/HeaderBar", () => ({
  default: () => <div data-testid="header-mock" />,
}));

vi.mock("../../layout/components/FloatingMenuTrigger", () => ({
  default: () => <div data-testid="floating-menu-mock" />,
}));

vi.mock("./ImageCompareModal", () => ({
  default: () => <div data-testid="compare-modal-mock" />,
}));

describe("GalleryView - Modal Close Button & Tokens (UI-02, M5, M8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
