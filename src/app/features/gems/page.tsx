"use client";

import { Suspense } from "react";
import GemManager from "./components/GemManager";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import AppFrame from "@/app/features/layout/components/AppFrame";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

function GemLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full items-center justify-center text-(--muted)">
      {t("loadingGems")}
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
