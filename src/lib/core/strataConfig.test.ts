import { describe, expect, it } from "vitest";
import { getStrataConfig, isStrataEnabled } from "./strataConfig";
import { AppError } from "@/lib/utils/errors";

describe("strataConfig", () => {
  it("TC-8: returns defaults when env is empty", () => {
    const cfg = getStrataConfig({ NODE_ENV: "test" });
    expect(cfg).toEqual({
      enabled: false,
      baseUrl: "http://127.0.0.1:8080/v1",
      origin: "http://127.0.0.1:8080",
      healthUrl: "http://127.0.0.1:8080/health",
      countTokensUrl: "http://127.0.0.1:8080/v1/messages/count_tokens",
      modelId: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      apiKey: "",
      contextWindow: 32768,
      requestTimeoutMs: 300000,
      idleTimeoutMs: 120000,
      queueMaxPending: 2,
      queueMaxWaitMs: 120000,
      allowRemote: false,
    });
    expect(isStrataEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(isStrataEnabled({ NODE_ENV: "test", STRATA_ENABLED: "true" })).toBe(true);
  });

  it("TC-9: throws AppError CONFIG_ERROR when STRATA_BASE_URL is non-loopback without STRATA_ALLOW_REMOTE", () => {
    expect(() =>
      getStrataConfig({
        NODE_ENV: "test",
        STRATA_BASE_URL: "http://192.168.1.5:8080/v1",
      })
    ).toThrow(AppError);

    try {
      getStrataConfig({
        NODE_ENV: "test",
        STRATA_BASE_URL: "http://192.168.1.5:8080/v1",
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppError);
      if (err instanceof AppError) {
        expect(err.code).toBe("CONFIG_ERROR");
        expect(err.message).toBe("Invalid STRATA_BASE_URL");
      }
    }
  });

  it("TC-10: allows non-loopback STRATA_BASE_URL when STRATA_ALLOW_REMOTE=true", () => {
    const cfg = getStrataConfig({
      NODE_ENV: "test",
      STRATA_BASE_URL: "http://192.168.1.5:8080/v1/",
      STRATA_ALLOW_REMOTE: "true",
    });
    expect(cfg.baseUrl).toBe("http://192.168.1.5:8080/v1");
    expect(cfg.healthUrl).toBe("http://192.168.1.5:8080/health");
    expect(cfg.countTokensUrl).toBe("http://192.168.1.5:8080/v1/messages/count_tokens");
    expect(cfg.allowRemote).toBe(true);
  });

  it("TC-11: falls back to default 300000 when STRATA_REQUEST_TIMEOUT_MS is invalid or non-positive", () => {
    for (const badValue of ["abc", "-5", "0"]) {
      const cfg = getStrataConfig({
        NODE_ENV: "test",
        STRATA_REQUEST_TIMEOUT_MS: badValue,
      });
      expect(cfg.requestTimeoutMs).toBe(300000);
    }
  });
});
