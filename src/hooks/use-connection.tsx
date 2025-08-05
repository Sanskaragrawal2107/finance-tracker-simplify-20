import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Maximum time (in ms) to wait for a connection test
const CONNECTION_TIMEOUT = 3000;

/**
 * Hook to manage Supabase connection state and provide connection checking utilities
 */
export function useConnection() {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  
  // Test connection to Supabase with timeout - simplified
  const checkConnection = useCallback(async (showToast = false): Promise<boolean> => {
    if (isChecking) return isConnected;
    
    setIsChecking(true);
    
    try {
      // Simpler approach with just a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);
      
      // Perform a simple query to test the connection
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      
      const connected = !error;
      setIsConnected(connected);
      
      if (showToast && !connected) {
        toast.error('Connection failed. Please refresh the page.');
      }
      
      return connected;
    } catch (error) {
      console.error('Connection check error:', error);
      setIsConnected(false);
      
      if (showToast) {
        toast.error('Connection failed. Please refresh the page.');
      }
      
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, isConnected]);
  
  // Utility to retry a function with connection checking - simplified
  const withConnectionCheck = useCallback(<T,>(
    fn: () => Promise<T>,
    options: {
      onConnectionError?: () => void;
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<T> => {
    const { 
      onConnectionError, 
      maxRetries = 1, 
      retryDelay = 1000 
    } = options;
    
    let attempts = 0;
    
    const tryOperation = async (): Promise<T> => {
      try {
        // Just try the operation directly first
        return await fn();
      } catch (error) {
        console.error('Operation failed:', error);
        attempts++;
        
        // Only check connection on retry
        if (attempts <= maxRetries) {
          console.log(`Retrying operation (${attempts}/${maxRetries})...`);
          
          // Simple delay without toast to avoid flickering
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return tryOperation();
        }
        
        // If all retries failed, check if it's a connection issue
        const connected = await checkConnection(true);
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