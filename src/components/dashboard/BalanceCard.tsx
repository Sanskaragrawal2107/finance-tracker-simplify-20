import React from 'react';
import { BalanceSummary } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import { ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BalanceCardProps {
  balanceData: BalanceSummary;
  siteId?: string;
  refreshData?: () => void;
  className?: string;
  isLoading?: boolean;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ 
  balanceData, 
  siteId, 
  refreshData,
  className,
  isLoading = false
}) => {
  const handleRefresh = () => {
    if (refreshData) {
      refreshData();
    }
  };

  return (
    <CustomCard className={cn("bg-blue-500 text-white", className)}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">SITE FINANCIAL SUMMARY</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl">₹</span>
          {refreshData && (
            <button 
              onClick={handleRefresh}
              className="p-1 rounded-full hover:bg-blue-400 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-blue-100">FUNDS RECEIVED FROM HO:</span>
          <span className="text-xl font-bold">₹{balanceData.fundsReceived.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-blue-100">TOTAL EXPENSES PAID BY SUPERVISOR:</span>
          <span className="text-xl font-bold">₹{balanceData.totalExpenditure.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-blue-100">TOTAL ADVANCES PAID BY SUPERVISOR:</span>
          <span className="text-xl font-bold">₹{balanceData.totalAdvances.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-blue-100">DEBIT TO WORKER:</span>
          <span className="text-xl font-bold">₹{balanceData.debitsToWorker.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-blue-100">INVOICES PAID BY SUPERVISOR:</span>
          <span className="text-xl font-bold">₹{balanceData.invoicesPaid.toLocaleString()}</span>
        </div>
        
        <div className="h-px bg-blue-300 my-3"></div>
        
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium">CURRENT BALANCE:</span>
          <span className={cn(
            "text-2xl font-bold",
            balanceData.totalBalance >= 0 ? "text-green-300" : "text-red-300"
          )}>
            ₹{balanceData.totalBalance.toLocaleString()}
          </span>
        </div>
      </div>
    </CustomCard>
  );
};

export default BalanceCard;
