// Chat scroll management hook
// Extracted from ChatApp.tsx for modularity

import { useRef, useCallback, useEffect } from "react";

interface UseChatScrollOptions {
  isStreaming: boolean;
  streamingAssistant: string | null;
  renderedMessagesLength: number;
  lastGeneratedImage: unknown;
}

export function useChatScroll({
  isStreaming,
  streamingAssistant,
  renderedMessagesLength,
  lastGeneratedImage,
}: UseChatScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const userScrollTimestampRef = useRef(0);
  const isTouchingRef = useRef(false);

  // Touch handlers for mobile scroll detection
  const handleTouchStart = useCallback(() => {
    isTouchingRef.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    isTouchingRef.current = false;
  }, []);

  // Detect user scroll: if user scrolls UP, disable auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const currentScrollTop = el.scrollTop;
    const maxScrollTop = el.scrollHeight - el.clientHeight;
    const distanceFromBottom = maxScrollTop - currentScrollTop;

    // User scrolled UP (away from bottom) - use larger threshold for touch
    const scrollUpThreshold = isTouchingRef.current ? 150 : 80;
    if (currentScrollTop < lastScrollTopRef.current && distanceFromBottom > scrollUpThreshold) {
      shouldAutoScrollRef.current = false;
      userScrollTimestampRef.current = Date.now();
    }

    // User scrolled back to bottom (within threshold)
    const bottomThreshold = isTouchingRef.current ? 80 : 30;
    if (distanceFromBottom <= bottomThreshold) {
      shouldAutoScrollRef.current = true;
    }

    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // Reset auto-scroll when starting a new stream - but respect recent user scroll
  useEffect(() => {
    if (isStreaming && streamingAssistant === "") {
      // Only auto-enable if user hasn't scrolled up in the last 500ms
      const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
      if (timeSinceUserScroll > 500) {
        shouldAutoScrollRef.current = true;
      }
    }
  }, [isStreaming, streamingAssistant]);

  // Auto-scroll during streaming (if enabled and user not actively touching)
  useEffect(() => {
    if (!scrollRef.current || !isStreaming || !shouldAutoScrollRef.current) return;
    // Skip auto-scroll while user is touching (mobile momentum scroll)
    if (isTouchingRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [streamingAssistant, isStreaming]);

  // Scroll to bottom when stream ends (if auto-scroll was not cancelled)
  useEffect(() => {
    if (!scrollRef.current) return;
    // Only scroll when NOT streaming (stream just ended or new messages loaded)
    if (!isStreaming && shouldAutoScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [renderedMessagesLength, isStreaming, lastGeneratedImage]);

  return {
    scrollRef,
    handleScroll,
    handleTouchStart,
    handleTouchEnd,
  };
}
