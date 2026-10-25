// /app/features/novelcrafter/components/ManuscriptTypographyMenu.tsx
"use client";

import React from "react";
import { Pilcrow, Type } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type {
  ManuscriptFontFamily,
  ManuscriptFontSize,
  ManuscriptLineHeight,
  ManuscriptTypography,
} from "@/lib/features/novelcrafter/manuscriptTypography";
import { cn } from "@/lib/utils/cn";

interface ManuscriptTypographyMenuProps {
  typography: ManuscriptTypography;
  onChangeTypography: (patch: Partial<ManuscriptTypography>) => void;
}

export default function ManuscriptTypographyMenu({
  typography,
  onChangeTypography,
}: ManuscriptTypographyMenuProps) {
  const { t } = useLanguage();

  const fontFamilies: { value: ManuscriptFontFamily; label: string }[] = [
    { value: "serif", label: t("novelcrafterTypographyFontSerif") },
    { value: "sans", label: t("novelcrafterTypographyFontSans") },
    { value: "mono", label: t("novelcrafterTypographyFontMono") },
  ];

  const fontSizes: ManuscriptFontSize[] = ["sm", "md", "lg", "xl"];

  const lineHeights: { value: ManuscriptLineHeight; label: string }[] = [
    { value: "compact", label: t("novelcrafterTypographyLineCompact") },
    { value: "normal", label: t("novelcrafterTypographyLineNormal") },
    { value: "relaxed", label: t("novelcrafterTypographyLineRelaxed") },
  ];

  const optionBtnClass = (active: boolean) =>
    cn(
      "flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
      active
        ? "bg-(--accent)/15 border-(--accent) text-(--accent)"
        : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
    );

  const activeFontLabel =
    fontFamilies.find((f) => f.value === typography.fontFamily)?.label ?? typography.fontFamily;
  const activeLineLabel =
    lineHeights.find((l) => l.value === typography.lineHeight)?.label ?? typography.lineHeight;

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t("novelcrafterTypographyBtn")}
            aria-label={t("novelcrafterTypographyBtn")}
            data-testid="manuscript-typography-trigger"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-(--border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs text-(--text-primary) font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Type className="w-3.5 h-3.5 text-(--accent)" />
            <span>{activeFontLabel}</span>
            <span className="text-(--text-secondary)">·</span>
            <span className="uppercase font-semibold text-(--accent)">{typography.fontSize}</span>
            <span className="hidden sm:inline text-(--text-secondary)">· {activeLineLabel}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(300px,calc(100vw-2rem))] p-3.5 space-y-3 bg-(--surface-elevated) border-(--border)"
        >
          <div className="text-xs font-semibold text-(--text-primary)">
            {t("novelcrafterTypographyTitle")}
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-(--text-secondary)">
              {t("novelcrafterTypographyFontLabel")}
            </div>
            <div
              role="radiogroup"
              aria-label={t("novelcrafterTypographyFontLabel")}
              className="flex items-center gap-1.5"
            >
              {fontFamilies.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={typography.fontFamily === item.value}
                  onClick={() => onChangeTypography({ fontFamily: item.value })}
                  className={optionBtnClass(typography.fontFamily === item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-(--text-secondary)">
              {t("novelcrafterTypographySizeLabel")}
            </div>
            <div
              role="radiogroup"
              aria-label={t("novelcrafterTypographySizeLabel")}
              className="flex items-center gap-1.5"
            >
              {fontSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={typography.fontSize === size}
                  onClick={() => onChangeTypography({ fontSize: size })}
                  className={cn(optionBtnClass(typography.fontSize === size), "uppercase")}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-(--text-secondary)">
              {t("novelcrafterTypographyLineHeightLabel")}
            </div>
            <div
              role="radiogroup"
              aria-label={t("novelcrafterTypographyLineHeightLabel")}
              className="flex items-center gap-1.5"
            >
              {lineHeights.map((lh) => (
                <button
                  key={lh.value}
                  type="button"
                  aria-pressed={typography.lineHeight === lh.value}
                  onClick={() => onChangeTypography({ lineHeight: lh.value })}
                  className={optionBtnClass(typography.lineHeight === lh.value)}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-pressed={typography.paragraphIndent}
            onClick={() => onChangeTypography({ paragraphIndent: !typography.paragraphIndent })}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              typography.paragraphIndent
                ? "bg-(--accent)/15 border-(--accent) text-(--accent)"
                : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <Pilcrow className="w-3.5 h-3.5" />
              <span>{t("novelcrafterTypographyIndentLabel")}</span>
            </span>
          </button>
        </PopoverContent>
      </Popover>

      <div className="hidden xl:inline-flex items-center rounded-lg border border-(--border) bg-(--control-bg) p-0.5 text-xs">
        {fontSizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChangeTypography({ fontSize: size })}
            title={`${t("novelcrafterTypographySizeLabel")}: ${size.toUpperCase()}`}
            className={cn(
              "px-1.5 py-0.5 rounded-md uppercase font-medium transition-colors",
              typography.fontSize === size
                ? "bg-(--accent)/20 text-(--accent)"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            {size}
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-pressed={typography.paragraphIndent}
        onClick={() => onChangeTypography({ paragraphIndent: !typography.paragraphIndent })}
        title={t("novelcrafterTypographyIndentLabel")}
        aria-label={t("novelcrafterTypographyIndentLabel")}
        className={cn(
          "hidden lg:inline-flex items-center justify-center p-1.5 rounded-lg border text-xs transition-colors",
          typography.paragraphIndent
            ? "bg-(--accent)/15 border-(--accent) text-(--accent)"
            : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
        )}
      >
        <Pilcrow className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
