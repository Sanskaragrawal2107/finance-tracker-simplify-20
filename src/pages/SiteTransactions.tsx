
import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import SiteDetailTransactions from '@/components/sites/SiteDetailTransactions';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SiteTransactionsProps {
  user?: any; // Add user prop to interface
}

const SiteTransactions: React.FC<SiteTransactionsProps> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [site, setSite] = useState<any>(null);
  const [supervisor, setSupervisor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSite = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('*')
          .eq('id', id)
          .single();

        if (siteError) {
          throw siteError;
        }

        if (!siteData) {
          setError('Site not found');
          return;
        }

        setSite(siteData);

        // Fetch supervisor details
        const { data: supervisorData, error: supervisorError } = await supabase
          .from('users')
          .select('*')
          .eq('id', siteData.supervisor_id)
          .single();

        if (supervisorError) {
          throw supervisorError;
        }

        setSupervisor(supervisorData);
      } catch (err: any) {
        setError(err.message || 'Failed to load site');
      } finally {
        setLoading(false);
      }
    };

    fetchSite();
  }, [id]);
  
  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error loading site: {error}</div>}
      {site && supervisor && (
        <SiteDetailTransactions 
          site={site} 
          supervisor={supervisor} 
          user={user} // Pass the user prop
        />
      )}
    </div>
  );
};

export default SiteTransactions;
