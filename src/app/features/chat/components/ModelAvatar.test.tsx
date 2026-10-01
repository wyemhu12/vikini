// src/app/features/chat/components/ModelAvatar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ModelAvatar } from "./ModelAvatar";

describe("ModelAvatar", () => {
  it("renders text 'AI' when modelName is undefined", () => {
    render(<ModelAvatar />);
    expect(screen.getByText("AI")).toBeDefined();
  });

  it("renders Gemini brand logo with multi-stop gradient", () => {
    const { container } = render(<ModelAvatar modelName="gemini-2.5-pro" />);
    const grad = container.querySelector("linearGradient");
    expect(grad).toBeDefined();
    expect(grad?.id).toContain("gemini-grad");
    const stops = container.querySelectorAll("stop");
    expect(stops.length).toBe(4);
  });

  it("renders Claude brand logo with terracotta gradient", () => {
    const { container } = render(<ModelAvatar modelName="claude-3-7-sonnet" />);
    const grad = container.querySelector("linearGradient");
    expect(grad).toBeDefined();
    expect(grad?.id).toContain("claude-grad");
  });

  it("renders DeepSeek brand logo with ocean cyan gradient", () => {
    const { container } = render(<ModelAvatar modelName="deepseek/deepseek-v4" />);
    const grad = container.querySelector("linearGradient");
    expect(grad).toBeDefined();
    expect(grad?.id).toContain("deepseek-grad");
  });

  it("renders OpenAI brand logo with emerald gradient", () => {
    const { container } = render(<ModelAvatar modelName="gpt-4o" />);
    const grad = container.querySelector("linearGradient");
    expect(grad).toBeDefined();
    expect(grad?.id).toContain("openai-grad");
  });

  it("renders Groq/Llama fast inference logo with flame gradient", () => {
    const { container } = render(<ModelAvatar modelName="groq/llama-3.3-70b" />);
    const grad = container.querySelector("linearGradient");
    expect(grad).toBeDefined();
    expect(grad?.id).toContain("fast-grad");
  });

  it("renders Generic AI Brain logo for unknown models", () => {
    const { container } = render(<ModelAvatar modelName="custom-unknown-model" />);
    const grad = container.querySelector("linearGradient");
    expect(grad).toBeDefined();
    expect(grad?.id).toContain("brain-grad");
  });

  it("ensures unique gradient IDs across multiple instances via React.useId()", () => {
    const { container } = render(
      <div>
        <ModelAvatar modelName="gemini-2.5-flash" />
        <ModelAvatar modelName="gemini-2.5-flash" />
      </div>
    );
    const grads = container.querySelectorAll("linearGradient");
    expect(grads.length).toBe(2);
    expect(grads[0].id).not.toBe(grads[1].id);
  });
});
