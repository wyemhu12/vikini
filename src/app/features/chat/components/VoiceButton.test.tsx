import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VoiceButton } from "./VoiceButton";
import { useLanguageStore } from "@/lib/store/languageStore";
import { toast } from "@/lib/store/toastStore";
import type { SpeechErrorCode } from "@/lib/features/voice";

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

const mockToggleListening = vi.fn();
const mockStopListening = vi.fn();
const mockSpeak = vi.fn();
const mockStopSpeaking = vi.fn();
let capturedOnError: ((error: string, errorCode: SpeechErrorCode) => void) | undefined;

let sttState = {
  isListening: false,
  isSupported: true,
  transcript: "",
  error: null as string | null,
  errorCode: null as SpeechErrorCode | null,
};

let ttsState = {
  isSpeaking: false,
  isSupported: true,
  error: null as string | null,
};

vi.mock("@/lib/features/voice", () => ({
  useSpeechRecognition: (opts?: { onError?: (err: string, code: SpeechErrorCode) => void }) => {
    capturedOnError = opts?.onError;
    return {
      ...sttState,
      toggleListening: mockToggleListening,
      stopListening: mockStopListening,
    };
  },
  useSpeechSynthesis: () => ({
    ...ttsState,
    speak: mockSpeak,
    stop: mockStopSpeaking,
  }),
}));

describe("VoiceButton (CT-6B-02)", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
    sttState = {
      isListening: false,
      isSupported: true,
      transcript: "",
      error: null,
      errorCode: null,
    };
    ttsState = { isSpeaking: false, isSupported: true, error: null };
    capturedOnError = undefined;
    mockToggleListening.mockReset();
    mockStopListening.mockReset();
    mockSpeak.mockReset();
    mockStopSpeaking.mockReset();
    vi.mocked(toast.error).mockReset();
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

  it("TC-W2B-09 / NP-6: translates errorCode into localized Vietnamese for BOTH toast.error and tooltip (no raw English sttError)", () => {
    useLanguageStore.setState({ language: "vi" });
    sttState.error = "Microphone access denied. Please allow microphone access.";
    sttState.errorCode = "not-allowed";

    render(<VoiceButton />);

    const tooltip = screen.getByTestId("tooltip-content");
    expect(tooltip).toHaveTextContent(
      "Quyền truy cập micro bị từ chối. Vui lòng bật trong cài đặt trình duyệt."
    );
    expect(tooltip.textContent).not.toContain("Microphone access denied");

    // Firing onError callback shows localized toast (and skips 'aborted')
    capturedOnError?.("Microphone access denied. Please allow microphone access.", "not-allowed");
    expect(toast.error).toHaveBeenCalledWith(
      "Quyền truy cập micro bị từ chối. Vui lòng bật trong cài đặt trình duyệt."
    );

    vi.mocked(toast.error).mockReset();
    capturedOnError?.("Recognition was aborted.", "aborted");
    expect(toast.error).not.toHaveBeenCalled();
  });
});
