import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  authMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  assertModelAllowedForUserMock: vi.fn(),
  getStoryStateMock: vi.fn(),
  saveStoryStateMock: vi.fn(),
}));

vi.mock("@/lib/features/auth/auth", () => ({
  auth: hoisted.authMock,
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: hoisted.consumeRateLimitMock,
}));

vi.mock("@/lib/core/limits", () => ({
  assertModelAllowedForUser: hoisted.assertModelAllowedForUserMock,
}));

vi.mock("@/lib/features/novelcrafter/storyPersistence.server", () => ({
  getStoryState: hoisted.getStoryStateMock,
  saveStoryState: hoisted.saveStoryStateMock,
}));

import { ForbiddenError } from "@/lib/utils/errors";
import { createDefaultStoryState } from "@/lib/features/novelcrafter/types";
import { GET, PUT } from "./route";

const VALID_CONVO_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("/api/novelcrafter/state route integration tests (TC-07)", () => {
  beforeEach(() => {
    hoisted.authMock.mockReset();
    hoisted.consumeRateLimitMock.mockReset();
    hoisted.assertModelAllowedForUserMock.mockReset();
    hoisted.getStoryStateMock.mockReset();
    hoisted.saveStoryStateMock.mockReset();

    hoisted.authMock.mockResolvedValue({
      user: { email: "writer@vikini.net" },
    });
    hoisted.consumeRateLimitMock.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    hoisted.assertModelAllowedForUserMock.mockResolvedValue(undefined);
  });

  describe("GET /api/novelcrafter/state", () => {
    it("returns 401 when unauthenticated", async () => {
      hoisted.authMock.mockResolvedValueOnce(null);
      const req = new NextRequest(
        `http://localhost/api/novelcrafter/state?conversationId=${VALID_CONVO_ID}`
      );
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 VALIDATION_ERROR when conversationId is not a valid UUID", async () => {
      const req = new NextRequest(
        "http://localhost/api/novelcrafter/state?conversationId=invalid-id"
      );
      const res = await GET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 200 with decrypted story state for valid request", async () => {
      const mockState = createDefaultStoryState("Chapter 1");
      hoisted.getStoryStateMock.mockResolvedValueOnce(mockState);

      const req = new NextRequest(
        `http://localhost/api/novelcrafter/state?conversationId=${VALID_CONVO_ID}`
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.state.chapters[0].title).toBe("Chapter 1");
    });
  });

  describe("PUT /api/novelcrafter/state", () => {
    it("rejects pseudo-model vikini-novelcrafter as selectedModel with 400 VALIDATION_ERROR", async () => {
      const badState = {
        ...createDefaultStoryState(),
        selectedModel: "vikini-novelcrafter",
      };
      const req = new NextRequest("http://localhost/api/novelcrafter/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: VALID_CONVO_ID,
          state: badState,
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 403 FORBIDDEN when basic user selects a rank-restricted Pro model", async () => {
      hoisted.assertModelAllowedForUserMock.mockRejectedValueOnce(
        new ForbiddenError("Model not allowed for rank basic")
      );
      const stateWithPro = {
        ...createDefaultStoryState(),
        selectedModel: "gemini-4-argon",
      };
      const req = new NextRequest("http://localhost/api/novelcrafter/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: VALID_CONVO_ID,
          state: stateWithPro,
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
    });

    it("saves and returns updated state on valid PUT", async () => {
      const validState = createDefaultStoryState("Chương 1");
      hoisted.saveStoryStateMock.mockResolvedValueOnce({
        ...validState,
        version: 2,
      });

      const req = new NextRequest("http://localhost/api/novelcrafter/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: VALID_CONVO_ID,
          state: validState,
        }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.state.version).toBe(2);
    });
  });
});
