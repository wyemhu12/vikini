// /app/features/chat/components/ChatLoadingScreen.tsx
"use client";

import React from "react";

/** Full-screen splash shown while the session is resolving. */
export default function ChatLoadingScreen({ label }: { label: string }) {
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-(--bg) text-(--text) overflow-hidden">
      <div className="absolute inset-0 z-0 bg-(--raised) opacity-80" />
      <div className="relative animate-pulse flex flex-col items-center gap-6 z-10">
        <div className="h-16 w-16 rounded-2xl border border-(--line) bg-(--surface) backdrop-blur-xl flex items-center justify-center text-3xl font-black shadow-2xl">
          V
        </div>
        <div className="text-xs tracking-[0.2em] text-(--muted) font-bold">{label}</div>
      </div>
    </div>
  );
}
