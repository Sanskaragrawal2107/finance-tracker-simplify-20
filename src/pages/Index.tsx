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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-blue-50 to-indigo-50 p-4">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-100 blur-3xl opacity-70 animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-1/4 -right-24 w-96 h-96 rounded-full bg-indigo-100 blur-3xl opacity-70 animate-pulse" style={{ animationDuration: '10s' }}></div>
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-cyan-100 blur-3xl opacity-70 animate-pulse" style={{ animationDuration: '12s' }}></div>
      </div>
      
      <div className="flex flex-col lg:flex-row items-center justify-between max-w-6xl w-full z-10">
        <div className="lg:w-1/2 lg:pr-12 mb-8 lg:mb-0 text-center lg:text-left">
          <h1 className="text-4xl font-bold tracking-tight mb-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Finance Tracking <br /> Simplified
          </h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-md mx-auto lg:mx-0 animate-fade-up" style={{ animationDelay: '0.4s' }}>
            Efficiently manage your site expenses, advances, invoices, and payments with our comprehensive financial tracking system.
          </p>
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center justify-center lg:justify-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p className="text-base">Real-time financial tracking</p>
            </div>
            <div className="flex items-center justify-center lg:justify-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p className="text-base">Automated expense categorization</p>
            </div>
            <div className="flex items-center justify-center lg:justify-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p className="text-base">Role-based access control</p>
            </div>
          </div>
        </div>
        
        <div className="lg:w-1/2 w-full max-w-md animate-scale-in" style={{ animationDelay: '0.8s' }}>
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default Index;
