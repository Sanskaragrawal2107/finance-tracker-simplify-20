import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that handles browser tab visibility changes and refreshes data when the tab becomes visible again.
 * Updated to prevent event handler interference and maintain React event system integrity.
 */
// Global singleton to prevent duplicate listeners across all instances
const globalVisibilityState = {
  listenerAttached: false,
  instances: new Set(),
  lastVisibleTime: Date.now(),
  isHandling: false
};

export function useVisibilityRefresh(minHiddenDuration = 5000) {
  const lastVisibleTimeRef = useRef(Date.now());
  const loadingStateRef = useRef<{[key: string]: boolean}>({});
  const isHandlingVisibilityRef = useRef(false);
  const instanceIdRef = useRef(Math.random().toString(36).substr(2, 9));
  
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
  
  // Aggressive session recovery after tab switch
  const refreshConnections = useCallback(async () => {
    try {
      console.log('Starting aggressive session recovery after tab switch');
      
      // Step 1: Get current session to check if we have one
      const { data: currentSession } = await supabase.auth.getSession();
      
      if (!currentSession?.session) {
        console.error('No current session found');
        return false;
      }
      
      console.log('Current session token ends with:', currentSession.session.access_token?.slice(-8));
      
      // Step 2: Force refresh the session multiple times if needed
      let refreshAttempts = 0;
      let refreshSuccess = false;
      
      while (refreshAttempts < 3 && !refreshSuccess) {
        refreshAttempts++;
        console.log(`Session refresh attempt ${refreshAttempts}/3`);
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error(`Session refresh attempt ${refreshAttempts} failed:`, refreshError);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          continue;
        }
        
        if (refreshData?.session) {
          console.log(`Session refresh attempt ${refreshAttempts} successful, token ends with:`, refreshData.session.access_token?.slice(-8));
          
          // Step 3: Verify the session works with multiple test queries
          const testQueries = [
            () => supabase.from('users').select('id').limit(1),
            () => supabase.from('sites').select('id').limit(1),
            () => supabase.auth.getUser()
          ];
          
          let allTestsPassed = true;
          
          for (let i = 0; i < testQueries.length; i++) {
            try {
              const result = await testQueries[i]();
              if (result.error) {
                console.error(`Test query ${i + 1} failed:`, result.error);
                allTestsPassed = false;
                break;
              }
              console.log(`Test query ${i + 1} passed`);
            } catch (error) {
              console.error(`Test query ${i + 1} threw error:`, error);
              allTestsPassed = false;
              break;
            }
          }
          
          if (allTestsPassed) {
            console.log('All session verification tests passed');
            refreshSuccess = true;
          } else {
            console.warn('Session verification tests failed, retrying refresh');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          console.error(`Session refresh attempt ${refreshAttempts} returned no session`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!refreshSuccess) {
        console.error('All session refresh attempts failed');
        // Force a complete re-initialization
        try {
          console.log('Attempting complete Supabase client re-initialization');
          // Clear any cached auth state
          await supabase.auth.signOut({ scope: 'local' });
          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 500));
          // Try to restore from localStorage
          const { data: restoredSession } = await supabase.auth.getSession();
          if (restoredSession?.session) {
            console.log('Session restored from localStorage');
            return true;
          }
        } catch (reinitError) {
          console.error('Complete re-initialization failed:', reinitError);
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in aggressive session recovery:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    const instanceId = instanceIdRef.current;
    
    // Register this instance
    globalVisibilityState.instances.add(instanceId);
    
    // Only attach listener once globally, regardless of how many hook instances exist
    if (globalVisibilityState.listenerAttached) {
      console.log(`Visibility listener already attached globally, instance ${instanceId} registered`);
      return;
    }
    
    let timeoutId: NodeJS.Timeout;
    
    const handleVisibilityChange = async () => {
      // Prevent multiple simultaneous handlers globally
      if (globalVisibilityState.isHandling) {
        console.log('Visibility change already being handled globally, skipping');
        return;
      }
      if (document.visibilityState === 'visible') {
        // Tab became visible again
        const timeHidden = Date.now() - globalVisibilityState.lastVisibleTime;
        console.log(`Tab became visible after ${timeHidden}ms`);
        
        // Only take action if the tab was hidden for a significant duration
        if (timeHidden > minHiddenDuration) {
          globalVisibilityState.isHandling = true;
          
          // Use a small delay to allow React to stabilize
          timeoutId = setTimeout(async () => {
            try {
              console.log(`Tab was hidden for ${timeHidden}ms - performing comprehensive session refresh`);
              
              // Perform aggressive session recovery
              const refreshSuccess = await refreshConnections();
              
              if (refreshSuccess) {
                console.log('Session recovery successful - dispatching success event');
                // Dispatch a gentle visibility event with refresh status
                window.dispatchEvent(new CustomEvent('app:visibility-gentle', { 
                  detail: { 
                    timeHidden, 
                    timestamp: Date.now(),
                    sessionRefreshed: true,
                    recoveryType: 'aggressive'
                  } 
                }));
              } else {
                console.error('Session recovery failed completely - user needs to refresh or re-login');
                // Dispatch a session failure event for the app to handle
                window.dispatchEvent(new CustomEvent('app:session-failed', {
                  detail: { 
                    reason: 'tab-switch-recovery-failed',
                    severity: 'critical',
                    action: 'refresh-required'
                  }
                }));
              }
            } catch (error) {
              console.error('Error handling visibility change:', error);
            } finally {
              globalVisibilityState.isHandling = false;
            }
          }, 100); // Small delay to let React settle
        }
      } else {
        // Tab is being hidden, store the current time globally
        globalVisibilityState.lastVisibleTime = Date.now();
        console.log('Tab hidden at:', new Date().toISOString());
      }
    };

    // Listen for visibility changes with passive option for better performance
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    globalVisibilityState.listenerAttached = true;
    console.log(`Global visibility change listener attached by instance ${instanceId}`);
    
    return () => {
      // Unregister this instance
      globalVisibilityState.instances.delete(instanceId);
      
      // Only remove listener when no instances remain
      if (globalVisibilityState.instances.size === 0) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        globalVisibilityState.listenerAttached = false;
        console.log(`Global visibility change listener removed by last instance ${instanceId}`);
      } else {
        console.log(`Instance ${instanceId} unregistered, ${globalVisibilityState.instances.size} instances remain`);
      }
      
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