
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface LoginFormProps {
  className?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ className }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, signUp, loading, error } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegistering) {
      await signUp(email, password, name);
    } else {
      await login(email, password);
    }
  };
  
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {isRegistering ? 'Create account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isRegistering
            ? 'Fill in the details below to get started'
            : 'Sign in to your FinTrack account'}
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-[10px] font-bold">!</span>
          </div>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegistering && (
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Full Name
            </label>
            <div className="relative">
              <User className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full h-10 pl-9 pr-4 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required={isRegistering}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Email Address
          </label>
          <div className="relative">
            <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-10 pl-9 pr-4 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Password
          </label>
          <div className="relative">
            <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 pl-9 pr-10 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full h-10 rounded-md bg-primary text-white text-sm font-semibold transition-all shadow-sm',
              loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/90 active:scale-[0.98]'
            )}
          >
            {loading
              ? (isRegistering ? 'Creating account…' : 'Signing in…')
              : (isRegistering ? 'Create Account' : 'Sign In')}
          </button>
        </div>

        <div className="text-center text-sm text-muted-foreground pt-2">
          {isRegistering ? (
            <p>
              Already have an account?{' '}
              <button type="button" onClick={() => setIsRegistering(false)} className="text-primary font-semibold hover:underline">
                Sign in
              </button>
            </p>
          ) : (
            <p>
              Need an account?{' '}
              <button type="button" onClick={() => setIsRegistering(true)} className="text-primary font-semibold hover:underline">
                Create one
              </button>
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
