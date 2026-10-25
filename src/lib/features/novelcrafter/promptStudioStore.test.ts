// /lib/features/novelcrafter/promptStudioStore.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensurePromptStudioHydrated,
  PROMPT_STUDIO_STORAGE_KEY,
  usePromptStudioStore,
} from "./promptStudioStore";
import { createDefaultPromptStudioSettings } from "./promptStudioSettings";

describe("promptStudioStore (ST-09..ST-11)", () => {
  beforeEach(() => {
    usePromptStudioStore.setState({
      settings: createDefaultPromptStudioSettings(),
      persistErrorAt: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ST-09: catches QuotaExceededError inside safeLocalStorage.setItem without throwing and records persistErrorAt", () => {
    const fakeStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("window", { localStorage: fakeStorage });

    expect(() => {
      usePromptStudioStore.getState().setActionOverride("write:auto", {
        directive: "Trigger persist write",
      });
    }).not.toThrow();

    expect(usePromptStudioStore.getState().persistErrorAt).not.toBeNull();
  });

  it("ST-10: catches corrupted JSON in localStorage without crashing and falls back to defaults", async () => {
    const fakeStorage = {
      getItem: vi.fn(() => "{corrupted-json"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("window", { localStorage: fakeStorage });

    await expect(ensurePromptStudioHydrated()).resolves.toBeUndefined();
    expect(usePromptStudioStore.getState().settings.activePresetId).toBeNull();
    expect(usePromptStudioStore.getState().settings.overrides).toEqual({});
  });

  it("ST-11: ensurePromptStudioHydrated rehydrates stored overrides before stream request reads store state", async () => {
    const persistedPayload = JSON.stringify({
      state: {
        settings: {
          activePresetId: "lean_context",
          overrides: {
            "write:auto": {
              directive: "Rehydrated custom directive",
            },
          },
          customPresets: [],
        },
      },
      version: 1,
    });

    const fakeStorage = {
      getItem: vi.fn((key: string) =>
        key === PROMPT_STUDIO_STORAGE_KEY ? persistedPayload : null
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("window", { localStorage: fakeStorage });

    await ensurePromptStudioHydrated();
    expect(usePromptStudioStore.getState().settings.overrides["write:auto"]?.directive).toBe(
      "Rehydrated custom directive"
    );
  });
});
