"use client";

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
  Heart,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import Image from "next/image";
import AppFrame from "../../layout/components/AppFrame";
import { useTheme } from "../../chat/hooks/useTheme";
import { ImageSectionHeader } from "../../image-gen/components/ImageSectionHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateShort } from "@/lib/utils/dateFormat";
import { openSafeExternalUrl } from "@/lib/utils/xssProtection";
import ImageCompareModal from "./ImageCompareModal";

import {
  useGalleryController,
  DATE_FILTER_OPTIONS,
  type DateFilter,
} from "./hooks/useGalleryController";

export function GalleryView() {
  const { theme: _theme } = useTheme();
  const g = useGalleryController();
  // M3: a library with no images at all only shows the empty state (filters are noise).
  const isEmptyLibrary = !g.loading && !g.error && g.images.length === 0;

  return (
    <AppFrame>
      <ImageSectionHeader />
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {!isEmptyLibrary && (
            <>
              {/* Search + filters */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1 max-w-xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--muted)" />
                    <input
                      type="text"
                      placeholder={g.t("gallerySearch")}
                      className="w-full h-10 pl-10 pr-4 rounded-xl bg-(--raised) border border-(--line) focus:ring-2 focus:ring-(--accent) focus:outline-none transition-colors"
                      value={g.searchQuery}
                      onChange={(e) => g.setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex gap-2 flex-wrap">
                    {/* Date Filter */}
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--muted) pointer-events-none" />
                      <select
                        aria-label={g.t("galleryDateFilter")}
                        value={g.dateFilter}
                        onChange={(e) => g.setDateFilter(e.target.value as DateFilter)}
                        className="h-10 pl-9 pr-8 rounded-xl bg-(--raised) border border-(--line) focus:ring-2 focus:ring-(--accent) focus:outline-none appearance-none cursor-pointer text-sm"
                      >
                        {DATE_FILTER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {g.t(opt.labelKey)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Model Filter */}
                    {g.availableModels.length > 0 && (
                      <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--muted) pointer-events-none" />
                        <select
                          aria-label={g.t("galleryModelFilter")}
                          value={g.modelFilter}
                          onChange={(e) => g.setModelFilter(e.target.value)}
                          className="h-10 pl-9 pr-8 rounded-xl bg-(--raised) border border-(--line) focus:ring-2 focus:ring-(--accent) focus:outline-none appearance-none cursor-pointer text-sm"
                        >
                          <option value="all">{g.t("galleryAllModels")}</option>
                          {g.availableModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Favorites Toggle */}
                    <button
                      type="button"
                      aria-pressed={g.showFavoritesOnly}
                      onClick={() => g.setShowFavoritesOnly(!g.showFavoritesOnly)}
                      className={`flex h-10 items-center gap-1.5 px-3 rounded-xl border text-sm font-medium transition-colors ${
                        g.showFavoritesOnly
                          ? "bg-(--soft) border-(--accent) text-(--accent)"
                          : "bg-(--raised) border-(--line) text-(--muted) hover:text-(--text)"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${g.showFavoritesOnly ? "fill-current" : ""}`} />
                      {g.t("galleryFavorites") || "Favorites"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Results Count + Compare Button */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-(--muted) min-w-0">
                  {g.t("galleryYourCreations")}
                  {!g.loading && (
                    <span className="ml-2 text-sm font-normal whitespace-nowrap">
                      ({g.filteredImages.length} {g.t("galleryImagesCount")})
                    </span>
                  )}
                </h2>

                <div className="flex items-center gap-2 shrink-0">
                  {g.compareMode && (
                    <>
                      <span className="text-sm text-(--muted) whitespace-nowrap">
                        {[g.compareImages[0], g.compareImages[1]].filter(Boolean).length}/2{" "}
                        {g.t("compareSelected") || "selected"}
                      </span>
                      {g.compareImages[0] && g.compareImages[1] && (
                        <button
                          type="button"
                          onClick={g.handleOpenCompare}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--accent) text-(--on-accent) font-bold whitespace-nowrap shrink-0 shadow-sm hover:brightness-110 transition-[filter,transform] active:scale-[0.97]"
                        >
                          <GitCompare className="w-4 h-4 shrink-0" />
                          {g.t("compareNow") || "Compare"}
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={g.handleToggleCompareMode}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors ${
                      g.compareMode
                        ? "bg-(--danger)/10 text-(--danger) border border-(--danger)/30 hover:bg-(--danger)/15"
                        : "bg-(--raised) border border-(--line) hover:bg-(--raised-hover)"
                    }`}
                  >
                    {g.compareMode ? (
                      <>
                        <X className="w-4 h-4" />
                        {g.t("cancel") || "Cancel"}
                      </>
                    ) : (
                      <>
                        <GitCompare className="w-4 h-4" />
                        {g.t("compareImages") || "Compare"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Grid */}
          {g.loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-xl" />
              ))}
            </div>
          ) : g.error && g.images.length === 0 ? (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-(--danger)/30 bg-(--danger)/10 px-6 py-12 text-center"
            >
              <AlertCircle aria-hidden="true" className="w-8 h-8 text-(--danger)" />
              <p className="text-sm font-medium text-(--text)">{g.error}</p>
              <button
                type="button"
                onClick={g.retryLoad}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-10 rounded-xl bg-(--raised) hover:bg-(--raised-hover) border border-(--line) text-sm font-medium text-(--text) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <RotateCcw aria-hidden="true" className="w-4 h-4" />
                {g.t("tryAgain")}
              </button>
            </div>
          ) : g.filteredImages.length === 0 ? (
            <EmptyState
              icon={<ImageIcon className="w-6 h-6" />}
              title={g.t("galleryNoImages")}
              action={
                g.images.length === 0
                  ? { label: g.t("galleryEmptyAction"), href: "/images" }
                  : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {g.filteredImages.map((img) => {
                const isSelectedForCompare = g.isImageSelectedForCompare(img.id);
                return (
                  <button
                    key={img.id}
                    type="button"
                    aria-label={img.prompt}
                    aria-pressed={g.compareMode ? isSelectedForCompare : undefined}
                    onClick={() => {
                      if (g.compareMode) {
                        g.handleToggleCompareImage(img);
                      } else {
                        g.setSelectedImage(img);
                      }
                    }}
                    className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-(--raised) border-2 p-0 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${
                      isSelectedForCompare
                        ? "border-(--accent) ring-2 ring-(--accent)/30"
                        : "border-(--line) hover:border-(--accent)"
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                      unoptimized
                    />

                    {/* Compare Mode Selection Indicator */}
                    {g.compareMode && (
                      <div
                        aria-hidden="true"
                        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                          isSelectedForCompare
                            ? "bg-(--accent) text-(--on-accent)"
                            : "bg-(--overlay) text-(--on-overlay)/70 border border-(--on-overlay)/30"
                        }`}
                      >
                        {isSelectedForCompare ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="text-xs font-bold">
                            {g.compareImages[0] === null
                              ? "1"
                              : g.compareImages[1] === null
                                ? "2"
                                : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-(--overlay) via-transparent to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                      <p className="text-(--on-overlay) text-xs line-clamp-2 font-medium">
                        {img.prompt}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Infinite scroll trigger */}
          {!g.loading && g.hasMore && g.filteredImages.length > 0 && (
            <div ref={g.loadMoreRef} className="flex justify-center py-8">
              {g.loadingMore ? (
                <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
              ) : (
                <p className="text-sm text-(--muted)">{g.t("galleryScrollForMore")}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail View */}
      <Dialog open={!!g.selectedImage} onOpenChange={(open) => !open && g.setSelectedImage(null)}>
        <DialogContent
          hideCloseButton
          aria-describedby={undefined}
          className="max-w-7xl w-full max-h-[95vh] p-0 gap-0 overflow-hidden border-(--line)"
        >
          <DialogTitle className="sr-only">{g.t("galleryImageDetails")}</DialogTitle>

          {g.selectedImage && (
            <>
              {/* Image Counter */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-(--overlay) backdrop-blur-sm rounded-full text-(--on-overlay)/80 text-sm font-medium border border-(--on-overlay)/10">
                {g.currentImageIndex + 1} / {g.filteredImages.length}
              </div>

              {/* Floating Mobile Close Button */}
              <div className="absolute top-3 right-3 z-20 lg:hidden">
                <button
                  type="button"
                  onClick={() => g.setSelectedImage(null)}
                  aria-label={g.t("closeImageDetails") || "Close image details"}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-(--overlay) backdrop-blur-md text-(--on-overlay)/90 hover:text-(--on-overlay) border border-(--on-overlay)/20 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) transition-colors cursor-pointer"
                >
                  <X aria-hidden="true" className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row w-full max-h-[95vh] overflow-hidden">
                {/* Image Area */}
                <div className="flex-1 relative bg-(--overlay) flex items-center justify-center min-h-[400px] lg:min-h-[600px] group">
                  <div className="relative w-full h-full p-6">
                    <Image
                      src={g.selectedImage.url}
                      alt={g.selectedImage.prompt}
                      fill
                      className="object-contain"
                      unoptimized
                      priority
                    />
                  </div>

                  {/* Previous Arrow */}
                  {g.currentImageIndex > 0 && (
                    <button
                      type="button"
                      aria-label={g.t("previousImage")}
                      onClick={(e) => {
                        e.stopPropagation();
                        g.handlePrevImage();
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-(--overlay) hover:brightness-110 text-(--on-overlay)/80 hover:text-(--on-overlay) backdrop-blur-sm border border-(--on-overlay)/20 transition-[opacity,filter,color] shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) cursor-pointer"
                      title={g.t("previousImage")}
                    >
                      <ChevronLeft aria-hidden="true" className="w-6 h-6" />
                    </button>
                  )}

                  {/* Next Arrow */}
                  {g.currentImageIndex < g.filteredImages.length - 1 && (
                    <button
                      type="button"
                      aria-label={g.t("nextImage")}
                      onClick={(e) => {
                        e.stopPropagation();
                        g.handleNextImage();
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-(--overlay) hover:brightness-110 text-(--on-overlay)/80 hover:text-(--on-overlay) backdrop-blur-sm border border-(--on-overlay)/20 transition-[opacity,filter,color] shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) cursor-pointer"
                      title={g.t("nextImage")}
                    >
                      <ChevronRight aria-hidden="true" className="w-6 h-6" />
                    </button>
                  )}
                </div>

                {/* Details Sidebar */}
                <div className="w-full lg:w-80 p-6 flex flex-col border-l border-(--line) bg-(--surface) max-h-[95vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">{g.t("galleryImageDetails")}</h3>
                    <button
                      type="button"
                      onClick={() => g.setSelectedImage(null)}
                      aria-label={g.t("closeImageDetails") || "Close image details"}
                      className="p-2 hover:bg-(--raised-hover) rounded-full text-(--muted) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) transition-colors cursor-pointer"
                    >
                      <X aria-hidden="true" className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-6 overflow-y-auto">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-(--muted)">
                        {g.t("galleryPrompt")}
                      </label>
                      <p className="text-sm leading-relaxed p-3 rounded-lg bg-(--raised) border border-(--line)">
                        {g.selectedImage.prompt}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-(--muted)">
                          {g.t("galleryModel")}
                        </label>
                        <p className="text-sm">{g.selectedImage.model || "Unknown"}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-(--muted)">
                          {g.t("galleryDate")}
                        </label>
                        <p className="text-sm">
                          {formatDateShort(
                            g.selectedImage.createdAt,
                            g.language === "vi" ? "vi-VN" : "en-US"
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-(--muted)">
                          {g.t("galleryRatio")}
                        </label>
                        <p className="text-sm">{g.selectedImage.aspectRatio || "1:1"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-6 border-t border-(--line) space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => openSafeExternalUrl(g.selectedImage!.url)}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--raised) hover:bg-(--raised-hover) border border-(--line) font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <Download aria-hidden="true" className="w-4 h-4" /> {g.t("studioDownload")}
                      </button>
                      <button
                        type="button"
                        onClick={() => g.handleRemix(g.selectedImage!.prompt)}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--accent) text-(--on-accent) hover:opacity-90 font-bold shadow-lg shadow-(--accent)/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <Sparkles aria-hidden="true" className="w-4 h-4" /> {g.t("galleryRemix")}
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => g.handleDelete(g.selectedImage!.id)}
                      disabled={g.deleting === g.selectedImage.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-(--danger) hover:bg-(--danger)/10 border border-(--danger)/30 font-medium transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    >
                      {g.deleting === g.selectedImage.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" /> {g.t("galleryDeleteImage")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Compare Modal */}
      <ImageCompareModal
        isOpen={g.showCompareModal}
        onClose={() => g.setShowCompareModal(false)}
        leftImage={g.compareImages[0]}
        rightImage={g.compareImages[1]}
        onSwap={g.handleSwapCompareImages}
      />
    </AppFrame>
  );
}
