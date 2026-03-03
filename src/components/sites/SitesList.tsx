import React, { useEffect } from 'react';
import { format } from 'date-fns';
import { Building2, CalendarCheck, Calendar, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { Site } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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
            .select('*, users!sites_supervisor_id_fkey(name)')
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
              supervisor: site.users?.name || 'Unassigned', // Add supervisor name
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
      {/* Active Sites */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Sites <span className="ml-1 font-bold text-foreground">{activeSites.length}</span>
          </p>
        </div>
        {activeSites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSites.map((site) => (
              <div
                key={site.id}
                className="bg-white rounded-lg border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => handleSiteSelect(site)}
              >
                <div className="p-4 border-b border-border/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground truncate">{site.name}</h4>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{site.jobName}</p>
                    </div>
                    <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 flex-shrink-0">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Started {format(new Date(site.startDate), 'dd MMM yyyy')}</span>
                  </div>
                  {site.completionDate && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarCheck className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Expected {format(new Date(site.completionDate), 'dd MMM yyyy')}</span>
                    </div>
                  )}
                  {site.location && (
                    <p className="text-xs text-muted-foreground truncate">{site.location}</p>
                  )}
                  <button
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 py-1.5 border border-primary/20 rounded-md hover:bg-primary/5 transition-all group-hover:border-primary/40"
                    onClick={(e) => { e.stopPropagation(); handleSiteSelect(site); }}
                  >
                    View Details
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 bg-white rounded-lg border border-border/60 border-dashed text-muted-foreground">
            <Building2 className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">No active sites</p>
          </div>
        )}
      </div>

      {/* Completed Sites */}
      {completedSites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completed Sites <span className="ml-1 font-bold text-foreground">{completedSites.length}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedSites.map((site) => (
              <div
                key={site.id}
                className="bg-white rounded-lg border border-emerald-200/60 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group"
                onClick={() => handleSiteSelect(site)}
              >
                <div className="p-4 border-b border-border/40 bg-emerald-50/40 rounded-t-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground truncate">{site.name}</h4>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{site.jobName}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="badge-success">
                        <CheckCircle2 className="h-3 w-3" />
                        Done
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Started {format(new Date(site.startDate), 'dd MMM yyyy')}</span>
                  </div>
                  {site.completionDate && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Completed {format(new Date(site.completionDate), 'dd MMM yyyy')}</span>
                    </div>
                  )}
                  <button
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-600 py-1.5 border border-emerald-200 rounded-md hover:bg-emerald-50 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleSiteSelect(site); }}
                  >
                    View Details
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SitesList;
