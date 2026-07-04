// /app/api/messages/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/chat/messages", () => ({
  deleteMessage: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports - AFTER mocks are set up
// ---------------------------------------------------------------------------

import { DELETE } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { deleteMessage } from "@/lib/features/chat/messages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = "test@example.com";
const TEST_MESSAGE_ID = "msg-abc-123";

function createRequest(method: string, url: string): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAuthenticated() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: TEST_USER_EMAIL },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/messages/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== DELETE ========================
  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("DELETE", `/api/messages/${TEST_MESSAGE_ID}`);
      const res = await DELETE(req, createParams(TEST_MESSAGE_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should delete a message successfully", async () => {
      mockAuthenticated();
      vi.mocked(deleteMessage).mockResolvedValue(undefined as never);

      const req = createRequest("DELETE", `/api/messages/${TEST_MESSAGE_ID}`);
      const res = await DELETE(req, createParams(TEST_MESSAGE_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(deleteMessage).toHaveBeenCalledWith(TEST_USER_EMAIL, TEST_MESSAGE_ID);
    });

    it("should return 400 when id param is empty string", async () => {
      mockAuthenticated();

      const req = createRequest("DELETE", "/api/messages/");
      const res = await DELETE(req, createParams(""));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when deleteMessage throws unexpected error", async () => {
      mockAuthenticated();
      vi.mocked(deleteMessage).mockRejectedValue(new Error("DB connection lost"));

      const req = createRequest("DELETE", `/api/messages/${TEST_MESSAGE_ID}`);
      const res = await DELETE(req, createParams(TEST_MESSAGE_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
