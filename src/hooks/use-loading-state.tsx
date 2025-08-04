import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { VisibilityContext } from '@/App';
import { v4 as uuidv4 } from 'uuid';

/**
 * A hook to handle loading states safely with automatic cleanup when browser tabs change.
 * This prevents the infinite loading issue when navigating away from the app and back.
 */
export function useLoadingState(initialState = false, timeout = 15000) {
  // Generate a unique ID for this component instance
  const componentIdRef = useRef<string>(uuidv4());
  const [isLoading, setIsLoadingState] = useState(initialState);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get the visibility context for app-wide reset
  const visibilityContext = useContext(VisibilityContext);
  
  // Clear any active timeout
  const clearLoadingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  // Set loading state and register it with the visibility system
  const setLoading = useCallback((newLoadingState: boolean) => {
    setIsLoadingState(newLoadingState);
    
    // Register the loading state with the app-wide system
    if (visibilityContext) {
      visibilityContext.registerLoadingState(componentIdRef.current, newLoadingState);
    }
    
    // Clear any existing timeout
    clearLoadingTimeout();
    
    // If setting to loading, add a safety timeout to prevent infinite loading
    if (newLoadingState && timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        console.warn(`Loading state timed out after ${timeout}ms, forcing reset`);
        setIsLoadingState(false);
        if (visibilityContext) {
          visibilityContext.registerLoadingState(componentIdRef.current, false);
        }
      }, timeout);
    }
  }, [visibilityContext, clearLoadingTimeout, timeout]);
  
  // Note: Removed visibility change handler that was interfering with form submissions
  // The app-wide visibility system in App.tsx handles stuck loading states with proper timeouts
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // Clear any active timeout
      clearLoadingTimeout();
      
      // Deregister when unmounting
      if (visibilityContext) {
        visibilityContext.registerLoadingState(componentIdRef.current, false);
      }
    };
  }, [visibilityContext, clearLoadingTimeout]);
  
  return [isLoading, setLoading] as const;
} 