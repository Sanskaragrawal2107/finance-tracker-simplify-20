import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { User, Users, Building2, PieChart, BarChart, UserPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { getSupervisors } from '@/data/supervisors';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import RegisterForm from '@/components/auth/RegisterForm';
import { supabase } from '@/integrations/supabase/client';
import SiteForm from '@/components/sites/SiteForm';
import SitesList from '@/components/sites/SitesList';

interface SupervisorStats {
  totalSites: number;
  activeSites: number;
  completedSites: number;
}

interface SupervisorWithId {
  id: string;
  name: string;
}

const AdminDashboard: React.FC = () => {
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [supervisorStats, setSupervisorStats] = useState<Record<string, SupervisorStats>>({});
  const [supervisorsList, setSupervisorsList] = useState<SupervisorWithId[]>([]);
  const [isRegisterFormOpen, setIsRegisterFormOpen] = useState(false);
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  const fetchSupervisorsAndSites = async () => {
    const isInitialLoad = initialLoading;
    if (!isInitialLoad) {
      setLoadingSupervisors(true);
    }
    
    try {
      const { data: supervisorsData, error: supervisorsError } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor');
        
      if (supervisorsError) {
        console.error('Error fetching supervisors:', supervisorsError);
        toast.error('Error loading supervisors data. Please refresh the page.');
        setSupervisorsList([]);
        setSupervisorStats({});
        return;
      }
      
      if (!supervisorsData || supervisorsData.length === 0) {
        setSupervisorsList([]);
        setSupervisorStats({});
        return;
      }
      
      setSupervisorsList(supervisorsData);
      
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, supervisor_id, is_completed');
        
      if (sitesError) {
        console.error('Error fetching sites:', sitesError);
        toast.error('Error loading sites data. Please refresh the page.');
        setSupervisorStats({});
        return;
      }
      
      const stats: Record<string, SupervisorStats> = {};
      
      supervisorsData.forEach(supervisor => {
        const supervisorSites = sitesData ? sitesData.filter(site => site.supervisor_id === supervisor.id) : [];
        const total = supervisorSites.length;
        const active = supervisorSites.filter(site => !site.is_completed).length;
        const completed = supervisorSites.filter(site => site.is_completed).length;
        
        stats[supervisor.id] = {
          totalSites: total,
          activeSites: active,
          completedSites: completed
        };
      });
      
      setSupervisorStats(stats);
    } catch (error) {
      console.error('Error fetching supervisors and sites:', error);
      toast.error('Error loading supervisors data. Please refresh the page.');
      setSupervisorsList([]);
      setSupervisorStats({});
    } finally {
      if (isInitialLoad) {
        setTimeout(() => {
          setInitialLoading(false);
        }, 500);
      } else {
        setTimeout(() => {
          setLoadingSupervisors(false);
        }, 200);
      }
    }
  };
  
  useEffect(() => {
    let mounted = true;
    
    if (mounted) {
      if (user) {
        fetchSupervisorsAndSites();
      } else {
        setLoadingSupervisors(false);
      }
    }
    
    return () => {
      mounted = false;
    };
  }, [user]);

  const handleViewSites = (supervisorId: string) => {
    console.log("Viewing sites for supervisor:", supervisorId);
    const selectedSupervisor = supervisorsList.find(sup => sup.id === supervisorId);
    navigate('/admin/supervisor-sites', { 
      state: { 
        supervisorId: supervisorId,
        supervisorName: selectedSupervisor?.name || 'Unknown Supervisor',
        showSites: true 
      } 
    });
  };

  const handleAddSite = () => {
    if (selectedSupervisorId) {
      setIsSiteFormOpen(true);
    } else {
      toast.error("Please select a supervisor first");
    }
  };

  const handleCreateSite = async (site: any) => {
    try {
      setSupervisorStats(prev => {
        const updatedStats = { ...prev };
        const supervisorId = site.supervisorId || selectedSupervisorId;
        
        if (supervisorId && updatedStats[supervisorId]) {
          updatedStats[supervisorId] = {
            ...updatedStats[supervisorId],
            totalSites: updatedStats[supervisorId].totalSites + 1,
            activeSites: updatedStats[supervisorId].activeSites + 1
          };
        }
        return updatedStats;
      });
      
      setIsSiteFormOpen(false);
    } catch (error: any) {
      console.error('Error in handleCreateSite:', error);
      toast.error('Failed to create site: ' + error.message);
    }
  };

  const getSelectedSupervisor = () => {
    return supervisorsList.find(s => s.id === selectedSupervisorId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {!user ? (
        <div className="text-center py-6">
          <div className="animate-pulse">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Loading...</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please wait while we authenticate your session
            </p>
          </div>
        </div>
      ) : (
        <>
          <PageTitle 
            title="Admin Dashboard" 
            subtitle="Manage supervisors and view site statistics"
            className="mb-4"
          />
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">User Management</h2>
            <Button onClick={() => setIsRegisterFormOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <CustomCard className="bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 mr-4">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Total Supervisors</h3>
                  <p className="text-2xl font-bold">{supervisorsList.length}</p>
                </div>
              </div>
            </CustomCard>
            
            <CustomCard className="bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 mr-4">
                  <Building2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Total Sites</h3>
                  <p className="text-2xl font-bold">
                    {Object.values(supervisorStats).reduce((sum, stat) => sum + stat.totalSites, 0)}
                  </p>
                </div>
              </div>
            </CustomCard>
            
            <CustomCard className="bg-gradient-to-br from-purple-50 to-violet-50">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 mr-4">
                  <BarChart className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Active Sites</h3>
                  <p className="text-2xl font-bold">
                    {Object.values(supervisorStats).reduce((sum, stat) => sum + stat.activeSites, 0)}
                  </p>
                </div>
              </div>
            </CustomCard>
          </div>
          
          <CustomCard>
            <h2 className="text-xl font-semibold mb-4">Supervisor Management</h2>
            <div className="mb-6">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Select a supervisor to view their sites
              </label>
              <div className="max-w-md">
                <Select 
                  value={selectedSupervisorId || ''} 
                  onValueChange={(value) => setSelectedSupervisorId(value || null)}
                >
                  <SelectTrigger className="w-full">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select Supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisorsList.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedSupervisorId && supervisorStats[selectedSupervisorId] && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-background">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-medium">{getSelectedSupervisor()?.name}</h3>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 hover:bg-blue-50">
                          {supervisorStats[selectedSupervisorId]?.totalSites || 0} Total Sites
                        </Badge>
                        <Badge variant="outline" className="bg-green-50 text-green-800 hover:bg-green-50">
                          {supervisorStats[selectedSupervisorId]?.activeSites || 0} Active
                        </Badge>
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 hover:bg-amber-50">
                          {supervisorStats[selectedSupervisorId]?.completedSites || 0} Completed
                        </Badge>
                      </div>
                    </div>
                    
                    <Button onClick={() => handleViewSites(selectedSupervisorId)}>
                      <Building2 className="h-4 w-4 mr-2" />
                      View Sites
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {(!selectedSupervisorId) && (
              <div className="text-center py-6">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {initialLoading ? 'Loading Supervisors...' : 'Select a Supervisor'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {initialLoading 
                    ? 'Please wait while we fetch the supervisor data.'
                    : supervisorsList.length > 0 
                      ? 'Choose a supervisor from the dropdown to view their sites and performance statistics.'
                      : 'No supervisors found. Please add a supervisor first.'}
                </p>
              </div>
            )}
          </CustomCard>
          
          <CustomCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Quick Actions</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-6 flex flex-col items-center justify-center text-center"
                onClick={() => navigate('/expenses')}
              >
                <Building2 className="h-8 w-8 mb-2" />
                <span className="text-base font-medium">View All Sites</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Access complete site listing
                </span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-6 flex flex-col items-center justify-center text-center"
                onClick={() => navigate('/dashboard')}
              >
                <PieChart className="h-8 w-8 mb-2" />
                <span className="text-base font-medium">Financial Overview</span>
                <span className="text-xs text-muted-foreground mt-1">
                  View financial statistics
                </span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto py-6 flex flex-col items-center justify-center text-center"
                onClick={() => handleAddSite()}
              >
                <Building2 className="h-8 w-8 mb-2" />
                <span className="text-base font-medium">Create New Site</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Add a new construction site
                </span>
              </Button>
            </div>
          </CustomCard>

          <RegisterForm 
            isOpen={isRegisterFormOpen}
            onClose={() => setIsRegisterFormOpen(false)}
          />
          
          <SiteForm
            isOpen={isSiteFormOpen}
            onClose={() => setIsSiteFormOpen(false)}
            onSubmit={handleCreateSite}
            supervisorId={selectedSupervisorId || undefined}
          />
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
