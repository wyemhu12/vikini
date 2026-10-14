import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  authMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  checkDailyMessageLimitMock: vi.fn(),
  incrementDailyMessageCountMock: vi.fn(),
  assertModelAllowedForUserMock: vi.fn(),
  verifyOwnershipMock: vi.fn(),
  runNovelcrafterStreamMock: vi.fn(),
}));

vi.mock("@/lib/features/auth/auth", () => ({
  auth: hoisted.authMock,
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: hoisted.consumeRateLimitMock,
}));

vi.mock("@/lib/core/limits", () => ({
  checkDailyMessageLimit: hoisted.checkDailyMessageLimitMock,
  incrementDailyMessageCount: hoisted.incrementDailyMessageCountMock,
  assertModelAllowedForUser: hoisted.assertModelAllowedForUserMock,
}));

vi.mock("@/lib/features/novelcrafter/storyPersistence.server", () => ({
  verifyNovelcrafterConversationOwnership: hoisted.verifyOwnershipMock,
}));

vi.mock("@/lib/features/novelcrafter/novelcrafterStreamRunner.server", () => ({
  runNovelcrafterStream: hoisted.runNovelcrafterStreamMock,
}));

import { ForbiddenError } from "@/lib/utils/errors";
import { createDefaultStoryState } from "@/lib/features/novelcrafter/types";
import { POST } from "./route";

const VALID_CONVO_ID = "123e4567-e89b-12d3-a456-426614174000";

function buildValidPayload(overrides: Record<string, unknown> = {}) {
  const defaultState = createDefaultStoryState();
  return {
    conversationId: VALID_CONVO_ID,
    model: "gemini-2.5-flash",
    feature: "write",
    routing: defaultState.routing,
    storyBible: defaultState.storyBible,
    chapterTitle: "Chapter 1",
    chapterScenes: "Beat 1",
    chapterProse: "Once upon a time...",
    ...overrides,
  };
}

describe("POST /api/novelcrafter/stream integration tests (TC-07)", () => {
  beforeEach(() => {
    hoisted.authMock.mockReset();
    hoisted.consumeRateLimitMock.mockReset();
    hoisted.checkDailyMessageLimitMock.mockReset();
    hoisted.incrementDailyMessageCountMock.mockReset();
    hoisted.assertModelAllowedForUserMock.mockReset();
    hoisted.verifyOwnershipMock.mockReset();
    hoisted.runNovelcrafterStreamMock.mockReset();

    hoisted.authMock.mockResolvedValue({
      user: { email: "writer@vikini.net" },
    });
    hoisted.checkDailyMessageLimitMock.mockResolvedValue({
      count: 2,
      limit: 100,
      remaining: 98,
      canSend: true,
      rank: "basic",
    });
    hoisted.consumeRateLimitMock.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    hoisted.assertModelAllowedForUserMock.mockResolvedValue(undefined);
    hoisted.verifyOwnershipMock.mockResolvedValue({
      id: VALID_CONVO_ID,
      userId: "writer@vikini.net",
      model: "vikini-novelcrafter",
    });
    hoisted.runNovelcrafterStreamMock.mockReturnValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: done\ndata: {}\n\n"));
          controller.close();
        },
      })
    );
  });

  it("returns 401 UNAUTHORIZED when user is not logged in", async () => {
    hoisted.authMock.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/novelcrafter/stream", {
      method: "POST",
      body: JSON.stringify(buildValidPayload()),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 ACCESS_PENDING when user rank is not_whitelisted", async () => {
    hoisted.checkDailyMessageLimitMock.mockResolvedValueOnce({
      count: 0,
      limit: 0,
      remaining: 0,
      canSend: false,
      rank: "not_whitelisted",
    });
    const req = new NextRequest("http://localhost/api/novelcrafter/stream", {
      method: "POST",
      body: JSON.stringify(buildValidPayload()),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("ACCESS_PENDING");
  });

  it("returns 429 DAILY_LIMIT_EXCEEDED when daily quota is exhausted", async () => {
    hoisted.checkDailyMessageLimitMock.mockResolvedValueOnce({
      count: 20,
      limit: 20,
      remaining: 0,
      canSend: false,
      rank: "basic",
    });
    const req = new NextRequest("http://localhost/api/novelcrafter/stream", {
      method: "POST",
      body: JSON.stringify(buildValidPayload()),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("DAILY_LIMIT_EXCEEDED");
  });

  it("returns 400 VALIDATION_ERROR when feature='rewrite' is missing selectedText or model is vikini-novelcrafter", async () => {
    const reqMissingSelection = new NextRequest("http://localhost/api/novelcrafter/stream", {
      method: "POST",
      body: JSON.stringify(buildValidPayload({ feature: "rewrite", selectedText: "   " })),
    });
    const res1 = await POST(reqMissingSelection);
    expect(res1.status).toBe(400);

    const reqPseudoModel = new NextRequest("http://localhost/api/novelcrafter/stream", {
      method: "POST",
      body: JSON.stringify(buildValidPayload({ model: "vikini-novelcrafter" })),
    });
    const res2 = await POST(reqPseudoModel);
    expect(res2.status).toBe(400);
  });

  it("returns 403 FORBIDDEN when basic user requests a Pro model", async () => {
    hoisted.assertModelAllowedForUserMock.mockRejectedValueOnce(
      new ForbiddenError("Model not allowed for rank basic")
    );
    const req = new NextRequest("http://localhost/api/novelcrafter/stream", {
      method: "POST",
      body: JSON.stringify(buildValidPayload({ model: "claude-sonnet-4.5" })),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("streams text/event-stream and increments daily message count on valid request", async () => {
    const req = new NextRequest("http://localhost/api/novelcrafter/stream", {
      method: "POST",
      body: JSON.stringify(buildValidPayload()),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(hoisted.incrementDailyMessageCountMock).toHaveBeenCalledWith("writer@vikini.net");
  });
});
