import React from 'react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { LayoutDashboard, Building2, LogOut, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const MEWLogo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex items-center gap-2', className)}>
    <img src="/mew-logo.png" alt="MEW" className="h-8 w-auto object-contain" />
    <div className="hidden sm:flex flex-col leading-none">
      <span className="font-extrabold text-sm tracking-tight text-foreground">
        <span className="text-red-600">MAURICE</span>
        {' '}
        <span>ENGINEERING WORKS</span>
      </span>
      <span className="text-[9px] text-muted-foreground tracking-wide font-medium">Believe in Quality Work</span>
    </div>
  </div>
);

const roleConfig: Record<UserRole, { label: string; color: string }> = {
  [UserRole.ADMIN]:      { label: 'Admin',      color: 'bg-blue-100 text-blue-700' },
  [UserRole.SUPERVISOR]: { label: 'Supervisor',  color: 'bg-emerald-100 text-emerald-700' },
  [UserRole.VIEWER]:     { label: 'Viewer',      color: 'bg-gray-100 text-gray-700' },
};

const routeMap: Record<string, string> = {
  '/admin':                  'Admin Dashboard',
  '/dashboard':              'Dashboard',
  '/expenses':               'Sites & Expenses',
  '/admin/all-sites':        'All Sites',
  '/admin/supervisor-sites': 'Supervisor Sites',
};

interface NavbarProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  userRole?: UserRole;
  className?: string;
}

const Navbar: React.FC<NavbarProps> = ({ pageTitle, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      toast.error('Logout failed. Please try again.');
    }
  };

  const handleHomeClick = () => {
    navigate(user?.role === UserRole.ADMIN ? '/admin' : '/dashboard');
  };

  const currentTitle = pageTitle || routeMap[location.pathname] || '';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const role = (user?.role ?? UserRole.VIEWER) as UserRole;
  const roleStyle = roleConfig[role];

  return (
    <nav className={cn('fixed top-0 left-0 right-0 z-50 bg-white border-b border-border/60 shadow-sm', className)}>
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Left — Logo + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={handleHomeClick} className="flex items-center flex-shrink-0 group">
              <MEWLogo />
            </button>

            {currentTitle && !isMobile && (
              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
                <span className="text-sm font-medium text-foreground truncate">{currentTitle}</span>
              </div>
            )}
            {/* Mobile: show page title in a compact pill */}
            {currentTitle && isMobile && (
              <span className="text-xs font-semibold text-muted-foreground truncate max-w-[120px]">{currentTitle}</span>
            )}
          </div>

          {/* Right — Actions + User */}
          {user && (
            <div className="flex items-center gap-1">
              {!isMobile && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleHomeClick}
                    className="text-muted-foreground hover:text-foreground h-8 px-3 text-xs font-medium"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                    Home
                  </Button>

                  {(user.role === UserRole.SUPERVISOR || user.role === UserRole.ADMIN) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/expenses')}
                      className="text-muted-foreground hover:text-foreground h-8 px-3 text-xs font-medium"
                    >
                      <Building2 className="h-3.5 w-3.5 mr-1.5" />
                      Sites
                    </Button>
                  )}
                </>
              )}

              <div className="w-px h-5 bg-border mx-1" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.reload()}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>

              <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-foreground leading-none">{user.name}</p>
                  <span className={cn('inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded', roleStyle.color)}>
                    {roleStyle.label}
                  </span>
                </div>
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-white">{initials}</span>
                </div>
                {/* Logout button — hidden on mobile since bottom nav handles it */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 hidden md:flex"
                  title="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
