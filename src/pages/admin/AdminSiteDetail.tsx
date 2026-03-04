import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SiteDetail from '@/components/sites/SiteDetail';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

const AdminSiteDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const site = location.state?.site;
  const returnPath = location.state?.returnPath || '/admin/all-sites';

  if (!site) {
    navigate(returnPath);
    return null;
  }

  return (
    <SiteDetail
      site={site}
      onBack={() => navigate(returnPath)}
      userRole={user?.role || UserRole.ADMIN}
      isAdminView={true}
    />
  );
};

export default AdminSiteDetail;
