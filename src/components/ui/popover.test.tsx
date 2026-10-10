import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";

describe("Popover Component Responsive Constraints", () => {
  it("renders with default w-72 and max-w viewport constraint", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="popover-content">
          <div>Popover Body</div>
        </PopoverContent>
      </Popover>
    );

    const content = screen.getByTestId("popover-content");
    expect(content).toBeInTheDocument();
    expect(content.className).toContain("w-72");
    expect(content.className).toContain(
      "max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]"
    );
  });

  it("preserves max-w constraint even when consumer overrides with className='w-80'", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="popover-content-w80" className="w-80 p-3">
          <div>W80 Content</div>
        </PopoverContent>
      </Popover>
    );

    const content = screen.getByTestId("popover-content-w80");
    expect(content).toBeInTheDocument();
    // Consumer's w-80 wins over w-72 via twMerge
    expect(content.className).toContain("w-80");
    expect(content.className).not.toContain("w-72");
    // CRITICAL: max-w is NOT overridden by w-80, preventing overflow on foldables (~280px)
    expect(content.className).toContain(
      "max-w-[min(var(--radix-popover-content-available-width,100vw),calc(100vw-2rem))]"
    );
  });
});
