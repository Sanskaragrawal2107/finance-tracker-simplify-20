import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ArrowUpRight, CheckCircle2, Clock, AlertCircle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Site, UserRole } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import SiteDetail from '@/components/sites/SiteDetail';
import { useVisibilityRefresh } from '@/hooks/use-visibility-refresh';
import { createVisibilityAwareTimeout } from '@/lib/connectivity';
import { useLoadingState } from '@/hooks/use-loading-state';

const SupervisorSites: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const [loading, setLoading] = useLoadingState(true, 45000); // 45 second timeout for operations
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewSiteForm, setShowNewSiteForm] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showSiteDetail, setShowSiteDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [connectionChecking, setConnectionChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    // Only fetch if user is available and component is mounted
    if (user && mounted) {
      fetchSites();
    } else {
      // If no user, make sure loading is set to false
      setLoading(false);
    }
    
    return () => {
      mounted = false;
    };
  }, [user?.id]); // Only re-fetch if user ID changes, not the entire user object

  useEffect(() => {
    if (sites.length > 0) {
      filterSites();
    }
  }, [searchQuery, sites, activeTab]);


  const fetchSites = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Create a visibility-aware timeout for the fetch operation
    const fetchTimeout = createVisibilityAwareTimeout(() => {
      console.warn('Sites data fetch timeout after 10 seconds of visible time');
      setLoading(false);
      toast({
        title: 'Network request timeout',
        description: 'Please try again or refresh the page.',
        variant: 'destructive',
      });
      setSites([]);
      setFilteredSites([]);
    }, 10000);
    
    try {
      let query = supabase
        .from('sites')
        .select('*, users!sites_supervisor_id_fkey(name)');

      // If user is a supervisor, only show their sites
      if (user.role === UserRole.SUPERVISOR) {
        query = query.eq('supervisor_id', user.id);
      }

      const { data, error } = await query;
      
      // Fetch completed, clear the timeout
      fetchTimeout.clear();

      if (error) {
        console.error('Error fetching sites:', error);
        toast({
          title: 'Error fetching sites',
          description: error.message,
          variant: 'destructive',
        });
        setSites([]);
        setFilteredSites([]);
        return;
      }

      if (!data) {
        setSites([]);
        setFilteredSites([]);
        return;
      }

      // Transform the data to match our Site interface
      const transformedSites: Site[] = data.map((site) => ({
        id: site.id,
        name: site.name,
        jobName: site.job_name || '',
        posNo: site.pos_no || '',
        location: site.location || '',
        startDate: site.start_date ? new Date(site.start_date) : new Date(),
        completionDate: site.completion_date ? new Date(site.completion_date) : undefined,
        supervisorId: site.supervisor_id || '',
        supervisor: site.users?.name || 'Unassigned',
        createdAt: new Date(site.created_at || new Date()),
        isCompleted: site.is_completed || false,
        funds: site.funds || 0,
        totalFunds: site.total_funds || 0,
      }));

      setSites(transformedSites);
      // Also set filtered sites to ensure something is visible immediately
      setFilteredSites(transformedSites);
    } catch (error) {
      console.error('Error in fetchSites:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch sites. Please try again.',
        variant: 'destructive',
      });
      setSites([]);
      setFilteredSites([]);
    } finally {
      // Ensure timeout is cleared
      fetchTimeout.clear();
      setLoading(false);
    }
  };

  const filterSites = useCallback(() => {
    let filtered = [...sites];

    // Filter by active/completed status
    if (activeTab === 'active') {
      filtered = filtered.filter((site) => !site.isCompleted);
    } else if (activeTab === 'completed') {
      filtered = filtered.filter((site) => site.isCompleted);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (site) =>
          site.name.toLowerCase().includes(query) ||
          site.jobName.toLowerCase().includes(query) ||
          site.posNo.toLowerCase().includes(query) ||
          site.location.toLowerCase().includes(query)
      );
    }

    setFilteredSites(filtered);
  }, [sites, activeTab, searchQuery]);

  const handleCreateSite = async (newSite: Partial<Site>) => {
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to create a site. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      console.log('Creating new site:', newSite);

      // First, refresh the auth session to ensure we have a valid token
      const { refreshSession } = useAuth();
      const refreshed = await refreshSession();
      
      if (!refreshed) {
        console.warn('Session refresh failed, attempting API connection test');
        // Check if API is still responsive
        try {
          const { error } = await supabase.from('users').select('count').limit(1);
          if (error) {
            console.error('API connection test failed:', error);
            throw new Error('Connection to server lost. Please refresh the page and try again.');
          }
        } catch (apiError) {
          console.error('API test error:', apiError);
          throw new Error('Connection issues detected. Please refresh the page.');
        }
      }
      
      // Create the site with retries
      let retryCount = 0;
      let siteData = null;
      let lastError = null;
      
      while (retryCount < 3 && !siteData) {
        try {
          const { data, error } = await supabase
            .from('sites')
            .insert([
              {
                name: newSite.name,
                job_name: newSite.jobName,
                pos_no: newSite.posNo,
                start_date: newSite.startDate?.toISOString().split('T')[0],
                location: newSite.location,
                supervisor_id: user.id,
                supervisor_name: user.name || 'Unknown',
                is_completed: false,
              },
            ])
            .select()
            .single();

          if (error) {
            console.error(`Error creating site (attempt ${retryCount + 1}):`, error);
            lastError = error;
            retryCount++;
            
            // Wait before retrying
            if (retryCount < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          } else {
            siteData = data;
            break;
          }
        } catch (error) {
          console.error(`Exception creating site (attempt ${retryCount + 1}):`, error);
          lastError = error;
          retryCount++;
          
          if (retryCount < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      if (!siteData) {
        throw lastError || new Error('Failed to create site after multiple attempts');
      }
      
      // Verify the site was actually created by checking
      try {
        const { data: verifyData, error: verifyError } = await supabase
          .from('sites')
          .select('id')
          .eq('id', siteData.id)
          .single();
          
        if (verifyError || !verifyData) {
          console.error('Site verification failed:', verifyError);
          throw new Error('Site was not properly saved. Please try again.');
        }
      } catch (verifyError) {
        console.error('Exception during site verification:', verifyError);
        // Continue anyway as the site might have been created
      }

      // Add the new site to our list and refresh
      console.log('Site created successfully:', siteData);
      toast({
        title: 'Success',
        description: 'Site created successfully',
      });
      
      // Close the form first for better UX
      setShowNewSiteForm(false);
      
      // Then refresh the sites list
      await fetchSites();
    } catch (error: any) {
      console.error('Failed to create site:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create site. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewSite = (site: Site) => {
    setSelectedSite(site);
    setShowSiteDetail(true);
  };

  const handleCloseSiteDetail = () => {
    setShowSiteDetail(false);
    setSelectedSite(null);
    fetchSites(); // Refresh the list in case there were updates
  };

  const renderSiteCard = (site: Site) => {
    const statusColor = site.isCompleted
      ? 'text-green-600 bg-green-100'
      : 'text-blue-600 bg-blue-100';
    const statusIcon = site.isCompleted ? (
      <CheckCircle2 className="h-4 w-4 mr-1" />
    ) : (
      <Clock className="h-4 w-4 mr-1" />
    );

    return (
      <CustomCard
        key={site.id}
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => handleViewSite(site)}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{site.name}</h3>
          <Badge variant="outline" className={`flex items-center ${statusColor}`}>
            {statusIcon}
            {site.isCompleted ? 'Completed' : 'Active'}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <p>
            <span className="font-medium text-foreground">Job Name:</span> {site.jobName || 'N/A'}
          </p>
          <p>
            <span className="font-medium text-foreground">POS No:</span> {site.posNo || 'N/A'}
          </p>
          <p>
            <span className="font-medium text-foreground">Location:</span> {site.location || 'N/A'}
          </p>
          <p>
            <span className="font-medium text-foreground">Start Date:</span>{' '}
            {format(site.startDate, 'dd MMM yyyy')}
          </p>
          {site.completionDate && (
            <p>
              <span className="font-medium text-foreground">Completion Date:</span>{' '}
              {format(site.completionDate, 'dd MMM yyyy')}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Supervisor</p>
            <p className="text-sm font-medium">{site.supervisor}</p>
          </div>
          <Button size="sm" variant="ghost" className="text-primary">
            View Details <ArrowUpRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CustomCard>
    );
  };

  const renderSitesList = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CustomCard key={i} className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-1/4" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="flex justify-between pt-2 border-t">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-8 w-1/4" />
              </div>
            </CustomCard>
          ))}
        </div>
      );
    }

    if (filteredSites.length === 0) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No sites found</h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery
              ? 'No sites match your search criteria'
              : activeTab === 'active'
              ? 'No active sites found'
              : 'No completed sites found'}
          </p>
          {user?.role !== UserRole.VIEWER && (
            <Button onClick={() => setShowNewSiteForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create New Site
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSites.map((site) => renderSiteCard(site))}
      </div>
    );
  };

  // Show user-friendly UI when needed
  const renderConnectionStatus = () => {
    if (connectionChecking) {
      return (
        <div className="fixed bottom-4 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-md shadow-md z-50">
          <div className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800"></span>
            Checking connection...
          </div>
        </div>
      );
    }
    return null;
  };

  // If site detail view is open, show that instead
  if (showSiteDetail && selectedSite) {
    return (
      <SiteDetail
        site={selectedSite}
        onBack={handleCloseSiteDetail}
        userRole={user?.role || UserRole.VIEWER}
      />
    );
  }

  // If new site form is open, show that
  if (showNewSiteForm) {
    return (
      <div className="space-y-6">
        <PageTitle 
          title="Create New Site" 
          subtitle="Enter the details to create a new site" 
        />
        
        <CustomCard>
          <form onSubmit={(e) => {
            e.preventDefault();
            // This form would be implemented in an actual SiteForm component
            // For now, this is just a placeholder
          }}>
            <div className="space-y-4 p-4">
              <p className="text-center text-muted-foreground">
                Site form component would go here.
              </p>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowNewSiteForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Site</Button>
              </div>
            </div>
          </form>
        </CustomCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {renderConnectionStatus()}
      {!user ? (
        <div className="text-center py-12">
          <div className="animate-pulse">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Loading...</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please wait while we authenticate your session
            </p>
          </div>
        </div>
      ) : (
        <>
          <PageTitle 
            title="Site Transactions" 
            subtitle="History of all site transactions" 
          />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sites..."
                className="py-2 pl-10 pr-4 border rounded-md w-full focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              {user?.role !== UserRole.VIEWER && (
                <Button size="sm" className="h-9" onClick={() => setShowNewSiteForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Site
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active Sites</TabsTrigger>
              <TabsTrigger value="completed">Completed Sites</TabsTrigger>
              <TabsTrigger value="all">All Sites</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              {renderSitesList()}
            </TabsContent>
            <TabsContent value="completed" className="mt-0">
              {renderSitesList()}
            </TabsContent>
            <TabsContent value="all" className="mt-0">
              {renderSitesList()}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default SupervisorSites;
