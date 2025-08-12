import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, AuthUser } from '@/lib/types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchUserProfile = useCallback(async (userId: string): Promise<AuthUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No profile found is not an error here
        throw error;
      }

      if (data) {
        return { ...data, created_at: new Date(data.created_at), role: data.role as UserRole };
      }
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      toast.error('Failed to fetch user profile.');
    }
    return null;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange will handle setting user state and navigation
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole = UserRole.VIEWER): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign up successful, but no user data returned.');

      const { error: profileError } = await supabase.from('users').insert([
        { id: authData.user.id, name, email, role },
      ]);

      if (profileError) throw profileError;

      const newUser = await fetchUserProfile(authData.user.id);
      setUser(newUser);
      toast.success('Sign up successful! Please check your email to verify your account.');

    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      // Proactively clear realtime channels to avoid stale subscriptions
      try {
        supabase.removeAllChannels();
      } catch (chErr) {
        console.warn('Error clearing Supabase channels during logout:', chErr);
      }

      // Add a timeout so background-tab throttling doesn't hang logout
      const signOutWithTimeout = Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), 6000))
      ]);

      try {
        const result = await signOutWithTimeout as { error?: any } | void;
        if ((result as any)?.error) throw (result as any).error;
      } catch (err) {
        console.warn('Global signOut failed or timed out, attempting local signOut fallback:', err);
        // Fallback: ensure local session is cleared so the UI can recover
        try {
          // Some versions support scope: 'local' to clear only local session
          await (supabase.auth as any).signOut?.({ scope: 'local' });
        } catch (fallbackErr) {
          console.warn('Local signOut fallback failed:', fallbackErr);
        }
      }

      // Ensure local user state is cleared and navigate home regardless
      setUser(null);
      navigate('/');
    } catch (err: any) {
      console.error('Logout error:', err);
      setError('Failed to sign out.');
      toast.error('Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return false;
      return !!data.session;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const profile = session?.user ? await fetchUserProfile(session.user.id) : null;
      setUser(profile);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]);

  const value = { user, loading, error, login, logout, signUp, refreshSession };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
