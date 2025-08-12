import React, { useEffect, useState, createContext, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export const VisibilityContext = createContext<{
  forceRefresh: () => void;
  registerLoadingState: (id: string, isLoading: boolean) => void;
  registerAuthContext: (authContext: any) => void;
}>(
  {
    forceRefresh: () => {},
    registerLoadingState: () => {},
    registerAuthContext: () => {}
  }
);

export const VisibilityRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const loadingStatesRef = useRef<Record<string, boolean>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [appStale, setAppStale] = useState(false);
  const hiddenTimeRef = useRef<number | null>(null);
  const authContextRef = useRef<any>(null);

  const forceRefresh = useCallback(async () => {
    Object.keys(loadingStatesRef.current).forEach(key => {
      loadingStatesRef.current[key] = false;
    });

    setLastRefreshTime(Date.now());
    setAppStale(false);

    supabase.removeAllChannels();

    try {
      if (authContextRef.current && authContextRef.current.refreshSession) {
        console.log('Refreshing auth session through forceRefresh');
        await authContextRef.current.refreshSession();
      }

      setTimeout(() => {
        try {
          supabase.channel('system').subscribe();
          console.log('Reconnected Supabase channels');
        } catch (error) {
          console.error('Error reconnecting Supabase channels:', error);
        }
      }, 100);
    } catch (error) {
      console.error('Error in forceRefresh:', error);
    }
  }, []);

  const registerLoadingState = useCallback((id: string, isLoading: boolean) => {
    loadingStatesRef.current[id] = isLoading;

    if (isLoading && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        console.warn(`Forcing loading state to clear after timeout for: ${id}`);
        loadingStatesRef.current[id] = false;
        timeoutRef.current = null;
      }, 30000);
    } else if (!isLoading && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const registerAuthContext = useCallback((authContext: any) => {
    console.log('Auth context registered for visibility refresh');
    authContextRef.current = authContext;
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const currentTime = Date.now();
        const timeHidden = hiddenTimeRef.current ? currentTime - hiddenTimeRef.current : 0;
        console.log(`Tab became visible after ${timeHidden}ms`);

        if (timeHidden > 30000) {
          console.log('Clearing loading states after extended inactivity (30+ seconds)');
          Object.keys(loadingStatesRef.current).forEach(key => {
            if (loadingStatesRef.current[key]) {
              console.log(`Clearing potentially stuck loading state after extended time: ${key}`);
              loadingStatesRef.current[key] = false;
            }
          });
        } else if (timeHidden > 5000) {
          console.log(`Tab was hidden for ${timeHidden}ms - not clearing loading states to avoid interrupting form submissions`);
        }

        if (timeHidden > 120000) {
          console.log('App marked as stale after long inactivity');
          setAppStale(true);
          toast.info('Tab was inactive for a while. Some functionality may need to be refreshed.');

          try {
            supabase.removeAllChannels();
            setTimeout(() => {
              supabase.channel('system').subscribe();
              console.log('Attempted to reconnect Supabase after inactivity');
            }, 100);
          } catch (err) {
            console.error('Error reconnecting after inactivity:', err);
          }
        }

        hiddenTimeRef.current = null;
      } else {
        hiddenTimeRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <VisibilityContext.Provider value={{
      forceRefresh,
      registerLoadingState,
      registerAuthContext
    }}>
      {appStale && (
        <div className="fixed top-16 left-0 w-full bg-yellow-100 text-yellow-800 p-2 text-center z-50 shadow-md">
          <div className="flex items-center justify-center gap-2">
            <span>App state may be outdated after inactivity.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={forceRefresh}
              className="bg-yellow-200 border-yellow-300 hover:bg-yellow-300"
            >
              Refresh Data
            </Button>
          </div>
        </div>
      )}
      {children}
    </VisibilityContext.Provider>
  );
};
