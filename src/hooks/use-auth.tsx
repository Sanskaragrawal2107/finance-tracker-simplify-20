import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserRole, AuthUser } from '@/lib/types';
import { VisibilityContext } from '@/App';

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const lastVisibilityChangeRef = useRef(Date.now());
  const { registerAuthContext } = useContext(VisibilityContext);

  // Register this auth context with the visibility system when it's available
  useEffect(() => {
    // This helps the visibility system refresh auth when needed
    const authInterface = {
      refreshSession,
      user,
    };
    
    registerAuthContext(authInterface);
  }, [registerAuthContext, user]);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log("Fetching user profile for ID:", userId);
      // Use type assertion to bypass TypeScript errors with Supabase
      const { data, error } = await (supabase
        .from('users') as any)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      console.log("Found user profile:", data);
      return data as AuthUser;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  // Function to refresh the session token
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Manually refreshing auth session');
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return false;
      }

      if (data?.session) {
        // Fetch user profile with the refreshed token
        if (data.session.user.id) {
          const profile = await fetchUserProfile(data.session.user.id);
          if (profile) {
            setUser(profile);
            console.log('Auth session refreshed successfully');
            return true;
          }
        }
      }
      
      return false;
    } catch (err) {
      console.error('Error in refreshSession:', err);
      return false;
    }
  }, []);

  // Check active session and fetch user data on mount
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const checkSession = async () => {
      try {
        console.log("Checking for existing session...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && mounted) {
          console.log("Found existing session, fetching user profile");
          const profile = await fetchUserProfile(session.user.id);
          if (profile && mounted) {
            console.log("Setting user from existing session");
            setUser(profile);
            
            // Don't forcefully redirect on page load/refresh if we already have a path
            // This prevents redirect loops when reloading specific pages
            const currentPath = window.location.pathname;
            if (currentPath === '/' && profile) {
              console.log("User on root path, redirecting based on role");
              if (profile.role === UserRole.ADMIN) {
                navigate('/admin', { replace: true });
              } else if (profile.role === UserRole.SUPERVISOR) {
                navigate('/expenses', { replace: true });
              } else {
                navigate('/dashboard', { replace: true });
              }
            }
          } else {
            console.log("No user profile found for existing session");
            // If we have a session but no profile, log this error
            if (mounted) {
              console.error("Session exists but no user profile found");
            }
          }
        } else {
          console.log("No existing session found");
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        if (mounted) {
          console.log("Initial auth check complete, setting loading to false");
          setLoading(false);
        }
      }
    };

    // Set a safety timeout to ensure loading state is reset even if checkSession hangs
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth check timed out after 5 seconds, forcing loading state to false");
        setLoading(false);
      }
    }, 5000);

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log("Auth state change event:", event);
        setLoading(true);
        
        if (event === 'SIGNED_IN' && session) {
          console.log("Auth state change - SIGNED_IN:", session.user.id);
          const profile = await fetchUserProfile(session.user.id);
          if (profile && mounted) {
            console.log("Setting user with role:", profile.role);
            setUser(profile);
            
            // Redirect based on role - only if on login page or root
            const currentPath = window.location.pathname;
            // Only redirect if coming from login or root path
            if (currentPath === '/' || currentPath === '/login') {
              console.log("Redirecting from login/root based on role");
              if (profile.role === UserRole.ADMIN) {
                navigate('/admin', { replace: true });
              } else if (profile.role === UserRole.SUPERVISOR) {
                navigate('/expenses', { replace: true });
              } else {
                navigate('/dashboard', { replace: true });
              }
            } else {
              // User is already on a specific page, keep them there
              console.log("User already on specific page:", currentPath);
            }
            setLoading(false);
          } else {
            // Important: Still set loading to false if profile not found
            console.error("No user profile found after sign-in");
            if (mounted) {
              setLoading(false);
            }
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Handle token refresh without redirects
          console.log("Auth token refreshed");
          const profile = await fetchUserProfile(session.user.id);
          if (profile && mounted) {
            setUser(profile);
          }
          setLoading(false);
        } else if (event === 'SIGNED_OUT' && mounted) {
          setUser(null);
          navigate('/');
          setLoading(false);
        } else {
          // Handle other auth events by ensuring loading state is reset
          if (mounted) {
            setLoading(false);
          }
        }
      }
    );

    // Handle tab visibility changes to refresh auth when needed
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const currentTime = Date.now();
        const timeHidden = currentTime - lastVisibilityChangeRef.current;
        lastVisibilityChangeRef.current = currentTime;
        
        // If tab was hidden for more than 1 minute, refresh auth
        if (timeHidden > 60000 && user) {
          console.log(`Tab was hidden for ${timeHidden}ms, refreshing auth session`);
          const refreshed = await refreshSession();
          if (!refreshed) {
            console.warn('Failed to refresh session on tab visibility change');
            
            // Check if we can still access the API
            try {
              const { error } = await supabase.from('users').select('count').limit(1);
              if (error) {
                console.error('API connection test failed after tab switch:', error);
                toast.error('Connection issues detected. Try refreshing the page.');
              }
            } catch (err) {
              console.error('Error testing API connection:', err);
            }
          }
        }
      } else {
        // Tab is being hidden, update the timestamp
        lastVisibilityChangeRef.current = Date.now();
      }
    };
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, loading, refreshSession, user]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Attempting login for:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        console.log("Login successful for:", data.user.id);
        const profile = await fetchUserProfile(data.user.id);
        if (profile) {
          console.log("Found user profile with role:", profile.role);
          setUser(profile);

          // Redirect based on role
          console.log("Redirecting based on role:", profile.role);
          if (profile.role === UserRole.ADMIN) {
            console.log("Redirecting to /admin");
            navigate('/admin', { replace: true });
          } else if (profile.role === UserRole.SUPERVISOR) {
            console.log("Redirecting to /expenses");
            navigate('/expenses', { replace: true });
          } else {
            console.log("Redirecting to /dashboard");
            navigate('/dashboard', { replace: true });
          }
        } else {
          console.error("No user profile found for:", data.user.id);
          toast.error("User profile not found");
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login');
      toast.error(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole = UserRole.SUPERVISOR) => {
    try {
      setLoading(true);
      setError(null);
      
      // First, create the user in auth.users
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Then, create a record in public.users with the same ID
        const { error: profileError } = await (supabase
          .from('users') as any)
          .insert({
            id: data.user.id,
            email: email,
            name: name,
            role: role
          });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          // Try to delete the auth user if profile creation fails
          await supabase.auth.admin.deleteUser(data.user.id);
          throw profileError;
        }

        toast.success('Registration successful! Please check your email for verification.');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'An error occurred during registration');
      toast.error(error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      setUser(null);
      navigate('/');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error(error.message || 'An error occurred during logout');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    signUp,
    refreshSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
