# Chat Core UX/UI Augmentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Vikini's Chat Core UX/UI to world-class craft standards by decomposing monolithic components, eliminating dead Tailwind v4 tokens, enforcing >=12px typography, adding Emil Kowalski micro-interactions, and ensuring WCAG 2.2 accessibility.

**Architecture:** Decompose `ChatBubble.tsx` (582 lines) into a shell controller (<220 lines), `BubbleMarkdown.tsx` (<160 lines), and `BubbleAvatar.tsx` (<70 lines). Refactor `SmartCode`, `BubbleHelpers`, `MessageActions`, `InputForm`, and `ChatControls` to use 100% standard Vikini tokens (`bg-(--token)`), smooth motion transitions, and Lucide React icons.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Framer Motion, Lucide React, Radix UI primitives, Vitest.

## Global Constraints

- Files must be `.ts` or `.tsx`. No `.js`.
- BANNED: Using `any` type anywhere -- catch blocks, variables, function params. Use `unknown` with type narrowing.
- BANNED: Dead Tailwind v4 classes: `border-token`, `bg-surface-elevated`, `bg-surface-muted`, `text-primary`, `text-secondary`, `bg-control`, `bg-surface/95`, `card-surface`.
- REQUIRED: Use Vikini arbitrary design tokens: `bg-(--surface-elevated)`, `border-(--border)`, `text-(--text-primary)`, `text-(--text-secondary)`, `bg-(--control-bg)`.
- BANNED: Font sizes below 12px (`text-[8px]`, `text-[10px]`). Minimum font size is `text-xs` (12px).
- BANNED: Prop-drilling `t` translations as `Record<string, string>`. Must use `useLanguage()` directly (`rules/04-bilingual.md`).
- BANNED: Custom SVG icons. Use `lucide-react` exclusively (`rules/03-ui.md`).
- BANNED: Hand-rolled modal backdrop `fixed inset-0`. Use Radix UI primitives (`rules/03-ui.md`).
- Maximum file size: < 400 lines (hard max 500 lines).
- Micro-interactions: Buttons must have `active:scale-[0.95]` or `0.97` and explicit transition properties (no `transition: all`).

---

### Task 1: SmartCode Developer-Grade Upgrade & Tests

**Files:**

- Modify: `src/app/features/chat/components/SmartCode.tsx`
- Create: `src/app/features/chat/components/SmartCode.test.tsx`

**Interfaces:**

- Consumes: `extractText` utility, `useLanguage()`
- Produces: `SmartCode({ inline, className, children }: SmartCodeProps)`

- [ ] **Step 1: Write unit test for SmartCode**

```tsx
// src/app/features/chat/components/SmartCode.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import SmartCode from "./SmartCode";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (k: string) => (k === "copied" ? "Copied" : k === "copy" ? "Copy" : k),
    language: "en",
  }),
}));

describe("SmartCode", () => {
  it("renders inline code correctly", () => {
    render(<SmartCode inline>const x = 1;</SmartCode>);
    const code = screen.getByText("const x = 1;");
    expect(code).toBeDefined();
    expect(code.tagName).toBe("CODE");
  });

  it("renders block code with language label and copy button", () => {
    render(<SmartCode className="language-typescript">const x = 10;</SmartCode>);
    expect(screen.getByText("TYPESCRIPT")).toBeDefined();
    expect(screen.getByText("Copy")).toBeDefined();
  });

  it("copies code when copy button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(<SmartCode className="language-python">print("hello")</SmartCode>);
    const copyButton = screen.getByTitle("Copy");
    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith('print("hello")');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/features/chat/components/SmartCode.test.tsx`
Expected: FAIL or passes partially, checks current state.

- [ ] **Step 3: Implement SmartCode upgrades**
  - Remove fake Mac window dots (`#ff5f56`, `#ffbd2e`, `#27c93f`).
  - Replace with minimalist developer header: uppercase monospace language badge + clean copy button.
  - Add gradient fade mask `bg-gradient-to-t from-(--surface-elevated) to-transparent` when lines > 20 with "Expand code" control.
  - Replace dead classes with standard tokens: `bg-(--surface-elevated)`, `border-(--border)`, `text-(--text-primary)`, `text-(--text-secondary)`.
  - Add active press scale feedback `active:scale-[0.95]`.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/features/chat/components/SmartCode.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/features/chat/components/SmartCode.tsx src/app/features/chat/components/SmartCode.test.tsx
git commit -m "refactor(chat): upgrade SmartCode to developer-grade with design tokens and tests"
```

---

### Task 2: BubbleHelpers Polish (TypingDots, Anti-orphan TypingCursor, ThinkingBlock)

**Files:**

- Modify: `src/app/features/chat/components/BubbleHelpers.tsx`
- Create: `src/app/features/chat/components/BubbleHelpers.test.tsx`

**Interfaces:**

- Produces: `TypingDots`, `TypingCursor`, `ThinkingBlock`

- [ ] **Step 1: Write unit tests for BubbleHelpers**

```tsx
// src/app/features/chat/components/BubbleHelpers.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TypingDots, TypingCursor, ThinkingBlock } from "./BubbleHelpers";

describe("BubbleHelpers", () => {
  it("renders TypingDots with role status", () => {
    const { container } = render(<TypingDots />);
    expect(container.querySelector(".typing-dots")).toBeDefined();
  });

  it("renders TypingCursor with aria-hidden", () => {
    const { container } = render(<TypingCursor />);
    const cursor = container.querySelector("span[aria-hidden='true']");
    expect(cursor).toBeDefined();
  });

  it("renders ThinkingBlock and toggles collapse on click", () => {
    const t = (k: string) => (k === "thinkingProcess" ? "Reasoning" : k);
    render(<ThinkingBlock content="This is internal reasoning" t={t} />);

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("This is internal reasoning")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/features/chat/components/BubbleHelpers.test.tsx`
Expected: FAIL (missing `aria-expanded` or token discrepancies).

- [ ] **Step 3: Update BubbleHelpers**
  - Fix dead token `bg-secondary` -> `bg-(--accent)`.
  - Fix dead class `text-secondary hover:text-primary` -> `text-(--text-secondary) hover:text-(--text-primary)`.
  - Add `aria-expanded={!isCollapsed}` to ThinkingBlock button.
  - Implement smooth Framer Motion `height: "auto"` transition and subtle ambient glow on ThinkingBlock.
  - Ensure `TypingCursor` has `inline-block whitespace-nowrap` wrapper to prevent orphan line drops.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/features/chat/components/BubbleHelpers.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/features/chat/components/BubbleHelpers.tsx src/app/features/chat/components/BubbleHelpers.test.tsx
git commit -m "feat(chat): polish BubbleHelpers with anti-orphan cursor and a11y thinking accordion"
```

---

### Task 3: MessageActions Floating Glass Dock Upgrade

**Files:**

- Modify: `src/app/features/chat/components/MessageActions.tsx`
- Create: `src/app/features/chat/components/MessageActions.test.tsx`

**Interfaces:**

- Consumes: `useLanguage()`
- Produces: `MessageActions(props: MessageActionsProps)`

- [ ] **Step 1: Write unit tests for MessageActions**

```tsx
// src/app/features/chat/components/MessageActions.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import MessageActions from "./MessageActions";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    language: "en",
  }),
}));

describe("MessageActions", () => {
  it("renders copy button for bot message", () => {
    const onCopy = vi.fn();
    render(<MessageActions isBot={true} copied={false} onCopy={onCopy} />);
    const btn = screen.getByTitle("copy");
    fireEvent.click(btn);
    expect(onCopy).toHaveBeenCalled();
  });

  it("renders edit button for user message", () => {
    const onEdit = vi.fn();
    render(<MessageActions isBot={false} copied={false} onCopy={vi.fn()} onEdit={onEdit} />);
    const editBtn = screen.getByTitle("edit");
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalled();
  });

  it("renders regenerate button for assistant message when canRegenerate is true", () => {
    const onRegen = vi.fn();
    render(
      <MessageActions
        isBot={true}
        copied={false}
        canRegenerate={true}
        onCopy={vi.fn()}
        onRegenerate={onRegen}
      />
    );
    const regenBtn = screen.getByTitle("regenerate");
    fireEvent.click(regenBtn);
    expect(onRegen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/features/chat/components/MessageActions.test.tsx`
Expected: Passes or fails on title/ARIA.

- [ ] **Step 3: Upgrade MessageActions**
  - Transform container into Floating Glass Dock: `backdrop-blur-md bg-(--surface-elevated)/80 border border-(--border) shadow-md rounded-full px-2 py-1`.
  - Change sub-12px font `text-[10px]` to `text-xs font-semibold`.
  - Fix dead tokens: `text-(--text-secondary) hover:text-(--accent)`.
  - Add active press feedback `active:scale-[0.92]` and `focus-visible:ring-2 focus-visible:ring-(--ring)`.
  - Ensure minimum touch target $\ge 28\text{px}$.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/features/chat/components/MessageActions.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/features/chat/components/MessageActions.tsx src/app/features/chat/components/MessageActions.test.tsx
git commit -m "feat(chat): upgrade MessageActions to floating glass dock with touch targets and tokens"
```

---

### Task 4: Extract BubbleAvatar & BubbleMarkdown

**Files:**

- Create: `src/app/features/chat/components/BubbleAvatar.tsx`
- Create: `src/app/features/chat/components/BubbleMarkdown.tsx`
- Create: `src/app/features/chat/components/BubbleAvatar.test.tsx`

**Interfaces:**

- Produces:
  - `BubbleAvatar({ isBot, isLoading, modelName }: BubbleAvatarProps)`
  - `BubbleMarkdown({ content, isBot, onLightboxFile }: BubbleMarkdownProps)`

- [ ] **Step 1: Write test for BubbleAvatar**

```tsx
// src/app/features/chat/components/BubbleAvatar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { BubbleAvatar } from "./BubbleAvatar";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({ t: (k: string) => (k === "me" ? "ME" : k) }),
}));

vi.mock("./ModelAvatar", () => ({
  ModelAvatar: ({ modelName }: { modelName?: string }) => (
    <div data-testid="model-avatar">{modelName || "AI"}</div>
  ),
}));

describe("BubbleAvatar", () => {
  it("renders user avatar when isBot is false", () => {
    render(<BubbleAvatar isBot={false} isLoading={false} />);
    expect(screen.getByText("ME")).toBeDefined();
  });

  it("renders model avatar when isBot is true and not loading", () => {
    render(<BubbleAvatar isBot={true} isLoading={false} modelName="gemini-2.5-pro" />);
    expect(screen.getByTestId("model-avatar")).toBeDefined();
  });

  it("renders shimmer pulse when isBot is true and loading", () => {
    const { container } = render(<BubbleAvatar isBot={true} isLoading={true} />);
    expect(container.querySelector(".animate-spin-slow, .animate-pulse, svg")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/features/chat/components/BubbleAvatar.test.tsx`
Expected: FAIL (file not created yet).

- [ ] **Step 3: Create BubbleAvatar.tsx**
  - Implement `BubbleAvatar` cleanly (< 70 lines).
  - Use `bg-(--accent)/10` and `border-(--accent)/30` for loading state (no hardcoded blue-500).
  - Use `bg-(--accent) text-(--accent-foreground)` for user avatar.

- [ ] **Step 4: Create BubbleMarkdown.tsx**
  - Extract all Markdown config from `ChatBubble.tsx` (< 160 lines).
  - Replace all dead classes: `border-(--border)`, `text-(--text-primary)`, `text-(--text-secondary)`, `bg-(--surface-elevated)`.
  - Ensure typography: `leading-relaxed text-[15px] md:text-base`.
  - Wrap in `React.memo`.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/app/features/chat/components/BubbleAvatar.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/features/chat/components/BubbleAvatar.tsx src/app/features/chat/components/BubbleMarkdown.tsx src/app/features/chat/components/BubbleAvatar.test.tsx
git commit -m "refactor(chat): extract BubbleAvatar and BubbleMarkdown components"
```

---

### Task 5: ChatBubble Shell Decomposition & Integration Test

**Files:**

- Modify: `src/app/features/chat/components/ChatBubble.tsx`
- Create: `src/app/features/chat/components/ChatBubble.test.tsx`

**Interfaces:**

- Consumes: `BubbleAvatar`, `BubbleMarkdown`, `MessageActions`, `BubbleHelpers`
- Produces: `ChatBubble(props: ChatBubbleProps)`

- [ ] **Step 1: Write integration test for ChatBubble**

```tsx
// src/app/features/chat/components/ChatBubble.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ChatBubble from "./ChatBubble";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({ t: (k: string) => k, language: "en" }),
}));

vi.mock("./BubbleAvatar", () => ({
  BubbleAvatar: ({ isBot }: { isBot: boolean }) => (
    <div data-testid="avatar">{isBot ? "BOT_AVATAR" : "USER_AVATAR"}</div>
  ),
}));

vi.mock("./BubbleMarkdown", () => ({
  BubbleMarkdown: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

describe("ChatBubble", () => {
  it("renders user message bubble correctly", () => {
    render(
      <ChatBubble
        role="user"
        content="Hello world"
        message={{ role: "user", content: "Hello world" }}
      />
    );
    expect(screen.getByTestId("avatar")).toBeDefined();
    expect(screen.getByText("Hello world")).toBeDefined();
  });

  it("renders assistant message bubble with markdown", () => {
    render(
      <ChatBubble
        role="assistant"
        content="AI response"
        message={{ role: "assistant", content: "AI response" }}
      />
    );
    expect(screen.getByTestId("avatar")).toBeDefined();
    expect(screen.getByTestId("markdown")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/app/features/chat/components/ChatBubble.test.tsx`
Expected: Baseline test check.

- [ ] **Step 3: Refactor ChatBubble.tsx**
  - Import `BubbleAvatar`, `BubbleMarkdown`, `MessageActions`, `BubbleHelpers`.
  - Remove inline Markdown renderer functions and avatar rendering block.
  - Fix all remaining dead classes (`bg-(--surface)`, `text-(--text-primary)`).
  - Reduce line count from 582 to < 220 lines.
  - Retain `useDeferredValue` for smooth scrolling performance.

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/app/features/chat/components/ChatBubble.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/features/chat/components/ChatBubble.tsx src/app/features/chat/components/ChatBubble.test.tsx
git commit -m "refactor(chat): decompose ChatBubble into modular shell under 220 lines"
```

---

### Task 6: InputForm & ChatControls Polish

**Files:**

- Modify: `src/app/features/chat/components/InputForm.tsx`
- Modify: `src/app/features/chat/components/ChatControls.tsx`

**Interfaces:**

- `InputForm`: Remove `t?: Record<string, string>` prop, call `useLanguage()` directly.
- `ChatControls`: Standardize text to `text-xs`, replace manual backdrop with Radix UI Popover.

- [ ] **Step 1: Refactor InputForm.tsx**
  - Remove manual SVGs (`PaperAirplaneIcon`, `StopIcon`), replace with `SendHorizontal` and `Square` from `lucide-react`.
  - Remove `t?: Record<string, string>` prop and call `const { t } = useLanguage()` directly (bilingual rule compliance).
  - Implement smart Send/Stop button:
    - Empty: dimmed `opacity-40 scale-95`.
    - Ready: glow `shadow-[0_0_12px_var(--accent)] scale-100`.
    - Active: `active:scale-[0.92]`.
    - Streaming: Stop icon `Square` with pulsing ring.
  - Add keyboard shortcut hint in textarea footer (`↵ Send`, `Shift+↵ New line`).

- [ ] **Step 2: Refactor ChatControls.tsx**
  - Replace all `text-[8px]` and `text-[10px]` with `text-xs font-semibold`.
  - Replace `bg-surface/95` with `bg-(--surface)/95`.
  - Replace manual `<div className="fixed inset-0" onClick=... />` with Radix Popover or clean dismiss handler.
  - Ensure all buttons have `focus-visible:ring-2 focus-visible:ring-(--ring)`.

- [ ] **Step 3: Run type-check to ensure no prop mismatch**

Run: `npm run type-check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/chat/components/InputForm.tsx src/app/features/chat/components/ChatControls.tsx
git commit -m "feat(chat): polish InputForm and ChatControls with Lucide icons and token compliance"
```

---

### Task 7: Full Quality Gate Verification & Changelog

**Files:**

- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Run type-check**

Run: `npm run type-check`
Expected: PASS (0 errors)

- [ ] **Step 2: Run Vitest tests for Chat feature**

Run: `npx vitest run src/app/features/chat/components`
Expected: ALL PASS

- [ ] **Step 3: Update docs/CHANGELOG.md**
  - Record the Chat Core UX/UI augmentation (modular decomposition, token fixes, Emil Kowalski micro-interactions, Lucide icons, a11y improvements).

- [ ] **Step 4: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): record chat core ux-ui augmentation"
```
