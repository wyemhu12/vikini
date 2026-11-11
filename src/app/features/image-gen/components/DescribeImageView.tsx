"use client";

import { useState, useCallback, useRef, useEffect, type DragEvent } from "react";
import {
  Upload,
  Loader2,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  ImageIcon,
  Clock,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import AppFrame from "../../layout/components/AppFrame";
import { ImageSectionHeader } from "./ImageSectionHeader";
import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

export function DescribeImageView() {
  const { theme: _theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  // Core state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // History (localStorage)
  const HISTORY_KEY = "vikini-describe-history";
  const MAX_HISTORY = 20;

  interface DescribeHistoryItem {
    thumbnail: string; // small base64 preview
    prompt: string;
    timestamp: number;
  }

  const [history, setHistory] = useState<DescribeHistoryItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as DescribeHistoryItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  const addToHistory = useCallback((thumbnail: string, prompt: string) => {
    setHistory((prev) => {
      const item: DescribeHistoryItem = { thumbnail, prompt, timestamp: Date.now() };
      const next = [item, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

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
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    setResult(null);

    try {
      // API expects JSON { imageUrl: string } - send base64 data URL
      const res = await fetch("/api/describe-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imagePreview }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.error || "Failed to analyze image");
      }

      // API returns success({ description }) → json.data.description
      const desc = json.data?.description || "";
      setResult(desc);

      // Save to history
      if (desc && imagePreview) {
        // Create small thumbnail (max 100px) to save storage
        const canvas = document.createElement("canvas");
        const img = document.createElement("img");
        img.src = imagePreview;
        await new Promise<void>((resolve) => {
          img.onload = () => {
            const scale = Math.min(100 / img.width, 100 / img.height, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
          };
        });
        const thumbnail = canvas.toDataURL("image/jpeg", 0.6);
        addToHistory(thumbnail, desc);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("[DescribeImageView] analyze failed:", message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }, [imagePreview]);

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
    <AppFrame>
      <ImageSectionHeader />
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <p className="text-sm text-(--muted)">{t("describeSubtitle")}</p>

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
                  className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 md:p-16 text-center transition-colors duration-300 backdrop-blur-sm ${
                    isDragOver
                      ? "border-(--accent) bg-(--soft) shadow-lg scale-[1.02]"
                      : "border-(--line) bg-(--raised)/50 hover:border-(--accent) hover:bg-(--soft)"
                  }`}
                >
                  {/* Gradient glow effect */}

                  <div className="relative space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-(--soft) flex items-center justify-center border border-(--accent)/30">
                      <Upload aria-hidden="true" className="w-8 h-8 text-(--accent)" />
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
                    className="w-full py-4 rounded-xl font-bold text-lg text-(--on-accent) bg-(--accent) hover:brightness-110 shadow-lg transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
                        <div className="w-1.5 h-1.5 rounded-full bg-(--accent)" />
                        <h2 className="text-sm font-semibold text-(--muted)">
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
                          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-(--control-bg-hover) transition-colors"
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
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-(--on-accent) bg-(--accent) hover:brightness-110 shadow-lg transition-colors duration-300"
                        >
                          <ImageIcon className="w-4 h-4" />
                          {t("describeUseInStudio")}
                        </button>
                        <button
                          onClick={handleReset}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-(--surface-muted) border border-(--control-border) hover:bg-(--control-bg-hover) transition-colors"
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

          {/* History Section */}
          {history.length > 0 && !imagePreview && (
            <div className="mt-8 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-(--muted)">
                  <Clock className="w-4 h-4" />
                  {t("describeHistory") || "History"}
                  <span className="text-xs font-normal">({history.length})</span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  {t("studioClearHistory") || "Clear"}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setResult(item.prompt)}
                    className="flex items-start gap-3 p-3 rounded-xl border border-(--border) bg-(--surface-muted)/50 hover:bg-(--control-bg-hover) transition-colors text-left group"
                  >
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0 border border-(--border)"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-(--text-primary) line-clamp-2 leading-relaxed">
                        {item.prompt}
                      </p>
                      <p className="text-xs text-(--muted) mt-1">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
