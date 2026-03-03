import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { IndianRupee, RefreshCw } from 'lucide-react';
import { BalanceSummary } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../ui/button';

interface BalanceCardProps {
  balanceData: BalanceSummary;
  className?: string;
  siteId?: string;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ 
  balanceData,
  className,
  siteId
}) => {
  const [localBalanceData, setLocalBalanceData] = useState(balanceData);
  const [isLoading, setIsLoading] = useState(false);
  // Track whether we've loaded live data from DB; if so, ignore prop updates
  const dbLoadedRef = React.useRef(false);
  
  const refreshBalanceData = async () => {
    if (!siteId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_financial_summary')
        .select('*')
        .eq('site_id', siteId)
        .single();
      
      if (error) {
        console.error("Error fetching site financial summary:", error);
        return;
      }
      
      if (data) {
        console.log("Retrieved financial summary from DB:", data);
        
        // Get the correct values
        const fundsReceived = data.funds_received || 0;
        const fundsReceivedFromSupervisor = data.funds_received_from_supervisor || 0;
        const totalExpensesPaid = data.total_expenses_paid || 0;
        const totalAdvancesPaid = data.total_advances_paid || 0;
        const debitsToWorker = data.debit_to_worker || 0;
        const invoicesPaid = data.invoices_paid || 0;
        const advancePaidToSupervisor = data.advance_paid_to_supervisor || 0;
        
        // Calculate total balance using the correct formula:
        // (Funds Received from HO + Funds Received from Supervisor) - 
        // (Total Expenses Paid by Supervisor + Total Advances Paid by Supervisor + Invoices Paid by Supervisor + Advance Paid to Supervisor)
        const totalBalance = (fundsReceived + fundsReceivedFromSupervisor) - 
                             (totalExpensesPaid + totalAdvancesPaid + invoicesPaid + advancePaidToSupervisor);
        
        setLocalBalanceData({
          fundsReceived,
          fundsReceivedFromSupervisor,
          totalExpenditure: totalExpensesPaid,
          totalAdvances: totalAdvancesPaid,
          debitsToWorker,
          invoicesPaid,
          advancePaidToSupervisor,
          pendingInvoices: localBalanceData.pendingInvoices || 0,
          totalBalance
        });
        dbLoadedRef.current = true;
      }
    } catch (error) {
      console.error("Error refreshing balance data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (siteId) {
      refreshBalanceData();
    }
  }, [siteId]);
  
  useEffect(() => {
    // If we already loaded live data from DB, don't let stale prop data overwrite it
    if (siteId && dbLoadedRef.current) return;

    // Update local balance data when prop changes
    // But ensure we calculate the correct total balance
    const fundsReceived = balanceData.fundsReceived || 0;
    const fundsReceivedFromSupervisor = balanceData.fundsReceivedFromSupervisor || 0;
    const totalExpenditure = balanceData.totalExpenditure || 0;
    const totalAdvances = balanceData.totalAdvances || 0;
    const invoicesPaid = balanceData.invoicesPaid || 0;
    const advancePaidToSupervisor = balanceData.advancePaidToSupervisor || 0;
    const debitsToWorker = balanceData.debitsToWorker || 0;
    
    // Calculate total balance using the correct formula
    const totalBalance = (fundsReceived + fundsReceivedFromSupervisor) - 
                         (totalExpenditure + totalAdvances + invoicesPaid + advancePaidToSupervisor);
    
    setLocalBalanceData({
      ...balanceData,
      totalBalance
    });
  }, [balanceData]);

  const safeBalanceData = {
    fundsReceived: localBalanceData.fundsReceived || 0,
    fundsReceivedFromSupervisor: localBalanceData.fundsReceivedFromSupervisor || 0,
    totalExpenditure: localBalanceData.totalExpenditure || 0,
    totalAdvances: localBalanceData.totalAdvances || 0,
    debitsToWorker: localBalanceData.debitsToWorker || 0,
    invoicesPaid: localBalanceData.invoicesPaid || 0,
    advancePaidToSupervisor: localBalanceData.advancePaidToSupervisor || 0,
    pendingInvoices: localBalanceData.pendingInvoices || 0,
    totalBalance: localBalanceData.totalBalance || 0
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-border/60 shadow-sm overflow-hidden flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="bg-primary px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">Site Financial Summary</p>
          <p
            className={cn(
              'text-2xl font-bold mt-1 tabular-nums',
              safeBalanceData.totalBalance >= 0 ? 'text-white' : 'text-red-300'
            )}
          >
            ₹{safeBalanceData.totalBalance.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-primary-foreground/60 mt-0.5">Current Balance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-white/10 rounded-lg">
            <IndianRupee className="h-5 w-5 text-primary-foreground" />
          </div>
          {siteId && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/20 h-8 w-8 rounded-lg"
              onClick={refreshBalanceData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Body — two-column grid */}
      <div className="flex-1 p-5">
        <div className="grid grid-cols-1 gap-2">
          {[
            { label: 'Funds from Head Office',       value: safeBalanceData.fundsReceived,            type: 'credit' },
            { label: 'Funds from Supervisor',         value: safeBalanceData.fundsReceivedFromSupervisor, type: 'credit' },
            { label: 'Expenses paid',                value: safeBalanceData.totalExpenditure,          type: 'debit' },
            { label: 'Advances paid',                value: safeBalanceData.totalAdvances,             type: 'debit' },
            { label: 'Invoices paid',                value: safeBalanceData.invoicesPaid,              type: 'debit' },
            { label: 'Advance to Supervisor',        value: safeBalanceData.advancePaidToSupervisor,   type: 'debit' },
            { label: 'Debit to Worker',              value: safeBalanceData.debitsToWorker,            type: 'debit' },
          ].map(({ label, value, type }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-2">
                <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', type === 'credit' ? 'bg-emerald-500' : 'bg-red-400')} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <span className={cn('text-xs font-semibold tabular-nums', type === 'credit' ? 'text-emerald-700' : 'text-foreground')}>
                ₹{value.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;
