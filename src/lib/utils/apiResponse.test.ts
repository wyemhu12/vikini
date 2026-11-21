import { describe, it, expect, vi, afterEach } from "vitest";
import { success, error, errorFromAppError, rateLimitError } from "./apiResponse";
import { ValidationError, RateLimitError, ForbiddenError } from "./errors";

describe("apiResponse", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("success returns envelope with Cache-Control: no-store", async () => {
    const res = success({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: true, data: { ok: true } });
  });

  it("errorFromAppError does NOT double-sanitize AppError messages in production (TC-W1-07)", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = errorFromAppError(
      new ValidationError("Invalid email: a@b.com from Gemini at /api/test")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        message: "Invalid email: a@b.com from Gemini at /api/test",
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("errorFromAppError preserves Retry-After header and retryAfterSeconds for RateLimitError", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = errorFromAppError(new RateLimitError("Slow down", 45));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        message: "Slow down",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: 45,
      },
    });
  });

  it("error() prevents metadata from overwriting canonical message or code fields", async () => {
    const res = error("Original error", 400, "CUSTOM_CODE", {
      message: "hijack",
      code: "EVIL",
      extra: 123,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        extra: 123,
        message: "Original error",
        code: "CUSTOM_CODE",
      },
    });
  });

  it("errorFromAppError handles ForbiddenError with 403 status", async () => {
    const res = errorFromAppError(new ForbiddenError("Access denied"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: { message: "Access denied", code: "FORBIDDEN" },
    });
  });

  it("rateLimitError returns 429 with Retry-After header", async () => {
    const res = rateLimitError("Too many", 30);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});
