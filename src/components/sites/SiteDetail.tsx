import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Building2, Calendar, Check, Edit, ExternalLink, User } from 'lucide-react';
import { Expense, Site, Advance, FundsReceived, Invoice, BalanceSummary, AdvancePurpose, ApprovalStatus } from '@/lib/types';
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

interface SiteDetailProps {
  site: Site;
  expenses: Expense[];
  advances: Advance[];
  fundsReceived: FundsReceived[];
  invoices: Invoice[];
  supervisorInvoices?: Invoice[];
  balanceSummary: BalanceSummary;
  siteSupervisor?: { id: string; name: string } | null;
  onBack: () => void;
  onAddExpense?: (expense: Partial<Expense>) => void;
  onAddAdvance?: (advance: Partial<Advance>) => void;
  onAddFunds?: (fund: Partial<FundsReceived>) => void;
  onAddInvoice?: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  onCompleteSite?: (siteId: string, completionDate: Date) => void;
  supervisor?: any;
  isAdminView?: boolean;
}

// Define DEBIT_ADVANCE_PURPOSES here for consistency
const DEBIT_ADVANCE_PURPOSES = [
  AdvancePurpose.SAFETY_SHOES,
  AdvancePurpose.TOOLS,
  AdvancePurpose.OTHER
];

const SiteDetail: React.FC<SiteDetailProps> = ({
  site,
  expenses,
  advances,
  fundsReceived,
  invoices,
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
  isAdminView
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const isMobile = useIsMobile();

  // Calculate these from the passed balanceSummary to ensure consistent calculation
  const totalExpenses = balanceSummary.totalExpenditure;
  const totalAdvances = balanceSummary.totalAdvances || 0;
  const totalDebitToWorker = balanceSummary.debitsToWorker || 0;
  const totalFundsReceived = balanceSummary.fundsReceived;
  const totalInvoices = balanceSummary.invoicesPaid || 0;
  
  const handleMarkComplete = async () => {
    try {
      const completionDate = new Date();
      
      // Update the site in Supabase
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
      console.error('Error in handleMarkComplete:', error);
      toast.error('Failed to mark site as complete: ' + error.message);
    } finally {
      setIsMarkingComplete(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Site Name</span>
            <h1 className="text-xl md:text-2xl font-bold">{site.name}</h1>
          </div>
          {site.isCompleted ? (
            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
              Completed
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              Active
            </Badge>
          )}
        </div>
        
        {!site.isCompleted && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-green-600 border-green-200 hover:bg-green-50 w-full sm:w-auto mt-2 sm:mt-0" 
            onClick={() => setIsMarkingComplete(true)}
          >
            <Check className="mr-2 h-4 w-4" />
            Mark as Complete
          </Button>
        )}

        {isMarkingComplete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Mark Site as Complete?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Are you sure you want to mark this site as complete? This action cannot be undone.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsMarkingComplete(false)}>Cancel</Button>
                  <Button onClick={handleMarkComplete}>Confirm</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CustomCard className="md:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Job Name</h3>
              <p className="text-lg font-semibold mt-1">{site.jobName}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">PO Number</h3>
              <p className="text-lg font-semibold mt-1">{site.posNo}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Start Date</h3>
              <p className="text-lg font-semibold mt-1">{format(site.startDate, 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {site.isCompleted ? 'Completion Date' : 'Est. Completion'}
              </h3>
              <p className="text-lg font-semibold mt-1">
                {site.completionDate ? format(site.completionDate, 'dd/MM/yyyy') : 'Not specified'}
              </p>
            </div>
            {siteSupervisor && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Supervisor</h3>
                <p className="text-lg font-semibold mt-1 flex items-center">
                  <User className="h-4 w-4 mr-1 text-muted-foreground" />
                  {siteSupervisor.name}
                </p>
              </div>
            )}
          </div>
        </CustomCard>

        <BalanceCard balanceData={balanceSummary} siteId={site.id} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid grid-cols-2 ${isMobile ? 'w-full' : 'max-w-md'} mb-4`}>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomCard>
              <h3 className="text-lg font-medium mb-4">Quick Overview</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Expenses</span>
                  <span className="font-medium">₹{totalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Advances</span>
                  <span className="font-medium">₹{totalAdvances.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Invoices</span>
                  <span className="font-medium">₹{totalInvoices.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Debits to Worker</span>
                  <span className="font-medium">₹{totalDebitToWorker.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Funds Received</span>
                  <span className="font-medium">₹{totalFundsReceived.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center font-medium">
                    <span>Current Balance</span>
                    <span className={balanceSummary.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ₹{balanceSummary.totalBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CustomCard>
            
            <CustomCard>
              <h3 className="text-lg font-medium mb-4">Activity Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Expense Entries</span>
                  <span className="font-medium">{expenses.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Advance Entries</span>
                  <span className="font-medium">{advances.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Invoice Entries</span>
                  <span className="font-medium">{invoices.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Funds Received Entries</span>
                  <span className="font-medium">{fundsReceived.length}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Site Status</span>
                    <Badge variant="outline" className={site.isCompleted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                      {site.isCompleted ? 'Completed' : 'Active'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CustomCard>
          </div>
        </TabsContent>
        
        <TabsContent value="transactions">
          <SiteDetailTransactions 
            site={site}
            supervisor={supervisor}
            isAdminView={isAdminView}
            expenses={expenses}
            advances={advances}
            fundsReceived={fundsReceived}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SiteDetail;
