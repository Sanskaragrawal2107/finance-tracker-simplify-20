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
      const { data, error } = await supabase
        .from('site_financial_summary')
        .select('*')
        .eq('site_id', siteId)
        .single();
      
      if (error) {
        const status = (error as any).status || (error as any).code;
        if (status === 406 || (error as any).code === 'PGRST116') {
          setLocalBalanceData({
            fundsReceived: 0,
            fundsReceivedFromSupervisor: 0,
            totalExpenditure: 0,
            totalAdvances: 0,
            debitsToWorker: 0,
            invoicesPaid: 0,
            advancePaidToSupervisor: 0,
            pendingInvoices: localBalanceData?.pendingInvoices || 0,
            totalBalance: 0
          });
          return;
        }
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
