// /app/features/image-gen/components/ControlPanelReferenceImages.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { STUDIO_LABEL_CLASS } from "./ControlPanelPromptSection";

const MAX_REF_IMAGES = 4;

export interface ControlPanelReferenceImagesProps {
  model: string;
  referenceImages: File[];
  setReferenceImages: (f: File[]) => void;
}

/** Reference images block of the Image Studio (QW-D: multi-reference, max 4). */
export default function ControlPanelReferenceImages({
  model,
  referenceImages,
  setReferenceImages,
}: ControlPanelReferenceImagesProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (referenceImages.length === 0) {
      setReferencePreviews([]);
      return;
    }
    const previews: string[] = [];
    let loaded = 0;
    referenceImages.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        previews[idx] = reader.result as string;
        loaded++;
        if (loaded === referenceImages.length) {
          setReferencePreviews([...previews]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [referenceImages]);

  const handleRefUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) {
        setReferenceImages([...referenceImages, ...files].slice(0, MAX_REF_IMAGES));
      }
      e.target.value = "";
    },
    [referenceImages, setReferenceImages]
  );

  const removeRefImage = useCallback(
    (index: number) => {
      setReferenceImages(referenceImages.filter((_, i) => i !== index));
    },
    [referenceImages, setReferenceImages]
  );

  const isGeminiNative = model.includes("gemini-3") || model.includes("gemini-3.1");
  const showRefWarning = referenceImages.length > 0 && !isGeminiNative;

  return (
    <div className="space-y-2 px-4 md:px-6 mt-4">
      <div className="flex items-center justify-between">
        <Label className={STUDIO_LABEL_CLASS}>{t("studioReferenceImages")}</Label>
        {referenceImages.length > 0 && (
          <span className="text-xs text-(--muted)">
            {t("studioRefCount").replace("{{count}}", String(referenceImages.length))}
          </span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label={t("studioUploadRef")}
        onChange={handleRefUpload}
      />
      {referenceImages.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {referencePreviews.map((preview, idx) => (
              <div
                key={idx}
                className="relative group/ref rounded-lg overflow-hidden border border-(--line) bg-(--raised)"
              >
                <img
                  src={preview}
                  alt={`Reference ${idx + 1}`}
                  className="w-full h-20 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeRefImage(idx)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-(--overlay) hover:bg-(--danger) text-(--danger-foreground) transition-colors opacity-0 group-hover/ref:opacity-100 focus-visible:opacity-100"
                  title={t("studioRemoveRef")}
                  aria-label={t("studioRemoveRef")}
                >
                  <X aria-hidden="true" className="w-3 h-3" />
                </button>
              </div>
            ))}
            {referenceImages.length < MAX_REF_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-(--line) hover:border-(--accent) hover:bg-(--soft) transition-colors"
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
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-(--line) hover:border-(--accent) hover:bg-(--soft) transition-colors text-left"
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
