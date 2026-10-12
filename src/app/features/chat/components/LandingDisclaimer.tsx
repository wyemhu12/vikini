// /app/features/chat/components/LandingDisclaimer.tsx
"use client";

import React from "react";

/** AI disclaimer fixed at the page bottom on the landing view (sidebar-aware). */
export default function LandingDisclaimer({
  text,
  sidebarCollapsed,
}: {
  text: string;
  sidebarCollapsed: boolean;
}) {
  return (
    <div
      className={`fixed bottom-[calc(0.5rem+var(--sab,0px))] inset-x-0 text-center z-30 pointer-events-none transition-[padding] duration-300 ${sidebarCollapsed ? "md:pl-[calc(5rem+var(--sal,0px))]" : "md:pl-[calc(18rem+var(--sal,0px))] lg:pl-[calc(20rem+var(--sal,0px))]"} pr-[var(--sar,0px)]`}
    >
      <p className="text-xs font-bold text-(--text-secondary) tracking-widest uppercase">{text}</p>
    </div>
  );
}
