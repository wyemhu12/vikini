"use client";

import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { ImageTemplate } from "@/lib/features/image-gen/templates";

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
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!template) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onChoosePhoto(template, file);
      onOpenChange(false);
    }
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-(--surface-elevated) border-none">
        {/* Preview image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <img
            src={template.previewUrl}
            alt={template.name[language]}
            className="w-full h-56 sm:h-64 object-cover"
            loading="eager"
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
          {/* Template name on image */}
          <div className="absolute bottom-3 left-4">
            <span className="text-white font-bold text-lg drop-shadow-lg">
              {template.name[language]}
            </span>
          </div>
        </motion.div>

        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="sr-only">{template.name[language]}</DialogTitle>
            <DialogDescription className="text-sm text-(--text-secondary) leading-relaxed">
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
              className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              size="lg"
            >
              <Camera className="w-4 h-4 mr-2" />
              {language === "vi" ? "Chọn ảnh" : "Choose photo"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
              size="lg"
            >
              <X className="w-4 h-4 mr-2" />
              {language === "vi" ? "Hủy" : "Cancel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
