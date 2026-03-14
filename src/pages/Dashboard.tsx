import React, { useState, useEffect, useCallback } from 'react';
import PageTitle from '@/components/common/PageTitle';
import BalanceCard from '@/components/dashboard/BalanceCard';
import StatCard from '@/components/dashboard/StatCard';
import ExpenseChart from '@/components/dashboard/ExpenseChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { BarChart3, FileText, Wallet, Building2, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { Activity, ActivityType, BalanceSummary, ChartDataPoint } from '@/lib/types';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { parseDbDate } from '@/lib/utils';

const EMPTY_BALANCE: BalanceSummary = {
  totalBalance: 0,
  fundsReceived: 0,
  totalExpenditure: 0,
  totalAdvances: 0,
  debitsToWorker: 0,
  invoicesPaid: 0,
  pendingInvoices: 0,
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [balanceData, setBalanceData] = useState<BalanceSummary>(EMPTY_BALANCE);
  const [totalSites, setTotalSites] = useState(0);
  const [activeSites, setActiveSites] = useState(0);
  const [expenseChartData, setExpenseChartData] = useState<ChartDataPoint[]>([]);
  const [categoryChartData, setCategoryChartData] = useState<ChartDataPoint[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      // 1. Fetch all sites for this supervisor
      let siteQuery = supabase.from('sites').select('id, is_completed, supervisor_id');
      if (user.role === 'supervisor') {
        siteQuery = siteQuery.eq('supervisor_id', user.id);
      }
      const { data: sitesData, error: sitesError } = await siteQuery;
      if (sitesError) throw sitesError;

      const sites = sitesData ?? [];
      const siteIds = sites.map((s) => s.id);
      setTotalSites(sites.length);
      setActiveSites(sites.filter((s) => !s.is_completed).length);

      if (siteIds.length === 0) {
        setBalanceData(EMPTY_BALANCE);
        setExpenseChartData([]);
        setCategoryChartData([]);
        setRecentActivities([]);
        return;
      }

      // 2. Aggregate financial summary across all sites
      const { data: summaryData, error: summaryError } = await supabase
        .from('site_financial_summary')
        .select('*')
        .in('site_id', siteIds);
      if (summaryError) throw summaryError;

      const summaries = summaryData ?? [];
      const agg = summaries.reduce(
        (acc, row) => ({
          fundsReceived:              acc.fundsReceived              + (row.funds_received               ?? 0),
          fundsReceivedFromSupervisor: acc.fundsReceivedFromSupervisor + (row.funds_received_from_supervisor ?? 0),
          totalExpenditure:           acc.totalExpenditure           + (row.total_expenses_paid           ?? 0),
          totalAdvances:              acc.totalAdvances              + (row.total_advances_paid           ?? 0),
          invoicesPaid:               acc.invoicesPaid               + (row.invoices_paid                 ?? 0),
          advancePaidToSupervisor:    acc.advancePaidToSupervisor    + (row.advance_paid_to_supervisor    ?? 0),
          debitsToWorker:             acc.debitsToWorker             + (row.debit_to_worker               ?? 0),
        }),
        {
          fundsReceived: 0, fundsReceivedFromSupervisor: 0, totalExpenditure: 0,
          totalAdvances: 0, invoicesPaid: 0, advancePaidToSupervisor: 0, debitsToWorker: 0,
        }
      );
      const totalBalance =
        (agg.fundsReceived + agg.fundsReceivedFromSupervisor) -
        (agg.totalExpenditure + agg.totalAdvances + agg.invoicesPaid + agg.advancePaidToSupervisor);

      // 3. Pending invoices (unpaid site_invoices)
      const { data: pendingInvData } = await supabase
        .from('site_invoices')
        .select('net_amount')
        .in('site_id', siteIds)
        .eq('payment_status', 'pending');
      const pendingInvoices = (pendingInvData ?? []).reduce((s, r) => s + (r.net_amount ?? 0), 0);

      setBalanceData({
        ...agg,
        totalBalance,
        pendingInvoices,
      });

      // 4. Monthly expense chart — last 6 months
      const now = new Date();
      const monthTotals: ChartDataPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(now, i);
        const start = format(startOfMonth(month), 'yyyy-MM-dd');
        const end   = format(endOfMonth(month),   'yyyy-MM-dd');
        const { data: mData } = await supabase
          .from('expenses')
          .select('amount')
          .in('site_id', siteIds)
          .gte('date', start)
          .lte('date', end);
        const total = (mData ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
        monthTotals.push({ name: format(month, 'MMM'), value: total });
      }
      setExpenseChartData(monthTotals);

      // 5. Category chart from all expenses
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select('category, amount')
        .in('site_id', siteIds);
      const catMap: Record<string, number> = {};
      (allExpenses ?? []).forEach((e) => {
        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] ?? 0) + (e.amount ?? 0);
      });
      const catTotal = Object.values(catMap).reduce((s, v) => s + v, 0);
      const catChartData: ChartDataPoint[] = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({
          name,
          value: catTotal > 0 ? Math.round((value / catTotal) * 100) : 0,
        }));
      setCategoryChartData(catChartData);

      // 6. Recent activity — latest 10 items across expenses, advances, funds_received
      const [expRes, advRes, fundsRes] = await Promise.all([
        supabase.from('expenses').select('id, amount, description, date, category').in('site_id', siteIds).order('date', { ascending: false }).limit(5),
        supabase.from('advances').select('id, amount, purpose, date, recipient_name').in('site_id', siteIds).order('date', { ascending: false }).limit(5),
        supabase.from('funds_received').select('id, amount, reference, date').in('site_id', siteIds).order('date', { ascending: false }).limit(5),
      ]);

      const activities: Activity[] = [
        ...(expRes.data ?? []).map((e) => ({
          id: e.id,
          type: ActivityType.EXPENSE,
          description: e.description || e.category || 'Expense',
          amount: e.amount,
          date: parseDbDate(e.date),
          user: 'Supervisor',
        })),
        ...(advRes.data ?? []).map((a) => ({
          id: a.id,
          type: ActivityType.ADVANCE,
          description: `Advance to ${a.recipient_name}`,
          amount: a.amount,
          date: parseDbDate(a.date),
          user: 'Supervisor',
        })),
        ...(fundsRes.data ?? []).map((f) => ({
          id: f.id,
          type: ActivityType.FUNDS,
          description: f.reference ? `Funds received (${f.reference})` : 'Funds received',
          amount: f.amount,
          date: parseDbDate(f.date),
          user: 'Admin',
        })),
      ]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10);

      setRecentActivities(activities);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchDashboardData]);

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle title="Dashboard" subtitle="Financial overview and recent activity" />
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button size="sm" variant="outline" onClick={fetchDashboardData} disabled={isRefreshing}>
            {isRefreshing
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/supervisor-sites')}>
            My Sites
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-border/60 shadow-sm p-5 animate-pulse h-24">
              <div className="h-3 bg-muted rounded w-2/3 mb-3" />
              <div className="h-7 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Expenditure"
            value={balanceData.totalExpenditure}
            icon={BarChart3}
            valuePrefix="₹"
            accentColor="red"
          />
          <StatCard
            title="Total Advances"
            value={balanceData.totalAdvances || 0}
            icon={Wallet}
            valuePrefix="₹"
            accentColor="amber"
          />
          <StatCard
            title="Pending Invoices"
            value={balanceData.pendingInvoices || 0}
            icon={FileText}
            valuePrefix="₹"
            accentColor="blue"
          />
          <StatCard
            title="Active Sites"
            value={activeSites}
            icon={Building2}
            accentColor="emerald"
          />
        </div>
      )}

      {/* Charts row */}
      {!isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ExpenseChart
              data={expenseChartData.length > 0 ? expenseChartData : [{ name: 'No data', value: 0 }]}
              title="Monthly Expense Trend"
              type="area"
              className="md:col-span-2"
            />
            <RecentActivity
              activities={recentActivities}
              className="md:col-span-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BalanceCard
              balanceData={balanceData}
              className="md:col-span-1"
            />
            <ExpenseChart
              data={categoryChartData.length > 0 ? categoryChartData : [{ name: 'No data', value: 100 }]}
              title="Expense by Category"
              type="pie"
              className="md:col-span-2"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
