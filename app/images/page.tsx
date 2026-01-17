"use client";

import { ImageGenStudio } from "@/app/features/image-gen/components/ImageGenStudio";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function ImagesPage() {
  return (
    <ErrorBoundary>
      <ImageGenStudio />
    </ErrorBoundary>
  );
}
