// /app/api/conversations/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/chat/conversations", () => ({
  getUserConversations: vi.fn(),
  getConversation: vi.fn(),
  saveConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
  deleteConversation: vi.fn(),
  setConversationGem: vi.fn(),
  setConversationModel: vi.fn(),
  setConversationProject: vi.fn(),
}));

vi.mock("@/lib/features/chat/messages", () => ({
  getMessages: vi.fn(),
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
// Imports - AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GET, POST, PATCH, DELETE, PUT } from "./route";
import { auth } from "@/lib/features/auth/auth";
import {
  getUserConversations,
  getConversation,
  saveConversation,
  updateConversationTitle,
  deleteConversation,
} from "@/lib/features/chat/conversations";
import { getMessages } from "@/lib/features/chat/messages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = "test@example.com";
const TEST_UUID = "a1b2c3d4-e5f6-1234-a89b-abcdef123456";

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== GET ========================
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("GET", "/api/conversations");
      const res = await GET(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should list conversations for the authenticated user", async () => {
      mockAuthenticated();
      const mockConvos = [{ id: TEST_UUID, title: "Hello", userId: TEST_USER_EMAIL }];
      vi.mocked(getUserConversations).mockResolvedValue(mockConvos as never);

      const req = createRequest("GET", "/api/conversations");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.conversations).toEqual(mockConvos);
      expect(getUserConversations).toHaveBeenCalledWith(TEST_USER_EMAIL);
    });

    it("should return messages when id query param is a valid UUID", async () => {
      mockAuthenticated();
      vi.mocked(getConversation).mockResolvedValue({
        id: TEST_UUID,
        userId: TEST_USER_EMAIL,
      } as never);
      const mockMessages = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ];
      vi.mocked(getMessages).mockResolvedValue(mockMessages as never);

      const req = createRequest("GET", `/api/conversations?id=${TEST_UUID}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.messages).toBeDefined();
      expect(Array.isArray(json.data.messages)).toBe(true);
    });

    it("should return 400 for invalid UUID format", async () => {
      mockAuthenticated();

      const req = createRequest("GET", "/api/conversations?id=not-a-valid-uuid");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 404 when conversation is not found", async () => {
      mockAuthenticated();
      vi.mocked(getConversation).mockResolvedValue(null as never);

      const req = createRequest("GET", `/api/conversations?id=${TEST_UUID}`);
      const res = await GET(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 404 when conversation belongs to another user", async () => {
      mockAuthenticated();
      vi.mocked(getConversation).mockResolvedValue({
        id: TEST_UUID,
        userId: "other-user@example.com",
      } as never);

      const req = createRequest("GET", `/api/conversations?id=${TEST_UUID}`);
      const res = await GET(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== POST ========================
  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", "/api/conversations", {
        title: "New Chat",
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should create a conversation successfully", async () => {
      mockAuthenticated();
      const mockConvo = {
        id: TEST_UUID,
        title: "New Chat",
        userId: TEST_USER_EMAIL,
      };
      vi.mocked(saveConversation).mockResolvedValue(mockConvo as never);

      const req = createRequest("POST", "/api/conversations", {
        title: "New Chat",
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.conversation).toEqual(mockConvo);
      expect(saveConversation).toHaveBeenCalledWith(TEST_USER_EMAIL, {
        title: "New Chat",
        model: undefined,
        projectId: undefined,
      });
    });

    it("should create with default title when none provided", async () => {
      mockAuthenticated();
      const mockConvo = { id: TEST_UUID, userId: TEST_USER_EMAIL };
      vi.mocked(saveConversation).mockResolvedValue(mockConvo as never);

      const req = createRequest("POST", "/api/conversations", {});
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // saveConversation should have been called with a default title
      expect(saveConversation).toHaveBeenCalled();
    });
  });

  // ======================== PATCH ========================
  describe("PATCH", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("PATCH", "/api/conversations", {
        id: TEST_UUID,
        title: "Updated",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should update conversation title successfully", async () => {
      mockAuthenticated();
      const mockConvo = {
        id: TEST_UUID,
        title: "Updated Title",
        userId: TEST_USER_EMAIL,
      };
      vi.mocked(updateConversationTitle).mockResolvedValue(mockConvo as never);

      const req = createRequest("PATCH", "/api/conversations", {
        id: TEST_UUID,
        title: "Updated Title",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.conversation).toEqual(mockConvo);
      expect(updateConversationTitle).toHaveBeenCalledWith(
        TEST_USER_EMAIL,
        TEST_UUID,
        "Updated Title"
      );
    });

    it("should return 400 when id is missing", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/conversations", {
        title: "No ID provided",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when id is not a valid UUID", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/conversations", {
        id: "not-a-uuid",
        title: "Invalid",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== DELETE ========================
  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("DELETE", "/api/conversations", {
        id: TEST_UUID,
      });
      const res = await DELETE(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should delete a conversation successfully", async () => {
      mockAuthenticated();
      vi.mocked(deleteConversation).mockResolvedValue(undefined as never);

      const req = createRequest("DELETE", "/api/conversations", {
        id: TEST_UUID,
      });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.ok).toBe(true);
      expect(deleteConversation).toHaveBeenCalledWith(TEST_USER_EMAIL, TEST_UUID);
    });

    it("should return 400 when id is missing", async () => {
      mockAuthenticated();

      const req = createRequest("DELETE", "/api/conversations", {});
      const res = await DELETE(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when id is not a valid UUID", async () => {
      mockAuthenticated();

      const req = createRequest("DELETE", "/api/conversations", {
        id: "bad-id",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== PUT ========================
  describe("PUT", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("PUT", "/api/conversations", {
        id: TEST_UUID,
      });
      const res = await PUT(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return messages for a valid conversation", async () => {
      mockAuthenticated();
      vi.mocked(getConversation).mockResolvedValue({
        id: TEST_UUID,
        userId: TEST_USER_EMAIL,
      } as never);
      const mockMessages = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ];
      vi.mocked(getMessages).mockResolvedValue(mockMessages as never);

      const req = createRequest("PUT", "/api/conversations", {
        id: TEST_UUID,
      });
      const res = await PUT(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.messages).toBeDefined();
      expect(Array.isArray(json.data.messages)).toBe(true);
    });

    it("should return 400 when id is missing", async () => {
      mockAuthenticated();

      const req = createRequest("PUT", "/api/conversations", {});
      const res = await PUT(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 404 when conversation is not found", async () => {
      mockAuthenticated();
      vi.mocked(getConversation).mockResolvedValue(null as never);

      const req = createRequest("PUT", "/api/conversations", {
        id: TEST_UUID,
      });
      const res = await PUT(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 404 when conversation belongs to another user", async () => {
      mockAuthenticated();
      vi.mocked(getConversation).mockResolvedValue({
        id: TEST_UUID,
        userId: "other-user@example.com",
      } as never);

      const req = createRequest("PUT", "/api/conversations", {
        id: TEST_UUID,
      });
      const res = await PUT(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
