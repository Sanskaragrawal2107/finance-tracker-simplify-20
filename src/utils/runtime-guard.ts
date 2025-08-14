/**
 * Runtime safeguard to detect when React event system becomes unresponsive
 * after tab visibility changes
 */

let isTestRunning = false;

export function runEventSystemTest(): Promise<boolean> {
  return new Promise((resolve) => {
    if (isTestRunning) {
      resolve(true); // Don't run multiple tests simultaneously
      return;
    }

    if (process.env.NODE_ENV !== 'development') {
      resolve(true); // Only run in development
      return;
    }

    isTestRunning = true;

    // Create a hidden test button
    const testButton = document.createElement('button');
    testButton.style.position = 'absolute';
    testButton.style.left = '-9999px';
    testButton.style.opacity = '0';
    testButton.setAttribute('data-test', 'react-event-system');
    
    let eventReceived = false;
    
    const cleanup = () => {
      if (testButton.parentNode) {
        testButton.parentNode.removeChild(testButton);
      }
      isTestRunning = false;
    };

    // Add click handler
    testButton.addEventListener('click', () => {
      eventReceived = true;
    });

    // Add to DOM
    document.body.appendChild(testButton);

    // Dispatch synthetic click after a small delay
    setTimeout(() => {
      testButton.click();
      
      // Check if event was received
      setTimeout(() => {
        if (!eventReceived) {
          console.error('🚨 React event system is unresponsive after tab switch!');
          console.error('💡 This indicates a visibility handling bug. Check pageVisibility.ts');
        }
        
        cleanup();
        resolve(eventReceived);
      }, 50);
    }, 10);
  });
}

// Auto-run test after visibility changes in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Tab became visible - test event system after a delay
      setTimeout(() => {
        runEventSystemTest();
      }, 200);
    }
  });
}