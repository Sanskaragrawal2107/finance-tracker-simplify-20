import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowUpRight, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Expense,
  Advance,
  FundsReceived,
  Site,
  UserRole,
  Invoice,
  BalanceSummary
} from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import AdvanceForm from '@/components/advances/AdvanceForm';
import FundsReceivedForm from '@/components/funds/FundsReceivedForm';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import SiteDetailTransactions from '@/components/sites/SiteDetailTransactions';
import BalanceCard from '@/components/dashboard/BalanceCard';
import StatsCard from '@/components/dashboard/StatsCard';
import { SupervisorTransactionForm } from '@/components/transactions/SupervisorTransactionForm';
import { SupervisorTransactionHistory } from '@/components/transactions/SupervisorTransactionHistory';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SiteDetailProps {
  siteId?: string;
}

const SiteDetail: React.FC<SiteDetailProps> = ({ siteId }) => {
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [supervisor, setSupervisor] = useState<any | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [fundsReceived, setFundsReceived] = useState<FundsReceived[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState(false);
  const [isFundsReceivedFormOpen, setIsFundsReceivedFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary>({
    fundsReceived: 0,
    fundsReceivedFromSupervisor: 0,
    totalExpenditure: 0,
    totalAdvances: 0,
    debitsToWorker: 0,
    invoicesPaid: 0,
    pendingInvoices: 0,
    advancePaidToSupervisor: 0,
    totalBalance: 0,
  });
  const [stats, setStats] = useState({
    expensesCount: 0,
    advancesCount: 0,
    fundsReceivedCount: 0,
  });
  const [supervisorFormOpen, setSupervisorFormOpen] = useState(false);

  const fetchSiteDetails = async () => {
    if (!siteId) return;

    try {
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();

      if (siteError) throw siteError;

      setSite({
        id: siteData.id,
        name: siteData.name,
        jobName: siteData.job_name,
        posNo: siteData.pos_no,
        location: siteData.location,
        startDate: new Date(siteData.start_date),
        completionDate: siteData.completion_date ? new Date(siteData.completion_date) : undefined,
        supervisorId: siteData.supervisor_id,
        supervisor: siteData.supervisor_id,
        createdAt: new Date(siteData.created_at),
        isCompleted: siteData.is_completed,
        funds: siteData.funds,
        totalFunds: siteData.total_funds,
      });

      const { data: supervisorData, error: supervisorError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', siteData.supervisor_id)
        .single();

      if (supervisorError) throw supervisorError;

      setSupervisor({
        id: supervisorData.id,
        name: supervisorData.name,
        email: supervisorData.email,
        role: supervisorData.role,
      });
    } catch (error) {
      console.error("Error fetching site details:", error);
      toast.error("Failed to load site details");
    }
  };

  const fetchBalanceSummary = async () => {
    if (!siteId) return;

    try {
      const { data, error } = await supabase
        .from('site_financial_summary')
        .select('*')
        .eq('site_id', siteId)
        .single();

      if (error) throw error;

      setBalanceSummary({
        fundsReceived: data?.funds_received || 0,
        fundsReceivedFromSupervisor: data?.funds_received_from_supervisor || 0,
        totalExpenditure: data?.total_expenses || 0,
        totalAdvances: data?.total_advances || 0,
        debitsToWorker: data?.debit_to_worker || 0,
        invoicesPaid: data?.invoices_paid || 0,
        pendingInvoices: data?.pending_invoices || 0,
        advancePaidToSupervisor: data?.advance_paid_to_supervisor || 0,
        totalBalance: data?.current_balance || 0,
      });
    } catch (error) {
      console.error("Error fetching balance summary:", error);
      toast.error("Failed to load balance summary");
    }
  };

  const fetchStats = async () => {
    if (!siteId) return;

    try {
      const [expensesResponse, advancesResponse, fundsReceivedResponse] = await Promise.all([
        supabase
          .from('expenses')
          .select('count', { count: 'exact' })
          .eq('site_id', siteId),
        supabase
          .from('advances')
          .select('count', { count: 'exact' })
          .eq('site_id', siteId),
        supabase
          .from('funds_received')
          .select('count', { count: 'exact' })
          .eq('site_id', siteId),
      ]);

      setStats({
        expensesCount: expensesResponse.data ? expensesResponse.count || 0 : 0,
        advancesCount: advancesResponse.data ? advancesResponse.count || 0 : 0,
        fundsReceivedCount: fundsReceivedResponse.data
          ? fundsReceivedResponse.count || 0
          : 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load stats");
    }
  };

  const refreshBalanceSummary = async () => {
    await fetchBalanceSummary();
  };

  useEffect(() => {
    if (siteId) {
      setIsLoading(true);
      Promise.all([fetchSiteDetails(), fetchBalanceSummary(), fetchStats()])
        .finally(() => setIsLoading(false));
    }
  }, [siteId]);

  const handleExpenseCreated = () => {
    setIsExpenseFormOpen(false);
    fetchBalanceSummary();
    fetchStats();
  };

  const handleAdvanceCreated = () => {
    setIsAdvanceFormOpen(false);
    fetchBalanceSummary();
    fetchStats();
  };

  const handleFundsReceivedCreated = () => {
    setIsFundsReceivedFormOpen(false);
    fetchBalanceSummary();
    fetchStats();
  };

  const handleInvoiceCreated = () => {
    setIsInvoiceFormOpen(false);
    fetchBalanceSummary();
    fetchStats();
  };

  return (
    <div>
      {isLoading ? (
        <div>Loading site details...</div>
      ) : (
        <>
          {site && (
            <>
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h1 className="text-3xl font-bold">{site.name}</h1>
                    <p className="text-muted-foreground">
                      {site.jobName} - {site.posNo}
                    </p>
                  </div>
                  <div>
                    <Badge variant="secondary">
                      Supervisor: {supervisor?.name || 'N/A'}
                    </Badge>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <Badge>Location: {site.location}</Badge>
                  <Badge>
                    Start Date: {format(new Date(site.startDate), 'dd MMM yyyy')}
                  </Badge>
                  {site.completionDate && (
                    <Badge>
                      Completion Date: {format(new Date(site.completionDate), 'dd MMM yyyy')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <BalanceCard balanceData={balanceSummary} siteId={siteId} />
                <StatsCard
                  title="Expenses"
                  value={stats.expensesCount}
                  description="Total expenses recorded for this site"
                />
                <StatsCard
                  title="Advances"
                  value={stats.advancesCount}
                  description="Total advances given at this site"
                />
                <StatsCard
                  title="Funds Received"
                  value={stats.fundsReceivedCount}
                  description="Total funds received for this site"
                />
              </div>

              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Site Transactions</h2>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setIsExpenseFormOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Expense
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setIsAdvanceFormOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Advance
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setIsFundsReceivedFormOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Funds Received
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setIsInvoiceFormOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Invoice
                  </Button>
                  {/* Add Advance Paid to Supervisor button */}
                  <Button
                    variant="outline"
                    className="flex items-center"
                    onClick={() => setSupervisorFormOpen(true)}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" /> Advance Paid to Supervisor
                  </Button>
                </div>
              </div>

              {/* Supervisor transaction form dialog */}
              <Dialog open={supervisorFormOpen} onOpenChange={setSupervisorFormOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Advance Paid to Supervisor</DialogTitle>
                  </DialogHeader>
                  <SupervisorTransactionForm
                    payerSiteId={siteId}
                    onSuccess={() => {
                      setSupervisorFormOpen(false);
                      if (refreshBalanceSummary) {
                        refreshBalanceSummary();
                      }
                    }}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={isExpenseFormOpen} onOpenChange={setIsExpenseFormOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Expense</DialogTitle>
                  </DialogHeader>
                  <ExpenseForm
                    siteId={siteId}
                    onExpenseCreated={handleExpenseCreated}
                    onClose={() => setIsExpenseFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={isAdvanceFormOpen} onOpenChange={setIsAdvanceFormOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Advance</DialogTitle>
                  </DialogHeader>
                  <AdvanceForm
                    siteId={siteId}
                    onAdvanceCreated={handleAdvanceCreated}
                    onClose={() => setIsAdvanceFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={isFundsReceivedFormOpen} onOpenChange={setIsFundsReceivedFormOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Funds Received</DialogTitle>
                  </DialogHeader>
                  <FundsReceivedForm
                    siteId={siteId}
                    onFundsReceivedCreated={handleFundsReceivedCreated}
                    onClose={() => setIsFundsReceivedFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={isInvoiceFormOpen} onOpenChange={setIsInvoiceFormOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Invoice</DialogTitle>
                  </DialogHeader>
                  <InvoiceForm
                    siteId={siteId}
                    onInvoiceCreated={handleInvoiceCreated}
                    onClose={() => setIsInvoiceFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3">Supervisor-to-Supervisor Transactions</h3>
                <SupervisorTransactionHistory siteId={siteId} />
              </div>

              <SiteDetailTransactions
                siteId={siteId}
                expensesCount={stats.expensesCount}
                advancesCount={stats.advancesCount}
                fundsReceivedCount={stats.fundsReceivedCount}
                userRole={user?.role || UserRole.VIEWER}
                isAdminView={user?.role === UserRole.ADMIN}
                site={site}
                supervisor={supervisor}
                expenses={expenses}
                advances={advances}
                fundsReceived={fundsReceived}
                onTransactionsUpdate={() => {
                  fetchBalanceSummary();
                  fetchStats();
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SiteDetail;
