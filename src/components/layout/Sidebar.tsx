import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronLeft, Home, BarChart3, Users, Settings, LogOut } from 'lucide-react';
import { UserRole } from '@/lib/types';

interface SidebarProps {
  user?: any;
  userRole?: UserRole;
  userName?: string;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  className?: string;
  activePage?: string;
}

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  path: string;
  allowedRoles: UserRole[];
}

const sidebarItems: SidebarItem[] = [
  {
    icon: Home,
    label: 'Dashboard',
    path: '/dashboard',
    allowedRoles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.VIEWER],
  },
  {
    icon: BarChart3,
    label: 'Expenses',
    path: '/expenses',
    allowedRoles: [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.VIEWER],
  },
  {
    icon: Users,
    label: 'Users',
    path: '/users',
    allowedRoles: [UserRole.ADMIN],
  },
  {
    icon: Settings,
    label: 'Settings',
    path: '/settings',
    allowedRoles: [UserRole.ADMIN, UserRole.SUPERVISOR],
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  user,
  userRole = UserRole.VIEWER,
  userName = 'User',
  collapsed,
  setCollapsed,
  className,
  activePage,
}) => {
  const location = useLocation();

  const displayName = user?.name || userName;
  const displayRole = user?.role || userRole;

  return (
    <div 
      className={cn(
        "h-screen border-r bg-card flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64",
        className
      )}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2 overflow-hidden">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-semibold text-lg">F</span>
          </div>
          <h1 
            className={cn(
              "font-bold text-lg transition-opacity", 
              collapsed ? "opacity-0 w-0" : "opacity-100"
            )}
          >
            FinTrack
          </h1>
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <ChevronLeft 
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              collapsed && "rotate-180"
            )} 
          />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {sidebarItems
            .filter(item => item.allowedRoles.includes(userRole))
            .map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center px-3 py-2.5 rounded-md transition-all duration-200 group",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    !isActive && "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span 
                    className={cn(
                      "ml-3 transition-opacity duration-200",
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
        </nav>
      </div>
      
      <div className="p-4 border-t">
        <div 
          className={cn(
            "flex items-center",
            collapsed ? "flex-col" : "space-x-3"
          )}
        >
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <span className="font-medium text-muted-foreground">
              {displayName.charAt(0)}
            </span>
          </div>
          <div 
            className={cn(
              "flex-1 transition-opacity",
              collapsed ? "opacity-0 hidden" : "opacity-100"
            )}
          >
            <p className="font-medium text-sm truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground capitalize">{displayRole}</p>
          </div>
          <button 
            className={cn(
              "p-2 rounded-md hover:bg-muted transition-colors",
              collapsed ? "mt-2" : ""
            )}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
