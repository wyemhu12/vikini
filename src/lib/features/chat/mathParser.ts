/**
 * Safe Math Expression Parser & Evaluator
 * AST-free recursive descent parser for mathematical expressions.
 * Strictly forbids eval(), Function(), vm, or any dynamic code execution.
 */
import { ValidationError } from "@/lib/utils/errors";

const MAX_EXPRESSION_LENGTH = 500;
const MAX_EXPONENT = 50;
const MIN_EXPONENT = -50;
const MAX_SAFE_RESULT = Number.MAX_SAFE_INTEGER * 1000;

type TokenType = "NUMBER" | "OP" | "LPAREN" | "RPAREN" | "COMMA" | "IDENT" | "EOF";

interface Token {
  type: TokenType;
  value: string;
  num?: number;
}

const ALLOWED_FUNCTIONS = new Set([
  "abs",
  "ceil",
  "floor",
  "round",
  "sqrt",
  "cbrt",
  "sin",
  "cos",
  "tan",
  "log",
  "log10",
  "log2",
  "ln",
  "exp",
  "min",
  "max",
  "pow",
]);

const ALLOWED_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

class MathParser {
  private tokens: Token[] = [];
  private pos = 0;

  constructor(expression: string) {
    if (!expression || typeof expression !== "string") {
      throw new ValidationError("Invalid mathematical expression: empty or invalid input");
    }

    if (expression.length > MAX_EXPRESSION_LENGTH) {
      throw new ValidationError(`Expression too long (max ${MAX_EXPRESSION_LENGTH} characters)`);
    }

    // Preprocess "X% of Y" pattern into "X * 0.01 * Y"
    const preprocessed = expression.replace(
      /(\d+(?:\.\d+)?)\s*%\s*(?:of|\*)\s*(\d+(?:\.\d+)?)/gi,
      "($1 * 0.01 * $2)"
    );

    this.tokens = this.tokenize(preprocessed);
    this.pos = 0;
  }

  private tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < expr.length) {
      const ch = expr[i];

      // Skip whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Numbers (including decimals and percentages like 50%)
      if (/\d/.test(ch) || (ch === "." && /\d/.test(expr[i + 1] || ""))) {
        let numStr = "";
        let hasDot = false;
        while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
          if (expr[i] === ".") {
            if (hasDot) {
              throw new ValidationError("Invalid number format in expression");
            }
            hasDot = true;
          }
          numStr += expr[i];
          i++;
        }

        let numVal = parseFloat(numStr);
        if (isNaN(numVal)) {
          throw new ValidationError("Invalid number in expression");
        }

        // Check if trailing %
        if (expr[i] === "%") {
          numVal = numVal * 0.01;
          i++;
        }

        tokens.push({ type: "NUMBER", value: numStr, num: numVal });
        continue;
      }

      // Exponentiation operators: ** or ^
      if (ch === "*" && expr[i + 1] === "*") {
        tokens.push({ type: "OP", value: "^" });
        i += 2;
        continue;
      }

      if (ch === "^") {
        tokens.push({ type: "OP", value: "^" });
        i++;
        continue;
      }

      // Basic operators: +, -, *, /, %
      if (["+", "-", "*", "/", "%"].includes(ch)) {
        tokens.push({ type: "OP", value: ch });
        i++;
        continue;
      }

      // Parentheses
      if (ch === "(") {
        tokens.push({ type: "LPAREN", value: "(" });
        i++;
        continue;
      }
      if (ch === ")") {
        tokens.push({ type: "RPAREN", value: ")" });
        i++;
        continue;
      }

      // Comma for multi-arg functions: min(1, 2)
      if (ch === ",") {
        tokens.push({ type: "COMMA", value: "," });
        i++;
        continue;
      }

      // Identifiers (functions or constants)
      if (/[a-zA-Z_]/.test(ch)) {
        let ident = "";
        while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
          ident += expr[i];
          i++;
        }
        const lowerIdent = ident.toLowerCase();
        if (!ALLOWED_FUNCTIONS.has(lowerIdent) && !(lowerIdent in ALLOWED_CONSTANTS)) {
          throw new ValidationError(
            `Invalid mathematical expression: unknown identifier "${ident}"`
          );
        }
        tokens.push({ type: "IDENT", value: lowerIdent });
        continue;
      }

      throw new ValidationError(`Invalid character in mathematical expression: "${ch}"`);
    }

    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: "EOF", value: "" };
  }

  private consume(expected?: TokenType, expectedValue?: string): Token {
    const token = this.current();
    if (expected && token.type !== expected) {
      throw new ValidationError(`Unexpected token "${token.value || token.type}"`);
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new ValidationError(`Expected "${expectedValue}", got "${token.value}"`);
    }
    this.pos++;
    return token;
  }

  /**
   * Parse the full expression:
   * Expr -> AddSub
   */
  public parse(): number {
    const result = this.parseAddSub();
    if (this.current().type !== "EOF") {
      throw new ValidationError(`Unexpected trailing input: "${this.current().value}"`);
    }
    if (!Number.isFinite(result) || Number.isNaN(result)) {
      throw new ValidationError("Math result out of range or undefined");
    }
    if (Math.abs(result) > MAX_SAFE_RESULT) {
      throw new ValidationError("Math result out of range");
    }
    return result;
  }

  /**
   * AddSub -> MulDiv ((+|-) MulDiv)*
   */
  private parseAddSub(): number {
    let left = this.parseMulDiv();

    while (this.current().type === "OP" && ["+", "-"].includes(this.current().value)) {
      const op = this.consume().value;
      const right = this.parseMulDiv();
      if (op === "+") {
        left += right;
      } else {
        left -= right;
      }
    }

    return left;
  }

  /**
   * MulDiv -> Unary ((*|/|%) Unary)*
   */
  private parseMulDiv(): number {
    let left = this.parseUnary();

    while (this.current().type === "OP" && ["*", "/", "%"].includes(this.current().value)) {
      const op = this.consume().value;
      const right = this.parseUnary();
      if (op === "*") {
        left *= right;
      } else if (op === "/") {
        if (right === 0) {
          throw new ValidationError("Division by zero");
        }
        left /= right;
      } else if (op === "%") {
        if (right === 0) {
          throw new ValidationError("Division by zero");
        }
        left %= right;
      }
    }

    return left;
  }

  /**
   * Unary -> (+|-)? Exponent
   * Enforces mathematical precedence where -2^2 = -(2^2) = -4.
   */
  private parseUnary(): number {
    if (this.current().type === "OP" && ["+", "-"].includes(this.current().value)) {
      const op = this.consume().value;
      const operand = this.parseExponent();
      return op === "-" ? -operand : operand;
    }
    return this.parseExponent();
  }

  /**
   * Exponent -> Primary (^ Unary)? (right-associative)
   */
  private parseExponent(): number {
    const base = this.parsePrimary();

    if (this.current().type === "OP" && this.current().value === "^") {
      this.consume();
      const exp = this.parseUnary();
      if (exp > MAX_EXPONENT || exp < MIN_EXPONENT) {
        throw new ValidationError(`Exponent out of range [${MIN_EXPONENT}, ${MAX_EXPONENT}]`);
      }
      return Math.pow(base, exp);
    }

    return base;
  }

  /**
   * Primary -> NUMBER | IDENT | LPAREN Expr RPAREN
   */
  private parsePrimary(): number {
    const token = this.current();

    if (token.type === "NUMBER") {
      this.consume();
      return token.num!;
    }

    if (token.type === "IDENT") {
      this.consume();
      const name = token.value;

      // Check constant
      if (name in ALLOWED_CONSTANTS) {
        return ALLOWED_CONSTANTS[name];
      }

      // Must be a function call: func(arg1, arg2...)
      if (this.current().type !== "LPAREN") {
        throw new ValidationError(`Function "${name}" missing parentheses`);
      }
      this.consume("LPAREN");

      const args: number[] = [];
      if (this.current().type !== "RPAREN") {
        args.push(this.parseAddSub());
        while (this.current().type === "COMMA") {
          this.consume("COMMA");
          args.push(this.parseAddSub());
        }
      }
      this.consume("RPAREN");

      return this.evaluateFunction(name, args);
    }

    if (token.type === "LPAREN") {
      this.consume("LPAREN");
      const val = this.parseAddSub();
      this.consume("RPAREN");
      return val;
    }

    throw new ValidationError(`Unexpected token "${token.value || token.type}"`);
  }

  private evaluateFunction(name: string, args: number[]): number {
    switch (name) {
      case "abs":
        if (args.length !== 1) throw new ValidationError("abs() requires exactly 1 argument");
        return Math.abs(args[0]);
      case "ceil":
        if (args.length !== 1) throw new ValidationError("ceil() requires exactly 1 argument");
        return Math.ceil(args[0]);
      case "floor":
        if (args.length !== 1) throw new ValidationError("floor() requires exactly 1 argument");
        return Math.floor(args[0]);
      case "round":
        if (args.length !== 1) throw new ValidationError("round() requires exactly 1 argument");
        return Math.round(args[0]);
      case "sqrt":
        if (args.length !== 1) throw new ValidationError("sqrt() requires exactly 1 argument");
        if (args[0] < 0) throw new ValidationError("Square root of negative number");
        return Math.sqrt(args[0]);
      case "cbrt":
        if (args.length !== 1) throw new ValidationError("cbrt() requires exactly 1 argument");
        return Math.cbrt(args[0]);
      case "sin":
        if (args.length !== 1) throw new ValidationError("sin() requires exactly 1 argument");
        return Math.sin(args[0]);
      case "cos":
        if (args.length !== 1) throw new ValidationError("cos() requires exactly 1 argument");
        return Math.cos(args[0]);
      case "tan":
        if (args.length !== 1) throw new ValidationError("tan() requires exactly 1 argument");
        return Math.tan(args[0]);
      case "log":
      case "ln":
        if (args.length !== 1) throw new ValidationError(`${name}() requires exactly 1 argument`);
        if (args[0] <= 0) throw new ValidationError("Logarithm of non-positive number");
        return Math.log(args[0]);
      case "log10":
        if (args.length !== 1) throw new ValidationError("log10() requires exactly 1 argument");
        if (args[0] <= 0) throw new ValidationError("Logarithm of non-positive number");
        return Math.log10(args[0]);
      case "log2":
        if (args.length !== 1) throw new ValidationError("log2() requires exactly 1 argument");
        if (args[0] <= 0) throw new ValidationError("Logarithm of non-positive number");
        return Math.log2(args[0]);
      case "exp":
        if (args.length !== 1) throw new ValidationError("exp() requires exactly 1 argument");
        if (args[0] > MAX_EXPONENT) throw new ValidationError("Exponent out of range");
        return Math.exp(args[0]);
      case "min":
        if (args.length === 0) throw new ValidationError("min() requires at least 1 argument");
        return Math.min(...args);
      case "max":
        if (args.length === 0) throw new ValidationError("max() requires at least 1 argument");
        return Math.max(...args);
      case "pow":
        if (args.length !== 2) throw new ValidationError("pow() requires exactly 2 arguments");
        if (args[1] > MAX_EXPONENT || args[1] < MIN_EXPONENT) {
          throw new ValidationError(`Exponent out of range [${MIN_EXPONENT}, ${MAX_EXPONENT}]`);
        }
        return Math.pow(args[0], args[1]);
      default:
        throw new ValidationError(`Unsupported function "${name}"`);
    }
  }
}

/**
 * Safely evaluates a mathematical expression string.
 * @throws ValidationError on invalid syntax, injection attempt, or out-of-range calculation.
 */
export function evaluateMathExpression(expression: string): number {
  const parser = new MathParser(expression);
  return parser.parse();
}
