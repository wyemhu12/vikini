// Standardized API response helpers
// Provides consistent response format across all API routes

import { NextResponse } from "next/server";
import { HTTP_STATUS, type HttpStatus } from "./constants";
import { AppError } from "./errors";

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
      headers: { "Cache-Control": "no-store" }
    }
  );
}

/**
 * Error response
 */
export function error(
  message: string, 
  statusCode: HttpStatus = HTTP_STATUS.INTERNAL_SERVER_ERROR, 
  code: string = 'INTERNAL_ERROR'
): NextResponse<{ success: false; error: { message: string; code: string } }> {
  return NextResponse.json(
    { 
      success: false, 
      error: { 
        message, 
        code 
      } 
    },
    { 
      status: statusCode,
      headers: { 
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  );
}

/**
 * Create error response from AppError instance
 */
export function errorFromAppError(
  appError: AppError
): NextResponse<{ success: false; error: { message: string; code: string } }> {
  return error(
    appError.message,
    appError.statusCode as HttpStatus,
    appError.code
  );
}

/**
 * Rate limit error response with retry-after header
 */
export function rateLimitError(
  message: string = 'Rate limit exceeded', 
  retryAfterSeconds: number = 60
): NextResponse<{ success: false; error: { message: string; code: string; retryAfterSeconds: number } }> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds
      }
    },
    {
      status: HTTP_STATUS.RATE_LIMIT_EXCEEDED,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": String(retryAfterSeconds),
      }
    }
  );
}

