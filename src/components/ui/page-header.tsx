import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

/** Shared page title block: optional back link, the page's single h1, description and actions. */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-(--line)",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-(--muted) hover:text-(--text) rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-(--text) truncate">{title}</h1>
        {description && <p className="text-sm text-(--muted)">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
