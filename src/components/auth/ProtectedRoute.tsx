import React, { useRef } from 'react';
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

  // Track whether we ever had an authenticated user in this mount.
  // This prevents brief auth-loading flashes (e.g. TOKEN_REFRESHED on tab-switch,
  // mobile camera returning, screen lock) from unmounting children and destroying
  // all React state (form data, open dialogs, etc.).
  const wasAuthenticatedRef = useRef(false);
  if (user) {
    wasAuthenticatedRef.current = true;
  }

  // INITIAL load only: show spinner while Supabase restores the session.
  // If we previously had a user, keep rendering children during brief loading flashes.
  if (loading && !wasAuthenticatedRef.current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Loading is finished and there is no user → go to login.
  // But only redirect when loading is actually done (not during a brief flash).
  if (!loading && !user) {
    wasAuthenticatedRef.current = false;
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // User doesn't have the required role → go to their home
  if (user && allowedRoles && !allowedRoles.includes(user.role)) {
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