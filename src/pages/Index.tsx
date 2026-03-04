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
          <img src="/mew-logo.png" alt="MEW" className="h-14 w-auto object-contain" />
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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-slate-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle geometric background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 border border-white rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-80 h-80 border border-white rounded-full -translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 border border-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative">
          {/* Logo + company name header */}
          <div className="flex items-center gap-4 mb-2">
            <img src="/mew-logo.png" alt="Maurice Engineering Works" className="h-16 w-auto object-contain bg-white rounded-xl p-1 shadow-lg" />
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="text-white font-extrabold text-2xl tracking-tight">
                  <span className="bg-red-600 px-2 py-0.5 rounded-sm mr-1">MAURICE</span>
                  <span>ENGINEERING WORKS</span>
                </span>
              </div>
              <span className="text-white/70 text-sm mt-1 italic font-medium">Believe in Quality Work</span>
            </div>
          </div>
          <div className="h-px bg-white/20 mt-4" />
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
          <p className="text-white/40 text-xs">© 2026 Maurice Engineering Works · Construction Finance Management</p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="/mew-logo.png" alt="MEW" className="h-10 w-auto object-contain" />
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-sm tracking-tight">
                <span className="text-red-600">MAURICE</span> ENGINEERING WORKS
              </span>
              <span className="text-[10px] text-muted-foreground">Believe in Quality Work</span>
            </div>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default Index;
