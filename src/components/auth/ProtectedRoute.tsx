import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles = [UserRole.ADMIN, UserRole.SUPERVISOR]
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  // Store the current path in sessionStorage when entering a protected route
  // This helps restore the correct route after page refresh
  useEffect(() => {
    if (!loading && user) {
      console.log("Storing last visited path:", location.pathname);
      sessionStorage.setItem('lastVisitedPath', location.pathname);
    }
  }, [location.pathname, loading, user]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    // Store intended destination before redirecting
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute; 