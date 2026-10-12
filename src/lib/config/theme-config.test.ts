import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { THEME_CONFIG, THEME_IDS, DEFAULT_THEME, getThemeById } from "./theme-config";

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

describe("theme-config", () => {
  it("defines exactly 16 themes with valid IDs and structure", () => {
    expect(THEME_CONFIG).toHaveLength(16);
    expect(THEME_IDS).toHaveLength(16);
    expect(DEFAULT_THEME).toBe("blueprint");
    expect(THEME_IDS).toContain("orchid");
    expect(THEME_IDS).toContain("blueprint");
  });

  it("configures Orchid Silk as tone 'light' in theme metadata", () => {
    const orchid = getThemeById("orchid");
    expect(orchid).toBeDefined();
    expect(orchid?.tone).toBe("light");
    expect(orchid?.group).toBe("Glassmorphism");
  });

  it("retrieves themes by ID via getThemeById helper", () => {
    const blueprint = getThemeById("blueprint");
    expect(blueprint?.id).toBe("blueprint");
    expect(blueprint?.tone).toBe("dark");

    const nonExistent = getThemeById("unknown-theme");
    expect(nonExistent).toBeUndefined();
  });

  describe("WCAG 2.2 Contrast & Token Integrity across 16 CSS Themes", () => {
    const themesDir = path.resolve(__dirname, "../../app/styles/themes");
    const baseCssPath = path.resolve(themesDir, "_shared/base.css");
    const baseCssContent = fs.readFileSync(baseCssPath, "utf-8");

    // Extract default --accent-foreground from :root in base.css
    const defaultAccentFgMatch = baseCssContent.match(/--accent-foreground:\s*([^;]+);/);
    const defaultAccentFg = defaultAccentFgMatch ? defaultAccentFgMatch[1].trim() : "#0a0a0a";

    // Gather all theme CSS files recursively (excluding _shared base/token files)
    function getCssFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (file === "_shared") continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getCssFiles(fullPath));
        } else if (file.endsWith(".css")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const cssFiles = getCssFiles(themesDir);

    THEME_CONFIG.forEach((theme) => {
      it(`theme '${theme.id}' defines --surface-elevated and satisfies WCAG AA contrast (>= 4.5:1)`, () => {
        // Find selector in CSS files
        let selectorBlock = "";
        for (const file of cssFiles) {
          const content = fs.readFileSync(file, "utf-8");
          const regex = new RegExp(`(?:^|\\n)\\.theme-${theme.id}\\s*\\{([^}]+)\\}`, "s");
          const match = content.match(regex);
          if (match) {
            selectorBlock = match[1];
            break;
          }
        }

        expect(
          selectorBlock,
          `Selector .theme-${theme.id} should be defined in a CSS theme file`
        ).toBeTruthy();

        // 1. Verify --surface-elevated is defined in this selector
        const hasSurfaceElevated = /--surface-elevated:\s*[^;]+;/.test(selectorBlock);
        expect(hasSurfaceElevated, `Theme .theme-${theme.id} must define --surface-elevated`).toBe(
          true
        );

        // 2. Extract --accent
        const accentMatch = selectorBlock.match(/--accent:\s*([^;]+);/);
        expect(accentMatch, `Theme .theme-${theme.id} must define --accent hex color`).toBeTruthy();
        const accentHex = accentMatch![1].trim();

        // 3. Extract --accent-foreground or fallback to base.css default
        const accentFgMatch = selectorBlock.match(/--accent-foreground:\s*([^;]+);/);
        const accentFgHex = accentFgMatch ? accentFgMatch[1].trim() : defaultAccentFg;

        // 4. Calculate contrast ratio against #0a0a0a (or configured fg)
        if (accentHex.startsWith("#") && accentFgHex.startsWith("#")) {
          const ratio = getContrastRatio(accentHex, accentFgHex);
          expect(
            ratio,
            `Theme '${theme.id}' accent (${accentHex}) against fg (${accentFgHex}) must achieve WCAG AA contrast >= 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
    });

    it("verifies :root.theme-orchid has color-scheme: light in base.css", () => {
      expect(baseCssContent).toMatch(
        /:root\.theme-orchid\s*\{[\s\S]*?color-scheme:\s*light;[\s\S]*?\}/
      );
      expect(baseCssContent).not.toMatch(/:root\.theme-orchid,\s*:root\.theme-sunset/);
    });
  });
});
