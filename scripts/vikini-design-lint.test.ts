import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  findLegacyTokens,
  findRawTailwindColors,
  findSub12PxClasses,
  findUppercaseClasses,
  vikiniDesignPlugin,
} from "./vikini-design-lint.mjs";

const require = createRequire(import.meta.url);
const { Linter } = require("eslint") as typeof import("eslint");
const tsparser = require("@typescript-eslint/parser") as import("eslint").Linter.Parser;

function lintTsx(code: string) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          parser: tsparser,
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: { jsx: true },
          },
        },
        plugins: {
          "vikini-design": vikiniDesignPlugin,
        },
        rules: {
          "vikini-design/no-raw-tailwind-colors": "error",
          "vikini-design/no-legacy-tokens": "error",
          "vikini-design/no-sub-12px-text": "error",
          "vikini-design/no-uppercase": "error",
        },
      },
    ],
    "src/app/Example.tsx"
  );
}

describe("vikini-design-lint (Phase 6D TC-01..TC-03)", () => {
  it("TC-01: flags raw Tailwind palette and arbitrary hex classes while allowing semantic tokens and SVG brand fills", () => {
    expect(findRawTailwindColors("px-3 bg-blue-500 text-white hover:bg-black/60")).toEqual([
      "bg-blue-500",
      "text-white",
      "hover:bg-black/60",
    ]);
    expect(findRawTailwindColors("rounded-xl bg-[#0a0a0a] border-white/10")).toEqual([
      "bg-[#0a0a0a]",
      "border-white/10",
    ]);
    expect(
      findRawTailwindColors("bg-(--accent) text-(--on-accent) border-(--line) bg-(--overlay)")
    ).toEqual([]);

    const badMessages = lintTsx(
      `export function Btn() { return <button className="bg-purple-600 text-white">Go</button>; }`
    );
    expect(
      badMessages.filter((m) => m.ruleId === "vikini-design/no-raw-tailwind-colors")
    ).toHaveLength(2);

    const okMessages = lintTsx(
      `export function Icon() { return <svg><path fill="#4285F4" className="text-(--accent)" /></svg>; }`
    );
    expect(okMessages).toEqual([]);
  });

  it("TC-02: flags sub-12px font size classes while allowing >= 12px classes", () => {
    expect(findSub12PxClasses("text-[10px] md:text-[9px] text-[0.65rem]")).toEqual([
      "text-[10px]",
      "md:text-[9px]",
      "text-[0.65rem]",
    ]);
    expect(findSub12PxClasses("text-xs text-13 text-[13px] text-[15px] text-sm")).toEqual([]);

    const msgs = lintTsx(
      `export function Tag() { return <span className="text-[11px] font-medium">Badge</span>; }`
    );
    expect(msgs.map((m) => m.ruleId)).toEqual(["vikini-design/no-sub-12px-text"]);
  });

  it("TC-03: flags removed Vikini 2.x legacy CSS token aliases without false positives on @theme --color-*", () => {
    expect(
      findLegacyTokens("bg-(--surface-muted) border-(--border) text-(--text-primary)")
    ).toEqual(["--surface-muted", "--border", "--text-primary"]);
    expect(findLegacyTokens("--color-border --color-primary bg-(--raised) text-(--text)")).toEqual(
      []
    );

    const msgs = lintTsx(
      `export function Box() { return <div className="bg-(--control-bg) text-(--accent-foreground)" />; }`
    );
    expect(msgs.filter((m) => m.ruleId === "vikini-design/no-legacy-tokens")).toHaveLength(2);
  });

  it("TC-6E-04: flags uppercase utility classes while allowing normal classes and non-token identifiers", () => {
    expect(findUppercaseClasses("text-xs uppercase tracking-wider")).toEqual(["uppercase"]);
    expect(findUppercaseClasses("md:uppercase !uppercase hover:uppercase")).toEqual([
      "md:uppercase",
      "!uppercase",
      "hover:uppercase",
    ]);
    expect(
      findUppercaseClasses("text-xs font-medium normal-case is_uppercase uppercaseText")
    ).toEqual([]);

    const msgs = lintTsx(
      `export function Heading() { return <span className="text-xs uppercase tracking-wider">Label</span>; }`
    );
    expect(msgs.map((m) => m.ruleId)).toEqual(["vikini-design/no-uppercase"]);
  });
});
