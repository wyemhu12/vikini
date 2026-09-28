import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/chat/messages", () => ({
  upsertMessage: vi.fn(),
}));

import { auth } from "@/lib/features/auth/auth";
import { upsertMessage } from "@/lib/features/chat/messages";

const TEST_USER_EMAIL = "test@example.com";

function mockAuthenticated() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: TEST_USER_EMAIL },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

describe("POST /api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockUnauthenticated();

    const req = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockAuthenticated();

    const req = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: "not-json{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when validation fails (e.g. missing clientMessageId or invalid uuid)", async () => {
    mockAuthenticated();

    const req = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "not-a-uuid",
        role: "assistant",
        content: "Hello",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with saved message on valid request", async () => {
    mockAuthenticated();

    vi.mocked(upsertMessage).mockResolvedValue({
      message: {
        id: "msg-123",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        role: "assistant",
        content: "Partial response",
        createdAt: "2026-09-28T00:00:00Z",
        meta: { isPartial: true, aborted: true, clientMessageId: "client-abc" },
      },
      alreadyComplete: false,
    });

    const req = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        role: "assistant",
        content: "Partial response",
        clientMessageId: "client-abc",
        meta: { isPartial: true, aborted: true },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.alreadyComplete).toBe(false);
    expect(json.data.message.id).toBe("msg-123");
    expect(upsertMessage).toHaveBeenCalledWith(
      "test@example.com",
      "550e8400-e29b-41d4-a716-446655440000",
      "assistant",
      "Partial response",
      expect.objectContaining({ isPartial: true, aborted: true, clientMessageId: "client-abc" }),
      "client-abc"
    );
  });

  it("returns alreadyComplete true when remote message was already completed", async () => {
    mockAuthenticated();

    vi.mocked(upsertMessage).mockResolvedValue({
      message: {
        id: "msg-123",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        role: "assistant",
        content: "Full completed response",
        createdAt: "2026-09-28T00:00:00Z",
        meta: { clientMessageId: "client-abc" },
      },
      alreadyComplete: true,
    });

    const req = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        role: "assistant",
        content: "Partial response",
        clientMessageId: "client-abc",
        meta: { isPartial: true, aborted: true },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.alreadyComplete).toBe(true);
  });
});
