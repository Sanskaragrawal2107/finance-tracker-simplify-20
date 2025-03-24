import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Building2, Calendar, Check, Edit, ExternalLink, User, Plus } from 'lucide-react';
import { Expense, Site, Advance, FundsReceived, Invoice, BalanceSummary, AdvancePurpose, ApprovalStatus, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomCard from '@/components/ui/CustomCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SiteDetailTransactions from './SiteDetailTransactions';
import { useIsMobile } from '@/hooks/use-mobile';
import BalanceCard from '../dashboard/BalanceCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import AdvanceForm from '@/components/advances/AdvanceForm';
import FundsReceivedForm from '@/components/funds/FundsReceivedForm';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import SupervisorTransactionForm from '@/components/transactions/SupervisorTransactionForm';
import SupervisorTransactionHistory from '@/components/transactions/SupervisorTransactionHistory';

interface SiteDetailProps {
  site: Site;
  expenses?: Expense[];
  advances?: Advance[];
  fundsReceived?: FundsReceived[];
  invoices?: Invoice[];
  supervisorInvoices?: Invoice[];
  balanceSummary?: BalanceSummary;
  siteSupervisor?: { id: string; name: string } | null;
  onBack?: () => void;
  onAddExpense?: (expense: Partial<Expense>) => void;
  onAddAdvance?: (advance: Partial<Advance>) => void;
  onAddFunds?: (fund: Partial<FundsReceived>) => void;
  onAddInvoice?: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  onCompleteSite?: (siteId: string, completionDate: Date) => void;
  supervisor?: any;
  isAdminView?: boolean;
  userRole: UserRole;
  onEditSuccess?: () => void;
  onEntrySuccess?: (entryType: string) => void;
}

const DEBIT_ADVANCE_PURPOSES = [
  AdvancePurpose.SAFETY_SHOES,
  AdvancePurpose.TOOLS,
  AdvancePurpose.OTHER
];

const SiteDetail: React.FC<SiteDetailProps> = ({
  site,
  expenses = [],
  advances = [],
  fundsReceived = [],
  invoices = [],
  supervisorInvoices = [],
  balanceSummary,
  siteSupervisor,
  onBack,
  onAddExpense,
  onAddAdvance,
  onAddFunds,
  onAddInvoice,
  onCompleteSite,
  supervisor,
  isAdminView,
  userRole,
  onEditSuccess,
  onEntrySuccess
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const isMobile = useIsMobile();
  
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState(false);
  const [isFundsFormOpen, setIsFundsFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [isAdvancePaidFormOpen, setIsAdvancePaidFormOpen] = useState(false);
  const [isFundsReceivedFormOpen, setIsFundsReceivedFormOpen] = useState(false);

  const defaultBalanceSummary: BalanceSummary = {
    fundsReceived: 0,
    fundsReceivedFromSupervisor: 0,
    totalExpenditure: 0,
    totalAdvances: 0,
    debitsToWorker: 0,
    invoicesPaid: 0,
    pendingInvoices: 0,
    advancePaidToSupervisor: 0,
    totalBalance: 0
  };

  const siteSummary = balanceSummary || defaultBalanceSummary;

  const totalAdvances = advances.reduce((sum, advance) => {
    if (!DEBIT_ADVANCE_PURPOSES.includes(advance.purpose)) {
      return sum + (Number(advance.amount) || 0);
    }
    return sum;
  }, 0);

  const totalDebitToWorker = advances.reduce((sum, advance) => {
    if (DEBIT_ADVANCE_PURPOSES.includes(advance.purpose)) {
      return sum + (Number(advance.amount) || 0);
    }
    return sum;
  }, 0);

  const totalExpenses = siteSummary.totalExpenditure;
  const totalFundsReceived = siteSummary.fundsReceived;
  const totalInvoices = siteSummary.invoicesPaid || 0;

  const currentBalance = siteSummary.totalBalance;

  const handleMarkComplete = async () => {
    try {
      const completionDate = new Date();
      
      const { error } = await supabase
        .from('sites')
        .update({
          is_completed: true,
          completion_date: completionDate.toISOString()
        })
        .eq('id', site.id);
        
      if (error) {
        console.error('Error marking site as complete:', error);
        toast.error('Failed to mark site as complete: ' + error.message);
        return;
      }
      
      toast.success('Site marked as complete successfully');
      if (onCompleteSite) {
        onCompleteSite(site.id, completionDate);
      }
    } catch (error: any) {
      console.error('Error marking site as complete:', error);
      toast.error('Failed to mark site as complete: ' + error.message);
    }
  };

  const handleAdvancePaidSubmit = () => {
    if (onEntrySuccess) {
      onEntrySuccess('transactions');
    }
  };

  const handleFundsReceivedSubmit = () => {
    if (onEntrySuccess) {
      onEntrySuccess('transactions');
    }
  };

  return (
    <div className="space-y-4">
      {/* Site header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold">{site.name}</h2>
          {site.isCompleted ? (
            <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">Completed</Badge>
          ) : (
            <Badge variant="default" className="ml-2">Active</Badge>
          )}
        </div>
        
        {!site.isCompleted && userRole === UserRole.ADMIN && (
          <Button
            variant="outline" 
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
          >
            <Check className="mr-2 h-4 w-4" />
            Mark Complete
          </Button>
        )}
      </div>
      
      {/* Site info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CustomCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job Name</p>
              <p className="font-medium">{site.jobName || 'N/A'}</p>
            </div>
          </div>
        </CustomCard>
        
        <CustomCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">{format(site.startDate, 'dd MMM yyyy')}</p>
            </div>
          </div>
        </CustomCard>
        
        <CustomCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <ExternalLink className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">P.O.S. No.</p>
              <p className="font-medium">{site.posNo || 'N/A'}</p>
            </div>
          </div>
        </CustomCard>
        
        <CustomCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supervisor</p>
              <p className="font-medium">{site.supervisor || 'Not Assigned'}</p>
            </div>
          </div>
        </CustomCard>
      </div>
      
      {/* Tabs and action buttons */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full md:w-auto"
        >
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {!site.isCompleted && (
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              onClick={() => setIsExpenseFormOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Expense
            </Button>
            
            <Button 
              size="sm" 
              onClick={() => setIsAdvanceFormOpen(true)}
              variant="secondary"
            >
              <Plus className="h-4 w-4 mr-1" />
              Advance
            </Button>
            
            <Button 
              size="sm" 
              onClick={() => setIsFundsFormOpen(true)}
              variant="default"
            >
              <Plus className="h-4 w-4 mr-1" />
              Funds Received
            </Button>
            
            <Button 
              size="sm" 
              onClick={() => setIsInvoiceFormOpen(true)}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-1" />
              Invoice
            </Button>

            <Button 
              size="sm" 
              onClick={() => setIsAdvancePaidFormOpen(true)}
              variant="secondary"
            >
              <Plus className="h-4 w-4 mr-1" />
              Advance Paid to Supervisor
            </Button>
            
            <Button 
              size="sm" 
              onClick={() => setIsFundsReceivedFormOpen(true)}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-1" />
              Funds Received from Supervisor
            </Button>
          </div>
        )}
      </div>
      
      {/* Tab content */}
      <div className="mt-4">
        <TabsContent value="summary" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <BalanceCard 
              balanceData={siteSummary}
              className="lg:col-span-2 row-span-2"
              siteId={site.id}
            />
            
            <SupervisorTransactionHistory 
              siteId={site.id}
              className="lg:col-span-1"
            />
          </div>
        </TabsContent>
        
        <TabsContent value="transactions" className="mt-0 space-y-4">
          <SiteDetailTransactions 
            site={site}
            expenses={expenses}
            advances={advances}
            fundsReceived={fundsReceived}
            onEntrySuccess={onEntrySuccess}
            userRole={userRole}
            siteId={site.id}
          />
        </TabsContent>
      </div>
      
      {/* Forms */}
      <ExpenseForm
        isOpen={isExpenseFormOpen}
        onClose={() => setIsExpenseFormOpen(false)}
        onSubmit={(expense) => {
          if (onAddExpense) onAddExpense(expense);
          if (onEntrySuccess) onEntrySuccess('expense');
        }}
        siteId={site.id}
      />
      
      <AdvanceForm
        isOpen={isAdvanceFormOpen}
        onClose={() => setIsAdvanceFormOpen(false)}
        onSubmit={(advance) => {
          if (onAddAdvance) onAddAdvance(advance);
          if (onEntrySuccess) onEntrySuccess('advance');
        }}
        siteId={site.id}
      />
      
      <FundsReceivedForm
        isOpen={isFundsFormOpen}
        onClose={() => setIsFundsFormOpen(false)}
        onSubmit={(fund) => {
          if (onAddFunds) onAddFunds(fund);
          if (onEntrySuccess) onEntrySuccess('funds');
        }}
        siteId={site.id}
      />
      
      <InvoiceForm
        isOpen={isInvoiceFormOpen}
        onClose={() => setIsInvoiceFormOpen(false)}
        onSubmit={(invoice) => {
          if (onAddInvoice) onAddInvoice(invoice);
          if (onEntrySuccess) onEntrySuccess('invoice');
        }}
        siteId={site.id}
      />

      <SupervisorTransactionForm
        isOpen={isAdvancePaidFormOpen}
        onClose={() => setIsAdvancePaidFormOpen(false)}
        onSubmit={handleAdvancePaidSubmit}
        transactionType="advance_paid"
        siteId={site.id}
      />

      <SupervisorTransactionForm
        isOpen={isFundsReceivedFormOpen}
        onClose={() => setIsFundsReceivedFormOpen(false)}
        onSubmit={handleFundsReceivedSubmit}
        transactionType="funds_received"
        siteId={site.id}
      />
    </div>
  );
};

export default SiteDetail;
