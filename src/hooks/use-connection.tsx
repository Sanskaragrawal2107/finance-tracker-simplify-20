import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Maximum time (in ms) to wait for a connection test
const CONNECTION_TIMEOUT = 5000;

/**
 * Hook to manage Supabase connection state and provide connection checking utilities
 */
export function useConnection() {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  
  // Test connection to Supabase with timeout
  const checkConnection = useCallback(async (showToast = false): Promise<boolean> => {
    if (isChecking) return isConnected;
    
    setIsChecking(true);
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<{data: null, error: Error}>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
      );
      
      // Perform a simple query to test the connection
      const connectionPromise = supabase.from('users').select('count').limit(1);
      
      // Race the connection promise against the timeout
      const { error } = await Promise.race([connectionPromise, timeoutPromise]);
      
      const connected = !error;
      setIsConnected(connected);
      
      if (showToast) {
        if (connected) {
          toast.success('Connection restored');
        } else {
          toast.error('Connection failed. Please refresh the page.');
        }
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
  
  // Utility to retry a function with connection checking
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
        return await fn();
      } catch (error) {
        console.error('Operation failed, checking connection:', error);
        attempts++;
        
        // Check if it's a connection issue
        const connected = await checkConnection(attempts === maxRetries);
        
        if (!connected) {
          if (onConnectionError) onConnectionError();
          
          if (attempts < maxRetries) {
            toast.info(`Retrying operation... (${attempts}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return tryOperation();
          }
        }
        
        throw error;
      }
    };
    
    return tryOperation();
  }, [checkConnection]);
  
  // We've removed the automatic visibility change effect that was causing flickering
  
  return {
    isConnected,
    isChecking,
    checkConnection,
    withConnectionCheck
  };
}

// Export the existing pingSupabase function from client.ts
export { pingSupabase } from '@/integrations/supabase/client'; 