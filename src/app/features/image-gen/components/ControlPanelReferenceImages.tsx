// /app/features/image-gen/components/ControlPanelReferenceImages.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/store/toastStore";
import {
  STUDIO_REF_ALLOWED_MIME_TYPES,
  STUDIO_REF_IMAGE_MAX_BYTES,
  getStableFileKey,
  readImagePreviewDataUrl,
  validateReferenceImages,
} from "@/lib/features/files/uploadPresentation";
import { TRANSITION, reducedMotionTransition } from "@/lib/utils/motion";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { STUDIO_LABEL_CLASS } from "./ControlPanelPromptSection";

const MAX_REF_IMAGES = 4;

export interface ControlPanelReferenceImagesProps {
  model: string;
  referenceImages: File[];
  setReferenceImages: (f: File[]) => void;
}

interface PreviewEntry {
  key: string;
  file: File;
  url: string;
}

/** Reference images block of the Image Studio (QW-D: multi-reference, max 4). */
export default function ControlPanelReferenceImages({
  model,
  referenceImages,
  setReferenceImages,
}: ControlPanelReferenceImagesProps) {
  const { t } = useLanguage();
  const shouldReduce = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlMapRef = useRef<Map<File, string>>(new Map());
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);

  // Synchronize CSP-safe data-URL previews with referenceImages without blanking existing thumbnails
  useEffect(() => {
    let cancelled = false;
    const map = urlMapRef.current;
    const activeFiles = new Set(referenceImages);

    for (const file of map.keys()) {
      if (!activeFiles.has(file)) {
        map.delete(file);
      }
    }

    const buildEntries = (): PreviewEntry[] =>
      referenceImages.map((file) => ({
        key: getStableFileKey(file),
        file,
        url: map.get(file) ?? "",
      }));

    setPreviewEntries(buildEntries());

    for (const file of referenceImages) {
      if (map.has(file)) continue;
      void readImagePreviewDataUrl(file).then((dataUrl) => {
        if (cancelled || !dataUrl || !activeFiles.has(file)) return;
        map.set(file, dataUrl);
        setPreviewEntries(buildEntries());
      });
    }

    return () => {
      cancelled = true;
    };
  }, [referenceImages]);

  useEffect(() => {
    const map = urlMapRef.current;
    return () => {
      map.clear();
    };
  }, []);

  const addReferenceFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;
      const result = validateReferenceImages(
        incoming,
        referenceImages.length,
        MAX_REF_IMAGES,
        STUDIO_REF_IMAGE_MAX_BYTES,
        STUDIO_REF_ALLOWED_MIME_TYPES
      );

      if (result.invalidTypeCount > 0) {
        toast.error(t("describeInvalidImage"));
      }
      if (result.tooLargeCount > 0) {
        toast.error(t("studioRefFileTooLarge"));
      }
      if (result.overLimitCount > 0) {
        toast.info(t("studioRefMaxReached").replace("{max}", String(MAX_REF_IMAGES)));
      }
      if (result.accepted.length > 0) {
        setReferenceImages([...referenceImages, ...result.accepted]);
      }
    },
    [referenceImages, setReferenceImages, t]
  );

  const handleRefUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      addReferenceFiles(files);
    },
    [addReferenceFiles]
  );

  const removeRefImage = useCallback(
    (targetFile: File) => {
      setReferenceImages(referenceImages.filter((f) => f !== targetFile));
    },
    [referenceImages, setReferenceImages]
  );

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    addReferenceFiles(Array.from(e.dataTransfer.files || []));
  };

  const isGeminiNative = model.includes("gemini-3") || model.includes("gemini-3.1");
  const showRefWarning = referenceImages.length > 0 && !isGeminiNative;

  return (
    <div
      className="space-y-2 px-4 md:px-6 mt-4"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <Label className={STUDIO_LABEL_CLASS}>{t("studioReferenceImages")}</Label>
        {referenceImages.length > 0 && (
          <span className="text-xs text-(--muted) tabular-nums">
            {t("studioRefCount").replace("{{count}}", String(referenceImages.length))}
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={STUDIO_REF_ALLOWED_MIME_TYPES.join(",")}
        multiple
        className="hidden"
        aria-label={t("studioUploadRef")}
        onChange={handleRefUpload}
      />
      {referenceImages.length > 0 ? (
        <div
          className={`space-y-2 rounded-xl transition-[border-color,background-color] duration-150 ${
            isDragging ? "ring-2 ring-(--accent)/50 bg-(--soft) p-1.5 -m-1.5" : ""
          }`}
        >
          <div className="grid grid-cols-2 gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {previewEntries.map((entry, idx) => (
                <motion.div
                  key={entry.key}
                  layout={!shouldReduce}
                  initial={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                  transition={reducedMotionTransition(shouldReduce, TRANSITION.FAST)}
                  className="relative group/ref rounded-lg overflow-hidden border border-(--line) bg-(--raised)"
                >
                  {entry.url ? (
                    <img
                      src={entry.url}
                      alt={`${entry.file.name || `Reference ${idx + 1}`}`}
                      className="w-full h-20 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center bg-(--raised)">
                      <ImageIcon aria-hidden="true" className="h-5 w-5 text-(--muted)" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRefImage(entry.file)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-(--overlay) hover:bg-(--danger) text-(--danger-foreground) transition-[opacity,background-color,transform] duration-150 active:scale-[0.95] opacity-100 md:opacity-0 md:group-hover/ref:opacity-100 md:group-focus-within/ref:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("studioRemoveRef")}
                    aria-label={`${t("studioRemoveRef")}: ${entry.file.name}`}
                  >
                    <X aria-hidden="true" className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {referenceImages.length < MAX_REF_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-(--line) hover:border-(--accent) hover:bg-(--soft) transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <Upload aria-hidden="true" className="w-4 h-4 text-(--muted) mb-1" />
                <span className="text-xs text-(--muted)">{t("studioAddMoreRef")}</span>
              </button>
            )}
          </div>
          {showRefWarning && (
            <div className="bg-(--warning)/10 border border-(--warning)/30 text-(--warning) text-xs font-medium px-2.5 py-1.5 rounded-lg text-center">
              {t("studioRefOnlyGemini")}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border border-dashed transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) ${
            isDragging
              ? "border-(--accent) bg-(--soft)"
              : "border-(--line) hover:border-(--accent) hover:bg-(--soft)"
          }`}
        >
          <div className="p-2 rounded-lg bg-(--raised) text-(--muted)">
            <Upload aria-hidden="true" className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-(--text)">{t("studioUploadRef")}</div>
            <div className="text-xs text-(--muted)">{t("studioRefImagesDesc")}</div>
          </div>
        </button>
      )}
    </div>
  );
}
