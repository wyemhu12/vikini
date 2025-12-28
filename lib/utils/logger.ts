// Centralized logging utility
// Provides consistent logging interface with log levels

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

type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toUpperCase() as keyof typeof LOG_LEVELS;
  return LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
}

const currentLogLevel = getLogLevel();
const isDevelopment = process.env.NODE_ENV === 'development';

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
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logs - shown in all environments except when LOG_LEVEL=error
   */
  info: (...args: unknown[]): void => {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Warning logs - shown in all environments
   */
  warn: (...args: unknown[]): void => {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error logs - always shown
   */
  error: (...args: unknown[]): void => {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', ...args);
      
      // TODO: In production, consider sending to error tracking service
      // e.g., Sentry, LogRocket, etc.
      // if (!isDevelopment) {
      //   errorTrackingService.captureException(...args);
      // }
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

