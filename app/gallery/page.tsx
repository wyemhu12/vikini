"use client";

import { GalleryView } from "@/app/features/gallery/components/GalleryView";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function GalleryPage() {
  return (
    <ErrorBoundary>
      <GalleryView />
    </ErrorBoundary>
  );
}
