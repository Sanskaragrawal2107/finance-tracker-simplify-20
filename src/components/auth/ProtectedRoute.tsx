import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = [UserRole.ADMIN, UserRole.SUPERVISOR],
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // While Supabase is restoring a session (e.g. page refresh), show a spinner.
  // Never redirect while loading — that would cause a flash to /login then back.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Loading is finished and there is no user → go to login
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // User doesn't have the required role → go to their home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback =
      user.role === UserRole.ADMIN
        ? '/admin'
        : user.role === UserRole.SUPERVISOR
        ? '/supervisor-sites'
        : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;