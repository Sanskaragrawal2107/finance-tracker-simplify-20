import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Create a safer approach to toast filtering without overriding functions
type ToastFilter = (message: string) => boolean;

// Track if we're currently reconnecting from a tab switch
// This helps prevent showing error toasts during reconnection
const reconnectionState = {
  isReconnecting: false,
  suppressNetworkErrors: false,
  toastFilters: new Set<ToastFilter>(),
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

// Create a safe wrapper around toast.error that respects filters
const originalErrorToast = toast.error;
toast.error = function safeErrorToast(...args: Parameters<typeof originalErrorToast>) {
  const [message] = args;
  
  // Only filter string messages
  if (typeof message === 'string') {
    // Run through all filters - if any return false, don't show the toast
    for (const filter of reconnectionState.toastFilters) {
      try {
        if (!filter(message)) {
          // Filter rejected this message
          console.log('Toast suppressed by filter:', message);
          return 'suppressed-toast-id';
        }
      } catch (err) {
        // If a filter throws an error, still allow the toast
        console.error('Error in toast filter:', err);
      }
    }
  }
  
  // If we get here, either it's not a string message or all filters passed
  return originalErrorToast(...args);
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
  isReconnecting: () => reconnectionState.isReconnecting,
  // Add new methods for toast filters
  registerToastFilter: (filter: ToastFilter) => {
    reconnectionState.toastFilters.add(filter);
  },
  removeToastFilter: (filter: ToastFilter) => {
    reconnectionState.toastFilters.delete(filter);
  }
};

interface FetchOptions {
  maxRetries?: number;
  retryDelay?: number;
  showToast?: boolean;
  context?: string;
  bypassToastSuppression?: boolean;
  timeout?: number;
}

/**
 * Fetch data with automatic retry mechanism and session recovery
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
    bypassToastSuppression = false,
    timeout = 8000 // 8 second timeout
  } = options;
  
  let lastError: any = null;
  let sessionRefreshAttempted = false;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fetchFn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
        )
      ]);
      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1} failed for ${context}:`, error);
      
      // Check if this is a session/auth error and try to refresh session once
      if (!sessionRefreshAttempted && 
          (error?.message?.includes('JWT') || error?.message?.includes('token') || error?.code === 'PGRST301')) {
        console.log('Detected auth error, attempting session refresh before retry');
        sessionRefreshAttempted = true;
        
        try {
          // Try to refresh the session
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          if (data?.session && !refreshError) {
            console.log('Session refreshed successfully, retrying fetch');
            // Don't increment attempt counter for session refresh retry
            attempt--;
          }
        } catch (refreshErr) {
          console.error('Session refresh failed:', refreshErr);
        }
      }
      
      // If this is the last attempt, don't wait
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }
  
  // If we've exhausted retries, check if we should suppress the toast
  if (showToast && !bypassToastSuppression) {
    // Check if we're in a reconnection state
    if (reconnectionState.suppressNetworkErrors) {
      console.log(`Suppressing error toast for ${context} during reconnection:`, lastError?.message);
    } else {
      // Show the error toast with more specific messaging
      let errorMessage = lastError?.message || `Failed to fetch ${context}`;
      
      // Check for specific Supabase auth errors
      if (lastError?.message?.includes('JWT') || lastError?.message?.includes('token') || lastError?.code === 'PGRST301') {
        errorMessage = `Session expired. Please refresh the page or log in again.`;
        // Dispatch session failure event
        window.dispatchEvent(new CustomEvent('app:session-failed', {
          detail: { reason: 'auth-error-in-fetch', originalError: lastError }
        }));
      }
      
      toast.error(errorMessage);
    }
  }
  
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