import React, { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import PageTitle from '../components/common/PageTitle';
import SitesList from '../components/sites/SitesList';
import SiteForm from '../components/sites/SiteForm';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupervisorCard from '../components/dashboard/SupervisorCard';

interface User {
  id: string;
  name?: string;
  email: string;
  role?: string;
}

const AdminDashboard = ({ user }: { user: User }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sites');
  const [sites, setSites] = useState<any[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(true);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchSites();
    fetchSupervisors();
    setupRealtimeSubscription();

    return () => {
      const channel = supabase.channel('schema-db-changes');
      supabase.removeChannel(channel);
    };
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sites'
      }, () => {
        fetchSites();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'users'
      }, () => {
        fetchSupervisors();
      })
      .subscribe();
  };

  const fetchSites = async () => {
    try {
      setLoadingSites(true);
      const { data, error } = await supabase
        .from('sites')
        .select('*, users(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoadingSites(false);
    }
  };

  const fetchSupervisors = async () => {
    try {
      setLoadingSupervisors(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'supervisor')
        .order('name');

      if (error) throw error;
      setSupervisors(data || []);
    } catch (error) {
      console.error('Error fetching supervisors:', error);
    } finally {
      setLoadingSupervisors(false);
    }
  };

  const handleSiteClick = (site: any) => {
    navigate(`/site-transactions/${site.id}`, { state: { site } });
  };

  const handleSelectSite = (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (site) handleSiteClick(site);
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
        activePage="admin-dashboard" 
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <div className="flex-1">
        <Navbar user={user} />
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <PageTitle title="Admin Dashboard" />
          </div>

          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="w-full bg-white border rounded-lg shadow-sm mb-6">
              <TabsTrigger 
                className="flex-1 py-3" 
                value="sites"
              >
                Sites
              </TabsTrigger>
              <TabsTrigger 
                className="flex-1 py-3" 
                value="supervisors"
              >
                Supervisors
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sites" className="space-y-6">
              <div className="flex justify-end">
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
                      onSubmit={(site) => {
                        console.log("Site submitted:", site);
                      }}
                      onSuccess={() => {
                        setShowSiteForm(false);
                        fetchSites();
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {loadingSites ? (
                <div className="grid grid-cols-1 gap-4">
                  {renderSkeletonCards(3)}
                </div>
              ) : (
                <SitesList 
                  sites={sites} 
                  onSiteClick={handleSiteClick}
                  onSelectSite={handleSelectSite}
                />
              )}
            </TabsContent>

            <TabsContent value="supervisors" className="space-y-6">
              {loadingSupervisors ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderSkeletonCards(3)}
                </div>
              ) : supervisors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {supervisors.map((supervisor) => (
                    <SupervisorCard 
                      key={supervisor.id} 
                      supervisor={supervisor} 
                    />
                  ))}
                </div>
              ) : (
                <Card className="bg-white border shadow-sm">
                  <CardContent className="p-6 text-center">
                    <User className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium">No Supervisors Found</h3>
                    <p className="text-gray-500 mt-2">There are no supervisors registered in the system.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
