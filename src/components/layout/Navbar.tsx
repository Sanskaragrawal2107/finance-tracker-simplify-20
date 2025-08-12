import React, { useEffect, useRef, useContext } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Home, Building, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { VisibilityContext } from '@/contexts/visibility';
import { toast } from 'sonner';


interface NavbarProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  userRole?: UserRole;
  className?: string;
}

const Navbar: React.FC<NavbarProps> = ({
  onMenuClick,
  pageTitle,
  userRole,
  className
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { logout, user, refreshSession } = useAuth();
  const { forceRefresh, registerAuthContext } = useContext(VisibilityContext);
  const lastInteractionRef = useRef<number>(Date.now());
  
  // Check if the app needs a refresh based on last interaction time
  useEffect(() => {
    const checkInteraction = () => {
      const now = Date.now();
      const timeSinceLastInteraction = now - lastInteractionRef.current;
      
      // If it's been more than 10 minutes, show a warning
      if (timeSinceLastInteraction > 10 * 60 * 1000) {
        toast.info("It's been a while. Click refresh if needed.", {
          duration: 5000
        });
      }
      
      lastInteractionRef.current = now;
    };
    
    // Check when the tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInteraction();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Register auth context so global forceRefresh can refresh session when needed
  useEffect(() => {
    try {
      registerAuthContext?.({ refreshSession });
    } catch (e) {
      console.warn('Failed to register auth context:', e);
    }
  }, [registerAuthContext, refreshSession]);
  
  // Function to handle home button click based on user role
  const handleHomeClick = () => {
    lastInteractionRef.current = Date.now();
    try {
      if (userRole === UserRole.ADMIN) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error navigating to home:', error);
      toast.error('Navigation failed. Please try refreshing the page.');
    }
  };
  
  // Handle logout with error handling
  const handleLogout = async () => {
    lastInteractionRef.current = Date.now();
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Logout failed. Please try refreshing the page.');
      
    }
  };
  
  // Handle navigation to expenses
  const handleExpensesClick = () => {
    lastInteractionRef.current = Date.now();
    try {
      navigate('/expenses');
    } catch (error) {
      console.error('Error navigating to expenses:', error);
      toast.error('Navigation failed. Please try refreshing the page.');
    }
  };
  
  // Force refresh app state
  const handleRefresh = () => {
    lastInteractionRef.current = Date.now();
    forceRefresh();
    toast.success('App state refreshed');
    
  };
  
  return (
    <header className={cn("h-14 sm:h-16 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10", className)}>
      <div className="h-full container mx-auto px-1 sm:px-4 flex items-center justify-between">
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Only show Dashboard button for Admin and Viewer roles */}
          {userRole !== UserRole.SUPERVISOR && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleHomeClick}
              className="p-1 md:p-2"
              aria-label="Go to Dashboard"
            >
              <Home className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}
          
          {pageTitle && !isMobile && (
            <h1 className="text-lg font-medium">{pageTitle}</h1>
          )}
        </div>
        
        <div className="flex-1 flex justify-center items-center mx-1">
          <div className="flex items-center gap-1 md:gap-3">
            {/* Logo image */}
            <img 
              src="/lovable-uploads/74a5a478-2c11-4188-88b3-76b7897376a9.png" 
              alt="MEW Logo" 
              className="h-6 sm:h-7 md:h-12 object-contain" 
            />
            {/* Company name image - hide on very small screens */}
            <img 
              src="/lovable-uploads/1d876bba-1f25-45bf-9f5b-8f81f72d4880.png" 
              alt="MAURICE ENGINEERING WORKS" 
              className="h-4 sm:h-5 md:h-10 object-contain hidden xs:block" 
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {user && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleExpensesClick}
                className="p-1 md:p-2"
                title="Go to Sites & Expenses"
                aria-label="Go to Sites & Expenses"
              >
                <Building className="h-5 w-5 text-muted-foreground" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleRefresh}
                className="p-1 md:p-2"
                title="Refresh App State"
                aria-label="Refresh App State"
              >
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="p-1 md:p-2"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="h-5 w-5 text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
