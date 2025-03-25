
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpenseList } from '@/components/expenses/ExpenseList';
import { AdvanceList } from '@/components/advances/AdvanceList';
import { FundsReceivedList } from '@/components/funds/FundsReceivedList';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserRole } from '@/lib/types';
import { SupervisorTransactionHistory } from '../transactions/SupervisorTransactionHistory';

interface SiteDetailTransactionsProps {
  siteId: string;
  expensesCount?: number;
  advancesCount?: number;
  fundsReceivedCount?: number;
  invoicesCount?: number;
  userRole: UserRole;
  isAdminView?: boolean;
  site?: any;
  supervisor?: any;
  expenses?: any[];
  advances?: any[];
  fundsReceived?: any[];
  onTransactionsUpdate?: () => void;
}

const SiteDetailTransactions: React.FC<SiteDetailTransactionsProps> = ({
  siteId,
  expensesCount = 0,
  advancesCount = 0,
  fundsReceivedCount = 0,
  invoicesCount = 0,
  userRole,
  isAdminView,
  site,
  supervisor,
  expenses,
  advances,
  fundsReceived,
  onTransactionsUpdate
}) => {
  const [activeTab, setActiveTab] = useState('expenses');
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`${isMobile ? 'grid grid-cols-2 gap-1' : 'flex'} mb-4 overflow-x-auto max-w-full`}>
          <TabsTrigger value="expenses" className="flex-shrink-0">
            Expenses {expensesCount > 0 && `(${expensesCount})`}
          </TabsTrigger>
          <TabsTrigger value="advances" className="flex-shrink-0">
            Advances {advancesCount > 0 && `(${advancesCount})`}
          </TabsTrigger>
          <TabsTrigger value="fundsReceived" className="flex-shrink-0">
            Funds Received {fundsReceivedCount > 0 && `(${fundsReceivedCount})`}
          </TabsTrigger>
          <TabsTrigger value="supervisorTransactions" className="flex-shrink-0">
            Supervisor Transactions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expenses">
          <ExpenseList 
            siteId={siteId} 
            userRole={userRole}
            isAdminView={isAdminView}
            initialExpenses={expenses}
            onTransactionsUpdate={onTransactionsUpdate}
          />
        </TabsContent>
        
        <TabsContent value="advances">
          <AdvanceList 
            siteId={siteId}
            userRole={userRole}
            isAdminView={isAdminView}
            initialAdvances={advances}
            onTransactionsUpdate={onTransactionsUpdate}
          />
        </TabsContent>
        
        <TabsContent value="fundsReceived">
          <FundsReceivedList 
            siteId={siteId}
            userRole={userRole}
            isAdminView={isAdminView}
            initialFundsReceived={fundsReceived}
            onTransactionsUpdate={onTransactionsUpdate}
          />
        </TabsContent>
        
        <TabsContent value="supervisorTransactions">
          <SupervisorTransactionHistory siteId={siteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SiteDetailTransactions;
