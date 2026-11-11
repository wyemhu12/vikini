"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

const WORKSPACE_SKIP_LINK_ROUTES = new Set(["/", "/novelcrafter", "/novelcrafter/prompts"]);

export default function RootSkipLink() {
  const pathname = usePathname();
  const { t } = useLanguage();

  if (pathname && WORKSPACE_SKIP_LINK_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <a
      href="#main"
      suppressHydrationWarning
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-(--accent) focus:text-(--on-accent) focus:text-xs focus:font-semibold"
    >
      {t("skipToMainContent")}
    </a>
  );
}
