
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Expense, Advance, FundsReceived, Invoice, UserRole, BankDetails, MaterialItem, Site, RecipientType } from '@/lib/types';
import CustomCard from '@/components/ui/CustomCard';
import InvoiceDetails from '@/components/invoices/InvoiceDetails';
import { fetchSiteInvoices } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowUpRight, Check, Clock, User, Briefcase, UserCog, IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  onTransactionsUpdate?: () => void;
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
  onTransactionsUpdate
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
  const [error, setError] = useState<string | null>(null);

  // Ensure advances are not duplicated by setting them only once on initial render
  useEffect(() => {
    setLocalAdvances(advances);
  }, [advances]);

  // Update local state when props change
  useEffect(() => {
    setLocalExpenses(expenses);
    setLocalFundsReceived(fundsReceived);
  }, [expenses, fundsReceived]);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!siteId) {
        console.error('No siteId provided to load invoices');
        return;
      }
      
      setIsLoading(prev => ({ ...prev, invoices: true }));
      setError(null);
      
      try {
        console.log('Fetching invoices for site:', siteId);
        const invoicesData = await fetchSiteInvoices(siteId);
        console.log('Invoices data:', invoicesData);
        setInvoices(invoicesData as Invoice[]);
      } catch (error) {
        console.error('Error loading invoices:', error);
        setError('Failed to load invoices. Please try again.');
      } finally {
        setIsLoading(prev => ({ ...prev, invoices: false }));
      }
    };
    
    loadInvoices();
  }, [siteId]);

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

  const getRecipientTypeIcon = (type: RecipientType) => {
    switch (type) {
      case RecipientType.WORKER:
        return <User className="h-4 w-4 mr-1 text-muted-foreground" />;
      case RecipientType.SUBCONTRACTOR:
        return <Briefcase className="h-4 w-4 mr-1 text-muted-foreground" />;
      case RecipientType.SUPERVISOR:
        return <UserCog className="h-4 w-4 mr-1 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const openInvoiceDetails = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailsOpen(true);
  };

  const closeInvoiceDetails = () => {
    setIsDetailsOpen(false);
    setSelectedInvoice(null);
  };

  const renderExpensesTab = () => (
    <div className="space-y-4">
      {isLoading.expenses ? (
        <p className="text-center text-muted-foreground py-8">Loading expenses...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : localExpenses.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No expenses found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {localExpenses.map((expense) => (
                <tr key={expense.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(expense.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {expense.description}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">
                      {expense.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {expense.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                      {getStatusIcon(expense.status)}
                      <span className="ml-1 capitalize">{expense.status}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const canEditDelete = userRole === UserRole.ADMIN;

  const renderAdvancesTab = () => (
    <div className="space-y-4">
      {isLoading.advances ? (
        <p className="text-center text-muted-foreground py-8">Loading advances...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : localAdvances.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No advances found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Recipient</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Purpose</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                {canEditDelete && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {localAdvances.map((advance) => (
                <tr key={advance.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(advance.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      {getRecipientTypeIcon(advance.recipientType)}
                      {advance.recipientName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">
                      {advance.recipientType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="capitalize">{advance.purpose.replace('_', ' ')}</span>
                    {advance.remarks && advance.remarks.length > 0 && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        Note: {advance.remarks}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {advance.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(advance.status)}`}>
                      {getStatusIcon(advance.status)}
                      <span className="ml-1 capitalize">{advance.status}</span>
                    </div>
                  </td>
                  {canEditDelete && (
                    <td className="px-4 py-3 text-sm">
                      <button
                        className="text-primary hover:text-primary/80 transition-colors flex items-center"
                      >
                        View <ArrowUpRight className="h-3 w-3 ml-1" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderFundsReceivedTab = () => (
    <div className="space-y-4">
      {isLoading.fundsReceived ? (
        <p className="text-center text-muted-foreground py-8">Loading funds received...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : localFundsReceived.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No funds received for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Method</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Reference</th>
              </tr>
            </thead>
            <tbody>
              {localFundsReceived.map((fund) => (
                <tr key={fund.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(fund.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {fund.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {fund.method || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {fund.reference || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderInvoicesTab = () => (
    <div className="space-y-4">
      {isLoading.invoices ? (
        <p className="text-center text-muted-foreground py-8">Loading invoices...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-8">{error}</p>
      ) : invoices.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No invoices found for this site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Vendor</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                {canEditDelete && (
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {format(new Date(invoice.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {invoice.invoiceNumber || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {invoice.vendorName || invoice.partyName}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center">
                      <IndianRupee className="h-3 w-3 mr-1" />
                      {(invoice.amount || invoice.netAmount)?.toLocaleString() || '0'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status || invoice.paymentStatus)}`}>
                      {getStatusIcon(invoice.status || invoice.paymentStatus)}
                      <span className="ml-1 capitalize">{invoice.status || invoice.paymentStatus}</span>
                    </div>
                  </td>
                  {canEditDelete && (
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button
                          className="text-primary hover:text-primary/80 transition-colors flex items-center"
                          onClick={() => openInvoiceDetails(invoice)}
                        >
                          View <ArrowUpRight className="h-3 w-3 ml-1" />
                        </button>
                        <button className="text-blue-600 hover:text-blue-800">
                          Edit
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {isDetailsOpen && selectedInvoice && (
        <InvoiceDetails
          invoice={selectedInvoice}
          isOpen={isDetailsOpen}
          onClose={closeInvoiceDetails}
        />
      )}
    </div>
  );

  // Add console logs to debug the component rendering
  console.log('Rendering SiteDetailTransactions with data:', {
    expenses: localExpenses.length,
    advances: localAdvances.length,
    funds: localFundsReceived.length,
    invoices: invoices.length,
    loading: isLoading,
    error
  });

  return (
    <CustomCard className="mt-6">
      <Tabs defaultValue="expenses">
        <TabsList className="grid grid-cols-4 mb-4">
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
          <TabsTrigger value="invoices" className="text-sm">
            Invoices
            {invoices.length > 0 && <span className="ml-1 text-xs">({invoices.length})</span>}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expenses">{renderExpensesTab()}</TabsContent>
        <TabsContent value="advances">{renderAdvancesTab()}</TabsContent>
        <TabsContent value="funds">{renderFundsReceivedTab()}</TabsContent>
        <TabsContent value="invoices">{renderInvoicesTab()}</TabsContent>
      </Tabs>
    </CustomCard>
  );
};

export default SiteDetailTransactions;
