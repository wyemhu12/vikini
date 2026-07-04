// app/page.tsx
import React, { Suspense } from "react";
import ChatApp from "@/app/features/chat/components/ChatApp";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-surface text-primary gap-6">
          {/* Branded V logo pulse */}
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-(--control-bg) border border-(--control-border) animate-pulse">
            <span className="text-xl font-black text-(--accent)">V</span>
          </div>
          {/* Skeleton bars mimicking content */}
          <div className="flex flex-col gap-3 w-48">
            <div className="h-2 rounded-full bg-(--control-bg) animate-pulse" />
            <div className="h-2 rounded-full bg-(--control-bg) animate-pulse w-3/4 mx-auto" />
          </div>
        </div>
      }
    >
      <ChatApp />
    </Suspense>
  );
}
