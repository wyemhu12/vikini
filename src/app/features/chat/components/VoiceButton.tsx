// app/features/chat/components/VoiceButton.tsx
"use client";

import React, { useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import {
  useSpeechRecognition,
  useSpeechSynthesis,
  type SpeechErrorCode,
} from "@/lib/features/voice";
import { toast } from "@/lib/store/toastStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "../hooks/useLanguage";

interface VoiceButtonProps {
  /** Callback when voice transcript is available */
  onTranscript?: (text: string) => void;
  /** Callback when final transcript is ready (append to input) */
  onFinalTranscript?: (text: string) => void;
  /** Text to speak (AI response) */
  textToSpeak?: string;
  /** Whether TTS is enabled */
  ttsEnabled?: boolean;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Language setting */
  language?: string;
}

function resolveVoiceErrorMessage(
  errorCode: SpeechErrorCode | null | undefined,
  t: (key: string) => string
): string | null {
  switch (errorCode) {
    case "not-supported":
      return t("voiceNotSupported");
    case "not-allowed":
      return t("voiceMicDenied");
    case "no-speech":
      return t("voiceNoSpeech");
    case "audio-capture":
      return t("voiceAudioCaptureError");
    case "network":
      return t("voiceNetworkError");
    case "start-failed":
    case "unknown":
      return t("voiceStartFailed");
    case "aborted":
    default:
      return null;
  }
}

/**
 * Voice input/output button for chat
 * - Hold or click to start voice input (STT)
 * - Shows visual feedback while listening
 * - Optionally speaks AI responses (TTS)
 */
export function VoiceButton({
  onTranscript,
  onFinalTranscript,
  textToSpeak,
  ttsEnabled = false,
  disabled = false,
  language = "vi-VN",
}: VoiceButtonProps) {
  const { t } = useLanguage();
  // Speech Recognition (STT)
  const {
    isListening,
    isSupported: sttSupported,
    transcript,
    toggleListening,
    stopListening: _stopListening,
    errorCode: sttErrorCode,
  } = useSpeechRecognition({
    language,
    continuous: true,
    interimResults: true,
    silenceTimeout: 3000, // Stop after 3s silence
    onFinalResult: (text) => {
      onFinalTranscript?.(text);
    },
    onError: (_msg, code) => {
      const translated = resolveVoiceErrorMessage(code, t);
      if (translated) toast.error(translated);
    },
  });

  const translatedSttError = resolveVoiceErrorMessage(sttErrorCode, t);

  // Speech Synthesis (TTS)
  const {
    isSpeaking,
    isSupported: ttsSupported,
    speak,
    stop: stopSpeaking,
    error: _ttsError,
  } = useSpeechSynthesis({
    language,
    rate: 1.0,
  });

  // Update transcript callback
  useEffect(() => {
    if (transcript) {
      onTranscript?.(transcript);
    }
  }, [transcript, onTranscript]);

  // Auto-speak AI responses when ttsEnabled
  useEffect(() => {
    if (ttsEnabled && textToSpeak && ttsSupported) {
      speak(textToSpeak);
    }
  }, [textToSpeak, ttsEnabled, ttsSupported, speak]);

  // Handle click - toggle listening
  const handleClick = useCallback(() => {
    if (disabled) return;

    // If speaking, stop first
    if (isSpeaking) {
      stopSpeaking();
    }

    toggleListening();
  }, [disabled, isSpeaking, stopSpeaking, toggleListening]);

  // Handle TTS toggle
  const handleTTSToggle = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    }
  }, [isSpeaking, stopSpeaking]);

  // Not supported
  if (!sttSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--muted) opacity-50 cursor-not-allowed"
              aria-label={t("voiceNotSupported")}
            >
              <MicOff className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("voiceNotSupported")}</p>
            <p className="text-xs text-(--warning) mt-1">{t("useChromeOrEdge")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Voice Input Button (STT) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled}
              className={`relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                isListening
                  ? "bg-(--danger) text-(--danger-foreground) animate-pulse shadow-lg shadow-(--danger)/50"
                  : "text-(--muted) hover:bg-(--raised-hover) hover:text-(--accent)"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={isListening ? t("stopListening") : t("startListening")}
            >
              {isListening ? (
                <>
                  <Mic className="w-5 h-5" />
                  {/* Listening indicator rings */}
                  <span className="absolute inset-0 rounded-full border-2 border-(--danger) animate-ping opacity-75" />
                </>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isListening ? t("clickToStop") : t("clickToSpeak")}</p>
            {translatedSttError && <p className="text-(--danger) text-xs">{translatedSttError}</p>}
          </TooltipContent>
        </Tooltip>

        {/* TTS Status/Toggle (only show when speaking) */}
        {isSpeaking && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleTTSToggle}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--accent)/10 text-(--accent) hover:bg-(--accent)/20 transition-colors"
                aria-label={t("stopSpeaking")}
              >
                <Volume2 className="w-4 h-4 animate-pulse" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("clickToStopSpeaking")}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ARIA Live Region for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isListening ? t("listeningAnnouncement").replace("{transcript}", transcript) : ""}
      </div>
    </TooltipProvider>
  );
}

export default VoiceButton;
