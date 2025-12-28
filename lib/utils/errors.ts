// Custom error classes for better error handling
// Extends standard Error with additional context

/**
 * Base application error class
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
    
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
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  readonly resource: string;

  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(message: string = 'Rate limit exceeded', retryAfterSeconds: number = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  readonly originalError: Error | null;

  constructor(message: string = 'Database error', originalError: Error | null = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * External service error (502/503)
 */
export class ExternalServiceError extends AppError {
  readonly service: string;

  constructor(service: string, message: string = 'External service error', statusCode: number = 502) {
    super(`${service}: ${message}`, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
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
export function sanitizeError(error: unknown, isProduction: boolean = process.env.NODE_ENV === 'production'): string {
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
    
    // Hide environment variable names
    const envVarPatterns = [
      /GEMINI_API_KEY/gi,
      /GOOGLE_API_KEY/gi,
      /SUPABASE_SERVICE_ROLE_KEY/gi,
      /NEXTAUTH_SECRET/gi,
      /DATA_ENCRYPTION_KEY/gi,
      /GOOGLE_CLIENT_SECRET/gi,
      /UPSTASH_REDIS_REST_TOKEN/gi,
    ];
    
    let sanitized = message;
    for (const pattern of envVarPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    // Hide database schema information
    sanitized = sanitized.replace(/from\s+["']?(\w+)["']?/gi, 'from [table]');
    sanitized = sanitized.replace(/table\s+["']?(\w+)["']?/gi, 'table [table]');
    sanitized = sanitized.replace(/column\s+["']?(\w+)["']?/gi, 'column [column]');
    
    // Hide file paths
    sanitized = sanitized.replace(/\/[^\s]+/g, '/[path]');
    
    // If message was heavily sanitized, return generic message
    if (sanitized !== message && sanitized.length < message.length * 0.5) {
      return 'An error occurred. Please try again later.';
    }
    
    return sanitized;
  }

  // Generic error for unknown types
  return 'An error occurred. Please try again later.';
}

