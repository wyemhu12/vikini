// lib/features/voice/useSpeechRecognition.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Speech Recognition Status
 */
export type SpeechStatus = "idle" | "listening" | "processing" | "error";

/**
 * Speech Recognition Result
 */
export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

/**
 * Speech Recognition Options
 */
export interface SpeechRecognitionOptions {
  /** Language code (default: navigator language or 'vi-VN') */
  language?: string;
  /** Enable continuous recognition (default: true) */
  continuous?: boolean;
  /** Enable interim results (default: true) */
  interimResults?: boolean;
  /** Auto-stop after silence (ms, default: 2000) */
  silenceTimeout?: number;
  /** Callback when transcript updates */
  onTranscript?: (result: SpeechResult) => void;
  /** Callback when final result is ready */
  onFinalResult?: (transcript: string) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Hook return type
 */
export interface UseSpeechRecognitionReturn {
  /** Current status */
  status: SpeechStatus;
  /** Current transcript (interim or final) */
  transcript: string;
  /** Whether speech recognition is supported */
  isSupported: boolean;
  /** Whether currently listening */
  isListening: boolean;
  /** Start listening */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Toggle listening state */
  toggleListening: () => void;
  /** Reset transcript */
  resetTranscript: () => void;
  /** Last error message */
  error: string | null;
}

/**
 * Custom hook for Web Speech API Speech Recognition
 * Works in Chrome, Edge, Safari (partial). Firefox not supported.
 *
 * @example
 * ```tsx
 * const { transcript, isListening, toggleListening } = useSpeechRecognition({
 *   language: 'vi-VN',
 *   onFinalResult: (text) => setInput(prev => prev + text)
 * });
 * ```
 */
export function useSpeechRecognition(
  options: SpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    language,
    continuous = true,
    interimResults = true,
    silenceTimeout = 2000,
    onTranscript,
    onFinalResult,
    onError,
  } = options;

  // State
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");

  // Check support on mount
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // Clear silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Stop listening - define FIRST to avoid circular dependency
  const stopListening = useCallback(() => {
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setStatus("idle");
  }, []);

  // Reset silence timer - uses stopListening
  const resetSilenceTimer = useCallback(() => {
    // Clear existing timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceTimeout > 0) {
      silenceTimerRef.current = setTimeout(() => {
        stopListening();
      }, silenceTimeout);
    }
  }, [silenceTimeout, stopListening]);

  // Start listening
  const startListening = useCallback(async () => {
    console.log("[Voice] startListening called, isSupported:", isSupported);

    if (!isSupported) {
      const msg = "Speech recognition is not supported in this browser";
      console.error("[Voice]", msg);
      setError(msg);
      onError?.(msg);
      return;
    }

    // Reset state
    setError(null);
    setTranscript("");
    finalTranscriptRef.current = "";

    try {
      // Explicitly request microphone access first
      // This fixes "not-allowed" errors in some browsers where SpeechRecognition
      // fails to prompt for permission properly
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop the stream - we just needed the permission
      stream.getTracks().forEach((track) => track.stop());
      console.log("[Voice] Microphone permission granted via getUserMedia");
    } catch (err) {
      console.error("[Voice] Failed to get microphone permission:", err);
      const msg = "Microphone access denied. Please allow microphone access.";
      setError(msg);
      setStatus("error");
      onError?.(msg);
      return;
    }

    // Create recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    console.log("[Voice] Created SpeechRecognition instance");

    // Configure
    recognition.lang = language || navigator.language || "vi-VN";
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    // Event handlers
    recognition.onstart = () => {
      console.log("[Voice] Recognition started, listening...");
      setStatus("listening");
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      // Update final transcript accumulator
      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
        onFinalResult?.(finalTranscript);
      }

      // Update displayed transcript
      const currentTranscript = finalTranscriptRef.current + interimTranscript;
      setTranscript(currentTranscript);

      // Callback with result
      if (interimTranscript || finalTranscript) {
        onTranscript?.({
          transcript: finalTranscript || interimTranscript,
          isFinal: !!finalTranscript,
          confidence: event.results[event.results.length - 1][0].confidence || 0,
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[Voice] onerror fired! error type:", event.error, "message:", event.message);

      // Clear timer on error
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "Microphone not accessible. Please check permissions.",
        "not-allowed": "Microphone access denied. Please allow microphone access.",
        network: "Network error. Please check your connection.",
        aborted: "Recognition was aborted.",
      };

      const msg = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
      setError(msg);
      setStatus("error");
      onError?.(msg);
    };

    recognition.onend = () => {
      console.log("[Voice] onend fired - recognition stopped");

      // Clear timer on end
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setStatus("idle");
    };

    // Start recognition
    try {
      recognition.start();
      recognitionRef.current = recognition;
      console.log("[Voice] recognition.start() called successfully");
      // Set status immediately (don't wait for onstart which may not fire on some browsers)
      setStatus("listening");
    } catch (err) {
      console.error("[Voice] recognition.start() failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to start speech recognition";
      setError(msg);
      setStatus("error");
      onError?.(msg);
    }
  }, [
    isSupported,
    language,
    continuous,
    interimResults,
    resetSilenceTimer,
    onTranscript,
    onFinalResult,
    onError,
  ]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (status === "listening") {
      stopListening();
    } else {
      startListening();
    }
  }, [status, startListening, stopListening]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript("");
    finalTranscriptRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [clearSilenceTimer]);

  return {
    status,
    transcript,
    isSupported,
    isListening: status === "listening",
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error,
  };
}
