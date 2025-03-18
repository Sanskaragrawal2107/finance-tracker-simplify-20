
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  PlusCircle,
  Edit,
  Trash,
  Eye,
  Download,
  ChevronsUpDown,
  AlertTriangle,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import {
  Site,
  Expense,
  Advance,
  FundsReceived,
  Invoice,
  UserRole,
  ExpenseCategory,
  AdvancePurpose,
  ApprovalStatus,
  PaymentStatus,
  RecipientType,
  BalanceSummary,
  MaterialItem,
  BankDetails
} from '@/lib/types';
import PageTitle from '@/components/common/PageTitle';
import SiteDetail from '@/components/sites/SiteDetail';

interface DataTableProps<TData, TValue> {
  columns: any[];
  data: TData[];
  searchKey?: string;
}

// Define columns for the sites table
const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'jobName',
    header: 'Job Name',
  },
  {
    accessorKey: 'posNo',
    header: 'PO Number',
  },
  {
    accessorKey: 'location',
    header: 'Location',
  },
  {
    accessorKey: 'startDate',
    header: 'Start Date',
    cell: ({ row }: { row: any }) => {
      try {
        // Check if startDate is a valid date
        const date = row.startDate instanceof Date ? row.startDate : new Date(row.startDate);
        return format(date, 'dd/MM/yyyy');
      } catch (error) {
        console.error("Error formatting date:", error);
        return 'Invalid date';
      }
    },
  },
  {
    accessorKey: 'completionDate',
    header: 'Completion Date',
    cell: ({ row }: { row: any }) => {
      try {
        if (!row.completionDate) return 'N/A';
        const date = row.completionDate instanceof Date ? row.completionDate : new Date(row.completionDate);
        return format(date, 'dd/MM/yyyy');
      } catch (error) {
        console.error("Error formatting date:", error);
        return 'Invalid date';
      }
    },
  },
];

const SupervisorSites: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [fundsReceived, setFundsReceived] = useState<FundsReceived[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSite, setNewSite] = useState<Omit<Site, 'id' | 'createdAt' | 'isCompleted'>>({
    name: '',
    jobName: '',
    posNo: '',
    location: '',
    startDate: new Date(),
    supervisorId: user?.id || '',
    supervisor: user?.name || '',
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [siteToEdit, setSiteToEdit] = useState<Site | null>(null);
  const [editedSite, setEditedSite] = useState<Partial<Site>>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  });
  const [isFilteringByDate, setIsFilteringByDate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

  useEffect(() => {
    const fetchSites = async () => {
      setIsLoading(true);
      try {
        if (!user) {
          console.error('User not found');
          return;
        }

        console.log("Fetching sites for user ID:", user.id);

        let query = supabase
          .from('sites')
          .select('*')
          .eq('supervisor_id', user.id);

        if (isFilteringByDate && dateRange?.from && dateRange?.to) {
          query = query.gte('start_date', format(dateRange.from, 'yyyy-MM-dd'))
            .lte('start_date', format(dateRange.to, 'yyyy-MM-dd'));
        }

        const { data: sitesData, error: sitesError } = await query;

        if (sitesError) {
          console.error('Error fetching sites:', sitesError);
          toast.error(`Error fetching sites: ${sitesError.message}`);
          return;
        }

        console.log("Sites data from Supabase:", sitesData);

        if (sitesData && sitesData.length > 0) {
          const mappedSites: Site[] = sitesData.map(item => ({
            id: item.id,
            name: item.name,
            jobName: item.job_name || '',
            posNo: item.pos_no || '',
            location: item.location,
            startDate: new Date(item.start_date || new Date()),
            completionDate: item.completion_date ? new Date(item.completion_date) : undefined,
            supervisorId: item.supervisor_id || '',
            supervisor: user.name || '',
            createdAt: new Date(item.created_at || new Date()),
            isCompleted: item.is_completed || false,
            funds: item.funds || 0,
            totalFunds: item.total_funds || 0
          }));
          
          console.log("Mapped sites:", mappedSites);
          setSites(mappedSites);
        } else {
          console.log("No sites found or empty array returned");
          setSites([]);
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        toast.error(`Error fetching sites: ${error}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSites();
  }, [user, isFilteringByDate, dateRange]);

  const handleAddSite = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert([
          {
            name: newSite.name,
            job_name: newSite.jobName,
            pos_no: newSite.posNo,
            location: newSite.location,
            start_date: format(newSite.startDate, 'yyyy-MM-dd'),
            supervisor_id: user?.id
          },
        ])
        .select();

      if (error) {
        console.error('Error adding site:', error);
        toast.error(`Error adding site: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const newSiteData = data[0];
        
        const newSiteMapped: Site = { 
          id: newSiteData.id, 
          name: newSiteData.name,
          jobName: newSiteData.job_name || '',
          posNo: newSiteData.pos_no || '',
          location: newSiteData.location,
          startDate: new Date(newSiteData.start_date || new Date()),
          completionDate: newSiteData.completion_date ? new Date(newSiteData.completion_date) : undefined,
          supervisorId: newSiteData.supervisor_id || user?.id || '',
          supervisor: user?.name || '',
          createdAt: new Date(newSiteData.created_at),
          isCompleted: newSiteData.is_completed || false,
          funds: newSiteData.funds || 0,
          totalFunds: newSiteData.total_funds || 0
        };
        
        setSites(prevSites => [...prevSites, newSiteMapped]);
        toast.success('Site added successfully!');
      }
      
      setIsAddingSite(false);
      setNewSite({
        name: '',
        jobName: '',
        posNo: '',
        location: '',
        startDate: new Date(),
        supervisorId: user?.id || '',
        supervisor: user?.name || '',
      });
    } catch (error) {
      console.error('Error adding site:', error);
      toast.error(`Error adding site: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!siteToDelete) return;

    setIsDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('sites')
        .delete()
        .eq('id', siteToDelete);

      if (error) {
        console.error('Error deleting site:', error);
        toast.error(`Error deleting site: ${error.message}`);
        return;
      }

      setSites(sites.filter(site => site.id !== siteToDelete));
      setSiteToDelete(null);
      setIsDeleteDialogOpen(false);
      toast.success('Site deleted successfully!');
    } catch (error) {
      console.error('Error deleting site:', error);
      toast.error(`Error deleting site: ${error}`);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const handleEditSite = async () => {
    if (!siteToEdit) return;

    setIsEditLoading(true);
    try {
      const { error } = await supabase
        .from('sites')
        .update(editedSite)
        .eq('id', siteToEdit.id);

      if (error) {
        console.error('Error editing site:', error);
        toast.error(`Error editing site: ${error.message}`);
        return;
      }

      setSites(sites.map(site => site.id === siteToEdit.id ? { ...site, ...editedSite } : site));
      setSiteToEdit(null);
      setEditedSite({});
      setIsEditingSite(false);
      toast.success('Site updated successfully!');
    } catch (error) {
      console.error('Error editing site:', error);
      toast.error(`Error editing site: ${error}`);
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleTransactionsUpdate = useCallback(async () => {
    if (!selectedSiteId) return;

    try {
      console.log("Fetching data for site ID:", selectedSiteId);
      
      // Fetch expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
        toast.error(`Error fetching expenses: ${expensesError.message}`);
        return;
      }

      // Fetch advances
      const { data: advancesData, error: advancesError } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (advancesError) {
        console.error('Error fetching advances:', advancesError);
        toast.error(`Error fetching advances: ${advancesError.message}`);
        return;
      }

      // Fetch funds
      const { data: fundsData, error: fundsError } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (fundsError) {
        console.error('Error fetching funds:', fundsError);
        toast.error(`Error fetching funds: ${fundsError.message}`);
        return;
      }

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('site_invoices')
        .select('*')
        .eq('site_id', selectedSiteId);

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        toast.error(`Error fetching invoices: ${invoicesError.message}`);
        return;
      }

      // Map expenses data
      const mappedExpenses: Expense[] = (expensesData || []).map(item => ({
        id: item.id,
        date: new Date(item.date),
        description: item.description || '',
        category: item.category as ExpenseCategory,
        amount: item.amount,
        status: ApprovalStatus.PENDING,
        createdBy: item.created_by || '',
        createdAt: new Date(item.created_at || new Date()),
        siteId: item.site_id,
        supervisorId: item.created_by || ''
      }));

      // Map advances data
      const mappedAdvances: Advance[] = (advancesData || []).map(item => ({
        id: item.id,
        date: new Date(item.date),
        recipientId: '',
        recipientName: item.recipient_name,
        recipientType: item.recipient_type as RecipientType,
        purpose: item.purpose as AdvancePurpose,
        amount: item.amount,
        remarks: item.remarks || '',
        status: item.status as ApprovalStatus,
        createdBy: item.created_by || '',
        createdAt: new Date(item.created_at || new Date()),
        siteId: item.site_id
      }));

      // Map funds data
      const mappedFunds: FundsReceived[] = (fundsData || []).map(item => ({
        id: item.id,
        date: new Date(item.date),
        amount: item.amount,
        siteId: item.site_id,
        createdAt: new Date(item.created_at || new Date()),
        reference: item.reference || '',
        method: item.method || ''
      }));

      // Map invoices data
      const mappedInvoices: Invoice[] = (invoicesData || []).map(item => ({
        id: item.id,
        date: new Date(item.date),
        partyId: item.party_id,
        partyName: item.party_name,
        material: item.material,
        quantity: item.quantity || 0,
        rate: item.rate || 0,
        gstPercentage: item.gst_percentage || 0,
        grossAmount: item.gross_amount || 0,
        netAmount: item.net_amount || 0,
        materialItems: item.material_items ? (item.material_items as unknown as MaterialItem[]) : [],
        bankDetails: item.bank_details ? (item.bank_details as unknown as BankDetails) : {
          accountNumber: '',
          bankName: '',
          ifscCode: ''
        },
        billUrl: item.bill_url,
        invoiceImageUrl: item.bill_url,
        paymentStatus: item.payment_status as PaymentStatus,
        createdBy: item.created_by || '',
        createdAt: new Date(item.created_at || new Date()),
        approverType: item.approver_type as "ho" | "supervisor",
        siteId: item.site_id
      }));

      console.log("Mapped data:", {
        expenses: mappedExpenses,
        advances: mappedAdvances,
        funds: mappedFunds,
        invoices: mappedInvoices
      });

      setExpenses(mappedExpenses);
      setAdvances(mappedAdvances);
      setFundsReceived(mappedFunds);
      setInvoices(mappedInvoices);
    } catch (error) {
      console.error('Error updating transactions:', error);
      toast.error(`Error updating transactions: ${error}`);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (selectedSiteId) {
      handleTransactionsUpdate();
    }
  }, [selectedSiteId, handleTransactionsUpdate]);

  const handleAddExpense = async (expense: Partial<Expense>) => {
    if (!selectedSiteId || !expense.amount || !expense.category) {
      toast.error("Missing required fields for expense");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const expenseData = {
        date: expense.date ? format(new Date(expense.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        site_id: selectedSiteId,
        category: expense.category,
        description: expense.description || '',
        amount: expense.amount,
        created_by: user?.id || ''
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select();

      if (error) {
        console.error('Error adding expense:', error);
        toast.error(`Error adding expense: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const newExpense: Expense = {
          id: data[0].id,
          date: new Date(data[0].date),
          description: data[0].description || '',
          category: data[0].category as ExpenseCategory,
          amount: data[0].amount || 0,
          status: ApprovalStatus.PENDING,
          createdBy: data[0].created_by || user?.id || '',
          createdAt: new Date(data[0].created_at),
          supervisorId: user?.id || '',
          siteId: selectedSiteId
        };

        setExpenses(prevExpenses => [...prevExpenses, newExpense]);
        toast.success('Expense added successfully!');
      }
      
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error(`Error adding expense: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAdvance = async (advance: Partial<Advance>) => {
    if (!selectedSiteId || !advance.amount || !advance.recipientName || !advance.recipientType || !advance.purpose) {
      toast.error("Missing required fields for advance");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const advanceData = {
        date: advance.date ? format(new Date(advance.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        site_id: selectedSiteId,
        created_by: user?.id || '',
        recipient_name: advance.recipientName,
        recipient_type: advance.recipientType,
        purpose: advance.purpose,
        amount: advance.amount,
        remarks: advance.remarks || '',
        status: advance.status || ApprovalStatus.PENDING
      };

      const { data, error } = await supabase
        .from('advances')
        .insert(advanceData)
        .select();

      if (error) {
        console.error('Error adding advance:', error);
        toast.error(`Error adding advance: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const newAdvance: Advance = {
          id: data[0].id,
          date: new Date(data[0].date),
          recipientId: advance.recipientId || '',
          recipientName: data[0].recipient_name,
          recipientType: data[0].recipient_type as RecipientType,
          purpose: data[0].purpose as AdvancePurpose,
          amount: data[0].amount,
          remarks: data[0].remarks || '',
          status: data[0].status as ApprovalStatus,
          createdBy: data[0].created_by || user?.id || '',
          createdAt: new Date(data[0].created_at),
          siteId: selectedSiteId
        };

        setAdvances(prevAdvances => [...prevAdvances, newAdvance]);
        toast.success('Advance added successfully!');
      }
      
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding advance:', error);
      toast.error(`Error adding advance: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFunds = async (fund: Partial<FundsReceived>) => {
    if (!selectedSiteId || !fund.amount) {
      toast.error("Missing required fields for funds");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const fundData = {
        date: fund.date ? format(new Date(fund.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        site_id: selectedSiteId,
        amount: fund.amount,
        reference: fund.reference || null,
        method: fund.method || null
      };

      const { data, error } = await supabase
        .from('funds_received')
        .insert(fundData)
        .select();

      if (error) {
        console.error('Error adding funds:', error);
        toast.error(`Error adding funds: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const newFund: FundsReceived = {
          id: data[0].id,
          date: new Date(data[0].date),
          amount: data[0].amount,
          siteId: data[0].site_id,
          createdAt: new Date(data[0].created_at),
          reference: data[0].reference || undefined,
          method: data[0].method || undefined
        };

        setFundsReceived(prevFunds => [...prevFunds, newFund]);
        toast.success('Funds added successfully!');
      }
      
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding funds:', error);
      toast.error(`Error adding funds: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddInvoice = async (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    if (!selectedSiteId || !invoice.amount || !invoice.netAmount) {
      toast.error("Missing required fields for invoice");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Convert objects to JSON compatible format
      const bankDetailsJson = invoice.bankDetails as any;
      const materialItemsJson = invoice.materialItems as any;
      
      const invoiceData = {
        date: format(new Date(invoice.date), 'yyyy-MM-dd'),
        site_id: selectedSiteId,
        created_by: user?.id || '',
        party_id: invoice.partyId,
        party_name: invoice.partyName,
        material: invoice.material,
        quantity: invoice.quantity,
        rate: invoice.rate,
        gst_percentage: invoice.gstPercentage,
        gross_amount: invoice.grossAmount,
        net_amount: invoice.netAmount,
        bank_details: bankDetailsJson,
        material_items: materialItemsJson,
        payment_status: invoice.paymentStatus,
        bill_url: invoice.billUrl || null,
        approver_type: invoice.approverType
      };

      console.log("Sending invoice data to Supabase:", invoiceData);

      const { data, error } = await supabase
        .from('site_invoices')
        .insert(invoiceData)
        .select();

      if (error) {
        console.error('Error adding invoice:', error);
        toast.error(`Error adding invoice: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        const newInvoice: Invoice = {
          ...invoice,
          id: data[0].id,
          createdAt: new Date(data[0].created_at)
        };

        setInvoices(prevInvoices => [...prevInvoices, newInvoice]);
        toast.success('Invoice added successfully!');
      }
      
      handleTransactionsUpdate();
    } catch (error) {
      console.error('Error adding invoice:', error);
      toast.error(`Error adding invoice: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSite = async (siteId: string, completionDate: Date) => {
    try {
      const { error } = await supabase
        .from('sites')
        .update({
          is_completed: true,
          completion_date: format(completionDate, 'yyyy-MM-dd')
        })
        .eq('id', siteId);
      
      if (error) {
        console.error('Error completing site:', error);
        toast.error(`Error completing site: ${error.message}`);
        return;
      }
      
      setSites(
        sites.map((site) =>
          site.id === siteId ? { ...site, isCompleted: true, completionDate: completionDate } : site
        )
      );
      
      toast.success('Site marked as completed');
    } catch (error) {
      console.error('Error completing site:', error);
      toast.error(`Error completing site: ${error}`);
    }
  };

  const calculateSiteFinancials = (siteId: string): BalanceSummary => {
    const siteExpenses = expenses.filter(expense => expense.siteId === siteId);
    const siteAdvances = advances.filter(advance => advance.siteId === siteId);
    const siteFunds = fundsReceived.filter(fund => fund.siteId === siteId);
    const siteInvoices = invoices.filter(invoice => invoice.siteId === siteId);

    const totalExpenditure = siteExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalAdvances = siteAdvances.reduce((sum, advance) => sum + advance.amount, 0);
    const fundsReceivedTotal = siteFunds.reduce((sum, fund) => sum + fund.amount, 0);
    const invoicesPaid = siteInvoices.reduce((sum, invoice) => (invoice.paymentStatus === PaymentStatus.PAID ? sum + invoice.netAmount : sum), 0);
    const pendingInvoices = siteInvoices.reduce((sum, invoice) => (invoice.paymentStatus === PaymentStatus.PENDING ? sum + invoice.netAmount : sum), 0);
    const debitsToWorker = siteAdvances.reduce((sum, advance) => (advance.purpose === AdvancePurpose.OTHER ? sum + advance.amount : sum), 0);

    const totalBalance = fundsReceivedTotal - totalExpenditure - totalAdvances - invoicesPaid;

    return {
      fundsReceived: fundsReceivedTotal,
      totalExpenditure,
      totalAdvances,
      debitsToWorker,
      invoicesPaid,
      pendingInvoices,
      totalBalance,
    };
  };

  const selectedSite = sites.find(site => site.id === selectedSiteId);
  const siteExpenses = expenses.filter(expense => expense.siteId === selectedSiteId);
  const siteAdvances = advances.filter(advance => advance.siteId === selectedSiteId);
  const siteFunds = fundsReceived.filter(fund => fund.siteId === selectedSiteId);
  const siteInvoices = invoices.filter(invoice => invoice.siteId === selectedSiteId);

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <PageTitle title="Sites" subtitle="Manage your construction sites" />
        <Button onClick={() => setIsAddingSite(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </div>

      <div className="mb-4 flex items-center space-x-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "justify-start text-left font-normal",
                !dateRange?.from || !dateRange.to
                  ? "text-muted-foreground"
                  : undefined
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from && dateRange.to ? (
                <>
                  {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                  {format(dateRange.to, "dd/MM/yyyy")}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              onMonthChange={() => { }}
              numberOfMonths={2}
            />
            <div className="flex justify-end p-2">
              <Button size="sm" variant="ghost" onClick={() => {
                setDateRange({
                  from: new Date(new Date().getFullYear(), 0, 1),
                  to: new Date(),
                });
                setIsFilteringByDate(false);
              }}>Reset</Button>
              <Button size="sm" onClick={() => setIsFilteringByDate(true)}>Apply</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : selectedSiteId ? (
        selectedSite && (
          <div className="animate-fade-in">
            <SiteDetail 
              site={selectedSite} 
              onBack={() => setSelectedSiteId(null)} 
              userRole={user?.role || UserRole.VIEWER}
              expenses={siteExpenses}
              advances={siteAdvances}
              fundsReceived={siteFunds}
              invoices={siteInvoices}
              onAddExpense={handleAddExpense}
              onAddAdvance={handleAddAdvance}
              onAddFunds={handleAddFunds}
              onAddInvoice={handleAddInvoice}
              onCompleteSite={handleCompleteSite}
              balanceSummary={calculateSiteFinancials(selectedSiteId || '')}
              onUpdateTransactions={handleTransactionsUpdate}
              onTransactionsUpdate={handleTransactionsUpdate}
            />
          </div>
        )
      ) : (
        <>
          {sites.length > 0 ? (
            <div>
              <div className="bg-gray-50 p-4 rounded-md mb-4">
                <h3 className="text-md font-medium mb-2">Debug Information</h3>
                <p className="text-sm text-gray-600">Sites count: {sites.length}</p>
                <p className="text-sm text-gray-600">User ID: {user?.id}</p>
              </div>
            
              <DataTable 
                columns={columns} 
                data={sites} 
                onView={(site) => setSelectedSiteId(site.id)}
              />
            </div>
          ) : (
            <Card className="w-full">
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">No sites found. Add a new site to get started.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>
              Create a new construction site to manage expenses and track progress.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                type="text"
                id="name"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="jobName" className="text-right">
                Job Name
              </Label>
              <Input
                type="text"
                id="jobName"
                value={newSite.jobName}
                onChange={(e) => setNewSite({ ...newSite, jobName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="posNo" className="text-right">
                PO Number
              </Label>
              <Input
                type="text"
                id="posNo"
                value={newSite.posNo}
                onChange={(e) => setNewSite({ ...newSite, posNo: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                type="text"
                id="location"
                value={newSite.location}
                onChange={(e) => setNewSite({ ...newSite, location: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right">
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newSite.startDate
                        ? "text-muted-foreground"
                        : undefined
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newSite.startDate ? (
                      format(newSite.startDate, "dd/MM/yyyy")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={newSite.startDate}
                    onSelect={(date) => setNewSite({ ...newSite, startDate: date || new Date() })}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2020-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsAddingSite(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleAddSite} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the site and all
              associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSite} disabled={isDeleteLoading}>
              {isDeleteLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditingSite} onOpenChange={setIsEditingSite}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Make changes to the selected construction site.
            </DialogDescription>
          </DialogHeader>
          {siteToEdit && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  type="text"
                  id="name"
                  defaultValue={siteToEdit.name}
                  onChange={(e) => setEditedSite({ ...editedSite, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="jobName" className="text-right">
                  Job Name
                </Label>
                <Input
                  type="text"
                  id="jobName"
                  defaultValue={siteToEdit.jobName}
                  onChange={(e) => setEditedSite({ ...editedSite, jobName: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="posNo" className="text-right">
                  PO Number
                </Label>
                <Input
                  type="text"
                  id="posNo"
                  defaultValue={siteToEdit.posNo}
                  onChange={(e) => setEditedSite({ ...editedSite, posNo: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <Input
                  type="text"
                  id="location"
                  defaultValue={siteToEdit.location}
                  onChange={(e) => setEditedSite({ ...editedSite, location: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsEditingSite(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleEditSite} disabled={isEditLoading}>
              {isEditLoading ? "Updating..." : "Update Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorSites;
