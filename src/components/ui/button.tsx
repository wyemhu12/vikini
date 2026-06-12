import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-(--radius) text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface) disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary call-to-action: solid accent that follows the active theme.
        default:
          "bg-(--accent) text-(--accent-foreground) hover:brightness-110 active:brightness-95 shadow-sm",
        destructive: "bg-(--danger) text-(--danger-foreground) hover:bg-(--danger-hover) shadow-sm",
        outline:
          "border border-(--control-border) bg-(--control-bg) text-(--text-primary) hover:bg-(--control-bg-hover)",
        secondary:
          "bg-(--surface-muted) text-(--text-primary) border border-(--border) hover:bg-(--control-bg-hover)",
        ghost: "text-(--text-primary) hover:bg-(--control-bg-hover)",
        link: "text-(--accent) underline-offset-4 hover:underline",
        // Vikini specific variants
        glass:
          "bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-(--text-primary) shadow-sm backdrop-blur-md",
        island:
          "bg-(--control-bg) hover:bg-(--control-bg-hover) text-(--text-primary) backdrop-blur-xl border border-(--control-border) shadow-xl",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[calc(var(--radius)-2px)] px-3",
        lg: "h-11 rounded-[var(--radius)] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
