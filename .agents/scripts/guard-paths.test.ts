import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  REPO_ROOT,
  toPosix,
  normalizeForCompare,
  toRepoRelative,
  isEnvSecretPath,
} from "./guard-paths.js";

describe("guard-paths", () => {
  describe("toPosix & normalizeForCompare", () => {
    it("converts Windows backslashes to forward slashes", () => {
      const sep = String.fromCharCode(92);
      expect(toPosix(["a", "b", "c.ts"].join(sep))).toBe("a/b/c.ts");
    });

    it("normalises paths to trimmed lower-case POSIX for NTFS comparisons", () => {
      const sep = String.fromCharCode(92);
      expect(normalizeForCompare([".Claude", "Settings.JSON"].join(sep))).toBe(
        ".claude/settings.json"
      );
      expect(normalizeForCompare("  .AGENTS/Rules/00-Core.md  ")).toBe(".agents/rules/00-core.md");
      expect(normalizeForCompare(null)).toBe("");
      expect(normalizeForCompare(undefined)).toBe("");
    });
  });

  describe("toRepoRelative", () => {
    it("normalises relative POSIX and Windows paths inside REPO_ROOT", () => {
      expect(toRepoRelative("docs/plans/task.md")).toBe("docs/plans/task.md");
      const sep = String.fromCharCode(92);
      expect(toRepoRelative([".", "docs", "plans", "task.md"].join(sep))).toBe(
        "docs/plans/task.md"
      );
      expect(toRepoRelative(path.join(REPO_ROOT, "src", "app", "page.tsx"))).toBe(
        "src/app/page.tsx"
      );
    });

    it("returns null for paths escaping the repository or invalid inputs", () => {
      expect(toRepoRelative("../../etc/passwd")).toBeNull();
      expect(toRepoRelative("")).toBeNull();
      expect(toRepoRelative("   ")).toBeNull();
      expect(toRepoRelative(undefined)).toBeNull();
    });
  });

  describe("isEnvSecretPath", () => {
    it("detects .env* files across relative, absolute, git rev:path, and glob patterns", () => {
      for (const secret of [
        ".env",
        ".env.local",
        ".env.production",
        ".ENV.local",
        "config/.env.development",
        "C:/Users/wyemh/vikini/.env.local",
        "C:\\Users\\wyemh\\vikini\\.env.local",
        "HEAD:.env.local",
        ":.env",
        "HEAD:./.env.production",
        "HEAD:src/../.env",
        "HEAD:C:\\Users\\wyemh\\vikini\\.env.local",
        ".env*",
        "**/.env*",
        ":(glob)**/.env",
        ".en[v]",
        ".en?",
        ".env.test.ts",
      ]) {
        expect(isEnvSecretPath(secret), secret).toBe(true);
      }
    });

    it("allows non-secret paths that merely contain 'env' in a filename", () => {
      for (const safe of [
        "src/lib/env.ts",
        "docs/environment.md",
        "src/lib/core/envConfig.ts",
        "HEAD:src/lib/env.ts",
        "*.ts",
        "",
      ]) {
        expect(isEnvSecretPath(safe), safe).toBe(false);
      }
      expect(isEnvSecretPath(undefined)).toBe(false);
      expect(isEnvSecretPath(null)).toBe(false);
    });
  });
});
