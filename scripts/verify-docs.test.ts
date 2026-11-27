import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_MAX_CHARS,
  ALWAYS_ON_MAX_CHARS,
  RULE_MAX_BYTES,
  RULE_MAX_CHARS,
  checkGovernanceLimits,
  isAlwaysOnRule,
} from "./verify-docs.mjs";

const REPO_ROOT = process.cwd();
const SCRIPT_ABS = path.join(REPO_ROOT, "scripts", "verify-docs.mjs");
const ALWAYS_ON_HEADER = "---\ntrigger: always_on\n---\n";
const GLOB_HEADER = "---\ntrigger: glob\n---\n";

const tmpRoots: string[] = [];

function createTmpRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vikini-verify-docs-"));
  tmpRoots.push(dir);
  return dir;
}

function writeFile(root: string, relPath: string, content: string): void {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

afterEach(() => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("verify-docs.mjs — Governance Character & UTF-8 Byte Limits (VD-01..VD-06)", () => {
  it("VD-01: accepts exact upper boundaries for chars, UTF-8 bytes, always_on total, and agents", () => {
    expect(RULE_MAX_CHARS).toBe(16000);
    expect(RULE_MAX_BYTES).toBe(24000);
    expect(ALWAYS_ON_MAX_CHARS).toBe(28000);
    expect(AGENT_MAX_CHARS).toBe(10000);

    const tmpRoot = createTmpRoot();
    const ruleA = ALWAYS_ON_HEADER + "a".repeat(RULE_MAX_CHARS - ALWAYS_ON_HEADER.length);
    const ruleB =
      ALWAYS_ON_HEADER + "b".repeat(ALWAYS_ON_MAX_CHARS - RULE_MAX_CHARS - ALWAYS_ON_HEADER.length);
    const ruleGlobUtf8 = GLOB_HEADER + "ệ".repeat(7992) + "aa";
    const agentContent = "c".repeat(AGENT_MAX_CHARS);

    expect(ruleA.length).toBe(RULE_MAX_CHARS);
    expect(ruleB.length).toBe(12000);
    expect(ruleGlobUtf8.length).toBe(8016);
    expect(Buffer.byteLength(ruleGlobUtf8, "utf8")).toBe(RULE_MAX_BYTES);

    writeFile(tmpRoot, ".agents/rules/00-a.md", ruleA);
    writeFile(tmpRoot, ".agents/rules/01-b.md", ruleB);
    writeFile(tmpRoot, ".agents/rules/02-vi-exact.md", ruleGlobUtf8);
    writeFile(tmpRoot, ".agents/agents/sample/agent.md", agentContent);

    const report = checkGovernanceLimits(tmpRoot);
    expect(report.errors).toEqual([]);
    expect(report.ruleCount).toBe(3);
    expect(report.alwaysOnChars).toBe(ALWAYS_ON_MAX_CHARS);
    expect(report.agentCount).toBe(1);
  });

  it("VD-02 (NP): flags a rule exceeding 16,000 chars while under 24,000 UTF-8 bytes", () => {
    const tmpRoot = createTmpRoot();
    const overChars = "x".repeat(RULE_MAX_CHARS + 1);
    expect(Buffer.byteLength(overChars, "utf8")).toBeLessThanOrEqual(RULE_MAX_BYTES);

    writeFile(tmpRoot, ".agents/rules/over-chars.md", overChars);

    const report = checkGovernanceLimits(tmpRoot);
    expect(report.errors).toEqual([".agents/rules/over-chars.md has 16001 chars (limit 16,000)"]);
    expect(report.errors.some((e) => e.includes("UTF-8 bytes"))).toBe(false);
  });

  it("VD-03 (NP): flags a multi-byte Vietnamese rule exceeding 24,000 UTF-8 bytes despite <= 16,000 chars", () => {
    const tmpRoot = createTmpRoot();
    const overBytes = GLOB_HEADER + "ệ".repeat(7993);

    expect(overBytes.length).toBe(8015);
    expect(overBytes.length).toBeLessThanOrEqual(RULE_MAX_CHARS);
    expect(Buffer.byteLength(overBytes, "utf8")).toBe(RULE_MAX_BYTES + 1);

    writeFile(tmpRoot, ".agents/rules/vi-bytes.md", overBytes);

    const report = checkGovernanceLimits(tmpRoot);
    expect(report.errors).toEqual([
      ".agents/rules/vi-bytes.md has 24001 UTF-8 bytes (limit 24,000)",
    ]);
    expect(report.errors.some((e) => e.includes("limit 16,000"))).toBe(false);
  });

  it("VD-04 (NP): flags always_on total > 28,000 and scopes always_on detection strictly to YAML frontmatter", () => {
    const tmpRoot = createTmpRoot();
    const alwaysOnRule = ALWAYS_ON_HEADER + "a".repeat(14001 - ALWAYS_ON_HEADER.length);
    writeFile(tmpRoot, ".agents/rules/00-first.md", alwaysOnRule);
    writeFile(tmpRoot, ".agents/rules/01-second.md", alwaysOnRule);

    const overReport = checkGovernanceLimits(tmpRoot);
    expect(overReport.alwaysOnChars).toBe(28002);
    expect(overReport.errors).toContain("always_on rules total 28002 chars (limit 28,000)");

    const globWithBodyExample =
      GLOB_HEADER + "\nExample snippet:\n```yaml\ntrigger: always_on\n```\n" + "b".repeat(13940);
    expect(isAlwaysOnRule(globWithBodyExample)).toBe(false);
    expect(globWithBodyExample.length).toBeLessThanOrEqual(RULE_MAX_CHARS);

    writeFile(tmpRoot, ".agents/rules/01-second.md", globWithBodyExample);
    const scopedReport = checkGovernanceLimits(tmpRoot);
    expect(scopedReport.errors).toEqual([]);
    expect(scopedReport.alwaysOnChars).toBe(14001);
  });

  it("VD-05 (NP): preserves the 10,000-char limit for agent.md files", () => {
    const tmpRoot = createTmpRoot();
    writeFile(tmpRoot, ".agents/agents/sample/agent.md", "z".repeat(AGENT_MAX_CHARS + 1));

    const report = checkGovernanceLimits(tmpRoot);
    expect(report.errors).toEqual([
      ".agents/agents/sample/agent.md has 10001 chars (limit 10,000)",
    ]);
  });

  it("VD-06 (WP): verifies CLI exit codes (0 vs 1) and zero side-effects on dynamic ESM import", () => {
    // (a) Compliant tmpRoot -> exit 0
    const okRoot = createTmpRoot();
    writeFile(okRoot, ".agents/rules/00-core.md", ALWAYS_ON_HEADER + "# Core\n");
    writeFile(okRoot, ".agents/agents/planner/agent.md", "# Planner\n");

    const okRun = spawnSync(process.execPath, [SCRIPT_ABS], {
      cwd: okRoot,
      encoding: "utf8",
    });
    expect(okRun.status).toBe(0);
    expect(okRun.stdout).toContain(
      "PASS: All rules <= 16,000 chars & <= 24,000 UTF-8 bytes, always_on <= 28,000 chars, and all agents <= 10,000 chars."
    );

    // (b) Over-byte tmpRoot -> exit 1
    const failRoot = createTmpRoot();
    writeFile(failRoot, ".agents/rules/vi-bytes.md", GLOB_HEADER + "ệ".repeat(7993));

    const failRun = spawnSync(process.execPath, [SCRIPT_ABS], {
      cwd: failRoot,
      encoding: "utf8",
    });
    expect(failRun.status).toBe(1);
    expect(failRun.stderr).toContain("UTF-8 bytes (limit 24,000)");

    // (c) Dynamic ESM import has zero CLI side-effects
    const importRun = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(pathToFileURL(SCRIPT_ABS).href)})`,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }
    );
    expect(importRun.status).toBe(0);
    expect(importRun.stdout).toBe("");
    expect(importRun.stderr).toBe("");
  });
});
