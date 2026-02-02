// Test file for errors.ts
import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  sanitizeError,
} from "./errors";

describe("Error Classes", () => {
  describe("AppError", () => {
    it("should create error with default values", () => {
      const error = new AppError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.name).toBe("AppError");
    });

    it("should create error with custom values", () => {
      const error = new AppError("Custom error", 400, "CUSTOM_CODE");

      expect(error.message).toBe("Custom error");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("CUSTOM_CODE");
    });
  });

  describe("ValidationError", () => {
    it("should create validation error with default message", () => {
      const error = new ValidationError();

      expect(error.message).toBe("Validation failed");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.name).toBe("ValidationError");
    });

    it("should create validation error with custom message", () => {
      const error = new ValidationError("Invalid input");

      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
    });
  });

  describe("UnauthorizedError", () => {
    it("should create unauthorized error", () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe("Unauthorized");
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("ForbiddenError", () => {
    it("should create forbidden error", () => {
      const error = new ForbiddenError();

      expect(error.message).toBe("Forbidden");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });
  });

  describe("NotFoundError", () => {
    it("should create not found error with default resource", () => {
      const error = new NotFoundError();

      expect(error.message).toBe("Resource not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.resource).toBe("Resource");
    });

    it("should create not found error with custom resource", () => {
      const error = new NotFoundError("Conversation");

      expect(error.message).toBe("Conversation not found");
      expect(error.resource).toBe("Conversation");
    });
  });

  describe("RateLimitError", () => {
    it("should create rate limit error with default values", () => {
      const error = new RateLimitError();

      expect(error.message).toBe("Rate limit exceeded");
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.retryAfterSeconds).toBe(60);
    });

    it("should create rate limit error with custom values", () => {
      const error = new RateLimitError("Too many requests", 120);

      expect(error.message).toBe("Too many requests");
      expect(error.retryAfterSeconds).toBe(120);
    });
  });

  describe("DatabaseError", () => {
    it("should create database error", () => {
      const originalError = new Error("DB connection failed");
      const error = new DatabaseError("Database error", originalError);

      expect(error.message).toBe("Database error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("DATABASE_ERROR");
      expect(error.originalError).toBe(originalError);
    });
  });

  describe("ExternalServiceError", () => {
    it("should create external service error", () => {
      const error = new ExternalServiceError("Gemini API", "Service unavailable");

      expect(error.message).toBe("Gemini API: Service unavailable");
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe("EXTERNAL_SERVICE_ERROR");
      expect(error.service).toBe("Gemini API");
    });
  });
});

describe("sanitizeError", () => {
  it("should return full error message in development", () => {
    const error = new Error("Database connection failed");
    const result = sanitizeError(error, false);

    expect(result).toBe("Database connection failed");
  });

  it("should sanitize AppError in production", () => {
    const error = new ValidationError("Invalid input");
    const result = sanitizeError(error, true);

    expect(result).toBe("Invalid input");
  });

  it("should sanitize environment variable names in production", () => {
    const error = new Error("GEMINI_API_KEY is missing");
    const result = sanitizeError(error, true);

    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("GEMINI_API_KEY");
  });

  it("should sanitize environment variable values in production", () => {
    const error = new Error("API_KEY: sk-1234567890abcdef. Connection failed.");
    const result = sanitizeError(error, true);

    // Should sanitize the API key value
    expect(result).not.toContain("sk-1234567890abcdef");
    // May return generic if heavily sanitized, or contain [REDACTED]
    expect(
      result === "An error occurred. Please try again later." || result.includes("[REDACTED]")
    ).toBe(true);
  });

  it("should sanitize database table names", () => {
    const error = new Error("Error from users table");
    const result = sanitizeError(error, true);

    expect(result).toContain("[table]");
    expect(result).not.toContain("users");
  });

  it("should sanitize file paths", () => {
    const error = new Error("File not found: /home/user/project/src/file.ts");
    const result = sanitizeError(error, true);

    expect(result).toContain("[path]");
    expect(result).not.toContain("/home/user/project/src/file.ts");
  });

  it("should sanitize Windows file paths", () => {
    const error = new Error("File not found: C:\\Users\\project\\file.ts");
    const result = sanitizeError(error, true);

    expect(result).toContain("[path]");
    expect(result).not.toContain("C:\\Users\\project\\file.ts");
  });

  it("should sanitize email addresses", () => {
    const error = new Error("User admin@example.com not found");
    const result = sanitizeError(error, true);

    expect(result).toContain("[email]");
    expect(result).not.toContain("admin@example.com");
  });

  it("should sanitize UUIDs", () => {
    const error = new Error(
      "Conversation 123e4567-e89b-12d3-a456-426614174000 not found. Please try again."
    );
    const result = sanitizeError(error, true);

    // Should sanitize UUID
    expect(result).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    // May return generic if heavily sanitized, or contain [uuid]
    expect(
      result === "An error occurred. Please try again later." || result.includes("[uuid]")
    ).toBe(true);
  });

  it("should sanitize IP addresses", () => {
    const error = new Error("Connection failed to 192.168.1.1");
    const result = sanitizeError(error, true);

    expect(result).toContain("[ip]");
    expect(result).not.toContain("192.168.1.1");
  });

  it("should sanitize connection strings", () => {
    const error = new Error("Connection failed: postgres://user:pass@localhost:5432/db");
    const result = sanitizeError(error, true);

    // Should sanitize credentials - check that user:pass is not in result
    expect(result).not.toContain("user:pass");
    // Result should either be generic or sanitized (connection string pattern may match different parts)
    // The important thing is credentials are not exposed
    expect(
      result === "An error occurred. Please try again later." || !result.includes("user:pass")
    ).toBe(true);
  });

  it("should sanitize stack traces in message", () => {
    const error = new Error("Error occurred at function (file.js:10:5)");
    const result = sanitizeError(error, true);

    // Stack traces in message should be sanitized
    if (result.includes("at")) {
      expect(result).toContain("[stack]");
    }
    expect(result).not.toContain("file.js:10:5");
  });

  it("should return generic message when heavily sanitized", () => {
    const error = new Error("GEMINI_API_KEY: sk-123 from users table at /path/to/file.ts");
    const result = sanitizeError(error, true);

    // Should return generic message because too much was sanitized
    expect(result).toBe("An error occurred. Please try again later.");
  });

  it("should return generic message when too many redacted items", () => {
    const error = new Error(
      "Error with GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY and NEXTAUTH_SECRET and DATA_ENCRYPTION_KEY"
    );
    const result = sanitizeError(error, true);

    // Should return generic message because too many redacted items (>3)
    expect(result).toBe("An error occurred. Please try again later.");
  });

  it("should return generic message for unknown error types", () => {
    const result = sanitizeError("Unknown error", true);

    expect(result).toBe("An error occurred. Please try again later.");
  });

  it("should handle null and undefined errors", () => {
    expect(sanitizeError(null, true)).toBe("An error occurred. Please try again later.");
    expect(sanitizeError(undefined, true)).toBe("An error occurred. Please try again later.");
  });
});
