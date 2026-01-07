import React from "react";
import { cn } from "@/lib/utils/cn";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[11rem] lg:auto-rows-[12rem] xl:auto-rows-[15rem] 2xl:auto-rows-[16rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  onClick,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "row-span-1 rounded-xl group/bento transition duration-200 p-4 justify-between flex flex-col space-y-4 cursor-pointer relative overflow-hidden",
        // Glassmorphism 2.0
        "bg-[var(--surface-muted)]/40 backdrop-blur-xl border border-[var(--border)]",
        "hover:bg-[var(--control-bg-hover)] hover:border-[var(--accent)]/30 hover:shadow-2xl hover:-translate-y-1",
        "before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-2 transition duration-200">
        {icon}
        <div className="font-sans font-bold text-[var(--text-primary)] mb-2 mt-2">{title}</div>
        <div className="font-sans font-normal text-[var(--text-secondary)] text-xs">
          {description}
        </div>
      </div>
    </div>
  );
};
