"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, RotateCcw } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error("Next.js Error Boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 h-full bg-(--surface) text-(--text)">
      <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-(--danger)/10 border border-(--danger)/30">
        <AlertCircle aria-hidden="true" className="w-8 h-8 text-(--danger)" />
      </div>
      <h1 className="text-xl font-bold mb-2">{t("errorBoundaryTitle")}</h1>
      <p className="text-(--muted) mb-4 text-center max-w-md">{t("errorBoundaryDescription")}</p>
      {error?.digest && (
        <p className="text-xs text-(--faint) mb-6 font-mono">
          {t("errorReferenceId")}: {error.digest}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 bg-(--raised) hover:bg-(--raised-hover) border border-(--line) rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <RotateCcw aria-hidden="true" className="w-4 h-4" />
          {t("tryAgain")}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 bg-(--accent) text-(--on-accent) rounded-lg text-sm font-medium hover:brightness-110 transition-[filter] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <RefreshCw aria-hidden="true" className="w-4 h-4" />
          {t("reloadPage")}
        </button>
      </div>
    </div>
  );
}
