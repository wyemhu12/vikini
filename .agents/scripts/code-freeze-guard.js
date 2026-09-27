// @ts-check
/**
 * Code Freeze Guard — PreToolUse hook for write_to_file / replace_file_content / run_command.
 *
 * Policy: Option 2 (Scoped Protection — Decided by Product Manager / QA):
 *   - ALLOW writes to the plan/doc surface (docs/ and root planning artifacts).
 *   - ALLOW writes to external Antigravity artifacts (~/.gemini/antigravity/brain/).
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

/** Read-only verification commands mirroring the @reviewer / @qa ALLOWLIST for Vikini. */
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
];

/** Shell constructs that can turn an allowed command into a mutating one. */
const SHELL_ESCAPE_HATCHES = /[;|&`]|\$\(|>>?|\btee\b/;

/** Flags that rewrite files even when the base command is read-only. */
const MUTATING_FLAGS = /--fix\b|--write\b|--force\b|--output\b|-i\b/;

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
 * Checks if a plan has been approved by @reviewer.
 * Inspects .agents/.plan-approved or the latest plan in docs/plans/.
 *
 * @returns {boolean}
 */
export function isPlanApproved() {
  const markerPath = path.resolve(REPO_ROOT, ".agents/.plan-approved");
  if (fs.existsSync(markerPath)) {
    return true;
  }

  const plansDir = path.resolve(REPO_ROOT, "docs/plans");
  if (fs.existsSync(plansDir)) {
    try {
      const entries = fs
        .readdirSync(plansDir)
        .filter((file) => file.endsWith(".md") && file !== "README.md")
        .map((file) => path.join(plansDir, file));
      if (entries.length > 0) {
        entries.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        // Check top recent plans (handles git checkout mtime jitter within same batch)
        for (const planPath of entries.slice(0, 3)) {
          const content = fs.readFileSync(planPath, "utf8");
          if (/Status:\s*Approved/i.test(content) || /\[PLAN_APPROVED\]/.test(content)) {
            return true;
          }
        }
      }
    } catch {
      return false;
    }
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
      return { decision: "allow" };
    }

    // 3. PRIORITY: Test Infrastructure Guard (checked BEFORE isTestFile)
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

    // 8. General application / UI files: Scoped Protection
    const planApproved =
      options.planApproved !== undefined ? options.planApproved : isPlanApproved();
    if (planApproved) {
      return { decision: "allow" };
    }

    return ask(
      [
        "\u26a0\ufe0f Code Freeze Guard: write targets a frozen path.",
        `Path: ${relative}`,
        "Approve only if [PLAN_APPROVED] has been granted by @reviewer.",
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

  const rawTarget = unwrapJsonString(args.TargetFile ?? args.file_path ?? args.path);
  const targetFile = typeof rawTarget === "string" ? rawTarget : undefined;

  const rawCommand = unwrapJsonString(args.CommandLine ?? args.Command ?? args.command);
  const command = typeof rawCommand === "string" ? rawCommand : undefined;

  let newContent;
  let oldContent;

  // Handle multi-chunk replace payloads (ReplacementChunks[])
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
  } else {
    const rawNew =
      args.CodeContent ??
      args.ReplacementContent ??
      args.content ??
      args.new_content ??
      args.replacement_content;
    newContent = typeof rawNew === "string" ? rawNew : undefined;

    const rawOld = args.TargetContent ?? args.old_content ?? args.target_content;
    oldContent = typeof rawOld === "string" ? rawOld : undefined;
  }

  // Only read disk if write_to_file (full-file write), NOT for replace_file_content or partial edits!
  if (toolName === "write_to_file" && oldContent === undefined && targetFile) {
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

/** Reads the payload from stdin and writes the decision to stdout. */
function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    /** @type {GuardDecision} */
    let result;
    try {
      result = decide(extractInput(JSON.parse(raw)));
    } catch {
      // Fail CLOSED: an unreadable payload must never silently unfreeze the repo.
      result = {
        decision: "ask",
        reason:
          "\u26a0\ufe0f Code Freeze Guard: payload could not be parsed \u2014 failing closed.",
      };
    }
    process.stdout.write(JSON.stringify(result));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("code-freeze-guard.js")) {
  main();
}
