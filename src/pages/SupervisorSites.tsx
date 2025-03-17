
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import SitesList from '../components/sites/SitesList';
import PageTitle from '../components/common/PageTitle';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

const SupervisorSites = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [supervisor, setSupervisor] = useState<any>(null);

  // Extract supervisor from location state
  useEffect(() => {
    if (location.state?.supervisor) {
      setSupervisor(location.state.supervisor);
      fetchSites(location.state.supervisor.id);
    } else {
      navigate('/admin-dashboard');
    }
  }, [location, navigate]);

  const fetchSites = async (supervisorId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('supervisor_id', supervisorId);

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/admin-dashboard');
  };

  const handleSiteClick = (site: any) => {
    navigate(`/site-transactions/${site.id}`, { 
      state: { site, supervisor }
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center mb-6 space-x-4">
        <Button 
          variant="ghost" 
          onClick={handleGoBack}
          className="p-2 hover:bg-gray-100 transition-colors rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageTitle title={`Sites managed by ${supervisor?.name || 'Supervisor'}`} />
      </div>
      
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : sites.length > 0 ? (
        <SitesList sites={sites} onSelectSite={handleSiteClick} />
      ) : (
        <div className="text-center py-10 border rounded-lg bg-white shadow-sm">
          <p className="text-gray-500">No sites found for this supervisor.</p>
        </div>
      )}
    </div>
  );
};

export default SupervisorSites;
