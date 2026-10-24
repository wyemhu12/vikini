"use client";

import { useLanguage } from "../hooks/useLanguage";
import type { LocalLlmStatus } from "../hooks/useLocalLlmHealth";

interface LocalLlmStatusDotProps {
  status: LocalLlmStatus;
  className?: string;
}

export default function LocalLlmStatusDot({ status, className = "" }: LocalLlmStatusDotProps) {
  const { t } = useLanguage();

  if (status === "disabled") {
    return null;
  }

  const label =
    status === "online"
      ? t("localLlmOnline")
      : status === "busy"
        ? t("localLlmBusy")
        : status === "checking"
          ? t("localLlmChecking")
          : t("localLlmOffline");

  const colorClass =
    status === "online"
      ? "bg-(--success)"
      : status === "busy" || status === "checking"
        ? "bg-(--warning) animate-pulse"
        : "bg-(--danger)";

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClass} ${className}`}
    />
  );
}
