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
let mockAvailableModels: string[] = [];
let mockLoading = false;
const mockSetShowFavoritesOnly = vi.fn();
let mockCompareMode = false;
const mockToggleCompareImage = vi.fn();

vi.mock("./hooks/useGalleryController", () => ({
  useGalleryController: () => ({
    t: (key: string) => key,
    language: "en",
    router: { push: vi.fn() },
    images: mockImages,
    filteredImages: mockImages,
    availableModels: mockAvailableModels,
    selectedImage: mockSelectedImage,
    setSelectedImage: mockSetSelectedImage,
    loading: mockLoading,
    loadingMore: false,
    hasMore: false,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    dateFilter: "all",
    setDateFilter: vi.fn(),
    modelFilter: "all",
    setModelFilter: vi.fn(),
    showFavoritesOnly: false,
    setShowFavoritesOnly: mockSetShowFavoritesOnly,
    deleting: null,
    compareMode: mockCompareMode,
    compareImages: [],
    showCompareModal: false,
    setShowCompareModal: vi.fn(),
    handleToggleCompareMode: vi.fn(),
    handleToggleCompareImage: mockToggleCompareImage,
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
    mockAvailableModels = [];
    mockLoading = false;
    mockSetShowFavoritesOnly.mockClear();
    mockCompareMode = false;
    mockToggleCompareImage.mockClear();
    mockSetSelectedImage.mockClear();
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

  it("uses text-(--on-accent) on Remix button rather than raw text-white", () => {
    render(<GalleryView />);

    const remixBtn = screen.getByRole("button", { name: /galleryRemix/i });
    expect(remixBtn).toBeInTheDocument();
    expect(remixBtn.className).toContain("text-(--on-accent)");
    expect(remixBtn.className).not.toContain("text-white");
  });

  it("3D TC-02: names both filter selects", () => {
    mockSelectedImage = null;
    mockAvailableModels = ["gemini-3.1-flash-image"];
    render(<GalleryView />);
    expect(screen.getByRole("combobox", { name: "galleryDateFilter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "galleryModelFilter" })).toBeInTheDocument();
  });

  it("phase 4 TC-09: an empty library shows only the empty state", () => {
    mockImages = [];
    mockSelectedImage = null;
    render(<GalleryView />);
    expect(screen.queryByPlaceholderText("gallerySearch")).toBeNull();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /compareImages/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /galleryFavorites/ })).toBeNull();
    expect(screen.getByRole("link", { name: "galleryEmptyAction" })).toHaveAttribute(
      "href",
      "/images"
    );
  });

  it("phase 4 TC-10: filter controls share one height and favorites is a toggle", () => {
    mockSelectedImage = null;
    mockAvailableModels = ["gemini-3.1-flash-image"];
    render(<GalleryView />);
    const search = screen.getByPlaceholderText("gallerySearch");
    const [dateSelect, modelSelect] = screen.getAllByRole("combobox");
    const favorites = screen.getByRole("button", { name: /galleryFavorites/ });
    for (const el of [search, dateSelect, modelSelect, favorites]) {
      expect(el.className).toContain("h-10");
    }
    expect(favorites).toHaveAttribute("aria-pressed", "false");
    expect(favorites.className).not.toMatch(/pink/);
    fireEvent.click(favorites);
    expect(mockSetShowFavoritesOnly).toHaveBeenCalledWith(true);
  });

  it("phase 4 TC-11: keeps filters while the library is still loading", () => {
    mockImages = [];
    mockSelectedImage = null;
    mockLoading = true;
    render(<GalleryView />);
    expect(screen.getByPlaceholderText("gallerySearch")).toBeInTheDocument();
  });

  it("phase 4: uses the shared Images header and no uppercase detail labels", () => {
    const { unmount } = render(<GalleryView />);
    // Detail labels live in the image modal (open by default in this mock).
    const modalClasses = Array.from(document.body.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(modalClasses.filter((c) => c.split(/\s+/).includes("uppercase"))).toEqual([]);
    unmount();
    mockSelectedImage = null;
    render(<GalleryView />);
    expect(screen.getByRole("navigation", { name: /Chế độ ảnh|Image modes/ })).toBeInTheDocument();
    const classes = Array.from(document.body.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => c.split(/\s+/).includes("uppercase"))).toEqual([]);
  });

  it("6C TC-01: image cards are keyboard-reachable buttons that open the details", () => {
    mockSelectedImage = null;
    render(<GalleryView />);
    const card = screen.getByRole("button", { name: SAMPLE_IMAGE.prompt });
    expect(card).not.toHaveAttribute("aria-pressed");
    expect(card.className).toContain("focus-visible:ring-2");
    expect(card.innerHTML).toContain("group-focus-visible:opacity-100");
    fireEvent.click(card);
    expect(mockSetSelectedImage).toHaveBeenCalledWith(SAMPLE_IMAGE);
  });

  it("6C TC-02: in compare mode a card toggles its selection instead of opening", () => {
    mockSelectedImage = null;
    mockCompareMode = true;
    render(<GalleryView />);
    const card = screen.getByRole("button", { name: SAMPLE_IMAGE.prompt });
    expect(card).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(card);
    expect(mockToggleCompareImage).toHaveBeenCalledWith(SAMPLE_IMAGE);
    expect(mockSetSelectedImage).not.toHaveBeenCalled();
  });
});
