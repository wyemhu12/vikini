// lib/features/voice/useSpeechSynthesis.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Speech Synthesis Status
 */
export type SynthesisStatus = "idle" | "speaking" | "paused";

/**
 * Speech Synthesis Options
 */
export interface SpeechSynthesisOptions {
  /** Language code (default: navigator language or 'vi-VN') */
  language?: string;
  /** Speech rate (0.1 - 10, default: 1) */
  rate?: number;
  /** Pitch (0 - 2, default: 1) */
  pitch?: number;
  /** Volume (0 - 1, default: 1) */
  volume?: number;
  /** Preferred voice name (optional) */
  voiceName?: string;
  /** Callback when speech starts */
  onStart?: () => void;
  /** Callback when speech ends */
  onEnd?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Hook return type
 */
export interface UseSpeechSynthesisReturn {
  /** Current status */
  status: SynthesisStatus;
  /** Whether TTS is supported */
  isSupported: boolean;
  /** Whether currently speaking */
  isSpeaking: boolean;
  /** Available voices */
  voices: SpeechSynthesisVoice[];
  /** Current voice */
  currentVoice: SpeechSynthesisVoice | null;
  /** Speak text */
  speak: (text: string) => void;
  /** Stop speaking */
  stop: () => void;
  /** Pause speaking */
  pause: () => void;
  /** Resume speaking */
  resume: () => void;
  /** Set voice by name or language */
  setVoice: (voiceNameOrLang: string) => void;
  /** Last error message */
  error: string | null;
}

/**
 * Custom hook for Web Speech API Speech Synthesis (Text-to-Speech)
 * Works in all modern browsers.
 *
 * @example
 * ```tsx
 * const { speak, stop, isSpeaking } = useSpeechSynthesis({
 *   language: 'vi-VN',
 *   rate: 1.1
 * });
 *
 * // Speak AI response
 * speak("Xin chào! Tôi là AI assistant.");
 * ```
 */
export function useSpeechSynthesis(options: SpeechSynthesisOptions = {}): UseSpeechSynthesisReturn {
  const { language, rate = 1, pitch = 1, volume = 1, voiceName, onStart, onEnd, onError } = options;

  // State
  const [status, setStatus] = useState<SynthesisStatus>("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Refs
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check support and load voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Auto-select voice
      if (availableVoices.length > 0) {
        const targetLang = language || navigator.language || "vi-VN";

        // Priority: 1) Exact voice name match, 2) Language match, 3) First available
        let selectedVoice = voiceName ? availableVoices.find((v) => v.name === voiceName) : null;

        if (!selectedVoice) {
          // Try to find Vietnamese or English voice
          selectedVoice = availableVoices.find((v) => v.lang.startsWith(targetLang.split("-")[0]));
        }

        if (!selectedVoice) {
          // Fallback to first available
          selectedVoice = availableVoices[0];
        }

        setCurrentVoice(selectedVoice);
      }
    };

    // Voices may load asynchronously
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [language, voiceName]);

  // Speak text
  const speak = useCallback(
    (text: string) => {
      if (!isSupported) {
        const msg = "Speech synthesis is not supported in this browser";
        setError(msg);
        onError?.(msg);
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);

      // Apply settings
      if (currentVoice) {
        utterance.voice = currentVoice;
      }
      utterance.lang = language || navigator.language || "vi-VN";
      utterance.rate = Math.max(0.1, Math.min(10, rate));
      utterance.pitch = Math.max(0, Math.min(2, pitch));
      utterance.volume = Math.max(0, Math.min(1, volume));

      // Event handlers
      utterance.onstart = () => {
        setStatus("speaking");
        setError(null);
        onStart?.();
      };

      utterance.onend = () => {
        setStatus("idle");
        onEnd?.();
      };

      utterance.onerror = (event) => {
        const errorMessages: Record<string, string> = {
          canceled: "Speech was canceled",
          interrupted: "Speech was interrupted",
          "audio-busy": "Audio output device is busy",
          "audio-hardware": "Audio hardware error",
          network: "Network error during speech",
          "synthesis-unavailable": "Speech synthesis unavailable",
          "synthesis-failed": "Speech synthesis failed",
          "language-unavailable": "Language not available for speech",
          "voice-unavailable": "Voice not available for speech",
          "not-allowed": "Speech synthesis not allowed",
        };

        const msg = errorMessages[event.error] || `Speech error: ${event.error}`;
        setError(msg);
        setStatus("idle");
        onError?.(msg);
      };

      utterance.onpause = () => {
        setStatus("paused");
      };

      utterance.onresume = () => {
        setStatus("speaking");
      };

      // Store reference and speak
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, currentVoice, language, rate, pitch, volume, onStart, onEnd, onError]
  );

  // Stop speaking
  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setStatus("idle");
    }
  }, [isSupported]);

  // Pause speaking
  const pause = useCallback(() => {
    if (isSupported && status === "speaking") {
      window.speechSynthesis.pause();
      setStatus("paused");
    }
  }, [isSupported, status]);

  // Resume speaking
  const resume = useCallback(() => {
    if (isSupported && status === "paused") {
      window.speechSynthesis.resume();
      setStatus("speaking");
    }
  }, [isSupported, status]);

  // Set voice
  const setVoice = useCallback(
    (voiceNameOrLang: string) => {
      const voice = voices.find(
        (v) => v.name === voiceNameOrLang || v.lang.startsWith(voiceNameOrLang)
      );
      if (voice) {
        setCurrentVoice(voice);
      }
    },
    [voices]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    status,
    isSupported,
    isSpeaking: status === "speaking",
    voices,
    currentVoice,
    speak,
    stop,
    pause,
    resume,
    setVoice,
    error,
  };
}
