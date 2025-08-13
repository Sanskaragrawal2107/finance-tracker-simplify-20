import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Debug component to test tab switching behavior
 * This component helps verify that event handlers remain responsive after tab switches
 */
const VisibilityTest: React.FC = () => {
  const [clickCount, setClickCount] = useState(0);
  const [lastVisibilityEvent, setLastVisibilityEvent] = useState<string>('None');
  const [isTabVisible, setIsTabVisible] = useState(document.visibilityState === 'visible');

  useEffect(() => {
    // Listen for our gentle visibility events
    const handleGentleVisibility = (event: CustomEvent) => {
      const { timeHidden, timestamp } = event.detail;
      setLastVisibilityEvent(`Gentle: Hidden for ${timeHidden}ms at ${new Date(timestamp).toLocaleTimeString()}`);
    };

    // Listen for native visibility changes
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
      setLastVisibilityEvent(`Native: ${document.visibilityState} at ${new Date().toLocaleTimeString()}`);
    };

    window.addEventListener('app:visibility-gentle', handleGentleVisibility as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('app:visibility-gentle', handleGentleVisibility as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleTestClick = () => {
    console.log('Test button clicked - event handlers are working!');
    setClickCount(prev => prev + 1);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Tab Switch Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Tab Status:</p>
          <p className={`font-medium ${isTabVisible ? 'text-green-600' : 'text-orange-600'}`}>
            {isTabVisible ? 'Visible' : 'Hidden'}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground">Last Visibility Event:</p>
          <p className="text-xs font-mono">{lastVisibilityEvent}</p>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground">Click Count:</p>
          <p className="font-medium text-lg">{clickCount}</p>
        </div>
        
        <Button 
          onClick={handleTestClick}
          className="w-full"
          variant="outline"
        >
          Test Click (Should Always Work)
        </Button>
        
        <div className="text-xs text-muted-foreground">
          <p>Instructions:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click the test button (should work)</li>
            <li>Switch to another tab for 10+ seconds</li>
            <li>Switch back to this tab</li>
            <li>Click the test button again (should still work)</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default VisibilityTest;
