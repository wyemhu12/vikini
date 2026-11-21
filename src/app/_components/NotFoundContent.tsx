"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { GoBackButton } from "./go-back-button";

export function NotFoundContent() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 h-full bg-(--surface) text-(--text)">
      <div className="flex flex-col items-center justify-center max-w-md text-center">
        <p aria-hidden="true" className="text-8xl font-bold text-(--muted) opacity-50 mb-4">
          404
        </p>
        <h1 className="text-2xl font-bold mb-3">{t("notFoundTitle")}</h1>
        <p className="text-(--muted) mb-8">{t("notFoundDescription")}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 bg-(--accent) text-(--on-accent) rounded-lg text-sm font-medium hover:brightness-110 transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <Home aria-hidden="true" className="w-4 h-4" />
            {t("goHome")}
          </Link>
          <GoBackButton />
        </div>
      </div>
    </div>
  );
}
