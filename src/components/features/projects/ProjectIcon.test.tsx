import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { ProjectIcon } from "./ProjectIcon";

describe("ProjectIcon", () => {
  it("renders Sparkles SVG for 'sparkles' without leaking raw text", () => {
    const { container, queryByText } = render(<ProjectIcon icon="sparkles" color="#ff8a4c" />);
    expect(queryByText("sparkles")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("overflow-hidden");
  });

  it("normalizes case and separators (e.g. Folder-Open)", () => {
    const { container, queryByText } = render(<ProjectIcon icon="Folder-Open" />);
    expect(queryByText("Folder-Open")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("Negative Probe #4: falls back to Folder SVG for unrecognized ASCII slug", () => {
    const { container, queryByText } = render(<ProjectIcon icon="unknown-long-slug" />);
    expect(queryByText("unknown-long-slug")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders emoji inside an overflow-hidden badge", () => {
    const { container, getByText } = render(<ProjectIcon icon="🚀" />);
    expect(container.querySelector("svg")).toBeNull();
    const badge = getByText("🚀");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("overflow-hidden");
  });
});
