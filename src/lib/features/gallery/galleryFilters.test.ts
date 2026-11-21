import { describe, it, expect } from "vitest";
import {
  extractAvailableModels,
  filterGalleryImages,
  toggleCompareImageSlot,
  type GalleryImage,
} from "./galleryFilters";

const NOW = new Date("2026-11-21T15:00:00.000Z");

const IMAGES: GalleryImage[] = [
  {
    id: "img-today",
    url: "https://example.com/1.png",
    prompt: "Golden sunset over Saigon",
    createdAt: "2026-11-21T08:00:00.000Z",
    model: "gemini-3.1-flash-image",
  },
  {
    id: "img-week",
    url: "https://example.com/2.png",
    prompt: "Misty moss forest",
    createdAt: "2026-11-18T08:00:00.000Z",
    model: "imagen-4",
  },
  {
    id: "img-month",
    url: "https://example.com/3.png",
    prompt: "Retro cyber café",
    createdAt: "2026-11-01T08:00:00.000Z",
    model: "imagen-4",
  },
  {
    id: "img-old",
    url: "https://example.com/4.png",
    prompt: "Ancient lantern",
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "img-invalid-date",
    url: "https://example.com/5.png",
    prompt: "Corrupted timestamp entry",
    createdAt: "invalid-iso",
  },
];

describe("galleryFilters (CT-6C-02)", () => {
  it("extracts unique defined models", () => {
    expect(extractAvailableModels(IMAGES)).toEqual(["gemini-3.1-flash-image", "imagen-4"]);
    expect(extractAvailableModels([])).toEqual([]);
  });

  it("filters by searchQuery, dateFilter (today/week/month), invalid dates, and modelFilter", () => {
    expect(
      filterGalleryImages(IMAGES, {
        searchQuery: "saigon",
        dateFilter: "all",
        modelFilter: "all",
        now: NOW,
      }).map((i) => i.id)
    ).toEqual(["img-today"]);

    expect(
      filterGalleryImages(IMAGES, {
        searchQuery: "",
        dateFilter: "today",
        modelFilter: "all",
        now: NOW,
      }).map((i) => i.id)
    ).toEqual(["img-today"]);

    expect(
      filterGalleryImages(IMAGES, {
        searchQuery: "",
        dateFilter: "week",
        modelFilter: "all",
        now: NOW,
      }).map((i) => i.id)
    ).toEqual(["img-today", "img-week"]);

    expect(
      filterGalleryImages(IMAGES, {
        searchQuery: "",
        dateFilter: "month",
        modelFilter: "imagen-4",
        now: NOW,
      }).map((i) => i.id)
    ).toEqual(["img-week", "img-month"]);
  });

  it("toggles compare image slots without duplicates and caps at 2 slots", () => {
    const a = IMAGES[0];
    const b = IMAGES[1];
    const c = IMAGES[2];

    const s1 = toggleCompareImageSlot([null, null], a);
    expect(s1).toEqual([a, null]);

    const s2 = toggleCompareImageSlot(s1, b);
    expect(s2).toEqual([a, b]);

    // Replacing 2nd slot when both filled
    const s3 = toggleCompareImageSlot(s2, c);
    expect(s3).toEqual([a, c]);

    // Deselecting slot 0 and slot 1
    expect(toggleCompareImageSlot(s3, a)).toEqual([null, c]);
    expect(toggleCompareImageSlot(s3, c)).toEqual([a, null]);
  });
});
