import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { ArrowLeft, Building, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Site, Expense, Advance, Invoice, FundsReceived, BalanceSummary, UserRole } from '@/lib/types';
import { toast } from 'sonner';
import SitesList from '@/components/sites/SitesList';
import SiteDetail from '@/components/sites/SiteDetail';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

const SupervisorSites: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [fundsReceived, setFundsReceived] = useState<FundsReceived[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary>({
    fundsReceived: 0,
    totalExpenditure: 0,
    totalAdvances: 0,
    debitsToWorker: 0,
    invoicesPaid: 0,
    pendingInvoices: 0,
    totalBalance: 0
  });
  
  // Extract supervisorId and supervisorName from location state
  const supervisorId = location.state?.supervisorId;
  const supervisorName = location.state?.supervisorName || 'Unknown Supervisor';
  
  // Check if the current user is an admin
  const isAdmin = user?.role === UserRole.ADMIN;
  
  // Redirect if no supervisorId is provided
  useEffect(() => {
    if (!supervisorId) {
      toast.error('No supervisor selected');
      navigate('/admin');
    }
  }, [supervisorId, navigate]);

  // Fetch sites for the selected supervisor
  const fetchSites = useCallback(async () => {
    if (!supervisorId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('supervisor_id', supervisorId);
      
      if (error) {
        throw error;
      }
      
      if (data) {
        const transformedSites: Site[] = data.map(site => ({
          id: site.id,
          name: site.name,
          jobName: site.job_name,
          posNo: site.pos_no,
          location: site.location,
          startDate: new Date(site.start_date),
          completionDate: site.completion_date ? new Date(site.completion_date) : undefined,
          supervisorId: site.supervisor_id,
          createdAt: new Date(site.created_at),
          isCompleted: site.is_completed,
          funds: site.funds || 0,
          totalFunds: site.total_funds || 0
        }));
        
        setSites(transformedSites);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load sites');
    } finally {
      setIsLoading(false);
    }
  }, [supervisorId]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Fetch site-specific data when a site is selected
  const fetchSiteData = useCallback(async (siteId: string) => {
    setIsLoading(true);
    try {
      // Find the selected site from the sites array
      const site = sites.find(s => s.id === siteId);
      if (site) {
        setSelectedSite(site);
      }

      // Fetch expenses for the selected site
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', siteId);
      
      if (expensesError) throw expensesError;
      
      if (expensesData) {
        const transformedExpenses: Expense[] = expensesData.map(expense => ({
          id: expense.id,
          date: new Date(expense.date),
          description: expense.description,
          category: expense.category,
          amount: Number(expense.amount),
          status: expense.status,
          createdBy: expense.created_by,
          createdAt: new Date(expense.created_at),
          siteId: expense.site_id,
          supervisorId: expense.supervisor_id
        }));
        
        setExpenses(transformedExpenses);
      } else {
        setExpenses([]);
      }

      // Fetch advances for the selected site
      const { data: advancesData, error: advancesError } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', siteId);
      
      if (advancesError) throw advancesError;
      
      if (advancesData) {
        const transformedAdvances: Advance[] = advancesData.map(advance => ({
          id: advance.id,
          date: new Date(advance.date),
          recipientId: advance.recipient_id,
          recipientName: advance.recipient_name,
          recipientType: advance.recipient_type,
          purpose: advance.purpose,
          amount: Number(advance.amount),
          remarks: advance.remarks,
          status: advance.status,
          createdBy: advance.created_by,
          createdAt: new Date(advance.created_at),
          siteId: advance.site_id
        }));
        
        setAdvances(transformedAdvances);
      } else {
        setAdvances([]);
      }

      // Fetch funds received for the selected site
      const { data: fundsData, error: fundsError } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', siteId);
      
      if (fundsError) throw fundsError;
      
      if (fundsData) {
        const transformedFunds: FundsReceived[] = fundsData.map(fund => ({
          id: fund.id,
          date: new Date(fund.date),
          amount: Number(fund.amount),
          siteId: fund.site_id,
          createdAt: new Date(fund.created_at),
          reference: fund.reference,
          method: fund.method
        }));
        
        setFundsReceived(transformedFunds);
      } else {
        setFundsReceived([]);
      }

      // Fetch invoices for the selected site
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('site_invoices')
        .select('*')
        .eq('site_id', siteId);
      
      if (invoicesError) throw invoicesError;
      
      if (invoicesData) {
        const transformedInvoices: Invoice[] = invoicesData.map(invoice => ({
          id: invoice.id,
          date: new Date(invoice.date),
          partyId: invoice.party_id,
          partyName: invoice.party_name,
          material: invoice.material,
          quantity: invoice.quantity,
          rate: invoice.rate,
          gstPercentage: invoice.gst_percentage,
          grossAmount: invoice.gross_amount,
          netAmount: invoice.net_amount,
          materialItems: invoice.material_items ? JSON.parse(invoice.material_items) : undefined,
          bankDetails: invoice.bank_details ? JSON.parse(invoice.bank_details) : { accountNumber: '', bankName: '', ifscCode: '' },
          billUrl: invoice.bill_url,
          paymentStatus: invoice.payment_status,
          createdBy: invoice.created_by,
          createdAt: new Date(invoice.created_at),
          approverType: invoice.approver_type,
          siteId: invoice.site_id
        }));
        
        setInvoices(transformedInvoices);
      } else {
        setInvoices([]);
      }

      // Calculate balance summary
      const totalFundsReceived = fundsData ? fundsData.reduce((sum, fund) => sum + Number(fund.amount), 0) : 0;
      const totalExpenses = expensesData ? expensesData.reduce((sum, expense) => sum + Number(expense.amount), 0) : 0;
      const totalAdvances = advancesData ? advancesData.reduce((sum, advance) => sum + Number(advance.amount), 0) : 0;
      const totalInvoicesPaid = invoicesData ? invoicesData
        .filter(inv => inv.payment_status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.net_amount), 0) : 0;
      const totalPendingInvoices = invoicesData ? invoicesData
        .filter(inv => inv.payment_status === 'pending')
        .reduce((sum, inv) => sum + Number(inv.net_amount), 0) : 0;
      
      setBalanceSummary({
        fundsReceived: totalFundsReceived,
        totalExpenditure: totalExpenses,
        totalAdvances: totalAdvances,
        debitsToWorker: 0, // Not calculating this for now
        invoicesPaid: totalInvoicesPaid,
        pendingInvoices: totalPendingInvoices,
        totalBalance: totalFundsReceived - totalExpenses - totalAdvances - totalInvoicesPaid
      });

    } catch (error) {
      console.error('Error fetching site data:', error);
      toast.error('Failed to load site data');
    } finally {
      setIsLoading(false);
    }
  }, [sites]);

  // Handle site selection
  const handleSelectSite = (siteId: string) => {
    fetchSiteData(siteId);
  };

  // Handle returning to sites list
  const handleBackToSites = () => {
    setSelectedSite(null);
  };

  // Handle adding an expense
  const handleAddExpense = async (newExpense: Partial<Expense>) => {
    if (!selectedSite || !user) return;
    
    try {
      const expenseData = {
        date: newExpense.date?.toISOString(),
        description: newExpense.description,
        category: newExpense.category,
        amount: newExpense.amount,
        status: newExpense.status || 'pending',
        created_by: user.id,
        site_id: selectedSite.id,
        supervisor_id: selectedSite.supervisorId
      };
      
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select('*')
        .single();
      
      if (error) {
        toast.error('Failed to add expense: ' + error.message);
        return;
      }
      
      if (data) {
        toast.success('Expense added successfully');
        fetchSiteData(selectedSite.id);
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('Failed to add expense');
    }
  };

  // Handle adding an advance
  const handleAddAdvance = async (newAdvance: Partial<Advance>) => {
    if (!selectedSite || !user) return;
    
    try {
      const advanceData = {
        date: newAdvance.date?.toISOString(),
        recipient_id: newAdvance.recipientId,
        recipient_name: newAdvance.recipientName,
        recipient_type: newAdvance.recipientType,
        purpose: newAdvance.purpose,
        amount: newAdvance.amount,
        remarks: newAdvance.remarks,
        status: newAdvance.status || 'pending',
        created_by: user.id,
        site_id: selectedSite.id
      };
      
      const { data, error } = await supabase
        .from('advances')
        .insert(advanceData)
        .select('*')
        .single();
      
      if (error) {
        toast.error('Failed to add advance: ' + error.message);
        return;
      }
      
      if (data) {
        toast.success('Advance added successfully');
        fetchSiteData(selectedSite.id);
      }
    } catch (error) {
      console.error('Error adding advance:', error);
      toast.error('Failed to add advance');
    }
  };

  // Handle adding funds
  const handleAddFunds = async (newFund: Partial<FundsReceived>) => {
    if (!selectedSite) return;
    
    try {
      const fundData = {
        date: newFund.date?.toISOString(),
        amount: newFund.amount,
        site_id: selectedSite.id,
        reference: newFund.reference,
        method: newFund.method
      };
      
      const { data, error } = await supabase
        .from('funds_received')
        .insert(fundData)
        .select('*')
        .single();
      
      if (error) {
        toast.error('Failed to add funds: ' + error.message);
        return;
      }
      
      if (data) {
        toast.success('Funds added successfully');
        fetchSiteData(selectedSite.id);
      }
    } catch (error) {
      console.error('Error adding funds:', error);
      toast.error('Failed to add funds');
    }
  };

  // Handle adding an invoice
  const handleAddInvoice = async (newInvoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    if (!selectedSite || !user) return;
    
    try {
      const invoiceData = {
        date: newInvoice.date.toISOString(),
        party_id: newInvoice.partyId,
        party_name: newInvoice.partyName,
        material: newInvoice.material,
        quantity: newInvoice.quantity,
        rate: newInvoice.rate,
        gst_percentage: newInvoice.gstPercentage,
        gross_amount: newInvoice.grossAmount,
        net_amount: newInvoice.netAmount,
        material_items: newInvoice.materialItems ? JSON.stringify(newInvoice.materialItems) : null,
        bank_details: newInvoice.bankDetails ? JSON.stringify(newInvoice.bankDetails) : null,
        bill_url: newInvoice.billUrl,
        payment_status: newInvoice.paymentStatus,
        created_by: user.id,
        approver_type: newInvoice.approverType,
        site_id: selectedSite.id
      };
      
      const { data, error } = await supabase
        .from('site_invoices')
        .insert(invoiceData)
        .select('*')
        .single();
      
      if (error) {
        toast.error('Failed to add invoice: ' + error.message);
        return;
      }
      
      if (data) {
        toast.success('Invoice added successfully');
        fetchSiteData(selectedSite.id);
      }
    } catch (error) {
      console.error('Error adding invoice:', error);
      toast.error('Failed to add invoice');
    }
  };

  // Handle site completion
  const handleCompleteSite = async (siteId: string, completionDate: Date) => {
    try {
      const { error } = await supabase
        .from('sites')
        .update({
          is_completed: true,
          completion_date: completionDate.toISOString()
        })
        .eq('id', siteId);
      
      if (error) {
        toast.error('Failed to complete site: ' + error.message);
        return;
      }
      
      toast.success('Site marked as completed');
      fetchSites();
      
      if (selectedSite && selectedSite.id === siteId) {
        setSelectedSite({
          ...selectedSite,
          isCompleted: true,
          completionDate
        });
      }
    } catch (error) {
      console.error('Error completing site:', error);
      toast.error('Failed to complete site');
    }
  };

  return (
    <div className="container mx-auto p-4 h-full flex flex-col">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          className="mr-2" 
          onClick={() => navigate('/admin')}
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Admin
        </Button>
        
        <PageTitle>
          {selectedSite ? selectedSite.name : `Sites for ${supervisorName}`}
        </PageTitle>
      </div>
      
      {supervisorId && !selectedSite && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-500" />
          <span className="font-medium">
            Viewing sites for supervisor: {supervisorName}
          </span>
        </div>
      )}
      
      {isLoading && !selectedSite ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          <span className="ml-2">Loading sites...</span>
        </div>
      ) : selectedSite ? (
        <SiteDetail
          site={selectedSite}
          expenses={expenses}
          advances={advances}
          fundsReceived={fundsReceived}
          invoices={invoices}
          balanceSummary={balanceSummary}
          siteSupervisor={{ id: supervisorId, name: supervisorName }}
          onBack={handleBackToSites}
          onAddExpense={handleAddExpense}
          onAddAdvance={handleAddAdvance}
          onAddFunds={handleAddFunds}
          onAddInvoice={handleAddInvoice}
          onCompleteSite={handleCompleteSite}
          supervisor={{ id: supervisorId, name: supervisorName }}
          isAdminView={isAdmin}
        />
      ) : sites.length > 0 ? (
        <div className="flex-1">
          <SitesList 
            sites={sites}
            onSelectSite={handleSelectSite}
          />
        </div>
      ) : (
        <CustomCard className="flex-1 flex items-center justify-center">
          <div className="p-12 text-center">
            <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Sites Available</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              This supervisor doesn't have any sites assigned yet.
            </p>
          </div>
        </CustomCard>
      )}
    </div>
  );
};

export default SupervisorSites; 