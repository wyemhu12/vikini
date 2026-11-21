import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ImageLightbox from "./ImageLightbox";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    language: "vi",
  }),
}));

describe("chat/ImageLightbox (TC-W3-05, WP-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders in Radix Dialog with 6 accessible toolbar buttons, closes on Escape and backdrop click", () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox
        isOpen={true}
        onClose={onClose}
        imageUrl="https://example.com/art.png"
        imageAlt="Sunset"
        prompt="Golden sunset"
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    for (const label of [
      "studioZoomOut",
      "studioZoomIn",
      "studioZoomReset",
      "imageCopyUrl",
      "studioDownload",
      "close",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    // Backdrop click on Dialog.Content closes
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape closes via Radix Dialog
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
