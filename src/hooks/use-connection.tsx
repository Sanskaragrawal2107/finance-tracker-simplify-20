import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Maximum time (in ms) to wait for a connection test
const CONNECTION_TIMEOUT = 2500;

/**
 * Hook to manage Supabase connection state and provide connection checking utilities
 * with enhanced timeout protection
 */
export function useConnection() {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  
  // Test connection to Supabase with timeout - with enhanced debugging
  const checkConnection = useCallback(async (showToast = false): Promise<boolean> => {
    if (isChecking) {
      console.log('👀 Connection check already in progress, returning current state:', isConnected);
      return isConnected;
    }
    
    const startTime = Date.now();
    console.log('🔄 Starting connection check');
    setIsChecking(true);
    
    try {
      // Create an abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ Connection check timeout after ${CONNECTION_TIMEOUT}ms`);
        controller.abort();
      }, CONNECTION_TIMEOUT);
      
      // Perform a simple query to test the connection
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      const connected = !error;
      setIsConnected(connected);
      
      if (connected) {
        console.log(`✅ Connection check successful in ${duration}ms`);
      } else {
        console.error(`❌ Connection check failed in ${duration}ms:`, error);
      }
      
      // Only show toast for failures or if explicitly requested for success
      if ((showToast && !connected) || (showToast && connected && !isConnected)) {
        if (connected) {
          toast.success('Connection restored');
        } else {
          toast.error('Connection issue detected. Try refreshing the page.');
        }
      }
      
      return connected;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Check if this was an abort error (timeout)
      const isTimeoutError = error instanceof DOMException && error.name === 'AbortError';
      
      if (isTimeoutError) {
        console.warn(`⏱️ Connection check timed out after ${duration}ms`);
      } else {
        console.error(`❌ Connection check error after ${duration}ms:`, error);
      }
      
      setIsConnected(false);
      
      if (showToast) {
        toast.error(
          isTimeoutError 
            ? 'Connection timed out. Please check your network and refresh the page.' 
            : 'Connection failed. Please refresh the page.'
        );
      }
      
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, isConnected]);
  
  // Utility to retry a function with connection checking - more robust with timeouts
  const withConnectionCheck = useCallback(<T,>(
    fn: () => Promise<T>,
    options: {
      onConnectionError?: () => void;
      maxRetries?: number;
      retryDelay?: number;
      timeout?: number;
    } = {}
  ): Promise<T> => {
    const { 
      onConnectionError, 
      maxRetries = 1, 
      retryDelay = 1000,
      timeout = 5000
    } = options;
    
    let attempts = 0;
    
    const tryOperation = async (): Promise<T> => {
      try {
        // Add timeout protection to the operation
        const controller = new AbortController();
        const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
        
        // Create a promise that wraps the function with abort signal if possible
        const result = await fn();
        
        if (timeoutId) clearTimeout(timeoutId);
        return result;
      } catch (error) {
        // Determine if this was a timeout
        const isTimeoutError = error instanceof DOMException && error.name === 'AbortError';
        
        if (isTimeoutError) {
          console.warn('Operation timed out');
        } else {
          console.error('Operation failed:', error);
        }
        
        attempts++;
        
        // Only attempt retry if we haven't exceeded maxRetries
        if (attempts <= maxRetries) {
          console.log(`Retrying operation (${attempts}/${maxRetries})...`);
          
          // Simple delay without toast to avoid UI noise
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return tryOperation();
        }
        
        // If all retries failed, check the connection
        const connected = await checkConnection(attempts >= maxRetries);
        if (!connected && onConnectionError) {
          onConnectionError();
        }
        
        throw error;
      }
    };
    
    return tryOperation();
  }, [checkConnection]);
  
  return {
    isConnected,
    isChecking,
    checkConnection,
    withConnectionCheck
  };
}

// Export the existing pingSupabase function from client.ts
export { pingSupabase } from '@/integrations/supabase/client'; 