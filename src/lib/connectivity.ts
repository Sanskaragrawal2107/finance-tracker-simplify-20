

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
  
  // Listen for centralized visibility event instead of direct listener
  const handleCentralizedVisibility = () => {
    const currentTime = Date.now();
    isTabVisible = true; // Always visible when this event fires
    
    // Tab became visible, restart the timeout with remaining time
    updateTimeout();
  };
  
  // Start listening for centralized visibility changes
  window.addEventListener('app:visibility-change', handleCentralizedVisibility as EventListener);
  
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
      window.removeEventListener('app:visibility-change', handleCentralizedVisibility as EventListener);
    }
  };
};