import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, CreditCard, Hash, Landmark, Receipt, Tag, Truck, User, Wallet, CircleDollarSign, FileText, BadgeCheck, Edit, Trash, Eye, Loader2 } from 'lucide-react';
import { Expense, Advance, FundsReceived, ApprovalStatus, UserRole, Invoice, PaymentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CustomCard from '@/components/ui/CustomCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deleteExpense, deleteAdvance, deleteFundsReceived, deleteInvoice, fetchSiteExpenses, fetchSiteAdvances, fetchSiteFundsReceived, fetchSiteInvoices } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import ExpenseForm from '../expenses/ExpenseForm';
import AdvanceForm from '../advances/AdvanceForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SiteDetailTransactionsProps {
  siteId: string;
  expensesCount: number;
  advancesCount: number;
  fundsReceivedCount: number;
  userRole: UserRole;
  isAdminView: boolean;
  site: any;
  supervisor: any;
  expenses?: Expense[];
  advances?: Advance[];
  fundsReceived?: FundsReceived[];
  onTransactionsUpdate?: () => void;
}

const SiteDetailTransactions: React.FC<SiteDetailTransactionsProps> = ({ 
  siteId,
  expensesCount,
  advancesCount,
  fundsReceivedCount,
  userRole,
  isAdminView,
  site,
  supervisor,
  expenses,
  advances,
  fundsReceived,
  onTransactionsUpdate,
}) => {
  const { user } = useAuth();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const [loadingStates, setLoadingStates] = useState({
    expenses: true,
    advances: true,
    fundsReceived: true,
    invoices: true
  });
  
  const [localData, setLocalData] = useState({
    expenses: expenses || [],
    advances: advances || [],
    fundsReceived: fundsReceived || [],
    invoices: [],
  });

  const [activeTab, setActiveTab] = useState('expenses');
  
  const fetchExpenses = async () => {
    try {
      if (!siteId) return;
      
      setLoadingStates(prev => ({ ...prev, expenses: true }));
      
      const data = await fetchSiteExpenses(siteId);
      
      // Transform data to match the expected format
      const transformedExpenses = data.map(expense => ({
        id: expense.id,
        date: new Date(expense.date),
        description: expense.description || '',
        category: expense.category,
        amount: Number(expense.amount),
        status: ApprovalStatus.APPROVED,
        createdAt: new Date(expense.created_at),
        createdBy: expense.created_by || '',
        supervisorId: supervisor?.id || '',
        siteId: expense.site_id,
      }));
      
      setLocalData(prev => ({ ...prev, expenses: transformedExpenses }));
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoadingStates(prev => ({ ...prev, expenses: false }));
    }
  };
  
  const fetchAdvances = async () => {
    try {
      if (!siteId) return;
      
      setLoadingStates(prev => ({ ...prev, advances: true }));
      
      const data = await fetchSiteAdvances(siteId);
      
      // Transform data to match the expected format
      const transformedAdvances = data.map(advance => ({
        id: advance.id,
        date: new Date(advance.date),
        recipientName: advance.recipient_name,
        recipientType: advance.recipient_type,
        purpose: advance.purpose,
        amount: Number(advance.amount),
        remarks: advance.remarks || '',
        status: advance.status,
        createdBy: advance.created_by || '',
        createdAt: new Date(advance.created_at),
        siteId: advance.site_id,
      }));
      
      setLocalData(prev => ({ ...prev, advances: transformedAdvances }));
    } catch (error) {
      console.error('Error fetching advances:', error);
      toast.error('Failed to load advances');
    } finally {
      setLoadingStates(prev => ({ ...prev, advances: false }));
    }
  };
  
  const fetchFundsReceived = async () => {
    try {
      if (!siteId) return;
      
      setLoadingStates(prev => ({ ...prev, fundsReceived: true }));
      
      const data = await fetchSiteFundsReceived(siteId);
      
      // Transform data to match the expected format
      const transformedFunds = data.map(fund => ({
        id: fund.id,
        date: new Date(fund.date),
        amount: Number(fund.amount),
        reference: fund.reference || undefined,
        method: fund.method || undefined,
        siteId: fund.site_id,
        createdAt: new Date(fund.created_at),
      }));
      
      setLocalData(prev => ({ ...prev, fundsReceived: transformedFunds }));
    } catch (error) {
      console.error('Error fetching funds received:', error);
      toast.error('Failed to load funds received');
    } finally {
      setLoadingStates(prev => ({ ...prev, fundsReceived: false }));
    }
  };
  
  const fetchInvoices = async () => {
    try {
      if (!siteId) return;
      
      setLoadingStates(prev => ({ ...prev, invoices: true }));
      
      const invoicesData = await fetchSiteInvoices(siteId);
      setLocalData(prev => ({ ...prev, invoices: invoicesData }));
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoadingStates(prev => ({ ...prev, invoices: false }));
    }
  };

  useEffect(() => {
    if (siteId) {
      fetchExpenses();
      fetchAdvances();
      fetchFundsReceived();
      fetchInvoices();
    }
  }, [siteId]);
  
  // Also update when external props change
  useEffect(() => {
    if (expenses) setLocalData(prev => ({ ...prev, expenses }));
    if (advances) setLocalData(prev => ({ ...prev, advances }));
    if (fundsReceived) setLocalData(prev => ({ ...prev, fundsReceived }));
  }, [expenses, advances, fundsReceived]);

  const handleDeleteExpense = async (id) => {
    if (!user?.id) {
      toast.error('User ID not available. Please reload the page.');
      return;
    }
    
    try {
      await deleteExpense(id, user.id);
      
      // Remove the expense from the local state
      setLocalData(prev => ({
        ...prev,
        expenses: prev.expenses.filter(expense => expense.id !== id)
      }));
      
      toast.success('Expense deleted successfully');
      if (onTransactionsUpdate) onTransactionsUpdate();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handleDeleteAdvance = async (id) => {
    if (!user?.id) {
      toast.error('User ID not available. Please reload the page.');
      return;
    }
    
    try {
      await deleteAdvance(id, user.id);
      
      // Remove the advance from the local state
      setLocalData(prev => ({
        ...prev,
        advances: prev.advances.filter(advance => advance.id !== id)
      }));
      
      toast.success('Advance deleted successfully');
      if (onTransactionsUpdate) onTransactionsUpdate();
    } catch (error) {
      console.error('Error deleting advance:', error);
      toast.error('Failed to delete advance: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handleDeleteFundsReceived = async (id) => {
    if (!user?.id) {
      toast.error('User ID not available. Please reload the page.');
      return;
    }
    
    try {
      await deleteFundsReceived(id, user.id);
      
      // Remove the funds received from the local state
      setLocalData(prev => ({
        ...prev,
        fundsReceived: prev.fundsReceived.filter(fund => fund.id !== id)
      }));
      
      toast.success('Funds received record deleted successfully');
      if (onTransactionsUpdate) onTransactionsUpdate();
    } catch (error) {
      console.error('Error deleting funds received:', error);
      toast.error('Failed to delete funds received: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handleDeleteInvoice = async (id) => {
    if (!user?.id) {
      toast.error('User ID not available. Please reload the page.');
      return;
    }
    
    try {
      await deleteInvoice(id, user.id);
      
      // Remove the invoice from the local state
      setLocalData(prev => ({
        ...prev,
        invoices: prev.invoices.filter(invoice => invoice.id !== id)
      }));
      
      toast.success('Invoice deleted successfully');
      if (onTransactionsUpdate) onTransactionsUpdate();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice: ' + (error.message || 'Unknown error'));
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const handleEditAdvance = (advance: Advance) => {
    setSelectedAdvance(advance);
    setIsAdvanceModalOpen(true);
  };

  const handleEditFund = (fund: FundsReceived) => {
    // Implement edit fund logic here
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setViewInvoice(invoice);
  };

  const renderExpensesTab = () => {
    
    return (
      <div className="space-y-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Expenses History</h3>
          {/* ...keep existing filter controls... */}
        </div>
        
        {loadingStates.expenses ? (
          <div className="my-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : localData.expenses.length === 0 ? (
          <CustomCard className="py-8">
            <div className="text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-medium">No Expenses</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No expenses have been recorded yet.
              </p>
            </div>
          </CustomCard>
        ) : (
          <div className="space-y-4">
            {localData.expenses.map((expense) => (
              <CustomCard key={expense.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="font-medium">{expense.description}</h4>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-1 h-3 w-3" />
                      {format(new Date(expense.date), 'dd/MM/yyyy')}
                      <div className="mx-2 h-1 w-1 rounded-full bg-muted-foreground"></div>
                      <Tag className="mr-1 h-3 w-3" />
                      {expense.category}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold mr-4">₹{Number(expense.amount).toLocaleString()}</span>
                    
                    {/* Only show edit/delete for admin users */}
                    {userRole === UserRole.ADMIN && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditExpense(expense)}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteExpense(expense.id)}>
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CustomCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAdvancesTab = () => {
    
    return (
      <div className="space-y-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Advances History</h3>
          {/* ...keep existing filter controls... */}
        </div>
        
        {loadingStates.advances ? (
          <div className="my-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : localData.advances.length === 0 ? (
          <CustomCard className="py-8">
            <div className="text-center">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-medium">No Advances</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No advances have been recorded yet.
              </p>
            </div>
          </CustomCard>
        ) : (
          <div className="space-y-4">
            {localData.advances.map((advance) => (
              <CustomCard key={advance.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="font-medium">{advance.recipientName}</h4>
                    <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-2">
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3" />
                        {format(new Date(advance.date), 'dd/MM/yyyy')}
                      </div>
                      <div className="flex items-center">
                        <User className="mr-1 h-3 w-3" />
                        {advance.recipientType}
                      </div>
                      <div className="flex items-center">
                        <Tag className="mr-1 h-3 w-3" />
                        {advance.purpose}
                      </div>
                    </div>
                    {advance.remarks && (
                      <p className="text-xs text-muted-foreground italic">
                        Note: {advance.remarks}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold mr-4">₹{Number(advance.amount).toLocaleString()}</span>
                    
                    {/* Only show edit/delete for admin users */}
                    {userRole === UserRole.ADMIN && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAdvance(advance)}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAdvance(advance.id)}>
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CustomCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFundsReceivedTab = () => {
    
    return (
      <div className="space-y-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Funds Received History</h3>
          {/* ...keep existing filter controls... */}
        </div>
        
        {loadingStates.fundsReceived ? (
          <div className="my-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : localData.fundsReceived.length === 0 ? (
          <CustomCard className="py-8">
            <div className="text-center">
              <Landmark className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-medium">No Funds Received</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No funds have been received yet.
              </p>
            </div>
          </CustomCard>
        ) : (
          <div className="space-y-4">
            {localData.fundsReceived.map((fund) => (
              <CustomCard key={fund.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="font-medium">Funds from Head Office</h4>
                    <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-2">
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3" />
                        {format(new Date(fund.date), 'dd/MM/yyyy')}
                      </div>
                      {fund.method && (
                        <div className="flex items-center">
                          <CreditCard className="mr-1 h-3 w-3" />
                          {fund.method}
                        </div>
                      )}
                      {fund.reference && (
                        <div className="flex items-center">
                          <Hash className="mr-1 h-3 w-3" />
                          Ref: {fund.reference}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold mr-4">₹{Number(fund.amount).toLocaleString()}</span>
                    
                    {/* Only show edit/delete for admin users */}
                    {userRole === UserRole.ADMIN && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFund(fund)}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteFundsReceived(fund.id)}>
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CustomCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderInvoicesTab = () => {
    
    return (
      <div className="space-y-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Invoices History</h3>
          {/* ...keep existing filter controls... */}
        </div>
        
        {loadingStates.invoices ? (
          <div className="my-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : localData.invoices.length === 0 ? (
          <CustomCard className="py-8">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-medium">No Invoices</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No invoices have been recorded yet.
              </p>
            </div>
          </CustomCard>
        ) : (
          <div className="space-y-4">
            {localData.invoices.map((invoice) => (
              <CustomCard key={invoice.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="font-medium">{invoice.partyName}</h4>
                    <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-2">
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3" />
                        {format(new Date(invoice.date), 'dd/MM/yyyy')}
                      </div>
                      <div className="flex items-center">
                        <Truck className="mr-1 h-3 w-3" />
                        {invoice.material}
                      </div>
                      <div className="flex items-center">
                        <CircleDollarSign className="mr-1 h-3 w-3" />
                        GST: {invoice.gstPercentage}%
                      </div>
                      <div className="flex items-center">
                        <BadgeCheck className="mr-1 h-3 w-3" />
                        {invoice.paymentStatus.toUpperCase()}
                      </div>
                      {invoice.approverType && (
                        <Badge variant="outline" className={invoice.approverType === 'supervisor' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}>
                          {invoice.approverType === 'supervisor' ? 'Supervisor' : 'H.O.'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold mr-4">₹{Number(invoice.netAmount).toLocaleString()}</span>
                    
                    {/* Only show edit/delete for admin users */}
                    {userRole === UserRole.ADMIN && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewInvoice(invoice)}>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteInvoice(invoice.id)}>
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CustomCard>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ... keep existing code for the render method
  // Make sure to include the tabs and content

  return (
    <div>
      <Tabs defaultValue="expenses" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="expenses">
            Expenses
            {localData.expenses.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10">
                {localData.expenses.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="advances">
            Advances
            {localData.advances.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10">
                {localData.advances.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="funds">
            Funds Received
            {localData.fundsReceived.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10">
                {localData.fundsReceived.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices
            {localData.invoices.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10">
                {localData.invoices.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expenses">
          {renderExpensesTab()}
        </TabsContent>
        
        <TabsContent value="advances">
          {renderAdvancesTab()}
        </TabsContent>
        
        <TabsContent value="funds">
          {renderFundsReceivedTab()}
        </TabsContent>
        
        <TabsContent value="invoices">
          {renderInvoicesTab()}
        </TabsContent>
      </Tabs>
      
      {/* Expense Modal */}
      <ExpenseForm
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setSelectedExpense(null);
        }}
        onSubmit={(updatedExpense) => {
          setLocalData(prev => ({
            ...prev,
            expenses: prev.expenses.map(exp =>
              exp.id === updatedExpense.id ? { ...exp, ...updatedExpense } : exp
            )
          }));
          setIsExpenseModalOpen(false);
          setSelectedExpense(null);
          if (onTransactionsUpdate) onTransactionsUpdate();
        }}
        siteId={siteId}
        defaultExpense={selectedExpense}
      />

      {/* Advance Modal */}
      <AdvanceForm
        isOpen={isAdvanceModalOpen}
        onClose={() => {
          setIsAdvanceModalOpen(false);
          setSelectedAdvance(null);
        }}
        onSubmit={(updatedAdvance) => {
          setLocalData(prev => ({
            ...prev,
            advances: prev.advances.map(adv =>
              adv.id === updatedAdvance.id ? { ...adv, ...updatedAdvance } : adv
            )
          }));
          setIsAdvanceModalOpen(false);
          setSelectedAdvance(null);
          if (onTransactionsUpdate) onTransactionsUpdate();
        }}
        siteId={siteId}
        defaultAdvance={selectedAdvance}
      />

      {/* Invoice View Modal */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              View the details of the selected invoice.
            </DialogDescription>
          </DialogHeader>
          {viewInvoice && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">
                  Party Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={viewInvoice.partyName}
                  readOnly
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="date" className="text-right">
                  Date
                </label>
                <input
                  type="text"
                  id="date"
                  value={format(new Date(viewInvoice.date), 'dd/MM/yyyy')}
                  readOnly
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="material" className="text-right">
                  Material
                </label>
                <input
                  type="text"
                  id="material"
                  value={viewInvoice.material}
                  readOnly
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="amount" className="text-right">
                  Amount
                </label>
                <input
                  type="text"
                  id="amount"
                  value={Number(viewInvoice.netAmount).toLocaleString()}
                  readOnly
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiteDetailTransactions;
