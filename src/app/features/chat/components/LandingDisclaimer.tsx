// /app/features/chat/components/LandingDisclaimer.tsx
"use client";

import React from "react";
import { getShellPaddingClass } from "../../layout/utils/shellNav";

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
      className={`fixed bottom-[calc(0.5rem+var(--sab,0px))] inset-x-0 text-center z-30 pointer-events-none transition-[padding] duration-300 ${getShellPaddingClass(sidebarCollapsed)} pr-[var(--sar,0px)]`}
    >
      <p className="truncate px-4 text-xs text-(--faint)">{text}</p>
    </div>
  );
}
