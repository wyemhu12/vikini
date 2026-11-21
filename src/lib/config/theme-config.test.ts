import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
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

    it("TC-09: satisfies WCAG 2.2 contrast thresholds across bg, surface, raised and state colors", () => {
      const pairs: ReadonlyArray<readonly [string, string, number]> = [
        ["--text", "--bg", 7],
        ["--muted", "--bg", 4.5],
        ["--muted", "--raised", 4.5],
        ["--faint", "--bg", 4.5],
        ["--faint", "--raised", 4.5],
        ["--on-accent", "--accent", 4.5],
        ["--accent", "--bg", 4.5],
        ["--accent", "--raised", 4.5],
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

      // Check mode-specific semantic state colors from base.css
      const isLight = key.endsWith("-light");
      const rootBlock = baseCss.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
      const lightBlock = baseCss.match(/\.theme-hoanghon-light[\s\S]*?\{([^}]+)\}/)?.[1] ?? "";
      const stateBlock = isLight ? lightBlock : rootBlock;

      const danger = getToken(stateBlock, "--danger");
      const dangerHover = getToken(stateBlock, "--danger-hover");
      const dangerFg = getToken(stateBlock, "--danger-foreground");
      const success = getToken(stateBlock, "--success");
      const warning = getToken(stateBlock, "--warning");

      for (const surfaceToken of ["--bg", "--surface", "--raised"] as const) {
        const surfaceHex = getToken(block, surfaceToken);
        for (const [stateName, stateHex] of [
          ["--danger", danger],
          ["--success", success],
          ["--warning", warning],
        ] as const) {
          const ratio = getContrastRatio(stateHex, surfaceHex);
          expect(
            ratio,
            `Theme '${key}' ${stateName} (${stateHex}) vs ${surfaceToken} (${surfaceHex}) = ${ratio.toFixed(2)}:1 < 4.5`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }

      expect(
        getContrastRatio(dangerFg, danger),
        `Theme '${key}' --danger-foreground vs --danger`
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(dangerFg, dangerHover),
        `Theme '${key}' --danger-foreground vs --danger-hover`
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("TC-09b (Negative Probe): rejects legacy failing contrast pairs", () => {
    expect(getContrastRatio("#c2410c", "#f3eae1")).toBeLessThan(4.5);
    expect(getContrastRatio("#22c55e", "#f3eae1")).toBeLessThan(4.5);
    expect(getContrastRatio("#ef4444", "#ffffff")).toBeLessThan(4.5);
    expect(getContrastRatio("#ecedf0", "#f2f2f2")).toBeLessThan(3);
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
    const animIndex = globals.indexOf('@import "./styles/themes/_shared/animations.css";');
    const hljsIndex = globals.indexOf('@import "./styles/themes/_shared/hljs.css";');
    const firstThemeIndex = globals.indexOf(
      `@import "./styles/themes/${THEME_FAMILIES[0].id}.css";`
    );
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(animIndex).toBeGreaterThan(baseIndex);
    expect(hljsIndex).toBeGreaterThan(baseIndex);
    expect(firstThemeIndex).toBeGreaterThan(animIndex);
    expect(firstThemeIndex).toBeGreaterThan(hljsIndex);
    expect(THEME_FAMILIES.find((f) => f.id === "hoanghon")?.swatch.light).toBe("#b33a08");

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

  it("TC-11 (NP-1): tokens.css is layered in @layer components without @theme collisions and zero legacy token callers remain", () => {
    const tokensCssPath = path.resolve(themesDir, "_shared/tokens.css");
    const tokensCss = fs.readFileSync(tokensCssPath, "utf-8");
    expect(tokensCss).toContain("@layer components");
    expect(tokensCss).not.toMatch(/\.text-primary\b/);
    expect(tokensCss).not.toMatch(/\.text-secondary\b/);
    expect(tokensCss).not.toMatch(/\.bg-accent\b/);
    expect(tokensCss).not.toMatch(/\.text-accent\b/);

    const legacyClassPattern =
      /(?<![a-zA-Z0-9_-])(text-primary|text-secondary|bg-surface|bg-surface-muted|bg-surface-elevated|bg-control|bg-control-hover|border-token|border-control|card-surface)(?![a-zA-Z0-9_-])/;

    const srcRoot = path.resolve(process.cwd(), "src");
    const targets = [
      ...collectSourceFiles(path.join(srcRoot, "app")),
      ...collectSourceFiles(path.join(srcRoot, "components")),
    ];
    const violations: string[] = [];
    for (const filePath of targets) {
      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(legacyClassPattern);
      if (match) {
        violations.push(`${path.relative(process.cwd(), filePath)}: ${match[0]}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("TC-12 (TC-P5-01/02/03/08): zero dead hovers, zero transition-all, zero z-50 on standardized targets, zero useChatTranslations", () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const uiTargets = [
      ...collectSourceFiles(path.join(srcRoot, "app")),
      ...collectSourceFiles(path.join(srcRoot, "components")),
    ];

    const deadHoverHits: string[] = [];
    const transitionAllHits: string[] = [];
    for (const filePath of uiTargets) {
      const content = fs.readFileSync(filePath, "utf-8");
      const rel = path.relative(process.cwd(), filePath);
      for (const hit of findDeadHoverViolations(content)) {
        deadHoverHits.push(`${rel}: ${hit}`);
      }
      for (const hit of findTransitionAllViolations(content)) {
        transitionAllHits.push(`${rel}: ${hit}`);
      }
    }
    expect(deadHoverHits).toEqual([]);
    expect(transitionAllHits).toEqual([]);

    const zIndexTargets = [
      "src/app/features/chat/components/ChatApp.tsx",
      "src/app/features/layout/components/RootSkipLink.tsx",
      "src/app/features/chat/components/FileManagerPanel.tsx",
      "src/app/features/image-gen/components/ControlPanel.tsx",
      "src/app/features/image-gen/components/ControlPanelPromptSection.tsx",
      "src/app/features/gallery/components/ImageCompareModal.tsx",
      "src/app/features/gems/components/GemModal.tsx",
      "src/app/features/personas/components/PersonaModal.tsx",
    ];
    const z50Pattern = /(?<![a-zA-Z0-9_-])z-50(?![a-zA-Z0-9_-])/;
    const z50Hits: string[] = [];
    for (const relPath of zIndexTargets) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
      if (z50Pattern.test(content)) {
        z50Hits.push(relPath);
      }
    }
    expect(z50Hits).toEqual([]);

    const allSrcFiles = collectSourceFiles(srcRoot);
    const chatTranslationsHits = allSrcFiles
      .filter((fp) => fs.readFileSync(fp, "utf-8").includes("useChatTranslations"))
      .map((fp) => path.relative(process.cwd(), fp));
    expect(chatTranslationsHits).toEqual([]);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "src/app/features/chat/components/hooks/useChatTranslations.ts")
      )
    ).toBe(false);
  });

  it("TC-12b (Negative Probe NP-1/NP-2): dead-hover and transition-all scanners catch violations without false positives", () => {
    expect(findDeadHoverViolations('"bg-(--raised) hover:bg-(--raised)"').length).toBeGreaterThan(
      0
    );
    expect(
      findDeadHoverViolations('"bg-(--raised) border-(--line) hover:bg-(--raised)"').length
    ).toBeGreaterThan(0);
    expect(
      findDeadHoverViolations(
        "const el = <div className={`bg-(--raised) hover:bg-(--raised) ${extra}`} />;"
      ).length
    ).toBeGreaterThan(0);

    expect(findDeadHoverViolations('"bg-(--raised) hover:bg-(--raised-hover)"')).toEqual([]);
    expect(findDeadHoverViolations('"bg-(--raised)/70 hover:bg-(--raised)"')).toEqual([]);
    expect(
      findDeadHoverViolations(
        'const el = <div className={`${active ? "bg-(--raised)" : "hover:bg-(--raised)"}`} />;'
      )
    ).toEqual([]);

    expect(findTransitionAllViolations('"px-3 transition-all"').length).toBeGreaterThan(0);
    expect(
      findTransitionAllViolations('"px-2 transition-all duration-200"').length
    ).toBeGreaterThan(0);
    expect(findTransitionAllViolations('"px-3 transition-[filter,opacity]"')).toEqual([]);
  });

  it("TC-13 (CT-6D-01): zero lucide namespace imports, zero t Record prop-drilling, hooks <= 350L, UserManager <= 500L, zero bg-(--soft) dead hovers, thin chat redirect", () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const allSrcFiles = collectSourceFiles(srcRoot);
    const appFiles = collectSourceFiles(path.join(srcRoot, "app"));
    const uiTargets = [...appFiles, ...collectSourceFiles(path.join(srcRoot, "components"))];

    const lucideNamespaceHits = allSrcFiles
      .filter((fp) => findLucideNamespaceImport(fs.readFileSync(fp, "utf-8")))
      .map((fp) => path.relative(process.cwd(), fp));
    expect(lucideNamespaceHits).toEqual([]);

    const propDrillingHits = uiTargets
      .filter((fp) => findTranslationPropDrilling(fs.readFileSync(fp, "utf-8")))
      .map((fp) => path.relative(process.cwd(), fp));
    expect(propDrillingHits).toEqual([]);

    const oversizedHooks = appFiles
      .filter((fp) => /^use[A-Z].*\.(ts|tsx)$/.test(path.basename(fp)))
      .map((fp) => ({
        file: path.relative(process.cwd(), fp),
        lines: countFileLines(fs.readFileSync(fp, "utf-8")),
      }))
      .filter((entry) => entry.lines > MAX_HOOK_LINES);
    expect(oversizedHooks).toEqual([]);

    const userManagerPath = path.resolve(process.cwd(), "src/app/admin/components/UserManager.tsx");
    const userManagerLines = countFileLines(fs.readFileSync(userManagerPath, "utf-8"));
    expect(userManagerLines).toBeLessThanOrEqual(MAX_USER_MANAGER_LINES);

    const softDeadHoverHits: string[] = [];
    for (const filePath of uiTargets) {
      const content = fs.readFileSync(filePath, "utf-8");
      const rel = path.relative(process.cwd(), filePath);
      for (const hit of findSoftDeadHoverViolations(content)) {
        softDeadHoverHits.push(`${rel}: ${hit}`);
      }
    }
    expect(softDeadHoverHits).toEqual([]);

    const chatRedirectPath = path.resolve(process.cwd(), "src/app/features/chat/page.tsx");
    const chatRedirectSource = fs.readFileSync(chatRedirectPath, "utf-8");
    expect(chatRedirectSource).toContain("redirect(");
    expect(countFileLines(chatRedirectSource)).toBeLessThanOrEqual(30);
  });

  it("TC-13b (Negative Probes NP-1/NP-2/NP-3): Phase 6 static scanners catch violations without false positives", () => {
    expect(findLucideNamespaceImport('import * as Icons from "lucide-react";')).toBe(true);
    expect(findLucideNamespaceImport("import * as LucideIcons from 'lucide-react'")).toBe(true);
    expect(findLucideNamespaceImport('import { Sparkles, Star } from "lucide-react";')).toBe(false);

    expect(findTranslationPropDrilling("interface Props { t?: Record<string, string>; }")).toBe(
      true
    );
    expect(findTranslationPropDrilling("interface Props { t: Record<string, string>; }")).toBe(
      true
    );
    expect(findTranslationPropDrilling("interface Props { t: (key: string) => string; }")).toBe(
      false
    );

    expect(
      findSoftDeadHoverViolations('"bg-(--soft) text-(--accent) hover:bg-(--soft)"').length
    ).toBeGreaterThan(0);
    expect(
      findSoftDeadHoverViolations('"bg-(--soft) text-(--accent) hover:bg-(--raised-hover)"')
    ).toEqual([]);
    expect(
      findSoftDeadHoverViolations(
        'const el = <div className={`${active ? "bg-(--soft)" : "hover:bg-(--soft)"}`} />;'
      )
    ).toEqual([]);
  });
});

const SOLID_BG_RAISED = /(?<![a-zA-Z0-9_:-])bg-\(--raised\)(?![/\w-])/;
const HOVER_BG_RAISED = /(?<![a-zA-Z0-9_-])hover:bg-\(--raised\)(?![/\w-])/;
const SOLID_BG_SOFT = /(?<![a-zA-Z0-9_:-])bg-\(--soft\)(?![/\w-])/;
const HOVER_BG_SOFT = /(?<![a-zA-Z0-9_-])hover:bg-\(--soft\)(?![/\w-])/;
const TRANSITION_ALL_TOKEN = /(?<![a-zA-Z0-9_-])transition-all(?![a-zA-Z0-9_-])/;
const LUCIDE_NAMESPACE_IMPORT = /import\s+\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s+["']lucide-react["']/;
const TRANSLATION_PROP_DRILLING = /\bt\??\s*:\s*Record<\s*string\s*,\s*string\s*>/;
const MAX_HOOK_LINES = 350;
const MAX_USER_MANAGER_LINES = 500;

function countFileLines(source: string): number {
  const normalized = source.endsWith("\n") ? source.slice(0, -1) : source;
  return normalized.length === 0 ? 0 : normalized.split("\n").length;
}

function findLucideNamespaceImport(source: string): boolean {
  return LUCIDE_NAMESPACE_IMPORT.test(source);
}

function findTranslationPropDrilling(source: string): boolean {
  return TRANSLATION_PROP_DRILLING.test(source);
}

function findSoftDeadHoverViolations(source: string): string[] {
  if (!source.includes("bg-(--soft)")) return [];
  return extractStaticClassChunks(source)
    .filter((chunk) => SOLID_BG_SOFT.test(chunk) && HOVER_BG_SOFT.test(chunk))
    .map((chunk) => chunk.trim());
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function extractStaticClassChunks(source: string): string[] {
  const sf = ts.createSourceFile(
    "scan.tsx",
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  );
  const chunks: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      chunks.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return chunks;
}

function findDeadHoverViolations(source: string): string[] {
  if (!source.includes("bg-(--raised)")) return [];
  return extractStaticClassChunks(source)
    .filter((chunk) => SOLID_BG_RAISED.test(chunk) && HOVER_BG_RAISED.test(chunk))
    .map((chunk) => chunk.trim());
}

function findTransitionAllViolations(source: string): string[] {
  if (!source.includes("transition-all")) return [];
  return extractStaticClassChunks(source)
    .filter((chunk) => TRANSITION_ALL_TOKEN.test(chunk))
    .map((chunk) => chunk.trim());
}
