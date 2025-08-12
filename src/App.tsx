import React, { useEffect, useState } from 'react';
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
import { refreshSchemaCache } from "./integrations/supabase/client";
import { VisibilityRefreshProvider } from "./contexts/visibility";
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

// Visibility context/provider moved to ./contexts/visibility to avoid circular imports

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
