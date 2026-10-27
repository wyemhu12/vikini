// @ts-check
/**
 * Token-level command whitelist and secret-argument validator (P0-1, P1-5).
 * Replaces character-blacklist regexes with strict token parsing.
 */

import { isEnvSecretPath } from "./guard-paths.js";

/**
 * @typedef {{ value: string, quote: 'none' | 'single' | 'double', raw: string }} CommandToken
 * @typedef {{ ok: true } | { ok: false, reason: string }} CommandVerdict
 */

/** Control characters (including CR, LF, NUL) and Unicode smart/typographic quotes (A2). */
const FORBIDDEN_GLOBAL_CHARS = /[\x00-\x08\x0A-\x1F\x7F\u2018-\u201F\u2032-\u2037\u00AB\u00BB]/;

/** Unquoted shell operators, subexpression delimiters, and escape characters. */
const SHELL_OPERATOR_CHARS = /[|&<>(){}`$]/;

/** Flags that rewrite files or load external executable configs even when the base command is read-only. */
const MUTATING_TOKEN_PATTERN =
  /^(?:--fix|--write|--force|--output|--outputFile|--config|--root|--dir|--globalSetup|--setupFiles|--extcmd|--update|--coverage)(?:=.*)?$|^-(?:c|u|i)$/;

/** Scoped npm package pattern (`@scope/pkg`), distinct from PowerShell `@splat` variables. */
const SCOPED_NPM_PACKAGE = /^@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
 * General safe unquoted token pattern:
 * - Must start with an ASCII alphanumeric or path character (`[A-Za-z0-9._/\\-]`), OR be a scoped npm package (`@scope/pkg`).
 * - Subsequent characters are restricted to `[A-Za-z0-9._/\\:=,+~^\[\]-]`.
 */
export const SAFE_TOKEN = /^[A-Za-z0-9._/\\-][A-Za-z0-9._/\\:=,+~^\[\]-]*$/;

/**
 * Checks whether an unquoted token string satisfies strict token safety rules.
 *
 * @param {string} val
 * @returns {boolean}
 */
export function isSafeUnquotedToken(val) {
  if (!val || val === "--%" || val.includes("#")) return false;
  if (val.startsWith("@")) {
    return SCOPED_NPM_PACKAGE.test(val);
  }
  return SAFE_TOKEN.test(val);
}

/**
 * Splits a command string on top-level `;` characters that appear outside single or double quotes.
 *
 * @param {string} command
 * @returns {{ sawSemicolon: boolean, segments: string[] }}
 */
function splitTopLevelSemicolons(command) {
  /** @type {string[]} */
  const segments = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let sawSemicolon = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
    } else if (ch === ";" && !inSingle && !inDouble) {
      sawSemicolon = true;
      segments.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  segments.push(current.trim());
  return { sawSemicolon, segments };
}

/**
 * Tokenises a single command segment (with no top-level `;`) into typed tokens.
 *
 * @param {string} segment
 * @returns {{ ok: true, tokens: CommandToken[] } | { ok: false, kind: 'escape' | 'allowlist' }}
 */
export function tokenizeSegment(segment) {
  /** @type {CommandToken[]} */
  const tokens = [];
  let i = 0;
  const n = segment.length;

  while (i < n) {
    while (i < n && (segment[i] === " " || segment[i] === "\t")) {
      i++;
    }
    if (i >= n) break;

    const start = i;
    const first = segment[i];

    if (first === "'") {
      const closeIdx = segment.indexOf("'", i + 1);
      if (closeIdx === -1) {
        return { ok: false, kind: "allowlist" };
      }
      const nextChar = segment[closeIdx + 1];
      if (nextChar !== undefined && nextChar !== " " && nextChar !== "\t") {
        // Rejects doubled single quotes ('it''s') and adjacent trailing tokens ('a'b)
        return { ok: false, kind: "allowlist" };
      }
      const inner = segment.slice(i + 1, closeIdx);
      tokens.push({
        value: inner,
        quote: "single",
        raw: segment.slice(start, closeIdx + 1),
      });
      i = closeIdx + 1;
    } else if (first === '"') {
      const closeIdx = segment.indexOf('"', i + 1);
      if (closeIdx === -1) {
        return { ok: false, kind: "allowlist" };
      }
      const nextChar = segment[closeIdx + 1];
      if (nextChar !== undefined && nextChar !== " " && nextChar !== "\t") {
        // Rejects backslash-escaped quotes ("a\"b") and adjacent trailing tokens ("a"b)
        return { ok: false, kind: "allowlist" };
      }
      const inner = segment.slice(i + 1, closeIdx);
      if (inner.includes("$") || inner.includes("`")) {
        return { ok: false, kind: "escape" };
      }
      tokens.push({
        value: inner,
        quote: "double",
        raw: segment.slice(start, closeIdx + 1),
      });
      i = closeIdx + 1;
    } else {
      while (i < n && segment[i] !== " " && segment[i] !== "\t") {
        i++;
      }
      const raw = segment.slice(start, i);
      if (SHELL_OPERATOR_CHARS.test(raw)) {
        return { ok: false, kind: "escape" };
      }
      if (raw.includes("'") || raw.includes('"')) {
        return { ok: false, kind: "allowlist" };
      }
      tokens.push({
        value: raw,
        quote: "none",
        raw,
      });
    }
  }

  if (tokens.length === 0) {
    return { ok: false, kind: "allowlist" };
  }
  return { ok: true, tokens };
}

/**
 * Validates arguments after `npx vitest run|list` or `npm run test:run --`.
 *
 * @param {CommandToken[]} rest
 * @param {number} minRest
 * @returns {{ ok: true } | { ok: false, kind: 'escape' | 'env' | 'allowlist' }}
 */
function validateVitestArgs(rest, minRest) {
  if (rest.length < minRest) return { ok: false, kind: "allowlist" };
  for (const t of rest) {
    if (isEnvSecretPath(t.value)) {
      return { ok: false, kind: "env" };
    }
    if (t.quote !== "none") {
      if (t.value.startsWith("-") || !/^[A-Za-z0-9._/\\\[\]-]+$/.test(t.value)) {
        return { ok: false, kind: "allowlist" };
      }
      continue;
    }
    if (!isSafeUnquotedToken(t.value)) {
      return { ok: false, kind: "allowlist" };
    }
    if (
      /^--reporter=[\w-]+$/.test(t.value) ||
      t.value === "--filesOnly" ||
      !t.value.startsWith("-")
    ) {
      continue;
    }
    return { ok: false, kind: "allowlist" };
  }
  return { ok: true };
}

/**
 * Validates arguments after `git status|diff|log|show|blame`.
 *
 * @param {CommandToken[]} rest
 * @returns {{ ok: true } | { ok: false, kind: 'escape' | 'env' | 'allowlist' }}
 */
function validateGitArgs(rest) {
  for (const t of rest) {
    if (
      t.value === "--no-index" ||
      t.value.startsWith("--no-index=") ||
      isEnvSecretPath(t.value) ||
      /[*?\[\]]/.test(t.value)
    ) {
      return { ok: false, kind: "env" };
    }
    if (t.quote !== "none") {
      return { ok: false, kind: "allowlist" };
    }
    if (!isSafeUnquotedToken(t.value) || t.value.startsWith("@")) {
      return { ok: false, kind: "allowlist" };
    }
    if (t.value === "--ext-diff" || t.value.startsWith("--output") || /^-[cC]$/.test(t.value)) {
      return { ok: false, kind: "escape" };
    }
    if (t.value.includes(",") && !/^\d+,\d+$/.test(t.value)) {
      return { ok: false, kind: "allowlist" };
    }
  }
  return { ok: true };
}

/**
 * Shared validator for `docs/plans/<name>.md` tokens (used by -PlanFile and verify-plan.mjs).
 *
 * @param {CommandToken | undefined} tok
 * @param {{ requireUnquoted?: boolean }} [options]
 * @returns {{ ok: true } | { ok: false, kind: 'env' | 'allowlist' }}
 */
function validatePlanPathToken(tok, options = {}) {
  if (!tok) return { ok: false, kind: "allowlist" };
  if (options.requireUnquoted && tok.quote !== "none") {
    return { ok: false, kind: "allowlist" };
  }
  if (isEnvSecretPath(tok.value)) return { ok: false, kind: "env" };
  if (tok.value.includes("..") || !/^docs[/\\]plans[/\\][A-Za-z0-9._-]+\.md$/i.test(tok.value)) {
    return { ok: false, kind: "allowlist" };
  }
  return { ok: true };
}

/**
 * Validates arguments after `powershell(.exe)?` for `.agents/scripts/run-claude.ps1`.
 *
 * @param {CommandToken[]} rest
 * @returns {{ ok: true } | { ok: false, kind: 'escape' | 'env' | 'allowlist' }}
 */
function validateRunClaudeArgs(rest) {
  let idx = 0;
  let sawFile = false;

  while (idx < rest.length) {
    const tok = rest[idx];
    if (tok.quote !== "none") return { ok: false, kind: "allowlist" };
    const lower = tok.value.toLowerCase();

    if (lower === "-noprofile") {
      idx++;
    } else if (lower === "-executionpolicy") {
      const next = rest[idx + 1];
      if (
        !next ||
        next.quote !== "none" ||
        !/^(?:bypass|remotesigned|unrestricted)$/i.test(next.value)
      ) {
        return { ok: false, kind: "allowlist" };
      }
      idx += 2;
    } else if (lower === "-file") {
      const scriptTok = rest[idx + 1];
      if (!scriptTok || !/^\.agents[/\\]scripts[/\\]run-claude\.ps1$/i.test(scriptTok.value)) {
        return { ok: false, kind: "allowlist" };
      }
      sawFile = true;
      idx += 2;
      break;
    } else {
      return { ok: false, kind: "allowlist" };
    }
  }

  if (!sawFile) return { ok: false, kind: "allowlist" };

  while (idx < rest.length) {
    const paramTok = rest[idx];
    if (paramTok.quote !== "none") return { ok: false, kind: "allowlist" };
    const param = paramTok.value.toLowerCase();

    if (param === "-checkonly") {
      idx++;
    } else if (param === "-role" || param === "-mode") {
      const valTok = rest[idx + 1];
      if (
        !valTok ||
        valTok.quote !== "none" ||
        !/^(?:planner|reviewer|plan|review|critic)$/i.test(valTok.value)
      ) {
        return { ok: false, kind: "allowlist" };
      }
      idx += 2;
    } else if (param === "-planfile") {
      const check = validatePlanPathToken(rest[idx + 1]);
      if (!check.ok) return check;
      idx += 2;
    } else if (param === "-model") {
      const valTok = rest[idx + 1];
      if (!valTok || valTok.quote !== "none" || !/^[A-Za-z0-9._-]+$/.test(valTok.value)) {
        return { ok: false, kind: "allowlist" };
      }
      idx += 2;
    } else if (param === "-artifactfile") {
      const valTok = rest[idx + 1];
      if (!valTok) return { ok: false, kind: "allowlist" };
      if (isEnvSecretPath(valTok.value)) return { ok: false, kind: "env" };
      if (
        valTok.value.includes("..") ||
        !/^[^\s"']*[/\\]\.gemini[/\\]antigravity[/\\]brain[/\\][^\s"']+\.md$/i.test(valTok.value)
      ) {
        return { ok: false, kind: "allowlist" };
      }
      idx += 2;
    } else if (param === "-task" || param === "-prompt") {
      const valTok = rest[idx + 1];
      if (!valTok || !valTok.value) return { ok: false, kind: "allowlist" };
      if (valTok.quote === "double") {
        // Double-quoted Task must not contain backslash, $, `, or "
        if (
          valTok.value.includes("\\") ||
          valTok.value.includes("$") ||
          valTok.value.includes("`")
        ) {
          return { ok: false, kind: "allowlist" };
        }
      } else if (valTok.quote === "none") {
        if (!isSafeUnquotedToken(valTok.value) || valTok.value.startsWith("@")) {
          return { ok: false, kind: "allowlist" };
        }
      }
      idx += 2;
    } else {
      return { ok: false, kind: "allowlist" };
    }
  }

  return { ok: true };
}

/**
 * Validates arguments after `claude(.exe)?`.
 *
 * @param {CommandToken[]} rest
 * @returns {{ ok: true } | { ok: false, kind: 'escape' | 'env' | 'allowlist' }}
 */
function validateClaudeProbe(rest) {
  if (
    rest.length === 1 &&
    rest[0].quote === "none" &&
    /^(?:--version|-v|--help|-h)$/i.test(rest[0].value)
  ) {
    return { ok: true };
  }
  if (
    rest.length === 2 &&
    rest[0].quote === "none" &&
    /^-p$/i.test(rest[0].value) &&
    rest[1].value.toLowerCase() === "ping"
  ) {
    return { ok: true };
  }
  return { ok: false, kind: "allowlist" };
}

/**
 * Evaluates a single command segment (without top-level `;`).
 *
 * @param {string} segment
 * @returns {{ ok: true } | { ok: false, kind: 'escape' | 'env' | 'allowlist' }}
 */
function evaluateSingleSegment(segment) {
  const tokenized = tokenizeSegment(segment);
  if (!tokenized.ok) {
    return tokenized;
  }

  const { tokens } = tokenized;

  // Check mutating flags and `tee` across all unquoted tokens
  for (const t of tokens) {
    if (t.quote === "none") {
      if (t.value === "tee" || MUTATING_TOKEN_PATTERN.test(t.value)) {
        return { ok: false, kind: "escape" };
      }
    }
  }

  const t0 = tokens[0];
  const t1 = tokens[1];
  const t2 = tokens[2];
  const t3 = tokens[3];

  if (t0.quote !== "none") {
    return { ok: false, kind: "allowlist" };
  }

  // 1. npm run ... / npm ls ... / npm view ...
  if (t0.value === "npm" && t1 && t1.quote === "none") {
    if (t1.value === "run" && t2 && t2.quote === "none") {
      if (tokens.length === 3 && /^(?:type-check|lint|test:run|verify)$/.test(t2.value)) {
        return { ok: true };
      }
      if (t2.value === "test:run" && t3 && t3.quote === "none" && t3.value === "--") {
        return validateVitestArgs(tokens.slice(4), 1);
      }
      return { ok: false, kind: "allowlist" };
    }

    if (t1.value === "ls") {
      const rest = tokens.slice(2);
      for (const tok of rest) {
        if (isEnvSecretPath(tok.value)) return { ok: false, kind: "env" };
        if (tok.quote !== "none" || !isSafeUnquotedToken(tok.value) || tok.value.includes(",")) {
          return { ok: false, kind: "allowlist" };
        }
      }
      return { ok: true };
    }

    if (t1.value === "view") {
      const rest = tokens.slice(2);
      if (rest.length < 1) return { ok: false, kind: "allowlist" };
      for (const tok of rest) {
        if (isEnvSecretPath(tok.value)) return { ok: false, kind: "env" };
        if (tok.quote !== "none" || !isSafeUnquotedToken(tok.value) || tok.value.includes(",")) {
          return { ok: false, kind: "allowlist" };
        }
      }
      return { ok: true };
    }

    return { ok: false, kind: "allowlist" };
  }

  // 2. npx vitest | npx tsc | npx eslint
  if (t0.value === "npx" && t1 && t1.quote === "none") {
    if (t1.value === "vitest" && t2 && t2.quote === "none" && /^(?:run|list)$/.test(t2.value)) {
      return validateVitestArgs(tokens.slice(3), 0);
    }

    if (
      t1.value === "tsc" &&
      tokens.length === 3 &&
      t2 &&
      t2.quote === "none" &&
      /^--(?:noEmit|showConfig)$/.test(t2.value)
    ) {
      return { ok: true };
    }

    if (
      t1.value === "eslint" &&
      tokens.length === 4 &&
      t2 &&
      t2.quote === "none" &&
      t2.value === "--print-config" &&
      t3
    ) {
      if (isEnvSecretPath(t3.value)) return { ok: false, kind: "env" };
      if (t3.quote !== "none" || !isSafeUnquotedToken(t3.value) || t3.value.startsWith("-")) {
        return { ok: false, kind: "allowlist" };
      }
      return { ok: true };
    }

    return { ok: false, kind: "allowlist" };
  }

  // 3. git status|diff|log|show|blame
  if (t0.value === "git" && t1 && t1.quote === "none") {
    if (/^(?:status|diff|log|show|blame)$/.test(t1.value)) {
      return validateGitArgs(tokens.slice(2));
    }
    return { ok: false, kind: "allowlist" };
  }

  // 4. powershell(.exe)? ... -File .agents/scripts/run-claude.ps1
  if (/^powershell(?:\.exe)?$/i.test(t0.value)) {
    return validateRunClaudeArgs(tokens.slice(1));
  }

  // 5. claude(.exe)? probe
  if (/^claude(?:\.exe)?$/i.test(t0.value)) {
    return validateClaudeProbe(tokens.slice(1));
  }

  // 6. node scripts/verify-docs.mjs
  if (t0.value === "node" && t1 && /^(?:\.[/\\])?scripts[/\\]verify-docs\.mjs$/.test(t1.value)) {
    const rest = tokens.slice(2);
    for (const tok of rest) {
      if (isEnvSecretPath(tok.value)) return { ok: false, kind: "env" };
      if (
        tok.quote !== "none" ||
        !/^(?:--strict-shorthand|--expected-headings=\d+)$/.test(tok.value)
      ) {
        return { ok: false, kind: "allowlist" };
      }
    }
    return { ok: true };
  }

  // 7. node scripts/verify-plan.mjs <docs/plans/*.md>
  if (t0.value === "node" && t1 && /^(?:\.[/\\])?scripts[/\\]verify-plan\.mjs$/.test(t1.value)) {
    const rest = tokens.slice(2);
    if (rest.length !== 1) return { ok: false, kind: "allowlist" };
    return validatePlanPathToken(rest[0], { requireUnquoted: true });
  }

  return { ok: false, kind: "allowlist" };
}

/**
 * Evaluates a shell command string against the token-level allowlist and secret-path rules.
 *
 * @param {string} rawCommand
 * @returns {CommandVerdict}
 */
export function evaluateCommand(rawCommand) {
  const command = typeof rawCommand === "string" ? rawCommand.trim() : "";
  if (!command) {
    return {
      ok: false,
      reason: [
        "\u26a0\ufe0f Code Freeze Guard: command is outside the read-only ALLOWLIST.",
        `Command: ${rawCommand ?? ""}`,
      ].join("\n"),
    };
  }

  if (FORBIDDEN_GLOBAL_CHARS.test(command)) {
    return {
      ok: false,
      reason: [
        "\u26a0\ufe0f Code Freeze Guard: command contains control characters, newlines, or smart quotes outside the read-only ALLOWLIST.",
        `Command: ${command}`,
      ].join("\n"),
    };
  }

  const { sawSemicolon, segments } = splitTopLevelSemicolons(command);
  if (sawSemicolon) {
    if (segments.some((s) => !s)) {
      return {
        ok: false,
        reason: [
          "\u26a0\ufe0f Code Freeze Guard: command chain contains a segment outside the read-only ALLOWLIST.",
          `Command: ${command}`,
        ].join("\n"),
      };
    }

    for (const seg of segments) {
      const res = evaluateSingleSegment(seg);
      if (!res.ok) {
        return {
          ok: false,
          reason: [
            "\u26a0\ufe0f Code Freeze Guard: command chain contains a segment outside the read-only ALLOWLIST.",
            `Command: ${command}`,
          ].join("\n"),
        };
      }
    }
    return { ok: true };
  }

  const res = evaluateSingleSegment(command);
  if (res.ok) {
    return { ok: true };
  }

  if (res.kind === "env") {
    return {
      ok: false,
      reason: [
        "\u26a0\ufe0f Code Freeze Guard: command targets .env* secret files or uses disallowed git pathspec/flags (--no-index, globs) that can expose .env*.",
        `Command: ${command}`,
      ].join("\n"),
    };
  }

  if (res.kind === "escape") {
    return {
      ok: false,
      reason: [
        "\u26a0\ufe0f Code Freeze Guard: command contains redirection, chaining or a mutating flag.",
        `Command: ${command}`,
      ].join("\n"),
    };
  }

  return {
    ok: false,
    reason: [
      "\u26a0\ufe0f Code Freeze Guard: command is outside the read-only ALLOWLIST.",
      `Command: ${command}`,
    ].join("\n"),
  };
}
