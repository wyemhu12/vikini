import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/features/auth/requireApprovedUser", () => ({
  requireApprovedUser: vi.fn(),
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: vi.fn(),
}));

const mockGenerateContent = vi.fn();

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => ({
    models: {
      generateContent: mockGenerateContent,
    },
  }),
}));

import { POST } from "./route";
import { requireApprovedUser } from "@/lib/features/auth/requireApprovedUser";
import { consumeRateLimit } from "@/lib/core/rateLimit";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/prompt-suggest", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/prompt-suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApprovedUser).mockResolvedValue({
      userId: "user-123",
      rank: "basic",
    });
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetInMs: 60000,
      retryAfterSeconds: 60,
      backend: "memory",
    });
  });

  it("TC-PS-01: calls gemini-3.5-flash-lite and returns parsed suggestions on valid input", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "a\nb\nc\nd",
    });

    const res = await POST(createRequest({ partialPrompt: "a cat on a" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledOnce();
    expect(mockGenerateContent.mock.calls[0][0].model).toBe("gemini-3.5-flash-lite");
    expect(json.data.suggestions).toEqual(["a", "b", "c", "d"]);
  });

  it("TC-PS-02: returns 400 when partialPrompt is shorter than 5 characters", async () => {
    const res = await POST(createRequest({ partialPrompt: "abc" }));

    expect(res.status).toBe(400);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("TC-PS-03: returns 429 when rate limit is exceeded", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 20,
      remaining: 0,
      resetInMs: 60000,
      retryAfterSeconds: 60,
      backend: "memory",
    });

    const res = await POST(createRequest({ partialPrompt: "a cat on a" }));

    expect(res.status).toBe(429);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("TC-PS-04: returns 500 with generic message when Gemini call fails", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("upstream"));

    const res = await POST(createRequest({ partialPrompt: "a cat on a" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.message).toBe("Failed to generate suggestions");
  });
});
