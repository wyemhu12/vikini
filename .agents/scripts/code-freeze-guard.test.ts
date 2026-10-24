import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import {
  decide,
  extractInput,
  toRepoRelative,
  isAntigravityArtifact,
  isTestFile,
  assessTestIntegrity,
  ARTIFACT_ROOT,
  REPO_ROOT,
  TEST_INFRA_FILES,
  isPlanApproved,
  hasApprovedPlanHeader,
  hasCompletedPlanHeader,
  hasApprovedPlanFooter,
  evaluatePlanApprovalContent,
  isSelfForgedPlanWrite,
  evaluateLatestDateGroupPlans,
  formatHookOutput,
  countLines,
  isFastTrackEligible,
  FAST_TRACK_MAX_LINES,
} from "./code-freeze-guard.js";

describe("toRepoRelative", () => {
  it("normalises a relative POSIX path", () => {
    expect(toRepoRelative("docs/plans/task.md")).toBe("docs/plans/task.md");
  });

  it("normalises a Windows-style path", () => {
    const sep = String.fromCharCode(92);
    const windowsPath = [".", "docs", "plans", "task.md"].join(sep);
    expect(toRepoRelative(windowsPath)).toBe("docs/plans/task.md");
  });

  it("returns null for a path escaping the repository", () => {
    expect(toRepoRelative("../../etc/passwd")).toBeNull();
  });

  it("returns null for non-string inputs", () => {
    // @ts-expect-error test invalid runtime inputs
    expect(toRepoRelative(undefined)).toBeNull();
    // @ts-expect-error test invalid runtime inputs
    expect(toRepoRelative(null)).toBeNull();
  });
});

describe("isAntigravityArtifact", () => {
  it("allows valid absolute path in ARTIFACT_ROOT", () => {
    const validPlan = path.resolve(ARTIFACT_ROOT, "test-conv-123", "implementation_plan.md");
    expect(isAntigravityArtifact(validPlan)).toBe(true);
  });

  it("allows valid json artifact in ARTIFACT_ROOT", () => {
    const validJson = path.resolve(ARTIFACT_ROOT, "test-conv-123", "metadata.json");
    expect(isAntigravityArtifact(validJson)).toBe(true);
  });

  it("allows valid scratch file with safe extension in ARTIFACT_ROOT", () => {
    const validScratch = path.resolve(ARTIFACT_ROOT, "test-conv-123", "scratch", "test.sql");
    expect(isAntigravityArtifact(validScratch)).toBe(true);
  });

  it("rejects relative path pointing to artifact (cwd ambiguity)", () => {
    expect(isAntigravityArtifact("../../.gemini/antigravity/brain/test/plan.md")).toBe(false);
  });

  it("rejects path traversal escaping back into the repository", () => {
    const traversal = path.resolve(
      ARTIFACT_ROOT,
      "x",
      "..",
      "..",
      "..",
      "..",
      "vikini",
      "package.json"
    );
    expect(isAntigravityArtifact(traversal)).toBe(false);
  });

  it("rejects spoofed artifact located inside the repository", () => {
    expect(isAntigravityArtifact("src/.gemini/antigravity/brain/evil.json")).toBe(false);
  });

  it("rejects dangerous executable files in scratch directory", () => {
    const dangerousScratch = path.resolve(ARTIFACT_ROOT, "test-conv-123", "scratch", "exploit.bat");
    expect(isAntigravityArtifact(dangerousScratch)).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isAntigravityArtifact(undefined)).toBe(false);
  });
});

describe("Priority Ordering: Test Infrastructure Guard (N2)", () => {
  it("identifies tests/setup.ts as Test Infrastructure Guard rather than Test Integrity Guard", () => {
    const decision = decide({ targetFile: "tests/setup.ts" });
    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain(
      "Test Infrastructure Guard: this edit changes test configuration"
    );
    expect(decision.reason).not.toContain("Test Integrity Guard");
  });

  it("identifies all TEST_INFRA_FILES as Test Infrastructure Guard", () => {
    for (const file of TEST_INFRA_FILES) {
      const decision = decide({ targetFile: file });
      expect(decision.decision, file).toBe("ask");
      expect(decision.reason, file).toContain(
        "Test Infrastructure Guard: this edit changes test configuration"
      );
    }
  });
});

describe("decide — write targets", () => {
  it("allows writes to the plan directory", () => {
    expect(decide({ targetFile: "docs/plans/2026-09-20-x.md" }).decision).toBe("allow");
  });

  it("allows root planning artifacts", () => {
    expect(decide({ targetFile: "implementation_plan.md" }).decision).toBe("allow");
  });

  it("allows valid Antigravity artifacts outside the repository", () => {
    const validPlan = path.resolve(ARTIFACT_ROOT, "test-conv-123", "implementation_plan.md");
    expect(decide({ targetFile: validPlan }).decision).toBe("allow");
  });

  it("asks for paths outside the repository that are not valid artifacts", () => {
    expect(decide({ targetFile: "../../evil.ts" }).decision).toBe("ask");
  });

  it("asks before an agent rewrites its own governance files", () => {
    const decision = decide({ targetFile: ".agents/rules/00-core.md" });
    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain(
      "Code Freeze Guard: write targets a governance file in .agents/."
    );
  });

  it("closes the substring bypass on nested docs directories", () => {
    expect(
      decide({ targetFile: "src/features/docs/secret.ts" }, { planApproved: false }).decision
    ).toBe("ask");
  });

  it("closes the substring bypass on artifact-named source files", () => {
    expect(decide({ targetFile: "src/lib/task.md" }, { planApproved: false }).decision).toBe("ask");
  });
});

describe("decide — Scoped Protection (Option 2)", () => {
  describe("when plan is NOT approved (planApproved: false)", () => {
    it("asks before writing UI components", () => {
      const decision = decide({ targetFile: "src/components/Header.tsx" }, { planApproved: false });
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain("Code Freeze Guard: write targets a frozen path");
    });

    it("asks before writing feature logic", () => {
      const decision = decide(
        { targetFile: "src/lib/features/chat/conversationCRUD.ts" },
        { planApproved: false }
      );
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain("Code Freeze Guard: write targets a frozen path");
    });

    it("asks before writing sensitive server files (*.server.ts)", () => {
      const decision = decide(
        { targetFile: "src/lib/core/supabase.server.ts" },
        { planApproved: false }
      );
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain(
        "Scoped Protection Guard: write targets a sensitive server file (*.server.ts)"
      );
    });

    it("asks before writing database migrations", () => {
      const decision = decide(
        { targetFile: "supabase/migrations/20260927000000_init.sql" },
        { planApproved: false }
      );
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain(
        "Scoped Protection Guard: write targets a database migration file"
      );
    });
  });

  describe("when plan IS approved (planApproved: true)", () => {
    it("allows writes to UI components and app pages", () => {
      expect(
        decide({ targetFile: "src/components/Header.tsx" }, { planApproved: true }).decision
      ).toBe("allow");
      expect(decide({ targetFile: "src/app/page.tsx" }, { planApproved: true }).decision).toBe(
        "allow"
      );
      expect(
        decide({ targetFile: "src/app/features/chat/ChatView.tsx" }, { planApproved: true })
          .decision
      ).toBe("allow");
    });

    it("allows writes to general feature business logic", () => {
      expect(
        decide({ targetFile: "src/lib/features/chat/conversationCRUD.ts" }, { planApproved: true })
          .decision
      ).toBe("allow");
    });

    it("still asks before writing sensitive server files (*.server.ts)", () => {
      const decision = decide(
        { targetFile: "src/lib/core/supabase.server.ts" },
        { planApproved: true }
      );
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain(
        "Scoped Protection Guard: write targets a sensitive server file (*.server.ts)"
      );
    });

    it("still asks before writing database migration files", () => {
      const decision = decide(
        { targetFile: "supabase/migrations/20260927000000_init.sql" },
        { planApproved: true }
      );
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain(
        "Scoped Protection Guard: write targets a database migration file"
      );
    });

    it("still asks before writing test infrastructure files", () => {
      const decision = decide({ targetFile: "vitest.config.ts" }, { planApproved: true });
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain(
        "Test Infrastructure Guard: this edit changes test configuration"
      );
    });

    it("still asks before modifying test files (Test Integrity Guard)", () => {
      const decision = decide(
        { targetFile: "src/components/Header.test.tsx" },
        { planApproved: true }
      );
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain("Test Integrity Guard: this edit modifies a TEST file");
    });

    it("still asks before modifying agent governance files", () => {
      const decision = decide({ targetFile: ".agents/rules/01-coding.md" }, { planApproved: true });
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain(
        "Code Freeze Guard: write targets a governance file in .agents/."
      );
    });
  });
});

describe("decide — run_command", () => {
  it("allows read-only verification commands for Vikini", () => {
    for (const command of [
      "npm run type-check",
      "npm run lint",
      "npm run test:run",
      "npm run verify",
      "npx tsc --noEmit",
      "npx tsc --showConfig",
      "git status",
      "git diff",
      "git log -n 5",
    ]) {
      expect(decide({ command }).decision, command).toBe("allow");
    }
  });

  it("allows Claude CLI and run-claude script execution", () => {
    for (const command of [
      "powershell.exe -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1",
      "powershell -File .agents/scripts/run-claude.ps1 -PlanFile docs/plans/task.md",
      "powershell -ExecutionPolicy Bypass -File .agents\\scripts\\run-claude.ps1 -CheckOnly",
      "claude -p ping",
      "claude.exe --version",
    ]) {
      expect(decide({ command }).decision, command).toBe("allow");
    }
  });

  it("allows scoped Vitest runs with path arguments only", () => {
    for (const command of [
      "npx vitest run",
      "npx vitest run src/lib/utils.test.ts",
      "npx vitest run .agents/scripts/code-freeze-guard.test.ts",
      "npx vitest list --filesOnly",
    ]) {
      expect(decide({ command }).decision, command).toBe("allow");
    }
  });

  it("allows the stdout-only --reporter flag and test:run with path arguments", () => {
    for (const command of [
      "npx vitest run --reporter=verbose src/components/",
      "npx vitest run src/a.test.ts --reporter=dot",
      "npm run test:run -- src/lib/utils.test.ts",
      "npm run test:run -- --reporter=verbose src/components/",
    ]) {
      expect(decide({ command }).decision, command).toBe("allow");
    }
  });

  it("asks when test:run forwards a file-writing or snapshot flag", () => {
    for (const command of [
      "npm run test:run -- -u",
      "npm run test:run -- --coverage",
      "npx vitest run --reporter=json --outputFile=src/proxy.ts",
      "npm run test:run --",
    ]) {
      expect(decide({ command }).decision, command).toBe("ask");
    }
  });

  it("allows a semicolon chain when every segment is read-only (PowerShell 5.1 gate order)", () => {
    for (const command of [
      "npm run type-check; npm run lint; npm run test:run",
      "npx vitest run src/a.test.ts; git status",
    ]) {
      expect(decide({ command }).decision, command).toBe("allow");
    }
  });

  it("asks when any segment of a semicolon chain is not read-only", () => {
    for (const command of [
      "npm run lint; rm -rf src",
      "npm run lint --fix; npm run test:run",
      "npm run test:run; npx vitest run -u",
      ";",
    ]) {
      expect(decide({ command }).decision, command).toBe("ask");
    }
  });

  it("asks when a Vitest run carries an unapproved flag", () => {
    for (const command of [
      "npx vitest run -u",
      "npx vitest run --update",
      "npx vitest run src/a.test.ts --coverage",
      "npx vitest watch",
    ]) {
      expect(decide({ command }).decision, command).toBe("ask");
    }
  });

  it("asks when a mutating flag is present", () => {
    expect(decide({ command: "npm run lint --fix" }).decision).toBe("ask");
  });

  it("asks when a git read command writes its output to a file", () => {
    for (const command of [
      "git diff --output=src/proxy.ts",
      "git log --output src/proxy.ts",
      "git show HEAD --output=src/lib/core/db.ts",
    ]) {
      expect(decide({ command }).decision, command).toBe("ask");
    }
  });

  it("asks when output is redirected to a file", () => {
    expect(decide({ command: "npm run type-check > out.txt" }).decision).toBe("ask");
  });

  it("asks when commands are chained with &&", () => {
    expect(decide({ command: "npm run lint && rm -rf src" }).decision).toBe("ask");
  });

  it("asks for commands outside the allowlist", () => {
    for (const command of ["npm install zod", 'node -e "1"', "git commit -m x", "npm run build"]) {
      expect(decide({ command }).decision, command).toBe("ask");
    }
  });
});

describe("decide — fail-closed defaults", () => {
  it("asks when the payload carries no recognisable target", () => {
    expect(decide({}).decision).toBe("ask");
  });
});

describe("extractInput", () => {
  it("reads the Antigravity payload shape", () => {
    const input = extractInput({
      toolCall: { name: "write_to_file", args: { TargetFile: "src/a.ts" } },
    });
    expect(input).toMatchObject({ toolName: "write_to_file", targetFile: "src/a.ts" });
  });

  it("reads the alternate tool_input payload shape", () => {
    const input = extractInput({
      tool_name: "run_command",
      tool_input: { command: "npm run lint" },
    });
    expect(input).toMatchObject({ toolName: "run_command", command: "npm run lint" });
  });

  it("tolerates a null payload", () => {
    expect(extractInput(null)).toEqual({
      toolName: undefined,
      targetFile: undefined,
      command: undefined,
      newContent: undefined,
      oldContent: undefined,
    });
  });

  it("extracts CodeContent, TargetContent and ReplacementContent from payload", () => {
    const writePayload = {
      toolCall: {
        name: "write_to_file",
        args: {
          TargetFile: "src/sample.test.ts",
          CodeContent: "expect(1).toBe(1);",
        },
      },
    };
    expect(extractInput(writePayload)).toMatchObject({
      toolName: "write_to_file",
      targetFile: "src/sample.test.ts",
      newContent: "expect(1).toBe(1);",
    });

    const replacePayload = {
      toolCall: {
        name: "replace_file_content",
        args: {
          TargetFile: "src/sample.test.ts",
          TargetContent: "expect(1).toBe(1); expect(2).toBe(2);",
          ReplacementContent: "expect(1).toBe(1);",
        },
      },
    };
    expect(extractInput(replacePayload)).toMatchObject({
      toolName: "replace_file_content",
      targetFile: "src/sample.test.ts",
      oldContent: "expect(1).toBe(1); expect(2).toBe(2);",
      newContent: "expect(1).toBe(1);",
    });
  });

  it("extracts content from ReplacementChunks array", () => {
    const chunkPayload = {
      toolCall: {
        name: "replace_file_content",
        args: {
          TargetFile: "src/sample.test.ts",
          ReplacementChunks: [
            { TargetContent: "it('a', () => {});", ReplacementContent: "it('b', () => {});" },
          ],
        },
      },
    };
    expect(extractInput(chunkPayload)).toMatchObject({
      toolName: "replace_file_content",
      targetFile: "src/sample.test.ts",
      oldContent: "it('a', () => {});",
      newContent: "it('b', () => {});",
    });
  });

  it("does not read disk when tool is not write_to_file", () => {
    const payload = {
      toolCall: {
        name: "replace_file_content",
        args: {
          TargetFile: "package.json",
        },
      },
    };
    const input = extractInput(payload);
    expect(input.oldContent).toBeUndefined();
  });
});

describe("isTestFile", () => {
  it("identifies test files correctly", () => {
    expect(isTestFile("src/lib/core/db.test.ts")).toBe(true);
    expect(isTestFile("src/components/admin/BlacklistCard.test.tsx")).toBe(true);
    expect(isTestFile("src/__tests__/utils.ts")).toBe(true);
    expect(isTestFile("__tests__/integration.ts")).toBe(true);
    expect(isTestFile("tests/unit.test.ts")).toBe(true);
  });

  it("rejects non-test files", () => {
    expect(isTestFile("src/lib/testing-utils.ts")).toBe(false);
    expect(isTestFile("docs/test.md")).toBe(false);
    expect(isTestFile("src/app/(dashboard)/settings/page.tsx")).toBe(false);
    expect(isTestFile(null)).toBe(false);
    expect(isTestFile(undefined)).toBe(false);
  });
});

describe("assessTestIntegrity", () => {
  it("detects reduced expect count", () => {
    const oldCode = "expect(a).toBe(1); expect(b).toBe(2); expect(c).toBe(3);";
    const newCode = "expect(a).toBe(1);";
    const signals = assessTestIntegrity(oldCode, newCode);
    expect(signals).toContain("2 fewer expect() calls");
  });

  it("detects disabled or focused test additions", () => {
    const oldCode = "it('test', () => {});";
    const newCode = "it.skip('test', () => {});";
    const signals = assessTestIntegrity(oldCode, newCode);
    expect(signals).toContain("adds .skip");
  });

  it("detects conditional and inverted test additions", () => {
    const oldCode = "it('test', () => {});";
    expect(assessTestIntegrity(oldCode, "it.skipIf(ci)('test', () => {});")).toContain(
      "adds .skipIf/.runIf"
    );
    expect(assessTestIntegrity(oldCode, "it.runIf(false)('test', () => {});")).toContain(
      "adds .skipIf/.runIf"
    );
    expect(assessTestIntegrity(oldCode, "it.fails('test', () => {});")).toContain("adds .fails");
  });

  it('does not flag English words like "only" in test descriptions', () => {
    const oldCode = "it('admins can view', () => {});";
    const newCode = "it('only admins can view', () => {});";
    const signals = assessTestIntegrity(oldCode, newCode);
    expect(signals).toEqual([]);
  });

  it('does not flag English words like "fit" in test descriptions', () => {
    const oldCode = "it('should display nicely', () => {});";
    const newCode = "it('should fit on screen', () => {});";
    const signals = assessTestIntegrity(oldCode, newCode);
    expect(signals).toEqual([]);
  });

  it("detects relaxed matcher strength", () => {
    const oldCode = "expect(res).toEqual({ status: 200 });";
    const newCode = "expect(res).toBeDefined();";
    const signals = assessTestIntegrity(oldCode, newCode);
    expect(signals).toContain("relaxes matcher strength");
  });

  it("detects try/catch block addition", () => {
    const oldCode = "expect(fn()).toBe(true);";
    const newCode = "try { expect(fn()).toBe(true); } catch {}";
    const signals = assessTestIntegrity(oldCode, newCode);
    expect(signals).toContain("adds try/catch block");
  });

  it("does not flag type B test infrastructure fixes (e.g. updating mocks without weakening assertions)", () => {
    const oldCode = 'vi.mock("@/old"); expect(fetchData()).toEqual({ data: 1 });';
    const newCode = 'vi.mock("@/new"); expect(fetchData()).toEqual({ data: 1 });';
    const signals = assessTestIntegrity(oldCode, newCode);
    expect(signals).toEqual([]);
  });

  it("returns unavailable when one or both sides are missing to prevent asymmetric comparison", () => {
    expect(assessTestIntegrity(undefined, undefined)).toEqual([
      "unavailable (payload carried partial or missing content)",
    ]);
    expect(assessTestIntegrity("expect(1).toBe(1);", undefined)).toEqual([
      "unavailable (payload carried partial or missing content)",
    ]);
    expect(assessTestIntegrity(undefined, "expect(1).toBe(1);")).toEqual([
      "unavailable (payload carried partial or missing content)",
    ]);
  });
});

describe("decide — test files (Test Integrity Guard)", () => {
  it("always asks for test files and outputs Test Integrity Guard header", () => {
    const decision = decide({
      targetFile: "src/lib/core/auth.test.ts",
      oldContent: "expect(a).toBe(1); expect(b).toBe(2);",
      newContent: 'it.skip("a", () => {});',
    });

    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain("Test Integrity Guard: this edit modifies a TEST file");
    expect(decision.reason).toContain("Signals: 2 fewer expect() calls; adds .skip");
    expect(decision.reason).toContain("Path: src/lib/core/auth.test.ts");
  });

  it("indicates unavailable when payload has no content for test files", () => {
    const decision = decide({
      targetFile: "src/lib/core/auth.test.ts",
    });

    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain("Test Integrity Guard: this edit modifies a TEST file");
  });
});

describe("isPlanApproved", () => {
  it("returns a boolean based on governance marker or latest plan check", () => {
    const approved = isPlanApproved();
    expect(typeof approved).toBe("boolean");
  });
});

const makeLines = (n: number): string =>
  Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

const makeFastTrackEdit = (
  targetFile: string,
  oldLines = 5,
  newLines = 5,
  toolName: string | undefined = "replace_file_content"
) => ({
  toolName,
  targetFile,
  oldContent: makeLines(oldLines),
  newContent: makeLines(newLines),
});

describe("countLines", () => {
  it("counts a single line without newline (FT-C1)", () => {
    expect(countLines("a")).toBe(1);
  });

  it("counts exact 40-line boundary (FT-C2)", () => {
    expect(FAST_TRACK_MAX_LINES).toBe(40);
    expect(countLines(makeLines(40))).toBe(40);
  });

  it("splits CRLF line endings accurately (FT-C3)", () => {
    expect(countLines("a\r\nb\r\nc")).toBe(3);
  });

  it("counts trailing newline conservatively as an extra line (FT-C4)", () => {
    expect(countLines("a\n")).toBe(2);
  });
});

describe("isFastTrackEligible", () => {
  it("returns true for eligible UI, translation, and style paths within 40 lines", () => {
    expect(
      isFastTrackEligible(
        "src/lib/utils/translations/vi.ts",
        makeFastTrackEdit("src/lib/utils/translations/vi.ts")
      )
    ).toBe(true);
    expect(
      isFastTrackEligible(
        "src/app/styles/themes/focus/amber.css",
        makeFastTrackEdit("src/app/styles/themes/focus/amber.css")
      )
    ).toBe(true);
    expect(
      isFastTrackEligible(
        "src/app/features/chat/components/ChatBubble.tsx",
        makeFastTrackEdit("src/app/features/chat/components/ChatBubble.tsx", 40, 40)
      )
    ).toBe(true);
  });

  it("returns false for test, spec, and server .tsx files as defence in depth (FT-N18)", () => {
    expect(
      isFastTrackEligible(
        "src/app/features/x/A.test.tsx",
        makeFastTrackEdit("src/app/features/x/A.test.tsx")
      )
    ).toBe(false);
    expect(
      isFastTrackEligible(
        "src/app/features/x/A.spec.tsx",
        makeFastTrackEdit("src/app/features/x/A.spec.tsx")
      )
    ).toBe(false);
    expect(
      isFastTrackEligible(
        "src/app/features/x/A.server.tsx",
        makeFastTrackEdit("src/app/features/x/A.server.tsx")
      )
    ).toBe(false);
    expect(
      isFastTrackEligible("src/app/api/x/page.tsx", makeFastTrackEdit("src/app/api/x/page.tsx"))
    ).toBe(false);
  });
});

describe("decide — Fast-Track Mode", () => {
  it("allows replace_file_content <= 40 lines on vi.ts and en.ts without plan approval (FT-H1, FT-H2)", () => {
    const viDecision = decide(makeFastTrackEdit("src/lib/utils/translations/vi.ts", 5, 5), {
      planApproved: false,
    });
    expect(viDecision.decision).toBe("allow");
    expect(viDecision.reason).toContain("Fast-Track Mode");

    const enDecision = decide(makeFastTrackEdit("src/lib/utils/translations/en.ts", 5, 5), {
      planApproved: false,
    });
    expect(enDecision.decision).toBe("allow");
    expect(enDecision.reason).toContain("Fast-Track Mode");
  });

  it("allows replace_file_content <= 40 lines on src/app/styles/**/*.css (FT-H3)", () => {
    const decision = decide(makeFastTrackEdit("src/app/styles/themes/focus/amber.css", 5, 5), {
      planApproved: false,
    });
    expect(decision.decision).toBe("allow");
    expect(decision.reason).toContain("Fast-Track Mode");
  });

  it("allows exact 40-line upper boundary on src/app/**/*.tsx and src/components/**/*.tsx (FT-H4, FT-H5)", () => {
    const appDecision = decide(
      makeFastTrackEdit("src/app/features/chat/components/ChatBubble.tsx", 40, 40),
      { planApproved: false }
    );
    expect(appDecision.decision).toBe("allow");
    expect(appDecision.reason).toContain("Fast-Track Mode");

    const compDecision = decide(makeFastTrackEdit("src/components/ui/button.tsx", 1, 3), {
      planApproved: false,
    });
    expect(compDecision.decision).toBe("allow");
    expect(compDecision.reason).toContain("Fast-Track Mode");
  });

  it("normalises Windows backslash paths for Fast-Track edits (FT-H6)", () => {
    const winPath = ["src", "app", "features", "chat", "components", "ChatBubble.tsx"].join("\\");
    const decision = decide(makeFastTrackEdit(winPath, 5, 5), { planApproved: false });
    expect(decision.decision).toBe("allow");
    expect(decision.reason).toContain("Fast-Track Mode");
  });

  it("allows multi-chunk replace_file_content payload when combined lines <= 40 (FT-H7)", () => {
    const input = extractInput({
      toolCall: {
        name: "replace_file_content",
        args: {
          TargetFile: "src/app/features/chat/components/ChatBubble.tsx",
          ReplacementChunks: [
            { TargetContent: makeLines(20), ReplacementContent: makeLines(20) },
            { TargetContent: makeLines(20), ReplacementContent: makeLines(20) },
          ],
        },
      },
    });
    const decision = decide(input, { planApproved: false });
    expect(decision.decision).toBe("allow");
    expect(decision.reason).toContain("Fast-Track Mode");
  });

  it("rejects write_to_file, missing toolName, or non-exact toolName on Fast-Track paths (FT-N1, FT-N2, FT-N3)", () => {
    const targets = [
      "src/lib/utils/translations/vi.ts",
      "src/app/styles/themes/focus/amber.css",
      "src/app/features/chat/components/ChatBubble.tsx",
      "src/components/ui/button.tsx",
    ];
    for (const target of targets) {
      const writeDecision = decide(makeFastTrackEdit(target, 5, 5, "write_to_file"), {
        planApproved: false,
      });
      expect(writeDecision.decision).toBe("ask");
      expect(writeDecision.reason).toContain("write targets a frozen path");
    }

    const noToolDecision = decide(
      {
        targetFile: "src/app/features/chat/components/ChatBubble.tsx",
        oldContent: makeLines(5),
        newContent: makeLines(5),
      },
      { planApproved: false }
    );
    expect(noToolDecision.decision).toBe("ask");
    expect(noToolDecision.reason).toContain("write targets a frozen path");

    const multiToolDecision = decide(
      makeFastTrackEdit(
        "src/app/features/chat/components/ChatBubble.tsx",
        5,
        5,
        "multi_replace_file_content"
      ),
      { planApproved: false }
    );
    expect(multiToolDecision.decision).toBe("ask");
    expect(multiToolDecision.reason).toContain("write targets a frozen path");
  });

  it("rejects edits exceeding 40 lines on oldContent, newContent, or combined chunks (FT-N4, FT-N5, FT-N6)", () => {
    const old41 = decide(
      makeFastTrackEdit("src/app/features/chat/components/ChatBubble.tsx", 41, 5),
      { planApproved: false }
    );
    expect(old41.decision).toBe("ask");
    expect(old41.reason).toContain("write targets a frozen path");

    const new41 = decide(
      makeFastTrackEdit("src/app/features/chat/components/ChatBubble.tsx", 5, 41),
      { planApproved: false }
    );
    expect(new41.decision).toBe("ask");
    expect(new41.reason).toContain("write targets a frozen path");

    const multi42 = extractInput({
      toolCall: {
        name: "replace_file_content",
        args: {
          TargetFile: "src/app/features/chat/components/ChatBubble.tsx",
          ReplacementChunks: [
            { TargetContent: makeLines(21), ReplacementContent: makeLines(21) },
            { TargetContent: makeLines(21), ReplacementContent: makeLines(21) },
          ],
        },
      },
    });
    const multiDecision = decide(multi42, { planApproved: false });
    expect(multiDecision.decision).toBe("ask");
    expect(multiDecision.reason).toContain("write targets a frozen path");
  });

  it("rejects missing or empty oldContent / newContent (FT-N7)", () => {
    const file = "src/app/features/chat/components/ChatBubble.tsx";
    for (const payload of [
      { toolName: "replace_file_content", targetFile: file, newContent: "a" },
      { toolName: "replace_file_content", targetFile: file, oldContent: "a" },
      { toolName: "replace_file_content", targetFile: file, oldContent: "", newContent: "a" },
      { toolName: "replace_file_content", targetFile: file, oldContent: "a", newContent: "" },
    ]) {
      const decision = decide(payload, { planApproved: false });
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain("write targets a frozen path");
    }
  });

  it("rejects API routes, business logic, path traversal, translations/index.ts, and globals.css (FT-N8, FT-N9, FT-N10, FT-N14, FT-N15, FT-N16)", () => {
    const frozenPaths = [
      "src/app/api/chat-stream/route.ts",
      "src/app/api/foo/page.tsx",
      "src/lib/features/chat/conversations.ts",
      "src/lib/core/genaiClient.ts",
      "src/app/../lib/core/x.tsx",
      "src/lib/utils/translations/index.ts",
      "src/app/globals.css",
    ];
    for (const target of frozenPaths) {
      const decision = decide(makeFastTrackEdit(target, 5, 5), { planApproved: false });
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain("write targets a frozen path");
    }
  });

  it("keeps Scoped Protection gates ahead of Fast-Track for server, test, and governance files (FT-N11, FT-N12, FT-N13)", () => {
    for (const serverFile of [
      "src/lib/core/supabase.server.ts",
      "src/app/features/x/Panel.server.tsx",
    ]) {
      const decision = decide(makeFastTrackEdit(serverFile, 5, 5), { planApproved: false });
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain("sensitive server file (*.server.ts)");
    }

    const testDecision = decide(
      makeFastTrackEdit("src/app/features/chat/components/ChatBubble.test.tsx", 5, 5),
      { planApproved: false }
    );
    expect(testDecision.decision).toBe("ask");
    expect(testDecision.reason).toContain("Test Integrity Guard");

    const govDecision = decide(makeFastTrackEdit(".agents/rules/00-core.md", 5, 5), {
      planApproved: false,
    });
    expect(govDecision.decision).toBe("ask");
    expect(govDecision.reason).toContain("governance file in .agents/");
  });

  it("rejects Fast-Track edits introducing use server, process.env, or .server imports (FT-N17)", () => {
    const file = "src/app/features/chat/components/ChatBubble.tsx";
    const forbiddenSnippets = [
      '"use server";\nexport async function act() {}',
      "const secret = process.env.SECRET;",
      'import { db } from "@/lib/core/supabase.server";',
    ];
    for (const snippet of forbiddenSnippets) {
      const decision = decide(
        {
          toolName: "replace_file_content",
          targetFile: file,
          oldContent: "const a = 1;",
          newContent: snippet,
        },
        { planApproved: false }
      );
      expect(decision.decision).toBe("ask");
      expect(decision.reason).toContain("write targets a frozen path");
    }
  });

  it("preserves existing planApproved behaviour for > 40 line UI edits and migration files (FT-R2, FT-R3)", () => {
    const largeUiAllowed = decide(
      makeFastTrackEdit("src/app/features/chat/components/ChatBubble.tsx", 41, 41),
      { planApproved: true }
    );
    expect(largeUiAllowed.decision).toBe("allow");
    expect(largeUiAllowed.reason).toBeUndefined();

    const migrationAsked = decide(makeFastTrackEdit("supabase/migrations/x.sql", 5, 5), {
      planApproved: true,
    });
    expect(migrationAsked.decision).toBe("ask");
    expect(migrationAsked.reason).toContain("database migration");
  });
});

describe("decide — Dual-Planner & Dual-Reviewer workflow (SW-G1..SW-G8)", () => {
  it("allows Primary Planner invocation via run-claude.ps1 -Role planner with -PlanFile and -Task (SW-G1)", () => {
    expect(
      decide({
        command:
          'powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md -Task "Draft plan"',
      }).decision
    ).toBe("allow");
  });

  it("allows Fallback Reviewer invocation via run-claude.ps1 -Role reviewer with -NoProfile (SW-G2)", () => {
    expect(
      decide({
        command:
          "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md",
      }).decision
    ).toBe("allow");
  });

  it("allows -Mode plan, -Prompt, -ArtifactFile aliases and quoted script path (SW-G3)", () => {
    expect(
      decide({
        command:
          'powershell -ExecutionPolicy Bypass -File ".agents/scripts/run-claude.ps1" -Mode plan -PlanFile docs/plans/task.md -Prompt "Revise plan" -ArtifactFile C:/Users/wyemh/.gemini/antigravity/brain/conv/implementation_plan.md',
      }).decision
    ).toBe("allow");
  });

  it("asks when run-claude.ps1 is chained with && and a mutating command (SW-G4)", () => {
    const decision = decide({
      command:
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner && rm -rf src",
    });
    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain("redirection, chaining or a mutating flag");
  });

  it("asks when run-claude.ps1 is chained with ; and a non-allowlisted command (SW-G5)", () => {
    const decision = decide({
      command:
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer; rm -rf src",
    });
    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain("segment outside the read-only ALLOWLIST");
  });

  it("asks when run-claude.ps1 output is redirected to a file (SW-G6)", () => {
    const decision = decide({
      command:
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner > src/evil.ts",
    });
    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain("redirection, chaining or a mutating flag");
  });

  it("asks when run-claude.ps1 includes a mutating flag such as --fix (SW-G7)", () => {
    const decision = decide({
      command:
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner --fix",
    });
    expect(decision.decision).toBe("ask");
    expect(decision.reason).toContain("redirection, chaining or a mutating flag");
  });

  it("allows @reviewer replace_file_content updates on docs/plans/*.md while repo is frozen (SW-G8)", () => {
    const decision = decide(
      {
        targetFile: "docs/plans/2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md",
        toolName: "replace_file_content",
        oldContent: "- **Status**: Ready for Review",
        newContent: "- **Status**: Approved",
      },
      { planApproved: false }
    );
    expect(decision.decision).toBe("allow");
  });
});

describe("Governance 2.0 Remake — TC-01..TC-08", () => {
  describe("TC-01: hasApprovedPlanHeader, hasApprovedPlanFooter, evaluatePlanApprovalContent", () => {
    it("recognises Approved header and strict [PLAN_APPROVED] footer across LF and CRLF", () => {
      const validLf = [
        "# Implementation Plan",
        "- **Date**: 2026-10-19",
        "- **Status**: Approved",
        "",
        "## Technical Plan",
        "Details...",
        "",
        "[PLAN_APPROVED]",
        "",
      ].join("\n");
      expect(hasApprovedPlanHeader(validLf)).toBe(true);
      expect(hasApprovedPlanFooter(validLf)).toBe(true);
      expect(evaluatePlanApprovalContent(validLf)).toBe(true);

      const validCrlfVi = [
        "# Kế Hoạch Triển Khai",
        "- **Trạng thái**: approved",
        "Nội dung...",
        "[PLAN_APPROVED]",
        "   ",
      ].join("\r\n");
      expect(hasApprovedPlanHeader(validCrlfVi)).toBe(true);
      expect(hasApprovedPlanFooter(validCrlfVi)).toBe(true);
      expect(evaluatePlanApprovalContent(validCrlfVi)).toBe(true);
    });
  });

  describe("TC-02: evaluateLatestDateGroupPlans & Completed lifecycle (M4, MAJ-06, MAJ-07, MAJ-11, MIN-04)", () => {
    it("TC-02(a): returns false when header is Completed even if [PLAN_APPROVED] remains at footer", () => {
      const completedPlan = [
        "# Plan",
        "- **Status**: Completed",
        "Body...",
        "[PLAN_APPROVED]",
      ].join("\n");
      expect(hasCompletedPlanHeader(completedPlan)).toBe(true);
      expect(hasApprovedPlanHeader(completedPlan)).toBe(false);
      expect(evaluatePlanApprovalContent(completedPlan)).toBe(false);
    });

    it("TC-02(b): freezes (returns false) when same-day group has both Approved and Ready for Review plans", () => {
      const entries = [
        {
          filename: "2026-10-19-approved.md",
          mtimeMs: 2000,
          content: "# Plan 1\n- **Status**: Approved\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-19-new-draft.md",
          mtimeMs: 1000,
          content: "# Plan 2\n- **Status**: Ready for Review\n",
        },
      ];
      expect(evaluateLatestDateGroupPlans(entries, { maxDatePrefix: "2026-10-20" })).toBe(false);
    });

    it("TC-02(c): prioritises YYYY-MM-DD date prefix over mtimeMs after git clone/checkout", () => {
      const entries = [
        {
          filename: "2026-10-08-old-approved.md",
          mtimeMs: 999999,
          content: "# Old Plan\n- **Status**: Approved\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-19-new-pending.md",
          mtimeMs: 1000,
          content: "# New Plan\n- **Status**: Ready for Review\n",
        },
      ];
      expect(evaluateLatestDateGroupPlans(entries, { maxDatePrefix: "2026-10-20" })).toBe(false);
    });

    it("TC-02(d): returns false when all 4 plans in the 2026-10-19 group are Completed (MAJ-06)", () => {
      const makeCompleted = (name: string, mtimeMs: number) => ({
        filename: name,
        mtimeMs,
        content: `# ${name}\n- **Status**: Completed\n\n[PLAN_APPROVED]\n`,
      });
      const entries = [
        makeCompleted("2026-10-19-pstack-skills-and-fast-track-implementation-plan.md", 100),
        makeCompleted("2026-10-19-swap-planner-reviewer-workflow-implementation-plan.md", 200),
        makeCompleted("2026-10-19-vitest-upgrade-and-add-model-skill.md", 300),
        makeCompleted("2026-10-19-remake-agents-governance-v2-implementation-plan.md", 400),
      ];
      expect(evaluateLatestDateGroupPlans(entries, { maxDatePrefix: "2026-10-20" })).toBe(false);
    });

    it("TC-02(e): filters out spoofed future date prefixes > maxDatePrefix (MIN-04)", () => {
      const entries = [
        {
          filename: "2099-01-01-spoof.md",
          mtimeMs: 999999,
          content: "# Spoof\n- **Status**: Approved\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-19-completed.md",
          mtimeMs: 1000,
          content: "# Done\n- **Status**: Completed\n\n[PLAN_APPROVED]\n",
        },
      ];
      expect(evaluateLatestDateGroupPlans(entries, { maxDatePrefix: "2026-10-20" })).toBe(false);
    });

    it("TC-02(g): returns false when 2026-10-19 is Approved (higher mtimeMs) but 2026-10-23 is Ready for Review (MAJ-11)", () => {
      const entries = [
        {
          filename: "2026-10-19-remake-agents-governance-v2-implementation-plan.md",
          mtimeMs: 500000,
          content: "# Plan\n- **Status**: Approved\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-23-strata-local-llm-implementation-plan.md",
          mtimeMs: 100000,
          content: "# Strata Plan\n- **Status**: Ready for Review\n",
        },
      ];
      expect(evaluateLatestDateGroupPlans(entries, { maxDatePrefix: "2026-10-24" })).toBe(false);
    });

    it("returns true when 3 plans on 2026-10-19 are Completed and 1 is Approved with no pending plans", () => {
      const entries = [
        {
          filename: "2026-10-19-a.md",
          mtimeMs: 100,
          content: "# A\n- **Status**: Completed\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-19-b.md",
          mtimeMs: 200,
          content: "# B\n- **Status**: Completed\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-19-c.md",
          mtimeMs: 300,
          content: "# C\n- **Status**: Completed\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-19-d.md",
          mtimeMs: 400,
          content: "# D\n- **Status**: Approved\n\n[PLAN_APPROVED]\n",
        },
      ];
      expect(evaluateLatestDateGroupPlans(entries, { maxDatePrefix: "2026-10-20" })).toBe(true);
    });
  });

  describe("TC-03: Trailing prose rejection on [PLAN_APPROVED]", () => {
    it("rejects plans where the last line only ends with or mentions [PLAN_APPROVED] in prose", () => {
      for (const badFooter of [
        "# Plan\n- **Status**: Approved\nDo đó chưa cấp [PLAN_APPROVED]",
        "# Plan\n- **Status**: Approved\nKết luận: [PLAN_APPROVED]",
        "# Plan\n- **Status**: Approved\n`[PLAN_APPROVED]`",
      ]) {
        expect(hasApprovedPlanFooter(badFooter)).toBe(false);
        expect(evaluatePlanApprovalContent(badFooter)).toBe(false);
      }
    });
  });

  describe("TC-04: Single-Step Pre-Approved Plan Guard & .md-Only Guard across docs/** (BLK-03, BLK-04)", () => {
    it("TC-04(a): blocks write_to_file / write_file / Write on docs/plans/*.md when pre-populated with Approved or [PLAN_APPROVED]", () => {
      for (const toolName of ["write_to_file", "write_file", "Write"]) {
        const resHeader = decide(
          {
            toolName,
            targetFile: "docs/plans/2026-10-19-attack.md",
            newContent: "# Plan\n- **Status**: Approved\n\n## Technical Plan\n",
          },
          { planApproved: false }
        );
        expect(resHeader.decision).toBe("ask");
        expect(resHeader.reason).toContain("Plan Self-Forgery Guard");

        const resFooter = decide(
          {
            toolName,
            targetFile: "docs/plans/2026-10-19-attack.md",
            newContent: "# Plan\n- **Status**: Ready for Review\n\n[PLAN_APPROVED]\n",
          },
          { planApproved: false }
        );
        expect(resFooter.decision).toBe("ask");
        expect(resFooter.reason).toContain("Plan Self-Forgery Guard");
      }
    });

    it("allows write_to_file / write_file / Write on docs/plans/*.md when Status is Ready for Review and [PLAN_APPROVED] only appears in body text", () => {
      const validDraft = [
        "# Implementation Plan",
        "- **Status**: Ready for Review",
        "",
        "## Technical Plan",
        "Reviewer will append `[PLAN_APPROVED]` at the end after auditing.",
        "",
        "## Audit History",
      ].join("\n");
      expect(isSelfForgedPlanWrite(validDraft)).toBe(false);
      expect(
        decide(
          {
            toolName: "write_file",
            targetFile: "docs/plans/2026-10-19-legit.md",
            newContent: validDraft,
          },
          { planApproved: false }
        ).decision
      ).toBe("allow");
    });

    it("TC-04(b) & TC-04(c): blocks non-.md files across ALL unfrozen documentation paths (docs/plans/* and docs/notes/*)", () => {
      for (const badDocPath of [
        "docs/plans/x.test.mjs",
        "docs/notes/x.test.mjs",
        "docs/evil.js",
        "docs/plans/helper.ts",
      ]) {
        const res = decide(
          {
            toolName: "Write",
            targetFile: badDocPath,
            newContent: "export default {};",
          },
          { planApproved: false }
        );
        expect(res.decision, badDocPath).toBe("ask");
        expect(res.reason, badDocPath).toContain(
          "only .md files are allowed inside unfrozen documentation paths"
        );
      }
    });
  });

  describe("TC-05: Gate 3 Edit/edit_file, extractInput aliases, formatHookOutput & Read .env* Guard (BLK-03, BLK-04, MAJ-08, MAJ-10, MAJ-12)", () => {
    it("TC-05(a): allows replace_file_content, edit_file, and Edit to approve an existing plan in docs/plans/*.md", () => {
      for (const toolName of ["replace_file_content", "edit_file", "Edit"]) {
        const res = decide(
          {
            toolName,
            targetFile: "docs/plans/2026-10-19-x.md",
            oldContent: "- **Status**: Ready for Review",
            newContent: "- **Status**: Approved\n\n[PLAN_APPROVED]",
          },
          { planApproved: false }
        );
        expect(res.decision, toolName).toBe("allow");
      }
    });

    it("TC-05(b): extracts Path/Content/Replacement/Target and Claude CLI Edit old_string/new_string", () => {
      const claudeEdit = extractInput({
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: {
          file_path: "src/a.ts",
          old_string: "const a = 1;",
          new_string: "const a = 2;",
        },
      });
      expect(claudeEdit).toMatchObject({
        toolName: "Edit",
        targetFile: "src/a.ts",
        oldContent: "const a = 1;",
        newContent: "const a = 2;",
      });

      const agyEdit = extractInput({
        toolCall: {
          name: "edit_file",
          args: {
            Path: "src/components/Button.tsx",
            Target: "oldLine",
            Replacement: "newLine",
          },
        },
      });
      expect(agyEdit).toMatchObject({
        toolName: "edit_file",
        targetFile: "src/components/Button.tsx",
        oldContent: "oldLine",
        newContent: "newLine",
      });
    });

    it("TC-05(c) & TC-05(e): formatHookOutput returns null on PreToolUse allow (no stdout, exit 0) and permissionDecision: deny on ask under dontAsk without top-level decision", () => {
      const allowOut = formatHookOutput(
        { decision: "allow" },
        { hook_event_name: "PreToolUse", permission_mode: "dontAsk" }
      );
      expect(allowOut).toBeNull();

      const denyOut = formatHookOutput(
        { decision: "ask", reason: "blocked by guard" },
        { hook_event_name: "PreToolUse", permission_mode: "dontAsk" }
      );
      expect(denyOut).not.toBeNull();
      expect(denyOut).not.toHaveProperty("decision");
      expect(denyOut).toEqual({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "blocked by guard",
        },
      });

      const antigravityOut = formatHookOutput(
        { decision: "ask", reason: "blocked" },
        { toolCall: { name: "write_to_file", args: {} } }
      );
      expect(antigravityOut).toEqual({ decision: "ask", reason: "blocked" });
    });

    it("verifies CLI process exits 0 with empty stdout on PreToolUse allow and valid hookSpecificOutput JSON on PreToolUse deny (Wiring Probe 1)", () => {
      const guardScript = path.join(REPO_ROOT, ".agents", "scripts", "code-freeze-guard.js");

      const allowProc = spawnSync(process.execPath, [guardScript], {
        input: JSON.stringify({
          hook_event_name: "PreToolUse",
          permission_mode: "dontAsk",
          tool_name: "Write",
          tool_input: {
            file_path: "docs/plans/2026-10-23-test.md",
            content: "# Plan\n- **Status**: Ready for Review\n",
          },
        }),
        encoding: "utf8",
      });
      expect(allowProc.status).toBe(0);
      expect(allowProc.stdout).toBe("");

      const denyProc = spawnSync(process.execPath, [guardScript], {
        input: JSON.stringify({
          hook_event_name: "PreToolUse",
          permission_mode: "dontAsk",
          tool_name: "Write",
          tool_input: {
            file_path: "docs/notes/x.test.mjs",
            content: "console.error(1);",
          },
        }),
        encoding: "utf8",
      });
      expect(denyProc.status).toBe(0);
      const parsed = JSON.parse(denyProc.stdout);
      expect(parsed).not.toHaveProperty("decision");
      expect(parsed).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
        },
      });
    });

    it("TC-05(d): blocks reading .env* secret files via Read, read_file, or view_file while allowing normal files (MAJ-08)", () => {
      for (const toolName of ["Read", "read_file", "view_file"]) {
        for (const secretPath of [
          ".env",
          ".env.local",
          ".env.production",
          "C:/Users/wyemh/vikini/.env.local",
        ]) {
          const res = decide({ toolName, targetFile: secretPath }, { planApproved: true });
          expect(res.decision, `${toolName}:${secretPath}`).toBe("ask");
          expect(res.reason).toContain("reading .env* secret files is prohibited");
        }
        const safeRead = decide(
          { toolName, targetFile: "src/lib/core/modelRegistry.ts" },
          { planApproved: false }
        );
        expect(safeRead.decision).toBe("allow");
      }
    });

    it("supports edit_file in Fast-Track Mode without plan approval", () => {
      const editFileDecision = decide(
        makeFastTrackEdit("src/lib/utils/translations/vi.ts", 5, 5, "edit_file"),
        { planApproved: false }
      );
      expect(editFileDecision.decision).toBe("allow");
      expect(editFileDecision.reason).toContain("Fast-Track Mode");
    });

    it("extracts multi-chunk edits[] array from Claude MultiEdit tool payload", () => {
      const multiEditInput = extractInput({
        hook_event_name: "PreToolUse",
        tool_name: "MultiEdit",
        tool_input: {
          file_path: "src/components/Card.tsx",
          edits: [
            { old_string: "old1", new_string: "new1" },
            { old_string: "old2", new_string: "new2" },
          ],
        },
      });
      expect(multiEditInput).toMatchObject({
        toolName: "MultiEdit",
        targetFile: "src/components/Card.tsx",
        oldContent: "old1\nold2",
        newContent: "new1\nnew2",
      });
    });

    it("handles empty or non-dated plan entries safely in evaluateLatestDateGroupPlans", () => {
      expect(evaluateLatestDateGroupPlans([])).toBe(false);
      expect(
        evaluateLatestDateGroupPlans([
          {
            filename: "README.md",
            mtimeMs: 1000,
            content: "- **Status**: Approved\n[PLAN_APPROVED]",
          },
          {
            filename: "notes.md",
            mtimeMs: 2000,
            content: "- **Status**: Approved\n[PLAN_APPROVED]",
          },
        ])
      ).toBe(false);
    });

    it("returns false for undefined or empty strings in plan header/footer helpers", () => {
      expect(hasApprovedPlanHeader(undefined)).toBe(false);
      expect(hasCompletedPlanHeader("")).toBe(false);
      expect(hasApprovedPlanFooter("   \n  ")).toBe(false);
      expect(isSelfForgedPlanWrite(undefined)).toBe(false);
    });

    it("verifies .agents/hooks.json matcher includes all 6 write/edit/command tools", () => {
      const hooksJson = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, ".agents", "hooks.json"), "utf8")
      );
      const matcher = hooksJson?.["code-freeze-guard"]?.PreToolUse?.[0]?.matcher;
      expect(matcher).toBe(
        "write_to_file|replace_file_content|multi_replace_file_content|write_file|edit_file|run_command"
      );
    });
  });

  describe("TC-06 & TC-07: Command allowlist hardening (claude, run-claude.ps1, git difftool, config flags, verify-docs.mjs)", () => {
    it("TC-06: allows safe claude probes, hyphenated test filenames (batch-c.test.ts), and valid run-claude.ps1 invocations", () => {
      for (const cmd of [
        "claude --version",
        "claude -v",
        "claude --help",
        "claude -p ping",
        'claude -p "ping"',
        "npx vitest run src/lib/features/chat/batch-c.test.ts",
        "npx vitest run src/lib/features/chat/part-u.test.ts",
        "npx vitest run src/lib/features/chat/item-i.test.ts",
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role reviewer -PlanFile docs/plans/task.md",
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/task.md -ArtifactFile C:/Users/wyemh/.gemini/antigravity/brain/conv/implementation_plan.md",
      ]) {
        expect(decide({ command: cmd }).decision, cmd).toBe("allow");
      }
    });

    it("TC-06 Negative: blocks git difftool, --config/-c flags, claude bypass flags, and invalid run-claude.ps1 arguments", () => {
      for (const badCmd of [
        'git difftool -y -x "node exploit.js" HEAD~1',
        "npx vitest run --config docs/plans/x.mjs",
        "npx vitest run -c docs/plans/x.mjs",
        "npx vitest run --root docs/plans",
        "npx vitest run --dir docs/plans",
        "npx eslint --print-config src/a.ts -c docs/plans/x.mjs",
        "claude -p 'edit src/app/page.tsx' --dangerously-skip-permissions",
        "claude --permission-mode bypassPermissions -p hi",
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile src/app/page.tsx",
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/task.md -ArtifactFile src/app/page.tsx",
        "powershell -ExecutionPolicy Bypass -File .agents/scripts/run-claude.ps1 -Role planner -PlanFile docs/plans/task.md -ArtifactFile C:/Users/wyemh/.gemini/antigravity/brain/../evil.md",
      ]) {
        expect(decide({ command: badCmd }).decision, badCmd).toBe("ask");
      }
    });

    it("TC-07: allows node scripts/verify-docs.mjs with forward or backslashes and valid flags", () => {
      for (const cmd of [
        "node scripts/verify-docs.mjs",
        "node ./scripts/verify-docs.mjs --strict-shorthand",
        "node scripts\\verify-docs.mjs --strict-shorthand --expected-headings=113",
        "node .\\scripts\\verify-docs.mjs --expected-headings=113",
      ]) {
        expect(decide({ command: cmd }).decision, cmd).toBe("allow");
      }

      for (const badCmd of [
        "node scripts/verify-docs.mjs; rm -rf src",
        "node scripts/other-script.mjs",
        "node scripts/verify-docs.mjs --unknown-flag",
      ]) {
        expect(decide({ command: badCmd }).decision, badCmd).toBe("ask");
      }
    });
  });

  describe("TC-08: Governance character limits, Normative Preservation Matrix & 4-layer run-claude.ps1 verification", () => {
    it("enforces rule/agent character budgets and < 18,000 chars total for always_on rules", () => {
      const rulesDir = path.join(REPO_ROOT, ".agents", "rules");
      const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
      let alwaysOnTotal = 0;

      for (const file of ruleFiles) {
        const content = fs.readFileSync(path.join(rulesDir, file), "utf8");
        expect(content.length, `Rule ${file} <= 12,000 chars`).toBeLessThanOrEqual(12000);
        if (/^trigger:\s*always_on\s*$/m.test(content)) {
          alwaysOnTotal += content.length;
        }
      }
      expect(alwaysOnTotal).toBeLessThan(18000);

      for (const agent of ["planner", "reviewer", "qa"]) {
        const agentPath = path.join(REPO_ROOT, ".agents", "agents", agent, "agent.md");
        const content = fs.readFileSync(agentPath, "utf8");
        expect(content.length, `${agent}/agent.md <= 10,000 chars`).toBeLessThanOrEqual(10000);
        expect(content).toMatch(/^model:\s*pro\s*$/m);
        expect(content).not.toMatch(/^role:/m);
        if (agent === "reviewer") {
          expect(content.length).toBeLessThan(7500);
          expect(content).not.toMatch(/^\s*-\s*write_to_file\s*$/m);
        }
      }
    });

    it("preserves all 15 mandatory items in the Normative Preservation Matrix (M5)", () => {
      const r00 = fs.readFileSync(path.join(REPO_ROOT, ".agents", "rules", "00-core.md"), "utf8");
      const r01 = fs.readFileSync(path.join(REPO_ROOT, ".agents", "rules", "01-coding.md"), "utf8");
      const r02 = fs.readFileSync(
        path.join(REPO_ROOT, ".agents", "rules", "02-quality.md"),
        "utf8"
      );
      const r03 = fs.readFileSync(path.join(REPO_ROOT, ".agents", "rules", "03-ui.md"), "utf8");
      const r04 = fs.readFileSync(
        path.join(REPO_ROOT, ".agents", "rules", "04-bilingual.md"),
        "utf8"
      );
      const r05 = fs.readFileSync(
        path.join(REPO_ROOT, ".agents", "rules", "05-plan-review.md"),
        "utf8"
      );

      // 00-core.md invariants & git split
      expect(r00).toContain("Core Coding & Testing Invariants");
      expect(r00).toContain("BANNED Mutating Git Commands");
      expect(r00).toContain("ALLOWED Read-Only Git Inspection");

      // 01-coding.md & 03-ui.md globs + 04-bilingual.md src/ path
      expect(r01).toContain(
        'globs: "*.ts, *.tsx, *.js, *.mjs, **/*.ts, **/*.tsx, **/*.js, **/*.mjs"'
      );
      expect(r03).toContain('globs: "*.tsx, *.css, **/*.tsx, **/*.css"');
      expect(r04).toContain("src/lib/utils/translations/");

      // 8 mandatory items in 02-quality.md
      expect(r02).toContain(".agents/skills/vikini-debug/SKILL.md");
      expect(r02).toContain(".agents/skills/vikini-audit/SKILL.md");
      expect(r02).not.toContain(".agents/workflows/");
      expect(r02).toContain("Skill Precedence Hierarchy");
      expect(r02).toContain("npm run type-check; npm run lint; npm run test:run");
      expect(r02).toContain("Loại A");
      expect(r02).toContain("Loại B");
      expect(r02).toContain("Loại C");
      expect(r02).toContain("12,000");
      expect(r02).toContain("10,000");
      expect(r02).toContain("ARCHITECTURAL ALERT: 3 fixes failed");

      // 7 mandatory items in 05-plan-review.md
      expect(r05).toContain("Scoped Protection");
      expect(r05).toContain("Fast-Track Mode");
      expect(r05).toContain("Zero-Self-Execution");
      expect(r05).toContain("10 vòng lặp");
      expect(r05).toContain("[BLOCKER]");
      expect(r05).toContain("[MAJOR]");
      expect(r05).toContain("[MINOR]");
      expect(r05).toContain("Status: Completed");
      expect(r05).toContain("Pre-Flight Gate");
    });

    it("verifies 4-layer defense in run-claude.ps1 and removal of .plan-approved in code-freeze-guard.js", () => {
      const guardSource = fs.readFileSync(
        path.join(REPO_ROOT, ".agents", "scripts", "code-freeze-guard.js"),
        "utf8"
      );
      expect(guardSource).not.toContain(".plan-approved");
      expect(guardSource).toContain("export function isPlanApproved()");

      const ps1Source = fs.readFileSync(
        path.join(REPO_ROOT, ".agents", "scripts", "run-claude.ps1"),
        "utf8"
      );
      expect(ps1Source).not.toContain("--dangerously-skip-permissions");
      expect(ps1Source).toContain('"--permission-mode", "dontAsk"');
      expect(ps1Source).toContain('"--settings", $claudeHookSettings');
      expect(ps1Source).toContain('"onFailure":"block"');
      expect(ps1Source).toContain("Edit(docs/plans/*.md)");
      expect(ps1Source).toContain('$disallowedTools = "Write,$sharedDisallowed"');
      expect(ps1Source).toContain("Bash(git diff *)");
      expect(ps1Source).not.toContain("Bash(git diff*)");
      expect(ps1Source).toContain("Read(.env*),Read(**/.env*)");
      expect(ps1Source).toContain("Bash(powershell *),Bash(pwsh *),Bash(claude *)");
      expect(ps1Source).toContain("Bash(git difftool*),Bash(* --config*),Bash(* -c *)");
      expect(ps1Source).toContain("[System.IO.Path]::IsPathRooted($trimmedArtifact)");
      expect(ps1Source).toContain("$resolvedArtifactFile");
    });
  });
});
