import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  resolveStoryStateSettled,
  useBeatsAutoOpen,
  type StoryStateSettledInput,
  type UseBeatsAutoOpenOptions,
} from "./useBeatsAutoOpen";

const PROSE = "x".repeat(1000);

const base: UseBeatsAutoOpenOptions = {
  storyId: "s1",
  chapterId: "ch-1",
  chapterContent: "",
  isStateSettled: true,
  isStreaming: false,
  promotedDraftStoryId: null,
};

function setup(initial: Partial<UseBeatsAutoOpenOptions>) {
  return renderHook((props: UseBeatsAutoOpenOptions) => useBeatsAutoOpen(props), {
    initialProps: { ...base, ...initial },
  });
}

describe("useBeatsAutoOpen", () => {
  it("TC-01: stays closed while state is not settled, even for an empty chapter", () => {
    const { result } = setup({ isStateSettled: false, chapterContent: "" });
    expect(result.current.beatsOpen).toBe(false);
  });

  it("TC-02: stays closed when loaded content arrives for the same chapter key", () => {
    const { result, rerender } = setup({ isStateSettled: false, chapterContent: "" });
    rerender({ ...base, isStateSettled: true, chapterContent: PROSE });
    expect(result.current.beatsOpen).toBe(false);
  });

  it("TC-03: opens for an empty chapter once settled", () => {
    const { result } = setup({ chapterContent: "" });
    expect(result.current.beatsOpen).toBe(true);
  });

  it("TC-04: typing into an empty chapter does not auto-close the card", () => {
    const { result, rerender } = setup({ chapterContent: "" });
    act(() => result.current.lockCurrent());
    rerender({ ...base, chapterContent: "Once upon" });
    expect(result.current.beatsOpen).toBe(true);
  });

  it("TC-05: an AI stream into an empty chapter does not auto-close the card", () => {
    const { result, rerender } = setup({ chapterContent: "" });
    rerender({ ...base, chapterContent: "", isStreaming: true });
    rerender({ ...base, chapterContent: "Once upon", isStreaming: true });
    expect(result.current.beatsOpen).toBe(true);
  });

  it("TC-06: a choice made on an unsaved draft survives promotion to the new story id", () => {
    const { result, rerender } = setup({ storyId: null, chapterContent: "" });
    act(() => result.current.lockCurrent());
    rerender({ ...base, storyId: null, chapterContent: "Once upon" });
    rerender({
      ...base,
      storyId: "s-new",
      promotedDraftStoryId: "s-new",
      chapterContent: "Once upon",
      isStateSettled: false,
    });
    expect(result.current.beatsOpen).toBe(true);
  });

  it("TC-07: a manual toggle wins over a later load completion", () => {
    const { result, rerender } = setup({ chapterContent: PROSE });
    expect(result.current.beatsOpen).toBe(false);
    act(() => result.current.setBeatsOpen(true));
    rerender({ ...base, chapterContent: PROSE, isStateSettled: false });
    expect(result.current.beatsOpen).toBe(true);
    rerender({ ...base, chapterContent: PROSE, isStateSettled: true });
    expect(result.current.beatsOpen).toBe(true);
  });

  it("TC-08: supports the functional updater form", () => {
    const { result } = setup({ chapterContent: "" });
    expect(result.current.beatsOpen).toBe(true);
    act(() => result.current.setBeatsOpen((p) => !p));
    expect(result.current.beatsOpen).toBe(false);
  });

  it("TC-09: switching chapter ignores the previous chapter's choice", () => {
    const { result, rerender } = setup({ chapterContent: PROSE });
    act(() => result.current.setBeatsOpen(true));
    rerender({ ...base, chapterId: "ch-2", chapterContent: PROSE });
    expect(result.current.beatsOpen).toBe(false);
  });

  it("TC-10: switching to another story sharing chapter id ch-1 drops the choice", () => {
    const { result, rerender } = setup({ storyId: "s1", chapterContent: PROSE });
    act(() => result.current.setBeatsOpen(true));
    rerender({ ...base, storyId: "s2", chapterContent: PROSE });
    expect(result.current.beatsOpen).toBe(false);
  });

  it("TC-13: a draft choice is never applied to a different, pre-existing story", () => {
    const { result, rerender } = setup({ storyId: null, chapterContent: "" });
    act(() => result.current.lockCurrent());
    rerender({ ...base, storyId: "s-new", promotedDraftStoryId: "s-new", chapterContent: "" });
    expect(result.current.beatsOpen).toBe(true);
    rerender({ ...base, storyId: "s-old", promotedDraftStoryId: "s-new", chapterContent: PROSE });
    expect(result.current.beatsOpen).toBe(false);
  });

  it("TC-14: returning to a chapter revives its last choice (single slot)", () => {
    const { result, rerender } = setup({ chapterContent: PROSE });
    act(() => result.current.setBeatsOpen(true));
    rerender({ ...base, chapterId: "ch-2", chapterContent: PROSE });
    expect(result.current.beatsOpen).toBe(false);
    rerender({ ...base, chapterId: "ch-1", chapterContent: PROSE });
    expect(result.current.beatsOpen).toBe(true);
  });
});

describe("resolveStoryStateSettled", () => {
  const fixture: StoryStateSettledInput = {
    isAuthed: true,
    isLoadingConversations: false,
    isLoadingState: false,
    validStoryId: "s1",
    hydratedStoryId: "s1",
    storyCount: 2,
    hasUnsavedDraft: false,
  };

  it("TC-11: reports not settled for each loading condition", () => {
    expect(resolveStoryStateSettled({ ...fixture, isLoadingConversations: true })).toBe(false);
    expect(
      resolveStoryStateSettled({ ...fixture, validStoryId: null, hydratedStoryId: null })
    ).toBe(false);
    expect(resolveStoryStateSettled({ ...fixture, isLoadingState: true })).toBe(false);
    expect(resolveStoryStateSettled({ ...fixture, hydratedStoryId: undefined })).toBe(false);
    expect(resolveStoryStateSettled({ ...fixture, validStoryId: "s2" })).toBe(false);
    expect(
      resolveStoryStateSettled({
        ...fixture,
        isLoadingConversations: true,
        storyCount: 0,
        validStoryId: null,
        hydratedStoryId: null,
      })
    ).toBe(false);
  });

  it("TC-12: reports settled when the shown state belongs to the selected story", () => {
    expect(
      resolveStoryStateSettled({
        ...fixture,
        isAuthed: false,
        validStoryId: null,
        hydratedStoryId: null,
      })
    ).toBe(true);
    expect(
      resolveStoryStateSettled({
        ...fixture,
        hasUnsavedDraft: true,
        validStoryId: null,
        hydratedStoryId: null,
      })
    ).toBe(true);
    expect(resolveStoryStateSettled(fixture)).toBe(true);
  });
});
