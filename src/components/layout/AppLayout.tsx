import React from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * AppLayout – content wrapper only.
 * The Navbar is rendered at the App level (App.tsx), not here,
 * to avoid double-navbar / blank-screen issues.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
      {children}
    </div>
  );
};

export default AppLayout;