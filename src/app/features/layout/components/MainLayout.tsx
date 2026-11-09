import React from "react";
import ConfirmDialogHost from "@/components/ui/confirm-dialog";
import LazyModals from "./LazyModals";
import GlobalCommandPalette from "./GlobalCommandPalette";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative flex-1">
      {children}
      <LazyModals />
      <GlobalCommandPalette />
      <ConfirmDialogHost />
    </main>
  );
}
