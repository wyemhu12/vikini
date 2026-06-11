import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Skeleton placeholder for loading states.
 * Token-driven so it follows the active theme; uses a subtle pulse.
 *
 * @example
 * <Skeleton className="h-4 w-32" />
 * <Skeleton className="h-40 w-full rounded-xl" />
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-(--control-bg-hover)", className)}
      {...props}
    />
  );
}

export { Skeleton };
