import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectChatView } from "./ProjectChatView";
import type { ProjectWithStats } from "@/types/projects";

const mockProject: ProjectWithStats = {
  id: "proj-1",
  user_id: "u1",
  name: "Sunset Novel",
  description: null,
  color: "#FF8A4C",
  icon: "🌅",
  embedding_model: "gemini-embedding-2",
  document_count: 1,
  conversation_count: 0,
  storage_bytes: 512,
  created_at: "2026-11-11T00:00:00.000Z",
  updated_at: "2026-11-11T00:00:00.000Z",
};

describe("ProjectChatView horizon glow & new chat button (TC-6E-07)", () => {
  it("wraps the new chat button in a mb-8 container with composer-horizon-glow and triggers onNewChat", () => {
    const onNewChat = vi.fn();
    render(
      <ProjectChatView
        project={mockProject}
        conversations={[]}
        onNewChat={onNewChat}
        onSelectConversation={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    const glow = screen.getByTestId("composer-horizon-glow");
    expect(glow).toHaveAttribute("aria-hidden", "true");
    expect(glow.className).toContain("pointer-events-none");
    expect(glow.className).toContain("composer-horizon-glow");
    expect(glow.parentElement?.className).toContain("mb-8");

    const newChatBtn = screen.getByRole("button", { name: /Sunset Novel/i });
    expect(newChatBtn.className).not.toContain("mb-8");
    fireEvent.click(newChatBtn);
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });
});
