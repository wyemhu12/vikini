import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VoiceButton } from "./VoiceButton";
import { useLanguageStore } from "@/lib/store/languageStore";

const mockToggleListening = vi.fn();
const mockStopListening = vi.fn();
const mockSpeak = vi.fn();
const mockStopSpeaking = vi.fn();

let sttState = {
  isListening: false,
  isSupported: true,
  transcript: "",
  error: null as string | null,
};

let ttsState = {
  isSpeaking: false,
  isSupported: true,
  error: null as string | null,
};

vi.mock("@/lib/features/voice", () => ({
  useSpeechRecognition: () => ({
    ...sttState,
    toggleListening: mockToggleListening,
    stopListening: mockStopListening,
  }),
  useSpeechSynthesis: () => ({
    ...ttsState,
    speak: mockSpeak,
    stop: mockStopSpeaking,
  }),
}));

describe("VoiceButton (CT-6B-02)", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
    sttState = { isListening: false, isSupported: true, transcript: "", error: null };
    ttsState = { isSpeaking: false, isSupported: true, error: null };
    mockToggleListening.mockReset();
    mockStopListening.mockReset();
    mockSpeak.mockReset();
    mockStopSpeaking.mockReset();
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "en" });
    vi.restoreAllMocks();
  });

  it("renders bilingual aria-label when STT is not supported without t prop", () => {
    sttState.isSupported = false;
    const { rerender } = render(<VoiceButton onTranscript={vi.fn()} />);

    const enBtn = screen.getByRole("button", {
      name: "Voice input not supported in this browser",
    });
    expect(enBtn).toBeDisabled();

    useLanguageStore.setState({ language: "vi" });
    rerender(<VoiceButton onTranscript={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Trình duyệt này không hỗ trợ nhập giọng nói" })
    ).toBeDisabled();
  });

  it("toggles listening, announces interpolated transcript, and stops TTS when speaking", () => {
    sttState.isListening = true;
    sttState.transcript = "xin chào";
    ttsState.isSpeaking = true;

    render(<VoiceButton onTranscript={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Listening: xin chào");

    const sttBtn = screen.getByRole("button", { name: "Stop voice input" });
    fireEvent.click(sttBtn);
    expect(mockStopSpeaking).toHaveBeenCalledTimes(1);
    expect(mockToggleListening).toHaveBeenCalledTimes(1);

    const stopTtsBtn = screen.getByRole("button", { name: "Stop speaking" });
    fireEvent.click(stopTtsBtn);
    expect(mockStopSpeaking).toHaveBeenCalledTimes(2);
  });

  it("announces localized Vietnamese transcript in aria-live status", () => {
    useLanguageStore.setState({ language: "vi" });
    sttState.isListening = true;
    sttState.transcript = "kiểm thử";

    render(<VoiceButton onTranscript={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Đang nghe: kiểm thử");
  });
});
