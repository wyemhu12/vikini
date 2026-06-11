import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-[calc(var(--radius)-2px)] border border-(--control-border) bg-(--control-bg) px-3 py-2 text-sm text-(--text-primary) shadow-sm placeholder:text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
