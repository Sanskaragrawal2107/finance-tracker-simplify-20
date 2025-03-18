import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { IndianRupee, RefreshCw } from 'lucide-react';
import CustomCard from '../ui/CustomCard';
import { BalanceSummary } from '@/lib/types';
import { supabase, calculatePaidInvoicesTotalForSite } from '@/integrations/supabase/client';
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
  
  const refreshInvoiceData = async () => {
    if (!siteId) return;
    
    setIsLoading(true);
    try {
      const invoicesPaid = await calculatePaidInvoicesTotalForSite(siteId);
      console.log("Refreshed invoices paid amount:", invoicesPaid);
      
      setLocalBalanceData(prev => ({
        ...prev,
        invoicesPaid: invoicesPaid
      }));
    } catch (error) {
      console.error("Error refreshing invoice data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (siteId) {
      refreshInvoiceData();
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
              onClick={refreshInvoiceData}
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
