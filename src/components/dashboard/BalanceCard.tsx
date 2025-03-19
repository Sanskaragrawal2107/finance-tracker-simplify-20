
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { IndianRupee, RefreshCw } from 'lucide-react';
import CustomCard from '../ui/CustomCard';
import { BalanceSummary, AdvancePurpose } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../ui/button';

interface BalanceCardProps {
  balanceData: BalanceSummary;
  className?: string;
  siteId?: string;
}

const DEBIT_ADVANCE_PURPOSES = [
  AdvancePurpose.SAFETY_SHOES,
  AdvancePurpose.TOOLS,
  AdvancePurpose.OTHER
];

const BalanceCard: React.FC<BalanceCardProps> = ({ 
  balanceData,
  className,
  siteId
}) => {
  const [localBalanceData, setLocalBalanceData] = useState(balanceData);
  const [isLoading, setIsLoading] = useState(false);
  
  const refreshSiteData = async () => {
    if (!siteId) return;
    
    setIsLoading(true);
    try {
      // Fetch funds received
      const { data: fundsData, error: fundsError } = await supabase
        .from('funds_received')
        .select('amount')
        .eq('site_id', siteId);
      
      if (fundsError) throw fundsError;
      const fundsReceived = fundsData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      
      // Fetch expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('site_id', siteId);
      
      if (expensesError) throw expensesError;
      const totalExpenditure = expensesData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      
      // Fetch advances and calculate totals based on purpose
      const { data: advancesData, error: advancesError } = await supabase
        .from('advances')
        .select('amount, purpose')
        .eq('site_id', siteId);
      
      if (advancesError) throw advancesError;
      
      let totalAdvances = 0;
      let debitsToWorker = 0;
      
      advancesData?.forEach(advance => {
        if (DEBIT_ADVANCE_PURPOSES.includes(advance.purpose as AdvancePurpose)) {
          debitsToWorker += Number(advance.amount);
        } else {
          totalAdvances += Number(advance.amount);
        }
      });
      
      // Fetch invoices paid by supervisor
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('site_invoices')
        .select('net_amount, approver_type')
        .eq('site_id', siteId)
        .eq('payment_status', 'paid');
      
      if (invoicesError) throw invoicesError;
      
      const invoicesPaid = invoicesData?.reduce((sum, invoice) => {
        // Only count invoices approved by supervisor in the balance calculation
        if (invoice.approver_type === 'supervisor') {
          return sum + Number(invoice.net_amount);
        }
        return sum;
      }, 0) || 0;
      
      console.log("Refreshed site data:", {
        fundsReceived,
        totalExpenditure,
        totalAdvances,
        debitsToWorker,
        invoicesPaid
      });
      
      // Calculate total balance
      const totalBalance = fundsReceived - totalExpenditure - totalAdvances - invoicesPaid;
      
      setLocalBalanceData({
        fundsReceived,
        totalExpenditure,
        totalAdvances,
        debitsToWorker,
        invoicesPaid,
        pendingInvoices: 0, // Not calculating this for now
        totalBalance
      });
    } catch (error) {
      console.error("Error refreshing site data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (siteId) {
      refreshSiteData();
    }
  }, [siteId]);
  
  useEffect(() => {
    setLocalBalanceData(balanceData);
  }, [balanceData]);

  const safeBalanceData = {
    fundsReceived: localBalanceData.fundsReceived || 0,
    totalExpenditure: localBalanceData.totalExpenditure || 0,
    totalAdvances: localBalanceData.totalAdvances || 0,
    debitsToWorker: localBalanceData.debitsToWorker || 0,
    invoicesPaid: localBalanceData.invoicesPaid || 0,
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
              onClick={refreshSiteData}
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
