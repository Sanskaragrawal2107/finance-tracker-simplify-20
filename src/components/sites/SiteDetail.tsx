
import React, { useState } from 'react';
import { Site, Expense, Advance, FundsReceived, Invoice, BalanceSummary, ExpenseCategory, UserRole } from '@/lib/types';
import { ArrowLeft, Building, PieChart, Wallet, Banknote, Calendar, RefreshCw, ChevronDown, ChevronUp, User, DollarSign, File, CheckCircle, ChevronRight, MoreVertical, FileEdit, Clock, CircleDollarSign, ArrowDownToLine, CreditCard, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import BalanceCard from '@/components/dashboard/BalanceCard';
import SiteDetailTransactions from './SiteDetailTransactions';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import AdvanceForm from '@/components/advances/AdvanceForm';
import FundsReceivedForm from '@/components/funds/FundsReceivedForm';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase, deleteTransaction, deleteAdvance, deleteFundsReceived } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

// DatePicker interface
interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
}

// Simple DatePicker implementation
const DatePicker: React.FC<DatePickerProps> = ({ date, setDate }) => {
  return (
    <input
      type="date"
      className="px-3 py-2 border rounded-md w-full"
      value={date ? date.toISOString().split('T')[0] : ''}
      onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)}
    />
  );
};

interface SiteDetailProps {
  site: Site;
  expenses?: Expense[];
  advances?: Advance[];
  fundsReceived?: FundsReceived[];
  invoices?: Invoice[];
  supervisorInvoices?: Invoice[];
  onBack: () => void;
  onAddExpense?: (expense: Partial<Expense>) => Promise<void>;
  onAddAdvance?: (advance: Partial<Advance>) => Promise<void>;
  onAddFunds?: (funds: Partial<FundsReceived>) => Promise<void>;
  onAddInvoice?: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  onCompleteSite?: (siteId: string, completionDate: Date) => Promise<void>;
  balanceSummary?: BalanceSummary;
  siteSupervisor?: { id: string; name: string } | null;
  userRole: UserRole;
}

const SiteDetail: React.FC<SiteDetailProps> = ({
  site,
  expenses = [],
  advances = [],
  fundsReceived = [],
  invoices = [],
  supervisorInvoices = [],
  onBack,
  onAddExpense,
  onAddAdvance,
  onAddFunds,
  onAddInvoice,
  onCompleteSite,
  balanceSummary,
  siteSupervisor,
  userRole
}) => {
  const { user } = useAuth();
  const [showFinancialDetails, setShowFinancialDetails] = useState(true);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState(false);
  const [isFundsFormOpen, setIsFundsFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [completionDate, setCompletionDate] = useState<Date | undefined>(new Date());
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);

  // Use empty balance summary if not provided
  const defaultBalanceSummary: BalanceSummary = {
    fundsReceived: 0,
    totalExpenditure: 0,
    totalAdvances: 0,
    debitsToWorker: 0,
    invoicesPaid: 0,
    pendingInvoices: 0,
    totalBalance: 0
  };

  const summary = balanceSummary || defaultBalanceSummary;

  const siteDuration = site.startDate && site.completionDate 
    ? Math.ceil((site.completionDate.getTime() - site.startDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const formattedStartDate = format(site.startDate, 'dd MMM yyyy');
  const formattedCompletionDate = site.completionDate ? format(site.completionDate, 'dd MMM yyyy') : 'Ongoing';

  const handleExpenseSubmit = async (newExpense: Partial<Expense>) => {
    if (!onAddExpense) return;
    
    try {
      await onAddExpense({
        ...newExpense,
        siteId: site.id,
      });
      setIsExpenseFormOpen(false);
    } catch (error) {
      console.error('Error submitting expense:', error);
    }
  };

  const handleAdvanceSubmit = async (newAdvance: Partial<Advance>) => {
    if (!onAddAdvance) return;
    
    try {
      await onAddAdvance({
        ...newAdvance,
        siteId: site.id,
      });
      setIsAdvanceFormOpen(false);
    } catch (error) {
      console.error('Error submitting advance:', error);
    }
  };

  const handleFundsSubmit = async (newFunds: Partial<FundsReceived>) => {
    if (!onAddFunds) return;
    
    try {
      await onAddFunds({
        ...newFunds,
        siteId: site.id,
      });
      setIsFundsFormOpen(false);
    } catch (error) {
      console.error('Error submitting funds:', error);
    }
  };

  const handleInvoiceSubmit = (newInvoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    if (!onAddInvoice) return;
    
    onAddInvoice({
      ...newInvoice,
      siteId: site.id,
    });
    setIsInvoiceFormOpen(false);
  };

  const handleMarkAsComplete = async () => {
    if (!completionDate || !onCompleteSite) return;
    
    try {
      await onCompleteSite(site.id, completionDate);
      setIsCompletionDialogOpen(false);
    } catch (error) {
      console.error('Error marking site as complete:', error);
    }
  };

  // Handle delete functions
  const handleDeleteExpense = async (expenseId: string) => {
    if (!user) return;
    
    try {
      await deleteTransaction(expenseId, user.id);
      toast.success('Expense deleted successfully');
      // Refresh the expenses list - update the parent component
      if (onAddExpense) {
        onAddExpense({ siteId: site.id, isRefresh: true } as Partial<Expense>);
      }
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast.error(error.message || 'Failed to delete expense');
    }
  };

  const handleDeleteAdvance = async (advanceId: string) => {
    if (!user) return;
    
    try {
      await deleteAdvance(advanceId, user.id);
      toast.success('Advance deleted successfully');
      // Refresh the advances list - update the parent component
      if (onAddAdvance) {
        onAddAdvance({ siteId: site.id, isRefresh: true } as Partial<Advance>);
      }
    } catch (error: any) {
      console.error('Error deleting advance:', error);
      toast.error(error.message || 'Failed to delete advance');
    }
  };

  const handleDeleteFunds = async (fundsId: string) => {
    if (!user) return;
    
    try {
      await deleteFundsReceived(fundsId, user.id);
      toast.success('Funds record deleted successfully');
      // Refresh the funds list - update the parent component
      if (onAddFunds) {
        onAddFunds({ siteId: site.id, isRefresh: true } as Partial<FundsReceived>);
      }
    } catch (error: any) {
      console.error('Error deleting funds:', error);
      toast.error(error.message || 'Failed to delete funds record');
    }
  };

  // Calculate category distribution for pie chart
  const getCategoryTotals = () => {
    const categoryTotals = expenses.reduce((acc, expense) => {
      const category = expense.category;
      acc[category] = (acc[category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const categoryData = getCategoryTotals();

  const isAdmin = userRole === UserRole.ADMIN;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              {site.name}
              {site.isCompleted && (
                <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                  Completed
                </Badge>
              )}
            </h1>
            <p className="text-gray-500 flex items-center mt-1">
              <Building className="h-4 w-4 mr-1" />
              Job Name: {site.jobName || 'N/A'} | POS #: {site.posNo || 'N/A'}
            </p>
          </div>
        </div>
        
        {!site.isCompleted && isAdmin && onCompleteSite && (
          <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Completed
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark Site as Completed</DialogTitle>
                <DialogDescription>
                  This will mark the site as completed and all site activities will be concluded.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Completion Date</p>
                  <DatePicker date={completionDate} setDate={setCompletionDate} />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCompletionDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleMarkAsComplete}>Complete Site</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Supervisor</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{siteSupervisor?.name || 'Unassigned'}</div>
            <p className="text-xs text-muted-foreground mt-1">Assigned supervisor for this site</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <div className="text-2xl font-bold">
                {siteDuration ? `${siteDuration} days` : 'Ongoing'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formattedStartDate} - {formattedCompletionDate}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{site.location || 'N/A'}</div>
            <p className="text-xs text-muted-foreground mt-1">Site location</p>
          </CardContent>
        </Card>
      </div>
      
      <div>
        <Button 
          variant="ghost" 
          className="flex items-center justify-between w-full p-2 mb-4"
          onClick={() => setShowFinancialDetails(!showFinancialDetails)}
        >
          <span className="font-semibold flex items-center">
            <Wallet className="h-5 w-5 mr-2" />
            Financial Summary
          </span>
          {showFinancialDetails ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </Button>
        
        {showFinancialDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <BalanceCard 
              name="Funds Received"
              value={summary.fundsReceived}
              icon={<ArrowDownToLine className="h-5 w-5" />}
              description={`Total funds received: ₹${summary.fundsReceived.toLocaleString()}`}
              trend={{
                value: fundsReceived.length > 0 ? fundsReceived.length : 0,
                label: 'transactions',
                direction: 'up'
              }}
            />
            
            <BalanceCard 
              name="Total Expenditure"
              value={summary.totalExpenditure}
              icon={<CreditCard className="h-5 w-5" />}
              description={`Total expenses: ₹${summary.totalExpenditure.toLocaleString()}`}
              trend={{
                value: expenses.length > 0 ? expenses.length : 0,
                label: 'transactions',
                direction: summary.totalExpenditure > 0 ? 'up' : 'neutral'
              }}
            />
            
            <BalanceCard 
              name="Total Advances"
              value={summary.totalAdvances}
              icon={<Banknote className="h-5 w-5" />}
              description={`Total advances: ₹${summary.totalAdvances.toLocaleString()}`}
              trend={{
                value: advances.length > 0 ? advances.length : 0,
                label: 'transactions',
                direction: summary.totalAdvances > 0 ? 'up' : 'neutral'
              }}
            />
            
            <BalanceCard 
              name="Balance Remaining"
              value={summary.totalBalance}
              icon={<CircleDollarSign className="h-5 w-5" />}
              description={`Available balance: ₹${summary.totalBalance.toLocaleString()}`}
              trend={{
                value: Math.round((summary.totalBalance / (summary.fundsReceived || 1)) * 100) || 0,
                label: '% of total funds',
                direction: summary.totalBalance > 0 ? 'up' : 'down'
              }}
            />
          </div>
        )}
      </div>
      
      {/* Expenses by Category */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expense Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Add category distribution visualization */}
                {Object.entries(expenses.reduce((acc, expense) => {
                  const category = expense.category;
                  acc[category] = (acc[category] || 0) + expense.amount;
                  return acc;
                }, {} as Record<string, number>)).map(([category, amount]) => {
                  const percentage = Math.round((amount / (summary.totalExpenditure || 1)) * 100);
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{category}</span>
                        <span className="font-medium">₹{amount.toLocaleString()} ({percentage}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Site Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Expenses</span>
                    <span className="font-medium">
                      ₹{summary.totalExpenditure.toLocaleString()} 
                      ({Math.round((summary.totalExpenditure / (summary.fundsReceived || 1)) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((summary.totalExpenditure / (summary.fundsReceived || 1)) * 100) || 0} 
                    className="h-2" 
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Advances</span>
                    <span className="font-medium">
                      ₹{summary.totalAdvances.toLocaleString()}
                      ({Math.round((summary.totalAdvances / (summary.fundsReceived || 1)) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((summary.totalAdvances / (summary.fundsReceived || 1)) * 100) || 0} 
                    className="h-2" 
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Invoices Paid</span>
                    <span className="font-medium">
                      ₹{summary.invoicesPaid.toLocaleString()}
                      ({Math.round((summary.invoicesPaid / (summary.fundsReceived || 1)) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((summary.invoicesPaid / (summary.fundsReceived || 1)) * 100) || 0} 
                    className="h-2" 
                  />
                </div>
                
                <Separator className="my-2" />
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Balance</span>
                    <span className="font-bold text-green-600">
                      ₹{summary.totalBalance.toLocaleString()}
                      ({Math.round((summary.totalBalance / (summary.fundsReceived || 1)) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((summary.totalBalance / (summary.fundsReceived || 1)) * 100) || 0} 
                    className="h-2 bg-gray-100" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="bg-white rounded-md border p-4">
        <h2 className="text-xl font-bold mb-4">Transactions</h2>
        <SiteDetailTransactions 
          expenses={expenses}
          advances={advances}
          fundsReceived={fundsReceived}
          invoices={invoices}
          userRole={userRole}
          onAddExpense={onAddExpense ? () => setIsExpenseFormOpen(true) : undefined}
          onAddAdvance={onAddAdvance ? () => setIsAdvanceFormOpen(true) : undefined}
          onAddFunds={onAddFunds ? () => setIsFundsFormOpen(true) : undefined}
          onDeleteExpense={isAdmin ? handleDeleteExpense : undefined}
          onDeleteAdvance={isAdmin ? handleDeleteAdvance : undefined}
          onDeleteFundsReceived={isAdmin ? handleDeleteFunds : undefined}
        />
      </div>
      
      {onAddExpense && (
        <ExpenseForm 
          isOpen={isExpenseFormOpen}
          onClose={() => setIsExpenseFormOpen(false)}
          onSubmit={handleExpenseSubmit}
          siteId={site.id}
        />
      )}
      
      {onAddAdvance && (
        <AdvanceForm 
          isOpen={isAdvanceFormOpen}
          onClose={() => setIsAdvanceFormOpen(false)}
          onSubmit={handleAdvanceSubmit}
          siteId={site.id}
        />
      )}
      
      {onAddFunds && (
        <FundsReceivedForm 
          isOpen={isFundsFormOpen}
          onClose={() => setIsFundsFormOpen(false)}
          onSubmit={handleFundsSubmit}
          siteId={site.id}
        />
      )}
      
      {onAddInvoice && (
        <InvoiceForm 
          isOpen={isInvoiceFormOpen}
          onClose={() => setIsInvoiceFormOpen(false)}
          onSubmit={handleInvoiceSubmit}
          siteId={site.id}
        />
      )}
    </div>
  );
};

export default SiteDetail;
