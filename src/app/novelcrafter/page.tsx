"use client";

import { Suspense } from "react";
import NovelcrafterStudioApp from "@/app/features/novelcrafter/components/NovelcrafterStudioApp";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function NovelcrafterPage() {
  return (
    <ErrorBoundary>
      <Suspense>
        <NovelcrafterStudioApp />
      </Suspense>
    </ErrorBoundary>
  );
}
