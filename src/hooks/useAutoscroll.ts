import { useRef, useEffect, useCallback, RefObject } from 'react';

interface UseAutoscrollOptions {
  /**
   * Threshold in pixels from bottom to consider "at bottom"
   * Default: 100px
   */
  threshold?: number;
  /**
   * Whether scrolling should be smooth or instant
   * Default: true (smooth)
   */
  smooth?: boolean;
  /**
   * Whether to enable autoscroll
   * Default: true
   */
  enabled?: boolean;
  /**
   * Whether streaming mode is active (uses MutationObserver)
   * Default: false (uses dependency-based scrolling)
   */
  isStreaming?: boolean;
}

interface UseAutoscrollReturn {
  /**
   * Ref to attach to the scrollable container
   */
  scrollRef: RefObject<HTMLDivElement | null>;
  /**
   * Manually scroll to bottom
   */
  scrollToBottom: () => void;
  /**
   * Check if currently at bottom
   */
  isAtBottom: () => boolean;
}

/**
 * Unified autoscroll hook for chat-like interfaces
 * Handles both static conversation updates and real-time streaming
 * Only scrolls when user is at/near the bottom of the container
 */
export function useAutoscroll(
  dependency: any,
  options: UseAutoscrollOptions = {}
): UseAutoscrollReturn {
  const {
    threshold = 100,
    smooth = true,
    enabled = true,
    isStreaming = false
  } = options;

  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef<boolean>(true); // Track if we should autoscroll

  /**
   * Check if user is at or near the bottom of the scroll container
   */
  const isAtBottom = useCallback((): boolean => {
    if (!scrollRef.current) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return scrollTop + clientHeight >= scrollHeight - threshold;
  }, [threshold]);

  /**
   * Scroll to bottom of container
   */
  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;

    const container = scrollRef.current;
    const scrollTop = container.scrollHeight - container.clientHeight;

    if (smooth) {
      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    } else {
      container.scrollTop = scrollTop;
    }
  }, [smooth]);

  /**
   * Handle scroll events to track user intent
   */
  const handleScroll = useCallback(() => {
    wasAtBottomRef.current = isAtBottom();
  }, [isAtBottom]);

  /**
   * Perform autoscroll if user was at bottom
   */
  const performAutoscroll = useCallback(() => {
    if (wasAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [scrollToBottom]);

  // Set up scroll listener to track user scroll behavior
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !enabled) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, enabled]);

  // Handle dependency-based autoscroll (when not streaming)
  useEffect(() => {
    if (!enabled || !scrollRef.current || isStreaming) return;

    // On first render, always scroll to bottom
    if (dependency === null || dependency === undefined) {
      wasAtBottomRef.current = true;
      scrollToBottom();
      return;
    }

    // Only autoscroll if user was at bottom before the change
    performAutoscroll();
  }, [dependency, scrollToBottom, enabled, isStreaming, performAutoscroll]);

  // Handle streaming autoscroll (using MutationObserver)
  useEffect(() => {
    if (!enabled || !isStreaming || !scrollRef.current) return;

    const container = scrollRef.current;

    /**
     * Handle content mutations and scroll if user is at bottom
     */
    const handleMutation = (): void => {
      performAutoscroll();
    };

    // Set up MutationObserver to watch for content changes during streaming
    const observer = new MutationObserver(handleMutation);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Initial scroll when streaming starts (if user is at bottom)
    if (isAtBottom()) {
      scrollToBottom();
    }

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, [isStreaming, enabled, performAutoscroll, scrollToBottom, isAtBottom]);

  return {
    scrollRef,
    scrollToBottom,
    isAtBottom
  };
} 