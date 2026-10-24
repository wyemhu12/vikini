// @ts-check
/**
 * Path normalisation and secret-path detection helpers for Code Freeze Guard.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, derived from this file's location (.agents/scripts/guard-paths.js -> repo root). */
export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");

/** Windows path separator, built without a literal escape so the source stays lexer-safe. */
export const WINDOWS_SEPARATOR = String.fromCharCode(92);

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
 * Normalises a path string to POSIX lower-case for case-insensitive NTFS comparisons.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function normalizeForCompare(value) {
  if (typeof value !== "string") return "";
  return toPosix(value).trim().toLowerCase();
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
  const trimmed = targetFile.trim();
  if (!trimmed) return null;
  const absolute = path.resolve(REPO_ROOT, toPosix(trimmed));
  const relative = toPosix(path.relative(REPO_ROOT, absolute));
  if (relative === "" || relative.startsWith("../") || path.isAbsolute(relative)) {
    return null;
  }
  return relative;
}

/**
 * Pattern matching any path segment that targets a `.env*` secret file or glob pattern.
 * Matches `.env`, `.env.local`, `.ENV.production`, `.env*`, `.env_test`, `.en[v]`, `.en?`, etc.,
 * while allowing `env.ts`, `environment.md`, `envConfig.ts`.
 */
const ENV_SEGMENT_PATTERN = /^\.env(?:$|[.\-_*?\[])|^\.en(?:\[[^\]]*\]|\?)/i;

/**
 * Determines whether a file path, git `<rev>:<path>` spec, or glob pattern
 * targets a `.env*` secret file.
 *
 * @param {string | null | undefined} rawPath
 * @returns {boolean}
 */
export function isEnvSecretPath(rawPath) {
  if (typeof rawPath !== "string") return false;
  const trimmed = rawPath.trim().replace(/^['"]+|['"]+$/g, "");
  if (!trimmed) return false;

  const posix = toPosix(trimmed);
  const segments = posix.split(/[/:]+/).filter(Boolean);
  for (const segment of segments) {
    if (ENV_SEGMENT_PATTERN.test(segment)) {
      return true;
    }
  }

  const rel = toRepoRelative(trimmed);
  if (rel !== null) {
    const relSegments = rel.split("/").filter(Boolean);
    for (const segment of relSegments) {
      if (ENV_SEGMENT_PATTERN.test(segment)) {
        return true;
      }
    }
  }

  return false;
}
