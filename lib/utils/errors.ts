// Custom error classes for better error handling
// Extends standard Error with additional context

/**
 * Base application error class
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";

    // Maintain proper stack trace (only in Node.js environment)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

/**
 * Authentication error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  readonly resource: string;

  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
    this.resource = resource;
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(message: string = "Rate limit exceeded", retryAfterSeconds: number = 60) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  readonly originalError: Error | null;

  constructor(message: string = "Database error", originalError: Error | null = null) {
    super(message, 500, "DATABASE_ERROR");
    this.name = "DatabaseError";
    this.originalError = originalError;
  }
}

/**
 * External service error (502/503)
 */
export class ExternalServiceError extends AppError {
  readonly service: string;

  constructor(
    service: string,
    message: string = "External service error",
    statusCode: number = 502
  ) {
    super(`${service}: ${message}`, statusCode, "EXTERNAL_SERVICE_ERROR");
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

/**
 * Sanitizes error messages for production to prevent information leakage
 *
 * @param error - The error to sanitize
 * @param isProduction - Whether we're in production mode
 * @returns Sanitized error message
 */
export function sanitizeError(
  error: unknown,
  isProduction: boolean = process.env.NODE_ENV === "production"
): string {
  // In development, return full error details
  if (!isProduction) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // In production, sanitize sensitive information
  if (error instanceof AppError) {
    // Use AppError's user-friendly message (already sanitized)
    return error.message;
  }

  if (error instanceof Error) {
    const message = error.message;

    // Hide environment variable names and values
    const envVarPatterns = [
      /GEMINI_API_KEY/gi,
      /GOOGLE_API_KEY/gi,
      /SUPABASE_SERVICE_ROLE_KEY/gi,
      /SUPABASE_ANON_KEY/gi,
      /NEXTAUTH_SECRET/gi,
      /DATA_ENCRYPTION_KEY/gi,
      /GOOGLE_CLIENT_SECRET/gi,
      /UPSTASH_REDIS_REST_TOKEN/gi,
      /UPSTASH_REDIS_REST_URL/gi,
      /DATABASE_URL/gi,
      /POSTGRES_URL/gi,
      /[A-Z_]+_KEY\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, // Generic API key patterns
      /[A-Z_]+_SECRET\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, // Generic secret patterns
      /[A-Z_]+_TOKEN\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, // Generic token patterns
    ];

    let sanitized = message;
    for (const pattern of envVarPatterns) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }

    // Hide connection strings (before other sanitizations)
    sanitized = sanitized.replace(/postgres:\/\/[^\s]+/gi, "postgres://[credentials]");
    sanitized = sanitized.replace(/https?:\/\/[^\s]+@[^\s]+/gi, "[url-with-auth]");

    // Hide database schema information
    sanitized = sanitized.replace(/from\s+["']?(\w+)["']?/gi, "from [table]");
    sanitized = sanitized.replace(/table\s+["']?(\w+)["']?/gi, "table [table]");
    sanitized = sanitized.replace(/column\s+["']?(\w+)["']?/gi, "column [column]");
    sanitized = sanitized.replace(/insert\s+into\s+["']?(\w+)["']?/gi, "insert into [table]");
    sanitized = sanitized.replace(/update\s+["']?(\w+)["']?/gi, "update [table]");
    sanitized = sanitized.replace(/delete\s+from\s+["']?(\w+)["']?/gi, "delete from [table]");
    sanitized = sanitized.replace(
      /select\s+.*\s+from\s+["']?(\w+)["']?/gi,
      "select ... from [table]"
    );

    // Hide file paths (Windows and Unix)
    sanitized = sanitized.replace(/[A-Z]:\\[^\s]+/gi, "[path]");
    sanitized = sanitized.replace(/\/[^\s]+/g, "/[path]");
    sanitized = sanitized.replace(/\.\.\/[^\s]+/g, "[path]");

    // Hide email addresses (but keep domain for debugging)
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      "[email]@[domain]"
    );

    // Hide UUIDs and IDs that might leak information
    sanitized = sanitized.replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "[uuid]"
    );
    sanitized = sanitized.replace(/\b[a-z0-9]{20,}\b/gi, "[id]"); // Long alphanumeric strings (likely IDs)

    // Hide IP addresses
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[ip]");

    // Hide stack traces in message (if present)
    sanitized = sanitized.replace(/at\s+[^\n]+/g, "at [stack]");
    sanitized = sanitized.replace(/Error:\s*[^\n]+/g, "Error: [error]");

    // Count redacted items
    const redactedCount = (
      sanitized.match(
        /\[REDACTED\]|\[path\]|\[email\]|\[uuid\]|\[id\]|\[ip\]|\[credentials\]|\[table\]|\[column\]|\[stack\]/g
      ) || []
    ).length;

    // If message contains too many redacted items, return generic
    if (redactedCount > 3) {
      return "An error occurred. Please try again later.";
    }

    // If message was heavily sanitized (length reduced significantly), return generic message
    const sanitizationRatio = sanitized.length / (message.length || 1);
    if (sanitizationRatio < 0.5 && sanitized !== message) {
      return "An error occurred. Please try again later.";
    }

    return sanitized;
  }

  // Generic error for unknown types
  return "An error occurred. Please try again later.";
}
