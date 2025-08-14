/**
 * Page Visibility Utility
 * Centralized tab visibility and window focus management to prevent UI freezing
 */

type VisibilityListener = (state: VisibilityState) => void;

interface VisibilityState {
  isPageVisible: boolean;
  isWindowFocused: boolean;
  timeHidden: number;
  lastVisibleTime: number;
}

class PageVisibilityManager {
  private listeners = new Set<VisibilityListener>();
  private state: VisibilityState = {
    isPageVisible: true,
    isWindowFocused: true,
    timeHidden: 0,
    lastVisibleTime: Date.now()
  };

  private isInitialized = false;
  private cleanupFunctions: (() => void)[] = [];

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized || typeof window === 'undefined') return;
    
    this.isInitialized = true;

    // Handle visibility changes
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      const now = Date.now();
      
      if (isVisible && !this.state.isPageVisible) {
        // Tab became visible
        this.state.timeHidden = now - this.state.lastVisibleTime;
        this.state.isPageVisible = true;
        this.notifyListeners();
      } else if (!isVisible && this.state.isPageVisible) {
        // Tab became hidden
        this.state.lastVisibleTime = now;
        this.state.isPageVisible = false;
        this.state.timeHidden = 0;
        this.notifyListeners();
      }
    };

    // Handle window focus changes
    const handleFocus = () => {
      if (!this.state.isWindowFocused) {
        this.state.isWindowFocused = true;
        this.notifyListeners();
      }
    };

    const handleBlur = () => {
      if (this.state.isWindowFocused) {
        this.state.isWindowFocused = false;
        this.notifyListeners();
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('focus', handleFocus, { passive: true });
    window.addEventListener('blur', handleBlur, { passive: true });

    // Store cleanup functions
    this.cleanupFunctions.push(
      () => document.removeEventListener('visibilitychange', handleVisibilityChange),
      () => window.removeEventListener('focus', handleFocus),
      () => window.removeEventListener('blur', handleBlur)
    );

    // Initialize focus state after mount (prevents focus stealing)
    setTimeout(() => {
      this.state.isWindowFocused = document.hasFocus();
      this.state.isPageVisible = !document.hidden;
      this.notifyListeners();
    }, 100);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('Error in visibility listener:', error);
      }
    });
  }

  subscribe(listener: VisibilityListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener({ ...this.state });
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): VisibilityState {
    return { ...this.state };
  }

  cleanup() {
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
    this.listeners.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
export const pageVisibilityManager = new PageVisibilityManager();

// React hook for easy integration
export function usePageVisibility(onVisibilityChange?: (state: VisibilityState) => void) {
  const [state, setState] = React.useState<VisibilityState>(pageVisibilityManager.getState());

  React.useEffect(() => {
    const unsubscribe = pageVisibilityManager.subscribe((newState) => {
      setState(newState);
      if (onVisibilityChange) {
        onVisibilityChange(newState);
      }
    });

    return unsubscribe;
  }, [onVisibilityChange]);

  return state;
}

// Import React for the hook
import React from 'react';