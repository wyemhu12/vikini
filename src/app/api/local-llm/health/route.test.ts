import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import * as authModule from "@/lib/features/auth/auth";
import * as strataConfigModule from "@/lib/core/strataConfig";
import * as strataClientModule from "@/lib/core/strataClient";
import * as strataQueueModule from "@/lib/core/strataQueue";

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/local-llm/health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 Unauthorized when session is missing (TC-35)", async () => {
    vi.mocked(authModule.auth).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns enabled, online, loaded, model, maxContext, and queue snapshot when authenticated (TC-34)", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@example.com" },
    } as never);

    vi.spyOn(strataConfigModule, "getStrataConfig").mockReturnValue({
      enabled: true,
      baseUrl: "http://127.0.0.1:8080/v1",
      origin: "http://127.0.0.1:8080",
      healthUrl: "http://127.0.0.1:8080/health",
      countTokensUrl: "http://127.0.0.1:8080/v1/messages/count_tokens",
      apiKey: "strata-local",
      modelId: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      contextWindow: 32768,
      requestTimeoutMs: 300000,
      idleTimeoutMs: 120000,
      queueMaxPending: 2,
      queueMaxWaitMs: 180000,
      allowRemote: false,
    });

    vi.spyOn(strataClientModule, "checkStrataHealth").mockResolvedValue({
      online: true,
      loaded: true,
      model: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      maxContext: 32768,
    });

    vi.spyOn(strataQueueModule, "getStrataQueue").mockReturnValue({
      canAdmit: () => true,
      acquire: vi.fn(),
      snapshot: () => ({ active: 0 as const, pending: 0 }),
      resetForTests: () => undefined,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      enabled: true,
      online: true,
      loaded: true,
      model: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      maxContext: 32768,
      queue: { active: 0, pending: 0 },
    });
  });
});
