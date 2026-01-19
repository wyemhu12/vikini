// app/features/chat/hooks/useTTS.ts
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { detectLanguage } from "@/lib/utils/detectLanguage";

/**
 * Hook for managing TTS state per message in chat.
 * Handles speaking a message and tracking which message is currently being spoken.
 */
export function useTTS() {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isCurrentlySpeaking, setIsCurrentlySpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser support
  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Speak a message with auto language detection
  const speakMessage = useCallback(
    (messageId: string, text: string) => {
      if (!isSupported || !text.trim()) return;

      // If same message is speaking, stop it (toggle behavior)
      if (speakingMessageId === messageId && isCurrentlySpeaking) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
        setIsCurrentlySpeaking(false);
        return;
      }

      // Stop any current speech first
      window.speechSynthesis.cancel();

      // Detect language and create utterance
      const lang = detectLanguage(text);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Track state changes
      utterance.onstart = () => {
        setSpeakingMessageId(messageId);
        setIsCurrentlySpeaking(true);
      };

      utterance.onend = () => {
        setSpeakingMessageId(null);
        setIsCurrentlySpeaking(false);
      };

      utterance.onerror = () => {
        setSpeakingMessageId(null);
        setIsCurrentlySpeaking(false);
      };

      // Store ref and speak
      utteranceRef.current = utterance;
      setSpeakingMessageId(messageId); // Optimistic update
      setIsCurrentlySpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, speakingMessageId, isCurrentlySpeaking]
  );

  // Stop all speech
  const stopSpeaking = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    setIsCurrentlySpeaking(false);
  }, [isSupported]);

  // Check if a specific message is being spoken
  const isMessageSpeaking = useCallback(
    (messageId: string) => {
      return speakingMessageId === messageId && isCurrentlySpeaking;
    },
    [speakingMessageId, isCurrentlySpeaking]
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
    speakMessage,
    stopSpeaking,
    isMessageSpeaking,
    speakingMessageId,
    isSpeaking: isCurrentlySpeaking,
    isSupported,
  };
}
