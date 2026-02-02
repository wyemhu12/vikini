// /lib/utils/performance.ts
// Performance monitoring utilities for tracking API response times and slow queries

import { logger } from "./logger";

const perfLogger = logger.withContext("performance");

/**
 * Performance thresholds (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  SLOW_API: 1000, // 1 second
  SLOW_QUERY: 500, // 500ms
  VERY_SLOW_API: 5000, // 5 seconds
  VERY_SLOW_QUERY: 2000, // 2 seconds
} as const;

interface PerformanceMetrics {
  duration: number;
  endpoint: string;
  method: string;
  userId?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

interface QueryMetrics {
  duration: number;
  query: string;
  table?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track API endpoint performance
 */
export class PerformanceMonitor {
  private startTime: number;
  private endpoint: string;
  private method: string;
  public userId?: string;
  private metadata: Record<string, unknown>;

  constructor(
    endpoint: string,
    method: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ) {
    this.startTime = performance.now();
    this.endpoint = endpoint;
    this.method = method;
    this.userId = userId;
    this.metadata = metadata || {};
  }

  /**
   * Record completion of the request
   */
  end(statusCode?: number, additionalMetadata?: Record<string, unknown>): PerformanceMetrics {
    const duration = performance.now() - this.startTime;
    const metrics: PerformanceMetrics = {
      duration,
      endpoint: this.endpoint,
      method: this.method,
      userId: this.userId,
      statusCode,
      metadata: {
        ...this.metadata,
        ...additionalMetadata,
      },
    };

    this.logMetrics(metrics);
    return metrics;
  }

  /**
   * Log performance metrics based on thresholds
   */
  private logMetrics(metrics: PerformanceMetrics): void {
    const { duration, endpoint, method, statusCode } = metrics;

    if (duration >= PERFORMANCE_THRESHOLDS.VERY_SLOW_API) {
      perfLogger.error("Very slow API request", {
        endpoint,
        method,
        duration: `${duration.toFixed(2)}ms`,
        statusCode,
        userId: this.userId,
        ...metrics.metadata,
      });
    } else if (duration >= PERFORMANCE_THRESHOLDS.SLOW_API) {
      perfLogger.warn("Slow API request", {
        endpoint,
        method,
        duration: `${duration.toFixed(2)}ms`,
        statusCode,
        userId: this.userId,
        ...metrics.metadata,
      });
    } else {
      perfLogger.debug("API request completed", {
        endpoint,
        method,
        duration: `${duration.toFixed(2)}ms`,
        statusCode,
      });
    }
  }
}

/**
 * Track database query performance
 */
export function trackQuery(
  query: string,
  duration: number,
  table?: string,
  operation?: string,
  metadata?: Record<string, unknown>
): QueryMetrics {
  const metrics: QueryMetrics = {
    duration,
    query: query.length > 200 ? query.substring(0, 200) + "..." : query,
    table,
    operation,
    metadata,
  };

  if (duration >= PERFORMANCE_THRESHOLDS.VERY_SLOW_QUERY) {
    perfLogger.error("Very slow database query", {
      table,
      operation,
      duration: `${duration.toFixed(2)}ms`,
      query: metrics.query,
      ...metadata,
    });
  } else if (duration >= PERFORMANCE_THRESHOLDS.SLOW_QUERY) {
    perfLogger.warn("Slow database query", {
      table,
      operation,
      duration: `${duration.toFixed(2)}ms`,
      query: metrics.query,
      ...metadata,
    });
  } else {
    perfLogger.debug("Database query completed", {
      table,
      operation,
      duration: `${duration.toFixed(2)}ms`,
    });
  }

  return metrics;
}

/**
 * Wrap a function with performance tracking
 */
export async function withPerformanceTracking<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    if (duration >= PERFORMANCE_THRESHOLDS.SLOW_API) {
      perfLogger.warn(`Slow operation: ${name}`, {
        duration: `${duration.toFixed(2)}ms`,
        ...metadata,
      });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    perfLogger.error(`Operation failed: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      error,
      ...metadata,
    });
    throw error;
  }
}

/**
 * Create a performance monitor for an API route
 */
export function createPerformanceMonitor(
  endpoint: string,
  method: string,
  userId?: string,
  metadata?: Record<string, unknown>
): PerformanceMonitor {
  return new PerformanceMonitor(endpoint, method, userId, metadata);
}

/**
 * Get performance summary (useful for health checks or monitoring endpoints)
 */
export function getPerformanceSummary(): {
  thresholds: typeof PERFORMANCE_THRESHOLDS;
  timestamp: number;
} {
  return {
    thresholds: PERFORMANCE_THRESHOLDS,
    timestamp: Date.now(),
  };
}
