"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Loader2, Copy, Check, Sparkles, RefreshCw, ImageIcon } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useConversation, FrontendConversation } from "../../chat/hooks/useConversation";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

export function DescribeImageView() {
  const { theme: _theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  // Fetch main chat conversations for the Sidebar
  const { conversations } = useConversation();
  const mainChats = (conversations || []).filter(
    (c: FrontendConversation) =>
      c.model !== "vikini-image-studio" && c.model !== "user_templates_store"
  );

  // Sidebar state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Core state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
      return;
    }
    setImageFile(file);
    setResult(null);
    setCopied(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const res = await fetch("/api/describe-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Failed to analyze image");
      }

      const json = await res.json();
      setResult(json.prompt || json.description || "");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("[DescribeImageView] analyze failed:", message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }, [imageFile]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success(t("describeCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("[DescribeImageView] copy failed:", message);
      toast.error("Failed to copy");
    }
  }, [result, t]);

  const handleUseInStudio = useCallback(() => {
    if (!result) return;
    const encoded = encodeURIComponent(result);
    router.push(`/images?prompt=${encoded}`);
  }, [result, router]);

  const handleReset = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setCopied(false);
  }, []);

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
        <HeaderBar onToggleSidebar={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-3"
            >
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {t("describeTitle")}
              </h1>
              <p className="text-(--text-secondary) text-lg">{t("describeSubtitle")}</p>
            </motion.div>

            {/* Upload / Preview Area */}
            <AnimatePresence mode="wait">
              {!imagePreview ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 md:p-16 text-center transition-all duration-300 backdrop-blur-sm ${
                      isDragOver
                        ? "border-purple-400 bg-purple-500/10 shadow-lg shadow-purple-500/10 scale-[1.02]"
                        : "border-(--control-border) bg-(--surface-muted)/50 hover:border-purple-400/50 hover:bg-purple-500/5"
                    }`}
                  >
                    {/* Gradient glow effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />

                    <div className="relative space-y-4">
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20">
                        <Upload className="w-8 h-8 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{t("describeUpload")}</p>
                        <p className="text-sm text-(--text-secondary) mt-1">
                          {t("describeUploadHint")}
                        </p>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                      className="hidden"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Image Preview */}
                  <div className="relative rounded-2xl overflow-hidden border border-(--border) bg-(--surface-muted) shadow-xl">
                    <div className="relative aspect-video w-full">
                      <Image
                        src={imagePreview}
                        alt="Uploaded image"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    {/* Subtle gradient overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                  </div>

                  {/* Analyze Button */}
                  {!result && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="w-full py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t("describeAnalyzing")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          {t("describeAnalyze")}
                        </>
                      )}
                    </motion.button>
                  )}

                  {/* Result */}
                  <AnimatePresence>
                    {result && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-4"
                      >
                        {/* Result Label */}
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-blue-400" />
                          <h2 className="text-sm font-bold uppercase tracking-wider text-(--text-secondary)">
                            {t("describeResult")}
                          </h2>
                        </div>

                        {/* Result Text */}
                        <div className="relative rounded-xl border border-(--border) bg-(--surface-muted)/80 backdrop-blur-sm p-5">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap pr-10">
                            {result}
                          </p>
                          {/* Copy Button */}
                          <button
                            onClick={handleCopy}
                            className="absolute top-3 right-3 p-2 rounded-lg hover:bg-(--surface-hover) transition-colors"
                            title={t("describeCopy")}
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-(--text-secondary)" />
                            )}
                          </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={handleUseInStudio}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/20 transition-all duration-300"
                          >
                            <ImageIcon className="w-4 h-4" />
                            {t("describeUseInStudio")}
                          </button>
                          <button
                            onClick={handleReset}
                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-(--surface-muted) border border-(--control-border) hover:bg-(--surface-hover) transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            {t("describeNewImage")}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
