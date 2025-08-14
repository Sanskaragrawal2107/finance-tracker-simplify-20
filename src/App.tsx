import React, { useEffect } from 'react';
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
import { pageVisibilityManager } from '@/utils/pageVisibility';
import '@/utils/runtime-guard'; // Import for side effects in development

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Redirect component based on user role
const RoleBasedRedirect: React.FC = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  switch (user.role) {
    case UserRole.ADMIN:
      return <Navigate to="/admin" replace />;
    case UserRole.SUPERVISOR:
      return <Navigate to="/expenses" replace />;
    case UserRole.VIEWER:
      return <Navigate to="/dashboard" replace />;
    default:
      return <Navigate to="/" replace />;
  }
};

// Main App Content
const AppContent: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const isAuthPage = location.pathname === '/';
  const showNavbar = !isAuthPage && user;

  return (
    <div className="min-h-screen bg-background">
      {showNavbar && <Navbar />}
      <main className={showNavbar ? "pt-16" : ""}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/role-redirect" element={<RoleBasedRedirect />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={[UserRole.VIEWER, UserRole.ADMIN]}>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/expenses" element={
            <ProtectedRoute allowedRoles={[UserRole.SUPERVISOR, UserRole.ADMIN]}>
              <AppLayout>
                <Expenses />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/supervisor-sites" element={
            <ProtectedRoute allowedRoles={[UserRole.SUPERVISOR, UserRole.ADMIN]}>
              <AppLayout>
                <SupervisorSites />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/admin/supervisor-sites" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <AppLayout>
                <AdminSupervisorSites />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    console.log('Initializing application...');
    
    // Initialize schema cache on app start
    const initializeApp = async () => {
      try {
        await refreshSchemaCache();
        console.log('Schema cache initialized');
      } catch (error) {
        console.warn('Schema cache initialization failed:', error);
      }
    };
    
    initializeApp();

    // Set up centralized visibility handling to prevent admin page freezing
    const handleVisibilityChange = (state: { isPageVisible: boolean; timeHidden: number }) => {
      if (state.isPageVisible && state.timeHidden > 3000) {
        console.log(`Tab became visible after ${state.timeHidden}ms - triggering recovery`);
        
        // Dispatch recovery event for components to handle
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('app:tab-recovered', {
            detail: { timeHidden: state.timeHidden }
          }));
        }, 0);
      }
    };

    // Subscribe to visibility changes
    const unsubscribeVisibility = pageVisibilityManager.subscribe(handleVisibilityChange);

    return () => {
      unsubscribeVisibility();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
            <Toaster />
            <Sonner />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
