import { useEffect, useRef } from 'react';

interface VisibilityHandlerProps {
  onVisibilityChange: (wasHidden: boolean, hiddenDuration: number) => void;
  minHiddenDuration?: number;
}

/**
 * Component to handle browser tab visibility changes
 * This detects when a user switches tabs and executes a callback when they return
 */
const VisibilityHandler: React.FC<VisibilityHandlerProps> = ({ 
  onVisibilityChange,
  minHiddenDuration = 5000
}) => {
  const lastVisibleTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible again
        const timeHidden = Date.now() - lastVisibleTimeRef.current;
        console.log('Tab became visible after being hidden for', timeHidden, 'ms');
        
        // Only call the callback if the tab was hidden for more than the minimum duration
        if (timeHidden > minHiddenDuration) {
          onVisibilityChange(true, timeHidden);
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
  }, [onVisibilityChange, minHiddenDuration]);

  // This component doesn't render anything
  return null;
};

export default VisibilityHandler; 