"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ImageGenResult {
  url: string;
  provider: string;
  metadata?: any;
}

import { X } from "lucide-react"; // Add Close Icon

export interface ImageGenPreviewProps {
  isLoading?: boolean;
  result?: ImageGenResult;
  imageUrl?: string; // Direct URL support
  prompt?: string;
  error?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function ImageGenPreview({
  isLoading,
  result,
  imageUrl,
  prompt,
  error,
  onRetry,
  onClose,
}: ImageGenPreviewProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  // Resolve URL
  const finalUrl = imageUrl || result?.url;

  if (isLoading) {
    return (
      <Card className="w-full max-w-sm aspect-square flex flex-col items-center justify-center bg-muted/30 border-dashed animate-pulse relative">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-50 hover:opacity-100"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider text-center px-4">
          {prompt ? `Generating: "${prompt.slice(0, 30)}..."` : "Creating visual..."}
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-sm p-4 bg-destructive/10 border-destructive/20 text-destructive relative">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-50 hover:opacity-100"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        <p className="text-sm font-semibold mb-2">Generation Failed</p>
        <p className="text-xs opacity-90 mb-3">{error}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-destructive/30 hover:bg-destructive/20"
          >
            Retry
          </Button>
        )}
      </Card>
    );
  }

  if (!finalUrl) return null;

  return (
    <div className="relative group w-full max-w-md">
      {/* Close Button (Overlay) - Only if not zoomed */}
      {onClose && !isZoomed && (
        <div className="absolute -top-2 -right-2 z-10">
          <Button
            size="icon"
            variant="destructive"
            className="h-6 w-6 rounded-full shadow-md"
            onClick={onClose}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      <Card className="overflow-hidden bg-black/5 dark:bg-white/5 border-0 shadow-lg transition-all hover:shadow-xl">
        <div
          className="relative aspect-[16/9] w-full cursor-zoom-in"
          onClick={() => setIsZoomed(!isZoomed)}
        >
          {/* Use specific sizing or fill for best results with Next.js Image */}
          <Image
            src={finalUrl}
            alt={prompt || "Generated content"}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized={finalUrl.startsWith("data:")} // Handle base64
          />
        </div>

        {/* Hover Controls */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full shadow-md bg-white/90 dark:bg-black/90 backdrop-blur-sm"
            asChild
          >
            <a
              href={finalUrl}
              download="generated-image.png"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="w-4 h-4" />
            </a>
          </Button>
        </div>

        {/* Footer Info */}
        <div className="p-2 flex justify-between items-center bg-background/80 backdrop-blur-sm border-t text-[10px] text-muted-foreground uppercase tracking-widest px-3">
          <div className="flex flex-col min-w-0">
            <span>AI Generated</span>
            {prompt && (
              <span className="opacity-50 truncate max-w-[200px] normal-case tracking-normal text-[9px]">
                {prompt}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
