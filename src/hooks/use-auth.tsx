import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const navigate = useNavigate();

  // Prevent stale profile fetches from overwriting a logout that already happened
  const isSignedOutRef = useRef(false);

  const fetchUserProfile = useCallback(async (userId: string): Promise<AuthUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      if (data) {
        return { ...data, created_at: new Date(data.created_at), role: data.role as UserRole };
      }
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
    }
    return null;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);
    isSignedOutRef.current = false;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange handles setting user + navigation
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
      toast.error(err.message);
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole = UserRole.VIEWER): Promise<void> => {
    setLoading(true);
    setError(null);
    isSignedOutRef.current = false;
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign up successful, but no user data returned.');

      const { error: profileError } = await supabase.from('users').insert([
        { id: authData.user.id, name, email, role },
      ]);
      if (profileError) throw profileError;

      const newUser = await fetchUserProfile(authData.user.id);
      setUser(newUser);
      toast.success('Sign up successful!');
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message);
      toast.error(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    // 1. Immediately clear client-side user state so the UI responds instantly
    isSignedOutRef.current = true;
    setUser(null);
    setError(null);

    try {
      // 2. Use scope:'local' — clears localStorage session even if server is unreachable
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        // Non-fatal: local session is already cleared above
        console.warn('Server-side sign out error (local session still cleared):', error);
      }
    } catch (err: any) {
      // Also non-fatal
      console.warn('Sign out exception (local session still cleared):', err);
    } finally {
      setLoading(false);
      // 3. Navigate unconditionally — no try/catch can block this
      navigate('/');
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_OUT must be handled synchronously and immediately
      // Using setTimeout would cause the old user to still be in state when navigate('/') fires
      if (event === 'SIGNED_OUT') {
        isSignedOutRef.current = true;
        setUser(null);
        setLoading(false);
        return;
      }

      // If logout() has already cleared our state, ignore any subsequent session events
      // (prevents TOKEN_REFRESHED from running after a SIGNED_OUT and re-logging user in)
      if (isSignedOutRef.current) {
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED is the most common event on tab-switch / screen lock return.
      // Setting loading=true for it causes ProtectedRoute to briefly unmount children,
      // destroying all React state (form data, open dialogs). Since we already have a
      // valid user in state, silently update the profile without flashing loading.
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        fetchUserProfile(session.user.id)
          .then(profile => {
            if (!isSignedOutRef.current && profile) {
              setUser(profile);
            }
          })
          .catch(() => { /* keep existing user state */ });
        return;
      }

      setLoading(true);

      // For all other events: fetch profile asynchronously
      // We use setTimeout to avoid Supabase internal deadlocks when fetching from within the callback
      setTimeout(() => {
        if (session?.user) {
          fetchUserProfile(session.user.id)
            .then(profile => {
              // Double-check we haven't signed out while the fetch was in flight
              if (!isSignedOutRef.current) {
                setUser(profile);
              }
              setLoading(false);
            })
            .catch(() => {
              setUser(null);
              setLoading(false);
            });
        } else {
          setUser(null);
          setLoading(false);
        }
      }, 0);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]);

  // Register this auth context with the visibility system
  useEffect(() => {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('auth:context-ready', {
        detail: { refreshSession }
      }));
    }
  }, [refreshSession]);

  const value = { user, loading, error, login, logout, signUp, refreshSession };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
