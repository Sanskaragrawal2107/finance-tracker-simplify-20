import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Building2, Filter, Users, Loader2, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SitesList from '@/components/sites/SitesList';
import { Site } from '@/lib/types';

interface SupervisorWithId {
  id: string;
  name: string;
}

const AllSites: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorWithId[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch all sites with supervisor information
      const sitesPromise = supabase
        .from('sites')
        .select(`
          *,
          users!sites_supervisor_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      // Fetch all supervisors
      const supervisorsPromise = supabase
        .from('users')
        .select('id, name')
        .eq('role', 'supervisor')
        .order('name');

      const [sitesResult, supervisorsResult] = await Promise.all([sitesPromise, supervisorsPromise]);

      if (sitesResult.error) {
        console.error('Error fetching sites:', sitesResult.error);
        toast.error('Failed to load sites');
        return;
      }

      if (supervisorsResult.error) {
        console.error('Error fetching supervisors:', supervisorsResult.error);
        toast.error('Failed to load supervisors');
        return;
      }

      // Map sites data
      const mappedSites = sitesResult.data?.map(site => ({
        id: site.id,
        name: site.name,
        jobName: site.job_name || '',
        posNo: site.pos_no || '',
        location: site.location,
        startDate: new Date(site.start_date),
        completionDate: site.completion_date ? new Date(site.completion_date) : undefined,
        supervisorId: site.supervisor_id,
        supervisor: site.users?.name || 'Unassigned',
        isCompleted: site.is_completed || false,
        funds: site.funds || 0,
        totalFunds: site.total_funds || 0,
        createdAt: new Date(site.created_at)
      })) || [];

      setSites(mappedSites);
      setSupervisors(supervisorsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter sites based on supervisor and search term
  useEffect(() => {
    let filtered = sites;

    // Filter by supervisor
    if (selectedSupervisorId !== 'all') {
      filtered = filtered.filter(site => site.supervisorId === selectedSupervisorId);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(site => 
        site.name.toLowerCase().includes(search) ||
        site.jobName.toLowerCase().includes(search) ||
        site.location.toLowerCase().includes(search) ||
        site.supervisor.toLowerCase().includes(search)
      );
    }

    setFilteredSites(filtered);
  }, [sites, selectedSupervisorId, searchTerm]);

  const handleSiteClick = (site: Site) => {
    navigate(`/sites/${site.id}`, { 
      state: { 
        site,
        returnPath: '/admin/all-sites'
      } 
    });
  };

  const activeSites = filteredSites.filter(site => !site.isCompleted);
  const completedSites = filteredSites.filter(site => site.isCompleted);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <PageTitle 
            title="All Sites" 
            subtitle="View and manage all construction sites" 
          />
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CustomCard className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 mr-4">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Sites</h3>
              <p className="text-2xl font-bold">{filteredSites.length}</p>
            </div>
          </div>
        </CustomCard>

        <CustomCard className="bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 mr-4">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Active Sites</h3>
              <p className="text-2xl font-bold">{activeSites.length}</p>
            </div>
          </div>
        </CustomCard>

        <CustomCard className="bg-gradient-to-br from-amber-50 to-yellow-50">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-amber-100 mr-4">
              <Building2 className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Completed Sites</h3>
              <p className="text-2xl font-bold">{completedSites.length}</p>
            </div>
          </div>
        </CustomCard>

        <CustomCard className="bg-gradient-to-br from-purple-50 to-violet-50">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 mr-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Supervisors</h3>
              <p className="text-2xl font-bold">{supervisors.length}</p>
            </div>
          </div>
        </CustomCard>
      </div>

      {/* Filters */}
      <CustomCard>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Filter by Supervisor
            </label>
            <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
              <SelectTrigger>
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Supervisors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Supervisors</SelectItem>
                {supervisors.map(supervisor => (
                  <SelectItem key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Search Sites
            </label>
            <Input
              placeholder="Search by name, job, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedSupervisorId !== 'all' || searchTerm.trim()) && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {selectedSupervisorId !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Supervisor: {supervisors.find(s => s.id === selectedSupervisorId)?.name}
                <button
                  onClick={() => setSelectedSupervisorId('all')}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
            {searchTerm.trim() && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchTerm}
                <button
                  onClick={() => setSearchTerm('')}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedSupervisorId('all');
                setSearchTerm('');
              }}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </CustomCard>

      {/* Sites List */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading sites...</p>
        </div>
      ) : filteredSites.length > 0 ? (
        <SitesList 
          sites={filteredSites}
          onSiteClick={handleSiteClick}
        />
      ) : (
        <CustomCard>
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Sites Found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {selectedSupervisorId !== 'all' || searchTerm.trim()
                ? 'No sites match your current filters. Try adjusting your search criteria.'
                : 'No sites have been created yet. Add a new site to get started.'
              }
            </p>
          </div>
        </CustomCard>
      )}
    </div>
  );
};

export default AllSites;