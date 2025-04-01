import { supabase, pingSupabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Creates a timeout that accounts for tab visibility changes
 * The timer only counts down when the tab is visible, pausing when hidden
 */
export const createVisibilityAwareTimeout = (
  callback: () => void, 
  duration: number
): { clear: () => void } => {
  // Store when the timeout started
  const startTime = Date.now();
  // Track time elapsed while tab was visible
  let visibleElapsedTime = 0;
  // Timeout reference
  let timeoutId: NodeJS.Timeout | null = null;
  // Track if timer is still active
  let isActive = true;
  // Track tab visibility
  let isTabVisible = document.visibilityState === 'visible';
  
  // Function to update the timeout
  const updateTimeout = () => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Only set a new timeout if the timer is active and tab is visible
    if (isActive && isTabVisible) {
      // Calculate remaining time
      const remainingTime = Math.max(0, duration - visibleElapsedTime);
      
      if (remainingTime <= 0) {
        // Time's up, execute callback
        callback();
        isActive = false;
      } else {
        // Set timeout for remaining time
        timeoutId = setTimeout(() => {
          callback();
          isActive = false;
        }, remainingTime);
      }
    }
  };
  
  // Handle visibility changes
  const handleVisibilityChange = () => {
    const currentTime = Date.now();
    isTabVisible = document.visibilityState === 'visible';
    
    if (isTabVisible) {
      // Tab became visible, restart the timeout with remaining time
      updateTimeout();
    } else {
      // Tab hidden, pause the timeout and calculate elapsed time
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      // Update the elapsed time
      visibleElapsedTime += currentTime - startTime;
    }
  };
  
  // Start listening for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Initialize the timeout
  updateTimeout();
  
  // Return a method to clear the timeout
  return {
    clear: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
};

/**
 * Utility to check connection status after tab switching
 * This helps fix issues with buttons not working after tab switching
 */
export const checkConnectionAfterTabChange = async (): Promise<boolean> => {
  try {
    // First try pinging the service worker if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      
      // Create a promise for the response
      const swPingPromise = new Promise<boolean>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.type === 'PONG') {
            resolve(true);
          } else {
            resolve(false);
          }
        };
        
        // Set a timeout in case we don't get a response
        setTimeout(() => resolve(false), 1000);
      });
      
      // Send the ping message
      navigator.serviceWorker.controller.postMessage(
        { type: 'PING' },
        [messageChannel.port2]
      );
      
      const swResponse = await swPingPromise;
      if (!swResponse) {
        console.warn('Service worker not responding, checking Supabase connection');
      }
    }
    
    // Then ping Supabase for actual API connectivity
    const supabaseConnected = await pingSupabase();
    
    if (!supabaseConnected) {
      console.warn('Supabase connection test failed');
      toast.error('Connection issues detected. Some features may not work correctly.', {
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload(),
        },
        duration: 8000,
      });
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking connection:', error);
    return false;
  }
};

/**
 * Wrapper for click handlers to ensure connection is active
 * Use this to wrap any important click handlers that might fail after tab switching
 */
export const withConnectionCheck = <T extends (...args: any[]) => any>(
  handler: T
): ((...args: Parameters<T>) => ReturnType<T> | Promise<ReturnType<T>>) => {
  return async (...args: Parameters<T>) => {
    try {
      // Check connection before executing the handler
      const isConnected = await checkConnectionAfterTabChange();
      
      if (!isConnected) {
        toast.error('Connection issues detected. Try refreshing the page.', {
          action: {
            label: 'Refresh',
            onClick: () => window.location.reload(),
          },
        });
        
        // Try one last time to reestablish connection
        try {
          // Force refresh token
          await supabase.auth.refreshSession();
          
          // Attempt to ping again
          const retryConnection = await pingSupabase();
          if (retryConnection) {
            // If successful on retry, proceed with the handler
            return handler(...args);
          } else {
            throw new Error('Connection still unstable after retry');
          }
        } catch (retryError) {
          console.error('Retry connection failed:', retryError);
          // Don't execute the handler if connection is still unstable
          return undefined as unknown as ReturnType<T>;
        }
      }
      
      // If connected, proceed with the handler
      return handler(...args);
    } catch (error) {
      console.error('Error in withConnectionCheck:', error);
      toast.error('An error occurred. Please try again or refresh the page.');
      return undefined as unknown as ReturnType<T>;
    }
  };
}; 