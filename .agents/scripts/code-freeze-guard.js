// @ts-check
/**
 * Code Freeze Guard — PreToolUse hook for write_to_file / replace_file_content / run_command.
 *
 * Policy: Option 2 (Scoped Protection — Decided by Product Manager / QA):
 *   - ALLOW writes to the plan/doc surface (docs/ and root planning artifacts).
 *   - ALLOW writes to external Antigravity artifacts (~/.gemini/antigravity/brain/).
 *   - ALLOW Fast-Track micro-edits (replace_file_content, <= 40 lines) on UI/translation/styling surfaces without an approved plan.
 *   - With approved plan: ALLOW writes to non-sensitive frontend/UI/feature files.
 *   - ALWAYS ASK for sensitive core files (*.server.ts, database migrations, TEST_INFRA_FILES,
 *     test files under Test Integrity Guard, and .agents/ governance files).
 *   - ALLOW run_command only for read-only verification commands with no shell
 *     chaining, redirection or mutating flags.
 *   - ASK for mutating commands, shell escape hatches, or commands outside allowlist.
 *
 * Platform-level enforcement of the Strict Code Freeze rule in rules/05-plan-review.md.
 * `decide()` is exported as a pure function so it can be unit tested; the stdin
 * wiring only runs when this file is executed directly as a hook.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{ decision: 'allow' | 'ask', reason?: string }} GuardDecision
 * @typedef {{ toolName?: string, targetFile?: string, command?: string, newContent?: string, oldContent?: string }} GuardInput
 * @typedef {{ planApproved?: boolean }} DecideOptions
 */

/** Repo root, derived from this file's location (NOT from process.cwd()). */
export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");

/** Root directory for Antigravity brain artifacts. */
export const ARTIFACT_ROOT = path.resolve(os.homedir(), ".gemini/antigravity/brain");

/** Directories that remain writable while the code freeze is in effect. */
const UNFROZEN_PREFIXES = ["docs/"];

/** Root-level planning artifacts that remain writable during the freeze. */
const UNFROZEN_FILES = ["implementation_plan.md", "task.md", "walkthrough.md"];

/** Safe extensions permitted in scratch subdirectories within Antigravity brain. */
const SAFE_SCRATCH_EXTENSIONS = [".md", ".json", ".ts", ".js", ".txt", ".csv", ".sql"];

/** Dangerous executable extensions explicitly rejected. */
const DANGEROUS_EXTENSIONS = [".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".vbs"];

/** Read-only verification and multi-agent CLI dispatch commands mirroring the @planner / @reviewer / @qa ALLOWLIST for Vikini. */
const READ_ONLY_COMMANDS = [
  /^npm run (?:type-check|lint|test:run|verify)$/,
  // Scoped Vitest runs: path arguments plus the stdout-only --reporter flag. Any
  // other argument must start with a non-dash character, so snapshot-writing
  // flags (-u, --update) and file-writing flags (--coverage, --outputFile) stay blocked.
  /^npx vitest (?:run|list)(?: (?:--reporter=[\w-]+|--filesOnly|[^\s-]\S*))*$/,
  /^npm run test:run --(?: (?:--reporter=[\w-]+|[^\s-]\S*))+$/,
  /^npx tsc --(?:noEmit|showConfig)$/,
  /^npx eslint --print-config \S+$/,
  /^npm ls(?: \S+)*$/,
  /^npm view \S+(?: \S+)*$/,
  /^git (?:status|diff|log|show|blame)(?: \S+)*$/,
  /^powershell(?:\.exe)?\s+(?:-(?:NoProfile|ExecutionPolicy\s+(?:Bypass|RemoteSigned|Unrestricted))\s+)*-File\s+["']?\.agents[/\\]scripts[/\\]run-claude\.ps1["']?(?:\s+(?:-CheckOnly|-(?:Role|Mode)\s+(?:planner|reviewer|plan|review)|-PlanFile\s+["']?docs[/\\]plans[/\\][A-Za-z0-9._-]+\.md["']?|-Model\s+[A-Za-z0-9._-]+|-(?:Task|Prompt)\s+(?:"[^"]*"|'[^']*'|\S+)|-ArtifactFile\s+["']?(?!.*\.\.)[^\s"']*[/\\]\.gemini[/\\]antigravity[/\\]brain[/\\][^\s"']+\.md["']?))*\s*$/i,
  /^claude(?:\.exe)?\s+(?:--version|-v|--help|-h|-p\s+["']?ping["']?)$/i,
  /^node\s+["']?(?:\.[\/\\])?scripts[\/\\]verify-docs\.mjs["']?(?:\s+(?:--strict-shorthand|--expected-headings=\d+))*$/,
];

/** Shell constructs that can turn an allowed command into a mutating one. */
const SHELL_ESCAPE_HATCHES = /[;|&`]|\$\(|>>?|\btee\b/;

/** Flags that rewrite files or load external executable configs even when the base command is read-only. */
const MUTATING_FLAGS =
  /(?:^|\s)(?:--fix|--write|--force|--output|--outputFile|--config|--root|--dir|--globalSetup|--setupFiles|--extcmd|--update|--coverage)(?:\s|=|$)|(?:^|\s)-(?:c|u|i)(?:\s|=|$)/;

/** Config files that decide which tests run and which test modifiers are allowed. */
export const TEST_INFRA_FILES = [
  "vitest.config.ts",
  "eslint.config.mjs",
  "package.json",
  ".husky/pre-commit",
  ".github/workflows/ci.yml",
  "tests/setup.ts",
  "playwright.config.ts",
  "tsconfig.json",
];

/** Windows path separator, built without a literal escape so the source stays lexer-safe. */
const WINDOWS_SEPARATOR = String.fromCharCode(92);

/**
 * Rewrites Windows separators as POSIX ones.
 *
 * @param {string} value
 * @returns {string}
 */
export function toPosix(value) {
  return value.split(WINDOWS_SEPARATOR).join("/");
}

/**
 * Normalises a tool-supplied path to a repo-relative POSIX path.
 * Works for absolute paths, Windows paths and relative paths alike.
 *
 * @param {string | undefined} targetFile
 * @returns {string | null} repo-relative path, or null when outside the repo
 */
export function toRepoRelative(targetFile) {
  if (typeof targetFile !== "string") return null;
  const absolute = path.resolve(REPO_ROOT, toPosix(targetFile));
  const relative = toPosix(path.relative(REPO_ROOT, absolute));
  if (relative === "" || relative.startsWith("../") || path.isAbsolute(relative)) {
    return null;
  }
  return relative;
}

/**
 * Checks if targetFile is a valid Antigravity artifact path outside the repo.
 *
 * @param {string | undefined} targetFile
 * @returns {boolean}
 */
export function isAntigravityArtifact(targetFile) {
  if (typeof targetFile !== "string") return false;

  // Constraint 2: Must be an absolute path (avoids cwd ambiguity)
  if (!path.isAbsolute(targetFile)) {
    return false;
  }

  // Constraint 1: Must be outside the repository
  if (toRepoRelative(targetFile) !== null) {
    return false;
  }

  // Constraint 3: Must be inside ARTIFACT_ROOT without traversal
  const targetAbsolute = path.resolve(targetFile);
  const rel = toPosix(path.relative(ARTIFACT_ROOT, targetAbsolute));
  if (rel === "" || rel.startsWith("../") || path.isAbsolute(rel)) {
    return false;
  }

  const ext = path.extname(targetAbsolute).toLowerCase();

  // Reject dangerous executable extensions explicitly
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }

  // Constraint 4: Allowed file types:
  // - .md or .json anywhere in brain/
  if (ext === ".md" || ext === ".json") {
    return true;
  }

  // - Or within scratch/ subdirectory with safe extensions
  const parts = rel.split("/");
  if (parts.includes("scratch") && SAFE_SCRATCH_EXTENSIONS.includes(ext)) {
    return true;
  }

  return false;
}

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
 * (`write_to_file` / `write_file`) targeting `docs/plans/*.md` pre-populates
 * `Status: Approved` in the first 30 lines OR `[PLAN_APPROVED]` on the last non-blank line.
 *
 * Legitimate technical plans discussing `[PLAN_APPROVED]` inside the markdown body
 * have `Status: Ready for Review` in the header and do not end with `[PLAN_APPROVED]`,
 * so they are NOT falsely blocked.
 *
 * @param {string | undefined} newContent
 * @returns {boolean}
 */
export function isSelfForgedPlanWrite(newContent) {
  return hasApprovedPlanHeader(newContent) || hasApprovedPlanFooter(newContent);
}

/**
 * Evaluates all plan files in `docs/plans/` deterministically:
 * 1. Extracts the `YYYY-MM-DD` date prefix from `filename` (`/^(\d{4}-\d{2}-\d{2})-/`).
 * 2. Filters out any file without a valid `YYYY-MM-DD` date prefix or whose `datePrefix`
 *    exceeds `maxDatePrefix` (defaults to UTC today + 1 day for timezone safety, preventing
 *    future-dated filenames like `2099-01-01-x.md` from permanently overshadowing active plans — `MIN-04`).
 * 3. Sorts descending by `datePrefix` first (`b.datePrefix.localeCompare(a.datePrefix)`),
 *    using `mtimeMs` descending only as a tie-breaker within the same date prefix
 *    (preventing `git clone`/`checkout` mtime resets from surfacing older dates).
 * 4. Inspects ALL plans sharing the newest valid date prefix (`latestDatePrefix`):
 *    - Fail-safe freeze: If ANY plan in the newest date group is neither `Completed`
 *      nor `Approved` (e.g. a newly created `Ready for Review` or `Changes Requested`
 *      plan on the same day), immediately returns `false`.
 *    - Returns `true` if and only if at least one plan in the newest date group is
 *      `Approved` (`evaluatePlanApprovalContent(plan.content) === true`) and none are pending.
 *
 * @param {Array<{ filename: string, mtimeMs: number, content: string }>} planEntries
 * @param {{ maxDatePrefix?: string }} [options]
 * @returns {boolean}
 */
export function evaluateLatestDateGroupPlans(planEntries, options = {}) {
  if (!Array.isArray(planEntries) || planEntries.length === 0) return false;

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

  if (withPrefix.length === 0) return false;

  withPrefix.sort((a, b) => {
    if (a.datePrefix !== b.datePrefix) {
      return b.datePrefix.localeCompare(a.datePrefix);
    }
    return b.mtimeMs - a.mtimeMs;
  });

  const latestDatePrefix = withPrefix[0].datePrefix;
  const latestGroup = withPrefix.filter((item) => item.datePrefix === latestDatePrefix);

  let hasAtLeastOneApproved = false;
  for (const plan of latestGroup) {
    if (evaluatePlanApprovalContent(plan.content)) {
      hasAtLeastOneApproved = true;
    } else if (!hasCompletedPlanHeader(plan.content)) {
      return false;
    }
  }

  return hasAtLeastOneApproved;
}

/**
 * Checks whether an active approved implementation plan exists in `docs/plans/*.md`
 * (Single Source of Truth — legacy marker check removed per MAJ-07;
 * preserves `export` and `REPO_ROOT` per MAJ-09).
 *
 * @returns {boolean}
 */
export function isPlanApproved() {
  try {
    const plansDir = path.join(REPO_ROOT, "docs", "plans");
    if (!fs.existsSync(plansDir)) return false;

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

    return evaluateLatestDateGroupPlans(planEntries);
  } catch {
    // ignore fs errors -> fail closed
  }
  return false;
}

/**
 * Determines whether a repo-relative path points to a test file.
 *
 * @param {string | null | undefined} relative
 * @returns {boolean}
 */
export function isTestFile(relative) {
  if (!relative) return false;
  return (
    /\.test\.(ts|tsx)$/.test(relative) ||
    /\.spec\.(ts|tsx)$/.test(relative) ||
    /(?:^|\/)__tests__\//.test(relative) ||
    /(?:^|\/)tests\//.test(relative)
  );
}

/**
 * Checks if a path points to a sensitive server file (*.server.ts).
 *
 * @param {string | null | undefined} relative
 * @returns {boolean}
 */
export function isSensitiveServerFile(relative) {
  if (!relative) return false;
  return (
    /\.server\.(ts|tsx|js|jsx)$/.test(relative) ||
    /(?:^|\/)src\/lib\/core\/supabase\.server\.ts$/.test(relative)
  );
}

/**
 * Checks if a path points to a database migration file.
 *
 * @param {string | null | undefined} relative
 * @returns {boolean}
 */
export function isMigrationFile(relative) {
  if (!relative) return false;
  return (
    /(?:^|\/)supabase\/migrations\//.test(relative) ||
    /(?:^|\/)database-migrations\//.test(relative) ||
    /\.sql$/.test(relative)
  );
}

/**
 * Checks if a path points to agent governance files (.agents/).
 *
 * @param {string | null | undefined} relative
 * @returns {boolean}
 */
export function isGovernanceFile(relative) {
  if (!relative) return false;
  return /^\.agents\//.test(relative);
}

/**
 * Heuristically assesses whether test modifications weaken test assertions.
 *
 * @param {string | undefined} oldContent
 * @param {string | undefined} newContent
 * @returns {string[]} List of weakening signals detected
 */
export function assessTestIntegrity(oldContent, newContent) {
  // If either side is missing, comparison cannot be made symmetrically.
  if (oldContent === undefined || newContent === undefined) {
    return ["unavailable (payload carried partial or missing content)"];
  }

  const oldText = oldContent;
  const newText = newContent;
  const signals = [];

  /** @type {(str: string, regex: RegExp) => number} */
  const countMatches = (str, regex) => (str.match(regex) ?? []).length;

  // 1. Check expect() delta
  const oldExpects = countMatches(oldText, /\bexpect\s*\(/g);
  const newExpects = countMatches(newText, /\bexpect\s*\(/g);
  const expectDelta = newExpects - oldExpects;
  if (expectDelta < 0) {
    const diff = Math.abs(expectDelta);
    signals.push(`${diff} fewer expect() call${diff === 1 ? "" : "s"}`);
  }

  // 2. Check disabled / focused test additions
  const disabledAdditions = [];
  if (countMatches(newText, /\.(skip)\b/g) > countMatches(oldText, /\.(skip)\b/g)) {
    disabledAdditions.push(".skip");
  }
  if (countMatches(newText, /\.(only)\b/g) > countMatches(oldText, /\.(only)\b/g)) {
    disabledAdditions.push(".only");
  }
  if (countMatches(newText, /\.(todo)\b/g) > countMatches(oldText, /\.(todo)\b/g)) {
    disabledAdditions.push(".todo");
  }
  if (
    countMatches(newText, /\b(xit|xtest|xdescribe)\s*\(/g) >
    countMatches(oldText, /\b(xit|xtest|xdescribe)\s*\(/g)
  ) {
    disabledAdditions.push("xit");
  }
  if (
    countMatches(newText, /\b(fit|fdescribe)\s*\(/g) >
    countMatches(oldText, /\b(fit|fdescribe)\s*\(/g)
  ) {
    disabledAdditions.push("fit");
  }
  if (countMatches(newText, /\.(skipIf|runIf)\b/g) > countMatches(oldText, /\.(skipIf|runIf)\b/g)) {
    disabledAdditions.push(".skipIf/.runIf");
  }
  if (countMatches(newText, /\.fails\b/g) > countMatches(oldText, /\.fails\b/g)) {
    disabledAdditions.push(".fails");
  }
  if (disabledAdditions.length > 0) {
    signals.push(`adds ${disabledAdditions.join("/")}`);
  }

  // 3. Check matcher relaxation: strict matchers decrease while loose matchers increase
  const oldStrict = countMatches(oldText, /\.(?:toBe|toEqual|toStrictEqual)\s*\(/g);
  const newStrict = countMatches(newText, /\.(?:toBe|toEqual|toStrictEqual)\s*\(/g);
  const oldLoose = countMatches(
    oldText,
    /\.(?:toBeDefined|toBeTruthy|toBeFalsy)\s*\(|\bexpect\.anything\(\)/g
  );
  const newLoose = countMatches(
    newText,
    /\.(?:toBeDefined|toBeTruthy|toBeFalsy)\s*\(|\bexpect\.anything\(\)/g
  );
  if (newStrict < oldStrict && newLoose > oldLoose) {
    signals.push("relaxes matcher strength");
  }

  // 4. Check try/catch addition
  const oldTry = countMatches(oldText, /\btry\s*\{/g);
  const newTry = countMatches(newText, /\btry\s*\{/g);
  if (newTry > oldTry) {
    signals.push("adds try/catch block");
  }

  return signals;
}

/** Maximum lines on either side of a Fast-Track edit. */
export const FAST_TRACK_MAX_LINES = 40;

/** Reason returned when a Fast-Track micro-edit is allowed without an approved plan. */
const FAST_TRACK_REASON =
  "Fast-Track Mode: micro-edit (<= 40 lines) on UI/translation/styling surface.";

/** Pure UI / translation / styling surfaces eligible for Fast-Track Mode. */
const FAST_TRACK_PATHS = [
  /^src\/lib\/utils\/translations\/(?:vi|en)\.ts$/,
  /^src\/app\/styles\/.+\.css$/,
  /^src\/(?:app\/(?!api\/)|components\/).+\.tsx$/,
];

/** Defence in depth: test/spec/server components are blocked by earlier gates too. */
const FAST_TRACK_EXCLUDED_PATHS = /\.(?:test|spec|server)\.tsx$/;

/** Content that must never ride the Fast-Track lane (D2). */
const FAST_TRACK_FORBIDDEN_CONTENT = /["']use server["']|\bprocess\.env\b|\.server["']/;

/**
 * Counts lines the way editors do for a replacement chunk.
 * @param {string} value
 * @returns {number}
 */
export function countLines(value) {
  return value.split(/\r?\n/).length;
}

/**
 * Fast-Track Mode: a small replace_file_content edit on a pure UI surface may
 * proceed without [PLAN_APPROVED]. Must run AFTER every Scoped Protection gate.
 * @param {string} relative repo-relative POSIX path
 * @param {GuardInput} input
 * @returns {boolean}
 */
export function isFastTrackEligible(relative, input) {
  if (input.toolName !== "replace_file_content" && input.toolName !== "edit_file") return false;
  if (FAST_TRACK_EXCLUDED_PATHS.test(relative)) return false;
  if (!FAST_TRACK_PATHS.some((pattern) => pattern.test(relative))) return false;
  const { oldContent, newContent } = input;
  if (typeof oldContent !== "string" || typeof newContent !== "string") return false;
  if (oldContent === "" || newContent === "") return false;
  if (countLines(oldContent) > FAST_TRACK_MAX_LINES) return false;
  if (countLines(newContent) > FAST_TRACK_MAX_LINES) return false;
  return !FAST_TRACK_FORBIDDEN_CONTENT.test(newContent);
}

/**
 * Decides whether a tool call may proceed without user confirmation.
 * Implements Option 2 (Scoped Protection).
 *
 * @param {GuardInput} input
 * @param {DecideOptions} [options]
 * @returns {GuardDecision}
 */
export function decide(input, options = {}) {
  const ask = (/** @type {string} */ reason) => ({
    decision: /** @type {const} */ ("ask"),
    reason,
  });

  if (input.targetFile) {
    // 0. Read Guard for .env* secrets (when invoked as PreToolUse hook for Read/read_file/view_file)
    if (
      input.toolName === "Read" ||
      input.toolName === "read_file" ||
      input.toolName === "view_file"
    ) {
      const baseName = path.basename(toPosix(input.targetFile));
      const relCandidate = toRepoRelative(input.targetFile);
      if (
        /^\.env(?:\..+)?$/i.test(baseName) ||
        (relCandidate !== null &&
          (relCandidate.startsWith(".env") || relCandidate.includes("/.env")))
      ) {
        return ask(
          `\u26a0\ufe0f Code Freeze Guard: reading .env* secret files is prohibited (${input.targetFile}).`
        );
      }
      return { decision: "allow" };
    }

    // 1. External path checks (must be valid Antigravity artifact)
    if (toRepoRelative(input.targetFile) === null) {
      if (isAntigravityArtifact(input.targetFile)) {
        return { decision: "allow" };
      }
      return ask(`Write targets a path outside the repository: ${input.targetFile}`);
    }

    const relative = /** @type {string} */ (toRepoRelative(input.targetFile));

    // 2. Prohibited internal directories and secrets
    if (
      relative.includes(".gemini/") ||
      relative.includes(".git/") ||
      relative.startsWith(".env") ||
      relative.includes("/.env")
    ) {
      return ask(`Security Guard: write targets a prohibited path: ${relative}`);
    }

    // 3. Unfrozen paths (docs/ and root planning artifacts)
    const unfrozen =
      UNFROZEN_PREFIXES.some((prefix) => relative.startsWith(prefix)) ||
      UNFROZEN_FILES.includes(relative);
    if (unfrozen) {
      // Layer 2 (BLK-03, BLK-04): Only .md files are allowed inside ALL unfrozen documentation
      // paths (docs/** and root planning artifacts), preventing creation of executable
      // docs/notes/x.test.mjs, docs/plans/x.test.mjs, or *.js/*.ts anywhere under docs/**.
      if (!relative.toLowerCase().endsWith(".md")) {
        return ask(
          `\u26a0\ufe0f Code Freeze Guard: only .md files are allowed inside unfrozen documentation paths (${relative}).`
        );
      }

      // Single-Step Pre-Approved Plan Guard: block full-file creation/overwrite
      // (write_to_file / write_file / Write) on docs/plans/ if it pre-populates
      // Status: Approved in the header or [PLAN_APPROVED] on the last non-blank line.
      if (
        (relative === "docs/plans" || relative.startsWith("docs/plans/")) &&
        (input.toolName === "write_to_file" ||
          input.toolName === "write_file" ||
          input.toolName === "Write") &&
        isSelfForgedPlanWrite(input.newContent)
      ) {
        return ask(
          `\u26a0\ufe0f Plan Self-Forgery Guard (Single-Step Pre-Approved Plan Guard): Không được phép dùng ${input.toolName} để tạo mới hoặc ghi đè file kế hoạch (${relative}) đã gắn sẵn 'Status: Approved' hoặc thẻ '[PLAN_APPROVED]' ở dòng cuối. Kế hoạch mới phải có 'Status: Ready for Review' và chỉ được phê duyệt qua replace_file_content/edit_file bởi Lead Reviewer.`
        );
      }
      return { decision: "allow" };
    }

    // 3b. PRIORITY: Test Infrastructure Guard (checked BEFORE isTestFile)
    if (TEST_INFRA_FILES.includes(relative)) {
      return ask(
        [
          "\u26a0\ufe0f Test Infrastructure Guard: this edit changes test configuration.",
          `Path: ${relative}`,
          "Before approving, ask the agent whether it narrows which tests run, relaxes the lint gate or weakens a CI/pre-commit step, and why.",
        ].join("\n")
      );
    }

    // 4. Test Integrity Guard for test files
    if (isTestFile(relative)) {
      let signals = [];
      try {
        signals = assessTestIntegrity(input.oldContent, input.newContent);
      } catch {
        signals = ["unavailable (payload carried no content)"];
      }
      const signalText = signals.length > 0 ? signals.join("; ") : "none detected";
      return ask(
        [
          "\u26a0\ufe0f Test Integrity Guard: this edit modifies a TEST file.",
          `Path: ${relative}`,
          `Signals: ${signalText}`,
          "Before approving, ask the agent: is this failure type A (code bug), B (test harness) or C (approved spec change)?",
        ].join("\n")
      );
    }

    // 5. Scoped Protection: Sensitive server files (*.server.ts)
    if (isSensitiveServerFile(relative)) {
      return ask(
        [
          "\u26a0\ufe0f Scoped Protection Guard: write targets a sensitive server file (*.server.ts).",
          `Path: ${relative}`,
          "Approve only if you intended to modify server-only core secrets/auth handlers.",
        ].join("\n")
      );
    }

    // 6. Scoped Protection: Database migration files
    if (isMigrationFile(relative)) {
      return ask(
        [
          "\u26a0\ufe0f Scoped Protection Guard: write targets a database migration file.",
          `Path: ${relative}`,
          "Approve only if you intended to modify the database schema or migration scripts.",
        ].join("\n")
      );
    }

    // 7. Governance files (.agents/)
    if (isGovernanceFile(relative)) {
      return ask(
        [
          "\u26a0\ufe0f Code Freeze Guard: write targets a governance file in .agents/.",
          `Path: ${relative}`,
          "Approve only if you intended to modify agent rules or scripts.",
        ].join("\n")
      );
    }

    // 8. Fast-Track Mode: micro UI / translation / styling edits (05-plan-review.md §1.1)
    if (isFastTrackEligible(relative, input)) {
      return { decision: "allow", reason: FAST_TRACK_REASON };
    }

    // 9. General application / UI files: Scoped Protection
    const planApproved =
      options.planApproved !== undefined ? options.planApproved : isPlanApproved();
    if (planApproved) {
      return { decision: "allow" };
    }

    return ask(
      [
        "\u26a0\ufe0f Code Freeze Guard: write targets a frozen path.",
        `Path: ${relative}`,
        "Approve only if [PLAN_APPROVED] has been granted by Lead Reviewer (@reviewer or Claude CLI fallback).",
      ].join("\n")
    );
  }

  if (input.command) {
    const command = input.command.trim();
    // PowerShell 5.1 has no `&&`, so 02-quality.md mandates `;` between gates.
    // A `;` chain is allowed only when every segment is allowed on its own.
    if (command.includes(";")) {
      const segments = command
        .split(";")
        .map((segment) => segment.trim())
        .filter(Boolean);
      const allAllowed =
        segments.length > 0 &&
        segments.every((segment) => decide({ command: segment }, options).decision === "allow");
      if (allAllowed) {
        return { decision: "allow" };
      }
      return ask(
        [
          "\u26a0\ufe0f Code Freeze Guard: command chain contains a segment outside the read-only ALLOWLIST.",
          `Command: ${command}`,
        ].join("\n")
      );
    }
    if (SHELL_ESCAPE_HATCHES.test(command) || MUTATING_FLAGS.test(command)) {
      return ask(
        [
          "\u26a0\ufe0f Code Freeze Guard: command contains redirection, chaining or a mutating flag.",
          `Command: ${command}`,
        ].join("\n")
      );
    }
    if (READ_ONLY_COMMANDS.some((pattern) => pattern.test(command))) {
      return { decision: "allow" };
    }
    return ask(
      [
        "\u26a0\ufe0f Code Freeze Guard: command is outside the read-only ALLOWLIST.",
        `Command: ${command}`,
      ].join("\n")
    );
  }

  return ask(
    "\u26a0\ufe0f Code Freeze Guard: tool call carries no recognisable target \u2014 failing closed."
  );
}

/**
 * Antigravity serialises some tool arguments as JSON string literals
 * (`"\"npx vitest run src/a.test.ts\""`). Decodes one such layer so the
 * allowlist matches the real command; any other value is returned unchanged.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function unwrapJsonString(value) {
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    !value.startsWith('"') ||
    !value.endsWith('"')
  ) {
    return value;
  }
  try {
    const decoded = JSON.parse(value);
    return typeof decoded === "string" ? decoded : value;
  } catch {
    return value;
  }
}

/**
 * Extracts the guard input from a PreToolUse payload, tolerating field-name drift
 * across platform versions.
 *
 * @param {unknown} payload
 * @returns {GuardInput}
 */
export function extractInput(payload) {
  const root = /** @type {Record<string, any>} */ (payload ?? {});
  const args = root.toolCall?.args ?? root.tool_input ?? {};
  const toolName =
    typeof root.toolCall?.name === "string"
      ? root.toolCall.name
      : typeof root.tool_name === "string"
        ? root.tool_name
        : undefined;

  const rawTarget = unwrapJsonString(args.TargetFile ?? args.Path ?? args.file_path ?? args.path);
  const targetFile = typeof rawTarget === "string" ? rawTarget : undefined;

  const rawCommand = unwrapJsonString(args.CommandLine ?? args.Command ?? args.command);
  const command = typeof rawCommand === "string" ? rawCommand : undefined;

  let newContent;
  let oldContent;

  // Handle multi-chunk replace payloads (ReplacementChunks[] or edits[])
  if (Array.isArray(args.ReplacementChunks) && args.ReplacementChunks.length > 0) {
    const oldParts = [];
    const newParts = [];
    for (const chunk of args.ReplacementChunks) {
      if (chunk && typeof chunk === "object") {
        if (typeof chunk.TargetContent === "string") oldParts.push(chunk.TargetContent);
        if (typeof chunk.ReplacementContent === "string") newParts.push(chunk.ReplacementContent);
      }
    }
    if (oldParts.length > 0) oldContent = oldParts.join("\n");
    if (newParts.length > 0) newContent = newParts.join("\n");
  } else if (Array.isArray(args.edits) && args.edits.length > 0) {
    const oldParts = [];
    const newParts = [];
    for (const edit of args.edits) {
      if (edit && typeof edit === "object") {
        if (typeof edit.old_string === "string") oldParts.push(edit.old_string);
        if (typeof edit.new_string === "string") newParts.push(edit.new_string);
      }
    }
    if (oldParts.length > 0) oldContent = oldParts.join("\n");
    if (newParts.length > 0) newContent = newParts.join("\n");
  } else {
    const rawNew =
      args.CodeContent ??
      args.Content ??
      args.ReplacementContent ??
      args.Replacement ??
      args.content ??
      args.new_string ??
      args.new_content ??
      args.replacement_content;
    newContent = typeof rawNew === "string" ? rawNew : undefined;

    const rawOld =
      args.TargetContent ??
      args.Target ??
      args.old_string ??
      args.old_content ??
      args.target_content;
    oldContent = typeof rawOld === "string" ? rawOld : undefined;
  }

  // Only read disk if write_to_file / write_file / Write (full-file write), NOT for replace_file_content or partial edits!
  if (
    (toolName === "write_to_file" || toolName === "write_file" || toolName === "Write") &&
    oldContent === undefined &&
    targetFile
  ) {
    try {
      const absolute = path.resolve(REPO_ROOT, toPosix(targetFile));
      if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
        oldContent = fs.readFileSync(absolute, "utf8");
      }
    } catch {
      oldContent = undefined;
    }
  }

  return {
    toolName,
    targetFile,
    command,
    newContent,
    oldContent,
  };
}

/**
 * Formats the guard decision for either Google Antigravity hooks (`{ decision, reason }`)
 * or Claude Code CLI `PreToolUse` hooks (`{ hookSpecificOutput }` or `null` on allow).
 *
 * Per Claude Code Hooks & Permissions docs:
 * 1. Top-level `decision` is invalid for `PreToolUse` schema validation (`MAJ-10`), so when
 *    `root.hook_event_name === "PreToolUse"` we NEVER include `decision` at the top level.
 * 2. Returning `permissionDecision: "allow"` from a `PreToolUse` hook skips `--allowedTools` and
 *    `dontAsk` auto-deny (`BLK-04`), whereas `permissionDecision: "defer"` in `-p` non-interactive
 *    mode is designed for `claude -p --resume` and risks exiting with code `2` (`MAJ-12`).
 *    Conversely, exiting `0` with NO stdout output is documented across Claude Code docs as letting
 *    the tool call proceed through normal permission evaluation (`--allowedTools` +
 *    `--disallowedTools` + `dontAsk`). Therefore, when `result.decision === "allow"` for
 *    `PreToolUse`, `formatHookOutput` returns `null` so `main()` writes nothing to stdout and exits `0`.
 *
 * @param {GuardDecision} result
 * @param {unknown} rawPayload
 * @returns {Record<string, unknown> | null}
 */
export function formatHookOutput(result, rawPayload) {
  const root = /** @type {Record<string, any>} */ (rawPayload ?? {});
  if (root.hook_event_name === "PreToolUse") {
    if (result.decision === "allow") {
      return null;
    }
    const permissionDecision = root.permission_mode === "dontAsk" ? "deny" : "ask";
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision,
        ...(result.reason ? { permissionDecisionReason: result.reason } : {}),
      },
    };
  }
  return result;
}

/** Reads the payload from stdin and writes the formatted decision to stdout. */
function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    /** @type {GuardDecision} */
    let result;
    /** @type {unknown} */
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(raw);
      result = decide(extractInput(parsedPayload));
    } catch {
      // Fail CLOSED: an unreadable payload must never silently unfreeze the repo.
      result = {
        decision: "ask",
        reason:
          "\u26a0\ufe0f Code Freeze Guard: payload could not be parsed \u2014 failing closed.",
      };
    }
    const output = formatHookOutput(result, parsedPayload);
    if (output !== null) {
      process.stdout.write(JSON.stringify(output));
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("code-freeze-guard.js")) {
  main();
}
