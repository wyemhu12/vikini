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
        "grid md:auto-rows-[11rem] lg:auto-rows-[12rem] xl:auto-rows-[15rem] 2xl:auto-rows-[16rem] grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 max-w-7xl mx-auto",

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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "row-span-1 w-full text-left rounded-xl group/bento transition-[background-color,border-color,box-shadow,transform] duration-200 justify-start flex flex-row items-center gap-3 p-3 md:flex-col md:justify-between md:items-start md:space-y-4 md:p-4 cursor-pointer relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
        // Glassmorphism 2.0
        "bg-(--raised)/40 backdrop-blur-xl border border-(--line)",
        "hover:bg-(--raised) hover:border-(--accent)/30 hover:shadow-(--shadow-elevated) md:hover:-translate-y-1 active:scale-[0.98]",
        "before:absolute before:inset-0 before:bg-linear-to-b before:from-(--soft) before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        className
      )}
    >
      <div className="shrink-0 flex items-center justify-center">{header}</div>
      <div className="md:group-hover/bento:translate-x-2 transition-transform duration-200 min-w-0 flex-1">
        {icon}
        <div className="font-sans font-bold text-(--text) text-sm md:text-base mb-0.5 md:mb-2 md:mt-2 truncate">
          {title}
        </div>
        <div className="font-sans font-normal text-(--muted) text-xs truncate">{description}</div>
      </div>
    </button>
  );
};
