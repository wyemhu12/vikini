// Chat scroll management hook
// Extracted from ChatApp.tsx for modularity

import { useRef, useCallback, useEffect, useState } from "react";

interface UseChatScrollOptions {
  isStreaming: boolean;
  streamingAssistant: string | null;
  renderedMessagesLength: number;
  lastGeneratedImage?: unknown;
  conversationId?: string | null;
}

export function useChatScroll({
  isStreaming,
  streamingAssistant,
  renderedMessagesLength,
  lastGeneratedImage,
  conversationId,
}: UseChatScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const userScrollTimestampRef = useRef(0);
  const isTouchingRef = useRef(false);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Touch handlers for mobile scroll detection
  const handleTouchStart = useCallback(() => {
    isTouchingRef.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    isTouchingRef.current = false;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    shouldAutoScrollRef.current = true;
    setIsAtBottom(true);
    setUnreadCount(0);
    if (typeof el.scrollTo === "function") {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      el.scrollTop = el.scrollHeight;
    }
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
    const atBottom = distanceFromBottom <= bottomThreshold;
    setIsAtBottom(atBottom);

    if (atBottom) {
      shouldAutoScrollRef.current = true;
      setUnreadCount(0);
    }

    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // Reset state when switching conversations
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setIsAtBottom(true);
    setUnreadCount(0);
  }, [conversationId]);

  // Track unread messages when user is scrolled up
  const prevCountRef = useRef(renderedMessagesLength);
  useEffect(() => {
    if (renderedMessagesLength > prevCountRef.current) {
      const delta = renderedMessagesLength - prevCountRef.current;
      if (!isAtBottom) {
        setUnreadCount((c) => c + delta);
      } else {
        setUnreadCount(0);
      }
    }
    prevCountRef.current = renderedMessagesLength;
  }, [renderedMessagesLength, isAtBottom]);

  // Reset auto-scroll when starting a new stream - but respect recent user scroll
  useEffect(() => {
    if (isStreaming && streamingAssistant === "") {
      const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
      if (timeSinceUserScroll > 500) {
        shouldAutoScrollRef.current = true;
      }
    }
  }, [isStreaming, streamingAssistant]);

  // Auto-scroll during streaming (if enabled and user not actively touching)
  useEffect(() => {
    if (!scrollRef.current || !isStreaming || !shouldAutoScrollRef.current) return;
    if (isTouchingRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [streamingAssistant, isStreaming]);

  // Scroll to bottom when stream ends (if auto-scroll was not cancelled)
  useEffect(() => {
    if (!scrollRef.current) return;
    if (!isStreaming && shouldAutoScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [renderedMessagesLength, isStreaming, lastGeneratedImage]);

  return {
    scrollRef,
    handleScroll,
    handleTouchStart,
    handleTouchEnd,
    isAtBottom,
    unreadCount,
    scrollToBottom,
  };
}
