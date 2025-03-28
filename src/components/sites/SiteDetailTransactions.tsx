import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpenseList } from '@/components/expenses/ExpenseList';
import { AdvanceList } from '@/components/advances/AdvanceList';
import { FundsReceivedList } from '@/components/funds/FundsReceivedList';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserRole } from '@/lib/types';
import { SupervisorTransactionHistory } from '../transactions/SupervisorTransactionHistory';
import { VisibilityContext } from '@/App';

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
  invoices?: any[];
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
  invoices,
  onTransactionsUpdate
}) => {
  const [activeTab, setActiveTab] = useState('expenses');
  const isMobile = useIsMobile();
  
  // Reset components when the site changes
  useEffect(() => {
    setActiveTab('expenses');
  }, [siteId]);
  
  // This ensures that tab changes trigger correctly and components are memoized appropriately
  const handleTabChange = useCallback((value: string) => {
    console.log('Changing tab to:', value);
    setActiveTab(value);
  }, []);

  // Force a fresh render when changing tabs using a unique key per tab
  const getTabKey = useCallback((tabName: string) => {
    return `${tabName}-${siteId}`;
  }, [siteId]);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
          <TabsTrigger value="invoices" className="flex-shrink-0">
            Invoices {invoicesCount > 0 && `(${invoicesCount})`}
          </TabsTrigger>
          <TabsTrigger value="supervisorTransactions" className="flex-shrink-0">
            Supervisor Transactions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expenses">
          {activeTab === "expenses" && (
            <div key={getTabKey('expenses')}>
              <ExpenseList 
                siteId={siteId} 
                userRole={userRole}
                isAdminView={isAdminView}
                initialExpenses={expenses}
                onTransactionsUpdate={onTransactionsUpdate}
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="advances">
          {activeTab === "advances" && (
            <div key={getTabKey('advances')}>
              <AdvanceList 
                siteId={siteId}
                userRole={userRole}
                isAdminView={isAdminView}
                initialAdvances={advances}
                onTransactionsUpdate={onTransactionsUpdate}
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="fundsReceived">
          {activeTab === "fundsReceived" && (
            <div key={getTabKey('fundsReceived')}>
              <FundsReceivedList 
                siteId={siteId}
                userRole={userRole}
                isAdminView={isAdminView}
                initialFundsReceived={fundsReceived}
                onTransactionsUpdate={onTransactionsUpdate}
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="invoices">
          {activeTab === "invoices" && (
            <div key={getTabKey('invoices')}>
              <InvoiceList 
                siteId={siteId}
                userRole={userRole}
                isAdminView={isAdminView}
                onTransactionsUpdate={onTransactionsUpdate}
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="supervisorTransactions">
          {activeTab === "supervisorTransactions" && (
            <div key={getTabKey('supervisorTransactions')}>
              <SupervisorTransactionHistory 
                siteId={siteId} 
                isAdminView={isAdminView} 
                onTransactionsUpdate={onTransactionsUpdate}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SiteDetailTransactions;
