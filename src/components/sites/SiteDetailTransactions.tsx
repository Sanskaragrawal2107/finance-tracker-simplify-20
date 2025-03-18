import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Expense, Advance, FundsReceived, Invoice, UserRole, BankDetails, MaterialItem, Site } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import InvoiceDetails from '@/components/invoices/InvoiceDetails';
import { fetchSiteInvoices } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowUpRight, Check, Clock } from 'lucide-react';

interface SiteDetailTransactionsProps {
  siteId: string;
  expensesCount?: number;
  advancesCount?: number;
  fundsReceivedCount?: number;
  userRole: UserRole;
  isAdminView?: boolean;
  site?: Site;
  supervisor?: any;
  expenses?: Expense[];
  advances?: Advance[];
  fundsReceived?: FundsReceived[];
}

const SiteDetailTransactions: React.FC<SiteDetailTransactionsProps> = ({
  siteId,
  expensesCount = 0,
  advancesCount = 0,
  fundsReceivedCount = 0,
  userRole,
  isAdminView,
  site,
  supervisor,
  expenses = [],
  advances = [],
  fundsReceived = [],
}) => {
  console.info('SiteDetailTransactions props:', { 
    siteId, 
    expensesCount, 
    advancesCount, 
    fundsReceivedCount, 
    userRole, 
    isAdminView,
    site,
    supervisor
  });

  const [localExpenses, setLocalExpenses] = useState<Expense[]>(expenses);
  const [localAdvances, setLocalAdvances] = useState<Advance[]>(advances);
  const [localFundsReceived, setLocalFundsReceived] = useState<FundsReceived[]>(fundsReceived);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState({
    expenses: false,
    advances: false,
    fundsReceived: false,
    invoices: false,
  });

  // Load site invoices
  useEffect(() => {
    const loadInvoices = async () => {
      if (!siteId) return;
      
      setIsLoading(prev => ({ ...prev, invoices: true }));
      
      try {
        const invoicesData = await fetchSiteInvoices(siteId);
        // We need to cast this directly to Invoice[] since the function is now returning the correct type
        setInvoices(invoicesData as Invoice[]);
      } catch (error) {
        console.error('Error loading invoices:', error);
      } finally {
        setIsLoading(prev => ({ ...prev, invoices: false }));
      }
    };
    
    loadInvoices();
  }, [siteId]);

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-orange-600 bg-orange-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Helper function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <Check className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Open invoice details
  const openInvoiceDetails = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsOpen(true);
  };

  // Close invoice details
  const closeInvoiceDetails = () => {
    setIsDetailsOpen(false);
    setSelectedInvoice(null);
  };

  // Function to render expenses tab content
  const renderExpensesTab = () => (
    <div className="space-y-4">
      {localExpenses.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No expenses found for this site.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localExpenses.map((expense) => (
            <Card key={expense.id} className="p-4">
              {/* Expense card content */}
              <p>Expense: {expense.description}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Function to render advances tab content
  const renderAdvancesTab = () => (
    <div className="space-y-4">
      {localAdvances.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No advances found for this site.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localAdvances.map((advance) => (
            <Card key={advance.id} className="p-4">
              {/* Advance card content */}
              <p>Advance: {advance.recipientName}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Function to render funds received tab content
  const renderFundsReceivedTab = () => (
    <div className="space-y-4">
      {localFundsReceived.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No funds received for this site.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localFundsReceived.map((fund) => (
            <Card key={fund.id} className="p-4">
              {/* Fund card content */}
              <p>Fund: ₹{fund.amount}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Function to render invoices tab content
  const renderInvoicesTab = () => (
    <div className="space-y-4">
      {isLoading.invoices ? (
        <p className="text-center text-muted-foreground py-8">Loading invoices...</p>
      ) : invoices.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No invoices found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Party</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Material</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(invoice.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{invoice.partyName}</td>
                  <td className="px-4 py-3 text-sm">{invoice.material}</td>
                  <td className="px-4 py-3 text-sm">₹{invoice.netAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.paymentStatus)}`}>
                      {getStatusIcon(invoice.paymentStatus)}
                      <span className="ml-1">{invoice.paymentStatus}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => openInvoiceDetails(invoice)}
                      className="text-primary hover:text-primary/80 transition-colors flex items-center"
                    >
                      View <ArrowUpRight className="h-3 w-3 ml-1" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Invoice Details Modal */}
      {isDetailsOpen && selectedInvoice && (
        <InvoiceDetails
          invoice={selectedInvoice}
          isOpen={isDetailsOpen}
          onClose={closeInvoiceDetails}
        />
      )}
    </div>
  );

  return (
    <CustomCard className="mt-6">
      <Tabs defaultValue="invoices">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="invoices" className="text-sm">
            Invoices
            {invoices.length > 0 && <span className="ml-1 text-xs">({invoices.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-sm">
            Expenses
            {expensesCount > 0 && <span className="ml-1 text-xs">({expensesCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="advances" className="text-sm">
            Advances
            {advancesCount > 0 && <span className="ml-1 text-xs">({advancesCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="funds" className="text-sm">
            Funds Received
            {fundsReceivedCount > 0 && <span className="ml-1 text-xs">({fundsReceivedCount})</span>}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="invoices">{renderInvoicesTab()}</TabsContent>
        <TabsContent value="expenses">{renderExpensesTab()}</TabsContent>
        <TabsContent value="advances">{renderAdvancesTab()}</TabsContent>
        <TabsContent value="funds">{renderFundsReceivedTab()}</TabsContent>
      </Tabs>
    </CustomCard>
  );
};

export default SiteDetailTransactions;
