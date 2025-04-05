import React, { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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

// Create a singleton QueryClient instance to be shared across the application
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Set the QueryClient as a global variable for access outside of React components
// @ts-ignore
window.__REACT_QUERY_GLOBALINSTANCE = queryClient;

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

// Visibility Refresh Provider component - enhanced with session keep-alive
const VisibilityRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [appStale, setAppStale] = useState(false);
  const loadingStatesRef = useRef<Record<string, boolean>>({});
  const authContextRef = useRef<any>(null);
  const hiddenTimeRef = useRef<number | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // This function will be called by components to register their loading state
  const registerLoadingState = useCallback((id: string, isLoading: boolean) => {
    loadingStatesRef.current[id] = isLoading;
  }, []);
  
  // Register the auth context so we can refresh sessions
  const registerAuthContext = useCallback((authContext: any) => {
    authContextRef.current = authContext;
  }, []);
  
  // Clear all loading states and force a refresh only when explicitly called
  const forceRefresh = useCallback(async () => {
    console.log('Forcing application refresh...');
    
    // Reset all loading states to false
    Object.keys(loadingStatesRef.current).forEach(key => {
      loadingStatesRef.current[key] = false;
    });
    
    // Reset stale state
    setAppStale(false);
    
    try {
      // 1. Check and refresh auth session first
      if (authContextRef.current?.refreshSession) {
        const sessionValid = await authContextRef.current.refreshSession();
        if (!sessionValid) {
          console.warn('Session invalid during refresh, redirecting to login');
          // Redirect to login page - auth provider will handle this
          return;
        }
      }
      
      // 2. Reset Supabase connections
      supabase.removeAllChannels();
      
      // 3. Test connection with simple query
      const { error } = await supabase.from('users')
        .select('count')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error reconnecting to Supabase:', error);
        if (error.message?.includes('JWT') || error.message?.includes('token')) {
          // JWT error - session is expired
          toast.error('Your session has expired. Redirecting to login...');
          // Force logout through auth context
          if (authContextRef.current?.logout) {
            await authContextRef.current.logout();
          }
          return;
        }
        
        // Other connection errors - show toast and continue trying
        toast.error('Connection error. Retrying...');
      }
      
      // 4. Recreate Supabase channel
      const channel = supabase.channel('system');
      channel.subscribe((status) => {
        console.log(`Supabase channel status: ${status}`);
      });
      
      // 5. Refresh all React Query data
      // @ts-ignore
      const queryClient = window.__REACT_QUERY_GLOBALINSTANCE;
      if (queryClient) {
        // Invalidate all queries to trigger refetching
        await queryClient.invalidateQueries();
        queryClient.refetchQueries();
      }
      
      // 6. Update refresh timestamp to trigger re-renders
      setLastRefreshTime(Date.now());
      
      console.log('Application refresh complete');
    } catch (error) {
      console.error('Error during application refresh:', error);
      toast.error('Error refreshing data. Please reload the page.');
    }
  }, []);

  // Set up session keep-alive functionality
  useEffect(() => {
    // Keep the session alive by pinging every 10 minutes
    // This prevents session timeout during active use even if the tab is inactive
    const KEEP_ALIVE_INTERVAL = 600000; // 10 minutes
    
    const setupKeepAlive = async () => {
      keepAliveIntervalRef.current = setInterval(async () => {
        // Only ping if the user is authenticated
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          console.log('Executing session keep-alive ping');
          try {
            // Simple lightweight query to keep the connection active
            await supabase.from('users').select('count').limit(1);
          } catch (error) {
            console.error('Keep-alive ping failed:', error);
          }
        } else {
          // No active session, clear the interval
          if (keepAliveIntervalRef.current) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
          }
        }
      }, KEEP_ALIVE_INTERVAL);
    };
    
    setupKeepAlive();
    
    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
    };
  }, []);
  
  // Handle document visibility changes - with improved reconnection
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const currentTime = Date.now();
        const timeHidden = hiddenTimeRef.current ? currentTime - hiddenTimeRef.current : 0;
        console.log(`Tab became visible after ${timeHidden}ms`);
        
        // Clear any loading states to prevent UI from being stuck
        Object.keys(loadingStatesRef.current).forEach(key => {
          loadingStatesRef.current[key] = false;
        });
        
        // Always refresh data on tab focus for admin pages
        // Check the current path to see if we're on an admin page
        const currentPath = window.location.pathname;
        const isAdminPage = currentPath.includes('/admin');
        
        // For admin pages, always refresh data
        // For non-admin pages, only refresh after a significant time away (5 seconds)
        if (isAdminPage || timeHidden > 5000) {
          console.log(`${isAdminPage ? 'Admin page' : 'Page'} detected, refreshing data after tab switch`);
          
          // Add short delay before refresh to ensure UI is responsive first
          setTimeout(() => {
            forceRefresh();
          }, 100);
        }
        
        // Show stale banner only for very long absences
        if (timeHidden > 30000) {
          setAppStale(true);
          toast.info('Tab was inactive for a while. Click refresh if functionality is limited.');
        }
        
        hiddenTimeRef.current = null;
      } else {
        // Tab is being hidden
        hiddenTimeRef.current = Date.now();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forceRefresh]);

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
  const { forceRefresh } = useContext(VisibilityContext);
  const queryClient = useQueryClient();
  const reconnectAttemptRef = useRef(0);

  // Monitor connection to Supabase with enhanced error recovery
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
            
            // Schedule more frequent reconnection attempts
            reconnectAttemptRef.current = 0;
            scheduleReconnect();
          }
        } else {
          if (mounted && connectionStatus !== 'online') {
            if (connectionStatus === 'offline') {
              toast.success('Connection to server restored');
              
              // Force a complete data refresh when connection is restored
              forceRefresh();
            }
            setConnectionStatus('online');
          }
          // Reset reconnection attempts counter on successful connection
          reconnectAttemptRef.current = 0;
        }
      } catch (error) {
        if (mounted && connectionStatus !== 'offline') {
          console.error('Error checking connection:', error);
          setConnectionStatus('offline');
          toast.error('Connection to server lost. Retrying...');
          
          // Schedule reconnection attempts
          reconnectAttemptRef.current = 0;
          scheduleReconnect();
        }
      }
    };
    
    // Schedule reconnection with exponential backoff
    const scheduleReconnect = () => {
      // Increase attempts counter
      reconnectAttemptRef.current += 1;
      
      // Calculate delay with exponential backoff (1s, 2s, 4s, 8s, max 30s)
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current - 1), 30000);
      
      console.log(`Scheduling reconnection attempt ${reconnectAttemptRef.current} in ${delay}ms`);
      
      // Schedule reconnection attempt
      setTimeout(() => {
        if (mounted && connectionStatus === 'offline') {
          console.log(`Attempting reconnection #${reconnectAttemptRef.current}...`);
          checkConnection();
        }
      }, delay);
    };

    // Initial check
    checkConnection();

    // Set up interval to periodically check connection
    pingInterval = setInterval(checkConnection, 30000); // Check every 30 seconds

    // Add an event listener for the visibility change event to enhance tab switching behavior
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, checking connection immediately');
        checkConnection();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearInterval(pingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionStatus, forceRefresh, queryClient]);

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
