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
} from "lucide-react";
import Image from "next/image";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import { useTheme } from "../../chat/hooks/useTheme";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDateShort } from "@/lib/utils/dateFormat";
import ImageCompareModal from "./ImageCompareModal";

import {
  useGalleryController,
  DATE_FILTER_OPTIONS,
  type DateFilter,
} from "./hooks/useGalleryController";

export function GalleryView() {
  const { theme: _theme } = useTheme();
  const g = useGalleryController();

  return (
    <div className="h-screen w-screen text-(--text-primary) overflow-hidden relative font-sans bg-(--surface-base) flex">
      <Sidebar
        conversations={g.mainChats}
        allConversations={g.conversations || []}
        onSelectConversation={(id) => g.router.push(`/?id=${id}`)}
        onNewChat={() => g.router.push("/")}
        collapsed={g.sidebarCollapsed}
        onToggleCollapse={() => g.setSidebarCollapsed(!g.sidebarCollapsed)}
        mobileOpen={g.mobileOpen}
        onCloseMobile={() => g.setMobileOpen(false)}
        t={g.t as unknown as Record<string, string>}
      />

      <FloatingMenuTrigger onClick={() => g.setMobileOpen(true)} />

      <div
        className={`flex-1 flex flex-col h-full transition-colors duration-300 relative z-10 ${g.sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"}`}
      >
        <HeaderBar onToggleSidebar={() => g.setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Hero / Header */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight">{g.t("galleryTitle")}</h1>
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-xl">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-secondary)" />
                  <input
                    type="text"
                    placeholder={g.t("gallerySearch")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-(--surface-muted) border border-(--control-border) focus:ring-2 focus:ring-(--accent) focus:outline-none transition-colors"
                    value={g.searchQuery}
                    onChange={(e) => g.setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  {/* Date Filter */}
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-secondary) pointer-events-none" />
                    <select
                      value={g.dateFilter}
                      onChange={(e) => g.setDateFilter(e.target.value as DateFilter)}
                      className="pl-9 pr-8 py-2.5 rounded-xl bg-(--surface-muted) border border-(--control-border) focus:ring-2 focus:ring-(--accent) focus:outline-none appearance-none cursor-pointer text-sm"
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
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-secondary) pointer-events-none" />
                      <select
                        value={g.modelFilter}
                        onChange={(e) => g.setModelFilter(e.target.value)}
                        className="pl-9 pr-8 py-2.5 rounded-xl bg-(--surface-muted) border border-(--control-border) focus:ring-2 focus:ring-(--accent) focus:outline-none appearance-none cursor-pointer text-sm"
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
                    onClick={() => g.setShowFavoritesOnly(!g.showFavoritesOnly)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      g.showFavoritesOnly
                        ? "bg-pink-500/20 border-pink-500/30 text-pink-400"
                        : "bg-(--surface-muted) border-(--control-border) text-(--text-secondary) hover:text-(--text-primary)"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${g.showFavoritesOnly ? "fill-current" : ""}`} />
                    {g.t("galleryFavorites") || "Favorites"}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Count + Compare Button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-(--text-secondary)">
                {g.t("galleryYourCreations")}
                {!g.loading && (
                  <span className="ml-2 text-sm font-normal">
                    ({g.filteredImages.length} images)
                  </span>
                )}
              </h2>

              <div className="flex items-center gap-2">
                {g.compareMode && (
                  <>
                    <span className="text-sm text-(--text-secondary)">
                      {[g.compareImages[0], g.compareImages[1]].filter(Boolean).length}/2{" "}
                      {g.t("compareSelected") || "selected"}
                    </span>
                    {g.compareImages[0] && g.compareImages[1] && (
                      <button
                        onClick={g.handleOpenCompare}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--accent) text-white font-bold shadow-lg shadow-(--accent)/20 hover:opacity-90 transition-colors"
                      >
                        <GitCompare className="w-4 h-4" />
                        {g.t("compareNow") || "Compare"}
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={g.handleToggleCompareMode}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    g.compareMode
                      ? "bg-(--danger)/20 text-(--danger) border border-(--danger)/30 hover:bg-(--danger)/30"
                      : "bg-(--surface-muted) border border-(--control-border) hover:bg-(--surface-hover)"
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

            {/* Grid */}
            {g.loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-xl" />
                ))}
              </div>
            ) : g.filteredImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-(--text-secondary)">
                <ImageIcon className="w-16 h-16 opacity-20" />
                <p>{g.t("galleryNoImages")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {g.filteredImages.map((img) => {
                  const isSelectedForCompare = g.isImageSelectedForCompare(img.id);
                  return (
                    <div
                      key={img.id}
                      onClick={() => {
                        if (g.compareMode) {
                          g.handleToggleCompareImage(img);
                        } else {
                          g.setSelectedImage(img);
                        }
                      }}
                      className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-(--surface-muted) border-2 transition-colors ${
                        isSelectedForCompare
                          ? "border-(--accent) ring-2 ring-(--accent)/30"
                          : "border-(--border) hover:border-(--accent)"
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.prompt}
                        fill
                        className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                        unoptimized
                      />

                      {/* Compare Mode Selection Indicator */}
                      {g.compareMode && (
                        <div
                          className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                            isSelectedForCompare
                              ? "bg-(--accent) text-white"
                              : "bg-black/50 text-white/70 border border-white/30"
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
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                        <p className="text-white text-xs line-clamp-2 font-medium">{img.prompt}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Infinite scroll trigger */}
            {!g.loading && g.hasMore && (
              <div ref={g.loadMoreRef} className="flex justify-center py-8">
                {g.loadingMore ? (
                  <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
                ) : (
                  <p className="text-sm text-(--text-secondary)">Scroll to load more...</p>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Modal Detail View */}
        <Dialog open={!!g.selectedImage} onOpenChange={(open) => !open && g.setSelectedImage(null)}>
          <DialogContent className="max-w-7xl w-full max-h-[95vh] p-0 gap-0 overflow-hidden border-(--border) [&>button]:hidden">
            <DialogTitle className="sr-only">{g.t("galleryImageDetails")}</DialogTitle>

            {g.selectedImage && (
              <>
                {/* Image Counter */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-white/80 text-sm font-medium border border-white/10">
                  {g.currentImageIndex + 1} / {g.filteredImages.length}
                </div>

                <div className="flex flex-col lg:flex-row w-full max-h-[95vh] overflow-hidden">
                  {/* Image Area */}
                  <div className="flex-1 relative bg-black flex items-center justify-center min-h-[400px] lg:min-h-[600px] group">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          g.handlePrevImage();
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-sm border border-white/20 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                        title={g.t("galleryPrev") || "Previous"}
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                    )}

                    {/* Next Arrow */}
                    {g.currentImageIndex < g.filteredImages.length - 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          g.handleNextImage();
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-sm border border-white/20 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                        title={g.t("galleryNext") || "Next"}
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    )}
                  </div>

                  {/* Details Sidebar */}
                  <div className="w-full lg:w-80 p-6 flex flex-col border-l border-(--border) bg-(--surface-base) max-h-[95vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg">{g.t("galleryImageDetails")}</h3>
                      <button
                        onClick={() => g.setSelectedImage(null)}
                        className="p-2 hover:bg-(--surface-muted) rounded-full"
                      ></button>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-(--text-secondary) uppercase">
                          {g.t("galleryPrompt")}
                        </label>
                        <p className="text-sm leading-relaxed p-3 rounded-lg bg-(--surface-muted) border border-(--border)">
                          {g.selectedImage.prompt}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-(--text-secondary) uppercase">
                            {g.t("galleryModel")}
                          </label>
                          <p className="text-sm">{g.selectedImage.model || "Unknown"}</p>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-(--text-secondary) uppercase">
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
                          <label className="text-xs font-bold text-(--text-secondary) uppercase">
                            {g.t("galleryRatio")}
                          </label>
                          <p className="text-sm">{g.selectedImage.aspectRatio || "1:1"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-6 border-t border-(--border) space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => window.open(g.selectedImage!.url, "_blank")}
                          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" /> {g.t("studioDownload")}
                        </button>
                        <button
                          onClick={() => g.handleRemix(g.selectedImage!.prompt)}
                          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--accent) text-white hover:opacity-90 font-bold shadow-lg shadow-(--accent)/20 transition-colors"
                        >
                          <Sparkles className="w-4 h-4" /> {g.t("galleryRemix")}
                        </button>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => g.handleDelete(g.selectedImage!.id)}
                        disabled={g.deleting === g.selectedImage.id}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-(--danger) hover:bg-(--danger)/10 border border-(--danger)/30 font-medium transition-colors disabled:opacity-50"
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
      </div>
    </div>
  );
}
