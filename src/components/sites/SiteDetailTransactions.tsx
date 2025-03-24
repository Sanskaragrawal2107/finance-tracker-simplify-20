import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Expense, Advance, FundsReceived, Invoice, UserRole, BankDetails, MaterialItem, Site, RecipientType } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import InvoiceDetails from '@/components/invoices/InvoiceDetails';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowUpRight, Check, Clock, User, Briefcase, UserCog, IndianRupee, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface SiteDetailTransactionsProps {
  siteId: string;
  expensesCount?: number;
  advancesCount?: number;
  fundsReceivedCount?: number;
  userRole: UserRole;
  isAdminView?: boolean;
  site?: Site;
  supervisor?: any;
  expenses?: Expense[];
  advances?: Advance[];
  fundsReceived?: FundsReceived[];
  onTransactionsUpdate?: () => void;
  onEntrySuccess?: (entryType: string) => void;
}

const SiteDetailTransactions: React.FC<SiteDetailTransactionsProps> = ({
  siteId,
  expensesCount = 0,
  advancesCount = 0,
  fundsReceivedCount = 0,
  userRole,
  isAdminView,
  site,
  supervisor,
  expenses = [],
  advances = [],
  fundsReceived = [],
  onTransactionsUpdate,
  onEntrySuccess
}) => {
  console.info('SiteDetailTransactions props:', { 
    siteId, 
    expensesCount, 
    advancesCount, 
    fundsReceivedCount, 
    userRole, 
    isAdminView,
    site,
    supervisor
  });

  const [localExpenses, setLocalExpenses] = useState<Expense[]>(expenses);
  const [localAdvances, setLocalAdvances] = useState<Advance[]>(advances);
  const [localFundsReceived, setLocalFundsReceived] = useState<FundsReceived[]>(fundsReceived);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState({
    expenses: false,
    advances: false,
    fundsReceived: false,
    invoices: false,
  });
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const [selectedItemToDelete, setSelectedItemToDelete] = useState<{id: string, type: 'expense' | 'advance' | 'funds' | 'invoice'} | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!siteId) {
      console.error('No siteId provided to load transactions');
      return;
    }
    
    loadAllTransactions();
  }, [siteId]);

  useEffect(() => {
    console.log('Expenses prop updated with', expenses.length, 'items');
    setLocalExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    console.log('Advances prop updated with', advances.length, 'items');
    setLocalAdvances(advances);
  }, [advances]);

  useEffect(() => {
    console.log('FundsReceived prop updated with', fundsReceived.length, 'items');
    setLocalFundsReceived(fundsReceived);
  }, [fundsReceived]);

  const loadAllTransactions = async () => {
    await Promise.all([
      loadInvoices(),
      loadExpenses(),
      loadAdvances(),
      loadFundsReceived()
    ]);
  };

  const loadInvoices = async () => {
    if (!siteId) {
      console.error('No siteId provided to load invoices');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, invoices: true }));
    setError(null);
    
    try {
      console.log('Fetching invoices for site:', siteId);
      const { data, error } = await supabase
        .from('site_invoices')
        .select('*')
        .eq('site_id', siteId);
        
      if (error) throw error;
      
      if (!data) {
        setInvoices([]);
        return;
      }
      
      const transformedInvoices: Invoice[] = data.map(invoice => ({
        id: invoice.id,
        date: new Date(invoice.date),
        partyId: invoice.party_id,
        partyName: invoice.party_name,
        material: invoice.material || '',
        quantity: invoice.quantity,
        rate: invoice.rate,
        gstPercentage: invoice.gst_percentage,
        grossAmount: invoice.gross_amount,
        netAmount: invoice.net_amount,
        materialItems: invoice.material_items ? invoice.material_items as MaterialItem[] : [],
        bankDetails: invoice.bank_details || {
          accountNumber: '',
          bankName: '',
          ifscCode: '',
          email: '',
          mobile: ''
        },
        billUrl: invoice.bill_url,
        invoiceImageUrl: invoice.invoice_image_url || '',
        paymentStatus: invoice.payment_status as PaymentStatus,
        createdBy: invoice.created_by,
        createdAt: new Date(invoice.created_at),
        approverType: invoice.approver_type as "ho" | "supervisor",
        siteId: invoice.site_id,
        vendorName: invoice.vendor_name || invoice.party_name,
        invoiceNumber: invoice.invoice_number || '',
        amount: invoice.net_amount,
        status: invoice.payment_status as PaymentStatus,
        paymentBy: ''
      }));
      
      setInvoices(transformedInvoices);
      console.log('Invoices loaded successfully:', transformedInvoices.length);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setError('Failed to load invoices. Please try again.');
    } finally {
      setIsLoading(prev => ({ ...prev, invoices: false }));
    }
  };

  const loadExpenses = async () => {
    if (!siteId) {
      console.error('No siteId provided to load expenses');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, expenses: true }));
    
    try {
      console.log('Fetching expenses for site:', siteId);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', siteId);
        
      if (error) throw error;
      
      if (!data) {
        setLocalExpenses([]);
        return;
      }
      
      const transformedExpenses: Expense[] = data.map(expense => ({
        id: expense.id,
        date: new Date(expense.date),
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        status: expense.status as ApprovalStatus,
        createdBy: expense.created_by,
        createdAt: new Date(expense.created_at),
        siteId: expense.site_id,
        supervisorId: expense.supervisor_id
      }));
      
      setLocalExpenses(transformedExpenses);
      console.log('Expenses loaded successfully:', transformedExpenses.length);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, expenses: false }));
    }
  };

  const loadAdvances = async () => {
    if (!siteId) {
      console.error('No siteId provided to load advances');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, advances: true }));
    
    try {
      console.log('Fetching advances for site:', siteId);
      const { data, error } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', siteId);
        
      if (error) throw error;
      
      if (!data) {
        setLocalAdvances([]);
        return;
      }
      
      const transformedAdvances: Advance[] = data.map(advance => ({
        id: advance.id,
        date: new Date(advance.date),
        recipientId: advance.recipient_id,
        recipientName: advance.recipient_name,
        recipientType: advance.recipient_type as RecipientType,
        purpose: advance.purpose as AdvancePurpose,
        amount: advance.amount,
        remarks: advance.remarks,
        status: advance.status as ApprovalStatus,
        createdBy: advance.created_by,
        createdAt: new Date(advance.created_at),
        siteId: advance.site_id
      }));
      
      setLocalAdvances(transformedAdvances);
      console.log('Advances loaded successfully:', transformedAdvances.length);
    } catch (error) {
      console.error('Error loading advances:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, advances: false }));
    }
  };

  const loadFundsReceived = async () => {
    if (!siteId) {
      console.error('No siteId provided to load funds received');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, fundsReceived: true }));
    
    try {
      console.log('Fetching funds received for site:', siteId);
      const { data, error } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', siteId);
        
      if (error) throw error;
      
      if (!data) {
        setLocalFundsReceived([]);
        return;
      }
      
      const transformedFunds: FundsReceived[] = data.map(fund => ({
        id: fund.id,
        date: new Date(fund.date),
        amount: fund.amount,
        siteId: fund.site_id,
        createdAt: new Date(fund.created_at),
        reference: fund.reference,
        method: fund.method
      }));
      
      setLocalFundsReceived(transformedFunds);
      console.log('Funds received loaded successfully:', transformedFunds.length);
    } catch (error) {
      console.error('Error loading funds received:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, fundsReceived: false }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-orange-600 bg-orange-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <Check className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRecipientTypeIcon = (type: RecipientType) => {
    switch (type) {
      case RecipientType.WORKER:
        return <User className="h-4 w-4 mr-1 text-muted-foreground" />;
      case RecipientType.SUBCONTRACTOR:
        return <Briefcase className="h-4 w-4 mr-1 text-muted-foreground" />;
      case "supervisor" as RecipientType:
        return <UserCog className="h-4 w-4 mr-1 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const openInvoiceDetails = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsOpen(true);
  };

  const closeInvoiceDetails = () => {
    setIsDetailsOpen(false);
    setSelectedInvoice(null);
  };

  const handleDelete = async () => {
    if (!selectedItemToDelete || !user?.id) {
      console.error('Cannot delete: missing item or user ID');
      return;
    }
    
    try {
      setIsLoading(prev => ({ ...prev, [selectedItemToDelete.type + 's']: true }));
      
      console.log(`Starting deletion process for ${selectedItemToDelete.type} with ID: ${selectedItemToDelete.id}`);
      let success = false;
      
      switch (selectedItemToDelete.type) {
        case 'expense':
          console.log(`Deleting expense ${selectedItemToDelete.id}`);
          const { error: expenseError } = await supabase
            .from('expenses')
            .delete()
            .eq('id', selectedItemToDelete.id);
            
          if (expenseError) throw expenseError;
          
          setLocalExpenses(prevExpenses => 
            prevExpenses.filter(expense => expense.id !== selectedItemToDelete.id)
          );
          success = true;
          break;
          
        case 'advance':
          console.log(`Deleting advance ${selectedItemToDelete.id}`);
          const { error: advanceError } = await supabase
            .from('advances')
            .delete()
            .eq('id', selectedItemToDelete.id);
            
          if (advanceError) throw advanceError;
          
          setLocalAdvances(prevAdvances => 
            prevAdvances.filter(advance => advance.id !== selectedItemToDelete.id)
          );
          success = true;
          break;
          
        case 'funds':
          console.log(`Deleting funds received ${selectedItemToDelete.id}`);
          const { error: fundsError } = await supabase
            .from('funds_received')
            .delete()
            .eq('id', selectedItemToDelete.id);
            
          if (fundsError) throw fundsError;
          
          setLocalFundsReceived(prevFunds => 
            prevFunds.filter(fund => fund.id !== selectedItemToDelete.id)
          );
          success = true;
          break;
          
        case 'invoice':
          console.log(`Deleting invoice ${selectedItemToDelete.id}`);
          const { error: invoiceError } = await supabase
            .from('site_invoices')
            .delete()
            .eq('id', selectedItemToDelete.id);
            
          if (invoiceError) throw invoiceError;
          
          setInvoices(prevInvoices => 
            prevInvoices.filter(invoice => invoice.id !== selectedItemToDelete.id)
          );
          success = true;
          break;
      }
      
      if (success) {
        toast.success('Transaction deleted successfully');
        if (onTransactionsUpdate) {
          console.log('Calling onTransactionsUpdate to refresh parent component data');
          onTransactionsUpdate();
        }
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete transaction');
    } finally {
      setIsLoading(prev => ({ ...prev, [selectedItemToDelete.type + 's']: false }));
      setIsDeleteDialogOpen(false);
      setSelectedItemToDelete(null);
    }
  };

  const confirmDelete = (id: string, type: 'expense' | 'advance' | 'funds' | 'invoice') => {
    setSelectedItemToDelete({ id, type });
    setIsDeleteDialogOpen(true);
  };

  const handleEdit = (id: string, type: 'expense' | 'advance' | 'funds' | 'invoice') => {
    console.log(`Edit ${type} with ID: ${id}`);
    toast.info(`Edit functionality for ${type} will be implemented soon`);
  };

  const renderExpensesTab = () => (
    <div className="space-y-4">
      {isLoading.expenses ? (
        <p className="text-center text-muted-foreground py-8">Loading expenses...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : localExpenses.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No expenses found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                {canEditDelete && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {localExpenses.map((expense) => (
                <tr key={expense.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(expense.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {expense.description}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">
                      {expense.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {expense.amount.toLocaleString()}
                    </div>
                  </td>
                  {canEditDelete && (
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                          onClick={() => handleEdit(expense.id, 'expense')}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 transition-colors flex items-center"
                          onClick={() => confirmDelete(expense.id, 'expense')}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const canEditDelete = userRole === UserRole.ADMIN;

  const renderAdvancesTab = () => (
    <div className="space-y-4">
      {isLoading.advances ? (
        <p className="text-center text-muted-foreground py-8">Loading advances...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : localAdvances.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No advances found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Recipient</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Purpose</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                {canEditDelete && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {localAdvances.map((advance) => (
                <tr key={advance.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(advance.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      {getRecipientTypeIcon(advance.recipientType)}
                      {advance.recipientName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">
                      {advance.recipientType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="capitalize">{advance.purpose.replace('_', ' ')}</span>
                    {advance.remarks && advance.remarks.length > 0 && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        Note: {advance.remarks}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {advance.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(advance.status)}`}>
                      {getStatusIcon(advance.status)}
                      <span className="ml-1 capitalize">{advance.status}</span>
                    </div>
                  </td>
                  {canEditDelete && (
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                          onClick={() => handleEdit(advance.id, 'advance')}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 transition-colors flex items-center"
                          onClick={() => confirmDelete(advance.id, 'advance')}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderFundsReceivedTab = () => (
    <div className="space-y-4">
      {isLoading.fundsReceived ? (
        <p className="text-center text-muted-foreground py-8">Loading funds received...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : localFundsReceived.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No funds received for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Method</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Reference</th>
                {canEditDelete && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {localFundsReceived.map((fund) => (
                <tr key={fund.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(fund.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {fund.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {fund.method || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {fund.reference || 'N/A'}
                  </td>
                  {canEditDelete && (
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                          onClick={() => handleEdit(fund.id, 'funds')}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 transition-colors flex items-center"
                          onClick={() => confirmDelete(fund.id, 'funds')}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderInvoicesTab = () => (
    <div className="space-y-4">
      {isLoading.invoices ? (
        <p className="text-center text-muted-foreground py-8">Loading invoices...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : invoices.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No invoices found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Vendor</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                {canEditDelete && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(invoice.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {invoice.invoiceNumber || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {invoice.vendorName || invoice.partyName}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {(invoice.amount || invoice.netAmount)?.toLocaleString() || '0'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status || invoice.paymentStatus)}`}>
                      {getStatusIcon(invoice.status || invoice.paymentStatus)}
                      <span className="ml-1 capitalize">{invoice.status || invoice.paymentStatus}</span>
                    </div>
                  </td>
                  {canEditDelete && (
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button
                          className="text-primary hover:text-primary/80 transition-colors flex items-center"
                          onClick={() => openInvoiceDetails(invoice)}
                        >
                          View <ArrowUpRight className="h-3 w-3 ml-1" />
                        </button>
                        <button 
                          className="text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                          onClick={() => handleEdit(invoice.id, 'invoice')}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-800 transition-colors flex items-center"
                          onClick={() => confirmDelete(invoice.id, 'invoice')}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <>
      <CustomCard className="mb-6">
        <Tabs defaultValue="expenses">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="expenses">
              Expenses {localExpenses.length > 0 && `(${localExpenses.length})`}
            </TabsTrigger>
            <TabsTrigger value="advances">
              Advances {localAdvances.length > 0 && `(${localAdvances.length})`}
            </TabsTrigger>
            <TabsTrigger value="fundsReceived">
              Funds Received {localFundsReceived.length > 0 && `(${localFundsReceived.length})`}
            </TabsTrigger>
            <TabsTrigger value="invoices">
              Invoices {invoices.length > 0 && `(${invoices.length})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="expenses" className="pt-4">
            {renderExpensesTab()}
          </TabsContent>
          <TabsContent value="advances" className="pt-4">
            {renderAdvancesTab()}
          </TabsContent>
          <TabsContent value="fundsReceived" className="pt-4">
            {renderFundsReceivedTab()}
          </TabsContent>
          <TabsContent value="invoices" className="pt-4">
            {renderInvoicesTab()}
          </TabsContent>
        </Tabs>
      </CustomCard>

      {selectedInvoice && (
        <InvoiceDetails
          invoice={selectedInvoice}
          isOpen={isDetailsOpen}
          onClose={closeInvoiceDetails}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {selectedItemToDelete?.type}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SiteDetailTransactions;
