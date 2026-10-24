import fs from "node:fs";
import { describe, it, expect, vi } from "vitest";
import {
  extractDeclaredFiles,
  getActiveApprovedPlans,
  getApprovedPlanScope,
} from "./plan-scope.js";

describe("plan-scope (P1-7)", () => {
  describe("TC-F1: extractDeclaredFiles", () => {
    it("extracts valid [NEW]/[MODIFY]/[DELETE] paths before ## Audit History and filters out globs, traversal, directories, and Audit History tags", () => {
      const planMarkdown = [
        "# Implementation Plan",
        "- **Status**: Approved",
        "",
        "## Technical Plan",
        "[NEW]    src/a.ts",
        "- `[MODIFY]` `src/b.tsx`",
        "| `[DELETE]` | `src/c.ts` |",
        "[MODIFY] [`src/d.ts`](file:///c:/x/src/d.ts)",
        "[NEW] `src/app/api/x/[id]/route.ts`",
        "[MODIFY] src/*.ts",
        "[NEW] ../outside.ts",
        "[NEW] src/dir/",
        "",
        "## Audit History",
        "[NEW] src/z.ts",
        "",
        "[PLAN_APPROVED]",
      ].join("\n");

      expect(extractDeclaredFiles(planMarkdown)).toEqual([
        "src/a.ts",
        "src/app/api/x/[id]/route.ts",
        "src/b.tsx",
        "src/c.ts",
        "src/d.ts",
      ]);
    });

    it("returns empty array for empty or undefined input", () => {
      expect(extractDeclaredFiles(undefined)).toEqual([]);
      expect(extractDeclaredFiles("")).toEqual([]);
      expect(extractDeclaredFiles("   ")).toEqual([]);
    });
  });

  describe("TC-F2: getActiveApprovedPlans", () => {
    it("returns the 1 Approved plan when newest date group has 1 Approved and 1 Completed", () => {
      const entries = [
        {
          filename: "2026-10-24-done.md",
          mtimeMs: 1000,
          content: "# Done\n- **Status**: Completed\n## Technical Plan\n- `[NEW]` `src/old.ts`\n",
        },
        {
          filename: "2026-10-24-active.md",
          mtimeMs: 2000,
          content:
            "# Active\n- **Status**: Approved\n## Technical Plan\n- `[MODIFY]` `src/new.ts`\n\n[PLAN_APPROVED]\n",
        },
      ];
      const active = getActiveApprovedPlans(entries, { maxDatePrefix: "2026-10-25" });
      expect(active).toHaveLength(1);
      expect(active[0].filename).toBe("2026-10-24-active.md");
    });

    it("returns empty array when newest date group also has a Ready for Review plan (fail-safe freeze)", () => {
      const entries = [
        {
          filename: "2026-10-24-active.md",
          mtimeMs: 2000,
          content:
            "# Active\n- **Status**: Approved\n## Technical Plan\n- `[MODIFY]` `src/new.ts`\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-24-pending.md",
          mtimeMs: 3000,
          content: "# Pending\n- **Status**: Ready for Review\n## Technical Plan\n",
        },
      ];
      expect(getActiveApprovedPlans(entries, { maxDatePrefix: "2026-10-25" })).toEqual([]);
    });

    it("returns both Approved plans when newest date group has 2 Approved plans", () => {
      const entries = [
        {
          filename: "2026-10-24-first.md",
          mtimeMs: 1000,
          content:
            "# First\n- **Status**: Approved\n## Technical Plan\n- `[NEW]` `src/a.ts`\n\n[PLAN_APPROVED]\n",
        },
        {
          filename: "2026-10-24-second.md",
          mtimeMs: 2000,
          content:
            "# Second\n- **Status**: Approved\n## Technical Plan\n- `[MODIFY]` `src/b.ts`\n\n[PLAN_APPROVED]\n",
        },
      ];
      const active = getActiveApprovedPlans(entries, { maxDatePrefix: "2026-10-25" });
      expect(active).toHaveLength(2);
    });
  });

  describe("TC-F5: getApprovedPlanScope error handling", () => {
    it("fails closed ({ approved: false, files: [] }) when plansDir does not exist or fs.readdirSync throws", () => {
      expect(getApprovedPlanScope({ plansDir: "C:/non-existent-plans-dir-xyz" })).toEqual({
        approved: false,
        files: [],
      });

      const spy = vi.spyOn(fs, "readdirSync").mockImplementationOnce(() => {
        throw new Error("disk failure");
      });
      expect(getApprovedPlanScope()).toEqual({
        approved: false,
        files: [],
      });
      spy.mockRestore();
    });
  });
});
