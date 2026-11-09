"use client";

import { Suspense } from "react";
import GemManager from "./components/GemManager";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import AppFrame from "@/app/features/layout/components/AppFrame";

// Tạo component loading đơn giản
function GemLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center text-(--muted)">
      Loading Gems...
    </div>
  );
}

export default function GemsPage() {
  return (
    <AppFrame>
      <ErrorBoundary>
        <Suspense fallback={<GemLoading />}>
          <GemManager />
        </Suspense>
      </ErrorBoundary>
    </AppFrame>
  );
}
