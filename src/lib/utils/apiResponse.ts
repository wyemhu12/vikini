// Standardized API response helpers
// Provides consistent response format across all API routes

import { NextResponse } from "next/server";
import { HTTP_STATUS, type HttpStatus } from "./constants";
import { AppError, RateLimitError, sanitizeError } from "./errors";

/**
 * Success response
 */
export function success<T = unknown>(
  data: T,
  statusCode: HttpStatus = HTTP_STATUS.OK
): NextResponse<{ success: true; data: T }> {
  return NextResponse.json(
    { success: true, data },
    {
      status: statusCode,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

/**
 * Error response
 * Automatically sanitizes error messages in production
 */
export function error(
  message: string | unknown,
  statusCode: HttpStatus = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  code: string = "INTERNAL_ERROR",
  metadata?: Record<string, unknown>
): NextResponse<{
  success: false;
  error: { message: string; code: string } & Record<string, unknown>;
}> {
  // Sanitize error message in production
  const isProd = process.env.NODE_ENV === "production";
  const sanitizedMessage =
    typeof message === "string"
      ? sanitizeError(new Error(message), isProd)
      : sanitizeError(message, isProd);

  return NextResponse.json(
    {
      success: false,
      error: {
        ...(metadata || {}),
        message: sanitizedMessage,
        code,
      },
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}

/**
 * Create error response from AppError instance without double-sanitization.
 * Preserves Retry-After header for RateLimitError.
 */
export function errorFromAppError(
  appError: AppError
): NextResponse<{ success: false; error: { message: string; code: string } }> {
  const isProd = process.env.NODE_ENV === "production";
  const sanitizedMessage = sanitizeError(appError, isProd);

  if (appError instanceof RateLimitError) {
    return rateLimitError(sanitizedMessage, appError.retryAfterSeconds);
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        message: sanitizedMessage,
        code: appError.code,
      },
    },
    {
      status: appError.statusCode as HttpStatus,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}

/**
 * Rate limit error response with retry-after header
 */
export function rateLimitError(
  message: string = "Rate limit exceeded",
  retryAfterSeconds: number = 60
): NextResponse<{
  success: false;
  error: { message: string; code: string; retryAfterSeconds: number };
}> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds,
      },
    },
    {
      status: HTTP_STATUS.RATE_LIMIT_EXCEEDED,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
