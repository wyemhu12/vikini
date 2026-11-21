"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className = "", ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-(--z-drawer) bg-(--overlay) backdrop-blur-xs transition-opacity data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ${className}`}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface SheetContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  side?: "left" | "right" | "bottom";
  closeLabel?: string;
  hideCloseButton?: boolean;
}

const SIDE_CLASSES: Record<NonNullable<SheetContentProps["side"]>, string> = {
  left: "inset-y-0 left-0 h-full w-[86vw] max-w-[320px] border-r border-(--line) data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  right:
    "inset-y-0 right-0 h-full w-[90vw] max-w-[380px] border-l border-(--line) data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  bottom:
    "inset-x-0 bottom-0 max-h-[82dvh] w-full rounded-t-2xl border-t border-(--line) pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
};

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    { side = "right", closeLabel, hideCloseButton = false, className = "", children, ...props },
    ref
  ) => {
    const { t } = useLanguage();
    const resolvedCloseLabel = closeLabel ?? t("close");
    return (
      <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={`fixed z-(--z-drawer) flex flex-col bg-(--surface) text-(--text) shadow-(--shadow-elevated) transition ease-out duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out focus:outline-none ${SIDE_CLASSES[side]} ${className}`}
          {...props}
        >
          {children}
          {!hideCloseButton && (
            <DialogPrimitive.Close
              aria-label={resolvedCloseLabel}
              className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-(--muted) transition-colors hover:bg-(--raised) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

export function SheetHeader({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col gap-1 border-b border-(--line) px-4 py-3 ${className}`}
      {...props}
    />
  );
}

export const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className = "", ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={`text-sm font-semibold text-(--text) ${className}`}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className = "", ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={`text-xs text-(--muted) ${className}`}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;
