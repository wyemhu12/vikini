import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ChatHeader from "./ChatHeader";
import { useLanguageStore } from "@/lib/store/languageStore";

const openMenu = () =>
  fireEvent.pointerDown(screen.getByRole("button", { name: "Tùy chọn đoạn chat" }), {
    button: 0,
    ctrlKey: false,
  });

describe("ChatHeader", () => {
  beforeEach(() => useLanguageStore.setState({ language: "vi" }));

  it("TC-08: shows the title, project line and wires the menu actions", () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(
      <ChatHeader
        title="Server và Client"
        projectName="Vikini dev"
        onRename={onRename}
        onDelete={onDelete}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Server và Client" })).toBeInTheDocument();
    expect(screen.getByText("Dự án · Vikini dev")).toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Đổi tên/ }));
    expect(onRename).toHaveBeenCalledTimes(1);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Xóa/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("TC-08: omits the project line and the menu when not provided", () => {
    render(<ChatHeader title="Chat" />);
    expect(screen.queryByText(/Dự án ·/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Tùy chọn đoạn chat" })).toBeNull();
  });

  it("TC-09: falls back to the new-chat title and is desktop only", () => {
    const { container } = render(<ChatHeader title="   " />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Cuộc trò chuyện mới");
    expect(container.querySelector("header")).toHaveClass("hidden", "md:flex");
  });
});
