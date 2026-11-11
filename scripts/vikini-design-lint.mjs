/**
 * Vikini 3.0 Design Token & Typography ESLint Plugin (Phase 6D).
 *
 * Enforces:
 * 1. `no-raw-tailwind-colors`: bans raw Tailwind palette classes (`bg-blue-500`, `text-white`,
 *    `bg-black/60`, `border-white/10`) and arbitrary hex/rgb color classes (`bg-[#0a0a0a]`).
 * 2. `no-legacy-tokens`: bans removed Vikini 2.x CSS custom property aliases (`--surface-muted`,
 *    `--text-primary`, `--control-bg`, `--border`, `--accent-foreground`, etc.).
 * 3. `no-sub-12px-text`: bans font-size utility classes smaller than 12px (`text-[10px]`, `text-[0.65rem]`).
 */

const RAW_TAILWIND_PALETTE_RE =
  /(?<![a-zA-Z0-9_-])(?:[a-z0-9-]+:)*(?:!)?(?:bg|text|border|ring|outline|from|via|to|fill|stroke|divide|placeholder|decoration|accent|caret|shadow)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)(?:\/[0-9]+)?|(?:white|black)(?:\/[0-9]+)?)(?![a-zA-Z0-9_-])/g;

const ARBITRARY_TAILWIND_COLOR_RE =
  /(?<![a-zA-Z0-9_-])(?:[a-z0-9-]+:)*(?:!)?(?:bg|text|border|ring|outline|from|via|to|fill|stroke|shadow)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\([^\]]+\))\](?:\/[0-9]+)?/g;

const LEGACY_TOKEN_RE =
  /(?<![a-zA-Z0-9_-])--(?:surface-strong|surface-muted|surface-elevated|control-bg-hover|control-bg|control-border|text-primary|text-secondary|accent-foreground|primary-light|primary-dark|bg-glow|border(?![a-zA-Z0-9_-])|primary(?![a-zA-Z0-9_-]))/g;

const SUB_12PX_CLASS_RE =
  /(?<![a-zA-Z0-9_-])(?:[a-z0-9-]+:)*(?:!)?text-\[(?:(?:[0-9]|1[01])(?:\.[0-9]+)?px|0\.[0-6][0-9]*rem)\]/g;

const UPPERCASE_CLASS_RE = /(?<![a-zA-Z0-9_-])(?:[a-z0-9-]+:)*(?:!)?uppercase(?![a-zA-Z0-9_-])/g;

/**
 * @param {string} value
 * @returns {string[]}
 */
export function findRawTailwindColors(value) {
  if (typeof value !== "string" || !value) return [];
  const matches = [
    ...value.matchAll(RAW_TAILWIND_PALETTE_RE),
    ...value.matchAll(ARBITRARY_TAILWIND_COLOR_RE),
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return matches.map((m) => m[0]);
}

/**
 * @param {string} value
 * @returns {string[]}
 */
export function findLegacyTokens(value) {
  if (typeof value !== "string" || !value) return [];
  return [...value.matchAll(LEGACY_TOKEN_RE)].map((m) => m[0]);
}

/**
 * @param {string} value
 * @returns {string[]}
 */
export function findSub12PxClasses(value) {
  if (typeof value !== "string" || !value) return [];
  return [...value.matchAll(SUB_12PX_CLASS_RE)].map((m) => m[0]);
}

/**
 * @param {string} value
 * @returns {string[]}
 */
export function findUppercaseClasses(value) {
  if (typeof value !== "string" || !value) return [];
  return Array.from(new Set([...value.matchAll(UPPERCASE_CLASS_RE)].map((m) => m[0])));
}

/**
 * @param {(text: string) => string[]} finder
 * @param {(token: string) => string} buildMessage
 * @returns {import("eslint").Rule.RuleModule}
 */
function createStringTokenRule(finder, buildMessage) {
  return {
    meta: {
      type: "problem",
      schema: [],
    },
    create(context) {
      /**
       * @param {import("estree").Node} node
       * @param {string} rawText
       */
      function checkNode(node, rawText) {
        const hits = finder(rawText);
        for (const hit of hits) {
          context.report({
            node,
            message: buildMessage(hit),
          });
        }
      }

      return {
        Literal(node) {
          if (typeof node.value === "string") {
            // Skip import/export source specifiers
            const parentType = node.parent?.type;
            if (
              parentType === "ImportDeclaration" ||
              parentType === "ExportAllDeclaration" ||
              parentType === "ExportNamedDeclaration"
            ) {
              return;
            }
            checkNode(node, node.value);
          }
        },
        TemplateElement(node) {
          if (typeof node.value?.cooked === "string") {
            checkNode(node, node.value.cooked);
          }
        },
      };
    },
  };
}

export const vikiniDesignPlugin = {
  meta: {
    name: "vikini-design",
    version: "1.0.0",
  },
  rules: {
    "no-raw-tailwind-colors": createStringTokenRule(
      findRawTailwindColors,
      (token) =>
        `Raw color utility "${token}" is banned in Vikini 3.0. Use semantic CSS tokens (--bg, --surface, --raised, --line, --text, --muted, --faint, --accent, --on-accent, --soft, --danger, --success, --warning, --overlay, --on-overlay).`
    ),
    "no-legacy-tokens": createStringTokenRule(
      findLegacyTokens,
      (token) =>
        `Legacy Vikini 2.x token alias "${token}" was removed in Phase 6. Use Vikini 3.0 semantic tokens instead.`
    ),
    "no-sub-12px-text": createStringTokenRule(
      findSub12PxClasses,
      (token) =>
        `Sub-12px font size utility "${token}" is banned in Vikini 3.0 (minimum 12px / text-xs).`
    ),
    "no-uppercase": createStringTokenRule(
      findUppercaseClasses,
      (token) =>
        `Uppercase utility "${token}" is banned in Vikini 3.0 outside sidebar group headings (SidebarSection.tsx).`
    ),
  },
};
