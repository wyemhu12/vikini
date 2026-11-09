"use client";

import { Suspense } from "react";
import PersonaManager from "./components/PersonaManager";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import AppFrame from "@/app/features/layout/components/AppFrame";

function PersonaLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center text-(--muted)">
      Loading Personas...
    </div>
  );
}

export default function PersonasPage() {
  return (
    <AppFrame>
      <ErrorBoundary>
        <Suspense fallback={<PersonaLoading />}>
          <PersonaManager />
        </Suspense>
      </ErrorBoundary>
    </AppFrame>
  );
}
