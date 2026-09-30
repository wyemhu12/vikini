import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

describe("ScrollToBottomButton", () => {
  it("does not render when isAtBottom is true", () => {
    const { container } = render(<ScrollToBottomButton isAtBottom={true} onClick={vi.fn()} />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders when isAtBottom is false", () => {
    render(<ScrollToBottomButton isAtBottom={false} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /scroll to bottom/i });
    expect(btn).toBeInTheDocument();
  });

  it("triggers onClick when clicked", () => {
    const onClick = vi.fn();
    render(<ScrollToBottomButton isAtBottom={false} onClick={onClick} />);
    const btn = screen.getByRole("button", { name: /scroll to bottom/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("displays unread count badge when unreadCount > 0", () => {
    render(<ScrollToBottomButton isAtBottom={false} unreadCount={5} onClick={vi.fn()} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /scroll to bottom \(5 unread\)/i })
    ).toBeInTheDocument();
  });
});
