// /lib/features/chat/functions.ts
// Built-in function definitions for AI function calling
// These functions are executed server-side when the model calls them

/**
 * Available function declarations for Gemini Function Calling.
 * The model can invoke these to get real-time data.
 */
export const BUILT_IN_FUNCTIONS = [
  {
    name: "get_current_time",
    description:
      "Get the current date and time. Use this when the user asks about the current time, date, day of week, or anything time-related.",
    parameters: {
      type: "object" as const,
      properties: {
        timezone: {
          type: "string",
          description:
            'IANA timezone identifier (e.g. "Asia/Ho_Chi_Minh", "America/New_York", "Europe/London"). Defaults to UTC if not provided.',
        },
      },
    },
  },
] as const;

/**
 * Execute a function call from the model.
 * Returns the result as a string to be sent back to the model.
 */
export function executeFunctionCall(
  name: string,
  args: Record<string, unknown>
): { result: string; error?: string } {
  switch (name) {
    case "get_current_time": {
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

    default:
      return { result: "", error: `Unknown function: ${name}` };
  }
}
