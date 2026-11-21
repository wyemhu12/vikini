import { describe, it, expect, vi } from "vitest";
import { buildNavigationCommands } from "./navigationCommands";
import { translations } from "@/lib/utils/config";

describe("buildNavigationCommands", () => {
  const tVi = (key: string) => (translations.vi as Record<string, string>)[key] ?? key;

  it("TC-W4-03: returns all 7 localized navigation commands in expected order", () => {
    const onNavigate = vi.fn();
    const commands = buildNavigationCommands({ t: tVi, onNavigate });

    expect(commands).toHaveLength(7);
    expect(commands.map((c) => ({ id: c.id, title: c.title, category: c.category }))).toEqual([
      { id: "go-chat", title: "Đi tới Trò chuyện", category: "navigation" },
      { id: "go-gems", title: "Đi tới Quản lý Gems", category: "navigation" },
      { id: "go-personas", title: "Đi tới Quản lý Personas", category: "navigation" },
      { id: "go-images", title: "Đi tới Tạo ảnh", category: "navigation" },
      { id: "go-gallery", title: "Đi tới Thư viện", category: "navigation" },
      { id: "go-describe", title: "Đi tới Mô tả ảnh", category: "navigation" },
      { id: "go-novelcrafter", title: "Đi tới Novelcrafter", category: "navigation" },
    ]);
  });

  it("invokes onNavigate with the canonical href for every command", () => {
    const onNavigate = vi.fn();
    const commands = buildNavigationCommands({ t: tVi, onNavigate });

    for (const cmd of commands) {
      cmd.perform();
    }

    expect(onNavigate.mock.calls.map(([href]) => href)).toEqual([
      "/",
      "/features/gems",
      "/features/personas",
      "/images",
      "/gallery",
      "/describe",
      "/novelcrafter",
    ]);
  });
});
