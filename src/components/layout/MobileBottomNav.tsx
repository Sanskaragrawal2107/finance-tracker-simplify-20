import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, ShieldCheck, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    roles: [UserRole.VIEWER, UserRole.ADMIN],
  },
  {
    to: '/expenses',
    icon: Building2,
    label: 'Sites',
    roles: [UserRole.SUPERVISOR, UserRole.ADMIN],
  },
  {
    to: '/admin',
    icon: ShieldCheck,
    label: 'Admin',
    roles: [UserRole.ADMIN],
  },
];

/**
 * Fixed bottom navigation bar shown only on mobile (md:hidden).
 * Appears at the bottom of the screen for easy thumb reach.
 */
const MobileBottomNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const visibleItems = navItems.filter((item) => item.roles.includes(user.role));

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      toast.error('Logout failed');
    }
  };

  return (
    <nav className="mobile-bottom-nav md:hidden">
      <div className="flex items-stretch justify-around h-14">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'h-6 w-6 flex items-center justify-center rounded-full transition-colors',
                    isActive ? 'bg-primary/10' : ''
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors"
        >
          <div className="h-6 w-6 flex items-center justify-center rounded-full">
            <LogOut className="h-4 w-4" />
          </div>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
