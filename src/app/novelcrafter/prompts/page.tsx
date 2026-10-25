"use client";

import { Suspense } from "react";
import PromptStudioApp from "@/app/features/novelcrafter/components/prompt-studio/PromptStudioApp";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function NovelcrafterPromptStudioPage() {
  return (
    <ErrorBoundary>
      <Suspense>
        <PromptStudioApp />
      </Suspense>
    </ErrorBoundary>
  );
}
