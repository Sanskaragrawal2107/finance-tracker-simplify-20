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
  
  // Comprehensive session and connection refresh after tab switch
  const refreshConnections = useCallback(async () => {
    try {
      console.log('Starting comprehensive session refresh after tab switch');
      
      // Step 1: Force refresh the session to get a fresh token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Session refresh failed:', refreshError);
        return false;
      }
      
      if (refreshData?.session) {
        console.log('Session refreshed successfully, token ends with:', refreshData.session.access_token?.slice(-8));
        
        // Step 2: Verify the session is working by making a simple query
        const { data: testData, error: testError } = await supabase
          .from('users')
          .select('id')
          .limit(1);
          
        if (testError) {
          console.error('Session verification query failed:', testError);
          return false;
        }
        
        console.log('Session verification successful');
        return true;
      } else {
        console.log('No session found after refresh, may need to re-authenticate');
        return false;
      }
    } catch (error) {
      console.error('Error in comprehensive session refresh:', error);
      return false;
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
              console.log(`Tab was hidden for ${timeHidden}ms - performing comprehensive session refresh`);
              
              // Perform comprehensive session refresh and verification
              const refreshSuccess = await refreshConnections();
              
              // Dispatch a gentle visibility event with refresh status
              window.dispatchEvent(new CustomEvent('app:visibility-gentle', { 
                detail: { 
                  timeHidden, 
                  timestamp: Date.now(),
                  sessionRefreshed: refreshSuccess
                } 
              }));
              
              if (!refreshSuccess) {
                console.warn('Session refresh failed - user may need to re-authenticate');
                // Dispatch a session failure event for the app to handle
                window.dispatchEvent(new CustomEvent('app:session-failed', {
                  detail: { reason: 'tab-switch-refresh-failed' }
                }));
              }
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