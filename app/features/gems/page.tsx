"use client";

import { Suspense } from "react";
import GemManager from "./components/GemManager";

// Tạo component loading đơn giản
function GemLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-950 text-neutral-400">
      Loading Gems...
    </div>
  );
}

export default function GemsPage() {
  return (
    <div className="h-[100dvh] w-full bg-neutral-950">
      <Suspense fallback={<GemLoading />}>
        <GemManager />
      </Suspense>
    </div>
  );
}
