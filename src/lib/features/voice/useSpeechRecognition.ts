// lib/features/voice/useSpeechRecognition.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type SpeechStatus = "idle" | "listening" | "processing" | "error";

export type SpeechErrorCode =
  | "not-supported"
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "start-failed"
  | "unknown";

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  silenceTimeout?: number;
  onTranscript?: (result: SpeechResult) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string, errorCode: SpeechErrorCode) => void;
}

export interface UseSpeechRecognitionReturn {
  status: SpeechStatus;
  transcript: string;
  isSupported: boolean;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
  errorCode: SpeechErrorCode | null;
}

const KNOWN_SPEECH_ERROR_CODES: ReadonlySet<string> = new Set([
  "no-speech",
  "audio-capture",
  "not-allowed",
  "network",
  "aborted",
]);

function mapSpeechErrorCode(rawCode: string): SpeechErrorCode {
  return KNOWN_SPEECH_ERROR_CODES.has(rawCode) ? (rawCode as SpeechErrorCode) : "unknown";
}

const DEFAULT_ERROR_MESSAGES: Record<SpeechErrorCode, string> = {
  "not-supported": "Speech recognition is not supported in this browser",
  "not-allowed": "Microphone access denied. Please allow microphone access.",
  "no-speech": "No speech detected. Please try again.",
  "audio-capture": "Microphone not accessible. Please check permissions.",
  network: "Network error. Please check your connection.",
  aborted: "Recognition was aborted.",
  "start-failed": "Failed to start speech recognition",
  unknown: "Speech recognition error",
};

/**
 * Custom hook for Web Speech API Speech Recognition.
 * Stabilizes callbacks via refs and guards against overlapping restarts,
 * duplicate getUserMedia calls, and React 19 Strict Mode unmount/remount races.
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

  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<SpeechErrorCode | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const isUnmountedRef = useRef(false);
  const startSessionIdRef = useRef(0);

  // Ref-stabilized callbacks prevent stale closures in continuous recognition
  const onTranscriptRef = useRef(onTranscript);
  const onFinalResultRef = useRef(onFinalResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onFinalResultRef.current = onFinalResult;
    onErrorRef.current = onError;
  }, [onTranscript, onFinalResult, onError]);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setIsSupported(!!SpeechRecognitionCtor);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    startSessionIdRef.current += 1;
    clearSilenceTimer();
    const active = recognitionRef.current;
    recognitionRef.current = null;
    if (active) {
      try {
        active.stop();
      } catch {
        // Ignore stop errors on already-stopped instances
      }
    }
    if (!isUnmountedRef.current) {
      setStatus("idle");
    }
  }, [clearSilenceTimer]);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    if (silenceTimeout > 0) {
      silenceTimerRef.current = setTimeout(() => {
        stopListening();
      }, silenceTimeout);
    }
  }, [clearSilenceTimer, silenceTimeout, stopListening]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      const code: SpeechErrorCode = "not-supported";
      const msg = DEFAULT_ERROR_MESSAGES[code];
      setError(msg);
      setErrorCode(code);
      onErrorRef.current?.(msg, code);
      return;
    }

    const sessionId = ++startSessionIdRef.current;

    // Detach and abort any prior instance so late R1 events cannot clobber R2
    const prevRecognition = recognitionRef.current;
    recognitionRef.current = null;
    clearSilenceTimer();
    if (prevRecognition) {
      try {
        prevRecognition.abort();
      } catch {
        // Ignore abort errors on restart
      }
    }

    setError(null);
    setErrorCode(null);
    setTranscript("");
    finalTranscriptRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      if (isUnmountedRef.current || startSessionIdRef.current !== sessionId) return;
      const code: SpeechErrorCode = "not-allowed";
      const msg = DEFAULT_ERROR_MESSAGES[code];
      setError(msg);
      setErrorCode(code);
      setStatus("error");
      onErrorRef.current?.(msg, code);
      return;
    }

    if (isUnmountedRef.current || startSessionIdRef.current !== sessionId) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();

    recognition.lang = language || navigator.language || "vi-VN";
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition || isUnmountedRef.current) return;
      setStatus("listening");
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (recognitionRef.current !== recognition || isUnmountedRef.current) return;
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

      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
        onFinalResultRef.current?.(finalTranscript);
      }

      const currentTranscript = finalTranscriptRef.current + interimTranscript;
      setTranscript(currentTranscript);

      if (interimTranscript || finalTranscript) {
        onTranscriptRef.current?.({
          transcript: finalTranscript || interimTranscript,
          isFinal: !!finalTranscript,
          confidence: event.results[event.results.length - 1][0].confidence || 0,
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition || isUnmountedRef.current) return;
      clearSilenceTimer();

      const code = mapSpeechErrorCode(event.error);
      const msg =
        code === "unknown"
          ? `Speech recognition error: ${event.error}`
          : DEFAULT_ERROR_MESSAGES[code];
      setError(msg);
      setErrorCode(code);
      setStatus("error");
      onErrorRef.current?.(msg, code);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition || isUnmountedRef.current) return;
      recognitionRef.current = null;
      clearSilenceTimer();
      setStatus("idle");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      if (recognitionRef.current === recognition && !isUnmountedRef.current) {
        setStatus("listening");
      }
    } catch (err: unknown) {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      if (isUnmountedRef.current) return;
      const code: SpeechErrorCode = "start-failed";
      const msg = err instanceof Error ? err.message : DEFAULT_ERROR_MESSAGES[code];
      setError(msg);
      setErrorCode(code);
      setStatus("error");
      onErrorRef.current?.(msg, code);
    }
  }, [clearSilenceTimer, continuous, interimResults, isSupported, language, resetSilenceTimer]);

  const toggleListening = useCallback(() => {
    if (status === "listening") {
      stopListening();
    } else {
      void startListening();
    }
  }, [status, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    finalTranscriptRef.current = "";
  }, []);

  // Strict-Mode resilient cleanup on unmount
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      startSessionIdRef.current += 1;
      clearSilenceTimer();
      const active = recognitionRef.current;
      recognitionRef.current = null;
      if (active) {
        try {
          active.abort();
        } catch {
          // Ignore abort errors on unmount
        }
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
    errorCode,
  };
}
