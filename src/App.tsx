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

  // Clear all loading states and force a refresh only when explicitly called
  const forceRefresh = useCallback(async () => {
    // Reset all loading states to false
    Object.keys(loadingStatesRef.current).forEach(key => {
      loadingStatesRef.current[key] = false;
    });
    
    // Force component refresh by updating the refresh time
    setLastRefreshTime(Date.now());
    
    // Reset stale state
    setAppStale(false);
    
    // Reconnect Supabase channels
    supabase.removeAllChannels();
    
    try {
      // Try to refresh the auth session too (this will be properly initialized once AuthProvider mounts)
      if (authContextRef.current && authContextRef.current.refreshSession) {
        console.log('Refreshing auth session through forceRefresh');
        await authContextRef.current.refreshSession();
      }
      
      setTimeout(() => {
        try {
          supabase.channel('system').subscribe();
          console.log('Reconnected Supabase channels');
        } catch (error) {
          console.error('Error reconnecting Supabase channels:', error);
        }
      }, 100);
    } catch (error) {
      console.error('Error in forceRefresh:', error);
    }
  }, []);

  // Register a loading state from a component
  const registerLoadingState = useCallback((id: string, isLoading: boolean) => {
    loadingStatesRef.current[id] = isLoading;
    
    // If anything is loading, set a timeout to clear all loading states
    // This prevents infinite loading states but with longer timeout
    if (isLoading && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        console.warn(`Forcing loading state to clear after timeout for: ${id}`);
        // Only clear the specific loading state that timed out
        loadingStatesRef.current[id] = false;
        timeoutRef.current = null;
      }, 30000); // 30 second timeout - more reasonable for form submissions
    } else if (!isLoading && timeoutRef.current) {
      // If this specific loading state is done, clear the timeout
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Register auth context for refreshing
  const registerAuthContext = useCallback((authContext: any) => {
    console.log('Auth context registered for visibility refresh');
    authContextRef.current = authContext;
  }, []);

  // Use centralized visibility refresh hook instead of direct listener
  useVisibilityRefresh(5000);

  // Listen for the centralized visibility event
  // Listen for the centralized visibility event and auth context ready
  useEffect(() => {
    let isHandling = false; // Prevent multiple simultaneous handlers
    
    const handleCentralizedVisibility = async () => {
      if (isHandling) return;
      isHandling = true;
      
      console.log('App received centralized visibility event');
      
      try {
        // Refresh auth session if we have auth context
        if (authContextRef.current && authContextRef.current.refreshSession) {
          console.log('Refreshing auth session through centralized handler');
          await authContextRef.current.refreshSession();
        }
        
        // Mark app as fresh again
        setAppStale(false);
      } catch (e) {
        console.warn('Session refresh on visibility failed:', e);
      } finally {
        isHandling = false;
      }
    };

    const handleAuthContextReady = (event: CustomEvent) => {
      console.log('Auth context ready, registering refresh function');
      authContextRef.current = { refreshSession: event.detail.refreshSession };
    };

    window.addEventListener('app:visibility-change', handleCentralizedVisibility as EventListener);
    window.addEventListener('auth:context-ready', handleAuthContextReady as EventListener);
    
    return () => {
      window.removeEventListener('app:visibility-change', handleCentralizedVisibility as EventListener);
      window.removeEventListener('auth:context-ready', handleAuthContextReady as EventListener);
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
