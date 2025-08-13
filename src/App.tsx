import React, { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import AdminDashboard from "./pages/AdminDashboard";
import SupervisorSites from "./pages/SupervisorSites";
import AdminSupervisorSites from "./pages/admin/SupervisorSites";
import NotFound from "./pages/NotFound";
import Navbar from "./components/layout/Navbar";
import { UserRole } from "./lib/types";
import { useIsMobile } from "./hooks/use-mobile";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { supabase, refreshSchemaCache } from '@/integrations/supabase/client';
import { useVisibilityRefresh } from '@/hooks/use-visibility-refresh';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Global singleton to prevent duplicate app-level event listeners
const globalAppState = {
  listenersAttached: false,
  instances: new Set()
};

// Create a context for visibility change handling
export const VisibilityContext = createContext<{
  forceRefresh: () => void;
  registerLoadingState: (id: string, isLoading: boolean) => void;
  registerAuthContext: (authContext: any) => void;
}>({
  forceRefresh: () => {},
  registerLoadingState: () => {},
  registerAuthContext: () => {}
});

// Visibility Provider component to make visibility state available app-wide
const VisibilityRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const loadingStatesRef = useRef<Record<string, boolean>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [appStale, setAppStale] = useState(false);
  const hiddenTimeRef = useRef<number | null>(null);
  const authContextRef = useRef<any>(null);
  const instanceIdRef = useRef(Math.random().toString(36).substr(2, 9));

  // Manual refresh only when user explicitly requests it
  const forceRefresh = useCallback(async () => {
    console.log('User requested manual refresh');
    
    try {
      // Only refresh auth session, don't forcefully clear all states
      if (authContextRef.current && authContextRef.current.refreshSession) {
        console.log('Manually refreshing auth session');
        await authContextRef.current.refreshSession();
      }
      
      // Reset stale state
      setAppStale(false);
      
      // Force component refresh by updating the refresh time
      setLastRefreshTime(Date.now());
      
      console.log('Manual refresh completed');
    } catch (error) {
      console.error('Error in manual refresh:', error);
      // Show user-friendly error
      setAppStale(true);
    }
  }, []);

  // Register a loading state from a component (simplified)
  const registerLoadingState = useCallback((id: string, isLoading: boolean) => {
    loadingStatesRef.current[id] = isLoading;
    
    // Only set timeout for specific loading state, don't clear all states
    if (isLoading) {
      // Set a timeout for this specific loading state only
      setTimeout(() => {
        if (loadingStatesRef.current[id]) {
          console.warn(`Loading state timeout for: ${id}`);
          loadingStatesRef.current[id] = false;
        }
      }, 45000); // 45 second timeout for individual operations
    }
  }, []);

  // Register auth context for refreshing
  const registerAuthContext = useCallback((authContext: any) => {
    console.log('Auth context registered for visibility refresh');
    authContextRef.current = authContext;
  }, []);

  // Use centralized visibility refresh hook with longer duration to be less aggressive
  useVisibilityRefresh(10000); // 10 seconds instead of 5

  // Listen for the centralized visibility event
  // Listen for the gentle visibility event and auth context ready
  useEffect(() => {
    const instanceId = instanceIdRef.current;
    
    // Register this instance
    globalAppState.instances.add(instanceId);
    
    // Only attach listeners once globally
    if (globalAppState.listenersAttached) {
      console.log(`App event listeners already attached globally, instance ${instanceId} registered`);
      return;
    }
    
    let isHandling = false; // Prevent multiple simultaneous handlers
    
    const handleGentleVisibility = async (event: CustomEvent) => {
      if (isHandling) return;
      isHandling = true;
      
      const { timeHidden, timestamp, sessionRefreshed } = event.detail;
      console.log(`App received gentle visibility event - tab was hidden for ${timeHidden}ms, session refreshed: ${sessionRefreshed}`);
      
      try {
        // If the visibility hook already refreshed the session successfully, we're good
        if (sessionRefreshed) {
          console.log('Session already refreshed successfully by visibility hook');
          setAppStale(false);
        } else {
          // If session refresh failed in visibility hook, try one more time with auth context
          console.log('Session refresh failed in visibility hook, trying with auth context');
          if (authContextRef.current && authContextRef.current.refreshSession) {
            const authRefreshSuccess = await authContextRef.current.refreshSession();
            if (authRefreshSuccess) {
              console.log('Auth context session refresh succeeded');
              setAppStale(false);
            } else {
              console.warn('Auth context session refresh also failed');
              setAppStale(true);
            }
          } else {
            console.warn('No auth context available for session refresh');
            setAppStale(true);
          }
        }
      } catch (e) {
        console.warn('Error in gentle visibility handling:', e);
        setAppStale(true);
      } finally {
        isHandling = false;
      }
    };

    const handleSessionFailure = (event: CustomEvent) => {
      const { reason } = event.detail;
      console.error('Session failure detected:', reason);
      setAppStale(true);
      // Show a more specific error message
      if (reason === 'tab-switch-refresh-failed') {
        console.warn('Session refresh failed after tab switch - user may need to refresh or re-login');
      }
    };

    const handleAuthContextReady = (event: CustomEvent) => {
      console.log('Auth context ready, registering refresh function');
      authContextRef.current = { refreshSession: event.detail.refreshSession };
    };

    // Listen for the new gentle visibility event and session failure events
    window.addEventListener('app:visibility-gentle', handleGentleVisibility as EventListener);
    window.addEventListener('app:session-failed', handleSessionFailure as EventListener);
    window.addEventListener('auth:context-ready', handleAuthContextReady as EventListener);
    globalAppState.listenersAttached = true;
    console.log(`Global app event listeners attached by instance ${instanceId}`);
    
    return () => {
      // Unregister this instance
      globalAppState.instances.delete(instanceId);
      
      // Only remove listeners when no instances remain
      if (globalAppState.instances.size === 0) {
        window.removeEventListener('app:visibility-gentle', handleGentleVisibility as EventListener);
        window.removeEventListener('app:session-failed', handleSessionFailure as EventListener);
        window.removeEventListener('auth:context-ready', handleAuthContextReady as EventListener);
        globalAppState.listenersAttached = false;
        console.log(`Global app event listeners removed by last instance ${instanceId}`);
      } else {
        console.log(`App instance ${instanceId} unregistered, ${globalAppState.instances.size} instances remain`);
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <VisibilityContext.Provider value={{ 
      forceRefresh, 
      registerLoadingState,
      registerAuthContext
    }}>
      {appStale && (
        <div className="fixed top-16 left-0 w-full bg-yellow-100 text-yellow-800 p-2 text-center z-50 shadow-md">
          <div className="flex items-center justify-center gap-2">
            <span>App state may be outdated after inactivity.</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={forceRefresh}
              className="bg-yellow-200 border-yellow-300 hover:bg-yellow-300"
            >
              Refresh Data
            </Button>
          </div>
        </div>
      )}
      {children}
    </VisibilityContext.Provider>
  );
};

// Redirect component based on user role
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  console.log("RoleBasedRedirect - current user:", user);
  
  if (!user) {
    console.log("No user found, redirecting to /");
    return <Navigate to="/" replace />;
  }
  
  console.log("User role:", user.role);
  if (user.role === UserRole.ADMIN) {
    console.log("Admin user, redirecting to /admin");
    return <Navigate to="/admin" replace />;
  } else if (user.role === UserRole.SUPERVISOR) {
    console.log("Supervisor user, redirecting to /expenses");
    return <Navigate to="/expenses" replace />;
  }
  
  console.log("Default case, redirecting to /dashboard");
  return <Navigate to="/dashboard" replace />;
};

// Main App
const AppContent = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/expenses" 
          element={
            <ProtectedRoute>
              <AppLayout>
                <Expenses />
              </AppLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/supervisor-sites" 
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AppLayout>
                <AdminSupervisorSites />
              </AppLayout>
            </ProtectedRoute>
          } 
        />
        <Route path="/authenticated" element={<RoleBasedRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    
    // Refresh schema cache on application startup
    const initializeApp = async () => {
      try {
        console.log("Initializing application and refreshing schema cache...");
        
        // Add a timeout to prevent schema refresh from blocking app initialization
        const timeout = setTimeout(() => {
          console.warn("Schema refresh timed out, continuing with app initialization");
          if (mounted) {
            setIsInitialized(true);
          }
        }, 2000); // 2 second timeout
        
        await refreshSchemaCache();
        
        clearTimeout(timeout);
        
        if (mounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Error initializing application:", error);
        // Store the error for display
        if (mounted) {
          setInitError(error instanceof Error ? error : new Error(String(error)));
          setIsInitialized(true); // Still set initialized to true to prevent blank screen
        }
      }
    };

    initializeApp();
    
    // Force initialization after 4 seconds max, regardless of what happens
    const maxTimeout = setTimeout(() => {
      if (mounted && !isInitialized) {
        console.warn("Forcing application initialization after timeout");
        setIsInitialized(true);
      }
    }, 4000);
    
    return () => {
      mounted = false;
      clearTimeout(maxTimeout);
    };
  }, []);

  // Recovery function to reload the application
  const handleReloadApp = () => {
    console.log("Manually reloading application");
    window.location.reload();
  };
  
  // Add event listeners to handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser detected online status');
      // Don't force a page refresh as this causes navigation issues
      // Instead just show a notification
      toast.success('Connection restored');
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-1">Loading application...</h2>
          <p className="text-muted-foreground">Please wait while we initialize the app</p>
        </div>
      </div>
    );
  }
  
  // Show error screen if there was an initialization error
  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md p-6 border rounded-lg shadow-md bg-destructive/10">
          <h2 className="text-xl font-semibold mb-3">Application Error</h2>
          <p className="text-destructive mb-4">
            There was an error loading the application. This might be due to connection issues or browser storage problems.
          </p>
          <Button onClick={handleReloadApp} className="mb-2">
            Reload Application
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            If the issue persists, try clearing your browser cache or using a different browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/">
          <AuthProvider>
            <VisibilityRefreshProvider>
              <AppContent />
            </VisibilityRefreshProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
