"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export function GoBackButton() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 bg-(--raised) hover:bg-(--raised-hover) border border-(--line) rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
    >
      <ArrowLeft aria-hidden="true" className="w-4 h-4" />
      {t("goBack")}
    </button>
  );
}
