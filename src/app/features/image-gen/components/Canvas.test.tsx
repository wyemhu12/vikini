import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Canvas, { type GeneratedImage } from "./Canvas";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "en",
  }),
}));

// Mock TagInput to isolate Canvas component logic
vi.mock("./TagInput", () => ({
  default: () => <div data-testid="tag-input-mock" />,
}));

describe("Canvas Component - Keyboard Focus & A11y (A11Y-01, TC-GAL-03)", () => {
  const mockOnRemix = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnImageClick = vi.fn();
  const mockOnSelectTemplate = vi.fn();
  const mockOnVariation = vi.fn();
  const mockOnToggleFavorite = vi.fn();

  const mockImage: GeneratedImage = {
    id: "img-test-1",
    url: "https://example.com/test-art.png",
    prompt: "Cyberpunk cityscape in rain",
    aspectRatio: "16:9",
    model: "imagen-3",
    enhancer: true,
    enhancedPrompt: "Highly detailed cyberpunk cityscape with neon reflections",
    isFavorite: false,
    editDepth: 1,
    aiComment: "Vibrant neon lighting with wet reflections",
    tags: ["cyberpunk", "rain"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders overlay with group-focus-within:opacity-100 for keyboard navigation", () => {
    const { container } = render(
      <Canvas
        images={[mockImage]}
        generating={false}
        onRemix={mockOnRemix}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    // Find the overlay element containing controls
    const overlay = container.querySelector(".group-focus-within\\:opacity-100");
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("opacity-0");
    expect(overlay?.className).toContain("group-hover:opacity-100");
    expect(overlay?.className).toContain("group-focus-within:opacity-100");
  });

  it("ensures top badges and bottom controls slide into view on focus-within", () => {
    const { container } = render(
      <Canvas
        images={[mockImage]}
        generating={false}
        onRemix={mockOnRemix}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
      />
    );

    const translatedElements = container.querySelectorAll(".group-focus-within\\:translate-y-0");
    expect(translatedElements.length).toBeGreaterThanOrEqual(2);

    // Top metadata badges container
    const topBadges = container.querySelector(".-translate-y-2.group-focus-within\\:translate-y-0");
    expect(topBadges).not.toBeNull();

    // Bottom controls container
    const bottomControls = container.querySelector(
      ".translate-y-4.group-focus-within\\:translate-y-0"
    );
    expect(bottomControls).not.toBeNull();
  });

  it("renders interactive action buttons with focus-visible ring styles", () => {
    render(
      <Canvas
        images={[mockImage]}
        generating={false}
        onRemix={mockOnRemix}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
        onVariation={mockOnVariation}
        onToggleFavorite={mockOnToggleFavorite}
      />
    );

    const remixBtn = screen.getByRole("button", { name: /studioReuse/i });
    expect(remixBtn).toBeInTheDocument();
    expect(remixBtn.className).toContain("focus-visible:ring-2");

    const editBtn = screen.getByRole("button", { name: /studioEdit/i });
    expect(editBtn).toBeInTheDocument();
    expect(editBtn.className).toContain("focus-visible:ring-2");

    const variationBtn = screen.getByRole("button", { name: /studioVariation/i });
    expect(variationBtn).toBeInTheDocument();
    expect(variationBtn.className).toContain("focus-visible:ring-2");

    const favoriteBtn = screen.getByTitle("studioFavorite");
    expect(favoriteBtn).toBeInTheDocument();
    expect(favoriteBtn.className).toContain("focus-visible:ring-2");

    const deleteBtn = screen.getByTitle("galleryDeleteImage");
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn.className).toContain("focus-visible:ring-2");
  });

  it("triggers button callbacks on click", () => {
    render(
      <Canvas
        images={[mockImage]}
        generating={false}
        onRemix={mockOnRemix}
        onDelete={mockOnDelete}
        onEdit={mockOnEdit}
        onVariation={mockOnVariation}
        onToggleFavorite={mockOnToggleFavorite}
        onImageClick={mockOnImageClick}
      />
    );

    // Remix click
    fireEvent.click(screen.getByRole("button", { name: /studioReuse/i }));
    expect(mockOnRemix).toHaveBeenCalledWith(mockImage);

    // Edit click
    fireEvent.click(screen.getByRole("button", { name: /studioEdit/i }));
    expect(mockOnEdit).toHaveBeenCalledWith(mockImage);

    // Variation click
    fireEvent.click(screen.getByRole("button", { name: /studioVariation/i }));
    expect(mockOnVariation).toHaveBeenCalledWith(mockImage);

    // Favorite click
    fireEvent.click(screen.getByTitle("studioFavorite"));
    expect(mockOnToggleFavorite).toHaveBeenCalledWith(mockImage);

    // Delete click
    fireEvent.click(screen.getByTitle("galleryDeleteImage"));
    expect(mockOnDelete).toHaveBeenCalledWith(mockImage.id);

    // Image click
    const img = screen.getByAltText(`Generated ${mockImage.prompt}`);
    fireEvent.click(img);
    expect(mockOnImageClick).toHaveBeenCalledWith(mockImage, 0);
  });

  it("renders empty state with templates when images is empty and not generating", () => {
    render(
      <Canvas
        images={[]}
        generating={false}
        onRemix={mockOnRemix}
        onDelete={mockOnDelete}
        onSelectTemplate={mockOnSelectTemplate}
      />
    );

    expect(screen.getByText("studioEmptyTitle")).toBeInTheDocument();
    expect(screen.getByText("studioEmptySubtitle")).toBeInTheDocument();
  });

  it("renders generating skeleton when generating is true", () => {
    const { container } = render(
      <Canvas images={[]} generating={true} onRemix={mockOnRemix} onDelete={mockOnDelete} />
    );

    const shimmerBlock = container.querySelector(".shimmer-block");
    expect(shimmerBlock).not.toBeNull();
  });
});
