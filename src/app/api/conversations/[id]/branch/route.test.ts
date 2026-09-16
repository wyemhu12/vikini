// /app/api/conversations/[id]/branch/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/chat/conversations", () => ({
  branchConversation: vi.fn(),
}));

vi.mock("@/lib/utils/performance", () => ({
  createPerformanceMonitor: vi.fn(() => ({ end: vi.fn(), userId: "" })),
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
// Imports
// ---------------------------------------------------------------------------

import { POST } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { branchConversation, type Conversation } from "@/lib/features/chat/conversations";
import { NotFoundError, ForbiddenError } from "@/lib/utils/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/conversations/11111111-1111-4111-8111-111111111111/branch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const mockValidUser = {
  user: { email: "test@example.com" },
};

function mockAuthUser() {
  vi.mocked(auth).mockResolvedValue(mockValidUser as unknown as Awaited<ReturnType<typeof auth>>);
}

const VALID_CONVO_ID = "11111111-1111-4111-8111-111111111111";
const VALID_MSG_ID = "22222222-2222-4222-8222-222222222222";

describe("POST /api/conversations/[id]/branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);

    const req = makePostRequest({ messageId: VALID_MSG_ID });
    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_CONVO_ID }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.message).toBe("Unauthorized");
  });

  it("returns 400 when conversation ID is invalid UUID", async () => {
    mockAuthUser();

    const req = makePostRequest({ messageId: VALID_MSG_ID });
    const res = await POST(req, {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain("Invalid conversation ID format");
  });

  it("returns 400 when messageId is missing or invalid UUID", async () => {
    mockAuthUser();

    const req = makePostRequest({ messageId: "not-a-uuid" });
    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_CONVO_ID }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 when source conversation or message is not found", async () => {
    mockAuthUser();
    vi.mocked(branchConversation).mockRejectedValue(new NotFoundError("Conversation"));

    const req = makePostRequest({ messageId: VALID_MSG_ID });
    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_CONVO_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 403 when access is denied", async () => {
    mockAuthUser();
    vi.mocked(branchConversation).mockRejectedValue(new ForbiddenError("Access denied"));

    const req = makePostRequest({ messageId: VALID_MSG_ID });
    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_CONVO_ID }),
    });

    expect(res.status).toBe(403);
  });

  it("successfully branches and returns new conversation", async () => {
    mockAuthUser();
    const mockNewConvo: Conversation = {
      id: "33333333-3333-4333-8333-333333333333",
      userId: "test@example.com",
      title: "[Nhánh] Test Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessagePreview: null,
      gemId: null,
      model: "gemini-2.5-flash",
      projectId: null,
      parentConversationId: VALID_CONVO_ID,
      forkedFromMessageId: VALID_MSG_ID,
      gem: null,
      persona: null,
    };
    vi.mocked(branchConversation).mockResolvedValue(mockNewConvo);

    const req = makePostRequest({ messageId: VALID_MSG_ID, titlePrefix: "[Nhánh]" });
    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_CONVO_ID }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.conversation.id).toBe("33333333-3333-4333-8333-333333333333");
    expect(data.data.conversationId).toBe("33333333-3333-4333-8333-333333333333");
    expect(branchConversation).toHaveBeenCalledWith(
      "test@example.com",
      VALID_CONVO_ID,
      VALID_MSG_ID,
      "[Nhánh]"
    );
  });
});
