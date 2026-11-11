// /app/features/novelcrafter/components/StoryBibleWorkspace.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StoryBibleSchema } from "@/lib/features/novelcrafter/types";
import StoryBibleWorkspace from "./StoryBibleWorkspace";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("StoryBibleWorkspace full page (5B TC-08)", () => {
  it("renders under the page h1: title h2, sections h3", () => {
    render(
      <StoryBibleWorkspace
        storyBible={StoryBibleSchema.parse({})}
        onUpdateStoryBible={vi.fn()}
        embedded={false}
        onClose={vi.fn()}
        isStreaming={false}
        onTriggerStream={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
    expect(
      screen.getByRole("heading", { level: 2, name: "novelcrafterStoryBibleTitle" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(1);
  });
});
