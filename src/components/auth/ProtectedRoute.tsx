import React, { useEffect, useState } from 'react';
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
  const [showLoader, setShowLoader] = useState(true);
  
  // Add a time limit for showing the loading state to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 3000); // Stop showing loader after 3 seconds
    
    return () => clearTimeout(timer);
  }, []);
  
  // Only show loading indicator for a limited time
  if (loading && showLoader) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // No user after loading is complete, redirect to login
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  // User doesn't have required role
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  // All checks passed, render children
  return <>{children}</>;
};

export default ProtectedRoute; 