"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Image as ImageIcon,
  Download,
  Sparkles,
  Trash2,
  Loader2,
  Calendar,
  Filter,
  GitCompare,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useConversation, FrontendConversation } from "../../chat/hooks/useConversation";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/utils/logger";
import { formatDateShort } from "@/lib/utils/dateFormat";
import ImageCompareModal from "./ImageCompareModal";

interface GalleryImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  aspectRatio?: string;
  style?: string;
  model?: string;
}

type DateFilter = "all" | "today" | "week" | "month";

export function GalleryView() {
  const { theme: _theme } = useTheme();
  const { t, language } = useLanguage();
  const router = useRouter();

  // Fetch main chat conversations for the Sidebar
  const { conversations } = useConversation();

  // Filter out Image Studio projects (Keep Main Chat only)
  const mainChats = (conversations || []).filter(
    (c: FrontendConversation) => c.model !== "vikini-image-studio"
  );

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter State
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  // Delete State
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sidebar State
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Compare Mode State
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<[GalleryImage | null, GalleryImage | null]>([
    null,
    null,
  ]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Infinite Scroll State
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 20;

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
        const res = await fetch(`/api/gallery?limit=${PAGE_SIZE}&offset=${currentOffset}`);
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
    [offset]
  );

  // Initial load
  useEffect(() => {
    fetchImages(false);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchImages(true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchImages]);

  // Extract unique models for filter dropdown
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

    // Search filter
    if (searchQuery) {
      result = result.filter((img) => img.prompt.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Date filter
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

    // Model filter
    if (modelFilter !== "all") {
      result = result.filter((img) => img.model === modelFilter);
    }

    return result;
  }, [images, searchQuery, dateFilter, modelFilter]);

  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  // Compare Mode Handlers
  const handleToggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    setCompareImages([null, null]);
  }, []);

  const handleToggleCompareImage = useCallback((img: GalleryImage) => {
    setCompareImages((prev) => {
      // If image already selected, remove it
      if (prev[0]?.id === img.id) return [null, prev[1]];
      if (prev[1]?.id === img.id) return [prev[0], null];

      // Add to first empty slot
      if (!prev[0]) return [img, prev[1]];
      if (!prev[1]) return [prev[0], img];

      // Both slots full, replace second
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

  // Navigation handlers for modal
  const currentImageIndex = useMemo(() => {
    if (!selectedImage) return -1;
    return filteredImages.findIndex((img) => img.id === selectedImage.id);
  }, [selectedImage, filteredImages]);

  const handlePrevImage = useCallback(() => {
    if (currentImageIndex > 0) {
      setSelectedImage(filteredImages[currentImageIndex - 1]);
      setShowDeleteConfirm(false);
    }
  }, [currentImageIndex, filteredImages]);

  const handleNextImage = useCallback(() => {
    if (currentImageIndex < filteredImages.length - 1) {
      setSelectedImage(filteredImages[currentImageIndex + 1]);
      setShowDeleteConfirm(false);
    }
  }, [currentImageIndex, filteredImages]);

  // Keyboard navigation for modal
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

  // Remix Handler
  const handleRemix = (prompt: string) => {
    // Store prompt and image mode flag in sessionStorage for ChatApp to read
    sessionStorage.setItem("remixPrompt", prompt);
    sessionStorage.setItem("remixImageMode", "true");
    // Navigate with mode=remix to force chat input display
    router.push("/?mode=remix");
  };

  // Delete Handler
  const handleDelete = async (imageId: string) => {
    setDeleting(imageId);
    try {
      const res = await fetch(`/api/gallery/${imageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Remove from local state
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        setSelectedImage(null);
        setShowDeleteConfirm(false);
      } else {
        const json = await res.json();
        logger.error("Delete failed:", json.error?.message || json.error);
      }
    } catch (error) {
      logger.error("Delete error:", error);
    } finally {
      setDeleting(null);
    }
  };

  const dateFilterOptions: { value: DateFilter; labelKey: string }[] = [
    { value: "all", labelKey: "galleryAllTime" },
    { value: "today", labelKey: "galleryToday" },
    { value: "week", labelKey: "galleryThisWeek" },
    { value: "month", labelKey: "galleryThisMonth" },
  ];

  return (
    <div className="h-screen w-screen text-(--text-primary) overflow-hidden relative font-sans bg-(--surface-base) flex">
      <Sidebar
        conversations={mainChats}
        allConversations={conversations || []}
        onSelectConversation={(id) => router.push(`/?id=${id}`)}
        onNewChat={() => router.push("/")}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        t={t as unknown as Record<string, string>}
      />

      <FloatingMenuTrigger onClick={() => setMobileOpen(true)} />

      <div
        className={`flex-1 flex flex-col h-full transition-all duration-300 relative z-10 ${sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"}`}
      >
        <HeaderBar
          t={{}}
          language="en"
          onLanguageChange={() => {}}
          onToggleSidebar={() => setMobileOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Hero / Header */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight">{t("galleryTitle")}</h1>
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-xl">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-secondary)" />
                  <input
                    type="text"
                    placeholder={t("gallerySearch")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-(--surface-muted) border border-(--control-border) focus:ring-2 focus:ring-(--accent) focus:outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  {/* Date Filter */}
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-secondary) pointer-events-none" />
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                      className="pl-9 pr-8 py-2.5 rounded-xl bg-(--surface-muted) border border-(--control-border) focus:ring-2 focus:ring-(--accent) focus:outline-none appearance-none cursor-pointer text-sm"
                    >
                      {dateFilterOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Filter */}
                  {availableModels.length > 0 && (
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-secondary) pointer-events-none" />
                      <select
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        className="pl-9 pr-8 py-2.5 rounded-xl bg-(--surface-muted) border border-(--control-border) focus:ring-2 focus:ring-(--accent) focus:outline-none appearance-none cursor-pointer text-sm"
                      >
                        <option value="all">{t("galleryAllModels")}</option>
                        {availableModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Results Count + Compare Button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-(--text-secondary)">
                {t("galleryYourCreations")}
                {!loading && (
                  <span className="ml-2 text-sm font-normal">({filteredImages.length} images)</span>
                )}
              </h2>

              {/* Compare Mode Toggle */}
              <div className="flex items-center gap-2">
                {compareMode && (
                  <>
                    <span className="text-sm text-(--text-secondary)">
                      {[compareImages[0], compareImages[1]].filter(Boolean).length}/2{" "}
                      {t("compareSelected") || "selected"}
                    </span>
                    {compareImages[0] && compareImages[1] && (
                      <button
                        onClick={handleOpenCompare}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--accent) text-white font-bold shadow-lg shadow-(--accent)/20 hover:opacity-90 transition-all"
                      >
                        <GitCompare className="w-4 h-4" />
                        {t("compareNow") || "Compare"}
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={handleToggleCompareMode}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    compareMode
                      ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                      : "bg-(--surface-muted) border border-(--control-border) hover:bg-(--surface-hover)"
                  }`}
                >
                  {compareMode ? (
                    <>
                      <X className="w-4 h-4" />
                      {t("cancel") || "Cancel"}
                    </>
                  ) : (
                    <>
                      <GitCompare className="w-4 h-4" />
                      {t("compareImages") || "Compare"}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-(--accent)" />
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-(--text-secondary)">
                <ImageIcon className="w-16 h-16 opacity-20" />
                <p>{t("galleryNoImages")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredImages.map((img) => {
                  const isSelectedForCompare = isImageSelectedForCompare(img.id);
                  return (
                    <div
                      key={img.id}
                      onClick={() => {
                        if (compareMode) {
                          handleToggleCompareImage(img);
                        } else {
                          setSelectedImage(img);
                        }
                      }}
                      className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-(--surface-muted) border-2 transition-all ${
                        isSelectedForCompare
                          ? "border-purple-500 ring-2 ring-purple-500/30"
                          : "border-(--border) hover:border-(--accent)"
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.prompt}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        unoptimized
                      />

                      {/* Compare Mode Selection Indicator */}
                      {compareMode && (
                        <div
                          className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isSelectedForCompare
                              ? "bg-purple-500 text-white"
                              : "bg-black/50 text-white/70 border border-white/30"
                          }`}
                        >
                          {isSelectedForCompare ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold">
                              {compareImages[0] === null
                                ? "1"
                                : compareImages[1] === null
                                  ? "2"
                                  : ""}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                        <p className="text-white text-xs line-clamp-2 font-medium">{img.prompt}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Infinite scroll trigger */}
            {!loading && hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                {loadingMore ? (
                  <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
                ) : (
                  <p className="text-sm text-(--text-secondary)">Scroll to load more...</p>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Modal Detail View */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setSelectedImage(null)}
          >
            {/* Image Counter - Top center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-white/80 text-sm font-medium border border-white/10">
              {currentImageIndex + 1} / {filteredImages.length}
            </div>

            <div
              className="bg-(--surface-base) rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col lg:flex-row shadow-2xl border border-(--border)"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Area with hover navigation */}
              <div className="flex-1 relative bg-black flex items-center justify-center min-h-[400px] lg:min-h-[600px] group">
                <div className="relative w-full h-full p-6">
                  <Image
                    src={selectedImage.url}
                    alt={selectedImage.prompt}
                    fill
                    className="object-contain"
                    unoptimized
                    priority
                  />
                </div>

                {/* Previous Arrow - Inside image, visible on hover */}
                {currentImageIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-sm border border-white/20 transition-all shadow-lg opacity-0 group-hover:opacity-100"
                    title={t("galleryPrev") || "Previous"}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                {/* Next Arrow - Inside image, visible on hover */}
                {currentImageIndex < filteredImages.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-sm border border-white/20 transition-all shadow-lg opacity-0 group-hover:opacity-100"
                    title={t("galleryNext") || "Next"}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
              {/* Details Sidebar - Slightly narrower */}
              <div className="w-full lg:w-80 p-6 flex flex-col border-l border-(--border) bg-(--surface-base) max-h-[95vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">{t("galleryImageDetails")}</h3>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="p-2 hover:bg-(--surface-muted) rounded-full"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-(--text-secondary) uppercase">
                      {t("galleryPrompt")}
                    </label>
                    <p className="text-sm leading-relaxed p-3 rounded-lg bg-(--surface-muted) border border-(--border)">
                      {selectedImage.prompt}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-(--text-secondary) uppercase">
                        {t("galleryModel")}
                      </label>
                      <p className="text-sm">{selectedImage.model || "Unknown"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-(--text-secondary) uppercase">
                        {t("galleryDate")}
                      </label>
                      <p className="text-sm">
                        {formatDateShort(
                          selectedImage.createdAt,
                          language === "vi" ? "vi-VN" : "en-US"
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-(--text-secondary) uppercase">
                        {t("galleryRatio")}
                      </label>
                      <p className="text-sm">{selectedImage.aspectRatio || "1:1"}</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-6 border-t border-(--border) space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => window.open(selectedImage.url, "_blank")}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" /> {t("studioDownload")}
                    </button>
                    <button
                      onClick={() => handleRemix(selectedImage.prompt)}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--accent) text-white hover:opacity-90 font-bold shadow-lg shadow-(--accent)/20 transition-all"
                    >
                      <Sparkles className="w-4 h-4" /> {t("galleryRemix")}
                    </button>
                  </div>

                  {/* Delete Button */}
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-red-500 hover:bg-red-500/10 border border-red-500/30 font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> {t("galleryDeleteImage")}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) font-medium transition-colors"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        onClick={() => handleDelete(selectedImage.id)}
                        disabled={deleting === selectedImage.id}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 font-bold transition-colors disabled:opacity-50"
                      >
                        {deleting === selectedImage.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>{t("galleryConfirmDelete")}</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Compare Modal */}
        <ImageCompareModal
          isOpen={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          leftImage={compareImages[0]}
          rightImage={compareImages[1]}
          onSwap={handleSwapCompareImages}
        />
      </div>
    </div>
  );
}
