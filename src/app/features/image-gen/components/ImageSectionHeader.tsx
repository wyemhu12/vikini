// /app/features/image-gen/components/ImageSectionHeader.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ScanSearch, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";

const TABS = [
  { href: "/images", labelKey: "imageTabCreate", icon: Wand2 },
  { href: "/gallery", labelKey: "imageTabLibrary", icon: LayoutGrid },
  { href: "/describe", labelKey: "imageTabDescribe", icon: ScanSearch },
] as const;

/**
 * Shared header of the Images section (Vikini 3.0 phase 4): the page h1 plus route tabs
 * Tạo ảnh / Thư viện / Mô tả ảnh. Tabs are links (each is its own URL), marked with aria-current.
 * On mobile the header is compact and the h1 is visible to screen readers only.
 */
export function ImageSectionHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-6 border-b border-(--line) bg-(--bg) px-4 md:h-15 md:px-6",
        className
      )}
    >
      <h1 className="sr-only text-lg font-semibold text-(--text) md:not-sr-only">
        {t("imagesTitle")}
      </h1>
      <nav
        aria-label={t("imageSectionNav")}
        className="flex h-full min-w-0 overflow-x-auto [scrollbar-width:none]"
      >
        {TABS.map((tab) => {
          const current = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex h-full min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ring)",
                current
                  ? "border-(--accent) font-semibold text-(--text)"
                  : "border-transparent font-medium text-(--muted) hover:text-(--text)"
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
