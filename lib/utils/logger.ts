// Centralized logging utility
// Provides consistent logging interface with log levels
/* eslint-disable no-console */

/**
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
} as const;

type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || "info").toUpperCase() as keyof typeof LOG_LEVELS;
  return LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
}

const currentLogLevel = getLogLevel();
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

/**
 * Error tracking callback type.
 * Set this to integrate with Sentry, LogRocket, or other error tracking services.
 *
 * @example
 * ```typescript
 * import * as Sentry from "@sentry/nextjs";
 * import { setErrorTracker } from "@/lib/utils/logger";
 *
 * setErrorTracker((error, context) => {
 *   Sentry.captureException(error, { extra: { context } });
 * });
 * ```
 */
export type ErrorTracker = (error: Error, context?: string) => void;

let errorTracker: ErrorTracker | null = null;

/**
 * Set the error tracking callback for production error reporting.
 * Call this once during app initialization to integrate with Sentry, etc.
 */
export function setErrorTracker(tracker: ErrorTracker | null): void {
  errorTracker = tracker;
}

/**
 * Get the current error tracker (for testing purposes).
 */
export function getErrorTracker(): ErrorTracker | null {
  return errorTracker;
}

/**
 * Logger interface
 */
export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  withContext?: (context: string) => Logger;
}

/**
 * Logger utility with log levels
 */
export const logger: Logger & { withContext: (context: string) => Logger } = {
  /**
   * Debug logs - only shown in development and when LOG_LEVEL=debug
   */
  debug: (...args: unknown[]): void => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG && isDevelopment) {
      console.log("[DEBUG]", ...args);
    }
  },

  /**
   * Info logs - shown in all environments except when LOG_LEVEL=error
   */
  info: (...args: unknown[]): void => {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log("[INFO]", ...args);
    }
  },

  /**
   * Warning logs - shown in all environments
   */
  warn: (...args: unknown[]): void => {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn("[WARN]", ...args);
    }
  },

  /**
   * Error logs - always shown and sent to error tracker in production
   */
  error: (...args: unknown[]): void => {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error("[ERROR]", ...args);

      // Send to error tracking service in production
      if (isProduction && errorTracker) {
        try {
          const firstArg = args[0];
          const error =
            firstArg instanceof Error
              ? firstArg
              : new Error(typeof firstArg === "string" ? firstArg : JSON.stringify(firstArg));

          // Include additional context from remaining args
          const context = args.length > 1 ? JSON.stringify(args.slice(1)) : undefined;
          errorTracker(error, context);
        } catch {
          // Silently fail to avoid infinite loops
        }
      }
    }
  },

  /**
   * Log with context (useful for API routes)
   */
  withContext: (context: string): Logger => ({
    debug: (...args: unknown[]) => logger.debug(`[${context}]`, ...args),
    info: (...args: unknown[]) => logger.info(`[${context}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[${context}]`, ...args),
    error: (...args: unknown[]) => logger.error(`[${context}]`, ...args),
  }),
};

/**
 * Utility to capture exceptions directly to error tracker.
 * Use this for caught errors that should be reported but not re-thrown.
 */
export function captureException(error: Error, context?: string): void {
  if (isProduction && errorTracker) {
    try {
      errorTracker(error, context);
    } catch {
      // Silently fail
    }
  }
  // Always log to console
  logger.error(context ? `[${context}]` : "", error);
}
