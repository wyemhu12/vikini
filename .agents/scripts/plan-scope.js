// @ts-check
/**
 * Plan approval evaluation and declared-file scope extraction (P1-7).
 */

import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, toRepoRelative, normalizeForCompare } from "./guard-paths.js";

/**
 * Checks whether the first 30 lines of a plan file contain an explicit
 * `- **Status**: Approved` or `- **Trạng thái**: Approved` header line.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function hasApprovedPlanHeader(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  const headerLines = content.split(/\r?\n/).slice(0, 30).join("\n");
  return /^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Approved\s*$/im.test(headerLines);
}

/**
 * Checks whether the first 30 lines of a plan file contain an explicit
 * `- **Status**: Completed` or `- **Trạng thái**: Completed` header line.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function hasCompletedPlanHeader(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  const headerLines = content.split(/\r?\n/).slice(0, 30).join("\n");
  return /^(?:-\s*)?\*\*(?:Status|Trạng thái)\*\*:\s*Completed\s*$/im.test(headerLines);
}

/**
 * Checks whether the last non-blank line of a plan file strictly equals `"[PLAN_APPROVED]"`.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function hasApprovedPlanFooter(content) {
  if (typeof content !== "string" || !content.trim()) return false;
  const lines = content.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      return trimmed === "[PLAN_APPROVED]";
    }
  }
  return false;
}

/**
 * Evaluates raw markdown content of a single plan file in docs/plans/*.md
 * to determine if it is currently in an active Approved state.
 *
 * @param {string | undefined} content
 * @returns {boolean}
 */
export function evaluatePlanApprovalContent(content) {
  return hasApprovedPlanHeader(content) && hasApprovedPlanFooter(content);
}

/**
 * Single-Step Pre-Approved Plan Guard helper: detects whether a full-file write
 * (`write_to_file` / `write_file` / `Write`) targeting `docs/plans/*.md` pre-populates
 * `Status: Approved` in the first 30 lines OR `[PLAN_APPROVED]` on the last non-blank line.
 *
 * @param {string | undefined} newContent
 * @returns {boolean}
 */
export function isSelfForgedPlanWrite(newContent) {
  return hasApprovedPlanHeader(newContent) || hasApprovedPlanFooter(newContent);
}

/**
 * Extracts repo-relative POSIX paths declared with `[NEW]`, `[MODIFY]`, or `[DELETE]`
 * inside the `## Technical Plan` section (strictly before `## Audit History`).
 * Rejects globs (`*`, `?`), directory paths (ending with `/` or `\`), and traversal (`..`).
 *
 * @param {string | undefined} content
 * @returns {string[]} Sorted list of repo-relative POSIX file paths
 */
export function extractDeclaredFiles(content) {
  if (typeof content !== "string" || !content.trim()) return [];

  const lines = content.split(/\r?\n/);
  const hasTechPlanHeading = lines.some((l) => /^##\s+Technical Plan\b/i.test(l.trim()));
  let inTechPlan = !hasTechPlanHeading;

  /** @type {Map<string, string>} */
  const byNormalized = new Map();

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^##\s+Audit History\b/i.test(trimmed)) {
      break;
    }
    if (/^##\s+Technical Plan\b/i.test(trimmed)) {
      inTechPlan = true;
      continue;
    }
    if (!inTechPlan) continue;

    const tagMatch = rawLine.match(/`?\[(?:NEW|MODIFY|DELETE)\]`?/);
    if (!tagMatch || tagMatch.index === undefined) continue;

    const afterTag = rawLine.slice(tagMatch.index + tagMatch[0].length);
    const cleaned = afterTag.replace(/^[\s|\-:]+/, "");
    if (!cleaned) continue;

    /** @type {string | undefined} */
    let candidate;

    // 1. Markdown link with backticks: [`src/d.ts`](file:///...)
    const mdBacktickMatch = cleaned.match(/^\[`([^`]+)`\]\([^)]*\)/);
    if (mdBacktickMatch) {
      candidate = mdBacktickMatch[1];
    } else {
      // 2. Markdown link without backticks: [src/d.ts](file:///...)
      const mdPlainMatch = cleaned.match(/^\[([^\]]+)\]\([^)]*\)/);
      if (mdPlainMatch) {
        candidate = mdPlainMatch[1];
      } else {
        // 3. Backtick-wrapped path at start of remainder: `src/b.tsx`
        const backtickMatch = cleaned.match(/^`([^`]+)`/);
        if (backtickMatch) {
          candidate = backtickMatch[1];
        } else {
          // 4. First non-whitespace token (before space, pipe, or colon followed by space)
          const tokenMatch = cleaned.match(/^([^\s|]+?)(?:[:;,]|$|\s)/);
          if (tokenMatch) {
            candidate = tokenMatch[1];
          }
        }
      }
    }

    if (!candidate) continue;
    const rawPath = candidate.trim();
    if (!rawPath) continue;

    // Reject globs, trailing slashes (directories), and parent traversal segments
    if (rawPath.includes("*") || rawPath.includes("?")) continue;
    if (rawPath.endsWith("/") || rawPath.endsWith("\\")) continue;
    if (/(?:^|[/\\])\.\.(?:[/\\]|$)/.test(rawPath)) continue;

    const rel = toRepoRelative(rawPath);
    if (!rel) continue;

    const norm = normalizeForCompare(rel);
    if (norm && !byNormalized.has(norm)) {
      byNormalized.set(norm, rel);
    }
  }

  return Array.from(byNormalized.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns all active Approved plan entries from the newest valid `YYYY-MM-DD` date group.
 * If ANY plan in the newest date group is pending (neither Approved nor Completed),
 * returns `[]` (fail-safe freeze).
 *
 * @param {Array<{ filename: string, mtimeMs: number, content: string }>} planEntries
 * @param {{ maxDatePrefix?: string }} [options]
 * @returns {Array<{ filename: string, mtimeMs: number, content: string }>}
 */
export function getActiveApprovedPlans(planEntries, options = {}) {
  if (!Array.isArray(planEntries) || planEntries.length === 0) return [];

  const maxDatePrefix =
    typeof options.maxDatePrefix === "string" && /^\d{4}-\d{2}-\d{2}$/.test(options.maxDatePrefix)
      ? options.maxDatePrefix
      : new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const withPrefix = planEntries
    .map((entry) => {
      const base = path.basename(entry.filename);
      const match = base.match(/^(\d{4}-\d{2}-\d{2})-/);
      return {
        ...entry,
        datePrefix: match ? match[1] : "",
      };
    })
    .filter((item) => item.datePrefix !== "" && item.datePrefix <= maxDatePrefix);

  if (withPrefix.length === 0) return [];

  withPrefix.sort((a, b) => {
    if (a.datePrefix !== b.datePrefix) {
      return b.datePrefix.localeCompare(a.datePrefix);
    }
    return b.mtimeMs - a.mtimeMs;
  });

  const latestDatePrefix = withPrefix[0].datePrefix;
  const latestGroup = withPrefix.filter((item) => item.datePrefix === latestDatePrefix);

  /** @type {Array<{ filename: string, mtimeMs: number, content: string }>} */
  const approvedPlans = [];
  for (const plan of latestGroup) {
    if (evaluatePlanApprovalContent(plan.content)) {
      approvedPlans.push(plan);
    } else if (!hasCompletedPlanHeader(plan.content)) {
      return [];
    }
  }

  return approvedPlans;
}

/**
 * Evaluates all plan files in `docs/plans/` deterministically to check whether the
 * newest date group has at least one Approved plan and no pending plans.
 *
 * @param {Array<{ filename: string, mtimeMs: number, content: string }>} planEntries
 * @param {{ maxDatePrefix?: string }} [options]
 * @returns {boolean}
 */
export function evaluateLatestDateGroupPlans(planEntries, options = {}) {
  return getActiveApprovedPlans(planEntries, options).length > 0;
}

/**
 * Reads `docs/plans/*.md` from disk and returns the active approval status along with
 * the union of all `[NEW]`/`[MODIFY]`/`[DELETE]` files declared in active Approved plans.
 * Fails closed (`{ approved: false, files: [] }`) on any filesystem error.
 *
 * @param {{ plansDir?: string, maxDatePrefix?: string }} [options]
 * @returns {{ approved: boolean, files: string[] }}
 */
export function getApprovedPlanScope(options = {}) {
  try {
    const plansDir = options.plansDir ?? path.join(REPO_ROOT, "docs", "plans");
    if (!fs.existsSync(plansDir)) {
      return { approved: false, files: [] };
    }

    const planEntries = fs
      .readdirSync(plansDir)
      .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
      .map((f) => {
        const fullPath = path.join(plansDir, f);
        return {
          filename: f,
          mtimeMs: fs.statSync(fullPath).mtimeMs,
          content: fs.readFileSync(fullPath, "utf8"),
        };
      });

    const activePlans = getActiveApprovedPlans(planEntries, options);
    if (activePlans.length === 0) {
      return { approved: false, files: [] };
    }

    /** @type {Map<string, string>} */
    const union = new Map();
    for (const plan of activePlans) {
      for (const file of extractDeclaredFiles(plan.content)) {
        const norm = normalizeForCompare(file);
        if (norm && !union.has(norm)) {
          union.set(norm, file);
        }
      }
    }

    return {
      approved: true,
      files: Array.from(union.values()).sort((a, b) => a.localeCompare(b)),
    };
  } catch {
    return { approved: false, files: [] };
  }
}
