// Gallery controller hook — state + handlers for GalleryView
// Extracted from GalleryView.tsx for modularity

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { useConversation, type FrontendConversation } from "../../../chat/hooks/useConversation";
import { logger } from "@/lib/utils/logger";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";

interface GalleryImage {
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

export type { GalleryImage };

export function useGalleryController() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const { conversations } = useConversation();

  // Filter out non-chat conversations for sidebar
  const mainChats = useMemo(
    () =>
      (conversations || []).filter(
        (c: FrontendConversation) =>
          c.model !== "vikini-image-studio" && c.model !== "user_templates_store"
      ),
    [conversations]
  );

  // Data
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  // Sidebar
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Compare
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<[GalleryImage | null, GalleryImage | null]>([
    null,
    null,
  ]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Image detail
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  // Infinite scroll
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 20;

  // Fetch images
  const fetchImages = useCallback(
    async (isLoadMore = false) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setOffset(0);
      }

      const currentOffset = isLoadMore ? offset : 0;

      try {
        const favParam = showFavoritesOnly ? `&favorites=true` : "";
        const res = await fetch(
          `/api/gallery?limit=${PAGE_SIZE}&offset=${currentOffset}${favParam}`
        );
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          const newImages = data.images || [];

          if (isLoadMore) {
            setImages((prev) => [...prev, ...newImages]);
          } else {
            setImages(newImages);
          }

          setHasMore(data.hasMore || false);
          setOffset(currentOffset + newImages.length);
        }
      } catch (error) {
        logger.error("Failed to load gallery:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [offset, showFavoritesOnly]
  );

  // Initial load
  useEffect(() => {
    void fetchImages(false);
  }, [showFavoritesOnly]); // Refetch when favorites toggle changes

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          void fetchImages(true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchImages]);

  // Unique models for filter
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    images.forEach((img) => {
      if (img.model) models.add(img.model);
    });
    return Array.from(models);
  }, [images]);

  // Apply filters
  const filteredImages = useMemo(() => {
    let result = images;

    if (searchQuery) {
      result = result.filter((img) => img.prompt.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter((img) => {
        const imgDate = new Date(img.createdAt);
        const weekAgo = new Date(startOfDay);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(startOfDay);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

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
  }, [images, searchQuery, dateFilter, modelFilter]);

  // Compare handlers
  const handleToggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    setCompareImages([null, null]);
  }, []);

  const handleToggleCompareImage = useCallback((img: GalleryImage) => {
    setCompareImages((prev) => {
      if (prev[0]?.id === img.id) return [null, prev[1]];
      if (prev[1]?.id === img.id) return [prev[0], null];
      if (!prev[0]) return [img, prev[1]];
      if (!prev[1]) return [prev[0], img];
      return [prev[0], img];
    });
  }, []);

  const handleOpenCompare = useCallback(() => {
    if (compareImages[0] && compareImages[1]) {
      setShowCompareModal(true);
    }
  }, [compareImages]);

  const handleSwapCompareImages = useCallback(() => {
    setCompareImages((prev) => [prev[1], prev[0]]);
  }, []);

  const isImageSelectedForCompare = useCallback(
    (imgId: string) => compareImages[0]?.id === imgId || compareImages[1]?.id === imgId,
    [compareImages]
  );

  // Navigation
  const currentImageIndex = useMemo(() => {
    if (!selectedImage) return -1;
    return filteredImages.findIndex((img) => img.id === selectedImage.id);
  }, [selectedImage, filteredImages]);

  const handlePrevImage = useCallback(() => {
    if (currentImageIndex > 0) setSelectedImage(filteredImages[currentImageIndex - 1]);
  }, [currentImageIndex, filteredImages]);

  const handleNextImage = useCallback(() => {
    if (currentImageIndex < filteredImages.length - 1) {
      setSelectedImage(filteredImages[currentImageIndex + 1]);
    }
  }, [currentImageIndex, filteredImages]);

  // Keyboard navigation
  useEffect(() => {
    if (!selectedImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextImage();
      } else if (e.key === "Escape") {
        setSelectedImage(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, handlePrevImage, handleNextImage]);

  // Remix
  const handleRemix = useCallback(
    (prompt: string) => {
      sessionStorage.setItem("remixPrompt", prompt);
      sessionStorage.setItem("remixImageMode", "true");
      router.push("/?mode=remix");
    },
    [router]
  );

  // Delete
  const handleDelete = useCallback(
    async (imageId: string) => {
      const ok = await confirm({
        title: t("galleryDeleteImage"),
        variant: "danger",
        confirmLabel: t("galleryConfirmDelete"),
        cancelLabel: t("cancel"),
      });
      if (!ok) return;

      setDeleting(imageId);
      try {
        const res = await fetch(`/api/gallery/${imageId}`, { method: "DELETE" });
        if (res.ok) {
          setImages((prev) => prev.filter((img) => img.id !== imageId));
          setSelectedImage(null);
        } else {
          const json = await res.json();
          logger.error("Delete failed:", json.error?.message || json.error);
          toast.error("Failed to delete image");
        }
      } catch (error) {
        logger.error("Delete error:", error);
        toast.error("Failed to delete image");
      } finally {
        setDeleting(null);
      }
    },
    [t]
  );

  return {
    t,
    language,
    router,
    conversations,
    mainChats,
    // Data
    images,
    loading,
    searchQuery,
    setSearchQuery,
    filteredImages,
    availableModels,
    // Filters
    dateFilter,
    setDateFilter,
    modelFilter,
    setModelFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    // Delete
    deleting,
    // Sidebar
    mobileOpen,
    setMobileOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    // Compare
    compareMode,
    compareImages,
    showCompareModal,
    setShowCompareModal,
    handleToggleCompareMode,
    handleToggleCompareImage,
    handleOpenCompare,
    handleSwapCompareImages,
    isImageSelectedForCompare,
    // Image detail
    selectedImage,
    setSelectedImage,
    currentImageIndex,
    handlePrevImage,
    handleNextImage,
    // Infinite scroll
    hasMore,
    loadingMore,
    loadMoreRef,
    // Actions
    handleRemix,
    handleDelete,
  };
}
