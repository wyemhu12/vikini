// app/features/chat/components/VoiceButton.tsx
"use client";

import React, { useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useSpeechRecognition, useSpeechSynthesis } from "@/lib/features/voice";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VoiceButtonProps {
  /** Callback when voice transcript is available */
  onTranscript: (text: string) => void;
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
  /** Translation strings */
  t?: Record<string, string>;
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
  t,
}: VoiceButtonProps) {
  // Speech Recognition (STT)
  const {
    isListening,
    isSupported: sttSupported,
    transcript,
    toggleListening,
    stopListening: _stopListening,
    error: sttError,
  } = useSpeechRecognition({
    language,
    continuous: true,
    interimResults: true,
    silenceTimeout: 3000, // Stop after 3s silence
    onFinalResult: (text) => {
      onFinalTranscript?.(text);
    },
  });

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
      onTranscript(transcript);
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-secondary) opacity-50 cursor-not-allowed"
              aria-label="Voice input not supported"
            >
              <MicOff className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t?.voiceNotSupported || "Voice input not supported in this browser"}</p>
            <p className="text-xs text-yellow-500 mt-1">
              {t?.useChromeOrEdge || "Use Chrome or Edge for voice features"}
            </p>
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
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50"
                  : "text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--accent)"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={
                isListening
                  ? t?.stopListening || "Stop listening"
                  : t?.startListening || "Start voice input"
              }
            >
              {isListening ? (
                <>
                  <Mic className="w-5 h-5" />
                  {/* Listening indicator rings */}
                  <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75" />
                </>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isListening
                ? t?.clickToStop || "Click to stop"
                : t?.clickToSpeak || "Click to speak"}
            </p>
            {sttError && <p className="text-red-400 text-xs">{sttError}</p>}
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
                aria-label={t?.stopSpeaking || "Stop speaking"}
              >
                <Volume2 className="w-4 h-4 animate-pulse" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t?.clickToStopSpeaking || "Click to stop AI voice"}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ARIA Live Region for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isListening ? t?.listeningAnnouncement || `Listening: ${transcript}` : ""}
      </div>
    </TooltipProvider>
  );
}

export default VoiceButton;
