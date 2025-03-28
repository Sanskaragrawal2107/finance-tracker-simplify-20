import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { VisibilityContext } from '@/App';
import { v4 as uuidv4 } from 'uuid';

/**
 * A hook to handle loading states safely with automatic cleanup when browser tabs change.
 * This prevents the infinite loading issue when navigating away from the app and back.
 */
export function useLoadingState(initialState = false) {
  // Generate a unique ID for this component instance
  const componentIdRef = useRef<string>(uuidv4());
  const [isLoading, setIsLoadingState] = useState(initialState);
  
  // Get the visibility context for app-wide reset
  const visibilityContext = useContext(VisibilityContext);
  
  // Set loading state and register it with the visibility system
  const setLoading = useCallback((newLoadingState: boolean) => {
    setIsLoadingState(newLoadingState);
    
    // Register the loading state with the app-wide system
    if (visibilityContext) {
      visibilityContext.registerLoadingState(componentIdRef.current, newLoadingState);
    }
  }, [visibilityContext]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // Deregister when unmounting
      if (visibilityContext) {
        visibilityContext.registerLoadingState(componentIdRef.current, false);
      }
    };
  }, [visibilityContext]);
  
  return [isLoading, setLoading] as const;
} 