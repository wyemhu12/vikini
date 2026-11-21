import { describe, it, expect } from "vitest";
import { parseCookieHeader } from "./chatStreamHelpers";

describe("chatStreamHelpers - parseCookieHeader (TC-W1-08)", () => {
  it("parses valid URL-encoded cookies cleanly", () => {
    const parsed = parseCookieHeader("webSearchEnabled=1; greeting=hello%20world; empty=");
    expect(parsed).toEqual({
      webSearchEnabled: "1",
      greeting: "hello world",
      empty: "",
    });
  });

  it("does not throw on malformed percent-encoded sequences like %E0%A4%A", () => {
    const parsed = parseCookieHeader("broken=%E0%A4%A; webSearchEnabled=1");
    expect(parsed.broken).toBe("%E0%A4%A");
    expect(parsed.webSearchEnabled).toBe("1");
  });

  it("returns empty object for null/undefined/empty headers", () => {
    expect(parseCookieHeader(null)).toEqual({});
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader("")).toEqual({});
  });
});
