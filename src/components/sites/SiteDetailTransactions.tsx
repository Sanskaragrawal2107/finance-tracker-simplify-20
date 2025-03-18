
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Expense, Advance, FundsReceived, Invoice, UserRole, BankDetails, MaterialItem, Site, RecipientType } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import InvoiceDetails from '@/components/invoices/InvoiceDetails';
import { fetchSiteInvoices } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowUpRight, Check, Clock, User, Briefcase, UserCog, IndianRupee, Edit, Trash, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
import { supabase } from '@/integrations/supabase/client';

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
  onUpdateTransactions?: () => void;
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
  onUpdateTransactions,
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
  const [deletingAdvanceId, setDeletingAdvanceId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deletingFundId, setDeletingFundId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'expense' | 'advance' | 'fund' | null>(null);

  // Ensure advances are not duplicated by setting them only once on initial render
  useEffect(() => {
    setLocalAdvances(advances);
  }, []);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!siteId) return;
      
      setIsLoading(prev => ({ ...prev, invoices: true }));
      
      try {
        const invoicesData = await fetchSiteInvoices(siteId);
        setInvoices(invoicesData as Invoice[]);
      } catch (error) {
        console.error('Error loading invoices:', error);
      } finally {
        setIsLoading(prev => ({ ...prev, invoices: false }));
      }
    };
    
    loadInvoices();
  }, [siteId]);

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
      case RecipientType.SUPERVISOR:
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

  const handleDeleteClick = (id: string, type: 'expense' | 'advance' | 'fund') => {
    if (type === 'advance') {
      setDeletingAdvanceId(id);
    } else if (type === 'expense') {
      setDeletingExpenseId(id);
    } else if (type === 'fund') {
      setDeletingFundId(id);
    }
    setDeleteType(type);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (deleteType === 'advance' && deletingAdvanceId) {
        await supabase
          .from('advances')
          .delete()
          .eq('id', deletingAdvanceId);
        
        setLocalAdvances(prev => prev.filter(adv => adv.id !== deletingAdvanceId));
        toast.success("Advance deleted successfully");
      } 
      else if (deleteType === 'expense' && deletingExpenseId) {
        await supabase
          .from('expenses')
          .delete()
          .eq('id', deletingExpenseId);
        
        setLocalExpenses(prev => prev.filter(exp => exp.id !== deletingExpenseId));
        toast.success("Expense deleted successfully");
      }
      else if (deleteType === 'fund' && deletingFundId) {
        await supabase
          .from('funds_received')
          .delete()
          .eq('id', deletingFundId);
        
        setLocalFundsReceived(prev => prev.filter(fund => fund.id !== deletingFundId));
        toast.success("Fund record deleted successfully");
      }

      // Call the parent component's callback to update transaction data
      if (onUpdateTransactions) {
        onUpdateTransactions();
      }
    } catch (error: any) {
      console.error(`Error deleting ${deleteType}:`, error);
      toast.error(`Failed to delete ${deleteType}: ${error.message}`);
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingAdvanceId(null);
      setDeletingExpenseId(null);
      setDeletingFundId(null);
      setDeleteType(null);
    }
  };

  const renderExpensesTab = () => (
    <div className="space-y-4">
      {localExpenses.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No expenses found for this site.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localExpenses.map((expense) => (
            <Card key={expense.id} className="p-4">
              <div className="flex justify-between">
                <p>Expense: {expense.description}</p>
                {userRole === UserRole.ADMIN && (
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(expense.id, 'expense')}>
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAdvancesTab = () => (
    <div className="space-y-4">
      {localAdvances.length === 0 ? (
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
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
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
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      <button
                        className="text-primary hover:text-primary/80 transition-colors flex items-center"
                      >
                        View <ArrowUpRight className="h-3 w-3 ml-1" />
                      </button>
                      
                      {userRole === UserRole.ADMIN && (
                        <button
                          onClick={() => handleDeleteClick(advance.id, 'advance')}
                          className="text-red-500 hover:text-red-700 transition-colors flex items-center"
                        >
                          Delete <Trash className="h-3 w-3 ml-1" />
                        </button>
                      )}
                    </div>
                  </td>
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
      {localFundsReceived.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No funds received for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Reference</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Method</th>
                {userRole === UserRole.ADMIN && (
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
                  <td className="px-4 py-3 text-sm">{fund.reference || '-'}</td>
                  <td className="px-4 py-3 text-sm">{fund.method || '-'}</td>
                  {userRole === UserRole.ADMIN && (
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDeleteClick(fund.id, 'fund')}
                        className="text-red-500 hover:text-red-700 transition-colors flex items-center"
                      >
                        Delete <Trash className="h-3 w-3 ml-1" />
                      </button>
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
      ) : invoices.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No invoices found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Party</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Material</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(invoice.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{invoice.partyName}</td>
                  <td className="px-4 py-3 text-sm">{invoice.material}</td>
                  <td className="px-4 py-3 text-sm">₹{invoice.netAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.paymentStatus)}`}>
                      {getStatusIcon(invoice.paymentStatus)}
                      <span className="ml-1">{invoice.paymentStatus}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openInvoiceDetails(invoice)}
                        className="text-primary hover:text-primary/80 transition-colors flex items-center"
                      >
                        View <ArrowUpRight className="h-3 w-3 ml-1" />
                      </button>
                      
                      {userRole === UserRole.ADMIN && (
                        <button
                          className="text-red-500 hover:text-red-700 transition-colors flex items-center"
                        >
                          Delete <Trash className="h-3 w-3 ml-1" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {isDetailsOpen && selectedInvoice && (
        <InvoiceDetails
          invoice={selectedInvoice}
          isOpen={isDetailsOpen}
          onClose={closeInvoiceDetails}
        />
      )}
    </div>
  );

  return (
    <CustomCard className="mt-6">
      <Tabs defaultValue="invoices">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="invoices" className="text-sm">
            Invoices
            {invoices.length > 0 && <span className="ml-1 text-xs">({invoices.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-sm">
            Expenses
            {expensesCount > 0 && <span className="ml-1 text-xs">({expensesCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="advances" className="text-sm">
            Advances
            {advancesCount > 0 && <span className="ml-1 text-xs">({advancesCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="funds" className="text-sm">
            Funds Received
            {fundsReceivedCount > 0 && <span className="ml-1 text-xs">({fundsReceivedCount})</span>}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="invoices">{renderInvoicesTab()}</TabsContent>
        <TabsContent value="expenses">{renderExpensesTab()}</TabsContent>
        <TabsContent value="advances">{renderAdvancesTab()}</TabsContent>
        <TabsContent value="funds">{renderFundsReceivedTab()}</TabsContent>
      </Tabs>

      {/* Confirmation Dialog for Delete */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteType}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CustomCard>
  );
};

export default SiteDetailTransactions;
