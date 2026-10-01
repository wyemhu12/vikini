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

describe("GalleryView - Modal Close Button (UI-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders image details modal with accessible close button", () => {
    render(<GalleryView />);

    expect(screen.getAllByText("galleryImageDetails").length).toBeGreaterThanOrEqual(1);

    const closeButton = screen.getByRole("button", { name: "close" });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.getAttribute("aria-label")).toBe("close");
  });

  it("calls setSelectedImage(null) when close button is clicked", () => {
    render(<GalleryView />);

    const closeButton = screen.getByRole("button", { name: "close" });
    fireEvent.click(closeButton);

    expect(mockSetSelectedImage).toHaveBeenCalledWith(null);
  });
});
