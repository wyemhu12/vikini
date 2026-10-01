import { describe, it, expect } from "vitest";
import { evaluateMathExpression } from "./mathParser";
import { ValidationError } from "@/lib/utils/errors";

describe("mathParser - evaluateMathExpression", () => {
  describe("Basic Arithmetic & Precedence", () => {
    it("evaluates simple addition and subtraction", () => {
      expect(evaluateMathExpression("2 + 3")).toBe(5);
      expect(evaluateMathExpression("10 - 4")).toBe(6);
      expect(evaluateMathExpression("10 - 4 + 2")).toBe(8);
    });

    it("respects operator precedence (multiplication/division over addition/subtraction)", () => {
      expect(evaluateMathExpression("2 + 2 * 3")).toBe(8);
      expect(evaluateMathExpression("10 - 6 / 2")).toBe(7);
      expect(evaluateMathExpression("2 * 3 + 4 * 5")).toBe(26);
    });

    it("handles modulo operator", () => {
      expect(evaluateMathExpression("10 % 3")).toBe(1);
      expect(evaluateMathExpression("15 % 4 + 1")).toBe(4);
    });

    it("evaluates nested parentheses properly", () => {
      expect(evaluateMathExpression("(2 + 2) * 3")).toBe(12);
      expect(evaluateMathExpression("((5 + 3) * (10 - 8)) / 4")).toBe(4);
    });

    it("handles decimals and negative numbers", () => {
      expect(evaluateMathExpression("3.5 + 2.5")).toBe(6);
      expect(evaluateMathExpression("-5 + 10")).toBe(5);
      expect(evaluateMathExpression("10 + -3")).toBe(7);
    });
  });

  describe("Exponentiation", () => {
    it("evaluates ^ and ** operators", () => {
      expect(evaluateMathExpression("2 ^ 3")).toBe(8);
      expect(evaluateMathExpression("2 ** 3")).toBe(8);
    });

    it("enforces unary minus vs power convention (-2^2 = -4, (-2)^2 = 4)", () => {
      expect(evaluateMathExpression("-2 ^ 2")).toBe(-4);
      expect(evaluateMathExpression("(-2) ^ 2")).toBe(4);
    });

    it("evaluates right-associative exponents (2 ^ 3 ^ 2 = 2 ^ 9 = 512)", () => {
      expect(evaluateMathExpression("2 ^ 3 ^ 2")).toBe(512);
    });

    it("enforces exponent limits to prevent DoS", () => {
      expect(() => evaluateMathExpression("2 ^ 51")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("2 ^ 1000")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("2 ^ -51")).toThrow(ValidationError);
    });
  });

  describe("Percentages", () => {
    it("evaluates trailing percentage", () => {
      expect(evaluateMathExpression("50%")).toBe(0.5);
      expect(evaluateMathExpression("200 * 15%")).toBe(30);
    });

    it("evaluates 'X% of Y' syntax", () => {
      expect(evaluateMathExpression("15% of 200")).toBe(30);
      expect(evaluateMathExpression("25% of 80")).toBe(20);
    });
  });

  describe("Functions & Constants", () => {
    it("evaluates mathematical constants pi and e", () => {
      expect(evaluateMathExpression("pi")).toBeCloseTo(Math.PI);
      expect(evaluateMathExpression("e")).toBeCloseTo(Math.E);
      expect(evaluateMathExpression("2 * pi")).toBeCloseTo(2 * Math.PI);
    });

    it("evaluates basic math functions", () => {
      expect(evaluateMathExpression("sqrt(16)")).toBe(4);
      expect(evaluateMathExpression("cbrt(27)")).toBe(3);
      expect(evaluateMathExpression("abs(-42)")).toBe(42);
      expect(evaluateMathExpression("round(3.7)")).toBe(4);
      expect(evaluateMathExpression("floor(3.9)")).toBe(3);
      expect(evaluateMathExpression("ceil(3.1)")).toBe(4);
      expect(evaluateMathExpression("sin(0)")).toBe(0);
      expect(evaluateMathExpression("cos(0)")).toBe(1);
    });

    it("evaluates logarithms", () => {
      expect(evaluateMathExpression("log10(100)")).toBe(2);
      expect(evaluateMathExpression("log2(8)")).toBe(3);
      expect(evaluateMathExpression("ln(e)")).toBeCloseTo(1);
    });

    it("evaluates multi-argument functions min, max, pow", () => {
      expect(evaluateMathExpression("min(5, 10, 2, 8)")).toBe(2);
      expect(evaluateMathExpression("max(5, 10, 2, 8)")).toBe(10);
      expect(evaluateMathExpression("pow(2, 4)")).toBe(16);
    });

    it("rejects domain violations (sqrt of negative, log of zero/negative)", () => {
      expect(() => evaluateMathExpression("sqrt(-4)")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("ln(0)")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("log10(-10)")).toThrow(ValidationError);
    });
  });

  describe("Division by Zero & Extremes", () => {
    it("rejects division by zero", () => {
      expect(() => evaluateMathExpression("10 / 0")).toThrow("Division by zero");
      expect(() => evaluateMathExpression("10 % 0")).toThrow("Division by zero");
    });

    it("rejects expressions exceeding max character length", () => {
      const longExpr = "1 + ".repeat(200) + "1"; // > 600 chars
      expect(() => evaluateMathExpression(longExpr)).toThrow("Expression too long");
    });
  });

  describe("Security & Code Injection Defense (SEC-04)", () => {
    it("rejects process, window, globalThis, console, fetch attempts", () => {
      expect(() => evaluateMathExpression("process.exit()")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("globalThis.constructor")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("console.log(1)")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("fetch('http://evil.com')")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("require('fs')")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("import('fs')")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("window.alert(1)")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("eval('1+1')")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("Function('return 1')()")).toThrow(ValidationError);
    });

    it("rejects arbitrary JavaScript statements and delimiters", () => {
      expect(() => evaluateMathExpression("; alert(1);")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("{ a: 1 }")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("[1, 2, 3]")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("`hello`")).toThrow(ValidationError);
      expect(() => evaluateMathExpression("'string'")).toThrow(ValidationError);
      expect(() => evaluateMathExpression('"string"')).toThrow(ValidationError);
    });
  });
});
