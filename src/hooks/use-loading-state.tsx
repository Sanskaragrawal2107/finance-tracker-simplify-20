import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * A simple hook to handle loading states with automatic timeout protection.
 * This prevents infinite loading states without complex visibility management.
 */
export function useLoadingState(initialState = false, timeout = 15000) {
  const [isLoading, setIsLoadingState] = useState(initialState);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear any active timeout
  const clearLoadingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  // Set loading state with optional timeout protection
  const setLoading = useCallback((newLoadingState: boolean) => {
    setIsLoadingState(newLoadingState);
    
    // Clear any existing timeout
    clearLoadingTimeout();
    
    // If setting to loading, add a safety timeout to prevent infinite loading
    if (newLoadingState && timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        console.warn(`Loading state timed out after ${timeout}ms, automatically clearing`);
        setIsLoadingState(false);
      }, timeout);
    }
  }, [clearLoadingTimeout, timeout]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      clearLoadingTimeout();
    };
  }, [clearLoadingTimeout]);
  
  return [isLoading, setLoading] as const;
}
