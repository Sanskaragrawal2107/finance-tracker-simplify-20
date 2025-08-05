import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import PageTitle from '@/components/common/PageTitle';
import CustomCard from '@/components/ui/CustomCard';
import { Search, Filter, Building, User, Users, CheckSquare, Plus, SendHorizontal } from 'lucide-react';
import { 
  Expense, 
  ExpenseCategory, 
  ApprovalStatus, 
  Site, 
  Advance, 
  FundsReceived, 
  Invoice, 
  UserRole, 
  AdvancePurpose, 
  RecipientType,
  PaymentStatus,
  MaterialItem,
  BankDetails
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SiteForm from '@/components/sites/SiteForm';
import SitesList from '@/components/sites/SitesList';
import SiteDetail from '@/components/sites/SiteDetail';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { SupervisorTransactionHistory } from '@/components/transactions/SupervisorTransactionHistory';
import { SupervisorAdvanceForm } from '@/components/transactions/SupervisorAdvanceForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { supervisors } from '@/data/supervisors';

const initialExpenses: Expense[] = [];
const initialAdvances: Advance[] = [];
const initialFunds: FundsReceived[] = [];
const initialInvoices: Invoice[] = [];

const DEBIT_ADVANCE_PURPOSES = [
  AdvancePurpose.SAFETY_SHOES,
  AdvancePurpose.TOOLS,
  AdvancePurpose.OTHER
];

const Expenses: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [sites, setSites] = useState<Site[]>([]);
  const [advances, setAdvances] = useState<Advance[]>(initialAdvances);
  const [fundsReceived, setFundsReceived] = useState<FundsReceived[]>(initialFunds);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState(false);
  const [isFundsFormOpen, setIsFundsFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const [showSupervisorAdvanceForm, setShowSupervisorAdvanceForm] = useState(false);

  const fetchSites = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    if (hasFetchedData && !selectedSiteId && !location.state) return;
    
    setIsLoading(true);
    
    // Add fetch timeout safety
    const fetchTimeout = setTimeout(() => {
      console.warn('Sites data fetch timeout after 10 seconds');
      setIsLoading(false);
      toast.error('Network request timeout. Please try again.');
      setSites([]);
      setHasFetchedData(true);
    }, 10000); // 10 second timeout
    
    try {
      let query = supabase.from('sites').select('*');
      
      if (user?.role === UserRole.SUPERVISOR) {
        query = query.eq('supervisor_id', user.id);
      } 
      else if (selectedSupervisorId) {
        query = query.eq('supervisor_id', selectedSupervisorId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching sites:', error);
        toast.error('Failed to load sites');
        setSites([]);
        setHasFetchedData(true);
        return;
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
          supervisor: site.supervisor_id ? 
            (supervisors.find(s => s.id === site.supervisor_id)?.name || 'Unknown') : 'Unassigned',
          createdAt: new Date(site.created_at),
          isCompleted: site.is_completed,
          funds: site.funds || 0,
          totalFunds: site.total_funds || 0
        }));
        
        setSites(transformedSites);
        setHasFetchedData(true);
      } else {
        setSites([]);
        setHasFetchedData(true);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load sites');
      setSites([]);
      setHasFetchedData(true);
    } finally {
      clearTimeout(fetchTimeout);
      setIsLoading(false);
    }
  }, [user, selectedSupervisorId, hasFetchedData, selectedSiteId, location.state]);

  useEffect(() => {
    if (user) {
      setUserRole(user.role);
      
      if (user.role === UserRole.SUPERVISOR) {
        setSelectedSupervisorId(user.id);
      }
      
      const locationState = location.state as { supervisorId?: string, newSite?: boolean } | null;
      if (locationState?.supervisorId && user?.role === UserRole.ADMIN) {
        setSelectedSupervisorId(locationState.supervisorId);
      }
      
      if (locationState?.newSite && user?.role === UserRole.ADMIN) {
        setIsSiteFormOpen(true);
      }
      
      fetchSites();
    } else {
      setIsLoading(false);
      setUserRole(null);
    }
  }, [location, user, fetchSites]);

  useEffect(() => {
    if (selectedSiteId) {
      console.log('Selected site changed, fetching all data for site:', selectedSiteId);
      refreshSiteData(selectedSiteId);
    }
  }, [selectedSiteId]);

  const fetchSiteExpenses = async (siteId: string) => {
    if (!siteId || !user) {
      setExpenses([]);
      return;
    }
    
    try {
      console.log(`Fetching expenses for site ${siteId}`);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', siteId);
      
      if (error) {
        console.error('Error fetching expenses:', error);
        toast.error('Failed to load expenses for this site');
        setExpenses([]);
        return;
      }
      
      if (data) {
        console.log(`Successfully fetched ${data.length} expenses`);
        const transformedExpenses: Expense[] = data.map(expense => ({
          id: expense.id,
          siteId: expense.site_id,
          date: new Date(expense.date),
          description: expense.description || '',
          category: expense.category as ExpenseCategory,
          amount: Number(expense.amount),
          status: ApprovalStatus.APPROVED,
          createdAt: new Date(expense.created_at),
          createdBy: expense.created_by || '',
          supervisorId: user?.id || '',
        }));
        
        setExpenses(transformedExpenses);
      } else {
        console.log('No expenses found for this site');
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses for this site');
      setExpenses([]);
    }
  };

  const fetchSiteAdvances = async (siteId: string) => {
    if (!siteId || !user) {
      setAdvances([]);
      return;
    }
    
    try {
      console.log(`Fetching advances for site ${siteId}`);
      const { data, error } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', siteId);
      
      if (error) {
        console.error('Error fetching advances:', error);
        toast.error('Failed to load advances for this site');
        setAdvances([]);
        return;
      }
      
      if (data) {
        console.log(`Successfully fetched ${data.length} advances`);
        const transformedAdvances: Advance[] = data.map(advance => ({
          id: advance.id,
          siteId: advance.site_id,
          date: new Date(advance.date),
          recipientName: advance.recipient_name,
          recipientType: advance.recipient_type as RecipientType,
          purpose: advance.purpose as AdvancePurpose,
          amount: Number(advance.amount),
          remarks: advance.remarks || '',
          status: advance.status as ApprovalStatus,
          createdBy: advance.created_by || '',
          createdAt: new Date(advance.created_at),
        }));
        
        setAdvances(transformedAdvances);
      } else {
        console.log('No advances found for this site');
        setAdvances([]);
      }
    } catch (error) {
      console.error('Error fetching advances:', error);
      toast.error('Failed to load advances for this site');
      setAdvances([]);
    }
  };

  const fetchSiteFundsReceived = async (siteId: string) => {
    if (!siteId || !user) {
      setFundsReceived([]);
      return;
    }
    
    try {
      console.log(`Fetching funds received for site ${siteId}`);
      const { data, error } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', siteId);
      
      if (error) {
        console.error('Error fetching funds received:', error);
        toast.error('Failed to load funds received for this site');
        setFundsReceived([]);
        return;
      }
      
      if (data) {
        console.log(`Successfully fetched ${data.length} funds received entries`);
        const transformedFunds: FundsReceived[] = data.map(fund => ({
          id: fund.id,
          siteId: fund.site_id,
          date: new Date(fund.date),
          amount: Number(fund.amount),
          reference: fund.reference || null,
          method: fund.method || null,
          createdAt: new Date(fund.created_at),
        }));
        
        setFundsReceived(transformedFunds);
      } else {
        console.log('No funds received found for this site');
        setFundsReceived([]);
      }
    } catch (error) {
      console.error('Error fetching funds received:', error);
      toast.error('Failed to load funds received for this site');
      setFundsReceived([]);
    }
  };

  const fetchSiteInvoices = async (siteId: string) => {
    if (!siteId || !user) {
      setInvoices([]);
      return;
    }
    
    try {
      console.log(`Fetching invoices for site ${siteId}`);
      const { data, error } = await supabase
        .from('site_invoices')
        .select('*')
        .eq('site_id', siteId);
      
      if (error) {
        console.error('Error fetching invoices:', error);
        toast.error('Failed to load invoices for this site');
        setInvoices([]);
        return;
      }
      
      if (data) {
        console.log(`Successfully fetched ${data.length} invoices`);
        const transformedInvoices: Invoice[] = data.map(invoice => {
          // Parse material_items as MaterialItem[]
          let materialItems: MaterialItem[] = [];
          if (invoice.material_items) {
            try {
              if (typeof invoice.material_items === 'string') {
                materialItems = JSON.parse(invoice.material_items);
              } else if (Array.isArray(invoice.material_items)) {
                materialItems = invoice.material_items as unknown as MaterialItem[];
              }
            } catch (e) {
              console.error('Error parsing material items:', e);
            }
          }

          // Parse bank_details as BankDetails
          let bankDetails: BankDetails = {
            bankName: '',
            accountNumber: '',
            ifscCode: ''
          };
          
          if (invoice.bank_details) {
            try {
              if (typeof invoice.bank_details === 'string') {
                bankDetails = JSON.parse(invoice.bank_details);
              } else if (typeof invoice.bank_details === 'object') {
                bankDetails = invoice.bank_details as unknown as BankDetails;
              }
            } catch (e) {
              console.error('Error parsing bank details:', e);
            }
          }

          return {
            id: invoice.id,
            date: new Date(invoice.date),
            partyId: invoice.party_id || '',
            partyName: invoice.party_name || '',
            vendorName: invoice.party_name || '',
            invoiceNumber: invoice.id.slice(0, 8), // Generate invoice number from ID if not available
            material: invoice.material || '',
            quantity: Number(invoice.quantity) || 0,
            rate: Number(invoice.rate) || 0,
            gstPercentage: Number(invoice.gst_percentage) || 0,
            grossAmount: Number(invoice.gross_amount) || 0,
            netAmount: Number(invoice.net_amount) || 0,
            amount: Number(invoice.net_amount) || 0,
            materialItems,
            bankDetails,
            billUrl: invoice.bill_url || '',
            paymentStatus: (invoice.payment_status || 'pending') as PaymentStatus,
            status: (invoice.payment_status || 'pending') as PaymentStatus,
            createdBy: invoice.created_by || '',
            createdAt: new Date(invoice.created_at),
            approverType: (invoice.approver_type || 'ho') as "ho" | "supervisor",
            siteId: invoice.site_id
          };
        });
        
        setInvoices(transformedInvoices);
        console.log('Fetched invoices:', transformedInvoices);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices for this site');
      setInvoices([]);
    }
  };

  const ensureDateObjects = (site: Site): Site => {
    return {
      ...site,
      startDate: site.startDate instanceof Date ? site.startDate : new Date(site.startDate),
      completionDate: site.completionDate ? 
        (site.completionDate instanceof Date ? site.completionDate : new Date(site.completionDate)) 
        : undefined
    };
  };

  const handleAddSite = async (newSite: Partial<Site>) => {
    try {
      const currentSupervisorId = userRole === UserRole.ADMIN && selectedSupervisorId 
        ? selectedSupervisorId 
        : user?.id;
      
      if (!currentSupervisorId) {
        toast.error("No supervisor assigned");
        return;
      }
      
      const siteData = {
        name: newSite.name,
        job_name: newSite.jobName,
        pos_no: newSite.posNo,
        location: newSite.location || "",
        start_date: newSite.startDate?.toISOString(),
        completion_date: newSite.completionDate?.toISOString(),
        supervisor_id: currentSupervisorId,
        is_completed: false,
        funds: 0
      };
      
      const { data: existingSite, error: checkError } = await supabase
        .from('sites')
        .select('id')
        .eq('name', siteData.name)
        .maybeSingle();
      
      if (existingSite) {
        toast.error(`Site with name "${siteData.name}" already exists`);
        return;
      }
      
      const { data, error } = await supabase
        .from('sites')
        .insert(siteData)
        .select('*')
        .single();
      
      if (error) {
        if (error.code === '23505' && error.message.includes('sites_name_key')) {
          toast.error(`Site with name "${siteData.name}" already exists`);
        } else {
          toast.error('Failed to create site: ' + error.message);
        }
        return;
      }
      
      if (data) {
        const newSiteData: Site = {
          id: data.id,
          name: data.name,
          jobName: data.job_name,
          posNo: data.pos_no,
          location: data.location,
          startDate: new Date(data.start_date),
          completionDate: data.completion_date ? new Date(data.completion_date) : undefined,
          supervisorId: data.supervisor_id,
          supervisor: data.supervisor_id ? 
            (supervisors.find(s => s.id === data.supervisor_id)?.name || 'Unknown') : 'Unassigned',
          createdAt: new Date(data.created_at),
          isCompleted: data.is_completed,
          funds: data.funds || 0
        };
        
        setSites(prevSites => [...prevSites, newSiteData]);
        toast.success(`Site "${newSiteData.name}" created successfully`);
      }
    } catch (error: any) {
      console.error('Error creating site:', error);
      toast.error('Failed to create site: ' + error.message);
    }
  };

  const handleAddExpense = async (newExpense: Partial<Expense>) => {
    try {
      if (!newExpense.siteId || !selectedSiteId) {
        toast.error("No site selected for expense");
        return;
      }

      const expenseData = {
        site_id: selectedSiteId,
        date: newExpense.date instanceof Date ? newExpense.date.toISOString() : new Date().toISOString(),
        description: newExpense.description || '',
        category: newExpense.category,
        amount: newExpense.amount,
        created_by: user?.id
      };
      
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select('*')
        .single();
      
      if (error) throw error;
      
      if (data) {
        const expenseWithId: Expense = {
          id: data.id,
          siteId: data.site_id,
          date: new Date(data.date),
          description: data.description || '',
          category: data.category as ExpenseCategory,
          amount: Number(data.amount),
          status: ApprovalStatus.APPROVED,
          createdAt: new Date(data.created_at),
          createdBy: data.created_by || '',
          supervisorId: user?.id || '',
        };
        
        setExpenses(prevExpenses => [expenseWithId, ...prevExpenses]);
        toast.success("Expense added successfully");
        // Re-fetch expenses to ensure the list is up-to-date
        fetchSiteExpenses(selectedSiteId);
      }
    } catch (error: any) {
      console.error('Error adding expense:', error);
      toast.error('Failed to add expense: ' + error.message);
    }
  };

  const handleAddAdvance = async (newAdvance: Partial<Advance>) => {
    try {
      if (!newAdvance.siteId || !selectedSiteId) {
        toast.error("No site selected for advance");
        return;
      }

      const advanceData = {
        site_id: selectedSiteId,
        date: newAdvance.date instanceof Date ? newAdvance.date.toISOString() : new Date().toISOString(),
        recipient_name: newAdvance.recipientName,
        recipient_type: newAdvance.recipientType,
        purpose: newAdvance.purpose,
        amount: newAdvance.amount,
        remarks: newAdvance.remarks || null,
        status: ApprovalStatus.APPROVED,
        created_by: user?.id
      };
      
      const { data, error } = await supabase
        .from('advances')
        .insert(advanceData)
        .select('*')
        .single();
      
      if (error) throw error;
      
      if (data) {
        const advanceWithId: Advance = {
          id: data.id,
          siteId: data.site_id,
          date: new Date(data.date),
          recipientName: data.recipient_name,
          recipientType: data.recipient_type as RecipientType,
          purpose: data.purpose as AdvancePurpose,
          amount: Number(data.amount),
          remarks: data.remarks || '',
          status: data.status as ApprovalStatus,
          createdBy: data.created_by || '',
          createdAt: new Date(data.created_at),
        };
        
        setAdvances(prevAdvances => [advanceWithId, ...prevAdvances]);
        toast.success("Advance added successfully");
        // Re-fetch advances to ensure the list is up-to-date
        fetchSiteAdvances(selectedSiteId);
      }
    } catch (error: any) {
      console.error('Error adding advance:', error);
      toast.error('Failed to add advance: ' + error.message);
    }
  };

  const handleAddFunds = async (newFund: Partial<FundsReceived>) => {
    try {
      if (!newFund.siteId || !selectedSiteId) {
        toast.error("No site selected for funds received");
        return;
      }

      const fundsData = {
        site_id: selectedSiteId,
        date: newFund.date instanceof Date ? newFund.date.toISOString() : new Date().toISOString(),
        amount: newFund.amount,
        reference: newFund.reference || null,
        method: newFund.method || null,
        created_by: user?.id
      };
      
      const { data, error } = await supabase
        .from('funds_received')
        .insert(fundsData)
        .select('*')
        .single();
      
      if (error) throw error;
      
      if (data) {
        const fundWithId: FundsReceived = {
          id: data.id,
          siteId: data.site_id,
          date: new Date(data.date),
          amount: Number(data.amount),
          reference: data.reference || undefined,
          method: data.method || undefined,
          createdAt: new Date(data.created_at),
        };
        
        setFundsReceived(prevFunds => [fundWithId, ...prevFunds]);
        
        // Update the site's funds directly
        const updatedFunds = (sites.find(site => site.id === selectedSiteId)?.funds || 0) + Number(fundWithId.amount);
        
        const { error: updateError } = await supabase
          .from('sites')
          .update({ funds: updatedFunds })
          .eq('id', selectedSiteId);
          
        if (updateError) {
          console.error('Error updating site funds:', updateError);
        } else {
          setSites(prevSites =>
            prevSites.map(site =>
              site.id === selectedSiteId
                ? { ...site, funds: updatedFunds }
                : site
            )
          );
        }
        
        toast.success("Funds received recorded successfully");
        
        // Re-fetch data to ensure everything is up-to-date
        fetchSites();
        fetchSiteFundsReceived(selectedSiteId);
      }
    } catch (error: any) {
      console.error('Error adding funds received:', error);
      toast.error('Failed to add funds received: ' + error.message);
    }
  };

  const handleAddInvoice = (newInvoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    console.log("Adding new invoice with data:", newInvoice);
    
    const invoiceWithId: Invoice = {
      ...newInvoice,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    
    console.log("Created invoice with ID:", invoiceWithId.id);
    console.log("Invoice image URL:", invoiceWithId.invoiceImageUrl);
    
    setInvoices(prevInvoices => [invoiceWithId, ...prevInvoices]);
    toast.success("Invoice added successfully");
  };

  const handleCompleteSite = async (siteId: string, completionDate: Date) => {
    try {
      const { error } = await supabase
        .from('sites')
        .update({ 
          is_completed: true, 
          completion_date: completionDate.toISOString() 
        })
        .eq('id', siteId);
        
      if (error) throw error;
      
      setSites(prevSites => 
        prevSites.map(site => 
          site.id === siteId 
            ? { ...site, isCompleted: true, completionDate } 
            : site
        )
      );
      
      toast.success("Site marked as completed");
    } catch (error: any) {
      console.error('Error completing site:', error);
      toast.error('Failed to mark site as completed: ' + error.message);
    }
  };

  const filteredSites = sites.filter(site => {
    const matchesSearch = 
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.posNo.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesSupervisor = selectedSupervisorId 
      ? site.supervisorId === selectedSupervisorId 
      : true;
    
    const matchesStatus = 
      filterStatus === 'all' ? true :
      filterStatus === 'active' ? !site.isCompleted :
      filterStatus === 'completed' ? site.isCompleted : true;
      
    return matchesSearch && matchesSupervisor && matchesStatus;
  });

  const selectedSite = selectedSiteId 
    ? ensureDateObjects(sites.find(site => site.id === selectedSiteId) as Site)
    : null;
    
  const siteExpenses = expenses.filter(expense => expense.siteId === selectedSiteId);
  const siteAdvances = advances.filter(advance => advance.siteId === selectedSiteId);
  const siteFunds = fundsReceived.filter(fund => fund.siteId === selectedSiteId);
  const siteInvoices = invoices.filter(invoice => invoice.siteId === selectedSiteId);
  
  const allSiteInvoices = siteInvoices;
  
  const supervisorInvoices = siteInvoices.filter(invoice => 
    invoice.approverType === "supervisor" || !invoice.approverType
  );

  const calculateSiteFinancials = (siteId: string) => {
    if (siteId) {
      const site = sites.find(s => s.id === siteId);
      
      if (site) {
        // Calculate total expenses
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        // Calculate total funds received
        const totalFunds = fundsReceived.reduce((sum, fund) => sum + fund.amount, 0);
        
        // Calculate funds received from supervisor
        const fundsReceivedFromSupervisor = fundsReceived
          .filter(fund => fund.source === 'SUPERVISOR' || fund.source === 'supervisor')
          .reduce((sum, fund) => sum + fund.amount, 0);
        
        // Calculate total advances (excluding debit to worker)
        const totalAdvances = advances.reduce((sum, advance) => {
          if (!DEBIT_ADVANCE_PURPOSES.includes(advance.purpose)) {
            return sum + advance.amount;
          }
          return sum;
        }, 0);
        
        // Calculate total debit to worker advances
        const totalDebitToWorker = advances.reduce((sum, advance) => {
          if (DEBIT_ADVANCE_PURPOSES.includes(advance.purpose)) {
            return sum + advance.amount;
          }
          return sum;
        }, 0);
        
        // Calculate supervisor invoices (only those paid by supervisor)
        const supervisorInvoiceTotal = invoices
          .filter(invoice => 
            invoice.paymentStatus === PaymentStatus.PAID && 
            (invoice.payerType === 'supervisor' || invoice.payerType === 'SUPERVISOR')
          )
          .reduce((sum, invoice) => sum + invoice.netAmount, 0);
        
        // Get advancePaidToSupervisor from site financial summary
        let advancePaidToSupervisor = 0;
        
        // Calculate total balance according to the correct formula:
        // (Funds Received from HO + Funds Received from Supervisor) - 
        // (Total Expenses Paid by Supervisor + Total Advances Paid by Supervisor + Invoices Paid by Supervisor + Advance Paid to Supervisor)
        const totalBalance = (totalFunds + fundsReceivedFromSupervisor) - 
                             (totalExpenses + totalAdvances + supervisorInvoiceTotal + advancePaidToSupervisor);
        
        return {
          fundsReceived: totalFunds,
          fundsReceivedFromSupervisor,
          totalExpenditure: totalExpenses,
          totalAdvances,
          debitsToWorker: totalDebitToWorker,
          invoicesPaid: supervisorInvoiceTotal,
          advancePaidToSupervisor,
          pendingInvoices: 0,
          totalBalance: totalBalance
        };
      }
    }
    
    return {
      fundsReceived: 0,
      fundsReceivedFromSupervisor: 0,
      totalExpenditure: 0,
      totalAdvances: 0,
      debitsToWorker: 0,
      invoicesPaid: 0,
      advancePaidToSupervisor: 0,
      pendingInvoices: 0,
      totalBalance: 0
    };
  };

  const getSelectedSupervisorName = () => {
    if (!selectedSupervisorId) return null;
    const supervisor = supervisors.find(s => s.id === selectedSupervisorId);
    return supervisor ? supervisor.name : "Unknown Supervisor";
  };

  const siteSupervisor = selectedSite && selectedSite.supervisorId ? 
    supervisors.find(s => s.id === selectedSite.supervisorId) : null;

  const handleCreateSite = async (newSite) => {
    if (!user) return;
    try {
      // SiteForm already inserts the site into the database, so we don't need to do it again here
      // Just update the UI by fetching the latest sites
      toast.success('Site created successfully');
      setIsSiteFormOpen(false);
      fetchSites();
    } catch (error) {
      console.error('Error in handleCreateSite:', error);
      toast.error('Failed to create site. Please try again.');
    }
  };

  const handleViewSite = (siteId) => {
    console.log('Viewing site:', siteId);
    setSelectedSiteId(siteId);
  };

  const handleCloseSiteDetail = () => {
    setSelectedSiteId(null);
  };

  const refreshSiteData = async (siteId: string) => {
    if (!siteId) return;
    
    console.log('Refreshing all data for site:', siteId);
    setIsLoading(true);
    
    // Track if we successfully loaded any data
    let hasLoadedAnyData = false;
    
    // Use individual try-catch blocks to ensure partial failure doesn't block everything
    try {
      await fetchSiteExpenses(siteId);
      hasLoadedAnyData = true;
    } catch (error) {
      console.error('Error refreshing expenses:', error);
      // Don't reset state to empty array on error, keep previous data
      toast.error('Failed to refresh expense data');
    }
    
    try {
      await fetchSiteAdvances(siteId);
      hasLoadedAnyData = true;
    } catch (error) {
      console.error('Error refreshing advances:', error);
      // Don't reset state to empty array on error, keep previous data
      toast.error('Failed to refresh advance data');
    }
    
    try {
      await fetchSiteFundsReceived(siteId);
      hasLoadedAnyData = true;
    } catch (error) {
      console.error('Error refreshing funds received:', error);
      // Don't reset state to empty array on error, keep previous data
      toast.error('Failed to refresh funds data');
    }
    
    try {
      await fetchSiteInvoices(siteId);
      hasLoadedAnyData = true;
    } catch (error) {
      console.error('Error refreshing invoices:', error);
      // Don't reset state to empty array on error, keep previous data
      toast.error('Failed to refresh invoice data');
    }
    
    setIsLoading(false);
    console.log('All site data refresh attempts completed');
    
    if (hasLoadedAnyData) {
      toast.success('Financial data refreshed');
    } else {
      toast.error('Failed to refresh data. Please try again later.');
    }
  };

  const handleEntrySuccess = (entryType) => {
    console.log(`Entry success for ${entryType}, refreshing data for site:`, selectedSiteId);
    if (selectedSiteId) {
      if (entryType === 'expense') fetchSiteExpenses(selectedSiteId);
      else if (entryType === 'advance') fetchSiteAdvances(selectedSiteId);
      else if (entryType === 'funds') fetchSiteFundsReceived(selectedSiteId);
      else if (entryType === 'invoice') fetchSiteInvoices(selectedSiteId);
      else if (entryType === 'transactions') refreshSiteData(selectedSiteId);
    }
  };

  const renderFinancialSummary = () => {
    if (!selectedSiteId) return null;
    
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return null;
    
    return (
      <div className="space-y-6">
        
        <SupervisorTransactionHistory 
          siteId={selectedSiteId}
        />
      </div>
    );
  };

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      {!user ? (
        <div className="text-center py-12">
          <div className="animate-pulse">
            <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Loading...</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please wait while we authenticate your session
            </p>
          </div>
        </div>
      ) : (
        <>
          <PageTitle
            title="Sites & Expenses"
            subtitle="Manage your construction sites and expenses"
          />
          
          {/* Filter and Search Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
              <div className="relative max-w-md w-full">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search sites..." 
                  className="py-2 pl-10 pr-4 border rounded-md w-full focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {userRole === UserRole.ADMIN && (
                <div className="w-full md:w-64">
                  <Select 
                    value={selectedSupervisorId || ''} 
                    onValueChange={(value) => setSelectedSupervisorId(value || null)}
                  >
                    <SelectTrigger className="w-full">
                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Supervisors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Supervisors</SelectItem>
                      {supervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {userRole === UserRole.ADMIN && (
                <div className="w-full md:w-64">
                  <Select 
                    value={filterStatus} 
                    onValueChange={(value: 'all' | 'active' | 'completed') => setFilterStatus(value)}
                  >
                    <SelectTrigger className="w-full">
                      <CheckSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Sites" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sites</SelectItem>
                      <SelectItem value="active">Active Sites</SelectItem>
                      <SelectItem value="completed">Completed Sites</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    Filter
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium">Filter Sites</h4>
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Status</h5>
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="filter-all" 
                            checked={filterStatus === 'all'}
                            onCheckedChange={() => setFilterStatus('all')}
                          />
                          <Label htmlFor="filter-all">All Sites</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="filter-active" 
                            checked={filterStatus === 'active'}
                            onCheckedChange={() => setFilterStatus('active')}
                          />
                          <Label htmlFor="filter-active">Active Sites</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="filter-completed" 
                            checked={filterStatus === 'completed'}
                            onCheckedChange={() => setFilterStatus('completed')}
                          />
                          <Label htmlFor="filter-completed">Completed Sites</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {userRole === UserRole.ADMIN && selectedSupervisorId && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-500" />
              <span className="font-medium">
                Viewing sites for: {getSelectedSupervisorName()}
              </span>
            </div>
          )}
          
          {selectedSiteId ? (
            <SiteDetail
              site={sites.find(site => site.id === selectedSiteId) || null}
              expenses={expenses}
              advances={advances}
              fundsReceived={fundsReceived}
              invoices={invoices}
              userRole={userRole as UserRole}
              isAdminView={userRole === UserRole.ADMIN}
              onBack={() => setSelectedSiteId(null)}
              onEditSuccess={fetchSites}
              onEntrySuccess={handleEntrySuccess}
            />
          ) : (
            <div className="overflow-y-auto flex-1 pr-2">
              {sites.length > 0 ? (
                <SitesList 
                  sites={filteredSites}
                  onSelectSite={(siteId) => setSelectedSiteId(siteId)}
                />
              ) : (
                <CustomCard>
                  <div className="p-12 text-center">
                    <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Sites Added Yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {userRole === UserRole.ADMIN 
                        ? "Create sites from the admin dashboard to start tracking expenses."
                        : "No sites have been assigned to you yet."}
                    </p>
                  </div>
                </CustomCard>
              )}
            </div>
          )}

          <SiteForm
            isOpen={isSiteFormOpen}
            onClose={() => setIsSiteFormOpen(false)}
            onSubmit={handleCreateSite}
            supervisorId={userRole === UserRole.ADMIN && selectedSupervisorId 
              ? selectedSupervisorId 
              : user?.id}
          />

          {renderFinancialSummary()}

          <Dialog open={showSupervisorAdvanceForm} onOpenChange={setShowSupervisorAdvanceForm}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Advance Paid to Supervisor</DialogTitle>
                <DialogDescription>
                  Send funds to another supervisor from this site.
                </DialogDescription>
              </DialogHeader>
              <SupervisorAdvanceForm 
                onSuccess={() => {
                  setShowSupervisorAdvanceForm(false);
                  handleEntrySuccess('supervisor_advance');
                }}
                payerSiteId={selectedSiteId}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default Expenses;
