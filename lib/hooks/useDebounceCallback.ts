import { useCallback, useEffect, useRef } from "react";

/**
 * Hook that returns a debounced version of the provided callback.
 * The callback will only be executed after the specified delay has passed
 * since the last call.
 *
 * @param callback - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the callback
 */
export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref fresh to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
