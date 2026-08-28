"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function GoBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-2 px-4 py-2 bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) rounded-lg text-sm font-medium transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Go Back
    </button>
  );
}
