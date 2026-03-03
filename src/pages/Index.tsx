import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '@/components/auth/LoginForm';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/lib/types';

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    // Redirect if user is already authenticated
    if (user && !loading) {
      if (user.role === UserRole.ADMIN) {
        navigate('/admin');
      } else if (user.role === UserRole.SUPERVISOR) {
        navigate('/expenses');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, loading, navigate]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-base">F</span>
          </div>
          <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle geometric background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 border border-white rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-80 h-80 border border-white rounded-full -translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 border border-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-base">F</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">FinTrack</span>
          </div>
        </div>

        <div className="relative space-y-6">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Construction Finance,<br />
              Simplified.
            </h2>
            <p className="mt-4 text-white/70 text-base leading-relaxed max-w-sm">
              Track site expenses, advances, invoices and payments in one unified platform built for construction teams.
            </p>
          </div>

          <div className="space-y-3">
            {[
              'Real-time financial tracking across all sites',
              'Role-based access for admins & supervisors',
              'Automated summaries and expense reports',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-white/80 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-white/40 text-xs">© 2026 FinTrack · Construction Finance Management</p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-bold text-base tracking-tight">FinTrack</span>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default Index;
