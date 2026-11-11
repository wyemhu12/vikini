import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_THEME_KEY,
  LEGACY_THEME_MAP,
  THEME_FAMILIES,
  THEME_KEYS,
  THEME_MODES,
  getThemeClassMap,
  isThemeFamilyId,
  isThemeKey,
  isThemeMode,
  parseThemeKey,
  resolveThemeKey,
  toThemeKey,
} from "./theme-config";

// Linearize sRGB channel for relative luminance calculation (WCAG 2.2)
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Compute relative luminance of a hex color #RRGGBB
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "").trim();
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

// Compute contrast ratio between two hex colors (L1 >= L2)
function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const LEGACY_EXPECTATIONS: ReadonlyArray<readonly [string, string]> = [
  ["sunset", "hoanghon-dark"],
  ["amber", "hoanghon-dark"],
  ["gold", "hoanghon-dark"],
  ["blueprint", "muc-dark"],
  ["indigo", "muc-dark"],
  ["nebula", "muc-dark"],
  ["holo", "muc-dark"],
  ["allied", "muc-dark"],
  ["aqua", "reu-dark"],
  ["rose", "sen-dark"],
  ["red", "sen-dark"],
  ["soviet", "sen-dark"],
  ["yuri", "sen-dark"],
  ["orchid", "sen-light"],
  ["charcoal", "than-dark"],
  ["pitch-black", "than-dark"],
];

const TOKENS = [
  "--bg",
  "--surface",
  "--raised",
  "--line",
  "--text",
  "--muted",
  "--faint",
  "--accent",
  "--on-accent",
  "--soft",
  "--glow",
] as const;

describe("theme-config — model", () => {
  it("TC-01: defines 5 families × 2 modes with Hoàng Hôn dark as default", () => {
    expect(THEME_FAMILIES.map((f) => f.id)).toEqual(["hoanghon", "muc", "reu", "sen", "than"]);
    expect(THEME_MODES).toEqual(["dark", "light"]);
    expect(THEME_KEYS).toEqual([
      "hoanghon-dark",
      "hoanghon-light",
      "muc-dark",
      "muc-light",
      "reu-dark",
      "reu-light",
      "sen-dark",
      "sen-light",
      "than-dark",
      "than-light",
    ]);
    expect(DEFAULT_THEME_KEY).toBe("hoanghon-dark");
  });

  it.each(LEGACY_EXPECTATIONS)("TC-02: migrates legacy '%s' → '%s'", (legacyId, expected) => {
    expect(resolveThemeKey(legacyId), `legacy id '${legacyId}' mapped wrongly`).toBe(expected);
  });

  it("TC-02: LEGACY_THEME_MAP covers exactly the 16 legacy ids", () => {
    expect(Object.keys(LEGACY_THEME_MAP).sort()).toEqual(
      LEGACY_EXPECTATIONS.map(([id]) => id).sort()
    );
  });

  it("TC-03: resolveThemeKey is idempotent", () => {
    for (const key of THEME_KEYS) expect(resolveThemeKey(key)).toBe(key);
    for (const [legacyId] of LEGACY_EXPECTATIONS) {
      const once = resolveThemeKey(legacyId);
      expect(resolveThemeKey(once)).toBe(once);
    }
  });

  it.each([
    undefined,
    null,
    "",
    "system",
    "light",
    "dark",
    "HOANGHON-DARK",
    "hoanghon",
    "hoanghon-dim",
    "__proto__",
    "constructor",
    "toString",
  ])("TC-04: falls back to default for invalid value %s", (value) => {
    expect(resolveThemeKey(value)).toBe(DEFAULT_THEME_KEY);
  });

  it("TC-05: parseThemeKey splits valid keys and rejects the rest", () => {
    expect(parseThemeKey("reu-light")).toEqual({ family: "reu", mode: "light" });
    expect(parseThemeKey("reu")).toBeNull();
    expect(parseThemeKey("reu-light-x")).toBeNull();
    expect(parseThemeKey("foo-dark")).toBeNull();
    expect(parseThemeKey("")).toBeNull();
  });

  it("TC-06: toThemeKey round-trips and guards reject non-strings", () => {
    for (const family of THEME_FAMILIES) {
      for (const mode of THEME_MODES) {
        expect(parseThemeKey(toThemeKey(family.id, mode))).toEqual({ family: family.id, mode });
      }
    }
    for (const value of [42, {}, null]) {
      expect(isThemeKey(value)).toBe(false);
      expect(isThemeFamilyId(value)).toBe(false);
      expect(isThemeMode(value)).toBe(false);
    }
  });

  it("TC-07: getThemeClassMap maps 26 ids to single class tokens with a null prototype", () => {
    const map = getThemeClassMap();
    expect(Object.keys(map)).toHaveLength(26);
    expect(map["muc-light"]).toBe("theme-muc-light");
    expect(map["orchid"]).toBe("theme-sen-light");
    for (const value of Object.values(map)) {
      expect(value).toMatch(/^theme-(hoanghon|muc|reu|sen|than)-(dark|light)$/);
    }
    expect(Object.getPrototypeOf(map)).toBeNull();
    expect(map["__proto__"]).toBeUndefined();
    expect(map["constructor"]).toBeUndefined();
    expect(map["toString"]).toBeUndefined();
  });
});

describe("theme-config — CSS themes", () => {
  const themesDir = path.resolve(__dirname, "../../app/styles/themes");
  const globalsPath = path.resolve(__dirname, "../../app/globals.css");
  const baseCss = fs.readFileSync(path.join(themesDir, "_shared/base.css"), "utf-8");

  function getThemeBlock(key: string): string {
    const family = key.slice(0, key.lastIndexOf("-"));
    const filePath = path.join(themesDir, `${family}.css`);
    if (!fs.existsSync(filePath)) return "";
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(new RegExp(`\\.theme-${key}\\s*\\{([^}]+)\\}`));
    return match ? match[1] : "";
  }

  function getToken(block: string, token: string): string {
    const match = block.match(new RegExp(`${token}:\\s*([^;]+);`));
    return match ? match[1].trim() : "";
  }

  describe.each(THEME_KEYS.map((key) => [key]))("theme '%s'", (key) => {
    const block = getThemeBlock(key);

    it("TC-08: defines all 11 tokens and the matching color-scheme", () => {
      expect(block, `.theme-${key} block missing`).not.toBe("");
      for (const token of TOKENS) {
        expect(getToken(block, token), `Theme '${key}' missing ${token}`).not.toBe("");
      }
      expect(getToken(block, "color-scheme")).toBe(key.endsWith("-light") ? "light" : "dark");
    });

    it("TC-09: satisfies WCAG 2.2 contrast thresholds", () => {
      const pairs: ReadonlyArray<readonly [string, string, number]> = [
        ["--text", "--bg", 7],
        ["--muted", "--bg", 4.5],
        ["--faint", "--bg", 4.5],
        ["--on-accent", "--accent", 4.5],
        ["--accent", "--bg", 3],
      ];
      for (const [tokenA, tokenB, threshold] of pairs) {
        const a = getToken(block, tokenA);
        const b = getToken(block, tokenB);
        const ratio = getContrastRatio(a, b);
        expect(
          ratio,
          `Theme '${key}' ${tokenA} (${a}) vs ${tokenB} (${b}) = ${ratio.toFixed(2)}:1 < ${threshold}`
        ).toBeGreaterThanOrEqual(threshold);
      }
    });
  });

  it("TC-10: legacy theme folders are gone and new themes are wired after base.css", () => {
    for (const folder of ["focus", "glassmorphism", "ra2"]) {
      expect(fs.existsSync(path.join(themesDir, folder)), `${folder}/ still exists`).toBe(false);
    }

    const globals = fs.readFileSync(globalsPath, "utf-8");
    const themeImports = [...globals.matchAll(/@import "\.\/styles\/themes\/([a-z]+)\.css";/g)].map(
      (m) => m[1]
    );
    expect(themeImports).toEqual(THEME_FAMILIES.map((f) => f.id));
    const baseIndex = globals.indexOf('@import "./styles/themes/_shared/base.css";');
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(
      globals.indexOf(`@import "./styles/themes/${THEME_FAMILIES[0].id}.css";`)
    ).toBeGreaterThan(baseIndex);

    const removedAliases = [
      "--surface-strong",
      "--surface-muted",
      "--surface-elevated",
      "--border",
      "--control-bg",
      "--control-bg-hover",
      "--control-border",
      "--text-primary",
      "--text-secondary",
      "--accent-foreground",
      "--primary",
      "--primary-light",
      "--primary-dark",
      "--bg-glow",
    ];
    for (const alias of removedAliases) {
      expect(baseCss, `base.css still defines legacy alias ${alias}`).not.toMatch(
        new RegExp(`(?<![a-zA-Z0-9_-])${alias}\\s*:`)
      );
      expect(baseCss, `base.css still references legacy alias ${alias}`).not.toMatch(
        new RegExp(`var\\(${alias}\\)`)
      );
    }

    const typeScale: ReadonlyArray<readonly [string, string]> = [
      ["--type-12", "0.75rem"],
      ["--type-13", "0.8125rem"],
      ["--type-14", "0.875rem"],
      ["--type-16", "1rem"],
      ["--type-20", "1.25rem"],
      ["--type-24", "1.5rem"],
      ["--type-32", "2rem"],
    ];
    for (const [token, expectedRem] of typeScale) {
      expect(baseCss, `base.css missing ${token}`).toContain(`${token}: ${expectedRem};`);
    }
    expect(baseCss).toContain("--on-overlay: #ffffff;");
    expect(baseCss).not.toContain("data-theme-tone");
  });
});
