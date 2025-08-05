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
  
  // Add refs to prevent excessive auth checks
  const lastSessionCheckRef = useRef(0);
  const sessionCheckInProgressRef = useRef(false);
  const authStateChangeCountRef = useRef(0);

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
    // Define a timeout that will prevent blocking the UI if auth check hangs
    let timeoutId: NodeJS.Timeout;
    
    const checkSession = async () => {
      // Prevent excessive session checks
      const now = Date.now();
      if (sessionCheckInProgressRef.current || (now - lastSessionCheckRef.current < 2000)) {
        console.log('Session check skipped - too recent or in progress');
        return;
      }
      
      sessionCheckInProgressRef.current = true;
      lastSessionCheckRef.current = now;
      
      try {
        console.log("Checking for existing session...");
        
        // Use a longer timeout for background tabs and add retry logic
        const checkSessionWithRetry = async (retryCount = 0): Promise<any> => {
          const maxRetries = 1; // Reduce retries to prevent loops
          const timeoutDuration = document.hidden ? 25000 : 20000; // Longer timeouts

          try {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Session check timed out')), timeoutDuration);
            });

            const sessionPromise = supabase.auth.getSession();

            return await Promise.race([
              sessionPromise,
              timeoutPromise
            ]);
          } catch (error) {
            if (retryCount < maxRetries) {
              console.log(`Session check failed, retrying... (${retryCount + 1}/${maxRetries})`);
              await new Promise(res => setTimeout(res, 1000)); // wait 1s before retry
              return checkSessionWithRetry(retryCount + 1);
            }
            throw error; // re-throw error after max retries
          }
        };
        
        const sessionResult = await checkSessionWithRetry();
        
        const { data: { session } } = sessionResult;
        
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
              // Clear the potentially corrupted session
              await supabase.auth.signOut({ scope: 'local' });
            }
          }
        } else {
          console.log("No existing session found");
        }
      } catch (error) {
        console.error('Session check error:', error);
        
        // More conservative error handling - don't clear session for timeout errors
        if (error.message?.includes('timeout')) {
          console.log('Session check timed out - will retry when needed');
        } else if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
          console.log('Auth token invalid, clearing session');
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (signOutError) {
            console.error('Error during auth recovery:', signOutError);
          }
        } else {
          console.log('Session check failed, but not clearing session to avoid loops');
        }
        
        if (mounted) {
          // Only set error for genuine auth failures, not timeouts
          if (!error.message?.includes('timeout')) {
            setError('Authentication error occurred');
          }
        }
      } finally {
        sessionCheckInProgressRef.current = false;
        if (mounted) {
          console.log("Initial auth check complete, setting loading to false");
          setLoading(false);
        }
      }
    };

    // Set a safety timeout to ensure loading state is reset even if checkSession hangs
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth check timed out after 10 seconds, forcing loading state to false");
        setLoading(false);
      }
    }, 10000);

    checkSession();

    // Listen for auth changes with debouncing
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Prevent excessive auth state changes
        authStateChangeCountRef.current++;
        if (authStateChangeCountRef.current > 10) {
          console.warn('Too many auth state changes, throttling');
          return;
        }
        
        console.log("Auth state change event:", event);
        
        // Don't set loading for every auth state change
        if (event !== 'INITIAL_SESSION') {
          setLoading(true);
        }
        
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
      // Removed this functionality as it's causing issues with form submission
      // when users copy content from other websites
      return;
    };
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      // if (timeoutId) clearTimeout(timeoutId);
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
      setUser(null); // Clear user immediately to ensure UI updates

      // First, try a local state clear no matter what
      localStorage.removeItem('supabase.auth.token'); // Clear any stored tokens
      
      // Very short timeout to prevent hanging - 2 seconds should be more than enough
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      try {
        // Try to sign out from Supabase, but don't wait too long
        await supabase.auth.signOut({ 
          scope: 'local' // Use local scope to avoid session storage issues
        });
        clearTimeout(timeoutId);
      } catch (signOutError) {
        console.error('Error during signOut API call:', signOutError);
        // Continue with navigation even if API call fails
      }
      
      // Always navigate to home page regardless of API call success
      navigate('/');
    } catch (error: any) {
      console.error('Logout error:', error);
      
      // Show error toast but still navigate to login
      toast.error('Logout encountered an error, but you have been signed out locally');
      navigate('/');
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
