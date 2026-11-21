// Gallery controller hook — state + handlers for GalleryView
// Extracted from GalleryView.tsx for modularity

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { logger } from "@/lib/utils/logger";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import {
  DATE_FILTER_OPTIONS,
  extractAvailableModels,
  filterGalleryImages,
  toggleCompareImageSlot,
  type DateFilter,
  type GalleryImage,
} from "@/lib/features/gallery/galleryFilters";
import { useGalleryPagination } from "./useGalleryPagination";

export { DATE_FILTER_OPTIONS };
export type { DateFilter, GalleryImage };

export function useGalleryController() {
  const { t, language } = useLanguage();
  const router = useRouter();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Pagination & fetch lifecycle
  const { images, setImages, loading, error, retryLoad, hasMore, loadingMore, loadMoreRef } =
    useGalleryPagination(showFavoritesOnly, t);

  // Delete & Compare & Image detail
  const [deleting, setDeleting] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<[GalleryImage | null, GalleryImage | null]>([
    null,
    null,
  ]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  const availableModels = useMemo(() => extractAvailableModels(images), [images]);
  const filteredImages = useMemo(
    () => filterGalleryImages(images, { searchQuery, dateFilter, modelFilter }),
    [images, searchQuery, dateFilter, modelFilter]
  );

  // Compare handlers
  const handleToggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    setCompareImages([null, null]);
  }, []);

  const handleToggleCompareImage = useCallback((img: GalleryImage) => {
    setCompareImages((prev) => toggleCompareImageSlot(prev, img));
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

  // Lightbox navigation
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

  const handleRemix = useCallback(
    (prompt: string) => {
      sessionStorage.setItem("remixPrompt", prompt);
      sessionStorage.setItem("remixImageMode", "true");
      router.push("/?mode=remix");
    },
    [router]
  );

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
          toast.error(t("galleryDeleteFailed"));
        }
      } catch (err: unknown) {
        logger.error("Delete error:", err);
        toast.error(t("galleryDeleteFailed"));
      } finally {
        setDeleting(null);
      }
    },
    [setImages, t]
  );

  return {
    t,
    language,
    router,
    images,
    loading,
    error,
    retryLoad,
    searchQuery,
    setSearchQuery,
    filteredImages,
    availableModels,
    dateFilter,
    setDateFilter,
    modelFilter,
    setModelFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    deleting,
    compareMode,
    compareImages,
    showCompareModal,
    setShowCompareModal,
    handleToggleCompareMode,
    handleToggleCompareImage,
    handleOpenCompare,
    handleSwapCompareImages,
    isImageSelectedForCompare,
    selectedImage,
    setSelectedImage,
    currentImageIndex,
    handlePrevImage,
    handleNextImage,
    hasMore,
    loadingMore,
    loadMoreRef,
    handleRemix,
    handleDelete,
  };
}
