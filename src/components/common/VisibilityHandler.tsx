import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface VisibilityHandlerProps {
  onVisibilityChange?: (wasHidden: boolean, hiddenDuration: number) => void;
  minHiddenDuration?: number;
  disableAutoRefresh?: boolean;
}

/**
 * Component to handle browser tab visibility changes
 * This detects when a user switches tabs and executes a callback when they return
 */
const VisibilityHandler: React.FC<VisibilityHandlerProps> = ({ 
  onVisibilityChange,
  minHiddenDuration = 5000,
  disableAutoRefresh = true
}) => {
  const lastVisibleTimeRef = useRef(Date.now());
  const [enabled, setEnabled] = useState(true);

  // After 30 seconds, disable the handler to prevent issues
  useEffect(() => {
    const disableTimer = setTimeout(() => {
      setEnabled(false);
    }, 30000);
    
    return () => clearTimeout(disableTimer);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible again
        const timeHidden = Date.now() - lastVisibleTimeRef.current;
        console.log('Tab became visible after being hidden for', timeHidden, 'ms');
        
        // Only call the callback if the tab was hidden for more than the minimum duration
        if (timeHidden > minHiddenDuration) {
          // If auto-refresh is disabled, just show a message, don't trigger refresh
          if (disableAutoRefresh) {
            toast.info('Returned to page. Use refresh button if needed.');
          } else if (onVisibilityChange) {
            onVisibilityChange(true, timeHidden);
          }
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
  }, [onVisibilityChange, minHiddenDuration, enabled, disableAutoRefresh]);

  // This component doesn't render anything
  return null;
};

export default VisibilityHandler; 