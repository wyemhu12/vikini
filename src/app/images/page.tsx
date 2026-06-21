"use client";

import { Suspense } from "react";
import { ImageGenStudio } from "@/app/features/image-gen/components/ImageGenStudio";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function ImagesPage() {
  return (
    <ErrorBoundary>
      <Suspense>
        <ImageGenStudio />
      </Suspense>
    </ErrorBoundary>
  );
}
