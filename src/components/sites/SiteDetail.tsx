
import React, { useState } from 'react';
import { Site, Expense, Advance, FundsReceived, Invoice, Balance, BalanceSummary, ExpenseCategory, UserRole } from '@/lib/types';
import { ArrowLeft, Building, PieChart, Wallet, Banknote, Calendar, RefreshCw, ChevronDown, ChevronUp, User, DollarSign, File, CheckCircle, ChevronRight, MoreVertical, FileEdit, Clock, CircleDollarSign, ArrowDownToLine, CreditCard, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { BarChart } from '@tremor/react';
import BalanceCard from '@/components/dashboard/BalanceCard';
import SiteDetailTransactions from './SiteDetailTransactions';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import AdvanceForm from '@/components/advances/AdvanceForm';
import FundsReceivedForm from '@/components/funds/FundsReceivedForm';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { deleteTransaction, deleteAdvance, deleteFundsReceived } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface SiteDetailProps {
  site: Site;
  expenses: Expense[];
  advances: Advance[];
  fundsReceived: FundsReceived[];
  invoices: Invoice[];
  supervisorInvoices: Invoice[];
  onBack: () => void;
  onAddExpense: (expense: Partial<Expense>) => Promise<void>;
  onAddAdvance: (advance: Partial<Advance>) => Promise<void>;
  onAddFunds: (funds: Partial<FundsReceived>) => Promise<void>;
  onAddInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  onCompleteSite: (siteId: string, completionDate: Date) => Promise<void>;
  balanceSummary: BalanceSummary;
  siteSupervisor: { id: string; name: string } | null;
  userRole: UserRole;
}

const SiteDetail: React.FC<SiteDetailProps> = ({
  site,
  expenses,
  advances,
  fundsReceived,
  invoices,
  supervisorInvoices,
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

  const siteDuration = site.startDate && site.completionDate 
    ? Math.ceil((site.completionDate.getTime() - site.startDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const formattedStartDate = format(site.startDate, 'dd MMM yyyy');
  const formattedCompletionDate = site.completionDate ? format(site.completionDate, 'dd MMM yyyy') : 'Ongoing';

  const handleExpenseSubmit = async (newExpense: Partial<Expense>) => {
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
    onAddInvoice({
      ...newInvoice,
      siteId: site.id,
    });
    setIsInvoiceFormOpen(false);
  };

  const handleMarkAsComplete = async () => {
    if (!completionDate) return;
    
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
      onAddExpense({ siteId: site.id, isRefresh: true } as Partial<Expense>);
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
      onAddAdvance({ siteId: site.id, isRefresh: true } as Partial<Advance>);
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
      onAddFunds({ siteId: site.id, isRefresh: true } as Partial<FundsReceived>);
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
        
        {!site.isCompleted && isAdmin && (
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
              title="Funds Received"
              amount={balanceSummary.fundsReceived}
              icon={<ArrowDownToLine className="h-5 w-5" />}
              description={`Total funds received: ₹${balanceSummary.fundsReceived.toLocaleString()}`}
              trend={{
                value: fundsReceived.length > 0 ? fundsReceived.length : 0,
                label: 'transactions',
                direction: 'up'
              }}
            />
            
            <BalanceCard 
              title="Total Expenditure"
              amount={balanceSummary.totalExpenditure}
              icon={<CreditCard className="h-5 w-5" />}
              description={`Total expenses: ₹${balanceSummary.totalExpenditure.toLocaleString()}`}
              trend={{
                value: expenses.length > 0 ? expenses.length : 0,
                label: 'transactions',
                direction: balanceSummary.totalExpenditure > 0 ? 'up' : 'neutral'
              }}
            />
            
            <BalanceCard 
              title="Total Advances"
              amount={balanceSummary.totalAdvances}
              icon={<Banknote className="h-5 w-5" />}
              description={`Total advances: ₹${balanceSummary.totalAdvances.toLocaleString()}`}
              trend={{
                value: advances.length > 0 ? advances.length : 0,
                label: 'transactions',
                direction: balanceSummary.totalAdvances > 0 ? 'up' : 'neutral'
              }}
            />
            
            <BalanceCard 
              title="Balance Remaining"
              amount={balanceSummary.totalBalance}
              icon={<CircleDollarSign className="h-5 w-5" />}
              description={`Available balance: ₹${balanceSummary.totalBalance.toLocaleString()}`}
              trend={{
                value: Math.round((balanceSummary.totalBalance / balanceSummary.fundsReceived) * 100) || 0,
                label: '% of total funds',
                direction: balanceSummary.totalBalance > 0 ? 'up' : 'down'
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
                  const percentage = Math.round((amount / balanceSummary.totalExpenditure) * 100);
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
                      ₹{balanceSummary.totalExpenditure.toLocaleString()} 
                      ({Math.round((balanceSummary.totalExpenditure / balanceSummary.fundsReceived) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((balanceSummary.totalExpenditure / balanceSummary.fundsReceived) * 100) || 0} 
                    className="h-2" 
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Advances</span>
                    <span className="font-medium">
                      ₹{balanceSummary.totalAdvances.toLocaleString()}
                      ({Math.round((balanceSummary.totalAdvances / balanceSummary.fundsReceived) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((balanceSummary.totalAdvances / balanceSummary.fundsReceived) * 100) || 0} 
                    className="h-2" 
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Invoices Paid</span>
                    <span className="font-medium">
                      ₹{balanceSummary.invoicesPaid.toLocaleString()}
                      ({Math.round((balanceSummary.invoicesPaid / balanceSummary.fundsReceived) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((balanceSummary.invoicesPaid / balanceSummary.fundsReceived) * 100) || 0} 
                    className="h-2" 
                  />
                </div>
                
                <Separator className="my-2" />
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Balance</span>
                    <span className="font-bold text-green-600">
                      ₹{balanceSummary.totalBalance.toLocaleString()}
                      ({Math.round((balanceSummary.totalBalance / balanceSummary.fundsReceived) * 100) || 0}%)
                    </span>
                  </div>
                  <Progress 
                    value={Math.round((balanceSummary.totalBalance / balanceSummary.fundsReceived) * 100) || 0} 
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
          onAddExpense={() => setIsExpenseFormOpen(true)}
          onAddAdvance={() => setIsAdvanceFormOpen(true)}
          onAddFunds={() => setIsFundsFormOpen(true)}
          onDeleteExpense={isAdmin ? handleDeleteExpense : undefined}
          onDeleteAdvance={isAdmin ? handleDeleteAdvance : undefined}
          onDeleteFundsReceived={isAdmin ? handleDeleteFunds : undefined}
        />
      </div>
      
      <ExpenseForm 
        isOpen={isExpenseFormOpen}
        onClose={() => setIsExpenseFormOpen(false)}
        onSubmit={handleExpenseSubmit}
        siteId={site.id}
      />
      
      <AdvanceForm 
        isOpen={isAdvanceFormOpen}
        onClose={() => setIsAdvanceFormOpen(false)}
        onSubmit={handleAdvanceSubmit}
        siteId={site.id}
      />
      
      <FundsReceivedForm 
        isOpen={isFundsFormOpen}
        onClose={() => setIsFundsFormOpen(false)}
        onSubmit={handleFundsSubmit}
        siteId={site.id}
      />
      
      <InvoiceForm 
        isOpen={isInvoiceFormOpen}
        onClose={() => setIsInvoiceFormOpen(false)}
        onSubmit={handleInvoiceSubmit}
        siteId={site.id}
      />
    </div>
  );
};

export default SiteDetail;
