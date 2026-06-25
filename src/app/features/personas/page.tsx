"use client";

import { Suspense } from "react";
import PersonaManager from "./components/PersonaManager";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function PersonaLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-950 text-neutral-400">
      Loading Personas...
    </div>
  );
}

export default function PersonasPage() {
  return (
    <div className="h-dvh w-full bg-neutral-950">
      <ErrorBoundary>
        <Suspense fallback={<PersonaLoading />}>
          <PersonaManager />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
