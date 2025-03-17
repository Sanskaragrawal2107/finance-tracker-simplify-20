import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, User } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import PageTitle from '@/components/common/PageTitle';
import SitesList from '@/components/sites/SitesList';
import SiteForm from '@/components/sites/SiteForm';

interface SupervisorSitesProps {
  user?: any;
}

const SupervisorSites: React.FC<SupervisorSitesProps> = ({ user }) => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchSupervisorSites();
  }, [user]);

  const fetchSupervisorSites = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('supervisor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (err: any) {
      console.error('Error fetching supervisor sites:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSiteClick = (site: any) => {
    navigate(`/site-transactions/${site.id}`, { state: { site } });
  };

  const handleCreateSite = async (siteData: any) => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert([
          {
            ...siteData,
            supervisor_id: user.id,
          },
        ])
        .select();

      if (error) throw error;
      
      setShowSiteForm(false);
      fetchSupervisorSites();
    } catch (err: any) {
      console.error('Error creating site:', err);
      setError(err.message);
    }
  };

  const renderSkeletonCards = (count: number) => {
    return Array(count)
      .fill(0)
      .map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-gray-200 h-32 rounded-lg"></div>
        </div>
      ));
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar 
        user={user} 
        activePage="supervisor-sites" 
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <div className="flex-1">
        <Navbar user={user} />
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <PageTitle title="My Sites" />
          </div>

          <div className="flex justify-end mb-6">
            <Button 
              onClick={() => setShowSiteForm(!showSiteForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showSiteForm ? 'Cancel' : 'Add New Site'}
            </Button>
          </div>

          {showSiteForm && (
            <Card className="bg-white border shadow-sm mb-6">
              <CardContent className="p-6">
                <SiteForm 
                  user={user}
                  isOpen={showSiteForm}
                  onClose={() => setShowSiteForm(false)}
                  onSubmit={handleCreateSite}
                  supervisorId={user.id}
                  onSuccess={() => {
                    setShowSiteForm(false);
                    fetchSupervisorSites();
                  }}
                />
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="bg-red-50 border border-red-200 mb-6">
              <CardContent className="p-4 text-red-600">
                {error}
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-4">
              {renderSkeletonCards(3)}
            </div>
          ) : sites.length > 0 ? (
            <SitesList 
              sites={sites} 
              onSiteClick={handleSiteClick}
              onSelectSite={(siteId) => {
                const site = sites.find(s => s.id === siteId);
                if (site) handleSiteClick(site);
              }}
            />
          ) : (
            <Card className="bg-white border shadow-sm">
              <CardContent className="p-6 text-center">
                <User className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <h3 className="text-lg font-medium">No Sites Found</h3>
                <p className="text-gray-500 mt-2">You don't have any sites assigned to you yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisorSites;
