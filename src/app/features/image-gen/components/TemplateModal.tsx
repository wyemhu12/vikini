"use client";

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/lib/store/toastStore";
import { validateReferenceImages } from "@/lib/features/files/uploadPresentation";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { ImageTemplate } from "@/lib/features/image-gen/templates";
import { TRANSITION } from "@/lib/utils/motion";

interface TemplateModalProps {
  template: ImageTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoosePhoto: (template: ImageTemplate, file: File) => void;
}

export default function TemplateModal({
  template,
  open,
  onOpenChange,
  onChoosePhoto,
}: TemplateModalProps) {
  const { language, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!template) return null;

  const processCandidateFile = (file: File | undefined) => {
    if (!file) return;
    const validation = validateReferenceImages([file], 0, 1);
    if (validation.invalidTypeCount > 0) {
      toast.error(t("describeInvalidImage"));
      return;
    }
    if (validation.tooLargeCount > 0) {
      toast.error(t("describeFileTooLarge"));
      return;
    }
    if (validation.accepted[0]) {
      onChoosePhoto(template, validation.accepted[0]);
      onOpenChange(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    processCandidateFile(file);
  };

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
    processCandidateFile(e.dataTransfer.files?.[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`sm:max-w-md p-0 overflow-hidden bg-(--surface) border transition-[border-color,box-shadow] duration-150 ${
          isDragging ? "border-(--accent) ring-2 ring-(--accent)/40" : "border-(--line)"
        }`}
      >
        {/* Preview image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={TRANSITION.EXIT_NORMAL}
          className="relative"
        >
          <img
            src={template.previewUrl}
            alt={template.name[language]}
            className="w-full h-56 sm:h-64 object-cover"
            loading="eager"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-(--overlay) to-transparent" />
          <div className="absolute bottom-3 left-4">
            <span className="text-(--on-overlay) font-bold text-lg drop-shadow-lg">
              {template.name[language]}
            </span>
          </div>
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-(--surface)/85 backdrop-blur-sm border-2 border-dashed border-(--accent) m-2 rounded-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-(--accent)">
                <Upload aria-hidden="true" className="w-4 h-4" />
                <span>{t("templateDropPhotoHint")}</span>
              </div>
            </div>
          )}
        </motion.div>

        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="sr-only">{template.name[language]}</DialogTitle>
            <DialogDescription className="text-sm text-(--muted) leading-relaxed">
              {template.description[language]}
            </DialogDescription>
          </DialogHeader>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-(--accent) text-(--on-accent) hover:opacity-95"
              size="lg"
            >
              <Camera aria-hidden="true" className="w-4 h-4 mr-2" />
              {t("choosePhoto")}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
              size="lg"
            >
              <X aria-hidden="true" className="w-4 h-4 mr-2" />
              {t("cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
