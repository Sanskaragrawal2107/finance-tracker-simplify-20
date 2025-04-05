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
import { refreshSchemaCache, supabase } from "./integrations/supabase/client";
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
    // This prevents infinite loading states
    if (isLoading && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        console.warn("Forcing loading states to clear after timeout");
        Object.keys(loadingStatesRef.current).forEach(key => {
          loadingStatesRef.current[key] = false;
        });
        timeoutRef.current = null;
      }, 10000); // 10 second timeout
    } else if (!isLoading && timeoutRef.current) {
      // If nothing is loading anymore, clear the timeout
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Register auth context for refreshing
  const registerAuthContext = useCallback((authContext: any) => {
    console.log('Auth context registered for visibility refresh');
    authContextRef.current = authContext;
  }, []);

  // Handle document visibility changes - with improved reconnection
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const currentTime = Date.now();
        const timeHidden = hiddenTimeRef.current ? currentTime - hiddenTimeRef.current : 0;
        
        // If the tab was hidden for less than 1 second, ignore it completely
        // This helps with copy-paste operations that briefly change tab focus
        if (timeHidden < 1000) {
          console.log(`Tab was only hidden for ${timeHidden}ms - ignoring visibility change`);
          hiddenTimeRef.current = null;
          return;
        }
        
        console.log(`Tab became visible after ${timeHidden}ms`);
        
        // Only clear loading states without refreshing data
        Object.keys(loadingStatesRef.current).forEach(key => {
          loadingStatesRef.current[key] = false;
        });
        
        // Only mark app as stale after substantial inactivity (>30 seconds)
        if (timeHidden > 30000) {
          console.log('App marked as stale after long inactivity');
          setAppStale(true);
          toast.info('Tab was inactive for a while. Click buttons again or refresh the page if functionality is limited.');
          
          // Try to reconnect Supabase
          try {
            // Try to refresh the auth session
            if (authContextRef.current && authContextRef.current.refreshSession) {
              console.log('Refreshing auth session after tab visibility change');
              const refreshed = await authContextRef.current.refreshSession();
              if (refreshed) {
                console.log('Auth session refreshed successfully');
              } else {
                console.warn('Auth session refresh failed');
              }
            }
            
            supabase.removeAllChannels();
            setTimeout(() => {
              supabase.channel('system').subscribe();
              console.log('Attempted to reconnect Supabase after inactivity');
            }, 100);
          } catch (err) {
            console.error('Error reconnecting after inactivity:', err);
          }
        }
        
        hiddenTimeRef.current = null;
      } else {
        // Tab is being hidden, store the current time
        hiddenTimeRef.current = Date.now();
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Clear any pending timeouts
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
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Monitor connection to Supabase
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    let mounted = true;

    // Function to check connection
    const checkConnection = async () => {
      try {
        // Use a simple query to check if Supabase is reachable
        const { error } = await supabase.from('users').select('id').limit(1);
        
        if (error && error.message.includes('network')) {
          if (mounted && connectionStatus !== 'offline') {
            console.warn('Supabase connection lost:', error.message);
            setConnectionStatus('offline');
            toast.error('Connection to server lost. Retrying...');
          }
        } else {
          if (mounted && connectionStatus !== 'online') {
            if (connectionStatus === 'offline') {
              toast.success('Connection to server restored');
            }
            setConnectionStatus('online');
          }
        }
      } catch (error) {
        if (mounted && connectionStatus !== 'offline') {
          console.error('Error checking connection:', error);
          setConnectionStatus('offline');
          toast.error('Connection to server lost. Retrying...');
        }
      }
    };

    // Initial check
    checkConnection();

    // Set up interval to periodically check connection
    pingInterval = setInterval(checkConnection, 30000); // Check every 30 seconds

    return () => {
      mounted = false;
      clearInterval(pingInterval);
    };
  }, [connectionStatus]);

  return (
    <>
      {connectionStatus === 'offline' && (
        <div className="fixed top-0 left-0 w-full bg-red-500 text-white py-1 px-4 text-center z-50">
          Connection to server lost. Trying to reconnect...
        </div>
      )}
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
