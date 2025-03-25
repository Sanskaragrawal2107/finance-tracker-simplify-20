
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { IndianRupee, RefreshCw } from 'lucide-react';
import CustomCard from '../ui/CustomCard';
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
  
  const refreshBalanceData = async () => {
    if (!siteId) return;
    
    setIsLoading(true);
    try {
      // Fetch data from the site_financial_summary table
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
        
        setLocalBalanceData({
          fundsReceived: data.funds_received || 0,
          fundsReceivedFromSupervisor: data.funds_received_from_supervisor || 0,
          totalExpenditure: data.total_expenses_paid || 0,
          totalAdvances: data.total_advances_paid || 0,
          debitsToWorker: data.debit_to_worker || 0,
          invoicesPaid: data.invoices_paid || 0,
          advancePaidToSupervisor: data.advance_paid_to_supervisor || 0,
          pendingInvoices: localBalanceData.pendingInvoices || 0, // Keep existing value as it's not in the summary table
          totalBalance: data.current_balance || 0
        });
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
    setLocalBalanceData(balanceData);
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

  // Set up real-time subscription to update the balance card
  useEffect(() => {
    if (!siteId) return;

    // Subscribe to changes in the site_financial_summary table
    const channel = supabase
      .channel('site_financial_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'site_financial_summary',
          filter: `site_id=eq.${siteId}`
        }, 
        (payload) => {
          console.log('Financial summary changed:', payload);
          refreshBalanceData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId]);

  return (
    <CustomCard 
      className={cn("bg-primary text-primary-foreground", className)}
      hoverEffect
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold uppercase">Site Financial Summary</h3>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-full">
            <IndianRupee className="h-5 w-5" />
          </div>
          {siteId && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/20 p-2 h-auto w-auto rounded-full" 
              onClick={refreshBalanceData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80 uppercase">Funds Received from HO:</p>
          <p className="text-lg font-semibold">₹{safeBalanceData.fundsReceived.toLocaleString()}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80 uppercase">Funds Received from Supervisor:</p>
          <p className="text-lg font-semibold">₹{safeBalanceData.fundsReceivedFromSupervisor.toLocaleString()}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80 uppercase">Total Expenses paid by supervisor:</p>
          <p className="text-lg font-semibold">₹{safeBalanceData.totalExpenditure.toLocaleString()}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80 uppercase">Total Advances paid by supervisor:</p>
          <p className="text-lg font-semibold">₹{safeBalanceData.totalAdvances.toLocaleString()}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80 uppercase">Debit to Worker:</p>
          <p className="text-lg font-semibold">₹{safeBalanceData.debitsToWorker.toLocaleString()}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80 uppercase">Invoices paid by supervisor:</p>
          <p className="text-lg font-semibold">₹{safeBalanceData.invoicesPaid.toLocaleString()}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80 uppercase">Advance Paid to Supervisor:</p>
          <p className="text-lg font-semibold">₹{safeBalanceData.advancePaidToSupervisor.toLocaleString()}</p>
        </div>
        
        <div className="pt-3 border-t border-white/20">
          <div className="flex justify-between items-center">
            <p className="text-sm opacity-80 uppercase">Current Balance:</p>
            <p className={`text-lg font-semibold ${safeBalanceData.totalBalance >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              ₹{safeBalanceData.totalBalance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </CustomCard>
  );
};

export default BalanceCard;
