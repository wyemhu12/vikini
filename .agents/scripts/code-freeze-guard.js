// @ts-check
/**
 * Code Freeze Guard — PreToolUse hook for write_to_file / replace_file_content / run_command / Read / Grep.
 *
 * Policy: Option 2 (Scoped Protection — Decided by Product Manager / QA):
 *   - ALLOW writes to the plan/doc surface (docs/*.md and root planning artifacts).
 *   - ALLOW writes to external Antigravity artifacts (~/.gemini/antigravity/brain/).
 *   - ALLOW Fast-Track micro-edits (replace_file_content / edit_file, <= 40 lines) on UI/translation/styling surfaces without an approved plan (excluding side-effect APIs in .tsx).
 *   - With approved plan: ALLOW writes ONLY to non-sensitive files explicitly declared with [NEW]/[MODIFY]/[DELETE] in the active approved plan(s) (Plan Scope Guard).
 *   - ALWAYS ASK for sensitive core files (*.server.ts, database migrations, TEST_INFRA_FILES,
 *     PROTECTED_INFRA_FILES, test files under Test Integrity Guard, and .agents/ governance files).
 *   - ALLOW run_command only for token-validated read-only commands with no shell
 *     chaining, subexpressions, redirection, mutating flags, or .env* secret access.
 *
 * Platform-level enforcement of the Strict Code Freeze rule in rules/05-plan-review.md.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REPO_ROOT,
  toPosix,
  toRepoRelative,
  normalizeForCompare,
  isEnvSecretPath,
} from "./guard-paths.js";
import {
  hasApprovedPlanHeader,
  hasCompletedPlanHeader,
  hasApprovedPlanFooter,
  evaluatePlanApprovalContent,
  isSelfForgedPlanWrite,
  evaluateLatestDateGroupPlans,
  extractDeclaredFiles,
  getActiveApprovedPlans,
  getApprovedPlanScope,
} from "./plan-scope.js";
import {
  evaluateCommand,
  SAFE_TOKEN,
  isSafeUnquotedToken,
  tokenizeSegment,
} from "./command-policy.js";

export {
  REPO_ROOT,
  toPosix,
  toRepoRelative,
  normalizeForCompare,
  isEnvSecretPath,
  hasApprovedPlanHeader,
  hasCompletedPlanHeader,
  hasApprovedPlanFooter,
  evaluatePlanApprovalContent,
  isSelfForgedPlanWrite,
  evaluateLatestDateGroupPlans,
  extractDeclaredFiles,
  getActiveApprovedPlans,
  getApprovedPlanScope,
  evaluateCommand,
  SAFE_TOKEN,
  isSafeUnquotedToken,
  tokenizeSegment,
};

/**
 * @typedef {{ decision: 'allow' | 'ask', reason?: string }} GuardDecision
 * @typedef {{ toolName?: string, targetFile?: string, searchGlob?: string, command?: string, newContent?: string, oldContent?: string }} GuardInput
 * @typedef {{ planApproved?: boolean, approvedFiles?: readonly string[] }} DecideOptions
 */

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

/** Harness, build, and hook configuration files that must always require confirmation (P0-3). */
export const PROTECTED_INFRA_FILES = [
  "scripts/code-freeze-guard.js",
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".husky/install.mjs",
  "next.config.ts",
  "package-lock.json",
  ".npmrc",
  "AGENTS.md",
  "CLAUDE.md",
];

/** Directory prefixes that belong to protected harness/hook infrastructure (P0-3). */
export const PROTECTED_INFRA_PREFIXES = [".claude/", ".husky/"];

/**
 * Checks if targetFile is a valid Antigravity artifact path outside the repo.
 *
 * @param {string | undefined} targetFile
 * @returns {boolean}
 */
export function isAntigravityArtifact(targetFile) {
  if (typeof targetFile !== "string") return false;

  if (!path.isAbsolute(targetFile)) {
    return false;
  }

  if (toRepoRelative(targetFile) !== null) {
    return false;
  }

  const targetAbsolute = path.resolve(targetFile);
  const rel = toPosix(path.relative(ARTIFACT_ROOT, targetAbsolute));
  if (rel === "" || rel.startsWith("../") || path.isAbsolute(rel)) {
    return false;
  }

  const ext = path.extname(targetAbsolute).toLowerCase();
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }

  if (ext === ".md" || ext === ".json") {
    return true;
  }

  const parts = rel.split("/");
  if (parts.includes("scratch") && SAFE_SCRATCH_EXTENSIONS.includes(ext)) {
    return true;
  }

  return false;
}

/**
 * Checks whether an active approved implementation plan exists in `docs/plans/*.md`
 * (Single Source of Truth — preserves `export function isPlanApproved()` signature).
 *
 * @returns {boolean}
 */
export function isPlanApproved() {
  return getApprovedPlanScope().approved;
}

/**
 * Determines whether a repo-relative path points to a test file.
 *
 * @param {string | null | undefined} relative
 * @returns {boolean}
 */
export function isTestFile(relative) {
  if (!relative) return false;
  const norm = normalizeForCompare(relative);
  return (
    /\.test\.(ts|tsx)$/i.test(norm) ||
    /\.spec\.(ts|tsx)$/i.test(norm) ||
    /(?:^|\/)__tests__\//i.test(norm) ||
    /(?:^|\/)tests\//i.test(norm)
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
  const norm = normalizeForCompare(relative);
  return (
    /\.server\.(ts|tsx|js|jsx)$/i.test(norm) ||
    /(?:^|\/)src\/lib\/core\/supabase\.server\.ts$/i.test(norm)
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
  const norm = normalizeForCompare(relative);
  return (
    /(?:^|\/)supabase\/migrations\//i.test(norm) ||
    /(?:^|\/)database-migrations\//i.test(norm) ||
    /\.sql$/i.test(norm)
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
  return normalizeForCompare(relative).startsWith(".agents/");
}

/**
 * Checks if a path points to protected harness/infrastructure files (P0-3).
 *
 * @param {string | null | undefined} relative
 * @returns {boolean}
 */
export function isProtectedInfraFile(relative) {
  if (!relative) return false;
  const norm = normalizeForCompare(relative);
  if (!norm) return false;
  if (PROTECTED_INFRA_FILES.some((f) => normalizeForCompare(f) === norm)) {
    return true;
  }
  return PROTECTED_INFRA_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

/**
 * Heuristically assesses whether test modifications weaken test assertions.
 *
 * @param {string | undefined} oldContent
 * @param {string | undefined} newContent
 * @returns {string[]} List of weakening signals detected
 */
export function assessTestIntegrity(oldContent, newContent) {
  if (oldContent === undefined || newContent === undefined) {
    return ["unavailable (payload carried partial or missing content)"];
  }

  const oldText = oldContent;
  const newText = newContent;
  const signals = [];

  /** @type {(str: string, regex: RegExp) => number} */
  const countMatches = (str, regex) => (str.match(regex) ?? []).length;

  const oldExpects = countMatches(oldText, /\bexpect\s*\(/g);
  const newExpects = countMatches(newText, /\bexpect\s*\(/g);
  const expectDelta = newExpects - oldExpects;
  if (expectDelta < 0) {
    const diff = Math.abs(expectDelta);
    signals.push(`${diff} fewer expect() call${diff === 1 ? "" : "s"}`);
  }

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
const FAST_TRACK_EXCLUDED_PATHS = /\.(?:test|spec|server)\.tsx$/i;

/** Content that must never ride the Fast-Track lane on any surface. */
const FAST_TRACK_FORBIDDEN_CONTENT = /["']use server["']|\bprocess\.env\b|\.server["']/;

/** Side-effect APIs (network, storage, dynamic eval, raw HTML) forbidden in Fast-Track .tsx edits (P2). */
export const FAST_TRACK_FORBIDDEN_CONTENT_TSX =
  /\bfetch\b|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bnavigator\.sendBeacon\b|\beval\b|\bFunction\s*\(|\bnew\s+Function\b|\b(?:localStorage|sessionStorage|indexedDB)\b|\bdocument\.cookie\b|\bcookieStore\b|\bwindow\.location\b|\blocation\.(?:href|assign|replace)\b|\bimport\s*\(|dangerouslySetInnerHTML|\b(?:window|globalThis|self)\s*\[/;

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
  if (FAST_TRACK_FORBIDDEN_CONTENT.test(newContent)) return false;
  if (
    relative.toLowerCase().endsWith(".tsx") &&
    FAST_TRACK_FORBIDDEN_CONTENT_TSX.test(newContent)
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves the effective plan approval and declared-file scope from DecideOptions or disk.
 *
 * @param {DecideOptions} options
 * @returns {{ approved: boolean, files: readonly string[] }}
 */
function resolvePlanScope(options) {
  if (options.planApproved === false) {
    return { approved: false, files: [] };
  }
  if (options.approvedFiles !== undefined) {
    return {
      approved: true,
      files: options.approvedFiles,
    };
  }
  if (options.planApproved === true) {
    return { approved: true, files: [] };
  }
  return getApprovedPlanScope();
}

/**
 * Decides whether a tool call may proceed without user confirmation.
 * Implements Option 2 (Scoped Protection) + Plan Scope Guard (P1-7).
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

  const isReadTool =
    input.toolName === "Read" ||
    input.toolName === "read_file" ||
    input.toolName === "view_file" ||
    input.toolName === "Grep";

  if (isReadTool && (input.targetFile || input.searchGlob)) {
    if (isEnvSecretPath(input.targetFile) || isEnvSecretPath(input.searchGlob)) {
      const targetDesc = input.searchGlob ?? input.targetFile ?? ".env";
      return ask(
        `\u26a0\ufe0f Code Freeze Guard: reading .env* secret files is prohibited (${targetDesc}).`
      );
    }
    return { decision: "allow" };
  }

  if (input.targetFile) {
    // 1. External path checks (must be valid Antigravity artifact)
    if (toRepoRelative(input.targetFile) === null) {
      if (isAntigravityArtifact(input.targetFile)) {
        return { decision: "allow" };
      }
      return ask(`Write targets a path outside the repository: ${input.targetFile}`);
    }

    const relative = /** @type {string} */ (toRepoRelative(input.targetFile));
    const norm = normalizeForCompare(relative);

    // 2. Prohibited internal directories and secrets (case-insensitive NTFS)
    if (
      norm.includes(".gemini/") ||
      norm === ".git" ||
      norm.startsWith(".git/") ||
      norm.includes("/.git/") ||
      isEnvSecretPath(relative)
    ) {
      return ask(`Security Guard: write targets a prohibited path: ${relative}`);
    }

    // 3. Unfrozen paths (docs/ and root planning artifacts)
    const unfrozen =
      UNFROZEN_PREFIXES.some((prefix) => norm.startsWith(prefix)) ||
      UNFROZEN_FILES.some((f) => normalizeForCompare(f) === norm);
    if (unfrozen) {
      if (!norm.endsWith(".md")) {
        return ask(
          `\u26a0\ufe0f Code Freeze Guard: only .md files are allowed inside unfrozen documentation paths (${relative}).`
        );
      }

      if (
        (norm === "docs/plans" || norm.startsWith("docs/plans/")) &&
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

    // 3b. PRIORITY: Test Infrastructure Guard (checked BEFORE isProtectedInfraFile and isTestFile)
    if (TEST_INFRA_FILES.some((f) => normalizeForCompare(f) === norm)) {
      return ask(
        [
          "\u26a0\ufe0f Test Infrastructure Guard: this edit changes test configuration.",
          `Path: ${relative}`,
          "Before approving, ask the agent whether it narrows which tests run, relaxes the lint gate or weakens a CI/pre-commit step, and why.",
        ].join("\n")
      );
    }

    // 3c. Protected Harness & Infrastructure Guard (P0-3)
    if (isProtectedInfraFile(relative)) {
      return ask(
        [
          "\u26a0\ufe0f Infrastructure Guard: write targets protected harness/infra file.",
          `Path: ${relative}`,
          "Approve only if you explicitly intended to modify agent harness or build infrastructure.",
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

    // 9. Plan Scope Guard (P1-7): only allow files declared in active approved plan(s)
    const scope = resolvePlanScope(options);
    if (!scope.approved) {
      return ask(
        [
          "\u26a0\ufe0f Code Freeze Guard: write targets a frozen path.",
          `Path: ${relative}`,
          "Approve only if [PLAN_APPROVED] has been granted by Lead Reviewer (@reviewer or Claude CLI fallback).",
        ].join("\n")
      );
    }

    const isDeclared = scope.files.some((f) => normalizeForCompare(f) === norm);
    if (isDeclared) {
      return { decision: "allow" };
    }

    return ask(
      [
        `\u26a0\ufe0f Plan Scope Guard: ${relative} is not declared with [NEW]/[MODIFY]/[DELETE] in the active approved plan(s).`,
        `Path: ${relative}`,
        "Approve only if this file belongs to the current task scope.",
      ].join("\n")
    );
  }

  if (input.command) {
    const verdict = evaluateCommand(input.command);
    if (verdict.ok) {
      return { decision: "allow" };
    }
    return ask(verdict.reason);
  }

  return ask(
    "\u26a0\ufe0f Code Freeze Guard: tool call carries no recognisable target \u2014 failing closed."
  );
}

/**
 * Antigravity serialises some tool arguments as JSON string literals.
 * Decodes one such layer so the allowlist matches the real command.
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

  const rawTarget = unwrapJsonString(
    args.TargetFile ?? args.Path ?? args.file_path ?? args.notebook_path ?? args.path
  );
  let targetFile = typeof rawTarget === "string" ? rawTarget : undefined;

  const rawGlob = unwrapJsonString(args.glob ?? args.Glob ?? args.Include);
  const searchGlob = typeof rawGlob === "string" ? rawGlob : undefined;

  if (toolName === "Grep" && targetFile === undefined && searchGlob !== undefined) {
    targetFile = ".";
  }

  const rawCommand = unwrapJsonString(args.CommandLine ?? args.Command ?? args.command);
  const command = typeof rawCommand === "string" ? rawCommand : undefined;

  let newContent;
  let oldContent;

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
    ...(searchGlob !== undefined ? { searchGlob } : {}),
    command,
    newContent,
    oldContent,
  };
}

/**
 * Formats the guard decision for either Google Antigravity hooks (`{ decision, reason }`)
 * or Claude Code CLI `PreToolUse` hooks (`{ hookSpecificOutput }` or `null` on allow).
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

/**
 * Pure, testable hook execution entry helper (P2).
 * - Malformed JSON payload -> exitCode 0 with `decision: "ask"` (fail closed).
 * - Unexpected internal exception -> exitCode 2 with stderr message and stdout `decision: "ask"` (blocking fail-closed).
 *
 * @param {string} raw
 * @param {{ decide?: typeof decide, extractInput?: typeof extractInput, formatHookOutput?: typeof formatHookOutput }} [deps]
 * @returns {{ stdout: string, stderr: string, exitCode: 0 | 2 }}
 */
export function runHook(raw, deps = {}) {
  const decideFn = deps.decide ?? decide;
  const extractFn = deps.extractInput ?? extractInput;
  const formatFn = deps.formatHookOutput ?? formatHookOutput;

  /** @type {unknown} */
  let parsedPayload;
  try {
    parsedPayload = JSON.parse(raw);
  } catch {
    const fallbackResult = /** @type {GuardDecision} */ ({
      decision: "ask",
      reason: "\u26a0\ufe0f Code Freeze Guard: payload could not be parsed \u2014 failing closed.",
    });
    const out = formatFn(fallbackResult, undefined);
    return {
      stdout: out !== null ? JSON.stringify(out) : "",
      stderr: "",
      exitCode: 0,
    };
  }

  try {
    const result = decideFn(extractFn(parsedPayload));
    const output = formatFn(result, parsedPayload);
    return {
      stdout: output !== null ? JSON.stringify(output) : "",
      stderr: "",
      exitCode: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const reason = `\u26a0\ufe0f Code Freeze Guard: internal error (${msg}) \u2014 failing closed.`;
    return {
      stdout: JSON.stringify({ decision: "ask", reason }),
      stderr: `${reason}\n`,
      exitCode: 2,
    };
  }
}

/** Installs process-level crash handlers so uncaught errors exit with code 2 (blocking error). */
function installCrashHandlers() {
  const failClosed = (/** @type {unknown} */ err) => {
    const msg = err instanceof Error ? err.message : String(err);
    const reason = `\u26a0\ufe0f Code Freeze Guard: uncaught error (${msg}) \u2014 failing closed.`;
    try {
      process.stderr.write(`${reason}\n`);
      process.stdout.write(JSON.stringify({ decision: "ask", reason }));
    } catch {
      // ignore stdio errors during crash
    }
    process.exit(2);
  };
  process.on("uncaughtException", failClosed);
  process.on("unhandledRejection", failClosed);
}

/** Reads the payload from stdin and writes the formatted decision to stdout. */
function main() {
  installCrashHandlers();
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    const { stdout, stderr, exitCode } = runHook(raw);
    if (stderr) {
      process.stderr.write(stderr);
    }
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("code-freeze-guard.js")) {
  main();
}
