import React, { useEffect, useRef, useContext } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Home, Building, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { VisibilityContext } from '@/App';
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
  const { logout, user } = useAuth();
  const { forceRefresh } = useContext(VisibilityContext);
  const lastInteractionRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef(false);
  const listenerAttachedRef = useRef(false);
  const lastTabSwitchRef = useRef<number>(0);
  const buttonCooldownRef = useRef<boolean>(false);
  
  // Check if the app needs a refresh based on last interaction time
  useEffect(() => {
    // Prevent duplicate listeners
    if (listenerAttachedRef.current) {
      console.log('Navbar event listener already attached, skipping');
      return;
    }
    const checkInteraction = () => {
      const now = Date.now();
      const timeSinceLastInteraction = now - lastInteractionRef.current;
      
      // If it's been more than 15 minutes, show a gentle warning
      if (timeSinceLastInteraction > 15 * 60 * 1000) {
        toast.info("Long inactivity detected. Refresh if needed.", {
          duration: 3000
        });
      }
      
      lastInteractionRef.current = now;
    };
    
    // Listen for gentle visibility event instead of aggressive one
    const handleGentleVisibility = (event: CustomEvent) => {
      const { timeHidden } = event.detail;
      
      // Record tab switch time and enable button cooldown
      lastTabSwitchRef.current = Date.now();
      buttonCooldownRef.current = true;
      
      console.log('Tab switch detected - enabling button cooldown for 2 seconds');
      
      // Disable button cooldown after 2 seconds
      setTimeout(() => {
        buttonCooldownRef.current = false;
        console.log('Button cooldown disabled');
      }, 2000);
      
      // Only check interaction if tab was hidden for a very long time
      if (timeHidden > 15 * 60 * 1000) { // 15 minutes
        checkInteraction();
      }
    };
    
    window.addEventListener('app:visibility-gentle', handleGentleVisibility as EventListener);
    listenerAttachedRef.current = true;
    console.log('Navbar event listener attached');
    
    return () => {
      window.removeEventListener('app:visibility-gentle', handleGentleVisibility as EventListener);
      listenerAttachedRef.current = false;
      console.log('Navbar event listener removed');
    };
  }, []);
  
  // Function to handle home button click based on user role
  const handleHomeClick = () => {
    // Check if we're in button cooldown period after tab switch
    if (buttonCooldownRef.current) {
      const timeSinceTabSwitch = Date.now() - lastTabSwitchRef.current;
      console.log(`Home navigation blocked - tab switch cooldown active (${timeSinceTabSwitch}ms ago)`);
      return;
    }
    
    lastInteractionRef.current = Date.now();
    try {
      console.log('Home navigation initiated');
      if (userRole === UserRole.ADMIN) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error navigating to home:', error);
      toast.error('Navigation failed. Please try again.');
    }
  };
  
  // Handle logout with error handling and loading state
  const handleLogout = async () => {
    // Check if we're in button cooldown period after tab switch
    if (buttonCooldownRef.current) {
      const timeSinceTabSwitch = Date.now() - lastTabSwitchRef.current;
      console.log(`Logout blocked - tab switch cooldown active (${timeSinceTabSwitch}ms ago)`);
      toast.info('Please wait a moment after switching tabs before logging out.');
      return;
    }
    
    // Prevent multiple simultaneous logout attempts
    if (isLoggingOutRef.current) {
      console.log('Logout already in progress, ignoring duplicate request');
      return;
    }
    
    isLoggingOutRef.current = true;
    lastInteractionRef.current = Date.now();
    
    try {
      console.log('Logout initiated');
      await logout();
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Logout failed. Please try again.');
    } finally {
      isLoggingOutRef.current = false;
    }
  };
  
  // Handle navigation to expenses
  const handleExpensesClick = () => {
    // Check if we're in button cooldown period after tab switch
    if (buttonCooldownRef.current) {
      const timeSinceTabSwitch = Date.now() - lastTabSwitchRef.current;
      console.log(`Expenses navigation blocked - tab switch cooldown active (${timeSinceTabSwitch}ms ago)`);
      return;
    }
    
    lastInteractionRef.current = Date.now();
    try {
      console.log('Expenses navigation initiated');
      navigate('/expenses');
    } catch (error) {
      console.error('Error navigating to expenses:', error);
      toast.error('Navigation failed. Please try again.');
    }
  };
  
  // Manual refresh app state
  const handleRefresh = () => {
    // Allow refresh even during cooldown as it's a recovery action
    lastInteractionRef.current = Date.now();
    console.log('Manual refresh requested from navbar');
    forceRefresh();
    toast.success('App refreshed successfully!', {
      duration: 2000
    });
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
