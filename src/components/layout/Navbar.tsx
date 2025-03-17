
import React from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Home, Building, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

interface NavbarProps {
  user?: any; // Add user prop to the interface
  onMenuClick?: () => void;
  pageTitle?: string;
  userRole?: UserRole;
  className?: string;
}

const Navbar: React.FC<NavbarProps> = ({
  user,
  onMenuClick,
  pageTitle,
  userRole,
  className
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { logout } = useAuth();
  
  // Use user.role if available, otherwise use the passed userRole prop
  const effectiveUserRole = user?.role || userRole;
  
  return (
    <header className={cn("h-14 sm:h-16 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10", className)}>
      <div className="h-full container mx-auto px-1 sm:px-4 flex items-center justify-between">
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Only show Dashboard button for Admin and Viewer roles */}
          {userRole !== UserRole.SUPERVISOR && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/dashboard')}
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
                onClick={() => navigate('/expenses')}
                className="p-1 md:p-2"
                title="Go to Sites & Expenses"
                aria-label="Go to Sites & Expenses"
              >
                <Building className="h-5 w-5 text-muted-foreground" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => logout()}
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
