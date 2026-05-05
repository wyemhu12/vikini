// /lib/features/chat/functionRegistry.ts
// Extensible function registry for Gemini Function Calling.
// Register new functions here — they become available to all Gemini models.
//
// Architecture:
//   1. Define function with FunctionDeclaration schema
//   2. Implement handler with typed args
//   3. Register via registerFunction()
//   4. Registry auto-exports declarations for tools config

import { logger } from "@/lib/utils/logger";

const fnLogger = logger.withContext("functionRegistry");

// ============================================
// Types
// ============================================

/** JSON Schema property for function parameters */
export interface FunctionParameterProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: FunctionParameterProperty;
}

/** Function declaration schema (sent to Gemini) */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, FunctionParameterProperty>;
    required?: string[];
  };
}

/** Result returned from function execution */
export interface FunctionResult {
  result: string;
  error?: string;
}

/** Function handler implementation */
export type FunctionHandler = (
  args: Record<string, unknown>
) => FunctionResult | Promise<FunctionResult>;

/** Complete registered function entry */
interface RegisteredFunction {
  declaration: FunctionDeclaration;
  handler: FunctionHandler;
}

// ============================================
// Registry
// ============================================

const registry = new Map<string, RegisteredFunction>();

/**
 * Register a function for Gemini Function Calling.
 * The function becomes available to all chat requests.
 */
export function registerFunction(declaration: FunctionDeclaration, handler: FunctionHandler): void {
  if (registry.has(declaration.name)) {
    fnLogger.warn(`Overwriting existing function: ${declaration.name}`);
  }
  registry.set(declaration.name, { declaration, handler });
  fnLogger.info(`Registered function: ${declaration.name}`);
}

/**
 * Get all function declarations for the tools config.
 * Used in setupToolsAndSafety() to build the functionDeclarations array.
 */
export function getAllDeclarations(): FunctionDeclaration[] {
  return Array.from(registry.values()).map((entry) => entry.declaration);
}

/**
 * Execute a function call from the model.
 * Supports both sync and async handlers.
 *
 * @param name - Function name from functionCall.name
 * @param args - Arguments from functionCall.args
 * @returns Result to send back as functionResponse
 */
export async function executeFunction(
  name: string,
  args: Record<string, unknown>
): Promise<FunctionResult> {
  const entry = registry.get(name);

  if (!entry) {
    fnLogger.error(`Unknown function called: ${name}`);
    return { result: "", error: `Unknown function: ${name}` };
  }

  try {
    fnLogger.info(`Executing function: ${name}`, { args: Object.keys(args) });
    const result = await entry.handler(args);
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Execution failed";
    fnLogger.error(`Function ${name} failed: ${message}`);
    return { result: "", error: message };
  }
}

/**
 * Check if a function is registered.
 */
export function hasFunction(name: string): boolean {
  return registry.has(name);
}

/**
 * Get the number of registered functions.
 */
export function getFunctionCount(): number {
  return registry.size;
}

// ============================================
// Built-in Functions Registration
// ============================================

// --- get_current_time ---
registerFunction(
  {
    name: "get_current_time",
    description:
      "Get the current date and time. Use this when the user asks about the current time, date, day of week, or anything time-related.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            'IANA timezone identifier (e.g. "Asia/Ho_Chi_Minh", "America/New_York", "Europe/London"). Defaults to UTC if not provided.',
        },
      },
    },
  },
  (args) => {
    try {
      const timezone = (args.timezone as string) || "UTC";
      const now = new Date();
      const formatted = now.toLocaleString("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZoneName: "short",
      });
      return {
        result: JSON.stringify({
          datetime: formatted,
          iso: now.toISOString(),
          timezone,
          unix: Math.floor(now.getTime() / 1000),
        }),
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { result: "", error: `Failed to get time: ${msg}` };
    }
  }
);

// --- get_weather (placeholder — returns instruction to use web search) ---
registerFunction(
  {
    name: "get_weather",
    description:
      "Get the current weather for a location. Use this when the user asks about weather conditions, temperature, or forecasts.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: 'City name or location (e.g. "Ho Chi Minh City", "Tokyo", "New York")',
        },
      },
      required: ["location"],
    },
  },
  (args) => {
    const location = (args.location as string) || "unknown";
    // Instructs model to use web search for real-time weather data
    return {
      result: JSON.stringify({
        note: `Weather data for "${location}" requires real-time web access. Please use Google Search to find current weather conditions.`,
        suggestion: `Search: "weather in ${location} today"`,
      }),
    };
  }
);

// --- calculate ---
registerFunction(
  {
    name: "calculate",
    description:
      "Perform basic mathematical calculations. Use for arithmetic, unit conversions, or percentage calculations.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            'Mathematical expression to evaluate (e.g. "2 + 2", "sqrt(144)", "15% of 200")',
        },
      },
      required: ["expression"],
    },
  },
  (args) => {
    const expression = (args.expression as string) || "";
    try {
      // Sanitize: only allow math characters, numbers, and common functions
      const sanitized = expression.replace(/[^0-9+\-*/().%^, sqrtloglnabsceipowminmaxround]/gi, "");
      if (!sanitized) {
        return { result: "", error: "Invalid expression" };
      }

      // Simple math eval using Function constructor (safe: server-side, no user code exec)
      // Replace common math functions
      const prepared = sanitized
        .replace(/sqrt/gi, "Math.sqrt")
        .replace(/log/gi, "Math.log10")
        .replace(/ln/gi, "Math.log")
        .replace(/abs/gi, "Math.abs")
        .replace(/ceil/gi, "Math.ceil")
        .replace(/pow/gi, "Math.pow")
        .replace(/min/gi, "Math.min")
        .replace(/max/gi, "Math.max")
        .replace(/round/gi, "Math.round")
        .replace(/pi/gi, "Math.PI")
        .replace(/e(?![a-z])/gi, "Math.E")
        .replace(/\^/g, "**");

      const result = new Function(`"use strict"; return (${prepared})`)();

      return {
        result: JSON.stringify({
          expression,
          result: typeof result === "number" ? result : String(result),
        }),
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Calculation error";
      return { result: "", error: `Failed to calculate "${expression}": ${msg}` };
    }
  }
);
