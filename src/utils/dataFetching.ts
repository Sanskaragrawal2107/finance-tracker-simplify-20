import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Track if we're currently reconnecting from a tab switch
// This helps prevent showing error toasts during reconnection
const reconnectionState = {
  isReconnecting: false,
  suppressNetworkErrors: false,
  setReconnecting: (value: boolean) => {
    reconnectionState.isReconnecting = value;
    
    // When starting reconnection, suppress network errors for a short period
    if (value === true) {
      reconnectionState.suppressNetworkErrors = true;
      setTimeout(() => {
        reconnectionState.suppressNetworkErrors = false;
      }, 5000); // Suppress network error toasts for 5 seconds max
    }
  }
};

// Export for global access
export const tabSwitchState = {
  suppressNetworkToasts: () => {
    reconnectionState.setReconnecting(true);
  },
  allowNetworkToasts: () => {
    reconnectionState.setReconnecting(false);
    reconnectionState.suppressNetworkErrors = false;
  },
  isReconnecting: () => reconnectionState.isReconnecting
};

interface FetchOptions {
  maxRetries?: number;
  retryDelay?: number;
  showToast?: boolean;
  context?: string;
  bypassToastSuppression?: boolean;
}

/**
 * Fetch data with automatic retry mechanism
 * @param fetchFn The function that performs the actual data fetch
 * @param options Configuration options for retries
 * @returns The fetched data or null if all retries failed
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: FetchOptions = {}
): Promise<T | null> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    showToast = true,
    context = 'data',
    bypassToastSuppression = false
  } = options;
  
  let lastError: any = null;
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      // Attempt to fetch data
      const result = await fetchFn();
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check for session errors to handle them specially
      if (error?.message?.includes('JWT') || 
          error?.message?.includes('token') || 
          error?.message?.includes('session')) {
        if (showToast && !reconnectionState.suppressNetworkErrors) {
          toast.error('Your session has expired. Please refresh the page or log in again.');
        }
        console.error('Session error during data fetch:', error);
        
        // Try to refresh the session before giving up
        try {
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          if (data.session && !refreshError) {
            // Session refreshed successfully, try the fetch again immediately
            continue;
          }
        } catch (refreshError) {
          console.error('Failed to refresh session:', refreshError);
        }
        
        // Session refresh failed or we have a definite session error
        // Break immediately without further retries
        break;
      }
      
      // For network errors, try to reconnect
      if (error?.message?.includes('network') || 
          error?.message?.includes('connection') ||
          error?.name === 'AbortError') {
        console.warn(`Network error (retry ${retries + 1}/${maxRetries + 1}):`, error);
        
        // Only show toast on the first retry for network errors
        // AND only if we're not reconnecting from a tab switch
        // or if we explicitly want to bypass toast suppression
        if (retries === 0 && showToast && 
            (bypassToastSuppression || !reconnectionState.suppressNetworkErrors)) {
          toast.error(`Connection issue while fetching ${context}. Retrying...`);
        }
      } else {
        // For other errors, log them
        console.error(`Fetch error (retry ${retries + 1}/${maxRetries + 1}):`, error);
        
        // Only show toast on the last retry for other errors
        // and only if we're not suppressing error messages
        if (retries === maxRetries && showToast && 
            (bypassToastSuppression || !reconnectionState.suppressNetworkErrors)) {
          toast.error(`Error fetching ${context}. Please try again later.`);
        }
      }
      
      retries++;
      
      // If we have more retries, wait before trying again
      if (retries <= maxRetries) {
        // Use exponential backoff
        const delay = retryDelay * Math.pow(2, retries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  console.error('All fetch retries failed:', lastError);
  return null;
}

/**
 * Helper hook for Supabase queries with proper typing and retry
 * @param queryFn Function that performs the Supabase query
 * @param options Configuration options for retries
 * @returns An async function that returns data or null
 */
export async function fetchSupabaseData<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  options: FetchOptions = {}
): Promise<T | null> {
  return fetchWithRetry(async () => {
    const { data, error } = await queryFn();
    
    if (error) {
      throw error;
    }
    
    return data as T;
  }, options);
} 