import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Building2, Calendar, Check, Download, Edit, ExternalLink, User, Plus, SendHorizontal, TrendingDown, TrendingUp, FileText, CreditCard, Wallet } from 'lucide-react';
import { Expense, Site, Advance, FundsReceived, Invoice, BalanceSummary, AdvancePurpose, ApprovalStatus, UserRole, RecipientType, PaymentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import SiteDetailTransactions from './SiteDetailTransactions';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import AdvanceForm from '@/components/advances/AdvanceForm';
import FundsReceivedForm from '@/components/funds/FundsReceivedForm';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SupervisorTransactionForm } from '../transactions/SupervisorTransactionForm';
import { SupervisorTransactionHistory } from '../transactions/SupervisorTransactionHistory';
import { SupervisorAdvanceForm } from '../transactions/SupervisorAdvanceForm';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportSiteExcel } from '@/utils/exportSiteExcel';

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
  expenses: propExpenses = [],
  advances: propAdvances = [],
  fundsReceived: propFundsReceived = [],
  invoices: propInvoices = [],
  supervisorInvoices = [],
  balanceSummary: propBalanceSummary,
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
  const TAB_KEY = `site-detail-tab-${site.id}`;
  const [activeTab, setActiveTab] = useState<string>(
    () => sessionStorage.getItem(TAB_KEY) || 'summary'
  );
  const handleTabChange = (val: string) => {
    setActiveTab(val);
    sessionStorage.setItem(TAB_KEY, val);
  };
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const isMobile = useIsMobile();

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const { data: supTxns } = await supabase
        .from('supervisor_transactions')
        .select('*, payer_site:sites!supervisor_transactions_payer_site_id_fkey(name), receiver_site:sites!supervisor_transactions_receiver_site_id_fkey(name)')
        .or(`receiver_site_id.eq.${site.id},payer_site_id.eq.${site.id}`);
      await exportSiteExcel(site, expenses, advances, fundsReceived, invoices as any[], supTxns || [], site.id);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export Excel file');
    } finally {
      setIsExporting(false);
    }
  };

  // Persist open form dialog to sessionStorage so it survives tab kills / mobile camera
  const FORM_KEY = `site-open-form-${site.id}`;
  const savedForm = sessionStorage.getItem(FORM_KEY) || '';

  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(savedForm === 'expense');
  const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState(savedForm === 'advance');
  const [isFundsFormOpen, setIsFundsFormOpen] = useState(savedForm === 'funds');
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(savedForm === 'invoice');
  const [showSupervisorTransactionForm, setShowSupervisorTransactionForm] = useState(savedForm === 'supTxn');
  const [showSupervisorAdvanceForm, setShowSupervisorAdvanceForm] = useState(savedForm === 'supAdv');

  // Helpers that persist which dialog is open
  const openForm = (form: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    sessionStorage.setItem(FORM_KEY, form);
    setter(true);
  };
  const closeForm = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    sessionStorage.removeItem(FORM_KEY);
    setter(false);
  };

  // Self-fetched data (used when parent doesn't supply financial data)
  const [selfExpenses, setSelfExpenses] = useState<Expense[]>([]);
  const [selfAdvances, setSelfAdvances] = useState<Advance[]>([]);
  const [selfFundsReceived, setSelfFundsReceived] = useState<FundsReceived[]>([]);
  const [selfInvoices, setSelfInvoices] = useState<Invoice[]>([]);
  const [selfBalanceSummary, setSelfBalanceSummary] = useState<BalanceSummary | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);

  const fetchSiteFinancials = async (siteId: string) => {
    setIsFetchingData(true);
    try {
      const [expRes, advRes, fundsRes, invRes, supTxnRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('site_id', siteId).order('date', { ascending: false }),
        supabase.from('advances').select('*').eq('site_id', siteId).order('date', { ascending: false }),
        supabase.from('funds_received').select('*').eq('site_id', siteId).order('date', { ascending: false }),
        supabase.from('site_invoices').select('*, approver_type').eq('site_id', siteId).order('created_at', { ascending: false }),
        supabase.from('supervisor_transactions').select('amount, transaction_type, receiver_site_id, payer_site_id').or(`receiver_site_id.eq.${siteId},payer_site_id.eq.${siteId}`),
      ]);

      if (expRes.data) {
        setSelfExpenses(expRes.data.map((e: any) => ({
          id: e.id,
          date: new Date(e.date),
          description: e.description || '',
          category: e.category || '',
          amount: Number(e.amount) || 0,
          status: e.status || ApprovalStatus.PENDING,
          createdBy: e.created_by || '',
          createdAt: new Date(e.created_at),
          siteId: e.site_id,
          site_id: e.site_id,
          supervisorId: e.supervisor_id || '',
        })));
      }

      if (advRes.data) {
        setSelfAdvances(advRes.data.map((a: any) => ({
          id: a.id,
          date: new Date(a.date),
          recipientId: a.recipient_id,
          recipientName: a.recipient_name || '',
          recipientType: a.recipient_type || RecipientType.WORKER,
          purpose: a.purpose || AdvancePurpose.ADVANCE,
          amount: Number(a.amount) || 0,
          remarks: a.remarks,
          status: a.status || ApprovalStatus.PENDING,
          createdBy: a.created_by || '',
          createdAt: new Date(a.created_at),
          siteId: a.site_id,
        })));
      }

      if (fundsRes.data) {
        setSelfFundsReceived(fundsRes.data.map((f: any) => ({
          id: f.id,
          date: new Date(f.date),
          amount: Number(f.amount) || 0,
          siteId: f.site_id,
          site_id: f.site_id,
          createdAt: new Date(f.created_at),
          reference: f.reference,
          method: f.method,
          source: f.source,
        })));
      }

      if (invRes.data) {
        setSelfInvoices(invRes.data.map((inv: any) => ({
          id: inv.id,
          date: new Date(inv.date || inv.created_at),
          partyId: inv.party_id || '',
          partyName: inv.party_name || '',
          material: inv.material || '',
          quantity: Number(inv.quantity) || 0,
          rate: Number(inv.rate) || 0,
          gstPercentage: Number(inv.gst_percentage) || 0,
          grossAmount: Number(inv.gross_amount) || 0,
          netAmount: Number(inv.net_amount) || 0,
          bankDetails: inv.bank_details || {},
          billUrl: inv.bill_url,
          invoiceImageUrl: inv.invoice_image_url,
          paymentStatus: inv.payment_status || PaymentStatus.PENDING,
          status: inv.payment_status || PaymentStatus.PENDING,
          createdBy: inv.created_by || '',
          createdAt: new Date(inv.created_at),
          siteId: inv.site_id,
          vendorName: inv.vendor_name,
          invoiceNumber: inv.invoice_number,
          amount: Number(inv.net_amount) || 0,
        })));
      }

      // Compute summary directly from fetched records (the site_financial_summary
      // view reads from the 'transactions' table which may be empty; actual data
      // lives in the individual tables we already fetched above).
      const debitPurposes = [AdvancePurpose.SAFETY_SHOES, AdvancePurpose.TOOLS, AdvancePurpose.OTHER];
      const expTotal   = (expRes.data   || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      const fundsTotal = (fundsRes.data || []).reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0);
      const advTotal   = (advRes.data   || [])
        .filter((a: any) => !debitPurposes.includes(a.purpose))
        .reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
      const debitsTotal = (advRes.data  || [])
        .filter((a: any) => debitPurposes.includes(a.purpose))
        .reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);
      // Only count invoices that have been admin-approved (or paid) toward the balance.
      // Pending invoices are NOT deducted until admin approves them.
      // Invoices > ₹2000 with approver_type 'ho' are paid by HO/admin — don't deduct from supervisor balance.
      const approvedStatuses = ['approved', 'paid'];
      const invTotal = (invRes.data || [])
        .filter((inv: any) => {
          if (!approvedStatuses.includes(inv.payment_status)) return false;
          const amount = Number(inv.net_amount || inv.gross_amount || inv.amount) || 0;
          if (amount > 2000 && inv.approver_type === 'ho') return false;
          return true;
        })
        .reduce((s: number, inv: any) => s + (Number(inv.net_amount || inv.gross_amount || inv.amount) || 0), 0);
      const invPaid = (invRes.data || [])
        .filter((inv: any) => {
          if (inv.payment_status !== 'paid') return false;
          const amount = Number(inv.net_amount || inv.gross_amount || inv.amount) || 0;
          if (amount > 2000 && inv.approver_type === 'ho') return false;
          return true;
        })
        .reduce((s: number, inv: any) => s + (Number(inv.net_amount || inv.gross_amount || inv.amount) || 0), 0);
      const invPending = invTotal - invPaid;

      // Supervisor-to-supervisor outgoing payments from this site
      const advancePaidToSupervisor = (supTxnRes.data || [])
        .filter((t: any) => t.payer_site_id === siteId)
        .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

      // Supervisor-to-supervisor incoming payments to this site
      const fundsReceivedFromSupervisor = (supTxnRes.data || [])
        .filter((t: any) => t.receiver_site_id === siteId)
        .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

      setSelfBalanceSummary({
        fundsReceived: fundsTotal,
        fundsReceivedFromSupervisor,
        totalExpenditure: expTotal,
        totalAdvances: advTotal,
        debitsToWorker: debitsTotal,
        invoicesPaid: invTotal,
        pendingInvoices: invPending,
        advancePaidToSupervisor,
        totalBalance: (fundsTotal + fundsReceivedFromSupervisor) - expTotal - advTotal - invTotal - advancePaidToSupervisor,
      });
    } catch (err) {
      console.error('Error fetching site financials:', err);
    } finally {
      setIsFetchingData(false);
    }
  };

  useEffect(() => {
    fetchSiteFinancials(site.id);
  }, [site.id]);

  // Use self-fetched data when parent doesn't provide financial arrays
  const expenses = propExpenses.length > 0 ? propExpenses : selfExpenses;
  const advances = propAdvances.length > 0 ? propAdvances : selfAdvances;
  const fundsReceived = propFundsReceived.length > 0 ? propFundsReceived : selfFundsReceived;
  const invoices = propInvoices.length > 0 ? propInvoices : selfInvoices;

  const defaultBalanceSummary: BalanceSummary = {
    fundsReceived: 0,
    totalExpenditure: 0,
    totalAdvances: 0,
    debitsToWorker: 0,
    invoicesPaid: 0,
    pendingInvoices: 0,
    totalBalance: 0
  };

  const siteSummary = propBalanceSummary || selfBalanceSummary || defaultBalanceSummary;

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
  const totalFundsFromSupervisor = siteSummary.fundsReceivedFromSupervisor || 0;
  const totalInvoices = siteSummary.invoicesPaid || 0;
  const totalSupervisorPayments = siteSummary.advancePaidToSupervisor || 0;

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
      console.error('Error in handleMarkComplete:', error);
      toast.error('Failed to mark site as complete: ' + error.message);
    } finally {
      setIsMarkingComplete(false);
    }
  };

  const handleExpenseSubmit = (expense: Partial<Expense>) => {
    if (onAddExpense) {
      const expenseWithSiteId = {
        ...expense,
        siteId: site.id
      };
      onAddExpense(expenseWithSiteId);
    }
    closeForm(setIsExpenseFormOpen);
    if (onEntrySuccess) {
      onEntrySuccess('expense');
    }
    setTimeout(() => fetchSiteFinancials(site.id), 800);
  };

  const handleAdvanceSubmit = (advance: Partial<Advance>) => {
    if (onAddAdvance) {
      const advanceWithSiteId = {
        ...advance,
        siteId: site.id
      };
      onAddAdvance(advanceWithSiteId);
    }
    closeForm(setIsAdvanceFormOpen);
    if (onEntrySuccess) {
      onEntrySuccess('advance');
    }
    setTimeout(() => fetchSiteFinancials(site.id), 800);
  };

  const handleFundsSubmit = (funds: Partial<FundsReceived>) => {
    if (onAddFunds) {
      const fundsWithSiteId = {
        ...funds,
        siteId: site.id
      };
      onAddFunds(fundsWithSiteId);
    }
    closeForm(setIsFundsFormOpen);
    if (onEntrySuccess) {
      onEntrySuccess('funds');
    }
    setTimeout(() => fetchSiteFinancials(site.id), 800);
  };

  const handleInvoiceSubmit = (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    if (onAddInvoice) {
      const invoiceWithSiteId = {
        ...invoice,
        siteId: site.id
      };
      onAddInvoice(invoiceWithSiteId);
    }
    closeForm(setIsInvoiceFormOpen);
    if (onEntrySuccess) {
      onEntrySuccess('invoice');
    }
    setTimeout(() => fetchSiteFinancials(site.id), 800);
  };

  const totalSpend = totalExpenses + totalAdvances + totalInvoices + totalDebitToWorker;
  const pieData = [
    { name: 'Expenses', value: totalExpenses, color: '#2563eb' },
    { name: 'Advances', value: totalAdvances, color: '#f59e0b' },
    { name: 'Invoices', value: totalInvoices, color: '#0891b2' },
    { name: 'Worker Debits', value: totalDebitToWorker, color: '#6366f1' },
  ].filter(d => d.value > 0);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-border rounded-md shadow-md px-3 py-2 text-sm">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-muted-foreground">₹{Number(payload[0].value).toLocaleString('en-IN')}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold leading-tight">{site.name}</h1>
                {site.isCompleted ? (
                  <span className="badge-success text-xs px-2 py-0.5 rounded-full font-medium">Completed</span>
                ) : (
                  <span className="badge-info text-xs px-2 py-0.5 rounded-full font-medium">Active</span>
                )}
              </div>
              {/* Compact meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                {site.jobName && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{site.jobName}</span>
                  </span>
                )}
                {site.posNo && (
                  <span className="text-xs text-muted-foreground">PO: <span className="font-medium text-foreground">{site.posNo}</span></span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {format(site.startDate, 'dd MMM yy')}
                </span>
                {siteSupervisor && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <User className="h-3 w-3" />
                    {siteSupervisor.name}
                  </span>
                )}
                {site.completionDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Check className="h-3 w-3 text-emerald-500" />
                    {format(site.completionDate, 'dd MMM yy')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {isAdminView && (
            <Button
              variant="outline"
              size="sm"
              className="text-green-700 border-green-300 hover:bg-green-50 w-full sm:w-auto"
              onClick={handleExportExcel}
              disabled={isExporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting…' : 'Export Excel'}
            </Button>
          )}
          {!site.isCompleted && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 w-full sm:w-auto"
              onClick={() => setIsMarkingComplete(true)}
            >
              <Check className="mr-2 h-4 w-4" />
              Mark as Complete
            </Button>
          )}
        </div>

        {isMarkingComplete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Mark Site as Complete?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Are you sure you want to mark this site as complete? This action cannot be undone.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsMarkingComplete(false)}>Cancel</Button>
                  <Button onClick={handleMarkComplete} className="bg-emerald-600 hover:bg-emerald-700">Confirm</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Action Buttons — placed before site info so mobile users see them without scrolling */}
      {userRole !== UserRole.VIEWER && !site.isCompleted && (
        <div className={`flex flex-wrap gap-2 ${isMobile ? 'sticky top-0 z-30 bg-background/95 backdrop-blur-sm py-2 -mx-2 px-2 border-b border-border' : ''}`}>
          <Button onClick={() => openForm('expense', setIsExpenseFormOpen)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Expense
          </Button>
          <Button onClick={() => openForm('advance', setIsAdvanceFormOpen)} variant="outline" size="sm" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Advance to Worker/Subcontractor
          </Button>
          <Button onClick={() => openForm('supAdv', setShowSupervisorAdvanceForm)} variant="outline" size="sm" className="gap-1.5">
            <SendHorizontal className="h-3.5 w-3.5" /> Supervisor Advance
          </Button>
          <Button onClick={() => openForm('funds', setIsFundsFormOpen)} variant="outline" size="sm" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Add HO Funds
          </Button>
          <Button onClick={() => openForm('invoice', setIsInvoiceFormOpen)} variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Add Invoice
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid grid-cols-2 ${isMobile ? 'w-full' : 'max-w-xs'} mb-4`}>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {isFetchingData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          )}
          {!isFetchingData && (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Expenses', value: totalExpenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', border: 'border-l-red-500' },
              { label: 'Total Advances', value: totalAdvances, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-l-amber-500' },
              { label: 'Approved Invoices', value: totalInvoices, icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-l-cyan-500' },
              { label: 'Funds Received', value: totalFundsReceived, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-500' },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} className={`bg-white border border-border border-l-4 ${border} rounded-lg p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-7 w-7 rounded-md ${bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                </div>
                <p className={`text-lg font-bold ${color}`}>₹{value.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>

          {/* Chart + details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Donut chart */}
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <span className="h-1 w-4 bg-primary rounded-full inline-block"></span>
                Expenditure Breakdown
              </h3>
              {totalSpend > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                  <TrendingDown className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No expenditure data yet</p>
                </div>
              )}
            </div>

            {/* Details table */}
            <div className="bg-white border border-border rounded-lg p-5 space-y-1">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <span className="h-1 w-4 bg-primary rounded-full inline-block"></span>
                Financial Details
              </h3>
              {[
                { label: 'Total Expenses', value: totalExpenses, sub: `${expenses.length} entries` },
                { label: 'Total Advances', value: totalAdvances, sub: `${advances.length} entries` },
                { label: 'Approved Invoices', value: totalInvoices, sub: `${invoices.filter((inv: any) => ['approved','paid'].includes(inv.paymentStatus || '') && !(Number(inv.netAmount || inv.grossAmount || inv.amount || 0) > 2000 && inv.approverType === 'ho')).length} of ${invoices.length} approved` },
                { label: 'Debit to worker(directly deduct by ho)', value: totalDebitToWorker, sub: 'Tools / Safety / Other' },
                ...(totalSupervisorPayments > 0 ? [{ label: 'Supervisor Payments', value: totalSupervisorPayments, sub: 'Paid to other supervisors' }] : []),
                { label: 'Funds Received', value: totalFundsReceived, sub: `${fundsReceived.length} entries`, credit: true },
                { label: 'Funds from Supervisor', value: totalFundsFromSupervisor, sub: 'Received from other supervisors', credit: true },
              ].map(({ label, value, sub, credit }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <span className={`text-sm font-semibold ${credit ? 'text-emerald-600' : 'text-foreground'}`}>
                    {credit ? '+' : ''}₹{value.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3">
                <p className="text-sm font-bold">Current Balance</p>
                <span className={`text-base font-bold ${currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ₹{currentBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          </>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          <SiteDetailTransactions
            siteId={site.id}
            expensesCount={expenses.length}
            advancesCount={advances.length}
            fundsReceivedCount={fundsReceived.length}
            invoicesCount={invoices.length}
            userRole={userRole}
            isAdminView={isAdminView}
            site={site}
            supervisor={supervisor}
            expenses={expenses}
            advances={advances}
            fundsReceived={fundsReceived}
            invoices={invoices}
            onTransactionsUpdate={() => {
              if (onEntrySuccess) onEntrySuccess('transactions');
              setTimeout(() => fetchSiteFinancials(site.id), 800);
            }}
          />
        </TabsContent>
      </Tabs>

      {isExpenseFormOpen && (
        <ExpenseForm
          isOpen={isExpenseFormOpen}
          onClose={() => closeForm(setIsExpenseFormOpen)}
          onSubmit={handleExpenseSubmit}
          siteId={site.id}
        />
      )}
      
      {isAdvanceFormOpen && (
        <AdvanceForm
          isOpen={isAdvanceFormOpen}
          onClose={() => closeForm(setIsAdvanceFormOpen)}
          onSubmit={handleAdvanceSubmit}
          siteId={site.id}
        />
      )}
      
      {isFundsFormOpen && (
        <FundsReceivedForm
          isOpen={isFundsFormOpen}
          onClose={() => closeForm(setIsFundsFormOpen)}
          onSubmit={handleFundsSubmit}
          siteId={site.id}
        />
      )}
      
      {isInvoiceFormOpen && (
        <InvoiceForm
          isOpen={isInvoiceFormOpen}
          onClose={() => closeForm(setIsInvoiceFormOpen)}
          onSubmit={handleInvoiceSubmit}
          siteId={site.id}
        />
      )}

      <Dialog open={showSupervisorTransactionForm} onOpenChange={(open) => { if (!open) closeForm(setShowSupervisorTransactionForm); }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[425px] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Add Supervisor Transaction</DialogTitle>
            <DialogDescription>
              Transfer funds to another supervisor from this site.
            </DialogDescription>
          </DialogHeader>
          <SupervisorTransactionForm 
            onSuccess={() => {
              closeForm(setShowSupervisorTransactionForm);
              onEntrySuccess?.('transactions');
            }}
            payerSiteId={site?.id}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showSupervisorAdvanceForm} onOpenChange={(open) => { if (!open) closeForm(setShowSupervisorAdvanceForm); }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[425px] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Advance Paid to Supervisor</DialogTitle>
            <DialogDescription>
              Send funds to another supervisor from this site.
            </DialogDescription>
          </DialogHeader>
          <SupervisorAdvanceForm 
            onSuccess={() => {
              closeForm(setShowSupervisorAdvanceForm);
              onEntrySuccess?.('transactions');
            }}
            payerSiteId={site?.id}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiteDetail;
