import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCriticFloor,
  checkLineRefs,
  checkRequiredSections,
  detectCriticTriggers,
  extractLineRefs,
  splitPlanSections,
  verifyPlan,
} from "./verify-plan.mjs";

const SCRIPT_ABS = path.resolve(process.cwd(), "scripts", "verify-plan.mjs");

const VALID_TECH_PLAN = [
  "## Technical Plan",
  "### 1. Mục Tiêu (Goal) & Out of Scope (What We're NOT Doing)",
  "### 2. Skills Loaded & Applied",
  "### 3. Assumptions & Cross-Task Dependencies",
  "- Ref `src/a.ts:1` and `src/a.ts:10`",
  "### 4. Bảng Verified Versions",
  "### 5. Files Cần Chỉnh Sửa / Tạo Mới",
  "- [MODIFY] `src/a.ts`",
  "### 7. Các Bước Thực Hiện Tuần Tự",
  "### 8. Test Contract",
  "### 9. Verification Plan",
].join("\n");

describe("scripts/verify-plan.mjs", () => {
  let tmpRoot = "";

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "verify-plan-"));
    fs.mkdirSync(path.join(tmpRoot, "src", "dir.x"), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, "docs", "plans"), { recursive: true });
    const tenLines =
      Array.from({ length: 10 }, (_, idx) => `export const line${idx + 1} = ${idx + 1};`).join(
        "\n"
      ) + "\n";
    fs.writeFileSync(path.join(tmpRoot, "src", "a.ts"), tenLines, "utf8");
    fs.writeFileSync(path.join(tmpRoot, ".env.local"), "SECRET=1\n", "utf8");
    fs.writeFileSync(
      path.join(tmpRoot, "docs", "plans", "2026-01-01-x.md"),
      `${VALID_TECH_PLAN}\n\n## Audit History\n`,
      "utf8"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("VP-1: returns PASS SECTIONS 7/7 when all 7 required headings are present in Technical Plan", () => {
    const res = checkRequiredSections(VALID_TECH_PLAN);
    expect(res).toEqual([{ level: "PASS", code: "SECTIONS", message: "7/7" }]);
  });

  it("VP-2: returns FAIL MISSING_SECTION when Test Contract is missing from Technical Plan even if present in Audit History", () => {
    const raw = [
      VALID_TECH_PLAN.replace("### 8. Test Contract", "### 8. Other Section"),
      "## Audit History",
      "### Test Contract",
    ].join("\n");
    const { technicalPlan } = splitPlanSections(raw);
    const res = checkRequiredSections(technicalPlan);
    expect(res).toEqual([
      {
        level: "FAIL",
        code: "MISSING_SECTION",
        message: "Missing required heading in Technical Plan: Test Contract",
      },
    ]);
  });

  it("VP-3: returns FAIL MISSING_SECTION when 'Test Contract' appears only as plain paragraph text", () => {
    const raw = VALID_TECH_PLAN.replace(
      "### 8. Test Contract",
      "We have a Test Contract in prose."
    );
    const res = checkRequiredSections(raw);
    expect(res).toEqual([
      {
        level: "FAIL",
        code: "MISSING_SECTION",
        message: "Missing required heading in Technical Plan: Test Contract",
      },
    ]);
  });

  it("VP-4: deduplicates identical file:line references", () => {
    const refs = extractLineRefs("`src/a.ts:3` và src/a.ts:3");
    expect(refs).toEqual([{ path: "src/a.ts", start: 3, end: 3, raw: "src/a.ts:3" }]);
  });

  it("VP-5: normalizes Windows backslashes and expands comma-separated line ranges", () => {
    const refs = extractLineRefs("src\\a.ts:2-4, src/a.ts:1,5-6");
    expect(refs).toEqual([
      { path: "src/a.ts", start: 2, end: 4, raw: "src/a.ts:2-4" },
      { path: "src/a.ts", start: 1, end: 1, raw: "src/a.ts:1" },
      { path: "src/a.ts", start: 5, end: 6, raw: "src/a.ts:5-6" },
    ]);
  });

  it("VP-6: ignores URLs, semver numbers, node: builtins, scenario labels, and timestamps", () => {
    const refs = extractLineRefs("https://x.dev/a.js:12 16.2.1:5 node:fs S1: 10:30");
    expect(refs).toEqual([]);
  });

  it("VP-7: passes valid line 10 and fails line 11 with LINE_OUT_OF_RANGE on a 10-line file", () => {
    const refs = extractLineRefs("src/a.ts:10 src/a.ts:11");
    const findings = checkLineRefs(refs, tmpRoot);
    expect(findings).toEqual([
      { level: "PASS", code: "LINE_REF", message: "src/a.ts:10" },
      { level: "FAIL", code: "LINE_OUT_OF_RANGE", message: "src/a.ts:11 (file has 10 lines)" },
    ]);
  });

  it("VP-8: fails line 0 and inverted range 5-3 with INVALID_RANGE", () => {
    const refs = extractLineRefs("src/a.ts:0 src/a.ts:5-3");
    const findings = checkLineRefs(refs, tmpRoot);
    expect(findings).toEqual([
      { level: "FAIL", code: "INVALID_RANGE", message: "src/a.ts:0" },
      { level: "FAIL", code: "INVALID_RANGE", message: "src/a.ts:5-3" },
    ]);
  });

  it("VP-9: fails missing files with MISSING_FILE and directories with NOT_A_FILE", () => {
    const refs = extractLineRefs("src/missing.ts:1 src/dir.x:1");
    const findings = checkLineRefs(refs, tmpRoot);
    expect(findings).toEqual([
      { level: "FAIL", code: "MISSING_FILE", message: "src/missing.ts:1" },
      { level: "FAIL", code: "NOT_A_FILE", message: "src/dir.x:1" },
    ]);
  });

  it("VP-10: rejects parent traversal with INVALID_PATH without reading outside repo and ignores absolute paths in extractLineRefs", () => {
    const readSpy = vi.spyOn(fs, "readFileSync");
    const traversalRefs = extractLineRefs("../etc/passwd.txt:1 src/../../x.ts:1");
    const findings = checkLineRefs(traversalRefs, tmpRoot);
    expect(findings).toEqual([
      { level: "FAIL", code: "INVALID_PATH", message: "../etc/passwd.txt:1" },
      { level: "FAIL", code: "INVALID_PATH", message: "src/../../x.ts:1" },
    ]);
    expect(readSpy).not.toHaveBeenCalled();

    const absRefs = extractLineRefs("C:/x/a.ts:1 /etc/x.txt:1");
    expect(absRefs).toEqual([]);
  });

  it("VP-11: rejects .env.local:1 with FORBIDDEN_ENV without calling fs.readFileSync", () => {
    const readSpy = vi.spyOn(fs, "readFileSync");
    const refs = extractLineRefs(".env.local:1");
    const findings = checkLineRefs(refs, tmpRoot);
    expect(findings).toEqual([{ level: "FAIL", code: "FORBIDDEN_ENV", message: ".env.local:1" }]);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("VP-12: marks citations to docs/plans/*.md as WARN SELF_CITATION instead of FAIL", () => {
    const refs = extractLineRefs("docs/plans/2026-01-01-x.md:1");
    const findings = checkLineRefs(refs, tmpRoot);
    expect(findings).toEqual([
      {
        level: "WARN",
        code: "SELF_CITATION",
        message: "docs/plans/2026-01-01-x.md:1 (plan text is not evidence)",
      },
    ]);
  });

  it("VP-13: detects Critic triggers for Governance, Database, and Security files only", () => {
    const govPlan = "## Technical Plan\n- [MODIFY] `.agents/rules/05-plan-review.md`\n";
    expect(detectCriticTriggers(govPlan)).toEqual([".agents/rules/05-plan-review.md"]);

    const dbPlan = "## Technical Plan\n- [NEW] `supabase/migrations/1.sql`\n";
    expect(detectCriticTriggers(dbPlan)).toEqual(["supabase/migrations/1.sql"]);

    const uiPlan = "## Technical Plan\n- [MODIFY] `src/components/A.tsx`\n";
    expect(detectCriticTriggers(uiPlan)).toEqual([]);
  });

  it("VP-14: skips Critic Floor check when Audit History has no Audit Run", () => {
    expect(checkCriticFloor("## Audit History\n", tmpRoot)).toEqual([
      { level: "INFO", code: "CRITIC_FLOOR", message: "skipped (no audit run)" },
    ]);
  });

  it("VP-15: passes Critic Floor when the latest Audit Run has >= 3 rows with valid file:line", () => {
    const audit = [
      "## Audit History",
      "### Audit Run 1",
      "#### Critic Findings",
      "| # | Type | Severity | Ref |",
      "| --- | --- | --- | --- |",
      "| 1 | DEFECT | [MINOR] | `src/a.ts:1` |",
      "| 2 | RISK_DISMISSED | [MINOR] | `src/a.ts:2-4` |",
      "| 3 | RISK_DISMISSED | [MINOR] | `src/a.ts:10` |",
    ].join("\n");
    expect(checkCriticFloor(audit, tmpRoot)).toEqual([
      { level: "PASS", code: "CRITIC_FLOOR", message: "3 findings with valid file:line" },
    ]);
  });

  it("VP-16: fails Critic Floor when 1 of 3 rows only cites docs/plans/ or when the latest run omits Critic Findings", () => {
    const selfCitedAudit = [
      "## Audit History",
      "### Audit Run 1",
      "#### Critic Findings",
      "| # | Ref |",
      "| --- | --- |",
      "| 1 | `src/a.ts:1` |",
      "| 2 | `src/a.ts:2` |",
      "| 3 | `docs/plans/2026-01-01-x.md:1` |",
    ].join("\n");
    expect(checkCriticFloor(selfCitedAudit, tmpRoot)).toEqual([
      {
        level: "FAIL",
        code: "CRITIC_FLOOR",
        message: "Expected >= 3 critic findings with valid file:line, found 2",
      },
    ]);

    const multiRunAudit = [
      "## Audit History",
      "### Audit Run 1",
      "#### Critic Findings",
      "| # | Ref |",
      "| --- | --- |",
      "| 1 | `src/a.ts:1` |",
      "| 2 | `src/a.ts:2` |",
      "| 3 | `src/a.ts:3` |",
      "### Audit Run 2",
      "Approved with 0 findings.",
    ].join("\n");
    expect(checkCriticFloor(multiRunAudit, tmpRoot)).toEqual([
      {
        level: "FAIL",
        code: "CRITIC_FLOOR",
        message: "Latest Audit Run is missing #### Critic Findings section",
      },
    ]);
  });

  it("VP-17: CLI exits 0 and prints VERIFY_PLAN: PASS on a valid plan", () => {
    const res = spawnSync(process.execPath, [SCRIPT_ABS, "docs/plans/2026-01-01-x.md"], {
      cwd: tmpRoot,
      encoding: "utf8",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("[PASS] SECTIONS 7/7");
    expect(res.stdout).toContain("VERIFY_PLAN: PASS (0 failures, 0 warnings)");
  });

  it("VP-18: CLI exits 1 and prints VERIFY_PLAN: FAIL when a plan contains an out-of-range line ref", () => {
    const badPlan = `${VALID_TECH_PLAN}\n- Bad ref \`src/a.ts:99\`\n`;
    fs.writeFileSync(path.join(tmpRoot, "docs", "plans", "2026-01-01-x.md"), badPlan, "utf8");

    const res = spawnSync(process.execPath, [SCRIPT_ABS, "docs/plans/2026-01-01-x.md"], {
      cwd: tmpRoot,
      encoding: "utf8",
    });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain("[FAIL] LINE_OUT_OF_RANGE src/a.ts:99 (file has 10 lines)");
    expect(res.stdout).toContain("VERIFY_PLAN: FAIL (1 failures, 0 warnings)");
  });

  it("VP-19: CLI exits 2 with stderr message on missing args, traversal, non-plan path, or missing file", () => {
    const noArgs = spawnSync(process.execPath, [SCRIPT_ABS], { cwd: tmpRoot, encoding: "utf8" });
    expect(noArgs.status).toBe(2);
    expect(noArgs.stderr).toContain("Usage:");

    for (const badArg of ["docs/plans/../x.md", "src/a.md", "docs/plans/missing.md"]) {
      const r = spawnSync(process.execPath, [SCRIPT_ABS, badArg], {
        cwd: tmpRoot,
        encoding: "utf8",
      });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("[FAIL] USAGE_ERROR");
    }

    expect(verifyPlan("docs/plans/README.md", tmpRoot).exitCode).toBe(2);
  });
});
