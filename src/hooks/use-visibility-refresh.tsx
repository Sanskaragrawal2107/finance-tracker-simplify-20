import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that handles browser tab visibility changes and refreshes data when the tab becomes visible again.
 * Used to fix infinite loading states when switching browser tabs.
 */
export function useVisibilityRefresh(minHiddenDuration = 5000) {
  const lastVisibleTimeRef = useRef(Date.now());
  const loadingStateRef = useRef<{[key: string]: boolean}>({});
  
  // Set a loading state with a key
  const setLoading = useCallback((key: string, isLoading: boolean) => {
    loadingStateRef.current[key] = isLoading;
  }, []);
  
  // Clear all loading states
  const clearAllLoadingStates = useCallback(() => {
    loadingStateRef.current = {};
  }, []);
  
  // Reset connection to ensure all subscriptions are refreshed
  const resetConnections = useCallback(() => {
    // Force reconnection of Supabase client
    supabase.removeAllChannels();
    
    // Reconnect after a short delay
    setTimeout(() => {
      supabase.channel('system').subscribe();
    }, 100);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible again
        const timeHidden = Date.now() - lastVisibleTimeRef.current;
        console.log('Tab became visible after being hidden for', timeHidden, 'ms');
        
        // Only refresh if the tab was hidden for longer than the minimum duration
        if (timeHidden > minHiddenDuration) {
          console.log('Clearing loading states and reconnecting...');
          clearAllLoadingStates();
          resetConnections();
          
          // Force a page re-render by dispatching a custom event
          window.dispatchEvent(new CustomEvent('app:visibility-change', { 
            detail: { timeHidden } 
          }));
        }
      } else {
        // Tab is being hidden, store the current time
        lastVisibleTimeRef.current = Date.now();
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [minHiddenDuration, clearAllLoadingStates, resetConnections]);

  return {
    setLoading,
    clearAllLoadingStates
  };
} 