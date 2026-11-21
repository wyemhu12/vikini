import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ImageLightbox from "./ImageLightbox";
import type { GeneratedImage } from "./Canvas";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    language: "vi",
  }),
}));

const images: GeneratedImage[] = [
  { id: "i1", url: "https://example.com/1.png", prompt: "First", model: "flash" },
  { id: "i2", url: "https://example.com/2.png", prompt: "Second", model: "pro" },
];

describe("image-gen/ImageLightbox (TC-W3-05, WP-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Radix Dialog with bilingual labels, --on-accent badges, navigation, Escape and backdrop click", () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <ImageLightbox
        images={images}
        currentIndex={0}
        onClose={onClose}
        onNavigate={onNavigate}
        onRemix={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "nextImage" });
    fireEvent.click(nextBtn);
    expect(onNavigate).toHaveBeenCalledWith(1);

    for (const label of [
      "studioZoomOut",
      "studioZoomIn",
      "close",
      "studioEdit",
      "studioDownload",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    const reuseBtn = screen.getByRole("button", { name: /studioReuse/i });
    expect(reuseBtn.className).toContain("text-(--on-accent)");

    // Backdrop click closes
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape closes
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
