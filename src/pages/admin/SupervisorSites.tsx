import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ArrowUpRight, CheckCircle2, Clock, AlertCircle, Building2, SendHorizontal, ArrowLeft, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Site, UserRole, BalanceSummary } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import SiteDetail from '@/components/sites/SiteDetail';
import { SupervisorTransactionHistory } from '@/components/transactions/SupervisorTransactionHistory';
import { SupervisorAdvanceForm } from '@/components/transactions/SupervisorAdvanceForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExpenseList } from '@/components/expenses/ExpenseList';
import { AdvanceList } from '@/components/advances/AdvanceList';
import { FundsReceivedList } from '@/components/funds/FundsReceivedList';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import SiteDetailTransactions from '@/components/sites/SiteDetailTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VisibilityHandler from '@/components/common/VisibilityHandler';
import { useLoadingState } from '@/hooks/use-loading-state';

const AdminSupervisorSites: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [showSupervisorAdvanceForm, setShowSupervisorAdvanceForm] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [financialSummary, setFinancialSummary] = useState<BalanceSummary | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useLoadingState(false, 30000); // 30 second timeout for financials
  
  const lastVisibleTimeRef = useRef(Date.now());

  // Get supervisorId from route state if provided by AdminDashboard
  const supervisorIdFromState = location.state?.supervisorId;
  const supervisorNameFromState = location.state?.supervisorName;
  
  // Remove the handleVisibilityChange function from here to place it after filterSites
  
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
  }, [user?.id, supervisorIdFromState]); // Re-fetch when supervisorId from state changes

  const filterSites = useCallback((sitesToFilter = sites) => {
    const filtered = sitesToFilter.filter(site => {
      const matchesSearch = site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            site.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        activeTab === 'all' ? true :
        activeTab === 'active' ? !site.isCompleted :
        activeTab === 'completed' ? site.isCompleted : true;
      
      return matchesSearch && matchesStatus;
    });
    
    setFilteredSites(filtered);
  }, [searchQuery, activeTab]);

  useEffect(() => {
    if (sites.length > 0) {
      filterSites();
    }
  }, [filterSites, sites]);

  // Handle visibility changes (when browser tab becomes visible again)
  const handleVisibilityChange = useCallback((wasHidden: boolean, hiddenDuration: number) => {
    console.log('Tab visibility changed, was hidden for', hiddenDuration, 'ms');
    
    if (wasHidden) {
      if (selectedSiteId) {
        // Reset loading states and show toast
        setLoadingFinancials(false);
        toast({
          title: 'Refreshing data',
          description: 'Data is being refreshed after tab switch'
        });
        
        // Manually trigger a fetch to update the UI
        supabase
          .from('site_financial_summary')
          .select('*')
          .eq('site_id', selectedSiteId)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              // Get the correct values
              const fundsReceived = data.funds_received || 0;
              const fundsReceivedFromSupervisor = data.funds_received_from_supervisor || 0;
              const totalExpensesPaid = data.total_expenses_paid || 0;
              const totalAdvancesPaid = data.total_advances_paid || 0;
              const debitsToWorker = data.debit_to_worker || 0;
              const invoicesPaid = data.invoices_paid || 0;
              const advancePaidToSupervisor = data.advance_paid_to_supervisor || 0;
              
              // Calculate total balance
              const updatedTotalBalance = (fundsReceived + fundsReceivedFromSupervisor) - 
                               (totalExpensesPaid + totalAdvancesPaid + invoicesPaid + advancePaidToSupervisor);
              
              setFinancialSummary({
                fundsReceived,
                fundsReceivedFromSupervisor,
                totalExpenditure: totalExpensesPaid,
                totalAdvances: totalAdvancesPaid,
                debitsToWorker,
                invoicesPaid,
                advancePaidToSupervisor,
                pendingInvoices: 0,
                totalBalance: updatedTotalBalance
              });
            }
          });
      } else {
        // Reset loading state
        setLoading(false);
        
        // Direct fetch to update sites
        supabase
          .from('sites')
          .select('*, users!sites_supervisor_id_fkey(name)')
          .then(({ data, error }) => {
            if (!error && data) {
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
              filterSites(transformedSites);
            }
          });
      }
    }
  }, [selectedSiteId, toast, filterSites]);

  // Effect to fetch financial summary when a site is selected
  useEffect(() => {
    if (selectedSiteId) {
      console.log('Fetching financial summary for site:', selectedSiteId);
      fetchFinancialSummary(selectedSiteId);
    }
  }, [selectedSiteId]);

  const fetchFinancialSummary = async (siteId: string) => {
    setLoadingFinancials(true);
    try {
      const { data, error } = await supabase
        .from('site_financial_summary')
        .select('*')
        .eq('site_id', siteId)
        .single();
        
      if (error) {
        // PostgREST returns 406 when single() finds zero or multiple rows
        // Treat as "no data yet" and default to zeros
        const status = (error as any).status || (error as any).code;
        if (status === 406 || (error as any).code === 'PGRST116') {
          setFinancialSummary({
            fundsReceived: 0,
            fundsReceivedFromSupervisor: 0,
            totalExpenditure: 0,
            totalAdvances: 0,
            debitsToWorker: 0,
            invoicesPaid: 0,
            advancePaidToSupervisor: 0,
            pendingInvoices: 0,
            totalBalance: 0
          });
          return;
        }
        console.error('Error fetching financial summary:', error);
        toast({
          title: 'Error loading financial summary',
          description: (error as any).message || 'Failed to load financial data',
          variant: 'destructive',
        });
        setFinancialSummary(null);
        return;
      }
      
      if (data) {
        console.log('Financial summary data received:', data);
        // Get the correct values
        const fundsReceived = data.funds_received || 0;
        const fundsReceivedFromSupervisor = data.funds_received_from_supervisor || 0;
        const totalExpensesPaid = data.total_expenses_paid || 0;
        const totalAdvancesPaid = data.total_advances_paid || 0;
        const debitsToWorker = data.debit_to_worker || 0;
        const invoicesPaid = data.invoices_paid || 0;
        const advancePaidToSupervisor = data.advance_paid_to_supervisor || 0;
        
        // Calculate total balance
        const totalBalance = (fundsReceived + fundsReceivedFromSupervisor) - 
                             (totalExpensesPaid + totalAdvancesPaid + invoicesPaid + advancePaidToSupervisor);
        
        setFinancialSummary({
          fundsReceived,
          fundsReceivedFromSupervisor,
          totalExpenditure: totalExpensesPaid,
          totalAdvances: totalAdvancesPaid,
          debitsToWorker,
          invoicesPaid,
          advancePaidToSupervisor,
          pendingInvoices: 0,
          totalBalance
        });
      } else {
        console.log('No financial summary data found for site:', siteId);
        // Create empty financial summary with zeros
        setFinancialSummary({
          fundsReceived: 0,
          fundsReceivedFromSupervisor: 0,
          totalExpenditure: 0,
          totalAdvances: 0,
          debitsToWorker: 0,
          invoicesPaid: 0,
          advancePaidToSupervisor: 0,
          pendingInvoices: 0,
          totalBalance: 0
        });
      }
    } catch (error) {
      console.error('Error in fetchFinancialSummary:', error);
      toast({
        title: 'Error loading financial data',
        description: 'An unexpected error occurred while fetching financial summary',
        variant: 'destructive',
      });
      setFinancialSummary(null);
    } finally {
      setLoadingFinancials(false);
    }
  };

  const fetchSites = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Add fetch timeout safety
    const fetchTimeout = setTimeout(() => {
      console.warn('Sites data fetch timeout after 10 seconds');
      setLoading(false);
      toast({
        title: 'Network request timeout',
        description: 'Please try again or refresh the page.',
        variant: 'destructive',
      });
      setSites([]);
      setFilteredSites([]);
    }, 10000); // 10 second timeout
    
    try {
      let query = supabase
        .from('sites')
        .select('*, users!sites_supervisor_id_fkey(name)');

      // If we have a supervisorId from state, filter by that
      if (supervisorIdFromState) {
        query = query.eq('supervisor_id', supervisorIdFromState);
      }

      const { data, error } = await query;

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

      clearTimeout(fetchTimeout);
      setSites(transformedSites);
      filterSites(transformedSites);
      setLoading(false);
      
      // If there's only one site, select it automatically
      if (transformedSites.length === 1) {
        setSelectedSiteId(transformedSites[0].id);
        setSelectedSite(transformedSites[0]);
      }
      
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast({
        title: 'Error fetching sites',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      setSites([]);
      setFilteredSites([]);
    } finally {
      clearTimeout(fetchTimeout);
      setLoading(false);
    }
  };

  const handleSiteSelect = (site: Site) => {
    console.log('Selected site:', site.name);
    setSelectedSite(site);
    setSelectedSiteId(site.id);
  };

  const handleCloseSiteDetail = () => {
    setShowSiteDetail(false);
    setSelectedSite(null);
    setSelectedSiteId(null);
    // Refresh the list when coming back from site detail
    fetchSites();
  };

  const handleBackToAdmin = () => {
    navigate('/admin');
  };

  const handleTransactionSuccess = () => {
    setShowSupervisorAdvanceForm(false);
    // Refresh the financial summary
    refreshFinancialData();
    toast({
      title: 'Transaction Successful',
      description: 'The funds have been transferred successfully.',
    });
  };

  const renderFinancialSummary = () => {
    if (loadingFinancials) {
      return (
        <Card className="mb-6 border-blue-200 bg-blue-50 shadow-sm">
          <CardHeader className="pb-2 border-b border-blue-100">
            <CardTitle className="text-xl flex justify-between items-center">
              <span className="text-blue-800">Financial Summary</span>
              <div className="flex items-center gap-2">
                {selectedSite && <span className="text-lg font-normal text-blue-700">{selectedSite.name}</span>}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-blue-600 opacity-50" 
                  disabled
                  title="Refreshing..."
                >
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-48" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!selectedSiteId || !financialSummary) {
      return (
        <Card className="mb-6 border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="py-4">
            <p className="text-amber-800 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              No financial data available for this site
            </p>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card className="mb-6 border-blue-200 bg-blue-50 shadow-sm">
        <CardHeader className="pb-2 border-b border-blue-100">
          <CardTitle className="text-xl flex justify-between items-center">
            <span className="text-blue-800">Financial Summary</span>
            <div className="flex items-center gap-2">
              {selectedSite && <span className="text-lg font-normal text-blue-700">{selectedSite.name}</span>}
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-blue-600" 
                onClick={refreshFinancialData}
                title="Refresh financial data"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Funds Received Section */}
            <div className="border rounded-md p-3 bg-white">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Funds Received</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">From Head Office:</span>
                  <p className="font-medium">
                    ₹{financialSummary.fundsReceived.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">From Supervisor:</span>
                  <p className="font-medium">
                    ₹{financialSummary.fundsReceivedFromSupervisor.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="pt-1 border-t">
                  <span className="text-xs font-medium text-blue-700">Total Funds Received:</span>
                  <p className="font-semibold text-blue-900">
                    ₹{(financialSummary.fundsReceived + financialSummary.fundsReceivedFromSupervisor).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* Expenditure Section */}
            <div className="border rounded-md p-3 bg-white">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Expenditure</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Total Expenses:</span>
                  <p className="font-medium">
                    ₹{financialSummary.totalExpenditure.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Total Advances:</span>
                  <p className="font-medium">
                    ₹{financialSummary.totalAdvances.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Debit to Worker:</span>
                  <p className="font-medium">
                    ₹{financialSummary.debitsToWorker.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Invoices Paid:</span>
                  <p className="font-medium">
                    ₹{financialSummary.invoicesPaid.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* Other Transactions Section */}
            <div className="border rounded-md p-3 bg-white">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Other Transactions</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Advance Paid to Supervisor:</span>
                  <p className="font-medium">
                    ₹{financialSummary.advancePaidToSupervisor.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="pt-1 border-t mt-2">
                  <span className="text-xs font-medium text-blue-700">Current Balance:</span>
                  <p className={`font-semibold ${financialSummary.totalBalance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    ₹{financialSummary.totalBalance.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowSupervisorAdvanceForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <SendHorizontal className="h-4 w-4 mr-2" />
              Advance to Supervisor
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSiteCard = (site: Site) => {
    const isSelected = selectedSiteId === site.id;
    
    return (
      <CustomCard 
        key={site.id} 
        className={`cursor-pointer transition-colors ${isSelected ? 'border-primary border-2 bg-primary/5 shadow-md' : 'hover:border-primary'}`}
        onClick={() => handleSiteSelect(site)}
      >
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <h3 className={`font-medium text-lg ${isSelected ? 'text-primary' : ''}`}>{site.name}</h3>
            <Badge className={site.isCompleted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
              {site.isCompleted ? 'Completed' : 'Active'}
            </Badge>
          </div>
          
          <p className="text-muted-foreground mb-4">{site.location}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            <div className="flex items-center text-sm">
              <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
              <span>
                Start: {format(site.startDate, 'dd/MM/yyyy')}
              </span>
            </div>
            {site.completionDate && (
              <div className="flex items-center text-sm">
                <CheckCircle2 className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>
                  End: {format(site.completionDate, 'dd/MM/yyyy')}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center text-sm">
            <Building2 className="h-4 w-4 mr-1 text-muted-foreground" />
            <span className="text-muted-foreground">
              Supervisor: {site.supervisor}
            </span>
          </div>
          
          {isSelected && (
            <div className="mt-3 pt-3 border-t">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                Selected
              </Badge>
            </div>
          )}
        </div>
      </CustomCard>
    );
  };

  const renderSitesList = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CustomCard key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-3/4" />
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
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSites.map((site) => renderSiteCard(site))}
      </div>
    );
  };

  // If site detail view is open, show that instead
  if (showSiteDetail && selectedSite) {
    return (
      <div className="space-y-6">
        <SiteDetail
          site={selectedSite}
          onBack={handleCloseSiteDetail}
          userRole={user?.role || UserRole.VIEWER}
          isAdminView={true}
        />
      </div>
    );
  }

  const pageTitle = supervisorNameFromState
    ? `${supervisorNameFromState}'s Sites`
    : "Supervisor Sites";
  
  const pageSubtitle = supervisorNameFromState
    ? "View and manage all sites assigned to this supervisor"
    : "Manage site transactions and advances";

  // Add a more forceful refresh function that recalculates financial summary
  const refreshFinancialData = async () => {
    if (selectedSiteId) {
      // Clear the current data first 
      setFinancialSummary(null);
      setLoadingFinancials(true);
      
      try {
        // First try to force an update in the database with a stored procedure
        await supabase.rpc('update_site_financial_summary_for_id', { site_id_param: selectedSiteId });
        
        // Now fetch the updated data
        const { data, error } = await supabase
          .from('site_financial_summary')
          .select('*')
          .eq('site_id', selectedSiteId)
          .single();
          
        if (error) throw error;
        
        if (data) {
          console.log('Fresh financial data received after forced update:', data);
          // Get the correct values
          const fundsReceived = data.funds_received || 0;
          const fundsReceivedFromSupervisor = data.funds_received_from_supervisor || 0;
          const totalExpensesPaid = data.total_expenses_paid || 0;
          const totalAdvancesPaid = data.total_advances_paid || 0;
          const debitsToWorker = data.debit_to_worker || 0;
          const invoicesPaid = data.invoices_paid || 0;
          const advancePaidToSupervisor = data.advance_paid_to_supervisor || 0;
          
          // Calculate total balance
          const totalBalance = (fundsReceived + fundsReceivedFromSupervisor) - 
                               (totalExpensesPaid + totalAdvancesPaid + invoicesPaid + advancePaidToSupervisor);
          
          setFinancialSummary({
            fundsReceived,
            fundsReceivedFromSupervisor,
            totalExpenditure: totalExpensesPaid,
            totalAdvances: totalAdvancesPaid,
            debitsToWorker,
            invoicesPaid,
            advancePaidToSupervisor,
            pendingInvoices: 0,
            totalBalance
          });
          
          // Show success toast
          toast({
            title: 'Financial data recalculated',
            description: 'The latest financial information has been loaded',
          });
        }
      } catch (error) {
        console.error('Error refreshing financial summary:', error);
        
        // Fallback to direct table fetching if stored procedure fails
        try {
          // Let's query all the transaction tables directly
          const [
            { data: fundsData, error: fundsError },
            { data: fundsFromSupData, error: fundsFromSupError },
            { data: expensesData, error: expensesError },
            { data: advancesData, error: advancesError },
            { data: invoicesData, error: invoicesError },
            { data: advancePaidData, error: advancePaidError },
          ] = await Promise.all([
            // Funds received from HO
            supabase
              .from('funds_received')
              .select('amount')
              .eq('site_id', selectedSiteId),
            
            // Funds received from supervisor
            supabase
              .from('supervisor_transactions')
              .select('amount')
              .eq('receiver_site_id', selectedSiteId)
              .eq('transaction_type', 'funds_received'),
            
            // Expenses
            supabase
              .from('expenses')
              .select('amount')
              .eq('site_id', selectedSiteId),
            
            // Advances
            supabase
              .from('advances')
              .select('amount, purpose')
              .eq('site_id', selectedSiteId),
            
            // Invoices
            supabase
              .from('site_invoices')
              .select('net_amount')
              .eq('site_id', selectedSiteId)
              .eq('payment_status', 'paid'),
            
            // Advance paid to supervisor
            supabase
              .from('supervisor_transactions')
              .select('amount')
              .eq('payer_site_id', selectedSiteId)
              .eq('transaction_type', 'advance_paid'),
          ]);
          
          if (fundsError || fundsFromSupError || expensesError || advancesError || invoicesError || advancePaidError) {
            throw new Error("Error fetching transaction data");
          }
          
          // Calculate values
          const fundsReceived = fundsData ? 
            fundsData.reduce((sum, item) => sum + Number(item.amount), 0) : 0;
            
          const fundsReceivedFromSupervisor = fundsFromSupData ? 
            fundsFromSupData.reduce((sum, item) => sum + Number(item.amount), 0) : 0;
            
          const totalExpensesPaid = expensesData ? 
            expensesData.reduce((sum, item) => sum + Number(item.amount), 0) : 0;
            
          const totalAdvances = advancesData ? 
            advancesData.filter(a => a.purpose === 'advance')
              .reduce((sum, item) => sum + Number(item.amount), 0) : 0;
            
          const debitsToWorker = advancesData ? 
            advancesData.filter(a => a.purpose !== 'advance')
              .reduce((sum, item) => sum + Number(item.amount), 0) : 0;
            
          const invoicesPaid = invoicesData ? 
            invoicesData.reduce((sum, item) => sum + Number(item.net_amount), 0) : 0;
            
          const advancePaidToSupervisor = advancePaidData ? 
            advancePaidData.reduce((sum, item) => sum + Number(item.amount), 0) : 0;
          
          // Calculate total balance
          const totalBalance = (fundsReceived + fundsReceivedFromSupervisor) - 
                               (totalExpensesPaid + totalAdvances + invoicesPaid + advancePaidToSupervisor);
          
          setFinancialSummary({
            fundsReceived,
            fundsReceivedFromSupervisor,
            totalExpenditure: totalExpensesPaid,
            totalAdvances,
            debitsToWorker,
            invoicesPaid,
            advancePaidToSupervisor,
            pendingInvoices: 0,
            totalBalance
          });
          
          // Show success toast
          toast({
            title: 'Financial data recalculated',
            description: 'The latest financial information has been loaded directly from transactions',
          });
        } catch (fallbackError) {
          console.error('Error with fallback financial calculation:', fallbackError);
          toast({
            title: 'Error refreshing data',
            description: 'Could not fetch the latest financial information',
            variant: 'destructive',
          });
        }
      } finally {
        setLoadingFinancials(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Add VisibilityHandler to handle tab switching */}
      <VisibilityHandler onVisibilityChange={handleVisibilityChange} />
      
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
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={handleBackToAdmin}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Admin
            </Button>
          </div>
          
          <PageTitle 
            title={pageTitle} 
            subtitle={pageSubtitle} 
          />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
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
            </div>
          </div>
          
          {/* Always render the financial summary, even if showing "no data" message */}
          {(selectedSiteId || loadingFinancials) && (
            <div className="mb-6">
              {renderFinancialSummary()}
            </div>
          )}
          
          {selectedSiteId && (
            <div className="mb-8 border rounded-md shadow-sm">
              <SiteDetailTransactions
                siteId={selectedSiteId}
                userRole={user?.role || UserRole.ADMIN}
                isAdminView={true}
                onTransactionsUpdate={refreshFinancialData}
              />
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Sites</h2>
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
          
          <Dialog open={showSupervisorAdvanceForm} onOpenChange={setShowSupervisorAdvanceForm}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Advance Paid to Supervisor</DialogTitle>
                <DialogDescription>
                  Send funds to another supervisor from this site.
                </DialogDescription>
              </DialogHeader>
              <SupervisorAdvanceForm 
                onSuccess={handleTransactionSuccess}
                payerSiteId={selectedSiteId || undefined}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default AdminSupervisorSites; 