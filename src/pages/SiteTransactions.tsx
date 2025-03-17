
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import PageTitle from '../components/common/PageTitle';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { Card } from '../components/ui/card';
import SiteDetailTransactions from '../components/sites/SiteDetailTransactions';

// Define the prop types for SiteDetailTransactions
interface SiteDetailTransactionsProps {
  site: any;
  supervisor?: any; // Make supervisor optional
}

const SiteTransactions = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [site, setSite] = useState<any>(null);
  const [supervisor, setSupervisor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.state?.site) {
      setSite(location.state.site);
      setSupervisor(location.state.supervisor);
      setLoading(false);
    } else {
      fetchSiteDetails();
    }
  }, [id, location]);

  const fetchSiteDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*, supervisors(*)')
        .eq('id', id)
        .single();

      if (siteError) throw siteError;
      
      if (siteData) {
        setSite(siteData);
        setSupervisor(siteData.supervisors);
      }
    } catch (error) {
      console.error('Error fetching site details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/supervisor-sites', { state: { supervisor } });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6 space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

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
        <PageTitle title={`Transactions for ${site?.name || 'Site'}`} />
      </div>
      
      {site ? (
        <SiteDetailTransactions site={site} supervisor={supervisor} />
      ) : (
        <Card className="p-6 text-center">
          <p className="text-gray-500">Site details not found</p>
        </Card>
      )}
    </div>
  );
};

export default SiteTransactions;
