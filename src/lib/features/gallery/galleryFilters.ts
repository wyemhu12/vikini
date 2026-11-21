export interface GalleryImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  aspectRatio?: string;
  style?: string;
  model?: string;
}

export type DateFilter = "all" | "today" | "week" | "month";

export const DATE_FILTER_OPTIONS: { value: DateFilter; labelKey: string }[] = [
  { value: "all", labelKey: "galleryAllTime" },
  { value: "today", labelKey: "galleryToday" },
  { value: "week", labelKey: "galleryThisWeek" },
  { value: "month", labelKey: "galleryThisMonth" },
];

export function extractAvailableModels(images: readonly GalleryImage[]): string[] {
  const models = new Set<string>();
  for (const img of images) {
    if (img.model) models.add(img.model);
  }
  return Array.from(models);
}

export function filterGalleryImages(
  images: readonly GalleryImage[],
  options: {
    searchQuery: string;
    dateFilter: DateFilter;
    modelFilter: string;
    now?: Date;
  }
): GalleryImage[] {
  const { searchQuery, dateFilter, modelFilter, now = new Date() } = options;
  let result = [...images];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter((img) => img.prompt.toLowerCase().includes(q));
  }

  if (dateFilter !== "all") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(startOfDay);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(startOfDay);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    result = result.filter((img) => {
      const imgTime = Date.parse(img.createdAt);
      if (!Number.isFinite(imgTime)) return false;
      const imgDate = new Date(imgTime);
      switch (dateFilter) {
        case "today":
          return imgDate >= startOfDay;
        case "week":
          return imgDate >= weekAgo;
        case "month":
          return imgDate >= monthAgo;
        default:
          return true;
      }
    });
  }

  if (modelFilter !== "all") {
    result = result.filter((img) => img.model === modelFilter);
  }

  return result;
}

export function toggleCompareImageSlot(
  prev: [GalleryImage | null, GalleryImage | null],
  img: GalleryImage
): [GalleryImage | null, GalleryImage | null] {
  if (prev[0]?.id === img.id) return [null, prev[1]];
  if (prev[1]?.id === img.id) return [prev[0], null];
  if (!prev[0]) return [img, prev[1]];
  if (!prev[1]) return [prev[0], img];
  return [prev[0], img];
}
