import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that handles browser tab visibility changes and refreshes data when the tab becomes visible again.
 * Updated to prevent event handler interference and maintain React event system integrity.
 */
export function useVisibilityRefresh(minHiddenDuration = 5000) {
  const lastVisibleTimeRef = useRef(Date.now());
  const loadingStateRef = useRef<{[key: string]: boolean}>({});
  const isHandlingVisibilityRef = useRef(false);
  
  // Set a loading state with a key
  const setLoading = useCallback((key: string, isLoading: boolean) => {
    loadingStateRef.current[key] = isLoading;
  }, []);
  
  // Clear all loading states (but only if safe to do so)
  const clearAllLoadingStates = useCallback(() => {
    // Only clear if we're not in the middle of handling visibility
    if (!isHandlingVisibilityRef.current) {
      loadingStateRef.current = {};
    }
  }, []);
  
  // Gentle connection refresh without disrupting active connections
  const refreshConnections = useCallback(async () => {
    try {
      // Don't forcefully disconnect - just ensure we have a good session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Session verified after tab switch');
      } else {
        console.log('No session found, may need to re-authenticate');
      }
    } catch (error) {
      console.error('Error checking session after tab switch:', error);
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible again
        const timeHidden = Date.now() - lastVisibleTimeRef.current;
        console.log(`Tab became visible after ${timeHidden}ms`);
        
        // Only take action if the tab was hidden for a significant duration
        if (timeHidden > minHiddenDuration) {
          isHandlingVisibilityRef.current = true;
          
          // Use a small delay to allow React to stabilize
          timeoutId = setTimeout(async () => {
            try {
              console.log(`Tab was hidden for ${timeHidden}ms - refreshing session only`);
              
              // Only refresh session, don't clear states or force reconnections
              await refreshConnections();
              
              // Dispatch a gentle visibility event without forcing state changes
              window.dispatchEvent(new CustomEvent('app:visibility-gentle', { 
                detail: { timeHidden, timestamp: Date.now() } 
              }));
            } catch (error) {
              console.error('Error handling visibility change:', error);
            } finally {
              isHandlingVisibilityRef.current = false;
            }
          }, 100); // Small delay to let React settle
        }
      } else {
        // Tab is being hidden, store the current time
        lastVisibleTimeRef.current = Date.now();
        console.log('Tab hidden at:', new Date().toISOString());
      }
    };

    // Listen for visibility changes with passive option for better performance
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [minHiddenDuration, refreshConnections]);

  return {
    setLoading,
    clearAllLoadingStates
  };
}