import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type EmptyStateAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: EmptyStateAction;
  className?: string;
}

const ACTION_CLASS =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl bg-(--accent) text-(--on-accent) text-sm font-semibold hover:brightness-110 transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)";

/** Shared empty state: what is missing and the next step to take. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <section
      role="status"
      className={cn("flex flex-col items-center text-center gap-3 py-16 px-4", className)}
    >
      {icon && (
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--soft) text-(--accent)"
        >
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-(--text)">{title}</p>
      {description && <p className="max-w-sm text-sm text-(--muted)">{description}</p>}
      {action &&
        ("href" in action ? (
          <Link href={action.href} className={ACTION_CLASS}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={ACTION_CLASS}>
            {action.label}
          </button>
        ))}
    </section>
  );
}
