import React from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Home, Building, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
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

  // Handle logout with simple error handling
  const handleLogout = async () => {
    try {
      console.log('Logout initiated');
      await logout();
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Logout failed. Please try again.');
    }
  };

  // Function to handle home button click based on user role
  const handleHomeClick = () => {
    try {
      console.log('Home navigation initiated');
      if (user?.role === UserRole.ADMIN) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error navigating to home:', error);
      toast.error('Navigation failed. Please try again.');
    }
  };

  // Handle navigation to expenses
  const handleExpensesClick = () => {
    try {
      console.log('Expenses navigation initiated');
      navigate('/expenses');
    } catch (error) {
      console.error('Error navigating to expenses:', error);
      toast.error('Navigation failed. Please try again.');
    }
  };

  // Manual refresh - simple page reload
  const handleRefresh = () => {
    console.log('Manual refresh requested from navbar');
    window.location.reload();
  };

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo/Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Building className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Finance Tracker</span>
            </div>
            {pageTitle && (
              <>
                <div className="hidden sm:block text-muted-foreground">•</div>
                <span className="hidden sm:block text-sm text-muted-foreground">
                  {pageTitle}
                </span>
              </>
            )}
          </div>

          {/* Right side - Navigation */}
          <div className="flex items-center space-x-2">
            {user && (
              <>
                {/* Home Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleHomeClick}
                  className="hidden sm:flex"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>

                {/* Expenses Button - Show for supervisors and admins */}
                {(user?.role === UserRole.SUPERVISOR || user?.role === UserRole.ADMIN) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExpensesClick}
                    className="hidden sm:flex"
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Sites
                  </Button>
                )}

                {/* Refresh Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  title="Refresh page"
                >
                  <RefreshCw className="h-4 w-4" />
                  {!isMobile && <span className="ml-2">Refresh</span>}
                </Button>

                {/* Logout Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  {!isMobile && <span className="ml-2">Logout</span>}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
