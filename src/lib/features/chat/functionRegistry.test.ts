import { describe, it, expect } from "vitest";
import { executeFunction, hasFunction, getAllDeclarations } from "./functionRegistry";

describe("functionRegistry - calculate tool (SEC-04)", () => {
  it("registers the calculate tool", () => {
    expect(hasFunction("calculate")).toBe(true);
    const decls = getAllDeclarations();
    const calcDecl = decls.find((d) => d.name === "calculate");
    expect(calcDecl).toBeDefined();
    expect(calcDecl?.parameters?.required).toContain("expression");
  });

  it("calculates valid arithmetic expressions safely", async () => {
    const res = await executeFunction("calculate", { expression: "12 * 5 + 4" });
    expect(res.error).toBeUndefined();
    const data = JSON.parse(res.result);
    expect(data.result).toBe(64);
  });

  it("calculates expressions with percentages and functions", async () => {
    const res = await executeFunction("calculate", { expression: "sqrt(100) + 15% of 200" });
    expect(res.error).toBeUndefined();
    const data = JSON.parse(res.result);
    expect(data.result).toBe(40);
  });

  it("returns error without crashing on division by zero", async () => {
    const res = await executeFunction("calculate", { expression: "10 / 0" });
    expect(res.result).toBe("");
    expect(res.error).toContain("Division by zero");
  });

  it("blocks and rejects code injection attempts safely", async () => {
    const res = await executeFunction("calculate", {
      expression: "process.exit()",
    });
    expect(res.result).toBe("");
    expect(res.error).toContain("Failed to calculate");
    expect(res.error).toContain("unknown identifier");
  });

  it("blocks Function constructor and prototype pollution attacks", async () => {
    const res = await executeFunction("calculate", {
      expression: "globalThis.constructor.constructor('return 1')()",
    });
    expect(res.result).toBe("");
    expect(res.error).toContain("Failed to calculate");
  });
});
