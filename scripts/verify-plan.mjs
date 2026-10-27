// @ts-check
/* global process, console */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isEnvSecretPath } from "../.agents/scripts/guard-paths.js";
import { extractDeclaredFiles } from "../.agents/scripts/plan-scope.js";

/**
 * @typedef {'PASS' | 'FAIL' | 'WARN' | 'INFO'} FindingLevel
 * @typedef {{ level: FindingLevel, code: string, message: string }} Finding
 * @typedef {{ path: string, start: number, end: number, raw: string }} LineRef
 */

/** 7 mandatory sections of the Plan Completeness Gate inside `## Technical Plan`. */
export const REQUIRED_SECTIONS = [
  { key: "verifiedVersions", label: "Verified Versions", pattern: /Verified Versions/i },
  {
    key: "steps",
    label: "Implementation Steps / Các Bước Thực Hiện",
    pattern: /Các Bước Thực Hiện|Implementation Steps/i,
  },
  { key: "verificationPlan", label: "Verification Plan", pattern: /Verification Plan/i },
  { key: "testContract", label: "Test Contract", pattern: /Test Contract/i },
  { key: "assumptions", label: "Assumptions", pattern: /Assumptions/i },
  {
    key: "outOfScope",
    label: "Out of Scope / What We're NOT Doing",
    pattern: /Out of Scope|What We're NOT Doing/i,
  },
  { key: "skillsLoaded", label: "Skills Loaded", pattern: /Skills Loaded/i },
];

const LINE_REF_REGEX =
  /(?<![\w/.:\\-])((?:[\w@.\-[\w\]]+[/\\])*[\w@.\-[\w\]]+\.[A-Za-z][A-Za-z0-9]{0,7}):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?!\d)/g;

const PLAN_REL_PATH_REGEX = /^docs[/\\]plans[/\\][A-Za-z0-9._-]+\.md$/;

/**
 * Splits a plan markdown document into its `## Technical Plan` and `## Audit History` sections.
 *
 * @param {string} content
 * @returns {{ technicalPlan: string, auditHistory: string }}
 */
export function splitPlanSections(content) {
  if (typeof content !== "string" || !content) {
    return { technicalPlan: "", auditHistory: "" };
  }
  const lines = content.split(/\r?\n/);
  const techIdx = lines.findIndex((l) => /^##\s+Technical Plan\b/i.test(l.trim()));
  const auditIdx = lines.findIndex((l) => /^##\s+Audit History\b/i.test(l.trim()));

  const techStart = techIdx >= 0 ? techIdx : 0;
  const techEnd = auditIdx >= 0 ? auditIdx : lines.length;
  const technicalPlan = techStart < techEnd ? lines.slice(techStart, techEnd).join("\n") : "";
  const auditHistory = auditIdx >= 0 ? lines.slice(auditIdx).join("\n") : "";

  return { technicalPlan, auditHistory };
}

/**
 * Verifies that all 7 required headings exist as markdown headings (`##`..`####`) in `technicalPlan`.
 *
 * @param {string} technicalPlan
 * @returns {Finding[]}
 */
export function checkRequiredSections(technicalPlan) {
  const headings = (technicalPlan || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^#{2,4}\s+\S/.test(l));

  /** @type {Finding[]} */
  const missing = [];
  for (const sec of REQUIRED_SECTIONS) {
    const found = headings.some((h) => sec.pattern.test(h));
    if (!found) {
      missing.push({
        level: "FAIL",
        code: "MISSING_SECTION",
        message: `Missing required heading in Technical Plan: ${sec.label}`,
      });
    }
  }

  if (missing.length > 0) {
    return missing;
  }
  return [{ level: "PASS", code: "SECTIONS", message: "7/7" }];
}

/**
 * Extracts and deduplicates `file:line` and `file:start-end,line2` references from text.
 *
 * @param {string} text
 * @returns {LineRef[]}
 */
export function extractLineRefs(text) {
  if (typeof text !== "string" || !text) return [];
  /** @type {LineRef[]} */
  const results = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const match of text.matchAll(LINE_REF_REGEX)) {
    const rawPath = match[1].replace(/\\/g, "/");
    const rangeSpec = match[2];
    for (const part of rangeSpec.split(",")) {
      const dashIdx = part.indexOf("-");
      const start = dashIdx >= 0 ? Number.parseInt(part.slice(0, dashIdx), 10) : Number.parseInt(part, 10);
      const end = dashIdx >= 0 ? Number.parseInt(part.slice(dashIdx + 1), 10) : start;
      const key = `${rawPath}:${start}-${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        path: rawPath,
        start,
        end,
        raw: `${rawPath}:${part}`,
      });
    }
  }
  return results;
}

/**
 * Counts the number of lines in a file, ignoring a single trailing newline.
 *
 * @param {string} content
 * @returns {number}
 */
function countFileLines(content) {
  if (!content) return 0;
  const parts = content.split(/\r?\n/);
  return parts.length > 0 && parts[parts.length - 1] === "" ? parts.length - 1 : parts.length;
}

/**
 * Validates a single LineRef against the repository root.
 *
 * @param {LineRef} ref
 * @param {string} repoRoot
 * @returns {Finding}
 */
function checkSingleLineRef(ref, repoRoot) {
  const normPath = ref.path.replace(/\\/g, "/");
  if (
    normPath.startsWith("/") ||
    /^[A-Za-z]:/.test(normPath) ||
    /(?:^|\/)\.\.(?:\/|$)/.test(normPath)
  ) {
    return { level: "FAIL", code: "INVALID_PATH", message: ref.raw };
  }
  if (isEnvSecretPath(normPath)) {
    return { level: "FAIL", code: "FORBIDDEN_ENV", message: ref.raw };
  }
  if (normPath.startsWith("docs/plans/")) {
    return {
      level: "WARN",
      code: "SELF_CITATION",
      message: `${ref.raw} (plan text is not evidence)`,
    };
  }

  const absPath = path.resolve(repoRoot, normPath);
  if (!fs.existsSync(absPath)) {
    return { level: "FAIL", code: "MISSING_FILE", message: ref.raw };
  }
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    return { level: "FAIL", code: "NOT_A_FILE", message: ref.raw };
  }
  if (ref.start < 1 || ref.end < ref.start) {
    return { level: "FAIL", code: "INVALID_RANGE", message: ref.raw };
  }

  const lineCount = countFileLines(fs.readFileSync(absPath, "utf8"));
  if (ref.end > lineCount) {
    return {
      level: "FAIL",
      code: "LINE_OUT_OF_RANGE",
      message: `${ref.raw} (file has ${lineCount} lines)`,
    };
  }
  return { level: "PASS", code: "LINE_REF", message: ref.raw };
}

/**
 * Validates all extracted line references against the repository filesystem.
 *
 * @param {LineRef[]} refs
 * @param {string} repoRoot
 * @returns {Finding[]}
 */
export function checkLineRefs(refs, repoRoot) {
  return refs.map((ref) => checkSingleLineRef(ref, repoRoot));
}

/**
 * Checks whether a repo-relative file path triggers the Cross-Model Critic requirement.
 *
 * @param {string} file
 * @returns {boolean}
 */
function isCriticTriggerFile(file) {
  const norm = file.replace(/\\/g, "/").toLowerCase();
  if (
    norm.startsWith(".agents/") ||
    norm.startsWith(".claude/") ||
    norm.startsWith(".husky/") ||
    norm === "agents.md" ||
    norm === "claude.md" ||
    norm === "scripts/code-freeze-guard.js"
  ) {
    return true;
  }
  if (
    norm.startsWith("supabase/") ||
    norm.startsWith("database-migrations/") ||
    norm.startsWith("scripts/run-migration") ||
    norm.endsWith(".sql")
  ) {
    return true;
  }
  return (
    /\.server\.(?:ts|tsx|js|jsx)$/.test(norm) ||
    norm.startsWith("src/app/api/auth/") ||
    norm.startsWith("src/lib/core/auth") ||
    norm === "src/proxy.ts" ||
    norm === "src/middleware.ts" ||
    norm === "next.config.ts"
  );
}

/**
 * Returns declared files in the plan that touch Security, Governance, or Database surfaces.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function detectCriticTriggers(content) {
  return extractDeclaredFiles(content).filter(isCriticTriggerFile);
}

/**
 * Checks the latest `### Audit Run` in `## Audit History` for a `#### Critic Findings` table
 * containing at least 3 rows with valid repository `file:line` references.
 *
 * @param {string} auditHistory
 * @param {string} repoRoot
 * @returns {Finding[]}
 */
export function checkCriticFloor(auditHistory, repoRoot) {
  if (typeof auditHistory !== "string" || !auditHistory.trim()) {
    return [{ level: "INFO", code: "CRITIC_FLOOR", message: "skipped (no audit run)" }];
  }
  const runMatches = [...auditHistory.matchAll(/^###\s+Audit Run\b.*$/gim)];
  if (runMatches.length === 0) {
    return [{ level: "INFO", code: "CRITIC_FLOOR", message: "skipped (no audit run)" }];
  }

  const lastRunStart = /** @type {number} */ (runMatches[runMatches.length - 1].index);
  const lastRunText = auditHistory.slice(lastRunStart);
  const criticHeading = /^####\s+Critic Findings\b.*$/im.exec(lastRunText);
  if (!criticHeading || criticHeading.index === undefined) {
    return [
      {
        level: "FAIL",
        code: "CRITIC_FLOOR",
        message: "Latest Audit Run is missing #### Critic Findings section",
      },
    ];
  }

  const afterCritic = lastRunText.slice(criticHeading.index + criticHeading[0].length);
  const nextHeading = /^#{2,4}\s+/m.exec(afterCritic);
  const sectionBody = nextHeading ? afterCritic.slice(0, nextHeading.index) : afterCritic;

  const tableLines = sectionBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));

  const dataRows = tableLines.slice(1).filter((row) => !/^\|\s*[-:|\s]+\|?$/.test(row));
  let validRowCount = 0;
  for (const row of dataRows) {
    const refs = extractLineRefs(row);
    const results = checkLineRefs(refs, repoRoot);
    if (results.some((r) => r.level === "PASS")) {
      validRowCount++;
    }
  }

  if (validRowCount < 3) {
    return [
      {
        level: "FAIL",
        code: "CRITIC_FLOOR",
        message: `Expected >= 3 critic findings with valid file:line, found ${validRowCount}`,
      },
    ];
  }
  return [
    {
      level: "PASS",
      code: "CRITIC_FLOOR",
      message: `${validRowCount} findings with valid file:line`,
    },
  ];
}

/**
 * Runs all deterministic plan checks on `planRelPath` relative to `repoRoot`.
 *
 * @param {string} planRelPath
 * @param {string} [repoRoot]
 * @returns {{ exitCode: 0 | 1 | 2, findings: Finding[] }}
 */
export function verifyPlan(planRelPath, repoRoot = process.cwd()) {
  if (
    typeof planRelPath !== "string" ||
    !planRelPath.trim() ||
    planRelPath.includes("..") ||
    !PLAN_REL_PATH_REGEX.test(planRelPath) ||
    path.basename(planRelPath).toLowerCase() === "readme.md" ||
    isEnvSecretPath(planRelPath)
  ) {
    return {
      exitCode: 2,
      findings: [
        {
          level: "FAIL",
          code: "USAGE_ERROR",
          message: `Invalid plan path '${planRelPath ?? ""}'. Expected docs/plans/<task>.md`,
        },
      ],
    };
  }

  const absPlan = path.resolve(repoRoot, planRelPath.replace(/\\/g, "/"));
  if (!fs.existsSync(absPlan) || !fs.statSync(absPlan).isFile()) {
    return {
      exitCode: 2,
      findings: [
        {
          level: "FAIL",
          code: "USAGE_ERROR",
          message: `Plan file not found: ${planRelPath}`,
        },
      ],
    };
  }

  const content = fs.readFileSync(absPlan, "utf8");
  const { technicalPlan, auditHistory } = splitPlanSections(content);
  /** @type {Finding[]} */
  const findings = [];
  findings.push(...checkRequiredSections(technicalPlan));

  const refs = extractLineRefs(technicalPlan);
  const declaredNew = new Set(
    extractDeclaredFiles(content).map((f) => f.replace(/\\/g, "/").toLowerCase())
  );
  const checkableRefs = refs.filter((r) => {
    const norm = r.path.replace(/\\/g, "/");
    const abs = path.resolve(repoRoot, norm);
    return fs.existsSync(abs) || !declaredNew.has(norm.toLowerCase());
  });
  findings.push(...checkLineRefs(checkableRefs, repoRoot));

  const triggers = detectCriticTriggers(content);
  findings.push({
    level: "INFO",
    code: "CRITIC_REQUIRED",
    message: triggers.length > 0 ? `yes (${triggers.join(", ")})` : "no",
  });
  findings.push(...checkCriticFloor(auditHistory, repoRoot));

  const failCount = findings.filter((f) => f.level === "FAIL").length;
  return {
    exitCode: failCount > 0 ? 1 : 0,
    findings,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: node scripts/verify-plan.mjs docs/plans/<plan-file>.md");
    process.exit(2);
  }
  const result = verifyPlan(args[0], process.cwd());
  if (result.exitCode === 2) {
    for (const f of result.findings) {
      console.error(`[${f.level}] ${f.code} ${f.message}`);
    }
    process.exit(2);
  }
  for (const f of result.findings) {
    process.stdout.write(`[${f.level}] ${f.code} ${f.message}\n`);
  }
  const failCount = result.findings.filter((f) => f.level === "FAIL").length;
  const warnCount = result.findings.filter((f) => f.level === "WARN").length;
  const verdict = result.exitCode === 0 ? "PASS" : "FAIL";
  process.stdout.write(`VERIFY_PLAN: ${verdict} (${failCount} failures, ${warnCount} warnings)\n`);
  process.exit(result.exitCode);
}

const isMain =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  runCli();
}
