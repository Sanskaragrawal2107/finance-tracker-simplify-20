import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '@/components/common/PageTitle';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { User, Users, Building2, UserPlus, Loader2, CheckCircle2, Clock, TrendingUp, Plus, Eye, Download, FileSpreadsheet } from 'lucide-react';
import { exportBankPayment } from '@/utils/exportBankPayment';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format as fnsFormat } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import RegisterForm from '@/components/auth/RegisterForm';
import { supabase } from '@/integrations/supabase/client';
import SiteForm from '@/components/sites/SiteForm';
import { usePageVisibility } from '@/utils/pageVisibility';
import { cn } from '@/lib/utils';
interface SupervisorStats {
  totalSites: number;
  activeSites: number;
  completedSites: number;
}
interface SupervisorWithId {
  id: string;
  name: string;
}
const AdminDashboard: React.FC = () => {
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [supervisorStats, setSupervisorStats] = useState<Record<string, SupervisorStats>>({});
  const [supervisorsList, setSupervisorsList] = useState<SupervisorWithId[]>([]);
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [isRegisterFormOpen, setIsRegisterFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingInvoices, setIsExportingInvoices] = useState(false);
  type InvoiceFilter = 'today' | 'month' | 'all';
  const [invoiceExportFilter, setInvoiceExportFilter] = useState<InvoiceFilter>('all');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    user
  } = useAuth();

  // Stable refs to prevent re-binding event handlers
  const buttonsEnabledRef = useRef(true);
  const lastFetchTimeRef = useRef(0);
  const fetchSupervisorsAndSites = useCallback(async () => {
    const now = Date.now();
    // Prevent rapid successive calls
    if (now - lastFetchTimeRef.current < 1000) {
      console.log('Skipping fetch - too soon since last fetch');
      return;
    }
    lastFetchTimeRef.current = now;
    try {
      setIsRefreshing(true);

      // Add timeout to prevent hanging
      const fetchPromise = Promise.all([supabase.from('users').select('id, name').eq('role', 'supervisor'), supabase.from('sites').select('id, supervisor_id, is_completed')]);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 8000));
      const [supervisorsResult, sitesResult] = (await Promise.race([fetchPromise, timeoutPromise])) as any;
      if (supervisorsResult.error) {
        console.error('Error fetching supervisors:', supervisorsResult.error);
        toast.error('Failed to load supervisors');
        return;
      }
      const supervisorsData = supervisorsResult.data;
      if (!supervisorsData || supervisorsData.length === 0) {
        setSupervisorsList([]);
        setSupervisorStats({});
        return;
      }
      setSupervisorsList(supervisorsData);
      if (sitesResult.error) {
        console.error('Error fetching sites:', sitesResult.error);
        toast.error('Failed to load sites data');
        return;
      }
      const sitesData = sitesResult.data;

      // Calculate stats
      const stats: Record<string, SupervisorStats> = {};
      supervisorsData.forEach(supervisor => {
        const supervisorSites = sitesData ? sitesData.filter(site => site.supervisor_id === supervisor.id) : [];
        const total = supervisorSites.length;
        const active = supervisorSites.filter(site => !site.is_completed).length;
        const completed = supervisorSites.filter(site => site.is_completed).length;
        stats[supervisor.id] = {
          totalSites: total,
          activeSites: active,
          completedSites: completed
        };
      });
      setSupervisorStats(stats);
    } catch (error) {
      console.error('Error in fetchSupervisorsAndSites:', error);
      if (error.message === 'Fetch timeout') {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  useEffect(() => {
    if (user) {
      fetchSupervisorsAndSites();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchSupervisorsAndSites]);

  // Handle tab recovery to fix unresponsive buttons
  useEffect(() => {
    const handleTabRecovery = () => {
      console.log('Admin dashboard recovered from tab switch');
      buttonsEnabledRef.current = true;

      // Force re-enable event handlers by refreshing data
      if (user) {
        setTimeout(() => {
          fetchSupervisorsAndSites();
        }, 100);
      }
    };
    window.addEventListener('app:tab-recovered', handleTabRecovery);
    return () => {
      window.removeEventListener('app:tab-recovered', handleTabRecovery);
    };
  }, [user, fetchSupervisorsAndSites]);
  const handleViewSites = useCallback((supervisorId: string) => {
    if (!buttonsEnabledRef.current) {
      console.log('Button disabled - ignoring click');
      return;
    }
    const selectedSupervisor = supervisorsList.find(sup => sup.id === supervisorId);
    navigate('/admin/supervisor-sites', {
      state: {
        supervisorId: supervisorId,
        supervisorName: selectedSupervisor?.name || 'Unknown Supervisor',
        showSites: true
      }
    });
  }, [supervisorsList, navigate]);
  const handleAddSite = useCallback(() => {
    if (!buttonsEnabledRef.current) {
      console.log('Button disabled - ignoring click');
      return;
    }
    if (selectedSupervisorId) {
      setIsSiteFormOpen(true);
    } else {
      toast.error("Please select a supervisor first");
    }
  }, [selectedSupervisorId]);
  const handleCreateSite = async (site: any) => {
    try {
      // Update local stats optimistically
      setSupervisorStats(prev => {
        const updatedStats = {
          ...prev
        };
        const supervisorId = site.supervisorId || selectedSupervisorId;
        if (supervisorId && updatedStats[supervisorId]) {
          updatedStats[supervisorId] = {
            ...updatedStats[supervisorId],
            totalSites: updatedStats[supervisorId].totalSites + 1,
            activeSites: updatedStats[supervisorId].activeSites + 1
          };
        }
        return updatedStats;
      });
      setIsSiteFormOpen(false);
      toast.success('Site created successfully!');
    } catch (error: any) {
      console.error('Error in handleCreateSite:', error);
      toast.error('Failed to create site: ' + error.message);
    }
  };
  const getSelectedSupervisor = () => {
    return supervisorsList.find(s => s.id === selectedSupervisorId);
  };
  const handleRefresh = useCallback(() => {
    if (!buttonsEnabledRef.current) {
      console.log('Button disabled - ignoring click');
      return;
    }
    fetchSupervisorsAndSites();
  }, [fetchSupervisorsAndSites]);

  const handleExportAllInvoices = useCallback(async (filter: InvoiceFilter) => {
    try {
      setIsExportingInvoices(true);
      const now = new Date();

      // Build date range query
      let query = supabase
        .from('site_invoices')
        .select('*')
        .eq('payment_status', 'approved')
        .order('date', { ascending: false });

      if (filter === 'today') {
        query = query
          .gte('date', startOfDay(now).toISOString())
          .lte('date', endOfDay(now).toISOString());
      } else if (filter === 'month') {
        query = query
          .gte('date', startOfMonth(now).toISOString())
          .lte('date', endOfMonth(now).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error(
          filter === 'today'
            ? 'No approved invoices found for today.'
            : filter === 'month'
            ? 'No approved invoices found for this month.'
            : 'No approved invoices found.'
        );
        return;
      }

      const label =
        filter === 'today' ? `Today_${fnsFormat(now, 'ddMMMyyyy')}`
        : filter === 'month' ? `${fnsFormat(now, 'MMMM_yyyy')}`
        : 'All';

      await exportBankPayment(data, `MEW_${label}`);
      toast.success(`Downloaded ${data.length} approved invoice${data.length !== 1 ? 's' : ''} (${filter === 'today' ? 'today' : filter === 'month' ? 'this month' : 'all time'})`);
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err?.message || 'Failed to export invoices');
    } finally {
      setIsExportingInvoices(false);
    }
  }, []);
  if (!user) {
    return <div className="space-y-6 animate-fade-in">
        <div className="text-center py-12">
          <div className="animate-pulse">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-medium mb-2">Loading...</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please wait while we authenticate your session
            </p>
          </div>
        </div>
      </div>;
  }

  // ── Chart data ──────────────────────────────────────────────────────
  const totalActive    = Object.values(supervisorStats).reduce((s, x) => s + x.activeSites, 0);
  const totalCompleted = Object.values(supervisorStats).reduce((s, x) => s + x.completedSites, 0);
  const totalSites     = totalActive + totalCompleted;

  const pieData = [
    { name: 'Active',    value: totalActive },
    { name: 'Completed', value: totalCompleted },
  ];
  const PIE_COLORS = ['#2563eb', '#10b981'];

  const barData = supervisorsList.map((sup) => ({
    name: sup.name.split(' ')[0],
    Active:    supervisorStats[sup.id]?.activeSites    ?? 0,
    Completed: supervisorStats[sup.id]?.completedSites ?? 0,
  }));

  // ── Custom tooltip ───────────────────────────────────────────────────
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-border shadow-lg rounded-lg px-3 py-2 text-xs">
        <p className="font-semibold text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle title="Admin Dashboard" subtitle="Supervise teams, monitor sites and track performance" />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5 mr-1.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsRegisterFormOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add User
          </Button>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Supervisors', value: supervisorsList.length,  icon: Users,       border: 'border-l-blue-500',    iconCls: 'bg-blue-50 text-blue-600' },
          { label: 'Total Sites',       value: totalSites,              icon: Building2,   border: 'border-l-emerald-500', iconCls: 'bg-emerald-50 text-emerald-600' },
          { label: 'Active Sites',      value: totalActive,             icon: Clock,       border: 'border-l-amber-500',   iconCls: 'bg-amber-50 text-amber-600' },
          { label: 'Completed Sites',   value: totalCompleted,          icon: CheckCircle2,border: 'border-l-cyan-500',    iconCls: 'bg-cyan-50 text-cyan-600' },
        ].map(({ label, value, icon: Icon, border, iconCls }) => (
          <div key={label} className={cn('bg-white rounded-lg border border-border/60 shadow-sm p-5 border-l-4 flex items-center gap-4', border)}>
            <div className={cn('p-2.5 rounded-md flex-shrink-0', iconCls)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{isLoading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Pie — site status */}
          <div className="bg-white rounded-lg border border-border/60 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site Status</p>
            <p className="text-sm font-semibold text-foreground mt-0.5 mb-4">Active vs Completed</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar — supervisor performance */}
          <div className="bg-white rounded-lg border border-border/60 shadow-sm p-5 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supervisor Performance</p>
            <p className="text-sm font-semibold text-foreground mt-0.5 mb-4">Sites per Supervisor</p>
            <div className="h-[220px]">
              {barData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="square"
                      iconSize={8}
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
                    />
                    <Bar dataKey="Active"    fill="#2563eb" radius={[3, 3, 0, 0]} barSize={18} />
                    <Bar dataKey="Completed" fill="#10b981" radius={[3, 3, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Supervisor table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">Supervisor Management</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedSupervisorId || 'all'} onValueChange={(v) => setSelectedSupervisorId(v === 'all' ? null : v)}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="Filter supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Supervisors</SelectItem>
                {supervisorsList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleAddSite} className="h-8 text-xs">
              <Plus className="h-3 w-3 mr-1" /> New Site
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-sm text-muted-foreground">Loading supervisors…</span>
          </div>
        ) : supervisorsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">No supervisors found</p>
            <p className="text-xs mt-1">Click <strong>Add User</strong> to create a supervisor account.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border/40">
              {supervisorsList
                .filter((s) => !selectedSupervisorId || s.id === selectedSupervisorId)
                .map((supervisor) => {
                  const stats = supervisorStats[supervisor.id] ?? { totalSites: 0, activeSites: 0, completedSites: 0 };
                  const completionPct = stats.totalSites > 0 ? Math.round((stats.completedSites / stats.totalSites) * 100) : 0;
                  const initials = supervisor.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <div key={supervisor.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{supervisor.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="badge-info text-[10px]">{stats.activeSites} active</span>
                            <span className="badge-success text-[10px]">{stats.completedSites} done</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${completionPct}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{completionPct}%</span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 text-xs flex-shrink-0" onClick={() => handleViewSites(supervisor.id)}>
                        <Eye className="h-3 w-3 mr-1" /> Sites
                      </Button>
                    </div>
                  );
                })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supervisor</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisorsList
                    .filter((s) => !selectedSupervisorId || s.id === selectedSupervisorId)
                    .map((supervisor) => {
                      const stats = supervisorStats[supervisor.id] ?? { totalSites: 0, activeSites: 0, completedSites: 0 };
                      const completionPct = stats.totalSites > 0 ? Math.round((stats.completedSites / stats.totalSites) * 100) : 0;
                      const initials = supervisor.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                      return (
                        <tr key={supervisor.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[11px] font-bold text-primary">{initials}</span>
                              </div>
                              <span className="font-medium text-foreground">{supervisor.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center"><span className="font-semibold tabular-nums">{stats.totalSites}</span></td>
                          <td className="px-4 py-3.5 text-center"><span className="badge-info">{stats.activeSites}</span></td>
                          <td className="px-4 py-3.5 text-center"><span className="badge-success">{stats.completedSites}</span></td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums w-8">{completionPct}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleViewSites(supervisor.id)}>
                              <Eye className="h-3 w-3 mr-1" /> View Sites
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Invoice Export ────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-border/60 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Payment</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">Export Approved Invoices</p>
            <p className="text-xs text-muted-foreground mt-0.5">Download all approved invoices as a bank-upload Excel file</p>
          </div>
          <FileSpreadsheet className="h-8 w-8 text-emerald-600 opacity-60 hidden sm:block flex-shrink-0" />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {(['today', 'month', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setInvoiceExportFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                invoiceExportFilter === f
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-muted-foreground border-border/60 hover:border-emerald-400 hover:text-emerald-700'
              }`}
            >
              {f === 'today' ? 'Today' : f === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>

        <Button
          onClick={() => handleExportAllInvoices(invoiceExportFilter)}
          disabled={isExportingInvoices}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm gap-2"
        >
          {isExportingInvoices ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExportingInvoices
            ? 'Generating…'
            : `Download ${invoiceExportFilter === 'today' ? "Today's" : invoiceExportFilter === 'month' ? "This Month's" : 'All'} Invoices`}
        </Button>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-border/60 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Shortcuts</p>
        <p className="text-sm font-semibold text-foreground mb-4">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/admin/all-sites')}
            className="flex items-center gap-4 p-4 rounded-lg border border-border/60 hover:bg-muted/30 hover:border-primary/30 transition-all text-left group"
          >
            <div className="p-2.5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors flex-shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">View All Sites</p>
              <p className="text-xs text-muted-foreground mt-0.5">Browse the complete site listing</p>
            </div>
          </button>

          <button
            onClick={handleAddSite}
            className="flex items-center gap-4 p-4 rounded-lg border border-border/60 hover:bg-muted/30 hover:border-primary/30 transition-all text-left group"
          >
            <div className="p-2.5 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors flex-shrink-0">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Create New Site</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add a new construction site</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Forms ─────────────────────────────────────────────────────── */}
      <RegisterForm isOpen={isRegisterFormOpen} onClose={() => setIsRegisterFormOpen(false)} />
      <SiteForm
        isOpen={isSiteFormOpen}
        onClose={() => setIsSiteFormOpen(false)}
        onSubmit={handleCreateSite}
        supervisorId={selectedSupervisorId || undefined}
      />
    </div>
  );
};
export default AdminDashboard;