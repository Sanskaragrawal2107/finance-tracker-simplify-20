import React, { useEffect } from 'react';
import { format } from 'date-fns';
import { Building, CalendarCheck, Calendar, ArrowRight } from 'lucide-react';
import { Site } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface SitesListProps {
  sites: Site[];
  onSelectSite?: (siteId: string) => void;
  onSiteClick?: (site: Site) => void;
  supervisorId?: string;
  fetchSites?: boolean;
}

const SitesList: React.FC<SitesListProps> = ({ 
  sites: initialSites, 
  onSelectSite, 
  onSiteClick,
  supervisorId,
  fetchSites = false
}) => {
  const [sites, setSites] = React.useState<Site[]>(initialSites);
  
  useEffect(() => {
    // If sites are provided directly, use them
    if (initialSites.length > 0 || !fetchSites) {
      setSites(initialSites);
      return;
    }
    
    // Otherwise, if supervisorId is provided, fetch sites from Supabase
    const fetchSitesFromSupabase = async () => {
      try {
        if (supervisorId) {
          console.log("Fetching sites for supervisor:", supervisorId);
          
          const { data, error } = await supabase
            .from('sites')
            .select('*')
            .eq('supervisor_id', supervisorId);
          
          if (error) {
            console.error("Error fetching sites:", error);
            return;
          }
          
          if (data) {
            console.log("Sites fetched from Supabase:", data);
            // Map the data to the Site type
            const mappedSites = data.map(site => ({
              id: site.id,
              name: site.name,
              jobName: site.job_name,
              posNo: site.pos_no,
              location: site.location,
              startDate: new Date(site.start_date),
              completionDate: site.completion_date ? new Date(site.completion_date) : undefined,
              supervisorId: site.supervisor_id,
              isCompleted: site.is_completed || false,
              funds: site.funds || 0,
              totalFunds: site.total_funds || 0,
              createdAt: new Date(site.created_at)
            }));
            
            setSites(mappedSites);
          }
        }
      } catch (error) {
        console.error("Error in fetchSitesFromSupabase:", error);
      }
    };
    
    fetchSitesFromSupabase();
    
    // Subscribe to real-time updates for sites table
    const channel = supabase
      .channel('public:sites')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sites',
        filter: supervisorId ? `supervisor_id=eq.${supervisorId}` : undefined
      }, (payload) => {
        console.log('Real-time update received:', payload);
        fetchSitesFromSupabase(); // Refresh the sites list
      })
      .subscribe();
      
    // Cleanup subscription when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supervisorId, fetchSites, initialSites]);

  const handleSiteSelect = (site: Site) => {
    if (onSelectSite) {
      onSelectSite(site.id);
    } else if (onSiteClick) {
      onSiteClick(site);
    }
  };

  // For debugging
  console.log("SitesList component - sites prop:", initialSites);
  console.log("SitesList component - sites state:", sites);
  console.log("SitesList supervisorId:", supervisorId);
  console.log("SitesList fetchSites:", fetchSites);

  const activeSites = sites.filter(site => !site.isCompleted);
  const completedSites = sites.filter(site => site.isCompleted);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Sites ({activeSites.length})</h3>
        {activeSites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSites.map((site) => (
              <CustomCard 
                key={site.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSiteSelect(site)}
              >
                <div className="p-3 sm:p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base sm:text-lg truncate">{site.name}</h4>
                    <Building className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-muted-foreground truncate text-sm">{site.jobName}</p>
                </div>
                <div className="p-3 sm:p-4">
                  <div className="flex items-center text-xs sm:text-sm mb-2">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">Started: {format(new Date(site.startDate), 'MMM dd, yyyy')}</span>
                  </div>
                  {site.completionDate && (
                    <div className="flex items-center text-xs sm:text-sm mb-2">
                      <CalendarCheck className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">Expected: {format(new Date(site.completionDate), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 w-full text-xs sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSiteSelect(site);
                    }}
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                  </Button>
                </div>
              </CustomCard>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border rounded-lg bg-muted/30">
            <p className="text-muted-foreground">No active sites found.</p>
          </div>
        )}
      </div>
      
      {completedSites.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Completed Sites ({completedSites.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedSites.map((site) => (
              <CustomCard 
                key={site.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors bg-green-50/30"
                onClick={() => handleSiteSelect(site)}
              >
                <div className="p-3 sm:p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base sm:text-lg truncate">{site.name}</h4>
                    <Building className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-muted-foreground truncate text-sm">{site.jobName}</p>
                </div>
                <div className="p-3 sm:p-4">
                  <div className="flex items-center text-xs sm:text-sm mb-2">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">Started: {format(new Date(site.startDate), 'MMM dd, yyyy')}</span>
                  </div>
                  {site.completionDate && (
                    <div className="flex items-center text-xs sm:text-sm mb-2">
                      <CalendarCheck className="h-4 w-4 mr-2 text-green-600 flex-shrink-0" />
                      <span className="text-green-600 truncate">Completed: {format(new Date(site.completionDate), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 w-full text-xs sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSiteSelect(site);
                    }}
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                  </Button>
                </div>
              </CustomCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SitesList;
