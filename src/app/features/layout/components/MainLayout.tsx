import React from "react";
import GemModal from "../../gems/components/GemModal";
import ConfirmDialogHost from "@/components/ui/confirm-dialog";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative flex-1">
      {children}
      <GemModal />
      <ConfirmDialogHost />
    </main>
  );
}
