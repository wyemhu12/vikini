// /app/features/chat/components/FileTypesHelp.tsx
"use client";

import React from "react";
import { CheckCircle, Info, XCircle } from "lucide-react";
import { FILE_CATEGORIES } from "@/lib/features/attachments/attachments";
import { useLanguage } from "../hooks/useLanguage";

interface FileTypesHelpProps {
  /** Compact mode for tooltips */
  compact?: boolean;
}

/**
 * Component to display supported file types information
 * Used in AttachmentsPanel tooltip and help modal
 */
export function FileTypesHelp({ compact = false }: FileTypesHelpProps) {
  const { t } = useLanguage();

  const categories = [
    {
      key: "BEST_SUPPORT" as const,
      labelKey: "fileTypesBestSupport",
      descKey: "fileTypesBestSupportDesc",
      icon: CheckCircle,
      colorClass: "text-green-400",
      bgClass: "bg-green-500/10",
      borderClass: "border-green-500/30",
    },
    {
      key: "BASIC_SUPPORT" as const,
      labelKey: "fileTypesBasicSupport",
      descKey: "fileTypesBasicSupportDesc",
      icon: Info,
      colorClass: "text-blue-400",
      bgClass: "bg-blue-500/10",
      borderClass: "border-blue-500/30",
    },
    {
      key: "BLOCKED" as const,
      labelKey: "fileTypesBlocked",
      descKey: "fileTypesBlockedDesc",
      icon: XCircle,
      colorClass: "text-red-400",
      bgClass: "bg-red-500/10",
      borderClass: "border-red-500/30",
    },
  ];

  if (compact) {
    return (
      <div className="space-y-2 text-xs">
        <div className="font-semibold text-primary mb-2">{t("fileTypesHelpTitle")}</div>
        {categories.map(({ key, labelKey, icon: Icon, colorClass }) => {
          const cat = FILE_CATEGORIES[key];
          return (
            <div key={key} className="flex items-start gap-2">
              <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${colorClass}`} />
              <div>
                <span className="font-medium text-primary">{t(labelKey)}</span>
                <span className="text-secondary ml-1">
                  ({cat.extensions.slice(0, 5).join(", ")}
                  {cat.extensions.length > 5 ? "..." : ""})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-primary">{t("fileTypesHelpTitle")}</h4>
      {categories.map(
        ({ key, labelKey, descKey, icon: Icon, colorClass, bgClass, borderClass }) => {
          const cat = FILE_CATEGORIES[key];
          return (
            <div key={key} className={`p-3 rounded-lg border ${bgClass} ${borderClass}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${colorClass}`} />
                <span className="text-sm font-medium text-primary">{t(labelKey)}</span>
              </div>
              <p className="text-xs text-secondary mb-2">{t(descKey)}</p>
              <div className="flex flex-wrap gap-1">
                {cat.extensions.map((ext) => (
                  <span
                    key={ext}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-surface rounded border border-token"
                  >
                    .{ext}
                  </span>
                ))}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

export default FileTypesHelp;
