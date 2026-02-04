"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SidebarSectionProps {
  /** Section label */
  label: string;
  /** Unique key for localStorage persistence */
  storageKey: string;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Children content */
  children: React.ReactNode;
  /** Optional action button (e.g., "New project") */
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  /** Whether to show count badge */
  count?: number;
}

/**
 * Collapsible sidebar section with persist state
 */
export function SidebarSection({
  label,
  storageKey,
  defaultExpanded = true,
  children,
  action,
  count,
}: SidebarSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`sidebar-section-${storageKey}`);
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
  }, [storageKey]);

  const toggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`sidebar-section-${storageKey}`, String(newState));
  };

  return (
    <div className="mb-2">
      {/* Header */}
      <button
        onClick={toggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2",
          "text-xs font-medium text-(--text-secondary) uppercase tracking-wider",
          "hover:text-(--text-primary) transition-colors"
        )}
      >
        <span className="flex items-center gap-2">
          {label}
          {count !== undefined && count > 0 && (
            <span className="text-(--text-muted) font-normal normal-case">({count})</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isExpanded ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>

      {/* Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {/* Optional action button */}
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm",
              "text-(--text-secondary) hover:text-(--text-primary)",
              "hover:bg-(--control-bg-hover) rounded-lg transition-colors"
            )}
          >
            {action.icon}
            {action.label}
          </button>
        )}
        {/* Children */}
        <div className="space-y-0.5">{children}</div>
      </div>
    </div>
  );
}

export default SidebarSection;
