import React from 'react';
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
import NotFound from "./pages/NotFound";
import Navbar from "./components/layout/Navbar";
import { UserRole } from "./lib/types";
import { useIsMobile } from "./hooks/use-mobile";
import { AuthProvider, useAuth } from "./hooks/use-auth";

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

// Protected route component
const ProtectedRoute = ({ 
  children, 
  allowedRoles = [UserRole.ADMIN, UserRole.SUPERVISOR]
}: { 
  children: React.ReactNode, 
  allowedRoles?: UserRole[] 
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
};

// Layout component for authenticated pages
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    
    switch (path) {
      case '/dashboard':
        return 'Dashboard';
      case '/expenses':
        return 'Expenses';
      case '/admin':
        return 'Admin Dashboard';
      default:
        return '';
    }
  };
  
  // For debugging location state
  console.log("Current location state:", location.state);
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar 
        onMenuClick={() => {}} // Empty function since we don't have a sidebar
        pageTitle={getPageTitle()}
        userRole={user?.role}
      />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
        <div className="container mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// Main App
const AppContent = () => {
  return (
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
              <SupervisorSites />
            </AppLayout>
          </ProtectedRoute>
        } 
      />
      <Route path="/authenticated" element={<RoleBasedRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
